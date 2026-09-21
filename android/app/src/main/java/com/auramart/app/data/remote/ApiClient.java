package com.auramart.app.data.remote;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.auramart.app.BuildConfig;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.ApiResponse;
import com.auramart.app.data.model.Models.RefreshRequest;
import com.auramart.app.data.model.Models.TokenData;
import com.auramart.app.util.LocaleManager;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/** Builds the shared Retrofit instance and wires token handling into OkHttp. */
public final class ApiClient {

    private static volatile ApiService service;
    private static final Gson GSON = new GsonBuilder().setLenient().create();

    /** Broadcast to the UI when the refresh token is rejected. */
    public interface SessionExpiredListener {
        void onSessionExpired();
    }

    @Nullable
    private static SessionExpiredListener sessionExpiredListener;

    private ApiClient() {
    }

    public static void setSessionExpiredListener(@Nullable SessionExpiredListener listener) {
        sessionExpiredListener = listener;
    }

    public static ApiService get() {
        if (service == null) {
            synchronized (ApiClient.class) {
                if (service == null) {
                    service = build();
                }
            }
        }
        return service;
    }

    private static ApiService build() {
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
        logging.setLevel(BuildConfig.DEBUG
                ? HttpLoggingInterceptor.Level.BODY
                : HttpLoggingInterceptor.Level.NONE);

        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(new AuthInterceptor())
                .addInterceptor(logging)
                .build();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(BuildConfig.API_BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create(GSON))
                .build();

        return retrofit.create(ApiService.class);
    }

    /**
     * Attaches the bearer token and the language header, and on a 401 performs
     * one synchronous refresh before replaying the original request. The lock
     * keeps parallel requests from each firing their own refresh.
     */
    private static class AuthInterceptor implements Interceptor {

        private static final Object REFRESH_LOCK = new Object();

        @NonNull
        @Override
        public Response intercept(@NonNull Chain chain) throws IOException {
            Request original = chain.request();
            String path = original.url().encodedPath();

            // The auth endpoints must not carry a stale token or trigger a refresh loop.
            boolean isAuthCall = path.endsWith("/auth/login")
                    || path.endsWith("/auth/register")
                    || path.endsWith("/auth/refresh");

            Request request = withLanguage(isAuthCall ? original : withToken(original));
            Response response = chain.proceed(request);

            if (response.code() != 401 || isAuthCall) {
                return response;
            }

            response.close();

            String refreshed;
            synchronized (REFRESH_LOCK) {
                String tokenBeforeLock = SessionManager.get().getAccessToken();
                String attempted = request.header("Authorization");
                // Another thread may already have refreshed while we waited.
                if (attempted != null && tokenBeforeLock != null
                        && !attempted.equals("Bearer " + tokenBeforeLock)) {
                    refreshed = tokenBeforeLock;
                } else {
                    refreshed = refreshToken();
                }
            }

            if (refreshed == null) {
                SessionManager.get().clear();
                if (sessionExpiredListener != null) {
                    sessionExpiredListener.onSessionExpired();
                }
                return chain.proceed(request);
            }

            return chain.proceed(withLanguage(original.newBuilder()
                    .header("Authorization", "Bearer " + refreshed)
                    .build()));
        }

        private Request withToken(Request request) {
            String token = SessionManager.get().getAccessToken();
            if (token == null) return request;
            return request.newBuilder().header("Authorization", "Bearer " + token).build();
        }

        /** Asks the API for messages and catalogue copy in the app's language. */
        private Request withLanguage(Request request) {
            return request.newBuilder()
                    .header("X-Language", LocaleManager.apiLanguageTag())
                    .build();
        }

        @Nullable
        private String refreshToken() {
            String refresh = SessionManager.get().getRefreshToken();
            if (refresh == null) return null;
            try {
                retrofit2.Response<ApiResponse<TokenData>> res =
                        get().refresh(new RefreshRequest(refresh)).execute();
                if (!res.isSuccessful() || res.body() == null || res.body().data == null) {
                    return null;
                }
                TokenData tokens = res.body().data;
                SessionManager.get().saveTokens(tokens.accessToken, tokens.refreshToken);
                return tokens.accessToken;
            } catch (Exception e) {
                return null;
            }
        }
    }
}
