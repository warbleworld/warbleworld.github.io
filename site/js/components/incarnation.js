// ---------------------------------------------------------
// Incarnation builder: lazily assembles a character's full panel
// (Sheet / Inventory / Features / Spells) on first view.
// ---------------------------------------------------------

import { DISABLED_INCARNATIONS, INCARNATION_PLAYER } from "../config.js";
import { escapeAttr } from "../core/html.js";
import { CHARACTERS } from "../data/characters.js";
import { PLAYER_INVENTORY } from "../data/players.js";
import { getCard } from "../store.js";
import { buildTabBar, buildTabPanel } from "./tabs.js";
import { renderSheet, applyCounterColors } from "./sheet.js";
import { buildCardSection } from "./cards.js";

/** Tracks which incarnations have already been built (build-once). */
const built = new Set();

/** Per-incarnation card lists used by the search tab. */
const searchIndex = new Map();

/**
 * Retrieve the stored card lists for a built incarnation.
 * @param {string} charId
 * @returns {{ inv: object[], feat: object[], spells: object[], unprepared: Set<string> } | null}
 */
export function getSearchData(charId) {
  return searchIndex.get(charId) ?? null;
}

const TAG_ORDER = ["Weapon", "Equipment", "Consumables", "Tools and Containers", "Loot"];

function normalizeLoadoutItem(item) {
  return typeof item === "string"
    ? { id: item, count: 1, titleOverride: null, isStarting: false }
    : { id: item.id, count: item.count || 1, titleOverride: item.titleOverride || null, isStarting: !!item.isStarting };
}

function sortInventory(rawItems) {
  const items = rawItems.map(normalizeLoadoutItem);
  const rankForTag = (tag) => {
    const idx = TAG_ORDER.indexOf(tag);
    return idx === -1 ? TAG_ORDER.length : idx;
  };
  const titleOverrideFor = (item) => {
    const card = getCard(item.id);
    return (item.titleOverride || card?.title || item.id).toLocaleLowerCase();
  };
  const tagFor = (item) => {
    const card = getCard(item.id);
    return card?.tag || "Other";
  };

  items.sort((a, b) => {
    const tagRankA = rankForTag(tagFor(a));
    const tagRankB = rankForTag(tagFor(b));
    if (tagRankA !== tagRankB) return tagRankA - tagRankB;

    const titleOverrideA = titleOverrideFor(a);
    const titleOverrideB = titleOverrideFor(b);
    if (titleOverrideA !== titleOverrideB) return titleOverrideA < titleOverrideB ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return items;
}

/**
 * Build (once) the content panel for an incarnation. No-op for
 * disabled or unknown incarnations.
 * @param {string} id
 */
export function buildIncarnation(id) {
  if (built.has(id)) return;

  const el = document.getElementById(id);
  if (!el || DISABLED_INCARNATIONS.includes(id)) return;

  const data = CHARACTERS[id];
  if (!data) return;

  built.add(id);

  const unprepared = new Set(data.unprep || []);
  const allSpells = [...(data.spells || []), ...(data.unprep || [])];
  const hideUnprepared = unprepared.size > 0 ? ["Unprepared"] : undefined;

  const playerId = INCARNATION_PLAYER[id];
  const sharedInv = playerId ? (PLAYER_INVENTORY[playerId] || []) : [];
  // Items in inv are flagged to indicate they are the incarnation's starting items.
  const inv = (data.inv || []).map((item) => {
    if (typeof item === "string") return { id: item, isStarting: true };
    return { ...item, isStarting: true };
  });
  const sortedInv = sortInventory([...sharedInv, ...inv]);

  // Store card lists so the search tab can query them later.
  searchIndex.set(id, {
    inv: sortedInv,
    feat: (data.feat || []).map(normalizeLoadoutItem),
    spells: allSpells.map(normalizeLoadoutItem),
    unprepared,
  });

  const tabs = [
    { id: `${id}-sheet`, label: "Sheet" },
    { id: `${id}-inv`, label: "Inventory" },
    { id: `${id}-feat`, label: "Features" },
    { id: `${id}-spells`, label: "Spells" },
    { id: `${id}-search`, label: "Search" },
  ];

  const searchContent =
    `<div class="search-bar">` +
      `<input type="search" class="search-input" data-char-id="${escapeAttr(id)}" ` +
      `placeholder="Search cards\u2026" autocomplete="off" spellcheck="false" ` +
      `aria-label="Search cards">` +
    `</div>` +
    `<div class="search-results" id="${escapeAttr(id)}-search-results">` +
      `<div class="search-empty">Type to search cards\u2026</div>` +
    `</div>`;

  el.innerHTML =
    buildTabBar(tabs, "Character tabs") +
    buildTabPanel(`${id}-sheet`, renderSheet(data, id), true) +
    buildTabPanel(`${id}-inv`, buildCardSection(sortedInv, `${id}-inv-g`, undefined, undefined, { triAll: "starting" }), false) +
    buildTabPanel(`${id}-feat`, buildCardSection(data.feat, `${id}-feat-g`), false) +
    buildTabPanel(
      `${id}-spells`,
      buildCardSection(allSpells, `${id}-sp-g`, hideUnprepared, unprepared),
      false,
    ) +
    buildTabPanel(`${id}-search`, searchContent, false);

  // Mark non-search tabs that have a filter bar with data-has-filters for caret display
  el.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.dataset.tab?.endsWith("-search")) return;
    const panel = document.getElementById(btn.dataset.tab);
    if (panel?.querySelector(".filter-bar")) {
      btn.setAttribute("data-has-filters", "");
    }
  });

  applyCounterColors(el);
}
