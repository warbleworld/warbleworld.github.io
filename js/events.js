// ─────────────────────────────────────────────────────────
// Global event handling: delegated clicks, swipe-to-switch-tab,
// and the player switcher.
// ─────────────────────────────────────────────────────────

import { buildIncarnation } from "./components/incarnation.js";
import { showCardModal, closeCardModal } from "./components/modal.js";

// ── Delegated click handlers ────────────────────────────
// Each returns `true` once it has handled the event, short-circuiting
// the chain in `handleClick`.

function handleIncarnationClick(e) {
  const incBtn = e.target.closest(".inc-btn");
  if (!incBtn) return false;
  if (incBtn.classList.contains("inc-disabled")) return true; // swallow click

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
  return true;
}

function handleTabClick(e) {
  const tabBtn = e.target.closest(".tab-btn");
  if (!tabBtn) return false;

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
