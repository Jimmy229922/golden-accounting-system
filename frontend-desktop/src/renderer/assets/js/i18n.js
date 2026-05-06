let arDictionaryCache = null;

function resolvePathCandidates() {
    const path = window.location.pathname;
    let depth = 0;
    
    // Count how many directories we are deep inside "renderer"
    // e.g. /D:/JS/accounting-system/frontend-desktop/src/renderer/views/reports/debtor-creditor/index.html
    const match = path.match(/renderer\/(.*\/)index\.html$/i);
    if (match && match[1]) {
        depth = match[1].split('/').filter(Boolean).length;
    } else {
        // Fallback generic depth calculation
        depth = path.split('/').length - path.indexOf('renderer/') - 2;
    }
    
    // Safety bound
    if (depth < 0) depth = 0;
    if (depth > 5) depth = 5;

    const prefix = depth > 0 ? '../'.repeat(depth) : './';
    const computedPath = prefix + 'assets/i18n/ar.json';

    // Return the computed path first, then the fallbacks just in case
    return Array.from(new Set([
        computedPath,
        '../../assets/i18n/ar.json',
        '../../../assets/i18n/ar.json',
        '../assets/i18n/ar.json',
        './assets/i18n/ar.json'
    ]));
}

async function loadArabicDictionary() {
    if (arDictionaryCache) return arDictionaryCache;

    const paths = resolvePathCandidates();
    for (const p of paths) {
        try {
            const res = await fetch(p);
            if (!res.ok) continue;
            arDictionaryCache = await res.json();
            return arDictionaryCache;
        } catch (err) {
            // Try next candidate path.
        }
    }

    arDictionaryCache = {};
    return arDictionaryCache;
}

function getText(dict, key, fallback = '') {
    if (!dict || !key) return fallback;
    const value = key.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) return acc[part];
        return undefined;
    }, dict);
    return typeof value === 'string' ? value : fallback;
}

function formatTemplate(template, values = {}) {
    const source = String(template || '');
    return source.replace(/\{(\w+)\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            return String(values[key]);
        }
        return match;
    });
}

function createPageHelpers(dictAccessor) {
    const getDict = typeof dictAccessor === 'function'
        ? dictAccessor
        : () => (dictAccessor && typeof dictAccessor === 'object' ? dictAccessor : {});

    return {
        t: (key, fallback = '') => getText(getDict(), key, fallback),
        fmt: (template, values = {}) => formatTemplate(template, values)
    };
}

window.i18n = {
    loadArabicDictionary,
    getText,
    formatTemplate,
    createPageHelpers
};

