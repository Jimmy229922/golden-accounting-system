# Field System Rollout Plan

## Goal
Build a single, reusable field system for all pages with unified:
- shape and spacing
- light/dark colors
- behavior (focus, error, disabled, readonly)
- control sizes (lg and sm)
- select and autocomplete presentation

This document tracks the rollout sequence page by page.

## Core Prepared (Rollout Started)
The reusable base is now prepared and ready for phased rollout:
- `frontend-desktop/src/renderer/assets/styles/field-system.css`
- `frontend-desktop/src/renderer/assets/js/fieldSystem.js`

Main decisions in the base system:
1. Two field sizes only: `lg` and `sm`.
2. Shared state model: `focused`, `error`, `disabled`, `readonly`.
3. Unified control class: `fs-control`.
4. Unified host class: `fs-host`.
5. Unified autocomplete styles via `fs-autocomplete-*` classes.
6. No business logic changes.

Current rollout status:
- Phase 1 / Sales: started and applied on first pass.
- Phase 1 / Purchases: started and applied on first pass.
- Phase 1 / Sales Returns: started and applied on first pass.
- Updated files:
	- `frontend-desktop/src/renderer/views/sales/index.html`
	- `frontend-desktop/src/renderer/views/sales/sales.bootstrap.js`
	- `frontend-desktop/src/renderer/views/sales/sales.render.js`
	- `frontend-desktop/src/renderer/views/sales/sales.css`
	- `frontend-desktop/src/renderer/views/purchases/index.html`
	- `frontend-desktop/src/renderer/views/purchases/purchases.js`
	- `frontend-desktop/src/renderer/views/purchases/purchases.render.js`
	- `frontend-desktop/src/renderer/views/purchases/purchases.css`
	- `frontend-desktop/src/renderer/views/sales-returns/index.html`
	- `frontend-desktop/src/renderer/views/sales-returns/sales-returns.bootstrap.js`
	- `frontend-desktop/src/renderer/views/sales-returns/sales-returns.render.js`
	- `frontend-desktop/src/renderer/views/sales-returns/sales-returns.css`

## Rollout Strategy
1. Start with highest-traffic forms.
2. Migrate each page in isolation.
3. Validate light and dark theme after each page.
4. Remove duplicate page-local field styles only after page migration is stable.

## Page-by-Page Rollout Map

### Phase 1 - Core Transaction Pages
1. Sales
- Status: completed (first migration pass).
- `frontend-desktop/src/renderer/views/sales/sales.render.js`
- `frontend-desktop/src/renderer/views/sales/sales.bootstrap.js`
- `frontend-desktop/src/renderer/views/sales/sales.css`
- Focus fields: invoice number/date, customer select/autocomplete, line item fields, discount/paid, shift-close fields.

2. Purchases
- Status: completed (first migration pass).
- `frontend-desktop/src/renderer/views/purchases/purchases.render.js`
- `frontend-desktop/src/renderer/views/purchases/purchases.js`
- `frontend-desktop/src/renderer/views/purchases/purchases.css`
- Focus fields: supplier select/autocomplete, invoice fields, line item fields, discount/paid.

3. Sales Returns
- Status: completed (first migration pass).
- `frontend-desktop/src/renderer/views/sales-returns/sales-returns.render.js`
- `frontend-desktop/src/renderer/views/sales-returns/sales-returns.bootstrap.js`
- `frontend-desktop/src/renderer/views/sales-returns/sales-returns.css`
- Focus fields: customer and invoice selectors, return line controls.

4. Purchase Returns
- `frontend-desktop/src/renderer/views/purchase-returns/purchase-returns.render.js`
- `frontend-desktop/src/renderer/views/purchase-returns/purchase-returns.bootstrap.js`
- `frontend-desktop/src/renderer/views/purchase-returns/purchase-returns.css`
- Focus fields: supplier and invoice selectors, return line controls.

### Phase 2 - Financial and Stock Operations
5. Finance
- `frontend-desktop/src/renderer/views/finance/finance.js`
- `frontend-desktop/src/renderer/views/finance/finance.css`
- Focus fields: transaction type, amount, date, description, edit modal controls.

6. Payments (Receipt/Payment)
- `frontend-desktop/src/renderer/views/payments/treasury-page.renderer.js`
- `frontend-desktop/src/renderer/views/payments/treasury-page.shared.js`
- `frontend-desktop/src/renderer/views/payments/payments.css`
- Focus fields: voucher search, customer/supplier autocomplete, amount/date/notes.

7. Inventory
- `frontend-desktop/src/renderer/views/inventory/inventory.js`
- `frontend-desktop/src/renderer/views/inventory/inventory.css`
- Focus fields: filters, damaged stock modal controls.

8. Opening Balance
- `frontend-desktop/src/renderer/views/opening-balance/index.html`
- `frontend-desktop/src/renderer/views/opening-balance/opening-balance.bootstrap.js`
- `frontend-desktop/src/renderer/views/opening-balance/opening-balance.css`
- Focus fields: warehouse/item selectors and opening quantity/price controls.

9. Items and Units
- `frontend-desktop/src/renderer/views/items/items.html`
- `frontend-desktop/src/renderer/views/items/items.js`
- `frontend-desktop/src/renderer/views/items/items.crud.js`
- `frontend-desktop/src/renderer/views/items/items.css`
- `frontend-desktop/src/renderer/views/items/units.html`
- `frontend-desktop/src/renderer/views/items/units.js`
- `frontend-desktop/src/renderer/views/items/units.css`
- Focus fields: item forms, unit forms, modal edit controls, autocomplete unit selection.

### Phase 3 - Reports and Supporting Forms
10. Reports
- `frontend-desktop/src/renderer/views/reports/reports.render.js`
- `frontend-desktop/src/renderer/views/reports/reports.bootstrap.js`
- `frontend-desktop/src/renderer/views/reports/reports.css`
- `frontend-desktop/src/renderer/views/reports/debtor-creditor/debtor-creditor.js`
- `frontend-desktop/src/renderer/views/reports/debtor-creditor/debtor-creditor.css`
- Focus fields: report filters and customer selectors.

11. Customer Reports
- `frontend-desktop/src/renderer/views/customer-reports/customer-reports.render.js`
- `frontend-desktop/src/renderer/views/customer-reports/customer-reports.bootstrap.js`
- `frontend-desktop/src/renderer/views/customer-reports/customer-reports.css`
- Focus fields: customer filter, date range and transaction filter controls.

12. Customers
- `frontend-desktop/src/renderer/views/customers/index.html`
- `frontend-desktop/src/renderer/views/customers/customers.js`
- `frontend-desktop/src/renderer/views/customers/customers.css`
- Focus fields: customer profile modal and filter fields.

13. Settings
- `frontend-desktop/src/renderer/views/settings/settings.js`
- `frontend-desktop/src/renderer/views/settings/settings.css`
- Focus fields: organization info fields, invoice notes, backup/restore form controls.

14. Auth Users
- `frontend-desktop/src/renderer/views/auth-users/auth-users.render.js`
- `frontend-desktop/src/renderer/views/auth-users/auth-users.bootstrap.js`
- `frontend-desktop/src/renderer/views/auth-users/auth-users.css`
- Focus fields: create user and reset password fields.

### Phase 4 - Gate Pages
15. Auth
- `frontend-desktop/src/renderer/views/auth/index.html`
- `frontend-desktop/src/renderer/views/auth/auth.ui.js`
- `frontend-desktop/src/renderer/views/auth/auth.css`
- Focus fields: username/password setup and login fields.

16. Invite
- `frontend-desktop/src/renderer/views/invite/index.html`
- `frontend-desktop/src/renderer/views/invite/invite.js`
- `frontend-desktop/src/renderer/views/invite/invite.css`
- Focus fields: invite code entry and machine id controls.

## Validation Checklist Per Page
1. Field size mapping is correct (`lg` vs `sm`).
2. Focus ring is consistent in light and dark.
3. Error state rendering and message placement are consistent.
4. Disabled and readonly states are visually distinct and accessible.
5. Select and autocomplete controls follow the same visual language.
6. No business logic behavior changed.

## Next Step
Move to Phase 1 - Purchase Returns page next, then continue in sequence.
