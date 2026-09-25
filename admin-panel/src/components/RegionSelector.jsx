import { useEffect, useRef, useState } from 'react';

/** Smallest box side, as a fraction of the photo. */
const MIN = 0.04;
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 10000) / 10000;

/** Applies a pointer delta (fractions) to `start` for the given drag mode. */
function dragBox(start, mode, dx, dy) {
  if (mode === 'move') {
    return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) };
  }
  let { x, y } = start;
  let x2 = start.x + start.w;
  let y2 = start.y + start.h;
  if (mode.includes('w')) x = clamp(start.x + dx, 0, x2 - MIN);
  if (mode.includes('e')) x2 = clamp(x2 + dx, x + MIN, 1);
  if (mode.includes('n')) y = clamp(start.y + dy, 0, y2 - MIN);
  if (mode.includes('s')) y2 = clamp(y2 + dy, y + MIN, 1);
  return { x, y, w: x2 - x, h: y2 - y };
}

const sameBox = (a, b) => a && b && ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k] - b[k]) < 1e-4);

/**
 * A photo with the product area drawn as a glowing green box.
 *
 * Copy of frontend/src/components/RegionSelector.jsx - keep the two in step.
 *
 * The box starts where the server detected the product. The user can drag
 * it, pull any of its 8 handles, or drag on the photo to draw a new one; with
 * the keyboard, arrow keys move it and Shift + arrow keys resize it.
 * `onChange` fires once per finished gesture, with fractions (0..1) of the
 * upright photo - the same space the API uses.
 */
export default function RegionSelector({ src, alt, region, onChange, disabled, label }) {
  const frameRef = useRef(null);
  const drag = useRef(null);
  const keyTimer = useRef(null);
  const [box, setBox] = useState(region);

  // Follow the parent's region unless the user is mid-gesture.
  useEffect(() => {
    if (!drag.current) setBox(region);
  }, [region]);

  useEffect(() => () => clearTimeout(keyTimer.current), []);

  const commit = (next) => {
    const rounded = { x: round(next.x), y: round(next.y), w: round(next.w), h: round(next.h) };
    if (!sameBox(rounded, region)) onChange?.(rounded);
  };

  function start(e, mode) {
    if (disabled || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = frameRef.current.getBoundingClientRect();
    let from = box || { x: 0, y: 0, w: 1, h: 1 };
    if (mode === 'draw') {
      // A fresh box anchored where the pointer went down, grown from its SE corner.
      const px = clamp((e.clientX - rect.left) / rect.width, 0, 1 - MIN);
      const py = clamp((e.clientY - rect.top) / rect.height, 0, 1 - MIN);
      from = { x: px, y: py, w: MIN, h: MIN };
      mode = 'se'; // eslint-disable-line no-param-reassign
      setBox(from);
    }
    drag.current = { mode, from, x: e.clientX, y: e.clientY, rect, last: from };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const next = dragBox(d.from, d.mode, (e.clientX - d.x) / d.rect.width, (e.clientY - d.y) / d.rect.height);
    d.last = next;
    setBox(next);
  }

  function end() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    commit(d.last);
  }

  function onKeyDown(e) {
    const step = e.altKey ? 0.002 : 0.01;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta || disabled || !box) return;
    e.preventDefault();
    const next = dragBox(box, e.shiftKey ? 'se' : 'move', delta[0], delta[1]);
    setBox(next);
    // Search once the key presses settle, not on every step.
    clearTimeout(keyTimer.current);
    keyTimer.current = setTimeout(() => commit(next), 450);
  }

  const style = box && {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };

  return (
    <div
      ref={frameRef}
      className={`region-frame ${disabled ? 'is-disabled' : ''}`}
      onPointerDown={(e) => start(e, 'draw')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <img src={src} alt={alt} draggable={false} />
      {box ? (
        <div
          className={`region-box ${drag.current ? 'is-dragging' : ''}`}
          style={style}
          role="group"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          onPointerDown={(e) => start(e, 'move')}
          onKeyDown={onKeyDown}
        >
          {HANDLES.map((h) => (
            <span
              key={h}
              className={`region-handle region-handle-${h}`}
              onPointerDown={(e) => start(e, h)}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
