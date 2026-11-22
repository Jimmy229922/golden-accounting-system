// Handler modules have been split into ./handlers/ directory.
// This file re-exports setupIPC for backward-compatibility.
const { setupIPC, setupAuthIPC, setupFullIPC } = require('./handlers');

module.exports = { setupIPC, setupAuthIPC, setupFullIPC };
