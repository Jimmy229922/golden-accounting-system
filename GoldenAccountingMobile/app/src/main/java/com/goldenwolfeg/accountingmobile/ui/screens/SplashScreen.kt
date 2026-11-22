package com.goldenwolfeg.accountingmobile.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.goldenwolfeg.accountingmobile.data.remote.session.SessionManager
import com.goldenwolfeg.accountingmobile.data.repository.AccountingRepository
import com.goldenwolfeg.accountingmobile.ui.util.BiometricHelper
import com.goldenwolfeg.accountingmobile.ui.theme.GoldBright
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientEnd
import com.goldenwolfeg.accountingmobile.ui.theme.GoldGradientStart
import com.goldenwolfeg.accountingmobile.ui.theme.NavyDark
import com.goldenwolfeg.accountingmobile.ui.theme.NavyPrimary
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    repository: AccountingRepository,
    onNavigateToLogin: () -> Unit,
    onNavigateToDashboard: () -> Unit,
    onNavigateToAdminPanel: () -> Unit = {}
) {
    val context = LocalContext.current
    val sessionManager = remember { SessionManager(context) }
    val scale = remember { Animatable(0.7f) }
    val alpha = remember { Animatable(0f) }
    var waitingForBiometric by remember { mutableStateOf(false) }
    var pendingAdminRoute by remember { mutableStateOf(false) }
    var biometricError by remember { mutableStateOf<String?>(null) }

    fun triggerBiometricCheck(isAdmin: Boolean) {
        val activity = context as? FragmentActivity
        if (activity == null || !BiometricHelper.isBiometricAvailable(context)) {
            if (isAdmin) onNavigateToAdminPanel() else onNavigateToDashboard()
            return
        }
        waitingForBiometric = true
        biometricError = null
        BiometricHelper.showBiometricPrompt(
            activity = activity,
            title = "التحقق بالبصمة",
            subtitle = "افتح تطبيق Golden Accounting بأمان",
            onSuccess = {
                waitingForBiometric = false
                if (isAdmin) onNavigateToAdminPanel() else onNavigateToDashboard()
            },
            onError = { err ->
                biometricError = err
            }
        )
    }

    LaunchedEffect(key1 = true) {
        scale.animateTo(
            targetValue = 1.0f,
            animationSpec = tween(durationMillis = 600)
        )
        alpha.animateTo(
            targetValue = 1.0f,
            animationSpec = tween(durationMillis = 400)
        )
        val isSessionValid = repository.isSessionValid()
        val isAdmin = if (isSessionValid) repository.isSuperAdminSession() else false
        delay(400)
        if (isSessionValid) {
            pendingAdminRoute = isAdmin
            if (sessionManager.isBiometricLockEnabled() && BiometricHelper.isBiometricAvailable(context)) {
                triggerBiometricCheck(isAdmin)
            } else if (isAdmin) {
                onNavigateToAdminPanel()
            } else {
                onNavigateToDashboard()
            }
        } else {
            onNavigateToLogin()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(NavyDark, NavyPrimary)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            Box(
                modifier = Modifier
                    .scale(scale.value)
                    .alpha(alpha.value)
                    .size(110.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(GoldGradientStart, GoldGradientEnd)
                        )
                    )
                    .border(3.dp, GoldBright, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "G",
                    style = MaterialTheme.typography.displayLarge.copy(
                        color = NavyDark,
                        fontWeight = FontWeight.Black,
                        fontSize = 58.sp
                    )
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Golden Accounting Mobile",
                style = MaterialTheme.typography.headlineSmall.copy(
                    color = GoldBright,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                ),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "نظام المتابعة المحاسبية الموحد",
                style = MaterialTheme.typography.titleMedium.copy(
                    color = Color.White.copy(alpha = 0.9f),
                    fontWeight = FontWeight.Medium
                ),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "مرتبط بنظام Golden Accounting للكمبيوتر",
                style = MaterialTheme.typography.bodySmall.copy(
                    color = Color.White.copy(alpha = 0.6f)
                ),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(48.dp))

            if (waitingForBiometric) {
                biometricError?.let { err ->
                    Text(
                        text = err,
                        color = Color(0xFFFCA5A5),
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                }
                Button(
                    onClick = { triggerBiometricCheck(pendingAdminRoute) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = GoldBright,
                        contentColor = NavyDark
                    )
                ) {
                    Text("فتح التطبيق بالبصمة", fontWeight = FontWeight.Bold)
                }
            } else {
                CircularProgressIndicator(
                    color = GoldBright,
                    strokeWidth = 3.dp,
                    modifier = Modifier.size(28.dp)
                )
            }
        }
    }
}
