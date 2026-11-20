'use strict';
// CHARGERS: now and then a monster in the Wilds is a charger (never one that carries a shield: foeguard.js). When a hero stands a
// little way off, it plants its feet and winds up, a red lane showing exactly where it will go, then lunges down that lane fast:
// the first hero in its path takes a heavy blow and is knocked aside. Step out of the lane, or dash through the lunge as it
// lands for a PERFECT DODGE (guard.js). After the lunge it is DAZED for a moment, and if it slams into a wall it is dazed for
// longer: either way it takes extra damage while it reels. A co-op friend sees the lane too (net.js sends it with each monster).
const FCHARGE = { chance: 0.12, minTier: 1, near: 50, far: 140, over: 28, wind: 650, dash: 340, every: [3500, 6000], w: 12,
  mul: 1.6, push: 170, daze: 700, wall: 1400, bonus: 1.25 };
function foeChargeRoll(world, m) {
  if (m.fcRoll !== undefined) return m.fcRoll;
  const ok = m.kind === 'monster' && !m.boss && !m.ally && !m.pet && !m.dummy && !m.hunter && !m.animalBody && !foeGuardRoll(world, m) && (m.tier || 0) >= FCHARGE.minTier && !world.dojoRoom && !world.peaceful;
  m.fcRoll = ok && Math.random() < FCHARGE.chance;
  return m.fcRoll;
}
// its thinking (combat.js monsterAI): wind up, lunge down the lane, reel
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    if (!foeChargeRoll(world, m)) return ai(world, m, dt);
    if (m.fcDaze > 0) { m.fcDaze -= dt; m.vx = m.vy = 0; setAnim(m, 'idle', true); return; }
    const C = m.fcCharge;
    if (C) {
      if (m.state !== 'free' || m.dead) { m.fcCharge = null; return; }   // (knocked out of it)
      C.t -= dt; m.vx = m.vy = 0;
      if (C.wind) { setAnim(m, 'idle', true); if (C.t <= 0) { C.wind = false; C.t = FCHARGE.dash; C.hit = new Set(); } return; }
      const step = C.len / FCHARGE.dash * dt, x0 = m.x, y0 = m.y;   // (the lane's whole length in the lunge's time)
      moveBy(world, m, C.dx * step, C.dy * step); setAnim(m, 'walk', true);
      for (const o of enemiesOf(world, m)) {
        if (o.dead || C.hit.has(o) || Math.hypot(o.x - m.x, (o.y - m.y) * 1.4) > FCHARGE.w + 6) continue;
        C.hit.add(o); dealDamage(world, m, o, { base: m.atk * FCHARGE.mul, melee: true, push: FCHARGE.push, pop: 140, charge: true });
      }
      const wall = Math.hypot(m.x - x0, m.y - y0) < step * 0.3;
      if (wall || C.t <= 0) {
        m.fcCharge = null; m.fcDaze = wall ? FCHARGE.wall : FCHARGE.daze; m.fcCd = rand(FCHARGE.every[0], FCHARGE.every[1]);
        if (wall) { floatText(world, m.x, m.y - (m.h || 26) * (m.scale || 1) - 8, 'CRASH!', '#ffd08a', 9); world.shake = Math.max(world.shake || 0, 2); }
        floatText(world, m.x, m.y - (m.h || 26) * (m.scale || 1) - 18, 'DAZED', '#c8d8ff', 8);
      }
      return;
    }
    if (m.fcCd == null) m.fcCd = rand(1000, FCHARGE.every[1]);
    if ((m.fcCd -= dt) <= 0 && m.state === 'free') {
      const foe = nearestEnemy(world, m, FCHARGE.far);
      const d = foe ? Math.hypot(foe.x - m.x, foe.y - m.y) : 0;
      if (foe && foe.kind === 'player' && d > FCHARGE.near) {
        const dx = (foe.x - m.x) / d, dy = (foe.y - m.y) / d;
        m.fcCharge = { wind: true, t: FCHARGE.wind, dx, dy, len: Math.min(FCHARGE.far + 20, d + FCHARGE.over) };   // (a little past where the hero stood)
        m.dir = dirTo(dx, dy); m.vx = m.vy = 0;
        floatText(world, m.x, m.y - (m.h || 26) * (m.scale || 1) - 8, '!', '#ff6a4a', 12);
        if (window.GAME && GAME.world === world && foe === world.player && typeof tipEvent === 'function') tipEvent(GAME, 'charger');
        if (typeof SFX !== 'undefined') SFX.crushWarn();
        return;
      }
      m.fcCd = 400;   // (no hero in reach: look again shortly)
    }
    return ai(world, m, dt);
  };
}
// a dazed charger takes more (combat.js dealDamage)
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    if (def.fcDaze > 0 && att && att !== def && opts && opts.base) opts = { ...opts, base: opts.base * FCHARGE.bonus };
    return dd(world, att, def, opts);
  };
}
// the lane (world.js, under the monster): a red strip filling in while it winds up
function drawChargeLane(a, now) {
  const C = a.fcCharge || a.fcLane; if (!C) return;   // (the host's own charge, or the one a co-op host sent)
  const k = C.wind ? 1 - Math.max(0, C.t) / FCHARGE.wind : 1, ang = Math.atan2(C.dy, C.dx), pl = 0.6 + 0.4 * Math.sin(now / 60);
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
  ctx.fillStyle = `rgba(255,50,40,${C.wind ? 0.1 + 0.18 * k : 0.25})`; ctx.fillRect(0, -FCHARGE.w / 2, C.len, FCHARGE.w);
  ctx.fillStyle = `rgba(255,70,50,${0.35 + 0.3 * k})`; ctx.fillRect(0, -FCHARGE.w / 2, C.len * k, FCHARGE.w);
  ctx.strokeStyle = `rgba(255,90,60,${pl})`; ctx.lineWidth = 1; ctx.strokeRect(0.5, -FCHARGE.w / 2 + 0.5, C.len - 1, FCHARGE.w - 1);
  ctx.restore();
}
