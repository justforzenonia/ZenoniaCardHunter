'use strict';
// THE WORKSHOP (Z, anywhere): every material now leads somewhere. Ore and herbs come from the Wilds' nodes, leather, dust and gems from
// monsters and chests, wool, milk, eggs and truffles from the farmyard, water from fishing, bones and hides from the butcher.
//   MATERIALS  ore + wood become alloys, wool and wheat become thread and cloth, hides become worked leather
//   GEAR       those forge gear of a chosen slot and rank: always Fine or better, often part of a set
//   UPGRADE    raise a piece's quality, attune it to a set, set a stone in it, or salvage it back into metal
//   FARM       fertilizer, hoes, animal feed, cheese, rare seeds, and the potions and rope you carry
//   BOOK       every material: where it comes from and what it makes
// A need is [material, count]: a number is a Zenonia 2 good (pr.goods), a string a home item (pr.items).
const MAT = { copper: 949, iron: 950, mithril: 951, thorium: 952, linen: 955, woolCloth: 956, runicCloth: 957, thinL: 958, thickL: 959, strongL: 960, runicD: 961, mysticD: 962, fairyD: 963,
  herb: 964, leaf: 965, chive: 966, pine: 967, oak: 968, birch: 969, willow: 1066, pillar: 970, silver: 971, goldSt: 972, linenT: 976, woolT: 977, bottle: 982, waterP: 991, waterL: 992, waterLife: 993,
  bronze: 997, steel: 1000, adaman: 1001, orhalcon: 1002, knotL: 1006, enchL: 1007, runeL: 1008, bone: 1035, mirror: 1036, blue: 1037, yellow: 1038, green: 1039, red: 1040, orb: 1044, sky: 1045,
  fert: 1047, goldP: 1055, scrap: 1059, lava: 1060, salt: 1021, spice: 1022, supp: 943, lowHoe: 906, midHoe: 907, highHoe: 908, magicHoe: 1089, impact: 1076, swiftS: 1077, wealth: 1078, fortune: 1079,
  castIron: 998, sarona: 999, halcon: 953, orcon: 954, frameI: 973, frameM: 974, frameT: 975, runicT: 978, dyeA: 979, dyeS: 980, dyeE: 981, crystalB: 983, magicB: 984, marbleG: 985, marbleC: 986, marbleM: 987, paperT: 988, paperK: 989, parch: 990,
  waterE: 994, waterD: 995, waterU: 996, scrollL: 1003, scrollW: 1004, scrollR: 1005, hiltD: 1009, hiltR: 1010, hiltO: 1011, barS: 1012, barM: 1013, barL: 1014, ench1: 1015, ench2: 1016, ench3: 1017, gongB: 1018, gongC: 1019, gongS: 1020,
  sheS: 902, sheM: 903, sheL: 904, sheXL: 905, comW: 944, comA: 945, comI: 946, comO: 947, omni: 937, origin: 1069 };
const M = MAT;
const CR_BAND = { tier: [2, 4, 6, 8], alloy: [M.bronze, M.steel, M.adaman, M.orhalcon], leather: [M.knotL, M.enchL, M.runeL, M.runeL], cloth: [M.linen, M.woolCloth, M.runicCloth, M.runicCloth], gem: [M.yellow, M.blue, M.green, M.red], dust: [M.runicD, M.mysticD, M.fairyD, M.fairyD] };
const crBand = t => t <= 2 ? 0 : t <= 4 ? 1 : t <= 6 ? 2 : 3;
const CR_SLOT = { weapon: (b, l, c, g, d) => [[b, 3], [l, 1]], body: (b, l) => [[b, 2], [l, 2]], head: (b, l, c) => [[b, 2], [c, 1]], boots: (b, l, c) => [[l, 2], [c, 1]], accessory: (b, l, c, g) => [[b, 1], [g, 1]], trinket: (b, l, c, g, d) => [[g, 1], [d, 2]] };
const CRAFT = { goldPerRank: 60, setChance: 0.5, tabs: ['MATERIALS', 'GEAR', 'UPGRADE', 'FARM', 'BOOK'], dropChance: 0.65, gemChance: 0.08, nodeGem: 0.08, waterChance: 0.35, pill: { x: 6, y: VH - 126, w: 74, h: 14 }, col: '#ffc27a',
  hoe: [[M.magicHoe, 1], [M.highHoe, 0.5], [M.midHoe, 0.3], [M.lowHoe, 0.15]], fertGrow: 1.5,
  ore: [[M.copper, M.scrap], [M.iron, M.pillar], [M.mithril, M.silver, M.lava], [M.thorium, M.goldSt, M.lava]], herb: [[M.herb, M.pine], [M.chive, M.oak], [M.leaf, M.birch], [M.leaf, M.willow]],
  drops: [[M.thinL, M.runicD, M.bone], [M.thickL, M.mysticD, M.orb, M.bone], [M.strongL, M.fairyD, M.sky, M.goldP], [M.strongL, M.fairyD, M.sky, M.mirror]], water: [M.waterP, M.waterP, M.waterL, M.waterL, M.waterLife] };
const CRAFT_LIST = [
  [{ out: M.bronze, need: [[M.copper, 2], [M.pine, 1]] }, { out: M.steel, need: [[M.iron, 2], [M.oak, 1]] }, { out: M.adaman, need: [[M.mithril, 2], [M.birch, 1]] }, { out: M.orhalcon, need: [[M.thorium, 2], [M.willow, 1]] },
    { out: M.linenT, n: 2, need: [['wheat', 4]] }, { out: M.woolT, n: 2, need: [['wool', 1]] }, { out: M.linen, need: [[M.linenT, 2]] }, { out: M.woolCloth, need: [[M.woolT, 2]] }, { out: M.runicCloth, need: [[M.woolCloth, 1], [M.runicD, 2]] },
    { out: M.knotL, need: [[M.thinL, 2], [M.linenT, 1]] }, { out: M.enchL, need: [[M.thickL, 2], [M.mysticD, 1]] }, { out: M.runeL, need: [[M.strongL, 2], [M.fairyD, 1]] },
    { out: M.bottle, n: 2, need: [[M.pillar, 1]] }, { out: M.salt, n: 2, need: [[M.waterP, 1], [M.pillar, 1]] }, { out: M.supp, need: [['egg', 1], [M.herb, 1], [M.waterP, 1]] },
    { out: M.impact, need: [[M.lava, 2], [M.red, 1]] }, { out: M.swiftS, need: [[M.sky, 1], [M.green, 1]] }, { out: M.wealth, need: [[M.goldP, 1], [M.yellow, 1]] }, { out: M.fortune, need: [[M.orb, 2], [M.blue, 1]] },
    // the odd materials the monsters drop: these rows stay hidden until you hold something that goes into them, so the list stays short
    ...[{ out: M.castIron, need: [[M.iron, 2], [M.scrap, 1]] }, { out: M.sarona, need: [[M.mithril, 2], [M.silver, 1]] }, { out: M.halcon, need: [[M.thorium, 1], [M.silver, 2]] }, { out: M.orcon, need: [[M.halcon, 2], [M.lava, 1]] },
      { out: M.frameI, need: [[M.iron, 3]] }, { out: M.frameM, need: [[M.mithril, 3]] }, { out: M.frameT, need: [[M.thorium, 3]] }, { out: M.runicT, need: [[M.woolT, 2], [M.runicD, 1]] }, { out: M.hiltD, need: [[M.bronze, 1], [M.pine, 2]] }, { out: M.hiltR, need: [[M.steel, 1], [M.runicT, 1]] }, { out: M.hiltO, need: [[M.orcon, 1], [M.willow, 2]] },
      { out: M.barS, need: [[M.bronze, 2]] }, { out: M.barM, need: [[M.castIron, 2]] }, { out: M.barL, need: [[M.sarona, 2]] }, { out: M.gongB, need: [[M.bronze, 3]] }, { out: M.gongC, need: [[M.castIron, 3]] }, { out: M.gongS, need: [[M.sarona, 3]] },
      { out: M.paperT, need: [[M.linenT, 2]] }, { out: M.paperK, need: [[M.woolT, 2]] }, { out: M.parch, need: [[M.thinL, 1], [M.paperK, 1]] }, { out: M.crystalB, need: [[M.bottle, 2], [M.mysticD, 1]] }, { out: M.magicB, need: [[M.crystalB, 2], [M.fairyD, 1]] },
      { out: M.marbleG, need: [[M.bottle, 2]] }, { out: M.marbleC, need: [[M.marbleG, 2], [M.mysticD, 1]] }, { out: M.marbleM, need: [[M.marbleC, 2], [M.fairyD, 1]] }, { out: M.waterE, need: [[M.waterP, 2], [M.runicD, 1]] }, { out: M.waterD, need: [[M.waterL, 2], [M.mysticD, 1]] }, { out: M.waterU, need: [[M.waterLife, 1], [M.fairyD, 2]] },
      { out: M.ench1, need: [[M.waterE, 1], [M.marbleG, 1], [M.paperT, 1]] }, { out: M.ench2, need: [[M.waterD, 1], [M.marbleC, 1], [M.paperK, 1]] }, { out: M.ench3, need: [[M.waterU, 1], [M.marbleM, 1], [M.parch, 1]] },
      { out: M.scrollL, need: [[M.linen, 1], [M.paperT, 1]] }, { out: M.scrollW, need: [[M.woolCloth, 1], [M.paperK, 1]] }, { out: M.scrollR, need: [[M.runicCloth, 1], [M.parch, 1]] }, { out: M.comW, need: [[M.scrollL, 1], [M.runicD, 2]] }, { out: M.comA, need: [[M.scrollW, 1], [M.mysticD, 1]] }, { out: M.comO, need: [[M.scrollR, 1], [M.fairyD, 1]] }, { out: M.comI, need: [[M.paperT, 2], [M.runicD, 1]] },
      { out: M.sheS, need: [[M.scrap, 2], [M.pillar, 1]] }, { out: M.sheM, need: [[M.castIron, 1], [M.pillar, 2]] }, { out: M.sheL, need: [[M.sarona, 1], [M.silver, 2]] }, { out: M.sheXL, need: [[M.orcon, 1], [M.goldSt, 2]] },
      { out: M.dyeA, need: [[M.herb, 2], [M.waterP, 1]] }, { out: M.dyeS, need: [[M.salt, 2], [M.chive, 1]] }, { out: M.dyeE, need: [[M.comI, 1], [M.fairyD, 1]] }, { out: M.omni, need: [[M.crystalB, 1], [M.chive, 2], [M.herb, 2]] }, { out: M.origin, need: [[M.magicB, 1], [M.waterLife, 1]] }].map(R => ({ ...R, late: true }))],
  CR_BAND.tier.flatMap((tier, i) => GEAR_SLOTS.map(slot => ({ gear: slot, tier, gold: CRAFT.goldPerRank * (tier + 1), need: CR_SLOT[slot](CR_BAND.alloy[i], CR_BAND.leather[i], CR_BAND.cloth[i], CR_BAND.gem[i], CR_BAND.dust[i]) }))),
  null,
  [{ out: M.fert, n: 2, need: [[M.bone, 1], ['wheat', 2]] }, { out: 'feed', n: 3, need: [['wheat', 3], ['carrot', 2]] }, { out: M.lowHoe, need: [[M.bronze, 2], [M.pine, 2]] }, { out: M.midHoe, need: [[M.steel, 2], [M.oak, 2]] }, { out: M.highHoe, need: [[M.adaman, 2], [M.birch, 2]] }, { out: M.magicHoe, need: [[M.orhalcon, 2], [M.willow, 2], [M.fairyD, 2]] },
    { out: 'cheese', need: [['milk', 2], [M.salt, 1]] }, { out: M.spice, need: [['truffle', 1], [M.salt, 1]] }, { out: 'seed_moonflower', need: [['truffle', 1], [M.fairyD, 1], ['berry', 3]] }, { out: 'seed_dragonfruit', need: [['truffle', 2], [M.lava, 1], ['moonflower', 1]] },
    { out: potionIdx(10), n: 2, need: [[M.herb, 2], [M.bottle, 1]] }, { out: potionIdx(26), n: 2, need: [[M.chive, 2], [M.bottle, 1]] }, { out: 'rope', need: [[M.linenT, 4], ['wool', 1]] }],
];
const CR_STONES = { [M.impact]: 'brutal', [M.swiftS]: 'swift', [M.wealth]: 'regen', [M.fortune]: 'crit' };
const crNeedUp = g => { const i = crBand(g.tier); return { alloy: CR_BAND.alloy[i], dust: CR_BAND.dust[i] }; };
const crTopSet = () => { const W = wornSets(GAME.profile); return Object.keys(W).sort((a, b) => W[b].n - W[a].n)[0] || null; };
const crSpare = (pr, g) => !Object.values(pr.eq || {}).includes(g.uid);
const crTwin = g => { const pr = GAME.profile; return pr.gear.find(x => x !== g && x.slot === g.slot && x.tier === g.tier && crSpare(pr, x)); };
function crCombine(g) {   // a scroll, and the part that suits the slot
  const i = crBand(g.tier), W = g.slot === 'weapon', Bd = g.slot === 'body', Ar = Bd || g.slot === 'head' || g.slot === 'boots';
  const part = (W ? [M.hiltD, M.hiltR, M.hiltO, M.hiltO] : Bd ? [M.frameI, M.frameM, M.frameT, M.frameT] : Ar ? [M.barS, M.barM, M.barL, M.barL] : [M.gongB, M.gongC, M.gongS, M.gongS])[i];
  return [[W ? M.comW : Ar ? M.comA : M.comO, 1], [part, 1]];
}
const CR_UPS = [
  { id: 'polish', name: 'Polish', desc: 'One step up in quality, and stronger for it', fit: g => (g.q || 0) < GEAR_QUALITY.length - 1, need: g => [[crNeedUp(g).alloy, 2], [M.supp, 1]],
    apply: (pr, g) => { gearQuality(g, (g.q || 0) + 1); return `${g.name} is now ${GEAR_QUALITY[g.q].name}`; } },
  { id: 'attune', name: 'Attune', desc: 'Bind a piece with no set to a random set', fit: g => !g.set, need: g => [[M.mirror, 1], [crNeedUp(g).dust, 3]],
    apply: (pr, g) => { g.set = pick(Object.keys(GEAR_SETS)); return `${g.name} joins the ${GEAR_SETS[g.set].name} set`; } },
  ...Object.keys(CR_STONES).map(k => ({ id: 's' + k, stone: +k, name: `Set ${Z2_ITEM[k].name}`, desc: `A socket for it: ${PASSIVES[CR_STONES[k]].name}. One stone a piece`, fit: g => !g.sock, need: () => [[+k, 1]],
    apply: (pr, g) => { const id = CR_STONES[k]; g.sock = id; (g.bonus = g.bonus || []); if (!g.bonus.some(b => b.id === id)) g.bonus.push({ id, tier: Math.max(1, g.tier - 2), mul: 1 }); return `${Z2_ITEM[k].name} set in ${g.name}`; } })),
  { id: 'dye', icon: M.dyeA, name: 'Dye', desc: 'Change a set piece to the set you wear the most of', fit: g => !!g.set && !!crTopSet() && g.set !== crTopSet(), need: g => [[[M.dyeA, M.dyeS, M.dyeE, M.dyeE][crBand(g.tier)], 1]],
    apply: (pr, g) => { g.set = crTopSet(); return `${g.name} is dyed to the ${GEAR_SETS[g.set].name} set`; } },
  { id: 'hone', icon: M.sheS, name: 'Hone', desc: 'All its stats +10%. Once a piece', fit: g => !g.honed, need: g => [[[M.sheS, M.sheM, M.sheL, M.sheXL][crBand(g.tier)], 1]],
    apply: (pr, g) => { g.honed = true; for (const s in g.stats) g.stats[s] = Math.ceil(g.stats[s] * 1.1); return `${g.name} is honed`; } },
  { id: 'enchant', icon: M.ench1, name: 'Enchant', desc: 'Add a random passive. Up to three on a piece', fit: g => (g.bonus || []).length < 3, need: g => [[[M.ench1, M.ench2, M.ench3, M.ench3][crBand(g.tier)], 1]],
    apply: (pr, g) => { g.bonus = g.bonus || []; const id = pick(PASSIVE_IDS.filter(p => !g.bonus.some(b => b.id === p))); g.bonus.push({ id, tier: Math.max(1, g.tier - 3), mul: 1 }); return `${g.name} gains ${PASSIVES[id].name}`; } },
  { id: 'combine', icon: M.comW, name: 'Combine', desc: 'Two spare pieces, same slot and rank, make one a rank higher', bag: true, fit: g => g.tier < RANKS.length - 1 && !!crTwin(g), need: g => crCombine(g),
    apply: (pr, g) => { const t = crTwin(g), n = makeGear(g.slot, g.tier + 1, pr.cls); if (!n.q) gearQuality(n, 1); pr.gear = pr.gear.filter(x => x !== g && x !== t); pr.gear.push(n); return `Combined into ${n.name}! It's in your bag`; } },
  { id: 'salvage', name: 'Salvage', desc: 'Break a spare piece in your bag into metal and dust', bag: true, fit: () => true, need: () => [],
    apply: (pr, g) => { const { alloy, dust } = crNeedUp(g), a = 1 + (g.q || 0); matGive(pr, alloy, a); matGive(pr, dust, 1); pr.gear = pr.gear.filter(x => x !== g); return `Salvaged into ${a} × ${matName(alloy)} and ${matName(dust)}`; } },
];
const CR_FROM = { [M.copper]: 'Ore veins, Verdant Fields', [M.iron]: 'Ore veins, Twilight Grove', [M.mithril]: 'Ore veins, Skyreach Isles', [M.thorium]: 'Ore veins, Frozen Abyss', [M.scrap]: 'Ore veins, Verdant Fields', [M.pillar]: 'Ore veins, Twilight Grove', [M.silver]: 'Ore veins, Skyreach Isles', [M.goldSt]: 'Ore veins, Frozen Abyss', [M.lava]: 'Ore veins, Skyreach Isles and beyond',
  [M.herb]: 'Herb patches, Verdant Fields', [M.pine]: 'Herb patches, Verdant Fields', [M.chive]: 'Herb patches, Twilight Grove', [M.oak]: 'Herb patches, Twilight Grove', [M.leaf]: 'Herb patches, Ember and Frozen', [M.birch]: 'Herb patches, Skyreach Isles', [M.willow]: 'Herb patches, Frozen Abyss',
  [M.thinL]: 'Weak monsters, the butcher', [M.thickL]: 'Rank C–B monsters', [M.strongL]: 'Rank A and up monsters', [M.runicD]: 'Weak monsters', [M.mysticD]: 'Rank C–B monsters', [M.fairyD]: 'Rank A and up monsters', [M.bone]: 'Monsters, the butcher', [M.orb]: 'Rank C–B monsters', [M.sky]: 'Rank A and up monsters', [M.goldP]: 'Rank A–S monsters', [M.mirror]: 'Rank SS and up monsters',
  [M.blue]: 'Monsters, ore veins', [M.yellow]: 'Monsters, ore veins', [M.green]: 'Monsters, ore veins', [M.red]: 'Monsters, ore veins', [M.waterP]: 'Fishing', [M.waterL]: 'Fishing', [M.waterLife]: 'Fishing, rare catches',
  wheat: 'Farm', carrot: 'Farm', berry: 'Farm', moonflower: 'Farm', wool: 'Your sheep', milk: 'Your cows', egg: 'Your chickens', truffle: 'Your pigs' };
const crIsGood = r => typeof r === 'number';
const matName = r => crIsGood(r) ? (Z2_ITEM[r] || {}).name || 'Material' : ITEMS[r].name;
const matIcon = r => crIsGood(r) ? ITEM2_BASE + r : itemIcon(r);
const matHave = (pr, r) => crIsGood(r) ? (pr.goods || {})[r] || 0 : itemCount(pr, r);
function matGive(pr, r, n = 1) { if (!crIsGood(r)) { addItem(pr, r, n); return; } pr.goods = pr.goods || {}; pr.goods[r] = (pr.goods[r] || 0) + n; if (pr.goods[r] <= 0) delete pr.goods[r]; }
const crCan = (pr, need, gold = 0) => (pr.gold || 0) >= gold && need.every(([r, n]) => matHave(pr, r) >= n);
const crNeedText = (pr, need) => need.map(([r, n]) => `${matHave(pr, r) >= n ? '✓' : `${matHave(pr, r)}/`}${n} ${matName(r)}`).join('  ·  ');
// what a material makes, for the book and the bag
const CR_USES = {};
{ const add = (need, name) => need.forEach(([r]) => { const L = CR_USES[r] = CR_USES[r] || []; if (!L.includes(name)) L.push(name); });
  for (const L of CRAFT_LIST) if (L) for (const R of L) add(R.need, R.gear ? `${SLOT_LABEL[R.gear].toLowerCase()} gear` : matName(R.out));
  for (const U of CR_UPS) if (U.stone) add([[U.stone, 1]], 'a socket'); add([[M.mirror, 1]], 'attuning'); add([[M.supp, 1]], 'polishing');
  add([M.dyeA, M.dyeS, M.dyeE].map(r => [r]), 'dyeing a piece'); add([M.sheS, M.sheM, M.sheL, M.sheXL].map(r => [r]), 'honing'); add([M.ench1, M.ench2, M.ench3].map(r => [r]), 'enchanting');
  add([M.comW, M.comA, M.comO, M.hiltD, M.hiltR, M.hiltO, M.frameI, M.frameM, M.frameT, M.barS, M.barM, M.barL, M.gongB, M.gongC, M.gongS].map(r => [r]), 'combining gear'); }
const craftUses = r => (CR_USES[r] || []).slice(0, 4).join(', ');
const CR_BOOK = [...new Set([...Object.keys(CR_FROM).map(k => isNaN(k) ? k : +k), ...Object.keys(CR_USES).map(k => isNaN(k) ? k : +k)])].filter(r => crIsGood(r) ? Z2_ITEM[r] : ITEMS[r]);
// a piece's quality, moving its stats along with it
function gearQuality(g, q) {
  const k = GEAR_QUALITY[q].mul / GEAR_QUALITY[g.q || 0].mul; g.q = q;
  for (const s in g.stats) g.stats[s] = Math.ceil(g.stats[s] * k);
}
// ---------------------------------------------------------------- where materials come from (the hooks)
function craftDrop(tier) {
  if (Math.random() >= CRAFT.dropChance) return null;
  const r = Math.random() < CRAFT.gemChance ? pick(CR_BAND.gem) : pick(CRAFT.drops[crBand(tier)]);
  return { idx: r, name: matName(r), icon: matIcon(r), tier: 0 };
}
function craftNode(pr, kind, zone) {
  const r = pick((kind === 'ore' ? CRAFT.ore : CRAFT.herb)[zone] || CRAFT.ore[0]), n = randi(1, 2); matGive(pr, r, n); let msg = ` · ${n} × ${matName(r)}`;
  if (kind === 'ore' && Math.random() < CRAFT.nodeGem) { const g = pick(CR_BAND.gem); matGive(pr, g, 1); msg += ` and a ${matName(g)}!`; }
  return msg;
}
function craftFish(pr, rar) { if (Math.random() >= CRAFT.waterChance) return ''; const r = CRAFT.water[rar] || M.waterP; matGive(pr, r, 1); return r; }
function craftButcher(pr, n) { matGive(pr, M.thinL, n); matGive(pr, M.bone, n); }
const hoeBonus = pr => { const H = CRAFT.hoe.find(([r]) => matHave(pr, r) > 0); return H ? H[1] : 0; };
function fertilize(pr, P) { if (matHave(pr, M.fert) <= 0) return false; matGive(pr, M.fert, -1); P.fert = true; return true; }
// ---------------------------------------------------------------- the menu
function craftMenu() { return { type: 'craft', tab: 0, cur: 0, scroll: 0, pick: null }; }
const crPieces = (pr, U) => pr.gear.filter(g => U.fit(g) && (!U.bag || !Object.values(pr.eq || {}).includes(g.uid)));
function craftRows(game, m) {
  const pr = game.profile;
  if (m.pick) return crPieces(pr, m.pick).map(g => { const need = m.pick.need(g); return { ref: g, need, icon: g.icon, name: g.name, sub: need.length ? crNeedText(pr, need) : `${SLOT_LABEL[g.slot]} · rank ${RANKS[g.tier]}`, dim: !crCan(pr, need), col: rankColor(g.tier), right: Object.values(pr.eq || {}).includes(g.uid) ? 'WORN' : '' }; });
  if (m.tab === 4) return CR_BOOK.map(r => ({ icon: matIcon(r), name: `${matName(r)}  ×${matHave(pr, r)}`, sub: `From: ${CR_FROM[r] || 'Crafted'}${craftUses(r) ? `  ·  Makes: ${craftUses(r)}` : ''}`, dim: !matHave(pr, r) }));
  if (m.tab === 2) return CR_UPS.map(U => ({ up: U, icon: U.stone ? matIcon(U.stone) : ITEM2_BASE + (U.icon || (U.id === 'salvage' ? 939 : U.id === 'polish' ? M.supp : M.mirror)), name: U.name, sub: U.desc, right: `${crPieces(pr, U).length} pieces`, rightCol: '#c9c1a8', dim: !crPieces(pr, U).length }));
  return CRAFT_LIST[m.tab].filter(R => !R.late || matHave(pr, R.out) > 0 || R.need.some(([r]) => matHave(pr, r) > 0)).map(R => ({ recipe: R, icon: R.gear ? (GEAR_SLOTS.includes(R.gear) ? SLOT_GHOST[R.gear] : 0) : matIcon(R.out), name: R.gear ? `${RANKS[R.tier]} ${SLOT_LABEL[R.gear]}` : `${matName(R.out)}${R.n ? ` ×${R.n}` : ''}`, col: R.gear ? rankColor(R.tier) : null, sub: crNeedText(pr, R.need), right: R.gold ? `${R.gold} G` : '', rightCol: (pr.gold || 0) >= (R.gold || 0) ? '#ffd23f' : '#ff8a8a', dim: !crCan(pr, R.need, R.gold) }));
}
function craftMake(game, R) {
  const pr = game.profile; if (!crCan(pr, R.need, R.gold || 0)) { game.toast('Missing materials: open the BOOK tab to see where they come from', '#ff8a8a'); return; }
  R.need.forEach(([r, n]) => matGive(pr, r, -n)); pr.gold = (pr.gold || 0) - (R.gold || 0);
  if (R.gear) {
    const g = makeGear(R.gear, R.tier, pr.cls); if (!g.q) gearQuality(g, 1); if (!g.set && Math.random() < CRAFT.setChance) g.set = pick(Object.keys(GEAR_SETS));
    pr.gear.push(g); game.toast(`Forged ${g.name}${g.set ? ` (${GEAR_SETS[g.set].name} set)` : ''}! It's in your bag`, '#ffd27a');
  } else { matGive(pr, R.out, R.n || 1); game.toast(`Made ${matName(R.out)}${R.n ? ` ×${R.n}` : ''}`, '#ffd27a'); }
  game.save();
}
function updateCraft(game, m) {
  const pr = game.profile, rows = craftRows(game, m), nav = panelNav(m, rows.length, m.pick ? 0 : CRAFT.tabs.length), r = rows[m.cur];
  if (nav.back) { if (m.pick) { m.pick = null; m.cur = 0; m.scroll = 0; } else game.closeMenu(); return; }
  if (hit('KeyZ') && !m.pick) { game.closeMenu(); return; }
  if (!nav.ok || !r) return;
  if (m.pick) {
    if (!crCan(pr, r.need)) { game.toast('Missing materials: open the BOOK tab to see where they come from', '#ff8a8a'); return; }
    r.need.forEach(([q, n]) => matGive(pr, q, -n)); game.toast(m.pick.apply(pr, r.ref), '#ffd27a'); game.save(); game.refreshPlayer(); return;
  }
  if (r.up) { if (crPieces(pr, r.up).length) { m.pick = r.up; m.cur = 0; m.scroll = 0; } else game.toast('No piece of gear fits that', '#c9c1a8'); return; }
  if (r.recipe) craftMake(game, r.recipe);
}
function drawCraft(game, m, now) {
  const pr = game.profile;
  panelMenu(m, { title: m.pick ? m.pick.name.toUpperCase() : 'WORKSHOP', gold: pr.gold || 0, tabs: m.pick ? null : CRAFT.tabs, rows: craftRows(game, m), empty: 'Nothing to work on.', keys: m.pick ? '↑↓ choose a piece · Enter apply · Esc back' : m.tab === 4 ? '←→ tab · ↑↓ read · Esc close' : '←→ tab · ↑↓ choose · Enter make · Esc close' }, now);
}
function drawCraftPill(game, now) {
  const P = CRAFT.pill, pr = game.profile, w = game.world; if (!pr || !w || game.menu || w.rift || w.cave) return;
  hudPill(P, CRAFT.col, 'Z: Workshop', '#ffe9c8');   // (hud.js)
}
