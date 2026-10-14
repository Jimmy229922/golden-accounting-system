const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const { INVITE_CODE, INVITE_DURATION_DAYS, getMachineId, generateActivationCode } = require('../frontend-desktop/src/main/inviteConfig');
const licenseService = require('../frontend-desktop/src/main/licenseService');

console.log('--- TEST 1: INVITE CONFIG CONSTANTS ---');
console.log('INVITE_DURATION_DAYS is strictly:', INVITE_DURATION_DAYS, '(must be 15)');
if (INVITE_DURATION_DAYS !== 15) throw new Error('INVITE_DURATION_DAYS is not 15');

console.log('--- TEST 2: SIMULATE DB OPERATIONS ---');
class MockDb {
    constructor(initialSettings = {}) {
        this.settings = { ...initialSettings };
    }
    prepare(sql) {
        const self = this;
        return {
            all: () => {
                if (sql.includes('FROM settings')) {
                    return Object.entries(self.settings).map(([key, value]) => ({ key, value }));
                }
                return [];
            },
            get: () => {
                if (sql.includes("key = 'company_id'")) {
                    return self.settings['company_id'] ? { value: self.settings['company_id'] } : undefined;
                }
                if (sql.includes("key = 'license_status'")) {
                    return self.settings['license_status'] ? { value: self.settings['license_status'] } : undefined;
                }
                return undefined;
            },
            run: (...args) => {
                if (args[0] && typeof args[0] === 'object' && args[0].key !== undefined) {
                    self.settings[args[0].key] = String(args[0].value);
                } else if (args.length >= 2) {
                    self.settings[args[0]] = String(args[1]);
                }
            }
        };
    }
    transaction(fn) {
        const self = this;
        return () => fn();
    }
}

// 1. Test Legacy Client DB
const legacyDb = new MockDb({
    company_id: '715526d2-f05a-458f-8cf7-179ee172a7a1',
    invite_code: 'TRIAL-V2-15DAYS-2026-SYSTEM-ACTIVE',
    invite_expiry: '2099-12-31T23:59:59.000Z',
    license_status: 'lifetime',
    renew_count: '999'
});

const legacyValid = licenseService.isLicenseCurrentlyValid(legacyDb);
console.log('Legacy Client isLicenseCurrentlyValid:', legacyValid, '(must be true)');
if (!legacyValid) throw new Error('Legacy client was invalidated!');

// 2. Test Master Code Rejected
const mid = getMachineId();
licenseService.activateLicenseWithCode(legacyDb, 'GOLDEN-PRO-2026-LIFETIME').then(res => {
    console.log('Master code GOLDEN-PRO-2026-LIFETIME result:', res);
    if (res.success) throw new Error('GOLDEN-PRO-2026-LIFETIME was accepted!');

    // 3. Test Correct dynamic code accepted
    const expectedCode = generateActivationCode(`${mid}-1000`);
    licenseService.activateLicenseWithCode(legacyDb, expectedCode).then(res2 => {
        console.log('Dynamic activation code result:', res2.success, res2.status);
        if (!res2.success) throw new Error('Dynamic code was not accepted!');

        // 4. Test New Install
        const newDb = new MockDb({});
        const initRes = licenseService.initLicenseForDatabase(newDb);
        console.log('New install init:', initRes.status, 'days:', initRes.remainingDays, 'company_id:', newDb.settings.company_id);
        if (initRes.remainingDays !== 15) throw new Error('New install did not get 15 days!');
        if (newDb.settings.company_id === '715526d2-f05a-458f-8cf7-179ee172a7a1') throw new Error('New install got legacy company_id!');
        if (!newDb.settings.bound_machine_id) throw new Error('bound_machine_id was not set for new install!');

        // 5. Test Hardware mismatch on new install
        newDb.settings.bound_machine_id = 'WRONG-MACHINE-ID';
        const copiedValid = licenseService.isLicenseCurrentlyValid(newDb);
        console.log('Copied DB on wrong machine is valid:', copiedValid, '(must be false)');
        if (copiedValid) throw new Error('Hardware mismatch was not blocked!');

        console.log('ALL PHASE 3 TESTS PASSED 100%!');
    });
});
