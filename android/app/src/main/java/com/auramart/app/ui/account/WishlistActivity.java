package com.auramart.app.ui.account;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AddToCartRequest;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.data.model.Models.WishlistToggle;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityToolbarListBinding;
import com.auramart.app.ui.adapter.ProductAdapter;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.product.ProductDetailActivity;
import com.auramart.app.util.Ui;

import java.util.List;

public class WishlistActivity extends AppCompatActivity implements ProductAdapter.Listener {

    private ActivityToolbarListBinding b;
    private ProductAdapter adapter;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityToolbarListBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.toolbar.setTitle(R.string.wishlist);
        b.toolbar.setNavigationOnClickListener(v -> finish());

        adapter = new ProductAdapter(this);
        b.list.setLayoutManager(new GridLayoutManager(this, 2));
        b.list.setAdapter(adapter);

        b.empty.emptyTitle.setText(R.string.wishlist_empty);
        b.empty.emptyMessage.setText("Tap the heart on any product to save it for later.");

        b.swipeRefresh.setOnRefreshListener(this::load);

        if (!SessionManager.get().isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }
        load();
    }

    private void load() {
        b.progress.setVisibility(View.VISIBLE);

        Repo.call(Repo.api().wishlist(), new Repo.OnResult<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data, String message) {
                b.progress.setVisibility(View.GONE);
                b.swipeRefresh.setRefreshing(false);
                adapter.submitList(data);
                b.empty.getRoot().setVisibility(data.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onError(String message) {
                b.progress.setVisibility(View.GONE);
                b.swipeRefresh.setRefreshing(false);
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    @Override
    public void onOpen(Product product) {
        startActivity(ProductDetailActivity.intent(this, product.slug));
    }

    @Override
    public void onAddToCart(Product product) {
        Repo.call(Repo.api().addToCart(new AddToCartRequest(product.id, 1, null)),
                new Repo.OnResult<Cart>() {
                    @Override
                    public void onSuccess(Cart cart, String message) {
                        SessionManager.get().setCartCount(cart.itemCount);
                        Ui.snack(b.getRoot(), message);
                    }

                    @Override
                    public void onError(String message) {
                        Ui.snack(b.getRoot(), message);
                    }
                });
    }

    @Override
    public void onToggleWishlist(Product product) {
        Repo.call(Repo.api().toggleWishlist(product.id), new Repo.OnResult<WishlistToggle>() {
            @Override
            public void onSuccess(WishlistToggle data, String message) {
                SessionManager.get().setWishlisted(product.id, data.inWishlist);
                Ui.snack(b.getRoot(), message);
                // Removing from the wishlist should drop the tile from this screen.
                load();
            }

            @Override
            public void onError(String message) {
                Ui.snack(b.getRoot(), message);
            }
        });
    }
}
