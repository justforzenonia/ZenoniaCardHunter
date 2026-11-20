'use strict';
// PARTY BOSS HUNTS in online co-op (net.js): while at least one friend is with the host out in the Wilds (not in town, not down a
// hole), a PARTY BOSS turns up every couple of minutes not far from the group: the region's toughest kind, a rank above the
// region, twice as big, with the wild bosses' fighting kit and health for the whole party. It never appears for someone alone.
// Beaten, it leaves a REWARD CHEST for everyone: each player (host and every friend there) gets their own card of the boss's
// kind, a piece of gear for their own class and gold, in their own save (a guest's share is a numbered reward, 'partyChest').
// If the party walks away from it for half a minute it slips off. The HOST's game runs it all.
const NBOSS = { first: 60000, every: 120000, near: 170, far: 1100, lose: 30000, hpBase: 10, hpPer: 6, gold: 400 };
function netBossTick(game, w, dt) {
  const N = game.net; if (!N || N.role !== 'host' || !w || !w.overworld || w.interior) return;
  const p = w.player, here = netGuestList(game).filter(G => { const a = netGuestActor(w, G.gid); return a && !a.dead; });
  let B = N.pboss && w.actors.includes(N.pboss) ? N.pboss : null;
  if (B && B.dead) { if (!B.netPaid) netBossPaid(game, w, B); N.pboss = null; N.pbT = NBOSS.every; return; }
  if (B) {   // the party walked off: it slips away
    const heroes = [p, ...here.map(G => netGuestActor(w, G.gid))], close = heroes.some(h => h && Math.hypot(h.x - B.x, h.y - B.y) < NBOSS.far);
    B.netLost = close ? 0 : (B.netLost || 0) + dt;
    if (B.netLost > NBOSS.lose) { B.remove = true; N.pboss = null; N.pbT = NBOSS.every; netDuelNews(game, `The party boss ${B.label} slipped away`); }
    return;
  }
  if (!here.length || !p || p.dead || inTown(p.x)) return;
  const R = REGIONS[regionIndexAt(p.x)]; if (!R || R.zone < 0) return;
  N.pbT = (N.pbT == null ? NBOSS.first : N.pbT) - dt; if (N.pbT > 0) return;
  N.pbT = NBOSS.every; netBossSpawn(game, w, R, here.length + 1);
}
function netBossSpawn(game, w, R, players) {
  const N = game.net, p = w.player, Z = ZONES[R.zone], pool = Z.mobs.filter(id => D.monsters[id] && SPECIES[id]); if (!pool.length) return;
  const sp = pool.slice().sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0], rank = Math.min(9, Z.ranks[1] + 1);
  const side = Math.random() < 0.5 ? -1 : 1, q = findOpen(w, p.x + side * NBOSS.near, p.y + rand(-30, 30));
  const m = makeMonster(sp, rank, q.x, q.y);
  Object.assign(m, { boss: true, partyBoss: true, scale: 2, heavy: true, smart: true, home: { x: q.x, y: q.y }, region: regionIndexAt(q.x) }); giveWildKit(m);
  m.label = `Party Boss · ${SPECIES[sp].name}`;
  m.maxHp = m.hp = Math.round(m.maxHp * (NBOSS.hpBase + NBOSS.hpPer * players)); m.atk *= 1.5; m.def += rank * 2;
  w.actors.push(m); N.pboss = m;
  w.rings.push({ x: m.x, y: m.y, r: 60, t: 0, col: '#ffb84a' }); w.shake = Math.max(w.shake || 0, 6);
  netDuelNews(game, `A PARTY BOSS appears: ${SPECIES[sp].name}! Beat it together for a chest each`);
}
// the reward chest: one share for everyone who was there
function netBossPaid(game, w, B) {
  const N = game.net; B.netPaid = true;
  const chest = makeMapObject([3, 0, Math.round(B.x), Math.round(B.y)]); if (chest) { w.objects.push(chest); w._grid = null; openChest(w, chest); }
  const share = { sp: B.sp, tier: B.tier, gold: NBOSS.gold * (B.tier + 1), name: SPECIES[B.sp].name };
  netPartyChest(game, share);   // the host's own share
  for (const G of netGuestList(game)) if (netGuestActor(w, G.gid)) { G.rwSeq++; G.rw.push({ n: G.rwSeq, k: 'partyChest', v: share }); }
  netDuelNews(game, `PARTY BOSS DEFEATED: ${share.name}! A reward chest for everyone`);
  netPqEvent(game, 'pboss');   // (a party contract, netquest.js)
}
// one player's share of the chest, on their own save (the host's at once; a guest's when it arrives)
function netPartyChest(game, S) {
  const pr = game.profile, rp = game.refreshPlayer;
  game.pickup({ kind: 'card', item: makeCard(S.sp, S.tier), force: true });
  game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), S.tier, pr.cls) });
  pr.gold = (pr.gold || 0) + S.gold; bumpStat('partyBosses');
  game.toast(`Party chest: a ${RANKS[S.tier]} card, gear and ${S.gold} G`, '#ffd23f'); logAdd(game, `Party boss ${S.name} beaten`, '#ffd23f');
  game.save(); if (rp) game.refreshPlayer = rp;
}
