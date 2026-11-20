'use strict';
// ONLINE CO-OP: up to four players (the host and three friends) on computers on the same home network, through the game's own
// local server (tools/serve.py relays the messages; start it with --lan so the other computers can reach it). The HOST's game
// runs the world; each GUEST sees it and sends only their keys.
//   HOST   Hub > ONLINE CO-OP > Host: a 4-letter room code. Each friend who joins walks in as Player 2, 3 or 4, driven by the
//          keys they send. Every 60 ms the host sends one SNAPSHOT of everyone near any of the heroes.
//   GUEST  Hub > ONLINE CO-OP > Join + the code: the page reloads into the host's world (same seed, passed in the address,
//          so the guest's own saved world is untouched), then draws the snapshots, smoothing between them, with the camera
//          on their own hero. Their own rewards, gear and cards are saved on their side (never the host's world). Tab: inventory, X: log, Esc leaves.
// REWARDS: every kill counts for everyone there: each guest's game works out its own EXP and moves its own quests, daily
// contracts, story chapter and journey along (with their own rewards); kill gold is shared and loot goes to whoever walks over
// it. Each guest's share rides in every snapshot (numbered, resent until that guest says it has it) and lands in the GUEST'S
// OWN save on their computer.
const NET = { send: 60, poll: 50, hello: 400, inSend: 50, lerp: 0.35, near: { x: 520, y: 340 }, hostEvery: 2000, gone: 5000, stale: 8000, obEvery: 500, maxGuests: 3 };   // (gone: a guest silent this long has left; stale: a host silent this long is not responding)   // (hostEvery: the host's full profile, for drawing their hero, goes out only this often)
const netApi = (path, body) => fetch(srvUrl('net/' + path), body === undefined ? {} : { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }).then(r => r.ok ? r.json() : Promise.reject(r.status));
const netParams = () => new URLSearchParams(location.search);
// what the guest SEES besides heroes and monsters: loot on the ground and every spell and hit effect, with how long each lives
// (the same timers as updateEntities in combat.js, so the guest can age them between snapshots)
const NET_VIS = { drops: 0, projs: 0, bolts: 'dur', fx: 'dur', rings: 450, sparks: 260, slashes: 'impact', particles: 'life', circles: 'dur', summons: 'dur' };
const NET_VIS_MAX = { particles: 50, other: 120 };   // (per list, the newest: a huge battle can't swamp the connection; dust and sparkle matter least)
// the game's own data (sprite banks, animations: D in defs) is the same on both computers, so an effect that points into it
// travels as its path, {$d: 'fx.battle'}, instead of a copy (one spell's bank alone was 21 KB)
let NET_DATA = null;
function netDataPaths() {
  if (NET_DATA) return NET_DATA;
  NET_DATA = { byObj: new Map(), byPath: {} };
  const walk = (o, path, depth) => {
    if (!o || typeof o !== 'object' || depth > 4 || NET_DATA.byObj.has(o)) return;
    if (path) { NET_DATA.byObj.set(o, path); NET_DATA.byPath[path] = o; }
    if (Array.isArray(o) && typeof o[0] !== 'object') return;
    for (const k of Object.keys(o)) walk(o[k], path ? path + '.' + k : k, depth + 1);
  };
  walk(D, '', 0);
  for (const [name, root] of [['REGIONS', typeof REGIONS !== 'undefined' && REGIONS], ['ZONES', typeof ZONES !== 'undefined' && ZONES], ['SPECIES', typeof SPECIES !== 'undefined' && SPECIES], ['ITEMS', typeof ITEMS !== 'undefined' && ITEMS], ['MAPS', typeof MAPS !== 'undefined' && MAPS]]) if (root) walk(root, name, 1);   // (the other shared tables: a random crate points at its whole region)
  return NET_DATA;
}
// the guest's own HUD: what their bars and spell slots read from their hero, which only the host's game keeps up to date
const NET_ME = ['cds', 'shield', 'combo', 'comboT', 'lastCombo', 'fusionUsed', 'dashCd', 'dashCdMax', 'blockT', 'blockHeld', 'blockFlash', 'layerCd', 'layerCdMax', 'layerSel', 'selReq', 'exhausted', 'sup', 'coopDown', 'chainN', 'chainSlot', 'chainLeft'];   // (chainN/Slot/Left: a friend's card chain, for their slot chips: cardchain.js)
let NET_ID = 0;
const netIdOf = a => a.netId || (a.netId = ++NET_ID);

// ---- WORLD RECIPES: caves, rifts, towers and raids are built from a fixed map (mapWorld) or the black hole (makeVoidWorld), plus
// tints on the ground. Every world built is labelled with how, so a guest's game can build the very same ground when the host goes in.
{
  const mw = mapWorld, vw = makeVoidWorld, tc = tintCanvas;
  const tagBase = w => { for (const o of w.objects || []) if (o.region == null) o.netBase = true; return w; };   // (same on both computers: net.js object sync)
  mapWorld = (key, bounds) => { const w = tagBase(mw(key, bounds)); w.netRecipe = { f: 'map', k: key, b: bounds || null }; return w; };
  makeVoidWorld = () => { const w = tagBase(vw()); w.netRecipe = { f: 'void' }; return w; };
  tintCanvas = (src, col) => { const c = tc(src, col); c.netTints = ((src && src.netTints) || []).concat([col]); return c; };
}
// can friends be in this world with the host? Anywhere their game can build the same ground: out of doors, black holes, rifts,
// towers, raids, and indoors too (houses, shops, your home and its rooms). Worlds built some other way (the training arena) are not.
const netShareable = w => !!w && (w.overworld || !!w.netRecipe);
function netWorldTag(game, w) {
  const N = game.net; if (N.wObj !== w) { N.wObj = w; N.wid = (N.wid || 0) + 1; }
  return { id: N.wid, r: w.overworld ? { f: 'ow' } : w.netRecipe, tints: (w.bg && w.bg.netTints) || [], name: w.name, cave: !!w.cave, zone: w.zone, zoom: w.zoom, interior: !!w.interior, peaceful: !!w.peaceful, home: !!w.home, hall: !!w.hall, ho: w.netHomeOf || undefined };   // (ho: a friend's home, built from their save: netsocial.js)
}

// ---- FRIENDS: each save remembers who it played with (pr.coopFriends: name, class, level, when, newest first, up to 8) and,
// for a guest, the last room it was in (pr.coopLast), so the menu can offer REJOIN for a while (rooms close after 10 idle minutes)
const NFRIEND = { keep: 8, rejoin: 15 * 60000 };
function netRemember(game, prof) {
  const pr = game.profile, name = netName(prof); if (!pr || !prof || name === netName(pr)) return;
  const L = (pr.coopFriends || []).filter(f => f.name !== name);
  L.unshift({ name, cls: prof.cls, lv: prof.lv || 1, at: Date.now() }); pr.coopFriends = L.slice(0, NFRIEND.keep);
}
const netAgo = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const netRejoinable = pr => pr && pr.coopLast && Date.now() - pr.coopLast.at < NFRIEND.rejoin ? pr.coopLast : null;

// ---- the menu (Hub > ONLINE CO-OP)
function netMenu() { return { type: 'netmenu', cur: 0, code: '', msg: '', t: 0 }; }
function updateNetMenu(game, m, dt) {
  m.t += dt;
  if (hit('Escape')) { game.closeMenu(); return; }
  const rows = netRejoinable(game.profile) ? 3 : 2;
  if (hit('ArrowUp', 'KeyW') && !m.code) m.cur = (m.cur + rows - 1) % rows;
  if (hit('ArrowDown', 'KeyS') && !m.code) m.cur = (m.cur + 1) % rows;
  for (const ch of (typeof typed !== 'undefined' ? typed : [])) if (/^[a-z]$/i.test(ch) && m.code.length < 4) { m.code += ch.toUpperCase(); m.cur = 1; m.msg = ''; }   // any letter goes into the code
  if (hit('Backspace')) { m.code = m.code.slice(0, -1); m.cur = 1; }
  let go = hit('Enter', 'NumpadEnter') ? m.cur : -1;   // (only Enter or a click confirms: J and F are letters here)
  if (clicked(VW / 2 - 110, 120, 220, 34)) go = 0;
  if (clicked(VW / 2 - 110, 170, 220, 34)) go = 1;
  if (rows === 3 && clicked(VW / 2 - 110, 220, 220, 34)) go = 2;
  if (go === 2) { m.cur = 2; m.code = netRejoinable(game.profile).room; netJoin(game, m); return; }   // REJOIN the last room
  if (go === 0) { m.cur = 0; netHost(game, m); }
  else if (go === 1) { m.cur = 1; if (m.code.length === 4) netJoin(game, m); else m.msg = m.code.length ? `${4 - m.code.length} more letter${m.code.length === 3 ? '' : 's'} to go` : 'Type the 4-letter room code from the host, then click JOIN'; }
}
function drawNetMenu(game, m, now) {
  ctx.fillStyle = 'rgba(6,4,14,0.82)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle('ONLINE CO-OP', VW / 2, 60, 18, now);
  text('Up to four players, one home network', VW / 2, 86, '#c9b89a', 8);
  const last = netRejoinable(game.profile), rows = [['HOST A GAME', 'Get a room code for up to three friends'], [`JOIN: ${(m.code + '____').slice(0, 4)}${m.cur === 1 && m.code.length < 4 && Math.floor(m.t / 400) % 2 ? '|' : ''}`, 'Type the host code, then click here or press Enter']];
  if (last) rows.push([`REJOIN ${last.room}`, `${last.host ? last.host + "'s room · " : ''}${netAgo(last.at)}`]);
  rows.forEach(([a, b], i) => {
    const y = 120 + i * 50, on = m.cur === i; ctx.fillStyle = on ? 'rgba(90,60,20,0.9)' : 'rgba(40,26,17,0.85)'; rrect(ctx, VW / 2 - 110, y, 220, 34, 6); ctx.fill();
    ctx.strokeStyle = goldFrameGrad(y, 34); ctx.lineWidth = 1.2; rrect(ctx, VW / 2 - 109.5, y + 0.5, 219, 33, 6); ctx.stroke();
    text(a, VW / 2, y + 12, on ? '#ffe9a8' : '#d8d0c0', 10); text(b, VW / 2, y + 25, '#a8a0b8', 6.5);
  });
  if (m.msg) text(m.msg, VW / 2, last ? 268 : 240, '#ffb07a', 8);
  if (/^https:/.test(srvBase())) {   // (the public game server: everyone meets there, wherever they are)
    text(`Everyone meets on the game server:  ${srvHost()}`, VW / 2, 290, '#9aa4b8', 7);
    text('Friends play on the website or in the phone app, then JOIN with your code', VW / 2, 304, '#9aa4b8', 7);
  } else {
    text('The host starts the server with:  python tools/serve.py 8766 --lan', VW / 2, 290, '#9aa4b8', 7);
    text('Friends open  http://<host computer IP>:8766  and join from here', VW / 2, 304, '#9aa4b8', 7);
  }
  const F = (game.profile && game.profile.coopFriends) || [];   // PLAYED WITH, on the right
  if (F.length) { const x = VW / 2 + 128; text('PLAYED WITH', x + 58, 116, '#ffd27a', 8); F.slice(0, 6).forEach((f, i) => { text(f.name, x, 132 + i * 22, '#e8e2cf', 7.5, 'left'); text(`Lv ${f.lv} ${className(f.cls)} · ${netAgo(f.at)}`, x, 141 + i * 22, '#9aa4b8', 6, 'left'); if (f.title) text(f.title, VW - 8, 132 + i * 22, '#c88aff', 6, 'right'); }); }   // (the title they wore: netsocial.js)
  drawNetRecord(game);   // your PARTY RECORD, on the left (netsocial.js)
  text('↑↓ choose · Enter · Esc: back', VW / 2, VH - 14, '#9a917c', 7);
}

// Log > HOST CODE: the room you are hosting (or joined), who is in it, and the address your friends open
function netLogRows(game, m) {
  if (!m.addr) { m.addr = [location.host]; fetch('/net/addr').then(r => r.json()).then(a => { if (a && a.ips && a.ips.length) m.addr = a.ips.map(ip => `${ip}:${a.port}`); }).catch(() => {}); }
  const N = game.net, rows = [];
  if (N && N.role === 'host') {
    const gs = Object.values(N.guests);
    rows.push({ name: `Room code:  ${N.room}`, col: '#8fd8ff', sub: gs.length ? `${gs.length} of ${NET.maxGuests} friends in` : 'Waiting for your friends to join', right: gs.length >= NET.maxGuests ? 'FULL' : 'OPEN', rightCol: gs.length >= NET.maxGuests ? '#9be38a' : '#ffe9a8' });
    for (const G of gs) rows.push({ name: `Player ${G.slot}:  ${netName(G.prof)}`, col: NET_SLOT_COL[G.slot], sub: `Lv ${G.prof.lv || 1} · ${className(G.prof.cls)}` });
  } else if (N && N.role === 'guest') rows.push({ name: `Joined room:  ${N.room}`, col: '#8fd8ff', sub: 'You are playing in your friend\'s world · Esc leaves' });
  else rows.push({ name: 'No room open', col: '#c9b89a', sub: 'Hub > ONLINE CO-OP > HOST A GAME gives you a code' });
  if (/^https:/.test(srvBase())) rows.push({ name: `Game server:  ${srvHost()}`, col: '#e8e2cf', sub: 'Friends anywhere: the website or the phone app, then Hub > ONLINE CO-OP > JOIN' });
  else for (const a of m.addr) rows.push({ name: `Friends open:  http://${a}`, col: '#e8e2cf', sub: 'In their browser, on the same home network, then Hub > ONLINE CO-OP > JOIN' });
  return rows;
}
const netName = pr => (pr && pr.look && pr.look.name) || 'Your friend';
const NET_SLOT_COL = { 2: '#4ea8ff', 3: '#7be38a', 4: '#ffb84a' };   // (each friend's marker and panel colour)

// ---- HOST
function netHost(game, m) {
  const pr = game.profile; m.msg = 'Opening a room…'; netDataPaths();   // (the shared-data table, built now rather than mid-fight)
  netApi('host', { seed: WORLD_SEED, profile: pr }).then(r => {
    game.net = { role: 'host', room: r.room, guests: {}, sendT: 0, pollT: 0, helloT: 0, busy: false, hbusy: false };
    addEventListener('pagehide', () => navigator.sendBeacon(srvUrl('net/leave?room=' + r.room)));   // (closing the game closes the room, so the guests hear at once)
    game.closeMenu(); game.goTown('home'); game.toast(`Room ${r.room} is open: up to ${NET.maxGuests} friends join with this code`, '#8fd8ff');   // (outside your front door: friends can only walk in out of doors)
  }).catch(() => { m.msg = srvBase() ? `Could not open a room: ${srvHost()} did not answer · try again in a minute` : 'Could not open a room (is the game served by tools/serve.py?)'; });
}
const netGuestList = game => game.net && game.net.role === 'host' ? Object.values(game.net.guests) : [];
const netGuestActor = (w, gid) => w && w.actors.find(a => a.netGid === gid && !a.remove);
// each host world frame (main.js): learn who joined, read everyone's keys, send the world
function netHostTick(game, w, dt) {
  const N = game.net; if (!N || N.role !== 'host') return;
  N.pollT -= dt; N.sendT -= dt; N.helloT -= dt;
  const lost = e => { if (e === 404 && game.net === N) netRoomLost(game); };   // (the room is gone: the server restarted or it sat idle too long)
  if (N.helloT <= 0 && !N.hbusy) {   // (who is in: a new friend can arrive at any time)
    N.helloT = NET.hello; N.hbusy = true;
    netApi('hello?room=' + N.room).then(list => { if (game.net !== N) return; for (const h of list || []) if (h && h.hello && h.hello.profile && !N.guests[h.gid]) netGuestJoined(game, h.gid, h.hello.profile); }).catch(lost).finally(() => { N.hbusy = false; });
  }
  const gs = Object.values(N.guests); if (!gs.length) return;
  if (N.pollT <= 0 && !N.busy) {
    N.pollT = NET.poll; N.busy = true;
    netApi('in?room=' + N.room).then(map => {
      if (game.net !== N) return; const now = performance.now();
      for (const G of Object.values(N.guests)) {
        const list = map && map[G.gid];
        if (list === undefined) { netGuestGone(game, G.gid); continue; }   // (they left: Esc or closed the tab)
        if (list.length) G.lastIn = now; else if (now - G.lastIn > NET.gone) { netGuestGone(game, G.gid); continue; }   // (silent: crashed or lost the network)
        for (const i of list) { for (const t of i.tm || []) netTradeMsg(game, G.gid, t); for (const d of i.dm || []) netDuelMsg(game, G.gid, d); if (i.ch !== undefined) netChatHeard(game, G.gid, i.ch); if (i.fm) netFarmHelp(game, G.gid); if (i.cx) netPlayMsg(game, G.gid, i.cx); if (i.mx === undefined) continue;   // (a trade move on its own)
          G.inp = i; if (i.ack) G.rw = G.rw.filter(e => e.n > i.ack); if (i.prof) netGuestProfile(game, G.gid, i.prof); for (const k of ['atk', 'dash', 'layer', 'fsel', 'veh']) if (i[k]) G.edges[k] = true; (i.spell || []).forEach((s, j) => { if (s) G.edges['s' + j] = true; }); }
      }
    }).catch(lost).finally(() => { N.busy = false; });
  }
  netDuelTick(game, w, dt);   // a friendly duel (netduel.js)
  netBossTick(game, w, dt);   // a party boss hunt (netboss.js)
  netPetsTick(game, w, dt);   // each friend's own pets and partner (netpets.js)
  netPlayTick(game, w, dt);   // run requests, fishing, loot rolls (netplay.js)
  if (N.sendT <= 0) { N.sendT = NET.send; netApi('snap?room=' + N.room, netSnapshot(game, w)).catch(lost); }
}
// a friend is in: they get the lowest free player number (2 to 4) and walk in beside you
function netGuestJoined(game, gid, prof) {
  const N = game.net, used = new Set(Object.values(N.guests).map(G => G.slot)), slot = [2, 3, 4].find(s => !used.has(s)) || 4;
  N.guests[gid] = { gid, prof, slot, inp: { mx: 0, my: 0 }, edges: {}, rw: [], rwSeq: 0, lastIn: performance.now() };
  N.hostT = 0;   // (the next snapshot carries everyone's profiles, so the newcomer can draw the rest of you at once)
  netRemember(game, prof); game.save();   // (PLAYED WITH, in the menu)
  netPqFill(N);   // (the party's shared contracts, netquest.js)
  netSpawnGuest(game, game.world, N.guests[gid]);
  game.toast(`${netName(prof)} joined room ${N.room} as Player ${slot}!`, NET_SLOT_COL[slot]);
  game.toast(`Party of ${Object.keys(N.guests).length + 1}: monsters are tougher and drop more`, '#ffd27a');
}
function netSpawnGuest(game, w, G) {
  if (!w || !w.player || !netShareable(w) || netGuestActor(w, G.gid)) return null;
  const p = w.player, q = findOpen(w, p.x + 18 + (G.slot - 2) * 14, p.y + 6 + (G.slot - 2) * 10), a = makePlayerActor(G.prof, p.team, q.x, q.y); a.layerM = G.prof.layerM || {};   // (their own Layer skills, not every one maxed)
  Object.assign(a, { coop2: true, netGid: G.gid, pvp: 1, marker: NET_SLOT_COL[G.slot], label: `Player ${G.slot}` }); a.dir = p.dir; w.actors.push(a); return a;
}
// the rest of the party as small bars under the big panel on the right: name, level, health (red when down)
function netMiniBars(list) {
  list.forEach(({ a, name, col }, i) => {
    const x = VW - 112, y = 84 + i * 16, k = a.dead ? 0 : Math.max(0, a.hp / a.maxHp);
    ctx.fillStyle = 'rgba(20,13,8,0.8)'; rrect(ctx, x, y, 106, 13, 3); ctx.fill();
    ctx.fillStyle = hexA(col, 0.55); rrect(ctx, x + 1, y + 1, Math.max(0, 104 * k), 11, 3); ctx.fill();
    text(`${name} · Lv ${a.lv || 1}`, x + 4, y + 7, a.dead ? '#ff9a8a' : '#ffffff', 6.5, 'left'); text(a.dead ? 'DOWN' : `${Math.round(a.hp)}/${a.maxHp}`, x + 102, y + 7, a.dead ? '#ff9a8a' : '#ffffff', 6, 'right');
  });
}
// the room vanished (the server restarted, or 10 idle minutes): stop hosting and say how to start again
function netRoomLost(game) {
  const w = game.world; if (w) w.actors = w.actors.filter(x => !x.netGid);
  game.net = null;
  game.toast('Your co-op room closed (the game server restarted?) · open a new one: Hub > ONLINE CO-OP', '#ff9a8a');
}
// a friend left (Esc, closed the tab, lost the network): their hero walks off, the room stays open for them to come back
function netGuestGone(game, gid) {
  const N = game.net, G = N.guests[gid]; if (!G) return;
  for (const W of [game.world, game.outside]) if (W) { for (const a of W.actors) if (a.netGid === gid) a.remove = true; W.actors = W.actors.filter(a => a.netGid !== gid); }
  delete N.guests[gid];
  for (const T of Object.values(N.trades || {})) if (T.a === gid || T.b === gid) { delete N.trades[T.id]; if (game.menu && game.menu.type === 'ntrade' && game.menu.id === T.id) game.closeMenu(); }   // (their trades end with them)
  game.toast(`${netName(G.prof)} left · room ${N.room} stays open if they want back in`, '#8fd8ff');
}
// a friend levelled up or changed gear on their side: rebuild their hero from the new profile, where they stand
function netGuestProfile(game, gid, prof) {
  const N = game.net, w = game.world, G = N.guests[gid]; if (!G) return; G.prof = prof;
  const i = w ? w.actors.findIndex(x => x.netGid === gid && !x.remove) : -1; if (i < 0) return; const o = w.actors[i];
  const a = makePlayerActor(prof, o.team, o.x, o.y); a.layerM = prof.layerM || {};
  keepFightState(o, a);   // (mid-Layer, on cooldown or at the wheel: carries on, main.js)
  for (const b of a.sup || []) a.passives[b.k] = (a.passives[b.k] || 0) + b.v; if (a.kiSurge) kiSurgeStat(a, 2);   // (as refreshPlayer does)
  Object.assign(a, { coop2: true, netGid: gid, pvp: 1, marker: o.marker, label: o.label, netId: o.netId, coopDown: o.coopDown, vLook: o.vLook, vShieldS: o.vShieldS });
  a.hp = o.dead ? 0 : Math.max(1, Math.round(a.maxHp * o.hp / Math.max(1, o.maxHp))); a.mp = Math.min(a.maxMp, o.mp);
  w.actors[i] = a;
}
// each host world frame (main.js, before the world steps): every friend's hero is here (or walks in), stands back up after a
// fall, stays near you, and gets their keys for this frame. Returns { gid: input }.
function netGuestInputs(game, w, safe, dt) {
  const out = {}, p = w.player; if (!p) return out;
  for (const G of netGuestList(game)) {
    const a = netGuestActor(w, G.gid) || netSpawnGuest(game, w, G); if (!a) continue;
    if (a.dead || a.hp <= 0) {
      if (netReviveTick(game, w, a, dt)) { out[G.gid] = NO_INPUT; continue; }   // a friend held Enter beside them (netparty.js)
      a.coopDown = (a.coopDown || 0) + dt;
      if (a.coopDown >= COOP.revive) { const q = findOpen(w, p.x + 20, p.y + 8); Object.assign(a, { x: q.x, y: q.y, dead: false, dying: false, hp: a.maxHp, mp: a.maxMp, state: 'free', coopDown: 0, invuln: 1500 }); setAnim(a, 'idle', true); game.toast(`${a.label} is back on their feet`, a.marker); }
      out[G.gid] = NO_INPUT; continue;
    }
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d > COOP.pull) { const q = findOpen(w, p.x + 20, p.y + 8); a.x = q.x; a.y = q.y; a.vx = a.vy = 0; }   // left far behind: pulled along
    const i = G.inp || {}, e = G.edges; G.edges = {};   // (held keys as last sent; each press used once)
    const inp = { mx: i.mx || 0, my: i.my || 0, block: !!i.block, atk: !!e.atk, dash: !!e.dash, layer: !!e.layer, fsel: !!e.fsel, veh: !!e.veh, fusion: false, spell: [!!e.s0, !!e.s1, !!e.s2] };
    if (d > COOP.leash) { const dx = a.x - p.x, dy = a.y - p.y; if (Math.sign(inp.mx) === Math.sign(dx)) inp.mx = 0; if (Math.sign(inp.my) === Math.sign(dy)) inp.my = 0; }   // can't wander off screen
    out[G.gid] = netGuestCar(game, w, a, G.prof, safe && !a.duelLive ? { ...inp, atk: false, spell: [false, false, false], fusion: false, layer: false, block: false } : inp, dt);
  }
  return out;
}
// A FRIEND'S CAR: 9 on their keyboard gets their hero in or out of the car they have equipped in their own garage, anywhere a
// car can go (they have no parked car in your world). At the wheel: car speed, no fighting, eight headings, and a shield of its
// own that mends after a while (vehicles.js)
function netGuestCar(game, w, a, prof, inp, dt) {
  const G = prof && prof.garage, car = G && G.cur && G.owned && G.owned[G.cur] ? G.cur : null, S = vehShield(game, a);
  if (performance.now() - S.hitAt > VEH.shield.wait && S.hp < S.max) S.hp = Math.min(S.max, S.hp + S.max * VEH.shield.regen * dt / 1000);
  if (S.broken && S.hp >= S.max) S.broken = false;
  if (inp.veh) {
    if (a.driving) { a.driving = null; game.toast(`${a.label} parks and steps out`, a.marker); }
    else if (!car) game.toast(`${a.label} has no car yet`, '#ff9a8a');
    else if (!canDrive(w, a)) game.toast('No driving here', '#ff9a8a');
    else if (S.broken) game.toast(`${a.label}'s car is still being mended`, '#ff9a8a');
    else { a.driving = car; a.vLook = [G.paint && G.paint[car], G.tint && G.tint[car]]; a.vDir = 2; a.vStun = 0; a.vx = a.vy = 0; game.toast(`${a.label} drives off in a ${vehModel(car).name}`, a.marker); }
  }
  if (a.driving && !canDrive(w, a)) a.driving = null;
  if (!a.driving) return inp;
  if (Math.abs(inp.mx || 0) > 0.2 || Math.abs(inp.my || 0) > 0.2) a.vDir = vehDirOf(inp.mx || 0, inp.my || 0);
  return { ...inp, atk: false, spell: [false, false, false], fusion: false, layer: false, dash: false, block: false };
}
// something for your friends (onMonsterKill, gainGold and collectDrops in world.js, the black hole boss in caves.js), kept until
// each confirms it: kills and kill gold go to everyone who is with you; loot (gid given) only to whoever picked it up
function netShare(game, k, v, gid) {
  const w = game.world; if (game.menu || !w) return;   // (only what is earned out in the world: not quest, login or menu rewards)
  for (const G of netGuestList(game)) {
    if (gid ? G.gid !== gid : !netGuestActor(w, G.gid)) continue;
    G.rwSeq++; G.rw.push({ n: G.rwSeq, k, v }); if (G.rw.length > 300) G.rw.shift();
  }
}
// drawn on the host's screen (main.js): each friend's panel (the first one as big as yours, the others as small bars) and their falls
function netHostHud(game, w, now) {
  const gs = netGuestList(game).map(G => ({ G, a: netGuestActor(w, G.gid) })).filter(x => x.a); if (!gs.length) return;
  const first = gs[0].a; drawHUD(first, 1, now, `${first.label} · ${className(first.cls)}`);
  netMiniBars(gs.slice(1).map(({ a }) => ({ a, name: a.label, col: a.marker })));
  gs.forEach(({ a }, i) => { if (a.dead || a.hp <= 0) text(`${a.label} is down · back in ${Math.max(0, Math.ceil((COOP.revive - (a.coopDown || 0)) / 1000))}s`, VW - 90, 76 + (gs.length - 1) * 16 + 12 + i * 10, '#ff9a8a', 7); });
}
// who an NPC is (sent every 2 s): their job, name and line, so a friend's game can talk to them and open the right shop
const netNpcInfo = a => ({ role: a.role, label: a.label, line: a.line, favour: a.favour, town: a.town, away: !!a.away, storyNpc: a.storyNpc, wanderer: a.wanderer ? JSON.parse(JSON.stringify(a.wanderer)) : undefined });
// a snapshot entry without what costs bytes and says nothing: false flags, empty fields, a monster's mana (a 40-monster fight
// was 15 KB a snapshot). Numbers the guest does sums with (z, scale, hp) always stay, even at 0 or 1.
function netSlim(e) {
  for (const k in e) if (e[k] === false || e[k] === null || e[k] === undefined || (k === 'pid' && !e[k]) || (k === 'who' && !e[k])) delete e[k];
  if (e.k === 'monster') { delete e.mp; delete e.mm; }
  return e;
}
function netSnapshot(game, w) {
  const p = w.player, gs = w.actors.filter(a => a.netGid && !a.remove), heroes = [p, ...gs].filter(Boolean), near = a => heroes.some(h => Math.abs(a.x - h.x) < NET.near.x && Math.abs(a.y - h.y) < NET.near.y);
  const N = game.net, sendHost = !(N.hostT > 0); if (sendHost) N.hostT = NET.hostEvery; else N.hostT -= NET.send;
  const rw = {}; for (const G of netGuestList(game)) rw[G.gid] = G.rw;
  const profs = sendHost ? Object.fromEntries(netGuestList(game).map(G => [G.gid, G.prof])) : undefined;   // (so each friend can draw the others)
  if (!netShareable(w)) return { at: performance.now(), clock: game.profile.clock, host: sendHost ? game.profile : undefined, gp: profs, away: true, acts: [], fl: [], rw, trades: Object.values(N.trades || {}) };   // (indoors: friends wait outside)
  const acts = w.actors.filter(a => !a.remove && (a.kind === 'player' || a.kind === 'monster' || a.kind === 'npc') && near(a)).map(a => ({
    i: netIdOf(a), k: a.kind, who: a === p ? 'h' : a.netGid || 0, sp: a.sp, tr: a.tier, npc: a.npc, pid: a.heroPartner ? (partnerOf(game.profile) || {}).id : a.netPartner || 0, ppt: a.heroPartner ? (partnerOf(game.profile) || {}).paint : a.netPartner ? a.netPaint : undefined, pet: !!a.pet && !a.heroPartner && !a.netPartner, nb: !!a.npcBody,
    x: Math.round(a.x), y: Math.round(a.y), z: Math.round(a.z || 0), d: a.dir, an: a.anim, t: Math.round(a.t || 0), lp: a.loop, hp: Math.round(a.hp), mh: a.maxHp, mp: Math.round(a.mp || 0), mm: a.maxMp,
    dd: !!a.dead, lv: a.kind === 'player' ? a.lv : undefined, lc: a.kind === 'player' ? a.layerChoice : undefined, gq: a.kind === 'player' && a.gstPct < 100 ? a.gstPct : undefined, ct: a.kind === 'player' && a.counterT > 0 ? Math.round(a.counterT) : undefined, cw: a.crushWind > 0 ? Math.round(a.crushWind) : undefined, fg: a.fgUp > 0 ? Math.round(a.fgSt) : undefined, wu: a.kind === 'monster' && a.windup ? [Math.round(a.windup.t), a.windup.small ? 1 : 0] : undefined, ss: a.kind === 'monster' && a.status ? Object.keys(a.status).filter(k => a.status[k]).map(k => { const v = a.status[k], t = typeof v === 'number' ? v : v && v.t; return t > 0 && t < 1e6 ? `${k}:${Math.round(t)}` : k; }).join(',') || undefined : undefined,   /* (with the ms left, so a friend sees the status timer lines: statustimer.js) */ ru: a.rushUntil > performance.now() ? Math.round(a.rushUntil - performance.now()) : undefined, rc: a.rushUntil > performance.now() ? a.rush || 0 : undefined, fr: a.foeRole || undefined, fa: a.arAim > 0 && a.arAt ? [Math.round(a.arAim), Math.round(a.arAt.x), Math.round(a.arAt.y)] : a.shCast > 0 ? [Math.round(a.shCast)] : undefined, fc: a.fcCharge ? [+a.fcCharge.dx.toFixed(3), +a.fcCharge.dy.toFixed(3), Math.round(a.fcCharge.len), a.fcCharge.wind ? Math.round(a.fcCharge.t) : -1] : undefined, lb: a.label || (a.heroPartner ? (partnerOf(game.profile) || {}).name : undefined), mk: a.netGid ? a.marker : undefined, b: !!a.boss, kt: a.kit || undefined, wk: a.wildKit || undefined, sc: a.scale, al: !!a.ally, tc: Math.round(a.transcend || 0), le: a.layerEl, dr: a.driving || null, vd: a.vDir, vl: a.driving ? (a.vLook || (a === p ? [garageOf(game.profile).paint[a.driving], garageOf(game.profile).tint[a.driving]] : undefined)) : undefined, rd: !!a.riding, st: a.state, rh: a.kind === 'player' && a.dead ? Math.round(a.reviveHold || 0) : undefined, nf: sendHost && (a.role || a.wanderer || a.storyNpc) ? netNpcInfo(a) : undefined })).map(netSlim);
  const fl = []; for (const f of w.floats || []) if (!f.netSent) { f.netSent = true; fl.push({ x: Math.round(f.x), y: Math.round(f.y), s: f.str, c: f.col, z: f.size }); }
  const vis = netVisPack(w, near);
  const me = {}; for (const a of gs) { const o = {}; for (const k of NET_ME) if (a[k] !== undefined) o[k] = a[k]; me[a.netGid] = JSON.parse(netPackJSON(o, w)); }
  let ob; if (!(N.obT > 0)) { N.obT = NET.obEvery; ob = netObjPack(w, heroes); } else N.obT -= NET.send;
  return { at: performance.now(), clock: game.profile.clock, host: sendHost ? game.profile : undefined, gp: profs, acts, fl, rw, vis, ob, me, chat: N.chat, pq: N.pq, trades: Object.values(N.trades || {}), duel: N.duel, duelAsk: N.duelAsk, duelNews: N.duelNews, wt: netWorldTag(game, w), rift: w.rift ? JSON.parse(netPackJSON(w.rift, w)) : null, shake: w.shake || 0, flash: w.flash || null, spell: w.spellName || null };
}
// WORLD OBJECTS near the heroes, every half second: the ones built with the world travel as just a key (type and place)
// plus '|o' when a chest stands open; what is missing from the list was broken, smashed or taken. Things that appeared
// since (random crates and chests, camps, landmarks) travel whole.
const netObjKey = o => `${o.bank},${Math.round(o.x)},${Math.round(o.bottom)}`;   // (no frame number: an opening chest animates)
function netObjPack(w, heroes) {
  const base = [], dyn = [];
  for (const o of w.objects) {
    if (o.decor || typeof o.draw === 'function' || o.breaking != null) continue;
    if (!heroes.some(h => Math.abs(o.x - h.x) < NET.near.x && Math.abs(o.bottom - h.y) < NET.near.y)) continue;
    if (o.netBase) base.push(netObjKey(o) + (o.opened ? '|o' : '')); else dyn.push(o);
  }
  return { at: heroes.map(h => [Math.round(h.x), Math.round(h.y)]), base, dyn: netPackJSON(dyn, w) };
}
// the guest's side: inside the same boxes, drop what the host no longer has, open what the host opened, swap in the new things
function netObjApply(game, w, ob) {
  const N = game.net, inBox = o => ob.at.some(([x, y]) => Math.abs(o.x - x) < NET.near.x && Math.abs(o.bottom - y) < NET.near.y);
  const keep = new Map(ob.base.map(s => s.split('|')));
  const dp = netDataPaths().byPath, dyn = JSON.parse(ob.dyn, (k, v) => !v || typeof v !== 'object' ? v : v.$a !== undefined ? (N.acts[v.$a] || null) : v.$d !== undefined ? (dp[v.$d] || null) : v);
  w.objects = w.objects.filter(o => {
    if (o.decor || typeof o.draw === 'function' || !inBox(o)) return true;
    if (!o.netBase) return false;   // (the host's new things from last time: replaced below)
    const k = netObjKey(o); if (!keep.has(k)) return false;
    if (keep.get(k) === 'o' && !o.opened) { o.opened = true; o.openT = 1e5; }
    return true;
  });
  for (const o of dyn) if (o) w.objects.push(o);
  w._grid = null;
}
// the effect lists as JSON: heroes and monsters inside them become {$a: id} (the guest swaps in its own copy), numbers lose
// their long tails, and anything the page can't send (functions, images, the world itself) is left out
function netVisPack(w, near) {
  const out = {};
  for (const k in NET_VIS) {
    let L = (w[k] || []).filter(o => o && (o.x == null || near(o)));
    const max = NET_VIS_MAX[k] || NET_VIS_MAX.other; if (L.length > max) L = L.slice(-max);
    if (L.length) out[k] = L;
  }
  return netPackJSON(out, w);
}
function netPackJSON(out, w) {
  const seen = new WeakSet(), data = netDataPaths().byObj;
  return JSON.stringify(out, function (key, v) {
    if (typeof v === 'number') return Math.round(v * 100) / 100;
    if (!v || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
    if (v === w || (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) || (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) || v instanceof CanvasRenderingContext2D) return undefined;
    if (key !== '' && v.kind && 'hp' in v && v.x != null) return { $a: netIdOf(v) };
    if (data.has(v)) return { $d: data.get(v) };
    if (seen.has(v)) return undefined; seen.add(v); return v;
  });
}

// ---- GUEST
function netJoin(game, m) {
  m.msg = 'Looking for the room…';
  netApi('info?room=' + m.code).then(info => { if (info.full) { m.msg = `Room ${m.code} is full (four players) · if you just left it, try again in a few seconds`; return; } location.href = `index.html?join=${m.code}&seed=${info.seed}`; }).catch(() => { m.msg = `No room ${m.code} here`; });
}
// on the title screen, after a reload into the host's world (?join=CODE&seed=N): join and start
function netGuestBoot(game) {
  if (game.netBoot) return false; const room = netParams().get('join'); if (!room) return false; game.netBoot = true;
  const pr = game.saved || newProfile(0); game.profile = JSON.parse(JSON.stringify(pr));
  netDataPaths(); game.refreshPlayer = () => {};   // (a guest's hero on screen is the host's copy: nothing to rebuild here)
  game.save = () => { if (game.net) { saveGame(netMine(game)); game.net.profDirty = true; } };   // (only the guest's own profile, with their own clock; the host rebuilds Player 2 from it)
  { const cm = game.closeMenu.bind(game); game.closeMenu = () => { cm(); game.save(); }; }   // (gear or cards changed in a menu: saved and sent)
  for (const k of ['goTown', 'goHub', 'goAdventure', 'goTraining', 'goArena']) game[k] = () => game.toast('Only the host decides where you go · Esc leaves the room', '#ffb07a');   // (a guest stays in the host's world)
  game.backToTitle = () => { const N = game.net; if (N && !N.lost) netApi(`leave?who=guest&gid=${N.gid}&room=${N.room}`, {}).catch(() => {}); location.href = 'index.html'; };   // (the main menu from the pause screen: leave the room properly)
  netApi('join?room=' + room, { profile: game.profile }).then(r => {
    const gid = r.gid, IN = `in?room=${room}&gid=${gid}`;
    game.profile.coopLast = { room, at: Date.now() };   // (REJOIN in the menu; saved with the first save below)
    game.net = { role: 'guest', room, gid, IN, snap: null, acts: {}, held: {}, sendT: 0, pollT: 0, busy: false, seen: false, ack: 0, myClock: game.profile.clock, heard: performance.now() };
    game.closeMenu(); game.world = makeOverworld(game, { x: ALTAR.x, y: ALTAR.y + 40 }); game.world.actors = []; game.scene = 'world'; game.net.wObj = game.world;   // (the one world a guest may be in: changed only by following the host)
    game.toast(`Joined room ${room}: waiting for the host…`, '#8fd8ff');
    addEventListener('pagehide', () => { if (!game.net.lost) navigator.sendBeacon(srvUrl(`net/leave?who=guest&gid=${gid}&room=${room}`)); });   // (closing the tab steps out of the room at once)
    setInterval(() => { const M = game.net; if (M && !M.lost && performance.now() - (M.sentAt || 0) > 900) { M.sentAt = performance.now(); netApi(IN, { mx: 0, my: 0, ack: M.ack }).catch(() => {}); } }, 1000);   // (a heartbeat while this tab is in the background and draws no frames, so the host doesn't think you left)
  }).catch(e => { game.toast(e === 409 ? `Room ${room} is full (four players) · if you just left it, try again in a few seconds` : `Room ${room} is gone`, '#ff9a8a'); history.replaceState(null, '', 'index.html'); });
  return true;
}
// each guest frame (main.js, in place of the world's own update): send keys, fetch the newest snapshot, move toward it
function netGuestFrame(game, dt) {
  const N = game.net, w = game.world; if (!w) return;
  netRollKeys(game); netChatKeys(game); netEmoteKeys(game); netSpectateKeys(game, w);   // the quick-chat and emote wheels first (their Esc only closes them), and whom to watch while down (netparty.js, netquest.js)
  if (hit('Escape') || N.lost > 2500) { if (!N.lost) netApi(`leave?who=guest&gid=${N.gid}&room=${N.room}`, {}).catch(() => {}); location.href = 'index.html'; return; }   // (leaving frees the room for you to rejoin; the host keeps it)
  if (N.lost) { N.lost += dt; return; }
  if (N.wObj && (game.world !== N.wObj || game.scene !== 'world')) { game.world = N.wObj; game.scene = 'world'; game.outside = null; game.toast('Only the host decides where you go · Esc leaves the room', '#ffb07a'); return; }   // (a door, a raid or a ferry tried to take you somewhere on your own)
  if (netGuestTalk(game, w)) { N.sentAt = performance.now(); netApi(N.IN, { mx: 0, my: 0, ack: N.ack }).catch(() => {}); return; }   // (talking or shopping: your hero stands still meanwhile)
  if (hit('Tab', 'KeyI') || hit('KeyX')) { const inv = hit('Tab', 'KeyI'); N.sentAt = performance.now(); netApi(N.IN, { mx: 0, my: 0, ack: N.ack }).catch(() => {}); game.openMenu(inv ? inventoryMenu(game) : logMenu()); return; }   // (your own inventory and log; Player 2 stands still meanwhile)
  if (hit('KeyU') && w.overworld && !w.interior && !w.cave && !w.rift) { N.sentAt = performance.now(); netApi(N.IN, { mx: 0, my: 0, ack: N.ack }).catch(() => {}); game.openMenu(towerMenu()); return; }   // the Abyss Tower: your choice goes to the host as a request (netplay.js)
  if (hit('KeyT') && netTradeKey(game, w)) return;   // trade with the player beside you (nettrade.js)
  const pad = readPad(SOLO), H = N.held; for (const k of ['atk', 'dash', 'layer', 'fsel']) if (pad[k]) H[k] = true; if (hit(VEH.key)) H.veh = true; pad.spell.forEach((s, j) => { if (s) (H.spell = H.spell || [false, false, false])[j] = true; });
  N.sendT -= dt; N.pollT -= dt;
  if (N.sendT <= 0) { N.sendT = NET.inSend; N.sentAt = performance.now(); netApi(N.IN, { mx: pad.mx, my: pad.my, block: pad.block, atk: !!H.atk, dash: !!H.dash, layer: !!H.layer, fsel: !!H.fsel, veh: !!H.veh, rv: isDown('Enter'), spell: H.spell || [false, false, false], ack: N.ack, prof: N.profDirty ? netMine(game) : undefined }).catch(() => {}); N.held = {}; N.profDirty = false; }
  netGuestPoll(game, 0);
  if (N.snap) netApply(game, w, N.snap, dt);
  netGuestTitles(game, dt);   // titles, the party ones too, on your own save (netsocial.js)
  for (const a of w.actors) a.t = (a.t || 0) + dt;
  netAgeVis(w, dt);
  w.floats = (w.floats || []).filter(f => (f.t += dt) < 900); for (const f of w.floats) { f.y -= dt * 0.03; f.x += (f.vx || 0) * dt / 1000; }
}
// fetch the newest snapshot (each guest frame, and the trade window while it is open); the trades in it are kept at once
// (only answers that bring nothing new count as the host going quiet: a guest tab that sat in the background isn't the host's fault)
function netGuestPoll(game, dt) {
  const N = game.net; N.pollT -= dt; if (N.pollT > 0 || N.busy) return;
  N.pollT = NET.poll; N.busy = true;
  netApi('snap?room=' + N.room).then(s => { if (s && (!N.snap || s.at !== N.snap.at)) { N.snap = s; N.trades = s.trades || []; N.duel = s.duel || null; N.pqShown = s.pq || []; N.heard = performance.now(); N.slow = false; netTradeOffered(game); netDuelHeard(game, s); netChatFromSnap(game, s); } else if (!N.slow && performance.now() - N.heard > NET.stale) { N.slow = true; game.toast('The host is not responding…', '#ffb07a'); } }).catch(e => { if (e === 404 && !N.lost) { N.lost = 1; game.toast('The host closed the room · back to the title', '#ff9a8a'); } }).finally(() => { N.busy = false; });
}
// a guest hears the duel news, and a challenge addressed to them opens its Y / N box
function netDuelHeard(game, s) {
  const N = game.net, n = s.duelNews; if (N.duelNewsSeen === undefined) N.duelNewsSeen = n ? n.id : 0;   // (news from before you joined stays unsaid)
  else if (n && n.id !== N.duelNewsSeen) { N.duelNewsSeen = n.id; game.toast(n.str, '#ffd27a'); }
  const A = s.duelAsk; if (A && A.to === N.gid && A.id !== N.duelAskSeen && !game.menu) { N.duelAskSeen = A.id; N.sentAt = performance.now(); netApi(N.IN, { mx: 0, my: 0, ack: N.ack }).catch(() => {}); game.openMenu(netDuelAskMenu(A.from, A.id)); }
}
// a friend opened a trade with you: the window opens (unless you are busy in another menu; it waits for you to close it)
function netTradeOffered(game) {
  const T = ntMine(game); if (!T || game.menu || T.id === game.net.tradeClosed) return;
  const N = game.net; N.sentAt = performance.now(); netApi(N.IN, { mx: 0, my: 0, ack: N.ack }).catch(() => {});   // (your hero stands still while you trade)
  game.openMenu(netTradeMenu(T.id));
}
// ENTER beside someone in the host's world: the same talk as playing alone (shops, quests, the notice boards, favours, wanderers'
// errands), all on the guest's own save. In town and indoors J, F and Space talk too, as they do alone.
function netGuestTalk(game, w) {
  const p = w.player, N = game.net; if (!p || p.dead || game.menu || (N.duel && (N.duel.a === N.gid || N.duel.b === N.gid)) || netNearDowned(game, w)) return false;   // (in a duel your keys fight; beside a fallen friend Enter revives)
  const safe = w.interior ? !w.dojoRoom : !w.cave && !w.rift && inTown(p.x);
  if (!(hit('Enter') || (safe && hit('KeyJ', 'KeyF', 'Space')))) return false;
  try {
    if (safe) return netFarmTalk(game, w) || netHomeInvite(game, w) || townInteract(game, w) || netFarmAnimal(game, w);   // (the host's farm and home: netfarm.js)
    return storyNpcInteract(game, w) || wandererInteract(game, w);
  } catch (e) { console.warn('co-op talk', e); return false; }
}
// drawn on the guest's screen (main.js): the host's health on the right, as local co-op shows Player 2, and your own countdown when you fall
function netGuestHud(game, w, now) {
  const h = w.actors.find(a => a.netWho === 'h'), me = w.player;
  if (h) drawHUD(h, 1, now, `Host · ${className(h.cls)}`);
  netMiniBars(w.actors.filter(a => a.kind === 'player' && a !== me && a.netWho && a.netWho !== 'h').map(a => ({ a, name: a.label || netName((game.net.peers || {})[a.netWho]), col: a.marker || '#8fd8ff' })));   // the other friends, small
  if (me && (me.dead || me.hp <= 0)) text(`You are down · back in ${Math.max(0, Math.ceil((COOP.revive - (me.coopDown || 0)) / 1000))}s`, VW / 2, 120, '#ff9a8a', 9);
}
// the host is now in another world: build the same ground here (no monsters or loot of its own: those arrive in the snapshots)
function netGuestWorld(game, T) {
  const N = game.net, old = game.world, R = T.r || { f: 'ow' }; let w;
  if (R.f === 'ow' && old && old.overworld) { N.wid = T.id; N.wObj = old; return old; }   // (already out of doors: nothing to build)
  if (old && old.overworld) N.ow = old;   // (kept for the way back out)
  try {
    if (R.f === 'map') w = mapWorld(R.k, R.b || undefined);
    else if (R.f === 'void') w = makeVoidWorld();
    else w = N.ow || makeOverworld(game, { x: ALTAR.x, y: ALTAR.y + 40 });
  } catch (e) { console.warn('co-op world', e); return null; }
  for (const col of T.tints || []) if (w.bg) w.bg = tintCanvas(w.bg, col);
  Object.assign(w, { name: T.name, cave: T.cave, zone: T.zone, interior: T.interior, peaceful: T.peaceful, home: T.home, hall: T.hall, portals: [], onKill: () => {}, onPlayerDown: () => {} }); if (T.zoom) w.zoom = T.zoom;
  if (R.f === 'map' && MAPS[R.k] && MAPS[R.k].entry) w.entry = { x: MAPS[R.k].entry[0], y: MAPS[R.k].entry[1] };   // (indoors: the Exit mark)
  w.netHomeOf = T.ho; if (T.home && R.f === 'map') { if (netHomeOwner(game, T.ho)) netHostHome(game, w, R.k, netHomeOwner(game, T.ho)); else w.netHomeKey = R.k; }   // (no host profile yet: furnished when it comes)
  w.actors = []; w.drops = []; w.player = old && old.player;   // (the old hero stands in until the snapshot brings yours)
  N.wid = T.id; N.acts = {}; N.seen = false; N.awayClear = false;
  game.world = w; N.wObj = w; game.toast(T.r && T.r.f !== 'ow' ? `Following the host into ${T.name}…` : 'Back outside with the host', '#8fd8ff');
  return w;
}
// the host's home (or Relic Hall, or one of its rooms): the furniture, pedestals and decor come from the HOST's save, so they are
// laid out, and drawn, with the host's profile in place of the guest's own for that moment
function netHostHome(game, w, key, owner) {
  const N = game.net, withHost = fn => { const mine = game.profile; game.profile = owner || N.host || mine; try { return fn(); } finally { game.profile = mine; } };
  try { withHost(() => { placeHomeFeatures(w, MAPS[key]); if (!w.hall) placeDecor(w); }); } catch (e) { console.warn('co-op home', e); }
  for (const o of w.objects) if (typeof o.draw === 'function' && !o.netHost) { const d = o.draw; o.draw = (...args) => withHost(() => d(...args)); o.netHost = true; }
}
// between snapshots the guest ages the effects itself, so they play smoothly and vanish on time
function netAgeVis(w, dt) {
  for (const k in NET_VIS) {
    const L = w[k], life = NET_VIS[k]; if (!L || !L.length || !life) continue;
    for (const o of L) { o.t = (o.t || 0) + dt; if (k === 'particles') { o.x += (o.vx || 0) * dt / 1000; o.y += (o.vy || 0) * dt / 1000; } }
    w[k] = L.filter(o => o.t < (life === 'dur' ? o.dur : life === 'life' ? o.life : life === 'impact' ? IMPACT_MS : life));
  }
  if (w.flash) { w.flash.t += dt; if (w.flash.t > w.flash.dur) w.flash = null; }
}
// bring the local world in line with a snapshot: make what's new, ease what moved, drop what's gone
function netApply(game, w, S, dt) {   // (w can change: the host went down a black hole or into a rift)
  const N = game.net; if (S.clock != null) game.profile.clock = S.clock; if (S.host) N.host = S.host; if (S.gp) N.peers = S.gp;
  if (S.host || S.gp) { const known = N.known = N.known || new Set(), add = [N.host, ...Object.entries(N.peers || {}).filter(([k]) => k !== N.gid).map(([, v]) => v)].filter(pr => pr && !known.has(netName(pr)));   // (PLAYED WITH: the host and each friend, the first time they are seen)
    if (add.length) { for (const pr of add) { known.add(netName(pr)); netRemember(game, pr); } if (game.profile.coopLast && N.host) { game.profile.coopLast.host = netName(N.host); game.profile.coopLast.at = Date.now(); } game.save(); } }
  if (w.netHomeKey && netHomeOwner(game, w.netHomeOf)) { netHostHome(game, w, w.netHomeKey, netHomeOwner(game, w.netHomeOf)); w.netHomeKey = null; }
  if (!!S.away !== !!N.away) { N.away = !!S.away; game.toast(N.away ? 'The host went somewhere you cannot follow: you will be back with them when they come out' : 'You are back with the host!', '#8fd8ff'); }
  const myRw = S.rw && S.rw[N.gid]; if (myRw && myRw.some(e => e.n > N.ack)) netRewards(game, w, myRw);
  if (S.wt && S.wt.id !== N.wid && !S.away) { w = netGuestWorld(game, S.wt) || w; N.applied = null; }
  if (S.away) { if (!N.awayClear) { N.awayClear = true; for (const k in NET_VIS) w[k] = []; } return; }
  N.awayClear = false;
  if (S !== N.applied) {
    N.applied = S; const keep = new Set();
    for (const s of S.acts) {
      keep.add(s.i); let a = N.acts[s.i];
      if (!a) a = N.acts[s.i] = netMake(game, s, S); if (!a) continue;
      a.tx = s.x; a.ty = s.y; if (s.lv != null) a.lv = s.lv; if (s.mk) a.marker = s.mk;   // (the level on each hero's panel)
      Object.assign(a, { z: s.z, dir: s.d, anim: s.an, t: s.t, loop: s.lp, hp: s.hp, maxHp: s.mh, dead: s.dd, label: s.lb, layerChoice: s.lc || a.layerChoice, gstPct: s.gq, counterT: s.ct, crushWind: s.cw, fgUp: s.fg != null ? 1 : 0, fgSt: s.fg, windup: s.wu ? { t: s.wu[0], small: !!s.wu[1], net: true } : null, /* (a spell wind-up: the boss telegraph or the small ! chip, foewindup.js; drawn only, the host casts) */ status: s.ss ? Object.fromEntries(s.ss.split(',').map(e => { const [k, ms] = e.split(':'), t = ms ? +ms : 9e9; return [k, k === 'burn' || k === 'poison' ? { t, dps: 0 } : t]; })) : {}, /* (the host's statuses, for the chips by the bar: world.js; placeholders, the host runs them) */ rushUntil: s.ru ? performance.now() + s.ru : 0, rush: s.rc || 0, foeRole: s.fr || null, arAim: s.fr === 'archer' && s.fa ? s.fa[0] : 0, arAt: s.fr === 'archer' && s.fa ? { x: s.fa[1], y: s.fa[2] } : null, shCast: s.fr === 'shaman' && s.fa ? s.fa[0] : 0, fcLane: s.fc ? { dx: s.fc[0], dy: s.fc[1], len: s.fc[2], wind: s.fc[3] >= 0, t: s.fc[3] } : null, boss: s.b, scale: s.sc, transcend: s.tc, layerEl: s.le, driving: s.dr, vDir: s.vd, vLook: s.vl, riding: s.rd, state: s.st });
      if (s.mp != null) { a.mp = s.mp; a.maxMp = s.mm || a.maxMp; }
      if (s.nf) Object.assign(a, s.nf);
      a.reviveHold = s.rh || 0;   // (the ring over a fallen friend)
      if (s.kt) { a.kit = s.kt; a.wildKit = s.wk; }   // (a boss's fighting kit: the guest gets its health bar)   // (an NPC's job and lines: the guest can talk to them)
      if (!w.actors.includes(a)) w.actors.push(a);
      a.netWho = s.who; if (s.who === N.gid) { w.player = a; if (S.me && S.me[N.gid]) Object.assign(a, S.me[N.gid]); }
      if (!N.seen && s.who === N.gid) { N.seen = true; a.x = s.x; a.y = s.y; if (!N.greeted) { N.greeted = true; game.toast('You are in the host\'s world! Esc leaves', '#8fd8ff'); } }   // (the welcome once, not after every black hole)
    }
    w.actors = w.actors.filter(a => keep.has(a.netId)); for (const id in N.acts) if (!keep.has(+id)) delete N.acts[id];
    for (const f of S.fl || []) { floatText(w, f.x, f.y, f.s, f.c, f.z); if (typeof netFloatChime === 'function') netFloatChime(game, w, f); }   // (a friend's own Rally or Flawless chimes on their side: rally.js)
    const dp = netDataPaths().byPath, V = S.vis ? JSON.parse(S.vis, (k, v) => !v || typeof v !== 'object' ? v : v.$a !== undefined ? (N.acts[v.$a] || null) : v.$d !== undefined ? (dp[v.$d] || null) : v) : {};
    for (const k in NET_VIS) w[k] = (V[k] || []).filter(o => o);
    w.shake = S.shake || 0; w.flash = S.flash; w.spellName = S.spell; w.rift = S.rift || null;
    if (S.ob) netObjApply(game, w, S.ob);
  }
  for (const a of w.actors) if (a.tx != null) { a.x += (a.tx - a.x) * NET.lerp; a.y += (a.ty - a.y) * NET.lerp; }
  if (!w.player) w.player = w.actors[0] || w.player;
}
// the guest's share of the fight, into their own save (with their own clock, not the host's)
const netMine = game => { const c = JSON.parse(JSON.stringify(game.profile)); c.clock = game.net.myClock; return c; };   // (the guest's own profile, with their own clock)
function netRewards(game, w, list) {
  const N = game.net, pr = game.profile, rp = game.refreshPlayer; game.refreshPlayer = () => {};   // (their hero on screen is the host's copy: nothing to rebuild here)
  try {
    for (const e of list) {
      if (e.n <= N.ack) continue; N.ack = e.n;
      if (e.k === 'gold') pr.gold = (pr.gold || 0) + e.v;
      else if (e.k === 'exp') netGainExp(game, e.v);
      else if (e.k === 'kill') netKill(game, w, e.v);
      else if (e.k === 'trade') netApplyTrade(game, e.v);
      else if (e.k === 'partyChest') netPartyChest(game, e.v);
      else if (e.k === 'partyQuest') netPqPaid(game, e.v);
      else if (e.k === 'dungeon') netDungeonPaid(game, e.v);
      else if (e.k === 'feast') netFeastGot(game, e.v);
      else if (e.k === 'stat') bumpStat(e.v);
      else if (e.k === 'statMax' && e.v && e.v.k) { const st = game.profile.stats = game.profile.stats || {}; st[e.v.k] = Math.max(st[e.v.k] || 0, e.v.n || 0); }   // (a record that keeps the highest, like the best combo: combopay.js)   // (a party stat: netsocial.js)
      else if (e.k === 'caveBoss') { netGainExp(game, killExp(e.v.rank) * (10 + e.v.rank)); bumpStat('holeBosses'); questEvent(game, 'cave'); }
      else if (e.k === 'drop') {
        if (e.v.kind === 'coin') { pr.coins = (pr.coins || 0) + 1; game.toast('A Summon Coin! (+1)', '#ffd23f'); }
        else { const d = JSON.parse(JSON.stringify(e.v)); if (d.item && d.item.uid) d.item.uid = uid(); game.pickup(d); N.profDirty = true; }   // (a fresh id from the guest's own counter: the host's could match a card they already have)
      }
    }
  } catch (err) { console.warn('co-op reward', err); }
  game.refreshPlayer = rp;
  saveGame(netMine(game));   // (game.save is off for a guest; this writes only their own profile)
}
// EXP on the guest's own profile (their hero on screen is the host's copy: the new level reaches it through netGuestProfile)
function netGainExp(game, n) {
  const N = game.net, pr = game.profile; if (pr.lv >= MAX_LV) return;
  pr.exp = (pr.exp || 0) + n; let ups = 0;
  while (pr.lv < MAX_LV && pr.exp >= expNeed(pr.lv)) { pr.exp -= expNeed(pr.lv); pr.lv++; ups++; }
  if (ups) { N.profDirty = true; logAdd(game, `LEVEL UP! You reached Lv ${pr.lv}`, '#ffd23f'); game.levelFx = { t: 0, lv: pr.lv, ups, gains: { hp: LV_GROWTH.hp * ups, mp: LV_GROWTH.mp * ups, atk: Math.round(LV_GROWTH.atk * ups), pts: POINTS_PER_LV * ups } }; }
}
// a kill in the host's world, counted on the guest's side as if they had played it alone: the EXP (a mini boss's bonus too), the
// kill count, and their own quests, daily contracts, season, side quests, story chapter and the zone guardians of their journey
function netKill(game, w, K) {
  const pr = game.profile, m = { sp: K.sp, tier: K.tier, x: K.x, y: K.y, miniBoss: K.mini, guardian: K.guardian, ally: false };
  netGainExp(game, killExp(K.tier) * (K.mini ? 5 : 1));
  pr.stats = pr.stats || {}; pr.stats.kills = (pr.stats.kills || 0) + 1; bumpStat('coopKills'); if (K.mini) bumpStat('miniBosses');
  questEvent(game, 'kill', { sp: K.sp, tier: K.tier, zone: K.zone, mini: !!K.mini });
  if (K.elite) { if (typeof dailyEvent === 'function') dailyEvent(game, 'bounty'); bumpStat('eliteKills'); }   // (an elite down: the daily bounty, foeelite.js)
  storyKill(game, w, m);
  if (K.guardian != null) journeyKill(game, w, m);
}
function netMake(game, s, S) {
  let a = null;
  try {
    if (s.k === 'player') { const N = game.net, pr = s.who === N.gid ? game.profile : s.who === 'h' ? N.host : (N.peers || {})[s.who]; if (!pr) return null; a = makePlayerActor(pr, 0, s.x, s.y); }   // (the host's and the other friends' heroes wait for their profiles, sent every 2 s)
    else if (s.k === 'npc') { if (!D.npcs[s.npc]) return null; a = baseActor('npc', 2, s.x, s.y); a.npc = s.npc; }
    else if (s.pet) { if (!D.npcs['100']) return null; a = baseActor('monster', 0, s.x, s.y); Object.assign(a, { sp: s.sp, pet: { lv: 1 }, petKind: 'pet', tier: s.tr || 0, h: D.npcs['100'].h || 19, scale: s.sc || 1.15, pal: 0, plist: [], passives: {}, ally: true }); }   // (a hound, wolf or drake: an NPC sprite, as pet.js builds it)
    else if (s.pid) { a = baseActor('monster', 0, s.x, s.y); Object.assign(a, { bank: partnerBank(s.pid, s.ppt), heroPartner: true, ally: true, h: 26, label: 'Partner' }); }
    else { if (!SPECIES[s.sp] || (!D.monsters[s.sp] && !s.pet && !s.nb)) return null; a = makeMonster(s.sp, s.tr || 0, s.x, s.y); if (s.pet) a.pet = { lv: 1 }; if (s.nb) a.npcBody = true; a.ally = s.al; }
  } catch (e) { return null; }
  a.netId = s.i; a.x = s.x; a.y = s.y; return a;
}
