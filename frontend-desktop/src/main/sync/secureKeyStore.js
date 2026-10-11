const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateDeviceKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const rawPublicKey = publicKey.export({ type: 'spki', format: 'der' });
    const rawPrivateKey = privateKey.export({ type: 'pkcs8', format: 'der' });

    const rawPublicKey32 = rawPublicKey.slice(-32);
    const rawPrivateKey32 = rawPrivateKey.slice(-32);

    return {
        publicKeyBase64: rawPublicKey32.toString('base64'),
        privateKeyBase64: rawPrivateKey32.toString('base64'),
        rawPublicKey,
        rawPrivateKey
    };
}

function protectPrivateKey(privateKeyBase64, safeStorage = null) {
    if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(privateKeyBase64);
        return {
            mode: 'windows_dpapi',
            data: encrypted.toString('base64')
        };
    }

    const machineId = crypto.createHash('sha256').update(process.env.COMPUTERNAME || 'GOLDEN_ACCOUNTING_NODE').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', machineId, iv);
    let enc = cipher.update(privateKeyBase64, 'utf8', 'hex');
    enc += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
        mode: 'machine_aes_gcm',
        iv: iv.toString('hex'),
        authTag,
        data: enc
    };
}

function unprotectPrivateKey(protectedPayload, safeStorage = null) {
    if (protectedPayload.mode === 'windows_dpapi' && safeStorage) {
        const buf = Buffer.from(protectedPayload.data, 'base64');
        return safeStorage.decryptString(buf);
    }

    const machineId = crypto.createHash('sha256').update(process.env.COMPUTERNAME || 'GOLDEN_ACCOUNTING_NODE').digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', machineId, Buffer.from(protectedPayload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(protectedPayload.authTag, 'hex'));
    let dec = decipher.update(protectedPayload.data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
}

function loadOrCreateDeviceIdentity(storageDir, safeStorage = null) {
    const filePath = path.join(storageDir, 'device_sync_identity.json');

    if (fs.existsSync(filePath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const privateKeyBase64 = unprotectPrivateKey(raw.protectedPrivateKey, safeStorage);
            return {
                deviceId: raw.deviceId,
                publicKeyBase64: raw.publicKeyBase64,
                privateKeyBase64,
                isNew: false
            };
        } catch (e) {
            console.error('[secureKeyStore] فشل قراءة هوية الجهاز المشفرة:', e.message);
            return null;
        }
    }

    const keyPair = generateDeviceKeyPair();
    const deviceId = crypto.randomUUID();
    const protectedKey = protectPrivateKey(keyPair.privateKeyBase64, safeStorage);

    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
        deviceId,
        publicKeyBase64: keyPair.publicKeyBase64,
        protectedPrivateKey: protectedKey,
        createdAt: new Date().toISOString()
    }, null, 2), 'utf8');

    return {
        deviceId,
        publicKeyBase64: keyPair.publicKeyBase64,
        privateKeyBase64: keyPair.privateKeyBase64,
        isNew: true
    };
}

function signPayload(privateKeyBase64, companyId, payloadJsonString) {
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const canonicalMessage = `${timestamp}.${nonce}.${companyId}.${payloadJsonString}`;

    const rawBytes = Buffer.from(privateKeyBase64, 'base64');
    const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
    const fullDer = Buffer.concat([pkcs8Header, rawBytes]);
    const privateKeyObj = crypto.createPrivateKey({ key: fullDer, format: 'der', type: 'pkcs8' });

    const signature = crypto.sign(null, Buffer.from(canonicalMessage, 'utf8'), privateKeyObj);

    return {
        timestamp,
        nonce,
        signatureBase64: signature.toString('base64'),
        canonicalMessage
    };
}

module.exports = {
    generateDeviceKeyPair,
    protectPrivateKey,
    unprotectPrivateKey,
    loadOrCreateDeviceIdentity,
    signPayload
};
