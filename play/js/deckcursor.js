'use strict';
// A KEYBOARD / GAMEPAD CURSOR ON THE SPELL DECK PAGE (2026-11-08): the page was built for the mouse (the card "pointed at" was the
// one under the pointer), so with keys or a controller nothing seemed to move. Now ← → pick a card in the strip (it scrolls to
// follow), and that card is the one Enter (details), Q/E/R (put on a spell key) and X (take out) act on. A gold frame shows it.
// Moving the mouse hands control back to the pointer.
const DECK_KC = { lastMx: -1, lastMy: -1 };
{
  const ud = updateDeckTab;
  updateDeckTab = (game, m) => {
    const pr = game.profile;
    if (mouse.x !== DECK_KC.lastMx || mouse.y !== DECK_KC.lastMy) { if (DECK_KC.lastMx >= 0) m.kcOn = false; DECK_KC.lastMx = mouse.x; DECK_KC.lastMy = mouse.y; }
    const list = tfList(pr, m), vis = tfVisible();
    if (list.length && hit('ArrowLeft', 'ArrowRight', 'KeyA')) {
      const d = hit('ArrowLeft', 'KeyA') ? -1 : 1;
      m.kc = m.kcOn ? Math.max(0, Math.min(list.length - 1, (m.kc || 0) + d)) : Math.max(0, Math.min(list.length - 1, m.sx || 0));
      m.kcOn = true;
      m.sx = Math.max(0, Math.min(Math.max(0, list.length - vis), m.kc < (m.sx || 0) ? m.kc : m.kc >= (m.sx || 0) + vis ? m.kc - vis + 1 : (m.sx || 0)));
      consume('ArrowLeft', 'ArrowRight', 'KeyA');   // (the page's own ←/→ scrolled the strip; the cursor does that now)
    }
    if (m.kcOn) m.kc = Math.max(0, Math.min(list.length - 1, m.kc || 0));
    return ud(game, m);
  };
  const th = tfHovered;
  tfHovered = (pr, m) => { const h = th(pr, m); if (h || !m.kcOn) return h; const st = tfList(pr, m)[m.kc || 0]; return st ? st.c : null; };
  const dd = drawDeckPage;
  drawDeckPage = function (game, m, now) {
    const r = dd.apply(this, arguments);
    if (m.kcOn) { const i = (m.kc || 0) - (m.sx || 0); if (i >= 0 && i < tfVisible()) { const P = tfScrollPos(i), SC = TF.scroll, k = 0.6 + 0.4 * Math.sin(now / 180);
      ctx.save(); ctx.strokeStyle = `rgba(255,216,96,${k})`; ctx.lineWidth = 2; rrect(ctx, P.x - 2, P.y - 2, SC.cw + 4, SC.ch + 4, 4); ctx.stroke(); ctx.restore(); } }
    return r;
  };
}
