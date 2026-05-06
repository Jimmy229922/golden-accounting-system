# Frontend Organization Roadmap

This project is being refactored in incremental sections to keep changes safe and maintainable.

## Section 1: Shared Navigation Layer (Completed)

Goals:
- Move top navigation definition to one central source.
- Stop duplicating nav HTML in every page.
- Keep routing and active states consistent across all views.

Implemented:
- Added central navigation configuration:
  - `src/renderer/assets/config/navigation.json`
- Added shared navigation runtime:
  - `src/renderer/assets/js/shared/navManager.js`
- Wired nav manager into all renderer HTML pages.
- Simplified repeated nav markup in these pages:
  - `src/renderer/views/dashboard/dashboard.js`
  - `src/renderer/views/sales/sales.js`
  - `src/renderer/views/purchases/purchases.js`
  - `src/renderer/views/settings/settings.js`
  - `src/renderer/views/sales-returns/sales-returns.js`
  - `src/renderer/views/purchase-returns/purchase-returns.js`

## Section 2: Shared Translation Layer (In Progress)

Goals:
- Remove direct UI text from JS files and map to i18n keys.
- Keep all labels/messages in `assets/i18n` files.
- Add per-module i18n sections for Sales, Purchases, Inventory, Reports.

Implemented so far:
- Added `src/renderer/assets/i18n/ar.json` as centralized Arabic dictionary.
- Added `src/renderer/assets/js/i18n.js` helper loader/utilities.
- Migrated key pages to use dictionary lookups:
  - `src/renderer/views/sales-returns/sales-returns.js`
  - `src/renderer/views/purchase-returns/purchase-returns.js`
  - `src/renderer/views/settings/settings.js`
  - `src/renderer/views/dashboard/dashboard.js`
  - `src/renderer/views/sales/sales.js`
  - `src/renderer/views/purchases/purchases.js`
- Connected global nav search label/placeholder/hint to i18n keys.

## Section 3: Feature Folder Cleanup (Next)

Goals:
- Standardize each view folder to: `index.html`, `page.js`, optional `page.css`.
- Move inline page styles into dedicated CSS files where needed.
- Keep reusable logic in `assets/js/shared`.

## Section 4: Quality Gates (Next)

Goals:
- Add lint + format scripts for renderer files.
- Add quick smoke checks for critical routes.
- Enforce no duplicate nav/templates in page scripts.
