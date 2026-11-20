'use strict';
// RAID BOSSES AND THEIR CARDS (data only, so cards.html can read it with defs.js; the raids themselves are in raids.js).
// The first five are Zenonia 1 bosses the world never met (char/031-034, 036; tools/build_raid_bosses.py). Seven more were
// added on 2026-11-07, again art neither game ever put in front of a player: Zenonia 1's chest mimic (char/035) and
// Zenonia 2's ice dragon, golden mask, night fiend, clockwork spider, ember imp and demon lord (char/050, 052-055, 057;
// tools/build_raid_bosses2.py). Ordered by level: the haul's gold grows with the place in this list.
const RAIDS = [
  { id: 'mimic',   sp: 'r035',  name: 'The Gilded Mimic',     lv: 55, el: 'earth',     tint: '#3a2a08', col: '#ffd23f', h: 40,  scale: 2.2,  hp: 35, atk: 0.075 },
  { id: 'wyvern',  sp: 'r031',  name: 'Skyrender Wyvern',     lv: 60, el: 'fire',      tint: '#5a1a0a', col: '#ff8a3a', h: 120, scale: 1.0,  hp: 40, atk: 0.08 },
  { id: 'imp',     sp: 'rz055', name: 'Pyrewing, the Ember Imp', lv: 62, el: 'fire',   tint: '#4a1406', col: '#ff7a2a', h: 99,  scale: 1.0,  hp: 42, atk: 0.085 },
  { id: 'claw',    sp: 'r032',  name: 'Umbral Grasp',         lv: 65, el: 'dark',      tint: '#302014', col: '#b07aff', h: 60,  scale: 1.6,  hp: 45, atk: 0.09 },
  { id: 'spider',  sp: 'rz054', name: 'Clockwork Arachnis',   lv: 68, el: 'lightning', tint: '#2c1d12', col: '#bfe8ff', h: 91,  scale: 1.0,  hp: 50, atk: 0.095 },
  { id: 'wyrm',    sp: 'r034',  name: 'Terra Wyrm Gorvath',   lv: 70, el: 'earth',     tint: '#3a2208', col: '#e0a050', h: 110, scale: 1.0,  hp: 55, atk: 0.10 },
  { id: 'fiend',   sp: 'rz053', name: 'The Nightwing Fiend',  lv: 75, el: 'dark',      tint: '#20150d', col: '#7a9aff', h: 99,  scale: 1.0,  hp: 60, atk: 0.105 },
  { id: 'seraph',  sp: 'r036',  name: 'The Fallen Seraph',    lv: 80, el: 'holy',      tint: '#4a311f', col: '#ffe9a8', h: 90,  scale: 1.2,  hp: 65, atk: 0.11 },
  { id: 'oni',     sp: 'rz052', name: 'The Golden Oni Mask',  lv: 85, el: 'holy',      tint: '#2a2008', col: '#ffd860', h: 75,  scale: 1.4,  hp: 72, atk: 0.115 },
  { id: 'maw',     sp: 'r033',  name: 'Oblivion, the Horned Maw', lv: 90, el: 'dark',  tint: '#200818', col: '#ff6ad0', h: 130, scale: 0.9,  hp: 80, atk: 0.12 },
  { id: 'glacier', sp: 'rz050', name: 'Kaltheim, the Glacial Wyrm', lv: 95, el: 'ice', tint: '#302014', col: '#9fe8ff', h: 143, scale: 0.42, hp: 90, atk: 0.125, add: 'rz051' },
  { id: 'lord',    sp: 'rz057', name: 'Azgaroth, the Demon Lord', lv: 99, el: 'dark',  tint: '#200810', col: '#ff4a6a', h: 109, scale: 0.55, hp: 100, atk: 0.13 },
];
// the cards: SSS-only bosses with signature skills (sx), long cooldowns and heavy MP, and a passive to match
const RAID_SPELLS = {
  r031: { n: 'Skyrender Descent', a: 'pillar', el: 'fire',  sig: 'brutal', d: 'The Wyvern dives out of the sky three times down a line of fire, then crashes in a firestorm', short: 'Skyrender Descent: the Wyvern dives three times through your foe and lands in a firestorm.' },
  r032: { n: 'Grasp of the Abyss', a: 'nova', el: 'dark',  sig: 'vamp',   d: 'Shadow claws tear up under six foes at once, drain them, and drag them together', short: 'Grasp of the Abyss: claws rise under six foes, drain their life and drag them together.' },
  r034: { n: 'Wyrmquake',          a: 'quake', el: 'earth', sig: 'unstop', d: 'The Wyrm bursts out of the ground ahead: a long fault of spikes that hurls everything skyward', short: 'Wyrmquake: the Wyrm erupts ahead, a long fault of spikes that hurls foes skyward.' },
  r036: { n: 'Seraphic Judgment',  a: 'rain', el: 'holy',  sig: 'regen',  d: 'The Seraph spreads its wings: you are healed a quarter and shielded, and eight lances of light fall on your foes', short: 'Seraphic Judgment: heal a quarter, a brief shield, and eight lances of light on your foes.' },
  r033: { n: 'Oblivion Maw',       a: 'nova', el: 'dark',  sig: 'last',   d: 'The Horned Maw looms over your foe: five pillars of white fire, then it devours everything in a great ring', short: 'Oblivion Maw: the Maw looms over your foe, five white pillars, then it devours everything around.' },
  r035:  { n: 'Treasure Bite',     a: 'nova', el: 'earth', sig: 'crit',   d: 'The Mimic hops at your foe three times, each landing a bite, and the last bursts in a shower of gold', short: 'Treasure Bite: three hops and bites at your foe, the last in a burst of gold.' },
  rz055: { n: 'Cinder Swarm',      a: 'rain', el: 'fire',  sig: 'burst',  d: 'The Imp beats its burning wings: ten embers rain on your foes and the ground under them catches fire', short: 'Cinder Swarm: ten falling embers on your foes, setting them alight.' },
  rz054: { n: 'Arc Lattice',       a: 'nova', el: 'lightning', sig: 'swift', d: 'The Arachnis spins a web of lightning: a bolt leaps from foe to foe through up to six of them, twice', short: 'Arc Lattice: lightning leaps foe to foe through six of them, twice.' },
  rz053: { n: 'Nightfall Rend',    a: 'nova', el: 'dark',  sig: 'evade',  d: 'Night falls round you and the Fiend swoops through four foes in turn, then the dark closes in a ring', short: 'Nightfall Rend: the Fiend swoops through four foes, then a ring of night.' },
  rz052: { n: 'Thousand-Eye Glare', a: 'pillar', el: 'holy', sig: 'frenzy', d: 'The Golden Mask opens its three eyes over your foe: three beams sweep down and a pillar of gold crashes after', short: 'Thousand-Eye Glare: three golden beams on your foe, then a pillar of gold.' },
  rz050: { n: 'Absolute Zero',     a: 'quake', el: 'ice',  sig: 'hide',   d: 'Kaltheim breathes winter: a ring of ice spikes round your foe freezes everything in it, then shatters', short: 'Absolute Zero: a ring of ice round your foe that freezes, then shatters.' },
  rz057: { n: 'Abyssal Dominion',  a: 'nova', el: 'dark',  sig: 'thorns', d: 'The Demon Lord rises behind you: six pillars of dark fire round your foe, then a crushing ring that pulls them in', short: 'Abyssal Dominion: six dark pillars round your foe, then a crushing ring.' },
};
for (const R of RAIDS) {
  const S = RAID_SPELLS[R.sp];
  SPECIES[R.sp] = { name: R.name, raid: true, hp: 400, dmg: 30, spd: 30, sig: S.sig, trait: 'Raid Sovereign',
    spell: { n: S.n, a: S.a, el: S.el, fx: FX.HOLY, icon: 31, sx: 'raid_' + R.id, mp: 45, cd: 14000, d: S.d, short: S.short, always: true } };
}
// RAID MINIONS with cards of their own: Kaltheim's frost claws (Zenonia 2 char/051) crawl out in its raid instead of shadow
// claws (raids.js raidTick, R.add). A normal monster card, any rank, found by beating them.
SPECIES.rz051 = { name: 'Frost Claw', hp: 60, dmg: 14, spd: 40, sig: 'frost', spell: { n: 'Rime Grasp', a: 'nova', el: 'ice', fx: FX.ICE, icon: 23, d: 'Frost claws burst up round you, chilling everything close' } };
