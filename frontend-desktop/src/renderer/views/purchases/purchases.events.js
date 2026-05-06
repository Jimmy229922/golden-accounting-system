(function () {
    function bindStaticEvents({ root, dom, handlers }) {
        if (dom.supplierSelect) {
            dom.supplierSelect.addEventListener('change', handlers.onSupplierChange);
        }

        if (root) {
            root.addEventListener('click', (event) => {
                const actionEl = event.target.closest('[data-action]');
                if (!actionEl) return;

                const action = actionEl.dataset.action;
                if (action === 'add-row') {
                    handlers.onAddRow();
                    return;
                }

                if (action === 'submit-invoice') {
                    handlers.onSubmitInvoice();
                    return;
                }

                if (action === 'load-prev-invoice') {
                    handlers.onLoadPrevInvoice();
                    return;
                }

                if (action === 'load-next-invoice') {
                    handlers.onLoadNextInvoice();
                    return;
                }

                if (action === 'remove-row') {
                    handlers.onRemoveRow(actionEl);
                }
            });
        }
    }

    function bindRowsEvents({ dom, handlers }) {
        if (!dom.invoiceItemsBody) return;

        dom.invoiceItemsBody.addEventListener('change', (event) => {
            const target = event.target;
            if (target && target.classList.contains('item-select')) {
                handlers.onItemSelect(target);
            }
        });

        dom.invoiceItemsBody.addEventListener('input', (event) => {
            const target = event.target;
            if (!target) return;
            if (target.classList.contains('quantity-input') || target.classList.contains('price-input')) {
                handlers.onRowInput(target);
            }
        });

        dom.invoiceItemsBody.addEventListener('keydown', (event) => {
            if (
                event.key !== 'ArrowDown' &&
                event.key !== 'ArrowUp' &&
                event.key !== 'ArrowRight' &&
                event.key !== 'ArrowLeft'
            ) return;

            const target = event.target;
            if (!target) return;

            const isGridField =
                target.classList.contains('barcode-input') ||
                target.classList.contains('autocomplete-input') ||
                target.classList.contains('quantity-input') ||
                target.classList.contains('price-input');

            if (!isGridField) return;
            if (handlers.onRowArrowNavigate) {
                handlers.onRowArrowNavigate(event);
            }
        });
    }

    window.purchasesPageEvents = {
        bindStaticEvents,
        bindRowsEvents
    };
})();
