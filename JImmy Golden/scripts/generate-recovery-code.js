#!/usr/bin/env node
const crypto = require('crypto');

const _MK_ENC = 'QVgtMjAyNi1NSy03RjRCOUMzRS1QTE43LVRTOVgtU0VDVVJFLTg4MzE=';
const _MK = process.env.INVITE_MASTER_KEY || Buffer.from(_MK_ENC, 'base64').toString('utf8');

function generateRecoveryCode(challenge) {
    const hmac = crypto.createHmac('sha256', _MK).update(`RECOVERY-${String(challenge).trim().toUpperCase()}`).digest('hex');
    const raw = hmac.slice(0, 8).toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

let rawInput = (process.argv[2] || '').trim().toUpperCase();

if (!rawInput) {
    console.error('');
    console.error('  خطأ: يجب إدخال رمز الاسترداد أو رقم الجهاز المرسل من العميل');
    console.error('');
    console.error('  الاستخدام:');
    console.error('    node scripts/generate-recovery-code.js <CHALLENGE_CODE_OR_DEVICE_ID>');
    console.error('');
    console.error('  أمثلة:');
    console.error('    node scripts/generate-recovery-code.js REC-A232D4B4-20261014');
    console.error('    node scripts/generate-recovery-code.js A232D4B4');
    console.error('');
    process.exit(1);
}

let challenge = rawInput;
if (!challenge.startsWith('REC-')) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const cleanId = rawInput.replace(/[^A-Z0-9]/g, '').slice(0, 8);
    challenge = `REC-${cleanId}-${today}`;
}

const code = generateRecoveryCode(challenge);

console.log('');
console.log('  ╔══════════════════════════════════════════════════════╗');
console.log('  ║       كود استرداد وتعيين كلمة المرور للعميل         ║');
console.log('  ╠══════════════════════════════════════════════════════╣');
console.log(`  ║  رمز التحدي:   ${challenge.padEnd(36)} ║`);
console.log(`  ║  كود الفك:     ${code.padEnd(36)} ║`);
console.log('  ╠══════════════════════════════════════════════════════╣');
console.log('  ║  صلاحية الكود: هذا الكود صالح لليوم ولهذا الجهاز فقط ║');
console.log('  ╚══════════════════════════════════════════════════════╝');
console.log('');
