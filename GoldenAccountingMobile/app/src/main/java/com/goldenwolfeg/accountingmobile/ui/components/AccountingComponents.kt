package com.goldenwolfeg.accountingmobile.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goldenwolfeg.accountingmobile.data.model.Party
import com.goldenwolfeg.accountingmobile.data.model.PartyLedgerEntry
import com.goldenwolfeg.accountingmobile.data.model.PartyType
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceBalanced
import com.goldenwolfeg.accountingmobile.ui.theme.BalancePayable
import com.goldenwolfeg.accountingmobile.ui.theme.BalanceReceivable
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientEnd
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientStart
import com.goldenwolfeg.accountingmobile.ui.theme.GoldMetallic
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import java.math.BigDecimal
import java.text.DecimalFormat

val currencyFormatter = DecimalFormat("#,##0.00")

fun formatCurrency(amount: BigDecimal, currencySymbol: String = "ج.م"): String {
    val symbol = if (currencySymbol.trim().equals("EGP", ignoreCase = true)) "ج.م" else currencySymbol
    val formatted = currencyFormatter.format(amount.abs())
    return "$formatted $symbol"
}

fun formatCurrency(amount: Double, currencySymbol: String = "ج.م"): String {
    return formatCurrency(BigDecimal.valueOf(amount), currencySymbol)
}

@Composable
fun shimmerBrush(showShimmer: Boolean = true, targetValue: Float = 1000f): Brush {
    return if (showShimmer) {
        val shimmerColors = listOf(
            Color.LightGray.copy(alpha = 0.5f),
            Color.LightGray.copy(alpha = 0.2f),
            Color.LightGray.copy(alpha = 0.5f),
        )

        val transition = rememberInfiniteTransition(label = "ShimmerTransition")
        val translateAnimation = transition.animateFloat(
            initialValue = 0f,
            targetValue = targetValue,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 1000, easing = LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "ShimmerAnimation"
        )

        Brush.linearGradient(
            colors = shimmerColors,
            start = Offset.Zero,
            end = Offset(x = translateAnimation.value, y = translateAnimation.value)
        )
    } else {
        Brush.linearGradient(
            colors = listOf(Color.Transparent, Color.Transparent),
            start = Offset.Zero,
            end = Offset.Zero
        )
    }
}

@Composable
fun ShimmerCardItem(modifier: Modifier = Modifier) {
    val brush = shimmerBrush()
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Spacer(modifier = Modifier.size(38.dp).clip(CircleShape).background(brush))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Spacer(modifier = Modifier.width(120.dp).height(16.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                        Spacer(modifier = Modifier.height(6.dp))
                        Spacer(modifier = Modifier.width(80.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    }
                }
            }
            Spacer(modifier = Modifier.height(14.dp))
            Spacer(modifier = Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.surfaceVariant))
            Spacer(modifier = Modifier.height(14.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Spacer(modifier = Modifier.width(90.dp).height(14.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                Spacer(modifier = Modifier.width(110.dp).height(18.dp).clip(RoundedCornerShape(4.dp)).background(brush))
            }
        }
    }
}

@Composable
fun BalanceStatusBadge(
    balance: BigDecimal,
    modifier: Modifier = Modifier
) {
    val (bgColor, textColor, text) = when {
        balance > BigDecimal.ZERO -> Triple(
            BalanceReceivable.copy(alpha = 0.12f),
            BalanceReceivable,
            "مستحق لنا"
        )
        balance < BigDecimal.ZERO -> Triple(
            BalancePayable.copy(alpha = 0.12f),
            BalancePayable,
            "مستحق علينا"
        )
        else -> Triple(
            BalanceBalanced.copy(alpha = 0.12f),
            BalanceBalanced,
            "متزن"
        )
    }

    Surface(
        modifier = modifier,
        color = bgColor,
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, textColor.copy(alpha = 0.3f))
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall.copy(
                color = textColor,
                fontWeight = FontWeight.Bold
            )
        )
    }
}

@Composable
fun BalanceStatusBadge(
    balance: Double,
    modifier: Modifier = Modifier
) {
    BalanceStatusBadge(balance = BigDecimal.valueOf(balance), modifier = modifier)
}

@Composable
fun PartyTypeBadge(
    type: PartyType,
    modifier: Modifier = Modifier
) {
    val (label, bgColor, textColor, icon) = when (type) {
        PartyType.CUSTOMER -> Quadruple("عميل", Color(0xFF1E3A8A).copy(alpha = 0.1f), Color(0xFF1D4ED8), Icons.Default.Person)
        PartyType.SUPPLIER -> Quadruple("مورد", Color(0xFF854D0E).copy(alpha = 0.1f), Color(0xFFB45309), Icons.Default.Business)
        PartyType.BOTH -> Quadruple("عميل ومورد", Color(0xFF581C87).copy(alpha = 0.1f), Color(0xFF7E22CE), Icons.Default.Sync)
    }

    Surface(
        modifier = modifier,
        color = bgColor,
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = textColor,
                modifier = Modifier.size(12.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall.copy(
                    color = textColor,
                    fontWeight = FontWeight.SemiBold
                )
            )
        }
    }
}

data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

@Composable
fun PartyCard(
    party: Party,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    currencySymbol: String = "ج.م"
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
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
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(NavyPrimary.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = party.code.takeLast(3),
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = NavyPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = party.name,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = party.code,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            PartyTypeBadge(type = party.type)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Call,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = party.phone,
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = formatCurrency(party.balance, currencySymbol),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = when {
                                    party.balance > BigDecimal.ZERO -> BalanceReceivable
                                    party.balance < BigDecimal.ZERO -> BalancePayable
                                    else -> BalanceBalanced
                                }
                            )
                        )
                    }
                    Spacer(modifier = Modifier.height(2.dp))
                    BalanceStatusBadge(balance = party.balance)
                }
            }
        }
    }
}

@Composable
fun SummaryStatCard(
    title: String,
    value: BigDecimal,
    subtitle: String,
    accentColor: Color,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    currencySymbol: String = "ج.م"
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
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
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Medium
                    )
                )
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(accentColor.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = accentColor,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = formatCurrency(value, currencySymbol),
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = accentColor
                )
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }
    }
}

@Composable
fun SummaryStatCard(
    title: String,
    value: Double,
    subtitle: String,
    accentColor: Color,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    currencySymbol: String = "ج.م"
) {
    SummaryStatCard(
        title = title,
        value = BigDecimal.valueOf(value),
        subtitle = subtitle,
        accentColor = accentColor,
        icon = icon,
        modifier = modifier,
        currencySymbol = currencySymbol
    )
}

fun formatArabicDocType(rawType: String): String {
    val clean = rawType.trim().lowercase()
    return when {
        clean.contains("sales_invoice") || clean.contains("sales invoice") || clean.contains("مبيعات") -> "فاتورة مبيعات"
        clean.contains("purchase_invoice") || clean.contains("purchase invoice") || clean.contains("مشتريات") -> "فاتورة مشتريات"
        clean.contains("receipt") || clean.contains("cash_in") || clean.contains("قبض") || clean.contains("تحصيل") -> "سند قبض / تحصيل"
        clean.contains("payment") || clean.contains("cash_out") || clean.contains("صرف") || clean.contains("دفعة") -> "سند صرف / دفع"
        clean.contains("credit_note") || clean.contains("إشعار دائن") -> "إشعار دائن"
        clean.contains("debit_note") || clean.contains("إشعار مدين") -> "إشعار مدين"
        clean.contains("opening") || clean.contains("افتتاحي") -> "رصيد افتتاحي"
        clean.contains("return") || clean.contains("مردودات") -> "مردودات"
        clean.contains("journal") || clean.contains("تسوية") -> "قيد تسوية دفتري"
        rawType.isNotBlank() -> rawType
        else -> "حركة مالية"
    }
}

@Composable
fun LedgerEntryCard(
    entry: PartyLedgerEntry,
    modifier: Modifier = Modifier,
    currencySymbol: String = "ج.م"
) {
    val isPositiveEffect = entry.effectAmount > BigDecimal.ZERO
    val isZeroEffect = entry.effectAmount.compareTo(BigDecimal.ZERO) == 0
    val arabicDocType = formatArabicDocType(entry.docType)

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(15.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(NavyDark.copy(alpha = 0.08f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Receipt,
                            contentDescription = null,
                            tint = GoldMetallic,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = if (entry.docNumber.isNotBlank()) "$arabicDocType (#${entry.docNumber})" else arabicDocType,
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        )
                        Text(
                            text = "تاريخ الحركة: ${entry.transDate}",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 11.sp
                            )
                        )
                    }
                }

                Surface(
                    color = when {
                        isPositiveEffect -> BalanceReceivable.copy(alpha = 0.12f)
                        isZeroEffect -> BalanceBalanced.copy(alpha = 0.12f)
                        else -> BalancePayable.copy(alpha = 0.12f)
                    },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    val statusText = when {
                        isPositiveEffect -> "+ زيادة"
                        isZeroEffect -> "متزن"
                        else -> "- سداد / تخفيض"
                    }
                    Text(
                        text = statusText,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = when {
                                isPositiveEffect -> BalanceReceivable
                                isZeroEffect -> BalanceBalanced
                                else -> BalancePayable
                            },
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    )
                }
            }

            if (!entry.notes.isNull_or_empty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "ملاحظات: ${entry.notes}",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
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
                        text = "قيمة المعاملة",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = formatCurrency(entry.totalAmount, currencySymbol),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    )
                }

                Column {
                    Text(
                        text = "المبلغ المسدد",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = formatCurrency(entry.paidAmount, currencySymbol),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "الأثر الصافي",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    val effectText = when {
                        isPositiveEffect -> "+${formatCurrency(entry.effectAmount, currencySymbol)}"
                        isZeroEffect -> "0.00 $currencySymbol"
                        else -> "-${formatCurrency(entry.effectAmount.abs(), currencySymbol)}"
                    }
                    Text(
                        text = effectText,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.Black,
                            color = when {
                                isPositiveEffect -> BalanceReceivable
                                isZeroEffect -> BalanceBalanced
                                else -> BalancePayable
                            }
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = NavyDark,
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "الرصيد التراكمي المتبقي بعد الحركة:",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color.White.copy(alpha = 0.85f),
                            fontWeight = FontWeight.Medium
                        )
                    )
                    Text(
                        text = formatCurrency(entry.runningBalance, currencySymbol),
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Black,
                            color = when {
                                entry.runningBalance > BigDecimal.ZERO -> BalanceReceivable
                                entry.runningBalance < BigDecimal.ZERO -> BalancePayable
                                else -> Color.White
                            }
                        )
                    )
                }
            }
        }
    }
}

private fun String?.isNull_or_empty(): Boolean = this == null || this.trim().isEmpty()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountingTopBar(
    title: String,
    subtitle: String? = null,
    onBackClick: (() -> Unit)? = null,
    actions: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit = {}
) {
    Surface(
        shadowElevation = 3.dp,
        color = NavyDark,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.statusBarsPadding()) {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (!subtitle.isNull_or_empty()) {
                            Text(
                                text = subtitle!!,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = GoldBright,
                                    fontSize = 11.sp
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                },
                navigationIcon = {
                    if (onBackClick != null) {
                        IconButton(onClick = onBackClick) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "رجوع",
                                tint = Color.White
                            )
                        }
                    }
                },
                actions = actions,
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = NavyDark,
                    titleContentColor = Color.White
                )
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(GoldMetallic.copy(alpha = 0.3f))
            )
        }
    }
}

@Composable
fun GoldenHeaderBanner(
    isOnline: Boolean? = null,
    onLogoutClick: (() -> Unit)? = null
) {
    Surface(
        color = NavyDark,
        shadowElevation = 3.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
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
                                Brush.linearGradient(
                                    colors = listOf(GoldGradientStart, GoldGradientEnd)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "G",
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = NavyDark,
                                fontWeight = FontWeight.Black,
                                fontSize = 20.sp
                            )
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        val isSandbox = com.goldenwolfeg.accountingmobile.BuildConfig.FLAVOR.equals("sandbox", ignoreCase = true)
                        Text(
                            text = "Golden Accounting",
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                letterSpacing = 0.3.sp
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = if (isSandbox) "النظام المحاسبي (Sandbox)" else "نظام المتابعة المحاسبية الموحد",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = GoldBright,
                                fontSize = 11.sp
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (isOnline != null) {
                        val badgeColor = if (isOnline) BalanceReceivable else BalancePayable
                        Surface(
                            color = badgeColor.copy(alpha = 0.16f),
                            shape = RoundedCornerShape(20.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, badgeColor.copy(alpha = 0.5f))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(badgeColor)
                                )
                                Text(
                                    text = if (isOnline) "متصل" else "أوفلاين",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 10.sp
                                    )
                                )
                            }
                        }
                    }

                    if (onLogoutClick != null) {
                        IconButton(
                            onClick = onLogoutClick,
                            modifier = Modifier.size(34.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                                contentDescription = "تسجيل الخروج",
                                tint = Color(0xFFFCA5A5),
                                modifier = Modifier.size(21.dp)
                            )
                        }
                    }
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(GoldMetallic.copy(alpha = 0.3f))
            )
        }
    }
}

@Composable
fun GoldenBottomNavBar(
    currentRoute: String,
    onNavigate: (String) -> Unit
) {
    NavigationBar(
        containerColor = NavyDark,
        contentColor = Color.White,
        tonalElevation = 6.dp
    ) {
        val items = listOf(
            Triple("dashboard", "الرئيسية", Icons.Default.Dashboard),
            Triple("parties_list", "الحسابات", Icons.Default.Group),
            Triple("sync_status", "الاتصال", Icons.Default.CloudDone)
        )
        items.forEach { (route, label, icon) ->
            val selected = currentRoute == route
            NavigationBarItem(
                selected = selected,
                onClick = { if (!selected) onNavigate(route) },
                icon = { Icon(imageVector = icon, contentDescription = label) },
                label = {
                    Text(
                        text = label,
                        fontSize = 11.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = GoldBright,
                    selectedTextColor = GoldBright,
                    indicatorColor = GoldMetallic.copy(alpha = 0.16f),
                    unselectedIconColor = Color.White.copy(alpha = 0.6f),
                    unselectedTextColor = Color.White.copy(alpha = 0.6f)
                )
            )
        }
    }
}

@Composable
fun LogoutConfirmDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NavyPrimary,
        titleContentColor = Color.White,
        textContentColor = Color.White,
        title = {
            Text(text = "تأكيد تسجيل الخروج", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        },
        text = {
            Text(
                text = "هل تريد تسجيل الخروج من حسابك ومسح الجلسة المحفوظة على هذا الجهاز؟",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = BalancePayable, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("تسجيل الخروج", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء", color = Color.White.copy(alpha = 0.85f))
            }
        }
    )
}
