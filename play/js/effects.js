'use strict';
// Procedural effects: the layered rainbow magic circle (fusion "layer system"), hit slashes and bursts.

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
const RAINBOW = ['#ff3b6b', '#ff9a2e', '#ffe23a', '#4dff6a', '#38e8ff', '#5a7bff', '#c45aff', '#ff3b6b'];

// An elemental layer's circle uses its element's colours instead of the rainbow (CIRCLE_TINT, set while drawing it)
let CIRCLE_TINT = null;
const tintCol = (i, hsl) => CIRCLE_TINT ? CIRCLE_TINT[((i % CIRCLE_TINT.length) + CIRCLE_TINT.length) % CIRCLE_TINT.length] : hsl;
function rainbowStyle(g, x, y, rot) {
  const cols = CIRCLE_TINT || RAINBOW;
  if (g.createConicGradient) {
    const cg = g.createConicGradient(rot, x, y);
    cols.forEach((c, i) => cg.addColorStop(i / (cols.length - 1), c));
    return cg;
  }
  return CIRCLE_TINT ? CIRCLE_TINT[0] : `hsl(${(rot * 57) % 360},100%,65%)`;
}

// Glowing stroke helper: draw path twice (wide soft glow + crisp core)
function glowStroke(g, style, w, pathFn, alpha = 1) {
  g.save();
  g.globalAlpha = alpha * 0.35; g.strokeStyle = style; g.lineWidth = w * 3.2; g.lineCap = 'round';
  g.beginPath(); pathFn(); g.stroke();
  g.globalAlpha = alpha; g.lineWidth = w;
  g.beginPath(); pathFn(); g.stroke();
  g.restore();
}

// Ground circle (layers 1-3): outer rune ring, star geometry, inner rings and nodes. (x, y) = centre on the ground.
function drawGroundCircle(g, x, y, rx, ry, t, alpha = 1) {
  const rot = t / 1400;
  const st = rainbowStyle(g, x, y, rot);
  const ell = (k) => () => g.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2);
  glowStroke(g, st, 1.4, ell(1), alpha);
  glowStroke(g, st, 0.9, ell(0.86), alpha);
  glowStroke(g, st, 1.0, ell(0.52), alpha);
  glowStroke(g, st, 0.7, ell(0.42), alpha);
  // seven-pointed star between the rings
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = rot * 0.6 + i * Math.PI * 2 / 7;
    pts.push([x + Math.cos(a) * rx * 0.84, y + Math.sin(a) * ry * 0.84]);
  }
  glowStroke(g, st, 0.8, () => {
    for (let i = 0; i < 7; i++) {
      const p = pts[i], q = pts[(i + 3) % 7];
      g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]);
    }
  }, alpha * 0.9);
  // runes around the outer band and node circles
  g.save();
  g.globalAlpha = alpha;
  g.font = `${Math.max(5, rx * 0.11)}px "Segoe UI Symbol", serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = -rot + i * Math.PI * 2 / n;
    g.fillStyle = tintCol(i, `hsl(${(i * 15 + t / 8) % 360},100%,70%)`);
    g.fillText(RUNES[i % RUNES.length], x + Math.cos(a) * rx * 0.93, y + Math.sin(a) * ry * 0.93);
  }
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    const nx = x + Math.cos(a) * rx * 0.47, ny = y + Math.sin(a) * ry * 0.47;
    g.strokeStyle = tintCol(i, `hsl(${(i * 60 + t / 6) % 360},100%,65%)`); g.lineWidth = 0.7;
    g.beginPath(); g.ellipse(nx, ny, rx * 0.06, ry * 0.06, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

// One tilted orbital ring (layer 4), centred at (x, y) with radius r; tilt = ring's rotation in the view plane,
// squash = how edge-on it is. Rune ticks run along it.
function drawOrbit(g, x, y, r, tilt, squash, t, alpha = 1, hueShift = 0) {
  g.save();
  g.translate(x, y); g.rotate(tilt);
  const st = rainbowStyle(g, 0, 0, t / 900 + hueShift);
  glowStroke(g, st, 1.3, () => g.ellipse(0, 0, r, r * squash, 0, 0, Math.PI * 2), alpha);
  glowStroke(g, st, 0.6, () => g.ellipse(0, 0, r * 0.9, r * squash * 0.9, 0, 0, Math.PI * 2), alpha * 0.8);
  g.globalAlpha = alpha;
  for (let i = 0; i < 18; i++) {
    const a = t / 500 + i * Math.PI * 2 / 18;
    const px = Math.cos(a) * r * 0.95, py = Math.sin(a) * r * squash * 0.95;
    g.fillStyle = tintCol(i, `hsl(${(i * 20 + t / 5) % 360},100%,75%)`);
    g.fillRect(px - 0.6, py - 0.6, 1.2, 1.2);
  }
  g.restore();
}

// Embers / sparks rising around a ring (deterministic from t, no state)
function drawEmbers(g, x, y, rx, ry, t, count, alpha = 1, colorful = true) {
  g.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 97.13;
    const life = 900 + (i % 7) * 120;
    const k = ((t + seed * 13) % life) / life;
    const a = seed + i;
    const px = x + Math.cos(a) * rx * (0.7 + 0.35 * Math.sin(seed)), py = y + Math.sin(a) * ry * 0.9 - k * 46;
    g.globalAlpha = alpha * (1 - k);
    g.fillStyle = colorful ? tintCol(i, `hsl(${(i * 37 + t / 6) % 360},100%,65%)`) : (CIRCLE_TINT ? CIRCLE_TINT[0] : '#ffb347');
    const s = 1.4 - k;
    g.fillRect(px - s / 2, py - s / 2, s, s);
  }
  g.restore();
}

// (named drawCircleDust: world.js drawDust, the hero's footstep puffs, used to override it, so this dust never drew)
function drawCircleDust(g, x, y, t, alpha, R = 33) {
  // the same soft cream puffs as the hero's footsteps (world.js drawDust), kicked up all round the ring's edge: each drifts a
  // little outward and up, swells and fades over 0.7 s, then starts again a little further round
  g.save(); g.fillStyle = 'rgb(236,226,206)';
  for (let i = 0; i < 12; i++) {
    const k = (t / 700 + i * 0.37) % 1, a = (i / 12 + Math.floor(t / 700 + i * 0.37) * 0.29) * Math.PI * 2;
    const ex = Math.cos(a), ey = Math.sin(a), d = R * (1.05 + k * 0.22), r = 1.4 + 2.4 * Math.sqrt(k);
    const px = Math.round(x + ex * d), py = Math.round(y + ey * d * 0.38 - k * 4);
    g.globalAlpha = alpha * 0.42 * (1 - k) * (k < 0.15 ? k / 0.15 : 1);
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(px + 1.6, py + 0.6, r * 0.6, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// The fusion cast: six steps over `dur` ms, matching the layer-system reference:
// 1 stance & embers · 2 ground circle ignites · 3 first orbit · 4 crossing orbits · 5 runic energy · 6 complete gyroscope
const CIRCLE_STEP_MS = 260;
function drawFusionCircle(g, c, phase) {
  const t = c.t, step = Math.min(6, Math.floor(t / CIRCLE_STEP_MS) + 1);
  const fadeOut = c.t > c.dur - 250 ? Math.max(0, (c.dur - c.t) / 250) : 1;
  const x = c.x, y = c.y, R = c.r || 34;
  const ramp = s => Math.min(1, Math.max(0, (t - (s - 1) * CIRCLE_STEP_MS) / CIRCLE_STEP_MS)) * fadeOut;
  CIRCLE_TINT = c.tint || null;
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (phase === 'ground') {
    // step 1: ember ring on the floor
    drawEmbers(g, x, y, R * 1.15, R * 0.42, t, 18, 0.9 * fadeOut, step >= 2);
    if (step === 1) glowStroke(g, c.tint ? c.tint[0] : '#ff8a2e', 0.8,() => g.ellipse(x, y, R * 1.1, R * 0.4, 0, 0, Math.PI * 2), 0.5 * ramp(1));
    // step 2+: the rainbow ground circle
    if (step >= 2) drawGroundCircle(g, x, y, R * 1.25, R * 0.46, t, ramp(2));
    if (step >= 2) { g.globalCompositeOperation = 'source-over'; drawCircleDust(g, x, y, t, ramp(2), R * 1.25); }
  } else {
    const cy = y - 20;
    if (step >= 2) {   // swirling ribbons rising (step 2)
      for (let k = 0; k < 2; k++) {
        const a0 = t / 300 + k * Math.PI;
        g.strokeStyle = c.tint ? c.tint[k + 1] : k ? '#38e8ff' : '#4dff6a'; g.lineWidth = 1; g.globalAlpha = 0.6 * ramp(2) * (step >= 4 ? 0.4 : 1);
        g.beginPath();
        for (let s = 0; s <= 24; s++) {
          const h = s / 24, a = a0 + h * 5;
          const px = x + Math.cos(a) * R * (0.9 - h * 0.3), py = y - h * R * 1.3 + Math.sin(a) * 4;
          s ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (step >= 3) drawOrbit(g, x, cy, R * 0.95, Math.PI / 2, 0.32, t, ramp(3), 0);                        // vertical first orbit
    if (step >= 4) { drawOrbit(g, x, cy, R * 1.05, 0.5, 0.3, t, ramp(4), 1); drawOrbit(g, x, cy, R * 1.05, -0.5, 0.3, t, ramp(4), 2); }
    if (step >= 5) { drawOrbit(g, x, cy, R * 1.2, 0.05 + Math.sin(t / 400) * 0.05, 0.26, t, ramp(5), 3); drawEmbers(g, x, cy, R, R * 0.6, t, 26, ramp(5)); }
    if (step >= 6) {
      drawOrbit(g, x, cy, R * 1.0, Math.PI / 2 + 0.4, 0.3, t, ramp(6), 4);
      // core flare
      g.globalAlpha = 0.18 * ramp(6) * (0.7 + 0.3 * Math.sin(t / 60));
      const rg = g.createRadialGradient(x, cy, 0, x, cy, R);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.4, 'rgba(255,240,180,0.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, cy, R, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
  CIRCLE_TINT = null;
}

// ---------------------------------------------------------------- hits
// Impact: a crisp slash streak across the target, a punchy 4-point flare, one shockwave ring and a soft core.
// Drawn with normal blending + coloured edges so it reads on bright sand and snow as well as dark caves.
const IMPACT_MS = 230;
function drawSlash(g, s) {
  const k = s.t / IMPACT_MS;
  if (k >= 1) return;
  const e = 1 - Math.pow(1 - k, 3);
  const big = s.big, R = big ? 26 : 17;
  const ang = Math.atan2(s.dy, s.dx);
  g.save();
  g.translate(s.x, s.y);
  // soft core (additive, brief)
  if (k < 0.45) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const c = (big ? 17 : 12) * (1 - k);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, c);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(0.5, s.col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1 - k / 0.45; g.fillStyle = rg; g.beginPath(); g.arc(0, 0, c, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // slash streak: diagonal across the target, swept in the attack direction
  if (k < 0.6) {
    const sk = k / 0.6, len = (big ? 40 : 30) *(0.6 + 0.4 * Math.min(1, sk * 3));
    g.save(); g.rotate(ang + Math.PI / 2 + 0.6 * (s.rot > 1.5 ? 1 : -1));
    const thick = (big ? 6 : 4.5) * (1 - sk);
    const off = (sk - 0.3) * 6;
    g.translate(off, 0);
    g.globalAlpha = 1 - sk * 0.7;
    g.fillStyle = s.col;
    g.beginPath(); g.moveTo(0, -len / 2); g.quadraticCurveTo(thick * 1.6, 0, 0, len / 2); g.quadraticCurveTo(thick * 0.4, 0, 0, -len / 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -len / 2 + 2); g.quadraticCurveTo(thick * 0.9, 0, 0, len / 2 - 2); g.quadraticCurveTo(thick * 0.2, 0, 0, -len / 2 + 2); g.fill();
    g.restore();
  }
  // shockwave ring
  g.globalAlpha = (1 - k) * 0.9;
  g.strokeStyle = s.col; g.lineWidth = (big ? 2.4 : 1.6) * (1 - k) + 0.5;
  g.beginPath(); g.ellipse(0, 0, R * e, R * e * 0.7, 0, 0, Math.PI * 2); g.stroke();
  // 4-point flare with dark edge
  const fk = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
  const fl = (big ? 20 : 14) * fk;
  if (fl > 0.5) {
    g.rotate(s.rot);
    g.globalAlpha = 1;
    const star = (len, wid) => { g.beginPath(); g.moveTo(0, -len); g.lineTo(wid, -wid); g.lineTo(len * 0.75, 0); g.lineTo(wid, wid); g.lineTo(0, len); g.lineTo(-wid, wid); g.lineTo(-len * 0.75, 0); g.lineTo(-wid, -wid); g.closePath(); };
    g.fillStyle = s.col; star(fl, fl * 0.2); g.fill();
    g.strokeStyle = 'rgba(60,20,0,0.35)'; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = '#ffffff'; star(fl * 0.6, fl * 0.12); g.fill();
  }
  g.restore();
}
// Spark streaks flung away from the attacker
function impactBurst(world, x, y, col, n = 8, dx = 1, dy = 0) {
  const base = Math.atan2(dy, dx);
  for (let i = 0; i < n; i++) {
    const a = base + rand(-1.1, 1.1) + (i % 4 === 0 ? Math.PI + rand(-0.6, 0.6) : 0), sp = rand(110, 240);
    world.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, t: 0, life: rand(120, 230), col: i % 3 ? col : '#ffffff', size: rand(1, 1.8), streak: true, drag: 0.92 });
  }
}
