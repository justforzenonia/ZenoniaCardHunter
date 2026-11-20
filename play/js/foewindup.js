'use strict';
// A BREATH BEFORE THE SPELL: ordinary hostile monsters used to cast the instant they chose to (combat.js monsterCast; only
// bosses wound up). Now they stop for FOE_WINDUP.ms first, with a small white-bordered "!" pixel chip bobbing over them in the
// same style as the debuff and reaction chips, so there is time to step aside, block or hit them out of it. It reuses the
// boss wind-up: monsterAI holds them still and casts when it runs out, a stagger cancels it (combat.js), and the spell is a
// little easier to parry afterwards (parryEaseT). Familiars and bosses are unchanged.
const FOE_WINDUP = { ms: 500 };
REACT_CHIPS.WARN = ['#ffd23f', ['..#..', '..#..', '..#..', '.....', '..#..']];   // an "!"
{
  const mc = monsterCast;
  monsterCast = (world, m, sp) => {
    if (m.boss || m.ally || m.windup || world.dojo) return mc(world, m, sp);   // (a dojo master keeps its own pace)
    m.windup = { t: FOE_WINDUP.ms, sp, small: true };
  };
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => { const r = tf(game, now); drawFoeWindups(game, now); return r; };
}
function drawFoeWindups(game, now) {
  const w = game.world; if (!w || !w.cam || game.scene !== 'world') return;
  const Z = w.zoom || ZOOM, C = REACT_CHIPS.WARN;
  for (const m of w.actors) {
    if (!m.windup || !m.windup.small || m.dead) continue;
    const k = 1 - m.windup.t / FOE_WINDUP.ms, pop = k < 0.2 ? 1 + 0.35 * (k / 0.2) : k < 0.4 ? 1.35 - 0.35 * ((k - 0.2) / 0.2) : 1;
    const top = m.y - (m.h || 26) * (m.scale || 1) - 32 + Math.sin(now / 90) * 0.8;   // (above the name plate, where the reaction chips show: lower, it sat on the health bar)
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = Math.min(1, k * 5);
    ctx.translate(Math.round((m.x - w.cam.x) * Z), Math.round((top - w.cam.y) * Z)); ctx.scale(Z * pop, Z * pop);
    reactChip(C[0], C[1]);
    ctx.restore();
  }
}
