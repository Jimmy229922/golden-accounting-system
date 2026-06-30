(function () {
    function renderHistoryRows({ data, t, formatCurrency }) {
        if (!Array.isArray(data) || data.length === 0) {
            return `<tr><td colspan="6" class="empty-state">${t('openingBalance.noData', 'لا توجد بيانات')}</td></tr>`;
        }

        return data.map((row) => `
            <tr>
                <td>${row.item_name || '-'}</td>
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
        renderHistoryRows
    };
})();
