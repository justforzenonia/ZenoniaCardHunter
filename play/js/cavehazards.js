'use strict';
// CAVE HAZARDS (2026-11-13, the user: "tiles do no damage when stepping on poison, spike traps don't work, walk past blocks
// not push it"). The original cave floors (origcaves.js, Zenonia 1's own maps, tileset 2) came with a purple poison pool, rows of
// spike holes and stone blocks, but they were only pictures. Now they work, gently, in keeping with a calm game:
//   POISON POOL  the purple pools can be waded (they used to be walls round little islands): you move slower and a small sting
//                lands every CHAZ.poison.every ms while you stand in them. The plank bridges cross them safely.
//   SPIKES       each row of holes pushes up short metal spikes on a slow beat: the tips peek out first (the warning), then the
//                spikes stand for a moment. Standing on them when they are up stings once; then you have time to step off.
//   BLOCKS       the grey stone blocks and ice blocks that had no footprint now slide when you walk into them (props.js tryPush),
//                and the spare crates break like the others.
// Every sting uses the cave traps' rule (cavetraps.js ctrapSting): a few percent of your HP, never below 1 HP.
const CHAZ = {
  poison: { ts: 2, tiles: new Set([297, 298, 299, 300, 301, 302, 307, 309, 310, 311, 312, 317, 318, 319, 320, 321, 322]), every: 900, k: 0.6, slow: 250 },
  spike: { ts: 2, tile: 130, cycle: 3200, warn: 600, up: 800, k: 1.1, holes: [[3.5, 4], [11.5, 4], [3.5, 12], [11.5, 12]] },
};
Object.assign(PROP_SPEC, {
  '251:0': { wf: 0.95, h: 12, push: true },   // the second grey stone block
  '266:0': { wf: 0.95, h: 12, push: true },   // ice block
  '45:0': { wf: 0.95, h: 12, push: true },    // pale ice block
  '322:0': { wf: 0.92, h: 10, breakable: true },   // a crate like bank 17's
});
// the pool becomes floor (wading), so the islands inside it can be reached; the rock in the pool (308) stays solid
{
  const ob = ocaveBuild;
  ocaveBuild = (src, name) => {
    const M = ob(src, name), P = CHAZ.poison;
    if (M && M.tileset === P.ts) {
      let n = 0; for (let i = 0; i < M.w * M.h; i++) if (M.solid[i] && P.tiles.has(M.ground[i])) { M.solid[i] = 0; n++; }
      if (n) { M.reach = new Uint8Array(M.w * M.h); floodReach(M, M.entry[0] / 16 | 0, M.entry[1] / 16 | 0); M.chazPoison = true; }
    }
    return M;
  };
}
function chazMap(w) { const M = w && w.rockCave && w.door && MAPS[w.door.key]; return M && M.origCave ? M : null; }
// the spike rows: every hole tile of the floor, each row on its own beat (so a long row of rows ripples, and you can time your way)
function chazSpikes(w, M) {
  if (w.chazSpikes) return w.chazSpikes;
  const S = CHAZ.spike, L = w.chazSpikes = [];
  if (M.tileset === S.ts) for (let i = 0; i < M.w * M.h; i++) if (M.ground[i] === S.tile) { const x = i % M.w, y = (i - x) / M.w; L.push({ x, y, ph: (y * 700 + (x >> 2) * 350) % S.cycle }); }
  return L;
}
// 0 down, 0..1 rising tips (warning), 1 up
function chazSpikeUp(s, now) {
  const S = CHAZ.spike, t = (now + s.ph) % S.cycle, upAt = S.cycle - S.up, warnAt = upAt - S.warn;
  return t >= upAt ? 1 : t >= warnAt ? 0.3 * (t - warnAt) / S.warn : 0;
}
function chazTick(game, w, dt) {
  const M = chazMap(w), p = w.player; if (!M || !p || p.dead || game.menu) return;
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16); if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) return;
  const g = M.ground[ty * M.w + tx], now = performance.now(), air = p.z > 0.5 || p.state === 'air';
  // poison: wading is slow and stings now and then
  const P = CHAZ.poison;
  w.chazPT = Math.max(0, (w.chazPT || 0) - dt);
  if (M.tileset === P.ts && P.tiles.has(g) && !air && !onPlank(M, p)) {
    p.status.slow = Math.max(p.status.slow || 0, P.slow);
    if (w.chazPT <= 0 && ctrapSting(w, p, null, P.k, '#b07aff')) {
      w.chazPT = P.every;
      if (!w.chazPoisonTold) { w.chazPoisonTold = true; floatText(w, p.x, p.y - 46, 'Poison!', '#c8a0ff', 9); }
      for (let i = 0; i < 4; i++) w.particles.push({ x: p.x + rand(-6, 6), y: p.y - 1, vx: rand(-12, 12), vy: rand(-40, -18), t: 0, life: rand(350, 550), col: i % 2 ? '#b07aff' : '#7ad86a', size: 1.8, drag: 0.92 });
    }
  }
  // spikes: a sting when they stand under you
  if (g === CHAZ.spike.tile && !air) {
    const s = chazSpikes(w, M).find(q => q.x === tx && q.y === ty);
    if (s && chazSpikeUp(s, now) >= 1 && ctrapSting(w, p, null, CHAZ.spike.k, '#e8e8f0')) {
      if (!w.chazSpikeTold) { w.chazSpikeTold = true; floatText(w, p.x, p.y - 46, 'Spikes! Watch the tips', '#e8e8f0', 8); }
    }
  }
}
// the plank bridges (objA bank 12, drawn 14 px either side of their centre) are safe footing over the pool
function onPlank(M, p) {
  if (!M.chazPlanks) M.chazPlanks = (M.objA || []).filter(o => +o[0] === 12).map(o => { const r = objRec('012', o[1]); return r ? [o[2] + r[4] - 2, o[3] + r[5] - 4, r[2] + 4, r[3] + 8] : null; }).filter(Boolean);
  return M.chazPlanks.some(([x, y, bw, bh]) => p.x >= x && p.x <= x + bw && p.y >= y && p.y <= y + bh);
}
// four short spikes in each hole: grey metal with a dark edge and a light side, like the floor's own iron
function drawCaveSpikes(w) {
  const M = chazMap(w), now = performance.now(); if (!M) return;
  const L = chazSpikes(w, M); if (!L.length) return;
  for (const s of L) {
    const k = chazSpikeUp(s, now); if (k <= 0) continue;
    const ox = s.x * 16, oy = s.y * 16;
    for (const [hx, hy] of CHAZ.spike.holes) {
      const x = Math.round(ox + hx), y = Math.round(oy + hy) + 1, h = Math.max(1, Math.round(6 * k));
      ctx.fillStyle = '#3a3a46'; ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x, y - h - 1); ctx.lineTo(x + 2.5, y); ctx.fill();
      ctx.fillStyle = '#c9c9d4'; ctx.beginPath(); ctx.moveTo(x - 1.6, y - 0.5); ctx.lineTo(x, y - h); ctx.lineTo(x + 1.6, y - 0.5); ctx.fill();
      ctx.fillStyle = '#f4f4fa'; ctx.fillRect(x - 0.5, y - h + 0.5, 1, Math.max(1, h * 0.5));
    }
  }
}
{
  const rt = rcTick;
  rcTick = (game, w, dt = 16) => { const r = rt(game, w, dt); try { chazTick(game, w, dt); } catch (e) { if (!chazTick.warned) { chazTick.warned = true; console.warn('cavehazards', e); } } return r; };
  const dd = drawDust;
  drawDust = (world, now) => { const r = dd(world, now); try { if (world && world.rockCave) drawCaveSpikes(world); } catch (e) {} return r; };
}
