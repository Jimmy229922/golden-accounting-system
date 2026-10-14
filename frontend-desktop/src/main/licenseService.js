const crypto = require('crypto');
const { app } = require('electron');
const { getMachineId, generateActivationCode, INVITE_CODE, INVITE_DURATION_DAYS } = require('./inviteConfig');

const SUPABASE_URL = 'https://ryoqhtsdhfbydmejmaby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4';
const LEGACY_COMPANY_ID = '715526d2-f05a-458f-8cf7-179ee172a7a1';
const SERVER_PUBLIC_KEY_BASE64 = 'MCowBQYDK2VwAyEAK0kEUFKkPWaUkYWPp/dkQXRoX7qVdyHNUP/C8v9Eeak=';

function verifyServerCertificate(cert, signatureBase64) {
    if (!cert || !signatureBase64) return false;
    try {
        const canonicalString = `${cert.company_id}|${cert.machine_id}|${cert.status}|${cert.expires_at}|${cert.issued_at}|${cert.offline_grace_days}`;
        const pubDer = Buffer.from(SERVER_PUBLIC_KEY_BASE64, 'base64');
        const pubKey = crypto.createPublicKey({ key: pubDer, format: 'der', type: 'spki' });
        const sig = Buffer.from(signatureBase64, 'base64');
        return crypto.verify(null, Buffer.from(canonicalString), pubKey, sig);
    } catch (_) {
        return false;
    }
}

function getLicenseSettings(accountingDb) {
    try {
        const rows = accountingDb.prepare(`
            SELECT key, value FROM settings 
            WHERE key IN ('company_id', 'companyName', 'invite_code', 'invite_expiry', 'renew_count', 'license_status', 'trial_starts_at', 'bound_machine_id', 'license_certificate', 'license_signature', 'license_last_verified_at')
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


async function callLicenseGateway(action, bodyPayload) {
    if (typeof fetch !== 'function') return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/license-gateway`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action,
                ...bodyPayload
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await response.json().catch(() => null);
        return { status: response.status, ok: response.ok, data };
    } catch (_) {
        clearTimeout(timeout);
        return null;
    }
}

async function syncLicenseWithCloud(companyId, companyName, machineId, desktopVersion) {
    if (((!app || !app.isPackaged) && process.env.ENABLE_CLOUD_LICENSE !== 'true') || typeof fetch !== 'function') return null;
    
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
                p_desktop_version: desktopVersion || '10.1.5',
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
    if (typeof fetch !== 'function') return null;
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

let periodicTimer = null;
function startPeriodicLicenseCheck(accountingDb) {
    if (periodicTimer) return;
    periodicTimer = setInterval(async () => {
        try {
            await getLicenseStatus(accountingDb);
        } catch (_) {}
    }, 6 * 60 * 60 * 1000);
    if (periodicTimer && periodicTimer.unref) periodicTimer.unref();
}

function checkAndRecordClock(accountingDb, now) {
    try {
        const lastRow = accountingDb.prepare("SELECT value FROM settings WHERE key = 'license_clock_marker'").get();
        const lastSeen = lastRow && lastRow.value ? new Date(lastRow.value).getTime() : 0;
        const current = now.getTime();
        if (lastSeen > 0 && current < (lastSeen - 60000)) {
            return false;
        }
        if (current > lastSeen) {
            saveSetting(accountingDb, 'license_clock_marker', now.toISOString());
        }
        return true;
    } catch (_) {
        return true;
    }
}

async function getLicenseStatus(accountingDb) {
    initLicenseForDatabase(accountingDb);
    startPeriodicLicenseCheck(accountingDb);
    const map = getLicenseSettings(accountingDb);

    const machineId = getMachineId();
    const renewCount = parseInt(map.renew_count || '0', 10);
    const nextCycle = renewCount + 1;
    let licenseStatus = map.license_status || (isLegacyClient(accountingDb, map) ? 'lifetime' : 'trial');
    let expiresAt = map.invite_expiry ? new Date(map.invite_expiry) : new Date();

    const appVersion = (app && app.getVersion) ? app.getVersion() : '10.1.5';

    const gatewayRes = await callLicenseGateway('check', {
        company_id: map.company_id,
        company_name: map.companyName || null,
        machine_id: machineId,
        desktop_version: appVersion
    });

    if (gatewayRes && gatewayRes.ok && gatewayRes.data && gatewayRes.data.success) {
        const cert = gatewayRes.data.certificate;
        const signature = gatewayRes.data.signature;
        if (cert && signature && verifyServerCertificate(cert, signature)) {
            licenseStatus = cert.status;
            saveSetting(accountingDb, 'license_certificate', JSON.stringify(cert));
            saveSetting(accountingDb, 'license_signature', signature);
            saveSetting(accountingDb, 'license_last_verified_at', new Date().toISOString());
            saveSetting(accountingDb, 'license_status', licenseStatus);
            saveSetting(accountingDb, 'invite_expiry', cert.expires_at);
            if (cert.machine_id) {
                saveSetting(accountingDb, 'bound_machine_id', cert.machine_id);
            }

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

            if (licenseStatus === 'lifetime' || isLegacyClient(accountingDb, map)) {
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

            const isValid = Boolean(gatewayRes.data.is_valid);
            const remainingDays = gatewayRes.data.remaining_days !== undefined
                ? gatewayRes.data.remaining_days
                : Math.max(0, Math.ceil((new Date(cert.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

            return {
                valid: isValid,
                status: licenseStatus,
                remainingDays,
                expiresAt: cert.expires_at,
                startsAt: map.trial_starts_at || null,
                requiresCode: !isValid,
                cycle: nextCycle,
                machineId: `${machineId}-${nextCycle}`
            };
        }
    }

    if (gatewayRes && !gatewayRes.ok && gatewayRes.data && gatewayRes.data.error) {
        if (gatewayRes.data.error === 'UNAUTHORIZED_DEVICE') {
            return {
                valid: false,
                status: 'unauthorized_device',
                remainingDays: 0,
                requiresCode: true,
                error: gatewayRes.data.message || 'تم تشغيل البرنامج على جهاز كمبيوتر غير مصرح له.',
                machineId: `${machineId}-${nextCycle}`
            };
        }
        if (gatewayRes.data.error === 'TRIAL_ALREADY_USED') {
            return {
                valid: false,
                status: 'expired',
                remainingDays: 0,
                requiresCode: true,
                error: gatewayRes.data.message || 'تم استخدام الفترة التجريبية لهذا الجهاز مسبقاً.',
                machineId: `${machineId}-${nextCycle}`
            };
        }
    }

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

        if (licenseStatus === 'lifetime' || isLegacyClient(accountingDb, map)) {
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

    if (map.license_certificate && map.license_signature) {
        try {
            const cert = JSON.parse(map.license_certificate);
            const isCertValid = verifyServerCertificate(cert, map.license_signature);
            if (isCertValid && (cert.company_id === map.company_id)) {
                const machineMatch = isLegacyClient(accountingDb, map) || (cert.machine_id === machineId);
                if (machineMatch) {
                    if (cert.status === 'lifetime' || isLegacyClient(accountingDb, map)) {
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

                    const now = new Date();
                    const certIssued = new Date(cert.issued_at || 0);
                    if (now.getTime() < certIssued.getTime() || !checkAndRecordClock(accountingDb, now)) {
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

                    const lastVerified = new Date(map.license_last_verified_at || cert.issued_at || 0);
                    const graceDays = cert.offline_grace_days || 14;
                    const daysOffline = (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24);
                    const expiryDate = new Date(cert.expires_at);
                    const isWithinGrace = daysOffline <= graceDays;
                    const isNotExpired = expiryDate.getTime() > now.getTime();
                    const isValid = (cert.status !== 'suspended') && isWithinGrace && isNotExpired;
                    const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

                    return {
                        valid: isValid,
                        status: cert.status,
                        remainingDays,
                        expiresAt: cert.expires_at,
                        startsAt: map.trial_starts_at || null,
                        requiresCode: !isValid,
                        cycle: nextCycle,
                        machineId: `${machineId}-${nextCycle}`,
                        error: !isWithinGrace ? 'انتهت فترة السماح للعمل بدون إنترنت (14 يوماً). يرجى الاتصال بالإنترنت لتحديث الترخيص.' : undefined
                    };
                }
            }
        } catch (_) {}
    }

    if (isLegacyClient(accountingDb, map)) {
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
    if ((map.trial_starts_at && now.getTime() < new Date(map.trial_starts_at).getTime()) || !checkAndRecordClock(accountingDb, now)) {
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
    if (isLegacyClient(accountingDb, map)) {
        return true;
    }
    if (map.license_certificate && map.license_signature) {
        try {
            const cert = JSON.parse(map.license_certificate);
            if (verifyServerCertificate(cert, map.license_signature) && cert.company_id === map.company_id) {
                if (cert.status === 'suspended') return false;
                if (cert.status === 'lifetime') return true;
                const now = new Date();
                const certExpiry = new Date(cert.expires_at);
                if (certExpiry.getTime() <= now.getTime()) return false;
                const lastVerified = new Date(map.license_last_verified_at || cert.issued_at || 0);
                const graceDays = cert.offline_grace_days || 14;
                const daysOffline = (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24);
                return daysOffline <= graceDays;
            } else {
                return false;
            }
        } catch (_) {
            return false;
        }
    }
    if (map.license_status === 'lifetime') {
        return false;
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

    const gatewayRes = await callLicenseGateway('activate', {
        company_id: map.company_id,
        machine_id: machineId,
        activation_code: cleanCode
    });

    if (gatewayRes && gatewayRes.data) {
        if (gatewayRes.ok && gatewayRes.data.success) {
            const cert = gatewayRes.data.certificate;
            const sig = gatewayRes.data.signature;
            const newExpiresAt = gatewayRes.data.expires_at || cert?.expires_at;
            const newStatus = cert?.status || 'active';

            const stmt = accountingDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
            const tx = accountingDb.transaction(() => {
                stmt.run({ key: 'invite_code', value: cleanCode });
                if (newExpiresAt) stmt.run({ key: 'invite_expiry', value: newExpiresAt });
                stmt.run({ key: 'renew_count', value: String(nextCycle) });
                stmt.run({ key: 'license_status', value: newStatus });
                stmt.run({ key: 'bound_machine_id', value: machineId });
                if (cert && sig) {
                    stmt.run({ key: 'license_certificate', value: JSON.stringify(cert) });
                    stmt.run({ key: 'license_signature', value: sig });
                    stmt.run({ key: 'license_last_verified_at', value: new Date().toISOString() });
                }
            });
            tx();

            return {
                success: true,
                message: gatewayRes.data.message || 'تم تفعيل وتجديد الاشتراك بنجاح',
                expiresAt: newExpiresAt,
                remainingDays: 30,
                status: newStatus,
                renewCount: nextCycle
            };
        } else {
            return {
                success: false,
                error: gatewayRes.data.message || 'كود التفعيل غير صحيح أو غير متطابق مع هذا الجهاز.'
            };
        }
    }

    const expectedDynamicCode = generateActivationCode(`${machineId}-${nextCycle}`).toUpperCase();
    const expectedRawCode = generateActivationCode(machineId).toUpperCase();

    if (cleanCode !== expectedDynamicCode && cleanCode !== expectedRawCode) {
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
