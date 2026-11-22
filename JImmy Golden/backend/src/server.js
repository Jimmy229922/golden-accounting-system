const http = require('http');
const config = require('./config/env');
const app = require('./app');

const server = http.createServer(app);

server.listen(config.port, () => {
    console.log(`[backend] listening on http://localhost:${config.port}`);
});

function shutdown(signal) {
    console.log(`[backend] received ${signal}, shutting down`);
    server.close(() => {
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
