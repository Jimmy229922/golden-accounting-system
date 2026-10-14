filePath = r'd:\JImmy Golden\frontend-desktop\src\renderer\views\auth\auth.api.js'

with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """    async function loginAuthAccount(payload) {
        return window.electronAPI.loginAuthAccount(payload);
    }"""

addition = """    async function loginAuthAccount(payload) {
        return window.electronAPI.loginAuthAccount(payload);
    }

    async function getRecoveryChallenge() {
        return window.electronAPI.getRecoveryChallenge();
    }

    async function verifyRecoveryCode(payload) {
        return window.electronAPI.verifyRecoveryCode(payload);
    }"""

target_export = """        loginAuthAccount,
        storeSessionToken,"""

replacement_export = """        loginAuthAccount,
        getRecoveryChallenge,
        verifyRecoveryCode,
        storeSessionToken,"""

if '\r\n' in content:
    content = content.replace(target.replace('\n', '\r\n'), addition.replace('\n', '\r\n'))
    content = content.replace(target_export.replace('\n', '\r\n'), replacement_export.replace('\n', '\r\n'))
else:
    content = content.replace(target, addition)
    content = content.replace(target_export, replacement_export)

with open(filePath, 'w', encoding='utf-8') as f:
    f.write(content)

print("auth.api.js updated!")
