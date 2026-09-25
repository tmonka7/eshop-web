package com.auramart.app.util;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * JVM tests for RegionDetector. The cases and expected boxes are the same as
 * backend/test/regionDetect.test.js, so the two ports stay interchangeable.
 */
public class RegionDetectorTest {

    private static final float EPS = 1e-3f;

    /** Patches inside `box` (patch units) carry one feature direction and colour, the rest another. */
    private static RegionDetector.Grid grid(int gw, int gh, int bx, int by, int bw, int bh,
                                            float noise, boolean sameColour) {
        int dim = 8;
        long[] seed = {7};
        float[] patches = new float[gw * gh * dim];
        for (int y = 0; y < gh; y++) {
            for (int x = 0; x < gw; x++) {
                int hot = inside(x, y, bx, by, bw, bh) ? 1 : 0;
                for (int k = 0; k < dim; k++) {
                    seed[0] = (seed[0] * 16807) % 2147483647;
                    float r = (float) (seed[0] / 2147483647.0 - 0.5);
                    patches[(y * gw + x) * dim + k] = (k == hot ? 1f : 0f) + noise * r;
                }
            }
        }
        int ppp = RegionDetector.PIXELS_PER_PATCH;
        int w = gw * ppp;
        int h = gh * ppp;
        int[] argb = new int[w * h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                boolean in = !sameColour && inside(x / ppp, y / ppp, bx, by, bw, bh);
                argb[y * w + x] = in ? 0xFFB4281E : 0xFFFAFAFA;
            }
        }
        return new RegionDetector.Grid(patches, gw, gh, dim, argb);
    }

    private static boolean inside(int x, int y, int bx, int by, int bw, int bh) {
        return x >= bx && x < bx + bw && y >= by && y < by + bh;
    }

    @Test
    public void findsProductOnPlainBackground() {
        RegionDetector.Box b = RegionDetector.detect(grid(20, 15, 5, 4, 6, 5, 0.05f, false));
        assertTrue(b.found);
        assertEquals(0.25f, b.x, EPS);
        assertEquals(0.2667f, b.y, EPS);
        assertEquals(0.3f, b.w, EPS);
        assertEquals(0.3333f, b.h, EPS);
    }

    @Test
    public void usesFeatureCueWhenColoursAreIdentical() {
        RegionDetector.Box b = RegionDetector.detect(grid(16, 16, 9, 2, 4, 9, 0.05f, true));
        assertEquals(0.5625f, b.x, EPS);
        assertEquals(0.125f, b.y, EPS);
        assertEquals(0.25f, b.w, EPS);
        assertEquals(0.5625f, b.h, EPS);
    }

    @Test
    public void uniformPhotoReportsNothingFound() {
        assertFalse(RegionDetector.detect(grid(10, 10, 0, 0, 0, 0, 0f, false)).found);
    }

    @Test
    public void clampedKeepsBoxInsideAndAboveMinimum() {
        RegionDetector.Box b = new RegionDetector.Box(-0.5f, 0.99f, 3f, 0f, true).clamped();
        assertEquals(0f, b.x, EPS);
        assertEquals(1f - RegionDetector.MIN_SIDE, b.y, EPS);
        assertEquals(1f, b.w, EPS);
        assertEquals(RegionDetector.MIN_SIDE, b.h, EPS);
        assertTrue(RegionDetector.Box.whole().isWhole());
    }
}
