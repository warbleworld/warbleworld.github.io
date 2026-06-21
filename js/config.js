// ---------------------------------------------------------
// App-wide configuration.
// ---------------------------------------------------------

/**
 * Character portrait filenames (resolved against the image base at render
 * time via `resolveImageUrl`). Swap these for CDN URLs to drop local files.
 */
export const PORTRAITS = {
  vespera: "vespera.webp",
  lucia: "lucia.webp",
  speaksWithSpirits: "speaks-with-spirits.webp",
  karmine: "karmine.webp",
  rubic: "rubic.webp",
  akai: "akai.webp",
  lucien: "lucien.webp",
  seabastion: "seabastion.webp",
  christian: "christian.webp",
};

/**
 * Widths (in CSS pixels) for which a resized copy of each portrait exists.
 * Resized files must live alongside the base image and follow the naming
 * convention `<name>-<width>w.<ext>` (e.g. `lucia-384w.webp` for
 * `lucia.webp`). The browser selects the best fit from the generated
 * `srcset`, falling back to the base file where no variants are available.
 */
export const PORTRAIT_WIDTHS = [96, 192, 384, 768];

/**
 * `sizes` hints describing how large a portrait renders, so the browser can
 * pick the right `srcset` candidate before layout. The large character-sheet
 * portrait spans the viewport on mobile and a ~250px column otherwise; the
 * small avatars are a fixed thumbnail.
 */
export const PORTRAIT_SIZES = "(max-width: 600px) 100vw, 250px";
export const AVATAR_SIZES = "32px";

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

/** The player each incarnation belongs to. */
export const INCARNATION_PLAYER = {
  vespera: "p1",
  lucia: "p1",
  speaksWithSpirits: "p1",
  karmine: "p2",
  rubic: "p2",
  akai: "p2",
  lucien: "p3",
  seabastion: "p3",
  christian: "p3",
};

/**
 * Incarnations that are temporarily unavailable. Their buttons are disabled
 * and their content is never built.
 */
export const DISABLED_INCARNATIONS = ["speaksWithSpirits", "akai", "lucien", "seabastion"];

/** Card-detail data source. */
export const CARDS_URL = "cards.json";
