function openVoucherModalShell() {
    if (!voucherModalEl) return;
    voucherModalEl.classList.add('is-open');
    voucherModalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeVoucherModal() {
    if (!voucherModalEl) return;
    voucherModalEl.classList.remove('is-open');
    voucherModalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function renderVoucherModalLoading() {
    if (!voucherModalBodyEl) return;
    voucherModalBodyEl.innerHTML = `
        <div class="voucher-modal-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>${t('reports.loading', 'جارٍ تحميل البيانات...')}</span>
        </div>
    `;
}

function renderVoucherModalError(message) {
    if (!voucherModalBodyEl) return;
    voucherModalBodyEl.innerHTML = `
        <div class="voucher-modal-error">
            <i class="fas fa-triangle-exclamation"></i>
            <span>${escapeHtml(message || t('reports.loadError', 'حدث خطأ أثناء تحميل البيانات'))}</span>
        </div>
    `;
}

function renderVoucherModalContent(reportType, transaction, entity) {
    if (!voucherModalBodyEl) return;

    const isReceipt = reportType === 'receipt';
    const typeLabel = isReceipt
        ? t('reports.receiptType', 'سندات تحصيل')
        : t('reports.paymentType', 'سندات سداد');
    const typeClass = isReceipt ? 'voucher-type-receipt' : 'voucher-type-payment';
    const typeIcon = isReceipt ? 'fa-hand-holding-usd' : 'fa-money-bill-wave';
    const entityLabel = isReceipt
        ? t('reports.modal.customer', 'العميل')
        : t('reports.modal.supplier', 'المورد');
    const entityName = escapeHtml(entity?.name || transaction.customer_name || '-');
    const entityPhone = escapeHtml(entity?.phone || '-');
    const entityAddress = escapeHtml(entity?.address || '-');
    const notesText = escapeHtml(transaction.description || t('reports.modal.noNotes', 'لا توجد ملاحظات'));
    const voucherNumber = escapeHtml(transaction.voucher_number || '-');
    const voucherNumberCell = window.renderDocNumberCell
        ? window.renderDocNumberCell(transaction.voucher_number, { numberTag: 'span' })
        : voucherNumber;
    const dateText = formatDateTimeForUi(transaction.transaction_date);
    const amountText = formatCurrency(transaction.amount);

    voucherModalBodyEl.innerHTML = `
        <div class="voucher-modal-summary ${typeClass}">
            <span class="voucher-type-pill">
                <i class="fas ${typeIcon}"></i>
                ${typeLabel}
            </span>
            <strong>${t('reports.tableHeaders.invoiceNumber', 'رقم الفاتورة')}:</strong>
            ${voucherNumberCell}
        </div>

        <div class="voucher-modal-grid">
            <div class="voucher-metric">
                <span>${t('reports.tableHeaders.amount', 'المبلغ')}</span>
                <strong>${amountText}</strong>
            </div>
            <div class="voucher-metric">
                <span>${t('reports.tableHeaders.date', 'التاريخ')}</span>
                <strong>${dateText}</strong>
            </div>
            <div class="voucher-metric">
                <span>${t('reports.modal.transactionId', 'رقم العملية')}</span>
                <strong>#${escapeHtml(transaction.id)}</strong>
            </div>
        </div>

        <div class="voucher-entity-card">
            <h4><i class="fas fa-user"></i> ${entityLabel}</h4>
            <div class="voucher-entity-row">
                <span>${entityLabel}</span>
                <strong>${entityName}</strong>
            </div>
            <div class="voucher-entity-row">
                <span>${t('reports.modal.phone', 'الهاتف')}</span>
                <strong>${entityPhone}</strong>
            </div>
            <div class="voucher-entity-row">
                <span>${t('reports.modal.address', 'العنوان')}</span>
                <strong>${entityAddress}</strong>
            </div>
        </div>

        <div class="voucher-notes-card">
            <h4><i class="fas fa-sticky-note"></i> ${t('reports.modal.notes', 'البيان')}</h4>
            <p>${notesText}</p>
        </div>
    `;
}

async function openVoucherModal(reportId, reportType) {
    if (reportType !== 'receipt' && reportType !== 'payment') return;

    openVoucherModalShell();
    renderVoucherModalLoading();

    if (voucherModalTitleEl) {
        voucherModalTitleEl.textContent = reportType === 'receipt'
            ? t('reports.modal.receiptPreviewTitle', 'معاينة سند التحصيل')
            : t('reports.modal.paymentPreviewTitle', 'معاينة سند السداد');
    }

    if (voucherModalSubtitleEl) {
        voucherModalSubtitleEl.textContent = `${t('reports.modal.transactionId', 'رقم العملية')}: #${reportId}`;
    }

    try {
        const transactions = await window.electronAPI.getTreasuryTransactions();
        const expectedType = reportType === 'receipt' ? 'income' : 'expense';
        const transaction = Array.isArray(transactions)
            ? transactions.find((item) => Number(item.id) === Number(reportId) && item.type === expectedType)
            : null;

        if (!transaction) {
            renderVoucherModalError(t('reports.modal.notFound', 'تعذر العثور على السند المطلوب.'));
            return;
        }

        const entity = allCustomers.find((customer) => Number(customer.id) === Number(transaction.customer_id));
        if (voucherModalSubtitleEl) {
            voucherModalSubtitleEl.textContent = `${t('reports.tableHeaders.invoiceNumber', 'رقم الفاتورة')}: ${transaction.voucher_number || '-'}`;
        }
        renderVoucherModalContent(reportType, transaction, entity);
    } catch (error) {
        console.error(error);
        renderVoucherModalError(t('reports.modal.loadError', 'تعذر تحميل بيانات السند.'));
    }
}

function printVoucherFromModal() {
    if (!voucherModalBodyEl) return;

    const printableContent = voucherModalBodyEl.innerHTML;
    const title = voucherModalTitleEl?.textContent || t('reports.voucherPreviewTitle', 'عرض السند');
    const subtitle = voucherModalSubtitleEl?.textContent || '';
    const printWindow = window.open('', '_blank', 'width=980,height=760');

    if (!printWindow) {
        setStatus(t('reports.printPopupBlocked', 'تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.'), 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)}</title>
            <style>
                body {
                    margin: 24px;
                    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
                    color: #0f172a;
                    background: #f8fafc;
                }
                .print-shell {
                    max-width: 900px;
                    margin: 0 auto;
                    border: 1px solid #dbe3ed;
                    border-radius: 14px;
                    background: #fff;
                    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
                    overflow: hidden;
                }
                .print-head {
                    padding: 14px 16px;
                    border-bottom: 1px solid #dbe3ed;
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.06));
                }
                .print-head h1 {
                    margin: 0;
                    font-size: 1.06rem;
                }
                .print-head p {
                    margin: 6px 0 0;
                    font-size: 0.88rem;
                    color: #64748b;
                }
                .print-body {
                    padding: 16px;
                }
                .voucher-modal-summary,
                .voucher-modal-grid,
                .voucher-entity-card,
                .voucher-notes-card {
                    border-color: #dbe3ed !important;
                    background: #f8fafc !important;
                }
                .voucher-modal-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(140px, 1fr));
                    gap: 10px;
                }
                .voucher-metric,
                .voucher-entity-card,
                .voucher-notes-card {
                    border: 1px solid #dbe3ed;
                    border-radius: 11px;
                    padding: 10px;
                }
                .voucher-metric span,
                .voucher-entity-row span {
                    color: #64748b;
                    font-size: 0.82rem;
                }
                .voucher-metric strong,
                .voucher-entity-row strong {
                    color: #0f172a;
                }
                .voucher-entity-row {
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 1px dashed #dbe3ed;
                    padding: 6px 0;
                }
                .voucher-entity-row:last-child {
                    border-bottom: none;
                }
                @media print {
                    body {
                        margin: 0;
                        background: #fff;
                    }
                    .print-shell {
                        border: 0;
                        box-shadow: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-shell">
                <div class="print-head">
                    <h1>${escapeHtml(title)}</h1>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
                <div class="print-body">${printableContent}</div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}
