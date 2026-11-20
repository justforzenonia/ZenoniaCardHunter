'use strict';
// BREATHER (resting between fights): a calm breather between fights. Once no hostile monster has been within BREATHER.r for BREATHER.after ms and nothing has hit
// you, your hero's HP slowly refills (BREATHER.pct of max HP a second), and a few tiny soft white motes drift up from them now and then.
// Only on a fed hero (hunger ok or full: home.js hungerMul >= 1), so meals still matter; never while dead or starving. Potions
// stay the way to heal in a fight. Your hero and, on the host, each online co-op friend's hero (their HP lives on the host).
const BREATHER = { r: 200, after: 4000, pct: 1.5, mote: 650 };
{
  const gt = guardTick;
  guardTick = (world, a, dt) => {
    const r = gt(world, a, dt);
    if (a.kind === 'player' && (a === world.player || a.netGid) && !a.dead) breatherTick(world, a, dt);
    return r;
  };
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const hp = def && def.hp, r = dd(world, att, def, opts);
    if (def && world && def.kind === 'player' && def.hp < hp) def.restT = 0;   // a hit: the breather starts over
    return r;
  };
}
function breatherTick(world, a, dt) {
  const near = enemiesOf(world, a).some(o => !o.dead && (o.kind === 'player' || (!o.ally && !o.calm && Math.hypot(o.x - a.x, o.y - a.y) < BREATHER.r)));   // (a calm foe, calmfoes.js, is no fight)   // (any hostile hero, as in a duel, means no rest at all)
  if (near) { a.restT = 0; return; }
  a.restT = (a.restT || 0) + dt;
  const fed = a.hungerMul == null || a.hungerMul >= 1;
  a.resting = a.restT >= BREATHER.after && fed && !a.starving && a.hp < a.maxHp;
  if (!a.resting) return;
  if (window.GAME && a === world.player && typeof tipEvent === 'function' && a.hp < a.maxHp * 0.9) tipEvent(GAME, 'breather');   // (shown once, the first time it really helps)
  a.hp = Math.min(a.maxHp, a.hp + a.maxHp * BREATHER.pct / 100 * dt / 1000);
  if ((a.restMote = (a.restMote || 0) + dt) >= BREATHER.mote) {
    a.restMote = 0;
    world.particles.push({ x: a.x + (Math.random() < 0.5 ? -1 : 1) * rand(10, 15), y: a.y - rand(2, 12), vx: rand(-3, 3), vy: rand(-16, -10), t: 0, life: 900, col: Math.random() < 0.5 ? '#ffffff' : '#fff2c0', size: 2.2 });
  }
}
