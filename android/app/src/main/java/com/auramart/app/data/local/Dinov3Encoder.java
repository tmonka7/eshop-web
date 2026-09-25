package com.auramart.app.data.local;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.WorkerThread;

import com.auramart.app.util.Dinov3Preprocessor;
import com.auramart.app.util.RegionDetector;
import com.google.gson.Gson;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.nio.FloatBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;

/**
 * DINOv3 ViT-S/16 running on the phone, from the model bundled in
 * assets/model/. The app computes the photo's 384-d feature vector locally
 * and sends only that to the API, so image search needs no model download
 * and no photo upload.
 *
 * The weights are an ONNX external-data pair (model.onnx + model.onnx_data).
 * onnxruntime can only resolve the second file from a real path, so both are
 * copied out of the APK into internal storage once, on first use.
 */
public final class Dinov3Encoder {

    private static final String TAG = "Dinov3Encoder";

    /**
     * Must equal the backend's modelId() (backend/src/services/dinov3.service.js):
     * the server only compares vectors from the network it indexed with.
     */
    public static final String MODEL_ID = "dinov3-vits16/model.onnx";

    private static final String ASSET_DIR = "model";
    private static final String[] MODEL_FILES = {"model.onnx", "model.onnx_data"};
    private static final String PREPROCESSOR = "preprocessor_config.json";
    private static final String MODEL_CONFIG = "config.json";

    @Nullable
    private static volatile Dinov3Encoder instance;
    /** Set once loading has failed, so every search does not retry the copy. */
    private static volatile boolean failed;

    private final OrtEnvironment env;
    private final OrtSession session;
    private final Dinov3Preprocessor preprocessor;
    private final String inputName;
    /** Pixels per patch side, and tokens before the patch grid (CLS + registers). */
    private final int patchSize;
    private final int prefixTokens;

    private Dinov3Encoder(OrtEnvironment env, OrtSession session, Dinov3Preprocessor preprocessor,
                          ModelConfig modelConfig) {
        this.env = env;
        this.session = session;
        this.preprocessor = preprocessor;
        this.inputName = session.getInputNames().iterator().next();
        this.patchSize = modelConfig.patch_size != null ? modelConfig.patch_size : 16;
        this.prefixTokens = 1 + (modelConfig.num_register_tokens != null ? modelConfig.num_register_tokens : 4);
    }

    /** True when this build carries the model in its assets. */
    public static boolean isBundled(@NonNull Context context) {
        try (InputStream ignored = context.getAssets().open(ASSET_DIR + "/" + MODEL_FILES[0])) {
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * The shared encoder, loading it on first call (about a second, plus the
     * one-time copy). Returns null if the model is missing or cannot run on
     * this device; callers then fall back to uploading the photo.
     */
    @WorkerThread
    @Nullable
    public static Dinov3Encoder get(@NonNull Context context) {
        Dinov3Encoder local = instance;
        if (local != null || failed) return local;
        synchronized (Dinov3Encoder.class) {
            if (instance == null && !failed) {
                try {
                    instance = load(context.getApplicationContext());
                } catch (Exception | OutOfMemoryError e) {
                    failed = true;
                    Log.w(TAG, "On-device image search unavailable", e);
                }
            }
            return instance;
        }
    }

    private static Dinov3Encoder load(Context context) throws IOException, OrtException {
        long started = System.currentTimeMillis();
        File dir = extractModel(context);

        OrtEnvironment env = OrtEnvironment.getEnvironment();
        OrtSession.SessionOptions options = new OrtSession.SessionOptions();
        options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
        OrtSession session = env.createSession(new File(dir, MODEL_FILES[0]).getAbsolutePath(), options);

        Dinov3Encoder encoder = new Dinov3Encoder(env, session, readPreprocessor(context.getAssets()),
                readModelConfig(context.getAssets()));
        Log.i(TAG, MODEL_ID + " loaded in " + (System.currentTimeMillis() - started) + "ms");
        return encoder;
    }

    /**
     * Copies the model out of the APK. A file is re-copied only when its size
     * differs from the asset (e.g. after an app update ships new weights or a
     * previous copy was interrupted); the assets are stored uncompressed (see
     * noCompress in build.gradle), which is what makes their size readable.
     */
    private static File extractModel(Context context) throws IOException {
        File dir = new File(context.getNoBackupFilesDir(), "dinov3");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot create " + dir);
        AssetManager assets = context.getAssets();

        for (String name : MODEL_FILES) {
            String asset = ASSET_DIR + "/" + name;
            File target = new File(dir, name);
            long expected;
            try (AssetFileDescriptor fd = assets.openFd(asset)) {
                expected = fd.getLength();
            }
            if (target.length() == expected) continue;

            File partial = new File(dir, name + ".part");
            try (InputStream in = assets.open(asset); OutputStream out = new FileOutputStream(partial)) {
                byte[] buffer = new byte[1 << 16];
                int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            }
            if (!partial.renameTo(target)) throw new IOException("Cannot move " + partial);
        }
        return dir;
    }

    /** Resize and normalisation settings, from the same config the server reads. */
    private static Dinov3Preprocessor readPreprocessor(AssetManager assets) throws IOException {
        try (Reader reader = new InputStreamReader(assets.open(ASSET_DIR + "/" + PREPROCESSOR),
                StandardCharsets.UTF_8)) {
            PreprocessorConfig cfg = new Gson().fromJson(reader, PreprocessorConfig.class);
            int w = cfg.size != null && cfg.size.width > 0 ? cfg.size.width : 224;
            int h = cfg.size != null && cfg.size.height > 0 ? cfg.size.height : 224;
            float[] mean = cfg.image_mean != null ? cfg.image_mean : new float[]{0.485f, 0.456f, 0.406f};
            float[] std = cfg.image_std != null ? cfg.image_std : new float[]{0.229f, 0.224f, 0.225f};
            return new Dinov3Preprocessor(w, h, mean, std);
        }
    }

    /** Patch size and register-token count from the model's config.json. */
    private static ModelConfig readModelConfig(AssetManager assets) {
        try (Reader reader = new InputStreamReader(assets.open(ASSET_DIR + "/" + MODEL_CONFIG),
                StandardCharsets.UTF_8)) {
            ModelConfig cfg = new Gson().fromJson(reader, ModelConfig.class);
            return cfg != null ? cfg : new ModelConfig();
        } catch (IOException | RuntimeException e) {
            return new ModelConfig();
        }
    }

    /**
     * Runs the model on the whole photo at an aspect-preserving size whose
     * longest side is about `longSide` px, and returns the patch-token grid
     * RegionDetector needs to find the product. DINOv3 uses rotary position
     * embeddings, so any multiple of the patch size is a valid input.
     */
    @WorkerThread
    @NonNull
    public synchronized RegionDetector.Grid patchGrid(@NonNull Bitmap bitmap, int longSide) throws OrtException {
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        float scale = (float) longSide / Math.max(w, h);
        int gw = Math.max(2, Math.round(w * scale / patchSize));
        int gh = Math.max(2, Math.round(h * scale / patchSize));
        int[] pixels = new int[w * h];
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h);
        float[] input = preprocessor.resized(gw * patchSize, gh * patchSize).toTensor(pixels, w, h);

        long[] shape = {1, 3, (long) gh * patchSize, (long) gw * patchSize};
        float[] patches;
        int dim;
        try (OnnxTensor tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), shape);
             OrtSession.Result result = session.run(
                     Collections.singletonMap(inputName, tensor),
                     Collections.singleton("last_hidden_state"))) {
            float[][] tokens = ((float[][][]) result.get(0).getValue())[0];
            if (tokens.length != prefixTokens + gw * gh) {
                throw new IllegalStateException("Unexpected token count " + tokens.length + " for " + gw + "x" + gh);
            }
            dim = tokens[0].length;
            patches = new float[gw * gh * dim];
            for (int i = 0; i < gw * gh; i++) {
                System.arraycopy(tokens[prefixTokens + i], 0, patches, i * dim, dim);
            }
        }

        int cw = gw * RegionDetector.PIXELS_PER_PATCH;
        int ch = gh * RegionDetector.PIXELS_PER_PATCH;
        Bitmap small = Bitmap.createScaledBitmap(bitmap, cw, ch, true);
        int[] argb = new int[cw * ch];
        small.getPixels(argb, 0, cw, 0, 0, cw, ch);
        if (small != bitmap) small.recycle();
        return new RegionDetector.Grid(patches, gw, gh, dim, argb);
    }

    /**
     * The L2-normalised global descriptor (`pooler_output`, the normed CLS
     * token) of an opaque bitmap. Runs are serialised: one inference already
     * uses every core.
     */
    @WorkerThread
    @NonNull
    public synchronized float[] embed(@NonNull Bitmap bitmap) throws OrtException {
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        int[] pixels = new int[w * h];
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h);
        float[] input = preprocessor.toTensor(pixels, w, h);

        long[] shape = {1, 3, preprocessor.height(), preprocessor.width()};
        try (OnnxTensor tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), shape);
             OrtSession.Result result = session.run(
                     Collections.singletonMap(inputName, tensor),
                     Collections.singleton("pooler_output"))) {
            float[] vector = ((float[][]) result.get(0).getValue())[0];
            double norm = 0;
            for (float v : vector) norm += v * v;
            norm = Math.sqrt(norm);
            if (norm > 0) {
                for (int i = 0; i < vector.length; i++) vector[i] /= (float) norm;
            }
            return vector;
        }
    }

    /** Gson mapping for the fields of config.json used here. */
    @SuppressWarnings("unused")
    private static final class ModelConfig {
        Integer patch_size;
        Integer num_register_tokens;
    }

    /** Gson mapping for the fields of preprocessor_config.json used here. */
    @SuppressWarnings("unused")
    private static final class PreprocessorConfig {
        Size size;
        float[] image_mean;
        float[] image_std;

        static final class Size {
            int width;
            int height;
        }
    }
}
