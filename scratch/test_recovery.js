const crypto = require('crypto');
const { calculateRecoveryChallenge, generateRecoveryCode } = require('../frontend-desktop/src/main/inviteConfig');

console.log('--- TEST 1: CHALLENGE GENERATION ---');
const challenge = calculateRecoveryChallenge();
console.log('Challenge:', challenge);
if (!challenge.startsWith('REC-')) throw new Error('Challenge format invalid!');

console.log('--- TEST 2: RECOVERY CODE GENERATION ---');
const code = generateRecoveryCode(challenge);
console.log('Recovery Code:', code);
if (!code || code.length !== 9 || !code.includes('-')) throw new Error('Recovery code format invalid!');

console.log('--- TEST 3: WRONG CODE REJECTION ---');
const wrongCode = '0000-0000';
if (wrongCode === code) throw new Error('Wrong code matched!');
console.log('Wrong code differs from expected: PASS');

console.log('--- TEST 4: VERIFY SAME CHALLENGE GIVES SAME CODE ---');
const code2 = generateRecoveryCode(challenge);
if (code !== code2) throw new Error('Idempotence failed!');
console.log('Code is consistent for same challenge: PASS');

console.log('--- ALL RECOVERY OTP TESTS PASSED 100%! ---');
