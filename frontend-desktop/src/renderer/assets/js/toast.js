function showToast(message, type = 'info') {
    // Create container if not exists
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // Add to container
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, 3000);
}

function ensureConfirmDialogStyles() {
    if (document.getElementById('toast-confirm-dialog-styles')) return;

    const style = document.createElement('style');
    style.id = 'toast-confirm-dialog-styles';
    style.textContent = `
        .confirm-dialog-overlay {
            position: fixed;
            inset: 0;
            z-index: 200000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(15, 23, 42, 0.55);
            backdrop-filter: blur(2px);
            opacity: 0;
            transition: opacity 0.15s ease;
        }

        .confirm-dialog-overlay.show {
            opacity: 1;
        }

        .confirm-dialog-card {
            width: min(460px, 100%);
            border-radius: 14px;
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.15));
            background: var(--card-bg, #0f172a);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            overflow: hidden;
            color: var(--text-color, #ffffff);
        }

        .confirm-dialog-header {
            padding: 14px 16px;
            border-bottom: 1px solid var(--card-border, rgba(255, 255, 255, 0.15));
            font-weight: 800;
            font-size: 1rem;
        }

        .confirm-dialog-message {
            margin: 0;
            padding: 16px;
            color: var(--text-color, #ffffff);
            line-height: 1.7;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .confirm-dialog-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 12px 16px 16px;
        }

        .confirm-dialog-btn {
            min-height: 40px;
            padding: 0 14px;
            border-radius: 10px;
            border: 1px solid transparent;
            cursor: pointer;
            font-weight: 700;
            color: var(--text-color, #ffffff);
            background: rgba(51, 65, 85, 0.6);
        }

        .confirm-dialog-btn.cancel {
            border-color: var(--card-border, rgba(255, 255, 255, 0.15));
            background: transparent;
        }

        .confirm-dialog-btn.confirm {
            background: linear-gradient(135deg, rgba(22, 163, 74, 0.95), rgba(5, 150, 105, 0.9));
        }
    `;

    document.head.appendChild(style);
}

function showConfirmDialog(message, options = {}) {
    ensureConfirmDialogStyles();

    const title = options.title || 'تأكيد العملية';
    const confirmText = options.confirmText || 'تأكيد';
    const cancelText = options.cancelText || 'إلغاء';

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';

        const card = document.createElement('div');
        card.className = 'confirm-dialog-card';

        const header = document.createElement('div');
        header.className = 'confirm-dialog-header';
        header.textContent = title;

        const messageEl = document.createElement('p');
        messageEl.className = 'confirm-dialog-message';
        messageEl.textContent = String(message || '');

        const actions = document.createElement('div');
        actions.className = 'confirm-dialog-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'confirm-dialog-btn cancel';
        cancelBtn.textContent = cancelText;

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'confirm-dialog-btn confirm';
        confirmBtn.textContent = confirmText;

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);

        card.appendChild(header);
        card.appendChild(messageEl);
        card.appendChild(actions);
        overlay.appendChild(card);

        const previousBodyOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';

        const closeDialog = (value) => {
            document.removeEventListener('keydown', handleEscape);
            overlay.remove();
            document.body.style.overflow = previousBodyOverflow;
            resolve(Boolean(value));
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeDialog(false);
            }
        };

        document.addEventListener('keydown', handleEscape);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeDialog(false);
            }
        });

        cancelBtn.addEventListener('click', () => closeDialog(false));
        confirmBtn.addEventListener('click', () => closeDialog(true));

        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
    });
}

const Toast = {
    show: showToast,
    confirm: showConfirmDialog
};

window.showConfirmDialog = showConfirmDialog;
