'use strict';
// TAKING TURNS: a crowd no longer all swings at once. For each hero (yours and, on the host, each co-op friend's), only the
// FOE_TURNS.max nearest ordinary hostile monsters within FOE_TURNS.r may fight them up close; the others wait in a loose ring
// at about FOE_TURNS.ring px, facing the hero and slowly circling it, and step in when a place frees up (one is defeated, or
// the hero moves). They still cast their spells while they wait (with the spell warning, foewindup.js). Bosses and mini
// bosses always fight and don't take a place; dojo masters, familiars and the training dummy are left alone.
const FOE_TURNS = { max: 3, r: 70, ring: 58, every: 150 };
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    if (m.ally || m.boss || m.miniBoss || m.dummy || m.riding || m.windup || world.dojo || world.peaceful || foeTurnsRanged(m)) return ai(world, m, dt);
    foeTurnsAssign(world);
    const h = m.turnWait;
    if (!h || h.dead || (m.spell && m.ai && m.ai.cast <= 0)) return ai(world, m, dt);   // (a ready spell still goes off)
    const A = m.ai; A.t -= dt; A.cast -= dt;
    const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy) || 1;
    m.dir = dirTo(-dx, -dy);
    if (d < FOE_TURNS.ring - 6) { const sp = speedOf(m) * 0.6 * dt / 1000; moveBy(world, m, dx / d * sp, dy / d * sp); setAnim(m, 'walk', true); }
    else if (d > FOE_TURNS.ring + 14) { const sp = speedOf(m) * 0.6 * dt / 1000; moveBy(world, m, -dx / d * sp, -dy / d * sp); setAnim(m, 'walk', true); }
    else {   // in the ring: drift slowly round the hero, each its own way, now and then turning back (a crowd that waits, not statues)
      if (!m.turnSide || (m.turnFlip = (m.turnFlip || rand(2500, 5000)) - dt) <= 0) { m.turnSide = m.turnSide ? -m.turnSide : (Math.random() < 0.5 ? -1 : 1); m.turnFlip = rand(2500, 5000); }
      const sp = speedOf(m) * 0.25 * dt / 1000, x0 = m.x, y0 = m.y; moveBy(world, m, -dy / d * sp * m.turnSide, dx / d * sp * m.turnSide * 0.45);   // (squashed like the ground ellipse)
      if (m.x === x0 && m.y === y0) { m.turnSide = -m.turnSide; setAnim(m, 'idle', true); } else setAnim(m, 'walk', true);   // (blocked: stand, and try the other way next)
      m.dir = dirTo(-dx, -dy);   // (still facing the hero)
    }
  };
}
const foeTurnsRanged = m => m.foeRole === 'archer' || m.foeRole === 'shaman';   // (they fight from range: no place needed)
function foeTurnsAssign(world) {
  const now = performance.now(); if (world.turnsAt && now - world.turnsAt < FOE_TURNS.every) return;
  world.turnsAt = now;
  const heroes = world.actors.filter(a => a.kind === 'player' && !a.dead && (a === world.player || a.netGid));
  const foes = world.actors.filter(a => a.kind === 'monster' && !a.dead && !a.ally && !a.boss && !a.miniBoss && !a.dummy && !foeTurnsRanged(a) && !a.calm);   // (a calm foe, calmfoes.js, won't fight, so it takes no place)
  for (const m of world.actors) if (m.kind === 'monster') m.turnWait = null;   // (calm and ranged ones too, so none keeps an old place)
  const taken = new Set();
  for (const h of heroes) {
    // places are sticky: a foe already fighting this hero (or mid-swing) keeps its place while it stays close, so a place
    // never changes hands in the middle of an attack; the rest go by distance
    const D = m => Math.hypot(m.x - h.x, m.y - h.y), keep = m => m.turnHero === h || m.state === 'attack';
    const near = foes.filter(m => !taken.has(m) && D(m) < FOE_TURNS.r).sort((a, b) => (keep(b) - keep(a)) || D(a) - D(b));
    near.forEach((m, i) => { taken.add(m); if (i >= FOE_TURNS.max) { m.turnWait = h; m.turnHero = null; } else { m.turnWait = false; m.turnHero = h; } });   // (false: fighting this hero, so another hero can't make it wait)
  }
  for (const m of foes) if (!taken.has(m)) m.turnHero = null;
}
