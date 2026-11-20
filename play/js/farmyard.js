'use strict';
// THE FARMYARD: the farm's animals work for their keep. Press Enter beside one to feed it a crop; half an in-game day later it has
// something for you (chicken: an egg, cow: milk, sheep: wool, pig: a truffle), and Enter collects it. Gold and Farm Levels build the
// yard up at the Farm Board, and each building stands on the farm once it's bought:
//   COOP   every chicken lays two eggs        SILO        every harvest gives one more crop
//   BARN   keeps animals you lead home        WATER MILL  waters Hearthvale's fields by itself
// pr.yard = { fed: { key: when (wellClock) }, built: { id: true }, kept: ['cow', …] }.
const YARD = {
  make: DAY.len / 2, reach: 32, feed: ['feed', 'wheat', 'carrot', 'lettuce', 'berry', 'tomato', 'nectarine', 'pumpkin'], xp: 4, barnCap: 4, barnReach: 60,
  goods: { chicken: 'egg', cow: 'milk', sheep: 'wool', pig: 'truffle' },
  builds: {
    coop: { name: 'Chicken Coop', icon: 47, gold: 1500, lv: 2, sprite: ['013', 6], at: [TOWN_OX + 50 * T, TOWN_OY + 28 * T], desc: 'Every chicken lays two eggs' },
    barn: { name: 'Barn', icon: 49, gold: 3000, lv: 3, sprite: ['013', 0], at: [TOWN_OX + 61 * T, TOWN_OY + 33 * T], desc: 'Lead up to 4 wild animals here to keep them' },
    silo: { name: 'Silo', icon: 0, gold: 4000, lv: 5, sprite: ['272', 0], at: [TOWN_OX + 55 * T, TOWN_OY + 28 * T], desc: 'Every harvest gives one more crop' },
    mill: { name: 'Water Mill', icon: 23, gold: 6000, lv: 6, sprite: ['296', 0], at: [TOWN_OX + 51 * T, TOWN_OY + 33 * T], desc: "Hearthvale's fields water themselves" },
  },
};
const YARD_KEYS = Object.keys(YARD.builds);
const yardOf = pr => { const Y = pr.yard || (pr.yard = {}); Y.fed = Y.fed || {}; Y.built = Y.built || {}; Y.kept = Y.kept || []; return Y; };
const built = (pr, id) => !!yardOf(pr).built[id];
// where each kept animal lives: beside the barn
const barnSpot = i => ({ x: YARD.builds.barn.at[0] - 30 + (i % 2) * 62, y: YARD.builds.barn.at[1] - 92 + Math.floor(i / 2) * 34 });
// each world frame (animals.js): the kept animals and any buildings not yet standing
function yardTick(game, w) {
  const pr = game.profile, Y = yardOf(pr); w.yardUp = w.yardUp || {};
  for (const id of YARD_KEYS) if (Y.built[id] && !w.yardUp[id]) { w.yardUp[id] = true; yardRaise(w, id); }
  Y.kept.forEach((k, i) => { const key = `k${i}`; if (w.animals.some(A => A.yardKey === key)) return; const s = barnSpot(i), at = findOpen(w, s.x, s.y); addAnimal(w, k, at.x, at.y, { x: at.x, y: at.y }, ANIMALS.farmLeash); const A = w.animals[w.animals.length - 1]; A.farm = true; A.yardKey = key; });
  const p = w.player; let near = null, nd = YARD.reach;
  for (const A of w.animals) { if (!A.farm || !A.yardKey) continue; const d = Math.hypot(A.x - p.x, A.y - p.y); if (d < nd) { nd = d; near = A; } }
  w.yardNear = near;
}
function yardRaise(w, id) {
  const B = YARD.builds[id], [bank, fi] = B.sprite, r = objRec(bank, fi); if (!r) return;
  const o = makeMapObject([+bank, fi, Math.round(B.at[0] - r[4] - r[2] / 2), Math.round(B.at[1] - r[5] - r[3]), true]); if (o) w.objects.push(o);
}
// 'hungry', 'busy' or 'ready'
function yardState(pr, A) { const at = yardOf(pr).fed[A.yardKey]; return at == null ? 'hungry' : wellClock(pr) >= at + YARD.make ? 'ready' : 'busy'; }
// Enter beside a farm animal (home.js)
function yardTend(game, w) {
  const A = w.yardNear; if (!A) return false;
  const pr = game.profile, Y = yardOf(pr), st = yardState(pr, A), good = YARD.goods[A.k];
  if (st === 'hungry') {
    const food = YARD.feed.find(id => itemCount(pr, id) > 0);
    if (!food) { game.toast(`The ${A.k} is hungry. Feed it a crop: wheat, carrots, berries, tomatoes or pumpkins`, '#ff8a8a'); return true; }
    addItem(pr, food, -1); Y.fed[A.yardKey] = wellClock(pr); if (food === 'feed') (Y.rich = Y.rich || {})[A.yardKey] = true; farmXp(game, 1); game.save();
    game.toast(`Fed the ${A.k} ${ITEMS[food].name}. It will have ${ITEMS[good].name} in ${Math.round(YARD.make / (DAY.len / 24))} hours`, '#b8ff8a'); return true;
  }
  if (st === 'busy') { game.toast(`The ${A.k} is content. ${ITEMS[good].name} in ${Math.ceil((Y.fed[A.yardKey] + YARD.make - wellClock(pr)) / (DAY.len / 24))} hours`, '#c9c1a8'); return true; }
  const rich = Y.rich && Y.rich[A.yardKey], n = (A.k === 'chicken' && Y.built.coop ? 2 : 1) + (rich ? 1 : 0); addItem(pr, good, n); delete Y.fed[A.yardKey]; if (rich) delete Y.rich[A.yardKey]; farmXp(game, YARD.xp); seasonGain(game, SEASON.pts.harvest, 'farm');
  w.rings.push({ x: A.x, y: A.y, r: 18, t: 0, col: '#ffd27a' }); game.toast(`Collected ${n} × ${ITEMS[good].name}`, '#ffd27a'); game.save(); return true;
}
// Enter beside the barn with animals in tow: they move in
function nearBarn(w) { const B = YARD.builds.barn.at; return Math.hypot(w.player.x - B[0], w.player.y - (B[1] + 8)) < YARD.barnReach; }
function barnKeep(game, w) {
  const pr = game.profile, Y = yardOf(pr), L = animalLeads(w); if (!Y.built.barn || !L.length || !nearBarn(w)) return false;
  const room = YARD.barnCap - Y.kept.length; if (room <= 0) { game.toast(`The barn is full (${YARD.barnCap} animals)`, '#ff8a8a'); return true; }
  const go = L.slice(0, room); for (const A of go) { Y.kept.push(A.k); animalFree(A); } w.animals = w.animals.filter(A => !go.includes(A)); game.ledAnimals = animalLeads(w).map(A => A.k);
  game.toast(`${go.length} animal${go.length > 1 ? 's' : ''} moved into the barn (${Y.kept.length}/${YARD.barnCap})`, '#ffd27a'); game.save(); return true;
}
// once a second, wherever you are (ripeTick): the Water Mill keeps Hearthvale's fields wet
function millTick(pr) {
  if (!built(pr, 'mill') || !pr.farm) return;
  farmPlots().forEach((c, i) => { const P = pr.farm[i]; if (c.town != null || !P || !P.crop || plotWet(P)) return; settlePlot(P, pr); P.wet = Date.now() + (CROPS[P.crop].long ? LONG_WET : wetMs(farmer(pr).sk.soak)); });
}
// buying a building (home.js, the Farm Board's lower rows)
function yardBuild(game, id) {
  const pr = game.profile, B = YARD.builds[id], Y = yardOf(pr), F = farmer(pr);
  if (Y.built[id]) { game.toast(`${B.name}: ${B.desc}`, '#c9c1a8'); return; }
  if (F.lv < B.lv) { game.toast(`${B.name} needs Farm Level ${B.lv}`, '#ff8a8a'); return; }
  if ((pr.gold || 0) < B.gold) { game.toast(`${B.name} costs ${fmtG(B.gold)}`, '#ff8a8a'); return; }
  pr.gold -= B.gold; Y.built[id] = true; game.toast(`${B.name} built! ${B.desc}`, '#ffd23f'); game.save();
}
const yardRows = pr => YARD_KEYS.map(id => { const B = YARD.builds[id], F = farmer(pr), has = built(pr, id), can = F.lv >= B.lv && (pr.gold || 0) >= B.gold;
  return { draw: objRow(B.sprite[0], B.sprite[1]), name: `BUILD: ${B.name}`, sub: `${B.desc} · needs Farm Level ${B.lv}`, right: has ? 'BUILT' : fmtG(B.gold), rightCol: has ? '#ffd23f' : can ? '#8fffb0' : '#9a917c' }; });
// what a farm animal shows over its head (animals.js)
function drawYardMark(pr, A, near) {
  if (!A.yardKey) return; const st = yardState(pr, A), y = A.y - (A.k === 'chicken' ? 22 : 40), good = YARD.goods[A.k];
  if (st === 'ready') iconCentered('items', itemIcon(good), A.x, y + Math.sin(performance.now() / 260) * 1.5, 14);
  else if (st === 'hungry') { ctx.save(); ctx.globalAlpha = 0.75; iconCentered('items', itemIcon('wheat'), A.x, y, 10); ctx.restore(); }
  if (near) text(st === 'hungry' ? 'Enter: feed' : st === 'ready' ? `Enter: collect ${ITEMS[good].name}` : 'Content', A.x, y - 12, '#ffe9a8', 7);
}
// PLOTS: every farm starts with four open plots. The rest are bought one at a time at that farm's own board, dearer each time.
// pr.yard.open[plot index] = true. Plots already in use when this arrived stay open.
const PLOTS = { start: 4, cost: n => 200 + (n - 4) * 120, boardUp: 40 };
const plotsOf = town => farmPlots().map((c, i) => (c.town == null ? town == null : c.town === town) ? i : -1).filter(i => i >= 0);
function plotsOpen(pr) {
  const Y = yardOf(pr); if (Y.open) return Y.open; Y.open = {};
  for (const t of [null, ...OUTPOSTS.map(O => O.i)]) plotsOf(t).slice(0, PLOTS.start).forEach(i => { Y.open[i] = true; });
  (pr.farm || []).forEach((P, i) => { if (P) Y.open[i] = true; });
  return Y.open;
}
const plotOpen = (pr, i) => !!plotsOpen(pr)[i];
const openCount = (pr, town) => plotsOf(town).filter(i => plotOpen(pr, i)).length;
function plotBuy(game, town) {
  const pr = game.profile, L = plotsOf(town), next = L.find(i => !plotOpen(pr, i)), n = openCount(pr, town);
  if (town != null && !ownsTownHome(pr, town)) { game.toast(`Buy the house in ${OUTPOSTS[town].name} to farm here`, '#ffd27a'); return; }
  if (next == null) { game.toast('Every plot here is open', '#c9c1a8'); return; }
  const g = PLOTS.cost(n); if ((pr.gold || 0) < g) { game.toast(`The next plot costs ${fmtG(g)}`, '#ff8a8a'); return; }
  pr.gold -= g; plotsOpen(pr)[next] = true; game.toast(`Plot unlocked! ${n + 1} of ${L.length} open here`, '#b8ff8a'); game.save();
}
function plotRow(pr, town) {
  const L = plotsOf(town), n = openCount(pr, town), done = n >= L.length, sale = town != null && !ownsTownHome(pr, town), g = PLOTS.cost(n);
  return { icon: ITEM2_BASE + 906, name: `UNLOCK A PLOT · ${town == null ? 'Hearthvale' : OUTPOSTS[town].name}  (${n}/${L.length})`, sub: sale ? `Buy the house in ${OUTPOSTS[town].name} to farm here` : done ? 'Every plot here is open' : 'Opens the next plot on this farm · Enter to buy',
    right: done ? 'ALL OPEN' : sale ? 'LOCKED' : fmtG(g), rightCol: done ? '#ffd23f' : !sale && (pr.gold || 0) >= g ? '#8fffb0' : '#9a917c' };
}
// the outpost farms have their own boards, beside their wells
const townBoard = O => ({ x: O.well.x, y: O.well.y + PLOTS.boardUp });
const nearTownBoard = w => (w.overworld && !w.interior && OUTPOSTS.find(O => { const B = townBoard(O); return Math.hypot(w.player.x - B.x, w.player.y - B.y) < 26; })) || null;
