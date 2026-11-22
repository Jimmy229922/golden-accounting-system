package com.goldenwolfeg.accountingmobile.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.ui.components.AccountingTopBar
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldMetallic
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.SyncViewModel

@Composable
fun SyncStatusScreen(
    viewModel: SyncViewModel,
    onBackClick: () -> Unit
) {
    val syncStatus by viewModel.syncStatus.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val refreshMessage by viewModel.refreshMessage.collectAsState()
    val syncProgressStep by viewModel.syncProgressStep.collectAsState()

    val context = LocalContext.current

    LaunchedEffect(refreshMessage) {
        refreshMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearRefreshMessage()
        }
    }

    Scaffold(
        topBar = {
            AccountingTopBar(
                title = "حالة الاتصال والمزامنة",
                subtitle = "الربط مع Golden Accounting System",
                onBackClick = onBackClick
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Main Connection Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFFD97706).copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CloudDone,
                                    contentDescription = null,
                                    tint = Color(0xFFD97706),
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "حالة ربط النظام",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                )
                                Text(
                                    text = if (syncStatus?.isOnline == true) "متصل بالسحابة" else "لا يوجد اتصال بالإنترنت",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = if (syncStatus?.isOnline == true) BalanceReceivable else Color(0xFFD97706),
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }

                        Surface(
                            color = (if (syncStatus?.isOnline == true) BalanceReceivable else Color(0xFFD97706)).copy(alpha = 0.12f),
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                    .background(if (syncStatus?.isOnline == true) BalanceReceivable else Color(0xFFD97706))
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                val isSandbox = com.goldenwolfeg.accountingmobile.BuildConfig.FLAVOR.equals("sandbox", ignoreCase = true)
                                Text(
                                    text = if (isSandbox) "بيئة اختبار Sandbox" else "Golden Accounting — إنتاج",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = if (syncStatus?.isOnline == true) BalanceReceivable else Color(0xFFD97706),
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Spacer(modifier = Modifier.height(16.dp))

                    // Sync Meta Details
                    SyncDetailItem(
                        title = "حالة العمل الحالية",
                        value = if (isRefreshing) syncProgressStep else (syncStatus?.syncState ?: "جاهز")
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "آخر تحديث محلي على الهاتف",
                        value = syncStatus?.lastFetchTime?.ifBlank { "-" } ?: "-"
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "آخر تواجد للكمبيوتر (Heartbeat)",
                        value = syncStatus?.lastHeartbeatAt ?: "-"
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "آخر مزامنة مالية للكمبيوتر",
                        value = syncStatus?.lastFinancialSyncAt ?: "-"
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "حالة مزامنة سطح المكتب",
                        value = syncStatus?.desktopSyncStatus ?: "تمت المزامنة"
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "إجمالي الأطراف المتزامنة",
                        value = "${syncStatus?.totalPartiesCount ?: 0} طرف"
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "رقم آخر مستند متزامن",
                        value = syncStatus?.lastSyncedDocNumber ?: "-"
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "إصدار نظام الكمبيوتر",
                        value = syncStatus?.desktopAppVersion ?: "-"
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SyncDetailItem(
                        title = "خادم الربط المباشر",
                        value = syncStatus?.serverConnectionUrl ?: "-"
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Sync Manual Trigger Button
            Button(
                onClick = { viewModel.simulateSync() },
                enabled = !isRefreshing,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = NavyDark,
                    contentColor = GoldBright
                )
            ) {
                if (isRefreshing) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(
                            color = GoldBright,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = syncProgressStep,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "تحديث البيانات والمزامنة الآن",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Architecture Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = NavyPrimary.copy(alpha = 0.05f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = null,
                            tint = GoldMetallic,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "مواصفات وتأمين المزامنة المباشرة",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "• التطبيق يعمل بنظام القراءة فقط (Read-Only) لضمان الأمان وعدم تعديل البيانات المالية من الموبايل.\n" +
                                "• الربط يتم مع خادم Supabase وتحديث الكاش المحلي المشفر AES/GCM تلقائياً.\n" +
                                "• جميع الأرصدة والسجلات متطابقة تماماً مع سجلات party_ledger ببرنامج الكمبيوتر.",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 20.sp
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
fun SyncDetailItem(
    title: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodySmall.copy(
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall.copy(
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        )
    }
}
