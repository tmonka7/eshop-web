package com.auramart.app.data.local;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.auramart.app.data.model.Models.User;
import com.google.gson.Gson;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Holds the signed-in session: JWT pair, the cached profile and the wishlist ids
 * (so the heart icon can render without an extra round trip).
 */
public class SessionManager {

    private static final String PREFS = "auramart.session";
    private static final String KEY_ACCESS = "accessToken";
    private static final String KEY_REFRESH = "refreshToken";
    private static final String KEY_USER = "user";
    private static final String KEY_WISHLIST = "wishlist";
    private static final String KEY_CART_COUNT = "cartCount";

    private static volatile SessionManager instance;

    private final SharedPreferences prefs;
    private final Gson gson = new Gson();

    private SessionManager(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static SessionManager getInstance(@NonNull Context context) {
        if (instance == null) {
            synchronized (SessionManager.class) {
                if (instance == null) {
                    instance = new SessionManager(context);
                }
            }
        }
        return instance;
    }

    /** Available after AuraMartApp has run; throws early if used before that. */
    public static SessionManager get() {
        if (instance == null) {
            throw new IllegalStateException("SessionManager not initialised yet");
        }
        return instance;
    }

    /* -------------------------------- tokens ------------------------------- */

    public void saveTokens(@Nullable String access, @Nullable String refresh) {
        SharedPreferences.Editor editor = prefs.edit();
        if (access != null) editor.putString(KEY_ACCESS, access);
        if (refresh != null) editor.putString(KEY_REFRESH, refresh);
        editor.apply();
    }

    @Nullable
    public String getAccessToken() {
        return prefs.getString(KEY_ACCESS, null);
    }

    @Nullable
    public String getRefreshToken() {
        return prefs.getString(KEY_REFRESH, null);
    }

    public boolean isLoggedIn() {
        return getAccessToken() != null;
    }

    /* --------------------------------- user -------------------------------- */

    public void saveUser(@Nullable User user) {
        if (user == null) {
            prefs.edit().remove(KEY_USER).apply();
            return;
        }
        prefs.edit().putString(KEY_USER, gson.toJson(user)).apply();
        if (user.wishlist != null) {
            saveWishlist(user.wishlist);
        }
    }

    @Nullable
    public User getUser() {
        String json = prefs.getString(KEY_USER, null);
        if (json == null) return null;
        try {
            return gson.fromJson(json, User.class);
        } catch (Exception e) {
            return null;
        }
    }

    /* ------------------------------- wishlist ------------------------------ */

    public void saveWishlist(@NonNull List<String> productIds) {
        prefs.edit().putStringSet(KEY_WISHLIST, new HashSet<>(productIds)).apply();
    }

    public boolean isWishlisted(@Nullable String productId) {
        if (productId == null) return false;
        Set<String> ids = prefs.getStringSet(KEY_WISHLIST, null);
        return ids != null && ids.contains(productId);
    }

    public void setWishlisted(@NonNull String productId, boolean on) {
        Set<String> current = prefs.getStringSet(KEY_WISHLIST, null);
        Set<String> next = current == null ? new HashSet<>() : new HashSet<>(current);
        if (on) next.add(productId);
        else next.remove(productId);
        prefs.edit().putStringSet(KEY_WISHLIST, next).apply();
    }

    /* ------------------------------ cart badge ----------------------------- */

    public void setCartCount(int count) {
        prefs.edit().putInt(KEY_CART_COUNT, count).apply();
    }

    public int getCartCount() {
        return prefs.getInt(KEY_CART_COUNT, 0);
    }

    /* -------------------------------- logout ------------------------------- */

    public void clear() {
        prefs.edit().clear().apply();
    }
}
