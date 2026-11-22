package com.goldenwolfeg.accountingmobile.ui.screens

import android.widget.Toast
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.ui.components.AccountingTopBar
import com.goldenwolfeg.accountingmobile.ui.components.PartyCard
import com.goldenwolfeg.accountingmobile.ui.components.ShimmerCardItem
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldMetallic
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.BalanceFilterType
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartiesViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartyFilterType
import java.math.BigDecimal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PartiesListScreen(
    viewModel: PartiesViewModel,
    onPartyClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedFilter by viewModel.selectedFilter.collectAsState()
    val selectedBalanceFilter by viewModel.selectedBalanceFilter.collectAsState()
    val filteredParties by viewModel.filteredParties.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val refreshMessage by viewModel.refreshMessage.collectAsState()

    val context = LocalContext.current
    val listState = rememberLazyListState()

    LaunchedEffect(refreshMessage) {
        refreshMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearRefreshMessage()
        }
    }

    val totalFilteredBalance = remember(filteredParties) {
        filteredParties.fold(BigDecimal.ZERO) { acc, p -> acc.add(p.balance) }
    }

    Scaffold(
        topBar = {
            AccountingTopBar(
                title = "دليل الأطراف والحسابات",
                subtitle = "العملاء، الموردين والأطراف المزدوجة",
                onBackClick = onBackClick
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refreshData() },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                // Search Bar & Filters Section
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 2.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp)
                    ) {
                        // Search Field
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = viewModel::onSearchQueryChanged,
                            placeholder = { Text("ابحث بالاسم، الكود، أو رقم الهاتف...") },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = null,
                                    tint = NavyPrimary
                                )
                            },
                            trailingIcon = {
                                if (searchQuery.isNotEmpty()) {
                                    IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                        Icon(
                                            imageVector = Icons.Default.Clear,
                                            contentDescription = "مسح"
                                        )
                                    }
                                }
                            },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GoldMetallic,
                                unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Type Filter Chips
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(PartyFilterType.entries.toTypedArray()) { filter ->
                                val isSelected = filter == selectedFilter
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { viewModel.onFilterSelected(filter) },
                                    label = {
                                        Text(
                                            text = filter.label,
                                            style = MaterialTheme.typography.labelMedium.copy(
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

                        Spacer(modifier = Modifier.height(6.dp))

                        // Smart Balance Filter Chips
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(BalanceFilterType.entries.toTypedArray()) { bFilter ->
                                val isSelected = bFilter == selectedBalanceFilter
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { viewModel.onBalanceFilterSelected(bFilter) },
                                    label = {
                                        Text(
                                            text = bFilter.label,
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                            )
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = BalanceReceivable,
                                        selectedLabelColor = androidx.compose.ui.graphics.Color.White,
                                        containerColor = NavyPrimary.copy(alpha = 0.08f),
                                        labelColor = MaterialTheme.colorScheme.onSurface
                                    )
                                )
                            }
                        }
                    }
                }

                // Results Counter Bar
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
                        Text(
                            text = "عدد النتائج: ${filteredParties.size}",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        )
                        Text(
                            text = "صافي أرصدة القائمة: ${formatCurrency(totalFilteredBalance, "ج.م")}",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontWeight = FontWeight.Black,
                                color = NavyDark
                            )
                        )
                    }
                }

                // Parties List or Shimmer Skeletons
                if (filteredParties.isEmpty() && isRefreshing) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(4) {
                            ShimmerCardItem()
                        }
                    }
                } else if (filteredParties.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (searchQuery.isBlank())
                                "لا توجد أطراف مطابقة للفلاتر المحددة."
                            else
                                "لا توجد نتائج مطابقة للبحث أو التصنيف المحدد.",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                lineHeight = 22.sp
                            )
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredParties, key = { it.id }) { party ->
                            PartyCard(
                                party = party,
                                onClick = { onPartyClick(party.id) },
                                currencySymbol = "ج.م"
                            )
                        }
                    }
                }
            }
        }
    }
}
