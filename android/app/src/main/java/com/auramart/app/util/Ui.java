package com.auramart.app.util;

import android.content.Context;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.snackbar.Snackbar;

/** Small view helpers so activities stay focused on their own logic. */
public final class Ui {

    private Ui() {
    }

    public static void toast(@NonNull Context context, String message) {
        if (message == null || message.isEmpty()) return;
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
    }

    public static void snack(@NonNull View anchor, String message) {
        if (message == null || message.isEmpty()) return;
        Snackbar.make(anchor, message, Snackbar.LENGTH_SHORT).show();
    }

    public static void show(View view, boolean visible) {
        if (view != null) view.setVisibility(visible ? View.VISIBLE : View.GONE);
    }
}
