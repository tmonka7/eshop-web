package com.auramart.app.util;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Finds the product in a photo from DINOv3 patch tokens, so the green search
 * box can be drawn without a separate detection model.
 *
 * Port of backend/src/services/regionDetect.js - keep the two in step. Each
 * 16x16 patch is scored by how unlike the image border its DINOv3 feature is
 * (the border stands in for the background), multiplied by how far its colours
 * are from the median border colour. Patches above max(Otsu, 0.55 x max) form
 * a mask; the connected component with the most centre-weighted score is the
 * product and its bounding box is returned as fractions of the image.
 *
 * Plain Java with no Android types, so it can be unit-tested on the JVM.
 */
public final class RegionDetector {

    /** Colour cue: each patch is sampled on an 8x8 pixel grid. */
    public static final int PIXELS_PER_PATCH = 8;

    private static final float COLOR_SCALE = 48f;
    private static final float COLOR_WEIGHT = 0.7f;
    private static final float REL_THRESHOLD = 0.55f;
    private static final int OTSU_BINS = 64;
    private static final float WHOLE_IMAGE_COVERAGE = 0.92f;
    /** Smallest side a box may have, as a fraction of the photo. */
    public static final float MIN_SIDE = 0.04f;

    private RegionDetector() {
    }

    /** Patch tokens of one image plus a small RGB copy for the colour cue. */
    public static final class Grid {
        /** gw * gh * dim floats, patches row-major. */
        public final float[] patches;
        public final int gw;
        public final int gh;
        public final int dim;
        /** (gw*8) x (gh*8) pixels, ARGB as from Bitmap.getPixels(). */
        public final int[] argb;

        public Grid(float[] patches, int gw, int gh, int dim, int[] argb) {
            this.patches = patches;
            this.gw = gw;
            this.gh = gh;
            this.dim = dim;
            this.argb = argb;
        }
    }

    /** A region in image fractions (0..1). */
    public static final class Box {
        public final float x;
        public final float y;
        public final float w;
        public final float h;
        /** False when nothing stood out and the box covers (almost) the whole photo. */
        public final boolean found;

        public Box(float x, float y, float w, float h, boolean found) {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.found = found;
        }

        public static Box whole() {
            return new Box(0f, 0f, 1f, 1f, false);
        }

        /** Clamped into the image and at least MIN_SIDE on each side. */
        public Box clamped() {
            float cx = clamp(x, 0f, 1f - MIN_SIDE);
            float cy = clamp(y, 0f, 1f - MIN_SIDE);
            float cw = clamp(w, MIN_SIDE, 1f - cx);
            float ch = clamp(h, MIN_SIDE, 1f - cy);
            return new Box(cx, cy, cw, ch, found);
        }

        public boolean isWhole() {
            return x <= 0.001f && y <= 0.001f && w >= 0.999f && h >= 0.999f;
        }

        public boolean sameAs(Box o) {
            return o != null && Math.abs(x - o.x) < 1e-3 && Math.abs(y - o.y) < 1e-3
                    && Math.abs(w - o.w) < 1e-3 && Math.abs(h - o.h) < 1e-3;
        }
    }

    public static Box detect(Grid grid) {
        int n = grid.gw * grid.gh;
        float[] feature = featureCue(grid);
        float[] color = colorCue(grid);
        float[] combined = new float[n];
        for (int i = 0; i < n; i++) combined[i] = feature[i] * (1f - COLOR_WEIGHT + COLOR_WEIGHT * color[i]);
        float[] score = normalize01(combined);

        float max = 0f;
        for (float v : score) max = Math.max(max, v);
        float threshold = Math.max(otsu(score), REL_THRESHOLD * max);
        boolean[] mask = new boolean[n];
        for (int i = 0; i < n; i++) mask[i] = score[i] >= threshold;

        int[] labels = new int[n];
        int count = label(mask, labels, grid.gw, grid.gh);
        if (count == 0) return Box.whole();

        double[] weight = new double[count + 1];
        for (int i = 0; i < n; i++) {
            if (labels[i] == 0) continue;
            double cx = ((i % grid.gw) + 0.5) / grid.gw - 0.5;
            double cy = ((i / grid.gw) + 0.5) / grid.gh - 0.5;
            weight[labels[i]] += score[i] * (1 - 0.5 * Math.hypot(cx, cy));
        }
        int best = 1;
        for (int l = 2; l <= count; l++) if (weight[l] > weight[best]) best = l;

        int x0 = grid.gw, y0 = grid.gh, x1 = -1, y1 = -1;
        for (int i = 0; i < n; i++) {
            if (labels[i] != best) continue;
            int x = i % grid.gw;
            int y = i / grid.gw;
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
        }
        float bx = (float) x0 / grid.gw;
        float by = (float) y0 / grid.gh;
        float bw = (float) (x1 + 1 - x0) / grid.gw;
        float bh = (float) (y1 + 1 - y0) / grid.gh;
        return new Box(bx, by, bw, bh, bw * bh < WHOLE_IMAGE_COVERAGE);
    }

    /* ------------------------------------------------------------ cues */

    static float[] featureCue(Grid g) {
        int n = g.gw * g.gh;
        int dim = g.dim;
        float[] unit = new float[n * dim];
        for (int i = 0; i < n; i++) {
            double sum = 0;
            for (int k = 0; k < dim; k++) sum += g.patches[i * dim + k] * g.patches[i * dim + k];
            float norm = (float) Math.sqrt(sum);
            if (norm == 0f) norm = 1f;
            for (int k = 0; k < dim; k++) unit[i * dim + k] = g.patches[i * dim + k] / norm;
        }
        List<Integer> border = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            int x = i % g.gw;
            int y = i / g.gw;
            if (x == 0 || y == 0 || x == g.gw - 1 || y == g.gh - 1) border.add(i);
        }
        int topK = Math.max(3, border.size() / 8);
        float[] raw = new float[n];
        float[] sims = new float[border.size()];
        for (int i = 0; i < n; i++) {
            for (int b = 0; b < border.size(); b++) {
                int o1 = i * dim;
                int o2 = border.get(b) * dim;
                float dot = 0f;
                for (int k = 0; k < dim; k++) dot += unit[o1 + k] * unit[o2 + k];
                sims[b] = dot;
            }
            Arrays.sort(sims);
            float top = 0f;
            for (int t = 0; t < topK; t++) top += sims[sims.length - 1 - t];
            raw[i] = -top / topK;
        }
        return normalize01(raw);
    }

    static float[] colorCue(Grid g) {
        int w = g.gw * PIXELS_PER_PATCH;
        int h = g.gh * PIXELS_PER_PATCH;
        List<float[]> ring = new ArrayList<>();
        for (int c = 0; c < 3; c++) ring.add(new float[2 * (w + h) - 4]);
        int r = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (x == 0 || y == 0 || x == w - 1 || y == h - 1) {
                    int p = g.argb[y * w + x];
                    ring.get(0)[r] = (p >> 16) & 0xff;
                    ring.get(1)[r] = (p >> 8) & 0xff;
                    ring.get(2)[r] = p & 0xff;
                    r++;
                }
            }
        }
        float[] bg = new float[3];
        for (int c = 0; c < 3; c++) bg[c] = median(Arrays.copyOf(ring.get(c), r));

        float[] cue = new float[g.gw * g.gh];
        float perPatch = PIXELS_PER_PATCH * PIXELS_PER_PATCH;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int p = g.argb[y * w + x];
                double d = Math.sqrt(sq(((p >> 16) & 0xff) - bg[0]) + sq(((p >> 8) & 0xff) - bg[1]) + sq((p & 0xff) - bg[2]));
                cue[(y / PIXELS_PER_PATCH) * g.gw + (x / PIXELS_PER_PATCH)] += (float) (d / perPatch);
            }
        }
        for (int i = 0; i < cue.length; i++) cue[i] = Math.min(1f, cue[i] / COLOR_SCALE);
        return cue;
    }

    /* ----------------------------------------------------------- helpers */

    private static double sq(double v) {
        return v * v;
    }

    private static float clamp(float v, float lo, float hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    private static float percentile(float[] sorted, double p) {
        if (sorted.length == 0) return 0f;
        double pos = (sorted.length - 1) * p;
        int lo = (int) Math.floor(pos);
        int hi = (int) Math.ceil(pos);
        return (float) (sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
    }

    private static float median(float[] values) {
        float[] sorted = values.clone();
        Arrays.sort(sorted);
        return percentile(sorted, 0.5);
    }

    /** Robust min-max scaling to [0, 1] using the 2nd and 98th percentiles. */
    static float[] normalize01(float[] values) {
        float[] sorted = values.clone();
        Arrays.sort(sorted);
        float lo = percentile(sorted, 0.02);
        float hi = percentile(sorted, 0.98);
        float span = hi - lo + 1e-6f;
        float[] out = new float[values.length];
        for (int i = 0; i < values.length; i++) out[i] = clamp((values[i] - lo) / span, 0f, 1f);
        return out;
    }

    static float otsu(float[] values) {
        double[] hist = new double[OTSU_BINS];
        for (float v : values) hist[Math.min(OTSU_BINS - 1, (int) Math.floor(v * OTSU_BINS))] += 1;
        double best = -1;
        float threshold = 0.5f;
        for (int i = 1; i < OTSU_BINS; i++) {
            double w0 = 0, s0 = 0, s1 = 0;
            for (int b = 0; b < OTSU_BINS; b++) {
                double p = hist[b] / values.length;
                double centre = (b + 0.5) / OTSU_BINS;
                if (b < i) {
                    w0 += p;
                    s0 += p * centre;
                } else {
                    s1 += p * centre;
                }
            }
            double w1 = 1 - w0;
            if (w0 <= 0 || w1 <= 0) continue;
            double variance = w0 * w1 * Math.pow(s0 / w0 - s1 / w1, 2);
            if (variance > best) {
                best = variance;
                threshold = (float) ((i + 0.5) / OTSU_BINS);
            }
        }
        return threshold;
    }

    /** 4-connected components; fills `labels` (0 = background) and returns the count. */
    static int label(boolean[] mask, int[] labels, int gw, int gh) {
        int next = 0;
        int[] stack = new int[mask.length];
        for (int start = 0; start < mask.length; start++) {
            if (!mask[start] || labels[start] != 0) continue;
            next++;
            int top = 0;
            labels[start] = next;
            stack[top++] = start;
            while (top > 0) {
                int i = stack[--top];
                int x = i % gw;
                int y = i / gw;
                int[] neighbours = {x > 0 ? i - 1 : -1, x < gw - 1 ? i + 1 : -1, y > 0 ? i - gw : -1, y < gh - 1 ? i + gw : -1};
                for (int j : neighbours) {
                    if (j >= 0 && mask[j] && labels[j] == 0) {
                        labels[j] = next;
                        stack[top++] = j;
                    }
                }
            }
        }
        return next;
    }
}
