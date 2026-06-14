// ─────────────────────────────────────────────────────────
// Sticky-bar offsets + per-view scroll memory.
//
// The whole page scrolls naturally (the document is the scroll
// container) and the footer flows at the end of the content. The title
// sits at the very top and simply scrolls away; the bars below it
// (player / incarnation / tab / filter) are `position: sticky` and stack
// directly beneath one another. Their measured heights are exposed as
// CSS variables so each bar sticks exactly below the previous one with
// no gap (a stale measurement leaves a gap that content shows through).
//
// All bars become fully pinned at the same scroll offset H — the title's
// height. We therefore model the scroll as two independent parts:
//
//   scrollY = headerOffset + contentOffset
//   headerOffset  = min(scrollY, H)   // how far the title has scrolled
//   contentOffset = max(scrollY - H, 0)
//
// On a view switch the header offset is carried over unchanged (so the
// header stays exactly where it is), while the content offset is the one
// remembered per view (0 for a never-visited view). One view's content
// scroll therefore never affects another's, and the header never jumps.
// ─────────────────────────────────────────────────────────

/** Per-view content scroll offset (scrollY past H), keyed by panel id. */
const contentOffsets = new Map();

/** Header offset captured at the last view switch (carried across switches). */
let lastHeaderOffset = 0;

/** Observer that re-measures the bars whenever their size changes. */
let barObserver = null;

/**
 * Measure the stacked sticky bars and expose their heights as CSS
 * variables so each bar can stick directly beneath the previous one.
 */
export function updateStickyOffsets() {
  const root = document.documentElement;
  const playerBar = document.querySelector(".player-bar");
  const activePage = document.querySelector(".player-page.active");
  const incBar = activePage?.querySelector(".inc-bar");
  const tabBar = activePage?.querySelector(".inc-content.active .tab-bar");

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
 * Scroll offset at which the title is fully scrolled away and every bar
 * is pinned. Equals the height of the non-sticky header above the bars.
 *
 * We measure the header (not the player bar) on purpose: the player bar
 * is `position: sticky`, and once it is pinned its `offsetTop` reports
 * its current document position (≈ scrollY) rather than its stable
 * in-flow position. That made the threshold track the scroll and
 * collapsed the per-view offset model. The header scrolls normally, so
 * its `offsetHeight` is a constant, scroll-independent reference.
 */
function pinnedThreshold() {
  const header = document.querySelector(".header");
  return header ? header.offsetHeight : 0;
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
  const h = pinnedThreshold();
  const y = window.scrollY;
  lastHeaderOffset = Math.min(y, h);

  const leaf = activeLeaf();
  if (leaf) contentOffsets.set(leaf.id, Math.max(y - h, 0));
}

/**
 * Restore scroll after a view switch (and after the view is built).
 *
 * There is a single document scroll axis, so the header and the content
 * cannot be positioned independently: showing a view's content scrolled
 * down by C requires scrollY = H + C, which means the header is fully
 * pinned (scrolled away). "Title partly visible" and "cards scrolled
 * down" therefore cannot both be true at once.
 *
 * We resolve that conflict in favour of the per-view content memory,
 * since "where was I in this list" is the position that matters most:
 *   • If this view had been scrolled into its content, re-pin the header
 *     and restore that content offset (the header re-anchors to the top).
 *   • Otherwise the view sat at its content top, so we preserve the
 *     carried header position — which may be partially visible — and a
 *     never-visited view simply starts at the top.
 */
export function restoreActiveScroll() {
  updateStickyOffsets();
  observeBars();

  const leaf = activeLeaf();
  if (!leaf) return;

  const h = pinnedThreshold();
  const content = contentOffsets.get(leaf.id) ?? 0;
  const target = content > 0 ? h + content : Math.min(lastHeaderOffset, h);

  // Apply now and reassert on the next two frames. Swapping the active
  // panel triggers a layout in which the browser's scroll clamping and
  // anchoring can nudge the position back toward the outgoing view —
  // most visibly when moving to a never-visited tab, whose target sits
  // far above the old scroll. The synchronous write avoids a flash of the
  // wrong frame; the follow-up writes run after those layouts settle, so
  // this view's remembered offset is always the final word.
  window.scrollTo(0, target);
  requestAnimationFrame(() => {
    window.scrollTo(0, target);
    requestAnimationFrame(() => window.scrollTo(0, target));
  });
}

/** Wire up bar measurement. Call once on boot, after a page is active. */
export function installScroll() {
  if ("ResizeObserver" in window) {
    barObserver = new ResizeObserver(() => updateStickyOffsets());
  }
  updateStickyOffsets();
  observeBars();
  window.addEventListener("resize", updateStickyOffsets);
  // Web fonts change bar heights once they load; re-measure then.
  document.fonts?.ready.then(updateStickyOffsets);
}
