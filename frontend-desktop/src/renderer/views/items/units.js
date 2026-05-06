let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function applyI18nToDOM() {
    const nav = document.getElementById('main-nav');
    if (nav) nav.outerHTML = buildTopNavHTML();

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const val = t(key);
        if (val) el.placeholder = val;
    });
}

let unitIdInput, unitNameInput, unitsTableBody, deleteModal, formTitle, searchInput, totalUnitsElement, cancelEditBtn, saveBtnText, paginationContainer, clearSearchBtn;
let unitToDeleteId = null;

let allUnits = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentFilteredUnits = [];

// Load units when page starts
document.addEventListener('DOMContentLoaded', async () => {
    try {
    ar = await window.i18n?.loadArabicDictionary?.() || {};
    applyI18nToDOM();
    initializeElements();
    loadUnits();
    // unitNameInput.focus();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function initializeElements() {
    unitIdInput = document.getElementById('unitId');
    unitNameInput = document.getElementById('unitName');
    unitsTableBody = document.getElementById('unitsTableBody');
    deleteModal = document.getElementById('deleteModal');
    formTitle = document.getElementById('formTitle');
    searchInput = document.getElementById('searchInput');
    clearSearchBtn = document.getElementById('clearSearchBtn');
    totalUnitsElement = document.getElementById('totalUnits');
    cancelEditBtn = document.getElementById('cancelEditBtn');
    saveBtnText = document.getElementById('saveBtnText');
    paginationContainer = document.getElementById('pagination');

    // Add search listener
    searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });

    const appRoot = document.getElementById('app');
    if (appRoot) appRoot.addEventListener('click', handleAppActionClick);

    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            handleSearch('');
            // searchInput.focus();
        });
    }
    
    // Handle Enter key in input
    unitNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveUnit();
    });

    // Close modal when clicking outside
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) hideDeleteModal();
    });
}

function handleAppActionClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    switch (actionEl.dataset.action) {
        case 'reset-form':
            resetForm();
            return;
        case 'save-unit':
            saveUnit();
            return;
        case 'edit-unit': {
            const id = Number.parseInt(actionEl.dataset.id || '', 10);
            if (Number.isFinite(id)) editUnit(id);
            return;
        }
        case 'show-delete-modal': {
            const id = Number.parseInt(actionEl.dataset.id || '', 10);
            if (Number.isFinite(id)) showDeleteModal(id);
            return;
        }
        case 'change-page': {
            const page = Number.parseInt(actionEl.dataset.page || '', 10);
            if (Number.isFinite(page)) changePage(page);
            return;
        }
        case 'hide-delete-modal':
            hideDeleteModal();
            return;
        case 'confirm-delete-unit':
            confirmDelete();
            return;
    }
}

function handleSearch(term) {
    term = term.toLowerCase();
    
    // Toggle clear button
    if (clearSearchBtn) {
        clearSearchBtn.style.display = term ? 'block' : 'none';
    }

    if (term) {
        currentFilteredUnits = allUnits.filter(u => u.name.toLowerCase().includes(term));
    } else {
        currentFilteredUnits = [...allUnits];
    }
    
    currentPage = 1; // Reset to first page on new search
    renderTable();
}

async function loadUnits() {
    allUnits = await window.electronAPI.getUnits();
    
    // Re-apply current search if exists
    const searchTerm = searchInput.value;
    if (searchTerm) {
        handleSearch(searchTerm);
    } else {
        currentFilteredUnits = [...allUnits];
        renderTable();
    }
    
    updateStats();
}

function renderTable() {
    unitsTableBody.innerHTML = '';
    
    if (currentFilteredUnits.length === 0) {
        unitsTableBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <div class="empty-text">${t('units.noUnits', 'لا توجد وحدات مطابقة للبحث')}</div>
                    </div>
                </td>
            </tr>
        `;
        paginationContainer.innerHTML = '';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(currentFilteredUnits.length / itemsPerPage);
    
    // Ensure currentPage is valid
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, currentFilteredUnits.length);
    const pageUnits = currentFilteredUnits.slice(startIndex, endIndex);

    pageUnits.forEach((unit, index) => {
        const row = document.createElement('tr');
        // Highlight search term if exists
        let displayName = unit.name;
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            displayName = displayName.replace(regex, '<span class="highlight">$1</span>');
        }

        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td>${displayName}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" data-action="edit-unit" data-id="${unit.id}" title="${t('units.editBtnTitle', 'تعديل')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon btn-delete" data-action="show-delete-modal" data-id="${unit.id}" title="${t('units.deleteBtnTitle', 'حذف')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;
        unitsTableBody.appendChild(row);
    });

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <button class="pagination-btn" data-action="change-page" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''} title="${t('units.pagination.previous', 'السابق')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <span class="pagination-info">${fmt(t('units.pagination.page', 'صفحة {current} من {total}'), {current: currentPage, total: totalPages})}</span>
        <button class="pagination-btn" data-action="change-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''} title="${t('units.pagination.next', 'التالي')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

function changePage(newPage) {
    const totalPages = Math.ceil(currentFilteredUnits.length / itemsPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderTable();
}

function updateStats() {
    if (totalUnitsElement) {
        totalUnitsElement.textContent = allUnits.length;
    }
}

function resetForm() {
    unitIdInput.value = '';
    unitNameInput.value = '';
    formTitle.textContent = t('units.addUnit', 'إضافة وحدة جديدة');
    saveBtnText.textContent = t('units.saveUnit', 'حفظ الوحدة');
    cancelEditBtn.style.display = 'none';
    // unitNameInput.focus();
}

function editUnit(id) {
    const unit = allUnits.find(u => u.id === id);
    if (!unit) return;

    unitIdInput.value = unit.id;
    unitNameInput.value = unit.name;

    formTitle.textContent = t('units.editUnit', 'تعديل الوحدة');
    saveBtnText.textContent = t('units.saveEdits', 'حفظ التعديلات');
    cancelEditBtn.style.display = 'block';
    
    // Focus input and scroll to top on mobile
    // unitNameInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveUnit() {
    const id = unitIdInput.value;
    const name = unitNameInput.value.trim();
    
    if (!name) {
        Toast.show(t('units.toast.nameRequired', 'الرجاء إدخال اسم الوحدة'), 'error');
        // unitNameInput.focus();
        return;
    }

    // Check for duplicates
    const isDuplicate = allUnits.some(u => 
        u.name.toLowerCase() === name.toLowerCase() && u.id != id
    );

    if (isDuplicate) {
        Toast.show(t('units.toast.nameDuplicate', 'اسم الوحدة موجود بالفعل، يرجى اختيار اسم آخر'), 'error');
        unitNameInput.select();
        return;
    }

    let result;
    if (id) {
        result = await window.electronAPI.updateUnit({ id, name });
    } else {
        result = await window.electronAPI.addUnit(name);
    }

    if (result.success) {
        resetForm(); // Reset form immediately for next entry
        loadUnits();
        Toast.show(id ? t('units.toast.updateSuccess', 'تم تعديل الوحدة بنجاح') : t('units.toast.addSuccess', 'تم إضافة الوحدة بنجاح'), 'success');
    } else {
        // Fallback for backend errors
        if (result.error && (result.error.includes('UNIQUE') || result.error.includes('constraint'))) {
            Toast.show(t('units.toast.duplicateBackend', 'اسم الوحدة موجود بالفعل'), 'error');
        } else {
            Toast.show(fmt(t('units.toast.errorPrefix', 'حدث خطأ: {error}'), {error: result.error}), 'error');
        }
    }
}

function showDeleteModal(id) {
    unitToDeleteId = id;
    deleteModal.classList.add('active');
}

function hideDeleteModal() {
    unitToDeleteId = null;
    deleteModal.classList.remove('active');
}

async function confirmDelete() {
    if (!unitToDeleteId) return;
    
    const result = await window.electronAPI.deleteUnit(unitToDeleteId);
    if (result.success) {
        loadUnits();
        Toast.show(t('units.toast.deleteSuccess', 'تم حذف الوحدة بنجاح'), 'success');
        // If we were editing the deleted unit, reset form
        if (unitIdInput.value == unitToDeleteId) {
            resetForm();
        }
    } else {
        Toast.show(t('units.toast.deleteError', 'حدث خطأ أثناء الحذف'), 'error');
    }
    hideDeleteModal();
}
