const inviteForm = document.getElementById('inviteForm');
const inviteInput = document.getElementById('inviteCode');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submitBtn');
const machineIdDisplay = document.getElementById('machineIdDisplay');
const copyMachineIdBtn = document.getElementById('copyMachineId');

function setStatus(msg, type = 'info') {
    statusEl.textContent = msg || '';
    statusEl.classList.remove('error', 'success');
    if (type === 'error') statusEl.classList.add('error');
    if (type === 'success') statusEl.classList.add('success');
}

async function autoCheckStatus() {
    try {
        const status = await window.electronAPI.checkInviteStatus();
        if (status.valid) {
            setStatus('تم التفعيل مسبقاً، يتم الدخول...', 'success');
            window.electronAPI.notifyInviteUnlocked();
            return;
        }

        // Only load machine ID if not already validated
        const machineId = await window.electronAPI.getMachineId();
        if (machineId) {
            machineIdDisplay.value = machineId;
        }
    } catch (err) {
        // no-op if status fails
    }
}

autoCheckStatus();

copyMachineIdBtn.addEventListener('click', () => {
    if (machineIdDisplay.value) {
        navigator.clipboard.writeText(machineIdDisplay.value).then(() => {
            setStatus('تم نسخ رقم الجهاز بنجاح!', 'success');
        });
    }
});

inviteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = inviteInput.value.trim();
    if (!code) {
        setStatus('يرجى إدخال الكود.', 'error');
        return;
    }

    submitBtn.disabled = true;
    setStatus('جاري التحقق من الكود...');

    try {
        const result = await window.electronAPI.submitInviteCode(code);
        if (result.success) {
            setStatus('تم التفعيل بنجاح! جاري فتح النظام...', 'success');
            window.electronAPI.notifyInviteUnlocked();
        } else {
            setStatus(result.error || 'كود الدعوة غير صحيح.', 'error');
        }
    } catch (err) {
        setStatus('تعذر الاتصال. حاول مرة أخرى.', 'error');
    } finally {
        submitBtn.disabled = false;
    }
});
