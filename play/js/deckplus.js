'use strict';
// A BIGGER DECK AS YOU GROW: the deck holds 10 cards, and one more at levels 15, 30, 45, 60 and 75 (15 at most). Every place that
// used to stop at 10 asks deckMax(pr) instead (inventory, summons, pickups, home storage, loadouts).
const DECK_GROW = { base: 10, at: [15, 30, 45, 60, 75] };
const deckMax = pr => DECK_GROW.base + DECK_GROW.at.filter(l => ((pr && pr.lv) || 1) >= l).length;
// DECK SYNERGIES: the whole deck (up to its size, inventory.js / defs.js pr.deck) now counts, not only Q / E / R.
//   ELEMENT FOCUS  4+ cards of one element: that element's spells hit 10% harder (6+: 20%)
//   NEW MOVES      3+ cards with a new move (arcana2.js): their cooldowns 10% shorter (5+: 15%)
//   RAINBOW        6+ different elements in the deck: every spell 6% harder
//   MONSTER PACK   6+ monster cards: 10% more max HP
// Worked out from the deck (cached by its card list) and applied to your own hero only: spell power as you cast (a castSpell
// wrapper), the cooldown after the cast, max HP in profileStats. The deck page shows what is active on a dark strip under the cards.
const DECK_SYN = { focus: [[6, 0.2], [4, 0.1]], newcd: [[5, 0.85], [3, 0.9]], rainbow: { n: 6, pct: 0.06 }, pack: { n: 6, hp: 0.1 }, friends: { n: 3, mul: 1.1 }, helpers: { n: 2, cd: 0.9 } };
//   VILLAGE FRIENDS 3+ villager cards: your partner has 10% more HP and attack   HELPING HANDS 2+ heal / buff cards: their cooldowns 10% shorter
let deckSynCache = { key: null, val: null };
function deckSynergy(pr, deckList) {   // (deckList: any card list, e.g. a saved loadout's; the deck by default)
  if (!pr) return {};
  const DL = deckList || pr.deck || [], key = DL.join(',') + '|' + (pr.cards || []).length;
  if (deckSynCache.key === key) return deckSynCache.val;
  const cards = DL.map(u => (pr.cards || []).find(c => c.uid === u)).filter(Boolean);
  const els = {}; let newMoves = 0, monsters = 0, villagers = 0, helpers = 0;
  for (const c of cards) {
    const e = cardElement(c); els[e] = (els[e] || 0) + 1;
    if (typeof ARCANA2 !== 'undefined' && ARCANA2[c.sp]) newMoves++;
    if (!c.fusion && SPECIES[c.sp] && !SPECIES[c.sp].arcana && D.monsters[c.sp] && !(typeof NPC_CARDS !== 'undefined' && NPC_CARDS[c.sp])) monsters++;
    if (typeof NPC_CARDS !== 'undefined' && NPC_CARDS[c.sp]) villagers++;
    if (SPECIES[c.sp] && SPECIES[c.sp].support) helpers++;
  }
  const out = {}, top = Object.entries(els).sort((a, b) => b[1] - a[1])[0];
  if (top) { const F = DECK_SYN.focus.find(f => top[1] >= f[0]); if (F) out.focus = { el: top[0], pct: F[1], n: top[1] }; }
  { const N = DECK_SYN.newcd.find(f => newMoves >= f[0]); if (N) out.newcd = { mul: N[1], n: newMoves }; }
  if (Object.keys(els).length >= DECK_SYN.rainbow.n) out.rainbow = { pct: DECK_SYN.rainbow.pct, n: Object.keys(els).length };
  if (monsters >= DECK_SYN.pack.n) out.pack = { hp: DECK_SYN.pack.hp, n: monsters };
  if (villagers >= DECK_SYN.friends.n) out.friends = { mul: DECK_SYN.friends.mul, n: villagers };
  if (helpers >= DECK_SYN.helpers.n) out.helpers = { cd: DECK_SYN.helpers.cd, n: helpers };
  // one card short of a synergy: what to add (shown on the deck page)
  const near = [];
  if (top && top[1] === 3) near.push(`1 more ${ELEMENTS[top[0]].name.toLowerCase()} card for ${ELEMENTS[top[0]].name} focus`);
  if (newMoves === 2) near.push('1 more gold-dot card for New moves');
  if (Object.keys(els).length === 5) near.push('1 more element for Rainbow');
  if (monsters === 5) near.push('1 more monster card for Monster pack');
  if (villagers === 2) near.push('1 more villager card for Village friends');
  if (helpers === 1) near.push('1 more heal / buff card for Helping hands');
  out.near = near;
  deckSynCache = { key, val: out }; return out;
}
function deckSynText(S) {
  const L = [];
  if (S.focus) L.push(`${ELEMENTS[S.focus.el].name} focus +${Math.round(S.focus.pct * 100)}%`);
  if (S.newcd) L.push(`new moves −${Math.round((1 - S.newcd.mul) * 100)}% cooldown`);
  if (S.rainbow) L.push(`rainbow +${Math.round(S.rainbow.pct * 100)}% spells`);
  if (S.pack) L.push(`monster pack +${Math.round(S.pack.hp * 100)}% HP`);
  if (S.friends) L.push(`village friends: partner +${Math.round((S.friends.mul - 1) * 100)}%`);
  if (S.helpers) L.push(`helping hands −${Math.round((1 - S.helpers.cd) * 100)}% cooldown`);
  return L;
}
{
  const cs = castSpell;
  castSpell = (world, a, sp, ...rest) => {
    const G = window.GAME, pr = G && G.profile;
    if (pr && a && world === G.world && a === world.player && sp && sp.sup) { const S2 = deckSynergy(pr), sl = a.castSlot, rr = cs(world, a, sp, ...rest); if (S2.helpers && sl != null && a.cds && a.cds[sl] > 0) a.cds[sl] *= S2.helpers.cd; return rr; }
    if (!pr || !a || world !== G.world || a !== world.player || !sp || sp.sup) return cs(world, a, sp, ...rest);
    const S = deckSynergy(pr); let mul = 1;
    if (S.focus && sp.el === S.focus.el) mul *= 1 + S.focus.pct;
    if (S.rainbow) mul *= 1 + S.rainbow.pct;
    if (mul !== 1) sp = { ...sp, power: Math.round(sp.power * mul) };
    const slot = a.castSlot, r = cs(world, a, sp, ...rest);
    if (S.newcd && slot != null && a.cds && a.cds[slot] > 0 && typeof ARCANA2 !== 'undefined' && ARCANA2[sp.sp]) a.cds[slot] *= S.newcd.mul;
    return r;
  };
  const ps = profileStats;
  profileStats = pr => { const st = ps(pr), S = deckSynergy(pr); if (S.pack && st) st.hp = Math.round(st.hp * (1 + S.pack.hp)); return st; };
  const dd = drawDeckPage;
  drawDeckPage = (game, m, now) => {
    const r = dd(game, m, now), pr = game.profile;
    if (!pr || m.slotPick != null || m.inspect || m.circuit || m.picker || (typeof tfHovered === 'function' && tfHovered(pr, m))) return r;
    const SY = deckSynergy(pr), L = deckSynText(SY); if (pr.drawPile) L.unshift('DRAW PILE ON (K)');
    const full = L.slice(), near = SY.near || [];
    { const fit = A => textW(`SYNERGY: ${A.join(' · ')}`, 7) + 12 <= PAGE_L.w - 16; let n = 0; while (L.length > 1 && !fit(n ? [...L, `+${n} more`] : L)) { L.pop(); n++; } if (n) L.push(`+${n} more`); }
    const y = TF.scroll.y + TF.scroll.ch + 9 + 4, t = L.length ? `${pr.drawPile ? '' : 'SYNERGY: '}${L.join(' · ')}` : (SY.near && SY.near.length ? `Almost: ${SY.near[0]}` : 'No synergy yet: 4 of one element, or 6 elements');
    const t2 = L.length && SY.near && SY.near.length && textW(t + ' · almost: ' + SY.near[0], 7) + 12 <= PAGE_L.w - 16 ? ' · almost: ' + SY.near[0] : '';
    const tw = PAGE_L.w - 16;   // (full width: it covers the page's own hint line)
    ctx.fillStyle = '#1a110b'; rrect(ctx, PAGE_L.x + PAGE_L.w / 2 - tw / 2, y - 8, tw, 16, 4); ctx.fill();
    text(t + t2, PAGE_L.x + PAGE_L.w / 2, y, L.length ? '#ffd860' : SY.near && SY.near.length ? '#9fe8ff' : '#c9c1a8', 7);
    if ((full.length > L.length || near.length > 1 || (near.length && !t2 && L.length)) && hovered(PAGE_L.x + 8, y - 8, tw, 16)) {
      const R = [...full.map(x => [x, '#ffd860']), ...near.map(x => ['almost: ' + x, '#9fe8ff'])], w = Math.max(...R.map(r => textW(r[0], 7))) + 14, h = R.length * 10 + 6, bx = PAGE_L.x + PAGE_L.w / 2 - w / 2, by = y - 10 - h;
      ctx.fillStyle = 'rgba(10,8,18,0.95)'; rrect(ctx, bx, by, w, h, 3); ctx.fill(); ctx.strokeStyle = '#5a5040'; ctx.lineWidth = 0.8; rrect(ctx, bx + 0.4, by + 0.4, w - 0.8, h - 0.8, 3); ctx.stroke();
      R.forEach(([x, col], i) => text(x, bx + 7, by + 8 + i * 10, col, 7, 'left'));
    }
    return r;
  };
}
// the element chips above your cards narrow down when there are many, so they never run over the SPELLS count (inventory.js tfChips)
{
  const tc = tfChips;
  tfChips = pr => {
    const out = tc(pr), room = PAGE_L.w - 10 - 142, total = out.reduce((a, c) => a + c.w, 0) + 2 * (out.length - 1);
    if (total <= room || out.length < 3) return out;
    const fixed = out[0].w, cw = Math.max(9, Math.floor((room - fixed - (out.length - 1)) / (out.length - 1)));
    for (let i = 1; i < out.length; i++) out[i].w = cw;
    let x = PAGE_L.x + PAGE_L.w - 10; for (let i = out.length - 1; i >= 0; i--) { x -= out[i].w; out[i].x = x; x -= 1; }
    return out;
  };
}
// EASIER DECK BUILDING (the Spell Deck page): N fills the deck with your best cards (highest rank, then most passives, then power;
// one of each kind; your Q / E / R spells and the cards already there stay first); O cycles how your cards are listed
// (newest, rank, element, power: m.tfSort). The circuit's PASSIVES page already adds up what the deck gives.
const DECK_SORTS = ['newest', 'rank', 'element', 'power'];
// the cards N / Shift+N always keep: your Q / E / R spells, then the cards you locked (L)
function deckKeep(pr) {
  const own = u => u && pr.cards.some(c => c.uid === u && !c.fusion), out = [];
  for (const u of [...(pr.spells || []), ...(pr.deckLock || [])]) if (own(u) && !out.includes(u)) out.push(u);
  return out.slice(0, deckMax(pr));
}
function bestDeck(game) {
  const pr = game.profile, max = deckMax(pr), keep = deckKeep(pr);
  const score = c => (c.tier || 0) * 1000 + cardPassives(c).length * 100 + ((cardSpell(c) || {}).power || 0) / 10;
  const kinds = new Set(keep.map(u => (pr.cards.find(c => c.uid === u) || {}).sp)), deck = keep.slice();
  for (const c of pr.cards.filter(c => !c.fusion && !deck.includes(c.uid)).sort((a, b) => score(b) - score(a))) {
    if (deck.length >= max) break; if (kinds.has(c.sp)) continue; kinds.add(c.sp); deck.push(c.uid);
  }
  const same = deck.length === pr.deck.length && deck.every(u => pr.deck.includes(u));
  pr.deck = deck; game.save(); game.refreshPlayer();
  game.toast(same ? 'Your deck is already your best' : `Best deck: ${deck.length} cards, your spells${(pr.deckLock || []).length ? ' and locked cards' : ''} kept`, '#8fffd0');
}
{
  const ud = updateDeckTab;
  updateDeckTab = (game, m) => {
    if (!m.circuit && !m.picker) {
      if (hit('KeyN')) { consume('KeyN'); if (isDown('ShiftLeft', 'ShiftRight')) focusDeck(game); else bestDeck(game); return; }
      if (hit('KeyO')) { consume('KeyO'); m.tfSort = ((m.tfSort || 0) + 1) % DECK_SORTS.length; m.sx = 0; game.toast(`Cards sorted by ${DECK_SORTS[m.tfSort]}`, '#c9c1a8'); return; }
    }
    return ud(game, m);
  };
  const tl = tfList;
  tfList = (pr, m) => {
    const L = tl(pr, m), k = m.tfSort || 0; if (!k) return L;
    const by = k === 1 ? (a, b) => (b.c.tier || 0) - (a.c.tier || 0) : k === 2 ? (a, b) => String(cardElement(a.c)).localeCompare(cardElement(b.c)) : (a, b) => ((cardSpell(b.c) || {}).power || 0) - ((cardSpell(a.c) || {}).power || 0);
    return L.slice().sort(by);
  };
}
// DRAW PILE (optional: K on the Spell Deck page, pr.drawPile): your Q / E / R start as set, the rest of the deck is shuffled into a
// pile, and each spell you cast from a slot goes to the bottom of the pile while the top card takes its place (keeping that slot's
// cooldown). Every card in the deck gets played, and spells cast in this mode hit DRAW_PILE.mul harder. Your own hero only; the
// pile lives on the hero in the fight (a.slotUids, a.pile) and starts again whenever the hero is rebuilt. The HUD shows NEXT.
const DRAW_PILE = { mul: 1.1 };
function drawPileInit(pr, a) {
  if (a.pile) return;
  a.slotUids = (pr.spells || []).slice(0, 3);
  const own = u => (pr.cards || []).find(c => c.uid === u);
  a.pile = (pr.deck || []).filter(u => !a.slotUids.includes(u) && own(u) && !own(u).fusion).sort(() => Math.random() - 0.5);
}
{
  const cs = castSpell;
  castSpell = (world, a, sp, ...rest) => {
    const G = window.GAME, pr = G && G.profile, slot = a && a.castSlot;
    if (!pr || !pr.drawPile || !a || world !== G.world || a !== world.player || slot == null || !sp || sp.sup || sp.echoed || a.spells[slot] !== sp) return cs(world, a, sp, ...rest);
    drawPileInit(pr, a);
    const r = cs(world, a, { ...sp, power: Math.round(sp.power * DRAW_PILE.mul) }, ...rest);
    if (a.pile.length) {
      const next = a.pile.shift(), card = (pr.cards || []).find(c => c.uid === next);
      if (a.slotUids[slot]) a.pile.push(a.slotUids[slot]);
      if (card) { a.slotUids[slot] = next; a.spells[slot] = cardSpell(card); a.drawFlip = { slot, t: performance.now() }; if (typeof cuePlay === 'function') cuePlay([587, 784]); }   // (the slot flips on the HUD: arcana2gift.js)
    }
    return r;
  };
  const ud = updateDeckTab;
  updateDeckTab = (game, m) => {
    if (!m.circuit && !m.picker && hit('KeyK')) { consume('KeyK'); const pr = game.profile; pr.drawPile = !pr.drawPile; game.save(); game.refreshPlayer();
      game.toast(pr.drawPile ? 'Draw pile ON: your spells rotate through the whole deck as you cast (+10% power)' : 'Draw pile off: Q / E / R stay as you set them', pr.drawPile ? '#ffd860' : '#c9c1a8'); return; }
    return ud(game, m);
  };
}
{  // VILLAGE FRIENDS: the partner's stats (heropartner.js partnerStats)
  const pst = partnerStats;
  partnerStats = P => { const St = pst(P), S = deckSynergy(window.GAME && GAME.profile); if (S.friends && St) { St.hp = Math.round(St.hp * S.friends.mul); St.atk = St.atk * S.friends.mul; } return St; };
}
// Shift + N: a FOCUS deck round the element you own the most cards of: as many of its best as fit (6 for the bigger focus), then the
// best of the rest; your Q / E / R spells stay
function focusDeck(game) {
  const pr = game.profile, max = deckMax(pr), keep = deckKeep(pr);
  const pool = pr.cards.filter(c => !c.fusion), count = {}; for (const c of pool) { const e = cardElement(c); count[e] = (count[e] || 0) + 1; }
  const el = Object.entries(count).sort((a, b) => b[1] - a[1])[0]; if (!el) return bestDeck(game);
  const score = c => (c.tier || 0) * 1000 + cardPassives(c).length * 100 + ((cardSpell(c) || {}).power || 0) / 10;
  const deck = keep.slice(), kinds = new Set(keep.map(u => (pr.cards.find(c => c.uid === u) || {}).sp));
  const add = list => { for (const c of list) { if (deck.length >= max) return; if (deck.includes(c.uid) || kinds.has(c.sp)) continue; kinds.add(c.sp); deck.push(c.uid); } };
  add(pool.filter(c => cardElement(c) === el[0]).sort((a, b) => score(b) - score(a)));
  add(pool.slice().sort((a, b) => score(b) - score(a)));
  pr.deck = deck; game.save(); game.refreshPlayer(); deckSynCache = { key: null };
  const S = deckSynergy(pr); game.toast(`${ELEMENTS[el[0]].name} focus deck: ${deck.length} cards${S.focus ? ` (${ELEMENTS[S.focus.el].name} focus +${Math.round(S.focus.pct * 100)}%)` : ' (not enough of one element for a focus yet)'}`, '#8fffd0');
}
// DECK ARCHITECT: a title for a deck with three or more synergies running at once (titles.js checks it once a second)
const deckSynCount = pr => { const S = deckSynergy(pr); return ['focus', 'newcd', 'rainbow', 'pack', 'friends', 'helpers'].filter(k => S[k]).length; };
if (typeof TITLE_BY !== 'undefined' && !TITLE_BY.architect) {
  const t = { id: 'architect', name: 'Deck Architect', tier: 2, how: 'Have 3 deck synergies at once', prog: pr => [Math.min(3, deckSynCount(pr)), 3] };
  TITLE_LIST.push(t); TITLE_BY.architect = t; TITLE_PASSIVES.architect = ['mana', 'crit', 'swift'];
}
// LOCKS (L on the Spell Deck page, pr.deckLock): a locked card stays in the deck whenever N or Shift + N rebuild it (locking a card
// that is not in the deck puts it in, when there is room). A small gold padlock marks it on the card.
// UNDO (U or Ctrl + Z on the Spell Deck page, the DECK circuit too): takes back the last change to your deck, spells or fusion card,
// up to DECK_UNDO.n steps; the list is kept while the book is open (m.deckUndo).
// ELEMENT COUNT: a small DECK column right of the R slot lists each element in the deck (its symbol and how many cards), most first;
// point at it for the element names. (It was a colour bar first, which read as a mystery to a new player.)
const DECK_UNDO = { n: 15 }, DECK_MIX = { x: PAGE_L.x + PAGE_L.w - 26, y: 124, w: 20, row: 12 };
function deckLockToggle(game, uid) {
  const pr = game.profile, L = pr.deckLock = (pr.deckLock || []).filter(u => pr.cards.some(c => c.uid === u)), i = L.indexOf(uid), c = pr.cards.find(x => x.uid === uid);
  if (!c || c.fusion) { game.toast('Fusion cards sit in their own socket: no lock needed', '#c9c1a8'); return; }
  if (i >= 0) { L.splice(i, 1); game.save(); game.toast(`${cardName(c)} unlocked`, '#c9c1a8'); return; }
  L.push(uid); let added = false;
  if (!pr.deck.includes(uid) && pr.deck.length < deckMax(pr)) { pr.deck.push(uid); added = true; game.refreshPlayer(); }
  game.save(); game.toast(`${cardName(c)} locked: it can't be sold, and N keeps it${added ? ' (added to your deck)' : pr.deck.includes(uid) ? '' : ' (your deck is full: N will make room)'}`, '#ffd860');
}
function drawLockMark(x, y) {
  ctx.fillStyle = 'rgba(10,8,18,0.9)'; rrect(ctx, x - 1, y - 1, 9, 10, 2); ctx.fill();
  ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + 3.5, y + 3.6, 2.1, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = '#ffd860'; ctx.fillRect(x + 0.5, y + 3.6, 6, 4.4);
}
function deckMix(pr) {
  const n = {}; for (const u of pr.deck || []) { const c = pr.cards.find(x => x.uid === u); if (c && !c.fusion) { const e = cardElement(c); n[e] = (n[e] || 0) + 1; } }
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
}
const deckSnap = pr => JSON.stringify([pr.deck || [], pr.spells || [], pr.fusion || null]);
{
  const ui = updateInventory;
  updateInventory = (game, m) => {
    const pr = game.profile; if (!pr || m.tab !== 'deck') return ui(game, m);
    if (m.open == null && !m.picker && (hit('KeyU') || (hit('KeyZ') && isDown('ControlLeft', 'ControlRight')))) {
      consume('KeyU'); consume('KeyZ'); const U = m.deckUndo || [];
      if (!U.length) { game.toast('Nothing to undo', '#c9c1a8'); return; }
      const synU = deckSynText(deckSynergy(pr)), [deck, spells, fusion] = JSON.parse(U.pop()), own = new Set(pr.cards.map(c => c.uid));
      pr.deck = deck.filter(u => own.has(u)); pr.spells = spells.map(u => (u && own.has(u) ? u : null)); pr.fusion = fusion && own.has(fusion) ? fusion : null;
      deckSynCache = { key: null }; game.save(); game.refreshPlayer(); game.toast(`Undone (${U.length} more step${U.length === 1 ? '' : 's'} back)`, '#9fe8ff'); deckSynNote(game, synU); return;
    }
    if (!m.circuit && !m.picker && m.open == null && hit('KeyL')) { const hc = tfHovered(pr, m); if (hc) { consume('KeyL'); const b = deckSnap(pr); const sb = deckSynText(deckSynergy(pr)); deckLockToggle(game, hc.uid); if (deckSnap(pr) !== b) { m.deckUndo = (m.deckUndo || []).concat(b).slice(-DECK_UNDO.n); deckSynNote(game, sb); } return; } }
    const before = deckSnap(pr), synB = deckSynText(deckSynergy(pr)), r = ui(game, m);
    if (game.menu === m && deckSnap(pr) !== before) { m.deckUndo = (m.deckUndo || []).concat(before).slice(-DECK_UNDO.n); deckSynNote(game, synB); }
    return r;
  };
  const dd = drawDeckPage;
  drawDeckPage = (game, m, now) => {
    const r = dd(game, m, now), pr = game.profile; if (!pr) return r;
    const lock = new Set((pr.deckLock || []).filter(u => pr.cards.some(c => c.uid === u)));
    if (lock.size) {
      const S = TF.slot; for (let i = 0; i < 3; i++) if (lock.has(pr.spells[i])) drawLockMark(S.xs[i] + 3, S.y + 3);
      const list = tfList(pr, m); for (let i = 0; i < tfVisible(); i++) { const st = list[(m.sx || 0) + i], p = tfScrollPos(i); if (st && st.cards.some(x => lock.has(x.uid))) drawLockMark(p.x + 2, p.y + 2); }
    }
    const M = DECK_MIX, mix = deckMix(pr), tot = mix.reduce((a, e) => a + e[1], 0);
    text('DECK', M.x + M.w / 2, M.y - 6, '#c8d0de', 7);
    const rows = Math.max(1, mix.length), ph = rows * M.row + 4;
    ctx.fillStyle = '#1c120c'; rrect(ctx, M.x, M.y - 1, M.w, ph, 3); ctx.fill();
    mix.forEach(([e, n], i) => { const y = M.y + 5 + i * M.row, col = TF_RING[e] || '#c8c8d8'; text(EL_GLYPH[e] || "•", M.x + 6, y, col, 8); text(String(n), M.x + M.w - 3, y, '#ffffff', 7.5, 'right'); });
    if (!tot) text('—', M.x + M.w / 2, M.y + 5, '#b8ae96', 7);
    if (tot && !m.circuit && !m.picker && hovered(M.x - 2, M.y - 10, M.w + 4, ph + 10)) {
      const L = [["Your deck's elements", '#ffe9b0'], ...mix.map(([e, n]) => [`${EL_GLYPH[e] || '•'} ${ELEMENTS[e].name}: ${n} card${n === 1 ? '' : 's'}`, TF_RING[e] || '#fff'])], w = Math.max(...L.map(l => textW(l[0], 7))) + 12, h = L.length * 10 + 6, bx = M.x - w - 4;
      ctx.fillStyle = 'rgba(10,8,18,0.95)'; rrect(ctx, bx, M.y - 1, w, h, 3); ctx.fill();
      L.forEach(([t, col], i) => text(t, bx + 6, M.y + 7 + i * 10, col, 7, 'left'));
    }
    return r;
  };
}
// SYNERGY NOTES: when a change on the Spell Deck page turns a synergy on, a gold toast names it with a soft three-note chime; one
// that switches off gets a quiet grey toast. (The synergy names without numbers are compared, so 4 to 6 cards of one element
// reads as the focus growing, not as a new one.)
const synName = x => x.replace(/[+−-]\d+%.*$/, '').trim();
function deckSynNote(game, before) {
  const pr = game.profile, now = deckSynText(deckSynergy(pr)), bn = before.map(synName), nn = now.map(synName);
  const on = now.filter((x, i) => !bn.includes(nn[i])), up = now.filter((x, i) => bn.includes(nn[i]) && !before.includes(x)), off = before.filter((x, i) => !nn.includes(bn[i]));
  if (on.length || up.length) { game.toast(`Synergy ${on.length ? 'on' : 'stronger'}: ${[...on, ...up].join(' · ')}`, '#ffd860'); if (typeof cuePlay === 'function') cuePlay([523, 659, 784]); }
  else if (off.length) game.toast(`Synergy off: ${off.map(synName).join(' · ')}`, '#c9c1a8');
}
// WHAT A CARD DOES TO YOUR SYNERGIES: pointing at a card on the Spell Deck page adds a line under its name and passive: a card not
// in your deck says which synergy it would add (when there is room), a card in it says which one taking it out would lose.
function deckSynDelta(pr, uid) {
  const inDeck = (pr.deck || []).includes(uid), c = pr.cards.find(x => x.uid === uid); if (!c || c.fusion) return null;
  if (!inDeck && pr.deck.length >= deckMax(pr)) return null;
  const cur = deckSynText(deckSynergy(pr)).map(synName), alt = deckSynText(deckSynergy(pr, inDeck ? pr.deck.filter(u => u !== uid) : [...pr.deck, uid]));
  deckSynergy(pr);
  if (inDeck) { const lost = cur.filter(n => !alt.map(synName).includes(n)); return lost.length ? ['Taking it out loses ' + lost.join(', '), '#ffb88a'] : null; }
  const gain = alt.filter(x => !cur.includes(synName(x))); return gain.length ? ['Adding it gives ' + gain.join(', '), '#8fffd0'] : null;
}
{
  const dd = drawDeckPage;
  drawDeckPage = (game, m, now) => {
    const r = dd(game, m, now), pr = game.profile;
    if (!pr || m.circuit || m.picker || m.open != null) return r;
    const hc = tfHovered(pr, m), D2 = hc && deckSynDelta(pr, hc.uid); if (!D2) return r;
    const y = TF.scroll.y + TF.scroll.ch + 9 + 18, w = Math.min(PAGE_L.w - 16, textW(D2[0], 7) + 12);
    ctx.fillStyle = '#1a110b'; rrect(ctx, PAGE_L.x + PAGE_L.w / 2 - w / 2, y - 4, w, 9, 3); ctx.fill();
    text(D2[0], PAGE_L.x + PAGE_L.w / 2, y, D2[1], 7);
    return r;
  };
}
// FINISH A SYNERGY (H on the Spell Deck page): looks for one card from your collection that turns on a synergy you do not have yet
// without losing any you have: added when the deck has room, else swapped for a deck card that is not a Q / E / R spell and not
// locked (the weakest such card first). deckFinishSwap(pr, pool) also serves the new-card note (arcana2gift.js).
const deckCardScore = c => (c.tier || 0) * 1000 + cardPassives(c).length * 100 + ((cardSpell(c) || {}).power || 0) / 10;
function deckFinishSwap(pr, pool) {
  const own = u => pr.cards.find(c => c.uid === u), deck = (pr.deck || []).slice(), cur = deckSynText(deckSynergy(pr)).map(synName);
  const lock = new Set([...(pr.spells || []), ...(pr.deckLock || [])]), kinds = new Set(deck.map(u => (own(u) || {}).sp));
  const ins = (pool || pr.cards).filter(c => c && !c.fusion && !deck.includes(c.uid) && !kinds.has(c.sp));
  const outs = deck.filter(u => !lock.has(u) && own(u)).sort((a, b) => deckCardScore(own(a)) - deckCardScore(own(b)));
  const room = deck.length < deckMax(pr); let best = null;
  const tryDeck = (D, c, out) => {
    const T = deckSynText(deckSynergy(pr, D)), N = T.map(synName);
    if (!cur.every(n => N.includes(n))) return;
    const gain = T.filter((x, i) => !cur.includes(N[i])); if (!gain.length) return;
    const sc = gain.length * 1e6 + deckCardScore(c) - (out ? deckCardScore(own(out)) : 0);
    if (!best || sc > best.sc) best = { sc, in: c, out, gain };
  };
  for (const c of ins) { if (room) tryDeck([...deck, c.uid], c, null); else for (const o of outs) tryDeck(deck.map(u => (u === o ? c.uid : u)), c, o); }
  deckSynergy(pr);
  return best;
}
function deckFinish(game) {
  const pr = game.profile, B = deckFinishSwap(pr);
  if (!B) { const n = deckSynergy(pr).near || []; game.toast(n.length ? `No card you own finishes it yet: ${n[0]}` : 'No single card can add a synergy right now', '#c9c1a8'); return; }
  if (B.out) pr.deck[pr.deck.indexOf(B.out)] = B.in.uid; else pr.deck.push(B.in.uid);
  deckSynCache = { key: null }; game.save(); game.refreshPlayer();
  const o = B.out && pr.cards.find(c => c.uid === B.out);
  game.toast(`${cardName(B.in)} in${o ? ` for ${cardName(o)}` : ''}`, '#8fffd0');
}
{
  const ud = updateDeckTab;
  updateDeckTab = (game, m) => {
    if (!m.circuit && !m.picker && hit('KeyH')) { consume('KeyH'); deckFinish(game); return; }
    return ud(game, m);
  };
  // LOADOUT COLOURS: a saved loadout's button gets a thin line in the colour of the element it holds most of
  const dd = drawDeckPage;
  drawDeckPage = (game, m, now) => {
    const r = dd(game, m, now), pr = game.profile; if (!pr || typeof loadoutsOf !== 'function') return r;
    loadoutsOf(pr).forEach((L, i) => {
      if (!L) return; const top = deckMix({ deck: L.deck, cards: pr.cards })[0]; if (!top) return;
      const B = loadoutBtn(i); ctx.fillStyle = TF_RING[top[0]] || '#c8c8d8'; ctx.fillRect(B.x + 3, B.y + B.h - 2.5, B.w - 6, 1.6);
    });
    return r;
  };
}
