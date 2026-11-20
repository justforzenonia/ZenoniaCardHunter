'use strict';
// THE OUTPOST TOWNS (worldgen.js OUTPOST_TOWNS / buildOutpostMap, world.js OUTPOSTS): a village at the far end of
// every zone. Each has a house for sale: buy it (pr.homes[i]) and its door leads into your home (the same home as in
// Hearthvale: your chest, kitchen, wardrobe and Relic Hall), and its farm plots are yours to till. The waystone in
// front of the house works from the start: touch it once (pr.townStones[i]) and the town is a TRAVEL destination.

const ownsTownHome = (pr, i) => !!(pr && pr.homes && pr.homes[i]);
const fmtG = n => n.toLocaleString('en-US') + ' G';

// ---- buying a house
function buyHomeMenu(i) { return { type: 'buyhome', town: i, cur: 0, scroll: 0 }; }
function buyHomeRows(game, m) {
  const O = OUTPOSTS[m.town], gold = game.profile.gold || 0, can = gold >= O.price;
  return [
    { draw: HOUSE_ROW, name: `Buy the house · ${fmtG(O.price)}`, sub: can ? 'Your home, your storage and the farm beside it — and a waystone at the door' : `You have ${fmtG(gold)} — not enough yet`, right: can ? 'BUY' : '—', rightCol: can ? '#8fffb0' : '#7a7468', dim: !can },
    { name: 'Not now', sub: 'Leave the house for another day', right: '', rightCol: '#c9c1a8' },
  ];
}
function updateBuyHome(game, m) {
  const nav = panelNav(m, 2, 0);
  if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok) return;
  if (m.cur === 1) { game.closeMenu(); return; }
  const pr = game.profile, O = OUTPOSTS[m.town];
  if ((pr.gold || 0) < O.price) { game.toast(`The house costs ${fmtG(O.price)} — you have ${fmtG(pr.gold || 0)}`, '#ff9a7a'); return; }
  pr.gold -= O.price; pr.homes = pr.homes || {}; pr.homes[m.town] = true; pr.townStones = pr.townStones || {}; pr.townStones[m.town] = true;
  game.save(); game.closeMenu();
  const w = game.world; if (w && w.rings) w.rings.push({ x: O.door.x, y: O.door.y + 8, r: 40, t: 0, col: '#ffd27a' }, { x: O.door.x, y: O.door.y + 8, r: 24, t: -120, col: '#ffffff' });
  game.toast(`The house in ${O.name} is yours! Walk in any time, farm the field beside it, and travel here from any waystone`, '#ffd27a');
}
function drawBuyHome(game, m, now) {
  const O = OUTPOSTS[m.town];
  panelMenu(m, { title: `HOUSE FOR SALE · ${O.name.toUpperCase()}`, rows: buyHomeRows(game, m), info: O.sub, keys: '↑↓ choose · Enter · Esc: close' }, now);
}

// ---- the home point: the house you wake in and teleport to (pr.homePoint = an outpost's index; none = Hearthvale)
const homePointOf = pr => (pr && pr.homePoint != null && ownsTownHome(pr, pr.homePoint) && OUTPOSTS[pr.homePoint] ? pr.homePoint : null);
const homePlace = pr => { const i = homePointOf(pr); return i == null ? 'Hearthvale' : OUTPOSTS[i].name; };
// the door enterHome takes for the home point (null: the house in Hearthvale)
function homePointDoor(pr) { const i = homePointOf(pr); if (i == null) return null; const O = OUTPOSTS[i]; return { key: 'home', town: i, x: O.door.x, y: O.door.y, place: O.name }; }
// where you stand outside it (a fall sends you here)
function homePointSpot(w, pr) { const D = homePointDoor(pr); if (!D) return null; return findOpen(w, D.x, D.y + 18); }
// the HOME menu (T): teleport there, or pick which house is home
function homeMenu() { return { type: 'homepoint', cur: 0, scroll: 0 }; }
function homeMenuRows(game) {
  const pr = game.profile, cur = homePointOf(pr), rows = [{ go: true, draw: HOUSE_ROW, name: `Teleport home · ${homePlace(pr)}`, sub: 'Into your home point', right: 'GO', rightCol: '#9fe8ff' }];
  rows.push({ point: null, name: 'Hearthvale', sub: cur == null ? 'Your home point' : 'Make this your home point', right: cur == null ? '★ HOME' : 'SET', rightCol: cur == null ? '#ffd23f' : '#8fffb0' });
  OUTPOSTS.forEach((O, i) => { if (ownsTownHome(pr, i)) rows.push({ point: i, name: `${O.name} house`, sub: cur === i ? 'Your home point' : 'Make this your home point', right: cur === i ? '★ HOME' : 'SET', rightCol: cur === i ? '#ffd23f' : '#8fffb0' }); });
  if (rows.length === 2) rows.push({ none: true, name: 'Buy a house in an outpost town', sub: 'Each zone\'s far town sells one: then it can be your home point', right: '', rightCol: '#c9c1a8' });
  // your car: which house it waits by (vehicles.js vehHouse), once you have a car and more than one house
  const G = typeof garageOf === 'function' && garageOf(pr), V = G && G.cur && G.owned[G.cur] && vehModel(G.cur);
  if (V && OUTPOSTS.some(O => ownsTownHome(pr, O.i))) {
    const here = vehHouse(pr), car = (i, place) => ({ car: i == null ? 'hv' : i, name: `${V.name} · ${place}`, sub: here === i ? 'Your car waits by this house' : 'Send your car to this house', right: here === i ? 'HERE' : 'SEND', rightCol: here === i ? '#8fd8ff' : '#8fffb0' });
    rows.push(car(null, 'Hearthvale'));
    OUTPOSTS.forEach((O, i) => { if (ownsTownHome(pr, i)) rows.push(car(i, `${O.name} house`)); });
  }
  return rows;
}
function updateHomePoint(game, m) {
  const rows = homeMenuRows(game), nav = panelNav(m, rows.length, 0); if (nav.back) { game.closeMenu(); return; } if (!nav.ok) return;
  const r = rows[m.cur]; if (!r || r.none) return;
  if (r.go) { teleportHome(game); return; }
  const pr = game.profile;
  if (r.car != null) {   // send the car to that house: it leaves wherever it was parked and waits by that door
    const G = garageOf(pr); G.at = r.car; game.vehPark = null; if (game.world) game.world._vehHome = null;
    const p = game.world && game.world.player; if (p && p.driving) { p.driving = game.vehOn = null; }   // (if you were at the wheel, you step out: it drives itself there)
    game.toast(`Your ${vehModel(G.cur).name} is waiting by your ${r.car === 'hv' ? 'Hearthvale' : OUTPOSTS[r.car].name} house`, '#8fd8ff'); game.save(); return;
  } if (r.point == null) delete pr.homePoint; else pr.homePoint = r.point;
  game.toast(`Home point: ${homePlace(pr)}. You wake and teleport here from now on`, '#ffd27a'); game.save();
}
function drawHomePoint(game, m, now) {
  panelMenu(m, { title: 'HOME', rows: homeMenuRows(game), info: `Home point: ${homePlace(game.profile)}`, keys: '↑↓ choose · Enter · Esc: close' }, now);
}
