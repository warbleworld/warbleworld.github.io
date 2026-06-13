// ─────────────────────────────────────────────────────────
// Card detail modal.
// ─────────────────────────────────────────────────────────

import { formatDesc } from "../core/markdown.js";
import { thumbHtml } from "../core/images.js";
import { getCard } from "../store.js";
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

  backdrop.innerHTML =
    `<div class="card-modal">` +
    `<div class="card-modal-stripe ${cardClass(card.tag)}"><div class="card-stripe"></div></div>` +
    `<div class="card-modal-header">` +
    thumbHtml(card, "card-modal-thumb") +
    `<div>` +
    `<div class="card-modal-title">${card.title}</div>` +
    `<div class="card-modal-meta">${card.tag}${card.footer ? " · " + card.footer : ""}</div>` +
    `</div>` +
    `<button class="card-modal-close" aria-label="Close">&times;</button>` +
    `</div>` +
    `<div class="card-modal-body"><div class="rich-desc">${formatDesc(card.desc)}</div></div>` +
    `<div class="card-modal-footer ${cardClass(card.tag)}"><span>${card.footer || ""}</span><span class="card-tag">${card.tag}</span></div>` +
    `</div>`;

  document.body.appendChild(backdrop);

  // Close when clicking the backdrop (but not the modal body).
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeCardModal();
  });

  document.addEventListener("keydown", handleModalEscape);
}

/** Close the open card modal, if any. */
export function closeCardModal() {
  const existing = document.querySelector(".card-modal-backdrop");
  if (existing) existing.remove();
  document.removeEventListener("keydown", handleModalEscape);
}

function handleModalEscape(event) {
  if (event.key === "Escape") closeCardModal();
}
