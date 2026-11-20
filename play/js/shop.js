'use strict';
// Village merchants, paid in gold (monsters drop it; selling loot earns it).
//   Smith  (shop_gear) — a fresh set of gear every hour, one piece per slot at your level's rank (weapons for your
//                        class); buys the gear waiting in your storage.
//   Grocer (shop_item) — potions, bread and seeds; buys goods, crops and food from your bag.

function shopMenu(role) { return { type: 'shop', role, tab: 0, cur: 0, scroll: 0, confirm: null }; }
const SHOP_TABS = ['BUY', 'SELL'];
const potionIdx = sub => { const L = Z2_GOODS.filter(it => it.sub === sub && !/bread/i.test(it.name)).sort((a, b) => a.lv - b.lv); return L[0] && L[0].idx; };   // (one Zenonia 2 MP item is called Bread — skip it next to our own bread)
const POTION_PRICE = { 10: 30, 11: 45, 12: 30, 26: 40 };
const goodsSell = it => 3 + (it.tier || 0) * 5 + (GOODS_USE[it.sub] ? 6 : 0);

// the Smith's stock: seeded by the hour so it changes over time but not every visit
function smithStock(pr) {
  const hour = Math.floor(Date.now() / 3600000), R = seededRng(hour * 31 + (pr.cls + 1) * 977);
  const tier = clamp(Math.floor(((pr.lv || 1) - 1) / 7), 0, 6);
  const keep = Math.random; Math.random = R;   // makeGear rolls with Math.random: borrow the seeded one
  try { return GEAR_SLOTS.map(slot => { const g = makeGear(slot, clamp(tier + (R() < 0.25 ? 1 : 0), 0, 9), pr.cls); g.uid = 'shop' + hour + slot; return g; }); }
  finally { Math.random = keep; }
}
// THE OUTPOST MERCHANTS: the Weaponsmith (three weapons for your class, a rank apart) and the Armorer (helm, armour, boots,
// accessory, trinket). Their stock is seeded by the hour and the town, and never below the town's rank floor
// (the further west the town, the better the goods: Mossbrook E, Duskhollow D, Cloudhold B, Frostmere S).
const TOWN_FLOOR = [1, 2, 4, 6];
const townHere = game => { const O = game.world && game.world.player && outpostAt(game.world.player.x); return O ? O.i : 0; };
function townStock(pr, kind, ti) {
  const hour = Math.floor(Date.now() / 3600000), R = seededRng(hour * 53 + ti * 7919 + (pr.cls + 1) * 131 + (kind === 'weapon' ? 1 : 2));
  const base = Math.max(clamp(Math.floor(((pr.lv || 1) - 1) / 7), 0, 6), TOWN_FLOOR[ti] || 0);
  const slots = kind === 'weapon' ? ['weapon', 'weapon', 'weapon'] : ['head', 'body', 'boots', 'accessory', 'trinket'];
  const up = (i) => kind === 'weapon' ? i : i === slots.length - 1 ? 1 : R() < 0.3 ? 1 : 0;   // weapons: one each of three ranks
  const keep = Math.random; Math.random = R;
  try { return slots.map((slot, i) => { const g = makeGear(slot, clamp(base + up(i), 0, 9), pr.cls); g.uid = `tshop${ti}${kind}${hour}_${i}`; return g; }); }
  finally { Math.random = keep; }
}
const GEAR_SHOPS = { shop_gear: null, shop_weapon: 'weapon', shop_armor: 'armor' };
const gearPrice = g => Math.round(30 * Math.pow(g.tier + 1, 2) + gearScore(g) * 2);
function shopRows(game, m) {
  const pr = game.profile;
  if (m.role in GEAR_SHOPS && m.tab === 2) return repairRows(game);   // REPAIR (durability.js)
  if (m.role in GEAR_SHOPS) {
    const kind = GEAR_SHOPS[m.role], fits = g => !kind || (kind === 'weapon') === (g.slot === 'weapon');   // each buys its own kind
    if (m.tab === 0) {
      const bought = new Set(pr.shopBought || []);
      return (kind ? townStock(pr, kind, townHere(game)) : smithStock(pr)).filter(g => !bought.has(g.uid)).map(g => ({ ref: g, icon: g.icon, name: g.name, sub: `${SLOT_LABEL[g.slot]} · ${gearLines(g).slice(0, 2).join(' · ')}${isUpgrade(pr, g) ? ' · ▲ upgrade' : ''}`, right: `${gearPrice(g)} G`, col: rankColor(g.tier), rightCol: (pr.gold || 0) >= gearPrice(g) ? '#ffd23f' : '#8a6a4a' }));
    }
    const worn = new Set(Object.values(pr.eq || {})), bag = pr.gear.filter(g => !worn.has(g.uid) && fits(g)), S = [...bag, ...((pr.storage || {}).gear || []).filter(fits)].filter(g => !(pr.gearLock || []).includes(g.uid));   // (locked gear is never offered: invextras.js)
    return S.slice().sort((a, b) => b.tier - a.tier).map(g => ({ ref: g, icon: g.icon, name: g.name, sub: `from your ${bag.includes(g) ? 'bag' : 'storage'} · ${SLOT_LABEL[g.slot]}`, right: `+${sellGear(g)} G`, col: rankColor(g.tier) }));
  }
  if (m.tab === 0) {
    const out = [];
    for (const sub of [10, 12, 11, 26]) { const idx = potionIdx(sub); if (idx != null) out.push({ goods: idx, icon: ITEM2_BASE + idx, name: Z2_ITEM[idx].name, sub: GOODS_USE[sub].what, right: `${POTION_PRICE[sub]} G`, price: POTION_PRICE[sub] }); }
    for (const id of ['bread', 'rope', 'seed_wheat', 'seed_carrot', 'seed_tomato', 'seed_berry', 'seed_lettuce', 'seed_nectarine', 'seed_pumpkin', 'seed_moonflower', 'seed_dragonfruit', seasonWeek(pr).seed]) out.push({ item: id, icon: itemIcon(id), name: ITEMS[id].name, sub: ITEMS[id].desc, right: `${ITEMS[id].price} G`, price: ITEMS[id].price });
    for (const r of out) r.rightCol = (pr.gold || 0) >= r.price ? '#ffd23f' : '#8a6a4a';
    return out;
  }
  const out = [];
  for (const e of goodsList(pr)) {
    if (e.it.home) { const I = ITEMS[e.it.home]; if (I.sell) out.push({ item: e.it.home, icon: itemIcon(e.it.home), name: `${I.name}  ×${e.n}`, sub: I.desc, right: `+${I.sell} G`, value: I.sell }); }
    else out.push({ goods: e.idx, icon: ITEM2_BASE + e.idx, name: `${e.it.name}  ×${e.n}`, sub: goodsInfo(e.idx), right: `+${goodsSell(e.it)} G`, value: goodsSell(e.it) });
  }
  return out;
}
function updateShop(game, m) {
  const pr = game.profile, rows = shopRows(game, m), nav = panelNav(m, rows.length, m.role in GEAR_SHOPS ? 3 : 2), r = rows[m.cur];
  if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok || !r) return;
  if (m.tab === 2) { repairPick(game, r); return; }
  if (m.tab === 0) {   // buy
    const price = r.ref ? gearPrice(r.ref) : r.price;
    if ((pr.gold || 0) < price) { game.toast(`Not enough gold (${price} G)`, '#ff8a8a'); return; }
    pr.gold -= price;
    if (r.ref) {
      const g = { ...r.ref, uid: uid() }; (pr.shopBought = pr.shopBought || []).push(r.ref.uid);
      pr.gear.push(g);
      const up = equipBest(pr).includes(g);
      game.toast(up ? `Bought and equipped ${g.name}` : `Bought ${g.name} — it's in your bag`, up ? '#8fffd0' : '#ffe9a8');
      game.refreshPlayer();
    } else if (r.goods != null) { pr.goods = pr.goods || {}; pr.goods[r.goods] = (pr.goods[r.goods] || 0) + 1; game.toast(`Bought ${r.name}`, '#ffe9a8'); }
    else { addItem(pr, r.item, 1); game.toast(`Bought ${ITEMS[r.item].name}`, '#ffe9a8'); }
  } else {             // sell
    if (r.ref) { const list = pr.gear.includes(r.ref) ? pr.gear : pr.storage.gear; list.splice(list.indexOf(r.ref), 1); pr.gold = (pr.gold || 0) + sellGear(r.ref); game.toast(`Sold ${r.ref.name} for ${sellGear(r.ref)} G`, '#ffd23f'); }
    else if (r.item) { addItem(pr, r.item, -1); pr.gold = (pr.gold || 0) + r.value; game.toast(`Sold ${ITEMS[r.item].name} for ${r.value} G`, '#ffd23f'); }
    else { if (--pr.goods[r.goods] <= 0) delete pr.goods[r.goods]; pr.gold = (pr.gold || 0) + r.value; game.toast(`Sold for ${r.value} G`, '#ffd23f'); }
  }
  game.save();
}
function drawShop(game, m, now) {
  const pr = game.profile, smith = m.role in GEAR_SHOPS, town = OUTPOSTS[townHere(game)];
  const title = { shop_gear: 'SMITHY · WEAPONS & ARMOUR', shop_weapon: `WEAPONSMITH · ${town ? town.name.toUpperCase() : ''}`, shop_armor: `ARMORER · ${town ? town.name.toUpperCase() : ''}` }[m.role] || 'GENERAL STORE';
  panelMenu(m, { title, gold: pr.gold || 0, tabs: smith ? [...SHOP_TABS, 'REPAIR'] : SHOP_TABS, rows: shopRows(game, m),
    empty: m.tab === 0 ? 'Sold out — new stock arrives every hour.' : m.tab === 2 ? 'Everything you carry is in good repair.' : smith ? 'No gear in your storage to sell.' : 'Nothing in your bag to sell.',
    info: m.tab === 0 && smith ? (m.role === 'shop_gear' ? 'New stock every hour · ranks follow your level' : `New stock every hour · rank ${RANKS[TOWN_FLOOR[townHere(game)] || 0]} or better here`) : '', keys: smith ? '←→ buy / sell / repair · ↑↓ choose · Enter confirm · Esc close' : m.tab === 1 ? '←→ buy / sell · ↑↓ choose · Enter sell one · R sell the stack · Esc close' : '←→ buy / sell · ↑↓ choose · Enter confirm · Esc close' }, now);
}
