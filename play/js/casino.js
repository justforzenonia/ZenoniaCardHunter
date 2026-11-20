'use strict';
// THE CASINO SHRINE: the Summoning Shrine as a grand casino hall. The magic circle is still the heart of it, now a great
// gold-rimmed prize wheel of the ten ranks with runes, a hexagram and a pentagram of light turning inside, sweeps of light
// racing round it and bulbs chasing round its rim. It spins up when you hover a summon button (m.ang, updateGacha). The same
// circle turns behind the pachinko screen and the FEVER winner. The paytable shows the true drop rates (GACHA_RATES).
// Art: glows from Kenney's Particle Pack (CC0), the coin from "3D Spinning Gold
// Coin Sprite" on OpenGameArt (CC0), the hall generated with Pollinations (flux), behind everything and dimmed.
const CASINO = {
  circle: { x: VW / 2, y: 196, r: 112, tilt: 0.42 }, deck: { w: 58, h: 80, y: 104 }, pillars: 8, pillarH: 104, orbit: 12, parallax: { hall: 12, wheel: 4, deck: 8 },
  table: { x: 84, y: 40, w: 104, h: 216, top: 29, row: 18.6 }, record: { x: 452, y: 40, w: 104, h: 100 },
  spots: [[120, 900, 0.35], [320, 1300, -0.28], [520, 1100, 0.3]], hall: 'assets/casino_hall.jpg',
  fx: { sheet: 'assets/casino_fx.png', cell: 128, star7: 0, star8: 1, star9: 2, ring: 3, light: 4, magic: 5, twirl1: 6, twirl2: 7, spark: 8, white: 0, gold: 1, violet: 2 },
  stack: { w: 28, h: 38, step: 1.1 }, stacks: [[32, 350, 11, -0.14], [68, 350, 7, 0.1], [104, 350, 4, -0.05], [536, 350, 4, 0.05], [572, 350, 7, -0.1], [608, 350, 11, 0.14]],   // [x, foot, cards, lean]
  coin: { sheet: 'assets/coins.png', w: 32, h: 32, frames: 8, ms: 80 },   // the Z summon coin, spinning
  wall: { rows: 3, per: 10, w: 44, h: 64, gap: 10, top: 40, rowGap: 12, ms: [38, 30, 44], dim: 0.55, wait: 700 }, rain: 16, glints: 7,
};
// one glow from the sheet, added as light
function casinoFx(i, tint, x, y, size, rot = 0, a = 1) {
  const F = CASINO.fx, im = img(F.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low'; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(im, i * F.cell, tint * F.cell, F.cell, F.cell, -size / 2, -size / 2, size, size); ctx.restore();
}
function casinoCoin(x, y, size, now) {
  const C = CASINO.coin, im = img(C.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  ctx.drawImage(im, (Math.floor(now / C.ms) % C.frames) * C.w, 0, C.w, C.h, x - size / 2, y - size / 2, size, size);
}
// the wheel: pass the turn it is at, its strength (0-1), and whether it is the full wheel or only the circle of light
function drawMagicCircle(cx, cy, R, ang, a = 1, wheel = true, plate = true) {
  const F = CASINO.fx, n = RANKS.length, seg = Math.PI * 2 / n, ring = 22, inner = R - ring, ring2 = inner - 8, now = performance.now();
  ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha *= a;
  if (wheel) { casinoFx(F.ring, F.violet, 0, 0, R * 3.1, 0, 0.9); casinoFx(F.light, F.gold, 0, 0, R * 2.9, ang * 0.5, 0.45); }
  if (wheel) {
    if (plate) { const disc = ctx.createRadialGradient(0, 0, 8, 0, 0, inner); disc.addColorStop(0, '#2a1450'); disc.addColorStop(1, '#08020f'); ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(0, 0, inner, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.rotate(ang);
    for (let i = 0; i < n; i++) {   // a slice for each rank, deep at the hub and bright at the rim
      const col = rankSolid(i), g = ctx.createRadialGradient(0, 0, inner, 0, 0, R); g.addColorStop(0, shadeOf(col)); g.addColorStop(1, col); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R, i * seg, (i + 1) * seg); ctx.arc(0, 0, inner, (i + 1) * seg, i * seg, true); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(Math.cos(i * seg) * inner, Math.sin(i * seg) * inner); ctx.lineTo(Math.cos(i * seg) * R, Math.sin(i * seg) * R); ctx.stroke();
      ctx.save(); ctx.rotate((i + 0.5) * seg + Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${RANKS[i].length > 2 ? 8 : 11}px ${FEVER.font}`; ctx.lineJoin = 'round'; ctx.strokeStyle = '#120414'; ctx.lineWidth = 2.5; ctx.strokeText(RANKS[i], 0, -(R - ring / 2)); ctx.fillStyle = '#ffffff'; ctx.fillText(RANKS[i], 0, -(R - ring / 2)); ctx.restore();
    }
    ctx.restore();
    const gold = ctx.createConicGradient(ang * 0.3, 0, 0); ['#fff6c8', '#c8861a', '#fff0b8', '#8a4a08', '#fff6c8', '#c8861a', '#fff6c8'].forEach((c, i) => gold.addColorStop(i / 6, c));
    ctx.strokeStyle = gold; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, inner, 0, Math.PI * 2); ctx.stroke();
  }
  // the magic: a ring of runes, a hexagram and a pentagram of light, turning the other way
  casinoFx(F.magic, F.violet, 0, 0, ring2 * 2.3, -ang * 0.9, 1);
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#c8a0ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, ring2, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e0d0ff'; for (let i = 0; i < 24; i++) { const an = i / 24 * Math.PI * 2 - ang * 1.4; ctx.fillRect(Math.cos(an) * (ring2 - 5) - 1.5, Math.sin(an) * (ring2 - 5) - 1.5, i % 3 ? 2 : 4, i % 3 ? 2 : 4); }
  ctx.strokeStyle = '#b48aff'; ctx.lineWidth = 1.6;
  for (const off of [0, Math.PI / 3]) { ctx.beginPath(); for (let i = 0; i <= 3; i++) { const an = off - ang * 0.7 + i * Math.PI * 2 / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * (ring2 - 12), Math.sin(an) * (ring2 - 12)); } ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  if (wheel) { casinoFx(F.twirl1, F.gold, 0, 0, R * 2.5, now / 420, 0.95); casinoFx(F.twirl2, F.white, 0, 0, R * 2.3, -now / 640, 0.5); }   // sweeps of light racing round it
  if (wheel) {
    for (let i = 0; i < 40; i++) { const an = i / 40 * Math.PI * 2, on = (i + Math.floor(now / 70)) % 4 === 0; ctx.fillStyle = on ? '#fffbe0' : '#6a3a0c'; ctx.beginPath(); ctx.arc(Math.cos(an) * (R + 3), Math.sin(an) * (R + 3), on ? 2.3 : 1.5, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < CASINO.glints; i++) { const q = ((now / 1100) + i * 0.37) % 1, an = i * 2.39996; casinoFx(F.star8, F.white, Math.cos(an) * (R + 3), Math.sin(an) * (R + 3), 34 * Math.sin(q * Math.PI), q, 1); }   // glints off the gold
    const pg = ctx.createLinearGradient(0, -R - 14, 0, -R + 10); pg.addColorStop(0, '#fff6c8'); pg.addColorStop(1, '#c8861a'); ctx.fillStyle = pg; ctx.strokeStyle = '#3a1404'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -R + 11); ctx.lineTo(-9, -R - 12); ctx.lineTo(9, -R - 12); ctx.closePath(); ctx.fill(); ctx.stroke();   // the pointer
  }
  ctx.restore();
}
const casinoMouse = () => Math.max(-1, Math.min(1, (mouse.x - VW / 2) / (VW / 2)));
// behind the wheel, a wall of cards scrolling past: three rows of real cards (every rank), the middle row running the other
// way, dimmed so the wheel stands out. Each row is drawn once onto the main canvas, copied into a strip and then just slid
// along (CASINO_WALL); until the card art has loaded the rows are card backs.
let CASINO_WALL = null, CASINO_WALL_T = 0;
function casinoWallBake(now) {
  const W = CASINO.wall, ids = Object.keys(SPECIES).filter(id => D.monsters[id]); if (!ids.length) return null;
  const r = rng(77), sw = W.per * (W.w + W.gap), rows = [];
  for (let k = 0; k < W.rows; k++) {
    const c = document.createElement('canvas'); c.width = sw * RES; c.height = W.h * RES; const g = c.getContext('2d');
    ctx.save(); ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.clearRect(0, 0, sw, W.h);
    for (let i = 0; i < W.per; i++) { const card = makeCard(ids[Math.floor(r() * ids.length)], Math.floor(r() * r() * 10)); try { drawTFCard(card, W.gap / 2 + i * (W.w + W.gap), 0, W.w, W.h, CARD_STILL, {}); } catch (e) { drawCardBack(W.gap / 2 + i * (W.w + W.gap), 0, W.w, W.h, now); } }
    g.drawImage(cv, 0, 0, sw * RES, W.h * RES, 0, 0, sw * RES, W.h * RES); ctx.restore(); rows.push(c);
  }
  return rows;
}
// (called before the screen is clipped, so the rows can be drawn at the top left and copied; the frame then paints over them)
function casinoWallReady(now) { if (!CASINO_WALL && (CASINO_WALL_T ||= now) && now - CASINO_WALL_T > CASINO.wall.wait) CASINO_WALL = casinoWallBake(now); }
function drawCasinoFloor(now) {
  const W = CASINO.wall, S = PACHI.screen, sw = W.per * (W.w + W.gap);
  ctx.fillStyle = '#12061e'; ctx.fillRect(S.x, S.y, S.w, S.h);
  for (let k = 0; k < W.rows; k++) {
    const y = S.y + W.top - 30 + k * (W.h + W.rowGap), dir = k % 2 ? 1 : -1, off = ((now / W.ms[k]) % sw) * dir;
    for (let x = S.x - sw + (((off % sw) + sw) % sw); x < S.x + S.w; x += sw) {
      if (CASINO_WALL) ctx.drawImage(CASINO_WALL[k], x, y, sw, W.h);
      else for (let i = 0; i < W.per; i++) drawCardBack(x + W.gap / 2 + i * (W.w + W.gap), y, W.w, W.h, now);
    }
  }
  ctx.fillStyle = `rgba(20,6,40,${W.dim})`; ctx.fillRect(S.x, S.y, S.w, S.h);
  const v = ctx.createRadialGradient(VW / 2, 175, 110, VW / 2, 175, 390); v.addColorStop(0, 'rgba(10,2,20,0.1)'); v.addColorStop(1, 'rgba(8,2,14,0.8)'); ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
}
function casinoPanel(x, y, w, h, label, now) {
  ctx.save(); ctx.shadowColor = 'rgba(255,190,70,0.5)'; ctx.shadowBlur = 6 * RES; ctx.fillStyle = 'rgba(10,4,16,0.9)'; rrect(ctx, x, y, w, h, 6); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#fff0b8'); g.addColorStop(0.5, '#c8861a'); g.addColorStop(1, '#fff0b8'); ctx.strokeStyle = g; ctx.lineWidth = 2; rrect(ctx, x + 1, y + 1, w - 2, h - 2, 6); ctx.stroke();
  const b = ctx.createLinearGradient(0, y + 5, 0, y + 20); b.addColorStop(0, '#e02040'); b.addColorStop(1, '#8a0c20'); ctx.fillStyle = b; rrect(ctx, x + 6, y + 5, w - 12, 15, 3); ctx.fill(); text(label, x + w / 2, y + 12.5, '#ffe9a8', 8.5);
}
function drawPaytable(now) {
  const T = CASINO.table, lit = Math.floor(now / 130) % RANKS.length; casinoPanel(T.x, T.y, T.w, T.h, 'PAYTABLE', now);
  RANKS.forEach((_, i) => {
    const t = RANKS.length - 1 - i, y = T.y + T.top + i * T.row, top = t === 9, col = t === 9 ? rankColor(9, now) : rankSolid(t);   // (the best at the top)
    if (i === lit || top) { ctx.fillStyle = top ? `rgba(255,210,63,${0.2 + 0.14 * Math.sin(now / 120)})` : 'rgba(255,255,255,0.08)'; ctx.fillRect(T.x + 6, y - 9, T.w - 12, 18); }
    text(RANKS[t], T.x + 12, y, col, 8.5, 'left'); text(pachiTitle(t)[1], T.x + T.w / 2 - 5, y, top ? '#ffe08a' : '#a89878', 8); text(`${GACHA_RATES[t]}%`, T.x + T.w - 10, y, '#e8e2cf', 8, 'right');
  });
  text(`x10: one ${RANKS[GACHA_FLOOR.tier]}+ sure`, T.x + T.w / 2, T.y + T.h - 9, '#ffd27a', 6.5);   // (the x10 floor: gacha.js)
}
function drawRecord(pr, now) {
  const C = CASINO.record, cx = C.x + C.w / 2, best = pr.pullBest; casinoPanel(C.x, C.y, C.w, C.h, 'YOUR RECORD', now);
  text('BEST PULL', cx, C.y + 30, '#a89878', 8); text(best == null ? '— —' : RANKS[best], cx, C.y + 47, best == null ? '#6a6458' : rankColor(best, now), 16);
  text(best == null ? '' : `${pachiTitle(best)[1]} FEVER`, cx, C.y + 63, '#ffe9a8', 8); text(`Summons  ${pr.pulls || 0}`, cx, C.y + 82, '#e8e2cf', 8);
}
// the piles of cards either side of the buttons: edges in cream and gold, slightly untidy, with a card back on top
function casinoCardStacks(now) {
  const S = CASINO.stack;
  CASINO.stacks.forEach(([x, foot, n, lean], i) => {
    const top = foot - S.h / 2 - n * S.step;
    ctx.save(); ctx.translate(x, top); ctx.rotate(lean);
    for (let k = n; k >= 1; k--) { const dx = Math.sin(k * 2.7 + i) * 1.2; ctx.fillStyle = k % 3 === 0 ? '#c8a24a' : k % 2 ? '#f4ecd8' : '#b8ac98'; rrect(ctx, -S.w / 2 + dx, -S.h / 2 + k * S.step, S.w, S.h, 2.5); ctx.fill(); }
    drawCardBack(-S.w / 2, -S.h / 2, S.w, S.h, now);
    ctx.restore();
    const q = ((now / 1700) + i * 0.31) % 1; casinoFx(CASINO.fx.star8, CASINO.fx.white, x + S.w * 0.3, top - S.h * 0.3, 22 * Math.sin(q * Math.PI), q, 1);
  });
}
// the wheel lying on the floor in perspective: a shadow, a thick gold edge with bulbs, then the wheel itself foreshortened
function drawFloorWheel(cx, cy, R, ang, a, now) {
  const T = CASINO.circle.tilt, edge = R * 0.07;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.ellipse(cx, cy + edge + 7, R + 14, (R + 14) * T, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(cx - R, 0, cx + R, 0); g.addColorStop(0, '#5a2a08'); g.addColorStop(0.3, '#ffcf6a'); g.addColorStop(0.5, '#fff6c8'); g.addColorStop(0.7, '#d89a2a'); g.addColorStop(1, '#5a2a08');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy + edge, R + 6, (R + 6) * T, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(cx - R - 6, cy, R * 2 + 12, edge);
  for (let i = 0; i < 28; i++) { const u = i / 27 * 2 - 1, on = (i + Math.floor(now / 70)) % 4 === 0, y = cy + edge * 0.5 + Math.sqrt(Math.max(0, 1 - u * u)) * (R + 6) * T; ctx.fillStyle = on ? '#fffbe0' : '#7a3a0c'; ctx.beginPath(); ctx.arc(cx + u * (R + 5), y, on ? 2.2 : 1.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, T); drawMagicCircle(0, 0, R, ang); ctx.restore();
  ctx.restore();
}
// light rising off the rim of the wheel
function casinoPillars(cx, cy, R, ang, now) {
  const C = CASINO, T = C.circle.tilt; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < C.pillars; i++) {
    const an = ang * 1.2 + i / C.pillars * Math.PI * 2, x = cx + Math.cos(an) * R * 0.9, y = cy + Math.sin(an) * R * 0.9 * T, h = C.pillarH * (0.7 + 0.3 * Math.sin(now / 240 + i)), w = 5 + 4 * (Math.sin(an) + 1), g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, 'rgba(200,140,255,0)'); g.addColorStop(1, i % 2 ? 'rgba(255,200,90,0.75)' : 'rgba(190,120,255,0.75)'); ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h, w, h);
  }
  ctx.restore();
}
// the card of fate in the air (one card), turning slowly, with a beam under it and motes circling it
function drawFloatingDeck(cx, cy, floorY, now) {
  const C = CASINO, D = C.deck, F = C.fx, bob = Math.sin(now / 600) * 4, y = cy + bob, turn = Math.sin(now / 1500) * 0.45, sx = Math.cos(turn), T = C.circle.tilt;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y, 0, floorY); g.addColorStop(0, 'rgba(255,220,130,0)'); g.addColorStop(1, 'rgba(255,210,110,0.2)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 34 * sx, y + 30); ctx.lineTo(cx + 34 * sx, y + 30); ctx.lineTo(cx + 52, floorY); ctx.lineTo(cx - 52, floorY); ctx.closePath(); ctx.fill();
  ctx.restore();
  casinoFx(F.ring, F.gold, cx, floorY, 150, 0, 0.55);   // its light on the wheel
  const orbit = back => { for (let i = 0; i < C.orbit; i++) { const an = now / 900 + i / C.orbit * Math.PI * 2, s = Math.sin(an); if ((s < 0) !== back) continue; const r = 62 + (i % 3) * 8, x = cx + Math.cos(an) * r, oy = y + s * r * T - 10 + (i % 4) * 9; if (i % 3) { ctx.fillStyle = i % 2 ? '#ffe08a' : '#ffffff'; ctx.fillRect(x - 1.2, oy - 1.2, 2.4 + s, 2.4 + s); } else casinoCoin(x, oy, 16 + s * 4, now + i * 60); } };
  orbit(true);
  ctx.save(); ctx.translate(cx, y); ctx.transform(sx, Math.sin(turn) * 0.1, 0, 1, 0, 0);
  drawCardBack(-D.w / 2, -D.h / 2, D.w, D.h, now, { glow: '#ffd23f', blur: 12 }); ctx.restore();
  orbit(false);
}
function drawCasinoShrine(game, m, now) {
  const C = CASINO, O = C.circle, pr = game.profile, coins = pr.coins || 0, wx = O.x, ang = m.ang || 0, L = cabLight(null, now);
  casinoWallReady(now); ctx.save(); clipScreen();
  drawCasinoFloor(now); drawFloorWheel(wx, O.y, O.r, ang, 1, now); casinoPillars(wx, O.y, O.r, ang, now);
  drawFloatingDeck(O.x, C.deck.y, O.y, now);
  drawPaytable(now); drawRecord(pr, now);
  ctx.restore();
  drawCabinetFrame(L, now); drawCabinetTray(L, now); drawLogoPlate('SUMMONING SHRINE', now);
  casinoCardStacks(now);
  summonTokens(coins, now, false);
  const left = nextCoinsIn(pr), mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60; ledPlate(404, 310, 90, 22, coins, now, `+10 in ${mm}:${String(ss).padStart(2, '0')}`);
  text('1 ×10 · 2 ×100 · Esc leave', 449, 357, '#c8b8e8', 7);
}
// THE SUMMON TOKENS, in place of buttons: on the console stand a single face-down card on a gold stand (summon one) and a fan
// of ten (summon ten), each with a ribbon naming it. Point at one and it rises with a soft light round it; without the credits
// for it, it sits dim. GBTN still holds where they are clicked. busy: during the summon itself, both sit still.
const SUMMON_TOKEN = { ten: { n: 5, w: 36, h: 52, col: '#ffc21f', label: '×10', spread: 0.22 }, hund: { n: 7, w: 36, h: 52, col: '#5ab8ff', label: '×100', spread: 0.18 } };   // (more cards in the fan for the bigger summon)
function summonToken(B, T, on, hov, now) {
  const cx = B.x + B.w / 2, base = B.y + B.h - 14, lift = hov ? 5 + Math.sin(now / 200) : 0;
  ctx.save(); if (!on) ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(cx, base + 3, B.w * 0.42, 6, 0, 0, Math.PI * 2); ctx.fill();   // the gold stand
  const sg = ctx.createLinearGradient(cx - B.w * 0.4, 0, cx + B.w * 0.4, 0); ['#6a3606', '#fff0b8', '#c8861a', '#fff6c8', '#6a3606'].forEach((c, i) => sg.addColorStop(i / 4, c)); ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, base, B.w * 0.4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a0a30'; ctx.beginPath(); ctx.ellipse(cx, base - 1, B.w * 0.33, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (hov && on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const G = ctx.createRadialGradient(cx, base - 24, 4, cx, base - 24, 46); G.addColorStop(0, hexA(T.col, 0.45)); G.addColorStop(1, hexA(T.col, 0)); ctx.fillStyle = G; ctx.fillRect(cx - 46, base - 70, 92, 92); ctx.restore(); }
  for (let i = 0; i < T.n; i++) {   // the card, or the fan
    const a = T.n > 1 ? (i - (T.n - 1) / 2) * T.spread : 0;
    ctx.save(); ctx.translate(cx, base - 2 - lift); ctx.rotate(a); drawCardBack(-T.w / 2, -T.h, T.w, T.h, now, hov && on && i === (T.n - 1) / 2 ? { glow: T.col, blur: 10 } : {}); ctx.restore();
  }
  const rw = B.w - 16, ry = base + 1;   // the ribbon (as wide as its own spot: three stand side by side)
  const rg = ctx.createLinearGradient(0, ry, 0, ry + 13); rg.addColorStop(0, T.col); rg.addColorStop(1, shadeOf(T.col)); ctx.fillStyle = rg;
  ctx.beginPath(); ctx.moveTo(cx - rw / 2 - 6, ry); ctx.lineTo(cx + rw / 2 + 6, ry); ctx.lineTo(cx + rw / 2, ry + 6.5); ctx.lineTo(cx + rw / 2 + 6, ry + 13); ctx.lineTo(cx - rw / 2 - 6, ry + 13); ctx.lineTo(cx - rw / 2, ry + 6.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff0b8'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.font = `8px ${FEVER.font}`; ctx.strokeStyle = '#10040c'; ctx.lineWidth = 2.5; const s = `${T.label} SUMMON`; ctx.strokeText(s, cx, ry + 7); ctx.fillStyle = '#ffffff'; ctx.fillText(s, cx, ry + 7); ctx.restore();
  ctx.restore();
}
function summonTokens(coins, now, busy) {
  const over = B => !busy && mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
  for (const k of Object.keys(GBTN)) { const B = GBTN[k]; summonToken(B, SUMMON_TOKEN[k], busy || coins >= B.n, coins >= B.n && over(B), now); }
}
// behind the revealed cards: the casino on the big screen, with the wheel turning on the floor under them
function drawSummonStage(now) {
  const O = CASINO.circle; casinoWallReady(now); ctx.save(); clipScreen(); drawCasinoFloor(now); drawFloorWheel(O.x, 226, 190, now / 1500, 0.9, now);
  const S = PACHI.screen; ctx.fillStyle = 'rgba(8,4,14,0.3)'; ctx.fillRect(S.x, S.y, S.w, S.h); ctx.restore();
}
