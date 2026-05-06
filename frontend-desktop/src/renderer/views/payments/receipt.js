window.initializeTreasuryVoucherPage({
    pageId: 'receipt',
    navActive: 'receipt',
    i18nPrefix: 'receipt',
    transactionType: 'income',
    numberPrefix: 'RC',
    deferCustomerCollectionsToShiftClose: true,
    ids: {
        form: 'receiptForm',
        voucherInput: 'receiptNumber',
        entitySelect: 'customer',
        entityCard: 'customerInfoCard',
        balancePreview: 'receiptBalancePreview',
        todayStat: 'todayReceipts',
        countStat: 'totalDebtors',
        totalStat: 'totalDebts'
    },
    entity: {
        filterTypes: ['customer', 'both'],
        useStatementBalance: false,
        icon: 'fa-user',
        placeholderIcon: 'fa-user-circle',
        fieldShellClass: 'customer-field-shell',
        avatarClass: 'customer',
        newInvoicePath: '../../views/sales/index.html',
        newInvoiceIcon: 'fa-shopping-cart'
    },
    visuals: {
        titleClass: 'receipt',
        titleIcon: 'fa-hand-holding-usd',
        amountInputClass: 'receipt-amount-input',
        submitClass: 'receipt',
        transactionClass: 'income',
        transactionArrowIcon: 'fa-arrow-down',
        transactionAmountPrefix: '+'
    },
    statsCards: [
        {
            cardClass: 'success',
            icon: 'fa-money-bill-wave',
            valueId: 'todayReceipts',
            initialValue: '0.00',
            textName: 'todayStatLabel'
        },
        {
            cardClass: 'warning',
            icon: 'fa-users',
            valueId: 'totalDebtors',
            initialValue: '0',
            textName: 'countStatLabel'
        },
        {
            cardClass: 'info',
            icon: 'fa-coins',
            valueId: 'totalDebts',
            initialValue: '0.00',
            textName: 'totalStatLabel'
        }
    ],
    text: {
        pageTitle: { key: 'pageTitle', fallback: 'تحصيل نقدية من عميل' },
        pageSubtitle: {
            key: 'pageSubtitle',
            fallback: 'سجل عملية التحصيل بسرعة مع متابعة واضحة للرصيد قبل وبعد التحصيل.'
        },
        formTitle: { key: 'formTitle', fallback: 'بيانات سند التحصيل' },
        formSubtitle: {
            key: 'formSubtitle',
            fallback: 'املأ بيانات السند ثم راجع الرصيد قبل الحفظ.'
        },
        voucherInfo: { key: 'voucherInfo', fallback: 'معلومات السند' },
        dateLabel: { key: 'dateLabel', fallback: 'التاريخ' },
        numberLabel: { key: 'receiptNumberLabel', fallback: 'رقم الإيصال' },
        autoPlaceholder: { key: 'autoPlaceholder', fallback: 'تلقائي' },
        searchVoucher: { key: 'searchVoucher', fallback: 'بحث برقم السند' },
        detailsTitle: { key: 'collectionDetails', fallback: 'تفاصيل التحصيل' },
        entityLabel: { key: 'customerLabel', fallback: 'العميل' },
        searchPlaceholder: { key: 'searchPlaceholder', fallback: 'ابحث...' },
        amountLabel: { key: 'collectionAmount', fallback: 'مبلغ التحصيل' },
        fullBalanceBtn: { key: 'fullBalanceBtn', fallback: 'كامل الرصيد' },
        currentBalanceLabel: { key: 'currentBalanceLabel', fallback: 'الرصيد الحالي' },
        afterBalanceLabel: { key: 'afterCollectionLabel', fallback: 'بعد التحصيل' },
        descriptionLabel: { key: 'descriptionLabel', fallback: 'البيان / ملاحظات' },
        descriptionPlaceholder: {
            key: 'descriptionPlaceholder',
            fallback: 'مثال: دفعة على الحساب - سند قبض'
        },
        submitBtn: { key: 'submitBtn', fallback: 'حفظ عملية التحصيل' },
        selectEntityPrompt: { key: 'selectCustomerPrompt', fallback: 'اختر عميل لعرض بياناته' },
        quickNotes: { key: 'quickNotes', fallback: 'ملاحظات سريعة' },
        quickNote2: {
            key: 'quickNote2',
            fallback: 'استخدم زر <strong>كامل الرصيد</strong> لتعبئة المبلغ تلقائيا.'
        },
        quickNote3: { key: 'quickNote3', fallback: 'يمكن كتابة بيان واضح لتسهيل المراجعة لاحقا.' },
        recentTransactionsTitle: { key: 'recentTransactionsTitle', fallback: 'آخر عمليات التحصيل' },
        noRecentTransactions: { key: 'noRecentTransactions', fallback: 'لا توجد عمليات تحصيل حديثة' },
        todayStatLabel: { key: 'stats.todayReceipts', fallback: 'تحصيلات اليوم' },
        countStatLabel: { key: 'stats.debtorsCount', fallback: 'عملاء لينا (مدين) رصيد' },
        totalStatLabel: { key: 'stats.totalDebts', fallback: 'إجمالي الأرصدة المستحقة' },
        owedSuffix: { key: 'owedSuffix', fallback: '(لنا - مدين: {amount})' },
        toastLoadError: { key: 'toast.loadError', fallback: 'حدث خطأ في تحميل البيانات' },
        balanceHintDebit: { key: 'balanceHintDebit', fallback: 'لينا (مدين) رصيد مستحق التحصيل' },
        balanceHintCredit: { key: 'balanceHintCredit', fallback: 'علينا (دائن) رصيد مستحق السداد' },
        balanceHintZero: { key: 'balanceHintZero', fallback: 'لا يوجد رصيد' },
        entityType: { key: 'entityType', fallback: 'عميل' },
        accountStatement: { key: 'accountStatement', fallback: 'كشف حساب' },
        newInvoiceAction: { key: 'newInvoice', fallback: 'فاتورة جديدة' },
        balanceOwed: { key: 'balanceOwed', fallback: 'لينا (مدين)' },
        balanceCredit: { key: 'balanceCredit', fallback: 'علينا (دائن)' },
        balanceBalanced: { key: 'balanceBalanced', fallback: 'متزن' },
        unknownEntity: { key: 'unknownCustomer', fallback: 'عميل غير معروف' },
        defaultDescription: { key: 'defaultDescription', fallback: 'تحصيل نقدية' },
        fullBalanceDescription: { key: 'fullBalanceDescription', fallback: 'سداد كامل الرصيد' },
        toastSelectEntityWithBalance: {
            key: 'toast.selectCustomerWithBalance',
            fallback: 'اختر عميل لينا (مدين) رصيد مستحق التحصيل'
        },
        toastSaving: { key: 'toast.saving', fallback: 'جاري الحفظ...' },
        defaultDescriptionTemplate: {
            key: 'defaultDescriptionTemplate',
            fallback: 'تحصيل نقدية - إيصال رقم {number}'
        },
        toastFillRequired: { key: 'toast.fillRequired', fallback: 'يرجى ملء جميع الحقول المطلوبة' },
        toastSaveSuccess: { key: 'toast.saveSuccess', fallback: 'تم حفظ عملية التحصيل بنجاح' },
        toastSaveError: { key: 'toast.saveError', fallback: 'حدث خطأ: {error}' },
        toastUnexpectedError: { key: 'toast.unexpectedError', fallback: 'حدث خطأ غير متوقع' },
        voucherNumberLabel: { key: 'voucherNumberLabel', fallback: 'رقم السند' },
        searchResults: { key: 'searchResults', fallback: 'نتائج البحث' },
        noSearchResults: { key: 'noSearchResults', fallback: 'لا توجد نتائج' },
        toastVoucherNotFound: {
            key: 'toast.voucherNotFound',
            fallback: 'تعذر العثور على سند التحصيل المطلوب.'
        },
        toastLoadedFromReport: {
            key: 'toast.loadedFromReport',
            fallback: 'تم فتح سند التحصيل المطلوب.'
        }
    },
    quickNote1(tx) {
        return tx('quickNote1', 'الرصيد الموجب يعني: <strong>لينا (مدين)</strong> رصيد مستحق التحصيل.');
    }
});
