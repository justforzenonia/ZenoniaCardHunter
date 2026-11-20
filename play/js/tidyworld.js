'use strict';
// NOTHING HANGS OVER WATER OR A BRIDGE (2026-11-13, the user: "trees overlapping other tiles, make sure in all zones tiles aren't
// placed bad and nothing overlaps anything"). Many trees of the Wilds stood so their picture reached past their own ground: the pines
// on a map's first row, or along its left and right edge (edgeForest), had their crowns over the river or the sea beside the area,
// and some stood over the bridges and the paths up to the side areas. Once the overworld is built (makeOverworld), every standing
// object taller than TIDY.minH is checked against a grid of the Wilds marking water, bridge decks and side-area paths:
//   - it slides the shortest way (up to TIDY.max px, in TIDY.step px steps) until no part of its picture covers one of them, but
//     only onto ground that is already solid (a wall), so no path is ever blocked and no trunk stands in the open without collision;
//   - if no slide clears it, it is left out; one standing in the open takes its trunk's solid cells with it (no invisible wall),
//     never opening water; one inside a wall leaves the wall as it is.
// Clouds (049) and things drawn flat on the ground (decks, bridges) are left as they are. The grid is built once per world (a few
// hundred ms); the result is the same for every player in a room (it depends only on the world).
const TIDY = { minH: 20, max: 40, step: 4, skip: new Set(['049']), inset: 0.12, top: 0.2 };
let TIDY_GRID = null;
function tidyGrid() {
  if (TIDY_GRID && TIDY_GRID.seed === WORLD_SEED) return TIDY_GRID;
  const W = WILDS.w, H = WILDS.h, g = new Uint8Array(W * H);   // 1 water, 2 bridge / path
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (waterAtPx(tx * T + 8, ty * T + 8)) g[ty * W + tx] = 1;
  for (const b of WILDS.bridges) if (b) for (let ty = b.y - 1; ty <= b.y + bridgeRows(b); ty++) for (let tx = b.x0; tx <= b.x1; tx++) if (tx >= 0 && ty >= 0 && tx < W && ty < H) g[ty * W + tx] = 2;
  for (const R of REGIONS) for (const u of R.subs || []) for (const [x, y] of u.path || []) for (const dx of [-1, 0, 1]) if (x + dx >= 0 && x + dx < W && y >= 0 && y < H) g[y * W + x + dx] = 2;
  return (TIDY_GRID = { seed: WORLD_SEED, g, W, H });
}
// does the picture of o, moved by (dx, dy), cover water, a bridge or a path? (its outer edges and its top fifth may: leaves are thin there)
function tidyHits(G, o, r, dx, dy) {
  const x0 = o.x + dx + r[4] + r[2] * TIDY.inset, x1 = o.x + dx + r[4] + r[2] * (1 - TIDY.inset), y0 = o.y + dy + r[5] + r[3] * TIDY.top, y1 = o.y + dy + r[5] + r[3] - 2;
  for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
    if (tx < 0 || ty < 0 || tx >= G.W || ty >= G.H) return true;
    if (G.g[ty * G.W + tx]) return true;
  }
  return false;
}
// the grid, and the game's own wider checks for a bridge's landings (onRiverBridge) and the boardwalks up to side areas (overBoardwalk)
function tidyBad(G, o, r, dx, dy, walks) {
  if (tidyHits(G, o, r, dx, dy)) return true;
  if (onRiverBridge({ bank: o.bank, fi: o.fi, x: o.x + dx, y: o.y + dy })) return true;
  const ox0 = o.x + dx + r[4], ox1 = ox0 + r[2], oy0 = o.y + dy + r[5], oy1 = oy0 + r[3];   // (overBoardwalk's own boxes, worked out once)
  return walks.some(([px0, px1, py0, py1]) => ox0 < px1 && ox1 > px0 && oy0 < py1 && oy1 > py0);
}
function tidyOverlaps(w) {
  const subs = REGIONS.flatMap(R => R.subs || []).filter(u => u.path && u.path.length).map(u => { const xs = u.path.map(q => q[0]), ys = u.path.map(q => q[1]); return [Math.min(...xs) * T - 2, (Math.max(...xs) + 1) * T + 2, Math.min(...ys) * T - 8, (Math.max(...ys) + 1) * T + 4]; });
  const G = tidyGrid(), map = w.map, solidAt = (px, py) => { const tx = Math.floor(px / T), ty = Math.floor(py / T); return tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && !!map.solid[ty * map.w + tx]; };
  const shifts = []; for (let d = TIDY.step; d <= TIDY.max; d += TIDY.step) for (const [sx, sy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) shifts.push([sx * d, sy * d]);
  shifts.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  let moved = 0, gone = 0; const keep = [];
  const z2 = REGIONS.filter(R => (WG_MAPS[R.map] || {}).z2field || (typeof isGoddessTown === 'function' && isGoddessTown(R))).map(R => [R.ox * T, (R.ox + R.w) * T]);   // (a whole Zenonia 2 map is laid out as its makers drew it, a goddess town as worldgen.js built it: nothing moved)
  for (const o of w.objects) {
    if (z2.some(([a, b]) => o.x >= a && o.x < b)) { keep.push(o); continue; }
    if (o.ground || o.draw || TIDY.skip.has(o.bank) || o.hoard || o.chest) { keep.push(o); continue; }
    const r = objRec(o.bank, o.fi); if (!r || r[3] < TIDY.minH || !tidyBad(G, o, r, 0, 0, subs)) { keep.push(o); continue; }
    const s = shifts.find(([dx, dy]) => !tidyBad(G, o, r, dx, dy, subs) && solidAt(o.x + dx, (o.bottom ?? o.y) + dy - 4));
    if (s) {
      const [dx, dy] = s; o.x += dx; o.y += dy; if (o.bottom != null) o.bottom += dy; if (o.sortY != null) o.sortY += dy;
      if (o.box) { o.box.x += dx; o.box.y += dy; }
      moved++; keep.push(o); continue;
    }
    if (o.box) {   // a tree out in the open leaves no invisible wall (its trunk's cells open, never over water); one inside a wall leaves the wall
      const fx = Math.floor(o.x / T), fy = Math.floor(((o.bottom ?? o.y) - 4) / T);
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !solidAt((fx + dx) * T + 8, (fy + dy) * T + 8));
      if (open) for (let x = Math.floor((o.x - 20) / T); x <= Math.floor((o.x + 20) / T); x++) for (const ty of [fy, fy - 1]) {
        if (x < 0 || ty < 0 || x >= map.w || ty >= map.h || G.g[ty * G.W + x] === 1) continue;
        map.solid[ty * map.w + x] = 0; if (map.reach) map.reach[ty * map.w + x] = 1;
      }
    }
    gone++;
  }
  w.objects = keep; w.tidy = { moved, gone };
}
{
  const mo = makeOverworld;
  makeOverworld = (...a) => { const w = mo(...a); try { tidyOverlaps(w); } catch (e) { console.warn('tidyworld:', e); } return w; };
}
// LAMPS LOST IN THE TREES (2026-11-20, the user: "make sure nothing overlaps"): in the Dark Woods about one lamp post in three stood
// inside a pine's picture, its head poking out of the needles. A lamp whose picture a tree covers is left out (it lit nothing there);
// the cell its post stood on opens again when it stands in the open, so it leaves no invisible wall.
function tidyLamps(w) {
  const rl = objRec('006', 0); if (!rl) return 0;
  const trees = new Map(); for (const o of w.objects) if (o.bank === '001' && !o.ground) { const r = objRec(o.bank, o.fi); if (!r || r[3] < 40) continue; const c = Math.floor(o.x / 64); (trees.get(c) || trees.set(c, []).get(c)).push([o.x + r[4], o.y + r[5], r[2], r[3]]); }
  const map = w.map, solidAt = (tx, ty) => tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && !!map.solid[ty * map.w + tx];
  let gone = 0;
  w.objects = w.objects.filter(o => {
    if (o.bank !== '006' || o.fi !== 0 || o.tgLamp) return true;
    const lx = o.x + rl[4], ly = o.y + rl[5], c = Math.floor(o.x / 64);
    const hid = [c - 1, c, c + 1].some(k => (trees.get(k) || []).some(([tx, ty, tw, th]) => Math.min(lx + rl[2], tx + tw) - Math.max(lx, tx) > 4 && Math.min(ly + rl[3], ty + th) - Math.max(ly, ty) > 10));
    if (!hid) return true;
    const fx = Math.floor(o.x / T), fy = Math.floor(((o.bottom ?? o.y) - 4) / T);
    if (o.box && solidAt(fx, fy) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !solidAt(fx + dx, fy + dy)) && !waterAtPx(fx * T + 8, fy * T + 8)) { map.solid[fy * map.w + fx] = 0; if (map.reach) map.reach[fy * map.w + fx] = 1; }
    gone++; return false;
  });
  return gone;
}
{
  const mo = makeOverworld;
  makeOverworld = (...a) => { const w = mo(...a); try { w.tidyLamps = tidyLamps(w); } catch (e) { console.warn('tidyLamps:', e); } return w; };
}
