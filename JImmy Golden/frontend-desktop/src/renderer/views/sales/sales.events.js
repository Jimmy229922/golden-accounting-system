(function () {
    function bindStaticEvents({ root, dom, handlers }) {
        if (dom.customerSelect) {
            dom.customerSelect.addEventListener('change', handlers.onCustomerChange);
        }

        if (dom.shiftCloseSearchInput) {
            dom.shiftCloseSearchInput.addEventListener('input', handlers.onShiftCloseSearchInput);
        }

        if (dom.shiftCloseDrawerInput) {
            dom.shiftCloseDrawerInput.addEventListener('input', handlers.onShiftCloseAmountsInput);
        }

        if (dom.shiftCloseTotalInput) {
            dom.shiftCloseTotalInput.addEventListener('input', handlers.onShiftCloseAmountsInput);
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

                if (action === 'print-invoice') {
                    handlers.onPrintInvoice();
                    return;
                }

                if (action === 'confirm-print-invoice') {
                    handlers.onConfirmPrintInvoice();
                    return;
                }

                if (action === 'close-print-preview') {
                    handlers.onClosePrintPreview();
                    return;
                }

                if (action === 'change-print-printer') {
                    handlers.onChangePrintPrinter();
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

                if (action === 'open-shift-close-modal') {
                    handlers.onOpenShiftCloseModal();
                    return;
                }

                if (action === 'close-shift-close-modal') {
                    handlers.onCloseShiftCloseModal();
                    return;
                }

                if (action === 'refresh-shift-close-preview') {
                    handlers.onRefreshShiftClosePreview();
                    return;
                }

                if (action === 'submit-shift-close') {
                    handlers.onSubmitShiftClose();
                    return;
                }

                if (action === 'reset-shift-close-form') {
                    handlers.onResetShiftCloseForm();
                    return;
                }

                if (action === 'edit-shift-close') {
                    handlers.onEditShiftClose(actionEl);
                    return;
                }

                if (action === 'delete-shift-close') {
                    handlers.onDeleteShiftClose(actionEl);
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

    window.salesPageEvents = {
        bindStaticEvents,
        bindRowsEvents
    };
})();

