'use strict';
// TRAVELLERS ON THE ROAD (2026-11-18, the user: "lets finish making the world more alive", chose "Travellers on the road"). The Wilds had
// monsters, wanderers standing in place with tasks, and nobody simply going somewhere. Now a few peaceful folk walk the areas near you:
//   WHO      a merchant, a pilgrim, a courier (quick), a bard (little notes rise as they walk), a herbalist, an old couple (two of them,
//            side by side) and a child on an adventure; villager sprites from the wanderers' pool, a name tag like townsfolk.
//   HOW      one comes into view at an area's edge every so often (ROAD.every) while fewer than ROAD.want are about, and walks across
//            the area along open ground (a path found on the walkable grid), stopping now and then to look around, then leaves past
//            the far side. A pilgrim whose area holds a goddess (goddess.js) walks to her and rests there a while before going on.
//   GREETING when you pass close, they turn to you and say a line once (a speech bubble, like townsfolk). Enter beside one: a few words,
//            and now and then a small gift (bread, a potion, a little gold), once each.
// Monsters never target them (only players and monsters are foes). Online, only the host has them. Calm: no sound, small bubbles.
const ROAD = { want: 3, every: [6000, 11000], near: 1600, gone: 2200, speed: 26, greet: 64, talk: 30, giftP: 0.3 };
const ROAD_KINDS = [
  { role: 'Merchant', names: ['Bram', 'Odile', 'Corwin'], hi: ['Fine day for the road!', 'Mind the slimes — they nibble my cart wheels.'], talk: ['Buy low, sell high, and walk a great deal in between.', 'Hearthvale pays well for river pearls, if you find any.'] },
  { role: 'Pilgrim', names: ['Ana', 'Brother Tam', 'Ilse'], goddess: true, hi: ['Bless your road.', 'I walk to the goddess. Every step is a prayer.'], talk: ['Rest in her garden when you can. Nothing hunts there.', 'Some walk for wishes. I walk for the walking.'] },
  { role: 'Courier', names: ['Pip', 'Rook', 'Sela'], speed: 1.7, hi: ['Letters! Coming through!', 'Can\'t stop — the mail waits for no one!'], talk: ['Three towns before sundown. Easy.', 'If you see a lost parcel, it\'s probably mine.'] },
  { role: 'Bard', names: ['Lute', 'Melisande', 'Fennick'], notes: true, hi: ['♪ La-la-laa…', 'A song for the road, friend?'], talk: ['I am writing a ballad about a hero. Could be you.', 'Every road has its own tune. This one hums.'] },
  { role: 'Herbalist', names: ['Oona', 'Moss', 'Tilda'], hi: ['These meadows are full of healing leaves.', 'Careful where you step — that is mint!'], talk: ['A pinch of moonflower helps you sleep. Very calm.', 'The grove at dusk smells of rain and honey.'] },
  { role: 'Old couple', names: ['Hal & Greta', 'Wim & Rosa'], pair: true, speed: 0.75, hi: ['Fifty years we have walked this road.', 'Lovely weather, isn\'t it, dear?'], talk: ['We met on this very path. He was lost. Still is.', 'Take your time, young one. The road keeps.'] },
  { role: 'Young explorer', names: ['Nell', 'Toby', 'Kip'], speed: 1.2, hi: ['I\'m going all the way to the next town!', 'Have you seen a butterfly with blue wings?'], talk: ['Mum says I can explore as long as I\'m home for supper.', 'When I grow up I\'ll be a card hunter too!'] },
];
// a walking route across the area: open cells on the world grid, found once (breadth first, inside the area and its edges)
function roadPath(w, R, from, to) {
  const M = w.map, x0 = Math.max(0, R.ox - 2), x1 = Math.min(M.w - 1, R.ox + R.w + 1), y0 = Math.max(0, R.oy), y1 = Math.min(M.h - 1, R.oy + R.h - 1);
  const W = x1 - x0 + 1, ok = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && !M.solid[y * M.w + x] && (!M.reach || M.reach[y * M.w + x]);
  if (!ok(from[0], from[1]) || !ok(to[0], to[1])) return null;
  const prev = new Int32Array(W * (y1 - y0 + 1)).fill(-1), q = [(from[1] - y0) * W + from[0] - x0]; prev[q[0]] = q[0];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % W + x0, cy = Math.floor(c / W) + y0; if (cx === to[0] && cy === to[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (!ok(nx, ny)) continue; const j = (ny - y0) * W + nx - x0; if (prev[j] < 0) { prev[j] = c; q.push(j); } }
  }
  let c = (to[1] - y0) * W + to[0] - x0; if (prev[c] < 0) return null;
  const out = []; while (prev[c] !== c) { out.push([(c % W + x0) * T + 8, (Math.floor(c / W) + y0) * T + 10]); c = prev[c]; } out.reverse();
  return out.filter((p, i) => i % 2 === 0 || i === out.length - 1);   // (every other cell: they walk smoothly, not in steps)
}
// an open cell in the area's column band (left or right edge, or a given column), nearest the middle row
function roadCell(w, R, tx) {
  const M = w.map, open = (x, y) => !M.solid[y * M.w + x] && (!M.reach || M.reach[y * M.w + x]), mid = R.oy + Math.floor(R.h / 2);
  for (let d = 0; d < R.h / 2; d++) for (const y of [mid + d, mid - d]) if (y > R.oy && y < R.oy + R.h - 1 && open(tx, y)) return [tx, y];
  return null;
}
function roadSpawn(game, w) {
  const p = w.player, here = regionIndexAt(p.x), regs = [here - 1, here, here + 1].map(i => REGIONS[i]).filter(R => R && R.zone >= 0);
  if (!regs.length) return;
  const about = w.actors.filter(n => n.road), used = new Set(about.map(n => n.road.K.role));   // (a different kind each, so no two Merchant Corwins)
  const R = pick(regs), K = pick(ROAD_KINDS.filter(k => !used.has(k.role))), east = Math.random() < 0.5; if (!K) return;
  let a = roadCell(w, R, east ? R.ox + R.w - 2 : R.ox + 1), b = roadCell(w, R, east ? R.ox + 1 : R.ox + R.w - 2); if (!a || !b) return;
  if (Math.hypot(a[0] * T - p.x, a[1] * T - p.y) < VW / ZOOM / 2 + 40) { [a, b] = [b, a]; if (Math.hypot(a[0] * T - p.x, a[1] * T - p.y) < VW / ZOOM / 2 + 40) return; }   // (they come into view, never pop up beside you)
  if (about.some(n => Math.hypot(n.x - (a[0] * T + 8), n.y - (a[1] * T + 10)) < 90)) return;   // (never two setting out from one spot: their name tags overlapped)
  const S = K.goddess && typeof midStones === 'function' ? midStones(w).find(s => s.R === R) : null;
  let stop = null;   // (the open cell nearest a spot just beside her: the first try often landed on a tree or a flower bed's edge)
  if (S) { const M = w.map, gx = Math.floor(S.gx / T), gy = Math.floor(S.gy / T) + 1, side = Math.random() < 0.5 ? -2 : 2;
    for (let d = 0; d <= 4 && !stop; d++) for (let oy = -d; oy <= d && !stop; oy++) for (let ox = -d; ox <= d && !stop; ox++) { const x = gx + side + ox, y = gy + oy; if (x >= 0 && y >= 0 && x < M.w && y < M.h && !M.solid[y * M.w + x] && (!M.reach || M.reach[y * M.w + x])) stop = [x, y]; } }
  const p1 = stop && roadPath(w, R, a, stop), p2 = stop && roadPath(w, R, stop, b);
  if (!(p1 && p2)) stop = null;   // (no way to her: a plain walk across instead)
  const path = stop ? [...p1, ...p2] : roadPath(w, R, a, b); if (!path || path.length < 6) return;
  const npc = pick(WANDER_NPCS.filter(id => D.npcs[id])), name = pick(K.names), id = 'road' + Math.random().toString(36).slice(2, 7);
  const make = (dx, dy, nid) => { const n = baseActor('npc', 2, a[0] * T + 8 + dx, a[1] * T + 10 + dy); Object.assign(n, { npc: nid, label: `${K.role} ${name}`.replace('Old couple ', ''), role: 'road', h: 26, home: { x: n.x, y: n.y }, ai: { still: true }, road: { id, K, path, i: 0, wait: 0, stop: stop ? stop.map((v, j) => v * T + (j ? 10 : 8)) : null, rested: 0, greeted: false, talked: false, dx, dy } }); w.actors.push(n); return n; };
  const lead = make(0, 0, npc);
  if (K.pair) { const mate = make(14, 4, pick(WANDER_NPCS.filter(x => x !== npc && D.npcs[x]))); mate.road.follow = lead; mate.label = ''; }
}
function roadTick(game, w, dt) {
  if (!w.overworld || w.interior || (game.net && game.net.role === 'guest')) return;
  const p = w.player, folk = w.actors.filter(a => a.road);
  for (const n of folk) {
    const r = n.road; if (n.say && (n.say.t -= dt) <= 0) n.say = null;
    if (Math.abs(n.x - p.x) > ROAD.gone) { n.remove = true; continue; }
    // a partner keeps beside the lead
    if (r.follow) {
      const L = r.follow; if (L.remove || !w.actors.includes(L)) { n.remove = true; continue; }
      const tx = L.x + r.dx, ty = L.y + r.dy, d = Math.hypot(tx - n.x, ty - n.y); n.dir = L.dir;
      if (d > 2) { const sp = Math.min(d, ROAD.speed * 1.2 * dt / 1000); moveBy(w, n, (tx - n.x) / d * sp, (ty - n.y) / d * sp); setAnim(n, 'walk', true); } else setAnim(n, L.anim === 'walk' ? 'walk' : 'idle', true);
      continue;
    }
    const dp = Math.hypot(p.x - n.x, p.y - n.y);
    // greeting: turn to you, a line, once
    if (!r.greeted && dp < ROAD.greet && !p.dead) { r.greeted = true; r.wait = Math.max(r.wait, 1600); n.dir = dirTo(p.x - n.x, p.y - n.y); n.say = { s: pick(r.K.hi), t: 2600 }; }
    if (r.wait > 0) { r.wait -= dt; setAnim(n, 'idle', true); if (dp < ROAD.greet) n.dir = dirTo(p.x - n.x, p.y - n.y); continue; }
    // a pilgrim rests by the goddess a while
    if (r.stop && !r.rested && Math.hypot(r.stop[0] - n.x, r.stop[1] - n.y) < 12) { r.rested = 1; r.wait = 9000; n.dir = 0; if (dp < 200) n.say = { s: 'Thank you, goddess…', t: 2400 }; continue; }
    const q = r.path[r.i]; if (!q) { n.remove = true; continue; }   // (past the far side: on their way)
    const dx = q[0] - n.x, dy = q[1] - n.y, d = Math.hypot(dx, dy), sp = ROAD.speed * (r.K.speed || 1) * dt / 1000;
    if (d < 3) { r.i++; if (Math.random() < 0.03) r.wait = rand(1200, 2600); continue; }   // (now and then a look round)
    const x0 = n.x, y0 = n.y; moveBy(w, n, dx / d * Math.min(sp, d), dy / d * Math.min(sp, d)); n.dir = dirTo(dx, dy); setAnim(n, 'walk', true);
    if (Math.hypot(n.x - x0, n.y - y0) < sp * 0.2) { r.stuck = (r.stuck || 0) + dt; if (r.stuck > 1500) { n.x = q[0]; n.y = q[1]; r.stuck = 0; } } else r.stuck = 0;   // (nudged past whatever blocked them: a monster, a crate)
    if (r.K.notes && Math.random() < dt / 900) (w.particles = w.particles || []).push({ x: n.x + rand(-4, 4), y: n.y - 30, vx: rand(-6, 6), vy: -18, t: 0, life: 1400, col: '#fff3c8', size: 1.6, drag: 0.98 });
  }
  w.roadT = (w.roadT || rand(...ROAD.every)) - dt;
  if (w.roadT <= 0) { w.roadT = rand(...ROAD.every); if (folk.filter(n => !n.road.follow).length < ROAD.want) try { roadSpawn(game, w); } catch (e) {} }
}
// Enter beside one: a few words, and now and then a small gift
function roadTalk(game, w) {
  const p = w.player, n = w.actors.find(a => a.road && !a.road.follow && Math.hypot(a.x - p.x, a.y - p.y) < ROAD.talk + 8); if (!n) return false;
  const r = n.road; n.dir = dirTo(p.x - n.x, p.y - n.y); r.wait = 3000; n.say = { s: pick(r.K.talk), t: 3200 };
  if (!r.talked) {
    r.talked = true;
    if (Math.random() < ROAD.giftP) {
      const pr = game.profile, roll = Math.random();
      if (roll < 0.4 && typeof addItem === 'function') { addItem(pr, 'bread', 1); game.toast(`${n.label}: "Here, for the road." (+1 bread)`, '#ffe9a8'); }
      else if (roll < 0.7 && typeof potionIdx === 'function' && potionIdx(10) != null) { const i = potionIdx(10); pr.goods = pr.goods || {}; pr.goods[i] = (pr.goods[i] || 0) + 1; game.toast(`${n.label}: "Take this, just in case." (+1 potion)`, '#ffe9a8'); }
      else { const g = randi(20, 60); pr.gold = (pr.gold || 0) + g; game.toast(`${n.label}: "For your trouble." (+${g} G)`, '#ffd23f'); }
      game.save();
    }
  }
  return true;
}
{
  const nw = npcWander;
  npcWander = (world, n, dt) => { if (n.road) return; return nw(world, n, dt); };   // (they walk by roadTick)
  const st = safeTick;
  safeTick = (game, w, dt) => { const r = st(game, w, dt); try { roadTick(game, w, dt); } catch (e) { if (!roadTick.warned) { roadTick.warned = true; console.warn('roadfolk', e); } } return r; };
  const wi = wandererInteract;
  wandererInteract = (game, w) => (w && w.overworld && roadTalk(game, w)) || wi(game, w);
}
