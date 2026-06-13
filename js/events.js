// ─────────────────────────────────────────────────────────
// Global event handling: delegated clicks, swipe-to-switch-tab,
// and the player switcher.
// ─────────────────────────────────────────────────────────

import { buildIncarnation } from "./components/incarnation.js";
import { showCardModal, closeCardModal } from "./components/modal.js";

const viewScrollPositions = new Map();

function getDocumentScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function getStickyBottomInViewport() {
  const playerBar = document.querySelector(".player-bar");
  const activePage = document.querySelector(".player-page.active");
  const incBar = activePage?.querySelector(".inc-bar");
  const activeInc = activePage?.querySelector(".inc-content.active");
  const tabBar = activeInc?.querySelector(".tab-bar");
  const activeTab = activeInc?.querySelector(".tab-content.active");
  const filterBar = activeTab?.querySelector(".filter-bar");

  const stickyEls = [playerBar, incBar, tabBar, filterBar].filter(Boolean);
  if (!stickyEls.length) return 0;
  return Math.max(...stickyEls.map((el) => el.getBoundingClientRect().bottom));
}

function getActiveViewId() {
  const activePage = document.querySelector(".player-page.active");
  const activeInc = activePage?.querySelector(".inc-content.active");
  const activeTab = activeInc?.querySelector(".tab-content.active");
  return activeTab?.id || activeInc?.id || activePage?.id || null;
}

function getViewById(viewId) {
  if (!viewId) return null;
  return document.getElementById(viewId);
}

function getContentAnchorDocTop(viewEl) {
  if (!viewEl) return getDocumentScrollTop();

  // Card tabs should restore relative to the grid content under filters.
  const cardGrid = viewEl.querySelector(".card-grid");
  const anchor = cardGrid || viewEl.firstElementChild || viewEl;
  return anchor.getBoundingClientRect().top + getDocumentScrollTop();
}

/**
 * Capture scroll state of the current view before a switch.
 * Returns { scrollTop, stickyHeight, contentScroll } where
 * contentScroll is how far into the view's content (below sticky bars)
 * the user has scrolled.
 */
function captureScroll() {
  const viewId = getActiveViewId();
  const viewEl = getViewById(viewId);
  const scrollTop = getDocumentScrollTop();
  const stickyBottom = getStickyBottomInViewport();
  const contentAnchorTop = getContentAnchorDocTop(viewEl);
  const contentScroll = Math.max(0, scrollTop + stickyBottom - contentAnchorTop);
  return { scrollTop, contentScroll };
}

/**
 * Save the current view's content scroll position to the map.
 * Returns a snapshot for use in restoreViewScroll.
 */
function saveActiveViewScroll() {
  const viewId = getActiveViewId();
  const snapshot = captureScroll();
  if (viewId) viewScrollPositions.set(viewId, snapshot.contentScroll);
  return snapshot;
}

/**
 * Restore scroll for the newly-active view.
 * srcSnapshot = captureScroll() result taken BEFORE the DOM switch.
 * For a visited view, restores its saved content position while keeping
 * the outer scroll (header visibility) consistent with srcSnapshot.
 * For a never-visited view:
 * - if source content is at top, inherit raw scrollTop (preserve header/title framing)
 * - if source content is scrolled, open destination content at top.
 */
function restoreViewScroll(viewId, srcSnapshot) {
  requestAnimationFrame(() => {
    const destViewEl = getViewById(viewId);
    const destStickyBottom = getStickyBottomInViewport();
    const destContentAnchorTop = getContentAnchorDocTop(destViewEl);
    const destContentScroll = (viewId && viewScrollPositions.has(viewId))
      ? viewScrollPositions.get(viewId)
      : 0;

    let top = destContentAnchorTop - destStickyBottom + destContentScroll;
    top = Math.max(0, top);
    window.scrollTo({ top, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = top;
    document.body.scrollTop = top;
  });
}

// ── Delegated click handlers ────────────────────────────
// Each returns `true` once it has handled the event, short-circuiting
// the chain in `handleClick`.

function handleIncarnationClick(e) {
  const incBtn = e.target.closest(".inc-btn");
  if (!incBtn) return false;
  if (incBtn.classList.contains("inc-disabled")) return true; // swallow click

  const srcSnapshot = saveActiveViewScroll();

  const page = incBtn.closest(".player-page");
  page.querySelectorAll(".inc-btn").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  page.querySelectorAll(".inc-content").forEach((c) => c.classList.remove("active"));

  incBtn.classList.add("active");
  incBtn.setAttribute("aria-selected", "true");

  const target = document.getElementById(incBtn.dataset.inc);
  if (target) {
    target.classList.add("active");
    buildIncarnation(incBtn.dataset.inc);
  }
  restoreViewScroll(getActiveViewId(), srcSnapshot);
  return true;
}

function handleTabClick(e) {
  const tabBtn = e.target.closest(".tab-btn");
  if (!tabBtn) return false;

  activateTab(tabBtn);
  return true;
}

function activateTab(tabBtn) {
  if (!tabBtn) return false;

  const srcSnapshot = saveActiveViewScroll();

  const bar = tabBtn.closest(".tab-bar");
  if (!bar) return true;
  const parent = bar.parentElement;
  if (!parent) return true;

  bar.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  parent.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

  tabBtn.classList.add("active");
  tabBtn.setAttribute("aria-selected", "true");

  const target = document.getElementById(tabBtn.dataset.tab);
  if (target) target.classList.add("active");
  restoreViewScroll(target?.id || getActiveViewId(), srcSnapshot);
  return true;
}

function handlePipClick(e) {
  const pip = e.target.closest(".cs-pip");
  if (!pip) return false;

  const isFilled = pip.classList.toggle("filled");
  pip.setAttribute("aria-checked", isFilled);
  return true;
}

function handleFilterClick(e) {
  const pill = e.target.closest(".filter-pill");
  if (!pill) return false;

  const bar = pill.closest(".filter-bar");
  const grid = document.getElementById(bar.dataset.grid);
  if (!grid) return true;

  const allPill = bar.querySelector('[data-filter="all"]');
  const clicked = pill.dataset.filter;

  if (clicked === "all") {
    bar.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
    allPill.classList.add("active");
  } else {
    allPill.classList.remove("active");
    pill.classList.toggle("active");
    if (!bar.querySelector(".filter-pill.active")) {
      allPill.classList.add("active");
    }
  }

  const activeFilters = [];
  bar.querySelectorAll(".filter-pill.active").forEach((p) => activeFilters.push(p.dataset.filter));
  const showAll = activeFilters.includes("all");
  const unpreparedActive = activeFilters.includes("Unprepared");
  const anyLevelActive = activeFilters.some((f) => f !== "all" && f !== "Unprepared");

  grid.querySelectorAll(".item-card").forEach((card) => {
    const levelActive = activeFilters.includes(card.dataset.cat);
    const isUnprepared = card.dataset.unprepared === "true";
    const show = showAll
      ? true
      : isUnprepared
        ? unpreparedActive && (anyLevelActive ? levelActive : true)
        : levelActive;
    card.classList.toggle("filter-hidden", !show);
  });
  return true;
}

function handleCardClick(e) {
  const closeBtn = e.target.closest(".card-modal-close");
  if (closeBtn) {
    closeCardModal();
    return true;
  }

  const card = e.target.closest(".item-card[data-card-id]");
  if (card) {
    showCardModal(card.dataset.cardId);
    return true;
  }

  return false;
}

function handleClick(e) {
  handleIncarnationClick(e) ||
    handleTabClick(e) ||
    handlePipClick(e) ||
    handleCardClick(e) ||
    handleFilterClick(e);
}

// ── Player switcher ─────────────────────────────────────

/** Activate a player page and build its visible incarnation. */
function activatePlayer(btn) {
  const srcSnapshot = saveActiveViewScroll();

  document.querySelectorAll(".player-btn").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  document.querySelectorAll(".player-page").forEach((p) => p.classList.remove("active"));

  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");

  const page = document.getElementById(btn.dataset.player);
  if (!page) return;
  page.classList.add("active");
  const activeInc = page.querySelector(".inc-content.active");
  if (activeInc) buildIncarnation(activeInc.id);
  restoreViewScroll(getActiveViewId(), srcSnapshot);
}

/**
 * Wire up every global event listener. Call once on boot.
 */
export function installEventHandlers() {
  document.addEventListener("click", handleClick);

  document.querySelectorAll(".player-btn").forEach((btn) => {
    btn.addEventListener("click", () => activatePlayer(btn));
  });
}
