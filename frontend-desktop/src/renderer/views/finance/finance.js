let treasuryBalanceEl;
let transactionsTableBody;
let transactionForm;
let transDateInput;
let newTransactionBtn;
let transactionsById = new Map();
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const CUSTOMER_COLLECTION_PENDING_RELATED_TYPE = 'customer_collection_pending';
const CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE = 'customer_collection_shift_close';

function isExcludedCustomerCollectionTransaction(transaction) {
    const relatedType = String(transaction?.related_type || '').trim();
    return relatedType === CUSTOMER_COLLECTION_PENDING_RELATED_TYPE
        || relatedType === CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE;
}

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function showFinanceToast(message, type = 'info') {
    if (!message) return;

    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
        return;
    }

    if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
        Toast.show(message, type);
        return;
    }

    if (type === 'error') {
        console.error('[finance]', message);
        return;
    }

    console.log('[finance]', message);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    initializeElements();
    transDateInput.valueAsDate = new Date();
    loadFinanceData();
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
            <div class="finance-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>${t('finance.pageTitle', 'المالية والخزينة')}</h1>
                    <p>${t('finance.heroSubtitle', 'إدارة ومتابعة جميع الحركات المالية والإيرادات والمصروفات')}</p>
                </div>
                <div class="hero-bottom">
                    <button class="btn btn-primary" id="newTransactionBtn" data-action="show-form">
                        <i class="fas fa-plus-circle"></i> ${t('finance.newTransactionBtn', 'تسجيل حركة يدوية')}
                    </button>
                </div>
            </div>

            <div class="stats-container">
                <div class="stat-card stat-balance">
                    <div class="stat-icon"><i class="fas fa-landmark"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('finance.treasuryBalance', 'رصيد الخزينة الحالي')}</div>
                        <div class="stat-value" id="treasuryBalance">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-income">
                    <div class="stat-icon"><i class="fas fa-arrow-down"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('finance.totalIncome', 'إجمالي الإيرادات')}</div>
                        <div class="stat-value" id="totalIncome">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-expense">
                    <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('finance.totalExpense', 'إجمالي المصروفات')}</div>
                        <div class="stat-value" id="totalExpense">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-count">
                    <div class="stat-icon"><i class="fas fa-exchange-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('finance.transCount', 'عدد الحركات')}</div>
                        <div class="stat-value" id="transCount">0</div>
                    </div>
                </div>
                <div class="stat-card stat-today-in">
                    <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('finance.todayIncome', 'إيرادات اليوم')}</div>
                        <div class="stat-value" id="todayIncome">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-today-out">
                    <div class="stat-icon"><i class="fas fa-calendar-minus"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('finance.todayExpense', 'مصروفات اليوم')}</div>
                        <div class="stat-value" id="todayExpense">0.00</div>
                    </div>
                </div>
            </div>

            <!-- Transaction Form -->
            <div id="transactionForm" class="form-card">
                <div class="form-header">
                    <h3>${t('finance.newTransactionTitle', 'تسجيل حركة مالية جديدة')}</h3>
                    <button class="btn btn-outline btn-sm" data-action="hide-form">${t('finance.close', 'إغلاق')}</button>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label>${t('finance.transType', 'نوع الحركة')}</label>
                        <select id="transType" class="form-control">
                            <option value="income">${t('finance.incomeType', 'قبض (إيداع)')}</option>
                            <option value="expense">${t('finance.expenseType', 'صرف (سحب)')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>${t('finance.amount', 'المبلغ')}</label>
                        <input type="number" id="transAmount" class="form-control" placeholder="0.00" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>${t('finance.date', 'التاريخ')}</label>
                        <input type="date" id="transDate" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>${t('finance.descriptionLabel', 'الوصف / البيان')}</label>
                        <input type="text" id="transDesc" class="form-control" placeholder="${t('finance.descriptionPlaceholder', 'وصف الحركة')}">
                    </div>
                </div>

                <div style="text-align: left;">
                    <button class="btn btn-outline" data-action="hide-form">${t('finance.cancel', 'إلغاء')}</button>
                    <button class="btn btn-success" data-action="save-transaction">${t('finance.saveTransaction', 'حفظ الحركة')}</button>
                </div>
            </div>

            <!-- Edit Transaction Modal -->
            <div id="editModal" class="modal">
                <div class="modal-content">
                    <span class="close" data-action="close-edit-modal">&times;</span>
                    <h3>${t('finance.editTransactionTitle', 'تعديل حركة')}</h3>
                    <input type="hidden" id="editTransId">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${t('finance.transType', 'نوع الحركة')}</label>
                            <select id="editTransType" class="form-control">
                                <option value="income">${t('finance.incomeType', 'قبض (إيداع)')}</option>
                                <option value="expense">${t('finance.expenseType', 'صرف (سحب)')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${t('finance.amount', 'المبلغ')}</label>
                            <input type="number" id="editTransAmount" class="form-control" step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label>${t('finance.date', 'التاريخ')}</label>
                            <input type="date" id="editTransDate" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>${t('finance.descriptionShort', 'الوصف')}</label>
                            <input type="text" id="editTransDesc" class="form-control">
                        </div>
                    </div>
                    <button class="btn btn-primary" data-action="update-transaction">${t('finance.saveEdits', 'حفظ التعديلات')}</button>
                </div>
            </div>

            <!-- Transactions Table -->
            <div class="table-card">
                <table class="table">
                    <thead>
                        <tr>
                            <th>${t('finance.tableHeaders.voucherNumber', 'رقم السند')}</th>
                            <th>${t('finance.tableHeaders.date', 'التاريخ')}</th>
                            <th>${t('finance.tableHeaders.type', 'نوع الحركة')}</th>
                            <th>${t('finance.tableHeaders.amount', 'المبلغ')}</th>
                            <th>${t('finance.tableHeaders.description', 'البيان')}</th>
                            <th>${t('finance.tableHeaders.relatedTo', 'مرتبط بـ')}</th>
                            <th>${t('finance.tableHeaders.actions', 'إجراءات')}</th>
                        </tr>
                    </thead>
                    <tbody id="transactionsTableBody">
                        <!-- Data loaded via JS -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function initializeElements() {
    treasuryBalanceEl = document.getElementById('treasuryBalance');
    transactionsTableBody = document.getElementById('transactionsTableBody');
    transactionForm = document.getElementById('transactionForm');
    transDateInput = document.getElementById('transDate');
    newTransactionBtn = document.getElementById('newTransactionBtn');
    document.getElementById('app').addEventListener('click', handleAppClick);
    document.addEventListener('click', handleOutsideModalClick);
}

async function loadFinanceData() {
    const balance = await window.electronAPI.getTreasuryBalance();
    const transactions = await window.electronAPI.getTreasuryTransactions();
    const financialTransactions = Array.isArray(transactions)
        ? transactions.filter((tr) => !isExcludedCustomerCollectionTransaction(tr))
        : [];
    
    treasuryBalanceEl.textContent = balance.toFixed(2);
    if (balance >= 0) {
        treasuryBalanceEl.className = 'stat-value positive';
    } else {
        treasuryBalanceEl.className = 'stat-value negative';
    }

    // Calculate stats from transactions
    let totalIncome = 0;
    let totalExpense = 0;
    let todayIncome = 0;
    let todayExpense = 0;
    const today = new Date().toISOString().slice(0, 10);

    financialTransactions.forEach(tr => {
        if (tr.type === 'income') {
            totalIncome += tr.amount;
            if (tr.transaction_date === today) todayIncome += tr.amount;
        } else {
            totalExpense += tr.amount;
            if (tr.transaction_date === today) todayExpense += tr.amount;
        }
    });

    document.getElementById('totalIncome').textContent = totalIncome.toFixed(2);
    document.getElementById('totalExpense').textContent = totalExpense.toFixed(2);
    document.getElementById('transCount').textContent = financialTransactions.length;
    document.getElementById('todayIncome').textContent = todayIncome.toFixed(2);
    document.getElementById('todayExpense').textContent = todayExpense.toFixed(2);

    renderTransactions(financialTransactions);
}

function renderTransactions(transactions) {
    transactionsTableBody.innerHTML = '';
    transactionsById = new Map();
    
    transactions.forEach(tr => {
        transactionsById.set(String(tr.id), tr);
        const row = document.createElement('tr');
        const typeBadge = tr.type === 'income' 
            ? `<span class="badge badge-income">${t('finance.incomeBadge', 'قبض')}</span>` 
            : `<span class="badge badge-expense">${t('finance.expenseBadge', 'صرف')}</span>`;
        
        let relatedText = '-';
        if (tr.related_type === 'sales') relatedText = fmt(t('finance.relatedSales', 'فاتورة بيع #{id}'), { id: tr.related_invoice_id });
        if (tr.related_type === 'purchase') relatedText = fmt(t('finance.relatedPurchase', 'فاتورة شراء #{id}'), { id: tr.related_invoice_id });

        // Show voucher number if exists
        const voucherCell = window.renderDocNumberCell
            ? window.renderDocNumberCell(tr.voucher_number, { numberTag: 'span', numberClassName: 'finance-voucher-number' })
            : (tr.voucher_number
                ? `<span style="font-weight: 600; color: var(--accent-color);">${tr.voucher_number}</span>`
                : `<span style="color: var(--text-muted); font-size: 0.85rem;">${t('finance.noVoucher', '-')}</span>`);

        // Disable edit for auto-generated transactions, but allow delete
        const isAuto = tr.related_invoice_id != null;
        const actions = isAuto ? 
            `<span style="color: #999; font-size: 0.8rem; margin-left: 8px;">${t('finance.autoLabel', '(آلي)')}</span>
             <button class="btn btn-danger btn-sm" data-action="delete-transaction" data-id="${tr.id}">${t('finance.deleteBtn', 'حذف')}</button>` :
            `
            <button class="btn btn-warning btn-sm" data-action="edit-transaction" data-id="${tr.id}">${t('finance.editBtn', 'تعديل')}</button>
            <button class="btn btn-danger btn-sm" data-action="delete-transaction" data-id="${tr.id}">${t('finance.deleteBtn', 'حذف')}</button>
            `;

        row.innerHTML = `
            <td>${voucherCell}</td>
            <td>${tr.transaction_date}</td>
            <td>${typeBadge}</td>
            <td style="font-weight: bold; direction: ltr;">${tr.amount.toFixed(2)}</td>
            <td>${tr.description}</td>
            <td>${relatedText}</td>
            <td>${actions}</td>
        `;
        transactionsTableBody.appendChild(row);
    });
}

function handleAppClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    if (action === 'show-form') {
        showForm();
        return;
    }

    if (action === 'hide-form') {
        hideForm();
        return;
    }

    if (action === 'save-transaction') {
        saveTransaction();
        return;
    }

    if (action === 'close-edit-modal') {
        closeEditModal();
        return;
    }

    if (action === 'update-transaction') {
        updateTransaction();
        return;
    }

    if (action === 'edit-transaction') {
        const transaction = transactionsById.get(String(target.dataset.id || ''));
        if (transaction) {
            openEditModal(transaction);
        }
        return;
    }

    if (action === 'delete-transaction') {
        const id = Number.parseInt(target.dataset.id || '', 10);
        if (Number.isFinite(id)) {
            deleteTransaction(id);
        }
    }
}

function showForm() {
    transactionForm.style.display = 'block';
    newTransactionBtn.style.display = 'none';
}

function hideForm() {
    transactionForm.style.display = 'none';
    newTransactionBtn.style.display = 'flex';
    
    // Clear inputs
    document.getElementById('transAmount').value = '';
    document.getElementById('transDesc').value = '';
    document.getElementById('transType').value = 'income';
    transDateInput.valueAsDate = new Date();
}

async function saveTransaction() {
    const type = document.getElementById('transType').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const date = document.getElementById('transDate').value;
    const description = document.getElementById('transDesc').value;

    if (!amount || amount <= 0) {
        showFinanceToast(t('finance.toast.invalidAmount', 'الرجاء إدخال مبلغ صحيح'), 'error');
        return;
    }
    if (!description) {
        showFinanceToast(t('finance.toast.descriptionRequired', 'الرجاء إدخال وصف للحركة'), 'error');
        return;
    }

    const result = await window.electronAPI.addTreasuryTransaction({
        type,
        amount,
        date,
        description
    });

    if (result.success) {
        showFinanceToast(t('finance.toast.saveSuccess', 'تم حفظ الحركة بنجاح'), 'success');
        hideForm();
        loadFinanceData();
    } else {
        showFinanceToast(fmt(t('finance.toast.saveError', 'حدث خطأ: {error}'), { error: result.error }), 'error');
    }
}

// --- Edit & Delete Functions ---

async function deleteTransaction(id) {
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('finance.toast.deleteConfirm', 'هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.'))
        : false;
    if (!confirmed) return;

    const result = await window.electronAPI.deleteTreasuryTransaction(id);
    if (result.success) {
        showFinanceToast(t('finance.toast.deleteSuccess', 'تم الحذف بنجاح'), 'success');
        loadFinanceData();
    } else {
        showFinanceToast(fmt(t('finance.toast.deleteError', 'حدث خطأ أثناء الحذف: {error}'), { error: result.error }), 'error');
    }
}

function openEditModal(transaction) {
    document.getElementById('editTransId').value = transaction.id;
    document.getElementById('editTransType').value = transaction.type;
    document.getElementById('editTransAmount').value = transaction.amount;
    document.getElementById('editTransDate').value = transaction.transaction_date;
    document.getElementById('editTransDesc').value = transaction.description;
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function updateTransaction() {
    const id = document.getElementById('editTransId').value;
    const type = document.getElementById('editTransType').value;
    const amount = parseFloat(document.getElementById('editTransAmount').value);
    const date = document.getElementById('editTransDate').value;
    const description = document.getElementById('editTransDesc').value;

    if (!amount || amount <= 0) {
        showFinanceToast(t('finance.toast.invalidAmount', 'الرجاء إدخال مبلغ صحيح'), 'error');
        return;
    }

    const result = await window.electronAPI.updateTreasuryTransaction({
        id,
        type,
        amount,
        date,
        description
    });

    if (result.success) {
        showFinanceToast(t('finance.toast.updateSuccess', 'تم تحديث الحركة بنجاح'), 'success');
        closeEditModal();
        loadFinanceData();
    } else {
        showFinanceToast(fmt(t('finance.toast.updateError', 'حدث خطأ: {error}'), { error: result.error }), 'error');
    }
}

// Close modal when clicking outside
function handleOutsideModalClick(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
