package com.auramart.app.ui.visual;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.provider.Settings;
import android.util.AttributeSet;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.auramart.app.util.RegionDetector.Box;

/**
 * Shows the query photo with the product area as a glowing green box that
 * the user can move (drag inside), resize (drag one of the 8 handles) or
 * redraw (drag outside the box). D-pad / arrow keys move it, and with Shift
 * held they resize it. The listener fires once per finished gesture, with the
 * box in fractions of the photo - the space the API and RegionDetector use.
 */
public class RegionSelectorView extends View {

    public interface OnRegionChangedListener {
        void onRegionChanged(@NonNull Box box);
    }

    private static final int GREEN = Color.rgb(0x22, 0xC5, 0x5E);
    private static final int GREEN_DARK = Color.rgb(0x16, 0xA3, 0x4A);
    private static final int SCRIM = Color.argb(0x61, 0x0B, 0x1F, 0x14);
    private static final float MIN = 0.04f;

    private final float density;
    private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG);
    private final Paint scrimPaint = new Paint();
    private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint handleFill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint handleStroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF imageRect = new RectF();
    private final RectF boxRect = new RectF();

    @Nullable
    private Bitmap bitmap;
    @Nullable
    private Box box;
    @Nullable
    private OnRegionChangedListener listener;
    @Nullable
    private ValueAnimator pulse;
    private float glow = 1f;

    // Current gesture: which part is being dragged, and where it started.
    private String mode;
    private Box startBox;
    private float startX;
    private float startY;

    public RegionSelectorView(Context context) {
        this(context, null);
    }

    public RegionSelectorView(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        density = getResources().getDisplayMetrics().density;
        // BlurMaskFilter (the glow) needs a software layer; the view is small.
        setLayerType(LAYER_TYPE_SOFTWARE, null);
        setFocusable(true);
        scrimPaint.setColor(SCRIM);
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeWidth(2f * density);
        strokePaint.setColor(GREEN);
        glowPaint.setStyle(Paint.Style.STROKE);
        glowPaint.setStrokeWidth(4f * density);
        glowPaint.setColor(GREEN);
        glowPaint.setMaskFilter(new BlurMaskFilter(8f * density, BlurMaskFilter.Blur.NORMAL));
        handleFill.setColor(Color.WHITE);
        handleStroke.setStyle(Paint.Style.STROKE);
        handleStroke.setStrokeWidth(2f * density);
        handleStroke.setColor(GREEN_DARK);
    }

    public void setOnRegionChangedListener(@Nullable OnRegionChangedListener l) {
        listener = l;
    }

    public void setImage(@Nullable Bitmap image) {
        bitmap = image;
        requestLayout();
        invalidate();
    }

    /** Shows `region` (null hides the box). Ignored while the user is dragging. */
    public void setRegion(@Nullable Box region) {
        if (mode != null) return;
        box = region == null ? null : region.clamped();
        updatePulse();
        invalidate();
    }

    @Nullable
    public Box getRegion() {
        return box;
    }

    @Override
    public void setEnabled(boolean enabled) {
        super.setEnabled(enabled);
        updatePulse();
        invalidate();
    }

    /* ------------------------------------------------------------ layout */

    @Override
    protected void onMeasure(int widthSpec, int heightSpec) {
        int width = MeasureSpec.getSize(widthSpec);
        int height = MeasureSpec.getSize(heightSpec);
        if (bitmap != null && MeasureSpec.getMode(heightSpec) != MeasureSpec.EXACTLY) {
            int natural = Math.round(width * (float) bitmap.getHeight() / bitmap.getWidth());
            height = MeasureSpec.getMode(heightSpec) == MeasureSpec.AT_MOST ? Math.min(natural, height) : natural;
        }
        setMeasuredDimension(width, height);
    }

    private void layoutImage() {
        imageRect.setEmpty();
        if (bitmap == null) return;
        float w = getWidth() - getPaddingLeft() - getPaddingRight();
        float h = getHeight() - getPaddingTop() - getPaddingBottom();
        float scale = Math.min(w / bitmap.getWidth(), h / bitmap.getHeight());
        float dw = bitmap.getWidth() * scale;
        float dh = bitmap.getHeight() * scale;
        float left = getPaddingLeft() + (w - dw) / 2f;
        float top = getPaddingTop() + (h - dh) / 2f;
        imageRect.set(left, top, left + dw, top + dh);
    }

    /* ------------------------------------------------------------- drawing */

    @Override
    protected void onDraw(@NonNull Canvas canvas) {
        super.onDraw(canvas);
        layoutImage();
        if (bitmap == null) return;
        canvas.drawBitmap(bitmap, null, imageRect, bitmapPaint);
        if (box == null) return;

        boxRect.set(imageRect.left + box.x * imageRect.width(), imageRect.top + box.y * imageRect.height(),
                imageRect.left + (box.x + box.w) * imageRect.width(),
                imageRect.top + (box.y + box.h) * imageRect.height());
        // Dim everything outside the box.
        canvas.drawRect(imageRect.left, imageRect.top, imageRect.right, boxRect.top, scrimPaint);
        canvas.drawRect(imageRect.left, boxRect.bottom, imageRect.right, imageRect.bottom, scrimPaint);
        canvas.drawRect(imageRect.left, boxRect.top, boxRect.left, boxRect.bottom, scrimPaint);
        canvas.drawRect(boxRect.right, boxRect.top, imageRect.right, boxRect.bottom, scrimPaint);

        glowPaint.setAlpha(Math.round(255 * (isEnabled() ? glow : 0.5f)));
        canvas.drawRect(boxRect, glowPaint);
        canvas.drawRect(boxRect, strokePaint);

        if (!isEnabled()) return;
        float r = 6f * density;
        for (float[] p : handlePoints()) {
            canvas.drawCircle(p[0], p[1], r, handleFill);
            canvas.drawCircle(p[0], p[1], r, handleStroke);
        }
    }

    private float[][] handlePoints() {
        float cx = boxRect.centerX();
        float cy = boxRect.centerY();
        return new float[][]{
                {boxRect.left, boxRect.top}, {cx, boxRect.top}, {boxRect.right, boxRect.top},
                {boxRect.right, cy}, {boxRect.right, boxRect.bottom}, {cx, boxRect.bottom},
                {boxRect.left, boxRect.bottom}, {boxRect.left, cy},
        };
    }

    private static final String[] HANDLES = {"nw", "n", "ne", "e", "se", "s", "sw", "w"};

    /** Gently pulses the glow, unless system animations are switched off. */
    private void updatePulse() {
        boolean want = box != null && isEnabled() && isAttachedToWindow() && animationsEnabled();
        if (want && pulse == null) {
            pulse = ValueAnimator.ofFloat(0.55f, 1f);
            pulse.setDuration(900);
            pulse.setRepeatMode(ValueAnimator.REVERSE);
            pulse.setRepeatCount(ValueAnimator.INFINITE);
            pulse.addUpdateListener(a -> {
                glow = (float) a.getAnimatedValue();
                invalidate();
            });
            pulse.start();
        } else if (!want && pulse != null) {
            pulse.cancel();
            pulse = null;
            glow = 1f;
        }
    }

    private boolean animationsEnabled() {
        return Settings.Global.getFloat(getContext().getContentResolver(),
                Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f;
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        updatePulse();
    }

    @Override
    protected void onDetachedFromWindow() {
        if (pulse != null) {
            pulse.cancel();
            pulse = null;
        }
        super.onDetachedFromWindow();
    }

    /* -------------------------------------------------------------- touch */

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        if (!isEnabled() || bitmap == null || imageRect.isEmpty()) return false;
        switch (e.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                startX = e.getX();
                startY = e.getY();
                mode = hitTest(startX, startY);
                if ("draw".equals(mode)) {
                    float fx = clamp((startX - imageRect.left) / imageRect.width(), 0f, 1f - MIN);
                    float fy = clamp((startY - imageRect.top) / imageRect.height(), 0f, 1f - MIN);
                    startBox = new Box(fx, fy, MIN, MIN, true);
                    mode = "se";
                    box = startBox;
                } else {
                    startBox = box;
                }
                getParent().requestDisallowInterceptTouchEvent(true);
                invalidate();
                return true;
            case MotionEvent.ACTION_MOVE:
                if (mode == null) return false;
                box = drag(startBox, mode, (e.getX() - startX) / imageRect.width(),
                        (e.getY() - startY) / imageRect.height());
                invalidate();
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                if (mode == null) return false;
                mode = null;
                getParent().requestDisallowInterceptTouchEvent(false);
                if (e.getActionMasked() == MotionEvent.ACTION_UP) {
                    performClick();
                    notifyChanged();
                } else {
                    box = startBox;
                }
                invalidate();
                return true;
            default:
                return false;
        }
    }

    @Override
    public boolean performClick() {
        return super.performClick();
    }

    private String hitTest(float x, float y) {
        if (box != null) {
            float slop = 24f * density;
            float[][] points = handlePoints();
            for (int i = 0; i < points.length; i++) {
                if (Math.hypot(x - points[i][0], y - points[i][1]) <= slop) return HANDLES[i];
            }
            if (boxRect.contains(x, y)) return "move";
        }
        return "draw";
    }

    private static Box drag(Box from, String mode, float dx, float dy) {
        if ("move".equals(mode)) {
            return new Box(clamp(from.x + dx, 0f, 1f - from.w), clamp(from.y + dy, 0f, 1f - from.h),
                    from.w, from.h, true);
        }
        float x = from.x;
        float y = from.y;
        float x2 = from.x + from.w;
        float y2 = from.y + from.h;
        if (mode.contains("w")) x = clamp(from.x + dx, 0f, x2 - MIN);
        if (mode.contains("e")) x2 = clamp(x2 + dx, x + MIN, 1f);
        if (mode.contains("n")) y = clamp(from.y + dy, 0f, y2 - MIN);
        if (mode.contains("s")) y2 = clamp(y2 + dy, y + MIN, 1f);
        return new Box(x, y, x2 - x, y2 - y, true);
    }

    private static float clamp(float v, float lo, float hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    /* ----------------------------------------------------------- keyboard */

    private final Runnable keyCommit = this::notifyChanged;

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (box == null || !isEnabled()) return super.onKeyDown(keyCode, event);
        float step = 0.01f;
        float dx = 0f;
        float dy = 0f;
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_LEFT: dx = -step; break;
            case KeyEvent.KEYCODE_DPAD_RIGHT: dx = step; break;
            case KeyEvent.KEYCODE_DPAD_UP: dy = -step; break;
            case KeyEvent.KEYCODE_DPAD_DOWN: dy = step; break;
            default: return super.onKeyDown(keyCode, event);
        }
        box = drag(box, event.isShiftPressed() ? "se" : "move", dx, dy);
        invalidate();
        // Search once the key presses settle, not on every step.
        removeCallbacks(keyCommit);
        postDelayed(keyCommit, 450);
        return true;
    }

    private void notifyChanged() {
        if (box != null && listener != null && (startBox == null || !box.sameAs(startBox))) {
            listener.onRegionChanged(box);
        }
        startBox = box;
    }
}
