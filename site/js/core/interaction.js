// ---------------------------------------------------------
// Low-level interaction primitives: a viewport breakpoint check
// and a touch/click guard that prevents double-fire on mobile and
// ignores long-press releases.
// ---------------------------------------------------------

let _pointerDownTime = 0;
let _lastHandledClick = 0;
let _suppressNextClick = false;
const LONG_PRESS_MS = 400;
const DEBOUNCE_MS = 80;

/** Returns true if the click should be ignored (long-press or duplicate). */
export function shouldIgnoreClick() {
  const now = Date.now();
  if (now - _lastHandledClick < DEBOUNCE_MS) return true;
  // Long-press releases are flagged at pointerup so the decision is based on a
  // live timestamp. Synthetic clicks (e.g. keyboard-driven `el.click()`) carry
  // no pointer event, so they correctly fall through here.
  if (_suppressNextClick) {
    _suppressNextClick = false;
    return true;
  }
  _lastHandledClick = now;
  return false;
}

/** True when the viewport is at the mobile breakpoint. */
export function isMobile() {
  return window.matchMedia("(max-width: 600px)").matches;
}

/** Attach the pointer-timing listeners that back `shouldIgnoreClick`. */
export function installInteractionGuards() {
  document.addEventListener("pointerdown", () => {
    _pointerDownTime = Date.now();
    _suppressNextClick = false;
  }, true);
  const endPointer = () => {
    if (_pointerDownTime && Date.now() - _pointerDownTime > LONG_PRESS_MS) {
      _suppressNextClick = true;
    }
    _pointerDownTime = 0;
  };
  document.addEventListener("pointerup", endPointer, true);
  document.addEventListener("pointercancel", endPointer, true);
}
