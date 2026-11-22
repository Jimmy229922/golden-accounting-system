package com.goldenwolfeg.accountingmobile.ui.screens

import android.content.Intent
import android.widget.Toast
import androidx.compose.material.icons.filled.PictureAsPdf
import com.goldenwolfeg.accountingmobile.ui.util.LedgerPdfExporter
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.ui.components.AccountingTopBar
import com.goldenwolfeg.accountingmobile.ui.components.LedgerEntryCard
import com.goldenwolfeg.accountingmobile.ui.components.ShimmerCardItem
import com.goldenwolfeg.accountingmobile.ui.components.formatArabicDocType
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceBalanced
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientEnd
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientStart
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.LedgerDateRange
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartyDetailsViewModel
import java.math.BigDecimal

@Composable
fun PartyLedgerScreen(
    viewModel: PartyDetailsViewModel,
    onBackClick: () -> Unit
) {
    val party by viewModel.party.collectAsState()
    val ledgerEntries by viewModel.ledgerEntries.collectAsState()
    val selectedDateRange by viewModel.selectedDateRange.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val refreshMessage by viewModel.refreshMessage.collectAsState()

    val context = LocalContext.current

    LaunchedEffect(refreshMessage) {
        refreshMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearRefreshMessage()
        }
    }

    val currentBalance = party?.balance ?: BigDecimal.ZERO

    // Calculate statement totals for period
    val (positiveEffectsSum, negativeEffectsSum) = remember(ledgerEntries) {
        var pos = BigDecimal.ZERO
        var neg = BigDecimal.ZERO
        for (e in ledgerEntries) {
            if (e.effectAmount > BigDecimal.ZERO) {
                pos = pos.add(e.effectAmount)
            } else if (e.effectAmount < BigDecimal.ZERO) {
                neg = neg.add(e.effectAmount.abs())
            }
        }
        Pair(pos, neg)
    }

    Scaffold(
        topBar = {
            AccountingTopBar(
                title = "كشف حساب تفصيلي موحد",
                subtitle = party?.name ?: "",
                onBackClick = onBackClick,
                actions = {
                    IconButton(
                        onClick = {
                            val p = party ?: return@IconButton
                            LedgerPdfExporter.exportAndShare(context, p, ledgerEntries)
                                .onFailure { err ->
                                    Toast.makeText(context, "تعذر تصدير PDF: ${err.message}", Toast.LENGTH_SHORT).show()
                                }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.PictureAsPdf,
                            contentDescription = "تصدير ومشاركة PDF",
                            tint = Color(0xFFFCA5A5)
                        )
                    }
                    IconButton(
                        onClick = {
                            val p = party ?: return@IconButton
                            val sb = StringBuilder()
                            sb.appendLine("📋 كشف حساب تفصيلي موحد - نظام الجولدن المحاسبي")
                            sb.appendLine("اسم الطرف: ${p.name}")
                            sb.appendLine("الكود: ${p.code} | تصنيف الحساب: ${p.type.label}")
                            val statusText = when {
                                p.balance > BigDecimal.ZERO -> "مستحق لنا (مدين)"
                                p.balance < BigDecimal.ZERO -> "مستحق علينا (دائن)"
                                else -> "الحساب متزن بالكامل"
                            }
                            sb.appendLine("الرصيد الصافي النهائي: ${formatCurrency(p.balance)} ($statusText)")
                            sb.appendLine("الفترة الزمنية: ${selectedDateRange.label}")
                            sb.appendLine("عدد الحركات المسجلة: ${ledgerEntries.size} حركة")
                            sb.appendLine("──────────────────────────────────")
                            ledgerEntries.forEachIndexed { index, e ->
                                val arabicType = formatArabicDocType(e.docType)
                                val docLabel = if (e.docNumber.isNotBlank()) "$arabicType (#${e.docNumber})" else arabicType
                                val effectStr = when {
                                    e.effectAmount > BigDecimal.ZERO -> "+ ${formatCurrency(e.effectAmount)}"
                                    e.effectAmount < BigDecimal.ZERO -> "- ${formatCurrency(e.effectAmount.abs())}"
                                    else -> "0.00 ج.م"
                                }
                                sb.appendLine("${index + 1}. ${e.transDate} | $docLabel")
                                sb.appendLine("   المبلغ الإجمالي: ${formatCurrency(e.totalAmount)} | المسدد: ${formatCurrency(e.paidAmount)}")
                                sb.appendLine("   الأثر الصافي: $effectStr | الرصيد التراكمي: ${formatCurrency(e.runningBalance)}")
                                if (!e.notes.isNullOrBlank()) {
                                    sb.appendLine("   ملاحظات: ${e.notes}")
                                }
                                sb.appendLine("──────────────────────────────────")
                            }
                            sb.appendLine("صادر من نظام الجولدن المحاسبي Golden Accounting System")
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, "كشف حساب تفصيلي - ${p.name}")
                                putExtra(Intent.EXTRA_TEXT, sb.toString())
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "مشاركة كشف الحساب"))
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "مشاركة كشف الحساب",
                            tint = GoldBright
                        )
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refreshPartyData() },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                // Header Statement Banner Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(bottomStart = 20.dp, bottomEnd = 20.dp),
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
                            .padding(18.dp)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
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
                                            .size(42.dp)
                                            .clip(CircleShape)
                                            .background(
                                                Brush.linearGradient(
                                                    colors = listOf(GoldGradientStart, GoldGradientEnd)
                                                )
                                            ),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Receipt,
                                            contentDescription = null,
                                            tint = NavyDark,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }

                                    Spacer(modifier = Modifier.width(12.dp))

                                    Column {
                                        Text(
                                            text = party?.name ?: "-",
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold
                                            )
                                        )
                                        Text(
                                            text = "كود الطرف: ${party?.code ?: "-"} | تصنيف الحساب: ${party?.type?.label ?: "-"}",
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = GoldBright
                                            )
                                        )
                                    }
                                }

                                val (statusBg, statusTextColor, statusLabel) = when {
                                    currentBalance > BigDecimal.ZERO -> Triple(BalanceReceivable.copy(alpha = 0.2f), BalanceReceivable, "مستحق لنا (مدين)")
                                    currentBalance < BigDecimal.ZERO -> Triple(BalancePayable.copy(alpha = 0.2f), BalancePayable, "مستحق علينا (دائن)")
                                    else -> Triple(BalanceBalanced.copy(alpha = 0.2f), BalanceBalanced, "الحساب متزن")
                                }

                                Surface(
                                    color = statusBg,
                                    shape = RoundedCornerShape(16.dp),
                                    border = BorderStroke(1.dp, statusTextColor.copy(alpha = 0.4f))
                                ) {
                                    Text(
                                        text = statusLabel,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = statusTextColor,
                                            fontWeight = FontWeight.Bold
                                        )
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(Color.White.copy(alpha = 0.15f))
                            )
                            Spacer(modifier = Modifier.height(12.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "الرصيد التراكمي النهائي:",
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        color = Color.White.copy(alpha = 0.9f)
                                    )
                                )

                                Text(
                                    text = formatCurrency(currentBalance, "ج.م"),
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.Black,
                                        color = when {
                                            currentBalance > BigDecimal.ZERO -> BalanceReceivable
                                            currentBalance < BigDecimal.ZERO -> BalancePayable
                                            else -> Color.White
                                        },
                                        fontSize = 20.sp
                                    )
                                )
                            }
                        }
                    }
                }

                // Date Range Filters Bar
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 2.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = "تصفية كشف الحساب حسب الفترة الزمنية:",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Spacer(modifier = Modifier.height(6.dp))

                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(LedgerDateRange.entries.toTypedArray()) { range ->
                                val isSelected = range == selectedDateRange
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { viewModel.onDateRangeSelected(range) },
                                    label = {
                                        Text(
                                            text = range.label,
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                            )
                                        )
                                    },
                                    shape = RoundedCornerShape(20.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = NavyDark,
                                        selectedLabelColor = GoldBright,
                                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
                                        labelColor = MaterialTheme.colorScheme.onSurface
                                    )
                                )
                            }
                        }
                    }
                }

                // Financial Movement Summary Box for Selected Range
                if (ledgerEntries.isNotEmpty()) {
                    Surface(
                        color = NavyPrimary.copy(alpha = 0.06f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Assessment,
                                    contentDescription = null,
                                    tint = NavyPrimary,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "زيادات الرصيد (+): ${formatCurrency(positiveEffectsSum, "ج.م")}",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = BalanceReceivable,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }

                            Text(
                                text = "التسديدات والتحصيلات (-): ${formatCurrency(negativeEffectsSum, "ج.م")}",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = BalancePayable,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }
                    }
                }

                // Ledger Entries Timeline List
                if (ledgerEntries.isEmpty() && isRefreshing) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(4) {
                            ShimmerCardItem()
                        }
                    }
                } else if (ledgerEntries.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Receipt,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(42.dp)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "لا توجد حركة مسجلة في هذه الفترة الزمنية.",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                )
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item {
                            Text(
                                text = "سجل حركات كشف الحساب (${ledgerEntries.size} حركة):",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                ),
                                modifier = Modifier.padding(bottom = 2.dp)
                            )
                        }

                        items(ledgerEntries, key = { it.ledgerId }) { entry ->
                            LedgerEntryCard(entry = entry, currencySymbol = "ج.م")
                        }

                        item {
                            Spacer(modifier = Modifier.height(8.dp))
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                color = NavyDark.copy(alpha = 0.05f),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = NavyPrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "هذا كشف حساب تفصيلي موحد ومطابق لسجلات برنامج Golden Accounting System.",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            fontWeight = FontWeight.Medium
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
