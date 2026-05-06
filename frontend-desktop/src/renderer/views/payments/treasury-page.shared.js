(function () {
    function initializeTreasuryVoucherPage(config) {
        let ar = {};
        let allEntities = [];
        let selectedEntity = null;
        let recentTransactions = [];
        let entityAutocomplete = null;
        let suggestedVoucherNumber = '';
        let currentEditId = null;

        const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
        const tx = (suffix, fallback = '') => t(`${config.i18nPrefix}.${suffix}`, fallback);
        const text = (name) => {
            const entry = config.text?.[name];
            if (!entry) return '';
            return tx(entry.key, entry.fallback);
        };
        const renderer = window.createTreasuryPageRenderer
            ? window.createTreasuryPageRenderer({ config, t, tx, text })
            : null;

        function getViewVoucherRequest() {
            const params = new URLSearchParams(window.location.search);
            const viewId = (params.get('viewId') || params.get('editId') || '').trim();
            const voucher = (params.get('voucher') || '').trim();
            if (params.get('editId')) {
                currentEditId = params.get('editId');
            }
            return { viewId, voucher };
        }

        async function handleVoucherViewRequest() {
            const { viewId, voucher } = getViewVoucherRequest();
            if (!viewId && !voucher) return;

            try {
                const transactions = await window.electronAPI.getTreasuryTransactions();
                let target = null;

                if (viewId) {
                    target = transactions.find(
                        (tr) => String(tr.id) === String(viewId) && tr.type === config.transactionType
                    );
                }

                if (!target && voucher) {
                    target = transactions.find(
                        (tr) =>
                            tr.type === config.transactionType &&
                            String(tr.voucher_number || '').trim() === voucher
                    );
                }

                if (!target) {
                    if (voucher) {
                        document.getElementById(config.ids.voucherInput).value = voucher;
                        await searchVoucher();
                    }
                    showToast(text('toastVoucherNotFound'), 'warning');
                    return;
                }

                if (target.transaction_date) {
                    document.getElementById('date').value = String(target.transaction_date).split('T')[0];
                }

                if (target.voucher_number) {
                    document.getElementById(config.ids.voucherInput).value = target.voucher_number;
                }

                if (target.customer_id) {
                    document.getElementById(config.ids.entitySelect).value = String(target.customer_id);
                    handleEntityChange();
                }

                document.getElementById('amount').value = Number(target.amount || 0).toFixed(2);
                document.getElementById('description').value = target.description || '';
                updatePreview();

                if (target.voucher_number) {
                    await searchVoucher();
                }

                showToast(text('toastLoadedFromReport'), 'success');
            } catch (error) {
                console.error(`Error loading ${config.pageId} voucher from report:`, error);
            }
        }

        function renderPage() {
            if (!renderer) return;
            renderer.renderPage();
        }

        function initializeElements() {
            document.getElementById('date').valueAsDate = new Date();
            generateVoucherNumber();
            document.getElementById(config.ids.form).addEventListener('submit', handleSubmit);
            document.getElementById('app').addEventListener('click', handleActionClick);
            document
                .getElementById(config.ids.entitySelect)
                .addEventListener('change', handleEntityChange);
            document.getElementById('amount').addEventListener('input', updatePreview);
            document.getElementById('voucherSearchBtn').addEventListener('click', searchVoucher);
        }

        function handleActionClick(event) {
            const actionEl = event.target.closest('[data-action]');
            if (!actionEl) return;

            const action = actionEl.dataset.action;
            if (action === 'quick-amount') {
                const amount = Number.parseFloat(actionEl.dataset.amount || '0');
                setQuickAmount(Number.isFinite(amount) ? amount : 0);
                return;
            }

            if (action === 'pay-full-balance') {
                payFullBalance();
                return;
            }

            if (action === 'close-voucher-search') {
                const resultContainer = document.getElementById('voucherSearchResult');
                if (resultContainer) {
                    resultContainer.style.display = 'none';
                }
            }
        }

        async function applyStatementBalances(entities) {
            if (!config.entity.useStatementBalance) return entities;

            const statementEntities = await Promise.all(entities.map(async (entity) => {
                try {
                    const result = await window.electronAPI.getCustomerDetailedStatement({
                        customerId: entity.id
                    });
                    if (!result || !result.success || !result.totals) return entity;

                    const closingBalance = Number(result.totals.closingBalance) || 0;
                    return {
                        ...entity,
                        balance: config.entity.invertStatementBalance ? -closingBalance : closingBalance
                    };
                } catch (error) {
                    console.error('[payments] Error loading statement balance:', error);
                    return entity;
                }
            }));

            return statementEntities;
        }

        async function loadData() {
            try {
                const customers = await window.electronAPI.getCustomers();
                allEntities = customers.filter((entity) =>
                    config.entity.filterTypes.includes(entity.type)
                );
                allEntities = await applyStatementBalances(allEntities);

                const select = document.getElementById(config.ids.entitySelect);
                select.innerHTML = `<option value="">${text('searchPlaceholder')}</option>`;
                allEntities.forEach((entity) => {
                    const option = document.createElement('option');
                    option.value = entity.id;
                    option.textContent = `${entity.name} ${
                        entity.balance > 0
                            ? fmt(text('owedSuffix'), { amount: entity.balance.toFixed(2) })
                            : ''
                    }`;
                    select.appendChild(option);
                });

                const transactions = await window.electronAPI.getTreasuryTransactions();
                const datalist = document.getElementById('voucherSuggestions');
                datalist.innerHTML = '';
                const filteredTransactions = transactions
                    .filter((tr) => tr.type === config.transactionType && tr.voucher_number)
                    .slice(0, 20);
                filteredTransactions.forEach((tr) => {
                    const option = document.createElement('option');
                    option.value = tr.voucher_number;
                    datalist.appendChild(option);
                });

                if (entityAutocomplete) {
                    entityAutocomplete.refresh();
                } else {
                    entityAutocomplete = new Autocomplete(select);
                }
                bindEntityAutocompleteClearHandler();

                recentTransactions = transactions
                    .filter((tr) => tr.type === config.transactionType && tr.customer_id)
                    .slice(0, 5);

                renderRecentTransactions();
                calculateStats();
            } catch (error) {
                console.error('Error loading data:', error);
                showToast(text('toastLoadError'), 'error');
            }
        }

        function bindEntityAutocompleteClearHandler() {
            const select = document.getElementById(config.ids.entitySelect);
            const entityInput = entityAutocomplete?.input;
            if (!select || !entityInput) return;

            if (entityInput.dataset.clearSelectionBound === '1') return;
            entityInput.dataset.clearSelectionBound = '1';

            entityInput.addEventListener('input', () => {
                if (entityInput.value.trim() !== '') return;
                if (!select.value) return;

                select.value = '';
                handleEntityChange();
            });

            const shell = select.closest('.input-with-icon');
            if (!shell) return;

            shell.addEventListener('click', (event) => {
                if (event.target.closest('.autocomplete-input')) return;
                if (entityInput.disabled) return;

                entityInput.focus();
                if (entityAutocomplete) {
                    const currentFilter = entityInput.value.trim().toLowerCase();
                    entityAutocomplete.renderList(currentFilter);
                }
            });
        }

        async function generateVoucherNumber() {
            try {
                const result = await window.electronAPI.getNextTreasuryVoucherNumber(config.transactionType);
                if (result?.success && result.voucher_number) {
                    suggestedVoucherNumber = result.voucher_number;
                    document.getElementById(config.ids.voucherInput).value = result.voucher_number;
                    return;
                }
                throw new Error(result?.error || 'Failed to get next voucher number');
            } catch (error) {
                const fallbackVoucher = `${config.numberPrefix}-${Date.now()}`;
                suggestedVoucherNumber = fallbackVoucher;
                document.getElementById(config.ids.voucherInput).value = fallbackVoucher;
            }
        }

        function handleEntityChange() {
            const selectEl = document.getElementById(config.ids.entitySelect);
            const entityId = selectEl.value;
            if (!entityId) {
                renderEntityPlaceholder();
                updatePreview();
                if (entityAutocomplete && entityAutocomplete.input) {
                    entityAutocomplete.input.value = '';
                }
                return;
            }

            selectedEntity = allEntities.find((entity) => entity.id == entityId);
            if (selectedEntity) {
                renderEntityInfo(selectedEntity);
                updatePreview();
                if (entityAutocomplete && entityAutocomplete.input) {
                    const selectedOption = Array.from(selectEl.options).find(opt => opt.value == entityId);
                    if (selectedOption) {
                        entityAutocomplete.input.value = selectedOption.textContent;
                    }
                }
            }
        }

        function renderEntityInfo(entity) {
            if (!renderer) return;
            renderer.renderEntityInfo(entity);
        }

        function renderEntityPlaceholder() {
            if (renderer) renderer.renderEntityPlaceholder();
            selectedEntity = null;
            updatePreview();
        }

        function formatBalancePreview(balance) {
            if (balance > 0) {
                return `${balance.toFixed(2)} ${text('balanceOwed')}`;
            }
            if (balance < 0) {
                return `${Math.abs(balance).toFixed(2)} ${text('balanceCredit')}`;
            }
            return `0.00 ${text('balanceBalanced')}`;
        }

        function updatePreview() {
            const currentEl = document.getElementById('previewCurrentBalance');
            const afterEl = document.getElementById('previewAfterBalance');
            if (!currentEl || !afterEl) return;

            const resetPreviewClasses = (el) => {
                if (!el) return;
                el.classList.remove('positive', 'negative', 'zero');
            };

            const applyPreviewClass = (el, balance) => {
                if (!el) return;
                resetPreviewClasses(el);
                if (balance > 0) {
                    el.classList.add('positive');
                } else if (balance < 0) {
                    el.classList.add('negative');
                } else {
                    el.classList.add('zero');
                }
            };

            if (!selectedEntity) {
                resetPreviewClasses(currentEl);
                resetPreviewClasses(afterEl);
                currentEl.textContent = '-';
                afterEl.textContent = '-';
                return;
            }

            const currentBalance = Number(selectedEntity.balance) || 0;
            const amount = Number.parseFloat(document.getElementById('amount').value) || 0;
            const afterBalance = currentBalance - amount;

            currentEl.textContent = formatBalancePreview(currentBalance);
            afterEl.textContent = formatBalancePreview(afterBalance);
            applyPreviewClass(currentEl, currentBalance);
            applyPreviewClass(afterEl, afterBalance);
        }

        function renderRecentTransactions() {
            if (!renderer) return;
            renderer.renderRecentTransactions({ recentTransactions, allEntities });
        }

        function calculateStats() {
            const today = new Date().toISOString().split('T')[0];

            const todayTotal = recentTransactions
                .filter((tr) => tr.transaction_date === today)
                .reduce((sum, tr) => sum + tr.amount, 0);
            document.getElementById(config.ids.todayStat).textContent = todayTotal.toFixed(2);

            const positiveBalanceEntities = allEntities.filter((entity) => entity.balance > 0);
            document.getElementById(config.ids.countStat).textContent = positiveBalanceEntities.length;

            const totalPositiveBalance = positiveBalanceEntities.reduce(
                (sum, entity) => sum + entity.balance,
                0
            );
            document.getElementById(config.ids.totalStat).textContent =
                totalPositiveBalance.toFixed(2);
        }

        function setQuickAmount(amount) {
            document.getElementById('amount').value = amount;
            // document.getElementById('amount').focus();
            updatePreview();
        }

        function payFullBalance() {
            if (!selectedEntity) {
                showToast(text('toastSelectEntityWithBalance'), 'warning');
                return;
            }

            const entityBalance = Number(selectedEntity.balance) || 0;

            if (entityBalance > 0) {
                document.getElementById('amount').value = entityBalance.toFixed(2);
                document.getElementById('description').value = text('fullBalanceDescription');
                updatePreview();
                return;
            }

            if (entityBalance === 0) {
                const entityType = text('entityType') || 'حساب';
                showToast(`ال${entityType} المختار رصيده متزن ولا يوجد رصيد مستحق.`, 'warning');
                return;
            }

            showToast(text('toastSelectEntityWithBalance'), 'warning');
        }
        async function handleSubmit(e) {
            e.preventDefault();

            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text('toastSaving')}`;

            try {
                const voucherNumberForDescription =
                    suggestedVoucherNumber ||
                    document.getElementById(config.ids.voucherInput).value ||
                    `${config.numberPrefix}-${Date.now()}`;
                const data = {
                    type: config.transactionType,
                    date: document.getElementById('date').value,
                    customer_id: document.getElementById(config.ids.entitySelect).value,
                    amount: parseFloat(document.getElementById('amount').value),
                    description:
                        document.getElementById('description').value ||
                        fmt(text('defaultDescriptionTemplate'), { number: voucherNumberForDescription })
                };

                if (config.deferCustomerCollectionsToShiftClose && config.transactionType === 'income') {
                    data.defer_to_sales_shift_close = true;
                }

                if (!data.customer_id || !data.amount || data.amount <= 0) {
                    showToast(text('toastFillRequired'), 'error');
                    return;
                }

                let result;
                if (currentEditId) {
                    data.id = currentEditId;
                    result = await window.electronAPI.updateTreasuryTransaction(data);
                } else {
                    result = await window.electronAPI.addTreasuryTransaction(data);
                }

                if (result.success) {
                    showToast(text('toastSaveSuccess'), 'success');
                    if (currentEditId) {
                        setTimeout(() => {
                            if (window.__navigateWithinShell) {
                                window.__navigateWithinShell('../reports/index.html');
                            } else {
                                window.location.href = '../reports/index.html';
                            }
                        }, 1000);
                        return;
                    }
                    document.getElementById(config.ids.form).reset();
                    document.getElementById('date').valueAsDate = new Date();
                    await generateVoucherNumber();
                    renderEntityPlaceholder();
                    if (entityAutocomplete) entityAutocomplete.refresh();
                    loadData();
                } else {
                    showToast(fmt(text('toastSaveError'), { error: result.error }), 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast(text('toastUnexpectedError'), 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${text('submitBtn')}`;
            }
        }

        function showToast(message, type = 'info') {
            if (window.toast && typeof window.toast[type] === 'function') {
                window.toast[type](message);
                return;
            }

            if (typeof Toast !== 'undefined') {
                Toast.show(message, type);
                return;
            }

            if (type === 'error') {
                console.error('[payments]', message);
                return;
            }

            console.log('[payments]', message);
        }

        async function searchVoucher() {
            const voucherNumber = document.getElementById(config.ids.voucherInput).value.trim();
            const resultContainer = document.getElementById('voucherSearchResult');
            if (!voucherNumber) {
                resultContainer.style.display = 'none';
                return;
            }
            try {
                const res = await window.electronAPI.searchTreasuryByVoucher(voucherNumber);
                const results = Array.isArray(res?.results)
                    ? res.results.filter((tr) => tr.type === config.transactionType)
                    : [];

                if (res.success && results.length > 0) {
                    resultContainer.style.display = 'block';
                    resultContainer.innerHTML = renderer
                        ? renderer.renderVoucherSearchResults(results)
                        : '';
                } else {
                    resultContainer.style.display = 'block';
                    resultContainer.innerHTML = renderer ? renderer.renderVoucherNoResults() : '';
                }
            } catch (err) {
                console.error(err);
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            ar = (await window.i18n?.loadArabicDictionary?.()) || {};
            renderPage();
            initializeElements();
            await loadData();
            await handleVoucherViewRequest();
        });
    }

    window.initializeTreasuryVoucherPage = initializeTreasuryVoucherPage;
})();


