// ---------------------------------------------------------
// Card detail modal.
// ---------------------------------------------------------

import { formatDesc } from "../core/markdown.js";
import { thumbHtml } from "../core/images.js";
import { getCard } from "../store.js";
import { escapeHtml } from "../core/html.js";
import { cardClass } from "./cards.js";

/**
 * Open the detail modal for a card. Closes any modal already open.
 * @param {string} id
 */
export function showCardModal(id) {
  const card = getCard(id);
  if (!card) return;

  closeCardModal();

  const backdrop = document.createElement("div");
  backdrop.className = "card-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-label", card.title);

  const displayTitle = escapeHtml(card.title || "");
  const displayTag = escapeHtml(card.tag || "");
  const displayFooter = escapeHtml(card.footer || "");
  const rawMetaItems = Array.isArray(card.meta)
    ? card.meta
    : (typeof card.meta === "string" ? [card.meta] : []);
  const displayMetaItems = rawMetaItems
    .map((item) => escapeHtml(String(item || "").trim()))
    .filter(Boolean);
  const displayMeta = displayMetaItems.join(" · ");

  backdrop.innerHTML =
    `<div class="card-modal">` +
    `<div class="card-modal-stripe ${cardClass(card.tag)}"><div class="card-stripe"></div></div>` +
    `<div class="card-modal-header">` +
    thumbHtml(card, "card-modal-thumb") +
    `<div>` +
    `<div class="card-modal-title">${displayTitle}</div>` +
    `<div class="card-modal-meta">${displayMeta}</div>` +
    `</div>` +
    `<button class="card-modal-close" aria-label="Close">&times;</button>` +
    `</div>` +
    `<div class="card-modal-body"><div class="rich-desc">${formatDesc(card.desc)}</div></div>` +
    `<div class="card-modal-footer ${cardClass(card.tag)}"><span>${displayFooter}</span><span class="card-tag">${displayTag}</span></div>` +
    `</div>`;

  document.body.appendChild(backdrop);
  document.body.classList.add("modal-open");

  // Close when clicking the backdrop (but not the modal body).
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeCardModal();
  });

  document.addEventListener("keydown", handleModalEscape);
}

/** Close the open card modal, if any. */
export function closeCardModal() {
  const existing = document.querySelector(".card-modal-backdrop");
  if (existing) existing.remove();
  document.body.classList.remove("modal-open");
  document.removeEventListener("keydown", handleModalEscape);
}

function handleModalEscape(e) {
  if (e.key === "Escape") closeCardModal();
}
