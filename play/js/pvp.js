'use strict';
// PvP is the heart of the game. The HUB is the main screen: Ranked Arena (climb ten leagues against CPU rivals),
// Versus (two players, one keyboard), Adventure (hunt cards and gear to get stronger), Deck & Gear, Summon.
// Everything outside the arena exists to raise your POWER for the next ranked match.

// ---------------------------------------------------------------- ranked ladder
const LEAGUES = ['Rookie', 'Bronze', 'Iron', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Legend'];
const RP_PER_LEAGUE = 100;
const RIVAL_NAMES = ['Kael', 'Riven', 'Sora', 'Mira', 'Draven', 'Lyra', 'Toma', 'Vex', 'Ilya', 'Bram', 'Nyx', 'Oren', 'Zara', 'Caspian',
  'Fenna', 'Juno', 'Rook', 'Selene', 'Tarn', 'Wren', 'Aric', 'Brisa', 'Cato', 'Dahlia'];
const RIVAL_TITLES = ['the Swift', 'Ironhand', 'of the Ember', 'the Unbroken', 'Stormborn', 'the Card Thief', 'Nightblade', 'the Colossus',
  'Frostfang', 'the Gambler', 'Dawnbringer', 'the Wall'];
function pvpOf(pr) { return pr.pvp || (pr.pvp = { rp: 0, wins: 0, losses: 0, streak: 0, best: 0 }); }
const leagueOf = rp => Math.min(LEAGUES.length - 1, Math.floor(rp / RP_PER_LEAGUE));
// One number for how strong a build is: stats, spells and passives
function powerOf(pr) {
  const st = profileStats(pr);
  const spells = (st.spells || []).filter(Boolean).reduce((s, sp) => s + (sp.power || 0), 0);
  const passives = Object.keys(st.passives || {}).length;
  return Math.max(1, Math.round(st.atk * 8 + st.hp * 0.6 + st.mp * 0.3 + st.def * 10 + st.crit * 6 + (st.spd - 60) * 2 + spells * 0.8 + passives * 12 + (st.fusion ? 60 : 0)));
}
// a rival built for your league: same card ranks, levels and gear as that league's champions
function makeRival(pr) {
  const L = leagueOf(pvpOf(pr).rp), cls = CLASS_PICKS()[randi(0, CLASS_PICKS().length - 1)];
  const p2 = randomProfile(cls, Math.min(9, L));
  p2.lv = clamp(1 + L * 6 + randi(-2, 2), 1, MAX_LV);
  const name = `${pick(RIVAL_NAMES)} ${pick(RIVAL_TITLES)}`;
  p2.look = { ...p2.look, name: name.split(' ')[0] };
  return { p2, name, league: L, power: powerOf(p2) };
}
// CPU rivals fight better in higher leagues
const cpuSkillFor = L => 0.6 + L * 0.11;   // (steeper from 2026-11-20: to 1.6 at Legend; rankladder.js adds its habits)

// ---------------------------------------------------------------- shared visuals
function leagueEmblem(cx, cy, r, L, now) {
  const col = rankColor(L, now);
  const hex = rr => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const t = -Math.PI / 2 + i * Math.PI / 3; i ? ctx.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr) : ctx.moveTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr); } ctx.closePath(); };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const h = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 2); h.addColorStop(0, hexA(RANK_COL[L] === 'rainbow' ? '#ffffff' : RANK_COL[L], 0.4 + 0.15 * Math.sin(now / 300))); h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = h; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4); ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4 * RES; ctx.fillStyle = goldFrameGrad(cy - r, r * 2); hex(r); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#3a1e04'; ctx.lineWidth = 0.9; hex(r); ctx.stroke();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 1, cx, cy, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, '#100818');
  ctx.fillStyle = g; hex(r - 2.4); ctx.fill();
  goldText(RANKS[L], cx, cy + 0.5, r * 0.62, { spacing: 0, glow: 'rgba(255,220,120,0.6)' });
}
function rpBar(x, y, w, rp, now, shown) {
  const L = leagueOf(rp), into = L >= LEAGUES.length - 1 ? 1 : ((shown ?? rp) - L * RP_PER_LEAGUE) / RP_PER_LEAGUE;
  ctx.fillStyle = '#07080c'; rrect(ctx, x, y, w, 6, 3); ctx.fill();
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#a8661c'); g.addColorStop(1, '#ffe08a');
  ctx.fillStyle = g; rrect(ctx, x, y, Math.max(3, w * clamp(into, 0, 1)), 6, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 2, y + 1, Math.max(0, w * clamp(into, 0, 1) - 4), 1);
  ctx.strokeStyle = 'rgba(255,220,140,0.6)'; ctx.lineWidth = 0.7; rrect(ctx, x + 0.4, y + 0.4, w - 0.8, 5.2, 3); ctx.stroke();
}
// the arena, darkened, with light shafts — backdrop for the hub and menus
function arenaBackdrop(now, dim = 0.55) {
  const bg = ARENA_BG || (ARENA_BG = renderArenaBg());
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const s = Math.max(VW / ARENA_W, VH / ARENA_H) * 1.05, ox = (VW - ARENA_W * s) / 2 + Math.sin(now / 5000) * 6, oy = (VH - ARENA_H * s) / 2;
  ctx.drawImage(bg, ox, oy, ARENA_W * s, ARENA_H * s);
  ctx.restore();
  ctx.fillStyle = `rgba(6,4,14,${dim})`; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {   // light shafts swaying from above
    const x = VW * (0.15 + i * 0.18) + Math.sin(now / 2400 + i) * 30;
    const g = ctx.createLinearGradient(x, 0, x + 40, VH);
    g.addColorStop(0, 'rgba(255,220,150,0.14)'); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 18, 0); ctx.lineTo(x + 90, VH); ctx.lineTo(x + 20, VH); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
}
// a hero standing on a turning rune circle
function heroPedestal(cls, look, wlook, cx, cy, scale, now, col, dir = 2, anim = 'idle') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = hexA(col, 0.55 - k * 0.2); ctx.lineWidth = 1.2; ctx.setLineDash(k ? [3, 4] : []); ctx.lineDashOffset = -now / (k ? 40 : 80);
    ctx.beginPath(); ctx.ellipse(cx, cy, 30 * scale / 3 + k * 9, 9 * scale / 3 + k * 3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.setLineDash([]);
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 40 * scale / 3);
  g.addColorStop(0, hexA(col, 0.4)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, 44 * scale / 3, 14 * scale / 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawPlayerPreview(cls, look, wlook, anim, dir, cx, cy, scale, now);
}

// ---------------------------------------------------------------- the HUB
const HUB_OPTS = [
  { id: 'ranked', title: 'RANKED ARENA', sub: 'Climb ten leagues · win coins, cards and gear', icon: '⚔', col: '#ffd23f' },
  { id: 'online', title: 'ONLINE CO-OP', sub: 'Up to four players on your home network', icon: '⇄', col: '#8fd8ff' },
  { id: 'training', title: 'TRAINING', sub: 'A dummy that never falls · test your combos and damage', icon: '◎', col: '#7fc0ff' },
  { id: 'adventure', title: 'ADVENTURE', sub: 'Start at home in Hearthvale · farm, cook, then set out to hunt', icon: '✦', col: '#8fffb0' },
  { id: 'deck', title: 'DECK & GEAR', sub: 'Cards, spells, equipment, stats and Layer element', icon: '❖', col: '#e0b0ff' },
  { id: 'summon', title: 'SUMMON', sub: 'Spend coins on new cards', icon: '✧', col: '#ffb0d8' },
  { id: 'quit', title: 'SAVE & EXIT', sub: 'Back to the title screen', icon: '◀', col: '#c9c1a8' },
];
function hubMenu() { return { type: 'hub', cur: HUB_OPTS.findIndex(o => o.id === 'adventure'), t: 0 }; }   // a stray Enter heads into the world, never into a fight
function hubChoose(game, id) {
  const pr = game.profile;
  if (id === 'ranked') game.openMenu(vsMenu(game));
  else if (id === 'online') game.openMenu(netMenu());   // (net.js)
  else if (id === 'training') { game.closeMenu(); game.goTraining(); }   // (training.js)
  else if (id === 'adventure') { game.closeMenu(); game.goAdventure(); }
  else if (id === 'deck') game.openMenu(inventoryMenu(game));
  else if (id === 'summon') game.openMenu(gachaMenu());
  else if (id === 'quit') { game.save(); game.saved = pr; game.backToTitle(); }
}
// THE HUB LAYOUT (from a Gemini wireframe, 2026-11-05): a PLAYER CARD on the left (league, RP, record, coins, the hero on a
// pedestal, POWER and TODAY) and the modes on the right in three tiers: ADVENTURE as one big primary tile, then RANKED / CO-OP /
// TRAINING as three tiles, then DECK & GEAR / SUMMON / SAVE & EXIT as a slimmer utility row. News lines (toasts) keep to a strip
// along the foot of the screen so they never cover the menu. Arrows move around the grid; Enter or a click chooses.
const HUB_L = { card: { x: 16, y: 46, w: 172, h: 284 }, right: { x: 200, w: 424 }, prim: { y: 46, h: 100 }, sec: { y: 154, h: 84 }, util: { y: 246, h: 50 }, gap: 8, news: 340 };
const HUB_GRID = [['adventure'], ['ranked', 'online', 'training'], ['deck', 'summon', 'quit']];
const HUB_BTN = i => {
  const id = HUB_OPTS[i].id, L = HUB_L, row = HUB_GRID.findIndex(r => r.includes(id)), col = HUB_GRID[row].indexOf(id), n = HUB_GRID[row].length;
  const band = [L.prim, L.sec, L.util][row], w = (L.right.w - L.gap * (n - 1)) / n;
  return { x: L.right.x + col * (w + L.gap), y: band.y, w, h: band.h, row, col };
};
const hubLocked = (pr, id) => typeof HUB_LOCK !== 'undefined' && HUB_LOCK[id] && typeof unlocked === 'function' && !unlocked(pr, HUB_LOCK[id]) ? UNLOCK_BY[HUB_LOCK[id]].lv : 0;
function updateHub(game, m, dt) {
  m.t += dt;
  const k = navInput(), idAt = (r, c) => HUB_OPTS.findIndex(o => o.id === HUB_GRID[r][c]);
  const B = HUB_BTN(m.cur);
  if (k.u || k.d) {   // up / down between tiers, keeping the column you were in (the big tile remembers it)
    const r = (B.row + (k.d ? 1 : HUB_GRID.length - 1)) % HUB_GRID.length;
    if (B.row > 0) m.col = B.col;
    m.cur = idAt(r, Math.min(HUB_GRID[r].length - 1, r === 0 ? 0 : (m.col ?? 1)));
  }
  if ((k.l || k.r) && HUB_GRID[B.row].length > 1) { const n = HUB_GRID[B.row].length, c = (B.col + (k.r ? 1 : n - 1)) % n; m.col = c; m.cur = idAt(B.row, c); }
  HUB_OPTS.forEach((o, i) => { const T = HUB_BTN(i); if (clicked(T.x, T.y, T.w, T.h)) { m.cur = i; k.ok = true; } });
  if (k.ok) hubChoose(game, HUB_OPTS[m.cur].id);
}
// a tile's line broken into rows that fit its width (at the dots first, then between words); the last row gets an ellipsis if cut
function hubWrap(str, size, maxW, rows) {
  const out = [];
  for (const part of (typeof tr === 'function' ? tr(String(str)) : String(str)).split(' · ')) {   // (LANGUAGE: translated whole, then cut)
    let line = ''; const sp = trSp();
    for (const w of trSplit(part)) { const t = line ? line + sp + w : w; if (textW(t, size) <= maxW || !line) line = t; else { out.push(line); line = w; } }
    if (line) out.push(line);
  }
  if (out.length > rows) { out.length = rows; let l = out[rows - 1]; while (l.length > 1 && textW(l + '…', size) > maxW) l = l.slice(0, -1); out[rows - 1] = l.trimEnd() + '…'; }
  return out;
}
// HUB DRESSING: the ornate gold corners of the HUD panel art round every tile and the player card (edges and corners only,
// so what is inside shows), a little picture in each tile, and a showcase glow behind the hero
function hubFrame(x, y, w, h, k = 0.5) {
  const im = img('assets/hud_panel_warm.png'); if (!im || !im.complete || !im.naturalWidth) return false;
  const N = im.naturalWidth, cw = 17, ch = 12, rt = 3, rh = 9, CW = Math.round(cw * k), CH = Math.round(ch * k), RT = Math.round(rt * k), RH = Math.max(2, Math.round(rh * k));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, N / 3, rt, N / 3, rh, x + CW, y + RT, w - CW * 2, RH);                       // the top rim
  ctx.drawImage(im, N / 3, N - ch, N / 3, rh, x + CW, y + h - CH, w - CW * 2, RH);              // the bottom rim
  ctx.drawImage(im, 0, 0, cw, ch, x, y, CW, CH); ctx.drawImage(im, N - cw, 0, cw, ch, x + w - CW, y, CW, CH);               // the corner swirls
  ctx.drawImage(im, 0, N - ch, cw, ch, x, y + h - CH, CW, CH); ctx.drawImage(im, N - cw, N - ch, cw, ch, x + w - CW, y + h - CH, CW, CH);
  ctx.restore(); return true;
}
// ADVENTURE's window shows the real Hearthvale: the first time the hub is drawn, the town is built off to the side (the same
// way the title screen builds it), one frame of it is drawn and kept as a picture, and the world is let go
let HUB_SNAP = null, HUB_SNAP_TRIED = false;
function hubSnapshot(game, now) {
  if (HUB_SNAP || HUB_SNAP_TRIED) return HUB_SNAP; HUB_SNAP_TRIED = true;
  try {
    const w = makeOverworld(game, { x: ALTAR.x, y: ALTAR.y + 40 }); w.player.alpha = 0; w.showTags = false; w.actors = w.actors.filter(a => a === w.player);   // (just the town: no townsfolk and their name tags)
    const cam = { x: Math.round(clamp(ALTAR_W.x - WVW / 2, w.bounds.x0, w.bounds.x1 - WVW)), y: Math.round(ALTAR_W.y - WVH / 2 - 127) };   // (aimed north of the fountain: the row of houses, the hall and the fountain in front)
    ctx.save(); drawWorld(w, cam, w.bg, now); ctx.restore();
    const c = document.createElement('canvas'); c.width = ctx.canvas.width; c.height = ctx.canvas.height; c.getContext('2d').drawImage(ctx.canvas, 0, 0);
    HUB_SNAP = c;
  } catch (e) { HUB_SNAP = null; }
  return HUB_SNAP;
}
// (the painted stand-in, if the town could not be drawn) Hearthvale at dusk, hills, pines, a lit cottage, the road west, drifting clouds and fireflies
function hubVista(x, y, w, h, now, dim) {
  ctx.save(); rrect(ctx, x, y, w, h, 6); ctx.clip();
  if (HUB_SNAP) {   // the real town, a window around the fountain square, with a few fireflies
    const R = HUB_SNAP.width / VW, sw = Math.min(VW, w * 2), sh = Math.min(VH, h * 2), sx = VW / 2 - sw / 2, sy = VH / 2 - sh / 2;   // (twice the area, halved: more of the town in view)
    ctx.imageSmoothingEnabled = false; ctx.drawImage(HUB_SNAP, sx * R, sy * R, sw * R, sh * R, x, y, w, h);
    const vg = ctx.createLinearGradient(0, y, 0, y + h); vg.addColorStop(0, 'rgba(255,220,170,0.10)'); vg.addColorStop(1, 'rgba(20,13,8,0.25)'); ctx.fillStyle = vg; ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 6; i++) { const fx = x + w * (0.2 + ((i * 0.151 + now / 30000) % 0.75)), fy = y + h * (0.3 + 0.5 * ((i * 0.37) % 1)) + Math.sin(now / 1100 + i) * 4; if (Math.sin(now / 420 + i * 2.3) > 0.3) { ctx.fillStyle = 'rgba(255,250,200,0.9)'; ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1); ctx.fillStyle = 'rgba(255,250,200,0.25)'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3); } }
    if (dim) { ctx.fillStyle = 'rgba(10,8,18,0.3)'; ctx.fillRect(x, y, w, h); }
    ctx.restore(); return;
  }
  const sky = ctx.createLinearGradient(0, y, 0, y + h); sky.addColorStop(0, '#24305e'); sky.addColorStop(0.55, '#a8607a'); sky.addColorStop(0.85, '#f0b070'); sky.addColorStop(1, '#f8d090');
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 14; i++) { const sx = x + ((i * 53.3) % w), sy = y + 4 + ((i * 29.7) % (h * 0.35)), tw = 0.5 + 0.5 * Math.sin(now / 600 + i * 2.1); ctx.fillStyle = `rgba(255,250,230,${0.25 + 0.5 * tw})`; ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1); }   // first stars
  const sunX = x + w * 0.68, sunY = y + h * 0.62;
  const sg = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 40); sg.addColorStop(0, 'rgba(255,236,170,0.95)'); sg.addColorStop(0.25, 'rgba(255,200,120,0.5)'); sg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sg; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#fff0c0'; ctx.beginPath(); ctx.arc(sunX, sunY, 9, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i++) { const cx = x + ((now / (90 + i * 40) + i * 90) % (w + 60)) - 30, cy = y + 14 + i * 9; ctx.fillStyle = `rgba(255,220,220,${0.18 - i * 0.03})`; ctx.beginPath(); ctx.ellipse(cx, cy, 18 - i * 3, 3.5, 0, 0, Math.PI * 2); ctx.ellipse(cx + 9, cy - 2, 9, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  const hill = (base, amp, f, ph, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + h); for (let px = 0; px <= w; px += 3) ctx.lineTo(x + px, y + base + Math.sin(px / f + ph) * amp + Math.sin(px / (f * 0.37) + ph * 2) * amp * 0.3); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill(); };
  hill(h * 0.66, 5, 34, 1.2, '#5a4a78');
  hill(h * 0.74, 4, 26, 3.1, '#34506a');
  for (let i = 0; i < 9; i++) { const tx = x + 8 + i * (w / 9) + ((i * 37) % 11), ty = y + h * 0.78 + ((i * 13) % 5), th = 9 + (i * 7) % 6; ctx.fillStyle = '#402a1b'; ctx.beginPath(); ctx.moveTo(tx, ty - th); ctx.lineTo(tx - 4, ty); ctx.lineTo(tx + 4, ty); ctx.closePath(); ctx.fill(); }   // pines
  hill(h * 0.86, 3, 40, 0.4, '#362417');
  // the cottage with a warm window
  const hx = x + w * 0.3, hy = y + h * 0.84; ctx.fillStyle = '#2a2030'; ctx.fillRect(hx - 7, hy - 8, 14, 8); ctx.beginPath(); ctx.moveTo(hx - 9, hy - 8); ctx.lineTo(hx, hy - 15); ctx.lineTo(hx + 9, hy - 8); ctx.closePath(); ctx.fill();
  const wl = 0.75 + 0.25 * Math.sin(now / 900); ctx.fillStyle = `rgba(255,210,120,${wl})`; ctx.fillRect(hx - 4, hy - 6, 3, 3); ctx.fillRect(hx + 2, hy - 6, 2, 3);
  // the road west, winding toward the sun
  ctx.strokeStyle = 'rgba(232,200,140,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w * 0.45, y + h); ctx.quadraticCurveTo(x + w * 0.62, y + h * 0.9, x + w * 0.66, y + h * 0.8); ctx.stroke();
  for (let i = 0; i < 7; i++) { const fx = x + w * (0.15 + ((i * 0.137 + now / 26000 * (i % 2 ? 1 : -1)) % 0.8 + 0.8) % 0.8), fy = y + h * (0.72 + 0.18 * Math.sin(now / 1300 + i * 1.7)), on = Math.sin(now / 380 + i * 2.3) > 0.2; if (on) { ctx.fillStyle = 'rgba(220,255,140,0.9)'; ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1); ctx.fillStyle = 'rgba(220,255,140,0.25)'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3); } }   // fireflies
  if (dim) { ctx.fillStyle = 'rgba(10,8,18,0.35)'; ctx.fillRect(x, y, w, h); }
  ctx.restore();
}
// each mode tile's picture, on its right-hand side
function hubArt(o, T, on, locked, now, pr) {
  const x = T.x, y = T.y + (on ? -2 : 0), w = T.w, h = T.h, a = locked ? 0.3 : on ? 1 : 0.75;
  ctx.save(); rrect(ctx, x, y, w, h, 6); ctx.clip(); ctx.globalAlpha = a;
  if (o.id === 'ranked') {   // the league you are climbing toward, big and slowly turning its light
    const P = pvpOf(pr), L = Math.min(LEAGUES.length - 1, leagueOf(P.rp) + 1), cx = x + w - 30, cy = y + h - 30;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34); g.addColorStop(0, hexA(o.col, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    leagueEmblem(cx, cy, 17, L, now);
  } else if (o.id === 'online') {   // three heroes side by side
    const fr = [8, 7, 3, 4, 10].filter(c => c !== pr.cls && CLASSES[c]);   // (two friends who look nothing alike: Morpice, Ecne, the Mage…)
    [[-26, fr[0]], [0, pr.cls], [26, fr[1]]].forEach(([dx, c], i) => { try { drawPlayerPreview(c, c === pr.cls ? pr.look : null, null, 'idle', 2, x + w - 34 + dx * 0.8, y + h - 6, 1.15, now + i * 300); } catch (e) {} });
  } else if (o.id === 'training') {   // the straw dummy, rocking gently
    ctx.save(); ctx.translate(x + w - 30, y + h - 8); ctx.scale(1.5, 1.5); drawTrainingDummy({ x: 0, y: 0, label: '', wob: 120 + 100 * Math.sin(now / 700) }, now); ctx.restore();
  } else if (o.id === 'deck') {   // a fan of your best cards
    const top = (pr.cards || []).slice().sort((p, q) => (q.tier || 0) - (p.tier || 0)).slice(0, 3);
    top.forEach((c, i) => { ctx.save(); ctx.translate(x + w - 22 + (i - 1) * 7, y + h + 6); ctx.rotate((i - 1) * 0.22); try { drawCardFront(c, -9, -30, 18, 26, now, { small: true }); } catch (e) {} ctx.restore(); });   // (smaller and further right since the MARKET tile narrowed this row, 2026-11-19)
  } else if (o.id === 'summon') {   // the card floats in a bloom of light: two rings of rays turning opposite ways, a sheen sliding
    // across its face every couple of seconds, and little four-point sparkles twinkling around it
    const cx = x + w - 30, cy = y + h / 2 + 1 + Math.sin(now / 900) * 1.5, k = 0.5 + 0.5 * Math.sin(now / 700), CW = 22, CH = 32;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34); bl.addColorStop(0, `rgba(255,190,230,${0.45 + 0.2 * k})`); bl.addColorStop(0.45, 'rgba(200,140,255,0.16)'); bl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bl; ctx.fillRect(cx - 40, cy - 40, 80, 80);
    for (const [n, spd, len, col] of [[10, 1, 38, '255,200,235'], [7, -1.6, 30, '255,236,170']]) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(spd * now / 5000);
      for (let i = 0; i < n; i++) { ctx.rotate(Math.PI * 2 / n); const rg = ctx.createLinearGradient(0, 0, 0, -len); rg.addColorStop(0, `rgba(${col},${0.3 + 0.15 * k})`); rg.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(-4, -len); ctx.lineTo(4, -len); ctx.lineTo(1.5, 0); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(now / 1400) * 0.06);
    try { drawCardBack(-CW / 2, -CH / 2, CW, CH, now, { glow: `rgba(255,170,230,${0.7 + 0.3 * k})`, blur: (6 + 5 * k) * RES }); } catch (e) {}
    const sk = (now % 2400) / 2400;   // the sheen: a bright diagonal band crossing the card
    if (sk < 0.4) { ctx.save(); ctx.beginPath(); ctx.rect(-CW / 2, -CH / 2, CW, CH); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; const bx = -CW / 2 - 12 + (CW + 24) * (sk / 0.4); ctx.translate(bx, 0); ctx.rotate(0.45); const sg = ctx.createLinearGradient(-6, 0, 6, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(-6, -CH, 12, CH * 2); ctx.restore(); }
    ctx.restore();
    for (let i = 0; i < 5; i++) {   // sparkles
      const t = ((now / 1600) + i * 0.23) % 1, an = i * 1.37 + 0.6, rr = 17 + (i % 3) * 4, sx = cx + Math.cos(an) * rr, sy = cy + Math.sin(an) * rr * 0.9, sz = 3.2 * Math.sin(t * Math.PI);
      if (sz <= 0.3) continue;
      ctx.fillStyle = i % 2 ? '#ffe6a0' : '#ffd0f0'; ctx.beginPath();
      for (let j = 0; j < 8; j++) { const r2 = j % 2 ? sz * 0.25 : sz, a2 = j * Math.PI / 4; ctx.lineTo(sx + Math.cos(a2) * r2, sy + Math.sin(a2) * r2); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}
// the showcase behind the hero: a soft glow in the league's colour, slow light rays and a few motes drifting up
function hubShowcase(cx, cy, col, now) {
  { const n = parseInt(col.slice(1), 16), m = (v, w) => Math.round(v + (w - v) * 0.7), h = v => v.toString(16).padStart(2, '0'); col = n >= 0 && col.length === 7 ? '#' + h(m(n >> 16, 200)) + h(m((n >> 8) & 255, 190)) + h(m(n & 255, 255)) : '#ffe6a0'; }   // (toward a soft lilac light: gold over the dark card turned muddy brown)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';   // (added as light, so it brightens rather than muddies)
  const g = ctx.createRadialGradient(cx, cy - 34, 4, cx, cy - 34, 78); g.addColorStop(0, hexA(col, 0.6)); g.addColorStop(0.45, hexA(col, 0.24)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 84, cy - 116, 168, 136);
  ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy - 34); ctx.rotate(now / 9000);
  for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); const rg = ctx.createLinearGradient(0, 0, 0, -64); rg.addColorStop(0, hexA(col, 0.3)); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -64); ctx.lineTo(5, -64); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < 9; i++) { const k = ((now / (3200 + i * 400) + i * 0.137) % 1), mx = cx + Math.sin(i * 2.4 + now / 1500) * (18 + i * 4), my = cy - 4 - k * 90; ctx.fillStyle = `rgba(255,240,200,${0.55 * Math.sin(k * Math.PI)})`; ctx.fillRect(Math.round(mx), Math.round(my), 1, 1); }
}
// one tile: dark glass with a thin frame; the chosen one lifts, glows in its mode's colour and carries a slow light sweep
function hubTile(o, T, on, locked, now, pr) {
  const big = T.row === 0, lift = on ? -2 : 0, x = T.x, y = T.y + lift;
  ctx.save();
  ctx.shadowColor = on ? hexA(o.col, 0.7) : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = (on ? 10 : 4) * RES; ctx.shadowOffsetY = on ? 0 : 1.5 * RES;
  const g = ctx.createLinearGradient(0, y, 0, y + T.h);
  g.addColorStop(0, on ? 'rgba(48,36,22,0.95)' : 'rgba(32,21,13,0.9)'); g.addColorStop(1, on ? 'rgba(24,16,10,0.92)' : 'rgba(9,7,16,0.88)');
  ctx.fillStyle = g; rrect(ctx, x, y, T.w, T.h, 6); ctx.fill();
  ctx.restore();
  if (big) {   // ADVENTURE looks out over Hearthvale at dusk, fading into the tile on its left
    const vx = x + T.w * 0.48, vw = T.w * 0.52 - 4;
    hubVista(vx, y + 4, vw, T.h - 8, now, !on);
    const fg = ctx.createLinearGradient(vx, 0, vx + 60, 0); fg.addColorStop(0, on ? 'rgba(48,36,22,1)' : 'rgba(32,21,13,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.fillRect(vx, y + 4, 60, T.h - 8);
  } else hubArt(o, T, on, locked, now, pr);
  // a wash of the mode's colour from the left, stronger on the big tile
  const wg = ctx.createLinearGradient(x, 0, x + T.w * 0.7, 0); wg.addColorStop(0, hexA(o.col, locked ? 0.05 : on ? 0.22 : big ? 0.12 : 0.08)); wg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wg; rrect(ctx, x, y, T.w, T.h, 6); ctx.fill();
  ctx.strokeStyle = on ? hexA(o.col, 0.9) : locked ? 'rgba(150,140,120,0.3)' : 'rgba(200,170,110,0.35)'; ctx.lineWidth = on ? 1.2 : 0.7; rrect(ctx, x + 2.5, y + 2.5, T.w - 5, T.h - 5, 5); ctx.stroke();   // an inner line in the mode's colour
  ctx.save(); if (locked) ctx.globalAlpha = 0.55; if (!hubFrame(x - 3, y - 3, T.w + 6, T.h + 6, big ? 0.62 : 0.5)) { ctx.strokeStyle = goldFrameGrad(y, T.h); ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, T.w - 1, T.h - 1, 6); ctx.stroke(); } ctx.restore();   // the ornate gold corners
  { const bv = ctx.createLinearGradient(0, y + 3, 0, y + 10); bv.addColorStop(0, 'rgba(255,255,255,0.10)'); bv.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = bv; ctx.fillRect(x + 4, y + 3, T.w - 8, 7); }   // a glassy top bevel
  if (on) {   // the light sweep
    ctx.save(); rrect(ctx, x, y, T.w, T.h, 6); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    const k = ((now / 1800) % 1.4) - 0.2, sx = x + k * T.w, sg = ctx.createLinearGradient(sx - 34, 0, sx + 34, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,240,200,0.14)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(x, y, T.w, T.h); ctx.restore();
  }
  const ic = locked ? 'rgba(160,150,130,0.5)' : on ? o.col : hexA(o.col, 0.75), dim = locked ? '#8a826e' : null;
  const sub = o.id === 'summon' ? `${o.sub} · ${pr.coins || 0} coins` : o.sub;
  if (big) {   // ADVENTURE: a big icon in a ring, a large title, its line, and an Enter cue
    const cx = x + 44, cy = y + T.h / 2, pulse = on ? 0.5 + 0.5 * Math.sin(now / 520) : 0;
    ctx.strokeStyle = hexA(o.col, 0.35 + 0.35 * pulse); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = hexA(o.col, 0.1 + 0.08 * pulse); ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    text(o.icon, cx, cy + 1, ic, 30);
    if (on) goldText(o.title, x + 84 + goldTextW(o.title, 17) / 2, y + 36, 17, { spacing: 2, glow: hexA(o.col, 0.7) });
    else text(o.title, x + 84, y + 36, '#f0e8d0', 16, 'left');
    hubWrap(sub, 7.5, T.w * 0.48 - 70, 3).forEach((s, i) => text(s, x + 84, y + 56 + i * 10, on ? '#f0ecff' : '#b8b0a0', 7.5, 'left', false));
    if (on) { const ew = textW('Enter ▶', 8) + 12; ctx.fillStyle = 'rgba(10,8,18,0.7)'; rrect(ctx, x + T.w - 14 - ew, y + T.h - 22, ew, 13, 6.5); ctx.fill(); ctx.strokeStyle = hexA(o.col, 0.7); ctx.lineWidth = 0.7; rrect(ctx, x + T.w - 13.6 - ew, y + T.h - 21.6, ew - 0.8, 12.2, 6); ctx.stroke(); text('Enter ▶', x + T.w - 14 - ew / 2, y + T.h - 15.4, o.col, 8); }
  } else if (T.row === 1) {   // a mode tile: icon, title, and its line broken at the dots
    text(o.icon, x + 18, y + 18, ic, 15);
    if (on && !locked) goldText(o.title, x + 34 + goldTextW(o.title, 9.5) / 2, y + 18, 9.5, { spacing: 1, glow: hexA(o.col, 0.6) });
    else text(o.title, x + 34, y + 18, dim || '#e8e2cf', 9, 'left');
    hubWrap(sub, 6.5, T.w - 84, 4).forEach((s, i) => text(s, x + 12, y + 38 + i * 9, dim || (on ? '#f0ecff' : '#a8a08c'), 6.5, 'left', false));
  } else {   // a utility tile: slimmer, icon and title with the line under
    text(o.icon, x + 16, y + T.h / 2, ic, 13);
    if (on && !locked) goldText(o.title, x + 30 + goldTextW(o.title, 8.5) / 2, y + 17, 8.5, { spacing: 1, glow: hexA(o.col, 0.6) });
    else text(o.title, x + 30, y + 17, dim || (o.id === 'quit' ? '#b8b0a0' : '#e8e2cf'), 8, 'left');
    hubWrap(o.id === 'summon' ? `${pr.coins || 0} coins` : sub, 6.3, T.w - (o.id === 'quit' || o.id === 'market' ? 40 : o.id === 'deck' ? 62 : 76), 2).forEach((s1, i) => text(s1, x + 30, y + 30 + i * 9, dim || (on ? '#f0ecff' : '#9a917c'), 6.3, 'left', false));
  }
  if (locked) {   // a locked mode teases rather than clutters: a small lock tag in the corner
    const s = `LOCKED · Lv ${locked}`, tw = textW(s, 6) + 10;
    const ly = y + T.h - 16;   // (bottom-right, clear of the title)
    ctx.fillStyle = 'rgba(8,6,14,0.8)'; rrect(ctx, x + T.w - tw - 6, ly, tw, 10, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,140,0.5)'; ctx.lineWidth = 0.6; rrect(ctx, x + T.w - tw - 5.6, ly + 0.4, tw - 0.8, 9.2, 5); ctx.stroke();
    text(s, x + T.w - 6 - tw / 2, ly + 5.2, '#d8ccb0', 6);
  }
}
function drawHub(game, m, now) {
  const pr = game.profile, P = pvpOf(pr), L = leagueOf(P.rp), st = profileStats(pr), C = HUB_L.card;
  hubSnapshot(game, now);   // (once: drawn here, then painted over by the arena)
  arenaBackdrop(now);
  goldText('ZENONIA ARENA', VW / 2, 18, 16, { glow: 'rgba(255,200,80,0.6)', spacing: 3 });
  text('C A R D   H U N T E R S', VW / 2, 33, '#e8e2ff', 7);
  // ---- the PLAYER CARD
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * RES; ctx.shadowOffsetY = 2 * RES;
  const cg = ctx.createLinearGradient(0, C.y, 0, C.y + C.h); cg.addColorStop(0, 'rgba(36,24,15,0.9)'); cg.addColorStop(1, 'rgba(8,6,16,0.92)');
  ctx.fillStyle = cg; rrect(ctx, C.x, C.y, C.w, C.h, 8); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(200,170,110,0.35)'; ctx.lineWidth = 0.7; rrect(ctx, C.x + 2.5, C.y + 2.5, C.w - 5, C.h - 5, 7); ctx.stroke();
  if (!hubFrame(C.x - 4, C.y - 4, C.w + 8, C.h + 8, 0.62)) { ctx.strokeStyle = goldFrameGrad(C.y, C.h); ctx.lineWidth = 1; rrect(ctx, C.x + 0.5, C.y + 0.5, C.w - 1, C.h - 1, 8); ctx.stroke(); }
  const cx = C.x + C.w / 2, divider = y => { const dg = ctx.createLinearGradient(C.x + 10, 0, C.x + C.w - 10, 0); dg.addColorStop(0, 'rgba(232,190,100,0)'); dg.addColorStop(0.5, 'rgba(232,190,100,0.6)'); dg.addColorStop(1, 'rgba(232,190,100,0)'); ctx.fillStyle = dg; ctx.fillRect(C.x + 10, y, C.w - 20, 0.8); };
  // league, RP, record and coins
  leagueEmblem(C.x + 26, C.y + 26, 15, L, now);
  const lt = `${LEAGUES[L].toUpperCase()} LEAGUE`;
  goldText(lt, C.x + 48 + goldTextW(lt, 8.5) / 2, C.y + 19, 8.5, { spacing: 1 });
  text(L >= LEAGUES.length - 1 ? `${P.rp} RP · the top` : `${P.rp % RP_PER_LEAGUE} / ${RP_PER_LEAGUE} RP to ${LEAGUES[L + 1]}`, C.x + 48, C.y + 31, '#e8e2ff', 6, 'left');
  rpBar(C.x + 48, C.y + 37, C.w - 60, P.rp, now);
  text(`W ${P.wins} · L ${P.losses}${P.streak > 1 ? ` · ${P.streak} streak!` : ''}`, C.x + 12, C.y + 56, P.streak > 1 ? '#ffd23f' : '#c9c1a8', 6.5, 'left');
  coinIcon(C.x + C.w - 50, C.y + 56, 8); text(`${pr.coins || 0}`, C.x + C.w - 43, C.y + 56, '#ffd23f', 6.5, 'left');
  divider(C.y + 66);
  // the hero, big, on a pedestal lit in the league's colour
  const col = RANK_COL[L] === 'rainbow' ? '#ffffff' : RANK_COL[L];
  hubShowcase(cx, C.y + 172, col, now);
  heroPedestal(pr.cls, pr.look, st.look, cx, C.y + 172, 4, now, col, 2, 'idle');   // (idle only: the win pose's particles turned into blocky specks at this size)
  text(`${(pr.look && pr.look.name) || 'Hero'}`, cx, C.y + 193, '#ffffff', 10);
  text(`Lv ${pr.lv || 1} ${className(pr.cls)}`, cx, C.y + 204, '#bfe6ff', 7);
  divider(C.y + 212);
  // POWER
  ctx.fillStyle = 'rgba(8,6,16,0.75)'; rrect(ctx, C.x + 10, C.y + 218, C.w - 20, 22, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,120,0.55)'; ctx.lineWidth = 0.8; rrect(ctx, C.x + 10.5, C.y + 218.5, C.w - 21, 21, 6); ctx.stroke();
  text('POWER', C.x + 22, C.y + 229.5, '#e8c878', 6.5, 'left');
  goldText(powerOf(pr).toLocaleString(), C.x + C.w - 22 - goldTextW(powerOf(pr).toLocaleString(), 12) / 2, C.y + 230, 12, { glow: 'rgba(255,200,80,0.6)', spacing: 1 });
  // (TODAY fills the card's foot: unlocks.js drawHubToday)
  // ---- the MODES
  HUB_OPTS.forEach((o, i) => hubTile(o, HUB_BTN(i), m.cur === i, hubLocked(pr, o.id), now, pr));
  text('↑↓←→ choose · Enter / click', HUB_L.right.x + HUB_L.right.w, HUB_L.util.y + HUB_L.util.h + 14, '#9a917c', 6.5, 'right');
}

// ---------------------------------------------------------------- VS intro (ranked)
// (a choice of NPC or person was tried on 2026-11-20 and taken out the same day at the user's word: ranked is against NPC rivals)
function vsMenu(game) { return { type: 'vs', t: 0, rival: makeRival(game.profile) }; }
const VS_LEN = 3000;
function updateVs(game, m, dt) {
  const before = m.t; m.t += dt;
  if (before < 700 && m.t >= 700 && typeof SFX !== 'undefined') SFX.smite();
  if (before < 2350 && m.t >= 2350 && typeof SFX !== 'undefined') SFX.kill();
  if (hit('Escape')) { game.closeMenu(); return; }
  if (m.t >= VS_LEN || (m.t > 900 && hit('Enter', 'Space', 'KeyJ'))) {
    const R = m.rival;
    game.closeMenu();
    game.goArena(R.p2, true);
    game.arena.ranked = R; game.arena.cpuSkill = cpuSkillFor(R.league);
  }
}
function drawVs(game, m, now) {
  const pr = game.profile, R = m.rival, t = m.t, P = pvpOf(pr);
  const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const shake = t > 700 && t < 1000 ? (Math.random() - 0.5) * 8 * (1 - (t - 700) / 300) : 0;
  ctx.save(); ctx.translate(shake, shake * 0.5);
  // split background: red vs blue, divided by a slanted line of lightning
  const cut = k => VW / 2 + 40 - k * 80;
  ctx.fillStyle = '#1a0408'; ctx.fillRect(-10, -10, VW + 20, VH + 20);
  const gl = ctx.createLinearGradient(0, 0, VW / 2, 0); gl.addColorStop(0, '#5a0a14'); gl.addColorStop(1, '#c0283a');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(cut(0), -10); ctx.lineTo(cut(1), VH + 10); ctx.lineTo(-10, VH + 10); ctx.fill();
  const gr = ctx.createLinearGradient(VW / 2, 0, VW, 0); gr.addColorStop(0, '#1a4ac0'); gr.addColorStop(1, '#081a5a');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(cut(0), -10); ctx.lineTo(VW + 10, -10); ctx.lineTo(VW + 10, VH + 10); ctx.lineTo(cut(1), VH + 10); ctx.fill();
  // speed lines streaming toward the centre
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1, y = (i * 53) % VH, k = ((now / 400) + i * 0.17) % 1;
    const x = side < 0 ? -60 + k * (VW / 2) : VW + 60 - k * (VW / 2);
    ctx.globalAlpha = 0.25 * Math.sin(k * Math.PI); ctx.fillStyle = side < 0 ? '#ffb0a0' : '#b0d0ff';
    ctx.fillRect(x, y, 70 * side, 1.5);
  }
  ctx.restore();
  // heroes slide in from the sides
  const kL = ease(t / 600), kR = ease((t - 150) / 600);
  const leftX = -120 + kL * 280, rightX = VW + 120 - kR * 280;
  heroPedestal(pr.cls, pr.look, profileStats(pr).look, leftX, 240, 4, now, '#ff8a7a', 1, t > 2350 ? 'atk1' : 'idle');
  heroPedestal(R.p2.cls, R.p2.look, profileStats(R.p2).look, rightX, 240, 4, now, '#7fc0ff', 3, t > 2350 ? 'atk1' : 'idle');
  // name plates
  const plate = (x, align, name, sub, L, pw, col) => {
    ctx.save(); ctx.globalAlpha = clamp((t - 400) / 300, 0, 1);
    goldText(name.toUpperCase(), x, 280, 12, { spacing: 1, glow: hexA(col, 0.7) });
    text(sub, x, 294, '#ffffff', 7);
    text(`${LEAGUES[L]} League · POWER ${pw.toLocaleString()}`, x, 306, col, 7);
    ctx.restore();
  };
  plate(leftX, 'center', (pr.look && pr.look.name) || 'Hero', `Lv ${pr.lv || 1} ${className(pr.cls)}`, leagueOf(P.rp), powerOf(pr), '#ffb0a0');
  plate(rightX, 'center', R.name, `Lv ${R.p2.lv} ${className(R.p2.cls)}`, R.league, R.power, '#b0d0ff');
  // the clash: lightning down the divide and a punching VS
  if (t > 650) {
    const a = clamp(1 - (t - 650) / 1800, 0.25, 1);
    strokeLightning(cut(0), -10, cut(1), VH + 10, Math.floor(t / 90), 2.4, a, null, 4, LAYER_ELS.lightning);
    if (t < 900) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 650) / 250)})`; ctx.fillRect(0, 0, VW, VH); }
    const pop = 1 + 1.4 * Math.max(0, 1 - (t - 650) / 220);
    goldText('VS', VW / 2, 150, 44 * pop, { glow: 'rgba(255,220,120,0.9)', spacing: 2 });
  }
  goldText('RANKED MATCH', VW / 2, 34, 13, { spacing: 3, glow: 'rgba(255,200,80,0.5)' });
  text('Best of 3 rounds', VW / 2, 50, '#e8e2ff', 7);
  if (t > 2350) {
    const k = clamp((t - 2350) / 200, 0, 1);
    ctx.save(); ctx.globalAlpha = k;
    goldText('FIGHT!', VW / 2, 200, 30 * (1.6 - 0.6 * k), { glow: 'rgba(255,90,60,0.9)', spacing: 3, cols: ['#ffffff', '#ffd860', '#ff5a1a', '#ffe8a0'] });
    ctx.restore();
  }
  ctx.restore();
  if (t > 900) text('Enter: skip', VW - 10, VH - 8, 'rgba(255,255,255,0.5)', 6, 'right');
}

// ---------------------------------------------------------------- match results (ranked)
function finishRanked(game, won) {
  const pr = game.profile, P = pvpOf(pr), A = game.arena, R = A.ranked;
  if (A.resolved) return; A.resolved = true;
  const from = P.rp, L0 = leagueOf(from), rewards = [];
  if (won) {
    P.wins++; P.streak++;
    const gain = 25 + Math.min(15, (P.streak - 1) * 3) + (R.power > powerOf(pr) ? 5 : 0);
    P.rp += gain;
    const coins = 2 + Math.floor(R.league / 2);
    pr.coins = (pr.coins || 0) + coins; rewards.push(`◆ +${coins} summon coins`);
    if (Math.random() < 0.45) {
      const mobs = SPECIES_IDS.filter(id => D.monsters[id]);
      const c = makeCard(pick(mobs), Math.min(9, R.league + (Math.random() < 0.2 ? 1 : 0)));
      game.pickup({ kind: 'card', item: c }); rewards.push(`🂠 ${RANKS[c.tier]} ${SPECIES[c.sp].name} card`);
    }
    if (Math.random() < 0.3) {
      const g = makeGear(pick(GEAR_SLOTS), Math.min(9, R.league), pr.cls);
      game.pickup({ kind: 'gear', item: g }); rewards.push(`⚔ ${RANKS[g.tier]} ${g.name}`);
    }
    game.gainExp(killExp(Math.min(9, R.league)) * 5); rewards.push('★ battle EXP');
  } else {
    P.losses++; P.streak = 0;
    P.rp = Math.max(0, P.rp - 15);
    pr.coins = (pr.coins || 0) + 1; rewards.push('◆ +1 summon coin (for your courage)');
  }
  P.best = Math.max(P.best, P.rp);
  game.toasts = [];
  game.save();
  game.openMenu({ type: 'pvpres', t: 0, won, from, to: P.rp, L0, L1: leagueOf(P.rp), rewards, rival: R });
}
function updatePvpRes(game, m, dt) {
  m.t += dt;
  if (m.t < 600) return;
  if (hit('Enter', 'Space', 'KeyJ') || clicked(VW / 2 - 150, 300, 140, 24)) { game.goHub(); game.openMenu(vsMenu(game)); }
  else if (hit('Escape') || clicked(VW / 2 + 10, 300, 140, 24)) game.goHub();
}
function drawPvpRes(game, m, now) {
  const t = m.t;
  ctx.fillStyle = 'rgba(4,2,10,0.62)'; ctx.fillRect(0, 0, VW, VH);
  // rays behind the title
  if (m.won) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(VW / 2, 82); ctx.rotate(now / 3000);
    for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI / 7); const g = ctx.createLinearGradient(0, 0, 180, 0); g.addColorStop(0, 'rgba(255,215,120,0.3)'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(180, -16); ctx.lineTo(180, 16); ctx.lineTo(0, 6); ctx.fill(); }
    ctx.restore();
  }
  const pop = 1 + 0.8 * Math.max(0, 1 - t / 220);
  if (m.won) goldText('VICTORY', VW / 2, 82, 34 * pop, { glow: 'rgba(255,200,80,0.9)', spacing: 4 });
  else goldText('DEFEAT', VW / 2, 82, 34 * pop, { spacing: 4, cols: ['#e8e0e0', '#b08080', '#5a2a2a', '#c8a0a0'], glow: 'rgba(120,20,20,0.8)' });
  text(`vs ${m.rival.name} · ${LEAGUES[m.rival.league]} League`, VW / 2, 110, '#e8e2ff', 8);
  // RP counter animating from old to new
  const k = clamp((t - 500) / 1200, 0, 1), shown = Math.round(m.from + (m.to - m.from) * (1 - Math.pow(1 - k, 3)));
  const Ls = leagueOf(shown);
  leagueEmblem(VW / 2 - 104, 150, 20, Ls, now);
  goldText(`${LEAGUES[Ls].toUpperCase()} LEAGUE`, VW / 2 + 10, 140, 11, { spacing: 1 });
  rpBar(VW / 2 - 76, 152, 170, shown, now, shown);
  const d = m.to - m.from;
  text(`${shown} RP`, VW / 2 - 76, 167, '#e8e2ff', 7.5, 'left');
  text(`${d >= 0 ? '+' : ''}${d} RP`, VW / 2 + 94, 167, d >= 0 ? '#8fffb0' : '#ff8a8a', 9, 'right');
  if (m.L1 > m.L0 && k >= 1) {   // promotion burst
    const p2 = 1 + 0.5 * Math.max(0, 1 - (t - 1700) / 250);
    goldText(`PROMOTED TO ${LEAGUES[m.L1].toUpperCase()}!`, VW / 2, 192, 14 * p2, { glow: 'rgba(255,220,120,0.9)', spacing: 2 });
  } else if (m.L1 < m.L0 && k >= 1) text(`Dropped to ${LEAGUES[m.L1]} League`, VW / 2, 192, '#ff8a8a', 9);
  // rewards
  m.rewards.forEach((r, i) => {
    ctx.save(); ctx.globalAlpha = clamp((t - 900 - i * 200) / 250, 0, 1);
    const coin = r.startsWith('◆ '), s = coin ? r.slice(2) : r, y = 218 + i * 14;   // coin rewards get the coin icon instead of the ◆
    text(s, VW / 2 + (coin ? 6 : 0), y, '#ffe9a8', 8.5);
    if (coin) coinIcon(VW / 2 + 6 - textW(s, 8.5) / 2 - 8, y, 11);
    ctx.restore();
  });
  // buttons
  if (t > 600) {
    [['NEXT MATCH (Enter)', VW / 2 - 150, '#ffd23f'], ['HUB (Esc)', VW / 2 + 10, '#c9c1a8']].forEach(([s, x, c]) => {
      panel(x, 300, 140, 24, c, 'rgba(30,20,13,0.92)'); text(s, x + 70, 312, c, 8.5);
    });
  }
}

// ---------------------------------------------------------------- adventure: pick a zone
const ZONE_COLS = ['#4ab85a', '#8a5ad8', '#e8602a', '#7ad8ff'];
function zonesMenu() {
  return { type: 'zones', cur: 0, t: 0, rec: ZONES.map(Z => powerOf(randomProfile(0, Z.ranks[0]))) };
}
const ZONE_CARD = i => { const n = ZONES.length, step = Math.min(152, (VW - 32) / n); return { x: (VW - step * n) / 2 + 6 + i * step, y: 70, w: step - 12, h: 220 }; };   // (the cards share the width, however many zones)
function updateZones(game, m, dt) {
  m.t += dt;
  const k = navInput(), n = ZONES.length;
  if (k.l) m.cur = (m.cur + n - 1) % n;
  if (k.r) m.cur = (m.cur + 1) % n;
  for (let i = 0; i < n; i++) { const C = ZONE_CARD(i); if (clicked(C.x, C.y, C.w, C.h)) { if (m.cur === i) k.ok = true; m.cur = i; } }
  if (k.back) { game.closeMenu(); return; }
  if (k.ok) { game.closeMenu(); game.goAdventure(); }
}
function drawZones(game, m, now) {
  arenaBackdrop(now, 0.7);
  goldText('ADVENTURE', VW / 2, 26, 18, { spacing: 3, glow: 'rgba(255,200,80,0.6)' });
  text('Every zone is open. Hunt cards, gear and goods, then bring your power back to the Arena.', VW / 2, 46, '#e8e2ff', 7.5);
  const my = powerOf(game.profile);
  ZONES.forEach((Z, i) => {
    const C = ZONE_CARD(i), on = m.cur === i, col = ZONE_COLS[i % ZONE_COLS.length], lift = on ? -6 : 0;
    ctx.save(); ctx.shadowColor = on ? hexA(col, 0.9) : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = (on ? 12 : 4) * RES;
    const g = ctx.createLinearGradient(0, C.y, 0, C.y + C.h); g.addColorStop(0, hexA(col, on ? 0.55 : 0.3)); g.addColorStop(0.5, 'rgba(24,16,10,0.95)'); g.addColorStop(1, 'rgba(6,4,12,0.98)');
    ctx.fillStyle = g; rrect(ctx, C.x, C.y + lift, C.w, C.h, 8); ctx.fill(); ctx.restore();
    ctx.strokeStyle = on ? goldFrameGrad(C.y, C.h) : hexA(col, 0.5); ctx.lineWidth = on ? 1.5 : 1; rrect(ctx, C.x + 0.5, C.y + lift + 0.5, C.w - 1, C.h - 1, 8); ctx.stroke();
    // a monster of the zone, big
    const sp = (Z.cardMob && D.monsters[Z.cardMob] && Z.cardMob) || Z.mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0];   // (a zone may name its own: the desert's Sun Guardian)
    if (sp) { ctx.save(); ctx.beginPath(); rrect(ctx, C.x + 6, C.y + lift + 30, C.w - 12, 80, 6); ctx.clip(); monsterPreview(sp, C.x + 20, C.y + lift + 34, C.w - 40, 76, Z.ranks[1], now); ctx.restore(); }
    goldText(Z.name.toUpperCase(), C.x + C.w / 2, C.y + lift + 16, 9.5, { spacing: 1, glow: hexA(col, 0.6) });
    text(`Ranks ${RANKS[Z.ranks[0]]} – ${RANKS[Z.ranks[1]]}`, C.x + C.w / 2, C.y + lift + 124, rankColor(Z.ranks[1], now), 8);
    const rp = m.rec[i], ok = my >= rp * 0.8;
    text(`Recommended power ${rp.toLocaleString()}`, C.x + C.w / 2, C.y + lift + 140, ok ? '#8fffb0' : '#ff8a8a', 6.8);
    wrap(ZONE_TAG[i] || Z.desc, C.w - 16, 6.8).slice(0, 3).forEach((ln, j) => text(ln, C.x + C.w / 2, C.y + lift + 160 + j * 10, '#c9c1a8', 6.8, 'center', false));
    text(`${zoneRegions(i).length} areas · ${typeof DESERT !== 'undefined' && i === DESERT.zone ? 'the Sun Temple' : 'Guardian boss'}`, C.x + C.w / 2, C.y + lift + C.h - 28, '#e8c878', 6.8);
    if (on) text('▶ ENTER', C.x + C.w / 2, C.y + lift + C.h - 12, '#ffd23f', 8.5);
  });
  text(`Your power: ${my.toLocaleString()}   ·   ←→ choose · Enter: go · Esc: back · in the Wilds press H to return to the Hub`, VW / 2, VH - 14, '#c9c1a8', 7);
}

// ---------------------------------------------------------------- adventure: the pause menu (Esc, or the ☰ Menu button)
const PAUSE_OPTS = [
  { id: 'resume', title: 'RESUME', sub: 'Back to the hunt', col: '#8fffb0' },
  { id: 'inv', title: 'INVENTORY', sub: 'Cards, gear, stats and Layer', col: '#e0b0ff' },
  { id: 'hub', title: 'RETURN TO MAIN MENU', sub: 'Back to the Arena hub (progress is saved)', col: '#ffd23f' },
  { id: 'quit', title: 'SAVE & EXIT', sub: 'Back to the title screen', col: '#c9c1a8' },
];
const PAUSE_BTN = i => { const g = Math.min(40, 252 / PAUSE_OPTS.length); const y0 = 92 - Math.max(0, PAUSE_OPTS.length - 7) * 6; return { x: VW / 2 - 120, y: y0 + i * g, w: 240, h: Math.min(34, g - 5) }; };   // (closer together, and starting higher, as other files add options, so the list always fits above the footer)
const MENU_CORNER = { x: VW - 72, y: VH - 20, w: 66, h: 15 };
function pauseMenu() { return { type: 'pause', cur: 0, t: 0, confirm: null }; }
function updatePause(game, m, dt) {
  m.t += dt;
  const k = navInput(), n = PAUSE_OPTS.length, w = game.world, inside = w && (w.cave || w.rift);
  if (k.u) { m.cur = (m.cur + n - 1) % n; m.confirm = null; }
  if (k.d) { m.cur = (m.cur + 1) % n; m.confirm = null; }
  for (let i = 0; i < n; i++) { const B = PAUSE_BTN(i); if (clicked(B.x, B.y, B.w, B.h)) { if (m.cur === i) k.ok = true; else m.confirm = null; m.cur = i; } }
  if (k.back && m.t > 120) { game.closeMenu(); return; }
  if (!k.ok) return;
  const id = PAUSE_OPTS[m.cur].id;
  // leaving from inside a black hole or rift forfeits it: ask once
  if (inside && ['hub', 'quit'].includes(id) && m.confirm !== id) { m.confirm = id; return; }
  if (id === 'resume') game.closeMenu();
  else if (id === 'inv') game.openMenu(inventoryMenu(game));
  else if (id === 'hub') { if (leadingBlocks(game)) return; game.closeMenu(); game.goHub(); }
  else if (id === 'quit') { const pr = game.profile; game.save(); game.saved = pr; game.backToTitle(); }
}
const PAUSE_ICONS = { resume: '▶', inv: '❖', hub: '⌂', quit: '◀', settings: '⚙', guide: '✎', unlocks: '✧', album: '▣' };
function drawPause(game, m, now) {
  ctx.fillStyle = 'rgba(14,8,4,0.68)'; ctx.fillRect(0, 0, VW, VH);
  goldText('PAUSED', VW / 2, 52, 22, { spacing: 4, glow: 'rgba(255,200,80,0.6)' });
  const w = game.world;
  text(w && w.name ? w.name : 'Adventure', VW / 2, 74, '#f0e6d0', 7.5);
  if (game.profile && typeof drawWeekStrip === 'function') drawWeekStrip(game.profile, VW / 2 + 132, 96);   // THIS WEEK, beside the buttons (journey.js)
  if (game.profile) text(`Played today ${fmtShort(playTodayMs(game.profile))}  ·  in all ${fmtPlay(game.profile.playMs || 0)}`, VW / 2, 84, '#c9b48a', 7);   // (journey.js)
  PAUSE_OPTS.forEach((o, i) => {
    const B = PAUSE_BTN(i), sel = i === m.cur, hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
    // (dressed like the hub's tiles: dark glass, a wash of the row's colour, gold corners, a glassy bevel, and an icon)
    const lit = sel || hov, y = B.y;
    ctx.save(); ctx.shadowColor = lit ? hexA(o.col, 0.7) : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = (lit ? 9 : 3) * RES;
    const g = ctx.createLinearGradient(0, y, 0, y + B.h); g.addColorStop(0, sel ? 'rgba(62,42,24,0.96)' : 'rgba(38,25,16,0.92)'); g.addColorStop(1, sel ? 'rgba(28,18,10,0.94)' : 'rgba(18,11,7,0.9)');   // (dark cocoa, like the other windows)
    ctx.fillStyle = g; rrect(ctx, B.x, y, B.w, B.h, 5); ctx.fill(); ctx.restore();
    const wg = ctx.createLinearGradient(B.x, 0, B.x + B.w * 0.6, 0); wg.addColorStop(0, hexA(o.col, sel ? 0.24 : 0.08)); wg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wg; rrect(ctx, B.x, y, B.w, B.h, 5); ctx.fill();
    ctx.strokeStyle = sel ? hexA(o.col, 0.9) : 'rgba(200,170,110,0.3)'; ctx.lineWidth = sel ? 1.1 : 0.7; rrect(ctx, B.x + 2.5, y + 2.5, B.w - 5, B.h - 5, 4); ctx.stroke();
    if (typeof hubFrame === 'function') hubFrame(B.x - 2, y - 2, B.w + 4, B.h + 4, 0.34);
    { const bv = ctx.createLinearGradient(0, y + 3, 0, y + 9); bv.addColorStop(0, 'rgba(255,255,255,0.09)'); bv.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = bv; ctx.fillRect(B.x + 4, y + 3, B.w - 8, 6); }
    if (sel) {   // a slow light sweep across the chosen row
      ctx.save(); rrect(ctx, B.x, y, B.w, B.h, 5); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      const k = ((now / 1800) % 1.4) - 0.2, sx = B.x + k * B.w, sg = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,240,200,0.13)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(B.x, y, B.w, B.h); ctx.restore();
    }
    const warn = m.confirm === o.id, ic = PAUSE_ICONS[o.id] || '✦', ty = y + B.h * 0.37, sy = y + B.h * 0.7;   // (title and line placed by the row's height, clear of the rims)
    text(ic, B.x + 16, y + B.h / 2, sel ? o.col : hexA(o.col, 0.7), 11);
    if (sel && !warn) goldText(o.title, B.x + 30 + goldTextW(o.title, 8.5) / 2, ty, 8.5, { spacing: 1, glow: hexA(o.col, 0.6) });
    else text(warn ? 'PRESS AGAIN TO LEAVE' : o.title, B.x + 30, ty, warn ? '#ff8a8a' : '#e8e2cf', 8.5, 'left');
    text(warn ? (w && w.cave ? 'The black hole and its boss will be lost' : 'The rift will be lost') : (typeof hubWrap === 'function' ? hubWrap(o.sub, 6.3, B.w - 42, 1)[0] : o.sub), B.x + 30, sy, sel ? '#fff4e0' : '#a8a08c', 6.3, 'left');
  });
  text('↑↓ choose · Enter select · Esc resume', VW / 2, VH - 14, '#9a917c', 7);
}
// the little ☰ Menu button in the corner of the adventure screen
function drawMenuCorner(now) {
  const B = MENU_CORNER, hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
  // (in the keycap style of the hint strip: a soft pill, ☰ Menu, and a gold-edged Esc keycap; brighter under the mouse)
  ctx.fillStyle = hov ? 'rgba(62,41,26,0.9)' : 'rgba(22,15,9,0.55)'; rrect(ctx, B.x, B.y, B.w, B.h, B.h / 2); ctx.fill();
  if (hov) { ctx.strokeStyle = 'rgba(255,210,63,0.8)'; ctx.lineWidth = 0.7; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, B.h / 2); ctx.stroke(); }
  text('☰ Menu', B.x + 6, B.y + B.h / 2 + 0.4, hov ? '#ffd23f' : '#e8e2cf', 6.5, 'left');
  const kw = textW('Esc', 6) + 7, kx = B.x + B.w - kw - 3, ky = B.y + B.h / 2 - 5, g = ctx.createLinearGradient(0, ky, 0, ky + 10);
  g.addColorStop(0, 'rgba(70,56,96,0.98)'); g.addColorStop(1, 'rgba(44,29,18,0.98)'); ctx.fillStyle = g; rrect(ctx, kx, ky, kw, 10, 2.5); ctx.fill();
  ctx.strokeStyle = 'rgba(232,190,100,0.85)'; ctx.lineWidth = 0.6; rrect(ctx, kx + 0.3, ky + 0.3, kw - 0.6, 9.4, 2.5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(kx + 1.5, ky + 1, kw - 3, 0.7);
  text('Esc', kx + kw / 2, ky + 5.3, '#ffe9a8', 6);
}
