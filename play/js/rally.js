'use strict';
// RALLY: a gentle safety net for a calm game. The first time a hit drops your hero from above RALLY.at to below it, they
// steady themselves: RALLY.invuln ms of no damage and RALLY.heal of max HP back, a small green-and-white chip over them, and
// a soft two-note music-box chime. Then it rests for RALLY.cd ms. It never saves you from a hit that defeats you outright,
// and it stays out of duels (a hostile hero in the world). Your hero and, on the host, each online co-op friend's.
const RALLY = { at: 0.15, invuln: 1200, heal: 0.1, cd: 90000 };
REACT_CHIPS.RALLY = ['#8fffb0', ['..#..', '..#..', '#####', '..#..', '..#..']];   // a small plus
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const was = def && def.kind === 'player' ? def.hp : null, r = dd(world, att, def, opts);
    if (was != null && world && (def === world.player || def.netGid) && !def.dead && !def.dying && def.hp > 0) {
      const lim = def.maxHp * RALLY.at, now = performance.now();
      if (was >= lim && def.hp < lim && !(def.rallyAt && now - def.rallyAt < RALLY.cd) && !enemiesOf(world, def).some(o => o.kind === 'player' && !o.dead))
        rally(world, def, now);
    }
    return r;
  };
}
function rally(world, a, now) {
  a.rallyAt = now; a.invuln = Math.max(a.invuln || 0, RALLY.invuln);
  a.hp = Math.min(a.maxHp, a.hp + a.maxHp * RALLY.heal);
  floatText(world, a.x, a.y - 60, REACT_ICON_MARK + 'RALLY', '#8fffb0', 7.5);
  for (let i = 0; i < 6; i++) world.particles.push({ x: a.x + (i % 2 ? -1 : 1) * rand(8, 14), y: a.y - rand(2, 14), vx: rand(-3, 3), vy: rand(-22, -14), t: 0, life: 700, col: i % 2 ? '#ffffff' : '#8fffb0', size: 2 });
  const G = window.GAME;
  if (G && a === world.player) { bumpStat('rallies'); if (typeof cuePlay === 'function') cuePlay([440, 587]); if (typeof tipEvent === 'function') tipEvent(G, 'rally'); }
  else if (G && a.netGid && typeof netStatTo === 'function') netStatTo(G, a.netGid, 'rallies');
}
// ONLINE CO-OP: the host runs a friend's Rally and Flawless, so the friend only receives the float (net.js netApply). When it
// lands on their own hero, their game plays the same soft chime and shows the first-time tip.
const NET_FLOAT_CHIME = { RALLY: [[440, 587], 'rally'], FLAWLESS: [[523, 659, 784], 'flawless'] };
function netFloatChime(game, w, f) {
  if (!f || typeof f.s !== 'string' || !f.s.startsWith(REACT_ICON_MARK)) return;
  const C = NET_FLOAT_CHIME[f.s.slice(REACT_ICON_MARK.length)], p = w && w.player; if (!C || !p) return;
  if (Math.abs(f.x - p.x) > 30 || Math.abs(f.y - (p.y - 60)) > 30) return;   // (someone else's: no chime)
  const k = f.s, now = performance.now(), A = game.netChimeAt = game.netChimeAt || {};
  if (A[k] && now - A[k] < 1500) return; A[k] = now;   // (the same float can come in two snapshots: one chime)
  if (typeof cuePlay === 'function') cuePlay(C[0]);
  if (typeof tipEvent === 'function') tipEvent(game, C[1]);
}
// While a rally keeps a hero safe, a soft green ring sits at their feet and fades as the safety runs out (calm: thin, no
// flash). Drawn for every hero in view whose rally this game ran (yours; on the host also each friend's).
{
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => { const r = tf(game, now); drawRallyRings(game, now); return r; };
}
function drawRallyRings(game, now) {
  const w = game.world; if (!w || !w.cam || (game.scene !== 'world' && game.scene !== 'arena')) return;
  const Z = w.zoom || ZOOM;
  for (const a of w.actors) {
    if (a.kind !== 'player' || a.dead || !a.rallyAt) continue;
    const t = now - a.rallyAt; if (t < 0 || t > RALLY.invuln) continue;
    const k = 1 - t / RALLY.invuln, x = (a.x - w.cam.x) * Z, y = (a.y - w.cam.y) * Z, r = (11 + 2 * Math.sin(now / 160)) * Z;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.45 * k; ctx.strokeStyle = '#8fffb0'; ctx.lineWidth = Math.max(1, Z * 0.7);
    ctx.beginPath(); ctx.ellipse(x, y - Z, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}
