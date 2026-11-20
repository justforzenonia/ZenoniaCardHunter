'use strict';
// TRAINING (in place of the old two-player Versus): you in the coliseum against a straw training dummy that cannot be
// beaten. Its health refills the moment a blow lands, it never moves or fights back, and it rocks when it is struck.
// A board in the corner keeps score: total damage, the biggest hit, the last hit and damage per second over the last
// five seconds. Esc goes back to the hub.
const TRAIN = { window: 5000, hp: 999999, lv: 1 };
// DRILLS (Y, or a click on the board, picks one): the dummy can also practise the newer fights with you.
//   SHIELD  it keeps a shield up toward you (foeguard.js): flank it, or wear the guard down to a GUARD BROKEN; the board counts breaks
//   CHARGE  every few seconds it charges you down a red lane (foecharge.js): dash into it as it lands for a PERFECT DODGE (guard.js);
//           its blow is a feather's, and the board counts your perfect dodges
//   PARRY   every couple of seconds it throws a slow bolt at you, a "!" first: hold block to deflect it, or block just as it lands
//           for a PERFECT PARRY that sends it back at the dummy; the board counts your parries
const DRILLS = [{ id: 'free', name: 'FREE HITS' }, { id: 'shield', name: 'SHIELD' }, { id: 'charge', name: 'CHARGE' }, { id: 'parry', name: 'PARRY' }];
const DRILL = { boltEvery: 2200, boltWarn: 450, boltSpeed: 120, turn: 700, chargeEvery: 2600, wind: 650, dash: 300, over: 30, back: 260 };
function makeTrainingArena(game) {
  const w = makeArena(game, game.profile, game.profile, false);
  const old = w.p2; w.actors = w.actors.filter(a => a !== old && a.owner !== old);
  const at = ARENA_START[1], d = makeMonster('016', 0, at.x, at.y);
  Object.assign(d, { dummy: true, lv: TRAIN.lv, label: `Training Dummy Lv ${TRAIN.lv}`, heavy: true, scale: 1, home: { x: at.x, y: at.y }, dir: 3, drawSelf: drawTrainingDummy, h: 34 });
  d.maxHp = d.hp = TRAIN.hp; d.atk = 0; d.def = 0;
  d.passives = {}; d.plist = []; d.shield = 0;   // (no passives: the monster it is built from has BARRIER, a 60,000 shield off its huge HP that soaked every blow and kept the board at 0)
  w.actors.push(d); w.p2 = d; w.cpu = false;
  w.train = { total: 0, best: 0, last: 0, hits: [], t0: 0, drill: 0, breaks: 0, dodges: 0, chargeT: DRILL.chargeEvery };
  return w;
}
// a blow on the dummy: counted, and its health is full again (combat.js dealDamage)
function dummyHit(world, def, dmg) {
  def.hp = def.maxHp; def.wob = 420;
  const T0 = world.train; if (!T0) return;
  const now = performance.now(); T0.total += dmg; T0.last = dmg; T0.best = Math.max(T0.best, dmg); T0.hits.push([now, dmg]);
}
// each frame: the dummy stays planted on its spot and comes straight back up
function trainingTick(w, dt) {
  const d = w.p2; if (!d || !d.dummy) return;
  const T0 = w.train, p = w.player;
  if (T0 && (hit('KeyY') || T0.pick)) { T0.pick = false; T0.drill = (T0.drill + 1) % DRILLS.length; d.fgUp = 0; d.fgBroken = 0; d.fcCharge = null; d.fcBack = false; T0.chargeT = DRILL.chargeEvery; T0.boltT = DRILL.boltEvery; T0.parry0 = titleStat(GAME.profile, 'parries'); }
  const drill = T0 ? DRILLS[T0.drill].id : 'free';
  if (drill === 'charge' && drillCharge(w, d, p, dt)) { d.hp = d.maxHp; d.wob = Math.max(0, (d.wob || 0) - dt); return; }   // (off its spot while it charges)
  d.x = d.home.x; d.y = d.home.y; d.z = 0; d.vx = d.vy = 0; d.hp = d.maxHp; d.dead = false;
  if (d.state !== 'free') { d.state = 'free'; d.stun = 0; }
  d.wob = Math.max(0, (d.wob || 0) - dt);
  if (drill === 'parry') {   // a slow bolt at you every couple of seconds; your parries are counted from your own parry stat
    const was = T0.boltT; T0.boltT = (T0.boltT ?? DRILL.boltEvery) - dt;
    if (was > DRILL.boltWarn && T0.boltT <= DRILL.boltWarn) floatText(w, d.x, d.y - 56, '!', '#9fd8ff', 12);
    if (T0.boltT <= 0) {
      T0.boltT = DRILL.boltEvery; const a = Math.atan2(p.y - d.y, p.x - d.x);
      w.projs.push({ owner: d, team: d.team, x: d.x + Math.cos(a) * 12, y: d.y, z: 14, vx: Math.cos(a) * DRILL.boltSpeed, vy: Math.sin(a) * DRILL.boltSpeed,
        life: 2600, r: 8, opts: { base: 1, spell: true, el: 'lightning', push: 20 }, hit: new Set(), sp: null, el: 'lightning', t: 0, pierce: false, orb: true });
    }
    T0.parries = titleStat(GAME.profile, 'parries') - (T0.parry0 || 0);
  }
  if (drill === 'shield') {   // the shield faces you; once broken it is back up after a moment, whole
    if ((d.fgTurnT = (d.fgTurnT || 0) - dt) <= 0) { d.fgTurnT = DRILL.turn; d.dir = dirTo(p.x - d.x, p.y - d.y); }   // (it turns to you only now and then: a quick dash round it finds the open side)
    if (d.fgBroken > 0) { if (!d.fgCounted) { d.fgCounted = true; T0.breaks++; } d.fgBroken -= dt; }   // (broken: counted once, back up when it wears off)
    else { d.fgCounted = false; if (!(d.fgUp > 0)) d.fgSt = FOEGUARD.st; d.fgUp = 1000; }
  }
}
// the CHARGE drill: wind up behind a lane, lunge through where you stood, then walk back to its spot. True = it is off its spot.
function drillCharge(w, d, p, dt) {
  const C = d.fcCharge, T0 = w.train;
  if (d.fcBack) {   // walking home
    const dx = d.home.x - d.x, dy = d.home.y - d.y, n = Math.hypot(dx, dy);
    if (n < 3) { d.fcBack = false; return false; }
    const s = Math.min(n, DRILL.back * dt / 1000); d.x += dx / n * s; d.y += dy / n * s; return true;
  }
  if (C) {
    C.t -= dt;
    if (C.wind) { d.dir = dirTo(C.dx, C.dy); if (C.t <= 0) { C.wind = false; C.t = DRILL.dash; } return false; }
    const step = C.len / DRILL.dash * dt; d.x += C.dx * step; d.y += C.dy * step;
    if (!C.hit && !p.dead && Math.hypot(p.x - d.x, (p.y - d.y) * 1.4) < FCHARGE.w + 6) {
      C.hit = true; const pd = p.pdodge;
      dealDamage(w, d, p, { base: 1, melee: true, push: 150, pop: 120, charge: true });
      if (p.pdodge && !pd) T0.dodges++;
    }
    if (C.t <= 0) { d.fcCharge = null; d.fcBack = true; T0.chargeT = DRILL.chargeEvery; }
    return true;
  }
  if ((T0.chargeT -= dt) > 0) return false;
  const dx = p.x - d.home.x, dy = p.y - d.home.y, n = Math.hypot(dx, dy) || 1;
  d.fcCharge = { wind: true, t: DRILL.wind, dx: dx / n, dy: dy / n, len: n + DRILL.over };
  floatText(w, d.x, d.y - 54, '!', '#ff6a4a', 12);
  return false;
}
// a pixel straw dummy: a post in the sand, a crossbar for arms, a straw-wrapped body tied with rope, a stitched sack head,
// and a red target on its chest; it rocks back when struck
function drawTrainingDummy(a, now) {
  const k = (a.wob || 0) / 420, rock = Math.sin(now / 45) * k * 0.22;
  ctx.save(); ctx.translate(Math.round(a.x), Math.round(a.y)); ctx.rotate(rock); ctx.imageSmoothingEnabled = false;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  R(-2, -14, 4, 14, '#6a4224'); R(-2, -14, 1, 14, '#8a5a32');                         // the post
  R(-14, -27, 28, 3, '#6a4224'); R(-14, -27, 28, 1, '#8a5a32');                       // the crossbar
  R(-16, -28, 4, 6, '#d8b060'); R(12, -28, 4, 6, '#d8b060');                           // straw tufts at its hands
  R(-8, -32, 16, 20, '#c89848'); R(-8, -32, 2, 20, '#e0b860'); R(6, -32, 2, 20, '#a07830');   // the straw body
  for (const y of [-29, -23, -17]) R(-8, y, 16, 1, '#a07830');
  R(-8, -20, 16, 2, '#7a4a20');                                                        // rope round the middle
  R(-4, -28, 8, 8, '#f4ecd8'); R(-3, -27, 6, 6, '#d83a3a'); R(-2, -26, 4, 4, '#f4ecd8'); R(-1, -25, 2, 2, '#d83a3a');   // the target
  R(-6, -42, 12, 10, '#d8c8a0'); R(-6, -42, 12, 2, '#e8dcc0'); R(5, -41, 1, 9, '#b0a080');   // the sack head
  R(-3, -38, 2, 2, '#3a2410'); R(2, -38, 2, 2, '#3a2410'); R(-3, -35, 7, 1, '#3a2410');      // stitched face
  R(-7, -32, 14, 2, '#7a4a20');                                                        // tied at the neck
  ctx.restore();
  text(a.label, Math.round(a.x), Math.round(a.y) - 50, '#ffe9a8', 6.5);
  if (a.fgUp > 0 && typeof drawFoeGuard === 'function') drawFoeGuard(a, a.y - 8, now);   // the SHIELD drill's shield   // its name and level over its head
}
// the score board, in place of the second fighter's HUD
function drawTrainingPanel(w, now) {
  const T0 = w.train; if (!T0) return;
  T0.hits = T0.hits.filter(h => now - h[0] < TRAIN.window);
  const dps = T0.hits.length ? T0.hits.reduce((s, h) => s + h[1], 0) / (TRAIN.window / 1000) : 0;
  const x = VW - 172, y = 8, W = 164, H = 88, drill = DRILLS[T0.drill || 0];
  if (clicked(x, y, W, H)) T0.pick = true;
  ctx.fillStyle = 'rgba(10,6,18,0.82)'; rrect(ctx, x, y, W, H, 6); ctx.fill(); ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
  goldText(`TRAINING DUMMY · LV ${TRAIN.lv}`, x + W / 2, y + 10, 8.5, { spacing: 1 });
  const row = (lab, val, yy, col) => { text(lab, x + 10, yy, '#a8a0b8', 7, 'left'); text(val, x + W - 10, yy, col, 8, 'right'); };
  row('Damage per second', String(Math.round(dps)), y + 24, '#ffd23f');
  row('Last hit', String(T0.last), y + 35, '#ffffff');
  row('Biggest hit', String(T0.best), y + 46, '#ff9a7a');
  row('Total', String(T0.total), y + 57, '#8fffd0');
  row(`Drill: ${drill.name}`, drill.id === 'shield' ? `${T0.breaks} breaks` : drill.id === 'charge' ? `${T0.dodges} perfect` : drill.id === 'parry' ? `${T0.parries || 0} parries` : drill.id === 'react' ? `${T0.reacts || 0} reactions` : drill.id === 'chains' ? `${T0.chainsDone || 0} finishes` : '—', y + 70, '#9fd8ff');
  text('Y or click: next drill', x + W / 2, y + 81, 'rgba(255,233,168,0.6)', 6);
  text(GAME.tryBack ? 'Esc: back to where you were' : 'Esc: back to the hub', VW / 2, VH - 6, 'rgba(255,255,255,0.8)', 7);   // (tryBack: trying an Arcana from the book, arcanabook.js)
}
