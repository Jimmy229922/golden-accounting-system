package com.goldenwolfeg.accountingmobile.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LockReset
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.data.model.ADMIN_FEATURE_CATALOG
import com.goldenwolfeg.accountingmobile.data.model.AdminClientDto
import com.goldenwolfeg.accountingmobile.data.model.AdminErrorLogDto
import com.goldenwolfeg.accountingmobile.data.model.AdminStatsDto
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldMetallic
import com.goldenwolfeg.accountingmobile.ui.theme.NavyBackground
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.theme.NavySecondary
import com.goldenwolfeg.accountingmobile.ui.theme.NavySurface
import com.goldenwolfeg.accountingmobile.ui.util.DateTimeFormatter
import com.goldenwolfeg.accountingmobile.ui.viewmodel.AdminPanelViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.AdminStatusFilter

@Composable
fun AdminPanelScreen(
    viewModel: AdminPanelViewModel,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val isLoading by viewModel.isLoading.collectAsState()
    val isActionLoading by viewModel.isActionLoading.collectAsState()
    val adminEmail by viewModel.adminEmail.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val globalConfig by viewModel.globalConfig.collectAsState()
    val clients by viewModel.filteredClients.collectAsState()
    val errorLogs by viewModel.errorLogs.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val statusFilter by viewModel.statusFilter.collectAsState()
    val selectedTab by viewModel.selectedTab.collectAsState()
    val message by viewModel.message.collectAsState()
    val generatedCode by viewModel.generatedCode.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    var editingNameClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var renewClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var featuresClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var androidUsersClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var showChangePasswordDialog by remember { mutableStateOf(false) }

    LaunchedEffect(message) {
        message?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        containerColor = NavyBackground,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(NavyDark)
                    .statusBarsPadding()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(GoldMetallic.copy(alpha = 0.18f))
                                .border(1.dp, GoldMetallic, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AdminPanelSettings,
                                contentDescription = null,
                                tint = GoldBright,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "لوحة تحكم إدارة العملاء",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (adminEmail.isNotBlank()) {
                                Text(
                                    text = adminEmail,
                                    color = Color.White.copy(alpha = 0.65f),
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { viewModel.refreshOverview() }) {
                            Icon(Icons.Default.Refresh, contentDescription = "تحديث", tint = GoldMetallic)
                        }
                        IconButton(onClick = { showChangePasswordDialog = true }) {
                            Icon(Icons.Default.LockReset, contentDescription = "حسابي / الباسورد", tint = Color.White)
                        }
                        IconButton(onClick = { viewModel.logout(onLogout) }) {
                            Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "خروج", tint = BalancePayable)
                        }
                    }
                }

                if (isActionLoading) {
                    LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth().height(2.dp),
                        color = GoldBright,
                        trackColor = NavyPrimary
                    )
                }

                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = NavyDark,
                    contentColor = GoldBright,
                    indicator = { tabPositions ->
                        TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                            color = GoldBright
                        )
                    }
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { viewModel.onTabSelected(0) },
                        text = { Text("العملاء والتراخيص", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.People, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { viewModel.onTabSelected(1) },
                        text = { Text("سجل الأخطاء", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.BugReport, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { viewModel.onTabSelected(2) },
                        text = { Text("الإعدادات العامة", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (isLoading && clients.isEmpty() && selectedTab == 0) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = GoldBright
                )
            } else {
                when (selectedTab) {
                    0 -> ClientsTabContent(
                        stats = stats,
                        clients = clients,
                        searchQuery = searchQuery,
                        statusFilter = statusFilter,
                        onSearchChanged = viewModel::onSearchQueryChanged,
                        onFilterSelected = viewModel::onStatusFilterSelected,
                        onEditName = { editingNameClient = it },
                        onRenew = { renewClient = it },
                        onToggleSuspend = { viewModel.toggleSuspendLicense(it) },
                        onGenerateCode = { machineId -> viewModel.generateActivationCode(machineId) },
                        onResetMachine = { viewModel.resetMachine(it.id) },
                        onOpenFeatures = { featuresClient = it },
                        onOpenAndroidUsers = { androidUsersClient = it }
                    )
                    1 -> ErrorLogsTabContent(
                        logs = errorLogs,
                        onRefresh = { viewModel.loadErrorLogs() }
                    )
                    2 -> GlobalConfigTabContent(
                        minVersion = globalConfig.minSupportedVersion,
                        supportWhatsapp = globalConfig.supportWhatsapp,
                        forceMessage = globalConfig.forceUpdateMessage,
                        onSave = { minV, wa, msg ->
                            viewModel.updateGlobalConfig(minV, wa, msg)
                        }
                    )
                }
            }
        }
    }

    editingNameClient?.let { client ->
        EditCompanyNameDialog(
            initialName = client.companyName ?: "",
            onDismiss = { editingNameClient = null },
            onSave = { newName ->
                viewModel.updateCompanyName(client.id, client.companyId, newName)
                editingNameClient = null
            }
        )
    }

    renewClient?.let { client ->
        RenewAndNotesDialog(
            client = client,
            onDismiss = { renewClient = null },
            onExtendDays = { days ->
                viewModel.extendLicenseDays(client.id, days)
                renewClient = null
            },
            onSetLifetime = {
                viewModel.setLifetimeLicense(client.id)
                renewClient = null
            },
            onSaveNotes = { notes ->
                viewModel.updateNotes(client.id, notes)
                renewClient = null
            }
        )
    }

    featuresClient?.let { client ->
        ClientFeaturesDialog(
            client = client,
            onDismiss = { featuresClient = null },
            onSave = { updated ->
                viewModel.updateFeatures(client.id, updated)
                featuresClient = null
            }
        )
    }

    androidUsersClient?.let { client ->
        AndroidUsersDialog(
            client = client,
            onDismiss = { androidUsersClient = null },
            onCreateUser = { email, pass ->
                val cid = client.companyId ?: return@AndroidUsersDialog
                viewModel.createAndroidUser(cid, client.companyName ?: "مؤسسة", email, pass)
                androidUsersClient = null
            },
            onResetPassword = { uid, pass ->
                viewModel.resetAndroidPassword(uid, pass)
                androidUsersClient = null
            },
            onDeleteUser = { uid ->
                viewModel.deleteAndroidUser(uid)
                androidUsersClient = null
            }
        )
    }

    generatedCode?.let { (machineId, code) ->
        AlertDialog(
            onDismissRequest = { viewModel.clearGeneratedCode() },
            containerColor = NavyPrimary,
            titleContentColor = Color.White,
            textContentColor = Color.White,
            title = { Text("كود التفعيل", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("الجهاز: $machineId", fontSize = 12.sp, color = Color.White.copy(alpha = 0.7f))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(NavyDark)
                            .border(1.dp, GoldMetallic, RoundedCornerShape(10.dp))
                            .padding(14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = code,
                            color = GoldBright,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Activation Code", code))
                        viewModel.clearGeneratedCode()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark)
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("نسخ الكود", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.clearGeneratedCode() }) {
                    Text("إغلاق", color = Color.White)
                }
            }
        )
    }

    if (showChangePasswordDialog) {
        ChangeAdminPasswordDialog(
            onDismiss = { showChangePasswordDialog = false },
            onSave = { newPass ->
                viewModel.changeMyPassword(newPass)
                showChangePasswordDialog = false
            }
        )
    }
}

@Composable
private fun ClientsTabContent(
    stats: AdminStatsDto,
    clients: List<AdminClientDto>,
    searchQuery: String,
    statusFilter: AdminStatusFilter,
    onSearchChanged: (String) -> Unit,
    onFilterSelected: (AdminStatusFilter) -> Unit,
    onEditName: (AdminClientDto) -> Unit,
    onRenew: (AdminClientDto) -> Unit,
    onToggleSuspend: (AdminClientDto) -> Unit,
    onGenerateCode: (String) -> Unit,
    onResetMachine: (AdminClientDto) -> Unit,
    onOpenFeatures: (AdminClientDto) -> Unit,
    onOpenAndroidUsers: (AdminClientDto) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard("إجمالي العملاء", stats.total.toString(), Color(0xFF3B82F6))
                StatCard("اشتراك نشط", stats.active.toString(), BalanceReceivable)
                StatCard("ترخيص دائم", stats.lifetime.toString(), GoldBright)
                StatCard("فترة تجريبية", stats.trial.toString(), Color(0xFF06B6D4))
                StatCard("موقوف / منتهي", (stats.suspended + stats.expired).toString(), BalancePayable)
                StatCard("نشط آخر 24 ساعة", stats.onlineToday.toString(), Color(0xFF10B981))
            }
        }

        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchChanged,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("ابحث باسم الشركة أو Machine ID أو Company ID...", fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = GoldMetallic) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GoldMetallic,
                    unfocusedBorderColor = NavySecondary,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedContainerColor = NavySurface,
                    unfocusedContainerColor = NavySurface
                )
            )
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AdminStatusFilter.entries.forEach { filter ->
                    val selected = statusFilter == filter
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (selected) Color(0xFF2563EB) else NavySurface)
                            .border(
                                1.dp,
                                if (selected) Color(0xFF3B82F6) else NavySecondary,
                                RoundedCornerShape(20.dp)
                            )
                            .clickable { onFilterSelected(filter) }
                            .padding(horizontal = 14.dp, vertical = 7.dp)
                    ) {
                        Text(
                            text = filter.label,
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }
        }

        if (clients.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("لا توجد نتائج مطابقة", color = Color.White.copy(alpha = 0.6f))
                }
            }
        } else {
            items(clients, key = { it.id }) { client ->
                ClientCard(
                    client = client,
                    onEditName = { onEditName(client) },
                    onRenew = { onRenew(client) },
                    onToggleSuspend = { onToggleSuspend(client) },
                    onGenerateCode = {
                        val mId = client.boundMachineId ?: ""
                        if (mId.isNotBlank()) onGenerateCode(mId)
                    },
                    onResetMachine = { onResetMachine(client) },
                    onOpenFeatures = { onOpenFeatures(client) },
                    onOpenAndroidUsers = { onOpenAndroidUsers(client) }
                )
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, accentColor: Color) {
    Card(
        colors = CardDefaults.cardColors(containerColor = NavySurface),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .width(136.dp)
            .border(1.dp, NavySecondary, RoundedCornerShape(14.dp))
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = value,
                color = accentColor,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = label,
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ClientCard(
    client: AdminClientDto,
    onEditName: () -> Unit,
    onRenew: () -> Unit,
    onToggleSuspend: () -> Unit,
    onGenerateCode: () -> Unit,
    onResetMachine: () -> Unit,
    onOpenFeatures: () -> Unit,
    onOpenAndroidUsers: () -> Unit
) {
    val status = client.computedStatus.lowercase()
    val (statusLabel, statusColor) = when (status) {
        "lifetime" -> "دائم" to GoldBright
        "active" -> "نشط (${client.remainingDays} يوم)" to BalanceReceivable
        "trial" -> "تجريبي (${client.remainingDays} يوم)" to Color(0xFF06B6D4)
        "suspended" -> "موقوف" to BalancePayable
        else -> "منتهي" to BalancePayable
    }

    val enabledFeaturesCount = client.features.count { it.value }
    val androidCount = client.androidUsers.size

    Card(
        colors = CardDefaults.cardColors(containerColor = NavyPrimary),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, NavySecondary, RoundedCornerShape(14.dp))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Text(
                        text = client.companyName ?: "بدون اسم",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    IconButton(onClick = onEditName, modifier = Modifier.size(28.dp)) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "تعديل الاسم",
                            tint = GoldMetallic,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(statusColor.copy(alpha = 0.16f))
                        .border(1.dp, statusColor.copy(alpha = 0.6f), RoundedCornerShape(16.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = statusLabel,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (!client.businessActivity.isNullOrBlank() || !client.contactPhone.isNullOrBlank()) {
                Text(
                    text = listOfNotNull(client.businessActivity, client.contactPhone).joinToString(" • "),
                    color = Color.White.copy(alpha = 0.72f),
                    fontSize = 12.sp
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "الجهاز: ${client.boundMachineId ?: "غير مربوط"}",
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "الإصدار: ${client.appVersion ?: "—"}",
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 11.sp
                )
            }

            Text(
                text = "آخر ظهور: ${DateTimeFormatter.formatIsoToLocalArabic(client.lastHeartbeatAt)}",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 11.sp
            )

            HorizontalDivider(color = NavySecondary)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ActionButton(
                    text = "الميزات ($enabledFeaturesCount/16)",
                    containerColor = Color(0xFF059669),
                    modifier = Modifier.weight(1f),
                    onClick = onOpenFeatures
                )
                ActionButton(
                    text = "الحسابات ($androidCount)",
                    containerColor = Color(0xFF7C3AED),
                    modifier = Modifier.weight(1f),
                    onClick = onOpenAndroidUsers
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                ActionButton(
                    text = "تجديد",
                    containerColor = Color(0xFF2563EB),
                    modifier = Modifier.weight(1f),
                    onClick = onRenew
                )
                ActionButton(
                    text = if (status == "suspended") "تفعيل" else "إيقاف",
                    containerColor = if (status == "suspended") BalanceReceivable else BalancePayable,
                    modifier = Modifier.weight(1f),
                    onClick = onToggleSuspend
                )
                ActionButton(
                    text = "كود",
                    containerColor = NavySecondary,
                    enabled = !client.boundMachineId.isNullOrBlank(),
                    modifier = Modifier.weight(1f),
                    onClick = onGenerateCode
                )
                ActionButton(
                    text = "فك جهاز",
                    containerColor = NavySecondary,
                    enabled = !client.boundMachineId.isNullOrBlank(),
                    modifier = Modifier.weight(1f),
                    onClick = onResetMachine
                )
            }
        }
    }
}

@Composable
private fun ActionButton(
    text: String,
    containerColor: Color,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(34.dp),
        shape = RoundedCornerShape(8.dp),
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = Color.White,
            disabledContainerColor = NavyDark,
            disabledContentColor = Color.White.copy(alpha = 0.35f)
        )
    ) {
        Text(text = text, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun ErrorLogsTabContent(
    logs: List<AdminErrorLogDto>,
    onRefresh: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "آخر ${logs.size} خطأ مسجل من العملاء",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                OutlinedButton(onClick = onRefresh) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp), tint = GoldMetallic)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("تحديث", color = Color.White, fontSize = 12.sp)
                }
            }
        }

        if (logs.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 36.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("لا توجد أخطاء مسجلة", color = Color.White.copy(alpha = 0.6f))
                }
            }
        } else {
            items(logs, key = { it.id }) { log ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = NavyPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, BalancePayable.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = log.companyName ?: "عميل غير معروف",
                                color = GoldBright,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            Text(
                                text = log.appVersion ?: "",
                                color = Color.White.copy(alpha = 0.6f),
                                fontSize = 11.sp
                            )
                        }
                        Text(
                            text = log.errorMessage ?: "خطأ غير محدد",
                            color = Color(0xFFFCA5A5),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        if (!log.context.isNullOrBlank()) {
                            Text(
                                text = "السياق: ${log.context}",
                                color = Color.White.copy(alpha = 0.7f),
                                fontSize = 11.sp
                            )
                        }
                        Text(
                            text = DateTimeFormatter.formatIsoToLocalArabic(log.createdAt),
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 10.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GlobalConfigTabContent(
    minVersion: String,
    supportWhatsapp: String,
    forceMessage: String,
    onSave: (String, String, String) -> Unit
) {
    var version by remember(minVersion) { mutableStateOf(minVersion) }
    var whatsapp by remember(supportWhatsapp) { mutableStateOf(supportWhatsapp) }
    var message by remember(forceMessage) { mutableStateOf(forceMessage) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = "إعدادات التحديث الإجباري والدعم الفني",
            color = GoldBright,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp
        )

        AdminTextField(
            value = version,
            onValueChange = { version = it },
            label = "أقل إصدار مدعوم (min_supported_version)"
        )

        AdminTextField(
            value = whatsapp,
            onValueChange = { whatsapp = it },
            label = "رقم واتساب الدعم الفني"
        )

        AdminTextField(
            value = message,
            onValueChange = { message = it },
            label = "رسالة التحديث الإجباري",
            singleLine = false
        )

        Button(
            onClick = { onSave(version, whatsapp, message) },
            modifier = Modifier.fillMaxWidth().height(46.dp),
            colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark),
            shape = RoundedCornerShape(10.dp)
        ) {
            Text("حفظ الإعدادات العامة", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun EditCompanyNameDialog(
    initialName: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        title = { Text("تعديل اسم الشركة", fontWeight = FontWeight.Bold) },
        text = {
            AdminTextField(value = name, onValueChange = { name = it }, label = "اسم الشركة")
        },
        confirmButton = {
            Button(
                onClick = { if (name.trim().length >= 2) onSave(name.trim()) },
                colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark)
            ) {
                Text("حفظ", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء", color = Color.White) }
        }
    )
}

@Composable
private fun RenewAndNotesDialog(
    client: AdminClientDto,
    onDismiss: () -> Unit,
    onExtendDays: (Int) -> Unit,
    onSetLifetime: () -> Unit,
    onSaveNotes: (String) -> Unit
) {
    var daysText by remember { mutableStateOf("30") }
    var notesText by remember { mutableStateOf(client.notes ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        title = { Text("إدارة ترخيص: ${client.companyName ?: ""}", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(30, 90, 365).forEach { preset ->
                        OutlinedButton(
                            onClick = { onExtendDays(preset) },
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(4.dp)
                        ) {
                            Text("+$preset يوم", fontSize = 11.sp, color = Color.White)
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AdminTextField(
                        value = daysText,
                        onValueChange = { daysText = it.filter { ch -> ch.isDigit() } },
                        label = "عدد الأيام",
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = {
                            val d = daysText.toIntOrNull() ?: 30
                            if (d > 0) onExtendDays(d)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                    ) {
                        Text("تمديد", color = Color.White)
                    }
                }

                Button(
                    onClick = onSetLifetime,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark)
                ) {
                    Text("تفعيل ترخيص دائم (Lifetime)", fontWeight = FontWeight.Bold)
                }

                HorizontalDivider(color = NavySecondary)

                AdminTextField(
                    value = notesText,
                    onValueChange = { notesText = it },
                    label = "ملاحظات الإدارة",
                    singleLine = false
                )
                Button(
                    onClick = { onSaveNotes(notesText) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = NavySecondary)
                ) {
                    Text("حفظ الملاحظات", color = Color.White)
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إغلاق", color = Color.White) }
        }
    )
}

@Composable
private fun ClientFeaturesDialog(
    client: AdminClientDto,
    onDismiss: () -> Unit,
    onSave: (Map<String, Boolean>) -> Unit
) {
    val featureStates = remember(client.id) {
        mutableStateMapOf<String, Boolean>().apply {
            ADMIN_FEATURE_CATALOG.forEach { item ->
                put(item.key, client.features[item.key] == true)
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Tune, contentDescription = null, tint = GoldBright)
                Spacer(modifier = Modifier.width(8.dp))
                Text("الميزات المخصصة (${client.companyName ?: ""})", fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .height(360.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ADMIN_FEATURE_CATALOG.forEach { item ->
                    val checked = featureStates[item.key] == true
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(NavySurface)
                            .clickable { featureStates[item.key] = !checked }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                            Text(item.label, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text(item.desc, color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                        }
                        Switch(
                            checked = checked,
                            onCheckedChange = { featureStates[item.key] = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = NavyDark,
                                checkedTrackColor = BalanceReceivable
                            )
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(featureStates.toMap()) },
                colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark)
            ) {
                Text("حفظ الميزات", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء", color = Color.White) }
        }
    )
}

@Composable
private fun AndroidUsersDialog(
    client: AdminClientDto,
    onDismiss: () -> Unit,
    onCreateUser: (String, String) -> Unit,
    onResetPassword: (String, String) -> Unit,
    onDeleteUser: (String) -> Unit
) {
    var newEmail by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var resetTargetUserId by remember { mutableStateOf<String?>(null) }
    var resetPasswordText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Android, contentDescription = null, tint = Color(0xFFA78BFA))
                Spacer(modifier = Modifier.width(8.dp))
                Text("حسابات الأندرويد (${client.companyName ?: ""})", fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .height(380.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (client.androidUsers.isEmpty()) {
                    Text("لا توجد حسابات أندرويد لهذا العميل حالياً.", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                } else {
                    client.androidUsers.forEach { user ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(NavySurface)
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(user.email ?: "—", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(
                                    onClick = { resetTargetUserId = user.id },
                                    modifier = Modifier.weight(1f),
                                    contentPadding = PaddingValues(4.dp)
                                ) {
                                    Icon(Icons.Default.Key, contentDescription = null, modifier = Modifier.size(14.dp), tint = GoldMetallic)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("تغيير الباسورد", fontSize = 11.sp, color = Color.White)
                                }
                                Button(
                                    onClick = { onDeleteUser(user.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = BalancePayable),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color.White)
                                }
                            }
                            if (resetTargetUserId == user.id) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    AdminTextField(
                                        value = resetPasswordText,
                                        onValueChange = { resetPasswordText = it },
                                        label = "باسورد جديد (6+)",
                                        modifier = Modifier.weight(1f)
                                    )
                                    Button(
                                        onClick = {
                                            if (resetPasswordText.length >= 6) {
                                                onResetPassword(user.id, resetPasswordText)
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark)
                                    ) {
                                        Text("حفظ", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }

                HorizontalDivider(color = NavySecondary)
                Text("إضافة حساب أندرويد جديد", color = GoldBright, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                AdminTextField(value = newEmail, onValueChange = { newEmail = it }, label = "البريد الإلكتروني")
                AdminTextField(value = newPassword, onValueChange = { newPassword = it }, label = "كلمة المرور (6 أحرف على الأقل)")
                Button(
                    onClick = {
                        if (newEmail.contains("@") && newPassword.length >= 6) {
                            onCreateUser(newEmail.trim(), newPassword)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
                ) {
                    Text("إنشاء الحساب", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إغلاق", color = Color.White) }
        }
    )
}

@Composable
private fun ChangeAdminPasswordDialog(
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var password by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        title = { Text("تغيير كلمة مرور الأدمن", fontWeight = FontWeight.Bold) },
        text = {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("كلمة المرور الجديدة (6 أحرف على الأقل)", fontSize = 12.sp) },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GoldMetallic,
                    unfocusedBorderColor = NavySecondary,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                )
            )
        },
        confirmButton = {
            Button(
                onClick = { if (password.length >= 6) onSave(password) },
                colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark)
            ) {
                Text("تحديث", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء", color = Color.White) }
        }
    )
}

@Composable
private fun AdminTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, fontSize = 12.sp) },
        singleLine = singleLine,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = GoldMetallic,
            unfocusedBorderColor = NavySecondary,
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedLabelColor = GoldMetallic,
            unfocusedLabelColor = Color.White.copy(alpha = 0.65f),
            focusedContainerColor = NavySurface,
            unfocusedContainerColor = NavySurface
        )
    )
}
