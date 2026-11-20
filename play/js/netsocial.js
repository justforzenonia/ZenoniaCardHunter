'use strict';
// PARTY TITLES AND STATS, AND FRIENDS' HOMES in online co-op (net.js).
//   PARTY STATS   each save counts what it did with friends (pr.stats, bumpStat): kills with friends there, party bosses and
//                 quests, runs finished together, loot rolls won, friends revived, campfire feasts shared and how many different
//                 friends it has played with. The ONLINE CO-OP screen shows them as your PARTY RECORD.
//   PARTY TITLES  nine titles (titles.js) are earned from them, worn like any other; a guest earns theirs too. The friends list
//                 shows the title each friend wore when you last played.
//   FRIENDS' HOMES a friend who stands at their home's door in Hearthvale and presses Enter invites the party in. On the host's
//                 Y, the host's game builds that home from the FRIEND's save (layout, tint, furniture, decor) and everyone goes in.
//                 Each player's Enter on the chest or the stove opens their own storage or kitchen; the rest is the owner's.
const NSOCIAL_TITLES = [
  ['partyanimal', 'Party Animal',  0, 'Play with 3 different friends online',   'friendsMet', 3,    ['swift']],
  ['feastmaker',  'Feast Maker',   1, 'Share 15 campfire feasts with friends',  'feasts', 15,       ['regen', 'mana']],
  ['squad',       'Squad Up',      1, 'Beat 5 party bosses',                    'partyBosses', 5,   ['brutal', 'hide']],
  ['contract',    'Contract Crew', 1, 'Finish 10 party quests',                 'partyQuests', 10,  ['crit', 'barrier']],
  ['lifeline',    'Lifeline',      2, 'Revive fallen friends 25 times',         'revives', 25,      ['regen', 'hide', 'barrier']],
  ['raidparty',   'Raid Party',    2, 'Finish 20 runs with friends',            'coopRuns', 20,     ['brutal', 'evade', 'mana']],
  ['luckyhand',   'Lucky Hand',    2, 'Win 10 loot rolls',                      'lootWon', 10,      ['crit', 'vamp', 'evade']],
  ['warband',     'Warband',       3, 'Defeat 2,000 monsters with friends',     'coopKills', 2000,  ['brutal', 'crit', 'frenzy', 'unstop']],
  ['guildleader', 'Guild Leader',  4, 'Beat 50 party bosses',                   'partyBosses', 50,  ['brutal', 'crit', 'hide', 'vamp', 'barrier']],
];
for (const [id, name, tier, how, k, need, pas] of NSOCIAL_TITLES) {
  const t = { id, name, tier, how, prog: pr => [titleStat(pr, k), need], party: true };
  TITLE_LIST.push(t); TITLE_BY[id] = t; TITLE_PASSIVES[id] = pas;
}
const NSOCIAL_RECORD = [['Kills with friends', 'coopKills'], ['Party bosses', 'partyBosses'], ['Party quests', 'partyQuests'], ['Runs together', 'coopRuns'], ['Loot rolls won', 'lootWon'], ['Friends revived', 'revives'], ['Feasts shared', 'feasts'], ['Friends met', 'friendsMet']];
// a party stat for one player: the host's own at once, a guest's as a numbered reward ('stat')
function netStatTo(game, pid, k) {
  const N = game.net; if (!N || N.role !== 'host') return;
  if (pid === 'h') { bumpStat(k); return; }
  const G = N.guests[pid]; if (G) { G.rwSeq++; G.rw.push({ n: G.rwSeq, k: 'stat', v: k }); }
}
// a guest's titles: earned on their own save; a new one goes out with their profile so everyone sees it worn
function netGuestTitles(game, dt) {
  const pr = game.profile, n = Object.keys(pr.titles || {}).length, worn = pr.title;
  titlesTick(game, dt);
  if (Object.keys(pr.titles || {}).length !== n || pr.title !== worn) game.net.profDirty = true;
  netFriendTitles(game, dt);
}
// every few seconds: the title each friend here wears now, onto your friends list
function netFriendTitles(game, dt) {
  const N = game.net, pr = game.profile; if ((N.ftT = (N.ftT || 0) - dt) > 0 || !pr || !pr.coopFriends) return; N.ftT = 5000;
  const profs = N.role === 'host' ? Object.values(N.guests).map(G => G.prof) : [N.host, ...Object.entries(N.peers || {}).filter(([k]) => k !== N.gid).map(([, v]) => v)];
  for (const prof of profs) { if (!prof) continue; const f = pr.coopFriends.find(q => q.name === netName(prof)), t = TITLE_BY[prof.title]; if (f) { f.title = t && prof.titles && prof.titles[t.id] ? t.name : ''; f.lv = prof.lv || f.lv; } }
}
// the friends list keeps how many different friends you have met, and the title each one wore
{
  const nr = netRemember;
  netRemember = (game, prof) => {
    const pr = game.profile, name = netName(prof); if (!pr || !prof || name === netName(pr)) return;
    const met = pr.coopMet = pr.coopMet || []; if (!met.includes(name)) { met.push(name); if (met.length > 200) met.shift(); bumpStat('friendsMet'); }
    nr(game, prof);
    const f = (pr.coopFriends || []).find(q => q.name === name), t = TITLE_BY[prof.title]; if (f) f.title = t && prof.titles && prof.titles[t.id] ? t.name : '';
  };
}
// a friend helped someone back up (netparty.js revive): each helper's count
{
  const rt = netReviveTick;
  netReviveTick = (game, w, a, dt) => {
    const p = w.player, near = h => h && !h.dead && Math.hypot(h.x - a.x, h.y - a.y) < NPARTY.reviveR;
    const helpers = [...(p && isDown('Enter') && near(p) ? ['h'] : []), ...Object.values(game.net.guests).filter(G => G.gid !== a.netGid && G.inp && G.inp.rv && near(netGuestActor(w, G.gid))).map(G => G.gid)];
    const up = rt(game, w, a, dt); if (up) for (const pid of helpers) netStatTo(game, pid, 'revives');
    return up;
  };
}
// the PARTY RECORD on the ONLINE CO-OP screen (net.js drawNetMenu)
function drawNetRecord(game) {
  const pr = game.profile; if (!pr) return; const x = 24;
  text('PARTY RECORD', x + 70, 116, '#ffd27a', 8);
  NSOCIAL_RECORD.forEach(([label, k], i) => { const y = 132 + i * 13; text(label, x, y, '#c9c1a8', 7, 'left'); text(String(titleStat(pr, k)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), x + 140, y, '#ffffff', 7, 'right'); });
  const got = NSOCIAL_TITLES.filter(t => pr.titles && pr.titles[t[0]]).length;
  text(`Party titles ${got}/${NSOCIAL_TITLES.length} · Y shows them`, x + 70, 132 + NSOCIAL_RECORD.length * 13 + 6, '#c88aff', 6.5);
}

// ---- FRIENDS' HOMES
const netHomeOwner = (game, ho) => { const N = game.net; return !ho ? N.host : ho === N.gid ? game.profile : (N.peers || {})[ho]; };
// a guest's Enter at their home's door in Hearthvale (net.js netGuestTalk, through netFarmTalk's town check)
function netHomeInvite(game, w) {
  const p = w.player, N = game.net; if (!w.overworld || w.interior || Math.hypot(p.x - (HOME_DOOR.x + TOWN_OX), p.y - (HOME_DOOR.y + TOWN_OY + 10)) > 26) return false;
  netPlaySend(game, { t: 'run', k: 'home' }); game.toast('You invited the party into your home: waiting for the host', '#8fd8ff'); return true;
}
// the host said yes: the friend's home, built from their save, and everyone in
function netEnterFriendHome(game, gid) {
  const N = game.net, G = N.guests[gid]; if (!G) return;
  const mine = game.profile, toast = game.toast; game.profile = G.prof; game.toast = () => {};
  try { enterHome(game, null); } catch (e) { console.warn('friend home', e); } finally { game.profile = mine; game.toast = toast; }
  const w = game.world; if (!w.home) return;
  w.netHomeOf = gid;
  for (const o of w.objects) if (typeof o.draw === 'function' && !o.netHost) { const d = o.draw; o.draw = (...args) => { const me = game.profile; game.profile = G.prof; try { return d(...args); } finally { game.profile = me; } }; o.netHost = true; }
  game.toast(`Welcome to ${netName(G.prof)}'s home`, '#ffe9a8');
}
// the host inside a friend's home: their own chest and stove; the rest belongs to the owner
{
  const hi = homeInteract;
  homeInteract = (game, w) => {
    if (!w.netHomeOf || !w.home) return hi(game, w);
    const p = w.player; let f = null, bd = 24; for (const o of w.homeFeats || []) { const d = Math.hypot(p.x - o.x, p.y - o.y); if (d < bd) { bd = d; f = o; } }
    if (!f) return false;
    if (f.kind === 'chest') game.openMenu(storageMenu()); else if (f.kind === 'stove') game.openMenu(kitchenMenu());
    else game.toast(`That belongs to ${netName((game.net.guests[w.netHomeOf] || {}).prof)}: your own chest and stove work here`, '#c9c1a8');
    return true;
  };
}
