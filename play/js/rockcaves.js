'use strict';
// ROCK CAVES: real caves to wander, in the original game's own dark cave style: map z2f (tiles_2) is a true cave, rock walls
// with rounded corners round black rock on a dark stone floor. Rather than guess which wall piece goes where, the builder
// LEARNS it from that map (and z2g): for every 3x3 pattern of rock and floor, the tile the original uses there. A cave is
// laid out the way z2f is, square rooms joined by square tunnels (on a 2-tile grid, so every shape is one the original
// has), then each cell gets the learned tile for its pattern. Floors are the plain stone tiles only (no bones or skulls).
// Each cave is grown from a seed (so it is the same every visit) and entered like a house (houses.js enterHouse with role
// 'rockcave'): walk back onto the way in to leave. It is dark inside: a soft light goes with you.
// (The black holes are called "caves" in caves.js; these are a different thing: w.rockCave.)
const RCAVE = {
  ts: 2, learnFrom: ['z2f', 'z2g'], BW: 18, BH: 14, B: 2, rooms: [6, 8],
  floor: 29, floorVar: [30, 9, 10, 19, 20, 89], varChance: 0.1,   // (ground values: tile + 1; 39/40 are a ribcage and a bone, 130 a hole)
  dark: 0.6, light: 130,   // the darkness, and the radius of the light round the hero (screen px)
};
let RCAVE_TAB = null;
function rcLearn() {
  if (RCAVE_TAB) return RCAVE_TAB; const tab = {};
  for (const k of RCAVE.learnFrom) {
    const M = MAPS[k]; if (!M) continue; const W = M.w, H = M.h, S = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 1 : M.solid[y * W + x] ? 1 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!S(x, y)) continue;
      let key = 0, b = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { key |= S(x + dx, y + dy) << b; b++; }
      const pair = `${M.ground[y * W + x] & 0xff}:${M.overlay ? M.overlay[y * W + x] & 0xff : 0}`, T0 = tab[key] || (tab[key] = {}); T0[pair] = (T0[pair] || 0) + 1;
    }
  }
  for (const k in tab) tab[k] = Object.entries(tab[k]).sort((a, b) => b[1] - a[1])[0][0].split(':').map(Number);   // the commonest for each pattern
  return (RCAVE_TAB = tab);
}
function buildRockCave(seed, opt = {}) {
  const r = seededRng(seed >>> 0), BW = RCAVE.BW, BH = RCAVE.BH, B = RCAVE.B, W = BW * B, H = BH * B;
  const G = Array.from({ length: BH }, () => Array(BW).fill(1)), rooms = [], want = RCAVE.rooms[0] + Math.floor(r() * (RCAVE.rooms[1] - RCAVE.rooms[0] + 1));
  for (let k = 0; k < 80 && rooms.length < want; k++) {
    const w = 2 + Math.floor(r() * 4), h = 2 + Math.floor(r() * 3), x = 1 + Math.floor(r() * (BW - w - 2)), y = 1 + Math.floor(r() * (BH - h - 2));
    if (rooms.some(R => x < R.x + R.w + 1 && x + w + 1 > R.x && y < R.y + R.h + 1 && y + h + 1 > R.y)) continue;
    rooms.push({ x, y, w, h }); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) G[yy][xx] = 0;
  }
  rooms.sort((a, b) => a.x - b.x);
  for (let i = 1; i < rooms.length; i++) {   // each room to the next by a tunnel with one bend
    const a = rooms[i - 1], b = rooms[i]; let x = a.x + (a.w >> 1), y = a.y + (a.h >> 1); const tx = b.x + (b.w >> 1), ty = b.y + (b.h >> 1);
    if (r() < 0.5) { while (x !== tx) { G[y][x] = 0; x += Math.sign(tx - x); } while (y !== ty) { G[y][x] = 0; y += Math.sign(ty - y); } }
    else { while (y !== ty) { G[y][x] = 0; y += Math.sign(ty - y); } while (x !== tx) { G[y][x] = 0; x += Math.sign(tx - x); } }
    G[y][x] = 0;
  }
  const S = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : G[Math.floor(y / B)][Math.floor(x / B)] === 1;
  const tab = rcLearn(), M = blankMap(W, H, RCAVE.ts, 0), full = tab[511] || [1, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!S(x, y)) { M.ground[i] = r() < RCAVE.varChance ? RCAVE.floorVar[Math.floor(r() * RCAVE.floorVar.length)] : RCAVE.floor; M.overlay[i] = 0; M.solid[i] = 0; continue; }
    let key = 0, b = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { key |= (S(x + dx, y + dy) ? 1 : 0) << b; b++; }
    const [g, o] = tab[key] || full; M.ground[i] = g | 0x100; M.overlay[i] = o; M.solid[i] = 1;
  }
  // the way in: the open spot lowest down (nearest the middle); the way on (deeper): the open spot farthest from it
  let ent = null, bd = 1e9;
  for (let y = H - 2; y > 1 && !ent; y--) for (let x = 1; x < W - 1; x++) if (!S(x, y) && !S(x, y - 1)) { const d = Math.abs(x - W / 2); if (d < bd) { bd = d; ent = [x, y]; } }
  if (!ent) ent = [W >> 1, H - 4];
  const entry = [ent[0] * T + 8, ent[1] * T + 12];
  let far = ent, fd = -1;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!S(x, y) && !S(x, y + 1) && !S(x - 1, y) && !S(x + 1, y)) { const d = Math.hypot(x - ent[0], (y - ent[1]) * 1.2); if (d > fd) { fd = d; far = [x, y]; } }
  Object.assign(M, { name: opt.name || 'Cave', entry, spawn: entry, deep: [far[0] * T + 8, far[1] * T + 12], open: (x, y) => !S(x, y) });
  floodReach(M, ent[0], ent[1]);
  return M;
}
// the darkness: drawn over the cave, with a soft hole of light round the hero and any glowing thing (w.rockCave.lights)
const RCAVE_DARK = document.createElement('canvas');
const RC_DAY = { r: 84, a: 0.9, dy: 16, tint: 0.32 };   // the daylight at the way out: its reach, how much dark it lifts, how far below the exit spot it centres, its glow
function drawRockCaveDark(w) {
  const C = w.rockCave, cam = w.cam; if (!C || !cam) return;
  if (RCAVE_DARK.width !== VW * RES) { RCAVE_DARK.width = VW * RES; RCAVE_DARK.height = VH * RES; }
  const g = RCAVE_DARK.getContext('2d'); g.setTransform(RES, 0, 0, RES, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, VW, VH);
  const dk = rcLook(C.cave).dark; g.fillStyle = `rgba(${dk},${RCAVE.dark})`; g.fillRect(0, 0, VW, VH);
  g.globalCompositeOperation = 'destination-out';
  const Z = w.zoom || ZOOM, hole = (wx, wy, r, a) => {
    const x = (wx - cam.x) * Z, y = (wy - cam.y) * Z; if (x < -r || y < -r || x > VW + r || y > VH + r) return;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(0,0,0,${a})`); rg.addColorStop(0.55, `rgba(0,0,0,${a * 0.75})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  const p = w.player; if (p) hole(p.x, p.y - 12, RCAVE.light, 0.95);
  for (const L of C.lights || []) hole(L.x, L.y, L.r || 40, L.a || 0.8);
  // DAYLIGHT AT THE WAY OUT (2026-11-07): on the first floor, light from outside spills in through the opening you came in by,
  // warm by day and a soft moonlit blue at night, so the way out is easy to find in the dark
  const out = C.floor === 0 && w.entry, nk = out && window.GAME && GAME.profile && typeof nightK === 'function' ? nightK(GAME.profile) : 0;
  if (out) hole(out.x, out.y + RC_DAY.dy, RC_DAY.r, RC_DAY.a * (1 - 0.45 * nk));
  resetView(); ctx.drawImage(RCAVE_DARK, 0, 0, VW, VH);
  if (out) { const x = (out.x - cam.x) * Z, y = (out.y + RC_DAY.dy - cam.y) * Z, rg = ctx.createRadialGradient(x, y, 0, x, y, RC_DAY.r * Z);
    const col = nk > 0.5 ? '150,175,255' : '255,238,196';
    rg.addColorStop(0, `rgba(${col},${RC_DAY.tint * (1 - 0.4 * nk)})`); rg.addColorStop(1, `rgba(${col},0)`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
  // a faint warm tint where the hero's light falls
  if (p) { const x = (p.x - cam.x) * Z, y = (p.y - 12 - cam.y) * Z, rg = ctx.createRadialGradient(x, y, 0, x, y, RCAVE.light * 0.8);
    rg.addColorStop(0, 'rgba(255,200,130,0.10)'); rg.addColorStop(1, 'rgba(255,200,130,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
}
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => { const r = dw(world, cam, bg, now); if (world && world.rockCave) drawRockCaveDark(world); return r; };
}
// ================================================================ THE CAVES OUT IN THE WILDS
// About two areas in five have a cave mouth (the game's own mossy cave mouth, object 016), in the same spot every time
// (chosen by the world seed). Walk up into it to go in. A cave is three short floors: stairs down (object 062) at the far
// end of the first two, and at the bottom a calm CAVE KEEPER beside a chest that is yours once the keeper rests (once a day).
// Each floor has a few of the area's monsters, rocks and stalagmites, softly glowing crystals (their light shows in the dark),
// and two things to gather with Enter: a gold-ore pile and a small crystal (once a day each). Some caves hide an old
// temple archway on the last floor: the ANCIENT RUINS (the original game's unused sun-temple maps, cave0-cave3), lit,
// with a few monsters, two chests and a guardian. Caves are for solo play for now (online, the mouth stays shut).
const RC = {
  share: 0.4, floors: 3, mobs: [3, 4, 5], hold: 120, reach: 22,
  names: [['Mossy Hollow', 'Fern Grotto', 'Dewdrop Cave', 'Rootwind Burrow', 'Pebble Den'], ['Glowcap Grotto', 'Moonlit Hollow', 'Whisper Cave', 'Firefly Den', 'Twilight Burrow'],
          ['Ember Den', 'Dripstone Cavern', 'Sunken Hollow', 'Amber Grotto', 'Ash Burrow'], ['Frost Grotto', 'Crystal Hollow', 'Icicle Cave', 'Snowmelt Den', 'Shiver Burrow']],
  decor: [['292', 2, 1], ['292', 3, 1], ['292', 4, 1], ['292', 5, 1], ['032', 0, 1], ['245', 1, 1], ['205', 0, 1], ['226', 1, 0], ['226', 2, 0], ['245', 0, 1]],
  crystals: [['264', 15], ['264', 16], ['264', 17], ['264', 18], ['264', 19]],
  ore: { gold: z => 60 + 50 * z, coin: 0.12 }, crystal: { coins: 1, gold: z => 30 + 30 * z },
  keeperHp: 6, ruinsShare: 0.5,
};
const rcHash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h ^ WORLD_SEED) >>> 0; };
const rcToday = (pr, k) => !!(pr.rcDone && pr.rcDone[k] === dayNo());
const rcMark = (pr, k) => { const d = dayNo(); pr.rcDone = pr.rcDone || {}; for (const q in pr.rcDone) if (pr.rcDone[q] !== d) delete pr.rcDone[q]; pr.rcDone[k] = d; };
// the caves of this world (2026-11-07): a cave is a hole cut into the rock face of a plateau (plateaus.js), so only areas
// with a cliff have one (about one in four). One per area, in the same spot every time (chosen by the world seed), on the
// face away from its stairs. C.x / C.y: the ground just in front of the hole; C.fx: its centre, C.ft / C.fb: the face's top
// and bottom in px.
const RC_WALL = { w: 26, stairGap: 3, edge: 2 };
const RC_BOOK = { list: null };
function rcCaves(w) {
  if (w._rcCaves) return w._rcCaves; const out = [], seen = new Set();
  for (const P of (typeof PLAT !== 'undefined' ? PLAT.list : [])) {
    const ri = regionIndexAt(P.x * T + 8), R = REGIONS[ri]; if (!R || R.zone < 0 || seen.has(ri)) continue;
    const r = seededRng(rcHash('rc' + ri)), cols = [];
    for (const gap of [RC_WALL.stairGap, 2]) {   // (a narrow plateau: the hole may sit a column closer to the stairs)
      for (let c = P.x + RC_WALL.edge; c <= P.x + P.w - RC_WALL.edge - 2; c++) if (c + 1 < P.sx - gap + 2 || c > P.sx + 1 + gap - 1) cols.push(c);
      if (cols.length) break;
    }
    if (!cols.length) continue;
    const c = cols[Math.floor(r() * cols.length)], fb = (P.y + P.h) * T, ft = (P.y + P.h - P.f) * T, fx = (c + 1) * T;
    if (!mapReach(w.map, fx, fb + 8) || w.blocked(fx, fb + 8)) continue;
    seen.add(ri);
    const names = RC.names[R.zone] || RC.names[0], used = out.filter(o => o.zone === R.zone).map(o => o.name);
    // (2026-11-08: no two caves in one land share a name: from the seeded pick, the next free name; all used: "II", "III"...)
    const pickName = i0 => { for (let k = 0; k < names.length; k++) { const nm = names[(i0 + k) % names.length]; if (!used.includes(nm)) return nm; } let n = 2; while (used.includes(names[i0] + ' ' + ['', '', 'II', 'III', 'IV', 'V', 'VI'][n])) n++; return names[i0] + ' ' + (['', '', 'II', 'III', 'IV', 'V', 'VI'][n] || n); };
    out.push({ ri, zone: R.zone, ts: MAPS[P.map] && MAPS[P.map].tileset, x: fx, y: fb + 4, fx, ft, fb, name: pickName(Math.floor(r() * names.length)), ruins: r() < RC.ruinsShare, key: 'rc' + ri });
  }
  RC_BOOK.list = out;   // (kept for the Journal's CAVES page, which may open indoors)
  return (w._rcCaves = out);
}
const rcFoundIt = (C) => { const pr = window.GAME && GAME.profile; return !!(pr && pr.rcFound && pr.rcFound[C.key]); };
// their mouths, added to the world's objects, and their doors, added to the walk-in doors (tentfolk.js)
{
  const zd = zoneDoors;
  zoneDoors = w => {
    if (w._rcAll) return w._rcAll;
    const base = zd(w); if (!w.overworld || w.interior || w.home || !w.map || w.map.w < 200) return base;   // (the hero's home counts as overworld: no caves in there)
    const doors = [];
    for (const C of rcCaves(w)) {
      // (nothing standing right in front of the hole: a flower bush or rock from the plateau's dressing)
      const O = w.objects || []; for (let i = O.length - 1; i >= 0; i--) { const o = O[i]; if (Math.abs(o.x - C.fx) < 18 && (o.bottom || o.y) > C.fb - 4 && (o.bottom || o.y) < C.fb + 22) O.splice(i, 1); }
      doors.push({ get x() { return rcFoundIt(C) ? C.x : -1e9; }, y: C.y, rockCave: C, key: C.key, label: `${C.name}` });   // (hidden, not found yet: its door is "far away", so no name tag and no way in)
    }
    return (w._rcAll = base.concat(doors));
  };

  const zt = zoneDoorTick;
  zoneDoorTick = (game, w, dt, inp) => {
    const d = zoneDoorNear(w, w.player);
    if (!d || !d.rockCave) return zt(game, w, dt, inp);
    if (inp.my >= 0) { w.zoneHold = 0; return false; }
    w.zoneHold = (w.zoneHold || 0) + dt; if (w.zoneHold <= RC.hold) return false; w.zoneHold = 0;
    if (game.net) { game.toast('The cave is too narrow for a party. Caves are for solo play for now', '#c9c1a8'); return false; }
    const out = findOpen(w, d.x, d.y + 22);
    rcEnter(game, d.rockCave, 0, { x: out.x, y: out.y - 16 });
    return true;
  };
}
// a floor's map, built once and kept (MAPS[rc<ri>_<floor>])
function rcMap(C, f) {
  const key = `${C.key}_${f}`; if (MAPS[key]) return key;
  const M = MAPS[key] = buildRockCave(rcHash(key), { name: C.name }), r = seededRng(rcHash(key + 'd')), W = M.w;
  const open = (x, y) => M.reach[y * W + x] && M.open(x, y);
  const roomy = (x, y) => open(x, y) && open(x - 1, y) && open(x + 1, y) && open(x, y - 1) && open(x, y + 1);   // (room on every side, so nothing placed here shuts a path)
  const ex = M.entry[0] / T | 0, ey = M.entry[1] / T | 0, dx0 = M.deep[0] / T | 0, dy0 = M.deep[1] / T | 0;
  const used = [], spots = [];
  for (let y = 3; y < M.h - 2; y++) for (let x = 2; x < W - 2; x++) if (roomy(x, y) && Math.hypot(x - ex, y - ey) > 4 && Math.hypot(x - dx0, y - dy0) > 3) spots.push([x, y]);
  const take = () => {
    for (let k = 0; k < 60 && spots.length; k++) {
      const i = Math.floor(r() * spots.length), [x, y] = spots[i];
      if (used.some(([ux, uy]) => Math.abs(ux - x) < 2 && Math.abs(uy - y) < 2)) continue;
      used.push([x, y]); spots.splice(i, 1); return [x, y];
    }
    return null;
  };
  const put = (bank, fi, cx, by, solid) => { const rec = objRec(bank, fi); if (!rec) return; M.objB.push([+bank, fi, Math.round(cx - rec[4] - rec[2] / 2), Math.round(by - rec[5] - rec[3]), solid ? 1 : 0]); };
  M.rcLights = []; M.rcNodes = [];
  for (let n = 0; n < 5; n++) { const s = take(); if (!s) break; const Lk = rcLook(C), [b, fi] = Lk.crystals[Math.floor(r() * Lk.crystals.length)]; put(b, fi, s[0] * T + 8, s[1] * T + 14, 1); M.rcLights.push({ x: s[0] * T + 8, y: s[1] * T, r: 44, a: 0.7, glow: Lk.glow }); }
  for (const kind of ['ore', 'crystal']) {
    const s = take(); if (!s) continue; const x = s[0] * T + 8, y = s[1] * T + 14;
    if (kind === 'ore') put('242', 1, x, y, 0); else put('264', 16, x, y, 0);
    M.rcNodes.push({ kind, x, y, n: M.rcNodes.length }); M.rcLights.push({ x, y: y - 12, r: 36, a: 0.7, glow: kind === 'ore' ? '#ffd27a' : '#c8a8ff' });
  }
  for (let n = 0; n < 10; n++) { const s = take(); if (!s) break; const dec = RC.decor.concat(rcLook(C).decor), [b, fi, sol] = dec[Math.floor(r() * dec.length)]; put(b, fi, s[0] * T + 8, s[1] * T + 14, sol); }
  if (f < RC.floors - 1) { put('062', 0, M.deep[0], M.deep[1] + 6, 0); M.rcStairs = { x: M.deep[0], y: M.deep[1] }; M.rcLights.push({ x: M.deep[0], y: M.deep[1] - 6, r: 52, a: 0.85, glow: '#9fc8ff' }); }   // (a brighter, bluish pool of light: "cant really see the stairs", 2026-11-20)
  else {
    put('003', 0, M.deep[0], M.deep[1] + 4, 1); M.rcChest = { x: M.deep[0], y: M.deep[1] }; M.rcLights.push({ x: M.deep[0], y: M.deep[1] - 6, r: 40, a: 0.75, glow: '#ffd27a' });
    if (C.ruins) {   // the old archway: on the floor, against a run of rock face four tiles wide
      let best = null, bd = 1e9;
      for (let y = 4; y < M.h - 2; y++) for (let x = 3; x < W - 3; x++) {
        if (![-1, 0, 1, 2].every(k => open(x + k, y) && !M.open(x + k, y - 1) && !M.open(x + k, y - 2))) continue;
        const d = Math.abs(Math.hypot(x - ex, y - ey) - 10); if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) { const cx = best[0] * T + 16, by = best[1] * T + 2; M.objB = M.objB.filter(([b, fi, ox, oy]) => { const rec = objRec(String(b).padStart(3, '0'), fi); if (!rec) return true; const bx = ox + rec[4] + rec[2] / 2, bb = oy + rec[5] + rec[3]; return Math.abs(bx - cx) > 44 || Math.abs(bb - by) > 44; }); M.rcNodes = M.rcNodes.filter(N => Math.abs(N.x - cx) > 44 || Math.abs(N.y - by) > 44); M.rcLights = M.rcLights.filter(L => Math.abs(L.x - cx) > 44 || Math.abs(L.y - by) > 56); put('244', 0, cx, by, 0); M.rcArch = { x: cx, y: by + 8 }; M.rcLights.push({ x: cx, y: by - 20, r: 50, a: 0.8, glow: '#ffd27a' }); }
    }
  }
  return key;
}
// going in, or down a floor (from inside: out and straight back in to the next floor, so leaving always lands at the mouth)
function rcEnter(game, C, f, at) {
  const key = rcMap(C, f), w0 = game.world;
  if (w0 && w0.interior) { at = { x: w0.door.x, y: w0.door.y }; exitHouse(game); }
  enterHouse(game, { key, role: 'rockcave', place: f ? `${C.name} · Floor ${f + 1}` : C.name, x: at.x, y: at.y, rcCave: C, rcFloor: f });
}
function rcRuinsEnter(game, C) {
  const w0 = game.world, at = { x: w0.door.x, y: w0.door.y }, key = 'cave' + (C.ri % 4);
  exitHouse(game); enterHouse(game, { key, role: 'rcruins', place: `Ancient Ruins under ${C.name}`, x: at.x, y: at.y, rcCave: C });
}
// spawning a floor: its monsters, today's keeper and chest
function rcSpawn(game, w, door) {
  const C = door.rcCave, f = door.rcFloor || 0, M = MAPS[door.key], Z = ZONES[C.zone], pr = game.profile, ruins = door.role === 'rcruins';
  const mobs = Z.mobs.filter(id => D.monsters[id] && SPECIES[id]), tier = Math.min(9, Z.ranks[0] + f + (ruins ? 1 : 0));
  const cells = []; for (let i = 0; i < M.w * M.h; i++) if (M.reach[i]) { const x = (i % M.w) * T + 8, y = Math.floor(i / M.w) * T + 12; if (Math.hypot(x - M.entry[0], y - M.entry[1]) > 9 * T) cells.push({ x, y }); }
  const far = cells.slice().sort((a, b) => Math.hypot(b.x - M.entry[0], b.y - M.entry[1]) - Math.hypot(a.x - M.entry[0], a.y - M.entry[1]));
  const n = ruins ? 5 : RC.mobs[f] || 4;
  for (let k = 0; k < n && cells.length; k++) { const c = cells[Math.floor(Math.random() * cells.length)], m = makeMonster(pick(mobs), tier, c.x, c.y); m.rcMob = true; m.home = { x: c.x, y: c.y }; w.actors.push(m); }
  const doneKey = ruins ? C.key + '_ruins' : C.key, lastFloor = ruins || f === RC.floors - 1;
  if (lastFloor && !rcToday(pr, doneKey)) {   // the keeper
    const at = ruins ? far[0] : { x: M.deep[0] + 30, y: M.deep[1] };
    const big = mobs.slice().sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0], q = findOpen(w, at.x, at.y), m = makeMonster(big, Math.min(9, tier + 1), q.x, q.y);
    m.maxHp = m.hp = Math.round(m.maxHp * RC.keeperHp); m.atk *= 0.85; m.scale = (m.scale || 1) * 1.35; m.boss = true; m.rcKeeper = doneKey; m.home = { x: q.x, y: q.y }; m.label = ruins ? 'Ruins Guardian' : 'Cave Keeper';
    w.actors.push(m); w.rcKeeperKey = doneKey;
  }
  if (ruins) {   // two chests in the far halls
    if (!rcToday(pr, doneKey)) for (const c of [far[0], far[Math.floor(far.length / 3)]]) {
      if (!c) continue; const q = findOpen(w, c.x + 20, c.y), rec = objRec('003', 0);
      const o = makeMapObject([3, 0, Math.round(q.x - rec[4] - rec[2] / 2), Math.round(q.y + 4 - rec[5] - rec[3]), 1]); if (o) { o.rcChest = doneKey; o.rcZone = C.zone; o.rcRich = true; w.objects.push(o); }
    }
  } else for (const o of w.objects) if (o.chest && M.rcChest && Math.abs(o.x - M.rcChest.x) < 40 && Math.abs(o.bottom - M.rcChest.y) < 40) { if (rcToday(pr, doneKey)) o.remove = true; else { o.rcChest = doneKey; o.rcZone = C.zone; } }
  w.objects = w.objects.filter(o => !o.remove);
}
{
  const eh = enterHouse;
  enterHouse = (game, door) => {
    const r = eh(game, door), w = game.world;
    if (door && (door.role === 'rockcave' || door.role === 'rcruins') && w && w.interior) {
      w.actors = w.actors.filter(a => a.role !== door.role);
      const M = MAPS[door.key]; w.peaceful = false; w.name = door.place;
      if (door.role === 'rockcave') w.rockCave = { key: door.key, cave: door.rcCave, floor: door.rcFloor || 0, lights: M.rcLights || [] };
      else w.rcRuins = { cave: door.rcCave };
      if (door.rcCave) rcSpawn(game, w, door);
    }
    return r;
  };
}
// each frame inside: the stairs, the archway, gathering, the keeper
function rcTick(game, w, dt = 16) {
  rcAmbient(game, w, dt);
  const C = w.rockCave || w.rcRuins; if (!C || !C.cave || game.menu) return;
  const p = w.player, M = MAPS[w.door.key], pr = game.profile; if (!p || p.dead) return;
  if (w.rockCave) {
    if (M.rcStairs && Math.hypot(p.x - M.rcStairs.x, p.y - M.rcStairs.y) < 12) { const f = C.floor + 1; rcEnter(game, C.cave, f); game.toast(`Down the stairs: Floor ${f + 1}`, '#c8d8ff'); return; }
    if (M.rcArch && Math.abs(p.x - M.rcArch.x) < 14 && Math.abs(p.y - M.rcArch.y) < 12 && hit('ArrowUp', 'KeyW')) { rcRuinsEnter(game, C.cave); game.toast('An old temple, buried under the rock. The air is warm and still', '#ffd27a'); return; }
    const N = (M.rcNodes || []).find(N => Math.hypot(p.x - N.x, p.y - N.y) < RC.reach);
    if (N && hit('Enter')) {
      consume('Enter'); const k = `${w.door.key}:${N.n}`;
      if (rcToday(pr, k)) { game.toast(N.kind === 'ore' ? 'Picked clean today. More will show tomorrow' : 'Its glow is spent for today', '#c9c1a8'); return; }
      rcMark(pr, k); const z = C.cave.zone;
      if (N.kind === 'ore') { const g = RC.ore.gold(z); pr.gold = (pr.gold || 0) + g; let s = `+${g} G`; if (Math.random() < RC.ore.coin) { pr.coins = (pr.coins || 0) + 1; s += ' · +1 coin'; } game.toast(`You chip at the gold ore: ${s}`, '#ffd23f'); }
      else { const g = RC.crystal.gold(z); pr.gold = (pr.gold || 0) + g; pr.coins = (pr.coins || 0) + RC.crystal.coins; game.toast(`A glow crystal comes loose: +${RC.crystal.coins} coin, +${g} G`, '#c8a8ff'); }
      for (let i = 0; i < 10; i++) w.particles.push({ x: N.x, y: N.y - 8, vx: rand(-40, 40), vy: rand(-70, -20), t: 0, life: rand(300, 600), col: N.kind === 'ore' ? '#ffd23f' : '#d8c8ff', size: 2, drag: 0.92 });
      game.save(); return;
    }
  }
  if (w.rcKeeperKey && !w.rcKeeperDown) {
    const K = w.actors.find(a => a.rcKeeper === w.rcKeeperKey);
    if (!K || K.dead || K.hp <= 0) { w.rcKeeperDown = true; pr.rcKeepers = (pr.rcKeepers || 0) + 1; game.toast(w.rcRuins ? 'The guardian sinks into the stone. The chests are yours' : 'The keeper settles down to rest. The chest is yours', '#ffd27a'); }
  }
}
{
  const t = dojoTick;
  dojoTick = (game, w, dt) => { rcTick(game, w, dt); if (game.world !== w) return; return t(game, w, dt); };
  const oc = openChest;   // a cave chest: shut while its keeper is up, with its own loot (props.js would roll the loot of the overworld area under the same x)
  openChest = (world, o) => {
    if (!o.rcChest) return oc(world, o);
    if (world.rcKeeperKey === o.rcChest && !world.rcKeeperDown) {
      if (!o.toldT || performance.now() - o.toldT > 2000) { o.toldT = performance.now(); floatText(world, o.x, o.bottom - 30, world.rcRuins ? 'THE GUARDIAN WATCHES IT' : 'THE KEEPER WATCHES IT', '#ffd27a', 9); }
      return;
    }
    const game = window.GAME, pr = game.profile, Z = ZONES[o.rcZone], rank = Math.min(9, Z.ranks[1] + (o.rcRich ? 1 : 0)), x = o.x, y = o.bottom + 6, mobs = Z.mobs.filter(id => D.monsters[id]);
    o.opened = true; o.openT = 0; world.rings.push({ x, y: o.bottom - 6, r: 22, t: 0, col: '#ffd23f' });
    world.drops.push({ kind: 'card', item: makeCard(pick(mobs), rareGate(rank)), x: x - 12, y });
    world.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rareGate(rank), pr.cls), x: x + 12, y });
    const g = (o.rcRich ? 600 : 400) + o.rcZone * 300; pr.gold = (pr.gold || 0) + g; floatText(world, x, o.bottom - 40, `+${g} G`, '#ffd23f', 10);
    if (!world.rcRuins || !world.objects.some(q => q.rcChest === o.rcChest && !q.opened)) rcMark(pr, o.rcChest);
    questEvent(game, 'chest'); game.save();
    game.toast(o.rcRich ? 'An old temple chest: a card, gear and gold (it fills again tomorrow)' : 'The cave chest: a card, gear and gold (it fills again tomorrow)', '#ffd27a');
  };
}
// the crystals' glow and the prompts by the ore, crystal and archway (over the darkness, in screen space)
function drawRcFront(w, now) {
  const C = w.rockCave || w.rcRuins, cam = w.cam; if (!C || !cam || !w.door) return;
  const Z = w.zoom || ZOOM, M = MAPS[w.door.key], p = w.player, pr = GAME.profile, S = (x, y) => [(x - cam.x) * Z, (y - cam.y) * Z];
  resetView(); ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const L of (w.rockCave && M.rcLights) || []) {
    if (!L.glow) continue; const [x, y] = S(L.x, L.y), r = 16 * Z * (1 + 0.08 * Math.sin(now / 600 + L.x)); if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) continue;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, L.glow + '55'); rg.addColorStop(1, L.glow + '00'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (!p || GAME.menu) return;
  const say = (wx, wy, s) => { const [x, y] = S(wx, wy); text(s, x, y, '#ffe9a8', 7); };
  if (w.rockCave) {
    const N = (M.rcNodes || []).find(N => Math.hypot(p.x - N.x, p.y - N.y) < RC.reach);
    if (N) say(N.x, N.y + 10, rcToday(pr, `${w.door.key}:${N.n}`) ? (N.kind === 'ore' ? 'picked clean today' : 'glow spent today') : N.kind === 'ore' ? 'Enter: chip the gold ore' : 'Enter: take the glow crystal');
    if (M.rcArch && Math.abs(p.x - M.rcArch.x) < 30 && Math.abs(p.y - M.rcArch.y) < 30) say(M.rcArch.x, M.rcArch.y + 12, '▲ Ancient Ruins');
    // the stairs down: a small sign over them, bobbing, on a dark backing, whenever they are on screen
    if (M.rcStairs) { const [x, y] = S(M.rcStairs.x, M.rcStairs.y - 26 + Math.sin(now / 420) * 1.5);
      if (x > -30 && y > -20 && x < VW + 30 && y < VH + 20) { const s = '▼ STAIRS DOWN', tw = textW(s, 7) + 10; ctx.fillStyle = 'rgba(10,8,20,0.8)'; rrect(ctx, x - tw / 2, y - 6, tw, 12, 4); ctx.fill(); ctx.strokeStyle = 'rgba(159,200,255,0.8)'; ctx.lineWidth = 0.7; rrect(ctx, x - tw / 2 + 0.4, y - 5.6, tw - 0.8, 11.2, 4); ctx.stroke(); text(s, x, y + 0.3, '#d8e8ff', 7); } }
  }
}
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => { const r = dw(world, cam, bg, now); if (world && (world.rockCave || world.rcRuins)) drawRcFront(world, now); return r; };
}

// FINDING CAVES: the first time you come near a cave mouth it goes in your finds (pr.rcFound[key] = 1) with a soft note and a
// summon coin. The radar shows cave mouths in range as a little arch (dimmed once today's chest is taken). Titles: Spelunker
// (10 caves found) and Keeper's Friend (10 cave keepers or ruins guardians rested, pr.rcKeepers).
// (2026-11-07) A cave stays hidden behind a heap of rubble (vines over it in the green lands, snow in the frost) until you walk
// right up to it: then the stones tumble away with a puff of dust and two soft notes, and the hole is open from then on.
const RC_FIND = { near: 56, coin: 1, tumble: 800 };
function rcFindTick(game, w) {
  const pr = game.profile, p = w.player; if (!pr || !p || !w.overworld || w.interior || w.home || !w._rcCaves) return;
  for (const C of w._rcCaves) {
    if ((pr.rcFound && pr.rcFound[C.key]) || Math.abs(p.x - C.x) > RC_FIND.near || p.y - C.y > RC_FIND.near || p.y < C.ft) continue;
    (pr.rcFound = pr.rcFound || {})[C.key] = 1; pr.coins = (pr.coins || 0) + RC_FIND.coin;
    (w.rcOpened = w.rcOpened || {})[C.key] = performance.now();
    for (let i = 0; i < 14; i++) w.particles.push({ x: C.fx + rand(-12, 12), y: C.fb - rand(2, 18), vx: rand(-40, 40), vy: rand(-30, 4), t: 0, life: rand(400, 800), col: C.zone === 3 ? '#e8f0ff' : '#c8b898', size: rand(2, 4), puff: true });
    if (typeof SFX !== 'undefined' && SFX.notice) SFX.notice();
    const n = Object.keys(pr.rcFound).length;
    game.toast(`You found a cave: ${C.name}${C.ruins ? ' (something old lies deep inside)' : ''} · +${RC_FIND.coin} coin · ${n} found`, '#c8d8ff');
    game.save(); break;
  }
}
{
  const zt = zoneDoorTick;
  zoneDoorTick = (game, w, dt, inp) => { zoneDoors(w); rcFindTick(game, w); return zt(game, w, dt, inp); };
  for (const B of [{ id: 'spelunker', name: 'Spelunker', tier: 2, need: 10, how: 'Find 10 caves', prog: pr => Object.keys(pr.rcFound || {}).length, pas: ['regen', 'crit'] },
                   { id: 'keepersfriend', name: "Keeper's Friend", tier: 3, need: 10, how: 'Rest 10 cave keepers or ruins guardians', prog: pr => pr.rcKeepers || 0, pas: ['barrier', 'brutal', 'regen'] }]) {
    const t = { id: B.id, name: B.name, tier: B.tier, how: B.how, prog: pr => [B.prog(pr), B.need] };
    TITLE_LIST.push(t); TITLE_BY[B.id] = t; TITLE_PASSIVES[B.id] = B.pas;
  }
}

// EACH ZONE'S CAVES LOOK THEIR OWN: the green lands' caves have mossy logs and blue crystals; the warm lands' caves red crystals
// on embers and a warmer dark; the frost caves tall ice crystals and ice clusters and a cool blue dark. The dark's colour
// (r,g,b) goes into drawRockCaveDark. Every cave has soft motes drifting in your light (snowflakes in the frost caves), and
// now and then a drip of water: a tiny ripple near you and one very quiet music-box note (Settings ▸ CHIMES off: silent).
const RC_LOOKS = [
  { crystals: [['264', 15], ['264', 16], ['264', 17], ['264', 18], ['264', 19]], decor: [['226', 4, 0], ['226', 4, 0]], glow: '#8fd8ff', dark: '6,10,16', mote: '255,236,190' },
  { crystals: [['264', 15], ['264', 17], ['264', 19], ['254', 0]], decor: [['226', 4, 0]], glow: '#a8c8ff', dark: '8,6,20', mote: '220,210,255' },
  { crystals: [['292', 0], ['292', 0], ['264', 18]], decor: [['242', 2, 1], ['293', 1, 1]], glow: '#ffb07a', dark: '18,9,6', mote: '255,200,150' },
  { crystals: [['264', 0], ['264', 2], ['264', 4], ['264', 8], ['264', 11]], decor: [['264', 13, 1], ['264', 14, 1]], glow: '#bfe8ff', dark: '6,12,26', mote: '240,248,255', snow: true },
];
const rcLook = C => RC_LOOKS[Math.max(0, Math.min(RC_LOOKS.length - 1, (C && C.zone) || 0))];
const RC_DRIP = { gap: [6000, 11000], notes: [784, 880, 988, 1175], vol: 0.018 };
function rcAmbient(game, w, dt) {
  const C = w.rockCave; if (!C || !w.player) return;
  C.dripT = (C.dripT == null ? 3000 : C.dripT) - dt; if (C.dripT > 0) return;
  C.dripT = rand(...RC_DRIP.gap);
  const p = w.player, M = MAPS[w.door.key];
  for (let k = 0; k < 20; k++) {
    const x = p.x + rand(-110, 110), y = p.y + rand(-70, 60), tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (!M.open || !M.open(tx, ty)) continue;
    w.rings.push({ x, y, r: 7, t: 0, col: 'rgba(190,215,255,0.55)' }, { x, y, r: 4, t: -160, col: 'rgba(190,215,255,0.4)' });
    if (typeof SET === 'undefined' || SET.chimes !== false) { const A = typeof SFX !== 'undefined' && SFX.audio && SFX.audio(); if (A && typeof cueNote === 'function') cueNote(A, pick(RC_DRIP.notes), A.ac.currentTime + 0.01, RC_DRIP.vol); }
    break;
  }
}
// the motes: drawn over the darkness around the hero, slowly drifting (screen space, no state kept)
{
  const df = drawRcFront;
  drawRcFront = (w, now) => {
    const r = df(w, now), C = w.rockCave, cam = w.cam, p = w.player; if (!C || !cam || !p) return r;
    const Lk = rcLook(C.cave), Z = w.zoom || ZOOM, cx = (p.x - cam.x) * Z, cy = (p.y - 12 - cam.y) * Z, R = RCAVE.light * 0.75;
    resetView(); ctx.save();
    for (let i = 0; i < 16; i++) {
      const a = auraHash ? auraHash(i * 3.1) : (i * 0.37) % 1, b = auraHash ? auraHash(i * 7.7) : (i * 0.61) % 1;
      const k = ((now / (Lk.snow ? 5200 : 9000)) + b) % 1, x = cx + (a - 0.5) * 2 * R + Math.sin(now / 1400 + i) * 6, y = Lk.snow ? cy - R + k * 2 * R : cy + R - k * 2 * R;
      const d = Math.hypot(x - cx, y - cy) / R; if (d > 1) continue;
      ctx.fillStyle = `rgba(${Lk.mote},${(0.45 * (1 - d) * Math.sin(k * Math.PI)).toFixed(3)})`; const sz = Lk.snow ? 1.6 : 1.1; ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
    }
    ctx.restore(); return r;
  };
}

// THE HOLE IN THE WALL (2026-11-07): drawn over the plateau's rock face, on the ground layer (world.js drawDust), so the hero and
// everyone stand in front of it. An arched opening into soft darkness with a faint warm glow deep inside, a rim of lighter
// stones with a keystone, a shadow on the ground in front; moss strands hanging over it in the green lands, small icicles in
// the frost. Not found yet: a heap of rounded stones fills it (vines or a snow cap over them), which tumbles away when you
// come close (rcFindTick).
const RC_HOLE = {
  looks: { 0: { rim: '#a89a84', dark: '#4a4036', stone: '#8c8272', stoneDk: '#5a5246', over: '#5aa048' }, 3: { rim: '#d4e0f2', dark: '#6a7a98', stone: '#b4c2da', stoneDk: '#7484a4', over: '#f4f8ff' },
          4: { rim: '#e2c48e', dark: '#8a6a3a', stone: '#d0ae74', stoneDk: '#9a7a48', over: '#f2dca6' },
          2: { rim: '#c4c6de', dark: '#545878', stone: '#a6aac8', stoneDk: '#6c7094', over: '#ffffff' } },
};
const RC_ARCH = { hw: 12, open: 34, foot: 4, top: 44, ms: 260 };   // the arch's opening (half width, height) for the rubble, how far its frame reaches below its origin, ms per swirl frame
// (2026-11-07: it fits inside the rock face: scaled down so its top stays under the face's top edge, its foot on the ground)
const rcArchScale = C => Math.min(1, (C.fb - C.ft - 2) / RC_ARCH.top);   // (its sprite's rows 0-44 show: the pillars' pointed tips below are cut at the ground)
// SOFTENED WHITE (2026-11-07, the user's pick from a mock-up): so the arch sits in the cliff, its red outline becomes the cliff's
// darkest earth tone and its white stone is warmed a little toward the cliff's lightest; the purple swirl stays as it is. The
// colours are read off that zone's own plateau face tiles (PLAT_SETS), so each zone's arch matches its cliff. Made once per
// tileset, when its tiles have loaded (until then the plain arch).
const RC_TINT = { mix: 0.18, cache: {} };
const RC_GLIM = { near: 160, ms: 2400 };
const RC_HIDE = { rubble: false };   // (the old heap of stones over a hidden cave, kept but off: hidden caves are plain cliff)   // the hidden cave's glimmer: how near you must be, and the length of each glint's slow cycle
function rcArchFor(C) {
  const A = window.CAVE_ARCH, key = C.ts; if (!A || key == null) return A;
  if (RC_TINT.cache[key]) return RC_TINT.cache[key];
  const S = typeof PLAT_SETS !== 'undefined' && PLAT_SETS[key], ti = tilesetImg(key), ai = img(A.imgs[0]);
  if (!S || !ti || !(ti.width || ti.naturalWidth) || !ai || !ai.complete || !ai.naturalWidth) return A;
  try {
    const W = ti.width || ti.naturalWidth, H = ti.height || ti.naturalHeight, tc = document.createElement('canvas'); tc.width = W; tc.height = H;
    const tg = tc.getContext('2d'); tg.drawImage(ti, 0, 0); const td = tg.getImageData(0, 0, W, H).data;
    const tiles = new Set(); for (const P of [...S.face.flatMap(r => [r.l, r.r, ...r.m]), ...S.sideL, ...S.sideR]) for (const t of [P.g, P.o]) if (t != null) tiles.add(t);
    const lum = q => q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11, cols = [];
    for (const t of tiles) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = ((Math.floor(t / 16) * T + y) * W + (t % 16) * T + x) * 4; if (i + 3 >= td.length || td[i + 3] < 200) continue;
      const r = td[i], g = td[i + 1], b = td[i + 2]; if (g > r + 6 && g > b) continue;   // (not the grass along its top)
      cols.push([r, g, b]);
    }
    if (cols.length < 8) return A;
    cols.sort((a, b) => lum(a) - lum(b));
    const dark = cols[Math.floor(cols.length * 0.04)], light = cols[Math.floor(cols.length * 0.96)];
    const c = document.createElement('canvas'); c.width = ai.naturalWidth; c.height = ai.naturalHeight; const g = c.getContext('2d'); g.drawImage(ai, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height), d = id.data, m = RC_TINT.mix;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue; const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), sat = mx ? (mx - Math.min(r, gg, b)) / mx : 0;
      if (r > 140 && gg < 100 && b < 100) { d[i] = dark[0]; d[i + 1] = dark[1]; d[i + 2] = dark[2]; }   // the red outline: the cliff's darkest
      else if (sat < 0.25 && lum([r, gg, b]) > 70) { d[i] = r * (1 - m) + light[0] * m; d[i + 1] = gg * (1 - m) + light[1] * m; d[i + 2] = b * (1 - m) + light[2] * m; }   // the white stone, warmed toward the cliff
    }
    g.putImageData(id, 0, 0);
    return (RC_TINT.cache[key] = { ...A, canvas: c });
  } catch (e) { return A; }
}
function rcHoleLook(C) { return RC_HOLE.looks[C.zone >= 2 && C.zone <= 4 ? C.zone : 0]; }   // (green lands, Skyreach cloud stone, frost, desert sandstone)
function rcArch(x, fb, hw, H) { ctx.beginPath(); ctx.moveTo(x - hw, fb); ctx.lineTo(x - hw, fb - H + hw); ctx.arc(x, fb - H + hw, hw, Math.PI, 0); ctx.lineTo(x + hw, fb); ctx.closePath(); }
function drawRcHole(w, C, now) {
  // THE ARCH (2026-11-07, the user's pick): Zenonia 2's white stone arch over a slowly turning purple swirl (assets/cave_arch.js,
  // tools/build_cave_arch.py) stands against the rock face as every cave's way in. Until its image has loaded, the drawn hole.
  const A = window.CAVE_ARCH, aim = A && img(A.imgs[0]), arch = !!(aim && aim.complete && aim.naturalWidth);
  const sc = arch ? rcArchScale(C) : 1, L = rcHoleLook(C), hw = arch ? RC_ARCH.hw * sc : RC_WALL.w / 2, H = arch ? RC_ARCH.open * sc : Math.min(30, C.fb - C.ft - 4), x = C.fx, fb = C.fb, found = rcFoundIt(C);
  const opened = w.rcOpened && w.rcOpened[C.key], k = opened ? Math.min(1, (performance.now() - opened) / RC_FIND.tumble) : 1;
  // PLAIN CLIFF (2026-11-08, the user's pick from a mock-up; the heap of stones looked ugly): a cave not yet found draws nothing at
  // all, just the cliff, until you walk right up to it; then, with the puff of dust, the arch fades in (over RC_FIND.tumble ms)
  if (!found) return;
  ctx.save(); ctx.globalAlpha = k;
  if (arch) {   // (2026-11-07: set into the ground, not floating: the sprite's pointed feet are cut off at the ground line, and a thin
    // contact shadow sits right along its base instead of an oval below it)
    const seq = A.anims.idle[2], fr = seq[Math.floor(now / RC_ARCH.ms) % seq.length];   // (the swirl turns slowly: cozy)
    ctx.save(); ctx.beginPath(); ctx.rect(x - 40, fb - 60, 80, 60); ctx.clip();
    drawBankFrame(rcArchFor(C), fr, x, fb - RC_ARCH.foot * sc, { scale: sc });
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(Math.round(x - 24 * sc), fb, Math.round(48 * sc), 2);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, fb + 3, hw + 6, 4, 0, 0, Math.PI * 2); ctx.fill();   // its shadow on the ground
  rcArch(x, fb, hw + 2.5, H + 2.5); ctx.fillStyle = L.dark; ctx.fill();   // the rim: a dark edge, then lighter stones
  rcArch(x, fb, hw + 1.5, H + 1.5); ctx.fillStyle = L.rim; ctx.fill();
  if (found) {
    const g = ctx.createLinearGradient(0, fb - H, 0, fb); g.addColorStop(0, '#07060a'); g.addColorStop(0.75, '#140f0e'); g.addColorStop(1, '#221a14');
    rcArch(x, fb, hw, H); ctx.fillStyle = g; ctx.fill();
    const glow = ctx.createRadialGradient(x, fb - 3, 0, x, fb - 3, hw); glow.addColorStop(0, `rgba(255,214,150,${0.10 + 0.03 * Math.sin(now / 900)})`); glow.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = glow; rcArch(x, fb, hw, H); ctx.fill();   // (a faint warm glow, deep inside)
  }
  for (let i = -2; i <= 2; i++) {   // the stones round the arch, and its keystone
    const an = -Math.PI / 2 + i * 0.5, cx = x + Math.cos(an) * (hw + 1), cy = fb - H + hw + Math.sin(an) * (hw + 1);
    ctx.fillStyle = i === 0 ? L.rim : L.stone; ctx.strokeStyle = L.dark; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.rect(Math.round(cx - (i === 0 ? 3 : 2.5)), Math.round(cy - (i === 0 ? 3.5 : 2.5)), i === 0 ? 6 : 5, i === 0 ? 7 : 5); ctx.fill(); ctx.stroke();
  }
  if (C.zone === 3) { ctx.fillStyle = '#eef6ff'; for (const [dx, len] of [[-7, 5], [-1, 7], [5, 4]]) { ctx.beginPath(); ctx.moveTo(x + dx - 1.5, fb - H + 2); ctx.lineTo(x + dx + 1.5, fb - H + 2); ctx.lineTo(x + dx, fb - H + 2 + len); ctx.closePath(); ctx.fill(); } }   // icicles
  else if (C.zone !== 4 && C.zone !== 2) { ctx.strokeStyle = L.over; ctx.lineWidth = 1.2; for (const [dx, len] of [[-9, 7], [-4, 4], [6, 8], [10, 5]]) { ctx.beginPath(); ctx.moveTo(x + dx, fb - H + (Math.abs(dx) > 7 ? 6 : 1)); ctx.lineTo(x + dx + Math.sin(now / 1400 + dx) * 0.8, fb - H + (Math.abs(dx) > 7 ? 6 : 1) + len); ctx.stroke(); } }   // moss strands
  }
  if (RC_HIDE.rubble && (!found || k < 1)) {   // the rubble: rounded stones filling the hole (off since 2026-11-08: RC_HIDE)
    let sd = rcHash(C.key + 'rubble'); const r = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    ctx.save(); rcArch(x, fb + 20, hw + 6, H + 20); ctx.clip();
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      const sx = x + (col - 1) * Math.min(9, hw * 0.72) + ((row % 2) - 0.5) * 3 + (r() - 0.5) * 2, sy = fb - 4 - row * 7 + (r() - 0.5) * 2, rr = (4 + r() * 1.5) * Math.max(0.7, Math.min(1, hw / 12));
      if (sy - rr < fb - H - 1) continue;
      const fall = found ? k : 0, dy = fall * fall * (18 + row * 6), dx = fall * (col - 1) * 8;
      ctx.globalAlpha = 1 - fall; ctx.fillStyle = (row + col) % 2 ? L.stone : L.rim; ctx.strokeStyle = L.stoneDk; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(sx + dx, sy + dy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // A GLIMMER (2026-11-07): while it is hidden and you are within RC_GLIM.near, a few tiny purple glints show softly, one at a
    // time, between the stones, as if the swirl behind them catches the light: a hint that something is there.
    const pl = w.player;
    if (!found && pl && Math.hypot(pl.x - x, pl.y - fb) < RC_GLIM.near) {
      for (let j = 0; j < 3; j++) {
        const ph = ((now / RC_GLIM.ms) + j / 3 + (rcHash(C.key) % 7) / 7) % 1, a = Math.max(0, Math.sin(ph * Math.PI * 2)) ** 3;
        if (a < 0.05) continue;
        const gx = x + [-0.45, 0.1, 0.5][j] * hw * 1.4, gy = fb - [0.3, 0.62, 0.42][j] * H;
        ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#d8a8ff'; ctx.fillRect(Math.round(gx) - 0.5, Math.round(gy) - 1.5, 1, 3); ctx.fillRect(Math.round(gx) - 1.5, Math.round(gy) - 0.5, 3, 1);
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = found ? 1 - k : 1;
    if (C.zone >= 2 && C.zone <= 4) { ctx.fillStyle = L.over; ctx.beginPath(); ctx.ellipse(x, fb - H + hw - 2, hw - 2, 4, 0, Math.PI, 0); ctx.fill(); }   // a cap of snow (or drifted sand, or a wisp of cloud)
    else { ctx.strokeStyle = L.over; ctx.lineWidth = 1.4; for (const dx of [-8, -2, 4, 9]) { ctx.beginPath(); ctx.moveTo(x + dx, fb - H + 3); ctx.quadraticCurveTo(x + dx + 3, fb - H / 2, x + dx - 1, fb - 6); ctx.stroke(); } }   // vines hanging over it
    ctx.restore();
  }
  ctx.restore();
}
{
  const dd = drawDust;
  drawDust = (world, now) => {
    try { if (world && world.overworld && !world.interior && !world.home && world._rcCaves) { const p = world.player; for (const C of world._rcCaves) if (!p || (Math.abs(C.fx - p.x) < 420 && Math.abs(C.fb - p.y) < 300)) drawRcHole(world, C, now); } } catch (e) {}
    return dd(world, now);
  };
}

// THE CAVES PAGE (2026-11-08), in the pause menu's JOURNAL: every land with caves, how many of its caves you have found, and
// the found ones by name: a gold ◆ while today's chest is still waiting there, a dim ◇ once you have taken it. Caves not yet
// found stay unnamed ("2 still hidden"), so it is a gentle nudge, not a map.
const RC_PAGE = { W: 440, row: 44 };
if (typeof JOURNAL !== 'undefined') JOURNAL.splice(2, 0, { id: 'caves', title: 'CAVES', sub: 'The caves you have found, land by land', col: '#d8b8ff' });
{
  const jo = journalOpen;
  journalOpen = (game, m, id) => { if (id !== 'caves') return jo(game, m, id); m.view = 'caves'; m.t = 0; };
  const up = updatePause;
  updatePause = (game, m, dt) => {
    if (m.view !== 'caves') return up(game, m, dt);
    m.t += dt; const k = navInput();
    if ((k.back || k.ok || mouse.click) && m.t > 150) { m.view = 'journal'; m.t = 0; }
    return;
  };
  const dp = drawPause;
  drawPause = (game, m, now) => {
    if (m.view !== 'caves') return dp(game, m, now);
    dp(game, { ...m, view: 'journal' }, now);   // (the Journal underneath)
    const pr = game.profile || {}, L = RC_BOOK.list, lands = [];
    if (L) for (const z of [0, 1, 2, 3, 4]) { const cs = L.filter(c => c.zone === z); if (cs.length) lands.push({ z, cs, found: cs.filter(c => pr.rcFound && pr.rcFound[c.key]) }); }
    const W = RC_PAGE.W, H = 56 + Math.max(1, lands.length) * RC_PAGE.row + 18, x = VW / 2 - W / 2, y = Math.max(20, VH / 2 - H / 2);
    ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#100a18'; rrect(ctx, x, y, W, H, 6); ctx.fill();
    ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
    goldText('CAVES', VW / 2, y + 16, 12, { spacing: 3 });
    const all = L ? L.length : 0, got = L ? L.filter(c => pr.rcFound && pr.rcFound[c.key]).length : 0;
    text(L ? `${got} of ${all} found · ◆ today's chest is waiting` : 'Step outside into the Wilds to see your caves', VW / 2, y + 32, '#d8d0e8', 7.5);
    lands.forEach((Ld, i) => {
      const ry = y + 48 + i * RC_PAGE.row, hid = Ld.cs.length - Ld.found.length;
      ctx.fillStyle = 'rgba(40,28,52,0.75)'; rrect(ctx, x + 10, ry, W - 20, RC_PAGE.row - 6, 4); ctx.fill();
      text((ZONES[Ld.z] && ZONES[Ld.z].name) || 'The Wilds', x + 18, ry + 9, '#ffe08a', 8.5, 'left');
      text(`${Ld.found.length} / ${Ld.cs.length} found${hid ? ` · ${hid} still hidden` : ''}`, x + W - 18, ry + 9, '#c8bfd8', 7, 'right');
      let tx = x + 18; const ty = ry + 25;
      if (!Ld.found.length) text('None found yet: walk along the foot of the cliffs', tx, ty, '#a8a0b8', 7, 'left');
      for (const C of Ld.found) {
        const taken = typeof rcToday === 'function' && rcToday(pr, C.key), label = `${taken ? '◇' : '◆'} ${C.name}`, tw = textW(label, 7) + 12;
        if (tx + tw > x + W - 14) { text('…', tx, ty, '#c8bfd8', 7, 'left'); break; }
        text(label, tx, ty, taken ? '#9890a8' : '#ffe9a8', 7, 'left'); tx += tw;
      }
    });
    text('Esc or Enter: back', VW / 2, y + H - 9, '#b8ae96', 7);
  };
}
// crates and chests in a rock cave: a broken crate plays its shatter and goes, an opened chest its lid (props.js updateProps;
// rooms entered like a house never ran it, so a broken crate stayed whole and could be walked onto)
{
  const ui = updateInterior;
  updateInterior = (game, w, dt, inp) => { if ((w.rockCave || w.rcRuins) && typeof updateProps === 'function') updateProps(w, dt); return ui(game, w, dt, inp); };
}
// A PARTNER'S HINT (2026-11-08): hidden caves are plain cliff, so when you pass close to one (RC_HINT.near, from in front of the
// cliff) your partner, or else your pet, says a quiet line in a speech bubble, once per cave each session. With no one along,
// a soft note in the corner instead. The cave still opens only when you walk right up to it.
const RC_HINT = { near: 120, show: 3400, lines: ['Do you feel that? A cool draught from the cliff.', 'Listen... wind whistling out of the rock.', 'This cliff hums softly. Let\'s look along its foot.', 'Something sparkled in the rock just now.'] };
function rcHintTick(game, w) {
  const pr = game.profile, p = w && w.player; if (!pr || !p || !w.overworld || w.interior || w.home || !w._rcCaves || game.menu) return;
  for (const a of w.actors) if (a.rcSayUntil && performance.now() > a.rcSayUntil) { if (a.say && a.say.rc) a.say = null; a.rcSayUntil = 0; }
  const H = (w.rcHinted = w.rcHinted || {});
  for (const C of w._rcCaves) {
    if (H[C.key] || (pr.rcFound && pr.rcFound[C.key]) || p.y < C.ft || Math.hypot(p.x - C.x, p.y - C.y) > RC_HINT.near) continue;
    H[C.key] = 1;
    const line = RC_HINT.lines[rcHash(C.key + 'hint') % RC_HINT.lines.length];
    const who = w.actors.find(a => a.heroPartner && !a.dead && !a.riding) || w.actors.find(a => a.ally && a.owner === p && !a.dead && !a.riding);
    if (who) { who.say = { s: line, t: RC_HINT.show, rc: true }; who.rcSayUntil = performance.now() + RC_HINT.show; }
    else game.toast(line, '#d8c8ff');
    break;
  }
}
{
  const zt = zoneDoorTick;
  zoneDoorTick = (game, w, dt, inp) => { try { rcHintTick(game, w); } catch (e) {} return zt(game, w, dt, inp); };
}
