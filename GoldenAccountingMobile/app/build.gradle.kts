plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.goldenwolfeg.accountingmobile"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.goldenwolfeg.accountingmobile"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    flavorDimensions += "environment"
    productFlavors {
        create("sandbox") {
            dimension = "environment"
            applicationId = "com.goldenwolfeg.accountingmobile"
            resValue("string", "app_name", "Golden Accounting (تجريبي)")
            buildConfigField("String", "SUPABASE_URL", "\"https://cpztbijvmvjtstqdarsm.supabase.co\"")
            buildConfigField("String", "SUPABASE_KEY", "\"sb_publishable_7lSNZGq_G5Qlw7AP9n3kLQ_Hz8irBee\"")
            buildConfigField("String", "DB_NAME", "\"golden_accounting_sandbox_cache.db\"")
            buildConfigField("String", "PREFS_NAME", "\"golden_accounting_sandbox_session\"")
        }
        create("production") {
            dimension = "environment"
            applicationId = "com.goldenwolfeg.accountingmobile.production"
            resValue("string", "app_name", "Golden Accounting")
            buildConfigField("String", "SUPABASE_URL", "\"https://ryoqhtsdhfbydmejmaby.supabase.co\"")
            buildConfigField("String", "SUPABASE_KEY", "\"sb_publishable_zfTor7w-Q5_CB_tc6J_mnQ_85GWkI_N\"")
            buildConfigField("String", "DB_NAME", "\"golden_accounting_prod_cache.db\"")
            buildConfigField("String", "PREFS_NAME", "\"golden_accounting_prod_session\"")
        }
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.auth)
    implementation(libs.supabase.realtime)
    implementation(libs.ktor.client.android)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.core)
    implementation(libs.kotlinx.serialization.json)
    implementation("androidx.security:security-crypto:1.1.0")
    implementation("androidx.biometric:biometric:1.1.0")
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
