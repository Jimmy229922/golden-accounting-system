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
                        <h1 class="page-title">${t('sales.pageTitle', 'فواتير المبيعات')}</h1>
                        <p class="sales-subtitle">${t('sales.subtitle', 'ترتيب واضح وسريع لتسجيل الفاتورة ومراجعة الإجمالي قبل الحفظ.')}</p>
                    </div>
                </div>
            </div>

            <div id="invoiceForm" class="invoice-form-container">
                <div class="invoice-shell">
                    <div class="form-title-row">
                        <h2 class="form-title">${t('sales.formTitle', 'تسجيل فاتورة بيع جديدة')}</h2>
                        <div style="display: flex; gap: 8px; margin-inline-start: auto; align-items: center;">
                            <button class="btn btn-outline" type="button" data-action="print-invoice" id="printInvoiceBtn" disabled style="padding: 8px 12px; opacity: 0.5; cursor: not-allowed;" title="${t('sales.printInvoice', 'طباعة الفاتورة')}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-prev-invoice" style="padding: 8px 10px;">
                                ${t('common.actions.previous', 'السابق')}
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-next-invoice" style="padding: 8px 10px;">
                                ${t('common.actions.next', 'التالي')}
                            </button>
                        </div>
                        <span class="form-status-chip">${t('sales.formStatusChip', 'فاتورة مبيعات')}</span>
                    </div>

                    <div class="invoice-top-grid">
                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                ${t('sales.customer', 'العميل')}
                            </label>
                            <select id="customerSelect" class="form-control">
                                <option value="">${t('sales.selectCustomer', 'اختر العميل')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                ${t('sales.invoiceNumber', 'رقم الفاتورة')}
                            </label>
                            <input type="text" id="invoiceNumber" class="form-control" list="invoiceSuggestions" placeholder="${t('sales.autoNumber', 'تلقائي')}" autocomplete="off">
                            <datalist id="invoiceSuggestions"></datalist>
                        </div>

                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${t('sales.invoiceDate', 'تاريخ الفاتورة')}
                            </label>
                            <input type="date" id="invoiceDate" class="form-control">
                        </div>

                        <div class="form-group">
                            <label>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                                ${t('sales.paymentType', 'طريقة الدفع')}
                            </label>
                            <select id="paymentType" class="form-control">
                                <option value="cash">${t('sales.paymentCash', 'كاش (نقدي)')}</option>
                                <option value="credit" selected>${t('sales.paymentCredit', 'آجل (ذمم)')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="items-section">
                        <div class="items-section-head">
                            <div class="items-section-title-wrap">
                                <h3 class="items-section-title">${t('sales.invoiceItems', 'أصناف الفاتورة')}</h3>
                                <div id="customerBalance" class="customer-balance" style="display: none;"></div>
                                <span id="selectedItemAvailability" class="selected-item-availability"></span>
                            </div>
                            <button class="btn btn-outline" type="button" data-action="add-row">${t('sales.addItemBtn', '+ إضافة صنف')}</button>
                        </div>

                        <div class="items-table-wrap">
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th style="width: 4%; text-align: center;">#</th>
                                        <th style="width: 14%;">${t('items.barcode', 'الباركود')}</th>
                                        <th style="width: 24%;">${t('sales.tableHeaders.item', 'الصنف')}</th>
                                        <th style="width: 10%;">${t('sales.tableHeaders.unit', 'الوحدة')}</th>
                                        <th style="width: 14%;">${t('sales.tableHeaders.qty', 'الكمية')}</th>
                                        <th style="width: 14%;">${t('sales.tableHeaders.price', 'سعر البيع')}</th>
                                        <th style="width: 14%;">${t('sales.tableHeaders.total', 'الإجمالي')}</th>
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
                                <label>${t('sales.notesLabel', 'ملاحظات / شروط الدفع')}</label>
                                <textarea id="invoiceNotes" class="form-control" rows="4" placeholder="${t('sales.notesPlaceholder2', 'اكتب أي ملاحظات إضافية على الفاتورة...')}"></textarea>
                            </div>
                        </div>

                        <div class="totals-panel">
                            <div class="invoice-financial-grid">
                                <div class="form-group">
                                    <label>${t('sales.discountType', 'نوع الخصم')}</label>
                                    <select id="discountType" class="form-control" data-fs-size="sm">
                                        <option value="amount">${t('sales.discountTypeAmount', 'مبلغ')}</option>
                                        <option value="percent">${t('sales.discountTypePercent', 'نسبة %')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>${t('sales.discountValue', 'قيمة الخصم')}</label>
                                    <input type="text" id="discountValue" class="form-control" data-fs-size="sm" value="0" autocomplete="off" placeholder="0">
                                </div>
                                <div class="form-group">
                                    <label>${t('sales.paidNow', 'المدفوع الآن')}</label>
                                    <input type="text" id="paidAmount" class="form-control" data-fs-size="sm" value="0" autocomplete="off" placeholder="0">
                                </div>
                            </div>

                            <div class="total-row total-row-secondary">
                                <span>${t('sales.subtotalBeforeDiscount', 'الإجمالي قبل الخصم:')}</span>
                                <span id="invoiceSubtotal">0.00</span>
                            </div>
                            <div class="total-row total-row-secondary">
                                <span>${t('sales.discountAmount', 'قيمة الخصم:')}</span>
                                <span id="invoiceDiscountAmount">0.00</span>
                            </div>
                            <div class="total-row grand-total">
                                <span>${t('sales.netAfterDiscount', 'الصافي بعد الخصم:')}</span>
                                <span id="invoiceTotal">0.00</span>
                            </div>
                            <div class="total-row total-row-paid-summary">
                                <span>${t('sales.paidNow', 'المدفوع')}:</span>
                                <span id="invoicePaidDisplay">0.00</span>
                            </div>
                            <div class="total-row total-row-due">
                                <span class="customer-due-label">${t('sales.customerDue', 'المتبقي على العميل:')}</span>
                                <span id="invoiceRemaining" class="customer-due-value">0.00</span>
                            </div>
                            <button class="btn btn-success" type="button" data-action="submit-invoice">
                                ${t('sales.saveAndPost', 'حفظ الفاتورة')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="salesPrintPreviewModal" class="sales-print-preview-modal" style="display: none;" aria-hidden="true">
                <div class="sales-print-preview-panel" role="dialog" aria-modal="true" aria-label="معاينة الفاتورة">
                    <div class="sales-print-preview-header">
                        <div>
                            <h3 class="sales-print-preview-title">معاينة الفاتورة</h3>
                            <p id="salesPrintPrinterStatus" class="sales-print-preview-subtitle"></p>
                        </div>
                        <div class="sales-print-preview-actions">
                            <button class="btn btn-outline" type="button" data-action="change-print-printer" id="salesPrintChangePrinterBtn" style="display: none;">تغيير الطابعة</button>
                            <button class="btn btn-success" type="button" data-action="confirm-print-invoice" id="salesPrintConfirmBtn">طباعة</button>
                            <button class="btn btn-outline" type="button" data-action="close-print-preview">إغلاق</button>
                        </div>
                    </div>
                    <div id="salesPrintPrinterPicker" class="sales-print-printer-picker" style="display: none;">
                        <label for="salesPrintPrinterSelect">اختر الطابعة</label>
                        <select id="salesPrintPrinterSelect" class="form-control"></select>
                    </div>
                    <div class="sales-print-preview-body">
                        <div id="salesPrintPreviewPage" class="sales-print-preview-page"></div>
                    </div>
                </div>
            </div>

            <div id="salesShiftCloseModal" class="sales-shift-modal-overlay" style="display: none;" aria-hidden="true">
                <div class="sales-shift-modal" role="dialog" aria-modal="true" aria-label="إقفال وردية المبيعات">
                    <div class="sales-shift-modal-header">
                        <div>
                            <h3 class="sales-shift-modal-title">إقفال وردية المبيعات</h3>
                            <p class="sales-shift-modal-subtitle">إجمالي المقبوض من آخر إقفال حتى الآن للمقارنة مع درج الكاش.</p>
                        </div>
                        <button class="btn btn-outline sales-shift-close-btn" type="button" data-action="close-shift-close-modal">إغلاق</button>
                    </div>

                    <div class="sales-shift-modal-body">
                        <div class="sales-shift-summary-grid">
                            <div class="sales-shift-summary-item">
                                <span>بداية الفترة</span>
                                <strong id="shiftClosePeriodStart">-</strong>
                            </div>
                            <div class="sales-shift-summary-item">
                                <span>نهاية الفترة</span>
                                <strong id="shiftClosePeriodEnd">-</strong>
                            </div>
                            <div class="sales-shift-summary-item">
                                <span>الفرق</span>
                                <strong id="shiftCloseDifference">0.00</strong>
                            </div>
                        </div>

                        <div class="sales-shift-form-grid">
                            <div class="form-group">
                                <label>إجمالي المقبوض من المبيعات</label>
                                <input type="number" id="shiftCloseTotal" class="form-control" min="0" step="0.01" value="0">
                            </div>
                            <div class="form-group">
                                <label>إجمالي تحصيل العملاء</label>
                                <input type="number" id="shiftCloseCollections" class="form-control" min="0" step="0.01" value="0" readonly>
                            </div>
                            <div class="form-group">
                                <label>المبلغ الفعلي في الدرج (اختياري)</label>
                                <input type="number" id="shiftCloseDrawer" class="form-control" min="0" step="0.01" placeholder="اختياري">
                            </div>
                            <div class="form-group">
                                <label>المستخدم</label>
                                <input type="text" id="shiftCloseCreatedBy" class="form-control" placeholder="اسم المستخدم الحالي">
                            </div>
                            <div class="form-group sales-shift-notes-group">
                                <label>ملاحظة</label>
                                <textarea id="shiftCloseNotes" class="form-control" rows="2" placeholder="ملاحظة اختيارية"></textarea>
                            </div>
                        </div>

                        <div class="sales-shift-actions-row">
                            <button class="btn btn-outline" type="button" data-action="refresh-shift-close-preview">تحديث الرقم</button>
                            <button class="btn btn-outline" type="button" data-action="reset-shift-close-form">تهيئة نموذج الإقفال</button>
                            <button id="shiftCloseSubmitBtn" class="btn btn-success sales-shift-submit-btn" type="button" data-action="submit-shift-close">
                                <span id="shiftCloseSubmitLabel">تأكيد الإقفال وترحيل المالية</span>
                            </button>
                        </div>

                        <div class="sales-shift-history-head">
                            <h4 class="sales-shift-history-title">سجل إقفالات الوردية</h4>
                            <input type="text" id="shiftCloseSearch" class="form-control sales-shift-search" data-fs-size="sm" placeholder="بحث في سجل الإقفالات">
                        </div>

                        <div class="sales-shift-table-wrap">
                            <table class="items-table sales-shift-table">
                                <thead>
                                    <tr>
                                        <th>رقم الإقفال</th>
                                        <th>من</th>
                                        <th>إلى</th>
                                        <th>إجمالي مرحل</th>
                                        <th>الدرج</th>
                                        <th>الفرق</th>
                                        <th>المستخدم</th>
                                        <th>ملاحظة</th>
                                        <th>آخر تعديل</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="shiftCloseTableBody">
                                    <tr>
                                        <td colspan="10" class="sales-shift-empty">لا توجد إقفالات مسجلة حتى الآن.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    function buildItemsOptions({ allItems, existingItem, t, fmt }) {
        let itemsOptions = `<option value="">${t('sales.selectItem', 'اختر الصنف')}</option>`;
        allItems.forEach((item) => {
            const isSelected = existingItem && existingItem.item_id === item.id ? 'selected' : '';
            const itemLabel = item.name;
            itemsOptions += `<option value="${item.id}" data-price="${item.sale_price}" data-cost="${item.cost_price || 0}" data-barcode="${item.barcode || ''}" ${isSelected}>${itemLabel}</option>`;
        });
        return itemsOptions;
    }

    function createInvoiceRow({ allItems, existingItem, t, fmt }) {
        const row = document.createElement('tr');
        row.dataset.id = String(Date.now());

        const itemsOptions = buildItemsOptions({ allItems, existingItem, t, fmt });
        const quantity = existingItem ? existingItem.quantity : '';
        const price = existingItem ? existingItem.sale_price : 0;
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
                <select class="form-control item-select" data-fs-size="sm" data-autocomplete-cache-key="sales-items">
                    ${itemsOptions}
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
        </td>
        <td>
            <span class="row-total">${total.toFixed(2)}</span>
        </td>
        <td style="text-align: center;">
            <button class="remove-row" type="button" data-action="remove-row" title="${t('sales.removeRow', 'حذف الصنف')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        </td>
    `;

        return row;
    }

    function setEditModeUI(t) {
        const title = document.querySelector('#invoiceForm h2');
        if (title) {
            title.textContent = t('sales.editFormTitle', 'تعديل فاتورة بيع');
        }
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        if (saveBtn) {
            saveBtn.textContent = t('sales.updateAndSave', 'تحديث وحفظ الفاتورة');
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.disabled = false;
        }
    }

    function setCreateModeUI(t) {
        const title = document.querySelector('#invoiceForm h2');
        if (title) {
            title.textContent = t('sales.formTitle', 'تسجيل فاتورة بيع جديدة');
        }
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        if (saveBtn) {
            saveBtn.textContent = t('sales.saveAndPost', 'حفظ الفاتورة');
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.disabled = false;
        }
    }

    window.salesPageRender = {
        renderPage,
        createInvoiceRow,
        setEditModeUI,
        setCreateModeUI
    };
})();
