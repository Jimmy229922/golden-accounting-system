let arDictionaryCache = null;

function resolvePathCandidates() {
    const path = window.location.pathname.replace(/\\/g, '/');
    let depth = 0;
    
    const match = path.match(/renderer\/(.*\/)[^/]+$/i);
    if (match && match[1]) {
        depth = match[1].split('/').filter(Boolean).length;
    } else {
        const segments = path.split('/').filter(Boolean);
        const rendererIndex = segments.map(s => s.toLowerCase()).lastIndexOf('renderer');
        if (rendererIndex !== -1 && segments.length > rendererIndex + 1) {
            depth = (segments.length - 1) - (rendererIndex + 1);
        }
    }
    
    if (depth < 0) depth = 0;
    if (depth > 5) depth = 5;

    const prefix = depth > 0 ? '../'.repeat(depth) : './';
    const computedPath = prefix + 'assets/i18n/ar.json';

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

