'use strict';
// UNSTICK: a partner or pet following you walks straight for its place behind you (combat.js followSpot), and a tree or a wall
// in the way simply stops it. Unless you walk more than 260 px off (when it is brought to you), it would push against that tree
// for good. So: one that has been trying to walk for a moment and has hardly moved hops to an open spot beside you, with a puff.
const UNSTICK = { wait: 900, moved: 0.2 };   // (moved: the share of the step it should have made that counts as getting somewhere)
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    const x0 = m.x, y0 = m.y, r = ai(world, m, dt);
    if (!m.ally || !m.owner || m.dead || m.riding || world.home || !m.pacing) { m.stuckT = 0; return r; }
    const o = m.owner, want = speedOf(m) * 1.3 * dt / 1000, moved = Math.hypot(m.x - x0, m.y - y0);
    if (Math.hypot(m.x - o.x, m.y - o.y) < 30 || moved >= want * UNSTICK.moved) { m.stuckT = 0; return r; }
    m.stuckT = (m.stuckT || 0) + dt;
    if (m.stuckT >= UNSTICK.wait) {
      m.stuckT = 0;
      world.particles.push(...Array.from({ length: 8 }, (_, i) => ({ x: m.x, y: m.y - 10, vx: Math.cos(i * 0.785) * 50, vy: Math.sin(i * 0.785) * 30, t: 0, life: 360, col: '#e8f4ff', size: 2, drag: 0.9 })));
      const side = (m.slot || 0) % 2 ? 1 : -1, q = findOpen(world, o.x + side * 18, o.y + 6);
      m.x = q.x; m.y = q.y; m.vx = m.vy = 0; m.pacing = false;
      world.rings.push({ x: m.x, y: m.y, r: 14, t: 0, col: '#e8f4ff' });
    }
    return r;
  };
}
// THE HERO, BOXED IN (2026-11-20, the user: "im stuck"): a rock cave's one-tile nook let the hero in and, a pixel off centre, not out
// again: every way blocked. One who cannot take a step in any direction for a moment steps out to the nearest open ground.
const HERO_TRAP = { wait: 700, step: 8, r: 24 };
function heroTrapTick(game, w, dt) {
  const p = w && w.player; if (!p || p.dead || game.menu || p.state !== 'free' || p.riding) { if (p) p.trapT = 0; return; }
  const S = HERO_TRAP.step, shut = (x, y) => [[S, 0], [-S, 0], [0, S], [0, -S]].every(([dx, dy]) => w.blocked(x + dx, y + dy, p));
  if (!shut(p.x, p.y)) { p.trapT = 0; return; }
  if ((p.trapT = (p.trapT || 0) + dt) < HERO_TRAP.wait) return;
  p.trapT = 0;
  const tx0 = Math.floor(p.x / T), ty0 = Math.floor(p.y / T);
  for (let r = 1; r <= HERO_TRAP.r; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = (tx0 + dx) * T + 8, y = (ty0 + dy) * T + 8;
    if (w.map && w.map.reach && !mapReach(w.map, x, y)) continue;
    if (w.blocked(x, y, p) || shut(x, y)) continue;
    w.rings.push({ x: p.x, y: p.y, r: 14, t: 0, col: '#ffffff' });
    p.x = x; p.y = y; p.vx = p.vy = 0; return;
  }
}
{
  const ui = updateInterior;
  updateInterior = (game, w, dt, inp) => { heroTrapTick(game, w, dt); return ui(game, w, dt, inp); };
  const uo = updateOverworld;
  updateOverworld = (game, w, dt) => { heroTrapTick(game, w, dt); return uo(game, w, dt); };
}
