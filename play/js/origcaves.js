'use strict';
// ORIGINAL CAVE LAYOUTS (the user's pick, 2026-11-07): each rock-cave floor (rockcaves.js) is now one of Zenonia 1's own hand-made
// cave maps that the game had never used (tools/build_cave_maps.py -> assets/cave_maps.js, keys oc004 ...), instead of a
// generated layout. rcMap still adds the crystals, the ore and crystal to gather, the stairs (or the keeper's chest on the last
// floor), the archway to the Ruins and the darkness; only the rock and floor come from the original.
// Which map: picked from the cave (its region) and the floor, so a cave keeps the same floors every visit and its floors are
// never the same map twice in a row. The way in is the lowest open spot (as the generated caves had it), the way on is the open
// spot farthest from it with room round it, and anything the player cannot reach from the way in is left as it is.
const OCAVE = { pool: ['oc004', 'oc032', 'oc033', 'oc034', 'oc040', 'oc055', 'oc057', 'oc087', 'oc005', 'oc036'],
  // each land's caves look their own (2026-11-07): the dusk woods' caves are Zenonia 2's purple twilight dungeon, the warm lands' caves are Zenonia 1's lava dungeon, the frost lands' its ice
  // castle's spare floors, the desert's its desert temple; the rest (and any land without a set) the plain caves above.
  // (Floors too small to hold the ore, crystals and traps are left out: 069, 048, 052; and Zenonia 2 maps our decoder only half
  // reads, with scattered tiles: purple 002, 003, 075, 077, 080, 081, exported but unused. Zenonia 2's lava fields (oe), crystal ice
  // caverns (oy) and golden sand temple (og) join the warm, frost and desert sets; the ones the overworld already uses (lava 064, 066,
  // ice 040, 042, gold 029) and the tiny ones (124, 145, 138, 139) are left out.)
  byZone: { 1: ['op001', 'op004', 'op072', 'op074', 'op076', 'op078', 'op079', 'op149'], 2: ['ol074', 'ol075', 'ol076', 'ol080', 'ol081', 'ol082', 'ol084', 'oe061', 'oe062', 'oe063', 'oe065', 'oe068', 'oe069', 'oe148'],
    3: ['oi064', 'oi065', 'oy034', 'oy035', 'oy037', 'oy038', 'oy039', 'oy041', 'oy043'],
    4: ['od007', 'od044', 'od049', 'og025', 'og026', 'og030', 'og031', 'og032', 'og033', 'og092', 'og093', 'og094', 'og095', 'og099', 'og146'] } };
let ocaveHint = null;
function ocaveMapFor(C, f) {
  const own = (OCAVE.byZone[(C && C.zone) || 0] || []).filter(k => D.world.maps[k]), pool = own.length ? own : OCAVE.pool.filter(k => D.world.maps[k]); if (!pool.length) return null;
  return pool[(((C && C.ri) || 0) * 7 + f) % pool.length];   // (7: so caves with a small set still differ from each other)
}
// BLACK NOTCHES (2026-11-20, the user: "black tile"): the original floors have a few empty cells (no ground: drawn black) inside
// their wall art, worst in the ice castle's spare floors, where they showed as black squares in the ice. Each small pocket of
// empty cells (OCAVE_NOTCH cells or fewer: the big empty areas round some caves are their darkness and stay) takes the ground
// of its nearest wall cell (a floor cell only if no wall is near), and stays solid.
const OCAVE_NOTCH = 12, OCAVE_FILLALL = new Set([206]);
function ocaveFillNotches(M) {
  const W = M.w, H = M.h, n = W * H, empty = i => !(M.ground[i] & 0xff), seen = new Uint8Array(n);
  for (let i0 = 0; i0 < n; i0++) {
    if (seen[i0] || !empty(i0)) continue;
    const pocket = [], st = [i0]; seen[i0] = 1; let edge = false;
    while (st.length) { const i = st.pop(), x = i % W, y = (i - x) / W; pocket.push(i); if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (!seen[j] && empty(j)) { seen[j] = 1; st.push(j); } } }
    if (!OCAVE_FILLALL.has(M.tileset) && (pocket.length > OCAVE_NOTCH || edge)) continue;   // (the ice caves: every pocket, their walls are light ice, not darkness)
    for (let pass = 0; pass < 40; pass++) for (const i of pocket) {
      if (!empty(i)) continue; const x = i % W, y = (i - x) / W; let pickSolid = -1, pickAny = -1;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (empty(j)) continue; if (M.solid[j] && pickSolid < 0) pickSolid = j; if (pickAny < 0) pickAny = j; }
      const src = pickSolid >= 0 ? pickSolid : pickAny; if (src < 0) continue;
      M.ground[i] = (M.ground[src] & 0xff) | (1 << 8); M.overlay[i] = 0; M.solid[i] = 1;
    }
  }
}
function ocaveBuild(src, name) {
  const O = D.world.maps[src], W = O.w, H = O.h, M = blankMap(W, H, O.tileset, 0);
  M.ground = O.ground.slice(); M.overlay = O.overlay.slice(); M.solid = O.solid.slice(); M.filler = O.filler || M.filler;
  M.objA = (O.objA || []).map(o => o.slice()); M.objB = (O.objB || []).map(o => o.slice());
  ocaveFillNotches(M);
  const S = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !!M.solid[y * W + x];
  // the way in: the lowest open spot of the largest open area (nearest the middle); the way on: the open spot farthest from it
  const big = O.reach || []; let ent = null, bd = 1e9;
  for (let y = H - 2; y > 1 && !ent; y--) for (let x = 1; x < W - 1; x++) if (big[y * W + x] && !S(x, y) && !S(x, y - 1)) { const d = Math.abs(x - W / 2); if (d < bd) { bd = d; ent = [x, y]; } }
  if (!ent) ent = [O.entry[0] / 16 | 0, O.entry[1] / 16 | 0];
  floodReach(M, ent[0], ent[1]);
  let far = ent, fd = -1;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (M.reach[y * W + x] && !S(x, y + 1) && !S(x - 1, y) && !S(x + 1, y)) { const d = Math.hypot(x - ent[0], (y - ent[1]) * 1.2); if (d > fd) { fd = d; far = [x, y]; } }
  const entry = [ent[0] * 16 + 8, ent[1] * 16 + 12];
  Object.assign(M, { name: name || 'Cave', entry, spawn: entry, deep: [far[0] * 16 + 8, far[1] * 16 + 12], open: (x, y) => !S(x, y), origCave: src });
  return M;
}
{
  const rm = rcMap;
  rcMap = (C, f) => { ocaveHint = { C, f }; try { return rm(C, f); } finally { ocaveHint = null; } };
  const brc = buildRockCave;
  buildRockCave = (seed, opt = {}) => {
    const src = ocaveHint && ocaveMapFor(ocaveHint.C, ocaveHint.f);
    if (src) { try { return ocaveBuild(src, opt.name); } catch (e) { console.warn('origcaves', e); } }
    return brc(seed, opt);
  };
}
