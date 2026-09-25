package com.auramart.app.util;

/**
 * Turns ARGB pixels into the DINOv3 input tensor (float32, CHW, 1x3xHxW).
 *
 * It has to reproduce the server's preprocessing closely, because the phone's
 * vector is compared against vectors the API computed with sharp: a plain,
 * non aspect-preserving resize to 224x224, scaling to [0,1], then ImageNet
 * mean/std. Android's built-in bitmap scaling does not antialias, which shifts
 * the embedding noticeably (cosine ~0.94-0.97 against the server's), so the
 * resize here is an antialiased bilinear (triangle) filter whose support grows
 * with the downscale factor - the same scheme PIL and libvips use. It matches
 * the server to a cosine of ~0.9998.
 *
 * Plain Java with no Android types, so it can be unit-tested on the JVM.
 */
public final class Dinov3Preprocessor {

    private final int width;
    private final int height;
    private final float[] mean;
    private final float[] std;

    public Dinov3Preprocessor(int width, int height, float[] mean, float[] std) {
        this.width = width;
        this.height = height;
        this.mean = mean.clone();
        this.std = std.clone();
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    /** Same normalisation, another output size (region detection runs at ~320 px). */
    public Dinov3Preprocessor resized(int newWidth, int newHeight) {
        return new Dinov3Preprocessor(newWidth, newHeight, mean, std);
    }

    /**
     * @param argb source pixels, row-major, as from Bitmap.getPixels(); must be opaque
     * @return 3 * height * width floats, channel-planar (R plane, then G, then B)
     */
    public float[] toTensor(int[] argb, int srcWidth, int srcHeight) {
        // Split into float channels once; both passes then work per channel.
        int n = srcWidth * srcHeight;
        float[][] src = new float[3][n];
        for (int i = 0; i < n; i++) {
            int p = argb[i];
            src[0][i] = (p >> 16) & 0xff;
            src[1][i] = (p >> 8) & 0xff;
            src[2][i] = p & 0xff;
        }

        Filter horizontal = new Filter(srcWidth, width);
        Filter vertical = new Filter(srcHeight, height);
        int plane = width * height;
        float[] out = new float[3 * plane];
        float[] rows = new float[width * srcHeight];

        for (int c = 0; c < 3; c++) {
            float[] channel = src[c];
            // Horizontal pass: srcWidth x srcHeight -> width x srcHeight.
            for (int y = 0; y < srcHeight; y++) {
                int rowOffset = y * srcWidth;
                for (int x = 0; x < width; x++) {
                    float sum = 0f;
                    int start = horizontal.start[x];
                    float[] w = horizontal.weights[x];
                    for (int k = 0; k < w.length; k++) sum += channel[rowOffset + start + k] * w[k];
                    rows[y * width + x] = sum;
                }
            }
            // Vertical pass, then rescale and normalise into the output plane.
            float scale = 1f / 255f;
            for (int y = 0; y < height; y++) {
                int start = vertical.start[y];
                float[] w = vertical.weights[y];
                for (int x = 0; x < width; x++) {
                    float sum = 0f;
                    for (int k = 0; k < w.length; k++) sum += rows[(start + k) * width + x] * w[k];
                    float value = Math.min(255f, Math.max(0f, sum)) * scale;
                    out[c * plane + y * width + x] = (value - mean[c]) / std[c];
                }
            }
        }
        return out;
    }

    /** Precomputed triangle-filter taps for resampling `in` samples to `out`. */
    private static final class Filter {
        final int[] start;
        final float[][] weights;

        Filter(int in, int out) {
            double scale = (double) in / out;
            double filterScale = Math.max(scale, 1.0);
            double support = filterScale; // bilinear has a radius of 1 source pixel
            start = new int[out];
            weights = new float[out][];

            for (int i = 0; i < out; i++) {
                double center = (i + 0.5) * scale;
                int min = Math.max((int) (center - support + 0.5), 0);
                int max = Math.min((int) (center + support + 0.5), in);
                float[] w = new float[Math.max(max - min, 1)];
                double total = 0;
                for (int k = 0; k < max - min; k++) {
                    double t = Math.abs((min + k - center + 0.5) / filterScale);
                    double value = t < 1.0 ? 1.0 - t : 0.0;
                    w[k] = (float) value;
                    total += value;
                }
                if (total > 0) {
                    for (int k = 0; k < w.length; k++) w[k] /= (float) total;
                } else {
                    w[0] = 1f;
                }
                start[i] = Math.min(min, in - 1);
                weights[i] = w;
            }
        }
    }
}
