const path = require('path');
const fs = require('fs');

const DEFAULT_PROD_ROOT = 'C:\\APP_JS';
const DEFAULT_PROD_DB_SUBPATH = path.join('DATA', 'accounting.db');

function normalizeCanonicalPath(p) {
    if (!p) return '';
    try {
        const absolute = path.resolve(p);
        if (fs.existsSync(absolute)) {
            return path.normalize(fs.realpathSync(absolute)).toLowerCase();
        }
        return path.normalize(absolute).toLowerCase();
    } catch (_) {
        return path.normalize(path.resolve(p)).toLowerCase();
    }
}

function evaluateSyncGuard(options = {}) {
    const {
        isPackaged = false,
        allowDevMode = false,
        dbPath = '',
        syncConfig = null,
        environment = process.env.NODE_ENV || 'production',
        configuredRootEnv = process.env.ACCOUNTING_SYSTEM_ROOT || '',
        repoRoot = path.resolve(__dirname, '../../../..')
    } = options;

    const reasons = [];

    // 1. المزامنة معطلة افتراضياً
    if (!syncConfig || syncConfig.enabled !== true) {
        return {
            allowed: false,
            code: 'SYNC_DISABLED_BY_DEFAULT',
            reason: 'المزامنة معطلة افتراضياً وتتطلب تفعيل صريح من إعدادات الإنتاج المعتمدة.'
        };
    }

    // 2. فحص وضع التطوير (Development Mode)
    if (!allowDevMode && (!isPackaged || environment === 'development' || environment === 'test')) {
        reasons.push('التطبيق يعمل في بيئة تطوير أو اختبار (Non-Packaged / Development).');
    }

    // 3. التحقق من مسار قاعدة البيانات الحقيقي المعتمد (Canonical Path)
    const normalizedDb = normalizeCanonicalPath(dbPath);
    const normalizedRepo = normalizeCanonicalPath(repoRoot);
    const expectedCanonicalDb = normalizeCanonicalPath(path.join(DEFAULT_PROD_ROOT, DEFAULT_PROD_DB_SUBPATH));

    if (!normalizedDb) {
        reasons.push('مسار قاعدة البيانات فارغ أو غير محدد.');
    } else if (!allowDevMode && normalizedDb.startsWith(normalizedRepo)) {
        reasons.push('مسار قاعدة البيانات يقع داخل مستودع التطوير (Workspace Repo).');
    } else if (!allowDevMode && normalizedDb !== expectedCanonicalDb) {
        reasons.push(`قاعدة البيانات (${path.basename(normalizedDb)}) ليست في المسار الإنتاجي المعتمد.`);
    }

    // 4. حماية متغير البيئة ACCOUNTING_SYSTEM_ROOT من التحويل غير المصرح
    if (configuredRootEnv && configuredRootEnv.trim()) {
        const normalizedRootEnv = normalizeCanonicalPath(configuredRootEnv);
        const expectedProdRoot = normalizeCanonicalPath(DEFAULT_PROD_ROOT);
        if (normalizedRootEnv !== expectedProdRoot) {
            reasons.push('تم رصد متغير بيئة خارجي (ACCOUNTING_SYSTEM_ROOT) يوجّه لمسار غير معتمد.');
        }
    }

    // 5. التحقق من هوية المشروع المستهدف
    if (!syncConfig.targetUrl || !syncConfig.targetUrl.startsWith('https://')) {
        reasons.push('رابط خادم المزامنة غير آمن أو غير محدد.');
    }

    if (syncConfig.targetEnvironment === 'sandbox' && isPackaged) {
        reasons.push('محاولة توجيه نسخة إنتاجية إلى بيئة Sandbox.');
    }

    if (reasons.length > 0) {
        return {
            allowed: false,
            code: 'SYNC_GUARD_REJECTED',
            reasons,
            summary: reasons.join(' | ')
        };
    }

    return {
        allowed: true,
        code: 'SYNC_GUARD_PASSED',
        targetEnvironment: syncConfig.targetEnvironment,
        canonicalDbPath: normalizedDb
    };
}

function validateProductionActivation(activationConfig = null, isPackaged = false, dbPath = '') {
    if (!activationConfig) {
        return { valid: false, code: 'ACTIVATION_FILE_MISSING', reason: 'ملف تفعيل الإنتاج production_activation.json غير موجود.' };
    }

    if (!isPackaged) {
        return { valid: false, code: 'PROD_ACTIVATION_BLOCKED_IN_DEV', reason: 'يمنع تفعيل مزامنة الإنتاج من بيئة التطوير قطعيًا.' };
    }

    const normalizedDb = normalizeCanonicalPath(dbPath);
    const expectedCanonicalDb = normalizeCanonicalPath(path.join(DEFAULT_PROD_ROOT, DEFAULT_PROD_DB_SUBPATH));
    if (normalizedDb !== expectedCanonicalDb) {
        return { valid: false, code: 'ACTIVATION_WRONG_DB_PATH', reason: 'ملف التفعيل لا يطابق المسار الإنتاجي المعتمد للقاعدة.' };
    }

    if (!activationConfig.companyId || !activationConfig.deviceId || !activationConfig.activationToken) {
        return { valid: false, code: 'ACTIVATION_DATA_INCOMPLETE', reason: 'بيانات التفعيل ناقصة (companyId, deviceId, activationToken مطلوبة).' };
    }

    if (typeof activationConfig.activationToken !== 'string' || activationConfig.activationToken.length < 32) {
        return { valid: false, code: 'ACTIVATION_TOKEN_INVALID', reason: 'رمز التفعيل غير صالح أو غير معتمد أمنيًا.' };
    }

    if (activationConfig.targetEnvironment !== 'production') {
        return { valid: false, code: 'ACTIVATION_NOT_PRODUCTION', reason: 'بيئة التفعيل ليست production.' };
    }

    return { valid: true, code: 'ACTIVATION_VALID', activationConfig };
}

module.exports = {
    evaluateSyncGuard,
    normalizeCanonicalPath,
    validateProductionActivation
};
