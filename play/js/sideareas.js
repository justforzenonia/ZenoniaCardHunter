'use strict';
// WHY GO OFF THE ROAD: every road area has at least one side area (worldgen.js SIDE), and every side area holds a
// TREASURE CACHE — a chest under a pillar of light, refilled every in-game day (pr.sideCache[key] = the day it was
// last opened) — plus one feature of its own, picked at random for each side area (the same every visit):
//   THE HEIGHTS (above the road, gentler monsters): a supply cache (food, seeds, a potion, gold, gear), and either
//     FORAGE — wild crops and seeds growing about (once a day, pr.sideForage) — or a SHRINE: touch it once a day
//     (pr.sideShrine) to be healed in full and blessed with +25% attack for 3 minutes.
//   THE DEPTHS (below, deadlier monsters): a rich cache (a card a rank above, strong gear, often a relic, lots of
//     gold) that will not open while its guard lives — either a DEPTHS WARDEN (one big elite) or a MONSTER DEN (a
//     pack of four elites).
// ALPHAS: on some days a side area, Heights or Depths, holds an Alpha: a rank up, big, with ×4 defence and ×2 damage. It pays far
// better than anything else out there, and it stays dead until the next in-game day (pr.sideAlpha[key] = the day it fell).

const SIDE_LOOT = { forage: [4, 7], wardenHp: 3, den: 4, denHp: 1.6, relic: 0.35, blessMs: 180000 };
const ALPHA = { chance: 0.35, guard: 4, hit: 2, hp: 2, scale: 1.6, rank: 1, gold: 8, exp: 8, coins: 15, col: '#ff3a3a' };
const sideKey = (R, u) => R.key + (u.below ? ':D' : ':U');
const sideToday = pr => pr.day || 0;
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// the side area's feature: heights 'forage' or 'shrine', depths 'warden' or 'den'
const sideFeature = (R, u) => (u.below ? ['warden', 'den'] : ['forage', 'shrine'])[(hashStr(sideKey(R, u)) >>> 3) % 2];

// a spot in the side area: open ground, as far from the boardwalk as can be found (`near`: close to the middle
// instead) — the same every visit
function sideSpot(w, R, u, near = false) {
  w.sideSpots = w.sideSpots || {};
  const key = sideKey(R, u) + (near ? ':m' : ''); if (w.sideSpots[key]) return w.sideSpots[key];
  const r = rng(hashStr(key)), [ex, ey] = near ? [u.ox + u.w / 2, u.oy + u.h / 2] : u.path && u.path.length ? u.path[u.below ? u.path.length - 1 : 0] : [u.ox + u.w / 2, u.oy + u.h / 2];
  let best = null, bd = near ? 1e9 : -1;
  for (let k = 0; k < 160; k++) {
    const x = (u.ox + 3 + r() * (u.w - 6)) * T, y = (u.oy + 3 + r() * (u.h - 6)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || w.blocked(x, y - 12) || w.blocked(x + 12, y) || w.blocked(x - 12, y)) continue;
    const d = Math.hypot(x - ex * T, y - ey * T); if (near ? d < bd : d > bd) { bd = d; best = { x, y }; }
  }
  return (w.sideSpots[key] = best || findOpen(w, (u.ox + u.w / 2) * T, (u.oy + u.h / 2) * T));
}
// the side area's rank: the road area's own (it climbs the further into the zone you are, journey.js areaRank),
// shifted down above the road and up below it
function sideAreaRank(R, u) {
  const [a, b] = ZONES[R.zone].ranks, st = areaStage(R), f = st.n > 1 ? (st.i - 1) / (st.n - 1) : 0, base = a + Math.round(f * (b - a) * 0.7);
  return Math.max(0, Math.min(9, base + (u.below ? SIDE.rankDown : SIDE.rankUp)));
}

// stock the side areas of the area you are in: the cache (if not opened today) and its guards, the forage, the
// shrine's blessing (and take it when you touch the shrine)
function sideTick(game, w, dt) {
  if (!w.overworld || w.interior) return;
  const pr = game.profile, p = w.player, R = REGIONS[w.region]; if (!R || !R.subs || !R.subs.length) return;
  if (typeof isGoddessTown === 'function' && isGoddessTown(R)) return;   // (a goddess town's side areas are part of her sanctuary: no Alpha, no guards, 2026-11-19)
  pr.sideCache = pr.sideCache || {}; pr.sideForage = pr.sideForage || {}; pr.sideShrine = pr.sideShrine || {};
  for (const u of R.subs) {
    const key = sideKey(R, u), day = sideToday(pr), F = sideFeature(R, u);
    if (Math.abs(p.x - (u.ox + u.w / 2) * T) > u.w * T) continue;
    if (pr.sideCache[key] !== day && !objSpecial(w).some(o => o.sideCache && o.sideCache.key === key)) {
      const s = sideSpot(w, R, u), o = makeMapObject([3, 0, Math.round(s.x), Math.round(s.y)]);
      if (o) { o.sideCache = { key, below: u.below, zone: R.zone, rank: sideAreaRank(R, u), feat: F }; w.objects.push(o); }
      if (u.below && !guardsLeft(w, key)) spawnGuards(w, R, u, s, key, F);
    }
    if (alphaDue(R, u, day) && (pr.sideAlpha || {})[key] !== day && !w.actors.some(a => a.alphaKey === key && !a.dead)) spawnAlpha(game, w, R, u, key);
    if (F === 'forage' && pr.sideForage[key] !== day) {
      pr.sideForage[key] = day;
      const r = rng(hashStr(key + day)), n = SIDE_LOOT.forage[0] + Math.floor(r() * (SIDE_LOOT.forage[1] - SIDE_LOOT.forage[0] + 1));
      for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
        const x = (u.ox + 2 + r() * (u.w - 4)) * T, y = (u.oy + 2 + r() * (u.h - 4)) * T;
        if (!mapReach(w.map, x, y) || w.blocked(x, y)) continue;
        const id = r() < 0.35 ? dropSeed(sideAreaRank(R, u)) : ['berry', 'carrot', 'wheat', 'tomato', 'berry'][Math.floor(r() * 5)];
        w.drops.push({ kind: 'item', item: { id, tier: 0, icon: itemIcon(id) }, x, y, forage: true }); k++;
      }
    }
    if (F === 'shrine' && pr.sideShrine[key] !== day && !p.dead) {
      const s = sideSpot(w, R, u, true);
      if (Math.hypot(p.x - s.x, p.y - s.y) < 22) {
        pr.sideShrine[key] = day;
        p.hp = p.maxHp; if (p.maxMp) p.mp = p.maxMp; p.buffAtk = Math.max(p.buffAtk || 0, SIDE_LOOT.blessMs);
        w.rings.push({ x: s.x, y: s.y, r: 50, t: 0, col: '#9fffd0' }, { x: s.x, y: s.y, r: 30, t: -120, col: '#ffffff' });
        floatText(w, p.x, p.y - 44, 'BLESSED', '#9fffd0', 11);
        game.toast('SHRINE BLESSING — healed in full, +25% attack for 3 minutes (the shrine wakes again tomorrow)', '#9fffd0');
        game.save();
      }
    }
  }
}
const alphaDue = (R, u, day) => hashStr(`${sideKey(R, u)}:alpha${day}`) % 100 < ALPHA.chance * 100;
function spawnAlpha(game, w, R, u, key) {
  const Z = ZONES[R.zone], s = sideSpot(w, R, u, true), at = findOpen(w, s.x + 44, s.y + 10), sp = pick(Z.mobs.filter(id => D.monsters[id])), m = makeMonster(sp, Math.min(9, sideAreaRank(R, u) + ALPHA.rank), at.x, at.y);
  m.maxHp = m.hp = Math.round(m.maxHp * ALPHA.hp); m.scale *= ALPHA.scale; m.smart = true;
  Object.assign(m, { alphaKey: key, label: `Alpha ${SPECIES[sp].name}`, boss: true, heavy: true, home: { x: at.x, y: at.y }, region: R.zone, area: R.key }); giveWildKit(m);
  w.actors.push(m); game.toast(`An ALPHA prowls the ${u.below ? 'Depths' : 'Heights'}! ×${ALPHA.guard} defence, ×${ALPHA.hit} damage, great rewards`, ALPHA.col);
  return m;
}
function alphaLoot(game, w, m) {
  const pr = game.profile, Z = ALPHA; pr.sideAlpha = pr.sideAlpha || {}; pr.sideAlpha[m.alphaKey] = sideToday(pr);
  w.drops.push({ kind: 'card', item: makeCard(typeof variantCardOf === 'function' ? variantCardOf(m.sp, 'giant') : m.sp, m.tier), x: m.x - 14, y: m.y }, { kind: 'gear', item: makeGear(pick(GEAR_SLOTS), m.tier, pr.cls), x: m.x + 14, y: m.y }, { kind: 'relic', item: makeRelic(m.sp, m.tier, 'mini'), x: m.x, y: m.y - 10 }, { kind: 'goods', item: makeGoods(m.tier), x: m.x, y: m.y + 10 });
  gainGold(game, w, m, Z.gold); game.gainExp(killExp(m.tier) * Z.exp); pr.coins = (pr.coins || 0) + Z.coins;
  floatText(w, m.x, m.y - 40, `+${Z.coins} coins`, '#ffd23f', 10); w.rings.push({ x: m.x, y: m.y, r: 44, t: 0, col: Z.col }, { x: m.x, y: m.y, r: 26, t: -120, col: '#ffffff' });
  game.toast(`ALPHA DEFEATED — ${SPECIES[m.sp].name}! A card, gear, a relic, gold and coins`, Z.col); game.save();
}
// the Depths' guard: one Warden (the zone's toughest species, a rank up, ×3 HP, big) or a den of four elites
function spawnGuards(w, R, u, s, key, F) {
  const Z = ZONES[R.zone], mobs = Z.mobs.filter(id => D.monsters[id]), rank = sideAreaRank(R, u);
  const add = (sp, tier, hpMul, scale, label, dx, dy) => {
    const at = findOpen(w, s.x + dx, s.y + dy), m = makeMonster(sp, Math.min(9, tier), at.x, at.y);
    m.maxHp = m.hp = Math.round(m.maxHp * hpMul); m.scale *= scale; m.smart = true;
    Object.assign(m, { sideWarden: key, label, home: { x: at.x, y: at.y }, region: R.zone, area: R.key, boss: false });
    w.actors.push(m);
  };
  if (F === 'den') for (let k = 0; k < SIDE_LOOT.den; k++) { const an = k / SIDE_LOOT.den * Math.PI * 2; add(pick(mobs), rank, SIDE_LOOT.denHp, 1.1, 'Den Brute', Math.cos(an) * 34, Math.sin(an) * 22); }
  else add(mobs.slice().sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0], rank + 1, SIDE_LOOT.wardenHp, 1.3, 'Depths Warden', 26, 6);
}
const guardsLeft = (w, key) => w.actors.filter(a => a.sideWarden === key && !a.dead).length;

// opening a cache (props.js openChest): the Depths' stays shut while any of its guards lives
function sideCacheBlocked(world, o) {
  const n = o.sideCache && o.sideCache.below ? guardsLeft(world, o.sideCache.key) : 0; if (!n) return false;
  if (!o.toldT || performance.now() - o.toldT > 2000) { o.toldT = performance.now(); floatText(world, o.x, o.bottom - 30, o.sideCache.feat === 'den' ? `THE DEN GUARDS IT · ${n} LEFT` : 'THE WARDEN GUARDS IT', '#ff6a5a', 9); }
  return true;
}
function sideCacheLoot(world, o) {
  const game = window.GAME, pr = game.profile, C = o.sideCache, x = o.x, y = o.bottom + 6, Z = ZONES[C.zone];
  pr.sideCache = pr.sideCache || {}; pr.sideCache[C.key] = sideToday(pr);
  if (C.below) {
    world.drops.push({ kind: 'card', item: makeCard(pick(Z.mobs.filter(id => D.monsters[id])), rareGate(Math.min(9, C.rank + 1))), x: x - 14, y });
    world.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rareGate(Math.min(9, C.rank + 1)), pr.cls), x: x + 14, y });
    if (Math.random() < SIDE_LOOT.relic) world.drops.push({ kind: 'relic', item: makeRelic(pick(Z.mobs.filter(id => D.monsters[id])), C.rank, 'mini'), x, y: y + 10 });
  } else {
    for (const id of ['bread', 'berry', dropSeed(C.rank)]) world.drops.push({ kind: 'item', item: { id, tier: 0, icon: itemIcon(id) }, x: x + rand(-14, 14), y: y + rand(0, 10) });
    world.drops.push({ kind: 'potion', item: { tier: 0 }, x: x + 16, y });
  }
  const g = (C.below ? 300 + C.rank * 120 : 100 + C.rank * 50); pr.gold = (pr.gold || 0) + g;
  floatText(world, x, o.bottom - 40, `+${g} G`, '#ffd23f', 10);
  game.toast(C.below ? 'DEPTHS CACHE opened — a rare card, strong gear and gold! (refills tomorrow)' : 'Supply cache opened — food, seeds, a potion and gold (refills tomorrow)', C.below ? '#ff9a7a' : '#ffd27a');
  game.save();
}
// the shrines, drawn with everyone (depth-sorted): bright while today's blessing waits, dim once taken
function drawSideShrines(w, now, items) {
  if (!w.overworld || w.interior) return;
  const pr = window.GAME && GAME.profile, R = REGIONS[w.region], p = w.player; if (!pr || !R || !R.subs) return;
  for (const u of R.subs) {
    if (sideFeature(R, u) !== 'shrine') continue;
    const s = sideSpot(w, R, u, true); if (Math.abs(s.x - p.x) > 420 || Math.abs(s.y - p.y) > 300) continue;
    const lit = (pr.sideShrine || {})[sideKey(R, u)] !== sideToday(pr);
    items.push({ y: s.y, draw: () => drawWaystone(s.x, s.y, '#9fffd0', lit, now, 'SHRINE', lit ? 'touch: heal + blessing' : 'wakes again tomorrow') });
  }
}
// the banner's second line for a side area
function sideBannerSub(game, R, u) {
  const pr = game.profile, F = sideFeature(R, u), done = pr.sideCache && pr.sideCache[sideKey(R, u)] === sideToday(pr);
  const cache = done ? 'its cache is empty until tomorrow' : u.below ? (F === 'den' ? 'a monster den guards a rich cache' : 'a Warden guards a rich cache') : 'a supply cache';
  const extra = F === 'forage' ? ' · wild crops to forage' : F === 'shrine' ? ' · a blessing shrine' : '';
  return `${u.below ? 'deadlier' : 'gentler'} monsters · ${cache}${extra}`;
}
