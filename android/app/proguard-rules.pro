# Methods called from JavaScript through WebView.addJavascriptInterface must keep their names.
-keepclassmembers class com.neonhorde.survivor.GameBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Keep line numbers for readable Play Console crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
