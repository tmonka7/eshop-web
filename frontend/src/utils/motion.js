/**
 * The runtime half of the motion layer in styles/global.css.
 *
 * Two jobs, both of them progressive enhancement: reveal elements as they
 * scroll into view, and flag the scrolled state on <body> so the header can
 * condense. Nothing here is required to read the page - the hidden starting
 * state is only ever applied by this file, so if the bundle fails to load, is
 * blocked, or the browser lacks IntersectionObserver, every element simply
 * stays visible with no animation.
 */

// Surfaces that read as a "block of content". Anything matching gets an
// entrance the first time it crosses into view; siblings stagger.
const REVEAL_SELECTOR = [
  '.hero',
  '.section-head',
  '.feature-item',
  '.category-chip',
  '.product-card',
  '.card',
  '.order-card',
  '.cart-line',
  '.trust-item',
  '.review-item',
  '.timeline-item',
  '.empty-state',
  '.filter-group',
].join(',');

const STAGGER_MS = 60;
const STAGGER_CAP = 8; // a 40-card grid should not take 2.4s to finish arriving
const MARKED = 'data-reveal';

let observer = null;
let staggerSeen = new WeakMap();

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Elements arriving together in one container should cascade rather than all
 * animate at once. The index is per-parent and counts only elements we are
 * actually revealing, so a grid of cards staggers but a lone card does not.
 */
function staggerDelay(el) {
  const parent = el.parentElement;
  if (!parent) return 0;
  const seen = staggerSeen.get(parent) || 0;
  staggerSeen.set(parent, seen + 1);
  return Math.min(seen, STAGGER_CAP) * STAGGER_MS;
}

function observe(root) {
  if (!observer) return;
  const nodes = [];
  if (root.matches && root.matches(REVEAL_SELECTOR)) nodes.push(root);
  if (root.querySelectorAll) {
    nodes.push(...root.querySelectorAll(REVEAL_SELECTOR));
  }
  for (const el of nodes) {
    if (el.hasAttribute(MARKED)) continue;
    // Nested matches (a .card inside a .card) would animate twice over.
    if (el.parentElement && el.parentElement.closest(`[${MARKED}]`)) continue;
    el.style.setProperty('--reveal-delay', `${staggerDelay(el)}ms`);
    el.setAttribute(MARKED, '');
    observer.observe(el);
  }
}

/**
 * Starts the motion runtime. Safe to call more than once; returns a teardown.
 */
export function startMotion() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  // Respect the OS setting by never hiding anything in the first place. The
  // stylesheet also neutralises the layer, but this keeps the observers off.
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    return () => {};
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute(MARKED, 'in');
        observer.unobserve(entry.target); // an entrance plays once, not per scroll
      }
    },
    // A little early and a little into the element, so a card is already
    // settled by the time it is properly on screen.
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  );

  observe(document.body);

  // Routes swap the whole page body, and lists grow as data arrives, so new
  // nodes have to be picked up as they appear rather than once at startup.
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) observe(node);
      }
    }
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      document.body.dataset.scrolled = window.scrollY > 8 ? '1' : '0';
      ticking = false;
    });
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', onScroll);
    mutations.disconnect();
    if (observer) observer.disconnect();
    observer = null;
    release();
  };
}

/**
 * Un-marks anything still waiting to be revealed.
 *
 * Without this, a teardown followed by a restart leaves those elements
 * carrying data-reveal - so the new observer skips them as already handled and
 * they stay at opacity 0 for good. React 18's StrictMode does exactly that
 * mount/unmount/mount cycle in development, so the page would come up blank
 * there. Elements that already finished (data-reveal="in") keep their mark.
 */
function release() {
  staggerSeen = new WeakMap();
  for (const el of document.querySelectorAll(`[${MARKED}=""]`)) {
    el.style.removeProperty('--reveal-delay');
    el.removeAttribute(MARKED);
  }
}

/**
 * Replays the page-level entrance. Called on every route change; the attribute
 * has to be removed and re-added across a frame or the animation will not
 * restart on a repeat navigation.
 */
export function replayPageEnter(el) {
  if (!el || prefersReducedMotion()) return;
  el.removeAttribute('data-enter');
  // Reading offsetWidth forces the style flush that makes the restart stick.
  void el.offsetWidth;
  el.setAttribute('data-enter', '');
}
