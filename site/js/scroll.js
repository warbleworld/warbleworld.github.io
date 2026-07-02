// ---------------------------------------------------------
// Inner tab-content scroll model + per-view scroll memory.
//
// Document scroll stays parked at the top; only the active `.tab-content`
// scroller moves. The filter bar stays pinned inside that scroller, and the
// footer is attached to it so the footer is reached by scrolling the same
// content area.
// ---------------------------------------------------------

/** Per-view content scroll offset (tab-content.scrollTop), keyed by id. */
const viewOffsets = new Map();

/** Observer that re-measures the bars whenever their size changes. */
let barObserver = null;

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

  if (header) root.style.setProperty("--header-h", `${header.offsetHeight}px`);
  if (playerBar) root.style.setProperty("--player-bar-h", `${playerBar.offsetHeight}px`);
  // inc-bar is hidden on mobile; offsetHeight will be 0 in that case.
  root.style.setProperty("--inc-bar-h", incBar ? `${incBar.offsetHeight}px` : "0px");
  if (tabBar) root.style.setProperty("--tab-bar-h", `${tabBar.offsetHeight}px`);
}

/** The currently visible leaf view (active tab panel), or null. */
function activeLeaf() {
  return document.querySelector(
    ".player-page.active .inc-content.active .tab-content.active",
  );
}

/** The scroll region inside the active panel (the only element that
    actually scrolls). The filter bar lives OUTSIDE this so the scroller's
    elastic overscroll can never drag it. */
function activeScroller() {
  return activeLeaf()?.querySelector(":scope > .tab-scroll") ?? null;
}

/** Hoist the active panel's filter bar or search bar OUT of the scroller so
    it sits as a static sibling above the scroll region, immune to rubber-band
    bounce. */
function detachFilterBar() {
  const leaf = activeLeaf();
  const scroller = activeScroller();
  if (!leaf || !scroller) return;

  for (const sel of [".filter-bar", ".search-bar"]) {
    const bar = scroller.querySelector(`:scope > ${sel}`);
    if (bar) leaf.insertBefore(bar, scroller);
  }
}

/** Keep the single footer inside the active scroll region. */
function attachFooter() {
  const footer = document.querySelector(".footer");
  const scroller = activeScroller();
  if (footer && scroller && footer.parentElement !== scroller) {
    scroller.appendChild(footer);
  }
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
  const leaf = activeLeaf();
  const scroller = activeScroller();
  if (leaf && scroller) viewOffsets.set(leaf.id, scroller.scrollTop);
}

/**
 * Restore scroll after a view switch (and after the view is built).
 *
 * Each view keeps its own place in its inner content scroller. The
 * document itself is parked at the top so only tab content scrolls.
 */
export function restoreActiveScroll() {
  updateStickyOffsets();
  observeBars();
  detachFilterBar();
  attachFooter();

  const leaf = activeLeaf();
  const scroller = activeScroller();
  if (!leaf || !scroller) return;

  const target = viewOffsets.get(leaf.id) ?? 0;

  // Keep document fixed; all visible scrolling happens in the inner scroller.
  const apply = () => {
    window.scrollTo(0, 0);
    scroller.scrollTop = target;
  };
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

/** Wire up bar measurement. Call once. */
export function installScroll() {
  if ("ResizeObserver" in window) {
    barObserver = new ResizeObserver(() => updateStickyOffsets());
  }
  updateStickyOffsets();
  observeBars();
  detachFilterBar();
  attachFooter();
  window.scrollTo(0, 0);
  window.addEventListener("resize", updateStickyOffsets);
  // Web fonts change bar heights once they load; re-measure then.
  document.fonts?.ready.then(updateStickyOffsets);
}
