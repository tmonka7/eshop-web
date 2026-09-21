/**
 * The runtime half of the motion layer in styles/admin.css.
 *
 * Everything here is progressive enhancement: the hidden starting state for an
 * entrance is only ever applied by this file, so if the script never runs the
 * dashboard still renders in full, just without the animation.
 */

import { useEffect, useRef, useState } from 'react';

// Blocks of content that get an entrance as they scroll into view. Table rows
// are handled separately in CSS, since a 50-row table should not have 50
// observers attached to it.
const REVEAL_SELECTOR = ['.stat-card', '.card', '.page-head', '.empty'].join(',');

const STAGGER_MS = 55;
const STAGGER_CAP = 8;
const MARKED = 'data-reveal';

let staggerSeen = new WeakMap();

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function staggerDelay(el) {
  const parent = el.parentElement;
  if (!parent) return 0;
  const seen = staggerSeen.get(parent) || 0;
  staggerSeen.set(parent, seen + 1);
  return Math.min(seen, STAGGER_CAP) * STAGGER_MS;
}

function observeWithin(observer, root) {
  const nodes = [];
  if (root.matches && root.matches(REVEAL_SELECTOR)) nodes.push(root);
  if (root.querySelectorAll) nodes.push(...root.querySelectorAll(REVEAL_SELECTOR));
  for (const el of nodes) {
    if (el.hasAttribute(MARKED)) continue;
    // A .card nested in a .card would otherwise animate twice over.
    if (el.parentElement && el.parentElement.closest(`[${MARKED}]`)) continue;
    el.style.setProperty('--reveal-delay', `${staggerDelay(el)}ms`);
    el.setAttribute(MARKED, '');
    observer.observe(el);
  }
}

/** Starts the motion runtime for the whole admin shell. Returns a teardown. */
export function startMotion() {
  if (typeof document === 'undefined') return () => {};
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute(MARKED, 'in');
        observer.unobserve(entry.target); // plays once, not on every scroll past
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
  );

  observeWithin(observer, document.body);

  // Pages swap out on navigation and tables fill in after their fetch resolves,
  // so new nodes have to be picked up as they appear.
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) observeWithin(observer, node);
      }
    }
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      document.body.dataset.scrolled = window.scrollY > 6 ? '1' : '0';
      ticking = false;
    });
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', onScroll);
    mutations.disconnect();
    observer.disconnect();
    release();
  };
}

/**
 * Un-marks anything still waiting to be revealed.
 *
 * Without this, a teardown followed by a restart leaves those elements
 * carrying data-reveal - so the new observer skips them as already handled and
 * they stay at opacity 0 for good. React 18's StrictMode does exactly that
 * mount/unmount/mount cycle in development, so the panel would come up blank
 * there. Elements that already finished (data-reveal="in") keep their mark.
 */
function release() {
  staggerSeen = new WeakMap();
  for (const el of document.querySelectorAll(`[${MARKED}=""]`)) {
    el.style.removeProperty('--reveal-delay');
    el.removeAttribute(MARKED);
  }
}

/** Replays the page-level entrance; call it on every route change. */
export function replayPageEnter(el) {
  if (!el || prefersReducedMotion()) return;
  el.removeAttribute('data-enter');
  void el.offsetWidth; // forces the style flush that restarts the animation
  el.setAttribute('data-enter', '');
}

/**
 * Counts a KPI up to its value on mount and on every change.
 *
 * The caller formats the number it gets back, so currency, compact and percent
 * tiles all animate the same way. The final frame is assigned the target
 * exactly rather than an interpolated value, so the number that comes to rest
 * is never a rounding artefact of the easing curve.
 */
export function useCountUp(target, duration = 900) {
  const value = Number(target);
  const safe = Number.isFinite(value) ? value : 0;
  // Starts at zero rather than at the target: these tiles mount only once
  // their data has loaded, so seeding with the final figure would mean the
  // first - and usually only - render never animates at all.
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      fromRef.current = safe;
      setShown(safe);
      return undefined;
    }

    const from = fromRef.current;
    if (from === safe) return undefined;

    let frame = 0;
    const start = performance.now();

    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      // easeOutCubic: fast at first, settling rather than braking.
      const eased = 1 - (1 - p) ** 3;
      setShown(p === 1 ? safe : from + (safe - from) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
      else fromRef.current = safe;
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [safe, duration]);

  return shown;
}
