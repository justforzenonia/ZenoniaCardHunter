'use strict';
// BOND CARDS: cards only a partner can hold. Three come with every partner, and every partner level brings a new one, 99 in all. Up to six are active at once and the
// partner casts those on their own. Each of the 99 is its own pairing of what it does (BOND_MAIN) with what comes with it (BOND_RIDER), and later cards hit harder.
// Bond Cards are their own thing: normal cards never go near them. MERGING feeds one Bond Card to another to rank it up, stronger and quicker each rank; the one fed is gone for good
// (P.bond = { on, rank, xp, gone }; what you own follows the level).
const BOND = { slots: 6, gap: 1100, maxRank: 9, near: 170, rows: 5 };
const bondFoes = (w, a, r) => w.actors.filter(m => m.kind === 'monster' && !m.ally && !m.dead && Math.hypot(m.x - a.x, m.y - a.y) < r);
const bondParty = (w, a) => w.actors.filter(q => !q.dead && (q === a.owner || (q.ally && q.owner === a.owner)) && Math.hypot(q.x - a.x, q.y - a.y) < 140);
const bondHit = (w, a, m, k, el) => dealDamage(w, a, m, { base: a.atk * k, spell: true, el: el || 'holy' });
function bondBuff(q, id, key, val, ms, label, col) {
  if (!q.passives) return; q.sup = (q.sup || []).filter(b => { if (b.id !== id) return true; q.passives[b.k] -= b.v; return false; });
  const add = Math.min(val, Math.max(0, PASSIVES[key].cap - (q.passives[key] || 0))); q.passives[key] = (q.passives[key] || 0) + add; q.sup.push({ id, k: key, v: add, t: ms, max: ms, label, stat: `+${Math.round(add)}%`, col });
}
// what a card does: when: does the fight call for it; run: do it. pow grows with the card's level and rank
const BOND_MAIN = [
  { key: 'burst', word: 'Burst', icon: 1060, cd: 11000, text: p => `Hits every monster around them for ${Math.round(140 * p)}% ATK`, when: (w, a, F) => F.length, run: (w, a, p, F, c) => bondFoes(w, a, 90).forEach(m => bondHit(w, a, m, 1.4 * p, c.el)) },
  { key: 'lance', word: 'Lance', icon: 1001, cd: 8000, text: p => `Strikes one monster for ${Math.round(260 * p)}% ATK`, when: (w, a, F) => F.length, run: (w, a, p, F, c) => bondHit(w, a, F[0], 2.6 * p, c.el) },
  { key: 'rain', word: 'Rain', icon: 1044, cd: 10000, text: p => `Hits three monsters for ${Math.round(120 * p)}% ATK`, when: (w, a, F) => F.length, run: (w, a, p, F, c) => F.slice(0, 3).forEach(m => bondHit(w, a, m, 1.2 * p, c.el)) },
  { key: 'cry', word: 'Cry', icon: 1018, cd: 22000, text: p => `Turns every monster on them for ${Math.round(5 * p)} s`, when: (w, a, F) => F.length > 1, run: (w, a, p) => bondFoes(w, a, 220).forEach(m => { m.tauntBy = a; m.tauntT = 5000 * p; }) },
  { key: 'ward', word: 'Ward', icon: 1033, cd: 20000, text: p => `Shields the party for ${Math.round(14 * p)}% max HP`, when: (w, a, F) => F.length, run: (w, a, p) => bondParty(w, a).forEach(q => { q.shield = Math.max(q.shield || 0, Math.round(q.maxHp * 0.14 * p)); }) },
  { key: 'mend', word: 'Light', icon: 1069, cd: 15000, text: p => `Heals the party ${Math.round(12 * p)}% HP`, when: (w, a) => bondParty(w, a).some(q => q.hp < q.maxHp * 0.7), run: (w, a, p) => bondParty(w, a).forEach(q => heal(w, q, q.maxHp * 0.12 * p)) },
  { key: 'anthem', word: 'Anthem', icon: 1046, cd: 24000, text: p => `Party +${Math.round(15 * p)}% damage for 10 s`, when: (w, a, F) => F.length, run: (w, a, p, F, c) => bondParty(w, a).forEach(q => bondBuff(q, c.id, 'brutal', 15 * p, 10000, c.name, c.col)) },
  { key: 'tempo', word: 'Tempo', icon: 1074, cd: 24000, text: p => `Party +${Math.round(15 * p)}% attack speed for 10 s`, when: (w, a, F) => F.length, run: (w, a, p, F, c) => bondParty(w, a).forEach(q => bondBuff(q, c.id, 'frenzy', 15 * p, 10000, c.name, c.col)) },
  { key: 'bulwark', word: 'Bulwark', icon: 1063, cd: 26000, text: p => `Takes ${Math.round(20 * p)}% less damage for 12 s`, when: (w, a, F) => F.length && a.hp < a.maxHp * 0.85, run: (w, a, p, F, c) => bondBuff(a, c.id, 'hide', 20 * p, 12000, c.name, c.col) },
  { key: 'focus', word: 'Focus', icon: 1071, cd: 18000, text: p => `Gives you ${Math.round(14 * p)}% MP`, when: (w, a) => a.owner.mp < a.owner.maxMp * 0.7, run: (w, a, p) => { a.owner.mp = Math.min(a.owner.maxMp, a.owner.mp + a.owner.maxMp * 0.14 * p); } },
  { key: 'purge', word: 'Purge', icon: 1073, cd: 16000, text: p => `Cures the party and heals ${Math.round(6 * p)}%`, when: (w, a) => bondParty(w, a).some(q => q.status && (q.status.poison || q.status.burn || q.status.slow > 0 || q.status.freeze > 0)), run: (w, a, p) => bondParty(w, a).forEach(q => { for (const s of ['poison', 'burn', 'slow', 'freeze']) delete q.status[s]; heal(w, q, q.maxHp * 0.06 * p); }) },
];
// what comes with it, every time
const BOND_RIDER = [
  { word: 'Ember', col: '#ff8a4a', el: 'fire', text: 'burns monsters nearby', run: (w, a) => bondFoes(w, a, 80).forEach(m => applyStatus(m, 'fire', a.atk)) },
  { word: 'Frost', col: '#9fe8ff', el: 'ice', text: 'slows monsters nearby', run: (w, a) => bondFoes(w, a, 80).forEach(m => { m.status.slow = Math.max(m.status.slow || 0, 3000); }) },
  { word: 'Storm', col: '#ffe86a', el: 'lightning', text: 'jolts monsters nearby', run: (w, a) => bondFoes(w, a, 80).forEach(m => applyStatus(m, 'lightning', a.atk)) },
  { word: 'Venom', col: '#9ae04a', el: 'poison', text: 'poisons monsters nearby', run: (w, a) => bondFoes(w, a, 80).forEach(m => applyStatus(m, 'poison', a.atk)) },
  { word: 'Stone', col: '#d8b888', el: 'earth', text: 'cracks monsters\' armour', run: (w, a) => bondFoes(w, a, 80).forEach(m => applyStatus(m, 'earth', a.atk)) },
  { word: 'Blood', col: '#ff6a7a', el: 'dark', text: 'heals them 8%', run: (w, a) => heal(w, a, a.maxHp * 0.08) },
  { word: 'Star', col: '#c8b8ff', el: 'holy', text: 'gives you 5% MP', run: (w, a) => { a.owner.mp = Math.min(a.owner.maxMp, a.owner.mp + a.owner.maxMp * 0.05); } },
  { word: 'Gale', col: '#8fffd0', el: 'wind', text: 'blows monsters back', run: (w, a) => bondFoes(w, a, 80).forEach(m => { const d = Math.hypot(m.x - a.x, m.y - a.y) || 1; m.vx = (m.x - a.x) / d * 160; m.vy = (m.y - a.y) / d * 160; }) },
  { word: 'Keen', col: '#ffd23f', el: 'holy', text: 'sharpens your crits for 8 s', run: (w, a, c) => bondBuff(a.owner, c.id + 'k', 'crit', 12, 8000, 'Keen', '#ffd23f') },
];
const BOND_STARTERS = [
  { id: 'rally', lv: 0, name: 'Rally Cry', col: '#ff9a5a', icon: 1018, cd: 20000, text: () => 'Every monster nearby turns on them for 6 s', when: (w, a, F) => F.length, run: (w, a, p) => bondFoes(w, a, 220).forEach(m => { m.tauntBy = a; m.tauntT = 6000 * p; }) },
  { id: 'iron', lv: 0, name: 'Iron Will', col: '#b8c8ff', icon: 1033, cd: 60000, text: () => 'Double defence for 30 s', when: (w, a, F) => F.length && !(a.ironT > 0) && a.hp < a.maxHp * 0.75, run: (w, a) => { a.ironT = 30000; a.def *= 2; a.pet.guard = 0.5; } },   // (at low levels defence alone hardly shows, so it also halves what gets through)
  { id: 'mend', lv: 0, name: 'Mending Light', col: '#8fffb0', icon: 1069, cd: 15000, text: p => `Heals you, your pets and themselves ${Math.round(16 * p)}% HP`, when: (w, a) => bondParty(w, a).some(q => q.hp < q.maxHp * 0.7), run: (w, a, p) => bondParty(w, a).forEach(q => { heal(w, q, q.maxHp * 0.16 * p); w.rings.push({ x: q.x, y: q.y, r: 16, t: 0, col: '#8fffb0' }); }) },
];
// the 99: every main with every rider, dealt out in a fixed shuffled order so each level brings something different, each with an icon of its own
const BOND_ICONS = Array.from({ length: 116 }, (_, i) => 981 + i).filter(i => ![1018, 1033, 1068, 1069].includes(i));
const BOND_LEVELS = (() => {
  const L = []; BOND_MAIN.forEach((M, i) => BOND_RIDER.forEach((R, j) => L.push({ M, R, sort: (i * 37 + j * 61 + i * j * 13) % 197 + (i + j * 11) / 1000 })));
  return L.sort((a, b) => a.sort - b.sort).map(({ M, R }, i) => ({ id: 'b' + (i + 1), lv: i + 1, name: `${R.word} ${M.word}`, col: R.col, el: R.el, icon: BOND_ICONS[i * 37 % BOND_ICONS.length], cd: M.cd, grow: 1 + i * 0.012, text: p => `${M.text(p)}, and ${R.text}`, when: M.when, run: (w, a, p, F, c) => { M.run(w, a, p, F, c); R.run(w, a, c); } }));
})();
const BOND_ALL = [...BOND_STARTERS, ...BOND_LEVELS], bondCard = id => BOND_ALL.find(c => c.id === id);
function bondOf(P) { P.bond = P.bond || { on: BOND_STARTERS.map(c => c.id), rank: {}, xp: {} }; P.bond.gone = P.bond.gone || {}; delete P.cards; return P.bond; }
const bondOwned = (P, c) => c.lv <= P.lv && !bondOf(P).gone[c.id];
const bondRank = (P, id) => bondOf(P).rank[id] || 0;
const bondPow = (P, c) => (c.grow || 1) * (1 + bondRank(P, c.id) * 0.15);
const bondCd = (P, c) => c.cd * (1 - bondRank(P, c.id) * 0.04);
const bondNeed = r => r + 1;
function bondGrant(game, P) { const c = BOND_LEVELS[P.lv - 1]; if (!c) return; const B = bondOf(P); game.toast(`New Bond Card: ${c.name}!`, c.col); const i = B.on.indexOf(null); if (i >= 0) B.on[i] = c.id; else if (B.on.length < BOND.slots) B.on.push(c.id); }
function bondCast(w, a, c, P, F) {
  c.run(w, a, bondPow(P, c), F, c); a.bondT[c.id] = bondCd(P, c); a.bondGap = BOND.gap; floatText(w, a.x, a.y - (a.h || 26) - 16, c.name.toUpperCase(), c.col, 8.5); w.rings.push({ x: a.x, y: a.y, r: 30, t: 0, col: c.col }, { x: a.x, y: a.y, r: 16, t: -90, col: '#ffffff' });
  for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2; w.particles.push({ x: a.x, y: a.y - 12, vx: Math.cos(an) * 80, vy: Math.sin(an) * 55, t: 0, life: 380, col: c.col, size: 2 }); }
}
// once a frame: the first active card the fight calls for
function partnerBondTick(w, dt) {
  const a = w.actors.find(q => q.heroPartner && !q.dead); if (!a) return; a.bondT = a.bondT || {}; for (const k in a.bondT) a.bondT[k] -= dt; a.bondGap = (a.bondGap || 800) - dt;
  if (a.ironT > 0 && (a.ironT -= dt) <= 0) { a.def /= 2; a.pet.guard = 0; floatText(w, a.x, a.y - 30, 'Iron Will fades', '#b8c8ff', 7); }
  if (a.bondGap > 0 || w.peaceful || (w.isTown && w.isTown(a.x)) || a.state === 'air' || a.state === 'down') return;
  const P = partnerOf(GAME.profile), F = bondFoes(w, a, BOND.near).sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y));
  for (const id of bondOf(P).on) { const c = bondCard(id); if (!c || (a.bondT[id] || 0) > 0 || !c.when(w, a, F)) continue; bondCast(w, a, c, P, F); return; }
}
// ---------------------------------------------------------------- merging one Bond Card into another (it is gone for good). The three starters and active cards can't be fed.
const bondFodder = (P, id) => { const B = bondOf(P); return BOND_LEVELS.filter(c => bondOwned(P, c) && c.id !== id && !B.on.includes(c.id)); };
const bondWorth = (P, c) => 1 + bondRank(P, c.id);
function bondMerge(game, id, food) {
  const P = partnerOf(game.profile), B = bondOf(P), c = bondCard(id), got = bondWorth(P, food); if (bondRank(P, id) >= BOND.maxRank) { game.toast(`${c.name} is at its highest rank`, '#c9c1a8'); return; }
  B.gone[food.id] = true; delete B.rank[food.id]; delete B.xp[food.id]; B.xp[id] = (B.xp[id] || 0) + got; let up = false;
  while (bondRank(P, id) < BOND.maxRank && B.xp[id] >= bondNeed(bondRank(P, id))) { B.xp[id] -= bondNeed(bondRank(P, id)); B.rank[id] = bondRank(P, id) + 1; up = true; }
  game.toast(up ? `${c.name} reached rank ${B.rank[id]}!` : `${c.name} took in ${food.name}`, c.col); game.save();
}
// ---------------------------------------------------------------- the BOND tab: their six cards
const bondSlot = i => { const w = 104, h = 88, gap = 11, x0 = PU_R.x + (PU_R.w - w * 3 - gap * 2) / 2; return { x: x0 + (i % 3) * (w + gap), y: PU_R.y + 34 + Math.floor(i / 3) * (h + 6), w, h }; };
const bondMergeBtn = () => ({ x: PU_R.x + PU_R.w - 72, y: PU_R.y + 217 + 33, w: 54, h: 16, label: 'MERGE', primary: true, col: '#ffd27a' });
const bondOpen = (m, slot) => { m.pick = { kind: 'bond', slot, cur: 0, scroll: 0 }; };
const bondOpenMerge = (m, id) => { m.pick = { kind: 'merge', id, cur: 0, scroll: 0, ask: false, back: m.pick }; };
function updateBondTab(game, m, k) {
  const P = partnerOf(game.profile), B = bondOf(P); m.cur = clamp(m.cur || 0, 0, BOND.slots - 1);
  if (k.l) m.cur = (m.cur + BOND.slots - 1) % BOND.slots; if (k.r) m.cur = (m.cur + 1) % BOND.slots; if (k.u || k.d) m.cur = (m.cur + 3) % BOND.slots;
  for (let i = 0; i < BOND.slots; i++) { const R = bondSlot(i); if (clicked(R.x, R.y, R.w, R.h)) { m.cur = i; bondOpen(m, i); return; } }
  const c = bondCard(B.on[m.cur]), mb = bondMergeBtn();
  if (c && bondRank(P, c.id) < BOND.maxRank && (hit('KeyM') || clicked(mb.x, mb.y, mb.w, mb.h))) { bondOpenMerge(m, c.id); return; }
  if (k.ok) bondOpen(m, m.cur);
}
// the rows of the choosing screen
function bondRows(P, pick) {
  const B = bondOf(P); if (pick.kind === 'merge') return bondFodder(P, pick.id).map(c => ({ c }));
  const mine = B.on[pick.slot], rows = mine ? [{ none: true }] : [], free = BOND_ALL.filter(c => !B.gone[c.id] && (c.id === mine || !B.on.includes(c.id))).sort((a, b) => (b.id === mine) - (a.id === mine));
  return rows.concat(free.filter(c => bondOwned(P, c)).map(c => ({ c })), free.filter(c => !bondOwned(P, c)).map(c => ({ c, locked: true })));
}
const bondAskBtn = i => ({ x: VW / 2 - 104 + i * 110, y: VH / 2 + 22, w: 98, h: 18, label: i ? 'KEEP IT [Esc]' : 'MERGE [Enter]', primary: !i, col: i ? '#c8d0de' : '#ffd27a' });
function updateBondPick(game, m) {
  const P = partnerOf(game.profile), B = bondOf(P), pick = m.pick, k = navInput(), rows = bondRows(P, pick), n = rows.length;
  if (pick.ask) { const Y = bondAskBtn(0), N = bondAskBtn(1); if (k.back || clicked(N.x, N.y, N.w, N.h)) pick.ask = false; else if (k.ok || clicked(Y.x, Y.y, Y.w, Y.h)) { bondMerge(game, pick.id, rows[pick.cur].c); pick.ask = false; pick.cur = clamp(pick.cur, 0, Math.max(0, n - 2)); } return; }
  if (k.back) { m.pick = pick.back || null; return; }
  if (k.u && n) pick.cur = (pick.cur + n - 1) % n; if (k.d && n) pick.cur = (pick.cur + 1) % n;
  if (mouse.wheel) { pick.scroll += Math.sign(mouse.wheel); mouse.wheel = 0; pick.scroll = clamp(pick.scroll, 0, Math.max(0, n - BOND.rows)); pick.cur = clamp(pick.cur, pick.scroll, pick.scroll + BOND.rows - 1); }
  if (pick.cur < pick.scroll) pick.scroll = pick.cur; if (pick.cur >= pick.scroll + BOND.rows) pick.scroll = pick.cur - BOND.rows + 1;
  for (let i = 0; i < BOND.rows; i++) { const j = pick.scroll + i, R = bondRow(i); if (j < n && clicked(R.x, R.y, R.w, R.h)) { if (pick.cur === j) k.ok = true; pick.cur = j; } }
  const r = rows[pick.cur]; if (!r) return;
  if (pick.kind === 'merge') { if (k.ok) { if (bondRank(P, pick.id) >= BOND.maxRank) game.toast('That card is at its highest rank', '#c9c1a8'); else pick.ask = true; } return; }
  if (hit('KeyM') && r.c && !r.locked && bondRank(P, r.c.id) < BOND.maxRank) { bondOpenMerge(m, r.c.id); return; }
  if (!k.ok) return;
  if (r.locked) { game.toast(`${r.c.name} comes at partner level ${r.c.lv}`, '#ff8a8a'); return; }
  B.on[pick.slot] = r.none ? null : r.c.id; m.pick = null; game.save();
}
// a card's face: big on the choosing screen, compact in the six slots
function drawBondFace(c, P, x, y, w, h, now, status, sel) {
  const big = h > 120, cx = x + w / 2, r = bondRank(P, c.id), g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, mixCol(c.col, '#22160e', 0.5)); g.addColorStop(0.5, '#302014'); g.addColorStop(1, '#160f09');
  ctx.save(); ctx.shadowColor = sel ? '#ffffff' : hexA(c.col, 0.7); ctx.shadowBlur = (sel ? 7 : 4) * RES; ctx.fillStyle = g; rrect(ctx, x, y, w, h, 6); ctx.fill(); ctx.restore();
  ctx.strokeStyle = sel ? '#ffffff' : goldFrameGrad(y, h); ctx.lineWidth = 1.6; rrect(ctx, x + 0.8, y + 0.8, w - 1.6, h - 1.6, 6); ctx.stroke(); ctx.strokeStyle = hexA(c.col, 0.6); ctx.lineWidth = 0.8; rrect(ctx, x + 3.5, y + 3.5, w - 7, h - 7, 4); ctx.stroke();
  const sy = y + (big ? 46 : 25), sr = big ? 32 : 17; puSocket(cx, sy, sr, '', c.col, true, false); iconCentered('items', ITEM2_BASE + c.icon, cx, sy + (big ? Math.sin(now / 500) * 1.5 : 0), sr * 1.25);
  const ny = y + (big ? 90 : 51); drawPix(pixText(c.name, fontPx(big ? 10 : 8), 700, ['#ffffff', '#ffffff', '#ffffff'], '#14100c'), cx, ny, 'center');
  for (let i = 0; i < BOND.maxRank; i++) { const px = cx + (i - 4) * 7, py = ny + 10; ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4); ctx.fillStyle = i < r ? '#ffd23f' : 'rgba(255,255,255,0.14)'; ctx.fillRect(-1.8, -1.8, 3.6, 3.6); ctx.restore(); }
  if (big) wrap(c.text(bondPow(P, c)), w - 20, 8).slice(0, 5).forEach((s, i) => petInk(s, cx, ny + 24 + i * 11, '#e4e6ee', 8, 'center', false));
  petInk(status, cx, y + h - 10, big ? c.col : '#c8d0e0', big ? 8 : 7.5, 'center');
}
function drawBondTab(game, m, now, a, infoY, cx2) {
  const P = partnerOf(game.profile), B = bondOf(P), have = BOND_ALL.filter(c => bondOwned(P, c)).length; m.cur = clamp(m.cur || 0, 0, BOND.slots - 1);
  partnerHeading(`BOND CARDS ${have} / ${BOND_ALL.length}`, PU_R.y + 18, now);
  for (let i = 0; i < BOND.slots; i++) {
    const R = bondSlot(i), c = bondCard(B.on[i]), sel = m.cur === i, left = c && a && a.bondT ? a.bondT[c.id] || 0 : 0;
    if (c) { drawBondFace(c, P, R.x, R.y, R.w, R.h, now, left > 0 ? `Ready in ${Math.ceil(left / 1000)}s` : `Every ${Math.round(bondCd(P, c) / 1000)}s`, sel); continue; }
    const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, '#3c2819'); g.addColorStop(1, '#18100a'); ctx.fillStyle = g; rrect(ctx, R.x, R.y, R.w, R.h, 6); ctx.fill(); ctx.strokeStyle = sel ? '#ffffff' : '#4a5468'; ctx.lineWidth = sel ? 1.6 : 1; rrect(ctx, R.x + 0.8, R.y + 0.8, R.w - 1.6, R.h - 1.6, 6); ctx.stroke();
    puSocket(R.x + R.w / 2, R.y + 34, 17, '+', '#8a94a8', false, false); petInk('Empty', R.x + R.w / 2, R.y + 68, '#9aa4b8', 8, 'center');
  }
  partnerInfoBox(infoY); const c = bondCard(B.on[m.cur]);
  if (!c) { petInk('Empty slot', cx2, infoY + 19, '#c8d0e0', 10, 'center'); petInk('Enter: choose a Bond Card', cx2, infoY + 36, '#ffe9a8', 8, 'center', false); return; }
  const r = bondRank(P, c.id); text(`${c.name}${r ? ` +${r}` : ''}`, PU_R.x + 20, infoY + 11, c.col, 9, 'left');
  wrap(c.text(bondPow(P, c)), PU_R.w - 44, 8).slice(0, 2).forEach((s, i) => petInk(s, PU_R.x + 20, infoY + 23 + i * 10, '#e4e6ee', 8, 'left', false));
  petInk(r >= BOND.maxRank ? 'Highest rank · Enter: change' : 'Enter: change · M: merge', PU_R.x + 20, infoY + 45, '#ffe9a8', 8, 'left', false);
  if (r < BOND.maxRank) popupButton(bondMergeBtn(), now);
}
// the choosing screen: the card itself on the left, the list on the right
const bondRow = i => ({ x: PU_R.x + 10, y: PU_R.y + 30 + i * 49, w: PU_R.w - 28, h: 46 });
function drawBondRow(r, P, R, sel, pick, now) {
  const { x, y, w, h } = R, c = r.c, lock = r.locked, col = r.none ? '#c9c1a8' : c.col, g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, lock ? '#2c1d12' : sel ? '#4a5670' : '#34405a'); g.addColorStop(0.5, lock ? '#22160e' : '#3c2819'); g.addColorStop(1, '#1b120b');
  ctx.save(); if (sel) { ctx.shadowColor = hexA(col, 0.8); ctx.shadowBlur = 5 * RES; } ctx.fillStyle = g; rrect(ctx, x, y, w, h, 5); ctx.fill(); ctx.restore();
  ctx.save(); rrect(ctx, x, y, w, h, 5); ctx.clip(); ctx.fillStyle = lock ? '#563924' : col; ctx.fillRect(x, y, 3, h); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, w, 1.5); ctx.restore();
  ctx.strokeStyle = sel ? '#ffffff' : lock ? '#563924' : goldFrameGrad(y, h); ctx.lineWidth = sel ? 1.5 : 1; rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 5); ctx.stroke();
  if (r.none) { puSocket(x + 26, y + h / 2, 16, '✕', col, true, false); petInk('Take it off', x + 50, y + 17, '#ffffff', 10, 'left'); petInk('Leave this slot empty', x + 50, y + 31, '#c8d0e0', 8, 'left', false); return; }
  puSocket(x + 26, y + h / 2, 16, lock ? '?' : '', lock ? '#5a6478' : col, !lock, lock); if (!lock) iconCentered('items', ITEM2_BASE + c.icon, x + 26, y + h / 2, 21);
  petInk(c.name, x + 50, y + 11, lock ? '#7a8498' : col, 10, 'left');
  if (lock) petInk(`Comes at partner level ${c.lv}`, x + 50, y + 27, '#7a8498', 8, 'left', false);
  else wrap(c.text(bondPow(P, c)), w - 112, 8).slice(0, 2).forEach((s, i) => petInk(s, x + 50, y + 23 + i * 10, '#e4e6ee', 8, 'left', false));
  if (lock) return; const rk = bondRank(P, c.id);
  if (pick.kind === 'merge') { petInk(`+${bondWorth(P, c)}`, x + w - 12, y + 17, '#8fffb0', 12, 'right'); petInk(bondWorth(P, c) > 1 ? 'points' : 'point', x + w - 12, y + 32, '#c8d0e0', 7.5, 'right', false); return; }
  if (rk) petInk(`+${rk}`, x + w - 12, y + 15, '#ffd23f', 11, 'right'); petInk(`Every ${Math.round(bondCd(P, c) / 1000)}s`, x + w - 12, y + 32, '#c8d0e0', 7.5, 'right', false);
}
function drawBondPick(game, m, now) {
  const P = partnerOf(game.profile), pick = m.pick, merge = pick.kind === 'merge', rows = bondRows(P, pick), r = rows[pick.cur], sh = puShades({ col: HERO_P.theme }), target = merge ? bondCard(pick.id) : r && r.c, cx = PU_L.x + PU_L.w / 2;
  goldTitle(merge ? `MERGE INTO ${target.name.toUpperCase()}` : `BOND CARD FOR ${P.name.toUpperCase()}`, VW / 2, 16, 15, now);
  drawIronFrame(PU, sh.plate[0], sh.plate[1]); drawSlatePage(PU_L, sh.page[0], sh.page[1]); drawSlatePage(PU_R, sh.page[0], sh.page[1]);
  partnerHeading(merge ? 'SPARE BOND CARDS' : 'CHOOSE A CARD', PU_R.y + 16, now);
  if (!rows.length) { petInk('No spare Bond Cards yet', PU_R.x + PU_R.w / 2, PU_R.y + 120, '#f0e6d2', 10, 'center'); petInk('Starters and active cards can\'t be merged.', PU_R.x + PU_R.w / 2, PU_R.y + 138, '#c8d0e0', 8, 'center', false); }
  for (let i = 0; i < BOND.rows; i++) { const j = pick.scroll + i; if (rows[j]) drawBondRow(rows[j], P, bondRow(i), j === pick.cur, pick, now); }
  if (rows.length > BOND.rows) { const X = PU_R.x + PU_R.w - 14, Y = PU_R.y + 30, H = 49 * BOND.rows - 3; ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(X, Y, 3, H); ctx.fillStyle = '#ffd27a'; ctx.fillRect(X, Y + H * pick.scroll / rows.length, 3, Math.max(8, H * BOND.rows / rows.length)); }
  const W = 150, H = 208, Y = PU_L.y + 8;
  if (target && !(r && r.locked)) drawBondFace(target, P, cx - W / 2, Y, W, H, now, `Every ${Math.round(bondCd(P, target) / 1000)}s`, false);
  else { ctx.fillStyle = 'rgba(22,15,9,0.7)'; rrect(ctx, cx - W / 2, Y, W, H, 6); ctx.fill(); ctx.strokeStyle = '#563924'; ctx.lineWidth = 1; rrect(ctx, cx - W / 2 + 0.5, Y + 0.5, W - 1, H - 1, 6); ctx.stroke(); petInk(r && r.locked ? `Partner level ${r.c.lv}` : 'No card', cx, Y + H / 2, '#9aa4b8', 10, 'center'); }
  const bx = PU_L.x + 12, bw = PU_L.w - 24, rk = target ? bondRank(P, target.id) : 0, xp = target ? bondOf(P).xp[target.id] || 0 : 0;
  if (target && !(r && r.locked)) puBar(bx, Y + H + 8, bw, rk >= BOND.maxRank ? 1 : xp / bondNeed(rk), '#ffd27a', '★', rk >= BOND.maxRank ? 'Highest rank' : `Rank ${rk} · ${xp} / ${bondNeed(rk)} to the next`);
  petInk(merge ? 'Enter: merge · Esc: back' : 'Enter: choose · M: merge', cx, PU_L.y + PU_L.h - 26, '#ffe9a8', 8, 'center', false); if (!merge) petInk('Esc: back', cx, PU_L.y + PU_L.h - 13, '#9aa4b8', 7.5, 'center', false);
  if (pick.ask && r) {
    ctx.fillStyle = 'rgba(6,6,14,0.7)'; ctx.fillRect(0, 0, VW, VH); const Q = { x: VW / 2 - 170, y: VH / 2 - 56, w: 340, h: 112 }; drawIronFrame(Q, '#3a2230', '#1a1018'); drawSlatePage({ x: Q.x + 8, y: Q.y + 8, w: Q.w - 16, h: Q.h - 16 }, '#2a2030', '#161018');
    goldTitle(`FEED ${r.c.name.toUpperCase()}?`, VW / 2, Q.y + 26, 12, now); petInk(`It goes into ${target.name} for +${bondWorth(P, r.c)}.`, VW / 2, Q.y + 48, '#f0e6d2', 9, 'center'); petInk('It is gone for good.', VW / 2, Q.y + 63, '#ffb0a0', 9, 'center'); popupButton(bondAskBtn(0), now); popupButton(bondAskBtn(1), now);
  }
}
