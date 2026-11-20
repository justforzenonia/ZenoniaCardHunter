'use strict';
// THE FUSION HOW-TO (2026-11-13, the user: "when using fusion, show a how-to guide explaining everything"). Four short pages on a
// cocoa panel, shown the first time you open the merge altar (pr.fusionGuide), and again any time with H or the "? How it works"
// button on the altar. ← → (or click) turn the pages; Esc / Enter on the last page close it.
// It says what the game really does: merging makes the fusion card; the card works INSIDE the Layer (C raises the Guardian Halo,
// layerswords.js); the Layer's three swords come with the Layer itself. Outside the Layer, C used to do nothing at all: it now
// says so, once in a while, instead of silence.
const FGUIDE_PAGES = [
  { title: 'MERGING CARDS', lines: [
    'Pick 2 or 3 cards on this altar and merge them into one FUSION card.',
    'It takes the best rank among them, and one rank higher when you merge 3.',
    'Its power is all of their power together: x1.5 for two cards, x2.2 for three.',
    'A merge can fail (about 1 in 10 at rank F, nearly 1 in 2 at SSS+), and then the cards break.',
    'PROTECT (T) pays a little gold first: if the merge fails, your cards are kept.'] },
  { title: 'SETTING YOUR FUSION CARD', lines: [
    'Your fusion card is the 4th card on your skill bar, the one marked C.',
    'In the Spell Deck (Tab), point at a fusion card and press G or Space to set it.',
    'The gold bar over your skills fills as you land hits; spells fill it faster.',
    'The fusion card does its work inside the LAYER: see the next pages.'] },
  { title: 'THE LAYER', lines: [
    'Press V (or Space; LAYER on a phone) when it is ready: you transcend for 20 seconds.',
    'Your hair and outfit turn white, your spells hit harder,',
    'and three little swords of your element hover behind you, slicing the nearest foe now and then.',
    'Afterwards the Layer rests for a while before it is ready again.'] },
  { title: 'FUSION IN THE LAYER', lines: [
    'While Layered, press C (FUSE on a phone): your fusion card raises the GUARDIAN HALO.',
    'The halo takes the next hit for you, whole, and answers with a lance of light.',
    'Each block burns a fifth of its fuel; a stronger fusion card means more fuel. Once per Layer.',
    'Q / E / R also pick spells while Layered: press V again to fire them all at once, 1.8x as strong.'] },
];
const FGUIDE = { x: 90, y: 60, w: 460, h: 230, btn: { x: 14, y: 12, w: 132, h: 14 } };   // (top left: clear of the slots and the card grid)
function fguideOpen(m) { m.guide = { page: 0, t: performance.now() }; }
{
  const mm = mergeMenu;
  mergeMenu = (...a) => { const m = mm(...a); const pr = window.GAME && GAME.profile; if (pr && !pr.fusionGuide) { pr.fusionGuide = true; fguideOpen(m); } return m; };
  const uf = updateFusion;
  updateFusion = (game, m, dt) => {
    if (m.guide) {
      const G = m.guide, n = FGUIDE_PAGES.length;
      if (hit('ArrowRight', 'KeyD') || (mouse.click && mouse.x > VW / 2)) G.page = Math.min(n - 1, G.page + 1);
      else if (hit('ArrowLeft', 'KeyA') || (mouse.click && mouse.x <= VW / 2)) G.page = Math.max(0, G.page - 1);
      if (hit('Escape') || (hit('Enter', 'Space') && G.page === n - 1)) m.guide = null;
      else if (hit('Enter', 'Space')) G.page++;
      mouse.click = false; return;
    }
    if (!m.result && !m.fail && (hit('KeyH') || clicked(FGUIDE.btn.x, FGUIDE.btn.y, FGUIDE.btn.w, FGUIDE.btn.h))) { fguideOpen(m); mouse.click = false; return; }
    return uf(game, m, dt);
  };
  const df = drawFusion;
  drawFusion = (game, m, now) => {
    const r = df(game, m, now);
    if (!m.result && !m.fail) { const B = FGUIDE.btn; ctx.fillStyle = 'rgba(58,36,20,0.92)'; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill(); text('? How fusion works (H)', B.x + B.w / 2, B.y + B.h / 2 + 0.5, '#ffe9a8', 7); }
    if (!m.guide) return r;
    const G = m.guide, P = FGUIDE_PAGES[G.page], F = FGUIDE, k = Math.min(1, (performance.now() - G.t) / 220);
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(8,4,2,0.6)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = typeof WIN_FILL !== 'undefined' ? WIN_FILL : 'rgba(36,22,14,0.97)'; rrect(ctx, F.x, F.y, F.w, F.h, 8); ctx.fill();
    ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 1.2; rrect(ctx, F.x + 0.5, F.y + 0.5, F.w - 1, F.h - 1, 8); ctx.stroke();
    text(`HOW FUSION WORKS · ${G.page + 1} / ${FGUIDE_PAGES.length}`, F.x + F.w / 2, F.y + 16, '#c9b89a', 7);
    goldTitle(P.title, F.x + F.w / 2, F.y + 36, 12, now);
    let y = F.y + 62;
    for (const L of P.lines) {   // (wrapped to the panel)
      const words = trSplit(L), sp = trSp(); let cur = '';
      for (const wd of words) { const t = cur ? cur + sp + wd : wd; if (textW(t, 8) > F.w - 48 && cur) { text(cur, F.x + 24, y, '#f4ead8', 8, 'left'); y += 12; cur = wd; } else cur = t; }
      text(cur, F.x + 24, y, '#f4ead8', 8, 'left'); y += 17;
    }
    for (let i = 0; i < FGUIDE_PAGES.length; i++) { ctx.fillStyle = i === G.page ? '#ffd860' : '#6a5a48'; ctx.beginPath(); ctx.arc(F.x + F.w / 2 + (i - 1.5) * 12, F.y + F.h - 26, 3, 0, Math.PI * 2); ctx.fill(); }
    text(G.page < FGUIDE_PAGES.length - 1 ? '← → turn the page · Enter next · Esc close' : '← back · Enter / Esc close', F.x + F.w / 2, F.y + F.h - 12, '#c9b89a', 7);
    ctx.restore();
    return r;
  };
}
// C outside the Layer: a gentle word instead of nothing (at most every 4 s)
{
  const uw = updateWorldScene;
  updateWorldScene = (...a) => {
    const g = window.GAME, w = g && g.world, p = w && w.player;
    if (g && !g.menu && p && !p.dead && !(p.transcend > 0) && !p.driving && hit(...(SOLO.fsel || ['KeyC']))) {
      const now = performance.now();
      if (!(p.fuseHintT > now)) { p.fuseHintT = now + 4000; floatText(w, p.x, p.y - 44, p.fusion ? 'Fusion works in the Layer: V first, then C' : 'No fusion card yet: merge one at the altar', '#ffe9a8', 8); }
    }
    return uw(...a);
  };
}
