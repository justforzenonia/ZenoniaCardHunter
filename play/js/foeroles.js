'use strict';
// MONSTERS WITH A JOB: now and then a monster in the Wilds has a role (never one with a shield or a charge: foeguard.js,
// foecharge.js). The role is in its name, so you can pick your target:
//   ARCHER    keeps its distance, backing off when you close in, and looses an arrow after a short aim (a thin red line shows
//             where). Dash in to it, block the arrow, or parry it straight back.
//   SHAMAN    hangs back too, and every few seconds heals the most hurt monster near it (or wards one with a shield), a green
//             circle filling under it first. Strike it down first, or its pack keeps coming back.
//   WARLEADER fights in the thick of it; while it stands, the monsters around it hit a quarter harder (a red banner ring
//             shows how far it reaches). Take it out and the pack falters.
// A co-op friend sees the names and the rings (net.js sends the role with each monster).
const FROLE = {
  chance: { archer: 0.08, shaman: 0.05, leader: 0.04 }, minTier: 1,
  archer: { near: 80, far: 150, sight: 220, every: [1800, 2800], aim: 450, speed: 230, life: 1000, mul: 0.9 },
  shaman: { near: 100, far: 160, sight: 240, every: [4000, 6000], cast: 600, reach: 140, heal: 0.25, ward: 0.15 },
  leader: { reach: 100, mul: 1.25, every: 400, hold: 900 },
};
const FROLE_NAME = { archer: 'Archer', shaman: 'Shaman', leader: 'Warleader' };
function foeRoleRoll(world, m) {
  if (m.foeRole !== undefined) return m.foeRole;
  const ok = m.kind === 'monster' && !m.boss && !m.ally && !m.pet && !m.dummy && !m.hunter && !m.animalBody && !m.netOf && !m.miniBoss && (m.tier || 0) >= FROLE.minTier && !world.dojoRoom && !world.peaceful
    && !(typeof foeGuardRoll === 'function' && foeGuardRoll(world, m)) && !(typeof foeChargeRoll === 'function' && foeChargeRoll(world, m));
  let role = null;
  if (ok) { let r = Math.random(); for (const k of ['archer', 'shaman', 'leader']) { if (r < FROLE.chance[k]) { role = k; break; } r -= FROLE.chance[k]; } }
  m.foeRole = role;
  if (role) m.label = `${(SPECIES[m.sp] || {}).name || 'Monster'} ${FROLE_NAME[role]}`;
  return role;
}
// keep a hero at arm's length (archer, shaman): back off when they close in, come closer when they drift away
function foeKeepAway(world, m, foe, R, dt) {
  const dx = foe.x - m.x, dy = foe.y - m.y, d = Math.hypot(dx, dy) || 1, sp = speedOf(m) * dt / 1000;
  m.dir = dirTo(dx, dy);
  if (d < R.near) { moveBy(world, m, -dx / d * sp, -dy / d * sp); setAnim(m, 'walk', true); }
  else if (d > R.far) { moveBy(world, m, dx / d * sp, dy / d * sp); setAnim(m, 'walk', true); }
  else setAnim(m, 'idle', true);
}
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    const role = foeRoleRoll(world, m); if (!role || m.state !== 'free') return ai(world, m, dt);
    if (role === 'leader') {   // fights as usual; every moment its aura lifts the monsters near it
      if ((m.ldT = (m.ldT || 0) - dt) <= 0) { m.ldT = FROLE.leader.every; const until = performance.now() + FROLE.leader.hold;
        for (const o of world.actors) if (o !== m && o.kind === 'monster' && !o.dead && !o.ally && o.team === m.team && Math.hypot(o.x - m.x, o.y - m.y) < FROLE.leader.reach) o.ldBuff = until; }
      return ai(world, m, dt);
    }
    const R = FROLE[role], foe = nearestEnemy(world, m, R.sight);
    if (!foe) return ai(world, m, dt);
    if (Math.hypot(foe.x - m.x, foe.y - m.y) < 24) return ai(world, m, dt);   // (cornered: it lashes out like any monster)
    if (role === 'archer') {
      if (m.arAim > 0) {   // aiming: still, a red line to where it will loose
        m.arAim -= dt; m.vx = m.vy = 0; m.dir = dirTo(foe.x - m.x, foe.y - m.y); m.arAt = { x: foe.x, y: foe.y }; setAnim(m, 'idle', true);
        if (m.arAim <= 0) {
          const a = Math.atan2(foe.y - m.y, foe.x - m.x);
          world.projs.push({ owner: m, team: m.team, x: m.x + Math.cos(a) * 10, y: m.y, z: 14, vx: Math.cos(a) * R.speed, vy: Math.sin(a) * R.speed,
            life: R.life, r: 7, opts: { base: m.atk * R.mul, push: 25, pop: 60 }, hit: new Set(), sp: null, el: null, t: 0, pierce: false, arrow: true });
          if (typeof SFX !== 'undefined') SFX.bow(false);
          m.arT = rand(R.every[0], R.every[1]); m.arAt = null;
        }
        return;
      }
      if ((m.arT = (m.arT == null ? rand(800, R.every[1]) : m.arT) - dt) <= 0 && Math.hypot(foe.x - m.x, foe.y - m.y) < R.sight) { m.arAim = R.aim; return; }
      foeKeepAway(world, m, foe, R, dt); return;
    }
    if (role === 'shaman') {
      if (m.shCast > 0) {   // casting: still, a green circle filling under it
        m.shCast -= dt; m.vx = m.vy = 0; setAnim(m, 'idle', true);
        if (m.shCast <= 0) foeShamanCast(world, m);
        return;
      }
      if ((m.shT = (m.shT == null ? rand(1500, R.every[1]) : m.shT) - dt) <= 0) { m.shT = rand(R.every[0], R.every[1]); if (foeShamanTarget(world, m)) { m.shCast = R.cast; return; } }
      foeKeepAway(world, m, foe, R, dt); return;
    }
    return ai(world, m, dt);
  };
}
// the shaman's mend: the most hurt monster near it, or, with none hurt, one without a ward
function foeShamanTarget(world, m) {
  const R = FROLE.shaman, near = world.actors.filter(o => o.kind === 'monster' && !o.dead && !o.ally && o.team === m.team && Math.hypot(o.x - m.x, o.y - m.y) < R.reach);
  const hurt = near.filter(o => o.hp < o.maxHp * 0.8).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  return hurt ? { o: hurt, heal: true } : (near.find(o => o !== m && !(o.shield > 0)) ? { o: near.find(o => o !== m && !(o.shield > 0)), heal: false } : null);
}
function foeShamanCast(world, m) {
  const R = FROLE.shaman, T = foeShamanTarget(world, m); if (!T) return;
  const o = T.o;
  if (T.heal) { const n = Math.round(o.maxHp * R.heal); o.hp = Math.min(o.maxHp, o.hp + n); floatText(world, o.x, o.y - (o.h || 26) * (o.scale || 1) - 6, `+${n}`, '#8fffb0', 9); }
  else { o.shield = Math.max(o.shield || 0, Math.round(o.maxHp * R.ward)); floatText(world, o.x, o.y - (o.h || 26) * (o.scale || 1) - 6, 'WARD', '#9fd8ff', 8); }
  world.rings.push({ x: o.x, y: o.y, r: 20, t: 0, col: T.heal ? '#8fffb0' : '#9fd8ff' }, { x: m.x, y: m.y, r: 14, t: 0, col: '#8fffb0' });
  world.bolts.push({ x1: m.x, y1: m.y - 14, x2: o.x, y2: o.y - 14, t: 0, dur: 260, seed: Math.random() * 1000, w: 1.5, col: T.heal ? '#8fffb0' : '#9fd8ff' });
}
// a warleader's pack hits harder (combat.js dealDamage)
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    if (att && att.ldBuff > performance.now() && att.kind === 'monster' && opts && opts.base) opts = { ...opts, base: opts.base * FROLE.leader.mul };
    return dd(world, att, def, opts);
  };
}
// on screen (world.js, under each monster): the archer's aim line, the shaman's filling circle, the warleader's banner ring
function drawFoeRole(a, y, now) {
  const r = a.foeRole; if (!r || a.dead) return;
  ctx.save();
  if (r === 'archer' && a.arAim > 0 && a.arAt) {
    const k = 1 - a.arAim / FROLE.archer.aim;
    ctx.strokeStyle = `rgba(255,70,50,${0.25 + 0.6 * k})`; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 12); ctx.lineTo(a.arAt.x, a.arAt.y - 12); ctx.stroke(); ctx.setLineDash([]);
  }
  if (r === 'shaman' && a.shCast > 0) {
    const k = 1 - a.shCast / FROLE.shaman.cast;
    ctx.fillStyle = `rgba(120,255,170,${0.15 + 0.3 * k})`; ctx.beginPath(); ctx.ellipse(a.x, a.y, 16 * k + 4, (16 * k + 4) * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (r === 'leader') {
    const pl = 0.5 + 0.5 * Math.sin(now / 300);
    ctx.strokeStyle = `rgba(255,80,60,${0.18 + 0.15 * pl})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(a.x, a.y, FROLE.leader.reach, FROLE.leader.reach * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
