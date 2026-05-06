(function () {
    function bindEvents({ root, dom, handlers }) {
        if (dom.customerSelect) {
            dom.customerSelect.addEventListener('change', handlers.onCustomerChange);
        }

        if (dom.invoiceSelect) {
            dom.invoiceSelect.addEventListener('change', handlers.onInvoiceChange);
        }

        if (dom.itemsBody) {
            dom.itemsBody.addEventListener('change', (event) => {
                const target = event.target;
                if (!target) return;

                if (target.classList.contains('return-checkbox')) {
                    handlers.onCheckboxChange(target);
                }
            });

            dom.itemsBody.addEventListener('input', (event) => {
                const target = event.target;
                if (!target) return;

                if (target.classList.contains('return-qty-input')) {
                    handlers.onQtyInput(target);
                    return;
                }

                if (target.classList.contains('return-price-input')) {
                    handlers.onPriceInput(target);
                }
            });

            dom.itemsBody.addEventListener('keydown', (event) => {
                if (
                    event.key !== 'ArrowDown' &&
                    event.key !== 'ArrowUp' &&
                    event.key !== 'ArrowRight' &&
                    event.key !== 'ArrowLeft'
                ) return;

                const target = event.target;
                if (!target) return;

                const isGridField =
                    target.classList.contains('return-checkbox') ||
                    target.classList.contains('return-qty-input') ||
                    target.classList.contains('return-price-input');

                if (!isGridField) return;
                if (handlers.onItemsArrowNavigate) {
                    handlers.onItemsArrowNavigate(event);
                }
            });
        }

        if (root) {
            root.addEventListener('click', (event) => {
                const actionEl = event.target.closest('[data-action]');
                if (!actionEl) return;

                const action = actionEl.dataset.action;
                if (action === 'reset-form') {
                    handlers.onResetForm();
                    return;
                }

                if (action === 'save-return') {
                    handlers.onSaveReturn();
                    return;
                }

                if (action === 'load-prev-return') {
                    handlers.onLoadPrevReturn();
                    return;
                }

                if (action === 'load-next-return') {
                    handlers.onLoadNextReturn();
                    return;
                }

                if (action === 'history-prev') {
                    handlers.onHistoryPrev();
                    return;
                }

                if (action === 'history-next') {
                    handlers.onHistoryNext();
                    return;
                }

                if (action === 'delete-return') {
                    const returnId = Number.parseInt(actionEl.dataset.id, 10);
                    handlers.onDeleteReturn(returnId);
                }
            });
        }
    }

    window.salesReturnsPageEvents = {
        bindEvents
    };
})();
