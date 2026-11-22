window.initializeTreasuryVoucherPage({
    pageId: 'payment',
    navActive: 'payment',
    i18nPrefix: 'payment',
    transactionType: 'expense',
    numberPrefix: 'PY',
    ids: {
        form: 'paymentForm',
        voucherInput: 'paymentNumber',
        entitySelect: 'supplier',
        entityCard: 'supplierInfoCard',
        balancePreview: 'paymentBalancePreview',
        todayStat: 'todayPayments',
        countStat: 'totalCreditors',
        totalStat: 'totalCredits'
    },
    entity: {
        filterTypes: ['supplier', 'both'],
        useStatementBalance: true,
        invertStatementBalance: true,
        icon: 'fa-truck',
        placeholderIcon: 'fa-truck',
        fieldShellClass: 'supplier-field-shell',
        avatarClass: 'supplier',
        newInvoicePath: '../../views/purchases/index.html',
        newInvoiceIcon: 'fa-shopping-basket'
    },
    visuals: {
        titleClass: 'payment',
        titleIcon: 'fa-hand-holding-dollar',
        amountInputClass: 'payment-amount-input',
        submitClass: 'payment',
        transactionClass: 'expense',
        transactionArrowIcon: 'fa-arrow-up',
        transactionAmountPrefix: '-'
    },
    statsCards: [
        {
            cardClass: 'warning',
            icon: 'fa-money-bill-transfer',
            valueId: 'todayPayments',
            initialValue: '0.00',
            textName: 'todayStatLabel'
        },
        {
            cardClass: 'info',
            icon: 'fa-truck',
            valueId: 'totalCreditors',
            initialValue: '0',
            textName: 'countStatLabel'
        },
        {
            cardClass: 'success',
            icon: 'fa-coins',
            valueId: 'totalCredits',
            initialValue: '0.00',
            textName: 'totalStatLabel'
        }
    ],
    text: {
        pageTitle: { key: 'pageTitle', fallback: 'سداد نقدية لمورد' },
        pageSubtitle: {
            key: 'pageSubtitle',
            fallback: 'سجل عملية السداد بسرعة مع متابعة واضحة للرصيد قبل وبعد السداد.'
        },
        formTitle: { key: 'formTitle', fallback: 'بيانات سند السداد' },
        formSubtitle: {
            key: 'formSubtitle',
            fallback: 'املأ بيانات السند ثم راجع الرصيد قبل الحفظ.'
        },
        voucherInfo: { key: 'voucherInfo', fallback: 'معلومات السند' },
        dateLabel: { key: 'dateLabel', fallback: 'التاريخ' },
        numberLabel: { key: 'paymentNumberLabel', fallback: 'رقم السند' },
        autoPlaceholder: { key: 'autoPlaceholder', fallback: 'تلقائي' },
        searchVoucher: { key: 'searchVoucher', fallback: 'بحث برقم السند' },
        detailsTitle: { key: 'paymentDetails', fallback: 'تفاصيل السداد' },
        entityLabel: { key: 'supplierLabel', fallback: 'المورد' },
        searchPlaceholder: { key: 'searchPlaceholder', fallback: 'ابحث...' },
        amountLabel: { key: 'paymentAmount', fallback: 'مبلغ السداد' },
        fullBalanceBtn: { key: 'fullBalanceBtn', fallback: 'كامل الرصيد' },
        currentBalanceLabel: { key: 'currentBalanceLabel', fallback: 'الرصيد الحالي' },
        afterBalanceLabel: { key: 'afterPaymentLabel', fallback: 'بعد السداد' },
        descriptionLabel: { key: 'descriptionLabel', fallback: 'البيان / ملاحظات' },
        descriptionPlaceholder: {
            key: 'descriptionPlaceholder',
            fallback: 'مثال: دفعة على الحساب - سند صرف'
        },
        submitBtn: { key: 'submitBtn', fallback: 'حفظ عملية السداد' },
        selectEntityPrompt: { key: 'selectSupplierPrompt', fallback: 'اختر مورد لعرض بياناته' },
        quickNotes: { key: 'quickNotes', fallback: 'ملاحظات سريعة' },
        quickNote2: {
            key: 'quickNote2',
            fallback: 'استخدم زر <strong>كامل الرصيد</strong> لتعبئة المبلغ تلقائيا.'
        },
        quickNote3: { key: 'quickNote3', fallback: 'يمكن كتابة بيان واضح لتسهيل المراجعة لاحقا.' },
        recentTransactionsTitle: { key: 'recentTransactionsTitle', fallback: 'آخر عمليات السداد' },
        noRecentTransactions: { key: 'noRecentTransactions', fallback: 'لا توجد عمليات سداد حديثة' },
        todayStatLabel: { key: 'stats.todayPayments', fallback: 'مدفوعات اليوم' },
        countStatLabel: { key: 'stats.creditorsCount', fallback: 'موردين علينا (دائن) رصيد' },
        totalStatLabel: { key: 'stats.totalCredits', fallback: 'إجمالي الأرصدة المستحقة' },
        owedSuffix: { key: 'owedSuffix', fallback: '(علينا - دائن: {amount})' },
        toastLoadError: { key: 'toast.loadError', fallback: 'حدث خطأ في تحميل البيانات' },
        balanceHintDebit: { key: 'balanceHintDebit', fallback: 'علينا (دائن) رصيد مستحق السداد' },
        balanceHintCredit: { key: 'balanceHintCredit', fallback: 'لينا (مدين) رصيد مستحق التحصيل' },
        balanceHintZero: { key: 'balanceHintZero', fallback: 'لا يوجد رصيد' },
        entityType: { key: 'entityType', fallback: 'مورد' },
        accountStatement: { key: 'accountStatement', fallback: 'كشف حساب' },
        newInvoiceAction: { key: 'newPurchaseInvoice', fallback: 'فاتورة شراء' },
        balanceOwed: { key: 'balanceOwed', fallback: 'علينا (دائن)' },
        balanceCredit: { key: 'balanceCredit', fallback: 'لينا (مدين)' },
        balanceBalanced: { key: 'balanceBalanced', fallback: 'متزن' },
        unknownEntity: { key: 'unknownSupplier', fallback: 'مورد غير معروف' },
        defaultDescription: { key: 'defaultDescription', fallback: 'سداد نقدية' },
        fullBalanceDescription: { key: 'fullBalanceDescription', fallback: 'سداد كامل المستحق' },
        toastSelectEntityWithBalance: {
            key: 'toast.selectSupplierWithBalance',
            fallback: 'اختر مورد علينا (دائن) رصيد مستحق السداد'
        },
        toastSaving: { key: 'toast.saving', fallback: 'جاري الحفظ...' },
        defaultDescriptionTemplate: {
            key: 'defaultDescriptionTemplate',
            fallback: 'سداد نقدية - سند رقم {number}'
        },
        toastFillRequired: { key: 'toast.fillRequired', fallback: 'يرجى ملء جميع الحقول المطلوبة' },
        toastSaveSuccess: { key: 'toast.saveSuccess', fallback: 'تم حفظ عملية السداد بنجاح' },
        toastSaveError: { key: 'toast.saveError', fallback: 'حدث خطأ: {error}' },
        toastUnexpectedError: { key: 'toast.unexpectedError', fallback: 'حدث خطأ غير متوقع' },
        voucherNumberLabel: { key: 'voucherNumberLabel', fallback: 'رقم السند' },
        searchResults: { key: 'searchResults', fallback: 'نتائج البحث' },
        noSearchResults: { key: 'noSearchResults', fallback: 'لا توجد نتائج' },
        toastVoucherNotFound: {
            key: 'toast.voucherNotFound',
            fallback: 'تعذر العثور على سند السداد المطلوب.'
        },
        toastLoadedFromReport: {
            key: 'toast.loadedFromReport',
            fallback: 'تم فتح سند السداد المطلوب.'
        }
    },
    quickNote1(tx) {
        return `${tx('quickNote1Prefix', 'الرصيد الموجب يعني:')} <strong>${tx('quickNote1Bold', 'علينا (دائن)')}</strong> ${tx('quickNote1Suffix', 'رصيد مستحق السداد.')}`;
    }
});
