package com.neonhorde.survivor

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.min

/**
 * Google AdMob integration:
 *  - UMP consent (GDPR / US states) gathered before any ad request,
 *  - anchored adaptive banner (menus only; the game asks for it via setBannerVisible),
 *  - rewarded and interstitial ads, always preloaded, with exponential-backoff retries.
 * All public methods must be called on the main thread.
 */
class AdsManager(
    private val activity: Activity,
    private val bannerContainer: FrameLayout,
    private val listener: Listener,
) {
    interface Listener {
        fun onBannerHeight(dp: Int)
        fun onRewardResult(requestId: Int, earned: Boolean, shown: Boolean)
        fun onInterstitialClosed(requestId: Int, shown: Boolean)
        fun onConsentResolved(canRequestAds: Boolean)
    }

    private val main = Handler(Looper.getMainLooper())
    private val consent: ConsentInformation = UserMessagingPlatform.getConsentInformation(activity)
    private val sdkStarted = AtomicBoolean(false)

    // While paused (a tutorial run) the SDK is not started and no ad is loaded: that network and CPU work
    // competes with the game and made the tutorial stutter. The game also calls start() only after the
    // first-launch tutorial.
    private var started = false
    private var paused = false
    private var sdkWanted = false

    @Volatile private var sdkReady = false

    @Volatile private var rewarded: RewardedAd? = null
    private var rewardedLoading = false
    private var rewardedRetry = 0

    @Volatile private var interstitial: InterstitialAd? = null
    private var interstitialLoading = false
    private var interstitialRetry = 0

    private var banner: AdView? = null
    private var bannerLoaded = false
    private var bannerWanted = false
    private var bannerHeightDp = 0
    private var bannerRetry = 0
    private var destroyed = false

    // ------------------------------------------------------------------ consent

    /** Consent flow (UMP), then the SDK. Main thread; later calls do nothing. */
    fun start() {
        if (started || destroyed) return
        started = true
        val params = ConsentRequestParameters.Builder().apply {
            if (BuildConfig.DEBUG && BuildConfig.UMP_TEST_DEVICE_ID.isNotEmpty()) {
                setConsentDebugSettings(
                    ConsentDebugSettings.Builder(activity)
                        .setDebugGeography(ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA)
                        .addTestDeviceHashedId(BuildConfig.UMP_TEST_DEVICE_ID)
                        .build(),
                )
            }
        }.build()

        consent.requestConsentInfoUpdate(
            activity,
            params,
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
                    if (formError != null) Log.w(TAG, "Consent form: ${formError.message}")
                    onConsentKnown()
                }
            },
            { requestError ->
                Log.w(TAG, "Consent info update failed: ${requestError.message}")
                onConsentKnown()
            },
        )
        // Consent obtained in a previous session: start loading ads right away.
        if (consent.canRequestAds()) startSdk()
    }

    private fun onConsentKnown() {
        val can = consent.canRequestAds()
        if (can) startSdk()
        listener.onConsentResolved(can)
    }

    fun isPrivacyOptionsRequired(): Boolean =
        consent.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED

    fun showPrivacyOptions() {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { formError ->
            if (formError != null) Log.w(TAG, "Privacy options: ${formError.message}")
            if (consent.canRequestAds()) startSdk()
        }
    }

    /** Main thread only. */
    fun setPaused(value: Boolean) {
        if (paused == value) return
        paused = value
        if (value) return
        if (sdkWanted) startSdk()
        loadRewarded()
        loadInterstitial()
        if (bannerWanted && sdkReady) showBanner()
    }

    private fun startSdk() {
        if (paused) { sdkWanted = true; return }
        if (!sdkStarted.compareAndSet(false, true)) return
        // Initialising on a background thread avoids ANRs on slow devices.
        Thread {
            MobileAds.initialize(activity) {
                main.post {
                    if (destroyed) return@post
                    sdkReady = true
                    loadRewarded()
                    loadInterstitial()
                    if (bannerWanted) showBanner()
                }
            }
        }.start()
    }

    // ----------------------------------------------------------------- rewarded

    fun isRewardedReady(): Boolean = rewarded != null

    private fun loadRewarded() {
        if (paused || !sdkReady || destroyed || rewarded != null || rewardedLoading) return
        rewardedLoading = true
        RewardedAd.load(activity, BuildConfig.ADMOB_REWARDED_ID, AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) {
                rewarded = ad
                rewardedLoading = false
                rewardedRetry = 0
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
                rewardedLoading = false
                rewarded = null
                Log.w(TAG, "Rewarded failed to load: ${error.code} ${error.message}")
                main.postDelayed({ loadRewarded() }, backoffMs(++rewardedRetry))
            }
        })
    }

    /** Returns false (and reports nothing) when no ad is ready; otherwise reports through the listener. */
    fun showRewarded(requestId: Int): Boolean {
        val ad = rewarded ?: run { loadRewarded(); return false }
        rewarded = null
        var earned = false
        var reported = false
        val report = { ok: Boolean, shown: Boolean ->
            if (!reported) {
                reported = true
                listener.onRewardResult(requestId, ok, shown)
            }
        }
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                report(earned, true)
                loadRewarded()
            }

            override fun onAdFailedToShowFullScreenContent(error: AdError) {
                Log.w(TAG, "Rewarded failed to show: ${error.message}")
                report(false, false)
                loadRewarded()
            }
        }
        ad.show(activity) { earned = true }
        return true
    }

    // ------------------------------------------------------------- interstitial

    private fun loadInterstitial() {
        if (paused || !sdkReady || destroyed || interstitial != null || interstitialLoading) return
        interstitialLoading = true
        InterstitialAd.load(activity, BuildConfig.ADMOB_INTERSTITIAL_ID, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) {
                interstitial = ad
                interstitialLoading = false
                interstitialRetry = 0
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
                interstitialLoading = false
                interstitial = null
                Log.w(TAG, "Interstitial failed to load: ${error.code} ${error.message}")
                main.postDelayed({ loadInterstitial() }, backoffMs(++interstitialRetry))
            }
        })
    }

    fun showInterstitial(requestId: Int): Boolean {
        val ad = interstitial ?: run { loadInterstitial(); return false }
        interstitial = null
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                listener.onInterstitialClosed(requestId, true)
                loadInterstitial()
            }

            override fun onAdFailedToShowFullScreenContent(error: AdError) {
                listener.onInterstitialClosed(requestId, false)
                loadInterstitial()
            }
        }
        ad.show(activity)
        return true
    }

    // ------------------------------------------------------------------- banner

    fun setBannerVisible(visible: Boolean) {
        bannerWanted = visible
        if (!sdkReady || paused) return
        if (visible) showBanner() else hideBanner()
    }

    private fun showBanner() {
        val view = banner ?: createBanner()
        bannerContainer.visibility = View.VISIBLE
        view.resume()
        listener.onBannerHeight(if (bannerLoaded) bannerHeightDp else 0)
    }

    private fun hideBanner() {
        bannerContainer.visibility = View.GONE
        banner?.pause()
        listener.onBannerHeight(0)
    }

    private fun createBanner(): AdView {
        val metrics = activity.resources.displayMetrics
        val widthDp = (metrics.widthPixels / metrics.density).toInt()
        val size = AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp)
        bannerHeightDp = size.height
        val view = AdView(activity)
        view.adUnitId = BuildConfig.ADMOB_BANNER_ID
        view.setAdSize(size)
        view.adListener = object : AdListener() {
            override fun onAdLoaded() {
                bannerLoaded = true
                bannerRetry = 0
                if (bannerWanted) listener.onBannerHeight(bannerHeightDp)
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
                Log.w(TAG, "Banner failed to load: ${error.code} ${error.message}")
                if (!bannerLoaded) listener.onBannerHeight(0)
                main.postDelayed({ if (!destroyed) view.loadAd(AdRequest.Builder().build()) }, backoffMs(++bannerRetry))
            }
        }
        bannerContainer.addView(view, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL))
        view.loadAd(AdRequest.Builder().build())
        banner = view
        return view
    }

    // ---------------------------------------------------------------- lifecycle

    fun onPause() { banner?.pause() }

    fun onResume() { if (bannerWanted) banner?.resume() }

    fun onDestroy() {
        destroyed = true
        main.removeCallbacksAndMessages(null)
        banner?.destroy()
        banner = null
    }

    private fun backoffMs(attempt: Int): Long = 1000L * min(64, 1 shl min(attempt, 6))

    private companion object {
        const val TAG = "NeonHordeAds"
    }
}
