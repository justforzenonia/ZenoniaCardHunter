'use strict';
// CO-OP DUNGEON RUNS AND THE TOWER CLIMB in online co-op (net.js). Friends already follow the host down black holes, into Survival
// Rifts, raids and the Abyss Tower, and see the same timer and floor banner. This makes them real party runs:
//   SHARES     a rift survived, a raid beaten or a tower floor cleared pays every friend there in their own save, as if they had
//              run it alone (a numbered reward, 'dungeon'): the rift's rare card, gear for their own class and EXP; the raid's haul
//              by their own raid record (the full haul once a day); a tower floor's coins (and a card on boss floors) the first
//              time THEY clear it, so a friend climbs their own best with you.
//   HARDER     a bigger party meets more: the rift sends extra monsters, and each tower floor holds half as many again per friend
//              (boss floors keep their one Warden, who is tougher through the party's health scaling, netparty.js).
//   BREATHERS  between tower floors every friend heals too, like the host.
const NDUN = { riftMore: 0.5, towerMore: 0.5, towerCap: 2 };
const netDunHere = game => { const w = game.world; return netGuestList(game).filter(G => { const a = netGuestActor(w, G.gid); return a; }); };
function netDungeonShare(game, v) {
  if (netDunHere(game).length) bumpStat('coopRuns');   // (a party stat: netsocial.js)
  for (const G of netDunHere(game)) { G.rwSeq++; G.rw.push({ n: G.rwSeq, k: 'dungeon', v }); }
}
// one friend's share, on their own save (net.js netRewards)
function netDungeonPaid(game, v) {
  const pr = game.profile, Z = ZONES[v.zone] || ZONES[0], pool = Z.mobs.filter(id => D.monsters[id]);
  if (v.kind === 'rift') {
    const rank = Math.min(9, Z.ranks[1] + 1);
    game.pickup({ kind: 'card', item: makeCard(pick(pool), rank) }); game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rank, pr.cls) });
    if (Math.random() < 0.3) { pr.coins = (pr.coins || 0) + 1; }
    netGainExp(game, killExp(Z.ranks[1]) * (10 + v.kills)); questEvent(game, 'rift');
    game.toast(`RIFT SURVIVED TOGETHER! ${v.kills} kills: a rare card and gear are yours`, '#ffd23f'); logAdd(game, 'Survival Rift cleared with friends', '#ffd23f');
  } else if (v.kind === 'tower') {
    const T2 = towerOf(pr), f = v.floor;
    if (f <= T2.best) { game.toast(`Floor ${f} cleared together (your best is ${T2.best})`, TOWER.col); return; }
    T2.best = f; const coins = 1 + Math.floor(f / TOWER.boss); pr.coins = (pr.coins || 0) + coins; seasonGain(game, TOWER.seasonPts);
    if (towerBoss(f)) { game.pickup({ kind: 'card', item: makeCard(pick(pool), Math.min(9, towerRank(f) + 1)) }); game.toast(`FLOOR ${f} CLEARED · your new best · +${coins} coins and a card`, '#ffd23f'); }
    else game.toast(`Floor ${f} cleared · your new best · +${coins} coin${coins > 1 ? 's' : ''}`, TOWER.col);
    logAdd(game, `Abyss Tower: Floor ${f} with friends`, TOWER.col);
  } else if (v.kind === 'raid') {
    const R = raidOf(v.id); if (!R) return;
    const S = raidState(pr), s = S[R.id] || (S[R.id] = { clears: 0 }), first = !s.clears, today = dayNo(), full = s.day !== today;
    s.clears++; s.best = s.best ? Math.min(s.best, v.ms) : v.ms; if (full) s.day = today;
    const k = full ? 1 : RAID.again, i = RAIDS.indexOf(R), gold = Math.round(RAID.gold * (1 + i * 0.5) * k);
    pr.gold = (pr.gold || 0) + gold; pr.coins = (pr.coins || 0) + Math.round(RAID.coins * k);
    if (full) {
      const tier = first || Math.random() < RAID.sssPlus ? 9 : 8;
      game.pickup({ kind: 'card', item: makeCard(R.sp, tier), force: true });
      for (let n = 0; n < 2; n++) game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), 8, pr.cls) });
      game.toast(`${R.name} FALLS! Your share: its card (${RANKS[tier]}), two SSS pieces and ${gold.toLocaleString('en-US')} G`, '#ffd23f');
    } else game.toast(`${R.name} falls again: ${gold.toLocaleString('en-US')} G (your full haul returns tomorrow)`, '#ffd23f');
    netGainExp(game, killExp(9) * 40); logAdd(game, `Raid: ${R.name} beaten with friends`, '#ffd23f');
  }
  bumpStat('coopRuns'); game.net.profDirty = true;
}
// the host's side: each run's pay also goes to the friends there, and the runs grow with the party
{
  const rr = riftReward, tc = towerCleared, rd = raidReward, tf = towerFloor, rs = riftSpawn;
  riftReward = (game, w) => { rr(game, w); netDungeonShare(game, { kind: 'rift', zone: w.rift.zone, kills: w.rift.kills }); };
  raidReward = (game, w, R) => { rd(game, w, R); netDungeonShare(game, { kind: 'raid', id: R.id, ms: Math.round(performance.now() - w.rift.start) }); };
  towerCleared = (game, w) => {
    tc(game, w);
    for (const G of netDunHere(game)) { const a = netGuestActor(w, G.gid); if (a && !a.dead) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * TOWER.heal); a.mp = Math.min(a.maxMp, a.mp + a.maxMp * TOWER.heal); } }
    netDungeonShare(game, { kind: 'tower', floor: w.rift.floor, zone: w.rift.zone });
  };
  towerFloor = (game, w) => {
    tf(game, w); const n = netPartyGuests(), Rf = w.rift;
    if (n && !towerBoss(Rf.floor)) Rf.left = Math.min(TOWER.maxMon * NDUN.towerCap, Math.round(Rf.left * (1 + NDUN.towerMore * n)));
  };
  riftSpawn = w => { rs(w); const n = netPartyGuests(); if (n && Math.random() < NDUN.riftMore * n) rs(w); };
}
