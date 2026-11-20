'use strict';
// JOURNAL in the pause menu: UNLOCKS (unlocks.js), ALBUM (photo.js) and GUIDE (sessionrecap.js) were three options of their own,
// and with eight the buttons grew cramped. They now sit in one JOURNAL list. Each still opens its own screen exactly as before
// (by m.view), and closing that screen comes back to the Journal; Esc there goes back to the pause menu.
const JOURNAL = [
  { id: 'unlocks', title: 'UNLOCKS', sub: "What's open, and what comes next", col: '#ffe08a' },
  { id: 'album', title: 'ALBUM', sub: 'Your photos (F2 takes one)', col: '#ffd0e8' },
  { id: 'guide', title: 'GUIDE', sub: 'Every system explained, in a new tab', col: '#b8e0a0' },
];
{
  const at = PAUSE_OPTS.findIndex(o => o.id === 'unlocks');
  for (const id of ['unlocks', 'album', 'guide']) { const i = PAUSE_OPTS.findIndex(o => o.id === id); if (i >= 0) PAUSE_OPTS.splice(i, 1); }
  PAUSE_OPTS.splice(at >= 0 ? at : PAUSE_OPTS.findIndex(o => o.id === 'hub'), 0, { id: 'journal', title: 'JOURNAL', sub: 'Unlocks, your photo album and the guide', col: '#ffe9a8' });
}
const journalBtn = i => ({ x: VW / 2 - 130, y: 112 + i * 40, w: 260, h: 34 });
function journalOpen(game, m, id) {
  m.fromJournal = true; m.t = 0;
  if (id === 'unlocks') m.view = 'unlocks';
  else if (id === 'album') {
    m.view = 'album'; m.pick = 0; m.big = false; m.album = null;
    fetch('photo/list').then(r => (r.ok ? r.json() : [])).then(l => { m.album = Array.isArray(l) ? l : []; if (!m.album.length) m.pick = -1; }).catch(() => { m.album = []; m.pick = -1; });
  } else if (id === 'guide') { m.fromJournal = false; try { window.open('guide/index.html', '_blank'); } catch (e) {} game.toast('The guide opened in a new tab', '#b8e0a0'); }
}
{
  const up = updatePause;
  updatePause = (game, m, dt) => {
    if (m.view === 'journal') {
      m.t += dt; const k = navInput(), n = JOURNAL.length; m.jcur = m.jcur || 0;
      if (k.u) m.jcur = (m.jcur + n - 1) % n; if (k.d) m.jcur = (m.jcur + 1) % n;
      JOURNAL.forEach((o, i) => { const B = journalBtn(i); if (clicked(B.x, B.y, B.w, B.h)) { if (m.jcur === i) k.ok = true; m.jcur = i; } });
      if (k.back && m.t > 120) { m.view = null; m.t = 0; return; }
      if (k.ok && m.t > 120) journalOpen(game, m, JOURNAL[m.jcur].id);
      return;
    }
    const was = m.view, r = (() => {
      if (!m.view) {   // JOURNAL picked in the pause menu
        const i = PAUSE_OPTS.findIndex(o => o.id === 'journal'), B = PAUSE_BTN(i), k = navInput();
        if (m.cur === i && (k.ok || clicked(B.x, B.y, B.w, B.h))) { m.view = 'journal'; m.t = 0; return true; }
      }
      return up(game, m, dt);
    })();
    if (r !== true && m.fromJournal && (was === 'unlocks' || was === 'album') && !m.view && game.menu === m) { m.view = 'journal'; m.t = 0; m.fromJournal = false; }   // (closing a Journal screen comes back here)
    return r === true ? undefined : r;
  };
  const dp = drawPause;
  drawPause = (game, m, now) => {
    dp(game, m, now);
    if (m.view !== 'journal') return;
    const W = 300, H = 46 + JOURNAL.length * 40 + 14, x = VW / 2 - W / 2, y = 78;
    ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#100a18'; rrect(ctx, x, y, W, H, 6); ctx.fill();
    ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
    goldText('JOURNAL', VW / 2, y + 16, 12, { spacing: 3 });
    JOURNAL.forEach((o, i) => {
      const B = journalBtn(i), sel = i === (m.jcur || 0);
      ctx.save(); if (sel) { ctx.shadowColor = o.col; ctx.shadowBlur = 8 * RES; }
      panel(B.x, B.y, B.w, B.h, sel ? o.col : 'rgba(201,168,90,0.55)', sel ? 'rgba(62,41,26,0.95)' : 'rgba(30,20,13,0.9)'); ctx.restore();
      if (sel) { ctx.fillStyle = o.col; ctx.fillRect(B.x + 1, B.y + 1, 3, B.h - 2); }
      text(o.title, B.x + 14, B.y + 12, sel ? o.col : '#e8e2cf', 9, 'left');
      text(o.sub, B.x + 14, B.y + 25, '#d0c8dc', 7, 'left');
    });
    text('↑↓ choose · Enter: open · Esc: back', VW / 2, y + H - 9, '#b8ae96', 7);
  };
}
// NEW IN ZENONIA: a returning hero (more than 10 minutes played) gets one card, once, about what arrived since: photos and the
// album, the bed, the diary, the Journal. A brand-new hero skips it (they meet each thing as they go). Bump NEWS_V for the next set.
const NEWS_V = 1, NEWS_CARD = { head: 'NEW IN ZENONIA', title: 'Things to try tonight', show: 12000, lines: [
  'F2 takes a photo of the world · Esc ▸ JOURNAL ▸ ALBUM shows them',
  'Sleep in your bed at home to end the night: rested EXP grows faster',
  'On the title, D opens your diary of past sessions',
] };
function newsTick(game) {
  const pr = game.profile, w = game.world;
  if (!pr || (pr.newsSeen || 0) >= NEWS_V || !w || game.menu || game.goalCard || game.unlockCard || game.levelFx || game.welcomeRead !== pr) return;
  if (game.net && game.net.role === 'guest') return;
  if ((pr.playMs || 0) < 600000) { pr.newsSeen = NEWS_V; return; }   // (a new hero: nothing is "new" yet)
  if (!w.overworld || w.interior) return;   // (out in the open, where the card has room)
  pr.newsSeen = NEWS_V; game.goalCard = { at: performance.now(), ...NEWS_CARD, lines: NEWS_CARD.lines.slice() }; game.save();
}
{
  const uw = updateWorldScene;
  updateWorldScene = dt => { if (window.GAME) try { newsTick(GAME); } catch (e) {} return uw(dt); };
}
