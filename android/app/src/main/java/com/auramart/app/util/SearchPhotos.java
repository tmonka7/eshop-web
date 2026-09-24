package com.auramart.app.util;

import android.content.ContentResolver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.WorkerThread;
import androidx.exifinterface.media.ExifInterface;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Prepares a camera or gallery photo for image search.
 *
 * DINOv3 only sees 224x224, so a 12-megapixel original would waste memory and
 * mobile data. The photo is decoded at a reduced size, turned upright from its
 * EXIF orientation (re-encoding drops the tag the server would otherwise
 * honour) and flattened onto white, like the storefront shows transparent
 * images. The result feeds the on-device encoder, and is also kept as a small
 * JPEG for the upload fallback.
 */
public final class SearchPhotos {

    /** Longest edge kept; comfortably above the model's 224px input. */
    private static final int MAX_EDGE = 640;
    private static final int JPEG_QUALITY = 88;

    private SearchPhotos() {
    }

    /** An upright, opaque bitmap no larger than MAX_EDGE on its longest side. */
    @WorkerThread
    @NonNull
    public static Bitmap load(@NonNull ContentResolver resolver, @NonNull Uri uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = open(resolver, uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            throw new IOException("Not an image: " + uri);
        }

        // Power-of-two subsampling while decoding keeps memory low for huge photos.
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / (options.inSampleSize * 2) >= MAX_EDGE) {
            options.inSampleSize *= 2;
        }
        Bitmap decoded;
        try (InputStream in = open(resolver, uri)) {
            decoded = BitmapFactory.decodeStream(in, null, options);
        }
        if (decoded == null) throw new IOException("Could not decode " + uri);

        Matrix matrix = new Matrix();
        float scale = Math.min(1f, (float) MAX_EDGE / Math.max(decoded.getWidth(), decoded.getHeight()));
        matrix.postScale(scale, scale);
        int rotation = rotationDegrees(resolver, uri);
        if (rotation != 0) matrix.postRotate(rotation);

        Bitmap upright = Bitmap.createBitmap(decoded, 0, 0,
                decoded.getWidth(), decoded.getHeight(), matrix, true);
        if (upright != decoded) decoded.recycle();

        Bitmap opaque = upright;
        if (upright.hasAlpha()) {
            // JPEG has no alpha: without this, transparent areas turn black.
            opaque = Bitmap.createBitmap(upright.getWidth(), upright.getHeight(), Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(opaque);
            canvas.drawColor(Color.WHITE);
            canvas.drawBitmap(upright, 0f, 0f, null);
            upright.recycle();
        }
        return opaque;
    }

    @WorkerThread
    @NonNull
    public static byte[] toJpeg(@NonNull Bitmap bitmap) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out);
        return out.toByteArray();
    }

    private static InputStream open(ContentResolver resolver, Uri uri) throws IOException {
        InputStream in = resolver.openInputStream(uri);
        if (in == null) throw new IOException("Cannot open " + uri);
        return in;
    }

    /** Clockwise rotation from the EXIF tag; mirrored orientations are rare and ignored. */
    private static int rotationDegrees(ContentResolver resolver, Uri uri) {
        try (InputStream in = open(resolver, uri)) {
            return new ExifInterface(in).getRotationDegrees();
        } catch (IOException | RuntimeException e) {
            // PNG, WEBP and screenshots usually carry no EXIF at all.
            return 0;
        }
    }
}
