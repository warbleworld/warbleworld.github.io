// ---------------------------------------------------------
// Generic ARIA tab bar + panel builders.
// ---------------------------------------------------------

import { escapeAttr } from "../core/html.js";

/**
 * Build a tab bar with ARIA roles. The first tab is active by default.
 * @param {Array<{ id: string, label: string }>} tabs
 * @param {string} ariaLabel
 * @returns {string} HTML string
 */
export function buildTabBar(tabs, ariaLabel) {
  const buttons = tabs
    .map(
      (tab, i) =>
        `<button class="tab-btn${i === 0 ? " active" : ""}" data-tab="${escapeAttr(tab.id)}" ` +
        `role="tab" aria-selected="${i === 0}">${tab.label}</button>`,
    )
    .join("");

  return `<div class="tab-bar" role="tablist" aria-label="${escapeAttr(ariaLabel)}">${buttons}</div>`;
}

/**
 * Build a single tab content panel.
 * @param {string} id - Panel ID (matches `data-tab` on its button).
 * @param {string} content - Inner HTML.
 * @param {boolean} active - Whether this panel is visible by default.
 * @returns {string} HTML string
 */
export function buildTabPanel(id, content, active) {
  return `<div class="tab-content${active ? " active" : ""}" id="${escapeAttr(id)}" role="tabpanel"><div class="tab-scroll">${content}</div></div>`;
}
