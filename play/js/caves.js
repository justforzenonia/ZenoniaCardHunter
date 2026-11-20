'use strict';
// Dimensional Caves are BLACK HOLES: one tears open somewhere random in each zone (lasts 3 minutes, reappears
// elsewhere 1–2 minutes later). It drags nearby monsters in on a spiral and swallows them, and feeding raises the
// hole a grade — each grade hungrier than the last (holeNeed: 2 monsters, then 3, 4…). Its rank (shown above it)
// is the zone's lowest rank + its grade, up to SSS+.
// Step into the core to fall inside: one huge boss of that rank waits there, guarding a hoard to match.

const CAVE = { life: 180000, gapMin: 60000, gapMax: 120000, pull: 170, lure: 2.6, horizon: 12, eat: 420 };
const caveRank = c => Math.min(9, ZONES[c.zi].ranks[0] + (c.grade || 0));
const holeNeed = c => 2 + (c.grade || 0);   // monsters it must swallow to rise from its grade to the next
const holeLift = c => 30 * (1 + caveRank(c) * 0.05);   // how high the core floats
// the way in: the core floats holeLift above its crater, so walking anywhere from the crater up to the core counts
// (it was only the crater's centre, which hid under the disk once the hole had grown)
function inHoleCore(p, c) {
  const top = c.y - holeLift(c) - 12, bottom = c.y + 12, half = 16 + caveRank(c);
  return Math.abs(p.x - c.x) < half && p.y > top && p.y < bottom;
}

function initCaves(w) {
  w.caves = ZONES.map((Z, zi) => ({ zi, t: rand(2000, 15000), open: false }));
}
function openCave(w, c) {
  const regs = zoneRegions(c.zi);
  for (let k = 0; k < 200; k++) {
    const R = pick(regs);
    const x = (R.ox + rand(2, R.w - 2)) * T, y = (R.oy + rand(3, R.h - 2)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || w.blocked(x, y - 14)) continue;
    Object.assign(c, { open: true, x, y, t: CAVE.life, grade: 0, eaten: 0, fed: 0, coreK: 1, announced: false, guarded: false });
    if (Math.abs(x - w.player.x) < 1200) window.GAME.toast(`A black hole has torn open in ${ZONES[c.zi].name}!`, '#c88aff');
    return;
  }
}
// gravity: monsters in range slide in on a spiral (faster the closer they get), helpless near the core, and are
// swallowed at the event horizon (shrinking, spinning, fading), which grades the hole up. Further out, inside the
// lure ring, wandering monsters drift slowly toward it. Its own guards resist (half the pull) but fall in all the
// same if you leave them: kill them first or the hole feeds on them.
function pullIntoHole(w, c, dt) {
  const cx = c.x, cy = c.y, R = CAVE.pull * (1 + caveRank(c) * 0.04);
  for (const m of w.actors) {
    if (m.kind !== 'monster' || m.ally || m.dead || m.remove || m.guardian != null || m.miniBoss || m.alphaKey || m.wellGuard || m.storyKeeper || m.storyFinal || m.trialSovereign || m.weeklyLord || m.wellBoss || m.sqBoss) continue;   // (the story's bosses are not food)
    if (m.sucked) {
      const S = m.sucked; S.t += dt;
      const k = Math.min(1, S.t / CAVE.eat);
      S.a += dt / 1000 * (6 + 14 * k);
      const r = S.r0 * (1 - k);
      m.x = cx + Math.cos(S.a) * r; m.y = cy + Math.sin(S.a) * r * 0.4; m.z = holeLift(c) * Math.min(1, k * 1.6) - 6; m.vx = m.vy = 0;
      m.state = 'hurt'; m.stun = 99999;
      m.scale = S.s0 * (1 - 0.85 * k); m.alpha = 1 - k * 0.9;
      if (k >= 1) {
        m.remove = true; m.dead = true;
        c.eaten++; c.fed = (c.fed || 0) + 1;
        const top = c.grade >= 9 - ZONES[c.zi].ranks[0];
        if (!top && c.fed < holeNeed(c)) holeText(w, c, 'devour');   // still hungry
        else if (!top) {
          c.grade++; c.fed = 0;
          // fed its way into a greater tier with the hero nearby: announced again, grander
          if (c.announced && holeTier(caveRank(c)) > (c.tier || 0) && Math.hypot(w.player.x - cx, w.player.y - cy) < 900 && window.GAME && !window.GAME.holeBanner) holeAnnounce(window.GAME, w, c, true);
          holeText(w, c, 'rank');
        } else holeText(w, c, 'devour');
        w.rings.push({ x: cx, y: cy, r: 34, t: 0, col: '#c890ff' });
        if (Math.hypot(w.player.x - cx, w.player.y - cy) < 260) { w.shake = Math.max(w.shake || 0, 2); if (typeof SFX !== 'undefined') SFX.smite(); }
      }
      continue;
    }
    const dx = cx - m.x, dy = cy - m.y, d = Math.hypot(dx, dy);
    if (d > R) {   // the lure: a slow drift toward the hole while it wanders
      if (d < R * CAVE.lure && !m.holeGuard && m.state === 'free') {   // (its home drifts too, or it would wander back)
        const sp = 24 * dt / 1000, ux = dx / d * sp, uy = dy / d * sp;
        if (!w.blocked(m.x + ux, m.y + uy, m)) { m.x += ux; m.y += uy; if (m.home) { m.home.x += ux; m.home.y += uy; } }
      }
      continue;
    }
    if (d < CAVE.horizon + 8) {
      m.sucked = { t: 0, a: Math.atan2(-dy, -dx), r0: Math.max(d, 6), s0: m.scale || 1 };
      m.state = 'hurt'; m.stun = 99999; setAnim(m, 'hurt'); continue;
    }
    const k = 1 - d / R, sp = (22 + 170 * k * k) * (m.heavy ? 0.65 : 1) * (m.holeGuard ? 0.5 : 1) * dt / 1000;
    const nx = dx / d, ny = dy / d;
    const tx = m.x + (nx - ny * 0.55) * sp, ty = m.y + (ny + nx * 0.55) * sp;   // inward + a swirl
    if (!w.blocked(tx, ty) || k > 0.6) { m.x = tx; m.y = ty; }
    else { m.x += nx * sp; m.y += ny * sp; }
    if (k > 0.4) { if (m.state !== 'hurt') setAnim(m, 'hurt'); m.state = 'hurt'; m.stun = Math.max(m.stun || 0, 250); }
  }
}
// Coming up on an open black hole: the big announcement, and ten low-rank creatures crawl out to guard it (they stay
// near the rift; the hole does not swallow them). Both happen once per opening, when you are close enough to see it.
function holeArrival(game, w, c) {
  const p = w.player, d = Math.hypot(c.x - p.x, c.y - p.y);
  if (!c.announced && d < 900) {
    c.announced = true; holeAnnounce(game, w, c, false);
  }
  if (!c.guarded && d < 700) {
    c.guarded = true; const R0 = regionAt(c.x);
    const pool = ZONES[c.zi].mobs.concat(ZONES[c.zi].mobs2 || []).filter(id => D.monsters[id]);
    for (let n = 0, tries = 0; n < 10 && tries < 160; tries++) {
      const a = Math.random() * Math.PI * 2, r = rand(150, 230), mx = c.x + Math.cos(a) * r, my = c.y + Math.sin(a) * r * 0.7;
      if (!mapReach(w.map, mx, my) || w.blocked(mx, my) || Math.hypot(mx - p.x, my - p.y) < 90) continue;
      const m = makeMonster(pick(pool), ZONES[c.zi].ranks[0], mx, my);
      Object.assign(m, { home: { x: mx, y: my }, dir: randi(0, 3), region: c.zi, area: R0 ? R0.key : null, holeGuard: true, smart: true });
      m.spell = m.spell || cardSpell({ sp: m.sp, tier: m.tier });   // smart: it combos you with its spell
      w.actors.push(m); n++;
      w.rings.push({ x: mx, y: my, r: 16, t: -n * 60, col: '#b06bff' });
    }
  }
}
function updateCaves(game, w, dt) {
  if (!w.caves) initCaves(w);
  const p = w.player;
  for (const c of w.caves) {
    if (c.open) holeArrival(game, w, c);
    c.t -= c.open ? dt : dt * nightMul(NIGHT.holes);   // night: black holes tear open twice as often
    if (!c.open && c.t <= 0) openCave(w, c);
    else if (c.open && c.t <= 0) { c.open = false; c.t = rand(CAVE.gapMin, CAVE.gapMax); }
    if (!c.open) continue;
    if (Math.abs(c.x - p.x) < 900 && Math.abs(c.y - p.y) < 700) pullIntoHole(w, c, dt);
    if (!p.dead && inHoleCore(p, c)) { enterCave(game, c); return true; }
  }
  return false;
}
// The black hole hangs over a dark crater: a violet lensing halo, the far half of a tilted white-hot accretion
// disk, the pitch-black core in its photon ring with the disk's far side lensed up over it, then the near half of
// the disk sweeping across. Streaks of light spiral in. It swells a little with every rank; the rank sits above it.
// ---------------------------------------------------------------- what a black hole does to the world round it
// THE SCAR: the land under a hole dies as it feeds. A ring of dead, greyed grass round a crater of cracked dark
// earth, its edge ragged (the same for a hole each time, seeded from where it opened), and fissures running out
// from its heart with a faint violet glow in them. It starts small and stays still; each time the hole climbs a
// rank, the ground breaks open in a jolt to its new size (holeCrackBurst).
const HOLE_WORLD = { scar0: 22, scarPer: 7, debris0: 18, debrisPer: 5, lens: 1.5 };
// THE PAINTED SCAR (from the user's artwork, turned into the game's pixel art: hard edges, five shades of each
// zone's own ground and a three-step violet for the fissures — assets/hole_scar_z<zone>_<stage>.png): five stages of
// the same crater, small to devastated. The scar's size picks its stage, cross-fading into the next as it spreads.
const HOLE_SCAR_ART = [0, 1, 2, 3].map(z => [1, 2, 3, 4, 5].map(i => `assets/hole_scar_z${z}_${i}.png`));
function drawHoleScarArt(x, y, R, zi = 0) {
  const ims = (HOLE_SCAR_ART[zi] || HOLE_SCAR_ART[0]).map(img); if (ims.some(i => !i || !i.complete || !i.naturalWidth)) return false;
  const f = Math.max(0, Math.min(4, (R - HOLE_WORLD.scar0) / (9 * HOLE_WORLD.scarPer) * 4)), i0 = Math.floor(f), fr = f - i0;
  const targetW = R * 2.7;   // the whole scar, dead ring included
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const put = (im, al) => { const sc = targetW / im.naturalWidth, w = im.naturalWidth * sc, h = im.naturalHeight * sc; ctx.globalAlpha = al; ctx.drawImage(im, Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h)); };
  put(ims[i0], 1);
  if (fr > 0.02 && i0 < 4) put(ims[i0 + 1], fr);   // spreading into the next stage
  ctx.restore();
  return true;
}
// the ground breaking open as the scar spreads: clods and chips of earth thrown out from its new edge, a cloud of
// dust, and a jolt underfoot when the hero is near
function holeCrackBurst(c, R) {
  const w = window.GAME && GAME.world; if (!w || !w.particles) return;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 110, ex = c.x + Math.cos(a) * R, ey = c.y + 4 + Math.sin(a) * R * 0.45;
    w.particles.push({ x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.45 - 70 - Math.random() * 60, t: 0, life: 420 + Math.random() * 300, col: i % 3 ? '#5a3c26' : '#8a6a48', size: 1.5 + Math.random() * 2, drag: 0.9 });
    if (i % 2) w.particles.push({ x: ex, y: ey, vx: Math.cos(a) * 20, vy: -10, t: 0, life: 600, col: 'rgba(120,100,80,0.6)', size: 4, puff: true, drag: 0.9 });
  }
  if (w.player && Math.hypot(w.player.x - c.x, w.player.y - c.y) < 420) w.shake = Math.max(w.shake || 0, 4);
}
function drawHoleScar(c, rank, now) {
  const want = HOLE_WORLD.scar0 + rank * HOLE_WORLD.scarPer;
  if (c.scarR == null) c.scarR = c.scarTo = want;
  if (want > c.scarTo + 0.5) { c.scarFrom = c.scarR; c.scarTo = want; c.crackT = now; holeCrackBurst(c, want); }   // it has climbed: the ground breaks open
  if (c.crackT != null) { const q = Math.min(1, (now - c.crackT) / 260); c.scarR = c.scarFrom + (c.scarTo - c.scarFrom) * (1 - Math.pow(1 - q, 3)); if (q >= 1) c.crackT = null; }   // a quick jolt outward, then still
  const R = c.scarR, x = c.x, y = c.y + 4, seed = Math.round(c.x * 0.37 + c.y * 1.91), t = now / 1000;
  if (drawHoleScarArt(x, y, R, c.zi)) return;   // the painted craters in this zone's ground (preloaded at startup)
  return;   // not loaded yet: no flash of the old drawn crater (kept below)
  const ragged = (k, n, j) => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, r = R * k * (0.82 + 0.3 * auraHash(seed + i * 7.1 + j)); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45); } ctx.closePath(); };
  ctx.save();
  ragged(1.35, 26, 1); ctx.fillStyle = 'rgba(120,118,104,0.38)'; ctx.fill();   // the dead grass ring
  ragged(1.0, 22, 2); ctx.fillStyle = 'rgba(54,40,34,0.75)'; ctx.fill();        // the cracked earth of the crater
  ragged(0.62, 18, 3); ctx.fillStyle = 'rgba(24,14,18,0.85)'; ctx.fill();       // its scorched heart
  // the fissures, glowing faintly from below
  const glow = 0.35 + 0.25 * Math.sin(t * 1.7 + seed);
  for (let i = 0; i < 7 + rank; i++) {
    const a0 = auraHash(seed + i * 3.7) * Math.PI * 2, len = R * (0.7 + 0.6 * auraHash(seed + i * 5.3));
    let px = x, py = y; ctx.beginPath(); ctx.moveTo(px, py);
    for (let j = 1; j <= 4; j++) { const a = a0 + (auraHash(seed + i * 11 + j) - 0.5) * 0.7, r = len * j / 4; px = x + Math.cos(a) * r; py = y + Math.sin(a) * r * 0.45; ctx.lineTo(px, py); }
    ctx.strokeStyle = 'rgba(10,4,8,0.9)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(170,90,255,${glow * (rank >= 6 ? 0.9 : 0.55)})`; ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
// THE DEBRIS: the land torn up and drawn in. Tufts of grass, pebbles, leaves and clods of earth lift from all
// round the hole, spiral in on its pull (faster as they near), rise toward the floating core, and stretch into
// streaks as they cross its edge before vanishing — each piece reborn somewhere new each time round. More of it
// the higher the rank.
const DEBRIS_KIND = [['#5a8a3a', '#3e6a28', 2, 1], ['#8a8a86', '#5a5a58', 1, 1], ['#7ab040', '#c8b040', 2, 1], ['#6a4a2a', '#4a3018', 2, 2]];   // grass, pebble, leaf, clod
function drawHoleDebris(c, rank, now) {
  const t = now / 1000, n = HOLE_WORLD.debris0 + rank * HOLE_WORLD.debrisPer, pull = CAVE.pull * (1 + rank * 0.04), lift = holeLift(c);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const per = 3.2 + auraHash(i * 1.7) * 2.6, tt = t / per + auraHash(i * 4.1), cyc = Math.floor(tt), q = tt - cyc, sd = i * 9.3 + cyc * 3.1;
    const r0 = pull * (0.35 + 0.65 * auraHash(sd)), a0 = auraHash(sd + 1) * Math.PI * 2, e = Math.pow(q, 1.6);   // slow at first, faster as it falls in
    const r = r0 * (1 - e), a = a0 + e * (2.4 + rank * 0.15);
    const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r * 0.42 - lift * Math.pow(e, 1.4), K = DEBRIS_KIND[i % 4];
    ctx.globalAlpha = Math.min(1, q * 6) * (e > 0.9 ? (1 - e) * 10 : 1);
    if (e > 0.7) {   // crossing the edge: stretched into a streak along its fall
      const tx = -Math.sin(a), ty = Math.cos(a) * 0.42, L = 2 + (e - 0.7) * 22;
      ctx.strokeStyle = K[0]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - tx * L, y - ty * L); ctx.stroke();
    } else {
      const flip = Math.sin(t * 6 + i) > 0;   // tumbling
      ctx.fillStyle = flip ? K[0] : K[1]; ctx.fillRect(Math.round(x), Math.round(y), flip ? K[2] : K[3], flip ? K[3] : K[2]);
    }
  }
  ctx.restore();
}
// THE LENS: light bending round the core. What lies behind it — already drawn — is copied from round the core and
// laid back over a ring about it, magnified and turning very slowly, so the world seems to warp and swirl at its
// edge; then a thin, flickering photon ring of white light right at the edge of the dark.
let LENS_BUF = null;
function drawHoleLens(cx, cy, R, now) {
  const m = ctx.getTransform(), dx = m.a * cx + m.e, dy = m.d * cy + m.f, r = R * m.a * HOLE_WORLD.lens, S = Math.ceil(r * 2.6);
  if (S < 8 || dx < -S || dy < -S || dx > ctx.canvas.width + S || dy > ctx.canvas.height + S) return;
  const B = LENS_BUF || (LENS_BUF = document.createElement('canvas')); if (B.width < S || B.height < S) { B.width = B.height = Math.max(S, 256); }
  const g = B.getContext('2d'); g.clearRect(0, 0, S, S); g.drawImage(ctx.canvas, dx - S / 2, dy - S / 2, S, S, 0, 0, S, S);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.ellipse(dx, dy, r * 0.8, r * 0.62, 0, 0, Math.PI * 2); ctx.ellipse(dx, dy, r * 0.42, r * 0.32, 0, 0, Math.PI * 2); ctx.clip('evenodd');   // a tight ring round the core only
  ctx.translate(dx, dy); ctx.scale(1.1, 1.08); ctx.globalAlpha = 0.3; ctx.drawImage(B, 0, 0, S, S, -S / 2, -S / 2, S, S);   // still: bent light, not a swaying copy of the ground
  ctx.restore();
}
function drawPhotonRing(cx, cy, R, rank, now, coreR = 0) {
  const f = 0.75 + 0.25 * Math.sin(now / 90) * Math.sin(now / 37);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,250,235,${0.55 * f})`; ctx.lineWidth = 0.8; ctx.shadowColor = rank >= 6 ? '#ff6a4a' : '#c8a8ff'; ctx.shadowBlur = 4 * RES;
  const gap = HOLE_GROW.gap, rx = Math.max(R * 0.34, coreR + gap), ry = Math.max(R * 0.34 * 0.92, coreR + gap);   // (once the core has grown past it, a true circle hugging the core)
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawCaves(w, now, items) {
  if (w.holeTexts && w.holeTexts.length) (w.lateDraw = w.lateDraw || []).push(() => drawHoleTexts(w, now));   // what the hole says as it feeds
  if (!w.caves) return;
  for (const c of w.caves) {
    if (!c.open) continue;
    const { x, y } = c, rank = caveRank(c), sc = 1 + rank * 0.05;   // (no dark pit on the ground under it any more)
    // the reach of its pull, marked on the ground
    const R = CAVE.pull * (1 + rank * 0.04);
    ctx.save(); ctx.strokeStyle = 'rgba(190,120,255,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.lineDashOffset = -now / 40;
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const draw = () => drawBlackHole(c, x, y - holeLift(c), sc, rank, now);
    if (items) items.push({ y: y - 30, draw }); else draw();   // anything being swallowed draws over it
  }
}
// A ringed galaxy: a violet-blue nebula, three spiral arms of stars turning round a golden core with the black hole
// at its heart, and two tilted rings (like a planet's) that pass behind the core and in front of it.
function drawGalaxy(cx, cy, R, now, alpha = 1, backdrop = true, coreK = 1) {
  const tilt = 0.42, rot = now / 2600;
  if (backdrop) drawSpaceWindow(cx, cy, R, now, alpha);
  drawGalaxyLight(cx, cy, R, now, alpha, tilt, rot, false, backdrop, coreK);
}
// a window of deep space torn into the world, so the galaxy glows against the night whatever the ground (in the world
// this lies with the ground, under trees and people, so nothing standing beside the hole is cut off by it)
function drawSpaceWindow(cx, cy, R, now, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const sp = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.75);
  sp.addColorStop(0, 'rgba(10,6,34,0.97)'); sp.addColorStop(0.6, 'rgba(14,8,44,0.88)'); sp.addColorStop(0.85, 'rgba(30,14,70,0.45)'); sp.addColorStop(1, 'rgba(30,14,70,0)');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.75, R * 1.75 * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) { const an = i * 2.39996, rr = R * 1.6 * Math.sqrt((i * 0.618) % 1); ctx.globalAlpha = alpha * (0.35 + 0.5 * Math.abs(Math.sin(now / 500 + i)));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.7, 1, 1); }   // distant stars
  ctx.restore();
}
function drawGalaxyLight(cx, cy, R, now, alpha, tilt, rot, bare, backdropStars = true, coreK = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter';
  if (!bare) {
  const neb = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);   // the nebula glow
  neb.addColorStop(0, 'rgba(255,220,180,0.55)'); neb.addColorStop(0.25, 'rgba(170,110,255,0.35)'); neb.addColorStop(0.6, 'rgba(70,90,220,0.18)'); neb.addColorStop(1, 'rgba(30,20,90,0)');
  ctx.fillStyle = neb; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.5, R * 1.5 * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }   // (bare: the banner wants the galaxy alone, with no glow round it)
  // spiral arms of stars, flattened to the galaxy's tilt
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, tilt + 0.15);
  for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 46; i++) {
    const k = i / 46, r = R * (0.12 + k * 0.95), ang = rot + arm * Math.PI * 2 / 3 + k * 4.2 + Math.sin(i * 12.9 + arm) * 0.12;
    const x = Math.cos(ang) * r + Math.sin(i * 7.7) * 2.5, y = Math.sin(ang) * r + Math.cos(i * 5.3) * 2.5;
    const tw = 0.6 + 0.4 * Math.sin(now / 240 + i * 3 + arm);
    ctx.globalAlpha = alpha * (1 - k * 0.75) * tw; ctx.fillStyle = i % 5 === 0 ? '#ffffff' : k < 0.35 ? '#ffe0b0' : arm === 1 ? '#a8c0ff' : '#d8b0ff';
    const sz = i % 7 === 0 ? 2 : 1.2; ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  ctx.restore();
  ctx.restore();
  // the rings: back halves first
  const ring = (rr, w0, cols, front) => {
    ctx.save(); ctx.globalAlpha = alpha * (front ? 0.9 : 0.6); ctx.translate(cx, cy); ctx.rotate(-0.22); ctx.scale(1, 0.26);
    ctx.beginPath(); ctx.rect(-rr * 1.3, front ? 0 : -rr * 1.3, rr * 2.6, rr * 1.3); ctx.clip();
    const g = ctx.createRadialGradient(0, 0, rr - w0, 0, 0, rr + w0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, cols[0]); g.addColorStop(0.55, cols[1]); g.addColorStop(0.8, cols[2]); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr + w0, 0, Math.PI * 2); ctx.arc(0, 0, rr - w0, 0, Math.PI * 2, true); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { const an = now / (900 + i * 120) + i; ctx.globalAlpha = alpha * 0.5; ctx.beginPath(); ctx.arc(0, 0, rr + (i % 3 - 1) * w0 * 0.4, an, an + 0.4); ctx.stroke(); }   // glints racing round
    ctx.restore();
  };
  const rings = [[R * 1.05, R * 0.16, ['rgba(255,214,150,0.85)', 'rgba(255,170,110,0.7)', 'rgba(200,120,255,0.6)']],
    [R * 1.38, R * 0.09, ['rgba(160,190,255,0.7)', 'rgba(220,200,255,0.65)', 'rgba(140,110,255,0.5)']]];
  // the golden core first, so even the rings' back halves pass in front of its glow; then the black hole
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, R * 0.34); core.addColorStop(0, 'rgba(255,255,240,1)'); core.addColorStop(0.4, 'rgba(255,210,140,0.85)'); core.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const [rr, w0, cols] of rings) ring(rr, w0, cols, false);
  ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = '#ffd8a0'; ctx.shadowBlur = 8 * RES; ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.13 * coreK, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = 'rgba(255,240,210,0.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R * 0.13 * coreK + 0.8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  for (const [rr, w0, cols] of rings) ring(rr, w0, cols, true);
  if (backdropStars) {   // stars twinkling round it (the banner's galaxy; in the world the hole stands alone)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const an = i * 2.4 + now / 8000, rr = R * (1.5 + (i % 4) * 0.15), x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.6, tw = Math.max(0, Math.sin(now / 300 + i * 1.7));
      ctx.globalAlpha = alpha * tw; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.5, y - 2, 1, 4); ctx.fillRect(x - 2, y - 0.5, 4, 1); }
    ctx.restore();
  }
}
const HOLE_GROW = { per: 0.25, max: 4, ease: 0.06, gap: 1.6 };
function drawBlackHole(c, cx, cy, sc, rank, now) {
  const diskR = 42 * sc;
  drawHoleLens(cx, cy, 30 * sc, now);   // the world behind it bent round the core
  const G = HOLE_GROW, want = Math.min(G.max, 1 + (c.eaten || 0) * G.per); c.coreK = (c.coreK || 1) + (want - (c.coreK || 1)) * G.ease;   // the more it has swallowed, the bigger the dark
  drawGalaxy(cx, cy, 30 * sc, now, 1, false, c.coreK);
  drawPhotonRing(cx, cy, 30 * sc, rank, now, 30 * sc * 0.13 * c.coreK);
  const W = window.GAME && GAME.world, py = cy - diskR * 0.55 - 20, secs = Math.ceil(c.t / 1000), left = c.t / CAVE.life;
  if (W) (W.lateDraw = W.lateDraw || []).push(() => drawHolePlate(cx, py, rank, secs, now, left)); else drawHolePlate(cx, py, rank, secs, now, left);   // over the night's tint
}
// THE RANK PLATE over a black hole: a window onto the void, the rank gem on the left, the hole's name, the seconds
// it has left over a draining bar. The higher the rank, the graver it looks (HOLE_DREAD) — by restraint, not by
// decoration: the warm gold rounded plate of a common BLACK HOLE (F–C) hardens into bronze with cut corners (DEEP RIFT,
// B–A), then dark iron with a crimson hairline and a slow pulse (VOID MAW, S–SS), and at the top a sharp-ended
// obsidian blade (WORLD-EATER, SSS–SSS+): near-black, a single thin rift of red light across it, an obsidian shard
// for a gem with a red core, its name in pale bone letters set wide apart, and almost no movement but a deep, slow
// breath of light. Drawn after the night's tint (world.lateDraw).
const HOLE_DREAD = [
  { name: 'BLACK HOLE',  cut: 0, frame: ['#fff0b0', '#e0a63a', '#a8661c', '#ffd77a'], neb: [120, 70, 200], title: ['#fff6c8', '#ffd25a', '#d08a20'], edge: '#2a1206', glow: null,      w: 120 },
  { name: 'DEEP RIFT',   cut: 4, frame: ['#e8c8a0', '#a8743a', '#4a2a14', '#c89a6a'], neb: [110, 50, 130], title: ['#ffe8d0', '#e8a868', '#8a4a20'], edge: '#1e0c04', glow: '#c86a3a', w: 120 },
  { name: 'VOID MAW',    cut: 7, frame: ['#8a8a96', '#3a3a46', '#121218', '#5a5a66'], neb: [70, 10, 30],   title: ['#f0e0d8', '#d8b8b0', '#8a5a58'], edge: '#0a0000', glow: '#a01010', w: 124 },
  { name: 'WORLD-EATER', cut: -1, frame: ['#3a3a42', '#16161c', '#050508', '#2a2a32'], neb: [40, 0, 6],   title: ['#f4ece0', '#e0d4c4', '#a8988a'], edge: '#000000', glow: '#8a0000', w: 150 },
];
const dreadOf = rank => HOLE_DREAD[rank >= 8 ? 3 : rank >= 6 ? 2 : rank >= 4 ? 1 : 0];
// the plate's outline: rounded (cut 0), cut corners (cut > 0), or a blade pointed at both ends (cut -1)
function platePath(x, y, w, h, cut) {
  ctx.beginPath();
  if (cut === 0) { rrect(ctx, x, y, w, h, 7); return; }
  if (cut < 0) { const t = h / 2; ctx.moveTo(x, y + t); ctx.lineTo(x + t, y); ctx.lineTo(x + w - t, y); ctx.lineTo(x + w, y + t); ctx.lineTo(x + w - t, y + h); ctx.lineTo(x + t, y + h); ctx.closePath(); return; }
  ctx.moveTo(x + cut, y); ctx.lineTo(x + w - cut, y); ctx.lineTo(x + w, y + cut); ctx.lineTo(x + w, y + h - cut); ctx.lineTo(x + w - cut, y + h); ctx.lineTo(x + cut, y + h); ctx.lineTo(x, y + h - cut); ctx.lineTo(x, y + cut); ctx.closePath();
}
// letters set apart (the grave names), centred or left-aligned at x
function spacedPix(str, x, y, size, cols, edge, gap, align = 'left') {
  const im = [...str].map(ch => pixText(ch, fontPx(size), 700, cols, edge)), wd = [...str].map(ch => textW(ch, size));
  let tw = wd.reduce((a, b) => a + b, 0) + gap * (str.length - 1), cx = align === 'center' ? x - tw / 2 : x;
  im.forEach((I, i) => { drawPix(I, cx + wd[i] / 2, y, 'center'); cx += wd[i] + gap; });
  return tw;
}
// THE EVIL AURA round a plate, after the classic power-up aura (a hero lit up by his own energy): a darkness
// gathers round the plate so the light reads; a flame-shaped ENVELOPE of energy hugs it, its crown rising in
// flickering peaks and its sides flaring, in three nested layers that brighten toward the plate (a wide dark-crimson
// veil, a red body, a hot inner sheath); the plate's own edge burns with a thin white-hot RIM LIGHT; the whole
// aura FLICKERS like a living flame, and sparks lift off it. In the hole's colours: crimson and violet, not gold.
// It wakes with the rank (a faint shimmer on DEEP RIFT, full on VOID MAW, a storm round WORLD-EATER, with red
// lightning forking through it) and swells as time runs out. The front=true call draws the rim light over the plate.
const auraHash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function auraEnvelope(x0, y0, w, h, grow, crown, t, ph) {
  // a flame silhouette round the box (x0, y0, w, h): sides flaring out as they rise, a crown of peaks over the top
  const K = Math.max(5, Math.round(w / 16)), pts = [];
  const flick = (i, sp) => 0.65 + 0.35 * Math.sin(t * sp + i * 1.9 + ph) * Math.sin(t * sp * 0.53 + i * 0.7 + ph * 2);
  pts.push([x0 - grow * 0.6, y0 + h + grow * 0.35]);                                         // bottom left
  pts.push([x0 - grow * (1.1 + 0.15 * flick(0, 7)), y0 + h * 0.4]);                           // left side, flaring
  pts.push([x0 - grow * (0.9 + 0.3 * flick(1, 6)), y0 - grow * 0.6]);
  for (let i = 0; i <= K * 2; i++) {                                                          // the crown: peak, valley, peak…
    const u = i / (K * 2), x = x0 - grow * 0.4 + u * (w + grow * 0.8), mid = Math.sin(u * Math.PI);
    const peak = i % 2 === 0, hgt = peak ? crown * (0.45 + 0.55 * mid) * flick(i, 9 + (i % 3)) : crown * 0.18 * mid;
    pts.push([x + (peak ? Math.sin(t * 5 + i) * 1.5 : 0), y0 - grow * 0.5 - hgt]);
  }
  pts.push([x0 + w + grow * (0.9 + 0.3 * flick(2, 6)), y0 - grow * 0.6]);
  pts.push([x0 + w + grow * (1.1 + 0.15 * flick(3, 7)), y0 + h * 0.4]);
  pts.push([x0 + w + grow * 0.6, y0 + h + grow * 0.35]);                                       // bottom right
  ctx.beginPath(); ctx.moveTo((pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2);
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  ctx.closePath();
}
function drawHoleAura(x0, y0, w, h, lvl, now, urg, front = false, cut = 0) {
  if (lvl < 1) return;
  const t = now / 1000, flick = 0.82 + 0.18 * Math.sin(t * 23) * Math.sin(t * 13.7 + 1.3);   // the whole aura flickers
  const pw = [0, 0.3, 0.8, 1][lvl] * (0.8 + 0.4 * urg) * flick, cx = x0 + w / 2, cy = y0 + h / 2;
  ctx.save();
  if (front) {   // the rim light: the plate's own edge burning white-hot, then red
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#ff2030'; ctx.shadowBlur = 6 * RES * pw;
    platePath(x0 + 0.5, y0 + 0.5, w - 1, h - 1, cut > 0 ? cut - 0.5 : cut); ctx.strokeStyle = `rgba(255,90,30,${0.75 * pw})`; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.shadowBlur = 0;
    platePath(x0 + 0.5, y0 + 0.5, w - 1, h - 1, cut > 0 ? cut - 0.5 : cut); ctx.strokeStyle = `rgba(255,225,215,${0.55 * pw})`; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore(); return;
  }
  // the darkness it gathers round itself, so the light reads (as the dark stage behind a powering-up hero)
  const dk = ctx.createRadialGradient(cx, cy - 6, h * 0.4, cx, cy - 6, w * 0.85);
  dk.addColorStop(0, `rgba(8,0,6,${0.55 * pw})`); dk.addColorStop(0.6, `rgba(8,0,6,${0.3 * pw})`); dk.addColorStop(1, 'rgba(8,0,6,0)');
  ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(cx, cy - 6, w * 0.85, h * 2.2, 0, 0, Math.PI * 2); ctx.fill();
  // the envelope, three nested layers, each brighter and closer, each on its own flicker
  ctx.globalCompositeOperation = 'lighter';
  const layer = (grow, crown, ph, c0, c1, blur) => {
    auraEnvelope(x0, y0, w, h, grow, crown, t, ph);
    const g = ctx.createLinearGradient(0, y0 - crown - grow, 0, y0 + h + grow); g.addColorStop(0, c0.replace('A', 0)); g.addColorStop(0.35, c0.replace('A', (0.55 * pw).toFixed(3))); g.addColorStop(1, c1.replace('A', (0.75 * pw).toFixed(3)));
    ctx.shadowColor = c1.replace('A', 1); ctx.shadowBlur = blur * RES * pw; ctx.fillStyle = g; ctx.fill();
  };
  layer(18, 40 + 14 * urg, 0.0, 'rgba(70,0,40,A)', 'rgba(120,0,10,A)', 10);   // the wide veil, deep crimson going violet at its tips
  layer(10, 27 + 9 * urg, 1.7, 'rgba(170,6,6,A)', 'rgba(190,10,0,A)', 6);      // the red body
  layer(4, 14 + 5 * urg, 3.1, 'rgba(255,120,50,A)', 'rgba(255,60,20,A)', 4);   // the hot orange sheath round the plate
  ctx.shadowBlur = 0;
  // sparks lifting off it: crisp pixels, rising and drifting
  ctx.globalAlpha = 1;
  for (let i = 0; i < 6 + lvl * 6; i++) {
    const q = ((t * (0.5 + (i % 4) * 0.12)) + i * 0.137) % 1, sx = Math.round(x0 + ((i * 47.3) % w) + Math.sin(t * 1.7 + i) * 5 * q), sy = Math.round(y0 - 4 - q * (26 + 16 * urg));
    ctx.globalAlpha = Math.sin(q * Math.PI) * pw; ctx.fillStyle = i % 3 ? '#ff5a3a' : '#ffd0b0'; ctx.fillRect(sx, sy, 1, 1 + (i % 2));
  }
  ctx.globalAlpha = 1;
  // red lightning forking up through the world-eater's aura now and then
  if (lvl >= 3) {
    const r = rng(Math.floor(t * 6) * 977 + 13);
    if (r() < 0.45) {
      ctx.strokeStyle = 'rgba(255,190,180,0.95)'; ctx.lineWidth = 0.8; ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 5 * RES;
      let px = x0 + r() * w, py = y0 - 2; ctx.beginPath(); ctx.moveTo(px, py);
      for (let j = 0; j < 6; j++) { px += (r() - 0.5) * 9; py -= 3 + r() * 5; ctx.lineTo(px, py); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
// WHAT THE HOLE SAYS when it feeds, in its own voice rather than a plain floating word:
//   DEVOURED — slams in oversized and shaking, split into a blood-red ghost that snaps back into the letters, pale
//   bone lettering set wide over a smear of darkness and a crimson rift that tears open beneath it; under it the
//   hole's hunger as a row of diamonds (the meal just eaten flashes white). Then it rises and crumbles into ash.
//   ASCENDS — when it ranks up: the new rank huge in its colour over a burst of darkness, ASCENDS beneath, a
//   shock of red light, and the same crumbling end. Drawn after the night's tint (world.lateDraw).
const HOLE_TEXT = { life: 1700, slam: 160 };
function holeText(w, c, kind) {
  (w.holeTexts = w.holeTexts || []).push({ x: c.x, y: c.y - holeLift(c) - 70, cx: c.x, cy: c.y - holeLift(c), t0: performance.now(), kind, fed: c.fed || 0, need: holeNeed(c), rank: caveRank(c), top: c.grade >= 9 - ZONES[c.zi].ranks[0] });
  w.holeTexts = w.holeTexts.filter(h => performance.now() - h.t0 < HOLE_TEXT.life).slice(-4);
}
// DEVOURED, eaten: the word slams in (pale bone, a red ghost snapping into it), hangs a moment while the hole tugs
// at it (each letter leaning and trembling toward the core), then the hole swallows it letter by letter, the nearest
// first: each one spirals in, stretching into a streak along its fall, spinning, shrinking and reddening, a fading
// trail behind it, and is gone into the dark. The hunger diamonds under it are pulled in after the letters.
const DEVOUR = { hold: 520, eat: 1050 };
function drawDevoured(h, now, idx) {
  const age = now - h.t0, slam = Math.max(0, 1 - age / HOLE_TEXT.slam), word = 'DEVOURED', sz = 7.5 * (1 + slam * 0.6), gap = 2;
  const x = Math.round(h.x + slam * 3 * Math.sin(age * 0.9)), y = Math.round(h.y - idx * 4 - 4 * (1 - Math.min(1, age / 200)));
  const ws = [...word].map(ch => ctw(ch, sz)), tot = ws.reduce((a, b) => a + b, 0) + gap * (word.length - 1);
  const bone = ['#f6eee2', '#e2cfc0', '#9a6a60'];
  // the order it eats them: nearest the core first
  const pos = []; let px = x - tot / 2; ws.forEach((wd, i) => { pos.push([px + wd / 2, y]); px += wd + gap; });
  const order = pos.map((p, i) => [Math.hypot(p[0] - h.cx, p[1] - h.cy), i]).sort((a, b) => a[0] - b[0]).map(e => e[1]);
  const glyph = (ch, cols, edge) => pixText(ch, fontPx(sz), 700, cols, edge);
  ctx.save();
  pos.forEach(([lx, ly], i) => {
    const start = DEVOUR.hold + order.indexOf(i) * 70, q = Math.max(0, Math.min(1, (age - start) / (DEVOUR.eat - DEVOUR.hold - 300)));
    if (q >= 1) return;
    const dx = h.cx - lx, dy = h.cy - ly, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    // before it falls: a lean and a tremble toward the hole, growing as its turn nears
    const tug = Math.min(1, Math.max(0, (age - 180) / Math.max(1, start - 180))), tr = tug * 1.2 * Math.sin(now / 23 + i * 2);
    let gx = lx + ux * tug * 2 + tr * -uy, gy = ly + uy * tug * 2 + tr * ux, rot = 0, sx = 1, sy = 1, a = 1;
    if (q > 0) {   // falling in: a spiral, accelerating
      const e = q * q, ang = Math.atan2(-dy, -dx) + e * 1.8 * (i % 2 ? 1 : -1), r = d * (1 - e);   // starts right where the letter sits, curls in
      gx = h.cx + Math.cos(ang) * r; gy = h.cy + Math.sin(ang) * r * (1 - 0.3 * e);
      rot = e * 6 * (i % 2 ? 1 : -1); sx = Math.max(0.05, 1 - e * 0.95) * (1 + e * 2.2); sy = Math.max(0.05, 1 - e); a = 1 - e * 0.6;
      // the streak it leaves
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * (1 - e);
      const tg = ctx.createLinearGradient(lx, ly, gx, gy); tg.addColorStop(0, 'rgba(160,20,40,0)'); tg.addColorStop(1, 'rgba(255,90,70,0.9)');
      ctx.strokeStyle = tg; ctx.lineWidth = 1.4 * (1 - e) + 0.4; ctx.beginPath(); ctx.moveTo(lx + (gx - lx) * 0.4, ly + (gy - ly) * 0.4); ctx.lineTo(gx, gy); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(rot + (q > 0 ? Math.atan2(uy, ux) * 0 : 0)); ctx.scale(sx, sy); ctx.globalAlpha = a;
    if (slam > 0) drawPix(glyph(word[i], ['#ff3a2a', '#b01010', '#500000'], null), 3 * slam, slam, 'center');   // the red ghost snapping in
    drawPix(glyph(word[i], q > 0.3 ? ['#ffb0a0', '#e04030', '#601010'] : bone, '#000000'), 0, 0, 'center');
    ctx.restore();
  });
  // the hunger diamonds, pulled in last
  if (!h.top) {
    const n = h.need, gp = 7, x0 = x - (n - 1) * gp / 2;
    for (let i = 0; i < n; i++) {
      const start = DEVOUR.hold + word.length * 70 + i * 40, q = Math.max(0, Math.min(1, (age - start) / 420)); if (q >= 1) continue;
      const bx = x0 + i * gp, by = y + 12, e = q * q, dx2 = bx + (h.cx - bx) * e, dy2 = by + (h.cy - by) * e, s2 = 1 - e;
      const full = i < h.fed, fresh = i === h.fed - 1 && age < 400;
      ctx.fillStyle = full ? (fresh ? '#ffffff' : '#d01818') : 'rgba(30,10,14,0.8)';
      ctx.beginPath(); ctx.moveTo(dx2, dy2 - 3 * s2); ctx.lineTo(dx2 + 2.5 * s2, dy2); ctx.lineTo(dx2, dy2 + 3 * s2); ctx.lineTo(dx2 - 2.5 * s2, dy2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = full ? '#ff6a4a' : 'rgba(180,40,40,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
  }
  ctx.restore();
}
function drawHoleTexts(w, now) {
  const L = (w.holeTexts || []).filter(h => now - h.t0 < HOLE_TEXT.life); w.holeTexts = L;
  L.forEach((h, idx) => {
    const age = now - h.t0, k = age / HOLE_TEXT.life, slam = Math.max(0, 1 - age / HOLE_TEXT.slam);
    const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, rise = k < 0.55 ? 0 : (k - 0.55) * 26, shake = slam * 3 * Math.sin(age * 0.9);
    const x = Math.round(h.x + shake), y = Math.round(h.y - rise - idx * 4 - 4 * (1 - Math.min(1, age / 200)));
    ctx.save(); ctx.globalAlpha = fade;
    if (h.kind !== 'rank') { drawDevoured(h, now, idx); ctx.restore(); return; }   // eaten by the hole, letter by letter
    // a crimson rift tearing open beneath the words
    const tear = Math.min(1, age / 260) * 38, ry = y + (h.kind === 'rank' ? 9 : 6);
    const rg = ctx.createLinearGradient(x - tear, 0, x + tear, 0); rg.addColorStop(0, 'rgba(255,30,20,0)'); rg.addColorStop(0.5, 'rgba(255,60,40,0.95)'); rg.addColorStop(1, 'rgba(255,30,20,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rg; ctx.fillRect(x - tear, ry, tear * 2, 1);
    ctx.fillStyle = 'rgba(255,40,20,0.25)'; ctx.fillRect(x - tear * 0.7, ry - 1, tear * 1.4, 3);
    ctx.globalCompositeOperation = 'source-over';
    const sz = (h.kind === 'rank' ? 7 : 7.5) * (1 + slam * 0.6), bone = ['#f6eee2', '#e2cfc0', '#9a6a60'];
    if (h.kind === 'rank') {
      // the new rank, huge in its colour, over a burst of darkness and a shock of red
      const col = rankColor(h.rank, now), solid = col[0] === '#' ? col : rankSolid(h.rank), big = 16 * (1 + slam * 0.8);
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,40,30,${(1 - Math.min(1, age / 500)) * 0.8})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y - 10, 10 + age * 0.08, 5 + age * 0.03, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      if (slam > 0) drawPix(pixText(RANKS[h.rank], fontPx(big), 700, ['#ff2a1a', '#a00a0a', '#400000'], null), x + 3 * slam, y - 10, 'center');   // the red ghost
      drawPix(pixText(RANKS[h.rank], fontPx(big), 700, ['#ffffff', solid, mixCol(solid, '#000000', 0.5)], '#000000'), x, y - 10, 'center');
      spacedPix('ASCENDS', x, y + 3, sz, bone, '#000000', 2.5, 'center');
    } else {
      if (slam > 0) spacedPix('DEVOURED', x + 3 * slam, y + 1 * slam, sz, ['#ff3a2a', '#b01010', '#500000'], null, 2, 'center');   // the red ghost snapping back in
      spacedPix('DEVOURED', x, y, sz, bone, '#000000', 2, 'center');
      if (!h.top) {   // its hunger: a diamond per meal it needs, filled as it feeds, the newest flashing white
        const n = h.need, gap = 7, x0 = x - (n - 1) * gap / 2;
        for (let i = 0; i < n; i++) {
          const dx = Math.round(x0 + i * gap), dy = y + 12, full = i < h.fed, fresh = i === h.fed - 1 && age < 400;
          ctx.fillStyle = full ? (fresh ? '#ffffff' : '#d01818') : 'rgba(0,0,0,0.6)';
          ctx.beginPath(); ctx.moveTo(dx, dy - 3); ctx.lineTo(dx + 2.5, dy); ctx.lineTo(dx, dy + 3); ctx.lineTo(dx - 2.5, dy); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = full ? '#ff6a4a' : 'rgba(180,40,40,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }
    // the end: the words crumble into ash, flakes peeling up off them
    if (k > 0.55) {
      const q = (k - 0.55) / 0.45;
      for (let i = 0; i < 18; i++) {
        const fx = x - 30 + (i * 37) % 60 + Math.sin(i * 2 + age / 200) * 3, fy = y - q * (10 + (i % 5) * 4) - (i % 3);
        ctx.globalAlpha = fade * (0.4 + 0.6 * ((i * 7) % 3) / 2); ctx.fillStyle = i % 4 ? '#3a2a28' : '#c02010'; ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
      }
    }
    ctx.restore();
  });
}

// THE DREAD: a black hole of S rank or higher is felt before it is seen. Within range of one (and more the
// closer you stand, the higher its rank, the less time it has left), the world reacts: the colour drains out of
// everything and it darkens toward a bruised red; darkness seeps in unevenly from the screen's edges, swelling and
// receding.
// The plate over the hole is drawn after all this, so it alone stays clean and bright. (holeDread → dread 0..1)
const DREAD = { range: 620, min: 6 };
let DREAD_BUF = null;
function holeDread(w) {
  if (!w || !w.caves || !w.player || w.cave) return { d: 0 };
  let best = { d: 0 };
  for (const c of w.caves) {
    if (!c.open) continue;
    const rank = caveRank(c); if (rank < DREAD.min) continue;
    const dist = Math.hypot(c.x - w.player.x, c.y - w.player.y); if (dist > DREAD.range) continue;
    const near = 1 - dist / DREAD.range, tier = rank >= 8 ? 1 : 0.65, urg = 1 - c.t / CAVE.life;
    const d = Math.min(1, Math.pow(near, 0.7) * tier * (0.85 + 0.3 * urg));
    if (d > best.d) best = { d, urg, c };
  }
  return best;
}
function drawDread(w, now) {
  const D = holeDread(w); w.dread = D.d;
  if (D.d <= 0.01) return;
  const d = D.d, t = now / 1000;
  ctx.save();
  // the colour drains out of the world, and it darkens toward a bruised red — everywhere but the hole itself, which
  // keeps its colour: a clear zone round it, the drain fading in over a few soft bands out from its edge
  const drain = a => {
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${0.75 * d * a})`; ctx.fillRect(0, 0, VW, VH);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${Math.round(150 - 40 * d)},${Math.round(110 - 70 * d)},${Math.round(115 - 70 * d)},${0.55 * d * a})`; ctx.fillRect(0, 0, VW, VH);
    ctx.globalCompositeOperation = 'source-over';
  };
  const c = D.c, Z = w.zoom || ZOOM, cam = w.cam || { x: 0, y: 0 }, sc = 1 + caveRank(c) * 0.05;
  const hx = (c.x - cam.x) * Z, hy = (c.y - holeLift(c) - cam.y) * Z, rx = 56 * sc * Z, ry = rx * 0.62, BANDS = 6, step = 0.16;
  const ell = (k) => { ctx.moveTo(hx + rx * k, hy); ctx.ellipse(hx, hy, rx * k, ry * k, 0, 0, Math.PI * 2); };
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ell(1 + BANDS * step); ctx.clip('evenodd'); drain(1); ctx.restore();   // outside the zone: the full drain
  for (let i = 0; i < BANDS; i++) {   // the soft edge: bands from the hole outward, each draining a little more
    ctx.save(); ctx.beginPath(); ell(1 + (i + 1) * step); ell(1 + i * step); ctx.clip('evenodd'); drain((i + 1) / (BANDS + 1)); ctx.restore();
  }
  // a vignette closing in
  const r0 = VH * (0.62 - 0.22 * d), vg = ctx.createRadialGradient(VW / 2, VH / 2, r0, VW / 2, VH / 2, VW * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.85 * d})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  // darkness seeping in unevenly from the edges: soft black pools that swell and recede on slow, separate rhythms,
  // painted small and stretched smooth over the screen, so it has no shapes, only a creeping, breathing edge
  const B = DREAD_BUF || (DREAD_BUF = document.createElement('canvas')); B.width = 96; B.height = 54;
  const g = B.getContext('2d'); g.clearRect(0, 0, 96, 54);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, per = i % 4, slow = Math.sin(t * (0.23 + (i % 5) * 0.07) + i * 2.7), slow2 = Math.sin(t * 0.13 + i * 1.3);
    const pos = per === 0 ? [u * 96, 0] : per === 1 ? [96, u * 54] : per === 2 ? [u * 96, 54] : [0, u * 54];
    const r = (6 + 20 * d) * (0.3 + 0.7 * (slow + 1) / 2) * (i % 3 === 0 ? 1.45 : i % 3 === 1 ? 0.75 : 1);   // very uneven: some pools reach far in, some barely show
    const inward = (i % 3 === 0 ? 4 : -3) * (0.5 + 0.5 * slow2), x = pos[0] + slow2 * 8 * (per % 2 ? 0 : 1) + (per === 1 ? -inward : per === 3 ? inward : 0), y = pos[1] + slow2 * 5 * (per % 2 ? 1 : 0) + (per === 0 ? inward : per === 2 ? -inward : 0);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${0.9 * d})`); gr.addColorStop(0.55, `rgba(4,0,3,${0.55 * d})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.imageSmoothingEnabled = true; ctx.drawImage(B, 0, 0, 96, 54, 0, 0, VW, VH);
  ctx.restore();
}
// THE PAINTED PLATES (assets/hole_plate_*.png, cut from the user's artwork): one frame per tier of dread, each with
// its gem socket (centre found from the socket's dark interior), title window and timer groove measured in the
// art's own pixels; the game lays the rank gem, the
// name, the seconds and the draining bar into them. Until the art has loaded, the drawn plate below stands in.
const HOLE_PLATE_ART = [
  { src: 'assets/hole_plate_black.png',      gem: [91, 82, 50],  title: [255, 19, 544, 52],  bar: [262, 122, 537, 137] },
  { src: 'assets/hole_plate_rift.png',       gem: [89, 82, 50],  title: [255, 17, 540, 49],  bar: [260, 124, 535, 139] },
  { src: 'assets/hole_plate_maw.png',        gem: [94, 97, 52],  title: [257, 31, 548, 62],  bar: [245, 136, 547, 153] },
  { src: 'assets/hole_plate_worldeater.png', gem: [147, 90, 50], title: [305, 24, 600, 63],  bar: [312, 125, 598, 142] },
];
const HOLE_PLATE_SCALE = 0.15;   // art pixels → world pixels (about the width of the hole's disk)
function drawHolePlateArt(cx, ty, rank, secs, now, left) {
  const D = dreadOf(rank), lvl = HOLE_DREAD.indexOf(D), A = HOLE_PLATE_ART[lvl], im = img(A.src);
  if (!im || !im.complete || !im.naturalWidth) return false;
  const S = HOLE_PLATE_SCALE, w = im.naturalWidth * S, h = im.naturalHeight * S, x0 = Math.round(cx - w / 2), y0 = Math.round(ty - h / 2);
  const col = rankColor(rank, now), solid = col[0] === '#' ? col : rankSolid(rank), k = Math.max(0, Math.min(1, left)), glow = D.glow || solid;
  const breath = lvl >= 2 ? 0.5 + 0.5 * Math.sin(now / (lvl >= 3 ? 1500 : 900)) : 0.5 + 0.5 * Math.sin(now / 420);
  const R = (r4) => [x0 + r4[0] * S, y0 + r4[1] * S, (r4[2] - r4[0]) * S, (r4[3] - r4[1]) * S];
  ctx.save();
  // its shadow on the ground below, and a glow of its tier round it
  ctx.shadowColor = lvl ? glow : 'rgba(0,0,0,0.7)'; ctx.shadowBlur = (lvl >= 2 ? 4 + 8 * breath : 5) * RES; ctx.shadowOffsetY = lvl ? 0 : 2 * RES;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, x0, y0, w, h);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // a glint travelling along the frame
  { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gx = x0 + w * (0.15 + 0.7 * ((now / 4200) % 1)), sg = ctx.createLinearGradient(gx - 10, 0, gx + 10, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,240,220,${lvl >= 2 ? 0.25 : 0.4})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(gx - 10, y0 + 2, 20, 1.5); ctx.restore(); }
  // the title window: the name, and the seconds left
  const [tx, tyy, tw, th] = R(A.title), mid = tyy + th / 2 + 0.5;
  if (lvl >= 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(160,10,10,${0.08 + 0.12 * breath})`; ctx.fillRect(tx + 2, tyy + 1, tw - 4, th - 2); ctx.restore(); }   // the window smoulders
  // the name, centred in the window and set as large (and as wide apart) as fits
  const ts = S / 0.24;   // text scales with the plate
  let fs = 7.2 * ts, gap = (lvl >= 2 ? (lvl >= 3 ? 1.6 : 1) : 0.4) * ts; const fitW = (f, g) => [...D.name].reduce((a2, ch) => a2 + textW(ch, f), 0) + g * (D.name.length - 1);
  while (fs > 4 && fitW(fs, gap) > tw - 5 * ts) { if (gap > 0.3) gap -= 0.2; else fs -= 0.2; }
  spacedPix(D.name, tx + tw / 2, mid + 1, fs, ['#000000', '#000000', '#000000'], null, gap, 'center'); spacedPix(D.name, tx + tw / 2, mid, fs, D.title, D.edge, gap, 'center');
  // the seconds left, in the open band on the right of the plate (between the window and the groove)
  const [bx0, by0, bw0] = R(A.bar), sy = (mid + by0) / 2 + 1, sxR = Math.min(x0 + w - 10 * ts - (lvl >= 3 ? 26 * ts : 0), bx0 + bw0 + 22 * ts);
  text(`${secs}s`, sxR, sy, secs <= 15 ? '#ff6a5a' : lvl >= 2 ? '#e0d0c8' : '#f4ecf8', Math.max(4.6, 7 * ts), 'right');
  // the timer groove: the bar draining, glossy, a spark at its end on the calmer ones
  const [bx, by, bw, bh] = R(A.bar), barCol = lvl >= 2 ? (lvl >= 3 ? '#b01408' : '#d02a1a') : solid;
  if (k > 0) {
    ctx.save(); rrect(ctx, bx + 1, by + 0.8, (bw - 2) * k, bh - 1.6, (bh - 1.6) / 2); ctx.clip();
    const bar = ctx.createLinearGradient(0, by, 0, by + bh); bar.addColorStop(0, mixCol(barCol, '#ffffff', 0.45)); bar.addColorStop(0.5, barCol); bar.addColorStop(1, mixCol(barCol, '#000000', 0.4));
    ctx.fillStyle = bar; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, by + 1, bw, Math.max(0.8, bh * 0.25));
    ctx.restore();
    if (lvl < 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = barCol; ctx.shadowBlur = 5 * RES; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx + 1 + (bw - 2) * k, by + bh / 2, 1.3 + breath * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  // the rank gem in its socket: a cut stone for the common ones, an obsidian shard with a red core for the grave ones
  const gx = x0 + A.gem[0] * S, gy = y0 + A.gem[1] * S, gr = A.gem[2] * S * 0.78;
  if (lvl >= 2) {
    const ob = ctx.createLinearGradient(gx - gr, gy - gr, gx + gr, gy + gr); ob.addColorStop(0, '#2a2a34'); ob.addColorStop(0.5, '#08080c'); ob.addColorStop(1, '#16161e');
    ctx.fillStyle = ob; ctx.beginPath(); ctx.moveTo(gx, gy - gr); ctx.lineTo(gx + gr, gy); ctx.lineTo(gx, gy + gr); ctx.lineTo(gx - gr, gy); ctx.closePath(); ctx.fill();
    const core = ctx.createRadialGradient(gx, gy + 1, 0, gx, gy + 1, gr * 0.8); core.addColorStop(0, `rgba(255,70,30,${0.55 + 0.35 * breath})`); core.addColorStop(1, 'rgba(120,0,0,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(gx, gy + 1, gr * 0.8, 0, Math.PI * 2); ctx.fill();
  } else {
    const gem = ctx.createRadialGradient(gx - gr * 0.35, gy - gr * 0.4, 1, gx, gy, gr); gem.addColorStop(0, '#ffffff'); gem.addColorStop(0.3, solid); gem.addColorStop(1, mixCol(solid, '#000000', 0.65));
    ctx.fillStyle = gem; ctx.beginPath(); ctx.moveTo(gx, gy - gr); ctx.lineTo(gx + gr, gy); ctx.lineTo(gx, gy + gr); ctx.lineTo(gx - gr, gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(gx - gr * 0.5, gy - gr * 0.1); ctx.lineTo(gx, gy - gr * 0.6); ctx.lineTo(gx + gr * 0.1, gy - gr * 0.45); ctx.lineTo(gx - gr * 0.35, gy); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // the rank, in the plate's own lettering (the same metal as its name), sized to fill the socket; the rank's colour
  // only as a glow behind it, and a "+" as a small raised mark so SSS+ still fits
  const R2 = RANKS[rank], plus = R2.endsWith('+'), core2 = plus ? R2.slice(0, -1) : R2;
  let rs = 11; while (rs > 3.8 && textW(core2, rs) > gr * 1.55) rs -= 0.3;
  ctx.save(); ctx.shadowColor = rank >= 9 ? `hsl(${(now / 6) % 360},90%,60%)` : solid; ctx.shadowBlur = (3 + 3 * breath) * RES;
  drawPix(pixText(core2, fontPx(rs), 700, D.title, D.edge), gx - (plus ? 1.5 : 0), gy + 1, 'center');
  ctx.restore();
  drawPix(pixText(core2, fontPx(rs), 700, D.title, D.edge), gx - (plus ? 1.5 : 0), gy + 1, 'center');   // crisp over its glow
  if (plus) drawPix(pixText('+', fontPx(rs * 0.7), 700, D.title, D.edge), gx + textW(core2, rs) / 2 + 0.5, gy - rs * 0.32, 'center');
  return true;
}
function drawHolePlate(cx, ty, rank, secs, now, left = 1) {
  if (drawHolePlateArt(cx, ty, rank, secs, now, left)) return;   // the painted frames (preloaded at startup)
  return;   // not loaded yet: show nothing rather than flash the old drawn plate (kept below)
  const D = dreadOf(rank), lvl = HOLE_DREAD.indexOf(D), col = rankColor(rank, now), solid = col[0] === '#' ? col : rankSolid(rank);
  const k = Math.max(0, Math.min(1, left));
  const breath = lvl >= 2 ? 0.5 + 0.5 * Math.sin(now / (lvl >= 3 ? 1500 : 900)) : 0.5 + 0.5 * Math.sin(now / 420);   // slower the graver
  const w = D.w, h = 30, x0 = Math.round(cx - w / 2 + 8), y0 = Math.round(ty - 15), cut = D.cut;
  const metal = (y, hh) => { const g = ctx.createLinearGradient(0, y, 0, y + hh); D.frame.forEach((c, i) => g.addColorStop(i / 3, c)); return g; };
  const glow = D.glow || solid;
  ctx.save();
  // its shadow on the ground below, so it floats
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 8, y0 + h + 20, w * 0.42, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 6 * RES; ctx.shadowOffsetY = 3 * RES;
  ctx.fillStyle = '#000'; platePath(x0, y0 + 1, w, h, cut); ctx.fill(); ctx.restore();
  // the plate and its glow
  ctx.shadowColor = glow; ctx.shadowBlur = (lvl >= 2 ? 4 + 8 * breath : 5 + 5 * breath) * RES;
  ctx.fillStyle = lvl >= 2 ? '#040306' : '#0a0616'; platePath(x0, y0, w, h, cut); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save(); platePath(x0, y0, w, h, cut); ctx.clip();
  const [nr, ng, nb] = D.neb, neb = ctx.createRadialGradient(x0 + w * 0.6, y0 + h * 0.5, 2, x0 + w * 0.6, y0 + h * 0.5, w * 0.6);
  neb.addColorStop(0, `rgba(${nr},${ng},${nb},${lvl >= 2 ? 0.55 + 0.25 * breath : 0.7})`); neb.addColorStop(1, 'rgba(4,2,6,0)');
  ctx.fillStyle = neb; ctx.fillRect(x0, y0, w, h);
  if (lvl < 2) {   // stars drifting through the calmer windows
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const sx = x0 + ((i * 53.7 - now / 90 * (0.4 + (i % 3) * 0.3)) % w + w) % w, sy = y0 + 3 + (i * 37.3) % (h - 6);
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(now / 600 + i)); ctx.fillStyle = i % 5 ? '#ffffff' : solid; ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  if (lvl >= 3) {   // the world-eater: one thin rift of red light across the dark, breathing
    const ry = y0 + h * 0.62, rg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    rg.addColorStop(0, 'rgba(255,40,20,0)'); rg.addColorStop(0.35, `rgba(255,60,30,${0.35 + 0.4 * breath})`); rg.addColorStop(0.65, `rgba(255,90,40,${0.45 + 0.4 * breath})`); rg.addColorStop(1, 'rgba(255,40,20,0)');
    ctx.strokeStyle = rg; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x0 + 10, ry + 1); ctx.lineTo(x0 + w * 0.42, ry - 1.5); ctx.lineTo(x0 + w * 0.55, ry + 0.5); ctx.lineTo(x0 + w - 10, ry - 1); ctx.stroke();
    ctx.fillStyle = `rgba(160,10,0,${0.06 + 0.06 * breath})`; ctx.fillRect(x0, ry - 6, w, 12);
  }
  const ins = ctx.createLinearGradient(0, y0, 0, y0 + h); ins.addColorStop(0, 'rgba(0,0,0,0.65)'); ins.addColorStop(0.28, 'rgba(0,0,0,0)'); ins.addColorStop(0.85, 'rgba(0,0,0,0)'); ins.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.fillStyle = ins; ctx.fillRect(x0, y0, w, h);   // recessed: the frame's shadow falls on the top of the window
  const insX = ctx.createLinearGradient(x0, 0, x0 + w, 0); insX.addColorStop(0, 'rgba(0,0,0,0.45)'); insX.addColorStop(0.08, 'rgba(0,0,0,0)'); insX.addColorStop(0.92, 'rgba(0,0,0,0)'); insX.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = insX; ctx.fillRect(x0, y0, w, h);
  const glass = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.5); glass.addColorStop(0, `rgba(255,255,255,${lvl >= 2 ? 0.07 : 0.13})`); glass.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w, y0 + h * 0.32); ctx.quadraticCurveTo(x0 + w / 2, y0 + h * 0.5, x0, y0 + h * 0.38); ctx.closePath(); ctx.fill();   // a curved glass reflection
  ctx.restore();
  // the frame: its metal, a dark inner line, and for the graver ones a crimson hairline
  platePath(x0 + 1.2, y0 + 1.2, w - 2.4, h - 2.4, cut > 0 ? cut - 0.5 : cut); ctx.strokeStyle = metal(y0, h); ctx.lineWidth = lvl >= 3 ? 2.2 : 2.8; ctx.stroke();
  ctx.save(); platePath(x0, y0, w, h, cut); ctx.clip();
  const lit = ctx.createLinearGradient(x0, y0, x0 + w * 0.5, y0 + h); lit.addColorStop(0, 'rgba(255,255,255,0.75)'); lit.addColorStop(0.5, 'rgba(255,255,255,0)');
  platePath(x0 + 0.4, y0 + 0.4, w - 0.8, h - 0.8, cut > 0 ? cut : cut); ctx.strokeStyle = lit; ctx.lineWidth = 0.8; ctx.stroke();   // lit outer edge, top left
  const drk = ctx.createLinearGradient(x0 + w * 0.5, y0, x0 + w, y0 + h); drk.addColorStop(0, 'rgba(0,0,0,0)'); drk.addColorStop(1, 'rgba(0,0,0,0.8)');
  platePath(x0 + 0.4, y0 + 0.4, w - 0.8, h - 0.8, cut > 0 ? cut : cut); ctx.strokeStyle = drk; ctx.lineWidth = 0.8; ctx.stroke();   // shadowed outer edge, bottom right
  ctx.restore();
  { const gxs = x0 + w * (0.22 + 0.5 * ((now / 3800) % 1)), sg = ctx.createLinearGradient(gxs - 14, 0, gxs + 14, 0);   // a glint travelling along the top of the frame
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${lvl >= 2 ? 0.35 : 0.7})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(gxs - 14, y0 + 0.6, 28, 1.4); }
  platePath(x0 + 3, y0 + 3, w - 6, h - 6, cut > 0 ? cut - 2 : cut); ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 0.8; ctx.stroke();
  if (lvl >= 2) { platePath(x0 + 4, y0 + 4, w - 8, h - 8, cut > 0 ? cut - 3 : cut); ctx.strokeStyle = `rgba(200,20,10,${0.35 + 0.35 * breath})`; ctx.lineWidth = 0.6; ctx.stroke(); }
  else { platePath(x0 + 4, y0 + 4, w - 8, h - 8, cut > 0 ? cut - 3 : cut); ctx.strokeStyle = hexA(solid, 0.3 + 0.3 * breath); ctx.lineWidth = 0.7; ctx.stroke(); }
  // the pointer down to the hole
  ctx.fillStyle = metal(y0 + h - 2, 8); ctx.beginPath(); ctx.moveTo(cx - 5, y0 + h - 1); ctx.lineTo(cx + 5, y0 + h - 1); ctx.lineTo(cx, y0 + h + 6); ctx.closePath(); ctx.fill();
  // the gem: a cut stone in a bezel for the common ones; an obsidian shard with a red core for the grave ones
  const gx = x0 + (lvl >= 3 ? 4 : -2), gy = y0 + h / 2, gr = 12;
  if (lvl >= 2) {
    ctx.shadowColor = glow; ctx.shadowBlur = (3 + 6 * breath) * RES;
    ctx.fillStyle = metal(gy - gr - 3, gr * 2 + 6); ctx.beginPath(); ctx.moveTo(gx, gy - gr - 4); ctx.lineTo(gx + gr + 2, gy); ctx.lineTo(gx, gy + gr + 4); ctx.lineTo(gx - gr - 2, gy); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    const ob = ctx.createLinearGradient(gx - gr, gy - gr, gx + gr, gy + gr); ob.addColorStop(0, '#2a2a34'); ob.addColorStop(0.5, '#08080c'); ob.addColorStop(1, '#16161e');
    ctx.fillStyle = ob; ctx.beginPath(); ctx.moveTo(gx, gy - gr - 1.5); ctx.lineTo(gx + gr - 0.5, gy); ctx.lineTo(gx, gy + gr + 1.5); ctx.lineTo(gx - gr + 0.5, gy); ctx.closePath(); ctx.fill();
    const core = ctx.createRadialGradient(gx, gy + 1, 0, gx, gy + 1, gr * 0.75); core.addColorStop(0, `rgba(255,70,30,${0.55 + 0.35 * breath})`); core.addColorStop(1, 'rgba(120,0,0,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(gx, gy + 1, gr * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(gx - gr * 0.5, gy - 2); ctx.lineTo(gx, gy - gr * 0.85); ctx.lineTo(gx + gr * 0.5, gy - 2); ctx.stroke();
  } else {
    ctx.shadowColor = glow; ctx.shadowBlur = (4 + 4 * breath) * RES;
    ctx.fillStyle = metal(gy - gr - 3, gr * 2 + 6); ctx.beginPath(); ctx.arc(gx, gy, gr + 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(20,8,4,0.9)'; ctx.beginPath(); ctx.arc(gx, gy, gr + 0.8, 0, Math.PI * 2); ctx.fill();
    const gem = ctx.createRadialGradient(gx - 4, gy - 5, 1, gx, gy, gr); gem.addColorStop(0, '#ffffff'); gem.addColorStop(0.28, solid); gem.addColorStop(1, mixCol(solid, '#000000', 0.7));
    ctx.fillStyle = gem; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(gx - 4, gy - 5, 3, 1.7, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const an = now / 700 + i / 7 * Math.PI * 2; ctx.globalAlpha = Math.sin(an) > 0 ? 0.9 : 0.3; ctx.fillStyle = i % 2 ? '#ffffff' : solid; ctx.fillRect(gx + Math.cos(an) * (gr + 7) - 1, gy + Math.sin(an) * (gr + 7) * 0.35 - 1, 2, 2); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  ctx.restore();
  const R2 = RANKS[rank];
  drawPix(pixText(R2, fontPx(R2.length > 2 ? (lvl >= 2 ? (R2.length > 3 ? 4.8 : 5.6) : 6.6) : lvl >= 2 ? 8 : 9), 700, lvl >= 2 ? ['#f4ece0', '#e8dccc', '#b8a898'] : ['#ffffff', '#ffffff', mixCol(solid, '#ffffff', 0.5)], 'rgba(0,0,0,0.9)'), gx, gy + 1, 'center');
  // the name (set wide apart on the graver ones), the time, the bar
  const tx = gx + gr + (lvl >= 3 ? 8 : 8), tw = x0 + w - (lvl >= 3 ? 16 : 9) - tx;
  if (lvl >= 2) { spacedPix(D.name, tx, y0 + 11, 7, ['#000000', '#000000', '#000000'], null, lvl >= 3 ? 2 : 1); spacedPix(D.name, tx, y0 + 10, 7, D.title, D.edge, lvl >= 3 ? 2 : 1); }   // embossed: a dark drop under the letters
  else { drawPix(pixText(D.name, fontPx(7.5), 700, ['#000000', '#000000', '#000000'], null), tx, y0 + 11, 'left'); drawPix(pixText(D.name, fontPx(7.5), 700, D.title, D.edge), tx, y0 + 10, 'left'); }
  text(`${secs}s`, x0 + w - (lvl >= 3 ? 16 : 9), y0 + 10, lvl >= 2 ? (secs <= 15 ? '#ff6a5a' : '#c8b8b0') : secs <= 15 ? '#ff8a8a' : '#e8eef8', 6.6, 'right');
  ctx.save();
  const by = y0 + 18, bh = lvl >= 2 ? 4 : 6, barCol = lvl >= 2 ? '#b01408' : solid;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; rrect(ctx, tx, by, tw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(tx + 2, by, tw - 4, 1);   // sunk: a shadow along its top edge
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(tx + 2, by + bh, tw - 4, 0.8);   // and a lip of light under it
  ctx.strokeStyle = lvl >= 2 ? 'rgba(160,140,130,0.25)' : 'rgba(255,214,140,0.35)'; ctx.lineWidth = 0.6; rrect(ctx, tx + 0.3, by + 0.3, tw - 0.6, bh - 0.6, bh / 2); ctx.stroke();
  if (k > 0) {
    ctx.save(); rrect(ctx, tx + 1, by + 1, (tw - 2) * k, bh - 2, (bh - 2) / 2); ctx.clip();
    const bar = ctx.createLinearGradient(0, by, 0, by + bh); bar.addColorStop(0, mixCol(barCol, '#ffffff', lvl >= 2 ? 0.3 : 0.5)); bar.addColorStop(1, mixCol(barCol, '#000000', 0.35));
    ctx.fillStyle = bar; ctx.fillRect(tx, by, tw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(tx, by + 1, tw, Math.max(1, bh * 0.3));   // glossy top of the fill
    if (lvl < 2) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let sx = tx + 8; sx < tx + tw; sx += 8) ctx.fillRect(sx, by, 1, bh); }
    ctx.restore();
    if (lvl < 2) { ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = barCol; ctx.shadowBlur = 5 * RES; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(tx + 1 + (tw - 2) * k, by + bh / 2, 1.6 + breath, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function enterCave(game, c) {
  const outside = game.world, p = outside.player;
  c.open = false; c.t = rand(CAVE.gapMin, CAVE.gapMax);
  const Z = ZONES[c.zi];
  const w = makeVoidWorld();
  w.cave = true; w.name = `Black Hole · ${Z.name}`; w.zone = c.zi;
  // party moves in
  const party = outside.actors.filter(a => a === p || (a.ally && a.owner === p));
  outside.actors = outside.actors.filter(a => !party.includes(a));
  const sx = VOID_C.x, sy = VOID_C.y + VOID_C.ry - 44;
  for (const a of party) { a.x = sx + (a === p ? 0 : rand(-14, 14)); a.y = sy + (a === p ? 0 : 10); a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  w.player = p; w.portals = []; w.from = { x: c.x, y: c.y + 12 };   // no way out but through the boss (or a fall)
  // inside the black hole: no small fry, just one huge boss of the hole's rank at the far end of the platform
  const rank = caveRank(c), bx = VOID_C.x, by = VOID_C.y - VOID_C.ry + 56;
  const pool = Z.mobs.filter(id => D.monsters[id]);
  const bossSp = pool.slice().sort((p1, p2) => SPECIES[p2].hp - SPECIES[p1].hp)[0];
  const boss = makeMonster(bossSp, rank, bx, by);
  Object.assign(boss, { boss: true, scale: 2.1, heavy: true, dir: 0, smart: true }); giveWildKit(boss);
  boss.spell = boss.spell || cardSpell({ sp: bossSp, tier: rank });   // smart: it combos you with its spell
  boss.maxHp = boss.hp = Math.round(boss.maxHp * (8 + rank)); boss.atk *= 1.8; boss.def += rank * 2;
  boss.home = { x: bx, y: by };
  w.actors.push(boss); w.boss = boss;
  w.onKill = m => {
    onMonsterKill(game, w, m);
    if (m.boss) {
      bumpStat('holeBosses');
      questEvent(game, 'cave');
      game.toast(`BLACK HOLE BOSS DEFEATED: rank ${RANKS[rank]} treasure!`, '#ffd23f');
      const chest = makeMapObject([3, 0, Math.round(m.x), Math.round(m.y)]);
      if (chest) w.objects.push(chest);
      openChest(w, chest);
      blackHoleLoot(game, w, m, rank);
      game.gainExp(killExp(rank) * (10 + rank)); netShare(game, 'caveBoss', { rank });   // (online co-op: the hole's bonus for each friend too, net.js)
      if (typeof holeQuestBossKill === 'function') holeQuestBossKill(game, w, rank, m);   // travellers' black hole quests
      w.won = true; w.leaveT = HOLE_LEAVE_MS;   // the hole collapses: the hoard flies to you, then you are thrown back out
      game.toast('The black hole collapses — gather the hoard, you are thrown back out in a moment…', '#e0b0ff');
    }
  };
  w.onPlayerDown = () => { game.toast('The black hole spits you out…', '#ff8a8a'); w.leaveT = 1800; };
  game.outside = outside; game.world = w;
  game.toast(`Inside the black hole: one rank ${RANKS[rank]} boss guards its hoard`, '#e0b0ff');
}
function exitCave(game) {
  const w = game.world, out = game.outside, p = w.player;
  const party = w.actors.filter(a => a === p || (a.ally && a.owner === p));
  for (const a of party) { a.x = w.from.x + (a === p ? 0 : rand(-14, 14)); a.y = w.from.y + (a === p ? 0 : 8); a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); out.actors.push(a); }
  const fell = p.dead;
  if (p.dead || p.remove || p.alpha < 1) revivePlayer(out, p, p.dead ? 0.5 : p.hp / p.maxHp);
  out.player = p; game.world = out; game.outside = null;
  unstick(out, p);   // the spot where the hole was may have filled up (crates, rocks): step to the nearest open ground
  if (fell) { sendHome(out, p); game.toast(`You wake at home in ${typeof homePlace === 'function' ? homePlace(game.profile) : 'Hearthvale'}`, '#ffe9a8'); if (typeof wakeHint === 'function') wakeHint(game); }   // no checkpoints: a defeat sends you home
}
// Is the hero boxed in (can't take a step in any direction)? Then move to the nearest open, reachable spot.
function boxedIn(w, p) { return [[6, 0], [-6, 0], [0, 6], [0, -6]].every(([dx, dy]) => w.blocked(p.x + dx, p.y + dy, p)); }
function unstick(w, p) {
  if (!boxedIn(w, p) && !w.blocked(p.x, p.y, p)) return false;
  const tx0 = Math.floor(p.x / T), ty0 = Math.floor(p.y / T);
  for (let r = 1; r <= 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = (tx0 + dx) * T + 8, y = (ty0 + dy) * T + 10;
    if (w.map && w.map.reach && !mapReach(w.map, x, y)) continue;
    if (w.blocked(x, y, p) || boxedIn(w, { ...p, x, y })) continue;
    p.x = x; p.y = y; p.vx = p.vy = 0; return true;
  }
  return false;
}
function updateCave(game, w, dt) {
  const p = w.player;
  w.caveTime = (w.caveTime || 0) + dt; if (!p.dead) w.minHpFrac = Math.min(w.minHpFrac ?? 1, p.hp / p.maxHp);   // for the SWIFT and UNSCATHED quests
  w.actors = w.actors.filter(a => !a.remove);
  collectDrops(game, w, dt);
  updateProps(w, dt);
  // nobody leaves the platform: anyone knocked or launched past its edge lands back on it (the edge only blocks
  // walking, so a boss thrown through the air used to land out in space)
  for (const a of w.actors) {
    if (inVoidFloor(a.x, a.y, 12)) continue;
    const rx = VOID_C.rx - 14, ry = VOID_C.ry - 14, dx = (a.x - VOID_C.x) / rx, dy = (a.y - VOID_C.y) / ry, r = Math.hypot(dx, dy) || 1;
    a.x = VOID_C.x + dx / r * rx; a.y = VOID_C.y + dy / r * ry; a.vx = a.vy = 0;
    if (a.home && !inVoidFloor(a.home.x, a.home.y, 12)) a.home = { x: a.x, y: a.y };
  }
  if (w.won) for (const d of w.drops) d.pulled = true;   // the hoard flies to you
  if (w.leaveT != null) { w.leaveT -= dt; if (w.leaveT <= 0) exitCave(game); }
}
function tintCanvas(src, col) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// the black hole boss's hoard: worth the fight, and richer the higher the hole's rank
function blackHoleLoot(game, w, m, rank) {
  const pr = game.profile, mobs = ZONES[w.zone].mobs.filter(id => D.monsters[id]), up = () => Math.min(9, rank + 1);
  const loot = [];
  for (let i = 0; i < 2 + Math.floor(rank / 3); i++) loot.push({ kind: 'card', item: makeCard(i === 0 ? m.sp : pick(mobs), i === 0 || Math.random() < 0.25 ? up() : rank) });
  loot.push({ kind: 'card', item: makeCard(pick(ARCANA_CARDS), rank) });   // every hoard holds an Arcana spell card
  for (let i = 0; i < 1 + Math.floor(rank / 4); i++) loot.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), Math.random() < 0.3 ? up() : rank, pr.cls) });
  for (let i = 0; i < 3; i++) loot.push({ kind: 'goods', item: makeGoods(up()) });
  for (let i = 0; i < 3 + Math.floor(rank / 2); i++) loot.push({ kind: 'coin', item: { tier: 9 } });
  loot.forEach((d, i) => { const a = i / loot.length * Math.PI * 2; w.drops.push({ ...d, x: m.x + Math.cos(a) * 22, y: m.y + Math.sin(a) * 11 }); });
  w.rings.push({ x: m.x, y: m.y, r: 60, t: 0, col: '#ffd23f' }, { x: m.x, y: m.y, r: 34, t: -150, col: '#c890ff' });
  w.drops.push({ kind: 'relic', item: makeRelic(m.sp, rank, 'hole'), x: m.x, y: m.y - 14 });
  w.flash = { t: 0, dur: 400, col: '#ffe8a0' };
}

// Inside the black hole: an obsidian arena floating in deep space. The singularity itself looms in the sky
// beyond the far edge: a pitch-black core, its lensed photon ring arching over and under it, and a white-hot
// accretion disk slicing across, all turning. The floor is polished black tiles with faintly glowing violet seams,
// a gold inlay ring and spokes, the hole's light reflected on the far side and a slowly turning rune circle at the
// centre. The platform's broken underside glows with crystal veins; debris and streaks of light spiral past.
const VOID_W = 760, VOID_H = 440, VOID_C = { x: 380, y: 300, rx: 250, ry: 105 }, VOID_HOLE = { x: 380, y: 152, r: 48 };   // short enough that the hole stays in view
const VOID_S = 2;
const HOLE_LEAVE_MS = 4500;   // after the boss falls: time for the chest and the hoard before you are thrown out   // backdrop canvases are drawn at 2× so edges stay crisp
const inVoidFloor = (x, y, pad = 0) => ((x - VOID_C.x) / (VOID_C.rx - pad)) ** 2 + ((y - VOID_C.y) / (VOID_C.ry - pad)) ** 2 < 1;
let VOID_BG = null, VOID_FLOOR = null;
function makeVoidWorld() {
  const w = newWorld({ x0: 0, y0: 0, x1: VOID_W, y1: VOID_H });
  w.zoom = 1.1;
  VOID_BG = VOID_BG || renderVoidSky(); VOID_FLOOR = VOID_FLOOR || renderVoidFloor();
  w.bg = document.createElement('canvas'); w.bg.width = w.bg.height = 1;   // the sky is drawn crisp, at 2×, in decorBehind
  w.bgX = 0; w.bgY = 0;
  w.objects = [];
  w.blocked = (x, y, a) => !(a && a.state === 'air') && !inVoidFloor(x, y, 10);
  w.decorBehind = drawVoidBehind;
  w.decor = drawVoidFront;
  return w;
}
function voidCanvas() {
  const c = document.createElement('canvas'); c.width = VOID_W * VOID_S; c.height = VOID_H * VOID_S;
  const g = c.getContext('2d'); g.scale(VOID_S, VOID_S);
  return [c, g];
}
// static sky: deep space, nebula clouds and stars
function renderVoidSky() {
  const [c, g] = voidCanvas(), r = rng(404);
  const sky = g.createLinearGradient(0, 0, 0, VOID_H);
  sky.addColorStop(0, '#07030f'); sky.addColorStop(0.5, '#0b0518'); sky.addColorStop(1, '#030108');
  g.fillStyle = sky; g.fillRect(0, 0, VOID_W, VOID_H);
  for (const [x, y, rad, col] of [[150, 140, 220, 'rgba(110,40,170,0.22)'], [640, 210, 240, 'rgba(40,60,170,0.2)'], [380, 120, 300, 'rgba(160,60,140,0.16)'], [120, 470, 200, 'rgba(70,20,120,0.2)'], [660, 500, 180, 'rgba(30,80,150,0.16)']]) {
    const n = g.createRadialGradient(x, y, 0, x, y, rad);
    n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = n; g.fillRect(0, 0, VOID_W, VOID_H);
  }
  for (let i = 0; i < 700; i++) {
    const b = r(), x = r() * VOID_W, y = r() * VOID_H, s = b > 0.985 ? 1.6 : b > 0.9 ? 1 : 0.6;
    g.fillStyle = b > 0.97 ? '#ffe2b8' : b > 0.6 ? 'rgba(220,215,255,0.9)' : 'rgba(170,160,230,0.55)';
    g.fillRect(x, y, s, s);
    if (b > 0.993) {   // a few bright stars with a cross glint
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 3, y + 0.5, 7.6, 0.5); g.fillRect(x + 0.5, y - 3, 0.5, 7.6);
    }
  }
  return c;
}
function renderVoidFloor() {
  const [c, g] = voidCanvas(), r = rng(909), { x: cx, y: cy, rx, ry } = VOID_C;
  // broken underside: a thick slab of dark rock with strata and glowing crystal veins, hanging spurs below
  const depth = 46;
  g.save();
  g.beginPath(); g.ellipse(cx, cy + depth, rx - 4, ry - 2, 0, 0, Math.PI); g.lineTo(cx - rx, cy); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); g.closePath();
  const ug = g.createLinearGradient(0, cy, 0, cy + ry + depth);
  ug.addColorStop(0, '#2c2440'); ug.addColorStop(0.6, '#191326'); ug.addColorStop(1, '#0a0712');
  g.fillStyle = ug; g.fill(); g.clip();
  for (let k = 1; k < 5; k++) {   // strata
    g.strokeStyle = `rgba(0,0,0,${0.25 + k * 0.05})`; g.lineWidth = 1;
    g.beginPath(); g.ellipse(cx, cy + k * depth / 5 + 4, rx - 2, ry, 0, 0.05, Math.PI - 0.05); g.stroke();
  }
  for (let i = 0; i < 16; i++) {   // crystal veins
    const a = Math.PI * (0.08 + 0.84 * r()), x0 = cx + Math.cos(a) * rx * 0.98, y0 = cy + Math.sin(a) * ry + 6;
    g.strokeStyle = 'rgba(190,120,255,0.75)'; g.lineWidth = 1; g.shadowColor = '#c080ff'; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(x0, y0);
    let x = x0, y = y0;
    for (let s = 0; s < 4; s++) { x += (r() - 0.5) * 10; y += 5 + r() * 7; g.lineTo(x, y); }
    g.stroke();
  }
  g.restore();
  for (let i = 0; i < 30; i++) {   // spurs hanging below
    const a = Math.PI * (0.04 + 0.92 * i / 29), x = cx + Math.cos(a) * (rx - 14), y = cy + depth - 4 + Math.sin(a) * (ry - 2);
    const h = 10 + r() * 26, wd = 6 + r() * 8;
    const sg = g.createLinearGradient(0, y, 0, y + h); sg.addColorStop(0, '#1a1426'); sg.addColorStop(1, '#07050c');
    g.fillStyle = sg; g.beginPath(); g.moveTo(x - wd, y); g.lineTo(x + wd, y); g.lineTo(x + (r() - 0.5) * 5, y + h); g.closePath(); g.fill();
    if (r() < 0.35) { g.fillStyle = 'rgba(200,140,255,0.9)'; g.beginPath(); g.moveTo(x - 2, y + h * 0.4); g.lineTo(x + 2, y + h * 0.4); g.lineTo(x, y + h * 0.75); g.closePath(); g.fill(); }
  }
  // the floor: polished obsidian tiles, glowing seams
  g.save();
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
  const TS = 24;
  for (let ty = cy - ry - TS; ty < cy + ry + TS; ty += TS) for (let tx = cx - rx - TS / 2; tx < cx + rx + TS; tx += TS) {
    const v = Math.floor(r() * 8);
    const tg = g.createLinearGradient(tx, ty, tx + TS, ty + TS);
    tg.addColorStop(0, `rgb(${34 + v},${28 + v},${52 + v})`); tg.addColorStop(1, `rgb(${18 + v},${14 + v},${30 + v})`);
    g.fillStyle = tg; g.fillRect(tx, ty, TS, TS);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(tx + 1, ty + 1, TS - 2, 0.6);
    if (r() < 0.25) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(tx + 3, ty + TS - 3); g.lineTo(tx + TS - 3, ty + 3); g.lineTo(tx + TS - 6, ty + 3); g.lineTo(tx + 3, ty + TS - 6); g.fill(); }   // glossy glint
  }
  g.strokeStyle = 'rgba(160,100,255,0.28)'; g.lineWidth = 0.7;   // seams
  g.beginPath();
  for (let ty = cy - ry - TS; ty < cy + ry + TS; ty += TS) { g.moveTo(cx - rx, ty); g.lineTo(cx + rx, ty); }
  for (let tx = cx - rx - TS / 2; tx < cx + rx + TS; tx += TS) { g.moveTo(tx, cy - ry); g.lineTo(tx, cy + ry); }
  g.stroke();
  // the hole's light reflected on the far side, darker toward the near edge
  const rf = g.createRadialGradient(cx, cy - ry, 10, cx, cy - ry, rx * 0.95);
  rf.addColorStop(0, 'rgba(255,190,120,0.32)'); rf.addColorStop(0.4, 'rgba(200,110,220,0.14)'); rf.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rf; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  const vg = g.createRadialGradient(cx, cy, rx * 0.4, cx, cy, rx * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  // gold inlay: an inner ring, eight spokes to the edge, a medallion at the centre
  const gold = (lw, a) => { g.strokeStyle = `rgba(232,190,100,${a})`; g.lineWidth = lw; };
  gold(1.6, 0.8); g.beginPath(); g.ellipse(cx, cy, rx * 0.56, ry * 0.56, 0, 0, Math.PI * 2); g.stroke();
  gold(0.6, 0.6); g.beginPath(); g.ellipse(cx, cy, rx * 0.56 - 4, ry * 0.56 - 2.4, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(cx, cy, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2); g.stroke();
  gold(1, 0.55);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * rx * 0.56, cy + Math.sin(a) * ry * 0.56); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); g.stroke();
  }
  gold(1.2, 0.7); g.beginPath(); g.ellipse(cx, cy, 22, 12, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
  // rim: a gold band, a dark lip and a violet glow line
  g.strokeStyle = '#0a0612'; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  const bg = g.createLinearGradient(0, cy - ry, 0, cy + ry);
  bg.addColorStop(0, '#fff0b8'); bg.addColorStop(0.5, '#c8963c'); bg.addColorStop(1, '#7a5420');
  g.strokeStyle = bg; g.lineWidth = 2.2; g.beginPath(); g.ellipse(cx, cy, rx - 1.5, ry - 1.5, 0, 0, Math.PI * 2); g.stroke();
  g.save(); g.shadowColor = '#c080ff'; g.shadowBlur = 8;
  g.strokeStyle = 'rgba(210,160,255,0.9)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
  return c;
}
// the singularity in the sky, drawn behind the platform
function drawVoidHole(now) {
  const { x: cx, y: cy, r: core } = VOID_HOLE, diskR = core * 3.6, rot = now / 1400;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(cx, cy, core, cx, cy, diskR * 1.3);
  halo.addColorStop(0, 'rgba(255,180,120,0.45)'); halo.addColorStop(0.25, 'rgba(200,90,200,0.22)'); halo.addColorStop(1, 'rgba(40,10,90,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, diskR * 1.3, 0, Math.PI * 2); ctx.fill();
  // matter streaming in from all around
  for (let i = 0; i < 40; i++) {
    const k = ((now / 2600) + i / 40) % 1, a = i * 2.39 - k * 2.6, rr = diskR * 1.6 * (1 - k) + core * 1.2;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7; ctx.strokeStyle = i % 4 ? '#e0c0ff' : '#ffd8a8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.55, 0, a, a + 0.3); ctx.stroke();
  }
  ctx.restore();
  const disk = front => {   // thin tilted disk, Doppler-bright on the left
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.16);
    ctx.beginPath(); ctx.rect(-diskR * 1.1, front ? 0 : -diskR * 1.1, diskR * 2.2, diskR * 1.1); ctx.clip();
    const g = ctx.createRadialGradient(0, 0, core * 1.15, 0, 0, diskR);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.15, '#fff0c8'); g.addColorStop(0.4, '#ffb060'); g.addColorStop(0.7, 'rgba(210,80,170,0.8)'); g.addColorStop(1, 'rgba(80,20,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, diskR, 0, Math.PI * 2); ctx.arc(0, 0, core * 1.15, 0, Math.PI * 2, true); ctx.fill('evenodd');
    const dop = ctx.createLinearGradient(-diskR, 0, diskR, 0);
    dop.addColorStop(0, 'rgba(255,255,255,0.35)'); dop.addColorStop(0.5, 'rgba(0,0,0,0)'); dop.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = dop; ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 18; i++) {
      const a = rot * (1 + (i % 4) * 0.3) + i * 0.71, rr = core * 1.3 + (i % 6) * (diskR - core * 1.3) / 6;
      ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, rr, a, a + 0.4); ctx.stroke();
    }
    ctx.restore();
  };
  disk(false);
  // lensed photon ring: the far side of the disk bent over the top and under the bottom of the core
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [lw, col] of [[9, 'rgba(255,140,80,0.25)'], [5, 'rgba(255,190,120,0.55)'], [2, 'rgba(255,245,225,0.95)']]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(cx, cy, core * 1.42, core * 1.3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(cx, cy, core, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,240,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, core + 0.6, 0, Math.PI * 2); ctx.stroke();
  disk(true);
}
function drawVoidBehind(w, now) {
  const { x: cx, y: cy, rx, ry } = VOID_C;
  ctx.drawImage(VOID_BG, 0, 0, VOID_W, VOID_H);
  drawVoidHole(now);
  // drifting rocks far behind the platform
  for (let i = 0; i < 9; i++) {
    const a = now / (14000 + i * 900) + i * 0.7, d = 1.25 + (i % 3) * 0.12;
    const x = cx + Math.cos(a) * rx * d, y = cy - 30 + Math.sin(a) * ry * d * 0.9;
    if (Math.sin(a) > 0.2) continue;   // the near ones are drawn in front
    drawVoidRock(x, y, 3 + (i % 4) * 1.5, now / 900 + i, 0.75);
  }
  ctx.drawImage(VOID_FLOOR, 0, 0, VOID_W, VOID_H);
  // the rune circle at the centre turns, and a spark runs round the gold ring
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.5 + 0.5 * Math.sin(now / 500);
  for (const [R, dir, n, col] of [[rx * 0.42, 1, 24, 'rgba(190,130,255,'], [rx * 0.3, -1, 16, 'rgba(255,200,120,']]) {
    ctx.strokeStyle = col + (0.35 + 0.25 * pulse) + ')'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, Math.PI * 2); ctx.stroke();
    const rot = dir * now / 4000;
    for (let i = 0; i < n; i++) {   // runes between the two rings
      const a = rot + i / n * Math.PI * 2, x = Math.cos(a) * (R - 3), y = Math.sin(a) * (R - 3);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(-1.5, -1.6); ctx.lineTo(1.5, -1.6); ctx.moveTo(0, -1.6); ctx.lineTo(0, 1.6);
      if (i % 2) { ctx.moveTo(-1.5, 1.6); ctx.lineTo(1.5, 0); }
      ctx.stroke(); ctx.restore();
    }
  }
  ctx.strokeStyle = `rgba(200,150,255,${0.25 + 0.2 * pulse})`; ctx.lineWidth = 1;   // star inside
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) { const a = now / 6000 + i * Math.PI * 4 / 6, R = rx * 0.24; i ? ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
  ctx.stroke();
  for (let s = 0; s < 2; s++) {   // sparks racing round the gold inlay
    const a = now / 1500 + s * Math.PI, x = Math.cos(a) * rx * 0.56, y = Math.sin(a) * rx * 0.56;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, 14);
    sg.addColorStop(0, 'rgba(255,240,190,0.9)'); sg.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // motes rising off the rim
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 36; i++) {
    const k = (now / 3000 + i * 0.137) % 1, a = i * 2.13, x = cx + Math.cos(a) * rx * 0.98, y = cy + Math.sin(a) * ry * 0.98 - k * 40;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.fillStyle = i % 3 ? '#c8a0ff' : '#ffe0b0';
    ctx.fillRect(x, y, 1.3, 1.3);
  }
  ctx.restore();
}
function drawVoidFront(w, now) {
  const { x: cx, y: cy, rx, ry } = VOID_C;
  for (let i = 0; i < 9; i++) {
    const a = now / (14000 + i * 900) + i * 0.7, d = 1.25 + (i % 3) * 0.12;
    if (Math.sin(a) <= 0.2) continue;
    drawVoidRock(cx + Math.cos(a) * rx * d, cy - 30 + Math.sin(a) * ry * d * 0.9, 4 + (i % 4) * 2, now / 900 + i, 1);
  }
}
function drawVoidRock(x, y, s, spin, lit) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin * 0.3);
  ctx.fillStyle = `rgba(${Math.round(40 * lit)},${Math.round(32 * lit)},${Math.round(58 * lit)},1)`;
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, -s * 0.2); ctx.lineTo(s * 0.5, s * 0.8); ctx.lineTo(-s * 0.7, s * 0.6); ctx.lineTo(-s, -s * 0.3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(210,160,255,0.7)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-s, -s * 0.3); ctx.lineTo(0, -s); ctx.lineTo(s * 0.9, -s * 0.2); ctx.stroke();
  ctx.restore();
}
