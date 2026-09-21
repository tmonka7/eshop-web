package com.auramart.app.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AuthData;
import com.auramart.app.data.model.Models.LoginRequest;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityLoginBinding;
import com.auramart.app.ui.main.MainActivity;
import com.auramart.app.util.Ui;
import com.auramart.app.util.Validators;

public class LoginActivity extends AppCompatActivity {

    private ActivityLoginBinding b;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.loginButton.setOnClickListener(v -> submit());
        b.registerButton.setOnClickListener(v ->
                startActivity(new Intent(this, RegisterActivity.class)));
        b.guestButton.setOnClickListener(v -> openMain());

        // Tapping the demo hint fills the form so the app is one tap from usable.
        b.demoHint.setOnClickListener(v -> {
            b.emailInput.setText("john@example.com");
            b.passwordInput.setText("Password@123");
        });
    }

    private void submit() {
        String email = String.valueOf(b.emailInput.getText()).trim();
        String password = String.valueOf(b.passwordInput.getText());

        b.emailLayout.setError(null);
        b.passwordLayout.setError(null);

        if (!Validators.isEmail(email)) {
            b.emailLayout.setError(getString(R.string.email));
            return;
        }
        if (!Validators.isPassword(password)) {
            b.passwordLayout.setError(getString(R.string.password));
            return;
        }

        setLoading(true);
        Repo.call(Repo.api().login(new LoginRequest(email, password)), new Repo.OnResult<AuthData>() {
            @Override
            public void onSuccess(AuthData data, String message) {
                SessionManager.get().saveTokens(data.accessToken, data.refreshToken);
                SessionManager.get().saveUser(data.user);
                Ui.toast(LoginActivity.this, message);
                openMain();
            }

            @Override
            public void onError(String message) {
                setLoading(false);
                showError(message);
            }
        });
    }

    private void showError(String message) {
        b.errorText.setVisibility(View.VISIBLE);
        b.errorText.setText(message);
    }

    private void setLoading(boolean loading) {
        b.progress.setVisibility(loading ? View.VISIBLE : View.GONE);
        b.loginButton.setEnabled(!loading);
        b.registerButton.setEnabled(!loading);
        b.guestButton.setEnabled(!loading);
    }

    private void openMain() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
