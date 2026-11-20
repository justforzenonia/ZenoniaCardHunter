'use strict';
// MIRROR (the pause menu): the Stylist without walking to her shop. Esc ▸ MIRROR opens the same Stylist screen (your look, the
// weapon look, the wardrobe and the Partner colours) anywhere in the world, as long as no monster is close (MIRROR.calm px) and
// you are not a guest in someone else's online game. Leaving it puts you straight back where you were.
const MIRROR = { calm: 220, col: '#f0c8ff' };
PAUSE_OPTS.splice(Math.max(0, PAUSE_OPTS.findIndex(o => o.id === 'inv') + 1), 0, { id: 'mirror', title: 'MIRROR', sub: 'Change your look here (with no monster near)', col: MIRROR.col });
function mirrorBlocked(game) {
  const w = game.world, p = w && w.player;
  if (game.scene !== 'world' || !p || p.dead) return 'The mirror is for when you are out and about';
  if (game.net && game.net.role === 'guest') return 'Visit the Stylist in your own world to change your look';
  if (w.actors.some(a => a.kind === 'monster' && !a.dead && !a.ally && !a.pet && Math.hypot(a.x - p.x, a.y - p.y) < MIRROR.calm)) return 'Not with a monster this close · step away first';
  return null;
}
{
  const up = updatePause;
  updatePause = (game, m, dt) => {
    const i = PAUSE_OPTS.findIndex(o => o.id === 'mirror'), B = PAUSE_BTN(i), k = navInput();
    if (!m.view && m.cur === i && (k.ok || clicked(B.x, B.y, B.w, B.h))) {
      const why = mirrorBlocked(game); if (why) { game.toast(why, '#ffb0a0'); return; }
      consume('Enter'); game.menu = customMenu(game.profile.cls, game.profile); return;
    }
    return up(game, m, dt);
  };
}
