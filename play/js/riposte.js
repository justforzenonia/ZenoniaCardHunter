'use strict';
// RIPOSTE: a perfect parry (combat.js) or a perfect dodge (guard.js) opens the counter window; press attack in it and,
// instead of a plain swing (or a Shield Bash while still guarding), your class answers with its own riposte:
//   melee     a lunging cleave that launches whatever it hits        fist      a four-blow flurry, the last one lifting
//   archer    three piercing arrows fanned out at point blank        mage      a blink back that leaves a blast where you stood
//   summoner  a shockwave all round you, flinging foes away
// All in your Layer's colour, called out on screen as PAYBACK! (the user's name for it). One per window.
const RIPOSTE = {
  melee: { mul: 2.2, r: 26, reach: 20, lunge: 18, launch: 220 }, fist: { mul: 0.75, n: 4, gap: 70, r: 20, reach: 14 },
  archer: { mul: 1.4, n: 3, fan: 0.2, speed: 360 }, mage: { mul: 2.0, r: 40, blink: 30 }, summoner: { mul: 1.8, r: 36, push: 180 },
};
function riposte(world, a) {
  a.counterT = 0;   // (the window is spent: the counter bonus, guard.js, does not stack on it)
  const st = RIPOSTE[a.style] ? a.style : 'melee', R = RIPOSTE[st], [dx, dy] = DV[a.dir], L = heroLayer(a) || LAYER_ELS.holy, base = a.atk;
  floatText(world, a.x, a.y - 54, 'PAYBACK!', L.mote, 10);
  world.hitStop = Math.max(world.hitStop || 0, 60); world.shake = Math.max(world.shake || 0, 1.5);   // (a small bump: a calm game)
  if (st === 'melee') {
    moveBy(world, a, dx * R.lunge, dy * R.lunge);
    strike(world, a, a.x + dx * R.reach, a.y + dy * R.reach, R.r, 0, { base: base * R.mul, melee: true, launch: R.launch, pop: 170, push: 80 });
    world.rings.push({ x: a.x + dx * R.reach, y: a.y - 10, r: R.r, t: 0, col: L.bloom });
    if (typeof SFX !== 'undefined') SFX.swing(true);
  } else if (st === 'fist') {
    for (let i = 0; i < R.n; i++) {
      const last = i === R.n - 1;
      world.timers.push({ t: i * R.gap, fn: () => { if (a.dead) return; const [ex, ey] = DV[a.dir];
        strike(world, a, a.x + ex * R.reach, a.y + ey * R.reach, R.r, 0, { base: base * R.mul * (last ? 1.6 : 1), melee: true, fist: true, launch: last ? 240 : 0, pop: last ? 180 : 90, push: last ? 60 : 10 });
        world.rings.push({ x: a.x + ex * R.reach, y: a.y - 12, r: 10 + i * 3, t: 0, col: last ? '#ffffff' : L.bloom }); if (typeof SFX !== 'undefined') SFX.swing(last); } });
    }
  } else if (st === 'archer') {
    const ang = Math.atan2(dy, dx);
    for (let i = 0; i < R.n; i++) {
      const g = ang + (i - (R.n - 1) / 2) * R.fan;
      world.projs.push({ owner: a, team: a.team, x: a.x + Math.cos(g) * 10, y: a.y, z: 14, vx: Math.cos(g) * R.speed, vy: Math.sin(g) * R.speed,
        life: 520, r: 9, opts: { base: base * R.mul, pop: 120, push: 50 }, hit: new Set(), sp: null, el: null, t: 0, pierce: true, arrow: true });
    }
    if (typeof SFX !== 'undefined') SFX.bow(true);
  } else if (st === 'mage') {
    const x0 = a.x, y0 = a.y; moveBy(world, a, -dx * R.blink, -dy * R.blink);
    strike(world, a, x0, y0, R.r, 0, { base: base * R.mul, spell: true, el: L.dmg, launch: 180, pop: 150, push: 90 });
    world.rings.push({ x: x0, y: y0, r: R.r, t: 0, col: L.bloom }, { x: x0, y: y0, r: R.r * 0.5, t: -60, col: '#ffffff' });
    for (let i = 0; i < 6; i++) a.trail && a.trail.push({ x: x0 + (a.x - x0) * i / 6, y: y0 + (a.y - y0) * i / 6, t: 0 });
    if (typeof SFX !== 'undefined') SFX.cast(true);
  } else {   // summoner
    strike(world, a, a.x, a.y, R.r, 0, { base: base * R.mul, spell: true, el: L.dmg, push: R.push, pop: 120 });
    world.rings.push({ x: a.x, y: a.y - 8, r: R.r, t: 0, col: L.bloom }, { x: a.x, y: a.y - 8, r: R.r * 1.4, t: -80, col: L.inner });
    if (typeof SFX !== 'undefined') SFX.burst();
  }
  if (window.GAME && GAME.world === world && a.netGid && typeof netStatTo === 'function') netStatTo(GAME, a.netGid, 'ripostes');   // (a co-op friend's Payback counts on their save)
  if (window.GAME && GAME.world === world && a === world.player) { const pr = GAME.profile; pr.stats = pr.stats || {}; pr.stats.ripostes = (pr.stats.ripostes || 0) + 1; if (typeof cuePlay === 'function') cuePlay([659, 784]); }   // (a soft two-note music-box chime under the hit, cues.js)
}
// the attack press in the window (combat.js playerFree), and while still guarding in place of the Shield Bash (guard.js)
{
  const pf = playerFree;
  playerFree = (world, a, dt, input) => {
    if (input && input.atk && a.counterT > 0 && a.kind === 'player') { riposte(world, a); return; }
    return pf(world, a, dt, input);
  };
  const gb = guardBash;
  guardBash = (world, a) => (a.counterT > 0 ? (riposte(world, a), true) : gb(world, a));
}
// a perfect parry opens the window too (as a perfect dodge does: guard.js)
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const parry = att && def && att !== def && def.kind === 'player' && def.state === 'block' && def.blockT < guardPerfect(def) && opts && !opts.reflected;
    const r = dd(world, att, def, opts);
    if (parry && !def.dead) def.counterT = Math.max(def.counterT || 0, GDODGE.counter);
    return r;
  };
}
// PAYBACK! on screen: a hit card in the summon machine's 3D lettering (pachinko.js feverWord), made for a fight. Each letter
// slams in a beat after the last, oversized, squashes as it lands and settles, extruded deep with a fiery face, a white
// gloss and the Layer's colour as its outline glow. Under it a shockwave ring and radial speed lines burst out, the camera
// jolts, and at the end the word swells and bursts upward into sparks. The float is still made (so a co-op friend's game,
// which rebuilds relayed floats through floatText, draws the same card: world.js skips drawing it as text).
// Kept small and brief on purpose: this is a calm game to play before bed (the user's words), so it pops, it doesn't take
// over the screen: no camera jolt, no speed lines, one faint ring.
const PAYBACK_FX = { ms: 900, size: 16, gap: 30, pop: 140, depth: 3, out: 240, font: '"Fredoka", "Dela Gothic One", sans-serif' };   // (the cozy round font, 2026-11-06)
{
  const ft = floatText;
  floatText = (world, x, y, str, col, size) => {
    if (str === 'PAYBACK!') (world.paybacks = world.paybacks || []).push({ x, y, t0: performance.now(), col: col || '#ffd27a' });
    return ft(world, x, y, str, col, size);
  };
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => { const r = tf(game, now); drawPaybacks(game, now); return r; };
}
// one letter of the word: extruded, a fiery face, white gloss, the Layer's glow round its outline
function paybackLetter(ch, size, w, D, col) {
  ctx.strokeStyle = '#12020a'; ctx.lineWidth = size * 0.16; ctx.strokeText(ch, D * 0.7, D);
  for (let d = D; d >= 1; d -= 1) { ctx.fillStyle = `hsl(${14 + (d / D) * 12},100%,${46 - (d / D) * 30}%)`; ctx.fillText(ch, d * 0.7, d); }   // (the depth: ember red going dark)
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 2 * RES; ctx.strokeStyle = mixCol(col, '#3a1206', 0.45); ctx.lineWidth = size * 0.09; ctx.strokeText(ch, 0, 0); ctx.restore();   // (a soft rim, no white: less glare)
  ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = size * 0.03; ctx.strokeText(ch, 0, 0);   // (a thin warm edge: a little glare)
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#f5b52a'); g.addColorStop(1, '#e0601c');
  ctx.fillStyle = g; ctx.fillText(ch, 0, 0);
  const gloss = ctx.createLinearGradient(0, -size / 2, 0, 0); gloss.addColorStop(0, 'rgba(255,255,255,0.45)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss; ctx.fillText(ch, 0, 0);
}
function drawPaybacks(game, now) {
  const w = game.world, F = PAYBACK_FX; if (!w || !w.paybacks || !w.paybacks.length || !w.cam || game.scene !== 'world') return;
  const Z = w.zoom || ZOOM;
  w.paybacks = w.paybacks.filter(P => now - P.t0 < F.ms);
  for (const P of w.paybacks) {
    const t = now - P.t0, sx = (P.x - w.cam.x) * Z, sy = Math.max(40, (P.y - w.cam.y) * Z - 8 - 6 * (t / F.ms)), out = Math.max(0, (t - (F.ms - F.out)) / F.out);
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (t < 300) {   // one faint ring opening out as it appears
      const k = t / 300, e = 1 - Math.pow(1 - k, 3);
      ctx.globalAlpha = (1 - out) * (1 - k) * 0.45; ctx.strokeStyle = P.col; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 14 + e * 40, 7 + e * 18, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (out > 0) {   // a few small sparks drifting up as it fades
      ctx.globalAlpha = (1 - out) * 0.8;
      for (let i = 0; i < 8; i++) { const px = sx + (i / 7 - 0.5) * 70, py = sy - 4 - out * (14 + (i % 3) * 8); ctx.fillStyle = i % 2 ? '#ffd23f' : P.col; ctx.fillRect(px - 1, py - 1, 2, 2); }
    }
    ctx.restore();
    // the word: letters popping in one after another, a little squash as each lands
    ctx.translate(sx, sy); ctx.rotate(-0.04); const swell = 1 + out * 0.08; ctx.scale(swell, swell);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.font = `700 ${F.size}px ${F.font}`;
    const chars = [...'PAYBACK!'], widths = chars.map(ch => ctx.measureText(ch).width), W = widths.reduce((a, b) => a + b, 0) * 0.92;
    let lx = -W / 2;
    chars.forEach((ch, i) => {
      const cw = widths[i] * 0.92, at = lx + cw / 2; lx += cw;
      const p = Math.min(1, (t - i * F.gap) / F.pop); if (p <= 0) return;
      const e = 1 - Math.pow(1 - p, 3), land = p > 0.75 ? Math.sin((p - 0.75) / 0.25 * Math.PI) : 0;   // (eases in, then a little squash as it lands)
      const sc = 1.5 - 0.5 * e, drop = (1 - e) * -8;
      ctx.save(); ctx.translate(at, drop); ctx.scale(sc * (1 + land * 0.08), sc * (1 - land * 0.07));
      ctx.globalAlpha *= Math.min(1, p * 2.5);
      paybackLetter(ch, F.size, cw, F.depth, P.col);
      ctx.restore();
    });
    // one gentle shine across the letters once they are down (faint: a little glare)
    const sweep = (t - 420) / 300;
    if (sweep > 0 && sweep < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const x = -W / 2 + sweep * W * 1.2 - W * 0.1, g = ctx.createLinearGradient(x - 10, 0, x + 10, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,210,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; lx = -W / 2; chars.forEach((ch, i) => { const cw = widths[i] * 0.92; ctx.fillText(ch, lx + cw / 2, 0); lx += cw; }); ctx.restore(); }
    ctx.restore();
  }
}
