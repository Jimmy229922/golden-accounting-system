# دليل الربط بين Frontend وBackend (من frontend-desktop فقط)

آخر تحديث: 2026-04-11 01:31:17

## الهدف
- مرجع كامل لعقد الربط الحالية بين Renderer وMain Process داخل frontend-desktop.
- يستخدم لتحديد كل التعديلات الواجب عكسها في backend عند أي تغيير في العقود أو منطق handlers أو schema.

## مسار الربط
1. Renderer يستدعي window.electronAPI.*
2. preload.js يربط method بالقناة Channel
3. handlers/*.js تستقبل القناة عبر ipcMain.handle/on
4. handler ينفذ منطق العمل/SQL ويرجع response

## وضع Local/Remote Backend
- USE_REMOTE_BACKEND=false: تنفيذ محلي عبر ipcRenderer.invoke
- USE_REMOTE_BACKEND=true: إرسال RPC إلى BACKEND_URL/api/rpc/{channel}
- BACKEND_RPC_TOKEN يمر عبر header x-api-token
- backendClient.js يستخدم /api/health

## إحصائيات العقد الحالية
- methods في preload: 95
- channels فريدة: 95
- invokeChannel: 91
- ipcRenderer.send: 3
- ipcRenderer.invoke: 1

## الملفات المرجعية الأساسية
- frontend-desktop/src/main/preload.js
- frontend-desktop/src/main/handlers/index.js
- frontend-desktop/src/main/handlers/*.js
- frontend-desktop/src/main/db.js
- frontend-desktop/src/renderer/**/*.js

## العقد الكاملة (Method -> Channel)
- method: addCustomer | transport: invokeChannel | channel: add-customer | params: customer | args: customer
- method: addItem | transport: invokeChannel | channel: add-item | params: item | args: item
- method: addOpeningBalance | transport: invokeChannel | channel: add-opening-balance | params: entry | args: entry
- method: addOpeningBalanceGroup | transport: invokeChannel | channel: add-opening-balance-group | params: data | args: data
- method: addSupplier | transport: invokeChannel | channel: add-supplier | params: supplier | args: supplier
- method: addTreasuryTransaction | transport: invokeChannel | channel: add-treasury-transaction | params: data | args: data
- method: addUnit | transport: invokeChannel | channel: add-unit | params: name | args: name
- method: addWarehouse | transport: invokeChannel | channel: add-warehouse | params: name | args: name
- method: backupDatabase | transport: invokeChannel | channel: backup-database | params: - | args: -
- method: checkBackendHealth | transport: invokeChannel | channel: backend-health-check | params: - | args: -
- method: checkInviteStatus | transport: invokeChannel | channel: get-invite-status | params: - | args: -
- method: createAuthUser | transport: invokeChannel | channel: create-auth-user | params: payload | args: payload
- method: deleteCustomer | transport: invokeChannel | channel: delete-customer | params: id | args: id
- method: deleteInvoice | transport: invokeChannel | channel: delete-invoice | params: id, type | args: { id, type }
- method: deleteItem | transport: invokeChannel | channel: delete-item | params: id | args: id
- method: deleteOpeningBalance | transport: invokeChannel | channel: delete-opening-balance | params: id | args: id
- method: deleteOpeningBalanceGroup | transport: invokeChannel | channel: delete-opening-balance-group | params: groupId | args: groupId
- method: deletePurchaseReturn | transport: invokeChannel | channel: delete-purchase-return | params: id | args: id
- method: deleteSalesReturn | transport: invokeChannel | channel: delete-sales-return | params: id | args: id
- method: deleteSupplier | transport: invokeChannel | channel: delete-supplier | params: id | args: id
- method: deleteTreasuryTransaction | transport: invokeChannel | channel: delete-treasury-transaction | params: id | args: id
- method: deleteUnit | transport: invokeChannel | channel: delete-unit | params: id | args: id
- method: deleteWarehouse | transport: invokeChannel | channel: delete-warehouse | params: id | args: id
- method: getActiveAuthUser | transport: invokeChannel | channel: get-active-auth-user | params: payload = {} | args: payload
- method: getAllReports | transport: invokeChannel | channel: get-all-reports | params: filters | args: filters
- method: getAuthSessionToken | transport: ipcRenderer.invoke | channel: get-auth-session-token | params: - | args: -
- method: getAuthStatus | transport: invokeChannel | channel: get-auth-status | params: - | args: -
- method: getAuthUsers | transport: invokeChannel | channel: get-auth-users | params: payload = {} | args: payload
- method: getCustomerDetailedStatement | transport: invokeChannel | channel: get-customer-detailed-statement | params: params | args: params
- method: getCustomerFullReport | transport: invokeChannel | channel: get-customer-full-report | params: customerId | args: customerId
- method: getCustomers | transport: invokeChannel | channel: get-customers | params: - | args: -
- method: getCustomerSalesInvoices | transport: invokeChannel | channel: get-customer-sales-invoices | params: customerId | args: customerId
- method: getDashboardStats | transport: invokeChannel | channel: get-dashboard-stats | params: - | args: -
- method: getDebtorCreditorReport | transport: invokeChannel | channel: get-debtor-creditor-report | params: filters | args: filters
- method: getGroupDetails | transport: invokeChannel | channel: get-group-details | params: groupId | args: groupId
- method: getInvoiceItemsForReturn | transport: invokeChannel | channel: get-invoice-items-for-return | params: invoiceId, type | args: { invoiceId, type }
- method: getInvoiceWithDetails | transport: invokeChannel | channel: get-invoice-with-details | params: id, type | args: { id, type }
- method: getItemMovements | transport: invokeChannel | channel: get-item-movements | params: id | args: id
- method: getItems | transport: invokeChannel | channel: get-items | params: - | args: -
- method: getItemStockDetails | transport: invokeChannel | channel: get-item-stock-details | params: id | args: id
- method: getItemTransactions | transport: invokeChannel | channel: get-item-transactions | params: itemId, startDate = null, endDate = null | args: { itemId, startDate, endDate }
- method: getMachineId | transport: invokeChannel | channel: get-machine-id | params: - | args: -
- method: getMyPermissions | transport: invokeChannel | channel: get-my-permissions | params: payload | args: payload
- method: getNextInvoiceNumber | transport: invokeChannel | channel: get-next-invoice-number | params: type | args: type
- method: getOpeningBalanceGroup | transport: invokeChannel | channel: get-opening-balance-group | params: id | args: id
- method: getOpeningBalanceGroups | transport: invokeChannel | channel: get-opening-balance-groups | params: - | args: -
- method: getOpeningBalances | transport: invokeChannel | channel: get-opening-balances | params: - | args: -
- method: getPurchaseInvoiceDetails | transport: invokeChannel | channel: get-purchase-invoice-details | params: invoiceId | args: invoiceId
- method: getPurchaseInvoices | transport: invokeChannel | channel: get-purchase-invoices | params: - | args: -
- method: getPurchaseReturnDetails | transport: invokeChannel | channel: get-purchase-return-details | params: returnId | args: returnId
- method: getPurchaseReturns | transport: invokeChannel | channel: get-purchase-returns | params: - | args: -
- method: getSalesInvoiceDetails | transport: invokeChannel | channel: get-sales-invoice-details | params: invoiceId | args: invoiceId
- method: getSalesInvoices | transport: invokeChannel | channel: get-sales-invoices | params: - | args: -
- method: getSalesReturnDetails | transport: invokeChannel | channel: get-sales-return-details | params: returnId | args: returnId
- method: getSalesReturns | transport: invokeChannel | channel: get-sales-returns | params: - | args: -
- method: getSettings | transport: invokeChannel | channel: get-settings | params: - | args: -
- method: getStatementItemDetails | transport: invokeChannel | channel: get-statement-item-details | params: params | args: params
- method: getSupplierPurchaseInvoices | transport: invokeChannel | channel: get-supplier-purchase-invoices | params: supplierId | args: supplierId
- method: getSuppliers | transport: invokeChannel | channel: get-suppliers | params: - | args: -
- method: getTreasuryBalance | transport: invokeChannel | channel: get-treasury-balance | params: - | args: -
- method: getTreasuryTransactions | transport: invokeChannel | channel: get-treasury-transactions | params: - | args: -
- method: getUnits | transport: invokeChannel | channel: get-units | params: - | args: -
- method: getUserPermissions | transport: invokeChannel | channel: get-user-permissions | params: payload | args: payload
- method: getWarehouses | transport: invokeChannel | channel: get-warehouses | params: - | args: -
- method: loginAuthAccount | transport: invokeChannel | channel: login-auth-account | params: payload | args: payload
- method: notifyAuthUnlocked | transport: ipcRenderer.send | channel: auth-unlocked | params: - | args: -
- method: notifyInviteUnlocked | transport: ipcRenderer.send | channel: invite-unlocked | params: - | args: -
- method: resetAuthUserPassword | transport: invokeChannel | channel: reset-auth-user-password | params: payload | args: payload
- method: restartApp | transport: invokeChannel | channel: restart-app | params: - | args: -
- method: restoreDatabase | transport: invokeChannel | channel: restore-database | params: - | args: -
- method: saveCustomerReportPdf | transport: invokeChannel | channel: save-customer-report-pdf | params: options | args: options
- method: saveDebtorCreditorPdf | transport: invokeChannel | channel: save-debtor-creditor-pdf | params: options | args: options
- method: saveOpeningBalances | transport: invokeChannel | channel: save-opening-balances | params: entries | args: { entries }
- method: savePurchaseInvoice | transport: invokeChannel | channel: save-purchase-invoice | params: data | args: data
- method: savePurchaseReturn | transport: invokeChannel | channel: save-purchase-return | params: data | args: data
- method: saveSalesInvoice | transport: invokeChannel | channel: save-sales-invoice | params: data | args: data
- method: saveSalesReturn | transport: invokeChannel | channel: save-sales-return | params: data | args: data
- method: saveSettings | transport: invokeChannel | channel: save-settings | params: settings | args: settings
- method: searchTreasuryByVoucher | transport: invokeChannel | channel: search-treasury-by-voucher | params: voucherNumber | args: voucherNumber
- method: setAuthSessionToken | transport: ipcRenderer.send | channel: auth-session-token | params: token | args: token
- method: setAuthUserActive | transport: invokeChannel | channel: set-auth-user-active | params: payload | args: payload
- method: setupAuthAccount | transport: invokeChannel | channel: setup-auth-account | params: payload | args: payload
- method: submitInviteCode | transport: invokeChannel | channel: submit-invite-code | params: code | args: code
- method: updateCustomer | transport: invokeChannel | channel: update-customer | params: customer | args: customer
- method: updateItem | transport: invokeChannel | channel: update-item | params: item | args: item
- method: updateOpeningBalance | transport: invokeChannel | channel: update-opening-balance | params: entry | args: entry
- method: updateOpeningBalanceGroup | transport: invokeChannel | channel: update-opening-balance-group | params: data | args: data
- method: updatePurchaseInvoice | transport: invokeChannel | channel: update-purchase-invoice | params: data | args: data
- method: updatePurchaseReturn | transport: invokeChannel | channel: update-purchase-return | params: data | args: data
- method: updateSalesInvoice | transport: invokeChannel | channel: update-sales-invoice | params: data | args: data
- method: updateSalesReturn | transport: invokeChannel | channel: update-sales-return | params: data | args: data
- method: updateTreasuryTransaction | transport: invokeChannel | channel: update-treasury-transaction | params: data | args: data
- method: updateUnit | transport: invokeChannel | channel: update-unit | params: unit | args: unit
- method: updateUserPermissions | transport: invokeChannel | channel: update-user-permissions | params: payload | args: payload
- method: updateWarehouse | transport: invokeChannel | channel: update-warehouse | params: data | args: data

## القنوات حسب ملف handler
### frontend-desktop\src\main\handlers\auth.js
- [handle] create-auth-user
- [handle] get-active-auth-user
- [handle] get-auth-status
- [handle] get-auth-users
- [handle] get-invite-status
- [handle] get-machine-id
- [handle] get-my-permissions
- [handle] get-user-permissions
- [handle] login-auth-account
- [handle] reset-auth-user-password
- [handle] set-auth-user-active
- [handle] setup-auth-account
- [handle] submit-invite-code
- [handle] update-user-permissions

### frontend-desktop\src\main\handlers\backup.js
- [handle] backup-database
- [handle] restart-app
- [handle] restore-database

### frontend-desktop\src\main\handlers\customers.js
- [handle] add-customer
- [handle] delete-customer
- [handle] get-customers
- [handle] get-debtor-creditor-report
- [handle] update-customer

### frontend-desktop\src\main\handlers\index.js
- [handle] backend-health-check

### frontend-desktop\src\main\handlers\invoices.js
- [handle] delete-invoice
- [handle] get-invoice-items-for-return
- [handle] get-invoice-with-details
- [handle] get-next-invoice-number
- [handle] get-purchase-invoice-details
- [handle] get-purchase-return-details
- [handle] get-sales-invoice-details
- [handle] get-sales-return-details

### frontend-desktop\src\main\handlers\items.js
- [handle] add-item
- [handle] delete-item
- [handle] get-item-movements
- [handle] get-items
- [handle] get-item-stock-details
- [handle] get-item-transactions
- [handle] update-item

### frontend-desktop\src\main\handlers\openingBalances.js
- [handle] add-opening-balance
- [handle] add-opening-balance-group
- [handle] delete-opening-balance
- [handle] delete-opening-balance-group
- [handle] get-group-details
- [handle] get-opening-balance-group
- [handle] get-opening-balance-groups
- [handle] get-opening-balances
- [handle] save-opening-balances
- [handle] update-opening-balance
- [handle] update-opening-balance-group

### frontend-desktop\src\main\handlers\purchaseReturns.js
- [handle] delete-purchase-return
- [handle] get-purchase-returns
- [handle] get-supplier-purchase-invoices
- [handle] save-purchase-return
- [handle] update-purchase-return

### frontend-desktop\src\main\handlers\purchases.js
- [handle] get-purchase-invoices
- [handle] save-purchase-invoice
- [handle] update-purchase-invoice

### frontend-desktop\src\main\handlers\reports.js
- [handle] get-all-reports
- [handle] get-customer-detailed-statement
- [handle] get-customer-full-report
- [handle] get-statement-item-details
- [handle] save-customer-report-pdf
- [handle] save-debtor-creditor-pdf

### frontend-desktop\src\main\handlers\sales.js
- [handle] get-sales-invoices
- [handle] save-sales-invoice
- [handle] update-sales-invoice

### frontend-desktop\src\main\handlers\salesReturns.js
- [handle] delete-sales-return
- [handle] get-customer-sales-invoices
- [handle] get-sales-returns
- [handle] save-sales-return
- [handle] update-sales-return

### frontend-desktop\src\main\handlers\settings.js
- [handle] get-dashboard-stats
- [handle] get-settings
- [handle] save-settings

### frontend-desktop\src\main\handlers\suppliers.js
- [handle] add-supplier
- [handle] delete-supplier
- [handle] get-suppliers

### frontend-desktop\src\main\handlers\treasury.js
- [handle] add-treasury-transaction
- [handle] delete-treasury-transaction
- [handle] get-treasury-balance
- [handle] get-treasury-transactions
- [handle] search-treasury-by-voucher
- [handle] update-treasury-transaction

### frontend-desktop\src\main\handlers\units.js
- [handle] add-unit
- [handle] delete-unit
- [handle] get-units
- [handle] update-unit

### frontend-desktop\src\main\handlers\warehouses.js
- [handle] add-warehouse
- [handle] delete-warehouse
- [handle] get-warehouses
- [handle] update-warehouse

## قنوات خارج handlers
- [on] auth-session-token -> frontend-desktop/src/main/main.js
- [handle] get-auth-session-token -> frontend-desktop/src/main/main.js
- [once] invite-unlocked -> frontend-desktop/src/main/windowManager.js
- [once] auth-unlocked -> frontend-desktop/src/main/windowManager.js

## قواعد مزامنة backend
1. أي تعديل في preload.js (method/channel/args) لازم يتكرر 1:1 في backend.
2. أي تعديل منطق في handlers لازم يتكرر في backend المكافئ.
3. أي تعديل schema/FK في db.js لازم يتكرر بنفس الصياغة والترتيب.
4. لا تغيّر اسم قناة بدون تحديث كل المستخدمين لها في renderer.
5. عند إضافة قناة جديدة: preload + handler + backend + اختبار.

## Checklist قبل أي Release
- [ ] كل methods المستخدمة في الواجهة موجودة في preload
- [ ] كل channels في preload لها handlers
- [ ] كل تغييرات db.js نُقلت للطرف الآخر
- [ ] اختبار: بيع/شراء/مرتجعات/خزنة/تقارير/صلاحيات


