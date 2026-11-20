'use strict';
// FRIENDLY DUELS in online co-op (net.js): T beside another player opens a small choice, TRADE or DUEL. A duel challenge pops up on
// the other player's screen (Y accept, N decline). Accepted, a glowing ring appears where you stand (anywhere, even in town),
// both heroes are healed, and after a 3-2-1 the two of you can hurt each other, and only each other. Nobody dies: the first to
// drop to 1 HP loses (as in the Dojo), and stepping out of the ring or leaving the room forfeits. Everyone sees the ring and
// hears who won; both are healed again at the end. The HOST's game runs every duel (N.duel); guests send their moves (dm) in
// their key messages and see the duel in the snapshot.
const NDUEL = { ring: 96, out: 22, count: 3000, ask: 15000, show: 3500 };
const ndMe = game => game.net.role === 'host' ? 'h' : game.net.gid;
const ndName = (game, pid) => { const N = game.net; if (N.role === 'host') return pid === 'h' ? netName(game.profile) : netName((N.guests[pid] || {}).prof); return pid === N.gid ? netName(game.profile) : netName(pid === 'h' ? N.host : (N.peers || {})[pid]); };
const ndActor = (game, w, pid) => pid === 'h' ? w.player : netGuestActor(w, pid);

// the little choice after T (menu type 'ntask'): trade or duel with the player beside you
function netAskMenu(to) { return { type: 'ntask', to, cur: 0 }; }
function updateNetAsk(game, m) {
  if (hit('Escape')) { game.closeMenu(); return; }
  if (hit('ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD')) m.cur = 1 - m.cur;
  let go = hit('Enter', 'Space', 'KeyJ') ? m.cur : -1;
  if (clicked(VW / 2 - 90, 150, 180, 24)) go = 0; if (clicked(VW / 2 - 90, 180, 180, 24)) go = 1;
  if (go < 0) return;
  game.closeMenu();
  if (go === 0) netTradeSend(game, { t: 'open', to: m.to });
  else { netDuelSend(game, { t: 'duel', to: m.to }); game.toast(`Duel challenge sent to ${ndName(game, m.to)}`, '#ffd27a'); }
}
function drawNetAsk(game, m, now) {
  ctx.fillStyle = 'rgba(6,4,14,0.7)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle(ndName(game, m.to).toUpperCase(), VW / 2, 126, 12, now);
  ['TRADE', 'DUEL'].forEach((t, i) => { const y = 150 + i * 30, on = m.cur === i; ctx.fillStyle = on ? 'rgba(90,60,20,0.92)' : 'rgba(40,26,17,0.9)'; rrect(ctx, VW / 2 - 90, y, 180, 24, 5); ctx.fill(); text(t, VW / 2, y + 12, on ? '#ffe9a8' : '#d8d0c0', 10); });
  text('↑↓ choose · Enter · Esc: back', VW / 2, 228, '#9a917c', 7);
}
// a challenge for you (menu type 'nduelask'): Y accept, N decline
function netDuelAskMenu(from, id) { return { type: 'nduelask', from, id, t: 0 }; }
function updateNetDuelAsk(game, m, dt) {
  m.t += dt; if (m.t > NDUEL.ask) { game.closeMenu(); return; }
  if (hit('KeyY', 'Enter')) { netDuelSend(game, { t: 'yes', id: m.id }); game.closeMenu(); }
  else if (hit('KeyN', 'Escape')) { netDuelSend(game, { t: 'no', id: m.id }); game.closeMenu(); }
}
function drawNetDuelAsk(game, m, now) {
  ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(40,12,16,0.94)'; rrect(ctx, VW / 2 - 150, 130, 300, 70, 8); ctx.fill(); ctx.strokeStyle = '#ff9a6a'; ctx.lineWidth = 1.2; rrect(ctx, VW / 2 - 149.5, 130.5, 299, 69, 8); ctx.stroke();
  text(`${ndName(game, m.from)} challenges you to a duel!`, VW / 2, 150, '#ffe9a8', 10);
  text(`Y: accept · N: decline   (${Math.ceil((NDUEL.ask - m.t) / 1000)}s)`, VW / 2, 178, '#ffb07a', 8);
}
// a move in a duel: the host decides it at once; a guest's goes straight out
function netDuelSend(game, m) { const N = game.net; if (N.role === 'host') netDuelMsg(game, 'h', m); else netApi(N.IN, { dm: [m] }).catch(() => {}); }
// the host's side: challenges, answers, the start
function netDuelMsg(game, from, m) {
  const N = game.net, w = game.world; if (!w) return;
  if (m.t === 'duel') {
    if (N.duel || (N.duelAsk && performance.now() - N.duelAsk.at < NDUEL.ask) || from === m.to) return;
    N.duelAsk = { id: (N.duelSeq = (N.duelSeq || 0) + 1), from, to: m.to, at: performance.now() };
    if (m.to === 'h') game.openMenu(netDuelAskMenu(from, N.duelAsk.id));
    return;
  }
  const A = N.duelAsk; if (!A || A.id !== m.id || from !== A.to) return; N.duelAsk = null;
  if (m.t === 'no') { netDuelNews(game, `${ndName(game, A.to)} turned down the duel`); return; }
  const a = ndActor(game, w, A.from), b = ndActor(game, w, A.to);
  if (!a || !b || a.dead || b.dead || Math.hypot(a.x - b.x, a.y - b.y) > NDUEL.ring * 2) { netDuelNews(game, 'The duel is off: you need to be together'); return; }
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  N.duel = { id: A.id, a: A.from, b: A.to, cx, cy, r: NDUEL.ring, phase: 'count', t: NDUEL.count };
  for (const x of [a, b]) Object.assign(x, { hp: x.maxHp, mp: x.maxMp, duelId: A.id, duelLive: false, driving: null, transcend: 0 });
  netDuelNews(game, `DUEL: ${ndName(game, A.from)} vs ${ndName(game, A.to)}!`);
}
// news for everyone in the room (host toast now; guests through the snapshot)
function netDuelNews(game, str) { const N = game.net; N.duelNews = { id: (N.duelNewsId = (N.duelNewsId || 0) + 1), str }; game.toast(str, '#ffd27a'); }
// each host frame (net.js netHostTick): the countdown, the ring, a forfeit, the end
function netDuelTick(game, w, dt) {
  const N = game.net, D = N.duel; if (!D) { if (N.duelAsk && performance.now() - N.duelAsk.at > NDUEL.ask) N.duelAsk = null; return; }
  const a = ndActor(game, w, D.a), b = ndActor(game, w, D.b);
  if (!a || !b) { netDuelEnd(game, w, a ? D.a : D.b, 'the other left'); return; }
  if (D.phase === 'count') { D.t -= dt; if (D.t <= 0) { D.phase = 'fight'; a.duelLive = b.duelLive = true; } return; }
  for (const [x, pid, other] of [[a, D.a, D.b], [b, D.b, D.a]]) if (Math.hypot(x.x - D.cx, x.y - D.cy) > D.r + NDUEL.out) { netDuelEnd(game, w, other, `${ndName(game, pid)} stepped out of the ring`); return; }
}
// a duelist dropped to 1 HP (combat.js holds them there): the other one wins
function netDuelDown(def) {
  const game = window.GAME, N = game && game.net, D = N && N.duel; if (!D || D.phase !== 'fight' || N.role !== 'host') return;
  const w = game.world, loser = ndActor(game, w, D.a) === def ? D.a : D.b;
  netDuelEnd(game, w, loser === D.a ? D.b : D.a, `${ndName(game, loser)} is down`);
}
function netDuelEnd(game, w, winner, why) {
  const N = game.net, D = N.duel; N.duel = null;
  for (const pid of [D.a, D.b]) { const x = ndActor(game, w, pid); if (x) Object.assign(x, { duelId: null, duelLive: false, hp: x.maxHp, mp: x.maxMp, dead: false, state: 'free' }); }
  netDuelNews(game, `${ndName(game, winner)} WINS THE DUEL! (${why})`);
}
// the ring on the ground (main.js, in world space) and the countdown (screen space), on every screen in the room
function netDuelState(game) { const N = game.net; return N && N.duel; }
function drawNetDuelRing(game, now) {
  const D = netDuelState(game); if (!D) return;
  const pulse = 0.55 + 0.3 * Math.sin(now / 160);
  ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = D.phase === 'fight' ? '#ff6a4a' : '#ffd27a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(D.cx, D.cy, D.r, D.r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = pulse * 0.25; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
}
function drawNetDuelHud(game, now) {
  const D = netDuelState(game); if (!D) return;
  const title = `${ndName(game, D.a)}  vs  ${ndName(game, D.b)}`; text(title, VW / 2, 52, '#ffd27a', 9);
  if (D.phase === 'count') { const n = Math.ceil(D.t / 1000); text(n > 0 ? String(n) : 'FIGHT!', VW / 2, VH / 2 - 30, '#ffe9a8', 28); }
}
