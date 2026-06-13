// ─────────────────────────────────────────────────────────
// App-wide configuration.
// ─────────────────────────────────────────────────────────

/**
 * Character portrait filenames (resolved against the image base at render
 * time via `resolveImageUrl`). Swap these for CDN URLs to drop local files.
 */
export const PORTRAITS = {
  vespera: "vespera.png",
  lucia: "lucia.png",
  karmine: "karmine.png",
  rubic: "rubic.png",
  lucien: "lucien.png",
  seabastion: "seabastion.png",
  christian: "christian.png",
};

/**
 * Incarnations that are temporarily unavailable. Their buttons are disabled
 * and their content is never built.
 */
export const DISABLED_INCARNATIONS = ["vespera", "rubic", "lucien", "seabastion"];

/** Card-detail data source. */
export const CARDS_URL = "cards.json";
