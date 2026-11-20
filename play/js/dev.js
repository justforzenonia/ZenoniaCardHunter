'use strict';
// DEVELOPER PRIVILEGES — only for OmegaKingX (the Brawler hero). A ⚙ DEV button sits beside the ☰ Menu button
// (or press ` ), opening a panel: teleport to any area (towns, safe points, every road area and its Heights / Depths),
// and toggles and gifts: god mode, double speed, no hunger, heal, gold, coins, levels, the clock, clearing monsters,
// cards, unlocking every waystone, the next season day, auto hatch, an auto-filling Season bar. The toggles live on the profile (pr.dev) so they carry over a save; the hooks are
// devTick (each world frame), speedOf (combat.js) and dealDamage (combat.js).
const isDev = pr => !!(pr && CLASSES[pr.cls] && CLASSES[pr.cls].name === 'OmegaKingX');
// NEXT REAL DAY: the game's real-time clock runs ahead of the computer's by pr.dev.clockMs, read from the profile so it holds
// from the first frame. Everything on the real calendar follows: attendance, the season, crops, daily contracts, coins.
const realClock = Date.now.bind(Date);
Date.now = () => realClock() + ((window.GAME && GAME.profile && GAME.profile.dev && GAME.profile.dev.clockMs) || 0);
const DEV_BTN = { x: VW - 62 - 52, y: VH - 20, w: 48, h: 15 };
const DEV = { panel: { x: 30, y: 26, w: 580, h: 310 }, list: { x: 42, y: 62, w: 300, h: 256, row: 14 }, gold: 10000, coins: 50, killR: 320, tierFill: 4, holdWait: 260, holdStep: 45 };
const devFlags = pr => (pr.dev = pr.dev || { god: false, speed: false, food: false });
const devOn = (F, k) => k === 'nocd' ? F.nocd !== false : !!F[k];   // (no cooldowns starts switched on)

// every place you can jump to, Hearthvale first
function devPlaces() {
  const out = [{ label: 'Hearthvale (home)', col: '#ffd27a', dest: { home: true } }];
  OUTPOSTS.forEach((O, i) => O && out.push({ label: `${O.name} (town)`, col: '#ffd27a', dest: { town: i } }));
  ZONES.forEach((Z, z) => out.push({ label: `${Z.name} · safe point`, col: SAFE_COLS[z % 6], dest: { z } }));
  for (let i = REGIONS.length - 1; i >= 0; i--) {
    const r = REGIONS[i]; if (r.zone < 0) continue;
    const col = SAFE_COLS[r.zone % 6];
    out.push({ label: regionName(i), col, dest: { x: (r.ox + r.w / 2) * T, y: (r.oy + r.h / 2) * T } });
    for (const u of r.subs || []) out.push({ label: `   ↳ ${u.below ? 'Depths' : 'Heights'}`, full: `${regionName(i)} · ${u.below ? 'Depths' : 'Heights'}`, col: u.below ? '#ff8a8a' : '#9fe8ff', dest: { x: (u.ox + u.w / 2) * T, y: (u.oy + u.h / 2) * T } });
  }
  return out;
}
// a walkable, reachable spot near (x, y)
function devOpenSpot(w, x, y) {
  for (let r = 0; r < 600; r += 8) for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (mapReach(w.map, px, py) && !w.blocked(px, py)) return { x: px, y: py };
    if (r === 0) break;
  }
  return findOpen(w, x, y);
}
function devTeleport(game, P) {
  const d = P.dest;
  if (d.home) { travelTo(game, null); return; }
  if (d.town != null || d.z != null) { travelTo(game, d); return; }
  game.goTown('home');
  const w = game.world, p = w.player, at = devOpenSpot(w, d.x, d.y);
  p.x = at.x; p.y = at.y; p.vx = p.vy = 0;
  for (const a of w.actors) if (a.ally && a.owner === p) { a.x = p.x + rand(-20, 20); a.y = p.y + 10; }
  w.region = regionIndexAt(p.x); w.name = regionName(w.region);
  w.rings.push({ x: p.x, y: p.y, r: 34, t: 0, col: '#ffd23f' }, { x: p.x, y: p.y, r: 20, t: -120, col: '#ffffff' });
  game.toast(`DEV · teleported to ${P.full || P.label.trim()}`, '#ffd23f');
}
// each world frame: the toggles take effect on the hero
function devTick(game, w) {
  const pr = game.profile, p = w.player; if (!p) return;
  if (!isDev(pr)) { p.devGod = false; p.devSpeed = 0; return; }
  const F = devFlags(pr);
  p.devGod = F.god; p.devSpeed = F.speed ? 2 : 0;
  if (F.god) { p.hp = Math.max(p.hp, 1); p.mp = p.maxMp; }
  if (F.food) pr.hunger = 100;
  if (F.ki && pr.chi) { p.chi = CHI.max; if (p.chiT > 0) p.chiT = CHI.max / kiDrain(pr.chi); }   // the Ki gauge never falls
  if (F.tier && seasonTier(seasonState(pr)) < SEASON.tiers) seasonGain(game, DEV.tierFill);   // the Season bar climbs by itself
  if (F.hatch) {   // no bone yet: one is handed over if need be, and its dog comes straight away
    if (!pr.drake) giveDrakeEgg(game);
    if (!drakeHatched(pr.drake)) { pr.drake.grown = DRAKE.stages[1].need; game.toast('A dog comes for the bone! A Pup joins you', '#ffd25a'); respawnDog(game, 'drake'); game.save(); }
  }
  if (F.nocd !== false) {   // no cooldowns (on unless switched off): skills, dash, Layer and anything else on a timer, and no exhaustion after a Layer
    if (p.cds) p.cds.fill(0);
    for (const k in p) if (k.endsWith('Cd') && p[k] > 0) p[k] = 0;
    p.exhausted = 0;
  }
}
// the panel's actions (right column), two per row
const DEV_ACTS = [
  { id: 'god', label: 'GOD MODE', toggle: 'god', d: 'take no damage, endless MP' },
  { id: 'speed', label: 'SPEED ×2', toggle: 'speed', d: 'move twice as fast' },
  { id: 'food', label: 'NO HUNGER', toggle: 'food', d: 'hunger stays full' },
  { id: 'nocd', label: 'NO COOLDOWNS', toggle: 'nocd', d: 'every skill, dash and Layer is ready at once' },
  { id: 'heal', label: 'HEAL ALL', d: 'full HP and MP' },
  { id: 'gold', label: '+10,000 G', d: 'gold' },
  { id: 'coins', label: '+50 COINS', d: 'summon coins' },
  { id: 'lv1', label: 'LEVEL +1', d: 'one level up' },
  { id: 'lv10', label: 'LEVEL +10', d: 'ten levels up' },
  { id: 'time', label: '+3 HOURS', d: 'move the clock on' },
  { id: 'kill', label: 'CLEAR AREA', d: 'defeat every monster nearby' },
  { id: 'card', label: 'RANDOM CARD', d: 'a card of a random rank' },
  { id: 'sss', label: 'SSS+ CARD', d: 'a top-rank card' },
  { id: 'stones', label: 'ALL WAYSTONES', d: 'unlock every safe point and town stone' },
  { id: 'hole', label: 'BLACK HOLE', d: 'open a black hole beside you (each press: a rank higher)' },
  { id: 'nextday', label: 'NEXT REAL DAY', d: 'move the real calendar on 24 hours: attendance, season, crops and dailies' },
  { id: 'ki', label: 'UNLIMITED KI', toggle: 'ki', d: 'the Ki gauge stays full and Ki form never ends' },
  { id: 'spring', label: 'HEALING POND', d: 'a healing spring beside you, for 45 seconds' },
  { id: 'season', label: 'NEXT SEASON DAY', d: 'the season alone moves on a day: days left, its week, its daily caps. Opens the Season' },
  { id: 'hatch', label: 'AUTO DOG', toggle: 'hatch', d: 'an Old Bone if you have none, and its dog comes at once' },
  { id: 'tier', label: 'AUTO FILL TIER', toggle: 'tier', d: 'the Season bar fills by itself, about a tier a second, up to tier 30' },
  { id: 'petform', label: 'DOG TRANSFORM', d: 'unlock the dog Transformation now (its Layer count filled, the skill learned, ready to change)' },
  { id: 'plv1', label: 'PARTNER LV +1', d: 'your partner goes up a level, with its Bond Card' },
  { id: 'plv10', label: 'PARTNER LV +10', d: 'your partner goes up ten levels, with their Bond Cards' },
  { id: 'gate', label: 'TELEPORTER', d: 'a dark teleporter beside you, with an evil NPC behind it' },
  { id: 'evilwin', label: 'EVIL NPC WIN', d: 'in the Dark Court: beat the evil NPC and their familiar at once' },
  { id: 'close', label: 'CLOSE', d: '` or Esc' },
];
const devActRect = i => ({ x: 360 + (i % 2) * 120, y: 62 + Math.floor(i / 2) * 20, w: 112, h: 19 });
function devAct(game, id) {
  const pr = game.profile, w = game.world, p = w && w.player, F = devFlags(pr);
  const A = DEV_ACTS.find(a => a.id === id);
  if (A.toggle) { F[A.toggle] = devOn(F, A.toggle) ? false : true; game.toast(`DEV · ${A.label} ${F[A.toggle] ? 'ON' : 'OFF'}`, F[A.toggle] ? '#8fffd0' : '#c9c1a8'); game.save(); return; }
  if (id === 'close') { game.closeMenu(); return; }
  if (id === 'spring') { if (!w || !w.overworld || w.interior) { game.toast('DEV · springs well up only outdoors', '#ff8a8a'); return; } devSpring(game, w); game.toast('DEV · a healing spring wells up beside you', '#9fd8ff'); game.closeMenu(); return; }
  if (id === 'nextday') { F.clockMs = (F.clockMs || 0) + 864e5; game.toast(`DEV · next real day · ${Math.round(F.clockMs / 864e5)} ahead of your clock`, '#ffd23f'); game.save(); game.closeMenu(); return; }
  if (id === 'season') {   // the season alone moves on: its days left, its week, its daily caps. The real calendar stays put (that's NEXT REAL DAY)
    const S = seasonState(pr); S.start--; S.kills = S.farm = 0; seasonTick(game); const N = pr.season;
    game.toast(`DEV · season ${N.no}, day ${dayNo() - N.start + 1} of ${SEASON.days}`, '#ffd23f'); game.save(); game.closeMenu(); game.openMenu(seasonMenu()); return;
  }
  if (id === 'heal' && p) { p.hp = p.maxHp; p.mp = p.maxMp; pr.hunger = 100; }
  if (id === 'gold') pr.gold = (pr.gold || 0) + DEV.gold;
  if (id === 'coins') pr.coins = (pr.coins || 0) + DEV.coins;
  if (id === 'lv1' || id === 'lv10') for (let k = 0; k < (id === 'lv1' ? 1 : 10) && pr.lv < MAX_LV; k++) game.gainExp(Math.max(1, expNeed(pr.lv) - (pr.exp || 0)));
  if (id === 'plv1' || id === 'plv10') { const Q = partnerOf(pr); if (!Q || Q.dead) { game.toast('DEV · no living partner', '#ff8a8a'); return; } for (let k = 0; k < (id === 'plv1' ? 1 : 10) && Q.lv < 99; k++) partnerExp(game, Math.max(1, expNeed(Q.lv) - Q.xp)); game.toast(`DEV · ${Q.name} is now Lv ${Q.lv}`, '#ffd23f'); game.save(); return; }
  if (id === 'gate') { if (!w || !w.overworld || w.interior) { game.toast('DEV · teleporters open only outdoors', '#ff8a8a'); return; } const at = devOpenSpot(w, p.x + 50, p.y); evilGateAt(w, at.x, at.y); game.toast('DEV · a dark teleporter opens beside you', '#c88aff'); game.closeMenu(); return; }
  if (id === 'evilwin') { if (!w || !w.rift || !w.rift.evil) { game.toast('DEV · only in the Dark Court', '#ff8a8a'); return; } for (const m of w.actors) if (m.evil && !m.dead) { m.invuln = 0; dealDamage(w, p, m, { base: 1e8, spell: true }); } game.closeMenu(); return; }
  if (id === 'petform') {   // (pet.js: the skill unlocks after PET_FORM.uses Layers with the dog beside you)
    const ks = petsOf(pr); if (!ks.length) { game.toast('DEV · no dog yet (AUTO DOG brings one)', '#ff8a8a'); return; }
    for (const k of ks) { const P = petOf(pr, k); P.layerUses = Math.max(P.layerUses || 0, PET_FORM.uses); P.sk.transform = 1; P.formCd = 0; }
  }
  if (id === 'time') pr.clock = ((pr.clock || 0) + DAY.len / 8) % DAY.len;
  if (id === 'kill' && w && p) { let n = 0; for (const m of w.actors) if (m.kind === 'monster' && !m.ally && !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < DEV.killR) { m.invuln = 0; dealDamage(w, p, m, { base: 1e7, spell: true }); n++; } game.toast(`DEV · cleared ${n} monster${n === 1 ? '' : 's'}`, '#ffd23f'); game.save(); return; }
  if ((id === 'card' || id === 'sss') && pr.cards.length < 200) { const c = makeCard(pick(SPECIES_IDS), id === 'sss' ? 9 : Math.floor(Math.random() * 10)); pr.cards.push(c); game.toast(`DEV · ${cardName(c)} (${RANKS[c.tier]})`, '#ffd23f'); game.save(); return; }
  if (id === 'hole') {   // a black hole of this zone beside you; each press opens it a grade higher, wrapping round
    if (!w || !w.overworld || w.interior) { game.toast('DEV · black holes open only in the Wilds', '#ff8a8a'); return; }
    if (!w.caves) initCaves(w);
    const R = REGIONS[regionIndexAt(p.x)], zi = R && R.zone >= 0 ? R.zone : 0, c = w.caves[zi], top = 9 - ZONES[zi].ranks[0];
    F.holeGrade = ((F.holeGrade ?? -1) + 1) % (top + 1);
    const at = devOpenSpot(w, p.x + 80, p.y);
    Object.assign(c, { open: true, x: at.x, y: at.y, t: CAVE.life, grade: F.holeGrade, eaten: 0, fed: 0, announced: true, guarded: false });
    game.toast(`DEV · a rank ${RANKS[caveRank(c)]} black hole opens beside you`, '#c88aff'); game.closeMenu(); return;
  }
  if (id === 'stones') { pr.safePts = pr.safePts || {}; pr.townStones = pr.townStones || {}; ZONES.forEach((Z, z) => { pr.safePts[z] = true; }); OUTPOSTS.forEach((O, i) => { if (O) pr.townStones[i] = true; }); }
  game.toast(`DEV · ${A.label}`, '#ffd23f'); game.save();
}

function devMenu() { return { type: 'dev', cur: 0, scroll: 0, places: devPlaces() }; }
// the scrollbar's thumb
function devBar(m, rows) { const L = DEV.list, n = m.places.length, h = Math.max(16, L.h * rows / n); return { x: L.x + L.w + 1, y: L.y + (L.h - h) * (m.scroll / Math.max(1, n - rows)), w: 3, h }; }
function updateDev(game, m, dt = 16) {
  const L = DEV.list, rows = Math.floor(L.h / L.row), n = m.places.length, B = devBar(m, rows);
  if (hit('Escape', 'Backquote')) { game.closeMenu(); return; }
  // the arrow keys step, and held they run on down the list; the view follows the selection only when it moves
  const dir = isDown('ArrowDown', 'KeyS') ? 1 : isDown('ArrowUp', 'KeyW') ? -1 : 0; let step = hit('ArrowDown', 'KeyS') ? 1 : hit('ArrowUp', 'KeyW') ? -1 : 0;
  if (step || !dir) { m.holdT = 0; } else { m.holdT = (m.holdT || 0) + dt; if (m.holdT >= DEV.holdWait + DEV.holdStep) { m.holdT -= DEV.holdStep; step = dir; } }
  if (step) { m.cur = Math.max(0, Math.min(n - 1, m.cur + step)); if (m.cur < m.scroll) m.scroll = m.cur; if (m.cur >= m.scroll + rows) m.scroll = m.cur - rows + 1; }
  if (mouse.wheel) { if (mouse.x < L.x + L.w + 10) m.scroll += Math.sign(mouse.wheel) * 3; mouse.wheel = 0; }
  if (!mouse.down) m.barDrag = false; else if (n > rows && clicked(B.x - 1, L.y, B.w + 6, L.h)) m.barDrag = true;   // hold the scrollbar and drag
  if (m.barDrag) m.scroll = Math.round((mouse.y - L.y - B.h / 2) / (L.h - B.h) * (n - rows));
  m.scroll = Math.max(0, Math.min(m.scroll, n - rows));
  if (hit('Enter')) { devTeleport(game, m.places[m.cur]); game.closeMenu(); return; }
  for (let i = 0; i < rows; i++) {
    const k = m.scroll + i; if (k >= n) break;
    if (clicked(L.x, L.y + i * L.row, L.w, L.row)) { m.cur = k; devTeleport(game, m.places[k]); game.closeMenu(); return; }
  }
  DEV_ACTS.forEach((A, i) => { const R = devActRect(i); if (clicked(R.x, R.y, R.w, R.h)) devAct(game, A.id); });
}
function drawDev(game, m, now) {
  const pr = game.profile, F = devFlags(pr), P = DEV.panel, L = DEV.list, rows = Math.floor(L.h / L.row);
  ctx.fillStyle = 'rgba(4,6,12,0.7)'; ctx.fillRect(0, 0, VW, VH);
  shrinePlate(P.x, P.y, P.w, P.h);
  goldTitle('⚙ DEVELOPER', VW / 2, P.y + 13, 12, now);
  text('OmegaKingX', P.x + P.w - 14, P.y + 13, '#ffd23f', 7, 'right');
  // teleport list
  text('TELEPORT', L.x, L.y - 10, '#ffe9a8', 8, 'left'); text(`${m.places.length} places · click or ↑↓ Enter`, L.x + L.w, L.y - 10, '#8a94a8', 6, 'right');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, L.x - 4, L.y - 2, L.w + 8, L.h + 4, 4); ctx.fill();
  const here = game.world && game.world.name;
  for (let i = 0; i < rows; i++) {
    const k = m.scroll + i, Pl = m.places[k]; if (!Pl) break;
    const y = L.y + i * L.row, hov = hovered(L.x, y, L.w, L.row), sel = k === m.cur;
    if (sel || hov) { ctx.fillStyle = sel ? 'rgba(255,216,96,0.18)' : 'rgba(255,255,255,0.06)'; rrect(ctx, L.x - 2, y, L.w + 4, L.row - 1, 3); ctx.fill(); }
    ctx.fillStyle = Pl.col; ctx.fillRect(L.x + 2, y + 4, 3, L.row - 8);
    text(Pl.label, L.x + 10, y + L.row / 2, sel ? '#ffffff' : '#c8d0de', 7, 'left');
    if (here && Pl.label === here) text('● here', L.x + L.w - 4, y + L.row / 2, '#8fffd0', 6, 'right');
  }
  if (m.places.length > rows) {   // the scrollbar
    const B = devBar(m, rows);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(L.x + L.w + 1, L.y, 3, L.h); ctx.fillStyle = m.barDrag ? '#ffd860' : '#8a94a8'; ctx.fillRect(B.x, B.y, B.w, B.h);
  }
  // powers
  text('POWERS', 360, L.y - 10, '#ffe9a8', 8, 'left');
  let tip = null;
  DEV_ACTS.forEach((A, i) => {
    const R = devActRect(i), hov = hovered(R.x, R.y, R.w, R.h), on = A.toggle && devOn(F, A.toggle);
    ctx.save(); ctx.shadowColor = on ? '#8fffd0' : hov ? '#ffd860' : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = (on || hov ? 6 : 3) * RES; ctx.shadowOffsetY = hov ? 0 : 1.5 * RES;
    const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
    if (on) { g.addColorStop(0, '#4ad8a0'); g.addColorStop(1, '#14664a'); } else { g.addColorStop(0, hov ? '#5a6a8a' : '#4a5670'); g.addColorStop(0.5, '#442d1d'); g.addColorStop(1, '#22160e'); }
    ctx.fillStyle = g; rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.fill(); ctx.restore();
    ctx.strokeStyle = on ? '#c8ffe8' : hov ? '#ffd860' : '#8a94a8'; ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(R.x + 5, R.y + 1.6, R.w - 10, 0.8);
    text(A.label, R.x + R.w / 2, R.y + (A.toggle ? 7.5 : R.h / 2 + 0.4), '#ffffff', 7.5);
    if (A.toggle) text(on ? 'ON' : 'OFF', R.x + R.w / 2, R.y + 15.5, on ? '#e8fff4' : '#8a94a8', 6);
    if (hov) tip = A.d;
  });
  text(tip || `Lv ${pr.lv} · ${pr.gold || 0} G · ${pr.coins || 0} coins · ${pr.cards.length} cards`, 480, P.y + P.h - 12, tip ? '#ffe9a8' : '#8a94a8', 6.6);
  text('` or Esc: close', P.x + 14, P.y + P.h - 12, '#8a94a8', 6.6, 'left');
}
// the ⚙ DEV button beside ☰ Menu, and a strip of the powers that are on
function drawDevButton(game, now) {
  const pr = game.profile; if (!isDev(pr)) return;
  const B = DEV_BTN, hov = hovered(B.x, B.y, B.w, B.h), F = devFlags(pr);
  panel(B.x, B.y, B.w, B.h, hov ? '#ffd23f' : 'rgba(255,210,63,0.7)', hov ? 'rgba(62,46,10,0.95)' : 'rgba(30,22,6,0.85)');
  text('⚙ DEV  `', B.x + B.w / 2, B.y + B.h / 2 + 0.4, '#ffd23f', 6.5);
  const on = [F.god && 'GOD', F.speed && '×2', F.food && 'FED', F.ki && 'KI', F.hatch && 'DOG', F.tier && 'TIER'].filter(Boolean);
  if (on.length) text(on.join(' · '), B.x + B.w / 2, B.y - 6, '#8fffd0', 6);
}
