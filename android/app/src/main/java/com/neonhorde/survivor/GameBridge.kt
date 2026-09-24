package com.neonhorde.survivor

import android.util.Log
import android.webkit.JavascriptInterface
import java.util.concurrent.Callable
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * Exposed to the game as `window.NeonHordeNative` (see game/js/core/platform.js).
 * JavaScript calls arrive on the WebView's JavaBridge thread; UI work is posted to the main thread.
 */
class GameBridge(private val activity: MainActivity) {

    private fun ui(block: () -> Unit) = activity.runOnUiThread(block)

    /** Runs on the main thread and waits for the result (used for calls whose answer JS needs). */
    private fun <T> uiResult(default: T, block: () -> T): T {
        val task = FutureTask(Callable { block() })
        activity.runOnUiThread(task)
        return try {
            task.get(2, TimeUnit.SECONDS)
        } catch (e: Exception) {
            default
        }
    }

    // ---------------------------------------------------------------- ads

    @JavascriptInterface
    fun isRewardedReady(): Boolean = activity.ads.isRewardedReady()

    // Full-screen ads never block the JS thread: the outcome (including "no ad ready") always comes back
    // through NHNative.onRewardResult / onInterstitialClosed, so a slow UI thread cannot drop a reward.
    @JavascriptInterface
    fun showRewarded(requestId: Int, placement: String) = ui {
        if (BuildConfig.DEBUG) Log.d(TAG, "rewarded requested: $placement")
        if (!activity.ads.showRewarded(requestId)) activity.onRewardResult(requestId, earned = false, shown = false)
    }

    @JavascriptInterface
    fun showInterstitial(requestId: Int, placement: String) = ui {
        if (BuildConfig.DEBUG) Log.d(TAG, "interstitial requested: $placement")
        if (!activity.ads.showInterstitial(requestId)) activity.onInterstitialClosed(requestId, false)
    }

    @JavascriptInterface
    fun setBannerVisible(visible: Boolean) = ui { activity.ads.setBannerVisible(visible) }

    @JavascriptInterface
    fun isPrivacyOptionsRequired(): Boolean = uiResult(false) { activity.ads.isPrivacyOptionsRequired() }

    @JavascriptInterface
    fun showPrivacyOptions() = ui { activity.ads.showPrivacyOptions() }

    // ------------------------------------------------------------- device

    @JavascriptInterface
    fun vibrate(ms: Int) = activity.haptics.vibrate(ms)

    @JavascriptInterface
    fun setKeepScreenOn(on: Boolean) = ui { activity.setKeepScreenOn(on) }

    @JavascriptInterface
    fun scheduleNotification(id: Int, delaySec: Int, title: String, body: String) =
        NotificationScheduler.schedule(activity.applicationContext, id, delaySec.toLong(), title, body)

    @JavascriptInterface
    fun cancelNotification(id: Int) = NotificationScheduler.cancel(activity.applicationContext, id)

    @JavascriptInterface
    fun requestNotificationPermission() = ui { activity.requestNotificationPermission() }

    @JavascriptInterface
    fun openUrl(url: String) = ui { activity.openExternal(url) }

    @JavascriptInterface
    fun rateApp() = ui { activity.rateApp() }

    @JavascriptInterface
    fun exitApp() = ui { activity.finish() }

    @JavascriptInterface
    fun getAppVersion(): String = BuildConfig.VERSION_NAME

    private companion object {
        const val TAG = "NeonHordeBridge"
    }
}
