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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.ui.components.AccountingTopBar
import com.goldenwolfeg.accountingmobile.ui.components.BalanceStatusBadge
import com.goldenwolfeg.accountingmobile.ui.components.LedgerEntryCard
import com.goldenwolfeg.accountingmobile.ui.components.PartyTypeBadge
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceBalanced
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartyDetailsViewModel
import java.math.BigDecimal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PartyDetailsScreen(
    viewModel: PartyDetailsViewModel,
    onNavigateToLedger: (String) -> Unit,
    onBackClick: () -> Unit
) {
    val party by viewModel.party.collectAsState()
    val ledgerEntries by viewModel.ledgerEntries.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val refreshMessage by viewModel.refreshMessage.collectAsState()

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
                title = party?.name ?: "تفاصيل الطرف",
                subtitle = if (party != null) "كود الطرف: ${party?.code}" else "جارٍ التحميل...",
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
            if (party == null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        color = NavyPrimary,
                        modifier = Modifier.size(36.dp)
                    )
                }
            } else {
                val p = party!!
                val (balanceBgColor, balanceTextColor) = when {
                    p.balance > BigDecimal.ZERO -> BalanceReceivable.copy(alpha = 0.12f) to BalanceReceivable
                    p.balance < BigDecimal.ZERO -> BalancePayable.copy(alpha = 0.12f) to BalancePayable
                    else -> BalanceBalanced.copy(alpha = 0.12f) to BalanceBalanced
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp)
                ) {
                    // Party Info Card
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
                                            .size(48.dp)
                                            .clip(CircleShape)
                                            .background(NavyDark),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = p.code.takeLast(3),
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                color = GoldBright,
                                                fontWeight = FontWeight.Bold
                                            )
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = p.name,
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.onSurface
                                            )
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = "الكود: ${p.code}",
                                                style = MaterialTheme.typography.bodySmall.copy(
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            PartyTypeBadge(type = p.type)
                                        }
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

                            // Details Rows
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Call,
                                    contentDescription = null,
                                    tint = NavyPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "رقم الهاتف: ${if (p.phone.isNotBlank()) p.phone else "غير مسجل"}",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.LocationOn,
                                    contentDescription = null,
                                    tint = NavyPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "العنوان: ${if (p.address.isNotBlank()) p.address else "غير مسجل"}",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Business,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "تاريخ آخر حركة: ${if (p.lastTransactionDate.isNotBlank()) p.lastTransactionDate else "لا توجد حركات"}",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Prominent Net Balance Card
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "الرصيد الصافي الموحد للطرف",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Medium
                                )
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = formatCurrency(p.balance, "ج.م"),
                                style = MaterialTheme.typography.displaySmall.copy(
                                    fontWeight = FontWeight.Black,
                                    color = balanceTextColor
                                )
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            BalanceStatusBadge(balance = p.balance)

                            Spacer(modifier = Modifier.height(16.dp))

                            // Explanatory Principle
                            Surface(
                                color = balanceBgColor,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Info,
                                        contentDescription = null,
                                        tint = balanceTextColor,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    val directionText = when {
                                        p.balance > BigDecimal.ZERO -> "مستحق لنا على الطرف"
                                        p.balance < BigDecimal.ZERO -> "مستحق للطرف علينا"
                                        else -> "الحساب متزن"
                                    }
                                    Text(
                                        text = "اتجاه المديونية: $directionText (حساب مالي موحد مطابق لدفتر الأستاذ party_ledger ببرنامج الكمبيوتر).",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = balanceTextColor,
                                            lineHeight = 16.sp
                                        )
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Action Button to View Ledger
                    Button(
                        onClick = { onNavigateToLedger(p.id) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NavyDark,
                            contentColor = GoldBright
                        )
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ReceiptLong,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "عرض كشف الحساب التفصيلي الموحد",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Recent Ledger Entries Preview
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "آخر الحركات المالية",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        )

                        OutlinedButton(
                            onClick = { onNavigateToLedger(p.id) },
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "عرض الكل",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    color = NavyPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (ledgerEntries.isEmpty()) {
                        Text(
                            text = "لا توجد حركات مسجلة حالياً.",
                            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                        )
                    } else {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            ledgerEntries.take(3).forEach { entry ->
                                LedgerEntryCard(entry = entry, currencySymbol = "ج.م")
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}
