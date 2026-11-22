package com.goldenwolfeg.accountingmobile

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import com.goldenwolfeg.accountingmobile.data.repository.AccountingRepository
import com.goldenwolfeg.accountingmobile.data.repository.SupabaseAccountingRepository
import com.goldenwolfeg.accountingmobile.ui.navigation.GoldenAccountingNavGraph
import com.goldenwolfeg.accountingmobile.ui.theme.GoldenAccountingMobileTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {

    private lateinit var repository: AccountingRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = SupabaseAccountingRepository(applicationContext)
        enableEdgeToEdge()
        setContent {
            GoldenAccountingMobileTheme {
                GoldenAccountingNavGraph(repository = repository)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::repository.isInitialized) {
            // Background check for sync status without clearing in-memory cache
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    repository.refreshSyncStatusData()
                } catch (_: Exception) {}
            }
        }
    }
}
