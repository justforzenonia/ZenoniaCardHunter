'use strict';
// DIARY: every session that ends with a recap (Save & Exit, Sleep for the night, any return to the title; sessionrecap.js) is
// written into your hero's diary (pr.diary, the newest 60): the date, how long you played and what you did. On the title,
// "D: diary (N)" under your hero opens it: newest first, up and down to read back, Esc to close.
const DIARY = { keep: 60, rows: 9, rowH: 21, W: 580 };
{
  const bt = game.backToTitle;
  game.backToTitle = function (...a) {
    const pr = this.recap0 && this.recap0.pr, r0 = this.lastRecap, out = bt.apply(this, a), R = this.lastRecap;
    if (pr && R && R !== r0 && !(this.net && this.net.role === 'guest')) {
      const D = pr.diary = pr.diary || [];
      D.unshift({ at: Date.now(), time: R.time, parts: R.parts.slice(), lv: pr.lv || 1 });
      if (D.length > DIARY.keep) D.length = DIARY.keep;
      try { saveGame(pr); if (typeof diskSave === 'function') diskSave(pr); } catch (e) {}   // (the hero was saved a moment ago: this adds the page)
    }
    return out;
  };
}
// closing the app or the tab mid-session is the usual way a night ends: that session is written too, and the hero (diary
// included) goes to the disk copy by beacon, after main.js's own (so this, the newer copy, lands last)
addEventListener('pagehide', () => {
  try {
    const G = window.GAME, R0 = G && G.recap0, pr = R0 && R0.pr;
    if (!pr || pr !== G.profile || G.scene !== 'world' || (G.net && G.net.role === 'guest')) return;
    const R = recapBuild(R0); G.recap0 = { pr, s: recapSnap(pr) };   // (counted once, even if the page comes back from the browser's cache)
    if (!R) return;
    const D = pr.diary = pr.diary || []; D.unshift({ at: Date.now(), time: R.time, parts: R.parts.slice(), lv: pr.lv || 1, closed: true });
    if (D.length > DIARY.keep) D.length = DIARY.keep;
    pr.lastPlayed = Date.now(); saveGame(pr);
    if (navigator.sendBeacon) navigator.sendBeacon('save', JSON.stringify(pr));
  } catch (e) {}
});
// a photo (photo.js) taken during a session shows on its row: the photos between the previous entry and this one, by the time in
// their file names (an entry without an older one looks back twice its play time)
const photoTime = n => { const m = /_(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)/.exec(n); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0; };
function diaryPhotos(m, D, i) {
  const e = D[i], L = m.dphotos; if (!L || !L.length) return [];
  const pm = /(\d+)h (\d+)m/.exec(e.time || ''), ms = pm ? (+pm[1] * 60 + +pm[2]) * 60000 : 0;
  const from = D[i + 1] ? D[i + 1].at : e.at - ms * 2 - 600000;
  return L.filter(q => q.t > from && q.t <= e.at + 5000);
}
// WELCOME BACK remembers last time: the newest diary entry's first three things lead the card's lines (sessionrecap.js welcomeTick)
{
  const wt = welcomeTick;
  welcomeTick = game => {
    const pr = game.profile, card = game.goalCard; wt(game);
    const C = game.goalCard, E = pr && pr.diary && pr.diary[0];
    if (C && C !== card && /^WELCOME BACK/.test(C.head || '') && E && E.parts && E.parts.length) C.lines.unshift(`Last time: ${E.parts.slice(0, 3).join(' · ')}`);
  };
}
const diaryBtn = () => ({ x: 112 - 50, y: 303, w: 100, h: 12 });   // (under the hero on the left: the middle column is busy)
{
  const ut = updateTitle;
  updateTitle = (game, m) => {
    const D = (game.saved && game.saved.diary) || [];
    if (m.diary) {
      const k = navInput(), n = D.length, max = Math.max(0, n - DIARY.rows);
      if (k.back || !n) { m.diary = false; return; }
      if (k.u) m.dtop = Math.max(0, m.dtop - 1); if (k.d) m.dtop = Math.min(max, m.dtop + 1);
      if (k.l) m.dtop = Math.max(0, m.dtop - DIARY.rows); if (k.r) m.dtop = Math.min(max, m.dtop + DIARY.rows);
      if (k.ok) m.diary = false;
      return;
    }
    const B = diaryBtn();
    if (!m.prev && D.length && (hit('KeyD') || clicked(B.x, B.y, B.w, B.h))) {
      m.diary = true; m.dtop = 0; m.dphotos = null;
      fetch('photo/list').then(r => (r.ok ? r.json() : [])).then(l => { m.dphotos = (Array.isArray(l) ? l : []).map(n => ({ n, t: photoTime(n) })).filter(q => q.t); }).catch(() => {});
      return;
    }
    return ut(game, m);
  };
  const dt = drawTitle;
  drawTitle = (game, m, now) => {
    dt(game, m, now);
    const D = (game.saved && game.saved.diary) || []; if (!D.length || m.prev) return;
    if (!m.diary) { const B = diaryBtn(); text(`D: diary (${D.length})`, B.x + B.w / 2, B.y + 7, 'rgba(208,222,255,0.92)', 7.5); return; }
    const n = Math.min(D.length, DIARY.rows), W = DIARY.W, H = 50 + n * DIARY.rowH, x = VW / 2 - W / 2, y = VH / 2 - H / 2;
    ctx.fillStyle = 'rgba(6,4,14,0.65)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = 'rgba(16,10,24,0.97)'; rrect(ctx, x, y, W, H, 6); ctx.fill();
    ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
    goldText(`${((game.saved.look && game.saved.look.name) || 'HERO').toUpperCase()}'S DIARY`, VW / 2, y + 14, 10, { spacing: 2 });
    D.slice(m.dtop, m.dtop + n).forEach((e, i) => {
      const ry = y + 34 + i * DIARY.rowH, d = new Date(e.at), ph = diaryPhotos(m, D, m.dtop + i);
      if (ph.length && typeof albumImg === 'function') {   // (the session's first photo, small, at the row's end)
        const FV = game.saved.photoFav || {}, pick = ph.find(q => FV[q.n]) || ph[ph.length - 1];   // (a ♥ favourite first, else the session's first photo)
        const im = albumImg(pick.n), tw = 30, th = 17, tx = x + W - 16 - tw, ty = ry - 8;
        ctx.fillStyle = '#281a11'; ctx.fillRect(tx, ty, tw, th); if (im) ctx.drawImage(im, tx, ty, tw, th);
        ctx.strokeStyle = 'rgba(255,208,232,0.7)'; ctx.lineWidth = 0.8; ctx.strokeRect(tx - 0.5, ty - 0.5, tw + 1, th + 1);
        if (ph.length > 1) text(`+${ph.length - 1}`, tx - 4, ry + 1, '#ffd0e8', 7, 'right');
      }
      if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x + 8, ry - 8, W - 16, DIARY.rowH - 2); }
      text(d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), x + 16, ry - 3, '#ffe9a8', 7.5, 'left');
      text(`${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${e.time} · Lv ${e.lv}`, x + 16, ry + 6, '#b8ae96', 7, 'left');
      if (e.parts.length > 3) { const h = Math.ceil(e.parts.length / 2); text(e.parts.slice(0, h).join('  ·  '), x + 160, ry - 3, '#e8e2cf', 7, 'left'); text(e.parts.slice(h).join('  ·  '), x + 160, ry + 6, '#e8e2cf', 7, 'left'); }   // (a big day takes two lines)
      else text(e.parts.join('  ·  '), x + 160, ry + 2, '#e8e2cf', 7.5, 'left');
    });
    const more = D.length > n ? `   ·   ${m.dtop + 1}–${m.dtop + n} of ${D.length}` : '';
    text(`↑↓ read back · Esc: close${more}`, VW / 2, y + H - 9, '#b8ae96', 7);
  };
}
// KEEPSAKE on the title: one of your photos as a little tilted polaroid on the right, balancing your hero on the left. A ♥
// favourite (photo.js) when you have any (a different one each visit to the title), otherwise the newest photo.
const KEEP = { x: VW - 112, y: 246, w: 92, h: 52, tilt: -0.06 };
function keepsakePick(game) {
  const K = game.keepsake || (game.keepsake = { list: null, at: 0 });
  if (!K.list && !K.loading && !/[?&]join=/.test(location.search)) { K.loading = true; fetch('photo/list').then(r => (r.ok ? r.json() : [])).then(l => { K.list = Array.isArray(l) ? l : []; K.loading = false; }).catch(() => { K.list = []; K.loading = false; }); }
  if (!K.list || !K.list.length || !game.saved) return null;
  if (!K.name || K.for !== game.saved || !K.list.includes(K.name)) {
    const FV = game.saved.photoFav || {}, favs = K.list.filter(n => FV[n]);
    K.name = favs.length ? favs[Math.floor(Math.random() * favs.length)] : K.list[0]; K.for = game.saved;
  }
  return K.name;
}
{
  const dt = drawTitle;
  drawTitle = (game, m, now) => {
    dt(game, m, now);
    if (m.diary || m.prev || !game.saved) return;
    const name = keepsakePick(game), im = name && typeof albumImg === 'function' ? albumImg(name) : null; if (!im) return;
    const K = KEEP, fav = game.saved.photoFav && game.saved.photoFav[name];
    ctx.save(); ctx.translate(K.x, K.y); ctx.rotate(K.tilt + Math.sin(now / 2600) * 0.006);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8 * RES; ctx.fillStyle = '#f4ecd8'; ctx.fillRect(-K.w / 2 - 4, -K.h / 2 - 4, K.w + 8, K.h + 12); ctx.shadowBlur = 0;
    ctx.drawImage(im, -K.w / 2, -K.h / 2, K.w, K.h); ctx.fillStyle = 'rgba(28,18,12,0.18)'; ctx.fillRect(-K.w / 2, -K.h / 2, K.w, K.h);   // (a touch of dusk, to sit with the dark title)
    ctx.restore();
    // its words sit upright below it, in the same colours as the hero's name and class on the left, so they read easily
    const place = game.saved.photoCaps && game.saved.photoCaps[name], when = typeof albumWhen === 'function' ? albumWhen(name).split(',').slice(0, 2).join(',') : '';
    text(`${fav ? '♥ ' : ''}${place || 'Keepsake'}`, K.x, K.y + 42, fav ? '#ffd0e8' : '#fff4e0', 8);
    text(when, K.x, K.y + 53, '#e8be64', 7);
  };
}
// a new photo or heart changes the keepsake next time the title shows
{
  const bt = game.backToTitle;
  game.backToTitle = function (...a) { if (this.keepsake) this.keepsake = null; return bt.apply(this, a); };
}
