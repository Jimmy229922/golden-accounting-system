const { ipcMain, dialog, app } = require('electron');
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
    const projectUrl = normalizeSupabaseBaseUrl(
        process.env.SUPABASE_URL
        || process.env.SUPABASE_PROJECT_URL
        || localCredentials.projectUrl
        || ''
    );

    const serviceKey = String(
        process.env.SUPABASE_SECRET_KEY
        || process.env.SUPABASE_SERVICE_ROLE_KEY
        || localCredentials.serviceKey
        || ''
    ).trim();

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

        const uploadUrl = `${config.storageBaseUrl}/object/${encodeURIComponent(config.bucketName)}/${encodeStoragePath(objectPath)}`;
        const fileBuffer = fs.readFileSync(localFilePath);

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
        const response = await fetch(listUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.serviceKey}`,
                apikey: config.serviceKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prefix,
                limit,
                offset: 0,
                sortBy: {
                    column: 'created_at',
                    order: 'desc'
                }
            })
        });

        const rawBody = await response.text();
        let payload = [];
        try {
            payload = rawBody ? JSON.parse(rawBody) : [];
        } catch (_) {
            payload = [];
        }

        if (!response.ok) {
            return {
                success: false,
                error: `Supabase list failed (${response.status}): ${rawBody || response.statusText}`
            };
        }

        const files = Array.isArray(payload)
            ? payload.map((item) => {
                const fileName = String(item && item.name ? item.name : '');
                const objectPath = prefix ? `${prefix}/${fileName}` : fileName;
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
        const downloadUrl = `${config.storageBaseUrl}/object/${encodeURIComponent(config.bucketName)}/${encodeStoragePath(cleanObjectPath)}`;
        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${config.serviceKey}`,
                apikey: config.serviceKey
            }
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
                return { success: false, error: cloudResult.error, cloud: cloudResult };
            }

            return { success: true, cloud: cloudResult };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            cleanupFileSilently(tempFilePath);
        }
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
