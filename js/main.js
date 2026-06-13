// ─────────────────────────────────────────────────────────
// Application entry point.
// Loads card data, prepares the static markup, and boots the UI.
// ─────────────────────────────────────────────────────────

import { PORTRAITS, DISABLED_INCARNATIONS } from "./config.js";
import { loadCards } from "./store.js";
import { resolveImageUrl, installImageFallback } from "./core/images.js";
import { buildIncarnation } from "./components/incarnation.js";
import { installEventHandlers } from "./events.js";

/** Fill the incarnation avatar thumbnails from the portrait config. */
function populateAvatars() {
  document.querySelectorAll(".inc-avatar[data-char]").forEach((img) => {
    const key = img.dataset.char;
    if (!PORTRAITS[key]) return;
    img.src = resolveImageUrl(PORTRAITS[key]);
    img.loading = "lazy";
    img.decoding = "async";
    img.dataset.fallback = (img.alt || key).charAt(0);
  });
}

/** Disable the buttons of unavailable incarnations. */
function markDisabledIncarnations() {
  DISABLED_INCARNATIONS.forEach((id) => {
    document.querySelector(`.inc-btn[data-inc="${id}"]`)?.classList.add("inc-disabled");
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

/** Reveal a random player page on load and build its incarnation. */
function selectRandomPlayer() {
  const buttons = Array.from(document.querySelectorAll(".player-btn"));
  const btn = buttons[Math.floor(Math.random() * buttons.length)];
  if (!btn) return;

  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");
  const page = document.getElementById(btn.dataset.player);
  if (!page) return;
  page.classList.add("active");
  const activeInc = page.querySelector(".inc-content.active");
  if (activeInc) buildIncarnation(activeInc.id);
}

/** Prepare static markup and wire up the UI (runs after cards load). */
function initApp() {
  populateAvatars();
  markDisabledIncarnations();
  ensureAvailableDefaults();
  installEventHandlers();
  selectRandomPlayer();
}

// Boot: graceful image fallback first, then load cards and init.
installImageFallback();
loadCards().then(initApp);
