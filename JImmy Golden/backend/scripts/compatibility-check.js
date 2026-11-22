const { getCompatibilityReport, invokeChannel } = require('../src/compat/runtime');

async function main() {
    const report = getCompatibilityReport();

    console.log('[compat] preload channels:', report.preloadCount);
    console.log('[compat] registered handlers:', report.registeredCount);
    console.log('[compat] missing channels:', report.missingChannels.length);
    console.log('[compat] extra channels:', report.extraChannels.length);

    if (report.missingChannels.length > 0) {
        console.log('[compat] missing list:', report.missingChannels.join(', '));
        process.exitCode = 1;
        return;
    }

    if (report.extraChannels.length > 0) {
        console.log('[compat] extra list:', report.extraChannels.join(', '));
        process.exitCode = 1;
        return;
    }

    // Minimal live smoke calls against core modules.
    const units = await invokeChannel('get-units', []);
    const items = await invokeChannel('get-items', []);
    const customers = await invokeChannel('get-customers', []);
    const stats = await invokeChannel('get-dashboard-stats', []);
    const authStatus = await invokeChannel('get-auth-status', []);
    const machineId = await invokeChannel('get-machine-id', []);
    const inviteStatus = await invokeChannel('get-invite-status', []);
    const myPermissions = await invokeChannel('get-my-permissions', [{}]);
    const userPermissions = await invokeChannel('get-user-permissions', [{}]);
    const updatePermissions = await invokeChannel('update-user-permissions', [{}]);
    const submitInvite = await invokeChannel('submit-invite-code', ['__invalid__']);

    console.log('[smoke] units:', Array.isArray(units) ? units.length : 'invalid');
    console.log('[smoke] items:', Array.isArray(items) ? items.length : 'invalid');
    console.log('[smoke] customers:', Array.isArray(customers) ? customers.length : 'invalid');
    console.log('[smoke] dashboard stats keys:', stats && typeof stats === 'object' ? Object.keys(stats).length : 'invalid');
    console.log('[smoke] auth status object:', authStatus && typeof authStatus === 'object');
    console.log('[smoke] machine id format:', typeof machineId === 'string' && machineId.length > 0 ? 'ok' : 'invalid');
    console.log('[smoke] invite status object:', inviteStatus && typeof inviteStatus === 'object');
    console.log('[smoke] my permissions response object:', myPermissions && typeof myPermissions === 'object');
    console.log('[smoke] user permissions response object:', userPermissions && typeof userPermissions === 'object');
    console.log('[smoke] update permissions response object:', updatePermissions && typeof updatePermissions === 'object');
    console.log('[smoke] submit invite response object:', submitInvite && typeof submitInvite === 'object');
}

main().catch((error) => {
    console.error('[compat] failed:', error.message);
    process.exitCode = 1;
});
