package com.neonhorde.survivor

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * Hosts the HTML5 game in a full-screen WebView and bridges it to native services
 * (AdMob, UMP consent, haptics, notifications, in-app review).
 */
class MainActivity : ComponentActivity(), AdsManager.Listener {

    lateinit var ads: AdsManager
        private set
    lateinit var haptics: Haptics
        private set

    private lateinit var root: FrameLayout
    private lateinit var bannerContainer: FrameLayout
    private var webView: WebView? = null
    private var pageReady = false
    private val startedAt = SystemClock.uptimeMillis()

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* the game keeps working either way */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { !pageReady && SystemClock.uptimeMillis() - startedAt < SPLASH_MAX_MS }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        haptics = Haptics(this)

        root = FrameLayout(this).apply { setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.nh_bg)) }
        bannerContainer = FrameLayout(this).apply { visibility = View.GONE }
        root.addView(bannerContainer, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        setContentView(root)

        createWebView()
        applyImmersive()
        observeInsets()

        // The game starts the consent flow and the SDK (GameBridge.startAds): right away on later launches,
        // only after the tutorial on the first one (the ad stack's network work made the tutorial stutter).
        ads = AdsManager(this, bannerContainer, this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // The game decides: close a dialog, pause the run, switch tab or ask to exit.
                if (pageReady) js("window.NHNative && NHNative.onBack()") else finish()
            }
        })
    }

    // ------------------------------------------------------------------ WebView

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun createWebView() {
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val view = WebView(this)
        view.setBackgroundColor(Color.parseColor("#0D0B24"))
        view.overScrollMode = View.OVER_SCROLL_NEVER
        view.isVerticalScrollBarEnabled = false
        view.isHorizontalScrollBarEnabled = false
        view.isHapticFeedbackEnabled = false
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        view.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == ASSET_HOST) return false
                openExternal(request.url.toString())
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = true
                pushInsets()
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // The renderer was killed (usually to reclaim memory). Rebuild the WebView instead of crashing;
                // progress is safe in localStorage.
                Log.w(TAG, "WebView renderer gone (crash=${detail.didCrash()}), recreating")
                root.removeView(view)
                view.destroy()
                webView = null
                createWebView()
                return true
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                if (BuildConfig.DEBUG) Log.d(TAG, "JS ${message.messageLevel()}: ${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                return true
            }
        }
        view.addJavascriptInterface(GameBridge(this), "NeonHordeNative")
        root.addView(view, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        webView = view
        view.loadUrl("https://$ASSET_HOST/assets/index.html")
    }

    /** Runs JavaScript in the game (main thread only). */
    fun js(code: String) {
        webView?.evaluateJavascript(code, null)
    }

    // ------------------------------------------------------------ window/insets

    private fun applyImmersive() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    private var insetTop = 0
    private var insetRight = 0
    private var insetBottom = 0
    private var insetLeft = 0

    private fun observeInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.systemGestures())
            val cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
            val density = resources.displayMetrics.density
            insetTop = (cutout.top / density).toInt()
            insetLeft = (cutout.left / density).toInt()
            insetRight = (cutout.right / density).toInt()
            // Keep a small margin above the gesture bar area; the banner sits flush with the bottom edge.
            insetBottom = (maxOf(cutout.bottom, safe.bottom / 3) / density).toInt()
            pushInsets()
            insets
        }
    }

    private fun pushInsets() {
        js("window.NHNative && NHNative.onInsets($insetTop,$insetRight,$insetBottom,$insetLeft)")
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()
        // e.g. the consent form, a permission dialog or the notification shade: pause a running fight
        else js("window.NHNative && NHNative.onFocusLost()")
    }


    fun setKeepScreenOn(on: Boolean) {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    // ------------------------------------------------------------ ad callbacks

    override fun onBannerHeight(dp: Int) = js("window.NHNative && NHNative.onBannerHeight($dp)")

    override fun onRewardResult(requestId: Int, earned: Boolean, shown: Boolean) =
        js("window.NHNative && NHNative.onRewardResult($requestId,$earned,$shown)")

    override fun onInterstitialClosed(requestId: Int, shown: Boolean) =
        js("window.NHNative && NHNative.onInterstitialClosed($requestId,$shown)")

    override fun onConsentResolved(canRequestAds: Boolean) =
        js("window.NHNative && NHNative.onConsent($canRequestAds)")

    // --------------------------------------------------------------- services

    fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    fun openExternal(url: String) {
        val uri = Uri.parse(url)
        if (uri.scheme != "https" && uri.scheme != "http" && uri.scheme != "market") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            Log.w(TAG, "No app can open $url")
        }
    }

    /** Google Play in-app review; falls back to the store page if the flow is unavailable. */
    fun rateApp() {
        val manager = ReviewManagerFactory.create(this)
        manager.requestReviewFlow().addOnCompleteListener { request ->
            if (request.isSuccessful) {
                manager.launchReviewFlow(this, request.result)
            } else {
                openExternal("https://play.google.com/store/apps/details?id=$packageName")
            }
        }
    }

    // --------------------------------------------------------------- lifecycle

    // WebView timers are global to every WebView in the process, including the one AdMob renders a full-screen
    // ad in. onPause() also fires while such an ad covers us, so pausing them there froze the ad and its close
    // button; pause them only when the app actually leaves the screen.
    override fun onStart() {
        super.onStart()
        webView?.resumeTimers()
    }

    override fun onResume() {
        super.onResume()
        NeonHordeApp.isInForeground = true
        applyImmersive()
        webView?.onResume()
        ads.onResume()
        js("window.NHNative && NHNative.onResume()")
    }

    override fun onPause() {
        NeonHordeApp.isInForeground = false
        js("window.NHNative && NHNative.onPause()")
        ads.onPause()
        webView?.onPause()
        super.onPause()
    }

    override fun onStop() {
        webView?.pauseTimers()
        super.onStop()
    }

    override fun onDestroy() {
        ads.onDestroy()
        webView?.let {
            root.removeView(it)
            it.destroy()
        }
        webView = null
        super.onDestroy()
    }

    private companion object {
        const val TAG = "NeonHorde"
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val SPLASH_MAX_MS = 2500L
    }
}
