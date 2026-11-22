(function attachFinancialPagination(globalScope) {
    const PAGE_SIZE_OPTIONS = [10, 30, 50, 70, 100];

    function normalizePositiveNumber(value, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) {
            return fallback;
        }
        return num;
    }

    function buildPageSizeOptions(selectedValue) {
        return PAGE_SIZE_OPTIONS.map((size) => `
            <option value="${size}" ${size === selectedValue ? 'selected' : ''}>${size}</option>
        `).join('');
    }

    function bind(container, handlers = {}) {
        if (!container) return;

        container.__financialPaginationHandlers = handlers;
        if (container.dataset.financialPaginationBound === 'true') {
            return;
        }

        container.addEventListener('click', (event) => {
            const button = event.target.closest('[data-pagination-action="change-page"]');
            if (!button || button.disabled) return;

            const page = normalizePositiveNumber(button.dataset.page, 1);
            const currentHandlers = container.__financialPaginationHandlers || {};
            if (typeof currentHandlers.onPageChange === 'function') {
                currentHandlers.onPageChange(page);
            }
        });

        container.addEventListener('change', (event) => {
            if (event.target?.dataset?.paginationAction !== 'change-page-size') return;

            const pageSize = normalizePositiveNumber(event.target.value, 50);
            const currentHandlers = container.__financialPaginationHandlers || {};
            if (typeof currentHandlers.onPageSizeChange === 'function') {
                currentHandlers.onPageSizeChange(pageSize);
            }
        });

        container.dataset.financialPaginationBound = 'true';
    }

    function render(container, state = {}) {
        if (!container) return;

        const total = Math.max(0, Number(state.total) || 0);
        if (total <= 0) {
            container.innerHTML = '';
            return;
        }

        const pageSize = normalizePositiveNumber(state.pageSize, 50);
        const totalPages = Math.max(1, normalizePositiveNumber(state.totalPages, 1));
        const page = Math.min(normalizePositiveNumber(state.page, 1), totalPages);
        const start = ((page - 1) * pageSize) + 1;
        const end = Math.min(page * pageSize, total);

        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;width:100%;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <label for="${container.id || 'pagination'}PageSize" style="font-weight:600;color:var(--text-color);">عدد المعروض</label>
                    <select
                        id="${container.id || 'pagination'}PageSize"
                        class="form-control"
                        data-pagination-action="change-page-size"
                        style="min-width:96px;max-width:96px;padding:8px 12px;"
                    >
                        ${buildPageSizeOptions(pageSize)}
                    </select>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span style="color:var(--text-secondary);font-weight:600;">عرض ${start} - ${end} من ${total}</span>
                    <button type="button" class="btn btn-outline" data-pagination-action="change-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>السابق</button>
                    <span style="color:var(--text-secondary);font-weight:600;">صفحة ${page} من ${totalPages}</span>
                    <button type="button" class="btn btn-outline" data-pagination-action="change-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>
                </div>
            </div>
        `;
    }

    globalScope.financialPagination = {
        PAGE_SIZE_OPTIONS,
        bind,
        render
    };
})(window);
