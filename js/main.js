// ---------------------------------------------------------
// Application entry point.
// Loads card data, prepares the static markup, and boots the UI.
// ---------------------------------------------------------

import { PORTRAITS, DEFAULT_INCARNATIONS, DISABLED_INCARNATIONS } from "./config.js";
import { loadCards } from "./store.js";
import { applyAvatarImage, installImageFallback } from "./core/images.js";
import { buildIncarnation } from "./components/incarnation.js";
import { installEventHandlers, centerActiveIncarnationBar, updatePlayerBtnAvatar } from "./events.js";
import { installD20Egg } from "./components/d20.js";
import { installScroll } from "./scroll.js";

/** Fill the incarnation avatar thumbnails from the portrait config. */
function populateAvatars() {
  document.querySelectorAll(".inc-avatar[data-char]").forEach((img) => {
    const key = img.dataset.char;
    if (!PORTRAITS[key]) return;
    img.width = 28;
    img.height = 28;
    applyAvatarImage(img, PORTRAITS[key]);
  });
}

/** Disable the buttons of unavailable incarnations. */
function markDisabledIncarnations() {
  DISABLED_INCARNATIONS.forEach((id) => {
    document.querySelector(`.inc-btn[data-inc="${id}"]`)?.classList.add("inc-disabled");
  });
}

/**
 * Apply the configured default incarnation for each player page.
 * Runs before the disabled check so disabled defaults are handled gracefully.
 */
function applyDefaultIncarnations() {
  document.querySelectorAll(".player-page").forEach((page) => {
    const defaultId = DEFAULT_INCARNATIONS[page.id];
    if (!defaultId) return;

    const targetBtn = page.querySelector(`.inc-btn[data-inc="${defaultId}"]`);
    if (!targetBtn) return;

    // Normalize the entire tablist first so ARIA mirrors visual state.
    page.querySelectorAll(".inc-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    });
    page.querySelectorAll(".inc-content").forEach((content) => {
      content.classList.remove("active");
    });

    // Activate the desired default
    targetBtn.classList.add("active");
    targetBtn.setAttribute("aria-selected", "true");
    document.getElementById(defaultId)?.classList.add("active");
  });
}

/**
 * Ensure each player page opens on an available incarnation. If the
 * default active one is disabled, switch to the first available.
 */
function ensureAvailableDefaults() {
  document.querySelectorAll(".player-page").forEach((page) => {
    const activeInc = page.querySelector(".inc-content.active");
    if (!activeInc || !DISABLED_INCARNATIONS.includes(activeInc.id)) return;

    activeInc.classList.remove("active");
    const activeBtn = page.querySelector(".inc-btn.active");
    if (activeBtn) {
      activeBtn.classList.remove("active");
      activeBtn.setAttribute("aria-selected", "false");
    }

    const availableBtn = page.querySelector(".inc-btn:not(.inc-disabled)");
    if (!availableBtn) return;
    availableBtn.classList.add("active");
    availableBtn.setAttribute("aria-selected", "true");
    document.getElementById(availableBtn.dataset.inc)?.classList.add("active");
  });
}

/** Reveal a random (or query-specified) player page on load and build its incarnation. */
function selectRandomPlayer() {
  const buttons = Array.from(document.querySelectorAll(".player-btn"));
  // Collect the set of valid player IDs from the DOM so no arbitrary value is accepted.
  const validPlayerIds = new Set(buttons.map((btn) => btn.dataset.player));
  const urlParam = new URLSearchParams(window.location.search).get("player");
  const requestedPlayerId = validPlayerIds.has(urlParam) ? urlParam : null;
  const btn = requestedPlayerId
    ? buttons.find((b) => b.dataset.player === requestedPlayerId)
    : buttons[Math.floor(Math.random() * buttons.length)];
  if (!btn) return;

  buttons.forEach((playerBtn) => {
    playerBtn.classList.remove("active");
    playerBtn.setAttribute("aria-selected", "false");
  });
  document.querySelectorAll(".player-page").forEach((playerPage) => {
    playerPage.classList.remove("active");
  });

  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");
  const page = document.getElementById(btn.dataset.player);
  if (!page) return;
  page.classList.add("active");
  const activeInc = page.querySelector(".inc-content.active");
  if (activeInc) buildIncarnation(activeInc.id);
}

/** Populate the player-button avatars to show the active incarnation's portrait. */
function populatePlayerBtnAvatars() {
  ["p1", "p2", "p3"].forEach((pid) => updatePlayerBtnAvatar(pid));
}

/** Mark non-search tab buttons with data-has-filters so the CSS caret appears. */
function markTabsWithFilters() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.dataset.tab?.endsWith("-search")) return;
    // Check if the corresponding panel has a filter bar
    const panel = document.getElementById(btn.dataset.tab);
    if (panel?.querySelector(".filter-bar")) {
      btn.setAttribute("data-has-filters", "");
    }
  });
}

/** Prepare static markup and wire up the UI (runs after cards load). */
function initApp() {
  populateAvatars();
  markDisabledIncarnations();
  applyDefaultIncarnations();
  ensureAvailableDefaults();
  installEventHandlers();
  installD20Egg();
  selectRandomPlayer();
  populatePlayerBtnAvatars();
  markTabsWithFilters();
  centerActiveIncarnationBar();
  installScroll();
}

// Boot: graceful image fallback first, then load cards and init.
installImageFallback();
loadCards().then(initApp);
