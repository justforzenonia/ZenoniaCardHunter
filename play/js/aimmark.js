'use strict';
// AIM MARK: spells turn to face the nearest foe within 170 px (combat.js castSpell, nearestEnemy). That foe now wears four
// tiny white pixel corners round its feet, so you can see who your next spell will hit. It shows only while one of your
// spells is ready, fades in and out, and slides to a new foe instead of jumping. Only on your own hero, never in menus.
const AIM_MARK = { r: 170, w: 18, h: 9, fade: 160, alpha: 0.85 };
{
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => { const r = tf(game, now); drawAimMark(game, now); return r; };
}
function drawAimMark(game, now) {
  const w = game.world, p = w && w.player, M = AIM_MARK;
  if (!p || (game.scene !== 'world' && !(game.scene === 'arena' && game.arena && game.arena.training)) || !w.cam || (typeof SET !== 'undefined' && SET.hints === false)) return;   // (Settings > COMBAT HINTS)
  const ready = !game.menu && !p.dead && (p.spells || []).some((sp, i) => sp && !((p.cds || [])[i] > 0));
  const t = ready ? nearestEnemy(w, p, M.r) : null;
  const S = w.aimMark = w.aimMark || { a: 0, x: 0, y: 0, last: now };
  const dt = Math.min(100, now - S.last); S.last = now;
  if (t && !t.dead) { if (S.a <= 0) { S.x = t.x; S.y = t.y; } S.x += (t.x - S.x) * Math.min(1, dt / 70); S.y += (t.y - S.y) * Math.min(1, dt / 70); S.a = Math.min(1, S.a + dt / M.fade); S.sc = t.scale || 1; }
  else S.a = Math.max(0, S.a - dt / M.fade);
  if (S.a <= 0) return;
  const Z = w.zoom || ZOOM, b = Math.sin(now / 300) * 0.6, hw = Math.round(M.w * (S.sc || 1) + b), hh = Math.round(M.h * (S.sc || 1) + b * 0.5);
  ctx.save(); ctx.globalAlpha = S.a * M.alpha; ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round((S.x - w.cam.x) * Z), Math.round((S.y - w.cam.y) * Z)); ctx.scale(Z, Z);
  ctx.fillStyle = '#ffffff';
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // each corner: a 4 px L
    const x = sx * hw, y = sy * hh;
    ctx.fillRect(sx < 0 ? x : x - 3, y, 4, 1);
    ctx.fillRect(x, sy < 0 ? y : y - 3, 1, 4);
  }
  ctx.restore();
}
