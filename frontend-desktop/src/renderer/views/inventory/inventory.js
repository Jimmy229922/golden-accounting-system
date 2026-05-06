let inventoryTableBody, searchInput, itemCardModal, itemCardBody, modalItemName;
let damagedTableBody, damagedItemSelect, damagedWarehouseSelect, damagedQuantityInput, damagedReasonInput;
let damagedBatchInput, damagedExpiryInput, damagedDateInput, damagedNotesInput, damagedManagerModal, damagedEditModal;
let editDamagedId, editDamagedItemSelect, editDamagedWarehouseSelect, editDamagedQuantityInput, editDamagedReasonInput;
let editDamagedBatchInput, editDamagedExpiryInput, editDamagedDateInput, editDamagedNotesInput;
let allItems = [];
let allWarehouses = [];
let damagedEntries = [];
let currentUserIsAdmin = false;
let currentUserCanEditDamaged = false;
let currentUserCanDeleteDamaged = false;
let showShortagesOnly = false;
let damagedItemAutocomplete = null;
let editDamagedItemAutocomplete = null;
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}
document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    initializeElements();
    await loadInventory();
    await initializeDamagedStockSection();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});
function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildTopNavHTML()}
        <div class="content">
            <div class="inv-hero">
                <div class="hero-shapes">
                    <div class="hero-shape shape-1"></div>
                    <div class="hero-shape shape-2"></div>
                    <div class="hero-shape shape-3"></div>
                </div>
                <div class="hero-content">
                    <h1>${t('inventory.reportTitle', '????? ??????')}</h1>
                    <p>${t('inventory.heroSubtitle', '?????? ????? ????? ??????? ???????? ?????? ????????')}</p>
                </div>
            </div>
            <div class="inv-stats">
                <div class="inv-stat-card stat-items">
                    <div class="inv-stat-icon"><i class="fas fa-boxes-stacked"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalItemsCount', '?????? ??? ???????')}</div>
                        <div class="inv-stat-value" id="totalItems">0</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-qty">
                    <div class="inv-stat-icon"><i class="fas fa-cubes"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalQuantity', '?????? ??????')}</div>
                        <div class="inv-stat-value" id="totalQuantity">0</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-cost">
                    <div class="inv-stat-icon"><i class="fas fa-coins"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalValuePurchase', '?????? ???? ?????? (????)')}</div>
                        <div class="inv-stat-value" id="totalValue">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-sale">
                    <div class="inv-stat-icon"><i class="fas fa-tag"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalValueSale', '?????? ???? ?????? (???)')}</div>
                        <div class="inv-stat-value" id="totalSaleValue">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-profit">
                    <div class="inv-stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.profitMargin', '???? ????? ???????')}</div>
                        <div class="inv-stat-value" id="profitMargin">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-low">
                    <div class="inv-stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.lowStockCount', '????? ??? ????')}</div>
                        <div class="inv-stat-value" id="lowStockCount">0</div>
                    </div>
                </div>
            </div>
            <div class="inv-controls">
                <div class="inv-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="searchInput" placeholder="${t('inventory.searchPlaceholder', '??? ?? ??? (????? ?? ????????)...')}">
                </div>
                <button id="shortageBtn" class="inv-filter-btn" data-action="toggle-shortages">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${t('inventory.showShortagesOnly', '??? ??????? ???')}
                </button>
                <button class="inv-filter-btn inv-damaged-open-btn" data-action="open-damaged-manager">
                    <i class="fas fa-heart-crack"></i>
                    ${t('inventory.damagedTitle', 'إدارة التالف')}
                </button>
            </div>
            <div class="inv-table-card">
                <div class="inv-table-header">
                    <h3><i class="fas fa-clipboard-list"></i> ${t('inventory.reportTitle', '????? ??????')} <span class="inv-count-badge" id="itemCountBadge">0</span></h3>
                </div>
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th>${t('inventory.tableHeaders.barcode', '????????')}</th>
                            <th>${t('inventory.tableHeaders.itemName', '?????')}</th>
                            <th>${t('inventory.tableHeaders.unit', '??????')}</th>
                            <th>${t('inventory.tableHeaders.currentQty', '?????? ???????')}</th>
                            <th>${t('inventory.tableHeaders.costPrice', '??? ???????')}</th>
                            <th>${t('inventory.tableHeaders.salePrice', '??? ?????')}</th>
                            <th>${t('inventory.tableHeaders.totalValue', '?????? ??????')}</th>
                            <th>${t('inventory.tableHeaders.status', '??????')}</th>
                            <th>${t('inventory.tableHeaders.actions', '???????')}</th>
                        </tr>
                    </thead>
                    <tbody id="inventoryTableBody"></tbody>
                </table>
            </div>

            <div id="damagedManagerModal" class="inv-modal">
                <div class="inv-modal-content inv-damaged-manager-modal">
                    <div class="inv-modal-header">
                        <h2>${t('inventory.damagedTitle', 'إدارة التالف')}</h2>
                        <button class="inv-modal-close" data-action="close-damaged-manager"><i class="fas fa-times"></i></button>
                    </div>

                    <div class="inv-table-card inv-damaged-card">
                        <div class="inv-table-header inv-damaged-header">
                            <h3><i class="fas fa-heart-crack"></i> ${t('inventory.damagedTitle', 'إدارة التالف')} <span class="inv-count-badge" id="damagedCountBadge">0</span></h3>
                            <div class="inv-damaged-summary" id="damagedSummaryBadge">
                                <span>${t('inventory.damagedCount', 'عدد السجلات')}: <strong id="damagedSummaryCount">0</strong></span>
                                <span>${t('inventory.damagedQty', 'إجمالي الكمية')}: <strong id="damagedSummaryQty">0</strong></span>
                                <span>${t('inventory.damagedLoss', 'إجمالي الخسارة')}: <strong id="damagedSummaryLoss">0.00</strong></span>
                            </div>
                        </div>

                        <div class="inv-damaged-form-grid">
                            <div class="inv-damaged-field">
                                <label>${t('inventory.damagedItem', 'الصنف')}</label>
                                <select id="damagedItemSelect"></select>
                            </div>
                            <div class="inv-damaged-field">
                                <label>${t('inventory.damagedWarehouse', 'المخزن')}</label>
                                <select id="damagedWarehouseSelect"></select>
                            </div>
                            <div class="inv-damaged-field">
                                <label>${t('inventory.damagedQuantity', 'الكمية التالفة')}</label>
                                <input id="damagedQuantityInput" type="number" min="0.0001" step="0.0001" placeholder="0.0000">
                            </div>
                            <div class="inv-damaged-field">
                                <label>${t('inventory.damagedReason', 'سبب التالف')}</label>
                                <input id="damagedReasonInput" type="text" placeholder="مثال: تلف أثناء النقل">
                            </div>
                            <div class="inv-damaged-field">
                                <label>${t('inventory.damagedBatch', 'رقم التشغيلة')}</label>
                                <input id="damagedBatchInput" type="text" placeholder="اختياري">
                            </div>
                            <div class="inv-damaged-field">
                                <label>${t('inventory.damagedExpiry', 'تاريخ الصلاحية')}</label>
                                <input id="damagedExpiryInput" type="date">
                            </div>
                            <div class="inv-damaged-field">
                                <label>${t('inventory.damagedDate', 'تاريخ التالف')}</label>
                                <input id="damagedDateInput" type="date">
                            </div>
                            <div class="inv-damaged-field inv-damaged-notes">
                                <label>${t('inventory.damagedNotes', 'ملاحظات')}</label>
                                <input id="damagedNotesInput" type="text" placeholder="اختياري">
                            </div>
                        </div>

                        <div class="inv-damaged-actions">
                            <button class="inv-action-btn inv-add-btn" data-action="add-damaged-entry">
                                <i class="fas fa-plus"></i>
                                ${t('inventory.addDamagedEntry', 'إضافة حركة تالف')}
                            </button>
                        </div>

                        <table class="inv-table inv-damaged-table">
                            <thead>
                                <tr>
                                    <th>${t('inventory.modalHeaders.date', 'التاريخ')}</th>
                                    <th>${t('inventory.tableHeaders.itemName', 'الصنف')}</th>
                                    <th>${t('inventory.damagedWarehouse', 'المخزن')}</th>
                                    <th>${t('inventory.damagedQuantity', 'الكمية')}</th>
                                    <th>${t('inventory.damagedReason', 'السبب')}</th>
                                    <th>${t('inventory.damagedLoss', 'الخسارة')}</th>
                                    <th>${t('inventory.tableHeaders.actions', 'الإجراءات')}</th>
                                </tr>
                            </thead>
                            <tbody id="damagedTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="itemCardModal" class="inv-modal">
                <div class="inv-modal-content">
                    <div class="inv-modal-header">
                        <h2 id="modalItemName">${t('inventory.itemCard', '???? ?????')}</h2>
                        <button class="inv-modal-close" data-action="close-item-card"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="inv-modal-stats" id="modalStats"></div>
                    <table class="inv-table">
                        <thead>
                            <tr>
                                <th>${t('inventory.modalHeaders.date', '???????')}</th>
                                <th>${t('inventory.modalHeaders.movementType', '??? ??????')}</th>
                                <th>${t('inventory.modalHeaders.docNumber', '??? ???????')}</th>
                                <th>${t('inventory.modalHeaders.party', '????? (????/????)')}</th>
                                <th>${t('inventory.modalHeaders.incoming', '????')}</th>
                                <th>${t('inventory.modalHeaders.outgoing', '????')}</th>
                                <th>${t('inventory.modalHeaders.price', '?????')}</th>
                            </tr>
                        </thead>
                        <tbody id="itemCardBody"></tbody>
                    </table>
                </div>
            </div>

            <div id="damagedEditModal" class="inv-modal">
                <div class="inv-modal-content inv-damaged-edit-modal">
                    <div class="inv-modal-header">
                        <h2>${t('inventory.editDamagedTitle', 'تعديل حركة تالف')}</h2>
                        <button class="inv-modal-close" data-action="close-damaged-modal"><i class="fas fa-times"></i></button>
                    </div>

                    <input id="editDamagedId" type="hidden">

                    <div class="inv-damaged-form-grid">
                        <div class="inv-damaged-field">
                            <label>${t('inventory.damagedItem', 'الصنف')}</label>
                            <select id="editDamagedItemSelect"></select>
                        </div>
                        <div class="inv-damaged-field">
                            <label>${t('inventory.damagedWarehouse', 'المخزن')}</label>
                            <select id="editDamagedWarehouseSelect"></select>
                        </div>
                        <div class="inv-damaged-field">
                            <label>${t('inventory.damagedQuantity', 'الكمية التالفة')}</label>
                            <input id="editDamagedQuantityInput" type="number" min="0.0001" step="0.0001" placeholder="0.0000">
                        </div>
                        <div class="inv-damaged-field">
                            <label>${t('inventory.damagedReason', 'سبب التالف')}</label>
                            <input id="editDamagedReasonInput" type="text">
                        </div>
                        <div class="inv-damaged-field">
                            <label>${t('inventory.damagedBatch', 'رقم التشغيلة')}</label>
                            <input id="editDamagedBatchInput" type="text">
                        </div>
                        <div class="inv-damaged-field">
                            <label>${t('inventory.damagedExpiry', 'تاريخ الصلاحية')}</label>
                            <input id="editDamagedExpiryInput" type="date">
                        </div>
                        <div class="inv-damaged-field">
                            <label>${t('inventory.damagedDate', 'تاريخ التالف')}</label>
                            <input id="editDamagedDateInput" type="date">
                        </div>
                        <div class="inv-damaged-field inv-damaged-notes">
                            <label>${t('inventory.damagedNotes', 'ملاحظات')}</label>
                            <input id="editDamagedNotesInput" type="text">
                        </div>
                    </div>

                    <div class="inv-damaged-actions inv-damaged-edit-actions">
                        <button class="inv-action-btn" data-action="close-damaged-modal">
                            <i class="fas fa-xmark"></i>
                            ${t('inventory.cancel', 'إلغاء')}
                        </button>
                        <button class="inv-action-btn inv-add-btn" data-action="save-damaged-edit">
                            <i class="fas fa-floppy-disk"></i>
                            ${t('inventory.saveChanges', 'حفظ التعديل')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
function initializeElements() {
    inventoryTableBody = document.getElementById('inventoryTableBody');
    searchInput = document.getElementById('searchInput');
    itemCardModal = document.getElementById('itemCardModal');
    itemCardBody = document.getElementById('itemCardBody');
    modalItemName = document.getElementById('modalItemName');
    damagedManagerModal = document.getElementById('damagedManagerModal');
    damagedTableBody = document.getElementById('damagedTableBody');
    damagedItemSelect = document.getElementById('damagedItemSelect');
    damagedWarehouseSelect = document.getElementById('damagedWarehouseSelect');
    damagedQuantityInput = document.getElementById('damagedQuantityInput');
    damagedReasonInput = document.getElementById('damagedReasonInput');
    damagedBatchInput = document.getElementById('damagedBatchInput');
    damagedExpiryInput = document.getElementById('damagedExpiryInput');
    damagedDateInput = document.getElementById('damagedDateInput');
    damagedNotesInput = document.getElementById('damagedNotesInput');
    damagedEditModal = document.getElementById('damagedEditModal');
    editDamagedId = document.getElementById('editDamagedId');
    editDamagedItemSelect = document.getElementById('editDamagedItemSelect');
    editDamagedWarehouseSelect = document.getElementById('editDamagedWarehouseSelect');
    editDamagedQuantityInput = document.getElementById('editDamagedQuantityInput');
    editDamagedReasonInput = document.getElementById('editDamagedReasonInput');
    editDamagedBatchInput = document.getElementById('editDamagedBatchInput');
    editDamagedExpiryInput = document.getElementById('editDamagedExpiryInput');
    editDamagedDateInput = document.getElementById('editDamagedDateInput');
    editDamagedNotesInput = document.getElementById('editDamagedNotesInput');

    if (damagedDateInput) {
        damagedDateInput.value = new Date().toISOString().slice(0, 10);
    }

    if (searchInput) searchInput.addEventListener('input', filterItems);
    document.getElementById('app').addEventListener('click', handleAppClick);
    document.addEventListener('click', handleModalOutsideClick);
}
function handleAppClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    switch (actionEl.dataset.action) {
        case 'toggle-shortages':
            toggleShortages();
            return;
        case 'open-damaged-manager':
            openDamagedManagerModal();
            return;
        case 'close-damaged-manager':
            closeDamagedManagerModal();
            return;
        case 'close-item-card':
            closeItemCard();
            return;
        case 'add-damaged-entry':
            addDamagedEntry();
            return;
        case 'close-damaged-modal':
            closeDamagedEditModal();
            return;
        case 'save-damaged-edit':
            saveDamagedEdit();
            return;
        case 'edit-damaged-entry': {
            const damagedId = Number.parseInt(actionEl.dataset.id || '', 10);
            if (Number.isFinite(damagedId)) {
                openDamagedEditModal(damagedId);
            }
            return;
        }
        case 'delete-damaged-entry': {
            const damagedId = Number.parseInt(actionEl.dataset.id || '', 10);
            if (Number.isFinite(damagedId)) {
                deleteDamagedEntry(damagedId);
            }
            return;
        }
        case 'show-item-card': {
            const itemId = Number.parseInt(actionEl.dataset.itemId || '', 10);
            if (Number.isFinite(itemId)) showItemCard(itemId, decodeURIComponent(actionEl.dataset.itemName || ''));
            return;
        }
    }
}

function openDamagedManagerModal() {
    if (!damagedManagerModal) return;
    damagedManagerModal.classList.add('show');
}

function closeDamagedManagerModal() {
    if (!damagedManagerModal) return;
    damagedManagerModal.classList.remove('show');
}

async function loadInventory() {
    allItems = await window.electronAPI.getItems();
    renderTable(allItems);
    updateStats(allItems);
    populateDamagedItemOptions();
}

async function initializeDamagedStockSection() {
    await resolveDamagedPermissions();
    await loadWarehouses();
    populateDamagedItemOptions();
    populateDamagedWarehouseOptions();
    await loadDamagedEntries();
}

async function resolveDamagedPermissions() {
    if (window.permissionManager?.loadPermissions) {
        const response = await window.permissionManager.loadPermissions();
        currentUserIsAdmin = Boolean(response?.isAdmin);
        currentUserCanEditDamaged = Boolean(window.permissionManager.canEdit?.('inventory'));
        currentUserCanDeleteDamaged = Boolean(window.permissionManager.canDelete?.('inventory'));
        return;
    }

    currentUserIsAdmin = await isCurrentUserAdmin();
    currentUserCanEditDamaged = currentUserIsAdmin;
    currentUserCanDeleteDamaged = currentUserIsAdmin;
}

async function isCurrentUserAdmin() {
    try {
        const token = localStorage.getItem('token');
        if (!token || !window.electronAPI?.getMyPermissions) {
            return false;
        }
        const response = await window.electronAPI.getMyPermissions(token);
        return Boolean(response?.success && response?.isAdmin);
    } catch (error) {
        console.error('[inventory] Failed to resolve admin mode:', error);
        return false;
    }
}

async function loadWarehouses() {
    try {
        if (!window.electronAPI?.getWarehouses) {
            allWarehouses = [];
            return;
        }
        const rows = await window.electronAPI.getWarehouses();
        allWarehouses = Array.isArray(rows) ? rows : [];
    } catch (error) {
        console.error('[inventory] Failed to load warehouses:', error);
        allWarehouses = [];
    }
}

function populateDamagedItemOptions() {
    const html = [
        `<option value="">${t('inventory.selectItem', 'اختر الصنف')}</option>`,
        ...allItems.map(item => `<option value="${item.id}">${escapeHtml(item.name || '')}</option>`)
    ].join('');

    if (damagedItemSelect) {
        const selected = damagedItemSelect.value;
        damagedItemSelect.innerHTML = html;
        damagedItemSelect.value = selected && allItems.some(i => String(i.id) === String(selected)) ? selected : '';
    }

    if (editDamagedItemSelect) {
        const selected = editDamagedItemSelect.value;
        editDamagedItemSelect.innerHTML = html;
        editDamagedItemSelect.value = selected && allItems.some(i => String(i.id) === String(selected)) ? selected : '';
    }

    ensureDamagedItemAutocomplete();
}

function ensureDamagedItemAutocomplete() {
    if (damagedItemSelect) {
        damagedItemSelect.classList.add('item-select', 'autocomplete-show-all-on-click');
        if (damagedItemAutocomplete) {
            damagedItemAutocomplete.refresh();
        } else {
            damagedItemAutocomplete = new Autocomplete(damagedItemSelect);
        }
    }

    if (editDamagedItemSelect) {
        editDamagedItemSelect.classList.add('item-select', 'autocomplete-show-all-on-click');
        if (editDamagedItemAutocomplete) {
            editDamagedItemAutocomplete.refresh();
        } else {
            editDamagedItemAutocomplete = new Autocomplete(editDamagedItemSelect);
        }
    }
}

function populateDamagedWarehouseOptions() {
    const html = [
        `<option value="">${t('inventory.allWarehouses', 'كل المخازن')}</option>`,
        ...allWarehouses.map(warehouse => `<option value="${warehouse.id}">${escapeHtml(warehouse.name || '')}</option>`)
    ].join('');

    if (damagedWarehouseSelect) {
        damagedWarehouseSelect.innerHTML = html;
    }

    if (editDamagedWarehouseSelect) {
        editDamagedWarehouseSelect.innerHTML = html;
    }
}

async function loadDamagedEntries(filters = {}) {
    try {
        if (!window.electronAPI?.getDamagedStockEntries) {
            damagedEntries = [];
            renderDamagedEntries([]);
            updateDamagedSummary({ count: 0, totalQuantity: 0, totalLoss: 0 });
            return;
        }

        const response = await window.electronAPI.getDamagedStockEntries(filters);
        if (!response?.success) {
            throw new Error(response?.error || t('inventory.failedLoadDamaged', 'تعذر تحميل سجل التالف'));
        }

        damagedEntries = Array.isArray(response.entries) ? response.entries : [];
        renderDamagedEntries(damagedEntries);
        updateDamagedSummary(response.stats || { count: damagedEntries.length, totalQuantity: 0, totalLoss: 0 });
    } catch (error) {
        console.error('[inventory] Failed to load damaged entries:', error);
        damagedEntries = [];
        renderDamagedEntries([]);
        updateDamagedSummary({ count: 0, totalQuantity: 0, totalLoss: 0 });
        showErrorToast(error.message || t('inventory.failedLoadDamaged', 'تعذر تحميل سجل التالف'));
    }
}

function updateDamagedSummary(stats) {
    const count = Number(stats?.count) || 0;
    const totalQuantity = Number(stats?.totalQuantity) || 0;
    const totalLoss = Number(stats?.totalLoss) || 0;

    const badge = document.getElementById('damagedCountBadge');
    if (badge) badge.textContent = count;

    const countEl = document.getElementById('damagedSummaryCount');
    if (countEl) countEl.textContent = String(count);

    const qtyEl = document.getElementById('damagedSummaryQty');
    if (qtyEl) qtyEl.textContent = totalQuantity.toFixed(4);

    const lossEl = document.getElementById('damagedSummaryLoss');
    if (lossEl) lossEl.textContent = totalLoss.toFixed(2);
}

function renderDamagedEntries(entries) {
    if (!damagedTableBody) return;

    damagedTableBody.innerHTML = '';
    if (!entries.length) {
        damagedTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 18px;">${t('inventory.noDamagedEntries', 'لا توجد حركات تالف')}</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
        const actionButtons = [];
        if (currentUserCanEditDamaged) {
            actionButtons.push(`
                <button class="inv-icon-btn" data-action="edit-damaged-entry" data-id="${entry.id}" title="${t('inventory.edit', 'تعديل')}">
                    <i class="fas fa-pen"></i>
                </button>
            `);
        }
        if (currentUserCanDeleteDamaged) {
            actionButtons.push(`
                <button class="inv-icon-btn danger" data-action="delete-damaged-entry" data-id="${entry.id}" title="${t('inventory.delete', 'حذف')}">
                    <i class="fas fa-trash"></i>
                </button>
            `);
        }
        const actions = actionButtons.length ? actionButtons.join('') : '<span class="inv-muted-text">-</span>';

        row.innerHTML = `
            <td>${escapeHtml(formatDate(entry.damaged_date || entry.created_at))}</td>
            <td>${escapeHtml(entry.item_name || '')}</td>
            <td>${escapeHtml(entry.warehouse_name || t('inventory.notSpecified', 'غير محدد'))}</td>
            <td>${Number(entry.quantity || 0).toFixed(4)}</td>
            <td title="${escapeHtml(entry.reason || '')}">${escapeHtml(entry.reason || '')}</td>
            <td>${Number(entry.loss_amount || 0).toFixed(2)}</td>
            <td class="inv-damaged-actions-cell">${actions}</td>
        `;

        damagedTableBody.appendChild(row);
    });
}

function getDamagedPayload(prefix = '') {
    const itemSelect = prefix ? editDamagedItemSelect : damagedItemSelect;
    const warehouseSelect = prefix ? editDamagedWarehouseSelect : damagedWarehouseSelect;
    const quantityInput = prefix ? editDamagedQuantityInput : damagedQuantityInput;
    const reasonInput = prefix ? editDamagedReasonInput : damagedReasonInput;
    const batchInput = prefix ? editDamagedBatchInput : damagedBatchInput;
    const expiryInput = prefix ? editDamagedExpiryInput : damagedExpiryInput;
    const dateInput = prefix ? editDamagedDateInput : damagedDateInput;
    const notesInput = prefix ? editDamagedNotesInput : damagedNotesInput;

    const itemId = Number(itemSelect?.value || 0);
    const warehouseId = warehouseSelect?.value ? Number(warehouseSelect.value) : null;
    const quantity = Number(quantityInput?.value || 0);
    const reason = String(reasonInput?.value || '').trim();
    const batchNo = String(batchInput?.value || '').trim();
    const expiryDate = String(expiryInput?.value || '').trim();
    const damagedDate = String(dateInput?.value || '').trim();
    const notes = String(notesInput?.value || '').trim();

    if (!Number.isFinite(itemId) || itemId <= 0) {
        return { valid: false, error: t('inventory.validationSelectItem', 'اختر الصنف أولاً') };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { valid: false, error: t('inventory.validationQuantity', 'أدخل كمية صحيحة أكبر من صفر') };
    }

    if (!reason) {
        return { valid: false, error: t('inventory.validationReason', 'سبب التالف مطلوب') };
    }

    return {
        valid: true,
        payload: {
            item_id: itemId,
            warehouse_id: Number.isFinite(warehouseId) && warehouseId > 0 ? warehouseId : null,
            quantity,
            reason,
            batch_no: batchNo || null,
            expiry_date: expiryDate || null,
            damaged_date: damagedDate || new Date().toISOString().slice(0, 10),
            notes: notes || null
        }
    };
}

async function addDamagedEntry() {
    const parsed = getDamagedPayload();
    if (!parsed.valid) {
        showErrorToast(parsed.error);
        return;
    }

    try {
        const response = await window.electronAPI.addDamagedStockEntry(parsed.payload);
        if (!response?.success) {
            throw new Error(response?.error || t('inventory.failedAddDamaged', 'تعذر إضافة حركة التالف'));
        }

        clearDamagedForm();
        await loadInventory();
        await loadDamagedEntries();
        showSuccessToast(t('inventory.damagedAdded', 'تم إضافة حركة التالف بنجاح'));
    } catch (error) {
        showErrorToast(error.message || t('inventory.failedAddDamaged', 'تعذر إضافة حركة التالف'));
    }
}

function clearDamagedForm() {
    if (damagedQuantityInput) damagedQuantityInput.value = '';
    if (damagedReasonInput) damagedReasonInput.value = '';
    if (damagedBatchInput) damagedBatchInput.value = '';
    if (damagedExpiryInput) damagedExpiryInput.value = '';
    if (damagedNotesInput) damagedNotesInput.value = '';
    if (damagedDateInput) damagedDateInput.value = new Date().toISOString().slice(0, 10);
}

function openDamagedEditModal(id) {
    if (!currentUserCanEditDamaged) {
        showErrorToast(t('inventory.adminOnly', 'هذه العملية متاحة للمسؤول فقط'));
        return;
    }

    const entry = damagedEntries.find(row => Number(row.id) === Number(id));
    if (!entry) {
        showErrorToast(t('inventory.entryNotFound', 'تعذر العثور على سجل التالف'));
        return;
    }

    if (editDamagedId) editDamagedId.value = String(entry.id);
    if (editDamagedItemSelect) editDamagedItemSelect.value = String(entry.item_id || '');
    if (editDamagedItemAutocomplete) editDamagedItemAutocomplete.refresh();
    if (editDamagedWarehouseSelect) editDamagedWarehouseSelect.value = entry.warehouse_id ? String(entry.warehouse_id) : '';
    if (editDamagedQuantityInput) editDamagedQuantityInput.value = String(entry.quantity || '');
    if (editDamagedReasonInput) editDamagedReasonInput.value = entry.reason || '';
    if (editDamagedBatchInput) editDamagedBatchInput.value = entry.batch_no || '';
    if (editDamagedExpiryInput) editDamagedExpiryInput.value = formatDateInput(entry.expiry_date || '');
    if (editDamagedDateInput) editDamagedDateInput.value = formatDateInput(entry.damaged_date || entry.created_at || '');
    if (editDamagedNotesInput) editDamagedNotesInput.value = entry.notes || '';

    if (damagedEditModal) {
        damagedEditModal.classList.add('show');
    }
}

function closeDamagedEditModal() {
    if (damagedEditModal) {
        damagedEditModal.classList.remove('show');
    }
}

async function saveDamagedEdit() {
    if (!currentUserCanEditDamaged) {
        showErrorToast(t('inventory.adminOnly', 'هذه العملية متاحة للمسؤول فقط'));
        return;
    }

    const id = Number(editDamagedId?.value || 0);
    if (!Number.isFinite(id) || id <= 0) {
        showErrorToast(t('inventory.entryNotFound', 'تعذر العثور على سجل التالف'));
        return;
    }

    const parsed = getDamagedPayload('edit');
    if (!parsed.valid) {
        showErrorToast(parsed.error);
        return;
    }

    try {
        const response = await window.electronAPI.updateDamagedStockEntry({ id, ...parsed.payload });
        if (!response?.success) {
            throw new Error(response?.error || t('inventory.failedUpdateDamaged', 'تعذر تعديل حركة التالف'));
        }

        closeDamagedEditModal();
        await loadInventory();
        await loadDamagedEntries();
        showSuccessToast(t('inventory.damagedUpdated', 'تم تعديل حركة التالف بنجاح'));
    } catch (error) {
        showErrorToast(error.message || t('inventory.failedUpdateDamaged', 'تعذر تعديل حركة التالف'));
    }
}

async function deleteDamagedEntry(id) {
    if (!currentUserCanDeleteDamaged) {
        showErrorToast(t('inventory.adminOnly', 'هذه العملية متاحة للمسؤول فقط'));
        return;
    }

    const ok = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('inventory.confirmDeleteDamaged', 'هل أنت متأكد من حذف سجل التالف؟ سيتم إرجاع الكمية للمخزون.'))
        : false;
    if (!ok) return;

    try {
        const response = await window.electronAPI.deleteDamagedStockEntry(id);
        if (!response?.success) {
            throw new Error(response?.error || t('inventory.failedDeleteDamaged', 'تعذر حذف سجل التالف'));
        }

        await loadInventory();
        await loadDamagedEntries();
        showSuccessToast(t('inventory.damagedDeleted', 'تم حذف سجل التالف بنجاح'));
    } catch (error) {
        showErrorToast(error.message || t('inventory.failedDeleteDamaged', 'تعذر حذف سجل التالف'));
    }
}

function formatDateInput(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('ar-EG');
}

function showErrorToast(message) {
    if (window.toast && typeof window.toast.error === 'function') {
        window.toast.error(message);
        return;
    }
    console.error('[inventory]', message);
}

function showSuccessToast(message) {
    if (window.toast && typeof window.toast.success === 'function') {
        window.toast.success(message);
        return;
    }
    console.log('[inventory]', message);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function renderTable(items) {
    inventoryTableBody.innerHTML = '';
    const countBadge = document.getElementById('itemCountBadge');
    if (countBadge) countBadge.textContent = items.length;
    if (items.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 30px;">' + t('inventory.noItems', '?? ???? ?????') + '</td></tr>';
        return;
    }
    items.forEach(item => {
        const totalValue = item.stock_quantity * item.cost_price;
        const row = document.createElement('tr');
        const reorderLevel = item.reorder_level || 0;
        let statusBadge = '';
        if (item.stock_quantity <= 0) {
            statusBadge = '<span class="inv-status-badge status-out"><i class="fas fa-times-circle"></i> ' + t('inventory.statusOut', '????') + '</span>';
        } else if (item.stock_quantity <= reorderLevel) {
            statusBadge = '<span class="inv-status-badge status-low"><i class="fas fa-exclamation-circle"></i> ' + t('inventory.statusLow', '?????') + '</span>';
        } else {
            statusBadge = '<span class="inv-status-badge status-ok"><i class="fas fa-check-circle"></i> ' + t('inventory.statusOk', '?????') + '</span>';
        }
        const quantityClass = item.stock_quantity <= reorderLevel ? 'qty-low' : '';
        const encodedName = encodeURIComponent(item.name);
        row.innerHTML = `
            <td>${item.barcode || '-'}</td>
            <td>${item.name}</td>
            <td>${item.unit_name || '-'}</td>
            <td class="${quantityClass}">${item.stock_quantity}</td>
            <td class="amount-cell">${item.cost_price.toFixed(2)}</td>
            <td class="amount-cell">${item.sale_price.toFixed(2)}</td>
            <td class="amount-cell">${totalValue.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="inv-btn-card" data-action="show-item-card" data-item-id="${item.id}" data-item-name="${encodedName}"><i class="fas fa-file-alt"></i> ${t('inventory.itemCard', '???? ?????')}</button>
            </td>
        `;
        inventoryTableBody.appendChild(row);
    });
}
function updateStats(items) {
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.stock_quantity, 0);
    const totalCostValue = items.reduce((sum, item) => sum + (item.stock_quantity * item.cost_price), 0);
    const totalSaleValue = items.reduce((sum, item) => sum + (item.stock_quantity * item.sale_price), 0);
    const profitMargin = totalSaleValue - totalCostValue;
    const lowStockCount = items.filter(item => item.stock_quantity <= (item.reorder_level || 0)).length;
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('totalQuantity').textContent = totalQuantity;
    document.getElementById('totalValue').textContent = totalCostValue.toFixed(2);
    document.getElementById('totalSaleValue').textContent = totalSaleValue.toFixed(2);
    document.getElementById('profitMargin').textContent = profitMargin.toFixed(2);
    document.getElementById('lowStockCount').textContent = lowStockCount;
}
function toggleShortages() {
    showShortagesOnly = !showShortagesOnly;
    const btn = document.getElementById('shortageBtn');
    if (showShortagesOnly) {
        btn.classList.add('active');
        btn.innerHTML = `<i class="fas fa-check"></i> ${t('inventory.showAll', '??? ????')}`;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${t('inventory.showShortagesOnly', '??? ??????? ???')}`;
    }
    filterItems();
}
function filterItems() {
    const term = searchInput.value.toLowerCase();
    let filtered = allItems.filter(item => 
        item.name.toLowerCase().includes(term) || 
        (item.barcode && item.barcode.toLowerCase().includes(term))
    );
    if (showShortagesOnly) {
        filtered = filtered.filter(item => {
            const reorderLevel = item.reorder_level || 0;
            return item.stock_quantity <= reorderLevel;
        });
    }
    renderTable(filtered);
}
async function showItemCard(itemId, itemName) {
    modalItemName.textContent = fmt(t('inventory.itemCardTitle', '???? ?????: {name}'), { name: itemName });
    itemCardModal.style.display = 'block';
    try {
        const result = await window.electronAPI.getItemMovements(itemId);
        const movements = result.movements || [];
        const stats = result.stats || {};
        const modalStats = document.getElementById('modalStats');
        modalStats.innerHTML = `
            <div class="modal-stat"><i class="fas fa-arrow-down" style="color:#10b981"></i> ${t('inventory.totalPurchased', '?????? ?????????')}: ${stats.totalPurchased || 0}</div>
            <div class="modal-stat"><i class="fas fa-arrow-up" style="color:#ef4444"></i> ${t('inventory.totalSold', '?????? ????????')}: ${stats.totalSold || 0}</div>
            <div class="modal-stat"><i class="fas fa-heart-crack" style="color:#f97316"></i> ${t('inventory.totalDamaged', 'إجمالي التالف')}: ${stats.totalDamaged || 0}</div>
            <div class="modal-stat"><i class="fas fa-box" style="color:#6366f1"></i> ${t('inventory.currentStock', '??????? ??????')}: ${stats.currentStock || 0}</div>
        `;
        itemCardBody.innerHTML = '';
        if (movements.length === 0) {
            itemCardBody.innerHTML = '<tr><td colspan="7" style="text-align:center">' + t('inventory.noMovements', '?? ???? ????? ???? ?????') + '</td></tr>';
            return;
        }
        movements.forEach(mv => {
            const row = document.createElement('tr');
            const isIn = mv.type === 'purchase' || mv.type === 'sale_return' || mv.type === 'opening';
            const typeClass = isIn ? 'transaction-in' : 'transaction-out';
            let dateDisplay = mv.date || '';
            if (dateDisplay.includes('T')) dateDisplay = dateDisplay.split('T')[0];
            else if (dateDisplay.includes(' ')) dateDisplay = dateDisplay.split(' ')[0];
            const invoiceNumberCell = window.renderDocNumberCell
                ? window.renderDocNumberCell(mv.invoice_number, { numberTag: 'span' })
                : (mv.invoice_number || '-');
            row.innerHTML = `
                <td>${dateDisplay}</td>
                <td><span class="inv-mv-badge ${isIn ? 'mv-in' : 'mv-out'}">${mv.type_label || mv.type}</span></td>
                <td>${invoiceNumberCell}</td>
                <td>${mv.party_name || '-'}</td>
                <td class="transaction-in">${isIn ? mv.quantity : '-'}</td>
                <td class="transaction-out">${!isIn ? mv.quantity : '-'}</td>
                <td>${(mv.price || 0).toFixed(2)}</td>
            `;
            itemCardBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading item movements:', error);
        itemCardBody.innerHTML = '<tr><td colspan="7" style="text-align:center">' + t('inventory.loadError', '??? ??? ????? ????? ????????') + '</td></tr>';
    }
}
function closeItemCard() {
    itemCardModal.style.display = 'none';
}
function handleModalOutsideClick(event) {
    if (event.target === damagedManagerModal) closeDamagedManagerModal();
    if (event.target === itemCardModal) closeItemCard();
    if (event.target === damagedEditModal) closeDamagedEditModal();
}


