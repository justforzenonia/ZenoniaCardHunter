'use strict';
// AN EASIER WAY TO PICK PARTNER SKILLS (2026-11-13, the user's list: "better way to pick out partner skills"). The Bond Card list
// was one long scroll of up to 99 cards, five at a time, in level order.
//   KINDS     five little tabs under the card on the choosing screen: ALL · HIT · GUARD · HEAL · BOOST (Q / E, LB / RB, or click).
//             A card's kind comes from what it does (the last word of its name: Burst, Lance, Rain hit; Cry, Bulwark, Ward guard…).
//   ORDER     the cards you own come strongest first (rank, then the later, harder-hitting cards), the ones still to come last.
//   AUTO      on the Bond Cards page, AUTO (V) fills all six slots with a balanced set from what you own: three that hit, one that
//             guards, one that heals and one that boosts (a slot with no card of that kind takes the next strongest).
const BOND_KINDS = [
  { id: 'all', label: 'ALL' }, { id: 'hit', label: 'HIT', col: '#ff9a7a' }, { id: 'guard', label: 'GUARD', col: '#b8c8ff' },
  { id: 'heal', label: 'HEAL', col: '#8fffb0' }, { id: 'boost', label: 'BOOST', col: '#ffd27a' }];
const BOND_KIND_OF = { Burst: 'hit', Lance: 'hit', Rain: 'hit', Cry: 'guard', Bulwark: 'guard', Ward: 'guard', Light: 'heal', Purge: 'heal', Anthem: 'boost', Tempo: 'boost', Focus: 'boost' };
const BOND_STARTER_KIND = { rally: 'guard', iron: 'guard', mend: 'heal' };
function bondKind(c) { return BOND_STARTER_KIND[c.id] || BOND_KIND_OF[String(c.name).split(' ').pop()] || 'hit'; }
const bondStrength = (P, c) => bondRank(P, c.id) * 1000 + (c.lv || 0);
const bondChip = i => { const w = 36, gap = 2, x0 = PU_L.x + (PU_L.w - (w * 5 + gap * 4)) / 2; return { x: x0 + i * (w + gap), y: PU_L.y + 238, w, h: 12 }; };
const bondAutoBtn = () => ({ x: PU_R.x + PU_R.w - 136, y: PU_R.y + 250, w: 58, h: 16, label: 'AUTO (V)', primary: false, col: '#8fffd0' });
function bondAutoPick(game) {
  const P = partnerOf(game.profile), B = bondOf(P);
  const own = BOND_ALL.filter(c => bondOwned(P, c)).sort((a, b) => bondStrength(P, b) - bondStrength(P, a));
  const out = [], take = kind => { const c = own.find(q => !out.includes(q.id) && (!kind || bondKind(q) === kind)); if (c) out.push(c.id); };
  ['hit', 'guard', 'heal', 'boost', 'hit', 'hit'].forEach(take);
  while (out.length < BOND.slots && out.length < own.length) take(null);
  while (out.length < BOND.slots) out.push(null);
  B.on = out; game.save();
  game.toast(`${P.name}: a balanced set of Bond Cards — 3 hit, 1 guards, 1 heals, 1 boosts`, '#8fffd0');
}
{
  const br = bondRows;
  bondRows = (P, pick) => {
    const rows = br(P, pick); if (pick.kind !== 'bond') return rows;
    const f = BOND_KINDS[pick.f || 0].id, none = rows.filter(r => r.none), own = rows.filter(r => r.c && !r.locked), later = rows.filter(r => r.locked);
    const keep = r => f === 'all' || bondKind(r.c) === f;
    own.sort((a, b) => (b.c.id === bondOf(P).on[pick.slot]) - (a.c.id === bondOf(P).on[pick.slot]) || bondStrength(P, b.c) - bondStrength(P, a.c));
    return [...none, ...own.filter(keep), ...later.filter(keep)];
  };
  const up = updateBondPick;
  updateBondPick = (game, m) => {
    const pick = m.pick;
    if (pick && pick.kind === 'bond' && !pick.ask) {
      let f = pick.f || 0;
      if (hit('KeyE')) f = (f + 1) % BOND_KINDS.length; else if (hit('KeyQ')) f = (f + BOND_KINDS.length - 1) % BOND_KINDS.length;
      BOND_KINDS.forEach((_, i) => { const C = bondChip(i); if (clicked(C.x, C.y, C.w, C.h)) { f = i; mouse.click = false; } });
      if (f !== (pick.f || 0)) { pick.f = f; pick.cur = 0; pick.scroll = 0; return; }
    }
    return up(game, m);
  };
  const dp = drawBondPick;
  drawBondPick = (game, m, now) => {
    const r = dp(game, m, now), pick = m.pick; if (!pick || pick.kind !== 'bond' || pick.ask) return r;
    BOND_KINDS.forEach((K, i) => {
      const C = bondChip(i), on = (pick.f || 0) === i;
      ctx.fillStyle = on ? 'rgba(255,216,96,0.9)' : 'rgba(40,26,16,0.92)'; rrect(ctx, C.x, C.y, C.w, C.h, 3); ctx.fill();
      ctx.strokeStyle = on ? '#fff3c8' : (K.col || '#8a7a62'); ctx.lineWidth = 0.8; rrect(ctx, C.x + 0.4, C.y + 0.4, C.w - 0.8, C.h - 0.8, 3); ctx.stroke();
      text(K.label, C.x + C.w / 2, C.y + C.h / 2 + 0.5, on ? '#2a1808' : (K.col || '#e8e0d0'), 7);
    });
    return r;
  };
  const ut = updateBondTab;
  updateBondTab = (game, m, k) => {
    const A = bondAutoBtn();
    if (hit('KeyV') || clicked(A.x, A.y, A.w, A.h)) { bondAutoPick(game); mouse.click = false; return; }
    return ut(game, m, k);
  };
  const dt = drawBondTab;
  drawBondTab = (game, m, now, ...rest) => { const r = dt(game, m, now, ...rest); popupButton(bondAutoBtn(), now); return r; };
}
