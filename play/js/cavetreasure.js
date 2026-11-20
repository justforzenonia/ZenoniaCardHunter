'use strict';
// CAVE TREASURE (2026-11-20, the user: "the cave seems to have nothing really in it"; chose: treasure). Each rock-cave floor
// (rockcaves.js rcSpawn; not the Ruins, which have their own two chests) now holds a few wooden CRATES and one or two small
// CACHES (a treasure chest) out in its rooms: open floor with room round it (never in a tunnel, so nothing can block the way),
// away from the way in, the stairs and each other. Their spots come from the cave's seed, so they are the same every visit.
// Each crate and cache is filled once per in-game day (rockcaves.js rcToday / rcMark); one already taken today is not there.
// LOOT comes from the cave's own land: crates drop as the Wilds' crates do (a card, gear, goods or a potion), and a cache holds
// gold, two goods and often a card. (Crates in caves used to roll the loot of the overworld under the same x, which in a
// cave meant the first region, a town: a potion every time. caveDrop fixes that for every crate in a cave.)
const CTREAS = { crates: [3, 5], caches: [1, 2], gap: 4 * 16, entry: 7 * 16, deep: 4 * 16, cacheGold: [140, 110] };
const ctreasCave = w => w && (w.rockCave || w.rcRuins);
const ctreasZone = w => { const C = ctreasCave(w), c = C && (C.cave || C); return c && c.zone != null ? c.zone : 0; };
// a crate or cache's loot, from the cave's land (props.js propDrop, with the cave's zone instead of the region under x)
function caveDrop(world, x, y, rich) {
  const Z = ZONES[ctreasZone(world)], game = window.GAME, mobs = Z.mobs.filter(id => D.monsters[id]);
  const card = () => makeCard(pick(mobs), rareGate(Math.min(9, rollRank(Z) + (rich ? 1 : 0))));
  if (rich) {
    world.drops.push({ kind: 'card', item: card(), x: x - 8, y });
    world.drops.push({ kind: 'goods', item: makeGoods(Math.min(9, Z.ranks[1])), x: x + 8, y });
    return;
  }
  const roll = Math.random();
  if (roll < 0.3) world.drops.push({ kind: 'card', item: card(), x, y });
  else if (roll < 0.5) world.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rareGate(rollRank(Z)), game.profile.cls), x, y });
  else if (roll < 0.8) world.drops.push({ kind: 'goods', item: makeGoods(rollRank(Z)), x, y });
  else world.drops.push({ kind: 'potion', item: { tier: 0 }, x, y });
}
{
  const pd = propDrop;
  propDrop = (world, x, y, rich) => ctreasCave(world) ? caveDrop(world, x, y, rich) : pd(world, x, y, rich);
}
// lay a floor's crates and caches
function ctreasLay(game, w, door) {
  if (door.role === 'rcruins' || !door.rcCave) return;
  const C = door.rcCave, f = door.rcFloor || 0, M = MAPS[door.key], pr = game.profile; if (!M || !M.reach) return;
  const key = `${C.key}_f${f}`, R = seededRng([...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, WORLD_SEED ^ 0xc4e7));
  const open = (tx, ty) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy; if (x < 0 || y < 0 || x >= M.w || y >= M.h) return false; const i = y * M.w + x; if (M.solid[i] || !M.reach[i]) return false; } return true; };
  const deep = M.deep ? { x: M.deep[0], y: M.deep[1] } : null, taken = w.objects.filter(o => o.chest || o.breakable || o.rcNode || o.node).map(o => ({ x: o.x, y: o.bottom }));
  const cells = [];
  for (let ty = 1; ty < M.h - 1; ty++) for (let tx = 1; tx < M.w - 1; tx++) {
    if (!open(tx, ty)) continue; const x = tx * T + 8, y = ty * T + 12;
    if (Math.hypot(x - M.entry[0], y - M.entry[1]) < CTREAS.entry || (deep && Math.hypot(x - deep.x, y - deep.y) < CTREAS.deep)) continue;
    cells.push({ x, y });
  }
  const placed = [];
  const put = (bank, k) => {
    for (let tries = 0; tries < 40 && cells.length; tries++) {
      const c = cells[Math.floor(R() * cells.length)];
      if (placed.concat(taken).some(q => Math.hypot(q.x - c.x, q.y - c.y) < CTREAS.gap)) continue;
      if (w.blocked(c.x, c.y)) continue;
      placed.push(c); const id = `${key}_${bank === 3 ? 'c' : 'r'}${k}`; if (rcToday(pr, id)) return;   // (the spot stays used, so the others keep theirs)
      const rec = objRec(String(bank).padStart(3, '0'), 0); if (!rec) return;
      const o = makeMapObject([bank, 0, Math.round(c.x - rec[4] - rec[2] / 2), Math.round(c.y + 4 - rec[5] - rec[3]), 1]); if (!o) return;
      o.ctreas = id; if (bank === 3) o.caveCache = true; w.objects.push(o); return;
    }
  };
  const nCr = CTREAS.crates[0] + Math.floor(R() * (CTREAS.crates[1] - CTREAS.crates[0] + 1)), nCa = CTREAS.caches[0] + Math.floor(R() * (CTREAS.caches[1] - CTREAS.caches[0] + 1));
  for (let k = 0; k < nCa; k++) put(3, k);
  for (let k = 0; k < nCr; k++) put(17, k);
  w._grid = null;
}
{
  const rs = rcSpawn;
  rcSpawn = (game, w, door) => { const r = rs(game, w, door); try { ctreasLay(game, w, door); } catch (e) { console.warn('cave treasure', e); } return r; };
  const bc = breakCrate;   // a cave crate, once broken, stays gone until tomorrow
  breakCrate = (world, o) => { if (o.ctreas && window.GAME && GAME.profile) { rcMark(GAME.profile, o.ctreas); GAME.save(); } return bc(world, o); };
  const oc = openChest;   // a cache: gold, two goods and often a card, from the cave's land
  openChest = (world, o) => {
    if (!o.caveCache || o.opened) return oc(world, o);
    const game = window.GAME, pr = game.profile, z = ctreasZone(world), Z = ZONES[z], x = o.x, y = o.bottom + 6;
    o.opened = true; o.openT = 0; world.rings.push({ x, y: o.bottom - 6, r: 18, t: 0, col: '#ffd23f' });
    const g = CTREAS.cacheGold[0] + z * CTREAS.cacheGold[1]; pr.gold = (pr.gold || 0) + g; floatText(world, x, o.bottom - 36, `+${g} G`, '#ffd23f', 10);
    world.drops.push({ kind: 'goods', item: makeGoods(rollRank(Z)), x: x - 10, y }, { kind: 'goods', item: makeGoods(rollRank(Z)), x: x + 10, y });
    if (Math.random() < 0.6) world.drops.push({ kind: 'card', item: makeCard(pick(Z.mobs.filter(id => D.monsters[id])), rareGate(rollRank(Z))), x, y: y + 8 });
    rcMark(pr, o.ctreas); if (typeof questEvent === 'function') questEvent(game, 'chest'); game.save();
    game.toast('A miner\'s cache: gold and a few finds (it fills again tomorrow)', '#ffd27a');
  };
}
// loot in a cave is picked up as in the Wilds (world.js collectDrops: it flies to you and is taken). Inside, nothing collected
// drops at all, so crate, cache and monster loot just floated where it fell (2026-11-20, the user: "items just float in cave").
{
  const ui = updateInterior;
  updateInterior = (game, w, dt, inp) => { if (ctreasCave(w) && w.drops && w.drops.length) collectDrops(game, w, dt); return ui(game, w, dt, inp); };
}
