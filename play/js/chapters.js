'use strict';
// THE MAIN QUEST: one chapter per zone, handed out by a quest giver, each a few steps that send you through the
// zone's places (its safe point, its monsters, a Depths, its Guardian) and on to the next town beyond the seal.
// pr.story = { ch, step, n (a step's counter), key (the chapter's seal key), talked, mini, won } — ch is the chapter
// index, step -1 before it is handed out, -2 once the story is over. The Guardian of a chapter's zone stays warded
// until you hold that chapter's seal key (journey.js). Rewards come as each step completes.
//
//   I   The Road West      Gate Warden (Hearthvale)   → Verdant Fields  → Mossbrook
//   II  The Dimming Woods  Elder of Mossbrook         → Twilight Grove  → Duskhollow   (+ a mini boss of the grove)
//   III The Burning Road   Elder of Duskhollow        → Skyreach Isles    → Cloudhold   (+ arm yourself in Duskhollow)
//   IV  The End of the World  Elder of Cloudhold     → Frozen Abyss    → the Sunscorch Desert (Mirage Springs halfway) →
//       the Sun Temple at its end → Frostmere, then back to the Sun Temple to
//       face the SUN SOVEREIGN, the thing that sealed the lands — and the ending.

const STORY_KEEPER = { hp: 6, atk: 1.3, scale: 1.5 };
const STORY_FINAL = { hp: 18, atk: 1.8, scale: 2.4, lv: 60, name: 'The Sun Sovereign' };
const ROMAN4 = ['I', 'II', 'III', 'IV'];
const ZONE_FIELD = ['the Fields', 'the Grove', 'the Depths', 'the Abyss'];
// the steps every chapter shares, for its zone (k scales the rewards); `extra` steps go after the hunt
function chapterSteps(z, hunt, k, extra = [], early = []) {
  const Z = ZONES[z].name;
  return [
    { id: 'safe', text: `Touch the ${Z} safe point`, done: pr => !!(pr.safePts && pr.safePts[z]),
      target: w => safePoints(w)[z], reward: { exp: 120 * k, gold: 150 * k }, toast: `${Z} is yours to return to.` },
    ...early,
    { id: 'hunt', text: `Defeat monsters in the ${Z}`, need: hunt, done: (pr, S) => S.n >= hunt || !!(pr.cleared && pr.cleared[z]),
      reward: { exp: 350 * k, gold: 250 * k }, toast: 'The land grows quieter. Now, the Depths.' },
    ...extra,
    { id: 'key', text: 'Seal Key: beat the Keeper below {depths}', done: (pr, S) => !!S.key || !!(pr.cleared && pr.cleared[z]),
      target: w => keeperSpot(w, z), reward: { exp: 500 * k, gold: 300 * k, card: Math.min(9, ZONES[z].ranks[1]) }, toast: 'The seal key hums in your hand.' },
    { id: 'guardian', text: `Defeat the Guardian of ${ZONE_FIELD[z]} (Lv ${GUARDIAN_LV[z]})`, done: pr => !!(pr.cleared && pr.cleared[z]),
      target: w => w.guardians && w.guardians[z] && (w.guardians[z].m || w.guardians[z].at), reward: {} },
    { id: 'town', text: `Speak to the Elder of ${OUTPOST_TOWNS[z].name}`, done: (pr, S) => !!S.talked,
      target: () => elderSpot(z), reward: { gold: 600 * k, coins: 5, gear: Math.min(9, ZONES[z].ranks[0] + 2) } },
  ];
}
const CHAPTERS = [
  {
    zone: 0, title: 'Chapter I · The Road West', key: 'Verdant Seal Key',
    giver: { role: 'gate', name: 'Gate Warden' },
    intro: [
      'Off west, are you? Then hear this first, hunter. Every land out there ends in a SEAL across its last bridge.',
      'A Guardian stands before each one. Strike it before you are ready and its ward turns your blade like a wall.',
      'The seal of the Verdant Fields answers to a key, and the beast that keeps it hides below the road, in the Depths.',
      'Learn the Fields first. Find the safe point, thin the monsters, then go down and take that key. Mossbrook waits beyond the seal.',
    ],
    steps: chapterSteps(0, 25, 1, [
      ambushStep(0, 'ambush0', 'Break the ambush on the old road', 5, 'Road Raider', 0.55, { exp: 300, gold: 250 }, 'The road is clear. Pell was right about the Depths.'),
    ], [
      meetStep(0, 'scout', 'Find Scout Pell, lost in the Fields', '110', 'Scout Pell', 0.35, [
        'Hunter? Thank the light. I have been hiding in this grass for two days.',
        'The beasts are not just wild here. Something drives them — out of the Depths, below the road.',
        'There is a pack waiting further along, where the old road bends. They jumped me there. Watch yourself.',
        'And the key the Warden told you of? I saw the thing that keeps it. Big. Bigger than anything in these fields.',
      ], { exp: 150, gold: 120 }, 'Pell heads home. The Fields feel less empty.'),
    ]),
    elder: [
      'The seal is broken? Then the old stories were true — and you are the one they spoke of.',
      'Welcome to Mossbrook, hunter. The house up the road is for sale, the well is sweet, and the merchants are honest.',
      'But the woods beyond us have gone dark. Whatever sealed the lands is waking in Twilight Grove.',
    ],
    outro: 'CHAPTER I COMPLETE — the road to Twilight Grove lies open.',
  },
  {
    zone: 1, title: 'Chapter II · The Dimming Woods', key: 'Twilight Seal Key',
    giver: { town: 0, name: 'Elder of Mossbrook' },
    intro: [
      'The seals were not made to keep monsters in, hunter. They were made to keep something OUT of the lands behind them.',
      'Now they wake one by one, and the light goes out of Twilight Grove a little more each night.',
      'Something rules the grove — a beast grown fat on the dark. Bring it down, and its Guardian will feel it.',
      'Then take the Twilight key from the Depths and break the second seal. Duskhollow keeps its lanterns lit for you.',
    ],
    steps: chapterSteps(1, 30, 3, [
      visitStep(1, 'lanterns', 'Light the three spirit lanterns of the Grove', 'SPIRIT LANTERN', '#9ab0ff', [0.2, 0.55, 0.9], { exp: 700, gold: 400 }, 'The lanterns burn blue. Something in the grove is angry now.',
        ['a cold wind answers', 'the trees lean away from the light', 'far off, something howls']),
      { id: 'mini', text: 'Bring down a mini boss of Twilight Grove', done: (pr, S) => !!S.mini || !!(pr.cleared && pr.cleared[1]),
        reward: { exp: 900, gold: 500 }, toast: 'The grove shudders. Its Guardian has felt that.' },
    ]),
    elder: [
      'Lanterns! Light the lanterns — the hunter has come through the Grove!',
      'You broke two seals, child. Do you feel it? The air is warmer, and the ground… hums.',
      'The old texts say the seals ring a temple at the end of the world. Past the isles in the sky, past the ice, past the burning sands. Something sleeps there.',
    ],
    outro: 'CHAPTER II COMPLETE — the Skyreach Isles rise ahead.',
  },
  {
    zone: 2, title: 'Chapter III · The Road in the Clouds', key: 'Sky Seal Key',
    giver: { town: 1, name: 'Elder of Duskhollow' },
    intro: [
      'Do not walk into the Skyreach Isles in what you are wearing. The wind will strip it off you — and you with it.',
      'Our smith and armorer forge for the road ahead. Spend your gold here, hunter; there is nothing to spend it on in the ash.',
      'Then go: thin the beasts of the isles, take the Sky key from its Keeper, and break the third seal. Cloudhold stands beyond.',
    ],
    steps: chapterSteps(2, 35, 7, [
      meetStep(2, 'skipper', 'Find the stranded Skyskipper Odo', '118', 'Skyskipper Odo', 0.45, [
        'Careful on that edge! Oh — a hunter. Do not mind the wreck. That was my skiff.',
        'Raiders. The isles are crawling with them since the seals started breaking. They took my cargo and my nerve.',
        'They nest on the far rocks. Clear them out and the winds will carry travellers again.',
      ], { exp: 600, gold: 400 }, 'Odo starts patching the skiff.'),
      ambushStep(2, 'raiders', 'Drive the sky raiders off the far rocks', 6, 'Sky Raider', 0.8, { exp: 1200, gold: 800 }, 'The raiders scatter into the clouds.'),
      { id: 'arm', text: 'Arm yourself: buy from Duskhollow\'s Weaponsmith or Armorer', done: pr => (pr.shopBought || []).some(u => String(u).startsWith('tshop1')) || !!(pr.cleared && pr.cleared[2]),
        target: () => { const O = OUTPOSTS[1], S2 = outpostLayout(1).shops.find(s => s.role === 'shop_weapon'); return O && S2 && { x: O.x0 + S2.bx * T + 8, y: O.R.oy * T + S2.by * T + 14 }; },
        reward: { exp: 400, gold: 300 }, toast: 'Forged for the fire. It will have to be enough.' },
    ]),
    elder: [
      'Cloudhold has not seen a traveller from the east in a hundred years. Sit. Drink. You are shaking.',
      'Three seals broken… and the fourth is the last. Beyond it lies the Frozen Abyss — and past the ice, at the far end of the sands, the Sun Temple.',
      'The thing in the temple made the seals. It did not make them to protect us. It made them so no one would come.',
    ],
    outro: 'CHAPTER III COMPLETE — the Frozen Abyss waits.',
  },
  {
    zone: 3, title: 'Chapter IV · The End of the World', key: 'Frozen Seal Key',
    giver: { town: 2, name: 'Elder of Cloudhold' },
    intro: [
      'This is the last of it, hunter. The Frozen Abyss. Nothing lives there that did not choose to.',
      'Arm yourself in our forge — Cloudhold steel is the only thing that holds its edge in that cold.',
      'Take the final key and break the last seal. Past it the ice gives way to sand: the Sunscorch Desert. Rest at Mirage Springs, halfway across, where the water is sweet.',
      'The Sun Temple stands at the far end of the sands, and Frostmere just beyond it — the last hearth at the end of the world.',
      'They will tell you what waits in the temple. I cannot bring myself to say it.',
    ],
    steps: [
      ...chapterSteps(3, 40, 14, [
        visitStep(3, 'shrines', 'Thaw the three frozen shrines of the Abyss', 'FROZEN SHRINE', '#a8e8ff', [0.15, 0.5, 0.85], { exp: 2500, gold: 1500 }, 'The ice groans. The way to the temple is warm again.',
          ['the ice weeps', 'a voice under the ice says your name', 'the third flame lights the way']),
        meetStep(3, 'pilgrim', 'Find the Frozen Pilgrim', '121', 'The Frozen Pilgrim', 0.7, [
          'You lit the shrines. I felt it. I have waited in this cold for forty years for someone to do that.',
          'I was a priest of the Sun Temple, once. We fed it light, and it promised to keep the dark out. It lied.',
          'It does not keep the dark out, hunter. It IS the dark — wearing the sun like a mask.',
          'When you face it, it will burn hottest when it is close to death. Do not stop. Not for anything.',
        ], { exp: 2000, gold: 1200, coins: 3 }, 'The Pilgrim finally closes their eyes and rests.'),
        { id: 'arm', text: 'Arm yourself: buy from Cloudhold\'s Weaponsmith or Armorer', done: pr => (pr.shopBought || []).some(u => String(u).startsWith('tshop2')) || !!(pr.cleared && pr.cleared[3]),
          target: () => { const O = OUTPOSTS[2], S2 = outpostLayout(2).shops.find(s => s.role === 'shop_weapon'); return O && S2 && { x: O.x0 + S2.bx * T + 8, y: O.R.oy * T + S2.by * T + 14 }; },
          reward: { exp: 900, gold: 700 }, toast: 'Cloudhold steel. Cold-forged, cold-proof.' },
      ]),
      { id: 'final', text: `Face the Sun Sovereign in the Sun Temple (Lv ${STORY_FINAL.lv})`, done: (pr, S) => !!S.won,
        target: w => finalSpot(w), reward: { exp: 20000, gold: 20000, coins: 30, card: 9 } },
    ],
    elder: [
      'You… came through the ice. Then it is true. The seals are gone, and nothing stands between us and the temple now.',
      'Listen. The Sun Temple behind you was never a temple. It is a cage — and the Sun Sovereign built it around ITSELF, to sleep.',
      'Every seal you broke was a bar of that cage. It is awake now, hunter. It knows your name.',
      'Go back to the temple and end it — before it ends the world it has been dreaming of eating.',
    ],
    outro: null,   // the story goes on: the final battle
  },
];
// AFTER THE END: two more chapters, given by the Raid Herald, that walk you through the Trials and the raids
CHAPTERS.push({
  zone: null, title: 'Chapter V · Ashes of the Sun', key: null, quiet: true,
  giver: { role: 'raid', name: 'Raid Herald' },
  intro: [
    'You felled the Sun Sovereign, and the shadow that wore your face. Every bard in Hearthvale is singing it. They have the ending wrong.',
    'When it died, its fire did not go out. It went INTO things — the Guardians first, and then into older beasts that slept beyond the Wilds.',
    'Prove you can hold back the Guardians reborn: clear a full Trial of the Sun. Then come to me, and I will open the first two sealed arenas.',
  ],
  steps: [
    goalStep('trial1', 'Clear Trial 1: all four Guardians, then the Sovereign', pr => trialsOpen(pr) && trialState(pr).tier >= 2, { exp: 30000, gold: 20000, coins: 10 }, 'The Herald has heard. The arenas wait.',
      pr => [trialsOpen(pr) ? Math.min(5, trialCount(trialState(pr)) + (trialState(pr).tier >= 2 ? 1 : 0)) : 0, 5]),
    goalStep('wyvern', 'Raid: bring down the Skyrender Wyvern (Lv 60)', pr => ((raidState(pr).wyvern || {}).clears || 0) > 0, { exp: 40000, gold: 25000, coins: 10 }, 'The sky is quiet over Hearthvale tonight.'),
    goalStep('claw', 'Raid: bring down the Umbral Grasp (Lv 65)', pr => ((raidState(pr).claw || {}).clears || 0) > 0, { exp: 50000, gold: 30000, coins: 12 }, 'The shadows lie still.'),
    returnStep('Tell the Raid Herald', { gold: 30000, coins: 15, card: 9 }),
  ],
  elder: [
    'Two of them, gone. I did not think I would live to see it.',
    'But the Sovereign\'s fire runs deepest in three more. The Wyrm under the earth, the Seraph that fell from the sky… and the Maw.',
    'The Maw is the last of it, hunter. Everything that thing ever swallowed is still inside it.',
  ],
  outro: 'CHAPTER V COMPLETE — three arenas remain.',
});
CHAPTERS.push({
  zone: null, title: 'Chapter VI · The Last Light', key: null, quiet: true,
  giver: { role: 'raid', name: 'Raid Herald' },
  intro: [
    'The last three are beyond anything you have faced. The Wyrm, the Seraph, the Maw.',
    'And the Guardians grow with every Trial you clear. Climb to the third Trial, and bring the last three down.',
    'Do that, and the Sovereign\'s fire is out of this world for good.',
  ],
  steps: [
    goalStep('wyrm', 'Raid: bring down Terra Wyrm Gorvath (Lv 70)', pr => ((raidState(pr).wyrm || {}).clears || 0) > 0, { exp: 60000, gold: 35000, coins: 12 }, 'The ground settles.'),
    goalStep('seraph', 'Raid: bring down the Fallen Seraph (Lv 80)', pr => ((raidState(pr).seraph || {}).clears || 0) > 0, { exp: 80000, gold: 40000, coins: 15 }, 'A feather of light drifts down and fades.'),
    goalStep('trial3', 'Reach the third Trial of the Sun', pr => trialsOpen(pr) && trialState(pr).tier >= 3, { exp: 60000, gold: 30000, coins: 10 }, 'The Guardians bow, for now.',
      pr => [trialsOpen(pr) ? Math.min(3, trialState(pr).tier) : 0, 3]),
    goalStep('maw', 'Raid: bring down Oblivion, the Horned Maw (Lv 90)', pr => ((raidState(pr).maw || {}).clears || 0) > 0, { exp: 120000, gold: 60000, coins: 20 }, 'Everything the Maw swallowed comes pouring back out — as light.'),
    returnStep('Tell the Raid Herald', { gold: 100000, coins: 40, card: 9 }),
  ],
  elder: [
    'It is over. Truly over. The last of the Sovereign\'s fire went out when the Maw fell. I felt it in my bones.',
    'Hearthvale will tell this one right, I promise you. Every word.',
    'The raids stay open, hunter — the old beasts still come back to their arenas to be beaten. But the world is safe. Because of you.',
  ],
  outro: 'CHAPTER VI COMPLETE — the last light of the Sun is yours. The story is told.',
});
const ENDING = [
  'Your shadow falls to its knees, and for a moment it looks at you the way you look at yourself in still water. Then it is gone.',
  'The light the Sun Sovereign swallowed pours back into the sky.',
  'Across the lands, the black holes close one by one. The ground stops trembling. Somewhere far to the east, Grandpa looks up from his porch and laughs.',
  'Mossbrook lights its lanterns. Duskhollow sees its first dawn in a century. Cloudhold\'s forges ring. Mirage Springs\' pond sings at night again. Frostmere\'s ice begins, very slowly, to melt.',
  'And you, hunter — you who walked from Hearthvale to the end of the world — you are a legend now.',
  'THE END. Thank you for playing Zenonia Card Hunters. (The Wilds are still out there, and they still bite.)',
];
// a step's line, with {depths} naming the area whose Depths hide the Key Keeper
const stepText = (st, C) => st.text.replace('{depths}', () => { const A = keeperArea(C && C.zone != null ? C.zone : 0); return A ? areaName(A.R) : 'the road'; });
const STORY_SYNCED = new WeakSet();   // (each loaded story is checked once against the chapters as they are now: storyResync)
const storyState = pr => { const S = pr.story = pr.story || { ch: 0, step: -1, n: 0, key: false, talked: false }; if (!STORY_SYNCED.has(S)) { STORY_SYNCED.add(S); storyResync(S); } return S; };
const storyChapter = pr => CHAPTERS[storyState(pr).ch] || null;
const storyStep = pr => { const S = storyState(pr), C = storyChapter(pr); return C && S.step >= 0 ? C.steps[S.step] || null : null; };
const giverMatch = (a, C) => C.giver.town != null ? a.role === 'story' && a.storyTown === C.giver.town : a.role === C.giver.role;
// a chapter's Guardian stays warded until its key is in hand (zones without a chapter need no key)
function storyKeyOk(pr, zi) {
  if (!pr || (pr.cleared && pr.cleared[zi])) return true;
  const ci = CHAPTERS.findIndex(C => C.zone === zi); if (ci < 0) return true;
  const S = storyState(pr); return S.ch > ci || S.step === -2 || (S.ch === ci && !!S.key);
}

// where a zone's Key Keeper waits: the Depths of its first area (nearest the town behind you) that has one
function keeperArea(z = 0) {
  for (const R of zoneAreas(z)) { const u = (R.subs || []).find(u => u.below); if (u) return { R, u }; }
  return null;
}
function keeperSpot(w, z = 0) { const A = keeperArea(z); return A ? sideSpot(w, A.R, A.u, true) : null; }
function elderSpot(i) {
  const O = OUTPOSTS[i]; if (!O) return null;
  const L = outpostLayout(i); return { x: O.x0 + L.square[0] * T, y: O.R.oy * T + (L.elderRow ?? 16) * T };   // (an original-map town has its own row: worldgen.js ORIG_TOWNS)
}
// the Sun Temple's heart, where the Sun Sovereign rises
function finalSpot(w) {
  const R = REGIONS.find(r => r.map === 'z3m'); if (!R) return null;
  return w._finalAt || (w._finalAt = findOpen(w, (R.ox + R.w / 2) * T, (R.oy + R.h / 2) * T));
}

// the quest givers: the chapter's giver hands it out, the next town's Elder closes it (and, in turn, gives the next)
function storyTalk(game, w, a) {
  const pr = game.profile, S = storyState(pr), C = storyChapter(pr);
  const idle = () => { game.openDialog(a.label, S.won ? 'You did it, hunter. Rest now — the world is yours to wander.' : 'Rest well, hunter. The lands beyond still need you.', null); return true; };
  if (!C) return a.role === 'story' ? idle() : false;
  const st = storyStep(pr);
  // the next town's Elder, closing the chapter
  if (a.role === 'story' && a.storyTown === C.zone && st && st.id === 'town') {
    const m = dialogMenu(a.label, C.elder[0], null); m.pages = C.elder.slice(1);
    m.onDone = () => {
      S.talked = true; storyTick(game, w);
      const N = storyChapter(pr);   // the same Elder hands out the next chapter straight away
      if (N && S.step === -1 && giverMatch(a, N)) storyTalk(game, w, a);
    };
    game.openMenu(m); return true;
  }
  if (giverMatch(a, C) && st && st.id === 'return') {
    const m = dialogMenu(C.giver.name, C.elder[0], null); m.pages = C.elder.slice(1);
    m.onDone = () => { S.talked = true; storyTick(game, w); const N = storyChapter(pr); if (N && S.step === -1 && giverMatch(a, N)) storyTalk(game, w, a); };
    game.openMenu(m); return true;
  }
  if (giverMatch(a, C) && S.step === -1) {
    const m = dialogMenu(C.giver.name, C.intro[0], null); m.pages = C.intro.slice(1);
    m.onDone = () => { S.step = 0; S.n = 0; game.toast(`★ ${C.title} — ${stepText(C.steps[0], C)}`, '#ffd23f'); game.save(); };
    game.openMenu(m); return true;
  }
  if (giverMatch(a, C) && st && C.quiet) return false;   // (the Raid Herald opens the raids as usual)
  if (giverMatch(a, C) && st) {
    game.openDialog(C.giver.name, `${C.title}: ${stepText(st, C)}. Go on, hunter — the west will not wait.`, null); return true;
  }
  if (a.role === 'story') { game.openDialog(a.label, 'This town has waited a long time for someone to break the seals.', null); return true; }
  return false;
}

// each world frame: finish steps as their goals are met, and bring out the Keeper or the Sovereign when you come near
function storyTick(game, w) {
  const pr = game.profile; if (!pr || !w.overworld) return;
  const S = storyState(pr), C = storyChapter(pr), st = storyStep(pr); if (!C || !st) return;
  if (S.sid !== st.id) S.sid = st.id;
  if (st.kind) storyBeatTick(game, w, C, st);   // meet, visit, ambush (storybeats.js)
  if (st.id === 'key' && !S.key && !(pr.cleared && pr.cleared[C.zone])) spawnKeeper(game, w, C.zone);
  if (st.id === 'final' && !S.won) { spawnFinal(game, w); const F = w.actors.find(a => a.storyFinal && !a.dead); if (F) { F.ward = (pr.lv || 1) < STORY_FINAL.lv; F.wardWhy = `reach Lv ${STORY_FINAL.lv}`; if (F.wardT > 0) F.wardT -= 16; } }   // warded until you are ready
  if (!st.done(pr, S)) return;
  const R = st.reward || {};
  if (R.exp) game.gainExp(R.exp);
  if (R.gold) pr.gold = (pr.gold || 0) + R.gold;
  if (R.coins) pr.coins = (pr.coins || 0) + R.coins;
  if (R.card != null) game.pickup({ kind: 'card', item: makeCard(pick(ZONES[C.zone != null ? C.zone : 3].mobs.filter(id => D.monsters[id])), R.card) });   // (the chapters after the end draw from the Abyss)
  if (R.gear != null) game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), R.gear, pr.cls) });
  const bits = [R.exp && `${R.exp} EXP`, R.gold && `${R.gold} G`, R.coins && `${R.coins} coins`].filter(Boolean).join(' · ');
  S.step++; S.n = 0; S.sid = C.steps[S.step] && C.steps[S.step].id;
  const next = C.steps[S.step];
  game.toast(`✔ ${stepText(st, C)}${bits ? ` — ${bits}` : ''}`, '#8fffd0');
  if (st.toast) game.toast(st.toast, '#ffe9a8');
  if (next) game.toast(`★ ${stepText(next, C)}`, '#ffd23f');
  else {
    if (C.outro) game.toast(C.outro, '#ffd23f');
    w.flash = { t: 0, dur: 700, col: '#ffe9a8' };
    S.ch++; S.step = CHAPTERS[S.ch] ? -1 : -2; S.key = false; S.talked = false; S.mini = false; S.sid = null;
  }
  game.save();
}
// the Key Keeper: a heavy brute of the zone's toughest kind, one rank above its Depths, alone in the dark
function spawnKeeper(game, w, z) {
  if (w.actors.some(a => a.storyKeeper && !a.dead)) return;
  const A = keeperArea(z), at = keeperSpot(w, z); if (!A || !at) return;
  const p = w.player; if (p.x < A.u.ox * T - 200 || p.x > (A.u.ox + A.u.w) * T + 200) return;   // only near its Depths
  const Z = ZONES[z], sp = Z.mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0];
  const m = makeMonster(sp, Math.min(9, Z.ranks[1] + 1), at.x, at.y);
  Object.assign(m, { boss: true, storyKeeper: true, scale: STORY_KEEPER.scale, heavy: true, label: 'Key Keeper' });
  m.maxHp = m.hp = Math.round(m.maxHp * STORY_KEEPER.hp); m.atk *= STORY_KEEPER.atk; giveWildKit(m);
  m.home = { x: at.x, y: at.y };
  w.actors.push(m);
}
// THE SUN SOVEREIGN: the thing that sealed the lands, risen in the Sun Temple's heart — the last boss
function spawnFinal(game, w) {
  if (w.actors.some(a => a.storyFinal && !a.dead)) return;
  const at = finalSpot(w); if (!at) return;
  const p = w.player; if (Math.abs(p.x - at.x) > 700) return;   // only when you come to the temple
  const Z = ZONES[3], sp = Z.mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0];
  const m = makeMonster(sp, 9, at.x, at.y);
  Object.assign(m, { boss: true, storyFinal: true, scale: STORY_FINAL.scale, heavy: true, label: STORY_FINAL.name, shiny: true });
  m.maxHp = m.hp = Math.round(m.maxHp * STORY_FINAL.hp); m.atk *= STORY_FINAL.atk;
  m.home = { x: at.x, y: at.y }; giveKit(m, 'sovereign'); m.label = STORY_FINAL.name;   // three phases (bosses.js)
  w.actors.push(m);
  if (!w._finalSeen) { w._finalSeen = true; w.shake = Math.max(w.shake || 0, 8); w.flash = { t: 0, dur: 900, col: '#ffe9a8' }; game.toast('THE SUN SOVEREIGN AWAKENS', '#ffd23f'); }
}
// kills: the hunt counts monsters in the chapter's zone; a Keeper drops the key; a mini boss of the zone counts for
// Chapter II; the Sun Sovereign ends the story
function storyKill(game, w, m) {
  storyBeatKill(game, w, m);
  const pr = game.profile, S = storyState(pr), C = storyChapter(pr), st = storyStep(pr); if (!C || !st) return;
  if (m.storyKeeper) { S.key = true; w.rings.push({ x: m.x, y: m.y, r: 40, t: 0, col: '#ffd23f' }); return; }
  if (m.storyFinal) { S.won = true; storyEnding(game, w); return; }
  if (C.zone == null) return;
  if (m.miniBoss && REGIONS[regionIndexAt(m.x)].zone === C.zone) S.mini = true;
  if (st.id === 'hunt' && !m.ally && REGIONS[regionIndexAt(m.x)].zone === C.zone) S.n++;
}
function storyEnding(game, w) {
  const pr = game.profile;
  w.flash = { t: 0, dur: 1800, col: '#ffffff' }; w.shake = Math.max(w.shake || 0, 10);
  storyTick(game, w);   // the final step's rewards
  const m = dialogMenu('Epilogue', ENDING[0], null);
  m.pages = [...ENDING.slice(1), `Your journey took ${fmtPlay(pr.playMs || 0)}, and you finished at level ${pr.lv}.`];
  m.onDone = () => { pr.story.done = true; game.toast('★ THE END — thank you for playing ★', '#ffd23f'); game.toast('☀ The Guardians stir again — the TRIALS OF THE SUN have begun. Press M, then T.', '#ffd23f'); game.save(); };
  game.openMenu(m);
}

// THE TRACKER: the chapter and its step at the top right (over the guild's quests), with a pointer toward the goal:
// a bobbing marker over it when it is on screen, an arrow at the screen's edge when it is not
function storyTrackerH(game) { const pr = game.profile; return pr && (storyStep(pr) || (storyState(pr).step === -1 && storyChapter(pr))) ? 26 : 0; }
function giverSpot(C) {
  if (C.giver.town != null) return elderSpot(C.giver.town);
  const n = TOWN_NPCS.find(q => q.role === C.giver.role); return n && { x: n.x + TOWN_OX, y: n.y + TOWN_OY };
}
function drawStoryTracker(game, w, now) {
  const pr = game.profile; if (!pr || !w || !w.overworld) return;
  const S = storyState(pr), C = storyChapter(pr); if (!C) return;
  const st = storyStep(pr);
  const line = !st ? (C.giver.town != null ? `Talk to the ${C.giver.name}` : `Talk to the ${C.giver.name} in Hearthvale`) : st.prog ? `${stepText(st, C)} ${st.prog(pr, S).join('/')}` : st.need ? `${stepText(st, C)} ${Math.min(S.n, st.need)}/${st.need}` : stepText(st, C);
  { const t1 = `★ ${C.title}${S.step >= 0 ? ` · ${Math.min(S.step + 1, C.steps.length)}/${C.steps.length}` : ''}`, bw = Math.max(textW(t1, 8), textW(line, 7)) + 34, bx = VW - bw;   // (a soft dark backing, fading out to the left, so it reads over bright grass)
    const bg = ctx.createLinearGradient(bx, 0, VW, 0); bg.addColorStop(0, 'rgba(46,28,18,0)'); bg.addColorStop(0.35, 'rgba(46,28,18,0.5)'); bg.addColorStop(1, 'rgba(46,28,18,0.62)');
    ctx.fillStyle = bg; ctx.fillRect(bx, 14, bw, 32);
    const gl = ctx.createLinearGradient(bx + bw * 0.3, 0, VW, 0); gl.addColorStop(0, 'rgba(232,190,100,0)'); gl.addColorStop(1, 'rgba(232,190,100,0.7)');
    ctx.fillStyle = gl; ctx.fillRect(bx + bw * 0.3, 14, bw * 0.7, 0.7); ctx.fillRect(bx + bw * 0.3, 45.3, bw * 0.7, 0.7);
    text(t1, VW - 8, 22, '#ffd23f', 8, 'right'); }   // (the chapter, and which step of it you are on)
  text(line, VW - 8, 32, '#ffffff', 7, 'right'); text('click: journal', VW - 8, 41, 'rgba(255,233,168,0.55)', 5.5, 'right');
  const tgt = !st ? giverSpot(C) : st.target ? st.target(w) : null;
  w.storyGoal = tgt; if (!tgt || !w.cam) return;
  drawGoalPointer(w, tgt, now, '#ffd23f', '#3a2404');
}
// a pointer toward a spot in the world: a bobbing quest bubble over it when it is on screen, an arrow at the screen's edge
// (in its colour, with the distance in tiles) when it is not
function drawGoalPointer(w, tgt, now, col, edge, star = true, slot = 0) {
  const Z = w.zoom || ZOOM, sx = (tgt.x - w.cam.x) * Z, sy = (tgt.y - w.cam.y) * Z, m = 24;
  const on = sx > m && sx < VW - m && sy > m + 20 && sy < VH - 60;
  ctx.save();
  if (on) { ctx.translate(sx, sy - QMARK.npcTop * Z); ctx.scale(Z, Z); drawQuestMark(0, 0, now, star); }
  else {
    const cx = VW / 2, cy = VH / 2, a = Math.atan2(sy - cy, sx - cx);
    const k = Math.min((VW / 2 - m - slot * 18) / Math.abs(Math.cos(a) || 1e-6), (VH / 2 - 50 - slot * 14) / Math.abs(Math.sin(a) || 1e-6));
    const ax = cx + Math.cos(a) * k, ay = Math.max(m + 26, Math.min(VH - 64, cy + Math.sin(a) * k));
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 200);
    ctx.fillStyle = col; ctx.strokeStyle = edge; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const d = Math.round(Math.hypot(tgt.x - w.player.x, tgt.y - w.player.y) / T);
    text(`${d}`, ax - Math.cos(a) * 14, ay - Math.sin(a) * 12, col, 6.5);
  }
  ctx.restore();
}
// BACK TO THE GIVER: once a quest is done, a teal pointer leads to whoever is owed the news (the nearest of them): the Guild
// Master for a finished contract, a side quest's giver for its last word, a camp or a tree whose favour is done
function returnGoals(game, w) {
  const pr = game.profile, out = [], act = f => w.actors.find(f);
  if (pr.quests && pr.quests.active.some(q => q.done)) { const a = act(q => q.role === 'quest'); if (a) out.push({ x: a.x, y: a.y }); }
  if (typeof SIDE_QUESTS !== 'undefined') for (const Q of SIDE_QUESTS) {
    const S = pr.sq && pr.sq[Q.id], st = S && sqStep(pr, Q); if (!st || st.type !== 'talk' || S.step === 0) continue;
    const a = act(q => q.label === st.who); if (a) out.push({ x: a.x, y: a.y }); else { const e = elderSpot(Q.town); if (e) out.push(e); }
  }
  if (typeof zoneDoors === 'function') for (const d of zoneDoors(w)) {
    const S = d.tree ? pr.trees && pr.trees[d.key] : pr.tents && pr.tents[d.key]; if (!S || S.state !== 1 || S.day !== dayNo()) continue;
    if (d.tree ? S.kind !== 'food' && S.have >= S.need : S.have >= TENT.need) out.push({ x: d.x, y: d.y });
  }
  return out;
}
function drawReturnPointer(game, w, now) {
  const pr = game.profile; if (!pr || !w || !w.overworld || !w.cam) return;
  const p = w.player, L = returnGoals(game, w); if (!L.length) return;
  const tgt = L.reduce((b, g) => Math.hypot(g.x - p.x, g.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? g : b);
  if (w.storyGoal && Math.hypot(w.storyGoal.x - tgt.x, w.storyGoal.y - tgt.y) < 40) return;   // (the story's pointer already shows that spot)
  drawGoalPointer(w, tgt, now, '#7affd8', '#063a2a', false, 1);
}

