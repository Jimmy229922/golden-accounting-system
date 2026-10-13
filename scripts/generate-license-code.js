/**
 * أداة توليد أكواد تفعيل وتجديد نظام المحاسبة الذهبي للعملاء
 * الاستخدام:
 * node scripts/generate-license-code.js <MachineID-Cycle>
 * مثال:
 * node scripts/generate-license-code.js 9F4A-B821-C73E-1
 */

const path = require('path');
const { generateActivationCode } = require(path.join(__dirname, '../frontend-desktop/src/main/inviteConfig'));

const rawArg = process.argv[2];

if (!rawArg) {
    console.log('\n❌ يرجى تمرير كود الجهاز ودورة التجديد.');
    console.log('طريقة الاستخدام:');
    console.log('node scripts/generate-license-code.js <MACHINE_ID-CYCLE>');
    console.log('مثال:');
    console.log('node scripts/generate-license-code.js 9F4A-B821-C73E-1\n');
    process.exit(1);
}

const machineWithCycle = rawArg.trim();
const code = generateActivationCode(machineWithCycle);

console.log('\n======================================================');
console.log('🔑 كود تفعيل نظام المحاسبة الذهبي (تجديد 30 يوماً)');
console.log('======================================================');
console.log(`📌 كود جهاز العميل ودورته: ${machineWithCycle}`);
console.log(`✅ كود التفعيل المعتمد للإرسال: ${code}`);
console.log('======================================================\n');
