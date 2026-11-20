'use strict';
// WALK-IN DOORS AND THE TENT FOLK: the giant trees and the camps out in the zones (tents, snow huts, ember huts) are walked into, like a town door, with no key to press.
// Someone lives in every camp. Each day they ask you to clear the monsters around it (the area it stands in and the areas either side) for 1 summon coin.
// pr.tents = { key: { day, region, have, state } }, state 0 not asked yet, 1 on the job, 2 paid.
const TENT = { pay: 1, need: 15, near: 90, reach: 1, hold: 120, marks: 2, banks: { '005:0': 'Tent', '041:1': 'Snow Hut', '272:4': 'Ember Hut' } };
// each camp has its own person: twelve walks of life and thirteen names give every camp a name no other camp has
const TENT_LOOKS = ['103', '105', '111', '112', '114', '118', '120', '121', '123', '124', '125', '126'], TENT_TRADES = ['Scout', 'Trapper', 'Camper', 'Ranger', 'Pilgrim', 'Forager', 'Tracker', 'Drifter', 'Hermit', 'Tanner', 'Sergeant', 'Prospector'], TENT_NAMES = ['Tam', 'Odd', 'Nell', 'Wyn', 'Ona', 'Rook', 'Bree', 'Sol', 'Lin', 'Vey', 'Holt', 'Dara', 'Finn'];
const TENT_ASKS = [
  a => `I have not slept in three nights. Everything in ${a} comes sniffing round this camp. Clear them out?`,
  a => `Monsters on every side of me. Thin out ${a} and the paths around it, and I can go out for water again.`,
  a => `I pitched here because it was quiet. ${a} is not quiet any more. See to it, would you?`,
  a => `They took my pack and my boots. Get rid of whatever is prowling ${a} before they come back for me.`,
];
const tentKey = o => `${o.x}:${o.bottom}`, tentHash = key => Math.abs(key.split(':').reduce((a, b) => (a * 31 + Math.round(+b) + WORLD_SEED) | 0, 11));
const tentArea = r => regionName(r).replace(/^.*· /, '').replace(/ \(.*$/, '');
// every door out in the wild, found once per world
function zoneDoors(w) {
  if (w._zoneDoors) return w._zoneDoors; const out = [], looks = TENT_LOOKS.filter(n => D.npcs[n]); let n = 0;
  for (const o of w.objects) {
    const camp = TENT.banks[`${o.bank}:${o.fi}`], tree = o.bank === '046' && (o.fi === 2 || o.fi === 3); if (!camp && !tree) continue;
    const r = objRec(o.bank, o.fi), R = regionAt(o.x), x = o.x + r[4] + r[2] / 2; if (camp && (!R || R.zone < 0)) continue;
    const key = tentKey(o); if (tree) { out.push({ o, x, y: o.bottom, tree: true, key: treeKey(o), label: `${treePerson(treeKey(o))[1]}'s Tree` }); continue; }
    const who = `${TENT_TRADES[n % TENT_TRADES.length]} ${TENT_NAMES[n % TENT_NAMES.length]}`; out.push({ o, x, y: o.bottom, key, camp, who, npc: looks[n % looks.length], label: `${who}'s ${camp}` }); n++;
  }
  return (w._zoneDoors = out);
}
const zoneDoorNear = (w, p) => zoneDoors(w).find(d => Math.abs(p.x - d.x) < 16 && p.y > d.y - 6 && p.y < d.y + 20) || null;
function tentState(pr, key, region) {
  const T = pr.tents || (pr.tents = {}), today = dayNo(); let S = T[key];
  if (!S || S.day !== today) { for (const k in T) if (T[k].day !== today) delete T[k]; S = T[key] = { day: today, region, have: 0, state: 0 }; }
  return S;
}
// inside a camp: one small room, not a house. Built once from the houses' own tiles and furniture (tileset 100): the back wall,
// a plank floor with a rug, the bed and a bench against the wall, a table, a plant, and the flap at the bottom
// each zone's camp folk have a few words of their own, and their own way of saying it is quiet again
const TENT_ZONE = {
  1: { asks: [a => `The lanterns in ${a} keep going out, and something moves between the trees when they do. Would you chase it off?`,
              a => `I came to ${a} to listen to the owls. Now all I hear is growling. Clear them away for me?`],
       quiet: 'The grove is hushed again. Listen: an owl. Come back tomorrow.' },
  2: { asks: [a => `Up here the wind carries every sound, and everything in ${a} sounds hungry. Thin them out?`,
              a => `I pitched my tent on the softest cloud in ${a}. The monsters found it soft too. Help me?`],
       quiet: 'Only the wind now. Come back tomorrow; the clouds drift, and so do they.' },
  3: { asks: [a => `My little fire is the only warm thing in ${a}, and the monsters know it. Drive them back?`,
              a => `The snow muffles everything in ${a}, so they creep right up to the flap. See them off?`],
       quiet: 'Just the snow falling now. Come back tomorrow, and bring something warm to drink.' },
  4: { asks: [a => `Water is precious out here, and the beasts of ${a} keep circling my water-skins. Drive them off?`,
              a => `I follow the cool night wind across ${a}. Lately the monsters follow me. Help a nomad?`],
       quiet: 'Quiet sands at last. Come back tomorrow, and sit in the shade a while.' },
};
const TENT_ROOM = { w: 11, h: 9, door: 5,
  objs: [[100, 51, 47, 72], [100, 44, 95, 46], [100, 45, 151, 58], [100, 53, 127, 92]],
  block: [[2, 2], [3, 2], [2, 3], [3, 3], [2, 4], [3, 4], [5, 2], [6, 2], [9, 2], [9, 3], [7, 4], [8, 4], [7, 5], [8, 5]] };
function tentMap() {
  if (MAPS.int_tent) return 'int_tent';
  const R = TENT_ROOM, W = R.w, H = R.h, n = W * H, ground = new Uint16Array(n), overlay = new Uint16Array(n), solid = new Uint8Array(n), reach = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, side = x === 0 || x === W - 1;
    let t = -1;
    if (!side && y === 0) t = x % 2 ? 8 : 9; else if (!side && y === 1) t = x % 2 ? 18 : 19;   // the wall: its top, then its face
    else if (!side && y < H - 1) t = y >= 3 && y <= 5 && x >= 3 && x <= 7 ? 23 : 24;   // planks, and the rug
    else if (y === H - 1 && x === R.door) t = 1;   // the way out
    ground[i] = t + 1; solid[i] = t < 0 || y < 2 ? 1 : 0;
  }
  for (const [x, y] of R.block) solid[y * W + x] = 1;
  for (let i = 0; i < n; i++) reach[i] = solid[i] ? 0 : 1;
  MAPS.int_tent = { name: 'int_tent', w: W, h: H, tileset: 100, ground, overlay, objA: [], objB: R.objs.map(o => o.slice()), solid, reach, spawn: [R.door * T + 8, (H - 2) * T + 8], entry: [R.door * T + 8, (H - 1) * T + 8], filler: 0 };
  return 'int_tent';
}
function tentEnter(game, w, d) {
  const out = findOpen(w, d.x, d.y + 22), R = regionIndexAt(d.x);
  enterHouse(game, { key: tentMap(), role: 'tent', npc: d.npc, label: d.who, tentKey: d.key, tentRegion: R, place: d.label, x: out.x, y: out.y - 16 });
}
// walk up into the door, as in town
function zoneDoorTick(game, w, dt, inp) {
  const d = zoneDoorNear(w, w.player); if (!d || inp.my >= 0) { w.zoneHold = 0; return false; }
  w.zoneHold = (w.zoneHold || 0) + dt; if (w.zoneHold <= TENT.hold) return false; w.zoneHold = 0;
  if (d.tree) return treeInteract(game, w, d.o);
  tentEnter(game, w, d); return true;
}
// talking to whoever lives there (world.js townInteract)
function tentTalk(game, w, a) {
  if (a.role !== 'tent' || !w.door) return false;
  const pr = game.profile, S = tentState(pr, w.door.tentKey, w.door.tentRegion), area = tentArea(S.region), r = tentHash(w.door.tentKey + ':' + dayNo());
  const Z = TENT_ZONE[(REGIONS[S.region] || {}).zone] || {}, asks = Z.asks ? TENT_ASKS.concat(Z.asks, Z.asks) : TENT_ASKS;   // (a camp's own zone colours its words: its lines come up twice as often as the plain ones)
  if (S.state === 2) { game.openDialog(a.label, Z.quiet || 'Quiet at last. Come back tomorrow, they never stay away for long.', null); return true; }
  if (S.state === 0) { S.state = 1; game.openDialog(a.label, `${asks[r % asks.length](area)} Defeat ${TENT.need} of them around here and I will give you a summon coin. It is all I have.`, null); game.save(); return true; }
  if (S.have < TENT.need) { game.openDialog(a.label, `I can still hear them out there. ${S.have} of ${TENT.need} so far.`, null); return true; }
  S.state = 2; pr.coins = (pr.coins || 0) + TENT.pay; game.openDialog(a.label, 'It has gone quiet out there. Thank you. Here, a summon coin, as promised.', null);
  game.toast(`★ +${TENT.pay} summon coin`, '#ffd23f'); game.save(); return true;
}
function tentEvent(game, type) {
  const T = game.profile.tents, w = game.world; if (!T || type !== 'kill' || !w || !w.overworld || w.interior) return; const at = regionIndexAt(w.player.x);
  for (const k in T) { const S = T[k]; if (S.state === 1 && S.day === dayNo() && S.have < TENT.need && Math.abs(at - S.region) <= TENT.reach) { S.have++; if (S.have >= TENT.need) game.toast('The camp is safe. Go back for your coin', '#8fffd0'); } }
}
function tentTracker(game, y) {
  const T = game.profile && game.profile.tents; if (!T) return y; const L = Object.values(T).filter(S => S.state === 1 && S.day === dayNo()).sort((a, b) => (b.have >= TENT.need) - (a.have >= TENT.need)).slice(0, TENT.marks);
  for (const S of L) { const ready = S.have >= TENT.need; text('◆ Clear the Camp', VW - 8, y, '#8fffd0', 7.5, 'right'); text(ready ? 'Go back to the camp for your coin' : `${tentArea(S.region)} and nearby (${S.have}/${TENT.need})`, VW - 8, y + 10, '#fff4d8', 6.6, 'right'); y += 22; }
  return y;
}
// the name over the door, and a mark while someone inside has a job for you
function drawZoneDoors(w, now) {
  const p = w.player, pr = GAME.profile, near = zoneDoorNear(w, p);
  for (const d of zoneDoors(w)) {
    const dist = Math.hypot(p.x - d.x, p.y - d.y); if (dist > TENT.near) continue; const y = d.y - 44 + Math.sin(now / 300 + d.x) * 1.5, tw = textW(d.label, 8) + 12;
    ctx.save(); ctx.globalAlpha = Math.min(1, (TENT.near - dist) / 40); ctx.fillStyle = 'rgba(20,12,6,0.8)'; ctx.fillRect(d.x - tw / 2, y - 7, tw, 13); ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 0.8; ctx.strokeRect(d.x - tw / 2 + 0.5, y - 6.5, tw - 1, 12); text(d.label, d.x, y, '#ffe9a8', 8);
    if (d.camp) { const S = pr.tents && pr.tents[d.key], today = S && S.day === dayNo(); if (!today || S.state === 0 || (S.state === 1 && S.have >= TENT.need)) drawQuestMark(d.x, y - 16, now, !!today && S.state === 1); }
    if (d === near) text('▲ Enter', d.x, y + 14, `rgba(255,255,255,${0.6 + 0.4 * Math.sin(now / 200)})`, 7);
    ctx.restore();
  }
}
