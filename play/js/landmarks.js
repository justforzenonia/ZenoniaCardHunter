'use strict';
// LANDMARKS: the set pieces that make each zone a place you remember, built from the game's own object art. Every zone
// has its own compositions, placed from the world seed a few areas apart along the road, so the same hero always finds
// them in the same spot:
//   Verdant Fields  Windmill Hill · the Great Oak · the Old Colonnade · a Hunters' Camp
//   Twilight Grove  Spirit Hollow · the Hollow Giant · the Sunken Cloister
//   Skyreach Isles    the Old Foundry · the Hall of Kings · the Titan Graveyard · a Dune Camp
//   Frozen Abyss    an Igloo Hamlet · the Crystal Garden · the Frozen Leviathan · the Ice Arches
// A piece only goes down on open ground with a walkable ring around it, so it can never close off a road.
// Walking up to one for the first time counts it as discovered (pr.landmarks), with a little EXP.
// Items: [bank, frame, x, y, ground?], x/y in tiles from the piece's top-left, at the sprite's bottom centre. No fire
// here, ever (FIRE_BANKS also refuses it).
const LANDMARKS = [
  [ { name: 'Windmill Hill', w: 18, h: 12, n: 2, items: [[58, 0, 4, 7.5], [296, 0, 14, 7.5], [58, 0, 9, 12], [59, 0, 2.5, 11.5], [59, 0, 15.5, 11.5], [42, 0, 9, 4]] },
    { name: 'The Great Oak', w: 18, h: 12, n: 2, items: [[46, 2, 9, 10], [55, 11, 2.5, 10], [55, 11, 15.5, 11], [60, 0, 3.5, 5], [60, 0, 14.5, 5]] },
    { name: 'The Old Colonnade', w: 16, h: 11, n: 2, items: [[68, 1, 2, 4.5], [68, 2, 6, 4.5], [68, 2, 10, 4.5], [68, 1, 14, 4.5], [68, 0, 2, 10], [68, 1, 6, 10], [68, 1, 10, 10], [68, 0, 14, 10], [75, 0, 8, 7.6]] },
    { name: "The Hunters' Camp", w: 16, h: 10, n: 1, items: [[5, 0, 5, 7], [5, 0, 12, 8.5], [59, 0, 3.5, 9.5], [42, 0, 13, 4]] } ],
  [ { name: 'Spirit Hollow', w: 18, h: 12, n: 2, items: [[201, 1, 4, 7], [201, 1, 14, 7], [201, 0, 9, 5], [201, 0, 3, 11], [201, 0, 15, 11], [201, 2, 9, 10], [60, 0, 6.5, 9.5], [60, 0, 11.5, 9.5]] },
    { name: 'The Hollow Giant', w: 18, h: 12, n: 2, items: [[46, 3, 9, 10], [46, 4, 3.5, 11], [55, 11, 15, 10], [248, 1, 14, 6]] },
    { name: 'The Sunken Cloister', w: 18, h: 12, n: 2, items: [[298, 0, 3, 5], [298, 0, 7, 5], [298, 0, 11, 5], [298, 0, 15, 5], [298, 0, 3, 11], [298, 0, 7, 11], [298, 0, 11, 11], [298, 0, 15, 11], [248, 0, 9, 9], [285, 0, 5, 8.5], [285, 0, 13, 8.5]] } ],
  [ { name: 'The Old Foundry', w: 18, h: 12, n: 2, items: [[272, 0, 4, 7], [272, 4, 13, 7.5], [272, 0, 5, 11.8], [273, 0, 9, 2.5], [293, 0, 11, 10.5], [293, 1, 13.5, 11]] },
    { name: 'The Hall of Kings', w: 18, h: 11, n: 2, items: [[33, 2, 2, 4.5], [33, 6, 5.5, 4.5], [33, 2, 9, 4.5], [33, 6, 12.5, 4.5], [33, 2, 16, 4.5], [33, 2, 2, 10], [33, 6, 5.5, 10], [33, 4, 9, 10], [33, 6, 12.5, 10], [33, 2, 16, 10]] },
    { name: 'The Titan Graveyard', w: 18, h: 11, n: 2, items: [[247, 1, 6, 6.5], [247, 0, 13, 10], [29, 0, 2, 10.5], [29, 1, 11, 4.5], [247, 4, 15.5, 4.5], [247, 5, 2.5, 4.5]] },
    { name: 'The Dune Camp', w: 16, h: 10, n: 1, items: [[47, 0, 8, 7, true], [47, 1, 3, 9, true], [5, 0, 5, 7], [5, 0, 12, 8], [246, 0, 14.5, 3.5], [29, 0, 2, 3.5]] } ],
  [ { name: 'The Igloo Hamlet', w: 18, h: 12, n: 2, items: [[41, 3, 6.5, 6.5], [41, 1, 14, 6], [41, 0, 3, 11], [41, 2, 14.5, 11], [42, 1, 9, 10.5], [40, 1, 1, 3.5], [40, 1, 17, 3]] },
    { name: 'The Crystal Garden', w: 18, h: 11, n: 2, items: [[264, 0, 4, 6], [264, 0, 9, 4.5], [264, 0, 14, 6], [264, 7, 3, 10], [264, 7, 15, 10], [254, 0, 9, 9.5], [264, 14, 6, 9], [264, 14, 12, 9]] },
    { name: 'The Frozen Leviathan', w: 16, h: 10, n: 1, items: [[262, 0, 8, 7], [264, 15, 2, 9], [264, 15, 14, 9], [264, 7, 8, 9.8], [50, 5, 2.5, 4], [50, 5, 13.5, 4]] },
    { name: 'The Ice Arches', w: 16, h: 9, n: 2, items: [[265, 0, 3, 5], [265, 1, 8, 5], [265, 2, 13, 5], [264, 7, 5.5, 8], [264, 7, 10.5, 8]] } ],
];
const LANDMARK_FOUND = { r: 130, exp: 0.1 };
const LM_RING = 1;   // walkable tiles kept clear all the way round a piece
const LM_CLEAR = new Set(['001', '002', '040', '043', '045', '050', '066']);   // trees, rocks and flowers make way for a set piece
// which tiles of an area can hold a piece, as a summed table so any rectangle is one lookup
function landmarkTable(w, R) {
  if (R._lm) return R._lm;
  const ML = regMap(R), W = R.w, H = R.h, S = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = R.ox + x, ty = R.oy + y, px = tx * T + 8, py = ty * T + 8;
    const bad = !mapReach(w.map, px, py) || inRiverAt(px, py) || onDeck(w, px, py) || cliffGround(R, px, py) || waterTile(ML.tileset, (ML.ground[y * ML.w + x] & 0xff) - 1)
      || WILDS.bridges.some(b => b && tx >= b.x0 - 3 && tx <= b.x1 + 3 && ty >= b.y - 3 && ty <= b.y + bridgeRows(b) + 2)
      || (R.subs || []).some(u => (u.path || []).some(([qx, qy]) => Math.abs(qx - tx) <= 2 && Math.abs(qy - ty) <= 2))
      || (typeof platNear === 'function' && platNear(tx, ty, 3));   // (clear of the plateaus and their stairs: plateaus.js)
    S[(y + 1) * (W + 1) + x + 1] = (bad ? 1 : 0) + S[y * (W + 1) + x + 1] + S[(y + 1) * (W + 1) + x] - S[y * (W + 1) + x];
  }
  return (R._lm = S);
}
// a random top-left tile where piece L and its ring fit in area R, on open ground with nothing fixed in the way
function landmarkSpot(w, R, L, r) {
  const S = landmarkTable(w, R), W = R.w, M = LM_RING, a = L.w + M * 2 + 1, b = L.h + M * 2 + 1, spots = [];
  for (let y = 1; y + b < R.h - 1; y++) for (let x = 1; x + a < W - 1; x++)
    if (!(S[(y + b) * (W + 1) + x + a] - S[y * (W + 1) + x + a] - S[(y + b) * (W + 1) + x] + S[y * (W + 1) + x])) spots.push([x, y]);
  const fixed = w.objects.filter(o => o.box && !LM_CLEAR.has(o.bank) && o.box.x < (R.ox + R.w) * T && o.box.x + o.box.w > R.ox * T);
  for (let t = 0; t < 40 && spots.length; t++) {
    const [x, y] = spots.splice(Math.floor(r() * spots.length), 1)[0], x0 = (R.ox + x) * T, y0 = (R.oy + y) * T, x1 = x0 + a * T, y1 = y0 + b * T;
    if (fixed.some(o => o.box.x < x1 && o.box.x + o.box.w > x0 && o.box.y < y1 && o.box.y + o.box.h > y0)) continue;
    if ((w.guardians || []).some(G => G.at && Math.abs(G.at.x - (x0 + x1) / 2) < 260)) continue;
    return [R.ox + x + M, R.oy + y + M];
  }
  return null;
}
function landmarkPlace(w, R, rx, ry, L, z, site = false) {
  const M = LM_RING, x0 = (rx - M) * T, y0 = (ry - M) * T, x1 = (rx + L.w + M + 1) * T, y1 = (ry + L.h + M + 1) * T;
  w.objects = w.objects.filter(o => !(!o.chest && o.x >= x0 && o.x < x1 && o.bottom >= y0 && o.bottom < y1 && (!o.box || LM_CLEAR.has(o.bank))));
  for (const it of L.items) {
    const S = z === 2 && SKY_SWAP[it[0]], bank = S ? S[0] : it[0], fi = S ? S[1] : it[1], [, , tx, ty, ground] = it;
    const f = objFrame(bank, fi); if (!f) continue;
    const o = makeMapObject([bank, fi, Math.round((rx + tx) * T - (f[4] + f[2] / 2)), Math.round((ry + ty) * T - (f[5] + f[3]))]); if (!o) continue;
    o.region = R; if (!site) o.landmark = L.name;
    if (ground) { o.ground = true; o.box = null; }
    else if (GIANT_TREE(o)) giantTreeBox(o);
    else if (!o.box && f[3] >= 20) { const bw = Math.min(f[2] * 0.72, 90), bh = Math.min(f[3] * 0.3, 28); o.box = { x: rx * T + tx * T - bw / 2, y: o.bottom - bh, w: bw, h: bh }; }
    w.objects.push(o);
  }
  if (!site) (w.landmarks = w.landmarks || []).push({ name: L.name, z, x: (rx + L.w / 2) * T, y: (ry + L.h / 2) * T, key: `${z}:${L.name}:${w.landmarks ? w.landmarks.filter(q => q.name === L.name).length : 0}` });
  w._grid = null;
}
// the search runs once per world seed (a return to town rebuilds the Wilds, the same pieces in the same spots)
const LM_PLAN = {};
function placeLandmarks(w) {
  const plan = LM_PLAN[WORLD_SEED] || (LM_PLAN[WORLD_SEED] = planLandmarks(w));
  for (const [z, i, ri, rx, ry] of plan) landmarkPlace(w, REGIONS[ri], rx, ry, LANDMARKS[z][i], z);
}
function planLandmarks(w) {
  const r = seededRng((WORLD_SEED ^ 0x51ED) >>> 0), out = [];
  for (let z = 0; z < LANDMARKS.length; z++) {
    const regs = zoneAreas(z).slice(1, -1).filter(R => !isGoddessTown(R)); if (!regs.length) continue;
    const pieces = LANDMARKS[z].flatMap((L, i) => Array.from({ length: L.n }, () => i)), step = regs.length / pieces.length;
    const order = pieces.map(i => [r(), i]).sort((a, b) => a[0] - b[0]).map(q => q[1]), taken = new Set();
    order.forEach((i, n) => {
      const first = Math.floor(n * step);   // spaced along the road: each looks in its own stretch of areas first, then on
      for (let k = 0; k < regs.length; k++) {
        const R = regs[(first + k) % regs.length]; if (taken.has(R)) continue;   // one to an area
        const at = landmarkSpot(w, R, LANDMARKS[z][i], r); if (!at) continue;
        taken.add(R); out.push([z, i, REGIONS.indexOf(R), at[0], at[1]]); break;
      }
    });
  }
  return out;
}
// each world frame (main.js): walking up to a landmark for the first time
function landmarkTick(game, w) {
  const pr = game.profile, p = w.player; if (!pr || !p || !w.landmarks || game.menu) return;
  wellTick(game, w);
  const seen = pr.landmarks || (pr.landmarks = {});
  for (const L of w.landmarks) {
    if (seen[L.key] || Math.abs(L.x - p.x) > LANDMARK_FOUND.r || Math.hypot(L.x - p.x, L.y - p.y) > LANDMARK_FOUND.r) continue;
    seen[L.key] = true; game.gainExp(Math.round(expNeed(pr.lv || 1) * LANDMARK_FOUND.exp));
    game.toast(`★ Discovered ${L.name} (${Object.keys(seen).length} of ${w.landmarks.length} landmarks)`, '#ffe9a8'); game.save();
  }
}
