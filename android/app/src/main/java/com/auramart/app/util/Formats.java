package com.auramart.app.util;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.auramart.app.R;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Currency;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Currency and date helpers shared by every screen.
 *
 * Prices stay in USD in every language; only the presentation follows the
 * locale, so ja-JP renders "$1,299.00" and zh-CN "US$1,299.00". The formatters
 * are rebuilt whenever the active locale changes rather than cached once, since
 * a language switch recreates activities but not static state.
 */
public final class Formats {

    private static final Currency USD = Currency.getInstance("USD");

    private static Locale cachedLocale;
    private static NumberFormat cachedCurrency;

    private Formats() {
    }

    private static NumberFormat currencyFormat() {
        Locale locale = LocaleManager.currentLocale();
        if (cachedCurrency == null || !locale.equals(cachedLocale)) {
            NumberFormat format = NumberFormat.getCurrencyInstance(locale);
            // The store prices in USD regardless of the display language.
            format.setCurrency(USD);
            cachedCurrency = format;
            cachedLocale = locale;
        }
        return cachedCurrency;
    }

    public static String money(double value) {
        return currencyFormat().format(value);
    }

    /** Parses the ISO-8601 timestamps Mongo/Express emit. */
    public static Date parseIso(String iso) {
        if (iso == null || iso.isEmpty()) return null;
        String[] patterns = {
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
        };
        for (String pattern : patterns) {
            try {
                // Parsing is locale-independent: these are machine timestamps.
                SimpleDateFormat sdf = new SimpleDateFormat(pattern, Locale.US);
                if (pattern.endsWith("'Z'")) {
                    sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                }
                return sdf.parse(iso);
            } catch (Exception ignored) {
                // Try the next pattern.
            }
        }
        return null;
    }

    public static String date(String iso) {
        Date d = parseIso(iso);
        if (d == null) return "-";
        Locale locale = LocaleManager.currentLocale();
        // "MMM d, yyyy" reads as gibberish in ja/zh, so each locale gets a skeleton
        // that android.text.format expands into its own conventional order.
        String pattern = android.text.format.DateFormat
                .getBestDateTimePattern(locale, "yMMMd");
        return new SimpleDateFormat(pattern, locale).format(d);
    }

    public static String dateTime(String iso) {
        Date d = parseIso(iso);
        if (d == null) return "-";
        Locale locale = LocaleManager.currentLocale();
        String pattern = android.text.format.DateFormat
                .getBestDateTimePattern(locale, "yMMMdHm");
        return new SimpleDateFormat(pattern, locale).format(d);
    }

    /**
     * Translates an order or payment status enum ("delivered", "in_transit").
     * Falls back to a title-cased version of the raw value so a status added
     * server-side still reads sensibly instead of showing a resource name.
     */
    public static String label(@Nullable Context context, @Nullable String status) {
        if (status == null || status.isEmpty()) return "";
        if (context != null) {
            int res = statusRes(status);
            if (res != 0) return context.getString(res);
        }
        return titleCase(status);
    }

    private static int statusRes(@NonNull String status) {
        switch (status) {
            case "pending": return R.string.status_pending;
            case "processing": return R.string.status_processing;
            case "shipped": return R.string.status_shipped;
            case "delivered": return R.string.status_delivered;
            case "cancelled": return R.string.status_cancelled;
            case "unpaid": return R.string.payment_unpaid;
            case "paid": return R.string.payment_paid;
            case "failed": return R.string.payment_failed;
            case "refunded": return R.string.payment_refunded;
            case "card": return R.string.pay_card;
            case "paypal": return R.string.pay_paypal;
            case "applepay": return R.string.pay_applepay;
            case "cod": return R.string.pay_cod;
            default: return 0;
        }
    }

    private static String titleCase(@NonNull String status) {
        String spaced = status.replace('_', ' ');
        StringBuilder sb = new StringBuilder();
        boolean capitalise = true;
        for (char c : spaced.toCharArray()) {
            sb.append(capitalise ? Character.toUpperCase(c) : c);
            capitalise = c == ' ';
        }
        return sb.toString();
    }
}
