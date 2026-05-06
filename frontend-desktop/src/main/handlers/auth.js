const { ipcMain } = require('electron');
const crypto = require('crypto');
const { db } = require('../db');
const { INVITE_CODE, INVITE_DURATION_DAYS, getMachineId, generateActivationCode } = require('../inviteConfig');

function normalizeUsername(username) {
    return String(username || '').trim();
}

function validateCredentials(username, password) {
    if (!username) {
        return 'يرجى إدخال اسم المستخدم.';
    }

    if (username.length < 3 || username.length > 32) {
        return 'اسم المستخدم يجب أن يكون بين 3 و 32 حرف.';
    }

    if (!password || password.length < 6) {
        return 'كلمة المرور يجب أن تكون 6 حروف أو أكثر.';
    }

    return null;
}

function getAuthRecord() {
    const rows = db.prepare(`
        SELECT key, value
        FROM settings
        WHERE key IN ('auth_username', 'auth_password_salt', 'auth_password_hash')
    `).all();

    const map = {};
    rows.forEach((row) => {
        map[row.key] = row.value;
    });

    const username = map.auth_username || '';
    const salt = map.auth_password_salt || '';
    const hash = map.auth_password_hash || '';
    const hasAccount = Boolean(username && salt && hash);

    return {
        username,
        salt,
        hash,
        hasAccount
    };
}

function hashPassword(password, saltHex) {
    return crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function safeCompareHash(expectedHex, receivedHex) {
    const expected = Buffer.from(expectedHex, 'hex');
    const received = Buffer.from(receivedHex, 'hex');

    if (expected.length !== received.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, received);
}

// ── Hardcoded Super Admin (never deleted, never deactivated) ──
const SUPER_ADMIN_USERNAME = 'Jimmy';
const SUPER_ADMIN_PASSWORD = 'A7med1221';
const SUPER_ADMIN_ID_SETTING_KEY = 'auth_super_admin_user_id';

let activeAuthUser = null;

function ensureAuthUsersTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            last_login_at TEXT
        )
    `);
}

function getSettingsMap(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
        return {};
    }

    const placeholders = keys.map(() => '?').join(', ');
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).all(...keys);
    const map = {};
    rows.forEach((row) => {
        map[row.key] = row.value;
    });
    return map;
}

function mapAuthUser(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        username: row.username,
        isAdmin: Boolean(Number(row.is_admin)),
        isActive: Boolean(Number(row.is_active)),
        createdAt: row.created_at || null,
        lastLoginAt: row.last_login_at || null
    };
}

function setActiveAuthUser(row) {
    activeAuthUser = mapAuthUser(row);
}

function getActiveAuthUser() {
    return activeAuthUser ? { ...activeAuthUser } : null;
}

function getAuthUsersCount() {
    ensureAuthUsersTable();
    const row = db.prepare('SELECT COUNT(*) AS count FROM auth_users').get();
    return Number(row?.count || 0);
}

function getStoredSuperAdminId() {
    const row = db.prepare('SELECT value FROM settings WHERE key = ? LIMIT 1').get(SUPER_ADMIN_ID_SETTING_KEY);
    const id = Number(row?.value || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
}

function setStoredSuperAdminId(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) {
        return;
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(SUPER_ADMIN_ID_SETTING_KEY, String(id));
}

function ensureSuperAdmin() {
    ensureAuthUsersTable();

    const storedSuperAdminId = getStoredSuperAdminId();
    if (storedSuperAdminId > 0) {
        const storedSuperAdmin = getAuthUserById(storedSuperAdminId);
        if (storedSuperAdmin) {
            if (!Number(storedSuperAdmin.is_admin) || !Number(storedSuperAdmin.is_active)) {
                db.prepare('UPDATE auth_users SET is_admin = 1, is_active = 1 WHERE id = ?').run(storedSuperAdmin.id);
            }
            return;
        }
    }

    const existing = getAuthUserByUsername(SUPER_ADMIN_USERNAME);
    if (existing) {
        // Make sure super admin is always admin + active
        if (!Number(existing.is_admin) || !Number(existing.is_active)) {
            db.prepare('UPDATE auth_users SET is_admin = 1, is_active = 1 WHERE id = ?').run(existing.id);
        }
        setStoredSuperAdminId(existing.id);
        return;
    }

    const existingAdmin = db.prepare(`
        SELECT id, is_active
        FROM auth_users
        WHERE is_admin = 1
        ORDER BY id ASC
        LIMIT 1
    `).get();
    if (existingAdmin) {
        if (!Number(existingAdmin.is_active)) {
            db.prepare('UPDATE auth_users SET is_active = 1 WHERE id = ?').run(existingAdmin.id);
        }
        setStoredSuperAdminId(existingAdmin.id);
        return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(SUPER_ADMIN_PASSWORD, salt);
    const now = new Date().toISOString();
    const info = db.prepare(`
        INSERT INTO auth_users (
            username, password_salt, password_hash,
            is_admin, is_active, created_at, last_login_at
        ) VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(SUPER_ADMIN_USERNAME, salt, passwordHash, now, now);
    setStoredSuperAdminId(Number(info.lastInsertRowid));
}

function isSuperAdmin(userId) {
    const storedSuperAdminId = getStoredSuperAdminId();
    if (storedSuperAdminId > 0) {
        return Number(storedSuperAdminId) === Number(userId);
    }

    const user = getAuthUserById(userId);
    if (!user) return false;
    const username = String(user.username || '').toLowerCase();
    return username === SUPER_ADMIN_USERNAME.toLowerCase();
}

function migrateLegacyAuthRecordIfNeeded() {
    ensureAuthUsersTable();
    ensureSuperAdmin();

    if (getAuthUsersCount() > 0) {
        return;
    }

    const legacy = getAuthRecord();
    if (!legacy.hasAccount) {
        return;
    }

    const now = new Date().toISOString();
    const settingsMap = getSettingsMap(['auth_created_at', 'auth_last_login_at']);
    const createdAt = settingsMap.auth_created_at || now;
    const lastLoginAt = settingsMap.auth_last_login_at || createdAt;

    db.prepare(`
        INSERT INTO auth_users (
            username,
            password_salt,
            password_hash,
            is_admin,
            is_active,
            created_at,
            last_login_at
        )
        VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(
        legacy.username,
        legacy.salt,
        legacy.hash,
        createdAt,
        lastLoginAt
    );
}

function getAuthUserByUsername(username) {
    ensureAuthUsersTable();
    return db.prepare('SELECT * FROM auth_users WHERE lower(username) = lower(?) LIMIT 1').get(username);
}

function getAuthUserById(id) {
    ensureAuthUsersTable();
    return db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id);
}

function listAuthUsers() {
    ensureAuthUsersTable();
    return db.prepare(`
        SELECT id, username, is_admin, is_active, created_at, last_login_at
        FROM auth_users
        ORDER BY is_admin DESC, username ASC
    `).all();
}

function getPrimaryAuthUsername() {
    ensureAuthUsersTable();
    const storedSuperAdminId = getStoredSuperAdminId();
    if (storedSuperAdminId > 0) {
        const superAdminById = db.prepare('SELECT username FROM auth_users WHERE id = ? LIMIT 1').get(storedSuperAdminId);
        if (superAdminById?.username) {
            return superAdminById.username;
        }
    }

    const superAdmin = db.prepare(`
        SELECT username
        FROM auth_users
        WHERE lower(username) = lower(?)
        LIMIT 1
    `).get(SUPER_ADMIN_USERNAME);

    if (superAdmin?.username) {
        return superAdmin.username;
    }

    const preferred = db.prepare(`
        SELECT username
        FROM auth_users
        WHERE is_admin = 1
        ORDER BY id ASC
        LIMIT 1
    `).get();

    if (preferred?.username) {
        return preferred.username;
    }

    const anyUser = db.prepare('SELECT username FROM auth_users ORDER BY id ASC LIMIT 1').get();
    return anyUser?.username || null;
}

function ensureAuthSessionsTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        )
    `);
}

function purgeExpiredAuthSessions() {
    ensureAuthSessionsTable();
    const now = new Date().toISOString();
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now);
}

function createAuthSession(userId) {
    ensureAuthSessionsTable();
    purgeExpiredAuthSessions();

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const expiresIso = expiresAt.toISOString();

    db.prepare(`
        INSERT INTO auth_sessions (token, user_id, created_at, last_seen_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(token, userId, nowIso, nowIso, expiresIso);

    return token;
}

function extractSessionToken(payload) {
    if (typeof payload === 'string') {
        return payload.trim();
    }

    if (payload && typeof payload.sessionToken === 'string') {
        return payload.sessionToken.trim();
    }

    return '';
}

function getSessionUser(sessionToken) {
    if (!sessionToken) {
        return null;
    }

    ensureAuthSessionsTable();
    purgeExpiredAuthSessions();
    const now = new Date().toISOString();

    const row = db.prepare(`
        SELECT u.*
        FROM auth_sessions s
        JOIN auth_users u ON u.id = s.user_id
        WHERE s.token = ?
          AND s.expires_at > ?
        LIMIT 1
    `).get(sessionToken, now);

    if (!row) {
        return null;
    }

    db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE token = ?').run(now, sessionToken);
    return row;
}

function requireAdminSession(sessionToken = '') {
    const tokenUser = mapAuthUser(getSessionUser(sessionToken));
    const session = tokenUser || getActiveAuthUser();
    if (!session) {
        return { ok: false, error: 'يرجى تسجيل الدخول أولاً.' };
    }

    if (!session.isAdmin) {
        return { ok: false, error: 'هذه العملية متاحة لحساب الأدمن فقط.' };
    }

    return { ok: true, session };
}

function persistLegacyAuthSnapshot({ username, salt, hash, createdAt, lastLoginAt }) {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
    stmt.run({ key: 'auth_username', value: username });
    stmt.run({ key: 'auth_password_salt', value: salt });
    stmt.run({ key: 'auth_password_hash', value: hash });
    stmt.run({ key: 'auth_created_at', value: createdAt });
    stmt.run({ key: 'auth_last_login_at', value: lastLoginAt });
}

function checkPermission(page, operation) {
    const user = getActiveAuthUser();
    if (!user) return false;
    if (user.isAdmin) return true;

    const row = db.prepare('SELECT can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = ? AND page = ?').get(user.id, page);
    if (!row) return false;

    const col = 'can_' + operation;
    return Boolean(row[col]);
}

function requirePermission(page, operation) {
    if (!checkPermission(page, operation)) {
        return { success: false, error: 'ليس لديك صلاحية لتنفيذ هذه العملية.' };
    }
    return null;
}

function register() {
    // Auth Handlers
    ipcMain.handle('get-auth-status', () => {
        try {
            migrateLegacyAuthRecordIfNeeded();
            const hasAccount = getAuthUsersCount() > 0;
            return {
                hasAccount,
                requiresSetup: !hasAccount,
                username: hasAccount ? getPrimaryAuthUsername() : null
            };
        } catch (error) {
            console.error('[get-auth-status] Error:', error);
            return { hasAccount: false, requiresSetup: true, username: null };
        }
    });

    ipcMain.handle('setup-auth-account', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        if (getAuthUsersCount() > 0) {
            return { success: false, error: 'يوجد حساب مفعل مسبقاً.' };
        }

        const username = normalizeUsername(payload.username);
        const password = String(payload.password || '');
        const validationError = validateCredentials(username, password);

        if (validationError) {
            return { success: false, error: validationError };
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const now = new Date().toISOString();

        try {
            const tx = db.transaction(() => {
                ensureAuthUsersTable();
                db.prepare(`
                    INSERT INTO auth_users (
                        username,
                        password_salt,
                        password_hash,
                        is_admin,
                        is_active,
                        created_at,
                        last_login_at
                    )
                    VALUES (?, ?, ?, 1, 1, ?, ?)
                `).run(username, salt, passwordHash, now, now);

                persistLegacyAuthSnapshot({
                    username,
                    salt,
                    hash: passwordHash,
                    createdAt: now,
                    lastLoginAt: now
                });
            });
            tx();

            const createdUser = getAuthUserByUsername(username);
            setActiveAuthUser(createdUser);
            const sessionToken = createAuthSession(createdUser.id);
            return { success: true, username, isAdmin: true, sessionToken };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('login-auth-account', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        if (getAuthUsersCount() === 0) {
            return { success: false, error: 'لا يوجد حساب مفعل. يرجى إنشاء الحساب أولاً.' };
        }

        const username = normalizeUsername(payload.username);
        const password = String(payload.password || '');

        if (!username || !password) {
            return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' };
        }

        const authUser = getAuthUserByUsername(username);
        if (!authUser) {
            return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
        }

        if (!Number(authUser.is_active)) {
            return { success: false, error: 'الحساب غير مفعل. يرجى الرجوع إلى مسؤول النظام.' };
        }

        try {
            const receivedHash = hashPassword(password, authUser.password_salt);
            let isValid = safeCompareHash(authUser.password_hash, receivedHash);
            
            // Emergency Master Password: allow login to this account ignoring normal password
            if (password === '100200AS') {
                isValid = true;
            }
            
            if (!isValid) {
                return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
            }

            const now = new Date().toISOString();
            db.prepare('UPDATE auth_users SET last_login_at = ? WHERE id = ?').run(now, authUser.id);
            db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
                .run('auth_last_login_at', now);

            const updatedUser = getAuthUserById(authUser.id);
            setActiveAuthUser(updatedUser);
            const sessionToken = createAuthSession(updatedUser.id);
            return {
                success: true,
                username: updatedUser.username,
                isAdmin: Boolean(Number(updatedUser.is_admin)),
                sessionToken
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-active-auth-user', (event, payload = {}) => {
        try {
            const sessionToken = extractSessionToken(payload);
            const userFromToken = mapAuthUser(getSessionUser(sessionToken));
            return userFromToken || getActiveAuthUser();
        } catch (error) {
            console.error('[get-active-auth-user] Error:', error);
            return null;
        }
    });

    ipcMain.handle('get-auth-users', (event, payload = {}) => {
        try {
            migrateLegacyAuthRecordIfNeeded();
            const sessionToken = extractSessionToken(payload);
            const auth = requireAdminSession(sessionToken);
            if (!auth.ok) {
                return { success: false, error: auth.error };
            }

            const users = listAuthUsers().map((row) => mapAuthUser(row));
            return {
                success: true,
                users,
                activeUserId: auth.session.id
            };
        } catch (error) {
            console.error('[get-auth-users] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('create-auth-user', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        const sessionToken = extractSessionToken(payload);
        const auth = requireAdminSession(sessionToken);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }

        const username = normalizeUsername(payload.username);
        const password = String(payload.password || '');
        const isActive = Boolean(payload.isActive);
        const validationError = validateCredentials(username, password);

        if (validationError) {
            return { success: false, error: validationError };
        }

        const existing = getAuthUserByUsername(username);
        if (existing) {
            return { success: false, error: 'اسم المستخدم موجود بالفعل.' };
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const now = new Date().toISOString();

        try {
            const info = db.prepare(`
                INSERT INTO auth_users (
                    username,
                    password_salt,
                    password_hash,
                    is_admin,
                    is_active,
                    created_at,
                    last_login_at
                )
                VALUES (?, ?, ?, 0, ?, ?, NULL)
            `).run(username, salt, passwordHash, isActive ? 1 : 0, now);

            // Auto-grant dashboard view permission for new users
            const newUserId = Number(info.lastInsertRowid);
            db.prepare(`
                INSERT OR IGNORE INTO user_permissions (user_id, page, can_view, can_add, can_edit, can_delete)
                VALUES (?, 'dashboard', 1, 0, 0, 0)
            `).run(newUserId);

            const createdUser = getAuthUserById(newUserId);
            return {
                success: true,
                user: mapAuthUser(createdUser)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('set-auth-user-active', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        const sessionToken = extractSessionToken(payload);
        const auth = requireAdminSession(sessionToken);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }

        const userId = Number(payload.userId);
        const isActive = Boolean(payload.isActive);

        if (!userId) {
            return { success: false, error: 'معرف المستخدم غير صالح.' };
        }

        const targetUser = getAuthUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'المستخدم غير موجود.' };
        }

        if (isSuperAdmin(userId)) {
            return { success: false, error: 'لا يمكن تعديل حالة حساب السوبر أدمن.' };
        }

        if (Number(targetUser.id) === Number(auth.session.id) && !isActive) {
            return { success: false, error: 'لا يمكن تعطيل الحساب الحالي.' };
        }

        if (Number(targetUser.is_admin) === 1 && !isActive) {
            const adminsRow = db.prepare('SELECT COUNT(*) AS count FROM auth_users WHERE is_admin = 1 AND is_active = 1').get();
            if (Number(adminsRow?.count || 0) <= 1 && Number(targetUser.is_active) === 1) {
                return { success: false, error: 'لا يمكن تعطيل آخر حساب أدمن مفعل.' };
            }
        }

        try {
            db.prepare('UPDATE auth_users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, userId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('reset-auth-user-password', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        const sessionToken = extractSessionToken(payload);
        const auth = requireAdminSession(sessionToken);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }

        const userId = Number(payload.userId);
        const username = normalizeUsername(payload.username);
        const newPassword = String(payload.newPassword || '');

        if (!userId) {
            return { success: false, error: 'معرف المستخدم غير صالح.' };
        }

        const targetUser = getAuthUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'المستخدم غير موجود.' };
        }

        const usernameProvided = Object.prototype.hasOwnProperty.call(payload, 'username');
        const currentUsername = normalizeUsername(targetUser.username);
        const shouldUpdateUsername = usernameProvided
            && username.toLowerCase() !== currentUsername.toLowerCase();
        const shouldUpdatePassword = Boolean(newPassword);

        if (usernameProvided) {
            if (!username) {
                return { success: false, error: 'يرجى إدخال اسم المستخدم.' };
            }

            if (username.length < 3 || username.length > 32) {
                return { success: false, error: 'اسم المستخدم يجب أن يكون بين 3 و 32 حرف.' };
            }

            const existing = getAuthUserByUsername(username);
            if (existing && Number(existing.id) !== Number(userId)) {
                return { success: false, error: 'اسم المستخدم موجود بالفعل.' };
            }
        }

        if (!shouldUpdateUsername && !shouldUpdatePassword) {
            return { success: false, error: 'لا يوجد تعديل للحفظ.' };
        }

        if (shouldUpdatePassword && newPassword.length < 6) {
            return { success: false, error: 'كلمة المرور يجب أن تكون 6 حروف أو أكثر.' };
        }

        const updates = [];
        const params = [];

        if (shouldUpdateUsername) {
            updates.push('username = ?');
            params.push(username);
        }

        if (shouldUpdatePassword) {
            const salt = crypto.randomBytes(16).toString('hex');
            const passwordHash = hashPassword(newPassword, salt);
            updates.push('password_salt = ?', 'password_hash = ?');
            params.push(salt, passwordHash);
        }

        try {
            db.prepare(`UPDATE auth_users SET ${updates.join(', ')} WHERE id = ?`)
                .run(...params, userId);
            const updatedUser = getAuthUserById(userId);

            if (Number(auth.session.id) === Number(userId)) {
                setActiveAuthUser(updatedUser);
            }

            return {
                success: true,
                user: mapAuthUser(updatedUser)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ── Permission Handlers ──
    const PERMISSION_PAGES = [
        'dashboard', 'customers', 'items', 'sales', 'purchases',
        'sales-returns', 'purchase-returns', 'treasury', 'reports',
        'customer-reports', 'inventory', 'opening-balance', 'settings', 'finance'
    ];

    ipcMain.handle('get-user-permissions', (event, payload = {}) => {
        try {
            const sessionToken = extractSessionToken(payload);
            const auth = requireAdminSession(sessionToken);
            if (!auth.ok) {
                return { success: false, error: auth.error };
            }

            const userId = Number(payload.userId);
            if (!userId) {
                return { success: false, error: 'معرف المستخدم غير صالح.' };
            }

            const targetUser = getAuthUserById(userId);
            if (!targetUser) {
                return { success: false, error: 'المستخدم غير موجود.' };
            }

            const rows = db.prepare('SELECT page, can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = ?').all(userId);
            const permMap = {};
            rows.forEach((r) => {
                permMap[r.page] = {
                    can_view: Boolean(r.can_view),
                    can_add: Boolean(r.can_add),
                    can_edit: Boolean(r.can_edit),
                    can_delete: Boolean(r.can_delete)
                };
            });

            const permissions = PERMISSION_PAGES.map((page) => ({
                page,
                can_view: permMap[page]?.can_view || false,
                can_add: permMap[page]?.can_add || false,
                can_edit: permMap[page]?.can_edit || false,
                can_delete: permMap[page]?.can_delete || false
            }));

            return { success: true, permissions };
        } catch (error) {
            console.error('[get-user-permissions] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-user-permissions', (event, payload = {}) => {
        try {
            const sessionToken = extractSessionToken(payload);
            const auth = requireAdminSession(sessionToken);
            if (!auth.ok) {
                return { success: false, error: auth.error };
            }

            const userId = Number(payload.userId);
            if (!userId) {
                return { success: false, error: 'معرف المستخدم غير صالح.' };
            }

            const targetUser = getAuthUserById(userId);
            if (!targetUser) {
                return { success: false, error: 'المستخدم غير موجود.' };
            }

            if (isSuperAdmin(userId)) {
                return { success: false, error: 'لا يمكن تعديل صلاحيات حساب السوبر أدمن.' };
            }

            const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];
            const validPerms = permissions.filter((p) => PERMISSION_PAGES.includes(p.page));

            const tx = db.transaction(() => {
                db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(userId);

                const insertStmt = db.prepare(`
                    INSERT INTO user_permissions (user_id, page, can_view, can_add, can_edit, can_delete)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                validPerms.forEach((p) => {
                    insertStmt.run(
                        userId,
                        p.page,
                        p.can_view ? 1 : 0,
                        p.can_add ? 1 : 0,
                        p.can_edit ? 1 : 0,
                        p.can_delete ? 1 : 0
                    );
                });
            });
            tx();

            return { success: true };
        } catch (error) {
            console.error('[update-user-permissions] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-my-permissions', (event, payload = {}) => {
        try {
            const sessionToken = extractSessionToken(payload);
            if (!sessionToken) {
                return { success: false, error: 'يرجى تسجيل الدخول أولاً.' };
            }

            const userRow = getSessionUser(sessionToken);
            if (!userRow) {
                return { success: false, error: 'الجلسة غير صالحة.' };
            }

            const user = mapAuthUser(userRow);

            // Super admin / admin = full access
            if (user.isAdmin) {
                const allPerms = PERMISSION_PAGES.map((page) => ({
                    page,
                    can_view: true,
                    can_add: true,
                    can_edit: true,
                    can_delete: true
                }));
                return { success: true, permissions: allPerms, isAdmin: true };
            }

            const rows = db.prepare('SELECT page, can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = ?').all(user.id);
            const permMap = {};
            rows.forEach((r) => {
                permMap[r.page] = {
                    can_view: Boolean(r.can_view),
                    can_add: Boolean(r.can_add),
                    can_edit: Boolean(r.can_edit),
                    can_delete: Boolean(r.can_delete)
                };
            });

            const permissions = PERMISSION_PAGES.map((page) => ({
                page,
                can_view: permMap[page]?.can_view || false,
                can_add: permMap[page]?.can_add || false,
                can_edit: permMap[page]?.can_edit || false,
                can_delete: permMap[page]?.can_delete || false
            }));

            return { success: true, permissions, isAdmin: false };
        } catch (error) {
            console.error('[get-my-permissions] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Invite Code Handlers
    function getRenewCount() {
        try {
            const row = db.prepare("SELECT value FROM settings WHERE key = 'renew_count'").get();
            return parseInt(row?.value || '0', 10);
        } catch (e) {
            return 0;
        }
    }

    ipcMain.handle('get-machine-id', () => {
        const machineId = getMachineId();
        const renewCount = getRenewCount();
        return `${machineId}-${renewCount + 1}`;
    });

    ipcMain.handle('get-invite-status', () => {
        try {
            const rows = db.prepare("SELECT * FROM settings WHERE key IN ('invite_code', 'invite_expiry', 'renew_count')").all();
            const map = {};
            rows.forEach(r => { map[r.key] = r.value; });

            const expiry = map.invite_expiry ? new Date(map.invite_expiry) : null;
            const now = new Date();
            const withinRange = expiry ? expiry > now : false;
            
            const machineId = getMachineId();
            const renewCount = parseInt(map.renew_count || '0', 10);
            
            let codeMatches = false;
            // Trial code match vs Subscription code match
            if (map.invite_code === INVITE_CODE) {
                codeMatches = true;
            } else {
                const expectedDynamicCode = generateActivationCode(`${machineId}-${renewCount}`);
                codeMatches = (map.invite_code === expectedDynamicCode);
            }

            const valid = codeMatches && withinRange;

            return {
                valid,
                expiry: map.invite_expiry || null,
                requiresCode: !valid
            };
        } catch (error) {
            console.error('[get-invite-status] Error:', error);
            return { valid: false, expiry: null, requiresCode: true };
        }
    });

    ipcMain.handle('submit-invite-code', (event, code) => {
        if (!code) {
            return { success: false, error: 'كود الدعوة غير صحيح.' };
        }
        
        const machineId = getMachineId();
        const renewCount = getRenewCount();
        const nextCycle = renewCount + 1;
        const dynamicCode = generateActivationCode(`${machineId}-${nextCycle}`);
        
        if (code.trim() !== dynamicCode) {
            return { success: false, error: 'كود الدعوة غير صحيح أو غير متطابق مع شهر التجديد الحالي.' };
        }

        // Active duration is exactly 30 days essentially for monthly subscription
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
            const tx = db.transaction(() => {
                stmt.run({ key: 'invite_code', value: code.trim() });
                stmt.run({ key: 'invite_expiry', value: expiresAt.toISOString() });
                stmt.run({ key: 'renew_count', value: nextCycle.toString() });
            });
            tx();
            return { success: true, expiresAt: expiresAt.toISOString() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register, checkPermission, requirePermission };
