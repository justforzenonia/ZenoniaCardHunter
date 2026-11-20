'use strict';
// BIG SUMMONS AND CARD SOULS (2026-11-13, the user's list: "add 100 & 1000 summons" and "other currency: using cards, convert
// them to souls or something; give a reason to hunt more cards").
//   ×100          (and ×1000 until 2026-11-18, "1000 might be too much"): a token on the console beside ×10 (gacha.js GBTN; key 2).
//                 Every ten cards still hold one B or better. The reveal shows the ten best, with a count of every rank across the
//                 top, then Enter pages through all of them. Cards past your 200 wait in Storage at home, as before.
//   SOULS         the panel on the left of the console. MELT SPARES turns spare cards into Souls by rank (F 1, E 2, D 4 … A 30);
//                 BUY COIN trades SOUL.coin Souls for one summon coin. So every card you hunt is worth something.
//                 What counts as a spare: a copy of a card you already hold a better (or equal) copy of, rank A or lower, and
//                 never a card in your deck, on a spell key, in a loadout, locked, the fusion or a fused card. Melting asks
//                 twice: the first press says how many and for how much.
const SOUL = { per: [1, 2, 4, 8, 15, 30, 60, 120, 250, 500], maxTier: 5, coin: 40, autoMax: 2 };   // (autoMax: auto-melt takes ranks F, E and D only)
const PITY = { n: 100, tier: 6 };   // an S (tier 6) or better within every 100 cards
const MILE = { s: 300, ss: 600 };   // miles for a card of your choice at S, or at SS
// the Souls panel, dressed as part of the machine (2026-11-18, the user: "the ribbons doesnt match the casino feel"): a gold-framed plate like
// CREDITS with a green LED counter, and two lit glass dome buttons (cabinet.js cabDome) for MELT and COIN; the rects are where they click
const SOUL_BTN = { melt: { x: 22, y: 316, w: 40, h: 34, cx: 42, cy: 328, col: '#5ae0a8', key: 'KeyM' }, coin: { x: 70, y: 316, w: 40, h: 34, cx: 90, cy: 328, col: '#ffc21f', key: 'KeyB' } };
const overBox = B => mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
// every card id the save points at outside the card lists themselves (deck, spell keys, loadouts, locks, the fusion…)
function soulKeptUids(pr) {
  const rest = {}; for (const k in pr) if (k !== 'cards' && k !== 'storage') rest[k] = pr[k];
  return new Set(JSON.stringify(rest).match(/u[0-9a-z]{4,}/g) || []);
}
function soulSpares(pr) {
  const kept = soulKeptUids(pr), all = [...(pr.cards || []), ...((pr.storage && pr.storage.cards) || [])];
  const best = {}; for (const c of all) if (!best[c.sp] || c.tier > best[c.sp].tier) best[c.sp] = c;   // (the best copy of each card always stays)
  return all.filter(c => !c.fusion && !c.fused && c.tier <= SOUL.maxTier && best[c.sp] !== c && !kept.has(c.uid));
}
function soulMelt(game, m) {
  const pr = game.profile, list = soulSpares(pr), v = list.reduce((s, c) => s + SOUL.per[c.tier], 0);
  if (!list.length) { game.toast('No spares to melt: every card is your best copy, or in use', '#c8b8e8'); m.meltAsk = 0; return; }
  if (!m.meltAsk || performance.now() - m.meltAsk > 4000) { m.meltAsk = performance.now(); game.toast(`Melt ${list.length} spare card${list.length > 1 ? 's' : ''} into ${v} Souls? Press MELT again`, '#7ad8b0'); return; }
  const gone = new Set(list.map(c => c.uid));
  pr.cards = pr.cards.filter(c => !gone.has(c.uid)); if (pr.storage && pr.storage.cards) pr.storage.cards = pr.storage.cards.filter(c => !gone.has(c.uid));
  pr.souls = (pr.souls || 0) + v; m.meltAsk = 0; m.soulFx = performance.now();
  game.toast(`+${v} Souls (${list.length} spares melted)`, '#7ad8b0'); game.save();
}
function soulBuyCoin(game) {
  const pr = game.profile;
  if ((pr.souls || 0) < SOUL.coin) { game.toast(`A coin costs ${SOUL.coin} Souls (you have ${pr.souls || 0})`, '#ff8a8a'); return; }
  pr.souls -= SOUL.coin; pr.coins = (pr.coins || 0) + 1; game.toast('+1 summon coin', '#ffd23f'); game.save();
}
// the summon itself: as before, but the B-or-better promise holds for every ten, and a big summon keeps a tally
summon = function (game, m, n) {
  const pr = game.profile;
  if ((pr.coins || 0) < n) { game.toast(`Not enough coins (${pr.coins || 0}/${n})`, '#ff8a8a'); return; }
  pr.coins -= n;
  const rolls = Array.from({ length: n }, gachaRoll);
  for (let s = 0; s + GACHA_FLOOR.n <= n; s += GACHA_FLOOR.n) {
    const blk = rolls.slice(s, s + GACHA_FLOOR.n); if (blk.some(c => c.tier >= GACHA_FLOOR.tier)) continue;
    let c = rolls[s + GACHA_FLOOR.n - 1]; for (let k = 0; k < 200 && c.tier < GACHA_FLOOR.tier; k++) c = gachaRoll(); rolls[s + GACHA_FLOOR.n - 1] = c;
  }
  // THE CEILING (2026-11-18, the user said "lets begin" to: a ceiling, mileage, auto-melt): an S or better comes within every PITY.n
  // cards. pr.pity counts the cards since the last one; the card that reaches PITY.n is rolled again (at the same odds) until it is one.
  pr.pity = pr.pity || 0; m.pityHit = 0;
  for (let i = 0; i < rolls.length; i++) {
    pr.pity++;
    if (rolls[i].tier >= PITY.tier) { pr.pity = 0; continue; }
    if (pr.pity >= PITY.n) { let c = rolls[i]; for (let k = 0; k < 2000 && c.tier < PITY.tier; k++) c = gachaRoll(); rolls[i] = c; pr.pity = 0; m.pityHit++; }
  }
  pr.miles = (pr.miles || 0) + n;   // MILEAGE: a mile a card (traded for a card of your choice: MILE)
  // AUTO-MELT (pr.autoMelt, the AUTO switch on the Souls plate): a new card of rank D or lower that you already hold as well or better
  // (bag or Storage, or earlier in this same summon) melts straight into Souls instead of filling your bag
  const have = {}; for (const c of [...pr.cards, ...((pr.storage && pr.storage.cards) || [])]) if (!c.fusion) have[c.sp] = Math.max(have[c.sp] ?? -1, c.tier);
  let toBag = 0, toStore = 0; m.melted = 0; m.meltSouls = 0;
  for (const c of rolls) {
    if (pr.autoMelt && c.tier <= SOUL.autoMax && (have[c.sp] ?? -1) >= c.tier) { c.melted = true; m.melted++; m.meltSouls += SOUL.per[c.tier]; continue; }
    have[c.sp] = Math.max(have[c.sp] ?? -1, c.tier);
    if (pr.cards.length < 200) { pr.cards.push(c); toBag++; if (pr.deck.length < deckMax(pr)) pr.deck.push(c.uid); }
    else { pr.storage = pr.storage || { cards: [], gear: [] }; pr.storage.cards.push(c); toStore++; }
  }
  if (m.meltSouls) { pr.souls = (pr.souls || 0) + m.meltSouls; m.soulFx = performance.now(); }
  if (m.pityHit) game.toast(`The ceiling: ${m.pityHit > 1 ? m.pityHit + ' guaranteed S cards' : 'a guaranteed S card'}!`, '#ffd860');
  if (m.melted && n <= 10) game.toast(`Auto-melt: ${m.melted} spare${m.melted > 1 ? 's' : ''} → +${m.meltSouls} Souls`, '#7ad8b0');
  // (a big summon also keeps every card it made, strongest first, for the ALL CARDS pages after the reveal)
  m.all = n > 10 ? rolls.slice().sort((a, b) => b.tier - a.tier || String(cardName(a)).localeCompare(String(cardName(b)))) : null; m.allView = null; m.toBag = toBag; m.toStore = toStore;
  m.tally = n > 10 ? RANKS.map((_, t) => rolls.filter(c => c.tier === t).length) : null; m.bigN = n > 10 ? n : 0;
  m.results = n > 10 ? rolls.slice().sort((a, b) => b.tier - a.tier).slice(0, 10) : rolls;
  m.t = 0; m.best = Math.max(...m.results.map(c => c.tier)); pachinkoStart(m);
  pr.pulls = (pr.pulls || 0) + n; pr.pullBest = Math.max(pr.pullBest == null ? -1 : pr.pullBest, m.best);
  if (n > 10 && pr.cards.length >= 200) game.toast('Your card bag is full: the rest wait in Storage at home', '#c8b8e8');
  game.save();
};
// a ribbon like the summon tokens' (casino.js summonToken), as a button
function shrineRibbon(B, label, on, now) {
  const hov = on && overBox(B), cx = B.x + B.w / 2, ry = B.y + (hov ? -1 : 0), rw = B.w - 12;
  ctx.save(); if (!on) ctx.globalAlpha = 0.45;
  if (hov) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const G = ctx.createRadialGradient(cx, ry + B.h / 2, 2, cx, ry + B.h / 2, B.w * 0.6); G.addColorStop(0, hexA(B.col, 0.4)); G.addColorStop(1, hexA(B.col, 0)); ctx.fillStyle = G; ctx.fillRect(B.x - 10, ry - 14, B.w + 20, B.h + 28); ctx.restore(); }
  const rg = ctx.createLinearGradient(0, ry, 0, ry + B.h); rg.addColorStop(0, B.col); rg.addColorStop(1, shadeOf(B.col)); ctx.fillStyle = rg;
  ctx.beginPath(); ctx.moveTo(cx - rw / 2 - 6, ry); ctx.lineTo(cx + rw / 2 + 6, ry); ctx.lineTo(cx + rw / 2, ry + B.h / 2); ctx.lineTo(cx + rw / 2 + 6, ry + B.h); ctx.lineTo(cx - rw / 2 - 6, ry + B.h); ctx.lineTo(cx - rw / 2, ry + B.h / 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff0b8'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.font = `8px ${FEVER.font}`; ctx.strokeStyle = '#10040c'; ctx.lineWidth = 2.5; ctx.strokeText(label, cx, ry + B.h / 2 + 0.5); ctx.fillStyle = '#ffffff'; ctx.fillText(label, cx, ry + B.h / 2 + 0.5);
  ctx.restore();
}
{
  const ug = updateGacha;
  updateGacha = (game, m, dt) => {
    // ALL CARDS (2026-11-18, the user: "only 10 cards showed up for the 1000 card summon"): the reveal shows the ten best; the press that
    // used to leave opens every card of the summon instead, 40 a page (← → or Q / E, the wheel, or a click on either half), Enter / Esc done
    if (m.mileView) { mileUpdate(game, m); return; }
    if (m.allView) {
      const V = m.allView, pages = Math.max(1, Math.ceil(m.all.length / ALLV.per)), k = navInput();
      if (hit('ArrowRight', 'KeyD', 'KeyE') || (mouse.wheel > 0)) V.page = Math.min(pages - 1, V.page + 1);
      if (hit('ArrowLeft', 'KeyA', 'KeyQ') || (mouse.wheel < 0)) V.page = Math.max(0, V.page - 1);
      mouse.wheel = 0;
      if (mouse.click) { if (mouse.y > VH - 26) { m.allView = null; m.results = null; } else V.page = mouse.x > VW / 2 ? Math.min(pages - 1, V.page + 1) : Math.max(0, V.page - 1); mouse.click = false; return; }
      if (k.ok || k.back || hit('Escape', 'Enter', 'Space')) { m.allView = null; m.results = null; }
      return;
    }
    if (m.results && m.all && m.t > 300) {
      const done = m.t > m.intro + REVEAL.flipAt + m.results.length * REVEAL.flipEach + 500;
      if (done && (hit('Enter', 'Space', 'KeyJ', 'KeyF') || mouse.click)) { m.allView = { page: 0 }; mouse.click = false; return; }
    }
    if (!m.results && !hit('Escape')) {
      const pr = game.profile;
      // (x100 / x1000 are tokens on the console now, beside x10: gacha.js GBTN)
      if (hit(SOUL_BTN.melt.key) || clicked(SOUL_BTN.melt.x, SOUL_BTN.melt.y, SOUL_BTN.melt.w, SOUL_BTN.melt.h)) { soulMelt(game, m); mouse.click = false; return; }
      if (hit(SOUL_BTN.coin.key) || clicked(SOUL_BTN.coin.x, SOUL_BTN.coin.y, SOUL_BTN.coin.w, SOUL_BTN.coin.h)) { soulBuyCoin(game); mouse.click = false; return; }
      if (hit('KeyU') || clicked(SOUL_AUTO.x, SOUL_AUTO.y, SOUL_AUTO.w, SOUL_AUTO.h)) { pr.autoMelt = !pr.autoMelt; game.toast(pr.autoMelt ? 'Auto-melt on: spare F-D cards you already hold turn into Souls as you summon' : 'Auto-melt off: every card is kept', '#7ad8b0'); game.save(); mouse.click = false; return; }
      if (hit('KeyT') || clicked(MILE_BTN.x, MILE_BTN.y, MILE_BTN.w, MILE_BTN.h)) { mouse.click = false; if ((pr.miles || 0) < MILE.s) game.toast(`A card of your choice at ${MILE.s} miles (you have ${pr.miles || 0}) · a mile for every card summoned`, '#d8b8ff'); else if (!mileList(pr).length) game.toast('Hold a card first: the trade is for a card you have', '#d8b8ff'); else m.mileView = { cur: 0, scroll: 0, ss: false }; return; }
      void pr;
    }
    return ug(game, m, dt);
  };
  const dg = drawGacha;
  drawGacha = (game, m, now) => {
    const r = dg(game, m, now), pr = game.profile;
    if (m.mileView) { drawMileView(game, m, now); return r; }
    if (m.allView) { drawAllCards(m, now); return r; }
    if (m.results) {   // a big summon: the count of every rank over the ten best
      if (m.tally && m.t >= m.intro) {
        const parts = []; for (let t = 9; t >= 0; t--) if (m.tally[t]) parts.push(`${RANKS[t]} ×${m.tally[t]}`);
        ctx.fillStyle = 'rgba(16,6,22,0.82)'; rrect(ctx, 70, 6, VW - 140, 24, 6); ctx.fill(); ctx.strokeStyle = 'rgba(255,240,184,0.6)'; ctx.lineWidth = 0.8; rrect(ctx, 70.5, 6.5, VW - 141, 23, 6); ctx.stroke();
        text(`×${m.bigN} SUMMON · the ten best below · Enter: see all ${m.bigN}${m.melted ? ` · ${m.melted} melted: +${m.meltSouls} Souls` : ''}`, VW / 2, 13, '#ffe9a8', 7); text(parts.join('  ·  '), VW / 2, 23, '#ffffff', 7);
      }
      return r;
    }
    const coins = pr.coins || 0;
    drawSoulPlate(pr, m, now); drawMilePlate(pr, now);
    return r;
  };
}

// THE ALL CARDS PAGES: every card of a big summon, strongest first, 40 to a page, with where they went
const ALLV = { per: 40, cols: 10, w: 50, h: 62, gx: 8, gy: 6, top: 42 };   // (four rows clear the lines at the foot)
function drawAllCards(m, now) {
  const V = m.allView, L = m.all, pages = Math.max(1, Math.ceil(L.length / ALLV.per)), x0 = (VW - (ALLV.cols * (ALLV.w + ALLV.gx) - ALLV.gx)) / 2;
  ctx.fillStyle = 'rgba(10,4,16,0.94)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle(`×${m.bigN} SUMMON · ALL ${L.length} CARDS`, VW / 2, 14, 12, now);
  const parts = []; for (let t = 9; t >= 0; t--) if (m.tally[t]) parts.push(`${RANKS[t]} ×${m.tally[t]}`);
  text(parts.join('  ·  '), VW / 2, 29, '#ffffff', 7);
  L.slice(V.page * ALLV.per, (V.page + 1) * ALLV.per).forEach((c, i) => {
    const x = x0 + (i % ALLV.cols) * (ALLV.w + ALLV.gx), y = ALLV.top + Math.floor(i / ALLV.cols) * (ALLV.h + ALLV.gy);
    try { drawTFCard(c, x, y, ALLV.w, ALLV.h, now, {}); } catch (e) { ctx.fillStyle = '#302040'; rrect(ctx, x, y, ALLV.w, ALLV.h, 3); ctx.fill(); }
  });
  if (m.melted) text(`${m.melted} spares melted into ${m.meltSouls} Souls (auto-melt)`, VW / 2, VH - 44, '#7ad8b0', 7);
  const where = m.toStore ? `${m.toBag} went to your bag · ${m.toStore} wait in Storage at home (your bag holds 200)` : `all ${m.toBag} went to your bag`;
  text(where, VW / 2, VH - 34, '#bff0d8', 7);
  text(`Page ${V.page + 1} / ${pages}   ·   arrow keys or click a side: pages   ·   Enter / Esc: done`, VW / 2, VH - 16, '#e8dcff', 7);
}

function drawSoulPlate(pr, m, now) {
  const fx = 10, fy = 282, fw = 112, fh = 74, glow = m.soulFx && now - m.soulFx < 900 ? 1 - (now - m.soulFx) / 900 : 0;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 5 * RES; ctx.fillStyle = '#12061c'; rrect(ctx, fx, fy, fw, fh, 7); ctx.fill(); ctx.restore();
  const gg = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh); gg.addColorStop(0, '#fff0b8'); gg.addColorStop(0.5, '#c8861a'); gg.addColorStop(1, '#fff0b8'); ctx.strokeStyle = gg; ctx.lineWidth = 1.8; rrect(ctx, fx, fy, fw, fh, 7); ctx.stroke();
  text('SOULS', fx + fw / 2, fy + 7.5, '#ffe08a', 7);
  const x = fx + 8, y = fy + 13, w = 66, h = 18;   // the counter: the CREDITS LED, in soul green (the AUTO switch beside it)
  ctx.fillStyle = '#04120c'; rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.strokeStyle = `rgba(90,224,168,${0.45 + glow * 0.5})`; ctx.lineWidth = 1 + glow; rrect(ctx, x, y, w, h, 4); ctx.stroke();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `13px ${FEVER.font}`; const v = String(pr.souls || 0).padStart(4, '0');
  ctx.fillStyle = 'rgba(90,224,168,0.12)'; ctx.fillText('8'.repeat(v.length), x + w / 2, y + h / 2 + 0.5); ctx.shadowColor = '#3affb0'; ctx.shadowBlur = (4 + glow * 6) * RES; ctx.fillStyle = '#6affc0'; ctx.fillText(v, x + w / 2, y + h / 2 + 0.5); ctx.restore();
  { const A = SOUL_AUTO, on = !!pr.autoMelt; ctx.fillStyle = on ? '#0a3a24' : '#1a1020'; rrect(ctx, A.x, A.y, A.w, A.h, 4); ctx.fill(); ctx.strokeStyle = on ? '#5ae0a8' : 'rgba(255,240,184,0.4)'; ctx.lineWidth = 1; rrect(ctx, A.x + 0.5, A.y + 0.5, A.w - 1, A.h - 1, 4); ctx.stroke();
    text('AUTO', A.x + A.w / 2, A.y + 6.5, on ? '#8affc8' : '#9a8aa8', 7); text(on ? 'ON' : 'OFF', A.x + A.w / 2, A.y + 14, on ? '#ffffff' : '#7a6a88', 7); }
  const ask = m.meltAsk && now - m.meltAsk < 4000;
  for (const [k, on, label] of [['melt', true, ask ? (Math.floor(now / 300) % 2 ? 'AGAIN?' : 'MELT?') : 'MELT (M)'], ['coin', (pr.souls || 0) >= SOUL.coin, `COIN ${SOUL.coin}✦`]]) {
    const B = SOUL_BTN[k]; cabDome(B.cx, B.cy, 13, 9, B.col, on, on && overBox(B), now);
    text(label, B.cx, B.cy + 18, on ? '#ffffff' : '#9a8aa8', 7);
  }
}

// ---- MILEAGE: the plate on the right of the console, and the page to pick a card
const SOUL_AUTO = { x: 86, y: 294, w: 28, h: 20 };   // (U, or a click: auto-melt on / off)
const MILE_BTN = { x: 528, y: 330, w: 96, h: 24, cx: 606, cy: 338 };   // (the dome and its label: either clicks)
function drawMilePlate(pr, now) {
  const fx = 514, fy = 282, fw = 116, fh = 74, miles = pr.miles || 0, ready = miles >= MILE.s;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 5 * RES; ctx.fillStyle = '#12061c'; rrect(ctx, fx, fy, fw, fh, 7); ctx.fill(); ctx.restore();
  const gg = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh); gg.addColorStop(0, '#fff0b8'); gg.addColorStop(0.5, '#c8861a'); gg.addColorStop(1, '#fff0b8'); ctx.strokeStyle = gg; ctx.lineWidth = 1.8; rrect(ctx, fx, fy, fw, fh, 7); ctx.stroke();
  text('MILEAGE', fx + fw / 2, fy + 7.5, '#ffe08a', 7);
  const x = fx + 8, y = fy + 13, w = fw - 16, h = 18;   // miles on a violet LED, a bar filling toward the next trade
  ctx.fillStyle = '#0e0418'; rrect(ctx, x, y, w, h, 4); ctx.fill();
  const goal = miles >= MILE.s ? MILE.ss : MILE.s, k = Math.min(1, miles / goal); ctx.fillStyle = 'rgba(200,106,255,0.25)'; rrect(ctx, x + 1, y + 1, Math.max(0, (w - 2) * k), h - 2, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(200,106,255,0.6)'; ctx.lineWidth = 1; rrect(ctx, x, y, w, h, 4); ctx.stroke();
  // (past the top goal: just the miles)
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `12px ${FEVER.font}`; ctx.shadowColor = '#c86aff'; ctx.shadowBlur = 4 * RES; ctx.fillStyle = '#e6c8ff'; ctx.fillText(miles >= MILE.ss ? `${miles}` : `${miles}/${goal}`, x + w / 2, y + h / 2 + 0.5); ctx.restore();
  text(`S guaranteed within ${Math.max(1, PITY.n - (pr.pity || 0))}`, fx + fw / 2, fy + 41, '#ffd860', 7);
  cabDome(MILE_BTN.cx, MILE_BTN.cy, 12, 8, '#c86aff', ready, ready && overBox(MILE_BTN), now);
  text('TRADE (T)', MILE_BTN.cx - 42, MILE_BTN.cy + 3, ready ? '#ffffff' : '#9a8aa8', 7);
}
// the cards you can pick: one of each kind you hold (bag or Storage), not fusions, by name
function mileList(pr) {
  const seen = new Map(); for (const c of [...pr.cards, ...((pr.storage && pr.storage.cards) || [])]) if (!c.fusion && SPECIES[c.sp] && !seen.has(c.sp)) seen.set(c.sp, c);
  return [...seen.keys()].sort((a, b) => String(SPECIES[a].name).localeCompare(String(SPECIES[b].name)));
}
const MILEV = { cols: 10, rows: 4, w: 50, h: 62, gx: 8, gy: 6, top: 52 };
function mileUpdate(game, m) {
  const pr = game.profile, V = m.mileView, L = mileList(pr), k = navInput(), per = MILEV.cols * MILEV.rows;
  if (k.back || hit('Escape')) { m.mileView = null; return; }
  if (hit('KeyQ', 'KeyE', 'Tab')) V.ss = !V.ss;
  if (k.l) V.cur = Math.max(0, V.cur - 1); if (k.r) V.cur = Math.min(L.length - 1, V.cur + 1);
  if (k.u) V.cur = Math.max(0, V.cur - MILEV.cols); if (k.d) V.cur = Math.min(L.length - 1, V.cur + MILEV.cols);
  if (mouse.wheel) { V.scroll = Math.max(0, Math.min(Math.max(0, Math.ceil(L.length / MILEV.cols) - MILEV.rows), V.scroll + Math.sign(mouse.wheel))); mouse.wheel = 0; }
  if (V.cur < V.scroll * MILEV.cols) V.scroll = Math.floor(V.cur / MILEV.cols); if (V.cur >= (V.scroll + MILEV.rows) * MILEV.cols) V.scroll = Math.floor(V.cur / MILEV.cols) - MILEV.rows + 1;
  const x0 = (VW - (MILEV.cols * (MILEV.w + MILEV.gx) - MILEV.gx)) / 2;
  for (let i = 0; i < per; i++) { const j = V.scroll * MILEV.cols + i; if (j >= L.length) break; const x = x0 + (i % MILEV.cols) * (MILEV.w + MILEV.gx), y = MILEV.top + Math.floor(i / MILEV.cols) * (MILEV.h + MILEV.gy); if (clicked(x, y, MILEV.w, MILEV.h)) { if (V.cur === j) k.ok = true; V.cur = j; } }
  [false, true].forEach((ss, i) => { if (clicked(VW / 2 - 104 + i * 108, 30, 100, 16)) V.ss = ss; });
  mouse.click = false;
  if (!k.ok || !L[V.cur]) return;
  const cost = V.ss ? MILE.ss : MILE.s, tier = V.ss ? 7 : 6;
  if ((pr.miles || 0) < cost) { game.toast(`${V.ss ? 'SS' : 'S'} costs ${cost} miles (you have ${pr.miles || 0})`, '#ff8a8a'); return; }
  const c = makeCard(L[V.cur], tier); pr.miles -= cost;
  if (pr.cards.length < 200) pr.cards.push(c); else { pr.storage = pr.storage || { cards: [], gear: [] }; pr.storage.cards.push(c); }
  game.toast(`Mileage: ${cardName(c)} at rank ${RANKS[tier]} is yours${pr.cards.includes(c) ? '' : ', waiting in Storage at home'}`, '#d8b8ff'); game.save();
  m.mileView = null;
}
function drawMileView(game, m, now) {
  const pr = game.profile, V = m.mileView, L = mileList(pr), per = MILEV.cols * MILEV.rows, tier = V.ss ? 7 : 6, cost = V.ss ? MILE.ss : MILE.s;
  ctx.fillStyle = 'rgba(10,4,16,0.95)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle(`MILEAGE · ${pr.miles || 0} MILES · PICK A CARD`, VW / 2, 14, 12, now);
  [['S', false, MILE.s], ['SS', true, MILE.ss]].forEach(([lab, ss, c], i) => { const on = V.ss === ss, x = VW / 2 - 104 + i * 108; ctx.fillStyle = on ? 'rgba(200,106,255,0.85)' : 'rgba(40,24,56,0.95)'; rrect(ctx, x, 30, 100, 16, 4); ctx.fill(); text(`RANK ${lab} · ${c} miles`, x + 50, 38.5, on ? '#ffffff' : (pr.miles || 0) >= c ? '#e6c8ff' : '#7a6a88', 7); });
  m.mileCache = m.mileCache || {};
  const x0 = (VW - (MILEV.cols * (MILEV.w + MILEV.gx) - MILEV.gx)) / 2;
  for (let i = 0; i < per; i++) {
    const j = V.scroll * MILEV.cols + i; if (j >= L.length) break; const sp = L[j], key = sp + ':' + tier;
    const c = m.mileCache[key] || (m.mileCache[key] = makeCard(sp, tier)), x = x0 + (i % MILEV.cols) * (MILEV.w + MILEV.gx), y = MILEV.top + Math.floor(i / MILEV.cols) * (MILEV.h + MILEV.gy);
    try { drawTFCard(c, x, y, MILEV.w, MILEV.h, now, { sel: j === V.cur }); } catch (e) {}
    if (j === V.cur) { ctx.strokeStyle = `rgba(255,216,96,${0.6 + 0.4 * Math.sin(now / 180)})`; ctx.lineWidth = 2; rrect(ctx, x - 2, y - 2, MILEV.w + 4, MILEV.h + 4, 4); ctx.stroke(); }
  }
  const sel = L[V.cur]; if (sel) text(`${SPECIES[sel].name} at rank ${RANKS[tier]} for ${cost} miles`, VW / 2, VH - 30, (pr.miles || 0) >= cost ? '#ffe9a8' : '#ff9a8a', 8);
  text('Arrows choose · Q / E: S or SS · Enter: take it · Esc: back · one of each kind of card you hold', VW / 2, VH - 14, '#c8b8e8', 7);
}
