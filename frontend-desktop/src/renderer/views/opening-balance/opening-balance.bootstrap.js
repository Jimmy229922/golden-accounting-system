document.addEventListener('DOMContentLoaded', async () => {
    try {
        let items = [];
        let history = [];
        let pendingEntries = [];
        let ar = {};
        const MAIN_WAREHOUSE_ID = 1;
        const { t } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f };
        const openingBalanceRender = window.openingBalancePageRender;
        const openingBalanceUtils = window.openingBalancePageUtils;
        const isInsideShellFrame = (() => {
            try {
                if (window.frameElement && window.frameElement.id === 'shellFrame') return true;
                return Boolean(window.top && window.top !== window && typeof window.top.__shellNavigate === 'function');
            } catch (_err) {
                return false;
            }
        })();

        if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
            ar = await window.i18n.loadArabicDictionary();
        }

        const nav = document.getElementById('main-nav');
        if (nav) {
            if (isInsideShellFrame) {
                nav.style.display = 'none';
                nav.classList.remove('top-nav');
            } else if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
                nav.innerHTML = window.navManager.getTopNavHTML(t, { wrap: false });
            }
        }

        openingBalanceUtils.applyI18nToDOM(t);
        setupInteractions();
        renderPendingItems();
        updateDocumentMeta();
        await loadData();

        window.addEventListener('focus', async () => {
            await loadData();
        });

        async function loadData() {
            try {
                const [itemsData, historyData] = await Promise.all([
                    window.electronAPI.getItems(),
                    window.electronAPI.getOpeningBalances()
                ]);
                items = itemsData || [];
                history = historyData || [];
                updateUI();
            } catch (error) {
                console.error('Error loading data:', error);
                Toast.show(t('openingBalance.toast.dataLoadError', 'فشل تحميل البيانات'), 'error');
            }
        }

        function updateUI() {
            updateStats();
            updateDocumentMeta();
            renderHistory();
            renderPendingItems();
        }

        function getNextOpeningBalanceDocNumber() {
            if (!Array.isArray(history) || history.length === 0) return 1;
            const maxId = history.reduce((maxVal, row) => {
                const id = Number(row?.id) || 0;
                return id > maxVal ? id : maxVal;
            }, 0);
            return maxId + 1;
        }

        function updateDocumentMeta() {
            const docNumberInput = document.getElementById('opening-balance-doc-number');
            const docDateInput = document.getElementById('opening-balance-doc-date');

            if (docNumberInput) {
                docNumberInput.value = `OB-${String(getNextOpeningBalanceDocNumber()).padStart(6, '0')}`;
            }

            if (docDateInput) {
                docDateInput.value = new Date().toLocaleDateString('en-GB');
            }
        }

        function updateStats() {
            document.getElementById('stats-total-items').textContent = history.length;
            const totalValue = history.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.cost_price || 0)), 0);
            document.getElementById('stats-total-value').textContent = formatCurrency(totalValue);
        }

        function setupInteractions() {
            document.getElementById('save-all-items-btn').addEventListener('click', savePendingItems);
            document.getElementById('clear-pending-items-btn').addEventListener('click', () => {
                pendingEntries = [createEmptyPendingEntry()];
                renderPendingItems();
            });

            document.getElementById('save-edit-entry-btn').addEventListener('click', saveEditEntry);
            document.getElementById('cancel-edit-entry-btn').addEventListener('click', () => {
                document.getElementById('edit-entry-modal').style.display = 'none';
            });

            document.getElementById('apply-filter-btn').addEventListener('click', filterHistory);
            document.getElementById('cancel-delete-entry-btn').addEventListener('click', () => {
                document.getElementById('delete-entry-modal').style.display = 'none';
            });

            document.getElementById('confirm-delete-entry-btn').addEventListener('click', async () => {
                const id = document.getElementById('delete-entry-id').value;
                try {
                    const result = await window.electronAPI.deleteOpeningBalance(id);
                    if (result.success) {
                        Toast.show(t('openingBalance.toast.deleteSuccess', 'تم الحذف بنجاح'), 'success');
                        document.getElementById('delete-entry-modal').style.display = 'none';
                        await loadData();
                    } else {
                        Toast.show(t('openingBalance.errorPrefix', 'خطأ: ') + result.error, 'error');
                    }
                } catch (error) {
                    console.error(error);
                    Toast.show(t('openingBalance.toast.deleteError', 'حدث خطأ أثناء الحذف'), 'error');
                }
            });
        }

        function createEmptyPendingEntry() {
            return {
                item_id: null,
                warehouse_id: MAIN_WAREHOUSE_ID,
                quantity: 1,
                cost_price: 0,
                unit_name: ''
            };
        }

        function renderPendingItems() {
            const tbody = document.getElementById('pending-items-tbody');
            const saveAllBtn = document.getElementById('save-all-items-btn');
            const clearBtn = document.getElementById('clear-pending-items-btn');
            const docTotalInput = document.getElementById('opening-balance-doc-total');

            if (!pendingEntries.length) {
                pendingEntries.push(createEmptyPendingEntry());
            }

            saveAllBtn.disabled = pendingEntries.every((entry) => !Number(entry.item_id));
            clearBtn.disabled = pendingEntries.length === 0;

            const invoiceTotal = pendingEntries.reduce((sum, entry) => {
                return sum + ((Number(entry.quantity) || 0) * (Number(entry.cost_price) || 0));
            }, 0);

            if (docTotalInput) {
                docTotalInput.value = invoiceTotal.toFixed(2);
            }

            const itemPlaceholder = t('openingBalance.selectItemPlaceholder', 'اختر الصنف...');
            tbody.innerHTML = pendingEntries.map((entry, index) => {
                const itemOptions = [`<option value="">${itemPlaceholder}</option>`]
                    .concat(items.map((item) => {
                        const selected = Number(entry.item_id) === Number(item.id) ? 'selected' : '';
                        return `<option value="${item.id}" ${selected}>${item.name} - ${item.barcode || ''} (${t('openingBalance.currentQtyLabel', 'الكمية الحالية')}: ${item.stock_quantity || 0})</option>`;
                    }))
                    .join('');

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>
                            <select class="form-control pending-row-control pending-item-select item-select autocomplete-show-all-on-click" data-index="${index}">
                                ${itemOptions}
                            </select>
                        </td>
                        <td><span class="pending-row-unit">${entry.unit_name || '-'}</span></td>
                        <td>
                            <input type="number" class="form-control pending-row-control pending-qty-input" data-index="${index}" min="0.01" step="0.01" value="${Number(entry.quantity) || 0}">
                        </td>
                        <td>
                            <input type="number" class="form-control pending-row-control pending-cost-input" data-index="${index}" min="0" step="0.01" value="${Number(entry.cost_price) || 0}">
                        </td>
                        <td><span class="pending-row-total">${formatCurrency((Number(entry.quantity) || 0) * (Number(entry.cost_price) || 0))}</span></td>
                        <td>
                            <button class="btn btn-danger pending-row-remove" data-index="${index}">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.pending-item-select').forEach((select) => {
                new Autocomplete(select);
                select.addEventListener('change', () => {
                    const index = Number(select.dataset.index);
                    const item = items.find((entry) => Number(entry.id) === Number(select.value));
                    if (!pendingEntries[index]) return;

                    pendingEntries[index].item_id = item ? Number(item.id) : null;
                    pendingEntries[index].unit_name = item?.unit_name || '';
                    if (item && (!Number(pendingEntries[index].cost_price) || Number(pendingEntries[index].cost_price) <= 0)) {
                        pendingEntries[index].cost_price = Number(item.cost_price) || 0;
                    }

                    if (Number(pendingEntries[index].item_id) && index === pendingEntries.length - 1) {
                        pendingEntries.push(createEmptyPendingEntry());
                    }

                    renderPendingItems();
                });
            });

            tbody.querySelectorAll('.pending-qty-input').forEach((input) => {
                input.addEventListener('change', () => {
                    const index = Number(input.dataset.index);
                    if (!pendingEntries[index]) return;
                    pendingEntries[index].quantity = Number(input.value) || 0;
                    renderPendingItems();
                });
            });

            tbody.querySelectorAll('.pending-cost-input').forEach((input) => {
                input.addEventListener('change', () => {
                    const index = Number(input.dataset.index);
                    if (!pendingEntries[index]) return;
                    pendingEntries[index].cost_price = Number(input.value) || 0;
                    renderPendingItems();
                });
            });

            tbody.querySelectorAll('.pending-row-remove').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const index = Number(btn.dataset.index);
                    if (Number.isNaN(index)) return;
                    pendingEntries.splice(index, 1);
                    renderPendingItems();
                });
            });
        }

        async function savePendingItems() {
            const entriesToSave = pendingEntries.filter((entry, index) => {
                if (Number(entry.item_id)) return true;
                return index !== pendingEntries.length - 1;
            });

            if (!entriesToSave.length) {
                Toast.show('لا توجد أصناف جاهزة للحفظ', 'error');
                return;
            }

            for (let i = 0; i < entriesToSave.length; i += 1) {
                const entry = entriesToSave[i];
                if (!Number(entry.item_id)) {
                    Toast.show(`يرجى اختيار الصنف في السطر رقم ${i + 1}`, 'error');
                    return;
                }
                if (!Number(entry.quantity) || Number(entry.quantity) <= 0) {
                    Toast.show(`يرجى إدخال كمية صحيحة في السطر رقم ${i + 1}`, 'error');
                    return;
                }
                if (Number(entry.cost_price) < 0) {
                    Toast.show(`يرجى إدخال سعر شراء صحيح في السطر رقم ${i + 1}`, 'error');
                    return;
                }
            }

            try {
                const result = await window.electronAPI.saveOpeningBalances(entriesToSave.map((entry) => ({
                    item_id: Number(entry.item_id),
                    quantity: Number(entry.quantity),
                    cost_price: Number(entry.cost_price) || 0
                })));

                if (result && result.success) {
                    pendingEntries = [createEmptyPendingEntry()];
                    renderPendingItems();
                    Toast.show(t('openingBalance.toast.saveSuccess', 'تم حفظ الرصيد بنجاح'), 'success');
                    await loadData();
                    return;
                }

                Toast.show((t('openingBalance.toast.saveFailed', 'فشل الحفظ: ') || 'فشل الحفظ: ') + (result?.error || ''), 'error');
            } catch (error) {
                console.error(error);
                Toast.show(t('openingBalance.toast.saveError', 'حدث خطأ أثناء الحفظ'), 'error');
            }
        }

        function formatCurrency(amount) {
            const n = Number(amount) || 0;
            return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
        }

        function renderHistory(filteredHistory = null) {
            const data = filteredHistory || history;
            const tbody = document.getElementById('history-tbody');

            tbody.innerHTML = openingBalanceRender.renderHistoryRows({
                data,
                t,
                formatCurrency
            });

            if (data.length === 0) {
                return;
            }

            document.querySelectorAll('.btn-edit-entry').forEach((btn) => {
                btn.addEventListener('click', () => openEditEntryModal(btn.dataset.id));
            });

            document.querySelectorAll('.btn-delete-entry').forEach((btn) => {
                btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
            });
        }

        function filterHistory() {
            const search = document.getElementById('history-search').value.toLowerCase();
            const dateFrom = document.getElementById('history-date-from').value;
            const dateTo = document.getElementById('history-date-to').value;

            const filtered = history.filter((row) => {
                const matchesSearch = row.item_name && row.item_name.toLowerCase().includes(search);
                let matchesDate = true;

                if (dateFrom || dateTo) {
                    const rowDate = new Date(row.created_at).toISOString().split('T')[0];
                    if (dateFrom && rowDate < dateFrom) matchesDate = false;
                    if (dateTo && rowDate > dateTo) matchesDate = false;
                }

                return matchesSearch && matchesDate;
            });

            renderHistory(filtered);
        }

        function openEditEntryModal(id) {
            const entry = history.find((row) => row.id == id);
            if (!entry) return;

            document.getElementById('edit-entry-id').value = entry.id;
            document.getElementById('edit-entry-item').value = entry.item_name;
            document.getElementById('edit-entry-quantity').value = entry.quantity;
            document.getElementById('edit-entry-cost').value = entry.cost_price;
            document.getElementById('edit-entry-modal').style.display = 'flex';
        }

        async function saveEditEntry() {
            const id = document.getElementById('edit-entry-id').value;
            const quantity = parseFloat(document.getElementById('edit-entry-quantity').value);
            const costPrice = parseFloat(document.getElementById('edit-entry-cost').value);

            if (!quantity || quantity <= 0) {
                Toast.show(t('openingBalance.toast.invalidQuantity', 'الكمية غير صحيحة'), 'error');
                return;
            }

            try {
                const result = await window.electronAPI.updateOpeningBalance({
                    id,
                    quantity,
                    cost_price: costPrice
                });

                if (result.success) {
                    Toast.show(t('openingBalance.toast.updateSuccess', 'تم التعديل بنجاح'), 'success');
                    document.getElementById('edit-entry-modal').style.display = 'none';
                    await loadData();
                } else {
                    Toast.show(t('openingBalance.errorPrefix', 'خطأ: ') + result.error, 'error');
                }
            } catch (error) {
                console.error(error);
                Toast.show(t('openingBalance.toast.updateError', 'حدث خطأ أثناء التعديل'), 'error');
            }
        }

        function deleteEntry(id) {
            document.getElementById('delete-entry-id').value = id;
            document.getElementById('delete-entry-modal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error('حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل');
        }
    }
});
