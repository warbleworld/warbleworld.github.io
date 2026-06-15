// ---------------------------------------------------------
// Markdown-ish rich text renderer for card descriptions.
// Supports: **bold**, *italic*, __underline__, `- item` lists,
// [label](url) links, and newlines.
// ---------------------------------------------------------

import { escapeAttr, escapeHtml } from "./html.js";

const SAFE_LINK = /^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i;

function sanitizeLinkHref(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed || !SAFE_LINK.test(trimmed)) return "#";
  return trimmed;
}

/**
 * Parse `[label](url)` links, tolerating nested parentheses in the URL.
 * Operates on already HTML-escaped text.
 * @param {string} html
 * @returns {string}
 */
function parseLinks(html) {
  let parsed = "";
  let idx = 0;

  while (idx < html.length) {
    const start = html.indexOf("[", idx);
    if (start === -1) {
      parsed += html.slice(idx);
      break;
    }

    const endLabel = html.indexOf("]", start + 1);
    if (endLabel === -1 || html[endLabel + 1] !== "(") {
      parsed += html.slice(idx, start + 1);
      idx = start + 1;
      continue;
    }

    const label = html.slice(start + 1, endLabel);
    let cursor = endLabel + 2;
    let depth = 0;
    while (cursor < html.length) {
      const ch = html[cursor];
      if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) break;
        depth--;
      }
      cursor++;
    }

    if (cursor >= html.length) {
      parsed += html.slice(idx);
      break;
    }

    const url = sanitizeLinkHref(html.slice(endLabel + 2, cursor));
    parsed +=
      html.slice(idx, start) +
      `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    idx = cursor + 1;
  }

  return parsed;
}

/**
 * Convert a raw card description into safe HTML.
 * @param {string} raw
 * @returns {string}
 */
export function formatDesc(raw) {
  if (!raw) return "";

  let html = escapeHtml(raw);

  // Underline before bold so nesting like **__x__** resolves correctly.
  html = html.replace(/__(.+?)__/g, "<u>$1</u>");
  html = parseLinks(html);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^- (.+)$/gm, '<span class="desc-li">• $1</span>');
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");

  return "<p>" + html + "</p>";
}
