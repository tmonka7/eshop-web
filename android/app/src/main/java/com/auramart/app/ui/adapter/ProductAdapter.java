package com.auramart.app.ui.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.DiffUtil;
import androidx.recyclerview.widget.ListAdapter;
import androidx.recyclerview.widget.RecyclerView;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.databinding.ItemProductGridBinding;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Images;

import java.util.Locale;

/** Grid/carousel product tile used on Home, search results and the wishlist. */
public class ProductAdapter extends ListAdapter<Product, ProductAdapter.VH> {

    public interface Listener {
        void onOpen(Product product);

        void onAddToCart(Product product);

        void onToggleWishlist(Product product);
    }

    private final Listener listener;
    private final Integer fixedWidthDp;

    public ProductAdapter(Listener listener) {
        this(listener, null);
    }

    /** A fixed width turns the tile into a horizontal carousel card. */
    public ProductAdapter(Listener listener, Integer fixedWidthDp) {
        super(DIFF);
        this.listener = listener;
        this.fixedWidthDp = fixedWidthDp;
    }

    private static final DiffUtil.ItemCallback<Product> DIFF = new DiffUtil.ItemCallback<>() {
        @Override
        public boolean areItemsTheSame(@NonNull Product a, @NonNull Product b) {
            return a.id.equals(b.id);
        }

        @Override
        public boolean areContentsTheSame(@NonNull Product a, @NonNull Product b) {
            return a.price == b.price
                    && a.stock == b.stock
                    && a.rating == b.rating
                    && a.name.equals(b.name);
        }
    };

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemProductGridBinding binding = ItemProductGridBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);

        if (fixedWidthDp != null) {
            float density = parent.getResources().getDisplayMetrics().density;
            ViewGroup.LayoutParams lp = binding.getRoot().getLayoutParams();
            lp.width = Math.round(fixedWidthDp * density);
            binding.getRoot().setLayoutParams(lp);
        }
        return new VH(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull VH holder, int position) {
        holder.bind(getItem(position));
    }

    class VH extends RecyclerView.ViewHolder {

        private final ItemProductGridBinding b;

        VH(ItemProductGridBinding binding) {
            super(binding.getRoot());
            this.b = binding;
        }

        void bind(Product p) {
            Images.load(b.productImage, p.firstImage());
            b.brandText.setText(p.brand);
            b.nameText.setText(p.name);
            b.ratingText.setText(String.format(Locale.US, "%.1f (%d)", p.rating, p.reviewCount));
            b.priceText.setText(Formats.money(p.price));

            if (p.comparePrice > p.price) {
                b.comparePriceText.setVisibility(View.VISIBLE);
                b.comparePriceText.setText(Formats.money(p.comparePrice));
                b.comparePriceText.setPaintFlags(
                        b.comparePriceText.getPaintFlags() | android.graphics.Paint.STRIKE_THRU_TEXT_FLAG);
            } else {
                b.comparePriceText.setVisibility(View.GONE);
            }

            int off = p.discountPercent();
            if (!p.inStock()) {
                b.discountBadge.setVisibility(View.VISIBLE);
                b.discountBadge.setText(R.string.out_of_stock);
                b.discountBadge.setBackgroundResource(R.drawable.bg_badge_grey);
                b.discountBadge.setBackgroundTintList(null);
            } else if (off > 0) {
                b.discountBadge.setVisibility(View.VISIBLE);
                b.discountBadge.setText(String.format(Locale.US, "%d%% OFF", off));
            } else {
                b.discountBadge.setVisibility(View.GONE);
            }

            boolean wished = SessionManager.get().isWishlisted(p.id);
            b.wishlistButton.setImageResource(wished ? R.drawable.ic_heart_filled : R.drawable.ic_heart);
            b.wishlistButton.setColorFilter(
                    b.getRoot().getContext().getColor(wished ? R.color.primary : R.color.ink_500));

            b.addToCartButton.setEnabled(p.inStock());
            b.addToCartButton.setText(p.inStock() ? R.string.add_to_cart : R.string.out_of_stock);

            b.card.setOnClickListener(v -> listener.onOpen(p));
            b.addToCartButton.setOnClickListener(v -> listener.onAddToCart(p));
            b.wishlistButton.setOnClickListener(v -> listener.onToggleWishlist(p));
        }
    }
}
