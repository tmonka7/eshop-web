package com.auramart.app.util;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;

import com.auramart.app.R;

import java.util.Locale;

/**
 * The app's language, in one place.
 *
 * AppCompat 1.6+ applies a per-app locale on every API level, but it does not
 * persist the choice for us unless the autoStoreLocales service is enabled, so
 * we keep it in SharedPreferences and re-apply it from {@code Application.onCreate}.
 * "System default" is represented by an empty tag, which hands the decision
 * back to the device settings.
 */
public final class LocaleManager {

    public static final String SYSTEM = "";
    public static final String ENGLISH = "en";
    public static final String CHINESE = "zh";
    public static final String JAPANESE = "ja";

    /** Order shown in the picker. */
    public static final String[] SUPPORTED = { SYSTEM, ENGLISH, CHINESE, JAPANESE };

    private static final String PREFS = "auramart.locale";
    private static final String KEY_TAG = "language";

    private LocaleManager() {
    }

    private static SharedPreferences prefs(@NonNull Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The stored choice, or {@link #SYSTEM} when the user has not picked one. */
    @NonNull
    public static String getStoredTag(@NonNull Context context) {
        String tag = prefs(context).getString(KEY_TAG, SYSTEM);
        return tag == null ? SYSTEM : tag;
    }

    /** Persists the choice and applies it immediately; activities recreate themselves. */
    public static void setLanguage(@NonNull Context context, @NonNull String tag) {
        prefs(context).edit().putString(KEY_TAG, tag).apply();
        apply(tag);
    }

    /** Re-applies the stored choice. Call once from Application.onCreate(). */
    public static void applyStored(@NonNull Context context) {
        apply(getStoredTag(context));
    }

    private static void apply(@NonNull String tag) {
        AppCompatDelegate.setApplicationLocales(
                tag.isEmpty()
                        ? LocaleListCompat.getEmptyLocaleList()
                        : LocaleListCompat.forLanguageTags(tag));
    }

    /**
     * The language the UI is actually rendering in, resolved through the app
     * locale first and the system list second. Used for the API's X-Language
     * header and for number/date formatting.
     */
    @NonNull
    public static Locale currentLocale() {
        LocaleListCompat appLocales = AppCompatDelegate.getApplicationLocales();
        if (!appLocales.isEmpty()) {
            Locale first = appLocales.get(0);
            if (first != null) return first;
        }
        Locale systemDefault = Locale.getDefault();
        return systemDefault == null ? Locale.ENGLISH : systemDefault;
    }

    /**
     * The tag to send to the API: one of en/zh/ja, falling back to English for
     * any language the backend does not serve.
     */
    @NonNull
    public static String apiLanguageTag() {
        String language = currentLocale().getLanguage();
        if (CHINESE.equals(language) || JAPANESE.equals(language)) return language;
        return ENGLISH;
    }

    /** Label for the picker row that represents this tag. */
    public static int labelRes(@NonNull String tag) {
        switch (tag) {
            case ENGLISH:
                return R.string.language_english;
            case CHINESE:
                return R.string.language_chinese;
            case JAPANESE:
                return R.string.language_japanese;
            default:
                return R.string.language_system;
        }
    }

    /**
     * The label to show next to "Language" in the account screen: the chosen
     * language's endonym, or the system-default row when nothing is pinned.
     */
    public static int currentLabelRes(@NonNull Context context) {
        return labelRes(getStoredTag(context));
    }
}
