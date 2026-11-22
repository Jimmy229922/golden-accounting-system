package com.goldenwolfeg.accountingmobile.ui.screens

import android.widget.Toast
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.goldenwolfeg.accountingmobile.ui.components.AccountingTopBar
import com.goldenwolfeg.accountingmobile.ui.components.BalanceStatusBadge
import com.goldenwolfeg.accountingmobile.ui.components.LedgerEntryCard
import com.goldenwolfeg.accountingmobile.ui.components.ShimmerCardItem
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceBalanced
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.LedgerDateRange
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartyDetailsViewModel
import java.math.BigDecimal

@OptIn(ExperimentalMaterial3Api::class)
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

    Scaffold(
        topBar = {
            AccountingTopBar(
                title = "كشف حساب موحد",
                subtitle = party?.name ?: "",
                onBackClick = onBackClick
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
                // Ledger Header Summary Card
                Surface(
                    color = NavyDark,
                    shadowElevation = 4.dp
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
                            Column {
                                Text(
                                    text = "اسم الطرف: ${party?.name ?: "-"}",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = "كود الطرف: ${party?.code ?: "-"} | النوع: ${party?.type?.label ?: "-"}",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = GoldBright
                                    )
                                )
                            }

                            BalanceStatusBadge(balance = currentBalance)
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(Color.White.copy(alpha = 0.2f))
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "الرصيد الصافي النهائي:",
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
                                        else -> BalanceBalanced
                                    }
                                )
                            )
                        }
                    }
                }

                // Date Range Filter Chips Bar
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 2.dp
                ) {
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
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
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = NavyDark,
                                    selectedLabelColor = GoldBright,
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                                    labelColor = MaterialTheme.colorScheme.onSurface
                                )
                            )
                        }
                    }
                }

                // Ledger Transactions List or Shimmer Skeletons
                if (ledgerEntries.isEmpty() && isRefreshing) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(3) {
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
                        Text(
                            text = "لا توجد حركة سابقة مسجلة في التفتيش الزمني المحدد.",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item {
                            Text(
                                text = "سجل الحركات والأرصدة التراكمية (${ledgerEntries.size} حركة):",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                ),
                                modifier = Modifier.padding(bottom = 4.dp)
                            )
                        }

                        items(ledgerEntries, key = { it.ledgerId }) { entry ->
                            LedgerEntryCard(entry = entry, currencySymbol = "ج.م")
                        }

                        item {
                            Spacer(modifier = Modifier.height(8.dp))
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                color = NavyPrimary.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = "تم استخراج هذا السجل من برنامج Golden Accounting System (نسخة القراءة فقط).",
                                    modifier = Modifier.padding(12.dp),
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
