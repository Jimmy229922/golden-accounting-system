package com.goldenwolfeg.accountingmobile.ui.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.goldenwolfeg.accountingmobile.data.repository.AccountingRepository
import com.goldenwolfeg.accountingmobile.data.repository.AdminPanelRepository
import com.goldenwolfeg.accountingmobile.data.repository.SupabaseAccountingRepository
import com.goldenwolfeg.accountingmobile.ui.screens.AdminPanelScreen
import com.goldenwolfeg.accountingmobile.ui.screens.DashboardScreen
import com.goldenwolfeg.accountingmobile.ui.screens.LoginScreen
import com.goldenwolfeg.accountingmobile.ui.screens.PartiesListScreen
import com.goldenwolfeg.accountingmobile.ui.screens.PartyDetailsScreen
import com.goldenwolfeg.accountingmobile.ui.screens.PartyLedgerScreen
import com.goldenwolfeg.accountingmobile.ui.screens.SplashScreen
import com.goldenwolfeg.accountingmobile.ui.screens.SyncStatusScreen
import com.goldenwolfeg.accountingmobile.ui.viewmodel.AdminPanelViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.DashboardViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.LoginViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartiesViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.PartyDetailsViewModel
import com.goldenwolfeg.accountingmobile.ui.viewmodel.SyncViewModel

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object PartiesList : Screen("parties_list")
    object PartyDetails : Screen("party_details/{partyId}") {
        fun createRoute(partyId: String) = "party_details/$partyId"
    }
    object PartyLedger : Screen("party_ledger/{partyId}") {
        fun createRoute(partyId: String) = "party_ledger/$partyId"
    }
    object SyncStatus : Screen("sync_status")
    object AdminPanel : Screen("admin_panel")
}

@Suppress("UNCHECKED_CAST")
class ViewModelFactory<VM : ViewModel>(private val creator: () -> VM) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return creator() as T
    }
}

@Composable
fun GoldenAccountingNavGraph(
    navController: NavHostController = rememberNavController(),
    repository: AccountingRepository = SupabaseAccountingRepository(LocalContext.current)
) {

    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route,
        enterTransition = { fadeIn() },
        exitTransition = { fadeOut() },
        popEnterTransition = { fadeIn() },
        popExitTransition = { fadeOut() }
    ) {
        composable(Screen.Splash.route) {
            SplashScreen(
                repository = repository,
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToDashboard = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToAdminPanel = {
                    navController.navigate(Screen.AdminPanel.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Login.route) {
            val loginViewModel: LoginViewModel = viewModel(
                factory = ViewModelFactory { LoginViewModel(repository) }
            )
            LoginScreen(
                viewModel = loginViewModel,
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onAdminLoginSuccess = {
                    navController.navigate(Screen.AdminPanel.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.AdminPanel.route) {
            val context = LocalContext.current
            val adminViewModel: AdminPanelViewModel = viewModel(
                factory = ViewModelFactory {
                    AdminPanelViewModel(
                        adminRepository = AdminPanelRepository(context),
                        accountingRepository = repository
                    )
                }
            )
            AdminPanelScreen(
                viewModel = adminViewModel,
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.AdminPanel.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Dashboard.route) {
            val dashboardViewModel: DashboardViewModel = viewModel(
                factory = ViewModelFactory { DashboardViewModel(repository) }
            )
            DashboardScreen(
                viewModel = dashboardViewModel,
                onNavigateToParties = {
                    navController.navigate(Screen.PartiesList.route)
                },
                onNavigateToSync = {
                    navController.navigate(Screen.SyncStatus.route)
                }
            )
        }

        composable(
            route = Screen.PartiesList.route,
            enterTransition = { slideInHorizontally(initialOffsetX = { -it / 3 }) + fadeIn() },
            popExitTransition = { slideOutHorizontally(targetOffsetX = { -it / 3 }) + fadeOut() }
        ) {
            val partiesViewModel: PartiesViewModel = viewModel(
                factory = ViewModelFactory { PartiesViewModel(repository) }
            )
            PartiesListScreen(
                viewModel = partiesViewModel,
                onPartyClick = { partyId ->
                    navController.navigate(Screen.PartyDetails.createRoute(partyId))
                },
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = Screen.PartyDetails.route,
            arguments = listOf(navArgument("partyId") { type = NavType.StringType }),
            enterTransition = { slideInHorizontally(initialOffsetX = { -it / 3 }) + fadeIn() },
            popExitTransition = { slideOutHorizontally(targetOffsetX = { -it / 3 }) + fadeOut() }
        ) { backStackEntry ->
            val partyId = backStackEntry.arguments?.getString("partyId") ?: ""
            val partyDetailsViewModel: PartyDetailsViewModel = viewModel(
                key = "PartyDetails_$partyId",
                factory = ViewModelFactory { PartyDetailsViewModel(partyId, repository) }
            )
            PartyDetailsScreen(
                viewModel = partyDetailsViewModel,
                onNavigateToLedger = { id ->
                    navController.navigate(Screen.PartyLedger.createRoute(id))
                },
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = Screen.PartyLedger.route,
            arguments = listOf(navArgument("partyId") { type = NavType.StringType }),
            enterTransition = { slideInHorizontally(initialOffsetX = { -it / 3 }) + fadeIn() },
            popExitTransition = { slideOutHorizontally(targetOffsetX = { -it / 3 }) + fadeOut() }
        ) { backStackEntry ->
            val partyId = backStackEntry.arguments?.getString("partyId") ?: ""
            val partyDetailsViewModel: PartyDetailsViewModel = viewModel(
                key = "PartyDetails_$partyId",
                factory = ViewModelFactory { PartyDetailsViewModel(partyId, repository) }
            )
            PartyLedgerScreen(
                viewModel = partyDetailsViewModel,
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = Screen.SyncStatus.route,
            enterTransition = { slideInHorizontally(initialOffsetX = { -it / 3 }) + fadeIn() },
            popExitTransition = { slideOutHorizontally(targetOffsetX = { -it / 3 }) + fadeOut() }
        ) {
            val syncViewModel: SyncViewModel = viewModel(
                factory = ViewModelFactory { SyncViewModel(repository) }
            )
            SyncStatusScreen(
                viewModel = syncViewModel,
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }
    }
}
