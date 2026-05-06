
// Ensure overlay styles exist since we bypass toast.js ensureConfirmDialogStyles
(function() {
    if (!document.getElementById('profitDetailsModalStyle')) {
        const s = document.createElement('style');
        s.id = 'profitDetailsModalStyle';
        s.innerHTML = `
        .confirm-dialog-overlay {
            position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
            opacity: 0; transition: opacity 0.2s ease;
        }
        .confirm-dialog-overlay.show { opacity: 1; }
        .confirm-dialog-card {
            background: var(--card-bg, #0f172a); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            max-height: 90vh; overflow-y: auto; color: #fff;
        }
        .interactive-card:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.3); border-color: rgba(56, 189, 248, 0.4) !important; }
        `;
        document.head.appendChild(s);
    }
})();
