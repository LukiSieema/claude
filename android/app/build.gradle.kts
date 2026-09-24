import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// Google's official AdMob test IDs (https://developers.google.com/admob/android/test-ads).
val testAppId = "ca-app-pub-3940256099942544~3347511713"
val testBannerId = "ca-app-pub-3940256099942544/9214589741"
val testRewardedId = "ca-app-pub-3940256099942544/5224354917"
val testInterstitialId = "ca-app-pub-3940256099942544/1033173712"

fun gradleProp(name: String): String = (project.findProperty(name) as String?)?.trim().orEmpty()

val releaseAppId = gradleProp("ADMOB_APP_ID")
val releaseBannerId = gradleProp("ADMOB_BANNER_ID")
val releaseRewardedId = gradleProp("ADMOB_REWARDED_ID")
val releaseInterstitialId = gradleProp("ADMOB_INTERSTITIAL_ID")
// allowTestAds=true (gradle.properties or -PallowTestAds=true): a release build for beta testing with Google's test ads.
val allowTestAds = gradleProp("allowTestAds").equals("true", ignoreCase = true)
val releaseUsesTestAds = listOf(releaseAppId, releaseBannerId, releaseRewardedId, releaseInterstitialId).any { it.isEmpty() }

val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val hasReleaseKeystore = keystoreProperties.getProperty("storeFile").orEmpty().isNotEmpty()

android {
    namespace = "com.neonhorde.survivor"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.neonhorde.survivor"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "UMP_TEST_DEVICE_ID", "\"${gradleProp("UMP_TEST_DEVICE_ID")}\"")
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            manifestPlaceholders["admobAppId"] = testAppId
            buildConfigField("String", "ADMOB_BANNER_ID", "\"$testBannerId\"")
            buildConfigField("String", "ADMOB_REWARDED_ID", "\"$testRewardedId\"")
            buildConfigField("String", "ADMOB_INTERSTITIAL_ID", "\"$testInterstitialId\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseKeystore) signingConfig = signingConfigs.getByName("release")
            manifestPlaceholders["admobAppId"] = releaseAppId.ifEmpty { testAppId }
            buildConfigField("String", "ADMOB_BANNER_ID", "\"${releaseBannerId.ifEmpty { testBannerId }}\"")
            buildConfigField("String", "ADMOB_REWARDED_ID", "\"${releaseRewardedId.ifEmpty { testRewardedId }}\"")
            buildConfigField("String", "ADMOB_INTERSTITIAL_ID", "\"${releaseInterstitialId.ifEmpty { testInterstitialId }}\"")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The HTML5 game lives in <repo>/game and is packaged as the APK's assets root,
    // so there is a single source of truth for the web build and the Android build.
    sourceSets {
        getByName("main") {
            assets.srcDirs("src/main/assets", "../../game")
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

// Safety net: never ship a release build that still uses Google's test ad units.
val testAdsMessage = "Release build uses AdMob TEST ids. Set ADMOB_APP_ID, ADMOB_BANNER_ID, ADMOB_REWARDED_ID and " +
    "ADMOB_INTERSTITIAL_ID in android/gradle.properties (see docs/ADMOB_SETUP.md), or pass -PallowTestAds=true for an internal test build."
val failOnTestAds = releaseUsesTestAds && !allowTestAds
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        if (failOnTestAds) throw GradleException(testAdsMessage)
        if (releaseUsesTestAds) logger.warn("WARNING: this release build shows Google TEST ads (allowTestAds=true). Fine for beta testing, not for production.")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    // Play Services (ads, UMP, review) pull an old androidx.fragment; the ActivityResult API used for the
    // notification permission needs >= 1.3.0, otherwise lintVitalRelease fails the release build.
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.webkit)
    implementation(libs.play.services.ads)
    implementation(libs.user.messaging.platform)
    implementation(libs.play.review.ktx)
}
