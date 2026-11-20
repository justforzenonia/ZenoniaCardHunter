'use strict';
// RAINY DAYS: about one real day in four (fixed by the date, so friends share the weather) it rains overnight in Hearthvale.
// The first time your farm is looked after that day (home.js ripeTick, once a second wherever you are), every crop that is
// planted and still growing is watered for you: the normal soak, or a full day for the rare crops. A soft message says how
// many plots the rain watered. Ripe crops and empty plots are left as they are.
const RAIN = { chance: 25, force: null };   // per cent of days (force: true / false for tests only)
function isRainDay(d = dayNo()) {   // a well-mixed hash of the day, so rainy days come in loose, natural runs
  if (RAIN.force != null) return RAIN.force;
  let x = Math.imul(d ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return ((x >>> 0) % 100) < RAIN.chance;
}
{
  const rt = ripeTick;
  ripeTick = (game, dt) => { rainTick(game); return rt(game, dt); };
}
function rainTick(game) {
  const pr = game.profile, today = dayNo(); if (!pr || pr.rainDay === today) return;
  pr.rainDay = today; if (!isRainDay(today) || !pr.farm) return;
  const F = farmer(pr); let n = 0;
  pr.farm.forEach(P => {
    if (!P || !P.crop || plotProgress(P, pr) >= 1) return;
    settlePlot(P, pr); P.wet = Math.max(P.wet || 0, Date.now() + (CROPS[P.crop].long ? LONG_WET : wetMs(F.sk.soak))); n++;
  });
  if (n) { game.toast(`It rained overnight: the rain watered ${n} plot${n > 1 ? 's' : ''} on your farm`, '#9fd8ff'); game.save(); }
}
// DRY SOIL: a crop on dry soil grows at a quarter of the pace (home.js DRY_GROW). When planted, still-growing crops on your
// farm dry out (their watering wore off), one soft message says so: once per dry spell, not again until they have been
// watered (or rained on) and dried out once more. Checked with the ripe check, once a second.
{
  const rt = ripeTick;
  ripeTick = (game, dt) => { const r = rt(game, dt); dryTick(game); return r; };
}
function dryTick(game) {
  const pr = game.profile; if (!pr || !pr.farm) return;
  const dry = []; pr.farm.forEach((P, i) => { if (P && P.crop && P.wet > 0 && plotProgress(P, pr) < 1 && !plotWet(P)) dry.push(i); });   // (P.wet > 0: it was watered once; a fresh seed isn't 'dried')
  const was = pr.dryTold || [];
  const newly = dry.filter(i => !was.includes(i));
  pr.dryTold = dry;   // (a plot leaves the list when watered, so it can be told about again next time)
  if (!newly.length || game.dryAt && Date.now() - game.dryAt < 60000) return;   // (at most one message a minute)
  game.dryAt = Date.now();
  const names = [...new Set(newly.map(i => ITEMS[pr.farm[i].crop].name.toLowerCase()))].join(', ');
  game.toast(`The soil has dried around your ${names}: water ${newly.length > 1 ? 'them' : 'it'} to keep growing at full pace`, '#c8b48a');
}
// On a rainy day the little sky in the clock (daynight.js drawClock) shows it: a soft grey veil and a light drizzle, only
// inside its window, so the world itself stays clear and calm.
{
  const dc = drawClock;
  drawClock = (now) => {
    const r = dc(now); if (!GAME.profile || !isRainDay()) return r;
    const { W, H } = SKY, x0 = Math.round(VW / 2 - W / 2), y0 = 20;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
    ctx.fillStyle = 'rgba(70,80,100,0.28)'; ctx.fillRect(x0, y0, W, H);
    ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {   // drops falling at a slant, each on its own loop
      const sx = ((i * 37) % W), sp = 0.04 + (i % 3) * 0.008, yy = ((now * sp + i * 23) % (H + 8)) - 4, xx = x0 + ((sx - now * sp * 0.35) % W + W) % W;
      ctx.beginPath(); ctx.moveTo(xx, y0 + yy); ctx.lineTo(xx - 1.5, y0 + yy + 4); ctx.stroke();
    }
    ctx.restore(); return r;
  };
}
