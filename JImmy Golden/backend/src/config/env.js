const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 4000),
    apiPrefix: process.env.API_PREFIX || '/api',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rpcToken: process.env.BACKEND_RPC_TOKEN || ''
};

module.exports = config;
