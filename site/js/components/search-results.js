// ---------------------------------------------------------
// Live search-results rendering for the per-incarnation search tab.
// ---------------------------------------------------------

import { getSearchData } from "./incarnation.js";
import { renderCard } from "./cards.js";
import { scoreCard } from "../core/search.js";
import { escapeHtml } from "../core/html.js";
import { getCard } from "../store.js";

/** Run the query against an incarnation's cards and render the results. */
export function performSearch(input) {
  const charId = input.dataset.charId;
  const query = input.value.trim();
  const data = getSearchData(charId);
  const resultsEl = document.getElementById(`${charId}-search-results`);

  if (!data || !resultsEl) return;

  if (!query) {
    resultsEl.innerHTML = '<div class="search-empty">Type to search cards\u2026</div>';
    return;
  }

  const scoreItem = (item) => {
    const card = getCard(item.id);
    if (!card) return null;
    const score = scoreCard(query, card);
    return score !== null ? { item, _score: score } : null;
  };

  const search = (items) =>
    items.map(scoreItem).filter(Boolean).sort((a, b) => b._score - a._score).map((r) => r.item);

  const invResults = search(data.inv);
  const featResults = search(data.feat);
  const spellResults = search(data.spells);

  if (!invResults.length && !featResults.length && !spellResults.length) {
    resultsEl.innerHTML = '<div class="search-empty">No matching cards found.</div>';
    return;
  }

  const renderSection = (title, items) => {
    if (!items.length) return "";
    const cards = items
      .map((it) =>
        renderCard(it.id, it.count, it.isStarting, it.titleOverride || null, it.footerOverride || null, false, data.unprepared),
      )
      .join("");
    return (
      `<div class="search-section">` +
        `<div class="search-section-title">${escapeHtml(title)}</div>` +
        `<div class="card-grid">${cards}</div>` +
      `</div>`
    );
  };

  resultsEl.innerHTML =
    renderSection("Inventory", invResults) +
    renderSection("Features", featResults) +
    renderSection("Spells", spellResults);
}
