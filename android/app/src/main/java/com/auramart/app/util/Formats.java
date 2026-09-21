package com.auramart.app.util;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Currency and date helpers shared by every screen. */
public final class Formats {

    private static final NumberFormat CURRENCY = NumberFormat.getCurrencyInstance(Locale.US);

    private Formats() {
    }

    public static String money(double value) {
        return CURRENCY.format(value);
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
        return new SimpleDateFormat("MMM d, yyyy", Locale.US).format(d);
    }

    public static String dateTime(String iso) {
        Date d = parseIso(iso);
        if (d == null) return "-";
        return new SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US).format(d);
    }

    /** "Delivered" from "delivered", "In Transit" from "in_transit". */
    public static String label(String status) {
        if (status == null || status.isEmpty()) return "";
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
