const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

// Invite code configuration.
const INVITE_CODE = process.env.INVITE_CODE || 'TRIAL-V2-15DAYS-2026-SYSTEM-ACTIVE';
const INVITE_DURATION_DAYS = Number(process.env.INVITE_DURATION_DAYS) || 15;
const _MK_ENC = 'QVgtMjAyNi1NSy03RjRCOUMzRS1QTE43LVRTOVgtU0VDVVJFLTg4MzE=';
const _MK = process.env.INVITE_MASTER_KEY || Buffer.from(_MK_ENC, 'base64').toString('utf8');

function getMachineId() {
    try {
        let id = '';
        if (process.platform === 'win32') {
            id = execSync('reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { windowsHide: true }).toString().split('REG_SZ')[1].trim();
        } else if (process.platform === 'darwin') {
            id = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID').toString().split('"')[3];
        } else {
            id = execSync('cat /etc/machine-id').toString().trim();
        }
        if (!id) throw new Error('Empty ID');
        const hash = crypto.createHash('sha256').update(id).digest('hex').toUpperCase();
        return hash.substring(0, 12).match(/.{1,4}/g).join('-');
    } catch (e) {
        const fallback = os.hostname() + '_' + os.platform() + '_' + os.arch();
        const hash = crypto.createHash('sha256').update(fallback).digest('hex').toUpperCase();
        return hash.substring(0, 12).match(/.{1,4}/g).join('-');
    }
}

function generateActivationCode(machineId) {
    const hmac = crypto.createHmac('sha256', _MK).update(machineId).digest('hex');
    const code = hmac.substring(0, 16).toUpperCase();
    return code.match(/.{1,4}/g).join('-');
}

module.exports = { INVITE_CODE, INVITE_DURATION_DAYS, getMachineId, generateActivationCode };
