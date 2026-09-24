# Gson needs the model classes and their generic signatures intact.
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, AnnotationDefault

-keep class com.auramart.app.data.model.** { *; }

# Retrofit
-keepattributes Exceptions
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn okio.**

# Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { <init>(...); }

# onnxruntime: the native library calls back into these classes through JNI.
-keep class ai.onnxruntime.** { *; }

# Gson reads the bundled preprocessor_config.json into this class.
-keep class com.auramart.app.data.local.Dinov3Encoder$PreprocessorConfig { *; }
-keep class com.auramart.app.data.local.Dinov3Encoder$PreprocessorConfig$Size { *; }
