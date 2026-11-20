'use strict';
// LAYER SWORDS: while the hero is LAYERED (transcended), three little swords of the layer's element hover behind them and,
// one after another, loop out through the nearest foe and back — like the Zenith's blades. Each pass nicks it for very
// little (12% of the hero's attack, in the layer's element); they are there for the look and a small steady chip.
const LSWORD = { n: 3, range: 160, fly: 520, rest: [260, 460], dmg: 0.12, trail: 6, fan: 0.5 };
const LSWORD_ART = {};
// the swords are the game's own sword icons (item icons 0-19, drawn on the diagonal, point up-right), one per layer in its colours
const LSWORD_ICON = { holy: 9, lightning: 4, fire: 17, water: 1, earth: 0, grass: 16, wind: 14, dark: 13 };
function lswordArt(el) {   // the icon at 2x, whole pixels; tilt turns it upright when drawn; with its dark silhouette for a drop shadow
  if (LSWORD_ART[el]) return LSWORD_ART[el];
  const b = D.icons.items, im = img(b.img), r = b.frames[LSWORD_ICON[el] ?? 4]; if (!im || !im.complete || !im.naturalWidth || !r) return lswordFallback();
  const k = 2, c = document.createElement('canvas'); c.width = r[2] * k; c.height = r[3] * k; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, r[0], r[1], r[2], r[3], 0, 0, c.width, c.height);
  const sh = document.createElement('canvas'); sh.width = c.width; sh.height = c.height; const q = sh.getContext('2d'); q.drawImage(c, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = 'rgba(0,0,0,0.42)'; q.fillRect(0, 0, c.width, c.height);
  c.shadow = sh; c.tilt = -Math.PI / 4;
  return (LSWORD_ART[el] = c);
}
let LSWORD_BLANK = null;
const lswordFallback = () => LSWORD_BLANK || (LSWORD_BLANK = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }));   // (the icons not loaded yet: nothing, and no caching)
// draw a sword: its shadow a little down-right, then the sword turned on its long axis (spin: 1 face on, 0 edge on, below 0 the far face)
function swordBlit(im, x, y, rot, alpha, sc = 1, spin = 1) {
  const sx = Math.sign(spin || 1) * Math.max(0.22, Math.abs(spin)), w = im.width * sc, h = im.height * sc;
  const t = im.tilt || 0;   // (the icon lies on the diagonal: turned upright inside the spin, so it still spins along its blade)
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x) + 2 * sc, Math.round(y) + 3 * sc); ctx.rotate(rot); ctx.scale(sx, 1); ctx.rotate(t); if (im.shadow) ctx.drawImage(im.shadow, -w / 2, -h / 2, w, h); ctx.restore();
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); ctx.scale(sx, 1); ctx.rotate(t); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
}
// where a resting sword waits: on the FUSION CIRCLE behind the hero's back (the Layer sigil that stands up when C raises the Guardian
// Halo, drawLayerSigil), fanned round its upper rim, points out (2026-11-18, the user: "i meant the fusion circle that shows up
// after, so layer is used then fusion and swords fly from the circle behind the hero"). Only while that circle stands.
const lsigilCentre = (a, now) => ({ x: a.x + (a.lsigOff || 0), y: a.y - (a.z || 0) - LSIGIL.lift + Math.sin(now / 520) * 1.5 });
// (2026-11-18, the user: "swap swords to cards, the fusion card is what attacks not the swords"): what rests on the circle and flies
// out are the cards your fusion card was made from, each striking with its own spell (LCARD.k of its power, raised by attack like the
// Halo's fuel) in its own element.
const LCARD = { k: 0.25, w: 12, h: 17, max: 4 };
const fusionParts = c => !c ? [] : c.fusion ? c.fusion.flatMap(x => x.fusion ? fusionParts(x) : [x]) : [c];
function lswordRest(a, i, now) {
  const n = (a.lswords && a.lswords.length) || LSWORD.n, c = lsigilCentre(a, now), th = -Math.PI / 2 + (i - (n - 1) / 2) * 0.8, R = LSIGIL.r + 9;
  return { x: c.x + Math.cos(th) * R * (a.lsigSq == null ? 1 : 0.55 + 0.45 * a.lsigSq), y: c.y + Math.sin(th) * R + Math.sin(now / 380 + i * 2) * 1.2, rot: (i - (n - 1) / 2) * 0.35 };   // (a card stands upright, tilted a little with its place in the fan)
}
function layerSwordsTick(world, a, dt) {
  if (a.kind !== 'player') return;
  if (!(a.transcend > 0) || a.dead) { a.lswords = null; a.lbeams = null; a.ghalo = null; return; }
  const now = performance.now();
  if (!a.lswords) { a.lswords = Array.from({ length: LSWORD.n }, (_, i) => ({ i, mode: 'rest', wait: 0, trail: [], intro: now + i * 70, cool: 0 })); a.lswordsOut = false; }   // (intro: they rise out of the hero, drawLayerSwords)
  if (a.fsword) { bigSwordTick(world, a, dt, now); return; }   // fused into the big sword (C): it fights alone until its fuel runs out
  for (const s of a.lswords) s.cool = Math.max(0, (s.cool || 0) - dt);
  if (a.ghalo) a.ghalo.cd = Math.max(0, a.ghalo.cd - dt);
  lswordsFly(world, a, dt, now);
  a.lbeams = (a.lbeams || []).filter(B => { B.t += dt; if (!B.hit && B.t >= B.delay + LBEAM.fly) { B.hit = true; const o = B.foe; if (!o.dead) dealDamage(world, a, o, B.dmg ? { base: B.dmg, el: layerPal(a).dmg, spell: true, status: true, pop: 160, push: 40 } : { base: (a.atk || 10) * LSWORD.dmg, el: layerPal(a).dmg, spell: true, plain: true, pop: 90 }); } return B.t < B.delay + LBEAM.fly + LBEAM.fade; });
}
// THE SWORDS FLY AGAIN (2026-11-18, the user: "magic circle has the swords that fly and hit the enemies, we had something like
// that"; the halo's beams had replaced them). Each sword rests in the fan behind the hero; when a foe is within LSWORD.range it
// loops out through it and home (lswordPos), nicking it once as it passes (LSWORD.dmg of attack, in the layer's element), then
// rests a moment. One sword leaves at a time; a basic attack sends every resting sword at once (fireLayerBeams).
function lswordLaunch(world, a, s, foe, now) {
  const r = lswordRest(a, s.i, now);
  Object.assign(s, { mode: 'fly', foe, u: 0, sx: r.x, sy: r.y, side: s.i % 2 ? 1 : -1, hit: false, trail: [] });
}
const LSFADE = 400;
function lswordsFly(world, a, dt, now) {
  if (a.fblade) return;
  // no fusion circle, no cards: when it ends they fade over LSFADE ms where they are (a flying one keeps drifting along its loop), then go
  // (2026-11-19: they used to vanish mid-flight)
  if (!a.ghalo) {
    if (a.lswordsOut) {
      if (!a.lsFade) a.lsFade = now;
      for (const s of a.lswords) if (s.mode === 'fly') { s.u = Math.min(1, s.u + dt / LSWORD.fly); s.hit = true; const q = lswordPos(s, a, now); s.trail.unshift(q); s.trail.length = Math.min(s.trail.length, LSWORD.trail); }
      if (now - a.lsFade > LSFADE) { a.lswordsOut = false; a.lsFade = 0; for (const s of a.lswords) Object.assign(s, { mode: 'rest', trail: [], foe: null }); }
    }
    return;
  }
  a.lsFade = 0;
  if (!a.lswordsOut) { a.lswordsOut = true; const P = fusionParts(a.fusion).slice(0, LCARD.max); a.lswords = (P.length ? P : [null, null, null]).map((card, i) => ({ i, card, mode: 'rest', intro: now + 150 + i * 110, wait: 0, trail: [], cool: 0 })); }   // (the fusion card's cards come out of the circle as it appears)
  const foes = enemiesOf(world, a).filter(o => !o.dead && dist(a, o) < LSWORD.range).sort((p, q) => dist(a, p) - dist(a, q));
  for (const s of a.lswords) {
    if (s.mode === 'fly') {
      s.u += dt / LSWORD.fly;
      if (!s.hit && s.u >= 0.45) { s.hit = true; if (s.foe && !s.foe.dead) { const sp = s.card && cardSpell(s.card); dealDamage(world, a, s.foe, sp ? { base: sp.power * (1 + (a.atk || 10) / 40) * LCARD.k, el: sp.el, spell: true, plain: true, pop: 90 } : { base: (a.atk || 10) * LSWORD.dmg, el: layerPal(a).dmg, spell: true, plain: true, pop: 90 }); } }
      const q = lswordPos(s, a, now); s.trail.unshift(q); s.trail.length = Math.min(s.trail.length, LSWORD.trail);
      if (s.u >= 1) { s.mode = 'rest'; s.trail = []; s.foe = null; s.wait = now + LSWORD.rest[0] + Math.random() * (LSWORD.rest[1] - LSWORD.rest[0]); }
    }
  }
  if (!foes.length || a.lswords.some(s => s.mode === 'fly' && s.u < 0.3)) return;   // (one leaves at a time)
  const s = a.lswords.find(s => s.mode !== 'fly' && !(s.wait > now) && !(s.intro > now - 380)); if (!s) return;
  lswordLaunch(world, a, s, foes[s.i % foes.length], now);
}
// (old) THREE BEAMS OF LIGHT: with every basic attack while LAYERED (combat.js), each of the three beams behind the hero shoots a lance
// of light at a foe nearby (the nearest three, or all at the one), nicking it for 12% of the hero's attack in the layer's element
const LBEAM = { range: 170, fly: 110, fade: 260, cool: 380 };
function fireLayerBeams(world, a) {
  if (!a.lswords || a.fsword || !a.ghalo || !a.lswordsOut) return;
  const foes = enemiesOf(world, a).filter(o => !o.dead && dist(a, o) < LBEAM.range).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 3); if (!foes.length) return;
  const now = performance.now();
  a.lswords.forEach((s, k) => { if (s.mode === 'fly' || a.fblade) return; lswordLaunch(world, a, s, foes[k % foes.length], now); s.u = -k * 0.12; });   // (now: every resting sword flies, a beat apart)
}
// a flying sword's place on its loop: out from where it rested, through the foe and a little past, round and home
function lswordPos(s, a, now) {
  if (s.u < 0) { const r = lswordRest(a, s.i, now); return { x: r.x, y: r.y }; }
  const o = s.foe, r = lswordRest(a, s.i, now), tx = o ? o.x : r.x, ty = o ? o.y - (o.h || 26) * (o.scale || 1) * 0.45 : r.y;
  const dx = tx - s.sx, dy = ty - s.sy, len = Math.hypot(dx, dy) || 1, ax = dx / len, ay = dy / len, L = (len + 14) / 2, W = Math.max(10, L * 0.45) * s.side;
  const th = s.u * Math.PI * 2, cx = s.sx + ax * L, cy = s.sy + ay * L, home = Math.max(0, s.u - 0.8) / 0.2;   // (the last stretch eases into its resting place, which moves with the hero)
  const x = cx - ax * L * Math.cos(th) - ay * W * Math.sin(th), y = cy - ay * L * Math.cos(th) + ax * W * Math.sin(th);
  return { x: x + (r.x - s.sx) * home, y: y + (r.y - s.sy) * home };
}
// a small card in the world: the card's own mini face (drawCardFront), turned and spun on its upright axis (spin 1 face on)
function lcardBlit(c, x, y, rot, alpha, spin, now) {
  const w = LCARD.w, h = LCARD.h, sx = Math.sign(spin || 1) * Math.max(0.2, Math.abs(spin));
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); ctx.scale(sx, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w / 2 + 1.5, -h / 2 + 2, w, h);
  // (picture only, 2026-11-19, the user: "remove the letter from cards floating when using fusion"): a frame in the card's rank colour,
  // a dark face warmed by it, and the card's character filling it; no rank letter, name or numbers
  if (sx > 0) {
    // (then, the user: "the real card art but it doesn't have the rank on it": the game's own trading-card frame, without its rank)
    let ok = false; try { ok = typeof drawCardFrameArt === 'function' && drawCardFrameArt(c, -w / 2, -h / 2, w, h, now, { noRank: true, bare: true }); } catch (e) {}
    if (!ok) {   // (the frame art not loaded yet: the plain face)
      const face = ctx.createLinearGradient(0, -h / 2, 0, h / 2); face.addColorStop(0, '#4a3524'); face.addColorStop(1, '#1e140c');
      ctx.fillStyle = face; rrect(ctx, -w / 2, -h / 2, w, h, 2); ctx.fill();
      ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, 2); ctx.clip();
      try { monsterPreview(c.sp, -w / 2 + 1, -h / 2 + 1.5, w - 2, h - 3, c.tier || 0, 0, 'idle', 1); } catch (e) {}
      ctx.restore();
    }
  }
  else drawCardBack(-w / 2, -h / 2, w, h, now);
  ctx.restore();
}
function drawLayerSwords(a, now) {
  if (!a.lswords || !(a.transcend > 0)) return;
  drawLayerHalo(a, now);   // (the Guardian Halo's ring is drawn behind the hero instead: world.js, with the sigil)
  if (a.fsword) { drawBigSword(a, now); return; }
  if (a.fblade && performance.now() >= a.fblade.t0) { const e = performance.now() - a.fblade.t0; if (e < FBLADE.gather + FBLADE.merge + FBLADE.fall) return; }   // (while they are the Fusion Blade they are not behind you)
  const P = layerPal(a);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const shaft = (x, y, h, wd, al) => {   // a soft column of light, bright in the middle
    const g = ctx.createLinearGradient(x - wd, 0, x + wd, 0); g.addColorStop(0, `rgba(${P.glow},0)`); g.addColorStop(0.5, `rgba(${P.glow},${al})`); g.addColorStop(1, `rgba(${P.glow},0)`); ctx.fillStyle = g; ctx.fillRect(x - wd, y - h / 2, wd * 2, h);
    ctx.fillStyle = `rgba(255,255,255,${al * 0.8})`; ctx.fillRect(Math.round(x) - 0.5, y - h / 2 + 2, 1, h - 4);
  };
  ctx.restore();
  const im = lswordArt(a.layerEl || 'holy');
  if (!a.lswordsOut || (!a.ghalo && !a.lsFade)) return;   // (out only while the fusion circle stands, or fading after it)
  const fadeK = a.lsFade ? Math.max(0, 1 - (now - a.lsFade) / LSFADE) : 1; ctx.save(); ctx.globalAlpha *= fadeK;
  for (const s of a.lswords) {
    const k = s.intro ? Math.max(0, Math.min(1, (now - s.intro) / 380)) : 1;
    if (s.mode === 'fly' && s.u >= 0) {
      const q = lswordPos(s, a, now), nx = lswordPos({ ...s, u: Math.min(1, s.u + 0.03) }, a, now), rot = Math.atan2(nx.y - q.y, nx.x - q.x) + Math.PI / 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 1; i < s.trail.length; i++) { ctx.strokeStyle = `rgba(${P.glow},${0.45 * (1 - i / s.trail.length)})`; ctx.lineWidth = 3 * (1 - i / s.trail.length) + 0.5; ctx.beginPath(); ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y); ctx.lineTo(s.trail[i].x, s.trail[i].y); ctx.stroke(); }
      ctx.restore();
      if (s.card) lcardBlit(s.card, q.x, q.y, now / 70 + s.i, 1, Math.cos(now / 55 + s.i), now); else swordBlit(im, q.x, q.y, rot, 1, 0.8, Math.cos(now / 60 + s.i));   // (a thrown card spins)
    } else {
      const r0 = lswordRest(a, s.i, now), c = lsigilCentre(a, now), r = { x: c.x + (r0.x - c.x) * k, y: c.y + (r0.y - c.y) * k };   // (sliding out of the circle's middle as they appear)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, 9); g.addColorStop(0, `rgba(${P.glow},${0.35 * k})`); g.addColorStop(1, `rgba(${P.glow},0)`); ctx.fillStyle = g; ctx.fillRect(r.x - 9, r.y - 9, 18, 18); ctx.restore();
      if (s.card) lcardBlit(s.card, r.x, r.y, r0.rot, k, 1, now); else swordBlit(im, r.x, r.y, r0.rot, k, 0.8, 1);
    }
  }
  ctx.restore();   // (the fade's save)
}
// THE HALO: a ring of light floating over the head while LAYERED, in the layer's colours, tilted like a disc and slowly glinting round
// a pixel ring, 11 x 4, one pixel thick: the far edge in the bright colour, the near edge in the body colour, outlined dark
const HALO_PX = ['..ooooooo..', '.o.......o.', '.o.......o.', '..ooooooo..'];
const haloTop = (a, now) => ({ x: Math.round(a.x) - 5, y: Math.round(a.y - a.z - (a.h || 28) * (a.scale || 1) + 1 + (Math.sin(now / 520) > 0.6 ? -1 : 0)) });
// the three lights on the halo, where the beams leave it: its left end, the middle of its far edge, its right end
function haloPoint(a, i, now) { const t = haloTop(a, now), [dx, dy] = [[1.5, 1.5], [5.5, 0.5], [9.5, 1.5]][i] || [5.5, 0.5]; return { x: t.x + dx, y: t.y + dy }; }
function drawLayerHalo(a, now) {
  const P = layerPal(a), { x, y } = haloTop(a, now);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x + 5.5, y + 2, 1, x + 5.5, y + 2, 9); g.addColorStop(0, `rgba(${P.glow},0.28)`); g.addColorStop(1, `rgba(${P.glow},0)`); ctx.fillStyle = g; ctx.fillRect(x - 4, y - 7, 19, 18);
  ctx.globalCompositeOperation = 'source-over';
  const px = (cx, cy, c) => { ctx.fillStyle = c; ctx.fillRect(x + cx, y + cy, 1, 1); };
  HALO_PX.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === 'o') { for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const rr = r + dy, cc = c + dx; if (!(HALO_PX[rr] && HALO_PX[rr][cc] === 'o')) px(cc, rr, P.halo); } } });   // the dark outline
  HALO_PX.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === 'o') px(c, r, r === 0 ? P.inner : r === 3 ? P.body : P.bloom); });
  const k = Math.floor(now / 110) % 18, ring = [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 1], [9, 2], [8, 3], [7, 3], [6, 3], [5, 3], [4, 3], [3, 3], [2, 3], [1, 2], [1, 1]];   // the glint going round, a pixel at a time
  px(ring[k][0], ring[k][1], '#ffffff');
  ctx.restore();
}


// THE FUSION BLADE: picking the fusion card into a LAYERED skill. The swords leave the hero, gather high over the foe, spin
// together into one giant sword of the layer's element and plunge it down through them. All of the fusion card's power:
// a tenth from each sword as it passes the foe on the way up, the rest when the blade lands.
const FBLADE = { gather: 380, merge: 300, fall: 170, hold: 520, up: 74, scale: 2.2, small: 0.1 };
function fusionBlade(world, a, tp, target, total, delay) {
  const el = a.layerEl || 'holy', P = LAYER_ELS[el] || LAYER_ELS.holy, t0 = performance.now() + delay, F = FBLADE, land = delay + F.gather + F.merge + F.fall;
  a.fblade = { x: tp.x, y: tp.y, t0, el, from: (a.lswords || []).map((s, i) => lswordRest(a, i, t0)) };
  if (!a.fblade.from.length) a.fblade.from = [0, 1, 2].map(i => lswordRest(a, i, t0));
  for (const s of a.lswords || []) { s.mode = 'rest'; s.wait = land + F.hold + 200; s.trail = []; s.foe = null; }   // (their places are empty while they are the blade)
  a.fblade.from.forEach((_, i) => strike(world, a, tp.x, tp.y, 30, delay + F.gather * 0.7 + i * 40, { base: total * F.small, el: P.dmg, spell: true, plain: true }));
  strike(world, a, tp.x, tp.y, 64, land, { base: total * (1 - F.small * a.fblade.from.length), el: P.dmg, status: true, spell: true, launch: 300, pop: 260 });
  world.timers.push({ t: land, fn: () => {
    world.shake = Math.max(world.shake || 0, 7);
    world.rings.push({ x: tp.x, y: tp.y, r: 64, t: 0, col: P.mote }, { x: tp.x, y: tp.y, r: 36, t: -90, col: '#ffffff' });
    world.fx.push(fxAt(FX.EXPLODE + 2, tp.x, tp.y, 1.4, { filter: elementFilter(P.dmg) }));
    for (let i = 0; i < 16; i++) { const an = Math.random() * Math.PI * 2, v = rand(60, 150); world.particles.push({ x: tp.x, y: tp.y - 4, vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.6 - 40, t: 0, life: rand(350, 650), col: i % 2 ? P.mote : P.inner, size: 2, streak: true }); }
  } });
}
// one frame of it, in the world (lateDraw): where each sword is, then the big one
function drawFusionBlade(a, now) {
  const B = a.fblade; if (!B) return; const F = FBLADE, e = now - B.t0, end = F.gather + F.merge + F.fall + F.hold; if (e > end) { a.fblade = null; return; } if (e < 0) return;
  const im = lswordArt(B.el), P = LAYER_ELS[B.el] || LAYER_ELS.holy, gx = B.x, gy = B.y - F.up, n = B.from.length;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const blit = (img, x, y, rot, sc, al) => { ctx.save(); ctx.globalAlpha = al; ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc); ctx.restore(); };
  const glow = (x, y, r, al) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${P.glow},${al})`); g.addColorStop(1, `rgba(${P.glow},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); };
  if (e < F.gather) {   // out from the hero, through the foe, up to the gathering point
    const k = e / F.gather;
    B.from.forEach((f, i) => {
      const side = (i - (n - 1) / 2) * 26, mx = B.x + side * 0.4, my = B.y - 10, q = 1 - k;
      const x = q * q * f.x + 2 * q * k * mx + k * k * (gx + side * (1 - k * 0.6)), y = q * q * f.y + 2 * q * k * my + k * k * gy;
      const dx = 2 * q * (mx - f.x) + 2 * k * (gx + side - mx), dy = 2 * q * (my - f.y) + 2 * k * (gy - my);
      glow(x, y, 9, 0.5); blit(im, x, y, Math.atan2(dy, dx) + Math.PI / 2, 1, 1);
    });
  } else if (e < F.gather + F.merge) {   // a spinning ring that closes in, and the great blade growing out of it
    const k = (e - F.gather) / F.merge, rr = 22 * (1 - k);
    glow(gx, gy, 18 + 24 * k, 0.35 + 0.4 * k);
    B.from.forEach((_, i) => { const an = i / n * Math.PI * 2 + k * Math.PI * 3; blit(im, gx + Math.cos(an) * rr, gy + Math.sin(an) * rr * 0.6, an + Math.PI / 2, 1, 1 - k * 0.6); });
    blit(im, gx, gy, Math.PI, F.scale * (0.3 + 0.7 * k), k);
  } else {   // down it comes, point first, then it stands in the ground and fades
    const k = Math.min(1, (e - F.gather - F.merge) / F.fall), y = gy + (B.y - 24 - gy) * k * k, fade = Math.max(0, (e - F.gather - F.merge - F.fall) / F.hold);
    if (k < 1) for (let j = 1; j <= 4; j++) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; blit(im, gx, y - j * 9, Math.PI, F.scale, 0.18 * (1 - j / 5)); ctx.restore(); }
    glow(gx, y, 30, 0.55 * (1 - fade)); blit(im, gx, y, Math.PI, F.scale, 1 - fade);
  }
  ctx.restore();
}

// THE POWER-UP: transforming should feel like power. While the circle charges the world dims, motes of the element stream in
// to the hero, a column of light thickens round them and the ground shakes harder; at the release a white flash, a beat of
// hit-stop, three shockwaves, speed lines, the column shooting up into the sky and the swords spinning out.
const LPOW = { release: 520, motes: 26 };
function layerPowerUp(world, a, C) {
  const L = layerPal(a), t0 = performance.now(); a.lpow = { t0, C };
  for (let k = 1; k <= 6; k++) world.timers.push({ t: C * k / 7, fn: () => { world.shake = Math.max(world.shake || 0, 0.6 + k * 0.45); } });   // the rumble builds
  world.timers.push({ t: C, fn: () => {
    if (a.dead) return;
    world.flash = { t: 0, dur: 360, col: '#ffffff' }; world.shake = Math.max(world.shake || 0, 7); world.hitStop = Math.max(world.hitStop || 0, 110);
    for (let k = 0; k < 3; k++) world.rings.push({ x: a.x, y: a.y, r: 40 + k * 34, t: -k * 80, col: k === 1 ? L.bloom : L.mote });
    for (let i = 0; i < 26; i++) { const an = Math.random() * Math.PI * 2, v = rand(140, 330); world.particles.push({ x: a.x, y: a.y - 16, vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.65 - 30, t: 0, life: rand(300, 650), col: i % 3 ? L.mote : L.inner, size: rand(1.4, 2.6), streak: true, drag: 0.92 }); }
  } });
}
// a column of light standing on (x, base): soft across, and soft along its height too, swelling in from the ground and thinning
// away to nothing well before its top, so it never ends in a hard line against the sky (drawn in bands, 'lighter')
const LPOW_COL = document.createElement('canvas');
function lpowColumn(x, base, h, wd, rgb, al) {   // drawn whole on a scratch canvas and faded with a mask (bands laid over each other left bright seams)
  if (h < 2 || al <= 0) return; const W = Math.max(2, Math.ceil(wd * 2)), H = Math.ceil(h), c = LPOW_COL; c.width = W; c.height = H; const g = c.getContext('2d');
  const hg = g.createLinearGradient(0, 0, W, 0); hg.addColorStop(0, `rgba(${rgb},0)`); hg.addColorStop(0.5, `rgba(${rgb},1)`); hg.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = hg; g.fillRect(0, 0, W, H);
  const vg = g.createLinearGradient(0, H, 0, 0); for (let i = 0; i <= 10; i++) { const v = i / 10, k = Math.min(1, v / 0.12) * Math.pow(1 - v, 1.6); vg.addColorStop(v, `rgba(0,0,0,${Math.min(1, k * 1.6)})`); }
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = vg; g.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = al; ctx.drawImage(c, Math.round(x - W / 2), Math.round(base - H)); ctx.restore();
}
function drawLayerPower(a, now) {
  const P = a.lpow; if (!P) return; const e = now - P.t0, C = P.C, end = C + LPOW.release; if (e > end) { a.lpow = null; return; } if (e < 0) return;
  const L = layerPal(a), hx = a.x, hy = a.y - 16, charge = Math.min(1, e / C), out = e > C ? (e - C) / LPOW.release : 0;
  ctx.save();
  ctx.fillStyle = `rgba(4,2,16,${0.38 * charge * (1 - out)})`; ctx.fillRect(hx - 700, hy - 500, 1400, 1000);   // the world holds its breath
  ctx.globalCompositeOperation = 'lighter';
  if (e <= C) {   // gathering: motes stream in, the column thickens
    for (let i = 0; i < LPOW.motes; i++) {
      const an = i / LPOW.motes * Math.PI * 2 + i * 0.7, q = ((now / 520) + i / LPOW.motes * 3.1) % 1, rr = 90 * (1 - q), x = hx + Math.cos(an) * rr, y = hy + Math.sin(an) * rr * 0.6;
      ctx.strokeStyle = i % 3 ? L.mote : L.bloom; ctx.globalAlpha = 0.25 + 0.6 * q * charge; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * 7, y + Math.sin(an) * 4.2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    lpowColumn(hx, a.y + 2, 90, 6 + 14 * charge, L.glow, 0.25 + 0.4 * charge);
    const rg = ctx.createRadialGradient(hx, a.y, 0, hx, a.y, 40 * (1.4 - charge * 0.6)); rg.addColorStop(0, `rgba(${L.glow},${0.5 * charge})`); rg.addColorStop(1, `rgba(${L.glow},0)`); ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(hx, a.y, 40, 14, 0, 0, Math.PI * 2); ctx.fill();
  } else {   // the release: the column shoots into the sky and speed lines tear outward
    const f = 1 - out, up = Math.min(1, out * 3 + 0.3);   // the column shoots up past the top of the screen, fading into the sky long before its end
    lpowColumn(hx, a.y + 2, 420 * up, 24 * f + 5, L.glow, 0.7 * f);
    lpowColumn(hx, a.y + 2, 380 * up, 8 * f + 2, cssRgba(L.inner).slice(0, 3).join(','), 0.55 * f);   // (its core in the element's palest colour, not white)
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 22; i++) {
      const an = i / 22 * Math.PI * 2 + (i % 3) * 0.13, r0 = 18 + out * 140, r1 = r0 + 26 + (i % 4) * 9;
      ctx.strokeStyle = i % 2 ? L.mote : L.bloom; ctx.globalAlpha = f * 0.7;
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(an) * r0, hy + Math.sin(an) * r0 * 0.6); ctx.lineTo(hx + Math.cos(an) * r1, hy + Math.sin(an) * r1 * 0.6); ctx.stroke();
    }
  }
  ctx.restore();
}

// THE BIG SWORD (C while LAYERED, once a Layer): the three swords spiral together over the hero's head into one sword twice
// their size. The fusion card's energy is its fuel: the same total the fusion attack had (its power, raised by attack). Every
// strike burns BIGSWORD.spend of the fuel and deals that much, in the layer's element; empty, it splits back into three.
const BIGSWORD = { fuse: 420, scale: 1.6, range: 190, fly: 640, rest: [520, 760], spend: 0.12, trail: 7 };
function fuseSwords(world, a) {
  if (a.fsword || !(a.transcend > 0)) return;
  const card = a.fusion, fuel = fusionPower(card) * (1 + (a.atk || 10) / 40), now = performance.now(), L = layerPal(a);
  a.fusionUsed = true;
  a.fsword = { fuel, max: fuel, t0: now, mode: 'rest', wait: BIGSWORD.fuse + 200, trail: [], name: card.name };
  world.rings.push({ x: a.x, y: a.y - 40, r: 22, t: -BIGSWORD.fuse, col: L.mote }, { x: a.x, y: a.y, r: 34, t: -BIGSWORD.fuse - 80, col: L.bloom });
  world.spellName = { str: 'FUSION — ' + card.name.toUpperCase() + ' BLADE', col: L.inner, t: 1600, team: a.team, big: true };
}
const bigRest = (a, now) => ({ x: a.x, y: a.y - 44 + Math.sin(now / 420) * 2, rot: 0 });
function bigSwordTick(world, a, dt, now) {
  const B = a.fsword, L = layerPal(a);
  if (B.mode === 'rest') {
    if ((B.wait -= dt) > 0) return;
    const o = nearestEnemy(world, a, BIGSWORD.range); if (!o) { B.wait = 200; return; }
    const r = bigRest(a, now); Object.assign(B, { mode: 'fly', u: 0, sx: r.x, sy: r.y, foe: o, side: B.side === 1 ? -1 : 1, hit: false });
    return;
  }
  B.u += dt / BIGSWORD.fly;
  if (!B.hit && B.u >= 0.5) {
    B.hit = true; const o = B.foe, spend = Math.min(B.fuel, B.max * BIGSWORD.spend);
    if (!o.dead) { B.fuel -= spend; dealDamage(world, a, o, { base: spend, el: L.dmg, spell: true, status: true, pop: 160, launch: 120, push: 30 }); world.rings.push({ x: o.x, y: o.y, r: 26, t: 0, col: L.mote }); world.shake = Math.max(world.shake || 0, 2); }
  }
  if (B.u >= 1) {
    if (B.fuel <= 0.5) {   // spent: it breaks back into the three
      world.rings.push({ x: a.x, y: a.y - 40, r: 30, t: 0, col: L.bloom });
      for (let i = 0; i < 14; i++) { const an = Math.random() * Math.PI * 2, v = rand(60, 140); world.particles.push({ x: a.x, y: a.y - 44, vx: Math.cos(an) * v, vy: Math.sin(an) * v, t: 0, life: rand(300, 520), col: i % 2 ? L.mote : L.inner, size: 1.8, streak: true }); }
      floatText(world, a.x, a.y - 66, 'The blade splits apart', L.mote, 8);
      a.fsword = null; a.lswords = null; return;
    }
    Object.assign(B, { mode: 'rest', wait: rand(...BIGSWORD.rest), trail: [], foe: null });
  }
}
// where the big sword is on its swing: a wider loop than the small ones, through the foe and home
function bigPos(B, a, now) {
  const o = B.foe, r = bigRest(a, now), tx = o ? o.x : r.x, ty = o ? o.y - (o.h || 26) * (o.scale || 1) * 0.45 : r.y;
  const dx = tx - B.sx, dy = ty - B.sy, len = Math.hypot(dx, dy) || 1, ax = dx / len, ay = dy / len, L = (len + 22) / 2, W = Math.max(16, L * 0.55) * B.side;
  const th = B.u * Math.PI * 2, cx = B.sx + ax * L, cy = B.sy + ay * L, home = Math.max(0, B.u - 0.8) / 0.2;
  const x = cx - ax * L * Math.cos(th) - ay * W * Math.sin(th), y = cy - ay * L * Math.cos(th) + ax * W * Math.sin(th);
  return { x: x + (r.x - B.sx) * home, y: y + (r.y - B.sy) * home };
}
function drawBigSword(a, now) {
  const B = a.fsword, im = lswordArt(a.layerEl || 'holy'), P = layerPal(a), S = BIGSWORD.scale, e = now - B.t0;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const blit = (x, y, rot, al, sc = S, spin = B.mode === 'fly' ? Math.cos(now / 110) : Math.cos(now / 900)) => swordBlit(im, x, y, rot, al, sc, spin);
  const aura = (x, y, r, al) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${P.glow},${al})`); g.addColorStop(1, `rgba(${P.glow},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); };
  const R = bigRest(a, now);
  if (e < BIGSWORD.fuse) {   // the fusing: the three swords spiral in over the head and the big one grows out of their light
    const k = e / BIGSWORD.fuse, rr = 18 * (1 - k);
    aura(R.x, R.y, 14 + 18 * k, 0.3 + 0.4 * k);
    for (let i = 0; i < 3; i++) { const an = i / 3 * Math.PI * 2 + k * Math.PI * 4; blit(R.x + Math.cos(an) * rr, R.y + Math.sin(an) * rr * 0.6, an + Math.PI / 2, 1 - k * 0.5, 1); }
    blit(R.x, R.y, 0, k, S * (0.4 + 0.6 * k));
    ctx.restore(); return;
  }
  let p = R, rot = 0;
  if (B.mode === 'fly') {
    p = bigPos(B, a, now); const last = B.trail[B.trail.length - 1]; rot = last ? Math.atan2(p.y - last.y, p.x - last.x) + Math.PI / 2 : 0;
    B.trail.push({ x: p.x, y: p.y, rot }); if (B.trail.length > BIGSWORD.trail) B.trail.shift();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; B.trail.forEach((q, k) => blit(q.x, q.y, q.rot, 0.1 + 0.28 * k / BIGSWORD.trail)); ctx.restore();
  } else {   // hovering: a shadow on the ground and a slow glint
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(Math.round(R.x), Math.round(a.y + 1), 7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  aura(p.x, p.y, 22, 0.38 + 0.12 * Math.sin(now / 240));
  blit(p.x, p.y, rot, 1);
  if (B.mode === 'rest') {   // its fuel: a thin bar under the hilt, in the layer's colours
    const w = 26, x = Math.round(R.x - w / 2), y = Math.round(R.y + im.height * S / 2 + 3), k = Math.max(0, B.fuel / B.max);
    ctx.fillStyle = 'rgba(10,8,20,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, 4); ctx.fillStyle = P.body; ctx.fillRect(x, y, Math.round(w * k), 2); ctx.fillStyle = P.inner; ctx.fillRect(x, y, Math.round(w * k), 1);
  }
  ctx.restore();
}

// THE GUARDIAN HALO (C while LAYERED, once a Layer): the halo throws a ring of light round the hero, fuelled by the fusion card's
// energy (its power, raised by attack). While it holds, it takes the next hit whole, answers with a big lance of light at whoever
// threw it (a fifth of the full fuel, burnt from it), and needs a moment to come back; when the fuel is gone it fades.
const GHALO = { cd: 1400, spend: 0.2 };
function raiseGuardianHalo(world, a) {
  if (a.ghalo || !(a.transcend > 0)) return;
  const card = a.fusion, fuel = fusionPower(card) * (1 + (a.atk || 10) / 40), L = layerPal(a);
  a.fusionUsed = true; a.ghalo = { fuel, max: fuel, cd: 0, t0: performance.now(), flash: 0 };
  world.rings.push({ x: a.x, y: a.y - 14, r: 26, t: 0, col: L.mote }, { x: a.x, y: a.y - 14, r: 18, t: -90, col: L.inner });
  world.spellName = { str: 'GUARDIAN HALO — ' + card.name.toUpperCase(), col: L.inner, t: 1500, team: a.team, big: true };
}
function guardianBlock(world, att, def, opts) {
  const G = def.ghalo; if (!G || G.cd > 0 || !(def.transcend > 0)) return false;
  const L = layerPal(def), spend = Math.min(G.fuel, G.max * GHALO.spend);
  G.cd = GHALO.cd; G.flash = performance.now(); G.fuel -= spend;
  floatText(world, def.x, def.y - 50, 'BLOCKED', L.inner, 9); world.rings.push({ x: def.x, y: def.y - 14, r: 22, t: 0, col: L.inner });
  const foe = att && att !== def && !att.dead && (att.kind === 'monster' || att.kind === 'player') ? att : null;
  if (foe) { const h = haloPoint(def, 1, performance.now()); (def.lbeams = def.lbeams || []).push({ i: 1, t: 0, delay: 60, x0: h.x, y0: h.y, foe, hit: false, dmg: spend, big: true }); }
  if (G.fuel <= 0.5) { def.ghalo = null; floatText(world, def.x, def.y - 62, 'The halo dims', L.mote, 8); }
  return true;
}
function drawGuardianHalo(a, now) {
  const G = a.ghalo, L = layerPal(a), ready = G.cd <= 0, f = Math.max(0, 1 - (now - G.flash) / 300), cx = a.x, cy = a.y - 13, rx = 15, ry = 19;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.6 + 0.4 * Math.sin(now / 240), al = (ready ? 0.45 + 0.25 * pulse : 0.15) + 0.6 * f;   // the ring round the hero: bright when it can take a hit, faint while it recovers, flaring when it blocks
  const g = ctx.createRadialGradient(cx, cy, rx * 0.6, cx, cy, ry + 3); g.addColorStop(0, `rgba(${L.glow},0)`); g.addColorStop(0.8, `rgba(${L.glow},${al * 0.35})`); g.addColorStop(1, `rgba(${L.glow},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(${L.glow},${al})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 3; k++) { const an = now / 700 + k * Math.PI * 2 / 3; ctx.fillStyle = `rgba(255,255,255,${ready ? 0.9 : 0.35})`; ctx.fillRect(Math.round(cx + Math.cos(an) * rx) - 0.5, Math.round(cy + Math.sin(an) * ry) - 0.5, 2, 2); }   // three motes circling on it
  ctx.restore();
  const t = haloTop(a, now), w = 11, k2 = Math.max(0, G.fuel / G.max);   // its fuel: a pixel bar just over the halo
  ctx.fillStyle = 'rgba(10,8,20,0.8)'; ctx.fillRect(t.x - 1, t.y - 4, w + 2, 3); ctx.fillStyle = L.body; ctx.fillRect(t.x, t.y - 3, Math.round(w * k2), 1);
}
// THE LAYER SIGIL: while the Guardian Halo is up (fusion, C), the Layer's rainbow magic circle (the one drawn on the ground
// when you transform: rings, a seven-point star, runes) stands upright behind your back, turning slowly and bobbing.
// Drawn before the hero's sprite (world.js), so it is always behind you.
const LSIGIL = { r: 18, lift: 33, alpha: 0.95, side: 12, edge: 0.6 };   // (edge: how wide it looks seen from the side)   // (smaller, its lower edge at your waist and its top just over your head: it stands behind your back, not round you)
// BEHIND YOUR BACK, WHICHEVER WAY YOU FACE (2026-11-19, the user: "the fusion circle when walking isn't behind the hero when walking
// a different direction"): facing left or right it slides LSIGIL.side px to the side your back is on (eased, so turning doesn't snap
// it); facing away from the camera your back is toward us, so it is drawn over you (world.js), lighter and without its dark disc so
// you still show through. lsigilBack: { off: its x offset now, front: drawn over the hero }.
function lsigilBack(a, now) {
  const d = DV[a.dir] || [0, 1], want = -d[0] * LSIGIL.side, t = now - (a.lsigT || now); a.lsigT = now;
  const k = Math.min(1, t / 120), sq = d[0] ? LSIGIL.edge : 1;   // (sideways the disc is seen edge-on: a narrow oval)
  a.lsigOff = a.lsigOff == null ? want : a.lsigOff + (want - a.lsigOff) * k;
  a.lsigSq = a.lsigSq == null ? sq : a.lsigSq + (sq - a.lsigSq) * k;
  return { off: a.lsigOff, sq: a.lsigSq, front: d[1] < 0 };
}
function drawLayerSigil(a, y, now) {
  const prev = CIRCLE_TINT; CIRCLE_TINT = null;   // (the full rainbow, as on the transformation's ground circle)
  const B = lsigilBack(a, now), x = a.x + B.off, cy = y - LSIGIL.lift + Math.sin(now / 520) * 1.5, R = LSIGIL.r;
  ctx.save(); ctx.filter = 'none';
  if (!B.front) {   // a dark disc behind it, so it glows on any ground (not over your back: you'd vanish behind it)
    const bg = ctx.createRadialGradient(x, cy, R * 0.3, x, cy, R * 1.25); bg.addColorStop(0, 'rgba(8,4,18,0.75)'); bg.addColorStop(0.8, 'rgba(8,4,18,0.6)'); bg.addColorStop(1, 'rgba(8,4,18,0)');
    ctx.fillStyle = bg; ctx.save(); ctx.translate(x, cy); ctx.scale(B.sq, 1); ctx.beginPath(); ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  drawGroundCircle(ctx, x, cy, R * B.sq, R, now, B.front ? LSIGIL.alpha * 0.6 : LSIGIL.alpha);
  ctx.restore(); CIRCLE_TINT = prev;
}
