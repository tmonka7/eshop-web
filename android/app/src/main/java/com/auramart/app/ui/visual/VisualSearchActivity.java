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

import com.auramart.app.R;
import com.auramart.app.data.local.Dinov3Encoder;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.AddToCartRequest;
import com.auramart.app.data.model.Models.ApiResponse;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.Product;
import com.auramart.app.data.model.Models.SearchRegion;
import com.auramart.app.data.model.Models.VectorSearchRequest;
import com.auramart.app.data.model.Models.VisualSearchStatus;
import com.auramart.app.data.model.Models.WishlistToggle;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityVisualSearchBinding;
import com.auramart.app.ui.adapter.ProductAdapter;
import com.auramart.app.ui.auth.LoginActivity;
import com.auramart.app.ui.product.ProductDetailActivity;
import com.auramart.app.util.RegionDetector;
import com.auramart.app.util.RegionDetector.Box;
import com.auramart.app.util.SearchPhotos;
import com.auramart.app.util.Ui;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;
import java.util.Locale;
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
 *
 * Only the product area is searched: RegionDetector finds it from the same
 * model's patch tokens and the photo is shown with a glowing green box around
 * it. If the box is wrong the user moves or resizes it (RegionSelectorView)
 * and the search runs again on the new area. On the upload path the server
 * detects the area instead and returns it, or searches the box the user drew.
 */
public class VisualSearchActivity extends AppCompatActivity implements ProductAdapter.Listener {

    public static final String SOURCE_CAMERA = "camera";
    public static final String SOURCE_GALLERY = "gallery";

    private static final String EXTRA_SOURCE = "source";
    private static final String STATE_HAS_QUERY = "hasQuery";
    private static final String STATE_MANUAL_REGION = "manualRegion";
    /** Longest side the photo is scaled to for region detection on the phone. */
    private static final int DETECT_LONG_SIDE = 320;
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
    /** The prepared photo (<= 640 px), kept to re-crop when the box moves. Read on the worker. */
    @Nullable
    private volatile Bitmap queryBitmap;
    /** Where the product was found (on the phone or by the server); null until known. */
    @Nullable
    private Box detected;
    /** The box the user set, or null while the detected area is used. */
    @Nullable
    private Box manualRegion;

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
        b.regionView.setOnRegionChangedListener(box -> {
            manualRegion = box;
            searchRegion();
        });
        b.resetRegionButton.setOnClickListener(v -> {
            manualRegion = null;
            searchRegion();
        });
        b.wholePhotoButton.setOnClickListener(v -> {
            manualRegion = Box.whole();
            searchRegion();
        });
        b.empty.emptyIcon.setImageResource(R.drawable.ic_camera);
        showMessage(R.string.visual_search_intro_title, getString(R.string.visual_search_intro));
        // Load the bundled model while the shopper is still picking a photo.
        worker.execute(() -> Dinov3Encoder.get(getApplicationContext()));

        if (savedInstanceState != null) {
            float[] saved = savedInstanceState.getFloatArray(STATE_MANUAL_REGION);
            if (saved != null && saved.length == 4) {
                manualRegion = new Box(saved[0], saved[1], saved[2], saved[3], true);
            }
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
        if (manualRegion != null) {
            outState.putFloatArray(STATE_MANUAL_REGION,
                    new float[]{manualRegion.x, manualRegion.y, manualRegion.w, manualRegion.h});
        }
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
     * Prepares the photo, finds the product in it and computes the DINOv3
     * vector of that area off the main thread, then asks the API for matches.
     * @param source the picked photo, or null to reuse the last prepared one.
     */
    private void search(@Nullable Uri source) {
        int ticket = ++generation;
        if (inFlight != null) inFlight.cancel();
        if (source != null) manualRegion = null; // a new photo starts from detection
        Box manual = manualRegion;
        showLoading();

        worker.execute(() -> {
            byte[] jpeg;
            Bitmap photo;
            Box found = null;
            float[] vector = null;
            try {
                if (source != null) {
                    photo = SearchPhotos.load(getContentResolver(), source);
                    jpeg = SearchPhotos.toJpeg(photo);
                    write(queryFile(), jpeg);
                } else {
                    jpeg = read(queryFile());
                    photo = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.length);
                    if (photo == null) throw new IOException("Unreadable " + queryFile());
                }
                Dinov3Encoder encoder = Dinov3Encoder.get(this);
                if (encoder != null) {
                    found = detectOnDevice(encoder, photo);
                    vector = embedOnDevice(encoder, photo, manual != null ? manual : usable(found));
                }
            } catch (IOException | RuntimeException | OutOfMemoryError e) {
                runOnUiThread(() -> {
                    if (ticket != generation) return;
                    showMessage(R.string.visual_search_unreadable_title,
                            getString(R.string.visual_search_unreadable));
                });
                return;
            }
            Bitmap prepared = photo;
            Box region = found;
            float[] features = vector;
            runOnUiThread(() -> {
                if (ticket != generation) return;
                hasQuery = true;
                queryBitmap = prepared;
                // On-device detection failed but the vector was computed: the whole photo was searched.
                detected = region != null ? region : (features != null ? Box.whole() : null);
                showQueryPhoto();
                if (features != null) {
                    searchByVector(features, jpeg, ticket);
                } else {
                    upload(jpeg, ticket);
                }
            });
        });
    }

    /**
     * Searches again for the current photo after the box changed: the new area
     * (or, after "reset", the detected one) is cropped and embedded again.
     */
    private void searchRegion() {
        Bitmap photo = queryBitmap;
        if (photo == null) return;
        int ticket = ++generation;
        if (inFlight != null) inFlight.cancel();
        Box target = manualRegion != null ? manualRegion : usable(detected);
        showLoading();
        showRegion();

        worker.execute(() -> {
            Dinov3Encoder encoder = Dinov3Encoder.get(this);
            float[] vector = encoder == null ? null : embedOnDevice(encoder, photo, target);
            byte[] jpeg;
            try {
                jpeg = vector == null ? read(queryFile()) : null;
            } catch (IOException e) {
                jpeg = null;
            }
            float[] features = vector;
            byte[] upload = jpeg;
            runOnUiThread(() -> {
                if (ticket != generation) return;
                if (features != null) {
                    searchByVector(features, upload, ticket);
                } else if (upload != null) {
                    upload(upload, ticket);
                } else {
                    showMessage(R.string.visual_search_unreadable_title,
                            getString(R.string.visual_search_unreadable));
                }
            });
        });
    }

    /** The detection as a crop box, or null (whole photo) when nothing stood out. */
    @Nullable
    private static Box usable(@Nullable Box found) {
        return found != null && found.found ? found : null;
    }

    /** Where the product is in `photo`, or null if the model cannot run here. */
    @Nullable
    private Box detectOnDevice(Dinov3Encoder encoder, Bitmap photo) {
        try {
            return RegionDetector.detect(encoder.patchGrid(photo, DETECT_LONG_SIDE));
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "On-device region detection failed; searching the whole photo", e);
            return null;
        }
    }

    /** The vector of `box` in `photo` (null box = whole photo), or null to let the server compute it. */
    @Nullable
    private float[] embedOnDevice(Dinov3Encoder encoder, Bitmap photo, @Nullable Box box) {
        Bitmap area = crop(photo, box);
        try {
            return encoder.embed(area);
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "On-device embedding failed; uploading the photo instead", e);
            return null;
        } finally {
            if (area != photo) area.recycle();
        }
    }

    private static Bitmap crop(Bitmap photo, @Nullable Box box) {
        if (box == null || box.isWhole()) return photo;
        int w = photo.getWidth();
        int h = photo.getHeight();
        int left = Math.min(w - 1, Math.max(0, Math.round(box.x * w)));
        int top = Math.min(h - 1, Math.max(0, Math.round(box.y * h)));
        int cw = Math.max(1, Math.min(w - left, Math.round(box.w * w)));
        int ch = Math.max(1, Math.min(h - top, Math.round(box.h * h)));
        return Bitmap.createBitmap(photo, left, top, cw, ch);
    }

    private void searchByVector(float[] vector, @Nullable byte[] jpeg, int ticket) {
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
                byte[] photo = jpeg;
                if (photo == null) {
                    try {
                        photo = read(queryFile());
                    } catch (IOException e) {
                        showMessage(R.string.visual_search_failed_title, message);
                        return;
                    }
                }
                upload(photo, ticket);
            }
        });
    }

    /**
     * Uploads the photo. With a user box the server searches that area;
     * otherwise it detects the product itself and returns the area as `region`.
     */
    private void upload(byte[] jpeg, int ticket) {
        RequestBody body = RequestBody.create(jpeg, MediaType.get("image/jpeg"));
        MultipartBody.Part part = MultipartBody.Part.createFormData("image", "photo.jpg", body);
        Box manual = manualRegion;
        RequestBody box = manual == null ? null : RequestBody.create(String.format(Locale.ROOT,
                "{\"x\":%.4f,\"y\":%.4f,\"w\":%.4f,\"h\":%.4f}", manual.x, manual.y, manual.w, manual.h),
                MediaType.get("application/json"));
        inFlight = Repo.api().visualSearch(part, box, RESULT_LIMIT);

        Repo.callEnvelope(inFlight, new Repo.OnEnvelope<List<Product>>() {
            @Override
            public void onSuccess(ApiResponse<List<Product>> res) {
                if (ticket != generation) return;
                SearchRegion r = res.region;
                if (r != null && r.auto && manualRegion == null) {
                    detected = new Box(r.x, r.y, r.w, r.h, r.found);
                    showRegion();
                }
                showResults(res.data);
            }

            @Override
            public void onError(String message) {
                if (ticket != generation) return;
                showMessage(R.string.visual_search_failed_title, message);
            }
        });
    }

    /* -------------------------------- views ------------------------------- */

    /** Swaps the camera placeholder for the photo with its green box. */
    private void showQueryPhoto() {
        Ui.show(b.queryImage, false);
        Ui.show(b.regionPanel, true);
        b.regionView.setImage(queryBitmap);
        showRegion();
    }

    /** Draws the searched area and says whether it was detected or chosen. */
    private void showRegion() {
        Box shown = manualRegion != null ? manualRegion : detected;
        b.regionView.setRegion(shown);
        int status;
        if (manualRegion != null) {
            status = R.string.visual_search_region_manual;
        } else if (detected == null) {
            status = R.string.visual_search_region_pending;
        } else if (detected.found) {
            status = R.string.visual_search_region_auto;
        } else {
            status = R.string.visual_search_region_none;
        }
        b.regionStatus.setText(status);
        b.resetRegionButton.setEnabled(manualRegion != null);
        b.wholePhotoButton.setEnabled(shown == null || !shown.isWhole());
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
