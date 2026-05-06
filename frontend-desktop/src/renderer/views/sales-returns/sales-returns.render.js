(function () {
    function renderPage({ t, getNavHTML }) {
        document.title = t('salesReturns.title', 'مردودات المبيعات');

        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <div class="content sales-content">
            <div class="sales-page-header">
                <div class="sales-title-wrap">
                    <h1 class="page-title">${t('salesReturns.title', 'مردودات المبيعات')}</h1>
                    <p class="sales-subtitle">${t('salesReturns.subtitle', 'إدارة وتسجيل المرتجعات للفواتير بشكل سريع ومنظم.')}</p>
                </div>
            </div>

            <div id="invoiceForm" class="invoice-form-container">
                <div class="invoice-shell">
                    <div class="form-title-row">
                        <h2 class="form-title">${t('salesReturns.newReturnTitle', 'تسجيل مرتجع جديد')}</h2>
                        <div style="display: flex; gap: 8px; margin-inline-start: auto;">
                            <button class="btn btn-outline" type="button" data-action="load-prev-return" style="padding: 8px 10px;">
                                ${t('common.actions.previous', 'السابق')}
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-next-return" style="padding: 8px 10px;">
                                ${t('common.actions.next', 'التالي')}
                            </button>
                        </div>
                        <span class="form-status-chip" style="color: var(--danger-color); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.35);">${t('salesReturns.formStatusChip', 'مرتجع مبيعات')}</span>
                    </div>

                    <div class="invoice-top-grid">
                        <div class="form-group">
                            <label>${t('salesReturns.customer', 'العميل')}</label>
                            <select id="customerSelect" class="form-control">
                                <option value="">${t('common.actions.selectCustomer', 'اختر العميل')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${t('salesReturns.originalInvoice', 'الفاتورة الأصلية')}</label>
                            <select id="invoiceSelect" class="form-control" disabled>
                                <option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${t('salesReturns.returnNumber', 'رقم المرتجع')}</label>
                            <input type="text" id="returnNumber" class="form-control" placeholder="${t('common.actions.auto', 'تلقائي')}" readonly>
                        </div>
                        <div class="form-group">
                            <label>${t('salesReturns.returnDate', 'تاريخ المرتجع')}</label>
                            <input type="date" id="returnDate" class="form-control">
                        </div>
                    </div>

                    <div id="itemsSection" class="items-section" style="display: none;">
                        <div class="items-section-head">
                            <div class="items-section-title-wrap">
                                <h3 class="items-section-title">${t('salesReturns.invoiceItems', 'أصناف الفاتورة')}</h3>
                            </div>
                        </div>

                        <div class="items-table-wrap">
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th style="width: 4%; text-align: center;">#</th>
                                        <th style="width: 5%;">${t('salesReturns.returnItem', 'إرجاع')}</th>
                                        <th style="width: 26%;">${t('salesReturns.item', 'الصنف')}</th>
                                        <th style="width: 10%;">${t('salesReturns.unit', 'الوحدة')}</th>
                                        <th style="width: 12%;">${t('salesReturns.soldQty', 'الكمية المباعة')}</th>
                                        <th style="width: 12%;">${t('salesReturns.returnedQty', 'مرتجع سابق')}</th>
                                        <th style="width: 12%;">${t('salesReturns.returnQty', 'كمية المرتجع')}</th>
                                        <th style="width: 12%;">${t('salesReturns.price', 'السعر')}</th>
                                        <th style="width: 12%;">${t('salesReturns.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody id="itemsBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="invoice-footer-grid">
                        <div class="notes-section">
                            <div class="form-group" style="height: 100%; display: flex; flex-direction: column;">
                                <label>${t('salesReturns.notes', 'ملاحظات / سبب الإرجاع')}</label>
                                <textarea id="returnNotes" class="form-control" placeholder="${t('salesReturns.notesPlaceholder', 'اكتب أي ملاحظات إضافية...')}" style="flex: 1; resize: none;"></textarea>
                            </div>
                        </div>

                        <div class="totals-panel" style="display: flex; flex-direction: column;">
                            <div class="total-row grand-total" style="border-top: none; margin-top: 0; padding-top: 0;">
                                <span>${t('salesReturns.returnTotal', 'إجمالي المرتجع:')}</span>
                                <span id="returnTotal" class="customer-due-value due-positive">0.00</span>
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: auto; padding-top: 15px;">
                                <button class="btn btn-outline" style="flex: 1;" type="button" data-action="reset-form">
                                    <i class="fas fa-eraser"></i> ${t('common.actions.clear', 'تفريغ')}
                                </button>
                                <button class="btn btn-success" style="flex: 2; margin-top: 0; background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 12px 24px rgba(239, 68, 68, 0.28);" id="saveBtn" type="button" data-action="save-return" disabled>
                                    <i class="fas fa-save"></i> ${t('salesReturns.saveReturn', 'حفظ المرتجع')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="invoice-form-container" style="margin-top: 30px;">
                <div class="history-header" style="padding: 20px 25px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center; background: var(--bg-color);">
                    <h3 style="margin: 0; color: var(--primary-color); display: flex; align-items: center; gap: 8px; font-weight: 800;"><i class="fas fa-history"></i> ${t('salesReturns.historyTitle', 'سجل المردودات')}</h3>
                </div>
                <div id="historyContent">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>${t('common.state.noReturns', 'لا توجد مردودات مسجلة')}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    function createInvoiceItemRow({ item, index, t, toSafeNumber, getAvailableToReturn }) {
        const quantity = toSafeNumber(item.quantity);
        const returnedQty = toSafeNumber(item.returned_quantity);
        const availableToReturn = getAvailableToReturn(item);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="row-index"></td>
            <td style="text-align: center; vertical-align: middle;"><input type="checkbox" class="return-checkbox" data-index="${index}" ${availableToReturn <= 0 ? 'disabled' : ''}></td>
            <td class="item-name" style="text-align: center; vertical-align: middle;">
                <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                    ${item.item_name || t('common.state.deletedItem', 'Deleted Item')}
                    <span class="item-stock-badge empty"></span>
                </div>
            </td>
            <td style="text-align: center; vertical-align: middle;"><div class="unit-label" style="margin: 0 auto;">${item.unit_name || '-'}</div></td>
            <td style="text-align: center; vertical-align: middle; font-weight: 600;">${quantity}</td>
            <td class="returned-qty" style="text-align: center; vertical-align: middle;">${returnedQty > 0 ? returnedQty : '-'}</td>
            <td style="text-align: center; vertical-align: middle;">
                <input type="number" class="form-control quantity-input return-qty-input" data-fs-size="sm" data-index="${index}" min="0" max="${availableToReturn}" step="any" value="0" disabled>
            </td>
            <td style="text-align: center; vertical-align: middle;">
                <input type="number" class="form-control price-input return-price-input" data-fs-size="sm" data-index="${index}" value="${toSafeNumber(item.sale_price)}" step="any" disabled>
            </td>
            <td class="row-total" data-index="${index}" style="text-align: center; vertical-align: middle;">0.00</td>
        `;

        if (availableToReturn <= 0) {
            row.style.opacity = '0.5';
        }

        return row;
    }

    function setFormMode(isEditing, t) {
        const formTitle = document.querySelector('.form-title');
        const saveBtn = document.getElementById('saveBtn');

        const titleText = isEditing
            ? t('salesReturns.editReturnTitle', 'تعديل بيانات المرتجع')
            : t('salesReturns.newReturnTitle', 'تسجيل مرتجع جديد');

        const saveText = isEditing
            ? t('salesReturns.updateReturn', 'تحديث المرتجع')
            : t('salesReturns.saveReturn', 'حفظ المرتجع');

        if (formTitle) {
            formTitle.innerHTML = `<i class="fas fa-file-invoice"></i> ${titleText}`;
        }

        if (saveBtn) {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${saveText}`;
        }
    }

    function renderEmptyHistory(container, t) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>${t('common.state.noReturns', 'No returns recorded')}</p>
            </div>
        `;
    }

    function renderHistoryTable({ container, rows, page, totalPages, t, fmt }) {
        const hasPagination = totalPages > 1;

        const paginationHtml = hasPagination
            ? `
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0;">
                <button class="btn btn-sm" type="button" data-action="history-prev" ${page === 1 ? 'disabled' : ''}>السابق</button>
                <span style="font-weight:600;">صفحة ${page} من ${totalPages}</span>
                <button class="btn btn-sm" type="button" data-action="history-next" ${page === totalPages ? 'disabled' : ''}>التالي</button>
            </div>
        `
            : '';

        container.innerHTML = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>${t('salesReturns.returnNumber', 'Return Number')}</th>
                    <th>${t('salesReturns.originalInvoice', 'Original Invoice')}</th>
                    <th>${t('salesReturns.customer', 'Customer')}</th>
                    <th>${t('salesReturns.returnDate', 'Date')}</th>
                    <th>${t('salesReturns.total', 'Total')}</th>
                    <th>${t('common.labels.actions', 'Actions')}</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => {
                    const returnNumberCell = window.renderDocNumberCell
                        ? window.renderDocNumberCell(row.return_number, { numberTag: 'span' })
                        : (row.return_number || '-');
                    const originalInvoiceCell = window.renderDocNumberCell
                        ? window.renderDocNumberCell(row.original_invoice_number, { numberTag: 'span' })
                        : (row.original_invoice_number || '-');

                    return `
                    <tr>
                        <td><span class="badge badge-return"><i class="fas fa-undo-alt"></i> ${returnNumberCell}</span></td>
                        <td>${originalInvoiceCell}</td>
                        <td>${row.customer_name || '-'}</td>
                        <td>${row.return_date || '-'}</td>
                        <td style="font-weight: 700; color: #ef4444;">${(Number(row.total_amount) || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn btn-sm btn-delete" type="button" data-action="delete-return" data-id="${row.id}">
                                <i class="fas fa-trash"></i> ${t('common.actions.delete', 'Delete')}
                            </button>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
        ${paginationHtml}
    `;
    }

    window.salesReturnsPageRender = {
        renderPage,
        createInvoiceItemRow,
        setFormMode,
        renderEmptyHistory,
        renderHistoryTable
    };
})();
