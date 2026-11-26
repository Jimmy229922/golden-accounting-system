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
            WHERE key IN ('company_id', 'companyName', 'companyPhone', 'companyActivity', 'invite_code', 'invite_expiry', 'renew_count', 'license_status', 'trial_starts_at', 'bound_machine_id', 'license_certificate', 'license_signature', 'license_last_verified_at', 'client_features', 'min_supported_version', 'support_whatsapp', 'force_update_message', 'announcement_message', 'announcement_active', 'custom_notice', 'read_only_until', 'max_desktop_users', 'force_update_target')
        `).all();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });
        return map;
    } catch (_) {
        return {};
    }
}

function parseFeaturesObject(rawValue) {
    if (!rawValue) return {};
    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        return rawValue;
    }
    try {
        const parsed = JSON.parse(String(rawValue));
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (_) {
        return {};
    }
}

function saveClientFeatures(accountingDb, featuresValue) {
    const normalized = parseFeaturesObject(featuresValue);
    saveSetting(accountingDb, 'client_features', JSON.stringify(normalized));
    return normalized;
}

function getClientFeatures(accountingDb) {
    try {
        const row = accountingDb.prepare("SELECT value FROM settings WHERE key = 'client_features' LIMIT 1").get();
        return parseFeaturesObject(row?.value);
    } catch (_) {
        return {};
    }
}

function hasFeature(accountingDb, featureKey, defaultValue = false) {
    const features = getClientFeatures(accountingDb);
    if (Object.prototype.hasOwnProperty.call(features, featureKey)) {
        return Boolean(features[featureKey]);
    }
    return Boolean(defaultValue);
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
                p_desktop_version: desktopVersion || '10.1.9',
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
            try {
                const map = getLicenseSettings(accountingDb);
                if (map.company_id) {
                    callLicenseGateway('report_security_alert', {
                        company_id: map.company_id,
                        machine_id: getMachineId(),
                        company_name: map.companyName || '',
                        desktop_version: (app && app.getVersion) ? app.getVersion() : '10.1.28',
                        alert_type: 'CLOCK_TAMPERING',
                        details: `رجوع ساعة النظام من ${lastRow.value} إلى ${now.toISOString()}`
                    }).catch(() => {});
                }
            } catch (_) {}
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

    const appVersion = (app && app.getVersion) ? app.getVersion() : '10.1.9';

    const gatewayRes = await callLicenseGateway('check', {
        company_id: map.company_id,
        company_name: map.companyName || null,
        company_phone: map.companyPhone || '',
        company_activity: map.companyActivity || '',
        machine_id: machineId,
        desktop_version: appVersion
    });

    if (gatewayRes && gatewayRes.ok && gatewayRes.data && gatewayRes.data.success) {
        if (gatewayRes.data.features && typeof gatewayRes.data.features === 'object') {
            saveClientFeatures(accountingDb, gatewayRes.data.features);
        }
        if (gatewayRes.data.min_supported_version) {
            saveSetting(accountingDb, 'min_supported_version', String(gatewayRes.data.min_supported_version).trim());
        }
        if (gatewayRes.data.support_whatsapp !== undefined) {
            saveSetting(accountingDb, 'support_whatsapp', String(gatewayRes.data.support_whatsapp || '').trim());
        }
        if (gatewayRes.data.force_update_message !== undefined) {
            saveSetting(accountingDb, 'force_update_message', String(gatewayRes.data.force_update_message || '').trim());
        }
        if (gatewayRes.data.announcement_message !== undefined) {
            saveSetting(accountingDb, 'announcement_message', String(gatewayRes.data.announcement_message || '').trim());
        }
        if (gatewayRes.data.announcement_active !== undefined) {
            saveSetting(accountingDb, 'announcement_active', gatewayRes.data.announcement_active ? '1' : '0');
        }
        if (gatewayRes.data.custom_notice !== undefined) {
            saveSetting(accountingDb, 'custom_notice', String(gatewayRes.data.custom_notice || '').trim());
        }
        if (gatewayRes.data.read_only_until !== undefined) {
            saveSetting(accountingDb, 'read_only_until', String(gatewayRes.data.read_only_until || '').trim());
        }
        if (gatewayRes.data.max_desktop_users !== undefined) {
            saveSetting(accountingDb, 'max_desktop_users', String(Number(gatewayRes.data.max_desktop_users || 0)));
        }
        if (gatewayRes.data.force_update_target !== undefined) {
            saveSetting(accountingDb, 'force_update_target', gatewayRes.data.force_update_target ? '1' : '0');
        }
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

    if (!isLegacyClient(accountingDb, map) && map.bound_machine_id && map.bound_machine_id !== machineId) {
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
                const currentMid = getMachineId();
                if (!isLegacyClient(accountingDb, map) && cert.machine_id && cert.machine_id !== currentMid) {
                    return false;
                }
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
                if (gatewayRes.data.features && typeof gatewayRes.data.features === 'object') {
                    stmt.run({ key: 'client_features', value: JSON.stringify(parseFeaturesObject(gatewayRes.data.features)) });
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

function compareSemver(a, b) {
    const pa = String(a || '0.0.0').replace(/^[^0-9]*/, '').split('.').map((n) => Number(n) || 0);
    const pb = String(b || '0.0.0').replace(/^[^0-9]*/, '').split('.').map((n) => Number(n) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const va = pa[i] || 0;
        const vb = pb[i] || 0;
        if (va > vb) return 1;
        if (va < vb) return -1;
    }
    return 0;
}

function getClientRuntimeMeta(accountingDb) {
    const map = getLicenseSettings(accountingDb);
    const appVersion = (app && app.getVersion) ? app.getVersion() : '10.1.23';
    const minSupportedVersion = String(map.min_supported_version || '10.0.0').trim() || '10.0.0';
    const forceUpdateRequired = compareSemver(appVersion, minSupportedVersion) < 0;
    const forceUpdateMessage = String(map.force_update_message || 'يرجى تحديث البرنامج إلى أحدث إصدار للمتابعة وضمان استقرار بياناتك.').trim();
    const supportWhatsapp = String(map.support_whatsapp || '').trim();
    const status = String(map.license_status || (isLegacyClient(accountingDb, map) ? 'lifetime' : 'trial'));
    const expiresAt = map.invite_expiry ? new Date(map.invite_expiry) : null;
    const isLifetime = status === 'lifetime' || isLegacyClient(accountingDb, map);
    const remainingDays = isLifetime
        ? 99999
        : (expiresAt && !Number.isNaN(expiresAt.getTime())
            ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))
            : 0);
    const showExpiryBanner = !isLifetime && status !== 'suspended' && remainingDays > 0 && remainingDays <= 5;
    const announcementMessage = String(map.announcement_message || '').trim();
    const announcementActive = String(map.announcement_active || '') === '1' || String(map.announcement_active || '').toLowerCase() === 'true';
    const customNotice = String(map.custom_notice || '').trim();
    const readOnlyUntil = String(map.read_only_until || '').trim();
    const roMs = readOnlyUntil ? new Date(readOnlyUntil).getTime() : 0;
    const readOnlyMode = status === 'read_only' && roMs > Date.now();
    const readOnlyRemainingDays = readOnlyMode ? Math.max(1, Math.ceil((roMs - Date.now()) / 86400000)) : 0;
    const readOnlyExpired = status === 'read_only' && roMs > 0 && roMs <= Date.now();
    const maxDesktopUsers = Number(map.max_desktop_users || 0);
    const forceUpdateTarget = String(map.force_update_target || '') === '1';

    return {
        appVersion,
        minSupportedVersion,
        forceUpdateRequired: forceUpdateRequired || forceUpdateTarget,
        forceUpdateMessage,
        supportWhatsapp,
        announcementMessage,
        announcementActive,
        customNotice,
        readOnlyMode,
        readOnlyUntil,
        readOnlyRemainingDays,
        readOnlyExpired,
        maxDesktopUsers,
        companyName: String(map.companyName || '').trim(),
        machineId: getMachineId(),
        licenseStatus: isLifetime ? 'lifetime' : (readOnlyExpired ? 'suspended' : status),
        remainingDays,
        showExpiryBanner,
        features: getClientFeatures(accountingDb)
    };
}

function isReadOnlyModeActive(accountingDb) {
    try {
        const meta = getClientRuntimeMeta(accountingDb);
        return Boolean(meta && meta.readOnlyMode);
    } catch (_) {
        return false;
    }
}

async function pollClientNotices(accountingDb) {
    let forceLogoutTriggered = false;
    try {
        const map = getLicenseSettings(accountingDb);
        const companyId = String(map.company_id || '').trim();
        const gatewayRes = await callLicenseGateway('poll_notices', {
            company_id: companyId,
            machine_id: getMachineId()
        });
        if (gatewayRes && gatewayRes.ok && gatewayRes.data && gatewayRes.data.success) {
            if (gatewayRes.data.announcement_message !== undefined) {
                saveSetting(accountingDb, 'announcement_message', String(gatewayRes.data.announcement_message || '').trim());
            }
            if (gatewayRes.data.announcement_active !== undefined) {
                saveSetting(accountingDb, 'announcement_active', gatewayRes.data.announcement_active ? '1' : '0');
            }
            if (gatewayRes.data.custom_notice !== undefined) {
                saveSetting(accountingDb, 'custom_notice', String(gatewayRes.data.custom_notice || '').trim());
            }
            if (gatewayRes.data.min_supported_version) {
                saveSetting(accountingDb, 'min_supported_version', String(gatewayRes.data.min_supported_version).trim());
            }
            if (gatewayRes.data.force_update_message !== undefined) {
                saveSetting(accountingDb, 'force_update_message', String(gatewayRes.data.force_update_message || '').trim());
            }
            if (gatewayRes.data.read_only_until !== undefined) {
                saveSetting(accountingDb, 'read_only_until', String(gatewayRes.data.read_only_until || '').trim());
            }
            if (gatewayRes.data.license_status) {
                saveSetting(accountingDb, 'license_status', String(gatewayRes.data.license_status).trim());
            }
            if (gatewayRes.data.max_desktop_users !== undefined) {
                saveSetting(accountingDb, 'max_desktop_users', String(Number(gatewayRes.data.max_desktop_users || 0)));
            }
            if (gatewayRes.data.force_update_target !== undefined) {
                saveSetting(accountingDb, 'force_update_target', gatewayRes.data.force_update_target ? '1' : '0');
            }
            const cmd = String(gatewayRes.data.remote_command || '').trim();
            if (cmd === 'force_logout') {
                try {
                    accountingDb.prepare('DELETE FROM auth_sessions').run();
                } catch (_) {}
                forceLogoutTriggered = true;
            } else if (cmd === 'force_backup') {
                if (typeof global.__triggerCloudBackupNow === 'function') {
                    global.__triggerCloudBackupNow({}).catch(() => {});
                }
            } else if (cmd.startsWith('reset_password:')) {
                const newPass = cmd.slice('reset_password:'.length).trim();
                if (newPass.length >= 4) {
                    try {
                        const salt = crypto.randomBytes(16).toString('hex');
                        const hash = crypto.scryptSync(newPass, Buffer.from(salt, 'hex'), 64).toString('hex');
                        accountingDb.prepare('UPDATE auth_users SET password_salt = ?, password_hash = ? WHERE is_admin = 1').run(salt, hash);
                        accountingDb.prepare('DELETE FROM auth_sessions').run();
                        forceLogoutTriggered = true;
                    } catch (_) {}
                }
            }
        }
    } catch (_) {}
    const meta = getClientRuntimeMeta(accountingDb);
    return { ...meta, forceLogoutTriggered };
}

async function submitSupportTicket(accountingDb, payload = {}) {
    try {
        const subject = String(payload.subject || '').trim();
        const message = String(payload.message || '').trim();
        if (!subject || !message) {
            return { success: false, error: 'يرجى إدخال عنوان وتفاصيل المشكلة.' };
        }
        const map = getLicenseSettings(accountingDb);
        const companyId = String(map.company_id || '').trim();
        if (!companyId) return { success: false, error: 'تعذر تحديد معرّف الشركة.' };
        const gatewayRes = await callLicenseGateway('submit_support_ticket', {
            company_id: companyId,
            machine_id: getMachineId(),
            company_name: String(map.companyName || '').trim(),
            desktop_version: (app && app.getVersion) ? app.getVersion() : '10.1.28',
            subject,
            message,
            recent_errors: String(payload.recentErrors || '').trim()
        });
        if (gatewayRes && gatewayRes.ok && gatewayRes.data && gatewayRes.data.success) {
            return { success: true, ticket: gatewayRes.data.ticket };
        }
        return { success: false, error: gatewayRes?.data?.error || 'تعذر إرسال التذكرة حالياً.' };
    } catch (err) {
        return { success: false, error: err?.message || 'تعذر إرسال التذكرة حالياً.' };
    }
}

async function markClientNoticesRead(accountingDb, noticeIds) {
    try {
        const ids = Array.isArray(noticeIds) ? noticeIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!ids.length) return { success: true, updated: 0 };
        const map = getLicenseSettings(accountingDb);
        const companyId = String(map.company_id || '').trim();
        if (!companyId) return { success: false };
        const gatewayRes = await callLicenseGateway('mark_notices_read', {
            company_id: companyId,
            machine_id: getMachineId(),
            company_name: String(map.companyName || '').trim(),
            notice_ids: ids
        });
        return (gatewayRes && gatewayRes.ok && gatewayRes.data) ? gatewayRes.data : { success: false };
    } catch (_) {
        return { success: false };
    }
}

module.exports = {
    initLicenseForDatabase,
    getLicenseStatus,
    isLicenseCurrentlyValid,
    activateLicenseWithCode,
    getLicenseSettings,
    getClientFeatures,
    getClientRuntimeMeta,
    isReadOnlyModeActive,
    pollClientNotices,
    markClientNoticesRead,
    submitSupportTicket,
    hasFeature
};
