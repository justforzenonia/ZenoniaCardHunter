'use strict';
// SIDEKICK in online co-op (net.js): a friend more than 5 levels below the host would be flattened by the host's monsters, so
// while they are in the host's world their hero fights at the host's level less 3: more HP, MP and attack, by the same steps a
// level-up gives (defs.js LV_GROWTH). It only touches the hero the host's game runs; the friend's own save, level and EXP are
// their own, and EXP still comes in as usual. The party hears it once when they arrive.
const NSIDE = { gap: 5, under: 3 };
function netSidekick(game, a, prof) {
  const host = game.profile.lv || 1, lv = prof.lv || 1, to = host - NSIDE.under, n = to - lv;
  if (!a || host - lv <= NSIDE.gap || n <= 0) return 0;
  const f = a.maxHp ? a.hp / a.maxHp : 1, fm = a.maxMp ? a.mp / a.maxMp : 1;
  a.maxHp += Math.round(n * LV_GROWTH.hp); a.hp = a.maxHp * f;
  if (a.maxMp) { a.maxMp += Math.round(n * LV_GROWTH.mp); a.mp = a.maxMp * fm; }
  a.atk += n * LV_GROWTH.atk; a.sideLv = to;
  return to;
}
{
  const sg = netSpawnGuest;
  netSpawnGuest = (game, w, G) => {
    const a = sg(game, w, G); if (!a) return a;
    const to = netSidekick(game, a, G.prof);
    if (to && !G.sideTold) { G.sideTold = true; if (typeof netDuelNews === 'function') netDuelNews(game, `${netName(G.prof)} fights at Lv ${to} beside you (sidekick)`); }
    return a;
  };
  const gp = netGuestProfile;
  netGuestProfile = (game, gid, prof) => {
    const r = gp(game, gid, prof), w = game.world, a = w && netGuestActor(w, gid);
    if (a && !a.sideLv) netSidekick(game, a, prof);   // (rebuilt from a new save: boosted again)
    return r;
  };
}
