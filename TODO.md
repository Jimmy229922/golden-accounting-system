# TODO: إضافة مودال PDF مجمع لتقارير العملاء ✅ تقدم 100%

## الخطة المعتمدة:
- [x] مودال بزرارين عند click أيقونة PDF: "كشف تفصيلي" | "فاتورة مجمعة"
- [x] زرار تفصيلي: savePDF الحالي جاهز
- [x] زرار مجمع: endpoint جديد + PDF مجمع (4 أعمدة: تاريخ | إجمالي الفاتورة | الدفعة | الرصيد)
- [x] PDF مجمع احترافي مع بيانات الشركة
- [x] ترجمات: "فاتورة مجمعة" معتمدة

## الخطوات التفصيلية:
1. [x] ✅ إصلاح خطأ template literal في customer-reports.render.js (unterminated at line 199) - HTML مودال مضاف
2. [x] ✅ إضافة HTML مودال + زر PDF في customer-reports.render.js
3. [x] ✅ إضافة CSS مودال في customer-reports.css (modal-overlay, pdf-modal, pdf-btns) - موجود مسبقاً
4. [x] ✅ تعديل bootstrap.js: showPdfModal() + handlers كاملة (موجودة مسبقاً)
5. [x] ✅ دالة saveSummaryPDF() → electronAPI.getCustomerSummaryStatement + getCustomerDetailedStatement + saveCustomerSummaryPdf
6. [x] ✅ Backend frontend-desktop/src/main/handlers/reports.js:
   - getCustomerSummaryStatement(customerId, dates) - يجمع الأصناف من كل الفواتير
   - saveCustomerSummaryPdf() - يحفظ PDF مع أرقام صفحات
7. [x] ✅ Backend: saveCustomerSummaryPdf() مع PDF احترافي - يعمل عبر printToPDF
8. [x] ✅ i18n/ar.json: إضافة الترجمات الجديدة (summaryInvoiceTitle, summaryCol*, summaryItems*, etc.)
9. [x] ✅ CSS: إضافة summary-print-view styles للطباعة

## التفاصيل التقنية للتنفيذ:

### saveSummaryPDF() (bootstrap.js):
- يجلب بيانات الفاتورة المجمعة من `getCustomerSummaryStatement` (أصناف مجمعة)
- يجلب بيانات الكشف التفصيلي من `getCustomerDetailedStatement` (حركات الحساب)
- يجلب إعدادات الشركة (اسم، عنوان، تليفون، لوجو)
- يبني HTML مؤقت يحتوي على:
  - هيدر احترافي (لوجو + اسم الشركة + بيانات العميل + الفترة)
  - جدول 4 أعمدة: التاريخ/نوع الحركة | مدين (له) | دائن (منه) | الرصيد
  - جداول أصناف مجمعة (مبيعات، مشتريات، مردودات) مع إجماليات
- يستبدل محتوى reportContainer مؤقتاً
- يستدعي `saveCustomerSummaryPdf` لحفظ PDF
- يستعيد المحتوى الأصلي

### الترجمات المضافة:
- summaryInvoiceTitle, summaryColDate, summaryColDebit, summaryColCredit, summaryColBalance
- summaryTotals, summaryItemsSales, summaryItemsPurchases, summaryItemsSalesReturns, summaryItemsPurchaseReturns
- summaryItemQty, summaryItemAvgPrice, summaryItemTotal
- salesReturnBadge, purchaseReturnBadge, totalPaymentsOut, totalSalesReturns, totalPurchaseReturns
- وغيرها من الترجمات المفقودة

### القنوات المضافة لـ public-channels.json:
- get-customer-summary-statement
- save-customer-summary-pdf

حالة: ✅ مكتمل بالكامل

التقدم: 100%
