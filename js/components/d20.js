// ---------------------------------------------------------
// Easter egg: a rollable 3D d20.
// Rendered with WebGL (see d20-mesh.js) — a real icosahedron with
// lit gold facets and engraved numbers that tumbles when rolled.
// Falls back to a static SVG silhouette if WebGL is unavailable.
//
// Trigger — identical on desktop and mobile: tap/click the footer
// three times in quick succession. Click events fire for both mouse
// and touch, so no keyboard is required.
//
// Tap the die to roll. Close with the ✕ button, Esc, or the backdrop.
// ---------------------------------------------------------

import { createD20Renderer } from "./d20-mesh.js";
import { createD20Effects } from "./d20-effects.js";

/** Taps on the footer needed to summon the die. */
const TAP_TARGET = 3;
/** Max gap (ms) allowed between taps before the count resets. */
const TAP_WINDOW = 1500;

/** Minimal SVG used only when WebGL is unavailable. */
const FALLBACK_SVG = `
<svg class="d20-svg" viewBox="0 0 200 200" aria-hidden="true">
  <polygon points="100,10 177.94,55 177.94,145 100,190 22.06,145 22.06,55"
           fill="#b5933e" stroke="#e7cd80" stroke-width="2.5" stroke-linejoin="round"/>
  <text class="d20-num" x="100" y="118" text-anchor="middle" fill="#23190a"
      font-family="var(--font-serif)" font-weight="700" font-size="64">20</text>
</svg>`;

let overlay = null;
let die = null;
let resultEl = null;
let renderer = null;
let effects = null;
let fallbackNum = null;
let rolling = false;
/** Scroll position captured while the modal locks the page. */
let scrollLockY = 0;
/** Timestamp the overlay last opened, to ignore the tap's trailing click. */
let openedAt = 0;

/** Build the overlay + die DOM once and cache references. */
function buildOverlay() {
  overlay = document.createElement("div");
  overlay.className = "d20-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Roll a d20");
  overlay.tabIndex = -1;

  const close = document.createElement("button");
  close.className = "d20-close";
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  close.addEventListener("click", closeOverlay);

  die = document.createElement("button");
  die.className = "d20";
  die.type = "button";
  die.setAttribute("aria-label", "d20 — tap to roll");
  die.addEventListener("click", roll);

  const canvas = document.createElement("canvas");
  canvas.className = "d20-canvas";
  die.appendChild(canvas);

  try {
    renderer = createD20Renderer(canvas);
  } catch (err) {
    console.warn("WebGL d20 unavailable, using fallback.", err);
    renderer = null;
  }
  if (!renderer) {
    canvas.remove();
    die.innerHTML = FALLBACK_SVG;
    fallbackNum = die.querySelector(".d20-num");
  }
  if (renderer?.isLowEnd()) {
    overlay.classList.add("low-end");
  }

  resultEl = document.createElement("div");
  resultEl.className = "d20-result";
  resultEl.setAttribute("aria-live", "polite");

  const hint = document.createElement("div");
  hint.className = "d20-hint";
  hint.textContent = "Tap the die to roll";

  overlay.append(close, die, resultEl, hint);

  // Juice layer (sparks, edge wobble, recoil, confetti). Pointer-transparent
  // canvas overlaid on the modal; safe to skip if construction fails.
  try {
    effects = createD20Effects(overlay, die, { lowEnd: !!renderer?.isLowEnd() });
    renderer?.setOnCollide((info) => effects.collide(info));
  } catch (err) {
    console.warn("d20 effects unavailable.", err);
    effects = null;
  }
  overlay.addEventListener("click", (e) => {
    // Ignore the synthesized click that follows the opening tap's
    // pointerup, which would otherwise close the modal immediately.
    if (Date.now() - openedAt < 500) return;
    if (e.target === overlay) closeOverlay();
  });
  document.body.appendChild(overlay);

  window.addEventListener("resize", () => {
    renderer?.resize();
    effects?.resize();
  });
}

/** Apply the result text + crit styling, then release the roll lock. */
function showResult(result) {
  resultEl.textContent =
    result === 20 ? "Nat 20!" : result === 1 ? "Nat 1…" : String(result);
  resultEl.className = "d20-result";
  if (result === 20) {
    resultEl.classList.add("crit-hit");
    effects?.settlePop("106,168,79", true);
    effects?.confettiBurst();
  } else if (result === 1) {
    resultEl.classList.add("crit-fail");
    effects?.settlePop("204,68,68", true);
    effects?.critFail();
  } else {
    effects?.settlePop("201,168,76");
  }
  rolling = false;
}

/** Tumble the die and reveal a 1-20 result. */
function roll() {
  if (rolling) return;
  rolling = true;

  const result = 1 + Math.floor(Math.random() * 20);
  resultEl.textContent = "";
  resultEl.className = "d20-result";

  if (renderer) {
    renderer.roll(result, () => showResult(result));
    return;
  }

  // Fallback: brief CSS tumble on the SVG, then reveal.
  die.classList.remove("rolling");
  void die.offsetWidth;
  die.classList.add("rolling");
  const settle = () => {
    if (fallbackNum) fallbackNum.textContent = String(result);
    showResult(result);
  };
  die.addEventListener("animationend", settle, { once: true });
}

/** Reveal the overlay and reset the die. */
function openOverlay() {
  if (!overlay) buildOverlay();
  rolling = false;
  openedAt = Date.now();
  resultEl.textContent = "";
  resultEl.className = "d20-result";
  if (fallbackNum) fallbackNum.textContent = "20";
  die.classList.remove("rolling");

  // Modal: lock the page behind the overlay so it can't scroll or be
  // interacted with. Fix the body in place to defeat touch scrolling.
  scrollLockY = window.scrollY;
  document.body.style.top = `-${scrollLockY}px`;
  document.body.classList.add("d20-modal-open");

  overlay.classList.add("open");
  renderer?.reset();
  renderer?.start();
  effects?.resize();
  effects?.clear();
  // Focus the dialog itself (not the die) so keyboard users get context
  // and Esc works, without showing a pointer-triggered focus ring.
  overlay.focus({ preventScroll: true });
}

/** Hide the overlay. */
function closeOverlay() {
  rolling = false;
  renderer?.stop();
  effects?.clear();
  overlay?.classList.remove("open");

  // Unlock the page and restore the prior scroll position.
  document.body.classList.remove("d20-modal-open");
  document.body.style.top = "";
  window.scrollTo(0, scrollLockY);
}

/**
 * Wire up the footer tap-counter and the Escape-to-close shortcut.
 * Call once on boot.
 */
export function installD20Egg() {
  const footer = document.querySelector(".footer");
  if (!footer) return;

  // iOS Safari ignores `touch-action: manipulation` for double-tap zoom,
  // so cancel the second `touchend` that lands within the zoom window.
  // This blocks the zoom gesture without affecting scrolling or taps.
  let lastTouchEnd = 0;
  footer.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300 && e.cancelable) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );

  let taps = 0;
  let last = 0;

  // Use Pointer Events: `pointerup` fires exactly once per tap on mouse,
  // touch and pen across all modern browsers, with no click-coalescing
  // — the thing that made `click`/`touchstart` unreliable for rapid taps.
  const onTap = (e) => {
    // Suppress the trailing `click` that browsers synthesize after `pointerup`.
    if (e?.cancelable) e.preventDefault();
    const now = Date.now();
    taps = now - last <= TAP_WINDOW ? taps + 1 : 1;
    last = now;
    if (taps >= TAP_TARGET) {
      taps = 0;
      openOverlay();
    }
  };

  if (window.PointerEvent) {
    footer.addEventListener("pointerup", onTap, { passive: false });
  } else {
    // Legacy fallback for browsers without Pointer Events.
    footer.addEventListener("touchend", onTap, { passive: false });
    footer.addEventListener("click", onTap);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay?.classList.contains("open")) closeOverlay();
  });
}
