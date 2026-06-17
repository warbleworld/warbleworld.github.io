// ---------------------------------------------------------
// Incarnation builder: lazily assembles a character's full panel
// (Sheet / Inventory / Features / Spells) on first view.
// ---------------------------------------------------------

import { DISABLED_INCARNATIONS, INCARNATION_PLAYER } from "../config.js";
import { CHARACTERS } from "../data/characters.js";
import { PLAYER_INVENTORY } from "../data/players.js";
import { getCard } from "../store.js";
import { buildTabBar, buildTabPanel } from "./tabs.js";
import { renderSheet } from "./sheet.js";
import { buildCardSection } from "./cards.js";

/** Tracks which incarnations have already been built (build-once). */
const built = new Set();

const TAG_ORDER = ["Weapon", "Equipment", "Consumables", "Tools and Containers", "Loot"];

function normalizeLoadoutItem(item) {
  return typeof item === "string"
    ? { id: item, count: 1, titleOverride: null, isStarting: false }
    : { id: item.id, count: item.count || 1, titleOverride: item.titleOverride || null, isStarting: !!item.isStarting };
}

function sortInventory(rawItems) {
  const items = rawItems.map(normalizeLoadoutItem);
  console.log(items);
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

  const tabs = [
    { id: `${id}-sheet`, label: "Sheet" },
    { id: `${id}-inv`, label: "Inventory" },
    { id: `${id}-feat`, label: "Features" },
    { id: `${id}-spells`, label: "Spells" },
  ];

  el.innerHTML =
    buildTabBar(tabs, "Character tabs") +
    buildTabPanel(`${id}-sheet`, renderSheet(data), true) +
    buildTabPanel(`${id}-inv`, buildCardSection(sortedInv, `${id}-inv-g`, undefined, undefined, { triAll: "starting" }), false) +
    buildTabPanel(`${id}-feat`, buildCardSection(data.feat, `${id}-feat-g`), false) +
    buildTabPanel(
      `${id}-spells`,
      buildCardSection(allSpells, `${id}-sp-g`, hideUnprepared, unprepared),
      false,
    );
}
