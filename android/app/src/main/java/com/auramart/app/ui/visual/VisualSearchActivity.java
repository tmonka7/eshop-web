package com.auramart.app.ui.visual;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.core.content.IntentCompat;
import androidx.core.widget.ImageViewCompat;

import com.auramart.app.R;
import com.auramart.app.data.local.Dinov3Encoder;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AddToCartRequest;
import com.auramart.app.data.model.Models.ApiResponse;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.data.model.Models.VectorSearchRequest;
import com.auramart.app.data.model.Models.VisualSearchStatus;
import com.auramart.app.data.model.Models.WishlistToggle;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityVisualSearchBinding;
import com.auramart.app.ui.adapter.ProductAdapter;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.product.ProductDetailActivity;
import com.auramart.app.util.SearchPhotos;
import com.auramart.app.util.Ui;
import com.bumptech.glide.Glide;
import com.bumptech.glide.signature.ObjectKey;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;

/**
 * Search by photo. The shopper takes a picture or picks one from the gallery
 * (or shares one into the app), and the API ranks products by DINOv3 visual
 * similarity.
 *
 * The app bundles the same DINOv3 model as the server (assets/model), so the
 * feature vector is normally computed on the phone and only those 384 numbers
 * are sent. If the model cannot run here, or the server indexed with a
 * different one, the shrunken photo is uploaded instead and the server embeds it.
 */
public class VisualSearchActivity extends AppCompatActivity implements ProductAdapter.Listener {

    public static final String SOURCE_CAMERA = "camera";
    public static final String SOURCE_GALLERY = "gallery";

    private static final String EXTRA_SOURCE = "source";
    private static final String STATE_HAS_QUERY = "hasQuery";
    private static final int RESULT_LIMIT = 24;
    private static final String CACHE_DIR = "visual-search";
    private static final String TAG = "VisualSearch";

    /** Once the API reports image search available, it stays so for this process. */
    private static boolean knownAvailable;

    /** @param source SOURCE_CAMERA or SOURCE_GALLERY to open that picker straight away. */
    public static Intent intent(@NonNull Context context, @Nullable String source) {
        return new Intent(context, VisualSearchActivity.class).putExtra(EXTRA_SOURCE, source);
    }

    /**
     * Runs `onAvailable` if image search can work: the server has its model
     * loaded, or this app can compute vectors in the server's vector space
     * itself. Callers use it to reveal their camera buttons.
     */
    public static void whenAvailable(@NonNull Context context, @NonNull Runnable onAvailable) {
        boolean bundled = Dinov3Encoder.isBundled(context);
        if (knownAvailable) {
            onAvailable.run();
            return;
        }
        Repo.call(Repo.api().visualSearchStatus(), new Repo.OnResult<VisualSearchStatus>() {
            @Override
            public void onSuccess(VisualSearchStatus data, String message) {
                boolean onDevice = data != null && data.enabled && bundled
                        && Dinov3Encoder.MODEL_ID.equals(data.model);
                if (data != null && (data.available || onDevice)) {
                    knownAvailable = true;
                    onAvailable.run();
                }
            }

            @Override
            public void onError(String message) {
                // Leave the buttons hidden; text search still works.
            }
        });
    }

    private ActivityVisualSearchBinding b;
    private ProductAdapter adapter;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    /** Bumped for every search; callbacks from an older one are ignored. */
    private int generation;
    @Nullable
    private Call<ApiResponse<List<Product>>> inFlight;
    /** True once a photo has been prepared, so a rotation can repeat the search. */
    private boolean hasQuery;

    private final ActivityResultLauncher<PickVisualMediaRequest> pickPhoto =
            registerForActivityResult(new ActivityResultContracts.PickVisualMedia(), uri -> {
                if (uri != null) search(uri);
            });

    private final ActivityResultLauncher<Uri> takePhoto =
            registerForActivityResult(new ActivityResultContracts.TakePicture(), saved -> {
                if (Boolean.TRUE.equals(saved)) search(cameraUri());
            });

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityVisualSearchBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.toolbar.setNavigationOnClickListener(v -> finish());
        adapter = new ProductAdapter(this);
        b.productList.setAdapter(adapter);

        b.cameraButton.setOnClickListener(v -> openCamera());
        b.galleryButton.setOnClickListener(v -> openGallery());
        b.empty.emptyIcon.setImageResource(R.drawable.ic_camera);
        showMessage(R.string.visual_search_intro_title, getString(R.string.visual_search_intro));
        // Load the bundled model while the shopper is still picking a photo.
        worker.execute(() -> Dinov3Encoder.get(getApplicationContext()));

        if (savedInstanceState != null) {
            // Rotation or process restore: search again with the photo prepared last time.
            if (savedInstanceState.getBoolean(STATE_HAS_QUERY) && queryFile().exists()) search(null);
            return;
        }

        Uri shared = sharedImage(getIntent());
        String source = getIntent().getStringExtra(EXTRA_SOURCE);
        if (shared != null) {
            search(shared);
        } else if (SOURCE_CAMERA.equals(source)) {
            openCamera();
        } else if (SOURCE_GALLERY.equals(source)) {
            openGallery();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putBoolean(STATE_HAS_QUERY, hasQuery);
    }

    @Override
    protected void onDestroy() {
        generation++;
        if (inFlight != null) inFlight.cancel();
        worker.shutdownNow();
        super.onDestroy();
    }

    /* ------------------------------ picking ------------------------------- */

    private void openCamera() {
        try {
            takePhoto.launch(cameraUri());
        } catch (ActivityNotFoundException e) {
            Ui.snack(b.getRoot(), getString(R.string.visual_search_no_camera));
        }
    }

    private void openGallery() {
        // The photo picker needs no storage permission; on older devices it
        // falls back to the system document picker.
        pickPhoto.launch(new PickVisualMediaRequest.Builder()
                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                .build());
    }

    /** An image shared from another app ("Share > ShopWorld"). */
    @Nullable
    private static Uri sharedImage(Intent intent) {
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return null;
        String type = intent.getType();
        if (type == null || !type.startsWith("image/")) return null;
        return IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
    }

    private File cacheDir() {
        File dir = new File(getCacheDir(), CACHE_DIR);
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return dir;
    }

    /** Where the camera app writes the full-size photo (shared via FileProvider). */
    private Uri cameraUri() {
        File file = new File(cacheDir(), "camera.jpg");
        return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
    }

    /** The downscaled JPEG that was last sent to the API. */
    private File queryFile() {
        return new File(cacheDir(), "query.jpg");
    }

    /* ------------------------------ searching ----------------------------- */

    /**
     * Prepares the photo and computes its DINOv3 vector off the main thread,
     * then asks the API for matches.
     * @param source the picked photo, or null to reuse the last prepared one.
     */
    private void search(@Nullable Uri source) {
        int ticket = ++generation;
        if (inFlight != null) inFlight.cancel();
        showLoading();

        worker.execute(() -> {
            byte[] jpeg;
            float[] vector = null;
            try {
                Bitmap photo;
                if (source != null) {
                    photo = SearchPhotos.load(getContentResolver(), source);
                    jpeg = SearchPhotos.toJpeg(photo);
                    write(queryFile(), jpeg);
                } else {
                    jpeg = read(queryFile());
                    photo = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.length);
                    if (photo == null) throw new IOException("Unreadable " + queryFile());
                }
                vector = embedOnDevice(photo);
                photo.recycle();
            } catch (IOException | RuntimeException | OutOfMemoryError e) {
                runOnUiThread(() -> {
                    if (ticket != generation) return;
                    showMessage(R.string.visual_search_unreadable_title,
                            getString(R.string.visual_search_unreadable));
                });
                return;
            }
            float[] features = vector;
            runOnUiThread(() -> {
                if (ticket != generation) return;
                hasQuery = true;
                showQueryPhoto();
                if (features != null) {
                    searchByVector(features, jpeg, ticket);
                } else {
                    upload(jpeg, ticket);
                }
            });
        });
    }

    /** The photo's vector from the bundled model, or null to let the server compute it. */
    @Nullable
    private float[] embedOnDevice(Bitmap photo) {
        Dinov3Encoder encoder = Dinov3Encoder.get(this);
        if (encoder == null) return null;
        try {
            return encoder.embed(photo);
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "On-device embedding failed; uploading the photo instead", e);
            return null;
        }
    }

    private void searchByVector(float[] vector, byte[] jpeg, int ticket) {
        inFlight = Repo.api().visualSearchByVector(
                new VectorSearchRequest(Dinov3Encoder.MODEL_ID, vector, RESULT_LIMIT));

        Repo.call(inFlight, new Repo.OnResult<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data, String message) {
                if (ticket != generation) return;
                showResults(data);
            }

            @Override
            public void onError(String message) {
                if (ticket != generation) return;
                // e.g. the server now indexes with another model (HTTP 409):
                // let it embed the photo itself.
                Log.w(TAG, "Vector search failed (" + message + "); uploading the photo instead");
                upload(jpeg, ticket);
            }
        });
    }

    private void upload(byte[] jpeg, int ticket) {
        RequestBody body = RequestBody.create(jpeg, MediaType.get("image/jpeg"));
        MultipartBody.Part part = MultipartBody.Part.createFormData("image", "photo.jpg", body);
        inFlight = Repo.api().visualSearch(part, RESULT_LIMIT);

        Repo.call(inFlight, new Repo.OnResult<List<Product>>() {
            @Override
            public void onSuccess(List<Product> data, String message) {
                if (ticket != generation) return;
                showResults(data);
            }

            @Override
            public void onError(String message) {
                if (ticket != generation) return;
                showMessage(R.string.visual_search_failed_title, message);
            }
        });
    }

    /* -------------------------------- views ------------------------------- */

    private void showQueryPhoto() {
        File file = queryFile();
        ImageViewCompat.setImageTintList(b.queryImage, null);
        b.queryImage.setPadding(0, 0, 0, 0);
        b.queryImage.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
        // The file is overwritten for every search, so key the cache on its timestamp.
        Glide.with(this)
                .load(file)
                .signature(new ObjectKey(file.lastModified()))
                .centerCrop()
                .into(b.queryImage);
    }

    private void showLoading() {
        adapter.submitList(null);
        Ui.show(b.progress, true);
        Ui.show(b.empty.getRoot(), false);
        Ui.show(b.resultCount, false);
    }

    private void showResults(List<Product> products) {
        Ui.show(b.progress, false);
        adapter.submitList(products);
        b.productList.scheduleLayoutAnimation();

        b.resultCount.setText(getResources().getQuantityString(
                R.plurals.visual_search_found, products.size(), products.size()));
        Ui.show(b.resultCount, true);

        if (products.isEmpty()) {
            showMessage(R.string.visual_search_empty_title, getString(R.string.visual_search_empty));
        }
    }

    private void showMessage(@StringRes int title, String message) {
        Ui.show(b.progress, false);
        b.empty.emptyTitle.setText(title);
        b.empty.emptyMessage.setText(message);
        Ui.show(b.empty.getRoot(), true);
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

    /* --------------------------------- files ------------------------------- */

    private static void write(File file, byte[] bytes) throws IOException {
        try (OutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
    }

    private static byte[] read(File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream((int) file.length());
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toByteArray();
        }
    }
}
