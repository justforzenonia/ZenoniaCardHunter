'use strict';
// THE RANKED LADDER, HARDER AS YOU CLIMB (2026-11-20, the user: "all npc progressively get stronger/harder/smarter as you rank up;
// last rank gives a card and gear only obtainable when reaching max rank").
//   STRONGER  a rival's level, cards and gear follow your league AND your points inside it (pvp.js makeRival made a Rookie
//             rival a Lv 1 with cards up to two ranks low and no stat points): level 4 + 10 per league (+ up to 9 more as you near
//             the next league), its stat points all spent (shares by class: hitters ATK, casters INT, everyone some VIT), every
//             card at least the league's rank, its three strongest spells on its keys, and from Platinum on its gear a rank up.
//   SMARTER   the arena CPU (world.js cpuInput) reads its league: it thinks faster and hits, guards and dodges more (cpuSkillFor
//             now climbs to 1.6), and three habits come in as you rise: from Iron it circles you instead of walking straight in,
//             from Gold it strikes back the moment its guard takes a blow, from Diamond it sidesteps your spells and dashes
//             through the gap after your swing.
//   LEGEND    the first time you reach the last league (Legend), two things nobody else can have: the LEGEND CARD (your league's
//             top card, SSS+, named "Legend's ..." with a quarter more power) and the LEGEND weapon for your class (SSS+, stats
//             a third higher). Once per save (pvp.legendGift); shown in the match results and in a toast.
const RLAD = { lv0: 4, lvPer: 10, lvIn: 9, gearUp: 5, legendCard: 1.25, legendGear: 1.33 };
{
  const mr = makeRival;
  makeRival = pr => {
    const R = mr(pr), L = R.league, p2 = R.p2, inL = (pvpOf(pr).rp % RP_PER_LEAGUE) / RP_PER_LEAGUE;
    p2.lv = clamp(RLAD.lv0 + L * RLAD.lvPer + Math.round(inL * RLAD.lvIn) + randi(0, 1), 1, MAX_LV);
    // its stat points, all spent, in its class's shares
    const C = CLASSES[p2.cls] || {}, caster = !!C.focus, total = (p2.lv - 1) * POINTS_PER_LV;
    const share = caster ? { int: 0.45, vit: 0.25, dex: 0.15, agi: 0.15 } : { str: 0.45, vit: 0.25, dex: 0.15, agi: 0.15 };
    p2.attr = {}; let left = total; const ids = ATTRS.map(A => A.id);
    for (const id of ids) { const n = Math.floor(total * (share[id] || 0)); p2.attr[id] = n; left -= n; }
    p2.attr[ids.includes('vit') ? 'vit' : ids[0]] += left;
    // every card at least the league's rank; its three strongest on its keys
    for (const c of p2.cards) if (!c.fusion) c.tier = Math.max(c.tier, Math.min(9, L));
    const best = p2.cards.filter(c => !c.fusion).sort((a, b) => cardSpell(b).power - cardSpell(a).power).slice(0, 3);
    p2.spells = best.map(c => c.uid);
    if (L >= RLAD.gearUp) for (const slot of GEAR_SLOTS) { const g = makeGear(slot, Math.min(9, L + 1), p2.cls), i = p2.gear.findIndex(q => q.uid === p2.eq[slot]); if (i >= 0) { g.uid = p2.gear[i].uid; p2.gear[i] = g; } }
    R.power = powerOf(p2);
    return R;
  };
}
{
  const ci = cpuInput;
  cpuInput = (w, me, foe, dt) => {
    const inp = ci(w, me, foe, dt), A = window.GAME && GAME.arena, L = A && A.ranked ? A.ranked.league : -1;
    if (L < 2 || !foe) return inp;
    const ai = me.cpu, dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy);
    // Iron+: circle in rather than walk straight at you
    if (!inp.dash && !inp.block && d > 40 && d < 120) { ai.orbit = ai.orbit || (Math.random() < 0.5 ? 1 : -1); if (Math.random() < 0.004) ai.orbit = -ai.orbit;
      const k = Math.min(1, (L - 1) * 0.12); inp.mx = Math.sign(dx + (-dy / (d || 1)) * ai.orbit * 60 * k) || inp.mx; inp.my = Math.sign(dy + (dx / (d || 1)) * ai.orbit * 60 * k) || inp.my; }
    // Gold+: strike back the moment its guard takes a blow
    if (L >= 4 && me.guardHitT != null && performance.now() - me.guardHitT < 250 && d < 40) { inp.block = false; inp.atk = true; }
    // Diamond+: sidestep spells, and dash through the gap after your swing
    if (L >= 6) {
      if (foe.state === 'cast' && d < 160 && Math.random() < 0.08 + (L - 6) * 0.03) { inp.dash = true; inp.mx = Math.abs(dy) > Math.abs(dx) ? (Math.random() < 0.5 ? -1 : 1) : 0; inp.my = inp.mx ? 0 : (Math.random() < 0.5 ? -1 : 1); }
      if (ai.lastFoe === 'attack' && foe.state !== 'attack' && d < 60 && Math.random() < 0.35) { inp.dash = true; inp.mx = Math.sign(dx); inp.my = Math.sign(dy); inp.atk = true; }
    }
    ai.lastFoe = foe.state;
    return inp;
  };
}
// a guard taking a blow (for the counter above): combat.js applies blocked hits through dealDamage
{
  const dd = dealDamage;
  dealDamage = function (world, att, def, opts) { const r = dd(world, att, def, opts); if (def && def.state === 'block' && def.cpu) def.guardHitT = performance.now(); return r; };
}
// THE LEGEND GIFTS
{
  const cn = cardName;
  cardName = c => c && c.legend && c.name ? c.name : cn(c);
  const cs = cardSpell;
  cardSpell = c => { const s = cs(c); return c && c.legend && s ? { ...s, power: Math.round(s.power * RLAD.legendCard) } : s; };
  const fr = finishRanked;
  finishRanked = (game, won) => {
    const pr = game.profile, P = pvpOf(pr), done = game.arena && game.arena.resolved;
    fr(game, won);
    if (done || !won || P.legendGift || leagueOf(P.rp) < LEAGUES.length - 1) return;
    P.legendGift = true;
    const mobs = SPECIES_IDS.filter(id => D.monsters[id] && SPECIES[id]), sp = mobs.sort((a, b) => (SPECIES[b].hp || 0) - (SPECIES[a].hp || 0))[0];
    const c = makeCard(sp, 9); c.legend = true; c.name = `Legend's ${SPECIES[sp].name}`;
    const g = makeGear('weapon', 9, pr.cls); g.legend = true; g.name = `Legend's ${CLASSES[pr.cls].weapon}`;
    for (const k in g.stats) g.stats[k] = Math.round(g.stats[k] * RLAD.legendGear);
    game.pickup({ kind: 'card', item: c, force: true }); game.pickup({ kind: 'gear', item: g, force: true }); game.save();   // (force: a one-of-a-kind reward goes straight in, even into a full collection)
    const m = game.menu; if (m && m.type === 'pvpres') m.rewards.unshift(`👑 LEGEND CARD: ${c.name} (SSS+)`, `👑 LEGEND GEAR: ${g.name} (SSS+)`);
    game.toast('LEGEND! The Legend card and weapon are yours: nobody else can earn them', '#ffd23f');
  };
}
