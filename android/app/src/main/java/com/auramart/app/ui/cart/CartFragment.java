package com.auramart.app.ui.cart;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.CartItem;
import com.auramart.app.data.model.Models.CouponRequest;
import com.auramart.app.data.model.Models.UpdateCartItemRequest;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.FragmentCartBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.checkout.CheckoutActivity;
import com.auramart.app.ui.main.MainActivity;
import com.auramart.app.ui.product.ProductDetailActivity;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Ui;

public class CartFragment extends Fragment implements Adapters.CartAdapter.Listener {

    private FragmentCartBinding b;
    private Adapters.CartAdapter adapter;
    private Cart cart;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        b = FragmentCartBinding.inflate(inflater, container, false);
        return b.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        adapter = new Adapters.CartAdapter(this);
        b.cartList.setAdapter(adapter);

        b.swipeRefresh.setOnRefreshListener(this::load);
        b.clearButton.setOnClickListener(v -> clear());
        b.checkoutButton.setOnClickListener(v ->
                startActivity(new Intent(requireContext(), CheckoutActivity.class)));
        b.applyCouponButton.setOnClickListener(v -> applyCoupon());
        b.removeCouponButton.setOnClickListener(v -> removeCoupon());

        b.empty.emptyTitle.setText(R.string.cart_empty);
        b.empty.emptyMessage.setText(R.string.cart_empty_hint);
        b.empty.emptyAction.setText(R.string.start_shopping);
        b.empty.emptyAction.setVisibility(View.VISIBLE);
        b.empty.emptyAction.setOnClickListener(v ->
                ((MainActivity) requireActivity()).selectTab(MainActivity.TAB_HOME));

        load();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (cart != null) load();
    }

    private void load() {
        if (!SessionManager.get().isLoggedIn()) {
            showSignedOut();
            return;
        }

        Repo.call(Repo.api().cart(), new Repo.OnResult<Cart>() {
            @Override
            public void onSuccess(Cart data, String message) {
                if (b == null) return;
                b.swipeRefresh.setRefreshing(false);
                render(data);
            }

            @Override
            public void onError(String message) {
                if (b == null) return;
                b.swipeRefresh.setRefreshing(false);
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    private void showSignedOut() {
        b.swipeRefresh.setRefreshing(false);
        adapter.submit(null);
        b.summaryCard.setVisibility(View.GONE);
        b.couponRow.setVisibility(View.GONE);
        b.appliedCouponRow.setVisibility(View.GONE);
        b.shippingHint.setVisibility(View.GONE);
        b.clearButton.setVisibility(View.GONE);

        b.empty.getRoot().setVisibility(View.VISIBLE);
        b.empty.emptyTitle.setText(R.string.sign_in);
        b.empty.emptyMessage.setText(R.string.cart_signed_out_hint);
        b.empty.emptyAction.setText(R.string.sign_in);
        b.empty.emptyAction.setVisibility(View.VISIBLE);
        b.empty.emptyAction.setOnClickListener(v ->
                startActivity(new Intent(requireContext(), LoginActivity.class)));
    }

    private void render(Cart data) {
        cart = data;
        adapter.submit(data.items);

        for (String notice : data.notices) {
            Ui.snack(b.getRoot(), notice);
        }

        boolean empty = data.items.isEmpty();
        b.empty.getRoot().setVisibility(empty ? View.VISIBLE : View.GONE);
        b.summaryCard.setVisibility(empty ? View.GONE : View.VISIBLE);
        b.couponRow.setVisibility(empty || data.coupon != null ? View.GONE : View.VISIBLE);
        b.clearButton.setVisibility(empty ? View.GONE : View.VISIBLE);

        b.titleText.setText(getString(R.string.your_cart) + " (" + data.itemCount + ")");

        if (data.coupon != null) {
            b.appliedCouponRow.setVisibility(View.VISIBLE);
            b.appliedCouponText.setText(data.coupon.code + " applied");
        } else {
            b.appliedCouponRow.setVisibility(View.GONE);
        }

        if (data.totals != null) {
            b.subtotalText.setText(Formats.money(data.totals.subtotal));
            b.taxText.setText(Formats.money(data.totals.tax));
            b.totalText.setText(Formats.money(data.totals.total));
            b.shippingText.setText(data.totals.shipping == 0
                    ? getString(R.string.free)
                    : Formats.money(data.totals.shipping));

            if (data.totals.discount > 0) {
                b.discountRow.setVisibility(View.VISIBLE);
                b.discountText.setText("-" + Formats.money(data.totals.discount));
            } else {
                b.discountRow.setVisibility(View.GONE);
            }
        }

        // Nudge toward the free-shipping threshold when it is still within reach.
        if (!empty && data.rules != null && data.totals != null
                && data.totals.shipping > 0) {
            double remaining = data.rules.freeShippingThreshold - data.totals.subtotal;
            if (remaining > 0) {
                b.shippingHint.setVisibility(View.VISIBLE);
                b.shippingHint.setText(getString(R.string.add_more_for_free_shipping, Formats.money(remaining)));
            } else {
                b.shippingHint.setVisibility(View.GONE);
            }
        } else if (!empty) {
            b.shippingHint.setVisibility(View.VISIBLE);
            b.shippingHint.setText(R.string.have_free_shipping);
        } else {
            b.shippingHint.setVisibility(View.GONE);
        }

        ((MainActivity) requireActivity()).updateCartBadge(data.itemCount);
    }

    /* ------------------------------- actions ------------------------------- */

    @Override
    public void onQuantityChange(CartItem item, int quantity) {
        if (quantity < 1) return;
        Repo.call(Repo.api().updateCartItem(item.id, new UpdateCartItemRequest(quantity)), handler());
    }

    @Override
    public void onRemove(CartItem item) {
        Repo.call(Repo.api().removeCartItem(item.id), handler());
    }

    @Override
    public void onOpen(CartItem item) {
        startActivity(ProductDetailActivity.intent(requireContext(), item.product.slug));
    }

    private void clear() {
        Repo.call(Repo.api().clearCart(), handler());
    }

    private void applyCoupon() {
        String code = String.valueOf(b.couponInput.getText()).trim().toUpperCase();
        if (code.isEmpty()) {
            b.couponLayout.setError(getString(R.string.error_enter_code));
            return;
        }
        b.couponLayout.setError(null);
        Repo.call(Repo.api().applyCoupon(new CouponRequest(code)), new Repo.OnResult<Cart>() {
            @Override
            public void onSuccess(Cart data, String message) {
                if (b == null) return;
                b.couponInput.setText("");
                Ui.snack(b.getRoot(), message);
                render(data);
            }

            @Override
            public void onError(String message) {
                if (b != null) b.couponLayout.setError(message);
            }
        });
    }

    private void removeCoupon() {
        Repo.call(Repo.api().removeCoupon(), handler());
    }

    /** Shared callback: re-render the cart the server returns. */
    private Repo.OnResult<Cart> handler() {
        return new Repo.OnResult<>() {
            @Override
            public void onSuccess(Cart data, String message) {
                if (b == null) return;
                render(data);
            }

            @Override
            public void onError(String message) {
                if (b != null) Ui.snack(b.getRoot(), message);
            }
        };
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        b = null;
    }
}
