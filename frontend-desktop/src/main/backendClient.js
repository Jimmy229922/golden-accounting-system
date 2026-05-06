const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_BACKEND_URL = 'http://localhost:4000';

function getBackendBaseUrl() {
    const raw = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
    return raw.replace(/\/+$/, '');
}

async function checkBackendHealth() {
    const baseUrl = getBackendBaseUrl();
    const healthUrl = `${baseUrl}/api/health`;

    try {
        const payload = await getJson(healthUrl);
        return {
            connected: true,
            baseUrl,
            payload
        };
    } catch (error) {
        const errorMessage = error && error.message ? error.message : 'Backend is unreachable';
        return {
            connected: false,
            baseUrl,
            error: errorMessage
        };
    }
}

function getJson(urlString) {
    return new Promise((resolve, reject) => {
        const target = new URL(urlString);
        const client = target.protocol === 'https:' ? https : http;

        const request = client.request(
            {
                method: 'GET',
                hostname: target.hostname,
                port: target.port || undefined,
                path: `${target.pathname}${target.search}`,
                headers: {
                    Accept: 'application/json'
                }
            },
            (response) => {
                let data = '';
                response.setEncoding('utf8');

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        return reject(new Error(`Backend responded with ${response.statusCode}`));
                    }

                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error(`Invalid backend JSON: ${error.message}`));
                    }
                });
            }
        );

        request.on('error', (error) => {
            reject(error);
        });

        request.setTimeout(3000, () => {
            request.destroy(new Error('Backend health check timed out'));
        });

        request.end();
    });
}

module.exports = {
    getBackendBaseUrl,
    checkBackendHealth
};
