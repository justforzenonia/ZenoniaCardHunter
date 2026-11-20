'use strict';
// (loaded after main.js, which defines updateWorldScene; the cards themselves are in arcana2.js)
// A GIFT TO TRY ONE: every hero (new or old) gets one of the New Arcana once, at rank C, after about ARCANA2_GIFT.wait ms out in the
// world with no monster close and no menu open (not as an online guest). It flips in like a summoned card, with a note.
const ARCANA2_GIFT = { wait: 8000, tier: 3, calm: 200 };
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const r = uw(dt), G = window.GAME, pr = G && G.profile, w = G && G.world, p = w && w.player;
    // (FIRST 15 MINUTES, 2026-11-08: a brand-new hero used to get this 8 s into their first walk, with the 'gold dot' tip right
    // after, before summons or ranks meant anything. It now waits until SUMMON has opened (unlocks.js: Lv 6 or the first
    // Guardian) and for a quiet moment: no journey card, level-up or other card flipping in)
    if (pr && !pr.arcana2Gift && G.scene === 'world' && !G.menu && p && !p.dead && !(G.net && G.net.role === 'guest')
      && (typeof unlocked !== 'function' || unlocked(pr, 'summon')) && !G.goalCard && !G.levelFx && !(G.reveals && G.reveals.length)
      && !w.actors.some(a => a.kind === 'monster' && !a.dead && !a.ally && !a.pet && Math.hypot(a.x - p.x, a.y - p.y) < ARCANA2_GIFT.calm)) {
      G.a2T = (G.a2T || 0) + dt;
      if (G.a2T >= ARCANA2_GIFT.wait) {
        const c = makeCard(pick(Object.keys(ARCANA2)), ARCANA2_GIFT.tier); pr.arcana2Gift = c.sp;
        if (pr.cards.length < 200) pr.cards.push(c); else { pr.storage = pr.storage || { cards: [], gear: [] }; pr.storage.cards.push(c); }
        if (G.reveals) G.reveals.push({ card: c, t: 0 });
        G.toast(`A gift from the Card Oracle: ${SPECIES[c.sp].name}, one of ${Object.keys(ARCANA2).length} new Arcana · find the rest in Summons, hoards and from bosses`, '#d8c8ff');
        G.save();
      }
    }
    return r;
  };
}
// ARCANA COLLECTING: every Arcana kind you have ever held is remembered (pr.arcanaSeen, checked once a second out in the world,
// so a summon counts as soon as you step back out). Every tenth kind pays Summon coins (ARCANA_MILES.coins x the count: 10 coins
// at 10 kinds … 50 at 50), once each; a hero who already holds many is paid for each tenth they have passed. The Arcanist title
// comes at 30 kinds (titles.js picks it up). The Monster Book's ARCANA tab shows the next reward (arcanabook.js).
const ARCANA_MILES = { every: 10, coins: 1, title: 30 };
const arcanaSeenCount = pr => Object.keys((pr && pr.arcanaSeen) || {}).length;
function arcanaSeenTick(game) {
  const pr = game.profile; if (!pr) return;
  const S = pr.arcanaSeen = pr.arcanaSeen || {}, before = Object.keys(S).length;
  for (const c of [...(pr.cards || []), ...((pr.storage && pr.storage.cards) || [])]) if (c && c.sp && SPECIES[c.sp] && SPECIES[c.sp].arcana && ARCANA_CARDS.includes(c.sp)) S[c.sp] = 1;
  if (Object.keys(S).some(id => ARCANA2[id]) && typeof tipEvent === 'function' && !(pr.tips && pr.tips.newmove)) tipEvent(game, 'newmove');   // (the first card with a gold dot: what it means)
  const n = Object.keys(S).length; if (n === before && (pr.arcanaPaid || 0) >= Math.floor(n / ARCANA_MILES.every) * ARCANA_MILES.every) return;
  let paid = pr.arcanaPaid || 0;
  for (let m = paid + ARCANA_MILES.every; m <= n; m += ARCANA_MILES.every) {
    const coins = m * ARCANA_MILES.coins; pr.coins = (pr.coins || 0) + coins; paid = m;
    game.toast(`Arcana collection: ${m} kinds! +${coins} Summon coins`, '#d8c8ff');
  }
  pr.arcanaPaid = paid; game.save();
}
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const r = uw(dt), G = window.GAME;
    if (G && G.profile && G.scene === 'world' && !(G.net && G.net.role === 'guest')) { G.arcT = (G.arcT || 0) + dt; if (G.arcT >= 1000) { G.arcT = 0; arcanaSeenTick(G); } }
    return r;
  };
}
if (!TITLE_BY.arcanist) {
  const t = { id: 'arcanist', name: 'Arcanist', tier: 2, how: `Hold ${ARCANA_MILES.title} different Arcana (in all)`, prog: pr => [Math.min(ARCANA_MILES.title, arcanaSeenCount(pr)), ARCANA_MILES.title] };
  TITLE_LIST.push(t); TITLE_BY.arcanist = t; TITLE_PASSIVES.arcanist = ['mana', 'barrier', 'crit'];
}
// the deck grows with your level (deckplus.js deckMax): a toast the first time each new place opens
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const r = uw(dt), G = window.GAME, pr = G && G.profile;
    if (pr && typeof deckMax === 'function' && G.scene === 'world') { const n = deckMax(pr); if (pr.deckMaxSeen == null) pr.deckMaxSeen = n; else if (n > pr.deckMaxSeen) { pr.deckMaxSeen = n; G.toast(`Your deck grows: it now holds ${n} cards`, '#ffd860'); G.save(); } }
    return r;
  };
}
// DRAW PILE (deckplus.js): the card coming next sits on a small dark label at the spell bar's top-left corner
{
  const dsb = drawSpellBar;
  drawSpellBar = (a, keysLbl, cx, y, now) => {
    const r = dsb(a, keysLbl, cx, y, now), G = window.GAME, pr = G && G.profile, w = G && G.world;
    if (pr && pr.drawPile && w && a === w.player && G.scene === 'world' && typeof drawPileInit === 'function') {
      drawPileInit(pr, a); const u = a.pile[0], c = u && pr.cards.find(q => q.uid === u);
      const t = c ? `NEXT: ${SPECIES[c.sp] ? SPECIES[c.sp].name : 'card'} · ${a.pile.length} in pile` : 'NEXT: — (deck has no more)', W = (30 + 3 * SLOT + 2 * 5) * 2, x0 = cx - W / 2 - 10, tw = textW(t, 7) + 10;
      ctx.fillStyle = 'rgba(22,15,9,0.92)'; rrect(ctx, x0, y - 24, tw, 12, 3); ctx.fill(); text(t, x0 + tw / 2, y - 18, '#ffd860', 7);
      const F = a.drawFlip, k = F ? (now - F.t) / 320 : 1;   // a card just drawn into a slot: the slot flips (a white sheen that narrows to its middle) for a third of a second
      if (k < 1) { const sx = cx - W / 2 + F.slot * (SLOT + 5), sw = SLOT * Math.abs(Math.cos(k * Math.PI)); ctx.save(); ctx.globalAlpha = 0.55 * (1 - k); ctx.fillStyle = '#ffffff'; rrect(ctx, sx + (SLOT - sw) / 2, y, sw, SLOT, 3); ctx.fill(); ctx.restore(); }
    }
    return r;
  };
}
// NEW CARD, NEW SYNERGY: when a card you pick up joins your deck and turns a synergy on, the gold synergy note follows; when your
// deck is full but the new card could finish a synergy by swapping out a spare card, a soft note says so (H on the Spell Deck page).
if (window.GAME && typeof deckFinishSwap === 'function') {
  const pk = GAME.pickup;
  GAME.pickup = function (d) {
    if (!d || d.kind !== 'card' || !this.profile || !d.item || d.item.fusion) return pk.call(this, d);
    const pr = this.profile, synB = deckSynText(deckSynergy(pr)), r = pk.call(this, d);
    try {
      if (pr.deck.includes(d.item.uid)) deckSynNote(this, synB);
      else if (pr.cards.includes(d.item)) { const B = deckFinishSwap(pr, [d.item]); if (B) this.toast(`${cardName(d.item)} could give you ${B.gain.map(synName).join(', ')} (H on the Spell Deck page finds the swap)`, '#9fe8ff'); }
    } catch (e) {}
    return r;
  };
}
