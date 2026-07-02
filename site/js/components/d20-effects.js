// ---------------------------------------------------------
// Juice layer for the d20 easter egg.
//
// A single 2D canvas overlaid on the modal drives every reactive
// effect: wall-collision sparks + an elastic edge "wobble" on the
// struck side (with rounded-corner falloff), a spring recoil/shake +
// settle pop on the die element itself, nat-20 confetti and a nat-1
// ash/flash punish.
//
// One requestAnimationFrame loop runs only while something is alive,
// so the canvas costs nothing at rest. Everything works in CSS pixels;
// the backing store is scaled by devicePixelRatio once per resize.
// ---------------------------------------------------------

const CONFETTI_COLORS = ["#ffd447", "#ff5e5e", "#5ec8ff", "#7cfc6b", "#ff8ad8", "#fff2a8", "#c9a84c"];
const ASH_COLORS = ["#2a2622", "#3c3733", "#54504a", "#1c1916"];
const EMBER_COLORS = ["#ff7a2a", "#ff9d3d", "#e24a1a"];

/** Corner radius of the die element, in CSS px (matches .d20 border-radius). */
const DIE_RADIUS = 14;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * @param {HTMLElement} overlay  the .d20-overlay container
 * @param {HTMLElement} dieEl    the .d20 button (gets the recoil transform)
 * @param {{ lowEnd?: boolean }} [opts]
 */
export function createD20Effects(overlay, dieEl, opts = {}) {
  const lowEnd = !!opts.lowEnd;

  const canvas = document.createElement("canvas");
  canvas.className = "d20-fx";
  overlay.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let dpr = 1;
  let W = 0;
  let H = 0;
  let dieRect = null;

  let running = false;
  let rafId = 0;
  let lastNow = 0;

  // Effect pools.
  const sparks = [];
  const confetti = [];
  const ash = [];
  const wobbles = [];
  let flash = null; // { t0, dur }
  let pulse = null; // { t0, dur, color }

  // Die spring state (recoil translate + settle scale), in CSS px / unit.
  let shx = 0, shy = 0, shvx = 0, shvy = 0;
  let scl = 1, sclv = 0;
  const cap = lowEnd ? 1 : 2;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measure();
  }

  /** Cache the die's bounds relative to the fx canvas, in layout coordinates. */
  function measure() {
    // offset* rather than getBoundingClientRect: the die and the promoted
    // canvas layer must be read in the same frame, but on iOS Safari their
    // client rects can sit in different ones, shifting every effect off the
    // die by a constant amount. offset* is also transform-agnostic, so the
    // recoil spring on the die never skews the measurement.
    dieRect = {
      l: dieEl.offsetLeft - canvas.offsetLeft,
      t: dieEl.offsetTop - canvas.offsetTop,
      w: dieEl.offsetWidth,
      h: dieEl.offsetHeight,
    };
  }

  function ensureRunning() {
    if (running) return;
    running = true;
    lastNow = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  // ---- Edge geometry -------------------------------------------------
  // Returns the straight span of an edge plus its outward normal so both
  // sparks and the wobble can share one source of truth.
  function edgeGeom(edge) {
    const { l, t, w, h } = dieRect;
    const R = DIE_RADIUS;
    switch (edge) {
      case "right":
        return { sx: l + w, sy: t + R, tx: 0, ty: 1, len: h - 2 * R, nx: 1, ny: 0 };
      case "left":
        return { sx: l, sy: t + R, tx: 0, ty: 1, len: h - 2 * R, nx: -1, ny: 0 };
      case "top":
        return { sx: l + R, sy: t, tx: 1, ty: 0, len: w - 2 * R, nx: 0, ny: -1 };
      default: // bottom
        return { sx: l + R, sy: t + h, tx: 1, ty: 0, len: w - 2 * R, nx: 0, ny: 1 };
    }
  }

  // ---- Public effect triggers ---------------------------------------

  /** A wall hit: spray sparks, ripple the struck edge, recoil the die. */
  function collide(info) {
    if (!dieRect) measure();
    const { edge, fracX, fracY, strength } = info;
    const s = clamp(strength, 0, 1);
    const g = edgeGeom(edge);

    // Impact point along the straight edge span.
    const px = dieRect.l + fracX * dieRect.w;
    const py = dieRect.t + fracY * dieRect.h;
    const alongRaw = g.tx !== 0 ? px - g.sx : py - g.sy;
    const along = clamp(alongRaw, 0, g.len);
    const ix = g.sx + g.tx * along;
    const iy = g.sy + g.ty * along;

    // Sparks fly back into the arena (inward normal) with a spread.
    const inx = -g.nx;
    const iny = -g.ny;
    const baseAng = Math.atan2(iny, inx);
    const n = (lowEnd ? 4 : 7) + Math.floor(s * (lowEnd ? 5 : 11));
    for (let i = 0; i < n; i++) {
      const ang = baseAng + (Math.random() - 0.5) * 2.4;
      const spd = (120 + Math.random() * 320) * (0.45 + s);
      sparks.push({
        x: ix + g.nx * 2,
        y: iy + g.ny * 2,
        vx: Math.cos(ang) * spd + g.tx * (Math.random() - 0.5) * 180,
        vy: Math.sin(ang) * spd + g.ty * (Math.random() - 0.5) * 180,
        life: 0.28 + Math.random() * 0.4,
        age: 0,
        size: 1 + Math.random() * 1.8,
        hot: Math.random() < 0.5,
      });
    }

    wobbles.push({
      // Geometry (base points + outward normals + spatial envelope) is
      // baked once here; the frame loop only scales it by amplitude.
      ...buildWobblePoints(g, along),
      // Positive displacement follows the outward normal, so the struck
      // side always bulges away from the die first.
      amp: 5 + 17 * s,
      omega: Math.PI * 2 * 7,
      tau: 0.11,
      t0: performance.now(),
      dur: 520,
    });
    // Spring recoil away from the wall + a little stochastic jitter.
    const kick = 60 + 220 * s;
    shvx += inx * kick + (Math.random() - 0.5) * 40;
    shvy += iny * kick + (Math.random() - 0.5) * 40;

    ensureRunning();
  }

  /** Nat 20 — burst of confetti from the die that flutters to the floor. */
  function confettiBurst() {
    if (!dieRect) measure();
    const cx = dieRect.l + dieRect.w / 2;
    const cy = dieRect.t + dieRect.h / 2;
    const n = lowEnd ? 70 : 130;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const spd = 260 + Math.random() * 520;
      confetti.push({
        x: cx + (Math.random() - 0.5) * dieRect.w * 0.5,
        y: cy + (Math.random() - 0.5) * dieRect.h * 0.3,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        flut: Math.random() * Math.PI * 2,
        flutSpd: 6 + Math.random() * 6,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        age: 0,
        life: 2.2 + Math.random() * 1.6,
      });
    }
    pulse = { t0: performance.now(), dur: 460, color: "106,168,79" };
    sclv += 7;
    ensureRunning();
  }

  /** Nat 1 — red flash, violent shake, raining ash + a few embers. */
  function critFail() {
    if (!dieRect) measure();
    flash = { t0: performance.now(), dur: 520 };
    pulse = { t0: performance.now(), dur: 460, color: "204,68,68" };

    const ang = Math.random() * Math.PI * 2;
    shvx += Math.cos(ang) * 360;
    shvy += Math.sin(ang) * 360;

    const cx = dieRect.l + dieRect.w / 2;
    const cy = dieRect.t + dieRect.h / 2;
    const n = lowEnd ? 26 : 46;
    for (let i = 0; i < n; i++) {
      const ember = Math.random() < 0.22;
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 160;
      ash.push({
        x: cx + (Math.random() - 0.5) * dieRect.w * 0.55,
        y: cy + (Math.random() - 0.5) * dieRect.h * 0.55,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 60,
        size: ember ? 1.5 + Math.random() * 2 : 2 + Math.random() * 4,
        flut: Math.random() * Math.PI * 2,
        flutSpd: 1.5 + Math.random() * 2.5,
        age: 0,
        life: 1.4 + Math.random() * 1.6,
        ember,
        color: ember
          ? EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0]
          : ASH_COLORS[(Math.random() * ASH_COLORS.length) | 0],
      });
    }
    ensureRunning();
  }

  /** Border pulse on settle; pass scale=true for the crit scale pop too. */
  function settlePop(color, scale) {
    if (!dieRect) measure();
    if (scale) {
      scl = 1.14;
      sclv = 0;
    }
    if (color) pulse = { t0: performance.now(), dur: 420, color };
    ensureRunning();
  }

  // ---- Per-frame update + draw --------------------------------------

  function frame() {
    const now = performance.now();
    const dt = Math.min(1 / 30, (now - lastNow) / 1000);
    lastNow = now;

    ctx.clearRect(0, 0, W, H);

    let alive = false;

    // Die recoil spring (translate) + settle spring (scale).
    {
      const kx = 260, cx = 24;
      shvx += (-kx * shx - cx * shvx) * dt;
      shvy += (-kx * shy - cx * shvy) * dt;
      shx += shvx * dt;
      shy += shvy * dt;
      const ks = 200, cs = 20;
      sclv += (-ks * (scl - 1) - cs * sclv) * dt;
      scl += sclv * dt;
      const moving =
        Math.abs(shx) > 0.04 || Math.abs(shy) > 0.04 ||
        Math.abs(shvx) > 0.04 || Math.abs(shvy) > 0.04 ||
        Math.abs(scl - 1) > 0.002 || Math.abs(sclv) > 0.002;
      if (moving) {
        dieEl.style.transform = `translate(${shx.toFixed(2)}px, ${shy.toFixed(2)}px) scale(${scl.toFixed(4)})`;
        alive = true;
      } else if (dieEl.style.transform) {
        shx = shy = shvx = shvy = 0;
        scl = 1;
        sclv = 0;
        dieEl.style.transform = "";
      }
    }

    // Full-screen red flash (nat 1).
    if (flash) {
      const k = (now - flash.t0) / flash.dur;
      if (k >= 1) flash = null;
      else {
        const a = (1 - k) * 0.5;
        const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
        grad.addColorStop(0, `rgba(150,0,0,0)`);
        grad.addColorStop(1, `rgba(170,10,10,${a})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        alive = true;
      }
    }

    // Border glow pulse (settle / crit).
    if (pulse && dieRect) {
      const k = (now - pulse.t0) / pulse.dur;
      if (k >= 1) pulse = null;
      else {
        const a = Math.sin(Math.PI * k) * 0.9;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${pulse.color},${a.toFixed(3)})`;
        ctx.lineWidth = 3 + 5 * (1 - k);
        if (!lowEnd) {
          ctx.shadowColor = `rgba(${pulse.color},${a.toFixed(3)})`;
          ctx.shadowBlur = 18;
        }
        roundRectPath(ctx, dieRect.l, dieRect.t, dieRect.w, dieRect.h, DIE_RADIUS);
        ctx.stroke();
        ctx.restore();
        alive = true;
      }
    }

    // Edge wobbles (struck side ripples). Drawn source-over so overlapping
    // wobbles never compound brightness on a shared corner.
    ctx.save();
    for (let i = wobbles.length - 1; i >= 0; i--) {
      if (!drawWobble(wobbles[i], now)) wobbles.splice(i, 1);
      else alive = true;
    }
    ctx.restore();

    // Sparks (additive).
    if (sparks.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.age += dt;
        if (p.age >= p.life) {
          sparks.splice(i, 1);
          continue;
        }
        p.vy += 620 * dt;
        p.vx *= 1 - 1.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = 1 - p.age / p.life;
        ctx.fillStyle = p.hot
          ? `rgba(255,255,235,${a.toFixed(3)})`
          : `rgba(255,205,120,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (sparks.length) alive = true;
    }

    // Ash + embers (nat 1).
    if (ash.length) {
      ctx.save();
      for (let i = ash.length - 1; i >= 0; i--) {
        const p = ash[i];
        p.age += dt;
        if (p.age >= p.life) {
          ash.splice(i, 1);
          continue;
        }
        p.flut += p.flutSpd * dt;
        p.vy += 90 * dt;
        p.vx += Math.sin(p.flut) * 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = 1 - p.age / p.life;
        if (p.ember) {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = hexA(p.color, a);
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = hexA(p.color, a * 0.85);
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (ash.length) alive = true;
    }

    // Confetti (nat 20).
    if (confetti.length) {
      ctx.save();
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.age += dt;
        if (p.age >= p.life || p.y > H + 30) {
          confetti.splice(i, 1);
          continue;
        }
        p.flut += p.flutSpd * dt;
        p.vy += 480 * dt;
        p.vy = Math.min(p.vy, 320);
        p.x += (p.vx + Math.sin(p.flut) * 60) * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 0.8 * dt;
        p.rot += p.vr * dt;
        const a = clamp((p.life - p.age) / 0.6, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const sw = p.w * (0.4 + 0.6 * Math.abs(Math.cos(p.flut)));
        ctx.fillRect(-sw / 2, -p.h / 2, sw, p.h);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (confetti.length) alive = true;
    }

    if (alive) {
      rafId = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  // Build the deformable outline for a struck edge, walking around its two
  // rounded corners: start-corner arc -> straight span -> end-corner arc.
  // Each sample carries its base point, outward normal and a precomputed
  // envelope (gaussian ripple along the edge x smoothstep corner falloff),
  // so the ripple wraps smoothly onto the corners and dies out toward the
  // neighbouring edges.
  function buildWobblePoints(g, along) {
    const R = DIE_RADIUS;
    const Tx = g.tx, Ty = g.ty, Nx = g.nx, Ny = g.ny;
    const angN = Math.atan2(Ny, Nx);
    const angNegT = Math.atan2(-Ty, -Tx);
    const angPosT = Math.atan2(Ty, Tx);
    const p0x = g.sx, p0y = g.sy;
    const p1x = g.sx + Tx * g.len, p1y = g.sy + Ty * g.len;
    const csx = p0x - R * Nx, csy = p0y - R * Ny; // start-corner centre
    const cex = p1x - R * Nx, cey = p1y - R * Ny; // end-corner centre
    const sigma = Math.max(18, g.len * 0.16);
    const wavelength = Math.max(16, g.len * 0.11);
    const CN = lowEnd ? 4 : 7;
    const SN = lowEnd ? 16 : 28;
    const pts = [];

    // Start corner: a 0 (neighbouring edge) -> 1 (straight span start).
    for (let i = 0; i < CN; i++) {
      const a = i / CN;
      const ang = lerpAngle(angNegT, angN, a);
      const nx = Math.cos(ang), ny = Math.sin(ang);
      pts.push({ x: csx + R * nx, y: csy + R * ny, nx, ny, corner: smoothstep(a) });
    }
    // Straight span.
    const straightStart = pts.length;
    for (let i = 0; i <= SN; i++) {
      const d = (i / SN) * g.len;
      pts.push({ x: g.sx + Tx * d, y: g.sy + Ty * d, nx: Nx, ny: Ny, corner: 1 });
    }
    // End corner: a 1 (straight span end) -> 0 (neighbouring edge).
    for (let i = 1; i <= CN; i++) {
      const a = 1 - i / CN;
      const ang = lerpAngle(angPosT, angN, a);
      const nx = Math.cos(ang), ny = Math.sin(ang);
      pts.push({ x: cex + R * nx, y: cey + R * ny, nx, ny, corner: smoothstep(a) });
    }

    // Cumulative arc length, then the gaussian ripple envelope about impact.
    pts[0].arc = 0;
    for (let i = 1; i < pts.length; i++) {
      pts[i].arc = pts[i - 1].arc + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    const impactArc = pts[straightStart].arc + along;
    for (const p of pts) {
      const sd = Math.abs(p.arc - impactArc);
      p.env = Math.exp(-(sd * sd) / (2 * sigma * sigma)) * Math.cos(sd / wavelength) * p.corner;
    }

    // Gradient run (start tangent -> end tangent) + fade fraction, used to
    // soften both free ends of the stroke so they don't terminate hard.
    const a0 = pts[0];
    const a1 = pts[pts.length - 1];
    const chord = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1;
    const fade = Math.min(0.45, Math.max(R * 2, chord * 0.06) / chord);
    return { points: pts, gx0: a0.x, gy0: a0.y, gx1: a1.x, gy1: a1.y, fade };
  }

  function drawWobble(w, now) {
    const age = now - w.t0;
    const k = age / w.dur;
    if (k >= 1) return false;
    const tSec = age / 1000;
    const ampT = w.amp * Math.exp(-tSec / w.tau) * Math.cos(w.omega * tSec);
    const peak = ((1 - k) * 0.85).toFixed(3);
    const pts = w.points;

    // Alpha gradient that fades to zero at both free ends (no hard tip),
    // full in the middle. One solid stroke = no self-overlap brightening.
    const grad = ctx.createLinearGradient(w.gx0, w.gy0, w.gx1, w.gy1);
    grad.addColorStop(0, "rgba(231,205,128,0)");
    grad.addColorStop(w.fade, `rgba(231,205,128,${peak})`);
    grad.addColorStop(1 - w.fade, `rgba(231,205,128,${peak})`);
    grad.addColorStop(1, "rgba(231,205,128,0)");

    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const disp = ampT * p.env;
      const x = p.x + p.nx * disp;
      const y = p.y + p.ny * disp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (!lowEnd) {
      ctx.shadowColor = "rgba(231,205,128,0.9)";
      ctx.shadowBlur = 12;
    }
    ctx.stroke();
    if (!lowEnd) ctx.shadowBlur = 0;
    return true;
  }

  function clear() {
    sparks.length = 0;
    confetti.length = 0;
    ash.length = 0;
    wobbles.length = 0;
    flash = null;
    pulse = null;
    shx = shy = shvx = shvy = 0;
    scl = 1;
    sclv = 0;
    dieEl.style.transform = "";
    ctx.clearRect(0, 0, W, H);
    cancelAnimationFrame(rafId);
    running = false;
  }

  resize();

  return { collide, confettiBurst, critFail, settlePop, resize, measure, clear };
}

const smoothstep = (t) => t * t * (3 - 2 * t);

/** Shortest-arc angle interpolation (endpoints are a quarter-turn apart). */
function lerpAngle(a0, a1, t) {
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a0 + d * t;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
