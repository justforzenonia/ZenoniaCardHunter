'use strict';
// FOOD CARDS (2026-11-19, the user: "create new cards using food icon that can only be obtained from goddess for 1000 of that
// cards food, example carrot card 1000 they all give a decent buf that range from 5 seconds to 15").
// One card per farm food, drawn with that food's own icon. The goddess sells each on her FOOD CARDS tab for FOODC.price of
// that food from your bag (1000 carrots for the Carrot Card), once per hero (pr.foodCards). Cast like any card from the action
// bar, it gives YOU one short buff (5 to 15 s); a new food buff replaces the one before. A small icon and bar over the hero show
// what is up and how long is left.
// CAMPFIRE CARDS (the same day, the user: "do the same for food that can only be created from cooked fire but it cost 100"): one
// card for every dish cooked at the campfire (home.js CAMPFIRE_RECIPES), FOODC.firePrice of that dish each; their buffs are a
// little stronger, and often two at once, since the dishes take more to make.
// BUTCHER CARDS (the same day, the user: "and same for butchered card" / "cost 1,500 for 1 card, and sort them in there own tabs"):
// one card for each thing the butcher gives (animals.js butcherUse: Raw Meat, and craft.js's Thin Leather and Huge Bone),
// FOODC.butcherPrice of it each. The goddess's FOOD CARDS tab now has its own three tabs: FARM, CAMPFIRE, BUTCHER.
const FOODC = { price: 1000, firePrice: 100, butcherPrice: 1500, tier: 6, cd: 24000, mp: 12, rows: 5, rowH: 40 };
// id: [food, name, element, sig, buff label, secs, effect]
//   dmg: hits deal more · guard: blows hurt less · crit: + crit chance · speed: faster · heal: HP a second · mp: MP a second
//   cdr: cooldowns run faster · shield: a shield of max HP · steal: HP back from the damage you deal
const FOOD_CARDS = {
  fc_wheat:     ['wheat',     'Wheat Card',      'earth',     'barrier', 'Golden Grain',  10, { guard: 0.25 }],
  fc_carrot:    ['carrot',    'Carrot Card',     'wind',      'crit',    'Sharp Eyes',    10, { crit: 40 }],
  fc_tomato:    ['tomato',    'Tomato Card',     'fire',      'brutal',  'Ripe Fury',      8, { dmg: 0.35 }],
  fc_pumpkin:   ['pumpkin',   'Pumpkin Card',    'earth',     'barrier', 'Pumpkin Shell', 15, { shield: 0.3 }],
  fc_berry:     ['berry',     'Strawberry Card', 'wind',      'swift',   'Sweet Rush',    12, { speed: 0.35 }],
  fc_lettuce:   ['lettuce',   'Lettuce Card',    'poison',    'regen',   'Fresh Leaf',    15, { heal: 0.03 }],
  fc_nectarine: ['nectarine', 'Nectarine Card',  'lightning', 'mana',    'Sunny Spring',  10, { cdr: 1 }],
  fc_egg:       ['egg',       'Egg Card',        'holy',      'brutal',  'Yolk Burst',     5, { dmg: 0.8 }],
  fc_milk:      ['milk',      'Milk Card',       'holy',      'mana',    'Calcium Guard', 12, { mp: 0.04, guard: 0.15 }],
  fc_fish:      ['fish',      'Fish Card',       'ice',       'vamp',    'Fresh Catch',   10, { steal: 0.15 }],
  // the campfire's dishes
  fc_firecarrot:   ['firecarrot',   'Fire-Roasted Carrot Card', 'fire',      'crit',    'Keen Eye',       10, { crit: 50 }],
  fc_chartomato:   ['chartomato',   'Charred Tomato Card',      'fire',      'brutal',  'Charred Fury',    8, { dmg: 0.45 }],
  fc_toastberry:   ['toastberry',   'Toasted Berry Card',       'wind',      'swift',   'Toasted Rush',   12, { speed: 0.4 }],
  fc_emberpump:    ['emberpump',    'Ember Pumpkin Card',       'fire',      'barrier', 'Ember Shell',    15, { shield: 0.4 }],
  fc_flatbread:    ['flatbread',    'Flatbread Card',           'earth',     'barrier', 'Hearth Bread',   12, { guard: 0.3 }],
  fc_skewer:       ['skewer',       'Meat Skewer Card',         'fire',      'brutal',  'Skewer Strike',   8, { dmg: 0.3, crit: 20 }],
  fc_smokedmeat:   ['smokedmeat',   'Smoked Meat Card',         'dark',      'hide',    'Smoked Hide',    12, { guard: 0.35 }],
  fc_friedegg:     ['friedegg',     'Fried Egg Card',           'fire',      'burst',   'Sizzle',          5, { dmg: 1.0 }],
  fc_eggtoast:     ['eggtoast',     'Egg on Toast Card',        'holy',      'regen',   'Morning Toast',  10, { heal: 0.03, guard: 0.1 }],
  fc_warmmilk:     ['warmmilk',     'Warm Milk Card',           'holy',      'mana',    'Warm Calm',      12, { mp: 0.05 }],
  fc_cheesetoast:  ['cheesetoast',  'Cheese Toast Card',        'earth',     'barrier', 'Gooey Guard',    12, { shield: 0.3, guard: 0.15 }],
  fc_trailstew:    ['trailstew',    'Trail Stew Card',          'earth',     'swift',   'Trail Legs',     15, { speed: 0.3, heal: 0.015 }],
  fc_pumpsoup:     ['pumpsoup',     'Pumpkin Soup Card',        'holy',      'regen',   'Hearty Soup',    15, { heal: 0.04 }],
  fc_compote:      ['compote',      'Berry Compote Card',       'wind',      'mana',    'Sweet Focus',    10, { cdr: 1, mp: 0.03 }],
  fc_grillnect:    ['grillnect',    'Grilled Nectarine Card',   'lightning', 'mana',    'Sun Grill',      10, { cdr: 1.5 }],
  fc_lettucewrap:  ['lettucewrap',  'Lettuce Wrap Card',        'poison',    'regen',   'Green Wrap',     12, { heal: 0.025, speed: 0.2 }],
  fc_truffletoast: ['truffletoast', 'Truffle Toast Card',       'dark',      'vamp',    'Rich Bite',      10, { dmg: 0.4, steal: 0.1 }],
  fc_carrotcake:   ['carrotcake',   'Carrot Cake Card',         'wind',      'crit',    'Sweet Insight',  10, { crit: 30, cdr: 0.5 }],
  fc_moontea:      ['moontea',      'Moonflower Tea Card',      'dark',      'mana',    'Moonlit Mind',   15, { mp: 0.06, cdr: 0.5 }],
  fc_grilledfish:  ['grilledfish',  'Grilled Fish Card',        'ice',       'vamp',    'Crisp Catch',    10, { steal: 0.2 }],
  fc_fishskewer:   ['fishskewer',   'Fish Skewer Card',         'ice',       'brutal',  'Sea Strike',      8, { dmg: 0.35, steal: 0.1 }],
  fc_smokedfish:   ['smokedfish',   'Smoked Fish Card',         'ice',       'hide',    'Brine Hide',     12, { guard: 0.3, heal: 0.02 }],
  fc_fishstew:     ['fishstew',     'Fish Stew Card',           'ice',       'regen',   'Warm Tide',      15, { heal: 0.03, mp: 0.03 }],
  fc_fishpie:      ['fishpie',      'Fish Pie Card',            'earth',     'barrier', 'Proper Crust',   12, { shield: 0.35 }],
  fc_prizefillet:  ['prizefillet',  'Prize Fillet Card',        'ice',       'crit',    'Prize Form',     10, { dmg: 0.5, crit: 30 }],
  fc_seafeast:     ['seafeast',     'Feast of the Deep Card',   'ice',       'unstop',  'Deep Feast',     15, { dmg: 0.3, guard: 0.3, heal: 0.02 }],
  // the butcher's (a material is its number in the goods list, craft.js MAT)
  fc_meat:         ['meat',         'Raw Meat Card',            'fire',      'brutal',  "Butcher's Grit", 10, { dmg: 0.5, speed: 0.15 }],
  fc_leather:      [MAT.thinL,      'Thin Leather Card',        'earth',     'barrier', 'Tanned Hide',    15, { guard: 0.35, shield: 0.2 }],
  fc_bone:         [MAT.bone,       'Huge Bone Card',           'dark',      'brutal',  'Bone Breaker',    8, { dmg: 0.6, crit: 25 }],
};
const FIRE_FOODS = new Set(typeof CAMPFIRE_RECIPES !== 'undefined' ? CAMPFIRE_RECIPES.map(R => R.out) : []);
const BUTCHER_GOODS = new Set(['meat', MAT.thinL, MAT.bone]);
const foodGroup = id => { const f = FOOD_CARDS[id][0]; return BUTCHER_GOODS.has(f) ? 2 : FIRE_FOODS.has(f) ? 1 : 0; };   // 0 farm, 1 campfire, 2 butcher
const FOOD_GROUPS = [{ name: 'FARM', price: FOODC.price }, { name: 'CAMPFIRE', price: FOODC.firePrice }, { name: 'BUTCHER', price: FOODC.butcherPrice }];
const foodPrice = id => FOOD_GROUPS[foodGroup(id)].price;
// a card's food: its icon, its name, how many you have (a crop or dish in pr.items, or a material in pr.goods)
const fcIcon = f => matIcon(f), fcName = f => matName(f), fcHave = (pr, f) => matHave(pr, f);
const foodBuffText = (E, secs) => [E.dmg && `+${Math.round(E.dmg * 100)}% damage`, E.guard && `-${Math.round(E.guard * 100)}% damage taken`, E.crit && `+${E.crit}% critical`,
  E.speed && `+${Math.round(E.speed * 100)}% speed`, E.heal && `heal ${Math.round(E.heal * 100)}% HP a second`, E.mp && `${Math.round(E.mp * 100)}% MP a second`,
  E.cdr && (E.cdr === 1 ? 'cooldowns run twice as fast' : `cooldowns run ${1 + E.cdr}x as fast`), E.shield && `a ${Math.round(E.shield * 100)}% HP shield`, E.steal && `${Math.round(E.steal * 100)}% of damage dealt back as HP`].filter(Boolean).join(', ') + ` for ${secs}s`;
const FX_OF = { earth: FX.ROCKS, wind: FX.WIND, fire: FX.FLAME, poison: FX.STORM, lightning: FX.LIGHTNING, holy: FX.HOLY, ice: FX.ICE, dark: FX.VORTEX };
for (const [id, [food, name, el, sig, buff, secs, E]] of Object.entries(FOOD_CARDS)) {
  if (typeof food === 'number' ? !(Z2_ITEM[food]) : !ITEMS[food]) continue;
  SPECIES[id] = { name, food, sig, trait: buff, spell: { n: buff, a: 'nova', el, fx: FX_OF[el] || FX.HOLY, icon: 31, sx: 'food', cd: FOODC.cd, mp: FOODC.mp, d: cap(foodBuffText(E, secs)) } };
}
const FOOD_CARD_IDS = Object.keys(FOOD_CARDS).filter(id => SPECIES[id]);
const fcList = g => FOOD_CARD_IDS.filter(id => foodGroup(id) === g);
// the card's portrait: its food, big
{
  const mp = monsterPreview;
  monsterPreview = (sp, x, y, maxW, maxH, ...rest) => {
    const S = typeof sp === 'string' && SPECIES[sp]; if (!S || !S.food) return mp(sp, x, y, maxW, maxH, ...rest);
    ctx.save(); ctx.imageSmoothingEnabled = false; iconCentered('items', fcIcon(S.food), x + maxW / 2, y + maxH / 2, Math.min(maxW, maxH) * 0.78); ctx.restore();
  };
}
// casting: the buff on whoever cast it
{
  const cs = castSpell;
  castSpell = (world, a, sp, link, boost = 1) => {
    if (!sp || sp.sx !== 'food') return cs(world, a, sp, link, boost);
    foodBuffOn(world, a, sp.sp);
  };
}
function foodBuffOn(world, a, id) {
  const R = FOOD_CARDS[id]; if (!R) return; const [food, , el, , buff, secs, E] = R;
  if (a.foodBuff) foodBuffOff(a);
  a.foodBuff = { id, t: secs * 1000, max: secs * 1000, E, shield: 0 };
  if (E.shield) { const s = Math.round((a.maxHp || 100) * E.shield); a.foodBuff.shield = s; a.foodBuff.shield0 = a.shield || 0; a.shield = (a.shield || 0) + s; }
  const col = (ELEMENTS[el] || {}).col || '#ffd27a';
  world.spellName = { str: buff, col, t: 1000, team: a.team };
  world.rings.push({ x: a.x, y: a.y, r: 16, t: 0, col });
  for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; world.particles.push({ x: a.x + Math.cos(an) * 10, y: a.y + Math.sin(an) * 4, vx: 0, vy: rand(-45, -20), t: 0, life: 500, col: i % 2 ? col : '#fff4d8', size: 2 }); }
  floatText(world, a.x, a.y - 46, `${buff}!`, col, 9);
}
function foodBuffOff(a) {
  const B = a.foodBuff; if (!B) return;
  if (B.shield) a.shield = Math.min(a.shield || 0, B.shield0 || 0);   // (what is left of the shield goes)
  a.foodBuff = null;
}
{
  const ua = updateActor;
  updateActor = (world, a, dt, input) => {
    const r = ua(world, a, dt, input), B = a.foodBuff;
    if (B) {
      const E = B.E, s = dt / 1000;
      if (E.heal && !a.dead) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * E.heal * s);
      if (E.mp && a.maxMp) a.mp = Math.min(a.maxMp, a.mp + a.maxMp * E.mp * s);
      if (E.cdr && a.cds) for (let i = 0; i < a.cds.length; i++) if (a.cds[i] > 0) a.cds[i] = Math.max(0, a.cds[i] - dt * E.cdr);
      B.t -= dt; if (B.t <= 0 || a.dead) foodBuffOff(a);
    }
    return r;
  };
  const so = speedOf;
  speedOf = a => a.foodBuff && a.foodBuff.E.speed ? so(a) * (1 + a.foodBuff.E.speed) : so(a);
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    let o = opts; const A = att && att.foodBuff && att.foodBuff.E, G = def && def.foodBuff && def.foodBuff.E;
    if (o && o.base && (A && (A.dmg || A.crit) || G && G.guard)) {
      o = Object.assign({}, o);
      if (A && A.dmg) o.base *= 1 + A.dmg;
      if (A && A.crit) o.critBonus = (o.critBonus || 0) + A.crit;
      if (G && G.guard) o.base *= 1 - G.guard;
    }
    const hp0 = def && def.hp, r = dd(world, att, def, o);
    if (A && A.steal && r && def && hp0 > def.hp && !att.dead) att.hp = Math.min(att.maxHp, att.hp + (hp0 - def.hp) * A.steal);
    return r;
  };
  // over the hero: the food's icon and a slim bar of the time left
  const da = drawActor;
  drawActor = (a, now, opts = {}) => {
    const r = da(a, now, opts), B = a.foodBuff; if (!B || a.away || a.dead) return r;
    const S = SPECIES[B.id], top = 50, x = Math.round(a.x), y = Math.round(a.y - top - (a.z || 0)), left = Math.max(0, B.t / B.max), col = (ELEMENTS[S.spell.el] || {}).col || '#ffd27a';
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = B.t < 2000 && Math.floor(now / 200) % 2 ? 0.55 : 1;
    ctx.fillStyle = 'rgba(20,14,18,0.7)'; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
    iconCentered('items', fcIcon(S.food), x, y, 11);
    ctx.fillStyle = 'rgba(20,14,18,0.75)'; ctx.fillRect(x - 9, y + 8, 18, 3); ctx.fillStyle = col; ctx.fillRect(x - 8, y + 9, Math.round(16 * left), 1);
    ctx.restore(); return r;
  };
}
// THE GODDESS'S FOOD CARDS TAB (goddess.js calls these): three small tabs of its own (FARM, CAMPFIRE, BUTCHER: 1 / 2 / 3 or a
// click), then that kind's cards in two columns, FOODC.rows rows at a time, each its food, its buff, and how much of the food
// you have of what it costs. Up / down step through them one by one (left / right are her tabs), the wheel scrolls, a click
// picks and a second click buys.
const fcSub = g => { const W = gdW() - 8, w = (W - 8) / 3; return { x: gdX0() + g * (w + 4), y: GD.y + 44, w, h: 15 }; };
const fcRow = v => { const x0 = gdX0(), W = gdW() - 8, cw = (W - 8) / 2; return { x: x0 + (v % 2) * (cw + 8), y: GD.y + 64 + Math.floor(v / 2) * FOODC.rowH, w: cw, h: FOODC.rowH - 3 }; };
const fcRowsMax = L => Math.max(0, Math.ceil(L.length / 2) - FOODC.rows);
function updateFoodCardsTab(game, m, k) {
  m.fg = m.fg || 0;
  const pick = g => { if (g !== m.fg) { m.fg = g; m.fc = 0; m.fcTop = 0; } };
  ['Digit1', 'Digit2', 'Digit3'].forEach((key, g) => { if (hit(key)) pick(g); });
  FOOD_GROUPS.forEach((_, g) => { const B = fcSub(g); if (clicked(B.x, B.y, B.w, B.h)) pick(g); });
  const L = fcList(m.fg), n = L.length; if (!n) return; m.fc = Math.min(m.fc || 0, n - 1); m.fcTop = m.fcTop || 0;
  if (k.u) m.fc = (m.fc + n - 1) % n; if (k.d) m.fc = (m.fc + 1) % n;
  if (k.u || k.d) { const row = Math.floor(m.fc / 2); if (row < m.fcTop) m.fcTop = row; if (row >= m.fcTop + FOODC.rows) m.fcTop = row - FOODC.rows + 1; }
  if (mouse.wheel) { m.fcTop = clamp(m.fcTop + Math.sign(mouse.wheel), 0, fcRowsMax(L)); mouse.wheel = 0; }
  for (let v = 0; v < FOODC.rows * 2; v++) { const i = m.fcTop * 2 + v, B = fcRow(v); if (i < n && clicked(B.x, B.y, B.w, B.h)) { if (m.fc === i) k.ok = true; m.fc = i; } }
  if (k.ok) goddessBuyFoodCard(game, L[m.fc]);
}
function goddessBuyFoodCard(game, id) {
  const pr = game.profile, S = SPECIES[id], food = S.food, have = fcHave(pr, food), price = foodPrice(id); pr.foodCards = pr.foodCards || {};
  if (pr.foodCards[id]) { game.toast(`The ${S.name} is already yours`, '#c9c1a8'); return; }
  if (have < price) { game.toast(`She asks ${price.toLocaleString()} × ${fcName(food)} for it (you have ${have.toLocaleString()})`, '#ff8a8a'); return; }
  matGive(pr, food, -price); pr.foodCards[id] = 1;
  const c = makeCard(id, FOODC.tier); pr.cards = pr.cards || [];
  if (pr.cards.length < 200) pr.cards.push(c); else { pr.storage = pr.storage || { cards: [], gear: [] }; (pr.storage.cards = pr.storage.cards || []).push(c); }
  game.toast(`The goddess turns ${price.toLocaleString()} × ${fcName(food)} into the ${S.name}. Put it on your action bar`, '#ffc8e8'); game.save();
}
function drawFoodCardsTab(game, m, now) {
  const pr = game.profile, own = pr.foodCards || {}, fg = m.fg || 0, L = fcList(fg), top = m.fcTop || 0;
  // its own tabs: the kind, its price, how many of them are yours
  FOOD_GROUPS.forEach((G, g) => {
    const B = fcSub(g), on = g === fg, L2 = fcList(g), got = L2.filter(id => own[id]).length;
    ctx.fillStyle = on ? 'rgba(255,216,96,0.22)' : 'rgba(255,255,255,0.05)'; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill();
    ctx.strokeStyle = on ? '#ffd860' : 'rgba(201,168,90,0.4)'; ctx.lineWidth = 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 4); ctx.stroke();
    text(`${g + 1} ${G.name} · ${got}/${L2.length}`, B.x + B.w / 2, B.y + B.h / 2 + 0.5, on ? '#ffffff' : '#e6d6b0', 7.5);
  });
  L.slice(top * 2, (top + FOODC.rows) * 2).forEach((id, v) => {
    const i = top * 2 + v, B = fcRow(v), S = SPECIES[id], R = FOOD_CARDS[id], food = S.food, have = fcHave(pr, food), price = foodPrice(id), got = !!own[id], can = !got && have >= price, sel = (m.fc || 0) === i;
    const col = (ELEMENTS[S.spell.el] || {}).col || '#ffd27a', cy = B.y + B.h / 2;
    ctx.fillStyle = sel ? 'rgba(255,216,96,0.14)' : 'rgba(255,255,255,0.06)'; rrect(ctx, B.x, B.y, B.w, B.h, 6); ctx.fill();
    ctx.strokeStyle = sel ? '#ffd860' : 'rgba(201,168,90,0.35)'; ctx.lineWidth = sel ? 1.3 : 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 6); ctx.stroke();
    ctx.fillStyle = 'rgba(20,12,8,0.75)'; ctx.beginPath(); ctx.arc(B.x + 19, cy, 14, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.imageSmoothingEnabled = false; iconCentered('items', fcIcon(food), B.x + 19, cy, 20); ctx.restore();
    { const nm = textW(S.name, 8.5) > B.w - 46 ? S.name.replace(/ Card$/, '') : S.name; text(nm, B.x + 38, B.y + 8.5, got ? '#8a7a62' : '#ffffff', 8.5, 'left'); }
    text(`${R[4]} · ${R[5]}s`, B.x + 38, B.y + 19, col, 7.5, 'left');
    if (got) text('YOURS', B.x + B.w - 8, B.y + 29, '#8fffd0', 7.5, 'right');
    else { let s2 = `${Math.min(have, 99999).toLocaleString()} / ${price.toLocaleString()} ${fcName(food)}`; while (textW(s2, 7) > B.w - 44 && s2.length > 8) s2 = s2.slice(0, -2) + '…'; text(s2, B.x + 38, B.y + 29.5, can ? '#ffe27a' : '#c9b89a', 7, 'left'); }
  });
  // the scroll bar (only when this kind has more than fits)
  if (fcRowsMax(L)) { const x = gdX0() + gdW() - 4, y = GD.y + 64, h = FOODC.rows * FOODC.rowH - 3, rows = Math.ceil(L.length / 2), bh = Math.max(14, h * FOODC.rows / rows), by = y + (h - bh) * (top / fcRowsMax(L));
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; rrect(ctx, x, y, 4, h, 2); ctx.fill(); ctx.fillStyle = 'rgba(255,216,96,0.75)'; rrect(ctx, x, by, 4, bh, 2); ctx.fill(); }
  // the picked card's buff in full
  const id = L[Math.min(L.length - 1, m.fc || 0)]; if (!id) return; const R = FOOD_CARDS[id];
  const l = wrap(`${foodPrice(id).toLocaleString()} ${fcName(R[0])} · ` + cap(foodBuffText(R[6], R[5])), gdW() - 20, 8);
  l.slice(0, 2).forEach((s2, i) => text(s2, gdX0(), GD.y + GD.h - 34 + i * 11, '#f4ead8', 8, 'left'));
}
// A menu closing rebuilds the hero (main.js refreshPlayer -> keepFightState): a food buff carries over, with the shield it added
// (this lived in mech.js, scrapped 2026-11-20)
{
  const kf = keepFightState;
  keepFightState = (old, fresh) => {
    kf(old, fresh);
    if (old.foodBuff) { fresh.foodBuff = old.foodBuff; if ((old.shield || 0) > (fresh.shield || 0)) fresh.shield = old.shield; }
  };
}
// THE AEGIS IS GONE (2026-11-20, the user: "remove the gundam and card from goddess and game just scrap it"; the code is in
// _scrapped/aegis/). A save that still holds ARK-01 Aegis cards loses them (from the bag, storage, deck, action bar, loadouts and
// fusion), and a hero who bought one from a goddess gets the 1,000,000 Souls back, once.
function aegisScrap(pr, any = false) {
  if (!pr) return pr;
  // (with any: also a card of any kind that no longer exists, so a scrapped card can never stop a save from loading; only once
  // every script has loaded, since later ones still add kinds)
  const gone = new Set(); const drop = L => (L || []).filter(c => { if (c && c.sp && !c.fusion && (c.sp === 'aegis' || (any && !SPECIES[c.sp]))) { gone.add(c.uid); return false; } return true; });
  pr.cards = drop(pr.cards); if (pr.storage) pr.storage.cards = drop(pr.storage.cards);
  if (gone.size) {
    if (pr.deck) pr.deck = pr.deck.filter(u => !gone.has(u));
    if (pr.spells) pr.spells = pr.spells.map(u => gone.has(u) ? null : u);
    if (pr.fusion && gone.has(pr.fusion)) pr.fusion = null;
    for (const L of Object.values(pr.loadouts || {})) if (L && typeof L === 'object') for (const k of Object.keys(L)) { const v = L[k]; if (Array.isArray(v)) L[k] = v.map(u => gone.has(u) ? null : u).filter((u, i, a) => k === 'spells' || u != null); else if (gone.has(v)) L[k] = null; }
  }
  if (pr.aegisBought) { pr.souls = (pr.souls || 0) + 1000000; delete pr.aegisBought; }
  pr.aegisScrapped = 1; return pr;   // (it runs on every load: cheap, and it also catches any other card whose kind was removed)
}
{
  const mp = migrateProfile;
  migrateProfile = (pr, ...rest) => aegisScrap(mp(pr, ...rest) || pr);
}
// main.js reads the save while the scripts are still loading (GAME.saved = safeLoad()), before this file wraps migrateProfile, so
// the save already read is cleaned here too (found 2026-11-20: an Aegis card left in the deck stopped the world from building)
if (window.GAME) { if (GAME.saved) aegisScrap(GAME.saved); if (GAME.profile) aegisScrap(GAME.profile); }
// the first time a save's stats are worked out (every script is loaded by then): any card of a kind that no longer exists goes
{
  const ps = profileStats, checked = new WeakSet();
  profileStats = (pr, ...rest) => { if (pr && !checked.has(pr)) { checked.add(pr); try { aegisScrap(pr, true); } catch (e) { console.warn('card check', e); } } return ps(pr, ...rest); };
}
