'use strict';
// PREVIOUS HEROES on the title: the server keeps a hero that a New Game (or another hero) replaced (tools/serve.py save_archive).
// When there are any, the title shows "P: previous heroes (N)". P (or a click on it) opens the list: up/down to choose, Enter twice
// to bring that hero back. The current hero is archived first, so nothing is lost either way. Esc goes back.
const PREV = { y: 302, rows: 8, rowH: 18 };
// where the 'P: previous heroes' line sits: with a saved hero, on the left under it (and under 'D: diary', diary.js), so the
// hero's own links stay together and the middle keeps to the session recap; with no hero, in the middle as before
const prevAt = game => game.saved ? { x: 112, y: game.saved.diary && game.saved.diary.length ? 320 : 309 } : { x: VW / 2, y: PREV.y };
function prevHeroesLoad(game) {
  if (game.prevLoading || /[?&]join=/.test(location.search)) return;
  game.prevLoading = true;
  fetch('save/list').then(r => (r.ok ? r.json() : [])).then(list => { game.prevHeroes = Array.isArray(list) ? list : []; }).catch(() => { game.prevHeroes = []; });
}
function prevHeroRestore(game, row) {
  fetch('save/archive?f=' + encodeURIComponent(row.f)).then(r => (r.ok ? r.json() : null)).then(p => {
    if (!p || !p.lv) { game.toast('That hero could not be read', '#ff8a8a'); return; }
    saveGame(p); game.saved = migrateProfile(p);
    fetch('save?keep=1', { method: 'POST', body: JSON.stringify(p) }).catch(() => {}).then(() => { game.prevLoading = false; prevHeroesLoad(game); });   // (the hero it replaces goes into the archive)
    game.menu = { type: 'title', cur: 1 };
    game.toast(`${(p.look && p.look.name) || 'Your hero'}, Lv ${p.lv}, is back. Press CONTINUE.`, '#8fffb0');
  }).catch(() => game.toast('That hero could not be read', '#ff8a8a'));
}
{
  const ut = updateTitle;
  updateTitle = (game, m) => {
    prevHeroesLoad(game);
    const list = game.prevHeroes || [];
    if (m.prev) {
      const k = navInput(), n = Math.min(list.length, PREV.rows);
      if (k.back || !n) { m.prev = false; m.confirm = null; return; }
      if (k.u) { m.pick = (m.pick + n - 1) % n; m.confirm = null; }
      if (k.d) { m.pick = (m.pick + 1) % n; m.confirm = null; }
      if (k.ok) { if (m.confirm === m.pick) { m.prev = false; prevHeroRestore(game, list[m.pick]); } else m.confirm = m.pick; }
      return;
    }
    const PA = prevAt(game);
    if (list.length && (hit('KeyP') || clicked(PA.x - 60, PA.y - 6, 120, 12))) { m.prev = true; m.pick = 0; m.confirm = null; return; }
    return ut(game, m);
  };
  const dt = drawTitle;
  drawTitle = (game, m, now) => {
    dt(game, m, now);
    const list = game.prevHeroes || []; if (!list.length) return;
    if (!m.prev) { const PA = prevAt(game); text(`P: previous heroes (${list.length})`, PA.x, PA.y, 'rgba(240,200,112,0.92)', 7.5); return; }
    const n = Math.min(list.length, PREV.rows), W = 390, H = 46 + n * PREV.rowH, x = VW / 2 - W / 2, y = VH / 2 - H / 2;
    ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = 'rgba(16,10,24,0.96)'; rrect(ctx, x, y, W, H, 6); ctx.fill();
    ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
    goldText('PREVIOUS HEROES', VW / 2, y + 14, 10, { spacing: 2 });
    list.slice(0, n).forEach((r, i) => {
      const ry = y + 34 + i * PREV.rowH, on = i === m.pick, d = new Date(r.at * 1000);
      if (on) { ctx.fillStyle = 'rgba(255,224,138,0.12)'; ctx.fillRect(x + 8, ry - 8, W - 16, PREV.rowH - 2); }
      text(r.name, x + 18, ry, on ? '#ffe9a8' : '#e8e2cf', 8, 'left');
      text(`Lv ${r.lv} · ${r.gold} G`, x + W * 0.42, ry, '#c8c0d8', 7, 'left');
      text(`${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, x + W - 16, ry, '#b8ae96', 7, 'right');
    });
    text(m.confirm != null ? `Enter again to bring back ${list[m.confirm].name} (your current hero is kept in the archive)` : '↑↓ choose · Enter: bring back · Esc: back', VW / 2, y + H - 9, m.confirm != null ? '#ffd27a' : '#b8ae96', 7);
  };
}
