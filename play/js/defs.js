'use strict';
// Game rules: ranks, passives, species, spells, cards, gear, fusion.

const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+'];
const RANK_COL = ['#9aa0a6', '#e8e8e8', '#6fd86b', '#41d1c4', '#4ea8ff', '#b77cff', '#ff9a3c', '#ff4e5e', '#ffd23f', 'rainbow'];
const HP_MULT = [1, 1.5, 2.1, 2.8, 3.6, 4.5, 5.6, 7.0, 8.6, 10.5];
const DMG_MULT = [1, 1.2, 1.45, 1.7, 2.0, 2.35, 2.75, 3.2, 3.7, 4.3];
const MOB_BASE = { hp: 1.3, atk: 1.25, def: 1.25 };   // every monster's base stats, on top of its species and rank
function rankColor(t, now = performance.now()) {
  return RANK_COL[t] === 'rainbow' ? `hsl(${(now / 6) % 360},100%,65%)` : RANK_COL[t];
}
const tierScale = t => 1 + 0.35 * t;
// THE BALANCE PASS (2026-11-13, the user's list): cards hit a quarter as hard, cooldowns are half again as long (FOCUS can win
// back up to 20%), and Regeneration / Mana Font passives only work on SSS+ (tier 9) cards and gear.
const CARD_DMG_K = 0.25, CARD_CD_K = 1.5, REGEN_TIER = 9;
const MP_REGEN = 0;   // no base MP regen (was 3, then 6): MP comes from landed hits (+2 each) and Mana Font cards (MANA_FONT_MP)
const MANA_FONT_MP = 3;   // MP per second at +100% Mana Font (so an S card, +22%, gives about 0.7 MP/s)

// ---------- passives ----------
// v = base * tierScale(tier); `cap` limits stacking from many cards.
const PASSIVES = {
  hide:    { name: 'Thick Hide',   base: 6,   cap: 70,  fmt: v => `-${v.toFixed(0)}% damage taken` },
  brutal:  { name: 'Brutal',       base: 8,   cap: 300, fmt: v => `+${v.toFixed(0)}% damage` },
  swift:   { name: 'Swift',        base: 5,   cap: 60,  fmt: v => `+${v.toFixed(0)}% move speed` },
  regen:   { name: 'Regeneration', base: 0.12, cap: 1.5, fmt: v => `regenerate ${v.toFixed(2)}% HP/s (SSS+ only)` },   // (was 0.4, cap 6: a full heal in seconds)
  vamp:    { name: 'Vampiric',     base: 3,   cap: 40,  fmt: v => `heal ${v.toFixed(0)}% of damage dealt` },
  thorns:  { name: 'Thorns',       base: 8,   cap: 120, fmt: v => `reflect ${v.toFixed(0)}% melee damage` },
  crit:    { name: 'Critical',     base: 5,   cap: 75,  fmt: v => `${v.toFixed(0)}% chance for ×2 damage` },
  evade:   { name: 'Evasion',      base: 4,   cap: 45,  fmt: v => `${v.toFixed(0)}% chance to dodge` },
  frost:   { name: 'Frostbite',    base: 10,  cap: 80,  fmt: v => `${v.toFixed(0)}% chance hits slow by 40%` },
  venom:   { name: 'Venom',        base: 10,  cap: 100, fmt: v => `hits poison for ${v.toFixed(0)}% over 3s` },
  unstop:  { name: 'Unstoppable',  base: 8,   cap: 70,  fmt: v => `${v.toFixed(0)}% chance to ignore stagger` },
  mana:    { name: 'Mana Font',    base: 6,   cap: 120, fmt: v => `regenerate ${(MANA_FONT_MP * v / 100).toFixed(2)} MP/s (SSS+ only)` },   // (was +10% of the base, cap 250)
  last:    { name: 'Last Stand',   base: 12,  cap: 200, fmt: v => `+${v.toFixed(0)}% damage below 30% HP` },
  burst:   { name: 'Death Burst',  base: 15,  cap: 80,  fmt: v => `explode / heal ${v.toFixed(0)}% on death or kill` },
  barrier: { name: 'Barrier',      base: 6,   cap: 50,  fmt: v => `every 8s gain a ${v.toFixed(0)}% HP shield` },
  frenzy:  { name: 'Frenzy',       base: 5,   cap: 60,  fmt: v => `+${v.toFixed(0)}% attack speed` },
};
const PASSIVE_IDS = Object.keys(PASSIVES);
const GEAR_BONUS_IDS = PASSIVE_IDS.filter(id => id !== 'regen' && id !== 'mana');
const passiveValue = (id, tier) => PASSIVES[id].base * tierScale(tier);

// ---------- elements ----------
const ELEMENTS = {
  fire:      { name: 'Fire',      col: '#ff7a2f', status: 'burn',   desc: 'burns for 3s' },
  ice:       { name: 'Ice',       col: '#7fd6ff', status: 'freeze', desc: 'freezes (−60% speed) for 2s' },
  lightning: { name: 'Lightning', col: '#fff36b', status: 'shock',  desc: 'shocks (stun 0.5s)' },
  earth:     { name: 'Earth',     col: '#c69a5b', status: 'crack',  desc: 'cracks armour (+25% damage taken) 4s' },
  wind:      { name: 'Wind',      col: '#9df7c5', status: 'gust',   desc: 'extra lift and knockback' },
  dark:      { name: 'Dark',      col: '#b06bff', status: 'drain',  desc: 'drains 25% as HP' },
  poison:    { name: 'Poison',    col: '#8cff4e', status: 'toxin',  desc: 'heavy poison for 4s' },
  holy:      { name: 'Holy',      col: '#ffe9a8', status: 'bless',  desc: 'heals you 15% of damage' },
};

// SkillEffect animation indices (dynamic/SkillEffect.pzx) used as spell visuals
const FX = { LIGHTNING: 10, STORM: 11, SPIKE: 12, HOLY: 14, METEOR: 15, ICE: 16, EXPLODE: 17,
  VORTEX: 21, FLAME: 25, WIND: 29, BEAM: 33, ROCKS: 37 };

// Archetypes: power multiplier, MP cost, cooldown (ms)
const ARCH = {
  bolt:   { name: 'Bolt',   pow: 1.0, mp: 14, cd: 1800, desc: 'hurls a piercing projectile' },
  nova:   { name: 'Nova',   pow: 1.1, mp: 22, cd: 3500, desc: 'bursts around you' },
  pillar: { name: 'Pillar', pow: 1.35, mp: 20, cd: 3000, desc: 'strikes the nearest foe and launches' },
  summon: { name: 'Summon', pow: 1.5, mp: 28, cd: 4500, desc: 'summons the monster to attack and launch' },
  rain:   { name: 'Rain',   pow: 0.55, mp: 30, cd: 5000, desc: 'calls repeated strikes on the area' },
  dash:   { name: 'Dash',   pow: 1.1, mp: 18, cd: 2600, desc: 'charges through foes, invulnerable' },
  beam:   { name: 'Beam',   pow: 1.25, mp: 24, cd: 3600, desc: 'fires a long line in front' },
  quake:  { name: 'Quake',  pow: 1.2, mp: 22, cd: 3200, desc: 'erupts spikes in a line and launches' },
};

// ---------- species (monster banks char/001..030) ----------
// hp/dmg are F-rank base values; sig = signature passive; spell = unique card spell.
const SPECIES = {
  '001': { name: 'Inferno Behemoth', hp: 120, dmg: 14, spd: 34, sig: 'brutal',  spell: { n: 'Hellmaw Eruption', a: 'nova',   el: 'fire',      fx: FX.FLAME, icon: 4 } },
  '002': { name: 'Burrow Mole',      hp: 40,  dmg: 5,  spd: 40, sig: 'hide',    spell: { n: 'Tunnel Ambush',    a: 'quake',  el: 'earth',     fx: FX.SPIKE, icon: 19 } },
  '003': { name: 'Plume Imp',        hp: 34,  dmg: 6,  spd: 55, sig: 'evade',   spell: { n: 'Featherstorm',     a: 'rain',   el: 'wind',      fx: FX.WIND,  icon: 7 } },
  '004': { name: 'Grim Reaper',      hp: 70,  dmg: 11, spd: 46, sig: 'vamp',    spell: { n: 'Soul Harvest',     a: 'summon', el: 'dark',      fx: FX.VORTEX, icon: 23 } },
  '005': { name: 'Frost Beetle',     hp: 36,  dmg: 5,  spd: 42, sig: 'frost',   spell: { n: 'Rime Shell',       a: 'nova',   el: 'ice',       fx: FX.ICE,   icon: 26 } },
  '006': { name: 'Puddle Slime',     hp: 30,  dmg: 4,  spd: 36, sig: 'regen',   spell: { n: 'Slime Splash',     a: 'bolt',   el: 'poison',    fx: FX.ROCKS, icon: 12 } },
  '007': { name: 'Axe Lupine',       hp: 55,  dmg: 9,  spd: 58, sig: 'crit',    spell: { n: 'Lupine Rush',      a: 'dash',   el: 'wind',      fx: FX.WIND,  icon: 2 } },
  '008': { name: 'Thorn Dryad',      hp: 44,  dmg: 7,  spd: 44, sig: 'thorns',  spell: { n: 'Bramble Spire',    a: 'pillar', el: 'poison',    fx: FX.SPIKE, icon: 20 } },
  '009': { name: 'Volt Imp',         hp: 32,  dmg: 7,  spd: 60, sig: 'frenzy',  spell: { n: 'Arc Lance',        a: 'bolt',   el: 'lightning', fx: FX.LIGHTNING, icon: 8 } },
  '010': { name: 'Magma Crab',       hp: 60,  dmg: 8,  spd: 34, sig: 'hide',    spell: { n: 'Molten Pincer',    a: 'summon', el: 'fire',      fx: FX.EXPLODE, icon: 9 } },
  '011': { name: 'Shade Bat',        hp: 28,  dmg: 5,  spd: 66, sig: 'vamp',    spell: { n: 'Night Swarm',      a: 'rain',   el: 'dark',      fx: FX.VORTEX, icon: 27 } },
  '012': { name: 'Spectral Lance',   hp: 46,  dmg: 9,  spd: 50, sig: 'crit',    spell: { n: 'Phantom Pierce',   a: 'beam',   el: 'dark',      fx: FX.BEAM,  icon: 22 } },
  '013': { name: 'Gazer',            hp: 58,  dmg: 8,  spd: 38, sig: 'mana',    spell: { n: 'Evil Eye Ray',     a: 'beam',   el: 'lightning', fx: FX.BEAM,  icon: 10 } },
  '014': { name: 'Stone Golem',      hp: 110, dmg: 10, spd: 30, sig: 'unstop',  spell: { n: 'Boulder Fall',     a: 'pillar', el: 'earth',     fx: FX.METEOR, icon: 19 } },
  '016': { name: 'Totem Guardian',   hp: 80,  dmg: 9,  spd: 32, sig: 'barrier', spell: { n: 'Ancestral Ward',   a: 'nova',   el: 'holy',      fx: FX.HOLY,  icon: 13 } },
  '017': { name: 'Cursed Blade',     hp: 64,  dmg: 12, spd: 52, sig: 'brutal',  spell: { n: 'Thousand Cuts',    a: 'dash',   el: 'dark',      fx: FX.WIND,  icon: 1 } },
  '018': { name: 'Frost Djinn',      hp: 72,  dmg: 11, spd: 48, sig: 'frost',   spell: { n: 'Glacier Pillar',   a: 'pillar', el: 'ice',       fx: FX.ICE,   icon: 26 } },
  '019': { name: 'Orc Raider',       hp: 78,  dmg: 10, spd: 44, sig: 'last',    spell: { n: 'War Stomp',        a: 'quake',  el: 'earth',     fx: FX.SPIKE, icon: 17 } },
  '020': { name: 'Bone Jester',      hp: 50,  dmg: 9,  spd: 56, sig: 'evade',   spell: { n: 'Jester Juggle',    a: 'summon', el: 'wind',      fx: FX.WIND,  icon: 30 } },
  '021': { name: 'Dark Knight',      hp: 96,  dmg: 13, spd: 44, sig: 'unstop',  spell: { n: 'Abyssal Cleave',   a: 'quake',  el: 'dark',      fx: FX.VORTEX, icon: 24 } },
  '022': { name: 'Crimson Witch',    hp: 58,  dmg: 13, spd: 46, sig: 'mana',    spell: { n: 'Crimson Meteor',   a: 'rain',   el: 'fire',      fx: FX.METEOR, icon: 5 } },
  '023': { name: 'Wraith Maiden',    hp: 54,  dmg: 11, spd: 50, sig: 'regen',   spell: { n: 'Wailing Light',    a: 'pillar', el: 'holy',      fx: FX.HOLY,  icon: 14 } },
  '024': { name: 'Abyss Wyvern',     hp: 150, dmg: 16, spd: 48, sig: 'burst',   spell: { n: 'Wyvern Inferno',   a: 'beam',   el: 'fire',      fx: FX.BEAM,  icon: 33 } },
  '025': { name: 'Iron Sentinel',    hp: 84,  dmg: 9,  spd: 36, sig: 'barrier', spell: { n: 'Bulwark Charge',   a: 'dash',   el: 'earth',     fx: FX.ROCKS, icon: 15 } },
  '026': { name: 'Colossus',         hp: 160, dmg: 15, spd: 30, sig: 'thorns',  spell: { n: 'Judgement Blade',  a: 'summon', el: 'holy',      fx: FX.HOLY,  icon: 31 } },
  '027': { name: 'Royal Guard',      hp: 90,  dmg: 11, spd: 40, sig: 'hide',    spell: { n: 'Lion Shield Bash', a: 'quake',  el: 'holy',      fx: FX.ROCKS, icon: 16 } },
  '028': { name: 'Lizard Sage',      hp: 62,  dmg: 12, spd: 48, sig: 'venom',   spell: { n: 'Toxic Torrent',    a: 'bolt',   el: 'poison',    fx: FX.STORM, icon: 21 } },
  '029': { name: 'Leaf Sprite',      hp: 30,  dmg: 5,  spd: 62, sig: 'swift',   spell: { n: 'Gale Leaves',      a: 'nova',   el: 'wind',      fx: FX.WIND,  icon: 6 } },
  '030': { name: 'Shadow Squire',    hp: 70,  dmg: 10, spd: 50, sig: 'burst',   spell: { n: 'Storm Banner',     a: 'rain',   el: 'lightning', fx: FX.STORM, icon: 11 } },
  // ---- monsters from Zenonia 2 (char/NNN.pzx stored as NNN + 200); names from its XlsChar table where they match
  '201': { name: 'War Orc',          hp: 95,  dmg: 12, spd: 42, sig: 'brutal',  spell: { n: 'Orc Rampage',      a: 'dash',   el: 'earth',     fx: FX.ROCKS, icon: 17 } },
  '202': { name: 'Royal Soldier',    hp: 50,  dmg: 7,  spd: 48, sig: 'crit',    spell: { n: 'Lance Thrust',     a: 'beam',   el: 'wind',      fx: FX.BEAM,  icon: 22 } },
  '203': { name: 'Lime',             hp: 26,  dmg: 4,  spd: 40, sig: 'regen',   spell: { n: 'Lime Pop',         a: 'bolt',   el: 'fire',      fx: FX.EXPLODE, icon: 12 } },
  '204': { name: 'Scout Lime',       hp: 28,  dmg: 4,  spd: 44, sig: 'swift',   spell: { n: 'Milk Splash',      a: 'bolt',   el: 'ice',       fx: FX.ICE,   icon: 12 } },
  '205': { name: 'Mukaka',           hp: 48,  dmg: 6,  spd: 36, sig: 'hide',    spell: { n: 'Belly Slam',       a: 'nova',   el: 'earth',     fx: FX.ROCKS, icon: 19 } },
  '207': { name: 'Grey Orc Knight',  hp: 120, dmg: 14, spd: 38, sig: 'unstop',  spell: { n: 'Iron Horn Charge', a: 'dash',   el: 'dark',      fx: FX.VORTEX, icon: 24 } },
  '208': { name: 'Elder Wood',       hp: 52,  dmg: 6,  spd: 30, sig: 'barrier', spell: { n: 'Root Bind',        a: 'quake',  el: 'earth',     fx: FX.SPIKE, icon: 20 } },
  '209': { name: 'Lizardman',        hp: 58,  dmg: 8,  spd: 50, sig: 'thorns',  spell: { n: 'Shield Rush',      a: 'dash',   el: 'earth',     fx: FX.ROCKS, icon: 15 } },
  '210': { name: 'Poison Plant',     hp: 40,  dmg: 7,  spd: 34, sig: 'venom',   spell: { n: 'Toxic Bloom',      a: 'pillar', el: 'poison',    fx: FX.SPIKE, icon: 21 } },
  '211': { name: 'Pengki Boom',      hp: 34,  dmg: 9,  spd: 46, sig: 'burst',   spell: { n: 'Penguin Bomb',     a: 'summon', el: 'fire',      fx: FX.EXPLODE, icon: 9 } },
  '214': { name: 'Slobber',          hp: 130, dmg: 13, spd: 34, sig: 'last',    spell: { n: 'Crushing Fall',    a: 'pillar', el: 'earth',     fx: FX.METEOR, icon: 19 } },
  '216': { name: 'Flame Wraith',     hp: 64,  dmg: 12, spd: 52, sig: 'brutal',  spell: { n: 'Wildfire',         a: 'rain',   el: 'fire',      fx: FX.FLAME, icon: 4 } },
  '217': { name: 'Sand Golem',       hp: 110, dmg: 11, spd: 30, sig: 'hide',    spell: { n: 'Sandstorm Fist',   a: 'quake',  el: 'earth',     fx: FX.ROCKS, icon: 19 } },
  '219': { name: 'Saleck',           hp: 36,  dmg: 7,  spd: 64, sig: 'evade',   spell: { n: 'Piercing Gaze',    a: 'beam',   el: 'lightning', fx: FX.BEAM,  icon: 10 } },
  '221': { name: 'Night Bat',        hp: 30,  dmg: 6,  spd: 68, sig: 'vamp',    spell: { n: 'Blood Flutter',    a: 'rain',   el: 'dark',      fx: FX.VORTEX, icon: 27 } },
  '222': { name: 'Magma Golem',      hp: 140, dmg: 15, spd: 30, sig: 'thorns',  spell: { n: 'Lava Burst',       a: 'nova',   el: 'fire',      fx: FX.FLAME, icon: 5 } },
  '223': { name: 'Scorpion',         hp: 62,  dmg: 10, spd: 50, sig: 'venom',   spell: { n: 'Venom Sting',      a: 'bolt',   el: 'poison',    fx: FX.STORM, icon: 21 } },
  '226': { name: 'Snow Shati',       hp: 90,  dmg: 12, spd: 46, sig: 'frost',   spell: { n: 'Avalanche Charge', a: 'dash',   el: 'ice',       fx: FX.ICE,   icon: 26 } },
  '232': { name: 'Frost Jelly',      hp: 50,  dmg: 10, spd: 36, sig: 'frost',   spell: { n: 'Glacial Pulse',    a: 'nova',   el: 'ice',       fx: FX.ICE,   icon: 26 } },
  '234': { name: 'Desert Mummy',     hp: 66,  dmg: 9,  spd: 40, sig: 'regen',   spell: { n: 'Cursed Wrap',      a: 'summon', el: 'dark',      fx: FX.VORTEX, icon: 23 } },
  '239': { name: 'Shadow Mantis',    hp: 88,  dmg: 14, spd: 54, sig: 'crit',    spell: { n: 'Void Scythe',      a: 'beam',   el: 'dark',      fx: FX.BEAM,  icon: 24 } },
  '241': { name: 'Sun Guardian',     hp: 150, dmg: 16, spd: 34, sig: 'barrier', spell: { n: 'Solar Judgement',  a: 'pillar', el: 'holy',      fx: FX.HOLY,  icon: 31 } },
  // ---- Chef Daddy's exclusive skill cards (no monster bank: art is icon `ico` of assets/chef_icons.png; never dropped).
  // sx = the skill's special behaviour in castSpell; always = the element effect applies at every rank.
  ck1: { name: 'Hot Oil',          chef: true, ico: 0, sig: 'brutal', spell: { n: 'Hot Oil',          a: 'beam',   el: 'fire',      fx: FX.FLAME,   icon: 4,  sx: 'oil', always: true, d: 'Scalding oil in a line. Always burns' } },
  ck2: { name: 'Turn Up the Heat', chef: true, ico: 1, sig: 'frenzy', spell: { n: 'Turn Up the Heat', a: 'nova',   el: 'fire',      fx: FX.EXPLODE, icon: 4,  sx: 'heat', cd: 9000, mp: 26, d: '8s: +30% dmg, faster cuts, hits burn' } },
  ck3: { name: 'Ice Box',          chef: true, ico: 2, sig: 'frost',  spell: { n: 'Ice Box',          a: 'pillar', el: 'ice',       fx: FX.ICE,     icon: 26, sx: 'icebox', always: true, d: 'Traps the nearest foe in ice' } },
  ck4: { name: 'Order Up',         chef: true, ico: 3, sig: 'crit',   spell: { n: 'Order Up!',        a: 'bolt',   el: 'holy',      fx: FX.BEAM,    icon: 31, sx: 'order', d: 'Hot plates that pierce every foe' } },
  ck5: { name: 'Knife Sharpen',    chef: true, ico: 4, sig: 'crit',   spell: { n: 'Knife Sharpen',    a: 'nova',   el: 'lightning', fx: FX.LIGHTNING, icon: 18, sx: 'sharpen', cd: 12000, mp: 16, d: '10s: +40% crit, +20% knife damage' } },
  ck6: { name: 'Smoke Break',      chef: true, ico: 5, sig: 'regen',  spell: { n: 'Smoke Break',      a: 'nova',   el: 'wind',      fx: FX.WIND,    icon: 7,  sx: 'smoke', cd: 14000, mp: 10, d: '4s: 50% dodge, heal, +MP' } },
  ck7: { name: 'Deep Cut',         chef: true, ico: 6, sig: 'vamp',   spell: { n: 'Deep Cut',         a: 'dash',   el: 'dark',      fx: FX.SPIKE,   icon: 23, sx: 'deepcut', always: true, d: 'A dash cut that drains HP' } },
  // the class's exclusive card: every meal is five stars and buffs whoever eats it
  ck8: { name: 'Gourmet Meal',     chef: true, ico: 7, sig: 'regen', gourmet: true, spell: { n: 'Gourmet Meal', a: 'nova', el: 'holy', fx: FX.HOLY, icon: 31, sx: 'meal', cd: 20000, mp: 30, d: 'Heal party 30% · Well Fed 15s' } },
  '243': { name: 'Crystal Wraith',   hp: 120, dmg: 15, spd: 46, sig: 'mana',    spell: { n: 'Prism Storm',      a: 'rain',   el: 'ice',       fx: FX.ICE,   icon: 26 } },
};
// sprites cut from big character sheets (tools/build_custom_sprites.py): the landlord's mercenaries and OmegaKingX,
// both cards. OmegaKingX's King's Legion calls five random monsters to fight for you for a while (a long cooldown).
Object.assign(D.monsters, window.CUSTOM_BANKS || {});
// THE RENT MERCENARIES in Zenonia's own art (2026-11-08, the user's pick): the Royal Guard (027) in its dark palette with a deep
// crimson cape (tools/build_merc_guard.py -> assets/merc_guard.png), in place of the softer custom sheet (assets/merc.png)
if (D.monsters['027']) D.monsters.merc = Object.assign({}, D.monsters['027'], { imgs: ['assets/merc_guard.png'] });
{ const S = D.classes[0], A2 = S.anims;   // the OmegaKingX card: his brawler sheet as a monster-format bank
  D.monsters.omega = { imgs: ['assets/omega.png'], frames: S.body.frames, anims: { idle: A2.idle, walk: A2.walk, attack: A2.atk1, hurt: A2.hurt, die: A2.down }, h: 28 }; }
SPECIES.merc = { name: 'Rent Mercenary', hp: 90, dmg: 10, spd: 66, sig: 'brutal', spell: { n: 'Debt Collector', a: 'dash', el: 'earth', fx: FX.SPIKE, icon: 19 } };
// the Dojo Master's own technique (dojo.js): charge up, then a huge piercing beam — the only way to get it is beating him
SPECIES.spiritcannon = { name: 'Spirit Cannon', arcana: true, ki: true, sig: 'brutal', trait: 'Spirit Focus', spell: { n: 'Spirit Cannon', a: 'beam', el: 'lightning', fx: FX.BEAM, icon: 31, vfx: 'kb_charge', art: 'kb_charge', sx: 'cannon', cd: 9000, mp: 40, d: 'Gather your spirit — hold to charge, up to 3 s and ×2 power — then unleash a sky-splitting beam of pure energy' } };
SPECIES.omega = { name: 'OmegaKingX', hp: 150, dmg: 12, spd: 72, sig: 'crit', spell: { n: "King's Legion", a: 'nova', el: 'holy', fx: FX.HOLY, icon: 31, sx: 'legion', cd: 60000, mp: 40, d: 'Summons 5 random monsters to fight for you for 20 s' } };
const SPECIES_IDS = Object.keys(SPECIES).filter(id => D.monsters[id]);
// ---- Arcana: pure spell cards, no monster behind them. Art and casting animation are the effect `vfx` from
// assets/spell_fx.png (tools/build_spell_fx.py, from the effect pack). Three per element; they come from Summons,
// treasure chests and black-hole hoards. fx is the old effect used only if the atlas is missing.
const ARCANA = {
  sc01: ['Solar Flare',      'nova',   'fire',      'brutal', FX.EXPLODE],   sc02: ['Comet Flare',     'bolt',   'fire',      'burst',  FX.FLAME],
  sc03: ['Phoenix Spire',    'pillar', 'fire',      'brutal', FX.FLAME],     sc04: ['Frost Halo',      'nova',   'ice',       'frost',  FX.ICE],
  sc05: ['Glacial Lance',    'bolt',   'ice',       'frost',  FX.ICE],       sc06: ['Shard Storm',     'rain',   'ice',       'barrier', FX.ICE],
  sc07: ['Storm Crown',      'nova',   'lightning', 'frenzy', FX.LIGHTNING], sc08: ['Thunder Spear',   'bolt',   'lightning', 'crit',   FX.LIGHTNING],
  sc09: ['Sky Rend',         'rain',   'lightning', 'frenzy', FX.LIGHTNING], sc10: ['Stone Bloom',     'nova',   'earth',     'hide',   FX.ROCKS],
  sc11: ['Fault Line',       'quake',  'earth',     'unstop', FX.SPIKE],     sc12: ['Earth Spike',     'pillar', 'earth',     'hide',   FX.SPIKE],
  sc13: ['Gale Wheel',       'nova',   'wind',      'swift',  FX.WIND],      sc14: ['Cyclone Edge',    'beam',   'wind',      'evade',  FX.WIND],
  sc15: ['Blade Squall',     'rain',   'wind',      'swift',  FX.WIND],      sc16: ["Death's Grin",    'pillar', 'dark',      'vamp',   FX.VORTEX],
  sc17: ['Shadow Crescent',  'bolt',   'dark',      'last',   FX.VORTEX],    sc18: ['Thorn Halo',      'nova',   'dark',      'thorns', FX.VORTEX],
  sc19: ['Venom Bloom',      'nova',   'poison',    'venom',  FX.ROCKS],     sc20: ['Miasma',          'rain',   'poison',    'venom',  FX.ROCKS],
  sc21: ['Toxic Fang',       'beam',   'poison',    'regen',  FX.BEAM],      sc22: ['Sacred Lotus',    'nova',   'holy',      'regen',  FX.HOLY],
  sc23: ['Judgment Star',    'rain',   'holy',      'mana',   FX.HOLY],      sc24: ['Halo Orb',        'pillar', 'holy',      'barrier', FX.HOLY],
};
// Spellcraft Arcana: made from the Elemental Spellcraft pack (tools/build_spellcraft.py). Each has its own effects:
// vfx = what flies or bursts, burst = where a bolt lands, cast = the flourish at the caster's feet, art = the card art.
const EX = (el, kind) => `ex_${el}_${kind}`;
const exBolt = el => ({ vfx: EX(el, 'projectile'), burst: EX(el, 'impact_small'), cast: EX(el, 'cast'), art: EX(el, 'impact_large') });
const exBig = (el, vfx) => ({ vfx: vfx || EX(el, 'impact_large'), cast: EX(el, 'cast') });
Object.assign(ARCANA, {
  ec01: ['Ember Lance',      'bolt',   'fire',      'brutal',  FX.FLAME,     exBolt('fire')],
  ec02: ['Meteor Fall',      'rain',   'fire',      'burst',   FX.EXPLODE,   exBig('fire', 'ex_meteor_strike')],
  ec03: ['Frost Needle',     'bolt',   'ice',       'frost',   FX.ICE,       exBolt('ice')],
  ec04: ['Glacier Burst',    'nova',   'ice',       'hide',    FX.ICE,       exBig('ice')],
  ec05: ['Volt Arrow',       'bolt',   'lightning', 'crit',    FX.LIGHTNING, exBolt('lightning')],
  ec06: ['Thunderclap',      'pillar', 'lightning', 'frenzy',  FX.LIGHTNING, exBig('lightning')],
  ec07: ['Tide Orb',         'bolt',   'ice',       'mana',    FX.ICE,       exBolt('water')],
  ec08: ['Riptide Crash',    'nova',   'ice',       'regen',   FX.ICE,       exBig('water')],
  ec09: ['Boulder Toss',     'bolt',   'earth',     'unstop',  FX.ROCKS,     exBolt('earth')],
  ec10: ['Landslide',        'quake',  'earth',     'hide',    FX.SPIKE,     exBig('earth', 'ex_earth_impact_small')],
  ec11: ['Gale Dart',        'bolt',   'wind',      'swift',   FX.WIND,      exBolt('wind')],
  ec12: ['Tempest Ring',     'nova',   'wind',      'evade',   FX.WIND,      exBig('wind')],
  ec13: ['Void Shard',       'bolt',   'dark',      'vamp',    FX.VORTEX,    exBolt('dark')],
  ec14: ['Abyss Bloom',      'pillar', 'dark',      'last',    FX.VORTEX,    exBig('dark')],
  ec15: ['Venom Spit',       'bolt',   'poison',    'venom',   FX.ROCKS,     exBolt('poison')],
  ec16: ['Plague Rain',      'rain',   'poison',    'venom',   FX.ROCKS,     exBig('poison', 'ex_poison_impact_small')],
  ec17: ['Radiant Arrow',    'bolt',   'holy',      'regen',   FX.HOLY,      exBolt('holy')],
  ec18: ['Ascension Pillar', 'pillar', 'holy',      'barrier', FX.HOLY,      exBig('holy', 'ex_level_up_pillar')],
  ec19: ['Arcane Missile',   'bolt',   'dark',      'mana',    FX.VORTEX,    exBolt('arcane')],
  ec20: ['Rune Nova',        'nova',   'dark',      'thorns',  FX.VORTEX,    exBig('arcane')],
});
for (const [id, [n, a, el, sig, fx, o]] of Object.entries(ARCANA)) SPECIES[id] = { name: n, arcana: true, sig, spell: Object.assign({ n, a, el, fx, icon: 31, vfx: id }, o) };
// ---- NPC cards: every villager (npc sprites 100–126 and the townsfolk of folk.js) is a card too. Art is the NPC's own sprite;
// a 'summon' spell calls the NPC in. They come from Summons and treasure chests.
const NPC_CARDS = {
  n100: ['100', 'Loyal Hound',       'swift',   'Faithful Paws',    ['Fetch Rush',        'dash',   'wind',      FX.WIND]],
  n101: ['101', 'Mira the Wanderer', 'evade',   'Wayfarer\'s Step', ['Wind Waltz',        'nova',   'wind',      FX.WIND]],
  n102: ['102', 'Tinker Pip',        'burst',   'Spare Parts',      ['Gadget Blast',      'bolt',   'fire',      FX.EXPLODE]],
  n103: ['103', 'Farmhand Tom',      'regen',   'Hearty Harvest',   ['Hay Toss',          'rain',   'earth',     FX.ROCKS]],
  n104: ['104', 'Blacksmith Brann',  'hide',    'Forged Skin',      ['Forge Hammer',      'quake',  'fire',      FX.FLAME]],
  n105: ['105', 'Gate Warden',       'barrier', 'Gatekeeper',       ['Warden\'s Wall',    'nova',   'earth',     FX.ROCKS]],
  n106: ['106', 'Archivist Lena',    'mana',    'Endless Ink',      ['Ink Bolt',          'bolt',   'dark',      FX.VORTEX]],
  n107: ['107', 'Village Elder',     'last',    'Old Wisdom',       ['Elder\'s Blessing', 'pillar', 'holy',      FX.HOLY]],
  n108: ['108', 'Granny Mae',        'regen',   'Grandma\'s Soup',  ['Hearth Prayer',     'nova',   'holy',      FX.HOLY]],
  n109: ['109', 'Scamp Toby',        'swift',   'Quick Feet',       ['Pebble Sling',      'bolt',   'earth',     FX.ROCKS]],
  n110: ['110', 'Little Rosa',       'evade',   'Hide and Seek',    ['Petal Toss',        'rain',   'wind',      FX.WIND]],
  n111: ['111', 'Guild Master Vance', 'crit',   'Hunter\'s Eye',    ['Hunter\'s Verdict', 'beam',   'lightning', FX.BEAM]],
  n112: ['112', 'Ranger Faye',       'crit',    'Keen Feather',     ['Feather Volley',    'rain',   'wind',      FX.WIND]],
  n113: ['113', 'Merchant Otto',     'brutal',  'Hard Bargain',     ['Coin Barrage',      'bolt',   'holy',      FX.BEAM]],
  n114: ['114', 'Priestess Sera',    'barrier', 'Moonlit Grace',    ['Moon Veil',         'pillar', 'holy',      FX.HOLY]],
  n115: ['115', 'Monk Bao',          'unstop',  'Iron Stance',      ['Palm Strike',       'dash',   'earth',     FX.SPIKE]],
  n116: ['116', 'Grocer Peony',      'regen',   'Fresh Produce',    ['Spice Bomb',        'nova',   'fire',      FX.EXPLODE]],
  n117: ['117', 'Sister Agnes',      'barrier', 'Holy Vow',         ['Sanctuary',         'nova',   'holy',      FX.HOLY]],
  n118: ['118', 'Old Mariner',       'frost',   'Sea Salt',         ['Tidal Hook',        'beam',   'ice',       FX.ICE]],
  n119: ['119', 'Dancer Lulu',       'frenzy',  'Twirl Rhythm',     ['Twirl Step',        'dash',   'wind',      FX.WIND]],
  n120: ['120', 'Card Oracle',       'mana',    'Fortune\'s Favor', ['Fortune\'s Draw',   'summon', 'dark',      FX.VORTEX]],
  n121: ['121', 'Squire Rowan',      'hide',    'Oath Shield',      ['Shield Wall',       'quake',  'holy',      FX.ROCKS]],
  n122: ['122', 'Stylist Coco',      'swift',   'Runway Strut',     ['Glam Flash',        'beam',   'lightning', FX.LIGHTNING]],
  n123: ['123', 'Altar Keeper',      'burst',   'Fusion Rite',      ['Altar Flame',       'summon', 'holy',      FX.HOLY]],
  n124: ['124', 'Hermit Grumm',      'venom',   'Bitter Herbs',     ['Herbal Brew',       'bolt',   'poison',    FX.STORM]],
  n125: ['125', 'Weaver Ilse',       'thorns',  'Needle Thread',    ['Needle Rain',       'rain',   'earth',     FX.SPIKE]],
  n126: ['126', 'Veteran Kord',      'last',    'Old Scars',        ['War Cry',           'nova',   'lightning', FX.LIGHTNING]],
  // the townsfolk of folk.js
  n127: ['127', 'Lady Mirabel',      'evade',   'Summer Grace',     ['Parasol Twirl',     'dash',   'wind',      FX.WIND]],
  n128: ['128', 'Black Varg',        'brutal',  'Town Smile',       ['Black Sundering',   'quake',  'dark',      FX.VORTEX]],
  n129: ['129', 'Blue Puff',         'swift',   'Bob and Weave',    ['Puff Bounce',       'bolt',   'ice',       FX.ICE]],
  n130: ['130', 'Red Puff',          'frenzy',  'Pleased Roll',     ['Puff Roll',         'dash',   'fire',      FX.FLAME]],
  n131: ['131', 'Golden Paladin',    'barrier', 'Long March',       ['Golden Oath',       'pillar', 'holy',      FX.HOLY]],
  n133: ['133', 'Rug Seller Anzo',   'mana',    'Finest Weave',     ['Rug Pull',          'quake',  'wind',      FX.WIND]],
  n134: ['134', 'Madame Rosette',    'last',    'Twice Widowed',    ['Hat Trick',         'bolt',   'dark',      FX.VORTEX]],
  n135: ['135', 'Cook Marrow',       'regen',   'Secret Recipe',    ['Boiling Ladle',     'rain',   'fire',      FX.EXPLODE]],
  n136: ['136', 'The Hooded One',    'evade',   'Hm.',              ['Quiet Word',        'beam',   'dark',      FX.VORTEX]],
  n137: ['137', 'Sandpiper',         'unstop',  'Long Chew',        ['Sand Spit',         'rain',   'earth',     FX.ROCKS]],
  nz044: ['z044', 'Far-Walker',      'swift',   'Every Road',       ['Long Stride',       'dash',   'earth',     FX.ROCKS]],
  nz045: ['z045', 'Big Rusk',        'brutal',  'Anvil Arms',       ['Anvil Toss',        'quake',  'earth',     FX.ROCKS]],
  nz046: ['z046', 'Doctor Grey',     'regen',   'Bedside Manner',   ['Cold Compress',     'nova',   'ice',       FX.ICE]],
  nz047: ['z047', 'Bramble',         'thorns',  'Bee Stings',       ['Honey Swarm',       'rain',   'poison',    FX.STORM]],
  nz048: ['z048', 'Sunny Wick',      'evade',   'Crow Guessing',    ['Scarecrow Dance',   'nova',   'wind',      FX.WIND]],
  nz049: ['z049', 'Biscuit',         'swift',   'Pocket Sniffer',   ['Bread Dash',        'dash',   'wind',      FX.WIND]],
  nz056: ['z056', 'High Priest Oros', 'mana',   'Last Fire\'s Word', ['Answered Prayer',   'pillar', 'holy',      FX.HOLY]],
  nz074: ['z074', 'Old Zephon',      'mana',    'Star Reader',      ['Falling Star',      'rain',   'lightning', FX.LIGHTNING]],
  nz075: ['z075', 'Knight Commander Aurel', 'barrier', 'Hold the Pass', ['Commander\'s Charge', 'dash', 'holy',    FX.HOLY]],
  nz077: ['z077', 'Bluecap',         'burst',   'Poor Aim',         ['Wild Bolt',         'bolt',   'lightning', FX.LIGHTNING]],
  nz078: ['z078', 'Little Cherub',   'regen',   'Warm Thoughts',    ['Tiny Halo',         'nova',   'holy',      FX.HOLY]],
  nz079: ['z079', 'Sentry Garr',     'hide',    'Who Goes There',   ['Pike Thrust',       'beam',   'earth',     FX.SPIKE]],
  nz080: ['z080', 'Saint Elric',     'last',    'Not Taken Personally', ['Second Rising',  'pillar', 'holy',      FX.HOLY]],
  nz081: ['z081', 'Seraphine',       'regen',   'Rest Your Feet',   ['Wingbeat',          'nova',   'wind',      FX.WIND]],
  nz082: ['z082', 'Nightshade',      'crit',    'You Did Not See',  ['Unseen Blade',      'dash',   'dark',      FX.VORTEX]],
  nz083: ['z083', 'Snowhood',        'hide',    'Third Scarf',      ['Snow Flurry',       'rain',   'ice',       FX.ICE]],
  nz084: ['z084', 'Shade',           'crit',    'Quiet Step',       ['Debt Collector',    'bolt',   'dark',      FX.VORTEX]],
  nz085: ['z085', 'Goggles',         'burst',   'Engine Talk',      ['Spanner Spark',     'bolt',   'lightning', FX.LIGHTNING]],
  nz086: ['z086', 'Professor Thule', 'frost',   'Forty Years Notes', ['Glacial Lecture',  'beam',   'ice',       FX.ICE]],
  nz087: ['z087', 'Lily of the Sprouts', 'regen', 'Grow Toward Kindness', ['Petal Bloom', 'nova',   'earth',     FX.SPIKE]],
  nz088: ['z088', 'Sister Ivy',      'barrier', 'Seed Blessing',    ['Ivy Vow',           'pillar', 'earth',     FX.SPIKE]],
  nz089: ['z089', 'Farmer Gus',      'regen',   'Knee Forecast',    ['Thursday Rain',     'rain',   'ice',       FX.ICE]],
  nz090: ['z090', 'Digger Holt',     'hide',    'Deep Digger',      ['Boot Dig',          'quake',  'earth',     FX.ROCKS]],
  nz091: ['z091', 'Engineer Bolt',   'hide',    'No Door',          ['Piston Slam',       'quake',  'lightning', FX.LIGHTNING]],
  nz092: ['z092', 'Frost Puff',      'frost',   'Happy Shiver',     ['Shiver Bounce',     'bolt',   'ice',       FX.ICE]],
  nz093: ['z093', 'Ember Puff',      'burst',   'Lantern Glow',     ['Glow Pop',          'bolt',   'fire',      FX.EXPLODE]],
  nz094: ['z094', 'Moss Puff',       'venom',   'Tiny Bubbles',     ['Bubble Burst',      'nova',   'poison',    FX.STORM]],
  nz096: ['z096', 'Turnip',          'thorns',  'Leaf Pull',        ['Root Whip',         'beam',   'earth',     FX.SPIKE]],
  nz097: ['z097', 'Radish',          'venom',   'Choices Made',     ['Hot Radish',        'bolt',   'poison',    FX.STORM]],
  nz098: ['z098', 'Gunner Mokk',     'brutal',  'Never Missed',     ['Cannon Shot',       'beam',   'fire',      FX.EXPLODE]],
  nz099: ['z099', 'Bluebird',        'swift',   'Crumb Hunter',     ['Wing Flick',        'dash',   'wind',      FX.WIND]],
  nz101: ['z101', 'Dash',            'swift',   'Most of the Way',  ['Sprint Out',        'dash',   'lightning', FX.LIGHTNING]],
  nz102: ['z102', 'Tobin',           'frenzy',  'It Counts',        ['Stick Swing',       'dash',   'earth',     FX.ROCKS]],
  nz103: ['z103', 'Kit',             'crit',    'It Does Not Count', ['Sharp Remark',     'bolt',   'wind',      FX.WIND]],
  nz104: ['z104', 'Sage Ulmar',      'mana',    'Kindest Snow',     ['Forgetting Snow',   'rain',   'ice',       FX.ICE]],
  nz105: ['z105', 'Old Barnaby',     'last',    'Sixty Years',      ['Fountain Wish',     'nova',   'holy',      FX.HOLY]],
  nz106: ['z106', 'Clerk Ambrose',   'barrier', 'Blocking the Ledger', ['Red Tape',       'beam',   'earth',     FX.ROCKS]],
  nz107: ['z107', 'Mayor Aldous',    'mana',    'Town Welcome',     ['Public Address',    'nova',   'lightning', FX.LIGHTNING]],
  nz108: ['z108', 'Baron Vane',      'brutal',  'An Announcement',  ['Cape Sweep',        'dash',   'dark',      FX.VORTEX]],
  nz109: ['z109', 'Mara of the Veil', 'evade',  'Locked Doors',     ['Veil Fall',         'nova',   'dark',      FX.VORTEX]],
  nz110: ['z110', 'Silas Greymantle', 'venom',  'Who Owes Whom',    ['Calling In',        'bolt',   'poison',    FX.STORM]],
  nz111: ['z111', 'Corbin',          'crit',    'It Was a Chicken', ['Blind Swipe',       'dash',   'dark',      FX.VORTEX]],
  nz112: ['z112', 'Uncle Wen',       'regen',   'Moved On to Knees', ['Knee Crack',       'quake',  'earth',     FX.ROCKS]],
  nz113: ['z113', 'Young Rhys',      'frenzy',  'First Verse',      ['Rising Song',       'beam',   'lightning', FX.BEAM]],
  nz116: ['z116', 'Sergeant Horne',  'unstop',  'Hold Your Line',   ['Line Breaker',      'quake',  'earth',     FX.ROCKS]],
  nz117: ['z117', 'Wulf Twin-Blade', 'frenzy',  'Lonely Sword',     ['Twin Cut',          'dash',   'lightning', FX.LIGHTNING]],
  nz118: ['z118', 'Archmage Nocturne', 'mana',  'Ninety Years',     ['It Looks Back',     'summon', 'dark',      FX.VORTEX]],
  nz119: ['z119', 'Nell',            'evade',   'Lost Farmer',      ['Skipping Stone',    'bolt',   'wind',      FX.WIND]],
};
for (const [id, [npc, name, sig, trait, [n, a, el, fx]]] of Object.entries(NPC_CARDS)) SPECIES[id] = { name, npc, sig, trait, spell: { n, a, el, fx, icon: 31 } };
const NPC_CARD_IDS = Object.keys(NPC_CARDS);
// Every monster's signature passive has its own name (the same passive it fights with in the Wilds — its card
// carries it): the effect is the PASSIVES entry, the name is the creature's.
const TRAITS = {
  '001': 'Behemoth Fury', '002': 'Burrowed Hide', '003': 'Plume Dodge', '004': 'Soul Siphon', '005': 'Rime Carapace',
  '006': 'Gooey Mend', '007': 'Lupine Fang', '008': 'Bramble Skin', '009': 'Static Rush', '010': 'Magma Shell',
  '011': 'Night Bite', '012': 'Phantom Edge', '013': 'Third Eye', '014': 'Granite Body', '016': 'Ancestral Aegis',
  '017': 'Cursed Edge', '018': 'Djinn Chill', '019': 'Orc Blood', '020': 'Jester\'s Trick', '021': 'Abyssal Plate',
  '022': 'Witch Sigil', '023': 'Wraith Veil', '024': 'Wyvern Pyre', '025': 'Sentinel Bulwark', '026': 'Colossus Spines',
  '027': 'Royal Plate', '028': 'Sage Toxin', '029': 'Leaf Glide', '030': 'Banner Blast',
  '201': 'Orc Rage', '202': 'Soldier Drill', '203': 'Lime Jelly', '204': 'Scout Hop', '205': 'Plush Belly',
  '207': 'Iron Horns', '208': 'Bark Ward', '209': 'Scaled Guard', '210': 'Toxic Sap', '211': 'Kaboom',
  '214': 'Slobber Grudge', '216': 'Wildfire Heart', '217': 'Sandstone Skin', '219': 'Saleck Blink', '221': 'Blood Thirst',
  '222': 'Lava Crust', '223': 'Stinger', '226': 'Shati Fur', '232': 'Jelly Chill', '234': 'Mummy Wraps',
  '239': 'Mantis Scythe', '241': 'Sun Aegis', '243': 'Prism Core', merc: 'Hired Blade', omega: 'Sovereign Will',
};
for (const [id, t] of Object.entries(TRAITS)) if (SPECIES[id]) SPECIES[id].trait = t;
// MORE CARDS (2026-11-18, the user's goal of 1000 cards; they chose "real art + 2 variant kinds"). Zenonia's monster art is all in use,
// so these come from (1) the heroes, (2) Zenonia 2's last five character sprites (tools/build_extra_npcs2.py) and (3) two variants of
// every regular monster: ELITE (its gold-rimmed captain: 30% tougher, its skill a step up in kind, e.g. a dash becomes a beam; dropped by elite foes, foeelite.js) and
// GIANT (a huge, differently coloured kin: much tougher and slower, a heavy ground skill, dropped by the side areas' Alphas).
// A variant shares its monster's sprite (D.monsters[vid] is the same bank) and is told apart by SPECIES[vid].variant (morecards.js
// draws the gold rim or the giant's colours and size).
const HERO_CARDS = {
  h00: [0, 'Berserker', 'brutal', 'Battle Frenzy', ['Cleaving Rage', 'dash', 'fire', FX.FLAME]],
  h01: [1, 'Paladin', 'barrier', 'Holy Oath', ['Judgement', 'pillar', 'holy', FX.HOLY]],
  h02: [2, 'Assassin', 'crit', 'Silent Step', ['Shadow Fang', 'dash', 'dark', FX.VORTEX]],
  h03: [3, 'Mage', 'mana', 'Arcane Study', ['Firestorm', 'rain', 'fire', FX.METEOR]],
  h04: [4, 'Summoner', 'mana', 'Pact Keeper', ['Call of Beasts', 'summon', 'earth', FX.ROCKS]],
  h05: [5, 'Martial Artist', 'frenzy', 'Iron Body', ['Hundred Fists', 'nova', 'wind', FX.WIND]],
  h06: [6, 'Lu', 'barrier', 'Holy Knight', ['Sacred Blade', 'beam', 'holy', FX.BEAM]],
  h07: [7, 'Ecne', 'burst', 'Shooter', ['Rocket Barrage', 'rain', 'fire', FX.EXPLODE]],
  h08: [8, 'Morpice', 'frost', 'Magician', ['Frost Nova', 'nova', 'ice', FX.ICE]],
  h09: [9, 'Daza', 'unstop', 'Warrior', ['Earth Splitter', 'quake', 'earth', FX.ROCKS]],
  h10: [10, 'Iron Sentinel', 'hide', 'Monster Knight', ['Iron Charge', 'dash', 'earth', FX.SPIKE]],
  h11: [11, 'Chef Daddy', 'regen', 'Head Chef', ['Flambe', 'nova', 'fire', FX.FLAME]],
  h12: [12, 'OmegaKingX', 'brutal', 'Brawler', ['King Strike', 'dash', 'lightning', FX.LIGHTNING]],
  h13: [13, 'Archer', 'swift', 'Ranger', ['Arrow Rain', 'rain', 'wind', FX.WIND]],
};
for (const [id, [cls, name, sig, trait, [n, a, el, fx]]] of Object.entries(HERO_CARDS)) SPECIES[id] = { name, hero: cls, sig, trait, spell: { n, a, el, fx, icon: 31 } };
const NPC_CARDS2 = {
  nz067: ['z067', 'Hunter Hask', 'crit', 'Patient Aim', ['Long Shot', 'beam', 'wind', FX.WIND]],
  nz068: ['z068', 'Strongman Brok', 'brutal', 'Twelve Barrels', ['Barrel Toss', 'quake', 'earth', FX.ROCKS]],
  nz069: ['z069', 'Scholar Pell', 'mana', 'Footnotes', ['Ink Storm', 'rain', 'dark', FX.VORTEX]],
  nz070: ['z070', 'Fern', 'regen', 'Green Thumbs', ['Sprout Burst', 'nova', 'poison', FX.STORM]],
  nz071: ['z071', 'Farmer Tuck', 'hide', 'Good Hat', ['Pitchfork Toss', 'bolt', 'earth', FX.SPIKE]],
};
for (const [id, [npc, name, sig, trait, [n, a, el, fx]]] of Object.entries(NPC_CARDS2)) if (D.npcs[npc]) { SPECIES[id] = { name, npc, sig, trait, spell: { n, a, el, fx, icon: 31 } }; NPC_CARDS[id] = NPC_CARDS2[id]; }
NPC_CARD_IDS.push(...Object.keys(NPC_CARDS2).filter(id => SPECIES[id]), ...Object.keys(HERO_CARDS).filter(id => SPECIES[id]));   // (summons and chests give them, like townsfolk)
// (2026-11-18, the user: "yes, add more"): eleven more kinds, so every regular monster has 13 versions and the game passes 1000 cards.
// The eight ELEMENT kinds turn the monster's skill to their element (a monster already of that element moves its skill a step up
// instead); ANCIENT, LITTLE and CRYSTAL keep the element. These appear in the Wilds themselves (morecards.js: a few of a zone's spawns
// come as one of that zone's kinds) and drop their own cards. pfx: the id prefix; alt: the word used when the monster's name has pre.
const VARIANT_UP = { bolt: 'beam', beam: 'pillar', nova: 'rain', rain: 'nova', dash: 'beam', pillar: 'quake', quake: 'pillar', summon: 'nova', ultimate: 'ultimate' };
const VARIANT = {
  elite: { pfx: 'el_', pre: 'Elite', spellPre: 'Gilded', hp: 1.3, dmg: 1.3, spd: 1, up: VARIANT_UP },
  giant: { pfx: 'gi_', pre: 'Giant', spellPre: 'Colossal', hp: 1.8, dmg: 1.4, spd: 0.8, up: { bolt: 'quake', beam: 'quake', dash: 'quake', nova: 'quake', rain: 'pillar', pillar: 'quake', quake: 'nova', summon: 'quake', ultimate: 'ultimate' } },
  frost: { pfx: 'fr_', pre: 'Frost', alt: 'Rime', spellPre: 'Frozen', el: 'ice', hp: 1.1, dmg: 1.05, spd: 0.95 },
  ember: { pfx: 'em_', pre: 'Ember', alt: 'Cinder', spellPre: 'Blazing', el: 'fire', hp: 1.05, dmg: 1.15, spd: 1 },
  venom: { pfx: 'vn_', pre: 'Venom', alt: 'Blight', spellPre: 'Toxic', el: 'poison', hp: 1.05, dmg: 1.1, spd: 1 },
  storm: { pfx: 'st_', pre: 'Storm', alt: 'Thunder', spellPre: 'Crackling', el: 'lightning', hp: 1, dmg: 1.1, spd: 1.1 },
  shadow: { pfx: 'sh_', pre: 'Shadow', alt: 'Umbral', spellPre: 'Umbral', el: 'dark', hp: 1.05, dmg: 1.15, spd: 1.05 },
  radiant: { pfx: 'ra_', pre: 'Radiant', alt: 'Halo', spellPre: 'Shining', el: 'holy', hp: 1.15, dmg: 1.05, spd: 1 },
  stone: { pfx: 'so_', pre: 'Stone', alt: 'Granite', spellPre: 'Granite', el: 'earth', hp: 1.3, dmg: 1.05, spd: 0.85 },
  gale: { pfx: 'ga_', pre: 'Gale', alt: 'Zephyr', spellPre: 'Whirling', el: 'wind', hp: 0.95, dmg: 1.05, spd: 1.2 },
  ancient: { pfx: 'an_', pre: 'Ancient', alt: 'Elder', spellPre: 'Elder', hp: 1.5, dmg: 1.25, spd: 0.9, up: VARIANT_UP },
  little: { pfx: 'li_', pre: 'Little', alt: 'Tiny', spellPre: 'Tiny', hp: 0.7, dmg: 0.8, spd: 1.25 },
  crystal: { pfx: 'cr_', pre: 'Crystal', alt: 'Prism', spellPre: 'Prismatic', hp: 1.2, dmg: 1.1, spd: 1, up: { bolt: 'rain', beam: 'nova', nova: 'beam', rain: 'bolt', dash: 'nova', pillar: 'beam', quake: 'rain', summon: 'beam', ultimate: 'ultimate' } },
};
const VARIANT_IDS = [];
for (const id of Object.keys(SPECIES).sort()) {
  const S = SPECIES[id];
  if (!D.monsters[id] || S.npc || S.arcana || S.chef || S.ki || S.variant || /^r/.test(id) || id === 'merc' || id === 'omega' || !S.spell) continue;
  for (const [kind, V] of Object.entries(VARIANT)) {
    const el = V.el || S.spell.el, same = V.el && V.el === S.spell.el, a = V.up ? V.up[S.spell.a] || S.spell.a : same ? VARIANT_UP[S.spell.a] || S.spell.a : S.spell.a;
    const word = V.alt && new RegExp(`\b${V.pre}\b`, 'i').test(S.name) ? V.alt : V.pre;
    const vid = V.pfx + id, sp = { ...S.spell, n: `${V.spellPre} ${S.spell.n.replace(new RegExp(`^${V.spellPre} `), '')}`, a, el };
    delete sp.accent; delete sp.accentPair;
    SPECIES[vid] = { ...S, name: `${word} ${S.name}`, hp: Math.round((S.hp || 30) * V.hp), dmg: Math.round((S.dmg || 5) * V.dmg), spd: Math.round((S.spd || 40) * V.spd), variant: kind, base: id, spell: sp };
    D.monsters[vid] = D.monsters[id]; VARIANT_IDS.push(vid);
  }
}
// the sprite a card's character is drawn with: its monster bank, or its NPC bank (Arcana and Chef cards have none)
const charBank = sp => D.monsters[sp] || (SPECIES[sp] && SPECIES[sp].npc && D.npcs[SPECIES[sp].npc]) || null;
// a passive's display name: the character's own trait name when it has one
const passiveName = p => p.trait || PASSIVES[p.id].name;
// Every card skill is its own: besides its name, archetype and element, each gets a TWIST (something extra it does)
// and its own look (which of its element's effects it plays, a shade of the colour and a size). Cards that share an
// archetype and an element always differ in twist, effect and shade, so no two skills look or work the same.
const TWISTS = {
  echo:   { name: 'Echo',       d: 'strikes the spot again a moment later (40%)' },
  chain:  { name: 'Chain',      d: 'arcs to two more foes nearby (50%)' },
  vortex: { name: 'Vortex',     d: 'drags nearby foes into the blast' },
  shatter:{ name: 'Shatter',    d: 'cracks armour: +25% damage taken for 4s' },
  drain:  { name: 'Drain',      d: 'heals you for 20% of the damage' },
  chill:  { name: 'Chill',      d: 'slows foes it hits for 1.5s' },
  stagger:{ name: 'Stagger',    d: 'knocks foes far back and stuns them' },
  scatter:{ name: 'Scatter',    d: 'three smaller blasts burst around the target' },
  ward:   { name: 'Ward',       d: 'shields you for 10% of your max HP' },
  haste:  { name: 'Haste',      d: '+25% move speed for 3s' },
  refund: { name: 'Refund',     d: 'gives back 40% of its MP' },
  keen:   { name: 'Keen',       d: '+40% chance to crit' },
  blaze:  { name: 'Lingering',  d: 'leaves a field that keeps hitting for 1.5s' },
};
// SUPPORT CARDS: ten kinds of heal and buff with ten cards each, weakest and cheapest first, the best worth a long wait. They use a spell
// slot like any card and go on the hero (combat.js supportCast). A buff is a timed addition to one of the hero's passives; rank adds 10% a step.
//   name of the kind · element · the passive (or `now`: at once) · base amount · how it reads · the signature passive on the card · the cards
const SUPPORT = {
  heal:   { label: 'Heal', el: 'holy', now: 'hp', base: 30, sig: 'regen', fmt: v => `Restores ${v}% of your max HP`, names: ['Mending Light', 'Field Dressing', 'Second Wind', 'Sunlit Balm', "Healer's Touch", 'Dawn Prayer', 'Spring Water', "Angel's Breath", 'Phoenix Tear', 'Full Restoration'] },
  regen:  { label: 'Regeneration', el: 'poison', k: 'regen', base: 1, sign: '', unit: '%/s', sig: 'regen', fmt: (v, s) => `Heal ${v}% of your max HP a second for ${s} s`, names: ['Slow Mending', 'Moss Poultice', 'Rooted Vigor', 'Green Pulse', 'Forest Breath', 'Herbal Wrap', 'Verdant Tide', 'Evergreen', 'Heartwood', "World Tree's Sap"] },
  power:  { label: 'Attack', el: 'fire', k: 'brutal', base: 40, sig: 'brutal', fmt: (v, s) => `+${v}% damage for ${s} s`, names: ['Battle Cry', 'Rage Spark', 'Blood Drum', 'War Paint', 'Burning Resolve', "Giant's Grip", 'Red Mist', 'Titan Strength', 'Berserk Heart', 'Wrath of Kings'] },
  guard:  { label: 'Defence', el: 'earth', k: 'hide', base: 25, sign: '-', sig: 'hide', fmt: (v, s) => `-${v}% damage taken for ${s} s`, names: ['Stone Skin', 'Iron Stance', 'Brace', 'Bark Hide', 'Turtle Shell', 'Granite Guard', "Mountain's Patience", "Knight's Oath", 'Adamant Body', 'Unbroken'] },
  speed:  { label: 'Speed', el: 'wind', k: 'swift', base: 30, sig: 'swift', fmt: (v, s) => `+${v}% move speed for ${s} s`, names: ['Light Feet', 'Tailwind', 'Quickstep', 'Gale Boots', "Hare's Dash", 'Swift Current', 'Wind Rider', 'Slipstream', 'Storm Runner', 'Lightning Legs'] },
  fury:   { label: 'Attack Speed', el: 'lightning', k: 'frenzy', base: 30, sig: 'frenzy', fmt: (v, s) => `+${v}% attack speed for ${s} s`, names: ['Quick Hands', 'Sparking Nerves', 'Flurry', 'Rapid Blows', 'Static Charge', 'Thunder Pulse', 'Hundred Cuts', 'Frenzied Dance', 'Storm of Steel', 'Blur of Blades'] },
  crit:   { label: 'Critical', el: 'dark', k: 'crit', base: 30, sig: 'crit', fmt: (v, s) => `+${v}% crit chance for ${s} s`, names: ['Keen Sight', 'Hawk Eye', 'Steady Aim', 'Weak Point', 'Killer Instinct', 'Deadly Focus', "Sniper's Calm", 'Fatal Mark', "Assassin's Eye", 'Eye of the Reaper'] },
  dodge:  { label: 'Dodge', el: 'wind', k: 'evade', base: 25, sig: 'evade', fmt: (v, s) => `+${v}% dodge for ${s} s`, names: ['Side Step', 'Shadow Step', 'Smoke Veil', 'Blink Stance', 'Ghost Walk', 'Mist Form', 'Phantom Dance', 'Mirror Image', 'Vanishing Act', 'Untouchable'] },
  shield: { label: 'Shield', el: 'ice', now: 'shield', base: 25, sign: '', sig: 'barrier', fmt: v => `A shield worth ${v}% of your max HP`, names: ['Frost Ward', 'Ice Barrier', 'Glass Aegis', 'Crystal Shell', 'Winter Wall', 'Snow Mantle', 'Prism Guard', 'Glacier Plate', 'Diamond Dome', 'Eternal Winter'] },
  mana:   { label: 'Mana', el: 'holy', now: 'mp', base: 40, sig: 'mana', fmt: v => `Restores ${v}% of your max MP`, names: ['Mana Sip', 'Spirit Well', 'Clear Mind', 'Deep Breath', 'Moon Water', 'Starlit Thought', 'Arcane Font', "Sage's Calm", 'Ocean of Mind', 'Infinite Well'] },
};
// the ten steps: strength, seconds, MP, cooldown in seconds, and what comes with it on some
const SUPPORT_STEPS = [[0.5, 8, 8, 10], [0.6, 10, 10, 12], [0.7, 12, 12, 14], [0.8, 10, 14, 14, { shield: 8 }], [0.9, 14, 16, 16], [1, 12, 18, 18, { hp: 10 }], [1.1, 16, 20, 20], [1.25, 10, 24, 22, { mp: 15 }], [1.4, 14, 28, 26], [1.7, 18, 36, 34, { cure: true }]];
const SUPPORT_ALSO = o => !o ? '' : o.shield ? `, and a shield of ${o.shield}% max HP` : o.hp ? `, and heals ${o.hp}% max HP` : o.mp ? `, and restores ${o.mp}% max MP` : ', and cures poison, burns and slows';
const SUPPORT_CARDS = [];
for (const [key, C] of Object.entries(SUPPORT)) C.names.forEach((n, i) => {
  const [f, secs, mp, cd, also] = SUPPORT_STEPS[i], v = Math.round(C.base * f * 100) / 100, id = `sup_${key}${i}`;
  SPECIES[id] = { name: n, arcana: true, support: true, sig: C.sig, trait: C.label, spell: { n, a: 'nova', el: C.el, fx: FX.HOLY, icon: 31, sx: 'support', mp, cd: cd * 1000, sup: { now: C.now, k: C.k, v, secs, also, label: C.label, fmt: C.fmt, sign: C.sign ?? '+', unit: C.unit || '%' }, d: `${C.fmt(v, secs)}${SUPPORT_ALSO(also)}. Stronger at higher ranks` } };
  SUPPORT_CARDS.push(id);
});
const EL_FX = { fire: [FX.FLAME, FX.EXPLODE, FX.METEOR], ice: [FX.ICE, FX.STORM, FX.BEAM], lightning: [FX.LIGHTNING, FX.STORM, FX.BEAM],
  earth: [FX.ROCKS, FX.SPIKE, FX.METEOR], wind: [FX.WIND, FX.STORM, FX.SPIKE], dark: [FX.VORTEX, FX.BEAM, FX.EXPLODE],
  poison: [FX.ROCKS, FX.STORM, FX.SPIKE], holy: [FX.HOLY, FX.BEAM, FX.LIGHTNING] };
{
  const TW = Object.keys(TWISTS), groups = {};
  for (const id of Object.keys(SPECIES).sort()) { if (SPECIES[id].chef) continue; const s = SPECIES[id].spell; (groups[s.a + '|' + s.el] = groups[s.a + '|' + s.el] || []).push(id); }
  Object.values(groups).forEach((list, gi) => list.forEach((id, i) => {
    const s = SPECIES[id].spell;
    s.tw = TW[(gi * 5 + i) % TW.length];
    if (!SPECIES[id].arcana) s.fx = EL_FX[s.el][(gi + i) % EL_FX[s.el].length];
    s.hue = ((i * 37 + gi * 13) % 51) - 25; s.fxs = 0.85 + ((i * 7 + gi * 3) % 5) * 0.1;
  }));
}
// EVERY SKILL ITS OWN LOOK: each card keeps its Zenonia effect and adds an accent of its own from the Elemental Spellcraft art the Arcana
// don't use, in its element's colour (not the Ki cards or OmegaKingX, and the Arcana have their own art). No art, colour and shade is dealt
// twice: a card's own element comes first, then the art used least, in the colour furthest from its other uses. Each is `c_<card>`.
const EL_HUE = { fire: 20, ice: 200, lightning: 52, earth: 32, wind: 155, dark: 275, poison: 95, holy: 45 };
const EL_SHADE = [0, -22, 22, -40, 40];   // the same art in the same element takes a different shade of it
const EX_EL = { fire: 'fire', ice: 'ice', water: 'ice', lightning: 'lightning', earth: 'earth', wind: 'wind', dark: 'dark', void: 'dark', poison: 'poison', holy: 'holy' };
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
{
  const taken = new Set(Object.values(SPECIES).flatMap(S => S.spell ? [S.spell.vfx, S.spell.burst, S.spell.cast, S.spell.art] : []).concat(['ex_holy_impact_large', 'ex_level_up_pillar'])), uses = {}, FX2 = window.SPELL_FX || {};
  const Arts = Object.keys(FX2).filter(k => /^ex_/.test(k) && !taken.has(k)).sort().map(key => ({ key, el: EX_EL[key.split('_')[1]] || 'holy' }));
  for (const id of Object.keys(SPECIES).sort()) {
    const S = SPECIES[id], s = S.spell; if (S.ki || (S.arcana && !S.support) || id === 'omega' || !s || !Arts.length) continue;
    const target = EL_HUE[s.el] ?? 200, score = A => { const U = uses[A.key] || []; return [U.filter(e => e === s.el).length, A.el === s.el ? 0 : 1, U.length, -Math.min(180, ...U.map(e => hueGap(EL_HUE[e], target)))]; };
    const A = Arts.slice().sort((x, y) => { const a = score(x), b = score(y); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; })[0];
    const U = uses[A.key] = uses[A.key] || [], shade = EL_SHADE[U.filter(e => e === s.el).length]; U.push(s.el);
    const turn = target + shade - EL_HUE[A.el]; FX2[`c_${id}`] = { ...FX2[A.key], solid: true, tint: turn ? `hue-rotate(${turn}deg)` : null };
    s.accent = `c_${id}`; s.accentPair = `${A.key}|${s.el}|${shade}`; if (S.support) s.art = s.accent;
  }
}
const CHEF_CARDS = Object.keys(SPECIES).filter(id => SPECIES[id].chef);
const ARCANA_CARDS = Object.keys(ARCANA);

// ---------- zones (adventure fields west of town) ----------
// Each zone is a real Zenonia map (see build_rpg.py MAPS); tint sets the mood.
const ZONES = [
  { name: 'Verdant Fields', map: 'z0', ranks: [0, 3], tint: null, mobs: ['002', '006', '029', '005', '011', '003', '009'], mobs2: ['203', '204', '205', '208', '210', '211', '202'], count: 16, desc: 'Sunny forest meadows. F–C rank.' },
  { name: 'Twilight Grove', map: 'z1', ranks: [2, 5], tint: '#7d86c4', mobs: ['008', '012', '013', '020', '023', '007', '028', '011'], mobs2: ['209', '217', '223', '234', '219', '221'], count: 16, desc: 'The woods after dark. D–A rank.' },
  { name: 'Skyreach Isles', map: 'z2', ranks: [4, 7], tint: null, mobs: ['010', '001', '019', '022', '017', '014', '025', '027'], mobs2: ['216', '222', '201', '207', '214', '239'], count: 16, desc: 'Cloud islands high above the world. B–SS rank.' },
  { name: 'Frozen Abyss', map: 'z3', ranks: [6, 9], tint: '#c8d4ff', mobs: ['004', '021', '024', '026', '018', '030', '016'], mobs2: ['226', '243', '232', '241'], count: 14, desc: 'An ice cavern at the end of the world. S–SSS+ rank.' },
  { name: 'Sunscorch Desert', map: 'z1d', ranks: [7, 9], tint: null, mobs: ['014', '016', '004', '028', '010', '001'], mobs2: ['217', '223', '234', '241', '209'], cardMob: '241', bookHome: ['217', '223', '234', '241'], count: 10, desc: 'Sun-baked sands before the Sun Temple. A–SSS+ rank.' },   // (west of the Frozen Abyss, on the road to the temple: desert.js)
];
// A and above are a real find: a card or piece of gear that drops at those ranks passes this roll to stay at A at all (or falls to
// B), and again for every rank above A. Rewards you earn outright (bosses, quests, the shop) don't use it.
const RARE = { from: 5, keep: 0.2 };
function rareGate(t) { if (t < RARE.from) return t; if (Math.random() >= RARE.keep) return RARE.from - 1; let r = RARE.from; while (r < t && Math.random() < RARE.keep) r++; return r; }
function rollRank(zone) {
  // weighted toward the low end of the zone; each step up is ~45% as likely
  const [a, b] = zone.ranks;
  let t = a;
  while (t < b && Math.random() < 0.45) t++;
  return t;
}

// ---------- monster passives ----------
function monsterPassives(sp, tier) {
  const sig = SPECIES[sp].sig;
  const list = [{ id: sig, tier }];
  const pool = PASSIVE_IDS.filter(p => p !== sig);
  while (list.length < tier + 1 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    list.push({ id: pool.splice(i, 1)[0], tier });
  }
  return list;
}

// ---------- cards ----------
function makeCard(sp, tier) { return { uid: uid(), sp, tier }; }
function cardName(c) {
  if (c.fusion) return c.name;
  return SPECIES[c.sp].name;
}
function cardPassives(c) {
  if (c.fusion) return c.fusion.flatMap(cardPassives);   // a fused card carries every passive of the cards merged into it, at full strength
  if (SPECIES[c.sp].sigs) return SPECIES[c.sp].sigs.map(([id, trait]) => ({ id, tier: c.tier, mul: c.sun ? 1.25 : 1, trait }));   // (the Ki Bomb carries five)
  return [{ id: SPECIES[c.sp].sig, tier: c.tier, mul: c.sun ? 1.25 : 1, trait: SPECIES[c.sp].trait }];   // (c.sun: a Sunforged card, trials.js)
}
// a support card at its rank: the amount, how it reads in full, and the short form that takes the place of power on the card
const supportAt = (S, t) => { const r = S.v * (1 + t * 0.1), v = r < 10 ? Math.round(r * 10) / 10 : Math.round(r); return { v, text: `${S.fmt(v, S.secs)}${SUPPORT_ALSO(S.also)}`, stat: `${S.sign}${v}${S.unit}` }; };
const spellPow = sp => sp.stat || sp.power;   // what a card shows as its strength
function cardSpell(c) {
  if (c.fusion) return null;
  const s = SPECIES[c.sp].spell, a = ARCH[s.a];
  const t = c.tier, sa = s.sup && supportAt(s.sup, t), M = s.form != null ? SKILL_MODS[s.mod] : {};
  return {
    name: s.n, arch: s.a, el: s.el, fx: s.fx, icon: s.icon, sp: c.sp, tier: t,
    power: Math.max(1, Math.round((14 + 7 * t) * a.pow * (1 + t * 0.08) * (M.pow || 1) * CARD_DMG_K)),
    mp: Math.round((s.mp || a.mp) * (M.mp || 1)), cd: (s.cd || a.cd) * (1 - t * 0.03) * (M.cd || 1) * CARD_CD_K, form: s.form, mod: s.mod, formText: s.form != null ? skillText(s) : null, sx: s.sx, desc: sa ? sa.text : s.d, stat: sa ? sa.stat : null, vfx: s.vfx, accent: s.accent, sup: s.sup, burst: s.burst, castFx: s.cast, tw: s.tw, hue: s.hue || 0, fxs: s.fxs || 1,
    count: s.a === 'rain' ? 3 + Math.floor(t / 2) : s.a === 'bolt' ? 1 + Math.floor(t / 3) : 1,
    radius: Math.round((38 + t * 4) * (M.rad || 1)),
    status: t >= 6 || !!s.always,  // S+ adds the element status (some chef skills always do)
  };
}
function spellDesc(sp) {
  if (sp.sup) return `${sp.sup.label} · ${sp.desc} · ${sp.mp} MP.`;
  const e = ELEMENTS[sp.el];
  let s = `${ARCH[sp.arch].name} · ${e.name} · ${sp.power} power · ${sp.mp} MP. ${sp.formText || `${cap(ARCH[sp.arch].desc)}.`}`;
  if (sp.arch === 'rain') s += ` ${sp.count} strikes.`;
  if (sp.arch === 'bolt' && sp.count > 1) s += ` ${sp.count} projectiles.`;
  const ch = !sp.status && typeof STATUS_CHANCE !== 'undefined' && STATUS_CHANCE.els.includes(sp.el) ? Math.round((STATUS_CHANCE.base + STATUS_CHANCE.per * (sp.tier || 0)) * 100) : 0;   // (below S+: a chance each cast, elemreact.js)
  s += sp.status ? ` S+ bonus: ${e.desc}.` : ch ? ` ${ch}% chance each cast: ${e.desc}; always at S+.` : ' (S+ rank adds ' + e.desc + ')';
  return s;
}
const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------- fusion ----------
function fuseCards(cards) {
  const top = Math.max(...cards.map(c => c.tier));
  const tier = Math.min(9, top + (cards.length >= 3 ? 1 : 0));
  const parts = cards.map(c => c.fusion ? c.name.split(' ')[0] : SPECIES[c.sp].name.split(' ').pop());
  const prefixes = ['Chimera', 'Twin', 'Trinity', 'Eclipse', 'Ragnarok', 'Astral'];
  const name = `${prefixes[(cards.length - 2) * 2 + (tier >= 6 ? 1 : 0)] || 'Chimera'} ${parts.join('-')}`;
  return { uid: uid(), fusion: cards.map(c => JSON.parse(JSON.stringify(c))), tier, name };
}
function fusionSpells(c) { return c.fusion.flatMap(x => x.fusion ? fusionSpells(x) : [cardSpell(x)]); }
function fusionPower(c) {
  const sum = fusionSpells(c).reduce((s, sp) => s + sp.power, 0);
  return Math.round(sum * (c.fusion.length >= 3 ? 2.2 : 1.5));
}
function cardIconSpecies(c) { return c.fusion ? c.fusion[0].sp || cardIconSpecies(c.fusion[0]) : c.sp; }

// ---------- gear ----------
// Six equipment slots, as in the inventory book: HEAD · BODY · WEAPON · ACCESSORY · BOOTS · TRINKET
const GEAR_SLOTS = ['head', 'body', 'weapon', 'accessory', 'boots', 'trinket'];
const SLOT_LABEL = { head: 'HEAD', body: 'BODY', weapon: 'WEAPON', accessory: 'ACCESSORY', boots: 'BOOTS', trinket: 'TRINKET' };
const GEAR_NAMES = {
  weapon: ['Rusty', 'Iron', 'Steel', 'Mithril', 'Runed', 'Ancestral', 'Dragonbone', 'Celestial', 'Godslayer', 'Genesis'],
  head: ['Cloth', 'Leather', 'Iron', 'Horned', 'Knight', 'Warden', 'Titan', 'Seraph', 'Eternal', 'Primordial'],
  body: ['Cloth', 'Leather', 'Chain', 'Scale', 'Plate', 'Warden', 'Titan', 'Seraph', 'Eternal', 'Primordial'],
  boots: ['Worn', 'Leather', 'Swift', 'Ranger', 'Wind', 'Gale', 'Storm', 'Comet', 'Zephyr', 'Lightspeed'],
  accessory: ['Pebble', 'Copper', 'Silver', 'Jade', 'Sapphire', 'Ruby', 'Starfall', 'Void', 'Phoenix', 'Infinity'],
  trinket: ['Bone', 'Brass', 'Silver', 'Moon', 'Sun', 'Dragon', 'Star', 'Void', 'Phoenix', 'Genesis'],
};
const SLOT_KIND = { head: 'Helm', body: 'Armor', boots: 'Boots', accessory: 'Ring', trinket: 'Amulet' };
// ItemIcon index ranges per slot (rows of the game's item icon sheet)
const SLOT_ICONS = { head: [32, 47], body: [48, 63], boots: [64, 79], accessory: [112, 127], trinket: [88, 95] };
// Rolled stats: on top of its slot's own, a piece carries extra stats by rank (the first names it: a Fierce Iron Helm), and from
// rank C up its passives, so nothing above the bottom ranks is a bare number or two.
const GEAR_ROLLS = {
  count: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4], passives: [0, 0, 0, 1, 1, 2, 2, 2, 3, 3],
  pool: [{ k: 'atk', name: 'Fierce', v: t => 1 + t * 1.2 }, { k: 'hp', name: 'Stalwart', v: t => 6 + t * 7 }, { k: 'def', name: 'Guarding', v: t => 1 + t * 0.5 }, { k: 'crit', name: 'Keen', v: t => 1 + t * 0.4 }, { k: 'mp', name: 'Arcane', v: t => 3 + t * 3 }, { k: 'spd', name: 'Swift', v: t => 1 + t * 0.6 }],
};
// QUALITY: every piece rolls one, which scales its stats (the stars on its socket). SETS: from rank D up a piece may belong to a set;
// worn together, 2, 4 and 6 pieces of one set each add a passive, as strong as the set's lowest-ranked worn piece allows.
const GEAR_QUALITY = [{ name: 'Plain', mul: 1, w: 60 }, { name: 'Fine', mul: 1.12, w: 28 }, { name: 'Superior', mul: 1.28, w: 10 }, { name: 'Masterwork', mul: 1.5, w: 2 }];
const GEAR_SETS = {
  ember: { name: 'Emberforged', col: '#ff7a3a', steps: ['brutal', 'last', 'burst'] }, warden: { name: 'Warden', col: '#6aa8e8', steps: ['hide', 'barrier', 'thorns'] },
  gale: { name: 'Galewalker', col: '#6ae8b0', steps: ['swift', 'evade', 'frenzy'] }, blood: { name: 'Bloodbound', col: '#e84a5a', steps: ['regen', 'vamp', 'unstop'] },
  night: { name: 'Nightstalker', col: '#a87aff', steps: ['crit', 'venom', 'frenzy'] }, frost: { name: 'Frostsworn', col: '#9fe8ff', steps: ['frost', 'mana', 'hide'] },
};
const GEAR_SET = { from: 2, chance: 0.35, at: [2, 4, 6] };
function rollQuality() { let k = Math.random() * 100, q = 0; for (const Q of GEAR_QUALITY) { if (k < Q.w) break; k -= Q.w; q++; } return Math.min(q, GEAR_QUALITY.length - 1); }
// the sets you are wearing: { id: { n pieces, low rank } }
function wornSets(pr) {
  const out = {};
  for (const s of GEAR_SLOTS) { const g = pr.gear.find(x => x.uid === pr.eq[s]); if (!g || !g.set) continue; const S = out[g.set] || (out[g.set] = { n: 0, low: 9 }); S.n++; S.low = Math.min(S.low, g.tier); }
  return out;
}
// GEAR YOU CAN SEE: a full set of six sends motes of its colour rising round the hero (world.js shineMotes). There is no outline.
function gearShine(pr) {
  const W = wornSets(pr), id = Object.keys(W).sort((a, b) => W[b].n - W[a].n)[0]; if (id && W[id].n >= GEAR_SET.at[0]) return { col: GEAR_SETS[id].col, n: W[id].n };
  const worn = GEAR_SLOTS.map(s => pr.gear.find(x => x.uid === pr.eq[s])); if (!worn.every(Boolean)) return null;
  const low = Math.min(...worn.map(g => g.tier)); return low >= 5 ? { rank: low, n: 2 } : null;
}
function setPassives(pr) {
  const out = [], W = wornSets(pr);
  for (const id in W) GEAR_SET.at.forEach((need, i) => { if (W[id].n >= need) out.push({ id: GEAR_SETS[id].steps[i], tier: Math.max(1, W[id].low - 1), mul: 1 }); });
  return out;
}
// "Emberforged 3/6: 2 Brutal ✔ · 4 Last Stand · 6 Death Burst"
function setLine(pr, id) { const S = GEAR_SETS[id], n = (wornSets(pr)[id] || { n: 0 }).n; return `${S.name} ${n}/6: ${S.steps.map((p, i) => `${GEAR_SET.at[i]} ${PASSIVES[p].name}${n >= GEAR_SET.at[i] ? ' ✔' : ''}`).join(' · ')}`; }
function makeGear(slot, tier, cls) {
  const r = () => rand(0.85, 1.15);
  const g = { uid: uid(), slot, tier, stats: {} };
  const st = g.stats;
  if (slot === 'weapon') {
    st.atk = Math.round((4 + tier * 5) * r());
    g.look = Math.min(9, tier);
    g.icon = CLASSES[cls].icon + (CLASSES[cls].focus ? 0 : Math.min(tier, 7) % 4);
    g.name = `${GEAR_NAMES.weapon[tier]} ${CLASSES[cls].weapon}`;
    g.cls = cls;
  } else {
    if (slot === 'head') { st.hp = Math.round((8 + tier * 9) * r()); st.def = Math.round((1 + tier * 0.72) * r()); }
    if (slot === 'body') { st.hp = Math.round((15 + tier * 16) * r()); st.def = Math.round((1 + tier * 1.2) * r()); }
    if (slot === 'boots') { st.def = Math.round((1 + tier * 0.5) * r()); st.spd = Math.round((2 + tier * 1.2) * r()); }
    if (slot === 'accessory') { st.crit = Math.round((2 + tier * 1.6) * r()); st.mp = Math.round((5 + tier * 5) * r()); }
    if (slot === 'trinket') { st.atk = Math.round((1 + tier * 1.8) * r()); st.mp = Math.round((4 + tier * 4) * r()); }
    const [lo, hi] = SLOT_ICONS[slot];
    g.icon = lo + Math.min(hi - lo, tier + randi(0, 3));
    g.name = `${GEAR_NAMES[slot][tier]} ${SLOT_KIND[slot]}`;
  }
  const P = GEAR_ROLLS.pool.filter(a => !(a.k in st)); let prefix = '';
  for (let n = GEAR_ROLLS.count[tier]; n > 0 && P.length; n--) { const a = P.splice(randi(0, P.length - 1), 1)[0]; st[a.k] = Math.max(1, Math.round(a.v(tier) * r())); prefix = prefix || a.name; }
  const n = GEAR_ROLLS.passives[tier];
  if (n) {
    g.bonus = [];
    while (g.bonus.length < n) {
      const id = pick(GEAR_BONUS_IDS);   // (no Regeneration or Mana Font: they only work at SSS+, and a gear bonus is 3 ranks lower)
      if (!g.bonus.some(b => b.id === id)) g.bonus.push({ id, tier: Math.max(1, tier - 3), mul: 1 });
    }
  }
  g.q = rollQuality(); if (g.q) for (const k in st) st[k] = Math.ceil(st[k] * GEAR_QUALITY[g.q].mul);
  if (tier >= GEAR_SET.from && Math.random() < GEAR_SET.chance) { g.set = pick(Object.keys(GEAR_SETS)); prefix = GEAR_SETS[g.set].name; }
  if (Z2_GEAR.weapon0 && Math.random() < Z2_GEAR_CHANCE) z2Look(g, slot, tier, cls);
  if (prefix) g.name = `${prefix} ${g.name}`;
  return g;
}

// ---------- Zenonia 2 items ----------
// Every Zenonia 2 item (assets/items2.js: [icon, name, category, sub, class, level]) can drop.
// Equipment keeps this game's stats for its slot and rank, and takes the Zenonia 2 name and icon.
// Everything else (potions, food, materials, keys, relic boxes…) drops as "goods" kept in the bag.
const Z2_GEAR_CHANCE = 0.6;
const Z2_SUB_SLOT = { 0: 'weapon', 1: 'head', 2: 'body', 3: 'accessory', 4: 'boots', 5: 'trinket', 6: 'trinket', 7: 'accessory', 8: 'accessory', 9: 'trinket' };
// our class -> Zenonia 2 weapon line (0 swords, 1 pistols, 2 armlets, 3 knuckles)
const Z2_WEAPON_LINE = [0, 0, 0, 2, 2, 3, 0, 1, 2, 3, 0];
const Z2_GEAR = {}, Z2_GOODS = [], Z2_ITEM = {};
(function buildZ2Items() {
  const groups = {};
  for (const [idx, name, cat, sub, cls, lv] of window.ITEMS2 || []) {
    const it = { idx, name, cat, sub, cls, lv };
    Z2_ITEM[idx] = it;
    const key = cat <= 1 ? (sub === 0 ? 'weapon' + cls : Z2_SUB_SLOT[sub]) + ':' + sub : 'goods:' + sub;
    (groups[key] = groups[key] || []).push(it);
  }
  for (const key in groups) {   // rank each line by required level and spread it over the ten ranks
    const list = groups[key].sort((a, b) => a.lv - b.lv);
    list.forEach((it, i) => {
      it.tier = key.startsWith('goods') ? Math.min(9, Math.floor(it.lv / 20)) : Math.floor(i * 10 / list.length);
      if (key.startsWith('goods')) { Z2_GOODS.push(it); return; }
      const k = key.split(':')[0];
      ((Z2_GEAR[k] = Z2_GEAR[k] || [])[it.tier] = Z2_GEAR[k][it.tier] || []).push(it);
    });
  }
})();
function z2Look(g, slot, tier, cls) {
  const ranks = Z2_GEAR[slot === 'weapon' ? 'weapon' + Z2_WEAPON_LINE[cls] : slot];
  if (!ranks) return;
  let t = tier; while (t > 0 && !ranks[t]) t--;
  const it = pick(ranks[t] || ranks.find(r => r));
  g.name = it.name; g.icon = ITEM2_BASE + it.idx; g.z2 = it.idx;
}
// What a good does when used from the bag
const GOODS_USE = {
  10: { what: 'Restores 35% HP', hp: 0.35 }, 11: { what: 'Restores 20% HP and MP', hp: 0.2, mp: 0.2 },
  12: { what: 'Restores 40% MP', mp: 0.4 }, 26: { what: 'Cures ailments, restores 15% HP', hp: 0.15, cure: true },
  16: { what: 'Fully restores HP and MP', hp: 1, mp: 1 }, 23: { what: 'Restores 50% HP and MP', hp: 0.5, mp: 0.5 },
  24: { what: 'Fully restores HP, cures ailments', hp: 1, cure: true }, 35: { what: 'Open it for a piece of gear', box: true },
};
function goodsInfo(idx) {
  const used = typeof craftUses === 'function' && craftUses(idx); if (used) return `Makes: ${used} (Workshop, Z)`;
  const it = Z2_ITEM[idx];
  const use = GOODS_USE[it.sub]; if (!use && typeof isCurio === 'function' && isCurio(idx)) return 'A curio: the Collector in Hearthvale will pay for one';
  return use ? use.what : it.cat === 3 ? 'Crafting material — a hunter\'s trophy' : 'A curious find from the Zenonia 2 world';
}
// A random good around a rank (lower ranks far more common)
function makeGoods(tier) {
  const mat = typeof craftDrop === 'function' && craftDrop(tier); if (mat) return mat;   // most drops are Workshop materials (craft.js)
  const pool = Z2_GOODS.filter(it => it.tier <= tier + 1);
  const it = pick(pool.length ? pool : Z2_GOODS);
  return { idx: it.idx, name: it.name, icon: ITEM2_BASE + it.idx, tier: it.tier };
}
// Single number for "is this better?": main stats weighted, plus bonus passives.
function gearScore(g) {
  if (!g) return -1;
  const s = g.stats;
  return (s.atk || 0) * 3 + (s.hp || 0) * 0.25 + (s.def || 0) * 2 + (s.crit || 0) * 2 + (s.mp || 0) * 0.3 + (s.spd || 0) * 1.5 +
    (g.bonus || []).reduce((t, b) => t + 6 + b.tier * 2, 0) + (g.set ? 6 : 0);
}
// Equip the best item in each slot (weapons must match the class). Returns the items newly equipped.
function equipBest(pr) {
  const changed = [];
  for (const slot of GEAR_SLOTS) {
    const cur = pr.gear.find(g => g.uid === pr.eq[slot]);
    let best = cur;
    for (const g of pr.gear) {
      if (g.slot !== slot || (slot === 'weapon' && g.cls !== pr.cls) || (typeof partnerHolds === 'function' && partnerHolds(pr, g.uid))) continue;
      if (gearScore(g) > gearScore(best)) best = g;
    }
    if (best && best !== cur) { pr.eq[slot] = best.uid; changed.push(best); }
  }
  return changed;
}
const isUpgrade = (pr, g) => g.slot !== 'weapon' || g.cls === pr.cls ? gearScore(g) > gearScore(pr.gear.find(x => x.uid === pr.eq[g.slot])) : false;
function gearLines(g) {
  const s = g.stats, out = g.q ? [`${'★'.repeat(g.q)} ${GEAR_QUALITY[g.q].name}`] : [];
  if (s.atk) out.push(`+${s.atk} Attack`);
  if (s.hp) out.push(`+${s.hp} HP`);
  if (s.def) out.push(`+${s.def} Defence`);
  if (s.spd) out.push(`+${s.spd} Speed`);
  if (s.crit) out.push(`+${s.crit}% Crit`);
  if (s.mp) out.push(`+${s.mp} MP`);
  (g.bonus || []).forEach(b => out.push(`${PASSIVES[b.id].name}: ${PASSIVES[b.id].fmt(passiveValue(b.id, b.tier))}`));
  if (g.dur != null && typeof gearDurMax === 'function') out.push(g.dur <= 0 ? 'BROKEN — mend it at a Smith' : `Durability ${Math.ceil(g.dur)}/${gearDurMax(g)}`);   // (once it has seen a fight: durability.js)
  return out;
}

// ---------- levels ----------
const MAX_LV = 99;
const expNeed = lv => Math.round(40 * Math.pow(lv, 1.5));
const killExp = tier => Math.round(6 * Math.pow(tier + 1, 1.4));
const LV_GROWTH = { hp: 8, mp: 5, atk: 0.8 };   // per level above 1
// Stat points: 2 per level (was 5; 2026-11-13, the user's balance pass), spent in the inventory's STATS page. Each point gives
// a little less than it did (ATTR_K), and FOCUS (new) shortens card cooldowns, up to FOCUS_CAP percent in all.
const POINTS_PER_LV = 2;
const ATTR_K = { str: 0.8, vitHp: 8, vitDef: 0.25, intMp: 5, intAmp: 1, dex: 0.35, agi: 0.4, foc: 0.5 }, FOCUS_CAP = 20;
const ATTRS = [
  { id: 'str', name: 'STR', full: 'Strength',  col: '#c8401a', desc: '+0.8 ATK' },
  { id: 'vit', name: 'VIT', full: 'Vitality',  col: '#2a8a3a', desc: '+8 HP · +0.25 DEF' },
  { id: 'int', name: 'INT', full: 'Intellect', col: '#2a5ad0', desc: '+5 MP · +1% spell power' },
  { id: 'dex', name: 'DEX', full: 'Dexterity', col: '#a8661c', desc: '+0.35% critical chance' },
  { id: 'agi', name: 'AGI', full: 'Agility',   col: '#1a8a8a', desc: '+0.4 move speed' },
  { id: 'foc', name: 'FOC', full: 'Focus',     col: '#8a4ac8', desc: '-0.5% card cooldown (max 20%)' },
];
const attrOf = (pr, id) => (pr.attr && pr.attr[id]) || 0;
// a save that spent more points than its level now gives (the old 5 a level): every stat keeps its share, scaled down to fit
function attrFit(pr) {
  if (!pr || !pr.attr) return;
  const cap = Math.max(0, ((pr.lv || 1) - 1) * POINTS_PER_LV), spent = ATTRS.reduce((s, A) => s + attrOf(pr, A.id), 0);
  if (spent <= cap) return;
  const k = cap / spent; let left = cap;
  for (const A of ATTRS) { const n = Math.floor(attrOf(pr, A.id) * k); pr.attr[A.id] = n; left -= n; }
  pr.attrFitted = true;
}
const statPoints = pr => Math.max(0, ((pr.lv || 1) - 1) * POINTS_PER_LV - ATTRS.reduce((s, A) => s + attrOf(pr, A.id), 0));

// ---------- player classes ----------
// The game ships three player sprite sets; Mage and Summoner reuse a body with their own colours.
// They carry a floating focus (orb / tome) instead of a sword: focus = ItemIcon index.
const CLASSES = [
  { name: 'Berserker', sprite: 0, style: 'melee', hp: 130, mp: 80, atk: 10, spd: 72, anim: 1, weapon: 'Greatsword', icon: 0,
    blurb: 'Heavy greatsword. High damage.', hair: 'orig', outfit: 'orig' },
  { name: 'Paladin', sprite: 1, style: 'melee', hp: 150, mp: 90, atk: 8, spd: 68, anim: 1, weapon: 'Blade', icon: 3,
    blurb: 'Sword & resolve. Tough.', hair: 'orig', outfit: 'orig' },
  { name: 'Assassin', sprite: 2, style: 'melee', hp: 110, mp: 100, atk: 8, spd: 84, anim: 1.15, weapon: 'Dagger', icon: 18,
    blurb: 'Twin daggers. Fast.', hair: 'orig', outfit: 'orig' },
  { name: 'Mage', sprite: 2, style: 'mage', hp: 95, mp: 160, atk: 9, spd: 70, anim: 1, weapon: 'Orb', icon: 80, focus: 80,
    blurb: 'Hurls arcane bolts from a floating orb. +30% spell power.', hair: 'white', outfit: 'violet', glow: 'arcane' },
  { name: 'Summoner', sprite: 1, style: 'summoner', hp: 120, mp: 130, atk: 7, spd: 72, anim: 1, weapon: 'Tome', icon: 133, focus: 133,
    blurb: 'Commands two familiars from a spirit tome.', hair: 'green', outfit: 'teal', glow: 'spirit' },
  { name: 'Martial Artist', sprite: 2, style: 'fist', hp: 140, mp: 90, atk: 9, spd: 86, anim: 1.4, weapon: 'Knuckles', icon: 42, fist: true, hidden: true,
    blurb: 'Bare-fisted. Lightning 4-hit chains end in a launching uppercut.', hair: 'black', outfit: 'red' },
  // ---- heroes from Zenonia 2 (paper-doll sprites: off-hand + armour + head, separate weapon)
  { name: 'Lu', title: 'Holy Knight', sprite: 3, style: 'melee', hp: 150, mp: 95, atk: 9, spd: 70, anim: 1, weapon: 'Holy Sword', icon: 3, z2: true,
    blurb: 'Zenonia 2 · sword and shield. Sturdy and steady.', hair: 'orig', outfit: 'orig' },
  { name: 'Ecne', title: 'Shooter', sprite: 4, style: 'mage', hp: 105, mp: 120, atk: 9, spd: 78, anim: 1.1, weapon: 'Launcher', icon: 18, z2: true, gun: true,
    blurb: 'Zenonia 2 · fires her shells from range, a rocket to end each combo.', hair: 'orig', outfit: 'orig' },
  { name: 'Morpice', title: 'Magician', sprite: 5, style: 'mage', hp: 95, mp: 165, atk: 9, spd: 70, anim: 1, weapon: 'Orb', icon: 80, focus: 80, glow: 'arcane', z2: true,
    blurb: 'Zenonia 2 · orb magic. +30% spell power.', hair: 'orig', outfit: 'orig' },
  { name: 'Daza', title: 'Warrior', sprite: 6, style: 'melee', hp: 140, mp: 80, atk: 11, spd: 72, anim: 0.95, weapon: 'War Blade', icon: 0, z2: true,
    blurb: 'Zenonia 2 · heavy blows that hit the hardest.', hair: 'orig', outfit: 'orig' },
  // ---- a monster made playable: uses the monster's own sprite bank (idle, walk, one sword swing, hurt, death)
  { name: 'Iron Sentinel', title: 'Monster Knight', mon: '025', style: 'melee', hp: 165, mp: 75, atk: 11, spd: 64, anim: 1.1, weapon: 'Iron Blade', icon: 3,
    blurb: 'A living suit of armour from the Skyreach Isles. Slow, tough and hits hard.', hair: 'orig', outfit: 'orig' },
  // ---- Chef Daddy: quick knife work, a kitchen of skill cards, and the In the Weeds passive (see combat.js)
  { name: 'Chef Daddy', title: 'Chef', sprite: 2, style: 'melee', hp: 125, mp: 130, atk: 9, spd: 80, anim: 1.2, weapon: 'Frying Pan', icon: 18, chef: true, sheet: true,
    blurb: 'Seven kitchen skills + Gourmet Meal. In the Weeds: when overwhelmed, time slows down around him.', hair: 'black', outfit: 'white' },
  // ---- OmegaKingX: the Berserker's body on his own editable sheet (assets/omega.png, tools/build_omega_sheet.py), no
  // sword — he fights with his fists; his CHARGE animation is the cast frames until new ones are painted
  { name: 'OmegaKingX', title: 'Brawler', sprite: 0, bodySheet: 'assets/omega.png', style: 'fist', fist: true, hp: 145, mp: 100, atk: 10, spd: 82, anim: 1.3, weapon: 'Fists', icon: 42,
    blurb: 'A brawler who fights bare-fisted: fast punch chains and a fierce charge-up.', hair: 'orig', outfit: 'orig' },
  // ---- Archer: his own frames with the bow (assets/archer.png + archer_body.js, tools/build_archer_sheet.py, from the
  // reference picture tools/art/archer/reference.png); every combo swing looses an arrow (the third a piercing volley)
  { name: 'Archer', title: 'Ranger', sprite: 0, bodySheet: 'assets/archer.png', bank: 'ARCHER_BODY', style: 'archer', hp: 115, mp: 110, atk: 10, spd: 80, anim: 1.2, weapon: 'Longbow', icon: 18,
    blurb: 'Fights from range: quick arrows, and a piercing three-arrow volley to end each combo.', hair: 'orig', outfit: 'orig' },
];
// hidden: no longer offered as a new hero (the Martial Artist); a saved hero of that class still plays
// (2026-11-13, the user: "too many unusable characters"; they chose to keep ten) Iron Sentinel (a monster body with no attack, skill or
// cast frames), Chef Daddy and OmegaKingX leave the select screen too. A saved hero of one of them still loads and plays.
for (const n of ['Iron Sentinel', 'Chef Daddy']) { const C = CLASSES.find(q => q.name === n); if (C) C.hidden = true; }   // (OmegaKingX came back the same day: the user wants to play him)
const CLASS_PICKS = () => CLASSES.map((C, i) => i).filter(i => !CLASSES[i].hidden);
const BASE_STAT_CUT = 0.4;   // every class's starting HP, MP and attack, scaled once here (speed is left alone; 0.8, then halved 2026-11-13)
for (const C of CLASSES) { C.hp = Math.round(C.hp * BASE_STAT_CUT); C.mp = Math.round(C.mp * BASE_STAT_CUT); C.atk = Math.round(C.atk * BASE_STAT_CUT); }
const CLASS_STATS = CLASSES;   // older name, kept for callers
const className = cls => CLASSES[cls].title || CLASSES[cls].name;

// Customization colour presets: h = target hue (null = keep), s/l multipliers or overrides
const STYLE_COLORS = {
  orig:   { name: 'Original', swatch: null },
  white:  { name: 'Silver',  swatch: '#e8eef8', h: 220, s: 0.08, l: 1.35 },
  black:  { name: 'Raven',   swatch: '#2a2a36', h: 240, s: 0.25, l: 0.45 },
  red:    { name: 'Crimson', swatch: '#e04848', h: 0,   s: 1.0,  l: 1.0 },
  pink:   { name: 'Rose',    swatch: '#ff8ac8', h: 325, s: 0.9,  l: 1.1 },
  blue:   { name: 'Azure',   swatch: '#4a8cff', h: 218, s: 1.0,  l: 1.0 },
  teal:   { name: 'Teal',    swatch: '#2ec4b0', h: 172, s: 0.9,  l: 1.0 },
  green:  { name: 'Moss',    swatch: '#5cc85c', h: 115, s: 0.85, l: 1.0 },
  violet: { name: 'Violet',  swatch: '#9a5cff', h: 268, s: 0.95, l: 1.0 },
  gold:   { name: 'Gold',    swatch: '#ffc83c', h: 44,  s: 1.0,  l: 1.05 },
};
STYLE_COLORS.divine = { name: 'Divine', swatch: '#ffffff', h: 210, s: 0.0, l: 1.9, hidden: true };
// Layer Skill "Ascended" form: silver-gold hair, pale silver-blue clothes that keep their shading
STYLE_COLORS.ascendHair = { name: 'Ascended', swatch: '#fff4d8', h: 45, s: 0.3, l: 1.55, hidden: true };
STYLE_COLORS.ascendCloth = { name: 'Ascended', swatch: '#d8e8ff', h: 212, s: 0.32, l: 1.28, hidden: true };
// elemental layers tint the ascended outfit to match (same lightness, the element's hue)
STYLE_COLORS.ascendFire = { name: 'Ascended', swatch: '#ffd8b8', h: 22, s: 0.55, l: 1.25, hidden: true };
STYLE_COLORS.ascendWater = { name: 'Ascended', swatch: '#c8f4ff', h: 192, s: 0.5, l: 1.25, hidden: true };
STYLE_COLORS.ascendEarth = { name: 'Ascended', swatch: '#f0dcb8', h: 35, s: 0.45, l: 1.2, hidden: true };
STYLE_COLORS.ascendGrass = { name: 'Ascended', swatch: '#d0ffcc', h: 120, s: 0.45, l: 1.22, hidden: true };
STYLE_COLORS.ascendWind = { name: 'Ascended', swatch: '#c8ffe8', h: 160, s: 0.45, l: 1.25, hidden: true };
STYLE_COLORS.ascendDark = { name: 'Ascended', swatch: '#e0ccff', h: 272, s: 0.45, l: 1.2, hidden: true };
STYLE_COLORS.ascendHoly = { name: 'Ascended', swatch: '#fff2c0', h: 46, s: 0.55, l: 1.42, hidden: true };
const STYLE_IDS = Object.keys(STYLE_COLORS).filter(k => !STYLE_COLORS[k].hidden);
// more of the hero's look (customization / Stylist): skin tone (recolours the skin like hair and outfit), a glow
// around the weapon, an aura at the feet, and a title shown after the name
const SKIN_TONES = {
  orig:  { name: 'Natural', swatch: '#f6cfa4' },
  fair:  { name: 'Fair',    swatch: '#ffe2c8', h: 26, s: 0.55, l: 1.1 },
  olive: { name: 'Olive',   swatch: '#d8b07a', h: 36, s: 0.6,  l: 0.9 },
  tan:   { name: 'Tan',     swatch: '#c8915a', h: 27, s: 0.8,  l: 0.78 },
  brown: { name: 'Brown',   swatch: '#9a643c', h: 24, s: 0.75, l: 0.6 },
  deep:  { name: 'Deep',    swatch: '#6a4026', h: 20, s: 0.65, l: 0.44 },
};
const WEAPON_GLOWS = {
  none:   { name: 'None',   swatch: null },
  flame:  { name: 'Flame',  swatch: '#ff8a3a' },
  frost:  { name: 'Frost',  swatch: '#8ad8ff' },
  storm:  { name: 'Storm',  swatch: '#fff07a' },
  venom:  { name: 'Venom',  swatch: '#9aff5a' },
  shadow: { name: 'Shadow', swatch: '#b08aff' },
  holy:   { name: 'Holy',   swatch: '#ffffff' },
};
const AURAS = {
  none:   { name: 'None',      swatch: null },
  ember:  { name: 'Ember',     swatch: '#ff7a3a' },
  frost:  { name: 'Frost',     swatch: '#7ad0ff' },
  leaf:   { name: 'Verdant',   swatch: '#7aff8a' },
  shadow: { name: 'Shadow',    swatch: '#a07aff' },
  holy:   { name: 'Radiant',   swatch: '#ffe08a' },
  rose:   { name: 'Rose',      swatch: '#ff8ac8' },
};
const TITLES = ['', 'the Brave', 'Card Hunter', 'Dragonheart', 'Shadowstep', 'Stormcaller', 'Iron Will', 'the Wanderer', 'Beastmaster', 'Lightbringer', 'the Unbroken', 'Moonblade'];

// Sum passives from a list of {id, tier, mul} into capped values
function sumPassives(list) {
  const v = {};
  for (const p of list) { if ((p.id === 'regen' || p.id === 'mana') && (p.tier || 0) < REGEN_TIER) continue; v[p.id] = (v[p.id] || 0) + passiveValue(p.id, p.tier) * (p.mul || 1); }   // (regeneration: SSS+ only)
  for (const id in v) v[id] = Math.min(v[id], PASSIVES[id].cap);
  return v;
}

// Full stat block for a player profile (save data)
const SPD_SOFT = 100, CRIT_CAP = 75;   // (crit: combat.js)
function profileStats(pr) {
  const base = CLASS_STATS[pr.cls], lv = pr.lv || 1;
  const st = { hp: base.hp + LV_GROWTH.hp * (lv - 1), mp: base.mp + LV_GROWTH.mp * (lv - 1), atk: base.atk + Math.round(LV_GROWTH.atk * (lv - 1)),
    def: 0, crit: 0, spd: base.spd, look: 0, lv, spellAmp: 0 };
  // spent stat points
  const K = ATTR_K;
  st.atk += Math.round(attrOf(pr, 'str') * K.str);
  st.hp += Math.round(attrOf(pr, 'vit') * K.vitHp); st.def += Math.round(attrOf(pr, 'vit') * K.vitDef * 10) / 10;
  st.mp += Math.round(attrOf(pr, 'int') * K.intMp); st.spellAmp = attrOf(pr, 'int') * K.intAmp;
  st.crit += Math.round(attrOf(pr, 'dex') * K.dex * 10) / 10;
  st.spd += Math.round(attrOf(pr, 'agi') * K.agi * 10) / 10;
  st.cdr = Math.min(FOCUS_CAP, attrOf(pr, 'foc') * K.foc);
  const byId = id => pr.cards.find(c => c.uid === id) || pr.gear.find(g => g.uid === id);
  const passives = [];
  for (const slot of GEAR_SLOTS) {
    const g = byId(pr.eq[slot]);
    if (!g || (g.dur != null && g.dur <= 0)) continue;   // (broken gear gives nothing until it is mended: durability.js)
    for (const k in g.stats) st[k] = (st[k] || 0) + g.stats[k];
    if (slot === 'weapon') st.look = g.look;
    (g.bonus || []).forEach(b => passives.push(b));
  }
  if (typeof relicStats === 'function') { const rb = relicStats(pr); for (const k in rb) st[k] = (st[k] || 0) + rb[k]; }   // relics on the home pedestals
  if (typeof permStats === 'function') permStats(pr, st);   // travellers' permanent blessings
  if (typeof farmStats === 'function') farmStats(pr, st);   // Farmer's Blessing: Farm Level → max HP and ATK
  if (typeof collectionStats === 'function') collectionStats(pr, st);   // finished card sets (collection.js)
  if (typeof restStats === 'function') restStats(pr, st);   // Well Rested, from your own bed (homelife.js)
  if (typeof mealStats === 'function') mealStats(pr, st);   // food buffs: +% ATK / HP / MP, +DEF, +crit (home.js MEAL_FX)
  if (st.spd > SPD_SOFT) st.spd = SPD_SOFT + (st.spd - SPD_SOFT) * 0.5;   // past this, speed counts for half
  passives.push(...setPassives(pr));   // gear sets
  if (typeof relicPassives === 'function') passives.push(...relicPassives(pr));   // the Relic Hall's Resonance (relichall.js)
  for (const id of pr.deck) { const c = byId(id); if (c) passives.push(...cardPassives(c)); }
  const fz = byId(pr.fusion);
  if (fz) passives.push(...cardPassives(fz));
  if (typeof titlePassives === 'function') passives.push(...titlePassives(pr));   // the title you wear (titles.js)
  st.passives = sumPassives(passives);
  st.spells = pr.spells.map(id => { const c = byId(id); return c && !c.fusion ? cardSpell(c) : null; });
  st.fusion = fz && fz.fusion ? fz : null;
  return st;
}

function newProfile(cls) {
  const pr = { cls, lv: 1, exp: 0, cards: [], gear: [], deck: [], spells: [null, null, null], fusion: null, eq: {}, stats: { kills: 0 },
              look: { name: 'Hero', hair: CLASSES[cls].hair, outfit: CLASSES[cls].outfit } };
  if (CLASSES[cls].chef) {   // Chef Daddy starts with his whole kitchen: 7 skill cards + Gourmet Meal, three of them on Q/E/R
    const kit = CHEF_CARDS.map(sp => makeCard(sp, 1));
    pr.cards.push(...kit); pr.deck = kit.map(c => c.uid);
    pr.spells = ['ck1', 'ck4', 'ck7'].map(sp => kit.find(c => c.sp === sp).uid);
    pr.look.name = 'Chef Daddy';
  } else {
    const starters = [makeCard('002', 0), makeCard('009', 0), makeCard('029', 0)];
    pr.cards.push(...starters);
    pr.deck = starters.map(c => c.uid);
    pr.spells = starters.map(c => c.uid);
  }
  const w = makeGear('weapon', 0, cls);
  pr.gear.push(w); pr.eq.weapon = w.uid;
  // home life: a little gold, food for the road and seeds for the farm
  const hpPot = typeof potionIdx === 'function' ? potionIdx(10) : null;   // (three small HP potions to start: a new hero's belt was empty, and a potion costs 10+ kills of gold)
  Object.assign(pr, { gold: 60, hunger: 85, goods: hpPot != null ? { [hpPot]: 3 } : {}, items: { bread: 3, seed_wheat: 4, seed_carrot: 2 }, storage: { cards: [], gear: [] }, relics: [], pedestals: [null, null, null, null, null, null], home: { layout: 0, tint: 0 }, worldSeed: 1 + Math.floor(Math.random() * 2147483646) });
  return pr;
}

// Random build for CPU / P2 at roughly the given tier
function randomProfile(cls, tier) {
  const pr = newProfile(cls);
  pr.cards = []; pr.gear = []; pr.deck = [];
  for (let i = 0; i < 10; i++) {
    const t = clamp(tier + randi(-2, 1), 0, 9);
    pr.cards.push(makeCard(pick(SPECIES_IDS), t));
  }
  if (CLASSES[cls].chef) pr.cards.splice(0, 8, ...CHEF_CARDS.map(sp => makeCard(sp, clamp(tier + randi(-1, 1), 0, 9))));
  pr.deck = pr.cards.map(c => c.uid);
  pr.spells = pr.cards.slice(0, 3).map(c => c.uid);
  const fz = fuseCards([pr.cards[8], pr.cards[9]]);
  pr.cards.push(fz); pr.fusion = fz.uid;
  for (const slot of GEAR_SLOTS) { const g = makeGear(slot, tier, cls); pr.gear.push(g); pr.eq[slot] = g.uid; }
  pr.lv = 1 + tier * 6;
  return pr;
}

// Older saves: 3 gear slots (armor/charm), no levels.
function migrateProfile(pr) {
  if (!pr) return pr;
  pr.lv = pr.lv || 1; pr.exp = pr.exp || 0; pr.attr = pr.attr || {};   // older saves get their points for past levels
  attrFit(pr);   // (points spent under the old 5-a-level rule are handed back to fit 2 a level)
  for (const g of pr.gear) {
    if (g.slot === 'armor') g.slot = 'body';
    if (g.slot === 'charm') g.slot = 'accessory';
    if (g.slot === 'weapon' && CLASSES[g.cls] && CLASSES[g.cls].focus) { g.icon = CLASSES[g.cls].icon; g.name = g.name.replace(/Spellblade|Tome$/, CLASSES[g.cls].weapon); }
  }
  if (pr.eq.armor) { pr.eq.body = pr.eq.armor; delete pr.eq.armor; }
  if (pr.eq.charm) { pr.eq.accessory = pr.eq.charm; delete pr.eq.charm; }
  // home life (older saves start with an empty house)
  pr.gold = pr.gold || 0; pr.items = pr.items || { bread: 2, seed_wheat: 3 }; if (pr.hunger == null) pr.hunger = 80;
  pr.storage = pr.storage || { cards: [], gear: [] }; pr.relics = pr.relics || []; pr.pedestals = pr.pedestals || [null, null, null, null, null, null];
  pr.home = pr.home || { layout: 0, tint: 0 }; if (!pr.worldSeed && typeof WORLD_SEED !== 'undefined') pr.worldSeed = WORLD_SEED;
  return pr;
}
