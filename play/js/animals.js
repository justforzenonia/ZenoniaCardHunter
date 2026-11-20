'use strict';
// ANIMALS: herds that graze and wander through the Wilds, and a few at the Hearthvale farm, so the land feels lived in.
// They trot out of your way, and nothing fights them until you lead one. Press Enter beside a wild one to lead it: it follows you, enemies hunt it for as long as you lead it, you can't teleport with it, and the
// butcher's cottage beside the farm turns the ones you bring into meat (cow 6, pig 4, sheep and llama 3, chicken 1). "LPC style farm animals" by Daniel Eddeland
// (daneeklu, OpenGameArt, CC-BY 3.0, assets/animals-LICENSE.txt). Each sheet is 4 × 4 cells, rows facing up, left, down, right.
const ANIMALS = {
  kinds: { chicken: { cell: 32, foot: [27, 29, 28, 29], spd: 26, scale: 0.5, space: 11 }, cow: { cell: 128, foot: [112, 89, 104, 89], spd: 16, scale: 0.7, space: 27 }, llama: { cell: 128, foot: [94, 92, 93, 92], spd: 22, scale: 0.55, space: 19 }, pig: { cell: 128, foot: [91, 84, 92, 84], spd: 20, scale: 0.6, space: 19 }, sheep: { cell: 128, foot: [89, 82, 89, 82], spd: 20, scale: 0.6, space: 19 } },
  zones: [['cow', 'sheep', 'pig', 'chicken'], ['sheep', 'pig', 'chicken'], ['llama'], ['sheep', 'llama']],
  farm: [['cow', 1], ['sheep', 2], ['pig', 1], ['chicken', 4]],
  herds: [2, 3], size: [3, 5], leash: 90, flee: 46, span: 1, drop: 3, every: 1000, walkMs: 170, eatMs: 260, row: [0, 3, 2, 1], lead: { max: 3, reach: 44, gap: 26, snap: 340, speed: 1.35, start: 10, stride: 3, turn: 1.4, aggro: 420, life: { cow: 0.8, pig: 0.5, sheep: 0.5, llama: 0.5, chicken: 0.25 } }, meat: { cow: 6, pig: 4, sheep: 3, llama: 3, chicken: 1 }, butcher: { src: 'assets/butcher.png', w: 46, h: 50, foot: 47, reach: 56, dx: 56, shakeMs: 500 }, part: 34, farmGap: 62, farmUp: 62, farmLeash: 34, plot: [30, 26],
};
const animalSrc = (k, a) => `assets/animals/${k}_${a}.png`;
function addAnimal(w, k, x, y, home, leash) { w.animals.push({ k, x, y, dir: randi(0, 3), act: 'eat', t: rand(0, 3000), left: rand(800, 3000), home: home || { x, y }, leash: leash || ANIMALS.leash }); }
function herdAt(w, R) {
  const kinds = ANIMALS.zones[R.zone]; if (!kinds) return;
  for (let h = 0, n = randi(ANIMALS.herds[0], ANIMALS.herds[1]); h < n; h++) for (let t = 0; t < 40; t++) {
    const x = (R.ox + 2 + Math.random() * (R.w - 4)) * T, y = (R.oy + 3 + Math.random() * (R.h - 5)) * T; if (!mapReach(w.map, x, y) || w.blocked(x, y)) continue;
    const k = pick(kinds), home = { x, y };
    for (let i = 0, m = randi(ANIMALS.size[0], ANIMALS.size[1]), gap = ANIMALS.kinds[k].space * 2.4; i < m; i++) { const at = findOpen(w, x + (i % 3 - 1) * gap + rand(-5, 5), y + (Math.floor(i / 3) - 0.5) * gap * 0.8 + rand(-4, 4)); addAnimal(w, k, at.x, at.y, home); }
    break;
  }
}
function animalsInit(w) {
  w.animals = []; w.herded = {}; w.animalT = 0;
  const plots = farmPlots().filter(c => c.town == null), cx = plots.reduce((s, c) => s + c.x, 0) / plots.length, top = Math.min(...plots.map(c => c.y)), kinds = ANIMALS.farm.flatMap(([k, n]) => Array(n).fill(k));
  kinds.forEach((k, i) => { const at = findOpen(w, cx + (i - (kinds.length - 1) / 2) * ANIMALS.farmGap, top - ANIMALS.farmUp + (i % 2) * 14); addAnimal(w, k, at.x, at.y, { x: at.x, y: at.y }, ANIMALS.farmLeash); const A = w.animals[w.animals.length - 1]; A.farm = true; A.yardKey = `f${i}`; });
  const at = findOpen(w, TOWN_OX + VILLAGE.butcher[0] * T + 8, TOWN_OY + VILLAGE.butcher[1] * T + 8); w.butcher = { x: at.x, y: at.y, t: 0 };   // (at the butcher's cottage door: worldgen.js VILLAGE.butcher)
}
// farm plots are for crops: animals walk round them
const animalOnPlot = (x, y) => inTown(x) && farmPlots().some(c => Math.abs(c.x - x) < ANIMALS.plot[0] && Math.abs(c.y - y) < ANIMALS.plot[1]);
// animals keep their distance: anyone too close steps aside and turns away
function animalSpace(w, A, dt) {
  const K = ANIMALS.kinds[A.k];
  for (const B of w.animals) {
    if (B === A) continue;
    const gap = K.space + ANIMALS.kinds[B.k].space, dx = A.x - B.x, dy = (A.y - B.y) * 1.3; if (Math.abs(dx) > gap || Math.abs(dy) > gap) continue;
    const d = Math.hypot(dx, dy) || 1; if (d >= gap) continue;
    const s = ANIMALS.part * dt / 1000, ux = dx ? dx / d : (A.home.x % 2 ? 1 : -1), uy = dy / d, nx = A.x + ux * s, ny = A.y + uy * s;
    if (!w.blocked(nx, ny) && mapReach(w.map, nx, ny) && !animalOnPlot(nx, ny)) { A.x = nx; A.y = ny; }
    if (A.act === 'walk') { A.dir = dirTo(dx, dy); }
  }
}
const animalLeads = w => (w.animals || []).filter(A => A.lead);
// a led animal stands in the fight through a hidden body on the hero's side: monsters hit that with their ordinary attacks, it
// keeps to the animal (animalBodyTick, from updateActor), and its HP is drawn on the animal. A share of the hero's own HP, so it lasts at any level.
function animalBody(w, A) {
  const p = w.player, old = A.body; if (old && !old.remove && !old.dead && w.actors.includes(old)) { old.owner = p; return old; }
  const b = makeMonster('002', 0, A.x, A.y), max = A.maxHp || Math.max(30, Math.round(p.maxHp * ANIMALS.lead.life[A.k]));
  Object.assign(b, { animalBody: A, ally: true, owner: p, team: p.team, slot: -1, def: 0, atk: 0, spell: null }); b.maxHp = max; b.hp = A.hp ?? max;
  A.maxHp = max; A.hp = b.hp; A.body = b; w.actors.push(b); return b;
}
function animalBodyTick(w, b) {
  const A = b.animalBody; b.x = A.x; b.y = A.y; b.z = b.vz = b.vx = b.vy = 0; b.state = 'free'; A.hp = Math.max(0, b.hp);
  if (b.hp <= 0 && !b.dead) kill(w, b);
}
function animalFree(A) { if (A.body) A.body.remove = true; A.body = null; A.hp = A.maxHp = null; }
function animalLost(w, A) {
  A.body = null; w.animals = w.animals.filter(q => q !== A); w.rings.push({ x: A.x, y: A.y, r: 24, t: 0, col: '#ff8a8a' });
  if (window.GAME) GAME.toast(`Your ${A.k} was killed!`, '#ff8a8a');
}
// the nearest led animal in a monster's reach: it goes for that before anything else
function animalPrey(w, m) {
  let best = null, bd = ANIMALS.lead.aggro; for (const b of w.prey || []) { if (b.dead) continue; const d = Math.hypot(b.x - m.x, b.y - m.y); if (d < bd) { bd = d; best = b; } }
  return best;
}
// no teleporting while you lead an animal: they have to be walked home
function leadingBlocks(game) {
  if (!(game.ledAnimals || []).length) return false;
  game.toast('You can\'t teleport while leading animals. Walk them, or let them go', '#ff8a8a'); return true;
}
const nearButcher = w => !!(w.butcher && Math.hypot(w.player.x - w.butcher.x, w.player.y - w.butcher.y) < ANIMALS.butcher.reach);
// Enter beside a wild animal: it follows you, or stops following
function animalLead(game, w) {
  const A = w.animalNear; if (!A) return false;
  if (A.lead) { A.lead = false; animalFree(A); A.home = { x: A.x, y: A.y }; game.toast(`The ${A.k} wanders off`, '#c9c1a8'); return true; }
  if (animalLeads(w).length >= ANIMALS.lead.max) { game.toast(`You can lead ${ANIMALS.lead.max} animals at a time`, '#ff8a8a'); return true; }
  A.lead = true; game.toast(`The ${A.k} follows you. Bring it to the butcher beside your farm`, '#ffd27a'); return true;
}
// the butcher (home.js homeInteract): everything you are leading becomes meat
function butcherUse(game, w) {
  const L = animalLeads(w), B = w.butcher; if (!L.length) { game.toast('Butcher: lead a wild animal here first (Enter beside one)', '#c9c1a8'); return; }
  let n = 0; for (const A of L) n += ANIMALS.meat[A.k];
  addItem(game.profile, 'meat', n); L.forEach(animalFree); w.animals = w.animals.filter(A => !A.lead); game.ledAnimals = []; B.t = ANIMALS.butcher.shakeMs;
  w.rings.push({ x: B.x, y: B.y, r: 26, t: 0, col: '#ffd27a' });
  craftButcher(game.profile, L.length); game.toast(`The butcher gives you ${n} Raw Meat, ${L.length} Thin Leather and ${L.length} Huge Bone`, '#ffd27a'); game.save();
}
function animalFollow(w, A, dt, i) {
  const L = ANIMALS.lead, K = ANIMALS.kinds[A.k], p = w.player, dx = p.x - A.x, dy = p.y - A.y, d = Math.hypot(dx, dy) || 1, stay = L.gap + K.space + i * L.gap;
  if (d > L.snap) { const at = findOpen(w, p.x - DV[p.dir][0] * stay, p.y - DV[p.dir][1] * stay); A.x = at.x; A.y = at.y; return; }
  if (d <= stay + 0.5) A.pacing = false; else if (d > stay + L.start) A.pacing = true;   // it stops close by and sets off again a little later, so it doesn't twitch
  if (!A.pacing) { A.act = 'idle'; return; }
  const v = Math.max(K.spd, speedOf(p) * L.speed), step = Math.min(v * dt / 1000, d - stay), nx = A.x + dx / d * step, ny = A.y + dy / d * step, goX = !w.blocked(nx, A.y), goY = !w.blocked(A.x, ny);
  A.act = 'walk'; A.t += dt * clamp(v / K.spd, 1, L.stride);   // its legs keep up with its speed, or it slides
  const ax = Math.abs(dx), ay = Math.abs(dy), sideways = A.dir === 1 || A.dir === 3; if ((ax > ay) === sideways || Math.max(ax, ay) > Math.min(ax, ay) * L.turn) A.dir = dirTo(dx, dy);   // (no flickering between facings on a diagonal)
  if (goX || !goY) A.x = nx; if (goY || !goX) A.y = ny;   // round what's in the way; if it's boxed in it pushes through
}
// what an animal runs from besides you: a monster on the hunt or swinging close by, or a hit landing near it in the last moment
const ANIMAL_FEAR = { mon: 80, fray: 100, frayMs: 1600 };
function animalDanger(w, A) {
  const now = performance.now(); let best = null, bd = 1e9;
  if (w.fray) { w.fray = w.fray.filter(f => now - f.t < ANIMAL_FEAR.frayMs); for (const f of w.fray) { const d = Math.hypot(f.x - A.x, f.y - A.y); if (d < ANIMAL_FEAR.fray && d < bd) { bd = d; best = f; } } }
  for (const m of w.actors) { if (m.kind !== 'monster' || m.dead || m.ally || !(m.chasing || m.state === 'attack')) continue; const d = Math.hypot(m.x - A.x, m.y - A.y); if (d < ANIMAL_FEAR.mon && d < bd) { bd = d; best = m; } }
  return best;
}
function animalStep(w, A, dt) {
  const K = ANIMALS.kinds[A.k], p = w.player, d = Math.hypot(A.x - p.x, A.y - p.y), danger = animalDanger(w, A), scared = (d < ANIMALS.flee && A !== w.animalNear) || !!danger;
  A.t += dt; A.left -= dt;
  if (danger) { if (!A.bolt) { A.bolt = true; A.t = 0; } A.act = 'walk'; A.left = 900; A.dir = dirTo(A.x - danger.x, A.y - danger.y); }   // monsters fighting or hunting close by: it bolts the other way
  else if (scared) { A.bolt = false; A.act = 'walk'; A.left = 500; const dx = A.x - p.x, dy = A.y - p.y; A.dir = dirTo(dx, dy); }
  else A.bolt = false;
  if (!danger && !scared && A.left <= 0) {
    A.act = A.act === 'walk' ? (Math.random() < 0.7 ? 'eat' : 'idle') : 'walk'; A.left = A.act === 'walk' ? rand(800, 2400) : rand(1500, 5000);
    if (A.act === 'walk') { const hx = A.home.x - A.x, hy = A.home.y - A.y; A.dir = Math.hypot(hx, hy) > A.leash ? dirTo(hx, hy) : randi(0, 3); }
  }
  animalSpace(w, A, dt);
  if (A.act !== 'walk') return;
  const [dx, dy] = DV[A.dir], s = K.spd * (danger ? 2.8 : scared ? 2.4 : 1) * dt / 1000, nx = A.x + dx * s, ny = A.y + dy * s;
  if (w.blocked(nx, ny) || !mapReach(w.map, nx, ny) || animalOnPlot(nx, ny)) { A.dir = (A.dir + 2) % 4; return; }
  A.x = nx; A.y = ny;
}
// each world frame (daily.js): herds appear around you and are dropped far behind
function animalsTick(game, w) {
  if (w.interior || !w.player) return;
  const now = performance.now(), dt = Math.min(50, now - (w.animalAt || now)); w.animalAt = now;
  if (!w.animals) animalsInit(w);
  const p = w.player;
  if ((w.animalT -= dt) <= 0) {
    w.animalT = ANIMALS.every; const here = regionIndexAt(p.x);
    for (let i = here - ANIMALS.span; i <= here + ANIMALS.span; i++) { const R = REGIONS[i]; if (R && R.zone >= 0 && !w.herded[i]) { w.herded[i] = true; herdAt(w, R); } }
    for (const i in w.herded) if (Math.abs(i - here) > ANIMALS.drop) { delete w.herded[i]; const R = REGIONS[i]; w.animals = w.animals.filter(A => A.lead || !(A.x >= R.ox * T && A.x < (R.ox + R.w) * T)); }
  }
  let near = null, nd = ANIMALS.lead.reach, led = 0; w.prey = [];
  for (const A of w.animals) {
    if (A.lead) { animalFollow(w, A, dt, led++); w.prey.push(animalBody(w, A)); }
    else if (Math.abs(A.x - p.x) < 420) animalStep(w, A, dt);
    const d = Math.hypot(A.x - p.x, A.y - p.y); if (!A.farm && d < nd) { nd = d; near = A; }
  }
  w.animalNear = near; game.ledAnimals = animalLeads(w).map(A => A.k); yardTick(game, w);
  if (w.butcher && w.butcher.t > 0) w.butcher.t -= dt;
}
function drawAnimal(A) {
  const K = ANIMALS.kinds[A.k], moving = A.act === 'walk', im = img(animalSrc(A.k, moving ? 'walk' : 'eat')); if (!im || !im.complete || !im.naturalWidth) return;
  const c = K.cell, fr = A.act === 'idle' ? 0 : Math.floor(A.t / (moving ? ANIMALS.walkMs : ANIMALS.eatMs)) % 4, row = ANIMALS.row[A.dir], sm = ctx.imageSmoothingEnabled;
  const q = K.scale, sz = c * q;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(A.x, A.y, c === 32 ? 5 : 11 * q / 0.6, c === 32 ? 2 : 4 * q / 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingEnabled = false; ctx.drawImage(im, fr * c, row * c, c, c, Math.round(A.x - sz / 2), Math.round(A.y - K.foot[row] * q), sz, sz); ctx.imageSmoothingEnabled = sm;
  if (A.lead && A.maxHp) { const bw = 22, bx = Math.round(A.x - bw / 2), by = Math.round(A.y - K.foot[row] * q) - 4, k = Math.max(0, A.hp / A.maxHp); ctx.fillStyle = '#000000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4); ctx.fillStyle = '#3a1418'; ctx.fillRect(bx, by, bw, 2); ctx.fillStyle = k > 0.3 ? '#5ad08a' : '#ff5a4a'; ctx.fillRect(bx, by, bw * k, 2); }
}
// the butcher is a cottage on the map now (worldgen.js VILLAGE.butcher); only the prompt at its door is drawn here
function drawButcher(w, now) {
  const B = w.butcher; if (nearButcher(w)) text(`Enter: butcher (${animalLeads(w).length} led)`, B.x, B.y - 14, '#ffe9a8', 7);
}
function drawAnimals(w, cam, vw, vh, items) {
  const B = w.butcher, now = performance.now(); if (B && B.x > cam.x - 60 && B.x < cam.x + vw + 60 && B.y > cam.y - 20 && B.y < cam.y + vh + 80) items.push({ y: B.y, draw: () => drawButcher(w, now) });
  for (const A of w.animals || []) {
    if (A.x < cam.x - 80 || A.x > cam.x + vw + 80 || A.y < cam.y - 40 || A.y > cam.y + vh + 100) continue;
    items.push({ y: A.y, draw: () => { drawAnimal(A); if (A.farm && window.GAME) drawYardMark(GAME.profile, A, A === w.yardNear); if (A === w.animalNear) text(A.lead ? 'Enter: let go' : 'Enter: lead', A.x, A.y - 34, '#ffe9a8', 7); } });
  }
}
