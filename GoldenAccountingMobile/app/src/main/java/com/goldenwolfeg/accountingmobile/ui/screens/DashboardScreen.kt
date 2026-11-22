package com.goldenwolfeg.accountingmobile.ui.screens

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.ui.components.GoldenBottomNavBar
import com.goldenwolfeg.accountingmobile.ui.components.GoldenHeaderBanner
import com.goldenwolfeg.accountingmobile.ui.components.LogoutConfirmDialog
import com.goldenwolfeg.accountingmobile.ui.components.Quadruple
import com.goldenwolfeg.accountingmobile.ui.components.ShimmerCardItem
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceBalanced
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientEnd
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientStart
import com.goldenwolfeg.accountingmobile.ui.theme.GoldMetallic
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.DashboardViewModel
import java.math.BigDecimal

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToParties: () -> Unit,
    onNavigateToSync: () -> Unit,
    onLogout: () -> Unit = {}
) {
    val summary by viewModel.summary.collectAsState()
    val syncStatus by viewModel.syncStatus.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val refreshMessage by viewModel.refreshMessage.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current

    DisposableEffect(context) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        var isInitialCallback = true
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                if (isInitialCallback) {
                    isInitialCallback = false
                    return
                }
                viewModel.loadData()
            }

            override fun onLost(network: Network) {
                isInitialCallback = false
            }
        }
        try {
            cm?.registerDefaultNetworkCallback(callback)
        } catch (_: Exception) {}
        onDispose {
            try {
                cm?.unregisterNetworkCallback(callback)
            } catch (_: Exception) {}
        }
    }

    LaunchedEffect(refreshMessage) {
        refreshMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearRefreshMessage()
        }
    }

    val curr = summary?.currencySymbol ?: "ج.م"

    Scaffold(
        topBar = {
            GoldenHeaderBanner(
                isOnline = syncStatus?.isOnline,
                onLogoutClick = { showLogoutDialog = true }
            )
        },
        bottomBar = {
            GoldenBottomNavBar(
                currentRoute = "dashboard",
                onNavigate = { route ->
                    when (route) {
                        "parties_list" -> onNavigateToParties()
                        "sync_status" -> onNavigateToSync()
                    }
                }
            )
        },
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
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {

                // 1. Live Sync Status Indicator Header Card
                SyncStatusBannerCard(
                    isOnline = syncStatus?.isOnline == true,
                    lastSyncTime = syncStatus?.lastSyncTime,
                    onClick = onNavigateToSync
                )

                if (summary == null && isRefreshing) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ShimmerCardItem()
                        ShimmerCardItem()
                        ShimmerCardItem()
                    }
                } else {
                    // 2. Executive Financial Summary Hero Card (الرصيد الصافي الموحد)
                    ExecutiveBalanceHeroCard(
                        summary = summary,
                        currencySymbol = curr
                    )

                    // 3. Financial Flow Cards (المستحقات والالتزامات)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        FinancialAssetCard(
                            title = "مستحق لنا (ديون)",
                            amount = summary?.totalReceivables ?: BigDecimal.ZERO,
                            subtitle = "أرصدة الأطراف المدينة",
                            accentColor = BalanceReceivable,
                            icon = Icons.AutoMirrored.Filled.CallReceived,
                            modifier = Modifier.weight(1f),
                            currencySymbol = curr
                        )

                        FinancialAssetCard(
                            title = "مستحق علينا (التزامات)",
                            amount = summary?.totalPayables ?: BigDecimal.ZERO,
                            subtitle = "أرصدة الموردين الدائنة",
                            accentColor = BalancePayable,
                            icon = Icons.AutoMirrored.Filled.CallMade,
                            modifier = Modifier.weight(1f),
                            currencySymbol = curr
                        )
                    }

                    // 4. Quick Action Hub (الوصول السريع والإجراءات)
                    Text(
                        text = "الوصول السريع والإجراءات",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        ),
                        modifier = Modifier.padding(top = 4.dp)
                    )

                    QuickActionCard(
                        title = "دليل الأطراف والحسابات الموحدة",
                        subtitle = "عرض وتصفية العملاء والموردين (${summary?.totalParties ?: 0} طرف)",
                        icon = Icons.Default.Group,
                        accentGradient = listOf(NavyDark, NavyPrimary),
                        onClick = onNavigateToParties
                    )

                    // 5. Parties Breakdown Categories (توزيع الأطراف)
                    Text(
                        text = "تصنيف الأطراف المسجلة",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        ),
                        modifier = Modifier.padding(top = 4.dp)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CategoryStatCard(
                            title = "العملاء",
                            count = summary?.customersCount ?: 0,
                            subtitle = "مدينون",
                            icon = Icons.Default.Person,
                            color = Color(0xFF2563EB),
                            modifier = Modifier
                                .weight(1f)
                                .clickable(onClick = onNavigateToParties)
                        )

                        CategoryStatCard(
                            title = "الموردون",
                            count = summary?.suppliersCount ?: 0,
                            subtitle = "دائنون",
                            icon = Icons.Default.Business,
                            color = Color(0xFFD97706),
                            modifier = Modifier
                                .weight(1f)
                                .clickable(onClick = onNavigateToParties)
                        )

                        CategoryStatCard(
                            title = "عميل ومورد",
                            count = summary?.bothCount ?: 0,
                            subtitle = "مشترك",
                            icon = Icons.Default.Sync,
                            color = Color(0xFF8B5CF6),
                            modifier = Modifier
                                .weight(1f)
                                .clickable(onClick = onNavigateToParties)
                        )
                    }

                    // 6. System Info Footer Card
                    SystemInfoFooterCard(
                        syncStatus = syncStatus,
                        isRefreshing = isRefreshing,
                        onRefreshClick = { viewModel.loadData() }
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    if (showLogoutDialog) {
        LogoutConfirmDialog(
            onDismiss = { showLogoutDialog = false },
            onConfirm = {
                showLogoutDialog = false
                viewModel.logout(onLogout)
            }
        )
    }
}

// ------------------- Custom Redesigned Components -------------------

@Composable
fun SyncStatusBannerCard(
    isOnline: Boolean,
    lastSyncTime: String?,
    onClick: () -> Unit
) {
    val bgGradient = if (isOnline) {
        listOf(NavyDark, Color(0xFF0F291E))
    } else {
        listOf(NavyDark, Color(0xFF2D1808))
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, if (isOnline) BalanceReceivable.copy(alpha = 0.4f) else Color(0xFFF59E0B).copy(alpha = 0.4f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.horizontalGradient(bgGradient))
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(
                                if (isOnline) BalanceReceivable.copy(alpha = 0.2f) else Color(0xFFF59E0B).copy(alpha = 0.2f)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (isOnline) Icons.Default.CloudDone else Icons.Default.WifiOff,
                            contentDescription = null,
                            tint = if (isOnline) BalanceReceivable else Color(0xFFF59E0B),
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        val stateTitle = if (isOnline) "متصل بالسحابة — تحديث مباشر" else "وضع عدم الاتصال (Offline)"
                        Text(
                            text = stateTitle,
                            style = MaterialTheme.typography.titleSmall.copy(
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        )

                        val subText = if (!lastSyncTime.isNullOrBlank()) {
                            "آخر مزامنة: $lastSyncTime"
                        } else {
                            if (isOnline) "تزامن تلقائي مع خادم الجولدن" else "عرض البيانات المحفوظة محلياً"
                        }
                        Text(
                            text = subText,
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = GoldBright
                            )
                        )
                    }
                }

                Surface(
                    color = Color.White.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "التفاصيل",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ExecutiveBalanceHeroCard(
    summary: com.goldenwolfeg.accountingmobile.data.model.FinancialSummary?,
    currencySymbol: String
) {
    val net = summary?.netBalance ?: BigDecimal.ZERO
    val rec = summary?.totalReceivables ?: BigDecimal.ZERO
    val pay = summary?.totalPayables ?: BigDecimal.ZERO

    val totalVolume = rec.add(pay.abs())
    val recRatio = if (totalVolume > BigDecimal.ZERO) {
        (rec.toDouble() / totalVolume.toDouble()).coerceIn(0.0, 1.0).toFloat()
    } else 0.5f

    val recPercentage = (recRatio * 100).toInt()
    val payPercentage = 100 - recPercentage

    val (statusBg, statusTextColor, statusText, statusIcon) = when {
        net > BigDecimal.ZERO -> Quadruple(
            BalanceReceivable.copy(alpha = 0.16f),
            BalanceReceivable,
            "صافي مستحق لنا (فائض لصالحنا)",
            Icons.AutoMirrored.Filled.TrendingUp
        )
        net < BigDecimal.ZERO -> Quadruple(
            BalancePayable.copy(alpha = 0.16f),
            BalancePayable,
            "صافي مستحق علينا (عجز / التزامات)",
            Icons.AutoMirrored.Filled.TrendingDown
        )
        else -> Quadruple(
            BalanceBalanced.copy(alpha = 0.16f),
            BalanceBalanced,
            "إجمالي المركز المالي متزن بالكامل",
            Icons.Default.CheckCircle
        )
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, GoldMetallic.copy(alpha = 0.35f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(NavyDark, NavyPrimary)
                    )
                )
                .padding(20.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Card Header Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(GoldGradientStart, GoldGradientEnd)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountBalanceWallet,
                                contentDescription = null,
                                tint = NavyDark,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "المركز المالي الصافي",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            ),
                            maxLines = 1
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Surface(
                        color = GoldMetallic.copy(alpha = 0.18f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "تحديث حي",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = GoldBright,
                                fontWeight = FontWeight.Bold
                            ),
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Big Net Balance Display
                Text(
                    text = formatCurrency(net, currencySymbol),
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontWeight = FontWeight.Black,
                        fontSize = 32.sp,
                        color = statusTextColor
                    ),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Status Pill
                Surface(
                    color = statusBg,
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, statusTextColor.copy(alpha = 0.4f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = statusIcon,
                            contentDescription = null,
                            tint = statusTextColor,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = statusTextColor,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Divider Line
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(Color.White.copy(alpha = 0.12f))
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Asset vs Liability Visual Progress Ratio Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Assessment,
                            contentDescription = null,
                            tint = GoldBright,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "مؤشر توزيع الحسابات والذمم",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = Color.White.copy(alpha = 0.9f),
                                fontWeight = FontWeight.Medium
                            )
                        )
                    }

                    Text(
                        text = "$recPercentage% مستحق لنا | $payPercentage% علينا",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = GoldBright,
                            fontWeight = FontWeight.Bold
                        )
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Custom Two-Color Ratio Progress Bar
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(BalancePayable)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(recRatio)
                            .height(10.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(BalanceReceivable)
                    )
                }
            }
        }
    }
}

@Composable
fun FinancialAssetCard(
    title: String,
    amount: BigDecimal,
    subtitle: String,
    accentColor: Color,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    currencySymbol: String
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.25f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(accentColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Surface(
                    color = accentColor.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = if (accentColor == BalanceReceivable) "مدين" else "دائن",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = accentColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = formatCurrency(amount, currencySymbol),
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Black,
                    color = accentColor,
                    fontSize = 18.sp
                ),
                maxLines = 1
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                    fontSize = 10.sp
                )
            )
        }
    }
}

@Composable
fun QuickActionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accentGradient: List<Color>,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.horizontalGradient(accentGradient))
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(GoldGradientStart, GoldGradientEnd)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = NavyDark,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = GoldBright
                            )
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun CategoryStatCard(
    title: String,
    count: Int,
    subtitle: String,
    icon: ImageVector,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, color.copy(alpha = 0.2f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = count.toString(),
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface
                )
            )

            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            )

            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp
                )
            )
        }
    }
}

@Composable
fun SystemInfoFooterCard(
    syncStatus: com.goldenwolfeg.accountingmobile.data.model.SyncStatus?,
    isRefreshing: Boolean,
    onRefreshClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Sync,
                        contentDescription = null,
                        tint = GoldMetallic,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "معلومات الخادم والتزامن",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    )
                }

                IconButton(
                    onClick = onRefreshClick,
                    enabled = !isRefreshing,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "تحديث",
                        tint = GoldMetallic,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )
            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "حالة الاتصال",
                        style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                    )
                    Text(
                        text = syncStatus?.syncState ?: "جاهز",
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold)
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "آخر جلب للبيانات",
                        style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                    )
                    val fetchTime = syncStatus?.lastFetchTime
                    Text(
                        text = if (!fetchTime.isNullOrEmpty()) fetchTime else "الآن",
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold)
                    )
                }
            }
        }
    }
}
