'use strict';
// THE WAYS BETWEEN THE ZENONIA 2 MAPS (2026-11-18, the user chose "whole Z2 maps": each Verdant Fields area is one complete Zenonia 2
// map, and walking off its exit takes you to the next map, as in Zenonia 2). worldgen.js leaves no bridge where either side of a
// crossing is such a map (WILDS.bridges[i] = null); here each such crossing gets a pair of ends that lead to each other:
//   EDGE EXIT   one of the map's own walkable openings on its border. Step onto it and you come out at the other end.
//   TRAIL POST  where a map has no second opening (Zenonia 2 entered some maps another way), a waystone on the far side of the map,
//               as far from the first end as the map allows. Touch it to go on.
//   TOWN EDGE   on a town's side (Hearthvale, Mossbrook), its road where it meets the town's edge.
// Westward (deeper into the zone) uses each map's west-facing end, eastward (back toward Hearthvale) its east-facing end, preferring
// openings on that side, then the top or bottom, then any.
const Z2L = { inward: 2.5, post: 18, col: '#bfe8a8' };
function z2Exits(m) {
  const W = m.w, H = m.h, r = (x, y) => m.reach[y * W + x], out = [];
  const runs = (cells, side) => { let cur = []; for (const c of [...cells, null]) { if (c && r(c[0], c[1])) cur.push(c); else if (cur.length) { if (cur.length >= 2) out.push({ side, cells: cur }); cur = []; } } };   // (a lone open cell is a gap in the scenery, not a way out)
  runs([...Array(W).keys()].map(x => [x, 0]), 'N'); runs([...Array(W).keys()].map(x => [x, H - 1]), 'S');
  runs([...Array(H).keys()].map(y => [0, y]), 'W'); runs([...Array(H).keys()].map(y => [W - 1, y]), 'E');
  return out;
}
function z2Far(m, from) {   // the reachable cell farthest (by walking) from a map cell, a little in from any wall
  const W = m.w, H = m.h, d = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; d[q[0]] = 0; let best = q[0];
  for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c - x) / W;
    const open = (m.reach[c] && x > 1 && y > 1 && x < W - 2 && y < H - 2 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => m.reach[(y + b) * W + x + a]));
    if (open && d[c] > d[best]) best = c;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + b; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (d[n] < 0 && m.reach[n]) { d[n] = d[c] + 1; q.push(n); } } }
  return [best % W, Math.floor(best / W)];
}
// one end of a crossing in region r, facing 'E' or 'W'; used: the exit taken by the region's other end
function z2End(r, face, used) {
  const m = WG_MAPS[r.map];
  if (m.z2field) {
    const ex = (m._exits = m._exits || z2Exits(m)), pref = face === 'E' ? ['E', 'N', 'S', 'W'] : ['W', 'S', 'N', 'E'];
    for (const s of pref) { const e = ex.find(q => q.side === s && q !== used); if (e) return { r, kind: 'edge', exit: e, side: e.side, cells: e.cells.map(([x, y]) => [r.ox + x, r.oy + y]) }; }
    const at = used ? z2Far(m, used.cells[Math.floor(used.cells.length / 2)]) : (() => {   // (no opening left: a post on the far side)
      let b = null; for (let x = face === 'E' ? m.w - 2 : 1; face === 'E' ? x > 0 : x < m.w - 1; x += face === 'E' ? -1 : 1) { for (let y = 2; y < m.h - 2; y++) if (m.reach[y * m.w + x]) { b = [x, y]; break; } if (b) break; }
      return b || [m.spawn[0] >> 4, m.spawn[1] >> 4]; })();
    return { r, kind: 'post', x: (r.ox + at[0]) * T + 8, y: (r.oy + at[1]) * T + 10 };
  }
  // a town: its road at the facing edge
  const road = m.road || (typeof OUTPOST !== 'undefined' && OUTPOST.road) || [16, 19], ry = r.key === 'town' ? 18 : Math.round((road[0] + road[1] + 1) / 2);
  const rows = [...Array(m.h).keys()].sort((a, b) => Math.abs(a - ry) - Math.abs(b - ry));
  for (const y of rows) { const x = face === 'W' ? [...Array(m.w).keys()].find(x => m.reach[y * m.w + x]) : [...Array(m.w).keys()].reverse().find(x => m.reach[y * m.w + x]);
    if (x != null) { const cells = []; for (let dy = -1; dy <= 1; dy++) if (m.reach[(y + dy) * m.w + x]) cells.push([r.ox + x, r.oy + y + dy]); return { r, kind: 'edge', side: face, cells, town: true }; } }
  return { r, kind: 'post', x: (r.ox + (m.spawn[0] >> 4)) * T + 8, y: (r.oy + (m.spawn[1] >> 4)) * T + 10 };
}
let Z2_LINKS = null, Z2_LINKS_SEED = null;
function z2Links() {
  if (Z2_LINKS && Z2_LINKS_SEED === WORLD_SEED) return Z2_LINKS;
  Z2_LINKS_SEED = WORLD_SEED; Z2_LINKS = [];
  const ends = new Map();   // region index -> { E, W }
  for (let i = 0; i + 1 < REGIONS.length; i++) {
    if (WILDS.bridges[i]) continue;
    const a = REGIONS[i], b = REGIONS[i + 1];
    if (!(WG_MAPS[a.map].z2field || WG_MAPS[b.map].z2field)) continue;
    const ea = ends.get(i) || {}, eb = ends.get(i + 1) || {};
    // the west map's east end, the east map's west end (a map's other end is chosen when its other crossing comes, using what's left)
    ea.E = z2End(a, 'E', ea.W && ea.W.exit); eb.W = z2End(b, 'W', null);
    ends.set(i, ea); ends.set(i + 1, eb);
    Z2_LINKS.push({ i, A: ea.E, B: eb.W });
  }
  // a map whose west end was chosen before its east one may now share an exit: give the west end the other choice
  for (const [i, e] of ends) if (e.E && e.W && e.E.exit && e.W.exit && e.E.exit === e.W.exit) { const n = z2End(REGIONS[i], 'W', e.E.exit); Object.assign(e.W, n); }
  return Z2_LINKS;
}
// where you come out at an end: a couple of tiles in from the opening, or just below the post
function z2Arrive(w, E) {
  if (E.kind === 'post') return findOpen(w, E.x, E.y + 20);
  const c = E.cells[Math.floor(E.cells.length / 2)], v = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[E.side];
  return findOpen(w, (c[0] + 0.5 + v[0] * Z2L.inward) * T, (c[1] + 0.5 + v[1] * Z2L.inward) * T);
}
const z2On = (p, E) => E.kind === 'post' ? Math.hypot(p.x - E.x, p.y - E.y) < Z2L.post : E.cells.some(([x, y]) => Math.floor(p.x / T) === x && Math.floor(p.y / T) === y);
function z2LinkTick(game, w) {
  if (!w.overworld || w.interior || !w.player || w.player.dead || game.menu) return;
  const p = w.player;
  if (p.z2Lock) { if (!z2On(p, p.z2Lock)) p.z2Lock = null; else return; }
  for (const L of z2Links()) for (const [from, to] of [[L.A, L.B], [L.B, L.A]]) {
    if (Math.abs(p.x - (from.kind === 'post' ? from.x : from.cells[0][0] * T)) > 200) continue;
    if (!z2On(p, from)) continue;
    const G = (w.guardians || []).find(G => G.z2link === L), pr = game.profile;
    if (G && typeof ZONE_SEALS !== 'undefined' && ZONE_SEALS && !(pr.cleared || {})[G.zi]) {   // the zone's way out stays sealed until its Guardian falls
      p.z2Lock = from; if (!(w.z2SealT > performance.now())) { w.z2SealT = performance.now() + 2500; game.toast(`Sealed: the Guardian of ${ZONES[G.zi].name} holds this way`, '#d8b8ff'); }
      return;
    }
    const q = z2Arrive(w, to); p.x = q.x; p.y = q.y; p.z2Lock = to.kind === 'post' ? to : null;
    if (w.cam) { w.cam.x = p.x - VW / 2 / (w.zoom || ZOOM); w.cam.y = p.y - VH / 2 / (w.zoom || ZOOM); }
    w.fadeIn = 300; if (typeof game.toast === 'function') game.toast(WG_MAPS[to.r.map].name || '', '#d8f0c8');
    return;
  }
}
{
  const st = safeTick;
  safeTick = (game, w, dt) => { const r = st(game, w, dt); try { z2LinkTick(game, w); } catch (e) { if (!z2LinkTick.warned) { z2LinkTick.warned = true; console.warn('z2links', e); } } return r; };
  const ds = drawSafePoints;
  drawSafePoints = (w, now, items) => {
    const r = ds(w, now, items);
    if (!w.overworld || w.interior || !w.player) return r;
    const p = w.player;
    for (const L of z2Links()) for (const [E, to] of [[L.A, L.B], [L.B, L.A]]) {
      if (E.kind !== 'post' || Math.abs(E.x - p.x) > 460 || Math.abs(E.y - p.y) > 320) continue;
      const toward = to.r.ox > E.r.ox ? 'toward Hearthvale' : 'deeper in';
      items.push({ y: E.y, draw: () => drawWaystone(E.x, E.y, Z2L.col, true, now, 'PATH ONWARD', `${WG_MAPS[to.r.map].name || ''} · ${toward}`) });
    }
    return r;
  };
}
// ---- the land round a whole Zenonia 2 map (world.js paintOverworld calls these). As in Zenonia 2 itself the camera stops at the
// map's border (cameraFor below), so nothing past it shows: the space round it is left dark (no open sea, no lake shore, no river
// in the gaps), and the exits are simply openings in the edge. (A first try painted the border ground all round and ran each exit
// on past the edge: flat and wrong, 2026-11-18.)
function z2Surround(g, r, a, b) { return true; }
function z2ExitPaths(g, r) {}
const z2RegionAt = x => { const R = REGIONS[regionIndexAt(x)]; return R && (WG_MAPS[R.map] || {}).z2field ? R : null; };
{
  const cf = cameraFor;
  cameraFor = (world, target) => {
    const R = world && world.overworld && !world.interior && target && z2RegionAt(target.x);
    if (!R) return cf(world, target);
    const b = world.bounds, z = { x0: R.ox * T, x1: (R.ox + R.w) * T, y0: R.oy * T, y1: (R.oy + R.h) * T };
    world.bounds = z; try { return cf(world, target); } finally { world.bounds = b; }   // (clamped to the map; a map smaller than the view is centred)
  };
}

// the zone's Guardian, where the way out of its zone is an exit rather than a bridge: it stands just inside that exit (journey.js
// placed it on the bridge, or at the area's far end when there was none), and the exit holds until it falls (z2LinkTick)
{
  const ij = initJourney;
  initJourney = (game, w) => {
    const r = ij(game, w);
    for (const G of w.guardians || []) {
      if (G.bd) continue;
      const last = zoneAreas(G.zi).slice(-1)[0], ri = REGIONS.indexOf(last), L = z2Links().find(l => l.i === ri - 1);
      if (!L) continue;
      G.z2link = L; const q = z2Arrive(w, L.B); G.at = { x: q.x, y: q.y };
    }
    return r;
  };
}
// on a map narrower or shorter than the view, nothing of the next map shows past the dark gap: outside the map is plain dark, as
// Zenonia 2 shows it (2026-11-18)
{
  // (laid down just before the gloom, inside the world's drawing: after it, the minimap and panels other files add would be covered)
  const dg = drawGloom;
  drawGloom = (world, cam, now) => {
    let r;
    const R = world && world.overworld && !world.interior && world.player && z2RegionAt(world.player.x);
    if (R && cam) {
      const Z = world.zoom || ZOOM, x0 = (R.ox * T - cam.x) * Z, y0 = (R.oy * T - cam.y) * Z, x1 = ((R.ox + R.w) * T - cam.x) * Z, y1 = ((R.oy + R.h) * T - cam.y) * Z;
      if (x0 > 0 || y0 > 0 || x1 < VW || y1 < VH) {
        ctx.save(); ctx.fillStyle = '#0b120e';
        if (x0 > 0) ctx.fillRect(0, 0, Math.ceil(x0), VH); if (x1 < VW) ctx.fillRect(Math.floor(x1), 0, VW - Math.floor(x1), VH);
        if (y0 > 0) ctx.fillRect(0, 0, VW, Math.ceil(y0)); if (y1 < VH) ctx.fillRect(0, Math.floor(y1), VW, VH - Math.floor(y1));
        ctx.restore();
      }
    }
    r = dg(world, cam, now);
    return r;
  };
}
