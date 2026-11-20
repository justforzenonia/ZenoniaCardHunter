'use strict';
// HEARTHVALE'S GROUND LIKE THE ORIGINALS (2026-11-18, Hearthvale hand-built in the original towns' style): its grass was one flat
// tile. Like the Wilds' green areas (fieldpatches.js), it now gets the originals' little things (small flowers, pebbles, tufts) at
// the originals' rates, as single overlay tiles from tiles_1. Kept off the sand lanes and plaza (painted over
// the tiles: world.js paintSand), the farm plots, the terrace (worldgen.js HV_TERRACE) and anything solid. Seeded, so it is the
// same every visit. Runs at start-up, before the town's ground picture is first drawn.
function villageGrass() {
  const M = MAPS.vtown, V = VILLAGE; if (!M || M.tileset !== 1 || typeof fpatchLay !== 'function') return;
  let s = 0x5ea7a1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), rr = (a, b) => a + rnd() * (b - a);
  const SH = M.sandShapes || [], T0 = typeof HV_TERRACE !== 'undefined' ? HV_TERRACE : null;
  const sand = (x, y, m) => SH.some(q => q[0] === 'rect' ? x >= q[1] - m && x <= q[3] + m && y >= q[2] - m && y <= q[4] + m : ((x - q[1]) / (q[3] + m)) ** 2 + ((y - q[2]) / (q[4] + m)) ** 2 <= 1);
  const plot = (x, y) => V.plots.some(([px, py]) => x >= px - 1 && x <= px + 2 && y >= py - 1 && y <= py + 2);
  const terr = (x, y) => T0 && x >= T0.x - 1 && x <= T0.x + T0.w && y >= T0.y - 1 && y <= T0.y + T0.h;
  const base = (x, y) => x >= 0 && y >= 0 && x < M.w && y < M.h && (M.ground[y * M.w + x] & 0xff) - 1 === 0;
  const allow = (x, y) => base(x, y) && y < V.shoreY && !sand(x + 0.5, y + 0.5, 0.9) && !plot(x, y) && !terr(x, y);
  // (the originals' darker grass rings were tried here too, 2026-11-18: on Hearthvale's small tree patches the fitting left hard
  // straight sides (full dark tiles beside plain grass, a pair the originals allow but rarely show), which read as boxes. Left out.)
  // the little things, on open cells (not beside anything solid), never over something already laid
  const kind = t => t === 0 ? 'l' : null;
  for (let y = 1; y < V.shoreY; y++) for (let x = 1; x < M.w - 1; x++) {
    const i = y * M.w + x; if (M.solid[i] || (M.overlay[i] & 0xff) || !M.reach[i] || !allow(x, y)) continue;
    if (sand(x + 0.5, y + 0.5, 0.9) || plot(x, y) || terr(x, y)) continue;
    if (M.solid[i - 1] || M.solid[i + 1] || M.solid[i - M.w] || M.solid[i + M.w]) continue;
    const k = kind((M.ground[i] & 0xff) - 1), B = k && FPATCH.bits[k]; if (!B || rnd() >= B[0]) continue;
    M.overlay[i] = fpatchMix(B[1], rnd()) + 1;
  }
}
try { villageGrass(); } catch (e) { console.warn('villagegrass:', e); }
