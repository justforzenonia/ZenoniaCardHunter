'use strict';
// HOUSE VISITORS (2026-11-20, the user: "some houses in town cant be entered add a random npc that gives random quest or permanent
// stat gold etc in those houses"). A town house whose people are all out today used to be locked ("Nobody home"). Now a visitor
// rests there: a traveller off the road (one of the Wilds' wanderers' faces), a different one each day. Walk in and talk once a
// day per house for one random gift:
//   BLESSING   a permanent stat (ATK, max HP, DEF or crit), as the travellers in the Wilds give, bigger in the later towns   35%
//   GOLD       a purse of gold, bigger in the later towns                                                                      30%
//   GEAR       a piece of gear of the town's zone's top rank                                                                  15%
//   COINS      a few summon coins                                                                                             10%
//   QUEST      a black hole quest (wanderers.js), when you carry fewer than three                                             10%
// Talk again the same day and they only chat. Tomorrow someone new may be staying.
const HV = { bless: 0.35, gold: 0.65, gear: 0.8, coins: 0.9, gold0: 220, goldPer: 180, coins0: 2, sym: '✦',
  lines: {
    hello: ['Oh! The family let me rest here while they are out. Here, take this for your trouble.', 'A hunter! Perfect. I have something for you.',
      'I am only passing through, but I can spare something for a friendly face.', 'Sit, sit. Travellers should help each other. This is for you.'],
    bless: 'Close your eyes a moment… there. A little of my strength, yours for good.',
    gold: 'Take this purse. Gold is heavy on the road, and you will use it better than me.',
    gear: 'I carried this all the way from the Wilds. It suits you more than me.',
    coins: 'A few coins for the summoning altar. Good luck with your draws!',
    quest: 'Will you do something for me? Out there, {q}. I will make it worth your while.',
    done: ['Safe travels, hunter. Come by tomorrow, someone else may be staying.', 'Thank you for the company!', 'I will rest a little longer before the road.'],
  } };
const hvDay = () => (typeof dayNo === 'function' ? dayNo() : Math.floor(Date.now() / 86400000));
const hvHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// the visitor for a house today: the same face all day, chosen from the travellers' faces
// (never someone the town or the story already has: a visiting "Gate Warden" muddled the chapter's Gate Warden in Hearthvale)
let HV_TAKEN = null;
function hvTaken() {
  if (HV_TAKEN) return HV_TAKEN; HV_TAKEN = new Set(['Traveller']);
  try { for (const n of TOWN_CROWD) if (n.label) HV_TAKEN.add(n.label); } catch (e) {}
  try { for (const L of FOLK.outposts) for (const F of L) if (F[1]) HV_TAKEN.add(F[1]); } catch (e) {}
  try { for (const a of (GAME.world || {}).actors || []) if (a.label && a.kind === 'npc') HV_TAKEN.add(a.label); } catch (e) {}
  return HV_TAKEN;
}
function hvVisitor(x, y) {
  const ids = WANDER_NPCS.filter(i => D.npcs[i] && !hvTaken().has(wanderName(i)) && !/warden|elder/i.test(wanderName(i))); if (!ids.length) return null;
  const id = ids[hvHash(`${hvDay()}|${Math.round(x)}|${Math.round(y)}`) % ids.length];
  return { npc: id, label: wanderName(id) };
}
// houses with nobody home get a visitor instead of a locked door
{ const fd = folkDoors;
  folkDoors = function (people, spots, town) {
    return fd.call(this, people, spots, town).map(d => {
      if (!d.empty) return d;
      const V = hvVisitor(d.x, d.y); if (!V) return d;
      return { x: d.x, y: d.y, key: d.key, role: 'visitor', folkTown: town, npc: V.npc, label: V.label, line: '', visitorKey: `${Math.round(d.x)}|${Math.round(d.y)}`, place: `${V.label} (visiting)`, sym: HV.sym };
    });
  };
}
// in the house: the visitor stands where the owner would, with a gold "!" while today's gift is waiting
{ const eh = enterHouse;
  enterHouse = function (game, door) {
    const r = eh.call(this, game, door);
    if (door && door.role === 'visitor') { const k = game.world.actors.find(a => a.role === 'visitor'); if (k) { k.visitorKey = door.visitorKey; k.zoneT = door.folkTown; if (!hvDone(game.profile, door.visitorKey)) k.marker = '#ffd23f'; } }
    return r;
  };
}
function hvDone(pr, key) { const H = pr.hvDone; return !!(H && H.day === hvDay() && H.keys.includes(key)); }
function hvMark(pr, key) { if (!pr.hvDone || pr.hvDone.day !== hvDay()) pr.hvDone = { day: hvDay(), keys: [] }; pr.hvDone.keys.push(key); }
function visitorTalk(game, w, a) {
  const pr = game.profile, p = w.player, z = Math.max(0, Math.min(ZONES.length - 1, a.zoneT != null ? a.zoneT : 0));
  a.dir = dirTo(p.x - a.x, p.y - a.y);
  if (hvDone(pr, a.visitorKey)) { game.openDialog(a.label, pick(HV.lines.done), null); return true; }
  hvMark(pr, a.visitorKey); a.marker = null;
  pr.holeQuests = pr.holeQuests || [];
  let roll = Math.random(); if (roll >= HV.coins && pr.holeQuests.length >= HOLE_QUEST_MAX) roll = HV.bless + 0.01;   // (quests full: gold instead)
  const hello = pick(HV.lines.hello) + ' ';
  if (roll < HV.bless) {
    const B = pick(BLESSINGS), v = B.amt(z); pr.perm = pr.perm || {}; pr.perm[B.k] = (pr.perm[B.k] || 0) + v; game.refreshPlayer();
    w.rings.push({ x: p.x, y: p.y, r: 30, t: 0, col: '#ffd23f' });
    game.openDialog(a.label, hello + HV.lines.bless, null); game.toast(`Blessing: ${B.fmt(v)} — permanent!`, '#ffd23f');
  } else if (roll < HV.gold) {
    const g = Math.round((HV.gold0 + HV.goldPer * z) * (0.8 + Math.random() * 0.5)); pr.gold = (pr.gold || 0) + g;
    game.openDialog(a.label, hello + HV.lines.gold, null); game.toast(`+${g} G from ${a.label}`, '#ffd27a');
  } else if (roll < HV.gear) {
    const g = makeGear(pick(GEAR_SLOTS), Math.min(9, ZONES[z].ranks[1]), pr.cls); w.drops.push({ kind: 'gear', item: g, x: p.x, y: p.y + 8 });
    game.openDialog(a.label, hello + HV.lines.gear, null); game.toast(`${a.label} gave you ${g.name} [${RANKS[g.tier]}]`, rankColor(g.tier));
  } else if (roll < HV.coins) {
    const c = HV.coins0 + z; pr.coins = (pr.coins || 0) + c;
    game.openDialog(a.label, hello + HV.lines.coins, null); game.toast(`+${c} summon coins from ${a.label}`, '#ffd27a');
  } else {
    const q = makeHoleQuest(z, a.label); pr.holeQuests.push(q);
    game.openDialog(a.label, hello + HV.lines.quest.replace('{q}', q.line.charAt(0).toLowerCase() + q.line.slice(1)), null);
    game.toast(`BLACK HOLE QUEST: ${q.line} · reward ${q.gold} G, ${q.coins} coin${q.coins > 1 ? 's' : ''} and a card`, '#c890ff');
  }
  if (typeof logAdd === 'function') logAdd(game, `${a.label} (visiting) shared a gift`, '#ffd27a');
  game.save(); return true;
}
{ const ti = townInteract;
  townInteract = function (game, w) {
    if (w && w.interior) { const p = w.player; const a = w.actors.find(q => q.role === 'visitor' && dist(q, p) < 30); if (a) return visitorTalk(game, w, a); }
    return ti.apply(this, arguments);
  };
}
