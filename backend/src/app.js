const { URL } = require('url');
const config = require('./config/env');
const {
    listPublicChannels,
    listLocalElectronOnlyChannels,
    getCompatibilityReport,
    invokeChannel
} = require('./compat/runtime');

function applyCorsHeaders(req, res) {
    const origin = req.headers.origin || '*';
    if (config.corsOrigin === '*') {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        const allowedOrigins = config.corsOrigin.split(',').map((entry) => entry.trim());
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
    }

    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-token');
}

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(body);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';

        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 2 * 1024 * 1024) {
                reject(new Error('Request body too large'));
            }
        });

        req.on('end', () => {
            if (!raw) {
                return resolve({});
            }

            try {
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(new Error(`Invalid JSON body: ${error.message}`));
            }
        });

        req.on('error', (error) => {
            reject(error);
        });
    });
}

function isAuthorized(req) {
    if (!config.rpcToken) {
        return true;
    }

    return req.headers['x-api-token'] === config.rpcToken;
}

async function app(req, res) {
    applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
    }

    const url = new URL(req.url, 'http://localhost');
    const apiRoot = config.apiPrefix.replace(/\/+$/, '');

    if (req.method === 'GET' && url.pathname === '/') {
        return sendJson(res, 200, {
            service: 'accounting-system-backend',
            status: 'ok',
            apiPrefix: apiRoot
        });
    }

    if (req.method === 'GET' && url.pathname === `${apiRoot}/health`) {
        const compatibility = getCompatibilityReport();
        return sendJson(res, 200, {
            status: 'ok',
            service: 'accounting-system-backend',
            timestamp: new Date().toISOString(),
            compatibility
        });
    }

    if (req.method === 'GET' && url.pathname === `${apiRoot}/channels`) {
        return sendJson(res, 200, {
            channels: listPublicChannels()
        });
    }

    if (req.method === 'GET' && url.pathname === `${apiRoot}/channels-local`) {
        return sendJson(res, 200, {
            channels: listLocalElectronOnlyChannels()
        });
    }

    if (req.method === 'GET' && url.pathname === `${apiRoot}/compatibility`) {
        return sendJson(res, 200, getCompatibilityReport());
    }

    if (req.method === 'POST' && url.pathname.startsWith(`${apiRoot}/rpc/`)) {
        if (!isAuthorized(req)) {
            return sendJson(res, 401, {
                ok: false,
                error: 'Unauthorized'
            });
        }

        const channel = decodeURIComponent(url.pathname.replace(`${apiRoot}/rpc/`, ''));
        try {
            const body = await readJsonBody(req);
            const args = Array.isArray(body.args) ? body.args : [];
            const result = await invokeChannel(channel, args);
            return sendJson(res, 200, {
                ok: true,
                channel,
                result
            });
        } catch (error) {
            return sendJson(res, 400, {
                ok: false,
                channel,
                error: error.message
            });
        }
    }

    return sendJson(res, 404, {
        status: 'error',
        message: `Route not found: ${req.method} ${url.pathname}`
    });
}

module.exports = app;
