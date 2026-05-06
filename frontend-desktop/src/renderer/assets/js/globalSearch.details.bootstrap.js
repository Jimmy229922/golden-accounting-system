(() => {
    if (typeof GlobalSearch === 'undefined') {
        return;
    }

    Object.assign(GlobalSearch.prototype, {
    async showItemMovements(itemId) {
        this.currentView = 'item-details';
        this.showLoading();
        
        try {
            const result = await window.electronAPI.getItemMovements(itemId);
            
            if (!result.success) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${result.error || this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                    </div>
                `;
                return;
            }
            
            const { item, movements, stats } = result;
            
            // تحديث الـ Header ليظهر زر الرجوع
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-box" style="color: var(--accent-color); margin-left: 8px;"></i>
                    ${this.t('globalSearch.itemMovements', 'حركة الصنف: {name}').replace('{name}', item.name)}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء محتوى حركة الصنف
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2>${item.name}</h2>
                        <p>${this.t('globalSearch.barcodeLabel', 'الباركود')}: ${item.barcode || this.t('globalSearch.noBarcode', 'لا يوجد')} | ${this.t('globalSearch.unitLabel', 'الوحدة')}: ${item.unit_name || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value in">+${stats.totalPurchased + stats.totalOpening}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalIncoming', 'إجمالي الوارد')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value out">-${stats.totalSold}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalOutgoing', 'إجمالي الصادر')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value stock">${stats.currentStock}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.currentStock', 'الرصيد الحالي')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${movements.length}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.movementCount', 'عدد الحركات')}</div>
                        </div>
                    </div>
                    
                    <div class="gsearch-movements-title">
                        <i class="fas fa-history"></i>
                        ${this.t('globalSearch.movementLog', 'سجل الحركات')}
                    </div>
                    
                    <div class="gsearch-movements-list">
            `;
            
            if (movements.length === 0) {
                html += `
                    <div class="gsearch-no-movements">
                        <i class="fas fa-inbox" style="font-size: 2rem; opacity: 0.5; margin-bottom: 10px; display: block;"></i>
                        ${this.t('globalSearch.noMovements', 'لا توجد حركات مسجلة لهذا الصنف')}
                    </div>
                `;
            } else {
                movements.forEach(mov => {
                    const isIn = mov.type === 'purchase' || mov.type === 'opening';
                    const iconClass = isIn ? 'in' : 'out';
                    const icon = isIn ? 'fa-arrow-down' : 'fa-arrow-up';
                    const qtyPrefix = isIn ? '+' : '-';
                    
                    const date = new Date(mov.date).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    
                    html += `
                        <div class="gsearch-movement">
                            <div class="gsearch-movement-icon ${iconClass}">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="gsearch-movement-info">
                                <div class="gsearch-movement-title">${mov.type_label}</div>
                                <div class="gsearch-movement-subtitle">
                                    ${mov.party_name} | ${this.t('globalSearch.invoiceLabel', 'فاتورة')}: ${mov.invoice_number} | ${date}
                                </div>
                            </div>
                            <div class="gsearch-movement-qty">
                                <div class="gsearch-movement-qty-value ${iconClass}">${qtyPrefix}${mov.quantity}</div>
                                <div class="gsearch-movement-qty-label">${mov.price.toLocaleString()} ${this.t('globalSearch.priceLabel', 'ج.م')}</div>
                            </div>
                        </div>
                    `;
                });
            }
            
            html += `
                    </div>
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
            // تحديث الـ Footer
            const footer = this.modal.querySelector('.gsearch-footer');
            footer.innerHTML = `
                <div class="gsearch-shortcut">
                    <kbd>Backspace</kbd> ${this.t('globalSearch.backHint', 'للرجوع')}
                </div>
                <div class="gsearch-shortcut">
                    <kbd>Esc</kbd> ${this.t('globalSearch.closeHint', 'للإغلاق')}
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading item movements:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchMovementError', 'حدث خطأ في جلب حركة الصنف')}</p>
                </div>
            `;
        }
    },

    async showVoucherDetails(type, id) {
        this.currentView = 'voucher-details';
        this.showLoading();
        
        try {
            const transactions = await window.electronAPI.getTreasuryTransactions();
            const voucher = transactions.find(t => t.id === id);
            
            if (!voucher) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.voucherNotFound', 'السند غير موجود')}</p>
                    </div>
                `;
                return;
            }
            
            const isReceipt = voucher.type === 'income';
            const customers = await window.electronAPI.getCustomers();
            const relatedCustomer = voucher.customer_id ? customers.find(c => c.id === voucher.customer_id) : null;
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas ${isReceipt ? 'fa-hand-holding-usd' : 'fa-money-bill-wave'}" style="color: ${isReceipt ? '#0891b2' : '#ea580c'}; margin-left: 8px;"></i>
                    ${isReceipt ? this.t('globalSearch.receiptDetails', 'تفاصيل سند التحصيل') : this.t('globalSearch.paymentDetails', 'تفاصيل سند السداد')}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء محتوى السند
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: ${isReceipt ? '#0891b2' : '#ea580c'};">${voucher.voucher_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${voucher.transaction_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: ${isReceipt ? '#0891b2' : '#ea580c'};">${(voucher.amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.amount', 'المبلغ')}</div>
                        </div>
                        ${relatedCustomer ? `
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${relatedCustomer.name}</div>
                            <div class="gsearch-stat-label">${isReceipt ? this.t('globalSearch.customer', 'العميل') : this.t('globalSearch.supplier', 'المورد')}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${voucher.description ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.description', 'الوصف')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${voucher.description}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading voucher details:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    },

    async showSalesInvoiceDetails(id) {
        this.currentView = 'invoice-details';
        this.showLoading();
        
        try {
            const invoices = await window.electronAPI.getSalesInvoices();
            const invoice = invoices.find(inv => inv.id === id);
            
            if (!invoice) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.invoiceNotFound', 'الفاتورة غير موجودة')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getSalesInvoiceDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-file-invoice" style="color: #10b981; margin-left: 8px;"></i>
                    ${this.t('globalSearch.salesInvoiceDetails', 'تفاصيل فاتورة البيع')}
                </span>
                <button class="gsearch-back" title="تعديل الفاتورة" onclick="globalSearch.goToInvoiceEdit('sales', ${id})">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => {
                const price = Number(item.price ?? item.sale_price ?? item.cost_price ?? 0) || 0;
                const discount = Number(item.discount_value ?? item.discount_amount);
                const discountText = Number.isFinite(discount) ? discount.toLocaleString() : '-';
                return `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${price.toLocaleString()}</td>
                    <td>${discountText}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `;
            }).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #10b981;">${invoice.invoice_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${invoice.invoice_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${invoice.customer_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.customer', 'العميل')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #10b981;">${(invoice.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalAmount', 'الإجمالي')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #0891b2;">${(invoice.paid_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.paidAmount', 'المدفوع')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: ${invoice.remaining_amount > 0 ? '#ea580c' : '#10b981'};">${(invoice.remaining_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.remainingAmount', 'المتبقي')}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.items', 'الأصناف')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.discount', 'الخصم')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${invoice.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${invoice.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading sales invoice:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    },

    async showPurchaseInvoiceDetails(id) {
        this.currentView = 'invoice-details';
        this.showLoading();
        
        try {
            const invoices = await window.electronAPI.getPurchaseInvoices();
            const invoice = invoices.find(inv => inv.id === id);
            
            if (!invoice) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.invoiceNotFound', 'الفاتورة غير موجودة')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getPurchaseInvoiceDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-file-invoice-dollar" style="color: #f59e0b; margin-left: 8px;"></i>
                    ${this.t('globalSearch.purchaseInvoiceDetails', 'تفاصيل فاتورة الشراء')}
                </span>
                <button class="gsearch-back" title="تعديل الفاتورة" onclick="globalSearch.goToInvoiceEdit('purchase', ${id})">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => {
                const price = Number(item.price ?? item.cost_price ?? item.sale_price ?? 0) || 0;
                const discount = Number(item.discount_value ?? item.discount_amount);
                const discountText = Number.isFinite(discount) ? discount.toLocaleString() : '-';
                return `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${price.toLocaleString()}</td>
                    <td>${discountText}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `;
            }).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #f59e0b;">${invoice.invoice_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${invoice.invoice_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${invoice.supplier_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.supplier', 'المورد')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #f59e0b;">${(invoice.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalAmount', 'الإجمالي')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #0891b2;">${(invoice.paid_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.paidAmount', 'المدفوع')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: ${invoice.remaining_amount > 0 ? '#ea580c' : '#10b981'};">${(invoice.remaining_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.remainingAmount', 'المتبقي')}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.items', 'الأصناف')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.discount', 'الخصم')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${invoice.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${invoice.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading purchase invoice:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    },

    async showSalesReturnDetails(id) {
        this.currentView = 'return-details';
        this.showLoading();
        
        try {
            const returns = await window.electronAPI.getSalesReturns();
            const returnDoc = returns.find(ret => ret.id === id);
            
            if (!returnDoc) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.returnNotFound', 'المرتجع غير موجود')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getSalesReturnDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-undo-alt" style="color: #8b5cf6; margin-left: 8px;"></i>
                    ${this.t('globalSearch.salesReturnDetails', 'تفاصيل مرتجع البيع')}
                </span>
                <button class="gsearch-back" title="تعديل المرتجع" onclick="globalSearch.goToInvoiceEdit('sales-return', ${id})">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${(item.price || 0).toLocaleString()}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #8b5cf6;">${returnDoc.return_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${returnDoc.return_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.customer_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.customer', 'العميل')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #8b5cf6;">${(returnDoc.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.returnAmount', 'مبلغ المرتجع')}</div>
                        </div>
                        ${returnDoc.original_invoice_number ? `
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.original_invoice_number}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.originalInvoice', 'الفاتورة الأصلية')}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.returnedItems', 'الأصناف المرتجعة')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${returnDoc.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${returnDoc.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading sales return:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    },

    async showPurchaseReturnDetails(id) {
        this.currentView = 'return-details';
        this.showLoading();
        
        try {
            const returns = await window.electronAPI.getPurchaseReturns();
            const returnDoc = returns.find(ret => ret.id === id);
            
            if (!returnDoc) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.returnNotFound', 'المرتجع غير موجود')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getPurchaseReturnDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-undo" style="color: #ec4899; margin-left: 8px;"></i>
                    ${this.t('globalSearch.purchaseReturnDetails', 'تفاصيل مرتجع الشراء')}
                </span>
                <button class="gsearch-back" title="تعديل المرتجع" onclick="globalSearch.goToInvoiceEdit('purchase-return', ${id})">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${(item.price || 0).toLocaleString()}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #ec4899;">${returnDoc.return_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${returnDoc.return_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.supplier_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.supplier', 'المورد')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #ec4899;">${(returnDoc.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.returnAmount', 'مبلغ المرتجع')}</div>
                        </div>
                        ${returnDoc.original_invoice_number ? `
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.original_invoice_number}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.originalInvoice', 'الفاتورة الأصلية')}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.returnedItems', 'الأصناف المرتجعة')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${returnDoc.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${returnDoc.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading purchase return:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    },

    backToSearch() {
        this.currentView = 'search';
        
        // إعادة الـ Header للحالة الأصلية
        const header = this.modal.querySelector('.gsearch-header');
        header.innerHTML = `
            <i class="fas fa-search"></i>
            <input type="text" class="gsearch-input" placeholder="${this.t('globalSearch.placeholder', 'ابحث عن صنف، عميل، أو مورد...')}">
            <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // إعادة تعيين المرجعيات
        this.input = this.modal.querySelector('.gsearch-input');
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // إعادة الـ Footer للحالة الأصلية
        const footer = this.modal.querySelector('.gsearch-footer');
        footer.innerHTML = `
            <div class="gsearch-shortcut">
                <kbd>↑↓</kbd> ${this.t('globalSearch.navigateHint', 'للتنقل')}
            </div>
            <div class="gsearch-shortcut">
                <kbd>Enter</kbd> ${this.t('globalSearch.selectHint', 'للاختيار')}
            </div>
            <div class="gsearch-shortcut">
                <kbd>Esc</kbd> ${this.t('globalSearch.closeHint', 'للإغلاق')}
            </div>
        `;
        
        // عرض النتائج السابقة أو الحالة الافتراضية
        if (this.results.length > 0) {
            this.displayResults();
        } else {
            this.showDefaultState();
        }
        
        // this.input.focus();
    },

    goToInvoiceEdit(type, id) {
        const currentPath = window.location.pathname;
        let basePath = '';

        const viewsMatch = currentPath.match(/.*[\/\\]views[\/\\]/);
        if (viewsMatch) {
            const afterViews = currentPath.substring(viewsMatch[0].length);
            const depth = (afterViews.match(/[\/\\]/g) || []).length;
            basePath = '../'.repeat(depth) || './';
        } else {
            basePath = './';
        }

        basePath = basePath.replace(/\/$/, '');

        let target = '';
        if (type === 'sales') {
            target = `${basePath}/sales/index.html?editId=${id}`;
        } else if (type === 'purchase') {
            target = `${basePath}/purchases/index.html?editId=${id}`;
        } else if (type === 'sales-return') {
            target = `${basePath}/sales-returns/index.html?editId=${id}`;
        } else if (type === 'purchase-return') {
            target = `${basePath}/purchase-returns/index.html?editId=${id}`;
        }

        if (!target) {
            return;
        }

        this.close();
        if (!window.__navigateWithinShell || !window.__navigateWithinShell(target)) {
            window.location.href = target;
        }
    }
    });
})();
