'use strict';
// THE CABINET: the summon happens inside a premium pachinko machine that fills the view. A faceted crystal frame with a crown
// and side gems wraps a huge screen, and a lacquered gold-rimmed console with lit glass dome buttons sits in front. Every part of the cabinet
// takes its light from the stage of the summon, so the frame is pre-rendered once per colour and cross-faded (cabLight).
const CAB = {
  cell: 26, seed: 7, gems: [78, 152, 226], gemW: 24, gemH: 40, leds: 15, sweepMs: 9,
  themes: {
    violet: { hue: n => 272 + n * 42, sat: 88, light: 1, col: '#b48aff' },
    green: { hue: n => 165 + n * 34, sat: 95, light: 1.05, col: '#4affc0' },
    red: { hue: n => 350 + n * 14, sat: 95, light: 1, col: '#ff3048' },
    gold: { hue: n => 42 + n * 12, sat: 95, light: 1.1, col: '#ffd23f' },
    rainbow: { hue: (n, x, y) => (x * 0.7 + y * 0.9 + n * 30 + 360) % 360, sat: 100, light: 1.1, col: '#ffffff' },
    dark: { hue: n => 262 + n * 20, sat: 50, light: 0.26, col: '#3a2a5a' },
  },
  tray: { top: 292, peak: 276 }, plate: { w: 236, y: 258, h: 28 },
  bake: {},
};
function cabBake(name) {
  if (CAB.bake[name]) return CAB.bake[name];
  const T = CAB.themes[name], S = PACHI.screen, c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const g = c.getContext('2d'), r = rng(CAB.seed); g.scale(2, 2);
  g.save(); g.beginPath(); g.rect(0, 0, VW, VH); g.roundRect(S.x, S.y, S.w, S.h, S.r); g.clip('evenodd');
  g.fillStyle = '#08040e'; g.fillRect(0, 0, VW, VH);
  const C = CAB.cell, pts = [];   // the facets: a jittered grid cut into triangles, each with its own light
  for (let j = 0; j <= Math.ceil(VH / C) + 1; j++) { pts[j] = []; for (let i = 0; i <= Math.ceil(VW / C) + 1; i++) pts[j][i] = [i * C + (r() - 0.5) * C * 0.7, j * C + (r() - 0.5) * C * 0.7]; }
  const tri = (a, b, d) => {
    const x = (a[0] + b[0] + d[0]) / 3, y = (a[1] + b[1] + d[1]) / 3, n = r() * 2 - 1, near = 1 - Math.min(1, Math.max(Math.abs(x - VW / 2) - S.w / 2, Math.abs(y - (S.y + S.h / 2)) - S.h / 2) / 70), l = (18 + r() * r() * 66 + near * 14) * T.light;
    g.fillStyle = `hsl(${T.hue(n, x, y)},${T.sat}%,${Math.min(96, l)}%)`; g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...d); g.closePath(); g.fill(); g.stroke();
  };
  for (let j = 0; j < pts.length - 1; j++) for (let i = 0; i < pts[j].length - 1; i++) { const a = pts[j][i], b = pts[j][i + 1], d = pts[j + 1][i], e = pts[j + 1][i + 1]; if ((i + j) % 2) { tri(a, b, d); tri(b, e, d); } else { tri(a, b, e); tri(a, e, d); } }
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 0.5;
  for (let k = 0; k < 90; k++) { g.beginPath(); g.moveTo(r() * VW, r() * VH); g.lineTo(r() * VW, r() * VH); if (k % 3 === 0) g.stroke(); }
  g.globalCompositeOperation = 'source-over';
  const gem = (cx, cy, w, h) => {   // a big cut gem
    const hu = T.hue(0.4, cx, cy), pts2 = [[cx, cy - h], [cx + w, cy], [cx, cy + h], [cx - w, cy]];
    g.fillStyle = `hsl(${hu},100%,${22 * T.light}%)`; g.beginPath(); pts2.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0] * 1.0, p[1])); g.closePath(); g.fill();
    pts2.forEach((p, i) => { const q = pts2[(i + 1) % 4]; g.fillStyle = `hsl(${(hu + i * 14) % 360},100%,${[78, 52, 34, 62][i] * T.light}%)`; g.beginPath(); g.moveTo(cx, cy); g.lineTo(...p); g.lineTo(...q); g.closePath(); g.fill(); });
    g.strokeStyle = '#fff6d8'; g.lineWidth = 1.5; g.beginPath(); pts2.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...p)); g.closePath(); g.stroke();
  };
  for (const y of CAB.gems) { gem(36, y, CAB.gemW, CAB.gemH); gem(VW - 36, y, CAB.gemW, CAB.gemH); }
  g.restore();
  // the chrome bezel and the crown, which drop over the top of the screen
  const bz = g.createLinearGradient(S.x, S.y, S.x + S.w, S.y + S.h); ['#ffffff', '#9aa4b8', '#f4f6fa', '#6a7488', '#ffffff'].forEach((s, i) => bz.addColorStop(i / 4, s));
  g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 9; g.beginPath(); g.roundRect(S.x - 2, S.y - 2, S.w + 4, S.h + 4, S.r + 2); g.stroke();
  g.strokeStyle = bz; g.lineWidth = 4.5; g.beginPath(); g.roundRect(S.x - 2, S.y - 2, S.w + 4, S.h + 4, S.r + 2); g.stroke();
  const cx = VW / 2, cg = g.createLinearGradient(0, 0, 0, 58); cg.addColorStop(0, '#fff6c8'); cg.addColorStop(0.5, `hsl(${T.hue(0, cx, 10)},100%,${60 * T.light}%)`); cg.addColorStop(1, `hsl(${T.hue(0.5, cx, 40)},100%,${30 * T.light}%)`);
  g.fillStyle = cg; g.strokeStyle = '#fff6d8'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 118, 0); g.lineTo(cx - 88, 22); g.lineTo(cx - 60, 8); g.lineTo(cx - 34, 30); g.lineTo(cx, 58); g.lineTo(cx + 34, 30); g.lineTo(cx + 60, 8); g.lineTo(cx + 88, 22); g.lineTo(cx + 118, 0); g.closePath(); g.fill(); g.stroke();
  gem(cx, 22, 15, 22);
  CAB.bake[name] = c; return c;
}
// which light the cabinet is in right now: { a, b, mix (how far from a to b), col }
function cabLight(m, now) {
  if (!m || !m.results) return { a: 'violet', b: 'gold', mix: 0.5 + 0.5 * Math.sin(now / 1800), col: '#c8a0ff' };
  const P = PACHI, k = m.pk, age = k.jacked ? m.t - k.jacked : -1;
  if (age >= 0) { if (age < P.blank) return { a: 'dark', b: 'dark', mix: 0, col: '#3a2a5a' }; return { a: 'rainbow', b: m.best >= P.bigFrom ? 'rainbow' : 'gold', mix: 0.5 + 0.5 * Math.sin(now / 200), col: `hsl(${(now / 3) % 360},100%,65%)` }; }
  if (m.t < P.start) return { a: 'dark', b: 'violet', mix: Math.min(1, m.t / P.start), col: '#b48aff' };
  if (m.reach && m.t > P.stops[2]) { const on = Math.floor(now / 110) % 2; return { a: 'green', b: 'red', mix: on * Math.min(1, (m.t - P.stops[2]) / 1600), col: on ? '#ff3048' : '#4affc0' }; }
  return { a: 'violet', b: 'green', mix: Math.min(1, Math.max(0, (m.t - P.start) / 900)), col: '#6ac8ff' };
}
function drawCabinetFrame(L, now) {
  const S = PACHI.screen, F = CASINO.fx, A = cabBake(L.a); ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(A, 0, 0, VW, VH); if (L.mix > 0 && L.b !== L.a) { ctx.globalAlpha = L.mix; ctx.drawImage(cabBake(L.b), 0, 0, VW, VH); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.roundRect(S.x - 5, S.y - 5, S.w + 10, S.h + 10, S.r + 4); ctx.clip('evenodd');
  ctx.globalCompositeOperation = 'lighter';
  const sx = ((now / CAB.sweepMs) % (VW + 400)) - 200, sw = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0); sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(0.5, 'rgba(255,255,255,0.4)'); sw.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sw; ctx.fillRect(0, 0, VW, VH);   // light running across the crystal
  ctx.globalCompositeOperation = 'source-over';
  for (const x of [14, VW - 14]) for (let i = 0; i < 22; i++) { const y = 10 + i * 12, on = (i + Math.floor(now / 70)) % 3 === 0; ctx.fillStyle = on ? L.col : 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < 9; i++) { const q = ((now / 900) + i * 0.37) % 1, x = (i * 2.399 % 1) * 0 + (i % 2 ? 36 + (i % 3) * 12 : VW - 36 - (i % 3) * 12), y = 30 + (i * 97) % 240; casinoFx(F.star8, F.white, x, y, 36 * Math.sin(q * Math.PI), q * 2, 1); }
}
// the console in front of the screen: black-violet lacquer with crystal facets catching the light, a gold rim along its curved
// top, a strip of lights under the rim chasing in the machine's colour, and the screen's
// light spilling down over it
function cabTrayCurve(T, y0, join) { ctx[join ? 'lineTo' : 'moveTo'](0, T.top + 6 + y0); ctx.quadraticCurveTo(VW * 0.28, T.top + 2 + y0, VW * 0.4, T.peak + 8 + y0); ctx.quadraticCurveTo(VW / 2, T.peak - 8 + y0, VW * 0.6, T.peak + 8 + y0); ctx.quadraticCurveTo(VW * 0.72, T.top + 2 + y0, VW, T.top + 6 + y0); }
function cabTrayY(T, x) {   // the height of the rim at x (the curve sampled, close enough for lights)
  const u = x / VW, seg = (p0, p1, p2, t) => (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  if (u < 0.4) return seg(T.top + 6, T.top + 2, T.peak + 8, u / 0.4); if (u < 0.6) return seg(T.peak + 8, T.peak - 8, T.peak + 8, (u - 0.4) / 0.2); return seg(T.peak + 8, T.top + 2, T.top + 6, (u - 0.6) / 0.4);
}
function drawCabinetTray(L, now) {
  const T = CAB.tray, shape = () => { ctx.beginPath(); ctx.moveTo(0, VH); cabTrayCurve(T, 0, true); ctx.lineTo(VW, VH); ctx.closePath(); };
  ctx.save(); const g = ctx.createLinearGradient(0, T.peak, 0, VH); g.addColorStop(0, '#3a1c58'); g.addColorStop(0.25, '#1a0c2a'); g.addColorStop(1, '#06030a'); ctx.fillStyle = g; shape(); ctx.fill();
  shape(); ctx.clip();
  const r = rng(91); ctx.globalCompositeOperation = 'lighter';   // crystal facets in the lacquer
  for (let i = 0; i < 26; i++) { const x = r() * VW, y = T.peak + r() * (VH - T.peak), w = 18 + r() * 40, k = (Math.sin(now / 1400 + i) + 1) / 2; ctx.fillStyle = hexA(L.col.startsWith('#') ? L.col : '#c8a0ff', 0.03 + 0.05 * k); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + w * 0.3); ctx.lineTo(x + w * 0.4, y + w * 0.7); ctx.closePath(); ctx.fill(); }
  const lit = ctx.createLinearGradient(0, T.peak, 0, T.peak + 70); lit.addColorStop(0, L.col); lit.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.32; ctx.fillStyle = lit; ctx.fillRect(0, T.peak, VW, 72); ctx.globalAlpha = 1;
  const sx = ((now / 7) % (VW + 300)) - 150, sw = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0); sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(0.5, 'rgba(255,255,255,0.1)'); sw.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sw; ctx.fillRect(0, T.peak, VW, VH - T.peak);   // a gleam running along it
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // the gold rim, then the lights under it
  const rim = ctx.createLinearGradient(0, 0, VW, 0); ['#8a4a08', '#fff0b8', '#c8861a', '#fff6c8', '#c8861a', '#fff0b8', '#8a4a08'].forEach((c, i) => rim.addColorStop(i / 6, c));
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6; ctx.beginPath(); cabTrayCurve(T, 1); ctx.stroke();
  ctx.strokeStyle = rim; ctx.lineWidth = 3.5; ctx.beginPath(); cabTrayCurve(T, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); cabTrayCurve(T, -1); ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 46; i++) {
    const x = 7 + i * (VW - 14) / 45, y = cabTrayY(T, x) + 7, on = (i + Math.floor(now / 80)) % 4 === 0, near = (i + Math.floor(now / 80)) % 4 === 1;
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const G = ctx.createRadialGradient(x, y, 0, x, y, 7); G.addColorStop(0, L.col); G.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.7; ctx.fillStyle = G; ctx.fillRect(x - 7, y - 7, 14, 14); ctx.restore(); }
    ctx.fillStyle = on ? '#ffffff' : near ? L.col : 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(x, y, on ? 1.8 : 1.3, 0, Math.PI * 2); ctx.fill();
  }
}
// a lit glass dome button. Returns nothing: GBTN decides the clicks
function cabDome(cx, cy, rx, ry, col, on, hov, now) {
  const F = CASINO.fx, press = hov ? 2 : 0;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.62, rx * 1.08, ry * 0.56, 0, 0, Math.PI * 2); ctx.fill();
  const ring = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0); ['#6a3606', '#fff0b8', '#c8861a', '#fff6c8', '#6a3606'].forEach((c, i) => ring.addColorStop(i / 4, c)); ctx.fillStyle = ring; ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.36, rx * 1.1, ry * 0.7, 0, 0, Math.PI * 2); ctx.fill();   // a gold socket
  ctx.fillStyle = '#0a0410'; ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.36, rx * 1.0, ry * 0.58, 0, 0, Math.PI * 2); ctx.fill();
  if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const G = ctx.createRadialGradient(cx, cy + ry * 0.4, 2, cx, cy + ry * 0.4, rx * 1.5); G.addColorStop(0, hexA(col.startsWith('#') ? col : '#ffffff', hov ? 0.5 : 0.3)); G.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = G; ctx.fillRect(cx - rx * 1.5, cy - ry, rx * 3, ry * 3); ctx.restore(); }   // its light on the console
  ctx.translate(0, press);
  const g = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.45, 2, cx, cy, rx * 1.05); if (on) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, '#10061c'); } else { g.addColorStop(0, '#8a8698'); g.addColorStop(1, '#16121e'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.ellipse(cx, cy, rx, ry * 0.62, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  if (on) { ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.ellipse(cx, cy, rx, ry * 0.62, 0, 0, Math.PI); ctx.closePath(); ctx.clip(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); casinoFx(F.twirl1, F.white, 0, 0, rx * 2.6, now / 300, hov ? 1 : 0.7); casinoFx(F.star9, F.gold, 0, 0, rx * 2.2 + 8 * Math.sin(now / 160), 0, 0.6); ctx.restore(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(cx - rx * 0.12, cy - ry * 0.3, rx * 0.62, ry * 0.42, -0.2, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
  ctx.restore();
}
function drawLogoPlate(str, now) {
  const P = CAB.plate, cx = VW / 2, y = P.y, w = P.w / 2, h = P.h, g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.18, '#c8861a'); g.addColorStop(1, '#2a0a30');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6 * RES; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - w + 16, y); ctx.lineTo(cx + w - 16, y); ctx.lineTo(cx + w, y + h / 2); ctx.lineTo(cx + w - 16, y + h); ctx.lineTo(cx - w + 16, y + h); ctx.lineTo(cx - w, y + h / 2); ctx.closePath(); ctx.fill(); ctx.restore();
  feverWord(str, cx, y + h / 2 - 1, 15, 9999, 0, true, now);
}
function ledPlate(x, y, w, h, value, now, sub) {
  const fx = x - 8, fy = y - 15, fw = w + 16, fh = h + (sub ? 34 : 22);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 5 * RES; ctx.fillStyle = '#12061c'; rrect(ctx, fx, fy, fw, fh, 7); ctx.fill(); ctx.restore();
  const gg = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh); gg.addColorStop(0, '#fff0b8'); gg.addColorStop(0.5, '#c8861a'); gg.addColorStop(1, '#fff0b8'); ctx.strokeStyle = gg; ctx.lineWidth = 1.8; rrect(ctx, fx, fy, fw, fh, 7); ctx.stroke();
  text('CREDITS', x + w / 2, fy + 7.5, '#ffe08a', 7);
  ctx.fillStyle = '#16040a'; rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.strokeStyle = 'rgba(255,80,90,0.5)'; ctx.lineWidth = 1; rrect(ctx, x, y, w, h, 4); ctx.stroke();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `15px ${FEVER.font}`; ctx.fillStyle = 'rgba(255,50,60,0.12)'; ctx.fillText('8888', x + w / 2, y + h / 2); ctx.shadowColor = '#ff3a4a'; ctx.shadowBlur = 4 * RES; ctx.fillStyle = '#ff4a5a'; ctx.fillText(String(value).padStart(4, '0'), x + w / 2, y + h / 2); ctx.restore();
  if (sub) text(sub, x + w / 2, y + h + 9, '#e8dcff', 7);
}
function clipScreen() { const S = PACHI.screen; ctx.beginPath(); ctx.roundRect(S.x, S.y, S.w, S.h, S.r); ctx.clip(); }
