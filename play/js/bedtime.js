'use strict';
// BEDTIME: a cozy way to end the night. Enter at your bed at home now asks first:
//   NAP UNTIL MORNING   - as before (homelife.js): sleep to morning, healed, and Well Rested for 10 minutes
//   SLEEP FOR THE NIGHT - your hero is tucked in: the game saves and goes to the title (with the session recap), and the
//                         rested EXP your time away builds (sessionrecap.js WELCOME) grows 50% faster for that absence
// Esc steps back. Only in your own game: a co-op room keeps the plain nap.
const BEDTIME = { boost: 1.5, opts: [
  { t: 'NAP UNTIL MORNING', s: 'Healed, and Well Rested for 10 minutes' },
  { t: 'SLEEP FOR THE NIGHT', s: 'Save and rest: rested EXP builds 50% faster while you are away' },
] };
{
  const sm = sleepMenu;
  sleepMenu = () => { const m = sm(); if (!(window.GAME && GAME.net)) { m.ask = true; m.pick = 0; } return m; };
  const us = updateSleep;
  updateSleep = (game, m, dt) => {
    if (m.ask) {
      const k = navInput(), n = BEDTIME.opts.length;
      if (k.u) m.pick = (m.pick + n - 1) % n; if (k.d) m.pick = (m.pick + 1) % n;
      BEDTIME.opts.forEach((o, i) => { const B = bedtimeBtn(i); if (clicked(B.x, B.y, B.w, B.h)) { if (m.pick === i) k.ok = true; m.pick = i; } });
      if (k.back) { game.closeMenu(); return; }
      if (k.ok) { m.ask = false; m.night = m.pick === 1; m.t = 0; }
      return;
    }
    if (m.night && m.t + dt >= HL.sleep) {   // (the night is over for you: save and go to the title instead of waking up)
      m.t += dt; const pr = game.profile; if (!pr) return;
      pr.tuckedIn = Date.now(); game.save(); game.saved = pr; game.backToTitle(); return;
    }
    return us(game, m, dt);
  };
  const ds = drawSleep;
  drawSleep = (game, m, now) => {
    if (m.ask) { bedtimeDrawAsk(m, now); return; }
    if (!m.night) return ds(game, m, now);
    const k = Math.min(1, m.t / 500); ctx.fillStyle = `rgba(4,4,14,${k})`; ctx.fillRect(0, 0, VW, VH); if (k < 0.6) return;
    ctx.save(); ctx.globalAlpha = (k - 0.6) / 0.4;
    goldTitle('GOOD NIGHT', VW / 2, VH / 2 - 10, 16, now);
    text(`${(game.profile && game.profile.look && game.profile.look.name) || 'Your hero'} sleeps at home. Rested EXP builds faster while you are away.`, VW / 2, VH / 2 + 12, '#c8d8ff', 7.5);
    for (let i = 0; i < 3; i++) { const z = ((now / 900) + i / 3) % 1; ctx.globalAlpha = ((k - 0.6) / 0.4) * Math.sin(z * Math.PI); text('z', VW / 2 + 40 + z * 18 + i * 4, VH / 2 - 26 - z * 22, '#c8d8ff', 8 + i * 2); }
    ctx.restore();
  };
}
function bedtimeBtn(i) { return { x: VW / 2 - 150, y: VH / 2 - 18 + i * 36, w: 300, h: 30 }; }
function bedtimeDrawAsk(m, now) {
  ctx.fillStyle = 'rgba(6,4,14,0.55)'; ctx.fillRect(0, 0, VW, VH);
  goldText('YOUR BED', VW / 2, VH / 2 - 40, 13, { spacing: 3 });
  BEDTIME.opts.forEach((o, i) => {
    const B = bedtimeBtn(i), on = i === m.pick, col = i ? '#c8d8ff' : '#ffe9a8';
    panel(B.x, B.y, B.w, B.h, on ? col : 'rgba(201,168,90,0.55)', on ? 'rgba(36,30,62,0.96)' : 'rgba(18,14,30,0.92)');
    if (on) { ctx.fillStyle = col; ctx.fillRect(B.x + 1, B.y + 1, 3, B.h - 2); }
    text(o.t, B.x + 14, B.y + 11, on ? col : '#e8e2cf', 8.5, 'left');
    text(o.s, B.x + 14, B.y + 23, '#d0c8dc', 7, 'left');
  });
  text('↑↓ choose · Enter · Esc: not now', VW / 2, VH / 2 + 62, '#b8ae96', 7);
}
// coming back after a night in your bed: the welcome card (sessionrecap.js) builds rested EXP 50% faster, and says so
{
  const wt = welcomeTick;
  welcomeTick = game => {
    const pr = game.profile, fresh = pr && game.welcomeRead !== pr, tucked = fresh && pr.tuckedIn && pr.lastPlayed && pr.tuckedIn >= pr.lastPlayed - 60000;
    if (fresh && pr.tuckedIn) pr.tuckedIn = 0;   // (used once, either way)
    if (!tucked) return wt(game);
    const base = WELCOME.restPerHour, card = game.goalCard; WELCOME.restPerHour = base * BEDTIME.boost;
    try { wt(game); } finally { WELCOME.restPerHour = base; }
    const C = game.goalCard; if (C && C !== card && C.lines) C.lines.push('You slept at home: rested EXP built 50% faster');
  };
}
