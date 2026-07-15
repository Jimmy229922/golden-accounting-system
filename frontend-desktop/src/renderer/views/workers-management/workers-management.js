let ar = {};
const { t } = window.i18n?.createPageHelpers?.(() => ar) || { t: (_key, fallback = '') => fallback };

const ATTENDANCE_DAYS = [
    { key: 'saturday', label: 'السبت' },
    { key: 'sunday', label: 'الأحد' },
    { key: 'monday', label: 'الاثنين' },
    { key: 'tuesday', label: 'الثلاثاء' },
    { key: 'wednesday', label: 'الأربعاء' },
    { key: 'thursday', label: 'الخميس' },
    { key: 'friday', label: 'الجمعة' }
];

const state = {
    weekStart: '',
    weekEnd: '',
    rows: [],
    weeks: [],
    includeArchived: false,
    editingWorkerId: null,
    advanceWorkerId: null,
    editingAdvanceId: null,
    isSavingWeek: false,
    isSavingWorker: false,
    isSavingAdvance: false,
    hasUnsavedAttendance: false
};

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function showMessage(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
        Toast.show(message, type);
        return;
    }

    console.log(message);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMoney(value) {
    return (Number(value) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatUnits(value) {
    return (Number(value) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    });
}

function parseLocalDate(value) {
    const text = String(value || '').trim();
    const parts = text.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
        return null;
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
    if (
        date.getFullYear() !== parts[0] ||
        date.getMonth() !== parts[1] - 1 ||
        date.getDate() !== parts[2]
    ) {
        return null;
    }

    return date;
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getSaturday(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : parseLocalDate(value);
    const safeDate = date || new Date();
    safeDate.setHours(12, 0, 0, 0);
    const daysSinceSaturday = (safeDate.getDay() - 6 + 7) % 7;
    safeDate.setDate(safeDate.getDate() - daysSinceSaturday);
    return formatDateInput(safeDate);
}

function addDays(value, amount) {
    const date = parseLocalDate(value);
    date.setDate(date.getDate() + amount);
    return formatDateInput(date);
}

function formatArabicDate(value) {
    const date = parseLocalDate(value);
    if (!date) return value || '-';
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function getWeekLabel(weekStart) {
    if (!weekStart) return '';
    return `من ${formatArabicDate(weekStart)} إلى ${formatArabicDate(addDays(weekStart, 6))}`;
}

function getWorkerById(id) {
    return state.rows.find((row) => String(row.id) === String(id));
}

function renderPage() {
    document.getElementById('app').innerHTML = `
        ${buildTopNavHTML()}
        <main class="workers-page">
            <section class="workers-hero">
                <div>
                    <h1><i class="fas fa-people-group"></i> ${t('common.nav.workersManagement', 'إدارة العمال')}</h1>
                    <p>تسجيل الحضور ومدد العمل والسُلف وحساب مستحقات الأسبوع</p>
                </div>
                <div class="workers-hero-actions">
                    <button type="button" class="workers-btn workers-btn-primary" id="saveWeekBtnTop">
                        <i class="fas fa-floppy-disk"></i> حفظ حضور الأسبوع
                    </button>
                    <button type="button" class="workers-btn workers-btn-light" id="addWorkerBtn">
                        <i class="fas fa-user-plus"></i> إضافة عامل
                    </button>
                    <button type="button" class="workers-btn workers-btn-light" id="printWeekBtn">
                        <i class="fas fa-print"></i> طباعة كشف الأسبوع
                    </button>
                </div>
            </section>

            <section class="workers-toolbar">
                <div class="workers-field">
                    <label for="weekStartInput">أسبوع العمل</label>
                    <input type="date" class="workers-input" id="weekStartInput">
                </div>
                <div class="workers-field">
                    <label for="weekHistorySelect">سجل الأسابيع السابقة</label>
                    <select class="workers-select" id="weekHistorySelect">
                        <option value="">اختر أسبوعًا محفوظًا</option>
                    </select>
                </div>
                <div class="workers-toolbar-actions">
                    <button type="button" class="workers-btn workers-btn-prev" id="previousWeekBtn">
                        <i class="fas fa-chevron-right"></i> السابق
                    </button>
                    <button type="button" class="workers-btn workers-btn-curr" id="currentWeekBtn">الأسبوع الحالي</button>
                    <button type="button" class="workers-btn workers-btn-next" id="nextWeekBtn">
                        التالي <i class="fas fa-chevron-left"></i>
                    </button>
                </div>
            </section>

            <section class="workers-summary-grid">
                <article class="workers-summary-card workers-count">
                    <div class="workers-summary-icon"><i class="fas fa-users"></i></div>
                    <div><span>عدد العمال</span><strong id="workersCountValue">0</strong></div>
                </article>
                <article class="workers-summary-card workers-gross">
                    <div class="workers-summary-icon"><i class="fas fa-money-bill-wave"></i></div>
                    <div><span>${t('workersManagement.totalWages', 'إجمالي الأجور')}</span><strong id="grossPayValue">0.00 ج.م</strong></div>
                </article>
                <article class="workers-summary-card workers-advances">
                    <div class="workers-summary-icon"><i class="fas fa-hand-holding-dollar"></i></div>
                    <div><span>${t('workersManagement.totalAdvances', 'إجمالي السُلف')}</span><strong id="advancesValue">0.00 ج.م</strong></div>
                </article>
                <article class="workers-summary-card workers-net">
                    <div class="workers-summary-icon"><i class="fas fa-sack-dollar"></i></div>
                    <div><span>${t('workersManagement.netPayable', 'صافي المستحق')}</span><strong id="netPayValue">0.00 ج.م</strong></div>
                </article>
            </section>

            <div class="workers-print-heading">
                <h1>كشف إدارة العمال</h1>
                <p id="printWeekLabel"></p>
            </div>

            <section class="workers-table-card">
                <div class="workers-table-heading">
                    <div>
                        <h2>${t('workersManagement.weeklyAttendance', 'الحضور الأسبوعي')}</h2>
                        <span id="weekRangeLabel"></span>
                    </div>
                    <label class="workers-archive-toggle">
                        <input type="checkbox" id="includeArchivedInput">
                        عرض العمال المؤرشفين فقط
                    </label>
                </div>
                
                <!-- شريط البحث والتصفية -->
                <div class="workers-filter-bar">
                    <div class="workers-filter-field search-field">
                        <input type="text" class="workers-input" id="workerSearchInput" placeholder="البحث باسم العامل أو الوظيفة...">
                    </div>
                    <div class="workers-filter-field select-field">
                        <select class="workers-select" id="jobFilterSelect">
                            <option value="">كل الوظائف</option>
                        </select>
                    </div>
                    <div class="workers-filter-field select-field">
                        <select class="workers-select" id="advanceFilterSelect">
                            <option value="">كل العمال</option>
                            <option value="has-advances">عمال لديهم سُلف هذا الأسبوع</option>
                        </select>
                    </div>
                </div>

                <div class="workers-table-wrap">
                    <table class="workers-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>العامل / الوظيفة</th>
                                <th>الأجر اليومي</th>
                                ${ATTENDANCE_DAYS.map((day) => `<th>${day.label}</th>`).join('')}
                                <th>إجمالي المدة</th>
                                <th>إجمالي الأجر</th>
                                <th>السُلف</th>
                                <th>صافي المستحق</th>
                                <th class="workers-actions-column">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="workersTableBody"></tbody>
                    </table>
                </div>
                <div class="workers-save-bar">
                    <button type="button" class="workers-btn workers-btn-primary" id="saveWeekBtn">
                        <i class="fas fa-floppy-disk"></i> حفظ حضور الأسبوع
                    </button>
                </div>
            </section>
        </main>

        <div class="workers-modal-overlay hidden" id="workerModal">
            <div class="workers-modal" role="dialog" aria-modal="true" aria-labelledby="workerModalTitle">
                <div class="workers-modal-header">
                    <h2 id="workerModalTitle">إضافة عامل</h2>
                    <button type="button" class="workers-modal-close" data-close-modal="workerModal"><i class="fas fa-times"></i></button>
                </div>
                <form id="workerForm">
                    <div class="workers-modal-body">
                        <div class="workers-modal-grid">
                            <div class="workers-field">
                                <label for="workerNameInput">اسم العامل</label>
                                <input type="text" class="workers-input" id="workerNameInput" required>
                            </div>
                            <div class="workers-field">
                                <label for="workerJobInput">الوظيفة</label>
                                <input type="text" class="workers-input" id="workerJobInput" required>
                            </div>
                            <div class="workers-field">
                                <label for="workerWageInput">الأجر اليومي بالجنيه المصري</label>
                                <input type="number" class="workers-input" id="workerWageInput" min="0.01" step="0.01" required>
                            </div>
                            <div class="workers-field workers-field-full">
                                <label for="workerNotesInput">ملاحظات</label>
                                <textarea class="workers-textarea" id="workerNotesInput"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="workers-modal-footer">
                        <button type="button" class="workers-btn workers-btn-outline" data-close-modal="workerModal">إلغاء</button>
                        <button type="submit" class="workers-btn workers-btn-primary" id="saveWorkerBtn">حفظ العامل</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="workers-modal-overlay hidden" id="advanceModal">
            <div class="workers-modal workers-advance-modal" role="dialog" aria-modal="true" aria-labelledby="advanceModalTitle">
                <div class="workers-modal-header">
                    <div>
                        <h2 id="advanceModalTitle">تسجيل سلفة</h2>
                        <span id="historicalAdvancesTotal" class="worker-historical-advances-total"></span>
                    </div>
                    <button type="button" class="workers-modal-close" data-close-modal="advanceModal"><i class="fas fa-times"></i></button>
                </div>
                <form id="advanceForm">
                    <div class="workers-modal-body">
                        <div class="workers-modal-grid">
                            <div class="workers-field">
                                <label for="advanceDateInput">تاريخ السلفة</label>
                                <input type="date" class="workers-input" id="advanceDateInput" required>
                            </div>
                            <div class="workers-field">
                                <label for="advanceAmountInput">المبلغ بالجنيه المصري</label>
                                <input type="number" class="workers-input" id="advanceAmountInput" min="0.01" step="0.01" required>
                            </div>
                            <div class="workers-field workers-field-full">
                                <label for="advanceNotesInput">ملاحظات السلفة</label>
                                <textarea class="workers-textarea" id="advanceNotesInput"></textarea>
                            </div>
                        </div>
                        <div class="workers-inline-actions">
                            <button type="submit" class="workers-btn workers-btn-primary" id="saveAdvanceBtn">حفظ السلفة</button>
                            <button type="button" class="workers-btn workers-btn-outline hidden" id="cancelAdvanceEditBtn">إلغاء التعديل</button>
                        </div>
                        <div class="workers-advances-list">
                            <h3>سُلف العامل خلال الأسبوع</h3>
                            <div id="workerAdvancesList"></div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function getDurationLabel(duration, isNewLogic = false) {
    const val = Number(duration);
    if (isNewLogic) {
        if (val === 0) return 'بدون إضافي';
        if (val === 0.5) return 'نصف يوم إضافي';
        if (val === 1) return 'يوم كامل إضافي';
        if (val === 1.5) return 'يوم ونصف إضافي';
        return 'بدون إضافي';
    } else {
        if (val === 0.5) return 'نصف يوم';
        if (val === 1.5) return 'يوم ونصف';
        return 'يوم كامل';
    }
}

function buildDurationOptions(selectedDuration, isNewLogic = false) {
    const options = isNewLogic ? [
        { value: 0, label: 'بدون إضافي' },
        { value: 0.5, label: 'نصف يوم إضافي' },
        { value: 1, label: 'يوم كامل إضافي' },
        { value: 1.5, label: 'يوم ونصف إضافي' }
    ] : [
        { value: 0.5, label: 'نصف يوم' },
        { value: 1, label: 'يوم كامل' },
        { value: 1.5, label: 'يوم ونصف' }
    ];
    return options.map((option) => (
        `<option value="${option.value}" ${Number(selectedDuration) === option.value ? 'selected' : ''}>${option.label}</option>`
    )).join('');
}

function buildAttendanceCell(row, day) {
    const isNewLogic = state.weekStart >= '2026-07-11';
    const defaultDuration = isNewLogic ? 0 : 1;
    const attendance = row.attendance?.[day.key] || { present: false, duration: defaultDuration };
    const selectedDuration = attendance.present ? (attendance.duration ?? defaultDuration) : defaultDuration;
    const printText = attendance.present ? `حضور - ${getDurationLabel(selectedDuration, isNewLogic)}` : 'غياب';

    return `
        <td class="attendance-day-cell ${attendance.present ? 'is-present' : 'is-absent'}" data-day="${day.key}">
            <div class="attendance-editor">
                <input type="checkbox" class="attendance-check" ${attendance.present ? 'checked' : ''} aria-label="حضور ${day.label}">
                <select class="workers-select attendance-duration" ${attendance.present ? '' : 'disabled'}>
                    ${buildDurationOptions(selectedDuration, isNewLogic)}
                </select>
            </div>
            <span class="print-attendance">${printText}</span>
        </td>
    `;
}

function renderRows() {
    const body = document.getElementById('workersTableBody');
    if (!body) return;

    const searchVal = (state.filters?.search || '').toLowerCase().trim();
    const jobVal = state.filters?.job || '';
    const advanceVal = state.filters?.advance || '';

    const filteredRows = state.rows.filter((row) => {
        if (searchVal) {
            const nameMatch = (row.name || '').toLowerCase().includes(searchVal);
            const jobMatch = (row.job_title || '').toLowerCase().includes(searchVal);
            if (!nameMatch && !jobMatch) return false;
        }

        if (jobVal && row.job_title !== jobVal) {
            return false;
        }

        if (advanceVal === 'has-advances' && (!row.advances_total || row.advances_total <= 0)) {
            return false;
        }

        return true;
    });

    if (!filteredRows.length) {
        body.innerHTML = '<tr><td colspan="15" class="workers-empty">لا توجد نتائج مطابقة للتصفية الحالية</td></tr>';
        updateSummaryFromTable();
        return;
    }

    body.innerHTML = filteredRows.map((row, index) => {
        const archivedLabel = row.is_active ? '' : '<span>مؤرشف</span>';
        const notesTitle = row.notes ? ` title="${escapeHtml(row.notes)}"` : '';
        const netClass = Number(row.net_pay) < 0 ? 'is-negative' : '';

        return `
            <tr data-worker-id="${row.id}" data-daily-wage="${row.daily_wage}" data-advances-total="${row.advances_total}" data-gross-pay="${row.gross_pay || 0}" data-net-pay="${row.net_pay || 0}" class="${row.is_active ? '' : 'is-archived'}">
                <td>${index + 1}</td>
                <td class="worker-name-cell"${notesTitle}>
                    <strong>${escapeHtml(row.name)}</strong>
                    <span>${escapeHtml(row.job_title)} ${archivedLabel}</span>
                </td>
                <td class="worker-money">${formatMoney(row.daily_wage)} ج.م</td>
                ${ATTENDANCE_DAYS.map((day) => buildAttendanceCell(row, day)).join('')}
                <td class="attendance-units-value">${formatUnits(row.attendance_units)}</td>
                <td class="worker-money gross-pay-value">${formatMoney(row.gross_pay)} ج.م</td>
                <td class="worker-money">
                    <span class="worker-advances-value">${formatMoney(row.advances_total)} ج.م</span>
                    <div class="advance-action">
                        <button type="button" class="workers-btn workers-btn-outline workers-btn-small" data-action="advance" data-id="${row.id}">
                            <i class="fas fa-hand-holding-dollar"></i> السُلف
                        </button>
                    </div>
                </td>
                <td class="worker-money worker-net-value ${netClass}">${formatMoney(row.net_pay)} ج.م</td>
                <td class="workers-actions-cell">
                    <div class="workers-row-actions">
                        <button type="button" class="workers-btn workers-btn-outline workers-btn-small" data-action="edit-worker" data-id="${row.id}">
                            <i class="fas fa-pen"></i> تعديل
                        </button>
                        ${row.is_active ? `
                            <button type="button" class="workers-btn workers-btn-danger workers-btn-small" data-action="archive-worker" data-id="${row.id}">
                                <i class="fas fa-box-archive"></i> أرشفة
                            </button>
                        ` : `
                            <button type="button" class="workers-btn workers-btn-success workers-btn-small" data-action="restore-worker" data-id="${row.id}">
                                <i class="fas fa-rotate-left"></i> استعادة
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateSummaryFromTable();
}

function updateJobFilterOptions() {
    const select = document.getElementById('jobFilterSelect');
    if (!select) return;

    const currentSelection = select.value;
    const jobs = Array.from(new Set(state.rows.map(row => row.job_title).filter(Boolean)));
    
    let html = '<option value="">كل الوظائف</option>';
    jobs.forEach(job => {
        html += `<option value="${escapeHtml(job)}" ${job === currentSelection ? 'selected' : ''}>${escapeHtml(job)}</option>`;
    });
    
    select.innerHTML = html;
}

function updateAttendancePrintText(cell) {
    if (!cell) return;
    const checkbox = cell.querySelector('.attendance-check');
    const select = cell.querySelector('.attendance-duration');
    const printText = cell.querySelector('.print-attendance');
    if (!checkbox || !select || !printText) return;

    const isNewLogic = state.weekStart >= '2026-07-11';
    printText.textContent = checkbox.checked
        ? `حضور - ${getDurationLabel(Number(select.value), isNewLogic)}`
        : 'غياب';
}

function updateRowCalculations(rowElement) {
    if (!rowElement) return;

    const isNewLogic = state.weekStart >= '2026-07-11';
    let attendanceUnits = 0;
    rowElement.querySelectorAll('.attendance-day-cell').forEach((cell) => {
        const checkbox = cell.querySelector('.attendance-check');
        const select = cell.querySelector('.attendance-duration');
        if (checkbox?.checked) {
            const val = Number(select?.value) || 0;
            attendanceUnits += isNewLogic ? (1 + val) : val;
        }
        updateAttendancePrintText(cell);
    });

    const dailyWage = Number(rowElement.dataset.dailyWage) || 0;
    const advancesTotal = Number(rowElement.dataset.advancesTotal) || 0;
    const grossPay = Math.round((dailyWage * attendanceUnits + Number.EPSILON) * 100) / 100;
    const netPay = Math.round((grossPay - advancesTotal + Number.EPSILON) * 100) / 100;

    rowElement.dataset.grossPay = grossPay;
    rowElement.dataset.netPay = netPay;

    const unitsElement = rowElement.querySelector('.attendance-units-value');
    const grossElement = rowElement.querySelector('.gross-pay-value');
    const netElement = rowElement.querySelector('.worker-net-value');

    if (unitsElement) unitsElement.textContent = formatUnits(attendanceUnits);
    if (grossElement) grossElement.textContent = `${formatMoney(grossPay)} ج.م`;
    if (netElement) {
        netElement.textContent = `${formatMoney(netPay)} ج.م`;
        netElement.classList.toggle('is-negative', netPay < 0);
    }

    updateSummaryFromTable();
}

function syncAttendanceStateFromRow(rowElement) {
    if (!rowElement) return;

    const worker = getWorkerById(rowElement.dataset.workerId);
    if (!worker) return;

    const isNewLogic = state.weekStart >= '2026-07-11';
    let attendanceUnits = 0;
    worker.attendance = worker.attendance || {};

    ATTENDANCE_DAYS.forEach((day) => {
        const cell = rowElement.querySelector(`.attendance-day-cell[data-day="${day.key}"]`);
        const checkbox = cell?.querySelector('.attendance-check');
        const select = cell?.querySelector('.attendance-duration');
        const present = Boolean(checkbox?.checked);
        const defaultDuration = isNewLogic ? 0 : 1;
        const duration = present ? (select ? Number(select.value) : defaultDuration) : 0;

        worker.attendance[day.key] = { present, duration };
        attendanceUnits += present ? (isNewLogic ? (1 + duration) : duration) : 0;
    });

    worker.attendance_units = attendanceUnits;
    worker.gross_pay = Math.round(((Number(worker.daily_wage) || 0) * attendanceUnits + Number.EPSILON) * 100) / 100;
    worker.net_pay = Math.round((worker.gross_pay - (Number(worker.advances_total) || 0) + Number.EPSILON) * 100) / 100;
    state.hasUnsavedAttendance = true;
}

function restoreUnsavedAttendance(rows, attendanceByWorker) {
    const isNewLogic = state.weekStart >= '2026-07-11';
    rows.forEach((row) => {
        const attendance = attendanceByWorker.get(String(row.id));
        if (!attendance) return;

        row.attendance = attendance;
        row.attendance_units = ATTENDANCE_DAYS.reduce((total, day) => {
            const att = attendance[day.key];
            if (!att?.present) return total;
            const defaultDuration = isNewLogic ? 0 : 1;
            const duration = att.duration ?? defaultDuration;
            return total + (isNewLogic ? (1 + duration) : duration);
        }, 0);
        row.gross_pay = Math.round(((Number(row.daily_wage) || 0) * row.attendance_units + Number.EPSILON) * 100) / 100;
        row.net_pay = Math.round((row.gross_pay - (Number(row.advances_total) || 0) + Number.EPSILON) * 100) / 100;
    });
}

function getMoneyFromCell(element) {
    if (!element) return 0;
    return Number(String(element.textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
}

function updateSummaryFromTable() {
    const rows = Array.from(document.querySelectorAll('#workersTableBody tr[data-worker-id]'));
    let grossPay = 0;
    let advancesTotal = 0;
    let netPay = 0;

    rows.forEach((row) => {
        grossPay += Number(row.dataset.grossPay) || 0;
        advancesTotal += Number(row.dataset.advancesTotal) || 0;
        netPay += Number(row.dataset.netPay) || 0;
    });

    document.getElementById('workersCountValue').textContent = String(rows.length);
    document.getElementById('grossPayValue').textContent = `${formatMoney(grossPay)} ج.م`;
    document.getElementById('advancesValue').textContent = `${formatMoney(advancesTotal)} ج.م`;
    document.getElementById('netPayValue').textContent = `${formatMoney(netPay)} ج.م`;
}

function updateWeekLabels() {
    const label = getWeekLabel(state.weekStart);
    const rangeElement = document.getElementById('weekRangeLabel');
    const printElement = document.getElementById('printWeekLabel');
    if (rangeElement) rangeElement.textContent = label;
    if (printElement) printElement.textContent = label;
}

function updateNavigationButtonsState() {
    const nextBtn = document.getElementById('nextWeekBtn');
    if (!nextBtn) return;

    const currentActualWeek = getSaturday(new Date());
    const isAtOrAfterCurrentWeek = state.weekStart >= currentActualWeek;
    nextBtn.disabled = isAtOrAfterCurrentWeek;
}

async function loadWeek({ preserveAttendance = false } = {}) {
    const api = window.electronAPI;
    if (!api || typeof api.getWorkersManagementWeek !== 'function') {
        showMessage('واجهة إدارة العمال غير متاحة. أعد تشغيل البرنامج بعد التحديث.', 'error');
        return;
    }

    if (!preserveAttendance) {
        state.filters = { search: '', job: '', advance: '' };
        const searchInput = document.getElementById('workerSearchInput');
        const jobSelect = document.getElementById('jobFilterSelect');
        const advanceSelect = document.getElementById('advanceFilterSelect');
        if (searchInput) searchInput.value = '';
        if (jobSelect) jobSelect.value = '';
        if (advanceSelect) advanceSelect.value = '';
    }

    const attendanceByWorker = preserveAttendance && state.hasUnsavedAttendance
        ? new Map(state.rows.map((row) => [String(row.id), row.attendance]))
        : null;

    try {
        const result = await api.getWorkersManagementWeek({
            week_start_date: state.weekStart,
            include_archived: state.includeArchived
        });

        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر تحميل بيانات الأسبوع', 'error');
            return;
        }

        state.weekEnd = result.week_end_date;
        state.rows = Array.isArray(result.rows) ? result.rows : [];
        if (attendanceByWorker) restoreUnsavedAttendance(state.rows, attendanceByWorker);
        renderRows();
        updateWeekLabels();
        updateNavigationButtonsState();
        updateJobFilterOptions();
    } catch (error) {
        showMessage(error.message || 'تعذر تحميل بيانات الأسبوع', 'error');
    }
}

function renderWeeksHistory() {
    const select = document.getElementById('weekHistorySelect');
    if (!select) return;

    select.innerHTML = `
        <option value="">اختر أسبوعًا محفوظًا</option>
        ${state.weeks.map((week) => `<option value="${week}">${getWeekLabel(week)}</option>`).join('')}
    `;
}

async function loadWeeksHistory() {
    try {
        const result = await window.electronAPI.getWorkersManagementWeeks();
        if (result && result.success) {
            state.weeks = Array.isArray(result.weeks) ? result.weeks : [];
            renderWeeksHistory();
        }
    } catch (error) {
        console.error('[workers-management] weeks history:', error);
    }
}

async function changeWeek(weekStart) {
    const nextWeekStart = getSaturday(weekStart);
    if (nextWeekStart === state.weekStart) return;

    if (state.hasUnsavedAttendance) {
        const confirmed = typeof window.showConfirmDialog === 'function'
            ? await window.showConfirmDialog('يوجد حضور غير محفوظ. هل تريد الانتقال إلى أسبوع آخر وتجاهل التعديلات؟')
            : window.confirm('يوجد حضور غير محفوظ. هل تريد الانتقال إلى أسبوع آخر وتجاهل التعديلات؟');

        if (!confirmed) {
            const currentInput = document.getElementById('weekStartInput');
            const historySelect = document.getElementById('weekHistorySelect');
            if (currentInput) currentInput.value = state.weekStart;
            if (historySelect) historySelect.value = '';
            return;
        }
    }

    state.hasUnsavedAttendance = false;
    state.weekStart = nextWeekStart;
    const input = document.getElementById('weekStartInput');
    if (input) input.value = state.weekStart;
    await loadWeek();
}

function collectAttendanceEntries() {
    return Array.from(document.querySelectorAll('#workersTableBody tr[data-worker-id]')).map((row) => {
        const entry = { worker_id: Number(row.dataset.workerId) };
        ATTENDANCE_DAYS.forEach((day) => {
            const cell = row.querySelector(`.attendance-day-cell[data-day="${day.key}"]`);
            const checkbox = cell?.querySelector('.attendance-check');
            const select = cell?.querySelector('.attendance-duration');
            entry[`${day.key}_present`] = Boolean(checkbox?.checked);
            entry[`${day.key}_duration`] = checkbox?.checked ? Number(select?.value) || 1 : 0;
        });
        return entry;
    });
}

async function saveWeekAttendance() {
    if (state.isSavingWeek) return;

    const entries = collectAttendanceEntries();
    if (!entries.length) {
        showMessage('أضف عاملًا واحدًا على الأقل قبل حفظ الحضور', 'warning');
        return;
    }

    const button = document.getElementById('saveWeekBtn');
    const buttonTop = document.getElementById('saveWeekBtnTop');
    state.isSavingWeek = true;
    if (button) button.disabled = true;
    if (buttonTop) buttonTop.disabled = true;

    try {
        const result = await window.electronAPI.saveWorkersWeekAttendance({
            week_start_date: state.weekStart,
            entries
        });

        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر حفظ حضور الأسبوع', 'error');
            return;
        }

        showMessage('تم حفظ حضور الأسبوع بنجاح', 'success');
        state.hasUnsavedAttendance = false;
        await Promise.all([loadWeek(), loadWeeksHistory()]);
    } catch (error) {
        showMessage(error.message || 'تعذر حفظ حضور الأسبوع', 'error');
    } finally {
        state.isSavingWeek = false;
        if (button) button.disabled = false;
        if (buttonTop) buttonTop.disabled = false;
    }
}

function openWorkerModal(worker = null) {
    state.editingWorkerId = worker ? Number(worker.id) : null;
    document.getElementById('workerModalTitle').textContent = worker ? 'تعديل بيانات العامل' : 'إضافة عامل';
    document.getElementById('workerNameInput').value = worker?.name || '';
    document.getElementById('workerJobInput').value = worker?.job_title || 'عامل';
    document.getElementById('workerWageInput').value = worker?.current_daily_wage || worker?.daily_wage || '1';
    document.getElementById('workerNotesInput').value = worker?.notes || '';
    document.getElementById('workerModal').classList.remove('hidden');
    document.getElementById('workerNameInput').focus();
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');

    if (id === 'workerModal') {
        state.editingWorkerId = null;
        document.getElementById('workerForm')?.reset();
    }

    if (id === 'advanceModal') {
        state.advanceWorkerId = null;
        resetAdvanceForm();
    }
}

async function saveWorker(event) {
    event.preventDefault();
    if (state.isSavingWorker) return;

    const isEditing = Boolean(state.editingWorkerId);

    const payload = {
        name: document.getElementById('workerNameInput').value,
        job_title: document.getElementById('workerJobInput').value,
        daily_wage: document.getElementById('workerWageInput').value,
        notes: document.getElementById('workerNotesInput').value
    };

    state.isSavingWorker = true;
    const button = document.getElementById('saveWorkerBtn');
    if (button) button.disabled = true;

    try {
        const result = isEditing
            ? await window.electronAPI.updateWorker({ ...payload, id: state.editingWorkerId })
            : await window.electronAPI.saveWorker(payload);

        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر حفظ بيانات العامل', 'error');
            return;
        }

        showMessage(isEditing ? 'تم تعديل بيانات العامل' : 'تمت إضافة العامل', 'success');
        if (isEditing) {
            closeModal('workerModal');
        } else {
            document.getElementById('workerForm').reset();
            document.getElementById('workerJobInput').value = 'عامل';
            document.getElementById('workerWageInput').value = '1';
            document.getElementById('workerNameInput').focus();
        }
        await loadWeek({ preserveAttendance: true });
    } catch (error) {
        showMessage(error.message || 'تعذر حفظ بيانات العامل', 'error');
    } finally {
        state.isSavingWorker = false;
        if (button) button.disabled = false;
    }
}

async function archiveWorker(id) {
    const worker = getWorkerById(id);
    if (!worker) return;

    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(`هل تريد أرشفة العامل "${worker.name}"؟ ستظل كل سجلاته القديمة محفوظة.`)
        : window.confirm(`هل تريد أرشفة العامل "${worker.name}"؟`);
    if (!confirmed) return;

    const result = await window.electronAPI.archiveWorker(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر أرشفة العامل', 'error');
        return;
    }

    showMessage('تمت أرشفة العامل مع الاحتفاظ بسجلاته', 'success');
    await loadWeek({ preserveAttendance: true });
}

async function restoreWorker(id) {
    const result = await window.electronAPI.restoreWorker(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر استعادة العامل', 'error');
        return;
    }

    showMessage('تمت استعادة العامل', 'success');
    await loadWeek({ preserveAttendance: true });
}

function getDefaultAdvanceDate() {
    const today = formatDateInput(new Date());
    const weekEnd = addDays(state.weekStart, 6);
    return today >= state.weekStart && today <= weekEnd ? today : state.weekStart;
}

function resetAdvanceForm() {
    state.editingAdvanceId = null;
    const form = document.getElementById('advanceForm');
    if (form) form.reset();
    const dateInput = document.getElementById('advanceDateInput');
    const cancelButton = document.getElementById('cancelAdvanceEditBtn');
    const saveButton = document.getElementById('saveAdvanceBtn');
    if (dateInput && state.weekStart) {
        dateInput.value = getDefaultAdvanceDate();
        dateInput.min = state.weekStart;
        dateInput.max = addDays(state.weekStart, 6);
    }
    if (cancelButton) cancelButton.classList.add('hidden');
    if (saveButton) saveButton.textContent = 'حفظ السلفة';
}

function renderWorkerAdvances() {
    const host = document.getElementById('workerAdvancesList');
    const worker = getWorkerById(state.advanceWorkerId);
    if (!host || !worker) return;

    if (!worker.advances?.length) {
        host.innerHTML = '<div class="workers-empty">لا توجد سُلف مسجلة لهذا الأسبوع</div>';
        return;
    }

    host.innerHTML = `
        <table class="workers-advances-table">
            <thead>
                <tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
                ${worker.advances.map((advance) => `
                    <tr>
                        <td>${formatArabicDate(advance.advance_date)}</td>
                        <td>${formatMoney(advance.amount)} ج.م</td>
                        <td>${escapeHtml(advance.notes || '-')}</td>
                        <td>
                            <div class="workers-inline-actions">
                                <button type="button" class="workers-btn workers-btn-outline workers-btn-small" data-advance-action="edit" data-id="${advance.id}">تعديل</button>
                                <button type="button" class="workers-btn workers-btn-danger workers-btn-small" data-advance-action="delete" data-id="${advance.id}">حذف</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function openAdvanceModal(workerId) {
    const worker = getWorkerById(workerId);
    if (!worker) return;

    state.advanceWorkerId = Number(workerId);
    document.getElementById('advanceModalTitle').textContent = `سُلف العامل: ${worker.name}`;
    
    const histElement = document.getElementById('historicalAdvancesTotal');
    if (histElement) {
        const totalHist = worker.historical_advances_total || 0;
        histElement.textContent = `إجمالي السلف التراكمية: ${formatMoney(totalHist)} ج.م`;
    }
    
    resetAdvanceForm();
    renderWorkerAdvances();
    document.getElementById('advanceModal').classList.remove('hidden');
}

function editAdvance(id) {
    const worker = getWorkerById(state.advanceWorkerId);
    const advance = worker?.advances?.find((item) => String(item.id) === String(id));
    if (!advance) return;

    state.editingAdvanceId = Number(id);
    document.getElementById('advanceDateInput').value = advance.advance_date;
    document.getElementById('advanceAmountInput').value = advance.amount;
    document.getElementById('advanceNotesInput').value = advance.notes || '';
    document.getElementById('cancelAdvanceEditBtn').classList.remove('hidden');
    document.getElementById('saveAdvanceBtn').textContent = 'حفظ التعديل';
}

async function saveAdvance(event) {
    event.preventDefault();
    if (state.isSavingAdvance || !state.advanceWorkerId) return;

    const amountInput = document.getElementById('advanceAmountInput');
    const amount = Number(amountInput?.value) || 0;

    const worker = getWorkerById(state.advanceWorkerId);
    if (worker) {
        const otherAdvancesTotal = worker.advances
            ?.filter((adv) => String(adv.id) !== String(state.editingAdvanceId))
            ?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0;

        const netPayBeforeThisAdvance = Math.round((worker.gross_pay - otherAdvancesTotal + Number.EPSILON) * 100) / 100;

        if (amount > netPayBeforeThisAdvance) {
            const confirmed = typeof window.showConfirmDialog === 'function'
                ? await window.showConfirmDialog(`تنبيه: قيمة هذه السلفة (${amount} ج.م) تتجاوز صافي مستحقات العامل المتبقية للأسبوع الحالي (${netPayBeforeThisAdvance} ج.م)، مما يجعل صافي راتبه بالسالب. هل تريد المتابعة وحفظ السلفة؟`)
                : window.confirm(`تنبيه: قيمة هذه السلفة (${amount} ج.م) تتجاوز صافي مستحقات العامل المتبقية للأسبوع الحالي (${netPayBeforeThisAdvance} ج.م)، مما يجعل صافي راتبه بالسالب. هل تريد المتابعة وحفظ السلفة؟`);

            if (!confirmed) {
                return;
            }
        }
    }

    const payload = {
        worker_id: state.advanceWorkerId,
        week_start_date: state.weekStart,
        advance_date: document.getElementById('advanceDateInput').value,
        amount: amount,
        notes: document.getElementById('advanceNotesInput').value
    };

    state.isSavingAdvance = true;
    const button = document.getElementById('saveAdvanceBtn');
    if (button) button.disabled = true;

    try {
        const result = state.editingAdvanceId
            ? await window.electronAPI.updateWorkerAdvance({ ...payload, id: state.editingAdvanceId })
            : await window.electronAPI.saveWorkerAdvance(payload);

        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر حفظ السلفة', 'error');
            return;
        }

        showMessage(state.editingAdvanceId ? 'تم تعديل السلفة' : 'تم تسجيل السلفة', 'success');
        const workerId = state.advanceWorkerId;
        await Promise.all([loadWeek({ preserveAttendance: true }), loadWeeksHistory()]);
        state.advanceWorkerId = workerId;
        resetAdvanceForm();
        renderWorkerAdvances();
    } catch (error) {
        showMessage(error.message || 'تعذر حفظ السلفة', 'error');
    } finally {
        state.isSavingAdvance = false;
        if (button) button.disabled = false;
    }
}

async function deleteAdvance(id) {
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog('هل تريد حذف هذه السلفة؟')
        : window.confirm('هل تريد حذف هذه السلفة؟');
    if (!confirmed) return;

    const result = await window.electronAPI.deleteWorkerAdvance(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف السلفة', 'error');
        return;
    }

    showMessage('تم حذف السلفة', 'success');
    const workerId = state.advanceWorkerId;
    await loadWeek({ preserveAttendance: true });
    state.advanceWorkerId = workerId;
    resetAdvanceForm();
    renderWorkerAdvances();
}

function bindEvents() {
    document.getElementById('addWorkerBtn').addEventListener('click', () => openWorkerModal());
    document.getElementById('printWeekBtn').addEventListener('click', () => window.print());
    document.getElementById('saveWeekBtn').addEventListener('click', saveWeekAttendance);
    const saveWeekBtnTop = document.getElementById('saveWeekBtnTop');
    if (saveWeekBtnTop) {
        saveWeekBtnTop.addEventListener('click', saveWeekAttendance);
    }
    document.getElementById('workerForm').addEventListener('submit', saveWorker);
    document.getElementById('advanceForm').addEventListener('submit', saveAdvance);
    document.getElementById('cancelAdvanceEditBtn').addEventListener('click', resetAdvanceForm);

    document.getElementById('weekStartInput').addEventListener('change', (event) => {
        if (event.target.value) changeWeek(event.target.value);
    });

    document.getElementById('weekHistorySelect').addEventListener('change', (event) => {
        if (event.target.value) changeWeek(event.target.value);
    });

    document.getElementById('previousWeekBtn').addEventListener('click', () => changeWeek(addDays(state.weekStart, -7)));
    document.getElementById('nextWeekBtn').addEventListener('click', () => changeWeek(addDays(state.weekStart, 7)));
    document.getElementById('currentWeekBtn').addEventListener('click', () => changeWeek(getSaturday(new Date())));
    document.getElementById('includeArchivedInput').addEventListener('change', async (event) => {
        state.includeArchived = Boolean(event.target.checked);
        await loadWeek({ preserveAttendance: true });
    });

    document.getElementById('workersTableBody').addEventListener('change', (event) => {
        const row = event.target.closest('tr[data-worker-id]');
        const cell = event.target.closest('.attendance-day-cell');
        if (!row || !cell) return;

        if (event.target.classList.contains('attendance-check')) {
            const select = cell.querySelector('.attendance-duration');
            if (select) {
                select.disabled = !event.target.checked;
                const isNewLogic = state.weekStart >= '2026-07-11';
                if (event.target.checked && !isNewLogic && !Number(select.value)) {
                    select.value = '1';
                }
            }
            cell.classList.toggle('is-present', event.target.checked);
            cell.classList.toggle('is-absent', !event.target.checked);
        }

        updateRowCalculations(row);
        syncAttendanceStateFromRow(row);
    });

    document.getElementById('workersTableBody').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = Number(button.dataset.id);
        if (action === 'advance') openAdvanceModal(id);
        if (action === 'edit-worker') openWorkerModal(getWorkerById(id));
        if (action === 'archive-worker') await archiveWorker(id);
        if (action === 'restore-worker') await restoreWorker(id);
    });

    document.getElementById('workerAdvancesList').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-advance-action]');
        if (!button) return;
        if (button.dataset.advanceAction === 'edit') editAdvance(button.dataset.id);
        if (button.dataset.advanceAction === 'delete') await deleteAdvance(button.dataset.id);
    });

    document.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => closeModal(button.dataset.closeModal));
    });

    document.querySelectorAll('.workers-modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeModal(overlay.id);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!document.getElementById('advanceModal').classList.contains('hidden')) {
            closeModal('advanceModal');
            return;
        }
        if (!document.getElementById('workerModal').classList.contains('hidden')) {
            closeModal('workerModal');
        }
    });

    const searchInput = document.getElementById('workerSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            state.filters = state.filters || {};
            state.filters.search = event.target.value;
            renderRows();
        });
    }

    const jobSelect = document.getElementById('jobFilterSelect');
    if (jobSelect) {
        jobSelect.addEventListener('change', (event) => {
            state.filters = state.filters || {};
            state.filters.job = event.target.value;
            renderRows();
        });
    }

    const advanceSelect = document.getElementById('advanceFilterSelect');
    if (advanceSelect) {
        advanceSelect.addEventListener('change', (event) => {
            state.filters = state.filters || {};
            state.filters.advance = event.target.value;
            renderRows();
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        try {
            ar = await window.i18n.loadArabicDictionary();
        } catch (error) {
            console.error('[workers-management] dictionary:', error);
        }
    }

    renderPage();
    bindEvents();
    state.weekStart = getSaturday(new Date());
    document.getElementById('weekStartInput').value = state.weekStart;
    updateWeekLabels();
    await Promise.all([loadWeek(), loadWeeksHistory()]);
});
