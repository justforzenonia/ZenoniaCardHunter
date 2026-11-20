'use strict';
// PLATEAUS: a second level of walking ground in the Wilds. A plateau is high ground built from the game's own cliff tiles
// (the same pieces the original maps use for their raised terraces, tiles_1): a grassy lip along its top edge, cliff sides,
// a two-tile rock face along its south side, and grass stairs cut into that face. Its rim and face are solid, so the only
// way up or down is the stairs: the high ground is its own level, fenced off from the ground below.
//
// They are stamped into the region maps right after the world is built (before any map is painted), chosen by the world
// seed, so every player in an online room gets the same ones. A region whose map is shared with another region gets its
// own copy first. They are in the grass lands (Verdant Fields, Twilight Grove) and the ice lands of the Frozen Abyss: about
// two maps in five have one.
const PLAT = {
  w: [12, 20], h: [8, 11],                // size in tiles, rim and face included (the ice set adds a row for its taller face; was 12-16 x 8-10 until 2026-11-13)
  isles: { w: [11, 13], h: [6, 8], share: 0.75 },   // (many of its maps have no room, so more of them try)       // Skyreach Isles' smaller ones (its islands are small)
  margin: 3,                              // open ground kept all round it
  share: 0.85,                            // the part of the maps that have one (0.4 until 2026-11-13: the user found the zones flat)
  second: 0.5,                            // the chance a map with one tries for a second, apart from the first
  edgeGap: 8,                             // tiles kept clear of a map's left and right edges (where crossings and bridges are)
  list: [],                               // the plateaus placed: { x, y, w, h, f, sx, map } in world tiles (f: face rows, sx: the stairs' left column)
  walls: new Set(),                       // their rim and face cells (world index), kept solid by openBareWalls (world.js)
};
// THE PIECE SETS, one per tileset, read off that tileset's own original terraces. A cell is { g: ground tile, o: overlay tile }
// (a missing g means the map's floor). top: the edge along the north side; sideL / sideR: the cliff sides (cycled down the
// rows); face: its rows from top to bottom, each with left end, middle pieces (cycled) and right end; stairs: per face row, the
// two stair cells; base: overlays on the floor in the row below the face (its shadow), if the set has one.
const IP = t => 144 + [76, 77, 78, 79, 86, 96, 89, 99, 106, 107, 108, 109, 116, 117, 118, 119, 56, 57, 66, 67].indexOf(t);   // (IP: world.js ISLES_PIECES)
const PC = (g, o) => ({ g, o }), DP = t => 176 + [76, 77, 78, 79, 86, 96, 89, 99, 106, 107, 108, 109, 116, 117, 118, 119, 56, 57, 66, 67].indexOf(t);   // (DP: world.js DESERT_PIECES)
const PLAT_SETS = {
  1: {   // the grass lands (Verdant Fields, Twilight Grove): tiles_1, from z0c and the town map
    top: { l: PC(undefined, 76), m: [PC(undefined, 77), PC(undefined, 78)], r: PC(undefined, 79) },
    sideL: [PC(86), PC(96)], sideR: [PC(89), PC(99)],
    face: [{ l: PC(86, 106), m: [PC(107), PC(108)], r: PC(89, 109) },     // the face ends are laid over the sides, as the originals do
           { l: PC(96, 116), m: [PC(117), PC(118)], r: PC(99, 119) }],
    stairs: [[PC(56), PC(57)], [PC(66), PC(67)]],
    flower: 47,
    deco: { pine: [[1, 2]], shrub: [[11, 0]], bloom: [[1, 3], [11, 1], [43, 0]], flowers: [[66, 0], [66, 1], [66, 2]] },
  },
  3: {   // the Sunscorch Desert: built exactly like the grass plateaus, from the grass pieces recoloured to sand and sandstone
    // (world.js desertPlateauPieces puts them in tiles_3 from slot 176; DP() gives a grass piece's desert slot)
    top: { l: PC(undefined, DP(76)), m: [PC(undefined, DP(77)), PC(undefined, DP(78))], r: PC(undefined, DP(79)) },
    sideL: [PC(DP(86)), PC(DP(96))], sideR: [PC(DP(89)), PC(DP(99))],
    face: [{ l: PC(DP(86), DP(106)), m: [PC(DP(107)), PC(DP(108))], r: PC(DP(89), DP(109)) },
           { l: PC(DP(96), DP(116)), m: [PC(DP(117)), PC(DP(118))], r: PC(DP(99), DP(119)) }],
    stairs: [[PC(DP(56)), PC(DP(57))], [PC(DP(66)), PC(DP(67))]],
    deco: { pine: [[28, 1]], shrub: [[28, 2]], bloom: [[28, 0], [28, 2]], flowers: [[29, 0], [29, 1]] },
  },
  209: {   // Skyreach Isles (2026-11-07): the grass plateau recoloured to cloud ground and lavender cloud stone (world.js islesPlateauPieces;
    // IP() gives a grass piece's slot in tileset 209). Dressed like the grass lands.
    top: { l: PC(undefined, IP(76)), m: [PC(undefined, IP(77)), PC(undefined, IP(78))], r: PC(undefined, IP(79)) },
    sideL: [PC(IP(86)), PC(IP(96))], sideR: [PC(IP(89)), PC(IP(99))],
    face: [{ l: PC(IP(86), IP(106)), m: [PC(IP(107)), PC(IP(108))], r: PC(IP(89), IP(109)) },
           { l: PC(IP(96), IP(116)), m: [PC(IP(117)), PC(IP(118))], r: PC(IP(99), IP(119)) }],
    stairs: [[PC(IP(56)), PC(IP(57))], [PC(IP(66)), PC(IP(67))]],
    deco: { pine: [[1, 2]], shrub: [[11, 0]], bloom: [[1, 3], [11, 1], [43, 0]], flowers: [[66, 0], [66, 1], [66, 2]] },
  },
  6: {   // the Frozen Abyss's ice lands: tiles_6, from the freestanding snow blocks of z3e and the terraces of z3
    top: { l: PC(undefined, 0), m: [PC(undefined, 2)], r: PC(undefined, 5) },
    sideL: [PC(0, 10)], sideR: [PC(5, 15)],
    face: [{ l: PC(30), m: [PC(31), PC(32), PC(33), PC(34)], r: PC(35) },            // ice wall
           { l: PC(30), m: [PC(4), PC(14), PC(24)], r: PC(35) },                       // ice wall, lower
           { l: PC(64, 40), m: [PC(64, 41), PC(64, 42), PC(64, 43), PC(64, 44)], r: PC(64, 45) }],   // crystals at its foot
    stairs: [[PC(73, 13), PC(73, 13)], [PC(73, 23), PC(73, 23)], [PC(73, 23), PC(73, 23)]],          // white steps
    base: { l: 12, m: [21], r: 22 },                                              // the shadow below the face
    deco: { pine: [[40, 1], [40, 0]], shrub: [[50, 1]], bloom: [[50, 5], [50, 6], [50, 1]], flowers: [[45, 1], [40, 2], [40, 3]] },
  },
};
// a map's plain floor: its most common walkable ground tile with nothing laid over it
function platFloor(M) {
  const n = {}; for (let i = 0; i < M.w * M.h; i++) if (M.reach[i] && !M.solid[i] && !(M.overlay[i] & 0xff)) { const t = (M.ground[i] & 0xff) - 1; if (t >= 0) n[t] = (n[t] || 0) + 1; }
  let best = -1, bn = 0; for (const t in n) if (n[t] > bn) { bn = n[t]; best = +t; } return best;
}
// give a region its own copy of its map (others may share the original)
function platOwnMap(R, tag) {
  const key = R.map, shared = REGIONS.some(q => q !== R && (q.map === key || (q.subs || []).some(u => u.map === key)));
  if (!shared) return MAPS[key];
  const M = MAPS[key], C = { ...M, ground: M.ground.slice(), overlay: M.overlay.slice(), solid: M.solid.slice(), reach: M.reach.slice(), objB: M.objB.map(o => o.slice()) };
  const nk = key + '~' + tag; MAPS[nk] = C; R.map = nk; return C;
}
function platOpen(M, x, y, floor) {
  if (x < 1 || y < 1 || x >= M.w - 1 || y >= M.h - 1) return false;
  const i = y * M.w + x; if ((M.ground[i] & 0xff) - 1 !== floor) return false;
  if (M.reach[i] && !M.solid[i]) return true;
  let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (M.solid[(y + dy) * M.w + x + dx]) n++;
  return n <= 4;   // (a lone rock or a tree's trunk, with open floor round it)
}
// a w x h spot of open floor. Best of all, one backed by the forest: its north edge against the wall of trees along the map's
// back, so it reads as the land rising toward the woods rather than a box set down on the meadow. Its other three sides
// keep a margin of open floor, and it stays clear of the map's sides, bridges and side-area paths.
function platSpot(R, M, w, h, rnd) {
  const floor = platFloor(M); if (floor < 0) return null;
  const m = PLAT.margin, green = (x, y) => (M.waterShapes || []).some(q => ((x + 0.5 - q[1]) / (q[3] + 4)) ** 2 + ((y + 0.5 - q[2]) / (q[4] + 3.5)) ** 2 <= 1);   // (clear of the oases and their shores)
  const isle = M.tileset === 209, open = (x, y) => x >= 1 && y >= 1 && x < M.w - 1 && y < M.h - 1 && M.reach[y * M.w + x] && !M.solid[y * M.w + x];   // (Skyreach Isles: any walkable cloud ground, its tiles vary)
  const ok = (x, y) => (isle ? open(x, y) : platOpen(M, x, y, floor)) && !green(x, y);   // (never over an oasis's green ring)
  const busy = (x0) => WILDS.bridges.some(b => b && b.x1 + 2 >= R.ox + x0 - m && b.x0 - 2 <= R.ox + x0 + w + m) ||
    (R.subs || []).some(u => (u.path || []).some(([px]) => px >= R.ox + x0 - m - 2 && px <= R.ox + x0 + w + m + 2));
  const backed = [], free = [];
  for (let y0 = 2; y0 + h + m + 2 <= M.h; y0++) for (let x0 = PLAT.edgeGap; x0 + w + PLAT.edgeGap <= M.w; x0++) {
    let good = true;
    for (let y = y0; y < y0 + h + m && good; y++) for (let x = x0 - m; x < x0 + w + m; x++) {
      if (y < y0 + 2 && (x < x0 || x >= x0 + w)) continue;   // (beside its back corners the forest may come close)
      if (!ok(x, y)) { good = false; break; }
    }
    if (!good || busy(x0)) continue;
    let wall = 0, open = 0; for (let x = x0; x < x0 + w; x++) { if (!ok(x, y0 - 1)) wall++; for (let y = y0 - m; y < y0; y++) if (ok(x, y)) open++; }
    if (wall >= w * 0.6) backed.push([x0, y0]); else if (open === w * m) free.push([x0, y0]);
  }
  const C = backed.length ? backed : free; return C.length ? C[Math.floor(rnd() * C.length)] : null;
}
// lay the plateau's tiles into the map (and its walls into the world's wall grid)
function platStamp(R, M, S, x0, y0, w, h) {
  const P = PLAT, alt = (a, i) => a[i % a.length], sx = x0 + Math.floor(w / 2) - 1, floor = platFloor(M), F = S.face.length;
  const put = (x, y, c, solid) => {
    const g = c.g == null ? floor : c.g, o = c.o == null ? -1 : c.o, i = y * M.w + x;
    M.ground[i] = (g + 1) | (solid << 8); M.overlay[i] = o >= 0 ? o + 1 : 0; M.solid[i] = solid; M.reach[i] = solid ? 0 : 1;
    const wi = (R.oy + y) * WILDS.w + R.ox + x; WILDS.solid[wi] = solid; if (WILDS.reach) WILDS.reach[wi] = solid ? 0 : 1;
    if (solid) P.walls.add(wi); else P.walls.delete(wi);
  };
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const cx = x - x0, cy = y - y0, L = cx === 0, Rt = cx === w - 1, fr = cy - (h - F);
    if (cy === 0) put(x, y, L ? S.top.l : Rt ? S.top.r : alt(S.top.m, cx), 1);               // the edge along the top
    else if (fr >= 0) { const row = S.face[fr]; put(x, y, L ? row.l : Rt ? row.r : alt(row.m, cx), 1); }   // the face
    else if (L) put(x, y, alt(S.sideL, cy), 1);                                               // the west side
    else if (Rt) put(x, y, alt(S.sideR, cy), 1);                                              // the east side
    else put(x, y, PC(S.topFloor), 0);                                                        // the high ground itself
  }
  for (let k = 0; k < F; k++) for (let j = 0; j < 2; j++) put(sx + j, y0 + h - F + k, S.stairs[k][j], 0);   // the stairs, open both ways
  if (S.flower != null) { let s2 = (x0 * 73856093 ^ y0 * 19349663) >>> 0; const r2 = () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296);   // a few flowers up top
    for (let k = 0; k < Math.round((w - 2) * (h - F - 2) * 0.06); k++) { const fx = x0 + 1 + Math.floor(r2() * (w - 2)), fy = y0 + 1 + Math.floor(r2() * (h - F - 2)); if (fx === sx || fx === sx + 1) continue; M.overlay[fy * M.w + fx] = S.flower + 1; } }
  for (let y = y0; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {   // open floor round its sides and foot (lone rocks there go; the woods behind stay)
    if (y < y0 + h && x >= x0 && x < x0 + w) continue;
    const i = y * M.w + x; if (M.solid[i] || (M.overlay[i] & 0xff)) put(x, y, PC(), 0);
  }
  if (S.base) for (let x = x0; x < x0 + w; x++) if (x < sx || x > sx + 1) { const cx = x - x0; put(x, y0 + h, PC(undefined, cx === 0 ? S.base.l : cx === w - 1 ? S.base.r : alt(S.base.m, cx)), 0); }   // its shadow on the floor
  // nothing left standing on it or in front of its face (trees, rocks, signs)
  const px0 = (x0 - 1) * T, px1 = (x0 + w + 1) * T, py0 = y0 * T, py1 = (y0 + h + 2) * T;   // (trees just behind it stay: their crowns hang over its rim)
  M.objB = M.objB.filter(o => !(o[2] >= px0 && o[2] < px1 && o[3] >= py0 && o[3] < py1));
  platDress(M, S.deco, x0, y0, w, h, F, sx);
  P.list.push({ x: R.ox + x0, y: R.oy + y0, w, h, f: F, sx: R.ox + sx, map: R.map });
}
// DRESSING, with the maps' own objects: a few pines toward its back (their crowns rise over the rim and into the woods), a bush
// or two up top, and flowering bushes and flowers gathered round its front corners and along its foot, so it sits in the land
function platDress(M, D, x0, y0, w, h, F, sx) {
  let s = (x0 * 2654435761 ^ y0 * 40503) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), pick = a => a[Math.floor(r() * a.length)];
  const add = (o, tx, ty, dx = 0, dy = 0) => M.objB.push([o[0], o[1], Math.round(tx * T + 8 + dx), Math.round(ty * T + 12 + dy)]);
  const stair = tx => tx >= sx - 1 && tx <= sx + 2;
  const nPine = Math.max(2, Math.round(w / 5));   // pines along the back of the top
  for (let k = 0; k < nPine; k++) { let tx = x0 + 1 + Math.round((k + 0.5) * (w - 2) / nPine - 0.5 + (r() - 0.5)); tx = Math.min(x0 + w - 2, Math.max(x0 + 1, tx)); if (Math.abs(tx - (sx + 0.5)) < 2.5) tx = tx <= sx ? sx - 2 : sx + 3; add(pick(D.pine), tx, y0 + 1 + (r() < 0.4 ? 1 : 0), (r() - 0.5) * 6); }   // (the middle of the back is kept for the treasure chest)
  for (const tx of [x0 + 1 + Math.floor(r() * 2), x0 + w - 2 - Math.floor(r() * 2)]) if (!stair(tx)) add(r() < 0.5 ? pick(D.shrub) : pick(D.bloom), tx, y0 + h - F - 2);   // up top, near the front (a row back from the lip, so it stands on the top, not on the cliff edge: 2026-11-07)
  for (const [tx, ty] of [[x0 - 1, y0 + h - 1], [x0 + w, y0 + h - 1], [x0 - 1, y0 + h - F - 1], [x0 + w, y0 + h - F - 1]]) if (r() < 0.85) add(r() < 0.35 ? pick(D.shrub) : pick(D.bloom), tx, ty, (r() - 0.5) * 4 + (tx < x0 ? -7 : 7));   // round its corners (nudged out, clear of the cliff sides: 2026-11-07)
  for (let tx = x0; tx < x0 + w; tx++) if (!stair(tx) && r() < 0.3) add(pick(D.flowers), tx, y0 + h, (r() - 0.5) * 8, -2);   // flowers along its foot
}
// is world tile (tx, ty) on a plateau or within m tiles of one? (landmarks, chests and the like keep clear)
function platNear(tx, ty, m = 0) { return PLAT.list.some(P => tx >= P.x - m && tx < P.x + P.w + m && ty >= P.y - m && ty < P.y + P.h + m); }
// place them through the lands that have a piece set (the grass lands and the ice lands): always one in the map next to
// Hearthvale, then in about two maps out of five (PLAT.share), chosen by the world seed
function placePlateaus() {
  let s = (WORLD_SEED ^ 0x5a17e) >>> 0; const rnd1 = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const lands = REGIONS.filter(r => r.zone >= 0 && PLAT_SETS[regMap(r).tileset] && regMap(r).tileset !== 209).sort((a, b) => b.ox - a.ox);
  // (Skyreach Isles came later: its maps come after all the others, on a stream of their own, so nothing else moved)
  const isles = REGIONS.filter(r => r.zone >= 0 && regMap(r).tileset === 209).sort((a, b) => b.ox - a.ox);
  let s2 = (WORLD_SEED ^ 0x15e5) >>> 0; const rnd2 = () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const [i, R] of [...lands, ...isles].entries()) {
    const rnd = i < lands.length ? rnd1 : rnd2;
    if (i > 0 && i !== lands.length && rnd() > (i < lands.length ? PLAT.share : PLAT.isles.share)) continue;
    const S = PLAT_SETS[regMap(R).tileset], extra = S.face.length - 2;
    const Z = regMap(R).tileset === 209 ? PLAT.isles : PLAT;   // (the isles' islands are smaller: smaller cliffs)
    const w = Z.w[0] + Math.floor(rnd() * (Z.w[1] - Z.w[0] + 1)), h = Z.h[0] + extra + Math.floor(rnd() * (Z.h[1] - Z.h[0] + 1));
    const M0 = regMap(R); if ((M0.sandShapes || []).length || ((M0.waterShapes || []).length && !M0.grassShapes)) continue;   // (the desert's oases are fine: platSpot keeps clear of them)
    if (typeof ORIG_FIELDS !== 'undefined' && ORIG_FIELDS.flat().includes(String(R.map).split('@')[0])) continue;   // (Zenonia's own maps have their own ledges)
    const at = platSpot(R, M0, w, h + (S.base ? 1 : 0), rnd); if (!at) continue;
    const M = platOwnMap(R, 'p' + PLAT.list.length);
    platStamp(R, M, S, at[0], at[1], w, h);
    if (rnd() < PLAT.second) {   // a second one, somewhere else in the same map: two levels of high ground to explore
      const w2 = Z.w[0] + Math.floor(rnd() * (Z.w[1] - Z.w[0] + 1)), h2 = Z.h[0] + extra + Math.floor(rnd() * (Z.h[1] - Z.h[0] + 1));
      for (let k = 0; k < 6; k++) { const b = platSpot(R, M, w2, h2 + (S.base ? 1 : 0), rnd); if (!b) break; if (platNear(R.ox + b[0], R.oy + b[1], PLAT.margin + 1) || platNear(R.ox + b[0] + w2, R.oy + b[1] + h2, PLAT.margin + 1) || platNear(R.ox + b[0] + w2, R.oy + b[1], PLAT.margin + 1) || platNear(R.ox + b[0], R.oy + b[1] + h2, PLAT.margin + 1)) continue; platStamp(R, M, S, b[0], b[1], w2, h2); break; }
    }
  }
}
try { placePlateaus(); } catch (e) { console.warn('plateaus:', e); }
// (no painted shadow round it: a dark band under the face made it look as if it floated; the face's own tiles carry the height)

// ---- STAGE 3: the high ground's own life
// which level is a spot on? 1 up on a plateau, 0 below, 0.5 on its stairs (between both)
function platLevelAt(x, y) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  for (const P of PLAT.list) {
    if (tx < P.x || tx >= P.x + P.w || ty < P.y || ty >= P.y + P.h) continue;
    if (ty >= P.y + P.h - (P.f || 2) && tx >= P.sx && tx <= P.sx + 1) return 0.5;
    return 1;
  }
  return 0;
}
// are two fighters on different levels (one up top, one below the cliff)? A blade can't reach across; spells and arrows still can
function platApart(a, b) {
  if (!PLAT.list.length) return false;
  const la = platLevelAt(a.x, a.y), lb = platLevelAt(b.x, b.y);
  return la !== 0.5 && lb !== 0.5 && la !== lb;
}
// GUARDS: when you come near a plateau, two or three of the area's monsters are up there (somewhat tougher: they keep the
// treasure). They come back a couple of minutes after they are beaten or left behind.
const PLAT_LIFE = { near: 520, guards: [2, 3], back: 120000, hpMul: 1.25 };
function platRegion(P) { return REGIONS.find(r => r.map === P.map); }
function platGuards(w) {
  const p = w.player; if (!p || !w.overworld || w.interior) return;
  const now = performance.now(); w.platGuardAt = w.platGuardAt || {};
  PLAT.list.forEach((P, i) => {
    const cx = (P.x + P.w / 2) * T, cy = (P.y + P.h / 2) * T; if (Math.abs(p.x - cx) > PLAT_LIFE.near || Math.abs(p.y - cy) > PLAT_LIFE.near) return;
    if (w.actors.some(a => a.platId === i && !a.dead && !a.remove)) return;
    if (now - (w.platGuardAt[i] || -1e9) < PLAT_LIFE.back) return;
    const R = platRegion(P); if (!R || typeof spawnMonster !== 'function') return;
    w.platGuardAt[i] = now;
    const n = PLAT_LIFE.guards[0] + Math.floor(Math.random() * (PLAT_LIFE.guards[1] - PLAT_LIFE.guards[0] + 1));
    for (let k = 0; k < n; k++) {
      const m = spawnMonster(w, R.zone, true, R); if (!m) continue;
      for (let t = 0; t < 30; t++) {   // a free spot on top, away from the stairs and the pines' trunks
        const x = (P.x + 2 + Math.random() * (P.w - 4)) * T, y = (P.y + 2 + Math.random() * (P.h - (P.f || 2) - 3)) * T;
        if (w.blocked(x, y) || Math.abs(x - (P.sx + 1) * T) < 24) continue;
        m.x = x; m.y = y; break;
      }
      if (platLevelAt(m.x, m.y) !== 1) { m.remove = true; continue; }
      m.home = { x: m.x, y: m.y }; m.platId = i; m.maxHp = m.hp = Math.round(m.maxHp * PLAT_LIFE.hpMul);
    }
  });
}
{
  const tp = tendPopulation;
  tendPopulation = (w, dt) => { tp(w, dt); platGuards(w); };
}
// TREASURE: each plateau keeps a chest at the back of its top, between the pines, once a day (rich loot, plus a second roll)
function platChestKey(P) { return P.map + ':' + P.x; }
function platChests(w, game) {
  const pr = game && game.profile, today = typeof dayNo === 'function' ? dayNo() : 0;
  const got = pr && pr.platChest && pr.platChest.day === today ? pr.platChest.got : [];
  PLAT.list.forEach(P => {
    if (got.includes(platChestKey(P))) return;
    const x = (P.sx + 1) * T, y = (P.y + 2) * T + 10, o = makeMapObject([3, 0, x, y]); if (!o) return;
    o.region = platRegion(P); o.platChest = platChestKey(P); w.objects.push(o);
  });
}
{
  const mo = makeOverworld;
  makeOverworld = (game, spawn) => { const w = mo(game, spawn); try { platChests(w, game); } catch (e) {} return w; };
}
// a plateau's chest was opened (props.js openChest): remember it for today, and its extra
function platChestOpened(world, o) {
  {
    const g = window.GAME, pr = g && g.profile; if (!pr) return;
    const today = typeof dayNo === 'function' ? dayNo() : 0;
    if (!pr.platChest || pr.platChest.day !== today) pr.platChest = { day: today, got: [] };
    if (!pr.platChest.got.includes(o.platChest)) pr.platChest.got.push(o.platChest);
    propDrop(world, o.x + 12, o.bottom + 6, false);   // (the high ground's extra)
    g.toast('High ground treasure!', '#ffd23f');
  }
}

// HOPPING DOWN: up on a plateau, lean into its front face or one of its sides for a moment and you hop down in a little arc,
// landing on the ground beside it (never over the back, where the woods are; going up is still by the stairs). Only where
// there is open ground to land on.
const PLAT_HOP = { lean: 260, dur: 420, lift: 10 };
function platAt(x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return PLAT.list.find(P => tx >= P.x && tx < P.x + P.w && ty >= P.y && ty < P.y + P.h); }
{
  const ua = updateActor;
  updateActor = (world, a, dt, input) => {
    const H = a.platHop;
    if (H) {   // mid-hop: glide along the arc, then land
      H.t += dt; const k = Math.min(1, H.t / H.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      a.x = H.x0 + (H.x1 - H.x0) * e; a.y = H.y0 + (H.y1 - H.y0) * e; a.z = Math.sin(k * Math.PI) * PLAT_HOP.lift + (1 - k) * H.drop;
      if (k >= 1) { a.platHop = null; a.z = 0; world.rings.push({ x: a.x, y: a.y, r: 12, t: 0, col: '#e8e0c8' }); }
      return;
    }
    ua(world, a, dt, input);
    if (a.kind !== 'player' || !world.overworld || !input || a.state !== 'free' || a.driving || !(input.mx || input.my)) { a.platLean = 0; return; }
    const P = platAt(a.x, a.y); if (!P || platLevelAt(a.x, a.y) !== 1) { a.platLean = 0; return; }
    const ax = Math.abs(input.mx) >= Math.abs(input.my), dx = ax ? Math.sign(input.mx) : 0, dy = ax ? 0 : Math.sign(input.my);
    if (dy < 0 || !world.blocked(a.x + dx * 8, a.y + dy * 8, a)) { a.platLean = 0; return; }   // (only into the front or a side, and only when the edge stops you)
    const wall = (Math.floor((a.y + dy * 12) / T)) * WILDS.w + Math.floor((a.x + dx * 12) / T); if (!PLAT.walls.has(wall)) { a.platLean = 0; return; }   // (a pine or the chest isn't an edge; looked for a little past the feet, where the wall is)
    if ((a.platLean = (a.platLean || 0) + dt) < PLAT_HOP.lean) return;
    a.platLean = 0;
    // where to land: past the face (and its shadow row), or just past the side
    const cands = dy > 0 ? [[a.x, (P.y + P.h + 1) * T + 6]] : [[dx > 0 ? (P.x + P.w) * T + 12 : P.x * T - 12, a.y]];   // (12 px clear of the side, so the feet don't touch the wall)
    const land = cands.map(([x, y]) => [x, y]).find(([x, y]) => !world.blocked(x, y, a) && !world.blocked(x - 5, y, a) && !world.blocked(x + 5, y, a)); if (!land) return;
    a.platHop = { x0: a.x, y0: a.y, x1: land[0], y1: land[1], t: 0, dur: PLAT_HOP.dur, drop: 0 };
    a.invuln = Math.max(a.invuln || 0, PLAT_HOP.dur);
  };
}

