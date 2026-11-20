'use strict';
// STATUS TIMERS: each debuff chip by a foe's health bar (world.js drawStatusChips) gets a thin line under it that shrinks as
// the status wears off, so you can see a freeze or a burn about to end and time a reaction (elemreact.js) before it does.
// The full length is the longest time seen since the status began (a fresh hit refills it). A co-op friend's copy only has
// placeholder times (net.js), so it shows no line there. Settings > COMBAT HINTS off hides the lines.
const ST_TIMER = { col: '#ffffff', back: 'rgba(40,20,30,0.7)' };   // (a dark track so the white shows on grass and snow)
const stLeft = v => (typeof v === 'number' ? v : v && typeof v.t === 'number' ? v.t : null);
{
  const dsc = drawStatusChips;
  drawStatusChips = (a, x, top, H) => {
    const r = dsc(a, x, top, H), S = a.status;
    if (!S || (typeof SET !== 'undefined' && SET.hints === false)) return r;
    const M = a.stMax = a.stMax || {};
    let cx = x - 8;
    for (const [k] of STATUS_CHIPS) {
      if (!S[k]) { delete M[k]; continue; }
      const t = stLeft(S[k]);
      if (t != null && t > 0 && t < 1e6) {
        if (!(M[k] >= t)) M[k] = t;   // (a new or refreshed status sets the full length)
        const cy = top + Math.round((H - 7) / 2) + 8, w = Math.max(1, Math.round(7 * t / M[k]));
        ctx.fillStyle = ST_TIMER.back; ctx.fillRect(cx, cy, 7, 1);
        ctx.fillStyle = ST_TIMER.col; ctx.fillRect(cx, cy, w, 1);
      }
      cx -= 8;
    }
    return r;
  };
}
