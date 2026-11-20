'use strict';
// Doors. In Hearthvale the merchants trade from their doorsteps, so the only door you walk through is your own home
// (home.js). The interior helpers below (enterHouse / exitHouse / updateInterior) also serve the home.

const SHOPS = {
  '13:0':  { key: 'int_inn',    role: 'inn',   npc: '107', label: 'Innkeeper',    place: 'The Wanderer\'s Inn', sym: 'INN' },
  '13:10': { key: 'int_forge',  role: 'gear',  npc: '104', label: 'Smith',        place: 'Forge',               sym: '⚒' },
  '13:9':  { key: 'int_battle', role: 'arena', npc: '119', label: 'Arena Master', place: 'Battle Hall',         sym: '⚔' },
  '13:14': { key: 'int_apoth',  role: 'heal',  npc: '116', label: 'Apothecary',   place: 'Apothecary',          sym: '⚗' },
  '7:0':   { key: 'int_card',   role: 'cards', npc: '113', label: 'Card Master',  place: 'Card Hall',           sym: '🂠' },
};
const HOMES = ['int_home1', 'int_home2', 'int_home3', 'int_home4', 'int_home5', 'int_home6'];
const HOME_FOLK = [
  { npc: '122', label: 'Stylist', role: 'style' },
  { npc: '100', label: 'Old Man', role: 'home', line: 'In my day the monsters out west were F rank at worst. Now look at them!' },
  { npc: '109', label: 'Mother', role: 'home', line: 'Bring your cards to the fountain — fusing three gives you a stronger rank.' },
  { npc: '102', label: 'Farmer', role: 'home', line: 'Skyreach Isles? Only fools and SS-rank hunters go that far west.' },
  { npc: '110', label: 'Scholar', role: 'home', line: 'Cast a spell right after a hit lands — a COMBO LINK makes it far stronger.' },
  { npc: '115', label: 'Child', role: 'home', line: 'I saw a rainbow card once! The man said it was SSS+ and it had shards flying off it!' },
  { npc: '106', label: 'Retired Hunter', role: 'home', line: 'Dash through an attack — for a heartbeat nothing can touch you. Saved my life a hundred times.' },
  { npc: '108', label: 'Merchant', role: 'home', line: 'Gear with a green arrow beats what you wear. The good stuff equips itself, too.' },
  { npc: '117', label: 'Bard', role: 'home', line: 'They sing of a Summoner whose familiars came from her own deck… choose your first two cards well!' },
];
const HOUSE_LINES = {
  inn: 'Rest a while, traveller. Your strength returns and your journey is recorded.',
  heal: 'A tonic for the road? Drink up — wounds close and your blade bites harder for a while.',
};

// Doors of the town, in overworld coordinates
let DOORS = null;
function townDoors() {
  if (DOORS) return DOORS;
  // Hearthvale: the merchants trade from their doorsteps; the only door you walk through is your own
  DOORS = [{ key: 'home', role: 'home', place: 'Your Home', sym: '⌂', x: HOME_DOOR.x + TOWN_OX, y: HOME_DOOR.y + TOWN_OY },
    { key: MAPS.dojo_hall ? 'dojo_hall' : 'int_battle', role: 'dojo', dojoI: 0, npc: DOJO.npc, label: DOJO.label, place: 'Dojo', sym: '☯', x: VILLAGE.dojo.bx * T + 8 + TOWN_OX, y: VILLAGE.dojo.by * T + TOWN_OY },
    ...OUTPOSTS.map(O => ({ key: 'home', role: 'home', town: O.i, place: O.name, sym: '⌂', x: O.door.x, y: O.door.y })),
    ...OUTPOSTS.filter(O => DOJOS[O.i + 1]).map(O => ({ key: 'dojo_hall', role: 'dojo', dojoI: O.i + 1, npc: DOJOS[O.i + 1].npc, label: DOJOS[O.i + 1].label, place: `${O.name} Dojo`, sym: '☯', x: O.dojo.x, y: O.dojo.y })), ...eastDoors(), ...outpostDoors()];   // the outpost houses (towns.js), the East End (folkday.js)
  return DOORS;
}
function doorNear(p) {
  for (const d of townDoors()) if (Math.abs(p.x - d.x) < 13 && p.y - d.y > -6 && p.y - d.y < 24) return d;
  return null;
}

function enterHouse(game, door) {
  const outside = game.world, p = outside.player;
  const w = mapWorld(door.key);
  w.interior = true; w.peaceful = true; w.name = door.place;
  const M = MAPS[door.key];
  // keeper stands in the open room ~5 tiles in front of the entrance, on a reachable floor tile
  const [ex0, ey0] = M.entry;
  let at = { x: ex0, y: ey0 - 5 * T }, bd = 1e9;
  for (let i = 0; i < M.w * M.h; i++) {
    if (!M.reach[i]) continue;
    const x = (i % M.w) * T + 8, y = Math.floor(i / M.w) * T + 12;
    if (y > ey0 - 2 * T) continue;
    const d = Math.hypot(x - ex0, (y - (ey0 - 5 * T)) * 1.2);
    if (d < bd) { bd = d; at = { x, y }; }
  }
  const k = baseActor('npc', 2, at.x, at.y);
  Object.assign(k, { npc: door.npc, label: door.label, role: door.role, line: door.line, favour: door.favour, town: door.folkTown, h: 26, home: { x: at.x, y: at.y }, ai: { t: 0, still: true } });
  w.actors.push(k);
  if (door.guest) { const G = door.guest, q = findOpen(w, at.x + 34, at.y), a = baseActor('npc', 2, q.x, q.y); Object.assign(a, { npc: G.npc, label: G.label, role: 'folk', line: G.line, favour: true, town: door.folkTown, h: 26, home: { x: q.x, y: q.y }, ai: { t: 0, still: true } }); w.actors.push(a); }   // someone else home today
  // move the hero (and familiars) inside
  const party = outside.actors.filter(a => a === p || (a.ally && a.owner === p));
  outside.actors = outside.actors.filter(a => !party.includes(a));
  const [ex, ey] = M.entry;
  for (const a of party) {
    a.x = ex + (a === p ? 0 : rand(-14, 14)); a.y = ey - (a === p ? 2 : 10); a.vx = a.vy = 0; a.dir = 0;
    a.state = 'free'; setAnim(a, 'idle', true);
    w.actors.push(a);
  }
  w.player = p; w.entry = { x: ex, y: ey }; w.door = door;
  game.outside = outside; game.world = w;
  if (door.role === 'dojo') { setupDojoRoom(game, w, k); return; }   // its own fighting instance (dojo.js)
  game.toast(door.place, '#ffe9a8');
}
function exitHouse(game) {
  const w = game.world, out = game.outside, d = w.door, p = w.player;
  const party = w.actors.filter(a => a === p || (a.ally && a.owner === p));
  for (const a of party) {
    a.x = d.x + (a === p ? 0 : rand(-14, 14)); a.y = d.y + (a === p ? 16 : 26); a.dir = 2; a.vx = a.vy = 0;
    a.state = 'free'; setAnim(a, 'idle', true);
    out.actors.push(a);
  }
  out.player = p;
  game.world = out; game.outside = null;
}

// Interior frame: talk, leave by walking back down onto the entrance carpet
function updateInterior(game, w, dt, inp) {
  const p = w.player;
  // on the carpet or anywhere below it (a fast walker, or double speed, used to slip past the carpet to the wall and
  // could never leave)
  if (Math.abs(p.x - w.entry.x) < 16 && p.y > w.entry.y - 12 && inp.my > 0) {
    w.leaveHold = (w.leaveHold || 0) + dt;
    if (w.leaveHold > 120) { if (w.hall) leaveHall(game); else exitHouse(game); return; }
  } else w.leaveHold = 0;
}

// Overworld: walk up into a door to enter
function checkDoors(game, w, dt, inp) {
  const p = w.player, d = doorNear(p);
  if (d && inp.my < 0) {
    w.enterHold = (w.enterHold || 0) + dt;
    if (w.enterHold > 120) {
      w.enterHold = 0;
      if (d.empty) { game.toast('Locked. Everyone is out today', '#c9c1a8'); return false; }
      if (d.key === 'home' && d.town != null && !ownsTownHome(game.profile, d.town)) { game.openMenu(buyHomeMenu(d.town)); return true; }   // for sale
      if (d.key === 'home') enterHome(game, d); else enterHouse(game, d); return true;
    }
  } else w.enterHold = 0;
  return false;
}

// Enter at a house for sale opens the sale too (2026-11-20, the user: "cant buy house": the sign says Enter, and only walking up into
// the door worked). Only the for-sale door: at other doors Enter still talks to whoever stands there.
function saleDoorEnter(game, w) {
  const d = doorNear(w.player); if (!d || d.key !== 'home' || d.town == null || ownsTownHome(game.profile, d.town)) return false;
  game.openMenu(buyHomeMenu(d.town)); return true;
}
// Floating sign over shop doors near the player; "↑ Enter" hint at the closest
function drawDoorHints(w, now) {
  const p = w.player;
  for (const d of townDoors()) {
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if (dist > 90) continue;
    const a = Math.min(1, (90 - dist) / 40);
    const y = d.y - 8 + Math.sin(now / 300 + d.x) * 1.5;
    ctx.save(); ctx.globalAlpha = a;
    const forSale = d.town != null && !ownsTownHome(GAME.profile, d.town);
    if (d.role !== 'home' || forSale) {
      const label = forSale ? `⌂  For sale · ${fmtG(OUTPOSTS[d.town].price)}` : `${d.sym ? d.sym + '  ' : ''}${d.place}`;
      const tw = textW(label, 8) + 12;
      ctx.fillStyle = 'rgba(20,12,6,0.8)'; ctx.fillRect(d.x - tw / 2, y - 7, tw, 13);
      ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 0.8; ctx.strokeRect(d.x - tw / 2 + 0.5, y - 6.5, tw - 1, 12);
      text(label, d.x, y, '#ffe9a8', 8);
      if (favourMark(GAME.profile, d)) drawQuestMark(d.x, y - 16, now);   // someone inside wants a favour
    }
    if (doorNear(p) === d) text('▲ Enter', d.x, y + 14, `rgba(255,255,255,${0.6 + 0.4 * Math.sin(now / 200)})`, 7);
    ctx.restore();
  }
}
