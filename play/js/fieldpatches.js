'use strict';
// GROUND LIKE THE ORIGINALS (2026-11-13, the user: "zones still feel flat", then "make sure it looks close to the original game", then
// "bad tile placement"). Zenonia's own field maps (z0, z1…) lay three grounds in tiles_1: light grass, a darker grass under trees and
// along the forest walls, and pale clearings of sand. After the plateaus are placed (plateaus.js), each generated map of the Verdant
// Fields and the Twilight Grove gets them too, laid in the tileset's own tiles:
//   1. SAND CLEARINGS  a few soft shapes (a big oval with one to three smaller ones overlapping it) on open grass, clear of the
//      plateaus, the trees and rocks, and the area's left and right edges.
//   2. DARK GRASS      a soft ring under about half the trees (they merge where trees stand together) and under the forest walls,
//      kept a cell away from the sand (the two sets were never drawn to meet).
//   3. THE LITTLE THINGS  overlay flowers, tufts, pebbles and mushrooms at the originals' own rates.
// HOW THE PIECES ARE CHOSEN: (a) by picture: the shape is sampled at each cell's 4x4 parts, and the cell takes the piece whose sand (or
// dark grass) lies in the same parts (measured once from assets/tiles_1.png). (b) by neighbour: every pair of pieces side by side or
// one above the other must be a pair Zenonia's own green maps use (read from z0, z0b … z1c when the game starts). A cell in a pair the
// originals never use takes its next-best piece that does fit its neighbours (plain sand or grass only when none does), again and
// again until every pair is one the originals use. (Choosing by picture alone left stray lips and corners that didn't join, the user's "bad tile placement".)
const FPATCH = { zones: { 0: [3, 5], 1: [1, 3] }, rx: [4, 10], ry: [3, 6], edge: 6, clearPlat: 2, grass: 0, tall: 20,
  sandIn: [[7, 85], [27, 7], [17, 5], [37, 1.5], [8, 1.5]], darkIn: [[30, 97], [40, 3]], sandFull: [7, 27, 17, 37, 8, 9], darkFull: [30, 40],
  tree: 30, treeP: 0.45, treeR: [2, 2.8], treeRy: [1.5, 2.1], wallR: 2.4,
  orig: ['z0', 'z0b', 'z0c', 'z0d', 'z0e', 'z1', 'z1b', 'z1c'],
  // the originals' scatter, counted on z0, z0b, z1, z1b away from walls: light grass 47 small flowers, 26 white flowers and pebbles,
  // 10 tufts; dark grass 26 and 179 mushrooms; sand 49 tufts, 37 pebbles, 28 dark spots, 27 dots (their rocks and stumps are left
  // out: painted on the floor, you would walk through them)
  bits: { l: [0.118, [[47, 7.3], [26, 2.3], [10, 2.2]]], d: [0.107, [[26, 8.5], [179, 2.2]]], s: [0.023, [[49, 0.5], [37, 0.9], [28, 0.4], [27, 0.5]]] } };
const FPATCH_SAND = {   // sand in each 4x4 part (tiles_1)
  0: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 7: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  1: [0, 0, 0.12, 0.69, 0.19, 0.5, 1, 1, 0.25, 1, 1, 1, 0.88, 1, 1, 1], 4: [0.69, 0.12, 0, 0, 1, 1, 0.5, 0.19, 1, 1, 1, 0.25, 1, 1, 1, 0.88],
  21: [0.88, 1, 1, 1, 0.25, 1, 1, 1, 0.19, 0.5, 1, 1, 0, 0, 0.12, 0.69], 24: [1, 1, 1, 0.88, 1, 1, 1, 0.25, 1, 1, 0.5, 0.19, 0.69, 0.12, 0, 0],
  5: [0, 0, 0.12, 0.69, 0, 0.12, 1, 1, 0, 0.12, 1, 1, 0, 0, 0.12, 0.69], 6: [0.69, 0.12, 0, 0, 1, 1, 0.12, 0, 1, 1, 0.12, 0, 0.69, 0.12, 0, 0],
  15: [0.69, 1, 1, 0.69, 0.12, 1, 1, 0.12, 0, 0.12, 0.12, 0, 0, 0, 0, 0], 16: [0, 0, 0, 0, 0, 0.12, 0.12, 0, 0.12, 1, 1, 0.12, 0.69, 1, 1, 0.69],
  2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.06, 0, 0.44, 0.62, 0.94, 0.94], 3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.62, 0.75, 0.69, 0.62],
  22: [0.62, 0.69, 0.75, 0.62, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 23: [0.94, 0.94, 0.62, 0.44, 0, 0.06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  11: [0, 0, 0, 0.62, 0, 0, 0, 0.75, 0, 0, 0, 0.69, 0, 0, 0, 0.62], 12: [0, 0, 0, 0.44, 0, 0, 0, 0.62, 0, 0, 0.06, 0.94, 0, 0, 0, 0.94],
  13: [0.44, 0, 0, 0, 0.62, 0, 0, 0, 0.94, 0.06, 0, 0, 0.94, 0, 0, 0], 14: [0.62, 0, 0, 0, 0.75, 0, 0, 0, 0.69, 0, 0, 0, 0.62, 0, 0, 0],
};
const FPATCH_DARK = {   // dark grass in each 4x4 part (tiles_1)
  0: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 30: [1, 1, 1, 1, 0.88, 1, 1, 1, 1, 1, 1, 1, 0.88, 1, 1, 1],
  31: [0.94, 0.88, 0.94, 0.31, 0.94, 0.75, 0.19, 0, 1, 0.31, 0, 0, 0.19, 0, 0, 0], 32: [1, 1, 1, 0.88, 1, 1, 1, 0.94, 1, 0.88, 1, 0.94, 0.44, 0.25, 0, 0.06],
  33: [1, 0.94, 1, 1, 1, 1, 0.94, 1, 0.88, 1, 0.94, 1, 0.38, 0.31, 0.31, 0.38], 34: [0.31, 0.94, 0.88, 0.94, 0, 0.19, 0.75, 0.94, 0, 0, 0.31, 1, 0, 0, 0, 0.19],
  35: [1, 0.88, 0.75, 0.31, 1, 0.81, 0, 0, 1, 0.81, 0, 0, 0.94, 0.94, 0.69, 0.25], 36: [0.31, 0.75, 0.88, 1, 0, 0, 0.81, 1, 0, 0, 0.81, 1, 0.25, 0.69, 0.94, 0.94],
  41: [1, 1, 1, 0.44, 1, 1, 0.94, 0.25, 1, 0.88, 1, 0.38, 1, 1, 1, 0.25], 42: [1, 1, 1, 0.44, 1, 1, 0.88, 0.19, 1, 1, 0.94, 0.06, 0.88, 1, 0.94, 0.06],
  43: [0.44, 1, 1, 1, 0.19, 0.88, 1, 1, 0.06, 0.94, 1, 1, 0.06, 0.94, 1, 0.88], 44: [0.44, 1, 1, 1, 0.25, 0.94, 1, 1, 0.38, 1, 0.88, 1, 0.25, 1, 1, 1],
  45: [0.25, 0, 0, 0.31, 0.69, 0, 0, 0.75, 0.94, 0.81, 0.81, 0.88, 0.94, 1, 1, 1], 46: [1, 1, 1, 0.94, 0.88, 0.81, 0.81, 0.94, 0.75, 0, 0, 0.69, 0.31, 0, 0, 0.25],
  51: [0.19, 0, 0, 0, 1, 0.31, 0, 0, 0.94, 0.75, 0.19, 0, 0.94, 0.88, 0.94, 0.31], 52: [0.38, 0.31, 0.31, 0.38, 1, 0.94, 1, 0.88, 1, 0.94, 1, 1, 1, 1, 0.94, 1],
  53: [0.06, 0, 0.25, 0.44, 0.94, 1, 0.88, 1, 0.94, 1, 1, 1, 0.88, 1, 1, 1], 54: [0, 0, 0, 0.19, 0, 0, 0.31, 1, 0, 0.19, 0.75, 0.94, 0.31, 0.94, 0.88, 0.94],
};
const N8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const fpatchMix = (mix, r) => { let x = r * mix.reduce((s, m) => s + m[1], 0); for (const [t, w] of mix) { x -= w; if (x <= 0) return t; } return mix[0][0]; };
// which pieces sit side by side ('h': a left of b) or one above the other ('v') in Zenonia's own green maps (all full sand counted as 7,
// dark grass 40 as 30); only pairs within one set count
function fpatchPairs(table, full, fullAs) {
  const set = new Set(Object.keys(table).map(Number)), norm = t => (full.includes(t) ? fullAs : t), h = new Set(), v = new Set();
  for (const k of FPATCH.orig) {
    const M = WG_MAPS[k]; if (!M || M.tileset !== 1) continue;
    const g = (x, y) => norm((M.ground[y * M.w + x] & 0xff) - 1);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      const a = g(x, y); if (!set.has(a)) continue;
      if (x + 1 < M.w) { const b = g(x + 1, y); if (set.has(b)) h.add(a * 1000 + b); }
      if (y + 1 < M.h) { const b = g(x, y + 1); if (set.has(b)) v.add(a * 1000 + b); }
    }
  }
  return { h, v };
}
const FPATCH_PAIRS = { sand: fpatchPairs(FPATCH_SAND, FPATCH.sandFull, 7), dark: fpatchPairs(FPATCH_DARK, FPATCH.darkFull, 30) };
function fpatchPick(table, want) {
  let best = 0, bd = Infinity;
  for (const t in table) { const c = table[t]; let d = 0; for (let i = 0; i < 16; i++) d += Math.abs(c[i] - want[i]); if (d < bd) { bd = d; best = +t; } }
  return best;
}
// a 4x-finer grid of the map: stamp ovals into it, then read each cell's 16 parts
function fpatchGrid(M) { return { W: M.w * 4, H: M.h * 4, a: new Uint8Array(M.w * 4 * M.h * 4) }; }
function fpatchOval(G, cx, cy, rx, ry) {
  for (let y = Math.max(0, Math.floor((cy - ry) * 4)); y <= Math.min(G.H - 1, Math.ceil((cy + ry) * 4)); y++)
    for (let x = Math.max(0, Math.floor((cx - rx) * 4)); x <= Math.min(G.W - 1, Math.ceil((cx + rx) * 4)); x++)
      if (((x + 0.5) / 4 - cx) ** 2 / (rx * rx) + ((y + 0.5) / 4 - cy) ** 2 / (ry * ry) <= 1) G.a[y * G.W + x] = 1;
}
function fpatchWant(G, x, y) { const w = []; for (let qy = 0; qy < 4; qy++) for (let qx = 0; qx < 4; qx++) w.push(G.a[(y * 4 + qy) * G.W + x * 4 + qx]); return w; }
// choose the pieces for the cells a shape touches ('allow': which cells may change), then make every neighbour pair one the originals use
function fpatchLay(G, M, set, table, fullAs, inside, allow, rnd) {
  const P = FPATCH_PAIRS[set], tile = new Map(), want = new Map(), wantQ = new Map();
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
    if (!allow(x, y)) continue; const w = fpatchWant(G, x, y), n = w.reduce((a, v) => a + v, 0); if (!n) continue;
    tile.set(y * M.w + x, fpatchPick(table, w)); want.set(y * M.w + x, n / 16); wantQ.set(y * M.w + x, w);
  }
  const at = i => (tile.has(i) ? tile.get(i) : 0);   // (cells left alone are plain grass for this set)
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const [i, t] of tile) {
      if (t === 0 || t === fullAs) continue;
      const x = i % M.w, y = (i - x) / M.w;
      const fits = c => (x === 0 || P.h.has(at(i - 1) * 1000 + c)) && (x === M.w - 1 || P.h.has(c * 1000 + at(i + 1))) && (y === 0 || P.v.has(at(i - M.w) * 1000 + c)) && (y === M.h - 1 || P.v.has(c * 1000 + at(i + M.w)));
      if (fits(t)) continue;
      // the next-best pieces by picture, the first whose four neighbour pairs the originals use; plain sand or grass only as a last resort
      const w = wantQ.get(i), order = Object.keys(table).map(Number).filter(c => c !== t).map(c => { let d = 0; for (let q = 0; q < 16; q++) d += Math.abs(table[c][q] - w[q]); return [c, d]; }).sort((a, b) => a[1] - b[1]);
      const alt = order.find(([c]) => c !== 0 && c !== fullAs && fits(c));
      tile.set(i, alt ? alt[0] : want.get(i) >= 0.5 ? fullAs : 0); changed = true;
    }
    if (!changed) break;
  }
  const out = [];
  for (const [i, t] of tile) { if (t === 0) continue; M.ground[i] = (M.ground[i] & 0xff00) | ((t === fullAs ? fpatchMix(inside, rnd()) : t) + 1); out.push(i); }
  return out;
}
function fieldPatches() {
  let s = (WORLD_SEED ^ 0x7a7c4) >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), rr = (a, b) => a + rnd() * (b - a);
  const done = new Set();
  for (const R of REGIONS.filter(r => r.zone >= 0 && FPATCH.zones[r.zone] && r.gen).sort((a, b) => b.ox - a.ox)) {
    // (not a goddess town: its painted plaza and street went over the patches' blocky sand and dark grass, 2026-11-20, the user: "town
    // flooring looks like its just overlapping something")
    const M = regMap(R); if (!M || M.tileset !== 1 || done.has(M) || M.goddessTown) continue; done.add(M);
    const plats = PLAT.list.filter(P => P.map === R.map).map(P => [P.x - R.ox, P.y - R.oy, P.w, P.h]);
    const base = (x, y) => x >= 0 && y >= 0 && x < M.w && y < M.h && (M.ground[y * M.w + x] & 0xff) - 1 === FPATCH.grass;
    const plain = (x, y) => { if (x < FPATCH.edge || y < 2 || x >= M.w - FPATCH.edge || y >= M.h - 2) return false; const i = y * M.w + x; return !!M.reach[i] && !M.solid[i] && base(x, y); };
    const nearPlat = (x, y, m = FPATCH.clearPlat) => plats.some(([px, py, pw, ph]) => x > px - m - 1 && x < px + pw + m && y > py - m - 1 && y < py + ph + m);
    const objs = (M.objB || []).map(o => { const r = objRec(String(o[0]).padStart(3, '0'), o[1]); return r ? { x: (o[2] + r[4] + r[2] / 2) / 16, y: (o[3] + r[5] + r[3] - 2) / 16, h: r[3] } : null; }).filter(Boolean);
    const objAt = new Set(objs.filter(o => o.h >= FPATCH.tall).map(o => `${Math.floor(o.x)},${Math.floor(o.y)}`));   // (where trees and rocks stand)
    // 1. SAND
    const S = fpatchGrid(M), ok = new Uint8Array(M.w * M.h);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) ok[y * M.w + x] = plain(x, y) && !nearPlat(x, y) && !objAt.has(`${x},${y}`) ? 1 : 0;
    const okAt = (x, y) => x >= 0 && y >= 0 && x < M.w && y < M.h && ok[y * M.w + x];
    const seeds = []; for (let y = 5; y < M.h - 5; y++) for (let x = FPATCH.edge + 4; x < M.w - FPATCH.edge - 4; x++) if (okAt(x, y)) seeds.push([x, y]);
    const [lo, hi] = FPATCH.zones[R.zone], want = lo + Math.floor(rnd() * (hi - lo + 1));
    for (let k = 0, tries = 0; k < want && tries < 200; tries++) {
      const c0 = seeds[Math.floor(rnd() * seeds.length)]; if (!c0) break;
      const cx = c0[0] + rnd(), cy = c0[1] + rnd(), rx0 = rr(...FPATCH.rx), ry0 = rr(...FPATCH.ry);
      const lobes = []; for (let j = 0, n = 1 + Math.floor(rnd() * 3); j < n; j++) lobes.push([rr(-1, 1) * 0.85, rr(-1, 1) * 0.75, rr(0.4, 0.7), rr(0.45, 0.8)]);
      for (const sc of [1, 0.8, 0.6]) {   // as big as fits: the same shape, smaller, until it clears the trees round it
        const rx = rx0 * sc, ry = ry0 * sc, B = [[cx, cy, rx, ry], ...lobes.map(([ox, oy, kx, ky]) => [cx + ox * rx, cy + oy * ry, rx * kx, ry * ky])];
        const T = fpatchGrid(M); for (const e of B) fpatchOval(T, ...e);
        const cells = []; for (let y = Math.max(0, Math.floor(cy - ry * 2) - 1); y <= Math.min(M.h - 1, cy + ry * 2 + 1); y++) for (let x = Math.max(0, Math.floor(cx - rx * 2) - 1); x <= Math.min(M.w - 1, cx + rx * 2 + 1); x++) if (fpatchWant(T, x, y).some(Boolean)) cells.push([x, y]);
        if (cells.length < 8 || !cells.every(([x, y]) => N8.concat([[0, 0]]).every(([dx, dy]) => okAt(x + dx, y + dy)))) continue;
        for (const e of B) fpatchOval(S, ...e);
        for (const [x, y] of cells) for (const [dx, dy] of N8.concat([[0, 0]])) ok[(y + dy) * M.w + x + dx] = 0;   // (the next clearing keeps a cell of grass between)
        k++; break;
      }
    }
    const sandCells = new Set(fpatchLay(S, M, 'sand', FPATCH_SAND, 7, FPATCH.sandIn, (x, y) => plain(x, y), rnd));
    // 2. DARK GRASS: under about half the trees, and under the forest walls; only on light grass, a cell away from any sand
    const Dg = fpatchGrid(M);
    for (const o of objs) if (o.h >= FPATCH.tree && !nearPlat(o.x, o.y, 0) && rnd() < FPATCH.treeP) fpatchOval(Dg, o.x + rr(-0.3, 0.3), o.y + rr(-0.2, 0.4), rr(...FPATCH.treeR), rr(...FPATCH.treeRy));
    for (let x = 0; x < M.w; x++) for (const dir of [1, -1]) {   // the walls: from each edge to the first open cell, and a soft lip past it
      let y = dir > 0 ? 0 : M.h - 1; while (y >= 0 && y < M.h && !M.reach[y * M.w + x]) y += dir;
      if (y >= 0 && y < M.h && Math.abs(y - (dir > 0 ? 0 : M.h - 1)) > 1) fpatchOval(Dg, x + 0.5, y + 0.5 - dir * 0.5, FPATCH.wallR, rr(1.1, 1.9));
    }
    const nearSand = (x, y) => N8.concat([[0, 0]]).some(([dx, dy]) => sandCells.has((y + dy) * M.w + x + dx));
    fpatchLay(Dg, M, 'dark', FPATCH_DARK, 30, FPATCH.darkIn, (x, y) => base(x, y) && !nearSand(x, y), rnd);
    // 3. the little things, on open cells of a whole ground (not beside rock, water or a wall), never over something already painted
    const kind = t => t === 0 ? 'l' : FPATCH.darkFull.includes(t) ? 'd' : FPATCH.sandFull.includes(t) ? 's' : null;
    for (let y = 1; y < M.h - 1; y++) for (let x = 1; x < M.w - 1; x++) {
      const i = y * M.w + x; if (M.solid[i] || (M.overlay[i] & 0xff) || !M.reach[i]) continue;
      if (M.solid[i - 1] || M.solid[i + 1] || M.solid[i - M.w] || M.solid[i + M.w]) continue;
      const k = kind((M.ground[i] & 0xff) - 1), B = k && FPATCH.bits[k]; if (!B || rnd() >= B[0]) continue;
      M.overlay[i] = fpatchMix(B[1], rnd()) + 1;
    }
  }
}
try { fieldPatches(); } catch (e) { console.warn('fieldpatches:', e); }
