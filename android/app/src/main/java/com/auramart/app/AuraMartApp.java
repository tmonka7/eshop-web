package com.auramart.app;

import android.app.Application;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.remote.ApiClient;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.util.LocaleManager;

public class AuraMartApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        SessionManager.getInstance(this);

        // AppCompat does not restore a per-app locale by itself, so re-apply the
        // stored choice before the first activity inflates anything.
        LocaleManager.applyStored(this);
        Repo.init(this);

        // A rejected refresh token means the session is gone: drop it and bounce
        // the user back to the login screen from whichever screen they are on.
        ApiClient.setSessionExpiredListener(() -> new Handler(Looper.getMainLooper()).post(() -> {
            Toast.makeText(this, R.string.session_expired, Toast.LENGTH_LONG).show();
            Intent intent = new Intent(this, LoginActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
        }));
    }
}
