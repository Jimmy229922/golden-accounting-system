(function () {
    async function loadAllItemDetails({ t, formatCurrency }) {
        const detailRows = document.querySelectorAll('.items-detail-row[data-loaded="false"]');
        const loadPromises = [];

        detailRows.forEach((row) => {
            const type = row.dataset.detailType;
            const id = Number.parseInt(row.dataset.detailId, 10);
            if (!type || !Number.isFinite(id)) return;

            const promise = window.electronAPI.getStatementItemDetails({ type, id }).then((result) => {
                if (result && result.success && result.details.length > 0) {
                    const isPurchaseDetail = type === 'purchase';
                    let html = `<td colspan="8"><div class="items-detail-box"><table class="items-inner-table"><thead><tr>
                    <th>#</th>
                    <th>${t('customerReports.itemHeaders.name', 'الصنف')}</th>
                    <th>${t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                    ${isPurchaseDetail ? `<th>${t('customerReports.itemHeaders.rawQty', 'الكمية الخام')}</th><th>${t('customerReports.itemHeaders.discountRate', 'نسبة الخصم')}</th><th>${t('customerReports.itemHeaders.netQty', 'الكمية الصافية')}</th>` : `<th>${t('customerReports.itemHeaders.qty', 'الكمية')}</th>`}
                    <th>${t('customerReports.itemHeaders.price', 'السعر')}</th>
                    <th>${t('customerReports.itemHeaders.total', 'الإجمالي')}</th>
                    </tr></thead><tbody>`;
                    result.details.forEach((itm, i) => {
                        const rawQty = Number(itm.raw_quantity);
                        const rawQtyText = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : itm.quantity;
                        const qtyCells = isPurchaseDetail
                            ? `<td>${rawQtyText}</td><td>1%</td><td>${itm.quantity}</td>`
                            : `<td>${itm.quantity}</td>`;
                        html += `<tr><td>${i + 1}</td><td>${itm.item_name}</td><td>${itm.unit_name || '—'}</td>${qtyCells}<td>${formatCurrency(itm.price || 0)}</td><td>${formatCurrency(itm.total_price || 0)}</td></tr>`;
                    });
                    html += `</tbody></table></div></td>`;
                    row.innerHTML = html;
                } else {
                    row.innerHTML = `<td colspan="8"><div class="items-loading">${t('customerReports.noItems', 'لا توجد أصناف')}</div></td>`;
                }
                row.dataset.loaded = 'true';
            });

            loadPromises.push(promise);
        });

        await Promise.all(loadPromises);
    }

    window.customerReportsUtils = {
        loadAllItemDetails
    };
})();
