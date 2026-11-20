'use strict';
// LAST STRETCH: a foe on its last LAST_STRETCH.pct of HP gets a soft gold outline round its health bar that breathes slowly,
// so in a crowd you can see which one a single hit will finish. Calm: thin, see-through, no flash. Not on bosses or your
// familiars (a boss has its own big bar). It is drawn with the bar itself (world.js calls drawStatusChips just before the
// capsule, with the plate's fade and bounce already applied), and Settings > COMBAT HINTS off hides it.
const LAST_STRETCH = { pct: 0.2, period: 1400 };
{
  const dsc = drawStatusChips;
  drawStatusChips = (a, x, top, H) => {
    const r = dsc(a, x, top, H), B = a.plateBox;
    a.lastStretch = false;
    if (B && !a.boss && !a.ally && !a.dead && a.maxHp && a.hp / a.maxHp <= LAST_STRETCH.pct && !(typeof SET !== 'undefined' && SET.hints === false)) {
      a.lastStretch = true;   // (2026-11-08: the square gold box round the rounded white pill looked like a stray yellow box; the pill's own outline turns gold instead, world.js drawNameplate)
    }
    return r;
  };
}
