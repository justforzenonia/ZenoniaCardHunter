'use strict';
// ARCANA in the Monster Book: a last tab listing every Arcana skill card (ARCANA_CARDS). The ones you have held show their art in
// colour and the rest stay dark. The highlighted card shows its element, its type, its move in words, how many you hold and your
// best rank, and where Arcana come from. The arrows choose, Enter or C shows your best copy full size.
// ("Held" counts the bag and Storage now; a card you sold or fused away goes dark again.)
const ABOOK = { cols: 12, rows: 5, cw: 34, ch: 40, x: 24, y: 66, px: 440, py: 64, pw: 176, ph: 252 };
MBOOK_FILTERS.push({ name: 'ARCANA', arcana: true, ok: () => false });
const abookHeld = (pr, id) => [...(pr.cards || []), ...((pr.storage && pr.storage.cards) || [])].filter(c => c.sp === id);
function abookBest(pr, id) { return abookHeld(pr, id).reduce((b, c) => (!b || (c.tier || 0) > (b.tier || 0) ? c : b), null); }
const abookOn = m => !!MBOOK_FILTERS[m.f || 0].arcana;
// F cycles what the grid lists: every Arcana, only the ones you hold, or only the new moves
const ABOOK_SHOW = ['all', 'held', 'new moves'];
const abookList = (pr, m) => { const f = m.af || 0; return ARCANA_CARDS.filter(id => f === 0 || (f === 1 ? abookHeld(pr, id).length > 0 : typeof ARCANA2 !== 'undefined' && !!ARCANA2[id])); };
{
  const um = updateMonsterBook;
  updateMonsterBook = (game, m, dt) => {
    if (!abookOn(m) || m.card) return um(game, m, dt);
    if (hit('KeyF')) { consume('KeyF'); m.af = ((m.af || 0) + 1) % ABOOK_SHOW.length; m.ac = 0; m.as = 0; }
    const L = abookList(game.profile, m), k = navInput(), n = Math.max(1, L.length), A = ABOOK; m.ac = Math.min(m.ac || 0, n - 1);
    if (k.l) m.ac = (m.ac + n - 1) % n; if (k.r) m.ac = (m.ac + 1) % n;
    if (k.u) m.ac = (m.ac - A.cols + n) % n; if (k.d) m.ac = (m.ac + A.cols) % n;
    const row = Math.floor(m.ac / A.cols); m.as = Math.max(Math.min(m.as || 0, row), row - A.rows + 1);
    if (mouse.wheel) { m.as = clamp((m.as || 0) + Math.sign(mouse.wheel), 0, Math.max(0, Math.ceil(n / A.cols) - A.rows)); mouse.wheel = 0; }
    for (let i = m.as * A.cols; i < Math.min(n, (m.as + A.rows) * A.cols); i++) { const x = A.x + (i % A.cols) * A.cw, y = A.y + (Math.floor(i / A.cols) - m.as) * A.ch; if (clicked(x, y, A.cw - 2, A.ch - 2)) { m.ac = i; mouse.click = false; } }
    if (hit('KeyT') && m.t > 150 && L[m.ac]) { consume('KeyT'); arcanaTry(game, L[m.ac]); return; }
    if ((hit('KeyC') || hit('Enter')) && m.t > 150) {
      consume('KeyC', 'Enter'); const c = L[m.ac] && abookBest(game.profile, L[m.ac]);
      if (c) { m.card = c; m.t = 0; return; } game.toast("You don't hold this one yet", '#c9c1a8'); return;
    }
    const keep = m.cur; m.cur = 0; const r = um(game, m, dt); m.cur = keep; return r;   // (the book itself still handles the tabs and closing)
  };
  const dm = drawMonsterBook;
  drawMonsterBook = (game, m, now) => {
    const r = dm(game, m, now); if (!abookOn(m) || m.card) return r;
    const pr = game.profile || {}, A = ABOOK, L = abookList(pr, m), n = ARCANA_CARDS.length, nl = L.length;
    ctx.fillStyle = '#1c120c'; ctx.fillRect(18, 60, VW - 36, VH - 76); ctx.fillRect(60, 33, VW - 120, 11);   // (over the book's empty-list words, its page count and its footer)
    const held = ARCANA_CARDS.filter(id => abookHeld(pr, id).length).length;
    const ever = new Set([...Object.keys(pr.arcanaSeen || {}), ...ARCANA_CARDS.filter(id => abookHeld(pr, id).length)]).size,   // (seen before, or held right now)
      next = (Math.floor(ever / 10) + 1) * 10;
    text(`Arcana: ${held} / ${n} held · ${ever} kind${ever === 1 ? '' : 's'} in all${next <= n ? ` · ${next} kinds pays ${next} Summon coins` : ''} · from Summons, hoards, chests, bosses`, VW / 2, 39, '#d0c8e0', 7);
    const s0 = m.as || 0;
    for (let i = s0 * A.cols; i < Math.min(nl, (s0 + A.rows) * A.cols); i++) {
      const id = L[i], x = A.x + (i % A.cols) * A.cw, y = A.y + (Math.floor(i / A.cols) - s0) * A.ch, on = i === (m.ac || 0), have = abookHeld(pr, id).length > 0;
      ctx.fillStyle = on ? 'rgba(122,82,200,0.5)' : '#302014'; rrect(ctx, x, y, A.cw - 2, A.ch - 2, 3); ctx.fill();
      if (on) { ctx.strokeStyle = '#c8a8ff'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, A.cw - 3, A.ch - 3, 3); ctx.stroke(); }
      ctx.save(); if (!have) { ctx.filter = 'brightness(0) invert(0.25)'; ctx.globalAlpha = 0.7; } arcanaArt(id, x + 2, y + 2, A.cw - 6, A.ch - 6); ctx.restore();
      if (id.startsWith('wv')) { ctx.fillStyle = '#ffd860'; ctx.beginPath(); ctx.arc(x + A.cw - 7, y + 5, 2, 0, Math.PI * 2); ctx.fill(); }   // (the New Arcana wear a little gold dot)
      { const st = typeof arcStars === 'function' ? arcStars(pr, id) : 0; if (st) text('★'.repeat(st), x + 3, y + A.ch - 8, '#ffd860', 7, 'left'); }   
      if (typeof arcanaFeatured === 'function' && id === arcanaFeatured()) { ctx.fillStyle = '#d8c8ff'; ctx.beginPath(); ctx.moveTo(x + 6, y + 2); ctx.lineTo(x + 9.5, y + 5.5); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x + 2.5, y + 5.5); ctx.closePath(); ctx.fill(); }
    }
    if (!nl) text(m.af === 1 ? 'You hold no Arcana yet' : 'None yet', A.x + A.cols * A.cw / 2, A.y + 90, '#c8bcd8', 8);
    const rows = Math.ceil(nl / A.cols); if (rows > A.rows) { const h = A.rows * A.ch - 4, bh = h * A.rows / rows; ctx.fillStyle = 'rgba(255,255,255,0.1)'; rrect(ctx, A.x + A.cols * A.cw + 2, A.y, 3, h, 2); ctx.fill(); ctx.fillStyle = '#c8a8ff'; rrect(ctx, A.x + A.cols * A.cw + 2, A.y + (h - bh) * s0 / (rows - A.rows), 3, bh, 2); ctx.fill(); }
    // the chosen card
    if (!nl) { text(`F: show ${ABOOK_SHOW[((m.af || 0) + 1) % 3]} · Q / E other tabs · 9 or Esc close`, VW / 2, VH - 22, '#b8ae96', 7); return r; }
    const id = L[m.ac || 0], S = SPECIES[id], sp = cardSpell(makeCard(id, 5)), best = abookBest(pr, id), cnt = abookHeld(pr, id).length, P = A;
    ctx.fillStyle = '#281a11'; rrect(ctx, P.px, P.py, P.pw, P.ph, 6); ctx.fill();
    ctx.save(); if (!best) { ctx.filter = 'brightness(0) invert(0.3)'; ctx.globalAlpha = 0.7; } arcanaArt(id, P.px + 40, P.py + 6, P.pw - 80, 82); ctx.restore();
    text(S.name, P.px + P.pw / 2, P.py + 98, best ? '#ffe8b0' : '#b8ae96', 9);
    text(`${ELEMENTS[S.spell.el].name} · ${ARCH[S.spell.a].name}${id.startsWith('wv') ? ' · a new move' : ''}`, P.px + P.pw / 2, P.py + 110, ELEMENTS[S.spell.el].col, 7);
    const lines = wrapLines(sp.formText || cap(ARCH[S.spell.a].desc) + '.', P.pw - 30, 7).slice(0, typeof arcanaPairsOf === 'function' && arcanaPairsOf(id).length > 1 ? 4 : 5);
    lines.forEach((L, i) => text(L, P.px + 10, P.py + 126 + i * 11, '#e8e2cf', 7, 'left'));
    if (typeof arcanaPairsOf === 'function') arcanaPairsOf(id).slice(0, 2).forEach((Q, qi) => {   // its pairs (up to two): the partner by name, the pair's own name once found
      const other = Q[0] === id ? Q[1] : Q[0], found = (pr.pairsFound || {})[Q[2]], first = Q[0] === id;
      text(`${first ? 'Then' : 'After'} ${SPECIES[other].name}: ${found ? Q[2] : '? pair'}`, P.px + 10, P.py + 126 + lines.length * 11 + 4 + qi * 11, found ? '#ffd860' : '#c8bcd8', 7, 'left');
    });
    const yb = P.py + 196;
    text('Held', P.px + 10, yb, '#b8ae96', 7, 'left'); text(cnt ? `${cnt}` : 'not yet', P.px + P.pw - 10, yb, cnt ? '#e8e2cf' : '#a89cb8', 7, 'right');
    text('Best rank', P.px + 10, yb + 12, '#b8ae96', 7, 'left'); text(best ? RANKS[best.tier || 0] : '—', P.px + P.pw - 10, yb + 12, best ? '#ffd860' : '#a89cb8', 7, 'right');
    { const used = ((pr.arcUse || {})[id]) || 0, st = typeof arcStars === 'function' ? arcStars(pr, id) : 0, nx = typeof ARC_MASTERY !== 'undefined' && ARC_MASTERY[st];
      text('Mastery', P.px + 10, yb + 24, '#b8ae96', 7, 'left'); text(st ? '★'.repeat(st) : '—', P.px + P.pw - 10, yb + 24, st ? '#ffd860' : '#a89cb8', 7, 'right');
      text(`cast ${used} time${used === 1 ? '' : 's'}${nx ? ` · next star at ${nx.n}` : ' · mastered'}`, P.px + P.pw / 2, yb + 36, '#c8bcd8', 7, 'center'); }
    text(best ? 'Enter or C: see your best copy' : 'Summons · hoards · chests · bosses', P.px + P.pw / 2, yb + 49, '#c8bcd8', 7, 'center');
    text(`Showing ${ABOOK_SHOW[m.af || 0]} · F: show ${ABOOK_SHOW[((m.af || 0) + 1) % 3]} · T: try it · Enter or C card · Q / E tabs · Esc close`, VW / 2, VH - 22, '#b8ae96', 7);
    return r;
  };
}
// FEATURED ARCANA OF THE DAY (the Summoning Shrine): each real day one Arcana is in the spotlight. When a summon lands on an Arcana
// (1 in 5 of them, gacha.js gachaRoll), it is the featured one ARCANA_FEAT.share of the time, at the rank that was rolled. The
// shrine shows which one, in a small panel under YOUR RECORD.
const ARCANA_FEAT = { share: 0.4, col: '#d8c8ff', box: { x: 431, y: 146, w: 126, h: 48 } };
const arcanaFeatured = () => ARCANA_CARDS[(dayNo() * 5 + 1) % ARCANA_CARDS.length];
{
  const gr = gachaRoll;
  gachaRoll = (...args) => {
    const c = gr(...args);
    if (c && SPECIES[c.sp] && SPECIES[c.sp].arcana && ARCANA_CARDS.includes(c.sp) && Math.random() < ARCANA_FEAT.share) return makeCard(arcanaFeatured(), c.tier);
    return c;
  };
  const dg = drawGacha;
  drawGacha = (game, m, now) => {
    const r = dg(game, m, now); if (m.results) return r;   // (only on the shrine itself, not over the cards you just drew)
    const B = ARCANA_FEAT.box, id = arcanaFeatured(), S = SPECIES[id];
    ctx.fillStyle = 'rgba(32,21,13,0.88)'; rrect(ctx, B.x, B.y, B.w, B.h, 5); ctx.fill();
    ctx.strokeStyle = ARCANA_FEAT.col; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 5); ctx.stroke();
    arcanaArt(id, B.x + 3, B.y + 7, 34, 34);
    text('FEATURED TODAY', B.x + 40, B.y + 10, ARCANA_FEAT.col, 7, 'left');
    text(S.name, B.x + 40, B.y + 23, '#ffffff', S.name.length > 13 ? 7 : 7.5, 'left');
    text(`${Math.round(ARCANA_FEAT.share * 100)}% · click: try`, B.x + 40, B.y + 36, '#c8bcd8', 7, 'left');
    return r;
  };
}
// ARCANA MASTERY: each Arcana kind counts your casts of it (pr.arcUse, your own hero only, never echoes). At 50, 200 and 500 casts
// it earns a star and its spells hit 5%, 10% and 15% harder for you (applied as you cast, so a friend's game is untouched).
// The ARCANA page shows the stars, the count and the next goal; a toast marks each new star.
const ARC_MASTERY = [{ n: 50, mul: 1.05 }, { n: 200, mul: 1.1 }, { n: 500, mul: 1.15 }];
const arcStars = (pr, id) => ARC_MASTERY.filter(M => ((pr && pr.arcUse) || {})[id] >= M.n).length;
{
  const cs = castSpell;
  castSpell = (world, a, sp, ...rest) => {
    const G = window.GAME, pr = G && G.profile;
    if (pr && a && world === G.world && a === world.player && sp && sp.sp && SPECIES[sp.sp] && SPECIES[sp.sp].arcana && !sp.echoed && !sp.sup) {
      const st = arcStars(pr, sp.sp); if (st) sp = { ...sp, power: Math.round(sp.power * ARC_MASTERY[st - 1].mul) };
      const r = cs(world, a, sp, ...rest);
      if (typeof dailyEvent === 'function') { dailyEvent(G, 'arcana'); if (typeof ARCANA2 !== 'undefined' && ARCANA2[sp.sp]) dailyEvent(G, 'arcana'); }   // (the Arcana contract: a new-move card counts twice)
      const U = pr.arcUse = pr.arcUse || {}; U[sp.sp] = (U[sp.sp] || 0) + 1;
      const M = ARC_MASTERY.find(m => m.n === U[sp.sp]);
      if (M) G.toast(`${SPECIES[sp.sp].name} mastery ${'★'.repeat(arcStars(pr, sp.sp))} · ${Math.round((M.mul - 1) * 100)}% more power`, '#ffd860');
      return r;
    }
    return cs(world, a, sp, ...rest);
  };
}
// a daily contract for Arcana (daily.js CONTRACTS): cast them 10 times, a card with a new move counting twice
if (typeof CONTRACTS !== 'undefined' && !CONTRACTS.arcana) CONTRACTS.arcana = () => ({ need: 10, text: 'Cast Arcana spells 10 times (a gold-dot card counts twice)' });
// ARCANA SWAP (the Summoning Shrine, under the featured panel): three SPARE Arcana go to the Card Oracle for today's featured
// Arcana, at the lowest rank of the three. A spare is any copy of an Arcana kind beyond your best one of it, and never a card in
// your deck, on Q / E / R, your fusion card, or one kept in a loadout. The lowest-ranked spares go first.
const ARC_SWAP = { n: 3, btn: { x: 431, y: 198, w: 126, h: 17 } };
function arcSpares(pr) {
  const busy = new Set([...(pr.deck || []), ...(pr.spells || []), pr.fusion, ...(pr.loadouts || []).filter(Boolean).flatMap(L => [...(L.deck || []), ...(L.spells || []), L.fusion])].filter(Boolean));
  const by = {}; for (const c of pr.cards || []) if (c && !c.fusion && SPECIES[c.sp] && SPECIES[c.sp].arcana && ARCANA_CARDS.includes(c.sp)) (by[c.sp] = by[c.sp] || []).push(c);
  const out = []; for (const L of Object.values(by)) { L.sort((a, b) => (b.tier || 0) - (a.tier || 0)); out.push(...L.slice(1).filter(c => !busy.has(c.uid))); }
  return out.sort((a, b) => (a.tier || 0) - (b.tier || 0));
}
{
  const ug = updateGacha;
  updateGacha = (game, m, dt) => {
    if (!m.results) { const F = ARCANA_FEAT.box; if (clicked(F.x, F.y, F.w, F.h)) { mouse.click = false; arcanaTry(game, arcanaFeatured()); return; } }   // (a click on the featured panel: try it)
    if (!m.results) { const B = ARC_SWAP.btn; if (clicked(B.x, B.y, B.w, B.h)) {
      mouse.click = false; const pr = game.profile, S = arcSpares(pr);
      if (S.length < ARC_SWAP.n) { game.toast(`The Oracle needs ${ARC_SWAP.n} spare Arcana (extra copies, not in your deck): you have ${S.length}`, '#ffb0a0'); return; }
      const give = S.slice(0, ARC_SWAP.n), tier = Math.min(...give.map(c => c.tier || 0)), got = makeCard(arcanaFeatured(), tier);
      pr.cards = pr.cards.filter(c => !give.includes(c)); pr.cards.push(got); if (game.reveals) game.reveals.push({ card: got, t: 0 });
      game.toast(`The Card Oracle swaps ${give.map(c => SPECIES[c.sp].name).join(', ')} for ${SPECIES[got.sp].name} (${RANKS[tier]})`, ARCANA_FEAT.col); game.save(); return;
    } }
    return ug(game, m, dt);
  };
  const dg = drawGacha;
  drawGacha = (game, m, now) => {
    const r = dg(game, m, now); if (m.results || !game.profile) return r;
    const B = ARC_SWAP.btn, n = arcSpares(game.profile).length, ok = n >= ARC_SWAP.n, hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
    ctx.fillStyle = ok ? (hov ? 'rgba(90,60,140,0.95)' : 'rgba(60,40,100,0.92)') : 'rgba(32,21,13,0.85)'; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill();
    ctx.strokeStyle = ok ? ARCANA_FEAT.col : '#5a5070'; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 4); ctx.stroke();
    text(`SWAP 3 SPARES FOR IT (${n})`, B.x + B.w / 2, B.y + B.h / 2 + 0.5, ok ? '#ffffff' : '#b8ae96', 7);
    return r;
  };
}
// ELEMENT ARCANA FROM BOSSES: a mini boss, guardian or boss (world.js isBossKill) has a 1 in 4 chance to drop an Arcana of its own
// element (a fire boss, a fire Arcana), at a rank rolled from its own like any card drop; it lands on the ground beside it.
const ARC_BOSS = { chance: 0.25 };
{
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => {
    const r = ok(game, w, m);
    if (m && !m.ally && !m.mimic && typeof isBossKill === 'function' && isBossKill(m) && Math.random() < ARC_BOSS.chance) {
      const el = SPECIES[m.sp] && SPECIES[m.sp].spell && SPECIES[m.sp].spell.el, pool = ARCANA_CARDS.filter(id => SPECIES[id].spell.el === el);
      const id = pick(pool.length ? pool : ARCANA_CARDS);
      w.drops.push({ kind: 'card', item: makeCard(id, dropRank(m.tier)), x: m.x + rand(-10, 10), y: m.y + rand(-6, 6) });
    }
    return r;
  };
}
// TRY IT (T on the ARCANA page): any Arcana, held or not, goes on your Q slot at rank C in the training arena for a go at the dummy.
// It is not yours: nothing is saved, your own spells come back after. Esc from that training puts you straight back where you were
// (the world you left is kept), not in the Arena hub. Not while playing online (host or guest), not from inside a fight's arena.
const ARC_TRY = { tier: 3 };
function arcanaTry(game, id) {
  if (game.net) { game.toast('Trying cards waits until you are playing on your own', '#ffb0a0'); return; }   // (a host leaving the world would leave friends behind)
  if (game.scene !== 'world' || !game.world) { game.toast('Open the book out in the world to try a card', '#ffb0a0'); return; }
  game.tryBack = { world: game.world, scene: game.scene, outside: game.outside };
  game.menu = null; game.goTraining();
  const p = game.world && game.world.player; if (!p) return;
  p.spells = [cardSpell(makeCard(id, ARC_TRY.tier)), p.spells[1], p.spells[2]]; p.cds = [0, 0, 0];
  game.arena.banner = { str: `TRY: ${SPECIES[id].name} on Q`, t: 1600, t0: 1600 };
  game.toast(`Trying ${SPECIES[id].name} (rank C) on Q · Esc to go back`, '#d8c8ff');
}
{
  const gh = game.goHub;
  game.goHub = function (...a) {
    const B = this.tryBack;
    if (B && this.arena && this.arena.training) { this.tryBack = null; this.arena = null; this.world = B.world; this.scene = B.scene; this.outside = B.outside; this.menu = null; this.refreshPlayer(); this.toast('Back from trying', '#c9c1a8'); return; }
    this.tryBack = null; return gh.apply(this, a);
  };
}
