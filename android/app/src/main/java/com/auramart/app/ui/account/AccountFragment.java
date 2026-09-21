package com.auramart.app.ui.account;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;

import com.auramart.app.BuildConfig;
import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.UpdateProfileRequest;
import com.auramart.app.data.model.Models.User;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.FragmentAccountBinding;
import com.auramart.app.databinding.ItemAccountRowBinding;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.orders.OrdersActivity;
import com.auramart.app.util.Ui;

public class AccountFragment extends Fragment {

    private FragmentAccountBinding b;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        b = FragmentAccountBinding.inflate(inflater, container, false);
        return b.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        setupRow(b.rowOrders, R.drawable.ic_package, R.string.my_orders,
                v -> startActivity(new Intent(requireContext(), OrdersActivity.class)));
        setupRow(b.rowAddresses, R.drawable.ic_location, R.string.addresses,
                v -> startActivity(new Intent(requireContext(), AddressListActivity.class)));
        setupRow(b.rowWishlist, R.drawable.ic_heart, R.string.wishlist,
                v -> startActivity(new Intent(requireContext(), WishlistActivity.class)));
        setupRow(b.rowSettings, R.drawable.ic_settings, R.string.settings,
                v -> showSettings());

        b.editProfileButton.setOnClickListener(v -> showEditProfile());
        b.signOutButton.setOnClickListener(v -> signOut());
        b.signInButton.setOnClickListener(v ->
                startActivity(new Intent(requireContext(), LoginActivity.class)));

        b.versionText.setText("AuraMart v" + BuildConfig.VERSION_NAME);
        render();
    }

    @Override
    public void onResume() {
        super.onResume();
        render();
    }

    private void render() {
        User user = SessionManager.get().getUser();
        boolean signedIn = SessionManager.get().isLoggedIn() && user != null;

        b.signedOutBox.setVisibility(signedIn ? View.GONE : View.VISIBLE);
        b.menuBox.setVisibility(signedIn ? View.VISIBLE : View.GONE);
        b.signOutButton.setVisibility(signedIn ? View.VISIBLE : View.GONE);
        b.editProfileButton.setVisibility(signedIn ? View.VISIBLE : View.GONE);

        if (signedIn) {
            b.avatarText.setText(user.initial());
            b.nameText.setText(user.name);
            b.emailText.setText(user.email);
        } else {
            b.avatarText.setText("?");
            b.nameText.setText(R.string.app_name);
            b.emailText.setText(R.string.app_tagline);
        }
    }

    private void setupRow(ItemAccountRowBinding row, int iconRes, int titleRes,
                          View.OnClickListener onClick) {
        row.rowIcon.setImageResource(iconRes);
        row.rowTitle.setText(titleRes);
        row.rowRoot.setOnClickListener(onClick);
    }

    private void showEditProfile() {
        User user = SessionManager.get().getUser();
        if (user == null) return;

        LinearLayout box = new LinearLayout(requireContext());
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad, pad, 0);

        EditText nameInput = new EditText(requireContext());
        nameInput.setHint(R.string.full_name);
        nameInput.setText(user.name);
        box.addView(nameInput);

        EditText phoneInput = new EditText(requireContext());
        phoneInput.setHint(R.string.phone);
        phoneInput.setText(user.phone);
        box.addView(phoneInput);

        new AlertDialog.Builder(requireContext())
                .setTitle(R.string.profile)
                .setView(box)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.save_changes, (dialog, which) -> {
                    String name = nameInput.getText().toString().trim();
                    String phone = phoneInput.getText().toString().trim();

                    Repo.call(
                            Repo.api().updateProfile(new UpdateProfileRequest(name, phone)),
                            new Repo.OnResult<User>() {
                                @Override
                                public void onSuccess(User data, String message) {
                                    SessionManager.get().saveUser(data);
                                    render();
                                    if (b != null) Ui.snack(b.getRoot(), message);
                                }

                                @Override
                                public void onError(String message) {
                                    if (b != null) Ui.snack(b.getRoot(), message);
                                }
                            });
                })
                .show();
    }

    private void showSettings() {
        new AlertDialog.Builder(requireContext())
                .setTitle(R.string.settings)
                .setMessage("API: " + BuildConfig.API_BASE_URL
                        + "\nVersion: " + BuildConfig.VERSION_NAME
                        + "\n\nChange API_BASE_URL in app/build.gradle to point at another server.")
                .setPositiveButton(android.R.string.ok, null)
                .show();
    }

    private void signOut() {
        String refresh = SessionManager.get().getRefreshToken();
        if (refresh != null) {
            Repo.call(
                    Repo.api().logout(new com.auramart.app.data.model.Models.RefreshRequest(refresh)),
                    new Repo.OnResult<Void>() {
                        @Override
                        public void onSuccess(Void data, String message) {
                            // Local state is cleared below either way.
                        }

                        @Override
                        public void onError(String message) {
                            // Ignored: signing out locally must always succeed.
                        }
                    });
        }

        SessionManager.get().clear();
        Intent intent = new Intent(requireContext(), LoginActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        requireActivity().finish();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        b = null;
    }
}
