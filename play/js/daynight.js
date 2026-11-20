'use strict';
// Day and night. A full day is 12 minutes of play (kept on the profile as pr.clock, so it carries on after saving):
// day 06:00–19:12, dusk until 21:36, night until 04:05, then dawn. At night (nightK → 1) the Wilds turn dangerous and
// rich: monsters hit 30% harder and take 25% less damage, they appear twice as fast and in twice the numbers, black
// holes tear open twice as often, and drops (cards, gear, goods, meat) are 60% more likely, gold +30%. The world
// darkens to a deep blue with lamp posts and the hero carrying their own small pool of light.

const DAY = { len: 720000, dusk: 0.55, night: 0.65, dawn: 0.92, start: 0.08 };
const NIGHT = { dmg: 0.3, guard: 0.25, spawn: 2, pop: 2, holes: 2, drops: 1.6, gold: 1.3 };
function dayPhase(pr) { return ((pr && pr.clock != null ? pr.clock : DAY.start * DAY.len) / DAY.len) % 1; }
// 0 by day, 1 at night, easing through dusk and dawn
function nightK(pr) {
  const f = dayPhase(pr);
  if (f < DAY.dusk) return 0;
  if (f < DAY.night) return (f - DAY.dusk) / (DAY.night - DAY.dusk);
  if (f < DAY.dawn) return 1;
  return 1 - (f - DAY.dawn) / (1 - DAY.dawn);
}
const isNight = pr => nightK(pr) > 0.5;
const nightNow = () => window.GAME && GAME.profile ? nightK(GAME.profile) : 0;
// how much a night bonus applies right now: 1 by day, `full` at the dead of night
const nightMul = full => 1 + (full - 1) * nightNow();
function clockText(pr) {
  const h = (dayPhase(pr) * 24 + 6) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function dayTick(game, w, dt) {
  const pr = game.profile; if (!pr) return;
  if (pr.clock == null) pr.clock = DAY.start * DAY.len;
  const was = isNight(pr);
  if (pr.clock + dt >= DAY.len) pr.day = (pr.day || 0) + 1;   // a new day (the rent counts these)
  pr.clock = (pr.clock + dt) % DAY.len;
  const now = isNight(pr);
  if (now && !was) game.toast('Night falls — monsters grow stronger and bolder, but they carry more loot', '#9fb8ff');
  if (!now && was) game.toast('Dawn breaks — the Wilds grow calmer', '#ffe9a8');
}
// the darkness: a blue veil over the world with soft holes of light around the hero and every lit lamp; a warm
// glow at dusk and dawn
const DARK = document.createElement('canvas');
function drawDayNight(w, cam, now) {
  if (!w || w.interior || w.cave) return;
  const pr = GAME.profile, k = nightK(pr), f = dayPhase(pr);
  const warm = f > DAY.dusk - 0.04 && f < DAY.night + 0.02 ? 1 - Math.abs((f - (DAY.dusk + DAY.night) / 2) / 0.07) : f > DAY.dawn - 0.02 ? 1 - Math.abs((f - (DAY.dawn + 1) / 2) / 0.05) : 0;
  if (warm > 0) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,140,60,${0.45 * Math.min(1, warm)})`; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
  if (k <= 0.01) return;
  if (DARK.width !== VW * RES) { DARK.width = VW * RES; DARK.height = VH * RES; }
  const g = DARK.getContext('2d'); g.setTransform(RES, 0, 0, RES, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, VW, VH);
  g.fillStyle = `rgba(10,16,52,${0.62 * k})`; g.fillRect(0, 0, VW, VH);
  g.globalCompositeOperation = 'destination-out';
  const Z = w.zoom || ZOOM, hole = (wx, wy, r, a) => {
    const x = (wx - cam.x) * Z, y = (wy - cam.y) * Z; if (x < -r || y < -r || x > VW + r || y > VH + r) return;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(0,0,0,${a})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  const p = w.player; hole(p.x, p.y - 14, 70 * Z / 1.5, 0.85);
  const lamps = (w.objects || []).filter(o => o.bank === '006' && o.fi !== 1);
  for (const o of lamps) hole(o.x, o.bottom - 40, 55 * Z / 1.5, 0.9);
  if (typeof campSpots === 'function') for (const S of campSpots()) hole(S.fire.x, S.fire.y - 6, 60 * Z / 1.5, 0.9);   // every town's campfire
  ctx.drawImage(DARK, 0, 0, VW, VH);
  // the lamps' own warm glow
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const o of lamps) {
    const x = (o.x - cam.x) * Z, y = (o.bottom - 40 - cam.y) * Z; if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) continue;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 26 * Z / 1.5); rg.addColorStop(0, `rgba(255,220,140,${0.45 * k})`); rg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 26 * Z / 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// the day/night sky under the area name, in pixel art: a wide window onto the sky of the hour — colours through dawn, day,
// sunset and night; the sun arcing across with its glow (orange near the horizon), a crescent moon by night; clouds
// drifting by day, stars twinkling and now and then a shooting star by night; two layers of hills with pines, and
// fireflies at dusk — in a gold frame, with the time and phase on a plaque hung from its foot and, at night, a ribbon
// with what night means
const PHASES = [
  { name: 'DAWN', from: DAY.dawn - 1, to: 0.06, col: '#ffc08a', sky: ['#6a7ad8', '#ffb07a'] },
  { name: 'DAY', from: 0.06, to: DAY.dusk, col: '#ffe08a', sky: ['#4aa8f0', '#bfe8ff'] },
  { name: 'DUSK', from: DAY.dusk, to: DAY.night, col: '#ff9a6a', sky: ['#5a3a8a', '#ff8a5a'] },
  { name: 'NIGHT', from: DAY.night, to: DAY.dawn, col: '#a8b8ff', sky: ['#070b26', '#1e2a64'] },
];
function dayPhaseInfo(pr) {
  const f = dayPhase(pr), ff = f >= DAY.dawn ? f - 1 : f;
  const P = PHASES.find(p => ff >= p.from && ff < p.to) || PHASES[1];
  return { P, f, ff, k: (ff - P.from) / (P.to - P.from) };
}
const SKY_KEYS = [   // [phase (from dawn's start), sky top, horizon]
  [-0.08, '#1a1a4a', '#e07a6a'], [0.02, '#6aa0e8', '#ffd0a0'], [0.1, '#3a98f0', '#bfe8ff'], [0.5, '#3a98f0', '#bfe8ff'],
  [0.57, '#4a3a8a', '#ff8a5a'], [0.64, '#141a4a', '#3a2a6a'], [0.7, '#060a24', '#16204a'], [0.88, '#060a24', '#16204a'], [0.92, '#1a1a4a', '#e07a6a'],
];
function skyAt(ff) {
  for (let i = 1; i < SKY_KEYS.length; i++) { const [f1, t1, b1] = SKY_KEYS[i], [f0, t0, b0] = SKY_KEYS[i - 1];
    if (ff <= f1) { const k = (ff - f0) / (f1 - f0); return [mixCol(t0, t1, k), mixCol(b0, b1, k)]; } }
  return [SKY_KEYS[0][1], SKY_KEYS[0][2]];
}
// The sky is painted as pixel art: one canvas pixel per game pixel, square blocks only (no smooth gradients or soft
// circles), then drawn up without smoothing so it sits with the game's sprites.
const SKY = { W: 120, H: 24, hz: 16, repaint: 100 };
const SKYC = document.createElement('canvas'); SKYC.width = SKY.W; SKYC.height = SKY.H;
const CLOUD = ['  ####    ', ' ######## ', '##########', ' ######## '];
const PINE = [1, 1, 3, 3, 5, 5, 7];
const DISC = [[-1, 1], [-2, 2], [-3, 3], [-3, 3], [-3, 3], [-2, 2], [-1, 1]];   // a radius-3 pixel disc, row by row
function paintSky(g, ff, nk, P, now) {
  const { W, H, hz } = SKY, [top, bot] = skyAt(ff), dusky = P.name === 'DUSK' || P.name === 'DAWN';
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
  // banded sky, dithered where the bands meet
  const bands = 6, bh = hz / bands;
  for (let b = 0; b < bands; b++) {
    const c = mixCol(top, bot, b / (bands - 1)); g.fillStyle = c; g.fillRect(0, Math.round(b * bh), W, Math.ceil(bh) + 1);
    if (b < bands - 1) { const c2 = mixCol(top, bot, (b + 1) / (bands - 1)), y = Math.round((b + 1) * bh) - 1; g.fillStyle = c2; for (let x = (y & 1); x < W; x += 2) g.fillRect(x, y, 1, 1); }
  }
  // stars, one twinkling at a time, and now and then a shooting star
  if (nk > 0.2) {
    for (let i = 0; i < 22; i++) { const sx = (i * 37 + 5) % W, sy = (i * 11 + 2) % (hz - 3); if (Math.sin(now / (500 + i * 37) + i) < -0.6) continue;
      px(sx, sy, i % 5 ? '#ffffff' : '#ffe8a0'); if (i % 7 === 0 && Math.sin(now / 300 + i) > 0.7) { px(sx - 1, sy, '#9fb0ff'); px(sx + 1, sy, '#9fb0ff'); px(sx, sy - 1, '#9fb0ff'); px(sx, sy + 1, '#9fb0ff'); } }
    const sk = (now % 7000) / 7000; if (sk < 0.1) { const q = sk / 0.1, fx = 20 + q * 60, fy = 2 + q * 6; for (let t = 0; t < 4; t++) px(fx - t * 2, fy - t, t ? '#9fb0ff' : '#ffffff'); }
  }
  // the sun: a pixel disc with a dithered glow, gold by day and orange near the horizon
  const su = (ff + 0.03) / 0.65;
  if (su > -0.05 && su < 1.05) {
    const arc = Math.sin(Math.max(0, Math.min(1, su)) * Math.PI), sx = Math.round(6 + su * (W - 12)), sy = Math.round(hz + 1 - arc * (hz - 5)), low = arc < 0.35;
    const glow = mixCol(bot, '#fff6c0', 0.45); g.fillStyle = glow;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const r = dx * dx + dy * dy; if (r > 16 && r <= 30 && ((dx + dy) & 1) === 0) g.fillRect(sx + dx, sy + dy, 1, 1); }
    DISC.forEach(([a, b], i) => { g.fillStyle = low ? '#ff8a3a' : '#ffd040'; g.fillRect(sx + a, sy - 3 + i, b - a + 1, 1); });
    DISC.slice(1, 5).forEach(([a, b], i) => { g.fillStyle = low ? '#ffc070' : '#fff6c0'; g.fillRect(sx + a + 1, sy - 2 + i, Math.max(1, b - a - 1), 1); });
  }
  // the moon: a pixel crescent
  const mu = ((ff - 0.58 + 1) % 1) / 0.42;
  if (mu >= 0 && mu <= 1) {
    const mx = Math.round(6 + mu * (W - 12)), my = Math.round(hz + 1 - Math.sin(mu * Math.PI) * (hz - 5));
    DISC.forEach(([a, b], i) => { g.fillStyle = '#eef0ff'; g.fillRect(mx + a, my - 3 + i, b - a + 1, 1); });
    DISC.forEach(([a, b], i) => { g.fillStyle = mixCol(top, bot, 0.25); g.fillRect(mx + a + 2, my - 4 + i, b - a + 1, 1); });   // the shadow bite
  }
  // clouds drifting (warm at dusk and dawn, dim by night)
  const cl = dusky ? '#ffd8c0' : mixCol('#ffffff', top, nk * 0.7), cs = mixCol(cl, top, 0.35);
  for (let i = 0; i < 3; i++) {
    const cx = Math.round(((now / (220 + i * 90) + i * 47) % (W + 24)) - 12), cy = 2 + i * 3;
    CLOUD.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') px(cx + rx, cy + ry, ry === CLOUD.length - 1 ? cs : cl); });
  }
  // far hills: stepped, with a light rim
  const far = nk > 0.5 ? '#1a2a5a' : dusky ? '#6a5a7a' : '#6ab06a', farHi = mixCol(far, '#ffffff', 0.25);
  for (let x = 0; x < W; x++) { const h = Math.round(3 + Math.sin(x * 0.09 + 1) * 2 + Math.sin(x * 0.23) * 1); g.fillStyle = far; g.fillRect(x, hz - h, 1, h + 2); px(x, hz - h, farHi); }
  // the near ground with pines
  const near = nk > 0.5 ? '#0a1430' : dusky ? '#3a3a4a' : '#3a8a3a', nearHi = mixCol(near, '#ffffff', 0.18), trunk = mixCol(near, '#000000', 0.4);
  g.fillStyle = near; g.fillRect(0, hz + 2, W, H - hz - 2); g.fillStyle = nearHi; g.fillRect(0, hz + 2, W, 1);
  for (const tx of [8, 14, 98, 106, 113]) {
    PINE.forEach((w2, i) => { g.fillStyle = near; g.fillRect(tx - (w2 >> 1), hz - 5 + i, w2, 1); });
    g.fillStyle = nearHi; g.fillRect(tx, hz - 5, 1, 2); g.fillStyle = trunk; g.fillRect(tx, hz + 2, 1, 2);
  }
  if (nk > 0.2 || dusky) for (let i = 0; i < 6; i++) { const q = (now / 2200 + i * 0.37) % 1; if (Math.sin(q * Math.PI) < 0.4) continue; px(10 + (i * 19) % (W - 20), hz - 1 - Math.floor(q * 5), '#e8ff8a'); }
}
function drawClock(now) {
  const pr = GAME.profile; if (!pr) return;
  const { P, ff, k } = dayPhaseInfo(pr), nk = nightK(pr), { W, H } = SKY, x0 = Math.round(VW / 2 - W / 2), y0 = 20;
  if (!(now - SKYC._at < SKY.repaint)) { SKYC._at = now; paintSky(SKYC.getContext('2d'), ff, nk, P, now); }   // (its clouds move a pixel every quarter second: no need to repaint it every frame)
  ctx.save(); ctx.imageSmoothingEnabled = false;
  // the frame: a dark outline, a gold bevel (light above, dark below), rivets at the corners
  ctx.fillStyle = '#1a0e06'; ctx.fillRect(x0 - 3, y0 - 3, W + 6, H + 6);
  ctx.fillStyle = '#e0a63a'; ctx.fillRect(x0 - 2, y0 - 2, W + 4, H + 4);
  ctx.fillStyle = '#fff2b8'; ctx.fillRect(x0 - 2, y0 - 2, W + 4, 1); ctx.fillRect(x0 - 2, y0 - 2, 1, H + 4);
  ctx.fillStyle = '#8a5210'; ctx.fillRect(x0 - 2, y0 + H + 1, W + 4, 1); ctx.fillRect(x0 + W + 1, y0 - 2, 1, H + 4);
  ctx.fillStyle = '#2a1408'; ctx.fillRect(x0 - 1, y0 - 1, W + 2, H + 2);
  ctx.drawImage(SKYC, x0, y0, W, H);
  for (const [rx, ry] of [[x0 - 3, y0 - 3], [x0 + W + 1, y0 - 3], [x0 - 3, y0 + H + 1], [x0 + W + 1, y0 + H + 1]]) { ctx.fillStyle = '#5a3208'; ctx.fillRect(rx, ry, 2, 2); ctx.fillStyle = '#fff2b8'; ctx.fillRect(rx, ry, 1, 1); }
  // the plaque hung from its foot: the time and the phase, with how far through it
  const pw = 72, px0 = Math.round(VW / 2 - pw / 2), py0 = y0 + H + 1;
  ctx.fillStyle = '#1a0e06'; ctx.fillRect(px0 - 1, py0 - 1, pw + 2, 14);
  ctx.fillStyle = '#e0a63a'; ctx.fillRect(px0, py0, pw, 12); ctx.fillStyle = '#fff2b8'; ctx.fillRect(px0, py0, pw, 1); ctx.fillStyle = '#8a5210'; ctx.fillRect(px0, py0 + 11, pw, 1);
  ctx.fillStyle = '#20121e'; ctx.fillRect(px0 + 2, py0 + 2, pw - 4, 8);
  text(clockText(pr), VW / 2 - 12, py0 + 6, '#fff6e0', 7.5);
  text(P.name, VW / 2 + 21, py0 + 6.2, P.col, 5.5);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(px0 + 4, py0 + 9, pw - 8, 1);
  ctx.fillStyle = P.col; ctx.fillRect(px0 + 4, py0 + 9, Math.round((pw - 8) * Math.max(0, Math.min(1, k))), 1);
  ctx.restore();
  // the rent: owed (red) or coming up within 5 days
  const R = pr.rent;
  if (R && !R.owned && (R.owed || R.due - (pr.day || 0) <= 5)) {
    const away = R.lordNext != null && typeof gameNow === 'function' ? Math.max(0, Math.ceil((R.lordNext - gameNow(pr)) / (DAY.len / 24) * 60)) : 0;
    const s = R.hunted ? `⚔ HUNTED · RENT ${RENT.gold} G${away ? ` · landlord back in ${away} min` : ''}` : R.owed && R.back != null ? `RENT DUE · mercenaries back in ${Math.max(0, R.back - (pr.day || 0))} d` : R.owed ? `RENT DUE · ${RENT.gold} G` : `rent in ${R.due - (pr.day || 0)} day${R.due - (pr.day || 0) === 1 ? '' : 's'}`;
    text(s, VW / 2, py0 + (nk > 0.5 ? 32 : 19), R.owed ? `rgba(255,${R.hunted ? 90 : 160},90,${0.75 + 0.25 * Math.sin(now / 250)})` : '#ffd8a0', 6);
  }
  // what night means
  if (nk > 0.5) {
    const ny = py0 + 20, nl = `☾ NIGHT · foes ×${(1 + NIGHT.dmg).toFixed(1)} · spawns ×${NIGHT.spawn} · loot ×${NIGHT.drops}`, nw = Math.round(textW(nl, 5.5) + 14);
    ctx.save(); ctx.globalAlpha = Math.min(1, (nk - 0.5) * 4);
    ctx.fillStyle = '#0a0820'; ctx.fillRect(Math.round(VW / 2 - nw / 2) - 1, ny - 6, nw + 2, 12);
    ctx.fillStyle = '#5a6ab8'; ctx.fillRect(Math.round(VW / 2 - nw / 2), ny - 5, nw, 10); ctx.fillStyle = '#141a40'; ctx.fillRect(Math.round(VW / 2 - nw / 2) + 1, ny - 4, nw - 2, 8);
    text(nl, VW / 2, ny, '#c8d4ff', 5.5);
    ctx.restore();
  }
}
const rgbaOfClock = (col, a) => { const c = cssRgba(col); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
