'use strict';
// THE MASTERS FEEL IT: the very first time you transcend (pr.layerSeen), the game cuts away like an anime. The camera pans
// across the five Dojo Masters, one after another in their own towns, speed lines streaming past; then they are all on
// screen at once in slashed panels, eyes snapping open, and they say it together: "That energy…" — "…will we finally
// know defeat?" A white flash, and you are back in the fight with the Layer burning. Enter / click skips it.
const LSCENE = { pan: 3400, cut: 1700, say2: 2200, out: 450, sprite: 5, close: 8, closeY: 196, eyeY: 104, font: '"Dela Gothic One", Impact, sans-serif' };
const LSCENE_LINES = ['THAT ENERGY…', '…WILL WE FINALLY KNOW DEFEAT?'];
function layerScene(game) { game.profile.layerSeen = true; game.save(); game.openMenu({ type: 'layerscene', t: 0 }); }
function updateLayerScene(game, m, dt) {
  m.t += dt; const end = LSCENE.pan + LSCENE.cut + LSCENE.say2 + LSCENE.out;
  if (m.t > end || (m.t > 400 && (hit('Enter', 'Space', 'Escape', 'KeyJ') || mouse.click))) game.closeMenu();
}
// a master's sprite, big and pixel-sharp, facing you (or a placeholder shadow)
function lsMaster(D2, x, y, scale, now) {
  const bank = D.npcs[D2.npc]; if (!bank) return;
  const e = seqFrame(bank.anims.idle[2] || bank.anims.idle[0], now, true); ctx.save(); ctx.imageSmoothingEnabled = false; drawBankFrame(bank, e, x, y, { scale }); ctx.restore();
}
// streaks of speed, in a colour, running sideways (dir 1) or bursting out from a point (cx, cy given)
function lsSpeedLines(now, col, cx, cy, n = 60) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = rng(Math.floor(now / 50));
  for (let i = 0; i < n; i++) {
    if (cx == null) { const y = r() * VH, x = ((r() * VW * 2 - (now * 2.4)) % (VW * 1.4)) + VW * 0.2, l = 60 + r() * 160; ctx.fillStyle = hexA(col, 0.1 + r() * 0.25); ctx.fillRect(VW - x, y, l, r() < 0.2 ? 2 : 1); }
    else { const a = r() * Math.PI * 2, r0 = 90 + r() * 120, l = 80 + r() * 200; ctx.strokeStyle = hexA(col, 0.12 + r() * 0.3); ctx.lineWidth = 0.6 + r() * 1.6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l)); ctx.stroke(); }
  }
  ctx.restore();
}
// bold anime lettering: thick dark outline, a red echo behind, a shake that settles
function lsWords(str, x, y, size, k, now) {
  const sh = (1 - k) * 6, jx = Math.sin(now / 23) * sh, jy = Math.cos(now / 29) * sh, s = 1 + (1 - k) * 0.6;
  ctx.save(); ctx.translate(x + jx, y + jy); ctx.scale(s, s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${size}px ${LSCENE.font}`; ctx.lineJoin = 'round'; ctx.globalAlpha = Math.min(1, k * 3);
  ctx.fillStyle = 'rgba(255,40,40,0.55)'; ctx.fillText(str, 4, 3);
  ctx.strokeStyle = '#0a0004'; ctx.lineWidth = size * 0.28; ctx.strokeText(str, 0, 0);
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#ffe9c8'); g.addColorStop(1, '#ffb070'); ctx.fillStyle = g; ctx.fillText(str, 0, 0);
  ctx.restore();
}
// the five masters of the old road only (the Sand Sage, DOJOS[5], comes after the Grandmaster and is not part of it);
// a drawing error closes the scene instead of freezing the screen on it
function drawLayerScene(game, m, now) {
  try { lsDraw(game, m, now); } catch (e) { console.warn('layer scene', e); if (game.menu === m) game.closeMenu(); }
}
function lsDraw(game, m, now) {
  const MS = DOJOS.slice(0, 5), t = m.t, L = LSCENE, P = MS.length;
  ctx.fillStyle = '#05020a'; ctx.fillRect(0, 0, VW, VH);
  if (t < L.pan) {   // THE PAN: one long strip of five dojos, the camera gliding along it
    const k = t / L.pan, ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, panelW = 300, strip = panelW * P, camX = ease * (strip - VW);
    MS.forEach((D2, i) => {
      const x0 = i * panelW - camX; if (x0 > VW || x0 + panelW < 0) return;
      ctx.save(); ctx.beginPath(); ctx.moveTo(x0 + 26, 0); ctx.lineTo(x0 + panelW + 26, 0); ctx.lineTo(x0 + panelW - 26, VH); ctx.lineTo(x0 - 26, VH); ctx.closePath(); ctx.clip();   // a slanted panel
      const hue = [8, 120, 270, 30, 200][i % 5], g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, `hsl(${hue},55%,14%)`); g.addColorStop(1, `hsl(${hue},70%,4%)`); ctx.fillStyle = g; ctx.fillRect(x0 - 30, 0, panelW + 60, VH);
      const cx = x0 + panelW / 2, rim = ctx.createRadialGradient(cx, VH * 0.62, 10, cx, VH * 0.62, 150); rim.addColorStop(0, `hsla(${hue},90%,60%,0.45)`); rim.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rim; ctx.fillRect(x0 - 30, 0, panelW + 60, VH);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.ellipse(cx, VH * 0.82, 60, 10, 0, 0, Math.PI * 2); ctx.fill();
      lsMaster(D2, cx, VH * 0.82, L.sprite, now);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 + 26, 0); ctx.lineTo(x0 - 26, VH); ctx.stroke(); ctx.restore();   // the panel's black edge
      text(D2.label.toUpperCase(), x0 + panelW / 2, 30, '#ffe9a8', 10); text(`${D2.town} Dojo`, x0 + panelW / 2, 44, '#a89a88', 7);
    });
    lsSpeedLines(now, '#ffffff', null, null, 50);
    const look = Math.max(0, (k - 0.6) / 0.4); if (look > 0) { ctx.fillStyle = `rgba(255,255,255,${0.18 * Math.sin(look * Math.PI)})`; ctx.fillRect(0, 0, VW, VH); }
    text('— somewhere, five masters look up at once —', VW / 2, VH - 14, '#c9b89a', 7.5);
  } else {   // THE CUT-IN: all five at once in slashed panels, eyes snapping open, the words
    const t2 = t - L.pan, sw = VW / P;
    lsSpeedLines(now, '#ff4040', VW / 2, VH / 2, 70);
    MS.forEach((D2, i) => {
      const x0 = i * sw, slide = Math.min(1, Math.max(0, (t2 - i * 70) / 220)), off = (1 - slide) * (i % 2 ? -VH : VH);
      ctx.save(); ctx.translate(0, off); ctx.beginPath(); ctx.moveTo(x0 + 18, 0); ctx.lineTo(x0 + sw + 18, 0); ctx.lineTo(x0 + sw - 18, VH); ctx.lineTo(x0 - 18, VH); ctx.closePath(); ctx.clip();
      const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#2a0408'); g.addColorStop(1, '#080206'); ctx.fillStyle = g; ctx.fillRect(x0 - 20, 0, sw + 40, VH);
      lsMaster(D2, x0 + sw / 2, L.closeY, L.close, now);   // a close-up: head and shoulders fill the panel, above the words
      const eye = Math.min(1, Math.max(0, (t2 - 300 - i * 50) / 120));   // the eyes snap open: a white line across the panel
      if (eye > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${0.9 * eye * (1 - Math.max(0, (t2 - 900) / 600))})`; ctx.fillRect(x0 - 20, L.eyeY, sw + 40, 3); ctx.restore(); }
      ctx.restore();
      ctx.save(); ctx.translate(0, off); ctx.strokeStyle = '#000'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0 + 18, 0); ctx.lineTo(x0 - 18, VH); ctx.stroke(); ctx.restore();
    });
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, VH * 0.62, VW, 70);
    const say1 = Math.min(1, Math.max(0, (t2 - 450) / 300)), at2 = L.cut, say2 = Math.min(1, Math.max(0, (t2 - at2) / 300));
    if (t2 < at2) lsWords(LSCENE_LINES[0], VW / 2, VH * 0.62 + 35, 34, say1, now);
    else { lsWords(LSCENE_LINES[1], VW / 2, VH * 0.62 + 35, 26, say2, now); }
    text('ALL FIVE DOJO MASTERS', VW / 2, VH * 0.62 + 8, '#ff9a8a', 6.5);
    const fade = (t2 - L.cut - L.say2) / L.out; if (fade > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fade)})`; ctx.fillRect(0, 0, VW, VH); }
  }
  const bars = Math.min(1, t / 250) * 26; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, bars); ctx.fillRect(0, VH - bars, VW, bars);   // letterbox
  text('Enter: skip', VW - 30, VH - 8, 'rgba(255,255,255,0.4)', 6);
}
