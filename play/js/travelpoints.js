'use strict';
// TRAVEL POINTS AND GODDESS SHRINES, EVERY FIVE AREAS (2026-11-13, the user's list: "add travel points in the stop at 5" and
// "every 5 something… spring goddess, buy 1 of a kind weapon from various anime"; "every 5 areas", "original, anime-style").
//   TRAVEL POINT  a waystone in the 5th and 10th area of every zone (counted from the town outward, as the journey map shows
//                 them; the safe point at the far end is about the 15th). Touch one to keep it. Enter at any lit waystone opens
//                 TRAVEL, which now lists them under their zone.
//   GODDESS       beside each travel point a crystal shrine of a goddess of the seasons. She has one weapon nobody else has, made
//                 for your class: an original anime-style name, a little stronger than the zone's best, with its bonus powers.
//                 One of each, ever; she asks gold for it.
//   JOURNEY MAP   darker behind the lanes; area names at 7 px; the next story goal shows a gold ★ NEXT; travel points (◆) and the
//                 goddess (✿) show on their areas, lit once found; and in a town the map says where you are.
const TP = { at: [4, 9], touch: 24, col: '#8fe8ff' };
const GODDESSES = [
  ['Haru', 'Goddess of Spring', 'Sakura Dawn'], ['Natsu', 'Goddess of Summer', 'Hoshikaze Starwind'],
  ['Aki', 'Goddess of Autumn', 'Kurenai Crimson'], ['Fuyu', 'Goddess of Winter', 'Yukihime Frostpetal'],
  ['Tsuki', 'Goddess of the Moon', 'Tsukuyomi Moonlight'], ['Hana', 'Goddess of Blossoms', 'Hanabira Petalstorm'],
  ['Sora', 'Goddess of the Sky', 'Sora Skywing'], ['Kaminari', 'Goddess of Thunder', 'Raijin Thunderspark'],
  ['Hikari', 'Goddess of Light', 'Taiyo Sunforge'], ['Kage', 'Goddess of Shadow', 'Shiranui Phantomflame'],
  ['Umi', 'Goddess of the Sea', 'Watatsumi Tidecaller'], ['Hoshi', 'Goddess of the Stars', 'Amaterasu Dawnstar'],
];
// the area a stop stands in: the first stop is the zone's goddess town wherever it lies (worldgen.js keeps it off an outpost town's side), else by count
const stopArea = (z, k) => { const L = zoneAreas(z); return (k === TP.at[0] && typeof isGoddessTown === 'function' && L.find(isGoddessTown)) || L[k]; };
function midStones(w) {
  if (w.midStones) return w.midStones;
  const out = [];
  ZONES.forEach((Z, z) => {
    const L = zoneAreas(z);
    TP.at.forEach((k, j) => {
      const R = stopArea(z, k); if (!R) return;
      const r = rng(WORLD_SEED * 11 + z * 173 + k * 29); let at = null;
      const GT = (WG_MAPS[R.map] || {}).goddessTown;   // (a goddess town: the waystone and the goddess stand on its plaza, worldgen.js)
      if (GT) at = findOpen(w, (R.ox + GT.w[0]) * T + 8, (R.oy + GT.w[1]) * T + 8);
      for (let i = 0; i < 400 && !at; i++) {
        const x = (R.ox + R.w * 0.3 + r() * R.w * 0.4) * T, y = (R.oy + 4 + r() * Math.max(2, R.h - 8)) * T;
        if (mapReach(w.map, x, y) && !w.blocked(x, y) && !mapSolidAt(w.map, x, y - 12) && !mapSolidAt(w.map, x + 14, y) && !mapSolidAt(w.map, x - 14, y)
          && mapReach(w.map, x + 60, y) && !w.blocked(x + 60, y) && !mapSolidAt(w.map, x + 60, y - 12)) at = { x, y };
      }
      if (!at) at = findOpen(w, (R.ox + R.w / 2) * T, (R.oy + R.h / 2) * T);
      const g = GT ? findOpen(w, (R.ox + GT.g[0]) * T + 8, (R.oy + GT.g[1]) * T + 8) : findOpen(w, at.x + 60, at.y), gi = (z * TP.at.length + j) % GODDESSES.length;
      out.push({ z, k, key: `${z}_${k}`, x: at.x, y: at.y, gx: g.x, gy: g.y, R, gi });
    });
  });
  return (w.midStones = out);
}
const tpNear = (w, S, d = 26) => w.player && Math.hypot(w.player.x - S.x, w.player.y - S.y) < d;
const tpGoddessNear = (w, S) => w.player && Math.hypot(w.player.x - S.gx, w.player.y - S.gy) < 28;
function tpTick(game, w) {
  if (!w.overworld || w.interior) return;
  const pr = game.profile, p = w.player; pr.travelPts = pr.travelPts || {};
  for (const S of midStones(w)) {
    if (Math.abs(S.x - p.x) > 400 || pr.travelPts[S.key] || !tpNear(w, S, TP.touch)) continue;
    pr.travelPts[S.key] = true; game.save();
    w.rings.push({ x: S.x, y: S.y, r: 50, t: 0, col: TP.col }, { x: S.x, y: S.y, r: 30, t: -120, col: '#ffffff' });
    game.toast(`TRAVEL POINT found: ${ZONES[S.z].name} · area ${S.k + 1} — travel here from any waystone`, TP.col);
  }
}
// the goddess's one weapon, made the first time you visit her (for the class you play then) and kept
function goddessWeapon(pr, S) {
  pr.goddess = pr.goddess || {};
  let e = pr.goddess[S.key];
  if (!e) {
    const Z = ZONES[S.z], tier = Math.min(9, Z.ranks[1] + (S.k >= 9 ? 1 : 0)), g = makeGear('weapon', tier, pr.cls);
    g.stats.atk = Math.round(g.stats.atk * 1.3); g.name = `${GODDESSES[S.gi][2]} ${CLASSES[pr.cls].weapon}`; g.unique = true; g.goddess = S.key;
    e = pr.goddess[S.key] = { g, sold: false, price: Math.round(gearPrice(g) * 3) };
  }
  return e;
}
function goddessMenu(key) { return { type: 'goddess', key, cur: 0, scroll: 0 }; }
function goddessStone(game, m) { const w = game.world; return w && w.overworld && midStones(w).find(S => S.key === m.key); }
function goddessRows(game, m) {
  const pr = game.profile, S = goddessStone(game, m); if (!S) return [];
  const e = goddessWeapon(pr, S), g = e.g;
  if (e.sold) return [{ icon: g.icon, name: g.name, sub: 'It is yours — there is no other like it', right: 'SOLD', rightCol: '#8fffd0', dim: true, locked: 'She has only the one, and you carry it' }];
  return [{ icon: g.icon, name: g.name, sub: `RANK ${RANKS[g.tier]} · ${gearLines(g).slice(0, 3).join(' · ')}`, right: `${fmtG(e.price)}`, rightCol: (pr.gold || 0) >= e.price ? '#ffd23f' : '#8a6a4a', col: rankColor(g.tier) }];
}
function updateGoddess(game, m) {
  const rows = goddessRows(game, m), nav = panelNav(m, rows.length, 0);
  if (nav.back || !rows.length) { game.closeMenu(); return; }
  if (!nav.ok) return;
  const r = rows[m.cur]; if (r.locked) { game.toast(r.locked, '#c9c1a8'); return; }
  const pr = game.profile, S = goddessStone(game, m), e = goddessWeapon(pr, S);
  if ((pr.gold || 0) < e.price) { game.toast(`Not enough gold (${fmtG(e.price)})`, '#ff8a8a'); return; }
  pr.gold -= e.price; e.sold = true; pr.gear.push({ ...e.g });
  const w = game.world; w.rings.push({ x: S.gx, y: S.gy, r: 40, t: 0, col: '#ffc8e8' }, { x: S.gx, y: S.gy, r: 24, t: -120, col: '#ffffff' });
  game.toast(`${GODDESSES[S.gi][0]} gives you the ${e.g.name} — find it in your bag (Tab)`, '#ffc8e8'); game.save();
}
function drawGoddess(game, m, now) {
  const S = goddessStone(game, m), G = S ? GODDESSES[S.gi] : ['', '', ''];
  panelMenu(m, { title: `${G[0].toUpperCase()} · ${G[1].toUpperCase()}`, rows: goddessRows(game, m), info: '"I keep one weapon, and only one. Take it, if your heart is set on the road ahead."', keys: 'Enter: buy · Esc: close' }, now);
}
{
  const st = safeTick;
  safeTick = (game, w, dt) => { const r = st(game, w, dt); try { tpTick(game, w); } catch (e) {} return r; };
  const ds = drawSafePoints;
  drawSafePoints = (w, now, items) => {
    const r = ds(w, now, items);
    if (!w.overworld || w.interior) return r;
    const pr = window.GAME && GAME.profile, got = (pr && pr.travelPts) || {}, p = w.player;
    for (const S of midStones(w)) {
      if (Math.abs(S.x - p.x) > 460 || Math.abs(S.y - p.y) > 320) continue;
      const lit = !!got[S.key], G = GODDESSES[S.gi];
      items.push({ y: S.y, draw: () => {
        drawWaystone(S.x, S.y, TP.col, lit, now, 'TRAVEL POINT', lit ? `${ZONES[S.z].name} · area ${S.k + 1}` : 'touch it to unlock');
        if (lit && tpNear(w, S)) text('Enter: Travel', S.x, S.y + 12, '#ffe9a8', 7);
      } });
      if (typeof goddessDrawItems === 'function') { goddessDrawItems(w, S, now, items); continue; }   // (the goddess herself, in her garden: goddess.js)
      items.push({ y: S.gy, draw: () => {
        drawWaystone(S.gx, S.gy, '#ffb8e0', true, now, 'SHRINE', `${G[0]} · ${G[1]}`);
        if (tpGoddessNear(w, S)) text('Enter: the goddess', S.gx, S.gy + 12, '#ffe9a8', 7);
      } });
    }
    return r;
  };
  // Enter at a lit travel point or by a goddess (main.js calls this in the Wilds: homeInteract only runs in safe places, so until
  // 2026-11-15 Enter did nothing there, the user: "enter doesnt work")
  window.tpInteract = (game, w) => {
    if (!w || !w.overworld || w.interior || !w.player) return false;
    const pr = game.profile, got = pr.travelPts || {};
    for (const S of midStones(w)) {
      if (Math.abs(S.x - w.player.x) > 80) continue;
      if (got[S.key] && tpNear(w, S)) { game.openMenu(travelMenu()); return true; }
      if (tpGoddessNear(w, S)) { game.openMenu(goddessMenu(S.key)); return true; }
    }
    return false;
  };
  const hi = homeInteract;
  homeInteract = (game, w) => tpInteract(game, w) || hi(game, w);
  // TRAVEL: each zone's travel points under its safe point
  const tr = travelRows;
  travelRows = game => {
    const rows = tr(game), pr = game.profile, got = pr.travelPts || {}, out = [];
    const w = game.world && game.world.overworld ? game.world : game.outside;
    const stones = w ? midStones(w) : [];
    for (const r of rows) {
      out.push(r);
      const z = r.dest && r.dest.z != null ? r.dest.z : r.locked && ZONES.findIndex(Z => r.name === Z.name);
      if (z == null || z < 0 || z === false) continue;
      for (const S of stones.filter(S => S.z === z)) out.push(got[S.key]
        ? { icon: ITEM2_BASE + 940, name: `${ZONES[z].name} · Travel Point ${S.k + 1}`, sub: `area ${S.k + 1} · ${GODDESSES[S.gi][0]}'s shrine stands beside it`, right: 'GO', rightCol: TP.col, dest: { mid: S.key } }
        : { icon: ITEM2_BASE + 1042, name: `${ZONES[z].name} · area ${S.k + 1}`, sub: 'Touch the travel point in that area to unlock it', right: '—', rightCol: '#7a7468', dim: true, locked: `Not found yet — walk to area ${S.k + 1} of the ${ZONES[z].name}` });
    }
    return out;
  };
  const tt = travelTo;
  travelTo = (game, dest) => {
    if (!dest || dest.mid == null) return tt(game, dest);
    game.goTown('home');
    const w = game.world, p = w.player, S = midStones(w).find(q => q.key === dest.mid); if (!S) return;
    p.x = S.x; p.y = S.y + 14; p.vx = p.vy = 0;
    for (const a of w.actors) if (a.ally && a.owner === p) { a.x = p.x + rand(-20, 20); a.y = p.y + 10; }
    w.region = regionIndexAt(p.x); w.name = regionName(w.region);
    w.rings.push({ x: p.x, y: p.y, r: 34, t: 0, col: TP.col }, { x: p.x, y: p.y, r: 20, t: -120, col: '#ffffff' });
    game.toast(`Travelled to the ${ZONES[S.z].name} · area ${S.k + 1}`, TP.col);
  };
}
// ---- the journey map's markers (travel points, shrines, the next story goal) are drawn by drawJourneyMenu in journey.js since the map became a parchment chart (2026-11-20)
