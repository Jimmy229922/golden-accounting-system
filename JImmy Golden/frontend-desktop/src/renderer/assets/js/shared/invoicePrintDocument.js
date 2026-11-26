(function () {
    const PREVIEW_STYLE_ID = 'invoicePrintPreviewStyles';
    const PREVIEW_MODAL_ID = 'invoicePrintPreviewModal';

    const TONES = {
        sales: { solid: '#059669', soft: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
        purchase: { solid: '#d97706', soft: '#fffbeb', border: '#fde68a', text: '#b45309' }
    };

    const DOCUMENT_STYLES = `
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        body {
            direction: rtl;
            color: #0f172a;
            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .inv-page { max-width: 210mm; margin: 0 auto; }
        .inv-header {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 18px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 65%, #0284c7 100%);
            color: #ffffff;
        }
        .inv-logo { width: 62px; height: 62px; flex-shrink: 0; }
        .inv-logo img { width: 62px; height: 62px; object-fit: cover; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.75); }
        .inv-heading { flex: 1; text-align: center; }
        .inv-title {
            display: inline-block;
            margin: 0 0 6px;
            padding: 3px 18px;
            border-radius: 999px;
            font-size: 18px;
            font-weight: 800;
            color: #ffffff;
        }
        .inv-company { font-size: 15px; font-weight: 800; color: #e0f2fe; }
        .inv-company-info { font-size: 11px; color: #cbd5e1; margin-top: 2px; }
        .inv-meta {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin: 10px 0 12px;
        }
        .inv-meta-box {
            padding: 8px 10px;
            border: 1px solid #dbeafe;
            border-top: 3px solid #1e3a8a;
            border-radius: 9px;
            background: #f8fafc;
        }
        .inv-meta-label { font-size: 10px; font-weight: 700; color: #64748b; }
        .inv-meta-value { font-size: 13px; font-weight: 800; color: #0f172a; word-break: break-word; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        .inv-items { border: 1px solid var(--tone-solid); border-radius: 10px; overflow: hidden; }
        .inv-items th {
            padding: 8px 6px;
            background: var(--tone-solid);
            color: #ffffff;
            font-size: 11.5px;
            font-weight: 800;
            border: 1px solid var(--tone-solid);
            text-align: center;
        }
        .inv-items td {
            padding: 7px 6px;
            border: 1px solid #e2e8f0;
            text-align: center;
            font-weight: 600;
        }
        .inv-items tbody tr:nth-child(even) td { background: #f8fafc; }
        .inv-items td.text { text-align: right; }
        .inv-items td.idx { color: #64748b; font-weight: 700; }
        .inv-items td.strong { font-weight: 800; }
        .inv-items td.amount { white-space: nowrap; font-weight: 800; color: var(--tone-text); }
        .inv-items tfoot td { background: var(--tone-soft); border-color: var(--tone-solid); color: var(--tone-text); font-weight: 800; font-size: 12.5px; }
        .inv-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
        .inv-panel { border: 1px solid #dbeafe; border-radius: 10px; overflow: hidden; }
        .inv-panel-title { padding: 7px 12px; background: #1e3a8a; color: #ffffff; font-size: 12px; font-weight: 800; }
        .inv-panel table td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
        .inv-panel table tr:last-child td { border-bottom: none; }
        .inv-panel table td.value { text-align: left; white-space: nowrap; font-weight: 800; }
        .inv-panel tr.net td { background: #eef2ff; color: #1e3a8a; font-size: 13.5px; }
        .inv-panel tr.paid td.value { color: #047857; }
        .inv-panel tr.discount td.value { color: #b91c1c; }
        .inv-panel tr.remaining td { background: #fffbeb; }
        .inv-panel tr.remaining td.value { color: #b45309; }
        .bal-positive { color: #047857 !important; }
        .bal-negative { color: #b91c1c !important; }
        .bal-zero { color: #334155 !important; }
        .inv-notes { margin-top: 12px; padding: 9px 12px; border: 1px dashed #94a3b8; border-radius: 9px; background: #f8fafc; break-inside: avoid; }
        .inv-notes b { color: #1e3a8a; }
        .inv-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 28px; break-inside: avoid; }
        .inv-signature { text-align: center; font-weight: 700; color: #334155; }
        .inv-signature span { display: block; margin-top: 30px; border-top: 1px solid #94a3b8; }
        .inv-footer { margin-top: 18px; padding-top: 8px; border-top: 2px solid #1e3a8a; text-align: center; font-size: 11px; color: #475569; font-weight: 700; }
    `;

    const PREVIEW_STYLES = `
        .ipd-overlay { position: fixed; inset: 0; z-index: 10000; display: none; align-items: center; justify-content: center; padding: 18px; background: rgba(15, 23, 42, 0.72); }
        .ipd-overlay.is-open { display: flex; }
        .ipd-panel { width: min(1000px, 100%); height: min(94vh, 980px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--card-border); border-radius: var(--radius-lg, 14px); background: var(--card-bg); box-shadow: var(--elevation-lg, 0 20px 60px rgba(0, 0, 0, 0.3)); }
        .ipd-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid var(--card-border); }
        .ipd-title { margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-color); }
        .ipd-status { min-height: 20px; margin: 4px 0 0; color: var(--text-secondary, var(--text-muted)); font-size: 0.9rem; }
        .ipd-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ipd-picker { display: none; grid-template-columns: minmax(120px, auto) minmax(240px, 420px); align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--card-border); }
        .ipd-picker label { color: var(--text-secondary, var(--text-muted)); font-weight: 700; }
        .ipd-body { flex: 1; overflow: auto; padding: 24px; background: rgba(148, 163, 184, 0.16); }
        .ipd-sheet { width: 210mm; max-width: 100%; margin: 0 auto; padding: 10mm; background: #ffffff; box-shadow: 0 18px 55px rgba(15, 23, 42, 0.28); }
        .ipd-frame { display: block; width: 100%; min-height: 250mm; border: 0; background: #ffffff; }
        @media (max-width: 768px) {
            .ipd-overlay { padding: 0; }
            .ipd-panel { height: 100vh; border-radius: 0; }
            .ipd-header { flex-direction: column; align-items: flex-start; }
            .ipd-actions { width: 100%; }
            .ipd-actions .btn { flex: 1; }
            .ipd-picker { grid-template-columns: 1fr; }
            .ipd-body { padding: 14px; }
        }
    `;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatMoney(value) {
        return `${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
    }

    function formatQty(value) {
        return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    }

    function resolveAssetUrl(relativePath) {
        try {
            return new URL(relativePath, window.location.href).href;
        } catch (_) {
            return relativePath;
        }
    }

    function describeBalance(value) {
        const amount = Number(value) || 0;
        if (amount > 0) return { cls: 'bal-positive', text: `${formatMoney(amount)} لينا (مدين)` };
        if (amount < 0) return { cls: 'bal-negative', text: `${formatMoney(Math.abs(amount))} علينا (دائن)` };
        return { cls: 'bal-zero', text: formatMoney(0) };
    }

    function buildPanelRows(rows) {
        return rows
            .filter(Boolean)
            .map((row) => `
                <tr class="${escapeHtml(row.className || '')}">
                    <td>${escapeHtml(row.label)}</td>
                    <td class="value ${escapeHtml(row.valueClass || '')}">${escapeHtml(row.value)}</td>
                </tr>
            `).join('');
    }

    function buildInvoiceHtml(data) {
        const tone = TONES[data.tone] || TONES.sales;
        const company = data.company || {};
        const companyInfo = [company.address, company.phone].filter(Boolean).join(' | ');
        const logo = company.logo ? `<img src="${escapeHtml(company.logo)}" alt="logo">` : '';
        const columns = Array.isArray(data.columns) ? data.columns : [];
        const rows = Array.isArray(data.rows) ? data.rows : [];

        const headHtml = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
        const bodyHtml = rows.map((cells) => `
            <tr>${cells.map((cell) => `<td class="${escapeHtml(cell.className || '')}">${escapeHtml(cell.text)}</td>`).join('')}</tr>
        `).join('');
        const footHtml = data.itemsTotal !== undefined
            ? `<tfoot><tr><td colspan="${Math.max(columns.length - 1, 1)}">إجمالي الأصناف</td><td>${escapeHtml(formatMoney(data.itemsTotal))}</td></tr></tfoot>`
            : '';

        const metaBoxes = (Array.isArray(data.meta) ? data.meta : [])
            .filter((entry) => entry && entry.value !== undefined && entry.value !== null && String(entry.value) !== '')
            .map((entry) => `
                <div class="inv-meta-box">
                    <div class="inv-meta-label">${escapeHtml(entry.label)}</div>
                    <div class="inv-meta-value">${escapeHtml(entry.value)}</div>
                </div>
            `).join('');

        const totalsPanel = `
            <div class="inv-panel">
                <div class="inv-panel-title">ملخص الفاتورة</div>
                <table>${buildPanelRows(data.totals || [])}</table>
            </div>
        `;

        const balanceRows = data.balances
            ? [
                { label: data.balances.previousLabel, value: describeBalance(data.balances.previous).text, valueClass: describeBalance(data.balances.previous).cls },
                { label: data.balances.currentLabel, value: describeBalance(data.balances.current).text, valueClass: describeBalance(data.balances.current).cls, className: 'net' }
            ]
            : [];
        const balancePanel = data.balances
            ? `
                <div class="inv-panel">
                    <div class="inv-panel-title">${escapeHtml(data.balances.title)}</div>
                    <table>${buildPanelRows(balanceRows)}</table>
                </div>
            `
            : '<div></div>';

        const notesHtml = data.notes && String(data.notes).trim()
            ? `<div class="inv-notes"><b>ملاحظات:</b> ${escapeHtml(data.notes)}</div>`
            : '';

        const footerHtml = data.footerText
            ? `<div class="inv-footer">${escapeHtml(data.footerText)}</div>`
            : '';

        return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(`${data.title || ''} ${data.invoiceNumber || ''}`.trim())}</title>
<link rel="stylesheet" href="${resolveAssetUrl('../../assets/vendor/fontawesome/css/all.min.css')}">
<style>${DOCUMENT_STYLES}</style>
</head>
<body style="--tone-solid:${tone.solid};--tone-soft:${tone.soft};--tone-border:${tone.border};--tone-text:${tone.text};">
    <div class="inv-page">
        <div class="inv-header">
            <div class="inv-logo">${logo}</div>
            <div class="inv-heading">
                <div class="inv-title" style="background:${tone.solid};">${escapeHtml(data.title || '')}</div>
                <div class="inv-company">${escapeHtml(company.name || '')}</div>
                <div class="inv-company-info">${escapeHtml(companyInfo)}</div>
            </div>
            <div class="inv-logo"></div>
        </div>
        <div class="inv-meta">${metaBoxes}</div>
        <table class="inv-items">
            <thead><tr>${headHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
            ${footHtml}
        </table>
        <div class="inv-bottom">
            ${totalsPanel}
            ${balancePanel}
        </div>
        ${notesHtml}
        <div class="inv-signatures">
            <div class="inv-signature">توقيع المستلم<span></span></div>
            <div class="inv-signature">توقيع المحاسب<span></span></div>
        </div>
        ${footerHtml}
    </div>
</body>
</html>`;
    }

    async function loadCompanyInfo() {
        try {
            const settings = (await window.electronAPI.getSettings()) || {};
            return {
                name: settings.companyName || settings.company_name || '',
                phone: settings.companyPhone || settings.company_phone || '',
                address: settings.companyAddress || '',
                logo: settings.profileImage || '',
                footerText: settings.invoiceFooter || settings.invoice_notes || 'شكراً لتعاملكم معنا'
            };
        } catch (_) {
            return { name: '', phone: '', address: '', logo: '', footerText: 'شكراً لتعاملكم معنا' };
        }
    }

    function ensurePreviewStyles() {
        if (document.getElementById(PREVIEW_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = PREVIEW_STYLE_ID;
        style.textContent = PREVIEW_STYLES;
        document.head.appendChild(style);
    }

    function ensurePreviewModal() {
        let modal = document.getElementById(PREVIEW_MODAL_ID);
        if (modal) return modal;
        ensurePreviewStyles();
        modal = document.createElement('div');
        modal.id = PREVIEW_MODAL_ID;
        modal.className = 'ipd-overlay';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="ipd-panel" role="dialog" aria-modal="true" aria-label="معاينة الفاتورة">
                <div class="ipd-header">
                    <div>
                        <h3 class="ipd-title">معاينة الفاتورة</h3>
                        <p class="ipd-status"></p>
                    </div>
                    <div class="ipd-actions">
                        <button class="btn btn-outline ipd-change" type="button" style="display: none;">تغيير الطابعة</button>
                        <button class="btn btn-success ipd-confirm" type="button">طباعة</button>
                        <button class="btn btn-outline ipd-close" type="button">إغلاق</button>
                    </div>
                </div>
                <div class="ipd-picker">
                    <label>اختر الطابعة</label>
                    <select class="form-control ipd-select"></select>
                </div>
                <div class="ipd-body">
                    <div class="ipd-sheet"><iframe class="ipd-frame" title="معاينة الفاتورة"></iframe></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('is-open')) {
                modal.__ipdController?.close();
            }
        });
        return modal;
    }

    function createPreviewController({ storageKey, onPrinted }) {
        let currentHtml = '';
        let modal = null;

        const notify = (message, type) => {
            if (window.showToast) window.showToast(message, type);
        };

        const getSavedPrinter = () => {
            try {
                return localStorage.getItem(storageKey) || '';
            } catch (_) {
                return '';
            }
        };

        const savePrinter = (name) => {
            try {
                if (name) localStorage.setItem(storageKey, name);
            } catch (_) {}
        };

        const clearPrinter = () => {
            try {
                localStorage.removeItem(storageKey);
            } catch (_) {}
        };

        const setOpen = (open) => {
            if (!modal) return;
            modal.classList.toggle('is-open', open);
            modal.setAttribute('aria-hidden', open ? 'false' : 'true');
            document.body.style.overflow = open ? 'hidden' : '';
        };

        const renderFrame = () => {
            const frame = modal.querySelector('.ipd-frame');
            if (!frame) return;
            frame.onload = () => {
                try {
                    const doc = frame.contentDocument;
                    const height = doc ? Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0) : 0;
                    if (height > 0) frame.style.height = `${height + 8}px`;
                } catch (_) {}
            };
            frame.srcdoc = currentHtml;
        };

        const loadPrinters = async ({ forceChoose = false } = {}) => {
            const picker = modal.querySelector('.ipd-picker');
            const select = modal.querySelector('.ipd-select');
            const status = modal.querySelector('.ipd-status');
            const changeBtn = modal.querySelector('.ipd-change');
            const savedPrinter = getSavedPrinter();

            let printers = [];
            try {
                if (window.electronAPI && typeof window.electronAPI.getPrinters === 'function') {
                    printers = await window.electronAPI.getPrinters();
                }
            } catch (_) {
                printers = [];
            }

            const list = Array.isArray(printers) ? printers : [];
            select.innerHTML = '';
            list.forEach((printer) => {
                const name = printer.name || printer.displayName || '';
                if (!name) return;
                const option = document.createElement('option');
                option.value = name;
                option.textContent = printer.displayName || name;
                if (printer.isDefault) option.dataset.defaultPrinter = '1';
                select.appendChild(option);
            });

            const hasSaved = savedPrinter && list.some((printer) => (printer.name || printer.displayName || '') === savedPrinter);
            if (savedPrinter && !hasSaved && list.length > 0) clearPrinter();

            if (hasSaved && !forceChoose) {
                picker.style.display = 'none';
                changeBtn.style.display = '';
                const selected = list.find((printer) => (printer.name || printer.displayName || '') === savedPrinter);
                status.textContent = `الطابعة الحالية: ${selected?.displayName || savedPrinter}`;
                return;
            }

            picker.style.display = list.length > 0 ? 'grid' : 'none';
            changeBtn.style.display = 'none';
            status.textContent = list.length > 0
                ? 'اختر الطابعة أول مرة، وسيتم استخدامها تلقائياً بعد ذلك.'
                : 'لم يتم العثور على طابعات. سيتم استخدام نافذة الطباعة العادية.';

            const defaultOption = Array.from(select.options).find((option) => option.dataset.defaultPrinter === '1');
            if (defaultOption) select.value = defaultOption.value;
        };

        const close = () => setOpen(false);

        const changePrinter = async () => {
            clearPrinter();
            await loadPrinters({ forceChoose: true });
        };

        const confirm = async () => {
            const printBtn = modal.querySelector('.ipd-confirm');
            const select = modal.querySelector('.ipd-select');
            const printerName = getSavedPrinter() || select?.value || '';

            printBtn.disabled = true;
            printBtn.textContent = 'جاري الطباعة...';
            try {
                const result = await window.electronAPI.printInvoiceDocument({
                    html: currentHtml,
                    silent: Boolean(printerName),
                    deviceName: printerName
                });
                if (result && result.success) {
                    if (printerName) savePrinter(printerName);
                    close();
                    notify('تم إرسال الفاتورة للطابعة', 'success');
                    if (typeof onPrinted === 'function') onPrinted();
                    return;
                }
                if (result && !result.canceled) {
                    notify(result.error || 'تعذر طباعة الفاتورة', 'error');
                }
            } finally {
                printBtn.disabled = false;
                printBtn.textContent = 'طباعة';
            }
        };

        const bindModal = () => {
            if (modal.dataset.bound === '1') return;
            modal.dataset.bound = '1';
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    close();
                    return;
                }
                const button = event.target.closest('button');
                if (!button || !modal.contains(button)) return;
                if (button.classList.contains('ipd-close')) close();
                else if (button.classList.contains('ipd-change')) modal.__ipdController?.changePrinter();
                else if (button.classList.contains('ipd-confirm')) modal.__ipdController?.confirm();
            });
        };

        const controller = {
            async open(html) {
                currentHtml = String(html || '');
                modal = ensurePreviewModal();
                modal.__ipdController = controller;
                bindModal();
                renderFrame();
                setOpen(true);
                await loadPrinters({ forceChoose: !getSavedPrinter() });
            },
            close,
            changePrinter,
            confirm
        };

        return controller;
    }

    window.invoicePrintDocument = {
        buildInvoiceHtml,
        createPreviewController,
        loadCompanyInfo,
        formatMoney,
        formatQty
    };
})();
