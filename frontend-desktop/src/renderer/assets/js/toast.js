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
            width: min(480px, 94vw);
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            border-radius: 14px;
            border: 1px solid var(--card-border, rgba(0, 0, 0, 0.12));
            background: var(--card-bg, #ffffff);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            color: var(--text-color, #1e293b);
        }

        .confirm-dialog-header {
            flex-shrink: 0;
            padding: 14px 18px;
            border-bottom: 1px solid var(--card-border, rgba(0, 0, 0, 0.1));
            font-weight: 800;
            font-size: 1.05rem;
            color: var(--text-color, #1e293b);
        }

        .confirm-dialog-message {
            flex: 1;
            overflow-y: auto;
            margin: 0;
            padding: 18px 20px;
            color: var(--text-color, #1e293b);
            line-height: 1.6;
            word-break: break-word;
        }

        .confirm-dialog-actions {
            flex-shrink: 0;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 14px 18px;
            border-top: 1px solid var(--card-border, rgba(0, 0, 0, 0.08));
            background: var(--bg-card-footer, rgba(0, 0, 0, 0.02));
        }

        .confirm-dialog-btn {
            min-height: 40px;
            padding: 0 18px;
            border-radius: 10px;
            border: 1px solid transparent;
            cursor: pointer;
            font-weight: 700;
            font-size: 0.95rem;
            transition: all 0.15s ease;
        }

        .confirm-dialog-btn.cancel {
            border-color: var(--card-border, #cbd5e1);
            background: var(--btn-cancel-bg, #f1f5f9);
            color: var(--text-color, #334155);
        }

        .confirm-dialog-btn.cancel:hover {
            background: var(--btn-cancel-hover, #e2e8f0);
        }

        .confirm-dialog-btn.confirm {
            background: #10b981;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .confirm-dialog-btn.confirm:hover {
            background: #059669;
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

        const messageEl = document.createElement('div');
        messageEl.className = 'confirm-dialog-message';
        if (options && options.isHtml) {
            messageEl.innerHTML = String(message || '');
        } else {
            messageEl.textContent = String(message || '');
        }

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
