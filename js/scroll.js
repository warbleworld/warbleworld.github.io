// ---------------------------------------------------------
// Two-axis scroll model + per-view scroll memory.
//
// The header (title) and the card content live on TWO independent
// scroll axes so a view switch can restore both at once — e.g. the
// title partly visible AND the list scrolled three cards down, a state
// a single scroll axis physically cannot represent.
//
//   • Header axis = the document scroll. Its useful range is the header
//     height H: scrolling 0->H slides the title away and pins the bars.
//     This offset is SHARED and simply carried across view switches, so
//     the header never jumps when you change tab/incarnation/player.
//
//   • Content axis = each `.tab-content`'s own `scrollTop` (it is an
//     overflow:auto scroller). This offset is remembered PER VIEW, so
//     every tab keeps its own place in its list.
//
// Because the two axes are separate elements, a gesture is routed between
// them by hand ONLY while the header still has to move:
//   down -> hide the header, then hand the rest to the content
//   up   -> once content is back at its top, reveal the header
// Wheel events are coordinated only while the header needs to move.
// Touch is coordinated too so rubber-band can exclude pinned UI.
// ---------------------------------------------------------

/** Per-view content scroll offset (tab-content.scrollTop), keyed by id. */
const contentOffsets = new Map();

/** Header offset (document scrollY) captured at the last view switch. */
let lastHeaderOffset = 0;

/** Observer that re-measures the bars whenever their size changes. */
let barObserver = null;

/** Cached header height (the header axis length H). Reading it per frame
    via offsetHeight forces a synchronous layout, so we measure it only
    when sizes actually change (resize / fonts / ResizeObserver). */
let headerH = 0;

/**
 * Measure the stacked sticky bars and expose their heights as CSS
 * variables so each bar can stick directly beneath the previous one.
 */
export function updateStickyOffsets() {
  const root = document.documentElement;
  const header = document.querySelector(".header");
  const playerBar = document.querySelector(".player-bar");
  const activePage = document.querySelector(".player-page.active");
  const incBar = activePage?.querySelector(".inc-bar");
  const tabBar = activePage?.querySelector(".inc-content.active .tab-bar");

  if (header) headerH = header.offsetHeight;
  if (playerBar) root.style.setProperty("--player-bar-h", `${playerBar.offsetHeight}px`);
  if (incBar) root.style.setProperty("--inc-bar-h", `${incBar.offsetHeight}px`);
  if (tabBar) root.style.setProperty("--tab-bar-h", `${tabBar.offsetHeight}px`);
}

/** The currently visible leaf view (active tab panel), or null. */
function activeLeaf() {
  return document.querySelector(
    ".player-page.active .inc-content.active .tab-content.active",
  );
}
/**
 * Relocate the single footer into the active content scroller so it is
 * reached by scrolling that scroller (the content axis) rather than the
 * document. Keeping it inside the same scroll box as the sticky filter
 * pills means reaching the footer never scrolls the pills out of view.
 */
function attachFooter() {
  const footer = document.querySelector(".footer");
  const leaf = activeLeaf();
  if (footer && leaf && footer.parentElement !== leaf) leaf.appendChild(footer);
}
/**
 * Scroll offset at which the title is fully scrolled away and every bar
 * is pinned. Equals the cached height of the non-sticky header above the
 * bars (measured in updateStickyOffsets, never per frame).
 *
 * We measure the header (not the player bar) on purpose: the player bar
 * is `position: sticky`, and once it is pinned its `offsetTop` reports
 * its current document position (≈ scrollY) rather than its stable
 * in-flow position. That made the threshold track the scroll and
 * collapsed the per-view offset model. The header scrolls normally, so
 * its height is a constant, scroll-independent reference.
 */
function pinnedThreshold() {
  return headerH;
}

/** Watch the currently visible bars so the offsets stay correct. */
function observeBars() {
  if (!barObserver) return;
  barObserver.disconnect();
  [
    document.querySelector(".header"),
    document.querySelector(".player-bar"),
    document.querySelector(".player-page.active .inc-bar"),
    document.querySelector(".player-page.active .inc-content.active .tab-bar"),
  ]
    .filter(Boolean)
    .forEach((bar) => barObserver.observe(bar));
}

/** Record the active view's scroll. Call before a view switch. */
export function saveActiveScroll() {
  lastHeaderOffset = Math.min(window.scrollY, pinnedThreshold());

  const leaf = activeLeaf();
  if (leaf) contentOffsets.set(leaf.id, leaf.scrollTop);

  // Drop any rubber-band stretch on the outgoing panel so it doesn't keep
  // a stale transform after the switch.
  resetOverscroll();
}

/**
 * Restore scroll after a view switch (and after the view is built).
 *
 * The two axes are set independently: the shared header offset is
 * re-applied (so the title stays exactly where it was — fully pinned,
 * partly visible, or fully shown), and the content scroller is moved to
 * THIS view's own remembered offset (0 for a never-visited view). Each
 * view therefore keeps its own place in its list while the header never
 * jumps.
 */
export function restoreActiveScroll() {
  updateStickyOffsets();
  observeBars();
  attachFooter();

  const leaf = activeLeaf();
  if (!leaf) return;

  const headerTarget = Math.min(lastHeaderOffset, pinnedThreshold());
  const contentTarget = contentOffsets.get(leaf.id) ?? 0;

  // Apply now and reassert on the next two frames. Swapping the active
  // panel (and toggling display:none, which can reset a hidden element's
  // scrollTop) triggers layouts in which the browser may nudge either
  // axis; the synchronous write avoids a flash of the wrong frame and the
  // follow-ups make this view's remembered offsets the final word.
  const apply = () => {
    window.scrollTo(0, headerTarget);
    headerScroll = headerTarget;
    leaf.scrollTop = contentTarget;
  };
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

// -- Gesture coordinator ----------------------------------
// Routes a single wheel/touch gesture across the header (document) and
// content (active scroller) axes so the two-element split still feels
// like one continuous scroll.

/** True when an overlay owns scrolling and we must not interfere. */
function overlayActive(target) {
  const body = document.body.classList;
  if (body.contains("modal-open") || body.contains("d20-modal-open")) return true;
  return !!(target.closest && target.closest(".card-modal, .card-modal-backdrop, .d20-overlay"));
}

/** Distribute a pixel delta (positive = downward) across both axes and
 * return the unabsorbed (leftover) signed delta — nonzero only when the
 * gesture has reached the very top or bottom, which the rubber-band uses.
 *
 * The document (header) position is mirrored in `headerScroll` so the hot
 * path never reads `window.scrollY` (a layout read). It is written as a
 * sub-pixel value: rounding it quantized the title to whole CSS pixels
 * (several device pixels on a high-DPI phone), making it visibly step
 * while the finger moved smoothly. With the per-frame reflow now gone
 * (headerH is cached) the fractional write is judder-free. */
function distribute(delta) {
  const sc = activeLeaf();
  if (!sc) return 0;

  const H = pinnedThreshold();

  if (delta > 0) {
    // Down: slide the title away (document, 0->H), then scroll content.
    // The footer lives at the bottom of the content scroller, so it is
    // reached purely by content scroll — the pinned filter pills stay put.
    let rest = delta;
    const headerRoom = Math.max(0, H - headerScroll);
    if (headerRoom > 0) {
      const used = Math.min(rest, headerRoom);
      headerScroll += used;
      window.scrollTo(0, headerScroll);
      rest -= used;
    }
    if (rest > 0) {
      const contentRoom = Math.max(0, sc.scrollHeight - sc.clientHeight - sc.scrollTop);
      const used = Math.min(rest, contentRoom);
      sc.scrollTop += used;
      rest -= used;
    }
    return rest; // leftover past the bottom
  } else if (delta < 0) {
    // Up: scroll content back to its top, then reveal the title.
    let mag = -delta;
    if (sc.scrollTop > 0) {
      const used = Math.min(mag, sc.scrollTop);
      sc.scrollTop -= used;
      mag -= used;
    }
    if (mag > 0 && headerScroll > 0) {
      const used = Math.min(mag, headerScroll);
      headerScroll -= used;
      window.scrollTo(0, headerScroll);
      mag -= used;
    }
    return -mag; // leftover past the top
  }
  return 0;
}

// -- Elastic scroll engine --------------------------------
// Models Apple's overflow elastic scrolling for the inner panel: a finger
// drag past an edge meets an asymptotic rubber-band resistance, a flick
// carries inertial momentum that decays like iOS, and releasing (or a
// fling hitting an edge) bounces back to rest. Only the content children
// move — the pinned filter bar and footer stay anchored.

/** Active momentum/spring rAF id, or 0 when idle. */
let glideId = 0;
/** Raw finger/inertia distance past an edge (signed, px). The visible
    translate is a compressed function of this — see rubberBand(). */
let overscrollRaw = 0;
/** Current rubber-band translate on the active panel, in px (derived from
    overscrollRaw). >0 = pulled down (top edge), <0 = pulled up (bottom). */
let overscroll = 0;
/** Velocity carried into the bounce-back animation (raw px/frame). */
let springV = 0;
/** Last value written to the DOM, so we only touch style on change. */
let appliedOverscroll = 0;
/** Pending wheel-end spring timer (wheel has no release event). */
let wheelEndTimer = 0;
/** Mirror of the document scroll (header axis), kept fractional here and
    written to the window rounded. Resynced from window.scrollY whenever a
    gesture begins or a view is restored. */
let headerScroll = 0;

/** Re-read the true document scroll into the mirror (e.g. at gesture
    start, in case focus/keyboard moved it). */
function syncHeader() {
  headerScroll = window.scrollY;
}

/** Apple's rubber-band resistance constant (~0.55). Lower = stiffer. */
const RUBBER_C = 0.55;
/** Fraction of the raw overscroll retained each bounce-back frame
    (exponential return to rest; lower = snappier). */
const SPRING_PULL = 0.82;
/** Fraction of the carried velocity retained each bounce-back frame. */
const SPRING_VEL_DECAY = 0.86;
/** Per-frame speed retained during a touch fling (≈ iOS 0.998/ms). */
const FLING_FRICTION = 0.96;

/** Height the rubber-band resistance is scaled against — the visible
    content box, matching Apple's use of the scroll dimension. */
function rubberDim() {
  const sc = activeLeaf();
  return sc ? Math.max(1, sc.clientHeight) : Math.max(1, window.innerHeight);
}

/** Apple's rubber-band curve: map a raw past-edge distance to the smaller,
    asymptotic visible offset so resistance grows with distance. As the raw
    distance → ∞ the visible offset approaches the container height. */
function rubberBand(raw) {
  const d = rubberDim();
  const x = Math.abs(raw);
  const f = (x * d * RUBBER_C) / (d + RUBBER_C * x);
  return raw < 0 ? -f : f;
}

/** Children of the active scroller that should rubber-band: everything
    except the pinned filter bar and the footer, which stay put. */
function overscrollNodes(sc) {
  const nodes = [];
  for (const child of sc.children) {
    if (child.classList.contains("filter-bar") || child.classList.contains("footer")) continue;
    nodes.push(child);
  }
  return nodes;
}

/** Push the current overscroll onto the scrollable content as a transform.
    The filter bar and footer are excluded so they stay anchored. */
function applyOverscroll() {
  if (overscroll === appliedOverscroll) return;
  const sc = activeLeaf();
  if (sc) {
    const t = overscroll ? `translateY(${overscroll}px)` : "";
    for (const node of overscrollNodes(sc)) node.style.transform = t;
  }
  appliedOverscroll = overscroll;
}

/** Clear any rubber-band offset immediately (e.g. on a view switch). */
function resetOverscroll() {
  cancelSpring();
  overscrollRaw = 0;
  springV = 0;
  overscroll = 0;
  applyOverscroll();
}

/**
 * Apply a signed pixel delta through the full feel pipeline: first unwind
 * any existing past-edge distance (in RAW space, so the return tracks the
 * finger 1:1 right at the edge and compresses with distance — the inverse
 * of the rubber-band curve), then scroll the axes, then accumulate whatever
 * is left past an edge as raw distance whose VISIBLE offset follows Apple's
 * asymptotic curve. Returns the leftover that hit an edge.
 */
function applyDelta(delta) {
  let d = delta;

  // 1. Unwind existing past-edge distance first (raw, no added resistance).
  if (overscrollRaw > 0 && d > 0) {
    const reduce = Math.min(overscrollRaw, d);
    overscrollRaw -= reduce;
    d -= reduce;
  } else if (overscrollRaw < 0 && d < 0) {
    const reduce = Math.min(-overscrollRaw, -d);
    overscrollRaw += reduce;
    d += reduce;
  }

  // 2. Normal scrolling with what remains.
  const leftover = d !== 0 ? distribute(d) : 0;

  // 3. Whatever is left past an edge accumulates as raw distance; the
  //    visible offset follows Apple's asymptotic resistance curve.
  if (leftover !== 0) overscrollRaw -= leftover;
  overscroll = rubberBand(overscrollRaw);

  applyOverscroll();
  return leftover;
}

function cancelGlide() {
  if (glideId) cancelAnimationFrame(glideId);
  glideId = 0;
}

/** Spring helper shares the rAF slot with momentum. */
function cancelSpring() {
  cancelGlide();
}

/**
 * Ease the rubber-band back to rest. An optional initial velocity (raw
 * px/frame) lets a fling carry briefly PAST the edge before returning,
 * giving the characteristic native bounce. The motion is overdamped — it
 * never crosses zero — so it settles smoothly without wobble.
 */
function springBack(initialV = 0) {
  cancelGlide();
  springV = initialV;
  const step = () => {
    overscrollRaw += springV;     // carry inbound momentum past the edge
    springV *= SPRING_VEL_DECAY;  // that momentum fades
    overscrollRaw *= SPRING_PULL; // while the edge always pulls back to rest
    if (Math.abs(overscrollRaw) < 0.3 && Math.abs(springV) < 0.3) {
      overscrollRaw = 0;
      springV = 0;
      overscroll = 0;
      applyOverscroll();
      glideId = 0;
      return;
    }
    overscroll = rubberBand(overscrollRaw);
    applyOverscroll();
    glideId = requestAnimationFrame(step);
  };
  glideId = requestAnimationFrame(step);
}

/** Continue touch fling momentum through the same delta pipeline. */
let velocity = 0;
function glideMomentum() {
  if (Math.abs(velocity) < 0.4) {
    velocity = 0;
    glideId = 0;
    if (overscrollRaw) springBack();
    return;
  }
  const v = velocity;
  const leftover = applyDelta(velocity);
  if (leftover !== 0) {
    // Inertia reached an edge: hand the remaining speed to the bounce.
    velocity = 0;
    springBack(-v);
    return;
  }
  velocity *= FLING_FRICTION;
  glideId = requestAnimationFrame(glideMomentum);
}

function onWheel(e) {
  if (e.ctrlKey || overlayActive(e.target)) return; // let pinch/ctrl-zoom through
  const filterBar = e.target.closest?.(".filter-bar");
  if (filterBar && filterBar.scrollWidth > filterBar.clientWidth) {
    // Keep wheel gestures over filter pills on the pill row itself.
    let x = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) x *= 16; // lines -> ~px
    else if (e.deltaMode === 2) x *= window.innerHeight; // pages -> px
    e.preventDefault();
    filterBar.scrollLeft += x;
    return;
  }
  const sc = activeLeaf();
  if (!sc) return;
  let d = e.deltaY;
  if (d === 0) return;
  if (e.deltaMode === 1) d *= 16; // lines -> ~px
  else if (e.deltaMode === 2) d *= window.innerHeight; // pages -> px

  syncHeader();
  const H = pinnedThreshold();
  // We only coordinate the two axes while the HEADER still needs to move:
  // hiding it on the way down, or revealing it once the content is back at
  // its top on the way up. Every other moment is a plain content scroll, so
  // we leave the event alone and let the browser scroll the inner panel
  // natively — the same momentum and overscroll the filter bar gets free.
  const headerPhase =
    (d > 0 && headerScroll < H) ||
    (d < 0 && sc.scrollTop <= 0 && headerScroll > 0);
  if (!headerPhase) return;

  e.preventDefault();
  cancelGlide();
  applyDelta(d);
  if (overscroll) {
    if (wheelEndTimer) clearTimeout(wheelEndTimer);
    wheelEndTimer = setTimeout(() => {
      wheelEndTimer = 0;
      if (overscroll) springBack();
    }, 80);
  }
}

let touchY = null;
let lastTouchT = 0;
let touchOnFilterBar = false;
function onTouchStart(e) {
  cancelGlide();
  velocity = 0;
  syncHeader();
  touchOnFilterBar =
    e.touches.length === 1 &&
    !!(e.target.closest && e.target.closest(".filter-bar"));
  touchY =
    e.touches.length !== 1 || overlayActive(e.target) || touchOnFilterBar
      ? null
      : e.touches[0].clientY;
  lastTouchT = performance.now();
}
function onTouchMove(e) {
  if (touchOnFilterBar) return;
  if (touchY == null || e.touches.length !== 1 || overlayActive(e.target)) return;
  const y = e.touches[0].clientY;
  const dy = touchY - y; // finger up -> positive (scroll down)
  touchY = y;
  const now = performance.now();
  const dt = Math.max(1, now - lastTouchT);
  lastTouchT = now;
  if (dy !== 0) {
    e.preventDefault();
    applyDelta(dy);
    velocity = 0.75 * velocity + 0.25 * (dy / dt) * 16;
  }
}
function onTouchEnd() {
  if (touchY != null) {
    if (performance.now() - lastTouchT > 80) velocity = 0;
    if (overscrollRaw !== 0) {
      // Released while past an edge: bounce back, carrying any speed.
      springBack(-velocity);
    } else if (Math.abs(velocity) > 0.6) {
      cancelGlide();
      glideId = requestAnimationFrame(glideMomentum);
    }
  }
  touchY = null;
  touchOnFilterBar = false;
}

/** Wire up bar measurement and the gesture coordinator. Call once. */
export function installScroll() {
  if ("ResizeObserver" in window) {
    barObserver = new ResizeObserver(() => updateStickyOffsets());
  }
  updateStickyOffsets();
  observeBars();
  attachFooter();
  window.addEventListener("resize", updateStickyOffsets);
  // Web fonts change bar heights once they load; re-measure then.
  document.fonts?.ready.then(updateStickyOffsets);

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
}
