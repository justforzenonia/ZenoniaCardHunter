'use strict';
// SIDE QUESTS: a story for a landmark in each zone past the first (the first has the well, wellquest.js). Each is a list
// of steps; a person in the town beyond the zone hands it out, and each ends in something found nowhere else.
//   THE LANTERNS GO OUT (Twilight Grove)  Lamplighter Ves   the Sunken Cloister   a card: Lantern Soul
//   THE DEAD ENGINE     (Skyreach Isles)    Foundrywoman Hale the Old Foundry       a weapon: the Foundry Maul
//   THE PURPLE MITTEN   (Frozen Abyss)    Tam Two-Mittens   the Frozen Leviathan  a title and the Frost Charm
//   THE CROOKED GATE    (Verdant Fields)  Old Corvin        the dark teleporters  an S rank buff card and coins
// Steps: talk (to a person, by name) · visit (walk up to a landmark) · hunt (n kills in a zone) · evil (n evil NPCs beaten, evilgate.js) · boss (rises at a
// landmark, with a Guardian's kit, bosses.js). pr.sq = { id: { step, n } }; a quest not in pr.sq has not started.
const SIDE_QUESTS = [
  { id: 'lanterns', name: 'The Lanterns Go Out', lv: 18, zone: 1, town: 1, giver: 'Lamplighter Ves', steps: [
    { type: 'talk', who: 'Lamplighter Ves', say: ['Three lamps went dark last night. I lit them again. They went dark again, and the oil was still full.', 'Something is drinking the light. It comes from the old cloister in the Grove. Would you look?'], hint: 'Talk to Lamplighter Ves in Duskhollow' },
    { type: 'visit', lm: 'The Sunken Cloister', say: ['Every candle stub here has burned out from the inside.', 'Pale wicks hang in the air between the pillars. They were waiting for someone to come.'], hint: 'Go to the Sunken Cloister in Twilight Grove' },
    { type: 'hunt', zone: 1, n: 20, say: 'The wicks scatter into the woods. Thin them out.', hint: 'Hunt the wicks in Twilight Grove' },
    { type: 'boss', lm: 'The Sunken Cloister', label: 'The Wick Wraith', kit: 'unseen', hint: 'Return to the Sunken Cloister', say: 'The last of the light gathers into a shape.' },
    { type: 'talk', who: 'Lamplighter Ves', say: ['The lamps are holding. All of them.', 'This was burning in the Wraith, wasn\'t it? Keep it. A soul like that wants to stay lit.'], hint: 'Tell Lamplighter Ves' },
  ], reward(game) { game.pickup({ kind: 'card', item: makeCard('lanternsoul', 6), force: true }); return 'the LANTERN SOUL card, found nowhere else'; } },
  { id: 'engine', name: 'The Dead Engine', lv: 32, zone: 2, town: 2, giver: 'Foundrywoman Hale', steps: [
    { type: 'talk', who: 'Foundrywoman Hale', say: ['One of the old engines out in the Depths stopped last week. They never stop. Not in my family\'s memory.', 'Go and see what stopped it. I will have the tools ready.'], hint: 'Talk to Foundrywoman Hale in Cloudhold' },
    { type: 'visit', lm: 'The Old Foundry', say: ['The great gears have seized, packed with ash and chewed metal.', 'Whatever did this has been feeding here. Its young are everywhere.'], hint: 'Go to the Old Foundry in the Skyreach Isles' },
    { type: 'hunt', zone: 2, n: 25, say: 'Clear them out of the Depths so the engine can be opened.', hint: 'Clear the Skyreach Isles' },
    { type: 'boss', lm: 'The Old Foundry', label: 'The Engine Heart', kit: 'molten', hint: 'Return to the Old Foundry', say: 'The engine shudders. Something inside it opens its eyes.' },
    { type: 'talk', who: 'Foundrywoman Hale', say: ['I heard it from here. It is turning again.', 'Its core was still hot, so I poured it. This maul is the only one there will ever be. Take it.'], hint: 'Tell Foundrywoman Hale' },
  ], reward(game) {
    const pr = game.profile, g = makeGear('weapon', Math.min(9, (pr.lv >= 45 ? 8 : 7)), pr.cls);
    g.name = 'Foundry Maul'; g.unique = true; for (const s in g.stats) g.stats[s] = Math.ceil(g.stats[s] * 1.3);
    game.pickup({ kind: 'gear', item: g }); return 'the FOUNDRY MAUL, a one-of-a-kind weapon';
  } },
  { id: 'mitten', name: 'The Purple Mitten', lv: 48, zone: 3, town: 3, giver: 'Tam Two-Mittens', steps: [
    { type: 'talk', who: 'Tam Two-Mittens', say: ['I lost a mitten in the Crystal Garden. It is purple now. It was not purple before.', 'Auntie says leave it. But it moved. Mittens do not move. Please?'], hint: 'Talk to Tam Two-Mittens in Frostmere' },
    { type: 'visit', lm: 'The Crystal Garden', say: ['There it is, frozen into a crystal, glowing faintly.', 'A trail of the same purple runs off across the ice, toward the bones.'], hint: 'Go to the Crystal Garden in the Frozen Abyss' },
    { type: 'visit', lm: 'The Frozen Leviathan', say: ['The trail ends under the great skeleton.', 'The ice is thin here, and something below it is breathing. The creatures of the Abyss have felt it too.'], hint: 'Follow the trail to the Frozen Leviathan' },
    { type: 'hunt', zone: 3, n: 25, say: 'They are all coming here. Thin them before it wakes.', hint: 'Hold back the Frozen Abyss' },
    { type: 'boss', lm: 'The Frozen Leviathan', label: 'The Sleeper Beneath', kit: 'glacier', hint: 'Return to the Frozen Leviathan', say: 'The ice splits. The mitten was only ever a lure.' },
    { type: 'talk', who: 'Tam Two-Mittens', say: ['You found it! It is very cold. And very purple. I love it.', 'Auntie says to give you this. It was for the winter, but she says you have had enough winter.'], hint: 'Bring the mitten to Tam' },
  ], reward(game) { game.profile.frostCharm = true; return 'the FROST CHARM (slows and freezes wear off fast) and a new title'; } },
  { id: 'crooked', name: 'The Crooked Gate', lv: 4, zone: 0, town: 0, giver: 'Old Corvin', steps: [
    { type: 'talk', who: 'Old Corvin', say: ['Something has been tearing holes in the Fields. Purple ones. I walked into one by mistake, and I do not make mistakes.', 'There was a robed figure on the far side with a beast at heel, and they were expecting someone. Step through the next one you find and put a stop to three of them.'], hint: 'Talk to Old Corvin in Mossbrook' },
    { type: 'evil', n: 3, say: 'Find a dark teleporter out in the zones and step on it.', hint: 'Beat evil NPCs through dark teleporters' },
    { type: 'talk', who: 'Old Corvin', say: ['Three of them, and you walked back out. The holes have been quieter since.', 'One of them dropped this on my step, the day I got home. I have no use for it. You do.'], hint: 'Tell Old Corvin' },
  ], reward(game) { game.pickup({ kind: 'card', item: makeCard(pick(SUPPORT_CARDS), 6), force: true }); game.profile.coins = (game.profile.coins || 0) + 5; return 'an S rank buff card and 5 summon coins'; } },
];
SPECIES.lanternsoul = { name: 'Lantern Soul', arcana: true, sig: 'mana', trait: 'Keeper of Lamps', spell: Object.assign({}, SPECIES[ARCANA_CARDS.find(id => SPECIES[id].spell.el === 'holy')].spell, { n: 'Lantern Soul', d: 'The Wick Wraith\'s stolen light, let go all at once' }) };
const SQ_NEAR = 130, sqOf = (pr, id) => (pr.sq = pr.sq || {})[id];
const sqStep = (pr, Q) => { const S = sqOf(pr, Q.id); return S && S.step < Q.steps.length ? Q.steps[S.step] : null; };
const sqDone = (pr, id) => { const Q = SIDE_QUESTS.find(q => q.id === id), S = sqOf(pr, id); return !!S && S.step >= Q.steps.length; };
const sqSpots = (w, Q, lm) => { const L = (w.landmarks || []).filter(l => l.z === Q.zone); const named = L.filter(l => l.name === lm); return named.length ? named : L; };   // (a world without that piece: any landmark of the zone)
function sqAdvance(game, Q) {
  const pr = game.profile, S = sqOf(pr, Q.id); S.step++; S.n = 0;
  const st = sqStep(pr, Q);
  if (!st) {
    const what = Q.reward(game), gold = Math.round(1500 * (Q.zone + 1)); pr.gold = (pr.gold || 0) + gold; game.gainExp(expNeed(pr.lv || 1));
    game.toast(`★ ${Q.name} complete! ${what}, ${gold} G`, '#ffd23f');
  } else if (st.type === 'hunt' || st.type === 'evil') game.toast(st.say, '#ffe9a8');
  game.save();
}
function sqDialog(game, name, lines, then) { const m = dialogMenu(name, lines[0], null); m.pages = lines.slice(1); m.onDone = then; game.openMenu(m); }
// a townsperson: starts a quest or takes the next step (townlife.js)
function sqTalk(game, a) {
  const pr = game.profile;
  for (const Q of SIDE_QUESTS) {
    const S = sqOf(pr, Q.id);
    if (!S && Q.giver === a.label) {
      if ((pr.lv || 1) < Q.lv) { game.openDialog(a.label, `${a.line} (Come back at level ${Q.lv}: I may have need of you then.)`, null); return true; }
      pr.sq[Q.id] = { step: 0, n: 0 };
    }
    const st = sqStep(pr, Q); if (!st || st.type !== 'talk' || st.who !== a.label) continue;
    sqDialog(game, a.label, st.say, () => sqAdvance(game, Q)); return true;
  }
  return false;
}
// each world frame: reaching a landmark, and the boss rising there
function sqTick(game, w) {
  const pr = game.profile, p = w.player; if (!pr || !p || !w.overworld) return;
  if (pr.frostCharm && p.status) { if (p.status.slow > 700) p.status.slow = 700; if (p.status.freeze > 700) p.status.freeze = 700; }
  if (game.menu) return;
  for (const Q of SIDE_QUESTS) {
    const st = sqStep(pr, Q); if (!st || (st.type !== 'visit' && st.type !== 'boss')) continue;
    const at = sqSpots(w, Q, st.lm).find(l => Math.hypot(l.x - p.x, l.y - p.y) < SQ_NEAR); if (!at) continue;
    if (st.type === 'visit') { sqDialog(game, Q.name, st.say, () => sqAdvance(game, Q)); return; }
    if (!w.actors.some(a => a.sqBoss === Q.id && !a.dead)) { sqBoss(game, w, Q, st, at); return; }
  }
}
function sqBoss(game, w, Q, st, at) {
  const p = w.player, Z = ZONES[Q.zone], sp = Z.mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0], o = findOpen(w, at.x, at.y), m = makeMonster(sp, Z.ranks[1], o.x, o.y);
  Object.assign(m, { boss: true, sqBoss: Q.id, heavy: true, scale: 1.8, home: { x: o.x, y: o.y } });
  m.maxHp = m.hp = Math.round(Math.max(m.maxHp * 7, p.maxHp * 5)); m.atk *= 1.4;
  giveKit(m, st.kit); m.label = st.label; w.actors.push(m);
  w.rings.push({ x: o.x, y: o.y, r: 50, t: 0, col: '#ffd27a' }); w.shake = Math.max(w.shake || 0, 6); game.toast(st.say, '#ff9a7a');
}
function sqBossKill(game, m) { const Q = SIDE_QUESTS.find(q => q.id === m.sqBoss), st = Q && sqStep(game.profile, Q); if (st && st.type === 'boss') sqAdvance(game, Q); }
function sqEvent(game, type, info) {
  if (type === 'evil') { for (const Q of SIDE_QUESTS) { const st = sqStep(game.profile, Q); if (st && st.type === 'evil' && ++sqOf(game.profile, Q.id).n >= st.n) sqAdvance(game, Q); } return; }
  if (type !== 'kill') return;
  for (const Q of SIDE_QUESTS) { const st = sqStep(game.profile, Q); if (!st || st.type !== 'hunt' || info.zone !== st.zone) continue; const S = sqOf(game.profile, Q.id); if (++S.n >= st.n) sqAdvance(game, Q); }
}
function sqTracker(game, y) {
  const pr = game.profile; if (!pr) return y;
  for (const Q of SIDE_QUESTS) {
    const st = sqStep(pr, Q); if (!st) continue; const S = sqOf(pr, Q.id);
    text(`◆ ${Q.name}`, VW - 8, y, '#8fd8ff', 7.5, 'right'); text(st.n ? `${st.hint} ${S.n}/${st.n}` : st.hint, VW - 8, y + 10, '#fff4d8', 6.6, 'right'); y += 22;
  }
  return y;
}

// ---------------------------------------------------------------- the hollow trees
// THE TREE FOLK: the giant trees have doors (object bank 46, frames 2 and 3), and someone lives in each: a person picked
// from the world seed. Walk in at the trunk (tentfolk.js) and they ask a small favour, a new one each day; do it and they pay 10
// summon coins, enough for a ×10 summon. pr.trees = { key: { day, kind, need, have, state } }, state 0 asked for
// nothing yet, 1 on the job, 2 paid.
const TREE_FOLK = [['101', 'Mira the Wanderer'], ['102', 'Tinker Pip'], ['106', 'Archivist Lena'], ['108', 'Granny Mae'], ['110', 'Little Rosa'], ['112', 'Ranger Faye'], ['114', 'Priestess Sera'], ['117', 'Sister Agnes'], ['118', 'Old Mariner'], ['124', 'Hermit Grumm'], ['125', 'Weaver Ilse'], ['126', 'Veteran Kord']];
const TREE_JOBS = {
  hunt:  { need: 20, ask: 'The beasts outside have been scratching at my door all night. Thin them out? Twenty should do it.', hint: n => `Defeat 20 monsters (${n}/20)` },
  chest: { need: 2, ask: 'I hear the Wilds are full of old chests. Crack open two for me and tell me what the world has been hiding.', hint: n => `Open 2 treasure chests (${n}/2)` },
  mini:  { need: 1, ask: 'Something big has been stamping about out there and my teacups keep falling. Bring down a mini boss for me.', hint: n => `Defeat a mini boss (${n}/1)` },
  cave:  { need: 1, ask: 'There is a hole in the sky again. I can hear it from in here. Go in and finish what is at the bottom of it.', hint: n => `Beat a black hole's boss (${n}/1)` },
  food:  { need: 6, ask: 'The larder is bare, and I do not go out. Six bits of food would see me through. Crops, bread, anything.', hint: () => 'Bring 6 food to the tree' },
};
const TREE_PAY = 10, treeKey = o => `${o.x}:${o.bottom}`;
function treeState(pr, key) {
  const T = pr.trees || (pr.trees = {}), today = dayNo(); let S = T[key];
  if (!S || S.day !== today) {
    const r = seededRng((WORLD_SEED ^ (today * 7919)) + key.split(':').reduce((a, b) => a * 31 + +b, 0)), kinds = Object.keys(TREE_JOBS), kind = kinds[Math.floor(r() * kinds.length)];
    S = T[key] = { day: today, kind, need: TREE_JOBS[kind].need, have: 0, state: 0 };
  }
  return S;
}
const treePerson = key => TREE_FOLK[Math.abs(key.split(':').reduce((a, b) => (a * 31 + Math.round(+b) + WORLD_SEED) | 0, 7)) % TREE_FOLK.length];
// walking in at the trunk (tentfolk.js)
function treeInteract(game, w, o) {
  const key = treeKey(o), [npc, label] = treePerson(key), f = objRec('046', o.fi);
  if (!MAPS.int_home1 || !D.npcs[npc]) return false;
  const cx = o.x + f[4] + f[2] / 2, out = findOpen(w, cx, o.bottom + 22);   // (you come back out on open ground below the door)
  enterHouse(game, { key: 'int_home1', role: 'tree', npc, label, treeKey: key, place: `${label}'s Tree`, x: out.x, y: out.y - 16 });
  return true;
}
// talking to whoever lives there (world.js townInteract)
function treeTalk(game, w, a) {
  if (a.role !== 'tree' || !w.door) return false;
  const pr = game.profile, S = treeState(pr, w.door.treeKey), J = TREE_JOBS[S.kind];
  if (S.state === 2) { game.openDialog(a.label, 'Thank you again. Come by tomorrow, I am sure to need something.', null); return true; }
  if (S.state === 0) { S.state = 1; game.openDialog(a.label, `${J.ask} I can pay in summon coins, ${TREE_PAY} of them.`, null); game.save(); return true; }
  if (S.kind === 'food' && !payFood(pr, S.need)) { game.openDialog(a.label, `Six bits of food, if you can. You are carrying ${edibleCount(pr)}.`, null); return true; }
  if (S.kind !== 'food' && S.have < S.need) { game.openDialog(a.label, `Still at it? ${J.hint(S.have)}.`, null); return true; }
  S.state = 2; pr.coins = (pr.coins || 0) + TREE_PAY; game.openDialog(a.label, `Just what I needed. Here: ${TREE_PAY} summon coins, as promised. Spend them well.`, null);
  game.toast(`★ +${TREE_PAY} summon coins: enough for a ×10 summon!`, '#ffd23f'); game.save(); return true;
}
function treeEvent(game, type, info) {
  const T = game.profile.trees; if (!T) return;
  for (const k in T) { const S = T[k]; if (S.state !== 1 || S.day !== dayNo()) continue;
    if ((S.kind === 'hunt' && type === 'kill') || (S.kind === 'mini' && type === 'kill' && info.mini) || S.kind === type) S.have = Math.min(S.need, S.have + 1); }
}
function treeTracker(game, y) {
  const T = game.profile && game.profile.trees; if (!T) return y;
  for (const k in T) { const S = T[k]; if (S.state !== 1 || S.day !== dayNo()) continue;
    const ready = S.kind !== 'food' && S.have >= S.need; text('◆ A Favour for the Tree Folk', VW - 8, y, '#8fffd0', 7.5, 'right'); text(ready ? 'Go back to the tree for your coins' : TREE_JOBS[S.kind].hint(S.have), VW - 8, y + 10, '#fff4d8', 6.6, 'right'); y += 22; }
  return y;
}
