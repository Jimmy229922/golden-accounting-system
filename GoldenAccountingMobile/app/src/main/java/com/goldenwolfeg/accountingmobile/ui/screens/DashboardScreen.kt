package com.goldenwolfeg.accountingmobile.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.CallMade
import androidx.compose.material.icons.automirrored.filled.CallReceived
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import com.goldenwolfeg.accountingmobile.ui.components.GoldenHeaderBanner
import com.goldenwolfeg.accountingmobile.ui.components.SummaryStatCard
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceBalanced
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldMetallic
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.DashboardViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToParties: () -> Unit,
    onNavigateToSync: () -> Unit
) {
    val summary by viewModel.summary.collectAsState()
    val syncStatus by viewModel.syncStatus.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val refreshMessage by viewModel.refreshMessage.collectAsState()

    val context = LocalContext.current

    LaunchedEffect(refreshMessage) {
        refreshMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearRefreshMessage()
        }
    }

    val curr = summary?.currencySymbol ?: "ج.م"

    Scaffold(
        topBar = { GoldenHeaderBanner() },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.loadData() },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {

                // Sync Status Indicator
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onNavigateToSync),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = NavyDark),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(CircleShape)
                                    .background(if (syncStatus?.isOnline == true) BalanceReceivable else Color(0xFFD97706))
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                val stateTitle = if (syncStatus?.isOnline == true) "متصل بالسحابة — تحديث مباشر" else "عرض بيانات محفوظة (Offline)"
                                Text(
                                    text = stateTitle,
                                    style = MaterialTheme.typography.labelMedium.copy(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                val isSandbox = com.goldenwolfeg.accountingmobile.BuildConfig.FLAVOR.equals("sandbox", ignoreCase = true)
                                val subText = if (isSandbox) "بيئة اختبار Sandbox" else "الربط مع Golden Accounting System"
                                Text(
                                    text = subText,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = GoldBright
                                    )
                                )
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "حالة الاتصال",
                                style = MaterialTheme.typography.labelSmall.copy(color = Color.White.copy(alpha = 0.85f))
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Main Net Balance Prominent Card
                val net = summary?.netBalance ?: java.math.BigDecimal.ZERO
                val (netBgColor, netTextColor, netStatusText) = when {
                    net > java.math.BigDecimal.ZERO -> Triple(BalanceReceivable.copy(alpha = 0.12f), BalanceReceivable, "صافي مستحق لنا على الأطراف")
                    net < java.math.BigDecimal.ZERO -> Triple(BalancePayable.copy(alpha = 0.12f), BalancePayable, "صافي مستحق للأطراف علينا")
                    else -> Triple(BalanceBalanced.copy(alpha = 0.12f), BalanceBalanced, "إجمالي الحسابات متزن")
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountBalanceWallet,
                                contentDescription = null,
                                tint = GoldMetallic,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "الرصيد الصافي الموحد (Net Balance)",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = formatCurrency(net, curr),
                            style = MaterialTheme.typography.displaySmall.copy(
                                fontWeight = FontWeight.Black,
                                color = netTextColor
                            )
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Surface(
                            color = netBgColor,
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Text(
                                text = netStatusText,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.labelMedium.copy(
                                    color = netTextColor,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Summary Stats Grid (Receivables & Payables)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SummaryStatCard(
                        title = "مستحق لنا (ديون)",
                        value = summary?.totalReceivables ?: java.math.BigDecimal.ZERO,
                        subtitle = "الأرصدة الموجبة",
                        accentColor = BalanceReceivable,
                        icon = Icons.AutoMirrored.Filled.CallReceived,
                        modifier = Modifier.weight(1f),
                        currencySymbol = curr
                    )

                    SummaryStatCard(
                        title = "مستحق علينا (التزامات)",
                        value = summary?.totalPayables ?: java.math.BigDecimal.ZERO,
                        subtitle = "الأرصدة السالبة",
                        accentColor = BalancePayable,
                        icon = Icons.AutoMirrored.Filled.CallMade,
                        modifier = Modifier.weight(1f),
                        currencySymbol = curr
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Quick Access Button to Parties List
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onNavigateToParties),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = NavyPrimary),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(GoldMetallic.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Group,
                                    contentDescription = null,
                                    tint = GoldBright,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    text = "دليل الأطراف والحسابات الموحدة",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = "عرض العملاء، الموردين، والمزدوجين (${summary?.totalParties ?: 0} طرف)",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = GoldBright
                                    )
                                )
                            }
                        }

                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Parties Breakdown Cards
                Text(
                    text = "تصنيف الأطراف المسجلة",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    PartiesCountCard(
                        title = "العملاء",
                        count = summary?.customersCount ?: 0,
                        icon = Icons.Default.Person,
                        accentColor = Color(0xFF1D4ED8),
                        modifier = Modifier.weight(1f)
                    )

                    PartiesCountCard(
                        title = "الموردون",
                        count = summary?.suppliersCount ?: 0,
                        icon = Icons.Default.Business,
                        accentColor = Color(0xFFB45309),
                        modifier = Modifier.weight(1f)
                    )

                    PartiesCountCard(
                        title = "عميل ومورد",
                        count = summary?.bothCount ?: 0,
                        icon = Icons.Default.Sync,
                        accentColor = Color(0xFF7E22CE),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun PartiesCountCard(
    title: String,
    count: Int,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = accentColor,
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            )
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }
    }
}
