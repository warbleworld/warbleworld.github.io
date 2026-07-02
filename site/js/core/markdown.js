// ---------------------------------------------------------
// Markdown-ish rich text renderer for card descriptions.
// Supports: **bold**, *italic*, __underline__, `- item` lists,
// `::center:: text` centered lines,
// [label](url) links, markdown tables, and newlines.
// ---------------------------------------------------------

import { escapeAttr, escapeHtml } from "./html.js";

const SAFE_LINK = /^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i;

function applyInlineMarkup(html) {
  let out = html;
  // Underline before bold so nesting like **__x__** resolves correctly.
  out = out.replace(/__(.+?)__/g, "<u>$1</u>");
  out = parseLinks(out);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return out;
}

function splitTableRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.includes("|")) return null;

  let row = trimmed;
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);

  const cells = [];
  let current = "";

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === "\\") {
      const next = row[i + 1];
      if (next === "|") {
        current += "|";
        i++;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function parseAlignment(separatorCell) {
  const cell = String(separatorCell || "").trim();
  const starts = cell.startsWith(":");
  const ends = cell.endsWith(":");
  if (starts && ends) return "center";
  if (ends) return "right";
  return "left";
}

function isSeparatorCell(cell) {
  return /^:?-{3,}:?$/.test(String(cell || "").trim());
}

function buildTableHtml(headerCells, alignments, bodyRows) {
  let out = '<div class="desc-table-wrap"><table class="desc-table"><thead><tr>';

  for (let i = 0; i < headerCells.length; i++) {
    const align = alignments[i] || "left";
    const cls = align === "left" ? "" : ` class="desc-table-${align}"`;
    out += `<th${cls}>${applyInlineMarkup(headerCells[i])}</th>`;
  }

  out += "</tr></thead>";

  if (bodyRows.length) {
    out += "<tbody>";
    for (const row of bodyRows) {
      out += "<tr>";
      for (let i = 0; i < row.length; i++) {
        const align = alignments[i] || "left";
        const cls = align === "left" ? "" : ` class="desc-table-${align}"`;
        out += `<td${cls}>${applyInlineMarkup(row[i])}</td>`;
      }
      out += "</tr>";
    }
    out += "</tbody>";
  }

  out += "</table></div>";
  return out;
}

function parseTables(html) {
  const lines = String(html || "").split("\n");
  const outLines = [];
  const tables = [];

  let i = 0;
  while (i < lines.length) {
    const headerCells = splitTableRow(lines[i]);
    const separatorCells = i + 1 < lines.length ? splitTableRow(lines[i + 1]) : null;

    const isTable =
      headerCells &&
      separatorCells &&
      headerCells.length > 0 &&
      headerCells.length === separatorCells.length &&
      separatorCells.every(isSeparatorCell);

    if (!isTable) {
      outLines.push(lines[i]);
      i++;
      continue;
    }

    const alignments = separatorCells.map(parseAlignment);
    const bodyRows = [];

    let cursor = i + 2;
    while (cursor < lines.length) {
      const rowCells = splitTableRow(lines[cursor]);
      if (!rowCells || rowCells.length !== headerCells.length) break;
      bodyRows.push(rowCells);
      cursor++;
    }

    const token = `@@TABLE_${tables.length}@@`;
    tables.push({ token, html: buildTableHtml(headerCells, alignments, bodyRows) });
    outLines.push(token);
    i = cursor;
  }

  return { html: outLines.join("\n"), tables };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function restoreTables(html, tables) {
  let out = html;

  for (const table of tables) {
    const tokenPattern = escapeRegExp(table.token);
    out = out.replace(new RegExp(`<p>\\s*${tokenPattern}\\s*<\\/p>`, "g"), () => table.html);
    out = out.replace(new RegExp(tokenPattern, "g"), () => table.html);
  }

  return out;
}

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
  const tableResult = parseTables(html);
  html = tableResult.html;

  html = applyInlineMarkup(html);
  html = html.replace(/^(?:-|\*)\s+(.+)$/gm, '<span class="desc-li">$1</span>');
  html = html.replace(/^::center::\s*(.+)$/gm, '<span class="desc-center">$1</span>');
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/(<span class="desc-li">[\s\S]*?<\/span>)<br>/g, "$1");
  html = html.replace(/(<span class="desc-center">[\s\S]*?<\/span>)<br>/g, "$1");
  html = restoreTables(html, tableResult.tables);

  return "<p>" + html + "</p>";
}
