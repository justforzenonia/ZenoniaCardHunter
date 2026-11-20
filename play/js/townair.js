'use strict';
// TOWN AIR: small calm life over the towns, drawn with the butterflies (world.js drawButterflies):
//   - chimney smoke: soft grey puffs rising and drifting from each house's chimney (found once from the house picture:
//     its highest pixels in the right half of the roof)
//   - something in the air, each town its own: petals over Hearthvale and Mossbrook, fireflies in Duskhollow, little
//     wisps in Cloudhold, snowflakes in Frostmere, sand motes in Mirage Springs. A dozen at most, slow, never in the way
//   - warm windows at dusk: a house's window panes (its near-white pixels, found once) glow amber as night comes
// Nothing here touches the game: pictures only, worked out from the clock, so it costs almost nothing.
const TAIR = { houses: '013', smoke: { n: 5, life: 4600, rise: 30, alpha: 0.62 }, drift: 12 };
const TAIR_LOOK = {   // per town: colours, size, fall speed (px/s), sway, and whether it glows
  hv: { cols: ['#ffffff', '#ffd0e0', '#fff0a0'], size: 2, fall: 9, sway: 14, glow: false },
  0: { cols: ['#ffffff', '#ffd0e0', '#fff0a0'], size: 2, fall: 9, sway: 14, glow: false },
  1: { cols: ['#d8ff9a', '#fff6a0'], size: 1, fall: -3, sway: 10, glow: true },
  2: { cols: ['#ffffff', '#e8f2ff'], size: 2, fall: 4, sway: 18, glow: false },
  3: { cols: ['#ffffff', '#e0ecff'], size: 2, fall: 14, sway: 10, glow: false },
  4: { cols: ['#f0d898', '#fff0c8'], size: 1, fall: 3, sway: 22, glow: false },
};
// the chimney top and the window panes of a house picture, worked out once from its pixels
const TAIR_SHAPE = {};
function tairShape(bank, fi) {
  const k = bank + ':' + fi; if (k in TAIR_SHAPE) return TAIR_SHAPE[k];
  const rec = objRec(bank, fi), im = img(D.objects.img); if (!rec || !im || !im.complete && im.complete !== undefined) return null;
  const [sx, sy, w, h] = rec, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, sx, sy, w, h, 0, 0, w, h);
  let d; try { d = g.getImageData(0, 0, w, h).data; } catch (e) { return (TAIR_SHAPE[k] = null); }
  let chim = null; for (let y = 0; y < h && !chim; y++) for (let x = Math.floor(w * 0.68); x < w; x++) if (d[(y * w + x) * 4 + 3] > 200) { chim = [x + 1, y]; break; }
  // window panes: near-white pixels in the upper half framed by the window's dark lines (white plaster walls have no dark lines round them)
  const dark = (x, y) => { const i = (y * w + x) * 4; return d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] < 240; };
  const panes = []; for (let y = 2; y < Math.floor(h * 0.5); y++) for (let x = 2; x < w - 2; x++) {
    const i = (y * w + x) * 4; if (!(d[i + 3] > 200 && d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 215)) continue;
    let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dark(x + dx, y + dy)) n++; if (n >= 6) panes.push(x, y); }
  return (TAIR_SHAPE[k] = { chim: chim && chim[1] < h * 0.45 ? chim : null, panes, ox: rec[4], oy: rec[5] });
}
function tairTown(x) { if (typeof outpostAt === 'function') { const O = outpostAt(x); if (O) return O.i; } return x >= TOWN_OX - 4 ? 'hv' : null; }
{
  const db = drawButterflies;
  drawButterflies = (world, cam, now) => { const r = db(world, cam, now); try { drawTownAir(world, cam, now); } catch (e) { if (!drawTownAir.warned) { drawTownAir.warned = true; console.warn('town air', e); } } return r; };
}
function drawTownAir(world, cam, now) {
  if (!cam || !world.player) return;
  const town = tairTown(cam.x + WVW / 2); if (town == null) return;
  const pr = window.GAME && GAME.profile, night = typeof nightK === 'function' ? nightK(pr) : 0, t = now / 1000;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  // the houses on screen: their smoke, and their windows as night comes
  for (const o of world.objects || []) {
    if (o.bank !== TAIR.houses || o.x < cam.x - 80 || o.x > cam.x + WVW + 80 || o.y < cam.y - 60 || o.y > cam.y + WVH + 120) continue;
    const S = tairShape(o.bank, o.fi); if (!S) continue;
    const bx = o.x + S.ox, by = o.y + S.oy, hs = Math.abs(Math.sin(o.x * 12.9898 + o.y * 78.233)) % 1;
    if (S.chim) for (let k = 0; k < TAIR.smoke.n; k++) {
      const age = ((now + (k / TAIR.smoke.n + hs) * TAIR.smoke.life) % TAIR.smoke.life) / TAIR.smoke.life, rad = 2 + age * 5;
      const x = bx + S.chim[0] + Math.sin(age * 4 + hs * 6) * 2 + age * 7, y = by + S.chim[1] - 2 - age * TAIR.smoke.rise;
      ctx.globalAlpha = TAIR.smoke.alpha * Math.sin(Math.min(1, age * 3) * Math.PI / 2) * (1 - age);
      ctx.fillStyle = '#dfe2e8'; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f6f7fa'; ctx.beginPath(); ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    if (night > 0.15 && S.panes.length) {   // warm panes, fading in with the dusk
      ctx.globalAlpha = Math.min(1, (night - 0.15) * 1.6) * (0.85 + 0.15 * Math.sin(t * 1.3 + hs * 9)); ctx.fillStyle = '#ffd27a';
      for (let i = 0; i < S.panes.length; i += 2) ctx.fillRect(bx + S.panes[i], by + S.panes[i + 1], 1, 1);
    }
  }
  // what drifts in the air here: screen-wide, each piece on its own slow loop
  const L = TAIR_LOOK[town] || TAIR_LOOK.hv, Wd = WVW + 40, Hd = WVH + 40;
  for (let k = 0; k < TAIR.drift; k++) {
    const h1 = Math.abs(Math.sin(k * 91.7 + 3.1) * 43758.5) % 1, h2 = Math.abs(Math.sin(k * 47.3 + 7.7) * 24634.6) % 1, sp = 0.6 + h2 * 0.8;
    const x = cam.x - 20 + ((h1 * Wd + t * (4 + h2 * 6) + Math.sin(t * 0.7 * sp + k) * L.sway) % Wd + Wd) % Wd;
    const y = cam.y - 20 + ((h2 * Hd + t * L.fall * sp) % Hd + Hd) % Hd, col = L.cols[k % L.cols.length];
    if (L.glow) {   // fireflies: a soft blink
      const b = 0.5 + 0.5 * Math.sin(t * 2.2 * sp + k * 1.7); ctx.globalAlpha = 0.35 + 0.55 * b * Math.max(0.4, night);
      ctx.fillStyle = 'rgba(220,255,140,0.25)'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    } else {
      const flip = Math.sin(t * 3 * sp + k) > 0; ctx.globalAlpha = 0.75; ctx.fillStyle = col;
      if (L.size > 1) ctx.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 2); else ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  ctx.restore();
}
