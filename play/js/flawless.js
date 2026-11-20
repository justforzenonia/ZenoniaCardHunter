'use strict';
// FLAWLESS: a fight you win without taking a hit pays a little extra. A fight starts with your first kill near foes and ends
// once no hostile monster is within FLAWLESS.r for FLAWLESS.quiet ms. If you defeated FLAWLESS.min or more in it and your HP
// never dropped, you get FLAWLESS.exp of those kills' EXP again, shown by a small gold star chip over your hero (the same
// pixel chip style as the reactions) and a small "+N EXP" float. Calm, no banner. With online co-op friends, the host tracks
// each hero on their own: a kill counts for every hero within FLAWLESS.share of it, and a friend's EXP and stat go to their save.
const FLAWLESS = { r: 160, quiet: 2000, min: 3, exp: 0.25, share: 220 };
const flawHeroes = w => [w.player, ...w.actors.filter(a => a.netGid && !a.remove)].filter(h => h && h.kind === 'player' && !h.dead);
REACT_CHIPS.FLAWLESS = ['#ffd23f', ['..#..', '.###.', '#####', '.###.', '#.#.#']];   // a star
{
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => {
    const r = ok(game, w, m);
    if (w && m && !m.ally && game.world === w) {
      const H = flawHeroes(w), solo = H.length <= 1;   // (alone, every kill is yours, as before; with friends, the heroes near it)
      for (const h of H) if (solo || Math.hypot(h.x - m.x, h.y - m.y) < FLAWLESS.share) { const F = h.flawless = h.flawless || { n: 0, exp: 0, hit: false, quiet: 0 }; F.n++; F.exp += killExp(m.tier); F.quiet = 0; }
    }
    return r;
  };
  const gt = guardTick;
  guardTick = (world, a, dt) => {
    const r = gt(world, a, dt);
    if (a.kind === 'player' && (a === world.player || a.netGid) && a.flawless) {
      const F = a.flawless;
      const near = enemiesOf(world, a).some(o => o.kind === 'monster' && !o.ally && !o.calm && Math.hypot(o.x - a.x, o.y - a.y) < FLAWLESS.r);   // (calm foes don't keep a fight going)
      if (near) F.quiet = 0; else if ((F.quiet += dt) >= FLAWLESS.quiet) { flawlessEnd(world, a, F); a.flawless = null; }
    }
    return r;
  };
  // a hit that costs you HP spoils the fight (before its first kill too); hunger and the like do not count
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const hp = def && def.hp, r = dd(world, att, def, opts);
    if (def && world && def.kind === 'player' && (def === world.player || def.netGid) && def.hp < hp) { def.flawless = def.flawless || { n: 0, exp: 0, hit: false, quiet: 0 }; def.flawless.hit = true; }
    return r;
  };
}
function flawlessEnd(world, a, F) {
  const G = window.GAME; if (!G || G.world !== world || F.hit || F.n < FLAWLESS.min || a.dead) return;
  const exp = Math.max(1, Math.round(F.exp * FLAWLESS.exp));
  if (a === world.player) G.gainExp(exp), bumpStat('flawless');
  else if (a.netGid && typeof netShare === 'function') { netShare(G, 'exp', exp, a.netGid); if (typeof netStatTo === 'function') netStatTo(G, a.netGid, 'flawless'); }   // (a friend's, to their save)
  else return;
  floatText(world, a.x, a.y - 60, REACT_ICON_MARK + 'FLAWLESS', '#ffd23f', 7.5);
  floatText(world, a.x, a.y - 46, `+${exp} EXP`, '#ffe08a', 7);
  if (a !== world.player) return;   // (the tip and chime are for your own hero)
  if (typeof tipEvent === 'function') tipEvent(G, 'flawless');
  if (typeof cuePlay === 'function') cuePlay([523, 659, 784]);   // (a soft rising music-box phrase, cues.js)
}
