package com.goldenwolfeg.accountingmobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.goldenwolfeg.accountingmobile.data.model.AdminAuditLogDto
import com.goldenwolfeg.accountingmobile.data.model.AdminBackupFileDto
import com.goldenwolfeg.accountingmobile.data.model.AdminClientDto
import com.goldenwolfeg.accountingmobile.data.model.AdminErrorLogDto
import com.goldenwolfeg.accountingmobile.data.model.AdminGlobalConfigDto
import com.goldenwolfeg.accountingmobile.data.model.AdminStatsDto
import com.goldenwolfeg.accountingmobile.data.model.AdminSupportTicketDto
import com.goldenwolfeg.accountingmobile.data.repository.AccountingRepository
import com.goldenwolfeg.accountingmobile.data.repository.AdminPanelRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class AdminStatusFilter(val key: String, val label: String) {
    ALL("all", "الكل"),
    ACTIVE("active", "نشط"),
    TRIAL("trial", "تجريبي"),
    LIFETIME("lifetime", "دائم"),
    SUSPENDED("suspended", "موقوف"),
    EXPIRED("expired", "منتهي")
}

class AdminPanelViewModel(
    private val adminRepository: AdminPanelRepository,
    private val accountingRepository: AccountingRepository
) : ViewModel() {

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isActionLoading = MutableStateFlow(false)
    val isActionLoading: StateFlow<Boolean> = _isActionLoading.asStateFlow()

    private val _adminEmail = MutableStateFlow("")
    val adminEmail: StateFlow<String> = _adminEmail.asStateFlow()

    private val _stats = MutableStateFlow(AdminStatsDto())
    val stats: StateFlow<AdminStatsDto> = _stats.asStateFlow()

    private val _globalConfig = MutableStateFlow(AdminGlobalConfigDto())
    val globalConfig: StateFlow<AdminGlobalConfigDto> = _globalConfig.asStateFlow()

    private val _clients = MutableStateFlow<List<AdminClientDto>>(emptyList())

    private val _errorLogs = MutableStateFlow<List<AdminErrorLogDto>>(emptyList())
    val errorLogs: StateFlow<List<AdminErrorLogDto>> = _errorLogs.asStateFlow()

    private val _errorsPage = MutableStateFlow(1)
    val errorsPage: StateFlow<Int> = _errorsPage.asStateFlow()

    private val _errorsTotalPages = MutableStateFlow(1)
    val errorsTotalPages: StateFlow<Int> = _errorsTotalPages.asStateFlow()

    private val _auditLogs = MutableStateFlow<List<AdminAuditLogDto>>(emptyList())
    val auditLogs: StateFlow<List<AdminAuditLogDto>> = _auditLogs.asStateFlow()

    private val _auditPage = MutableStateFlow(1)
    val auditPage: StateFlow<Int> = _auditPage.asStateFlow()

    private val _auditTotalPages = MutableStateFlow(1)
    val auditTotalPages: StateFlow<Int> = _auditTotalPages.asStateFlow()

    private val _supportTickets = MutableStateFlow<List<AdminSupportTicketDto>>(emptyList())
    val supportTickets: StateFlow<List<AdminSupportTicketDto>> = _supportTickets.asStateFlow()

    private val _ticketsPage = MutableStateFlow(1)
    val ticketsPage: StateFlow<Int> = _ticketsPage.asStateFlow()

    private val _ticketsTotalPages = MutableStateFlow(1)
    val ticketsTotalPages: StateFlow<Int> = _ticketsTotalPages.asStateFlow()

    private val _clientBackups = MutableStateFlow<List<AdminBackupFileDto>>(emptyList())
    val clientBackups: StateFlow<List<AdminBackupFileDto>> = _clientBackups.asStateFlow()

    private val _detectedChatId = MutableStateFlow<String?>(null)
    val detectedChatId: StateFlow<String?> = _detectedChatId.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _statusFilter = MutableStateFlow(AdminStatusFilter.ALL)
    val statusFilter: StateFlow<AdminStatusFilter> = _statusFilter.asStateFlow()

    private val _selectedTab = MutableStateFlow(0)
    val selectedTab: StateFlow<Int> = _selectedTab.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    private val _generatedCode = MutableStateFlow<Pair<String, String>?>(null)
    val generatedCode: StateFlow<Pair<String, String>?> = _generatedCode.asStateFlow()

    val filteredClients: StateFlow<List<AdminClientDto>> = combine(
        _clients,
        _searchQuery,
        _statusFilter
    ) { clients, query, filter ->
        val q = query.trim().lowercase()
        clients.filter { client ->
            val matchesFilter = filter == AdminStatusFilter.ALL ||
                client.computedStatus.equals(filter.key, ignoreCase = true)
            val matchesSearch = q.isEmpty() ||
                (client.companyName ?: "").lowercase().contains(q) ||
                (client.companyId ?: "").lowercase().contains(q) ||
                (client.boundMachineId ?: "").lowercase().contains(q) ||
                (client.contactPhone ?: "").lowercase().contains(q) ||
                (client.contactName ?: "").lowercase().contains(q)
            matchesFilter && matchesSearch
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        refreshOverview()
    }

    fun clearMessage() {
        _message.value = null
    }

    fun clearGeneratedCode() {
        _generatedCode.value = null
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun onStatusFilterSelected(filter: AdminStatusFilter) {
        _statusFilter.value = filter
    }

    fun onTabSelected(index: Int) {
        _selectedTab.value = index
        if (index == 1 && _errorLogs.value.isEmpty()) {
            loadErrorLogs()
        }
        if (index == 2 && _auditLogs.value.isEmpty()) {
            loadAuditLogs()
        }
        if (index == 3 && _supportTickets.value.isEmpty()) {
            loadSupportTickets()
        }
    }

    fun loadAuditLogs(page: Int = _auditPage.value) {
        viewModelScope.launch {
            _isActionLoading.value = true
            val safePage = page.coerceAtLeast(1)
            adminRepository.getAuditLogs(page = safePage, perPage = 15)
                .onSuccess { res ->
                    _auditLogs.value = res.logs
                    _auditPage.value = res.page
                    _auditTotalPages.value = res.totalPages.coerceAtLeast(1)
                }
                .onFailure { err -> _message.value = err.message ?: "فشل تحميل سجل الإدارة" }
            _isActionLoading.value = false
        }
    }

    fun loadClientBackups(companyId: String) {
        viewModelScope.launch {
            _isActionLoading.value = true
            _clientBackups.value = emptyList()
            adminRepository.listClientBackups(companyId)
                .onSuccess { files -> _clientBackups.value = files }
                .onFailure { err -> _message.value = err.message ?: "فشل تحميل النسخ السحابية" }
            _isActionLoading.value = false
        }
    }

    fun downloadClientBackup(companyId: String, companyName: String, path: String, onUrlReady: (String) -> Unit) {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.downloadClientBackup(companyId, companyName, path)
                .onSuccess { url -> onUrlReady(url) }
                .onFailure { err -> _message.value = err.message ?: "فشل تجهيز رابط التحميل" }
            _isActionLoading.value = false
        }
    }

    fun detectTelegramChatId(botToken: String) {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.detectTelegramChatId(botToken)
                .onSuccess { chatId ->
                    _detectedChatId.value = chatId
                    _message.value = "تم جلب Chat ID بنجاح ($chatId) — اضغط حفظ الإعدادات"
                }
                .onFailure { err -> _message.value = err.message ?: "لم يتم العثور على Chat ID" }
            _isActionLoading.value = false
        }
    }

    fun testTelegramAlert(botToken: String, chatId: String) {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.testTelegramAlert(botToken, chatId)
                .onSuccess { _message.value = "تم إرسال رسالة الاختبار إلى تليجرام بنجاح!" }
                .onFailure { err -> _message.value = err.message ?: "فشل إرسال تنبيه تليجرام" }
            _isActionLoading.value = false
        }
    }

    fun sendExpiringSummary() {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.sendExpiringSummary()
                .onSuccess { _message.value = "تم إرسال تقرير الاشتراكات القريبة إلى تليجرام" }
                .onFailure { err -> _message.value = err.message ?: "فشل إرسال التقرير" }
            _isActionLoading.value = false
        }
    }

    fun sendClientNotice(licenseId: String, notice: String) {
        val clean = notice.trim()
        val type = if (clean.isEmpty()) "clear_notice" else "add_notice"
        val msg = if (clean.isEmpty()) "تم مسح جميع إشعارات العميل" else "تم إرسال الإشعار الخاص للعميل بنجاح"
        runAction(msg) {
            adminRepository.sendClientCommand(licenseId, commandType = type, customNotice = clean)
        }
    }

    fun deleteClientNotice(licenseId: String, noticeId: String) {
        runAction("تم حذف الإشعار بنجاح") {
            adminRepository.sendClientCommand(licenseId, commandType = "delete_notice", noticeId = noticeId)
        }
    }

    fun sendForceBackupCommand(licenseId: String) {
        runAction("تم إرسال أمر النسخ الاحتياطي السحابي عن بُعد") {
            adminRepository.sendClientCommand(licenseId, commandType = "force_backup")
        }
    }

    fun sendResetDesktopPassword(licenseId: String, newPassword: String) {
        runAction("تم إرسال أمر تغيير كلمة سر الديسكتوب بنجاح") {
            adminRepository.sendClientCommand(licenseId, commandType = "reset_desktop_password", newPassword = newPassword)
        }
    }

    fun sendForceUpdateCommand(licenseId: String, currentlyForced: Boolean) {
        val cmd = if (currentlyForced) "clear_force_update" else "force_update"
        val msg = if (currentlyForced) "تم إلغاء فرض التحديث للعميل" else "تم فرض التحديث الإجباري لهذا العميل بنجاح"
        runAction(msg) {
            adminRepository.sendClientCommand(licenseId, commandType = cmd)
        }
    }

    fun sendForceLogoutCommand(licenseId: String) {
        runAction("تم إرسال أمر تسجيل الخروج الفوري لجهاز العميل") {
            adminRepository.sendClientCommand(licenseId, commandType = "force_logout")
        }
    }

    fun setReadOnlyLicense(licenseId: String, days: Int = 3) {
        runAction("تم تحويل العميل لوضع القراءة فقط ($days أيام)") {
            adminRepository.updateLicense(licenseId, mode = "read_only", days = days)
        }
    }

    fun updateClientQuotas(licenseId: String, maxDesktopUsers: Int, maxAndroidUsers: Int) {
        runAction("تم حفظ حدود الباقة بنجاح") {
            adminRepository.updateLicense(
                licenseId,
                mode = "update_quotas",
                maxDesktopUsers = maxDesktopUsers.coerceAtLeast(0),
                maxAndroidUsers = maxAndroidUsers.coerceAtLeast(0)
            )
        }
    }

    fun loadSupportTickets(page: Int = _ticketsPage.value) {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.getSupportTickets(page = page.coerceAtLeast(1), perPage = 15)
                .onSuccess { res ->
                    _supportTickets.value = res.tickets
                    _ticketsPage.value = res.page
                    _ticketsTotalPages.value = res.totalPages.coerceAtLeast(1)
                }
                .onFailure { err -> _message.value = err.message ?: "فشل تحميل تذاكر الدعم" }
            _isActionLoading.value = false
        }
    }

    fun replySupportTicket(ticketId: String, reply: String, status: String = "replied") {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.replySupportTicket(ticketId, reply, status)
                .onSuccess {
                    _message.value = if (status == "closed") "تم إغلاق التذكرة" else "تم إرسال الرد للعميل في جرس الإشعارات!"
                    loadSupportTickets(_ticketsPage.value)
                }
                .onFailure { err -> _message.value = err.message ?: "فشل الرد على التذكرة" }
            _isActionLoading.value = false
        }
    }

    fun refreshOverview() {
        viewModelScope.launch {
            _isLoading.value = true
            adminRepository.getDashboardOverview()
                .onSuccess { res ->
                    _adminEmail.value = res.adminEmail ?: ""
                    _stats.value = res.stats
                    _globalConfig.value = res.globalConfig
                    _clients.value = res.clients
                }
                .onFailure { err ->
                    _message.value = err.message ?: "فشل تحميل بيانات اللوحة"
                }
            _isLoading.value = false
        }
    }

    fun loadErrorLogs(page: Int = _errorsPage.value) {
        viewModelScope.launch {
            _isActionLoading.value = true
            val safePage = page.coerceAtLeast(1)
            adminRepository.getErrorLogs(page = safePage, perPage = 15)
                .onSuccess { res ->
                    _errorLogs.value = res.logs
                    _errorsPage.value = res.page
                    _errorsTotalPages.value = res.totalPages.coerceAtLeast(1)
                }
                .onFailure { err -> _message.value = err.message ?: "فشل تحميل سجل الأخطاء" }
            _isActionLoading.value = false
        }
    }

    fun updateCompanyName(licenseId: String, companyId: String?, newName: String) {
        runAction("تم تحديث اسم الشركة بنجاح") {
            adminRepository.updateCompanyName(licenseId, companyId, newName)
        }
    }

    fun updateFeatures(licenseId: String, features: Map<String, Boolean>) {
        runAction("تم حفظ الميزات المخصصة بنجاح") {
            adminRepository.updateFeatures(licenseId, features)
        }
    }

    fun extendLicenseDays(licenseId: String, days: Int) {
        runAction("تم تمديد الاشتراك $days يوم بنجاح") {
            adminRepository.updateLicense(licenseId, mode = "extend_days", days = days)
        }
    }

    fun setLifetimeLicense(licenseId: String) {
        runAction("تم تفعيل الترخيص الدائم بنجاح") {
            adminRepository.updateLicense(licenseId, mode = "lifetime")
        }
    }

    fun toggleSuspendLicense(client: AdminClientDto) {
        val isSuspended = client.computedStatus.equals("suspended", ignoreCase = true)
        val mode = if (isSuspended) "resume" else "suspend"
        val successMsg = if (isSuspended) "تم تفعيل اشتراك العميل" else "تم إيقاف اشتراك العميل"
        runAction(successMsg) {
            adminRepository.updateLicense(client.id, mode = mode)
        }
    }

    fun resetMachine(licenseId: String) {
        runAction("تم فك ارتباط الجهاز بنجاح") {
            adminRepository.updateLicense(licenseId, mode = "reset_machine")
        }
    }

    fun bindMachine(licenseId: String, machineId: String) {
        runAction("تم إعادة ربط الجهاز بنجاح") {
            adminRepository.updateLicense(licenseId, mode = "bind_machine", machineId = machineId)
        }
    }

    fun updateNotes(licenseId: String, notes: String) {
        runAction("تم حفظ الملاحظات بنجاح") {
            adminRepository.updateLicense(licenseId, mode = "update_notes", notes = notes)
        }
    }

    fun generateActivationCode(machineId: String) {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.generateActivationCode(machineId)
                .onSuccess { code -> _generatedCode.value = machineId to code }
                .onFailure { err -> _message.value = err.message ?: "فشل توليد الكود" }
            _isActionLoading.value = false
        }
    }

    fun createAndroidUser(companyId: String, companyName: String, email: String, password: String) {
        runAction("تم إنشاء حساب الأندرويد بنجاح") {
            adminRepository.createAndroidUser(companyId, companyName, email, password)
        }
    }

    fun resetAndroidPassword(userId: String, password: String) {
        runAction("تم تحديث كلمة المرور بنجاح") {
            adminRepository.resetAndroidPassword(userId, password)
        }
    }

    fun deleteAndroidUser(userId: String) {
        runAction("تم حذف حساب الأندرويد بنجاح") {
            adminRepository.deleteAndroidUser(userId)
        }
    }

    fun updateGlobalConfig(
        minVersion: String,
        whatsapp: String,
        forceMessage: String,
        telegramBotToken: String = "",
        telegramChatId: String = "",
        telegramAlertsEnabled: Boolean = false,
        announcementMessage: String = "",
        announcementActive: Boolean = false
    ) {
        runAction("تم حفظ الإعدادات العامة بنجاح") {
            adminRepository.updateGlobalConfig(
                minVersion,
                whatsapp,
                forceMessage,
                telegramBotToken,
                telegramChatId,
                telegramAlertsEnabled,
                announcementMessage,
                announcementActive
            )
        }
    }

    fun changeMyPassword(newPassword: String) {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.changeMyPassword(newPassword)
                .onSuccess { _message.value = "تم تغيير كلمة مرور الأدمن بنجاح" }
                .onFailure { err -> _message.value = err.message ?: "فشل تغيير كلمة المرور" }
            _isActionLoading.value = false
        }
    }

    fun logout(onComplete: () -> Unit) {
        viewModelScope.launch {
            accountingRepository.logout().first()
            onComplete()
        }
    }

    private fun runAction(successMessage: String, block: suspend () -> Result<Unit>) {
        viewModelScope.launch {
            _isActionLoading.value = true
            block()
                .onSuccess {
                    _message.value = successMessage
                    refreshOverview()
                }
                .onFailure { err ->
                    _message.value = err.message ?: "حدث خطأ أثناء التنفيذ"
                }
            _isActionLoading.value = false
        }
    }
}
