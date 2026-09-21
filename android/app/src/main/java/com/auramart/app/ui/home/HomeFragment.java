package com.auramart.app.ui.home;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AddToCartRequest;
import com.auramart.app.data.model.Models.Banner;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.Category;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.data.model.Models.WishlistToggle;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.FragmentHomeBinding;
import com.auramart.app.ui.account.WishlistActivity;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.ui.adapter.ProductAdapter;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.main.MainActivity;
import com.auramart.app.ui.product.ProductDetailActivity;
import com.auramart.app.ui.products.ProductListActivity;
import com.auramart.app.util.Ui;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class HomeFragment extends Fragment implements ProductAdapter.Listener {

    private FragmentHomeBinding b;

    private Adapters.BannerAdapter bannerAdapter;
    private Adapters.CategoryChipAdapter categoryAdapter;
    private ProductAdapter featuredAdapter;
    private ProductAdapter bestSellerAdapter;

    private int pendingRequests;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        b = FragmentHomeBinding.inflate(inflater, container, false);
        return b.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        bannerAdapter = new Adapters.BannerAdapter(this::openBanner);
        categoryAdapter = new Adapters.CategoryChipAdapter(this::openCategory);
        featuredAdapter = new ProductAdapter(this, 168);
        bestSellerAdapter = new ProductAdapter(this);

        b.bannerPager.setAdapter(bannerAdapter);
        b.categoryList.setAdapter(categoryAdapter);
        b.featuredList.setAdapter(featuredAdapter);
        b.bestSellerList.setAdapter(bestSellerAdapter);

        b.searchBar.setOnClickListener(v -> openList(null, null, true));
        b.seeAllCategories.setOnClickListener(v ->
                requireMainActivity().selectTab(MainActivity.TAB_CATEGORIES));
        b.seeAllFeatured.setOnClickListener(v -> openList(null, "Featured", false, true));
        b.seeAllBestSellers.setOnClickListener(v -> openList(null, "Best Sellers", false));
        b.wishlistIcon.setOnClickListener(v -> startActivity(new Intent(requireContext(), WishlistActivity.class)));

        b.swipeRefresh.setOnRefreshListener(this::load);
        load();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Wishlist hearts may have changed on the product screen.
        featuredAdapter.notifyDataSetChanged();
        bestSellerAdapter.notifyDataSetChanged();
    }

    private void load() {
        pendingRequests = 4;
        b.progress.setVisibility(View.VISIBLE);

        Repo.call(Repo.api().banners("hero"), new Repo.OnResult<List<Banner>>() {
            @Override
            public void onSuccess(List<Banner> data, String message) {
                if (b == null) return;
                bannerAdapter.submit(data);
                b.bannerPager.setVisibility(data.isEmpty() ? View.GONE : View.VISIBLE);
                done();
            }

            @Override
            public void onError(String message) {
                done();
            }
        });

        Map<String, String> categoryQuery = new HashMap<>();
        categoryQuery.put("parent", "root");
        categoryQuery.put("withCounts", "true");

        Repo.call(Repo.api().categories(categoryQuery), new Repo.OnResult<List<Category>>() {
            @Override
            public void onSuccess(List<Category> data, String message) {
                if (b == null) return;
                categoryAdapter.submit(data);
                done();
            }

            @Override
            public void onError(String message) {
                done();
            }
        });

        Repo.call(Repo.api().featured(10), new Repo.OnResult<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data, String message) {
                if (b == null) return;
                featuredAdapter.submitList(data);
                done();
            }

            @Override
            public void onError(String message) {
                done();
            }
        });

        Repo.call(Repo.api().bestSellers(8), new Repo.OnResult<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data, String message) {
                if (b == null) return;
                bestSellerAdapter.submitList(data);
                done();
            }

            @Override
            public void onError(String message) {
                if (b != null) Ui.snack(b.getRoot(), message);
                done();
            }
        });
    }

    private void done() {
        pendingRequests -= 1;
        if (pendingRequests <= 0 && b != null) {
            b.progress.setVisibility(View.GONE);
            b.swipeRefresh.setRefreshing(false);
        }
    }

    /* ---------------------------- product actions --------------------------- */

    @Override
    public void onOpen(Product product) {
        startActivity(ProductDetailActivity.intent(requireContext(), product.slug));
    }

    @Override
    public void onAddToCart(Product product) {
        if (!SessionManager.get().isLoggedIn()) {
            promptSignIn();
            return;
        }
        Repo.call(
                Repo.api().addToCart(new AddToCartRequest(product.id, 1, null)),
                new Repo.OnResult<Cart>() {
                    @Override
                    public void onSuccess(Cart cart, String message) {
                        if (b == null) return;
                        Ui.snack(b.getRoot(), message);
                        requireMainActivity().updateCartBadge(cart.itemCount);
                    }

                    @Override
                    public void onError(String message) {
                        if (b != null) Ui.snack(b.getRoot(), message);
                    }
                });
    }

    @Override
    public void onToggleWishlist(Product product) {
        if (!SessionManager.get().isLoggedIn()) {
            promptSignIn();
            return;
        }
        Repo.call(Repo.api().toggleWishlist(product.id), new Repo.OnResult<WishlistToggle>() {
            @Override
            public void onSuccess(WishlistToggle data, String message) {
                SessionManager.get().setWishlisted(product.id, data.inWishlist);
                if (b == null) return;
                featuredAdapter.notifyDataSetChanged();
                bestSellerAdapter.notifyDataSetChanged();
                Ui.snack(b.getRoot(), message);
            }

            @Override
            public void onError(String message) {
                if (b != null) Ui.snack(b.getRoot(), message);
            }
        });
    }

    /* -------------------------------- helpers ------------------------------- */

    private void promptSignIn() {
        Ui.toast(requireContext(), "Please sign in first");
        startActivity(new Intent(requireContext(), LoginActivity.class));
    }

    private void openCategory(Category category) {
        openList(category.slug, category.name, false);
    }

    private void openBanner(Banner banner) {
        // Banner links look like "/products?category=groceries"; pull the slug out.
        String slug = null;
        if (banner.ctaLink != null && banner.ctaLink.contains("category=")) {
            slug = banner.ctaLink.substring(banner.ctaLink.indexOf("category=") + 9);
            int amp = slug.indexOf('&');
            if (amp > -1) slug = slug.substring(0, amp);
        }
        openList(slug, banner.title, false);
    }

    private void openList(String categorySlug, String title, boolean focusSearch) {
        openList(categorySlug, title, focusSearch, false);
    }

    private void openList(String categorySlug, String title, boolean focusSearch, boolean featuredOnly) {
        startActivity(ProductListActivity.intent(
                requireContext(), categorySlug, title, focusSearch, featuredOnly));
    }

    private MainActivity requireMainActivity() {
        return (MainActivity) requireActivity();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        b = null;
    }
}
