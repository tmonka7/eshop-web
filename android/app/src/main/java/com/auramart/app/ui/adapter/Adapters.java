package com.auramart.app.ui.adapter;

import android.graphics.Paint;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.auramart.app.R;
import com.auramart.app.data.model.Models.Address;
import com.auramart.app.data.model.Models.Banner;
import com.auramart.app.data.model.Models.CartItem;
import com.auramart.app.data.model.Models.Category;
import com.auramart.app.data.model.Models.Order;
import com.auramart.app.data.model.Models.OrderItem;
import com.auramart.app.data.model.Models.Review;
import com.auramart.app.data.model.Models.TrackingStep;
import com.auramart.app.databinding.ItemAddressBinding;
import com.auramart.app.databinding.ItemBannerBinding;
import com.auramart.app.databinding.ItemCartBinding;
import com.auramart.app.databinding.ItemCategoryBinding;
import com.auramart.app.databinding.ItemCategoryRowBinding;
import com.auramart.app.databinding.ItemGalleryImageBinding;
import com.auramart.app.databinding.ItemOrderBinding;
import com.auramart.app.databinding.ItemOrderProductBinding;
import com.auramart.app.databinding.ItemReviewBinding;
import com.auramart.app.databinding.ItemTrackingStepBinding;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Images;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The simpler list adapters, grouped so each one stays a short static class
 * instead of a file of its own. ProductAdapter lives separately because it
 * carries more behaviour.
 */
public final class Adapters {

    private Adapters() {
    }

    /** Base adapter that keeps a mutable list and a click callback. */
    public abstract static class Base<T, VB> extends RecyclerView.Adapter<Holder<VB>> {
        protected final List<T> items = new ArrayList<>();

        public void submit(List<T> next) {
            items.clear();
            if (next != null) items.addAll(next);
            notifyDataSetChanged();
        }

        public List<T> items() {
            return items;
        }

        @Override
        public int getItemCount() {
            return items.size();
        }
    }

    public static class Holder<VB> extends RecyclerView.ViewHolder {
        public final VB binding;

        Holder(View root, VB binding) {
            super(root);
            this.binding = binding;
        }
    }

    public interface OnClick<T> {
        void onClick(T item);
    }

    /* ------------------------------ categories ----------------------------- */

    /** Circular category chips on the Home screen. */
    public static class CategoryChipAdapter extends Base<Category, ItemCategoryBinding> {
        private final OnClick<Category> onClick;

        public CategoryChipAdapter(OnClick<Category> onClick) {
            this.onClick = onClick;
        }

        @NonNull
        @Override
        public Holder<ItemCategoryBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemCategoryBinding b = ItemCategoryBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemCategoryBinding> holder, int position) {
            Category c = items.get(position);
            Images.load(holder.binding.categoryImage, c.image);
            holder.binding.categoryName.setText(c.name);
            holder.binding.rootView.setOnClickListener(v -> onClick.onClick(c));
        }
    }

    /** Full-width category rows on the Categories tab. */
    public static class CategoryRowAdapter extends Base<Category, ItemCategoryRowBinding> {
        private final OnClick<Category> onClick;

        public CategoryRowAdapter(OnClick<Category> onClick) {
            this.onClick = onClick;
        }

        @NonNull
        @Override
        public Holder<ItemCategoryRowBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemCategoryRowBinding b = ItemCategoryRowBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemCategoryRowBinding> holder, int position) {
            Category c = items.get(position);
            Images.load(holder.binding.categoryImage, c.image);
            holder.binding.categoryName.setText(c.name);

            String meta = c.productCount != null
                    ? c.productCount + " products"
                    : (c.description == null ? "" : c.description);
            holder.binding.categoryMeta.setText(meta);

            holder.binding.rootView.setOnClickListener(v -> onClick.onClick(c));
        }
    }

    /* -------------------------------- banners ------------------------------ */

    public static class BannerAdapter extends Base<Banner, ItemBannerBinding> {
        private final OnClick<Banner> onClick;

        public BannerAdapter(OnClick<Banner> onClick) {
            this.onClick = onClick;
        }

        @NonNull
        @Override
        public Holder<ItemBannerBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemBannerBinding b = ItemBannerBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemBannerBinding> holder, int position) {
            Banner banner = items.get(position);
            Images.load(holder.binding.bannerImage, banner.image);
            holder.binding.bannerTitle.setText(banner.title);
            holder.binding.bannerSubtitle.setText(banner.subtitle);
            holder.binding.bannerCta.setText(banner.ctaText);
            holder.binding.bannerCta.setOnClickListener(v -> onClick.onClick(banner));
            holder.binding.bannerCard.setOnClickListener(v -> onClick.onClick(banner));
        }
    }

    /* -------------------------------- gallery ------------------------------ */

    public static class GalleryAdapter extends Base<String, ItemGalleryImageBinding> {
        @NonNull
        @Override
        public Holder<ItemGalleryImageBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemGalleryImageBinding b = ItemGalleryImageBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemGalleryImageBinding> holder, int position) {
            Images.load(holder.binding.galleryImage, items.get(position));
        }
    }

    /* --------------------------------- cart -------------------------------- */

    public static class CartAdapter extends Base<CartItem, ItemCartBinding> {

        public interface Listener {
            void onQuantityChange(CartItem item, int quantity);

            void onRemove(CartItem item);

            void onOpen(CartItem item);
        }

        private final Listener listener;

        public CartAdapter(Listener listener) {
            this.listener = listener;
        }

        @NonNull
        @Override
        public Holder<ItemCartBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemCartBinding b = ItemCartBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemCartBinding> holder, int position) {
            CartItem item = items.get(position);
            ItemCartBinding b = holder.binding;

            Images.load(b.productImage, item.product.image);
            b.nameText.setText(item.product.name);
            b.priceText.setText(Formats.money(item.price));
            b.quantityText.setText(String.valueOf(item.quantity));
            b.subtotalText.setText(Formats.money(item.subtotal));

            if (item.variant != null && item.variant.value != null && !item.variant.value.isEmpty()) {
                b.variantText.setVisibility(View.VISIBLE);
                b.variantText.setText(item.variant.name + ": " + item.variant.value);
            } else {
                b.variantText.setVisibility(View.GONE);
            }

            b.decreaseButton.setEnabled(item.quantity > 1);
            b.decreaseButton.setAlpha(item.quantity > 1 ? 1f : 0.35f);
            b.increaseButton.setEnabled(item.quantity < item.product.stock);
            b.increaseButton.setAlpha(item.quantity < item.product.stock ? 1f : 0.35f);

            b.decreaseButton.setOnClickListener(v -> listener.onQuantityChange(item, item.quantity - 1));
            b.increaseButton.setOnClickListener(v -> listener.onQuantityChange(item, item.quantity + 1));
            b.removeButton.setOnClickListener(v -> listener.onRemove(item));
            b.productImage.setOnClickListener(v -> listener.onOpen(item));
        }
    }

    /* -------------------------------- orders ------------------------------- */

    public static class OrderAdapter extends Base<Order, ItemOrderBinding> {
        private final OnClick<Order> onClick;

        public OrderAdapter(OnClick<Order> onClick) {
            this.onClick = onClick;
        }

        @NonNull
        @Override
        public Holder<ItemOrderBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemOrderBinding b = ItemOrderBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemOrderBinding> holder, int position) {
            Order order = items.get(position);
            ItemOrderBinding b = holder.binding;

            b.orderNumberText.setText("#" + order.orderNumber);
            b.dateText.setText(Formats.date(order.createdAt));
            b.totalText.setText(Formats.money(order.pricing.total));

            b.statusBadge.setText(Formats.label(holder.itemView.getContext(), order.status));
            b.statusBadge.setBackgroundResource(StatusStyle.background(order.status));
            b.statusBadge.setTextColor(b.getRoot().getContext().getColor(StatusStyle.textColor(order.status)));

            if (!order.items.isEmpty()) {
                OrderItem first = order.items.get(0);
                Images.load(b.thumbImage, first.image);
                b.summaryText.setText(order.items.size() == 1
                        ? first.name
                        : first.name + " + " + (order.items.size() - 1) + " more");
            }
            b.itemCountText.setText(order.totalQuantity() + " item(s)");

            b.rootView.setOnClickListener(v -> onClick.onClick(order));
        }
    }

    public static class OrderItemAdapter extends Base<OrderItem, ItemOrderProductBinding> {
        @NonNull
        @Override
        public Holder<ItemOrderProductBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemOrderProductBinding b = ItemOrderProductBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemOrderProductBinding> holder, int position) {
            OrderItem item = items.get(position);
            Images.load(holder.binding.productImage, item.image);
            holder.binding.nameText.setText(item.name);

            String meta = holder.itemView.getContext()
                    .getString(R.string.qty_and_price, item.quantity, Formats.money(item.price));
            if (item.variant != null && item.variant.value != null && !item.variant.value.isEmpty()) {
                meta += " · " + item.variant.value;
            }
            holder.binding.metaText.setText(meta);
            holder.binding.subtotalText.setText(Formats.money(item.subtotal));
        }
    }

    /** Checkout uses the same row but reads from the live cart. */
    public static class CheckoutItemAdapter extends Base<CartItem, ItemOrderProductBinding> {
        @NonNull
        @Override
        public Holder<ItemOrderProductBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemOrderProductBinding b = ItemOrderProductBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemOrderProductBinding> holder, int position) {
            CartItem item = items.get(position);
            Images.load(holder.binding.productImage, item.product.image);
            holder.binding.nameText.setText(item.product.name);
            holder.binding.metaText.setText(holder.itemView.getContext()
                    .getString(R.string.qty_and_price, item.quantity, Formats.money(item.price)));
            holder.binding.subtotalText.setText(Formats.money(item.subtotal));
        }
    }

    /* ------------------------------- tracking ------------------------------ */

    public static class TrackingAdapter extends Base<TrackingStep, ItemTrackingStepBinding> {
        @NonNull
        @Override
        public Holder<ItemTrackingStepBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemTrackingStepBinding b = ItemTrackingStepBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemTrackingStepBinding> holder, int position) {
            TrackingStep step = items.get(position);
            ItemTrackingStepBinding b = holder.binding;

            b.stepTitle.setText(Formats.label(holder.itemView.getContext(), step.status));
            b.stepDate.setText(step.at != null
                    ? Formats.dateTime(step.at)
                    : holder.itemView.getContext().getString(R.string.status_pending_step));

            int bg = step.reached ? R.drawable.bg_badge_green : R.drawable.bg_badge_grey;
            int tint = step.reached ? R.color.success_dark : R.color.ink_400;
            b.stepDot.setBackgroundResource(bg);
            b.stepDot.setColorFilter(b.getRoot().getContext().getColor(tint));

            // The last step has nothing below it, so hide its connector.
            b.stepLine.setVisibility(position == items.size() - 1 ? View.INVISIBLE : View.VISIBLE);
        }
    }

    /* ------------------------------- reviews ------------------------------- */

    public static class ReviewAdapter extends Base<Review, ItemReviewBinding> {
        @NonNull
        @Override
        public Holder<ItemReviewBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemReviewBinding b = ItemReviewBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemReviewBinding> holder, int position) {
            Review r = items.get(position);
            ItemReviewBinding b = holder.binding;

            String name = r.user != null && r.user.name != null
                    ? r.user.name
                    : holder.itemView.getContext().getString(R.string.customer);
            b.nameText.setText(name);
            b.avatarText.setText(name.substring(0, 1).toUpperCase(Locale.US));
            b.ratingText.setText(String.valueOf(r.rating));
            b.dateText.setText(Formats.date(r.createdAt));
            b.commentText.setText(r.comment);
            b.verifiedBadge.setVisibility(r.isVerifiedPurchase ? View.VISIBLE : View.GONE);

            if (r.title != null && !r.title.isEmpty()) {
                b.titleText.setVisibility(View.VISIBLE);
                b.titleText.setText(r.title);
            } else {
                b.titleText.setVisibility(View.GONE);
            }
        }
    }

    /* ------------------------------ addresses ------------------------------ */

    public static class AddressAdapter extends Base<Address, ItemAddressBinding> {

        public interface Listener {
            void onMakeDefault(Address address);

            void onDelete(Address address);
        }

        private final Listener listener;

        public AddressAdapter(Listener listener) {
            this.listener = listener;
        }

        @NonNull
        @Override
        public Holder<ItemAddressBinding> onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ItemAddressBinding b = ItemAddressBinding.inflate(
                    LayoutInflater.from(parent.getContext()), parent, false);
            return new Holder<>(b.getRoot(), b);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder<ItemAddressBinding> holder, int position) {
            Address a = items.get(position);
            ItemAddressBinding b = holder.binding;

            b.labelText.setText(a.label == null || a.label.isEmpty()
                    ? holder.itemView.getContext().getString(R.string.address)
                    : a.label);
            b.nameText.setText(a.fullName);
            b.addressText.setText(a.oneLine());
            b.defaultBadge.setVisibility(a.isDefault ? View.VISIBLE : View.GONE);
            b.makeDefaultButton.setVisibility(a.isDefault ? View.GONE : View.VISIBLE);

            b.makeDefaultButton.setOnClickListener(v -> listener.onMakeDefault(a));
            b.deleteButton.setOnClickListener(v -> listener.onDelete(a));
        }
    }

    /* -------------------------- shared status styling ---------------------- */

    public static final class StatusStyle {

        private StatusStyle() {
        }

        public static int background(String status) {
            if (status == null) return R.drawable.bg_badge_grey;
            return switch (status) {
                case "pending" -> R.drawable.bg_badge_amber;
                case "processing" -> R.drawable.bg_badge_blue;
                case "shipped" -> R.drawable.bg_badge_purple;
                case "delivered" -> R.drawable.bg_badge_green;
                case "cancelled" -> R.drawable.bg_badge_red;
                default -> R.drawable.bg_badge_grey;
            };
        }

        public static int textColor(String status) {
            if (status == null) return R.color.ink_600;
            return switch (status) {
                case "pending" -> R.color.warning_dark;
                case "processing" -> R.color.info_dark;
                case "shipped" -> R.color.purple;
                case "delivered" -> R.color.success_dark;
                case "cancelled" -> R.color.danger_dark;
                default -> R.color.ink_600;
            };
        }
    }

    /** Applies a strike-through to a compare-at price label. */
    public static void strikeThrough(android.widget.TextView view) {
        view.setPaintFlags(view.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
    }
}
