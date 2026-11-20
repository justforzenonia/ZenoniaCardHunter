'use strict';
// THE MARKET (2026-11-19, the user: "let's add a menu where people can sell/trade cards and gears"; they chose a shared market board).
// A MARKET tile on the hub opens it. Three tabs:
//   CARDS / GEAR  every card / gear listing on this game server (tools/serve.py /market/*): buy one with Enter twice (or two clicks).
//             A listing of your own shows YOURS. SORT (the button or F, on every tab): newest, price low / high, best rank, name.
//   SELL      your spare cards and gear (not in your deck, spells, fusion, loadouts or locked, not worn or held by your partner):
//             ← → set a price (it starts at twice the item's worth), Enter twice lists it; S twice QUICK SELLS it to the game
//             for its worth, no buyer needed.
//   MY STALL  your listings (Enter twice takes one back). Gold from sales, and listings a week old, are collected each time
//             you open the market.
// The item leaves your save when you list it and comes back if the server says no. Each item gets a fresh id with its new owner.
// Every player is known to the server by pr.mid (made once) and their hero's name.
const MKT = { F: { x: 34, y: 26, w: 572, h: 300 }, rows: 6, rowH: 36, tabs: ['CARDS', 'GEAR', 'SELL', 'MY STALL'],
  // (2026-11-19, the user: "have a sorting in market and separate card and gear tab in market": BROWSE and its F filter became CARDS and
  // GEAR tabs; SORT, the button or F, orders any list)
  sorts: ['NEWEST', 'PRICE: LOW', 'PRICE: HIGH', 'BEST RANK', 'NAME A-Z'], confirm: 3500, maxPrice: 9999999 };
const mktId = pr => pr.mid || (pr.mid = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const mktName = pr => ((pr.look && pr.look.name) || 'Hero').slice(0, 24);
// what an item is worth to the game (a quick sale), and a round number near a price
// (2026-11-20, the user: "market items seem low when being sold": a quick sale paid about a seventh of what the same thing costs
// in a shop (cards 20 x (rank+1)^2 against the goddess towns' 150 x; gear 8 x against the smith's 30 x). It now pays HALF the
// shop price (MKT_WORTH.k), and a new listing's price starts at twice that, so at about the shop price.)
const MKT_WORTH = { card: 150, k: 0.5 };
const cardWorth = c => Math.round(MKT_WORTH.card * Math.pow((c.tier || 0) + 1, 2) * MKT_WORTH.k * (c.fusion ? 2 : 1));
const mktWorth = (kind, it) => kind === 'card' ? cardWorth(it) : (typeof gearPrice === 'function' ? Math.round(gearPrice(it) * MKT_WORTH.k) : typeof sellGear === 'function' ? sellGear(it) : 10);
const mktRound = v => { const e = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 1)); return Math.max(1, Math.round(v / e) * e); };
// the cards and gear you can sell: nothing in use
function mktSellables(pr) {
  const kept = typeof soulKeptUids === 'function' ? soulKeptUids(pr) : new Set([...(pr.deck || []), ...(pr.spells || []), pr.fusion]);
  const cards = (pr.cards || []).filter(c => !kept.has(c.uid)).map(c => ({ kind: 'card', it: c }));
  const worn = new Set(GEAR_SLOTS.map(s => pr.eq && pr.eq[s]).filter(Boolean));
  const gear = (pr.gear || []).filter(g => !worn.has(g.uid) && !(typeof partnerHolds === 'function' && partnerHolds(pr, g.uid))).map(g => ({ kind: 'gear', it: g }));
  return [...cards, ...gear].sort((a, b) => (b.it.tier || 0) - (a.it.tier || 0));
}
function mktTake(pr, kind, it) {   // the item leaves your save
  if (kind === 'card') { pr.cards = (pr.cards || []).filter(c => c !== it); pr.deck = (pr.deck || []).filter(u => u !== it.uid); }
  else pr.gear = (pr.gear || []).filter(g => g !== it);
}
function mktGive(pr, kind, it) {   // an item joins your save, with a fresh id (in storage when the bag is full)
  const k = JSON.parse(JSON.stringify(it)); k.uid = uid(); pr.storage = pr.storage || { cards: [], gear: [] };
  if (kind === 'card') { if ((pr.cards || []).length >= 120) pr.storage.cards.push(k); else pr.cards.push(k); }
  else { if ((pr.gear || []).length >= 80) pr.storage.gear.push(k); else pr.gear.push(k); }
  return k;
}
const mktItemName = (kind, it) => kind === 'card' ? (typeof cardName === 'function' ? cardName(it) : 'Card') : it.name || 'Gear';
const mktSub = (kind, it) => kind === 'card' ? `Card · rank ${RANKS[it.tier || 0]}${it.fusion ? ' · fusion' : ''}` : `${SLOT_LABEL[it.slot] || 'Gear'} · rank ${RANKS[it.tier || 0]}`;
// talking to the server
async function mktCall(path, body) {
  const r = await fetch(typeof srvUrl === 'function' ? srvUrl(path) : path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok && r.status !== 400) throw new Error('http ' + r.status);
  return r.json();
}
function mktRefresh(game, m) {
  m.loading = true;
  mktCall('/market/list?mid=' + encodeURIComponent(mktId(game.profile))).then(d => { m.list = d.listings || []; m.err = null; m.loading = false; }).catch(() => { m.err = (typeof srvNeeded === 'function' && srvNeeded() && !(typeof srvBase === 'function' ? srvBase() : SET && SET.server)) ? 'Set the GAME SERVER first: Esc > SETTINGS > GAME SERVER, and type the address of the PC running the game.' : (typeof srvBase === 'function' && /^https:/.test(srvBase()) ? `The game server at ${srvHost()} is not answering: try again in a minute` : `The game server${SET && SET.server ? ' at ' + SET.server : ''} is not answering: is it running, and are you on the same network (or Tailscale)?`); m.loading = false; });
}
function mktCollect(game, m) {   // gold from sales and listings sent back, waiting since your last visit
  const pr = game.profile;
  mktCall('/market/collect', { mid: mktId(pr) }).then(d => {
    if (!d) return;
    if (d.gold) pr.gold = (pr.gold || 0) + d.gold;
    for (const b of d.back || []) mktGive(pr, b.kind, b.item);
    for (const s of d.sold || []) game.toast(`MARKET: ${s.buyer} bought your ${(SPECIES[s.name] && SPECIES[s.name].name) || s.name} for ${fmtG(s.price)}`, '#ffd27a');   // (a card's listing knows its card id, not its name)
    if ((d.back || []).length) game.toast(`MARKET: ${d.back.length} listing${d.back.length > 1 ? 's' : ''} a week old came back to you`, '#c9c1a8');
    if (d.gold || (d.back || []).length) game.save();
  }).catch(() => {});
}
function marketMenu(game) {
  const m = { type: 'market', tab: 0, cur: 0, scroll: 0, f: 0, list: null, err: null, ask: 0, askKey: null, price: null, priceFor: null };
  mktRefresh(game, m); mktCollect(game, m); return m;
}
// a press that must come twice: the first arms it (a toast says what will happen), the second within MKT.confirm does it
function mktConfirm(game, m, key, msg, col) {
  const now = performance.now();
  if (m.askKey === key && now - m.ask < MKT.confirm) { m.askKey = null; return true; }
  m.askKey = key; m.ask = now; game.toast(msg, col || '#ffe9a8'); return false;
}
// the rows each tab shows
function mktRows(game, m) {
  const pr = game.profile, me = mktId(pr);
  let rows; mktSort.idx = new Map((m.list || []).map((L, i) => [L.id, i]));
  if (m.tab <= 1) rows = (m.list || []).filter(L => L.kind === (m.tab === 0 ? 'card' : 'gear')).map(L => ({ L, kind: L.kind, it: L.item, mine: L.mine || L.seller === me }));
  else if (m.tab === 2) rows = mktSellables(pr);
  else rows = (m.list || []).filter(L => L.mine || L.seller === me).map(L => ({ L, kind: L.kind, it: L.item, mine: true }));
  return mktSort(rows, m.sort || 0);
}
// SORT: a listing's price (in SELL, what the item is worth), its rank, its name, or newest first (a listing's time; in SELL the bag's order)
function mktSort(rows, how) {
  const price = r => r.L ? r.L.price : mktWorth(r.kind, r.it), name = r => String(mktItemName(r.kind, r.it)).toLowerCase(), rank = r => r.it.tier || 0;
  const pos = r => (r.L && mktSort.idx ? mktSort.idx.get(r.L.id) : 0) || 0;   // (the server's own order breaks ties within a second: it adds new ones last)
  const by = [(a, b) => (b.L ? b.L.at : 0) - (a.L ? a.L.at : 0) || pos(b) - pos(a), (a, b) => price(a) - price(b), (a, b) => price(b) - price(a), (a, b) => rank(b) - rank(a) || price(a) - price(b), (a, b) => name(a).localeCompare(name(b))][how];
  return how === 0 && !rows.some(r => r.L) ? rows : rows.slice().sort(by);
}
const mktRow = i => ({ x: MKT.F.x + 14, y: MKT.F.y + 46 + i * MKT.rowH, w: MKT.F.w - 28, h: MKT.rowH - 4 });
const mktTab = i => ({ x: MKT.F.x + 14 + i * 100, y: MKT.F.y + 14, w: 96, h: 20 });
const mktSortBtn = () => ({ x: MKT.F.x + 416, y: MKT.F.y + 15, w: 88, h: 18 });
const mktBtn = (i, n = 2) => { const w = 150, gap = 10, x0 = MKT.F.x + MKT.F.w - 14 - n * w - (n - 1) * gap; return { x: x0 + i * (w + gap), y: MKT.F.y + MKT.F.h - 34, w, h: 22 }; };
function mktBuy(game, m, r) {
  const pr = game.profile;
  if (r.mine) { game.toast('That listing is yours: take it back in MY STALL', '#c9c1a8'); return; }
  if ((pr.gold || 0) < r.L.price) { game.toast(`Not enough gold (${fmtG(r.L.price)})`, '#ff8a8a'); return; }
  if (!mktConfirm(game, m, 'buy' + r.L.id, `Buy ${mktItemName(r.kind, r.it)} for ${fmtG(r.L.price)}? Press again`, '#ffd27a')) return;
  m.busy = true;
  mktCall('/market/buy', { mid: mktId(pr), bname: mktName(pr), id: r.L.id }).then(d => {
    m.busy = false;
    if (!d || d.err) { game.toast(d && d.err === 'gone' ? 'Someone else bought it first' : `Could not buy it${d && d.err ? ': ' + d.err : ''}`, '#ff8a8a'); mktRefresh(game, m); return; }
    pr.gold = Math.max(0, (pr.gold || 0) - d.price); mktGive(pr, d.kind, d.item); game.save(); if (game.refreshPlayer) game.refreshPlayer();
    game.toast(`Bought ${mktItemName(d.kind, d.item)} for ${fmtG(d.price)}`, '#8fffd0'); mktRefresh(game, m);
  }).catch(() => { m.busy = false; game.toast('The market server did not answer', '#ff8a8a'); });
}
function mktList(game, m, r) {
  const pr = game.profile, price = m.price;
  if (!mktConfirm(game, m, 'list' + r.it.uid + ':' + price, `List ${mktItemName(r.kind, r.it)} for ${fmtG(price)}? Press again`, '#ffd27a')) return;
  mktTake(pr, r.kind, r.it); game.save(); m.busy = true;
  mktCall('/market/post', { mid: mktId(pr), sname: mktName(pr), kind: r.kind, item: r.it, price }).then(d => {
    m.busy = false;
    if (!d || d.err) { (r.kind === 'card' ? pr.cards : pr.gear).push(r.it); game.save(); game.toast(`Not listed${d && d.err ? ': ' + d.err : ''}`, '#ff8a8a'); return; }
    game.toast(`Listed ${mktItemName(r.kind, r.it)} for ${fmtG(price)} · anyone on this server can buy it`, '#8fffd0'); mktRefresh(game, m);
  }).catch(() => { m.busy = false; (r.kind === 'card' ? pr.cards : pr.gear).push(r.it); game.save(); game.toast('The market server did not answer · nothing was listed', '#ff8a8a'); });
}
function mktQuickSell(game, m, r) {
  const pr = game.profile, v = mktWorth(r.kind, r.it);
  if (!mktConfirm(game, m, 'quick' + r.it.uid, `Sell ${mktItemName(r.kind, r.it)} to the game for ${fmtG(v)}? Press again`, '#ffe9a8')) return;
  mktTake(pr, r.kind, r.it); pr.gold = (pr.gold || 0) + v; game.save(); game.toast(`Sold ${mktItemName(r.kind, r.it)} for ${fmtG(v)}`, '#ffd23f');
}
function mktCancel(game, m, r) {
  const pr = game.profile;
  if (!mktConfirm(game, m, 'back' + r.L.id, `Take ${mktItemName(r.kind, r.it)} off the market? Press again`, '#ffe9a8')) return;
  m.busy = true;
  mktCall('/market/cancel', { mid: mktId(pr), id: r.L.id }).then(d => {
    m.busy = false;
    if (!d || d.err) { game.toast(d && d.err === 'gone' ? 'Too late: it has just been sold' : 'Could not take it back', '#ff8a8a'); mktRefresh(game, m); mktCollect(game, m); return; }
    mktGive(pr, d.kind, d.item); game.save(); game.toast(`${mktItemName(d.kind, d.item)} is back in your bag`, '#8fffd0'); mktRefresh(game, m);
  }).catch(() => { m.busy = false; game.toast('The market server did not answer', '#ff8a8a'); });
}
function updateMarket(game, m, dt) {
  const k = navInput(), rows = mktRows(game, m), n = rows.length;
  if (k.back) { game.closeMenu(); return; }
  const nt = MKT.tabs.length;
  if (hit('KeyE', 'Tab')) { m.tab = (m.tab + 1) % nt; m.cur = 0; m.scroll = 0; }
  else if (hit('KeyQ')) { m.tab = (m.tab + nt - 1) % nt; m.cur = 0; m.scroll = 0; }
  MKT.tabs.forEach((_, i) => { const B = mktTab(i); if (clicked(B.x, B.y, B.w, B.h)) { m.tab = i; m.cur = 0; m.scroll = 0; } });
  { const B = mktSortBtn(); if (hit('KeyF') || clicked(B.x, B.y, B.w, B.h)) { m.sort = ((m.sort || 0) + 1) % MKT.sorts.length; m.cur = 0; m.scroll = 0; } }
  if (hit('KeyR') && !m.loading) mktRefresh(game, m);
  if (n) {
    if (k.u) m.cur = Math.max(0, m.cur - 1); if (k.d) m.cur = Math.min(n - 1, m.cur + 1);
    m.cur = Math.min(m.cur, n - 1);
    if (m.cur < m.scroll) m.scroll = m.cur; if (m.cur >= m.scroll + MKT.rows) m.scroll = m.cur - MKT.rows + 1;
    for (let i = 0; i < MKT.rows; i++) { const B = mktRow(i), idx = m.scroll + i; if (idx < n && clicked(B.x, B.y, B.w, B.h)) { if (m.cur === idx) k.ok = true; m.cur = idx; } }
  }
  const r = rows[m.cur];
  if (m.tab === 2 && r) {   // the price of the picked item
    const key = r.it.uid; if (m.priceFor !== key) { m.priceFor = key; m.price = mktRound(mktWorth(r.kind, r.it) * 2); }
    const step = mktRound(Math.max(10, m.price * 0.1));
    if (k.l) m.price = Math.max(1, m.price - step); if (k.r) m.price = Math.min(MKT.maxPrice, m.price + step);
    const B0 = mktBtn(0), B1 = mktBtn(1);
    if (clicked(B0.x, B0.y, B0.w, B0.h)) mktQuickSell(game, m, r); else if (clicked(B1.x, B1.y, B1.w, B1.h)) k.ok = true;
    if (hit('KeyS') && !m.busy) mktQuickSell(game, m, r);
  }
  if (k.ok && r && !m.busy) { if (m.tab <= 1) mktBuy(game, m, r); else if (m.tab === 2) mktList(game, m, r); else mktCancel(game, m, r); }
}
function mktThumb(kind, it, x, y, now) {
  if (kind === 'card') { try { drawCardFront(it, x + 4, y + 1, 22, 30, now, { small: true }); } catch (e) {} }
  else { ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, x + 2, y + 2, 28, 28, 4); ctx.fill(); iconCentered('items', it.icon, x + 16, y + 16, 24); }
}
function drawMarket(game, m, now) {
  const pr = game.profile, F = MKT.F, rows = mktRows(game, m);
  ctx.fillStyle = 'rgba(8,5,3,0.72)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = typeof WIN_FILL !== 'undefined' ? WIN_FILL : '#22160f'; rrect(ctx, F.x, F.y, F.w, F.h, 8); ctx.fill();
  ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 1.2; rrect(ctx, F.x + 0.5, F.y + 0.5, F.w - 1, F.h - 1, 8); ctx.stroke();
  MKT.tabs.forEach((t, i) => { const B = mktTab(i), on = m.tab === i; ctx.fillStyle = on ? '#b8740f' : 'rgba(60,40,24,0.95)'; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill(); ctx.strokeStyle = on ? '#ffe08a' : '#7a5a34'; ctx.lineWidth = 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 4); ctx.stroke(); text(t, B.x + B.w / 2, B.y + B.h / 2 + 0.5, on ? '#ffffff' : '#ffe9a8', 8.5); });
  text(`${fmtG(pr.gold || 0)}`, F.x + F.w - 16, F.y + 24, '#ffd23f', 9, 'right');
  { const B = mktSortBtn(), on = !!(m.sort || 0); ctx.fillStyle = on ? 'rgba(184,116,15,0.55)' : 'rgba(60,40,24,0.95)'; rrect(ctx, B.x, B.y, B.w, B.h, 9); ctx.fill(); ctx.strokeStyle = on ? '#ffe08a' : '#7a5a34'; ctx.lineWidth = 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 9); ctx.stroke();
    text(`SORT: ${MKT.sorts[m.sort || 0]}`, B.x + B.w / 2, B.y + B.h / 2 + 0.5, '#ffe9a8', 7); }
  // the list
  if (m.err && m.tab !== 2) wrap(m.err, F.w - 80, 8).forEach((l, i) => text(l, F.x + F.w / 2, F.y + 120 + i * 13, '#ff9a8a', 8));
  else if (m.loading && !m.list && m.tab !== 2) text('Opening the market…', F.x + F.w / 2, F.y + 130, '#c9b89a', 8);
  else if (!rows.length) text(m.tab <= 1 ? `No ${m.tab === 0 ? 'cards' : 'gear'} for sale yet · list something in SELL` : m.tab === 2 ? 'Nothing spare to sell: cards in use and worn gear stay with you' : 'You have nothing listed', F.x + F.w / 2, F.y + 130, '#c9b89a', 8);
  for (let i = 0; i < MKT.rows; i++) {
    const idx = m.scroll + i, r = rows[idx]; if (!r) break;
    const B = mktRow(i), sel = m.cur === idx, it = r.it;
    ctx.fillStyle = sel ? 'rgba(255,216,96,0.14)' : 'rgba(255,255,255,0.05)'; rrect(ctx, B.x, B.y, B.w, B.h, 5); ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 5); ctx.stroke(); }
    mktThumb(r.kind, it, B.x, B.y, now);
    text(mktItemName(r.kind, it), B.x + 40, B.y + 11, typeof rankColor === 'function' ? rankColor(it.tier || 0, now) : '#ffffff', 9, 'left');
    text(mktSub(r.kind, it) + (r.L && m.tab <= 1 ? ` · from ${r.L.sname}` : ''), B.x + 40, B.y + 24, '#c9b89a', 7.5, 'left');
    if (m.tab <= 1) text(r.mine ? 'YOURS' : fmtG(r.L.price), B.x + B.w - 10, B.y + B.h / 2 + 0.5, r.mine ? '#8fffd0' : (pr.gold || 0) >= r.L.price ? '#ffd23f' : '#8a6a4a', 9, 'right');
    else if (m.tab === 2) text(`worth ${fmtG(mktWorth(r.kind, it))}`, B.x + B.w - 10, B.y + B.h / 2 + 0.5, '#c9b89a', 8, 'right');
    else text(`listed · ${fmtG(r.L.price)}`, B.x + B.w - 10, B.y + B.h / 2 + 0.5, '#ffd23f', 8.5, 'right');
  }
  if (rows.length > MKT.rows) text(`${m.scroll + 1}–${Math.min(rows.length, m.scroll + MKT.rows)} of ${rows.length}`, F.x + 20, F.y + F.h - 22, '#9a917c', 7, 'left');
  // the SELL tab's price bar and buttons
  const r = rows[m.cur];
  if (m.tab === 2 && r && m.price != null) {
    text(`Price  < ${fmtG(m.price)} >`, F.x + 130, F.y + F.h - 22, '#ffe9a8', 9, 'left');
    const B0 = mktBtn(0), B1 = mktBtn(1);
    popupButton(Object.assign({}, B0, { label: `QUICK SELL ${fmtG(mktWorth(r.kind, r.it))}` }), now);
    popupButton(Object.assign({}, B1, { label: 'LIST ON MARKET', primary: true }), now);
  }
  const buyHelp = 'Q / E tabs · up / down choose · Enter buy (twice) · F sort · R refresh · Esc leave';   // (words, not arrow glyphs: those draw blank)
  const help = [buyHelp, buyHelp, 'Q / E tabs · up / down choose · left / right price · Enter list (twice) · S quick sell (twice) · F sort · Esc leave', 'Q / E tabs · up / down choose · Enter take back (twice) · F sort · Esc leave'][m.tab];
  text(help, VW / 2, F.y + F.h + 14, '#c9b89a', 7);
  if (typeof goldTitle === 'function') goldTitle('MARKET', F.x + F.w / 2, F.y - 8, 12, now);
}
// the hub tile
{
  const at = HUB_OPTS.findIndex(o => o.id === 'quit');
  HUB_OPTS.splice(at < 0 ? HUB_OPTS.length : at, 0, { id: 'market', title: 'MARKET', sub: 'Trade cards and gear with players', icon: '⇋', col: '#ffd27a' });
  const row = HUB_GRID.find(r => r.includes('quit')); if (row && !row.includes('market')) row.splice(row.indexOf('quit'), 0, 'market');
  const hc = hubChoose;
  hubChoose = (game, id) => id === 'market' ? game.openMenu(marketMenu(game)) : hc(game, id);
}
