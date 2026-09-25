package com.auramart.app.ui.home;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.auramart.app.R;
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
import com.auramart.app.ui.visual.VisualSearchActivity;
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

    private static final long BANNER_INTERVAL_MS = 5000L;
    private final Handler bannerHandler = new Handler(Looper.getMainLooper());
    private final Runnable bannerAdvance = new Runnable() {
        @Override
        public void run() {
            if (b == null) return;
            int count = bannerAdapter.getItemCount();
            if (count > 1) {
                int next = (b.bannerPager.getCurrentItem() + 1) % count;
                b.bannerPager.setCurrentItem(next, true);
                bannerHandler.postDelayed(this, BANNER_INTERVAL_MS);
            }
        }
    };

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
        // Neighbouring banners sit back a little and fade, so the swipe reads
        // as a stack of cards rather than a flat strip.
        b.bannerPager.setPageTransformer((page, position) -> {
            float scale = Math.max(0.86f, 1f - Math.abs(position) * 0.14f);
            page.setScaleY(scale);
            page.setAlpha(Math.max(0.4f, 1f - Math.abs(position) * 0.6f));
        });
        b.categoryList.setAdapter(categoryAdapter);
        b.featuredList.setAdapter(featuredAdapter);
        b.bestSellerList.setAdapter(bestSellerAdapter);

        b.searchBar.setOnClickListener(v -> openList(null, null, true));
        b.visualSearchIcon.setOnClickListener(v -> VisualSearchActivity.chooseSource(requireContext()));
        b.seeAllCategories.setOnClickListener(v ->
                requireMainActivity().selectTab(MainActivity.TAB_CATEGORIES));
        b.seeAllFeatured.setOnClickListener(v -> openList(null, getString(R.string.title_featured), false, true));
        b.seeAllBestSellers.setOnClickListener(v -> openList(null, getString(R.string.best_sellers), false));
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
        scheduleBannerAdvance();
    }

    @Override
    public void onPause() {
        super.onPause();
        // Nothing should keep animating behind another screen.
        bannerHandler.removeCallbacks(bannerAdvance);
    }

    /**
     * Advances the hero carousel on its own, wrapping at the end. Each tick
     * re-posts the next one, so a user swipe simply resets the timer rather
     * than fighting it, and a single banner never animates at all.
     */
    private void scheduleBannerAdvance() {
        bannerHandler.removeCallbacks(bannerAdvance);
        if (b != null && bannerAdapter.getItemCount() > 1) {
            bannerHandler.postDelayed(bannerAdvance, BANNER_INTERVAL_MS);
        }
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
                // onResume has usually already run by the time the banners
                // land, and it cannot start the carousel on an empty adapter.
                scheduleBannerAdvance();
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
        Ui.toast(requireContext(), getString(R.string.please_sign_in_first));
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
        bannerHandler.removeCallbacks(bannerAdvance);
        b = null;
    }
}
