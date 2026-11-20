'use strict';
// WANDERERS: each trip out, every zone gets two travellers — villagers far from home, marked with a gold "!" — in two
// random areas of the zone, never next to each other. Walk up and press Enter for something random:
//   BLESSING    a permanent boost (ATK, max HP, DEF or crit), bigger in the later zones          ~45%
//   GEAR        a high-grade piece of gear (the zone's top rank +1), dropped at your feet         ~40%
//   QUEST       now and then a BLACK HOLE QUEST, only done inside a black hole                    ~15%
// Black hole quests: you carry up to three; they show in the quest tracker (violet), and the reward (gold, coins and
// a card) comes the moment the boss falls.
//   SLAY        defeat a black hole boss
//   RANKED      defeat a black hole boss of rank X or higher (let the hole feed first)
//   SWIFT       defeat a black hole boss within 60 s of stepping in
//   UNSCATHED   defeat a black hole boss without dropping below half HP

const WANDER_NPCS = ['101', '102', '103', '105', '106', '108', '109', '110', '112', '113', '114', '115', '117', '118', '119', '121', '124', '125', '126', 'z044', 'z048', 'z075', 'z079', 'z082', 'z084', 'z085', 'z113', 'z116', 'z117', '131'];
const HOLE_QUESTS = {
  slay:      { title: 'Into the Dark',    line: () => 'Defeat a black hole boss' },
  ranked:    { title: 'Fed to the Brim',  line: q => `Defeat a rank ${RANKS[q.rank]}+ black hole boss` },
  swift:     { title: 'In and Out',       line: () => 'Defeat a black hole boss within 60 s' },
  unscathed: { title: 'Not a Scratch',    line: () => 'Defeat a black hole boss above half HP' },
};
const HOLE_QUEST_MAX = 3;
// the permanent blessings a traveller can grant (pr.perm, added to your stats in profileStats); bigger in later zones
const BLESSINGS = [
  { k: 'atk', amt: z => 1 + z, fmt: v => `+${v} ATK` },
  { k: 'hp', amt: z => 12 + z * 10, fmt: v => `+${v} max HP` },
  { k: 'def', amt: z => 1 + z, fmt: v => `+${v} DEF` },
  { k: 'crit', amt: z => 1, fmt: v => `+${v}% crit` },
];
function permStats(pr, st) { const P = pr.perm; if (!P) return; for (const k in P) st[k] = (st[k] || 0) + P[k]; }
const WANDER_LINES = {
  give: ['A black hole swallowed my caravan. Go in and {q} — please!', 'They say heroes are made inside black holes. Prove it: {q}.',
         'I will pay well if you {q}. Only the brave come back out.'],
  full: ['You already carry three such tasks — finish one first.'],
  gear: ['I have no use for this any more. Take it — it is fine work.', 'Found this in a ruin. It will serve you better than me.'],
  bless: ['Kneel, hunter… there. A blessing from the old ways — it will never leave you.', 'Let me share a little of my strength. Keep it always.'],
  done: ['Safe travels, hunter.', 'Thank you again!', 'May the dark spit you back out.'],
};
const wanderName = id => { const c = NPC_CARDS && NPC_CARDS['n' + id]; return c ? c[1] : 'Traveller'; };

function updateWanderers(game, w, dt) {
  if (!w.overworld || w.interior) return;
  w.wanderT = (w.wanderT || 0) - dt; if (w.wanderT > 0) return; w.wanderT = 500;
  const p = w.player, R = regionAt(p.x);
  w.wanderers = w.wanderers || {}; w.wanderPlan = w.wanderPlan || {};
  if (inTown(p.x)) { w.wanderers = {}; w.wanderPlan = {}; return; }   // back home: a fresh set next trip
  if (!R || R.zone < 0) return;
  if (!w.wanderPlan[R.zone]) {   // this trip's two areas for the zone: random, at least one area apart
    const keys = zoneRegions(R.zone).filter(q => !q.subOf).sort((a, b) => a.ox - b.ox).map(q => q.key);
    const a = randi(0, keys.length - 1); let b = a;
    for (let k = 0; k < 40 && Math.abs(b - a) < 2; k++) b = randi(0, keys.length - 1);
    w.wanderPlan[R.zone] = Math.abs(b - a) >= 2 ? [keys[a], keys[b]] : [keys[a]];
  }
  if (!w.wanderPlan[R.zone].includes(R.key) || w.wanderers[R.key]) return;
  for (let k = 0; k < 80; k++) {   // somewhere open in this area
    const x = (R.ox + rand(3, R.w - 3)) * T, y = (R.oy + rand(3, R.h - 3)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || w.blocked(x, y - 10) || Math.hypot(x - p.x, y - p.y) < 90) continue;
    const id = pick(WANDER_NPCS.filter(i => D.npcs[i])), a = baseActor('npc', 2, x, y);
    Object.assign(a, { npc: id, label: wanderName(id), h: 26, home: { x, y }, ai: { t: rand(0, 2000), still: true },   // (they stand where you find them: some travellers' walking frames leave their gear floating)
      wanderer: { done: false, zone: R.zone, key: R.key }, marker: '#ffd23f' });
    w.actors.push(a); w.wanderers[R.key] = a;
    return;
  }
  w.wanderers[R.key] = 'none';
}
function nearWanderer(w) {
  const p = w.player; let best = null, bd = 34;
  for (const a of w.actors) if (a.wanderer && !a.remove) { const d = dist(a, p); if (d < bd) { bd = d; best = a; } }
  return best;
}
function makeHoleQuest(zone, from) {
  const kind = pick(Object.keys(HOLE_QUESTS)), Z = ZONES[zone];
  const q = { kind, from, zone, rank: Math.min(9, Z.ranks[0] + 2), gold: 120 + zone * 90, coins: 1 + zone, cardRank: Math.min(9, Z.ranks[0] + 1) };
  q.title = HOLE_QUESTS[kind].title; q.line = HOLE_QUESTS[kind].line(q);
  return q;
}
function wandererInteract(game, w) {
  const a = nearWanderer(w); if (!a) return false;
  const W = a.wanderer, pr = game.profile, p = w.player;
  a.dir = dirTo(p.x - a.x, p.y - a.y);
  if (W.done) { game.openDialog(a.label, pick(WANDER_LINES.done), null); return true; }
  pr.holeQuests = pr.holeQuests || [];
  const roll = Math.random(), z = W.zone;
  W.done = true; a.marker = null;
  if (roll < 0.15 && pr.holeQuests.length < HOLE_QUEST_MAX) {   // now and then: a black hole quest
    const q = makeHoleQuest(z, a.label); pr.holeQuests.push(q);
    game.openDialog(a.label, pick(WANDER_LINES.give).replace('{q}', q.line.charAt(0).toLowerCase() + q.line.slice(1)), null);
    game.toast(`BLACK HOLE QUEST: ${q.line} · reward ${q.gold} G, ${q.coins} coin${q.coins > 1 ? 's' : ''} and a card`, '#c890ff');
  } else if (roll < 0.55) {   // high-grade gear
    const g = makeGear(pick(GEAR_SLOTS), Math.min(9, ZONES[z].ranks[1] + 1), pr.cls);
    w.drops.push({ kind: 'gear', item: g, x: p.x, y: p.y + 8 });
    game.openDialog(a.label, pick(WANDER_LINES.gear), null);
    game.toast(`${a.label} gave you ${g.name} [${RANKS[g.tier]}]`, rankColor(g.tier));
  } else {   // a permanent blessing
    const B = pick(BLESSINGS), v = B.amt(z);
    pr.perm = pr.perm || {}; pr.perm[B.k] = (pr.perm[B.k] || 0) + v; game.refreshPlayer();
    w.rings.push({ x: p.x, y: p.y, r: 30, t: 0, col: '#ffd23f' });
    game.openDialog(a.label, pick(WANDER_LINES.bless), null);
    game.toast(`Blessing: ${B.fmt(v)} — permanent!`, '#ffd23f');
  }
  game.save();
  return true;
}
// a black hole boss fell (called from inside the hole): pay out every quest it satisfies
function holeQuestBossKill(game, w, rank, m) {
  const pr = game.profile; if (!pr.holeQuests || !pr.holeQuests.length) return;
  const ok = q => q.kind === 'slay' || (q.kind === 'ranked' && rank >= q.rank) || (q.kind === 'swift' && (w.caveTime || 0) <= 60000) || (q.kind === 'unscathed' && (w.minHpFrac ?? 1) >= 0.5);
  const done = pr.holeQuests.filter(ok);
  pr.holeQuests = pr.holeQuests.filter(q => !ok(q));
  done.forEach((q, i) => {
    pr.gold = (pr.gold || 0) + q.gold; pr.coins = (pr.coins || 0) + q.coins;
    const pool = ZONES[q.zone].mobs.filter(id => D.monsters[id]);
    w.drops.push({ kind: 'card', item: makeCard(pick(pool), q.cardRank), x: m.x + (i - 1) * 14, y: m.y + 10 });
    game.toast(`QUEST COMPLETE · ${q.title}: +${q.gold} G, +${q.coins} coin${q.coins > 1 ? 's' : ''} and a card (from ${q.from})`, '#ffd23f');
  });
}
// world-space: the talk prompt over a traveller you are standing by
function drawWandererPrompt(w) {
  const a = nearWanderer(w); if (!a) return;
  text(a.wanderer.done ? 'Enter: talk' : 'Enter: talk  !', a.x, a.y - 48, '#ffe9a8', 7);
}
