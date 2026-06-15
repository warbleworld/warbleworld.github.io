// ---------------------------------------------------------
// Card data store.
// Holds the card database loaded from cards.json and exposes
// read access to the rest of the app.
// ---------------------------------------------------------

import { CARDS_URL } from "./config.js";

/** @type {Record<string, object>} */
let cards = {};

/**
 * Look up a card definition by ID.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getCard(id) {
  return cards[id];
}

/** Replace the entire card database (mainly for tests/loading). */
export function setCards(data) {
  cards = data || {};
}

/**
 * Fetch the card database. On failure, the store falls back to an
 * empty set so the rest of the UI can still render.
 * @param {string} [url=CARDS_URL]
 * @returns {Promise<void>}
 */
export async function loadCards(url = CARDS_URL) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setCards(await response.json());
  } catch (err) {
    console.warn(`Failed to load ${url}, using empty card set:`, err.message);
    setCards({});
  }
}
