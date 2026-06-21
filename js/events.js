// ---------------------------------------------------------
// Global event handling: delegated clicks, swipe-to-switch-tab,
// and the player switcher.
// ---------------------------------------------------------

import { buildIncarnation } from "./components/incarnation.js";
import { getSearchData } from "./components/incarnation.js";
import { showCardModal, closeCardModal } from "./components/modal.js";
import { renderCard } from "./components/cards.js";
import { scoreCard } from "./core/search.js";
import { escapeHtml } from "./core/html.js";
import { getCard } from "./store.js";
import { saveActiveScroll, restoreActiveScroll } from "./scroll.js";
import { PORTRAITS, DISABLED_INCARNATIONS } from "./config.js";
import { applyAvatarImage, isImageCached } from "./core/images.js";

// -- Delegated click handlers -----------------------------
// Each returns `true` once it has handled the event, short-circuiting
// the chain in `handleClick`.

// -- Touch/click guard ------------------------------------
// Prevents double-fire on mobile and ignores long-press releases.

let _pointerDownTime = 0;
let _lastHandledClick = 0;
const LONG_PRESS_MS = 400;
const DEBOUNCE_MS = 80;

document.addEventListener("pointerdown", () => {
  _pointerDownTime = Date.now();
}, true);

/** Returns true if the click should be ignored (long-press or duplicate). */
function shouldIgnoreClick() {
  const now = Date.now();
  if (now - _lastHandledClick < DEBOUNCE_MS) return true;
  if (_pointerDownTime && now - _pointerDownTime > LONG_PRESS_MS) return true;
  _lastHandledClick = now;
  return false;
}

/** Update the player button avatar to reflect the active incarnation. */
export function updatePlayerBtnAvatar(playerId) {
  const page = document.getElementById(playerId);
  if (!page) return;
  const activeBtn = page.querySelector(".inc-btn.active, .inc-btn[aria-selected='true']");
  const charId = activeBtn?.dataset.inc;
  const avatarImg = document.querySelector(`.player-btn-avatar[data-player-avatar="${playerId}"]`);
  if (!avatarImg) return;
  if (charId && PORTRAITS[charId]) {
    const label = activeBtn.querySelector("span")?.textContent || charId;
    applyAvatarImage(avatarImg, PORTRAITS[charId], label);
  }
}

// -- Incarnation modal ------------------------------------

function closeIncModal() {
  const existing = document.querySelector(".inc-modal-backdrop");
  if (existing) existing.remove();
  document.querySelectorAll(".player-btn.caret-open").forEach((b) => b.classList.remove("caret-open"));
}

function showIncModal(playerId) {
  closeIncModal();

  const page = document.getElementById(playerId);
  if (!page) return;

  const activeInc = page.querySelector(".inc-btn.active")?.dataset.inc;
  const buttons = Array.from(page.querySelectorAll(".inc-btn"))
    .filter((btn) => btn.dataset.inc !== activeInc);

  if (!buttons.length) return;

  const backdrop = document.createElement("div");
  backdrop.className = "inc-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "inc-modal";

  buttons.forEach((btn) => {
    const clone = btn.cloneNode(true);
    clone.classList.remove("active");
    clone.setAttribute("aria-selected", "false");
    // The clone inherits the original's `is-loading` class. On mobile, the
    // `.inc-bar` is `display: none`, so the originals never load/cache and
    // keep `is-loading` forever. Re-evaluate against the cache so the fade
    // only plays for portraits that genuinely haven't loaded yet.
    const avatar = clone.querySelector(".inc-avatar");
    if (avatar instanceof HTMLImageElement) {
      avatar.classList.toggle("is-loading", !isImageCached(avatar.currentSrc || avatar.src));
    }
    modal.appendChild(clone);
  });

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Flip the caret to indicate open content
  const playerBtn = document.querySelector(`.player-btn[data-player="${playerId}"]`);
  if (playerBtn) playerBtn.classList.add("caret-open");

  backdrop.addEventListener("click", (e) => {
    const clickedBtn = e.target.closest(".inc-btn");
    if (clickedBtn) {
      const incId = clickedBtn.dataset.inc;
      // Activate the incarnation on the actual page
      const realBtn = page.querySelector(`.inc-btn[data-inc="${incId}"]`);
      if (realBtn) realBtn.click();
      updatePlayerBtnAvatar(playerId);
      closeIncModal();
      return;
    }
    if (e.target === backdrop) closeIncModal();
  });
}

/** True when the viewport is at the mobile breakpoint. */
function isMobile() {
  return window.matchMedia("(max-width: 600px)").matches;
}

function handleIncarnationClick(e) {
  const incBtn = e.target.closest(".inc-btn");
  if (!incBtn) return false;
  // Ignore clicks from the modal clone (handled in showIncModal)
  if (incBtn.closest(".inc-modal")) return false;
  if (incBtn.classList.contains("inc-disabled")) return true; // swallow click
  if (shouldIgnoreClick()) return true;

  saveActiveScroll();

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
  updatePlayerBtnAvatar(page.id);
  restoreActiveScroll();
  return true;
}

// -- Filter toggle ----------------------------------------

function toggleFilters(tabBtn) {
  const tabId = tabBtn.dataset.tab;
  const panel = document.getElementById(tabId);
  if (!panel) return;
  const filterBar = panel.querySelector(".filter-bar");
  if (!filterBar) return;

  const isOpen = filterBar.classList.toggle("filter-visible");
  tabBtn.classList.toggle("caret-open", isOpen);
}

function handleTabClick(e) {
  const tabBtn = e.target.closest(".tab-btn");
  if (!tabBtn) return false;
  if (shouldIgnoreClick()) return true;

  const isAlreadyActive = tabBtn.classList.contains("active");
  const isSearchTab = tabBtn.dataset.tab?.endsWith("-search");

  // If tapping the already-active non-search tab on mobile, toggle filters
  if (isAlreadyActive && !isSearchTab && isMobile()) {
    toggleFilters(tabBtn);
    return true;
  }

  saveActiveScroll();

  const bar = tabBtn.closest(".tab-bar");
  const parent = bar.parentElement;

  bar.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  parent.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

  tabBtn.classList.add("active");
  tabBtn.setAttribute("aria-selected", "true");

  const target = document.getElementById(tabBtn.dataset.tab);
  if (target) target.classList.add("active");
  restoreActiveScroll();
  focusSearchIfActive(tabBtn, true);
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
  const triAll = bar.dataset.triAll === "starting";

  const setTriAllState = (state) => {
    // state: "all" | "starting" | "shared"
    allPill.dataset.allState = state;
    const label = state === "all" ? "All" : state === "starting" ? "Starting" : "Shared";
    allPill.textContent = `${label} ↻`;
    // When tri-state is active, the "all" pill is the mode toggle, so keep it visually active.
    allPill.classList.add("active");
  };

  const cycleTriAllState = () => {
    const current = allPill.dataset.allState || "all";
    const next = current === "all" ? "starting" : current === "starting" ? "shared" : "all";
    setTriAllState(next);
  };

  if (clicked === "all") {
    if (triAll) {
      cycleTriAllState();
    } else {
      bar.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      allPill.classList.add("active");
    }
  } else {
    // In tri-state mode, clicking tag pills should layer on top of the current
    // starting/shared mode, not reset it.
    if (triAll) {
      pill.classList.toggle("active");
    } else {
      allPill.classList.remove("active");
      pill.classList.toggle("active");
      if (!bar.querySelector(".filter-pill.active")) {
        allPill.classList.add("active");
      }
    }
  }

  const activeFilters = [];
  bar.querySelectorAll(".filter-pill.active").forEach((p) => activeFilters.push(p.dataset.filter));

  // In tri-state inventory mode, the "all" pill is a mode toggle, not a tag
  // selector; exclude it from tag decisions.
  const activeTagFilters = triAll ? activeFilters.filter((f) => f !== "all") : activeFilters;
  const showAll = triAll ? activeTagFilters.length === 0 : activeFilters.includes("all");
  const unpreparedActive = activeTagFilters.includes("Unprepared");
  const anyLevelActive = triAll ? activeTagFilters.some((f) => f !== "Unprepared") : activeFilters.some((f) => f !== "all" && f !== "Unprepared");
  const triState = triAll ? (allPill.dataset.allState || "all") : "all";

  grid.querySelectorAll(".item-card").forEach((card) => {
    const levelActive = activeFilters.includes(card.dataset.cat);
    const isUnprepared = card.dataset.unprepared === "true";
    const starting = card.dataset.starting === "true";
    const startingOk = !triAll
      ? true
      : triState === "all"
        ? true
        : triState === "starting"
          ? starting
          : !starting;

    const showByTag = showAll
      ? true
      : isUnprepared
        ? unpreparedActive && (anyLevelActive ? levelActive : true)
        : levelActive;

    const show = showByTag && startingOk;
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
    const overrides = {};
    if (card.dataset.titleOverride) overrides.titleOverride = card.dataset.titleOverride;
    if (card.dataset.footerOverride) overrides.footerOverride = card.dataset.footerOverride;
    showCardModal(card.dataset.cardId, overrides);
    return true;
  }

  return false;
}

// -- Search handler ----------------------------------------

let searchTimer = null;

function performSearch(input) {
  const charId = input.dataset.charId;
  const query = input.value.trim();
  const data = getSearchData(charId);
  const resultsEl = document.getElementById(`${charId}-search-results`);

  if (!data || !resultsEl) return;

  if (!query) {
    resultsEl.innerHTML = '<div class="search-empty">Type to search cards\u2026</div>';
    return;
  }

  const scoreItem = (item) => {
    const card = getCard(item.id);
    if (!card) return null;
    const score = scoreCard(query, card);
    return score !== null ? { item, _score: score } : null;
  };

  const search = (items) =>
    items.map(scoreItem).filter(Boolean).sort((a, b) => b._score - a._score).map((r) => r.item);

  const invResults = search(data.inv);
  const featResults = search(data.feat);
  const spellResults = search(data.spells);

  if (!invResults.length && !featResults.length && !spellResults.length) {
    resultsEl.innerHTML = '<div class="search-empty">No matching cards found.</div>';
    return;
  }

  const renderSection = (title, items) => {
    if (!items.length) return "";
    const cards = items
      .map((it) =>
        renderCard(it.id, it.count, it.isStarting, it.titleOverride || null, it.footerOverride || null, false, data.unprepared),
      )
      .join("");
    return (
      `<div class="search-section">` +
        `<div class="search-section-title">${escapeHtml(title)}</div>` +
        `<div class="card-grid">${cards}</div>` +
      `</div>`
    );
  };

  resultsEl.innerHTML =
    renderSection("Inventory", invResults) +
    renderSection("Features", featResults) +
    renderSection("Spells", spellResults);
}

function handleSearchInput(e) {
  const input = e.target;
  if (!input.classList.contains("search-input")) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => performSearch(input), 200);
}

// -- Search autofocus ------------------------------------

/**
 * If tabBtn targets search, focus the search input field. If requireEmpty
 * is true, only focus if the search results are currently empty.
 */
function focusSearchIfActive(tabBtn, requireEmpty = false) {
  const tabId = tabBtn.dataset.tab;
  if (!tabId || !tabId.endsWith("-search")) return;
  const tab = document.getElementById(tabId);
  const input = tab?.querySelector(".search-input");

  if (!input) return;
  if (requireEmpty && !tab?.querySelector(".search-empty")) return;
  input.focus({ preventScroll: true });
}

// -- Keyboard hotkeys (desktop) ---------------------------

/** Non-search tab ids in order (per incarnation). */
function getNavigableTabs(bar) {
  return Array.from(bar.querySelectorAll(".tab-btn"))
    .filter((b) => !b.dataset.tab.endsWith("-search"));
}

function getActiveTabBar() {
  const page = document.querySelector(".player-page.active");
  if (!page) return null;
  const inc = page.querySelector(".inc-content.active");
  if (!inc) return null;
  return inc.querySelector(".tab-bar");
}

function activateTab(btn) {
  const bar = btn.closest(".tab-bar");
  const parent = bar.parentElement;

  saveActiveScroll();
  bar.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  parent.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");

  const target = document.getElementById(btn.dataset.tab);
  if (target) target.classList.add("active");
  restoreActiveScroll();
  focusSearchIfActive(btn, true);
}

/** Advance the given player's page to its next selectable incarnation. */
function cycleIncarnation(page) {
  const buttons = Array.from(page.querySelectorAll(".inc-btn"))
    .filter((b) => !b.classList.contains("inc-disabled"));
  if (buttons.length < 2) return;

  const activeIdx = buttons.findIndex((b) => b.classList.contains("active"));
  const next = buttons[(activeIdx + 1) % buttons.length];
  next.click();
}

/**
 * Jump to a specific player by 1-indexed position. If that player is already
 * active, advance to their next incarnation instead.
 */
function activatePlayerByIndex(index) {
  const btns = Array.from(document.querySelectorAll(".player-btn"));
  if (index < 1 || index > btns.length) return;

  const btn = btns[index - 1];
  if (btn.classList.contains("active")) {
    const page = document.getElementById(btn.dataset.player);
    if (page) cycleIncarnation(page);
  } else {
    activatePlayer(btn);
  }
}

/** Focus the search tab within the active tab bar. */
function activateSearchTab(bar, forceFocus = false) {
  const searchBtn = Array.from(bar.querySelectorAll(".tab-btn"))
    .find((b) => b.dataset.tab.endsWith("-search"));

  if (!searchBtn) return;

  activateTab(searchBtn);
  focusSearchIfActive(searchBtn, !forceFocus);
}

/** Navigate the active tab bar by offset (skips the search tab). */
function navigateTab(bar, offset) {
  const tabs = getNavigableTabs(bar);
  const active = bar.querySelector(".tab-btn.active");
  let idx = tabs.indexOf(active);
  // If active tab is search or not found, start from the appropriate end.
  if (idx === -1) idx = offset < 0 ? 0 : tabs.length - 1;
  const next = (idx + offset + tabs.length) % tabs.length;
  activateTab(tabs[next]);
}

/**
 * Declarative hotkey map. Keys are lowercased `event.key` values; each
 * handler receives a context object ({ bar }) and performs the navigation.
 */
const KEY_BINDINGS = {
  "/": ({ bar }) => activateSearchTab(bar, true), // focus search
  q: ({ bar }) => navigateTab(bar, -1),           // prev tab
  e: ({ bar }) => navigateTab(bar, 1),            // next tab
};

function handleKeyboard(e) {
  // Escape blurs the search input so hotkeys resume
  if (e.key === "Escape" && e.target.matches(".search-input")) {
    e.preventDefault();
    e.target.blur();
    return;
  }

  // Don't intercept browser/OS shortcuts (e.g. Ctrl+L, Cmd+L).
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Ignore other keys when typing in an input/textarea
  if (e.target.matches("input, textarea, select, [contenteditable]")) return;

  // Suspend navigation hotkeys while a modal is open.
  if (document.body.classList.contains("modal-open")) return;

  const bar = getActiveTabBar();
  if (!bar) return;

  // 1-9: jump to player by index
  if (e.key >= "1" && e.key <= "9") {
    e.preventDefault();
    activatePlayerByIndex(parseInt(e.key, 10));
    return;
  }

  const action = KEY_BINDINGS[e.key.toLowerCase()];
  if (action) {
    e.preventDefault();
    action({ bar });
  }
}

// -- Delegated click chain --------------------------------

function handleClick(e) {
  handleIncarnationClick(e) ||
    handleTabClick(e) ||
    handlePipClick(e) ||
    handleCardClick(e) ||
    handleFilterClick(e);
}

// -- Player switcher --------------------------------------

function centerIncBarScrollOrigin(page) {
  const bar = page?.querySelector(".inc-bar");
  if (!bar) return;
  const maxScroll = bar.scrollWidth - bar.clientWidth;
  bar.scrollLeft = maxScroll > 0 ? Math.round(maxScroll / 2) : 0;
}

export function centerActiveIncarnationBar() {
  centerIncBarScrollOrigin(document.querySelector(".player-page.active"));
}

/** Activate a player page and build its visible incarnation. */
function activatePlayer(btn) {
  saveActiveScroll();

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
  centerIncBarScrollOrigin(page);
  const activeInc = page.querySelector(".inc-content.active");
  if (activeInc) buildIncarnation(activeInc.id);
  restoreActiveScroll();
}

/**
 * Wire up every global event listener. Call once on boot.
 */
export function installEventHandlers() {
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleSearchInput);
  document.addEventListener("keydown", handleKeyboard);

  // Intercept direct clicks on the search input field. The native focus path
  // causes older/mobile browsers to scroll the document (pushing the bar
  // behind the tabs). By cancelling the native focus and driving it through
  // same preventScroll path the search tab button uses, the scroll never
  // happens.
  document.addEventListener("pointerdown", (e) => {
    const input = e.target.closest(".search-input");
    if (!input) return;
    if (document.activeElement === input) return; // already focused
    e.preventDefault();
    input.focus({ preventScroll: true });
  });
  document.querySelectorAll(".player-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (shouldIgnoreClick()) return;
      if (btn.classList.contains("active") && isMobile()) {
        // Toggle incarnation modal on active player button tap
        if (document.querySelector(".inc-modal-backdrop")) {
          closeIncModal();
        } else {
          showIncModal(btn.dataset.player);
        }
      } else if (!btn.classList.contains("active")) {
        closeIncModal();
        activatePlayer(btn);
      }
    });
  });

  // Close incarnation modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeIncModal();
    }
  });

  window.addEventListener("resize", centerActiveIncarnationBar);
}
