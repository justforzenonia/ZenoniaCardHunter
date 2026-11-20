'use strict';
// THE DOG: a partner adopted with the Loyal Hound farm skill (Farm Board, one point). It follows you, fights with its
// own AI and casts the card you give it. Monsters fight it like they fight you; it has its own HP and hunger bars,
// and when it falls it stays down until you revive it with 20 food (PARTNER menu). It also sniffs out black holes.
//  · its FOOD BAG (PARTNER ▸ FOOD): food you put there keeps it alive — while the bag has food its HP never drops
//    below 1%, and every hit that would take it lower eats 1 food instead
//  · it earns XP from every monster that falls while it is out, and each of its levels makes it tougher and stronger
//    and gives a point for its own skills, which make it smarter:
//      OPENER     chance to open every new fight with its spell
//      FOCUS      casts its spell more often
//      FANGS      harder bites (+ATK)
//      THICK COAT more HP and less damage taken
//  · N opens the PARTNER menu: its level and skills, the card it casts and its food bag
//      TOUGH HIDE   takes less damage
//      LIGHT EATER  its hunger drains more slowly
//      QUICK MEND   it heals itself a little every second
//      HEALING LICK heals you when you are hurt and it is beside you (more, and more often, each level)
//      TRANSFORMATION  locked until you have used your Layer 100 times with it beside you; then, now and again in a
//                   fight, it TRANSFORMS into the character of the card it carries — with your stats and its own
//                   Layer, BEAST SOUL (an ember aura, paw motes, a howl that blasts foes) — for one in-game day,
//                   then rests for 12 in-game hours
// Saved on the profile as pr.pet = { lv, xp, pts, sk: { opener, focus, fangs, coat, hide, light, transform }, card,
//   bowl: { itemId: n }, layerUses, formT (ms of the form left), formCd (ms until it can transform again) }.

const DOG_SP = 'n100';
const PET_SKILLS = {
  opener: { name: 'Opener',     max: 5, desc: l => `${l * 18}% chance to open with its spell` },
  focus:  { name: 'Focus',      max: 5, desc: l => `casts ${l * 12}% more often` },
  fangs:  { name: 'Fangs',      max: 5, desc: l => `+${l * 12}% ATK` },
  coat:   { name: 'Thick Coat', max: 5, desc: l => `+${l * 15}% HP, −${l * 5}% damage` },
  hide:   { name: 'Tough Hide', max: 5, desc: l => `−${l * 6}% damage taken` },
  light:  { name: 'Light Eater', max: 5, desc: l => `hunger drains ${l * 15}% slower` },
  mend:   { name: 'Quick Mend', max: 5, desc: l => `heals itself ${petMendPct(l)}% HP every second` },
  heal:   { name: 'Healing Lick', max: 5, desc: l => `heals you ${petHealPct(l)}% HP every ${petHealSec(l)} s when you are hurt` },
  transform: { name: 'Transformation', max: 1, need: 100,
    desc: (l, P) => l ? 'turns into its card\'s character: your stats + Beast Soul layer · 1 day, 12 h rest'
      : `locked · use Layer ${PET_FORM.uses} times with it beside you (${Math.min(PET_FORM.uses, (P && P.layerUses) || 0)}/${PET_FORM.uses})` },
};
// the transformation: one in-game day (DAY.len) long, then 12 in-game hours to rest; in a fight there is a
// PET_FORM.chance each second that it happens
const PET_FORM = { uses: 100, chance: 0.05, dur: () => DAY.len, cd: () => DAY.len / 2, boost: 1.4, col: '#ff6a2a', glow: '255,110,50', mote: '#ffc07a' };
const PET_KEYS = Object.keys(PET_SKILLS);
// TWO PARTNERS: pr.pet (the hound) and pr.wolf (the Loyal Wolf, from the well quest, wellquest.js) are the same system
// and both walk with you. An actor says which it is in petKind; the wolf is the hound's sprite in winter colours, leaner
// and harder-biting.
// where each follows you, in steps of 22 px to your side (combat.js): the partner left, the hound right, the wolf and the drake further out
const PET_SLOT = { hero: -1.4, pet: 1.3, wolf: -3.4, drake: 2.9 }, PET_MAX = 3;
const PET_KINDS = ['pet', 'wolf', 'drake'], WOLF_FILTER = 'saturate(0.2) brightness(0.8) contrast(1.3) hue-rotate(190deg)';
const petWord = k => k === 'wolf' ? 'wolf' : k === 'drake' ? 'dog' : 'hound';
// EVOLUTION: the hound and wolf grow up with their level, stronger and bigger, with a glow in the world. (The golden dog has its own stages.)
const PET_EVO = [{ lv: 0, name: 'Loyal', mul: 1, scale: 1, glow: '' }, { lv: 30, name: 'Great', mul: 1.25, scale: 1.15, glow: 'drop-shadow(0 0 2px rgba(255,214,120,0.9))' }, { lv: 60, name: 'Dire', mul: 1.6, scale: 1.3, glow: 'drop-shadow(0 0 3px rgba(255,120,60,0.95))' }];
const petEvo = P => P.kind === 'drake' ? PET_EVO[0] : PET_EVO.reduce((e, s) => (P.lv >= s.lv ? s : e), PET_EVO[0]);
// THE GOLDEN DOG (pr.drake, its old name, kept for saves): a third partner that starts as an Old Bone at Season tier 5 (season.js). Rare crops bring it, not time:
// each adds to P.grown, three of them call a dog to the bone, and it grows through two more stages. What it eats shapes it (P.diet):
// ice crops more HP, fire crops more ATK, lightning and wind crops faster casting.
const DOG_GOLD = 'sepia(0.55) saturate(2) hue-rotate(-10deg) brightness(1.12)';   // the hound's own sprite, in gold
const DRAKE = { stages: [{ name: 'Old Bone', need: 0 }, { name: 'Pup', need: 3, scale: 0.85, h: 19, mul: 0.8, show: 2, glow: DOG_GOLD }, { name: 'Good Dog', need: 20, scale: 1.25, h: 19, mul: 1.2, show: 2.5, glow: DOG_GOLD }, { name: 'Great Dog', need: 60, scale: 1.7, h: 19, mul: 1.7, show: 3, glow: `${DOG_GOLD} drop-shadow(0 0 2px rgba(255,214,120,0.9))` }],
  food: { frostberry: ['ice', 1], emberroot: ['fire', 1], stormcorn: ['storm', 1], galeleaf: ['storm', 1], moonflower: ['ice', 3], dragonfruit: ['fire', 8] }, per: 0.02, casts: 0.01, minCast: 0.5 };
const drakeStage = P => DRAKE.stages.reduce((n, s, i) => ((P.grown || 0) >= s.need ? i : n), 0);
const drakeHatched = P => drakeStage(P) > 0;
const drakeDiet = (P, k) => (P.diet && P.diet[k]) || 0;
function giveDrakeEgg(game) {
  const pr = game.profile; if (pr.drake || !petRoom(game)) return; pr.drake = { lv: 1, xp: 0, pts: 1, sk: {}, card: null, grown: 0, diet: {} };
  game.toast('AN OLD BONE! Press N and bring rare crops to call a dog to it', '#ffd25a');
}
// F on the golden dog's page: the smallest rare crop you carry. False when there is nothing to do here (it can eat ordinary food)
function feedDrake(game) {
  const pr = game.profile, P = petOf(pr, 'drake'), was = drakeStage(P), last = DRAKE.stages.length - 1; if (was >= last) return false;
  const ids = Object.keys(DRAKE.food).filter(id => (pr.items || {})[id] > 0).sort((a, b) => DRAKE.food[a][1] - DRAKE.food[b][1]);
  if (!ids.length) { if (was) return false; game.toast('It needs rare crops: Moonflower, Dragonfruit, or the week\'s crop', '#ff8a8a'); return true; }
  const [id] = ids, [k, n] = DRAKE.food[id]; addItem(pr, id, -1); P.grown = (P.grown || 0) + n; P.diet = P.diet || {}; P.diet[k] = (P.diet[k] || 0) + n;
  const now = drakeStage(P), w = game.world, S = DRAKE.stages[now];
  if (now > was) { game.toast(was ? `Your dog has grown: ${S.name}!` : 'A dog comes for the bone! A Pup joins you', '#ffd25a'); respawnDog(game, 'drake'); const d = petActor(w, 'drake'); if (d) w.rings.push({ x: d.x, y: d.y, r: 40, t: 0, col: '#ffd25a' }, { x: d.x, y: d.y, r: 24, t: -120, col: '#ffffff' }); }
  else game.toast(`Fed it ${ITEMS[id].name} · ${P.grown} / ${DRAKE.stages[now + 1].need} to ${DRAKE.stages[now + 1].name}`, '#ffd27a');
  game.save(); return true;
}
// the Old Bone: the game's own bone icon; s = 1 is 28 px tall
const drawDrakeEgg = (cx, cy, s) => iconCentered('items', ITEM2_BASE + M.bone, cx, cy, 28 * s);
const petsOf = pr => PET_KINDS.filter(k => pr && pr[k]);
const petActor = (w, k) => w && w.actors.find(a => a.pet && !a.dead && !a.netOf && (a.petKind || 'pet') === k);   // (not a co-op friend's: netpets.js)
const petMendPct = l => 2 + l;   // Quick Mend: 3% of its HP a second at level 1 … 7% at 5
const petHealPct = l => 3 + l * 3, petHealSec = l => 11 - l;   // Healing Lick: 6% every 10 s … 18% every 6 s
const petXpNeed = lv => 12 + lv * 10;
function petOf(pr, kind = 'pet') {
  if (!pr || !pr[kind]) return null;   // (no profile yet on the title screen)
  const P = pr[kind]; P.kind = kind; P.sk = P.sk || {}; for (const k of PET_KEYS) P.sk[k] = P.sk[k] || 0;
  if (P.hunger == null) P.hunger = 100;
  return P;
}
function adoptPet(game) {
  const pr = game.profile;
  if (!pr.pet) { if (!petRoom(game)) return; pr.pet = { lv: 1, xp: 0, pts: 1, sk: {}, card: null }; }
  petOf(pr); spawnDog(game.world, game.world && game.world.player);
  game.toast(pr.grandpa ? 'Grandpa brings your dog back! Press N to give it a card and train it' : 'A loyal hound joins you! Press N to give it a card and train it', '#ffd27a');
  if (typeof tipEvent === 'function') tipEvent(game, 'dogpartner');
  game.save();
}
// the dog's stats from its level and skills
function petStats(P) {
  const lv = P.lv, sk = P.sk;
  const W = P.kind === 'wolf', Dr = P.kind === 'drake', St = Dr ? DRAKE.stages[drakeStage(P)] : null, m = St && St.mul || petEvo(P).mul;
  return { hp: Math.round((120 + lv * 28) * (1 + sk.coat * 0.15) * (W ? 0.8 : 1) * m * (1 + (Dr ? drakeDiet(P, 'ice') * DRAKE.per : 0))), atk: (5 + lv * 1.3) * (1 + sk.fangs * 0.12) * (W ? 1.35 : 1) * m * (1 + (Dr ? drakeDiet(P, 'fire') * DRAKE.per : 0)), def: lv * 0.8, guard: Math.min(0.8, sk.coat * 0.05 + sk.hide * 0.06),
    opener: sk.opener * 0.18, focus: (1 - sk.focus * 0.12) * (Dr ? Math.max(DRAKE.minCast, 1 - drakeDiet(P, 'storm') * DRAKE.casts) : 1) };
}
// the dog's sprite has only idle and walk: its bite and its tumble reuse those frames (memoised on the bank)
function fullAnims(bank) {
  if (bank._full) return bank._full;
  const A = bank.anims;
  return (bank._full = { ...A, attack: A.attack || A.walk, hurt: A.hurt || A.idle, die: A.die || A.idle, knock: A.knock || A.idle });
}
function spawnDog(world, owner, kind) {
  if (!kind) { let out = null; for (const k of PET_KINDS) out = spawnDog(world, owner, k) || out; return spawnPartner(world, owner) || out; }   // every partner you have
  const pr = window.GAME && GAME.profile, P = pr && petOf(pr, kind), wolf = kind === 'wolf';
  if (!world || !owner || !P || P.dead || !D.npcs['100'] || GAME.scene === 'arena' || (kind === 'drake' && !drakeHatched(P))) return null;
  if (world.actors.some(a => a.pet && a.owner === owner && !a.dead && (a.petKind || 'pet') === kind)) return null;
  const S = petStats(P), card = P.card && pr.cards.find(c => c.uid === P.card), St = kind === 'drake' ? DRAKE.stages[drakeStage(P)] : null;
  const a = baseActor('monster', owner.team, owner.x + (St ? 30 : wolf ? 18 : -18), owner.y + 6);
  Object.assign(a, {
    sp: DOG_SP, evoGlow: St ? St.glow : petEvo(P).glow, tier: Math.min(9, Math.floor(P.lv / 5)), plist: [], passives: {}, pet: S, petLv: P.lv, petKind: kind, wolf,
    maxHp: S.hp, atk: S.atk, def: S.def, crit: 5, spd: St ? 90 : wolf ? 86 : 78, h: St ? St.h : D.npcs['100'].h || 19, heavy: false, pal: 0, scale: St ? St.scale : (wolf ? 1.3 : 1.15) * petEvo(P).scale,
    ai: { mode: 'wander', t: 0, tx: owner.x, ty: owner.y, cast: rand(2000, 4000) },
    spell: card && !card.fusion ? cardSpell(card) : null,
    ally: true, owner, slot: PET_SLOT[kind] ?? 1.2, home: { x: owner.x, y: owner.y },   // (each its own spot beside you: PET_SLOT)
  });
  a.hp = a.maxHp;
  if (P.formT > 0) applyPetForm(a, P, owner);
  world.actors.push(a);
  return a;
}
// ---- the transformation
const petFormSp = P => { const pr = GAME.profile, c = P.card && pr.cards.find(x => x.uid === P.card); return c && !c.fusion && charBank(c.sp) ? c.sp : null; };
function applyPetForm(d, P, owner) {
  const sp = petFormSp(P); if (!sp) return false;
  const bank = charBank(sp), hp = d.hp / d.maxHp;
  Object.assign(d, { sp, bank: null, form: true, h: bank.h > 48 ? 34 : bank.h || 26, scale: 1, pal: 0,
    maxHp: Math.round(owner.maxHp || d.maxHp), atk: owner.atk || d.atk, def: owner.def || d.def, spd: Math.max(d.spd, owner.spd || 0), crit: owner.crit || 5 });
  d.hp = Math.max(1, d.maxHp * hp);
  return true;
}
function petTransform(game, w, d, P) {
  if (!applyPetForm(d, P, w.player)) return;
  P.formT = PET_FORM.dur(); d.howlT = 1500;
  world_flashForm(w, d);
  game.toast(`Your ${petWord(P.kind)} TRANSFORMS into ${SPECIES[d.sp] ? SPECIES[d.sp].name : 'its card'}! Beast Soul for one day`, PET_FORM.col); game.save();
}
function world_flashForm(w, d) {
  w.rings.push({ x: d.x, y: d.y, r: 44, t: 0, col: PET_FORM.col }, { x: d.x, y: d.y, r: 26, t: -120, col: '#ffffff' });
  for (let i = 0; i < 18; i++) { const an = i / 18 * Math.PI * 2; w.particles.push({ x: d.x, y: d.y - 12, vx: Math.cos(an) * 140, vy: Math.sin(an) * 90, t: 0, life: 520, col: i % 2 ? PET_FORM.col : PET_FORM.mote, size: 2, streak: true, drag: 0.92 }); }
  w.spellName = { str: 'BEAST SOUL — YOUR PARTNER TRANSFORMS', col: PET_FORM.mote, t: 1800, team: d.team, big: true };
}
function petRevert(game, w, P) {
  P.formT = 0; P.formCd = PET_FORM.cd();
  const d = petActor(w, P.kind);
  if (d) { w.rings.push({ x: d.x, y: d.y, r: 24, t: 0, col: PET_FORM.mote }); respawnDog(game, P.kind); }
  game.toast(`Your ${petWord(P.kind)} returns to its own shape — it needs 12 hours before it can transform again`, '#ffd27a'); game.save();
}
// a monster fell while the dog was out: it learns from the fight
function petKill(game, w, m) { for (const k of petsOf(game.profile)) petKillOne(game, w, m, k); partnerKill(game, w); }
function petKillOne(game, w, m, kind) {
  const pr = game.profile, P = petOf(pr, kind), d = petActor(w, kind); if (!P || !d) return;
  P.xp += 1 + m.tier;
  let up = false; const evo = petEvo(P);
  while (P.xp >= petXpNeed(P.lv) && P.lv < 99) { P.xp -= petXpNeed(P.lv); P.lv++; P.pts++; up = true; }
  if (up) {
    game.toast(`Your ${petWord(kind)} reached Lv ${P.lv}! +1 partner point — press N`, '#ffd27a');
    if (petEvo(P) !== evo) { const was = d; game.toast(`Your ${petWord(kind)} EVOLVED: ${petEvo(P).name} ${petWord(kind)}! Stronger and bigger`, '#ffd25a'); respawnDog(game, kind); const n = petActor(w, kind) || was; w.rings.push({ x: n.x, y: n.y, r: 40, t: 0, col: '#ffd25a' }, { x: n.x, y: n.y, r: 24, t: -120, col: '#ffffff' }); return; }
    { const hp = d.hp / d.maxHp, S = petStats(P); Object.assign(d, { pet: S, petLv: P.lv, maxHp: S.hp, atk: S.atk, def: S.def }); d.hp = d.maxHp * hp; w.rings.push({ x: d.x, y: d.y, r: 18, t: 0, col: '#ffd27a' }); }
  }
}
// rebuild the dog (after its card or skills change)
function respawnDog(game, kind = 'pet') {
  const w = game.world; if (!w || !w.player) return;
  const mine = a => a.pet && a.owner === w.player && (a.petKind || 'pet') === kind, old = w.actors.find(mine);
  const at = old && !old.dead ? { x: old.x, y: old.y } : null;
  w.actors = w.actors.filter(a => !mine(a));
  w.respawns = (w.respawns || []).filter(r => !r.pet);
  const d = spawnDog(w, w.player, kind); if (d && at) { d.x = at.x; d.y = at.y; }
}

// ---- the dog's FOOD BAG (P.bowl): food you set aside for it. While it holds food the dog's HP never drops below 1%:
// every hit that would take it lower eats 1 food (the cheapest) and leaves it at 1%.
const PET_BOWL_MAX = 99;
const isDogFood = id => ITEMS[id] && ['crop', 'food', 'meal'].includes(ITEMS[id].kind);
const bowlCount = P => Object.values(P.bowl || {}).reduce((s, n) => s + n, 0);
function petBowlGuard(world, d) {
  const P = window.GAME && petOf(GAME.profile, d.petKind), floor = Math.ceil(d.maxHp * 0.01);
  if (!P || d.hp >= floor || !bowlCount(P)) return;
  const id = Object.keys(P.bowl).filter(k => P.bowl[k] > 0).sort((a, b) => ITEMS[a].sell - ITEMS[b].sell)[0];
  if (--P.bowl[id] <= 0) delete P.bowl[id];
  d.hp = floor;
  floatText(world, d.x, d.y - 40, `−1 ${ITEMS[id].name}`, '#ffb040', 7);
  if (!bowlCount(P)) GAME.toast(`Your ${petWord(P.kind)} ate the last of its food bag — refill it (N ▸ FOOD)`, '#ff9a8a');
}
// FOOD tab rows: the bag itself (Enter: take it all back), then every food you carry (Enter: put 1 in, X: the stack)
function bowlRows(pr) { return Object.keys(ITEMS).filter(id => isDogFood(id) && (pr.items || {})[id] > 0); }
function updateBowlTab(game, m, P) {
  const pr = game.profile, ids = bowlRows(pr), id = ids[m.cur - 1];
  P.bowl = P.bowl || {};
  if (m.cur === 0) {   // take everything back out
    let n = 0; for (const k of Object.keys(P.bowl)) { addItem(pr, k, P.bowl[k]); n += P.bowl[k]; } P.bowl = {};
    game.toast(n ? `Took ${n} food back from your ${petWord(P.kind)}'s bag` : 'Its food bag is empty', '#ffd27a'); game.save(); return;
  }
  if (!id) return;
  const room = PET_BOWL_MAX - bowlCount(P);
  if (room <= 0) { game.toast(`The food bag is full (${PET_BOWL_MAX})`, '#ff8a8a'); return; }
  const k = Math.min(room, m.stack ? pr.items[id] : 1);
  addItem(pr, id, -k); P.bowl[id] = (P.bowl[id] || 0) + k;
  game.toast(`${k} × ${ITEMS[id].name} → your ${petWord(P.kind)}'s food bag (${bowlCount(P)})`, '#ffd27a'); game.save();
}
function bowlTabRows(pr, P) {
  const n = bowlCount(P);
  return [{ icon: homeIcon(14), name: `FOOD BAG  ·  ${n}/${PET_BOWL_MAX}`, sub: n ? 'Keeps it at 1% HP: each hit after that eats 1 food' : 'Empty — put food in so your hound cannot fall',
      right: n ? 'TAKE ALL' : '—', rightCol: n ? '#ffd27a' : '#9a917c' },
    ...bowlRows(pr).map(id => ({ icon: itemIcon(id), name: ITEMS[id].name, sub: `in your bag ×${pr.items[id]} · in its bag ×${(P.bowl || {})[id] || 0}`, right: '+1', rightCol: '#8fffb0' }))];
}

// ---- the PARTNER screen (N): the inventory's iron frame with two slate pages. Left: the partner on a lit pedestal, how it
// is doing (a mood line), HP / hunger / XP bars, its stats, the skill points to spend and a big FEED button. Right: three
// tabs — SKILLS (a 3×3 grid of tiles and one panel saying what the chosen skill does, with LEARN), CARD and FOOD BAG.
function petMenu(kind) { return { type: 'pet', cur: 0, scroll: 0, tab: 0, kind: kind || petsOf(GAME.profile)[0] || 'pet' }; }
// its card list, in the order the SORT button chose (pr.petSort: 0 rank high to low, 1 rank low to high, 2 name A to Z)
const PET_SORTS = ['RANK ▼', 'RANK ▲', 'NAME A–Z'];
const petCards = pr => { const L = pr.cards.filter(c => !c.fusion), k = pr.petSort || 0;
  return L.sort(k === 2 ? (a, b) => cardName(a).localeCompare(cardName(b)) || b.tier - a.tier : k === 1 ? (a, b) => a.tier - b.tier || cardSpell(a).power - cardSpell(b).power : (a, b) => b.tier - a.tier || cardSpell(b).power - cardSpell(a).power); };
const PU = { x: 26, y: 42, w: 588, h: 298 }, PU_L = { x: 36, y: 50, w: 206, h: 282 }, PU_R = { x: 250, y: 50, w: 354, h: 282 };
const PU_TABS = [{ col: '#ff9ab8' }, { col: '#9fd8ff' }, { col: '#ffc07a' }];
const PU_TAB = i => ({ x: PU_R.x + 4 + i * 92, y: PU.y - 19, w: 88, h: 19 });
const PU_FEED = { x: PU_L.x + 12, y: PU_L.y + 232, w: PU_L.w - 24, h: 22 };
const PET_SK_ICON = { mend: ['❤', '#ff6a8a'], heal: ['✚', '#5ad88a'], opener: ['⚡', '#ffd23f'], focus: ['◎', '#8fd0ff'], fangs: ['⚔', '#ff8a8a'], coat: ['♥', '#ff9ab8'], hide: ['⛨', '#b8c8ff'], light: ['🍖', '#ffc07a'], transform: ['✪', '#ff6a2a'] };
const PU_SWAP = { x: PU_L.x + 84, y: 23, w: 74, h: 15 };
const PU_ROWH = 26, PU_VIS = { 0: 9, 1: 9, 2: 10 };
const PU_SORT = { x: PU_R.x + PU_R.w - 92, y: PU_R.y + 6 + 9 * PU_ROWH + 1, w: 86, h: 17 };   // the card tab's SORT button, under its 9 rows
const puRow = (m, i) => ({ x: PU_R.x + 6, y: PU_R.y + 6 + (i - m.scroll) * PU_ROWH, w: PU_R.w - 12, h: PU_ROWH - 2 });
const PU_TILE = i => ({ x: PU_R.x + 10 + (i % 3) * 113, y: PU_R.y + 10 + Math.floor(i / 3) * 62, w: 107, h: 56 });
const PU_DETAIL = { x: PU_R.x + 10, y: PU_R.y + 196, w: PU_R.w - 20, h: 76 };
const PU_LEARN = { x: PU_DETAIL.x + PU_DETAIL.w - 72, y: PU_DETAIL.y + PU_DETAIL.h - 28, w: 64, h: 20 };
const puCount = (pr, P, tab) => tab === 0 ? PET_KEYS.length : tab === 1 ? petCards(pr).length + 1 : bowlRows(pr).length + 1;
function learnPetSkill(game, P, key) {
  const S = PET_SKILLS[key];
  if (P.dead) { game.toast(`Revive your ${petWord(P.kind)} first (${PET_REVIVE_FOOD} food)`, '#ff8a8a'); return; }
  if (P.sk[key] >= S.max) { game.toast(`${S.name} is already maxed`, '#c9c1a8'); return; }
  if (key === 'transform' && (P.layerUses || 0) < PET_FORM.uses) { game.toast(`Transformation is locked — use your Layer with your ${petWord(P.kind)} beside you ${PET_FORM.uses} times (${P.layerUses || 0}/${PET_FORM.uses})`, '#ff8a8a'); return; }
  if (P.pts <= 0) { game.toast(`No skill points — your ${petWord(P.kind)} earns one each time it levels up (monsters falling near it)`, '#ff8a8a'); return; }
  P.pts--; P.sk[key]++; game.toast(`${S.name} → Lv ${P.sk[key]} · ${S.desc(P.sk[key], P)}`, '#ffd27a');
  game.save(); respawnDog(game, P.kind);
}
function petAct(game, m, P) {
  const pr = game.profile;
  if (m.tab === 0) learnPetSkill(game, P, PET_KEYS[m.cur]);
  else if (m.tab === 1) {
    if (P.dead) { game.toast(`Revive your ${petWord(P.kind)} first (${PET_REVIVE_FOOD} food)`, '#ff8a8a'); return; }
    const c = m.cur === 0 ? null : petCards(pr)[m.cur - 1];
    P.card = c ? c.uid : null;
    game.toast(c ? `Your ${petWord(P.kind)} will cast ${cardSpell(c).name}` : `Your ${petWord(P.kind)} fights with bites only`, '#ffd27a');
    game.save(); respawnDog(game, P.kind);
  } else updateBowlTab(game, m, P);
}
function updatePetMenu(game, m) {
  const pr = game.profile, P = petOf(pr, m.kind), both = petsOf(pr);
  if (!P) { game.closeMenu(); return; }
  const k = navInput();
  if (k.back || hit('KeyN')) { game.closeMenu(); return; }
  if (both.length > 1 && (hit('Tab') || clicked(PU_SWAP.x, PU_SWAP.y, PU_SWAP.w, PU_SWAP.h))) { m.kind = both[(both.indexOf(m.kind) + 1) % both.length]; m.cur = 0; m.scroll = 0; return; }
  if (hit('KeyT') || clicked(PU_THEME.x, PU_THEME.y, PU_THEME.w, PU_THEME.h)) { cyclePetTheme(game, P); return; }
  if (hit('KeyL')) {   // let it go: press L twice
    if (!m.letGo) { m.letGo = performance.now(); game.toast(`Press L again to let your ${petWord(m.kind)} go for good`, '#ff9a7a'); return; }
    m.letGo = 0; releasePet(game, m.kind); return;
  }
  if (m.letGo && performance.now() - m.letGo > 3000) m.letGo = 0;
  const tabTo = t => { m.tab = t; m.cur = 0; m.scroll = 0; };
  PU_TABS.forEach((_, i) => { const B = PU_TAB(i); if (clicked(B.x, B.y, B.w, B.h)) tabTo(i); });
  const n = puCount(pr, P, m.tab);
  if (m.tab === 0) {   // the grid: the arrows walk the tiles, and off either side to the next tab
    const col = m.cur % 3;
    if (k.l) { if (col) m.cur--; else tabTo(2); } else if (k.r) { if (col < 2) m.cur++; else tabTo(1); }
    else if (k.u && m.cur >= 3) m.cur -= 3; else if (k.d && m.cur < 6) m.cur += 3;
  } else {
    if (k.l) tabTo((m.tab + 2) % 3); if (k.r) tabTo((m.tab + 1) % 3);
    if (k.u) m.cur = Math.max(0, m.cur - 1); if (k.d) m.cur = Math.min(n - 1, m.cur + 1);
  }
  const count = puCount(pr, P, m.tab);
  if (m.tab === 1 && (hit('KeyO') || clicked(PU_SORT.x, PU_SORT.y, PU_SORT.w, PU_SORT.h))) { pr.petSort = ((pr.petSort || 0) + 1) % PET_SORTS.length; m.cur = 0; m.scroll = 0; game.save(); return; }
  // the mouse wheel scrolls the list (2026-11-20, the user: "only 10 card shows up"): the chosen row follows into view
  if (m.tab !== 0 && mouse.wheel) { m.scroll = clamp(m.scroll + Math.sign(mouse.wheel) * 3, 0, Math.max(0, count - PU_VIS[m.tab])); mouse.wheel = 0;
    m.cur = clamp(m.cur, m.scroll, m.scroll + PU_VIS[m.tab] - 1); }
  m.cur = clamp(m.cur, 0, Math.max(0, count - 1));
  if (m.cur < m.scroll) m.scroll = m.cur; if (m.cur >= m.scroll + PU_VIS[m.tab]) m.scroll = m.cur - PU_VIS[m.tab] + 1;
  // feed / revive: the big button or F
  if (hit('KeyF') || clicked(PU_FEED.x, PU_FEED.y, PU_FEED.w, PU_FEED.h)) { if (P.dead) revivePet(game, m.kind); else if (!(m.kind === 'drake' && feedDrake(game))) { feedPet(game, false, m.kind); game.save(); } return; }
  m.stack = hit('KeyX');
  if (m.tab === 0) {   // a click on a tile only chooses it: a point is spent with LEARN or Enter
    for (let i = 0; i < PET_KEYS.length; i++) { const R = PU_TILE(i); if (clicked(R.x, R.y, R.w, R.h)) { m.cur = i; return; } }
    if (clicked(PU_LEARN.x, PU_LEARN.y, PU_LEARN.w, PU_LEARN.h)) { petAct(game, m, P); return; }
  } else for (let i = m.scroll; i < Math.min(count, m.scroll + PU_VIS[m.tab]); i++) {
    const R = puRow(m, i);
    if (clicked(R.x, R.y, R.w, R.h)) { m.cur = i; petAct(game, m, P); return; }
  }
  if (k.ok || (m.tab === 2 && m.stack)) petAct(game, m, P);
}
// little drawing helpers
function pawPrint(x, y, s, fill, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.7;
  const dot = (dx, dy, r) => { ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, r * s, r * s * 1.1, 0, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); };
  dot(0, 1.2, 1.5); dot(-1.6, -0.9, 0.7); dot(-0.55, -1.7, 0.7); dot(0.55, -1.7, 0.7); dot(1.6, -0.9, 0.7);
}
// plain crisp text in the true colour (ink() lifts dark colours; the page wants them exact)
const petInk = (str, x, y, col = '#f0e6d2', size = 9, align = 'left', bold = true) => drawPix(pixText(String(str), fontPx(size), bold ? 700 : 400, [col, col, col], null), x, y, align);
const puHover = R => mouse.x >= R.x && mouse.x < R.x + R.w && mouse.y >= R.y && mouse.y < R.y + R.h;
function puBar(x, y, w, k, col, icon, label) {
  text(icon, x + 5, y + 5, col, 9);
  const bx = x + 14, bw = w - 14, h = 11; ctx.fillStyle = '#160f09'; rrect(ctx, bx, y, bw, h, 3); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, shadeOf(col));
  ctx.fillStyle = g; if (k > 0) { rrect(ctx, bx + 1, y + 1, Math.max(5, (bw - 2) * Math.min(1, k)), h - 2, 2.2); ctx.fill(); }
  ctx.strokeStyle = '#5a6478'; ctx.lineWidth = 1; rrect(ctx, bx + 0.5, y + 0.5, bw - 1, h - 1, 3); ctx.stroke();
  drawPix(pixText(label, fontPx(7.5), 700, ['#ffffff', '#ffffff', '#ffffff'], '#14100c'), bx + bw / 2, y + h / 2 + 0.2, 'center');
}
// a skill's round socket: dark, ringed in its colour, lit when it has been learned
function puSocket(x, y, r, ic, col, lit, locked) {
  ctx.fillStyle = '#160f09'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (lit) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(col, 0.5)); g.addColorStop(1, hexA(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = locked ? '#5a6478' : lit ? col : hexA(col, 0.45); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r - 0.6, 0, Math.PI * 2); ctx.stroke();
  text(locked ? '🔒' : ic, x, y + 0.5, locked ? '#9aa4b8' : col, r * 0.95);
}
// THE PAGE'S THEME: each partner keeps its own (P.theme), cycled with T or the pill above the page. A theme tints the
// iron plate and the slate pages; the gold, the steel rim and the text stay as they are, so every theme reads the same.
const PET_THEMES = [
  { name: 'Cozy', col: '#c8688a' }, { name: 'Forest', col: '#4a9a58' }, { name: 'Ocean', col: '#3a8ac8' }, { name: 'Lavender', col: '#9a78d8' },
  { name: 'Sunset', col: '#d8843a' }, { name: 'Midnight', col: '#2a3060' }, { name: 'Ice Blue', col: '#58b8e8' }, { name: 'Neon', col: '#1a50e0' }, { name: 'Crimson', col: '#c8102e' },
];
const PU_THEME = { x: PU_L.x, y: 23, w: 80, h: 15 };
const petTheme = P => PET_THEMES[(P.theme || 0) % PET_THEMES.length];
const puShades = T => T.sh || (T.sh = { plate: [mixCol('#442d1d', T.col, 0.24), mixCol('#22160e', T.col, 0.1)], page: [mixCol('#3d281a', T.col, 0.18), mixCol('#251810', T.col, 0.07)] });
function cyclePetTheme(game, P) { P.theme = ((P.theme || 0) + 1) % PET_THEMES.length; game.save(); }
function drawPetMenu(game, m, now) {
  if (!petOf(game.profile, m.kind)) return;
  ctx.fillStyle = 'rgba(8,6,14,0.74)'; ctx.fillRect(0, 0, VW, VH);
  drawPetPage(game, m, now);
}
// the partner stands on the pedestal: monsterPreview centres a sprite in its box, so the box is placed to put the feet at y
const PU_FEET = 3;
function puStand(sp, cx, y, now, max = 3) {
  const bank = sp.frames ? sp : charBank(sp), rec = bank && bank.frames[seqFrame(bank.anims.idle[2], now, true)[0]]; if (!rec) return;
  const W = Math.max(68, rec[2] * Math.min(max, 1)), H = Math.max(66, rec[3] * Math.min(max, 1));
  monsterPreview(sp, cx - W / 2, y - H / 2 - rec[3] * Math.min(max, W / rec[2], H / rec[3]) / 2, W, H, 0, now, 'idle', max);
}
function drawPetPage(game, m, now) {
  const pr = game.profile, P = petOf(pr, m.kind); if (!P) return;
  const S = petStats(P), card = P.card && pr.cards.find(c => c.uid === P.card), w = game.world, d = petActor(w, m.kind), T = petTheme(P), sh = puShades(T);
  const Dr = m.kind === 'drake', St = Dr ? drakeStage(P) : 0, Sn = DRAKE.stages[St], egg = Dr && !St, both = petsOf(pr), nxt = both[(both.indexOf(m.kind) + 1) % both.length];
  goldTitle(Dr ? 'MY DOG' : m.kind === 'wolf' ? `${petEvo(P).name.toUpperCase()} WOLF` : 'MY PARTNER', VW / 2, 12, 15, now);
  popupButton({ ...PU_THEME, label: `T: ${T.name}`, col: T.col }, now);
  ctx.fillStyle = T.col; ctx.fillRect(PU_THEME.x + 6, PU_THEME.y + PU_THEME.h - 3, PU_THEME.w - 12, 1.2);
  if (petsOf(pr).length > 1) popupButton({ ...PU_SWAP, label: `Tab: ${petWord(nxt)}`, col: '#9fd8ff' }, now);
  // the tabs stand up from behind the frame, like the inventory's
  PU_TABS.forEach((t, i) => {
    const B = PU_TAB(i), on = m.tab === i, tl = i === 2 ? `FOOD BAG (${bowlCount(P)})` : i === 1 ? 'CARD' : 'SKILLS', ty = PU.y - (on ? 19 : 15);
    ctx.save(); ctx.shadowColor = on ? hexA(t.col, 0.7) : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = (on ? 6 : 3) * RES;
    const tg = ctx.createLinearGradient(0, ty, 0, ty + 22); tg.addColorStop(0, on ? '#4a5670' : '#422c1c'); tg.addColorStop(1, on ? '#3a2618' : '#24180f');
    ctx.fillStyle = tg; rrect(ctx, B.x, ty, B.w, 24, 4); ctx.fill(); ctx.restore();
    ctx.fillStyle = on ? t.col : mixCol(t.col, '#000000', 0.45); ctx.fillRect(B.x + 3, ty + 2, B.w - 6, on ? 2.4 : 1.6);
    ctx.strokeStyle = on ? '#ffd860' : '#5a6478'; ctx.lineWidth = on ? 1.2 : 0.9; rrect(ctx, B.x + 0.5, ty + 0.5, B.w - 1, 23, 4); ctx.stroke();
    text(tl, B.x + B.w / 2, ty + 10, on ? '#ffffff' : '#9aa4b8', 8);
  });
  drawIronFrame(PU, sh.plate[0], sh.plate[1]);
  drawSlatePage(PU_L, sh.page[0], sh.page[1]); drawSlatePage(PU_R, sh.page[0], sh.page[1]);
  const hg = ctx.createLinearGradient(242, 0, 250, 0); hg.addColorStop(0, '#563924'); hg.addColorStop(0.5, '#9aa4b8'); hg.addColorStop(1, '#563924');
  ctx.fillStyle = hg; ctx.fillRect(243, PU_L.y + 2, 6, PU_L.h - 4);
  for (let y = PU_L.y + 14; y < PU_L.y + PU_L.h; y += 40) { ctx.fillStyle = '#2c1d12'; ctx.beginPath(); ctx.arc(246, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
  // ---- left page: the partner on a lit pedestal
  const A = { x: PU_L.x + 8, y: PU_L.y + 8, w: PU_L.w - 16, h: 98 }, cx = PU_L.x + PU_L.w / 2, floor = A.y + 84;
  ctx.save(); rrect(ctx, A.x, A.y, A.w, A.h, 5); ctx.clip();
  const ag = ctx.createRadialGradient(cx, A.y + 52, 6, cx, A.y + 52, 104); ag.addColorStop(0, mixCol(T.col, '#422c1c', 0.45)); ag.addColorStop(1, '#0a0c12');
  ctx.fillStyle = ag; ctx.fillRect(A.x, A.y, A.w, A.h);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {   // motes rising past it
    const k = (now / (3600 + (i % 4) * 700) + i * 0.37) % 1; ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7; ctx.fillStyle = i % 2 ? '#ffd27a' : T.col;
    ctx.fillRect(A.x + 8 + (i * 47) % (A.w - 16), floor - k * 80, 1.4, 1.4);
  }
  if (P.formT > 0) { ctx.globalAlpha = 1; const fg = ctx.createRadialGradient(cx, floor - 30, 4, cx, floor - 30, 56); fg.addColorStop(0, `rgba(${PET_FORM.glow},0.6)`); fg.addColorStop(1, `rgba(${PET_FORM.glow},0)`); ctx.fillStyle = fg; ctx.fillRect(A.x, A.y, A.w, A.h); }
  ctx.restore();
  const pg = ctx.createLinearGradient(0, floor - 9, 0, floor + 9); pg.addColorStop(0, '#5a6478'); pg.addColorStop(1, '#2c1d12');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(cx, floor, 50, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = goldFrameGrad(floor - 9, 18); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, floor, 50, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.4; rrect(ctx, A.x + 0.7, A.y + 0.7, A.w - 1.4, A.h - 1.4, 5); ctx.stroke();
  ctx.save(); ctx.filter = P.dead ? 'grayscale(1) brightness(0.75)' : m.kind === 'wolf' ? WOLF_FILTER : Dr && !egg ? Sn.glow : 'none';
  if (egg) drawDrakeEgg(cx, floor - 16 + Math.sin(now / 500), 1.6); else puStand(d && d.form ? d.sp : DOG_SP, cx, floor + PU_FEET, now, Dr && !(d && d.form) ? Sn.show : 3); ctx.restore();
  // the level, on a gold-rimmed plate in the corner
  ctx.fillStyle = 'rgba(22,15,9,0.9)'; rrect(ctx, A.x + 5, A.y + 5, 42, 16, 4); ctx.fill();
  ctx.strokeStyle = goldFrameGrad(A.y + 5, 16); ctx.lineWidth = 1; rrect(ctx, A.x + 5.5, A.y + 5.5, 41, 15, 4); ctx.stroke();
  text(`Lv ${P.lv}`, A.x + 26, A.y + 13.4, '#ffe9a8', 8.5);
  goldTitle(Dr ? Sn.name.toUpperCase() : `${petEvo(P).name} ${petWord(m.kind)}`.toUpperCase(), cx, PU_L.y + 116, 11, now);
  // the mood line: what is going on with it right now
  const hp = d ? d.hp / d.maxHp : P.dead ? 0 : 1;
  const mood = egg ? ['Waiting. Bring rare crops and a dog may come', '#ffd27a'] : P.dead ? ['😢 It has fallen — revive it below', '#ff8a8a'] : P.formT > 0 ? [`🔥 TRANSFORMED! ${Math.ceil(P.formT / 60000)} min left`, '#ffa060']
    : P.hunger <= 0 ? ['😣 Starving! It is losing HP', '#ff8a8a'] : P.hunger < 30 ? ['🥺 Hungry — feed it!', '#ffb060'] : hp < 0.4 ? ['🤕 Hurt — keep it fed', '#ffb060']
    : P.formCd > 0 ? [`😴 Resting after its transformation (${Math.ceil(P.formCd / 60000)} min)`, '#b8a8e8'] : ['😊 Happy and ready to fight!', '#8fffb0'];
  petInk(mood[0], cx, PU_L.y + 128, mood[1], 7.5, 'center');
  // bars
  const bx = PU_L.x + 12, bw = PU_L.w - 24;
  puBar(bx, PU_L.y + 137, bw, hp, '#ff5a6a', '♥', d ? `${Math.ceil(d.hp)} / ${d.maxHp} HP` : P.dead ? 'fallen' : `${S.hp} HP`);
  puBar(bx, PU_L.y + 151, bw, P.hunger / 100, P.hunger < 30 ? '#ff7a3a' : '#f0a020', '🍖', `hunger ${Math.round(P.hunger)} / 100`);
  puBar(bx, PU_L.y + 165, bw, P.xp / petXpNeed(P.lv), '#4aa8f0', '★', `XP ${P.xp} / ${petXpNeed(P.lv)}`);
  // its numbers, on three small chips
  [['⚔', S.atk.toFixed(1), '#ff9a8a'], ['⛨', S.def.toFixed(1), '#b8c8ff'], ['🍱', `${bowlCount(P)}/${PET_BOWL_MAX}`, '#ffc07a']].forEach(([ic, v, col], i) => {
    const x = bx + i * 62; ctx.fillStyle = 'rgba(22,15,9,0.7)'; rrect(ctx, x, PU_L.y + 181, 58, 15, 3); ctx.fill();
    text(ic, x + 10, PU_L.y + 188.5, col, 8); petInk(v, x + 34, PU_L.y + 188.5, '#f0e6d2', 7.5, 'center');
  });
  // points to spend
  const pts = P.pts > 0, Q = { x: bx, y: PU_L.y + 201, w: bw, h: 26 };
  ctx.fillStyle = pts ? 'rgba(90,60,10,0.55)' : 'rgba(22,15,9,0.55)'; rrect(ctx, Q.x, Q.y, Q.w, Q.h, 4); ctx.fill();
  ctx.strokeStyle = pts ? goldFrameGrad(Q.y, Q.h) : '#563924'; ctx.lineWidth = 1; rrect(ctx, Q.x + 0.5, Q.y + 0.5, Q.w - 1, Q.h - 1, 4); ctx.stroke();
  if (pts) { goldTitle(`${P.pts} SKILL POINT${P.pts === 1 ? '' : 'S'} TO SPEND`, cx, Q.y + 9, 8.5, now); petInk('Pick a skill and press LEARN', cx, Q.y + 19, '#f0e6d2', 7, 'center', false); }
  else { petInk('No skill points right now', cx, Q.y + 9, '#c8d0e0', 8, 'center'); petInk('It earns one each level', cx, Q.y + 19, '#9aa4b8', 7, 'center', false); }
  // the big feed / revive button
  const canRevive = edibleCount(pr) >= PET_REVIVE_FOOD, growing = Dr && St < DRAKE.stages.length - 1 && Object.keys(DRAKE.food).some(id => (pr.items || {})[id] > 0);
  popupButton({ ...PU_FEED, label: P.dead ? `REVIVE (${PET_REVIVE_FOOD} food · have ${edibleCount(pr)}) [F]` : growing ? 'FEED A RARE CROP [F]' : P.hunger >= 100 ? 'FULL: no snack needed [F]' : 'FEED A SNACK [F]', primary: P.dead ? canRevive : growing || P.hunger < 100, col: '#ffc07a' }, now);
  petInk(card ? `casts ${cardSpell(card).name}` : 'no card: it just bites', cx, PU_L.y + 258, '#c8d0e0', 7.5, 'center');
  if (Dr) petInk(St < DRAKE.stages.length - 1 ? `${P.grown || 0} / ${DRAKE.stages[St + 1].need} to ${DRAKE.stages[St + 1].name}` : `Fully grown · HP +${drakeDiet(P, 'ice') * 2}% · ATK +${drakeDiet(P, 'fire') * 2}%`, cx, PU_L.y + 267, '#ffd27a', 7, 'center', false);
  // ---- right page
  if (m.tab === 0) { PET_KEYS.forEach((_, i) => drawPetSkillTile(P, i, m, now)); drawPetSkillDetail(P, PET_KEYS[m.cur] || PET_KEYS[0], now); }
  else {
    const n = puCount(pr, P, m.tab);
    for (let i = m.scroll; i < Math.min(n, m.scroll + PU_VIS[m.tab]); i++) {
      const R = puRow(m, i), sel = m.cur === i, rg = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
      rg.addColorStop(0, sel ? '#3a4460' : puHover(R) ? '#503522' : '#422c1c'); rg.addColorStop(1, '#24180f');
      ctx.fillStyle = rg; rrect(ctx, R.x, R.y, R.w, R.h, 4); ctx.fill();
      ctx.strokeStyle = sel ? '#ffd860' : '#563924'; ctx.lineWidth = sel ? 1.2 : 0.8; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 4); ctx.stroke();
      const B = { x: R.x + R.w - 62, y: R.y + 4, w: 56, h: 16 };
      if (m.tab === 1) {
        const c = i === 0 ? null : petCards(pr)[i - 1], on = c ? P.card === c.uid : !card;
        if (c) { drawCardArt(c, R.x + 6, R.y + 1, 15, R.h - 2, now, { small: true }); const sp = cardSpell(c);
          petInk(cardName(c), R.x + 28, R.y + 8, '#f4ecd8', 7.5); petInk(`${sp.name} · RANK ${RANKS[c.tier]} · ${sp.power} pow · ${ELEMENTS[sp.el].name}`, R.x + 28, R.y + 17, '#9aa4b8', 7, 'left', false); }
        else { text('🦴', R.x + 13, R.y + R.h / 2, '#e8c8a0', 9); petInk('No card — it just bites', R.x + 28, R.y + R.h / 2, '#c8d0e0', 7.5); }
        if (on) popupButton({ ...B, label: 'EQUIPPED', primary: true, col: '#ffd860' }, now);
      } else {
        const row = bowlTabRows(pr, P)[i];
        if (row.icon != null) iconCentered('items', row.icon, R.x + 13, R.y + R.h / 2, 13);
        petInk(row.name, R.x + 28, R.y + 8, '#f4ecd8', 7.5); petInk(row.sub, R.x + 28, R.y + 17, '#9aa4b8', 7, 'left', false);
        popupButton({ ...B, label: row.right, primary: i > 0, col: '#ffc07a' }, now);
      }
    }
    if (m.tab === 1) { popupButton({ ...PU_SORT, label: `SORT: ${PET_SORTS[pr.petSort || 0]} [O]`, primary: false, col: '#ffd27a' }, now);
      petInk(`${pr.cards.filter(c => !c.fusion).length} cards · wheel or arrows to scroll`, PU_R.x + 10, PU_SORT.y + PU_SORT.h / 2, '#9aa4b8', 7, 'left', false); }
    petInk(m.tab === 1 ? 'Its card is the spell it casts, and the shape it transforms into' : 'Below 1% HP, each hit eats 1 food instead', PU_R.x + 10, PU_R.y + PU_R.h - 7, '#c8d0e0', 7, 'left', false);
    if (n > PU_VIS[m.tab]) petInk(`${m.scroll + 1}–${Math.min(n, m.scroll + PU_VIS[m.tab])} of ${n}`, PU_R.x + PU_R.w - 10, PU_R.y + PU_R.h - 7, '#9aa4b8', 7, 'right', false);
  }
  text(m.letGo ? 'Press L again to let it go · anything else keeps it' : m.tab === 2 ? 'Arrows move · Enter put 1 in · X the whole stack · F feed · L let go · N / Esc close' : m.tab === 1 ? 'Arrows move · Enter / click: give it that card · F feed · N / Esc close' : 'Arrows choose · Enter / LEARN spends a point · F feed · N / Esc close', VW / 2, PU.y + PU.h + 10, '#ffe9d8', 7.5);
}
// what a skill can do right now
function petSkillState(P, key) {
  const K = PET_SKILLS[key], l = P.sk[key], max = l >= K.max, locked = K.need && !l && (P.layerUses || 0) < K.need;
  return { K, l, max, locked, can: !max && !locked && P.pts > 0 && !P.dead };
}
// one tile of the grid: its socket, name and paw prints for its level, a pulsing + when a point can go here
function drawPetSkillTile(P, i, m, now) {
  const key = PET_KEYS[i], R = PU_TILE(i), { K, l, max, locked, can } = petSkillState(P, key), [ic, col] = PET_SK_ICON[key], sel = m.cur === i;
  ctx.save(); if (sel) { ctx.shadowColor = '#ffcc4a'; ctx.shadowBlur = 5 * RES; }
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, sel ? '#3a4460' : puHover(R) ? '#503522' : '#422c1c'); g.addColorStop(1, '#24180f');
  ctx.fillStyle = g; rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.fill(); ctx.restore();
  ctx.strokeStyle = sel ? '#ffd860' : max ? goldFrameGrad(R.y, R.h) : '#4a5468'; ctx.lineWidth = sel ? 1.4 : 0.9; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 5); ctx.stroke();
  puSocket(R.x + 20, R.y + R.h / 2, 14, ic, col, l > 0, locked);
  petInk(K.name, R.x + 37, R.y + 18, locked ? '#a0a8b8' : '#f4ecd8', K.name.length > 12 ? 7 : 8);
  if (locked) {   // the unlock progress instead of paw prints
    const k = Math.min(1, (P.layerUses || 0) / K.need); ctx.fillStyle = '#160f09'; rrect(ctx, R.x + 38, R.y + 31, 62, 4, 2); ctx.fill();
    ctx.fillStyle = PET_FORM.col; if (k > 0) { rrect(ctx, R.x + 38, R.y + 31, Math.max(3, 62 * k), 4, 2); ctx.fill(); }
  } else for (let p = 0; p < K.max; p++) pawPrint(R.x + 43 + p * 12, R.y + 34, 1.5, p < l, p < l ? '#ffd25a' : '#5a6478');
  if (max) petInk('MAX', R.x + R.w - 7, R.y + R.h - 9, '#ffd25a', 7, 'right');
  else if (can) {
    const pk = 0.7 + 0.3 * Math.sin(now / 220); ctx.save(); ctx.globalAlpha = pk; ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.arc(R.x + R.w - 10, R.y + 10, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    petInk('+', R.x + R.w - 10, R.y + 9.6, '#2a1404', 9, 'center');
  }
}
// the panel under the grid: what the chosen skill does now, what the next level adds, and LEARN
function drawPetSkillDetail(P, key, now) {
  const D = PU_DETAIL, { K, l, max, locked, can } = petSkillState(P, key), [ic, col] = PET_SK_ICON[key];
  ctx.fillStyle = 'rgba(22,15,9,0.72)'; rrect(ctx, D.x, D.y, D.w, D.h, 5); ctx.fill();
  ctx.strokeStyle = goldFrameGrad(D.y, D.h); ctx.lineWidth = 1; rrect(ctx, D.x + 0.5, D.y + 0.5, D.w - 1, D.h - 1, 5); ctx.stroke();
  puSocket(D.x + 26, D.y + D.h / 2, 19, ic, col, l > 0, locked);
  const x = D.x + 54, tw = D.w - 54 - 80;
  drawPix(pixText(K.name, fontPx(11), 700, ['#fff6c8', '#ffd25a', '#d08a20'], '#2a1206'), x, D.y + 12, 'left');
  petInk(`Lv ${l} / ${K.max}`, D.x + D.w - 10, D.y + 12, '#c8d0e0', 7.5, 'right');
  const lines = [];
  if (locked) lines.push([`Unlocks after ${K.need} Layers with it beside you: ${Math.min(K.need, P.layerUses || 0)} / ${K.need}`, '#c8d0e0']);
  else if (key === 'transform' && l) { lines.push([K.desc(l, P), '#c8d0e0']); lines.push([P.formT > 0 ? `TRANSFORMED: ${Math.ceil(P.formT / 60000)} min left` : P.formCd > 0 ? `Resting: ready in ${Math.ceil(P.formCd / 60000)} min` : 'Ready: it may transform in any fight', '#ffa060']); }
  else { if (l) lines.push([`Now: ${K.desc(l, P)}`, '#c8d0e0']); if (!max) lines.push([`${l ? 'Next' : 'Learn it'}: ${K.desc(l + 1, P)}`, '#8fffb0']); }
  let y = D.y + 27;
  for (const [s, c] of lines) for (const t of wrap(s, tw, 7.5)) { petInk(t, x, y, c, 7.5, 'left', false); y += 10; }
  popupButton({ ...PU_LEARN, label: max ? 'MAXED' : locked ? 'LOCKED' : can ? 'LEARN' : P.dead ? 'REVIVE IT' : 'NO POINTS', primary: can, col: '#ffd860' }, now);
}

// ---- the dog's needs: hunger, a fallen dog, feeding and reviving
// Hunger drains 1 point every 5 s while the dog is out; an empty bowl halves its bite and it slowly loses HP. Feed it
// from the PARTNER menu (or let Auto Feast do it). When it falls it stays down until you spend 20 food on reviving it.
const PET_HUNGER_MS = 5000, PET_REVIVE_FOOD = 20;
const plainFoods = pr => Object.keys(pr.items || {}).filter(id => pr.items[id] > 0 && ITEMS[id] && (ITEMS[id].kind === 'crop' || ITEMS[id].kind === 'food'))
  .sort((a, b) => ITEMS[a].sell - ITEMS[b].sell);
const edibleCount = pr => Object.keys(pr.items || {}).filter(id => ITEMS[id] && ['crop', 'food', 'meal'].includes(ITEMS[id].kind)).reduce((t, id) => t + (pr.items[id] || 0), 0);
function payFood(pr, n) {
  if (edibleCount(pr) < n) return false;
  const ids = Object.keys(pr.items || {}).filter(id => ITEMS[id] && ['crop', 'food', 'meal'].includes(ITEMS[id].kind)).sort((a, b) => ITEMS[a].sell - ITEMS[b].sell);
  for (const id of ids) { const k = Math.min(n, pr.items[id]); addItem(pr, id, -k); n -= k; if (!n) break; }
  return true;
}
function feedPet(game, auto, kind = 'pet') {
  const pr = game.profile, P = petOf(pr, kind); if (!P || P.dead) return false;
  if (P.hunger >= 100) { if (!auto) game.toast(`Your ${petWord(kind)} is full`, '#c9c1a8'); return false; }
  const id = plainFoods(pr)[0];
  if (!id) { if (!auto) game.toast('No food to give it — crops, bread or meat', '#ff8a8a'); return false; }
  addItem(pr, id, -1); P.hunger = Math.min(100, P.hunger + (ITEMS[id].hunger || 10));
  game.toast(`${auto ? 'Auto Feast: f' : 'F'}ed your ${petWord(kind)} ${ITEMS[id].name} · hunger ${Math.round(P.hunger)}/100`, '#ffd27a');
  return true;
}
function revivePet(game, kind = 'pet') {
  const pr = game.profile, P = petOf(pr, kind); if (!P || !P.dead) return;
  const have = edibleCount(pr);
  if (have < PET_REVIVE_FOOD) { game.toast(`Reviving your ${petWord(kind)} takes ${PET_REVIVE_FOOD} food — you have ${have}`, '#ff8a8a'); return; }
  let need = PET_REVIVE_FOOD;   // the cheapest food goes first
  const ids = Object.keys(pr.items).filter(id => ITEMS[id] && ['crop', 'food', 'meal'].includes(ITEMS[id].kind)).sort((a, b) => ITEMS[a].sell - ITEMS[b].sell);
  for (const id of ids) { const k = Math.min(need, pr.items[id]); addItem(pr, id, -k); need -= k; if (!need) break; }
  P.dead = false; P.hunger = 100;
  game.toast(`Your ${petWord(kind)} is back on its feet!`, '#ffd27a'); game.save(); respawnDog(game, kind);
}
// once a second: hunger, starving, Auto Feast for the dog
function petTick(game, w, dt) { for (const k of petsOf(game.profile)) petTickOne(game, w, dt, k); }
function petTickOne(game, w, dt, kind) {
  const pr = game.profile, P = petOf(pr, kind); if (!P || P.dead) return;
  if (P.formCd > 0) P.formCd -= dt;
  if (P.formT > 0 && (P.formT -= dt) <= 0) petRevert(game, w, P);
  const d = petActor(w, kind); if (!d) return;
  P.hungerAcc = (P.hungerAcc || 0) + dt;
  const hungerMs = PET_HUNGER_MS / (1 - P.sk.light * 0.15);   // LIGHT EATER
  while (P.hungerAcc >= hungerMs) { P.hungerAcc -= hungerMs; P.hunger = Math.max(0, P.hunger - 1); }
  // TRANSFORMATION: now and again in a fight
  P.formRoll = (P.formRoll || 0) + dt;
  if (P.formRoll >= 1000) { P.formRoll = 0;
    if (P.sk.transform && !(P.formT > 0) && !(P.formCd > 0) && !w.peaceful && nearestEnemy(w, d, 150) && Math.random() < PET_FORM.chance) petTransform(game, w, d, P); }
  // QUICK MEND: it heals itself every second
  if (P.sk.mend && d.hp < d.maxHp && !d.dying) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * petMendPct(P.sk.mend) / 100 * dt / 1000);
  // HEALING LICK: when you are hurt and it is beside you, it licks your wounds — more, and more often, each level
  const hl = P.sk.heal, owner = w.player;
  if (hl && (d.healT = (d.healT || 0) - dt) <= 0 && owner && !owner.dead && owner.hp < owner.maxHp * 0.9 && dist(d, owner) < 90) {
    d.healT = petHealSec(hl) * 1000;
    const amt = Math.round(owner.maxHp * petHealPct(hl) / 100);
    heal(w, owner, amt, true);
    floatText(w, owner.x, owner.y - 46, `+${amt} ♥`, '#8fffb0', 8);
    for (let i = 0; i < 6; i++) w.particles.push({ x: d.x, y: d.y - 10, vx: (owner.x - d.x) * 2 + rand(-20, 20), vy: (owner.y - d.y) * 2 - 40 + rand(-20, 20), t: 0, life: 520, col: i % 2 ? '#ff9ab8' : '#8fffb0', size: 2, drag: 0.92 });
    w.rings.push({ x: owner.x, y: owner.y, r: 18, t: 0, col: '#8fffb0' });
  }
  if (d.form && (d.howlT = (d.howlT || 0) - dt) <= 0) {   // Beast Soul: a howl that blasts the foes around it
    d.howlT = 2200;
    const foes = enemiesOf(w, d).filter(o => dist(o, d) < 60);
    if (foes.length) {
      w.rings.push({ x: d.x, y: d.y, r: 56, t: 0, col: PET_FORM.col }, { x: d.x, y: d.y, r: 34, t: -90, col: PET_FORM.mote });
      floatText(w, d.x, d.y - 40, 'HOWL!', PET_FORM.mote, 8);
      strike(w, d, d.x, d.y, 60, 60, { base: d.atk * 1.2, el: 'fire', spell: true, pop: 140, push: 70 });
    }
  }
  d.hungerMul = P.hunger <= 0 ? 0.5 : 1;   // an empty bowl: half bite…
  if (P.hunger <= 0 && !d.dying) d.hp = Math.max(1, d.hp - d.maxHp * 0.01 * dt / 1000);   // …and it slowly weakens
  P.feedT = (P.feedT || 0) + dt;
  if (P.feedT > 1000) { P.feedT = 0; const L = (pr.farmer && pr.farmer.sk && pr.farmer.sk.autoEat) || 0; if (L && P.hunger < autoEatAt(L)) feedPet(game, true, kind); }
}
// over the dog's head: just its HP as a small ring (green, red when low); hunger and level live on its HUD button
function drawPetBars(a, y) {
  if (a.netOf) { drawNetPetBars(a, y); return; }   // (a co-op friend's: netpets.js)
  if (a.heroPartner) { drawPartnerBars(a, y); return; }
  const P = window.GAME && petOf(GAME.profile, a.petKind); if (!P) return;
  if (a.form) drawBeastSoul(a, y);
  const cy = y - (a.h || 19) * (a.scale || 1) - 6, hp = Math.max(0, Math.min(1, a.hp / a.maxHp));
  drawMiniCapsule(a.x, cy - 3, 16, hp);   // (a small capsule like the other companions': world.js)
}
// BEAST SOUL, the hound's own Layer: an ember-orange ground glow, flickering flame tongues round its feet and paw-print
// motes drifting up
function drawBeastSoul(a, y) {
  const now = performance.now();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 22); g.addColorStop(0, `rgba(${PET_FORM.glow},0.5)`); g.addColorStop(1, `rgba(${PET_FORM.glow},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, a.y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) {   // flame tongues
    const an = i / 6 * Math.PI * 2 + now / 600, fx = a.x + Math.cos(an) * 12, fy = a.y + Math.sin(an) * 4, hgt = 6 + 4 * Math.sin(now / 90 + i * 1.7);
    ctx.fillStyle = i % 2 ? PET_FORM.col : PET_FORM.mote; ctx.globalAlpha = 0.65;
    ctx.beginPath(); ctx.moveTo(fx - 2, fy); ctx.quadraticCurveTo(fx, fy - hgt * 1.3, fx + 2, fy); ctx.fill();
  }
  for (let i = 0; i < 4; i++) {   // paw motes
    const k = ((now / 1600) + i / 4) % 1, px = Math.round(a.x - 10 + i * 7 + Math.sin(k * 6 + i) * 2), py = Math.round(a.y - 4 - k * 34);
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9; ctx.fillStyle = PET_FORM.mote;
    ctx.fillRect(px, py, 2, 2); ctx.fillRect(px - 2, py - 2, 1, 1); ctx.fillRect(px, py - 3, 1, 1); ctx.fillRect(px + 2, py - 2, 1, 1);
  }
  ctx.restore();
}
// the dog sniffs out black holes: a violet paw arrow on the ground round the hero, pointing to the nearest open one
const HOLE_SNIFF_M = 100;   // how far away the hound can smell a black hole
function drawHoleCompass(w, now) {
  const P = window.GAME && petOf(GAME.profile); if (!P || P.dead || !w.caves || !w.actors.some(a => a.pet && !a.dead)) return;
  const p = w.player; let best = null, bd = Infinity;
  for (const c of w.caves) if (c.open) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
  if (!best || bd < 170 || bd / T > HOLE_SNIFF_M) return;   // only within HOLE_SNIFF_M metres (and not once you are on top of it)
  // a bold violet arrow on a ring well clear of the hero (drawn over everyone), its tip nudging toward the hole, with
  // the distance on a dark pill beside it
  const an = Math.atan2(best.y - p.y, best.x - p.x), r = 46 + Math.sin(now / 260) * 3, cx0 = p.x, cy0 = p.y - 12;
  const ax = cx0 + Math.cos(an) * r, ay = cy0 + Math.sin(an) * r * 0.7, pulse = 0.8 + 0.2 * Math.sin(now / 200);
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(an);
  ctx.shadowColor = '#b06bff'; ctx.shadowBlur = 6 * RES;
  const arrow = s => { ctx.beginPath(); ctx.moveTo(12 * s, 0); ctx.lineTo(-6 * s, -8 * s); ctx.lineTo(-2 * s, 0); ctx.lineTo(-6 * s, 8 * s); ctx.closePath(); };
  ctx.fillStyle = '#302014'; arrow(1.25); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(200,140,255,${pulse})`; arrow(1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-3, -5); ctx.lineTo(-1, -1); ctx.closePath(); ctx.fill();
  ctx.restore();
  const s = `🐾 black hole · ${Math.round(bd / T)} m`, tw = textW(s, 6) + 10, lx = ax, ly = ay + (Math.sin(an) > 0.3 ? 14 : -14);
  ctx.fillStyle = 'rgba(40,26,17,0.85)'; rrect(ctx, lx - tw / 2, ly - 5.5, tw, 11, 5.5); ctx.fill();
  ctx.strokeStyle = '#b06bff'; ctx.lineWidth = 0.8; rrect(ctx, lx - tw / 2 + 0.4, ly - 5.1, tw - 0.8, 10.2, 5.1); ctx.stroke();
  text(s, lx, ly + 0.3, '#ecd8ff', 6);
}

// ---- the dog's own HUD button, left of the skill bar: a round gold socket with the hound in it, its HP as the outer
// ring and its hunger as the inner one, its level, the N key; greyed with REVIVE when it has fallen. Click: PARTNER.
const DOG_BTN = { x: 142, y: VH - 39, r: 14 };
function drawDogButton(game, now) { petsOf(game.profile).forEach((k, i) => drawPetButton(game, now, k, i)); }
function drawPetButton(game, now, kind, slot) {
  const pr = game.profile, P = petOf(pr, kind), w = game.world; if (!P || !w || game.menu) return;
  const { y, r } = DOG_BTN, x = DOG_BTN.x - slot * 40, d = petActor(w, kind), hp = P.dead ? 0 : d ? d.hp / d.maxHp : 1;
  const hov = Math.hypot(mouse.x - x, mouse.y - y) < r + 3;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4 * RES; ctx.shadowOffsetY = 1.5 * RES;
  const rim = ctx.createLinearGradient(0, y - r - 4, 0, y + r + 4); rim.addColorStop(0, '#fff2b8'); rim.addColorStop(0.5, '#e0a63a'); rim.addColorStop(1, '#8a5210');
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const well = ctx.createRadialGradient(x, y - 4, 2, x, y, r + 2); well.addColorStop(0, P.dead ? '#3a3440' : '#3a2a18'); well.addColorStop(1, '#0e0806');
  ctx.fillStyle = well; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
  // HP (outer) and hunger (inner) rings
  const ring = (rr, frac, col, wd) => { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = wd; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
    if (frac > 0) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac)); ctx.stroke(); } };
  ring(r + 1, hp, hp > 0.3 ? '#5ad84a' : '#ff5a4a', 2.2); ring(r - 2.2, P.hunger / 100, P.hunger > 30 ? '#ffb040' : '#ff6a3a', 1.6);
  // the hound
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 3.5, 0, Math.PI * 2); ctx.clip();
  if (P.dead) ctx.filter = 'grayscale(1) brightness(0.6)'; else if (kind === 'wolf') ctx.filter = WOLF_FILTER; else if (kind === 'drake' && drakeHatched(P)) ctx.filter = DRAKE.stages[drakeStage(P)].glow;
  if (kind === 'drake' && !drakeHatched(P)) drawDrakeEgg(x, y, 0.62); else monsterPreview(DOG_SP, x - 10, y - 11, 20, 20, 0, 0, 'idle'); ctx.restore();   // (a still portrait: it doesn't breathe)
  if (P.dead) { text('REVIVE', x, y + 1, '#ff9a8a', 5.5); }
  if (hov) { ctx.strokeStyle = `rgba(255,240,180,${0.6 + 0.3 * Math.sin(now / 200)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 4.5, 0, Math.PI * 2); ctx.stroke(); }
  // level badge and key
  ctx.fillStyle = '#302014'; ctx.beginPath(); ctx.arc(x + r - 1, y - r + 2, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e0a63a'; ctx.lineWidth = 0.8; ctx.stroke();
  text(String(P.lv), x + r - 1, y - r + 2.4, '#ffe9a8', 5);
  if (P.pts > 0) { ctx.fillStyle = `rgba(143,255,176,${0.7 + 0.3 * Math.sin(now / 200)})`; ctx.beginPath(); ctx.arc(x - r + 1, y - r + 2, 2.5, 0, Math.PI * 2); ctx.fill(); }   // points to spend
  if (!slot) keyGem('N', x - 4, y + r + 5);
  if (clicked(x - r - 4, y - r - 4, (r + 4) * 2, (r + 4) * 2)) game.openMenu(petMenu(kind));
}

// let a pet go: it leaves for good (its card goes back to your collection), and its place is free for another
function releasePet(game, kind) {
  const pr = game.profile, P = pr[kind]; if (!P) return; const w = game.world;
  if (w) for (const a of w.actors) if (a.pet && a.petKind === kind && a.owner === w.player) { a.remove = true; w.rings.push({ x: a.x, y: a.y, r: 20, t: 0, col: '#ffd27a' }); }
  delete pr[kind]; game.toast(`Your ${petWord(kind)} runs off into the Wilds. Farewell!`, '#ffd27a'); game.save();
  const left = petsOf(pr); game.closeMenu(); if (left.length) game.openMenu(petMenu(left[0]));
}
// a new pet only when there is room (three at most)
function petRoom(game) { const pr = game.profile; if (petsOf(pr).length < PET_MAX) return true; game.toast(`You already have ${PET_MAX} pets. Let one go first (N, then L)`, '#ff9a7a'); return false; }
