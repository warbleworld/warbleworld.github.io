// ─────────────────────────────────────────────────────────
// D&D 5e rules helpers and reference tables.
// ─────────────────────────────────────────────────────────

/** Ability scores, in the canonical display order. */
export const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

/** Saving throws use the same six abilities. */
export const SAVES = ABILITIES;

/** All 18 skills, alphabetised. */
export const SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History",
  "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception",
  "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival",
];

/** Maps each skill to its governing ability score. */
export const SKILL_ABILITY = {
  "Acrobatics": "DEX", "Animal Handling": "WIS", "Arcana": "INT", "Athletics": "STR",
  "Deception": "CHA", "History": "INT", "Insight": "WIS", "Intimidation": "CHA",
  "Investigation": "INT", "Medicine": "WIS", "Nature": "INT", "Perception": "WIS",
  "Performance": "CHA", "Persuasion": "CHA", "Religion": "INT",
  "Sleight of Hand": "DEX", "Stealth": "DEX", "Survival": "WIS",
};

/**
 * Raw ability modifier from a score (e.g. 16 -> 3).
 * @param {number} score
 * @returns {number}
 */
export function modifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Format a number as a signed string (e.g. 3 -> "+3", -1 -> "-1").
 * @param {number} value
 * @returns {string}
 */
export function signed(value) {
  return (value >= 0 ? "+" : "") + value;
}

/**
 * Signed ability modifier string from a score (e.g. 16 -> "+3").
 * @param {number} score
 * @returns {string}
 */
export function abilityMod(score) {
  return signed(modifier(score));
}
