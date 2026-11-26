(function () {
    const TYPE_META = {
        sales: { key: 'customerReports.salesBadge', fallback: 'مبيعات', icon: 'fa-shopping-cart', tone: 'sales' },
        local_sale: { key: 'customerReports.localSalesBadge', fallback: 'مبيعات محلية', icon: 'fa-store', tone: 'sales' },
        purchase: { key: 'customerReports.purchaseBadge', fallback: 'مشتريات', icon: 'fa-shopping-bag', tone: 'purchase' },
        payment_in: { key: 'customerReports.receiptBadge', fallback: 'تحصيل', icon: 'fa-hand-holding-usd', tone: 'receipt' },
        payment_out: { key: 'customerReports.paymentBadge', fallback: 'سداد', icon: 'fa-money-bill-wave', tone: 'payment' }
    };

    const DOCUMENT_STYLES = `
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        body {
            direction: rtl;
            color: #0f172a;
            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.45;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .doc-header {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 10px;
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 65%, #0284c7 100%);
            color: #ffffff;
        }
        .doc-logo { width: 58px; height: 58px; flex-shrink: 0; }
        .doc-logo img { width: 58px; height: 58px; object-fit: cover; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.75); }
        .doc-heading { flex: 1; text-align: center; }
        .doc-heading h1 { margin: 0 0 3px; font-size: 18px; font-weight: 800; color: #ffffff; }
        .doc-company { font-size: 13px; font-weight: 800; color: #e0f2fe; }
        .doc-company-info { font-size: 10px; color: #cbd5e1; margin-top: 2px; }
        .doc-meta {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 20px;
            margin-top: 8px;
            padding: 6px 12px;
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.18);
            font-size: 10.5px;
            color: #ffffff;
        }
        .doc-meta b { color: #93c5fd; font-weight: 700; margin-inline-end: 4px; }
        .cards { display: grid; gap: 8px; margin-bottom: 10px; }
        .cards.cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        .card {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            border-top-width: 3px;
            border-radius: 9px;
            background: #f8fafc;
        }
        .card-icon { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
        .card-label { font-size: 9.5px; font-weight: 700; color: #475569; }
        .card-value { font-size: 12px; font-weight: 800; }
        .card-badge { display: inline-block; margin-top: 2px; padding: 1px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 800; }
        .card-badge.bal-positive { background: #d1fae5; }
        .card-badge.bal-negative { background: #fee2e2; }
        .tone-sales { background: #f0fdf4; border-color: #bbf7d0; border-top-color: #059669; }
        .tone-sales .card-icon { background: #d1fae5; color: #047857; }
        .tone-sales .card-value { color: #047857; }
        .tone-purchase { background: #fffbeb; border-color: #fde68a; border-top-color: #d97706; }
        .tone-purchase .card-icon { background: #fef3c7; color: #b45309; }
        .tone-purchase .card-value { color: #b45309; }
        .tone-receipt { background: #eff6ff; border-color: #bfdbfe; border-top-color: #2563eb; }
        .tone-receipt .card-icon { background: #dbeafe; color: #1d4ed8; }
        .tone-receipt .card-value { color: #1d4ed8; }
        .tone-payment { background: #fef2f2; border-color: #fecaca; border-top-color: #dc2626; }
        .tone-payment .card-icon { background: #fee2e2; color: #b91c1c; }
        .tone-payment .card-value { color: #b91c1c; }
        .tone-balance { background: #eef2ff; border-color: #c7d2fe; border-top-color: #1e3a8a; }
        .tone-balance .card-icon { background: #e0e7ff; color: #3730a3; }
        .section-title {
            display: flex;
            align-items: center;
            gap: 7px;
            margin: 0;
            padding: 7px 12px;
            border-radius: 8px 8px 0 0;
            font-size: 12px;
            font-weight: 800;
            color: #ffffff;
            background: #1e3a8a;
            break-after: avoid;
            page-break-after: avoid;
        }
        .section-title.tone-sales-solid { background: #059669; }
        .section-title.tone-purchase-solid { background: #d97706; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tfoot { display: table-row-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        .data-table { border: 1px solid #1e40af; }
        .data-table th {
            padding: 7px 6px;
            background: #1e3a8a;
            color: #ffffff;
            font-weight: 800;
            font-size: 10.5px;
            border: 1px solid #1e40af;
            text-align: center;
        }
        .data-table td {
            padding: 6px;
            border: 1px solid #dbeafe;
            text-align: center;
            vertical-align: middle;
            font-weight: 600;
        }
        .data-table tbody tr.zebra td { background: #f8fafc; }
        .data-table td.text-cell { text-align: right; word-break: break-word; }
        .data-table td.idx-cell { color: #64748b; font-weight: 700; }
        .data-table td.date-cell { white-space: nowrap; }
        .data-table td.amount { white-space: nowrap; font-weight: 700; }
        .type-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; white-space: nowrap; }
        .type-pill.tone-sales { background: #d1fae5; color: #047857; }
        .type-pill.tone-purchase { background: #fef3c7; color: #b45309; }
        .type-pill.tone-receipt { background: #dbeafe; color: #1d4ed8; }
        .type-pill.tone-payment { background: #fee2e2; color: #b91c1c; }
        .doc-pill { display: inline-block; padding: 1px 7px; border-radius: 6px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 800; font-size: 10px; }
        .bal-positive { color: #047857; font-weight: 800; }
        .bal-negative { color: #b91c1c; font-weight: 800; }
        .bal-zero { color: #334155; font-weight: 800; }
        .debit { color: #047857; font-weight: 800; }
        .credit { color: #b91c1c; font-weight: 800; }
        .opening-row td { background: linear-gradient(135deg, #dbeafe, #ede9fe); font-weight: 800; color: #1e1b4b; }
        .row-items > td { padding: 3px 10px 7px; background: #f8fafc; }
        .items-table { border: 1px solid #93c5fd; font-size: 9.5px; }
        .items-table th { background: #e0f2fe; color: #0f172a; font-weight: 800; padding: 4px; border: 1px solid #93c5fd; text-align: center; }
        .items-table td { background: #ffffff; padding: 4px; border: 1px solid #dbeafe; text-align: center; }
        .totals-row td { background: #0f172a; color: #ffffff; font-weight: 800; font-size: 11.5px; border-color: #1e293b; }
        .totals-row td.debit { color: #6ee7b7; }
        .totals-row td.credit { color: #fca5a5; }
        .totals-row td.closing { color: #fcd34d; background: #1e293b; }
        .closing-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
            padding: 8px 14px;
            border-radius: 8px;
            border-top: 2px solid #1e3a8a;
            background: linear-gradient(90deg, #eef2ff, #f8fafc);
            break-inside: avoid;
        }
        .closing-bar .label { font-size: 11.5px; font-weight: 800; color: #1e3a8a; }
        .closing-bar .value { font-size: 13.5px; }
        .final-summary { margin-top: 10px; break-inside: avoid; page-break-inside: avoid; }
        .items-section { margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
        .items-section .data-table { border-top: none; }
        .items-section.tone-sales-section .data-table, .items-section.tone-sales-section .data-table th { border-color: #059669; }
        .items-section.tone-sales-section .data-table th { background: #059669; }
        .items-section.tone-sales-section .section-total td { background: #ecfdf5; color: #047857; border-color: #059669; }
        .items-section.tone-purchase-section .data-table, .items-section.tone-purchase-section .data-table th { border-color: #d97706; }
        .items-section.tone-purchase-section .data-table th { background: #d97706; }
        .items-section.tone-purchase-section .section-total td { background: #fffbeb; color: #b45309; border-color: #d97706; }
        .section-total td { font-weight: 800; font-size: 11.5px; }
        .empty-cell { padding: 12px !important; color: #64748b; font-weight: 700; }
    `;

    function resolveAssetUrl(relativePath) {
        try {
            return new URL(relativePath, window.location.href).href;
        } catch (_) {
            return relativePath;
        }
    }

    function formatQty(value) {
        return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    }

    function describeBalance(value, ctx) {
        const amount = Number(value) || 0;
        if (amount > 0) {
            return { cls: 'bal-positive', label: ctx.t('customerReports.balanceForUs', 'لينا (مدين)'), text: ctx.formatCurrency(amount) };
        }
        if (amount < 0) {
            return { cls: 'bal-negative', label: ctx.t('customerReports.balanceAgainstUs', 'علينا (دائن)'), text: ctx.formatCurrency(Math.abs(amount)) };
        }
        return { cls: 'bal-zero', label: '', text: ctx.formatCurrency(0) };
    }

    function balanceHtml(value, ctx) {
        const info = describeBalance(value, ctx);
        return `<span class="${info.cls}">${info.text}${info.label ? ` ${info.label}` : ''}</span>`;
    }

    function buildPeriodText(startDate, endDate, ctx) {
        if (startDate && endDate) return `${startDate}  إلى  ${endDate}`;
        if (startDate) return `من ${startDate}`;
        if (endDate) return `حتى ${endDate}`;
        return ctx.t('customerReports.allPeriods', 'كل الفترات');
    }

    async function loadCompanySettings() {
        try {
            return (await window.electronAPI.getSettings()) || {};
        } catch (_) {
            return {};
        }
    }

    function buildHeader({ title, settings, customerName, periodText }, ctx) {
        const companyInfo = [settings.companyAddress, settings.companyPhone].filter(Boolean).join(' | ');
        const logo = settings.profileImage
            ? `<img src="${ctx.escapeHtml(settings.profileImage)}" alt="logo">`
            : '';
        return `
            <div class="doc-header">
                <div class="doc-logo">${logo}</div>
                <div class="doc-heading">
                    <h1>${ctx.escapeHtml(title)}</h1>
                    <div class="doc-company">${ctx.escapeHtml(settings.companyName || '')}</div>
                    <div class="doc-company-info">${ctx.escapeHtml(companyInfo)}</div>
                    <div class="doc-meta">
                        <span><b>${ctx.t('customerReports.printCustomer', 'العميل')}:</b>${ctx.escapeHtml(customerName)}</span>
                        <span><b>${ctx.t('customerReports.printPeriod', 'الفترة')}:</b>${ctx.escapeHtml(periodText)}</span>
                        <span><b>${ctx.t('customerReports.printDate', 'تاريخ الطباعة')}:</b>${ctx.escapeHtml(new Date().toLocaleDateString('ar-EG'))}</span>
                    </div>
                </div>
                <div class="doc-logo"></div>
            </div>
        `;
    }

    function buildDocument(title, bodyHtml, ctx) {
        return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${ctx.escapeHtml(title)}</title>
<link rel="stylesheet" href="${resolveAssetUrl('../../assets/vendor/fontawesome/css/all.min.css')}">
<style>${DOCUMENT_STYLES}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
    }

    function typePillHtml(type, ctx) {
        const meta = TYPE_META[type];
        if (!meta) return ctx.escapeHtml(type || '—');
        return `<span class="type-pill tone-${meta.tone}"><i class="fas ${meta.icon}"></i> ${ctx.t(meta.key, meta.fallback)}</span>`;
    }

    function buildItemsTable(type, details, ctx) {
        if (!Array.isArray(details) || !details.length) return '';
        const isPurchase = type === 'purchase';
        const qtyHeaders = isPurchase
            ? `<th>${ctx.t('customerReports.itemHeaders.rawQty', 'الكمية الخام')}</th>
               <th>${ctx.t('customerReports.itemHeaders.net1Qty', 'صافي 1%')}</th>
               <th>${ctx.t('customerReports.itemHeaders.ratePercent', 'المعدل %')}</th>
               <th>${ctx.t('customerReports.itemHeaders.netQty', 'الكمية النهائية')}</th>`
            : `<th>${ctx.t('customerReports.itemHeaders.qty', 'الكمية')}</th>`;

        const rows = details.map((itm, i) => {
            const rawQty = Number(itm.raw_quantity);
            const rawQtyValue = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : itm.quantity;
            const net1Qty = Number(itm.net1_quantity);
            const net1Value = Number.isFinite(net1Qty) && net1Qty > 0
                ? net1Qty
                : Math.round(((Number(rawQtyValue) || 0) * 0.99 + Number.EPSILON) * 100) / 100;
            const rate = Number(itm.rate_percent);
            const rateText = Number.isFinite(rate) && rate > 0 ? `${rate}%` : '—';
            const qtyCells = isPurchase
                ? `<td>${formatQty(rawQtyValue)}</td><td>${formatQty(net1Value)}</td><td>${rateText}</td><td><b>${formatQty(itm.quantity)}</b></td>`
                : `<td><b>${formatQty(itm.quantity)}</b></td>`;
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td>${ctx.escapeHtml(itm.item_name || '—')}</td>
                    <td>${ctx.escapeHtml(itm.unit_name || '—')}</td>
                    ${qtyCells}
                    <td>${ctx.formatCurrency(itm.price || 0)}</td>
                    <td><b>${ctx.formatCurrency(itm.total_price || 0)}</b></td>
                </tr>
            `;
        }).join('');

        return `
            <table class="items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>${ctx.t('customerReports.itemHeaders.name', 'الصنف')}</th>
                        <th>${ctx.t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                        ${qtyHeaders}
                        <th>${ctx.t('customerReports.itemHeaders.price', 'السعر')}</th>
                        <th>${ctx.t('customerReports.itemHeaders.total', 'الإجمالي')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    async function loadItemDetailsMap(transactions) {
        const targets = transactions.filter((item) => ['sales', 'purchase', 'local_sale'].includes(item.type));
        const entries = await Promise.all(targets.map(async (item) => {
            try {
                const result = await window.electronAPI.getStatementItemDetails({ type: item.type, id: item.id });
                return [`${item.type}:${item.id}`, result && result.success && Array.isArray(result.details) ? result.details : []];
            } catch (_) {
                return [`${item.type}:${item.id}`, []];
            }
        }));
        return new Map(entries);
    }

    function buildDetailedBody({ transactions, totals, settings, customerName, periodText, itemsMap }, ctx) {
        const closing = describeBalance(totals.closingBalance, ctx);
        const cards = `
            <div class="cards cols-5">
                <div class="card tone-sales">
                    <div class="card-icon"><i class="fas fa-shopping-cart"></i></div>
                    <div><div class="card-label">${ctx.t('customerReports.totalSales', 'إجمالي المبيعات')}</div><div class="card-value">${ctx.formatCurrency(totals.totalSales)}</div></div>
                </div>
                <div class="card tone-purchase">
                    <div class="card-icon"><i class="fas fa-shopping-bag"></i></div>
                    <div><div class="card-label">${ctx.t('customerReports.totalPurchases', 'إجمالي المشتريات')}</div><div class="card-value">${ctx.formatCurrency(totals.totalPurchases)}</div></div>
                </div>
                <div class="card tone-receipt">
                    <div class="card-icon"><i class="fas fa-hand-holding-usd"></i></div>
                    <div><div class="card-label">${ctx.t('customerReports.totalReceipts', 'إجمالي التحصيلات')}</div><div class="card-value">${ctx.formatCurrency(totals.totalPaymentsIn)}</div></div>
                </div>
                <div class="card tone-payment">
                    <div class="card-icon"><i class="fas fa-money-bill-wave"></i></div>
                    <div><div class="card-label">${ctx.t('customerReports.totalPaymentsOut', 'إجمالي السداد')}</div><div class="card-value">${ctx.formatCurrency(totals.totalPaymentsOut)}</div></div>
                </div>
                <div class="card tone-balance">
                    <div class="card-icon"><i class="fas fa-coins"></i></div>
                    <div>
                        <div class="card-label">${ctx.t('customerReports.closingBalance', 'الرصيد الختامي')}</div>
                        <div class="card-value ${closing.cls}">${closing.text}</div>
                        ${closing.label ? `<span class="card-badge ${closing.cls}">${closing.label}</span>` : ''}
                    </div>
                </div>
            </div>
        `;

        const openingBalance = Number(totals.openingBalance) || 0;
        const openingRow = openingBalance !== 0
            ? `<tr class="opening-row">
                    <td colspan="5" class="text-cell"><i class="fas fa-flag"></i> ${ctx.t('customerReports.openingBalance', 'رصيد أول المدة')}</td>
                    <td></td><td></td><td></td>
                    <td class="amount">${balanceHtml(openingBalance, ctx)}</td>
               </tr>`
            : '';

        const rows = transactions.map((item, idx) => {
            const isInvoice = ['sales', 'local_sale', 'purchase'].includes(item.type);
            const totalInvoice = isInvoice ? ctx.formatCurrency(item.total_amount) : '—';
            const paid = (isInvoice || item.type === 'payment_in' || item.type === 'payment_out') ? ctx.formatCurrency(item.paid_amount) : '—';
            const remaining = isInvoice ? ctx.formatCurrency(item.remaining_amount) : '—';
            const zebra = idx % 2 === 1 ? ' zebra' : '';
            const details = itemsMap.get(`${item.type}:${item.id}`) || [];
            const itemsRow = details.length
                ? `<tr class="row-items${zebra}"><td colspan="9">${buildItemsTable(item.type, details, ctx)}</td></tr>`
                : '';
            return `
                <tr class="row-main${zebra}">
                    <td class="idx-cell">${idx + 1}</td>
                    <td class="date-cell">${ctx.escapeHtml(item.trans_date || '')}</td>
                    <td>${typePillHtml(item.type, ctx)}</td>
                    <td><span class="doc-pill">${ctx.escapeHtml(item.doc_number || '—')}</span></td>
                    <td class="text-cell">${ctx.escapeHtml(item.notes || '—')}</td>
                    <td class="amount">${totalInvoice}</td>
                    <td class="amount">${paid}</td>
                    <td class="amount">${remaining}</td>
                    <td class="amount">${balanceHtml(item.running_balance, ctx)}</td>
                </tr>
                ${itemsRow}
            `;
        }).join('');

        const emptyRow = !transactions.length && openingBalance === 0
            ? `<tr><td colspan="9" class="empty-cell">${ctx.t('customerReports.noTransactions', 'لا توجد عمليات لهذا العميل')}</td></tr>`
            : '';

        const totalDebit = (Number(totals.totalSales) || 0) + (Number(totals.totalPaymentsOut) || 0);
        const totalCredit = (Number(totals.totalPurchases) || 0) + (Number(totals.totalPaymentsIn) || 0);

        return `
            ${buildHeader({ title: ctx.t('customerReports.detailedStatementTitle', 'كشف حساب تفصيلي'), settings, customerName, periodText }, ctx)}
            ${cards}
            <div class="section-title"><i class="fas fa-list-alt"></i> ${ctx.t('customerReports.transactionLog', 'سجل العمليات')}</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>${ctx.t('customerReports.tableHeaders.date', 'التاريخ')}</th>
                        <th>${ctx.t('customerReports.tableHeaders.type', 'النوع')}</th>
                        <th>${ctx.t('customerReports.tableHeaders.docNumber', 'رقم المستند')}</th>
                        <th>${ctx.t('customerReports.tableHeaders.description', 'البيان')}</th>
                        <th>${ctx.t('customerReports.tableHeaders.totalInvoice', 'إجمالي الفاتورة')}</th>
                        <th>${ctx.t('customerReports.tableHeaders.paid', 'المدفوع')}</th>
                        <th>${ctx.t('customerReports.tableHeaders.remaining', 'المتبقي')}</th>
                        <th>${ctx.t('customerReports.tableHeaders.runningBalance', 'الرصيد')}</th>
                    </tr>
                </thead>
                <tbody>${openingRow}${rows}${emptyRow}</tbody>
            </table>
            <div class="closing-bar">
                <span class="label"><i class="fas fa-coins"></i> ${ctx.t('customerReports.closingBalance', 'الرصيد الختامي')}</span>
                <span class="value">${balanceHtml(totals.closingBalance, ctx)}</span>
            </div>
            <div class="final-summary">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>${ctx.t('customerReports.summaryDebit', 'إجمالي الديون لينا (مدين)')}</th>
                            <th>${ctx.t('customerReports.summaryCredit', 'إجمالي المستحقات علينا (دائن)')}</th>
                            <th>${ctx.t('customerReports.summaryNet', 'صافي الحركة')}</th>
                            <th>${ctx.t('customerReports.summaryOpening', 'رصيد أول المدة')}</th>
                            <th>${ctx.t('customerReports.summaryClosing', 'الرصيد الختامي')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="amount debit">${ctx.formatCurrency(totalDebit)}</td>
                            <td class="amount credit">${ctx.formatCurrency(totalCredit)}</td>
                            <td class="amount">${balanceHtml(totalDebit - totalCredit, ctx)}</td>
                            <td class="amount">${balanceHtml(openingBalance, ctx)}</td>
                            <td class="amount">${balanceHtml(totals.closingBalance, ctx)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    function buildSummaryItemsSection({ title, icon, tone, items, isPurchase }, ctx) {
        const colCount = isPurchase ? 9 : 6;
        const qtyHeaders = isPurchase
            ? `<th>${ctx.t('customerReports.itemHeaders.rawQty', 'الكمية الخام')}</th>
               <th>${ctx.t('customerReports.itemHeaders.net1Qty', 'صافي 1%')}</th>
               <th>${ctx.t('customerReports.itemHeaders.ratePercent', 'المعدل %')}</th>
               <th>${ctx.t('customerReports.itemHeaders.netQty', 'الكمية النهائية')}</th>`
            : `<th>${ctx.t('customerReports.summaryItemQty', 'إجمالي الكمية')}</th>`;

        const list = Array.isArray(items) ? items : [];
        const sectionTotal = list.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
        const rows = list.map((item, i) => {
            const rateText = item.rate_display
                ? item.rate_display
                : (Number(item.rate_percent) > 0 ? `${Number(item.rate_percent)}%` : '—');
            const qtyCells = isPurchase
                ? `<td>${formatQty(item.total_raw_qty ?? item.total_qty)}</td>
                   <td>${formatQty(item.total_net1_qty ?? item.total_qty)}</td>
                   <td>${ctx.escapeHtml(String(rateText))}</td>
                   <td><b>${formatQty(item.total_qty)}</b></td>`
                : `<td><b>${formatQty(item.total_qty)}</b></td>`;
            return `
                <tr class="${i % 2 === 1 ? 'zebra' : ''}">
                    <td class="idx-cell">${i + 1}</td>
                    <td class="text-cell">${ctx.escapeHtml(item.item_name || '—')}</td>
                    <td>${ctx.escapeHtml(item.unit_name || '—')}</td>
                    ${qtyCells}
                    <td class="amount">${ctx.formatCurrency(item.avg_price || 0)}</td>
                    <td class="amount">${ctx.formatCurrency(item.total_amount || 0)}</td>
                </tr>
            `;
        }).join('');

        const body = list.length
            ? `<tbody>${rows}</tbody>
               <tfoot>
                   <tr class="section-total">
                       <td colspan="${colCount - 1}">${ctx.t('customerReports.summaryTotals', 'الإجماليات')}</td>
                       <td class="amount">${ctx.formatCurrency(sectionTotal)}</td>
                   </tr>
               </tfoot>`
            : `<tbody><tr><td colspan="${colCount}" class="empty-cell">${ctx.t('customerReports.noDataMessage', 'لا توجد بيانات')}</td></tr></tbody>`;

        return `
            <div class="items-section ${tone}-section">
                <div class="section-title ${tone}-solid"><i class="fas ${icon}"></i> ${ctx.escapeHtml(title)}</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>${ctx.t('customerReports.itemHeaders.name', 'الصنف')}</th>
                            <th>${ctx.t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                            ${qtyHeaders}
                            <th>${ctx.t('customerReports.summaryItemAvgPrice', 'متوسط السعر')}</th>
                            <th>${ctx.t('customerReports.summaryItemTotal', 'الإجمالي')}</th>
                        </tr>
                    </thead>
                    ${body}
                </table>
            </div>
        `;
    }

    function buildSummaryBody({ transactions, totals, summary, settings, customerName, periodText }, ctx) {
        const openingBalance = Number(totals.openingBalance) || 0;
        const openingRow = openingBalance !== 0
            ? `<tr class="opening-row">
                    <td colspan="3">${ctx.t('customerReports.openingBalance', 'رصيد أول المدة')}</td>
                    <td class="amount">${balanceHtml(openingBalance, ctx)}</td>
               </tr>`
            : '';

        const rows = transactions.map((trans, idx) => {
            const debitValue = trans.type === 'payment_out'
                ? trans.paid_amount
                : (trans.type === 'sales' || trans.type === 'local_sale' ? trans.total_amount : null);
            const creditValue = trans.type === 'payment_in'
                ? trans.paid_amount
                : (trans.type === 'purchase' ? trans.total_amount : null);
            return `
                <tr class="${idx % 2 === 1 ? 'zebra' : ''}">
                    <td class="date-cell"><b>${ctx.escapeHtml(trans.trans_date || '')}</b><br>${typePillHtml(trans.type, ctx)}</td>
                    <td class="amount debit">${debitValue !== null ? ctx.formatCurrency(debitValue) : ''}</td>
                    <td class="amount credit">${creditValue !== null ? ctx.formatCurrency(creditValue) : ''}</td>
                    <td class="amount">${balanceHtml(trans.running_balance, ctx)}</td>
                </tr>
            `;
        }).join('');

        const emptyRow = !transactions.length && openingBalance === 0
            ? `<tr><td colspan="4" class="empty-cell">${ctx.t('customerReports.noTransactions', 'لا توجد عمليات لهذا العميل')}</td></tr>`
            : '';

        const totalDebit = (Number(totals.totalSales) || 0) + (Number(totals.totalPaymentsOut) || 0);
        const totalCredit = (Number(totals.totalPurchases) || 0) + (Number(totals.totalPaymentsIn) || 0);
        const closing = describeBalance(totals.closingBalance, ctx);

        return `
            ${buildHeader({ title: ctx.t('customerReports.summaryInvoiceTitle', 'فاتورة مجمعة'), settings, customerName, periodText }, ctx)}
            <table class="data-table">
                <thead>
                    <tr>
                        <th>${ctx.t('customerReports.summaryColDate', 'التاريخ / نوع الحركة')}</th>
                        <th>${ctx.t('customerReports.summaryColDebit', 'لينا (مدين)')}</th>
                        <th>${ctx.t('customerReports.summaryColCredit', 'علينا (دائن)')}</th>
                        <th>${ctx.t('customerReports.summaryColBalance', 'الرصيد')}</th>
                    </tr>
                </thead>
                <tbody>${openingRow}${rows}${emptyRow}</tbody>
                <tfoot>
                    <tr class="totals-row">
                        <td>${ctx.t('customerReports.summaryTotals', 'الإجماليات')}</td>
                        <td class="debit">${ctx.formatCurrency(totalDebit)}</td>
                        <td class="credit">${ctx.formatCurrency(totalCredit)}</td>
                        <td class="closing">${closing.text}${closing.label ? ` ${closing.label}` : ''}</td>
                    </tr>
                </tfoot>
            </table>
            ${buildSummaryItemsSection({
                title: ctx.t('customerReports.summaryItemsSales', 'أصناف المبيعات'),
                icon: 'fa-shopping-cart',
                tone: 'tone-sales',
                items: summary.salesItems,
                isPurchase: false
            }, ctx)}
            ${buildSummaryItemsSection({
                title: ctx.t('customerReports.summaryItemsPurchases', 'أصناف المشتريات'),
                icon: 'fa-shopping-bag',
                tone: 'tone-purchase',
                items: summary.purchaseItems,
                isPurchase: true
            }, ctx)}
        `;
    }

    function notifyResult(result, ctx) {
        if (!window.showToast || !result) return;
        if (result.success) {
            window.showToast(ctx.t('customerReports.pdfSaved', 'تم حفظ الملف بنجاح'), 'success');
        } else if (!result.canceled) {
            window.showToast(result.error || ctx.t('customerReports.pdfError', 'حدث خطأ أثناء الحفظ'), 'error');
        }
    }

    async function exportDetailed(ctx) {
        const { customerId, customerName, startDate, endDate } = ctx;
        const statement = await window.electronAPI.getCustomerDetailedStatement({ customerId, startDate, endDate });
        if (!statement || !statement.success) {
            if (window.showToast) window.showToast((statement && statement.error) || ctx.t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
            return;
        }

        const transactions = (Array.isArray(statement.transactions) ? statement.transactions : []).slice().reverse();
        const totals = statement.totals || {};
        const [settings, itemsMap] = await Promise.all([loadCompanySettings(), loadItemDetailsMap(transactions)]);
        const title = ctx.t('customerReports.detailedStatementTitle', 'كشف حساب تفصيلي');
        const body = buildDetailedBody({
            transactions,
            totals,
            settings,
            customerName,
            periodText: buildPeriodText(startDate, endDate, ctx),
            itemsMap
        }, ctx);

        const date = new Date().toISOString().split('T')[0];
        const result = await window.electronAPI.saveCustomerReportPdf({
            defaultName: `كشف_حساب_${customerName}_${date}.pdf`,
            html: buildDocument(`${title} - ${customerName}`, body, ctx)
        });
        notifyResult(result, ctx);
    }

    async function exportSummary(ctx) {
        const { customerId, customerName, startDate, endDate } = ctx;
        const [statement, summary, settings] = await Promise.all([
            window.electronAPI.getCustomerDetailedStatement({ customerId, startDate, endDate }),
            window.electronAPI.getCustomerSummaryStatement({ customerId, startDate, endDate }),
            loadCompanySettings()
        ]);

        if (!statement || !statement.success || !summary || !summary.success) {
            if (window.showToast) window.showToast(ctx.t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
            return;
        }

        const title = ctx.t('customerReports.summaryInvoiceTitle', 'فاتورة مجمعة');
        const body = buildSummaryBody({
            transactions: Array.isArray(statement.transactions) ? statement.transactions : [],
            totals: statement.totals || {},
            summary,
            settings,
            customerName,
            periodText: buildPeriodText(startDate, endDate, ctx)
        }, ctx);

        const date = new Date().toISOString().split('T')[0];
        const result = await window.electronAPI.saveCustomerSummaryPdf({
            defaultName: `فاتورة_مجمعة_${customerName}_${date}.pdf`,
            html: buildDocument(`${title} - ${customerName}`, body, ctx)
        });
        notifyResult(result, ctx);
    }

    window.customerReportsPdf = {
        exportDetailed,
        exportSummary
    };
})();
