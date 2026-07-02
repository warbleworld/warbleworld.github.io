// ---------------------------------------------------------
// HTML escaping helpers
// Shared by every module that interpolates data into markup.
// ---------------------------------------------------------

/**
 * Escape the characters that are unsafe inside HTML text nodes.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape a value for use inside a double-quoted HTML attribute.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
