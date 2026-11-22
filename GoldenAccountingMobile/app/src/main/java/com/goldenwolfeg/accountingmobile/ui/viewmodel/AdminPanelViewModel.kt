package com.goldenwolfeg.accountingmobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.goldenwolfeg.accountingmobile.data.model.AdminClientDto
import com.goldenwolfeg.accountingmobile.data.model.AdminErrorLogDto
import com.goldenwolfeg.accountingmobile.data.model.AdminGlobalConfigDto
import com.goldenwolfeg.accountingmobile.data.model.AdminStatsDto
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

    fun loadErrorLogs() {
        viewModelScope.launch {
            _isActionLoading.value = true
            adminRepository.getErrorLogs()
                .onSuccess { logs -> _errorLogs.value = logs }
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

    fun updateGlobalConfig(minVersion: String, whatsapp: String, forceMessage: String) {
        runAction("تم حفظ الإعدادات العامة بنجاح") {
            adminRepository.updateGlobalConfig(minVersion, whatsapp, forceMessage)
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
