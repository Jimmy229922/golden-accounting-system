(function () {
    function renderWarehousesRows({ warehouses, t, normalizeName }) {
        if (!Array.isArray(warehouses) || warehouses.length === 0) {
            return `<tr><td colspan="2" class="empty-state">${t('openingBalance.noWarehouses', 'لا توجد مخازن مضافة')}</td></tr>`;
        }

        return warehouses.map((warehouse) => `
            <tr>
                <td>${normalizeName(warehouse.name)}</td>
                <td>
                    <button class="btn-edit-warehouse btn btn-outline" data-id="${warehouse.id}" data-name="${normalizeName(warehouse.name)}" title="${t('openingBalance.editEntry', 'تعديل')}" style="padding: 6px 12px; font-size: 0.85rem;">
                        <i class="fas fa-edit"></i> ${t('openingBalance.editEntry', 'تعديل')}
                    </button>
                    <button class="btn-delete-warehouse btn btn-danger" data-id="${warehouse.id}" title="${t('openingBalance.deleteEntry', 'حذف')}" style="padding: 6px 12px; font-size: 0.85rem;">
                        <i class="fas fa-trash"></i> ${t('openingBalance.deleteEntry', 'حذف')}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function renderHistoryRows({ data, t, formatCurrency, normalizeName }) {
        if (!Array.isArray(data) || data.length === 0) {
            return `<tr><td colspan="7" class="empty-state">${t('openingBalance.noData', 'لا توجد بيانات')}</td></tr>`;
        }

        return data.map((row) => `
            <tr>
                <td>${row.item_name || '-'}</td>
                <td><span class="warehouse-badge">${normalizeName(row.warehouse_name || '-')}</span></td>
                <td>${row.quantity}</td>
                <td>${formatCurrency(row.cost_price)}</td>
                <td>${formatCurrency(row.quantity * row.cost_price)}</td>
                <td class="muted">${row.created_at ? new Date(row.created_at).toLocaleDateString('ar-EG') : '-'}</td>
                <td>
                    <button class="btn-edit-entry btn btn-sm btn-outline btn-icon-text" data-id="${row.id}" title="${t('openingBalance.editEntry', 'تعديل')}">
                        <i class="fas fa-edit"></i> ${t('openingBalance.editEntry', 'تعديل')}
                    </button>
                    <button class="btn-delete-entry btn btn-sm btn-danger btn-icon-text" data-id="${row.id}" title="${t('openingBalance.deleteEntry', 'حذف')}">
                        <i class="fas fa-trash"></i> ${t('openingBalance.deleteEntry', 'حذف')}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    window.openingBalancePageRender = {
        renderWarehousesRows,
        renderHistoryRows
    };
})();
