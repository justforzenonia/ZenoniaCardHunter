'use strict';
// PARTY QUESTS, SPECTATING AND EMOTES in online co-op (net.js).
//   PARTY QUESTS  whenever friends are in the room, three shared contracts are up for the whole party ("Together, defeat 20
//                 monsters", "Beat a party boss", ...). Anyone's kill or chest counts. A finished one pays every player there in
//                 their own save (gold, Summon Coins, a quarter of a level's EXP; a guest's share is the numbered reward
//                 'partyQuest') and a fresh one takes its place. Everyone sees a small PARTY tracker. The host keeps them (N.pq).
//   SPECTATE      a guest who is down watches a friend instead of their own fallen hero; ← → switches whom.
//   EMOTES        . (period) opens a wheel: 1 Wave, 2 Cheer, 3 Dance. A little animated pixel glyph plays over your hero on every
//                 screen (sent like quick chat: an emote is a chat entry numbered from NEMOTE.base).
const NPQ = { gold: 700, coins: 2, exp: 0.25, keep: 3 };
const NPQ_KINDS = [
  { kind: 'kill', need: 20, text: n => `Defeat ${n} monsters` },   // (short: they fit the tracker)
  { kind: 'elite', need: 8, text: n => `Defeat ${n} rank D+` },
  { kind: 'pboss', need: 1, text: () => 'Beat a party boss' },
  { kind: 'chest', need: 2, text: n => `Open ${n} chests` },
  { kind: 'mini', need: 1, text: () => 'Beat a mini boss' },
];
// the host's contracts: three different ones, refilled as they finish
function netPqFill(N) {
  N.pq = N.pq || [];
  while (N.pq.length < NPQ.keep) {
    const free = NPQ_KINDS.filter(K => !N.pq.some(q => q.kind === K.kind)), K = pick(free.length ? free : NPQ_KINDS);
    N.pq.push({ id: (N.pqSeq = (N.pqSeq || 0) + 1), kind: K.kind, need: K.need, have: 0, text: K.text(K.need) });
  }
}
// something happened in the host's world with friends there (world.js kills, props.js chests, netboss.js)
function netPqEvent(game, kind, info = {}) {
  const N = game.net, w = game.world; if (!N || N.role !== 'host' || !w || !netGuestList(game).some(G => netGuestActor(w, G.gid))) return;
  netPqFill(N);
  for (const q of N.pq) {
    const hit = q.kind === kind || (q.kind === 'elite' && kind === 'kill' && (info.tier || 0) >= 2) || (q.kind === 'mini' && kind === 'kill' && info.mini);
    if (!hit || q.have >= q.need) continue;
    q.have++; if (q.have < q.need) continue;
    const share = { text: q.text, gold: NPQ.gold, coins: NPQ.coins, exp: NPQ.exp };   // done: everyone there is paid
    netPqPaid(game, share);
    for (const G of netGuestList(game)) if (netGuestActor(w, G.gid)) { G.rwSeq++; G.rw.push({ n: G.rwSeq, k: 'partyQuest', v: share }); }
  }
  const before = N.pq.length; N.pq = N.pq.filter(q => q.have < q.need); if (N.pq.length < before) netPqFill(N);
}
// one player's pay for a finished party quest, on their own save (a guest's EXP goes through their own level-up)
function netPqPaid(game, S) {
  const pr = game.profile; pr.gold = (pr.gold || 0) + S.gold; pr.coins = (pr.coins || 0) + S.coins;
  const exp = Math.round(expNeed(pr.lv || 1) * S.exp);
  if (game.net && game.net.role === 'guest') netGainExp(game, exp); else game.gainExp(exp);
  game.toast(`PARTY QUEST DONE: ${S.text}! +${S.gold} G, +${S.coins} coins, +${exp} EXP`, '#8fffd0'); logAdd(game, `Party quest done: ${S.text}`, '#8fffd0');
  bumpStat('partyQuests'); game.save();
}
// the tracker: under the party's small bars on the right
function drawNetPq(game, w, now) {
  const N = game.net; if (!N) return;
  const list = N.role === 'host' ? (netGuestList(game).length ? N.pq || [] : []) : N.pqShown || []; if (!list.length) return;
  const bars = N.role === 'host' ? Math.max(0, netGuestList(game).length - 1) : w.actors.filter(a => a.kind === 'player' && a !== w.player && a.netWho && a.netWho !== 'h').length;
  const x = VW - 112, y0 = 84 + bars * 16 + 4;
  ctx.fillStyle = 'rgba(20,13,8,0.78)'; rrect(ctx, x, y0, 106, 12 + list.length * 11, 3); ctx.fill();
  text('PARTY QUESTS', x + 53, y0 + 6, '#8fffd0', 6.5);
  list.forEach((q, i) => { const y = y0 + 16 + i * 11, done = q.have >= q.need; text(q.text.length > 26 ? q.text.slice(0, 25) + '…' : q.text, x + 4, y, done ? '#8fffd0' : '#e8e2cf', 5.8, 'left'); text(`${q.have}/${q.need}`, x + 102, y, '#ffd27a', 5.8, 'right'); });
}

// ---- SPECTATE: a downed guest's camera follows a living friend (main.js asks for the target)
function netSpectateTarget(game, w) {
  const N = game.net, me = w.player; if (!N || N.role !== 'guest' || !me || !me.dead) return null;
  const alive = w.actors.filter(a => a.kind === 'player' && a !== me && !a.dead && a.netWho); if (!alive.length) return null;
  N.specIdx = ((N.specIdx || 0) % alive.length + alive.length) % alive.length; return alive[N.specIdx];
}
function netSpectateKeys(game, w) {   // (net.js netGuestFrame, while down)
  const N = game.net; if (!w.player || !w.player.dead) return;
  if (hit('ArrowRight', 'KeyD')) N.specIdx = (N.specIdx || 0) + 1; if (hit('ArrowLeft', 'KeyA')) N.specIdx = (N.specIdx || 0) - 1;
}
function drawNetSpectate(game, w) {
  const t = netSpectateTarget(game, w); if (!t) return;
  const name = t.netWho === 'h' ? netName(game.net.host) : t.label || 'Friend';
  text(`Watching ${name} · ← → switch`, VW / 2, 134, '#cfe4ff', 8);
}

// ---- EMOTES: . opens the wheel; 1–3 plays one (an emote rides the quick-chat path as entry NEMOTE.base + n)
const NEMOTE = { base: 100, list: ['Wave', 'Cheer', 'Dance'] };
function netEmoteKeys(game) {
  if (!game.net || game.menu || (typeof coopOn === 'function' && coopOn(game))) return false;
  const E = game.netEmote = game.netEmote || { open: false }, C = game.netChat;
  const toggled = hit('Period'); if (toggled) { E.open = !E.open; pressed.delete('Period'); if (E.open && C) C.open = false; }
  if (!E.open) return toggled;
  if (hit('Escape')) { E.open = false; pressed.delete('Escape'); return true; }
  for (let i = 0; i < NEMOTE.list.length; i++) { const k = 'Digit' + (i + 1); if (hit(k)) { pressed.delete(k); E.open = false; netChatSay(game, NEMOTE.base + i); return true; } }
  for (let i = 1; i <= 9; i++) pressed.delete('Digit' + i);
  return false;
}
function drawNetEmoteWheel(game) {
  const E = game.netEmote; if (!E || !E.open || !game.net) return;
  const x = 12, y = VH - 104; ctx.fillStyle = 'rgba(20,13,8,0.88)'; rrect(ctx, x, y, 100, 52, 6); ctx.fill(); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, 99, 51, 6); ctx.stroke();
  text('EMOTES', x + 50, y + 9, '#ffd27a', 7.5);
  NEMOTE.list.forEach((s, i) => text(`${i + 1}  ${s}`, x + 10, y + 22 + i * 10, '#e8e2cf', 7, 'left'));
}
// the little animation over the hero (screen layer: netparty.js draws an emote entry with this instead of a speech bubble)
function drawNetEmote(i, cx, by, age, col) {
  const t = age / 1000, k = i - NEMOTE.base;
  ctx.fillStyle = 'rgba(24,16,10,0.88)'; rrect(ctx, cx - 18, by - 6, 36, 22, 5); ctx.fill();   // (a small dark plate, like the speech bubbles, so it reads on any ground)
  ctx.strokeStyle = col; ctx.lineWidth = 1; rrect(ctx, cx - 17.5, by - 5.5, 35, 21, 5); ctx.stroke();
  if (k === 0) {   // Wave: a little figure waving its arm, side to side
    text(Math.floor(t * 4) % 2 ? 'o/' : '\\o', cx, by + 6, col, 12);
  } else if (k === 1) {   // Cheer: arms up, hopping, sparks around it
    const hop = Math.abs(Math.sin(t * 9)) * 6; text('\\o/', cx, by + 6 - hop, col, 12);
    for (let s = 0; s < 3; s++) { const a = t * 4 + s * 2.1; text('✦', cx + Math.cos(a) * 16, by + 2 + Math.sin(a) * 7 - hop, '#ffe9a8', 7); }
  } else {   // Dance: swaying, with notes rising
    const sway = Math.sin(t * 7) * 5; text(Math.floor(t * 3) % 2 ? '~o~' : '\\o/', cx + sway, by + 6, col, 11);
    for (let s = 0; s < 2; s++) { const u = (t * 0.9 + s * 0.5) % 1; text(s ? '♫' : '♪', cx + (s ? 12 : -12) + Math.sin(u * 6) * 3, by - u * 16, '#cfe4ff', 8); }
  }
}
