package com.auramart.app.data.model;

import com.google.gson.annotations.SerializedName;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * All API payload types in one file. They are plain Gson DTOs that mirror the
 * JSON the Express API returns, so keeping them together makes the contract
 * easy to read against the backend's response shapes.
 */
public final class Models {

    private Models() {
    }

    /* ------------------------------ envelopes ------------------------------ */

    public static class ApiResponse<T> {
        public boolean success;
        public String message;
        public T data;
        public List<FieldError> errors;
        /** Image search only: the area of the photo that was searched. */
        public SearchRegion region;
    }

    /** Part of a photo, as fractions (0..1) of the upright image. */
    public static class SearchRegion {
        public float x;
        public float y;
        public float w = 1f;
        public float h = 1f;
        /** True when the server's detector chose it, false when the user did. */
        public boolean auto = true;
        /** False when no single product stood out and the whole photo was used. */
        public boolean found = true;
    }

    public static class PagedResponse<T> {
        public boolean success;
        public String message;
        public List<T> data = new ArrayList<>();
        public Pagination pagination;
        public StatusCounts statusCounts;
    }

    public static class Pagination {
        public int page;
        public int limit;
        public int total;
        public int totalPages;
        public boolean hasNext;
        public boolean hasPrev;
    }

    public static class StatusCounts {
        public int all;
        public int pending;
        public int processing;
        public int shipped;
        public int delivered;
        public int cancelled;
    }

    public static class FieldError {
        public String field;
        public String message;
    }

    /* -------------------------------- auth -------------------------------- */

    public static class AuthData {
        public User user;
        public String accessToken;
        public String refreshToken;
    }

    public static class TokenData {
        public String accessToken;
        public String refreshToken;
    }

    public static class LoginRequest {
        public String email;
        public String password;

        public LoginRequest(String email, String password) {
            this.email = email;
            this.password = password;
        }
    }

    public static class RegisterRequest {
        public String name;
        public String email;
        public String password;
        public String phone;

        public RegisterRequest(String name, String email, String password, String phone) {
            this.name = name;
            this.email = email;
            this.password = password;
            this.phone = phone;
        }
    }

    public static class RefreshRequest {
        public String refreshToken;

        public RefreshRequest(String refreshToken) {
            this.refreshToken = refreshToken;
        }
    }

    public static class ChangePasswordRequest {
        public String currentPassword;
        public String newPassword;

        public ChangePasswordRequest(String currentPassword, String newPassword) {
            this.currentPassword = currentPassword;
            this.newPassword = newPassword;
        }
    }

    /* -------------------------------- user -------------------------------- */

    public static class User implements Serializable {
        @SerializedName("_id")
        public String id;
        public String name;
        public String email;
        public String phone;
        public String avatar;
        public String role;
        public boolean isActive;
        public List<Address> addresses = new ArrayList<>();
        public List<String> wishlist = new ArrayList<>();
        public String createdAt;

        public String initial() {
            return name == null || name.isEmpty() ? "?" : name.substring(0, 1).toUpperCase();
        }
    }

    public static class Address implements Serializable {
        @SerializedName("_id")
        public String id;
        public String label;
        public String fullName;
        public String phone;
        public String street;
        public String city;
        public String state;
        public String zipCode;
        public String country;
        public boolean isDefault;

        public String oneLine() {
            return street + ", " + city + " " + zipCode + ", " + country;
        }
    }

    public static class UpdateProfileRequest {
        public String name;
        public String phone;

        public UpdateProfileRequest(String name, String phone) {
            this.name = name;
            this.phone = phone;
        }
    }

    /** Body for PATCH /users/language: "en", "zh" or "ja". */
    public static class UpdateLanguageRequest {
        public String language;

        public UpdateLanguageRequest(String language) {
            this.language = language;
        }
    }

    /* ------------------------------- catalog ------------------------------ */

    public static class Category implements Serializable {
        @SerializedName("_id")
        public String id;
        public String name;
        public String slug;
        public String description;
        public String icon;
        public String image;
        public String parent;
        public Integer productCount;
    }

    public static class Variant implements Serializable {
        @SerializedName("_id")
        public String id;
        public String name;
        public String value;
        public String hex;
        public double priceDelta;
        public int stock;
    }

    public static class Product implements Serializable {
        @SerializedName("_id")
        public String id;
        public String name;
        public String slug;
        public String sku;
        public String brand;
        public String description;
        public String shortDescription;
        public Category category;
        public List<String> images = new ArrayList<>();
        public double price;
        public double comparePrice;
        public int stock;
        public List<Variant> variants = new ArrayList<>();
        public List<String> tags = new ArrayList<>();
        public List<String> colors = new ArrayList<>();
        public double rating;
        public int reviewCount;
        public int soldCount;
        public boolean isActive;
        public boolean isFeatured;
        public boolean freeShipping;
        public int warrantyMonths;
        public int returnDays;
        /** Cosine similarity to the query photo; only set on image-search results. */
        public Double similarity;

        public String firstImage() {
            return images == null || images.isEmpty() ? null : images.get(0);
        }

        public int discountPercent() {
            if (comparePrice <= price) return 0;
            return (int) Math.round((comparePrice - price) / comparePrice * 100);
        }

        public boolean inStock() {
            return stock > 0;
        }
    }

    /** GET products/visual-search/status: whether the API has the DINOv3 model loaded. */
    public static class VisualSearchStatus {
        public boolean enabled;
        public boolean available;
        /** Network the server indexed with, e.g. "dinov3-vits16/model.onnx". */
        public String model;
        /**
         * Set when the server traces the product's outline with SAM2 (e.g.
         * "sam2.1-hiera-tiny/vision_encoder_quantized.onnx"); null otherwise.
         */
        public String segmenter;
    }

    /** POST products/visual-search/vector: a feature vector computed on the phone. */
    public static class VectorSearchRequest {
        public final String model;
        public final float[] vector;
        public final int limit;

        public VectorSearchRequest(String model, float[] vector, int limit) {
            this.model = model;
            this.vector = vector;
            this.limit = limit;
        }
    }

    public static class ProductFilters {
        public List<FacetValue> brands = new ArrayList<>();
        public List<FacetValue> colors = new ArrayList<>();
        public PriceRange price;
    }

    public static class FacetValue {
        public String value;
        public int count;
    }

    public static class PriceRange {
        public double min;
        public double max;
    }

    public static class Banner implements Serializable {
        @SerializedName("_id")
        public String id;
        public String title;
        public String subtitle;
        public String image;
        public String ctaText;
        public String ctaLink;
        public String placement;
    }

    public static class Review implements Serializable {
        @SerializedName("_id")
        public String id;
        public User user;
        public int rating;
        public String title;
        public String comment;
        public boolean isVerifiedPurchase;
        public int helpfulCount;
        public String createdAt;
    }

    public static class ReviewSummary {
        public double average;
        public int total;
        public java.util.Map<String, Integer> buckets;
    }

    public static class CreateReviewRequest {
        public String productId;
        public int rating;
        public String title;
        public String comment;

        public CreateReviewRequest(String productId, int rating, String title, String comment) {
            this.productId = productId;
            this.rating = rating;
            this.title = title;
            this.comment = comment;
        }
    }

    /* --------------------------------- cart -------------------------------- */

    public static class CartProduct implements Serializable {
        @SerializedName("_id")
        public String id;
        public String name;
        public String slug;
        public String sku;
        public String brand;
        public String image;
        public double price;
        public double comparePrice;
        public int stock;
        public boolean freeShipping;
    }

    public static class CartVariant implements Serializable {
        public String name;
        public String value;
        public String hex;
    }

    public static class CartItem implements Serializable {
        @SerializedName("_id")
        public String id;
        public CartProduct product;
        public CartVariant variant;
        public int quantity;
        public double price;
        public double subtotal;
    }

    public static class Totals implements Serializable {
        public double subtotal;
        public double discount;
        public double shipping;
        public double tax;
        public double total;
    }

    public static class CartRules implements Serializable {
        public double freeShippingThreshold;
        public double flatRate;
        public double taxRate;
    }

    public static class AppliedCoupon implements Serializable {
        public String code;
        public String discountType;
        public double discountValue;
    }

    public static class Cart implements Serializable {
        @SerializedName("_id")
        public String id;
        public List<CartItem> items = new ArrayList<>();
        public int itemCount;
        public AppliedCoupon coupon;
        public Totals totals;
        public CartRules rules;
        public List<String> notices = new ArrayList<>();
    }

    public static class AddToCartRequest {
        public String productId;
        public int quantity;
        public CartVariant variant;

        public AddToCartRequest(String productId, int quantity, CartVariant variant) {
            this.productId = productId;
            this.quantity = quantity;
            this.variant = variant;
        }
    }

    public static class UpdateCartItemRequest {
        public int quantity;

        public UpdateCartItemRequest(int quantity) {
            this.quantity = quantity;
        }
    }

    public static class CouponRequest {
        public String code;

        public CouponRequest(String code) {
            this.code = code;
        }
    }

    /* -------------------------------- orders ------------------------------- */

    public static class OrderItem implements Serializable {
        @SerializedName("_id")
        public String id;
        public String product;
        public String name;
        public String image;
        public String sku;
        public double price;
        public int quantity;
        public CartVariant variant;
        public double subtotal;
    }

    public static class Payment implements Serializable {
        public String method;
        public String status;
        public String transactionId;
        public String cardLast4;
        public String paidAt;
    }

    public static class TimelineEntry implements Serializable {
        public String status;
        public String note;
        public String at;
    }

    public static class Order implements Serializable {
        @SerializedName("_id")
        public String id;
        public String orderNumber;
        public String customerName;
        public String customerEmail;
        public List<OrderItem> items = new ArrayList<>();
        public Address shippingAddress;
        public Payment payment;
        public Totals pricing;
        public String couponCode;
        public String status;
        public List<TimelineEntry> timeline = new ArrayList<>();
        public String trackingNumber;
        public String carrier;
        public String estimatedDelivery;
        public String createdAt;

        public int totalQuantity() {
            int n = 0;
            for (OrderItem i : items) n += i.quantity;
            return n;
        }
    }

    public static class TrackingStep implements Serializable {
        public String status;
        public boolean reached;
        public String at;
    }

    public static class Tracking implements Serializable {
        public String orderNumber;
        public String status;
        public String trackingNumber;
        public String carrier;
        public String estimatedDelivery;
        public boolean cancelled;
        public List<TrackingStep> steps = new ArrayList<>();
        public List<TimelineEntry> timeline = new ArrayList<>();
    }

    public static class CardDetails {
        public String number;
        public String name;

        public CardDetails(String number, String name) {
            this.number = number;
            this.name = name;
        }
    }

    public static class CreateOrderRequest {
        public String paymentMethod;
        public String addressId;
        public Address shippingAddress;
        public CardDetails card;
        public String notes;
    }

    public static class CancelOrderRequest {
        public String reason;

        public CancelOrderRequest(String reason) {
            this.reason = reason;
        }
    }

    /* ------------------------------- wishlist ------------------------------ */

    public static class WishlistToggle {
        public String productId;
        public boolean inWishlist;
    }
}
