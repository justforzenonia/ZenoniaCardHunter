'use strict';
// TRADING in online co-op (net.js): T beside another player in the room opens a trade window on both games. Each side picks
// cards, gear (not what they are wearing, nor what their Hero Partner holds) and gold to give, sees the other's offer live, and
// presses R when happy. Any change to either offer clears both READY marks; when both are ready the swap happens.
// The HOST's game keeps every trade (N.trades) and decides it: a guest's moves ride in their key messages (tm), the state goes
// out in every snapshot, and each guest's half of a finished swap is a numbered reward (rw: 'trade'), resent until confirmed,
// that their own game applies to their own save. Each item gets a fresh id in its new owner's save.
const NTRADE = { reach: 60, goldStep: 100, goldBig: 1000, rows: 9 };
const ntMe = game => game.net.role === 'host' ? 'h' : game.net.gid;
const ntName = (game, pid) => {
  const N = game.net; if (pid === ntMe(game)) return 'You';
  if (N.role === 'host') return netName((N.guests[pid] || {}).prof);
  return netName(pid === 'h' ? N.host : (N.peers || {})[pid]);
};
const ntList = game => game.net ? (game.net.role === 'host' ? Object.values(game.net.trades || {}) : game.net.trades || []) : [];
const ntFind = (game, id) => ntList(game).find(T => T.id === id);
const ntMine = game => ntList(game).find(T => T.a === ntMe(game) || T.b === ntMe(game));
const ntEmpty = () => ({ cards: [], gear: [], gold: 0 });
// what may go on the table: cards, and gear that is neither worn nor held by the Hero Partner
const ntCards = pr => pr.cards || [];
const ntGear = pr => (pr.gear || []).filter(g => !GEAR_SLOTS.some(s => pr.eq && pr.eq[s] === g.uid) && !(typeof partnerHolds === 'function' && partnerHolds(pr, g.uid)));

// T in the world (main.js for the host, net.js for a guest): trade with the nearest other player in reach
function netTradeKey(game, w) {
  const N = game.net, p = w.player; if (!N || !p || ntMine(game)) return false;
  let best = null, bd = NTRADE.reach;
  for (const a of w.actors) {
    if (a === p || a.kind !== 'player' || a.dead) continue;
    const pid = N.role === 'host' ? a.netGid : a.netWho; if (!pid || pid === ntMe(game)) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; best = pid; }
  }
  if (!best) { game.toast('Stand next to a friend and press T to trade or duel', '#c9c1a8'); return true; }
  game.openMenu(netAskMenu(best)); return true;   // (trade or duel: netduel.js)
}
// a move in a trade: the host decides it at once; a guest's goes out with its next key message
function netTradeSend(game, m) {
  const N = game.net; if (N.role === 'host') netTradeMsg(game, 'h', m); else netApi(N.IN, { tm: [m] }).catch(() => {});   // (sent at once: the trade window has no key messages of its own)
}
// the host's side of every trade
function netTradeMsg(game, from, m) {
  const N = game.net; N.trades = N.trades || {}; const busy = pid => Object.values(N.trades).some(T => T.a === pid || T.b === pid);
  if (m.t === 'open') {
    if (busy(from) || busy(m.to)) return;
    const id = N.tradeSeq = (N.tradeSeq || 0) + 1;
    N.trades[id] = { id, a: from, b: m.to, offer: { [from]: ntEmpty(), [m.to]: ntEmpty() }, ready: {} };
    if (from === 'h' || m.to === 'h') game.openMenu(netTradeMenu(id));
    return;
  }
  const T = N.trades[m.id]; if (!T || (T.a !== from && T.b !== from)) return;
  if (m.t === 'cancel') { delete N.trades[m.id]; if ((T.a === 'h' || T.b === 'h') && game.menu && game.menu.type === 'ntrade') game.closeMenu(); game.toast('Trade called off', '#c9c1a8'); return; }
  if (m.t === 'offer') { T.offer[from] = { cards: (m.offer.cards || []).slice(0, 40), gear: (m.offer.gear || []).slice(0, 40), gold: Math.max(0, Math.floor(m.offer.gold || 0)) }; T.ready = {}; return; }
  if (m.t === 'ready') {
    T.ready[from] = !!m.v; if (!(T.ready[T.a] && T.ready[T.b])) return;
    delete N.trades[T.id];   // done: each side gives its own offer and gets the other's
    for (const [pid, other] of [[T.a, T.b], [T.b, T.a]]) {
      const give = T.offer[pid], get = T.offer[other], half = { give: { cards: give.cards.map(c => c.uid), gear: give.gear.map(g => g.uid), gold: give.gold }, get, with: other === 'h' ? netName(game.profile) : netName((N.guests[other] || {}).prof) };   // (the partner's own name, as each side sees it)
      if (pid === 'h') { netApplyTrade(game, half); if (game.menu && game.menu.type === 'ntrade') game.closeMenu(); }
      else { const G = N.guests[pid]; if (G) { G.rwSeq++; G.rw.push({ n: G.rwSeq, k: 'trade', v: half }); } }
    }
  }
}
// one side of a finished swap, on that player's own save: their offer goes, the other's arrives (with fresh ids)
function netApplyTrade(game, half) {
  const pr = game.profile, give = half.give, get = half.get;
  const goneC = new Set(give.cards), goneG = new Set(give.gear);
  pr.cards = (pr.cards || []).filter(c => !goneC.has(c.uid)); pr.deck = (pr.deck || []).filter(u => !goneC.has(u)); pr.spells = (pr.spells || []).map(u => goneC.has(u) ? null : u);
  pr.gear = (pr.gear || []).filter(g => !goneG.has(g.uid)); for (const s of GEAR_SLOTS) if (pr.eq && goneG.has(pr.eq[s])) pr.eq[s] = null;
  pr.gold = Math.max(0, (pr.gold || 0) - (give.gold || 0)) + (get.gold || 0);
  for (const c of get.cards || []) { const k = JSON.parse(JSON.stringify(c)); k.uid = uid(); (pr.storage = pr.storage || { cards: [], gear: [] }); if (pr.cards.length >= 120) pr.storage.cards.push(k); else pr.cards.push(k); }
  for (const g of get.gear || []) { const k = JSON.parse(JSON.stringify(g)); k.uid = uid(); if (pr.gear.length >= 80) (pr.storage = pr.storage || { cards: [], gear: [] }).gear.push(k); else pr.gear.push(k); }
  const n = (get.cards || []).length + (get.gear || []).length;
  const got = [n ? `${n} item${n === 1 ? '' : 's'}` : '', get.gold ? `${get.gold} G` : ''].filter(Boolean).join(' and ') || 'nothing';
  game.toast(`Trade done with ${half.with}: ${got} received`, '#8fffd0');
  logAdd(game, `Traded with ${half.with}`, '#8fffd0');
  game.save(); if (game.refreshPlayer) game.refreshPlayer();
}

// ---- the trade window (menu type 'ntrade', registered in main.js)
function netTradeMenu(id) { return { type: 'ntrade', id, tab: 0, cur: 0, scroll: 0, pick: { cards: new Set(), gear: new Set() }, gold: 0 }; }
function ntOfferOf(game, m) { const pr = game.profile; return { cards: ntCards(pr).filter(c => m.pick.cards.has(c.uid)), gear: ntGear(pr).filter(g => m.pick.gear.has(g.uid)), gold: m.gold }; }
function updateNetTrade(game, m, dt) {
  if (game.net && game.net.role === 'guest') netGuestPoll(game, dt);   // (a guest's window keeps the trade live)
  const T = ntFind(game, m.id); if (!T) { game.closeMenu(); return; }   // (called off or finished)
  const me = ntMe(game), pr = game.profile, list = m.tab === 0 ? ntCards(pr) : m.tab === 1 ? ntGear(pr) : [];
  if (hit('Escape')) { netTradeSend(game, { t: 'cancel', id: m.id }); game.net.tradeClosed = m.id; game.closeMenu(); return; }   // (tradeClosed: not reopened before the host hears)
  if (hit('ArrowLeft', 'KeyA')) { m.tab = (m.tab + 2) % 3; m.cur = 0; m.scroll = 0; }
  if (hit('ArrowRight', 'KeyD')) { m.tab = (m.tab + 1) % 3; m.cur = 0; m.scroll = 0; }
  let changed = false;
  if (m.tab < 2) {
    if (hit('ArrowUp', 'KeyW')) m.cur = Math.max(0, m.cur - 1);
    if (hit('ArrowDown', 'KeyS')) m.cur = Math.min(Math.max(0, list.length - 1), m.cur + 1);
    m.scroll = Math.min(Math.max(m.scroll, m.cur - NTRADE.rows + 1), m.cur);
    if (hit('Enter', 'Space') && list[m.cur]) { const S = m.tab === 0 ? m.pick.cards : m.pick.gear, u = list[m.cur].uid; if (S.has(u)) S.delete(u); else S.add(u); changed = true; }
  } else {
    const before = m.gold;
    if (hit('ArrowUp', 'KeyW')) m.gold += NTRADE.goldStep; if (hit('ArrowDown', 'KeyS')) m.gold -= NTRADE.goldStep;
    if (hit('PageUp', 'KeyE')) m.gold += NTRADE.goldBig; if (hit('PageDown', 'KeyQ')) m.gold -= NTRADE.goldBig;
    m.gold = Math.max(0, Math.min(pr.gold || 0, m.gold)); changed = m.gold !== before;
  }
  if (changed) netTradeSend(game, { t: 'offer', id: m.id, offer: ntOfferOf(game, m) });
  if (hit('KeyR')) netTradeSend(game, { t: 'ready', id: m.id, v: !(T.ready && T.ready[me]) });
}
function drawNetTrade(game, m, now) {
  const T = ntFind(game, m.id); if (!T) return;
  const me = ntMe(game), other = T.a === me ? T.b : T.a, pr = game.profile, mine = T.offer[me] || ntEmpty(), theirs = T.offer[other] || ntEmpty();
  ctx.fillStyle = 'rgba(6,4,14,0.86)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle(`TRADE WITH ${ntName(game, other).toUpperCase()}`, VW / 2, 34, 14, now);
  const panel = (x, w, title, col) => { ctx.fillStyle = 'rgba(40,26,17,0.92)'; rrect(ctx, x, 52, w, 250, 6); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; rrect(ctx, x + 0.5, 52.5, w - 1, 249, 6); ctx.stroke(); text(title, x + w / 2, 64, col, 9); };
  // left: what you give (pick from your own bag)
  panel(16, 300, 'YOU GIVE', '#ffd27a');
  ['CARDS', 'GEAR', 'GOLD'].forEach((t, i) => { const x = 36 + i * 92, on = m.tab === i; ctx.fillStyle = on ? 'rgba(90,60,20,0.9)' : 'rgba(60,40,25,0.8)'; rrect(ctx, x, 74, 84, 14, 4); ctx.fill(); text(t, x + 42, 81, on ? '#ffe9a8' : '#a8a0b8', 7); });
  if (m.tab < 2) {
    const list = m.tab === 0 ? ntCards(pr) : ntGear(pr), S = m.tab === 0 ? m.pick.cards : m.pick.gear;
    if (!list.length) text(m.tab === 0 ? 'No cards to give' : 'No spare gear (worn gear stays on you)', 166, 150, '#8a8298', 7);
    list.slice(m.scroll, m.scroll + NTRADE.rows).forEach((it, i) => {
      const y = 96 + i * 20, on = m.scroll + i === m.cur, picked = S.has(it.uid);
      if (on) { ctx.fillStyle = 'rgba(255,233,168,0.12)'; rrect(ctx, 24, y - 2, 284, 18, 3); ctx.fill(); }
      text(picked ? '☑' : '☐', 34, y + 7, picked ? '#8fffd0' : '#8a8298', 9);
      text(m.tab === 0 ? cardName(it) : it.name, 48, y + 7, rankColor(it.tier), 7.5, 'left'); text(`[${RANKS[it.tier]}]`, 300, y + 7, rankColor(it.tier), 7, 'right');
    });
  } else {
    text(`${m.gold} G`, 166, 150, '#ffd23f', 16); text(`You have ${pr.gold || 0} G`, 166, 172, '#a8a0b8', 7);
    text('↑↓ ±100 · Q / E ±1000', 166, 188, '#9aa4b8', 7);
  }
  // right: what they give (their offer, live)
  panel(324, 300, `${ntName(game, other).toUpperCase()} GIVES`, '#8fd8ff');
  const rows = [...theirs.cards.map(c => [cardName(c), c.tier]), ...theirs.gear.map(g => [g.name, g.tier])];
  if (!rows.length && !theirs.gold) text('Nothing yet', 474, 150, '#8a8298', 7);
  rows.slice(0, 10).forEach(([name, tier], i) => { text(name, 340, 84 + i * 18, rankColor(tier), 7.5, 'left'); text(`[${RANKS[tier]}]`, 608, 84 + i * 18, rankColor(tier), 7, 'right'); });
  if (rows.length > 10) text(`…and ${rows.length - 10} more`, 340, 84 + 10 * 18, '#a8a0b8', 7, 'left');
  if (theirs.gold) text(`+ ${theirs.gold} G`, 474, 280, '#ffd23f', 10);
  // ready marks and keys
  const rd = pid => T.ready && T.ready[pid];
  text(rd(me) ? '✔ YOU ARE READY' : 'You: not ready', 166, 314, rd(me) ? '#8fffd0' : '#c9b89a', 8);
  text(rd(other) ? `✔ ${ntName(game, other).toUpperCase()} IS READY` : `${ntName(game, other)}: not ready`, 474, 314, rd(other) ? '#8fffd0' : '#c9b89a', 8);
  text(`You give ${mine.cards.length + mine.gear.length} item(s)${mine.gold ? ` + ${mine.gold} G` : ''} · ←→ cards / gear / gold · ↑↓ choose · Enter pick · R ready · Esc call off`, VW / 2, VH - 14, '#9a917c', 7);
}
