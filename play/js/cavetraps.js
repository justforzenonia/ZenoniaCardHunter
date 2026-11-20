'use strict';
// CAVE TRAPS: Zenonia 2's unused trap sprites (tools/build_traps.py, GAME_DATA.traps) placed on the deeper floors of the rock
// caves (rockcaves.js; never on the first floor, never near the way in, the stairs, the gathering spots or the keeper).
// They are gentle, in keeping with a calm game: each one shows what it is about to do, a sting takes a few percent of your
// HP, a trap can never knock you out, and after a sting you have half a second to step away.
//   FIRE PIPE  (char/012) a brick block that pushes out a pipe now and then and blasts flame four ways; a soft orange glow on
//              the floor warns first. Stand off its four arms.
//   GROUND FIRE (char/015) a small fire that burns on: it stings if you stand in it, and it lights the dark round it.
//   RED EYE    (char/013) watches; stay in its gaze too long and it zaps you and slows you for a moment.
//   SNARE      (char/076) dark tendrils round a floating orb: walk over it and they grab, holding you briefly.
// Floor 2 gets CTRAP.per[1] traps, floor 3 CTRAP.per[2], placed from the cave's seed so they are in the same spots every visit.
const CTRAP = {
  per: [0, 3, 4], gap: 5 * 16, clear: { entry: 8 * 16, stairs: 4 * 16, node: 3 * 16, deep: 5 * 16 },
  sting: 0.04, safe: 500,
  pipe: { quiet: 2600, warn: 700, arm: 44, w: 9, hot: [0.3, 0.85] },
  flame: { r: 11, every: 900, light: 46 },
  eye: { range: 72, stare: 1300, cd: 3200, slow: 1200 },
  snare: { r: 18, cd: 4500, hold: 1100 },
};
const CTRAP_KINDS = ['pipe', 'flame', 'eye'];   // (the SNARE was taken out of the caves on 2026-11-20 at the user's word: "remove from cave")
const ctrapBank = k => window.GAME_DATA && GAME_DATA.traps && GAME_DATA.traps[k];
const ctrapSeqLen = seq => (seq || []).reduce((s, e) => s + e[1], 0);
function ctrapPlace(w, door) {
  const f = door.rcFloor || 0, n = CTRAP.per[f] || 0, M = MAPS[door.key]; w.rcTraps = [];
  if (!n || !M || !M.reach || !GAME_DATA.traps) return;
  const r = seededRng(((door.rcCave && door.rcCave.ri) || 7) * 31 + f * 977 + 13), C = CTRAP.clear;
  const avoid = [[M.entry, C.entry], [M.rcStairs && [M.rcStairs.x, M.rcStairs.y], C.stairs], [M.deep && [M.deep[0] + 30, M.deep[1]], C.deep], ...(M.rcNodes || []).map(N => [[N.x, N.y], C.node])];
  // each kind has its own kind of spot (2026-11-07, the first random spots looked wrong):
  //   pipe  across a tunnel (walls close above and below, or left and right), so you time your way past it
  //   eye   set into a wall face: a floor cell with rock right above it and floor to both sides
  //   flame, snare  out in the open, with floor all round (a tile each way), not against a wall
  // and never on or beside a rock, stalagmite or crystal (w.objects)
  const open = (x, y) => x >= 0 && y >= 0 && x < M.w && y < M.h && !!M.reach[y * M.w + x];
  const objs = (w.objects || []).map(o => [o.x, o.bottom != null ? o.bottom : o.y]);
  // the cave's own decorations (rockcaves.js M.objB: rocks, stalagmites, logs, crystals), as the boxes they are drawn in
  const boxes = [...(M.objB || []), ...(M.objA || [])].map(([b, fi, x0, y0]) => { const rec = objRec(String(b).padStart(3, '0'), fi); return rec ? [x0 + rec[4], y0 + rec[5], rec[2], rec[3]] : null; }).filter(Boolean);
  const ok = (x, y) => !avoid.some(([P, d]) => P && Math.hypot(x - P[0], y - P[1]) < d) && !objs.some(([ox, oy]) => Math.hypot(x - ox, y - oy) < 22);
  // each kind's real outline round its foot point: every frame it can show (idle, and the burst / grab), so no rock, crystal or
  // stalagmite (drawn above the traps) ever covers any part of one; 'clearOf' is that outline against the decoration boxes
  const outline = {};
  for (const k of CTRAP_KINDS) {
    const B = ctrapBank(k); let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    if (B) for (const an of ['idle', 'attack']) for (const e of (B.anims[an] || [])[2] || []) { const rec = B.frames[e[0]]; if (!rec) continue;
      const lx = e[2] + rec[4], ly = e[3] + rec[5]; x0 = Math.min(x0, lx); y0 = Math.min(y0, ly); x1 = Math.max(x1, lx + rec[2]); y1 = Math.max(y1, ly + rec[3]); }
    outline[k] = [x0 - 4, y0 - 4, x1 + 4, y1 + 4];
  }
  for (const [ox, oy] of objs) boxes.push([ox - 16, oy - 32, 32, 34]);   // (the world's own objects too, roughly as big as a boulder)
  const clearOf = (k, x, y) => { const [a0, b0, a1, b1] = outline[k]; return !boxes.some(([bx, by, bw, bh]) => x + a1 > bx && x + a0 < bx + bw && y + b1 > by && y + b0 < by + bh); };
  const spots = { pipe: [], eye: [], flame: [], snare: [] };
  for (let ty = 1; ty < M.h - 1; ty++) for (let tx = 1; tx < M.w - 1; tx++) {
    if (!open(tx, ty)) continue; const x = tx * 16 + 8, y = ty * 16 + 12; if (!ok(x, y)) continue;
    const across = (open(tx - 1, ty) && open(tx + 1, ty) && !open(tx, ty - 2) && !open(tx, ty + 2) && (!open(tx, ty - 1) || !open(tx, ty + 1)))
      || (open(tx, ty - 1) && open(tx, ty + 1) && !open(tx - 2, ty) && !open(tx + 2, ty) && (!open(tx - 1, ty) || !open(tx + 1, ty)));
    if (across && clearOf('pipe', x, y)) spots.pipe.push({ x, y });
    if (!open(tx, ty - 1) && open(tx - 1, ty) && open(tx + 1, ty) && open(tx, ty + 1) && clearOf('eye', x, ty * 16 + 6)) spots.eye.push({ x, y: ty * 16 + 6 });
    let room = true; for (let dy = -1; dy <= 1 && room; dy++) for (let dx = -1; dx <= 1; dx++) if (!open(tx + dx, ty + dy)) { room = false; break; }
    if (room && clearOf('flame', x, y)) spots.flame.push({ x, y });
  }
  for (let k = 0; k < n * 10 && w.rcTraps.length < n; k++) {
    let kind = CTRAP_KINDS[(w.rcTraps.length + f + Math.floor(k / 6)) % CTRAP_KINDS.length], list = spots[kind].filter(c => !w.rcTraps.some(t => Math.hypot(t.x - c.x, t.y - c.y) < CTRAP.gap));
    if (!list.length || w.rcTraps.filter(t => t.kind === kind).length >= (n > 3 ? 2 : 1)) continue;   // (one of a kind, two on the deepest floor; a floor with no room for more simply has fewer)
    const c = list[Math.floor(r() * list.length)];
    w.rcTraps.push({ kind, x: c.x, y: c.y, t: r() * 2000, cd: 0, gaze: 0, anim: 'idle', at: 0 });
  }
  // the ground fires glow in the dark (a copy of the map's light list, so lights never pile up over visits)
  if (w.rockCave) w.rockCave.lights = [...(w.rockCave.lights || []).filter(l => !l.trap), ...w.rcTraps.filter(t => t.kind === 'flame').map(t => ({ x: t.x, y: t.y - 10, r: CTRAP.flame.light, a: 0.7, trap: true })),
    ...w.rcTraps.filter(t => t.kind === 'pipe').map(t => (t.light = { x: t.x, y: t.y - 8, r: 1, a: 0.01, trap: true }))];   // (a pipe lights up while it blasts: ctrapTick)
}
// a sting: a few percent of max HP, never below 1 HP, then a moment's grace
function ctrapSting(w, p, t, k = 1, col = '#ffb08a') {
  if (!p || p.dead || (p.invuln || 0) > 0 || (p.trapSafe || 0) > performance.now()) return false;
  const dmg = Math.max(1, Math.round((p.maxHp || 100) * CTRAP.sting * k));
  p.hp = Math.max(1, p.hp - dmg); p.trapSafe = performance.now() + CTRAP.safe; p.hitFlash = 1;
  floatText(w, p.x, p.y - 34, `-${dmg}`, col, 9); w.shake = Math.max(w.shake || 0, 2);
  return true;
}
function ctrapTick(game, w, dt) {
  const p = w.player; if (!w.rcTraps || !w.rcTraps.length || !p || p.dead || game.menu) return;
  for (const t of w.rcTraps) {
    const B = ctrapBank(t.kind); if (!B) continue;
    t.t += dt; t.cd = Math.max(0, t.cd - dt); const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy);
    if (t.kind === 'pipe') {
      const P = CTRAP.pipe, L = ctrapSeqLen(B.anims.attack[2]), cyc = P.quiet + L, ph = t.t % cyc;
      if (ph < P.quiet) {
        t.anim = 'idle'; if (t.light) { t.light.r = 1; t.light.a = 0.01; }
        if (ph > P.quiet - P.warn && !t.warned) { t.warned = true; w.rings.push({ x: t.x, y: t.y, r: P.arm * 0.8, t: 0, col: 'rgba(255,150,60,0.5)' }); }
      } else {
        if (t.anim !== 'attack') { t.anim = 'attack'; t.at = performance.now(); t.warned = false; t.stung = false; }
        const k = (ph - P.quiet) / L, hot = k > P.hot[0] && k < P.hot[1];
        if (t.light) { t.light.r = hot ? P.arm + 14 : 1; t.light.a = hot ? 0.85 : 0.01; }
        if (hot && !t.stung && ((Math.abs(dx) < P.w && Math.abs(dy) < P.arm) || (Math.abs(dy) < P.w && Math.abs(dx) < P.arm))) t.stung = ctrapSting(w, p, t, 1, '#ffb08a');   // (once per burst)
      }
    } else if (t.kind === 'flame') {
      t.anim = 'idle';
      if (d < CTRAP.flame.r && t.cd <= 0 && ctrapSting(w, p, t, 0.8, '#ffb08a')) t.cd = CTRAP.flame.every;
    } else if (t.kind === 'eye') {
      const E = CTRAP.eye;
      if (d < E.range && t.cd <= 0) {
        t.gaze += dt; t.anim = 'attack';
        if (t.gaze >= E.stare) {
          t.gaze = 0; t.cd = E.cd;
          w.bolts.push({ x1: t.x, y1: t.y - 14, x2: p.x, y2: p.y - 12, t: 0, dur: 220, seed: Math.random() * 1000, w: 1.6, col: '#ff6a6a' });
          // (its slow always lands, even when the sting can't: GOD mode, a dash, a moment after a hit; 2026-11-20 the user: "that doesnt do anything")
          ctrapSting(w, p, t, 1, '#ff8a8a'); p.status.slow = Math.max(p.status.slow || 0, E.slow); floatText(w, p.x, p.y - 46, 'SLOWED', '#ff9a9a', 8);
        }
      } else { t.gaze = Math.max(0, t.gaze - dt * 2); t.anim = 'idle'; }
    } else if (t.kind === 'snare') {
      const S = CTRAP.snare;
      if (d < S.r && t.cd <= 0) {
        t.cd = S.cd; t.anim = 'attack'; t.at = performance.now();
        // the tendrils grab and HOLD you in place for a moment (they only slowed you, and only when the sting landed: it read as nothing)
        ctrapSting(w, p, t, 0.6, '#c8a8ff'); p.snareUntil = performance.now() + S.hold; floatText(w, p.x, p.y - 46, 'SNARED', '#c8a8ff', 8);
        w.rings.push({ x: t.x, y: t.y, r: S.r + 6, t: 0, col: '#b088ff' });
      } else if (t.cd < S.cd - 600) t.anim = 'idle';
    }
  }
}
function drawCaveTraps(w, now) {
  if (!w.rcTraps) return;
  for (const t of w.rcTraps) {
    const B = ctrapBank(t.kind); if (!B) continue;
    const seq = (B.anims[t.anim] || B.anims.idle)[2] || B.anims.idle[0], loop = t.anim !== 'attack' || t.kind === 'eye';
    const e = seqFrame(seq, loop ? now + t.x * 7 : now - t.at, loop);
    ctx.save(); ctx.imageSmoothingEnabled = false; drawBankFrame(B, e, t.x, t.y); ctx.restore();
    if (t.kind === 'pipe' && t.anim === 'attack') ctrapPipeFire(t, now);
  }
}
// the fire pipe's blast, drawn along its four arms while it is hot (the sprite only pushed out grey pipe stubs, so a burst read as
// nothing at all: 2026-11-20, the user: "doesnt do anything or any damage"). It swells in, flickers, and dies back.
function ctrapPipeFire(t, now) {
  const P = CTRAP.pipe, B = ctrapBank('pipe'), L = ctrapSeqLen(B.anims.attack[2]), k = ((t.t % (P.quiet + L)) - P.quiet) / L;
  if (k <= P.hot[0] - 0.06 || k >= P.hot[1] + 0.04) return;
  const grow = Math.min(1, (k - (P.hot[0] - 0.06)) / 0.08) * Math.min(1, (P.hot[1] + 0.04 - k) / 0.08), len = P.arm * grow, cy = t.y - 8;
  // the game's own fire (the ground-fire trap's sprite, char/015) bursts out along each pipe, three flames to an arm, small at the
  // pipe's mouth and full at its end (2026-11-20, the user: "exactly like the zenonia games ... it leaves a weird squiggly": the
  // glowing dot chains are gone)
  const FB = ctrapBank('flame'); if (!FB) return; const seq = FB.anims.idle[2] || FB.anims.idle[0];
  for (const [dx, dy, dir] of [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]]) for (let k = 1; k <= 3; k++) {
    const d = (P.arm * k / 3) * grow, x = t.x + dx * d, y = t.y + dy * d - (dy ? 4 : 0), sc = (0.32 + 0.12 * k) * grow, e = seqFrame(seq, now + k * 90 + dir * 140, true);
    if (sc < 0.05) continue; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.imageSmoothingEnabled = false; drawBankFrame(FB, e, 0, 0); ctx.restore();
  }
}
{
  const eh = enterHouse;   // (wraps rockcaves.js' own wrapper, so the cave is set up first)
  enterHouse = (game, door) => {
    const r = eh(game, door), w = game.world;
    try { if (door && door.role === 'rockcave' && w && w.rockCave && !(game.net && game.net.role)) ctrapPlace(w, door); } catch (e) { console.warn('cavetraps', e); }
    return r;
  };
  const rt = rcTick;
  rcTick = (game, w, dt = 16) => { const r = rt(game, w, dt); try { ctrapTick(game, w, dt); } catch (e) {} return r; };
  const dd = drawDust;
  drawDust = (world, now) => { const r = dd(world, now); if (world && world.rockCave && world.rcTraps) drawCaveTraps(world, now); return r; };
}
// HOT FLOOR (2026-11-07): in the lava caves (origcaves.js, tileset 108) the red-hot mesh and lava-edge tiles burn while you stand
// on them: a small sting every CTRAP.hot.every ms (same rules as the traps: never below 1 HP), a soft "HOT!" the first time on
// each floor, and a few embers at your feet. Only the tile under your feet counts.
CTRAP.hot = { every: 800, k: 0.75, tiles: new Set([0, 1, 2, 3, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 25, 60, 91, 101, 120, 122, 131, 134, 159]) };
function ctrapHotFloor(game, w, dt) {
  const p = w.player, M = w.rockCave && w.door && MAPS[w.door.key];
  const HOT = M && CTRAP.hotByTs[M.tileset]; if (!HOT || !p || p.dead || game.menu || p.z > 0.5) return;
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16); if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) return;
  const t = (M.ground[ty * M.w + tx] & 0xff) - 1; w.hotT = Math.max(0, (w.hotT || 0) - dt);
  if (!HOT.has(t) || w.hotT > 0) return;
  if (ctrapSting(w, p, null, CTRAP.hot.k, '#ff9a5a')) {
    w.hotT = CTRAP.hot.every;
    if (!w.hotTold) { w.hotTold = true; floatText(w, p.x, p.y - 46, 'HOT!', '#ffb070', 9); }
    for (let i = 0; i < 5; i++) w.particles.push({ x: p.x + rand(-6, 6), y: p.y - 2, vx: rand(-20, 20), vy: rand(-60, -25), t: 0, life: rand(300, 500), col: i % 2 ? '#ffb040' : '#ff6a2a', size: 1.6, drag: 0.92 });
  }
}
{
  const rt = rcTick;
  rcTick = (game, w, dt = 16) => { const r = rt(game, w, dt); try { ctrapHotFloor(game, w, dt); } catch (e) {} return r; };
}
// SLIPPERY ICE (2026-11-07): in the frost caves (the ice-castle maps, tileset 6) the shiny ice floor is slick. Walk on it and when
// you stop you keep gliding the way you were going, slowing to a halt in about half a second (never through rock, never while
// dashing, fighting or in a menu). A playful touch rather than a danger: it never hurts.
CTRAP.ice = { tiles: new Set([66, 69, 75, 76, 99, 100, 101, 105]), keep: 0.93, min: 6, catchK: 0.35 };
function ctrapIce(game, w, dt) {
  const p = w.player, M = w.rockCave && w.door && MAPS[w.door.key];
  const SLICK = M && CTRAP.iceByTs[M.tileset]; if (!SLICK || !p || p.dead || game.menu) { if (p) p.iceV = null; return; }
  const I = CTRAP.ice, tile = (x, y) => { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); return tx < 0 || ty < 0 || tx >= M.w || ty >= M.h ? -1 : ty * M.w + tx; };
  const i = tile(p.x, p.y), onIce = i >= 0 && SLICK.has((M.ground[i] & 0xff) - 1), last = p.iceLast || { x: p.x, y: p.y };
  const mx = p.x - last.x, my = p.y - last.y, moved = Math.hypot(mx, my) > 0.3, s = Math.max(1, dt) / 1000;
  if (!onIce || p.state === 'dashing' || p.attacking) { p.iceV = null; }
  else if (moved) { const v = p.iceV || { x: 0, y: 0 }; p.iceV = { x: v.x + (mx / s - v.x) * I.catchK, y: v.y + (my / s - v.y) * I.catchK }; }
  else if (p.iceV && Math.hypot(p.iceV.x, p.iceV.y) > I.min) {
    const nx = p.x + p.iceV.x * s, ny = p.y + p.iceV.y * s, j = tile(nx, ny);
    if (j < 0 || M.solid[j] || !M.reach[j]) p.iceV = null;
    else { p.x = nx; p.y = ny; const k = Math.pow(I.keep, dt / 16); p.iceV.x *= k; p.iceV.y *= k; }
  } else p.iceV = null;
  p.iceLast = { x: p.x, y: p.y };
}
{
  const rt = rcTick;
  rcTick = (game, w, dt = 16) => { const r = rt(game, w, dt); try { ctrapIce(game, w, dt); } catch (e) {} return r; };
}
// the hot and slick tiles for each cave tileset: Zenonia 1's lava dungeon (108) and ice castle (6), and Zenonia 2's lava fields (208:
// the molten pools and edges, not the red-cracked rock) and crystal ice caverns (206: the glossy ice sheets, not the frosty floor)
CTRAP.hotByTs = { 108: CTRAP.hot.tiles, 208: new Set([7, 8, 9, 104, 114, 115, 143, 153, 154]) };
CTRAP.iceByTs = { 6: CTRAP.ice.tiles, 206: new Set([1, 2, 6, 7, 8, 9, 17, 18, 25, 82, 83, 167, 168, 169, 170, 171, 172, 173, 174]) };
// a snared hero barely moves until the tendrils let go (cavetraps: p.snareUntil)
{
  const so = speedOf;
  speedOf = a => { const s = so(a); return a && a.snareUntil > performance.now() ? s * 0.06 : s; };
}
