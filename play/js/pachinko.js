'use strict';
// THE PACHINKO SUMMON: every summon plays out on the big screen of a premium machine (cabinet.js). In order: DARK, the best
// card as a black silhouette rimmed with light; REELS, three huge reels that always land on the best rank pulled, with a
// REACH (リーチ) from rank A up, the last reel crawling while the cabinet strobes; BLANK, the screen dies for a beat and you see
// the pins and glass; BURST, a rainbow explosion of crystal and a giant kanji; then FEVER, the card itself in huge close-up.
// The balls are simulated (pachinkoTick) and live on the menu as m.pk; the timing comes from PACHI.
const PACHI = {
  screen: { x: 74, y: 32, w: 492, h: 240, r: 14 }, field: { x: 74, y: 32, w: 492, h: 240 },
  pinDX: 30, pinDY: 24, pinTop: 44, pinR: 2, ball: 3.5, gravity: 640, bounce: 0.55, maxBalls: 150, spawn: 90,
  start: 1100, stops: [1900, 2900, 2400], reachStop: 4300, reachFrom: 5, spin: 0.018, ease: 260, reachEase: 1500, blank: 420, kanjiIn: 180,
  hold: 3000, holdBig: 3800, bigFrom: 6, floodFor: 900, reelW: 136, reelH: 196, reelGap: 14, shards: 70,
};
// what the machine calls your pull: [kanji, the word before FEVER]
const pachiTitle = best => best >= 9 ? ['神当たり', 'GOD'] : best >= 8 ? ['超大当たり', 'MEGA'] : best >= PACHI.bigFrom ? ['大当たり', 'SUPER'] : best >= PACHI.reachFrom ? ['大当たり', 'BIG'] : ['当たり', 'LUCKY'];
// THE FEVER SCREEN: the jackpot takes over the whole machine. Rainbow rays and chrome bars blast out from the centre, the
// best card you pulled stands huge in the middle, and giant 3D block letters slam in one by one in front of it: gold for a
// LUCKY FEVER, rainbow from BIG up. The lettering is Dela Gothic One (free, SIL Open Font License, assets/DelaGothicOne.ttf).
const FEVER = { in: 1500, font: '"Dela Gothic One", Impact, sans-serif', cy: 138, rays: 28, bars: 26, sparks: 26, word: 62, kanji: 40, wordY: 232, kanjiY: 60, bigKanji: 104, pop: 170, gap: 55, depth: 12, maxW: 600, rainbowFrom: 5, art: 236 };
try { const f = new FontFace('Dela Gothic One', 'url(assets/DelaGothicOne.ttf)'); f.load().then(x => document.fonts.add(x)).catch(() => {}); } catch (e) {}
const PACHI_PINS = (() => {
  const P = PACHI, F = P.field, rows = [];
  for (let r = 0, y = P.pinTop; y < F.y + F.h - 8; r++, y += P.pinDY) { const row = []; for (let x = F.x + 12 + (r % 2 ? P.pinDX / 2 : 0); x < F.x + F.w - 8; x += P.pinDX) row.push({ x, y }); rows.push(row); }
  return rows;
})();
function pachinkoStart(m) {
  const P = PACHI; m.reelCards = null; m.reach = m.best >= P.reachFrom; m.jack = m.reach ? P.reachStop : P.stops[1];
  m.intro = m.jack + (m.best >= P.bigFrom ? P.holdBig : P.hold);
  m.pk = { balls: [], spawn: 0, jacked: 0, ticked: -99 };
}
// where a reel is on its strip at time t: it runs at a steady speed, eases off, and lands exactly on the rank pulled
function pachiReel(m, i, t) {
  const P = PACHI, last = i === 1 && m.reach, T = last ? P.reachStop : P.stops[i], D = last ? P.reachEase : P.ease, r = T - Math.max(t, P.start);
  return m.best - (r <= 0 ? 0 : r < D ? P.spin * r * r / (2 * D) : P.spin * D / 2 + P.spin * (r - D));
}
// the cards the three reels land on: a single pull's card on all three, else the three best pulled (best in the middle)
function pachiTargets(m) {
  if (m.reelCards) return m.reelCards;
  const R = (m.results || []).slice().sort((a, b) => b.tier - a.tier), c0 = R[0] || { sp: SPECIES_IDS[0], tier: m.best || 0 };
  return (m.reelCards = R.length < 3 ? [c0, c0, c0] : [R[1], R[0], R[2]]);
}
function pachiBall(k, x, y, vx, vy) { if (k.balls.length < PACHI.maxBalls) k.balls.push({ x, y, vx, vy }); }
function pachinkoTick(m, dt) {
  const P = PACHI, k = m.pk, F = P.field, was = m.t - dt, pass = at => was < at && m.t >= at, snd = typeof SFX !== 'undefined' ? SFX : null, s = Math.min(dt, 33) / 1000;
  for (const st of P.stops) if (pass(m.reach && st === P.stops[1] ? P.reachStop : st) && snd) snd.reelStop();
  if (pass(P.stops[2]) && m.reach && snd) snd.reach();
  if (m.t >= P.start && m.t < m.jack && snd) { const p = Math.floor(pachiReel(m, 1, m.t)); if (p !== k.ticked) { k.ticked = p; snd.reelTick(); } }
  if (m.t >= m.jack && !k.jacked) k.jacked = m.jack;
  if (pass(m.jack + P.blank) && snd) snd.jackpot(m.best >= P.bigFrom);
  const flooding = k.jacked && m.t < m.intro + P.floodFor;   // the balls: a few in the blank beat, then the flood
  k.spawn -= dt;
  if (k.spawn <= 0 && flooding) {
    const big = m.t > m.jack + P.blank; k.spawn = big ? P.spawn / 3 : P.spawn;
    for (let i = 0, n = big ? 2 + Math.floor(m.best / 3) : 1; i < n; i++) pachiBall(k, F.x + 14 + Math.random() * (F.w - 28), F.y + 4, rand(-40, 40), rand(0, 60));
  }
  for (const b of k.balls) {
    b.vy += P.gravity * s; b.x += b.vx * s; b.y += b.vy * s;
    if (b.x < F.x + 6) { b.x = F.x + 6; b.vx = Math.abs(b.vx) * P.bounce; } else if (b.x > F.x + F.w - 6) { b.x = F.x + F.w - 6; b.vx = -Math.abs(b.vx) * P.bounce; }
    const row = PACHI_PINS[Math.round((b.y - P.pinTop) / P.pinDY)] || [], reach = P.ball + P.pinR;
    for (const q of row) {
      const dx = b.x - q.x, dy = b.y - q.y, d = Math.hypot(dx, dy); if (d >= reach || d === 0) continue;
      const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny; b.x = q.x + nx * reach; b.y = q.y + ny * reach;
      if (vn < 0) { b.vx -= (1 + P.bounce) * vn * nx; b.vy -= (1 + P.bounce) * vn * ny; b.vx += rand(-14, 14); if (snd) snd.pin(); }
    }
    if (b.y > F.y + F.h) b.gone = true;
  }
  k.balls = k.balls.filter(b => !b.gone);
}
// a silver ball, drawn once and stamped
const pachiBallArt = (() => { let c = null; return () => {
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'), rg = g.createRadialGradient(6, 5, 0.6, 8, 8, 8);
  rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, '#d8dee8'); rg.addColorStop(0.75, '#7c8698'); rg.addColorStop(1, '#2a303c');
  g.fillStyle = rg; g.beginPath(); g.arc(8, 8, 7.6, 0, Math.PI * 2); g.fill(); return c;
}; })();
// the camera: leans in on the REACH, slams on the burst, shakes, and settles for the FEVER
function pachinkoCamera(m, now) {
  const P = PACHI, k = m.pk, age = k.jacked ? m.t - k.jacked - P.blank : -9999, reach = m.reach && !k.jacked ? Math.min(1, Math.max(0, (m.t - P.stops[2]) / 900)) : 0, z = age >= 0 ? 1 + 0.12 * Math.max(0, 1 - age / 300) : 1 + 0.07 * reach;
  const amp = age < 0 ? reach * 1.2 : (m.best >= P.bigFrom ? 11 : 7) * Math.max(0, 1 - age / 1000), cx = VW / 2, cy = VH * 0.42;
  ctx.translate(cx + Math.sin(now / 23) * amp, cy + Math.cos(now / 19) * amp); ctx.scale(z, z); ctx.translate(-cx, -cy);
}
function drawPachinko(game, m, now) {
  const P = PACHI, S = P.screen, k = m.pk, age = k.jacked ? m.t - k.jacked : -1, hit = age >= 0, L = cabLight(m, now), burst = age - P.blank, pr = game.profile;
  ctx.fillStyle = '#08040e'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); clipScreen();
  if (!hit && m.t < P.start) drawSilhouette(m, now, m.t / P.start, 1);
  else if (!hit) drawBigReels(m, now);
  else if (burst < 0) drawBlankBoard(m, now);
  else if (age < FEVER.in) drawBurst(m, now, burst);
  else drawFeverScreen(m, now, age);
  ctx.restore();
  drawCabinetFrame(L, now);
  drawCabinetTray(L, now);
  if (!(hit && age >= P.blank)) drawLogoPlate('SUMMONING SHRINE', now);
  summonTokens(pr.coins || 0, now, true);
  ledPlate(420, 312, 86, 24, pr.coins || 0, now);
  if (m.reach && !hit && m.t > P.stops[2]) { const s = 1 + 0.07 * Math.sin(now / 60); ctx.save(); ctx.translate(VW / 2, 56); ctx.scale(s, s); feverWord('リーチ!', 0, 0, 34, 9999, 0, true, now); ctx.restore(); }
  if (hit && burst >= 0) drawJackpotWords(m, now, age, burst);
  if (hit && burst >= 0 && burst < 240) { ctx.fillStyle = `rgba(255,255,255,${1 - burst / 240})`; ctx.fillRect(-20, -20, VW + 40, VH + 40); }
  if (m.t < m.intro) text('Click to skip', 92, VH - 16, `rgba(255,255,255,${0.6 + 0.3 * Math.sin(now / 250)})`, 8);
}
// DARK: the best card as a black shape, rimmed with light, swelling toward you
function drawSilhouette(m, now, q, a) {
  const S = PACHI.screen, cx = VW / 2, cy = S.y + S.h / 2 + 6, c = m.results.find(x => x.tier === m.best) || m.results[0], D = 250 + q * 60, F = CASINO.fx, pulse = 0.7 + 0.3 * Math.sin(now / 120);
  const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 300); bg.addColorStop(0, '#3a1a70'); bg.addColorStop(1, '#06030e'); ctx.fillStyle = bg; ctx.fillRect(S.x, S.y, S.w, S.h);
  casinoFx(F.star9, F.violet, cx, cy, D * 1.5, now / 2400, pulse); drawMagicCircle(cx, cy, 104, now / 700, 0.5 * a, false);
  ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha *= a; ctx.filter = `brightness(0) drop-shadow(0 0 2px #e0d0ff) drop-shadow(0 0 7px rgba(150,90,255,${pulse}))`; monsterPreview(c.sp, -D / 2, -D / 2, D, D, c.tier, now, 'idle', 3); ctx.restore();
  for (let i = 0; i < 26; i++) { const t = ((now / 900) + i * 0.137) % 1, x = S.x + (i * 151) % S.w; ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8; ctx.fillStyle = i % 3 ? '#c8a0ff' : '#ffffff'; ctx.fillRect(x, S.y + S.h - t * S.h, 1.8, 7); } ctx.globalAlpha = 1;
}
// REELS: three huge drums filling the screen, with speed behind them
function drawBigReels(m, now) {
  const P = PACHI, S = P.screen, cy = S.y + S.h / 2 + 8, x0 = VW / 2 - (P.reelW * 3 + P.reelGap * 2) / 2, reaching = m.reach && m.t > P.stops[2], red = reaching && Math.floor(now / 110) % 2;
  const bg = ctx.createRadialGradient(VW / 2, cy, 40, VW / 2, cy, 320); bg.addColorStop(0, reaching ? (red ? '#c01830' : '#0ca078') : '#2a2a90'); bg.addColorStop(1, '#040410'); ctx.fillStyle = bg; ctx.fillRect(S.x, S.y, S.w, S.h);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = reaching ? (red ? 'rgba(255,90,110,0.16)' : 'rgba(90,255,200,0.16)') : 'rgba(120,150,255,0.13)'; for (let i = 0, n = 20, sp = now / (reaching ? 240 : 800); i < n; i++) { const a0 = sp + i / n * Math.PI * 2, w = 0.1; ctx.beginPath(); ctx.moveTo(VW / 2, cy); ctx.lineTo(VW / 2 + Math.cos(a0 - w) * 460, cy + Math.sin(a0 - w) * 460); ctx.lineTo(VW / 2 + Math.cos(a0 + w) * 460, cy + Math.sin(a0 + w) * 460); ctx.fill(); } ctx.restore();
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * (P.reelW + P.reelGap), y = cy - P.reelH / 2, pos = pachiReel(m, i, m.t), stopped = m.t >= (i === 1 && m.reach ? P.reachStop : P.stops[i]);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8 * RES; ctx.fillStyle = '#c8d0de'; rrect(ctx, x - 3, y - 3, P.reelW + 6, P.reelH + 6, 9); ctx.fill(); ctx.restore();
    const bg2 = ctx.createLinearGradient(0, y, 0, y + P.reelH); bg2.addColorStop(0, '#6a6e7c'); bg2.addColorStop(0.5, '#ffffff'); bg2.addColorStop(1, '#6a6e7c');
    ctx.save(); ctx.fillStyle = bg2; rrect(ctx, x, y, P.reelW, P.reelH, 7); ctx.fill(); rrect(ctx, x, y, P.reelW, P.reelH, 7); ctx.clip();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    // (2026-11-20, the user: "its the same 3 slots regardless of card obtained": the reels showed rank letters and always landed on three of
    // the same; now each spins through monster cards and lands on a card you really pulled: a single summon's card on all three,
    // a x10's three best. Its rank shows under the reel once it stops.)
    const tgt = pachiTargets(m)[i];
    for (let n = Math.floor(pos) - 1; n <= Math.floor(pos) + 2; n++) {
      const sy = cy + (pos - n) * P.reelH * 0.74; if (Math.abs(sy - cy) > P.reelH) continue;
      const land = n === Math.round(m.best), sp = land ? tgt.sp : SPECIES_IDS[Math.abs((n * 7919 + i * 104729) % SPECIES_IDS.length)], A = P.reelW - 22;
      ctx.save(); monsterPreview(sp, x + 11, sy - A / 2, A, A, land ? tgt.tier : 0, now, 'idle', 3); ctx.restore();
      if (!stopped && (i !== 1 || !m.reach || m.t < P.reachStop - P.reachEase)) { ctx.fillStyle = 'rgba(240,244,250,0.5)'; ctx.fillRect(x, sy - A / 2, P.reelW, A); }
    }
    if (stopped) { const str = RANKS[tgt.tier], sz = 22; ctx.font = `${sz}px ${FEVER.font}`; ctx.strokeStyle = '#10040c'; ctx.lineWidth = sz * 0.16; ctx.strokeText(str, x + P.reelW / 2, y + P.reelH - 18); ctx.fillStyle = rankColor(tgt.tier, now); ctx.fillText(str, x + P.reelW / 2, y + P.reelH - 18); }
    const drum = ctx.createLinearGradient(0, y, 0, y + P.reelH); drum.addColorStop(0, 'rgba(0,0,0,0.8)'); drum.addColorStop(0.26, 'rgba(0,0,0,0)'); drum.addColorStop(0.74, 'rgba(0,0,0,0)'); drum.addColorStop(1, 'rgba(0,0,0,0.8)'); ctx.fillStyle = drum; ctx.fillRect(x, y, P.reelW, P.reelH);
    ctx.restore();
    if (stopped) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; rrect(ctx, x, y, P.reelW, P.reelH, 7); ctx.stroke(); }
    if (reaching && i === 1) { ctx.strokeStyle = red ? '#ffffff' : '#ff2030'; ctx.lineWidth = 4; rrect(ctx, x - 2, y - 2, P.reelW + 4, P.reelH + 4, 8); ctx.stroke(); }
  }
}
// BLANK: the picture dies. For a beat you are looking at the board itself through the glass
function drawBlankBoard(m, now) {
  const P = PACHI, S = P.screen, im = img(CASINO.hall); ctx.fillStyle = '#04030a'; ctx.fillRect(S.x, S.y, S.w, S.h);
  if (im && im.complete && im.naturalWidth) { ctx.globalAlpha = 0.28; ctx.drawImage(im, S.x, S.y, S.w, S.h); ctx.globalAlpha = 1; }   // the room reflected in the glass
  for (const row of PACHI_PINS) for (const q of row) { ctx.fillStyle = '#b8862a'; ctx.beginPath(); ctx.arc(q.x, q.y, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff0b8'; ctx.beginPath(); ctx.arc(q.x - 0.5, q.y - 0.5, 0.7, 0, Math.PI * 2); ctx.fill(); }
  const art = pachiBallArt(), r = P.ball; for (const b of m.pk.balls) ctx.drawImage(art, b.x - r, b.y - r, r * 2, r * 2);
}
function feverRays(cx, cy, now, n, light) {
  for (let i = 0; i < n; i++) { const a0 = now / 1100 + i / n * Math.PI * 2, w = Math.PI / n * (i % 2 ? 0.7 : 1.2), R = 520; ctx.fillStyle = `hsl(${(i * 47 + now / 6) % 360},100%,${(i % 2 ? 62 : 48) * light}%)`; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0 - w) * R, cy + Math.sin(a0 - w) * R); ctx.lineTo(cx + Math.cos(a0 + w) * R, cy + Math.sin(a0 + w) * R); ctx.fill(); }
}
// BURST: crystal shards of every colour exploding out of the screen
function drawBurst(m, now, burst) {
  const P = PACHI, S = P.screen, V = FEVER, cx = VW / 2, cy = S.y + S.h / 2, F = CASINO.fx, r = rng(11), q = Math.min(1, burst / 700), e = 1 - Math.pow(1 - q, 3);
  ctx.fillStyle = '#2a0a5a'; ctx.fillRect(S.x, S.y, S.w, S.h); feverRays(cx, cy, now, V.rays, 0.9);
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260); glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(0.5, 'rgba(255,250,220,0.6)'); glow.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = glow; ctx.fillRect(S.x, S.y, S.w, S.h);
  for (let i = 0; i < P.shards; i++) { const an = r() * Math.PI * 2, d = 30 + e * (120 + r() * 340), s = 8 + r() * 30, rot = an + r() * 6 + now / 300, x = cx + Math.cos(an) * d, y = cy + Math.sin(an) * d * 0.75; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = `hsl(${(i * 37 + now / 5) % 360},100%,${55 + r() * 30}%)`; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.55, 0); ctx.lineTo(0, s * 0.8); ctx.lineTo(-s * 0.55, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  casinoFx(F.star9, F.white, cx, cy, 420 * e + 100, now / 800, 1 - q * 0.6); casinoFx(F.ring, F.white, cx, cy, 700 * e, 0, 1 - q);
}
// FEVER: the card itself, huge and bright, in the wheel of light
function drawFeverScreen(m, now, age) {
  const V = FEVER, S = PACHI.screen, t = age - V.in, cx = VW / 2, cy = V.cy, c = m.results.find(x => x.tier === m.best) || m.results[0];
  ctx.fillStyle = '#3a0a5a'; ctx.fillRect(S.x, S.y, S.w, S.h); feverRays(cx, cy, now, V.rays, 1);
  const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 200); glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(0.45, 'rgba(255,245,200,0.85)'); glow.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = glow; ctx.fillRect(S.x, S.y, S.w, S.h);
  for (let i = 0; i < V.bars; i++) {   // chrome bars blasting outward
    const q = ((now / 700) + i * 0.137) % 1, an = i * 2.39996, d = 40 + q * q * 420, len = 16 + q * 46, th = 2 + q * 5, x0 = cx + Math.cos(an) * d, y0 = cy + Math.sin(an) * d, x1 = cx + Math.cos(an) * (d + len), y1 = cy + Math.sin(an) * (d + len);
    ctx.lineCap = 'round'; ctx.strokeStyle = '#3a4252'; ctx.lineWidth = th + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const g = ctx.createLinearGradient(x0 - th, y0 - th, x0 + th, y0 + th); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#aab4c6'); g.addColorStop(1, '#f0f4fa'); ctx.strokeStyle = g; ctx.lineWidth = th; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  drawMagicCircle(cx, cy, 122, now / 400, 1, true, false);
  const art = pachiBallArt(); m.pk.balls.forEach((b, i) => { if (i % 3) ctx.drawImage(art, b.x - 4, b.y - 4, 8, 8); else casinoCoin(b.x, b.y, 15, now + i * 41); });   // balls and gold coins pouring down
  const pop = Math.min(1, t / 240), e = 1 - Math.pow(1 - pop, 3), sc = (1.9 - 0.9 * e) * (1 + 0.035 * Math.sin(now / 90)), D = V.art;
  ctx.save(); ctx.translate(cx, cy + 6); ctx.scale(sc, sc); monsterPreview(c.sp, -D / 2, -D / 2, D, D, c.tier, now, 'idle', 3); ctx.restore();
  for (let i = 0; i < V.sparks; i++) { const q = ((now / 520) + i * 0.29) % 1; casinoFx(CASINO.fx.star7, CASINO.fx.white, S.x + (i * 151.7) % S.w, S.y + (i * 97.3) % S.h, 44 * Math.sin(q * Math.PI), q, 1); }
}
// the words sit in front of the frame, so they burst out of the screen
function drawJackpotWords(m, now, age, burst) {
  const V = FEVER, P = PACHI, cx = VW / 2, cy = P.screen.y + P.screen.h / 2, [kanji, word] = pachiTitle(m.best), rainbow = m.best >= V.rainbowFrom, fade = Math.min(1, (m.intro + 200 - m.t) / 250);
  ctx.save(); ctx.globalAlpha = Math.max(0, fade);
  if (age < V.in) {   // the kanji fills the screen, gold and enormous
    ctx.font = `${V.bigKanji}px ${V.font}`; const fit = Math.min(1, 500 / ctx.measureText(kanji).width), hb = burst - P.kanjiIn; if (hb > 0) feverWord(kanji, cx, cy, V.bigKanji * fit, hb * 1.6, 0, false, now);
  } else {
    const t = age - V.in; ctx.font = `${V.word}px ${V.font}`;
    const w1 = ctx.measureText(word).width, w2 = ctx.measureText('FEVER').width, gap = V.word * 0.35, fit = Math.min(1, V.maxW / (w1 + w2 + gap)), size = V.word * fit, total = (w1 + w2 + gap) * fit;
    feverWord(kanji, cx, V.kanjiY, V.kanji, 9999, 0, rainbow, now);
    feverWord(word, cx - total / 2 + w1 * fit / 2, V.wordY, size, t - 120, -0.08, rainbow, now);
    feverWord('FEVER', cx + total / 2 - w2 * fit / 2, V.wordY - 4, size * 1.08, t - 120 - word.length * V.gap, 0.05, rainbow, now);
  }
  ctx.restore();
}
// one word of giant 3D block letters, each slamming in after the last: a dark outline, gold sides, then the bright face
function feverWord(str, x, y, size, t, tilt, rainbow, now) {
  const V = FEVER, D = V.depth * size / V.word, chars = [...str];
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.font = `${size}px ${V.font}`;
  const widths = chars.map(ch => ctx.measureText(ch).width), W = widths.reduce((a, b) => a + b, 0); let lx = -W / 2;
  chars.forEach((ch, i) => {
    const w = widths[i], at = lx + w / 2; lx += w;
    const p = Math.min(1, (t - i * V.gap) / V.pop); if (p <= 0) return;
    const e = 1 - Math.pow(1 - p, 3), u = (at / (W / 2 || 1)), sc = (2.6 - 1.6 * e) * (1 + Math.abs(u) * 0.12), bob = Math.sin(now / 130 + i * 0.9) * 1.6 + Math.abs(u) * -5;
    ctx.save(); ctx.translate(at, bob); ctx.rotate(u * 0.05); ctx.scale(sc, sc); ctx.globalAlpha *= Math.min(1, p * 2);
    ctx.strokeStyle = '#10040c'; ctx.lineWidth = size * 0.11; ctx.strokeText(ch, D * 0.6, D);
    for (let d = D; d >= 1; d -= 1) { ctx.fillStyle = `hsl(${36 + (d / D) * 8},100%,${58 - (d / D) * 40}%)`; ctx.fillText(ch, d * 0.6, d); }
    const g = ctx.createLinearGradient(-w / 2, -size / 2, w / 2, size / 2);
    if (rainbow) for (let n = 0; n <= 6; n++) g.addColorStop(n / 6, `hsl(${(now / 5 + i * 34 + n * 58) % 360},100%,58%)`);
    else { g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffc21f'); g.addColorStop(1, '#ff8a10'); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = size * 0.05; ctx.strokeText(ch, 0, 0); ctx.fillStyle = g; ctx.fillText(ch, 0, 0);
    const gloss = ctx.createLinearGradient(0, -size / 2, 0, size * 0.05); gloss.addColorStop(0, 'rgba(255,255,255,0.75)'); gloss.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gloss; ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}
