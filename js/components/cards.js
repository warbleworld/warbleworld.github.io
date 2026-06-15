// ---------------------------------------------------------
// Card rendering: grids, filter pills, and individual cards.
// ---------------------------------------------------------

import { escapeAttr, escapeHtml } from "../core/html.js";
import { formatDesc } from "../core/markdown.js";
import { thumbHtml } from "../core/images.js";
import { getCard } from "../store.js";

/** Maps a semantic tag to the CSS class that colors the card. */
const TAG_TO_CLASS = {
  "Weapon": "cat-weapon",
  "Equipment": "cat-equipment",
  "Consumables": "cat-consumables",
  "Tools and Containers": "cat-tools-and-containers",
  "Loot": "cat-loot",
  "Class": "cat-class",
  "Species": "cat-species",
  "Background": "cat-background",
  "Other": "cat-other",
  "Cantrip": "spell-0",
  "1st Level": "spell-1",
  "2nd Level": "spell-2",
  "3rd Level": "spell-3",
  "4th Level": "spell-4",
  "5th Level": "spell-5",
  "6th Level": "spell-6",
  "7th Level": "spell-7",
  "8th Level": "spell-8",
  "9th Level": "spell-9",
  "Unprepared": "cat-unprepared",
};

/**
 * CSS class for a card category tag.
 * @param {string} tag
 * @returns {string}
 */
export function cardClass(tag) {
  return TAG_TO_CLASS[tag] || "cat-other";
}

/**
 * Normalise a loadout array (plain IDs or `{ id, count, title }`) into
 * a uniform list of `{ id, count, title }` entries.
 * @param {Array<string|{ id: string, count?: number, title?: string }>} items
 * @returns {Array<{ id: string, count: number, title: string|null }>}
 */
function normalizeItems(items) {
  return items.map((item) =>
    typeof item === "string"
      ? { id: item, count: 1, title: null }
      : { id: item.id, count: item.count || 1, title: item.title || null },
  );
}

/**
 * Effective tag for a card, accounting for "unprepared" overrides.
 * @param {string} id
 * @param {Set<string>} [unprepared]
 * @returns {string}
 */
function effectiveTag(id, unprepared) {
  if (unprepared && unprepared.has(id)) return "Unprepared";
  const card = getCard(id);
  return card ? card.tag : "Other";
}

/**
 * Build a filter pill bar for a card grid. Renders only when there are
 * 2+ distinct categories.
 * @param {Array<{ id: string }>} items - Normalised entries.
 * @param {string} gridId - ID of the grid the bar controls.
 * @param {string[]} [defaultExclude] - Categories hidden on load.
 * @param {Set<string>} [unprepared]
 * @returns {string} HTML string (empty if <= 1 category)
 */
function buildFilterBar(items, gridId, defaultExclude, unprepared) {
  if (!items.length) return "";

  const categories = [];
  let hasUnprepared = false;
  items.forEach((item) => {
    if (unprepared && unprepared.has(item.id)) hasUnprepared = true;
    const tag = effectiveTag(item.id);
    if (!categories.includes(tag)) categories.push(tag);
  });
  if (hasUnprepared && !categories.includes("Unprepared")) categories.push("Unprepared");
  if (categories.length <= 1) return "";

  const excluded = defaultExclude || [];
  const hasExclusions = excluded.length > 0;
  const allActive = !hasExclusions;

  const pills = categories
    .map((category) => {
      const active = hasExclusions && !excluded.includes(category);
      return `<button class="filter-pill${active ? " active" : ""}" data-filter="${escapeAttr(category)}">${category}</button>`;
    })
    .join("");

  return (
    `<div class="filter-bar" data-grid="${escapeAttr(gridId)}">` +
    `<button class="filter-pill${allActive ? " active" : ""}" data-filter="all">All</button>${pills}</div>`
  );
}

/**
 * Render a single grid card. Clicking it opens the detail modal.
 * @param {string} id
 * @param {Set<string>} [starred] - IDs that show a star badge.
 * @param {number} [count=1] - Copies (shows `x3` when > 1).
 * @param {string|null} [titleOverride] - Custom display title.
 * @param {boolean} [hidden=false] - Render filtered-out by default.
 * @param {Set<string>} [unprepared]
 * @returns {string} HTML string
 */
function renderCard(id, starred, count = 1, titleOverride, hidden = false, unprepared) {
  const card = getCard(id);
  if (!card) return "";

  const tag = effectiveTag(id, unprepared);
  const cls = cardClass(tag);
  const isUnprepared = !!(unprepared && unprepared.has(id));
  const displayTitle = escapeHtml(titleOverride || card.title);
  const displayFooter = escapeHtml(card.footer || "");
  const displayTag = escapeHtml(card.tag || "");
  const star = starred && starred.has(id)
    ? '<span class="card-star" title="Starting item">⭐</span>'
    : "";
  const qty = count > 1 ? `<span class="card-count">x${count}</span>` : "";
  const hiddenCls = hidden ? " filter-hidden" : "";

  return (
    `<div class="item-card ${cls}${hiddenCls}" data-cat="${escapeAttr(card.tag)}"${isUnprepared ? ' data-unprepared="true"' : ""} data-card-id="${escapeAttr(id)}">` +
      `<div class="card-stripe"></div>` +
      `<div class="card-body">` +
        thumbHtml(card, "card-thumb") +
        `<div class="card-text">` +
          `<div class="card-title">${star}${displayTitle}${qty}</div>` +
          `<div class="card-desc rich-desc">${formatDesc(card.desc)}</div>` +
        `</div>` +
      `</div>` +
    `<div class="card-footer"><span>${displayFooter}</span><span class="card-tag">${displayTag}</span></div>` +
    `</div>`
  );
}

/**
 * Build a card grid (with optional filter bar) from a loadout array.
 * @param {Array<string|{ id: string, count?: number, title?: string }>} rawItems
 * @param {string} gridId - Unique ID for the grid element.
 * @param {Set<string>} [starred]
 * @param {string[]} [defaultExclude]
 * @param {Set<string>} [unprepared]
 * @returns {string} HTML string
 */
export function buildCardSection(rawItems, gridId, starred, defaultExclude, unprepared) {
  const items = normalizeItems(rawItems);
  if (!items.length) return '<div class="empty-msg">None :(</div>';

  const excluded = defaultExclude || [];
  const hasExclusions = excluded.length > 0;

  const cards = items
    .map((item) => {
      const tag = effectiveTag(item.id, unprepared);
      const hidden = hasExclusions && excluded.includes(tag);
      return renderCard(item.id, starred, item.count, item.title, hidden, unprepared);
    })
    .join("");

  return (
    buildFilterBar(items, gridId, defaultExclude, unprepared) +
    `<div class="card-grid" id="${escapeAttr(gridId)}">${cards}</div>`
  );
}
