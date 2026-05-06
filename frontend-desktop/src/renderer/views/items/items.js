let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function applyI18nToDOM() {
    // Replace nav
    const nav = document.getElementById('main-nav');
    if (nav) nav.outerHTML = buildTopNavHTML();

    // Replace text content for elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val) {
            // For elements with child nodes (like labels with required *), only replace text nodes
            if (el.querySelector('span, svg, i')) {
                for (const node of el.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        node.textContent = ' ' + val + ' ';
                        break;
                    }
                }
            } else {
                el.textContent = val;
            }
        }
    });

    // Replace placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const val = t(key);
        if (val) el.placeholder = val;
    });
}

// ============================================
// ITEMS MANAGEMENT - MAIN SCRIPT
// ============================================

// DOM Elements
let itemBarcodeInput, itemNameInput, itemUnitSelect, costPriceInput, salePriceInput, reorderLevelInput, initialQuantityInput;
let editModal, editItemIdInput, editItemBarcodeInput, editItemNameInput, editItemUnitSelect, editCostPriceInput, editSalePriceInput, editReorderLevelInput, editStockQuantityInput;
let itemsTableBody, deleteModal, searchInput, totalItemsElement, paginationContainer;

// Autocomplete Instances
let itemUnitAutocomplete = null;
let editItemUnitAutocomplete = null;

// State
let allItems = [];
let allUnits = [];
let currentPage = 1;
let itemsPerPage = 50;
let currentFilteredItems = [];
let itemToDeleteId = null;
let lastAutoBarcodeValue = '';
let isBarcodeManuallyEdited = false;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
    ar = await window.i18n?.loadArabicDictionary?.() || {};
    applyI18nToDOM();
    initializeElements();
    loadUnits();
    loadItems();
    setupArrowNavigation();
    
    // if (itemBarcodeInput) itemBarcodeInput.focus();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function getAutocompleteInputForSelect(selectElement) {
    const wrapper = selectElement?.parentElement;
    if (wrapper && wrapper.classList.contains('autocomplete-wrapper')) {
        return wrapper.querySelector('input.autocomplete-input');
    }
    return null;
}

function closeVisibleAutocompleteLists() {
    if (typeof Autocomplete !== 'undefined' && typeof Autocomplete.closeAllVisible === 'function') {
        Autocomplete.closeAllVisible();
        return;
    }

    document.querySelectorAll('.autocomplete-list.visible').forEach((listEl) => {
        listEl.classList.remove('visible');
    });
}

function focusAddItemField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    if (field === itemUnitSelect) {
        const acInput = getAutocompleteInputForSelect(field);
        if (acInput) {
            closeVisibleAutocompleteLists();
            acInput.focus();
            if (typeof acInput.select === 'function') acInput.select();
            if (itemUnitAutocomplete && typeof itemUnitAutocomplete.renderList === 'function') {
                itemUnitAutocomplete.renderList('');
            }
            return;
        }
    }

    closeVisibleAutocompleteLists();
    field.focus();
    if (typeof field.select === 'function') field.select();
}

function setupArrowNavigation() {
    const matrix = [
        ['itemBarcode', 'itemName', 'itemUnit'],
        ['costPrice', 'salePrice', 'reorderLevel']
    ];

    matrix.forEach((row, rowIndex) => {
        row.forEach((id, colIndex) => {
            const el = document.getElementById(id);
            if (!el) return;

            const handleKeydown = (e) => {
                if (
                    e.key !== 'ArrowDown' &&
                    e.key !== 'ArrowUp' &&
                    e.key !== 'ArrowRight' &&
                    e.key !== 'ArrowLeft'
                ) return;

                if (e.target.classList.contains('autocomplete-input')) {
                    const acList = itemUnitAutocomplete?.list;
                    if (acList?.classList.contains('visible') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                        return;
                    }
                }

                const isVertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
                let nextRow = rowIndex;
                let nextCol = colIndex;

                if (e.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
                if (e.key === 'ArrowDown') nextRow = Math.min(matrix.length - 1, rowIndex + 1);
                if (e.key === 'ArrowRight') nextCol = Math.max(0, colIndex - 1);
                if (e.key === 'ArrowLeft') nextCol = Math.min(row.length - 1, colIndex + 1);

                if (nextRow === rowIndex && nextCol === colIndex) {
                    if (isVertical) e.preventDefault();
                    if (e.target.classList.contains('autocomplete-input')) e.stopPropagation();
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                focusAddItemField(matrix[nextRow][nextCol]);
            };

            if (el.tagName === 'SELECT' && el.classList.contains('item-select')) {
                const checkAndAttach = () => {
                    const acInput = getAutocompleteInputForSelect(el);
                    if (!acInput) return false;
                    if (acInput.dataset.arrowNavBound === '1') return true;
                    acInput.addEventListener('keydown', handleKeydown, true);
                    acInput.dataset.arrowNavBound = '1';
                    return true;
                };

                checkAndAttach();
                setTimeout(checkAndAttach, 100);
                setTimeout(checkAndAttach, 300);
            } else {
                if (el.dataset.arrowNavBound === '1') return;
                el.addEventListener('keydown', handleKeydown);
                el.dataset.arrowNavBound = '1';
            }
        });
    });
}
function initializeElements() {
    // Add Form Inputs
    itemBarcodeInput = document.getElementById('itemBarcode');
    itemNameInput = document.getElementById('itemName');
    itemUnitSelect = document.getElementById('itemUnit');
    costPriceInput = document.getElementById('costPrice');
    salePriceInput = document.getElementById('salePrice');
    reorderLevelInput = document.getElementById('reorderLevel');
    initialQuantityInput = document.getElementById('initialQuantity');

    // Edit Modal Inputs
    editModal = document.getElementById('editModal');
    editItemIdInput = document.getElementById('editItemId');
    editItemBarcodeInput = document.getElementById('editItemBarcode');
    editItemNameInput = document.getElementById('editItemName');
    editItemUnitSelect = document.getElementById('editItemUnit');
    editCostPriceInput = document.getElementById('editCostPrice');
    editSalePriceInput = document.getElementById('editSalePrice');
    editReorderLevelInput = document.getElementById('editReorderLevel');
    editStockQuantityInput = document.getElementById('editStockQuantity');

    // Other UI Elements
    itemsTableBody = document.getElementById('itemsTableBody');
    deleteModal = document.getElementById('deleteModal');
    searchInput = document.getElementById('searchInput');
    totalItemsElement = document.getElementById('totalItems');
    paginationContainer = document.getElementById('pagination');

    // Items Per Page Select
    const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            renderTable();
        });
    }

    // Search Event
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }

    const appRoot = document.getElementById('app');
    if (appRoot) {
        appRoot.addEventListener('click', handleAppActionClick);
    }

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) hideDeleteModal();
        if (e.target === editModal) closeEditModal();
    });

    // Enter key navigation in form
    setupEnterNavigation();

    if (itemBarcodeInput) {
        itemBarcodeInput.addEventListener('input', () => {
            const currentValue = itemBarcodeInput.value.trim();
            isBarcodeManuallyEdited = currentValue !== '' && currentValue !== lastAutoBarcodeValue;
        });
    }

    // Profit Margin Listeners (Add Form)
    if (costPriceInput && salePriceInput) {
        const updateAddMargin = () => calculateProfitMargin(costPriceInput, salePriceInput, 'addProfitMargin');
        costPriceInput.addEventListener('input', updateAddMargin);
        salePriceInput.addEventListener('input', updateAddMargin);
    }

    // Profit Margin Listeners (Edit Form)
    if (editCostPriceInput && editSalePriceInput) {
        const updateEditMargin = () => calculateProfitMargin(editCostPriceInput, editSalePriceInput, 'editProfitMargin');
        editCostPriceInput.addEventListener('input', updateEditMargin);
        editSalePriceInput.addEventListener('input', updateEditMargin);
    }
}

function handleAppActionClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    if (action === 'save-new-item') {
        saveNewItem();
        return;
    }

    if (action === 'open-edit-modal') {
        const id = Number.parseInt(actionEl.dataset.id || '', 10);
        if (Number.isFinite(id)) {
            openEditModal(id);
        }
        return;
    }

    if (action === 'show-delete-modal') {
        const id = Number.parseInt(actionEl.dataset.id || '', 10);
        if (Number.isFinite(id)) {
            showDeleteModal(id);
        }
        return;
    }

    if (action === 'change-page') {
        const page = Number.parseInt(actionEl.dataset.page || '', 10);
        if (Number.isFinite(page)) {
            changePage(page);
        }
        return;
    }

    if (action === 'close-edit-modal') {
        closeEditModal();
        return;
    }

    if (action === 'save-edited-item') {
        saveEditedItem();
        return;
    }

    if (action === 'hide-delete-modal') {
        hideDeleteModal();
        return;
    }

    if (action === 'confirm-delete-item') {
        confirmDelete();
    }
}

function calculateProfitMargin(costInput, saleInput, displayId) {
    const displayEl = document.getElementById(displayId);
    if (!displayEl) return;

    const cost = parseFloat(costInput.value) || 0;
    const sale = parseFloat(saleInput.value) || 0;

    if (cost <= 0 || sale <= 0) {
        displayEl.textContent = '';
        displayEl.className = 'profit-margin-display';
        return;
    }

    const profit = sale - cost;
    const marginPercent = ((profit / cost) * 100).toFixed(1);
    
    let className = 'profit-neutral';
    let icon = '';

    if (profit > 0) {
        className = 'profit-positive';
        icon = '📈';
    } else if (profit < 0) {
        className = 'profit-negative';
        icon = '📉';
    }

    displayEl.className = `profit-margin-display ${className}`;
    displayEl.innerHTML = `${icon} ${fmt(t('items.profit', 'ربح: {amount} ({percent}%)'), {amount: formatCurrency(profit), percent: marginPercent})}`;
}

function setupEnterNavigation() {
    const inputs = [itemBarcodeInput, itemNameInput, itemUnitSelect, costPriceInput, salePriceInput, reorderLevelInput, initialQuantityInput];
    
    inputs.forEach((input, index) => {
        if (!input) return;
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (index < inputs.length - 1) {
                    // inputs[index + 1].focus();
                } else {
                    saveNewItem();
                }
            }
        });
    });
}

function getNextAutoBarcodeFromItems() {
    let maxBarcode = 999;
    allItems.forEach((item) => {
        const value = String(item?.barcode || '').trim();
        if (!/^\d+$/.test(value)) return;

        const numericValue = parseInt(value, 10);
        if (Number.isFinite(numericValue) && numericValue >= 1000 && numericValue > maxBarcode) {
            maxBarcode = numericValue;
        }
    });
    return String(maxBarcode + 1);
}

function syncAutoBarcodeField(force = false) {
    if (!itemBarcodeInput) return;

    if (!force && isBarcodeManuallyEdited) return;

    const nextBarcode = getNextAutoBarcodeFromItems();
    const currentValue = itemBarcodeInput.value.trim();

    if (force || currentValue === '' || currentValue === lastAutoBarcodeValue) {
        itemBarcodeInput.value = nextBarcode;
        lastAutoBarcodeValue = nextBarcode;
        isBarcodeManuallyEdited = false;
    }
}

// ============================================
// DATA LOADING
// ============================================
async function loadUnits() {
    try {
        allUnits = await window.electronAPI.getUnits();
        const options = allUnits.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        
        if (itemUnitSelect) {
            itemUnitSelect.innerHTML = `<option value="">${t('items.selectUnit', 'اختر الوحدة...')}</option>` + options;
            if (!itemUnitAutocomplete) {
                itemUnitAutocomplete = new Autocomplete(itemUnitSelect);
            } else {
                itemUnitAutocomplete.refresh();
            }
            setupArrowNavigation();
        }
        if (editItemUnitSelect) {
            editItemUnitSelect.innerHTML = `<option value="">${t('items.selectUnit', 'اختر الوحدة...')}</option>` + options;
            if (!editItemUnitAutocomplete) {
                editItemUnitAutocomplete = new Autocomplete(editItemUnitSelect);
            } else {
                editItemUnitAutocomplete.refresh();
            }
        }
    } catch (error) {
        console.error('Error loading units:', error);
        Toast.show(t('items.toast.loadUnitsError', 'فشل تحميل الوحدات'), 'error');
    }
}

async function loadItems() {
    try {
        allItems = await window.electronAPI.getItems();
        syncAutoBarcodeField();
        currentFilteredItems = [...allItems];
        renderTable();
        updateStats();
    } catch (error) {
        console.error('Error loading items:', error);
        Toast.show(t('items.toast.loadItemsError', 'فشل تحميل الأصناف'), 'error');
    }
}

// ============================================
// SEARCH
// ============================================
function handleSearch(term) {
    term = term.toLowerCase().trim();
    
    if (term) {
        currentFilteredItems = allItems.filter(item => 
            item.name.toLowerCase().includes(term) || 
            (item.barcode && item.barcode.toLowerCase().includes(term))
        );
    } else {
        currentFilteredItems = [...allItems];
    }
    
    currentPage = 1;
    renderTable();
}

// ============================================
// TABLE RENDERING
// ============================================
function renderTable() {
    if (!itemsTableBody) return;
    
    itemsTableBody.innerHTML = '';
    
    if (currentFilteredItems.length === 0) {
        itemsTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <p>${t('items.noItems', 'لا توجد أصناف مسجلة')}</p>
                    </div>
                </td>
            </tr>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // Pagination
    const totalPages = Math.ceil(currentFilteredItems.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, currentFilteredItems.length);
    const pageItems = currentFilteredItems.slice(startIndex, endIndex);

    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const regex = searchTerm ? new RegExp(`(${searchTerm})`, 'gi') : null;

    pageItems.forEach((item, index) => {
        const unitName = allUnits.find(u => u.id == item.unit_id)?.name || '-';
        
        let displayName = item.name;
        let displayBarcode = item.barcode || '-';
        
        if (regex) {
            displayName = displayName.replace(regex, '<span class="highlight">$1</span>');
            if (item.barcode) {
                displayBarcode = displayBarcode.replace(regex, '<span class="highlight">$1</span>');
            }
        }

        const reorderLvl = item.reorder_level || 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td>${displayBarcode}</td>
            <td>${displayName}</td>
            <td>${unitName}</td>
            <td>${formatCurrency(item.cost_price)}</td>
            <td>${formatCurrency(item.sale_price)}</td>
            <td>${reorderLvl}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" data-action="open-edit-modal" data-id="${item.id}" title="${t('items.editBtnTitle', 'تعديل')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon btn-delete" data-action="show-delete-modal" data-id="${item.id}" title="${t('items.deleteBtnTitle', 'حذف')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;
        itemsTableBody.appendChild(row);
    });

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button class="pagination-btn" data-action="change-page" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <span style="color: var(--text-secondary); font-weight: 600;">${fmt(t('items.pagination.page', 'صفحة {current} من {total}'), {current: currentPage, total: totalPages})}</span>
        <button class="pagination-btn" data-action="change-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
    `;
}

function changePage(newPage) {
    const totalPages = Math.ceil(currentFilteredItems.length / itemsPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderTable();
}

function updateStats() {
    if (totalItemsElement) {
        totalItemsElement.textContent = allItems.length;
    }

    const totalInventoryValueElement = document.getElementById('totalInventoryValue');
    if (totalInventoryValueElement) {
        const totalValue = allItems.reduce((sum, item) => {
            const qty = parseFloat(item.stock_quantity) || 0;
            const cost = parseFloat(item.cost_price) || 0;
            return sum + (qty * cost);
        }, 0);
        totalInventoryValueElement.textContent = formatCurrency(totalValue);
    }

    const totalInventorySalesValueElement = document.getElementById('totalInventorySalesValue');
    if (totalInventorySalesValueElement) {
        const totalSalesValue = allItems.reduce((sum, item) => {
            const qty = parseFloat(item.stock_quantity) || 0;
            const sale = parseFloat(item.sale_price) || 0;
            return sum + (qty * sale);
        }, 0);
        totalInventorySalesValueElement.textContent = formatCurrency(totalSalesValue);
    }
}

function formatCurrency(value) {
    return parseFloat(value || 0).toFixed(2) + ' ج.م';
}


// CRUD and modal actions extracted to items.crud.js.
