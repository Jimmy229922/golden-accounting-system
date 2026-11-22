const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.ADMIN_PANEL_PORT || 5588);
const ROOT_DIR = __dirname;
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const cleanUrl = String(req.url || '/').split('?')[0];
    const requested = cleanUrl === '/' ? 'index.html' : path.basename(cleanUrl);
    const filePath = path.join(ROOT_DIR, requested);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Admin Control Panel running at http://127.0.0.1:${PORT}`);
});
