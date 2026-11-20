'use strict';
// THE PARTY in online co-op (net.js): quick chat, tougher fights for a bigger party, and reviving a friend by hand.
//   QUICK CHAT   , (comma) opens a little wheel of phrases; 1–8 says one (comma or Esc closes it). It never pauses the game.
//                What you say floats over your hero on every screen in the room for a few seconds, and lands in the log.
//   PARTY SIZE   with friends in your room, monsters take less from each blow (as if they had more health) and hit a little
//                harder, and drop more loot; everyone still gets the full EXP and gold for each kill.
//   REVIVE       stand beside a friend who is down and hold Enter: after a moment they are back on their feet at half health,
//                sooner than waiting it out. A ring fills over them while you hold.
// The HOST's game decides all three; guests send their phrase (ch) and their held Enter (rv) in their key messages.
const NPARTY = { show: 3500, keep: 12, hpPer: 0.6, hitPer: 0.15, lootPer: 0.25, reviveR: 28, reviveMs: 1500, reviveHp: 0.5 };
const NCHAT = ['Follow me!', 'Help!', 'Wait!', 'Over here!', 'Nice!', 'Thanks!', 'Go go go!', '*waves*'];

// ---- QUICK CHAT
// each world frame (main.js for the host, net.js for a guest), before anything else reads the keys: the wheel takes 1–8 for itself
function netChatKeys(game) {
  if (!game.net || game.menu || (typeof coopOn === 'function' && coopOn(game))) return false;   // (local co-op's Player 2 has the comma)
  const C = game.netChat = game.netChat || { open: false };
  const toggled = hit('Comma'); if (toggled) { C.open = !C.open; pressed.delete('Comma'); }   // (and on: a phrase or Esc in the same frame still counts)
  if (!C.open) return toggled;
  if (hit('Escape')) { C.open = false; pressed.delete('Escape'); return true; }
  for (let i = 0; i < NCHAT.length; i++) { const k = 'Digit' + (i + 1); if (hit(k)) { pressed.delete(k); C.open = false; netChatSay(game, i); return true; } }
  for (let i = 1; i <= 9; i++) pressed.delete('Digit' + i);   // (no spells or belt items while the wheel is up)
  return false;
}
function netChatSay(game, i) {
  const N = game.net; if (N.role === 'host') netChatHeard(game, 'h', i); else { N.sentAt = performance.now(); netApi(N.IN, { ch: i }).catch(() => {}); }
}
// the host keeps the latest phrases (N.chat, sent in the snapshot)
function netChatHeard(game, pid, i) {
  const N = game.net; if (!((i >= 0 && i < NCHAT.length) || (i >= NEMOTE.base && i < NEMOTE.base + NEMOTE.list.length))) return;   // (a phrase, or an emote: netquest.js)
  N.chat = (N.chat || []).filter(c => performance.now() - c.at < NPARTY.show); N.chatId = (N.chatId || 0) + 1;
  N.chat.push({ id: N.chatId, pid, i, at: performance.now() }); if (N.chat.length > NPARTY.keep) N.chat.shift();
  netChatLog(game, pid, i);
}
const netPidName = (game, pid) => { const N = game.net; if (N.role === 'host') return pid === 'h' ? netName(game.profile) : netName((N.guests[pid] || {}).prof); return pid === N.gid ? netName(game.profile) : netName(pid === 'h' ? N.host : (N.peers || {})[pid]); };
function netChatLog(game, pid, i) { logAdd(game, i >= NEMOTE.base ? `${netPidName(game, pid)} ${['waves', 'cheers', 'dances'][i - NEMOTE.base]}` : `${netPidName(game, pid)}: ${NCHAT[i]}`, '#cfe4ff'); }
// a guest keeps the phrases from the snapshot (with its own clock for how long each floats) and logs each new one once
function netChatFromSnap(game, s) {
  const N = game.net; N.chatSeen = N.chatSeen || 0; N.chatShown = (N.chatShown || []).filter(c => performance.now() - c.at < NPARTY.show);
  for (const c of s.chat || []) if (c.id > N.chatSeen) { N.chatSeen = c.id; N.chatShown.push({ pid: c.pid, i: c.i, at: performance.now() }); netChatLog(game, c.pid, c.i); }
}
// the wheel (screen space) and the speech bubbles (world space)
function drawNetChatWheel(game, now) {
  const C = game.netChat; if (!C || !C.open || !game.net) return;
  const x = 12, y = VH - 150; ctx.fillStyle = 'rgba(20,13,8,0.88)'; rrect(ctx, x, y, 132, 112, 6); ctx.fill(); ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, 131, 111, 6); ctx.stroke();
  text('QUICK CHAT', x + 66, y + 9, '#8fd8ff', 7.5);
  NCHAT.forEach((s, i) => text(`${i + 1}  ${s}`, x + 10, y + 22 + i * 11, '#e8e2cf', 7, 'left'));
}
function netChatActor(game, w, pid) { const N = game.net; if (N.role === 'host') return pid === 'h' ? w.player : netGuestActor(w, pid); return w.actors.find(a => a.netWho === pid); }
// A speech bubble in the game's own style: a dark plate like the nameplates, a rim in the speaker's colour, light letters (the
// game's pixel text carries a dark outline, made for light letters on dark), the speaker's name above, just over their head.
// Drawn on the screen layer (main.js passes the camera) so the letters stay crisp instead of stretched by the world's zoom.
// One bubble per speaker (their latest phrase). Speakers side by side would cover each other, so their bubbles slide apart
// sideways in a row (kept centred on them) and each one's pointer runs down to its own speaker.
const NBUB = { size: 9, h: 17, pad: 7, gap: 4, name: 7, lift: 6 };
function drawNetChatBubbles(game, w, now, cam) {
  const N = game.net, latest = {}; if (!cam) return;
  for (const c of N.role === 'host' ? (N.chat || []) : (N.chatShown || [])) if (performance.now() - c.at < NPARTY.show) latest[c.pid] = c;
  const sx = x => (x - cam.x) * ZOOM, sy = y => (y - cam.y) * ZOOM, B = [];   // (world to screen)
  for (const c of Object.values(latest)) {
    const a = netChatActor(game, w, c.pid); if (!a) continue;
    if (c.i >= NEMOTE.base) { const ex = Math.round(sx(a.x)), ey = Math.round(sy(a.y - (a.h || 26) * (a.scale || 1) - (a.z || 0))) - 20; ctx.save(); ctx.globalAlpha = Math.min(1, (NPARTY.show - (performance.now() - c.at)) / 400); drawNetEmote(c.i, ex, ey, performance.now() - c.at, a.marker || '#ffd27a'); ctx.restore(); continue; }   // (an emote plays over the hero instead: netquest.js)
    const s = NCHAT[c.i], who = netPidName(game, c.pid), tw = Math.round(Math.max(textW(s, NBUB.size) + NBUB.pad * 2, textW(who, NBUB.name) + 8)), cx = Math.round(sx(a.x));
    B.push({ c, a, s, who, tw, cx, x: cx - tw / 2, y: Math.round(sy(a.y - (a.h || 26) * (a.scale || 1) - (a.z || 0)) - NBUB.lift - NBUB.h), col: a.marker || '#ffd27a' });
  }
  B.sort((p, q) => p.cx - q.cx);
  for (let i = 0; i < B.length;) {   // (each run of bubbles that would touch: laid out in a row, centred on its speakers)
    let j = i + 1; while (j < B.length && B[j].x < B[j - 1].x + B[j - 1].tw + NBUB.gap && Math.abs(B[j].y - B[j - 1].y) < NBUB.h + 12) { B[j].x = B[j - 1].x + B[j - 1].tw + NBUB.gap; j++; }
    if (j - i > 1) { const run = B.slice(i, j), want = run.reduce((t, b) => t + b.cx, 0) / run.length, got = (run[0].x + run[run.length - 1].x + run[run.length - 1].tw) / 2; for (const b of run) b.x += want - got; }
    i = j;
  }
  for (const b of B) {
    const age = performance.now() - b.c.at, bx = Math.round(b.x), by = b.y, mid = bx + b.tw / 2;
    ctx.save(); ctx.globalAlpha = Math.min(1, (NPARTY.show - age) / 400);
    const tip = Math.min(Math.max(b.cx, bx + 7), bx + b.tw - 7);
    ctx.fillStyle = b.col; ctx.beginPath(); ctx.moveTo(tip - 4, by + NBUB.h - 1); ctx.lineTo(tip + 4, by + NBUB.h - 1); ctx.lineTo(b.cx, by + NBUB.h + 6); ctx.fill();   // (the pointer, down to the speaker)
    ctx.fillStyle = 'rgba(24,16,10,0.92)'; rrect(ctx, bx, by, b.tw, NBUB.h, 4); ctx.fill();
    ctx.strokeStyle = b.col; ctx.lineWidth = 1; rrect(ctx, bx + 0.5, by + 0.5, b.tw - 1, NBUB.h - 1, 4); ctx.stroke();
    text(b.s, mid, by + NBUB.h / 2, '#fff6dc', NBUB.size);
    text(b.who, mid, by - 5, b.col, NBUB.name);   // (the name: the pixel text's own outline keeps it readable)
    ctx.restore();
  }
}

// ---- WHERE YOUR FRIENDS ARE: a friend off the edge of your screen gets an arrow at the edge, pointing at them, in their colour,
// with their name and how far away they are (in tiles). Screen layer (main.js passes the camera).
function drawNetPartyArrows(game, w, now, cam) {
  const N = game.net, me = w.player; if (!cam || !me) return;
  const others = N.role === 'host' ? netGuestList(game).map(G => netGuestActor(w, G.gid)).filter(Boolean) : w.actors.filter(a => a.kind === 'player' && a !== me && a.netWho);
  for (const a of others) {
    const x = (a.x - cam.x) * ZOOM, y = (a.y - 14 - cam.y) * ZOOM, m = 22, top = 34, bot = 104;   // (bot: clear of the skill bar and a boss's health bar)
    if (x > m && x < VW - m && y > top && y < VH - 22) continue;   // (on screen: no arrow)
    const cx = VW / 2, cy = (top + VH - bot) / 2, dx = x - cx, dy = y - cy, k = Math.min((VW / 2 - m) / Math.abs(dx || 1e-6), (dy < 0 ? cy - top : VH - bot - cy) / Math.abs(dy || 1e-6));
    const ex = cx + dx * k, ey = cy + dy * k, ang = Math.atan2(dy, dx), col = N.role === 'host' ? a.marker : (a.netWho === 'h' ? '#ffd27a' : a.marker || '#8fd8ff');
    const name = N.role === 'host' ? a.label : a.netWho === 'h' ? netName(N.host) : (a.label || 'Friend'), tiles = Math.round(Math.hypot(a.x - me.x, a.y - me.y) / T);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = 'rgba(20,13,8,0.85)'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    const lx = Math.max(40, Math.min(VW - 40, ex - Math.cos(ang) * 22)), ly = Math.max(16, Math.min(VH - 16, ey - Math.sin(ang) * 16));
    text(`${name} · ${tiles}`, lx, ly, col, 6.5);
    if (a.dead && Math.floor(now / 300) % 2) text('DOWN', lx, ly + 8, '#ff9a8a', 6.5);
  }
}

// ---- PARTY SIZE: tougher monsters and more loot with friends in the room (host only: combat.js and world.js ask)
const netPartyGuests = () => { const g = window.GAME; return g && g.net && g.net.role === 'host' ? Object.keys(g.net.guests).length : 0; };
function netPartyScale(att, def, dmg) {
  const n = netPartyGuests(); if (!n) return dmg;
  if (def.kind === 'monster' && !def.ally && att && att.kind !== 'monster') return Math.max(1, Math.round(dmg / (1 + NPARTY.hpPer * n)));   // (as if it had more health)
  if (att && att.kind === 'monster' && !att.ally && def.kind === 'player') return Math.max(1, Math.round(dmg * (1 + NPARTY.hitPer * n)));
  return dmg;
}
const netPartyLoot = () => 1 + NPARTY.lootPer * netPartyGuests();

// ---- REVIVE: each host frame (net.js netGuestInputs, for every friend who is down): anyone beside them holding Enter fills the ring
function netReviveTick(game, w, a, dt) {
  const N = game.net, helpers = [];
  const p = w.player; if (p && !p.dead && isDown('Enter') && Math.hypot(p.x - a.x, p.y - a.y) < NPARTY.reviveR) helpers.push(p);
  for (const G of Object.values(N.guests)) { if (G.gid === a.netGid || !(G.inp && G.inp.rv)) continue; const h = netGuestActor(w, G.gid); if (h && !h.dead && Math.hypot(h.x - a.x, h.y - a.y) < NPARTY.reviveR) helpers.push(h); }
  a.reviveHold = helpers.length ? (a.reviveHold || 0) + dt * helpers.length : Math.max(0, (a.reviveHold || 0) - dt * 2);
  if (a.reviveHold < NPARTY.reviveMs) return false;
  a.reviveHold = 0; Object.assign(a, { dead: false, dying: false, hp: Math.round(a.maxHp * NPARTY.reviveHp), mp: Math.round(a.maxMp * NPARTY.reviveHp), state: 'free', coopDown: 0, invuln: 1500 }); setAnim(a, 'idle', true);
  game.toast(`${a.label} is back on their feet, thanks to ${helpers.map(h => h === p ? netName(game.profile) : h.label).join(' and ')}!`, a.marker);
  return true;
}
// a guest is down nearby: Enter is for reviving, not talking (net.js asks before talk)
function netNearDowned(game, w) { const p = w.player; return !!p && w.actors.some(a => a !== p && a.kind === 'player' && a.dead && Math.hypot(a.x - p.x, a.y - p.y) < NPARTY.reviveR); }
// the ring over a fallen friend, and the prompt for whoever stands beside them (world space, every screen)
function drawNetRevive(game, w, now) {
  const me = w.player;
  for (const a of w.actors) {
    if (a.kind !== 'player' || !a.dead || a === me) continue;
    const y = a.y - 40, k = Math.min(1, (a.reviveHold || 0) / NPARTY.reviveMs);
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(a.x, y, 7, 0, Math.PI * 2); ctx.stroke();
    if (k > 0) { ctx.strokeStyle = '#8fffd0'; ctx.beginPath(); ctx.arc(a.x, y, 7, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    if (me && Math.hypot(me.x - a.x, me.y - a.y) < NPARTY.reviveR) text('Hold Enter to revive', a.x, y - 14, '#8fffd0', 7);
  }
}
