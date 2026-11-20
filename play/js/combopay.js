'use strict';
// COMBO BONUS: the hit counter's grades (hud.js: GOOD 5, GREAT 10, AWESOME 20, ZENONIA!! 40) now pay. When a chain of 5 or
// more ends, the hero who landed it gets gold and EXP for every hit in it, sized to the zone the story has reached and
// multiplied by the grade, with a float over their head. A co-op friend's chains pay them (net.js netShare to that friend).
const COMBO_PAY = { min: 5, gold: 1, exp: 0.3, grades: [[40, 4, 'ZENONIA!!'], [20, 2.5, 'AWESOME'], [10, 1.5, 'GREAT'], [5, 1, 'GOOD']] };
function comboPay(world, a, n) {
  const G = window.GAME, pr = G && G.profile; if (!pr || G.world !== world) return;
  const g = COMBO_PAY.grades.find(x => n >= x[0]); if (!g) return;
  const rank = ZONES[storyZone(pr)].ranks[0], gold = Math.round(n * COMBO_PAY.gold * (1 + rank) * g[1]), exp = Math.round(n * killExp(rank) * COMBO_PAY.exp * g[1]);
  floatText(world, a.x, a.y - 56, `${g[2]} ×${n} · +${gold} G +${exp} EXP`, n >= 20 ? '#ff9a5a' : '#ffd23f', 8);
  if (a === world.player) { pr.gold = (pr.gold || 0) + gold; G.gainExp(exp); pr.stats = pr.stats || {}; pr.stats.comboBest = Math.max(pr.stats.comboBest || 0, n); }   // (the longest chain ever)
  else if (a.netGid && typeof netShare === 'function') { netShare(G, 'statMax', { k: 'comboBest', n }, a.netGid);   // (their longest chain, on their save: net.js)
    netShare(G, 'gold', gold, a.netGid); netShare(G, 'exp', exp, a.netGid); }
}
// watched each frame for every hero (guard.js guardTick runs in combat.js updateActor): the chain's peak, paid when it ends
{
  const gt = guardTick;
  guardTick = (world, a, dt) => {
    const r = gt(world, a, dt);
    if (a.kind === 'player') {
      if ((a.combo || 0) > (a.comboPeak || 0)) a.comboPeak = a.combo;
      if (!(a.comboT > 0) || !(a.combo > 0)) { if ((a.comboPeak || 0) >= COMBO_PAY.min) comboPay(world, a, a.comboPeak); a.comboPeak = 0; }
    }
    return r;
  };
}
