package com.auramart.app.util;

import android.content.Context;
import android.view.View;
import android.view.animation.OvershootInterpolator;
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

    /**
     * A quick bounce, for confirming an action on the control that caused it -
     * adding to the cart, toggling a wishlist heart.
     *
     * The scale is reset before and after so repeated taps cannot compound,
     * and the bounce is decoration only: every caller also shows a snackbar or
     * updates a label, so nothing is communicated by the movement alone.
     */
    public static void bounce(View view) {
        if (view == null) return;
        view.animate().cancel();
        view.setScaleX(1f);
        view.setScaleY(1f);
        view.animate()
                .scaleX(1.18f).scaleY(1.18f)
                .setDuration(120)
                .withEndAction(() -> view.animate()
                        .scaleX(1f).scaleY(1f)
                        .setInterpolator(new OvershootInterpolator())
                        .setDuration(220)
                        .start())
                .start();
    }

    /** Fades a view in from slightly below - for content replacing a spinner. */
    public static void revealUp(View view) {
        if (view == null) return;
        view.animate().cancel();
        view.setAlpha(0f);
        view.setTranslationY(24f);
        view.setVisibility(View.VISIBLE);
        view.animate().alpha(1f).translationY(0f).setDuration(280).start();
    }
}
