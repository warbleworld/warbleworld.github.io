// ─────────────────────────────────────────────────────────
// Hexagonal ability-score radar chart (inline SVG).
// ─────────────────────────────────────────────────────────

import { ABILITIES } from "../core/dnd.js";

const CENTER = 105;
const RADIUS = 85;
const MAX_SCORE = 20;

/** Angle (radians) for each of the six axes, starting at the top. */
function axisAngles() {
  return ABILITIES.map((_, i) => (Math.PI * 2 * i) / 6 - Math.PI / 2);
}

/** Point `x,y` at the given angle and radius from the centre. */
function point(angle, radius) {
  return `${CENTER + Math.cos(angle) * radius},${CENTER + Math.sin(angle) * radius}`;
}

/**
 * Render the radar chart for a set of ability scores.
 * @param {Record<string, number>} abilities
 * @returns {string} SVG markup
 */
export function renderRadar(abilities) {
  const angles = axisAngles();

  const rings = [0.25, 0.5, 0.75, 1]
    .map((pct) => {
      const pts = angles.map((a) => point(a, RADIUS * pct)).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    })
    .join("");

  const axes = angles
    .map(
      (a) =>
        `<line x1="${CENTER}" y1="${CENTER}" x2="${point(a, RADIUS).split(",").join('" y2="')}" stroke="rgba(255,255,255,0.04)"/>`,
    )
    .join("");

  const dataPoints = ABILITIES.map((label, i) =>
    point(angles[i], RADIUS * Math.min(abilities[label] / MAX_SCORE, 1)),
  ).join(" ");
  const dataShape = `<polygon points="${dataPoints}" fill="rgba(201,168,76,0.12)" stroke="var(--gold)" stroke-width="2"/>`;

  const dotsAndLabels = ABILITIES.map((label, i) => {
    const frac = Math.min(abilities[label] / MAX_SCORE, 1);
    const [dx, dy] = point(angles[i], RADIUS * frac).split(",");
    const [lx, ly] = point(angles[i], RADIUS + 14).split(",");
    return (
      `<circle cx="${dx}" cy="${dy}" r="3" fill="var(--gold)"/>` +
      `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" ` +
      `fill="var(--text-dim)" font-family="Inter,sans-serif" font-size="8" font-weight="600" letter-spacing="1">${label}</text>`
    );
  }).join("");

  return `<svg viewBox="0 0 210 210" xmlns="http://www.w3.org/2000/svg">${rings}${axes}${dataShape}${dotsAndLabels}</svg>`;
}
