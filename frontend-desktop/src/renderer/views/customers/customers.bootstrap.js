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
        if (val) {
            if (el.querySelector('span, i')) {
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

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const val = t(key);
        if (val) el.placeholder = val;
    });
}

// DOM Elements
const customersTableBody = document.getElementById('customers-table-body');
const searchInput = document.getElementById('search-input');
const filterButtons = document.querySelectorAll('.filter-btn');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const modal = document.getElementById('customer-modal');
const addCustomerBtn = document.getElementById('add-customer-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');
const saveCustomerBtn = document.getElementById('save-customer-btn');
const modalTitle = document.getElementById('modal-title');
const customerForm = document.getElementById('customer-form');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const closeDeleteModalBtn = document.getElementById('close-delete-modal');
const cancelDeleteModalBtn = document.getElementById('cancel-delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// Form Inputs
const customerIdInput = document.getElementById('customer-id');
const customerNameInput = document.getElementById('customer-name');
const customerTypeSelect = document.getElementById('customer-type');
const customerPhoneInput = document.getElementById('customer-phone');
const customerAddressInput = document.getElementById('customer-address');
const customerBalanceInput = document.getElementById('customer-balance');
const customerBalanceDirectionToggle = document.getElementById('customer-balance-direction-toggle');
const customerBalanceDirectionButtons = customerBalanceDirectionToggle
    ? customerBalanceDirectionToggle.querySelectorAll('.balance-direction-btn')
    : [];
const customerBalanceHint = document.getElementById('customer-balance-hint');
const customerNotesInput = document.getElementById('customer-notes');

// Stats Elements
const totalReceivablesEl = document.getElementById('total-receivables');
const totalPayablesEl = document.getElementById('total-payables');
const totalCountEl = document.getElementById('total-count');

// State
let allCustomers = [];
let currentFilter = 'all';
let customerToDeleteId = null;
let selectedBalanceDirection = 'on';
let currentPage = 1;
let customersPerPage = 50;
let currentFilteredCustomers = [];
const paginationContainer = document.getElementById('pagination-controls');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
    ar = await window.i18n?.loadArabicDictionary?.() || {};
    applyI18nToDOM();
    loadCustomers();
    setupEventListeners();
    setBalanceDirection('on');
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function setupEventListeners() {
    searchInput.addEventListener('input', filterAndRender);

    filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            filterAndRender();
        });
    });

    addCustomerBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    saveCustomerBtn.addEventListener('click', saveCustomer);

    customerTypeSelect.addEventListener('change', updateOpeningBalanceHint);
    customerBalanceDirectionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            setBalanceDirection(btn.dataset.direction || 'on');
        });
    });

    closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    cancelDeleteModalBtn.addEventListener('click', closeDeleteModal);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });
    confirmDeleteBtn.addEventListener('click', confirmDeleteCustomer);

    customersTableBody.addEventListener('click', handleTableActionClick);
    if (paginationContainer) {
        paginationContainer.addEventListener('click', handlePaginationActionClick);
    }
}

function handleTableActionClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const id = Number.parseInt(actionEl.dataset.id || '', 10);
    if (!Number.isFinite(id)) return;

    const action = actionEl.dataset.action;
    if (action === 'edit-customer') {
        editCustomer(id);
        return;
    }

    if (action === 'delete-customer') {
        deleteCustomer(id);
    }
}

function handlePaginationActionClick(event) {
    const actionEl = event.target.closest('[data-action="change-customers-page"]');
    if (!actionEl) return;

    const page = Number.parseInt(actionEl.dataset.page || '', 10);
    if (Number.isFinite(page)) {
        changeCustomersPage(page);
    }
}

async function loadCustomers() {
    try {
        allCustomers = await window.electronAPI.getCustomers();
        updateStats();
        filterAndRender();
    } catch (error) {
        console.error('Error loading customers:', error);
        showToast(t('customers.toast.loadError', 'خطأ في تحميل البيانات'), 'error');
    }
}

function updateStats() {
    let totalReceivables = 0;
    let totalPayables = 0;

    allCustomers.forEach((c) => {
        const balance = parseFloat(c.opening_balance) || 0;
        if (balance > 0) {
            totalReceivables += balance;
        } else if (balance < 0) {
            totalPayables += Math.abs(balance);
        }
    });

    totalReceivablesEl.textContent = formatCurrency(totalReceivables);
    totalPayablesEl.textContent = formatCurrency(totalPayables);
    totalCountEl.textContent = allCustomers.length;
}

function filterAndRender() {
    const searchTerm = searchInput.value.toLowerCase();

    const filtered = allCustomers.filter((c) => {
        const matchesSearch =
            (c.name && c.name.toLowerCase().includes(searchTerm)) ||
            (c.phone && c.phone.includes(searchTerm)) ||
            (c.code && String(c.code).includes(searchTerm));

        const matchesFilter =
            currentFilter === 'all' ||
            (currentFilter === 'customer' && c.type === 'customer') ||
            (currentFilter === 'supplier' && c.type === 'supplier') ||
            (currentFilter === 'both' && c.type === 'both');

        return matchesSearch && matchesFilter;
    });

    currentPage = 1;
    currentFilteredCustomers = filtered;
    renderTable();
}

function renderTable() {
    customersTableBody.innerHTML = '';

    if (currentFilteredCustomers.length === 0) {
        emptyState.style.display = 'block';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    emptyState.style.display = 'none';

    // Pagination
    const totalPages = Math.ceil(currentFilteredCustomers.length / customersPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * customersPerPage;
    const endIndex = Math.min(startIndex + customersPerPage, currentFilteredCustomers.length);
    const pageCustomers = currentFilteredCustomers.slice(startIndex, endIndex);

    pageCustomers.forEach((customer) => {
        const tr = document.createElement('tr');

        let badgeClass = 'badge-both';
        let typeText = t('customers.typeBoth', 'عميل ومورد');
        if (customer.type === 'customer') {
            badgeClass = 'badge-customer';
            typeText = t('customers.typeCustomer', 'عميل');
        } else if (customer.type === 'supplier') {
            badgeClass = 'badge-supplier';
            typeText = t('customers.typeSupplier', 'مورد');
        }

        const balance = parseFloat(customer.opening_balance) || 0;
        let balanceClass = 'balance-neutral';
        let balanceTag = t('customers.balanceBalanced', 'متزن');

        if (balance > 0) {
            balanceClass = 'balance-positive';
            balanceTag = t('customers.balanceOwed', 'لينا (مدين)');
        } else if (balance < 0) {
            balanceClass = 'balance-negative';
            balanceTag = t('customers.balanceCredit', 'علينا (دائن)');
        }

        tr.innerHTML = `
            <td>${customer.code || '-'}</td>
            <td>${customer.name}</td>
            <td><span class="badge ${badgeClass}">${typeText}</span></td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.address || '-'}</td>
            <td class="${balanceClass}" dir="ltr">${formatCurrency(Math.abs(balance))}<span class="balance-tag">${balanceTag}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" data-action="edit-customer" data-id="${customer.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" data-action="delete-customer" data-id="${customer.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        customersTableBody.appendChild(tr);
    });

    renderCustomersPagination(totalPages);
}

function renderCustomersPagination(totalPages) {
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button class="pagination-btn" data-action="change-customers-page" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <span style="color: var(--text-secondary); font-weight: 600;">${fmt(t('customers.pagination.page', 'صفحة {current} من {total}'), {current: currentPage, total: totalPages})}</span>
        <button class="pagination-btn" data-action="change-customers-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
    `;
}

function changeCustomersPage(newPage) {
    const totalPages = Math.ceil(currentFilteredCustomers.length / customersPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderTable();
}

function openModal(customer = null) {
    if (customer) {
        modalTitle.textContent = t('customers.editCustomer', 'تعديل بيانات');
        customerIdInput.value = customer.id;
        customerNameInput.value = customer.name;
        customerTypeSelect.value = customer.type;
        customerPhoneInput.value = customer.phone || '';
        customerAddressInput.value = customer.address || '';

        const rawBalance = parseFloat(customer.opening_balance) || 0;
        customerBalanceInput.value = Math.abs(rawBalance);
        setBalanceDirection(rawBalance < 0 ? 'for' : 'on');

        customerNotesInput.value = customer.notes || '';
    } else {
        modalTitle.textContent = t('customers.modalTitle.add', 'إضافة عميل/مورد جديد');
        customerForm.reset();
        customerIdInput.value = '';
        customerBalanceInput.value = 0;
        setBalanceDirection('on');
    }

    updateOpeningBalanceHint();
    modal.classList.add('show');
}

function closeModal() {
    modal.classList.remove('show');
}

function setBalanceDirection(direction) {
    selectedBalanceDirection = direction === 'for' ? 'for' : 'on';
    customerBalanceDirectionButtons.forEach((btn) => {
        const isActive = btn.dataset.direction === selectedBalanceDirection;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    updateOpeningBalanceHint();
}

function getSignedOpeningBalance() {
    const openingAmount = Math.abs(parseFloat(customerBalanceInput.value) || 0);
    const direction = selectedBalanceDirection === 'for' ? 'for' : 'on';
    return direction === 'for' ? -openingAmount : openingAmount;
}

async function saveCustomer() {
    const customerData = {
        name: customerNameInput.value,
        type: customerTypeSelect.value,
        phone: customerPhoneInput.value,
        address: customerAddressInput.value,
        opening_balance: getSignedOpeningBalance(),
        notes: customerNotesInput.value
    };

    if (!customerData.name) {
        showToast(t('customers.toast.nameRequired', 'يرجى إدخال الاسم'), 'error');
        return;
    }

    const id = customerIdInput.value;

    try {
        let result;
        if (id) {
            result = await window.electronAPI.updateCustomer({ ...customerData, id });
        } else {
            result = await window.electronAPI.addCustomer(customerData);
        }

        if (result && result.success) {
            showToast(id ? t('customers.toast.updateSuccess', 'تم تحديث البيانات بنجاح') : t('customers.toast.addSuccess', 'تمت الإضافة بنجاح'));
            closeModal();
            loadCustomers();
        } else {
            showToast(fmt(t('customers.toast.saveError', 'حدث خطأ أثناء الحفظ: {error}'), {error: result?.error || 'غير معروف'}), 'error');
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        showToast(t('customers.toast.saveErrorGeneric', 'حدث خطأ أثناء الحفظ'), 'error');
    }
}

function updateOpeningBalanceHint() {
    if (!customerBalanceHint) return;

    const type = customerTypeSelect.value;
    const direction = selectedBalanceDirection === 'for' ? t('customers.balanceDirection.for', 'علينا (دائن)') : t('customers.balanceDirection.on', 'لينا (مدين)');

    if (type === 'supplier') {
        customerBalanceHint.textContent = fmt(t('customers.balanceHint.supplier', 'سيتم حفظ الرصيد كـ "{direction}" على المورد.'), {direction});
        return;
    }

    if (type === 'both') {
        customerBalanceHint.textContent = fmt(t('customers.balanceHint.both', 'سيتم حفظ صافي الرصيد كـ "{direction}" على الحساب المشترك (عميل/مورد).'), {direction});
        return;
    }

    customerBalanceHint.textContent = fmt(t('customers.balanceHint.customer', 'سيتم حفظ الرصيد كـ "{direction}" على العميل.'), {direction});
}

function editCustomer(id) {
    const customer = allCustomers.find((c) => c.id === id);
    if (customer) {
        openModal(customer);
    }
}

function deleteCustomer(id) {
    customerToDeleteId = id;
    deleteModal.classList.add('show');
}

function closeDeleteModal() {
    deleteModal.classList.remove('show');
    customerToDeleteId = null;
}

async function confirmDeleteCustomer() {
    if (!customerToDeleteId) return;

    try {
        const result = await window.electronAPI.deleteCustomer(customerToDeleteId);
        if (result && result.success) {
            showToast(t('customers.toast.deleteSuccess', 'تم الحذف بنجاح'));
            loadCustomers();
            closeDeleteModal();
        } else {
            const errorMsg = result?.error || 'خطأ غير معروف';
            if (errorMsg.includes('FOREIGN KEY')) {
                showToast(t('customers.toast.deleteForeignKey', 'لا يمكن حذف هذا السجل لأنه مرتبط بفواتير أو حركات'), 'error');
            } else {
                showToast(fmt(t('customers.toast.deleteFailed', 'فشل الحذف: {error}'), {error: errorMsg}), 'error');
            }
            closeDeleteModal();
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        showToast(t('customers.toast.deleteError', 'حدث خطأ أثناء الحذف'), 'error');
        closeDeleteModal();
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-EG', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ج.م';
}

function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.left = '20px';
        toastContainer.style.zIndex = '10000';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.background = type === 'success' ? '#10b981' : '#ef4444';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.marginBottom = '10px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.animation = 'slideIn 0.3s ease-out';
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(-100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
