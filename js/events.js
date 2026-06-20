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

// -- Delegated click handlers -----------------------------
// Each returns `true` once it has handled the event, short-circuiting
// the chain in `handleClick`.

function handleIncarnationClick(e) {
  const incBtn = e.target.closest(".inc-btn");
  if (!incBtn) return false;
  if (incBtn.classList.contains("inc-disabled")) return true; // swallow click

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
  restoreActiveScroll();
  return true;
}

function handleTabClick(e) {
  const tabBtn = e.target.closest(".tab-btn");
  if (!tabBtn) return false;

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
  focusSearchIfActiveAndEmpty(tabBtn);
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
 * If tabBtn targets search, focus the search input field if there are
 * currently no search results to show.
 */
function focusSearchIfActiveAndEmpty(tabBtn) {
  const tabId = tabBtn.dataset.tab;
  if (!tabId || !tabId.endsWith("-search")) return;
  const tab = document.getElementById(tabId);
  const input = tab?.querySelector(".search-input");
  const isEmpty = tab?.querySelector(".search-empty");
  if (input && isEmpty) input.focus();
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
  focusSearchIfActiveAndEmpty(btn);
}

function handleKeyboard(e) {
  // Escape blurs the search input so hotkeys resume
  if (e.key === "Escape" && e.target.matches(".search-input")) {
    e.target.blur();
    return;
  }

  // Do not intercept browser/OS shortcuts (e.g. Ctrl+L, Cmd+L)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Ignore other keys when typing in an input/textarea
  if (e.target.matches("input, textarea, select, [contenteditable]")) return;

  // Suspend navigation hotkeys while a modal is open
  if (document.body.classList.contains("modal-open")) return;

  const bar = getActiveTabBar();
  if (!bar) return;

  if (e.key === "/") {
    e.preventDefault();
    const searchBtn = Array.from(bar.querySelectorAll(".tab-btn"))
      .find((b) => b.dataset.tab.endsWith("-search"));
    if (searchBtn) activateTab(searchBtn);
    return;
  }

  if (e.key === "j" || e.key === "ArrowLeft") {
    e.preventDefault();
    const tabs = getNavigableTabs(bar);
    const active = bar.querySelector(".tab-btn.active");
    let idx = tabs.indexOf(active);
    // If active tab is search or not found, go to last navigable tab
    if (idx === -1) idx = 0;
    const next = (idx - 1 + tabs.length) % tabs.length;
    activateTab(tabs[next]);
    return;
  }

  if (e.key === "l" || e.key === "ArrowRight") {
    e.preventDefault();
    const tabs = getNavigableTabs(bar);
    const active = bar.querySelector(".tab-btn.active");
    let idx = tabs.indexOf(active);
    if (idx === -1) idx = tabs.length - 1;
    const next = (idx + 1) % tabs.length;
    activateTab(tabs[next]);
    return;
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

  document.querySelectorAll(".player-btn").forEach((btn) => {
    btn.addEventListener("click", () => activatePlayer(btn));
  });

  window.addEventListener("resize", centerActiveIncarnationBar);
}
