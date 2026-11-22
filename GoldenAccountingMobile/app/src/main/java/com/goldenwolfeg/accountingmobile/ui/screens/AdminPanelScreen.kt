package com.goldenwolfeg.accountingmobile.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Security
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
import com.goldenwolfeg.accountingmobile.data.model.AdminAuditLogDto
import com.goldenwolfeg.accountingmobile.data.model.AdminBackupFileDto
import com.goldenwolfeg.accountingmobile.data.model.AdminClientDto
import com.goldenwolfeg.accountingmobile.data.model.AdminErrorLogDto
import com.goldenwolfeg.accountingmobile.data.model.AdminStatsDto
import com.goldenwolfeg.accountingmobile.data.model.AdminSupportTicketDto
import com.goldenwolfeg.accountingmobile.data.model.diagnoseClientError
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
    val errorsPage by viewModel.errorsPage.collectAsState()
    val errorsTotalPages by viewModel.errorsTotalPages.collectAsState()
    val auditLogs by viewModel.auditLogs.collectAsState()
    val auditPage by viewModel.auditPage.collectAsState()
    val auditTotalPages by viewModel.auditTotalPages.collectAsState()
    val supportTickets by viewModel.supportTickets.collectAsState()
    val ticketsPage by viewModel.ticketsPage.collectAsState()
    val ticketsTotalPages by viewModel.ticketsTotalPages.collectAsState()
    val clientBackups by viewModel.clientBackups.collectAsState()
    val detectedChatId by viewModel.detectedChatId.collectAsState()
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
    var backupsClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var remoteCommandClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var confirmResetMachineClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var confirmBindMachineClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var confirmSuspendClient by remember { mutableStateOf<AdminClientDto?>(null) }
    var confirmDeleteAndroidUser by remember { mutableStateOf<Pair<String, String>?>(null) }
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
                        text = { Text("العملاء", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.People, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { viewModel.onTabSelected(1) },
                        text = { Text("الأخطاء", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.BugReport, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { viewModel.onTabSelected(2) },
                        text = { Text("النشاط", fontSize = 10.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.Security, contentDescription = null, modifier = Modifier.size(17.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 3,
                        onClick = { viewModel.onTabSelected(3) },
                        text = { Text("التذاكر", fontSize = 10.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(17.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 4,
                        onClick = { viewModel.onTabSelected(4) },
                        text = { Text("الإعدادات", fontSize = 10.sp, fontWeight = FontWeight.SemiBold) },
                        icon = { Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(17.dp)) }
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
                        onToggleSuspend = { confirmSuspendClient = it },
                        onGenerateCode = { machineId -> viewModel.generateActivationCode(machineId) },
                        onResetMachine = { confirmResetMachineClient = it },
                        onBindMachine = { confirmBindMachineClient = it },
                        onOpenFeatures = { featuresClient = it },
                        onOpenAndroidUsers = { androidUsersClient = it },
                        onOpenBackups = { client ->
                            backupsClient = client
                            client.companyId?.let { viewModel.loadClientBackups(it) }
                        },
                        onOpenRemoteCommand = { remoteCommandClient = it }
                    )
                    1 -> ErrorLogsTabContent(
                        logs = errorLogs,
                        page = errorsPage,
                        totalPages = errorsTotalPages,
                        onPageChange = { viewModel.loadErrorLogs(it) },
                        onRefresh = { viewModel.loadErrorLogs(errorsPage) }
                    )
                    2 -> AuditLogsTabContent(
                        logs = auditLogs,
                        page = auditPage,
                        totalPages = auditTotalPages,
                        onPageChange = { viewModel.loadAuditLogs(it) },
                        onRefresh = { viewModel.loadAuditLogs(auditPage) }
                    )
                    3 -> SupportTicketsTabContent(
                        tickets = supportTickets,
                        page = ticketsPage,
                        totalPages = ticketsTotalPages,
                        onPageChange = { viewModel.loadSupportTickets(it) },
                        onRefresh = { viewModel.loadSupportTickets(ticketsPage) },
                        onReply = { tid, reply, st -> viewModel.replySupportTicket(tid, reply, st) }
                    )
                    4 -> GlobalConfigTabContent(
                        minVersion = globalConfig.minSupportedVersion,
                        supportWhatsapp = globalConfig.supportWhatsapp,
                        forceMessage = globalConfig.forceUpdateMessage,
                        telegramBotToken = globalConfig.telegramBotToken,
                        telegramChatId = detectedChatId ?: globalConfig.telegramChatId,
                        telegramAlertsEnabled = globalConfig.telegramAlertsEnabled,
                        announcementMessage = globalConfig.announcementMessage,
                        announcementActive = globalConfig.announcementActive,
                        onDetectChatId = { token -> viewModel.detectTelegramChatId(token) },
                        onTestTelegram = { token, chat -> viewModel.testTelegramAlert(token, chat) },
                        onSendExpiring = { viewModel.sendExpiringSummary() },
                        onSave = { minV, wa, msg, token, chat, enabled, annMsg, annActive ->
                            viewModel.updateGlobalConfig(minV, wa, msg, token, chat, enabled, annMsg, annActive)
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
            onSetReadOnly = {
                viewModel.setReadOnlyLicense(client.id, 3)
                renewClient = null
            },
            onSaveQuotas = { maxDesktop, maxAndroid ->
                viewModel.updateClientQuotas(client.id, maxDesktop, maxAndroid)
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
            onDeleteUser = { uid, email ->
                androidUsersClient = null
                confirmDeleteAndroidUser = uid to email
            }
        )
    }

    confirmResetMachineClient?.let { client ->
        val boundId = client.boundMachineId?.trim().orEmpty()
        AdminConfirmDialog(
            title = "تأكيد فك ربط الجهاز",
            message = "هل تريد فك ربط الجهاز لـ (${client.companyName ?: "العميل"}) حتى يتمكن من تشغيل البرنامج على جهاز جديد؟",
            details = "الجهاز المربوط حالياً: $boundId — بعد التأكيد سيتحول الحساب إلى (غير مربوط) وسيرتبط تلقائياً بأول جهاز جديد يفتح عليه العميل.",
            confirmText = "تأكيد فك الجهاز",
            confirmColor = Color(0xFF2563EB),
            onDismiss = { confirmResetMachineClient = null },
            onConfirm = {
                viewModel.resetMachine(client.id)
                confirmResetMachineClient = null
            }
        )
    }

    confirmBindMachineClient?.let { client ->
        val targetId = (client.lastSeenMachineId ?: client.machineId)?.trim().orEmpty()
        AdminConfirmDialog(
            title = "تأكيد إعادة ربط الجهاز",
            message = "هل تريد إعادة ربط حساب (${client.companyName ?: "العميل"}) بآخر جهاز مسجل؟",
            details = "الجهاز المستهدف: $targetId — لن يتمكن أي جهاز آخر من فتح الحساب بعد إعادة الربط.",
            confirmText = "تأكيد إعادة الربط",
            confirmColor = BalanceReceivable,
            onDismiss = { confirmBindMachineClient = null },
            onConfirm = {
                if (targetId.isNotEmpty()) {
                    viewModel.bindMachine(client.id, targetId)
                }
                confirmBindMachineClient = null
            }
        )
    }

    confirmSuspendClient?.let { client ->
        val isSuspended = client.computedStatus.equals("suspended", ignoreCase = true)
        AdminConfirmDialog(
            title = if (isSuspended) "تأكيد إعادة التفعيل" else "تأكيد إيقاف الحساب",
            message = if (isSuspended) {
                "هل تريد إعادة تفعيل حساب (${client.companyName ?: "العميل"})؟"
            } else {
                "هل أنت متأكد من إيقاف حساب (${client.companyName ?: "العميل"}) مؤقتاً؟"
            },
            details = if (isSuspended) {
                "سيتمكن العميل من استخدام البرنامج فور إعادة التفعيل."
            } else {
                "سيتوقف البرنامج لدى العميل عن العمل لحين إعادة تفعيله من لوحة الإدارة."
            },
            confirmText = if (isSuspended) "إعادة التفعيل" else "إيقاف الحساب",
            confirmColor = if (isSuspended) BalanceReceivable else BalancePayable,
            onDismiss = { confirmSuspendClient = null },
            onConfirm = {
                viewModel.toggleSuspendLicense(client)
                confirmSuspendClient = null
            }
        )
    }

    confirmDeleteAndroidUser?.let { (uid, email) ->
        AdminConfirmDialog(
            title = "تأكيد حذف حساب الأندرويد",
            message = "هل أنت متأكد من حذف حساب الأندرويد ($email) نهائياً؟",
            details = "لن يتمكن هذا الحساب من تسجيل الدخول لتطبيق الموبايل بعد الحذف.",
            confirmText = "حذف نهائي",
            confirmColor = BalancePayable,
            onDismiss = { confirmDeleteAndroidUser = null },
            onConfirm = {
                viewModel.deleteAndroidUser(uid)
                confirmDeleteAndroidUser = null
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

    backupsClient?.let { client ->
        ClientBackupsDialog(
            client = client,
            files = clientBackups,
            isLoading = isActionLoading,
            onDismiss = { backupsClient = null },
            onDownload = { path ->
                val cid = client.companyId ?: return@ClientBackupsDialog
                viewModel.downloadClientBackup(cid, client.companyName ?: "", path) { url ->
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                }
            }
        )
    }

    remoteCommandClient?.let { selectedClient ->
        val liveClient = clients.find { it.id == selectedClient.id } ?: selectedClient
        ClientRemoteCommandDialog(
            client = liveClient,
            onDismiss = { remoteCommandClient = null },
            onSendNotice = { txt ->
                viewModel.sendClientNotice(liveClient.id, txt)
            },
            onDeleteNotice = { noticeId ->
                viewModel.deleteClientNotice(liveClient.id, noticeId)
            },
            onForceBackup = {
                viewModel.sendForceBackupCommand(liveClient.id)
                remoteCommandClient = null
            },
            onForceUpdate = {
                viewModel.sendForceUpdateCommand(liveClient.id, liveClient.forceUpdateTarget)
                remoteCommandClient = null
            },
            onForceLogout = {
                viewModel.sendForceLogoutCommand(liveClient.id)
                remoteCommandClient = null
            },
            onResetDesktopPassword = { newPass ->
                viewModel.sendResetDesktopPassword(liveClient.id, newPass)
                remoteCommandClient = null
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
    onBindMachine: (AdminClientDto) -> Unit,
    onOpenFeatures: (AdminClientDto) -> Unit,
    onOpenAndroidUsers: (AdminClientDto) -> Unit,
    onOpenBackups: (AdminClientDto) -> Unit,
    onOpenRemoteCommand: (AdminClientDto) -> Unit
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
                        val mId = client.boundMachineId?.takeIf { it.isNotBlank() }
                            ?: client.lastSeenMachineId?.takeIf { it.isNotBlank() }
                            ?: client.machineId?.takeIf { it.isNotBlank() }
                            ?: ""
                        if (mId.isNotBlank()) onGenerateCode(mId)
                    },
                    onResetMachine = { onResetMachine(client) },
                    onBindMachine = { onBindMachine(client) },
                    onOpenFeatures = { onOpenFeatures(client) },
                    onOpenAndroidUsers = { onOpenAndroidUsers(client) },
                    onOpenBackups = { onOpenBackups(client) },
                    onOpenRemoteCommand = { onOpenRemoteCommand(client) }
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
    onBindMachine: () -> Unit,
    onOpenFeatures: () -> Unit,
    onOpenAndroidUsers: () -> Unit,
    onOpenBackups: () -> Unit,
    onOpenRemoteCommand: () -> Unit
) {
    val status = client.computedStatus.lowercase()
    val (statusLabel, statusColor) = when (status) {
        "lifetime" -> "دائم" to GoldBright
        "active" -> "نشط (${client.remainingDays} يوم)" to BalanceReceivable
        "trial" -> "تجريبي (${client.remainingDays} يوم)" to Color(0xFF06B6D4)
        "read_only" -> "قراءة فقط (${client.remainingDays} يوم)" to Color(0xFFF59E0B)
        "suspended" -> "موقوف" to BalancePayable
        else -> "منتهي" to BalancePayable
    }

    val enabledFeaturesCount = client.features.count { it.value }
    val androidCount = client.androidUsers.size
    val boundId = client.boundMachineId?.trim().orEmpty()
    val isBound = boundId.isNotEmpty()
    val lastSeenId = (client.lastSeenMachineId ?: client.machineId)?.trim().orEmpty()
    val codeMachineId = boundId.ifEmpty { lastSeenId }

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
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isBound) {
                    Text(
                        text = "الجهاز: $boundId",
                        color = Color.White.copy(alpha = 0.78f),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(GoldMetallic.copy(alpha = 0.16f))
                            .border(1.dp, GoldMetallic.copy(alpha = 0.55f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "غير مربوط بجهاز — جاهز للنقل",
                            color = GoldBright,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Text(
                    text = "الإصدار: ${client.appVersion?.let { "v$it" } ?: "—"}",
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 11.sp
                )
            }

            if (!isBound && lastSeenId.isNotEmpty()) {
                Text(
                    text = "آخر جهاز متصل: $lastSeenId",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            val presence = remember(client.lastHeartbeatAt) { computePresenceInfo(client.lastHeartbeatAt) }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(presence.color.copy(alpha = 0.16f))
                            .border(1.dp, presence.color.copy(alpha = 0.55f), RoundedCornerShape(16.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(presence.color)
                        )
                        Text(
                            text = presence.statusLabel,
                            color = presence.color,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Text(
                        text = presence.relativeTime,
                        color = Color.White.copy(alpha = 0.88f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(
                    text = DateTimeFormatter.formatIsoToLocalArabic(client.lastHeartbeatAt),
                    color = Color.White.copy(alpha = 0.52f),
                    fontSize = 10.sp
                )
            }

            HorizontalDivider(color = NavySecondary)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ActionButton(
                    text = "الميزات ($enabledFeaturesCount/${ADMIN_FEATURE_CATALOG.size})",
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
                ActionButton(
                    text = "النسخ",
                    containerColor = Color(0xFF0284C7),
                    modifier = Modifier.weight(0.75f),
                    onClick = onOpenBackups
                )
                ActionButton(
                    text = "أمر",
                    containerColor = Color(0xFFD97706),
                    modifier = Modifier.weight(0.65f),
                    onClick = onOpenRemoteCommand
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
                    enabled = codeMachineId.isNotEmpty(),
                    modifier = Modifier.weight(1f),
                    onClick = onGenerateCode
                )
                ActionButton(
                    text = if (isBound) "فك جهاز" else if (lastSeenId.isNotEmpty()) "إعادة ربط" else "غير مربوط",
                    containerColor = if (isBound) NavySecondary else if (lastSeenId.isNotEmpty()) BalanceReceivable else NavySecondary,
                    enabled = isBound || lastSeenId.isNotEmpty(),
                    modifier = Modifier.weight(1f),
                    onClick = if (isBound) onResetMachine else onBindMachine
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
private fun AdminPaginationRow(
    page: Int,
    totalPages: Int,
    onPageChange: (Int) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedButton(
            onClick = { if (page > 1) onPageChange(page - 1) },
            enabled = page > 1
        ) {
            Text("السابق", color = Color.White, fontSize = 12.sp)
        }
        Text(
            text = "صفحة $page من $totalPages",
            color = GoldBright,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
        OutlinedButton(
            onClick = { if (page < totalPages) onPageChange(page + 1) },
            enabled = page < totalPages
        ) {
            Text("التالي", color = Color.White, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ErrorLogsTabContent(
    logs: List<AdminErrorLogDto>,
    page: Int,
    totalPages: Int,
    onPageChange: (Int) -> Unit,
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
                val diag = diagnoseClientError(log.errorMessage, log.module)
                Card(
                    colors = CardDefaults.cardColors(containerColor = NavyPrimary),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, BalancePayable.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
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
                            Text(
                                text = log.companyName ?: "عميل غير معروف",
                                color = GoldBright,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                modifier = Modifier.weight(1f)
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Color(0xFF06B6D4).copy(alpha = 0.16f))
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = diag.moduleLabel,
                                        color = Color(0xFF38BDF8),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                if (!log.appVersion.isNullOrBlank()) {
                                    Text(
                                        text = "v${log.appVersion}",
                                        color = Color.White.copy(alpha = 0.65f),
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }

                        Text(
                            text = diag.title,
                            color = Color(0xFFFCA5A5),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.ExtraBold
                        )

                        Text(
                            text = "السبب: ${diag.reason}",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 12.sp
                        )

                        Text(
                            text = "ما يراه العميل: ${diag.clientImpact}",
                            color = Color(0xFF93C5FD),
                            fontSize = 12.sp
                        )

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(BalanceReceivable.copy(alpha = 0.14f))
                                .border(1.dp, BalanceReceivable.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                                .padding(10.dp)
                        ) {
                            Text(
                                text = "الحل المقترح: ${diag.solution}",
                                color = Color(0xFF86EFAC),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        if (!log.errorMessage.isNullOrBlank()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(NavyDark)
                                    .padding(8.dp)
                            ) {
                                Text(
                                    text = log.errorMessage,
                                    color = Color.White.copy(alpha = 0.55f),
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }

                        Text(
                            text = DateTimeFormatter.formatIsoToLocalArabic(log.createdAt),
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 10.sp
                        )
                    }
                }
            }
            item {
                AdminPaginationRow(page = page, totalPages = totalPages, onPageChange = onPageChange)
            }
        }
    }
}

@Composable
private fun AuditLogsTabContent(
    logs: List<AdminAuditLogDto>,
    page: Int,
    totalPages: Int,
    onPageChange: (Int) -> Unit,
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
                    text = "سجل نشاط الإدارة (${logs.size})",
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
                    modifier = Modifier.fillMaxWidth().padding(vertical = 36.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("لا توجد حركات مسجلة بعد", color = Color.White.copy(alpha = 0.6f))
                }
            }
        } else {
            items(logs, key = { it.id }) { log ->
                val actionLabel = when (log.actionType) {
                    "license_extend_days" -> "تمديد اشتراك"
                    "license_lifetime" -> "تفعيل ترخيص دائم"
                    "license_suspend" -> "إيقاف حساب"
                    "license_resume" -> "إعادة تفعيل حساب"
                    "license_reset_machine" -> "فك ربط جهاز"
                    "license_bind_machine" -> "إعادة ربط جهاز"
                    "update_features" -> "تعديل ميزات"
                    "update_company_name" -> "تعديل اسم الشركة"
                    "download_client_backup" -> "تحميل نسخة احتياطية"
                    "update_global_config" -> "تعديل الإعدادات العامة"
                    else -> log.actionType
                }
                Card(
                    colors = CardDefaults.cardColors(containerColor = NavyPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().border(1.dp, NavySecondary, RoundedCornerShape(12.dp))
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(actionLabel, color = GoldBright, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(DateTimeFormatter.formatIsoToLocalArabic(log.createdAt), color = Color.White.copy(alpha = 0.55f), fontSize = 10.sp)
                        }
                        Text(log.targetCompanyName ?: "إعدادات عامة", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Text(log.adminEmail, color = Color(0xFF38BDF8), fontSize = 11.sp)
                    }
                }
            }
            item {
                AdminPaginationRow(page = page, totalPages = totalPages, onPageChange = onPageChange)
            }
        }
    }
}

@Composable
private fun ClientBackupsDialog(
    client: AdminClientDto,
    files: List<AdminBackupFileDto>,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onDownload: (String) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CloudDownload, contentDescription = null, tint = Color(0xFF38BDF8))
                Spacer(modifier = Modifier.width(8.dp))
                Text("النسخ السحابية (${client.companyName ?: ""})", fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            if (isLoading && files.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = GoldBright)
                }
            } else if (files.isEmpty()) {
                Text("لا توجد نسخ احتياطية سحابية لهذا العميل حالياً.", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
            } else {
                Column(
                    modifier = Modifier.height(320.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    files.forEach { file ->
                        val sizeText = when {
                            file.size < 1024 -> "${file.size} B"
                            file.size < 1024 * 1024 -> "${"%.1f".format(file.size / 1024.0)} KB"
                            else -> "${"%.2f".format(file.size / (1024.0 * 1024.0))} MB"
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(NavySurface)
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                Text(file.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("$sizeText • ${DateTimeFormatter.formatIsoToLocalArabic(file.createdAt)}", color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp)
                            }
                            Button(
                                onClick = { onDownload(file.path) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text("تحميل", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
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
private fun GlobalConfigTabContent(
    minVersion: String,
    supportWhatsapp: String,
    forceMessage: String,
    telegramBotToken: String,
    telegramChatId: String,
    telegramAlertsEnabled: Boolean,
    announcementMessage: String,
    announcementActive: Boolean,
    onDetectChatId: (String) -> Unit,
    onTestTelegram: (String, String) -> Unit,
    onSendExpiring: () -> Unit,
    onSave: (String, String, String, String, String, Boolean, String, Boolean) -> Unit
) {
    var version by remember(minVersion) { mutableStateOf(minVersion) }
    var whatsapp by remember(supportWhatsapp) { mutableStateOf(supportWhatsapp) }
    var message by remember(forceMessage) { mutableStateOf(forceMessage) }
    var botToken by remember(telegramBotToken) { mutableStateOf(telegramBotToken) }
    var chatId by remember(telegramChatId) { mutableStateOf(telegramChatId) }
    var tgEnabled by remember(telegramAlertsEnabled) { mutableStateOf(telegramAlertsEnabled) }
    var annMsg by remember(announcementMessage) { mutableStateOf(announcementMessage) }
    var annActive by remember(announcementActive) { mutableStateOf(announcementActive) }

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

        HorizontalDivider(color = NavySecondary)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "تنبيهات تليجرام الفورية للأدمن",
                color = Color(0xFF38BDF8),
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )
            Switch(
                checked = tgEnabled,
                onCheckedChange = { tgEnabled = it },
                colors = SwitchDefaults.colors(checkedThumbColor = NavyDark, checkedTrackColor = BalanceReceivable)
            )
        }

        AdminTextField(
            value = botToken,
            onValueChange = { botToken = it },
            label = "Telegram Bot Token"
        )

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AdminTextField(
                value = chatId,
                onValueChange = { chatId = it },
                label = "Telegram Chat ID",
                modifier = Modifier.weight(1f)
            )
            OutlinedButton(onClick = { onDetectChatId(botToken) }) {
                Text("جلب تلقائي", color = GoldBright, fontSize = 11.sp)
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { onTestTelegram(botToken, chatId) },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = BalanceReceivable)
            ) {
                Text("اختبار تنبيه", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            OutlinedButton(
                onClick = onSendExpiring,
                modifier = Modifier.weight(1f)
            ) {
                Text("تقرير الاشتراكات", color = Color.White, fontSize = 12.sp)
            }
        }

        HorizontalDivider(color = NavySecondary)

        var newAnnText by remember { mutableStateOf("") }
        val globalNotices = remember(annMsg) { parseAdminNotices(annMsg) }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "نظام الإشعارات والإعلانات العامة",
                color = GoldBright,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )
            Switch(
                checked = annActive,
                onCheckedChange = { annActive = it },
                colors = SwitchDefaults.colors(checkedThumbColor = NavyDark, checkedTrackColor = BalanceReceivable)
            )
        }

        AdminTextField(
            value = newAnnText,
            onValueChange = { newAnnText = it },
            label = "اكتب إعلاناً عاماً جديداً لجميع العملاء",
            singleLine = false
        )

        Button(
            onClick = {
                val txt = newAnnText.trim()
                if (txt.isNotEmpty()) {
                    val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                        timeZone = java.util.TimeZone.getTimeZone("UTC")
                    }.format(java.util.Date())
                    val nextList = listOf(
                        AdminNoticeEntry(
                            id = "g_${System.currentTimeMillis()}",
                            text = txt,
                            createdAt = nowIso
                        )
                    ) + globalNotices
                    val serialized = serializeAdminNotices(nextList)
                    annMsg = serialized
                    annActive = true
                    newAnnText = ""
                    onSave(version, whatsapp, message, botToken, chatId, tgEnabled, serialized, true)
                }
            },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
            shape = RoundedCornerShape(10.dp)
        ) {
            Text("إرسال إعلان عام للجميع", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }

        if (globalNotices.isEmpty()) {
            Text(
                text = "لا توجد إعلانات عامة مرسلة حالياً.",
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 11.sp
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                globalNotices.forEach { item ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = NavySurface),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, NavySecondary, RoundedCornerShape(10.dp))
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(item.text, color = Color.White, fontSize = 12.sp)
                                val readLabel = if (item.readByNames.isNotEmpty()) {
                                    "✓ قرأه ${item.readByNames.size} عميل (${item.readByNames.joinToString("، ")})"
                                } else {
                                    "لم يقرأه أحد بعد"
                                }
                                Text(
                                    text = readLabel,
                                    color = if (item.readByNames.isNotEmpty()) Color(0xFF4ADE80) else GoldBright,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            IconButton(
                                onClick = {
                                    val nextList = globalNotices.filterNot { it.id == item.id }
                                    val serialized = serializeAdminNotices(nextList)
                                    annMsg = serialized
                                    onSave(version, whatsapp, message, botToken, chatId, tgEnabled, serialized, annActive)
                                },
                                modifier = Modifier.size(30.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = "حذف الإعلان",
                                    tint = BalancePayable,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        Button(
            onClick = { onSave(version, whatsapp, message, botToken, chatId, tgEnabled, annMsg, annActive) },
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
    onSetReadOnly: () -> Unit,
    onSaveQuotas: (Int, Int) -> Unit,
    onSaveNotes: (String) -> Unit
) {
    var daysText by remember { mutableStateOf("30") }
    var notesText by remember { mutableStateOf(client.notes ?: "") }
    var maxDesktopText by remember(client.id) { mutableStateOf(client.maxDesktopUsers.toString()) }
    var maxAndroidText by remember(client.id) { mutableStateOf(client.maxAndroidUsers.toString()) }

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

                OutlinedButton(
                    onClick = onSetReadOnly,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("🔒 وضع القراءة فقط (مهلة 3 أيام ثم قفل)", color = Color(0xFFFBBF24), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                HorizontalDivider(color = NavySecondary)

                Text("حدود الباقة (0 = غير محدود)", color = Color(0xFF38BDF8), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AdminTextField(
                        value = maxDesktopText,
                        onValueChange = { maxDesktopText = it.filter { ch -> ch.isDigit() } },
                        label = "موظفي الديسكتوب",
                        modifier = Modifier.weight(1f)
                    )
                    AdminTextField(
                        value = maxAndroidText,
                        onValueChange = { maxAndroidText = it.filter { ch -> ch.isDigit() } },
                        label = "حسابات الأندرويد",
                        modifier = Modifier.weight(1f)
                    )
                }
                Button(
                    onClick = { onSaveQuotas(maxDesktopText.toIntOrNull() ?: 0, maxAndroidText.toIntOrNull() ?: 0) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7))
                ) {
                    Text("حفظ حدود الباقة", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
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
            val disabledItems = ADMIN_FEATURE_CATALOG.filter { featureStates[it.key] != true }
            val enabledGrouped = ADMIN_FEATURE_CATALOG.filter { featureStates[it.key] == true }.groupBy { it.category }
            Column(
                modifier = Modifier
                    .height(400.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (disabledItems.isNotEmpty()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(GoldMetallic.copy(alpha = 0.16f))
                            .border(1.dp, GoldMetallic.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("الميزات المقفولة حالياً", color = GoldBright, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text("${disabledItems.size} مقفول", color = GoldBright, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                    disabledItems.forEach { item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(NavySurface)
                                .border(1.dp, GoldMetallic.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
                                .clickable { featureStates[item.key] = true }
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                Text("${item.label} (${item.category})", color = GoldBright, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text(item.desc, color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                            }
                            Switch(
                                checked = false,
                                onCheckedChange = { featureStates[item.key] = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = NavyDark, checkedTrackColor = BalanceReceivable)
                            )
                        }
                    }
                }
                enabledGrouped.forEach { (category, items) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(NavyDark)
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(category, color = Color(0xFF38BDF8), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text("مفعّل (${items.size})", color = BalanceReceivable, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    }
                    items.forEach { item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(NavySurface)
                                .clickable { featureStates[item.key] = false }
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                Text(item.label, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text(item.desc, color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                            }
                            Switch(
                                checked = true,
                                onCheckedChange = { featureStates[item.key] = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = NavyDark, checkedTrackColor = BalanceReceivable)
                            )
                        }
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
    onDeleteUser: (String, String) -> Unit
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
                                    onClick = { onDeleteUser(user.id, user.email ?: "الحساب") },
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
private fun AdminConfirmDialog(
    title: String,
    message: String,
    details: String,
    confirmText: String,
    confirmColor: Color,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        textContentColor = Color.White,
        title = {
            Text(text = title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(NavyDark)
                        .border(1.dp, GoldMetallic.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = message,
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp
                        )
                        if (details.isNotBlank()) {
                            Text(
                                text = details,
                                color = Color.White.copy(alpha = 0.7f),
                                fontSize = 11.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = confirmColor, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(text = confirmText, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء", color = Color.White.copy(alpha = 0.85f))
            }
        }
    )
}

@Composable
private fun ClientRemoteCommandDialog(
    client: AdminClientDto,
    onDismiss: () -> Unit,
    onSendNotice: (String) -> Unit,
    onDeleteNotice: (String) -> Unit,
    onForceBackup: () -> Unit,
    onForceUpdate: () -> Unit,
    onForceLogout: () -> Unit,
    onResetDesktopPassword: (String) -> Unit
) {
    var noticeText by remember(client.id) { mutableStateOf("") }
    var desktopNewPass by remember { mutableStateOf("") }
    val notices = remember(client.customNotice) { parseAdminNotices(client.customNotice) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        title = {
            Text("تحكم عن بُعد (${client.companyName ?: ""})", fontSize = 14.sp, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                AdminTextField(
                    value = noticeText,
                    onValueChange = { noticeText = it },
                    label = "إرسال إشعار خاص جديد للعميل",
                    singleLine = false
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            if (noticeText.trim().isNotEmpty()) {
                                onSendNotice(noticeText.trim())
                                noticeText = ""
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                    ) {
                        Text("إرسال إشعار", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(onClick = { onSendNotice("") }) {
                        Text("مسح الكل", color = Color.White, fontSize = 11.sp)
                    }
                }

                if (notices.isNotEmpty()) {
                    Text(
                        text = "الإشعارات المرسلة (${notices.size}):",
                        color = GoldBright,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        notices.forEach { n ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = NavySurface),
                                shape = RoundedCornerShape(9.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, NavySecondary, RoundedCornerShape(9.dp))
                            ) {
                                Row(
                                    modifier = Modifier.padding(8.dp),
                                    verticalAlignment = Alignment.Top,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.weight(1f),
                                        verticalArrangement = Arrangement.spacedBy(3.dp)
                                    ) {
                                        Text(n.text, color = Color.White, fontSize = 11.sp)
                                        val readStatus = if (!n.readAt.isNullOrBlank()) {
                                            "✓ تمت القراءة (${computePresenceInfo(n.readAt).relativeTime})"
                                        } else {
                                            "⏳ لم يُقرأ بعد"
                                        }
                                        Text(
                                            text = readStatus,
                                            color = if (!n.readAt.isNullOrBlank()) Color(0xFF4ADE80) else GoldBright,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    IconButton(
                                        onClick = { onDeleteNotice(n.id) },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "حذف الإشعار",
                                            tint = BalancePayable,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                HorizontalDivider(color = NavySecondary)

                Button(
                    onClick = onForceBackup,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = BalanceReceivable)
                ) {
                    Text("أمر أخذ نسخة احتياطية سحابية الآن", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onForceUpdate,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B), contentColor = NavyDark)
                    ) {
                        Text(
                            if (client.forceUpdateTarget) "إلغاء فرض التحديث" else "فرض تحديث للعميل",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Button(
                        onClick = onForceLogout,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = BalancePayable)
                    ) {
                        Text("تسجيل خروج فوري", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }

                HorizontalDivider(color = NavySecondary)

                Text("تغيير كلمة سر الديسكتوب للعميل (عند النسيان)", color = GoldBright, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                AdminTextField(
                    value = desktopNewPass,
                    onValueChange = { desktopNewPass = it },
                    label = "كلمة السر الجديدة (4 أحرف على الأقل)"
                )
                Button(
                    onClick = {
                        if (desktopNewPass.trim().length >= 4) {
                            onResetDesktopPassword(desktopNewPass.trim())
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = GoldMetallic, contentColor = NavyDark)
                ) {
                    Text("تحديث كلمة سر الديسكتوب", fontWeight = FontWeight.Bold, fontSize = 12.sp)
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

private data class PresenceInfo(
    val statusLabel: String,
    val relativeTime: String,
    val color: Color
)

private fun parseIsoToEpochMs(isoDate: String?): Long {
    val raw = isoDate?.trim().orEmpty()
    if (raw.isEmpty()) return 0L
    return try {
        val cleaned = raw
            .replace(Regex("\\.\\d+"), "")
            .replace(Regex("([+-]\\d{2}):(\\d{2})$"), "$1$2")
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss'Z'" to true,
            "yyyy-MM-dd'T'HH:mm:ssZ" to false,
            "yyyy-MM-dd HH:mm:ss" to true
        )
        for ((pattern, forceUtc) in patterns) {
            try {
                val sdf = java.text.SimpleDateFormat(pattern, java.util.Locale.US)
                if (forceUtc) sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val parsed = sdf.parse(cleaned)
                if (parsed != null) return parsed.time
            } catch (_: Exception) {
            }
        }
        0L
    } catch (_: Exception) {
        0L
    }
}

private fun computePresenceInfo(isoDate: String?): PresenceInfo {
    val hbMs = parseIsoToEpochMs(isoDate)
    if (hbMs <= 0L) {
        return PresenceInfo(
            statusLabel = "لم يتصل",
            relativeTime = "لم يتصل بعد",
            color = Color(0xFF94A3B8)
        )
    }
    val diffMs = (System.currentTimeMillis() - hbMs).coerceAtLeast(0L)
    val diffMin = diffMs / (60 * 1000L)
    val diffHours = diffMs / (60 * 60 * 1000L)
    val diffDays = diffMs / (24 * 60 * 60 * 1000L)

    val relative = when {
        diffMin < 1L -> "الآن"
        diffMin < 60L -> "منذ $diffMin دقيقة"
        diffHours < 24L -> "منذ $diffHours ساعة"
        else -> "منذ $diffDays يوم"
    }

    return when {
        diffMin < 5L -> PresenceInfo(
            statusLabel = "متصل الآن",
            relativeTime = relative,
            color = Color(0xFF22C55E)
        )
        diffHours < 24L -> PresenceInfo(
            statusLabel = "ظهر اليوم",
            relativeTime = relative,
            color = Color(0xFFF59E0B)
        )
        else -> PresenceInfo(
            statusLabel = "غير متصل",
            relativeTime = relative,
            color = Color(0xFF94A3B8)
        )
    }
}

private data class AdminNoticeEntry(
    val id: String,
    val text: String,
    val createdAt: String? = null,
    val readAt: String? = null,
    val readByNames: List<String> = emptyList(),
    val readByRawJson: String? = null
)

private fun parseAdminNotices(raw: String?): List<AdminNoticeEntry> {
    val str = raw?.trim().orEmpty()
    if (str.isEmpty()) return emptyList()
    if (str.startsWith("[")) {
        return try {
            val arr = org.json.JSONArray(str)
            val result = mutableListOf<AdminNoticeEntry>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val txt = obj.optString("text", "").trim()
                if (txt.isEmpty()) continue
                val readByArr = obj.optJSONArray("read_by")
                val names = mutableListOf<String>()
                if (readByArr != null) {
                    for (j in 0 until readByArr.length()) {
                        val r = readByArr.optJSONObject(j)
                        val nm = r?.optString("company_name")?.takeIf { it.isNotBlank() }
                            ?: r?.optString("company_id")?.takeIf { it.isNotBlank() }
                        if (nm != null) names.add(nm)
                    }
                }
                result.add(
                    AdminNoticeEntry(
                        id = obj.optString("id", "n_$i"),
                        text = txt,
                        createdAt = obj.optString("created_at", "").takeIf { it.isNotBlank() && it != "null" },
                        readAt = obj.optString("read_at", "").takeIf { it.isNotBlank() && it != "null" },
                        readByNames = names,
                        readByRawJson = readByArr?.toString()
                    )
                )
            }
            result
        } catch (_: Exception) {
            listOf(AdminNoticeEntry(id = "legacy_${str.length}", text = str))
        }
    }
    return listOf(AdminNoticeEntry(id = "legacy_${str.length}", text = str))
}

private fun serializeAdminNotices(list: List<AdminNoticeEntry>): String {
    if (list.isEmpty()) return ""
    val arr = org.json.JSONArray()
    list.forEach { item ->
        val obj = org.json.JSONObject()
        obj.put("id", item.id)
        obj.put("text", item.text)
        if (!item.createdAt.isNullOrBlank()) obj.put("created_at", item.createdAt)
        if (!item.readAt.isNullOrBlank()) obj.put("read_at", item.readAt)
        if (!item.readByRawJson.isNullOrBlank()) {
            try {
                obj.put("read_by", org.json.JSONArray(item.readByRawJson))
            } catch (_: Exception) {
                obj.put("read_by", org.json.JSONArray())
            }
        } else {
            obj.put("read_by", org.json.JSONArray())
        }
        arr.put(obj)
    }
    return arr.toString()
}

@Composable
private fun SupportTicketsTabContent(
    tickets: List<AdminSupportTicketDto>,
    page: Int,
    totalPages: Int,
    onPageChange: (Int) -> Unit,
    onRefresh: () -> Unit,
    onReply: (String, String, String) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("تذاكر الدعم الفني (${tickets.size})", color = GoldBright, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            OutlinedButton(onClick = onRefresh) {
                Text("تحديث", color = Color.White, fontSize = 11.sp)
            }
        }

        if (tickets.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("لا توجد تذاكر دعم فني حالياً.", color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(bottom = 12.dp)
            ) {
                items(tickets, key = { it.id }) { tk ->
                    var replyText by remember(tk.id) { mutableStateOf("") }
                    val (statusLabel, statusColor) = when (tk.status.lowercase()) {
                        "closed" -> "مغلقة" to BalancePayable
                        "replied" -> "تم الرد" to BalanceReceivable
                        else -> "مفتوحة" to Color(0xFFF59E0B)
                    }
                    Card(
                        colors = CardDefaults.cardColors(containerColor = NavyPrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, NavySecondary, RoundedCornerShape(12.dp))
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(tk.subject, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.weight(1f))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(statusColor.copy(alpha = 0.16f))
                                        .border(1.dp, statusColor.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(statusLabel, color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Text(
                                text = "${tk.companyName ?: tk.companyId} • v${tk.desktopVersion ?: "—"}",
                                color = Color(0xFF38BDF8),
                                fontSize = 11.sp
                            )
                            Text(tk.message, color = Color.White.copy(alpha = 0.88f), fontSize = 12.sp)
                            if (!tk.adminReply.isNullOrBlank()) {
                                Text(
                                    text = "رد الإدارة: ${tk.adminReply}",
                                    color = Color(0xFF4ADE80),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            AdminTextField(
                                value = replyText,
                                onValueChange = { replyText = it },
                                label = "اكتب ردك (يصل للعميل في جرس الإشعارات)",
                                singleLine = false
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = {
                                        if (replyText.trim().isNotEmpty()) {
                                            onReply(tk.id, replyText.trim(), "replied")
                                            replyText = ""
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                                ) {
                                    Text("إرسال الرد", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                                if (!tk.status.equals("closed", ignoreCase = true)) {
                                    OutlinedButton(onClick = { onReply(tk.id, "", "closed") }) {
                                        Text("إغلاق", color = Color.White, fontSize = 11.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (totalPages > 1) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(onClick = { if (page > 1) onPageChange(page - 1) }, enabled = page > 1) {
                    Text("السابق", color = Color.White, fontSize = 11.sp)
                }
                Text("صفحة $page من $totalPages", color = GoldBright, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                OutlinedButton(onClick = { if (page < totalPages) onPageChange(page + 1) }, enabled = page < totalPages) {
                    Text("التالي", color = Color.White, fontSize = 11.sp)
                }
            }
        }
    }
}
