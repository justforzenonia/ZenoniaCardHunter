'use strict';
// NEW ITEMS: gear and cards you have not looked at yet carry a small gold dot in the Bag and the Card Collection, and the BAG and
// CARDS tabs get a dot while any wait there. pr.invKnown lists the uids you have seen (started from everything you own the first
// time, so an old hero starts with no dots). An item counts as seen once you point at it or select it, and leaving the tab marks
// everything on that tab as seen.
// CARD SORT (O on the Card Collection page, pr.cardSort): by rank (as before), by element, or newest first. Fusion cards stay first.
const INV_NEW = { col: '#ffd23f' };
let invKnownCache = { arr: null, n: -1, set: null };
function invKnown(pr) {
  if (!pr.invKnown) pr.invKnown = [...pr.gear.map(g => g.uid), ...pr.cards.map(c => c.uid)];
  if (invKnownCache.arr !== pr.invKnown || invKnownCache.n !== pr.invKnown.length) invKnownCache = { arr: pr.invKnown, n: pr.invKnown.length, set: new Set(pr.invKnown) };
  return invKnownCache.set;
}
const invIsNew = (pr, uid) => !invKnown(pr).has(uid);
function invSee(pr, uids) { const K = invKnown(pr); for (const u of uids) if (u && !K.has(u)) { pr.invKnown.push(u); K.add(u); } invKnownCache.n = pr.invKnown.length; }
const invNewGear = pr => pr.gear.filter(g => invIsNew(pr, g.uid)).length;
const invNewCards = pr => pr.cards.filter(c => invIsNew(pr, c.uid)).length;
function invDot(x, y) {
  ctx.fillStyle = 'rgba(10,8,18,0.9)'; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INV_NEW.col; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
}
{
  const ui = updateInventory;
  updateInventory = (game, m) => {
    const pr = game.profile, before = m.tab;
    if (pr) {
      if (!m.invPruned) { m.invPruned = true; const own = new Set([...pr.gear.map(g => g.uid), ...pr.cards.map(c => c.uid)]); pr.invKnown = (pr.invKnown || [...own]).filter(u => own.has(u)); }
      if (m.tab === 'bag' && m.slotFilter !== 'goods') {
        const list = sortedGear(pr, m.slotFilter), G = BAG_GRID, seen = [list[m.cur] && list[m.cur].uid];
        for (let i = 0; i < G.cols * G.rows; i++) { const g = list[m.scroll * G.cols + i]; if (g && hovered(G.x + (i % G.cols) * G.cs, G.y + Math.floor(i / G.cols) * G.cs, G.cs - 4, G.cs - 4)) seen.push(g.uid); }
        invSee(pr, seen);
      }
      if (m.tab === 'cards') {
        const st = cardStacks(pr), G = CARD_GRID, seen = [];
        if (st[m.cur]) seen.push(...st[m.cur].cards.map(c => c.uid));
        for (let i = 0; i < G.cols * G.rows; i++) { const s = st[m.scroll * G.cols + i]; if (s && hovered(G.x + (i % G.cols) * G.cw, G.y + Math.floor(i / G.cols) * G.ch, G.cw - 8, G.ch - 14)) seen.push(...s.cards.map(c => c.uid)); }
        invSee(pr, seen);
        if (hit('KeyO')) { consume('KeyO'); pr.cardSort = ((pr.cardSort || 0) + 1) % CARD_SORTS.length; m.cur = 0; m.scroll = 0; game.save(); game.toast(`Cards sorted by ${CARD_SORTS[pr.cardSort]}`, '#c9c1a8'); return; }
      }
    }
    const r = ui(game, m);
    if (pr && game.menu === m && m.tab !== before) {
      if (before === 'bag') invSee(pr, pr.gear.map(g => g.uid));
      if (before === 'cards') invSee(pr, pr.cards.map(c => c.uid));
    }
    return r;
  };
  const db = drawBagPage;
  drawBagPage = (game, m, now) => {
    const r = db(game, m, now), pr = game.profile; if (!pr || m.slotFilter === 'goods') return r;
    const list = sortedGear(pr, m.slotFilter), G = BAG_GRID;
    for (let i = 0; i < G.cols * G.rows; i++) { const g = list[m.scroll * G.cols + i]; if (g && invIsNew(pr, g.uid)) invDot(G.x + (i % G.cols) * G.cs + 4, G.y + Math.floor(i / G.cols) * G.cs + 4); }
    return r;
  };
  const dc = drawCardsPage;
  drawCardsPage = (game, m, now) => {
    const r = dc(game, m, now), pr = game.profile; if (!pr) return r;
    const st = cardStacks(pr), G = CARD_GRID;
    for (let i = 0; i < G.cols * G.rows; i++) { const s = st[m.scroll * G.cols + i]; if (s && s.cards.some(c => invIsNew(pr, c.uid))) invDot(G.x + (i % G.cols) * G.cw + 3, G.y + Math.floor(i / G.cols) * G.ch + 3); }
    return r;
  };
  const di = drawInventory;
  drawInventory = (game, m, now) => {
    const r = di(game, m, now), pr = game.profile; if (!pr || m.tooltip) return r;
    for (const [id, n] of [['bag', invNewGear(pr)], ['cards', invNewCards(pr)]]) {
      if (!n || m.tab === id) continue; const t = INV_TABS.find(x => x.id === id); if (t) invDot(t.x + INV_TAB.w - 6, BOOK.y - 12);
    }
    return r;
  };
}
const CARD_SORTS = ['rank', 'element', 'newest'];
{
  const sc = sortedCards;
  sortedCards = pr => {
    const k = (pr && pr.cardSort) || 0; if (!k) return sc(pr);
    const at = new Map(pr.cards.map((c, i) => [c, i])), fz = (a, b) => (b.fusion ? 1 : 0) - (a.fusion ? 1 : 0);
    return pr.cards.slice().sort(k === 1 ? (a, b) => fz(a, b) || String(cardElement(a)).localeCompare(cardElement(b)) || b.tier - a.tier : (a, b) => fz(a, b) || at.get(b) - at.get(a));
  };
}
// GEAR LOCKS (L on the Bag page, pr.gearLock): a locked piece shows a small gold padlock and cannot be sold, by X or by
// "sell weaker" (V). L again unlocks it.
const gearLocked = (pr, g) => !!g && (pr.gearLock || []).includes(g.uid);
{
  const ub = updateBagTab;
  updateBagTab = (game, m) => {
    const pr = game.profile;
    if (m.slotFilter !== 'goods') {
      const it = sortedGear(pr, m.slotFilter)[m.cur];
      if (it && hit('KeyL')) {
        consume('KeyL'); const L = pr.gearLock = (pr.gearLock || []).filter(u => pr.gear.some(g => g.uid === u)), i = L.indexOf(it.uid);
        if (i >= 0) L.splice(i, 1); else L.push(it.uid);
        m.confirm = null; game.save(); game.toast(i >= 0 ? `${it.name} unlocked` : `${it.name} locked: it can't be sold`, i >= 0 ? '#c9c1a8' : '#ffd860'); return;
      }
      if (it && gearLocked(pr, it) && hit('KeyX', 'Delete')) { consume('KeyX'); consume('Delete'); m.confirm = null; game.toast(`${it.name} is locked · L: unlock`, '#ffd27a'); return; }
    }
    return ub(game, m);
  };
  if (typeof weakerGear === 'function') { const wg = weakerGear; weakerGear = pr => wg(pr).filter(g => !gearLocked(pr, g)); }
  const db = drawBagPage;
  drawBagPage = (game, m, now) => {
    const r = db(game, m, now), pr = game.profile; if (!pr || m.slotFilter === 'goods' || !(pr.gearLock || []).length) return r;
    const list = sortedGear(pr, m.slotFilter), G = BAG_GRID;
    for (let i = 0; i < G.cols * G.rows; i++) { const g = list[m.scroll * G.cols + i]; if (gearLocked(pr, g)) drawLockMark(G.x + (i % G.cols) * G.cs + G.cs - 15, G.y + Math.floor(i / G.cols) * G.cs + G.cs - 16); }
    return r;
  };
}
// CARD COLLECTION: pointing at a card shows a small info card (name, rank, its spell, first passive and where it is used), and
// L locks it (the same lock as the Spell Deck page, deckplus.js pr.deckLock: N / Shift+N keep it). A locked card can't be sold
// or discarded, from the grid (X) or from its details (the copy that would go is checked, so a spare copy still can).
const cardLocked = (pr, c) => !!c && (pr.deckLock || []).includes(c.uid);
function cardInfoTip(pr, st, x, y) {
  const c = st.c, sp = c.fusion ? null : cardSpell(c), pv = cardPassives(c)[0], si = pr.spells.indexOf(c.uid);
  const where = c.fusion ? (pr.fusion === c.uid ? 'Your fusion card' : 'Fusion card') : si >= 0 ? `On spell ${'QER'[si]}` : st.cards.some(x => pr.deck.includes(x.uid)) ? 'In your deck' : 'Not in your deck';
  const L = [[`${cardName(c)}${st.n > 1 ? `  ×${st.n}` : ''}`, '#ffffff', 8.5], [`Rank ${RANKS[c.tier]} · ${ELEMENTS[cardElement(c)].name}`, rankColor(c.tier, performance.now()), 7]];
  if (sp) L.push([`${sp.name}: ${sp.stat || `${sp.power} pow`} · ${sp.mp} MP · ${(sp.cd / 1000).toFixed(1)}s`, '#9fd8ff', 7.5]);
  else if (c.fusion) L.push([`Fusion · ${c.fusion.length} monsters · power ${fusionPower(c)}`, '#ffb84a', 7.5]);
  if (pv) L.push([`${passiveName(pv)}: ${PASSIVES[pv.id].fmt(passiveValue(pv.id, pv.tier))}`, '#c8f0c0', 7.5]);
  L.push([where + (cardLocked(pr, c) ? ' · locked' : ''), '#d8c8a8', 7]);
  const w = Math.min(240, Math.max(...L.map(l => textW(l[0], l[2], false))) + 14), h = L.length * 11 + 6;
  const bx = Math.max(4, Math.min(x + 10, VW - w - 4)), by = Math.max(4, Math.min(y + 12, VH - h - 4));
  ctx.fillStyle = 'rgba(10,8,18,0.95)'; rrect(ctx, bx, by, w, h, 4); ctx.fill(); ctx.strokeStyle = '#8a94a8'; ctx.lineWidth = 0.8; rrect(ctx, bx + 0.4, by + 0.4, w - 0.8, h - 0.8, 4); ctx.stroke();
  L.forEach(([t, col, sz], i) => text(csFit(t, w - 12, sz), bx + 7, by + 9 + i * 11, col, sz, 'left'));
}
{
  const ui = updateInventory;
  updateInventory = (game, m) => {
    const pr = game.profile;
    if (pr && m.tab === 'cards' && !m.picker && m.fillSlot == null) {
      const stacks = cardStacks(pr), st = stacks[m.open != null ? m.open : m.cur];
      if (st && m.open == null && hit('KeyL')) { consume('KeyL'); deckLockToggle(game, st.c.uid); m.confirm = null; return; }
      if (st && hit('KeyX', 'Delete')) { const t = spareOf(pr, st) || st.c; if (cardLocked(pr, t)) { consume('KeyX'); consume('Delete'); m.confirm = null; game.toast(`${cardName(t)} is locked · L: unlock`, '#ffd27a'); return; } }
    }
    return ui(game, m);
  };
  const dc = drawCardsPage;
  drawCardsPage = (game, m, now) => {
    const r = dc(game, m, now), pr = game.profile; if (!pr) return r;
    const st = cardStacks(pr), G = CARD_GRID;
    for (let i = 0; i < G.cols * G.rows; i++) {
      const s = st[m.scroll * G.cols + i]; if (!s) continue; const x = G.x + (i % G.cols) * G.cw, y = G.y + Math.floor(i / G.cols) * G.ch;
      if (s.cards.some(c => cardLocked(pr, c))) drawLockMark(x + 1, y + 10);
      if (m.open == null && !m.tooltip && hovered(x, y, G.cw - 8, G.ch - 14)) m.tooltip = () => cardInfoTip(pr, s, mouse.x, mouse.y);
    }
    return r;
  };
}
// CARD FILTER (F on the Card Collection page, m.cardEl): shows only one element's cards, cycling through the elements you own and
// back to all. The page title names it. Only the Cards page is filtered (cardStacks checks the open menu), so its popup indexes,
// new-card dots and the deck page all stay in step.
{
  const cs = cardStacks;
  cardStacks = pr => {
    const L = cs(pr), M = window.GAME && GAME.menu;
    return M && M.type === 'inv' && M.tab === 'cards' && M.cardEl && GAME.profile === pr ? L.filter(s => cardElement(s.c) === M.cardEl) : L;
  };
  const ui = updateInventory;
  updateInventory = (game, m) => {
    const pr = game.profile;
    if (pr && m.tab === 'cards' && m.open == null && !m.picker && hit('KeyF')) {
      consume('KeyF'); const els = [null, ...[...new Set(pr.cards.filter(c => !c.fusion).map(c => cardElement(c)))].sort()], i = els.indexOf(m.cardEl || null);
      m.cardEl = els[(i + 1) % els.length]; m.cur = 0; m.scroll = 0; m.confirm = null;
      game.toast(m.cardEl ? `Showing ${ELEMENTS[m.cardEl].name} cards · F: next` : 'Showing all cards', '#c9c1a8'); return;
    }
    return ui(game, m);
  };
}
// BAG BORDER (the user's pick, 2026-11-07): on the Bag pages the book is warm brown with gold, like Storage and the shops, instead
// of steel. Every other tab keeps steel.
const BAG_LOOK = { fill: '#1e150e', page: '#2a1d13', line: '#c9a24a', soft: 'rgba(201,162,74,0.35)' };
// (redrawn calmer on 2026-11-07, "not too much going on": one thin gold line round the book, flat pages, a hairline between them)
{
  const dbc = drawBookChrome;
  drawBookChrome = (m, now) => {
    const r = dbc(m, now); if (m.tab !== 'bag') return r;
    const B = BOOK;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10 * RES; ctx.shadowOffsetY = 3 * RES;
    ctx.fillStyle = BAG_LOOK.fill; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.restore();
    ctx.strokeStyle = BAG_LOOK.line; ctx.lineWidth = 1.4; ctx.strokeRect(B.x + 1.5, B.y + 1.5, B.w - 3, B.h - 3);
    for (const P of [PAGE_L, PAGE_R]) { ctx.fillStyle = BAG_LOOK.page; ctx.fillRect(P.x, P.y, P.w, P.h); }
    ctx.strokeStyle = BAG_LOOK.soft; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(320, PAGE_L.y + 10); ctx.lineTo(320, PAGE_L.y + PAGE_L.h - 10); ctx.stroke();
    return r;
  };
}
