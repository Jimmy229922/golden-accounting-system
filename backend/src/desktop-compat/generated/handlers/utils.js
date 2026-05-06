const fs = require('fs');
const path = require('path');
const { db } = require('../db');

function sanitizeSuggestedFileName(name) {
    const safe = String(name || '').trim() || 'report.pdf';
    // Remove characters illegal on Windows filenames.
    return safe
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\.+$/g, '.')
        .replace(/\s+/g, ' ')
        .trim();
}

const DEFAULT_WAREHOUSE_NAME_FALLBACK = '\u0627\u0644\u0645\u062e\u0632\u0646 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a';

function getDefaultWarehouseName() {
    try {
        const arPath = path.join(__dirname, '../../renderer/assets/i18n/ar.json');
        const dictionary = JSON.parse(fs.readFileSync(arPath, 'utf8'));
        const value = dictionary?.openingBalance?.defaultWarehouseName;
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    } catch (error) {
        console.warn('[i18n] Failed to load default warehouse name from ar.json:', error.message);
    }

    return DEFAULT_WAREHOUSE_NAME_FALLBACK;
}

const DEFAULT_WAREHOUSE_NAME = getDefaultWarehouseName();

function decodeArabicMojibake(value) {
    if (typeof value !== 'string' || !/[\u00D8\u00D9]/.test(value)) {
        return value;
    }

    try {
        const decoded = Buffer.from(value, 'latin1').toString('utf8');
        if (decoded && !decoded.includes('\uFFFD') && /[\u0600-\u06FF]/.test(decoded)) {
            return decoded;
        }
    } catch (error) {
        // Keep original on decode failure
    }

    return value;
}

function repairWarehouseNamesEncoding() {
    try {
        const rows = db.prepare('SELECT id, name FROM warehouses').all();
        const update = db.prepare('UPDATE warehouses SET name = ? WHERE id = ?');
        for (const row of rows) {
            const decoded = decodeArabicMojibake(row.name);
            if (decoded !== row.name) {
                update.run(decoded, row.id);
            }
        }
    } catch (error) {
        // Table may not exist yet; ignore.
    }
}

module.exports = { sanitizeSuggestedFileName, decodeArabicMojibake, repairWarehouseNamesEncoding, DEFAULT_WAREHOUSE_NAME };
