// ─────────────────────────────────────────────────────────
// Centralised image handling.
//
// All image URLs in the app flow through `resolveImageUrl`, so the
// storage location can be changed in one place. Local images live
// under `IMAGE_BASE`; absolute URLs (e.g. the 5e.tools CDN) pass
// through untouched.
//
// Images are rendered with native lazy-loading and async decoding,
// and `installImageFallback` gracefully swaps any image that fails
// to load (a very real case here, since many local files may be
// missing) for a first-letter placeholder.
// ─────────────────────────────────────────────────────────

import { escapeAttr, escapeHtml } from "./html.js";

/** Folder (relative to index.html) that holds bundled images. */
export const IMAGE_BASE = "images/";

const ABSOLUTE_URL = /^(https?:)?\/\//i;

/**
 * Resolve a stored image reference to a usable URL.
 * - Absolute URLs and data URIs are returned unchanged.
 * - Bare filenames and `images/...` paths are normalised onto IMAGE_BASE.
 * @param {string} src
 * @returns {string}
 */
export function resolveImageUrl(src) {
  if (!src) return "";
  if (ABSOLUTE_URL.test(src) || src.startsWith("data:")) return src;
  const clean = src.replace(/^\.?\//, "").replace(/^images\//, "");
  return IMAGE_BASE + clean;
}

/**
 * Build an `<img>` (with lazy loading + fallback metadata) or a
 * first-letter placeholder when no source is available.
 * @param {string} src - Raw image reference.
 * @param {string} alt - Accessible label / fallback seed.
 * @param {string} className - CSS class for the image.
 * @returns {string} HTML string
 */
export function imageHtml(src, alt, className) {
  const url = resolveImageUrl(src);
  const initial = (alt || "?").charAt(0);
  if (!url) return fallbackHtml(initial);

  return (
    `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" class="${className} is-loading" ` +
    `loading="lazy" decoding="async" data-fallback="${escapeAttr(initial)}">`
  );
}

/**
 * Build a thumbnail container holding an image or placeholder.
 * Shared by grid cards and the detail modal.
 * @param {{ img?: string, title?: string }} card
 * @param {string} containerClass
 * @returns {string} HTML string
 */
export function thumbHtml(card, containerClass) {
  return `<div class="${containerClass}">${imageHtml(card.img, card.title, "card-thumb-img")}</div>`;
}

/** First-letter placeholder used when an image is absent or broken. */
function fallbackHtml(initial) {
  return `<span class="card-thumb-fallback">${escapeHtml(initial)}</span>`;
}

/**
 * Install a delegated handler that replaces any broken `<img>` carrying
 * a `data-fallback` attribute with a placeholder glyph. `error` events
 * do not bubble, so the listener runs in the capture phase.
 * @param {Document|HTMLElement} [root=document]
 */
export function installImageFallback(root = document) {
  root.addEventListener(
    "error",
    (event) => {
      const el = event.target;
      if (!(el instanceof HTMLImageElement)) return;
      const initial = el.dataset.fallback;
      if (initial == null || el.dataset.failed) return;

      el.dataset.failed = "1";
      const placeholder = document.createElement("span");
      placeholder.className = "card-thumb-fallback";
      placeholder.textContent = initial;
      el.replaceWith(placeholder);
    },
    true,
  );

  // Fade images in once their pixels are ready. `load` does not bubble, so
  // the listener runs in the capture phase. Images that were already cached
  // (and so complete before this runs) are revealed immediately.
  root.addEventListener(
    "load",
    (event) => {
      const el = event.target;
      if (el instanceof HTMLImageElement) el.classList.remove("is-loading");
    },
    true,
  );
}
