'use strict';
// THE LOG: what just happened. Every message the game shows lands here, along with cards, coins and level-ups: a short feed at the
// bottom right, above the item belt, fades after a few seconds, and X opens the full history, sorted into loot, farm and fights. Kept with the save
// (pr.glog, newest first). The same message within a few seconds counts up instead of repeating.
const GLOG = { max: 80, show: 6, life: 8000, fade: 900, merge: 4000, right: VW - 6, bottom: VH - 76, rowH: 11, tabs: ['ALL', 'LOOT', 'FARM', 'FIGHTS', 'HOST CODE'], pill: { x: 6, y: VH - 142, w: 74, h: 14 }, col: '#c8d8a0',
  kinds: [/\b(found|gear!|relic|card|coin|sold|bought|made|forged|salvaged|equipped|treasure|hoard|potion)\b/i, /\b(harvest\w*|planted|fertilizer|ripe|crop\w*|egg|milk|wool|truffle|fed|collected|butcher|farm|tilled|gathered|mined|caught)\b/i, /\b(level|black hole|boss|defeated|falls?|horde|guardian|starving|alpha|rift|mini boss|elite|died)\b/i] };
const logOf = pr => pr.glog || (pr.glog = []);
function logAdd(game, str, col = '#e8e2cf', icon = null) {
  const pr = game.profile; if (!pr || game.scene === 'arena') return null;
  const L = logOf(pr), top = L[0], now = Date.now();
  if (top && top.s === str && now - top.t < GLOG.merge) { top.n++; top.t = now; return top; }
  const e = { s: str, c: col, i: icon, n: 1, t: now, d: pr.day || 1 }; L.unshift(e); if (L.length > GLOG.max) L.length = GLOG.max; return e;
}
const logIcon = (game, icon) => { const e = logOf(game.profile)[0]; if (e) e.i = icon; };
function drawLogFeed(game, now) {
  const pr = game.profile, w = game.world; if (!pr || !w || game.menu || !pr.glog) return;
  const t = Date.now(), up = new Set((game.toasts || []).map(q => q.str)), L = pr.glog.slice(0, GLOG.show).filter(e => t - e.t < GLOG.life && !up.has(e.s));   // (a message still showing up top waits: never the same words twice on screen)
  L.forEach((e, i) => {
    // (on a phone the corner is under ATTACK, LAYER and the spells: the feed moves in, to the left of the buttons, 2026-11-20)
    const ph = typeof TOUCH !== 'undefined' && TOUCH.on, gR = ph ? 430 : GLOG.right, gB = ph ? 250 : GLOG.bottom;
    const y = gB - i * GLOG.rowH, left = GLOG.life - (t - e.t), label = e.s.length > 54 ? `${e.s.slice(0, 52)}…` : e.s, str = e.n > 1 ? `${label}  ×${e.n}` : label, tw = textW(str, 7) + (e.i != null ? 14 : 6), x = gR - tw;
    ctx.save(); ctx.globalAlpha = Math.min(1, left / GLOG.fade);
    ctx.fillStyle = 'rgba(46,28,18,0.6)'; rrect(ctx, x, y - 5, tw, 10, 5); ctx.fill();   // (warm cocoa, like the message pills)
    if (e.i != null) iconCentered('items', e.i, x + 6, y, 8);
    text(str, x + (e.i != null ? 12 : 3), y + 0.3, e.c, 7, 'left'); ctx.restore();
  });
}
function drawLogPill(game, now) {
  const P = GLOG.pill, pr = game.profile, w = game.world; if (!pr || !w || game.menu || w.rift || w.cave) return;
  hudPill(P, GLOG.col, 'X: Log', '#eef4d8');   // (hud.js)
}
function logMenu() { return { type: 'glog', tab: 0, cur: 0, scroll: 0 }; }
function logRows(game, m) {
  if (m.tab === 4) return netLogRows(game, m);   // (the online co-op room: net.js)
  const list = logOf(game.profile).filter(e => !m.tab || GLOG.kinds[m.tab - 1].test(e.s));
  return list.map(e => ({ icon: e.i, name: e.s.length > 74 ? `${e.s.slice(0, 72)}…` : e.s, col: e.c, sub: `Day ${e.d}`, right: e.n > 1 ? `×${e.n}` : '', rightCol: '#ffe9a8' }));
}
function updateLog(game, m) { const nav = panelNav(m, logRows(game, m).length, GLOG.tabs.length); if (nav.back || hit('KeyX')) game.closeMenu(); }
function drawLog(game, m, now) { panelMenu(m, { title: 'LOG', tabs: GLOG.tabs, rows: logRows(game, m), empty: 'Nothing here yet.', keys: '←→ tab · ↑↓ scroll · X or Esc close' }, now); }
// the buffs on you right now: what, how strong, seconds left, and a bar running down, under the status panel
const BUFF_CHIP = { x: 6, y: 78, w: 104, h: 11, gap: 2, warn: 3000 };
function drawBuffChips(game) {
  const w = game.world, p = w && w.player; if (!p || !p.sup || !p.sup.length || game.menu) return;
  const B = BUFF_CHIP, L = p.sup.slice().sort((a, b) => a.t - b.t), P = partnerOf(game.profile), top = game.profile.rested ? 112 : P && !P.dead ? 98 : B.y;   // (below the partner card and Well Rested)
  L.forEach((b, i) => {
    const y = top + i * (B.h + B.gap), k = Math.max(0, b.t / b.max), low = b.t < B.warn, a = low ? 0.6 + 0.4 * Math.sin(performance.now() / 90) : 1;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,13,8,0.8)'; rrect(ctx, B.x, y, B.w, B.h, 3); ctx.fill();
    ctx.fillStyle = hexA(b.col, 0.5); rrect(ctx, B.x, y, Math.max(3, B.w * k), B.h, 3); ctx.fill();
    ctx.strokeStyle = b.col; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.4, y + 0.4, B.w - 0.8, B.h - 0.8, 3); ctx.stroke();
    text(`${b.label} ${b.stat}`, B.x + 4, y + B.h / 2 + 0.3, '#ffffff', 6.5, 'left'); text(`${Math.ceil(b.t / 1000)}s`, B.x + B.w - 4, y + B.h / 2 + 0.3, low ? '#ffd27a' : '#ffffff', 6.5, 'right');
    ctx.restore();
  });
}
