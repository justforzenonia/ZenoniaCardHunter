'use strict';
// Interactive and solid props: collision boxes per object kind, pushable stone blocks,
// breakable crates and treasure chests with random drops.

// key "bank:frame" -> { wf: box width as a fraction of the sprite (or w: fixed px), h: box height, up: lift from the sprite's bottom }
const PROP_SPEC = {
  '2:0': { wf: 0.8, h: 14 }, '2:1': { wf: 0.8, h: 14 },          // boulders
  '3:0': { wf: 0.9, h: 10, chest: true },                         // treasure chest
  '6:0': { w: 6, h: 5 }, '6:2': { w: 6, h: 5 }, '6:1': { wf: 0.9, h: 7 },   // lamp posts, bench
  '8:0': { wf: 0.8, h: 10 }, '8:1': { wf: 0.7, h: 5 }, '8:3': { wf: 0.7, h: 5 },
  '11:0': { wf: 0.8, h: 8 }, '11:2': { wf: 0.8, h: 40, up: 4 },  // bush, plaza fountain
  '17:0': { wf: 0.92, h: 10, breakable: true },                   // wooden crate
  '18:0': { wf: 0.7, h: 10 }, '18:1': { wf: 0.7, h: 10 },        // stalagmites
  '26:0': { wf: 0.95, h: 12, push: true },                        // stone block
  '40:1': { wf: 0.4, h: 10 }, '42:0': { wf: 0.8, h: 14 }, '43:0': { wf: 0.8, h: 10 },
  '50:0': { wf: 0.7, h: 10 }, '50:3': { wf: 0.7, h: 10 }, '54:2': { wf: 0.7, h: 8 }, '56:0': { w: 8, h: 5 },
  '64:0': { wf: 0.8, h: 12 }, '64:1': { wf: 0.7, h: 10 }, '64:2': { wf: 0.7, h: 10 },
};
function setPropBox(o, rec) {
  const S = o.spec;
  const bw = S.w || rec[2] * S.wf, cx = o.x + rec[4] + rec[2] / 2;
  o.box = { x: cx - bw / 2, y: o.bottom - (S.up || 0) - S.h, w: bw, h: S.h };
}
function applyPropSpec(o, rec) {
  const S = PROP_SPEC[`${Number(o.bank)}:${o.fi}`];
  if (!S) return;
  o.spec = S; o.push = !!S.push; o.breakable = !!S.breakable; o.chest = !!S.chest;
  setPropBox(o, rec);
}

// Crates scattered at random through each wild region — a different layout every visit. Broken crates come back
// later somewhere else (respawnCrates). (The old pushable stone blocks are gone: each area has a mini boss instead.)
const CRATES_PER_REGION = 7;
function placeProp(w, R, bank, avoid) {
  // nor on top of what already stands there: a crate sat in a desert brazier (2026-11-20, the user: "make sure there isnt any
  // incorrect placement tiles"). The pictures of this area's things (lamps, braziers, statues, trees), to keep clear of
  const x0 = R.ox * T - 64, x1 = (R.ox + R.w) * T + 64, boxes = [];
  for (const o of w.objects) { if (o.x < x0 || o.x > x1 || o.ground || o.draw || !o.bank) continue; const r = objRec(o.bank, o.fi); if (r) boxes.push([o.x + r[4], o.y + r[5], r[2], r[3]]); }
  for (let tries = 0; tries < 120; tries++) {
    const x = (R.ox + 2 + Math.random() * (R.w - 4)) * T, y = (R.oy + 3 + Math.random() * (R.h - 5)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || w.blocked(x, y - 12) || w.blocked(x + 10, y) || w.blocked(x - 10, y)) continue;
    if (boxes.some(([bx, by, bw, bh]) => x - 10 < bx + bw && x + 10 > bx && y - 18 < by + bh && y + 2 > by)) continue;
    if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < 140) continue;
    // never on a crossing, a narrow path or a ledge: the whole 5x5-tile patch around it must be open ground
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (WILDS.bridges.some(b => b && tx >= b.x0 - 3 && tx <= b.x1 + 3 && ty >= b.y - 2 && ty <= b.y + bridgeRows(b) + 1)) continue;
    if ((R.subs || []).some(u => (u.path || []).some(([px, py]) => Math.abs(px - tx) <= 2 && Math.abs(py - ty) <= 2))) continue;   // nor on the plank bridge to a stacked map
    if (onDeck(w, x, y)) continue;   // never on plank bridges, rail tracks or grates
    if (cliffGround(R, x, y)) continue;   // nor up on brown cliff tops in the green lands
    { const M = regMap(R), lx = Math.floor(x / T) - R.ox, ly = Math.floor(y / T) - R.oy;   // nor on (walkable, shallow) water
      if (waterTile(M.tileset, (M.ground[ly * M.w + lx] & 0xff) - 1)) continue; }
    let open = true;
    for (let dy = -2; dy <= 2 && open; dy++) for (let dx = -2; dx <= 2; dx++) if (!mapReach(w.map, (tx + dx) * T + 8, (ty + dy) * T + 8)) { open = false; break; }   // 5x5 open: never at a cliff edge you can't reach it from
    if (!open) continue;
    const o = makeMapObject([bank, 0, Math.round(x), Math.round(y)]);
    if (o && bank === 17 && regMap(R).z2field && objRec('322', 0)) o.bank = '322';   // (on a whole Zenonia 2 map, Zenonia 2's own box: the same frames, its own art)
    if (o) { o.region = R; if (bank === 3) maybeMimic(o); w.objects.push(o); return o; }
  }
  return null;
}
// in the green lands, is the ground under (x, y) brown cliff or dirt rather than grass? (judged by the colour of the
// map's own painted tile: a dark, warm brown)
const GROUND_PX = {};
function cliffGround(R, x, y) {
  if (!(R.tileset === 1 || R.tileset === 201) || !waterRef()) return false;   // (only once the map art is ready)
  let G = GROUND_PX[R.map];
  if (!G) { const c = mapBg(R.map); try { G = GROUND_PX[R.map] = { d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; } catch (e) { return false; } }
  const lx = Math.round(x - R.ox * T), ly = Math.round(y - R.oy * T); let r = 0, gg = 0, b = 0, n = 0;
  for (let dy = -6; dy <= 2; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
    const px = lx + dx, py = ly + dy; if (px < 0 || py < 0 || px >= G.w || py >= G.h) continue;
    const i = (py * G.w + px) * 4; r += G.d[i]; gg += G.d[i + 1]; b += G.d[i + 2]; n++;
  }
  if (!n) return false; r /= n; gg /= n; b /= n;
  return r > gg && gg > b && r - b > 35 && r * 0.3 + gg * 0.59 + b * 0.11 < 150;
}
function scatterProps(w) {
  for (const R of REGIONS) {
    if (R.zone < 0 || isGoddessTown(R)) continue;
    for (let i = 0; i < CRATES_PER_REGION; i++) placeProp(w, R, 17);
  }
}
function respawnCrates(w, dt) {
  w.crateT = (w.crateT == null ? 15000 : w.crateT) - dt;
  if (w.crateT > 0) return;
  w.crateT = rand(12000, 22000);
  for (const R of REGIONS) {
    if (R.zone < 0 || isGoddessTown(R)) continue;
    const have = w.objects.filter(o => o.region === R && o.breakable && o.breaking == null).length;
    if (have < CRATES_PER_REGION) placeProp(w, R, 17, w.player);   // out of sight of the hero
  }
}

const boxHit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Pushing: walking into a stone slides it (at half speed) if the space behind it is free.
function tryPush(world, a, dx, dy) {
  const px = a.x + dx, py = a.y + dy;
  for (const o of objGrid(world).get(Math.floor(px / 128)) || []) {   // (only what has a footprint in this column: world.js objGrid)
    if (!o.push) continue;
    const b = o.box;
    if (!(px > b.x - 3 && px < b.x + b.w + 3 && py > b.y && py < b.y + b.h + 2)) continue;
    const mx = dx * 0.5, my = dy * 0.5;
    const nb = { x: b.x + mx, y: b.y + my, w: b.w, h: b.h };
    const solidAt = (x, y) => world.tileSolid ? world.tileSolid(x, y) : mapSolidAt(world.map, x, y);
    // the stone's footprint (lower half) must stay on open ground
    const fy1 = nb.y + nb.h * 0.5, fy2 = nb.y + nb.h - 1;
    if (solidAt(nb.x + 1, fy1) || solidAt(nb.x + nb.w - 1, fy1) || solidAt(nb.x + 1, fy2) || solidAt(nb.x + nb.w - 1, fy2)) return dx || dy;
    if (world.objects.some(q => q !== o && q.box && boxHit(nb, q.box))) return dx || dy;
    if (world.actors.some(q => q !== a && !q.dead && q.kind !== 'npc' && Math.abs(q.x - (nb.x + nb.w / 2)) < nb.w / 2 + 4 && q.y > nb.y && q.y < nb.y + nb.h + 6)) return dx || dy;
    o.x += mx; o.y += my; o.bottom += my; o.box = nb;
    o.dustT = (o.dustT || 0) - 16;
    if (o.dustT <= 0) {
      o.dustT = 90;
      world.particles.push({ x: nb.x + nb.w / 2 - Math.sign(dx) * nb.w / 2, y: nb.y + nb.h, vx: -mx * 20 + rand(-8, 8), vy: rand(-10, -3), t: 0, life: 320, col: '#c8b898', size: 2.4, puff: true });
    }
    return dx ? mx : my;
  }
  return dx || dy;
}

// Hitting props with attacks or spells: crates shatter, chests open. Anything that touches the prop's picture (plus a
// small margin) counts, not just its footprint, so a swing at the crate you see always lands.
function propHitArea(o) {
  const r = objRec(o.bank, o.fi), m = 4;
  if (!r) return { x: o.box.x - m, y: o.box.y - 14, w: o.box.w + m * 2, h: o.box.h + 14 + m };
  return { x: o.x + r[4] - m, y: o.y + r[5] - m, w: r[2] + m * 2, h: r[3] + m * 2 };
}
function hitProps(world, rect, att) {
  if (!att || att.kind !== 'player') return;
  for (const o of objsBetween(world, rect.x - 200, rect.x + rect.w + 200)) {   // (the objects near the swing: world.js objsBetween)
    if (o.hoard && !o.taken && boxHit(rect, propHitArea(o))) { takeHoard(world, o); continue; }
    if (!(o.breakable || (o.chest && !o.opened)) || o.breaking || !o.box) continue;
    if (!boxHit(rect, propHitArea(o))) continue;
    if (o.breakable) breakCrate(world, o);
    else openChest(world, o);
  }
}
// A HEAP OF GOLD (the Sun Temple's treasure piles, object 253:1): it looked like loot and could not be taken. Now a
// blow scatters it: gold coins, and a chest's worth of loot. Each heap refills every in-game day (pr.hoards[key] =
// the day it was taken); a taken heap is gone until then.
const HOARD = { gold: [60, 140] };
const hoardKey = o => `${Math.round(o.x)},${Math.round(o.y)}`;
function makeHoard(game, o) {
  const pr = game.profile; if (!pr) return true;
  if ((pr.hoards || {})[hoardKey(o)] === (pr.day || 0)) return false;   // already taken today
  const rec = objRec(o.bank, o.fi); o.hoard = true;
  o.box = { x: o.x + rec[4] + 8, y: o.bottom - 10, w: rec[2] - 16, h: 9 };
  return true;
}
// THE SUN TEMPLE'S CHEST (2026-11-20, the user: "chest is below pillar and cant open or use"): the temple map's chest picture
// becomes a real chest, moved off the pillar's base into the open aisle beside it; once opened it is gone until the next day
function templeChest(game, o) {
  const pr = game.profile, key = 'chest:' + hoardKey(o); if (!pr || (pr.hoards || {})[key] === (pr.day || 0)) return null;
  const c = makeMapObject([3, 0, Math.round(o.x + 25), Math.round(o.y + 20)]); if (!c) return null;
  c.templeChest = key; return c;
}
function takeHoard(world, o) {
  const game = window.GAME, pr = game.profile;
  o.taken = true; o.hoard = false; o.box = null; world.objects.splice(world.objects.indexOf(o), 1); world._grid = null;
  (pr.hoards = pr.hoards || {})[hoardKey(o)] = pr.day || 0;
  const rank = REGIONS[regionIndexAt(o.x)].zone + 1, gold = Math.round(rand(HOARD.gold[0], HOARD.gold[1]) * rank);
  pr.gold = (pr.gold || 0) + gold;
  floatText(world, o.x, o.bottom - 40, `+${gold} G`, '#ffd23f', 10);
  world.rings.push({ x: o.x, y: o.bottom - 6, r: 26, t: 0, col: '#ffd23f' });
  for (let i = 0; i < 26; i++) {
    const a = rand(-Math.PI, 0), sp = rand(60, 180);
    world.particles.push({ x: o.x + rand(-12, 12), y: o.bottom - 10, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp, t: 0, life: rand(400, 800), col: i % 3 ? '#ffd23f' : '#fff6c8', size: rand(1.5, 2.6), drag: 0.93 });
  }
  propDrop(world, o.x, o.bottom + 6, true);
  if (typeof SFX !== 'undefined' && SFX.coin) SFX.coin();
  game.toast(`A heap of gold! +${gold} G`, '#ffd23f'); game.save();
}
function breakCrate(world, o) {
  o.breaking = 0; o.box = null;
  const cx = o.x, cy = o.bottom - 8;
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 130);
    world.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, life: rand(250, 450), col: i % 3 ? '#b8743a' : '#6a3a14', size: rand(1.5, 3), drag: 0.9 });
  }
  world.shake = Math.max(world.shake, 2);
  propDrop(world, cx, o.bottom - 2, false);
}
function openChest(world, o) {
  if (o.mimic) { wakeMimic(world, o); return; }   // it was never a chest (mimic.js)
  if (o.sideCache && sideCacheBlocked(world, o)) return;   // a side area's cache (sideareas.js)
  o.opened = true; o.openT = 0;
  if (window.GAME && typeof netPqEvent === 'function') netPqEvent(GAME, 'chest');   // (online co-op: a party contract, netquest.js)
  world.rings.push({ x: o.x, y: o.bottom - 6, r: 22, t: 0, col: '#ffd23f' });
  for (let i = 0; i < 18; i++) {
    const a = rand(-Math.PI, 0), sp = rand(60, 160);
    world.particles.push({ x: o.x, y: o.bottom - 10, vx: Math.cos(a) * sp * 0.5, vy: Math.sin(a) * sp, t: 0, life: rand(400, 700), col: i % 2 ? '#ffd23f' : '#fff6c8', size: 2, drag: 0.94 });
  }
  propDrop(world, o.x, o.bottom + 6, true);
  if (o.sideCache) sideCacheLoot(world, o);
  if (typeof chestOpened === 'function') chestOpened(world, o);
  if (o.platChest && typeof platChestOpened === 'function') platChestOpened(world, o);   // a plateau's treasure (plateaus.js)
  questEvent(window.GAME, 'chest');}
// Random loot: chests always give a card (one rank above the region's best roll) plus gear
function propDrop(world, x, y, rich) {
  const ri = regionIndexAt(x), R = REGIONS[ri], game = window.GAME;
  if (R.zone < 0) { world.drops.push({ kind: 'potion', item: { tier: 0 }, x, y }); return; }
  const Z = ZONES[R.zone], roll = Math.random();
  const card = () => { const r = Math.random(); return makeCard(rich && r < 0.35 ? pick(ARCANA_CARDS) : r > 0.9 ? pick(NPC_CARD_IDS) : r > 0.78 ? pick(SUPPORT_CARDS) : pick(Z.mobs.filter(id => D.monsters[id])), rareGate(Math.min(9, rollRank(Z) + (rich ? 1 : 0)))); };   // chests: often an Arcana card, now and then a villager
  if (rich) {
    world.drops.push({ kind: 'card', item: card(), x: x - 8, y });
    world.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rareGate(Math.min(9, Z.ranks[1])), game.profile.cls), x: x + 8, y });
    world.drops.push({ kind: 'goods', item: makeGoods(Math.min(9, Z.ranks[1] + 1)), x, y: y + 6 });
  } else if (roll < 0.35) world.drops.push({ kind: 'card', item: card(), x, y });
  else if (roll < 0.55) world.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rareGate(rollRank(Z)), game.profile.cls), x, y });
  else if (roll < 0.75) world.drops.push({ kind: 'goods', item: makeGoods(rollRank(Z)), x, y });
  else world.drops.push({ kind: 'potion', item: { tier: 0 }, x, y });
}
// Per-frame: crate shatter frames and chest lid animation
function updateProps(world, dt) {
  let gone = false;
  for (const o of objProps(world)) {   // (only crates and chests animate: world.js objCols)
    if (o.breaking != null) { o.breaking += dt; o.fi = Math.min(4, 1 + Math.floor(o.breaking / 70)); if (o.breaking > 330) o.remove = gone = true; }
    if (o.chest && o.opened) {   // lid opens, loot pops out, then the chest vanishes in a puff
      o.openT += dt; o.fi = Math.min(4, Math.floor(o.openT / 90));
      if (o.openT > 1100) { o.alpha = 1 - (o.openT - 1100) / 350; o.box = null; }
      if (o.openT > 1450) {
        o.remove = gone = true;
        for (let i = 0; i < 10; i++) world.particles.push({ x: o.x + rand(-6, 6), y: o.bottom - 6, vx: rand(-30, 30), vy: rand(-40, -8), t: 0, life: rand(300, 500), col: i % 2 ? '#ffffff' : '#ffe9a8', size: rand(2, 3.5), puff: true });
      }
    }
  }
  // anything else flagged for removal (a random chest timing out, a quest object) is swept up a few times a second
  if (gone || (world._rmT = (world._rmT || 0) - dt) <= 0) { world._rmT = 200; if (world.objects.some(o => o.remove)) world.objects = world.objects.filter(o => !o.remove); }
}
