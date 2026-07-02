// ---------------------------------------------------------
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
// ---------------------------------------------------------

import { escapeAttr, escapeHtml } from "./html.js";
import { PORTRAIT_WIDTHS } from "../config.js";

/** Folder (relative to index.html) that holds bundled images. */
export const IMAGE_BASE = "images/";

/** Track which image URLs have been successfully loaded (cached). */
const cachedImageUrls = new Set();

const ABSOLUTE_URL = /^(https?:)?\/\//i;

/**
 * Normalize an image source into a stable absolute cache key.
 * @param {string} src
 * @returns {string}
 */
function imageCacheKey(src) {
  const url = resolveImageUrl(src);
  if (!url) return "";
  return new URL(url, document.baseURI).href;
}

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
 * Build a `srcset` of resized variants for a local image, following the
 * `<name>-<width>w.<ext>` naming convention. Returns an empty string for
 * absolute/data URLs or sources without an extension, so callers can safely
 * fall back to a plain `src`.
 * @param {string} src - Raw image reference.
 * @param {number[]} [widths=PORTRAIT_WIDTHS] - Variant widths in pixels.
 * @returns {string} A `srcset` value, or "" when no variants apply.
 */
export function buildSrcset(src, widths = PORTRAIT_WIDTHS) {
  if (!src || ABSOLUTE_URL.test(src) || src.startsWith("data:")) return "";
  const url = resolveImageUrl(src);
  const dot = url.lastIndexOf(".");
  if (dot === -1 || !widths || !widths.length) return "";
  const base = url.slice(0, dot);
  const ext = url.slice(dot);
  return widths.map((w) => `${escapeAttr(`${base}-${w}w${ext}`)} ${w}w`).join(", ");
}

/**
 * Build an `<img>` (with lazy loading + fallback metadata) or a
 * first-letter placeholder when no source is available.
 * @param {string} src - Raw image reference.
 * @param {string} alt - Accessible label / fallback seed.
 * @param {string} className - CSS class for the image.
 * @param {boolean} [eager=false] - Use eager loading instead of lazy.
 * @param {string} [sizes=""] - When set, emit a responsive `srcset`/`sizes`
 *   pair (built from `buildSrcset`) so the browser can pick a resized variant.
 * @returns {string} HTML string
 */
export function imageHtml(src, alt, className, eager = false, sizes = "") {
  const url = resolveImageUrl(src);
  const initial = (alt || "?").charAt(0);
  if (!url) return fallbackHtml(initial);

  const loading = eager ? "eager" : "lazy";
  const loadingClass = eager ? "" : " is-loading";
  const srcset = sizes ? buildSrcset(src) : "";
  const responsiveAttrs = srcset
    ? ` srcset="${srcset}" sizes="${escapeAttr(sizes)}" data-srcbase="${escapeAttr(url)}"`
    : "";
  return (
    `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" class="${className}${loadingClass}"${responsiveAttrs} ` +
    `loading="${loading}" decoding="async" draggable="false" data-fallback="${escapeAttr(initial)}">`
  );
}

/**
 * Configure an existing avatar `<img>` element to display a portrait:
 * resolves the source, enables lazy loading + async decoding, and seeds
 * the fallback glyph used when the image fails to load. The `is-loading`
 * fade is skipped when the portrait is already cached.
 * @param {HTMLImageElement} img - Target image element.
 * @param {string} src - Raw portrait reference.
 * @param {string} [alt] - Accessible label; the existing alt is kept when omitted.
 * @param {string} [sizes=""] - When set, also apply a responsive `srcset`/`sizes`.
 */
export function applyAvatarImage(img, src, alt, sizes = "") {
  if (!img) return;
  if (alt != null) img.alt = alt;
  const url = resolveImageUrl(src);
  img.src = url;
  const srcset = sizes ? buildSrcset(src) : "";
  if (srcset) {
    img.srcset = srcset;
    img.sizes = sizes;
    img.dataset.srcbase = url;
  } else {
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    delete img.dataset.srcbase;
  }
  img.loading = "lazy";
  img.decoding = "async";
  img.dataset.fallback = (img.alt || "?").charAt(0);
  img.classList.toggle("is-loading", !isImageCached(src));
}

/**
 * Prevent native image dragging/selection so drag gestures can remain
 * available for app-level scroll interactions.
 * @param {HTMLImageElement} img
 */
function applyImageInteractionGuards(img) {
  img.draggable = false;
  img.style.userSelect = "none";
  img.style.webkitUserSelect = "none";
  img.style.webkitUserDrag = "none";
}

/**
 * Check whether an image source has already loaded in this session.
 * @param {string} src
 * @returns {boolean}
 */
export function isImageCached(src) {
  const cacheKey = imageCacheKey(src);
  return cacheKey ? cachedImageUrls.has(cacheKey) : false;
}

/**
 * Build a thumbnail container holding an image or placeholder.
 * Shared by grid cards and the detail modal.
 * @param {{ img?: string, title?: string }} card
 * @param {string} containerClass
 * @returns {string} HTML string
 */
export function thumbHtml(card, containerClass) {
  const isCached = isImageCached(card.img);
  return `<div class="${containerClass}">${imageHtml(card.img, card.title, "card-thumb-img", isCached)}</div>`;
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
  root.querySelectorAll("img").forEach((img) => applyImageInteractionGuards(img));

  root.addEventListener(
    "error",
    (e) => {
      const el = e.target;
      if (!(el instanceof HTMLImageElement)) return;
      applyImageInteractionGuards(el);
      const initial = el.dataset.fallback;
      if (initial == null || el.dataset.failed) return;

      el.dataset.failed = "1";
      const placeholder = document.createElement("span");
      placeholder.className = el.classList.contains("inc-avatar")
        ? "inc-avatar card-thumb-fallback"
        : "card-thumb-fallback";
      placeholder.textContent = initial;
      el.replaceWith(placeholder);
    },
    true,
  );

  // Fade images in once their pixels are ready. `load` does not bubble, so
  // the listener runs in the capture phase. Images that were already cached
  // (and so complete before this runs) are revealed immediately.
  // Also track the image URL so modal images can use eager loading if cached.
  root.addEventListener(
    "load",
    (e) => {
      const el = e.target;
      if (el instanceof HTMLImageElement) {
        applyImageInteractionGuards(el);
        el.classList.remove("is-loading");
        const cacheKey = imageCacheKey(el.currentSrc || el.src);
        if (cacheKey) cachedImageUrls.add(cacheKey);
        // For responsive images the loaded URL is a resized variant; also
        // record the base source so `isImageCached` recognises the portrait
        // on later renders and skips the fade.
        if (el.dataset.srcbase) {
          cachedImageUrls.add(new URL(el.dataset.srcbase, document.baseURI).href);
        }
      }
    },
    true,
  );
}
