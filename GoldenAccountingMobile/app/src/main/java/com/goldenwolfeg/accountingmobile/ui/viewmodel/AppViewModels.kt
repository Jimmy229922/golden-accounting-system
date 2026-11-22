package com.goldenwolfeg.accountingmobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.goldenwolfeg.accountingmobile.data.model.FinancialSummary
import com.goldenwolfeg.accountingmobile.data.model.Party
import com.goldenwolfeg.accountingmobile.data.model.PartyLedgerEntry
import com.goldenwolfeg.accountingmobile.data.model.PartyType
import com.goldenwolfeg.accountingmobile.data.model.SyncStateEnum
import com.goldenwolfeg.accountingmobile.data.model.SyncStatus
import com.goldenwolfeg.accountingmobile.data.repository.AccountingRepository
import com.goldenwolfeg.accountingmobile.data.repository.RefreshResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.util.Calendar

enum class PartyFilterType(val label: String) {
    ALL("الكل"),
    CUSTOMER("العملاء"),
    SUPPLIER("الموردون"),
    BOTH("عميل ومورد")
}

enum class BalanceFilterType(val label: String) {
    ALL("جميع الأرصدة"),
    RECEIVABLE("مديونيات لنا"),
    PAYABLE("مستحق علينا"),
    BALANCED("متزنة")
}

enum class LedgerDateRange(val label: String) {
    ALL("جميع الحركات"),
    THIS_MONTH("هذا الشهر"),
    LAST_3_MONTHS("آخر 3 أشهر"),
    CURRENT_YEAR("السنة الحالية")
}

class LoginViewModel(private val repository: AccountingRepository) : ViewModel() {
    private val isSandbox = com.goldenwolfeg.accountingmobile.BuildConfig.FLAVOR.equals("sandbox", ignoreCase = true)

    private val _username = MutableStateFlow(if (isSandbox) "admin" else "")
    val username: StateFlow<String> = _username.asStateFlow()

    private val _password = MutableStateFlow(if (isSandbox) "admin" else "")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError.asStateFlow()

    private val _isSuccess = MutableStateFlow(false)
    val isSuccess: StateFlow<Boolean> = _isSuccess.asStateFlow()

    private val _isSuperAdminSuccess = MutableStateFlow(false)
    val isSuperAdminSuccess: StateFlow<Boolean> = _isSuperAdminSuccess.asStateFlow()

    fun onUsernameChanged(value: String) { _username.value = value }
    fun onPasswordChanged(value: String) { _password.value = value }

    fun login() {
        if (_username.value.isBlank() || _password.value.isBlank()) {
            _loginError.value = "يرجى إدخال اسم المستخدم وكلمة المرور"
            return
        }

        _isLoading.value = true
        _loginError.value = null

        repository.login(_username.value, _password.value)
            .onEach { result ->
                _isLoading.value = false
                when (result) {
                    is com.goldenwolfeg.accountingmobile.data.repository.LoginResult.Success -> {
                        _isSuccess.value = true
                    }
                    is com.goldenwolfeg.accountingmobile.data.repository.LoginResult.SuperAdminSuccess -> {
                        _isSuperAdminSuccess.value = true
                    }
                    is com.goldenwolfeg.accountingmobile.data.repository.LoginResult.Error -> {
                        _loginError.value = result.message
                    }
                }
            }
            .launchIn(viewModelScope)
    }
}

class DashboardViewModel(private val repository: AccountingRepository) : ViewModel() {
    val summary: StateFlow<FinancialSummary?> = repository.getFinancialSummary()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val syncStatus: StateFlow<SyncStatus?> = repository.getSyncStatus()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _refreshMessage = MutableStateFlow<String?>(null)
    val refreshMessage: StateFlow<String?> = _refreshMessage.asStateFlow()

    fun loadData() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            _refreshMessage.value = null
            try {
                val res = repository.refreshDashboardData()
                when (res) {
                    is RefreshResult.Success -> {
                        _refreshMessage.value = "تم تحديث بيانات اللوحة الرئيسية بنجاح"
                    }
                    is RefreshResult.Error -> {
                        _refreshMessage.value = res.message
                    }
                }
            } catch (e: Exception) {
                _refreshMessage.value = "تعذر التحديث: ${e.message}"
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun clearRefreshMessage() {
        _refreshMessage.value = null
    }
}

@OptIn(FlowPreview::class)
class PartiesViewModel(private val repository: AccountingRepository) : ViewModel() {
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedFilter = MutableStateFlow(PartyFilterType.ALL)
    val selectedFilter: StateFlow<PartyFilterType> = _selectedFilter.asStateFlow()

    private val _selectedBalanceFilter = MutableStateFlow(BalanceFilterType.ALL)
    val selectedBalanceFilter: StateFlow<BalanceFilterType> = _selectedBalanceFilter.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _refreshMessage = MutableStateFlow<String?>(null)
    val refreshMessage: StateFlow<String?> = _refreshMessage.asStateFlow()

    private val debouncedSearchQuery = _searchQuery.debounce(150L)

    val filteredParties: StateFlow<List<Party>> = combine(
        repository.getParties(),
        debouncedSearchQuery,
        _selectedFilter,
        _selectedBalanceFilter
    ) { parties, query, typeFilter, balanceFilter ->
        filterPartiesList(parties, query, typeFilter, balanceFilter)
    }
    .flowOn(Dispatchers.Default)
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun refreshData() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            _refreshMessage.value = null
            try {
                val res = repository.refreshPartiesData()
                when (res) {
                    is RefreshResult.Success -> {
                        _refreshMessage.value = "تم تحديث دليل الأطراف والحسابات بنجاح"
                    }
                    is RefreshResult.Error -> {
                        _refreshMessage.value = res.message
                    }
                }
            } catch (e: Exception) {
                _refreshMessage.value = "تعذر تحديث القائمة: ${e.message}"
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun clearRefreshMessage() {
        _refreshMessage.value = null
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun onFilterSelected(filter: PartyFilterType) {
        _selectedFilter.value = filter
    }

    fun onBalanceFilterSelected(filter: BalanceFilterType) {
        _selectedBalanceFilter.value = filter
    }

    private fun filterPartiesList(
        allParties: List<Party>,
        queryStr: String,
        typeFilter: PartyFilterType,
        balanceFilter: BalanceFilterType
    ): List<Party> {
        val q = queryStr.trim().lowercase()
        val filtered = allParties.filter { party ->
            val matchesType = when (typeFilter) {
                PartyFilterType.ALL -> true
                PartyFilterType.CUSTOMER -> party.type == PartyType.CUSTOMER
                PartyFilterType.SUPPLIER -> party.type == PartyType.SUPPLIER
                PartyFilterType.BOTH -> party.type == PartyType.BOTH
            }

            val matchesBalance = when (balanceFilter) {
                BalanceFilterType.ALL -> true
                BalanceFilterType.RECEIVABLE -> party.balance > BigDecimal.ZERO
                BalanceFilterType.PAYABLE -> party.balance < BigDecimal.ZERO
                BalanceFilterType.BALANCED -> party.balance.compareTo(BigDecimal.ZERO) == 0
            }

            val matchesSearch = q.isEmpty() ||
                    party.name.lowercase().contains(q) ||
                    party.code.lowercase().contains(q) ||
                    party.phone.contains(q)

            matchesType && matchesBalance && matchesSearch
        }

        return when (balanceFilter) {
            BalanceFilterType.RECEIVABLE -> filtered.sortedByDescending { it.balance }
            BalanceFilterType.PAYABLE -> filtered.sortedBy { it.balance }
            else -> filtered
        }
    }
}

class PartyDetailsViewModel(
    val partyId: String,
    private val repository: AccountingRepository
) : ViewModel() {
    val party: StateFlow<Party?> = repository.getPartyById(partyId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _selectedDateRange = MutableStateFlow(LedgerDateRange.ALL)
    val selectedDateRange: StateFlow<LedgerDateRange> = _selectedDateRange.asStateFlow()

    val rawLedgerEntries: StateFlow<List<PartyLedgerEntry>> = repository.getPartyLedger(partyId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val ledgerEntries: StateFlow<List<PartyLedgerEntry>> = combine(
        rawLedgerEntries,
        _selectedDateRange
    ) { entries, range ->
        filterLedgerByDate(entries, range)
    }
    .flowOn(Dispatchers.Default)
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _refreshMessage = MutableStateFlow<String?>(null)
    val refreshMessage: StateFlow<String?> = _refreshMessage.asStateFlow()

    fun onDateRangeSelected(range: LedgerDateRange) {
        _selectedDateRange.value = range
    }

    fun refreshPartyData() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            _refreshMessage.value = null
            try {
                val res = repository.refreshPartyDetailsData(partyId)
                when (res) {
                    is RefreshResult.Success -> {
                        _refreshMessage.value = "تم تحديث كشف حساب الطرف بنجاح"
                    }
                    is RefreshResult.Error -> {
                        _refreshMessage.value = res.message
                    }
                }
            } catch (e: Exception) {
                _refreshMessage.value = "تعذر تحديث الحساب: ${e.message}"
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun clearRefreshMessage() {
        _refreshMessage.value = null
    }

    private fun filterLedgerByDate(entries: List<PartyLedgerEntry>, range: LedgerDateRange): List<PartyLedgerEntry> {
        if (range == LedgerDateRange.ALL) return entries

        val cal = Calendar.getInstance()
        val currentYear = cal.get(Calendar.YEAR)
        val currentMonth = cal.get(Calendar.MONTH) // 0-based

        return entries.filter { entry ->
            try {
                val dateParts = entry.transDate.split("-")
                if (dateParts.size < 3) return@filter true
                val entryYear = dateParts[0].toInt()
                val entryMonth = dateParts[1].toInt() - 1 // convert to 0-based

                when (range) {
                    LedgerDateRange.ALL -> true
                    LedgerDateRange.THIS_MONTH -> entryYear == currentYear && entryMonth == currentMonth
                    LedgerDateRange.LAST_3_MONTHS -> {
                        val monthDiff = (currentYear - entryYear) * 12 + (currentMonth - entryMonth)
                        monthDiff in 0..2
                    }
                    LedgerDateRange.CURRENT_YEAR -> entryYear == currentYear
                }
            } catch (_: Exception) {
                true
            }
        }
    }
}

class SyncViewModel(private val repository: AccountingRepository) : ViewModel() {
    val syncStatus: StateFlow<SyncStatus?> = repository.getSyncStatus()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _refreshMessage = MutableStateFlow<String?>(null)
    val refreshMessage: StateFlow<String?> = _refreshMessage.asStateFlow()

    private val _syncProgressStep = MutableStateFlow("جاهز للمزامنة")
    val syncProgressStep: StateFlow<String> = _syncProgressStep.asStateFlow()

    fun fetchSyncStatus() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            _refreshMessage.value = null
            _syncProgressStep.value = SyncStateEnum.CHECKING_CONNECTION.description
            try {
                kotlinx.coroutines.delay(200)
                _syncProgressStep.value = SyncStateEnum.FETCHING_REMOTE.description
                val res = repository.refreshSyncStatusData()
                _syncProgressStep.value = SyncStateEnum.UPDATING_CACHE.description
                kotlinx.coroutines.delay(200)

                when (res) {
                    is RefreshResult.Success -> {
                        _syncProgressStep.value = SyncStateEnum.SUCCESS.description
                        _refreshMessage.value = "تمت المزامنة وتحديث حالة الاتصال بنجاح"
                    }
                    is RefreshResult.Error -> {
                        _syncProgressStep.value = SyncStateEnum.FAILED.description
                        _refreshMessage.value = res.message
                    }
                }
            } catch (e: Exception) {
                _syncProgressStep.value = SyncStateEnum.FAILED.description
                _refreshMessage.value = "خطأ في المزامنة: ${e.message}"
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun simulateSync() {
        fetchSyncStatus()
    }

    fun clearRefreshMessage() {
        _refreshMessage.value = null
    }
}
