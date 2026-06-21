// ---------------------------------------------------------
// View navigation: switching the active player, incarnation, and tab,
// plus the mobile incarnation picker modal and search-tab focusing.
// ---------------------------------------------------------

import { buildIncarnation } from "./incarnation.js";
import { saveActiveScroll, restoreActiveScroll } from "../scroll.js";
import { applyAvatarImage, isImageCached } from "../core/images.js";
import { isMobile } from "../core/interaction.js";
import { PORTRAITS, AVATAR_SIZES } from "../config.js";

// -- Player button avatar ---------------------------------

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
    applyAvatarImage(avatarImg, PORTRAITS[charId], label, AVATAR_SIZES);
  }
}

// -- Incarnation modal ------------------------------------

export function closeIncModal() {
  const existing = document.querySelector(".inc-modal-backdrop");
  if (existing) existing.remove();
  document.querySelectorAll(".player-btn.caret-open").forEach((b) => b.classList.remove("caret-open"));
}

export function showIncModal(playerId) {
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

// -- Incarnation bar centering ----------------------------

function centerIncBarScrollOrigin(page) {
  const bar = page?.querySelector(".inc-bar");
  if (!bar) return;
  const maxScroll = bar.scrollWidth - bar.clientWidth;
  bar.scrollLeft = maxScroll > 0 ? Math.round(maxScroll / 2) : 0;
}

export function centerActiveIncarnationBar() {
  centerIncBarScrollOrigin(document.querySelector(".player-page.active"));
}

// -- Player switching -------------------------------------

/** Activate a player page and build its visible incarnation. */
export function activatePlayer(btn) {
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
export function activatePlayerByIndex(index) {
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

// -- Tab switching ----------------------------------------

/**
 * If tabBtn targets search, focus the search input field.
 * If requireEmptyToFocus is true, only focus if the search results are
 * currently empty.
 */
export function focusSearchIfActive(tabBtn, requireEmptyToFocus = false) {
  const tabId = tabBtn.dataset.tab;
  if (!tabId || !tabId.endsWith("-search")) return;
  const tab = document.getElementById(tabId);
  const input = tab?.querySelector(".search-input");

  if (!input) return;
  if (requireEmptyToFocus && !tab?.querySelector(".search-empty")) return;
  input.focus({ preventScroll: true });
}

/** Non-search tab ids in order (per incarnation). */
function getNavigableTabs(bar) {
  return Array.from(bar.querySelectorAll(".tab-btn"))
    .filter((b) => !b.dataset.tab.endsWith("-search"));
}

export function getActiveTabBar() {
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

/** Focus the search tab within the active tab bar. */
export function activateSearchTab(bar, forceFocus = false) {
  const searchBtn = Array.from(bar.querySelectorAll(".tab-btn"))
    .find((b) => b.dataset.tab.endsWith("-search"));

  if (!searchBtn) return;

  activateTab(searchBtn);
  focusSearchIfActive(searchBtn, !forceFocus);
}

/** Navigate the active tab bar by offset (skips the search tab). */
export function navigateTab(bar, offset) {
  const tabs = getNavigableTabs(bar);
  const active = bar.querySelector(".tab-btn.active");
  let idx = tabs.indexOf(active);
  // If active tab is search or not found, start from the appropriate end.
  if (idx === -1) idx = offset < 0 ? 0 : tabs.length - 1;
  const next = (idx + offset + tabs.length) % tabs.length;
  activateTab(tabs[next]);
}
