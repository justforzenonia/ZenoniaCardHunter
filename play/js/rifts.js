'use strict';
// Random treasure chests and the Survival Rift.
// Every 40–80 s a treasure chest appears at a random spot in a zone (at most 2 waiting per zone; they vanish
// after 4 minutes). Opening one gives the usual chest loot, but 20% of the time it is a trap: a crimson rift
// drags the hero into a copy of the zone where monsters pour in non-stop. Survive 30 seconds and you are sent
// back with a big reward; fall and you are thrown out empty-handed.

const CHESTS = { first: [6000, 15000], gap: [25000, 50000], perZone: 2, life: 240000, riftChance: 0.2 };
const RIFT = { dur: 30000, every: 550, burst: 2, maxMon: 24 };

function regionOfX(x) { return REGIONS.find(r => x >= r.ox * T && x < (r.ox + r.w) * T) || null; }

function updateRandomChests(game, w, dt) {
  respawnCrates(w, dt);
  if (w.chestT == null) w.chestT = rand(...CHESTS.first);
  w.chestT -= dt;
  if (w.chestT <= 0) { w.chestT = rand(...CHESTS.gap); spawnRandomChest(game, w); }
  for (const o of objSpecial(w)) if (o.randChest && !o.opened && (o.life -= dt) <= 0) o.remove = true;   // (world.js objCols)
}
function spawnRandomChest(game, w) {
  const p = w.player, wild = REGIONS.filter(r => r.zone >= 0);
  const here = regionOfX(p.x);
  const R = here && here.zone >= 0 && Math.random() < 0.65 ? here : pick(wild);
  if (w.objects.filter(o => o.randChest && !o.opened && regionOfX(o.x) === R).length >= CHESTS.perZone) return;
  for (let k = 0; k < 300; k++) {
    const x = (R.ox + 2 + Math.random() * (R.w - 4)) * T, y = (R.oy + 3 + Math.random() * (R.h - 5)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || w.blocked(x, y - 12) || w.blocked(x + 10, y) || w.blocked(x - 10, y)) continue;
    if (Math.hypot(x - p.x, y - p.y) < 80) continue;
    if (w.objects.some(q => { if (Math.abs(q.x - x) > 90 || q.ground || q.draw || !q.bank) return false; const r = objRec(q.bank, q.fi); return r && x - 12 < q.x + r[4] + r[2] && x + 12 > q.x + r[4] && y - 20 < q.y + r[5] + r[3] && y + 2 > q.y + r[5]; })) continue;   // (never on top of a lamp, brazier or statue: props.js placeProp)
    const o = makeMapObject([3, 0, Math.round(x), Math.round(y)]);
    if (!o) return;
    Object.assign(o, { randChest: true, life: CHESTS.life }); maybeMimic(o);
    w.objects.push(o);
    if (R === here) game.toast(`A treasure chest appeared in ${ZONES[R.zone].name}!`, '#ffd23f');
    return;
  }
}
// called by openChest(): random chests may be rift traps
function chestOpened(world, o) {
  const game = window.GAME; siteChestOpened(game, o);
  if (o.templeChest && game.profile) { const pr = game.profile; (pr.hoards = pr.hoards || {})[o.templeChest] = pr.day || 0; }   // (the Sun Temple's chest: props.js templeChest)
  if (!o.randChest || world.rift || Math.random() >= CHESTS.riftChance) return;
  game.toast('It was a trap! A dimensional rift drags you in…', '#ff6a6a');
  world.flash = { t: 0, dur: 900, col: '#ff2a4a' };
  for (let k = 0; k < 3; k++) world.rings.push({ x: o.x, y: o.bottom - 6, r: 30 + k * 18, t: -k * 120, col: '#ff3a5a' });
  world.player.invuln = Math.max(world.player.invuln || 0, 1400);
  world.timers.push({ t: 1000, fn: () => { if (game.world === world && !world.player.dead) enterRift(game, o); } });
}
// gold light beam + sparkles so random chests are easy to spot
function drawChestBeacons(w, now) {
  for (const o of objSpecial(w)) {
    if (!(o.randChest || o.sideCache || o.campChest) || o.opened || o.remove) continue;
    ctx.save(); ctx.globalCompositeOperation = o.sideCache && o.sideCache.below ? 'source-over' : 'lighter';   // (a red glow added onto green ground turned yellow)
    const tall = o.sideCache ? 110 : 70, pg = ctx.createLinearGradient(0, o.bottom, 0, o.bottom - tall), rgb = o.sideCache && o.sideCache.below ? '255,90,70' : '255,210,80';
    pg.addColorStop(0, `rgba(${rgb},0.55)`); pg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(now / 300 + o.x);
    ctx.fillStyle = pg; ctx.fillRect(o.x - 6, o.bottom - tall, 12, tall);
    for (let i = 0; i < 6; i++) {
      const k = (now / 1300 + i / 6) % 1;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      gleam(o.x + Math.sin(i * 2.3) * 9, o.bottom - 6 - k * 40, 2, '#fff2b0', 1);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- the Survival Rift
function enterRift(game, chest) {
  const outside = game.world, p = outside.player;
  const R = regionOfX(chest.x) || REGIONS.find(r => r.zone >= 0), Z = ZONES[R.zone], M = regMap(R);
  const w = mapWorld(R.map);
  w.rift = { t: RIFT.dur, spawnT: 600, kills: 0, zone: R.zone };
  w.name = `Survival Rift · ${Z.name}`;
  w.bg = tintCanvas(w.bg, '#b03048');   // crimson dusk on the ground only; monsters keep their colours
  const party = outside.actors.filter(a => a === p || (a.ally && a.owner === p));
  outside.actors = outside.actors.filter(a => !party.includes(a));
  const [sx, sy] = M.spawn;
  for (const a of party) { a.x = sx + (a === p ? 0 : rand(-14, 14)); a.y = sy + (a === p ? 0 : 10); a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  w.player = p; w.portals = []; w.from = { x: chest.x, y: chest.bottom + 14 };
  w.onKill = m => { onMonsterKill(game, w, m); w.rift.kills++; };
  w.onPlayerDown = () => { game.toast('The rift spits you out… no reward.', '#ff8a8a'); w.leaveT = 1600; w.rift.failed = true; };
  game.outside = outside; game.world = w;
  game.toast(`SURVIVAL RIFT — survive ${RIFT.dur / 1000} seconds!`, '#ff6a6a');
}
function riftSpawn(w) {
  const p = w.player, Z = ZONES[w.rift.zone], M = w.map;
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, d = rand(80, 150);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.7;
    if (x < T || y < T * 2 || x > (M.w - 1) * T || y > (M.h - 1) * T || !mapReach(M, x, y) || w.blocked(x, y)) continue;
    const m = makeMonster(pick(Z.mobs.filter(id => D.monsters[id])), Math.min(9, rollRank(Z) + (Math.random() < 0.25 ? 1 : 0)), x, y);
    m.home = { x, y }; m.dir = dirTo(p.x - x, p.y - y); m.aggro = true;
    w.actors.push(m);
    for (let i = 0; i < 8; i++) w.particles.push({ x, y: y - 10, vx: rand(-40, 40), vy: rand(-60, -10), t: 0, life: 380, col: i % 2 ? '#ff3a5a' : '#2a0010', size: 2, puff: true });
    return;
  }
}
function updateRift(game, w, dt) {
  const p = w.player, Rf = w.rift;
  w.actors = w.actors.filter(a => !a.remove);
  if (Rf.tower) updateTower(game, w, dt);
  else if (Rf.evil) evilTick(game, w, dt);   // the Dark Court (evilgate.js)
  else if (Rf.raid) raidTick(game, w, dt);   // a raid (raids.js)
  else if (!Rf.failed) {
    Rf.t -= dt;
    Rf.spawnT -= dt;
    const alive = w.actors.filter(a => a.kind === 'monster' && !a.ally && !a.dead).length;
    if (Rf.spawnT <= 0) { Rf.spawnT = RIFT.every; for (let i = 0; i < RIFT.burst && alive + i < RIFT.maxMon; i++) riftSpawn(w); }
    if (Rf.t <= 0) { riftReward(game, w); exitRift(game); return; }
  }
  collectDrops(game, w, dt);
  updateProps(w, dt);
  if (w.leaveT != null) { w.leaveT -= dt; if (w.leaveT <= 0) exitRift(game); }
}
function riftReward(game, w) {
  const Z = ZONES[w.rift.zone], pr = game.profile;
  for (const d of w.drops) if (d.kind === 'card' || d.kind === 'gear' || d.kind === 'goods') game.pickup(d);   // nothing left behind
  w.drops = [];
  const card = makeCard(pick(Z.mobs.filter(id => D.monsters[id])), Math.min(9, Z.ranks[1] + 1));
  game.pickup({ kind: 'card', item: card });
  game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), Math.min(9, Z.ranks[1] + 1), pr.cls) });
  if (Math.random() < 0.3) pickCoin(game);
  game.gainExp(killExp(Z.ranks[1]) * (10 + w.rift.kills));
  questEvent(game, 'rift');
  game.toast(`RIFT SURVIVED! ${w.rift.kills} kills — rare card & gear claimed`, '#ffd23f');
}
function exitRift(game) {
  const w = game.world, out = game.outside, p = w.player;
  const party = w.actors.filter(a => a === p || (a.ally && a.owner === p));
  for (const a of party) { a.x = w.from.x + (a === p ? 0 : rand(-14, 14)); a.y = w.from.y + (a === p ? 0 : 8); a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); out.actors.push(a); }
  const fell = p.dead;
  if (p.dead || p.remove || p.alpha < 1) revivePlayer(out, p, p.dead ? 0.5 : p.hp / p.maxHp);
  p.invuln = 1500;
  out.player = p; game.world = out; game.outside = null;
  if (fell) { sendHome(out, p); game.toast(`You wake at home in ${typeof homePlace === 'function' ? homePlace(game.profile) : 'Hearthvale'}`, '#ffe9a8'); if (typeof wakeHint === 'function') wakeHint(game); }   // no checkpoints: a defeat sends you home
  out.flash = { t: 0, dur: 600, col: '#ffffff' };
}
// big countdown + kill counter at the top of the screen
function drawRiftOverlay(w, now) {
  const Rf = w.rift, secs = Math.max(0, Rf.t / 1000), low = secs < 5;
  const pulse = low ? 1 + 0.12 * Math.abs(Math.sin(now / 120)) : 1;
  ctx.save();
  ctx.fillStyle = 'rgba(30,0,8,0.7)'; rrect(ctx, VW / 2 - 70, 8, 140, 34, 8); ctx.fill();
  ctx.strokeStyle = '#ff3a5a'; ctx.lineWidth = 1; rrect(ctx, VW / 2 - 69.5, 8.5, 139, 33, 8); ctx.stroke();
  ctx.restore();
  text('SURVIVE', VW / 2, 16, '#ffb0b8', 7);
  text(Rf.failed ? '—' : secs.toFixed(1), VW / 2, 30, low ? '#ffffff' : '#ff5a6a', Math.round(15 * pulse));
  text(`${Rf.kills} kills`, VW / 2 + 62, 30, '#ffd0d4', 6.5, 'right');
  // red vignette that tightens as time runs out
  const k = 0.25 + 0.25 * (1 - secs / (RIFT.dur / 1000));
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85);
  vg.addColorStop(0, 'rgba(120,0,20,0)'); vg.addColorStop(1, `rgba(120,0,20,${k})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
}
