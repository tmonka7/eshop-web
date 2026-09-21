package com.auramart.app.data.remote;

import com.auramart.app.data.model.Models.AddToCartRequest;
import com.auramart.app.data.model.Models.ApiResponse;
import com.auramart.app.data.model.Models.Address;
import com.auramart.app.data.model.Models.AuthData;
import com.auramart.app.data.model.Models.Banner;
import com.auramart.app.data.model.Models.CancelOrderRequest;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.Category;
import com.auramart.app.data.model.Models.ChangePasswordRequest;
import com.auramart.app.data.model.Models.CouponRequest;
import com.auramart.app.data.model.Models.CreateOrderRequest;
import com.auramart.app.data.model.Models.CreateReviewRequest;
import com.auramart.app.data.model.Models.LoginRequest;
import com.auramart.app.data.model.Models.Order;
import com.auramart.app.data.model.Models.PagedResponse;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.data.model.Models.ProductFilters;
import com.auramart.app.data.model.Models.RefreshRequest;
import com.auramart.app.data.model.Models.RegisterRequest;
import com.auramart.app.data.model.Models.Review;
import com.auramart.app.data.model.Models.ReviewSummary;
import com.auramart.app.data.model.Models.TokenData;
import com.auramart.app.data.model.Models.Tracking;
import com.auramart.app.data.model.Models.UpdateCartItemRequest;
import com.auramart.app.data.model.Models.UpdateProfileRequest;
import com.auramart.app.data.model.Models.User;
import com.auramart.app.data.model.Models.WishlistToggle;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.PATCH;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;
import retrofit2.http.QueryMap;

/** Every endpoint the mobile app consumes. Paths are relative to API_BASE_URL. */
public interface ApiService {

    /* --------------------------------- auth -------------------------------- */

    @POST("auth/register")
    Call<ApiResponse<AuthData>> register(@Body RegisterRequest body);

    @POST("auth/login")
    Call<ApiResponse<AuthData>> login(@Body LoginRequest body);

    @POST("auth/refresh")
    Call<ApiResponse<TokenData>> refresh(@Body RefreshRequest body);

    @POST("auth/logout")
    Call<ApiResponse<Void>> logout(@Body RefreshRequest body);

    @GET("auth/me")
    Call<ApiResponse<User>> me();

    @PATCH("auth/password")
    Call<ApiResponse<Void>> changePassword(@Body ChangePasswordRequest body);

    /* ------------------------------- catalog ------------------------------- */

    @GET("categories")
    Call<ApiResponse<List<Category>>> categories(@QueryMap Map<String, String> query);

    @GET("products")
    Call<PagedResponse<Product>> products(@QueryMap Map<String, String> query);

    @GET("products/filters")
    Call<ApiResponse<ProductFilters>> productFilters(@Query("category") String category);

    @GET("products/featured")
    Call<ApiResponse<List<Product>>> featured(@Query("limit") int limit);

    @GET("products/best-sellers")
    Call<ApiResponse<List<Product>>> bestSellers(@Query("limit") int limit);

    @GET("products/{slug}")
    Call<ApiResponse<Product>> product(@Path("slug") String slug);

    @GET("products/{slug}/related")
    Call<ApiResponse<List<Product>>> relatedProducts(@Path("slug") String slug);

    @GET("products/{slug}/reviews")
    Call<PagedResponse<Review>> productReviews(@Path("slug") String slug, @Query("limit") int limit);

    @GET("products/{slug}/reviews/summary")
    Call<ApiResponse<ReviewSummary>> reviewSummary(@Path("slug") String slug);

    @GET("banners")
    Call<ApiResponse<List<Banner>>> banners(@Query("placement") String placement);

    /* --------------------------------- cart -------------------------------- */

    @GET("cart")
    Call<ApiResponse<Cart>> cart();

    @POST("cart/items")
    Call<ApiResponse<Cart>> addToCart(@Body AddToCartRequest body);

    @PATCH("cart/items/{itemId}")
    Call<ApiResponse<Cart>> updateCartItem(@Path("itemId") String itemId, @Body UpdateCartItemRequest body);

    @DELETE("cart/items/{itemId}")
    Call<ApiResponse<Cart>> removeCartItem(@Path("itemId") String itemId);

    @DELETE("cart")
    Call<ApiResponse<Cart>> clearCart();

    @POST("cart/coupon")
    Call<ApiResponse<Cart>> applyCoupon(@Body CouponRequest body);

    @DELETE("cart/coupon")
    Call<ApiResponse<Cart>> removeCoupon();

    /* -------------------------------- orders ------------------------------- */

    @GET("checkout/preview")
    Call<ApiResponse<Cart>> checkoutPreview();

    @POST("orders")
    Call<ApiResponse<Order>> createOrder(@Body CreateOrderRequest body);

    @GET("orders")
    Call<PagedResponse<Order>> orders(@QueryMap Map<String, String> query);

    @GET("orders/{id}")
    Call<ApiResponse<Order>> order(@Path("id") String id);

    @GET("orders/{id}/track")
    Call<ApiResponse<Tracking>> trackOrder(@Path("id") String id);

    @POST("orders/{id}/cancel")
    Call<ApiResponse<Order>> cancelOrder(@Path("id") String id, @Body CancelOrderRequest body);

    /* -------------------------------- account ------------------------------ */

    @PATCH("users/profile")
    Call<ApiResponse<User>> updateProfile(@Body UpdateProfileRequest body);

    @GET("users/addresses")
    Call<ApiResponse<List<Address>>> addresses();

    @POST("users/addresses")
    Call<ApiResponse<List<Address>>> addAddress(@Body Address body);

    @PATCH("users/addresses/{id}")
    Call<ApiResponse<List<Address>>> updateAddress(@Path("id") String id, @Body Address body);

    @DELETE("users/addresses/{id}")
    Call<ApiResponse<List<Address>>> deleteAddress(@Path("id") String id);

    @PATCH("users/addresses/{id}/default")
    Call<ApiResponse<List<Address>>> setDefaultAddress(@Path("id") String id);

    @GET("users/wishlist")
    Call<ApiResponse<List<Product>>> wishlist();

    @POST("users/wishlist/{productId}")
    Call<ApiResponse<WishlistToggle>> toggleWishlist(@Path("productId") String productId);

    /* -------------------------------- reviews ------------------------------ */

    @POST("reviews")
    Call<ApiResponse<Review>> createReview(@Body CreateReviewRequest body);
}
