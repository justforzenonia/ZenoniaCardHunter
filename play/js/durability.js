'use strict';
// GEAR DURABILITY: every piece of gear wears down in fights. The weapon loses a little with every blow you land, and a random
// piece you wear loses a little with every blow you take (more for a heavy one). At 0 it is BROKEN: it stays on you but gives
// nothing until it is mended. Any Smith in town mends it for gold (the REPAIR tab), more for higher ranks.
// DEATH out in the Wilds costs all your gear: everything you wear and everything in your bag breaks and is gone. What sits in
// storage at home is safe.
// g.dur = what is left (missing on older gear = full); its most is gearDurMax(g).
const DUR = { base: 120, perTier: 30, hit: 0.35, hurt: 0.6, heavy: 0.12, warn: 0.2, cost: 1.4 };
const gearDurMax = g => DUR.base + (g.tier || 0) * DUR.perTier;
const gearDur = g => (g.dur == null ? gearDurMax(g) : g.dur);
const gearBroken = g => g.dur != null && g.dur <= 0;
function gearWearOne(game, g, n) {
  if (!g || gearBroken(g)) return; const was = gearDur(g), max = gearDurMax(g);
  g.dur = Math.max(0, was - n);
  if (g.dur <= 0) { game.toast(`${g.name} BROKE — mend it at a Smith in town`, '#ff6a5a'); game.refreshPlayer(); }
  else if (was > max * DUR.warn && g.dur <= max * DUR.warn) game.toast(`${g.name} is badly worn (${Math.ceil(g.dur)}/${max})`, '#ffb07a');
}
// a blow landed or taken by the hero (dealDamage, after the damage is known)
function gearWear(world, att, def, dmg) {
  const game = window.GAME; if (!game || !game.profile || !game.world || !world.overworld && !world.cave && !world.rift) return;
  const pr = game.profile, worn = s => pr.gear.find(g => g.uid === pr.eq[s]);
  if (att && att.kind === 'player' && att === world.player) gearWearOne(game, worn('weapon'), DUR.hit);
  if (def && def.kind === 'player' && def === world.player && dmg > 0) {
    const slots = GEAR_SLOTS.filter(s => s !== 'weapon' && worn(s)); if (!slots.length) return;
    gearWearOne(game, worn(pick(slots)), DUR.hurt + DUR.heavy * Math.min(10, dmg / Math.max(1, def.maxHp) * 100));
  }
}
// the repair bill for one piece: what is missing, times its rank
const repairCost = g => Math.ceil((gearDurMax(g) - gearDur(g)) * DUR.cost * ((g.tier || 0) + 1));
function repairRows(game) {
  const pr = game.profile, worn = new Set(Object.values(pr.eq || {})), list = pr.gear.filter(g => gearDur(g) < gearDurMax(g)).sort((a, b) => gearDur(a) / gearDurMax(a) - gearDur(b) / gearDurMax(b));
  const all = list.reduce((s, g) => s + repairCost(g), 0), rows = [];
  if (list.length > 1) rows.push({ all: true, icon: null, name: `Mend everything (${list.length} pieces)`, sub: 'Every worn or broken piece back to full', right: `${all} G`, price: all });
  for (const g of list) rows.push({ mend: g, icon: g.icon, name: `${g.name}${gearBroken(g) ? '  · BROKEN' : ''}`, sub: `${SLOT_LABEL[g.slot]}${worn.has(g.uid) ? ' · worn' : ' · in your bag'} · ${Math.ceil(gearDur(g))}/${gearDurMax(g)}`, right: `${repairCost(g)} G`, price: repairCost(g), col: gearBroken(g) ? '#ff8a7a' : rankColor(g.tier) });
  for (const r of rows) r.rightCol = (pr.gold || 0) >= r.price ? '#ffd23f' : '#8a6a4a';
  return rows;
}
function repairPick(game, r) {
  const pr = game.profile; if ((pr.gold || 0) < r.price) { game.toast(`Not enough gold (${r.price} G)`, '#ff8a8a'); return; }
  pr.gold -= r.price; const list = r.all ? pr.gear.filter(g => gearDur(g) < gearDurMax(g)) : [r.mend];
  for (const g of list) g.dur = gearDurMax(g);
  game.toast(r.all ? `Everything mended for ${r.price} G` : `${r.mend.name} mended for ${r.price} G`, '#8fffd0'); game.refreshPlayer(); game.save();
}
// fallen in the Wilds: all you wear and carry breaks and is gone. A NEW HERO'S GRACE (as for their partner, heropartner.js):
// below Lv 10 a fall only wears each piece down by a quarter of its durability, so learning to fight can't strip you bare.
const DEATH_GRACE = { lv: 10, wear: 0.25 };
function gearLossOnDeath(game) {
  const pr = game.profile; if (!pr || !pr.gear.length) return;
  if ((pr.lv || 1) < DEATH_GRACE.lv) {
    for (const g of pr.gear) g.dur = Math.max(1, Math.round(gearDur(g) - gearDurMax(g) * DEATH_GRACE.wear));
    game.toast(`Your gear held, a little worn. Until Lv ${DEATH_GRACE.lv} a fall can't shatter it.`, '#ffd0a0');
    game.refreshPlayer(); game.save(); return;
  }
  const n = pr.gear.length; pr.gear = []; for (const s of GEAR_SLOTS) delete pr.eq[s];
  game.toast(`Your gear shattered — ${n} piece${n === 1 ? '' : 's'} lost. Storage at home is safe.`, '#ff6a5a');
  game.refreshPlayer(); game.save();
}
