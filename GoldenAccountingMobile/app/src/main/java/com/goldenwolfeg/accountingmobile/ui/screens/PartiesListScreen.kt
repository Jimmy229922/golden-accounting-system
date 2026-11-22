package com.goldenwolfeg.accountingmobile.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.data.model.Party
import com.goldenwolfeg.accountingmobile.data.model.PartyType
import com.goldenwolfeg.accountingmobile.ui.components.AccountingTopBar
import com.goldenwolfeg.accountingmobile.ui.components.ShimmerCardItem
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceBalanced
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldMetallic
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import com.goldenwolfeg.accountingmobile.ui.viewmodel.BalanceFilterType
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartiesViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartyFilterType
import java.math.BigDecimal

enum class PartySortOption(val label: String) {
    DEFAULT("الافتراضي"),
    HIGHEST_RECEIVABLE("الأعلى ديون لنا"),
    HIGHEST_PAYABLE("الأعلى التزامات علينا"),
    NAME_ASC("الاسم أبجدي")
}

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

    var currentSort by remember { mutableStateOf(PartySortOption.DEFAULT) }

    val context = LocalContext.current
    val listState = rememberLazyListState()

    LaunchedEffect(refreshMessage) {
        refreshMessage?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearRefreshMessage()
        }
    }

    // Sort parties client-side for smooth performance
    val sortedParties = remember(filteredParties, currentSort) {
        when (currentSort) {
            PartySortOption.DEFAULT -> filteredParties
            PartySortOption.HIGHEST_RECEIVABLE -> filteredParties.sortedByDescending { it.balance }
            PartySortOption.HIGHEST_PAYABLE -> filteredParties.sortedBy { it.balance }
            PartySortOption.NAME_ASC -> filteredParties.sortedBy { it.name }
        }
    }

    // Financial calculations for the current view
    val (totalNet, totalReceivables, totalPayables) = remember(sortedParties) {
        var net = BigDecimal.ZERO
        var rec = BigDecimal.ZERO
        var pay = BigDecimal.ZERO
        for (p in sortedParties) {
            net = net.add(p.balance)
            if (p.balance > BigDecimal.ZERO) {
                rec = rec.add(p.balance)
            } else if (p.balance < BigDecimal.ZERO) {
                pay = pay.add(p.balance.abs())
            }
        }
        Triple(net, rec, pay)
    }

    Scaffold(
        topBar = {
            AccountingTopBar(
                title = "دليل الأطراف والحسابات",
                subtitle = "العملاء، الموردين، والحسابات المزدوجة",
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
                // Header Search & Filters Panel
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 3.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    ) {
                        // Search Input Field
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
                                            contentDescription = "مسح",
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GoldMetallic,
                                unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant,
                                focusedContainerColor = MaterialTheme.colorScheme.surface,
                                unfocusedContainerColor = MaterialTheme.colorScheme.surface
                            ),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Category Type Filter Carousel
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(PartyFilterType.entries.toTypedArray()) { filter ->
                                val isSelected = filter == selectedFilter
                                val chipColor = when (filter) {
                                    PartyFilterType.ALL -> NavyDark
                                    PartyFilterType.CUSTOMER -> Color(0xFF2563EB)
                                    PartyFilterType.SUPPLIER -> Color(0xFFD97706)
                                    PartyFilterType.BOTH -> Color(0xFF8B5CF6)
                                }

                                FilterChip(
                                    selected = isSelected,
                                    onClick = { viewModel.onFilterSelected(filter) },
                                    label = {
                                        Text(
                                            text = filter.label,
                                            style = MaterialTheme.typography.labelMedium.copy(
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                            )
                                        )
                                    },
                                    shape = RoundedCornerShape(20.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = chipColor,
                                        selectedLabelColor = Color.White,
                                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
                                        labelColor = MaterialTheme.colorScheme.onSurface
                                    )
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        // Financial Balance Filter Carousel
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(BalanceFilterType.entries.toTypedArray()) { bFilter ->
                                val isSelected = bFilter == selectedBalanceFilter
                                val selectedBg = when (bFilter) {
                                    BalanceFilterType.ALL -> NavyPrimary
                                    BalanceFilterType.RECEIVABLE -> BalanceReceivable
                                    BalanceFilterType.PAYABLE -> BalancePayable
                                    BalanceFilterType.BALANCED -> BalanceBalanced
                                }

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
                                    shape = RoundedCornerShape(20.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = selectedBg,
                                        selectedLabelColor = Color.White,
                                        containerColor = NavyPrimary.copy(alpha = 0.07f),
                                        labelColor = MaterialTheme.colorScheme.onSurface
                                    )
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        // Sorting Controls Bar
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Sort,
                                contentDescription = null,
                                tint = GoldMetallic,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "الترتيب:",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Spacer(modifier = Modifier.width(6.dp))

                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                items(PartySortOption.entries.toTypedArray()) { sortOpt ->
                                    val isSelected = sortOpt == currentSort
                                    Surface(
                                        modifier = Modifier.clickable { currentSort = sortOpt },
                                        color = if (isSelected) GoldMetallic.copy(alpha = 0.18f) else Color.Transparent,
                                        shape = RoundedCornerShape(12.dp),
                                        border = BorderStroke(
                                            1.dp,
                                            if (isSelected) GoldMetallic else MaterialTheme.colorScheme.surfaceVariant
                                        )
                                    ) {
                                        Text(
                                            text = sortOpt.label,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                color = if (isSelected) GoldMetallic else MaterialTheme.colorScheme.onSurfaceVariant,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                                fontSize = 11.sp
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Financial Summary Bar for Filtered View
                FinancialViewSummaryHeader(
                    partiesCount = sortedParties.size,
                    netBalance = totalNet,
                    totalReceivables = totalReceivables,
                    totalPayables = totalPayables,
                    currencySymbol = "ج.م"
                )

                // Parties List / Shimmer / Empty State
                if (sortedParties.isEmpty() && isRefreshing) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(5) {
                            ShimmerCardItem()
                        }
                    }
                } else if (sortedParties.isEmpty()) {
                    PartiesEmptyStateCard(
                        searchQuery = searchQuery,
                        hasFilters = selectedFilter != PartyFilterType.ALL || selectedBalanceFilter != BalanceFilterType.ALL,
                        onResetFilters = {
                            viewModel.onSearchQueryChanged("")
                            viewModel.onFilterSelected(PartyFilterType.ALL)
                            viewModel.onBalanceFilterSelected(BalanceFilterType.ALL)
                        }
                    )
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(sortedParties, key = { it.id }) { party ->
                            EnhancedPartyItemCard(
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

@Composable
fun FinancialViewSummaryHeader(
    partiesCount: Int,
    netBalance: BigDecimal,
    totalReceivables: BigDecimal,
    totalPayables: BigDecimal,
    currencySymbol: String
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 8.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = NavyDark),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = GoldMetallic.copy(alpha = 0.2f),
                        shape = CircleShape
                    ) {
                        Box(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "$partiesCount طرف",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    color = GoldBright,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = "ملخص القائمة المعروضة",
                        style = MaterialTheme.typography.labelMedium.copy(
                            color = Color.White.copy(alpha = 0.85f),
                            fontWeight = FontWeight.Bold
                        )
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "الصافي: ",
                        style = MaterialTheme.typography.labelSmall.copy(color = Color.White.copy(alpha = 0.7f))
                    )
                    Text(
                        text = formatCurrency(netBalance, currencySymbol),
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Black,
                            color = when {
                                netBalance > BigDecimal.ZERO -> BalanceReceivable
                                netBalance < BigDecimal.ZERO -> BalancePayable
                                else -> Color.White
                            }
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(BalanceReceivable)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "المديونيات (لنا): ${formatCurrency(totalReceivables, currencySymbol)}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 10.sp
                        )
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(BalancePayable)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "الالتزامات (علينا): ${formatCurrency(totalPayables, currencySymbol)}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 10.sp
                        )
                    )
                }
            }
        }
    }
}

@Composable
fun EnhancedPartyItemCard(
    party: Party,
    onClick: () -> Unit,
    currencySymbol: String
) {
    val context = LocalContext.current

    val (avatarGradient, avatarIcon) = when (party.type) {
        PartyType.CUSTOMER -> Pair(listOf(Color(0xFF1E3A8A), Color(0xFF2563EB)), Icons.Default.Person)
        PartyType.SUPPLIER -> Pair(listOf(Color(0xFF78350F), Color(0xFFD97706)), Icons.Default.Business)
        PartyType.BOTH -> Pair(listOf(Color(0xFF581C87), Color(0xFF8B5CF6)), Icons.Default.Sync)
    }

    val balanceColor = when {
        party.balance > BigDecimal.ZERO -> BalanceReceivable
        party.balance < BigDecimal.ZERO -> BalancePayable
        else -> BalanceBalanced
    }

    val (balanceBadgeBg, balanceBadgeIcon, balanceStatusTitle) = when {
        party.balance > BigDecimal.ZERO -> Triple(
            BalanceReceivable.copy(alpha = 0.14f),
            Icons.AutoMirrored.Filled.TrendingUp,
            "مستحق لنا"
        )
        party.balance < BigDecimal.ZERO -> Triple(
            BalancePayable.copy(alpha = 0.14f),
            Icons.AutoMirrored.Filled.TrendingDown,
            "مستحق علينا"
        )
        else -> Triple(
            BalanceBalanced.copy(alpha = 0.14f),
            Icons.Default.CheckCircle,
            "الحساب متزن"
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        border = BorderStroke(1.dp, balanceColor.copy(alpha = 0.2f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            // Header: Avatar, Name, Code, and Party Type
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
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(avatarGradient)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = avatarIcon,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = party.name,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(3.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Surface(
                                color = NavyDark.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = party.code,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = NavyPrimary,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                )
                            }

                            PartyTypeChip(type = party.type)
                        }
                    }
                }

                // Balance Display Section
                Column(
                    horizontalAlignment = Alignment.End,
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Text(
                        text = formatCurrency(party.balance, currencySymbol),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Black,
                            color = balanceColor,
                            fontSize = 16.sp
                        )
                    )

                    Spacer(modifier = Modifier.height(3.dp))

                    Surface(
                        color = balanceBadgeBg,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Icon(
                                imageVector = balanceBadgeIcon,
                                contentDescription = null,
                                tint = balanceColor,
                                modifier = Modifier.size(11.dp)
                            )
                            Text(
                                text = balanceStatusTitle,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = balanceColor,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp
                                )
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Divider Line
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Footer info: Phone, Address & Arrow Indicator
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    if (party.phone.isNotBlank()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.clickable {
                                try {
                                    val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${party.phone}"))
                                    context.startActivity(dialIntent)
                                } catch (_: Exception) {}
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Call,
                                contentDescription = "اتصال",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = party.phone,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Medium
                                )
                            )
                        }
                    }

                    if (party.phone.isNotBlank() && party.address.isNotBlank()) {
                        Spacer(modifier = Modifier.width(12.dp))
                    }

                    if (party.address.isNotBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = party.address,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "كشف الحساب",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = NavyPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    )
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = NavyPrimary,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun PartyTypeChip(type: PartyType) {
    val (label, bg, color) = when (type) {
        PartyType.CUSTOMER -> Triple("عميل", Color(0xFF2563EB).copy(alpha = 0.12f), Color(0xFF1D4ED8))
        PartyType.SUPPLIER -> Triple("مورد", Color(0xFFD97706).copy(alpha = 0.12f), Color(0xFFB45309))
        PartyType.BOTH -> Triple("عميل ومورد", Color(0xFF8B5CF6).copy(alpha = 0.12f), Color(0xFF7E22CE))
    }

    Surface(
        color = bg,
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall.copy(
                color = color,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp
            )
        )
    }
}

@Composable
fun PartiesEmptyStateCard(
    searchQuery: String,
    hasFilters: Boolean,
    onResetFilters: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(NavyPrimary.copy(alpha = 0.08f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Group,
                        contentDescription = null,
                        tint = NavyPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = if (searchQuery.isNotBlank())
                        "لم نجد أي أطراف مطابقة لـ \"$searchQuery\""
                    else
                        "لا توجد أطراف مطابقة للفلاتر المحددة حالياً",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center
                    )
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "جرب البحث باسم آخر، كود آخر، أو قم بإعادة ضبط فلاتر التصفية.",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                )

                if (searchQuery.isNotBlank() || hasFilters) {
                    Spacer(modifier = Modifier.height(18.dp))

                    Button(
                        onClick = onResetFilters,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NavyDark,
                            contentColor = GoldBright
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("إعادة ضبط الفلاتر والبحث", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
