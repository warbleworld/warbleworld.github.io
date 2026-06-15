// ---------------------------------------------------------
// App-wide configuration.
// ---------------------------------------------------------

/**
 * Character portrait filenames (resolved against the image base at render
 * time via `resolveImageUrl`). Swap these for CDN URLs to drop local files.
 */
export const PORTRAITS = {
  vespera: "vespera.png",
  lucia: "lucia.png",
  speaksWithSpirits: "speaks-with-spirits.png",
  karmine: "karmine.png",
  rubic: "rubic.png",
  akai: "akai.png",
  lucien: "lucien.png",
  seabastion: "seabastion.png",
  christian: "christian.png",
};

/**
 * Default incarnation to activate for each player page on load.
 * Keys are player page IDs; values are incarnation IDs.
 * If the specified incarnation is disabled, `ensureAvailableDefaults`
 * will automatically fall back to the first available one.
 */
export const DEFAULT_INCARNATIONS = {
  p1: "lucia",
  p2: "karmine",
  p3: "christian",
};

/**
 * Incarnations that are temporarily unavailable. Their buttons are disabled
 * and their content is never built.
 */
export const DISABLED_INCARNATIONS = ["vespera", "speaksWithSpirits", "rubic", "akai", "lucien", "seabastion"];

/** Card-detail data source. */
export const CARDS_URL = "cards.json";
