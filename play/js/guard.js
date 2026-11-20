'use strict';
// GUARD STAMINA AND THE SHIELD SKILLS (combat.js block, world.js drawGuard).
//   STAMINA   the bubble can't be held forever: holding it drains a meter, a soaked blow costs more and a deflected spell more
//             again, while a perfect parry gives some back. At zero the guard BREAKS: you reel for a moment and can't raise it
//             again until the meter is back to 40%. It refills once you have lowered it for a moment. A thin bar under the hero
//             shows it whenever it isn't full.
//   SKILLS    three Layer skills (layers.js LAYER_SKILLS, bought per element with that Layer's XP on the LAYER page):
//             WIDE PARRY    a longer perfect-parry window
//             IRON BUBBLE   more stamina, refilling faster
//             SHIELD BURST  let go of a fully grown bubble and it bursts outward: a blast round you in your Layer's element
const GUARDX = { st: 100, per: 25, hold: 10, melee: 12, spell: 16, parry: 10, regen: 35, regenPer: 0.2, delay: 600, stun: 900, back: 0.4, parryMs: 60,
  burst: { hold: 600, cd: 4000, cost: 20, r: 52, mul: [0, 1, 1.4, 1.8], push: 130 } };
const guardMax = a => GUARDX.st + GUARDX.per * lsk(a, 'iron');
const guardPerfect = a => GUARD.perfect + GUARDX.parryMs * lsk(a, 'wideParry');
// every frame for a hero (combat.js updateActor)
function guardTick(world, a, dt) {
  const max = guardMax(a); if (a.gst == null) a.gst = max;
  if (a.burstCd > 0) a.burstCd -= dt;
  if (a.bashCd > 0) a.bashCd -= dt;
  if (a.counterT > 0) a.counterT -= dt;
  if (a.state === 'block') { a.gRest = 0; guardSpend(world, a, GUARDX.hold * dt / 1000); }
  else if ((a.gRest = (a.gRest || 0) + dt) > GUARDX.delay) a.gst = Math.min(max, a.gst + GUARDX.regen * (1 + GUARDX.regenPer * lsk(a, 'iron')) * dt / 1000);
  if (a.gBroken && a.gst >= max * GUARDX.back) a.gBroken = false;
  a.gstPct = Math.round(100 * a.gst / max);   // (what a co-op friend's screen draws: net.js)
}
// a cost to the guard (a negative one gives back); at zero it breaks
function guardSpend(world, a, n) {
  a.gst = Math.min(guardMax(a), (a.gst == null ? guardMax(a) : a.gst) - n);
  if (a.gst > 0 || a.state !== 'block') return;
  a.gst = 0; a.gBroken = true; a.state = 'hurt'; a.stun = GUARDX.stun; setAnim(a, 'hurt');
  floatText(world, a.x, a.y - 46, 'GUARD BREAK', '#ff9a6a', 10); guardSound('guardBreak'); guardTip(world, a, 'gbreak');
  world.rings.push({ x: a.x, y: a.y - 13, r: 24, t: 0, col: '#ff9a6a' }); world.shake = Math.max(world.shake || 0, 2);
}
// the guard was lowered (combat.js block): a full bubble with SHIELD BURST learnt bursts outward
function guardRelease(world, a) {
  const l = lsk(a, 'sburst'), B = GUARDX.burst; if (!l || a.blockT < B.hold || a.burstCd > 0 || a.gst < B.cost) return;
  a.gst -= B.cost; a.burstCd = B.cd;
  const el = a.layerEl || layerElementOf(a), L = LAYER_ELS[el] || LAYER_ELS.holy;
  strike(world, a, a.x, a.y, B.r, 0, { base: a.atk * B.mul[l], el: L.dmg, spell: true, pop: 100, push: B.push });
  world.rings.push({ x: a.x, y: a.y - 13, r: B.r, t: 0, col: L.bloom }, { x: a.x, y: a.y - 13, r: B.r * 0.6, t: -80, col: '#ffffff' });
  for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2; world.particles.push({ x: a.x, y: a.y - 13, vx: Math.cos(an) * 160, vy: Math.sin(an) * 110, t: 0, life: 420, col: i % 2 ? L.bloom : L.inner, size: 2, streak: true, drag: 0.9 }); }
  floatText(world, a.x, a.y - 48, 'SHIELD BURST', L.mote, 9); guardSound('burst'); world.shake = Math.max(world.shake || 0, 3);
}
// a guard sound (sfx.js), and a first-time tip (tips.js) when it happens to you
const guardSound = k => { if (typeof SFX !== 'undefined' && SFX[k]) SFX[k](); };
function guardTip(world, a, id) { if (window.GAME && GAME.world === world && a === world.player && typeof tipEvent === 'function') tipEvent(GAME, id); }
// SHIELD BASH: press attack while guarding and you shove forward behind the bubble, a short heavy blow in your Layer's colour
// that knocks foes back. It costs guard stamina and keeps your guard up; against a monster's shield (foeguard.js) it counts
// as a heavy blow.
const GBASH = { after: 120, cost: 18, cd: 900, mul: 0.7, reach: 18, r: 20, lunge: 8, push: 170, pop: 110 };
function guardBash(world, a) {
  const B = GBASH; if (a.blockT < B.after || a.bashCd > 0 || (a.gst ?? guardMax(a)) < B.cost) return false;
  a.gst = (a.gst ?? guardMax(a)) - B.cost; a.bashCd = B.cd; a.blockFlash = 160;
  const [dx, dy] = DV[a.dir], L = heroLayer(a) || LAYER_ELS.holy;
  moveBy(world, a, dx * B.lunge, dy * B.lunge);
  strike(world, a, a.x + dx * B.reach, a.y + dy * B.reach, B.r, 0, { base: a.atk * B.mul, melee: true, bash: true, push: B.push, pop: B.pop });
  world.rings.push({ x: a.x + dx * B.reach, y: a.y - 12 + dy * B.reach * 0.6, r: 16, t: 0, col: L.bloom });
  for (let i = 0; i < 8; i++) { const an = Math.atan2(dy, dx) + (i / 7 - 0.5) * 1.6; world.particles.push({ x: a.x + dx * 12, y: a.y - 12 + dy * 8, vx: Math.cos(an) * 150, vy: Math.sin(an) * 100, t: 0, life: 260, col: i % 2 ? L.bloom : L.inner, size: 2, streak: true, drag: 0.88 }); }
  world.shake = Math.max(world.shake || 0, 1.5);
  guardSound('swing'); guardSound('block');
  return true;
}
// PERFECT DODGE: a blow that arrives in the first moment of a dash (while it is still fresh) is a perfect dodge. Time slows a
// beat, the hero flashes in their Layer's colour, the dash is ready again at once, and for a moment after it the next hit is a
// COUNTER for more damage. Once per dash.
const GDODGE = { window: 100, counter: 1200, mul: 1.6, stop: 90 };
function perfectDodge(world, a, att) {
  a.pdodge = true; a.dashCd = 0; a.counterT = GDODGE.counter;
  const L = heroLayer(a) || LAYER_ELS.holy;
  floatText(world, a.x, a.y - 50, 'PERFECT DODGE', L.mote, 10);
  world.rings.push({ x: a.x, y: a.y - 12, r: 26, t: 0, col: L.bloom }, { x: a.x, y: a.y - 12, r: 14, t: -60, col: '#ffffff' });
  for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2; world.particles.push({ x: a.x, y: a.y - 12, vx: Math.cos(an) * 90, vy: Math.sin(an) * 60, t: 0, life: 380, col: i % 2 ? L.bloom : L.inner, size: 2, drag: 0.9 }); }
  world.hitStop = Math.max(world.hitStop || 0, GDODGE.stop);
  guardSound('parry');
  if (window.GAME && GAME.world === world) {
    if (a === world.player) { bumpStat('perfectDodges'); guardTip(world, a, 'pdodge'); }
    else if (a.netGid && typeof netStatTo === 'function') netStatTo(GAME, a.netGid, 'perfectDodges');
  }
}
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    if (att && att !== def && opts && !opts.reflected) {
      const foe = att.kind === 'monster' ? !att.ally : att.kind === 'player' && att.team !== def.team;
      // a fresh dash (its i-frames still nearly full) and a real foe's blow: PERFECT DODGE (the dash's i-frames still stop the blow)
      if (foe && def.kind === 'player' && def.state === 'dashing' && !def.pdodge && !def.dead && def.invuln > DASH.iframes - GDODGE.window && def.invuln <= DASH.iframes) perfectDodge(world, def, att);
      // the counter: the hero's next hit after a perfect dodge
      if (att.counterT > 0 && att.kind === 'player' && !def.dead && !(def.invuln > 0) && !def.ally && def.team !== att.team && opts.base) {
        att.counterT = 0; opts = { ...opts, base: opts.base * GDODGE.mul };
        floatText(world, def.x, def.y - 48, 'COUNTER!', (heroLayer(att) || LAYER_ELS.holy).mote, 10);
      }
    }
    return dd(world, att, def, opts);
  };
}
// the counter window, on the hero (world.js): a ring pulsing at their feet and COUNTER blinking over their head, in their Layer's colour
function drawCounterCue(a, y, now) {
  if (!(a.counterT > 0) || a.dead) return;
  const L = heroLayer(a) || LAYER_ELS.holy, k = Math.min(1, a.counterT / GDODGE.counter), pl = 0.55 + 0.45 * Math.sin(now / 70);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.4 * pl;
  ctx.strokeStyle = L.bloom; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(a.x, a.y, 10 + 4 * (1 - k), 4 + 1.5 * (1 - k), 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  text('COUNTER', a.x, y - 52, L.mote, 7);
}
// UNTOUCHABLE: a title for 200 perfect dodges (titles.js)
{ const t = { id: 'untouchable', name: 'Untouchable', tier: 2, how: 'Land 200 perfect dodges', prog: pr => [titleStat(pr, 'perfectDodges'), 200] };
  TITLE_LIST.push(t); TITLE_BY[t.id] = t; TITLE_PASSIVES[t.id] = ['evade', 'swift', 'crit']; }
// the thin stamina bar under the hero (world.js), whenever it isn't full
function drawGuardBar(a, y) {
  const k = a.gstPct != null ? a.gstPct / 100 : 1; if (k >= 1 || a.dead) return;
  const w = 20, x = Math.round(a.x - w / 2), by = Math.round(y + 4);
  ctx.fillStyle = 'rgba(8,10,20,0.75)'; ctx.fillRect(x - 1, by - 1, w + 2, 4);
  ctx.fillStyle = a.gBroken ? '#ff7a5a' : (LAYER_ELS[a.layerEl || (typeof layerElementOf === 'function' ? layerElementOf(a) : 'holy')] || LAYER_ELS.holy).bloom; ctx.fillRect(x, by, Math.round(w * k), 2);
}
// GUARD CRUSHERS: every boss now and then winds up a heavy blow, a red ring flaring under it for most of a second ("!!"), that
// crashes through a raised guard: it drains most of the meter and only half of it is soaked. A PERFECT PARRY still turns it
// back, and stepping out of the ring dodges it; blocking alone is not always the answer.
const GCRUSH = { every: [7000, 11000], reach: 70, wind: 900, r: 46, mul: 2.2, drain: 60, soak: 0.5 };
function guardCrushTick(world, a, dt) {   // (combat.js updateActor, for a boss)
  if (a.dead || a.ally || world.peaceful) return;
  if (a.crushWind > 0) {
    a.crushWind -= dt; a.vx *= 0.5; a.vy *= 0.5;   // (planted while it winds up)
    if (a.crushWind <= 0) {
      a.crushWind = 0;
      strike(world, a, a.x, a.y, GCRUSH.r, 0, { base: a.atk * GCRUSH.mul, melee: true, crush: true, pop: 150, push: 90 });
      world.rings.push({ x: a.x, y: a.y, r: GCRUSH.r, t: 0, col: '#ff4a3a' }, { x: a.x, y: a.y, r: GCRUSH.r * 0.6, t: -60, col: '#ffd0a0' }); world.shake = Math.max(world.shake || 0, 4); guardSound('crush');
    }
    return;
  }
  if (a.crushT == null) a.crushT = rand(GCRUSH.every[0], GCRUSH.every[1]);
  if ((a.crushT -= dt) > 0 || a.state !== 'free') return;
  const foe = enemiesOf(world, a).find(o => o.kind === 'player' && !o.dead && Math.hypot(o.x - a.x, o.y - a.y) < GCRUSH.reach); if (!foe) return;
  a.crushT = rand(GCRUSH.every[0], GCRUSH.every[1]); a.crushWind = GCRUSH.wind;
  floatText(world, a.x, a.y - (a.h || 26) * (a.scale || 1) - 12, 'GUARD CRUSHER!', '#ff5a4a', 9); guardSound('crushWarn');
  if (world.player && Math.hypot(world.player.x - a.x, world.player.y - a.y) < GCRUSH.reach * 2) guardTip(world, world.player, 'crusher');
}
// the warning under a boss winding up (world.js, monsters): a red ring filling in, and "!!" over its head
function drawCrushWarn(a, y, now) {
  const k = 1 - Math.max(0, a.crushWind) / GCRUSH.wind, R = GCRUSH.r, pl = 0.6 + 0.4 * Math.sin(now / 60);
  ctx.save();
  ctx.fillStyle = `rgba(255,40,30,${0.12 + 0.25 * k})`; ctx.beginPath(); ctx.ellipse(a.x, a.y, R * k, R * 0.45 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(255,70,50,${pl})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(a.x, a.y, R, R * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  text('!!', a.x, y - (a.h || 26) * (a.scale || 1) - 22, `rgba(255,${90 + 80 * pl},70,1)`, 12);
}
// POISE: a hero can't be stun-locked by a crowd. Three flinches from monsters within 1.2 s and the next second shrugs flinches
// off and ends the flinch you are in (the damage still lands; launches and knockdowns still happen). Player-against-player combos are left as they were.
const POISE = { hits: 3, within: 1200, armour: 1500, rest: 1200 };   // (rest: after it, a while when flinches count again before poise can return)
function guardPoise(world, a, att) {   // (combat.js react: true = no flinch this time)
  if (a.kind !== 'player' || !att || att.kind !== 'monster' || att.ally) return false;
  const now = performance.now(); if (a.poiseUntil > now) return true;
  if (a.poiseUntil && now < a.poiseUntil + POISE.rest) return false;
  a.hurtAt = (a.hurtAt || []).filter(t => now - t < POISE.within); a.hurtAt.push(now);
  if (a.hurtAt.length < POISE.hits) return false;
  a.hurtAt = []; a.poiseUntil = now + POISE.armour; floatText(world, a.x, a.y - 50, 'STEADY', '#cfe4ff', 8); guardSound('steady');
  if (a.state === 'hurt') a.stun = 0;   // (out of the flinch at once: a moment to act)
  return true;
}
