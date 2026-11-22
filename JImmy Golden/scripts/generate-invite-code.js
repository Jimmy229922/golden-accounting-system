#!/usr/bin/env node
///////////////////////////////////////////////////////////////////////////////
//  generate-invite-code.js — أداة توليد كود التفعيل (للمطور فقط)
//
//  الاستخدام:
//    node scripts/generate-invite-code.js <DEVICE_ID>
//
//  مثال:
//    node scripts/generate-invite-code.js A1B2C3D4E5F6
//
//  الأداة دي مش بتتوزع مع البرنامج. المطور بس هو اللي يستخدمها.
///////////////////////////////////////////////////////////////////////////////
const crypto = require('crypto');

const _MK = process.env.INVITE_MASTER_KEY || 'AX-2026-MK-7F4B9C3E-PLN7-TS9X-SECURE-8831';

function generateActivationCode(machineId) {
    const hmac = crypto.createHmac('sha256', _MK).update(machineId).digest('hex');
    const code = hmac.substring(0, 16).toUpperCase();
    return code.match(/.{1,4}/g).join('-');
}

// ─── Main ───────────────────────────────────────────────────────────────────
const deviceId = (process.argv[2] || '').trim().toUpperCase();

if (!deviceId) {
    console.error('');
    console.error('  خطأ: يجب إدخال رقم الجهاز (Device ID)');
    console.error('');
    console.error('  الاستخدام:');
    console.error('    node scripts/generate-invite-code.js <DEVICE_ID>');
    console.error('');
    console.error('  مثال:');
    console.error('    node scripts/generate-invite-code.js A1B2C3D4E5F6');
    console.error('');
    process.exit(1);
}

const code = generateActivationCode(deviceId);

console.log('');
console.log('  ╔══════════════════════════════════════════╗');
console.log('  ║         كود التفعيل للجهاز              ║');
console.log('  ╠══════════════════════════════════════════╣');
console.log(`  ║  رقم الجهاز:   ${deviceId.padEnd(24)} ║`);
console.log(`  ║  كود التفعيل:  ${code.padEnd(24)} ║`);
console.log('  ╚══════════════════════════════════════════╝');
console.log('');
