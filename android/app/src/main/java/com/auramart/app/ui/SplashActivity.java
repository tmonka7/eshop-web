package com.auramart.app.ui;

import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.ApiResponse;
import com.auramart.app.data.model.Models.User;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.main.MainActivity;

/**
 * Decides the first screen: a stored token is validated against /auth/me, and
 * browsing stays available even when that check fails.
 */
public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SessionManager session = SessionManager.get();
        if (!session.isLoggedIn()) {
            go(LoginActivity.class);
            return;
        }

        Repo.call(Repo.api().me(), new Repo.OnResult<User>() {
            @Override
            public void onSuccess(User user, String message) {
                session.saveUser(user);
                go(MainActivity.class);
            }

            @Override
            public void onError(String message) {
                // Token is stale or the API is down: start over at the login screen,
                // from where the user can still browse as a guest.
                session.clear();
                go(LoginActivity.class);
            }
        });
    }

    private void go(Class<?> target) {
        startActivity(new Intent(this, target));
        finish();
    }

    /** Suppress the default open animation so the splash feels instant. */
    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(0, 0);
    }
}
