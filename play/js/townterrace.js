'use strict';
// RAISED GROUND IN THE OTHER TOWNS (2026-11-18, the user: towns "closer to the original zenonia towns"; Mossbrook and Duskhollow are
// Zenonia's own maps, Hearthvale hand-built with a terrace). Cloudhold, Frostmere and Mirage Springs get one too: a raised garden in
// their own land's cliff pieces (plateaus.js PLAT_SETS: cloud stone, ice wall, sandstone), stamped with the Wilds' plateau stamp so the
// lip, sides, face, stairs and dressing are the tested ones. It goes on open ground north of the road, backed against the forest,
// where nothing stands (no lane, plot, pond, lamp or building); the strip south of the road is too shallow. Its rim and face are solid in the world grid.
// (deco: per tileset, the town's own trees on its terrace; the desert's foot dressing is giant bones, fine in the Wilds, odd in a town)
// (Cloudhold, town 2, left out on 2026-11-20: the cloud stone's top tiles are cut away with the sky, so its top showed patchy white: "missing white tiles on the hill")
const TTERR = { towns: [3, 4], size: { 209: [11, 6], 6: [11, 6], 3: [10, 6] }, deco: { 209: { pine: [[201, 0]], shrub: [[202, 0]], bloom: [[202, 1], [202, 0]] }, 3: { flowers: [[28, 2]] } }, margin: 1 };
function townTerraces() {
  for (const R of REGIONS.filter(r => r.town && TTERR.towns.includes(r.town - 1))) {
    const M = MAPS[R.map], S = M && PLAT_SETS[M.tileset]; if (!S) continue;
    const [w, h] = TTERR.size[M.tileset] || [12, 8], m = TTERR.margin, W = M.w;
    // what may not be covered: buildings, lamps, benches, wells, set pieces. Trees, rocks, flowers and ground dressing give way:
    // platStamp clears what stands in its spot, and the trunk tiles they made solid are reopened round it
    const KEEP = new Set([13, 7, 58, 46, 42, 6, 5, 41, 39, 264, 254, 28, 245, 255, 248]), occ = new Set(), soft = new Set();
    for (const o of M.objB.concat(M.objA || [])) { const f = objFrame(o[0], o[1]); if (!f) continue; const hard = KEEP.has(+o[0]);
      for (let y = Math.floor((o[3] + f[5]) / T); y <= Math.floor((o[3] + f[5] + f[3] - 1) / T); y++) for (let x = Math.floor((o[2] + f[4]) / T); x <= Math.floor((o[2] + f[4] + f[2] - 1) / T); x++) (hard ? occ : soft).add(x + ',' + y); }
    const SH = M.sandShapes || [], WS = M.waterShapes || [], V = outpostLayout(R.town - 1);
    const inShape = (L, x, y, g) => L.some(q => q[0] === 'rect' ? x >= q[1] - g && x <= q[3] + g && y >= q[2] - g && y <= q[4] + g : ((x - q[1]) / (q[3] + g)) ** 2 + ((y - q[2]) / (q[4] + g)) ** 2 <= 1);
    const plot = (x, y) => V.plots.some(([px, py]) => x >= px - 2 && x <= px + 3 && y >= py - 2 && y <= py + 3);
    const camp = (OUTPOST_CAMP[R.town - 1] || []).filter(Boolean);
    const softHere = (x, y) => soft.has(x + ',' + y) && !occ.has(x + ',' + y);
    const ok = (x, y) => x >= 3 && y >= 3 && x < W - 4 && y < M.h - 3 && (softHere(x, y) || (!M.solid[y * W + x] && M.reach[y * W + x]) || (M.solid[y * W + x] && (M.overlay[y * W + x] & 0xff) && M.reach[y * W + x - 1] !== undefined)) && !occ.has(x + ',' + y)
      && !inShape(SH, x + 0.5, y + 0.5, 0.8) && !inShape(WS, x + 0.5, y + 0.5, 1.5) && !plot(x, y) && !camp.some(([cx, cy]) => Math.abs(cx - x) <= 2 && Math.abs(cy - y) <= 2)
      && Math.hypot(x - V.well[0], y - V.well[1]) > 3 && Math.hypot(x - V.stone[0], y - V.stone[1]) > 3;
    let best = null;
    // north of the road, behind the houses, its back against the forest (no margin needed above it), open ground on its other sides
    for (let y0 = 3; y0 + h + m <= V.road[0] - 1; y0++) for (let x0 = 4; x0 + w + 4 < W; x0++) {
      let good = true; for (let y = y0; y < y0 + h + m && good; y++) for (let x = x0 - m; x < x0 + w + m; x++) if (!ok(x, y)) { good = false; break; }
      if (good) { const d = Math.abs(x0 + w / 2 - W / 2); if (!best || d < best.d) best = { x0, y0, d }; }
    }
    if (!best) continue;
    // clear the spot and its margin first: the stamp takes away objects standing in it, but the trunks' solid tiles round it stay
    for (let y = best.y0; y < best.y0 + h + m; y++) for (let x = best.x0 - m; x < best.x0 + w + m; x++) { const i = y * W + x; if (M.solid[i] && (softHere(x, y) || (M.overlay[i] & 0xff))) { M.solid[i] = 0; M.ground[i] &= 0xff; M.reach[i] = 1; const wi = (R.oy + y) * WILDS.w + R.ox + x; WILDS.solid[wi] = 0; if (WILDS.reach) WILDS.reach[wi] = 1; } M.overlay[i] = 0; }
    const px0 = (best.x0 - m) * T, px1 = (best.x0 + w + m) * T, py0 = best.y0 * T, py1 = (best.y0 + h + m) * T;
    M.objB = M.objB.filter(o => { const f = objFrame(o[0], o[1]); if (!f || KEEP.has(+o[0])) return true; const cx = o[2] + f[4] + f[2] / 2, by = o[3] + f[5] + f[3]; return !(cx >= px0 && cx < px1 && by > py0 && by <= py1 + 4); });
    const D = TTERR.deco[M.tileset];   // (the town's own trees on its terrace: Cloudhold's are cloud trees, not the Isles' pines)
    const n0 = M.objB.length;   // (what the stamp adds comes after this: its own dressing stays)
    platStamp(R, M, D ? { ...S, deco: { ...S.deco, ...D } } : S, best.x0, best.y0, w, h);
    // the town's own trees in the way (2026-11-20, the user: "trees floating off", "bad tree placement"): the forest row standing on the
    // terrace's back lip, a tree on the camp's chest, and in Cloudhold the top row, which stood on the island's very edge over the sky
    const TB = +((TOWN_LOOK[R.town - 1] || {}).tree || [])[0], chest = camp[0], sky = M.tileset === 209;
    M.objB = M.objB.filter((o, k) => { if (k >= n0 || +o[0] !== TB) return true; const tx = o[2] / T, ty = o[3] / T;
      if (tx >= best.x0 - 1.5 && tx <= best.x0 + w + 1.5 && ty < best.y0 + 1.5) return false;
      if (chest && Math.abs(tx - chest[0] - 0.5) < 2 && ty > chest[1] - 2.5 && ty < chest[1] + 1) return false;
      if (sky && ty < 2) return false;
      return true; });
    PLAT.list.pop();   // (not a Wilds plateau: no guards or chest on it, plateaus.js platGuards / platChests; its walls stay in PLAT.walls)
    R.terrace = { x: best.x0, y: best.y0, w, h };
  }
}
try { townTerraces(); } catch (e) { console.warn('townterrace:', e); }
