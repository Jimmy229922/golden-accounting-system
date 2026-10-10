let ar = {};
const { t } = window.i18n?.createPageHelpers?.(() => ar) || { t: (_key, fallback = '') => fallback };

const ATTENDANCE_DAYS = [
    { key: 'friday', label: 'الجمعة' },
    { key: 'saturday', label: 'السبت' },
    { key: 'sunday', label: 'الأحد' },
    { key: 'monday', label: 'الاثنين' },
    { key: 'tuesday', label: 'الثلاثاء' },
    { key: 'wednesday', label: 'الأربعاء' },
    { key: 'thursday', label: 'الخميس' }
];

const ORDERED_WEEK_DAYS = [
    { key: 'friday', label: 'الجمعة', offset: -1 },
    { key: 'saturday', label: 'السبت', offset: 0 },
    { key: 'sunday', label: 'الأحد', offset: 1 },
    { key: 'monday', label: 'الاثنين', offset: 2 },
    { key: 'tuesday', label: 'الثلاثاء', offset: 3 },
    { key: 'wednesday', label: 'الأربعاء', offset: 4 },
    { key: 'thursday', label: 'الخميس', offset: 5 }
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
                    <button type="button" class="workers-btn workers-btn-light" id="smartAttendanceBtn">
                        <i class="fas fa-clipboard-check"></i> تحضير يومي بالأسماء
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
                <article class="workers-summary-card workers-net" id="netPayCard">
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
                            <div class="workers-field workers-field-full" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                                <input type="checkbox" id="workerAutoTransferInput" style="width: 18px; height: 18px; cursor: pointer;">
                                <label for="workerAutoTransferInput" style="margin: 0; cursor: pointer; font-weight: 600;">ترحيل إجمالي الأجر تلقائياً إلى النثريات أسبوعياً</label>
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
                                <textarea class="workers-textarea" id="advanceNotesInput">سلف</textarea>
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

        <div class="workers-modal-overlay hidden" id="smartAttendanceModal">
            <div class="workers-modal workers-smart-modal" role="dialog" aria-modal="true" aria-labelledby="smartAttendanceModalTitle">
                <div class="workers-modal-header">
                    <div>
                        <h2 id="smartAttendanceModalTitle"><i class="fas fa-clipboard-check"></i> تسجيل الحضور اليومي السريع بالأسماء</h2>
                        <span class="smart-modal-subtitle">الصق أسماء العمال الحاضرين والسهرات ليتم تحضيرهم فوراً</span>
                    </div>
                    <button type="button" class="workers-modal-close" data-close-modal="smartAttendanceModal"><i class="fas fa-times"></i></button>
                </div>
                <div class="workers-modal-body">
                    <div class="smart-modal-grid">
                        <div class="workers-field smart-inline-field">
                            <label for="smartAttendanceDaySelect">اليوم المستهدف:</label>
                            <select class="workers-select" id="smartAttendanceDaySelect"></select>
                        </div>
                        <div class="workers-field smart-inline-field">
                            <label for="smartBaseDurationSelect">نوع الحضور الأساسي:</label>
                            <select class="workers-select" id="smartBaseDurationSelect">
                                <option value="1">يوم كامل (أساسي)</option>
                                <option value="0.5">نصف يوم (أساسي)</option>
                            </select>
                        </div>
                        <div id="smartExistingDayAlert" class="smart-existing-alert hidden"></div>
                    </div>

                    <div class="smart-sections-grid">
                        <div class="smart-section-card">
                            <div class="smart-section-header">
                                <div class="smart-section-title-wrap">
                                    <i class="fas fa-user-check"></i>
                                    <div class="smart-title-row">
                                        <strong>أسماء الحاضرين</strong>
                                        <span class="smart-count-badge" id="smartPresentCountBadge">0 عامل</span>
                                    </div>
                                </div>
                                <button type="button" class="smart-clear-btn" data-clear-target="smartPresentNamesInput" title="تفريغ هذا المربع">
                                    <i class="fas fa-eraser"></i> تفريغ
                                </button>
                            </div>
                            <textarea class="workers-textarea smart-textarea" id="smartPresentNamesInput" placeholder="الصق أسماء الحاضرين هنا..."></textarea>
                            <div class="smart-names-pills hidden" id="smartPresentNamesPills"></div>
                        </div>

                        <div class="smart-section-card">
                            <div class="smart-section-header">
                                <div class="smart-section-title-wrap">
                                    <i class="fas fa-moon"></i>
                                    <div class="smart-title-row">
                                        <strong>سهرة كاملة (+1 يوم)</strong>
                                        <span class="smart-count-badge" id="smartFullOvertimeCountBadge">0 عامل</span>
                                    </div>
                                </div>
                                <button type="button" class="smart-clear-btn" data-clear-target="smartFullOvertimeNamesInput" title="تفريغ هذا المربع">
                                    <i class="fas fa-eraser"></i> تفريغ
                                </button>
                            </div>
                            <textarea class="workers-textarea smart-textarea" id="smartFullOvertimeNamesInput" placeholder="الصق أسماء سهرة كاملة..."></textarea>
                            <div class="smart-names-pills hidden" id="smartFullOvertimeNamesPills"></div>
                        </div>

                        <div class="smart-section-card">
                            <div class="smart-section-header">
                                <div class="smart-section-title-wrap">
                                    <i class="fas fa-cloud-moon"></i>
                                    <div class="smart-title-row">
                                        <strong>نصف سهرة (+0.5 يوم)</strong>
                                        <span class="smart-count-badge" id="smartHalfOvertimeCountBadge">0 عامل</span>
                                    </div>
                                </div>
                                <button type="button" class="smart-clear-btn" data-clear-target="smartHalfOvertimeNamesInput" title="تفريغ هذا المربع">
                                    <i class="fas fa-eraser"></i> تفريغ
                                </button>
                            </div>
                            <textarea class="workers-textarea smart-textarea" id="smartHalfOvertimeNamesInput" placeholder="الصق أسماء نصف سهرة..."></textarea>
                            <div class="smart-names-pills hidden" id="smartHalfOvertimeNamesPills"></div>
                        </div>
                    </div>
                </div>
                <div id="smartAttendancePreview" class="smart-attendance-preview hidden"></div>
                <div class="workers-modal-footer">
                    <button type="button" class="workers-btn workers-btn-danger" id="smartClearAllBtn" style="margin-left: auto;">
                        <i class="fas fa-trash-can"></i> مسح جميع الحقول
                    </button>
                    <button type="button" class="workers-btn workers-btn-outline" data-close-modal="smartAttendanceModal">إلغاء</button>
                    <button type="button" class="workers-btn workers-btn-primary" id="applySmartAttendanceBtn">
                        <i class="fas fa-check-double"></i> تطبيق على جدول الأسبوع
                    </button>
                </div>
            </div>
        </div>

        <div class="workers-modal-overlay absent-modal-overlay hidden" id="absentWorkersModal">
            <div class="workers-modal workers-absent-modal" role="dialog" aria-modal="true" aria-labelledby="absentWorkersModalTitle">
                <div class="workers-modal-header">
                    <div>
                        <h2 id="absentWorkersModalTitle"><i class="fas fa-user-xmark" style="color: #ef4444;"></i> قائمة العمال الغائبين</h2>
                        <span class="smart-modal-subtitle" id="absentWorkersModalSubtitle">العمال غير المذكورين في كشف الحضور</span>
                    </div>
                    <button type="button" class="workers-modal-close" data-close-modal="absentWorkersModal"><i class="fas fa-times"></i></button>
                </div>
                <div class="workers-modal-body">
                    <div class="absent-modal-toolbar">
                        <div class="workers-field absent-search-field">
                            <input type="text" class="workers-input" id="absentWorkersSearchInput" placeholder="بحث بالاسم أو المهنة...">
                        </div>
                        <button type="button" class="workers-btn workers-btn-outline workers-btn-small" id="copyAbsentWorkersBtn" title="نسخ أسماء جميع الغائبين">
                            <i class="fas fa-copy"></i> نسخ الأسماء
                        </button>
                    </div>
                    <div class="absent-workers-list-wrap" id="absentWorkersListContainer"></div>
                </div>
                <div class="workers-modal-footer">
                    <button type="button" class="workers-btn workers-btn-outline" data-close-modal="absentWorkersModal">إغلاق</button>
                </div>
            </div>
        </div>

        <div class="workers-modal-overlay hidden" id="lowWageWorkersModal">
            <div class="workers-modal" role="dialog" aria-modal="true" aria-labelledby="lowWageWorkersModalTitle" style="max-width: 620px;">
                <div class="workers-modal-header">
                    <div>
                        <h2 id="lowWageWorkersModalTitle"><i class="fas fa-triangle-exclamation" style="color: #ef4444;"></i> عمال بأجر يومي 50 ج أو أقل</h2>
                        <span class="smart-modal-subtitle">يرجى تعديل الأجر اليومي لهؤلاء العمال لإظهار صافي المستحق</span>
                    </div>
                    <button type="button" class="workers-modal-close" data-close-modal="lowWageWorkersModal"><i class="fas fa-times"></i></button>
                </div>
                <div class="workers-modal-body">
                    <div class="absent-modal-toolbar">
                        <div class="workers-field absent-search-field">
                            <input type="text" class="workers-input" id="lowWageWorkersSearchInput" placeholder="بحث بالاسم أو المهنة...">
                        </div>
                    </div>
                    <div class="absent-workers-list-wrap" id="lowWageWorkersListContainer"></div>
                </div>
                <div class="workers-modal-footer">
                    <button type="button" class="workers-btn workers-btn-outline" data-close-modal="lowWageWorkersModal">إغلاق</button>
                </div>
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

function getBaseDurationLabel(baseDuration) {
    const val = Number(baseDuration);
    if (val === 0.5) return 'نصف يوم';
    return 'يوم كامل';
}

function buildBaseDurationOptions(selectedDuration) {
    const options = [
        { value: 1, label: 'يوم كامل' },
        { value: 0.5, label: 'نصف يوم' }
    ];
    return options.map((option) => (
        `<option value="${option.value}" ${Number(selectedDuration) === option.value ? 'selected' : ''}>${option.label}</option>`
    )).join('');
}

function buildAttendanceCell(row, day) {
    const isNewLogic = state.weekStart >= '2026-07-11';
    const defaultDuration = isNewLogic ? 0 : 1;
    const attendance = row.attendance?.[day.key] || { present: false, base_duration: 1, duration: defaultDuration };
    const selectedBaseDuration = attendance.present ? (attendance.base_duration ?? 1) : 1;
    const selectedDuration = attendance.present ? (attendance.duration ?? defaultDuration) : defaultDuration;
    const printText = attendance.present
        ? (isNewLogic ? `حضور - ${getBaseDurationLabel(selectedBaseDuration)} - ${getDurationLabel(selectedDuration, isNewLogic)}` : `حضور - ${getDurationLabel(selectedDuration, isNewLogic)}`)
        : 'غياب';

    return `
        <td class="attendance-day-cell ${attendance.present ? 'is-present' : 'is-absent'}" data-day="${day.key}">
            <div class="attendance-editor">
                <input type="checkbox" class="attendance-check" ${attendance.present ? 'checked' : ''} aria-label="حضور ${day.label}">
                ${isNewLogic ? `
                    <select class="workers-select attendance-base-duration" ${attendance.present ? '' : 'disabled'}>
                        ${buildBaseDurationOptions(selectedBaseDuration)}
                    </select>
                ` : ''}
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
        const dailyWage = Number(row.daily_wage) || 0;
        const isLowWage = dailyWage <= 50;

        return `
            <tr data-worker-id="${row.id}" data-daily-wage="${row.daily_wage}" data-advances-total="${row.advances_total}" data-gross-pay="${row.gross_pay || 0}" data-net-pay="${row.net_pay || 0}" class="${row.is_active ? '' : 'is-archived'} ${isLowWage ? 'is-low-wage-row' : ''}">
                <td>${index + 1}</td>
                <td class="worker-name-cell"${notesTitle}>
                    <div class="worker-name-box ${isLowWage ? 'worker-name-low-wage' : ''}"${isLowWage ? ' title="الأجر اليومي 50 ج أو أقل - انقر لتصحيحه"' : ''}>
                        <strong>${escapeHtml(row.name)}${row.auto_transfer_to_petty ? ' <span class="badge-petty" style="display:inline-block; font-size:10px; background:rgba(59,130,246,0.12); color:#2563eb; padding:1px 6px; border-radius:4px; font-weight:normal;" title="مُرحّل للنثريات أسبوعياً"><i class="fas fa-coins"></i> نثريات</span>' : ''}</strong>
                        <span>${escapeHtml(row.job_title)} ${archivedLabel}</span>
                    </div>
                </td>
                <td class="worker-money ${isLowWage ? 'worker-wage-low' : ''}">${formatMoney(row.daily_wage)} ج.م</td>
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

function applyAttendanceCellState(cell, isPresent) {
    if (!cell) return;
    const checkbox = cell.querySelector('.attendance-check');
    if (checkbox) {
        checkbox.checked = isPresent;
    }
    const baseSelect = cell.querySelector('.attendance-base-duration');
    const select = cell.querySelector('.attendance-duration');
    if (baseSelect) {
        baseSelect.disabled = !isPresent;
    }
    if (select) {
        select.disabled = !isPresent;
        const isNewLogic = state.weekStart >= '2026-07-11';
        if (isPresent && !isNewLogic && !Number(select.value)) {
            select.value = '1';
        }
    }
    cell.classList.toggle('is-present', isPresent);
    cell.classList.toggle('is-absent', !isPresent);
}

function updateAttendancePrintText(cell) {
    if (!cell) return;
    const checkbox = cell.querySelector('.attendance-check');
    const baseSelect = cell.querySelector('.attendance-base-duration');
    const select = cell.querySelector('.attendance-duration');
    const printText = cell.querySelector('.print-attendance');
    if (!checkbox || !select || !printText) return;

    const isNewLogic = state.weekStart >= '2026-07-11';
    printText.textContent = checkbox.checked
        ? (isNewLogic ? `حضور - ${getBaseDurationLabel(Number(baseSelect?.value) || 1)} - ${getDurationLabel(Number(select.value), isNewLogic)}` : `حضور - ${getDurationLabel(Number(select.value), isNewLogic)}`)
        : 'غياب';
}

function updateRowCalculations(rowElement) {
    if (!rowElement) return;

    const isNewLogic = state.weekStart >= '2026-07-11';
    let attendanceUnits = 0;
    rowElement.querySelectorAll('.attendance-day-cell').forEach((cell) => {
        const checkbox = cell.querySelector('.attendance-check');
        const baseSelect = cell.querySelector('.attendance-base-duration');
        const select = cell.querySelector('.attendance-duration');
        if (checkbox?.checked) {
            const baseVal = Number(baseSelect?.value) || 1;
            const val = Number(select?.value) || 0;
            attendanceUnits += isNewLogic ? (baseVal + val) : val;
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
        const baseSelect = cell?.querySelector('.attendance-base-duration');
        const select = cell?.querySelector('.attendance-duration');
        const present = Boolean(checkbox?.checked);
        const defaultDuration = isNewLogic ? 0 : 1;
        const baseDuration = present && isNewLogic ? (baseSelect ? Number(baseSelect.value) : 1) : 0;
        const duration = present ? (select ? Number(select.value) : defaultDuration) : 0;

        worker.attendance[day.key] = { present, base_duration: present ? (baseDuration || 1) : 0, duration };
        attendanceUnits += present ? (isNewLogic ? ((baseDuration || 1) + duration) : duration) : 0;
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
            const baseDuration = att.base_duration ?? 1;
            const duration = att.duration ?? defaultDuration;
            return total + (isNewLogic ? (baseDuration + duration) : duration);
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

    const lowWageWorkers = getLowWageWorkers();
    const hasLowWage = lowWageWorkers.length > 0;

    document.getElementById('workersCountValue').textContent = String(rows.length);
    document.getElementById('grossPayValue').textContent = `${formatMoney(grossPay)} ج.م`;
    document.getElementById('advancesValue').textContent = `${formatMoney(advancesTotal)} ج.م`;

    const netPayElement = document.getElementById('netPayValue');
    const netPayCard = document.getElementById('netPayCard');

    if (netPayElement) {
        if (hasLowWage) {
            netPayElement.innerHTML = `<span class="net-pay-hidden-val" title="انقر لعرض العمال (${lowWageWorkers.length})"><i class="fas fa-eye-slash"></i> ---</span>`;
        } else {
            netPayElement.textContent = `${formatMoney(netPay)} ج.م`;
        }
    }

    if (netPayCard) {
        netPayCard.classList.toggle('has-low-wage-warning', hasLowWage);
        if (hasLowWage) {
            netPayCard.setAttribute('title', `يوجد ${lowWageWorkers.length} عامل بأجر 50 ج أو أقل - انقر لعرضهم وتصحيح أجورهم`);
        } else {
            netPayCard.removeAttribute('title');
        }
    }
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

async function confirmDiscardUnsavedAttendance() {
    if (!state.hasUnsavedAttendance) return true;

    return typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog('يوجد حضور غير محفوظ. هل تريد المتابعة وتجاهل التعديلات؟')
        : window.confirm('يوجد حضور غير محفوظ. هل تريد المتابعة وتجاهل التعديلات؟');
}

window.__confirmLeavePage = confirmDiscardUnsavedAttendance;

async function changeWeek(weekStart) {
    const nextWeekStart = getSaturday(weekStart);
    if (nextWeekStart === state.weekStart) return;

    const confirmed = await confirmDiscardUnsavedAttendance();
    if (!confirmed) {
        const currentInput = document.getElementById('weekStartInput');
        const historySelect = document.getElementById('weekHistorySelect');
        if (currentInput) currentInput.value = state.weekStart;
        if (historySelect) historySelect.value = '';
        return;
    }

    state.hasUnsavedAttendance = false;
    state.weekStart = nextWeekStart;
    const input = document.getElementById('weekStartInput');
    if (input) input.value = state.weekStart;
    await loadWeek();
}

function collectAttendanceEntries() {
    const isNewLogic = state.weekStart >= '2026-07-11';
    const defaultDuration = isNewLogic ? 0 : 1;

    return Array.from(document.querySelectorAll('#workersTableBody tr[data-worker-id]')).map((row) => {
        const entry = { worker_id: Number(row.dataset.workerId) };
        ATTENDANCE_DAYS.forEach((day) => {
            const cell = row.querySelector(`.attendance-day-cell[data-day="${day.key}"]`);
            const checkbox = cell?.querySelector('.attendance-check');
            const baseSelect = cell?.querySelector('.attendance-base-duration');
            const select = cell?.querySelector('.attendance-duration');
            const present = Boolean(checkbox?.checked);
            const baseDurationVal = baseSelect ? Number(baseSelect.value) : 1;
            const durationVal = select ? Number(select.value) : defaultDuration;

            entry[`${day.key}_present`] = present;
            entry[`${day.key}_base_duration`] = present && isNewLogic ? (isNaN(baseDurationVal) ? 1 : baseDurationVal) : 0;
            entry[`${day.key}_duration`] = present ? (isNaN(durationVal) ? defaultDuration : durationVal) : 0;
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

        let successMsg = 'تم حفظ حضور الأسبوع بنجاح';
        if (result.transferred_workers && result.transferred_workers.length > 0) {
            successMsg += ` (تم ترحيل أجر ${result.transferred_workers.join('، ')} إلى النثريات)`;
        }
        showMessage(successMsg, 'success');
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

function updateModalBodyLock() {
    const hasOpenModal = Boolean(document.querySelector('.workers-modal-overlay:not(.hidden)'));
    document.documentElement.classList.toggle('workers-modal-open', hasOpenModal);
    document.body.classList.toggle('workers-modal-open', hasOpenModal);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        updateModalBodyLock();
    }
}

function openWorkerModal(worker = null) {
    state.editingWorkerId = worker ? Number(worker.id) : null;
    document.getElementById('workerModalTitle').textContent = worker ? 'تعديل بيانات العامل' : 'إضافة عامل';
    document.getElementById('workerNameInput').value = worker?.name || '';
    document.getElementById('workerJobInput').value = worker?.job_title || 'عامل';
    document.getElementById('workerWageInput').value = worker?.current_daily_wage || worker?.daily_wage || '1';
    document.getElementById('workerNotesInput').value = worker?.notes || '';
    document.getElementById('workerAutoTransferInput').checked = Boolean(worker?.auto_transfer_to_petty);
    openModal('workerModal');
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

    if (id === 'smartAttendanceModal') {
        resetSmartAttendanceForm();
        closeModal('absentWorkersModal');
    }

    if (id === 'absentWorkersModal') {
        const search = document.getElementById('absentWorkersSearchInput');
        if (search) search.value = '';
    }

    if (id === 'lowWageWorkersModal') {
        const search = document.getElementById('lowWageWorkersSearchInput');
        if (search) search.value = '';
    }

    updateModalBodyLock();
}

async function saveWorker(event) {
    event.preventDefault();
    if (state.isSavingWorker) return;

    const isEditing = Boolean(state.editingWorkerId);

    const payload = {
        name: document.getElementById('workerNameInput').value,
        job_title: document.getElementById('workerJobInput').value,
        daily_wage: document.getElementById('workerWageInput').value,
        notes: document.getElementById('workerNotesInput').value,
        auto_transfer_to_petty: document.getElementById('workerAutoTransferInput').checked ? 1 : 0
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
            document.getElementById('workerAutoTransferInput').checked = false;
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
    const notesInput = document.getElementById('advanceNotesInput');
    const cancelButton = document.getElementById('cancelAdvanceEditBtn');
    const saveButton = document.getElementById('saveAdvanceBtn');
    if (dateInput && state.weekStart) {
        dateInput.value = getDefaultAdvanceDate();
        dateInput.min = state.weekStart;
        dateInput.max = addDays(state.weekStart, 6);
    }
    if (notesInput) notesInput.value = 'سلف';
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

function updateAdvanceModalHeader() {
    const worker = getWorkerById(state.advanceWorkerId);
    if (!worker) return;

    document.getElementById('advanceModalTitle').textContent = `سُلف العامل: ${worker.name}`;

    const histElement = document.getElementById('historicalAdvancesTotal');
    if (histElement) {
        const totalHist = worker.historical_advances_total || 0;
        histElement.textContent = `إجمالي السلف التراكمية: ${formatMoney(totalHist)} ج.م`;
    }
}

function openAdvanceModal(workerId) {
    const worker = getWorkerById(workerId);
    if (!worker) return;

    state.advanceWorkerId = Number(workerId);
    updateAdvanceModalHeader();
    resetAdvanceForm();
    renderWorkerAdvances();
    openModal('advanceModal');
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
        updateAdvanceModalHeader();
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
    updateAdvanceModalHeader();
    resetAdvanceForm();
    renderWorkerAdvances();
}

async function handleUnsavedAttendanceNavigation(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!state.hasUnsavedAttendance) return;

    const link = event.target.closest('.top-nav a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) return;

    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(link.href, window.location.href);
    const isSamePage =
        currentUrl.pathname === targetUrl.pathname &&
        currentUrl.search === targetUrl.search &&
        currentUrl.hash === targetUrl.hash;

    if (isSamePage) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const confirmed = await confirmDiscardUnsavedAttendance();
    if (!confirmed) return;

    state.hasUnsavedAttendance = false;
    if (window.__navigateWithinShell && window.__navigateWithinShell(targetUrl.href)) {
        return;
    }

    window.location.href = targetUrl.href;
}

function normalizeArabicText(text) {
    if (!text) return '';
    return String(text)
        .trim()
        .toLowerCase()
        .replace(/[أإآا]/g, 'ا')
        .replace(/[يى]/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ًٌٍَُِّْـ]/g, '')
        .replace(/\s+/g, ' ');
}

function extractNamesList(rawText) {
    if (!rawText) return [];
    const rawList = String(rawText)
        .split(/[\r\n,،;؛]+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

    const seen = new Set();
    const unique = [];
    rawList.forEach((name) => {
        const key = normalizeArabicText(name);
        if (key && !seen.has(key)) {
            seen.add(key);
            unique.push(name);
        }
    });
    return unique;
}

function findWorkerByName(queryName, candidateRows) {
    const cleanQuery = normalizeArabicText(queryName);
    if (!cleanQuery) return null;

    return candidateRows.find((row) => normalizeArabicText(row.name) === cleanQuery) || null;
}

function getLevenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const row = [];
    for (let i = 0; i <= b.length; i++) row[i] = i;

    for (let i = 1; i <= a.length; i++) {
        let prev = i;
        for (let j = 1; j <= b.length; j++) {
            let val;
            if (a[i - 1] === b[j - 1]) {
                val = row[j - 1];
            } else {
                val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            }
            row[j - 1] = prev;
            prev = val;
        }
        row[b.length] = prev;
    }
    return row[b.length];
}

function findClosestWorkerMatch(queryName, candidateRows) {
    const cleanQuery = normalizeArabicText(queryName);
    if (!cleanQuery || cleanQuery.length < 3) return null;

    const queryTokens = cleanQuery.split(' ').filter(Boolean);
    if (!queryTokens.length) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const worker of candidateRows) {
        const cleanCandidate = normalizeArabicText(worker.name);
        if (!cleanCandidate || cleanCandidate === cleanQuery) continue;

        const candidateTokens = cleanCandidate.split(' ').filter(Boolean);
        if (!candidateTokens.length) continue;

        let score = 0;

        if (queryTokens.length >= 2 && candidateTokens.length >= 2) {
            let matchedTokens = 0;
            for (const qTok of queryTokens) {
                if (candidateTokens.some((cTok) => cTok === qTok || (qTok.length >= 4 && getLevenshteinDistance(qTok, cTok) <= 1))) {
                    matchedTokens++;
                }
            }
            const tokenOverlap = matchedTokens / Math.max(queryTokens.length, candidateTokens.length);
            const queryCoverage = matchedTokens / queryTokens.length;
            if (queryCoverage >= 0.75 && matchedTokens >= 2) {
                score = 0.75 + (tokenOverlap * 0.25);
            }
        }

        const maxLen = Math.max(cleanQuery.length, cleanCandidate.length);
        const levDist = getLevenshteinDistance(cleanQuery, cleanCandidate);
        const levScore = 1 - (levDist / maxLen);

        if (queryTokens[0] === candidateTokens[0] || (queryTokens[0].length >= 4 && getLevenshteinDistance(queryTokens[0], candidateTokens[0]) <= 1)) {
            if (levScore > score) {
                score = levScore;
            }
        } else {
            if (levScore < 0.85) {
                score = 0;
            }
        }

        if (score >= 0.75 && score > highestScore) {
            highestScore = score;
            bestMatch = worker;
        }
    }

    return bestMatch;
}

function replaceNameInTextarea(textareaId, oldName, newName) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const val = textarea.value;
    const lines = val.split(/[\r\n]+/);
    const oldNorm = normalizeArabicText(oldName);
    let replaced = false;
    const newLines = lines.map((line) => {
        if (!replaced && normalizeArabicText(line.trim()) === oldNorm) {
            replaced = true;
            return newName;
        }
        return line;
    });
    if (replaced) {
        textarea.value = newLines.join('\n');
        updateSmartAttendancePreview();
        showMessage(`تم تصحيح الاسم بنجاح إلى: ${newName}`, 'success');
    }
}

function checkExistingDayAttendance() {
    const daySelect = document.getElementById('smartAttendanceDaySelect');
    const alertEl = document.getElementById('smartExistingDayAlert');
    if (!daySelect) return 0;

    const selectedDayKey = daySelect.value;
    const dayObj = ORDERED_WEEK_DAYS.find((d) => d.key === selectedDayKey);
    const dayLabel = dayObj ? dayObj.label : selectedDayKey;

    const existingPresentRows = state.rows.filter((r) => r.attendance?.[selectedDayKey]?.present);
    const count = existingPresentRows.length;

    if (alertEl) {
        if (count > 0) {
            alertEl.classList.remove('hidden');
            alertEl.innerHTML = `
                <i class="fas fa-triangle-exclamation"></i>
                <div>
                    <strong>تنبيه: يوم ${escapeHtml(dayLabel)} يحتوي بالفعل على (${count}) عامل مسجلين كحضور.</strong>
                    <span>تطبيق الحضور سيقوم بتحديث واستبدال حضور هذا اليوم بالبيانات الجديدة.</span>
                </div>
            `;
        } else {
            alertEl.classList.add('hidden');
            alertEl.innerHTML = '';
        }
    }
    return count;
}

function populateSmartAttendanceDays() {
    const select = document.getElementById('smartAttendanceDaySelect');
    if (!select || !state.weekStart) return;

    select.innerHTML = ORDERED_WEEK_DAYS.map((day) => {
        const dateStr = addDays(state.weekStart, day.offset);
        return `<option value="${day.key}">${day.label} (${formatArabicDate(dateStr)})</option>`;
    }).join('');
}

function selectNameInTextarea(textareaId, targetName) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const text = textarea.value;
    const index = text.indexOf(targetName);
    if (index === -1) return;

    textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    textarea.focus();
    textarea.setSelectionRange(index, index + targetName.length);

    const textBefore = text.slice(0, index);
    const lineNumber = textBefore.split('\n').length - 1;
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || 24;
    const targetScrollTop = Math.max(0, lineNumber * lineHeight - (textarea.clientHeight / 2) + (lineHeight / 2));
    textarea.scrollTop = targetScrollTop;

    setTimeout(() => {
        textarea.scrollTop = targetScrollTop;
    }, 15);
}

function getSectionNamesAnalysis(rawText) {
    if (!rawText) return { uniqueNames: [], counts: new Map(), duplicates: new Map() };
    const rawList = String(rawText)
        .split(/[\r\n,،;؛]+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

    const counts = new Map();
    const nameByNormalized = new Map();
    const uniqueNames = [];

    rawList.forEach((name) => {
        const key = normalizeArabicText(name);
        if (!key) return;
        const currentCount = counts.get(key) || 0;
        counts.set(key, currentCount + 1);
        if (currentCount === 0) {
            nameByNormalized.set(key, name);
            uniqueNames.push(name);
        }
    });

    const duplicates = new Map();
    counts.forEach((count, key) => {
        if (count > 1) {
            duplicates.set(key, { name: nameByNormalized.get(key), count });
        }
    });

    return { uniqueNames, counts, duplicates };
}

function deduplicateTextarea(textareaId, silent = false) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return 0;
    const rawText = textarea.value;
    if (!rawText.trim()) return 0;

    const hasNewlines = rawText.includes('\n') || rawText.includes('\r');
    const separator = hasNewlines ? '\n' : '، ';
    const items = rawText.split(/[\r\n,،;؛]+/).map((s) => s.trim()).filter(Boolean);
    const seen = new Set();
    const cleanItems = [];
    let removedCount = 0;

    items.forEach((item) => {
        const key = normalizeArabicText(item);
        if (key && !seen.has(key)) {
            seen.add(key);
            cleanItems.push(item);
        } else if (key) {
            removedCount++;
        }
    });

    if (removedCount > 0) {
        textarea.value = cleanItems.join(separator);
        updateSmartAttendancePreview();
        if (!silent) {
            showMessage(`تمت إزالة (${removedCount}) اسم مكرر تلقائياً من البطاقة لمنع التكرار`, 'info');
        }
    }
    return removedCount;
}

function renderPillsForSection(containerId, textareaId, rawText, activeRows) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { uniqueNames, duplicates } = getSectionNamesAnalysis(rawText);
    if (!uniqueNames.length) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    const seenWorkerIds = new Set();
    const attentionPills = [];
    const recognizedPills = [];

    uniqueNames.forEach((name) => {
        const key = normalizeArabicText(name);
        const dupInfo = duplicates.get(key);
        const isDuplicate = Boolean(dupInfo && dupInfo.count > 1);
        const worker = findWorkerByName(name, activeRows);

        if (worker) {
            if (seenWorkerIds.has(worker.id)) return;
            seenWorkerIds.add(worker.id);
            if (isDuplicate) {
                attentionPills.push(`<span class="name-pill is-duplicate" data-textarea-id="${textareaId}" data-target-name="${escapeHtml(name)}" data-action="dedupe" title="الاسم مكرر (${dupInfo.count}) مرات في هذه البطاقة - انقر لحذف التكرار فوراً"><i class="fas fa-clone"></i> ${escapeHtml(worker.name)} (مكرر ${dupInfo.count}x)</span>`);
            } else {
                recognizedPills.push(`<span class="name-pill is-recognized" data-textarea-id="${textareaId}" data-target-name="${escapeHtml(name)}" title="تم التعرف عليه - انقر للانتقال إليه في المربع"><i class="fas fa-check"></i> ${escapeHtml(worker.name)}</span>`);
            }
        } else {
            const suggestedWorker = findClosestWorkerMatch(name, activeRows);
            if (isDuplicate) {
                attentionPills.push(`<span class="name-pill is-duplicate" data-textarea-id="${textareaId}" data-target-name="${escapeHtml(name)}" data-action="dedupe" title="الاسم مكرر (${dupInfo.count}) مرات وغير مسجل - انقر لحذف التكرار فوراً"><i class="fas fa-clone"></i> ${escapeHtml(name)} (مكرر ${dupInfo.count}x - غير مسجل)</span>`);
            } else if (suggestedWorker) {
                attentionPills.push(`<span class="name-pill is-unrecognized has-suggestion" data-textarea-id="${textareaId}" data-target-name="${escapeHtml(name)}" title="اسم غير مسجل - انقر للانتقال إليه"><i class="fas fa-times-circle"></i> ${escapeHtml(name)}<button type="button" class="pill-suggestion-btn" data-textarea-id="${textareaId}" data-replace-from="${escapeHtml(name)}" data-replace-to="${escapeHtml(suggestedWorker.name)}" title="انقر لاستبدال الاسم فوراً بالاسم المسجل"><i class="fas fa-wand-magic-sparkles"></i> هل تقصد: <strong>${escapeHtml(suggestedWorker.name)}</strong>؟</button></span>`);
            } else {
                attentionPills.push(`<span class="name-pill is-unrecognized" data-textarea-id="${textareaId}" data-target-name="${escapeHtml(name)}" title="اسم غير مسجل - انقر للانتقال إليه وتعديله"><i class="fas fa-times-circle"></i> ${escapeHtml(name)} (غير مسجل)</span>`);
            }
        }
    });

    if (!attentionPills.length && !recognizedPills.length) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    let renderedHtml = '';
    if (attentionPills.length > 0 && recognizedPills.length > 0) {
        renderedHtml = `
            <div class="smart-pills-alert-label">
                <span><i class="fas fa-triangle-exclamation"></i> بحاجة للمراجعة أو التعديل (${attentionPills.length})</span>
            </div>
            ${attentionPills.join('')}
            <div class="smart-pills-separator">
                <span><i class="fas fa-circle-check"></i> أسماء صحيحة ومطابقة (${recognizedPills.length})</span>
            </div>
            ${recognizedPills.join('')}
        `;
    } else if (attentionPills.length > 0) {
        renderedHtml = `
            <div class="smart-pills-alert-label">
                <span><i class="fas fa-triangle-exclamation"></i> بحاجة للمراجعة أو التعديل (${attentionPills.length})</span>
            </div>
            ${attentionPills.join('')}
        `;
    } else {
        renderedHtml = recognizedPills.join('');
    }

    container.classList.remove('hidden');
    container.innerHTML = renderedHtml;
}

function resetSmartAttendanceForm() {
    const presentInput = document.getElementById('smartPresentNamesInput');
    const fullOvertimeInput = document.getElementById('smartFullOvertimeNamesInput');
    const halfOvertimeInput = document.getElementById('smartHalfOvertimeNamesInput');
    const baseDurationSelect = document.getElementById('smartBaseDurationSelect');
    const previewEl = document.getElementById('smartAttendancePreview');

    if (presentInput) presentInput.value = '';
    if (fullOvertimeInput) fullOvertimeInput.value = '';
    if (halfOvertimeInput) halfOvertimeInput.value = '';
    if (baseDurationSelect) baseDurationSelect.value = '1';
    if (previewEl) {
        previewEl.classList.add('hidden');
        previewEl.innerHTML = '';
    }

    ['smartPresentNamesPills', 'smartFullOvertimeNamesPills', 'smartHalfOvertimeNamesPills'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.innerHTML = '';
        }
    });

    ['smartPresentCountBadge', 'smartFullOvertimeCountBadge', 'smartHalfOvertimeCountBadge'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0 عامل';
    });
}

function openSmartAttendanceModal() {
    populateSmartAttendanceDays();
    resetSmartAttendanceForm();
    checkExistingDayAttendance();
    openModal('smartAttendanceModal');
    document.getElementById('smartPresentNamesInput')?.focus();
}

function getCurrentlyAbsentWorkers() {
    const presentRaw = document.getElementById('smartPresentNamesInput')?.value || '';
    const fullOvertimeRaw = document.getElementById('smartFullOvertimeNamesInput')?.value || '';
    const halfOvertimeRaw = document.getElementById('smartHalfOvertimeNamesInput')?.value || '';

    const activeRows = state.rows.filter((r) => state.includeArchived ? true : r.is_active);
    const matchedPresent = new Map();

    const allPresentNames = [
        ...extractNamesList(presentRaw),
        ...extractNamesList(fullOvertimeRaw),
        ...extractNamesList(halfOvertimeRaw)
    ];

    allPresentNames.forEach((name) => {
        const worker = findWorkerByName(name, activeRows);
        if (worker) matchedPresent.set(worker.id, worker);
    });

    return activeRows.filter((worker) => !matchedPresent.has(worker.id));
}

function renderAbsentWorkersList(filterQuery = '') {
    const container = document.getElementById('absentWorkersListContainer');
    if (!container) return;

    const absentWorkers = getCurrentlyAbsentWorkers();
    const query = String(filterQuery || '').toLowerCase().trim();

    const filtered = query
        ? absentWorkers.filter((w) => (w.name || '').toLowerCase().includes(query) || (w.job_title || '').toLowerCase().includes(query))
        : absentWorkers;

    const countTitle = document.getElementById('absentWorkersModalTitle');
    if (countTitle) {
        countTitle.innerHTML = `<i class="fas fa-user-xmark" style="color: #ef4444;"></i> قائمة العمال الغائبين (${absentWorkers.length} عامل)`;
    }

    if (!absentWorkers.length) {
        container.innerHTML = `
            <div class="absent-empty-state">
                <i class="fas fa-circle-check"></i>
                <strong>لا يوجد أي عامل غائب!</strong>
                <p style="margin: 4px 0 0 0; font-size: 0.82rem;">جميع العمال مسجلون كحضور لهذا اليوم.</p>
            </div>
        `;
        return;
    }

    if (!filtered.length) {
        container.innerHTML = `
            <div class="absent-empty-state">
                <i class="fas fa-magnifying-glass" style="color: #94a3b8;"></i>
                <strong>لا توجد نتائج بحث مطابقة</strong>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((w, idx) => `
        <div class="absent-worker-item">
            <div class="absent-worker-info">
                <span class="absent-worker-num">${idx + 1}</span>
                <div class="absent-worker-details">
                    <strong>${escapeHtml(w.name)}</strong>
                    <span>${escapeHtml(w.job_title || 'عامل')}</span>
                </div>
            </div>
            <button type="button" class="absent-worker-add-btn" data-worker-name="${escapeHtml(w.name)}" title="تحضير هذا العامل وإضافته لقائمة الحاضرين فوراً">
                <i class="fas fa-plus"></i> تحضير العامل
            </button>
        </div>
    `).join('');
}

function addAbsentWorkerToPresent(workerName) {
    const textarea = document.getElementById('smartPresentNamesInput');
    if (!textarea || !workerName) return;

    const currentVal = textarea.value.trim();
    if (currentVal) {
        textarea.value = currentVal + '\n' + workerName;
    } else {
        textarea.value = workerName;
    }

    updateSmartAttendancePreview();
    showMessage(`تمت إضافة (${workerName}) إلى قائمة الحاضرين بنجاح`, 'success');
}

function copyAbsentWorkers() {
    const absentWorkers = getCurrentlyAbsentWorkers();
    if (!absentWorkers.length) {
        showMessage('لا يوجد عمال غائبون لنسخهم', 'info');
        return;
    }
    const daySelect = document.getElementById('smartAttendanceDaySelect');
    const dayKey = daySelect?.value;
    const dayObj = ORDERED_WEEK_DAYS.find((d) => d.key === dayKey);
    const dayLabel = dayObj ? dayObj.label : 'اليوم';

    const text = `📋 كشف غياب يوم (${dayLabel}) - (${absentWorkers.length} عامل):\n` +
        absentWorkers.map((w, i) => `${i + 1}- ${w.name} (${w.job_title || 'عامل'})`).join('\n');

    navigator.clipboard.writeText(text).then(() => {
        showMessage(`تم نسخ كشف الغياب (${absentWorkers.length} عامل) بنجاح`, 'success');
    }).catch(() => {
        showMessage('تعذر نسخ الكشف، يرجى المحاولة يدوياً', 'warning');
    });
}

function openAbsentWorkersModal() {
    const searchInput = document.getElementById('absentWorkersSearchInput');
    if (searchInput) searchInput.value = '';

    const daySelect = document.getElementById('smartAttendanceDaySelect');
    const dayKey = daySelect?.value;
    const dayObj = ORDERED_WEEK_DAYS.find((d) => d.key === dayKey);
    const dayLabel = dayObj ? dayObj.label : 'المحدد';

    const subtitle = document.getElementById('absentWorkersModalSubtitle');
    if (subtitle) {
        subtitle.textContent = `العمال غير المذكورين في كشف الحضور ليوم (${dayLabel})`;
    }

    renderAbsentWorkersList('');
    openModal('absentWorkersModal');
    searchInput?.focus();
}

function getLowWageWorkers() {
    return (state.rows || []).filter((w) => {
        if (!state.includeArchived && !w.is_active) return false;
        const wage = Number(w.daily_wage) || 0;
        return wage <= 50;
    });
}

function renderLowWageWorkersList(filterQuery = '') {
    const container = document.getElementById('lowWageWorkersListContainer');
    if (!container) return;

    const lowWageWorkers = getLowWageWorkers();
    const query = String(filterQuery || '').toLowerCase().trim();

    const filtered = query
        ? lowWageWorkers.filter((w) => (w.name || '').toLowerCase().includes(query) || (w.job_title || '').toLowerCase().includes(query))
        : lowWageWorkers;

    const countTitle = document.getElementById('lowWageWorkersModalTitle');
    if (countTitle) {
        countTitle.innerHTML = `<i class="fas fa-triangle-exclamation" style="color: #ef4444;"></i> عمال بأجر يومي 50 ج أو أقل (${lowWageWorkers.length} عامل)`;
    }

    if (!lowWageWorkers.length) {
        container.innerHTML = `
            <div class="absent-empty-state">
                <i class="fas fa-circle-check" style="color: #10b981; font-size: 2.4rem;"></i>
                <strong>جميع أجور العمال صحيحة!</strong>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #64748b;">لا يوجد أي عامل بأجر يومي 50 ج.م أو أقل حالياً.</p>
            </div>
        `;
        return;
    }

    if (!filtered.length) {
        container.innerHTML = `
            <div class="absent-empty-state">
                <i class="fas fa-magnifying-glass" style="color: #94a3b8; font-size: 2rem;"></i>
                <strong>لا توجد نتائج بحث مطابقة</strong>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((w, idx) => `
        <div class="low-wage-worker-item">
            <div class="absent-worker-info">
                <span class="absent-worker-num">${idx + 1}</span>
                <div class="absent-worker-details">
                    <strong>${escapeHtml(w.name)}</strong>
                    <span>${escapeHtml(w.job_title || 'عامل')}</span>
                </div>
            </div>
            <div class="low-wage-worker-actions">
                <span class="low-wage-current-badge">${formatMoney(w.daily_wage)} ج.م</span>
                <button type="button" class="workers-btn workers-btn-primary workers-btn-small" data-action="edit-low-wage-worker" data-id="${w.id}">
                    <i class="fas fa-pen"></i> تصحيح الأجر
                </button>
            </div>
        </div>
    `).join('');
}

function openLowWageWorkersModal() {
    renderLowWageWorkersList();
    openModal('lowWageWorkersModal');
    const searchInput = document.getElementById('lowWageWorkersSearchInput');
    if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 80);
    }
}

function updateSmartAttendancePreview() {
    const previewEl = document.getElementById('smartAttendancePreview');
    if (!previewEl) return;

    const presentRaw = document.getElementById('smartPresentNamesInput')?.value || '';
    const fullOvertimeRaw = document.getElementById('smartFullOvertimeNamesInput')?.value || '';
    const halfOvertimeRaw = document.getElementById('smartHalfOvertimeNamesInput')?.value || '';

    const activeRows = state.rows.filter((r) => state.includeArchived ? true : r.is_active);

    renderPillsForSection('smartPresentNamesPills', 'smartPresentNamesInput', presentRaw, activeRows);
    renderPillsForSection('smartFullOvertimeNamesPills', 'smartFullOvertimeNamesInput', fullOvertimeRaw, activeRows);
    renderPillsForSection('smartHalfOvertimeNamesPills', 'smartHalfOvertimeNamesInput', halfOvertimeRaw, activeRows);

    const presentNames = extractNamesList(presentRaw);
    const fullOvertimeNames = extractNamesList(fullOvertimeRaw);
    const halfOvertimeNames = extractNamesList(halfOvertimeRaw);

    const presentBadge = document.getElementById('smartPresentCountBadge');
    if (presentBadge) presentBadge.textContent = `${presentNames.length} عامل`;
    const fullBadge = document.getElementById('smartFullOvertimeCountBadge');
    if (fullBadge) fullBadge.textContent = `${fullOvertimeNames.length} عامل`;
    const halfBadge = document.getElementById('smartHalfOvertimeCountBadge');
    if (halfBadge) halfBadge.textContent = `${halfOvertimeNames.length} عامل`;

    if (!presentNames.length && !fullOvertimeNames.length && !halfOvertimeNames.length) {
        previewEl.classList.add('hidden');
        previewEl.innerHTML = '';
        return;
    }

    const matchedPresent = new Map();
    const unrecognized = [];

    presentNames.forEach((name) => {
        const worker = findWorkerByName(name, activeRows);
        if (worker) {
            matchedPresent.set(worker.id, worker);
        } else if (!unrecognized.includes(name)) {
            unrecognized.push(name);
        }
    });

    const matchedFull = new Map();
    fullOvertimeNames.forEach((name) => {
        const worker = findWorkerByName(name, activeRows);
        if (worker) {
            matchedFull.set(worker.id, worker);
            matchedPresent.set(worker.id, worker);
        } else if (!unrecognized.includes(name)) {
            unrecognized.push(name);
        }
    });

    const matchedHalf = new Map();
    halfOvertimeNames.forEach((name) => {
        const worker = findWorkerByName(name, activeRows);
        if (worker) {
            matchedHalf.set(worker.id, worker);
            matchedPresent.set(worker.id, worker);
        } else if (!unrecognized.includes(name)) {
            unrecognized.push(name);
        }
    });

    let combinedCount = 0;
    matchedFull.forEach((_, id) => {
        if (matchedHalf.has(id)) combinedCount++;
    });

    const absentCount = Math.max(0, activeRows.length - matchedPresent.size);

    previewEl.classList.remove('hidden');
    previewEl.innerHTML = `
        <div class="smart-preview-summary">
            <span class="preview-badge badge-present"><i class="fas fa-check-circle"></i> حاضرون: ${matchedPresent.size}</span>
            <span class="preview-badge badge-overtime-full"><i class="fas fa-moon"></i> سهرة كاملة: ${matchedFull.size}</span>
            <span class="preview-badge badge-overtime-half"><i class="fas fa-cloud-moon"></i> نصف سهرة: ${matchedHalf.size}</span>
            ${combinedCount > 0 ? `<span class="preview-badge badge-overtime-combined" style="background: rgba(168, 85, 247, 0.12); color: #7e22ce;"><i class="fas fa-star"></i> يوم ونصف (سهرة + نصف): ${combinedCount}</span>` : ''}
            ${absentCount === 0 ? `
                <span class="preview-badge badge-absent-zero" id="smartAbsentPreviewBadge" role="button" tabindex="0" title="اكتمال الحضور - انقر لعرض التفاصيل"><i class="fas fa-circle-check"></i> اكتمال الحضور (0 غياب) 🎉</span>
            ` : `
                <span class="preview-badge badge-absent" id="smartAbsentPreviewBadge" role="button" tabindex="0" title="انقر لعرض قائمة العمال الغائبين بالتفصيل"><i class="fas fa-user-xmark"></i> غياب: ${absentCount} <i class="fas fa-up-right-from-square" style="font-size: 0.72rem; margin-right: 4px; opacity: 0.85;"></i></span>
            `}
        </div>
        ${unrecognized.length ? `
            <div class="smart-preview-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>أسماء لم يتم التعرف عليها (${unrecognized.length}):</strong>
                    <span>${unrecognized.map(escapeHtml).join('، ')}</span>
                </div>
            </div>
        ` : ''}
    `;

    const absentModal = document.getElementById('absentWorkersModal');
    if (absentModal && !absentModal.classList.contains('hidden')) {
        renderAbsentWorkersList(document.getElementById('absentWorkersSearchInput')?.value || '');
    }
}

async function applySmartAttendance() {
    deduplicateTextarea('smartPresentNamesInput', true);
    deduplicateTextarea('smartFullOvertimeNamesInput', true);
    deduplicateTextarea('smartHalfOvertimeNamesInput', true);

    const daySelect = document.getElementById('smartAttendanceDaySelect');
    const baseDurationSelect = document.getElementById('smartBaseDurationSelect');
    if (!daySelect || !baseDurationSelect) return;

    const selectedDayKey = daySelect.value;
    const baseDuration = Number(baseDurationSelect.value) || 1;

    const presentRaw = document.getElementById('smartPresentNamesInput')?.value || '';
    const fullOvertimeRaw = document.getElementById('smartFullOvertimeNamesInput')?.value || '';
    const halfOvertimeRaw = document.getElementById('smartHalfOvertimeNamesInput')?.value || '';

    const presentNames = extractNamesList(presentRaw);
    const fullOvertimeNames = extractNamesList(fullOvertimeRaw);
    const halfOvertimeNames = extractNamesList(halfOvertimeRaw);

    if (!presentNames.length && !fullOvertimeNames.length && !halfOvertimeNames.length) {
        showMessage('يرجى إدخال أسماء العمال الحاضرين أو السهرات أولاً', 'warning');
        return;
    }

    const activeRows = state.rows.filter((r) => state.includeArchived ? true : r.is_active);

    const matchedPresentIds = new Set();
    const unrecognized = [];

    presentNames.forEach((name) => {
        const worker = findWorkerByName(name, activeRows);
        if (worker) {
            matchedPresentIds.add(worker.id);
        } else if (!unrecognized.includes(name)) {
            unrecognized.push(name);
        }
    });

    const matchedFullIds = new Set();
    fullOvertimeNames.forEach((name) => {
        const worker = findWorkerByName(name, activeRows);
        if (worker) {
            matchedFullIds.add(worker.id);
            matchedPresentIds.add(worker.id);
        } else if (!unrecognized.includes(name)) {
            unrecognized.push(name);
        }
    });

    const matchedHalfIds = new Set();
    halfOvertimeNames.forEach((name) => {
        const worker = findWorkerByName(name, activeRows);
        if (worker) {
            matchedHalfIds.add(worker.id);
            matchedPresentIds.add(worker.id);
        } else if (!unrecognized.includes(name)) {
            unrecognized.push(name);
        }
    });

    const rowElements = Array.from(document.querySelectorAll('#workersTableBody tr[data-worker-id]'));
    if (!rowElements.length) {
        showMessage('لا يوجد عمال في الجدول للتطبيق عليهم', 'warning');
        return;
    }

    const existingCount = checkExistingDayAttendance();
    const dayObj = ORDERED_WEEK_DAYS.find((d) => d.key === selectedDayKey);
    const dayLabel = dayObj ? dayObj.label : selectedDayKey;

    if (existingCount > 0) {
        const htmlMsg = `
            <div class="smart-confirm-content">
                <div class="smart-confirm-banner warning">
                    <i class="fas fa-calendar-check"></i>
                    <div>
                        <strong>يوم (${escapeHtml(dayLabel)}) مسجل به حضور بالفعل</strong>
                        <span>يحتوي هذا اليوم حالياً على (${existingCount}) عامل مسجلين كحضور.</span>
                    </div>
                </div>
                <p class="smart-confirm-text">تطبيق البيانات الجديدة سيقوم <strong>بتحديث واستبدال</strong> كشف الحضور لهذا اليوم بالأسماء المدخلة حالياً.</p>
                <div class="smart-confirm-question">هل أنت متأكد من رغبتك في المتابعة واستبدال حضور هذا اليوم؟</div>
            </div>
        `;
        const confirmed = typeof window.showConfirmDialog === 'function'
            ? await window.showConfirmDialog(htmlMsg, {
                title: 'تنبيه استبدال الحضور السابق',
                confirmText: 'نعم، استبدال وتطبيق',
                cancelText: 'تراجع',
                isHtml: true
            })
            : window.confirm(`تنبيه: يوم (${dayLabel}) يحتوي بالفعل على (${existingCount}) عامل مسجلين كحضور. هل تريد الاستبدال؟`);

        if (!confirmed) {
            return;
        }
    }

    if (unrecognized.length > 0) {
        const pillsHtml = unrecognized.map((name) => `<span class="name-pill is-unrecognized"><i class="fas fa-times-circle"></i> ${escapeHtml(name)}</span>`).join('');
        const htmlMsg = `
            <div class="smart-confirm-content">
                <div class="smart-confirm-banner danger">
                    <i class="fas fa-triangle-exclamation"></i>
                    <div>
                        <strong>يوجد (${unrecognized.length}) اسم غير مسجلين في قائمة العمال:</strong>
                        <span>لم يتم التعرف على هذه الأسماء كعمال مسجلين في المنظومة.</span>
                    </div>
                </div>
                <div class="smart-confirm-pills-wrap">
                    ${pillsHtml}
                </div>
                <p class="smart-confirm-warning-note">
                    <i class="fas fa-info-circle"></i> تنبيه: لن يتم تسجيل حضور هذه الأسماء في الجدول ولن تُحسب لهم أي مستحقات مالية.
                </p>
                <div class="smart-confirm-question">هل تريد المتابعة وتطبيق الحضور للعمال المسجلين فقط وتجاهل الأسماء غير المسجلة؟</div>
            </div>
        `;
        const confirmed = typeof window.showConfirmDialog === 'function'
            ? await window.showConfirmDialog(htmlMsg, {
                title: 'تنبيه تأكيدي: أسماء غير مسجلة',
                confirmText: 'نعم، تطبيق المسجلين فقط',
                cancelText: 'تراجع لتصحيح الأسماء',
                isHtml: true
            })
            : window.confirm(`تنبيه: يوجد (${unrecognized.length}) اسم غير مسجل. هل تريد المتابعة وتطبيق المسجلين فقط؟`);

        if (!confirmed) {
            return;
        }
    }

    const isNewLogic = state.weekStart >= '2026-07-11';
    let appliedCount = 0;

    rowElements.forEach((rowElement) => {
        const workerId = Number(rowElement.dataset.workerId);
        const cell = rowElement.querySelector(`.attendance-day-cell[data-day="${selectedDayKey}"]`);
        if (!cell) return;

        const isPresent = matchedPresentIds.has(workerId);
        let duration = 0;
        if (isPresent) {
            const hasFull = matchedFullIds.has(workerId);
            const hasHalf = matchedHalfIds.has(workerId);
            if (hasFull && hasHalf) {
                duration = 1.5;
            } else if (hasFull) {
                duration = 1;
            } else if (hasHalf) {
                duration = 0.5;
            } else {
                duration = isNewLogic ? 0 : 1;
            }
        }

        applyAttendanceCellState(cell, isPresent);

        const baseSelect = cell.querySelector('.attendance-base-duration');
        if (baseSelect) {
            baseSelect.value = isPresent ? String(baseDuration) : '1';
        }

        const durationSelect = cell.querySelector('.attendance-duration');
        if (durationSelect) {
            durationSelect.value = isPresent ? String(duration) : '0';
        }

        updateRowCalculations(rowElement);
        syncAttendanceStateFromRow(rowElement);
        if (isPresent) appliedCount += 1;
    });

    updateSummaryFromTable();
    state.hasUnsavedAttendance = true;

    closeModal('smartAttendanceModal');

    let msg = `تم تطبيق حضور يوم ${dayLabel}: (${appliedCount}) حاضر، (${Math.max(0, rowElements.length - appliedCount)}) غائب`;
    if (matchedFullIds.size > 0 || matchedHalfIds.size > 0) {
        msg += ` | السهرات: (${matchedFullIds.size + matchedHalfIds.size})`;
    }
    showMessage(msg, 'success');

    if (unrecognized.length > 0) {
        setTimeout(() => {
            showMessage(`تنبيه: لم يتم التعرف على (${unrecognized.length}) اسم: ${unrecognized.slice(0, 5).join('، ')}${unrecognized.length > 5 ? '...' : ''}`, 'warning');
        }, 1500);
    }
}

function bindEvents() {
    document.addEventListener('click', handleUnsavedAttendanceNavigation, true);
    document.getElementById('addWorkerBtn').addEventListener('click', () => openWorkerModal());
    document.getElementById('printWeekBtn').addEventListener('click', () => window.print());
    document.getElementById('saveWeekBtn').addEventListener('click', saveWeekAttendance);
    const saveWeekBtnTop = document.getElementById('saveWeekBtnTop');
    if (saveWeekBtnTop) {
        saveWeekBtnTop.addEventListener('click', saveWeekAttendance);
    }
    const smartBtn = document.getElementById('smartAttendanceBtn');
    if (smartBtn) {
        smartBtn.addEventListener('click', openSmartAttendanceModal);
    }
    const applySmartBtn = document.getElementById('applySmartAttendanceBtn');
    if (applySmartBtn) {
        applySmartBtn.addEventListener('click', applySmartAttendance);
    }
    const smartPresentInput = document.getElementById('smartPresentNamesInput');
    if (smartPresentInput) {
        smartPresentInput.addEventListener('input', updateSmartAttendancePreview);
        smartPresentInput.addEventListener('blur', () => deduplicateTextarea('smartPresentNamesInput'));
        smartPresentInput.addEventListener('paste', () => {
            setTimeout(() => deduplicateTextarea('smartPresentNamesInput'), 50);
        });
    }
    const smartFullOvertimeInput = document.getElementById('smartFullOvertimeNamesInput');
    if (smartFullOvertimeInput) {
        smartFullOvertimeInput.addEventListener('input', updateSmartAttendancePreview);
        smartFullOvertimeInput.addEventListener('blur', () => deduplicateTextarea('smartFullOvertimeNamesInput'));
        smartFullOvertimeInput.addEventListener('paste', () => {
            setTimeout(() => deduplicateTextarea('smartFullOvertimeNamesInput'), 50);
        });
    }
    const smartHalfOvertimeInput = document.getElementById('smartHalfOvertimeNamesInput');
    if (smartHalfOvertimeInput) {
        smartHalfOvertimeInput.addEventListener('input', updateSmartAttendancePreview);
        smartHalfOvertimeInput.addEventListener('blur', () => deduplicateTextarea('smartHalfOvertimeNamesInput'));
        smartHalfOvertimeInput.addEventListener('paste', () => {
            setTimeout(() => deduplicateTextarea('smartHalfOvertimeNamesInput'), 50);
        });
    }
    document.getElementById('smartAttendanceDaySelect')?.addEventListener('change', checkExistingDayAttendance);
    document.getElementById('smartAttendanceModal')?.addEventListener('click', (event) => {
        const absentBadge = event.target.closest('.badge-absent, .badge-absent-zero');
        if (absentBadge) {
            openAbsentWorkersModal();
            return;
        }
        const suggestionBtn = event.target.closest('.pill-suggestion-btn');
        if (suggestionBtn) {
            event.stopPropagation();
            const textareaId = suggestionBtn.dataset.textareaId;
            const fromName = suggestionBtn.dataset.replaceFrom;
            const toName = suggestionBtn.dataset.replaceTo;
            if (textareaId && fromName && toName) {
                replaceNameInTextarea(textareaId, fromName, toName);
            }
            return;
        }
        const clearBtn = event.target.closest('.smart-clear-btn[data-clear-target]');
        if (clearBtn) {
            const targetId = clearBtn.dataset.clearTarget;
            const target = document.getElementById(targetId);
            if (target) {
                target.value = '';
                updateSmartAttendancePreview();
                target.focus();
            }
            return;
        }
        const clearAllBtn = event.target.closest('#smartClearAllBtn');
        if (clearAllBtn) {
            resetSmartAttendanceForm();
            return;
        }
        const pill = event.target.closest('.name-pill[data-textarea-id]');
        if (!pill) return;
        const textareaId = pill.dataset.textareaId;
        const targetName = pill.dataset.targetName;
        const action = pill.dataset.action;
        if (action === 'dedupe') {
            deduplicateTextarea(textareaId);
        }
        if (textareaId && targetName) {
            selectNameInTextarea(textareaId, targetName);
        }
    });
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
            applyAttendanceCellState(cell, event.target.checked);
        }

        updateRowCalculations(row);
        syncAttendanceStateFromRow(row);
    });

    const attendanceDrag = {
        isMouseDown: false,
        hasDragged: false,
        targetState: false,
        row: null,
        lastCell: null
    };

    document.getElementById('workersTableBody').addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        if (event.target.closest('select') || event.target.closest('button')) return;

        const cell = event.target.closest('.attendance-day-cell');
        if (!cell) return;

        const row = cell.closest('tr[data-worker-id]');
        if (!row) return;

        const checkbox = cell.querySelector('.attendance-check');
        if (!checkbox) return;

        attendanceDrag.isMouseDown = true;
        attendanceDrag.hasDragged = false;
        attendanceDrag.targetState = !checkbox.checked;
        attendanceDrag.row = row;
        attendanceDrag.lastCell = cell;
    });

    document.getElementById('workersTableBody').addEventListener('mouseover', (event) => {
        if (!attendanceDrag.isMouseDown || !attendanceDrag.row || event.buttons !== 1) {
            if (attendanceDrag.isMouseDown && event.buttons !== 1) {
                attendanceDrag.isMouseDown = false;
                attendanceDrag.hasDragged = false;
                attendanceDrag.row = null;
                attendanceDrag.lastCell = null;
                document.body.classList.remove('attendance-is-dragging');
            }
            return;
        }

        const cell = event.target.closest('.attendance-day-cell');
        if (!cell || cell === attendanceDrag.lastCell) return;
        if (!attendanceDrag.row.contains(cell)) return;

        if (!attendanceDrag.hasDragged) {
            attendanceDrag.hasDragged = true;
            document.body.classList.add('attendance-is-dragging');
            applyAttendanceCellState(attendanceDrag.lastCell, attendanceDrag.targetState);
        }

        const cellsInRow = Array.from(attendanceDrag.row.querySelectorAll('.attendance-day-cell'));
        const fromIndex = cellsInRow.indexOf(attendanceDrag.lastCell);
        const toIndex = cellsInRow.indexOf(cell);

        if (fromIndex !== -1 && toIndex !== -1) {
            const step = fromIndex < toIndex ? 1 : -1;
            for (let i = fromIndex; i !== toIndex + step; i += step) {
                const targetCell = cellsInRow[i];
                applyAttendanceCellState(targetCell, attendanceDrag.targetState);
            }
        } else {
            applyAttendanceCellState(cell, attendanceDrag.targetState);
        }

        updateRowCalculations(attendanceDrag.row);
        syncAttendanceStateFromRow(attendanceDrag.row);
        attendanceDrag.lastCell = cell;
    });

    window.addEventListener('mouseup', () => {
        if (attendanceDrag.isMouseDown) {
            if (attendanceDrag.hasDragged && attendanceDrag.row) {
                updateRowCalculations(attendanceDrag.row);
                syncAttendanceStateFromRow(attendanceDrag.row);
            }
            attendanceDrag.isMouseDown = false;
            attendanceDrag.row = null;
            attendanceDrag.lastCell = null;
            document.body.classList.remove('attendance-is-dragging');
            setTimeout(() => {
                attendanceDrag.hasDragged = false;
            }, 50);
        }
    });

    document.getElementById('workersTableBody').addEventListener('click', (event) => {
        if (attendanceDrag.hasDragged) {
            event.preventDefault();
            return;
        }

        if (event.target.closest('select') || event.target.closest('button')) return;

        const cell = event.target.closest('.attendance-day-cell');
        if (!cell) return;

        if (!event.target.classList.contains('attendance-check')) {
            const checkbox = cell.querySelector('.attendance-check');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                applyAttendanceCellState(cell, checkbox.checked);
                const row = cell.closest('tr[data-worker-id]');
                if (row) {
                    updateRowCalculations(row);
                    syncAttendanceStateFromRow(row);
                }
            }
        }
    });

    document.getElementById('workersTableBody').addEventListener('click', async (event) => {
        const lowWageBox = event.target.closest('.worker-name-low-wage');
        if (lowWageBox) {
            const row = lowWageBox.closest('tr[data-worker-id]');
            if (row) {
                const worker = getWorkerById(row.dataset.workerId);
                if (worker) {
                    openWorkerModal(worker);
                    return;
                }
            }
        }

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
            if (event.target !== overlay) return;
            if (overlay.id === 'smartAttendanceModal') {
                const card = overlay.querySelector('.workers-modal');
                if (card) {
                    card.classList.remove('modal-protect-pulse');
                    void card.offsetWidth;
                    card.classList.add('modal-protect-pulse');
                }
                return;
            }
            closeModal(overlay.id);
        });
    });

    document.getElementById('absentWorkersSearchInput')?.addEventListener('input', (event) => {
        renderAbsentWorkersList(event.target.value);
    });

    document.getElementById('copyAbsentWorkersBtn')?.addEventListener('click', copyAbsentWorkers);

    document.getElementById('absentWorkersModal')?.addEventListener('click', (event) => {
        const addBtn = event.target.closest('.absent-worker-add-btn');
        if (addBtn) {
            const name = addBtn.dataset.workerName;
            if (name) addAbsentWorkerToPresent(name);
        }
    });

    document.getElementById('netPayCard')?.addEventListener('click', () => {
        openLowWageWorkersModal();
    });

    document.getElementById('lowWageWorkersSearchInput')?.addEventListener('input', (event) => {
        renderLowWageWorkersList(event.target.value);
    });

    document.getElementById('lowWageWorkersModal')?.addEventListener('click', (event) => {
        const editBtn = event.target.closest('[data-action="edit-low-wage-worker"]');
        if (editBtn) {
            const worker = getWorkerById(editBtn.dataset.id);
            if (worker) {
                closeModal('lowWageWorkersModal');
                openWorkerModal(worker);
            }
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!document.getElementById('lowWageWorkersModal')?.classList.contains('hidden')) {
            closeModal('lowWageWorkersModal');
            return;
        }
        if (!document.getElementById('absentWorkersModal')?.classList.contains('hidden')) {
            closeModal('absentWorkersModal');
            return;
        }
        if (!document.getElementById('smartAttendanceModal').classList.contains('hidden')) {
            closeModal('smartAttendanceModal');
            return;
        }
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

    document.addEventListener('wheel', (event) => {
        if (!document.documentElement.classList.contains('workers-modal-open')) return;
        let el = event.target;
        let canScroll = false;
        while (el && el !== document.body && el !== document.documentElement) {
            if (el.matches('textarea, .smart-names-pills, .absent-workers-list-wrap, #workerAdvancesList')) {
                const hasScroll = el.scrollHeight > el.clientHeight;
                if (hasScroll) {
                    const isScrollingUp = event.deltaY < 0;
                    const isScrollingDown = event.deltaY > 0;
                    const atTop = el.scrollTop <= 0;
                    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
                    if ((isScrollingUp && !atTop) || (isScrollingDown && !atBottom)) {
                        canScroll = true;
                        break;
                    }
                }
            }
            el = el.parentElement;
        }
        if (!canScroll) {
            event.preventDefault();
        }
    }, { passive: false });
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
