// ---------------------------------------------------------
// Global event wiring: delegated clicks, keyboard hotkeys, the
// search input, and the player switcher bootstrap. The actual view
// logic lives in the navigation/filters/search-results modules; this
// file just routes DOM events to them.
// ---------------------------------------------------------

import { buildIncarnation } from "./components/incarnation.js";
import { showCardModal, closeCardModal } from "./components/modal.js";
import { shouldIgnoreClick, isMobile, installInteractionGuards } from "./core/interaction.js";
import { saveActiveScroll, restoreActiveScroll } from "./scroll.js";
import { toggleFilters, handleFilterClick } from "./components/filters.js";
import { performSearch } from "./components/search-results.js";
import {
  updatePlayerBtnAvatar,
  centerActiveIncarnationBar,
  activatePlayer,
  showIncModal,
  closeIncModal,
  focusSearchIfActive,
  getActiveTabBar,
  activatePlayerByIndex,
  activateSearchTab,
  navigateTab,
} from "./components/navigation.js";

// Re-exported for main.js's boot sequence.
export { updatePlayerBtnAvatar, centerActiveIncarnationBar };

// -- Delegated click handlers -----------------------------
// Each returns `true` once it has handled the event, short-circuiting
// the chain in `handleClick`.

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

  // If clicking on an already-active search tab, force focus on the input
  if (isAlreadyActive && isSearchTab) {
    focusSearchIfActive(tabBtn, false);
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

// -- Delegated click chain --------------------------------

function handleClick(e) {
  handleIncarnationClick(e) ||
    handleTabClick(e) ||
    handlePipClick(e) ||
    handleCardClick(e) ||
    handleFilterClick(e);
}

// -- Search input -----------------------------------------

let searchTimer = null;

function handleSearchInput(e) {
  const input = e.target;
  if (!input.classList.contains("search-input")) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => performSearch(input), 200);
}

// -- Keyboard hotkeys (desktop) ---------------------------

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

// -- Boot -------------------------------------------------

/**
 * Wire up every global event listener. Call once on boot.
 */
export function installEventHandlers() {
  installInteractionGuards();

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
