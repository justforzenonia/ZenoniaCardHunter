'use strict';
// GATHERING: every area of the Wilds has a few herb patches and ore veins, in the same spots each visit, marked with a
// sparkle. Press Enter beside one: herbs give crops and now and then a rare seed, ore gives gold and now and then a coin.
// A spot is spent for the rest of the real day (pr.nodes[key] = the day it was gathered). The art is the game's own.
const NODES = {
  perArea: 5, reach: 30, seasonPts: 2, seedChance: 0.08, coinChance: 0.1, oreGold: [120, 90], herbN: [2, 3], crops: ['wheat', 'carrot', 'tomato', 'berry', 'lettuce', 'nectarine', 'pumpkin'], span: 1,
  art: [{ herb: [66, 0], ore: [2, 0] }, { herb: [43, 0], ore: [2, 0] }, { herb: [286, 2], ore: [293, 1] }, { herb: [45, 1], ore: [50, 1] }],
};
function nodesFor(w, ri) {
  const R = REGIONS[ri], r = seededRng((WORLD_SEED ^ (ri * 7919 + 0x90DE)) >>> 0), A = NODES.art[R.zone], out = [];
  for (let n = 0, t = 0; n < NODES.perArea && t < 300; t++) {
    const x = (R.ox + 2 + r() * (R.w - 4)) * T, y = (R.oy + 3 + r() * (R.h - 5)) * T, kind = n % 2 ? 'ore' : 'herb';
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || w.blocked(x, y + 8) || inRiverAt(x, y)) continue;
    out.push({ key: `${ri}:${n}`, kind, zone: R.zone, x, y, art: A[kind] }); n++;
  }
  return out;
}
function nodesTick(game, w) {
  const p = w.player; if (w.interior || !p) return;
  w.nodeAreas = w.nodeAreas || {}; w.nodes = w.nodes || [];
  const here = regionIndexAt(p.x), day = dayNo(), done = game.profile.nodes || {};
  if (w.nodeHere !== here) {
    w.nodeHere = here;
    for (let i = here - NODES.span; i <= here + NODES.span; i++) if (REGIONS[i] && REGIONS[i].zone >= 0 && !w.nodeAreas[i]) { w.nodeAreas[i] = true; w.nodes.push(...nodesFor(w, i)); }
  }
  let near = null, nd = NODES.reach;
  for (const N of w.nodes) { if (done[N.key] === day) continue; const d = Math.hypot(N.x - p.x, N.y - p.y); if (d < nd) { nd = d; near = N; } }
  w.nodeNear = near;
}
function nodeGather(game, w) {
  const N = w.nodeNear; if (!N) return false;
  const pr = game.profile, p = w.player; pr.nodes = pr.nodes || {}; pr.nodes[N.key] = dayNo(); w.nodeNear = null;
  let msg;
  if (N.kind === 'herb') {
    const id = pick(NODES.crops), n = randi(NODES.herbN[0], NODES.herbN[1]); addItem(pr, id, n); msg = `+${n} ${ITEMS[id].name}${craftNode(pr, 'herb', N.zone)}`;
    if (Math.random() < NODES.seedChance) { addItem(pr, 'seed_moonflower', 1); msg += ' and a Moonflower Seed!'; }
  } else {
    const gold = NODES.oreGold[0] + N.zone * NODES.oreGold[1] + randi(0, 40); pr.gold = (pr.gold || 0) + gold; msg = `+${gold} G${craftNode(pr, 'ore', N.zone)}`;
    if (Math.random() < NODES.coinChance) { pr.coins = (pr.coins || 0) + 1; msg += ' and a coin!'; }
  }
  seasonGain(game, NODES.seasonPts);
  w.rings.push({ x: N.x, y: N.y, r: 18, t: 0, col: N.kind === 'herb' ? '#8fffb0' : '#ffd27a' });
  game.toast(`${N.kind === 'herb' ? 'Gathered' : 'Mined'} ${msg}`, N.kind === 'herb' ? '#8fffb0' : '#ffd27a'); game.save();
  return true;
}
function drawNode(N, near, now) {
  const r = objRec(pad3(N.art[0]), N.art[1]); if (!r) return;
  ctx.drawImage(img(D.objects.img), r[0], r[1], r[2], r[3], Math.round(N.x - r[2] / 2), Math.round(N.y - r[3] + 4), r[2], r[3]);
  gleam(N.x + 6, N.y - r[3] + 6 + Math.sin(now / 300 + N.x) * 2, 3, N.kind === 'herb' ? '#c8ffd8' : '#fff6c8', 0.9);
  if (near) text(N.kind === 'herb' ? 'Enter: gather' : 'Enter: mine', N.x, N.y - r[3] - 6, '#ffe9a8', 7);
}
function drawNodes(w, game, cam, vw, vh, items, now) {
  const done = (game.profile && game.profile.nodes) || {}, day = dayNo();
  for (const N of w.nodes || []) {
    if (done[N.key] === day || N.x < cam.x - 40 || N.x > cam.x + vw + 40 || N.y < cam.y - 20 || N.y > cam.y + vh + 60) continue;
    items.push({ y: N.y, draw: () => drawNode(N, N === w.nodeNear, now) });
  }
}
