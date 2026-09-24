# Methods called from JavaScript through WebView.addJavascriptInterface must keep their names.
-keepclassmembers class com.neonhorde.survivor.GameBridge {
    @android.webkit.JavascriptInterface <methods>;
}
# WebView looks the annotation up at runtime, so it must survive (the default optimize file keeps it too).
-keepattributes RuntimeVisibleAnnotations

# Move obfuscated classes into one package: smaller DEX. Safe here: nothing looks classes up by name
# (manifest components are kept by AAPT rules, the JS bridge only needs its method names).
-repackageclasses

# Keep line numbers for readable Play Console crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
