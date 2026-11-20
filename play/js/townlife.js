'use strict';
// TOWN LIFE: why you stop in a town. Every outpost has its people, who wander about, talk and hand out daily errands,
// and something you can only do there:
//   Mossbrook  the Old Angler's pond: FISHING, a Fish Book of twelve kinds
//   Duskhollow the Lantern Table: CARD DUELS, best of five, against five locals
//   Cloudhold the Master Smith: REFORGING your gear to +5, hammered by hand
//   Frostmere  the Ice Angler's hole: FISHING for twelve kinds of cold-water fish
// All of it earns that town's RENOWN (five levels, each paying gold and coins, the last a card), kept on the Town Crier's
// board. pr.town = { renown: { town: points }, fish: { id: { n, best } }, duels: { id: wins }, errand: { day, list } }.

const TL_RENOWN = [100, 250, 450, 700, 1000];
// each town's windows in its own colours: moss, dusk violet, ember, ice
const TOWN_FRAME = [{ top: '#eaffb8', bot: '#6aa84a', fill: '#141c14' }, { top: '#ecdcff', bot: '#8a6ad8', fill: '#2a1c12' }, { top: '#ffd8a0', bot: '#d8602a', fill: '#201210' }, { top: '#eafaff', bot: '#6ab8e8', fill: '#302014' }];
const tlState = pr => pr.town || (pr.town = { renown: {}, fish: {}, duels: {}, errand: null });
const tlLevel = (pr, i) => { const n = tlState(pr).renown[i] || 0; return TL_RENOWN.filter(v => n >= v).length; };
function tlGain(game, i, n) {
  const pr = game.profile, S = tlState(pr), before = tlLevel(pr, i);
  S.renown[i] = (S.renown[i] || 0) + n;
  for (let L = before + 1; L <= tlLevel(pr, i); L++) {
    const gold = 500 * (i + 1) * L, coins = 3 * L; pr.gold = (pr.gold || 0) + gold; pr.coins = (pr.coins || 0) + coins;
    if (L === TL_RENOWN.length) game.pickup({ kind: 'card', item: makeCard(pick(ZONES[i].mobs.filter(id => D.monsters[id])), Math.min(9, ZONES[i].ranks[1] + 1)) });
    game.toast(`⌂ ${OUTPOST_TOWNS[i].name} Renown ${L}! +${gold} G · +${coins} coins${L === TL_RENOWN.length ? ' · and a rare card' : ''}`, '#ffd27a');
  }
}
// ---------------------------------------------------------------- the people
const TL_FOLK = [
  [ { npc: '102', name: 'Farmer Tilda', x: 14, y: 21, line: 'The mills have not stopped once since the seals started to crack. The wind is wrong.' },
    { npc: '115', name: 'Little Pip', x: 30, y: 22, line: 'I counted the windmill sails to a hundred. Then I lost count. Then I started again!' },
    { npc: '109', name: 'Washer Bree', x: 45, y: 21, line: 'Hang it out by dawn or the Fields will have it smelling of moss by noon.' },
    { npc: '106', name: 'Old Corvin', x: 57, y: 21, line: 'I hunted these Fields before you were born. Fish are harder. Fish think.' } ],
  [ { npc: '110', name: 'Lamplighter Ves', x: 16, y: 21, line: 'Every lamp here is lit by hand. Let one go out and the woods lean closer.' },
    { npc: '117', name: 'Sable the Bard', x: 31, y: 21, line: 'I have a song about the Unseen. Nobody ever stays to the end of it.' },
    { npc: '101', name: 'Herbalist Oona', x: 46, y: 21, line: 'The spirit trees hum at dusk. If you hum back, do not be surprised when they answer.' },
    { npc: '107', name: 'Grandfather Rook', x: 56, y: 21, line: 'Sit at the Lantern Table, hunter. Cards say more about you than steel does.' } ],
  [ { npc: '106', name: 'Foundrywoman Hale', x: 13, y: 21, line: 'Those engines were old when my family came here. We only keep them turning.' },
    { npc: '108', name: 'Ash Trader Dov', x: 30, y: 21, line: 'Everything here is sold with a thumbprint of soot on it. That is how you know it is real.' },
    { npc: '118', name: 'Kiln-Keeper Ira', x: 44, y: 21, line: 'The kings on those pillars never blink. I checked. I check every night.' },
    { npc: '121', name: 'Young Bram', x: 54, y: 21, line: 'The Master says I can hold the hammer once I stop flinching at sparks.' } ],
  [ { npc: '103', name: 'Hearth-Warden Sif', x: 22, y: 21, line: 'The last fire at the end of the world, and it is a very small one. We guard it well.' },
    { npc: '113', name: 'Icewright Olen', x: 38, y: 21, line: 'Good snow packs tight. Good igloos outlast the people who built them.' },
    { npc: '109', name: 'Auntie Ragna', x: 47, y: 21, line: 'Eat. You look like the wind has had you for a week.' },
    { npc: '115', name: 'Tam Two-Mittens', x: 58, y: 21, line: 'I lost a mitten in the crystal garden. It is still there. It is purple now.' } ],
];
const TL_JOBS = [['a basket of bread', 'the road gossip'], ['a letter sealed in wax', 'a borrowed kettle'], ['some news from the Wilds', 'a jar of honey'], ['a mended cloak', 'an old debt, paid at last']];
const TL_SPOT = [
  [{ tl: 'fish', npc: '106', name: 'Old Angler', x: 40, y: 21.4 }, { tl: 'crier', npc: '105', name: 'Town Crier', x: 26, y: 21.2 }],
  [{ tl: 'duel', npc: '113', name: 'Lantern Keeper', x: 38, y: 21.8 }, { tl: 'crier', npc: '105', name: 'Town Crier', x: 42, y: 21.8 }],
  [{ tl: 'forge', npc: '104', name: 'Master Smith', x: 12, y: 21.2 }, { tl: 'crier', npc: '105', name: 'Town Crier', x: 37, y: 21.8 }],
  [{ tl: 'fish', npc: '106', name: 'Ice Angler', x: 28, y: 9.8 }, { tl: 'crier', npc: '105', name: 'Town Crier', x: 33, y: 21.8 }],
];
function townLifeSpawn(w) {
  for (const O of OUTPOSTS) {
    const L = outpostLayout(O.i);
    const put = (P, still, extra) => {
      if (!D.npcs[P.npc]) return;
      // an original-map town (worldgen.js ORIG_TOWNS) is a different shape: the spots, made for the long generated strip, are
      // spread across its width onto its road; the angler goes to its water
      if (L.orig) P = extra && extra.tl === 'fish' && L.angler ? { ...P, x: L.angler[0], y: L.angler[1] } : { ...P, x: 2 + P.x * (L.W - 4) / 70, y: P.y + (L.road[0] - 15) }; const at = findOpen(w, O.x0 + P.x * T + 8, O.R.oy * T + P.y * T + 8), a = baseActor('npc', 2, at.x, at.y);
      Object.assign(a, { npc: P.npc, label: P.name, role: 'tl', town: O.i, h: 26, home: { x: at.x, y: at.y }, ai: { t: rand(0, 3000), still, roam: !still, nightOff: 'favour' in (extra || {}) } }, extra); w.actors.push(a);
    };
    (TL_SPOT[O.i] || []).forEach(P => put(P, true, { tl: P.tl }));
    (TL_FOLK[O.i] || []).forEach(P => put(P, false, { tl: 'folk', line: P.line }));
    folkToday(FOLK.outposts[O.i], OUTPOST_OUT, F => F[2], O.i + 1).forEach(([npc, name, x, y, line, still]) => put({ npc, name, x, y }, !!still, { tl: 'folk', line, favour: !line.includes('(') }));   // the rest of the town (folk.js)
  }
}
// today's errands: in each town, three people each have something for a neighbour
function tlErrands(pr) {
  const S = tlState(pr), today = dayNo();
  if (!S.errand || S.errand.day !== today) {
    const r = rng(today * 31 + 5);
    S.errand = { day: today, list: TL_FOLK.map((F, i) => [0, 1, 2].map(k => { const a = (k + today) % F.length, b = (a + 1 + Math.floor(r() * (F.length - 1))) % F.length; return { from: F[a].name, to: F[b].name, what: TL_JOBS[(k + today + i) % TL_JOBS.length][Math.floor(r() * 2)], state: 0 }; })) };
  }
  return S.errand.list;
}
function townLifeTalk(game, w, a) {
  if (a.role !== 'tl') return false;
  const pr = game.profile, i = a.town;
  if (a.tl === 'fish') { game.openDialog(a.label, i === 0 ? 'Quiet water, good company. Rod is yours if you want it.' : FISH_SET[i] === 2 ? 'Best water in a hundred miles of sand. The fish think so too. Sit, cast, take your time.' : 'The ice is thin here. Whatever is under it is hungry.', null); game.menu.onDone = () => game.openMenu(fishMenu(i)); return true; }
  if (a.tl === 'forge') { game.openDialog(a.label, 'Bring me what you wear. Three clean strokes and it comes back better. Miss, and you only pay for my time.', null); game.menu.onDone = () => game.openMenu(forgeMenu()); return true; }
  if (a.tl === 'duel') { game.openDialog(a.label, 'Five sit at this table. Beat them with what you carry. First to three rounds.', null); game.menu.onDone = () => game.openMenu(duelBoard()); return true; }
  if (a.tl === 'crier') { game.openMenu(crierMenu(i)); return true; }
  if (wellTalk(game, a) || sqTalk(game, a)) return true;   // the quests' people (wellquest.js, sidequests.js)
  const list = tlErrands(pr)[i], going = list.find(e => e.state === 1);
  if (going && going.to === a.label) {
    going.state = 2; const gold = 150 * (i + 1); pr.gold = (pr.gold || 0) + gold; tlGain(game, i, 40); game.gainExp(Math.round(expNeed(pr.lv || 1) * 0.08));
    game.openDialog(a.label, `Oh, ${going.what}, from ${going.from}? Thank you. Here, for your trouble.`, null); game.toast(`Errand done: +${gold} G · +40 Renown`, '#ffd27a'); game.save(); return true;
  }
  const mine = !going && list.find(e => e.state === 0 && e.from === a.label);
  if (mine) { mine.state = 1; game.openDialog(a.label, `Would you take ${mine.what} over to ${mine.to}? They are about town somewhere.`, null); game.toast(`Errand: find ${mine.to}`, '#ffe9a8'); game.save(); return true; }
  game.openDialog(a.label, (typeof lookCompliment === 'function' && lookCompliment(game, a)) || a.line, null); return true;   // (a new look gets noticed: lookchat.js)
}
function crierMenu(town) { return { type: 'tlcrier', town, cur: 0, scroll: 0 }; }
function crierRows(game, m) {
  const pr = game.profile, i = m.town, S = tlState(pr), L = tlLevel(pr, i), jobs = tlErrands(pr)[i], fishN = Object.keys(S.fish).length;
  const Q = SIDE_QUESTS.find(q => q.town === i), st = Q && sqStep(pr, Q), rows = [
    { name: `Renown ${L} of ${TL_RENOWN.length}`, sub: ' ', right: `${S.renown[i] || 0}`, rightCol: '#ffd27a', col: '#ffd27a' },
    ...jobs.map(e => ({ name: e.state === 2 ? `✔ ${e.from} to ${e.to}` : `Errand: ${e.from} to ${e.to}`, sub: e.state === 2 ? 'Done, with thanks' : e.state === 1 ? `Take ${e.what} to ${e.to}` : `Talk to ${e.from}`, right: e.state === 2 ? '' : '+40', dim: e.state === 2 })),
  ];
  const Fv = pr.favours && pr.favours.day === dayNo() ? pr.favours : null; if (Fv) for (const who in Fv.who) if (Fv.who[who] === 1) rows.push({ name: `Favour: ${(Fv.ask || {})[who] || 'something small'}`, sub: `For ${who}`, right: '' });
  if (Q) rows.push({ name: `Side quest: ${Q.name}`, sub: sqDone(pr, Q.id) ? 'Finished' : st ? st.hint : `${Q.giver} is looking for help (level ${Q.lv})`, right: sqDone(pr, Q.id) ? '✔' : '', dim: sqDone(pr, Q.id), col: '#8fd8ff' });
  rows.push({ name: 'Fish Book', sub: 'Mossbrook and Frostmere', right: `${fishN}/${FISH.flat().length}` }, { name: 'Lantern Table', sub: 'Duskhollow card duels', right: `${Object.keys(S.duels).length}/${DUELISTS.length}` });
  return rows;
}
function updateCrier(game, m) { const rows = crierRows(game, m), nav = panelNav(m, rows.length, 0); if (nav.back || nav.ok) game.closeMenu(); }
function drawCrier(game, m, now) {
  const pr = game.profile, S = tlState(pr), L = tlLevel(pr, m.town), n = S.renown[m.town] || 0, a = L ? TL_RENOWN[L - 1] : 0, b = TL_RENOWN[L] || a, k = b > a ? (n - a) / (b - a) : 1;
  panelMenu(m, { title: `${OUTPOST_TOWNS[m.town].name.toUpperCase()} NOTICE BOARD`, rows: crierRows(game, m), gold: pr.gold || 0, keys: 'Enter / Esc: close', frame: TOWN_FRAME[m.town] }, now);
  const x = PM.x + 44, y = PM.y + 34 + 14, w = 190;   // the Renown bar, in its row, with a pip for each level
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, x, y, w, 5, 2); ctx.fill(); ctx.fillStyle = '#ffd27a'; rrect(ctx, x, y, Math.max(2, w * k), 5, 2); ctx.fill();
  for (let i = 0; i < TL_RENOWN.length; i++) { ctx.fillStyle = i < L ? '#ffd23f' : 'rgba(255,255,255,0.2)'; ctx.fillRect(x + w + 8 + i * 8, y, 5, 5); }
}

// ---------------------------------------------------------------- fishing
// Cast, wait, strike on the bite, then hold to keep your catch bar over the fish until the meter fills.
const FISH = [
  [ ['Pond Minnow', 0, 12], ['Mossy Carp', 0, 25], ['Bluegill', 0, 22], ['Reed Pike', 1, 60], ['Windmill Trout', 1, 70], ['Copper Bream', 1, 80], ['Old Boot', 0, 1], ['Moonback Perch', 2, 180], ['Silver Eel', 2, 220], ['Lily King', 3, 500], ['Golden Koi', 3, 700], ['The Old One', 4, 2000] ],
  [ ['Frost Smelt', 0, 60], ['Ice Dace', 0, 70], ['Pale Cod', 0, 80], ['Glass Herring', 1, 220], ['Snowfin', 1, 260], ['Bluefrost Char', 1, 300], ['Frozen Mitten', 0, 1], ['Crystal Sturgeon', 2, 700], ['Abyss Lamprey', 2, 800], ['Aurora Salmon', 3, 1800], ['Glacier Pike', 3, 2200], ['The Deep Sleeper', 4, 6000] ],
  [ ['Date Minnow', 0, 90], ['Sand Carp', 0, 100], ['Palm Gudgeon', 0, 110], ['Dune Barb', 1, 300], ['Mirage Tetra', 1, 340], ['Copper Catfish', 1, 380], ['Lost Sandal', 0, 1], ['Scarab Perch', 2, 900], ['Sand Eel', 2, 1000], ['Sunfish', 3, 2400], ['Oasis Pharaoh', 3, 2800], ['The Well-Singer', 4, 8000] ],   // (Mirage Springs' pond)
].map((L, t) => L.map(([name, rar, gold], k) => ({ id: `${t}.${k}`, name, rar, gold })));
const FISH_RAR = { chance: [50, 28, 14, 6, 2], col: ['#e8e2cf', '#8fffd0', '#6ac8ff', '#c88aff', '#ffd23f'], name: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'], speed: [0.8, 1.1, 1.5, 1.9, 2.5], zone: [64, 56, 48, 42, 34] };
const FISH_SET = { 0: 0, 4: 2 };   // which fish each town's water holds: Mossbrook the pond's, Mirage Springs the oasis's, the rest the ice's
function fishMenu(town) { return { type: 'tlfish', town, set: FISH_SET[town] ?? 1, st: 'wait', t: 0, wait: rand(2000, 6000) }; }
function lakeFish() { const m = fishMenu(0); m.town = null; return m; }   // Hearthvale's lake: Mossbrook's fish, without the Renown
function rollFish(set) {
  let roll = Math.random() * 100, rar = 0; for (const c of FISH_RAR.chance) { if (roll < c) break; roll -= c; rar++; }
  rar = Math.min(rar, 4); return pick(FISH[set].filter(f => f.rar === rar));
}
function updateFish(game, m, dt) {
  m.t += dt; const act = hit('Space', 'Enter', 'KeyJ') || mouse.click, H = 150;
  if (hit('Escape')) { game.closeMenu(); return; }
  if (hit('KeyB') && m.st !== 'reel') { game.closeMenu(); game.openMenu(fishBook(m)); return; }
  if (m.st === 'wait') { if (m.t > m.wait) { m.st = 'bite'; m.t = 0; if (typeof SFX !== 'undefined' && SFX.pickup) SFX.pickup(); } else if (act) { m.st = 'early'; m.t = 0; } }
  else if (m.st === 'early') { if (m.t > 900) Object.assign(m, { st: 'wait', t: 0, wait: rand(2000, 6000) }); }
  else if (m.st === 'bite') {
    if (act) { const f = rollFish(m.set); Object.assign(m, { st: 'reel', t: 0, fish: f, fy: H / 2, fv: 0, fgo: H / 2, bar: H / 2, bv: 0, meter: 0.3 }); }
    else if (m.t > 900) Object.assign(m, { st: 'miss', t: 0 });
  } else if (m.st === 'reel') {
    const k = dt / 16, sp = FISH_RAR.speed[m.fish.rar], zone = FISH_RAR.zone[m.fish.rar];
    if (Math.random() < 0.02 * sp * k) m.fgo = rand(6, H - 6);
    m.fv += (m.fgo - m.fy) * 0.002 * sp * k; m.fv *= 0.94; m.fy = clamp(m.fy + m.fv * k, 4, H - 4);
    m.bv += (isDown('Space', 'Enter', 'KeyJ') || mouse.down ? -0.34 : 0.26) * k; m.bv *= 0.96; m.bar += m.bv * k;
    if (m.bar < zone / 2) { m.bar = zone / 2; m.bv = 0; } if (m.bar > H - zone / 2) { m.bar = H - zone / 2; m.bv = 0; }
    m.meter += (Math.abs(m.fy - m.bar) < zone / 2 ? 0.00012 : -0.0001 * (1 + m.fish.rar * 0.25)) * dt;
    if (m.meter >= 1) catchFish(game, m);
    else if (m.meter <= 0) Object.assign(m, { st: 'miss', t: 0 });
  } else if ((m.st === 'done' || m.st === 'miss') && m.t > 350 && act) Object.assign(m, { st: 'wait', t: 0, wait: rand(2000, 6000), fish: null });
}
function catchFish(game, m) {
  const pr = game.profile, S = tlState(pr), f = m.fish, size = Math.round(rand(10, 30) * (1 + f.rar * 0.6)) , rec = S.fish[f.id], first = !rec;
  S.fish[f.id] = { n: (rec ? rec.n : 0) + 1, best: Math.max(rec ? rec.best : 0, size) };
  const gold = f.gold * (first ? 3 : 1); pr.gold = (pr.gold || 0) + gold; if (m.town != null) tlGain(game, m.town, 4 + f.rar * 4 + (first ? 15 : 0));   // (Hearthvale's lake has no Renown)
  const got = FISH_JUNK[f.id] ? null : f.rar < 2 ? ['fish', 1] : ['prizefish', f.rar > 3 ? 3 : 1]; if (got) { addItem(pr, got[0], got[1]); game.toast(`Caught ${f.name}: +${got[1]} ${ITEMS[got[0]].name}`, '#9fd8ff'); }   // (cook it at a campfire)
  const water = craftFish(pr, f.rar); if (water) game.toast(`The net also brought up ${matName(water)}`, '#9fd8ff');
  Object.assign(m, { st: 'done', t: 0, size, first, gold, got }); game.save();
}
// the scene: a window onto the water with the bobber on it, dusk-blue pond or pale ice, ripples spreading from the float
const FISH_SCENE = [['#7ad0e8', '#2a7ab0', '#123a68'], ['#c8e8f8', '#6aa8d8', '#23487a']];
// the fish themselves: 'Critters of Yonder - Gone Fishing' by Ajiyuu, one 16x16 cell per fish in FISH's order
// (assets/fish_sheet.png). The two bits of junk are the game's own boot and glove icons.
const FISH_SHEET = 'assets/fish_sheet.png', FISH_JUNK = { '0.6': ITEM2_BASE + 568, '1.6': ITEM2_BASE + 480, '2.6': ITEM2_BASE + 568 };
// the oasis fish have no cells of their own: each is one of the sheet's fish in warm desert colours ([row, cell, colour filter])
const FISH_ART = {
  '2.0': [0, 0, 'sepia(0.6) saturate(1.6) hue-rotate(-10deg)'], '2.1': [0, 1, 'sepia(0.35) saturate(1.3) hue-rotate(-8deg)'], '2.2': [1, 1, 'hue-rotate(170deg) saturate(1.2)'],
  '2.3': [0, 3, 'sepia(0.4) saturate(1.5) brightness(1.1)'], '2.4': [1, 3, 'hue-rotate(150deg) saturate(1.6)'], '2.5': [1, 2, 'sepia(0.5) saturate(1.8) hue-rotate(-15deg)'],
  '2.7': [0, 2, 'hue-rotate(35deg) saturate(1.3)'], '2.8': [0, 8, 'sepia(0.7) saturate(1.4) brightness(1.15)'], '2.9': [0, 10, 'hue-rotate(25deg) saturate(1.4) brightness(1.1)'],
  '2.10': [1, 11, 'sepia(0.3) saturate(1.6) brightness(1.15)'], '2.11': [1, 9, 'hue-rotate(40deg) saturate(1.5) brightness(1.2)'],
};
function drawFishIcon(f, x, y, size, opt = {}) {
  const [set, k] = f.id.split('.').map(Number), im = img(FISH_SHEET); ctx.save(); ctx.imageSmoothingEnabled = false;
  const A = FISH_ART[f.id];
  if (opt.hidden) ctx.filter = 'brightness(0) opacity(0.6)'; else if (A) ctx.filter = A[2];
  if (FISH_JUNK[f.id]) iconCentered('items', FISH_JUNK[f.id], x, y, size);
  else if (im && im.complete && im.naturalWidth) ctx.drawImage(im, (A ? A[1] : k) * 16, (A ? A[0] : set) * 16, 16, 16, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  ctx.restore();
}
// the scene's colours: a summer pond at Mossbrook (and Hearthvale's lake), a frozen hole at Frostmere
const FISH_LOOK = [
  { sky: ['#8acff0', '#d4f0ec'], hill: '#6aa860', tree: '#2f6a3a', tree2: '#3f844a', water: ['#6cc0dc', '#4aa0cc', '#2f80bc', '#22669e', '#184e84', '#123e6c'], band: 'rgba(200,240,255,0.55)', pad: ['#2f8a3e', '#5ab84e', '#1e5a2a'], flower: ['#ffb0d0', '#ffe08a'], reed: ['#5a7a2e', '#8aa040'], head: '#7a4a24', wood: ['#5a3a20', '#3e2614', '#7a5230'] },
  { sky: ['#cfe6f6', '#f2faff'], hill: '#eef6fb', tree: '#7ea4bc', tree2: '#a8c4d6', water: ['#9ad4ee', '#78bce4', '#5aa2d4', '#4284be', '#2e68a2', '#22507e'], band: 'rgba(240,252,255,0.6)', pad: ['#e8f6ff', '#ffffff', '#9ac4e0'], flower: null, reed: ['#8a9ca8', '#b8c8d2'], head: '#6a5a50', wood: ['#5a4634', '#3e3024', '#7a6450'] },
  { sky: ['#f6c070', '#fff0c8'], hill: '#e8b868', tree: '#3e7a34', tree2: '#5a9a3e', palm: '#7a5a34', water: ['#7ad8d0', '#52c0c0', '#34a0ac', '#26849a', '#1c6880', '#16526a'], band: 'rgba(230,255,240,0.5)', pad: ['#4a9a40', '#7ac85a', '#2a6a2a'], flower: ['#ffffff', '#ffd27a'], reed: ['#a08440', '#c8a85a'], head: '#8a6a30', wood: ['#7a5430', '#56381e', '#9a7040'] },   // Mirage Springs: a hot sky, sand dunes, palms, a teal pool with white lotus
];
const FISH_FRAME = [['#fff0b0', '#c08a30'], ['#eafaff', '#6ab8e8'], ['#fff4c8', '#e0a040']], FISH_TITLE = ['POND FISHING', 'ICE FISHING', 'OASIS FISHING'];
// a round red-and-white bobber, outlined, with a little stick on top (x, y = where it sits on the water)
function drawBobber(x, y, sunk) {
  const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, w, h); };
  px(0, -11, 1, 3, '#2a1a10');   // the stick
  px(-2, -8, 5, 1, '#2a1a10'); px(-3, -7, 7, 1, '#2a1a10'); px(-3, -7, 1, 7, '#2a1a10'); px(3, -7, 1, 7, '#2a1a10');
  px(-2, -7, 5, 3, '#e83a3a'); px(-2, -7, 2, 1, '#ff9a8a'); px(-2, -4, 5, 1, '#b82222');   // red cap, a highlight, its shade
  if (!sunk) { px(-2, -3, 5, 3, '#f4f0e8'); px(1, -2, 1, 2, '#c8c0b4'); px(-2, 0, 5, 1, '#2a1a10'); }   // the white belly (under water when it dips)
}
function drawFish(game, m, now) {
  const W = 400, H = 250, x0 = VW / 2 - W / 2, y0 = VH / 2 - H / 2, wx = x0 + 18, wy = y0 + 40, ww = W - 36 - (m.st === 'reel' ? 58 : 0), wh = 128, L = FISH_LOOK[m.set], cx = Math.round(wx + ww / 2), cy = wy + 70;
  const [T1, T2] = FISH_FRAME[m.set];   // the frame's colour: gold for Mossbrook, ice for Frostmere, warm sand for Mirage Springs
  ctx.fillStyle = 'rgba(18,12,8,0.6)'; ctx.fillRect(0, 0, VW, VH); kFrame(x0, y0, W, H, { top: T1, bot: T2, fill: L.wood[1] });
  // inside the frame: warm wooden planks, and a lantern at each top corner
  ctx.save(); ctx.beginPath(); ctx.rect(x0 + 6, y0 + 6, W - 12, H - 12); ctx.clip();
  for (let y = y0 + 6, i = 0; y < y0 + H; y += 12, i++) { ctx.fillStyle = i % 2 ? L.wood[0] : L.wood[1]; ctx.fillRect(x0, y, W, 12); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0, y + 11, W, 1); ctx.fillStyle = 'rgba(255,220,170,0.08)'; ctx.fillRect(x0, y, W, 1);
    for (let k = 0; k < 6; k++) { const gx = x0 + ((i * 53 + k * 71) % W); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(gx, y + 4 + (k % 3) * 2, 10 + (k % 4) * 6, 1); } }
  ctx.restore();
  for (const lx of [x0 + 24, x0 + W - 24]) {   // lanterns
    const fl = 0.85 + 0.15 * Math.sin(now / 160 + lx), ly = y0 + 22;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(lx, ly, 1, lx, ly, 40); gl.addColorStop(0, `rgba(255,190,90,${0.35 * fl})`); gl.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = gl; ctx.fillRect(lx - 40, ly - 40, 80, 80); ctx.restore();
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(lx - 4, ly - 6, 9, 12); ctx.fillStyle = `rgba(255,${Math.round(200 * fl)},110,1)`; ctx.fillRect(lx - 3, ly - 4, 7, 8); ctx.fillStyle = '#fff4c8'; ctx.fillRect(lx - 1, ly - 2, 3, 4); ctx.fillStyle = '#2a1a10'; ctx.fillRect(lx - 2, ly - 8, 5, 2); ctx.fillRect(lx, ly - 11, 1, 3);
  }
  goldText(FISH_TITLE[m.set], VW / 2, y0 + 20, 13, { glow: 'rgba(255,200,80,0.5)' }); kDivider(VW / 2, y0 + 20, 62, T1, T2);
  // ---- the pond, in pixels
  ctx.save(); ctx.beginPath(); rrect(ctx, wx, wy, ww, wh, 6); ctx.clip(); ctx.imageSmoothingEnabled = false;
  const sky = ctx.createLinearGradient(0, wy, 0, wy + 24); sky.addColorStop(0, L.sky[0]); sky.addColorStop(1, L.sky[1]); ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, 24);
  const bank = wy + 22;   // the far bank: low hills and a row of round trees
  for (let x = 0; x < ww; x += 2) { const hy = Math.round(5 + 3 * Math.sin(x / 23) + 2 * Math.sin(x / 9 + 1)); ctx.fillStyle = L.hill; ctx.fillRect(wx + x, bank - hy, 2, hy + 2); }
  if (L.palm) for (let k = 0; k < Math.ceil(ww / 30); k++) {   // the oasis: palms on the far bank, a trunk leaning a little and a crown of fronds
    const tx = wx + k * 30 + ((k * 11) % 13), h = 12 + (k % 3) * 3, lean = (k % 2 ? 1 : -1), top = bank - 2 - h;
    ctx.fillStyle = L.palm; for (let j = 0; j < h; j++) ctx.fillRect(tx + Math.round(lean * j * j / (h * 4)), bank - 2 - j, 2, 1);
    const cx2 = tx + Math.round(lean * h / 4) + 1; ctx.fillStyle = k % 2 ? L.tree : L.tree2;
    for (const [dx, dy] of [[-6, 2], [-4, 0], [-2, -1], [0, -2], [2, -1], [4, 0], [6, 2], [-5, 3], [5, 3]]) ctx.fillRect(cx2 + dx - 1, top + dy, 3, 2);
  } else
  for (let k = 0; k < Math.ceil(ww / 18); k++) { const tx = wx + k * 18 + ((k * 7) % 9), r = 5 + (k % 3); ctx.fillStyle = k % 2 ? L.tree : L.tree2; ctx.beginPath(); ctx.arc(tx, bank - 3, r, Math.PI, 0); ctx.fill(); ctx.fillRect(tx - r, bank - 3, r * 2, 3); }
  const top = bank + 1, deep = wy + wh;   // the water: six bands, dithered where they meet
  for (let y = top; y < deep; y++) { const t = (y - top) / (deep - top) * (L.water.length - 1), i = Math.floor(t), f = t - i; for (let x = 0; x < ww; x += 2) { const pick = f > 0.5 && ((x + y) % 4 === 0 || f > 0.8) ? i + 1 : i; ctx.fillStyle = L.water[Math.min(L.water.length - 1, pick)]; ctx.fillRect(wx + x, y, 2, 1); } }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(wx, top, ww, 1);   // the far bank's bright waterline
  for (let i = 0; i < 16; i++) { const ly = top + 6 + ((i * 37) % (deep - top - 10)), len = 6 + (i % 4) * 5, x = wx + ((i * 61 + now / (60 + (i % 3) * 30)) % (ww + len)) - len; ctx.fillStyle = L.band; ctx.fillRect(Math.round(x), ly, len, 1); if (i % 3 === 0) ctx.fillRect(Math.round(x) + 2, ly + 1, len - 4, 1); }   // drifting shimmer
  for (let i = 0; i < 7; i++) { const tw = (Math.sin(now / 260 + i * 2.3) + 1) / 2; if (tw < 0.7) continue; ctx.fillStyle = '#ffffff'; ctx.fillRect(wx + ((i * 89) % ww), top + 4 + ((i * 29) % 40), 1, 1); }   // sparkles
  for (let i = 0; i < 2; i++) { const t = now / (7000 + i * 2600) + i * 0.5, fx = wx + ((t % 1) * (ww + 40)) - 20, fy = top + 40 + i * 26 + Math.sin(now / 900 + i) * 4; ctx.fillStyle = 'rgba(52,34,22,0.28)'; ctx.beginPath(); ctx.ellipse(fx, fy, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(Math.round(fx) - 10, Math.round(fy) - 1, 3, 2); }   // fish shadows gliding by
  for (const [lx, ly, r, fl] of [[0.16, 0.42, 7, 1], [0.27, 0.62, 5, 0], [0.78, 0.36, 6, 0], [0.86, 0.58, 8, 1]]) {   // lily pads (ice floes at Frostmere)
    const X = Math.round(wx + ww * lx), Y = Math.round(wy + wh * ly + Math.sin(now / 1400 + lx * 9)), R = r;
    ctx.fillStyle = L.pad[2]; ctx.beginPath(); ctx.ellipse(X, Y + 1, R, R * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.pad[0]; ctx.beginPath(); ctx.ellipse(X, Y, R, R * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.pad[1]; ctx.fillRect(X - Math.round(R * 0.6), Y - 1, Math.round(R * 0.7), 1);
    if (L.flower) { ctx.fillStyle = L.water[2]; ctx.fillRect(X + 1, Y - 2, Math.round(R * 0.7), 2); if (fl) { ctx.fillStyle = L.flower[0]; ctx.fillRect(X - 2, Y - 4, 4, 3); ctx.fillRect(X - 1, Y - 5, 2, 1); ctx.fillStyle = L.flower[1]; ctx.fillRect(X - 1, Y - 3, 2, 1); } }
  }
  const bite = m.st === 'bite', bob = bite ? Math.round(Math.sin(now / 35) * 2 + 2) : Math.round(Math.sin(now / 420) * 1);
  for (let i = 0; i < 3; i++) { const q = ((now / (bite ? 420 : 1600)) + i / 3) % 1, rx = 6 + q * 30; ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - q)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx + 0.5, cy + 1.5, rx, rx * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }   // ripples round the float
  // the rod over the dock, bottom right, and the line sagging out to the float
  const rbx = wx + ww - 10, rby = wy + wh - 5, rtx = wx + ww - 44, rty = wy + wh - 40;   // the rod: its butt on the dock's corner, its tip out over the water (where the line starts)
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(rtx, rty); ctx.quadraticCurveTo((rtx + cx) / 2, Math.max(rty, cy) + 8, cx, cy - 10 + bob); ctx.stroke();
  drawBobber(cx, cy + bob, bite && Math.sin(now / 35) > 0);
  if (bite) for (let i = 0; i < 5; i++) { const q = ((now / 300) + i / 5) % 1, a = i * 1.3; ctx.fillStyle = `rgba(255,255,255,${1 - q})`; ctx.fillRect(Math.round(cx + Math.cos(a) * (3 + q * 8)), Math.round(cy - 2 - Math.sin(q * Math.PI) * 7), 1, 1); }   // splash
  if (m.st === 'reel') { ctx.globalAlpha = 0.6; drawFishIcon(m.fish, cx + Math.sin(now / 240) * 24, cy + 24 + Math.cos(now / 310) * 6, 32, { hidden: true }); ctx.globalAlpha = 1; }   // its shadow under the water
  for (let k = 0; k < 7; k++) {   // cattails in the near corner, swaying
    const bx = wx + 4 + k * 5 + (k % 2) * 2, h = 18 + (k * 7) % 14, sw = Math.round(Math.sin(now / 900 + k) * 1.5);
    ctx.fillStyle = k % 2 ? L.reed[0] : L.reed[1]; ctx.fillRect(bx, deep - h, 1, h); ctx.fillRect(bx + sw, deep - h - 3, 1, 4);
    if (k % 2 === 0) { ctx.fillStyle = L.head; ctx.fillRect(bx - 1 + sw, deep - h - 9, 3, 6); ctx.fillRect(bx + sw, deep - h - 11, 1, 2); }
  }
  ctx.fillStyle = L.wood[2]; ctx.fillRect(wx + ww - 70, deep - 9, 70, 9); ctx.fillStyle = L.wood[0]; for (let x = wx + ww - 70; x < wx + ww; x += 14) ctx.fillRect(x, deep - 9, 1, 9); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(wx + ww - 70, deep - 9, 70, 1);   // the dock's end
  ctx.fillStyle = L.wood[1]; ctx.fillRect(wx + ww - 62, deep - 12, 4, 12); ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(rbx, rby); ctx.lineTo(rtx, rty); ctx.stroke(); ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(rbx, rby); ctx.lineTo(rtx, rty); ctx.stroke();   // a post, and the rod propped on the dock, its tip where the line starts
  ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(rbx, rby); ctx.lineTo(rbx + (rtx - rbx) * 0.2, rby + (rty - rby) * 0.2); ctx.stroke(); ctx.fillStyle = '#e8e2cf'; ctx.fillRect(Math.round(rbx + (rtx - rbx) * 0.28) - 1, Math.round(rby + (rty - rby) * 0.28) - 1, 3, 3); ctx.restore();   // (the cork handle and the reel)
  if (m.st === 'done') {
    const up = Math.min(1, m.t / 260), f = m.fish, col = FISH_RAR.col[f.rar], [r, g2, b] = cssRgba(col), G = ctx.createRadialGradient(cx, wy + 50, 4, cx, wy + 50, 70); G.addColorStop(0, `rgba(${r},${g2},${b},0.55)`); G.addColorStop(1, `rgba(${r},${g2},${b},0)`);
    ctx.globalAlpha = up; ctx.fillStyle = 'rgba(18,12,8,0.55)'; ctx.fillRect(wx, wy, ww, wh); ctx.fillStyle = G; ctx.fillRect(wx, wy, ww, wh);
    drawFishIcon(f, cx, wy + 50 - (1 - up) * 18, 64); ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 3; rrect(ctx, wx - 1, wy - 1, ww + 2, wh + 2, 7); ctx.stroke();   // a dark wooden rim round the window, then its gold edge
  ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 1; rrect(ctx, wx + 0.5, wy + 0.5, ww - 1, wh - 1, 6); ctx.stroke();
  const ly = wy + wh + 16, msg = (t, c = '#fff0d0', s = 9) => text(t, VW / 2, ly, c, s), sub = t => text(t, VW / 2, ly + 15, '#d8c0a0', 7);
  if (m.st === 'wait') { msg('Waiting for a bite…'); sub('Pressing too soon scares the fish'); }
  else if (m.st === 'early') msg('Too soon! The fish scattered.', '#ff9a7a');
  else if (bite) msg('!!  STRIKE NOW  !!', '#ffd23f', 12);
  else if (m.st === 'miss') { msg('It got away.', '#ff9a7a'); sub('Space: cast again · Esc: leave'); }
  else if (m.st === 'reel') { msg('Hold Space to lift your bar. Keep it on the fish!', '#fff0d0', 8); }
  else if (m.st === 'done') {
    const f = m.fish; if (m.first) text('NEW!', wx + ww - 26, wy + 16, '#ffd23f', 10);
    text(f.name, VW / 2, wy + 92, FISH_RAR.col[f.rar], 11); text(`${FISH_RAR.name[f.rar]} · ${m.size} cm`, VW / 2, wy + 106, '#e8e2cf', 7.5);
    msg(`+${m.gold} G${m.got ? ` · +${m.got[1]} ${ITEMS[m.got[0]].name}` : ''}`, '#ffd23f', 10); sub('Space: cast again · Esc: leave');
  }
  if (m.st === 'reel') {   // the reel: your bar and the fish in a wooden frame, the catch meter beside it
    const px = wx + ww + 16, py = wy, BH = 150, zone = FISH_RAR.zone[m.fish.rar];
    ctx.fillStyle = L.water[5]; rrect(ctx, px - 8, py - 4, 16, BH + 8, 4); ctx.fill(); ctx.strokeStyle = '#c9a85a'; rrect(ctx, px - 7.5, py - 3.5, 15, BH + 7, 4); ctx.stroke();
    const on = Math.abs(m.fy - m.bar) < zone / 2, bg = ctx.createLinearGradient(px - 6, 0, px + 6, 0); bg.addColorStop(0, on ? '#6affb0' : '#7ab0a0'); bg.addColorStop(1, on ? '#2ab070' : '#3a6a60');
    ctx.fillStyle = bg; rrect(ctx, px - 6, py + m.bar - zone / 2, 12, zone, 3); ctx.fill();
    drawFishIcon(m.fish, px, py + m.fy, 16, { hidden: true });
    ctx.fillStyle = L.wood[1]; rrect(ctx, px + 16, py - 4, 9, BH + 8, 3); ctx.fill(); const mg = ctx.createLinearGradient(0, py + BH, 0, py); mg.addColorStop(0, '#ff9a5a'); mg.addColorStop(1, '#8fffd0'); ctx.fillStyle = mg; ctx.fillRect(px + 18, py + BH * (1 - m.meter), 5, BH * m.meter);
  }
  text(`Fish Book ${Object.keys(tlState(game.profile).fish).length} / ${FISH.flat().length}   ·   B: open`, VW / 2, y0 + H - 14, '#e8c890', 7);
}
// the Fish Book: every kind, unknown ones hidden
function fishBook(back) { return { type: 'tlbook', cur: 0, scroll: 0, tab: 0, back }; }
function updateFishBook(game, m) { const rows = FISH[m.tab].length, nav = panelNav(m, rows, FISH.length); if (nav.back || hit('KeyB')) { game.closeMenu(); if (m.back) game.openMenu(m.back); } }
function drawFishBook(game, m, now) {
  const S = tlState(game.profile).fish;
  panelMenu(m, { title: 'FISH BOOK', frame: TOWN_FRAME[[0, 3, 4][m.tab]], tabs: ['Pond', 'Ice', 'Oasis'], keys: '← → pond / ice / oasis · Esc: back · fish art by Ajiyuu', rows: FISH[m.tab].map(f => { const r = S[f.id]; return r ? { name: f.name, sub: `${FISH_RAR.name[f.rar]} · best ${r.best} cm · caught ${r.n}`, right: `${f.gold} G`, col: FISH_RAR.col[f.rar], draw: (x, y) => drawFishIcon(f, x, y, 16) } : { name: '? ? ?', sub: `${FISH_RAR.name[f.rar]} · not caught yet`, dim: true, draw: (x, y) => drawFishIcon(f, x, y, 16, { hidden: true }) }; }) }, now);
}

// ---------------------------------------------------------------- the Master Smith's reforge
const FORGE = { max: 5, boost: 0.08, swing: 0.0016 };
const forgeCost = g => 300 * ((g.plus || 0) + 1) * (g.tier + 1);
function forgeMenu() { return { type: 'tlforge', cur: 0, scroll: 0, ham: null }; }
const forgeGear = pr => GEAR_SLOTS.map(s => pr.gear.find(g => g.uid === pr.eq[s])).filter(Boolean);
function updateForge(game, m, dt) {
  const pr = game.profile, list = forgeGear(pr);
  if (m.ham) {
    const H = m.ham; H.t += dt;
    if (H.show > 0) { H.show -= dt; if (H.show <= 0) { if (H.done) m.ham = null; } return; }
    H.pos = 0.5 + 0.5 * Math.sin(H.t * FORGE.swing * (1 + H.hits.length * 0.35));
    if (hit('Space', 'Enter', 'KeyJ') || mouse.click) {
      const miss = Math.abs(H.pos - 0.5); H.hits.push(miss < 0.05 ? 2 : miss < 0.14 ? 1 : 0);
      if (H.hits.length === 3) finishForge(game, m, H); else H.show = 250;
    }
    if (hit('Escape') && !H.hits.length) m.ham = null;
    return;
  }
  const nav = panelNav(m, list.length, 0); if (nav.back) { game.closeMenu(); return; } if (!nav.ok) return;
  const g = list[m.cur]; if (!g) return;
  if ((g.plus || 0) >= FORGE.max) { game.toast('That piece can take no more', '#c9c1a8'); return; }
  const cost = forgeCost(g); if ((pr.gold || 0) < cost) { game.toast(`Reforging costs ${cost} G — you have ${pr.gold || 0}`, '#ff8a8a'); return; }
  pr.gold -= cost; m.ham = { g, t: 0, pos: 0, hits: [], show: 0, done: false };
}
function finishForge(game, m, H) {
  const score = H.hits.reduce((a, b) => a + b, 0), g = H.g; H.done = true; H.show = 1500;
  if (score < 3) { H.result = 'The metal cools too soon. Nothing gained.'; H.col = '#ff9a7a'; tlGain(game, 2, 6); game.save(); return; }
  const k = 1 + FORGE.boost * (score === 6 ? 2 : 1); g.plus = (g.plus || 0) + 1;
  for (const s in g.stats) g.stats[s] = s === 'crit' || s === 'spd' ? Math.round(g.stats[s] * k * 10) / 10 : Math.ceil(g.stats[s] * k);
  H.result = score === 6 ? `PERFECT! +${g.plus}, double strength` : `Well struck! Now +${g.plus}`; H.col = score === 6 ? '#ffd23f' : '#8fffd0';
  tlGain(game, 2, score === 6 ? 40 : 20); game.refreshPlayer(); game.save();
}
function drawForge(game, m, now) {
  const pr = game.profile, list = forgeGear(pr);
  panelMenu(m, { title: "THE MASTER SMITH'S ANVIL", frame: TOWN_FRAME[2], gold: pr.gold || 0, empty: 'You are wearing nothing to reforge.', keys: '↑↓ choose · Enter reforge · Esc close',
    rows: list.map(g => ({ name: `${g.name}${g.plus ? ' +' + g.plus : ''}`, sub: (g.plus || 0) >= FORGE.max ? 'Fully reforged' : `Three strokes: land them in the middle`, right: (g.plus || 0) >= FORGE.max ? 'MAX' : `${forgeCost(g)} G`, rightCol: (pr.gold || 0) >= forgeCost(g) ? '#ffd23f' : '#ff8a8a' })) }, now);
  const H = m.ham; if (!H) return;
  const W = 340, wh = 170, x0 = VW / 2 - W / 2, y0 = VH / 2 - wh / 2, x = x0 + 30, y = y0 + 84, w = W - 60;
  ctx.fillStyle = 'rgba(6,4,14,0.8)'; ctx.fillRect(0, 0, VW, VH); zWindow(x0, y0, W, wh, TOWN_FRAME[2]);
  const glow = ctx.createRadialGradient(VW / 2, y0 + 150, 4, VW / 2, y0 + 150, 170); glow.addColorStop(0, 'rgba(255,120,40,0.28)'); glow.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = glow; ctx.fillRect(x0, y0, W, wh);
  goldText("THE MASTER'S ANVIL", VW / 2, y0 + 20, 12, { glow: 'rgba(255,160,80,0.5)' }); kDivider(VW / 2, y0 + 20, 74, TOWN_FRAME[2].top, TOWN_FRAME[2].bot);
  text(`${H.g.name}${H.g.plus ? ' +' + H.g.plus : ''}`, VW / 2, y0 + 40, '#ffe9a8', 9); text(H.result ? '' : `Stroke ${Math.min(3, H.hits.length + 1)} of 3: press Space on the gold`, VW / 2, y0 + 54, '#c9b89a', 7);
  ctx.fillStyle = '#0a0a12'; rrect(ctx, x - 2, y - 2, w + 4, 18, 3); ctx.fill(); ctx.strokeStyle = '#c9a85a'; rrect(ctx, x - 1.5, y - 1.5, w + 3, 17, 3); ctx.stroke();
  ctx.fillStyle = '#5a3414'; ctx.fillRect(x, y, w, 14); ctx.fillStyle = '#b06a20'; ctx.fillRect(x + w * 0.36, y, w * 0.28, 14); const gg = ctx.createLinearGradient(0, y, 0, y + 14); gg.addColorStop(0, '#fff0a0'); gg.addColorStop(1, '#e8a820'); ctx.fillStyle = gg; ctx.fillRect(x + w * 0.45, y, w * 0.1, 14);
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 3 * RES; ctx.fillRect(x + w * H.pos - 1.5, y - 4, 3, 22); ctx.shadowBlur = 0;
  if (H.show > 0 && !H.done) { const k = H.show / 250, sx = x + w * H.pos; ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 12; i++) { const an = i * 2.4, r = (1 - k) * (20 + (i % 4) * 8); ctx.fillRect(sx + Math.cos(an) * r, y + 7 + Math.sin(an) * r * 0.7, 2, 2); } }   // sparks off the stroke
  [0, 1, 2].forEach(i => { const v = H.hits[i]; text(v == null ? '○' : ['✖', '✔', '★'][v], VW / 2 - 26 + i * 26, y + 34, v == null ? '#6a6478' : ['#ff8a8a', '#8fffd0', '#ffd23f'][v], 12); });
  if (H.result) text(H.result, VW / 2, y0 + 54, H.col, 9.5);
}

// ---------------------------------------------------------------- the Lantern Table
// Best of five. You are dealt six cards and play one a round; they lay theirs face down. A card scores its rank (+1), +3 if its
// element beats the other's, −2 if the other's beats it, and a little luck; the house adds its skill (edge) and wins ties.
// The better the duelist, the less you see of their card (hint) and the closer their cards come to your best.
const DUELISTS = [
  { id: 'wick', npc: '103', name: 'Wick the Apprentice', rank: 2, gold: 300, edge: 0, hint: 'full', lift: -2 },
  { id: 'marlo', npc: '107', name: 'Marlo Two-Decks', rank: 4, gold: 700, edge: 0.5, hint: 'element', lift: -2 },
  { id: 'ves', npc: '118', name: 'Widow Ves', rank: 5, gold: 1400, edge: 0.75, hint: 'half', lift: -1 },
  { id: 'hollow', npc: '121', name: 'The Hollow Clerk', rank: 7, gold: 2800, edge: 1, hint: 'none', lift: -1 },
  { id: 'keeper', npc: '113', name: 'The Lantern Keeper', rank: 9, gold: 6000, edge: 1.5, hint: 'none', lift: -2 },
];
const DUEL_HINT = { full: 'shows their card', element: 'shows only the element', half: 'shows it every other round', none: 'hides their cards' };
const DUEL_EL = ['fire', 'wind', 'earth', 'lightning', 'ice', 'poison', 'holy', 'dark'];
const elBeats = (a, b) => { const i = DUEL_EL.indexOf(a), n = DUEL_EL.length; return i >= 0 && DUEL_EL[(i + 1) % n] === b; };
const duelScore = (c, o, edge) => c.tier + 1 + (elBeats(cardElement(c), cardElement(o)) ? 3 : 0) - (elBeats(cardElement(o), cardElement(c)) ? 2 : 0) + edge + rand(0, 2);
// how much of their card you see this round
const duelSees = m => { const h = m.who.hint; return h === 'full' ? 2 : h === 'element' ? 1 : h === 'half' ? (m.round % 2 === 0 ? 1 : 0) : 0; };
function duelBoard() { return { type: 'tlboard', cur: 0, scroll: 0 }; }
function updateBoard(game, m) {
  const nav = panelNav(m, DUELISTS.length, 0); if (nav.back) { game.closeMenu(); return; } if (!nav.ok) return;
  const pr = game.profile; if (pr.cards.length < 6) { game.toast('You need six cards to sit at this table', '#ff8a8a'); return; }
  const D2 = DUELISTS[m.cur], sp = ZONES[1].mobs.filter(id => D.monsters[id]), hand = pr.cards.slice().sort(() => Math.random() - 0.5).slice(0, 6);
  const best = Math.max(...hand.map(c => c.tier)), base = Math.max(D2.rank - 1, best + D2.lift);   // (their cards keep up with yours; tuned by simulation to win about 9 in 10 against Wick down to 1 in 4 against the Keeper with a hand at their rank)
  game.closeMenu(); game.openMenu({ type: 'tlduel', who: D2, hand, foe: Array.from({ length: 5 }, () => makeCard(pick(sp), clamp(base + randi(-1, 0), 0, 9))), round: 0, you: 0, them: 0, cur: 0, show: 0, last: null, t: 0, deal: 0 });
}
function drawBoard(game, m, now) {
  const S = tlState(game.profile);
  panelMenu(m, { title: 'THE LANTERN TABLE', frame: TOWN_FRAME[1], gold: game.profile.gold || 0, keys: '↑↓ choose · Enter sit down · Esc leave', rows: DUELISTS.map(d => ({ name: d.name, sub: `Rank ${RANKS[d.rank]}+ · ${DUEL_HINT[d.hint]}${d.edge ? ` · house +${d.edge}` : ''} · ${d.gold} G`, right: S.duels[d.id] ? `${S.duels[d.id]} wins` : 'unbeaten', rightCol: S.duels[d.id] ? '#8fffd0' : '#c9c1a8' })) }, now);
}
function updateDuel(game, m, dt) {
  m.t += dt; m.deal += dt;
  if (m.over) { if (m.t > 300 && (hit('Space', 'Enter', 'Escape') || mouse.click)) { game.closeMenu(); game.openMenu(duelBoard()); } return; }
  if (m.show > 0) { m.show -= dt; if (m.show <= 0) { m.last = null; m.deal = 0; if (m.you >= 3 || m.them >= 3 || m.round >= 5) endDuel(game, m); } return; }
  const k = navInput(), n = m.hand.length; if (k.l) m.cur = (m.cur + n - 1) % n; if (k.r) m.cur = (m.cur + 1) % n;
  let play = k.ok || hit('Space');
  m.hand.forEach((c, i) => { if (clicked(duelX(i, n), 248, 58, 84)) { m.cur = i; play = true; } });
  if (!play) return;
  const c = m.hand.splice(m.cur, 1)[0], f = m.foe[m.round], a = duelScore(c, f, 0), b = duelScore(f, c, m.who.edge);
  const win = a > b; if (win) m.you++; else m.them++;   // (ties go to the house)
  m.round++; m.cur = 0; m.last = { c, f, a, b, win }; m.show = 1900;
}
function endDuel(game, m) {
  const pr = game.profile, S = tlState(pr), id = m.who.id, won = m.you > m.them; m.over = true; m.won = won; m.t = 0;
  if (!won) { m.prize = 'Sit down again when you are ready.'; tlGain(game, 1, 8); return; }
  const first = !S.duels[id]; S.duels[id] = (S.duels[id] || 0) + 1; const gold = first ? m.who.gold : Math.round(m.who.gold * 0.2); pr.gold = (pr.gold || 0) + gold; tlGain(game, 1, first ? 60 : 25);
  if (first) game.pickup({ kind: 'card', item: makeCard(pick(ZONES[1].mobs.filter(s => D.monsters[s])), m.who.rank) });
  m.prize = `+${gold} G${first ? ' and a rank ' + RANKS[m.who.rank] + ' card' : ''}`; game.save();
}
const duelX = (i, n) => VW / 2 - n * 32 + i * 64 + 3;
// the Lantern Table, played out of doors: a meadow of the Wilds' own grass tiles with a forest edge of the game's trees (whole, never
// cut by the top of the screen), bushes and flowers, a plank table with a lantern where the cards are laid, and petals on the breeze.
// The meadow is painted once (DUEL_MEADOW); the rest moves.
const DUEL_LAY = { table: { x: 128, y: 100, w: 384, h: 136 } };
let DUEL_MEADOW = null;
function duelMeadow() {
  if (DUEL_MEADOW) return DUEL_MEADOW;
  const R0 = REGIONS.find(r => r.tileset === 1), ts = tilesetImg(1), t = R0 ? groundTile(R0.map) : null, ob = img(D.objects.img);
  if (!ts || t == null || !ob || !ob.complete) return null;
  const c = document.createElement('canvas'); c.width = VW * RES; c.height = VH * RES; const g = c.getContext('2d'); g.scale(RES, RES); g.imageSmoothingEnabled = false;
  for (let y = 0; y < VH; y += T) for (let x = 0; x < VW; x += T) g.drawImage(ts, (t % 16) * T, Math.floor(t / 16) * T, T, T, x, y, T, T);
  const r = seededRng(4242), put = (bank, fi, x, y) => { const rec = objRec(bank, fi); if (rec) g.drawImage(ob, rec[0], rec[1], rec[2], rec[3], Math.round(x + rec[4]), Math.round(y + rec[5]), rec[2], rec[3]); };
  for (let i = 0; i < 40; i++) put('001', 3, r() * VW, 60 + r() * (VH - 60));   // wildflowers in the grass
  const tree = (fi, x, y) => { const rec = objRec('001', fi); if (rec) put('001', fi, x, Math.max(y, 3 - rec[5])); };   // a tree whose top stays on screen
  for (let x = 0; x < VW; x += 34 + r() * 30) tree(r() < 0.5 ? 1 : 0, x + 10, r() * 8);   // the forest edge: a back row, then a front row
  for (let x = -10; x < VW + 20; x += 26 + r() * 10) tree(r() < 0.5 ? 1 : 2, x, 14 + r() * 14);
  for (const [x, y] of [[30, 120], [612, 110], [24, 330], [618, 340], [110, 350], [530, 352]]) put('011', r() < 0.5 ? 0 : 1, x, y);   // bushes round the meadow
  const v = g.createRadialGradient(VW / 2, VH / 2 + 30, 140, VW / 2, VH / 2, 420); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,30,10,0.35)'); g.fillStyle = v; g.fillRect(0, 0, VW, VH);
  return (DUEL_MEADOW = c);
}
// a pixel plank table: its shadow on the grass, planks with seams, grain and knots, a lit edge, a front apron and legs, the two
// places where the cards are laid, and a small lantern between them
function duelPlanks(now) {
  const B = DUEL_LAY.table, ap = 10;
  ctx.fillStyle = 'rgba(0,30,0,0.35)'; ctx.fillRect(B.x + 6, B.y + B.h + ap, B.w - 4, 8);
  ctx.fillStyle = '#4a2c14'; for (const x of [B.x + 10, B.x + B.w - 18]) ctx.fillRect(x, B.y + B.h, 8, ap + 30);   // legs
  ctx.fillStyle = '#6a4224'; ctx.fillRect(B.x, B.y + B.h, B.w, ap); ctx.fillStyle = '#4a2c14'; ctx.fillRect(B.x, B.y + B.h + ap - 2, B.w, 2);   // the apron
  for (let y = 0, i = 0; y < B.h; y += 17, i++) {   // the planks
    const h = Math.min(17, B.h - y); ctx.fillStyle = i % 2 ? '#9c6a3a' : '#a8743f'; ctx.fillRect(B.x, B.y + y, B.w, h);
    ctx.fillStyle = 'rgba(255,220,160,0.12)'; ctx.fillRect(B.x, B.y + y, B.w, 1); ctx.fillStyle = '#5a3818'; ctx.fillRect(B.x, B.y + y + h - 1, B.w, 1);
    ctx.fillStyle = 'rgba(90,50,20,0.35)'; for (let k = 0; k < 5; k++) { const gx = B.x + ((i * 71 + k * 83) % (B.w - 40)) + 10; ctx.fillRect(gx, B.y + y + 4 + (k % 3) * 4, 18 + (k % 2) * 10, 1); }
    ctx.fillStyle = '#6a4020'; ctx.fillRect(B.x + ((i * 131) % (B.w - 30)) + 15, B.y + y + 7, 3, 2);   // a knot
    ctx.fillStyle = '#5a3818'; ctx.fillRect(B.x + ((i * 97 + 60) % (B.w - 20)) + 10, B.y + y, 1, h);   // a butt joint
  }
  ctx.fillStyle = '#c89058'; ctx.fillRect(B.x, B.y, B.w, 2); ctx.fillStyle = '#4a2c14'; ctx.fillRect(B.x, B.y, 2, B.h + ap); ctx.fillRect(B.x + B.w - 2, B.y, 2, B.h + ap);
  ctx.fillStyle = 'rgba(40,20,8,0.35)'; for (const x of [VW / 2 - 76, VW / 2 + 76]) { rrect(ctx, x - 39, 110, 78, 108, 6); ctx.fill(); }   // the card places
  const lx = VW / 2, ly = 112, fl = 0.8 + 0.2 * Math.sin(now / 130);   // the lantern
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const G = ctx.createRadialGradient(lx, ly, 2, lx, ly, 34); G.addColorStop(0, `rgba(255,190,90,${0.35 * fl})`); G.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = G; ctx.fillRect(lx - 34, ly - 34, 68, 68); ctx.restore();
  ctx.fillStyle = 'rgba(40,20,8,0.4)'; ctx.fillRect(lx - 6, ly + 8, 13, 3);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(lx - 5, ly - 9, 11, 2); ctx.fillRect(lx - 5, ly + 7, 11, 2); ctx.fillRect(lx - 1, ly - 12, 3, 3);
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(lx - 4, ly - 7, 9, 14); ctx.fillStyle = '#fff4c8'; ctx.fillRect(lx - 1, ly - 3 + Math.round(Math.sin(now / 160)), 3, 6);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(lx - 4, ly - 7, 1, 14); ctx.fillRect(lx + 4, ly - 7, 1, 14);
}
function duelTable(now, m) {
  const bg = duelMeadow(); if (bg) ctx.drawImage(bg, 0, 0, VW, VH); else { ctx.fillStyle = '#4a8a3a'; ctx.fillRect(0, 0, VW, VH); }
  duelPlanks(now);
  ctx.fillStyle = 'rgba(12,28,12,0.6)'; rrect(ctx, VW / 2 - 140, 42, 280, 52, 8); ctx.fill();   // soft plates so the words read over the trees and the planks
  if (m && !m.last && !m.over) { ctx.fillStyle = 'rgba(20,10,6,0.62)'; rrect(ctx, VW / 2 - 76 - 76, 138, 152, 50, 6); ctx.fill(); }
  ctx.save();   // petals on the breeze
  for (let i = 0; i < 18; i++) { const k = ((now / (9000 + (i % 4) * 2500)) + i * 0.171) % 1, x = (k * (VW + 60)) - 30, y = (i * 47 + Math.sin(now / 900 + i) * 20 + k * 40) % VH; ctx.fillStyle = i % 3 ? '#ffd8e8' : '#fff4c8'; ctx.globalAlpha = 0.85; ctx.fillRect(Math.round(x), Math.round(y), i % 5 ? 2 : 3, 1); ctx.fillRect(Math.round(x) + 1, Math.round(y) - 1, 1, 1); }
  ctx.restore();
}
// a lantern for each round taken: dark, or lit in the side's colour
function duelPips(x, y, n, col, now) {
  for (let i = 0; i < 3; i++) {
    const lx = x + i * 14, on = i < n;
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const G = ctx.createRadialGradient(lx, y, 1, lx, y, 12); G.addColorStop(0, hexA(col, 0.6)); G.addColorStop(1, hexA(col, 0)); ctx.fillStyle = G; ctx.fillRect(lx - 12, y - 12, 24, 24); ctx.restore(); }
    ctx.fillStyle = '#1a1014'; ctx.fillRect(lx - 3, y - 7, 7, 2); ctx.fillRect(lx, y - 9, 1, 2);
    ctx.fillStyle = on ? col : 'rgba(255,255,255,0.12)'; rrect(ctx, lx - 3.5, y - 5, 8, 10, 2); ctx.fill(); ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 0.8; rrect(ctx, lx - 3.5, y - 5, 8, 10, 2); ctx.stroke();
    if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(lx - 0.5, y - 2 + Math.sin(now / 140 + i) * 0.5, 2, 4); }
  }
}
function drawDuel(game, m, now) {
  duelTable(now, m);
  goldText('THE LANTERN TABLE', VW / 2, 54, 13, { spacing: 2, glow: 'rgba(255,200,80,0.5)' });
  text('YOU', 196, 70, '#8fffd0', 8); duelPips(176, 86, m.you, '#8fffd0', now); text(m.who.name, VW - 196, 70, '#ff9a7a', 8); duelPips(VW - 216, 86, m.them, '#ff9a7a', now);
  text(`Round ${Math.min(5, m.round + (m.last ? 0 : 1))} of 5`, VW / 2, 76, '#c9b89a', 7.5); if (m.who.edge) text(`house +${m.who.edge} · ties to the house`, VW / 2, 87, '#a89070', 6);
  if (m.over) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 118, VW, 96); goldText(m.won ? 'YOU TAKE THE TABLE' : 'THE TABLE IS LOST', VW / 2, 148, 17, { spacing: 2, glow: m.won ? 'rgba(255,200,80,0.7)' : 'rgba(255,90,70,0.6)' });
    text(m.prize, VW / 2, 176, '#e8e2cf', 9.5); text('Space: back to the table', VW / 2, 198, '#a8a0b8', 7); return;
  }
  if (m.last) {   // both cards slide onto their spots, turn over together, then the winner lights up
    const e = 1900 - m.show, sl = Math.min(1, e / 260), ease = 1 - (1 - sl) ** 3, k = Math.max(0, Math.min(1, (e - 260) / 320)), win = m.last.win;
    const yc = 164 + (1 - ease) * 120, yf = 164 - (1 - ease) * 120;
    drawCardFlip(m.last.c, VW / 2 - 76, yc, 70, 100, k, now, false); drawCardFlip(m.last.f, VW / 2 + 76, yf, 70, 100, k, now, false);
    text('VS', VW / 2, 164, '#ffe9a8', 11);
    if (k >= 1) {
      const pop = Math.min(1, (e - 580) / 180), wx = VW / 2 + (win ? -76 : 76), wc = win ? '#8fffd0' : '#ff9a7a';
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const G = ctx.createRadialGradient(wx, 164, 10, wx, 164, 80); G.addColorStop(0, hexA(wc, 0.35 * pop)); G.addColorStop(1, hexA(wc, 0)); ctx.fillStyle = G; ctx.fillRect(wx - 80, 84, 160, 160); ctx.restore();
      ctx.strokeStyle = wc; ctx.lineWidth = 2; rrect(ctx, wx - 37, 112, 74, 104, 6); ctx.stroke();
      text(m.last.a.toFixed(1), VW / 2 - 76, 230, win ? '#8fffd0' : '#a8a0b8', 10 + 3 * pop); text(m.last.b.toFixed(1), VW / 2 + 76, 230, win ? '#a8a0b8' : '#ff9a7a', 10 + 3 * pop);
      goldText(win ? 'ROUND TO YOU' : 'ROUND TO THEM', VW / 2, 252, 11, { glow: win ? 'rgba(120,255,180,0.5)' : 'rgba(255,120,90,0.5)' });
    }
    return;
  }
  const f = m.foe[m.round], fe = cardElement(f), sees = duelSees(m), col = sees ? (EL_THEME[fe] || EL_THEME.holy)[0] : '#8a7a68', best = DUEL_EL.find(e => elBeats(e, fe));
  const dy = Math.min(1, m.deal / 300), slide = (1 - (1 - dy) ** 3);   // their card slides onto its spot, face down
  drawCardBack(VW / 2 + 76 - 35, 114 - (1 - slide) * 90, 70, 100, now, { glow: col, blur: sees ? 8 : 3 });
  if (!sees) text('?', VW / 2 + 76, 164, '#ffe9a8', 18);
  const say = sees === 2 ? [`They hold a ${fe} card, rank ${RANKS[f.tier]}`, `${best ? best[0].toUpperCase() + best.slice(1) : 'Nothing'} beats it.`] : sees === 1 ? [`They hold a ${fe} card`, `${best ? best[0].toUpperCase() + best.slice(1) : 'Nothing'} beats it. Its rank is hidden.`] : ['Their card is face down', 'Read nothing: trust your strongest, or save it'];
  text(say[0], VW / 2 - 76, 150, col, 8); text(say[1], VW / 2 - 76, 164, '#c9b89a', 6.6);
  text(`${m.hand.length} cards · ${5 - m.round} to play`, VW / 2 - 76, 180, '#a89070', 6.4);
  m.hand.forEach((c, i) => {
    const el = cardElement(c), sel = i === m.cur, x = duelX(i, m.hand.length), y = (sel ? 240 : 248) + (1 - slide) * 20, beats = sees && elBeats(el, fe), loses = sees && elBeats(fe, el);
    drawTFCard(c, x, y, 58, 84, now, { name: true, sel }); if (beats) text('▲', x + 52, y + 6, '#8fffd0', 9); if (loses) text('▼', x + 52, y + 6, '#ff8a7a', 9);
    text(el, x + 29, y + 90, (EL_THEME[el] || EL_THEME.holy)[0], 6.2);
  });
  text('← → choose · Enter or click: play', VW / 2, VH - 4, '#9a917c', 6.2);
}
