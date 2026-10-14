filePath = r'd:\JImmy Golden\frontend-desktop\src\main\preload.js'

with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

target = "    notifyAuthUnlocked: () => ipcRenderer.send('auth-unlocked'),"
replacement = """    notifyAuthUnlocked: () => ipcRenderer.send('auth-unlocked'),
    getRecoveryChallenge: () => invokeChannel('get-recovery-challenge'),
    verifyRecoveryCode: (payload) => invokeChannel('verify-recovery-code', payload),"""

if '\r\n' in content:
    target_crlf = target
    replacement_crlf = replacement.replace('\n', '\r\n')
    content = content.replace(target_crlf, replacement_crlf)
else:
    content = content.replace(target, replacement)

with open(filePath, 'w', encoding='utf-8') as f:
    f.write(content)

print("preload.js updated successfully!")
