package com.auramart.app.ui.product;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AddToCartRequest;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.CartVariant;
import com.auramart.app.data.model.Models.CreateReviewRequest;
import com.auramart.app.data.model.Models.Pagination;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.data.model.Models.Review;
import com.auramart.app.data.model.Models.Variant;
import com.auramart.app.data.model.Models.WishlistToggle;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityProductDetailBinding;
import com.auramart.app.databinding.DialogReviewBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.ui.adapter.ProductAdapter;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.main.MainActivity;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Ui;

import com.google.android.material.chip.Chip;

import java.util.List;
import java.util.Locale;

public class ProductDetailActivity extends AppCompatActivity implements ProductAdapter.Listener {

    private static final String EXTRA_SLUG = "slug";

    public static Intent intent(Context context, String slug) {
        Intent intent = new Intent(context, ProductDetailActivity.class);
        intent.putExtra(EXTRA_SLUG, slug);
        return intent;
    }

    private ActivityProductDetailBinding b;
    private Adapters.GalleryAdapter galleryAdapter;
    private Adapters.ReviewAdapter reviewAdapter;
    private ProductAdapter relatedAdapter;

    private Product product;
    private Variant selectedVariant;
    private int quantity = 1;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityProductDetailBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.toolbar.setNavigationOnClickListener(v -> finish());

        galleryAdapter = new Adapters.GalleryAdapter();
        reviewAdapter = new Adapters.ReviewAdapter();
        relatedAdapter = new ProductAdapter(this, 168);

        b.galleryPager.setAdapter(galleryAdapter);
        b.reviewList.setAdapter(reviewAdapter);
        b.relatedList.setAdapter(relatedAdapter);

        b.decreaseButton.setOnClickListener(v -> setQuantity(quantity - 1));
        b.increaseButton.setOnClickListener(v -> setQuantity(quantity + 1));
        b.addToCartButton.setOnClickListener(v -> addToCart(false));
        b.buyNowButton.setOnClickListener(v -> addToCart(true));
        b.wishlistButton.setOnClickListener(v -> toggleWishlist());
        b.writeReviewButton.setOnClickListener(v -> showReviewDialog());

        b.galleryPager.registerOnPageChangeCallback(
                new androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback() {
                    @Override
                    public void onPageSelected(int position) {
                        updateDots(position);
                    }
                });

        load(getIntent().getStringExtra(EXTRA_SLUG));
    }

    private void load(String slug) {
        b.progress.setVisibility(View.VISIBLE);

        Repo.call(Repo.api().product(slug), new Repo.OnResult<Product>() {
            @Override
            public void onSuccess(Product data, String message) {
                b.progress.setVisibility(View.GONE);
                product = data;
                bind();
            }

            @Override
            public void onError(String message) {
                b.progress.setVisibility(View.GONE);
                Ui.toast(ProductDetailActivity.this, message);
                finish();
            }
        });

        Repo.callPaged(Repo.api().productReviews(slug, 5), new Repo.OnPaged<Review>() {
            @Override
            public void onSuccess(List<Review> items, Pagination pagination) {
                reviewAdapter.submit(items);
                b.noReviewsText.setVisibility(items.isEmpty() ? View.VISIBLE : View.GONE);
                b.noReviewsText.setText(R.string.no_reviews_yet);
            }

            @Override
            public void onError(String message) {
                // Reviews are optional context; the page still works without them.
            }
        });

        Repo.call(Repo.api().relatedProducts(slug), new Repo.OnResult<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data, String message) {
                relatedAdapter.submitList(data);
                b.relatedBox.setVisibility(data.isEmpty() ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onError(String message) {
                b.relatedBox.setVisibility(View.GONE);
            }
        });
    }

    private void bind() {
        b.toolbar.setTitle(product.brand);
        galleryAdapter.submit(product.images);
        buildDots(product.images.size());

        b.brandText.setText(product.brand + " · " + product.sku);
        b.nameText.setText(product.name);
        b.ratingText.setText(String.format(Locale.US, "%.1f (%d reviews)", product.rating, product.reviewCount));
        b.soldText.setText(product.soldCount + " sold");
        b.priceText.setText(Formats.money(product.price));
        b.descriptionText.setText(product.description);
        b.shortDescriptionText.setText(product.shortDescription);
        b.reviewsTitle.setText(getString(R.string.reviews) + " (" + product.reviewCount + ")");

        if (product.comparePrice > product.price) {
            b.comparePriceText.setVisibility(View.VISIBLE);
            b.comparePriceText.setText(Formats.money(product.comparePrice));
            Adapters.strikeThrough(b.comparePriceText);
            b.discountBadge.setVisibility(View.VISIBLE);
            b.discountBadge.setText(product.discountPercent() + "% OFF");
        } else {
            b.comparePriceText.setVisibility(View.GONE);
            b.discountBadge.setVisibility(View.GONE);
        }

        if (product.stock <= 0) {
            b.stockBadge.setText(R.string.out_of_stock);
            b.stockBadge.setBackgroundResource(R.drawable.bg_badge_red);
            b.stockBadge.setTextColor(getColor(R.color.primary_dark));
        } else if (product.stock <= 10) {
            b.stockBadge.setText(getString(R.string.only_n_left, product.stock));
            b.stockBadge.setBackgroundResource(R.drawable.bg_badge_amber);
            b.stockBadge.setTextColor(getColor(R.color.warning_dark));
        } else {
            b.stockBadge.setText(R.string.in_stock);
            b.stockBadge.setBackgroundResource(R.drawable.bg_badge_green);
            b.stockBadge.setTextColor(getColor(R.color.success_dark));
        }

        b.shippingBadge.setText(product.freeShipping ? getString(R.string.free_shipping) : "Free over $50");
        b.warrantyBadge.setText((product.warrantyMonths > 0 ? product.warrantyMonths : 12) + " mo warranty");
        b.returnBadge.setText((product.returnDays > 0 ? product.returnDays : 30) + " day returns");

        buildVariants();
        setQuantity(1);
        updateWishlistIcon();

        boolean available = product.stock > 0;
        b.addToCartButton.setEnabled(available);
        b.buyNowButton.setEnabled(available);
    }

    private void buildVariants() {
        b.variantGroup.removeAllViews();
        if (product.variants == null || product.variants.isEmpty()) {
            b.variantGroup.setVisibility(View.GONE);
            b.variantLabel.setVisibility(View.GONE);
            return;
        }

        b.variantGroup.setVisibility(View.VISIBLE);
        b.variantLabel.setVisibility(View.VISIBLE);
        b.variantLabel.setText(product.variants.get(0).name);

        for (Variant variant : product.variants) {
            Chip chip = new Chip(this);
            chip.setText(variant.value);
            chip.setCheckable(true);
            chip.setEnabled(variant.stock > 0);
            chip.setOnClickListener(v -> selectedVariant = variant);
            b.variantGroup.addView(chip);

            if (selectedVariant == null && variant.stock > 0) {
                selectedVariant = variant;
                chip.setChecked(true);
            }
        }
    }

    private void buildDots(int count) {
        b.galleryDots.removeAllViews();
        if (count <= 1) return;

        float density = getResources().getDisplayMetrics().density;
        for (int i = 0; i < count; i += 1) {
            View dot = new View(this);
            int size = Math.round(7 * density);
            android.widget.LinearLayout.LayoutParams lp =
                    new android.widget.LinearLayout.LayoutParams(size, size);
            lp.setMargins(Math.round(3 * density), 0, Math.round(3 * density), 0);
            dot.setLayoutParams(lp);
            dot.setBackgroundResource(R.drawable.bg_dot_primary);
            dot.setAlpha(i == 0 ? 1f : 0.3f);
            b.galleryDots.addView(dot);
        }
    }

    private void updateDots(int selected) {
        for (int i = 0; i < b.galleryDots.getChildCount(); i += 1) {
            b.galleryDots.getChildAt(i).setAlpha(i == selected ? 1f : 0.3f);
        }
    }

    private void setQuantity(int value) {
        int max = Math.max(1, product == null ? 1 : product.stock);
        quantity = Math.max(1, Math.min(value, max));
        b.quantityText.setText(String.valueOf(quantity));
        b.decreaseButton.setAlpha(quantity > 1 ? 1f : 0.35f);
        b.increaseButton.setAlpha(quantity < max ? 1f : 0.35f);
    }

    private void addToCart(boolean buyNow) {
        if (!SessionManager.get().isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            return;
        }

        CartVariant variant = null;
        if (selectedVariant != null) {
            variant = new CartVariant();
            variant.name = selectedVariant.name;
            variant.value = selectedVariant.value;
            variant.hex = selectedVariant.hex;
        }

        b.addToCartButton.setEnabled(false);
        b.buyNowButton.setEnabled(false);

        Repo.call(Repo.api().addToCart(new AddToCartRequest(product.id, quantity, variant)),
                new Repo.OnResult<Cart>() {
                    @Override
                    public void onSuccess(Cart cart, String message) {
                        SessionManager.get().setCartCount(cart.itemCount);
                        b.addToCartButton.setEnabled(true);
                        b.buyNowButton.setEnabled(true);

                        if (buyNow) {
                            Intent intent = new Intent(ProductDetailActivity.this, MainActivity.class);
                            intent.putExtra(MainActivity.EXTRA_TAB, MainActivity.TAB_CART);
                            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                            startActivity(intent);
                        } else {
                            Ui.snack(b.getRoot(), message);
                        }
                    }

                    @Override
                    public void onError(String message) {
                        b.addToCartButton.setEnabled(true);
                        b.buyNowButton.setEnabled(true);
                        Ui.snack(b.getRoot(), message);
                    }
                });
    }

    private void toggleWishlist() {
        if (!SessionManager.get().isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            return;
        }
        Repo.call(Repo.api().toggleWishlist(product.id), new Repo.OnResult<WishlistToggle>() {
            @Override
            public void onSuccess(WishlistToggle data, String message) {
                SessionManager.get().setWishlisted(product.id, data.inWishlist);
                updateWishlistIcon();
                Ui.snack(b.getRoot(), message);
            }

            @Override
            public void onError(String message) {
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    private void updateWishlistIcon() {
        boolean wished = SessionManager.get().isWishlisted(product.id);
        b.wishlistButton.setImageResource(wished ? R.drawable.ic_heart_filled : R.drawable.ic_heart);
        b.wishlistButton.setColorFilter(getColor(wished ? R.color.primary : R.color.ink_600));
    }

    private void showReviewDialog() {
        if (!SessionManager.get().isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            return;
        }

        DialogReviewBinding d = DialogReviewBinding.inflate(LayoutInflater.from(this));
        final int[] rating = {5};

        ImageView[] stars = {d.star1, d.star2, d.star3, d.star4, d.star5};
        for (int i = 0; i < stars.length; i += 1) {
            final int value = i + 1;
            stars[i].setOnClickListener(v -> {
                rating[0] = value;
                paintStars(stars, value);
            });
        }
        paintStars(stars, rating[0]);

        new AlertDialog.Builder(this)
                .setTitle(R.string.write_review)
                .setView(d.getRoot())
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.submit_review, (dialog, which) -> {
                    String title = String.valueOf(d.titleInput.getText()).trim();
                    String comment = String.valueOf(d.commentInput.getText()).trim();
                    submitReview(rating[0], title, comment);
                })
                .show();
    }

    private void paintStars(ImageView[] stars, int rating) {
        for (int i = 0; i < stars.length; i += 1) {
            stars[i].setImageResource(i < rating ? R.drawable.ic_star_filled : R.drawable.ic_star);
            stars[i].setColorFilter(getColor(i < rating ? R.color.warning : R.color.ink_300));
        }
    }

    private void submitReview(int rating, String title, String comment) {
        Repo.call(
                Repo.api().createReview(new CreateReviewRequest(product.id, rating, title, comment)),
                new Repo.OnResult<Review>() {
                    @Override
                    public void onSuccess(Review data, String message) {
                        Ui.snack(b.getRoot(), message);
                        load(product.slug);
                    }

                    @Override
                    public void onError(String message) {
                        Ui.snack(b.getRoot(), message);
                    }
                });
    }

    /* --------------------------- related products --------------------------- */

    @Override
    public void onOpen(Product related) {
        startActivity(intent(this, related.slug));
    }

    @Override
    public void onAddToCart(Product related) {
        Repo.call(Repo.api().addToCart(new AddToCartRequest(related.id, 1, null)),
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
    public void onToggleWishlist(Product related) {
        Repo.call(Repo.api().toggleWishlist(related.id), new Repo.OnResult<WishlistToggle>() {
            @Override
            public void onSuccess(WishlistToggle data, String message) {
                SessionManager.get().setWishlisted(related.id, data.inWishlist);
                relatedAdapter.notifyDataSetChanged();
                Ui.snack(b.getRoot(), message);
            }

            @Override
            public void onError(String message) {
                Ui.snack(b.getRoot(), message);
            }
        });
    }
}
