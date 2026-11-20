'use strict';
// SAFE POINTS: a glowing waystone at the far (western) end of every zone — the deepest area before the next zone.
// Touch one and it is yours (pr.safePts[zone]). Inside its ring you are safe: monsters are pushed out and you slowly
// heal. Back home, the WAYSTONE beside your front door opens TRAVEL: pick any safe point you have found (or
// Hearthvale) and you are there at once.

const SAFE = { r: 58, touch: 24, heal: 0.03 };
const SAFE_COLS = ['#7aea8a', '#9fb0ff', '#ff8a4a', '#9fe8ff', '#ffd27a', '#ff9ab8'];
// where each zone's safe point stands (worked out once per world): a reachable open spot in the western half of
// the zone's westernmost area
function safePoints(w) {
  if (w.safePts) return w.safePts;
  w.safePts = ZONES.map((Z, z) => {
    const regs = REGIONS.filter(r => r.zone === z); if (!regs.length) return null;
    const R = regs.reduce((a, b) => (b.ox < a.ox ? b : a)), r = rng(WORLD_SEED * 7 + z * 131);
    for (let i = 0; i < 400; i++) {
      const x = (R.ox + 3 + r() * Math.max(2, R.w * 0.45)) * T, y = (R.oy + 3 + r() * Math.max(2, R.h - 6)) * T;
      if (mapReach(w.map, x, y) && !w.blocked(x, y) && !mapSolidAt(w.map, x, y - 12) && !mapSolidAt(w.map, x + 14, y) && !mapSolidAt(w.map, x - 14, y)) return { z, x, y };
    }
    const c = findOpen(w, (R.ox + R.w / 2) * T, (R.oy + R.h / 2) * T); return { z, x: c.x, y: c.y };
  });
  return w.safePts;
}
// the waystone by your front door
const waystonePos = w => w.waystone || (w.waystone = findOpen(w, HOME_DOOR.x + TOWN_OX + 46, HOME_DOOR.y + TOWN_OY + 22));
// every travel stone: Hearthvale's, then the one in front of each outpost house (town: its number)
const homeStones = w => w.homeStones || (w.homeStones = [{ ...waystonePos(w), town: null }, ...OUTPOSTS.map(O => ({ ...findOpen(w, O.stone.x, O.stone.y), town: O.i }))]);
const nearWaystone = w => w.overworld && !w.interior && homeStones(w).some(H => Math.hypot(w.player.x - H.x, w.player.y - H.y) < 26);

// after a fall sends you home: once you have touched a safe point, say that the waystone by the door takes you back to it
function wakeHint(game) {
  const pr = game.profile, n = pr && pr.safePts ? Object.keys(pr.safePts).length : 0;
  if (n) game.toast(`The waystone by your door (Enter) takes you back to ${n === 1 ? 'the safe point' : 'any safe point'} you have found`, '#9fe8ff');
}
function safeTick(game, w, dt) {
  if (!w.overworld || w.interior) return;
  const pr = game.profile, p = w.player; pr.safePts = pr.safePts || {}; pr.townStones = pr.townStones || {};
  for (const H of homeStones(w)) if (H.town != null && !pr.townStones[H.town] && Math.hypot(p.x - H.x, p.y - H.y) < SAFE.touch) {   // an outpost's stone: found
    pr.townStones[H.town] = true; game.save();
    w.rings.push({ x: H.x, y: H.y, r: 50, t: 0, col: '#ffd27a' }, { x: H.x, y: H.y, r: 30, t: -120, col: '#ffffff' });
    game.toast(`WAYSTONE found: ${OUTPOSTS[H.town].name} — travel here from any waystone`, '#ffd27a');
  }
  for (const S of safePoints(w)) {
    if (!S || Math.abs(S.x - p.x) > 700) continue;
    const d = Math.hypot(p.x - S.x, p.y - S.y);
    if (d < SAFE.touch && !pr.safePts[S.z]) {   // found it
      pr.safePts[S.z] = true; game.save();
      w.rings.push({ x: S.x, y: S.y, r: 50, t: 0, col: SAFE_COLS[S.z % 6] }, { x: S.x, y: S.y, r: 30, t: -120, col: '#ffffff' });
      game.toast(`SAFE POINT found: ${ZONES[S.z].name} — travel here any time from the Waystone by your front door`, SAFE_COLS[S.z % 6]);
    }
    // the ring keeps monsters out and mends you
    for (const m of w.actors) {
      if (m.kind !== 'monster' || m.ally || m.dead || m.boss) continue;
      const dx = m.x - S.x, dy = m.y - S.y, md = Math.hypot(dx, dy * 1.4);
      if (md < SAFE.r) { const k = (SAFE.r - md) * 0.25 + 1; m.x += dx / (md || 1) * k; m.y += dy / (md || 1) * k; }
    }
    if (d < SAFE.r && !p.dead) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * SAFE.heal * dt / 1000); if (p.maxMp) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * SAFE.heal * dt / 1000); }
  }
}
// a floating Z card (the card back) over a rune ring; found ones blaze in their zone's colour, unfound ones are grey. Shrines keep a crystal
const SHRINE_SEAL = { r: 10, k: 0.27, cy: 0.485 };   // its size on the ground, and the emblem's circle on the card back (radius as a share of its width, centre height)
function drawWaystone(x, y, col, lit, now, label, sub) {
  const bob = Math.sin(now / 500) * 2;
  ctx.save();
  const card = label !== 'SHRINE', cy = y - 20 + bob;
  // (the card waystones float on their own: no glow, ring or shadow under them, 2026-11-20, the user: "remove ring from bottom of card")
  if (!card) {
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 2, x, y, SAFE.r); g.addColorStop(0, hexA(col, lit ? 0.35 : 0.12)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, SAFE.r, SAFE.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hexA(col, lit ? 0.75 : 0.3); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, SAFE.r * 0.6, SAFE.r * 0.27, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 + now / 2400; ctx.fillStyle = hexA(col, lit ? 0.9 : 0.35); ctx.fillRect(x + Math.cos(an) * SAFE.r * 0.6 - 1, y + Math.sin(an) * SAFE.r * 0.27 - 1, 2, 2); }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (card) {
    const W = 28, H = 39, turn = 0.88 + 0.12 * Math.cos(now / 900), tilt = Math.sin(now / 1300) * 0.05, im = img(CARD_BACK);   // it sways gently and never turns its back
    ctx.save(); ctx.translate(x, y - 28 + bob); ctx.rotate(tilt); ctx.scale(turn, 1); ctx.imageSmoothingEnabled = true;
    if (lit) { ctx.shadowColor = col; ctx.shadowBlur = (5 + 2 * Math.sin(now / 400)) * RES; } else ctx.filter = 'grayscale(1) brightness(0.65)';
    if (im && im.complete) ctx.drawImage(im, -W / 2, -H / 2, W, H);
    ctx.restore();
  } else {
  // the shrine is the cards' back emblem: the ringed Z from the middle of the card back, cut out as a round seal (2026-11-20, the user:
  // "make the shrine into a circle with a Z in the middle", then "use the back cover of the cards for shrine circle")
  const r = SHRINE_SEAL.r, zy = cy - 2, im = img(CARD_BACK);
  if (im && im.complete && im.naturalWidth) {
    const W0 = im.naturalWidth, H0 = im.naturalHeight, sr = W0 * SHRINE_SEAL.k, sx = W0 * 0.5 - sr, sy = H0 * SHRINE_SEAL.cy - sr;
    ctx.save(); ctx.beginPath(); ctx.arc(x, zy, r, 0, Math.PI * 2); ctx.clip(); ctx.imageSmoothingEnabled = true;
    if (lit) { ctx.shadowColor = col; ctx.shadowBlur = (5 + 2 * Math.sin(now / 400)) * RES; } else ctx.filter = 'grayscale(1) brightness(0.65)';
    ctx.drawImage(im, sx, sy, sr * 2, sr * 2, x - r, zy - r, r * 2, r * 2); ctx.restore();
    ctx.strokeStyle = lit ? 'rgba(255,240,200,0.9)' : '#9a9aa8'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, zy, r - 0.4, 0, Math.PI * 2); ctx.stroke();
  }
  }
  if (lit) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const k = ((now / 1400) + i / 4) % 1; ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillStyle = col; ctx.fillRect(x - 6 + i * 4, cy + 8 - k * 26, 1.5, 1.5); } }
  ctx.restore();
  worldTag(sub ? [[label, lit ? '#ffffff' : '#c8c8d0', 7], [sub, lit ? col : '#9a9aa8', 5.6]] : [[label, lit ? '#ffffff' : '#c8c8d0', 7]], x, y - (card ? 61 : 48) + bob);   // (on a soft pill: hud.js worldTag)
}
function drawSafePoints(w, now, items) {
  if (!w.overworld || w.interior) return;
  const pr = window.GAME && GAME.profile, got = (pr && pr.safePts) || {}, p = w.player;
  for (const S of safePoints(w)) {
    if (!S || Math.abs(S.x - p.x) > 420 || Math.abs(S.y - p.y) > 300) continue;
    const col = SAFE_COLS[S.z % 6], lit = !!got[S.z];
    items.push({ y: S.y, draw: () => drawWaystone(S.x, S.y, col, lit, now, 'SAFE POINT', lit ? ZONES[S.z].name : 'touch it to unlock') });
  }
  const stones = (pr && pr.townStones) || {};
  for (const H of homeStones(w)) {
    if (Math.abs(H.x - p.x) > 420 || Math.abs(H.y - p.y) > 300) continue;
    const lit = H.town == null || !!stones[H.town];
    items.push({ y: H.y, draw: () => {
      drawWaystone(H.x, H.y, '#ffd27a', lit, now, 'WAYSTONE', H.town == null ? 'travel to a safe point' : lit ? `${OUTPOSTS[H.town].name} · travel` : 'touch it to unlock');
      if (Math.hypot(p.x - H.x, p.y - H.y) < 26) text('Enter: Travel', H.x, H.y + 12, '#ffe9a8', 7);
    } });
  }
}

// ---- TRAVEL (from the Waystone at home): Hearthvale, then every zone's safe point
function travelMenu() { return { type: 'travel', cur: 0, scroll: 0 }; }
function travelRows(game) {
  const pr = game.profile, got = pr.safePts || {}, stones = pr.townStones || {};
  return [{ draw: HOUSE_ROW, name: 'Hearthvale · your front door', sub: 'Home, the farm and the town', right: 'GO', rightCol: '#8fffb0', dest: null },
    ...OUTPOSTS.map(O => stones[O.i] ? { icon: ITEM2_BASE + 941, name: `${O.name} · Waystone`, sub: ownsTownHome(pr, O.i) ? 'your house and its farm' : `house for sale · ${fmtG(O.price)}`, right: 'GO', rightCol: '#ffd27a', dest: { town: O.i } }
      : { icon: ITEM2_BASE + 1042, name: `${O.name}`, sub: `${OUTPOST_TOWNS[O.i].where || `The town past the ${ZONES[O.i].name}`} — touch its waystone to unlock`, right: '—', rightCol: '#7a7468', dim: true, locked: 'Not found yet — reach that town and touch its waystone' }),
    ...ZONES.map((Z, z) => got[z] ? { icon: ITEM2_BASE + 940, name: `${Z.name} · Safe Point`, sub: `${Z.desc} · at the far end of the zone`, right: 'GO', rightCol: SAFE_COLS[z % 6], dest: { z } }
      : { icon: ITEM2_BASE + 1042, name: `${Z.name}`, sub: 'Find the safe point at the far west end of this zone to unlock it', right: '—', rightCol: '#7a7468', dim: true, locked: 'Not found yet — walk to the far west end of that zone' })];
}
function updateTravel(game, m) {
  const rows = travelRows(game), nav = panelNav(m, rows.length, 0);
  if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok) return;
  const r = rows[m.cur]; if (r.locked) { game.toast(r.locked, '#c9c1a8'); return; }
  if (leadingBlocks(game)) return;
  game.closeMenu(); travelTo(game, r.dest);
}
function drawTravel(game, m, now) {
  panelMenu(m, { title: 'TRAVEL', rows: travelRows(game), info: 'Safe points glow at the far end of each zone — touch one to add it here', keys: '↑↓ choose · Enter: travel · Esc: close' }, now);
}
// dest: null (Hearthvale), { z } (a zone's safe point) or { town } (an outpost's waystone)
function travelTo(game, dest) {
  if (typeof dest === 'number') dest = { z: dest };   // (older callers)
  game.goTown('home');
  const w = game.world, p = w.player;
  const at = !dest ? null : dest.town != null ? homeStones(w).find(H => H.town === dest.town) : safePoints(w)[dest.z];
  if (dest && !at) return;
  if (at) {
    p.x = at.x; p.y = at.y + 14; p.vx = p.vy = 0;
    for (const a of w.actors) if (a.ally && a.owner === p) { a.x = p.x + rand(-20, 20); a.y = p.y + 10; }
    w.region = regionIndexAt(p.x); w.name = regionName(w.region);
  }
  const col = !dest ? '#ffd27a' : dest.town != null ? '#ffd27a' : SAFE_COLS[dest.z % 6];
  w.rings.push({ x: p.x, y: p.y, r: 34, t: 0, col }, { x: p.x, y: p.y, r: 20, t: -120, col: '#ffffff' });
  game.toast(!dest ? 'Travelled home to Hearthvale' : dest.town != null ? `Travelled to ${OUTPOSTS[dest.town].name}` : `Travelled to the ${ZONES[dest.z].name} safe point`, col);
}
