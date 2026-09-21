package com.auramart.app.util;

import android.net.Uri;
import android.widget.ImageView;

import androidx.annotation.Nullable;

import com.auramart.app.BuildConfig;
import com.auramart.app.R;
import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;

/** One place to configure Glide so every image loads with the same treatment. */
public final class Images {

    /** Scheme + host + port of the API, e.g. "http://10.0.2.2:5000". */
    private static final String API_ORIGIN = origin(BuildConfig.API_BASE_URL);

    private Images() {
    }

    public static void load(ImageView view, @Nullable String url) {
        Glide.with(view.getContext())
                .load(normalize(url))
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .placeholder(R.drawable.bg_image_placeholder)
                .error(R.drawable.bg_image_placeholder)
                .centerCrop()
                .into(view);
    }

    /**
     * The API stores absolute image URLs built from its own PUBLIC_URL, which is
     * usually "http://localhost:5000". An emulator cannot resolve localhost - that
     * is its own loopback - so rewrite those onto whatever host the app talks to.
     * Relative paths ("/uploads/...") are expanded against the same origin.
     */
    @Nullable
    public static String normalize(@Nullable String url) {
        if (url == null || url.isEmpty()) return null;

        if (url.startsWith("/")) return API_ORIGIN + url;
        if (!url.startsWith("http://") && !url.startsWith("https://")) return url;

        Uri uri = Uri.parse(url);
        String host = uri.getHost();
        if (host == null) return url;

        boolean isLoopback = host.equals("localhost")
                || host.equals("127.0.0.1")
                || host.equals("0.0.0.0");
        if (!isLoopback) return url;

        String path = uri.getEncodedPath() == null ? "" : uri.getEncodedPath();
        String query = uri.getEncodedQuery() == null ? "" : "?" + uri.getEncodedQuery();
        return API_ORIGIN + path + query;
    }

    private static String origin(String baseUrl) {
        Uri uri = Uri.parse(baseUrl);
        String scheme = uri.getScheme() == null ? "http" : uri.getScheme();
        String host = uri.getHost() == null ? "10.0.2.2" : uri.getHost();
        int port = uri.getPort();
        return scheme + "://" + host + (port == -1 ? "" : ":" + port);
    }
}
