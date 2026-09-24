package com.auramart.app.ui.products;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AddToCartRequest;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.Pagination;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.data.model.Models.WishlistToggle;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityProductListBinding;
import com.auramart.app.ui.adapter.ProductAdapter;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.product.ProductDetailActivity;
import com.auramart.app.ui.visual.VisualSearchActivity;
import com.auramart.app.util.Ui;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Search results / category listing with sorting and endless scrolling. */
public class ProductListActivity extends AppCompatActivity implements ProductAdapter.Listener {

    private static final String EXTRA_CATEGORY = "category";
    private static final String EXTRA_TITLE = "title";
    private static final String EXTRA_FOCUS_SEARCH = "focusSearch";
    private static final String EXTRA_FEATURED = "featured";

    private static final String[] SORT_VALUES = {
            "best_selling", "newest", "price_asc", "price_desc", "rating", "name_asc",
    };
    /** Parallel to SORT_VALUES; resolved at show time so it follows the language. */
    private static final int[] SORT_LABEL_RES = {
            R.string.sort_best_selling, R.string.sort_newest,
            R.string.sort_price_asc, R.string.sort_price_desc,
            R.string.sort_rating, R.string.sort_name_asc,
    };

    public static Intent intent(Context context, @Nullable String categorySlug,
                                @Nullable String title, boolean focusSearch, boolean featuredOnly) {
        Intent intent = new Intent(context, ProductListActivity.class);
        intent.putExtra(EXTRA_CATEGORY, categorySlug);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_FOCUS_SEARCH, focusSearch);
        intent.putExtra(EXTRA_FEATURED, featuredOnly);
        return intent;
    }

    private ActivityProductListBinding b;
    private ProductAdapter adapter;

    private final List<Product> loaded = new ArrayList<>();
    private String categorySlug;
    private boolean featuredOnly;
    private String search = "";
    private int sortIndex = 0;
    private int page = 1;
    private int totalPages = 1;
    private boolean loading;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityProductListBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        categorySlug = getIntent().getStringExtra(EXTRA_CATEGORY);
        featuredOnly = getIntent().getBooleanExtra(EXTRA_FEATURED, false);
        String title = getIntent().getStringExtra(EXTRA_TITLE);

        b.toolbar.setTitle(title == null ? getString(R.string.app_name) : title);
        b.toolbar.setNavigationOnClickListener(v -> finish());

        adapter = new ProductAdapter(this);
        b.productList.setAdapter(adapter);

        b.searchInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int st, int c, int a) {
            }

            @Override
            public void onTextChanged(CharSequence s, int st, int before, int count) {
            }

            @Override
            public void afterTextChanged(Editable s) {
                search = s.toString().trim();
                b.searchInput.removeCallbacks(searchRunnable);
                b.searchInput.postDelayed(searchRunnable, 320);
            }
        });

        b.sortButton.setOnClickListener(v -> showSortDialog());
        b.visualSearchButton.setOnClickListener(v ->
                startActivity(VisualSearchActivity.intent(this, null)));
        VisualSearchActivity.whenAvailable(this, () -> {
            if (!isDestroyed()) b.visualSearchButton.setVisibility(View.VISIBLE);
        });
        b.swipeRefresh.setOnRefreshListener(() -> reload(true));

        b.productList.addOnScrollListener(new androidx.recyclerview.widget.RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@androidx.annotation.NonNull androidx.recyclerview.widget.RecyclerView rv,
                                   int dx, int dy) {
                if (dy <= 0 || loading || page >= totalPages) return;
                androidx.recyclerview.widget.GridLayoutManager lm =
                        (androidx.recyclerview.widget.GridLayoutManager) rv.getLayoutManager();
                if (lm == null) return;
                if (lm.findLastVisibleItemPosition() >= adapter.getItemCount() - 4) {
                    page += 1;
                    fetch();
                }
            }
        });

        if (getIntent().getBooleanExtra(EXTRA_FOCUS_SEARCH, false)) {
            b.searchInput.requestFocus();
        }

        reload(false);
    }

    private final Runnable searchRunnable = () -> reload(false);

    private void reload(boolean fromSwipe) {
        page = 1;
        totalPages = 1;
        loaded.clear();
        if (!fromSwipe) b.progress.setVisibility(View.VISIBLE);
        fetch();
    }

    private void fetch() {
        loading = true;

        Map<String, String> query = new HashMap<>();
        query.put("page", String.valueOf(page));
        query.put("limit", "12");
        query.put("sort", SORT_VALUES[sortIndex]);
        if (categorySlug != null) query.put("category", categorySlug);
        if (featuredOnly) query.put("featured", "true");
        if (!search.isEmpty()) query.put("search", search);

        Repo.callPaged(Repo.api().products(query), new Repo.OnPaged<Product>() {
            @Override
            public void onSuccess(List<Product> items, Pagination pagination) {
                loading = false;
                b.progress.setVisibility(View.GONE);
                b.swipeRefresh.setRefreshing(false);

                loaded.addAll(items);
                adapter.submitList(new ArrayList<>(loaded));

                if (pagination != null) {
                    totalPages = Math.max(1, pagination.totalPages);
                    b.resultCount.setText(pagination.total + " product(s) found");
                }

                boolean empty = loaded.isEmpty();
                b.empty.getRoot().setVisibility(empty ? View.VISIBLE : View.GONE);
                b.empty.emptyTitle.setText(R.string.no_products_found);
                b.empty.emptyMessage.setText(R.string.no_products_hint);
            }

            @Override
            public void onError(String message) {
                loading = false;
                b.progress.setVisibility(View.GONE);
                b.swipeRefresh.setRefreshing(false);
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    /** Resolves SORT_LABEL_RES against the current locale. */
    private String[] sortLabels() {
        String[] labels = new String[SORT_LABEL_RES.length];
        for (int i = 0; i < labels.length; i++) {
            labels[i] = getString(SORT_LABEL_RES[i]);
        }
        return labels;
    }

    private void showSortDialog() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.sort_by)
                .setSingleChoiceItems(sortLabels(), sortIndex, (dialog, which) -> {
                    sortIndex = which;
                    dialog.dismiss();
                    reload(false);
                })
                .show();
    }

    /* ---------------------------- product actions --------------------------- */

    @Override
    public void onOpen(Product product) {
        startActivity(ProductDetailActivity.intent(this, product.slug));
    }

    @Override
    public void onAddToCart(Product product) {
        if (!SessionManager.get().isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            return;
        }
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
        if (!SessionManager.get().isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            return;
        }
        Repo.call(Repo.api().toggleWishlist(product.id), new Repo.OnResult<WishlistToggle>() {
            @Override
            public void onSuccess(WishlistToggle data, String message) {
                SessionManager.get().setWishlisted(product.id, data.inWishlist);
                adapter.notifyDataSetChanged();
                Ui.snack(b.getRoot(), message);
            }

            @Override
            public void onError(String message) {
                Ui.snack(b.getRoot(), message);
            }
        });
    }
}
