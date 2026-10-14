const { app } = require('electron');
const { getMachineId, generateActivationCode, INVITE_CODE, INVITE_DURATION_DAYS } = require('./inviteConfig');

const SUPABASE_URL = 'https://ryoqhtsdhfbydmejmaby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4';
const LEGACY_COMPANY_ID = '715526d2-f05a-458f-8cf7-179ee172a7a1';

function getLicenseSettings(accountingDb) {
    try {
        const rows = accountingDb.prepare(`
            SELECT key, value FROM settings 
            WHERE key IN ('company_id', 'companyName', 'invite_code', 'invite_expiry', 'renew_count', 'license_status', 'trial_starts_at', 'bound_machine_id')
        `).all();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });
        return map;
    } catch (_) {
        return {};
    }
}

function saveSetting(accountingDb, key, value) {
    try {
        accountingDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    } catch (_) {}
}

function isLegacyClient(accountingDb, map) {
    return map.company_id === LEGACY_COMPANY_ID;
}

function initLicenseForDatabase(accountingDb) {
    const map = getLicenseSettings(accountingDb);

    if (!map.company_id) {
        const newCompanyId = require('crypto').randomUUID();
        saveSetting(accountingDb, 'company_id', newCompanyId);
        map.company_id = newCompanyId;
    }
    
    if (isLegacyClient(accountingDb, map)) {
        saveSetting(accountingDb, 'license_status', 'lifetime');
        saveSetting(accountingDb, 'invite_expiry', '2099-12-31T23:59:59.000Z');
        saveSetting(accountingDb, 'renew_count', '999');
        return {
            status: 'lifetime',
            valid: true,
            remainingDays: 99999
        };
    }

    if (!map.invite_expiry) {
        const now = new Date();
        const expiry = new Date(now.getTime() + (INVITE_DURATION_DAYS * 24 * 60 * 60 * 1000));
        const currentMachineId = getMachineId();
        saveSetting(accountingDb, 'trial_starts_at', now.toISOString());
        saveSetting(accountingDb, 'invite_expiry', expiry.toISOString());
        saveSetting(accountingDb, 'invite_code', INVITE_CODE);
        saveSetting(accountingDb, 'renew_count', '0');
        saveSetting(accountingDb, 'license_status', 'trial');
        saveSetting(accountingDb, 'bound_machine_id', currentMachineId);
        return {
            status: 'trial',
            valid: true,
            remainingDays: INVITE_DURATION_DAYS
        };
    }

    return null;
}


async function syncLicenseWithCloud(companyId, companyName, machineId, desktopVersion) {
    if (!app.isPackaged || typeof fetch !== 'function') return null;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_client_license`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_company_id: companyId,
                p_company_name: companyName || null,
                p_machine_id: machineId || '',
                p_desktop_version: desktopVersion || '10.1.0',
                p_trial_days: INVITE_DURATION_DAYS
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
    } catch (_) {
        clearTimeout(timeout);
        return null;
    }
}

async function notifyCloudRenewal(companyId, extendDays = 30) {
    if (!app.isPackaged || typeof fetch !== 'function') return null;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/renew_client_license`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_company_id: companyId,
                p_extend_days: extendDays
            })
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (_) {
        return null;
    }
}

async function getLicenseStatus(accountingDb) {
    initLicenseForDatabase(accountingDb);
    const map = getLicenseSettings(accountingDb);

    const machineId = getMachineId();
    const renewCount = parseInt(map.renew_count || '0', 10);
    const nextCycle = renewCount + 1;
    let licenseStatus = map.license_status || (isLegacyClient(accountingDb, map) ? 'lifetime' : 'trial');
    let expiresAt = map.invite_expiry ? new Date(map.invite_expiry) : new Date();

    const appVersion = app.getVersion ? app.getVersion() : '10.1.0';
    const cloudSync = await syncLicenseWithCloud(map.company_id, map.companyName, `${machineId}-${nextCycle}`, appVersion);

    if (cloudSync && cloudSync.success) {
        licenseStatus = cloudSync.license_status;
        saveSetting(accountingDb, 'license_status', licenseStatus);

        if (licenseStatus === 'suspended') {
            return {
                valid: false,
                status: 'suspended',
                remainingDays: 0,
                requiresCode: true,
                error: 'تم تعليق ترخيص النظام من قبل الإدارة.',
                machineId: `${machineId}-${nextCycle}`
            };
        }

        if (licenseStatus === 'lifetime') {
            saveSetting(accountingDb, 'invite_expiry', '2099-12-31T23:59:59.000Z');
            return {
                valid: true,
                status: 'lifetime',
                remainingDays: 99999,
                requiresCode: false,
                cycle: nextCycle,
                machineId: `${machineId}-${nextCycle}`,
                startsAt: map.trial_starts_at || null,
                expiresAt: '2099-12-31T23:59:59.000Z'
            };
        }

        if (cloudSync.expires_at) {
            expiresAt = new Date(cloudSync.expires_at);
            saveSetting(accountingDb, 'invite_expiry', expiresAt.toISOString());
            saveSetting(accountingDb, 'renew_count', String(cloudSync.renew_count || renewCount));
            
            const now = new Date();
            const remainingMs = expiresAt.getTime() - now.getTime();
            const remainingDays = cloudSync.remaining_days !== undefined 
                ? cloudSync.remaining_days 
                : Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
            const isValid = cloudSync.is_valid !== undefined 
                ? Boolean(cloudSync.is_valid) 
                : (remainingMs > 0);

            return {
                valid: isValid,
                status: licenseStatus,
                remainingDays,
                expiresAt: expiresAt.toISOString(),
                startsAt: map.trial_starts_at || null,
                requiresCode: !isValid,
                cycle: nextCycle,
                machineId: `${machineId}-${nextCycle}`
            };
        }
    }

    if (licenseStatus === 'lifetime' || (isLegacyClient(accountingDb, map) && !map.invite_expiry)) {
        return {
            valid: true,
            status: 'lifetime',
            remainingDays: 99999,
            requiresCode: false,
            cycle: 999,
            machineId: `${machineId}-${nextCycle}`,
            startsAt: map.trial_starts_at || null,
            expiresAt: '2099-12-31T23:59:59.000Z'
        };
    }

    if (!isLegacyClient(accountingDb, map) && licenseStatus !== 'lifetime' && map.bound_machine_id && map.bound_machine_id !== machineId) {
        return {
            valid: false,
            status: 'unauthorized_device',
            remainingDays: 0,
            expiresAt: expiresAt.toISOString(),
            startsAt: map.trial_starts_at || null,
            requiresCode: true,
            cycle: nextCycle,
            machineId: `${machineId}-${nextCycle}`,
            error: 'تم تشغيل البرنامج على جهاز كمبيوتر غير مصرح له.'
        };
    }

    const now = new Date();
    if (map.trial_starts_at && now.getTime() < new Date(map.trial_starts_at).getTime()) {
        return {
            valid: false,
            status: 'expired',
            remainingDays: 0,
            expiresAt: expiresAt.toISOString(),
            startsAt: map.trial_starts_at || null,
            requiresCode: true,
            cycle: nextCycle,
            machineId: `${machineId}-${nextCycle}`,
            error: 'تم اكتشاف تلاعب في ساعة النظام.'
        };
    }

    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const isValid = (remainingMs > 0) && (licenseStatus !== 'suspended');

    return {
        valid: isValid,
        status: licenseStatus,
        remainingDays,
        expiresAt: expiresAt.toISOString(),
        startsAt: map.trial_starts_at || null,
        requiresCode: !isValid,
        cycle: nextCycle,
        machineId: `${machineId}-${nextCycle}`
    };
}

function isLicenseCurrentlyValid(accountingDb) {
    const map = getLicenseSettings(accountingDb);
    if (map.license_status === 'suspended') {
        return false;
    }
    if (map.license_status === 'lifetime' || isLegacyClient(accountingDb, map)) {
        return true;
    }
    if (!map.invite_expiry) {
        return false;
    }
    const currentMachineId = getMachineId();
    if (map.bound_machine_id && map.bound_machine_id !== currentMachineId) {
        return false;
    }
    const expiresAt = new Date(map.invite_expiry);
    const now = new Date();
    if (map.trial_starts_at && now.getTime() < new Date(map.trial_starts_at).getTime()) {
        return false;
    }
    return expiresAt.getTime() > now.getTime();
}

async function activateLicenseWithCode(accountingDb, code) {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) {
        return { success: false, error: 'يرجى إدخال كود التفعيل.' };
    }

    const map = getLicenseSettings(accountingDb);
    const machineId = getMachineId();
    const renewCount = parseInt(map.renew_count || '0', 10);
    const nextCycle = renewCount + 1;

    const expectedDynamicCode = generateActivationCode(`${machineId}-${nextCycle}`).toUpperCase();

    if (cleanCode !== expectedDynamicCode) {
        return {
            success: false,
            error: 'كود التفعيل غير صحيح أو غير متطابق مع دورة التجديد الحالية للجهاز.'
        };
    }

    const now = new Date();
    const currentExpiry = map.invite_expiry ? new Date(map.invite_expiry) : now;
    const baseTime = currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const newExpiresAt = new Date(baseTime.getTime() + (30 * 24 * 60 * 60 * 1000));
    const newStatus = 'active';

    const stmt = accountingDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
    const tx = accountingDb.transaction(() => {
        stmt.run({ key: 'invite_code', value: cleanCode });
        stmt.run({ key: 'invite_expiry', value: newExpiresAt.toISOString() });
        stmt.run({ key: 'renew_count', value: String(nextCycle) });
        stmt.run({ key: 'license_status', value: newStatus });
        stmt.run({ key: 'bound_machine_id', value: machineId });
    });
    tx();

    notifyCloudRenewal(map.company_id, 30).catch(() => {});

    return {
        success: true,
        expiresAt: newExpiresAt.toISOString(),
        remainingDays: 30,
        status: newStatus,
        renewCount: nextCycle
    };
}

module.exports = {
    initLicenseForDatabase,
    getLicenseStatus,
    isLicenseCurrentlyValid,
    activateLicenseWithCode,
    getLicenseSettings
};
