package com.auramart.app.ui.main;

import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.databinding.ActivityMainBinding;
import com.auramart.app.ui.account.AccountFragment;
import com.auramart.app.ui.cart.CartFragment;
import com.auramart.app.ui.categories.CategoriesFragment;
import com.auramart.app.ui.home.HomeFragment;

import com.google.android.material.badge.BadgeDrawable;

/** Hosts the four bottom-nav tabs and owns the cart badge. */
public class MainActivity extends AppCompatActivity {

    public static final String EXTRA_TAB = "tab";
    public static final int TAB_HOME = 0;
    public static final int TAB_CATEGORIES = 1;
    public static final int TAB_CART = 2;
    public static final int TAB_ACCOUNT = 3;

    private ActivityMainBinding b;
    private int currentTab = -1;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_home) show(TAB_HOME);
            else if (id == R.id.nav_categories) show(TAB_CATEGORIES);
            else if (id == R.id.nav_cart) show(TAB_CART);
            else if (id == R.id.nav_account) show(TAB_ACCOUNT);
            return true;
        });

        int startTab = getIntent().getIntExtra(EXTRA_TAB, TAB_HOME);
        selectTab(startTab);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateCartBadge(SessionManager.get().getCartCount());
    }

    /** Lets fragments switch tabs, e.g. the empty cart's "Start shopping". */
    public void selectTab(int tab) {
        int menuId = switch (tab) {
            case TAB_CATEGORIES -> R.id.nav_categories;
            case TAB_CART -> R.id.nav_cart;
            case TAB_ACCOUNT -> R.id.nav_account;
            default -> R.id.nav_home;
        };
        b.bottomNav.setSelectedItemId(menuId);
    }

    public void updateCartBadge(int count) {
        BadgeDrawable badge = b.bottomNav.getOrCreateBadge(R.id.nav_cart);
        if (count > 0) {
            badge.setVisible(true);
            badge.setNumber(count);
        } else {
            badge.setVisible(false);
            badge.clearNumber();
        }
        SessionManager.get().setCartCount(count);
    }

    private void show(int tab) {
        if (tab == currentTab) return;
        currentTab = tab;

        Fragment fragment = switch (tab) {
            case TAB_CATEGORIES -> new CategoriesFragment();
            case TAB_CART -> new CartFragment();
            case TAB_ACCOUNT -> new AccountFragment();
            default -> new HomeFragment();
        };

        getSupportFragmentManager()
                .beginTransaction()
                .replace(R.id.fragmentContainer, fragment)
                .commit();
    }
}
