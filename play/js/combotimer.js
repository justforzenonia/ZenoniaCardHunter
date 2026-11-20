'use strict';
// COMBO TIMER: a thin line under the HITS of the combo counter (hud.js drawComboCounter) that shrinks as the chain's window
// (a.comboT, refilled by every hit) runs out, so you can see how long you have to land the next hit and keep a chain (and its
// PAYBACK pay, combopay.js) going. Gold, with a dark track; it fades with the counter. Settings > COMBAT HINTS off hides it.
{
  const dc = drawComboCounter;
  drawComboCounter = (a, now) => {
    const r = dc(a, now);
    if (!(a.combo >= 2) || !(a.comboT > 0) || (typeof SET !== 'undefined' && SET.hints === false)) { a.comboTMax = 0; return r; }
    if (!(a.comboTMax >= a.comboT)) a.comboTMax = a.comboT;   // (a hit refills the window: the full length follows it)
    if (a.comboPopT === now) a.comboTMax = a.comboT;
    const W = 34, k = Math.max(0, Math.min(1, a.comboT / a.comboTMax));
    ctx.save(); ctx.globalAlpha = Math.min(1, a.comboT / 300);
    ctx.translate(VW - 16, 222); ctx.rotate(-0.06);
    ctx.fillStyle = 'rgba(40,20,30,0.6)'; ctx.fillRect(-W, 21, W, 1.5);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-W * k, 21, W * k, 1.5);
    ctx.restore();
    return r;
  };
}
