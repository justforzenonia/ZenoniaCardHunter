'use strict';
// SHIELDED FOES: the other side of the guard (guard.js). Now and then a monster in the Wilds carries a shield. When a hero
// comes at it, it plants its feet and raises the shield, facing them: blows from the FRONT only chip it (a quarter of the damage),
// and each one wears its guard down. Ways through:
//   FLANK IT       the shield only covers the way it faces: a hit from the side or behind lands in full
//   HEAVY BLOWS    a combo finisher (the launcher) and spells wear the guard down much faster
//   BREAK IT       at zero the shield cracks: the monster reels for a moment and takes half again as much damage
//   BREAK RUSH     ...and for 2.5 s it is pinned: every hit lands without knocking it away and keeps it reeling, each one
//                  harder than the last (a RUSH counter climbs), and a combo finisher after a few hits SHATTERS it for a big finish
// It lowers the shield after a moment (it can't fight with it up) and raises it again after a rest. A co-op friend sees the
// shield too (net.js sends it with each monster).
const FOEGUARD = { chance: 0.15, minTier: 1, st: 100, reach: 70, up: [1200, 2200], rest: [2500, 4500], slow: 0.35,
  chip: 0.25, front: 0.35, drain: { melee: 18, heavy: 45, spell: 32 }, regen: 30, stun: 1500, broken: 2500, bonus: 1.5 };
const FG_FACE = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // (dir: up, right, down, left)
const RUSH = { ms: 2500, per: 0.12, max: 1.2, finAfter: 2, shatter: 1.8 };   // (each rush hit +12%, to +120%; a finisher after 2 rush hits shatters)
const rushOn = a => a.rushUntil > performance.now();
// does this monster carry a shield? (decided once, the first time it thinks)
function foeGuardRoll(world, m) {
  if (m.fgRoll !== undefined) return m.fgRoll;
  const ok = m.kind === 'monster' && !m.boss && !m.ally && !m.pet && !m.dummy && !m.hunter && !m.animalBody && !m.netOf && (m.tier || 0) >= FOEGUARD.minTier && !world.dojoRoom && !world.peaceful;
  m.fgRoll = ok && Math.random() < FOEGUARD.chance;
  if (m.fgRoll) m.fgSt = FOEGUARD.st;
  return m.fgRoll;
}
// its thinking (combat.js monsterAI): raise the shield at a hero who comes close, hold it a while, then fight again
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    if (!foeGuardRoll(world, m)) return ai(world, m, dt);
    if (m.fgBroken > 0) m.fgBroken -= dt;
    if (m.fgCd > 0) m.fgCd -= dt;
    if (!(m.fgUp > 0)) m.fgSt = Math.min(FOEGUARD.st, (m.fgSt || 0) + FOEGUARD.regen * dt / 1000);
    if (m.fgUp > 0) {
      m.fgUp -= dt;
      const foe = nearestEnemy(world, m, FOEGUARD.reach * 2);
      if (m.fgUp <= 0 || !foe || m.state !== 'free') { m.fgUp = 0; m.fgCd = rand(FOEGUARD.rest[0], FOEGUARD.rest[1]); return ai(world, m, dt); }
      const dx = foe.x - m.x, dy = foe.y - m.y, n = Math.hypot(dx, dy) || 1, sp = speedOf(m) * FOEGUARD.slow * dt / 1000;
      m.dir = dirTo(dx, dy); if (n > 22) moveBy(world, m, dx / n * sp, dy / n * sp);   // (edging in behind the shield)
      setAnim(m, n > 22 ? 'walk' : 'idle', true);
      return;
    }
    if (m.state === 'free' && !(m.fgCd > 0) && !(m.fgBroken > 0) && m.fgSt >= FOEGUARD.st * 0.5) {
      const foe = nearestEnemy(world, m, FOEGUARD.reach);
      if (foe && foe.kind === 'player') {
        m.fgUp = rand(FOEGUARD.up[0], FOEGUARD.up[1]); m.dir = dirTo(foe.x - m.x, foe.y - m.y); m.vx = m.vy = 0;
        if (window.GAME && GAME.world === world && foe === world.player && typeof tipEvent === 'function') tipEvent(GAME, 'foeguard');
        return;
      }
    }
    return ai(world, m, dt);
  };
}
// a blow on a shielded monster (combat.js dealDamage): the shield takes a blow from the front; a broken guard takes more
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    if (rushOn(def) && att && att !== def && !def.dead && opts && opts.base && !opts.reflected) return foeRushHit(world, att, def, opts, dd);
    if (def.fgBroken > 0 && att && att !== def && opts && opts.base) opts = { ...opts, base: opts.base * FOEGUARD.bonus };
    if (def.fgUp > 0 && att && att !== def && !def.dead && !def.ward && !(def.invuln > 0) && def.state !== 'down' && opts && !opts.reflected && foeGuardHit(world, att, def, opts)) return true;   // (a ward or i-frames: the game's own rules first)
    return dd(world, att, def, opts);
  };
}
// a hit in the BREAK RUSH: pinned (no knock-away), harder with every hit, and a finisher after a few SHATTERS it
function foeRushHit(world, att, def, opts, dd) {
  const n = def.rush = (def.rush || 0) + 1, fin = opts.launch > 0 && n > RUSH.finAfter;
  let mul = FOEGUARD.bonus * (1 + Math.min(RUSH.max, (n - 1) * RUSH.per));
  const L = att.kind === 'player' && typeof heroLayer === 'function' ? heroLayer(att) : null, col = L ? L.bloom : '#ffb36a';
  if (fin) {   // SHATTER: the big finish keeps its launch, and the rush is over
    mul *= RUSH.shatter; def.rushUntil = 0;
    floatText(world, def.x, def.y - (def.h || 26) * (def.scale || 1) - 14, 'SHATTER!', L ? L.mote : '#ffd27a', 12);
    world.rings.push({ x: def.x, y: def.y - 12, r: 34, t: 0, col }, { x: def.x, y: def.y - 12, r: 20, t: -70, col: '#ffffff' });
    for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2; world.particles.push({ x: def.x, y: def.y - 12, vx: Math.cos(an) * 170, vy: Math.sin(an) * 120, t: 0, life: 460, col: i % 2 ? col : '#ffffff', size: 2.5, streak: true, drag: 0.9 }); }
    world.hitStop = Math.max(world.hitStop, 140); world.shake = Math.max(world.shake || 0, 5);
    if (typeof SFX !== 'undefined') SFX.crush();
    return dd(world, att, def, { ...opts, base: opts.base * mul });
  }
  const r = dd(world, att, def, { ...opts, base: opts.base * mul, push: 0, launch: 0, pop: Math.min(opts.pop || 0, 60) });
  if (!def.dead && rushOn(def)) { def.state = 'hurt'; def.stun = Math.max(def.stun || 0, def.rushUntil - performance.now()); def.vx = def.vy = 0; if (def.anim !== 'hurt') setAnim(def, 'hurt'); }   // (held in the rush)
  return r;
}
function foeGuardHit(world, att, def, opts) {
  const tx = att.x - def.x, ty = att.y - def.y, tl = Math.hypot(tx, ty) || 1, f = FG_FACE[def.dir] || FG_FACE[2];
  if ((tx * f[0] + ty * f[1]) / tl < FOEGUARD.front) return false;   // from the side or behind: the shield doesn't cover it
  const dmg = Math.max(1, Math.round(opts.base * FOEGUARD.chip * 100 / (100 + (def.def || 0) * 4)));
  if (dmg >= def.hp) return false;   // (a blow that would finish it goes through)
  def.hp -= dmg; if (def.dummy && typeof dummyHit === 'function') dummyHit(world, def, dmg);   // (the training board counts it: training.js)
  const hx = def.x + f[0] * 10, hy = def.y - 12 + f[1] * 6;
  def.fgSt -= opts.spell ? FOEGUARD.drain.spell : opts.launch > 0 || opts.bash ? FOEGUARD.drain.heavy : FOEGUARD.drain.melee;
  def.fgFlash = 140; def.vx = -tx / tl * 30; def.vy = -ty / tl * 30;
  if (def.fgSt <= 0) {   // GUARD BROKEN: it reels, and takes more until it recovers
    def.fgSt = 0; def.fgUp = 0; def.fgBroken = FOEGUARD.broken; def.fgCd = FOEGUARD.broken + rand(FOEGUARD.rest[0], FOEGUARD.rest[1]);
    def.state = 'hurt'; def.stun = Math.max(FOEGUARD.stun, RUSH.ms); setAnim(def, 'hurt'); def.rush = 0; def.rushUntil = performance.now() + RUSH.ms;   // (the BREAK RUSH opens)
    floatText(world, def.x, def.y - (def.h || 26) * (def.scale || 1) - 10, 'GUARD BROKEN! · RUSH!', '#ffb36a', 10);
    world.rings.push({ x: def.x, y: def.y - 12, r: 22, t: 0, col: '#ffb36a' }); impactBurst(world, hx, hy, '#ffd8a0', 12, tx || 1, ty);
    world.hitStop = Math.max(world.hitStop, 110); world.shake = Math.max(world.shake || 0, 3);
    if (typeof SFX !== 'undefined') SFX.guardBreak();
    foeGuardCredit(world, att);
    return true;
  }
  floatText(world, def.x, def.y - 34, `${dmg} GUARDED`, '#b8c8d8', 8);
  impactBurst(world, hx, hy, '#d8e4f0', 6, tx || 1, ty);
  world.hitStop = Math.max(world.hitStop, 40);
  if (typeof SFX !== 'undefined') SFX.block();
  return true;
}
// BOSS BREAK: a boss's GUARD CRUSHER (guard.js) turned back with a PERFECT PARRY opens a shorter BREAK RUSH on the boss itself
const BOSS_RUSH = { ms: 2000 };
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const parry = opts && opts.crush && att && att.boss && def && def.kind === 'player' && def.state === 'block' && def.blockT < guardPerfect(def);   // (the same window combat.js parries in)
    const r = dd(world, att, def, opts);
    if (parry && !att.dead) {
      att.rush = 0; att.rushUntil = performance.now() + BOSS_RUSH.ms; att.crushWind = 0; att.state = 'hurt'; att.stun = Math.max(att.stun || 0, BOSS_RUSH.ms); setAnim(att, 'hurt');
      floatText(world, att.x, att.y - (att.h || 26) * (att.scale || 1) - 18, 'CRUSHER BROKEN · RUSH!', '#ffb36a', 11);
      world.rings.push({ x: att.x, y: att.y - 12, r: 40, t: 0, col: '#ffb36a' }); world.hitStop = Math.max(world.hitStop, 160); world.shake = Math.max(world.shake || 0, 4);
      if (typeof SFX !== 'undefined') SFX.guardBreak();
    }
    return r;
  };
}
// SHIELDBREAKER: a title for breaking 150 guards (titles.js). Each break counts for the hero who landed it, a co-op friend too
const FG_TITLE = { id: 'shieldbreaker', name: 'Shieldbreaker', tier: 2, how: 'Break 150 monster guards', need: 150, pas: ['brutal', 'crit', 'unstop'] };
{ const T = FG_TITLE, t = { id: T.id, name: T.name, tier: T.tier, how: T.how, prog: pr => [titleStat(pr, 'guardBreaks'), T.need] };
  TITLE_LIST.push(t); TITLE_BY[T.id] = t; TITLE_PASSIVES[T.id] = T.pas; }
function foeGuardCredit(world, att) {
  if (!window.GAME || GAME.world !== world || !att) return;
  if (att === world.player) bumpStat('guardBreaks');
  else if (att.netGid && typeof netStatTo === 'function') netStatTo(GAME, att.netGid, 'guardBreaks');
}
// the BREAK RUSH on screen (world.js, monsters): a ring closing in under the monster as the window runs out, in a hot gold
function drawFoeRush(a, y, now) {
  const left = Math.max(0, a.rushUntil - performance.now()), k = left / RUSH.ms, pl = 0.6 + 0.4 * Math.sin(now / 50), s = a.scale || 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,${150 + 60 * pl},70,${0.5 + 0.4 * pl})`; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(a.x, a.y, (10 + 14 * k) * s, (4 + 6 * k) * s, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  const bx = Math.round(a.x - 10), by = Math.round(y + 3);
  ctx.fillStyle = 'rgba(8,10,20,0.75)'; ctx.fillRect(bx - 1, by - 1, 22, 4); ctx.fillStyle = '#ffb36a'; ctx.fillRect(bx, by, Math.round(20 * k), 2);
  if (a.rush) text(`×${a.rush} RUSH`, a.x, y - (a.h || 26) * s - 28, a.rush >= 6 ? '#ff9a5a' : '#ffd27a', 7 + Math.min(4, a.rush * 0.5));   // (one counter, growing with the rush)
}
// the shield (world.js, monsters): a steel kite shield held out the way it faces (its guard left shows on the health capsule)
function drawFoeGuard(a, y, now) {
  const f = FG_FACE[a.dir] || FG_FACE[2], s = a.scale || 1, cx = a.x + f[0] * 9 * s, cy = y - 11 * s + f[1] * 5 * s, fl = a.fgFlash > 0;
  if (a.fgFlash > 0) a.fgFlash -= 16;
  const behind = a.dir === 0;   // (facing away from us: the shield is hidden behind the body, only its rim shows)
  ctx.save(); ctx.globalAlpha = behind ? 0.55 : 1;
  const w = 7 * s, h = 10 * s;
  ctx.fillStyle = fl ? '#ffffff' : '#7d8ea4'; ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2); ctx.lineTo(cx + w / 2, cy - h / 2); ctx.lineTo(cx + w / 2, cy + h * 0.1); ctx.lineTo(cx, cy + h / 2); ctx.lineTo(cx - w / 2, cy + h * 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d8e4f0'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(Math.round(cx - 1), Math.round(cy - h * 0.3), 2, Math.round(h * 0.55));   // (the boss in the middle)
  ctx.restore();
  if (!a.dummy) return;   // (a monster's guard shows on its health capsule: world.js drawNameplate; the training dummy has none, so it keeps this bar)
  const k = Math.max(0, Math.min(1, (a.fgSt ?? FOEGUARD.st) / FOEGUARD.st)), bx = Math.round(a.x - 9), by = Math.round(y + 3);
  ctx.fillStyle = 'rgba(8,10,20,0.75)'; ctx.fillRect(bx - 1, by - 1, 20, 4);
  ctx.fillStyle = k < 0.3 ? '#ffb36a' : '#c8d8ec'; ctx.fillRect(bx, by, Math.round(18 * k), 2);
}
