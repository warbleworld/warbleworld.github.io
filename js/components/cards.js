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
 * Normalize a loadout array (plain IDs or `{ id, count, titleOverride, footerOverride }`) into
 * a uniform list of `{ id, count, isStarting, titleOverride, footerOverride }` entries.
 * @param {Array<string|{ id: string, count?: number, isStarting?: boolean, titleOverride?: string, footerOverride?: string}>} items
 * @returns {Array<{ id: string, count: number, isStarting: boolean, titleOverride: string|null, footerOverride: string|null }>}
 */
function normalizeItems(items) {
  return items.map((item) => {
    if (typeof item === "string") return { id: item, count: 1, isStarting: false, titleOverride: null, footerOverride: null };
    return {
      id: item.id,
      count: item.count || 1,
      isStarting: !!item.isStarting,
      titleOverride: item.titleOverride,
      footerOverride: item.footerOverride,
    };
  });
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
function buildFilterBar(items, gridId, defaultExclude, unprepared, opts) {
  if (!items.length) return "";

  const categories = [];
  let hasUnprepared = false;
  items.forEach((item) => {
    if (unprepared && unprepared.has(item.id)) hasUnprepared = true;
    const tag = effectiveTag(item.id);
    if (!categories.includes(tag)) categories.push(tag);
  });
  if (hasUnprepared && !categories.includes("Unprepared")) categories.push("Unprepared");

  const excluded = defaultExclude || [];
  const hasExclusions = excluded.length > 0;
  const allActive = !hasExclusions;

  const pills = categories
    .map((category) => {
      const active = hasExclusions && !excluded.includes(category);
      return `<button class="filter-pill${active ? " active" : ""}" data-filter="${escapeAttr(category)}">${category}</button>`;
    })
    .join("");

  const triAll = !!(opts && opts.triAll === "starting");
  const triAttr = triAll ? ' data-tri-all="starting"' : "";
  const allLabel = triAll ? "All ↻" : "All";
  const allTitle = triAll ? ' title="Click to cycle: All → Starting → Shared"' : "";
  return (
    `<div class="filter-bar" data-grid="${escapeAttr(gridId)}"${triAttr}>` +
    `<button class="filter-pill${allActive ? " active" : ""}" data-filter="all"${allTitle}>${allLabel}</button>` +
    `<span class="filter-sep" aria-hidden="true"></span>` +
    `${pills}</div>`
  );
}

/**
 * Render a single grid card. Clicking it opens the detail modal.
 * @param {string} id
 * @param {number} [count=1] - Copies (shows `x3` when > 1).
 * @param {boolean} [isStarting=false] - Whether the card is a starting item (shows a star).
 * @param {string|null} [titleOverride] - Custom display title.
 * @param {string|null} [footerOverride] - Custom display footer.
 * @param {boolean} [hidden=false] - Render filtered-out by default.
 * @param {Set<string>} [unprepared] - Set of unprepared spell IDs to determine effective tag.
 * @returns {string} HTML string
 */
export function renderCard(id, count = 1, isStarting = false, titleOverride = null, footerOverride = null, hidden = false, unprepared) {
  const card = getCard(id);
  if (!card) return "";

  const tag = effectiveTag(id, unprepared);
  const cls = cardClass(tag);
  const isUnprepared = !!(unprepared && unprepared.has(id));
  const displayTitle = escapeHtml(titleOverride || card.title);
  const displayFooter = escapeHtml(footerOverride || card.footer);
  const displayTag = escapeHtml(card.tag || "");
  const star = isStarting ? '<span class="card-star" title="Starting item">⭐</span>' : "";
  const qty = count > 1 ? `<span class="card-count">x${count}</span>` : "";
  const hiddenCls = hidden ? " filter-hidden" : "";
  const startingAttr = isStarting ? ' data-starting="true"' : ' data-starting="false"';

  const titleAttr = titleOverride ? ` data-title-override="${escapeAttr(titleOverride)}"` : "";
  const footerAttr = footerOverride ? ` data-footer-override="${escapeAttr(footerOverride)}"` : "";

  return (
    `<div class="item-card ${cls}${hiddenCls}" data-cat="${escapeAttr(card.tag)}"${isUnprepared ? ' data-unprepared="true"' : ""}${startingAttr} data-card-id="${escapeAttr(id)}"${titleAttr}${footerAttr}>` +
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
 * @param {Array<string|{ id: string, count?: number, titleOverride?: string, title?: string }>} rawItems
 * @param {string} gridId - Unique ID for the grid element.
 * @param {string[]} [defaultExclude]
 * @param {Set<string>} [unprepared]
 * @returns {string} HTML string
 */
export function buildCardSection(rawItems, gridId, defaultExclude, unprepared, opts) {
  const items = normalizeItems(rawItems);
  if (!items.length) return '<div class="empty-msg">None :(</div>';

  const excluded = defaultExclude || [];
  const hasExclusions = excluded.length > 0;

  const cards = items
    .map((item) => {
      const tag = effectiveTag(item.id, unprepared);
      const hidden = hasExclusions && excluded.includes(tag);
      return renderCard(item.id, item.count, item.isStarting, item.titleOverride, item.footerOverride, hidden, unprepared);
    })
    .join("");

  return (
    buildFilterBar(items, gridId, defaultExclude, unprepared, opts) +
    `<div class="card-grid" id="${escapeAttr(gridId)}">${cards}</div>`
  );
}
