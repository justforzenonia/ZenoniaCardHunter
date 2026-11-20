'use strict';
// Home life in Hearthvale: your own house (choose its layout and colours), a farm beside it, a kitchen, hunger,
// a storage chest that catches spare loot, and relic pedestals that grant permanent buffs.
//
//   ITEMS     crops, seeds, food and meals (pr.items), shown in the bag beside the Zenonia 2 goods
//   HUNGER    drains while you hunt (not in town); hungry heroes hit softer; starving ones lose HP and strength
//             (worse the longer it lasts) and stop regaining MP
//   FARM      a 7 × 3 field (21 plots) right beside your home, and My Chest (the pantry) by the Farm Board: till the ground, plant seeds, water them from the lake, harvest; farming
//             earns Farm XP, and every Farm Level a point to spend on farming stats at the Farm Board
//   KITCHEN   turn crops and meat into meals: filling, worth more than their crops, and each gives its own buff
//             for several minutes (MEAL_FX)
//   STORAGE   duplicate cards and every piece of gear you are not wearing goes here; sell one or SELL ALL
//   RELICS    bosses drop relics; set them on the six pedestals in your home for permanent stat bonuses

// ---------------------------------------------------------------- icons (assets/home_icons.png, 32x32 each)
const HOME_BASE = 200000;   // icon ids at or above this come from the home sheet (see iconCentered)
D.icons.home = { img: 'assets/home_icons.png', frames: Array.from({ length: 51 }, (_, i) => [i * 32, 0, 32, 32]) };
const homeIcon = i => HOME_BASE + i;

// ---------------------------------------------------------------- items
const ITEMS = {
  wheat:   { name: 'Wheat',        icon: 0,  kind: 'crop', hunger: 6,  sell: 6,  desc: 'Golden grain. Bake it into bread, a tart or a burger bun.' },
  carrot:  { name: 'Carrot',       icon: 1,  kind: 'crop', hunger: 12, sell: 10, desc: 'Crunchy and sweet. For stew and salad.' },
  tomato:  { name: 'Tomato',       icon: 2,  kind: 'crop', hunger: 12, sell: 13, desc: 'Ripe and juicy. For stew, salad and burgers.' },
  pumpkin: { name: 'Pumpkin',      icon: 3,  kind: 'crop', hunger: 22, sell: 32, desc: 'A big one, and it sells well. Pie, anyone?' },
  berry:   { name: 'Strawberry',   icon: 4,  kind: 'crop', hunger: 10, sell: 12, desc: 'Sweet berries. For tarts, salad and pie.' },
  // newer crops, drawn with the game's own Zenonia 2 produce art (icon2)
  lettuce:   { name: 'Lettuce',      icon: 1,  icon2: 1028, kind: 'crop', hunger: 8,  sell: 9,  desc: 'Crisp and fresh, and quick to grow. A light snack that slowly heals.' },
  nectarine: { name: 'Nectarine',    icon: 4,  icon2: 1072, kind: 'crop', hunger: 14, sell: 24, desc: 'Sweet and sunny. A bite puts a spring in your step.' },
  moonflower: { name: 'Moonflower',   icon: 28, kind: 'rare', hunger: 0, sell: 800,  desc: 'Takes 3 days to bloom. Too rare to eat raw: cook it.' },
  dragonfruit: { name: 'Dragonfruit', icon: 29, kind: 'rare', hunger: 0, sell: 4000, desc: 'Takes a week to ripen. Too rare to eat raw: cook it.' },
  rope: { name: 'Rope', icon: 46, kind: 'rare', tool: true, use: 'use it at a well (Enter)', hunger: 0, price: 2500, sell: 500, desc: 'Long enough to reach the bottom of a well. Used up when it pulls something out.' },
  egg:  { name: 'Egg',  icon: 47, kind: 'crop', hunger: 10, sell: 25, desc: 'Laid this morning.' },
  milk: { name: 'Milk', icon: 48, kind: 'crop', hunger: 14, sell: 45, desc: 'Fresh from the cow.' },
  wool: { name: 'Wool', icon: 49, kind: 'rare', use: 'spin it into thread at the Workshop (Z), or sell it', hunger: 0, sell: 90, desc: 'Soft sheep\'s wool. Spin it into thread at the Workshop.' },
  truffle: { name: 'Truffle', icon: 50, kind: 'rare', use: 'use it at the Workshop (Z), or sell it', hunger: 0, sell: 220, desc: 'Your pig dug it up. Makes rare seeds and spices at the Workshop.' },
  feed: { name: 'Animal Feed', icon: 0, kind: 'rare', use: 'feed it to a farm animal (Enter)', hunger: 0, sell: 30, desc: 'A rich mix. An animal fed on it gives one extra.' },
  cheese: { name: 'Farmhouse Cheese', icon: 48, kind: 'food', hunger: 24, sell: 150, desc: 'Aged and sharp.' },
  // fish (icon2: the game's own Salmon and Smoked Salmon art from the second sheet)
  fish:        { name: 'Fresh Fish',   icon: 14, icon2: 1029, kind: 'crop', hunger: 8, sell: 40, desc: 'Caught this morning. Better cooked.' },
  prizefish:   { name: 'Prize Fish',   icon: 14, icon2: 1029, kind: 'rare', use: 'cook it at a campfire, or sell it', hunger: 0, sell: 300, desc: 'A rare catch. Too good to eat raw.' },
  grilledfish: { name: 'Grilled Fish', icon: 14, icon2: 921, kind: 'food', hunger: 28, sell: 70, desc: 'Crisp skin, a little salt.' },
  fishskewer:  { name: 'Fish Skewer',  icon: 11, icon2: 921, kind: 'food', hunger: 34, sell: 90, desc: 'Fish and tomato on a stick.' },
  smokedfish:  { name: 'Smoked Fish',  icon: 14, icon2: 921, kind: 'food', hunger: 40, sell: 160, desc: 'A day over the coals, and it keeps for a week.' },
  fishstew:    { name: 'Fish Stew',    icon: 14, icon2: 924, kind: 'food', hunger: 46, sell: 140, desc: 'Milky, peppery, and better the second day.' },
  fishpie:     { name: 'Fish Pie',     icon: 14, icon2: 924, kind: 'food', hunger: 50, sell: 170, desc: 'A proper crust on it, too.' },
  prizefillet: { name: 'Prize Fillet', icon: 14, icon2: 921, kind: 'food', hunger: 52, sell: 420, desc: 'Simple, because it does not need help.' },
  seafeast:    { name: 'Feast of the Deep', icon: 14, icon2: 924, kind: 'food', hunger: 70, sell: 560, desc: 'The kind of meal people row out for.' },
  skewer:     { name: 'Meat Skewer',          icon: 11, kind: 'food', hunger: 34, sell: 34, desc: 'Meat and tomato, turned over the coals.' },
  smokedmeat: { name: 'Smoked Meat',          icon: 14, kind: 'food', hunger: 38, sell: 40, desc: 'Slow and smoky.' },
  friedegg:   { name: 'Pan-Fried Eggs',       icon: 47, kind: 'food', hunger: 28, sell: 60, desc: 'Crisp at the edges.' },
  eggtoast:   { name: 'Egg on Toast',         icon: 10, kind: 'food', hunger: 34, sell: 55, desc: 'Simple and good.' },
  warmmilk:   { name: 'Warm Milk',            icon: 48, kind: 'food', hunger: 20, sell: 55, desc: 'Steaming in the cup.' },
  cheesetoast: { name: 'Melted Cheese Toast', icon: 25, kind: 'food', hunger: 42, sell: 190, desc: 'It stretches.' },
  trailstew:  { name: 'Trail Stew',           icon: 12, kind: 'food', hunger: 46, sell: 45, desc: 'One pot, whatever you had.' },
  pumpsoup:   { name: 'Pumpkin Soup',         icon: 39, kind: 'food', hunger: 44, sell: 95, desc: 'Sweet and thick.' },
  compote:    { name: 'Berry Compote',        icon: 36, kind: 'food', hunger: 30, sell: 70, desc: 'Stewed down in milk.' },
  truffletoast: { name: 'Truffle Toast',      icon: 50, kind: 'food', hunger: 32, sell: 260, desc: 'It smells like money.' },
  carrotcake: { name: 'Ash-Baked Carrot Cake', icon: 13, kind: 'food', hunger: 40, sell: 85, desc: 'Baked in the embers.' },
  moontea:    { name: 'Moonflower Tea',       icon: 32, kind: 'food', hunger: 16, sell: 900, desc: 'Pale and faintly glowing.' },
  grillnect:  { name: 'Grilled Nectarine',    icon: 4,  icon2: 1072, kind: 'food', hunger: 26, sell: 60, desc: 'Warm, soft and sticky-sweet.' },
  lettucewrap: { name: 'Lettuce Wrap',        icon: 11, icon2: 917,  kind: 'food', hunger: 32, sell: 40, desc: 'Grilled meat tucked in crisp leaves.' },
  firecarrot: { name: 'Fire-Roasted Carrots', icon: 1,  kind: 'food', hunger: 30, sell: 24, desc: 'Charred sweet over the campfire.' },
  chartomato: { name: 'Charred Tomatoes',     icon: 2,  kind: 'food', hunger: 28, sell: 30, desc: 'Blistered and smoky.' },
  toastberry: { name: 'Toasted Berries',      icon: 4,  kind: 'food', hunger: 26, sell: 28, desc: 'Warm, sticky and sweet.' },
  emberpump:  { name: 'Ember Pumpkin',        icon: 3,  kind: 'food', hunger: 40, sell: 45, desc: 'Baked whole in the coals.' },
  flatbread:  { name: 'Campfire Flatbread',   icon: 10, kind: 'food', hunger: 30, sell: 14, desc: 'Quick bread off a hot stone.' },
  seed_wheat:   { name: 'Wheat Seeds',   icon: 5, kind: 'seed', crop: 'wheat',   price: 10,  sell: 2, desc: 'Ripe in 5 min of wet soil · 3–5 wheat.' },
  seed_carrot:  { name: 'Carrot Seeds',  icon: 6, kind: 'seed', crop: 'carrot',  price: 14, sell: 3, desc: 'Ripe in 8 min of wet soil · 3–4 carrots.' },
  seed_tomato:  { name: 'Tomato Seeds',  icon: 7, kind: 'seed', crop: 'tomato',  price: 18, sell: 4, desc: 'Ripe in 12 min of wet soil · 3–4 tomatoes.' },
  seed_pumpkin: { name: 'Pumpkin Seeds', icon: 8, kind: 'seed', crop: 'pumpkin', price: 30, sell: 8, desc: 'Ripe in 20 min of wet soil · 2–3 pumpkins.' },
  seed_berry:   { name: 'Berry Seeds',   icon: 9, kind: 'seed', crop: 'berry',   price: 18, sell: 3, desc: 'Ripe in 10 min of wet soil · 3–5 strawberries.' },
  seed_lettuce:   { name: 'Lettuce Seeds',   icon: 6, kind: 'seed', crop: 'lettuce',   price: 14, sell: 2, desc: 'Ripe in 4 min of wet soil · 3–5 lettuces.' },
  seed_nectarine: { name: 'Nectarine Pits',  icon: 9, kind: 'seed', crop: 'nectarine', price: 24, sell: 6, desc: 'Ripe in 15 min of wet soil · 2–3 nectarines.' },
  seed_moonflower:  { name: 'Moonflower Seeds',  icon: 30, kind: 'seed', crop: 'moonflower',  price: 1500, sell: 300,  desc: '3 real days · water once a day · 2–3 moonflowers.' },
  seed_dragonfruit: { name: 'Dragonfruit Seeds', icon: 31, kind: 'seed', crop: 'dragonfruit', price: 5000, sell: 1000, desc: '7 real days · water once a day · 1–2 dragonfruit.' },
  bread:   { name: 'Bread',          icon: 10, kind: 'food', hunger: 35, price: 24, sell: 12, desc: 'Fresh from the oven.' },
  meat:    { name: 'Raw Meat',       icon: 14, kind: 'food', hunger: 8,  sell: 6,  desc: 'From the Wilds. Better cooked.' },
  roast:   { name: 'Roast Meat',     icon: 11, kind: 'meal', hunger: 45, sell: 30,  desc: 'Hearty.' },
  stew:    { name: 'Garden Stew',    icon: 12, kind: 'meal', hunger: 65, sell: 55,  desc: 'Warming.' },
  salad:   { name: 'Garden Salad',   icon: 24, kind: 'meal', hunger: 40, sell: 50,  desc: 'Light and fresh.' },
  tart:    { name: 'Berry Tart',     icon: 25, kind: 'meal', hunger: 40, sell: 60,  desc: 'Sweet!' },
  burger:  { name: "Hunter's Burger", icon: 26, kind: 'meal', hunger: 70, sell: 70, desc: 'Stacked high.' },
  pie:     { name: 'Pumpkin Pie',    icon: 13, kind: 'meal', hunger: 90, sell: 110, desc: 'A feast.' },
  leafsalad:   { name: 'Crisp Leaf Salad',   icon: 24, icon2: 920, kind: 'meal', hunger: 40, sell: 55, desc: 'Lettuce and tomato, nothing more.' },
  orchardbowl: { name: 'Orchard Fruit Bowl', icon: 25, icon2: 912, kind: 'meal', hunger: 45, sell: 80, desc: 'Nectarines and strawberries.' },
  moonbroth: { name: 'Moonlight Broth', icon: 32, kind: 'meal', hunger: 70, sell: 1800, desc: 'It glows faintly in the bowl.' },
  dragonfeast: { name: 'Dragon Feast', icon: 33, kind: 'meal', hunger: 100, sell: 8000, desc: 'Worth the week.' },
};
const itemIcon = id => ITEMS[id].icon2 != null ? ITEM2_BASE + ITEMS[id].icon2 : homeIcon(ITEMS[id].icon);
// Food buffs, for adventuring: everything you eat gives one, for `dur` ms of play. Two slots that stack: a cooked
// MEAL (pr.meal) and a SNACK (pr.snack: raw crops, meat, bread); eating replaces what is in that slot. Kept on the
// profile, so they last through town trips, map changes and saving.
//   atk / hp / mp: +% attack, max HP, max MP · armor: +DEF · crit: +crit % · speed ×move speed · spell ×spell damage
//   guard ×damage taken · regen HP %/s · mpr ×MP regen · exp ×EXP · slow ×hunger drain
const MEAL_FX = {
  // snacks: a few minutes, one good stat each
  wheat:   { slot: 'snack', name: 'Grain Snack',    dur: 240000, hp: 0.08 },
  carrot:  { slot: 'snack', name: 'Sharp Eyes',     dur: 240000, crit: 6 },
  tomato:  { slot: 'snack', name: 'Ripe Strength',  dur: 240000, atk: 0.1 },
  berry:   { slot: 'snack', name: 'Berry Pep',      dur: 240000, speed: 1.1, mpr: 1.3 },
  pumpkin: { slot: 'snack', name: 'Pumpkin Hide',   dur: 240000, hp: 0.12, armor: 3 },
  lettuce: { slot: 'snack', name: 'Garden Fresh',   dur: 240000, regen: 0.004 },
  nectarine: { slot: 'snack', name: 'Sunny Step',   dur: 240000, speed: 1.12 },
  meat:    { slot: 'snack', name: 'Raw Grit',       dur: 180000, atk: 0.08 },
  egg:     { slot: 'snack', name: 'Fresh Start',    dur: 300000, atk: 0.1, hp: 0.06 },
  cheese:  { slot: 'snack', name: 'Aged Strength',  dur: 480000, atk: 0.14, hp: 0.14 },
  milk:    { slot: 'snack', name: 'Strong Bones',   dur: 300000, hp: 0.1, armor: 4 },
  bread:   { slot: 'snack', name: 'Full Belly',     dur: 360000, hp: 0.1, slow: 0.6 },
  // campfire snacks: a little longer and a little stronger than the raw crops
  firecarrot: { slot: 'snack', name: 'Keen Eye',    dur: 420000, crit: 10 },
  grillnect:  { slot: 'snack', name: 'Sun-Warmed',  dur: 420000, speed: 1.18 },
  lettucewrap: { slot: 'snack', name: 'Light Hunter', dur: 420000, atk: 0.08, regen: 0.003 },
  chartomato: { slot: 'snack', name: 'Smoked Fury', dur: 420000, atk: 0.16 },
  toastberry: { slot: 'snack', name: 'Sugar Spark', dur: 420000, speed: 1.15, mpr: 1.6 },
  emberpump:  { slot: 'snack', name: 'Ember Hide',  dur: 480000, hp: 0.18, armor: 5 },
  flatbread:  { slot: 'snack', name: 'Trail Bread', dur: 480000, hp: 0.12, slow: 0.55 },
  fish:        { slot: 'snack', name: 'Raw Catch',    dur: 180000, mpr: 1.2 },
  grilledfish: { slot: 'snack', name: 'Light Step',   dur: 420000, speed: 1.12, crit: 3 },
  fishskewer:  { slot: 'snack', name: 'Hook and Line', dur: 420000, atk: 0.12, mpr: 1.4 },
  smokedfish:  { slot: 'snack', name: 'Long Smoke',   dur: 600000, atk: 0.15, mp: 0.15 },
  fishstew:    { slot: 'snack', name: 'Harbour Warmth', dur: 540000, hp: 0.16, regen: 0.005 },
  fishpie:     { slot: 'snack', name: 'Fisher\'s Luck', dur: 540000, crit: 8, exp: 1.1 },
  prizefillet: { slot: 'snack', name: 'Prize Catch',  dur: 600000, atk: 0.2, crit: 8 },
  seafeast:    { slot: 'snack', name: 'Fed by the Deep', dur: 720000, hp: 0.2, spell: 1.25 },
  skewer:     { slot: 'snack', name: 'Fired Up',     dur: 420000, atk: 0.14, crit: 5 },
  smokedmeat: { slot: 'snack', name: 'Smoked Grit',  dur: 600000, atk: 0.2 },
  friedegg:   { slot: 'snack', name: 'Good Morning', dur: 480000, atk: 0.12, hp: 0.1 },
  eggtoast:   { slot: 'snack', name: 'Steady Start', dur: 480000, hp: 0.14, slow: 0.7 },
  warmmilk:   { slot: 'snack', name: 'Calm Mind',    dur: 480000, mp: 0.2, mpr: 1.6 },
  cheesetoast: { slot: 'snack', name: 'Rich Reserve', dur: 540000, atk: 0.16, hp: 0.16, armor: 3 },
  trailstew:  { slot: 'snack', name: 'Road Mender',  dur: 480000, hp: 0.1, regen: 0.006 },
  pumpsoup:   { slot: 'snack', name: 'Warm Belly',   dur: 540000, hp: 0.2, armor: 4, slow: 0.7 },
  compote:    { slot: 'snack', name: 'Fruit Rush',   dur: 480000, speed: 1.2, mpr: 1.4 },
  truffletoast: { slot: 'snack', name: 'Lucky Nose', dur: 480000, crit: 12, exp: 1.15 },
  carrotcake: { slot: 'snack', name: 'Sweet Focus',  dur: 480000, crit: 8, spell: 1.15 },
  moontea:    { slot: 'snack', name: 'Moon Calm',    dur: 600000, spell: 1.3, mp: 0.25, mpr: 2 },
  // meals: long and strong
  roast:   { slot: 'meal', name: 'Hearty',          dur: 600000, atk: 0.3, hp: 0.15, regen: 0.005 },
  stew:    { slot: 'meal', name: 'Warm & Sturdy',   dur: 720000, hp: 0.4, armor: 8, guard: 0.8, regen: 0.01 },
  salad:   { slot: 'meal', name: 'Light & Quick',   dur: 720000, speed: 1.25, crit: 10, mpr: 2, slow: 0.75 },
  tart:    { slot: 'meal', name: 'Sugar Rush',      dur: 720000, spell: 1.4, mp: 0.3, mpr: 2.5 },
  burger:  { slot: 'meal', name: "Hunter's Feast",  dur: 720000, atk: 0.4, crit: 10, exp: 1.25 },
  pie:     { slot: 'meal', name: 'Grand Feast',     dur: 900000, atk: 0.3, hp: 0.3, armor: 6, crit: 10, exp: 1.4, regen: 0.0075, slow: 0.5 },
  leafsalad:   { slot: 'meal', name: 'Green Shield', dur: 720000, hp: 0.15, regen: 0.006, guard: 0.9 },
  orchardbowl: { slot: 'meal', name: 'Sunny Days',   dur: 720000, speed: 1.2, exp: 1.15, mpr: 1.5 },
  // the rare meals (Auto Feast leaves these for you to choose)
  moonbroth: { slot: 'meal', name: 'Moonlit',       dur: 1800000, rare: true, spell: 1.7, mp: 0.5, mpr: 3, regen: 0.01 },
  dragonfeast: { slot: 'meal', name: "Dragon's Might", dur: 1800000, rare: true, atk: 0.6, hp: 0.6, armor: 10, crit: 15, exp: 1.6, regen: 0.01, slow: 0.5 },
};
function mealText(F) {
  const pct = v => `+${Math.round(v * 100)}%`, mul = m => `${m >= 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`, out = [];
  if (F.atk) out.push(`${pct(F.atk)} ATK`);
  if (F.hp) out.push(`${pct(F.hp)} max HP`);
  if (F.mp) out.push(`${pct(F.mp)} max MP`);
  if (F.armor) out.push(`+${F.armor} DEF`);
  if (F.crit) out.push(`+${F.crit}% crit`);
  if (F.spell) out.push(`${mul(F.spell)} spell damage`);
  if (F.guard) out.push(`${mul(F.guard)} damage taken`);
  if (F.speed) out.push(`${mul(F.speed)} speed`);
  if (F.regen) out.push(`heal ${(F.regen * 100).toFixed(1).replace('.0', '')}% HP/s`);
  if (F.mpr) out.push(`×${F.mpr} MP regen`);
  if (F.exp) out.push(`${mul(F.exp)} EXP`);
  if (F.slow) out.push(`hunger drains ${F.slow === 0.5 ? 'half as fast' : `${Math.round((1 - F.slow) * 100)}% slower`}`);
  return out.join(' · ');
}
for (const id in MEAL_FX) { const I = ITEMS[id], F = MEAL_FX[id]; I.desc = `${I.desc} ${F.slot === 'meal' ? 'MEAL' : 'SNACK'} · ${F.name} for ${Math.round(F.dur / 60000)} min: ${mealText(F)}.`; }
// both slots merged into one effect (multipliers multiply, bonuses add); null when nothing is active
const FX_MUL = ['speed', 'spell', 'guard', 'mpr', 'exp', 'slow'];
function foodFx(pr) {
  const on = [pr.meal, pr.snack].filter(B => B && MEAL_FX[B.id] && B.ms > 0); if (!on.length) return null;
  const out = {};
  for (const B of on) for (const [k, v] of Object.entries(MEAL_FX[B.id])) {
    if (typeof v !== 'number' || k === 'dur') continue;
    out[k] = FX_MUL.includes(k) ? (out[k] || 1) * v : (out[k] || 0) + v;
  }
  return out;
}
// the stat part (ATK, HP, MP, DEF, crit) goes into profileStats, like relics
function mealStats(pr, st) {
  const F = foodFx(pr); if (!F) return;
  if (F.atk) st.atk = Math.round(st.atk * (1 + F.atk) * 10) / 10;
  if (F.hp) st.hp = Math.round(st.hp * (1 + F.hp));
  if (F.mp) st.mp = Math.round(st.mp * (1 + F.mp));
  if (F.armor) st.def = (st.def || 0) + F.armor;
  if (F.crit) st.crit = (st.crit || 0) + F.crit;
}
// the hero's active food buffs, refreshed every frame from the profile; when one runs out the stats are rebuilt
function mealTick(game, w, dt) {
  const pr = game.profile, p = w.player;
  for (const k of ['meal', 'snack']) {
    const B = pr[k]; if (!B) continue;
    if (!p.dead) B.ms -= dt;
    if (B.ms <= 0) { pr[k] = null; game.toast(`${MEAL_FX[B.id] ? MEAL_FX[B.id].name : 'Food buff'} wore off${k === 'meal' ? ' — cook another meal at home' : ''}`, '#c9c1a8'); game.refreshPlayer(); return; }
  }
  p.meal = foodFx(pr);
  p.mealMs = pr.meal ? pr.meal.ms : 0; p.snackMs = pr.snack ? pr.snack.ms : 0;
}
const addItem = (pr, id, n = 1) => { pr.items = pr.items || {}; pr.items[id] = (pr.items[id] || 0) + n; if (pr.items[id] <= 0) delete pr.items[id]; };
const itemCount = (pr, id) => (pr.items && pr.items[id]) || 0;
// the bag lists these with the goods: entries look like goods entries with it.home set
function homeGoodsEntries(pr) {
  return Object.keys(pr.items || {}).filter(id => ITEMS[id] && pr.items[id] > 0).map(id => ({ idx: 'h:' + id, n: pr.items[id], it: { name: ITEMS[id].name, tier: 0, sub: -1, cat: 9, lv: 0, home: id } }));
}
function useHomeItem(game, id) {
  const I = ITEMS[id], pr = game.profile, w = game.world, p = w && w.player;
  if (I.kind === 'seed') { game.toast(`${I.name}: plant them on a farm plot beside your home`, '#c8e8a0'); return false; }
  if (I.use) { game.toast(`${I.name}: ${I.use}`, '#c8e8a0'); return false; }
  if (I.kind === 'rare') { game.toast(`${I.name}: cook it in your kitchen, or sell it`, '#c8e8a0'); return false; }
  if (I.kind === 'crop' || I.kind === 'food' || I.kind === 'meal') {
    if ((pr.hunger ?? 80) >= 100 && !MEAL_FX[id]) { game.toast('You are full', '#c9c1a8'); return false; }   // anything with a buff can still be eaten
    pr.hunger = Math.min(100, (pr.hunger ?? 80) + I.hunger);
    const F = MEAL_FX[id];
    if (F) { pr[F.slot] = { id, ms: F.dur }; game.refreshPlayer(); }   // the new stats (max HP, ATK…) apply at once
    const pp = w && w.player;
    const frac = F && F.slot === 'meal' ? 0.3 : 0.1;
    if (pp && w) { const p = pp; heal(w, p, p.maxHp * frac); w.rings.push({ x: p.x, y: p.y, r: 22, t: 0, col: '#ffd27a' }); if (F) w.rings.push({ x: p.x, y: p.y, r: 34, t: -120, col: '#fff3b0' }); }
    // whatever you eat heals your hound by the same share of its HP (you share the snack)
    const dog = w && w.actors.find(a => a.pet && !a.heroPartner && !a.netOf && !a.dead), dogHurt = dog && dog.hp < dog.maxHp;
    if (dogHurt) { heal(w, dog, dog.maxHp * frac, true); floatText(w, dog.x, dog.y - 30, `+${Math.round(dog.maxHp * frac)} ♥`, '#ff9ab8', 7); w.rings.push({ x: dog.x, y: dog.y, r: 16, t: 0, col: '#ff9ab8' }); }
    game.toast((F ? `Ate ${I.name} — ${F.name} for ${Math.round(F.dur / 60000)} min: ${mealText(F)}` : `Ate ${I.name} — hunger ${Math.round(pr.hunger)}/100`) + (dogHurt ? ' · your hound feels better too' : ''), '#ffd27a');
    addItem(pr, id, -1); game.save();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- hunger
// Drains one point every 10 s while you are out in the Wilds (black holes and rifts too) — a third as fast while you
// stand idle. Above 80 you are full
// (+5% damage); below 30 hungry (−15% damage); at 0 starving — no MP regeneration, and it gets worse the longer it
// lasts (STARVE): out of town you lose 10 HP every 3 s, and you deal 25% less damage; every 15 s more of starving
// adds 5 HP to each loss (up to 40) and 5% to the damage cut (up to 75%). Town is safe from the HP loss (the clock
// pauses there too), and starving wears you down until it kills you. Eating anything ends it.
const HUNGER = { drainMs: 2500, full: 80, hungry: 30, idleAfter: 3000, idleRate: 1 / 3, newLv: 6, newRate: 0.5 };   // idle: a third of the pace; a hero below Lv 6 (still learning the ropes) at half
const STARVE = { tickMs: 3000, hp: 10, hpUp: 5, hpMax: 40, cut: 0.25, cutUp: 0.05, cutMax: 0.75, stepMs: 15000 };
function hungerState(h) { return h <= 0 ? 'starving' : h < HUNGER.hungry ? 'hungry' : h >= HUNGER.full ? 'full' : 'ok'; }
const HUNGER_MUL = { hungry: 0.85, ok: 1, full: 1.05 };
const starveStage = pr => Math.floor((pr.starveMs || 0) / STARVE.stepMs);
const starveCut = pr => Math.min(STARVE.cutMax, STARVE.cut + STARVE.cutUp * starveStage(pr));   // share of damage lost
const starveHp = pr => Math.min(STARVE.hpMax, STARVE.hp + STARVE.hpUp * starveStage(pr));      // HP lost per tick
// Anything that restores health eases hunger too: potions, healing goods, the bed, the healer and inn. It fills
// HEAL_FEED points for a full heal (so a 30% potion gives +12). Returns the points gained, for the message.
const HEAL_FEED = 40;
function healFeeds(game, frac) {
  const pr = game.profile; if (!pr || !(frac > 0)) return 0;
  const before = pr.hunger ?? 80; pr.hunger = Math.min(100, before + Math.round(Math.min(1, frac) * HEAL_FEED));
  return Math.round(pr.hunger - before);
}
const fedNote = n => n > 0 ? ` · +${n} hunger` : '';
function hungerTick(game, w, dt) {
  const pr = game.profile, p = w.player; if (!pr || !p) return;
  if (pr.hunger == null) pr.hunger = 80;
  mealTick(game, w, dt);
  ripeTick(game, dt);
  const out = w.cave || w.rift || (w.overworld && !inTown(p.x));
  // idle (not moving or fighting for 3 s): hunger drains at a third of the pace
  const moved = Math.abs(p.x - (p.hungerX ?? p.x)) + Math.abs(p.y - (p.hungerY ?? p.y)) > 0.3 || p.state !== 'free';
  p.hungerX = p.x; p.hungerY = p.y; p.idleT = moved ? 0 : (p.idleT || 0) + dt;
  const idle = p.idleT > HUNGER.idleAfter;
  if (out && !p.dead) {
    pr.hungerAcc = (pr.hungerAcc || 0) + dt * (idle ? HUNGER.idleRate : 1) * ((p.meal && p.meal.slow) || 1) * ((pr.lv || 1) < HUNGER.newLv ? HUNGER.newRate : 1);
    while (pr.hungerAcc >= HUNGER.drainMs) {
      pr.hungerAcc -= HUNGER.drainMs; pr.hunger = Math.max(0, pr.hunger - 1);
      if (pr.hunger === HUNGER.hungry - 1) game.toast('Your stomach growls… eat something (press B for MEAL TIME)', '#ffb07a');
      if (pr.hunger === 0) game.toast('STARVING — you lose health and strength until you eat!', '#ff6a5a');
    }
  }
  const st = hungerState(pr.hunger);
  p.starving = st === 'starving';
  if (!p.starving) { pr.starveMs = 0; pr.starveAcc = 0; pr.starveWarned = false; p.hungerMul = HUNGER_MUL[st]; return; }
  p.hungerMul = 1 - starveCut(pr);
  if (!out || p.dead) return;
  const before = starveStage(pr);
  pr.starveMs = (pr.starveMs || 0) + dt; pr.starveAcc = (pr.starveAcc || 0) + dt;
  if (starveStage(pr) > before) game.toast(`Starving worse — ${Math.round(starveCut(pr) * 100)}% weaker, −${starveHp(pr)} HP every 3 s`, '#ff6a5a');
  while (pr.starveAcc >= STARVE.tickMs && !p.dead) {
    pr.starveAcc -= STARVE.tickMs;
    const n = starveHp(pr);
    p.hp = Math.max(0, p.hp - n);
    floatText(w, p.x, p.y - 40, '-' + n, '#ff6a5a', 9);
    w.rings.push({ x: p.x, y: p.y, r: 14, t: 0, col: '#ff5a3a' });
    if (p.hp <= p.maxHp * 0.2 && !pr.starveWarned) { pr.starveWarned = true; game.toast('Starving to death — eat something now!', '#ff6a5a'); }
  }
}

// ---------------------------------------------------------------- farm (six plots beside the home, in the village)
// A planted seed only grows while its soil is wet. Watering (Enter on a dry plot) uses one fill of your watering can
// and keeps the soil wet for a while; refill the can at the lake shore south of the farm. `grow` is how long a crop must spend
// growing, not wall-clock time: a plot left dry grows at a quarter of the pace. One watering lasts 12 minutes (more with
// Deep Soak), so you can water, go hunting, and come back to ripe crops. A plot is rough ground (null) until you till it
// ({ tilled: true }), then holds a crop: { tilled, crop, grown (ms), t (last tally), wet (until) }; a harvest leaves it
// rough again. The soil is the Cute Fantasy farmland autotile (assets/farm_tiles.png, tools/build_farm_tiles.py).
// RARE CROPS (`long`) take real days on the clock, so Green Thumb and a full field don't hurry them. One watering lasts
// a whole day (LONG_WET): skip a day and that day counts for a quarter, so it comes up late but never dies.
D.farmTiles = 'assets/farm_tiles.png';   // three 3x3 autotiles side by side: tilled, wet, rough
const CROPS = {
  wheat: { grow: 300000, yield: [3, 5], col: '#f2c84a' }, carrot: { grow: 480000, yield: [3, 4], col: '#f07a1a' },
  tomato: { grow: 720000, yield: [3, 4], col: '#e0281e' }, berry: { grow: 600000, yield: [3, 5], col: '#ff4a5a' },
  pumpkin: { grow: 1200000, yield: [2, 3], col: '#f08a20' },
  lettuce: { grow: 240000, yield: [3, 5], col: '#e8ffa8' }, nectarine: { grow: 900000, yield: [2, 3], col: '#ffa47a' },
  moonflower: { grow: 3 * 864e5, yield: [2, 3], col: '#bfe0ff', long: true, xp: 150 }, dragonfruit: { grow: 7 * 864e5, yield: [1, 2], col: '#ff3a8a', long: true, xp: 400 },
};
// Farming stats: one point per Farm Level, spent at the Farm Board. Farm XP comes from planting, watering and harvests.
const FARM_SKILLS = {
  thumb:   { name: 'Green Thumb',       icon: 17, max: 10, desc: l => `Crops grow ${l * 10}% faster` },
  soak:    { name: 'Deep Soak',         icon: 23, max: 10, desc: l => `Watered soil stays wet ${Math.round(wetMs(l) / 1000)} s` },
  can:     { name: 'Big Watering Can',  icon: 23, max: 10, desc: l => `The can holds ${4 + l} waterings` },
  spout:   { name: 'Wide Spout',        icon: 23, max: 3,  desc: l => `One fill waters up to ${1 + 2 * l} plots in a row` },
  harvest: { name: 'Bountiful Harvest', icon: 0,  max: 10, desc: l => `${l * 10}% chance of +1 crop, ${l * 4}% of +2` },
  saver:   { name: 'Seed Saver',        icon: 5,  max: 10, desc: l => `${25 + l * 7}% chance of seeds back` },
  hound:   { name: 'Loyal Hound',       npc: '100', max: 1,  desc: l => l ? 'Your dog fights at your side (N)' : 'Grandpa brings your dog back: it fights, casts a card' },
  autoEat: { name: 'Auto Feast',        icon: 11, max: 5,  desc: l => !l ? 'Off' : `Eats below ${autoEatAt(l)} hunger${l >= 5 ? ', keeps SNACK + MEAL up' : l >= 3 ? ', keeps SNACK up' : ''}` },
};
const autoEatAt = l => 10 + l * 10;
// AUTO FEAST (Farm Board skill): once a second, out in the world, eat something when hunger runs low — the plain food
// that fills you best without going far past full (meals are saved for their buffs) — and from level 3 keep the SNACK
// buff running, from level 5 the MEAL buff too, with the best one you carry.
function autoEatTick(game, w, dt) {
  game.autoEatT = (game.autoEatT || 0) + dt; if (game.autoEatT < 1000) return; game.autoEatT = 0;
  const pr = game.profile, L = (pr.farmer && pr.farmer.sk && pr.farmer.sk.autoEat) || 0, p = w.player;
  if (!L || !p || p.dead || game.menu) return;
  const have = Object.keys(pr.items || {}).filter(id => pr.items[id] > 0 && ITEMS[id] && ['crop', 'food', 'meal'].includes(ITEMS[id].kind) && !(MEAL_FX[id] && MEAL_FX[id].rare));
  const eat = id => { if (useHomeItem(game, id)) game.toast(`Auto Feast: ate ${ITEMS[id].name}`, '#b8ff8a'); };
  const hu = pr.hunger ?? 80;
  if (hu < autoEatAt(L)) {
    const plain = have.filter(id => !MEAL_FX[id] || MEAL_FX[id].slot === 'snack');
    const pickBest = plain.sort((a, b) => Math.abs(100 - hu - ITEMS[a].hunger) - Math.abs(100 - hu - ITEMS[b].hunger))[0];
    if (pickBest) { eat(pickBest); return; }
  }
  for (const [slot, need] of [['snack', 3], ['meal', 5]]) {
    if (L < need || (pr[slot] && pr[slot].ms > 0)) continue;
    const best = have.filter(id => MEAL_FX[id] && MEAL_FX[id].slot === slot).sort((a, b) => MEAL_FX[b].dur - MEAL_FX[a].dur || ITEMS[b].sell - ITEMS[a].sell)[0];
    if (best) { eat(best); return; }
  }
}
const wetMs = l => 720000 + l * 60000, DRY_GROW = 0.25, LONG_WET = 864e5;
const farmXpNeed = lv => 20 + lv * 15;
function farmer(pr) {
  const F = pr.farmer = pr.farmer || { lv: 1, xp: 0, pts: 0, sk: {}, water: 4 };
  for (const k in FARM_SKILLS) F.sk[k] = F.sk[k] || 0;
  return F;
}
const canCap = pr => 4 + farmer(pr).sk.can;
// a full field (15+ of the 21 plots growing) grows 30% faster on top of Green Thumb
const fullField = pr => (pr.farm || []).filter(P => P && P.crop).length >= 15;
const growMul = pr => (1 + farmer(pr).sk.thumb * 0.1) * (fullField(pr) ? 1.3 : 1);
// Reasons to farm, besides food and gold:
//  · FARMER'S BLESSING — every Farm Level past the first: +1% max HP and +0.5% ATK, for good
//  · GOLDEN HARVEST — about 1 harvest in 16 also turns up a monster card (rank grows with Farm Level)
//  · FARM ORDERS — the Farm Board always has an order up (deliver N of a crop) paying gold, coins and Farm XP
function farmStats(pr, st) {
  const lv = (pr.farmer && pr.farmer.lv || 1) - 1; if (lv <= 0) return;
  st.hp = Math.round(st.hp * (1 + lv * 0.01)); st.atk = Math.round(st.atk * (1 + lv * 0.005) * 10) / 10;
}
const blessingText = lv => `Farmer's Blessing: +${lv - 1}% max HP, +${((lv - 1) * 0.5).toFixed(1).replace('.0', '')}% ATK`;
function farmOrder(pr) {
  const F = farmer(pr);
  if (!F.order) {
    const crop = pick(Object.keys(CROPS).filter(k => !CROPS[k].long)), n = 4 + Math.min(10, Math.floor(F.lv / 2)) + randi(0, 2), I = ITEMS[crop];
    F.order = { crop, n, gold: Math.round(n * I.sell * 2.5), coins: 1 + Math.floor(F.lv / 4), xp: 10 + n * 2 };
  }
  return F.order;
}
function deliverOrder(game) {
  const pr = game.profile, F = farmer(pr), O = farmOrder(pr), have = (pr.items || {})[O.crop] || 0;
  if (have < O.n) { game.toast(`Order: ${O.n} × ${ITEMS[O.crop].name} — you have ${have}`, '#ff8a8a'); return; }
  addItem(pr, O.crop, -O.n); seasonGain(game, SEASON.pts.order); pr.gold = (pr.gold || 0) + O.gold; pr.coins = (pr.coins || 0) + O.coins; F.order = null;
  game.toast(`Order delivered! +${O.gold} G · +${O.coins} coin${O.coins > 1 ? 's' : ''} · +${O.xp} Farm XP`, '#ffd23f');
  farmXp(game, O.xp); game.save();
}
function farmXp(game, n) {
  const F = farmer(game.profile); F.xp += n;
  let up = false;
  while (F.xp >= farmXpNeed(F.lv)) {
    F.xp -= farmXpNeed(F.lv); F.lv++; F.pts++; up = true;
    game.toast(`Farm Level ${F.lv}! +1 farming point · ${blessingText(F.lv)}`, '#b8ff8a');
  }
  if (up) game.refreshPlayer();   // the blessing's HP and ATK apply at once
  if (up && !F.sk.hound && typeof tipEvent === 'function') tipEvent(game, 'dog');   // how to get the dog
}
// every farm plot in the world: Hearthvale's first (saves keep their plot numbers), then each outpost town's
let FARM_PLOTS = null;
const farmPlots = () => FARM_PLOTS || (FARM_PLOTS = [
  ...VILLAGE.plots.map(([px, py]) => ({ x: TOWN_OX + (px + 1) * T, y: TOWN_OY + (py + 1) * T, town: null })),
  ...OUTPOSTS.flatMap(O => O.plots.map(c => ({ x: c.x, y: c.y, town: O.i })))]);
const plotCentre = i => farmPlots()[i];
const plotLocked = (pr, i) => { const t = farmPlots()[i].town; return t != null && !ownsTownHome(pr, t); };
// the wells of the outpost farms (Hearthvale's is VILLAGE.well)
const nearTownWell = w => w.overworld && !w.interior && OUTPOSTS.some(O => Math.hypot(w.player.x - O.well.x, w.player.y - O.well.y) < 26);
const spotAt = ([bx, by]) => ({ x: TOWN_OX + bx * T + 8, y: TOWN_OY + by * T + 12 });
function farmOf(pr) {
  pr.farm = pr.farm || farmPlots().map(() => null);
  while (pr.farm.length < farmPlots().length) pr.farm.push(null);   // the farm grew (more plots, the outpost farms): older saves get them
  pr.farm.forEach((P, i) => { if (P && P.t0 != null) pr.farm[i] = { tilled: true, crop: P.crop, grown: Math.min(CROPS[P.crop].grow, Date.now() - P.t0), t: Date.now(), wet: 0 }; });   // older saves
  return pr.farm;
}
// growth so far, counting only the time the soil has been wet since the last tally
const plotMul = (P, pr) => (CROPS[P.crop].long ? 1 : growMul(pr)) * (P.fert ? CRAFT.fertGrow : 1);   // (fertilized soil grows faster: craft.js)
function plotGrown(P, pr, now = Date.now()) {
  const wet = Math.max(0, Math.min(now, P.wet) - P.t), dry = Math.max(0, now - Math.max(P.t, P.wet));
  return P.grown + (wet + dry * DRY_GROW) * plotMul(P, pr);
}
function settlePlot(P, pr) { const now = Date.now(); P.grown = plotGrown(P, pr, now); P.t = now; }
function plotProgress(P, pr) { return P ? Math.min(1, plotGrown(P, pr) / CROPS[P.crop].grow) : 0; }
const plotWet = P => Date.now() < P.wet;
const mmss = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const timeLeft = ms => ms >= 864e5 ? `${Math.floor(ms / 864e5)}d ${Math.floor(ms % 864e5 / 36e5)}h` : ms >= 36e5 ? `${Math.floor(ms / 36e5)}h ${Math.floor(ms % 36e5 / 6e4)}m` : mmss(ms);
function nearPlot(w) {
  if (!w.overworld) return -1;
  const p = w.player; let best = -1, bd = 26;
  farmPlots().forEach((c, i) => { if (Math.abs(c.x - p.x) > 40) return; const d = Math.hypot(p.x - c.x, p.y - c.y - 4); if (d < bd) { bd = d; best = i; } });
  return best;
}
const nearSpot = (w, spot) => { if (!w.overworld) return false; const c = spotAt(spot); return Math.hypot(w.player.x - c.x, w.player.y - c.y) < 26; };
function plotInteract(game, i) {
  const pr = game.profile, farm = farmOf(pr), P = farm[i], F = farmer(pr), c = plotCentre(i), w = game.world;
  if (plotLocked(pr, i)) { const O = OUTPOSTS[c.town]; game.toast(`This field belongs to the house for sale in ${O.name} (${fmtG(O.price)}) — buy it to farm here`, '#ffd27a'); return; }
  if (!plotOpen(pr, i)) { game.toast('This plot is locked. Unlock it at the Farm Board', '#ffd27a'); return; }
  if (!P) {   // till the rough ground: this plot and the rough plots next to it in the same row of the same field (one press per row)
    const row = [i];
    for (const dir of [-1, 1]) for (let j = i + dir; ; j += dir) { const cj = farmPlots()[j]; if (!cj || cj.town !== c.town || Math.abs(cj.y - c.y) > 2 || farm[j] || plotLocked(pr, j) || !plotOpen(pr, j)) break; row.push(j); }
    for (const j of row) { farm[j] = { tilled: true }; const cj = farmPlots()[j]; for (let k = 0; k < 4; k++) w.rings.push({ x: cj.x + (k % 2 ? 9 : -9), y: cj.y + (k < 2 ? -6 : 8), r: 9, t: -k * 60, col: '#c88a5a' }); }
    farmXp(game, row.length); game.save();
    game.toast(row.length > 1 ? `Tilled ${row.length} plots — now plant some seeds (Enter, or R in the seed list for the whole row)` : 'Tilled the soil — now plant some seeds (Enter)', '#d8a070');
    return;
  }
  if (!P.crop) { game.openMenu(plantMenu(i)); return; }
  const k = plotProgress(P, pr), grow = CROPS[P.crop].grow;
  if (k >= 1) {   // harvest
    const [a, b] = CROPS[P.crop].yield, sk = F.sk, r = Math.random();
    let n = a + Math.floor(Math.random() * (b - a + 1));
    if (r < sk.harvest * 0.04) n += 2; else if (r < sk.harvest * 0.14) n += 1;
    if (built(pr, 'silo')) n++;
    if (P.fert) n++;
    if (Math.random() < hoeBonus(pr)) n++;   // a better hoe from the Workshop turns up more
    addItem(pr, P.crop, n); seasonHarvest(game, P.crop); farm[i] = { tilled: true };   // the soil stays tilled: plant again straight away
    let extra = '';
    if (!CROPS[P.crop].long && Math.random() < 0.25 + sk.saver * 0.07) { const sid = 'seed_' + P.crop, m = 1 + (Math.random() < 0.3); addItem(pr, sid, m); extra = ` + ${m} ${ITEMS[sid].name}`; }
    const hot = typeof marketCrop === 'function' && marketCrop() === P.crop;   // (today's market crop sells for double: farmrow.js)
    game.toast(`Harvested ${n} × ${ITEMS[P.crop].name}${extra}! (${hot ? `worth ${n * ITEMS[P.crop].sell * MARKET.mul} G at the store today: in demand!` : `worth ${n * ITEMS[P.crop].sell} G, or cook it`})`, '#8fffb0');
    if (Math.random() < 0.06 + sk.harvest * 0.005) {   // GOLDEN HARVEST: a monster card turns up in the soil
      const zi = Math.min(ZONES.length - 1, Math.floor(F.lv / 5)), pool = ZONES[zi].mobs.filter(id => D.monsters[id]);
      game.pickup({ kind: 'card', item: makeCard(pick(pool), Math.min(9, 1 + Math.floor(F.lv / 3))) });
      game.toast('GOLDEN HARVEST! A card was buried in the soil', '#ffd23f');
      for (let k = 0; k < 3; k++) w.rings.push({ x: c.x, y: c.y, r: 16 + k * 10, t: -k * 90, col: '#ffd23f' });
    }
    farmXp(game, CROPS[P.crop].xp || 3 + Math.round(grow / 60000) * 2); game.save();
    w.rings.push({ x: c.x, y: c.y, r: 20, t: 0, col: '#8fffb0' });
    return;
  }
  const left = (grow - plotGrown(P, pr)) / plotMul(P, pr);
  if (plotWet(P)) { game.toast(`${ITEMS[P.crop].name} — ${timeLeft(left)} of growing left · soil wet for ${timeLeft(P.wet - Date.now())}`, '#c8e8a0'); return; }
  if (F.water <= 0) { game.toast('Your watering can is empty — refill it at the lake shore, just south of the farm', '#9fd8ff'); return; }
  settlePlot(P, pr); P.wet = Date.now() + (CROPS[P.crop].long ? LONG_WET : wetMs(F.sk.soak)); F.water--;
  // WIDE SPOUT (Farm Board skill): the same fill also waters up to `spout` dry, growing plots on each side, in the same row of
  // the same field, stopping at a gap (rough ground, an empty, wet, ripe or locked plot)
  let more = 0;
  for (const dir of [-1, 1]) for (let s = 1; s <= (F.sk.spout || 0); s++) {
    const j = i + dir * s, Q = farm[j], cj = farmPlots()[j];
    if (!Q || !Q.crop || !cj || cj.town !== c.town || Math.abs(cj.y - c.y) > 2 || plotLocked(pr, j) || !plotOpen(pr, j) || plotWet(Q) || plotProgress(Q, pr) >= 1) break;
    settlePlot(Q, pr); Q.wet = Date.now() + (CROPS[Q.crop].long ? LONG_WET : wetMs(F.sk.soak)); more++;
    w.rings.push({ x: cj.x, y: cj.y, r: 14, t: -60 * s, col: '#7ac8ff' });
  }
  farmXp(game, 1 + more); game.save();
  game.toast(`Watered the ${ITEMS[P.crop].name.toLowerCase()}${more ? ` and ${more} more` : ''} · can ${F.water}/${canCap(pr)}`, '#9fd8ff');
  w.rings.push({ x: c.x, y: c.y, r: 18, t: 0, col: '#7ac8ff' }, { x: c.x, y: c.y, r: 10, t: -100, col: '#ffffff' });
}
// When a planted crop ripens (checked once a second, wherever you are), say so — a message and the CROPS READY tip.
function ripeTick(game, dt) {
  game.ripeT = (game.ripeT || 0) + dt; if (game.ripeT < 1000) return; game.ripeT = 0;
  const pr = game.profile; if (!pr.farm) return;
  millTick(pr);
  const ripe = [];
  pr.farm.forEach(P => { if (P && P.crop && !P.told && plotProgress(P, pr) >= 1) { P.told = true; ripe.push(ITEMS[P.crop].name.toLowerCase()); } });
  if (!ripe.length) return;
  const names = [...new Set(ripe)].join(', ');
  game.toast(`Ripe at the farm: ${names} — harvest with Enter on a plot`, '#8fffb0');   // (no 'is / are' to get wrong: 'your wheat are ripe')
  if (pr.tips) delete pr.tips.ripe;   // this tip comes back every harvest
  tipEvent(game, 'ripe'); game.save();
}
// the lake along the town's south edge: anywhere on its shore row, Enter fills the watering can
// someone townInteract would talk to (the same 30 px reach): the lake shore's watering can gives way to them (not your
// own partner or pet, who follow you everywhere)
const nearTalker = w => w.actors.some(a => a.role && a.role !== 'partner' && !a.away && !a.pet && Math.hypot(a.x - w.player.x, a.y - w.player.y) < 30);
function nearLake(w) {
  if (!w.overworld || !inTown(w.player.x)) return false;
  return w.player.y >= TOWN_OY + VILLAGE.shoreY * T + 4;   // (the grass shore above the low cliff, or out on the pier)
}
function lakeInteract(game) {
  const pr = game.profile, F = farmer(pr), cap = canCap(pr), p = game.world.player;
  if (F.water >= cap) { game.toast(`Watering can already full (${cap}/${cap})`, '#9fd8ff'); return; }
  F.water = cap; game.save();
  game.toast(`Filled the watering can · ${cap}/${cap}`, '#9fd8ff');
  game.world.rings.push({ x: p.x, y: TOWN_OY + VILLAGE.lakeY * T + 6, r: 14, t: 0, col: '#7ac8ff' }, { x: p.x, y: TOWN_OY + VILLAGE.lakeY * T + 6, r: 8, t: -90, col: '#ffffff' });
}
// growing crops: four plants per plot — sprout, leafy, flowering, then the crop itself shows and sparkles when ripe.
// Wet soil uses the darker soil tile; a dry plot with something growing shows a bobbing water drop.
function drawFarm(w, now) {
  const pr = window.GAME && GAME.profile; if (!pr || !w.overworld) return;
  const farm = farmOf(pr), atFurniture = nearSpot(w, VILLAGE.board) || nearCamp(w, 'chest') || nearCamp(w, 'fire') || nearSpot(w, VILLAGE.well) || nearTownWell(w) || nearTownBoard(w), near = atFurniture ? -1 : nearPlot(w), F = farmer(pr);   // Enter opens the board / chest first
  { const b = spotAt(VILLAGE.board); drawFarmBoard(F, b.x, b.y); } for (const O of OUTPOSTS) { const b = townBoard(O); if (Math.abs(b.x - w.player.x) < 460) drawFarmBoard(F, b.x, b.y); } for (const S of campSpots()) if (Math.abs(S.fire.x - w.player.x) < 460) { drawPantryChest(S.chest); drawCampfire(S.fire, performance.now()); }
  farmPlots().forEach((c, i) => {
    if (Math.abs(c.x - w.player.x) > 460 || Math.abs(c.y - w.player.y) > 300) return;   // (only the field you can see)
    const P = farm[i];
    if (!plotOpen(pr, i)) ctx.globalAlpha = 0.38;
    drawSoil(c.x - T, c.y - T, !P ? 2 : P.crop && plotWet(P) ? 1 : 0); ctx.globalAlpha = 1;
    if (P && P.crop) {
      const k = plotProgress(P, pr), stage = k >= 1 ? 3 : Math.floor(k * 3), col = CROPS[P.crop].col, wet = plotWet(P);
      for (let j = 0; j < 4; j++) {
        const x = c.x - 8 + (j % 2) * 16, y = c.y - 4 + Math.floor(j / 2) * 14, sway = Math.sin(now / 600 + j) * 0.8;
        ctx.fillStyle = '#2a7a1a'; ctx.fillRect(Math.round(x), y - 2 - stage * 2, 1, 3 + stage * 2);
        ctx.fillStyle = '#4ab83a';
        if (stage >= 0) { ctx.fillRect(Math.round(x - 2 + sway), y - 3 - stage * 2, 2, 1); ctx.fillRect(Math.round(x + 1 + sway), y - 4 - stage * 2, 2, 1); }
        if (stage >= 1) { ctx.fillStyle = '#5ad04a'; ctx.fillRect(Math.round(x - 3 + sway), y - 5 - stage, 3, 2); ctx.fillRect(Math.round(x + 1 + sway), y - 6 - stage, 3, 2); }
        if (stage >= 2) { ctx.fillStyle = stage >= 3 ? col : '#ffffff'; ctx.fillRect(Math.round(x - 1 + sway), y - 9 - stage, 3, 3); }
      }
      if (k >= 1) gleam(c.x + 10, c.y - 16 + Math.sin(now / 300 + i) * 2, 3, '#fff6c8', 0.9);
      else if (!wet) waterDrop(c.x, c.y - 20 + Math.sin(now / 280 + i) * 1.5);
    }
    if (near === i) {
      const label = plotLocked(pr, i) ? `For sale with the house · ${fmtG(OUTPOSTS[c.town].price)}` : !plotOpen(pr, i) ? 'Locked · unlock at the Farm Board' : !P ? 'Enter: till the soil' : !P.crop ? 'Enter: plant' : plotProgress(P, pr) >= 1 ? 'Enter: harvest' : !plotWet(P) ? `Enter: water  (can ${F.water}/${canCap(pr)})`
        : `${ITEMS[P.crop].name} · ${timeLeft((CROPS[P.crop].grow - plotGrown(P, pr)) / plotMul(P, pr))}`;
      text(label, c.x, c.y - 30, '#ffffff', 7);
    }
  });
  if (nearLake(w) && nearPlot(w) < 0 && !nearTalker(w)) text(`Enter: fill watering can  (${F.water}/${canCap(pr)})`, w.player.x, w.player.y - 38, '#9fe8ff', 7);
  { const c = nearCamp(w, 'fire'); if (c) text('Enter: Campfire (roast food)', c.x, c.y - 42, '#ffc890', 7); }
  if (nearSpot(w, VILLAGE.well)) { const c = spotAt(VILLAGE.well); text(`Enter: Well (fill the watering can ${F.water}/${canCap(pr)})`, c.x, c.y - 40, '#9fd8ff', 7); }
  for (const O of OUTPOSTS) if (Math.hypot(w.player.x - O.well.x, w.player.y - O.well.y) < 26) text(`Enter: Well (fill the watering can ${F.water}/${canCap(pr)})`, O.well.x, O.well.y - 40, '#9fd8ff', 7);
  { const c = nearCamp(w, 'chest'), n = pantryCount(pr); if (c) text(`Enter: My Chest${n ? `  (${n} stored)` : ''}`, c.x, c.y - 30, '#ffe9a8', 7); }
  { const O = nearTownBoard(w), c = O ? townBoard(O) : nearSpot(w, VILLAGE.board) ? spotAt(VILLAGE.board) : null; if (c) text(`Enter: Farm Board${F.pts ? `  (${F.pts} point${F.pts > 1 ? 's' : ''} to spend!)` : ''}`, c.x, c.y - 36, F.pts ? '#b8ff8a' : '#ffffff', 7); }
}
// a 2x2-tile plot of soil: the four corner tiles of the chosen 3x3 farmland autotile
function drawSoil(x, y, v) {
  const im = img(D.farmTiles); if (!im || !im.complete || !im.naturalWidth) return;
  x = Math.round(x); y = Math.round(y);
  ctx.drawImage(soilArt(im, x, y, v), x, y);
}
// each plot is built once on its own canvas: the soil, then its edge bitten away for real, so the lawn around it shows
// through whatever colour it is (a painted fringe of grass never quite matched it and left a square outline)
const SOIL_ART = new Map();
function soilArt(im, x, y, v) {
  const key = `${x}|${y}|${v}`; let c = SOIL_ART.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  for (const [sx, sy, dx, dy] of [[0, 0, 0, 0], [32, 0, 16, 0], [0, 32, 0, 16], [32, 32, 16, 16]]) g.drawImage(im, v * 48 + sx, sy, 16, 16, dx, dy, 16, 16);
  g.translate(-x, -y); soilFringe(g, x, y, 32); SOIL_ART.set(key, c); return c;
}
// the grass eats into the soil's edge: ragged bites, rounded corners, a few blades poking over the rim and a damp band
// just inside, so a plot sits in the lawn instead of on top of it
const GRASS_DK = '#8fd860', SOIL_DAMP = 'rgba(150,80,40,0.35)';
function soilFringe(g, x, y, s) {
  const h = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) % 1000 / 1000; };
  g.fillStyle = SOIL_DAMP; g.fillRect(x + 2, y + 2, s - 4, 1); g.fillRect(x + 2, y + s - 3, s - 4, 1); g.fillRect(x + 2, y + 3, 1, s - 6); g.fillRect(x + s - 3, y + 3, 1, s - 6);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  for (let i = 0; i < s; i += 2) {   // ragged edges: 1–2 px bites along all four sides
    const a = 1 + Math.floor(h(x + i, y) * 2.2), b = 1 + Math.floor(h(x + i, y + s) * 2.2), c = 1 + Math.floor(h(x, y + i) * 2.2), d = 1 + Math.floor(h(x + s, y + i) * 2.2);
    g.fillRect(x + i, y, 2, a); g.fillRect(x + i, y + s - b, 2, b); g.fillRect(x, y + i, c, 2); g.fillRect(x + s - d, y + i, d, 2);
  }
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]]) {   // rounded corners
    g.fillRect(sx > 0 ? cx : cx - 4, sy > 0 ? cy : cy - 4, 4, 4);
    g.fillRect(sx > 0 ? cx + 4 : cx - 5, sy > 0 ? cy : cy - 2, 1, 2); g.fillRect(sx > 0 ? cx : cx - 2, sy > 0 ? cy + 4 : cy - 5, 2, 1);
  }
  g.globalCompositeOperation = 'source-over'; g.fillStyle = GRASS_DK;
  for (let i = 3; i < s - 3; i += 5) {   // blades of grass leaning over the rim
    if (h(x + i, y + 7) < 0.55) g.fillRect(x + i, y + 2, 1, 2);
    if (h(x + i, y + 9) < 0.55) g.fillRect(x + i, y + s - 4, 1, 2);
    if (h(x + 3, y + i) < 0.5) g.fillRect(x + 2, y + i, 2, 1);
    if (h(x + 5, y + i) < 0.5) g.fillRect(x + s - 4, y + i, 2, 1);
  }
}
function waterDrop(x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#2a1c12'; ctx.fillRect(x - 3, y - 1, 7, 6); ctx.fillRect(x - 2, y - 3, 5, 9); ctx.fillRect(x - 1, y - 5, 3, 2);
  ctx.fillStyle = '#3a8ae8'; ctx.fillRect(x - 2, y - 1, 5, 5); ctx.fillRect(x - 1, y - 3, 3, 8); ctx.fillRect(x, y - 4, 1, 1);
  ctx.fillStyle = '#9ad8ff'; ctx.fillRect(x - 1, y - 1, 1, 2);
}
// the Farm Board, built from the game's own wood: a panel cut from the plank fence (object 070) on two of its posts
// (286, one sprite: its two stakes are the legs), two notes pinned on, and a green leaf badge when there are points to spend
function drawFarmBoard(F, bx, by) {
  const X = Math.round(bx), Y = Math.round(by), im = img(D.objects.img);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y + 1, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (im && im.complete) {
    ctx.imageSmoothingEnabled = false;
    const post = objRec('286', 2); if (post) ctx.drawImage(im, post[0], post[1], post[2], post[3], X - Math.round(post[2] / 2), Y - post[3] + 2, post[2], post[3]);   // its two stakes are the legs
    const pl = objRec('070', 0); if (pl) { ctx.fillStyle = '#2a1408'; ctx.fillRect(X - 14, Y - 30, 28, 18); ctx.drawImage(im, pl[0] + 4, pl[1] + 3, 26, 16, X - 13, Y - 29, 26, 16); }
  }
  ctx.fillStyle = '#f4ecd8'; ctx.fillRect(X - 9, Y - 26, 7, 8); ctx.fillRect(X + 2, Y - 25, 7, 6);   // the notes
  ctx.fillStyle = '#7a7468'; for (let i = 0; i < 3; i++) { ctx.fillRect(X - 8, Y - 24 + i * 2, 5, 1); if (i < 2) ctx.fillRect(X + 3, Y - 23 + i * 2, 5, 1); }
  ctx.fillStyle = '#c83a3a'; ctx.fillRect(X - 6, Y - 27, 1, 1); ctx.fillRect(X + 5, Y - 26, 1, 1);   // pins
  if (F.pts) { ctx.fillStyle = '#2a1c12'; ctx.fillRect(X + 7, Y - 34, 7, 7); ctx.fillStyle = '#5ac84a'; ctx.fillRect(X + 8, Y - 28, 5, 5); ctx.fillStyle = '#c8f8a0'; ctx.fillRect(X + 9, Y - 27, 2, 2); }
}

// MY CHEST: the chest up and to the left of the Farm Board, where your food is stored
// (every town has one, and they all open the same chest; so has every town a campfire)
let CAMP_SPOTS = null;
const campSpots = () => CAMP_SPOTS || (CAMP_SPOTS = [{ chest: spotAt(VILLAGE.pantry), fire: spotAt(VILLAGE.campfire) }, ...OUTPOSTS.map(O => O.camp)]);
const nearCamp = (w, k) => { if (!w.overworld || w.interior) return null; const S = campSpots().find(q => Math.hypot(w.player.x - q[k].x, w.player.y - q[k].y) < 26); return S ? S[k] : null; };
function drawPantryChest({ x, y }) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingEnabled = false; drawObjSprite(3, 0, x, y + 5);   // the game's own chest (object 003)
}

// ---------------------------------------------------------------- relics
const RELIC_TYPES = {
  atk:  { name: 'Ember Heart',   icon: 15, per: 0.55, fmt: v => `+${v} Attack` },
  def:  { name: 'Titan Shell',   icon: 16, per: 0.45, fmt: v => `+${v} Defence` },
  hp:   { name: 'Life Bloom',    icon: 17, per: 6,    fmt: v => `+${v} HP` },
  mp:   { name: 'Mana Prism',    icon: 18, per: 4,    fmt: v => `+${v} MP` },
  spd:  { name: 'Swift Feather', icon: 19, per: 0.45, fmt: v => `+${v} Speed` },
  crit: { name: "Hunter's Eye",  icon: 20, per: 0.3,  fmt: v => `+${v}% Crit` },
};
const SIG_RELIC = { brutal: 'atk', last: 'atk', frenzy: 'atk', hide: 'def', thorns: 'def', barrier: 'def', unstop: 'def',
  regen: 'hp', vamp: 'hp', burst: 'hp', mana: 'mp', frost: 'mp', venom: 'crit', crit: 'crit', evade: 'spd', swift: 'spd' };
const RELIC_MINI_CHANCE = 0.12, PEDESTALS = 6;
function makeRelic(sp, tier, src) {
  const S = SPECIES[sp] || {}, type = SIG_RELIC[S.sig] || pick(Object.keys(RELIC_TYPES)), R = RELIC_TYPES[type];
  const mul = src === 'guardian' ? 2.2 : src === 'hole' ? 1.6 : 1;
  const val = Math.max(1, Math.round((tier + 1) * R.per * mul * 10) / 10);
  return { uid: uid(), type, tier, val, src, name: `${(S.name || 'Ancient').split(' ').pop()}'s ${R.name}`, icon: homeIcon(R.icon) };
}
// bonus from the relics standing on the pedestals (profileStats adds these)
function relicStats(pr) {
  const out = {};
  for (const id of pr.pedestals || []) { const r = id && (pr.relics || []).find(x => x.uid === id); if (r) out[r.type] = Math.round(((out[r.type] || 0) + r.val) * 10) / 10; }
  return out;
}
function relicLine(r) { return `${RELIC_TYPES[r.type].fmt(r.val)} · rank ${RANKS[r.tier]}`; }

// ---------------------------------------------------------------- storage
const sellCard = c => Math.round(6 * Math.pow(c.tier + 1, 2) * (c.fusion ? 2 : 1));
const sellGear = g => Math.round(8 * Math.pow(g.tier + 1, 2) + gearScore(g) * 0.5);

// ================================================================ the home (an interior you can restyle)
// The house is built here (not a decoded interior): a cosy room with plank walls and windows, a rug, bookshelves, a
// bed, a table and chairs, plants and shields on the wall; the storage chest, the hearth (kitchen) and the wardrobe;
// and an arched door at the back into the RELIC HALL, a stone hall of its own where the six pedestals stand in a
// ring around a rune circle. The wardrobe's "layout" picks one of the house styles below (floor, walls, rug).
const HOME_STYLES = [
  { name: 'Oak Cottage',  floor: 24, wall: 37, rug: 21 },
  { name: 'Straw Lodge',  floor: 44, wall: 36, rug: 12 },
  { name: 'Stone Manor',  floor: 33, wall: 18, rug: 21 },
  { name: 'Tatami House', floor: 57, wall: 38, rug: 2 },
];
function buildHomeMap(S) {
  const W = 20, H = 15, M = blankMap(W, H, 100, S.floor);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wallTop = y === 0 || x === 0 || x === W - 1 || (y === H - 1 && !(x === 9 || x === 10));
    if (wallTop) setTile(M, x, y, 40, 1);
    else if (y <= 2) setTile(M, x, y, (y === 1 || y === 2) && (x === 4 || x === 15) ? 26 : S.wall, 1);   // the back wall, two windows
    else setTile(M, x, y, S.floor);
  }
  for (let y = 8; y <= 11; y++) for (let x = 7; x <= 12; x++) setTile(M, x, y, S.rug);   // the rug
  for (let y = 12; y <= 14; y++) for (const x of [9, 10]) setTile(M, x, y, S.rug);       // a runner to the door
  for (const x of [9, 10]) for (const y of [3, 4]) setSolid(M, x, y, 1);   // the stairwell down to the Relic Hall (drawn by homelife.js drawHallStairs)
  const put = (fi, tx, ty, w = 1, h = 1, dy = 0) => { placeObj(M, 100, fi, tx * WG_T + 8 * w, (ty + 1) * WG_T + dy); for (let y = ty - h + 1; y <= ty; y++) for (let x = tx; x < tx + w; x++) setSolid(M, x, y, 1); };
  put(46, 2, 3); put(48, 4, 3); put(47, 6, 3); put(49, 13, 3);   // bookshelves along the back wall
  put(51, 16, 4, 2, 2);                                         // the bed
  put(50, 18, 4);                                               // a little drawer by it
  put(53, 9, 9, 2, 1, -4);                                      // the table on the rug, chairs either side
  put(59, 7, 9); put(59, 12, 9);
  put(45, 1, 13); put(45, 18, 13); put(45, 1, 3);              // plants
  for (const [fi, tx] of [[8, 12], [9, 13], [0, 7]]) placeObj(M, 100, fi, tx * WG_T + 8, 2 * WG_T + 10);   // shields on the wall
  M.entry = [10 * WG_T, 13 * WG_T + 10];
  M.feats = [{ kind: 'chest', tx: 2, ty: 12 }, { kind: 'stove', tx: 3, ty: 7 }, { kind: 'wardrobe', tx: 16, ty: 9 }, { kind: 'hall', tx: 9, ty: 3, x2: true, flat: true }, { kind: 'bed', tx: 16.5, ty: 5, flat: true }, { kind: 'catalog', tx: 13, ty: 5 }, { kind: 'roomdoor', room: 'trophy', tx: 7.5, ty: 3, flat: true }, { kind: 'roomdoor', room: 'workshop', tx: 12, ty: 3, flat: true }, { kind: 'roomdoor', room: 'cellar', tx: 15, ty: 3, flat: true }];
  for (const f of M.feats) if (f.kind !== 'hall' && !f.flat) setSolid(M, f.tx, f.ty, 1);
  floodReach(M, 10, 12);
  return M;
}
function buildHallMap() {
  const W = 18, H = 14, M = blankMap(W, H, 100, 33);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y === 0 || x === 0 || x === W - 1 || (y === H - 1 && !(x === 8 || x === 9))) setTile(M, x, y, 40, 1);
    else if (y <= 2) setTile(M, x, y, 18, 1);
    else setTile(M, x, y, x === 1 || x === W - 2 || y === 3 || y === H - 2 ? 34 : 32);   // pale paving, a darker edge along the walls
  }
  for (let y = 9; y <= 13; y++) for (const x of [8, 9]) setTile(M, x, y, 21);   // a red runner from the stairs to the circle
  M.entry = [9 * WG_T, 12 * WG_T + 10];
  // 2026-11-20: the hall is Gemini's painted room (assets/relic_hall_bg.jpg, 18 x 14 tiles, drawn flat under everything as 'hallbg').
  // Its walls, pillars and braziers are made solid where they are painted; the pedestals stand on its six round floor spots
  // and the ritual circle lies on its painted rune circle. (The tile floor below is never seen.)
  M.feats = [{ kind: 'hallbg', tx: -0.5, ty: -0.75, flat: true }, { kind: 'sigil', tx: 8.5, ty: 6.6, flat: true }];
  // over it, the game's own art (the user: the painted "fire is static" and the "flags looks fake same with pillars"; they were painted out
  // by tools/clean_relic_hall.py): waving banners (home art 038, 10 frames), stone pillars (034:1), urns with flickering fire, candle flames
  const at = (x, y) => ({ tx: (x - 8) / 16, ty: (y - 12) / 16 });
  for (const x of [51, 120, 168, 238]) M.feats.push({ kind: 'art', key: '038', seq: [5, 6, 7, 6], ms: 450, flat: true, ...at(x, 62) });   // a gentle sway (all 10 frames at 140 ms moved too much)
  for (const [x, y] of [[28.5, 97], [28.5, 175], [259.5, 97], [259.5, 175]]) M.feats.push({ kind: 'art', key: '034:1', ...at(x, y) });
  for (const x of [114.5, 173.8]) M.feats.push({ kind: 'hallfire', ...at(x, 187) });
  for (const x of [84.4, 203]) M.feats.push({ kind: 'hallcandle', flat: true, ...at(x, 45) });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y <= 3 || x <= 1 || x >= W - 2 || (y >= H - 2 && !(x === 8 || x === 9))) setSolid(M, x, y, 1);
  for (const x of [2, 15]) for (const y of [4, 5, 6, 8, 9, 10, 11]) setSolid(M, x, y, 1);   // the four pillars
  for (const x of [7, 10]) setSolid(M, x, 11, 1); setSolid(M, 15, 7, 1);   // (a pocket the right-hand pedestal shuts off)                                             // the two braziers
  // the six floor spots (in game pixels), going round from the top right like before
  [[205, 86], [224, 120], [205, 154], [83, 154], [65, 120], [83, 86]].forEach(([x, y], i) => {
    M.feats.push({ kind: 'pedestal', i, tx: (x - 8) / 16, ty: (y + 4 - 12) / 16 }); setSolid(M, Math.floor(x / 16), Math.floor(y / 16), 1);
  });
  floodReach(M, 9, 11);
  return M;
}
HOME_STYLES.forEach((S, i) => { WG_MAPS['home_s' + i] = buildHomeMap(S); });
WG_MAPS.relic_hall = buildHallMap();
const HOME_LAYOUTS = HOME_STYLES.map((S, i) => 'home_s' + i);
const HOME_TINTS = [
  { name: 'Natural', col: null }, { name: 'Rose', col: '#ffb8c8' }, { name: 'Mint', col: '#b8ffd8' },
  { name: 'Sky', col: '#b8d8ff' }, { name: 'Lavender', col: '#d8c0ff' }, { name: 'Ember', col: '#ffc890' },
];
const homeOf = pr => { pr.home = pr.home || { layout: 0, tint: 0 }; return pr.home; };
function enterHome(game, door = null) {
  const pr = game.profile, H = homeOf(pr), outside = game.world, p = outside.player; if (H.layout >= HOME_LAYOUTS.length) H.layout = 0; const key = HOME_LAYOUTS[H.layout];
  const w = mapWorld(key), M = MAPS[key];
  w.interior = true; w.peaceful = true; w.home = true; w.name = `${(pr.look && pr.look.name) || 'Hero'}'s Home`;
  const tint = HOME_TINTS[H.tint || 0].col; if (tint) w.bg = tintCanvas(w.bg, tint);
  // move the hero (and familiars) in
  const party = outside.actors.filter(a => a === p || (a.ally && a.owner === p));
  outside.actors = outside.actors.filter(a => !party.includes(a));
  const [ex, ey] = M.entry;
  for (const a of party) { a.x = ex + (a === p ? 0 : rand(-14, 14)); a.y = ey - (a === p ? 2 : 10); a.vx = a.vy = 0; a.dir = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  w.player = p; w.entry = { x: ex, y: ey };
  w.door = door && door.town != null ? { x: door.x, y: door.y, place: door.place } : { x: HOME_DOOR.x + TOWN_OX, y: HOME_DOOR.y + TOWN_OY, place: 'Hearthvale' };
  placeHomeFeatures(w, M); placeDecor(w); homeCompany(game, w, party);   // (homelife.js)
  game.outside = outside; game.world = w;
  game.toast('Home: the book by the wall sells furniture and rooms, and the bed is yours to sleep in', '#ffe9a8');
}
// The Relic Hall: its own room, through the arched door at the back of the house (and back down its stairs)
function enterHall(game) {
  const home = game.world, p = home.player, M = MAPS.relic_hall, w = mapWorld('relic_hall');
  w.interior = true; w.peaceful = true; w.home = true; w.hall = true; w.name = 'Relic Hall';
  const party = home.actors.filter(a => a === p || (a.ally && a.owner === p));
  home.actors = home.actors.filter(a => !party.includes(a));
  const [ex, ey] = M.entry;
  for (const a of party) { a.x = ex + (a === p ? 0 : rand(-14, 14)); a.y = ey - (a === p ? 2 : 10); a.vx = a.vy = 0; a.dir = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  w.player = p; w.entry = { x: ex, y: ey };
  placeHomeFeatures(w, M);
  game.hallFrom = home; game.world = w;
  game.toast('Relic Hall — set a relic on each pedestal for its permanent bonus', '#ffe9a8');
}
function leaveHall(game) {
  const w = game.world, home = game.hallFrom, p = w.player; if (!home) return;
  const door = (home.homeFeats || []).find(f => w.doorRoom ? f.kind === 'roomdoor' && f.room === w.doorRoom : f.kind === 'hall');
  const party = w.actors.filter(a => a === p || (a.ally && a.owner === p));
  for (const a of party) { a.x = (door ? door.x : home.entry.x) + (a === p ? 0 : rand(-14, 14)); a.y = (door ? door.y + (door.kind === 'hall' ? 32 : 20) : home.entry.y - 20) + (a === p ? 0 : 8); a.dir = 2; a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); home.actors.push(a); }
  home.player = p; game.world = home; game.hallFrom = null;
}
// Lay the home's own furniture onto open floor: the storage chest, the stove, the wardrobe (restyle the house) and
// a row of six relic pedestals. Each is a solid little object you walk up to and press Enter.
function placeHomeFeatures(w, M) {
  if (M.feats) {
    w.homeFeats = M.feats.filter(f => homeFeatShown(GAME.profile, f)).map(f => {
      const o = { ...f, x: f.tx * T + (f.x2 ? 16 : 8), y: f.ty * T + 12, draw: drawHomeFeature };
      o.bottom = o.y; o.ground = !!f.flat; o.box = null;   // the sigil lies flat under everyone   // the tiles under them are solid already; the sigil lies flat
      w.objects.push(o);
      return o;
    });
    return;
  }
  const open = (tx, ty) => tx >= 0 && ty >= 0 && tx < M.w && ty < M.h && M.reach[ty * M.w + tx];
  const roomy = (tx, ty) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!open(tx + dx, ty + dy)) return false; return true; };
  const [ex, ey] = M.entry, etx = Math.floor(ex / T), ety = Math.floor(ey / T);
  const taken = [];
  const free = (tx, ty, gap = 2) => roomy(tx, ty) && Math.hypot(tx - etx, ty - ety) > 4 && taken.every(([a, b]) => Math.abs(a - tx) >= gap || Math.abs(b - ty) >= gap);
  // pedestal row: the open row with the longest run of roomy tiles, upper half first
  let best = null;
  for (let ty = 2; ty < M.h - 2; ty++) {
    let run = [];
    for (let tx = 1; tx < M.w - 1; tx++) {
      if (free(tx, ty, 1)) { run.push(tx); if (run.length >= 11 && (!best || ty < best.ty || run.length > best.run.length + 4)) best = { ty, run: run.slice() }; }
      else run = [];
    }
    if (best && best.run.length >= 11) break;
  }
  const feats = [];
  if (best) { const s = best.run[0] + Math.floor((best.run.length - 11) / 2); for (let i = 0; i < PEDESTALS; i++) { const tx = s + i * 2; feats.push({ kind: 'pedestal', i, tx, ty: best.ty }); taken.push([tx, best.ty]); } }
  const spot = () => { for (let ty = 2; ty < M.h - 2; ty++) for (let tx = 1; tx < M.w - 1; tx++) if (free(tx, ty)) { taken.push([tx, ty]); return [tx, ty]; } return null; };
  for (const kind of ['chest', 'stove', 'wardrobe']) { const s = spot(); if (s) feats.push({ kind, tx: s[0], ty: s[1] }); }
  if (!best) for (let i = 0; i < PEDESTALS; i++) { const s = spot(); if (s) feats.push({ kind: 'pedestal', i, tx: s[0], ty: s[1] }); }
  w.homeFeats = feats.map(f => {
    const o = { ...f, x: f.tx * T + 8, y: f.ty * T + 12, draw: drawHomeFeature };
    o.bottom = o.y; o.box = { x: o.x - 6, y: o.y - 5, w: 12, h: 6 };
    w.objects.push(o);
    return o;
  });
}
const FEAT_LABEL = { chest: 'Storage', stove: 'Kitchen', wardrobe: 'Wardrobe · restyle', pedestal: 'Relic Pedestal', hall: 'Relic Hall' };
// one interior object's sprite, bottom-centre at (x, y)
function drawObjSprite(bank, fi, x, y) { const r = objRec(pad3(bank), fi); if (!r) return; const im = img(D.objects.img); ctx.drawImage(im, r[0], r[1], r[2], r[3], Math.round(x - r[2] / 2), Math.round(y - r[3]), r[2], r[3]); }
// The game's own loose fire (object bank 216, frames 15-18), flickering, bottom-centre at (x, y) at scale k, with a soft warm glow
function hallFlame(x, y, k, now, seed = 0) {
  const r = objRec('216', 15 + Math.floor((now + seed * 137) / 95) % 4), im = img(D.objects.img); if (!r || !im || !im.complete) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const f = 0.8 + 0.2 * Math.sin(now / 130 + seed), g = ctx.createRadialGradient(x, y - 5 * k, 0, x, y - 5 * k, 16 * k + 6); g.addColorStop(0, `rgba(255,160,60,${0.32 * f})`); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 16 * k - 6, y - 21 * k - 6, 32 * k + 12, 32 * k + 12); ctx.restore();
  ctx.imageSmoothingEnabled = false; ctx.drawImage(im, r[0], r[1], r[2], r[3], Math.round(x - r[2] * k / 2), Math.round(y - r[3] * k), r[2] * k, r[3] * k);
}
function drawHomeFeature(o, now) {
  const pr = window.GAME && GAME.profile; if (!pr) return;
  if (drawHomeRoomFeat(o, pr, now)) return;   // (homelife.js)
  if (o.kind === 'hallcandle') { hallFlame(o.x, o.y, 0.6, now, o.tx); return; }   // a candle flame in a wall alcove of the Relic Hall
  if (o.kind === 'hallbg') { const im = img('assets/relic_hall_bg.jpg'); if (im && im.complete && im.naturalWidth) { ctx.imageSmoothingEnabled = true; ctx.drawImage(im, 0, 0, 288, 225); ctx.imageSmoothingEnabled = false; } return; }   // the Relic Hall's painted room
  const x = o.x, y = o.y, im = img(D.icons.home.img);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (o.kind === 'sigil') {   // the rune circle in the middle of the Relic Hall, brighter for every relic set
    const n = (pr.pedestals || []).filter(Boolean).length, k = 0.35 + n / PEDESTALS * 0.65, reso = drawResoLines(o, pr, now), glow = cssRgba(reso || '#ffd678').slice(0, 3).join(',');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, 0.62);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 62); g.addColorStop(0, `rgba(${glow},${0.35 * k})`); g.addColorStop(1, `rgba(${glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${glow},${0.7 * k})`; ctx.lineWidth = 1.2;
    for (const r of [44, 36]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.rotate(now / 6000); ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2; i ? ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36) : ctx.moveTo(36, 0); } ctx.stroke();
    ctx.rotate(-now / 3000); ctx.beginPath(); for (let i = 0; i <= 3; i++) { const a = i / 3 * Math.PI * 2; i ? ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30) : ctx.moveTo(30, 0); } ctx.stroke();
    ctx.restore(); { const P = GAME.world && GAME.world.player; if (P && nearRite(GAME.world, P)) text('Enter: The Ritual', x, y + 40, '#ffe9a8', 7); } return;
  }
  if (o.kind === 'hallfire') {   // the game's dark stone urn (home art 020:0) with the game's own flickering fire in it
    drawHomeArt('020:0', x, y + 4); hallFlame(x, y - 9, 1.5, now, o.tx); return;
  }
  if (o.kind === 'hall') {   // an arched doorway in the back wall, lit from within
    ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.moveTo(x - 11, y + 2); ctx.lineTo(x - 11, y - 18); ctx.arc(x, y - 18, 11, Math.PI, 0); ctx.lineTo(x + 11, y + 2); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, y - 28, 0, y); g.addColorStop(0, 'rgba(255,200,110,0.55)'); g.addColorStop(1, 'rgba(255,200,110,0.05)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#d8a850'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, y + 2); ctx.lineTo(x - 12, y - 18); ctx.arc(x, y - 18, 12, Math.PI, 0); ctx.lineTo(x + 12, y + 2); ctx.stroke();
    ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.arc(x, y - 31, 2.2, 0, Math.PI * 2); ctx.fill();
  } else if (o.kind === 'pedestal') {   // the game's carved stone orb pedestal (home art 114:3). Empty, its orb sleeps grey; with a relic set
    // the orb lights up and the relic floats above it in a soft glow
    const r = (pr.pedestals || [])[o.i] && (pr.relics || []).find(z => z.uid === pr.pedestals[o.i]);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 10, y - 40, 19, 46); ctx.clip(); if (!r) ctx.filter = 'saturate(0.4) brightness(0.85)'; drawHomeArt('114:3', x, y + 4); ctx.restore();   // (clipped: the art's hard black drop shadow is left off)
    if (r) {
      const bob = Math.sin(now / 500 + o.i) * 1.5, oy = y - 22;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, oy, 1, x, oy, 16); g.addColorStop(0, `rgba(170,220,255,${0.35 + 0.1 * Math.sin(now / 700 + o.i)})`); g.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 16, oy - 16, 32, 32); ctx.restore();
      iconCentered('items', r.icon, x, y - 44 + bob, 13);
      text(RELIC_TYPES[r.type].fmt(r.val), x, y - 58 + bob, '#ffe9a8', 7);
    }
  } else {
    const ic = { chest: 27, stove: 12, wardrobe: 16 }[o.kind];   // chest: the big wooden chest
    if (o.kind === 'stove') {   // the hearth: the stone oven, a fire flickering inside
      drawObjSprite(100, 56, x, y + 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const f = 0.6 + 0.4 * Math.sin(now / 90) * Math.sin(now / 37);
      const g = ctx.createRadialGradient(x, y - 8, 0, x, y - 8, 12); g.addColorStop(0, `rgba(255,150,50,${0.55 * f})`); g.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 8, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else if (o.kind === 'wardrobe') drawObjSprite(100, 52, x, y + 2);
    else if (im && im.complete) { ctx.imageSmoothingEnabled = false; { const z = o.kind === 'chest' ? 24 : 18; ctx.drawImage(im, ic * 32, 0, 32, 32, x - z / 2, y - (o.kind === 'stove' ? 22 : z - 2), z, z); } }
  }
  const p = GAME.world && GAME.world.player;
  if (p && Math.hypot(p.x - x, p.y - (o.kind === 'hall' ? y + 12 : y)) < 24 && FEAT_LABEL[o.kind]) text(`Enter: ${FEAT_LABEL[o.kind]}${o.kind === 'pedestal' ? ' ' + (o.i + 1) : ''}`, x, y - (o.kind === 'pedestal' ? 70 : 32), '#ffffff', 7);
}
// Enter in the village or at home
function homeInteract(game, w) {
  if (w.home) {
    const p = w.player; let f = null, bd = 24;
    for (const o of w.homeFeats || []) { if (o.kind === 'sigil') continue; const d = Math.hypot(p.x - o.x, p.y - (o.kind === 'hall' || o.kind === 'roomdoor' ? o.y + 12 : o.y)); if (d < bd && o.kind !== 'art') { bd = d; f = o; } }
    if (!f) { if (w.hall && nearRite(w, p)) { game.openMenu(riteMenu()); return true; } return false; }
    if (f.kind === 'hall') enterHall(game);
    else if (f.kind === 'chest') game.openMenu(storageMenu());
    else if (f.kind === 'stove') game.openMenu(kitchenMenu());
    else if (f.kind === 'wardrobe') game.openMenu(wardrobeMenu());
    else if (homeFeatAct(game, f)) return true;
    else game.openMenu(pedestalMenu(f.i));
    return true;
  }
  if (typeof nearWaystone === 'function' && nearWaystone(w)) { game.openMenu(travelMenu()); return true; }   // TRAVEL to a safe point
  if (nearSpot(w, VILLAGE.board)) { game.openMenu(farmMenu(null)); return true; }
  if (nearTownBoard(w)) { game.openMenu(farmMenu(nearTownBoard(w).i)); return true; }
  if (nearCamp(w, 'chest')) { game.openMenu(pantryMenu()); return true; }
  if (nearCamp(w, 'fire')) { game.openMenu(campfireMenu()); return true; }
  if (nearSpot(w, VILLAGE.well) || nearTownWell(w)) {   // a well fills the watering can, like the lake shore
    const F = farmer(game.profile); F.water = canCap(game.profile); game.save();
    game.toast(`Filled the watering can at the well · ${F.water}/${F.water}`, '#9fd8ff'); return true;
  }
  if (nearButcher(w)) { butcherUse(game, w); return true; }
  if (barnKeep(game, w) || yardTend(game, w)) return true;
  const i = nearPlot(w);
  if (i >= 0) { plotInteract(game, i); return true; }
  if (nearLake(w) && !nearTalker(w)) { lakeInteract(game); return true; }   // (someone to talk to right here, like the Lake Angler, comes first: townInteract)
  return false;
}
// teleport home (inventory button): straight back to the village and in through your front door
function teleportHome(game) {
  if (!game.profile || leadingBlocks(game)) return;
  game.closeMenu(); game.goTown('home'); enterHome(game, typeof homePointDoor === 'function' ? homePointDoor(game.profile) : null);   // (the home point: towns.js)
  const p = game.world.player; game.world.rings.push({ x: p.x, y: p.y, r: 30, t: 0, col: '#9fe8ff' }, { x: p.x, y: p.y, r: 18, t: -120, col: '#ffffff' });
  game.toast('Teleported home', '#9fe8ff');
}

// ================================================================ menus (one shared panel look)
// rows: { icon (item icon id) | card | gear, name, sub, right, col, dim }
const PM = { x: 110, y: 40, w: 420, h: 290, rowH: 24, rows: 8 };
// row art for a panel that has no item icon: a building from the map art, or a character's own sprite, fitted to the row
const objRow = (bank, fi) => (x, y) => { const r = objRec(bank, fi), im = img(D.objects.img); if (!r || !im) return; const s = Math.min(1, 20 / r[2], 20 / r[3]); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, r[0], r[1], r[2], r[3], x - r[2] * s / 2, y - r[3] * s / 2, r[2] * s, r[3] * s); };
const npcRow = id => (x, y) => { const B = D.npcs[id], e = B && B.anims.idle[2][0], r = e && B.frames[e[0]], im = B && img(B.imgs[0]); if (!r || !im) return; const s = Math.min(1, 20 / r[3]); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, r[0], r[1], r[2], r[3], x - r[2] * s / 2, y - r[3] * s / 2, r[2] * s, r[3] * s); };
const HOUSE_ROW = objRow('013', 12);
function panelMenu(m, spec, now) {
  ctx.fillStyle = 'rgba(14,8,4,0.68)'; ctx.fillRect(0, 0, VW, VH);
  zWindow(PM.x, PM.y, PM.w, PM.h, spec.frame);
  goldText(spec.title, VW / 2, PM.y + 16, 14, { spacing: 2, glow: 'rgba(255,200,80,0.5)' });
  if (spec.gold != null) { const gs = `${spec.gold} G`; text(gs, PM.x + PM.w - 16, PM.y + 16, '#ffd23f', 8, 'right'); iconCentered('items', homeIcon(21), PM.x + PM.w - 22 - textW(gs, 8), PM.y + 16, 11); }
  if (spec.tabs) spec.tabs.forEach((t, i) => {
    const tw = 70, tx = PM.x + 16 + i * (tw + 6), ty = PM.y + 30, on = i === m.tab;
    ctx.fillStyle = on ? 'rgba(255,215,120,0.25)' : 'rgba(0,0,0,0.35)'; rrect(ctx, tx, ty, tw, 15, 4); ctx.fill();
    ctx.strokeStyle = on ? '#ffd23f' : 'rgba(201,168,90,0.6)'; ctx.lineWidth = 0.8; rrect(ctx, tx + 0.4, ty + 0.4, tw - 0.8, 14.2, 4); ctx.stroke();
    text(t, tx + tw / 2, ty + 7.8, on ? '#ffe9a8' : '#c9c1a8', 7.5);
  });
  const rows = spec.rows, y0 = PM.y + (spec.tabs ? 52 : 34), top = m.scroll || 0;
  if (!rows.length) text(spec.empty || 'Nothing here.', VW / 2, y0 + 60, '#9a917c', 8.5);
  for (let k = 0; k < PM.rows; k++) {
    const i = top + k, r = rows[i]; if (!r) break;
    const y = y0 + k * PM.rowH, sel = i === m.cur;
    ctx.fillStyle = sel ? 'rgba(255,215,120,0.18)' : k % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.22)'; rrect(ctx, PM.x + 14, y, PM.w - 28, PM.rowH - 3, 4); ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.9; rrect(ctx, PM.x + 14.5, y + 0.5, PM.w - 29, PM.rowH - 4, 4); ctx.stroke(); }
    const ix = PM.x + 28, iy = y + (PM.rowH - 3) / 2;
    ctx.save(); if (r.dim) ctx.globalAlpha = 0.45;
    if (r.card) monsterPreview(r.card.sp, ix - 9, iy - 9, 18, 18, r.card.tier, now);
    else if (r.draw) r.draw(ix, iy);
    else if (r.icon != null) iconCentered('items', r.icon, ix, iy, 17);
    text(r.name, PM.x + 44, iy - (r.sub ? 4 : 0), r.col || '#f4ecd8', 8, 'left');
    if (r.sub) text(r.sub, PM.x + 44, iy + 6, '#bcae94', 6, 'left');
    if (r.right) text(r.right, PM.x + PM.w - 22, iy, r.rightCol || '#ffd23f', 8, 'right');
    ctx.restore();
  }
  if (rows.length > PM.rows) text(`${top + 1}–${Math.min(rows.length, top + PM.rows)} of ${rows.length}`, PM.x + PM.w - 18, PM.y + PM.h - 30, '#9a917c', 6, 'right');
  (spec.buttons || []).forEach(b => {
    const hov = mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h;
    ctx.fillStyle = hov ? 'rgba(90,50,20,0.95)' : 'rgba(40,24,12,0.9)'; rrect(ctx, b.x, b.y, b.w, b.h, 5); ctx.fill();
    ctx.strokeStyle = goldFrameGrad(b.y, b.h); ctx.lineWidth = 1; rrect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 5); ctx.stroke();
    text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 0.4, b.col || '#ffe9a8', 7.5);
  });
  if (spec.info) text(spec.info, VW / 2, PM.y + PM.h - 18, '#e8e2cf', 7);
  text(spec.keys || '↑↓ choose · Enter select · Esc close', VW / 2, PM.y + PM.h + 10, '#9a917c', 7);
}
// common list navigation (keys + mouse wheel-free scrolling + clicks). Returns { ok, clickedRow }
function panelNav(m, n, tabs) {
  const k = navInput();
  if (tabs) { if (k.l || hit('KeyQ')) { m.tab = (m.tab + tabs - 1) % tabs; m.cur = 0; m.scroll = 0; m.confirm = null; } if (k.r || hit('KeyE')) { m.tab = (m.tab + 1) % tabs; m.cur = 0; m.scroll = 0; m.confirm = null; }
    for (let i = 0; i < tabs; i++) if (clicked(PM.x + 16 + i * 76, PM.y + 30, 70, 15)) { m.tab = i; m.cur = 0; m.scroll = 0; m.confirm = null; } }
  if (k.u) { m.cur = Math.max(0, m.cur - 1); m.confirm = null; }
  if (k.d) { m.cur = Math.min(Math.max(0, n - 1), m.cur + 1); m.confirm = null; }
  m.cur = clamp(m.cur, 0, Math.max(0, n - 1));
  m.scroll = clamp(m.scroll || 0, Math.max(0, m.cur - PM.rows + 1), m.cur);
  const y0 = PM.y + (tabs ? 52 : 34);
  let row = -1;
  for (let k2 = 0; k2 < PM.rows; k2++) if (clicked(PM.x + 14, y0 + k2 * PM.rowH, PM.w - 28, PM.rowH - 3)) row = m.scroll + k2;
  let ok = k.ok;
  if (row >= 0 && row < n) { if (row === m.cur) ok = true; m.cur = row; }
  return { ok, back: k.back };
}
const btnHit = b => clicked(b.x, b.y, b.w, b.h);

// ---------------------------------------------------------------- storage chest
function storageMenu() { return { type: 'storage', tab: 0, cur: 0, scroll: 0, confirm: null }; }
const STORE_TABS = ['CARDS', 'GEAR'];
function storageRows(pr, tab) {
  const S = pr.storage || { cards: [], gear: [] };
  if (tab === 0) return S.cards.slice().sort((a, b) => b.tier - a.tier).map(c => ({ ref: c, card: c, name: `${cardName(c)}`, sub: `rank ${RANKS[c.tier]} card${c.fusion ? ' · fusion' : ''}`, right: `${sellCard(c)} G`, col: rankColor(c.tier) }));
  return S.gear.slice().sort((a, b) => b.tier - a.tier || gearScore(b) - gearScore(a)).map(g => ({ ref: g, icon: g.icon, name: g.name, sub: `${SLOT_LABEL[g.slot]} · ${gearLines(g).slice(0, 2).join(' · ')}${isUpgrade(pr, g) ? ' · ▲ upgrade' : ''}`, right: `${sellGear(g)} G`, col: rankColor(g.tier) }));
}
const SB = { take: { x: PM.x + 18, y: PM.y + PM.h - 50, w: 110, h: 18, label: 'TAKE / EQUIP (Enter)' }, sell: { x: PM.x + 136, y: PM.y + PM.h - 50, w: 90, h: 18, label: 'SELL (X)' }, all: { x: PM.x + PM.w - 128, y: PM.y + PM.h - 50, w: 110, h: 18, label: 'SELL ALL', col: '#ff9a7a' } };
function updateStorage(game, m) {
  const pr = game.profile; pr.storage = pr.storage || { cards: [], gear: [] };
  const rows = storageRows(pr, m.tab), nav = panelNav(m, rows.length, 2), r = rows[m.cur];
  if (nav.back) { game.closeMenu(); return; }
  const list = m.tab === 0 ? pr.storage.cards : pr.storage.gear;
  const remove = it => { const i = list.indexOf(it); if (i >= 0) list.splice(i, 1); };
  if ((nav.ok || btnHit(SB.take)) && r) {
    if (m.tab === 0) {
      if (pr.deck.length >= deckMax(pr)) { game.toast(`Deck is full (${deckMax(pr)}) — free a slot first`, '#ff8a8a'); return; }
      remove(r.ref); pr.cards.push(r.ref); pr.deck.push(r.ref.uid); game.toast(`${cardName(r.ref)} added to your deck`, '#8fffd0');
    } else {
      const g = r.ref;
      if (g.slot === 'weapon' && g.cls !== pr.cls) { game.toast('That weapon is for another class', '#ff8a8a'); return; }
      remove(g); pr.gear.push(g); pr.eq[g.slot] = g.uid; game.toast(`Equipped ${g.name}`, '#8fffd0');
    }
    game.save(); game.refreshPlayer();
  }
  const locked = it => ((m.tab === 0 ? pr.deckLock : pr.gearLock) || []).includes(it.uid);   // (locks: invextras.js; locked items are never sold)
  if ((hit('KeyX', 'Delete') || btnHit(SB.sell)) && r && locked(r.ref)) { game.toast(`${r.name} is locked: take it out and press L in your inventory to unlock it`, '#ffd27a'); return; }
  if ((hit('KeyX', 'Delete') || btnHit(SB.sell)) && r) {
    const v = m.tab === 0 ? sellCard(r.ref) : sellGear(r.ref);
    remove(r.ref); pr.gold = (pr.gold || 0) + v; game.toast(`Sold ${r.name} for ${v} G`, '#ffd23f'); game.save();
  }
  if (btnHit(SB.all)) {
    if (!rows.length) return;
    if (m.confirm !== 'all') { m.confirm = 'all'; return; }
    const sold = rows.filter(x => !locked(x.ref)), v = sold.reduce((s, x) => s + (m.tab === 0 ? sellCard(x.ref) : sellGear(x.ref)), 0);
    if (m.tab === 0) pr.storage.cards = pr.storage.cards.filter(locked); else pr.storage.gear = pr.storage.gear.filter(locked);
    pr.gold = (pr.gold || 0) + v; m.confirm = null; m.cur = 0;
    game.toast(`Sold ${sold.length} ${STORE_TABS[m.tab].toLowerCase()} for ${v} G${sold.length < rows.length ? ` (${rows.length - sold.length} locked kept)` : ''}`, '#ffd23f'); game.save();
  }
}
function drawStorage(game, m, now) {
  const pr = game.profile, rows = storageRows(pr, m.tab), lk = (m.tab === 0 ? pr.deckLock : pr.gearLock) || [], total = rows.filter(x => !lk.includes(x.ref.uid)).reduce((s, x) => s + (m.tab === 0 ? sellCard(x.ref) : sellGear(x.ref)), 0);
  const all = { ...SB.all, label: m.confirm === 'all' ? `CLICK AGAIN: +${total} G` : 'SELL ALL' };
  panelMenu(m, { title: 'STORAGE', gold: pr.gold || 0, tabs: STORE_TABS.map((t, i) => `${t} (${(i ? (pr.storage || {}).gear : (pr.storage || {}).cards || []).length || 0})`), rows,
    empty: m.tab === 0 ? 'Cards past your 200 limit wait here.' : 'Nothing stored here.',
    buttons: [{ ...SB.take, label: m.tab === 0 ? 'ADD TO DECK (Enter)' : 'EQUIP (Enter)' }, SB.sell, all],
    keys: '←→ tab · ↑↓ choose · Enter take · X sell one · Esc close' }, now);
}

// ---------------------------------------------------------------- relic pedestals
function pedestalMenu(i) { return { type: 'pedestal', ped: i, cur: 0, scroll: 0 }; }
function pedestalRows(pr, m) {
  const placed = new Set((pr.pedestals || []).filter(Boolean)), cur = (pr.pedestals || [])[m.ped];
  const rows = [];
  if (cur) rows.push({ remove: true, icon: homeIcon(22), name: 'Take the relic down', sub: 'it goes back to your collection', col: '#ff9a7a' });
  for (const r of (pr.relics || []).slice().sort((a, b) => b.val * (b.tier + 1) - a.val * (a.tier + 1)))
    rows.push({ ref: r, icon: r.icon, name: r.name, sub: relicLine(r) + (placed.has(r.uid) ? (r.uid === cur ? ' · on this pedestal' : ' · on another pedestal') : ''), col: rankColor(r.tier), dim: placed.has(r.uid) && r.uid !== cur });
  return rows;
}
function updatePedestal(game, m) {
  const pr = game.profile; pr.pedestals = pr.pedestals || Array(PEDESTALS).fill(null);
  const rows = pedestalRows(pr, m), nav = panelNav(m, rows.length, 0), r = rows[m.cur];
  if (hit('ArrowLeft', 'KeyA')) m.ped = (m.ped + PEDESTALS - 1) % PEDESTALS;
  if (hit('ArrowRight', 'KeyD')) m.ped = (m.ped + 1) % PEDESTALS;
  if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok || !r) return;
  if (r.remove) pr.pedestals[m.ped] = null;
  else { const j = pr.pedestals.indexOf(r.ref.uid); if (j >= 0) pr.pedestals[j] = null; pr.pedestals[m.ped] = r.ref.uid; game.toast(`${r.ref.name} set — ${RELIC_TYPES[r.ref.type].fmt(r.ref.val)} permanently`, '#ffd23f'); }
  game.save(); game.refreshPlayer();
}
function drawPedestal(game, m, now) {
  const pr = game.profile, bonus = relicStats(pr);
  const sum = Object.keys(bonus).map(k => RELIC_TYPES[k].fmt(bonus[k])).join(' · ') || 'no relics placed yet';
  panelMenu(m, { title: `RELIC PEDESTAL ${m.ped + 1} / ${PEDESTALS}`, rows: pedestalRows(pr, m), empty: 'No relics yet — every boss drops one (Guardians and black-hole bosses always).',
    info: `Permanent bonus: ${sum}`, keys: '←→ pedestal · ↑↓ choose · Enter place · Esc close' }, now);
}

// ---------------------------------------------------------------- kitchen
const RECIPES = [
  { out: 'bread', n: 1, need: { wheat: 3 } },
  { out: 'roast', n: 1, need: { meat: 2 } },
  { out: 'stew', n: 1, need: { carrot: 1, tomato: 1, meat: 1 } },
  { out: 'salad', n: 1, need: { carrot: 1, tomato: 1, berry: 1 } },
  { out: 'tart', n: 1, need: { berry: 3, wheat: 1 } },
  { out: 'burger', n: 1, need: { meat: 1, wheat: 2, tomato: 1 } },
  { out: 'pie', n: 1, need: { pumpkin: 1, wheat: 2, berry: 1 } },
  { out: 'leafsalad', n: 1, need: { lettuce: 2, tomato: 1 } },
  { out: 'orchardbowl', n: 1, need: { nectarine: 2, berry: 2 } },
  { out: 'moonbroth', n: 1, need: { moonflower: 1, berry: 2, wheat: 1 } },
  { out: 'dragonfeast', n: 1, need: { dragonfruit: 1, pumpkin: 2, meat: 2 } },
];
function kitchenMenu() { return { type: 'kitchen', cur: 0, scroll: 0 }; }
// ---------------------------------------------------------------- the campfire by the farm
// Put farm food in, get campfire food out: each dish roasts crops into a snack with a stronger, longer buff.
const CAMPFIRE_RECIPES = [
  { out: 'firecarrot', n: 1, need: { carrot: 3 } },
  { out: 'chartomato', n: 1, need: { tomato: 2 } },
  { out: 'toastberry', n: 1, need: { berry: 3 } },
  { out: 'emberpump', n: 1, need: { pumpkin: 1 } },
  { out: 'flatbread', n: 1, need: { wheat: 2 } },
  { out: 'skewer', n: 1, need: { meat: 1, tomato: 1 } },
  { out: 'smokedmeat', n: 1, need: { meat: 3 } },
  { out: 'friedegg', n: 1, need: { egg: 2 } },
  { out: 'eggtoast', n: 1, need: { egg: 1, wheat: 1 } },
  { out: 'warmmilk', n: 1, need: { milk: 1 } },
  { out: 'cheesetoast', n: 1, need: { cheese: 1, wheat: 2 } },
  { out: 'trailstew', n: 1, need: { meat: 1, carrot: 1 } },
  { out: 'pumpsoup', n: 1, need: { pumpkin: 1, milk: 1 } },
  { out: 'compote', n: 1, need: { berry: 2, milk: 1 } },
  { out: 'grillnect', n: 1, need: { nectarine: 2 } },
  { out: 'lettucewrap', n: 1, need: { lettuce: 2, meat: 1 } },
  { out: 'truffletoast', n: 1, need: { truffle: 1, wheat: 1 } },
  { out: 'carrotcake', n: 1, need: { carrot: 2, egg: 1, wheat: 1 } },
  { out: 'moontea', n: 1, need: { moonflower: 1, milk: 1 } },
  { out: 'grilledfish', n: 1, need: { fish: 1 } },
  { out: 'fishskewer', n: 1, need: { fish: 1, tomato: 1 } },
  { out: 'smokedfish', n: 1, need: { fish: 3 } },
  { out: 'fishstew', n: 1, need: { fish: 2, milk: 1 } },
  { out: 'fishpie', n: 1, need: { fish: 1, wheat: 2, egg: 1 } },
  { out: 'prizefillet', n: 1, need: { prizefish: 1 } },
  { out: 'seafeast', n: 1, need: { prizefish: 1, pumpkin: 1, milk: 1 } },
];
function campfireMenu() { return { type: 'campfire', cur: 0, scroll: 0 }; }
function updateCampfire(game, m) {
  const pr = game.profile, nav = panelNav(m, CAMPFIRE_RECIPES.length, 0), R = CAMPFIRE_RECIPES[m.cur];
  if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok || !R) return;
  if (!canCook(pr, R)) { game.toast('Not enough food for that', '#ff8a8a'); return; }
  for (const [id, n] of Object.entries(R.need)) addItem(pr, id, -n);
  addItem(pr, R.out, R.n); game.save();
  game.toast(`Roasted ${ITEMS[R.out].name} over the fire!`, '#ffb060');
  const w = game.world, c = (w && nearCamp(w, 'fire')) || spotAt(VILLAGE.campfire); if (w) for (let k = 0; k < 8; k++) w.particles.push({ x: c.x + rand(-4, 4), y: c.y - 6, vx: rand(-20, 20), vy: rand(-60, -30), t: 0, life: rand(400, 700), col: k % 2 ? '#ffd27a' : '#ff7a2a' });
}
function drawCampfireMenu(game, m, now) {
  const pr = game.profile;
  const rows = CAMPFIRE_RECIPES.map(R => { const F = MEAL_FX[R.out], ok = canCook(pr, R);
    return { icon: itemIcon(R.out), name: `${ITEMS[R.out].name}  (have ${itemCount(pr, R.out)})`, sub: Object.entries(R.need).map(([id, n]) => `${ITEMS[id].name} ${itemCount(pr, id)}/${n}`).join(' · ') + (F ? `  →  ${mealText(F)}` : ''),
      right: ok ? 'ROAST' : '—', rightCol: ok ? '#ffb060' : '#9a917c', dim: !ok }; });
  const R = CAMPFIRE_RECIPES[m.cur], F = R && MEAL_FX[R.out];
  panelMenu(m, { title: 'CAMPFIRE', rows, info: R ? `+${ITEMS[R.out].hunger} hunger · SNACK · ${F.name} for ${Math.round(F.dur / 60000)} min` : '', keys: '↑↓ choose · Enter roast · Esc close' }, now);
}
// the campfire itself, built from the game's own pieces so it matches the world: two bound logs (object 012) crossed, the game's
// little flame (object 020 frames 15-18) flickering on them, sparks and smoke rising, a warm glow.
// (Object 020's frames 0-14 are a skull brazier, not a campfire; the hand-painted assets/campfire.png didn't match the game's
// style either. The user called out both, 2026-11-06.)
const CAMPFIRE_ART = { log: '012', logScale: 0.7, logTilt: 0.42, flameBank: '020', flames: [15, 16, 17, 18], flameScale: 1.5, ms: 120 };
function drawCampfire({ x, y }, now) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(x, y - 4, 2, x, y - 4, 34); gl.addColorStop(0, `rgba(255,170,70,${0.45 + 0.1 * Math.sin(now / 90)})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - 4, 34, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y) + 3, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // crossed logs, then the flame on top
  const A = CAMPFIRE_ART, Fr = D.objects.frames, im = img(D.objects.img), L = Fr[D.objects.banks[A.log].f[0]];
  const R = Fr[D.objects.banks[A.flameBank].f[A.flames[Math.floor(now / A.ms) % A.flames.length]]];
  ctx.imageSmoothingEnabled = false;
  if (L && R && im && im.complete && im.naturalWidth) {
    const s = A.logScale;
    for (const a of [A.logTilt, -A.logTilt]) { ctx.save(); ctx.translate(Math.round(x), Math.round(y) - 1); ctx.rotate(a); ctx.drawImage(im, L[0], L[1], L[2], L[3], -L[2] * s / 2, -L[3] * s / 2, L[2] * s, L[3] * s); ctx.restore(); }
    const fs = A.flameScale; ctx.drawImage(im, R[0], R[1], R[2], R[3], Math.round(x - R[2] * fs / 2), Math.round(y - 2 - R[3] * fs), R[2] * fs, R[3] * fs);
  }
  for (let i = 0; i < 6; i++) { const k = (now / 900 + i / 6) % 1; ctx.globalAlpha = 1 - k;   // sparks rising
    ctx.fillStyle = i % 2 ? '#ffd27a' : '#ff8a3a'; ctx.fillRect(Math.round(x + Math.sin(now / 300 + i * 2) * 4 * (1 + k)), Math.round(y - 18 - k * 18), 1, 1); }
  for (let i = 0; i < 3; i++) { const k = (now / 2400 + i / 3) % 1; ctx.globalAlpha = 0.25 * (1 - k);   // a thin smoke
    ctx.fillStyle = '#c8c0b8'; const sz = Math.round(2 + k * 4); ctx.fillRect(Math.round(x + Math.sin(now / 800 + i) * 3 + k * 5), Math.round(y - 22 - k * 22), sz, sz); }
  ctx.globalAlpha = 1;
}
const canCook = (pr, R) => Object.entries(R.need).every(([id, n]) => itemCount(pr, id) >= n);
function updateKitchen(game, m) {
  const pr = game.profile, nav = panelNav(m, RECIPES.length, 0), R = RECIPES[m.cur];
  if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok || !R) return;
  if (!canCook(pr, R)) { game.toast('Missing ingredients', '#ff8a8a'); return; }
  for (const [id, n] of Object.entries(R.need)) addItem(pr, id, -n);
  addItem(pr, R.out, R.n); game.save();
  game.toast(`Cooked ${ITEMS[R.out].name}!${CLASSES[pr.cls].chef ? ' ★★★★★' : ''}`, '#ffd27a');
}
function drawKitchen(game, m, now) {
  const pr = game.profile;
  const rows = RECIPES.map(R => ({ icon: itemIcon(R.out), name: `${ITEMS[R.out].name}  (have ${itemCount(pr, R.out)})`, sub: Object.entries(R.need).map(([id, n]) => `${ITEMS[id].name} ${itemCount(pr, id)}/${n}`).join(' · '), right: canCook(pr, R) ? 'COOK' : '—', rightCol: canCook(pr, R) ? '#8fffb0' : '#7a7468', dim: !canCook(pr, R) }));
  const R = RECIPES[m.cur];
  panelMenu(m, { title: 'KITCHEN', rows, info: R ? `+${ITEMS[R.out].hunger} hunger · ${ITEMS[R.out].desc}` : '', keys: '↑↓ choose · Enter cook · Esc close' }, now);
}

// ---------------------------------------------------------------- MY CHEST (the food store by the farm)
// Your bag on the left, My Chest on the right: ←/→ picks a side, ↑/↓ an item, Enter (or a click on the chosen row)
// moves one to the other side, X the whole stack. STORE ALL / TAKE ALL move every bit of food across. Seeds stay in
// the bag. The chest is pr.pantry.
function pantryMenu() { return { type: 'pantry', tab: 0, cur: 0, scroll: 0 }; }
const isFood = id => ITEMS[id] && ITEMS[id].kind !== 'seed';
const pantryCount = pr => Object.values(pr.pantry || {}).reduce((s, n) => s + n, 0);
const bagFoodCount = pr => Object.keys(pr.items || {}).filter(isFood).reduce((s, id) => s + pr.items[id], 0);
function pantryRows(pr, side) {
  const src = side === 0 ? pr.items || {} : pr.pantry || {};
  return Object.keys(ITEMS).filter(id => isFood(id) && src[id] > 0).map(id => ({ id, n: src[id] }));
}
const CH = { x: PM.x + 12, y: PM.y + 34, colW: 192, gap: 12, rowH: 20, rows: 9 };
const chCol = side => CH.x + side * (CH.colW + CH.gap);
const PB = { one: { x: PM.x + 12, y: PM.y + PM.h - 30, w: 92, h: 18, label: 'MOVE 1 (Enter)' }, stack: { x: PM.x + 110, y: PM.y + PM.h - 30, w: 92, h: 18, label: 'MOVE STACK (X)' },
  all: { x: PM.x + 216, y: PM.y + PM.h - 30, w: 92, h: 18, label: 'STORE ALL ⇢', col: '#8fffb0' }, take: { x: PM.x + 314, y: PM.y + PM.h - 30, w: 94, h: 18, label: '⇠ TAKE ALL', col: '#9fd8ff' } };
function pantryMove(pr, id, n, toChest) {
  pr.pantry = pr.pantry || {};
  const from = toChest ? pr.items : pr.pantry, k = Math.min(n, from[id] || 0); if (!k) return 0;
  if (toChest) { addItem(pr, id, -k); pr.pantry[id] = (pr.pantry[id] || 0) + k; }
  else { pr.pantry[id] -= k; if (pr.pantry[id] <= 0) delete pr.pantry[id]; addItem(pr, id, k); }
  return k;
}
function updatePantry(game, m) {
  const pr = game.profile, k = navInput();
  if (k.back) { game.closeMenu(); return; }
  if (k.l || k.r) { m.tab = k.l ? 0 : 1; m.cur = Math.min(m.cur, Math.max(0, pantryRows(pr, m.tab).length - 1)); }
  let rows = pantryRows(pr, m.tab), clickMove = false;
  for (const side of [0, 1]) pantryRows(pr, side).forEach((r, i) => {
    if (i < CH.rows && clicked(chCol(side), CH.y + 14 + i * CH.rowH, CH.colW, CH.rowH - 2)) { clickMove = m.tab === side && m.cur === i; m.tab = side; m.cur = i; }
  });
  rows = pantryRows(pr, m.tab);
  if (k.u) m.cur = Math.max(0, m.cur - 1); if (k.d) m.cur = Math.min(Math.max(0, rows.length - 1), m.cur + 1);
  m.cur = clamp(m.cur, 0, Math.max(0, rows.length - 1));
  const r = rows[m.cur], toChest = m.tab === 0, stack = hit('KeyX') || btnHit(PB.stack);
  if (r && (k.ok || clickMove || btnHit(PB.one) || stack)) {
    const n = pantryMove(pr, r.id, stack ? Infinity : 1, toChest);
    game.toast(`${n} × ${ITEMS[r.id].name} → ${toChest ? 'My Chest' : 'your bag'}`, '#ffe9a8'); game.save();
    m.cur = Math.min(m.cur, Math.max(0, pantryRows(pr, m.tab).length - 1));
  }
  for (const [B, intoChest] of [[PB.all, true], [PB.take, false]]) if (btnHit(B)) {
    const src = intoChest ? pr.items || {} : pr.pantry || {}; let n = 0;
    for (const id of Object.keys(src).filter(isFood)) n += pantryMove(pr, id, Infinity, intoChest);
    game.toast(n ? `Moved ${n} food ${intoChest ? 'into My Chest' : 'into your bag'}` : intoChest ? 'No food in your bag' : 'My Chest is empty', '#ffe9a8'); if (n) game.save();
  }
}
function drawPantry(game, m, now) {
  const pr = game.profile;
  ctx.fillStyle = 'rgba(6,4,14,0.72)'; ctx.fillRect(0, 0, VW, VH);
  zWindow(PM.x, PM.y, PM.w, PM.h);
  goldText('MY CHEST', VW / 2, PM.y + 16, 14, { spacing: 2, glow: 'rgba(255,200,80,0.5)' });
  for (const side of [0, 1]) {
    const x = chCol(side), rows = pantryRows(pr, side), on = m.tab === side;
    ctx.fillStyle = on ? 'rgba(255,215,120,0.12)' : 'rgba(0,0,0,0.25)'; rrect(ctx, x, CH.y - 2, CH.colW, CH.rows * CH.rowH + 18, 5); ctx.fill();
    ctx.strokeStyle = on ? '#ffd23f' : 'rgba(201,168,90,0.5)'; ctx.lineWidth = on ? 1 : 0.8; rrect(ctx, x + 0.5, CH.y - 1.5, CH.colW - 1, CH.rows * CH.rowH + 17, 5); ctx.stroke();
    text(side ? `MY CHEST  (${pantryCount(pr)})` : `BAG  (${bagFoodCount(pr)})`, x + CH.colW / 2, CH.y + 6, on ? '#ffe9a8' : '#c9c1a8', 7.5);
    if (!rows.length) text(side ? 'Empty — store food here' : 'No food in your bag', x + CH.colW / 2, CH.y + 60, '#8a8070', 7);
    rows.slice(0, CH.rows).forEach((r, i) => {
      const y = CH.y + 14 + i * CH.rowH, sel = on && i === m.cur;
      ctx.fillStyle = sel ? 'rgba(255,215,120,0.22)' : i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.22)'; rrect(ctx, x + 3, y, CH.colW - 6, CH.rowH - 2, 4); ctx.fill();
      if (sel) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.9; rrect(ctx, x + 3.5, y + 0.5, CH.colW - 7, CH.rowH - 3, 4); ctx.stroke(); }
      iconCentered('items', itemIcon(r.id), x + 14, y + CH.rowH / 2 - 1, 14);
      text(ITEMS[r.id].name, x + 25, y + CH.rowH / 2 - 0.5, '#f4ecd8', 7, 'left');
      text(`×${r.n}`, x + CH.colW - 10, y + CH.rowH / 2 - 0.5, '#ffd23f', 7, 'right');
      if (sel) text(side ? '⇠' : '⇢', side ? x - 6 : x + CH.colW + 6, y + CH.rowH / 2 - 0.5, `rgba(255,233,168,${0.6 + 0.4 * Math.sin(now / 200)})`, 9);
    });
    if (rows.length > CH.rows) text(`+${rows.length - CH.rows} more`, x + CH.colW / 2, CH.y + 14 + CH.rows * CH.rowH - 2, '#9a917c', 6);
  }
  // what the chosen item is
  const r = pantryRows(pr, m.tab)[m.cur];
  if (r) wrap(ITEMS[r.id].desc, PM.w - 30, 6.2).slice(0, 2).forEach((ln, i) => text(ln, VW / 2, PM.y + PM.h - 50 + i * 8, '#c8c0d8', 6.2));
  for (const B of [PB.one, PB.stack, PB.all, PB.take]) {
    const hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
    ctx.fillStyle = hov ? 'rgba(90,50,20,0.95)' : 'rgba(40,24,12,0.9)'; rrect(ctx, B.x, B.y, B.w, B.h, 5); ctx.fill();
    ctx.strokeStyle = '#c89a4a'; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 5); ctx.stroke();
    text(B.label, B.x + B.w / 2, B.y + B.h / 2 + 0.5, B.col || '#f4ecd8', 6.8);
  }
  text('←→ bag / chest · ↑↓ choose · Enter move one across · X move the stack · Esc close', VW / 2, PM.y + PM.h + 10, '#9a917c', 6.5);
}

// ---------------------------------------------------------------- planting
function plantMenu(i) { return { type: 'plant', plot: i, cur: 0, scroll: 0 }; }
const seedIds = pr => Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'seed' && itemCount(pr, id) > 0);
function updatePlant(game, m) {
  const pr = game.profile, list = seedIds(pr), nav = panelNav(m, list.length, 0);
  if (nav.back) { game.closeMenu(); return; }
  if (hit('KeyR') && list[m.cur]) { plantRow(game, m.plot, list[m.cur]); return; }   // R: the whole row
  if (!nav.ok || !list[m.cur]) return;
  const id = list[m.cur]; addItem(pr, id, -1);
  const fresh = farmOf(pr)[m.plot] = { tilled: true, crop: ITEMS[id].crop, grown: 0, t: Date.now(), wet: 0 }; game.closeMenu();
  if (fertilize(pr, fresh)) game.toast('Fertilizer worked into the soil: faster, and one more crop', '#b8ff8a');
  farmXp(game, 2); game.save();
  game.toast(`Planted ${ITEMS[ITEMS[id].crop].name} — now water it (Enter)`, '#8fffb0');
}
// PLANT THE ROW (R in the seed list): the chosen seed goes into this plot and every empty, tilled plot next to it in the same
// row of the same field, outwards both ways until a planted or rough plot, the row's end, or the seeds run out
function plantRow(game, i, id) {
  const pr = game.profile, farm = farmOf(pr), c = farmPlots()[i], plots = [i];
  for (const dir of [-1, 1]) for (let j = i + dir; ; j += dir) {
    const Q = farm[j], cj = farmPlots()[j];
    if (!cj || cj.town !== c.town || Math.abs(cj.y - c.y) > 2 || !Q || !Q.tilled || Q.crop || plotLocked(pr, j) || !plotOpen(pr, j)) break;
    plots.push(j);
  }
  let n = 0, fert = 0;
  for (const j of plots) {
    if (itemCount(pr, id) <= 0) break;
    addItem(pr, id, -1); const fresh = farm[j] = { tilled: true, crop: ITEMS[id].crop, grown: 0, t: Date.now(), wet: 0 }; n++;
    if (fertilize(pr, fresh)) fert++;
    const cj = farmPlots()[j]; game.world.rings.push({ x: cj.x, y: cj.y, r: 12, t: -40 * n, col: '#8fffb0' });
  }
  if (game.menu && game.menu.type === 'plant') game.closeMenu();   // (only the seed list: a friend's planting must not shut the host's own menu)
  farmXp(game, 2 * n); game.save();
  game.toast(`Planted ${n} × ${ITEMS[ITEMS[id].crop].name}${fert ? ` (${fert} fertilized)` : ''} — now water ${n > 1 ? 'them' : 'it'} (Enter)`, '#8fffb0');
}
function drawPlant(game, m, now) {
  const pr = game.profile;
  panelMenu(m, { title: `FARM PLOT ${m.plot + 1}`, rows: seedIds(pr).map(id => ({ icon: itemIcon(id), name: ITEMS[id].name, sub: ITEMS[id].desc, right: `×${itemCount(pr, id)}` })),
    empty: 'No seeds — the Grocer in the village sells them.', keys: '↑↓ choose · Enter plant · R plant the row · Esc close' }, now);
}

// ---------------------------------------------------------------- wardrobe: restyle the house
function wardrobeMenu() { return { type: 'wardrobe', cur: 0, scroll: 0 }; }
function wardrobeRows(pr) {
  const H = homeOf(pr);
  return [
    { k: 'layout', draw: HOUSE_ROW, name: `Style: ${(HOME_STYLES[H.layout] || HOME_STYLES[0]).name} (${(H.layout % HOME_LAYOUTS.length) + 1} of ${HOME_LAYOUTS.length})`, sub: '← → change the floor, walls and rug' },
    { k: 'tint', icon: ITEM2_BASE + 979, name: `Colours: ${HOME_TINTS[H.tint || 0].name}`, sub: '← → change the floor and wall colours' },
    { k: 'rest', icon: ITEM2_BASE + 1071, name: 'Rest in bed', sub: 'restore HP and MP and save the game' },
  ];
}
function updateWardrobe(game, m) {
  const pr = game.profile, H = homeOf(pr), rows = wardrobeRows(pr);
  const lr = hit('ArrowLeft', 'KeyA') ? -1 : hit('ArrowRight', 'KeyD') ? 1 : 0;
  const nav = panelNav(m, rows.length, 0), r = rows[m.cur];
  if (nav.back) { game.closeMenu(); return; }
  const restyle = () => { game.save(); const w = game.world; if (w && w.home) { const out = game.outside; game.world = out; game.outside = null; out.player = w.player; out.actors.push(...w.actors.filter(a => a === w.player || (a.ally && a.owner === w.player))); enterHome(game); game.menu = m; } };
  if (r.k === 'layout' && (lr || nav.ok)) { H.layout = (H.layout + (lr || 1) + HOME_LAYOUTS.length) % HOME_LAYOUTS.length; restyle(); }
  if (r.k === 'tint' && (lr || nav.ok)) { H.tint = ((H.tint || 0) + (lr || 1) + HOME_TINTS.length) % HOME_TINTS.length; restyle(); }
  if (r.k === 'rest' && nav.ok) { const p = game.world.player; p.hp = p.maxHp; p.mp = p.maxMp; p.status = {}; const fed = healFeeds(game, 1); game.save(); game.toast(`Rested — HP and MP restored${fedNote(fed)}, game saved`, '#ffe9a8'); }
}
function drawWardrobe(game, m, now) { panelMenu(m, { title: 'WARDROBE', rows: wardrobeRows(game.profile), keys: '↑↓ choose · ←→ change · Enter select · Esc close' }, now); }

// ---------------------------------------------------------------- the Farm Board (farming stats)
// (the screen itself: farmboard.js)
