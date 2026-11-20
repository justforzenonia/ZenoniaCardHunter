'use strict';
// LOADOUTS (the Spell Deck page): three saved set-ups, each your deck, your Q / E / R spells and your fusion card
// (pr.loadouts = [{ deck, spells, fusion } | null] x3). The numbered buttons beside the SPELL DECK title: a click on an empty one
// saves what you have now, a click on a saved one puts it back on, Shift + click saves over it. The one you are on saves your changes
// as you make them (pr.loadoutOn), so switching never undoes a card you put on since. Cards you have since sold, fused
// or put in Storage are simply left out when a loadout goes back on.
const LOADOUT = { n: 3, x: 250, y: 62, w: 15, h: 13, gap: 3, col: '#ffd23f' };
const loadoutBtn = i => ({ x: LOADOUT.x + i * (LOADOUT.w + LOADOUT.gap), y: LOADOUT.y, w: LOADOUT.w, h: LOADOUT.h });
function loadoutsOf(pr) { pr.loadouts = pr.loadouts || []; while (pr.loadouts.length < LOADOUT.n) pr.loadouts.push(null); return pr.loadouts; }
const loadoutNow = pr => ({ deck: (pr.deck || []).slice(), spells: (pr.spells || []).slice(), fusion: pr.fusion || null });
const loadoutSame = (pr, L) => !!L && JSON.stringify(loadoutNow(pr)) === JSON.stringify(L);
function loadoutWear(game, L) {
  const pr = game.profile, own = new Set((pr.cards || []).map(c => c.uid)), keep = u => (u && own.has(u) ? u : null);
  pr.deck = (L.deck || []).filter(u => own.has(u)).slice(0, deckMax(pr));
  pr.spells = [0, 1, 2].map(i => keep((L.spells || [])[i]));
  for (const u of pr.spells) if (u && !pr.deck.includes(u) && pr.deck.length < deckMax(pr)) pr.deck.push(u);
  const f = keep(L.fusion); pr.fusion = f && (pr.cards.find(c => c.uid === f) || {}).fusion ? f : null;
  const missing = (L.deck || []).length - pr.deck.length; game.save(); game.refreshPlayer();
  return missing;
}
{
  const ud = updateDeckTab;
  updateDeckTab = (game, m) => {
    const pr = game.profile, Ls = loadoutsOf(pr);
    // THE LOADOUT YOU ARE ON KEEPS UP WITH YOU (2026-11-20, the user: "clicking load out unequps cards"): a loadout saved earlier put
    // back that older set-up, so a card put on since came off again. Now the loadout you are on saves every change as you make it,
    // and switching to another never loses what you had on this one.
    if (pr.loadoutOn == null) { const j = Ls.findIndex(L => loadoutSame(pr, L)); if (j >= 0) pr.loadoutOn = j; }
    const on = pr.loadoutOn; if (on != null && Ls[on] && !loadoutSame(pr, Ls[on])) Ls[on] = loadoutNow(pr);
    for (let i = 0; i < LOADOUT.n; i++) {
      const B = loadoutBtn(i); if (!clicked(B.x, B.y, B.w, B.h)) continue;
      mouse.click = false;
      if (i === on && Ls[i]) { game.toast(`Loadout ${i + 1} is on: your changes save to it as you go`, LOADOUT.col); }
      else if (!Ls[i] || isDown('ShiftLeft', 'ShiftRight')) { Ls[i] = loadoutNow(pr); pr.loadoutOn = i; game.save(); game.toast(`Loadout ${i + 1} saved and on: ${Ls[i].deck.length} cards`, LOADOUT.col); }
      else { const miss = loadoutWear(game, Ls[i]); pr.loadoutOn = i; game.toast(`Loadout ${i + 1} on${miss > 0 ? ` (${miss} card${miss > 1 ? 's' : ''} no longer with you)` : ''}`, '#8fffd0'); }
      return;
    }
    return ud(game, m);
  };
  const dd = drawDeckPage;
  drawDeckPage = (game, m, now) => {
    const r = dd(game, m, now), pr = game.profile, Ls = loadoutsOf(pr);
    for (let i = 0; i < LOADOUT.n; i++) {
      const B = loadoutBtn(i), L = Ls[i], on = loadoutSame(pr, L), hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
      ctx.fillStyle = on ? 'rgba(255,210,63,0.35)' : L ? 'rgba(120,90,30,0.55)' : 'rgba(30,20,13,0.8)'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill();
      ctx.strokeStyle = on || hov ? LOADOUT.col : L ? '#a08040' : '#583a25'; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 3); ctx.stroke();
      text(String(i + 1), B.x + B.w / 2, B.y + B.h / 2 + 0.5, L ? '#ffffff' : '#a8a090', 7.5);
      if (hov) { const syn = L && typeof deckSynergy === 'function' ? deckSynText(deckSynergy(pr, L.deck)) : [], t = `Loadout ${i + 1} · ${L ? (pr.loadoutOn === i ? 'on now: your changes save to it' : `${syn.length ? syn[0] + ' · ' : ''}click: switch to it`) : 'click: start it from this set-up'}`, tw = textW(t, 7) + 10, tx = Math.max(4, Math.min(B.x + B.w, PAGE_L.x + PAGE_L.w - 6) - tw);
        ctx.fillStyle = 'rgba(10,8,18,0.94)'; rrect(ctx, tx, B.y + B.h + 2, tw, 13, 3); ctx.fill(); text(t, tx + tw / 2, B.y + B.h + 9, '#ffe9b0', 7); }
    }
    return r;
  };
}
// NEW MOVES filter on the Spell Deck page: a gold ✦ chip after ALL shows only cards with a new move (arcana2.js ARCANA2),
// when you hold any. Element chips keep working as before.
{
  const tc = tfChips;
  tfChips = pr => {
    const out = tc(pr); if (typeof ARCANA2 === 'undefined' || !cardStacks(pr).some(x => x.c && ARCANA2[x.c.sp])) return out;
    out.splice(1, 0, { id: 'newmove', label: '✦', w: 12, col: '#ffd860' });
    let x = PAGE_L.x + PAGE_L.w - 10; for (let i = out.length - 1; i >= 0; i--) { x -= out[i].w; out[i].x = x; x -= 2; }
    return out;
  };
  const tl = tfList;
  tfList = (pr, m) => m.elFilter === 'newmove' ? cardStacks(pr).filter(x => x.c && ARCANA2[x.c.sp]) : tl(pr, m);
}
