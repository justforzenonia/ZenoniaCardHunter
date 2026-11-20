'use strict';
// SITES: small scenes scattered through every area of the Wilds, so there is always something ahead to walk to. They are
// built from the game's own art and placed from the world seed, so the same hero finds them in the same spots. A site is
// one of three kinds: a CACHE holds a chest, a CAMP holds a pack of monsters and a leader with a chest once they fall, and
// a RUIN is only there to look at. A cache or camp comes back each real day (pr.sites[key] = the day it was done).
// Items are as in landmarks.js: [bank, frame, x, y], in tiles from the piece's top-left, at the sprite's bottom centre.
const SITES = {
  perArea: 3, tries: 6, chestAt: [5, 4], campR: 320, packs: [4, 6], leaderHp: 3, leaderScale: 1.25, respawnDist: 2600, seasonPts: 10, weights: { cache: 0.4, camp: 0.4 },
  pieces: [
    [{ name: 'Abandoned Camp', w: 10, h: 6, items: [[5, 0, 2.5, 4], [59, 0, 7.5, 5], [42, 0, 8, 2.5]] }, { name: 'Old Ruin', w: 10, h: 6, items: [[68, 2, 2, 3], [68, 1, 8, 3], [75, 0, 2, 6]] }, { name: 'Wayside Shrine', w: 10, h: 6, items: [[60, 0, 2, 5.5], [60, 0, 8, 5.5], [55, 11, 8, 2.5]] }],
    [{ name: 'Spirit Stones', w: 10, h: 6, items: [[201, 0, 2, 5.5], [201, 1, 5, 2.5], [201, 0, 8, 5.5]] }, { name: 'Forgotten Tomb', w: 10, h: 6, items: [[298, 0, 2, 3], [298, 0, 8, 3], [285, 0, 2, 6]] }, { name: 'Dead Hollow', w: 10, h: 6, items: [[248, 1, 2, 5], [60, 0, 8, 3.5], [60, 0, 8, 6]] }],
    [{ name: 'Slag Heap', w: 10, h: 6, items: [[293, 0, 2, 5.5], [293, 1, 8, 5.5], [272, 4, 5, 2.5]] }, { name: 'Bone Field', w: 10, h: 6, items: [[247, 4, 2, 3], [247, 5, 8, 3], [29, 0, 2, 6]] }, { name: 'Broken Hall', w: 10, h: 6, items: [[33, 2, 2, 3], [33, 6, 8, 3], [29, 1, 8, 6]] }],
    [{ name: 'Frost Shrine', w: 10, h: 6, items: [[264, 0, 2, 4], [264, 7, 5, 2], [264, 0, 8, 4]] }, { name: 'Snowed-in Hut', w: 10, h: 6, items: [[41, 1, 3, 3.5], [42, 1, 8, 5.5], [40, 1, 1, 6]] }, { name: 'Ice Ruin', w: 10, h: 6, items: [[265, 1, 5, 2.5], [264, 15, 2, 6], [264, 15, 8, 6]] }],
  ],
};
const SITE_PLAN = {};
function planSites(w) {
  const r = seededRng((WORLD_SEED ^ 0x517E) >>> 0), out = [];
  REGIONS.forEach((R, ri) => {
    if (R.zone == null || R.zone < 0 || R.town || isGoddessTown(R)) return;
    const taken = [], P = SITES.pieces[R.zone]; if (!P) return;
    for (let n = 0; n < SITES.perArea; n++) {
      const i = Math.floor(r() * P.length), L = P[i], q = r(), kind = q < SITES.weights.cache ? 'cache' : q < SITES.weights.cache + SITES.weights.camp ? 'camp' : 'ruin';
      for (let t = 0; t < SITES.tries; t++) {
        const at = landmarkSpot(w, R, L, r); if (!at) break;
        if (taken.some(a => Math.abs(a[0] - at[0]) < L.w + 2 && Math.abs(a[1] - at[1]) < L.h + 2)) continue;
        taken.push(at); out.push({ key: `${ri}:${n}`, ri, i, at, kind }); break;
      }
    }
  });
  return out;
}
function placeSites(w) {
  const plan = SITE_PLAN[WORLD_SEED] || (SITE_PLAN[WORLD_SEED] = planSites(w)), pr = window.GAME && GAME.profile, today = dayNo(), done = (pr && pr.sites) || {};
  w.sites = [];
  for (const S of plan) {
    const R = REGIONS[S.ri], L = SITES.pieces[R.zone][S.i], [rx, ry] = S.at, cx = (rx + SITES.chestAt[0]) * T, cy = (ry + SITES.chestAt[1]) * T;
    landmarkPlace(w, R, rx, ry, L, R.zone, true);
    if (done[S.key] === today || S.kind === 'ruin') continue;
    if (S.kind === 'cache') siteChest(w, S.key, cx, cy, false);
    else w.sites.push({ key: S.key, R, x: cx, y: cy, up: false, name: L.name });
  }
}
function siteChest(w, key, x, y, lit) {
  const o = makeMapObject([3, 0, Math.round(x), Math.round(y)]); if (!o) return;
  Object.assign(o, { siteKey: key, campChest: lit }); w.objects.push(o); w._grid = null;
}
function siteDone(game, key) { const pr = game.profile; pr.sites = pr.sites || {}; pr.sites[key] = dayNo(); game.save(); }
// a chest of ours was opened (rifts.js chestOpened)
const siteChestOpened = (game, o) => { if (o.siteKey) siteDone(game, o.siteKey); };
function campSpawn(w, C) {
  const Z = ZONES[C.R.zone], pool = Z.mobs.filter(id => D.monsters[id]), sp = pool[(C.R.ox + C.R.oy * 3 + C.key.length) % pool.length], rank = areaRank(C.R), n = randi(SITES.packs[0], SITES.packs[1]);
  C.up = true;
  for (let i = 0; i <= n; i++) {
    const at = findOpen(w, C.x + rand(-44, 44), C.y + rand(-26, 26)), lead = i === n, m = makeMonster(lead ? pool[(C.key.length + 3) % pool.length] : sp, Math.min(9, rank + (lead ? 1 : 0)), at.x, at.y);
    Object.assign(m, { region: C.R.zone, area: 'site', camp: C.key, home: { x: at.x, y: at.y }, dir: randi(0, 3) });
    if (lead) { m.maxHp = m.hp = Math.round(m.maxHp * SITES.leaderHp); m.scale = (m.scale || 1) * SITES.leaderScale; m.heavy = true; m.label = 'Camp Leader'; }
    w.actors.push(m);
  }
}
// each world frame (daily.js): a camp wakes as you come near, and its chest appears when the last of it falls
function siteTick(game, w) {
  const p = w.player; if (!w.sites || !p || w.interior) return;
  for (const C of w.sites) {
    if (C.gone) continue;
    const d = Math.hypot(C.x - p.x, C.y - p.y);
    if (!C.up) { if (d < SITES.campR) campSpawn(w, C); continue; }
    if (w.actors.some(a => a.camp === C.key && !a.dead && !a.remove)) continue;
    if (d > SITES.respawnDist) { C.up = false; continue; }
    C.gone = true; siteChest(w, C.key, C.x, C.y, true); seasonGain(game, SITES.seasonPts);
    w.rings.push({ x: C.x, y: C.y, r: 40, t: 0, col: '#ffd25a' }, { x: C.x, y: C.y, r: 24, t: -120, col: '#ffffff' });
    game.toast(`${C.name} cleared! A chest is waiting`, '#ffd25a');
  }
}
