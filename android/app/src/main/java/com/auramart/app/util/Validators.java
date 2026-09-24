package com.auramart.app.util;

import android.util.Patterns;

import androidx.annotation.Nullable;

/** Input checks mirrored from the API's express-validator rules. */
public final class Validators {

    private Validators() {
    }

    public static boolean isEmail(@Nullable String value) {
        return value != null && Patterns.EMAIL_ADDRESS.matcher(value.trim()).matches();
    }

    public static boolean isPassword(@Nullable String value) {
        return value != null && value.length() >= 6;
    }

    public static boolean notBlank(@Nullable String value) {
        return value != null && !value.trim().isEmpty();
    }

    public static boolean isCardNumber(@Nullable String value) {
        if (value == null) return false;
        return value.replaceAll("\\D", "").length() >= 12;
    }
}
