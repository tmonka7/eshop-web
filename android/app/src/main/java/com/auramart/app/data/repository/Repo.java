package com.auramart.app.data.repository;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.auramart.app.R;
import com.auramart.app.data.model.Models.ApiResponse;
import com.auramart.app.data.model.Models.FieldError;
import com.auramart.app.data.model.Models.PagedResponse;
import com.auramart.app.data.remote.ApiClient;
import com.auramart.app.data.remote.ApiService;
import com.google.gson.Gson;

import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Thin bridge between Retrofit and the UI: unwraps the API envelope, turns any
 * failure into a readable message, and hands the result to a single callback.
 */
public final class Repo {

    private static final Gson GSON = new Gson();

    /**
     * Application context, used only to resolve the fallback error strings.
     * The API itself already answers in the caller's language (see the
     * X-Language header in ApiClient), so these are for failures that never
     * reached it — no connection, a timeout, an unreadable body.
     */
    @Nullable
    private static Context appContext;

    /** Called once from AuraMartApp.onCreate(). */
    public static void init(@NonNull Context context) {
        appContext = context.getApplicationContext();
    }

    private static String string(int res, String fallback) {
        return appContext == null ? fallback : appContext.getString(res);
    }

    public interface OnResult<T> {
        void onSuccess(T data, String message);

        void onError(String message);
    }

    /** Like OnResult, but hands over the whole envelope (image search reads `region`). */
    public interface OnEnvelope<T> {
        void onSuccess(ApiResponse<T> body);

        void onError(String message);
    }

    public interface OnPaged<T> {
        void onSuccess(List<T> items, com.auramart.app.data.model.Models.Pagination pagination);

        void onError(String message);
    }

    private Repo() {
    }

    public static ApiService api() {
        return ApiClient.get();
    }

    /** Enqueues a call returning the single-object envelope. */
    public static <T> void call(@NonNull Call<ApiResponse<T>> call, @NonNull OnResult<T> cb) {
        call.enqueue(new Callback<ApiResponse<T>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<T>> c, @NonNull Response<ApiResponse<T>> res) {
                if (res.isSuccessful() && res.body() != null && res.body().success) {
                    cb.onSuccess(res.body().data, res.body().message);
                } else {
                    cb.onError(errorMessage(res));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<T>> c, @NonNull Throwable t) {
                cb.onError(networkMessage(t));
            }
        });
    }

    /** Enqueues a call and passes the complete envelope on success. */
    public static <T> void callEnvelope(@NonNull Call<ApiResponse<T>> call, @NonNull OnEnvelope<T> cb) {
        call.enqueue(new Callback<ApiResponse<T>>() {
            @Override
            public void onResponse(@NonNull Call<ApiResponse<T>> c, @NonNull Response<ApiResponse<T>> res) {
                if (res.isSuccessful() && res.body() != null && res.body().success) {
                    cb.onSuccess(res.body());
                } else {
                    cb.onError(errorMessage(res));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ApiResponse<T>> c, @NonNull Throwable t) {
                cb.onError(networkMessage(t));
            }
        });
    }

    /** Enqueues a call returning the paginated envelope. */
    public static <T> void callPaged(@NonNull Call<PagedResponse<T>> call, @NonNull OnPaged<T> cb) {
        call.enqueue(new Callback<PagedResponse<T>>() {
            @Override
            public void onResponse(@NonNull Call<PagedResponse<T>> c, @NonNull Response<PagedResponse<T>> res) {
                if (res.isSuccessful() && res.body() != null && res.body().success) {
                    cb.onSuccess(res.body().data, res.body().pagination);
                } else {
                    cb.onError(errorMessage(res));
                }
            }

            @Override
            public void onFailure(@NonNull Call<PagedResponse<T>> c, @NonNull Throwable t) {
                cb.onError(networkMessage(t));
            }
        });
    }

    /* ------------------------------ messages ------------------------------- */

    private static String networkMessage(Throwable t) {
        if (t instanceof java.net.ConnectException || t instanceof java.net.UnknownHostException) {
            return string(R.string.error_network, "Cannot reach the server. Is the API running?");
        }
        if (t instanceof java.net.SocketTimeoutException) {
            return string(R.string.error_timeout, "The server took too long to respond.");
        }
        return t.getMessage() == null
                ? string(R.string.error_generic, "Something went wrong")
                : t.getMessage();
    }

    /** Pulls `message` (and the first field error) out of the API error body. */
    private static String errorMessage(Response<?> response) {
        try {
            if (response.errorBody() != null) {
                String raw = response.errorBody().string();
                ErrorBody parsed = GSON.fromJson(raw, ErrorBody.class);
                if (parsed != null && parsed.message != null) {
                    if (parsed.errors != null && !parsed.errors.isEmpty()) {
                        FieldError first = parsed.errors.get(0);
                        return first.message != null ? first.message : parsed.message;
                    }
                    return parsed.message;
                }
            }
        } catch (Exception ignored) {
            // Fall through to the generic message below.
        }
        return switch (response.code()) {
            case 401 -> string(R.string.error_unauthorized, "Please sign in to continue");
            case 403 -> string(R.string.error_forbidden, "You do not have permission to do that");
            case 404 -> string(R.string.error_not_found, "Not found");
            case 409 -> string(R.string.error_conflict,
                    "That conflicts with something that already exists");
            default -> "Request failed (" + response.code() + ")";
        };
    }

    private static class ErrorBody {
        @Nullable
        String message;
        @Nullable
        List<FieldError> errors;
    }
}
