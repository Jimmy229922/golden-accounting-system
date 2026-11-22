package com.goldenwolfeg.accountingmobile.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = GoldMetallic,
    onPrimary = NavyDark,
    primaryContainer = NavySurface,
    onPrimaryContainer = GoldBright,
    secondary = GoldDark,
    onSecondary = Color.White,
    secondaryContainer = GoldContainer,
    onSecondaryContainer = GoldLight,
    background = NavyBackground,
    onBackground = Color.White,
    surface = NavySurface,
    onSurface = Color.White,
    surfaceVariant = NavyPrimary,
    onSurfaceVariant = GoldLight
)

private val LightColorScheme = lightColorScheme(
    primary = NavyPrimary,
    onPrimary = Color.White,
    primaryContainer = NavyDark,
    onPrimaryContainer = GoldLight,
    secondary = GoldMetallic,
    onSecondary = NavyDark,
    secondaryContainer = GoldLight,
    onSecondaryContainer = NavyDark,
    background = BackgroundLight,
    onBackground = TextPrimaryLight,
    surface = SurfaceLight,
    onSurface = TextPrimaryLight,
    surfaceVariant = SurfaceVariantLight,
    onSurfaceVariant = TextSecondaryLight
)

@Composable
fun GoldenAccountingMobileTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = darkTheme
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}