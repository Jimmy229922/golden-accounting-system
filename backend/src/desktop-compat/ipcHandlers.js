// Handler modules have been split into ./handlers/ directory.
// This file re-exports setupIPC for backward-compatibility.
const { setupIPC } = require('./handlers');

module.exports = { setupIPC };
