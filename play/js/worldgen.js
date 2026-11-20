'use strict';
// World generation (runs before world.js): the randomized Wilds, the village of Hearthvale, and the Sun Temple arena.
//
// The Wilds are rebuilt from the decoded Zenonia maps every time the world seed changes (a new game gets a new
// seed). Each zone is a long chain of areas drawn at random from that zone's own maps — about three times as many
// areas as before, shuffled so no two neighbours repeat, set at random heights so every crossing lands somewhere
// different — and stitched west → east exactly like the old baked world (river gaps, one crossing between
// neighbours). Repeated maps get their own names ("Old Orchard II").

const WG_MAPS = D.world.maps, WG_T = 16;

// ---------------------------------------------------------------- seed
// Stable per save: the profile keeps its world seed, so the same hero always walks the same world.
const SAVE_KEY_WG = 'zenonia_card_hunters_v1';
function readWorldSeed() {
  try { const q = +new URLSearchParams(location.search).get('seed'); if (q) return q; } catch (e) {}   // a co-op guest plays in the host's world (net.js); their own seed is left alone
  try {
    const raw = localStorage.getItem(SAVE_KEY_WG);
    const pr = raw && JSON.parse(raw);
    if (pr && pr.worldSeed) return pr.worldSeed;
    const s = +localStorage.getItem('zch_world_seed');
    if (s) return s;
  } catch (e) {}
  const s = 1 + Math.floor(Math.random() * 2147483646);
  try { localStorage.setItem('zch_world_seed', String(s)); } catch (e) {}
  return s;
}
const WORLD_SEED = readWorldSeed();
function seededRng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- map building helpers
function blankMap(w, h, tileset, fillTile) {
  const n = w * h;
  return { name: '', w, h, tileset, ground: new Array(n).fill(fillTile + 1), overlay: new Array(n).fill(0), objA: [], objB: [],
    solid: new Array(n).fill(0), reach: new Array(n).fill(0), spawn: [w * 8, h * 8], entry: [w * 8, h * 8], filler: fillTile + 1 };
}
const setTile = (M, x, y, tile, solid = 0) => { if (x < 0 || y < 0 || x >= M.w || y >= M.h) return; const i = y * M.w + x; M.ground[i] = (tile + 1) | (solid << 8); M.solid[i] = solid; };
const setRaw = (M, x, y, v) => { if (x < 0 || y < 0 || x >= M.w || y >= M.h) return; const i = y * M.w + x; M.ground[i] = v; M.solid[i] = (v >> 8) & 1; };
const setSolid = (M, x, y, s = 1) => { if (x < 0 || y < 0 || x >= M.w || y >= M.h) return; const i = y * M.w + x; M.solid[i] = s; M.ground[i] = (M.ground[i] & 0xff) | (s << 8); };
function objFrame(bank, fi) {
  const B = D.objects.banks[String(bank).padStart(3, '0')];
  return B && B.f[fi] != null ? D.objects.frames[B.f[fi]] : null;
}
// place an object so its sprite's bottom-centre sits at (bx, by) in pixels
function placeObj(M, bank, fi, bx, by) {
  const f = objFrame(bank, fi); if (!f) return null;
  const x = Math.round(bx - (f[4] + f[2] / 2)), y = Math.round(by - (f[5] + f[3]));
  M.objB.push([bank, fi, x, y]);
  return { x, y, w: f[2], h: f[3], left: bx - f[2] / 2 };
}
// copy a rectangle of another map's tiles (and the objects standing in it) into M
function stampMap(M, srcKey, sx, sy, w, h, dx, dy, keepObj = () => true) {
  const S = WG_MAPS[srcKey];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tx = sx + x, ty = sy + y; if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) continue;
    const i = ty * S.w + tx;
    setRaw(M, dx + x, dy + y, S.ground[i]);
    const j = (dy + y) * M.w + dx + x; if (j >= 0 && j < M.overlay.length) M.overlay[j] = S.overlay[i];
  }
  for (const o of S.objB) {
    const [bank, fi, ox, oy] = o;
    if (ox < sx * WG_T || ox >= (sx + w) * WG_T || oy < sy * WG_T || oy >= (sy + h) * WG_T || !keepObj(bank, fi)) continue;
    M.objB.push([bank, fi, ox + (dx - sx) * WG_T, oy + (dy - sy) * WG_T]);
  }
  for (const o of S.objA) {
    const [bank, fi, ox, oy] = o;
    if (ox < sx * WG_T || ox >= (sx + w) * WG_T || oy < sy * WG_T || oy >= (sy + h) * WG_T) continue;
    M.objA.push([bank, fi, ox + (dx - sx) * WG_T, oy + (dy - sy) * WG_T]);
  }
}
// reachable = the open area connected to (sx, sy)
function floodReach(M, sx, sy) {
  M.reach = new Array(M.w * M.h).fill(0);
  const st = [sy * M.w + sx]; if (M.solid[st[0]]) return;
  M.reach[st[0]] = 1;
  while (st.length) {
    const c = st.pop(), x = c % M.w, y = (c - x) / M.w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= M.w || ny >= M.h) continue;
      const j = ny * M.w + nx; if (!M.solid[j] && !M.reach[j]) { M.reach[j] = 1; st.push(j); }
    }
  }
}

// ================================================================ the village of Hearthvale
// A small, simple town ringed by forest: a sandy main street running in from the west (where the road to the
// Wilds begins), a plaza with the Fusion Fountain, a row of merchants along the north side — Smith (weapons &
// armour), Grocer (potions, food, seeds), Card Hall (summons) and the Hunters' Guild (quests) — and your home in
// the south-east with its 7 × 3 farm beside it.
const VILLAGE = {
  W: 84, H: 40,   // (40 rows: the lake below the cliff bank is deep enough for the long pier)
  shops: [
    { id: 'smith',  bank: 13, fi: 10, bx: 9,  by: 10, npc: '104', label: 'Smith',        role: 'shop_gear', place: 'Smithy',        sym: '⚒' },
    { id: 'grocer', bank: 13, fi: 14, bx: 17, by: 10, npc: '116', label: 'Grocer',       role: 'shop_item', place: 'General Store', sym: '⚗' },
    { id: 'cards',  bank: 13, fi: 9,  bx: 31, by: 10, npc: '120', label: 'Card Oracle',  role: 'gacha',     place: 'Card Hall',     sym: '🂠' },
    { id: 'guild',  bank: 13, fi: 13, bx: 40, by: 10, npc: '111', label: 'Guild Master', role: 'quest',     place: "Hunters' Guild", sym: '' },
    { id: 'style',  bank: 13, fi: 6,  bx: 8,  by: 31, npc: '122', label: 'Stylist',      role: 'style',     place: 'Stylist',       sym: '✂' },
  ],
  home: { bank: 13, fi: 12, bx: 38, by: 31 },
  dojo: { bank: 13, fi: 1, bx: 24, by: 10 },   // the Dojo (dojo.js): a hall you walk into, between the General Store and the Card Hall
  fountain: { bx: 24, by: 18 },
  // top-left tile of each 2x2 farm plot: a 7 × 3 field right beside the house (west of it, a tile clear of the lake), a
  // one-tile path between plots; older saves keep their crops by plot number
  plots: [[15, 25], [18, 25], [21, 25], [24, 25], [27, 25], [30, 25], [33, 25], [15, 28], [18, 28], [21, 28], [24, 28], [27, 28], [30, 28], [33, 28], [15, 31], [18, 31], [21, 31], [24, 31], [27, 31], [30, 31], [33, 31]],
  board: [12, 26],   // the Farm Board (farming stats), at the field's west end
  pantry: [10, 24],  // MY CHEST (the food store), up and to the left of the Farm Board
  well: [12, 29],    // the stone well below the Farm Board: refills the watering can
  campfire: [14, 24],   // the campfire: roast farm food into snacks
  lakeY: 35, shoreY: 32,   // from lakeY down the town's south edge is lake, below a two-row cliff (33-34); shoreY is the grass shore above it (fill the watering can there)
  spawn: [24, 21], west: [5, 17],
  // the East End: neighbours' houses along the road, in art the game wasn't using yet; the farmyard buildings stand south of it
  houses: [[13, 2, 50, 10], [13, 5, 56, 10], [13, 3, 62, 10], [13, 7, 68, 10], [13, 8, 74, 10], [13, 4, 67, 28], [46, 0, 74, 28], [5, 0, 79, 25], [5, 1, 79, 31], [7, 0, 79, 10]],
  mill: [46, 13], statue: [64, 18], square: [64.5, 18.5, 7, 3.8],
  butcher: [62, 29],   // the butcher's cottage (animals.js): on the grass east of the terrace; the game's own cottage and its meat-and-cleaver sign
};
// (No longer used: the darker patches were the game's cloud-shadow tiles standing still — world.js drawCloudShadows
// now draws drifting cloud shadows instead.) Soft patches of darker grass on tileset 1's plain grass (tile 0), drawn with the tileset's own edge pieces so they
// blend in. Dark/light is decided per tile corner (a vertex grid); each tile then takes the piece whose four corners
// match. Only shapes the tileset has a piece for are kept: a tile that would need a missing piece (a diagonal, or the
// one inner corner it lacks) turns fully dark, and that repeats until every tile fits. Patches stay on plain grass
// (ok(x, y)), never touching streets, plots or buildings.
const GRASS_PIECE = {   // corners TL TR BL BR (1 = dark) -> tile(s)
  '0000': [0], '1111': [30, 30, 30, 40, 60],
  '1000': [31], '0100': [34], '0010': [51], '0001': [54],
  '1010': [35], '0101': [36], '0011': [45], '1100': [46],
  '1110': [32, 42], '1101': [43], '0111': [53, 55],
};
function grassPatches(M, R, ok) {
  const W = M.w, H = M.h, V = new Uint8Array((W + 1) * (H + 1)), vi = (x, y) => y * (W + 1) + x;
  const tileOk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (M.ground[y * W + x] & 0xff) === 1 && ok(x, y);
  const vertexOk = (x, y) => tileOk(x - 1, y - 1) && tileOk(x, y - 1) && tileOk(x - 1, y) && tileOk(x, y);
  const n = Math.round(W * H / 90);
  for (let k = 0; k < n; k++) {   // blobs: a few overlapping ellipses each
    const cx = 3 + R() * (W - 6), cy = 3 + R() * (H - 6);
    for (let b = 0; b < 3; b++) {
      const ex = cx + (R() - 0.5) * 4, ey = cy + (R() - 0.5) * 3, rx = 1.2 + R() * 2.4, ry = 1 + R() * 1.6;
      for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) if (((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1 && vertexOk(x, y)) V[vi(x, y)] = 1;
    }
  }
  const key = (x, y) => `${V[vi(x, y)]}${V[vi(x + 1, y)]}${V[vi(x, y + 1)]}${V[vi(x + 1, y + 1)]}`;
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {   // grow away the shapes the tileset can't draw
    changed = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (GRASS_PIECE[key(x, y)]) continue;
      const vs = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
      if (vs.every(([a, b]) => vertexOk(a, b))) for (const [a, b] of vs) V[vi(a, b)] = 1;
      else for (const [a, b] of vs) V[vi(a, b)] = 0;   // can't grow here (next to a street): pull back instead
      changed = true;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!tileOk(x, y)) continue;
    const t = GRASS_PIECE[key(x, y)] || [0];
    M.ground[y * W + x] = (t[Math.floor(R() * t.length)] + 1) | (M.solid[y * W + x] << 8);
    // the tuft (23) and pebble (29) overlays are painted on light grass: on a darkened tile they were a pale square
    if (t[0] !== 0 && LIGHT_BACKED.has((M.overlay[y * W + x] & 0xff) - 1)) M.overlay[y * W + x] = 0;
  }
}
const LIGHT_BACKED = new Set([23, 29]);
// The decoded maps block some cells that are drawn as plain grass, with no scenery on them and no object over them
// (leftovers of the originals): invisible walls. Such cells open up here, before the world is built, and the map's
// walkable area is worked out again. Only the green lands' plain grass tiles count (never treetops, stairs or paths).
const PLAIN_GRASS = {
  1: new Set([0, 2, 3, 5, 6, 10, 11, 12, 13, 14, 15, 16, 20, 22, 23, 25, 26, 30, 31, 32, 33, 34, 35, 36, 40, 41, 42, 43, 44, 45, 46, 48, 50, 51, 52, 53, 54, 55, 58, 60, 61, 62, 63]),
  201: new Set([0, 1, 4, 7, 8, 10, 17, 18, 20, 21, 24, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 48, 50, 51, 52, 53, 60, 61, 62, 63]),
};
function openInvisibleWalls() {
  for (const [key, M] of Object.entries(WG_MAPS)) {
    const G = PLAIN_GRASS[M.tileset]; if (!G || !/^z\d/.test(key) || !M.overlay) continue;
    const boxes = M.objA.concat(M.objB).map(([b, fi, x, y]) => { const f = objFrame(b, fi); return f && [x + f[4] - 2, y + f[5] - 2, x + f[4] + f[2] + 2, y + f[5] + f[3] + 2]; }).filter(Boolean);
    let opened = 0;
    for (let ty = 0; ty < M.h; ty++) for (let tx = 0; tx < M.w; tx++) {
      const i = ty * M.w + tx; if (!M.solid[i] || (M.overlay[i] & 0xff) || !G.has((M.ground[i] & 0xff) - 1)) continue;
      const cx = tx * WG_T + 8, cy = ty * WG_T + 8;
      if (boxes.some(([x0, y0, x1, y1]) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1)) continue;
      M.solid[i] = 0; M.ground[i] &= 0xff; opened++;
    }
    if (opened && M.spawn) floodReach(M, Math.floor(M.spawn[0] / WG_T), Math.floor(M.spawn[1] / WG_T));
  }
}
// Stairs that climb off a map's top or bottom edge led to the next map in the original game; here they would lead
// into the water. Each column of the stairs (within STAIR_BAND rows of that edge) takes a copy of the nearest column
// beside it that has no stair pieces — its ground, cliff art and collision — so the cliff runs on unbroken.
const STAIR_TILES = { 1: new Set([56, 57, 66, 67, 90, 93, 100, 103]) }, STAIR_BAND = 4;
function fixEdgeStairs() {
  for (const [key, M] of Object.entries(WG_MAPS)) {
    const S = STAIR_TILES[M.tileset]; if (!S || !/^z\d/.test(key) || !M.overlay) continue;
    let changed = false;
    for (const [y0, y1] of [[0, STAIR_BAND], [M.h - STAIR_BAND, M.h]]) {
      const hasStair = x => { for (let y = y0; y < y1; y++) if (S.has((M.overlay[y * M.w + x] & 0xff) - 1)) return true; return false; };
      const bad = []; for (let x = 0; x < M.w; x++) if (hasStair(x)) bad.push(x);
      for (const x of bad) {
        let src = -1;
        for (let d = 1; d < M.w && src < 0; d++) for (const c of [x - d, x + d]) if (c >= 0 && c < M.w && !hasStair(c)) { src = c; break; }
        if (src < 0) continue;
        for (let y = y0; y < y1; y++) { const i = y * M.w + x, j = y * M.w + src; M.ground[i] = M.ground[j]; M.overlay[i] = M.overlay[j]; M.solid[i] = M.solid[j]; }
        changed = true;
      }
    }
    if (changed && M.spawn) floodReach(M, Math.floor(M.spawn[0] / WG_T), Math.floor(M.spawn[1] / WG_T));
  }
}
fixEdgeStairs();
// Where the original game's path left a map, a short stub of land (cliff or ground) pokes out of the water in the
// map's outermost column, cut off at the edge. In the green lands (tileset 201, water tiles EDGE_WATER)
// such a stub — four cells or fewer of solid land in the first or last column, with water above and below — becomes water.
// (the green lands' water tiles: found by the game's own pixel test, world.js waterTile, plus the dithered sky 182–185)
const EDGE_WATER = { 201: new Set([5, 11, 12, 13, 14, 15, 16, 25, 26, 84, 88, 180, 181, 182, 183, 184, 185, 190, 191, 192, 193, 194, 195, 196, 197, 212]) }, STUB_MAX = 4;
const PURE_WATER = new Set([5, 180, 181, 182, 183, 184, 185]);   // all water, no shore in the picture
function trimEdgeStubs() {
  for (const [key, M] of Object.entries(WG_MAPS)) {
    const Wt = EDGE_WATER[M.tileset]; if (!Wt || !/^z\d/.test(key)) continue;
    const wet = (x, y) => y < 0 || y >= M.h || Wt.has((M.ground[y * M.w + x] & 0xff) - 1);
    let changed = false;
    for (const x of [0, M.w - 1]) {
      for (let y = 0; y < M.h; y++) {
        if (wet(x, y)) continue;
        let e = y; while (e < M.h && !wet(x, e)) e++;
        let solid = true; for (let k = y; k < e; k++) if (!M.solid[k * M.w + x]) solid = false;   // walkable stubs may be a crossing: keep them
        if (y > 0 && e < M.h && e - y <= STUB_MAX && solid)
          for (let k = y; k < e; k++) { const i = k * M.w + x; M.ground[i] = (180 + 1) | (1 << 8); M.overlay[i] = 0; M.solid[i] = 1; changed = true; }
        y = e;
      }
    }
    // shoreline tiles in the two outermost columns: their grass edge faces the cut, a thin green strip in the water
    for (const x of [0, 1, M.w - 2, M.w - 1]) for (let y = 0; y < M.h; y++) {
      const i = y * M.w + x, t = (M.ground[i] & 0xff) - 1;
      if (Wt.has(t) && !PURE_WATER.has(t)) { M.ground[i] = (180 + 1) | (M.ground[i] & 0xff00); M.overlay[i] = 0; changed = true; }
    }
    if (changed && M.spawn) floodReach(M, Math.floor(M.spawn[0] / WG_T), Math.floor(M.spawn[1] / WG_T));
  }
}
trimEdgeStubs();
// The green lands' water (EDGE_WATER) is walkable in some decoded maps — you could stroll out across a lake,
// and a river crossing could land on it. It becomes solid (bridges and decks, flag 0x20, stay walkable), and a thin
// strip of land in a map's outermost column with water just inside it becomes water too. A map where that would cut
// land off from its spawn keeps its water as it was.
function solidWater() {
  for (const [key, M] of Object.entries(WG_MAPS)) {
    const Wt = EDGE_WATER[M.tileset]; if (!Wt || !/^z\d/.test(key) || !M.spawn) continue;
    const g0 = M.ground.slice(), s0 = M.solid.slice(), o0 = M.overlay.slice();
    const isW = i => Wt.has((M.ground[i] & 0xff) - 1) && !((M.ground[i] >> 8) & 0x20);
    const flood = () => { const seen = new Uint8Array(M.w * M.h), st = [[Math.floor(M.spawn[0] / WG_T), Math.floor(M.spawn[1] / WG_T)]];
      while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= M.w || y >= M.h) continue; const i = y * M.w + x;
        if (seen[i] || M.solid[i]) continue; seen[i] = 1; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } return seen; };
    const before = flood();
    let changed = false;
    for (let i = 0; i < M.w * M.h; i++) if (isW(i) && !M.solid[i]) { M.solid[i] = 1; M.ground[i] = (M.ground[i] & 0xff) | (1 << 8); changed = true; }
    for (const [x, xin] of [[0, 1], [M.w - 1, M.w - 2]]) for (let y = 0; y < M.h; y++) {
      const i = y * M.w + x; if (isW(i) || !isW(y * M.w + xin)) continue;
      M.ground[i] = (180 + 1) | (1 << 8); M.overlay[i] = 0; M.solid[i] = 1; changed = true;
    }
    if (!changed) continue;
    const after = flood();
    let lost = 0; for (let i = 0; i < before.length; i++) if (before[i] && !after[i] && !Wt.has((g0[i] & 0xff) - 1) && !isW(i)) lost++;
    if (lost) { for (let i = 0; i < g0.length; i++) { M.ground[i] = g0[i]; M.solid[i] = s0[i]; M.overlay[i] = o0[i]; } continue; }   // this map needs its water to get around
    floodReach(M, Math.floor(M.spawn[0] / WG_T), Math.floor(M.spawn[1] / WG_T));
  }
}
solidWater();
openInvisibleWalls();
// THE SUN TEMPLE (z3m): its walls were cut-out objects that stand alone once the rest of the fortress is gone, which left patched edges, stray wall pieces,
// shadows of walls long gone, and bands of floor still marked solid. It stands in open water: the top and left edges are that water, the crossing from Frostmere
// comes in on rows 27-30, and the floor inside the great hall is clear. The long wall to the south, the pedestals and the east wall stay.
function tidySunTemple() {
  const M = WG_MAPS.z3m; if (!M) return;
  const set = (x, y, g, o, s) => { const i = y * M.w + x; M.ground[i] = (M.ground[i] & 0xff00) | (g + 1); M.overlay[i] = o; M.solid[i] = s; };
  const water = (x, y) => { const i = y * M.w + x; M.ground[i] = (180 + 1) | (1 << 8); M.overlay[i] = 0; M.solid[i] = 1; };
  for (let y = 0; y < 4; y++) for (let x = 0; x < M.w; x++) water(x, y);
  for (let y = 4; y < M.h; y++) for (const x of [0, 1]) { if (y >= 27 && y <= 30) set(x, y, 80, 0, 0); else water(x, y); }
  const STRAY = new Set([99, 113, 114, 115, 116, 120, 121]);
  for (let y = 4; y <= 30; y++) for (let x = 2; x <= 29; x++) {
    const i = y * M.w + x, t = (M.ground[i] & 0xff) - 1;
    if (STRAY.has(t) || (x >= 26 && (M.overlay[i] & 0xff))) set(x, y, 80, 0, 0);
    else if (M.solid[i] && !(M.overlay[i] & 0xff) && (t === 80 || t === 81)) M.solid[i] = 0;
  }
  for (let y = 4; y < M.h; y++) { const i = y * M.w + M.w - 1; if (((M.ground[i] & 0xff) - 1) < 0) set(M.w - 1, y, 80, 0, 1); }   // (three blank cells on the east edge)
  M.objB = M.objB.filter(o => o[3] >= 4 * WG_T);   // nothing stands out in the water
  floodReach(M, Math.floor(M.spawn[0] / WG_T), Math.floor(M.spawn[1] / WG_T));
}
tidySunTemple();
// DRESSING FROM ZENONIA'S OWN VILLAGE (the decoded map `town`, which the game doesn't use): its hedge rows (246/247 with a
// 250 cap on the row above), picket fences (177 rails, 187 at the end), and the small things by its houses: barrels 230,
// stumps 39, rocks 29, pebbles 26, mushrooms 179, white flowers 47. Laid as the same overlay tiles, on a random stream of
// their own, clear of the streets, plots, doors, lamps, the farm's tools and everyone's spots (folk.js, folkday.js, world.js).
const VILLAGE_DRESS = {
  keep: [[52, 32], [4, 15], [60, 20], [22, 22], [62, 22], [10, 20], [20, 15], [35, 16], [44, 22], [54, 20], [61, 15], [70, 22], [76, 16], [22, 21], [11, 27], [13, 30], [24, 24], [46, 16], [62, 20], [70, 13]],
  gardens: { n: 4, w: [5, 8], h: [4, 5] },   // hedged gardens like the original's: a hedge border (open at the front), flowers inside
  fences: [],                                // (none by the farm: along the plaza's south rim they ran into the benches and hedges)
  props: 70,
};
function villageDressing(M, V, busy, inSand) {
  const X = seededRng(0x7a11e), D = VILLAGE_DRESS, W = V.W, keep = [V.board, V.pantry, V.campfire, V.well, V.spawn, V.west, ...D.keep, ...V.shops.map(S => [S.bx + 1, S.by])];
  const ov = (x, y) => M.overlay[y * W + x] & 0xff;
  const ok = (x, y) => x >= 3 && y >= 4 && x < W - 3 && y < V.shoreY && !M.solid[y * W + x] && !ov(x, y) && !busy.has(x + ',' + y) && !inSand(x + 0.5, y + 0.5)
    && !V.plots.some(([px, py]) => x >= px - 1 && x <= px + 2 && y >= py - 1 && y <= py + 2) && !keep.some(([kx, ky]) => Math.abs(kx - x) <= 1 && Math.abs(ky - y) <= 1);
  const lay = (x, y, t, solid) => { M.overlay[y * W + x] = t + 1; if (solid) setSolid(M, x, y, 1); busy.add(x + ',' + y); };   // (the overlay layer, over the grass)
  // HEDGED GARDENS: a rectangle of clear grass gets a hedge border (its top row capped with 250 on the row above), a
  // two-tile opening in the middle of its front, and white flowers, mushrooms and pebbles inside
  const G = D.gardens, hedgeAt = (x, y) => lay(x, y, (x * 7 + y) % 3 ? 246 : 247, true);
  for (let k = 0, tries = 0; k < G.n && tries < 600; tries++) {
    const w = G.w[0] + Math.floor(X() * (G.w[1] - G.w[0] + 1)), h = G.h[0] + Math.floor(X() * (G.h[1] - G.h[0] + 1)), x0 = 3 + Math.floor(X() * (W - 6 - w)), y0 = 5 + Math.floor(X() * (V.shoreY - 6 - h)), x1 = x0 + w - 1, y1 = y0 + h - 1, gap = Math.floor((x0 + x1) / 2);
    let fits = true; for (let y = y0 - 1; y <= y1 + 1 && fits; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (!ok(x, y)) { fits = false; break; }   // (a tile of clear grass all round, the cap row and the way in included)
    if (!fits) continue;
    for (let x = x0; x <= x1; x++) { hedgeAt(x, y0); M.overlay[(y0 - 1) * W + x] = 250 + 1; if (x !== gap && x !== gap + 1) hedgeAt(x, y1); else busy.add(x + ',' + y1); }
    for (let y = y0 + 1; y < y1; y++) { hedgeAt(x0, y); hedgeAt(x1, y); }
    for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) { const r = X(); if (r < 0.45) lay(x, y, 47, false); else if (r < 0.55) lay(x, y, 179, false); else if (r < 0.62) lay(x, y, 26, false); else busy.add(x + ',' + y); }
    k++;
  }
  for (const [x0, x1, y] of D.fences) { let run = []; const end = () => { if (run.length > 1) run.forEach((x, k) => lay(x, y, k === run.length - 1 ? 187 : 177, true)); run = []; };
    for (let x = x0; x <= x1; x++) { if (ok(x, y)) run.push(x); else end(); } end(); }
  const PROPS = [[230, true, 3], [39, true, 3], [29, true, 3], [26, false, 4], [179, false, 3], [47, false, 4]];   // [tile, solid, weight]
  const tot = PROPS.reduce((a, p) => a + p[2], 0), pickProp = () => { let r = X() * tot; for (const p of PROPS) { r -= p[2]; if (r <= 0) return p; } return PROPS[0]; };
  const homes = [...V.shops, V.home, ...V.houses.map(([b, fi, bx, by]) => ({ bx, by }))];
  for (let k = 0, tries = 0; k < D.props && tries < 900; tries++) {   // most beside a house (a barrel or stump at its corner), the rest out on the grass
    let x, y; if (X() < 0.55) { const H = homes[Math.floor(X() * homes.length)]; x = H.bx + (X() < 0.5 ? -3 : 3) + Math.floor(X() * 2) * (X() < 0.5 ? -1 : 1); y = H.by - 1 + Math.floor(X() * 2); }
    else { x = 3 + Math.floor(X() * (W - 6)); y = 4 + Math.floor(X() * (V.lakeY - 6)); }
    if (!ok(x, y)) continue; const [t, solid] = pickProp();
    if (solid) { let open = true; for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if (M.solid[(y + dy) * W + x + dx]) { open = false; break; } if (!open) continue; }   // (a solid one only on open grass: never plugging a way between two things)
    lay(x, y, t, solid); k++;
  }
}
// THE BANK, after the river in Zenonia's own village: below the grass shore (V.shoreY, where the farm ends) a two-row
// cliff drops to the lake: its grass lip (107/108), then its lower face (118/117), then the water from V.lakeY. A plank
// pier (the village's own bridge planks, 12:0, stacked 7 px apart) runs from the shore down the cliff and out over the
// lake to a wide platform at the end, with a lamp either side of its foot, and a picket fence runs along the cliff top
// away from the farm, the house, the pier and the angler. The watering can and the fishing work from the shore and the
// pier (home.js nearLake).
// (2026-11-20, the user: "remove this" of the pier: pierOn false, no planks, no platform, the cliff below stays solid; the two lamps
// stay on the shore. The watering can and fishing still work from the shore.)
const VILLAGE_BANK = { pierOn: false, pier: 46, deck: 3, fences: [[4, 12], [57, 66], [70, 80]] };   // deck: the platform's rows at the far end
function villageBank(M, V) {
  const W = V.W, s = V.shoreY, P = VILLAGE_BANK.pier, end = V.H - 1, deck0 = end - VILLAGE_BANK.deck + 1;
  for (let x = 0; x < W; x++) { setTile(M, x, s + 1, x % 2 ? 108 : 107, 1); setTile(M, x, s + 2, x % 2 ? 117 : 118, 1); }
  const walk = (x, y) => setSolid(M, x, y, 0), plank = (cx, y0, y1) => { for (let py = y0 * WG_T - 2; py < (y1 + 1) * WG_T - 4; py += 7) M.objA.push([12, 0, cx, py + 6]); };   // (a plank is drawn 14 px either side of cx)
  if (VILLAGE_BANK.pierOn) {
    for (let y = s + 1; y <= end; y++) for (const x of [P, P + 1]) walk(x, y);   // the walk: two columns from the cliff top to the end
    plank((P + 1) * WG_T, s + 1, deck0 - 1);
    for (let y = deck0; y <= end; y++) for (let x = P - 2; x <= P + 3; x++) walk(x, y);   // the platform: six columns wide
    for (let k = 0; k < 4; k++) plank((P - 2) * WG_T + 14 + Math.round(k * (6 * WG_T - 28) / 3), deck0, end);   // (four columns of 28 px planks, overlapping, cover the six tiles with no water showing between)
  }
  placeObj(M, 6, 2, (P - 1) * WG_T + 8, s * WG_T + 14); setSolid(M, P - 1, s, 1);
  placeObj(M, 6, 2, (P + 2) * WG_T + 8, s * WG_T + 14); setSolid(M, P + 2, s, 1);
  for (const [x0, x1] of VILLAGE_BANK.fences) for (let x = x0; x <= x1; x++) { M.overlay[s * W + x] = (x === x1 ? 187 : 177) + 1; setSolid(M, x, s, 1); }
}
// HEARTHVALE'S TERRACE (2026-11-18, the user: towns "closer to the original zenonia towns", Hearthvale hand-built in that style): the
// meadow south of the road, between the farm and the East End, rises as a raised garden like the original town's, built from the same
// tiles_1 pieces the Wilds' plateaus use (plateaus.js PLAT_SETS[1]: the grassy lip, cliff sides, a two-row rock face and grass stairs in
// the middle of the face). What stood there (the little hedge pen, a lamp) goes; pines stand along its back, bushes at its corners and
// flowers along its foot. Its rim and face are solid (Hearthvale isn't a generated map, so world.js openBareWalls leaves them).
const HV_TERRACE = { x: 45, y: 21, w: 14, h: 8 };
function villageTerrace(M, V) {
  const { x: x0, y: y0, w, h } = HV_TERRACE, F = 2, sx = x0 + Math.floor(w / 2) - 1, alt = (a, i) => a[i % a.length];
  const put = (x, y, g, o, solid) => { const i = y * M.w + x; M.ground[i] = ((g == null ? 0 : g) + 1) | (solid << 8); M.overlay[i] = o == null ? 0 : o + 1; M.solid[i] = solid; };
  // clear the ground: whatever stands in it or just round it (the pen's bushes, a lamp, a tree)
  const px0 = (x0 - 1) * WG_T, px1 = (x0 + w + 1) * WG_T, py0 = (y0 - 1) * WG_T, py1 = (y0 + h + 1) * WG_T;
  M.objB = M.objB.filter(o => { const f = objFrame(o[0], o[1]); if (!f) return true; const cx = o[2] + f[4] + f[2] / 2, by = o[3] + f[5] + f[3]; return !(cx >= px0 && cx < px1 && by >= py0 && by < py1 + 8); });
  for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) put(x, y, 0, null, 0);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const cx = x - x0, cy = y - y0, L = cx === 0, R = cx === w - 1, fr = cy - (h - F);
    if (cy === 0) put(x, y, 0, L ? 76 : R ? 79 : alt([77, 78], cx), 1);                                   // the lip along its top
    else if (fr === 0) put(x, y, L ? 86 : R ? 89 : alt([107, 108], cx), L ? 106 : R ? 109 : null, 1);    // the rock face, upper row
    else if (fr === 1) put(x, y, L ? 96 : R ? 99 : alt([117, 118], cx), L ? 116 : R ? 119 : null, 1);    // and lower row
    else if (L) put(x, y, alt([86, 96], cy), null, 1);                                                    // the west side
    else if (R) put(x, y, alt([89, 99], cy), null, 1);                                                    // the east side
    else put(x, y, 0, null, 0);                                                                           // the high ground
  }
  for (let k = 0; k < F; k++) for (let j = 0; j < 2; j++) put(sx + j, y0 + h - F + k, [[56, 57], [66, 67]][k][j], null, 0);   // the stairs
  // dressing in the maps' own objects: pines along the back, a bush up top near each front corner, bushes round its foot corners,
  // flowers along its foot (never in front of the stairs)
  const add = (b, fi, tx, ty, dx = 0) => M.objB.push([b, fi, Math.round(tx * WG_T + 8 + dx - (objFrame(b, fi)[4] + objFrame(b, fi)[2] / 2)), Math.round(ty * WG_T + 14 - (objFrame(b, fi)[5] + objFrame(b, fi)[3]))]);
  for (const tx of [x0 + 2, x0 + 4, x0 + w - 5, x0 + w - 3]) add(1, 2, tx, y0 + 1);
  add(11, 0, x0 + 2, y0 + h - F - 2); add(11, 1, x0 + w - 3, y0 + h - F - 2);
  add(11, 1, x0 - 1, y0 + h - 1, -6); add(11, 0, x0 + w, y0 + h - 1, 6);
  for (const [tx, fi] of [[x0 + 1, 0], [x0 + 3, 2], [x0 + w - 4, 1], [x0 + w - 2, 0]]) add(66, fi, tx, y0 + h, 0);
}
// HEDGES AND FENCES, as the original town lines its roads and yards: a hedge is a row of round bushes in the tiles' own overlay
// pieces (250 the round cap on the row above, 247 the top half, 246 the bottom half below it), solid; a fence is a run of 177 ending in 187.
// Hedge runs go along both sides of the road, only on free grass (no lane, plot, lamp, bench, door or anything standing), 2-5 bushes
// long with a gap between; short fence runs stand beside each East End house. All by tile, so they join as the originals' do.
function villageHedges(M, V, inSand) {
  const W = M.w, occ = new Set();
  for (const o of M.objB.concat(M.objA || [])) { const f = objFrame(o[0], o[1]); if (!f) continue;
    for (let y = Math.floor((o[3] + f[5]) / WG_T); y <= Math.floor((o[3] + f[5] + f[3] - 1) / WG_T); y++) for (let x = Math.floor((o[2] + f[4]) / WG_T); x <= Math.floor((o[2] + f[4] + f[2] - 1) / WG_T); x++) occ.add(x + ',' + y); }
  const pts = [V.board, V.pantry, V.campfire, V.well, V.spawn, V.west, [V.statue[0], V.statue[1]]], T0 = HV_TERRACE;
  const free = (x, y) => x >= 3 && y >= 3 && x < W - 3 && y < V.shoreY && !M.solid[y * W + x] && !(M.overlay[y * W + x] & 0xff) && !inSand(x + 0.5, y + 0.5) && !inSand(x + 0.5, y + 1.2) && !inSand(x + 0.5, y - 0.2) && !inSand(x - 0.3, y + 0.5) && !inSand(x + 1.3, y + 0.5)   /* (the sand and its rim are painted over the tiles: a bush beside a lane was sliced, 2026-11-20 "bush cut off") */
    && !occ.has(x + ',' + y) && !V.plots.some(([px, py]) => x >= px - 1 && x <= px + 2 && y >= py - 1 && y <= py + 2) && !pts.some(([a, b]) => Math.abs(a - x) <= 1 && Math.abs(b - y) <= 1)
    && !(x >= T0.x - 1 && x <= T0.x + T0.w && y >= T0.y - 1 && y <= T0.y + T0.h);
  const lay = (x, y, o, solid) => { const i = y * W + x; M.overlay[i] = o + 1; if (solid) { M.solid[i] = 1; M.ground[i] = (M.ground[i] & 0xff) | (1 << 8); } };
  // 247's bush is cut flat along its top edge: the round cap (250) always goes on the row above it, as in the gardens.
  // (2026-11-18, "clipped bushes": the rows had no cap, and every third top was a bare 250 cap with no bush under it)
  for (const yT of [14, 21]) {   // the rows just above and below the road (the bush's top row, then its bottom row)
    let run = 0;
    for (let x = 3; x < W - 3; x++) {
      const ok = free(x, yT) && free(x, yT + 1) && !M.solid[(yT - 1) * W + x] && !(M.overlay[(yT - 1) * W + x] & 0xff) && !(yT === 14 && M.solid[(yT + 2) * W + x]);
      if (ok && run < 5) { M.overlay[(yT - 1) * W + x] = 250 + 1; lay(x, yT, 247, true); lay(x, yT + 1, 246, true); run++; }
      else { if (run === 1) { const px = x - 1; M.overlay[(yT - 1) * W + px] = 0; M.overlay[yT * W + px] = 0; M.overlay[(yT + 1) * W + px] = 0; for (const yy of [yT, yT + 1]) { M.solid[yy * W + px] = 0; M.ground[yy * W + px] &= 0xff; } }   // (a lone bush looks lost)
        run = ok ? -1 : 0; }   // (after five, a gap of one)
    }
  }
  for (const [, , bx, by] of V.houses.filter(h => h[3] < 20)) for (const [x0, x1] of [[bx - 5, bx - 3], [bx + 3, bx + 5]]) {   // the East End's yards
    if (![...Array(x1 - x0 + 1).keys()].every(k => free(x0 + k, by))) continue;
    for (let x = x0; x <= x1; x++) lay(x, by, x === x1 ? 187 : 177, true);
  }
}
function buildVillageMap() {
  const V = VILLAGE, M = blankMap(V.W, V.H, 1, 0), R = seededRng(7);
  M.name = 'Hearthvale';
  // ground: light grass (soft patches of darker grass are laid over it once the streets are in, see grassPatches)
  for (let y = 0; y < V.H; y++) for (let x = 0; x < V.W; x++) setTile(M, x, y, 0);
  // the sandy ground (west road, the round plaza, lanes to every door), as in Zenonia's own towns: soft-edged shapes
  // that world.js paints over the grass with the tileset's sand (M.sandShapes, in tiles), not square tiles.
  // ['rect', x0, y0, x1, y1, corner radius] · ['ellipse', cx, cy, rx, ry]
  const SH = M.sandShapes = [['rect', 0, 16.4, V.W - 3.4, 19.6, 1.4], ['ellipse', V.fountain.bx + 0.5, 18.5, 9.5, 5.4], ['ellipse', ...V.square]];
  for (const S of V.shops) SH.push(S.by < 20 ? ['rect', S.bx - 1.1, S.by - 0.6, S.bx + 2.1, 17, 0.9] : ['rect', S.bx - 1.1, 18.5, S.bx + 2.1, S.by + 0.6, 0.9]);
  SH.push(['rect', V.home.bx - 1.1, 18.5, V.home.bx + 2.1, V.home.by + 0.6, 0.9]);
  SH.push(['rect', V.dojo.bx - 1.1, V.dojo.by - 0.6, V.dojo.bx + 2.1, 17, 0.9]);
  for (const [, , bx, by] of V.houses) SH.push(by < 20 ? ['rect', bx - 1.1, by - 0.6, bx + 2.1, 17, 0.9] : ['rect', bx - 1.1, 18.5, bx + 2.1, by + 0.6, 0.9]);
  // (cobbled yards for the East End were tried, 2026-11-18: tiles_1's cobble set has a darker grass rim made for the original's darker
  // ground, and on Hearthvale's light grass it showed as dark boxes. Sand lanes kept.)
  const inSand = (x, y) => SH.some(s => s[0] === 'rect' ? x >= s[1] && x <= s[3] && y >= s[2] && y <= s[4] : ((x - s[1]) / s[3]) ** 2 + ((y - s[2]) / s[4]) ** 2 <= 1);
  // farm: the plots are plain grass on the map; home.js draws their soil (rough, tilled or wet) over it
  for (const [px, py] of V.plots) for (let y = 0; y < 2; y++) { setTile(M, px, py + y, 0); setTile(M, px + 1, py + y, 0); }
  setSolid(M, V.board[0], V.board[1], 1); setSolid(M, V.pantry[0], V.pantry[1], 1); setSolid(M, V.campfire[0], V.campfire[1], 1);
  // forest ring: a solid 3-tile band, open only where the west road leaves town; the south side is a lake instead
  // (a walkable grassy shore row, then water)
  for (let y = 0; y < V.H; y++) for (let x = 0; x < V.W; x++) {
    const edge = x < 3 || y < 3 || x >= V.W - 3 || y >= V.lakeY;
    if (y >= V.lakeY) setTile(M, x, y, 120);   // tileset 1's open water (drawn as Zenonia 2 water); before setSolid, which it would reset
    if (edge && !(x < 3 && y >= 14 && y <= 21)) setSolid(M, x, y, 1);   // the west opening matches the gap in the trees (rows 14–21)
  }
  const tree = (tx, ty, k) => placeObj(M, 1, k, tx * WG_T + 8, ty * WG_T + 14);
  for (let x = 0; x < V.W; x += 2) { tree(x, 1, 2); tree(x + 1, 2, 1); }
  for (let y = 4; y < V.lakeY - 1; y += 2) {
    if (!(y >= 14 && y <= 20)) { tree(1, y, 2); tree(0, y + 1, 1); }
    tree(V.W - 2, y, 2); tree(V.W - 1, y + 1, 1);
  }
  // no invisible walls: a tile of the forest band (above the lake) blocks only where a tree's trunk stands — the
  // lower part of its picture; you walk under the treetops (beside the west bridge, for one)
  const treeAt = (tx, ty) => M.objB.some(([b, fi, x, y]) => { const f = objFrame(b, fi); if (!f || +b !== 1) return false;
    const cx = tx * WG_T + 8, cy = ty * WG_T + 8; return cx >= x + f[4] - 2 && cx <= x + f[4] + f[2] + 2 && cy >= y + f[5] + f[3] - 18 && cy <= y + f[5] + f[3] + 2; });
  for (let y = 0; y < V.lakeY; y++) for (let x = 0; x < V.W; x++)
    if ((x < 3 || y < 3 || x >= V.W - 3) && M.solid[y * V.W + x] && !treeAt(x, y)) setSolid(M, x, y, 0);
  villageBank(M, V);
  // buildings: the sprite stands on its bottom line; its lower body blocks walking, the door is the middle of the front
  const building = (b, fi, bx, by) => {
    const o = placeObj(M, b, fi, bx * WG_T + 8, by * WG_T);
    const f = objFrame(b, fi), wT = Math.round(f[2] / WG_T), hT = Math.min(4, Math.round(f[3] * 0.55 / WG_T));
    for (let y = by - hT; y < by; y++) for (let x = bx - Math.floor(wT / 2); x <= bx + Math.floor((wT - 1) / 2); x++) setSolid(M, x, y, 1);
    return o;
  };
  for (const S of V.shops) building(S.bank, S.fi, S.bx, S.by);
  building(V.home.bank, V.home.fi, V.home.bx, V.home.by);
  building(V.dojo.bank, V.dojo.fi, V.dojo.bx, V.dojo.by);
  for (const [b, fi, bx, by] of V.houses) building(b, fi, bx, by);
  building(58, 0, V.mill[0], V.mill[1]);
  building(13, 5, V.butcher[0], V.butcher[1]); placeObj(M, 60, 5, (V.butcher[0] - 1) * WG_T + 4, V.butcher[1] * WG_T + 1);   // the butcher's (2026-11-18: it was a painted stall, the user found it out of place)
  placeObj(M, 39, 0, V.statue[0] * WG_T + 8, V.statue[1] * WG_T); for (let x = V.statue[0] - 1; x <= V.statue[0] + 1; x++) setSolid(M, x, V.statue[1] - 1, 1);
  // the Fusion Fountain in the plaza
  placeObj(M, 11, 2, V.fountain.bx * WG_T + 8, V.fountain.by * WG_T - 6);
  for (let y = V.fountain.by - 4; y < V.fountain.by; y++) for (let x = V.fountain.bx - 3; x <= V.fountain.bx + 3; x++) setSolid(M, x, y, 1);
  // dressing, after Zenonia's own town square: a ring of round hedges and flower shrubs around the plaza (open where
  // the road and the lanes come in), lamp posts in pairs along the road, benches on the plaza, clumps of pines on the
  // grass, flowers, a well by the home, a picket fence at the farm's corners
  const busy = new Set();   // tiles already used by a piece of dressing
  const put = (b, fi, tx, ty, solid, dy = 14) => {
    const k = tx + ',' + ty; if (busy.has(k) || M.solid[ty * V.W + tx] || inSand(tx + 0.5, ty + 0.5)) return false;
    if (V.plots.some(([px, py]) => tx >= px - 1 && tx <= px + 2 && ty >= py - 1 && ty <= py + 2)) return false;
    if ([V.board, V.pantry, V.campfire, V.well, V.spawn, V.west].some(([x, y]) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1)) return false;
    busy.add(k); placeObj(M, b, fi, tx * WG_T + 8, ty * WG_T + dy); if (solid) setSolid(M, tx, ty, 1); return true;
  };
  const fx0 = V.fountain.bx + 0.5, n = 36;
  for (let i = 0; i < n; i++) {   // the hedge ring
    const a = i / n * Math.PI * 2, tx = Math.floor(fx0 + Math.cos(a) * 10.6), ty = Math.floor(18.5 + Math.sin(a) * 6.4);
    if (ty >= 15 && ty <= 20) continue;   // the road passes through east and west
    put(11, i % 4 === 2 ? 1 : 0, tx, ty, true);
  }
  for (const lx of [5, 36, 59, 77]) { put(6, 0, lx, 15, true, 2); put(6, 0, lx, 21, true, 2); }   // lamps where the ways meet, a pair either side of the road (2026-11-18: no longer a pair every few tiles and by every shop door: the original lights its crossings, hedges line the rest)
  for (const [bx, by] of [[20, 14], [29, 14], [20, 22], [29, 22], [60, 22], [69, 22]]) placeObj(M, 6, 1, bx * WG_T + 8, by * WG_T + 12);   // benches
  for (const [tx, ty] of [[22, 5], [24, 4], [26, 6], [23, 8], [27, 9], [25, 10], [5, 23], [4, 25], [6, 27],
    [44, 22], [43, 24], [44, 26], [44, 7], [35, 4], [13, 4], [4, 7], [34, 23], [49, 4], [59, 4], [65, 5], [71, 4], [77, 5], [80, 14], [70, 23], [72, 25], [62, 24], [80, 22]]) put(1, 2, tx, ty, true);   // pine clumps (whole trees)
  placeObj(M, 42, 0, V.well[0] * WG_T + 8, V.well[1] * WG_T + 14); setSolid(M, V.well[0], V.well[1], 1); busy.add(V.well.join(','));   // the well below the Farm Board (placed directly: dressing keeps clear of it)
  for (const [tx, ty] of [[10, 21], [15, 22], [33, 21], [41, 20], [11, 13], [37, 12], [20, 11], [29, 11], [8, 27], [41, 25], [52, 13], [58, 12], [65, 13], [71, 12], [64, 24], [76, 22]]) put(66, (tx + ty) % 3, tx, ty, false, 12);   // flowers
  for (const [tx, ty] of [[17, 24], [31, 24], [3, 12], [45, 15]]) put(43, 0, tx, ty, false, 12);
  villageDressing(M, V, busy, inSand);
  villageTerrace(M, V);
  villageHedges(M, V, inSand);
  M.spawn = [V.spawn[0] * WG_T + 8, V.spawn[1] * WG_T + 8];
  M.entry = [V.west[0] * WG_T + 8, V.west[1] * WG_T + 8];
  floodReach(M, V.spawn[0], V.spawn[1]);
  M.filler = 198;   // dense forest canopy outside town (stored as tile + 1)
  WG_MAPS.vtown = M;
  return M;
}

// ================================================================ the outpost towns
// A small village at the far (western) end of every zone, on the road between it and the next: a house you can buy
// (with a waystone in front of it), a farm beside it with a well, lamps along the road. Safe like Hearthvale: no
// monsters, no fighting. Town i stands after zone i (the last one past the Sun Temple, at the end of the world).
const OUTPOST_TOWNS = [
  { name: 'Mossbrook', price: 50000, sub: 'a mossy village at the edge of the Verdant Fields' },
  { name: 'Duskhollow', price: 100000, sub: 'lanterns in the twilight woods' },
  { name: 'Cloudhold', price: 150000, sub: 'a stone-walled stop beyond the Skyreach Isles' },
  { name: 'Frostmere', price: 200000, sub: 'the last hearth at the end of the world', where: 'The last town, past the Sunscorch Desert and the Sun Temple' },
  { name: 'Mirage Springs', price: 250000, sub: 'palm shade and cool water in the middle of the sands', where: 'The oasis town halfway across the Sunscorch Desert' },   // (the Sunscorch Desert's oasis town, halfway along it: desert.js)
];
const OUTPOST = {
  W: 70, H: 30, road: [15, 20],                   // the road's rows (open through the forest at both ends)
  spawn: [20, 17],
};
// the merchants (Hearthvale keeps its own shops): each trades from their doorstep
const OUTPOST_SHOP = {
  weapon: { bank: 13, fi: 10, npc: '104', label: 'Weaponsmith', role: 'shop_weapon', sym: '⚔' },
  armor:  { bank: 13, fi: 11, npc: '108', label: 'Armorer',     role: 'shop_armor',  sym: '◈' },
  item:   { bank: 13, fi: 14, npc: '116', label: 'Item Shop',   role: 'shop_item',   sym: '⚗' },
  inn:    { bank: 13, fi: 0,  npc: '107', label: 'Innkeeper',   role: 'inn',         sym: 'INN' },
};
const farmRow = (x0, y0) => [0, 1, 2, 3, 4].flatMap(k => [[x0 + k * 3, y0]]).concat([0, 1, 2, 3, 4].map(k => [x0 + k * 3, y0 + 3]));
// EACH TOWN ITS OWN PLACE: where the house for sale, its farm and well, the waystone, the square and the four shops
// stand (every building north of the road, its door onto it; the road itself is shared, so the crossings still meet
// it). Plot numbers stay 0–9, so crops planted earlier keep their numbers.
//   Mossbrook  — the farming village: shops at the west gate, the house and a big farm to the east
//   Duskhollow — inn and smithy by the west gate, the house in the middle, its farm across the road
//   Cloudhold — a market quarter in the west, a walled field mid-town, the house and inn to the east
//   Frostmere  — the house near the west gate with its field across the road, shops strung out east
const OUTPOST_LAYOUTS = [
  { home: 54, stone: [57.6, 17.4], plots: farmRow(37, 6), well: [35, 8], square: [24, 17.5, 6.5, 4], shops: { item: 10, inn: 18, weapon: 26, armor: 32 }, dojo: 61, flowers: 26, pines: 10, houses: [[5, 38], [8, 44], [7, 66]] },
  { home: 27, stone: [30.6, 17.4], plots: farmRow(30, 22), well: [46, 23], square: [38, 17.5, 5, 3.6], shops: { inn: 9, weapon: 17, armor: 45, item: 52 }, dojo: 36, flowers: 10, pines: 18, lamps: 5, houses: [[8, 22], [5, 58], [7, 64]] },
  { home: 46, stone: [49.6, 17.4], plots: farmRow(27, 6), well: [24, 7], square: [34, 17.5, 6.5, 4], shops: { weapon: 8, armor: 15, item: 21, inn: 59 }, dojo: 53, flowers: 8, pines: 12, houses: [[5, 30], [8, 36], [7, 65]] },
  { home: 17, stone: [20.6, 17.4], plots: farmRow(8, 22), well: [24, 23], square: [31, 17.5, 6, 4], shops: { armor: 9, weapon: 40, inn: 48, item: 56 }, dojo: 34, flowers: 12, pines: 22, houses: [[8, 23], [5, 28], [7, 63]] },
  //   Mirage Springs — the oasis in the middle: shops round the square by the west gate, the house to the east, its field north of the road
  { home: 54, stone: [57.6, 17.4], plots: farmRow(37, 6), well: [35, 8], square: [24, 17.5, 6.5, 4], shops: { item: 10, inn: 18, weapon: 26, armor: 32 }, dojo: 61, flowers: 0, pines: 12, houses: [[5, 38], [8, 44], [7, 66]] },
];
// EACH TOWN ITS OWN LAND: the ground and trees of the zone it stands in, and what it is known for (tree: bank, then
// the frames for the outer and inner rows of the forest ring)
//   Mossbrook  — windmills turning over the fields, washing on the line
//   Duskhollow — built under the giant hollow trees, spirit lamps glowing among them
//   Cloudhold — in the clouds (skyify): pale paving, cloud trees round it and at both gates, flowers down the road
//   Frostmere  — snow and igloos, ice crystals, a frozen well
const TOWN_LOOK = [
  { ts: 1, base: 0, tree: [1, 1, 2], flowers: true, filler: 198 }, { ts: 1, base: 0, tree: [1, 1, 2], flowers: true, filler: 198 },
  { ts: 8, base: 104, tree: [201, 0, 1], flowers: false, filler: 105, sand: 29, sandRim: ['rgba(255,110,30,0.22)', '#7a5040'], pathTint: 'rgba(255,120,40,0.16)' },
  { ts: 6, base: 11, tree: [40, 1, 1], flowers: false, filler: 12, sand: 11, sandRim: ['rgba(140,160,210,0.25)', '#ffffff'], pathTint: 'rgba(80,100,160,0.2)' },
  { ts: 3, base: 11, tree: [28, 1, 1], flowers: false, filler: 11, sand: 84, sandRim: ['rgba(160,110,40,0.3)', '#f0d898'], pathTint: null, pondTiles: true },   // (the desert: palms for its ring, packed-sand roads, its pond laid from the desert's own pond tiles)
];
const TOWN_PIECES = [
  [[58, 0, 8, 26, 1], [296, 0, 61, 26, 1], [58, 0, 34, 26, 1], [59, 0, 19, 23, 1], [59, 0, 47, 23, 1], [55, 11, 26, 24, 1], [60, 0, 13, 23, 0], [60, 0, 54, 23, 0]],
  [[46, 2, 12, 25, 1], [46, 3, 58, 25, 1], [201, 1, 22, 24, 1], [201, 0, 25, 26, 1], [201, 1, 50, 24, 1], [201, 0, 53, 25, 1], [55, 11, 7, 23, 1], [248, 0, 63, 23, 1]],
  [[201, 0, 7, 26, 1], [201, 0, 62, 26, 1], [202, 0, 16, 23, 0], [202, 1, 22, 23, 0], [202, 0, 28, 23, 0], [202, 1, 41, 23, 0], [202, 0, 47, 23, 0], [202, 1, 53, 23, 0], [201, 1, 34, 26, 1], [202, 1, 12, 23, 0], [202, 0, 57, 23, 0]],   // (Cloudhold is in the clouds now: cloud trees at its gates and flowers along the road; the foundry engines, statues and lava rocks went with the ash)
  [[41, 3, 34, 25, 2], [41, 1, 44, 25, 1], [41, 0, 51, 24, 1], [41, 2, 60, 25, 1], [264, 0, 27, 25, 0], [264, 7, 40, 26, 0], [264, 0, 64, 23, 0], [254, 0, 56, 26, 0], [50, 5, 30, 23, 0]],
  [[28, 1, 33, 22, 0], [28, 1, 48, 22, 0], [28, 1, 34, 27, 0], [28, 1, 47, 27, 0], [245, 2, 12, 25, 1], [245, 3, 62, 25, 1], [255, 2, 22, 23, 0], [255, 2, 58, 23, 0], [248, 0, 6, 23, 0], [28, 0, 52, 25, 0], [28, 0, 29, 25, 0]],   // (Mirage Springs: palms round its pond, buttes at both ends, golden pillars)
];
const TOWN_POND = [[40.5, 24.2, 3.6, 2.2], null, null, [28, 6.8, 4, 2], [40.5, 24.4, 5.2, 2.6]];
// ORIGINAL TOWNS (the user's pick, 2026-11-15: "make towns closer to the original zenonia towns"): a town listed here is
// Zenonia 1's own hand-made town map instead of a generated strip: its crossroads and fountain square, hedged gardens,
// terraces, river and bridges. The map is cropped to fit the world's height (WG top/rows), its east-west road through the
// square is the town's road (both crossings land on it), and its own buildings take the town's parts: the shops are the
// original's shop buildings (the same pictures our shops use), the house for sale and the Dojo are picked by picture and
// place, every other house is a townsfolk home. The farm is cleared in its old hedged garden (ten plots, as every town
// has: the farm list is shared by all towns, so the count must not change).
//   bld: [bank, fi, roughly the picture's left edge in tiles]   farm.clear: [x0, y0, x1, y1] in the cropped map, laid as plain
//   grass; farm.trees: a wider box whose standing things go too (the tree line below the garden hid the farm's lower row)
const ORIG_TOWNS = {
  // (rows 57: to the original's own bottom, 2026-11-20 "bad tile placement": at 53 the south bank was sliced into a strip, the stairs
  // down the cliff led into the water and the east meadow ended in a straight line; now the stairs reach the south bank and the
  // meadow ends on its own cliff)
  0: { src: 'town', top: 3, rows: 57, edge: 3, dropTiles: [236, 240], road: [23, 28], spawn: [18, 27], elderRow: 29, angler: [8, 37],   // (the forest above is cropped only 3 rows: 6 cut through the old north gate)
    home: [13, 2, 5.6], dojo: [7, 0, 36.4], shops: { weapon: [13, 10, 9.4], armor: [13, 11, 33.4], item: [13, 14, 13.4], inn: [13, 0, 37.5] },
    farm: { clear: [4, 5, 20, 11], at: [5, 5], trees: [4, 5, 20, 14] }, well: [20, 7], stone: [16, 24], square: [22.5, 25.5, 5, 3], drop: ['7:1'],
    // sink: boxes [x0, y0, x1, y1] (cropped map tiles) turned to lake, with everything standing in them (2026-11-20, the user circled
    // them: "remove those areas"): the west islet with the tent camp and its plank bridge, and the south bank reached down the stairs.
    // waterAt: a lake cell to copy the water from. stairsShut: the cliff cells the stairs ran down, made solid again.
    sink: [[0, 41, 12, 53], [11, 44, 14, 46], [13, 51, 32, 56]], waterAt: [6, 53], stairsShut: [[22, 47, 23, 51]],
    // fill: [x0, y0, x1, y1, from] cells given back as land, each row copied from column `from` + (x - x0) of the same row (2026-11-20,
    // the user circled the square notch the plank-bridge box left in the shore: "fill this in"): grass beside the bank, and the cliff
    // face below it carried one tile further west, its end cap with it
    fill: [[13, 44, 14, 46, 15], [13, 47, 14, 50, 14]],
    // tiles: single cells set to one of the map's own cliff pieces, [x, y, stored tile] (picture + 1, as the map keeps them; solid). The user: "add side to the edge like the
    // rest of the edge" and "add edge here to" (2026-11-20): the straight grass-to-water side left by the filled notch gets the
    // cliff's side pieces (94 / 104: water on the left), with the cliff face carried along its top to turn the corner; and where
    // the south sink box broke the diagonal cliff east of the old stairs, the missing step is put back (corner, face, bottom)
    tiles: [[10, 40, 109], [11, 40, 108], [12, 40, 109], [13, 40, 92], [13, 41, 95], [13, 42, 105], [13, 43, 95], [13, 44, 105], [13, 45, 95], [13, 46, 105],
      [30, 51, 121], [31, 51, 111], [32, 51, 108], [31, 52, 121], [32, 52, 123]] },
  // Duskhollow: Zenonia 1's village (map 011), whole: its west way in at the top, its east way out across the middle; the farm
  // in the open meadow at its heart. Its six buildings are exactly the town's six: the house for sale is the village's own
  // (the same picture), the hall is the Dojo, the other four the shops.
  1: { src: 'z0c', top: 0, rows: 34, road: [3, 14], spawn: [21, 14], elderRow: 21, angler: [22, 26],
    home: [13, 12, 4.6], dojo: [7, 0, 19.5], shops: { weapon: [13, 13, 24.5], armor: [13, 5, 3.4], item: [13, 8, 3.4], inn: [13, 5, 6.4] },
    farm: { clear: [3, 12, 19, 17], at: [4, 12], trees: [3, 13, 19, 18], keepGround: true }, well: [19, 18], ownWell: true, stone: [22, 10], square: [17, 21, 4, 3], drop: ['7:1'],
    // dropAt: single objects left out, [bank, x, y] in the source map's pixels (the two crates against the inn's fence, 2026-11-20)
    dropAt: [[17, 168, 443], [17, 184, 443],
      [17, 312, 363], [26, 327, 367], [17, 344, 363]],   // (and the crate, block, crate row below the well, by the notice board, 2026-11-20: "remove that")
    // the bridges land on the village's own ways out: west at the top (rows 3-6), east across the middle (rows 13-17); both used to aim at row 9 and the east one cut through the cliff (2026-11-20)
    crossW: [3, 6], crossE: [13, 17],
    // the Dojo in the other towns' dojo hall (13:1), not the village's small red hall (2026-11-20, the user: "doesnt look like a dojo from other towns")
    dojoAs: [13, 1] },
};
const ORIG_LAYOUT = {};
function origLayout(i) {
  if (ORIG_LAYOUT[i]) return ORIG_LAYOUT[i];
  const O = ORIG_TOWNS[i], S = WG_MAPS[O.src]; if (!S) return null;
  const door = o => { const f = objFrame(o[0], o[1]); return { bank: +o[0], fi: o[1], bx: (o[2] + f[4] + f[2] / 2 - 8) / WG_T, by: (o[3] + f[5] + f[3]) / WG_T - O.top }; };
  const pickB = ([b, fi, x]) => S.objB.find(o => +o[0] === b && o[1] === fi && Math.abs(o[2] / WG_T - x) < 1.5);
  const used = new Set(), take = d => { const o = pickB(d); if (o) used.add(o); return o ? door(o) : null; };
  const home = take(O.home), dojo = take(O.dojo), shops = Object.entries(O.shops).map(([k, d]) => ({ ...OUTPOST_SHOP[k], ...take(d), bank: OUTPOST_SHOP[k].bank, fi: OUTPOST_SHOP[k].fi }));
  const houses = S.objB.filter(o => +o[0] === 13 && !used.has(o) && o[3] / WG_T >= O.top).map(door);
  return (ORIG_LAYOUT[i] = { W: S.w, H: O.rows, road: O.road, spawn: O.spawn, home, dojo, shops, houses, plots: farmRow(O.farm.at[0], O.farm.at[1]), well: O.well, stone: O.stone,
    square: O.square, flowers: 0, pines: 0, lamps: 7, elderRow: O.elderRow, angler: O.angler, orig: true });
}
function buildOrigTown(i) {
  const O = ORIG_TOWNS[i], V = origLayout(i), S = WG_MAPS[O.src], TL = TOWN_LOOK[i], M = blankMap(S.w, O.rows, S.tileset, 0);
  M.name = OUTPOST_TOWNS[i].name; M.town = true; M.road = O.road; M.noTrim = true; if (O.crossW) M.roadW = O.crossW; if (O.crossE) M.roadE = O.crossE;
  const drop = new Set(O.drop || []), [fx0, fy0, fx1, fy1] = O.farm.trees || O.farm.clear, [cx0, cy0, cx1, cy1] = O.farm.clear;
  const inFarm = (b, fi, ox, oy) => { const f = objFrame(b, fi); if (!f) return false; const cx = (ox + f[4] + f[2] / 2) / WG_T, by = (oy + f[5] + f[3]) / WG_T - O.top; return cx >= fx0 && cx <= fx1 + 1 && by >= fy0 && by <= fy1 + 1; };
  stampMap(M, O.src, 0, O.top, S.w, O.rows, 0, 0, (b, fi) => !drop.has(+b + ':' + fi));
  // (stampMap keeps what stands inside by its picture's top corner; a tree whose top pokes above the crop still stands in the town)
  for (const o of S.objB) { const f = objFrame(o[0], o[1]); if (!f || o[3] >= O.top * WG_T || o[3] + f[5] + f[3] <= O.top * WG_T + 4 || drop.has(+o[0] + ':' + o[1])) continue; M.objB.push([o[0], o[1], o[2], o[3] - O.top * WG_T]); }
  if (O.dropAt) M.objB = M.objB.filter(([b, fi, x, y]) => !O.dropAt.some(([db, dx, dy]) => +b === db && x === dx && y + O.top * WG_T === dy));
  if (O.sink) {   // areas turned to lake: the water copied from O.waterAt, solid, and whatever stood there gone (the stairs down to them too)
    const wk = O.waterAt[1] * M.w + O.waterAt[0], wg = M.ground[wk] & 0xff, inBox = (B, tx, ty) => tx >= B[0] && tx <= B[2] && ty >= B[1] && ty <= B[3];
    for (const B of O.sink) for (let y = B[1]; y <= B[3]; y++) for (let x = B[0]; x <= B[2]; x++) { const k = y * M.w + x; if (x < M.w && y < M.h) { M.ground[k] = wg | (1 << 8); M.overlay[k] = 0; M.solid[k] = 1; } }
    const boxes = O.sink.concat(O.stairsShut || []);
    const standsIn = ([b, fi, x, y]) => { const f = objFrame(b, fi); if (!f) return false; const tx = (x + f[4] + f[2] / 2) / WG_T, ty = (y + f[5] + f[3] - 2) / WG_T; return boxes.some(B => inBox(B, Math.floor(tx), Math.floor(ty))); };
    M.objA = M.objA.filter(o => !standsIn(o)); M.objB = M.objB.filter(o => !standsIn(o));
    for (const B of O.stairsShut || []) for (let y = B[1]; y <= B[3]; y++) for (let x = B[0]; x <= B[2]; x++) M.solid[y * M.w + x] = 1;
  }
  if (O.fill) {   // land given back (copied from the stamped original before the lake was cut, so the copy is the real shore)
    const S0 = blankMap(S.w, O.rows, S.tileset, 0); stampMap(S0, O.src, 0, O.top, S.w, O.rows, 0, 0, () => false);
    for (const [x0, y0, x1, y1, from] of O.fill) for (let y = y0; y <= y1; y++) for (let x = x1; x >= x0; x--) {
      const k = y * M.w + x, j = y * M.w + from + (x - x0); M.ground[k] = S0.ground[j]; M.overlay[k] = S0.overlay[j]; M.solid[k] = S0.solid[j];
    }
  }
  if (O.tiles) for (const [x, y, t] of O.tiles) { const k = y * M.w + x; M.ground[k] = (M.ground[k] & ~0xff) | t; M.overlay[k] = 0; M.solid[k] = 1; }
  M.objB = M.objB.filter(([b, fi, x, y]) => !inFarm(b, fi, x, y + O.top * WG_T)); M.objA = M.objA.filter(([b, fi, x, y]) => !inFarm(b, fi, x, y + O.top * WG_T));
  // the top edge: the original's top rows were never meant to be seen (half empty), so a band of the town's own pines closes it, as the
  // generated towns' forest does (O.edge rows, solid under them)
  if (O.dropTiles) for (let k = 0; k < M.w * M.h; k++) if (O.dropTiles.includes((M.overlay[k] & 0xff) - 1)) M.overlay[k] = 0;   // (stone wall caps left on the cliff top by the crop: the wall they topped is cut away)
  const voids = new Set(); for (let k = 0; k < M.w * M.h; k++) if (!(M.ground[k] & 0xff)) voids.add(k);
  { // each empty cell takes the ground of the nearest real cell (spreading out ring by ring), so it blends with what is round it
    let front = [...voids]; const done = new Set(); for (let k = 0; k < M.w * M.h; k++) if (!voids.has(k)) done.add(k);
    while (front.length) { const next = [];
      for (const k of front) { const x = k % M.w, y = (k - x) / M.w; let src = -1;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const nx = x + dx, ny = y + dy, j = ny * M.w + nx; if (nx >= 0 && ny >= 0 && nx < M.w && ny < M.h && done.has(j) && !(dy === -1 && false)) { src = j; break; } }
        if (src < 0) { next.push(k); continue; } }
      const fixed = []; for (const k of front) { if (next.includes(k)) continue; const x = k % M.w, y = (k - x) / M.w;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const j = (y + dy) * M.w + x + dx; if (x + dx >= 0 && y + dy >= 0 && x + dx < M.w && y + dy < M.h && done.has(j)) { M.ground[k] = (M.ground[j] & 0xff) | (1 << 8); M.solid[k] = 1; M.overlay[k] = 0; fixed.push(k); break; } } }
      for (const k of fixed) done.add(k); if (!fixed.length) break; front = next; } }   // (only the empty cells: the original's own forest stays)
  {
    const covered = (px, py) => M.objB.some(([b, fi, x, y]) => { const f = objFrame(b, fi); return f && px >= x + f[4] && px <= x + f[4] + f[2] && py >= y + f[5] && py <= y + f[5] + f[3]; });
    for (let y = 1; y < M.h; y++) for (let x = (y % 2); x < M.w; x += 2) { const k = (y % 2) ? 1 : 2, px = x * WG_T + 8, py = y * WG_T + 14; if (voids.has(y * M.w + x) && !covered(px, py - 10)) placeObj(M, TL.tree[0], TL.tree[k], px, py); } }   // (only where the original top is empty, and nothing already stands)
  // trees standing in front of a building (their picture over its front) go, and the ground under their trunk opens: the original
  // map has pines right before some doors, which read as trees in the way
  // dojoAs: the original's hall (and its stone step, 7:1) swapped for the towns' dojo picture at the same door; the pines its wider
  // picture now covers go, and its lower rows are solid as the generated towns' buildings are (worldgen.js building)
  if (O.dojoAs && V.dojo) {
    const D = V.dojo, dx = D.bx * WG_T + 8, dy = D.by * WG_T, [nb, nf] = O.dojoAs, nfr = objFrame(nb, nf);
    M.objB = M.objB.filter(([b, fi, x, y]) => { const f = objFrame(b, fi); if (!f) return true; const cx = x + f[4] + f[2] / 2, by = y + f[5] + f[3];
      if (+b === D.bank && fi === D.fi && Math.abs(cx - dx) < 4 && Math.abs(by - dy) < 4) return false;
      if (+b === 7 && fi === 1 && Math.abs(cx - dx) < 40 && Math.abs(by - dy) < 40) return false;
      if (+b === 1 && cx > dx + nfr[4] - 4 && cx < dx + nfr[4] + nfr[2] + 4 && by > dy + nfr[5] && by < dy + 12) return false;
      return true; });
    placeObj(M, nb, nf, dx, dy); D.bank = nb; D.fi = nf;
    const wT = Math.round(nfr[2] / WG_T), hT = Math.min(4, Math.round(nfr[3] * 0.55 / WG_T)), bx = Math.round(D.bx), by = Math.round(D.by);
    for (let y = by - hT; y < by; y++) for (let x = bx - Math.floor(wT / 2); x <= bx + Math.floor((wT - 1) / 2); x++) setSolid(M, x, y, 1);
  }
  const blds = M.objB.filter(([b, fi]) => +b === 13 || (+b === 7 && fi === 0)).map(([b, fi, x, y]) => { const f = objFrame(b, fi); return [x + f[4], y + f[5], x + f[4] + f[2], y + f[5] + f[3]]; });
  M.objB = M.objB.filter(([b, fi, x, y]) => { if (+b !== 1) return true; const f = objFrame(b, fi); if (!f) return true;
    const tx0 = x + f[4], ty0 = y + f[5], tx1 = tx0 + f[2], ty1 = ty0 + f[3];
    const hit = blds.some(([a0, b0, a1, b1]) => tx0 < a1 - 6 && tx1 > a0 + 6 && ty0 < b1 && ty1 > b1 - 4 && ty1 < b1 + 40);
    if (hit) { const cx = Math.floor((tx0 + f[2] / 2) / WG_T), cy = Math.floor((ty1 - 4) / WG_T); setSolid(M, cx, cy, 0); }
    return !hit; });
  // thin the pines: one whose picture mostly lies under another's (over half of it) goes; the forests stay thick but no tree is
  // drawn on top of another (the user found the stacked trees messy). Their trunk tiles stay solid: they stand in the woods.
  const pines = M.objB.filter(([b]) => +b === 1).map(o => { const f = objFrame(o[0], o[1]); return f && { o, x0: o[2] + f[4], y0: o[3] + f[5], x1: o[2] + f[4] + f[2], y1: o[3] + f[5] + f[3], a: f[2] * f[3] }; }).filter(Boolean).sort((p1, p2) => p2.y1 - p1.y1);
  const keep = [], gone = new Set();
  for (const P of pines) { if (keep.some(K => Math.max(0, Math.min(P.x1, K.x1) - Math.max(P.x0, K.x0)) * Math.max(0, Math.min(P.y1, K.y1) - Math.max(P.y0, K.y0)) > P.a * 0.5)) gone.add(P.o); else keep.push(P); }
  M.objB = M.objB.filter(o => !gone.has(o));
  // the field, in the map's own grass: the garden's own open ground tiles, mixed as they were (home.js draws the soil on it); the
  // hedge's rounded top on the row above goes too
  const hist = {}; for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) { const k = y * M.w + x; if (!M.solid[k] && !(M.overlay[k] & 0xff)) hist[M.ground[k] & 0xff] = (hist[M.ground[k] & 0xff] || 0) + 1; }   // (sampled in the garden itself: the roads are open ground too)
  const grassT = +Object.entries(hist).sort((a, b) => b[1] - a[1])[0][0] - 1;   // (one tile: a random mix of its shades showed as a checker)
  { const todo = new Set(); for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) { const k = y * M.w + x; M.overlay[k] = 0; if (!O.farm.keepGround) setTile(M, x, y, grassT); else if (M.solid[k]) todo.add(k); }   // (a garden field is all one grass; keepGround: a meadow field keeps its own ground, only cells that had something on them are filled)   // (keepGround: open ground keeps its tile, for a field in an open meadow)
    // a cell that had something on it takes the ground of an open neighbour (ring by ring), so no square patch shows
    for (let pass = 0; pass < 30 && todo.size; pass++) { const fixed = [];
      for (const k of todo) { const x = k % M.w, y = (k - x) / M.w; for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * M.w + nx;
        if (nx >= cx0 - 1 && ny >= cy0 - 1 && nx <= cx1 + 1 && ny <= cy1 + 1 && nx >= 0 && ny >= 0 && nx < M.w && ny < M.h && !todo.has(j) && !M.solid[j]) { fixed.push([k, M.ground[j] & 0xff]); break; } } }
      if (!fixed.length) break; for (const [k, v] of fixed) { M.ground[k] = v; M.solid[k] = 0; todo.delete(k); } }
    for (const k of todo) { const x = k % M.w; setTile(M, x, (k - x) / M.w, grassT); } }   // (open ground keeps its own tile: the original's paths and patches run on through the field)
  if (cy0 > 0) for (let x = cx0; x <= cx1; x++) M.overlay[(cy0 - 1) * M.w + x] = 0;
  if (!O.ownWell) { placeObj(M, 42, 0, V.well[0] * WG_T + 8, V.well[1] * WG_T + 14); setSolid(M, V.well[0], V.well[1], 1); }   // (ownWell: the map has its own, at V.well)
  M.spawn = [V.spawn[0] * WG_T + 8, V.spawn[1] * WG_T + 8]; M.entry = M.spawn.slice();
  floodReach(M, V.spawn[0], V.spawn[1]);
  // the town's chest and campfire: the open tiles nearest the well, clear of any picture, off the farm (as the generated towns)
  const boxes = M.objA.concat(M.objB).map(([b, fi, x, y]) => { const f = objFrame(b, fi); return f && [x + f[4], y + f[5], x + f[4] + f[2], y + f[5] + f[3]]; }).filter(Boolean);
  const clear = (x, y) => { const px = x * WG_T + 8, py = y * WG_T + 8; return !boxes.some(([a, b, c, d]) => px + 22 > a && px - 22 < c && py + 12 > b && py - 26 < d); };
  const onFarm = (x, y) => V.plots.some(([px, py]) => x >= px - 1 && x <= px + 2 && y >= py - 1 && y <= py + 2);
  const open = (x, y) => !M.solid[y * M.w + x] && M.reach[y * M.w + x] && M.reach[(y + 1) * M.w + x] && !onFarm(x, y) && clear(x, y) && Math.hypot(x - V.well[0], y - V.well[1]) >= 2 && Math.hypot(x - V.well[0], y - V.well[1] - 2.5) >= 3;   // (nor on the Farm Board, 40 px below the well: Mossbrook's chest stood in front of it, 2026-11-20)
  const tiles = []; for (let y = 2; y < M.h - 2; y++) for (let x = 2; x < M.w - 2; x++) if (open(x, y)) tiles.push([x, y]);
  tiles.sort((a, b) => Math.hypot(a[0] - V.well[0], a[1] - V.well[1]) - Math.hypot(b[0] - V.well[0], b[1] - V.well[1]));
  const camp = OUTPOST_CAMP[i] = [tiles[0]]; camp.push(tiles.find(t => Math.hypot(t[0] - camp[0][0], t[1] - camp[0][1]) >= 3) || tiles[1]);
  for (const [x, y] of camp) setSolid(M, x, y, 1);
  M.filler = TL.filler;
  WG_MAPS['otown' + i] = M;
  return M;
}
function outpostLayout(i) {
  if (ORIG_TOWNS[i]) { const L0 = origLayout(i); if (L0) return L0; }
  const L = OUTPOST_LAYOUTS[i] || OUTPOST_LAYOUTS[0];
  return { ...OUTPOST, home: { bank: 13, fi: 12, bx: L.home, by: 14 }, dojo: { bank: 13, fi: L.noDojo ? 6 : 1, bx: L.dojo, by: 14 },   /* (a town with no dojo master yet: a plain house there) */ plots: L.plots, well: L.well, stone: L.stone, square: L.square,
    shops: Object.entries(L.shops).map(([k, bx]) => ({ ...OUTPOST_SHOP[k], bx, by: 14 })), houses: L.houses.map(([fi, bx]) => ({ bank: 13, fi, bx, by: 14 })), flowers: L.flowers, pines: L.pines, lamps: L.lamps || 7 };
}
const OUTPOST_CAMP = [];
const OUTPOST_BARE = { Cloudhold: { top: true, bottom: true } };   // generated towns that leave out their top / bottom tree rows
// POND TILES (the desert's oases and its town): tiles_3's own pond set, chosen per cell by which neighbours are water: open
// water 57, shores 82/83 (top), 92/93 (bottom), 56/66 (left), 59/69 (right), outer corners 46 49 76 79, inner corners 47 48 77 78.
// Cells too thin for a shore (water on neither side) are dropped first, so every edge has a piece.
function layPondTiles(M, cellList) {
  const W = M.w, Wt = new Set(cellList), has = (x, y) => Wt.has(y * W + x);
  for (let changed = true; changed;) { changed = false; for (const i of [...Wt]) { const x = i % W, y = (i - x) / W; if ((!has(x - 1, y) && !has(x + 1, y)) || (!has(x, y - 1) && !has(x, y + 1))) { Wt.delete(i); changed = true; } } }
  for (const i of Wt) {
    const x = i % W, y = (i - x) / W, n = has(x, y - 1), s2 = has(x, y + 1), w2 = has(x - 1, y), e = has(x + 1, y), alt = (x + y) % 2;
    let t = 57;
    if (!n && !w2) t = 46; else if (!n && !e) t = 49; else if (!s2 && !w2) t = 76; else if (!s2 && !e) t = 79;
    else if (!n) t = alt ? 83 : 82; else if (!s2) t = alt ? 93 : 92; else if (!w2) t = alt ? 66 : 56; else if (!e) t = alt ? 69 : 59;
    else if (!has(x - 1, y - 1)) t = 47; else if (!has(x + 1, y - 1)) t = 48; else if (!has(x - 1, y + 1)) t = 77; else if (!has(x + 1, y + 1)) t = 78;
    setTile(M, x, y, t, 1);
  }
}
// THE GREEN OUTPOSTS DRESSED LIKE HEARTHVALE (villageDressing): Mossbrook and Duskhollow share Hearthvale's tileset, so
// they get its hedged gardens and its barrels, stumps, rocks, mushrooms, pebbles and flowers too. keep: where people
// stand (townlife.js TL_SPOT, folk.js FOLK.outposts, the shopkeepers, the Elder: those scripts load after this one, so
// their spots are copied here); nothing goes within a tile of them, nor on the rows beside the road.
// a town's pieces: hedge tiles (and the cap laid on the row above, if any), what grows inside a garden ([tile, share]), and
// the props ([tile, solid, weight]). Green: Hearthvale's own. Ice: the decoded ice maps' own (an icy shrub border, ice
// crystals 53, snow drifts 85/86, grey rocks 38/39, a snow boulder 9, ice shards 47, an old bone 46).
const DRESS_SETS = {
  green: { hedge: [246, 247], cap: 250, inside: [[47, 0.45], [179, 0.1], [26, 0.07]], props: [[230, true, 3], [39, true, 3], [29, true, 3], [26, false, 4], [179, false, 3], [47, false, 4]] },
  // the desert maps' own (tiles_3): sandstone rock clusters 86/87/88, a dark boulder 89, crossed stakes 94, a grey rock 81,
  // and loose pebbles 85, dry grass 17, a green shrub patch 9, a skull 12 (no gardens: the sands have no hedges)
  desert: { hedge: null, cap: null, inside: [], props: [[86, true, 3], [88, true, 3], [87, true, 2], [89, true, 2], [94, true, 2], [81, true, 1], [85, false, 4], [17, false, 4], [9, false, 3], [12, false, 1]] },
  ice: { hedge: [37, 37], cap: null, inside: [[47, 0.3], [53, 0.12], [85, 0.15]], props: [[9, true, 3], [39, true, 3], [38, true, 2], [53, true, 2], [86, false, 4], [85, false, 4], [47, false, 3], [46, false, 1]] },
};
const OUTPOST_DRESS = {
  4: { set: 'desert', gardens: 0, props: 45, keep: [[19, 18], [28, 24], [48, 18], [52, 19], [60, 18], [23, 18], [40, 21], [26, 21], [24, 16], [41, 22], [27, 22], [14, 22], [30, 23], [46, 22], [58, 22], [20, 19], [29, 25], [61, 19], [12, 15], [20, 15], [28, 15], [34, 15]] },
  3: { set: 'ice', gardens: 2, props: 40, keep: [[13, 18], [17, 22], [25, 18], [27, 22], [36, 18], [42, 18], [44, 22], [52, 18], [55, 22], [61, 19], [28, 10], [33, 22], [31, 16], [29, 10], [34, 22], [23, 22], [39, 22], [48, 22], [59, 22], [14, 19], [56, 23], [11, 15], [42, 15], [50, 15], [58, 15]] },
  0: { gardens: 2, props: 40, keep: [[19, 18], [28, 24], [34, 19], [36, 19], [48, 18], [52, 19], [60, 18], [23, 18], [42, 20], [44, 24], [40, 21], [26, 21], [24, 16], [41, 22], [27, 22], [15, 22], [31, 23], [46, 22], [58, 22], [29, 25], [43, 21], [45, 25], [12, 15], [20, 15], [28, 15], [34, 15]] },
  1: { gardens: 2, props: 40, keep: [[12, 18], [21, 18], [24, 18], [33, 18], [49, 19], [51, 24], [60, 18], [62, 21], [43, 20], [57, 19], [41, 24], [14, 24], [38, 22], [42, 22], [38, 16], [39, 22], [43, 22], [17, 22], [32, 22], [47, 22], [57, 22], [13, 19], [44, 21], [63, 22], [11, 15], [19, 15], [47, 15], [54, 15]] },
};
function outpostDressing(M, V, i, busy, inSand, onFarm) {
  const D = OUTPOST_DRESS[i], X = seededRng(0x7a11e + i * 977), W = V.W, P = TOWN_POND[i];
  const wet = (x, y) => P && ((x + 0.5 - P[0]) / (P[2] + 1.5)) ** 2 + ((y + 0.5 - P[1]) / (P[3] + 1.5)) ** 2 <= 1;
  const ok = (x, y) => x >= 3 && y >= 4 && x < W - 3 && y < V.H - 4 && !(y >= V.road[0] - 1 && y <= V.road[1] + 1) && !M.solid[y * W + x] && !(M.overlay[y * W + x] & 0xff) && !busy.has(x + ',' + y)
    && !inSand(x + 0.5, y + 0.5) && !onFarm(x, y) && !wet(x, y) && Math.hypot(x - V.well[0], y - V.well[1]) > 2 && Math.hypot(x - V.stone[0], y - V.stone[1]) > 3 && !D.keep.some(([kx, ky]) => Math.abs(kx - x) <= 1 && Math.abs(ky - y) <= 1);
  const lay = (x, y, t, solid) => { M.overlay[y * W + x] = t + 1; if (solid) setSolid(M, x, y, 1); busy.add(x + ',' + y); };
  const S = DRESS_SETS[D.set || 'green'], hedgeAt = (x, y) => lay(x, y, S.hedge[(x * 7 + y) % 3 ? 0 : 1], true);
  const boxes = M.objA.concat(M.objB).map(([b, fi, x, y]) => { const f = objFrame(b, fi); return f && [x + f[4], y + f[5], x + f[4] + f[2], y + f[5] + f[3]]; }).filter(Boolean);
  const underPicture = (x0, y0, x1, y1) => boxes.some(([a, b, c, d]) => (x0 - 1) * WG_T < c && (x1 + 2) * WG_T > a && (y0 - 2) * WG_T < d && (y1 + 1) * WG_T + 4 > b);   // (a roof or a treetop would stand over the garden)
  for (let k = 0, tries = 0; k < D.gardens && tries < 600; tries++) {   // hedged gardens, as Hearthvale's
    const w = 5 + Math.floor(X() * 3), h = 4 + Math.floor(X() * 2), x0 = 3 + Math.floor(X() * (W - 6 - w)), y0 = 5 + Math.floor(X() * (V.H - 10 - h)), x1 = x0 + w - 1, y1 = y0 + h - 1, gap = Math.floor((x0 + x1) / 2);
    let fits = !underPicture(x0, y0, x1, y1); for (let y = y0 - 1; y <= y1 + 1 && fits; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (!ok(x, y)) { fits = false; break; }
    if (!fits) continue;
    for (let x = x0; x <= x1; x++) { hedgeAt(x, y0); if (S.cap != null) M.overlay[(y0 - 1) * W + x] = S.cap + 1; if (x !== gap && x !== gap + 1) hedgeAt(x, y1); else busy.add(x + ',' + y1); }
    for (let y = y0 + 1; y < y1; y++) { hedgeAt(x0, y); hedgeAt(x1, y); }
    for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) { let r = X(), t = null; for (const [tile, share] of S.inside) { if (r < share) { t = tile; break; } r -= share; } if (t != null) lay(x, y, t, false); else busy.add(x + ',' + y); }
    k++;
  }
  const PROPS = S.props, tot = PROPS.reduce((a, p) => a + p[2], 0);
  const pickProp = () => { let r = X() * tot; for (const p of PROPS) { r -= p[2]; if (r <= 0) return p; } return PROPS[0]; };
  const homes = [V.home, ...V.shops, ...V.houses, V.dojo].filter(Boolean);
  for (let k = 0, tries = 0; k < D.props && tries < 700; tries++) {   // most beside a building (clear of its shopkeeper's side), the rest on the grass
    let x, y; if (X() < 0.55) { const H = homes[Math.floor(X() * homes.length)]; x = H.bx + (X() < 0.5 ? -3 : 4); y = H.by - 1 - Math.floor(X() * 3); }
    else { x = 3 + Math.floor(X() * (W - 6)); y = 4 + Math.floor(X() * (V.H - 8)); }
    if (!ok(x, y)) continue; const [t, solid] = pickProp();
    if (solid) { let open = true; for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if (M.solid[(y + dy) * W + x + dx]) { open = false; break; } if (!open) continue; }
    lay(x, y, t, solid); k++;
  }
}
function buildOutpostMap(i) {
  if (ORIG_TOWNS[i] && WG_MAPS[ORIG_TOWNS[i].src]) return buildOrigTown(i);
  const V = outpostLayout(i), TL = TOWN_LOOK[i], M = blankMap(V.W, V.H, TL.ts, TL.base), R = seededRng(900 + i);
  M.name = OUTPOST_TOWNS[i].name; M.town = true;
  for (let y = 0; y < V.H; y++) for (let x = 0; x < V.W; x++) setTile(M, x, y, TL.base);
  if (TL.sand) { M.sandTile = TL.sand; M.sandRim = TL.sandRim; M.pathTint = TL.pathTint; }
  const hb = V.home, SH = M.sandShapes = [['rect', -2, V.road[0] + 0.4, V.W + 2, V.road[1] - 0.4, 1.4], ['ellipse', ...V.square],
    ['rect', hb.bx - 1.1, hb.by - 0.6, hb.bx + 2.1, V.road[0] + 1, 0.9],
    ...[V.dojo, ...V.shops, ...V.houses].map(S => ['rect', S.bx - 1.1, S.by - 0.6, S.bx + 2.1, V.road[0] + 1, 0.9])];   // a sandy step from each door to the road
  const inSand = (x, y) => SH.some(s => s[0] === 'rect' ? x >= s[1] && x <= s[3] && y >= s[2] && y <= s[4] : ((x - s[1]) / s[3]) ** 2 + ((y - s[2]) / s[4]) ** 2 <= 1);
  const onFarm = (x, y) => V.plots.some(([px, py]) => x >= px - 1 && x <= px + 2 && y >= py - 1 && y <= py + 2);
  const buildings = [hb, V.dojo, ...V.shops, ...V.houses];
  const byBuilding = x => buildings.some(B => Math.abs(x - B.bx) <= 3);   // (no lamp in front of a door)
  // the forest ring, open where the road runs through at both ends
  for (let y = 0; y < V.H; y++) for (let x = 0; x < V.W; x++) {
    const edge = x < 3 || y < 3 || x >= V.W - 3 || y >= V.H - 3, road = y >= V.road[0] && y <= V.road[1];
    if (edge && !((x < 3 || x >= V.W - 3) && road)) setSolid(M, x, y, 1);
  }
  const tree = (tx, ty, k) => placeObj(M, TL.tree[0], TL.tree[k], tx * WG_T + 8, ty * WG_T + 14);
  // (Cloudhold: no tree rows along the top or bottom, 2026-11-20, the user: "remove the trees from top side of this town" / "the trees at
  // the bottom doesnt need to be there"; a top-row tree also stood on the camp chest. The edge rows stay solid, so the island's rim holds.)
  const bare = OUTPOST_BARE[OUTPOST_TOWNS[i] && OUTPOST_TOWNS[i].name] || {};
  for (let x = 0; x < V.W; x += 2) { if (!bare.top) { tree(x, 1, 2); tree(x + 1, 2, 1); } if (!bare.bottom) { tree(x, V.H - 2, 2); tree(x + 1, V.H - 1, 1); } }
  for (let y = 4; y < V.H - 3; y += 2) if (y < V.road[0] - 1 || y > V.road[1]) { tree(1, y, 2); tree(0, y + 1, 1); tree(V.W - 2, y, 2); tree(V.W - 1, y + 1, 1); }
  // (as in Hearthvale: the forest band blocks only under a tree's trunk — you walk under the treetops)
  const treeAt = (tx, ty) => M.objB.some(([b, fi, x, y]) => { const f = objFrame(b, fi); if (!f || +b !== TL.tree[0]) return false;
    const cx = tx * WG_T + 8, cy = ty * WG_T + 8; return cx >= x + f[4] - 2 && cx <= x + f[4] + f[2] + 2 && cy >= y + f[5] + f[3] - 18 && cy <= y + f[5] + f[3] + 2; });
  for (let y = 0; y < V.H; y++) for (let x = 0; x < V.W; x++)
    if ((x < 3 || y < 3 || x >= V.W - 3 || y >= V.H - 3) && M.solid[y * V.W + x] && !treeAt(x, y) && y > 2 && y < V.H - 3) setSolid(M, x, y, 0);
  // the house and the shops: each building's lower body blocks, its door (the middle of the front) opens onto the road
  for (const B of buildings) {
    placeObj(M, B.bank, B.fi, B.bx * WG_T + 8, B.by * WG_T);
    const f = objFrame(B.bank, B.fi), wT = Math.round(f[2] / WG_T), hT = Math.min(4, Math.round(f[3] * 0.55 / WG_T));
    for (let y = B.by - hT; y < B.by; y++) for (let x = B.bx - Math.floor(wT / 2); x <= B.bx + Math.floor((wT - 1) / 2); x++) setSolid(M, x, y, 1);
  }
  // the farm: plain grass on the map (home.js draws the soil over it); the well beside it
  placeObj(M, 42, 0, V.well[0] * WG_T + 8, V.well[1] * WG_T + 14); setSolid(M, V.well[0], V.well[1], 1);
  const P = TOWN_POND[i];   // the fishing water (townlife.js), solid before the dressing goes down
  if (P && TL.pondTiles) {   // (the desert town: its pond laid tile by tile from the desert's own pond pieces, as the oases are)
    const cells = []; for (let y = Math.floor(P[1] - P[3]); y <= P[1] + P[3]; y++) for (let x = Math.floor(P[0] - P[2]); x <= P[0] + P[2]; x++) if (((x + 0.5 - P[0]) / P[2]) ** 2 + ((y + 0.5 - P[1]) / P[3]) ** 2 <= 1) cells.push(y * V.W + x);
    layPondTiles(M, cells);
  } else if (P) {
    M.waterShapes = [['ellipse', ...P]]; M.poolTile = TL.ts === 6 ? 105 : 120;
    if (TL.sand) M.waterRim = ['rgba(120,150,200,0.5)', 'rgba(255,255,255,0.8)'];
    for (let y = Math.floor(P[1] - P[3]); y <= P[1] + P[3]; y++) for (let x = Math.floor(P[0] - P[2]); x <= P[0] + P[2]; x++) if (((x + 0.5 - P[0]) / P[2]) ** 2 + ((y + 0.5 - P[1]) / P[3]) ** 2 <= 1) setSolid(M, x, y, 1);
  }
  // dressing: lamps along the road, a few pines and flowers, benches by the square
  const busy = new Set(), put = (b, fi, tx, ty, solid, dy = 14) => {
    const k = tx + ',' + ty; if (busy.has(k) || M.solid[ty * V.W + tx] || inSand(tx + 0.5, ty + 0.5) || onFarm(tx, ty)) return false;
    if (Math.abs(tx - V.well[0]) <= 1 && Math.abs(ty - V.well[1]) <= 1) return false;
    if (Math.abs(tx - V.stone[0]) <= 2 && Math.abs(ty - V.stone[1]) <= 2) return false;
    busy.add(k); placeObj(M, b, fi, tx * WG_T + 8, ty * WG_T + dy); if (solid) setSolid(M, tx, ty, 1); return true;
  };
  // (lamps: a pair every 14 tiles at most, 2026-11-18: the original lights its crossings, not every few steps)
  for (let lx = 6; lx < V.W - 4; lx += Math.max(V.lamps, 14)) { if (!byBuilding(lx)) put(6, 0, lx, V.road[0] - 1, true, 2); put(6, 0, lx, V.road[1] + 1, true, 2); }
  for (const dx of [-4, 3]) { const bx = Math.round(V.square[0] + dx), by = V.road[1] + 2; put(6, 1, bx, by, false, 12);   // benches south of the square
    for (let y = by - 1; y <= by + 3; y++) for (let x = bx - 2; x <= bx + 2; x++) busy.add(x + ',' + y); }   // (room round a bench: no tree grows over it)
  for (const [b, fi, tx, ty, hw] of TOWN_PIECES[i]) {   // what this town is known for (fire never: FIRE_BANKS)
    placeObj(M, b, fi, tx * WG_T + 8, ty * WG_T + 14); busy.add(tx + ',' + ty);
    if (hw) for (let x = tx - hw; x <= tx + hw; x++) setSolid(M, x, ty, 1);
  }
  for (let k = 0; k < V.pines; k++) put(TL.tree[0], TL.tree[2], 4 + Math.floor(R() * (V.W - 8)), V.road[1] + 3 + Math.floor(R() * 4), true);   // pines south of the road
  for (let k = 0; k < 8; k++) put(TL.tree[0], TL.tree[2], 4 + Math.floor(R() * (V.W - 8)), 4 + Math.floor(R() * 3), true);                     // and a few behind the houses
  for (let k = 0; k < (TL.flowers ? V.flowers : 0); k++) put(66, k % 3, 4 + Math.floor(R() * (V.W - 8)), 4 + Math.floor(R() * (V.H - 8)), false, 12);   // flowers
  if (OUTPOST_DRESS[i]) outpostDressing(M, V, i, busy, inSand, onFarm);
  M.spawn = [V.spawn[0] * WG_T + 8, V.spawn[1] * WG_T + 8]; M.entry = M.spawn.slice();
  floodReach(M, V.spawn[0], V.spawn[1]);
  // the town's chest and campfire: the two open tiles nearest its well, in clear view (no object's picture over them, tree tops included),
  // off the road and the farm, and reachable on foot. Placed last, when everything else is down.
  const boxes = M.objA.concat(M.objB).map(([b, fi, x, y]) => { const f = objFrame(b, fi); return f && [x + f[4], y + f[5], x + f[4] + f[2], y + f[5] + f[3]]; }).filter(Boolean);
  const clear = (x, y) => { const px = x * WG_T + 8, py = y * WG_T + 8; return !boxes.some(([x0, y0, x1, y1]) => px + 22 > x0 && px - 22 < x1 && py + 12 > y0 && py - 26 < y1); };
  const P2 = TOWN_POND[i], wet = (x, y) => P2 && ((x + 0.5 - P2[0]) / (P2[2] + 2)) ** 2 + ((y + 0.5 - P2[1]) / (P2[3] + 2)) ** 2 <= 1;
  const open = (x, y) => !M.solid[y * V.W + x] && M.reach[(y + 1) * V.W + x] && !inSand(x + 0.5, y + 0.5) && !inSand(x + 0.5, y + 1.5) && !onFarm(x, y) && !wet(x, y) && clear(x, y) && Math.hypot(x - V.well[0], y - V.well[1]) >= 3 && Math.hypot(x - V.well[0], y - V.well[1] - 2.5) >= 3;
  const tiles = []; for (let y = 4; y < V.H - 4; y++) for (let x = 4; x < V.W - 4; x++) if (open(x, y)) tiles.push([x, y]);
  tiles.sort((a, b) => Math.hypot(a[0] - V.well[0], a[1] - V.well[1]) - Math.hypot(b[0] - V.well[0], b[1] - V.well[1]));
  const camp = OUTPOST_CAMP[i] = [tiles[0]]; camp.push(tiles.find(t => Math.hypot(t[0] - camp[0][0], t[1] - camp[0][1]) >= 3));
  for (const [x, y] of camp) setSolid(M, x, y, 1);
  M.filler = TL.filler;
  WG_MAPS['otown' + i] = M;
  return M;
}
OUTPOST_TOWNS.forEach((_, i) => buildOutpostMap(i));

// ================================================================ the Sun Temple arena
// The ranked arena is a coliseum built from the temple's own tiles and the game's furniture: tiered stone seating packed
// with townsfolk on three sides, a royal box in the north stands where the winged statue looks down, and in the middle a
// sunken pit of sand trimmed in gold, with a fighters' gate in each side wall, pillars at its corners, weapon racks and
// armour stands along the north wall, shields hung above, and lantern posts round the edge. (world.js draws the crowd,
// the banners and the chalk duelling circle.) The raids and the Dark Court use the same map.
const ARENA2 = { W: 34, H: 27, p1: [12, 16], p2: [21, 16], pit: { x0: 3, y0: 5, x1: 30, y1: 23 }, ring: { x0: 10, y0: 11, x1: 23, y1: 21 }, box: { x0: 14, x1: 19 } };
function buildArenaMap() {
  const A = ARENA2, P = A.pit, M = blankMap(A.W, A.H, 4, 70), W = A.W, H = A.H, rnd = seededRng(11);
  M.name = 'Sun Temple Arena';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setTile(M, x, y, 51, 1);   // everything outside the pit is stone (solid)
  // the stands: a wall top, three tiers of seats, then the pit wall's face (north); the same mirrored to the south
  for (let x = 0; x < W; x++) {
    setTile(M, x, 0, x === 0 ? 0 : x === W - 1 ? 5 : x % 2 ? 2 : 3, 1);
    for (const y of [1, 2, 3]) setTile(M, x, y, 52, 1);
    setTile(M, x, 4, x % 2 ? 14 : 13, 1);
    setTile(M, x, 24, 52, 1);
    setTile(M, x, 25, x === 0 ? 1 : x === W - 1 ? 6 : 3, 1); setTile(M, x, 26, x === 0 ? 11 : x === W - 1 ? 16 : x % 2 ? 14 : 13, 1);
  }
  for (let y = 1; y < 4; y++) for (let x = A.box.x0; x <= A.box.x1; x++) setTile(M, x, y, y === 3 ? (x % 2 ? 105 : 104) : 94, 1);   // the royal box
  // the side stands: the temple's wall columns, two deep
  const S = WG_MAPS.cave2;
  for (let y = 5; y < 24; y++) { const sy = 19 + ((y - 5) % 4); for (const [dx, sx] of [[0, 0], [1, 1], [W - 2, 32], [W - 1, 33]]) setRaw(M, dx, y, S.ground[sy * S.w + sx] | 0x100); setTile(M, 2, y, 108, 1); setTile(M, W - 3, y, 109, 1); }
  // the pit: sand with its gold trim
  for (let y = P.y0; y <= P.y1; y++) for (let x = P.x0; x <= P.x1; x++) {
    const L = x === P.x0, R = x === P.x1, T0 = y === P.y0, B = y === P.y1;
    const r = rnd(); setTile(M, x, y, T0 ? (L ? 60 : R ? 62 : 61) : B ? (L ? 80 : R ? 82 : 81) : L ? 70 : R ? 72 : r < 0.035 ? [63, 64, 73, 74][Math.floor(r / 0.035 * 4)] : 71, 0);   // (a few scuffs in the sand)
  }
  const G = A.ring;   // the duelling ring: a second gold border inside the pit, where the fighters start
  for (let y = G.y0; y <= G.y1; y++) for (let x = G.x0; x <= G.x1; x++) {
    const L = x === G.x0, R = x === G.x1, T0 = y === G.y0, B = y === G.y1; if (!(L || R || T0 || B)) continue;
    setTile(M, x, y, T0 ? (L ? 60 : R ? 62 : 61) : B ? (L ? 80 : R ? 82 : 81) : L ? 70 : 72, 0);
  }
  // the fighters' gates: dark archways in the side walls, level with each fighter's mark
  // (removed 2026-11-20, the user: "remove that": they read as two black holes in the walls)
  // furniture (bank 100 like the Dojo, bank 39 the statue, bank 35 the wall lamps), placed by their own size
  const put = (bank, fi, cx, by, solid = 1) => {
    const r = objFrame(bank, fi); if (!r) return;
    M.objB.push([bank, fi, Math.round(cx - r[4] - r[2] / 2), Math.round(by - r[5] - r[3])]);
    if (solid) for (let x = Math.floor((cx - r[2] * 0.3) / WG_T); x <= Math.floor((cx + r[2] * 0.3) / WG_T); x++) setSolid(M, x, Math.floor((by - 4) / WG_T));
  };
  const C = W * WG_T / 2, wallY = 5 * WG_T, top = P.y0 * WG_T, bot = (P.y1 + 1) * WG_T, lft = P.x0 * WG_T, rgt = (P.x1 + 1) * WG_T;
  put(39, 0, C, top + 92);                                                             // the winged statue at the head of the pit, below the royal box
  put(100, 55, C, 4 * WG_T + 2, 0); put(100, 40, C - 34, 4 * WG_T - 2, 0); put(100, 41, C + 34, 4 * WG_T - 2, 0);   // the royal box: the golden shrine and its candles
  for (const s of [-1, 1]) {
    put(100, 5, C + s * 80, wallY + 20); put(100, 3, C + s * 112, wallY + 20); put(100, 4, C + s * 140, wallY + 20); put(100, 5, C + s * 172, wallY + 20);   // racks and armour along the north wall
    for (const [x, y] of [[s < 0 ? lft + 12 : rgt - 12, top + 22], [s < 0 ? lft + 12 : rgt - 12, bot - 6]]) put(100, 38, x, y);   // lantern posts at the pit's corners
    for (const y of [top + 120, bot - 70]) put(100, 38, s < 0 ? lft + 10 : rgt - 10, y);
  }
  for (const [fi, dx] of [[9, -190], [6, -150], [0, -100], [0, 100], [6, 150], [9, 190]]) { const r = objFrame(100, fi); if (r) M.objB.push([100, fi, Math.round(C + dx - r[4] - r[2] / 2), Math.round(4 * WG_T + 8 - r[5] - r[3] / 2)]); }   // shields and swords on the pit wall
  M.spawn = [A.p1[0] * WG_T + 8, A.p1[1] * WG_T + 8];
  floodReach(M, A.p1[0], A.p1[1]);
  WG_MAPS.arena2 = M;
  return M;
}

// ---------------------------------------------------------------- map slices
// A rectangle cut out of a decoded map becomes a little map of its own (its largest open patch is the walkable
// part). Used to fill the empty bands above and below the Wilds' maps with more land.
function largestReach(M) {
  const seen = new Uint8Array(M.w * M.h); let best = [];
  for (let i = 0; i < M.w * M.h; i++) {
    if (M.solid[i] || seen[i]) continue;
    const comp = [], st = [i]; seen[i] = 1;
    while (st.length) { const c = st.pop(), x = c % M.w, y = (c - x) / M.w; comp.push(c);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= M.w || ny >= M.h) continue; const j = ny * M.w + nx; if (!M.solid[j] && !seen[j]) { seen[j] = 1; st.push(j); } } }
    if (comp.length > best.length) best = comp;
  }
  M.reach = new Array(M.w * M.h).fill(0); for (const c of best) M.reach[c] = 1;
  const sp = best.reduce((a, c) => { const d = (c % M.w - M.w / 2) ** 2 + (Math.floor(c / M.w) - M.h / 2) ** 2; return d < a[0] ? [d, c] : a; }, [1e9, best[0] || 0])[1];
  M.spawn = [(sp % M.w) * WG_T + 8, Math.floor(sp / M.w) * WG_T + 12];
  return best.length;
}
function cropMap(srcKey, w, h, R) {
  const S = WG_MAPS[srcKey];
  if (w < 12 || h < 8) return null;
  for (let tries = 0; tries < 8; tries++) {
    const sx = Math.floor(R() * (S.w - w + 1)), sy = Math.floor(R() * (S.h - h + 1)), key = `${srcKey}@${sx},${sy},${w}x${h}`;
    if (WG_MAPS[key]) return key;
    const M = blankMap(w, h, S.tileset, Math.max(0, (S.filler || 1) - 1));
    stampMap(M, srcKey, sx, sy, w, h, 0, 0, b => b !== 26 && b !== 3);
    if (largestReach(M) < w * h * 0.3) continue;   // mostly walls: try another cut
    M.name = S.name; M.filler = S.filler; M.entry = M.spawn.slice();
    WG_MAPS[key] = M;
    return key;
  }
  return null;
}

// per row, how far in from a map's left or right edge the first open ground is (Infinity: none in that row). A
// crossing between two maps cuts through that much of each, so the rows where it is smallest join them best.
const EDGE_DIST = {};
function edgeDist(key, side) {
  if (EDGE_DIST[key + side]) return EDGE_DIST[key + side];
  const M = WG_MAPS[key], out = new Array(M.h).fill(Infinity);
  for (let y = 0; y < M.h; y++) for (let k = 0; k < M.w; k++) if (M.reach[y * M.w + (side === 'L' ? k : M.w - 1 - k)]) { out[y] = k; break; }
  return (EDGE_DIST[key + side] = out);
}

// ================================================================ the Wilds
// zone pools: every decoded map of the zone; the far west end of the world stays the Sun Temple (z3m)
// Zenonia's own field maps mixed into each zone's areas (generateWilds pool), sorted by look: green fields; the dense pine forests and
// Zenonia 2's river woods for the Twilight Grove; the cloud isles; the ice caverns; the desert ruins. Only maps up to 53 tiles high,
// so the Wilds don't grow much taller (the ice-castle rooms, the steam factory and the lava maps don't suit an open zone).
// 2026-11-18: OFF. The user missed the world we made ("i kind just wanted the esthetic of this map on our original one … now its all ugly and separated"): the generated areas are back; the Zenonia 2 look is to be brought onto them instead.
const Z2V_ON = false, Z2V_KEYS = Object.keys(WG_MAPS).filter(k => WG_MAPS[k].z2field);   // every whole Zenonia 2 map (assets/z2fields.js)
// which of them make up each zone (the Twilight Grove, 2026-11-18: the user chose Zenonia 2's green maps under its dusk light)
const Z2_ZONE_KEYS = { 0: ['zv008', 'zv009', 'zv010', 'zv012', 'zv014', 'zv016', 'zv013', 'zv017', 'zv018', 'zv019'],
  1: ['zv097', 'zv098', 'zv153', 'zv016', 'zv009', 'zv014', 'zv010', 'zv012', 'zv008', 'zv018'],
  2: ['zv087', 'zv088', 'zv089', 'zv090', 'zv013', 'zv017', 'zv018', 'zv019'],
  3: ['zv034', 'zv035', 'zv037', 'zv038', 'zv039', 'zv040', 'zv041', 'zv042', 'zv043'],
  4: ['zv020', 'zv060', 'zv070', 'zv071', 'zv085'] };   // (021, 022 and 023 dropped: their ruined buildings decode with black blocks)   // (the Sunscorch Desert: Zenonia 2's desert canyons)   // (the Skyreach Isles: Zenonia 2's cloud isles and its green sky islands)
for (const z in Z2_ZONE_KEYS) Z2_ZONE_KEYS[z] = Z2_ZONE_KEYS[z].filter(k => WG_MAPS[k]);
const ORIG_FIELDS = [['z1', 'z1b', 'z0f'], ['z0b', 'z0g', 'z0h'], ['z2', 'z2b', 'z2d'], ['z3j', 'z3k'], ['z1f', 'z1g']];
// a few walkable cells of these maps have no ground tile (the original drew something under them we don't have): in the Wilds the
// sea showed through as bright blue squares. Each takes the ground most common round it.
for (const k of [...ORIG_FIELDS.flat(), ...Z2V_KEYS]) {
  const M = WG_MAPS[k]; if (!M || M.holesFilled) continue; M.holesFilled = true;
  for (let pass = 0; pass < 3; pass++) for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
    const i = y * M.w + x; if ((M.ground[i] & 0xff) || (M.solid[i] && !M.z2field)) continue;   // (a whole Zenonia 2 map: its blocked holes too, or they show black)
    const n = {}; let best = 0, bv = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= M.w || yy >= M.h) continue; const v = M.ground[yy * M.w + xx] & 0xff; if (v) { n[v] = (n[v] || 0) + 1; if (n[v] > bv) { bv = n[v]; best = v; } } }
    if (best) M.ground[i] = best;
  }
}
const ZONE_LEN = [20, 20, 20, 21, 11];   // (the fifth: the Sunscorch Desert, between the Frozen Abyss and the Sun Temple)   // areas per zone (was 16 · 16 · 16 · 18, before that 8 · 7 · 10 · 13)
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI'];
// ================================================================ generated areas (every zone of the Wilds)
// The decoded maps were cut from bigger worlds, so their edges were full of cut-off cliffs, stairs and shores. The
// Wilds' areas are generated instead, bigger, and laid out like Zenonia's own fields: a winding trail from the west
// edge to the east, open clearings along it (some with side trails), pools with soft shores, a deep wall of the zone's
// trees along the top and bottom, clumps in the open, scattered detail, and now and then a camp. Trails and pools are
// soft shapes (M.sandShapes / M.waterShapes) painted over the floor with the zone's own tiles. Each zone is a theme:
//   ts tileset · base/alt floor tiles · path tile · pool tile (water, lava, ice) · band/clump objects [bank, fi] ·
//   hedge row object · deco list [weight, kind, ...] · lamps along the trail · paint colours for the rims
const ZONE_THEMES = [
  { name: 'fields', ts: 1, base: 0, alt: [], path: 7, pool: 120, lakes: [1, 2], poolP: 0.85,
    band: [[1, 2], [1, 2]], clump: [[1, 2]], clumps: [12, 17], hedge: [11, 0], hedgeAlt: [11, 1], hedges: [4, 7],   // whole trees only (frames 0/1 are trunk-less tops)
    deco: [[0.45, 'obj', 66, 0, 2, false, 12], [0.15, 'obj', 43, 0, 0, false, 12], [0.1, 'obj', 1, 3, 3, false, 14], [0.12, 'ovl', 23], [0.08, 'ovl', 29], [0.1, 'obj', 2, 0, 0, true, 14]],   // (rock 2:1 stands in a pool: not out in the dry fields)
    decoN: [28, 40], camp: [70, 0], lampP: 0, sandRim: ['rgba(120,150,40,0.35)', '#e8dc9c'], waterRim: ['rgba(150,120,60,0.45)', 'rgba(255,255,255,0.55)'], patches: true },
  { name: 'grove', ts: 1, base: 0, alt: [], path: 7, pool: 120, lakes: [0, 1], poolP: 0.5,
    band: [[1, 2], [1, 2]], bandDepth: [4, 8], clump: [[1, 2]], clumps: [18, 26], hedge: [11, 0], hedgeAlt: [43, 0], hedges: [2, 4],
    deco: [[0.5, 'obj', 43, 0, 0, false, 12], [0.2, 'obj', 66, 0, 2, false, 12], [0.15, 'ovl', 23], [0.15, 'obj', 2, 0, 0, true, 14]],
    decoN: [30, 44], camp: [70, 1], lampP: 0.6, tents: 0.4, sandRim: ['rgba(60,90,30,0.4)', '#d8cc8c'], waterRim: ['rgba(90,80,50,0.5)', 'rgba(220,240,255,0.45)'], patches: true },
  { name: 'ember', ts: 8, base: 104, alt: [28, 27, 17], altP: 0.12, path: 29, pool: 101, lakes: [1, 3], poolP: 0.95,
    band: [[18, 0], [18, 0]], clump: [[18, 1], [18, 1], [18, 0]], clumps: [4, 7], hedge: [18, 1], hedgeAlt: [18, 1], hedges: [2, 4],   // tall spires mostly in the walls; small spikes in the open (fire banks 20/61 are hidden in the Wilds: never use them here)
    deco: [[1, 'obj', 18, 1, 1, true, 14]],
    decoN: [14, 22], extra: { n: [18, 26], items: [[3, 248, 0, true, 14], [4, 18, 1, true, 14], [3, 286, 1, true, 14], [6, 286, 2, false, 14], [2, 18, 0, true, 14]] }, camp: [64, 4], lampP: 0, sandRim: ['rgba(255,110,30,0.22)', '#7a5040'], pathTint: 'rgba(255,120,40,0.16)', waterRim: ['rgba(30,8,0,0.7)', 'rgba(255,220,120,0.7)'], patches: false },
  { name: 'frost', ts: 6, base: 11, alt: [], path: 11, pool: 105, pathTint: 'rgba(80,100,160,0.2)', lakes: [1, 2], poolP: 0.8,
    band: [[40, 0], [40, 1]], clump: [[40, 1], [40, 1], [50, 5], [50, 6]],   // (40:0 is a trunk-less top: only for the back rows of the walls)
    clumps: [12, 17], hedge: [45, 0], hedgeAlt: [50, 1], hedges: [3, 5],
    deco: [[0.3, 'obj', 40, 2, 4, false, 12], [0.15, 'obj', 45, 1, 1, false, 12], [0.2, 'obj', 50, 1, 1, true, 14], [0.15, 'obj', 50, 3, 3, true, 14]],   // (no boulders: theirs sit on green grass tufts, out of place in snow)
    decoN: [26, 36], extra: { n: [9, 13], items: [[4, 40, 2, false, 12], [4, 40, 3, false, 12], [3, 45, 1, false, 12], [2, 50, 1, true, 14], [2, 40, 1, true, 14]] }, camp: [44, 0], lampP: 0, sandRim: ['rgba(140,160,210,0.25)', '#ffffff'], waterRim: ['rgba(120,150,200,0.5)', 'rgba(255,255,255,0.8)'], patches: false },
  // THE SUNSCORCH DESERT (tiles_3, the decoded desert maps' own sand): palms and cacti for its walls and clumps, rock spires,
  // bones and dry tufts on the sand, a few desert flowers
  { name: 'desert', ts: 3, base: 11, alt: [], altP: 0,   // (no floor variety: tiles_3's other sands are edge pieces with striped borders)
    path: 11, pool: 57, lakes: [0, 1], poolP: 0,
    band: [[28, 1], [28, 1]], clump: [[28, 1], [28, 1], [28, 0], [30, 1]], clumps: [6, 10], hedge: [28, 2], hedgeAlt: [28, 0], hedges: [2, 4],
    deco: [[0.3, 'obj', 1, 3, 3, false, 14], [0.15, 'obj', 29, 0, 1, false, 12], [0.25, 'ovl', 17], [0.15, 'ovl', 18], [0.1, 'obj', 1, 5, 5, true, 14], [0.1, 'obj', 30, 1, 1, true, 14]],
    decoN: [20, 30], camp: [70, 0], lampP: 0, oases: [0, 2], site: true, tents: 0.5, grass: 80,
    kinds: [   // the desert's own kinds of area: [weight, knobs]; extra: [bank, frame, solid, foot offset] placed in little groups
      [1.2, { name: 'dunes', clump: 0.35, singles: 0.4, pools: -1, deco: 1.2, bush: 0.4, flowers: 0.3, rocks: 0.4, extraN: [6, 10], extra: [[247, 3, 0, 12], [247, 3, 0, 12], [29, 0, 0, 12], [29, 1, 0, 12]] }],
      [1.0, { name: 'badlands', clump: 0.5, singles: 0.5, pools: -1, deco: 0.8, bush: 0.4, flowers: 0.3, rocks: 2.4, extraN: [5, 9], extra: [[245, 1, 1], [245, 0, 1], [30, 1, 1], [245, 1, 1], [245, 3, 1]] }],
      [1.0, { name: 'oasis valley', clump: 1.3, singles: 1.4, pools: 2, oasisPlus: 1, deco: 0.9, bush: 1.4, flowers: 1.3, rocks: 0.4, extraN: [2, 4], extra: [[28, 2, 1], [28, 1, 1]] }],
      [0.9, { name: 'bone flats', clump: 0.4, singles: 0.5, pools: -1, deco: 1.4, bush: 0.5, flowers: 0.3, rocks: 0.6, extraN: [5, 9], extra: [[248, 0, 1], [29, 0, 0, 12], [29, 1, 0, 12], [245, 1, 1], [29, 0, 0, 12]] }],
      [0.8, { name: 'ruins', clump: 0.6, singles: 0.7, pools: 0, deco: 1, bush: 0.6, flowers: 0.5, rocks: 0.6, extraN: [4, 8], extra: [[247, 2, 1], [247, 4, 1], [247, 5, 1], [247, 6, 1], [255, 1, 1], [247, 3, 0, 12]] }],
    ], grassRim: ['rgba(90,120,40,0.35)', '#c8d880'], sandRim: ['rgba(160,110,40,0.3)', '#f0d898'], waterRim: ['rgba(150,120,60,0.45)', 'rgba(255,255,255,0.55)'] },
];
const GEN_SIZE = { W: 64, H: 46 };
const GEN_NAMES = [
  ['Meadow Road', 'Old Orchard', 'Stream Hollow', "Hunter's Clearing", 'Wild Edge', 'Riverbend Glade', 'Willow Lake',
    'Old Forest Crossing', 'Sunny Hills', 'Fox Meadow', 'Pinewood Trail', 'Mossy Ford', 'Bramble Path', 'Lark Field'],
  ['Dusk Woods', 'Lantern Thicket', 'Fallen Shrine', 'Owl Hollow', 'Mistwood', 'Gloam Path', 'Witchlight Glade',
    'Moonfern Dell', 'Crow\'s Rest', 'Shadowpine', 'Twilight Ford', 'Elder Grove', 'Whisper Trail', 'Thornwood'],
  ['Cloud Road', 'Windmill Rise', 'Sky Steps', 'Rainbow Gorge', 'Mist Pass', 'Puffball Fields', 'Silver Lining',
    'Cirrus Hollow', 'Sunlit Gate', 'Gale Run', 'Stratus Deep', 'Dewdrop Springs', 'Feather Path', 'Heavens Basin'],
  ['Frost Gate', 'Glacier Path', 'Rime Woods', 'Frozen Lake', 'Whiteout Pass', 'Crystal Grotto', 'Snowbell Field',
    'Icefang Ridge', 'Silent Drift', 'Shiverpine', 'Hoarfrost Hollow', 'Polar Ford', 'Glimmer Ice', 'Frostbite Trail'],
  ['Sunscorch Road', 'Dune Sea', 'Oasis Rest', 'Bone Flats', 'Mirage Hollow', 'Palm Ford', 'Sandstorm Pass',
    'Scorpion Hollow', 'Golden Steps', 'Dry Wells', 'Sunken Caravan', 'Ember Dunes', 'Glass Plain', 'Pilgrim Way'],
];
const GEN_KEYS = [[], [], [], [], []];
// SIDE AREAS: most areas on the road have a smaller area stacked above it (gentler monsters: the heights) and/or
// below it (deadlier ones: the depths), joined to it by a short wooden bridge — places off the road to explore
const SIDE_KEYS = [[], [], [], [], []], SIDE_MAPS = 8, SIDE = { up: 0.5, down: 0.5, maxH: 33, rankUp: -2, rankDown: 2 };
// every area rolls its own size and a type that shifts the mix: open meadow, dense woods, lake country, rocky
// ground or a flower field (in the ember and frost themes the same knobs give their own variety)
const AREA_TYPES = [
  [1.2, { name: 'meadow',  clump: 0.45, singles: 1.2, pools: 0, deco: 1.1, bush: 1, flowers: 1, rocks: 0.6 }],
  [1.0, { name: 'woods',   clump: 1.7,  singles: 1.6, pools: -1, deco: 0.8, bush: 0.6, flowers: 0.5, rocks: 0.8 }],
  [1.0, { name: 'lakes',   clump: 0.8,  singles: 0.8, pools: 2, deco: 0.9, bush: 0.8, flowers: 0.8, rocks: 0.5 }],
  [0.8, { name: 'rocky',   clump: 0.6,  singles: 0.6, pools: 0, deco: 0.8, bush: 0.5, flowers: 0.4, rocks: 2.6 }],
  [0.8, { name: 'flowers', clump: 0.5,  singles: 0.8, pools: 0, deco: 1, bush: 1.4, flowers: 2.6, rocks: 0.4 }],
];
const WG_LINES = { n: [2, 4], gap: 3 };
function buildGenArea(key, name, R, TH, size = null) {
  const W = size ? size.W : 50 + Math.floor(R() * 29), H = size ? size.H : 38 + Math.floor(R() * 15), M = blankMap(W, H, TH.ts, TH.base);
  const KINDS = TH.kinds || AREA_TYPES;   // (a theme can have its own kinds of area: the desert's dunes, badlands, oasis valleys…)
  const AT = (() => { let r = R() * KINDS.reduce((t, a) => t + a[0], 0); for (const a of KINDS) { r -= a[0]; if (r <= 0) return a[1]; } return KINDS[0][1]; })();
  M.name = name; M.gen = true; M.areaType = AT.name; M.sandTile = TH.path; M.poolTile = TH.pool; M.sandRim = TH.sandRim; M.waterRim = TH.waterRim; M.pathTint = TH.pathTint;
  const rnd = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1)), pickW = L => { let r = R() * L.reduce((t, d) => t + d[0], 0); for (const d of L) { r -= d[0]; if (r <= 0) return d; } return L[0]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setTile(M, x, y, TH.base);
  // the floor's other textures come in small soft clusters (one kind each), not scattered tile by tile — single
  // odd tiles read as a checkerboard
  if (TH.alt.length) for (let k = 0, n = Math.round(W * H * (TH.altP || 0) / 14); k < n; k++) {
    const t = TH.alt[ri(0, TH.alt.length - 1)], cx = R() * W, cy = R() * H, rx = 1.2 + R() * 1.8, ry = 0.9 + R() * 1.2;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (x >= 0 && y >= 0 && x < W && y < H && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) setTile(M, x, y, t);
  }
  // the walls of trees (or rock) along the top and bottom, of uneven depth
  const [bd0, bd1] = TH.bandDepth || [2.5, 6];
  const band = () => { const a = []; let v = rnd(bd0 + 0.5, (bd0 + bd1) / 2); for (let x = 0; x < W; x++) { v = Math.max(bd0, Math.min(bd1, v + (R() - 0.5) * 1.3)); a.push(v); } return a; };
  const topB = band(), botB = band(), inBand = (x, y) => y < topB[Math.max(0, Math.min(W - 1, Math.floor(x)))] || y >= H - botB[Math.max(0, Math.min(W - 1, Math.floor(x)))];
  // RS: the open ground kept clear for getting across (the old trail and clearings) — not painted any more, so the
  // areas are open country to wander; SH: painted ground (the pools' shores only); WS: the pools
  const SH = M.sandShapes = [], WS = M.waterShapes = [], RS = [];
  const inShape = (s, x, y, g = 0) => s[0] === 'rect' ? x >= s[1] - g && x <= s[3] + g && y >= s[2] - g && y <= s[4] + g : ((x - s[1]) / (s[3] + g)) ** 2 + ((y - s[2]) / (s[4] + g)) ** 2 <= 1;
  const inSand = (x, y, g = 0) => SH.some(s => inShape(s, x, y, g)) || RS.some(s => inShape(s, x, y, g)), inWater = (x, y, g = 0) => WS.some(s => inShape(s, x, y, g));
  // the main trail: west edge → a few waypoints → east edge, in straight legs with rounded corners
  const lo = Math.ceil(bd1) + 3, hi = H - Math.ceil(bd1) - 4, nWp = ri(3, 4);
  const pts = [[-1, rnd(lo + 3, hi - 3)]];
  for (let i = 1; i <= nWp; i++) pts.push([Math.round(i * W / (nWp + 1) + rnd(-4, 4)), Math.max(lo, Math.min(hi, pts[i - 1][1] + rnd(-12, 12)))]);
  pts.push([W + 1, Math.max(lo + 3, Math.min(hi - 3, pts[nWp][1] + rnd(-8, 8)))]);
  const leg = (x0, y0, x1, y1) => RS.push(['rect', Math.min(x0, x1) - 1.05, Math.min(y0, y1) - 1.05, Math.max(x0, x1) + 1.05, Math.max(y0, y1) + 1.05, 0.9]);   // a trail two tiles wide
  const legs = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], xm = Math.round((x0 + x1) / 2 + rnd(-3, 3));
    leg(x0, y0, xm, y0); leg(xm, y0, xm, y1); leg(xm, y1, x1, y1); legs.push([x0, y0, xm], [xm, y1, x1]);
  }
  // clearings on some waypoints, and side trails out to more of them
  const clear = [];
  for (let i = 1; i <= nWp; i++) if (R() < 0.5) { const [x, y] = pts[i], c = ['ellipse', x, y, rnd(3.2, 4.8), rnd(2.3, 3.2)]; RS.push(c); clear.push(c); }
  for (let k = 0, n = ri(1, 2); k < n; k++) {
    const [x, y] = pts[ri(1, nWp)], up = y > H / 2, ty = up ? Math.max(lo - 1, y - rnd(9, 13)) : Math.min(hi + 1, y + rnd(9, 13));
    if (Math.abs(ty - y) < 6) continue;
    leg(x, y, x, ty); const c = ['ellipse', x, ty, rnd(3, 4.2), rnd(2.2, 3)]; RS.push(c); clear.push(c);
  }
  // (the desert) an open clearing kept for a set piece (a ruin, a caravan's end: landmarks.js), off the walls
  if (TH.site && W >= 40) { const cx = rnd(14, W - 14), cy = (lo + hi) / 2 + rnd(-2, 2); RS.push(['rect', cx - 10.5, cy - 7, cx + 10.5, cy + 7, 2]); }
  // pools with soft shores, clear of the trails and the walls
  const pools = 0;   // no ponds in the Wilds any more (they read as odd blue holes with walls round them)
  for (let k = 0, tries = 0; k < pools && tries < 60; tries++) {
    const cx = rnd(8, W - 8), cy = rnd(lo, hi), rx = rnd(4, 7), ry = rnd(2.8, 4.5);
    const blob = [['ellipse', cx, cy, rx, ry], ['ellipse', cx + rnd(-rx, rx) * 0.6, cy + rnd(-1.5, 1.5), rx * rnd(0.5, 0.8), ry * rnd(0.6, 0.9)]];
    let ok = true;
    for (let y = cy - ry - 4; y <= cy + ry + 4 && ok; y += 0.5) for (let x = cx - rx - 4; x <= cx + rx + 4 && ok; x += 0.5)
      if (blob.some(s => inShape(s, x, y, 2.6)) && (inSand(x, y) || inBand(x, y) || x < 2 || x > W - 2)) ok = false;
    if (!ok) continue;
    for (const s of blob) { WS.push(s); SH.push([s[0], s[1], s[2], s[3] + 1.3, s[4] + 1.3]); }   // shore first, pool over it
    k++;
  }
  // OASES (the desert): a small pool ringed with green grass, palms round it (placed below, after the walls); kept off the
  // trails and the walls; lake country gets one more
  const oases = [];
  if (TH.oases) {
    M.grassShapes = [];   // (kept empty: it only marks the map as an oasis map for the mesas, plateaus.js)
    for (let k = 0, n = ri(TH.oases[0], TH.oases[1]) + (AT.pools > 0 ? 1 : 0) + (AT.oasisPlus || 0), tries = 0; k < n && tries < 80; tries++) {
      const cx = rnd(11, W - 11), cy = rnd(lo + 3, hi - 3), rx = rnd(3.4, 5), ry = rnd(2.4, 3.4), gx = rx + 2.4, gy = ry + 1.9;   // (big enough that its tile steps read as a rounded pond)
      let ok = true;
      for (let y = cy - gy - 1; y <= cy + gy + 1 && ok; y += 0.5) for (let x = cx - gx - 1; x <= cx + gx + 1 && ok; x += 0.5)
        if (((x - cx) / (gx + 1)) ** 2 + ((y - cy) / (gy + 1)) ** 2 <= 1 && (inSand(x, y) || inBand(x, y) || inWater(x, y, 2) || oases.some(o => Math.hypot(o[0] - x, o[1] - y) < 9))) ok = false;
      if (!ok) continue;
      WS.push(['ellipse', cx, cy, rx, ry]); oases.push([cx, cy, rx, ry, gx, gy]); k++;   // (no painted green ring: a smooth shape looked out of place; tufts below)
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inWater(x + 0.5, y + 0.5)) { if (TH.oases) (M.oasisCells = M.oasisCells || []).push(y * W + x); else setTile(M, x, y, TH.pool, 1); }   // (an oasis is laid from the desert's own pond tiles below)
    else if (inBand(x + 0.5, y + 0.5)) setSolid(M, x, y, 1);
  }
  if (M.oasisCells) { layPondTiles(M, M.oasisCells); M.oasisCells = null; }   // (the oases' tiles: layPondTiles)
  const used = new Set(), free = (x, y, g = 1) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && !used.has(x + ',' + y) && !M.solid[y * W + x] && !inSand(x + 0.5, y + 0.5, g) && !inWater(x + 0.5, y + 0.5, 1.5) && !inBand(x + 0.5, y + 0.5);
  const put = (o, x, y, solid, dy = 14) => { used.add(x + ',' + y); placeObj(M, o[0], o[1], x * WG_T + 8, y * WG_T + dy); if (solid) setSolid(M, x, y, 1); };
  // the walls: staggered rows, the bigger ones at the front
  for (let x = 0; x < W; x += 2) {
    for (let y = 1; y < topB[x]; y += 2) put(TH.band[y + 2 >= topB[x] ? 1 : 0], x + (y % 4 === 1 ? 0 : 1), y, false);
    for (let y = H - 1; y >= H - botB[x]; y -= 2) put(TH.band[y <= H - botB[x] + 1 ? 1 : 0], x + (y % 4 === 1 ? 0 : 1), y, false);
  }
  // round each oasis: the desert's own dry-grass tufts on the tiles of its shore (overlays, walked over), then palms and a shrub
  for (const [cx, cy, rx, ry, gx, gy] of oases) for (let y = Math.floor(cy - gy); y <= cy + gy; y++) for (let x = Math.floor(cx - gx); x <= cx + gx; x++) {
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || M.solid[y * W + x] || (M.overlay[y * W + x] & 0xff)) continue;
    const e = ((x + 0.5 - cx) / gx) ** 2 + ((y + 0.5 - cy) / gy) ** 2; if (e > 1 || R() > 0.55 * (1.2 - e)) continue;
    M.overlay[y * W + x] = (R() < 0.5 ? 17 : 18) + 1;   // (palms may still stand on a tufted tile)
  }
  for (const [cx, cy, rx, ry] of oases) for (let k = 0, n = ri(4, 7); k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd(-0.3, 0.3), x = Math.round(cx + Math.cos(a) * (rx + 1.4)), y = Math.round(cy + Math.sin(a) * (ry + 1.1));
    if (free(x, y, 0)) put(R() < 0.75 ? [28, 1] : [28, 2], x, y, true);
  }
  // clumps in the open
  const area = W * H / (64 * 46);   // bigger areas get proportionally more of everything
  for (let k = 0, n = Math.round(ri(TH.clumps[0], TH.clumps[1]) * AT.clump * area), tries = 0; k < n && tries < 400; tries++) {
    const cx = ri(3, W - 4), cy = ri(lo - 2, hi + 2); if (!free(cx, cy, 2)) continue;
    for (let j = 0, m = ri(2, 8); j < m; j++) { const x = cx + ri(-2, 2), y = cy + ri(-2, 2); if (free(x, y, 1.5)) put(TH.clump[ri(0, TH.clump.length - 1)], x, y, true); }
    k++;
  }
  for (let k = 0, n = Math.round(ri(4, 12) * AT.singles * area), tries = 0; k < n && tries < 200; tries++) {   // lone trees here and there
    const x = ri(2, W - 3), y = ri(lo - 2, hi + 2); if (!free(x, y, 1.5)) continue;
    put(TH.clump[ri(0, TH.clump.length - 1)], x, y, true); k++;
  }
  // bushes in little clusters (not rows: with no trails to line, a straight row looked placed by hand)
  for (let k = 0, n = Math.round(ri(TH.hedges[0], TH.hedges[1]) * AT.bush * area * 1.4), tries = 0; k < n && tries < 220; tries++) {
    const cx = ri(3, W - 4), cy = ri(lo - 2, hi + 2); if (!free(cx, cy, 1)) continue;
    let placed = 0;
    for (let j = 0, m = ri(2, 5); j < m; j++) { const x = cx + ri(-1, 1), y = cy + ri(-1, 1); if (free(x, y, 0.6)) { put(R() < 0.3 ? TH.hedgeAlt : TH.hedge, x, y, true); placed++; } }
    if (placed >= 2) k++;
  }
  // flowers and rocks in patches too (the theme's first two detail kinds are its small flowers / snow bits / brush)
  const smalls = TH.deco.filter(d => d[1] === 'obj' && !d[5]), solids = TH.deco.filter(d => d[5] || d[1] === 'ovl');
  for (let k = 0, n = Math.round(ri(3, 6) * AT.flowers * area), tries = 0; k < n && tries < 200; tries++) {
    const cx = ri(2, W - 3), cy = ri(lo - 2, hi + 2); if (!free(cx, cy, 0.5) || !smalls.length) continue;
    const d = smalls[ri(0, smalls.length - 1)];
    for (let j = 0, m = ri(4, 9); j < m; j++) { const x = cx + ri(-2, 2), y = cy + ri(-1, 1); if (free(x, y, 0.3)) put([d[2], ri(d[3], d[4])], x, y, false, d[6]); }
    k++;
  }
  for (let k = 0, n = Math.round(ri(2, 5) * AT.rocks * area), tries = 0; k < n && tries < 200; tries++) {
    const cx = ri(2, W - 3), cy = ri(lo - 2, hi + 2); if (!free(cx, cy, 0.8) || !solids.length) continue;
    for (let j = 0, m = ri(1, 4); j < m; j++) { const x = cx + ri(-1, 1), y = cy + ri(-1, 1); if (!free(x, y, 0.5)) continue;
      const d = solids[ri(0, solids.length - 1)];
      if (d[1] === 'ovl') { used.add(x + ',' + y); M.overlay[y * W + x] = d[2] + 1; } else put([d[2], ri(d[3], d[4])], x, y, true, d[6]); }
    k++;
  }
  // scattered detail
  for (let k = 0, n = Math.round(ri(TH.decoN[0], TH.decoN[1]) * AT.deco * area), tries = 0; k < n && tries < 400; tries++) {
    const x = ri(1, W - 2), y = ri(2, H - 3); if (!free(x, y, 0.3)) continue;
    const d = pickW(TH.deco);
    if (d[1] === 'ovl') { used.add(x + ',' + y); M.overlay[y * W + x] = d[2] + 1; }   // a mark painted on the tile: walk over it (as a wall it was invisible)
    else put([d[2], ri(d[3], d[4])], x, y, d[5], d[6]);
    k++;
  }
  // the kind's own scenery (the desert's mounds and bones, rock spires, broken pillars…), in little groups
  if (AT.extra) for (let k = 0, n = Math.round(ri(AT.extraN[0], AT.extraN[1]) * area), tries = 0; k < n && tries < 300; tries++) {
    const cx = ri(3, W - 4), cy = ri(lo - 2, hi + 2); if (!free(cx, cy, 1)) continue;
    for (let j = 0, m = ri(1, 3); j < m; j++) { const x = cx + ri(-2, 2), y = cy + ri(-1, 1), d = AT.extra[ri(0, AT.extra.length - 1)]; if (free(x, y, 0.6)) put([d[0], d[1]], x, y, !!d[2], d[3] || 14); }
    k++;
  }
  // lamps along the trail (the grove's lanterns)
  if (TH.lampP) for (let k = 0, n = Math.round(ri(3, 7) * area), tries = 0; k < n && tries < 120; tries++) {
    const x = ri(3, W - 4), y = ri(lo, hi); if (free(x, y, 0.5)) { put([6, 0], x, y, true, 2); k++; }
  }
  // more scenery where the theme has little: its own random stream, so the rest of the world keeps its layout
  if (TH.extra) {
    const X = seededRng([...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, WORLD_SEED)), xi = (a, b) => a + Math.floor(X() * (b - a + 1)), items = TH.extra.items, tot = items.reduce((t, d) => t + d[0], 0);
    for (let k = 0, n = Math.round(xi(TH.extra.n[0], TH.extra.n[1]) * area), tries = 0; k < n && tries < 400; tries++) {
      const cx = xi(3, W - 4), cy = xi(lo - 2, hi + 2); if (!free(cx, cy, 1)) continue;
      for (let j = 0, m = xi(1, 4); j < m; j++) { const x = cx + xi(-2, 2), y = cy + xi(-2, 2); if (!free(x, y, 0.8)) continue; let r = X() * tot, d = items[0]; for (const it of items) { r -= it[0]; if (r <= 0) { d = it; break; } } put([d[1], d[2]], x, y, d[3], d[4]); }
      k++;
    }
  }
  // A CAMP (TH.tents: the chance an area has one): a tent off the trail with room round it and its door clear, for the tent
  // folk (tentfolk.js) to live in. The desert's are dyed sand cloth (desert.js). Its own stream, so the area keeps its layout.
  if (TH.tents && !size) {   // (road areas only)
    const X = seededRng([...key].reduce((h, c) => (h * 41 + c.charCodeAt(0)) >>> 0, WORLD_SEED ^ 0x7e47)), xi = (a, b) => a + Math.floor(X() * (b - a + 1));
    if (X() < TH.tents) for (let tries = 0; tries < 160; tries++) {
      const x = xi(4, W - 5), y = xi(lo, hi + 1); let ok = free(x, y + 1, 1);
      for (let dy = -4; dy <= 0 && ok; dy++) for (let dx = -3; dx <= 3; dx++) if (!free(x + dx, y + dy, 0.6)) { ok = false; break; }
      if (!ok) continue;
      const tf = objFrame(5, 0), bx = x * WG_T + 8, by = y * WG_T + 14, box = [bx - tf[2] / 2 - 6, by - tf[3] - 6, bx + tf[2] / 2 + 6, by + 30];   // (no other picture over the tent or the yard before its door)
      if (M.objA.concat(M.objB).some(([b, fi, ox, oy]) => { const f = objFrame(b, fi); return f && ox + f[4] < box[2] && ox + f[4] + f[2] > box[0] && oy + f[5] < box[3] && oy + f[5] + f[3] > box[1]; })) continue;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) used.add((x + dx) + ',' + (y + dy));   // (and the yard below: a tree there would stand over the door)
      placeObj(M, 5, 0, x * WG_T + 8, y * WG_T + 14);
      for (let dy = -3; dy <= 0; dy++) for (let dx = -2; dx <= 2; dx++) setSolid(M, x + dx, y + dy, 1);
      break;
    }
  }
  // lines of trees (or rock) across the open ground, so an area is a route that bends and not one wide field. They never
  // cross a trail (free() keeps those clear), so the way through stays open. Their own stream again.
  if (!size) {
    const X = seededRng([...key].reduce((h, c) => (h * 37 + c.charCodeAt(0)) >>> 0, WORLD_SEED ^ 0x7A11)), xi = (a, b) => a + Math.floor(X() * (b - a + 1)), n = Math.round(xi(WG_LINES.n[0], WG_LINES.n[1]) * area);
    for (let k = 1; k <= n; k++) {
      let x = Math.round(k * W / (n + 1)) + xi(-4, 4); const down = X() < 0.5, ys = [], gap = xi(lo + 3, hi - 3);
      for (let y = lo - 2; y <= hi + 2; y += 2) ys.push(y);
      if (down) ys.reverse();
      for (const y of ys) {
        x = Math.max(4, Math.min(W - 5, x + xi(-1, 1)));
        if (Math.abs(y - gap) < WG_LINES.gap) continue;   // and a gap of its own, somewhere along it
        for (const dx of [0, 1]) if (free(x + dx, y, 1.2)) put(TH.clump[xi(0, TH.clump.length - 1)], x + dx, y, true);
      }
    }
  }
  const sp = pts[Math.max(1, Math.floor(pts.length / 2) - 1)];
  M.spawn = [Math.round(sp[0]) * WG_T + 8, Math.round(sp[1]) * WG_T + 8];
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]]) { const i = (Math.round(sp[1]) + dy) * W + Math.round(sp[0]) + dx; if (!M.solid[i]) { M.spawn = [(Math.round(sp[0]) + dx) * WG_T + 8, (Math.round(sp[1]) + dy) * WG_T + 8]; break; } }
  floodReach(M, Math.floor(M.spawn[0] / WG_T), Math.floor(M.spawn[1] / WG_T));
  WG_MAPS[key] = M;
  return M;
}
{
  const R = seededRng((WORLD_SEED ^ 0x5eed) >>> 0);
  ZONE_THEMES.forEach((TH, z) => z < 4 && GEN_NAMES[z].forEach((name, i) => { const key = 'g' + z + 'abcdefghijklmn'[i]; buildGenArea(key, name, R, TH); GEN_KEYS[z].push(key); }));
  // the side areas stacked above and below the road (generateWilds): smaller maps of each zone's own kind
  ZONE_THEMES.forEach((TH, z) => { if (z >= 4) return; for (let i = 0; i < SIDE_MAPS; i++) { const key = 'g' + z + 's' + i; buildGenArea(key, GEN_NAMES[z][i % GEN_NAMES[z].length], R, TH, { W: 34 + Math.floor(R() * 12), H: 24 + Math.floor(R() * 9) }); SIDE_KEYS[z].push(key); } });
  // the desert (zone 4) and its side areas on a stream of their own, after the rest (a world made before it keeps its layout)
  { const RD = seededRng((WORLD_SEED ^ 0xde5e7) >>> 0), TH = ZONE_THEMES[4];
    GEN_NAMES[4].forEach((name, i) => { const key = 'g4' + 'abcdefghijklmn'[i]; buildGenArea(key, name, RD, TH); GEN_KEYS[4].push(key); });
    for (let i = 0; i < SIDE_MAPS; i++) { const key = 'g4s' + i; buildGenArea(key, GEN_NAMES[4][i % GEN_NAMES[4].length], RD, TH, { W: 34 + Math.floor(RD() * 12), H: 22 + Math.floor(RD() * 11) }); SIDE_KEYS[4].push(key); } }
}
// GODDESS TOWNS (2026-11-19, the user: "remake every zone 5 into a safe little zone for the goddess, no monster in zone 5 make it into
// a small little town to repair gear and buy food etc but the main goal of the town is the goddess"; chose area 5 only, a small built
// village, and the waystone kept in town). The 5th area of every zone (counted from Hearthvale, where the first goddess stop is,
// travelpoints.js) is one of these maps instead of a wild area: a compact area of the zone's own ground, its tree walls at top and
// bottom, and in the middle a village: the goddess on a round plaza (travelpoints.js puts her at GT.g, the waystone at GT.w), a Smith
// (repair: the shop's REPAIR tab) and a Grocer (food) facing the plaza from the north, two houses beside them, lamps at the plaza's
// corners, flowers. The way through runs west to east across the plaza. No monsters: the goddess's sanctuary covers the whole area
// (goddess.js). goddesstown.js puts the shopkeepers at their doors.
const GTOWN = { W: 52, H: 36, names: ['Haru', 'Aki', 'Tsuki', 'Sora', 'Hikari'],
  shops: [{ id: 'smith', bank: 13, fi: 10, dx: -6, npc: '104', label: 'Smith', role: 'shop_gear', sym: '⚒' }, { id: 'grocer', bank: 13, fi: 14, dx: 6, npc: '116', label: 'Grocer', role: 'shop_item', sym: '⚗' }],
  houses: [[13, 2, -16], [13, 5, 16]], own: new Set([13, 6, 66]) };
const GTOWN_KEYS = [], isGoddessTown = R => !!(R && (WG_MAPS[R.map] || {}).goddessTown);   // (sites, crates and landmarks keep out of them)
function buildGoddessTown(z, R) {
  const TH = ZONE_THEMES[z], key = 'gv' + z, M = buildGenArea(key, `${GTOWN.names[z]}'s Haven`, R, TH, { W: GTOWN.W, H: GTOWN.H });
  const W = M.w, H = M.h, cx = Math.floor(W / 2), cy = Math.floor(H / 2) + 2, T = WG_T, floor = v => (v & 0xff) - 1;
  const base = new Set([TH.base, ...(TH.alt || [])]);
  // clear the village ground: every object standing in it goes, and plain floor under them walks again
  const box = [cx - 21, cy - 9, cx + 21, cy + 5], inBox = (x, y) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
  const road = (x, y) => y >= cy - 1 && y <= cy + 1;   // (and the way through, edge to edge)
  const keep = o => { const f = objFrame(o[0], o[1]); if (!f) return true; const x0 = Math.floor((o[2] + f[4]) / T), x1 = Math.floor((o[2] + f[4] + f[2] - 1) / T), y0 = Math.floor((o[3] + f[5]) / T), y1 = Math.floor((o[3] + f[5] + f[3] - 1) / T);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inBox(x, y) || road(x, y)) return false; return true; };
  M.objA = M.objA.filter(keep); M.objB = M.objB.filter(keep);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((inBox(x, y) || road(x, y)) && M.solid[y * W + x] && base.has(floor(M.ground[y * W + x]))) { setSolid(M, x, y, 0); M.overlay[y * W + x] = 0; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inBox(x, y) || road(x, y)) M.overlay[y * W + x] = 0;
  // the ground: a sandy plaza, the street through it, and a step to each door
  const SH = M.sandShapes = M.sandShapes || [];
  SH.push(['ellipse', cx + 0.5, cy + 0.5, 8.5, 4.2], ['rect', -1, cy - 0.9, W + 1, cy + 1.9, 0.9]);
  // buildings: their bottom line on the row above the plaza, the door in the middle of the front, the lower body solid
  const bline = cy - 4;
  const building = (b, fi, bx) => {
    placeObj(M, b, fi, bx * T + 8, bline * T);
    const f = objFrame(b, fi), wT = Math.round(f[2] / T), hT = Math.min(4, Math.round(f[3] * 0.55 / T));
    for (let y = bline - hT; y < bline; y++) for (let x = bx - Math.floor(wT / 2); x <= bx + Math.floor((wT - 1) / 2); x++) setSolid(M, x, y, 1);
    SH.push(['rect', bx - 1.1, bline - 0.6, bx + 2.1, cy - 0.5, 0.9]);
  };
  for (const S of GTOWN.shops) building(S.bank, S.fi, cx + S.dx);
  for (const [b, fi, dx] of GTOWN.houses) building(b, fi, cx + dx);
  // lamps at the plaza's corners, flowers along its south rim
  for (const [dx, dy] of [[-10, -2], [10, -2], [-10, 3], [10, 3]]) { placeObj(M, 6, 0, (cx + dx) * T + 8, (cy + dy) * T + 14); setSolid(M, cx + dx, cy + dy, 1); }
  for (let dx = -6; dx <= 6; dx += 3) if (Math.abs(dx) > 1) placeObj(M, 66, Math.abs(dx) % 4, (cx + dx) * T + 8, (cy + 4) * T + 12);
  M.goddessTown = { z, box, road: [cy - 1, cy + 1], g: [cx, cy - 1], w: [cx - 4, cy + 1], shops: GTOWN.shops.map(S => ({ ...S, bx: cx + S.dx, by: bline })) };
  M.spawn = [cx * T + 8, (cy + 1) * T + 8];
  M.goddessTown.solidKeep = new Set(); for (let i = 0; i < W * H; i++) { const x = i % W, y = (i - x) / W; if (M.solid[i] && x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]) M.goddessTown.solidKeep.add(i); }
  M.reach = new Array(W * H).fill(0); floodReach(M, cx, cy + 1);
  GTOWN_KEYS[z] = key;
  return M;
}
{ const R = seededRng((WORLD_SEED ^ 0x60dde5) >>> 0); for (let z = 0; z < 5; z++) buildGoddessTown(z, R); }
// SKYREACH ISLES: the fire lands turned into a kingdom in the clouds, in the game's own unused cloud art (tileset 209 and the map z3l, which no zone ever used).
// Each map keeps its shape: where you could walk becomes cloud, and all else opens onto the sky. The cloud's edges are learned from z3l itself: for every neighbourhood of
// land and sky there, what tile it has, so the puffs, corners and drips hanging off the edges are the ones its artist laid. Objects give way to its trees, flowers and windmills.
const ISLES = { ts: 209, src: 'z3l', cell: 4, gaps: 0.2, open: new Set([1, 14, 74, 94]), keep: new Set([3, 13, 17, 26, 42, 54]) };
// the cloud art has straight edges, outer corners and inner corners and nothing else, so an island must be made of those: its shape is laid out on a coarse grid, as the islands of z3l are.
// Blocks that touch only at a corner are joined, since no tile draws that (the bit a blob autotile ignores).
function skyShape(M, r) {
  const c = ISLES.cell, W = M.w, H = M.h, CW = Math.ceil(W / c), CH = Math.ceil(H / c), G = new Uint8Array(CW * CH), at = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH ? G[y * CW + x] : 0;
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) { let n = 0; for (let y = cy * c; y < Math.min(H, (cy + 1) * c); y++) for (let x = cx * c; x < Math.min(W, (cx + 1) * c); x++) { const i = y * W + x; if (!M.solid[i] && (!M.reach || M.reach[i])) n++; } if (n >= c * c * 0.35) G[cy * CW + cx] = 1; }
  const sx = Math.min(CW - 1, Math.floor((M.spawn ? M.spawn[0] / WG_T : W / 2) / c)), sy = Math.min(CH - 1, Math.floor((M.spawn ? M.spawn[1] / WG_T : H / 2) / c)); G[sy * CW + sx] = 1;
  const flood = () => { const seen = new Uint8Array(CW * CH), st = [sy * CW + sx]; seen[st[0]] = 1; while (st.length) { const i = st.pop(), x = i % CW, y = (i - x) / CW; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (at(a, b) && !seen[b * CW + a]) { seen[b * CW + a] = 1; st.push(b * CW + a); } } } return seen; };
  const whole = () => { const s = flood(); for (let i = 0; i < G.length; i++) if (G[i] && !s[i]) return false; return true; };
  // every part joins the rest by a straight road of blocks
  for (let guard = 0; guard < 60; guard++) {
    const s = flood(); let lost = -1; for (let i = 0; i < G.length; i++) if (G[i] && !s[i]) { lost = i; break; } if (lost < 0) break;
    const lx = lost % CW, ly = (lost - lx) / CW; let best = null, bd = 1e9; for (let i = 0; i < G.length; i++) if (s[i]) { const x = i % CW, y = (i - x) / CW, d = Math.abs(x - lx) + Math.abs(y - ly); if (d < bd) { bd = d; best = [x, y]; } }
    for (let x = Math.min(lx, best[0]); x <= Math.max(lx, best[0]); x++) G[ly * CW + x] = 1; for (let y = Math.min(ly, best[1]); y <= Math.max(ly, best[1]); y++) G[y * CW + best[0]] = 1;
  }
  const corners = () => { let bad = false; for (let y = 0; y < CH - 1; y++) for (let x = 0; x < CW - 1; x++) { const a = at(x, y), b = at(x + 1, y), d = at(x, y + 1), e = at(x + 1, y + 1); if ((a && e && !b && !d) || (b && d && !a && !e)) bad = true; } return bad; };
  // the sky let in: whole blocks, wherever what is left stays joined and nothing meets at a bare corner
  const list = []; for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) if (at(x, y) && Math.abs(x - sx) + Math.abs(y - sy) > 2) list.push(y * CW + x);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
  let left = Math.round(list.length * ISLES.gaps); for (const i of list) { if (left <= 0) break; G[i] = 0; if (whole() && !corners()) left--; else G[i] = 1; }
  for (let guard = 0; guard < 80 && corners(); guard++) for (let y = 0; y < CH - 1; y++) for (let x = 0; x < CW - 1; x++) { const a = at(x, y), b = at(x + 1, y), d = at(x, y + 1), e = at(x + 1, y + 1); if (a && e && !b && !d) G[y * CW + x + 1] = 1; else if (b && d && !a && !e) G[y * CW + x] = 1; }
  const L = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = G[Math.floor(y / c) * CW + Math.floor(x / c)];
  return L;
}
// one tile of an island, laid as z3l lays them. On the land: 20 21 22 / 40 41 42 / 60 61 62, and 30 32 50 52 where the sky bites into a corner (NW NE SW SE).
// Round it, one tile out and solid: 80 and 82 down the sides, 90 91 92 along the foot, the rim 70 71 72 painted on the sky above (not the drips 100 101 102: they read as a waterfall).
// Where the land turns a corner round the sky: 110 and 111 painted on the sky, 112 and 113 at the foot.
function skyCell(at, x, y) {
  const n = at(x, y - 1), s = at(x, y + 1), e = at(x + 1, y), w = at(x - 1, y), ne = at(x + 1, y - 1), nw = at(x - 1, y - 1), se = at(x + 1, y + 1), sw = at(x - 1, y + 1);
  if (at(x, y)) { const t = !n ? (!w ? 20 : !e ? 22 : 21) : !s ? (!w ? 60 : !e ? 62 : 61) : !w ? 40 : !e ? 42 : !ne ? 32 : !nw ? 30 : !sw ? 50 : !se ? 52 : 41; return { t, o: -1, land: true, plain: t === 41 }; }
  if (w && s) return { t: 1, o: 110 }; if (e && s) return { t: 1, o: 111 }; if (w && n) return { t: 112, o: -1 }; if (e && n) return { t: 113, o: -1 };
  if (e) return { t: 80, o: -1 }; if (w) return { t: 82, o: -1 }; if (s) return { t: 1, o: 71 }; if (n) return { t: 91, o: -1 };
  if (se) return { t: 1, o: 70 }; if (sw) return { t: 1, o: 72 }; if (ne) return { t: 90, o: -1 }; if (nw) return { t: 92, o: -1 };
  return { t: 1, o: -1 };
}
// a half of the two-tile flower bush whose other half was laid over (a hedge, a crossing) becomes a whole small flower
function skyBushFix(M) { for (let i = 0; i < M.w * M.h; i++) { const x = i % M.w, o = M.overlay[i] - 1; if (o === 124 && (x + 1 >= M.w || M.overlay[i + 1] - 1 !== 125)) M.overlay[i] = 119 + 1; else if (o === 125 && (x < 1 || M.overlay[i - 1] - 1 !== 124)) M.overlay[i] = 123 + 1; } }
function skyify(key) {
  const M = WG_MAPS[key], town = /^o?town/.test(key), W = M.w, H = M.h, r = seededRng([...key].reduce((a, c) => a * 31 + c.charCodeAt(0), WORLD_SEED) >>> 0), inner = new Uint8Array(W * H), PLAIN = 41 + 1;
  const L = town ? new Uint8Array(W * H).fill(1) : skyShape(M, r), solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 1 || x >= W - 1 || y < 1 || y >= H - 2) L[y * W + x] = 0;   // room for the rim and the drips
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !!L[y * W + x];
  let bush = -1;   // the big flower bush is two tiles (124 125): its right half goes on the next cell
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = skyCell(at, x, y); let t = c.t, o = c.o;
    if (c.plain) { const v = r(); if (v < 0.05) t = 17; else if (v < 0.075) t = 19; else if (v < 0.095) { const k = Math.floor(r() * 7); o = k < 5 ? 119 + k : x + 1 < W && skyCell(at, x + 1, y).plain ? 124 : 119 + k - 5; } }   // cloud wisps and flowers, all walkable
    if (bush === i) o = 125; if (o === 124) bush = i + 1;
    M.ground[i] = (t + 1) | (c.land ? 0 : 1 << 8); M.overlay[i] = o + 1; solid[i] = c.land ? 0 : 1;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; let all = 1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (solid[i + dy * W + dx]) all = 0; inner[i] = all; }
  for (let i = 0; i < W * H; i++) if (!town || solid[i]) M.solid[i] = solid[i];
  M.tileset = ISLES.ts; M.filler = 0; if (!town) M.objA = [];
  // a town's street in the cloud art: the pale paving stones (its old ash tile, 29, is a checker in this sheet and showed brown under the ash tint)
  if (town && M.sandShapes) { M.sandTile = 97; M.sandRim = ['rgba(120,150,210,0.3)', '#ffffff']; M.pathTint = null; }
  const taken = new Set(), free = (tx, ty, rad) => { for (let y = ty - rad; y <= ty + rad; y++) for (let x = tx - rad; x <= tx + rad; x++) { if (x < 0 || y < 0 || x >= W || y >= H || !inner[y * W + x] || taken.has(y * W + x)) return false; } return true; };
  const put = (b, f, tx, ty) => { taken.add(ty * W + tx); return [b, f, tx * WG_T + 8, ty * WG_T + 14]; }, out = [];
  // (a goddess town keeps its own buildings, lamps and flowers: GTOWN.own)
  for (const o of M.objB) { if (town || ISLES.keep.has(o[0]) || (M.goddessTown && GTOWN.own.has(+o[0]))) { out.push(o); continue; } const tx = Math.floor(o[2] / WG_T), ty = Math.floor(o[3] / WG_T); if (o[0] === 248 && tx >= 0 && ty >= 0 && tx < W && ty < H && free(tx, ty, 1)) out.push(put(201, 1, tx, ty)); }
  if (!town && !/s\d/.test(key)) {   // (road areas only: a side area's camp would give its folk the wrong job area) A CAMP on the clouds (about 4 areas in 10): the plain tent, well inside an island with an open yard before its door. Its own stream, so the islands keep their layout.
    const X = seededRng([...key].reduce((h, c) => (h * 43 + c.charCodeAt(0)) >>> 0, WORLD_SEED ^ 0x5c4a)), xi = (a, b) => a + Math.floor(X() * (b - a + 1));
    if (X() < 0.4) for (let k = 0; k < 300; k++) {
      const tx = xi(5, W - 6), ty = xi(6, H - 7); if (!free(tx, ty - 2, 3) || !free(tx, ty + 3, 2)) continue;
      out.push(put(5, 0, tx, ty));
      for (let y = ty - 5; y <= ty + 5; y++) for (let x = tx - 4; x <= tx + 4; x++) taken.add(y * W + x);
      for (let y = ty - 3; y <= ty; y++) for (let x = tx - 2; x <= tx + 2; x++) M.solid[y * W + x] = 1;
      break;
    }
  }
  if (!town) {
    const area = inner.reduce((a, b) => a + b, 0), scatter = (n, f) => { for (let i = 0; i < n * 6 && n > 0; i++) { const tx = Math.floor(r() * W), ty = Math.floor(r() * H); if (free(tx, ty, 1)) { const q = f(); out.push(put(q[0], q[1], tx, ty)); n--; } } };
    scatter(Math.round(area / 110), () => [202, Math.floor(r() * 3)]); scatter(Math.round(area / 1500), () => [205, 0]); scatter(Math.round(area / 320), () => [201, 1]);
    for (let n = Math.round(area / 150), k = 0; k < n * 8 && n > 0; k++) {   // a short hedge, planter or fence, as in z3l
      const tx = 2 + Math.floor(r() * (W - 6)), ty = 2 + Math.floor(r() * (H - 4)); if (!free(tx, ty, 1) || !free(tx + 2, ty, 1)) continue; const o = 116 + Math.floor(r() * 3), len = 2 + Math.floor(r() * 2);
      for (let q = 0; q < len; q++) { const i = ty * W + tx + q; M.overlay[i] = o + 1; M.solid[i] = 1; taken.add(i); } n--;
    }
    if (area > 500) for (let k = 0; k < 400; k++) { const tx = 4 + Math.floor(r() * (W - 8)), ty = 5 + Math.floor(r() * (H - 8)); if (free(tx, ty, 3)) { out.push(put(k % 2 ? 296 : 58, 0, tx, ty)); break; } }
    const sky = (tx, ty) => { for (let y = ty - 2; y <= ty + 1; y++) for (let x = tx - 3; x <= tx + 3; x++) if (x >= 0 && y >= 0 && x < W && y < H && L[y * W + x]) return false; return true; }; let c = Math.round(W * H / 120);
    for (let k = 0; k < 300 && c > 0; k++) { const tx = Math.floor(r() * W), ty = Math.floor(r() * H); if (sky(tx, ty)) { out.push([49, Math.floor(r() * 4), tx * WG_T, ty * WG_T]); c--; } }
    for (let k = 0; k < 200; k++) { const tx = 4 + Math.floor(r() * (W - 8)), ty = 3 + Math.floor(r() * (H - 6)); if (sky(tx, ty)) { out.push([305, 0, tx * WG_T, ty * WG_T]); break; } }
  }
  skyBushFix(M); M.skyL = L; M.objB = out; let sx = Math.floor((M.spawn ? M.spawn[0] : 0) / WG_T), sy = Math.floor((M.spawn ? M.spawn[1] : 0) / WG_T);
  if (!inner[sy * W + sx] || M.solid[sy * W + sx]) { const i = inner.findIndex((v, q) => v && !M.solid[q]); sx = i % W; sy = (i - sx) / W; M.spawn = [sx * WG_T + 8, sy * WG_T + 8]; }   // (a spawn the clouds left in the sky)
  floodReach(M, sx, sy);
}
for (const k of Object.keys(WG_MAPS)) if (WG_MAPS[k].tileset === 8) skyify(k);
// a goddess town in the clouds: the cloud's own trees and windmills keep off its square and its street (skyify lays them after the village)
for (const k of GTOWN_KEYS) { const M = WG_MAPS[k]; if (!M || !M.skyL) continue; const G = M.goddessTown, [x0, y0, x1, y1] = G.box, W = M.w;
  const inV = (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1) || (y >= G.road[0] && y <= G.road[1]);
  const off = o => { if (GTOWN.own.has(+o[0])) return false; const f = objFrame(o[0], o[1]); if (!f) return false; const fx = Math.floor((o[2] + f[4] + f[2] / 2) / WG_T), fy = Math.floor((o[3] + f[5] + f[3] - 2) / WG_T); return inV(fx, fy); };
  M.objB = M.objB.filter(o => !off(o)); M.objA = (M.objA || []).filter(o => !off(o));
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (inV(x, y) && M.skyL[y * W + x] && !G.solidKeep.has(y * W + x)) setSolid(M, x, y, 0);
  floodReach(M, G.w[0], G.w[1]); }
// once the road is laid out: the crossings become part of the islands, so the cloud's edges turn into them with proper corners. The same map can come up twice along the road,
// each time with its crossings elsewhere, so each place gets its own copy.
function skyJoin(W2) {
  const regs = W2.regions, cells = new Set(), id = (x, y) => y * W2.w + x, sky = r => r && r.tileset === ISLES.ts;
  W2.bridges.forEach((bd, i) => { if (!bd || !(sky(regs[i]) || sky(regs[i + 1]))) return; for (let r = 0; r < (bd.h || 2); r++) for (let x = bd.x0; x <= bd.x1; x++) cells.add(id(x, bd.y + r)); });
  for (const r of regs) if (sky(r)) for (const u of r.subs || []) for (const [x, y] of u.path || []) cells.add(id(x, y));
  regs.forEach((r, n) => { if (!sky(r)) return; for (const q of [r, ...(r.subs || [])]) {
    const S = WG_MAPS[q.map]; if (!S || !S.skyL) continue; const key = `${q.map}@${n}`, M = Object.assign({}, S, { ground: S.ground.slice(), overlay: S.overlay.slice(), skyL: S.skyL.slice() }), W = M.w, H = M.h, L = M.skyL, touched = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cells.has(id(q.ox + x, q.oy + y)) && !L[y * W + x]) { L[y * W + x] = 1; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) touched.add((y + dy) * W + x + dx); }
    for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (cells.has(id(q.ox + (x ? W : -1), q.oy + y))) for (let dy = -3; dy <= 3; dy++) if (y + dy >= 0 && y + dy < H) touched.add((y + dy) * W + x);
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (cells.has(id(q.ox + x, q.oy + (y ? H : -1)))) for (let dx = -3; dx <= 3; dx++) if (x + dx >= 0 && x + dx < W) touched.add(y * W + x + dx);
    const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H ? !!L[y * W + x] : cells.has(id(q.ox + x, q.oy + y));
    for (const i of touched) { const x = i % W, y = (i - x) / W, c = skyCell(at, x, y); if (c.plain && !(M.ground[i] >> 8) && !((M.ground[i] & 0xff) - 1 >= 20 && (M.ground[i] & 0xff) - 1 <= 62 && (M.ground[i] & 0xff) - 1 !== 41 && (M.ground[i] & 0xff) - 1 !== 17 && (M.ground[i] & 0xff) - 1 !== 19)) continue; M.ground[i] = (c.t + 1) | (c.land ? 0 : 1 << 8); M.overlay[i] = c.o + 1; }
    skyBushFix(M); WG_MAPS[key] = M; q.map = key;
  } });
}
// the set pieces of the old fire lands, in the isles' own art (landmarks.js, sites.js)
const SKY_SWAP = { 272: [296, 0], 273: [58, 0], 293: [205, 0], 33: [201, 1], 247: [205, 0], 29: [202, 1], 47: [49, 0], 5: [201, 1], 246: [202, 0] };
// random area variants: a little extra flavour on top of the map itself
const AREA_VARIANTS = [
  { id: 'normal', w: 6 },
  { id: 'elite', w: 1.4, name: 'Elite Grounds', tag: 'stronger monsters roam here' },
  { id: 'swarm', w: 1.6, name: 'Swarming', tag: 'monsters gather in great numbers' },
  { id: 'treasure', w: 1.0, name: 'Treasure Trove', tag: 'hidden chests lie scattered about' },
  { id: 'calm', w: 1.2, name: 'Quiet Glade', tag: 'few monsters — a place to breathe' },
];
function generateWilds(seed) {
  const R0 = seededRng(seed), RD = seededRng((seed ^ 0xd35e7) >>> 0); let R = R0; const pick1 = a => a[Math.floor(R() * a.length)];   // (R: the stream in use; the desert's entries use RD, so a world made before the desert keeps its layout)
  // every zone: its generated areas, and (2026-11-13, the user: "zones still feel flat", chose both) a few of Zenonia's own hand-made
  // field maps of the same look, with their raised ledges, steps and mixed ground (the Sun Temple, z3m, still closes the far end)
  // (Zenonia's own field maps, ORIG_FIELDS, were mixed in here on 2026-11-13 and taken out the same day, the user: "EXTREMLY BAD tile
  // placement": they were cut from bigger worlds, so in the Wilds their cliffs stopped dead at the edges and the bridges landed in cliff
  // faces. The generated areas get the originals' look instead: fieldpatches.js.)
  // (2026-11-18, the user chose "whole Z2 maps": the Verdant Fields are Zenonia 2's own green field maps, uncut, in their own art,
  // joined by their own exits (z2links.js) instead of bridges. Z2V_ON false brings the generated areas back.)
  const pool = z => Z2V_ON && (Z2_ZONE_KEYS[z] || []).length ? Z2_ZONE_KEYS[z].slice() : GEN_KEYS[z].slice();
  // order: west (zone 3, ending at the Sun Temple) … east (zone 0), then the village
  const seq = [{ map: 'otown3', zone: -1, town: 4, key: 'town4' }, { map: 'z3m', zone: 4 }];   // (the Sun Temple closes the desert, the last zone)
  { const P = pool(4), out = []; let bag = [];   // the Sunscorch Desert, between the Frozen Abyss and the Sun Temple
    while (out.length < ZONE_LEN[4] - 1) {   // (the temple is its last stage)
      if (!bag.length) { bag = P.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(RD() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
      let k = bag.findIndex(m => m !== (out[out.length - 1] || {}).map); if (k < 0) k = 0;
      out.push({ map: bag.splice(k, 1)[0], zone: 4 });
    }
    out.splice(Math.floor(out.length / 2), 0, { map: 'otown4', zone: -1, town: 5, key: 'town5' });   // Mirage Springs, halfway along
    seq.push(...out); }
  for (let z = 3; z >= 0; z--) {
    if (z < 3) seq.push({ map: 'otown' + z, zone: -1, town: z + 1, key: 'town' + (z + 1) });   // the town at this zone's far end
    const P = pool(z), n = ZONE_LEN[z], out = [];
    let bag = [];
    while (out.length < n) {
      if (!bag.length) { bag = P.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
      let k = bag.findIndex(m => m !== (out[out.length - 1] || {}).map);
      if (k < 0) k = 0;
      out.push({ map: bag.splice(k, 1)[0], zone: z });
    }
    seq.push(...out);
  }
  seq.push({ map: 'vtown', zone: -1, key: 'town' });
  // each zone's 5th area from Hearthvale (journey order: zoneAreas) is its goddess town (GODDESS TOWNS, above)
  for (let z = 0; z < 5; z++) { if (!GTOWN_KEYS[z]) continue; const idx = seq.map((q, i) => q.zone === z && q.map !== 'z3m' ? i : -1).filter(i => i >= 0); let i = idx[idx.length - 5]; const nextToTown = j => [seq[j - 1], seq[j + 1]].some(q => q && q.town);   // (never right beside an outpost town: Hikari's Haven was, by Mirage Springs, 2026-11-19)
    for (let back = 6; i != null && nextToTown(i) && back <= idx.length; back++) i = idx[idx.length - back];
    if (i != null) seq[i] = { map: GTOWN_KEYS[z], zone: z, goddessTown: true }; }
  const SUB_GAP = 3, BAND = SIDE.maxH + SUB_GAP + 1, MH = Math.max(...seq.map(s => WG_MAPS[s.map].h)) + 2, H = MH + BAND * 2, GAP = 4;   // (BAND: the room above and below the road)
  const seen = {}, regs = [];
  let ox = 0;
  for (const s of seq) {
    R = s.zone === 4 || s.town === 5 ? RD : R0;   // (the desert's areas and its town draw from their own stream)
    const m = WG_MAPS[s.map];
    const occ = (seen[s.map] = (seen[s.map] || 0) + 1);
    const slack = MH - m.h;
    let oy = BAND + (s.zone < 0 ? Math.floor(slack / 2) : Math.floor(slack * (0.2 + R() * 0.6)));
    // the crossing needs a pair of rows where both this map and the previous one have open ground, and it should cut
    // as little as possible into either map (a long cut is a walkway over the map's own cliffs and water). Every
    // height is scored by its shortest crossing, plus a little for straying from the random pick; the best one wins.
    const prev = regs[regs.length - 1];
    if (prev) {
      const pr = edgeDist(prev.map, 'R'), cr = edgeDist(s.map, 'L');
      const cut = y0 => { let c = Infinity;
        for (let y = Math.max(prev.oy, y0) + 1; y < Math.min(prev.oy + prev.h, y0 + m.h) - 2; y++)
          c = Math.min(c, Math.max(pr[y - prev.oy], pr[y + 1 - prev.oy]) + Math.max(cr[y - y0], cr[y + 1 - y0]));
        return c; };
      let best = null, bc = Infinity;
      for (let y0 = BAND; y0 <= BAND + slack; y0++) { const c = cut(y0) * 4 + Math.abs(y0 - oy) * 0.3; if (c < bc) { bc = c; best = y0; } }
      if (best != null) oy = best;
    }
    // the empty band above or below a short map gets a second, smaller map of the same zone stacked into it
    // (joined to the main one by a short path); it stays clear of the river columns at both sides
    // The empty band above or below the map gets more land: a whole smaller map of the same zone when one fits
    // (otherwise it stays open water). It is joined to the main map by a short path and
    // stays clear of the river columns at both sides. (The main map keeps its height, so crossings still line up.)
    // the side areas: one above (the heights) and/or one below (the depths), clear of the river columns at both sides
    const subs = [];
    // every road area gets at least one (above or below, at random), often both
    const want = { up: R() < SIDE.up, down: R() < SIDE.down }; if (!want.up && !want.down) want[R() < 0.5 ? 'up' : 'down'] = true;
    if (s.zone >= 0 && s.map !== 'z3m' && !m.z2field) for (const below of [false, true]) {   // (a whole Zenonia 2 map has no side areas)
      if (!want[below ? 'down' : 'up']) continue;
      const C = SIDE_KEYS[s.zone].filter(k => WG_MAPS[k].w <= m.w - 6 && !subs.some(u => u.map === k)); if (!C.length) continue;
      const k = pick1(C), sm = WG_MAPS[k];
      const sy = below ? oy + m.h + SUB_GAP : oy - SUB_GAP - sm.h, sxo = 3 + Math.floor(R() * (m.w - sm.w - 6 + 1));
      if (sy < 1 || sy + sm.h > H - 1) continue;
      subs.push({ map: k, dx: sxo, oy: sy, w: sm.w, h: sm.h, tileset: sm.tileset, below });
    }
    let v = AREA_VARIANTS[0];
    if (s.zone >= 0 && s.map !== 'z3m') { let r = R() * AREA_VARIANTS.reduce((t, a) => t + a.w, 0); for (const a of AREA_VARIANTS) { r -= a.w; if (r <= 0) { v = a; break; } } }
    if (s.goddessTown) v = AREA_VARIANTS[0];   // (a goddess town is never a haunted or treasure area: the roll above still runs, so the rest of the world keeps its rolls)
    regs.push({ key: s.key || `${s.map}#${regs.length}`, map: s.map, town: s.town || 0, occ, zone: s.zone, ox, oy, w: m.w, h: m.h, tileset: m.tileset, filler: m.filler, variant: v.id, gen: !!m.gen,
      subs: subs.map(u => ({ ...u, ox: ox + u.dx })) });
    ox += m.w + GAP;
  }
  const W = ox - GAP;
  const solid = new Uint8Array(W * H).fill(1);
  for (const r of regs) {
    const m = WG_MAPS[r.map];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) solid[(r.oy + y) * W + r.ox + x] = m.solid[y * m.w + x];
    for (const u of r.subs) { const sm = WG_MAPS[u.map]; for (let y = 0; y < sm.h; y++) for (let x = 0; x < sm.w; x++) solid[(u.oy + y) * W + u.ox + x] = sm.solid[y * sm.w + x]; }
  }
  // join each stacked map to its main map: the column where both have open ground closest to the facing edges,
  // carved two tiles wide through the gap (the tiles carved are remembered so they can be painted as a path)
  const mreach = (key, x, y) => { const mm = WG_MAPS[key]; return x >= 0 && y >= 0 && x < mm.w && y < mm.h && mm.reach[y * mm.w + x]; };
  for (const r of regs) {
    r.subs = r.subs.filter(u => {
      let best = null;
      for (let gx = u.ox + 1; gx < u.ox + u.w - 2; gx++) {
        // distance to open ground in the main map (from its facing edge inward) and in the stacked map (up to 14
        // tiles: the twilight woods' tree walls run deep)
        let dm = null, ds = null;
        for (let k = 0; k < 14; k++) { const my = u.below ? r.h - 1 - k : k; if (mreach(r.map, gx - r.ox, my) && mreach(r.map, gx + 1 - r.ox, my)) { dm = k; break; } }
        for (let k = 0; k < 14; k++) { const sy = u.below ? k : u.h - 1 - k; if (mreach(u.map, gx - u.ox, sy) && mreach(u.map, gx + 1 - u.ox, sy)) { ds = k; break; } }
        if (dm == null || ds == null) continue;
        const cost = dm + ds + R() * 1.5;
        if (!best || cost < best.cost) best = { cost, gx, dm, ds };
      }
      if (!best) {   // could not join: take the map back out
        const sm = WG_MAPS[u.map]; for (let y = 0; y < sm.h; y++) for (let x = 0; x < sm.w; x++) solid[(u.oy + y) * W + u.ox + x] = 1;
        return false;
      }
      const y0 = u.below ? r.oy + r.h - 1 - best.dm : u.oy + u.h - 1 - best.ds, y1 = u.below ? u.oy + best.ds : r.oy + best.dm;
      u.path = []; u.src = [best.gx - r.ox, u.below ? r.h - 1 - best.dm : best.dm];   // the main map's ground tile there paints the path
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (const x of [best.gx, best.gx + 1]) { if (solid[y * W + x]) u.path.push([x, y]); solid[y * W + x] = 0; }
      return true;
    });
  }
  const reachAt = (r, x, y) => { const m = WG_MAPS[r.map]; return x >= 0 && y >= 0 && x < m.w && y < m.h && m.reach[y * m.w + x]; };
  const bridges = [], BRIDGE_ROWS = 4;
  // each crossing is BRIDGE_ROWS tiles tall (fewer only where the two maps share no taller open stretch)
  for (let i = 0; i + 1 < regs.length; i++) {
    const a = regs[i], b = regs[i + 1];
    if (WG_MAPS[a.map].z2field || WG_MAPS[b.map].z2field) { bridges.push(null); continue; }   // (joined by their own exits instead: z2links.js)
    let best = null;
    // the way on winds: crossings alternate between the upper and the lower part of the land the two maps share, so
    // walking straight west only finds the river — each area has to be crossed up or down to the next bridge
    const sy0 = Math.max(a.oy, b.oy) + 1, sy1 = Math.min(a.oy + a.h, b.oy + b.h) - 1;
    // a town's crossings land on its road (Hearthvale's where it always was; an outpost's on both its ends)
    // (Hearthvale's west road: rows 16-19; an original-map town may name its own way in on each side, M.roadW / M.roadE, ORIG_TOWNS crossW / crossE)
    // (a goddess town's street runs edge to edge too, buildGoddessTown: its bridges land on it, 2026-11-20 the user: "path doesnt connect to it")
    const townRoad = (r, side) => { if (r.key === 'town') return r.oy + 18; const m = WG_MAPS[r.map], gt = m && m.goddessTown; if (!r.town && !gt) return null; const rd = gt ? gt.road : m['road' + side] || m.road || OUTPOST.road; return r.oy + (rd[0] + rd[1] + 1) / 2; };
    const tw = townRoad(b, 'W') ?? townRoad(a, 'E');
    const want = tw != null ? tw : sy0 + (sy1 - sy0) * (i % 2 ? 0.18 + R() * 0.1 : 0.72 + R() * 0.1);
    for (let h = BRIDGE_ROWS; h >= 2 && !best; h--) {
      for (let y = sy0; y + h <= sy1; y++) {
        const xa = [], xb = [];   // per row: the last walkable column of the left map, the first of the right one
        for (let r = 0; r < h; r++) {
          let ea = null, eb = null;
          for (let x = a.w - 1; x >= 0; x--) if (reachAt(a, x, y + r - a.oy)) { ea = x; break; }
          for (let x = 0; x < b.w; x++) if (reachAt(b, x, y + r - b.oy)) { eb = x; break; }
          if (ea == null || eb == null) break;
          xa.push(a.ox + ea); xb.push(b.ox + eb);
        }
        if (xa.length < h) continue;
        const span = xa.reduce((t, x, r) => t + xb[r] - x, 0) / h;
        const cost = span * 4 + Math.abs(y + h / 2 - want) * (tw != null ? 8 : 1.6) + R() * 6;   // near the wanted height, a short cut through the banks
        if (!best || cost < best.cost) best = { cost, y, h, xa, xb };
      }
    }
    if (!best) {   // no shared walkable rows: carve a causeway
      const h = BRIDGE_ROWS, y = Math.floor(H / 2 - h / 2), xa = [], xb = [];
      for (let r = 0; r < h; r++) {
        let ea = a.w - 1, eb = 0;
        for (let x = a.w - 1; x >= 0; x--) if (reachAt(a, x, y + r - a.oy)) { ea = x; break; }
        for (let x = 0; x < b.w; x++) if (reachAt(b, x, y + r - b.oy)) { eb = x; break; }
        xa.push(a.ox + ea); xb.push(b.ox + eb);
      }
      best = { y, h, xa, xb };
    }
    const { y, h, xa, xb } = best;
    for (let r = 0; r < h; r++) for (let x = xa[r]; x <= xb[r]; x++) solid[(y + r) * W + x] = 0;
    bridges.push({ x0: Math.min(...xa), x1: Math.max(...xb), y, h });
  }
  // flood fill from the village so monsters only appear where the hero can walk
  const town = regs[regs.length - 1], s0 = WG_MAPS.vtown.spawn;
  const reach = new Uint8Array(W * H), st = [(town.oy + (s0[1] >> 4)) * W + town.ox + (s0[0] >> 4)];
  reach[st[0]] = 1;
  while (st.length) {
    const c = st.pop(), x = c % W, y = (c - x) / W;
    if (x + 1 < W && !solid[c + 1] && !reach[c + 1]) { reach[c + 1] = 1; st.push(c + 1); }
    if (x > 0 && !solid[c - 1] && !reach[c - 1]) { reach[c - 1] = 1; st.push(c - 1); }
    if (y + 1 < H && !solid[c + W] && !reach[c + W]) { reach[c + W] = 1; st.push(c + W); }
    if (y > 0 && !solid[c - W] && !reach[c - W]) { reach[c - W] = 1; st.push(c - W); }
  }
  for (const r of regs) { const m = WG_MAPS[r.map]; if (m.z2field) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.reach[y * m.w + x]) reach[(r.oy + y) * W + r.ox + x] = 1; }   // (a whole Zenonia 2 map is reached through its exits, not by walking)
  for (const r of regs) { const [sx, sy] = WG_MAPS[r.map].spawn; r.spawn = [sx + r.ox * WG_T, sy + r.oy * WG_T]; }
  return { w: W, h: H, regions: regs, bridges, solid, reach, seed };
}

buildVillageMap();
buildArenaMap();
