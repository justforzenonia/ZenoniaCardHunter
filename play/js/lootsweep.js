'use strict';
// LOOT SWEEP: once a fight is over (your hero's breather timer, breather.js restT: no monster within 200 px and no hit, for
// LOOT_SWEEP.after ms), coins and items lying within LOOT_SWEEP.r drift to the nearest hero through the item magnet
// (world.js collectDrops: a pulled drop keeps coming), so you don't have to walk over every one. Potions are left where they
// are (taking one at full HP would waste it); the usual short magnet still takes them. Runs for your hero and, on the host,
// each online co-op friend's.
const LOOT_SWEEP = { after: 1200, r: 240 };
{
  const gt = guardTick;
  guardTick = (world, a, dt) => {
    const r = gt(world, a, dt);
    if (a.kind === 'player' && (a === world.player || a.netGid) && !a.dead && a.restT >= LOOT_SWEEP.after && world.drops && world.drops.length)
      for (const d of world.drops) if (!d.pulled && d.kind !== 'potion' && Math.hypot(d.x - a.x, d.y - a.y) < LOOT_SWEEP.r) d.pulled = true;
    return r;
  };
}
