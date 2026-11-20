'use strict';
// FRIENDS START RUNS, FISHING AND COOKING TOGETHER, AND LOOT ROLLS in online co-op (net.js).
//   RUNS        a friend can open the Abyss Tower (U) or the Raid Herald's list themselves. Choosing one asks the host ("Lady
//               Mirabel wants to climb the Abyss Tower from Floor 6. Go in together?"); on Y the whole party goes in.
//   FISHING     anyone fishing while a friend fishes too gets a party bonus on each catch: a quarter more gold per friend and an
//               extra fish. A small "Fishing" plate shows over everyone at it.
//   FEAST       whoever roasts something at a campfire shares it: every other player by that fire gets the same snack buff in
//               their own save. Friends use the town campfires and pantries like their own (netfarm.js opens them).
//   LOOT ROLLS  a rare card or piece of gear (rank A and up) that falls with friends near goes up for a roll instead of to whoever
//               is closest: K NEED, ; PASS (L is block), ten seconds. The highest roll among NEED wins; if everyone passes, the nearest keeps it.
const NPLAY = { askMs: 20000, fishGold: 0.25, feastR: 90, rollTier: 5, rollR: 260, rollMs: 10000 };
const npName = (game, pid) => { const N = game.net; if (N.role === 'host') return pid === 'h' ? netName(game.profile) : netName((N.guests[pid] || {}).prof); return pid === N.gid ? netName(game.profile) : pid === 'h' ? netName(N.host) : netName((N.peers || {})[pid]); };
const npMe = game => game.net.role === 'host' ? 'h' : game.net.gid;
// a message to the host (straight in when you are the host)
function netPlaySend(game, m) { const N = game.net; if (N.role === 'host') netPlayMsg(game, 'h', m); else { N.sentAt = performance.now(); netApi(N.IN, { cx: m }).catch(() => {}); } }
function netPlayMsg(game, from, m) {   // (net.js in-poll: a guest's i.cx)
  const N = game.net; if (!m || !m.t) return;
  if (m.t === 'run') netRunAsked(game, from, m);
  else if (m.t === 'fish') { N.fishers = N.fishers || {}; if (m.on) N.fishers[from] = true; else delete N.fishers[from]; }
  else if (m.t === 'feast') netFeast(game, from, m.id);
  else if (m.t === 'rv') { const R = N.roll; if (R && R.id === m.id && R.who.includes(from)) R.votes[from] = !!m.need; }
}
// each host world frame (net.js netHostTick)
function netPlayTick(game, w, dt) {
  const N = game.net, now = performance.now();
  if (N.runAsk && now - N.runAsk.at > NPLAY.askMs) { netDuelNews(game, `${npName(game, N.runAsk.from)}'s run request ran out`); N.runAsk = null; }
  if (N.runAsk && !N.runAsk.open && !game.menu) { N.runAsk.open = true; game.openMenu({ type: 'nrunask', t: 0 }); }
  if (N.fishers) for (const k of Object.keys(N.fishers)) if (k === 'h' ? !(game.menu && game.menu.type === 'tlfish') : !N.guests[k]) delete N.fishers[k];   // (the host's world runs only when no window is up: not fishing)
  netRollTick(game, w);
  netFriendTitles(game, dt);   // (netsocial.js)
}

// ---- RUNS: a friend's choice in the tower or raid list goes to the host as a request
const netRunName = m => m.k === 'home' ? `a visit to ${m.who || 'a friend'}'s home` : m.k === 'tower' ? `the Abyss Tower from Floor ${m.f}` : `the raid on ${(raidOf(m.id) || { name: 'a raid boss' }).name}`;
{
  const et = enterTower, er = enterRaid, guest = game => game.net && game.net.role === 'guest';
  enterTower = (game, f) => { if (!guest(game)) return et(game, f); netPlaySend(game, { t: 'run', k: 'tower', f }); game.toast(`Asked the host to start ${netRunName({ k: 'tower', f })}`, '#8fd8ff'); };
  enterRaid = (game, R) => { if (!guest(game)) return er(game, R); netPlaySend(game, { t: 'run', k: 'raid', id: R.id }); game.toast(`Asked the host to start ${netRunName({ k: 'raid', id: R.id })}`, '#8fd8ff'); };
}
function netRunAsked(game, from, m) {
  const N = game.net, w = game.world;
  if (!w || !w.overworld || w.interior || w.cave || w.rift || N.runAsk) { netDuelNews(game, `${npName(game, from)} wants to start ${netRunName(m)}, but the host can't go right now`); return; }
  N.runAsk = { from, k: m.k, f: m.f, id: m.id, who: npName(game, from), at: performance.now() };
  netDuelNews(game, m.k === 'home' ? `${npName(game, from)} invites the party into their home` : `${npName(game, from)} wants to start ${netRunName(m)}`);
}
function updateNetRunAsk(game, m, dt) {
  const N = game.net, A = N && N.runAsk; m.t += dt; if (!A) { game.closeMenu(); return; }
  if (hit('KeyY', 'Enter')) {
    game.closeMenu(); N.runAsk = null; netDuelNews(game, `The party goes into ${netRunName(A)}!`);
    if (A.k === 'home') netEnterFriendHome(game, A.from);   // (netsocial.js)
    else if (A.k === 'tower') enterTower(game, Math.max(1, A.f | 0)); else { const R = raidOf(A.id); if (R) enterRaid(game, R); }
  } else if (hit('KeyN', 'Escape')) { game.closeMenu(); N.runAsk = null; netDuelNews(game, `The host turned down ${netRunName(A)} for now`); }
}
function drawNetRunAsk(game, m, now) {
  const A = game.net && game.net.runAsk; if (!A) return;
  ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(40,26,17,0.94)'; rrect(ctx, VW / 2 - 170, 130, 340, 74, 8); ctx.fill(); ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 1.2; rrect(ctx, VW / 2 - 169.5, 130.5, 339, 73, 8); ctx.stroke();
  text(A.k === 'home' ? `${npName(game, A.from)} invites you to` : `${npName(game, A.from)} wants to start`, VW / 2, 148, '#e8e2cf', 9);
  text(netRunName(A), VW / 2, 163, '#ffe9a8', 10);
  text(`Y: go in together · N: not now   (${Math.max(0, Math.ceil((NPLAY.askMs - (performance.now() - A.at)) / 1000))}s)`, VW / 2, 186, '#8fd8ff', 8);
}

// ---- FISHING TOGETHER
const netFishMates = game => { const N = game.net; if (!N) return 0; const list = N.role === 'host' ? Object.keys(N.fishers || {}) : (N.snap && N.snap.fsh) || []; return list.filter(k => k !== npMe(game)).length; };
{
  const uf = updateFish, cf = catchFish;
  updateFish = (game, m, dt) => {
    const N = game.net; if (N && !m.netOn) { m.netOn = true; netPlaySend(game, { t: 'fish', on: 1 }); }
    if (N && N.role === 'guest') netGuestPoll(game, dt);   // (a guest's snapshots keep coming while the fishing window is up: who else is at it)
    uf(game, m, dt);
    if (N && game.menu !== m) netPlaySend(game, { t: 'fish', on: 0 });
  };
  catchFish = (game, m) => {
    cf(game, m); const n = netFishMates(game); if (!n || !m.fish) return;
    const pr = game.profile, more = Math.round(m.gold * NPLAY.fishGold * n); pr.gold = (pr.gold || 0) + more; m.gold += more; addItem(pr, 'fish', 1); game.save();
    game.toast(`Fishing together (${n + 1} at it): +${more} G and an extra fish`, '#9fd8ff');
  };
}
function drawNetFishers(game, w, cam) {
  const N = game.net; if (!N || !cam) return;
  const list = N.role === 'host' ? Object.keys(N.fishers || {}) : (N.snap && N.snap.fsh) || [];
  for (const pid of list) {
    if (pid === npMe(game)) continue; const a = netChatActor(game, w, pid); if (!a) continue;
    const x = Math.round((a.x - cam.x) * ZOOM), y = Math.round((a.y - (a.h || 26) * (a.scale || 1) - (a.z || 0) - cam.y) * ZOOM) - 12;
    ctx.fillStyle = 'rgba(30,20,13,0.85)'; rrect(ctx, x - 22, y - 6, 44, 12, 4); ctx.fill(); text('Fishing', x, y, '#9fd8ff', 6.5);
  }
}

// ---- THE CAMPFIRE FEAST: what one roasts, everyone by the fire tastes
{
  const uc = updateCampfire;
  updateCampfire = (game, m) => {
    const R = CAMPFIRE_RECIPES[m.cur], had = R ? itemCount(game.profile, R.out) : 0; uc(game, m);
    if (game.net && R && itemCount(game.profile, R.out) > had) netPlaySend(game, { t: 'feast', id: R.out });
  };
}
function netFeast(game, from, id) {
  const N = game.net, w = game.world, F = MEAL_FX[id]; if (!w || !F) return;
  const cook = from === 'h' ? w.player : netGuestActor(w, from); if (!cook) return;
  const fire = campSpots().map(S => S.fire).find(f => Math.hypot(cook.x - f.x, cook.y - f.y) < 40); if (!fire) return;
  const near = a => a && Math.hypot(a.x - fire.x, a.y - fire.y) < NPLAY.feastR, who = npName(game, from), v = { id, from: who };
  let n = 0;
  if (from !== 'h' && near(w.player)) { netFeastGot(game, v); n++; }
  for (const G of netGuestList(game)) if (G.gid !== from && near(netGuestActor(w, G.gid))) { G.rwSeq++; G.rw.push({ n: G.rwSeq, k: 'feast', v }); n++; }
  if (n) { netStatTo(game, from, 'feasts'); w.rings.push({ x: fire.x, y: fire.y, r: NPLAY.feastR * 0.6, t: 0, col: '#ffb060' }); netDuelNews(game, `${who} shared ${ITEMS[id].name} round the campfire: ${F.name} for ${n} friend${n > 1 ? 's' : ''}`); }
}
function netFeastGot(game, v) {   // (the host's own, or a guest's numbered reward 'feast')
  const pr = game.profile, F = MEAL_FX[v.id]; if (!F) return;
  pr[F.slot] = { id: v.id, ms: F.dur };
  if (game.net.role === 'guest') game.net.profDirty = true; else game.refreshPlayer();
  game.toast(`${v.from} shared ${ITEMS[v.id].name}: ${F.name} for ${Math.round(F.dur / 60000)} min (${mealText(F)})`, '#ffb060'); game.save();
}

// ---- LOOT ROLLS
{
  const cd = collectDrops;
  collectDrops = (game, w, dt) => { netRollScan(game, w); cd(game, w, dt); };
}
const netRollItemName = d => { try { return d.kind === 'card' ? cardName(d.item) : d.item.name || 'gear'; } catch (e) { return d.kind; } };
// the host's game: a rare drop with friends near is lifted out for a roll
function netRollScan(game, w) {
  const N = game.net; if (!N || N.role !== 'host' || !Object.keys(N.guests).length || !w.drops.length) return;
  for (const d of w.drops) {
    if (d.noRoll || d.taken || (d.kind !== 'card' && d.kind !== 'gear') || !d.item || (d.item.tier | 0) < NPLAY.rollTier) continue;
    const heroes = [['h', w.player], ...netGuestList(game).map(G => [G.gid, netGuestActor(w, G.gid)])].filter(([, a]) => a && Math.hypot(a.x - d.x, a.y - d.y) < NPLAY.rollR);
    if (heroes.length < 2) { d.noRoll = true; continue; }
    heroes.sort((p, q) => Math.hypot(p[1].x - d.x, p[1].y - d.y) - Math.hypot(q[1].x - d.x, q[1].y - d.y));
    d.taken = true; (N.rollQ = N.rollQ || []).push({ kind: d.kind, item: d.item, who: heroes.map(h => h[0]), nearest: heroes[0][0] });
    w.rings.push({ x: d.x, y: d.y, r: 26, t: 0, col: '#ffd23f' }, { x: d.x, y: d.y, r: 14, t: -100, col: '#ffffff' });
  }
  w.drops = w.drops.filter(d => !d.taken);
}
function netRollTick(game, w) {
  const N = game.net, now = performance.now();
  if (!N.roll && N.rollQ && N.rollQ.length) { const q = N.rollQ.shift(); N.roll = Object.assign(q, { id: (N.rollSeq = (N.rollSeq || 0) + 1), at: now, votes: {}, name: netRollItemName(q), rank: RANKS[q.item.tier | 0] }); }
  const R = N.roll; if (!R) return;
  const live = R.who.filter(k => k === 'h' || N.guests[k]);
  if (now - R.at < NPLAY.rollMs && !live.every(k => k in R.votes)) return;
  N.roll = null;
  const need = live.filter(k => R.votes[k]), rolls = need.map(k => [k, 1 + Math.floor(Math.random() * 100)]).sort((p, q) => q[1] - p[1]);
  const win = rolls.length ? rolls[0][0] : live.includes(R.nearest) ? R.nearest : 'h';
  netStatTo(game, win, 'lootWon'); if (win === 'h') game.pickup({ kind: R.kind, item: R.item }); else netShare(game, 'drop', { kind: R.kind, item: R.item }, win);
  const how = rolls.length ? `rolled ${rolls[0][1]}${rolls.length > 1 ? ' (' + rolls.slice(1).map(([k, n]) => `${npName(game, k)} ${n}`).join(', ') + ')' : ''}` : 'everyone passed';
  netDuelNews(game, `Loot roll · Rank ${R.rank} ${R.name}: ${npName(game, win)} wins, ${how}`);
}
// K NEED, ; PASS while a roll you are in is up (main.js for the host, net.js for a guest: before anything else reads the keys)
function netRollKeys(game) {
  const N = game.net; if (!N || game.menu) return;
  const R = N.role === 'host' ? N.roll : N.snap && N.snap.roll, me = npMe(game); if (!R || !R.who.includes(me)) return;
  N.rollVoted = N.rollVoted || {}; if (N.rollVoted[R.id] !== undefined || (N.role === 'host' && me in R.votes)) return;
  const need = hit('KeyK'), pass = !need && hit('Semicolon'); if (!need && !pass) return;
  pressed.delete('KeyK'); pressed.delete('Semicolon'); N.rollVoted[R.id] = need;
  netPlaySend(game, { t: 'rv', id: R.id, need });
}
function drawNetRoll(game) {
  const N = game.net; if (!N) return;
  const R = N.role === 'host' ? N.roll : N.snap && N.snap.roll; if (!R) return;
  const me = npMe(game), left = Math.max(0, Math.ceil(((N.role === 'host' ? NPLAY.rollMs - (performance.now() - R.at) : R.left - (performance.now() - (N.heard || 0)))) / 1000));
  const mine = N.rollVoted && N.rollVoted[R.id], inIt = R.who.includes(me), x = VW / 2 - 120, y = 70;   // (under the area banner and clock)
  ctx.fillStyle = 'rgba(24,16,6,0.9)'; rrect(ctx, x, y, 240, 38, 6); ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, 239, 37, 6); ctx.stroke();
  text(`LOOT ROLL · Rank ${R.rank} ${R.kind === 'card' ? 'card' : 'gear'}`, VW / 2, y + 9, '#ffd23f', 7);
  text(R.name.length > 34 ? R.name.slice(0, 33) + '…' : R.name, VW / 2, y + 20, '#ffffff', 7.5);
  text(!inIt ? `Your friends are rolling for it · ${left}s` : mine === undefined ? `K: NEED · ;: PASS   (${left}s)` : `You chose ${mine ? 'NEED' : 'PASS'} · waiting (${left}s)`, VW / 2, y + 31, inIt && mine === undefined ? '#ffe9a8' : '#c9b89a', 7);
}
// what the guests are told (net.js snapshot)
{
  const ns = netSnapshot;
  netSnapshot = (game, w) => {
    const S = ns(game, w), N = game.net, R = N.roll;
    S.fsh = Object.keys(N.fishers || {});
    S.roll = R ? { id: R.id, kind: R.kind, name: R.name, rank: R.rank, who: R.who, left: NPLAY.rollMs - (performance.now() - R.at) } : null;
    return S;
  };
}
