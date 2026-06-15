// ---------------------------------------------------------
// Single native scroll axis + per-view scroll memory.
//
// The whole document is ONE native scroller. The title sits at the top as
// ordinary content: scrolling down slides it away, and it only reappears
// once you scroll back to the very top. The player / incarnation / tab /
// filter bars stay pinned via CSS `position: sticky`, stacking beneath one
// another. Because this is the browser's own (compositor-driven) scroll,
// it stays smooth on mobile — there is no per-frame, main-thread scrolling
// or gesture coordination to stutter.
//
// The only JS responsibilities left are:
//   • exposing each sticky bar's height as a CSS variable so the bars can
//     stack directly beneath one another,
//   • collapsing the title fully the moment you scroll down (and revealing
//     it again only at the very top) — a single GLOBAL state, so it carries
//     across every tab / incarnation / player view instead of resetting,
//     and
//   • remembering each view's scroll position so switching tab /
//     incarnation / player restores where you were (a fresh, never-visited
//     view starts at the top).
// ---------------------------------------------------------

/** Per-view document scroll offset (window.scrollY), keyed by leaf id. */
const viewOffsets = new Map();

/** Observer that re-measures the bars whenever their size changes. */
let barObserver = null;

/** Whether the title is currently collapsed. A single global flag (the
    title is one shared banner), so the collapsed state is identical across
    every tab / incarnation / player view. */
let collapsed = false;

/** Last observed document scrollY, used to derive scroll direction. */
let lastScrollY = 0;

/** While true, scroll events are ignored for collapse decisions (set
    during the programmatic scroll restore of a view switch, so switching
    views never flips the shared collapsed state). */
let restoring = false;

/** Timestamp until which collapse/expand is locked, so the reflow caused
    by collapsing a short view can't immediately bounce the state back. */
let collapseLockUntil = 0;

/**
 * Measure the stacked sticky bars and expose their heights as CSS
 * variables so each bar can stick directly beneath the previous one.
 */
function updateStickyOffsets() {
  const root = document.documentElement;
  const header = document.querySelector(".header");
  const playerBar = document.querySelector(".player-bar");
  const activePage = document.querySelector(".player-page.active");
  const incBar = activePage?.querySelector(".inc-bar");
  const tabBar = activePage?.querySelector(".inc-content.active .tab-bar");

  // Expose the expanded title height so CSS can animate the collapse from
  // exactly that height to 0. Only measure while expanded — collapsed it
  // reports 0, which would break the animation target.
  if (header && !root.classList.contains("title-collapsed")) {
    root.style.setProperty("--header-h", `${header.offsetHeight}px`);
  }
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

/** Watch the currently visible bars so the offsets stay correct. */
function observeBars() {
  if (!barObserver) return;
  barObserver.disconnect();
  [
    document.querySelector(".player-bar"),
    document.querySelector(".player-page.active .inc-bar"),
    document.querySelector(".player-page.active .inc-content.active .tab-bar"),
  ]
    .filter(Boolean)
    .forEach((bar) => barObserver.observe(bar));
}

/** Record the active view's scroll. Call before a view switch. */
export function saveActiveScroll() {
  const leaf = activeLeaf();
  if (leaf) viewOffsets.set(leaf.id, window.scrollY);
}

/** Toggle the shared collapsed state (and its CSS class) if it changed. */
function setCollapsed(next) {
  if (collapsed === next) return;
  collapsed = next;
  document.documentElement.classList.toggle("title-collapsed", next);
}

/**
 * Collapse the title fully the moment the user scrolls down, and reveal it
 * again only once they scroll back to the very top. The state is global,
 * so it carries across view switches instead of resetting per view.
 */
function onScroll() {
  if (restoring) return;
  const body = document.body.classList;
  if (body.contains("modal-open") || body.contains("d20-modal-open")) return;

  const y = window.scrollY;
  const dir = y - lastScrollY;
  lastScrollY = y;

  // After a collapse, the page shrinks; ignore the clamping scroll events
  // it can emit (which would otherwise read as "back at top" and expand).
  if (performance.now() < collapseLockUntil) return;

  if (!collapsed && dir > 0 && y > 0) {
    setCollapsed(true);
    collapseLockUntil = performance.now() + 360;
  } else if (collapsed && dir < 0 && y <= 0) {
    setCollapsed(false);
  }
}

/**
 * Reveal the title on an UPWARD gesture made while already pinned at the
 * very top. At y === 0 the browser fires no `scroll` events for an upward
 * wheel/swipe, so `onScroll` alone can never expand a view that was
 * restored already at its top with the shared collapsed state on (e.g. you
 * collapsed it on another tab, then came back here). We watch the raw
 * gesture so that attempt still works.
 */
function onUpwardIntent(deltaY) {
  if (restoring || !collapsed) return;
  if (performance.now() < collapseLockUntil) return;
  const body = document.body.classList;
  if (body.contains("modal-open") || body.contains("d20-modal-open")) return;
  // Only when scrolling up AND already at (or above) the top.
  if (deltaY < 0 && window.scrollY <= 0) setCollapsed(false);
}

function onWheelIntent(e) {
  onUpwardIntent(e.deltaY);
}

let touchStartY = null;
function onTouchStartIntent(e) {
  touchStartY = e.touches.length === 1 ? e.touches[0].clientY : null;
}
function onTouchMoveIntent(e) {
  if (touchStartY == null || e.touches.length !== 1) return;
  const y = e.touches[0].clientY;
  // Finger moving DOWN (y increasing) = scrolling up = reveal intent.
  onUpwardIntent(touchStartY - y);
  touchStartY = y;
}

/**
 * Restore scroll after a view switch (and after the view is built).
 *
 * Each view keeps its own place in the single document scroll. A
 * never-visited view starts at 0 — the top — which also shows its title.
 * Because the title and the content now share one axis, restoring a
 * remembered offset restores both the title state and the list position
 * together.
 */
export function restoreActiveScroll() {
  updateStickyOffsets();
  observeBars();

  const leaf = activeLeaf();
  if (!leaf) return;

  const target = viewOffsets.get(leaf.id) ?? 0;

  // The header sits in document flow, so a saved scroll offset is only
  // valid in the collapse state it was captured in. A view scrolled away
  // from the top was necessarily collapsed (scrolling down is what
  // collapses the title), so restore it collapsed; a view resting at the
  // very top follows the shared global state. Matching the state keeps the
  // saved position from displacing and lets the title transition smoothly
  // to the right state on the switch instead of snapping afterwards.
  const targetCollapsed = target > 0 ? true : collapsed;

  // Ignore the scroll events our own restore generates so a view switch
  // never flips the shared collapsed state.
  restoring = true;
  setCollapsed(targetCollapsed);

  // Apply now and reassert on the next two frames. Swapping the active
  // panel (toggling display:none) changes the document height, so the
  // browser may clamp or nudge the scroll while it relays out; the
  // follow-ups make this view's remembered offset the final word.
  const apply = () => window.scrollTo(0, target);
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(() => {
      apply();
      lastScrollY = target;
      requestAnimationFrame(() => {
        restoring = false;
      });
    });
  });
}

/** Wire up bar measurement. Call once. */
export function installScroll() {
  if ("ResizeObserver" in window) {
    barObserver = new ResizeObserver(() => updateStickyOffsets());
  }
  updateStickyOffsets();
  observeBars();
  lastScrollY = window.scrollY;
  window.addEventListener("scroll", onScroll, { passive: true });
  // Catch upward wheel/swipe intent while pinned at the top, where no
  // scroll events fire (see onUpwardIntent).
  window.addEventListener("wheel", onWheelIntent, { passive: true });
  window.addEventListener("touchstart", onTouchStartIntent, { passive: true });
  window.addEventListener("touchmove", onTouchMoveIntent, { passive: true });
  window.addEventListener("resize", updateStickyOffsets);
  // Web fonts change bar heights once they load; re-measure then.
  document.fonts?.ready.then(updateStickyOffsets);
}
