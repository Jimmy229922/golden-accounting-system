(function () {
    function renderPage({ t, getNavHTML }) {
        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <div class="content sales-content">
            <div class="sales-page-header">
                <div class="sales-title-wrap">
                    <div class="page-title-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div class="sales-title-text">
                        <h1 class="page-title">${t('purchases.pageTitle', 'فواتير المشتريات')}</h1>
                        <p class="sales-subtitle">${t('purchases.subtitle', 'ترتيب واضح وسريع لتسجيل الفاتورة ومراجعة الإجمالي قبل الحفظ.')}</p>
                    </div>
                </div>
            </div>

            <div id="invoiceForm" class="invoice-form-container">
                <div class="invoice-shell">
                    <div class="form-title-row">
                        <h2 class="form-title">${t('purchases.formTitle', 'تسجيل فاتورة شراء جديدة')}</h2>
                        <div style="display: flex; gap: 8px; margin-inline-start: auto;">
                            <button class="btn btn-outline" type="button" data-action="load-prev-invoice" style="padding: 8px 10px;">
                                ${t('common.actions.previous', 'السابق')}
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-next-invoice" style="padding: 8px 10px;">
                                ${t('common.actions.next', 'التالي')}
                            </button>
                        </div>
                        <span class="form-status-chip">${t('purchases.formStatusChip', 'فاتورة مشتريات')}</span>
                    </div>

                    <div class="invoice-top-grid">
                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                ${t('purchases.supplier', 'المورد')}
                            </label>
                            <select id="supplierSelect" class="form-control">
                                <option value="">${t('purchases.selectSupplier', 'اختر المورد')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                ${t('purchases.invoiceNumber', 'رقم الفاتورة')}
                            </label>
                            <input type="text" id="invoiceNumber" class="form-control" list="invoiceSuggestions" placeholder="${t('purchases.autoNumber', 'تلقائي')}" autocomplete="off">
                            <datalist id="invoiceSuggestions"></datalist>
                        </div>

                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${t('purchases.invoiceDate', 'تاريخ الفاتورة')}
                            </label>
                            <input type="date" id="invoiceDate" class="form-control">
                        </div>

                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                                ${t('purchases.paymentType', 'طريقة الدفع')}
                            </label>
                            <select id="paymentType" class="form-control">
                                <option value="cash">${t('purchases.paymentCash', 'كاش (نقدي)')}</option>
                                <option value="credit" selected>${t('purchases.paymentCredit', 'آجل (ذمم)')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="items-section">
                        <div class="items-section-head">
                            <div class="items-section-title-wrap">
                                <h3 class="items-section-title">${t('purchases.invoiceItems', 'أصناف الفاتورة')}</h3>
                                <div id="supplierBalance" class="customer-balance" style="display: none;"></div>
                                <span id="selectedItemAvailability" class="selected-item-availability"></span>
                            </div>
                            <button class="btn btn-outline" type="button" data-action="add-row">${t('purchases.addItemBtn', '+ إضافة صنف')}</button>
                        </div>

                        <div class="items-table-wrap">
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th style="width: 4%; text-align: center;">#</th>
                                        <th style="width: 14%;">${t('items.barcode', 'الباركود')}</th>
                                        <th style="width: 24%;">${t('purchases.tableHeaders.item', 'الصنف')}</th>
                                        <th style="width: 10%;">${t('purchases.tableHeaders.unit', 'الوحدة')}</th>
                                        <th style="width: 14%;">${t('purchases.tableHeaders.qty', 'الكمية')}</th>
                                        <th style="width: 14%;">${t('purchases.tableHeaders.price', 'سعر الشراء')}</th>
                                        <th style="width: 14%;">${t('purchases.tableHeaders.total', 'الإجمالي')}</th>
                                        <th style="width: 6%;"></th>
                                    </tr>
                                </thead>
                                <tbody id="invoiceItemsBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="invoice-footer-grid">
                        <div class="notes-section">
                            <div class="form-group">
                                <label>${t('purchases.notesLabel', 'ملاحظات / شروط الدفع')}</label>
                                <textarea id="invoiceNotes" class="form-control" rows="4" placeholder="${t('purchases.notesPlaceholder2', 'اكتب أي ملاحظات إضافية على الفاتورة...')}"></textarea>
                            </div>
                        </div>

                        <div class="totals-panel">
                            <div class="invoice-financial-grid">
                                <div class="form-group">
                                    <label>${t('purchases.discountType', 'نوع الخصم')}</label>
                                    <select id="discountType" class="form-control" data-fs-size="sm">
                                        <option value="amount">${t('purchases.discountTypeAmount', 'مبلغ')}</option>
                                        <option value="percent">${t('purchases.discountTypePercent', 'نسبة %')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>${t('purchases.discountValue', 'قيمة الخصم')}</label>
                                    <input type="text" id="discountValue" class="form-control" data-fs-size="sm" value="0" autocomplete="off" placeholder="0">
                                </div>
                                <div class="form-group">
                                    <label>${t('purchases.paidNow', 'المدفوع الآن')}</label>
                                    <input type="text" id="paidAmount" class="form-control" data-fs-size="sm" value="0" autocomplete="off" placeholder="0">
                                </div>
                            </div>

                            <div class="total-row total-row-secondary">
                                <span>${t('purchases.subtotalBeforeDiscount', 'الإجمالي قبل الخصم:')}</span>
                                <span id="invoiceSubtotal">0.00</span>
                            </div>
                            <div class="total-row total-row-secondary">
                                <span>${t('purchases.discountAmount', 'قيمة الخصم:')}</span>
                                <span id="invoiceDiscountAmount">0.00</span>
                            </div>
                            <div class="total-row grand-total">
                                <span>${t('purchases.netAfterDiscount', 'الصافي بعد الخصم:')}</span>
                                <span id="invoiceTotal">0.00</span>
                            </div>
                            <div class="total-row total-row-paid-summary">
                                <span>${t('purchases.paidNow', 'المدفوع')}:</span>
                                <span id="invoicePaidDisplay">0.00</span>
                            </div>
                            <div class="total-row total-row-due">
                                <span class="customer-due-label">${t('purchases.supplierDue', 'المتبقي على المورد:')}</span>
                                <span id="invoiceRemaining" class="customer-due-value">0.00</span>
                            </div>
                            <button class="btn btn-success" type="button" data-action="submit-invoice">
                                ${t('purchases.saveAndPost', 'حفظ وترحيل الفاتورة')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    function buildItemsOptions({ allItems, existingItem, t, fmt }) {
        let itemsOptions = `<option value="">${t('purchases.selectItem', 'اختر الصنف')}</option>`;
        allItems.forEach((item) => {
            const isSelected = existingItem && existingItem.item_id === item.id ? 'selected' : '';
            const itemLabel = item.name;
            itemsOptions += `<option value="${item.id}" data-price="${item.cost_price}" data-barcode="${item.barcode || ''}" ${isSelected}>${itemLabel}</option>`;
        });
        return itemsOptions;
    }

    function createInvoiceRow({ allItems, existingItem, t, fmt }) {
        const row = document.createElement('tr');
        row.dataset.id = String(Date.now());

        const quantity = existingItem ? existingItem.quantity : '';
        const price = existingItem ? existingItem.cost_price : 0;
        const total = existingItem ? existingItem.total_price : 0;

        let unitName = '';
        let barcodeValue = '';
        if (existingItem) {
            const existingItemId = parseInt(existingItem.item_id, 10);
            const match = Number.isFinite(existingItemId) ? allItems.find((i) => i.id === existingItemId) : null;
            unitName = match && match.unit_name ? match.unit_name : '';
            barcodeValue = match && match.barcode ? match.barcode : '';
        }

        row.innerHTML = `
        <td class="row-index"></td>
        <td>
            <input type="text" autocomplete="off" class="form-control barcode-input" data-fs-size="sm" value="${barcodeValue}" placeholder="${t('items.barcodePlaceholder', 'امسح الباركود...')}">
        </td>
        <td style="position:relative;">
            <div style="display:flex; align-items:center; gap:8px;">
                <select class="form-control item-select" data-fs-size="sm" data-autocomplete-cache-key="purchases-items">
                    ${buildItemsOptions({ allItems, existingItem, t, fmt })}
                </select>
                <span class="item-stock-badge empty"></span>
            </div>
        </td>
        <td>
            <span class="unit-label">${unitName}</span>
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control quantity-input" data-fs-size="sm" value="${quantity}" placeholder="0">
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control price-input" data-fs-size="sm" value="${price}">
            <div class="profit-indicator"></div>
        </td>
        <td>
            <span class="row-total">${total.toFixed(2)}</span>
        </td>
        <td>
            <button class="remove-row" type="button" data-action="remove-row" title="${t('purchases.removeRow', 'حذف الصنف')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        </td>
    `;

        return row;
    }

    function setEditModeUI(t) {
        const title = document.querySelector('#invoiceForm h2');
        if (title) {
            title.textContent = t('purchases.editFormTitle', 'تعديل فاتورة شراء');
        }
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        if (saveBtn) {
            saveBtn.textContent = t('purchases.updateAndSave', 'تحديث وحفظ الفاتورة');
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.disabled = false; // Override any static disabled
        }
    }

    function setCreateModeUI(t) {
        const title = document.querySelector('#invoiceForm h2');
        if (title) {
            title.textContent = t('purchases.formTitle', 'تسجيل فاتورة شراء جديدة');
        }
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        if (saveBtn) {
            saveBtn.textContent = t('purchases.saveAndPost', 'حفظ وترحيل الفاتورة');
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.disabled = false; // Override any static disabled
        }
    }

    window.purchasesPageRender = {
        renderPage,
        createInvoiceRow,
        setEditModeUI,
        setCreateModeUI
    };
})();
