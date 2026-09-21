package com.auramart.app.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AuthData;
import com.auramart.app.data.model.Models.RegisterRequest;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityRegisterBinding;
import com.auramart.app.ui.main.MainActivity;
import com.auramart.app.util.Ui;
import com.auramart.app.util.Validators;

public class RegisterActivity extends AppCompatActivity {

    private ActivityRegisterBinding b;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityRegisterBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.backButton.setOnClickListener(v -> finish());
        b.loginButton.setOnClickListener(v -> finish());
        b.registerButton.setOnClickListener(v -> submit());
    }

    private void submit() {
        String name = String.valueOf(b.nameInput.getText()).trim();
        String email = String.valueOf(b.emailInput.getText()).trim();
        String phone = String.valueOf(b.phoneInput.getText()).trim();
        String password = String.valueOf(b.passwordInput.getText());
        String confirm = String.valueOf(b.confirmInput.getText());

        b.nameLayout.setError(null);
        b.emailLayout.setError(null);
        b.passwordLayout.setError(null);
        b.confirmLayout.setError(null);

        if (!Validators.notBlank(name) || name.length() < 2) {
            b.nameLayout.setError("Enter your name");
            return;
        }
        if (!Validators.isEmail(email)) {
            b.emailLayout.setError("Enter a valid email");
            return;
        }
        if (!Validators.isPassword(password)) {
            b.passwordLayout.setError("At least 6 characters");
            return;
        }
        if (!password.equals(confirm)) {
            b.confirmLayout.setError("Passwords do not match");
            return;
        }

        setLoading(true);
        Repo.call(
                Repo.api().register(new RegisterRequest(name, email, password, phone)),
                new Repo.OnResult<AuthData>() {
                    @Override
                    public void onSuccess(AuthData data, String message) {
                        SessionManager.get().saveTokens(data.accessToken, data.refreshToken);
                        SessionManager.get().saveUser(data.user);
                        Ui.toast(RegisterActivity.this, message);

                        Intent intent = new Intent(RegisterActivity.this, MainActivity.class);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                        finish();
                    }

                    @Override
                    public void onError(String message) {
                        setLoading(false);
                        b.errorText.setVisibility(View.VISIBLE);
                        b.errorText.setText(message);
                    }
                });
    }

    private void setLoading(boolean loading) {
        b.progress.setVisibility(loading ? View.VISIBLE : View.GONE);
        b.registerButton.setEnabled(!loading);
    }
}
