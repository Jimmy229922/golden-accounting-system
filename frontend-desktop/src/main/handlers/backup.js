const { ipcMain, dialog, app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');
const { db } = require('../db');

const BACKUP_FOLDER_NAME = 'PIC';
const MANUAL_BACKUP_FILE_PREFIX = 'accounting-manual-backup';
const CLOUD_BACKUP_FILE_PREFIX = 'accounting-cloud-backup';
const LOCAL_BACKUP_FILE_TAG = 'local';
const CLOUD_BACKUP_FILE_TAG = 'cloud';
const DEFAULT_SUPABASE_BUCKET = 'client-backups';
const DEFAULT_CLOUD_PREFIX = 'clients';
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const PORTABLE_ROOT_FOLDER = 'APP_JS';
const PORTABLE_MARKER_FILE = 'app_root_path.txt';

function getProgramRootPath() {
    const configuredRoot = (process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (configuredRoot) {
        return path.normalize(configuredRoot);
    }

    if (app.isPackaged) {
        try {
            const markerPath = path.join(path.dirname(process.execPath), PORTABLE_MARKER_FILE);
            if (fs.existsSync(markerPath)) {
                const raw = fs.readFileSync(markerPath, 'utf8').trim();
                if (raw) {
                    return path.normalize(raw);
                }
            }
        } catch (_) {
        }

        const driveRoot = path.parse(process.execPath).root;
        return path.join(driveRoot, PORTABLE_ROOT_FOLDER);
    }

    return path.resolve(__dirname, '../../../..', PORTABLE_ROOT_FOLDER);
}

function getBackupDeviceIdentity() {
    try {
        const { loadOrCreateDeviceIdentity } = require('../sync/secureKeyStore');
        const storageDir = path.join(getProgramRootPath(), 'DATA');
        return loadOrCreateDeviceIdentity(storageDir, safeStorage);
    } catch (_) {
        return null;
    }
}

function getBackupCompanyId() {
    let companyId = process.env.COMPANY_ID;
    if (!companyId) {
        try {
            const row = db.prepare("SELECT value FROM settings WHERE key = 'company_id'").get();
            if (row && row.value) companyId = String(row.value).trim();
        } catch (_) {}
    }
    return companyId || '715526d2-f05a-458f-8cf7-179ee172a7a1';
}

function getSharedBackupRootPath() {
    const backupRootPath = path.join(getProgramRootPath(), BACKUP_FOLDER_NAME);
    fs.mkdirSync(backupRootPath, { recursive: true });
    return backupRootPath;
}

function normalizeSupabaseBaseUrl(rawValue) {
    let value = String(rawValue || '').trim();
    if (!value) {
        return '';
    }

    value = value.replace(/\/+$/, '');
    value = value.replace(/\/rest\/v1$/i, '');
    return value;
}

function safePathSegment(value, fallbackValue) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallbackValue;
}

function normalizeCloudPrefix(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return DEFAULT_CLOUD_PREFIX;
    }

    const segments = raw
        .split('/')
        .map((segment) => safePathSegment(segment, ''))
        .filter(Boolean);

    return segments.length ? segments.join('/') : DEFAULT_CLOUD_PREFIX;
}

function encodeStoragePath(pathValue) {
    return String(pathValue || '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function formatTimestampForFileName(dateValue) {
    const year = String(dateValue.getFullYear());
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    const hours = String(dateValue.getHours()).padStart(2, '0');
    const minutes = String(dateValue.getMinutes()).padStart(2, '0');
    const seconds = String(dateValue.getSeconds()).padStart(2, '0');
    const milliseconds = String(dateValue.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}`;
}

function buildBackupFileName(prefix, tag, dateValue = new Date()) {
    return `${prefix}-${formatTimestampForFileName(dateValue)}-${tag}.db`;
}

function normalizeCredentialValue(rawValue) {
    const value = String(rawValue || '')
        .trim()
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim();

    if (!value) {
        return '';
    }

    if (value.includes('[') || value.includes(']')) {
        return '';
    }

    return value;
}

function readSupabaseCredentialsFromMarkdown(rawText) {
    const content = String(rawText || '');
    const extractFirst = (patterns) => {
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const normalized = normalizeCredentialValue(match[1]);
                if (normalized) {
                    return normalized;
                }
            }
        }

        return '';
    };

    return {
        projectUrl: extractFirst([
            /^\s*SUPABASE_URL\s*[:=]\s*(.+)\s*$/im,
            /^\s*SUPABASE_PROJECT_URL\s*[:=]\s*(.+)\s*$/im,
            /^\s*[-*]?\s*Project URL\s*:\s*(.+)\s*$/im
        ]),
        serviceKey: extractFirst([
            /^\s*SUPABASE_SECRET_KEY\s*[:=]\s*(.+)\s*$/im,
            /^\s*SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*(.+)\s*$/im,
            /^\s*[-*]?\s*Secret key\s*:\s*(.+)\s*$/im,
            /^\s*[-*]?\s*Legacy service_role key\s*:\s*(.+)\s*$/im
        ]),
        bucketName: extractFirst([
            /^\s*SUPABASE_BACKUP_BUCKET\s*[:=]\s*(.+)\s*$/im,
            /^\s*[-*]?\s*Bucket\s*:\s*(.+)\s*$/im
        ]),
        cloudPrefix: extractFirst([
            /^\s*SUPABASE_BACKUP_PREFIX\s*[:=]\s*(.+)\s*$/im,
            /^\s*[-*]?\s*Prefix\s*:\s*(.+)\s*$/im
        ]),
        maxUploadBytes: extractFirst([
            /^\s*SUPABASE_MAX_UPLOAD_BYTES\s*[:=]\s*(.+)\s*$/im,
            /^\s*[-*]?\s*Max Upload Bytes\s*:\s*(.+)\s*$/im
        ])
    };
}

function getProgramRootPathForCredentials() {
    const configuredRoot = (process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (configuredRoot) {
        return path.normalize(configuredRoot);
    }

    if (app.isPackaged) {
        try {
            const markerPath = path.join(path.dirname(process.execPath), PORTABLE_MARKER_FILE);
            if (fs.existsSync(markerPath)) {
                const raw = fs.readFileSync(markerPath, 'utf8').trim();
                if (raw) {
                    return path.normalize(raw);
                }
            }
        } catch (_) {
        }

        const driveRoot = path.parse(process.execPath).root;
        return path.join(driveRoot, PORTABLE_ROOT_FOLDER);
    }

    return path.resolve(__dirname, '../../../..', PORTABLE_ROOT_FOLDER);
}

function loadSupabaseLocalCredentials() {
    const fallback = {
        projectUrl: '',
        serviceKey: '',
        bucketName: '',
        cloudPrefix: '',
        maxUploadBytes: ''
    };
    const candidatePaths = [
        path.join(getProgramRootPathForCredentials(), 'SUPABASE_LOCAL_CREDENTIALS.md'),
        path.join(app.getPath('userData'), 'SUPABASE_LOCAL_CREDENTIALS.md'),
        path.join(path.resolve(__dirname, '../../..'), 'SUPABASE_LOCAL_CREDENTIALS.md'),
        path.join(path.resolve(__dirname, '../../../..'), 'SUPABASE_LOCAL_CREDENTIALS.md'),
        path.join(path.dirname(process.execPath), 'SUPABASE_LOCAL_CREDENTIALS.md'),
        process.resourcesPath ? path.join(process.resourcesPath, 'SUPABASE_LOCAL_CREDENTIALS.md') : '',
        path.join(process.cwd(), 'SUPABASE_LOCAL_CREDENTIALS.md')
    ].filter(Boolean);
    for (const candidatePath of candidatePaths) {
        try {
            if (!fs.existsSync(candidatePath)) {
                continue;
            }

            const raw = fs.readFileSync(candidatePath, 'utf8');
            const parsed = readSupabaseCredentialsFromMarkdown(raw);
            if (parsed.projectUrl || parsed.serviceKey || parsed.bucketName || parsed.cloudPrefix || parsed.maxUploadBytes) {
                return parsed;
            }
        } catch (_) {
        }
    }

    return fallback;
}

function getSupabaseConfig() {
    const localCredentials = loadSupabaseLocalCredentials();
    let resolvedUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || localCredentials.projectUrl || '';
    if (!resolvedUrl || resolvedUrl.includes('gwmfnlwdsxvtbncfeexu')) {
        resolvedUrl = 'https://ryoqhtsdhfbydmejmaby.supabase.co';
    }
    const projectUrl = normalizeSupabaseBaseUrl(resolvedUrl);

    let resolvedKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || localCredentials.serviceKey || '';
    if (!resolvedKey || resolvedKey.startsWith('sb_secret_Fz39rt')) {
        resolvedKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4';
    }
    const serviceKey = String(resolvedKey).trim();

    const bucketName = String(
        process.env.SUPABASE_BACKUP_BUCKET
        || localCredentials.bucketName
        || DEFAULT_SUPABASE_BUCKET
    ).trim();

    const cloudPrefix = normalizeCloudPrefix(
        process.env.SUPABASE_BACKUP_PREFIX
        || localCredentials.cloudPrefix
        || DEFAULT_CLOUD_PREFIX
    );

    const maxUploadBytesRaw = Number(
        process.env.SUPABASE_MAX_UPLOAD_BYTES
        || localCredentials.maxUploadBytes
        || DEFAULT_MAX_UPLOAD_BYTES
    );
    const maxUploadBytes = Number.isFinite(maxUploadBytesRaw) && maxUploadBytesRaw > 0
        ? maxUploadBytesRaw
        : DEFAULT_MAX_UPLOAD_BYTES;

    const enabled = Boolean(projectUrl && serviceKey && bucketName);

    return {
        enabled,
        projectUrl,
        serviceKey,
        bucketName,
        cloudPrefix,
        maxUploadBytes,
        storageBaseUrl: projectUrl ? `${projectUrl}/storage/v1` : ''
    };
}

function getCustomerCodeSegment(preferredValue) {
    const direct = safePathSegment(preferredValue, '');
    if (direct) {
        return direct;
    }

    try {
        const companyIdRow = db.prepare("SELECT value FROM settings WHERE key = 'company_id'").get();
        if (companyIdRow && companyIdRow.value && String(companyIdRow.value).trim()) {
            return safePathSegment(String(companyIdRow.value).trim(), '');
        }

        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('companyName');
        const fromSettings = safePathSegment(row && row.value ? row.value : '', '');
        if (fromSettings) {
            return fromSettings;
        }
    } catch (error) {
    }

    return 'default-client';
}

function buildCloudObjectPath({ customerCode, prefix, fileName, cloudPrefix }) {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rootPrefix = normalizeCloudPrefix(prefix || cloudPrefix || DEFAULT_CLOUD_PREFIX);
    const clientSegment = getCustomerCodeSegment(customerCode);

    return `${rootPrefix}/${clientSegment}/${yyyy}/${mm}/${dd}/${fileName}`;
}

async function uploadFileToSupabase(localFilePath, options = {}) {
    const config = getSupabaseConfig();

    if (!config.enabled) {
        return { success: false, disabled: true, error: 'Supabase cloud backup is not configured.' };
    }

    if (typeof fetch !== 'function') {
        return { success: false, error: 'Global fetch is not available in this runtime.' };
    }

    try {
        const stat = fs.statSync(localFilePath);
        if (stat.size > config.maxUploadBytes) {
            return {
                success: false,
                error: `Backup file size exceeds limit (${Math.round(config.maxUploadBytes / (1024 * 1024))} MB).`
            };
        }

        const fileName = options.fileName || path.basename(localFilePath) || `${CLOUD_BACKUP_FILE_PREFIX}-${formatTimestampForFileName(new Date())}.db`;
        const objectPath = options.objectPath || buildCloudObjectPath({
            customerCode: options.customerCode,
            prefix: options.prefix,
            fileName,
            cloudPrefix: config.cloudPrefix
        });

        let fileBuffer = null;
        try {
            const { signPayload } = require('../sync/secureKeyStore');
            const identity = getBackupDeviceIdentity();
            if (identity && identity.privateKeyBase64) {
                const companyId = getBackupCompanyId();
                const gwPayload = JSON.stringify({ action: 'get_upload_url', file_name: fileName });
                const signed = signPayload(identity.privateKeyBase64, companyId, gwPayload);
                const gwUrl = `${config.projectUrl}/functions/v1/backup-gateway`;
                const gwRes = await fetch(gwUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Device-Id': identity.deviceId,
                        'X-Timestamp': signed.timestamp,
                        'X-Nonce': signed.nonce,
                        'X-Signature': signed.signatureBase64
                    },
                    body: gwPayload,
                    signal: AbortSignal.timeout(10000)
                });
                if (gwRes.ok) {
                    const gwData = await gwRes.json();
                    if (gwData && gwData.signed_url) {
                        fileBuffer = fs.readFileSync(localFilePath);
                        const fullUploadUrl = gwData.signed_url.startsWith('http')
                            ? gwData.signed_url
                            : `${config.projectUrl}/storage/v1${gwData.signed_url}`;
                        const signedUploadRes = await fetch(fullUploadUrl, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/octet-stream'
                            },
                            body: fileBuffer
                        });
                        if (signedUploadRes.ok) {
                            return {
                                success: true,
                                bucketName: gwData.bucket || config.bucketName,
                                objectPath: gwData.path,
                                size: stat.size,
                                uploadedAt: new Date().toISOString()
                            };
                        }
                    }
                }
            }
        } catch (_) {}

        if (!fileBuffer) {
            fileBuffer = fs.readFileSync(localFilePath);
        }

        const uploadUrl = `${config.storageBaseUrl}/object/${encodeURIComponent(config.bucketName)}/${encodeStoragePath(objectPath)}`;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.serviceKey}`,
                apikey: config.serviceKey,
                'x-upsert': 'true',
                'Content-Type': 'application/octet-stream'
            },
            body: fileBuffer
        });

        const rawBody = await response.text();
        if (!response.ok) {
            return {
                success: false,
                error: `Supabase upload failed (${response.status}): ${rawBody || response.statusText}`
            };
        }

        let payload = null;
        try {
            payload = rawBody ? JSON.parse(rawBody) : null;
        } catch (_) {
            payload = null;
        }

        return {
            success: true,
            bucketName: config.bucketName,
            objectPath,
            size: stat.size,
            uploadedAt: new Date().toISOString(),
            payload
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function listCloudBackups(options = {}) {
    const config = getSupabaseConfig();

    if (!config.enabled) {
        return { success: false, error: 'Supabase cloud backup is not configured.' };
    }

    if (typeof fetch !== 'function') {
        return { success: false, error: 'Global fetch is not available in this runtime.' };
    }

    try {
        const limitRaw = Number(options.limit || 25);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;
        const customerCode = getCustomerCodeSegment(options.customerCode);
        const prefix = normalizeCloudPrefix(options.prefix || `${config.cloudPrefix}/${customerCode}`);

        const listUrl = `${config.storageBaseUrl}/object/list/${encodeURIComponent(config.bucketName)}`;
        const fetchFilesForPrefix = async (searchPrefix) => {
            try {
                const response = await fetch(listUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${config.serviceKey}`,
                        apikey: config.serviceKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prefix: searchPrefix,
                        limit,
                        offset: 0,
                        sortBy: {
                            column: 'created_at',
                            order: 'desc'
                        }
                    })
                });

                if (!response.ok) return null;
                const rawBody = await response.text();
                return rawBody ? JSON.parse(rawBody) : [];
            } catch (_) {
                return null;
            }
        };

        let activePrefix = prefix;
        let payload = await fetchFilesForPrefix(prefix);
        if ((!payload || payload.length === 0) && !options.prefix) {
            let legacyName = '';
            try {
                const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('companyName');
                legacyName = safePathSegment(row && row.value ? row.value : '', '');
            } catch (_) {}
            const legacyPrefix = normalizeCloudPrefix(`${config.cloudPrefix}/${legacyName || 'default-client'}`);
            if (legacyPrefix !== prefix) {
                const legacyPayload = await fetchFilesForPrefix(legacyPrefix);
                if (legacyPayload && legacyPayload.length > 0) {
                    payload = legacyPayload;
                    activePrefix = legacyPrefix;
                }
            }
        }

        if (payload === null) {
            payload = [];
        }

        const files = Array.isArray(payload)
            ? payload.map((item) => {
                const fileName = String(item && item.name ? item.name : '');
                const objectPath = activePrefix ? `${activePrefix}/${fileName}` : fileName;
                const metadataSize = item && item.metadata && Number.isFinite(Number(item.metadata.size))
                    ? Number(item.metadata.size)
                    : null;
                return {
                    name: fileName,
                    id: item && item.id ? item.id : null,
                    bucketId: item && item.bucket_id ? item.bucket_id : null,
                    objectPath,
                    size: metadataSize,
                    createdAt: item && item.created_at ? item.created_at : null,
                    updatedAt: item && item.updated_at ? item.updated_at : null,
                    lastAccessedAt: item && item.last_accessed_at ? item.last_accessed_at : null
                };
            })
            : [];

        return {
            success: true,
            bucketName: config.bucketName,
            prefix,
            files
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function downloadCloudBackupToTempFile(objectPath) {
    const config = getSupabaseConfig();

    if (!config.enabled) {
        return { success: false, error: 'Supabase cloud backup is not configured.' };
    }

    if (typeof fetch !== 'function') {
        return { success: false, error: 'Global fetch is not available in this runtime.' };
    }

    const cleanObjectPath = String(objectPath || '').trim().replace(/^\/+/, '');
    if (!cleanObjectPath) {
        return { success: false, error: 'Cloud backup object path is required.' };
    }

    try {
        let downloadUrl = `${config.storageBaseUrl}/object/${encodeURIComponent(config.bucketName)}/${encodeStoragePath(cleanObjectPath)}`;
        let authHeaders = {
            Authorization: `Bearer ${config.serviceKey}`,
            apikey: config.serviceKey
        };

        try {
            const { signPayload } = require('../sync/secureKeyStore');
            const identity = getBackupDeviceIdentity();
            if (identity && identity.privateKeyBase64 && cleanObjectPath.startsWith('clients/')) {
                const companyId = getBackupCompanyId();
                const gwPayload = JSON.stringify({ action: 'get_download_url', path: cleanObjectPath });
                const signed = signPayload(identity.privateKeyBase64, companyId, gwPayload);
                const gwUrl = `${config.projectUrl}/functions/v1/backup-gateway`;
                const gwRes = await fetch(gwUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Device-Id': identity.deviceId,
                        'X-Timestamp': signed.timestamp,
                        'X-Nonce': signed.nonce,
                        'X-Signature': signed.signatureBase64
                    },
                    body: gwPayload,
                    signal: AbortSignal.timeout(10000)
                });
                if (gwRes.ok) {
                    const gwData = await gwRes.json();
                    if (gwData && gwData.signed_url) {
                        downloadUrl = gwData.signed_url.startsWith('http')
                            ? gwData.signed_url
                            : `${config.projectUrl}/storage/v1${gwData.signed_url}`;
                        authHeaders = {};
                    }
                }
            }
        } catch (_) {}

        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: authHeaders
        });

        if (!response.ok) {
            const rawBody = await response.text();
            return {
                success: false,
                error: `Supabase download failed (${response.status}): ${rawBody || response.statusText}`
            };
        }

        const arrayBuffer = await response.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        if (fileBuffer.length === 0) {
            return { success: false, error: 'Downloaded cloud backup is empty.' };
        }

        const tempFilePath = path.join(app.getPath('userData'), `${CLOUD_BACKUP_FILE_PREFIX}-restore-${Date.now()}.db`);
        fs.writeFileSync(tempFilePath, fileBuffer);

        return {
            success: true,
            objectPath: cleanObjectPath,
            tempFilePath,
            size: fileBuffer.length
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function cleanupFileSilently(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (_) {
    }
}

function saveBackupStatusSettings(entries = {}) {
    try {
        const rows = Object.entries(entries).filter(([key]) => String(key || '').trim() !== '');
        if (!rows.length) {
            return;
        }

        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const transaction = db.transaction((items) => {
            items.forEach(([key, value]) => {
                stmt.run(String(key), value == null ? '' : String(value));
            });
        });
        transaction(rows);
    } catch (_) {
    }
}

function readBackupStatusSettings() {
    try {
        const keys = [
            'last_manual_backup_path',
            'last_manual_backup_at',
            'last_cloud_backup_status',
            'last_cloud_backup_at',
            'last_cloud_backup_error'
        ];
        const placeholders = keys.map(() => '?').join(', ');
        const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).all(...keys);
        const values = {};
        rows.forEach((row) => {
            values[row.key] = row.value;
        });
        return values;
    } catch (_) {
        return {};
    }
}

function verifyRestoreSourceIntegrity(sourcePath) {
    const restoreSourcePath = String(sourcePath || '').trim();
    if (!restoreSourcePath) {
        return { valid: false, error: 'Backup file path is required.' };
    }

    if (!fs.existsSync(restoreSourcePath)) {
        return { valid: false, error: 'Backup file does not exist.' };
    }

    let probeDb = null;
    try {
        probeDb = new BetterSqlite3(restoreSourcePath, { readonly: true, fileMustExist: true });
        const result = probeDb.pragma('integrity_check');
        const status = result && result[0] ? result[0].integrity_check : 'unknown';

        if (status !== 'ok') {
            return { valid: false, error: `Backup integrity check failed: ${status}` };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, error: `Backup file validation failed: ${error.message}` };
    } finally {
        try {
            if (probeDb) {
                probeDb.close();
            }
        } catch (_) {
        }
    }
}

async function restoreDatabaseFromPath(sourcePath, dbFilePath) {
    let safetyPath = null;
    let dbWasClosed = false;

    const integrityResult = verifyRestoreSourceIntegrity(sourcePath);
    if (!integrityResult.valid) {
        return {
            success: false,
            error: integrityResult.error,
            safetyBackup: null,
            needsRestart: false
        };
    }

    try {
        safetyPath = path.join(app.getPath('userData'), `pre-restore-${Date.now()}.db`);

        // Create a safety backup before replacing the live database
        await db.backup(safetyPath);

        // Replace the live database with the selected backup
        db.close();
        dbWasClosed = true;
        fs.copyFileSync(sourcePath, dbFilePath);

        return { success: true, safetyBackup: safetyPath, needsRestart: true };
    } catch (error) {
        if (dbWasClosed && safetyPath) {
            try {
                fs.copyFileSync(safetyPath, dbFilePath);
            } catch (restoreError) {
                console.error('[restore-database] rollback failed:', restoreError);
            }
        }

        return {
            success: false,
            error: error.message,
            safetyBackup: safetyPath,
            needsRestart: dbWasClosed
        };
    }
}

function register() {
    const dbFilePath = db.name || path.join(app.getPath('userData'), 'accounting.db');

    // --- Backup & Restore Handlers ---

    ipcMain.handle('backup-database', async (event, payload = {}) => {
        try {
            const defaultDir = getSharedBackupRootPath();
            const defaultFileName = buildBackupFileName(MANUAL_BACKUP_FILE_PREFIX, LOCAL_BACKUP_FILE_TAG);
            const defaultPath = path.join(defaultDir, defaultFileName);

            const { canceled, filePath: chosenPath } = await dialog.showSaveDialog({
                title: 'حفظ نسخة احتياطية',
                defaultPath: defaultPath,
                filters: [{ name: 'SQLite Database', extensions: ['db'] }]
            });

            if (canceled || !chosenPath) {
                return { success: false, canceled: true };
            }

            const targetDir = path.dirname(chosenPath);
            fs.mkdirSync(targetDir, { recursive: true });

            await db.backup(chosenPath);
            const cloudResult = await uploadFileToSupabase(chosenPath, {
                customerCode: payload.customerCode,
                prefix: payload.prefix,
                fileName: buildBackupFileName(CLOUD_BACKUP_FILE_PREFIX, CLOUD_BACKUP_FILE_TAG)
            });
            const backupTimestamp = new Date().toISOString();
            saveBackupStatusSettings({
                last_manual_backup_path: chosenPath,
                last_manual_backup_at: backupTimestamp,
                last_cloud_backup_status: cloudResult && cloudResult.success
                    ? 'success'
                    : (cloudResult && cloudResult.disabled ? 'disabled' : 'error'),
                last_cloud_backup_at: cloudResult && cloudResult.success ? backupTimestamp : '',
                last_cloud_backup_error: cloudResult && cloudResult.success ? '' : (cloudResult && cloudResult.error ? cloudResult.error : '')
            });

            if (payload.requireCloud && !cloudResult.success) {
                return { success: false, error: cloudResult.error, path: chosenPath, cloud: cloudResult };
            }

            return { success: true, path: chosenPath, cloud: cloudResult };
        } catch (error) {
            console.error('[backup-database] error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('backup-database-to-cloud', async (event, payload = {}) => {
        let tempFilePath = null;

        try {
            tempFilePath = path.join(app.getPath('userData'), `${CLOUD_BACKUP_FILE_PREFIX}-${Date.now()}.db`);
            await db.backup(tempFilePath);

            const fileName = buildBackupFileName(CLOUD_BACKUP_FILE_PREFIX, CLOUD_BACKUP_FILE_TAG);
            const cloudResult = await uploadFileToSupabase(tempFilePath, {
                customerCode: payload.customerCode,
                prefix: payload.prefix,
                fileName
            });

            if (!cloudResult.success) {
                saveBackupStatusSettings({
                    last_cloud_backup_status: cloudResult.disabled ? 'disabled' : 'error',
                    last_cloud_backup_at: '',
                    last_cloud_backup_error: cloudResult.error || ''
                });
                return { success: false, error: cloudResult.error, cloud: cloudResult };
            }

            saveBackupStatusSettings({
                last_cloud_backup_status: 'success',
                last_cloud_backup_at: new Date().toISOString(),
                last_cloud_backup_error: ''
            });

            return { success: true, cloud: cloudResult };
        } catch (error) {
            saveBackupStatusSettings({
                last_cloud_backup_status: 'error',
                last_cloud_backup_at: '',
                last_cloud_backup_error: error.message || ''
            });
            return { success: false, error: error.message };
        } finally {
            cleanupFileSilently(tempFilePath);
        }
    });

    ipcMain.handle('get-backup-status-summary', async () => {
        const config = getSupabaseConfig();
        const savedStatus = readBackupStatusSettings();

        return {
            success: true,
            databasePath: dbFilePath,
            backupRootPath: getSharedBackupRootPath(),
            cloudConfigured: Boolean(config.enabled),
            cloudBucketName: config.bucketName || '',
            cloudPrefix: config.cloudPrefix || '',
            lastManualBackupPath: savedStatus.last_manual_backup_path || '',
            lastManualBackupAt: savedStatus.last_manual_backup_at || '',
            lastCloudBackupStatus: savedStatus.last_cloud_backup_status || 'never',
            lastCloudBackupAt: savedStatus.last_cloud_backup_at || '',
            lastCloudBackupError: savedStatus.last_cloud_backup_error || ''
        };
    });

    ipcMain.handle('list-cloud-backups', async (event, payload = {}) => {
        return listCloudBackups(payload);
    });

    ipcMain.handle('restore-database-from-cloud', async (event, payload = {}) => {
        const objectPath = String(payload.objectPath || '').trim();
        if (!objectPath) {
            return { success: false, error: 'Cloud backup object path is required.' };
        }

        const downloadResult = await downloadCloudBackupToTempFile(objectPath);
        if (!downloadResult.success) {
            return downloadResult;
        }

        const restoreResult = await restoreDatabaseFromPath(downloadResult.tempFilePath, dbFilePath);
        cleanupFileSilently(downloadResult.tempFilePath);

        if (!restoreResult.success) {
            return restoreResult;
        }

        return {
            success: true,
            restoredFrom: downloadResult.objectPath,
            safetyBackup: restoreResult.safetyBackup,
            needsRestart: true
        };
    });

    ipcMain.handle('restore-database', async () => {
        try {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'Restore backup',
                filters: [{ name: 'SQLite Database', extensions: ['db'] }],
                properties: ['openFile']
            });

            if (canceled || !filePaths || filePaths.length === 0) {
                return { success: false, canceled: true };
            }

            const sourcePath = filePaths[0];
            const restoreResult = await restoreDatabaseFromPath(sourcePath, dbFilePath);
            if (!restoreResult.success) {
                return restoreResult;
            }

            return {
                success: true,
                restoredFrom: sourcePath,
                safetyBackup: restoreResult.safetyBackup,
                needsRestart: true
            };
        } catch (error) {
            console.error('[restore-database] error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('restart-app', () => {
        try {
            app.relaunch();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('[restart-app] Error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
