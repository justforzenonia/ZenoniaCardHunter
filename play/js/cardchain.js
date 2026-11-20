'use strict';
// CARD CHAINS: cast your cards in a rhythm. A card cast from a spell slot (Q / E / R) within CHAIN.window ms of the last one
// chains with it (melee hits keep the window open, so attack, card, attack, card flows):
//   - the first card's element status is made sure on every foe it hit (burn, freeze, shock, crack or poison), so the next
//     card can set off a reaction with it (elemreact.js): fire then ice is a sure Steam, ice then earth a sure Shatter
//   - RESONANCE: a card of the same element as the one before gets CHAIN.resonance more on top (one-element decks chain too)
//   - the 2nd card does CHAIN.second more; a 3rd FINISHES the chain: CHAIN.finish more and CHAIN.refund of its MP back,
//     then a new chain can start
// Feedback stays calm: while the window is open a small gold link chip sits on your other ready spell slots (Settings >
// COMBAT HINTS off hides it), a small "CHAIN ×2" float shows over you, and a soft chime plays (at most one every 3 s, but a
// finish always chimes). Heroes only: yours and, on the host, each co-op friend's.
const CHAIN = { window: 2500, second: 1.25, finish: 1.5, refund: 0.3, resonance: 1.15, hitWin: 1500, statusEls: ['fire', 'ice', 'lightning', 'earth', 'poison'] };
REACT_CHIPS.CHAIN = ['#ffd23f', ['.##..', '#..#.', '.##.#', '..#..', '.#.##']];   // a little chain link
{
  const cs = castSpell;
  castSpell = (world, a, sp, link, boost = 1) => {
    if (!a || a.kind !== 'player' || a.castSlot == null || !sp || sp.sup) return cs(world, a, sp, link, boost);
    const now = performance.now(), C = a.cardChain;
    const n = C && now - C.at <= CHAIN.window && C.n < 3 ? C.n + 1 : 1;
    if (n >= 2) chainSure(world, C.last);   // the card before: its status lands for sure on what it hit
    const same = n >= 2 && C.last && C.last.el === sp.el;   // RESONANCE: the same element again rings truer (for one-element decks)
    const mul = (n === 3 ? CHAIN.finish : n === 2 ? CHAIN.second : 1) * (same ? CHAIN.resonance : 1);
    a.cardChain = { n: n === 3 ? 0 : n, at: now, slot: a.castSlot, last: { el: sp.el, base: sp.power, foes: new Set(), t0: now } };
    a.chainN = a.cardChain.n; a.chainSlot = a.castSlot; a.chainLeft = a.cardChain.n ? CHAIN.window : 0;   // (plain values a co-op friend's game gets: net.js NET_ME)
    if (n >= 2) chainShow(world, a, n, same);
    if (n === 3 && sp.mp) a.mp = Math.min(a.maxMp, (a.mp || 0) + sp.mp * CHAIN.refund);
    return cs(world, a, sp, link, boost * mul);
  };
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const r = dd(world, att, def, opts);
    if (att && att.kind === 'player' && att.cardChain && def && def !== att && opts) {
      const L = att.cardChain.last, now = performance.now();
      if (opts.spell && L && opts.el === L.el && now - L.t0 < CHAIN.hitWin && !def.dead) L.foes.add(def);   // (who the last card hit)
      else if (!opts.spell && att.cardChain.n) { att.cardChain.at = now; att.chainLeft = CHAIN.window; }   // (a melee hit keeps the chain going)
    }
    return r;
  };
}
// each frame: the time left on a hero's chain (guard.js guardTick runs for every hero on this game)
{
  const gt = guardTick;
  guardTick = (world, a, dt) => { const r = gt(world, a, dt); if (a.kind === 'player' && a.cardChain) { a.chainLeft = a.cardChain.n ? Math.max(0, CHAIN.window - (performance.now() - a.cardChain.at)) : 0; a.chainN = a.chainLeft > 0 ? a.cardChain.n : 0; } return r; };
}
// the status of the card before, made sure on each foe it hit (unless the foe already carries it)
function chainSure(world, L) {
  if (!L || !CHAIN.statusEls.includes(L.el)) return;
  for (const f of L.foes) {
    if (f.dead) continue; f.status = f.status || {};
    const key = { fire: 'burn', ice: 'freeze', lightning: 'shock', earth: 'crack', poison: 'poison' }[L.el], v = f.status[key];
    if (!(v && (typeof v === 'number' ? v > 0 : v.t > 0))) applyStatus(f, L.el, L.base);
  }
}
function chainShow(world, a, n, same) {
  floatText(world, a.x, a.y - 52, (n === 3 ? 'CHAIN FINISH!' : 'CHAIN ×2') + (same ? ' · RESONANCE' : ''), n === 3 ? '#ffd23f' : '#ffe9a8', 7);
  const G = window.GAME;
  if (G && a === world.player) {
    const pr = G.profile; pr.stats = pr.stats || {}; pr.stats.chains = (pr.stats.chains || 0) + (n === 2 ? 1 : 0); if (n === 3) pr.stats.chainFinish = (pr.stats.chainFinish || 0) + 1;
    const t = performance.now();
    if (typeof cuePlay === 'function' && (n === 3 || !(chainShow.at && t - chainShow.at < 3000))) { chainShow.at = t; cuePlay(n === 3 ? [523, 659, 784] : [523, 659]); }
    if (typeof tipEvent === 'function') tipEvent(G, 'chain');
  } else if (G && a.netGid && typeof netStatTo === 'function') netStatTo(G, a.netGid, n === 3 ? 'chainFinish' : 'chains');
}
// the link chip on your other ready spell slots while the chain window is open (top-right corner; reacthint.js uses the left)
{
  const dsb = drawSpellBar;
  drawSpellBar = (a, keysLbl, cx, y, now) => {
    const r = dsb(a, keysLbl, cx, y, now), G = window.GAME, w = G && G.world;
    if (!w || a !== w.player || !a.chainN || !a.spells || (typeof SET !== 'undefined' && SET.hints === false)) return r;
    const left = a.chainLeft || 0; if (left <= 0) return r;   // (plain values, so a co-op friend's own slots show it too)
    const s = SLOT, gap = 5, W = (30 + 3 * s + 2 * gap) * 2, x0 = cx - W / 2;
    for (let i = 0; i < 3; i++) {
      if (i === a.chainSlot || !a.spells[i] || (a.cds[i] || 0) > 0) continue;
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = Math.min(1, left / 400);
      ctx.translate(Math.round(x0 + i * (s + gap) + s - 9), Math.round(y + 1 + Math.sin(now / 200 + i) * 0.8)); ctx.scale(1.3, 1.3);
      reactChip(REACT_CHIPS.CHAIN[0], REACT_CHIPS.CHAIN[1]); ctx.restore();
    }
    return r;
  };
}
