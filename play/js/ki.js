'use strict';
// KI: a card class of its own (the Spirit Cannon). A Ki card is never fused into a new card: at the Fusion Altar it
// is ENHANCED instead — put the Ki card with one or two other cards in the MERGE slots and it absorbs them as Ki.
// Each card fed gives (its rank + 1) × 10 Ki (×2 for a fused card); a full Ki bar (20 × (rank + 1) × (rank + 2), so each rank costs far more than the last) raises the Ki
// card one rank, up to SSS+. Enhancing never fails and the Ki card keeps its place in your deck and spell slots.
// Saved on the card as c.kiXp.

const KI = { gain: c => (c.tier + 1) * 10 * (c.fusion ? 2 : 1), need: t => 20 * (t + 1) * (t + 2), col: '#9fe8ff' };
const isKi = c => !!(c && !c.fusion && SPECIES[c.sp] && SPECIES[c.sp].ki);
// what feeding these cards would do: the Ki card, how much Ki, its rank and Ki after
function kiPlan(cards) {
  const kis = cards.filter(isKi); if (!kis.length) return null;
  if (kis.length > 1) return { error: 'Only one Ki card at a time — the others would be fed to it' };
  const base = kis[0], feed = cards.filter(c => c !== base);
  if (base.tier >= 9) return { base, feed, error: 'Already SSS+: nothing left to feed' };
  if (!feed.length) return { base, feed, error: 'Add 1 or 2 cards to feed its Ki' };
  let gain = feed.reduce((s, c) => s + KI.gain(c), 0), tier = base.tier, xp = (base.kiXp || 0) + gain;
  while (tier < 9 && xp >= KI.need(tier)) { xp -= KI.need(tier); tier++; }
  if (tier >= 9) xp = Math.min(xp, KI.need(9));
  return { base, feed, gain, tier, xp, up: tier - base.tier };
}
function kiEnhance(game, m, plan) {
  const pr = game.profile, eat = new Set(plan.feed.map(c => c.uid));
  pr.cards = pr.cards.filter(c => !eat.has(c.uid));
  pr.deck = pr.deck.filter(u => !eat.has(u));
  pr.spells = pr.spells.map(u => eat.has(u) ? null : u);
  if (eat.has(pr.fusion)) pr.fusion = null;
  plan.base.tier = plan.tier; plan.base.kiXp = plan.xp;
  m.fromCards = [plan.base, ...plan.feed];
  m.sel = []; m.confirm = false; m.result = plan.base; m.kiResult = plan; m.anim = 1500; m.animStart = performance.now();
  game.toast(plan.up ? `KI SURGES! ${cardName(plan.base)} rises to RANK ${RANKS[plan.tier]} (+${plan.gain} Ki)` : `${cardName(plan.base)} absorbs +${plan.gain} Ki (${Math.floor(plan.xp)}/${KI.need(plan.tier)})`, KI.col);
  game.save(); if (game.refreshPlayer) game.refreshPlayer();
}
// the altar's lines while a Ki card is in the slots
function drawKiPlan(plan, now) {
  if (plan.error) { text(plan.error, 300, 236, '#ffd27a', 8); return; }
  text(`KI ENHANCE · ${cardName(plan.base)}  ·  +${plan.gain} Ki  ·  ${plan.up ? `RANK ${RANKS[plan.base.tier]} → ${RANKS[plan.tier]}` : `RANK ${RANKS[plan.tier]}`}`, 300, 236, KI.col, 8);
  // the Ki bar after feeding
  const k = Math.min(1, plan.xp / KI.need(plan.tier)), x = 122, y = 244, w = 120;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrect(ctx, x, y - 3, w, 6, 3); ctx.fill();
  ctx.fillStyle = KI.col; if (k > 0) { rrect(ctx, x, y - 3, Math.max(6, w * k), 6, 3); ctx.fill(); }
  text(plan.tier >= 9 ? 'MAX RANK · never fails' : `Ki ${Math.floor(plan.xp)} / ${KI.need(plan.tier)} · never fails`, x + w / 2, y + 7.5, '#bfefff', 5.5);
}
