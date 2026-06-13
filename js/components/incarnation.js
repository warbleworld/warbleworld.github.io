// ─────────────────────────────────────────────────────────
// Incarnation builder: lazily assembles a character's full panel
// (Sheet / Inventory / Features / Spells) on first view.
// ─────────────────────────────────────────────────────────

import { DISABLED_INCARNATIONS } from "../config.js";
import { CHARACTERS, LEVEL } from "../data/characters.js";
import { buildTabBar, buildTabPanel } from "./tabs.js";
import { renderSheet } from "./sheet.js";
import { buildCardSection } from "./cards.js";

/** Tracks which incarnations have already been built (build-once). */
const built = new Set();

/**
 * Build (once) the content panel for an incarnation. No-op for
 * disabled or unknown incarnations.
 * @param {string} id
 */
export function buildIncarnation(id) {
  if (built.has(id)) return;
  built.add(id);

  const el = document.getElementById(id);
  if (!el || DISABLED_INCARNATIONS.includes(id)) return;

  const data = CHARACTERS[id];
  if (!data) return;

  const starred = new Set(data.starred || []);
  const unprepared = new Set(data.unprep || []);
  const allSpells = [...data.spells, ...(data.unprep || [])];
  const hideUnprepared = unprepared.size > 0 ? ["Unprepared"] : undefined;

  const tabs = [
    { id: `${id}-sheet`, label: "Sheet" },
    { id: `${id}-inv`, label: "Inventory" },
    { id: `${id}-feat`, label: "Features" },
    { id: `${id}-spells`, label: "Spells" },
  ];

  el.innerHTML =
    buildTabBar(tabs, "Character tabs") +
    buildTabPanel(`${id}-sheet`, renderSheet(data, LEVEL), true) +
    buildTabPanel(`${id}-inv`, buildCardSection(data.inv, `${id}-inv-g`, starred), false) +
    buildTabPanel(`${id}-feat`, buildCardSection(data.feat, `${id}-feat-g`, starred), false) +
    buildTabPanel(
      `${id}-spells`,
      buildCardSection(allSpells, `${id}-sp-g`, starred, hideUnprepared, unprepared),
      false,
    );
}
