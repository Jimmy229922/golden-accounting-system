(function () {
    function createTreasuryPageRenderer({ config, t, tx, text }) {
        function buildTopNavHTML() {
            if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
                return window.navManager.getTopNavHTML(t);
            }
            return '';
        }

        function renderStatsCards() {
            return config.statsCards
                .map(
                    (card) => `
                        <div class="stat-card ${card.cardClass}">
                            <i class="fas ${card.icon}"></i>
                            <div class="stat-value" id="${card.valueId}">${card.initialValue}</div>
                            <div class="stat-label">${text(card.textName)}</div>
                        </div>
                    `
                )
                .join('');
        }

        function renderPage() {
            const app = document.getElementById('app');
            app.innerHTML = `
                ${buildTopNavHTML()}

                <div class="content">
                    <div class="page-header receipt-header">
                        <div>
                            <h1 class="page-title ${config.visuals.titleClass}">
                                <i class="fas ${config.visuals.titleIcon}"></i>
                                ${text('pageTitle')}
                            </h1>
                            <p class="page-subtitle">${text('pageSubtitle')}</p>
                        </div>
                    </div>

                    <div class="stats-row">
                        ${renderStatsCards()}
                    </div>

                    <form id="${config.ids.form}" class="receipt-form">
                        <div class="receipt-layout">
                            <div class="form-card receipt-form-card">
                                <div class="card-header">
                                    <i class="fas fa-file-invoice-dollar"></i>
                                    <div>
                                        <h2>${text('formTitle')}</h2>
                                        <p class="card-subtitle">${text('formSubtitle')}</p>
                                    </div>
                                </div>

                                <div class="receipt-form-layout">
                                    <div class="voucher-panel voucher-details-panel">
                                        <div class="voucher-panel-head">
                                            <i class="fas fa-user-check"></i>
                                            <span>${text('detailsTitle')}</span>
                                        </div>
                                        <div class="details-grid">
                                            <div class="form-group">
                                                <label><i class="fas ${config.entity.icon}"></i> ${text('entityLabel')}</label>
                                                <div class="input-with-icon ${config.entity.fieldShellClass}">
                                                    <select id="${config.ids.entitySelect}" class="form-control" required>
                                                        <option value="">${text('searchPlaceholder')}</option>
                                                    </select>
                                                    <i class="fas ${config.entity.icon}"></i>
                                                </div>
                                            </div>

                                            <div class="form-group amount-block">
                                                <label><i class="fas fa-money-bill"></i> ${text('amountLabel')}</label>
                                                <div class="input-with-icon amount-field-shell">
                                                    <input type="number" id="amount" class="form-control amount-input ${config.visuals.amountInputClass}" step="0.01" min="0.01" placeholder="0.00" inputmode="decimal" required>
                                                    <i class="fas fa-pound-sign"></i>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="quick-actions receipt-quick-actions">
                                            <button type="button" class="quick-btn" data-action="quick-amount" data-amount="100"><i class="fas fa-plus"></i> 100</button>
                                            <button type="button" class="quick-btn" data-action="quick-amount" data-amount="500"><i class="fas fa-plus"></i> 500</button>
                                            <button type="button" class="quick-btn" data-action="quick-amount" data-amount="1000"><i class="fas fa-plus"></i> 1000</button>
                                            <button type="button" class="quick-btn" data-action="pay-full-balance"><i class="fas fa-check-double"></i> ${text('fullBalanceBtn')}</button>
                                        </div>

                                        <div class="receipt-balance-preview" id="${config.ids.balancePreview}">
                                            <div class="preview-item">
                                                <span class="preview-label">${text('currentBalanceLabel')}</span>
                                                <strong class="preview-value" id="previewCurrentBalance">-</strong>
                                            </div>
                                            <div class="preview-divider"></div>
                                            <div class="preview-item">
                                                <span class="preview-label">${text('afterBalanceLabel')}</span>
                                                <strong class="preview-value" id="previewAfterBalance">-</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label><i class="fas fa-sticky-note"></i> ${text('descriptionLabel')}</label>
                                    <textarea id="description" class="form-control" rows="3" placeholder="${text('descriptionPlaceholder')}"></textarea>
                                </div>

                                <button type="submit" class="btn-submit ${config.visuals.submitClass}" id="submitBtn">
                                    <i class="fas fa-save"></i>
                                    ${text('submitBtn')}
                                </button>
                            </div>

                            <div class="receipt-side-stack">
                                <div class="voucher-panel voucher-meta-panel">
                                    <div class="voucher-panel-head">
                                        <i class="fas fa-receipt"></i>
                                        <span>${text('voucherInfo')}</span>
                                    </div>
                                    <div class="compact-meta-grid">
                                        <div class="form-group compact-field">
                                            <label><i class="fas fa-calendar"></i> ${text('dateLabel')}</label>
                                            <input type="date" id="date" class="form-control" required>
                                        </div>
                                        <div class="form-group compact-field">
                                            <label><i class="fas fa-receipt"></i> ${text('numberLabel')}</label>
                                            <div class="voucher-search-wrapper">
                                                <input type="text" id="${config.ids.voucherInput}" class="form-control" list="voucherSuggestions" placeholder="${text('autoPlaceholder')}" autocomplete="off">
                                                <datalist id="voucherSuggestions"></datalist>
                                                <button type="button" class="btn-voucher-search" id="voucherSearchBtn" title="${text('searchVoucher')}">
                                                    <i class="fas fa-search"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div id="voucherSearchResult" class="voucher-search-result" style="display:none;"></div>
                                </div>

                                <div class="info-card receipt-info-card" id="${config.ids.entityCard}">
                                    <div class="placeholder-card">
                                        <i class="fas ${config.entity.placeholderIcon}"></i>
                                        <p>${text('selectEntityPrompt')}</p>
                                    </div>
                                </div>

                                <div class="info-card receipt-help-card">
                                    <h3><i class="fas fa-lightbulb"></i> ${text('quickNotes')}</h3>
                                    <ul>
                                        <li>${config.quickNote1(tx)}</li>
                                        <li>${text('quickNote2')}</li>
                                        <li>${text('quickNote3')}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </form>

                    <div class="recent-section">
                        <div class="section-header">
                            <i class="fas fa-history"></i>
                            <h3>${text('recentTransactionsTitle')}</h3>
                        </div>
                        <div class="transactions-list" id="recentTransactions">
                            <div class="no-transactions">
                                <i class="fas fa-inbox"></i>
                                <p>${text('noRecentTransactions')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function renderEntityInfo(entity) {
            const card = document.getElementById(config.ids.entityCard);
            const balanceClass = entity.balance > 0 ? 'positive' : entity.balance < 0 ? 'negative' : 'zero';
            const balanceHint =
                entity.balance > 0
                    ? text('balanceHintDebit')
                    : entity.balance < 0
                      ? text('balanceHintCredit')
                      : text('balanceHintZero');

            card.innerHTML = `
                <div class="entity-name">${entity.name}</div>
                <div class="entity-type">${text('entityType')}</div>
                <div class="entity-avatar ${config.entity.avatarClass}">
                    <i class="fas ${config.entity.icon}"></i>
                </div>
                ${
                    entity.phone || entity.address
                        ? `
                    <div class="entity-contact">
                        ${entity.phone ? `<span><i class="fas fa-phone"></i> ${entity.phone}</span>` : ''}
                        ${entity.address ? `<span><i class="fas fa-map-marker-alt"></i> ${entity.address}</span>` : ''}
                    </div>
                `
                        : ''
                }
                <div class="balance-display">
                    <div class="balance-label">${text('currentBalanceLabel')}</div>
                    <div class="balance-amount ${balanceClass}">${Math.abs(entity.balance).toFixed(2)} \u062C.\u0645</div>
                    <div class="balance-hint">${balanceHint}</div>
                </div>
                <div class="entity-actions">
                    <a href="../../views/customer-reports/index.html?customerId=${entity.id}" class="btn-action primary">
                        <i class="fas fa-file-alt"></i>
                        ${text('accountStatement')}
                    </a>
                    <a href="${config.entity.newInvoicePath}" class="btn-action secondary">
                        <i class="fas ${config.entity.newInvoiceIcon}"></i>
                        ${text('newInvoiceAction')}
                    </a>
                </div>
            `;
        }

        function renderEntityPlaceholder() {
            const card = document.getElementById(config.ids.entityCard);
            card.innerHTML = `
                <div class="placeholder-card">
                    <i class="fas ${config.entity.placeholderIcon}"></i>
                    <p>${text('selectEntityPrompt')}</p>
                </div>
            `;
        }

        function renderRecentTransactions({ recentTransactions, allEntities }) {
            const container = document.getElementById('recentTransactions');

            if (recentTransactions.length === 0) {
                container.innerHTML = `
                    <div class="no-transactions">
                        <i class="fas fa-inbox"></i>
                        <p>${text('noRecentTransactions')}</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = recentTransactions
                .map((tr) => {
                    const entity = allEntities.find((item) => item.id == tr.customer_id);
                    return `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div class="transaction-icon ${config.visuals.transactionClass}">
                                    <i class="fas ${config.visuals.transactionArrowIcon}"></i>
                                </div>
                                <div class="transaction-details">
                                    <h4>${entity?.name || text('unknownEntity')}</h4>
                                    <span>${tr.transaction_date} - ${tr.description || text('defaultDescription')}</span>
                                </div>
                            </div>
                            <div class="transaction-amount ${config.visuals.transactionClass}">${config.visuals.transactionAmountPrefix}${tr.amount.toFixed(2)}</div>
                        </div>
                    `;
                })
                .join('');
        }

        function renderVoucherSearchResults(results) {
            return `
                <div class="voucher-result-header">
                    <i class="fas fa-file-alt"></i>
                    <span>${text('searchResults')} (${results.length})</span>
                    <button type="button" class="btn-close-search" data-action="close-voucher-search">&times;</button>
                </div>
                ${results
                    .map(
                        (tr) => {
                            const voucherNumberCell = window.renderDocNumberCell
                                ? window.renderDocNumberCell(tr.voucher_number, { numberTag: 'strong' })
                                : `<strong>${tr.voucher_number || '\u2014'}</strong>`;
                            return `
                    <div class="voucher-result-item">
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${text('voucherNumberLabel')}:</span>
                            ${voucherNumberCell}
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${text('dateLabel')}:</span>
                            <span>${tr.transaction_date}</span>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${text('entityLabel')}:</span>
                            <span>${tr.customer_name || '\u2014'}</span>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${text('amountLabel')}:</span>
                            <strong>${tr.amount.toFixed(2)} \u062C.\u0645</strong>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${text('descriptionLabel')}:</span>
                            <span>${tr.description || '\u2014'}</span>
                        </div>
                    </div>
                `;
                        }
                    )
                    .join('')}
            `;
        }

        function renderVoucherNoResults() {
            return `
                <div class="voucher-result-header">
                    <i class="fas fa-search"></i>
                    <span>${text('noSearchResults')}</span>
                    <button type="button" class="btn-close-search" data-action="close-voucher-search">&times;</button>
                </div>
            `;
        }

        return {
            renderPage,
            renderEntityInfo,
            renderEntityPlaceholder,
            renderRecentTransactions,
            renderVoucherSearchResults,
            renderVoucherNoResults
        };
    }

    window.createTreasuryPageRenderer = createTreasuryPageRenderer;
})();
