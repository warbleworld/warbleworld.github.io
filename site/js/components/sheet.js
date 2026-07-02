// ---------------------------------------------------------
// Character sheet: portrait, abilities, stats, proficiencies,
// and resource counters.
// ---------------------------------------------------------

import { ABILITIES, SAVES, SKILLS, SKILL_ABILITY, modifier, signed, abilityMod } from "../../../shared/dnd.js";
import { imageHtml, isImageCached } from "../core/images.js";
import { escapeAttr, escapeHtml } from "../core/html.js";
import { PORTRAIT_SIZES } from "../config.js";
import { renderRadar } from "./radar.js";

/** When a counter's max exceeds this, show a numeric pool instead of pips. */
const PIP_LIMIT = 20;

/**
 * Render a list of proficiency pills (saves or skills).
 * @param {Array<{ label: string, bonus: string, proficient: boolean }>} items
 * @returns {string} HTML string
 */
function renderProfList(items) {
  const pills = items
    .map((item) => {
      const label = escapeHtml(item.label);
      const text = item.bonus ? `${label} ${escapeHtml(item.bonus)}` : label;
      return `<li class="${item.proficient ? "prof-yes" : "prof-no"}">${text}</li>`;
    })
    .join("");
  return `<ul class="cs-pills">${pills}</ul>`;
}

/**
 * Render a simple list of labelled pills.
 * @param {string[]} items
 * @returns {string}
 */
function renderTagList(items) {
  return renderProfList(items.map((item) => ({ label: item, bonus: "", proficient: true })));
}

/**
 * Render resource counters as pip rows or numeric pools.
 * @param {Array<{ name: string, max: number, cur: number, color: string }>} counters
 * @returns {string} HTML string
 */
function renderCounters(counters) {
  const blocks = counters
    .map((counter) => {
      let content;
      const color = escapeAttr(counter.color);
      const name = escapeHtml(counter.name);
      const nameAttr = escapeAttr(counter.name);
      if (counter.max > PIP_LIMIT) {
        content = `<div class="cs-counter-pool">${counter.cur} / ${counter.max}</div>`;
      } else {
        const pips = Array.from({ length: counter.max }, (_, i) => {
          const filled = i < counter.cur;
          const sep = i > 0 && i % 5 === 0 ? '<div class="cs-pip-sep"></div>' : "";
          return (
            sep +
            `<div class="cs-pip${filled ? " filled" : ""}" ` +
            `role="checkbox" aria-checked="${filled}" aria-label="${nameAttr} ${i + 1} of ${counter.max}"></div>`
          );
        }).join("");
        content = `<div class="cs-pips">${pips}</div>`;
      }
      return `<div class="cs-counter" data-counter-color="${color}"><div class="cs-counter-label">${name}</div>${content}</div>`;
    })
    .join("");

  return `<div class="cs-counters">${blocks}</div>`;
}

/**
 * Apply counter colors via the CSSOM after the sheet markup is inserted.
 * Keeping colors out of inline `style` attributes lets the page run under a
 * strict `style-src 'self'` CSP. Invalid color values are ignored by the
 * CSSOM, so no escaping/validation of the raw value is required here.
 * @param {Document|HTMLElement} root
 */
export function applyCounterColors(root) {
  root.querySelectorAll(".cs-counter[data-counter-color]").forEach((counterEl) => {
    const color = counterEl.dataset.counterColor;
    if (!color) return;
    const pool = counterEl.querySelector(".cs-counter-pool");
    if (pool) pool.style.color = color;
    counterEl.querySelectorAll(".cs-pip").forEach((pip) => pip.style.setProperty("--pip-color", color));
  });
}

/** Compute the save rows for a character. */
function computeSaves(data) {
  return SAVES.map((save) => {
    const proficient = data.saves.includes(save);
    const bonus = modifier(data.ab[save]) + (proficient ? data.prof : 0);
    return { label: save, bonus: signed(bonus), proficient };
  });
}

/** Compute the skill rows for a character (handles expertise). */
function computeSkills(data) {
  return SKILLS.map((skill) => {
    const ability = SKILL_ABILITY[skill];
    const expertise = data.expertise ? data.expertise.includes(skill) : false;
    const proficient = data.skills.includes(skill);
    const profBonus = expertise ? data.prof * 2 : proficient ? data.prof : 0;
    const bonus = modifier(data.ab[ability]) + profBonus;
    return { label: skill, bonus: signed(bonus), proficient };
  });
}

/**
 * Render one optional tag section if data is present.
 * @param {string} title
 * @param {string[] | undefined} items
 * @returns {string}
 */
function renderOptionalTagSection(title, items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<div class="cs-section"><div class="cs-section-title">${escapeHtml(title)}</div>${renderTagList(items)}</div>`;
}

/**
 * Render the spellcasting stats block when a character has spells.
 * @param {object} data
 * @returns {string}
 */
function renderSpellcastingStats(data) {
  if (!Array.isArray(data.spells) || data.spells.length === 0) return "";

  const spellAbility = ABILITIES.includes(data.spellcastingAbility) ? data.spellcastingAbility : null;
  if (!spellAbility) return "";
  const spellAbilityLabel = escapeHtml(spellAbility);

  const spellMod = modifier(data.ab[spellAbility]);
  const attackBonus = spellMod + data.prof;
  const spellDC = 8 + spellMod + data.prof;

  return `<div class="cs-section">` +
    `<div class="cs-section-title">Spellcasting (${spellAbilityLabel})</div>` +
    `<div class="cs-stats cs-stats-spellcasting">` +
      `<div class="cs-stat"><div class="cs-stat-val">${signed(attackBonus)}</div><div class="cs-stat-label">Attack</div></div>` +
      `<div class="cs-stat"><div class="cs-stat-val">${spellDC}</div><div class="cs-stat-label">Spell DC</div></div>` +
    `</div>` +
  `</div>`;
}

/**
 * Render a full character sheet.
 * @param {object} data - Character definition.
 * @returns {string} HTML string
 */
export function renderSheet(data) {
  const level = data.level;
  const portraitIsCached = isImageCached(data.img);
  const abilityBoxes = ABILITIES.map(
    (label) =>
      `<div class="cs-ab-box">` +
      `<div class="cs-ab-label">${escapeHtml(label)}</div>` +
      `<div class="cs-ab-score">${escapeHtml(data.ab[label])}</div>` +
      `<div class="cs-ab-mod">${abilityMod(data.ab[label])}</div>` +
      `</div>`,
  ).join("");
  const speed = data.speed ?? 30;

  return `<div class="cs">` +
    `<div class="cs-left">` +
      `<div class="cs-portrait">` +
        imageHtml(data.img, data.name, "cs-portrait-img", portraitIsCached, PORTRAIT_SIZES) +
        `<div class="cs-portrait-overlay">` +
          `<div class="cs-portrait-info">` +
            `<div class="cs-portrait-name">${escapeHtml(data.name)}</div>` +
            `<div class="cs-portrait-subtitle">${escapeHtml(data.race)} · ${escapeHtml(data.class)}</div>` +
          `</div>` +
          (level ? `<div class="cs-level" aria-label="Level ${level}"><span class="cs-level-num">${level}</span><span class="cs-level-label">LVL</span></div>` : "") +
        `</div>` +
      `</div>` +
      `<div class="cs-radar">${renderRadar(data.ab)}</div>` +
      `<div class="cs-ab-grid">${abilityBoxes}</div>` +
    `</div>` +
    `<div class="cs-right">` +
      `<div class="cs-stats">` +
        `<div class="cs-stat"><div class="cs-stat-val">${data.ac}</div><div class="cs-stat-label">Armor Class</div></div>` +
        `<div class="cs-stat"><div class="cs-stat-val">${data.hp}</div><div class="cs-stat-label">Hit Points</div></div>` +
        `<div class="cs-stat"><div class="cs-stat-val">${signed(modifier(data.ab["DEX"]) + data.initBonus)}</div><div class="cs-stat-label">Initiative</div></div>` +
        `<div class="cs-stat"><div class="cs-stat-val">${speed}</div><div class="cs-stat-label">Speed</div></div>` +
        `<div class="cs-stat"><div class="cs-stat-val">+${data.prof}</div><div class="cs-stat-label">Proficiency</div></div>` +
      `</div>` +
      renderSpellcastingStats(data) +
      `<div class="cs-section"><div class="cs-section-title">Saving Throws</div>${renderProfList(computeSaves(data))}</div>` +
      `<div class="cs-section"><div class="cs-section-title">Skills</div>${renderProfList(computeSkills(data))}</div>` +
      renderOptionalTagSection("Tools", data.tools) +
      renderOptionalTagSection("Senses", data.senses) +
      renderOptionalTagSection("Resistances", data.resistances) +
      renderOptionalTagSection("Armor", data.armor) +
      renderOptionalTagSection("Weapons", data.weapons) +
      renderOptionalTagSection("Languages", data.languages) +
      `<div class="cs-section"><div class="cs-section-title">Counters &amp; Resources</div>${renderCounters(data.counters)}</div>` +
    `</div>` +
  `</div>`;
}
