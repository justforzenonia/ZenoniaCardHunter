'use strict';
// THE BOSS KITS: every Guardian fights its own way, and the Sun Sovereign uses them all. A kit runs alongside the
// boss's normal AI (it still walks, swings and casts): on its own timers it lays HAZARDS on the ground, each shown
// first as a telegraph (a warning you can step out of) and then striking. Kits (a.kit):
//   rootcaller  Verdant Guardian   roots burst up under you and around you; it calls in saplings; faster below half HP
//   unseen      Twilight Guardian  it fades into the dark (only its eyes show), then dashes at you down a lit line
//   molten      Ember Guardian     pools of lava where you stand; below half HP a ring of fire bursts out of it —
//                                  step through the gap
//   glacier     Frost Guardian     a freezing nova round it (slows), lines of ice spikes; at 66% and 33% HP an
//                                  ICE SHIELD it must lose first (fire and heavy blows break it twice as fast)
//   sovereign   the Sun Sovereign  three phases (66%, 33%) drawing on all four, plus sun-flare beams
// Hazards (a.hazards): circle · line · pool · ring; drawn by drawBossFx (in drawJourney, on the ground), hurting the
// hero through dealDamage (so block and parry still count).

const KITS = {
  rootcaller: { name: 'Rootcaller', col: '#7ad84a', phases: [0.5] },
  unseen:     { name: 'The Unseen', col: '#b080ff', phases: [] },
  molten:     { name: 'The Molten King', col: '#ff6a2a', phases: [0.5] },
  glacier:    { name: 'The Glacier Warden', col: '#8fd8ff', phases: [0.66, 0.33] },
  sovereign:  { name: 'The Sun Sovereign', col: '#ffd23f', phases: [0.66, 0.33] },
  // the other bosses (mini bosses, Alphas, Lords, Wardens, Well Lurkers, the black holes' bosses): one of six ways of fighting, the same for each species
  stomper:    { name: 'Stomper', col: '#e0b060', phases: [0.5] },
  brood:      { name: 'Broodmother', col: '#a8e060', phases: [] },
  charger:    { name: 'Charger', col: '#ff8a7a', phases: [0.5] },
  bombard:    { name: 'Bombardier', col: '#ffb84a', phases: [] },
  plague:     { name: 'Plaguebearer', col: '#9ae04a', phases: [] },
  splitter:   { name: 'Splitter', col: '#d8a0ff', phases: [0.5] },
};
const GUARDIAN_KITS = ['rootcaller', 'unseen', 'molten', 'glacier'], WILD_KITS = ['stomper', 'brood', 'charger', 'bombard', 'plague', 'splitter'], WILD_NEAR = 200;
function giveKit(m, kit) {
  m.kit = kit; m.hazards = []; m.kitT = { a: 2500, b: 6000, c: 9000, d: 4000, e: 7000 }; m.kitPhase = 0;
  m.label = KITS[kit].name;
}
function giveWildKit(m) { const L = m.label; giveKit(m, WILD_KITS[Math.abs(hashStr(`kit${m.sp}`)) % WILD_KITS.length]); m.label = L; m.wildKit = true; }
const hpFrac = a => a.hp / Math.max(1, a.maxHp);
// lay a hazard
function hazard(a, h) {
  if (a.kitHaste > 1) { const warn = Math.max(450, h.warn / a.kitHaste); h.life -= h.warn - warn; h.warn = warn; }   // a Trial's telegraphs are shorter (trials.js)
  a.hazards.push(Object.assign({ t: 0, hit: false }, h));
}
function bossKitTick(w, a, dt) {
  if (a.dead) { a.hazards = []; return; }
  const p = w.player; if (!p) return;
  const near = Math.hypot(p.x - a.x, p.y - a.y) < (a.wildKit ? WILD_NEAR : 360) && !(w.overworld && inTown(p.x));   // (towns are safe: a Guardian by the gate leaves you be)
  for (const k in a.kitT) a.kitT[k] -= dt * (a.kitHaste || 1);
  // the phases: a shout, a flash, a moment untouchable — and for the Frost Guardian, a fresh ice shield
  const K = KITS[a.kit], f = hpFrac(a);
  while (a.kitPhase < K.phases.length && f < K.phases[a.kitPhase]) {
    a.kitPhase++; a.invuln = Math.max(a.invuln || 0, 900);
    w.flash = { t: 0, dur: 500, col: K.col }; w.shake = Math.max(w.shake || 0, 6);
    floatText(w, a.x, a.y - (a.h || 26) * (a.scale || 1) - 16, a.kit === 'sovereign' ? `PHASE ${a.kitPhase + 1}` : 'ENRAGED!', K.col, 12);
    if (a.kit === 'splitter') splitOff(w, a);
    if (a.kit === 'glacier' || (a.kit === 'sovereign' && a.kitPhase === 2)) { a.iceShield = Math.round(a.maxHp * 0.12); a.iceShieldMax = a.iceShield; floatText(w, a.x, a.y - 30, 'ICE SHIELD', '#bff0ff', 10); }
  }
  if (near) {
    const kit = a.kit === 'sovereign' ? ['rootflare', 'pooldash', 'novaring'][a.kitPhase] : a.kit;
    KIT_MOVES[kit](w, a, p, f);
    if (a.trial && TRIAL_EXTRA[a.kit] && a.kitT.e <= 0) { a.kitT.e = 7500; TRIAL_EXTRA[a.kit](w, a, p); }
  }
  // the unseen: fading, then the dash
  if (a.fadeT > 0) { a.fadeT -= dt; a.alpha = Math.max(0.1, (a.alpha || 1) - dt / 300); if (a.fadeT <= 0) aimDash(w, a, p); }
  else if (a.alpha < 1 && !a.dead) a.alpha = Math.min(1, a.alpha + dt / 250);
  updateHazards(w, a, p, dt);
}
// ---------------------------------------------------------------- each kit's moves (called while the hero is near)
const KIT_MOVES = {
  rootcaller(w, a, p, f) {
    if (a.kitT.a <= 0) { a.kitT.a = f < 0.5 ? 3200 : 5000; rootBurst(w, a, p); }
    if (a.kitT.b <= 0) { a.kitT.b = 12000; callSaplings(w, a); }
  },
  unseen(w, a, p) {
    if (a.kitT.a <= 0 && !(a.fadeT > 0)) { a.kitT.a = 6500; a.fadeT = 1600; floatText(w, a.x, a.y - 40, '…', '#b080ff', 12); }
  },
  molten(w, a, p, f) {
    if (a.kitT.a <= 0) { a.kitT.a = 4000; hazard(a, { type: 'pool', x: p.x, y: p.y, r: 24, warn: 700, life: 6000, k: 0.22, burn: true, col: '#ff6a2a' }); }
    if (f < 0.5 && a.kitT.c <= 0) { a.kitT.c = 14000; fireRing(w, a); }
  },
  glacier(w, a, p) {
    if (a.kitT.a <= 0) { a.kitT.a = 7000; hazard(a, { type: 'circle', x: a.x, y: a.y, r: 105, warn: 1100, life: 1400, k: 0.85, slow: 2600, col: '#8fd8ff', follow: true }); floatText(w, a.x, a.y - 44, 'FREEZE!', '#bff0ff', 10); }
    if (a.kitT.b <= 0) { a.kitT.b = 9000; iceSpikes(a, p); }
  },
  stomper(w, a, p, f) {
    if (a.kitT.a <= 0) { a.kitT.a = 5200; hazard(a, { type: 'circle', x: a.x, y: a.y, r: 72, warn: 1000, life: 1300, k: 0.9, launch: true, col: '#e0b060', follow: true }); floatText(w, a.x, a.y - 44, 'STOMP!', '#e0b060', 10); }
    if (f < 0.5 && a.kitT.c <= 0) { a.kitT.c = 12000; hazard(a, { type: 'ring', x: a.x, y: a.y, r0: 24, r1: 200, warn: 900, life: 2800, k: 0.9, gap: Math.random() * Math.PI * 2, gapW: 1, col: '#e0b060' }); }
  },
  brood(w, a) { if (a.kitT.b <= 0) { a.kitT.b = 11000; callAdds(w, a, a.sp, 'SWARM!', '#a8e060'); } },
  charger(w, a, p, f) {
    if (a.kitT.a > 0) return;
    a.chain = a.chain > 0 ? a.chain - 1 : f < 0.5 ? 2 : 0; a.kitT.a = a.chain > 0 ? 1500 : 5000; aimDash(w, a, p, '#ff8a7a', 0.8);
  },
  bombard(w, a, p) {
    if (a.kitT.a > 0) return; a.kitT.a = 6000; floatText(w, a.x, a.y - 44, 'INCOMING!', '#ffb84a', 10);
    for (let i = 0; i < 5; i++) { const an = Math.random() * Math.PI * 2, d = i ? rand(24, 80) : 0; hazard(a, { type: 'circle', x: p.x + Math.cos(an) * d, y: p.y + Math.sin(an) * d * 0.6, r: 17, warn: 800 + i * 160, life: 1100 + i * 160, k: 0.6, col: '#ffb84a' }); }
  },
  plague(w, a, p) {
    const pool = (x, y) => hazard(a, { type: 'pool', x, y, r: 22, warn: 500, life: 6500, k: 0.12, poison: true, pal: ['#e8ffa0', '#8ad83a', 'rgba(30,70,10,0.6)'], col: '#9ae04a' });
    if (a.kitT.a <= 0) { a.kitT.a = 3400; pool(a.x, a.y); }
    if (a.kitT.b <= 0) { a.kitT.b = 7500; pool(p.x, p.y); }
  },
  splitter(w, a, p) {
    if (a.kitT.a > 0) return; a.kitT.a = 6000; const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
    hazard(a, { type: 'line', x: a.x, y: a.y, x2: a.x + dx / d * 170, y2: a.y + dy / d * 170, w: 26, warn: 800, life: 1100, k: 0.75, col: '#d8a0ff' });
  },
  // the Sun Sovereign's three phases
  rootflare(w, a, p) { if (a.kitT.a <= 0) { a.kitT.a = 4500; rootBurst(w, a, p); } if (a.kitT.d <= 0) { a.kitT.d = 5200; sunFlare(a, 3); } },
  pooldash(w, a, p) {
    if (a.kitT.a <= 0) { a.kitT.a = 3800; hazard(a, { type: 'pool', x: p.x, y: p.y, r: 26, warn: 700, life: 5500, k: 0.24, burn: true, col: '#ff8a2a' }); }
    if (a.kitT.b <= 0 && !(a.fadeT > 0)) { a.kitT.b = 7000; a.fadeT = 1300; }
    if (a.kitT.d <= 0) { a.kitT.d = 4600; sunFlare(a, 4); }
  },
  novaring(w, a, p) {
    if (a.kitT.a <= 0) { a.kitT.a = 6500; hazard(a, { type: 'circle', x: a.x, y: a.y, r: 110, warn: 1000, life: 1300, k: 0.9, slow: 2200, col: '#ffe08a', follow: true }); }
    if (a.kitT.c <= 0) { a.kitT.c = 11000; fireRing(w, a); }
    if (a.kitT.d <= 0) { a.kitT.d = 3200; sunFlare(a, 5); }
  },
};
// in the Trials each Guardian also borrows a move from another
const TRIAL_EXTRA = {
  rootcaller(w, a, p) { hazard(a, { type: 'pool', x: p.x, y: p.y, r: 24, warn: 700, life: 5000, k: 0.22, burn: true, col: '#ff6a2a' }); },
  unseen(w, a, p) { iceSpikes(a, p); },
  molten(w, a, p) { rootBurst(w, a, p); },
  glacier(w, a) { if (!(a.fadeT > 0)) a.fadeT = 1200; },
};
function rootBurst(w, a, p) {   // under you, and a few around you
  hazard(a, { type: 'circle', x: p.x, y: p.y, r: 22, warn: 900, life: 1200, k: 1.0, launch: true, col: '#7ad84a', roots: true });
  for (let i = 0; i < 3; i++) { const an = Math.random() * Math.PI * 2, d = rand(40, 80); hazard(a, { type: 'circle', x: p.x + Math.cos(an) * d, y: p.y + Math.sin(an) * d * 0.6, r: 20, warn: 900 + i * 120, life: 1200 + i * 120, k: 0.8, launch: true, col: '#7ad84a', roots: true }); }
}
function callAdds(w, a, sp, shout, col) {   // never more than four at a time
  const room = Math.min(3, 4 - w.actors.filter(m => m.kitAdd === a.id && !m.dead).length); if (room <= 0) return;
  for (let i = 0; i < room; i++) { const at = findOpen(w, a.x + rand(-60, 60), a.y + rand(-40, 40)), m = makeMonster(sp, Math.max(0, (a.tier || 3) - 2), at.x, at.y); m.kitAdd = a.id; m.home = { x: at.x, y: at.y }; m.aggro = true; w.actors.push(m); w.rings.push({ x: at.x, y: at.y, r: 18, t: 0, col }); }
  floatText(w, a.x, a.y - 44, shout, col, 10);
}
function splitOff(w, a) {   // half way down, two smaller ones tear away and it keeps fighting
  for (const s of [-1, 1]) { const at = findOpen(w, a.x + s * 44, a.y + 10), m = makeMonster(a.sp, a.tier, at.x, at.y); m.kitAdd = a.id; m.maxHp = m.hp = Math.round(a.maxHp * 0.15); m.atk = a.atk * 0.5; m.scale = (a.scale || 1) * 0.7; m.home = { x: at.x, y: at.y }; m.aggro = true; w.actors.push(m); w.rings.push({ x: at.x, y: at.y, r: 24, t: 0, col: '#d8a0ff' }); }
}
function callSaplings(w, a) {
  const room = Math.min(3, 4 - w.actors.filter(m => m.kitAdd === a.id && !m.dead).length); if (room <= 0) return;   // never more than four
  const Z = ZONES[0], sp = Z.mobs.filter(id => D.monsters[id])[0];
  for (let i = 0; i < room; i++) {
    const at = findOpen(w, a.x + rand(-60, 60), a.y + rand(-40, 40)), m = makeMonster(sp, Math.max(0, (a.tier || 3) - 2), at.x, at.y);
    m.kitAdd = a.id; m.home = { x: at.x, y: at.y }; w.actors.push(m); w.rings.push({ x: at.x, y: at.y, r: 18, t: 0, col: '#7ad84a' });
  }
  floatText(w, a.x, a.y - 44, 'RISE!', '#7ad84a', 10);
}
// how far a dash really gets: it stops at the first wall, seal or town edge on its line
function dashEnd(w, a, h) {
  const L = Math.hypot(h.x2 - h.x, h.y2 - h.y), n = Math.ceil(L / 8); let x = h.x, y = h.y;
  for (let i = 1; i <= n; i++) { const nx = h.x + (h.x2 - h.x) * i / n, ny = h.y + (h.y2 - h.y) * i / n; if (w.blocked(nx, ny, a)) break; x = nx; y = ny; }
  return { x, y };
}
function aimDash(w, a, p, col = '#b080ff', k = 1.25) {   // the line from the hidden boss through you; it charges down it when the warning ends
  const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1, L = Math.min(260, d + 70);
  hazard(a, { type: 'line', x: a.x, y: a.y, x2: a.x + dx / d * L, y2: a.y + dy / d * L, w: 22, warn: 650, life: 900, k, col, dash: true });
}
function fireRing(w, a) {   // a ring bursting out of the boss, with one gap to step through
  hazard(a, { type: 'ring', x: a.x, y: a.y, r0: 24, r1: 240, warn: 1000, life: 3000, k: 1.2, burn: true, gap: Math.random() * Math.PI * 2, gapW: 0.9, col: '#ff5a1a' });
  floatText(w, a.x, a.y - 44, 'ERUPTION!', '#ff8a4a', 11);
}
function iceSpikes(a, p) {   // two lines of spikes across your path
  for (const off of [-30, 30]) {
    const horiz = Math.random() < 0.5;
    hazard(a, horiz ? { type: 'line', x: p.x - 140, y: p.y + off, x2: p.x + 140, y2: p.y + off, w: 16, warn: 900, life: 1300, k: 0.7, slow: 2000, col: '#bff0ff', spikes: true }
      : { type: 'line', x: p.x + off, y: p.y - 100, x2: p.x + off, y2: p.y + 100, w: 16, warn: 900, life: 1300, k: 0.7, slow: 2000, col: '#bff0ff', spikes: true });
  }
}
function sunFlare(a, n) {   // beams of sunlight from the Sovereign, evenly spread, turning a little each time
  a.flareA = (a.flareA || 0) + 0.5;
  for (let i = 0; i < n; i++) { const an = a.flareA + i / n * Math.PI * 2; hazard(a, { type: 'line', x: a.x, y: a.y, x2: a.x + Math.cos(an) * 280, y2: a.y + Math.sin(an) * 280 * 0.7, w: 18, warn: 950, life: 1300, k: 1.0, burn: true, col: '#ffd23f' }); }
}
// ---------------------------------------------------------------- hazards: strike, linger, expand
const segDist = (px, py, h) => { const vx = h.x2 - h.x, vy = h.y2 - h.y, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((px - h.x) * vx + (py - h.y) * vy) / L2)); return Math.hypot(px - (h.x + vx * t), py - (h.y + vy * t)); };
function hurtHero(w, a, p, h) {
  if (p.dead) return;
  dealDamage(w, a, p, { base: (a.atk || 10) * h.k, spell: true, el: h.burn ? 'fire' : h.slow ? 'ice' : 'earth', launch: h.launch ? 160 : 0 });
  if (h.slow) p.status.slow = Math.max(p.status.slow || 0, h.slow);
  if (h.burn && typeof applyStatus === 'function') applyStatus(p, 'fire', (a.atk || 10) * 0.3);
  if (h.poison) applyStatus(p, 'poison', (a.atk || 10) * 0.25);
}
function updateHazards(w, a, p, dt) {
  for (const h of a.hazards) {
    h.t += dt;
    if (h.follow && h.t < h.warn) { h.x = a.x; h.y = a.y; }
    const live = h.t >= h.warn;
    if (h.type === 'circle' && live && !h.hit) {
      h.hit = true; if (Math.hypot(p.x - h.x, (p.y - h.y) * 1.4) < h.r) hurtHero(w, a, p, h);
      for (let i = 0; i < 10; i++) { const an = Math.random() * Math.PI * 2; w.particles.push({ x: h.x + Math.cos(an) * h.r * 0.5, y: h.y + Math.sin(an) * h.r * 0.3, vx: Math.cos(an) * 60, vy: -80 - Math.random() * 60, t: 0, life: 450, col: h.col, size: 2.5, drag: 0.9 }); }
    }
    if (h.type === 'line' && live && !h.hit) {
      h.hit = true; if (segDist(p.x, p.y, h) < h.w / 2 + 6) hurtHero(w, a, p, h);
      if (h.dash) { const end = dashEnd(w, a, h); a.x = end.x; a.y = end.y; a.alpha = 1; w.shake = Math.max(w.shake || 0, 4); }
    }
    if (h.type === 'pool' && live) { h.tick = (h.tick || 0) - dt; if (h.tick <= 0 && Math.hypot(p.x - h.x, (p.y - h.y) * 1.5) < h.r) { h.tick = 500; hurtHero(w, a, p, h); } }
    if (h.type === 'ring' && live && !h.hit) {
      const q = (h.t - h.warn) / (h.life - h.warn), rr = h.r0 + (h.r1 - h.r0) * q, dd = Math.hypot(p.x - h.x, (p.y - h.y) * 1.6);
      let ang = Math.atan2((p.y - h.y) * 1.6, p.x - h.x) - h.gap; ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(dd - rr) < 9 && Math.abs(ang) > h.gapW / 2) { h.hit = true; hurtHero(w, a, p, h); }
    }
  }
  a.hazards = a.hazards.filter(h => h.t < h.life);
}
// ---------------------------------------------------------------- drawing (on the ground, before the actors)
function drawBossFx(w, now) {
  for (const a of w.actors) {
    if (!a.hazards || !a.hazards.length) continue;
    for (const h of a.hazards) {
      const warn = h.t < h.warn, k = Math.min(1, h.t / h.warn), pulse = 0.6 + 0.4 * Math.sin(now / 70);
      ctx.save();
      if (h.type === 'circle') {
        if (warn) {   // the telegraph: a ring closing on its fill
          // (a dark edge under each ring, so a pale warning still reads on bright grass)
          const ring = r => { ctx.beginPath(); ctx.ellipse(h.x, h.y, r, r / 1.4, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(8,16,48,0.8)'; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = hexA(h.col, 0.8 + 0.2 * pulse); ctx.lineWidth = 1.6; ctx.stroke(); };
          ctx.globalAlpha = 0.16 + 0.26 * k; ctx.fillStyle = mixCol(h.col, '#0a1040', 0.6); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = hexA(h.col, 0.14 + 0.22 * k); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * k, h.r * k / 1.4, 0, 0, Math.PI * 2); ctx.fill();
          ring(h.r); ring(Math.max(1, h.r * k));
        } else {      // the strike
          const q = (h.t - h.warn) / (h.life - h.warn); ctx.globalAlpha = 1 - q;
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(h.col, 0.5); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (1 + q * 0.3), h.r / 1.4 * (1 + q * 0.3), 0, 0, Math.PI * 2); ctx.fill();
          if (h.roots) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#4a3a1a'; for (let i = 0; i < 5; i++) { const rx = h.x - h.r * 0.6 + i * h.r * 0.3, ht = 14 * (1 - q) * (0.6 + (i % 2) * 0.5); ctx.beginPath(); ctx.moveTo(rx - 2.5, h.y); ctx.lineTo(rx, h.y - ht); ctx.lineTo(rx + 2.5, h.y); ctx.fill(); } }
        }
      } else if (h.type === 'line') {
        const an = Math.atan2(h.y2 - h.y, h.x2 - h.x), L = Math.hypot(h.x2 - h.x, h.y2 - h.y);
        ctx.translate(h.x, h.y); ctx.rotate(an);
        if (warn) { ctx.fillStyle = hexA(h.col, 0.1 + 0.2 * k); ctx.fillRect(0, -h.w / 2, L, h.w); ctx.strokeStyle = hexA(h.col, 0.55 + 0.35 * pulse); ctx.lineWidth = 1; ctx.strokeRect(0, -h.w / 2, L * k, h.w); }
        else {
          const q = (h.t - h.warn) / (h.life - h.warn); ctx.globalAlpha = 1 - q; ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(0, -h.w / 2, 0, h.w / 2); g.addColorStop(0, hexA(h.col, 0)); g.addColorStop(0.5, hexA(h.col, 0.85)); g.addColorStop(1, hexA(h.col, 0));
          ctx.fillStyle = g; ctx.fillRect(0, -h.w / 2, L, h.w);
          if (h.spikes) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#dff6ff'; for (let s = 6; s < L; s += 12) { ctx.beginPath(); ctx.moveTo(s - 3, 4); ctx.lineTo(s, -8 * (1 - q)); ctx.lineTo(s + 3, 4); ctx.fill(); } }
        }
      } else if (h.type === 'pool') {
        const fade = Math.min(1, (h.life - h.t) / 600);
        if (warn) { ctx.strokeStyle = hexA(h.col, 0.7); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.5, 0, 0, Math.PI * 2); ctx.stroke(); }
        else {
          ctx.globalAlpha = fade; const g = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, h.r); const P = h.pal || ['#ffe08a', '#ff6a1a', 'rgba(120,20,0,0.6)']; g.addColorStop(0, P[0]); g.addColorStop(0.4, P[1]); g.addColorStop(1, P[2]);
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,240,180,0.8)'; for (let i = 0; i < 3; i++) { const q = ((now / 700) + i / 3) % 1; ctx.globalAlpha = fade * (1 - q); ctx.beginPath(); ctx.arc(h.x - 8 + i * 8, h.y - q * 4, 1.5 + q * 2, 0, Math.PI * 2); ctx.fill(); }   // bubbling
        }
      } else if (h.type === 'ring') {
        const gs = h.gap - h.gapW / 2, ge = h.gap + h.gapW / 2;
        const arc = (r, lw, col) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(h.x, h.y, r, r / 1.6, 0, ge, gs + Math.PI * 2); ctx.stroke(); };
        if (warn) { ctx.setLineDash([4, 4]); arc(h.r1 * 0.5, 1, hexA(h.col, 0.5 + 0.3 * pulse)); ctx.setLineDash([]); ctx.fillStyle = hexA('#8fffd0', 0.8); const gx = h.x + Math.cos(h.gap) * h.r1 * 0.5, gy = h.y + Math.sin(h.gap) * h.r1 * 0.5 / 1.6; ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fill(); }   // the safe gap, marked green
        else { const q = (h.t - h.warn) / (h.life - h.warn), rr = h.r0 + (h.r1 - h.r0) * q; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q * 0.6; arc(rr, 9, hexA(h.col, 0.55)); arc(rr, 3, hexA('#ffe08a', 0.9)); }
      }
      ctx.restore();
    }
    // the unseen: only its eyes show while it is faded; the frost shield as a ring of ice
    if (a.fadeT > 0 && !a.dead) { const ey = a.y - (a.h || 26) * (a.scale || 1) * 0.75; ctx.fillStyle = '#ff3a3a'; ctx.fillRect(a.x - 5, ey, 3, 2); ctx.fillRect(a.x + 2, ey, 3, 2); }
    if (a.iceShield > 0 && !a.dead) { ctx.save(); ctx.strokeStyle = 'rgba(190,240,255,0.85)'; ctx.lineWidth = 2; ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 6 * RES; ctx.beginPath(); ctx.ellipse(a.x, a.y - 16, 26 * (a.scale || 1) * 0.7, 30 * (a.scale || 1) * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
}
// ---------------------------------------------------------------- the boss bar (top centre, when you are near one)
function drawBossBar(game, w, now) {
  const p = w && w.player; if (!p || (w.overworld && inTown(p.x))) return;
  let b = null, bd = 420;
  for (const a of w.actors) if ((a.kit || a.dojoMaster) && !a.dead) { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < (a.wildKit ? Math.min(bd, WILD_NEAR + 20) : bd)) { bd = d; b = a; } }
  if (!b) return;
  // built from the hero's own HUD art so it stays pixel: the navy panel with its gold scrollwork, the HP bar and its frame, and the boss's face in a HUD slot
  const K = KITS[b.kit] || { col: '#ffd27a', phases: [], name: b.label }, W = 300, H = 36, x = VW / 2 - W / 2, y = VH - 94, f = hpFrac(b), col = b.ward ? '#c8a8ff' : K.col, low = f < 0.25, rage = b.kitPhase > 0;
  const name = (b.trial ? `Trial ${b.trial} · ` : '') + (b.wildKit || b.dojoMaster || b.sqBoss || b.raid ? b.label || SPECIES[b.sp].name : K.name), tag = b.ward && b.wardWhy ? `WARDED: ${b.wardWhy}` : rage ? 'ENRAGED' : b.wildKit ? K.name : '';
  ctx.save(); hudNine('assets/hud_panel_warm.png', x, y, W, H, 0.5);
  if (low) { ctx.fillStyle = `rgba(220,30,30,${0.14 + 0.1 * Math.sin(now / 160)})`; ctx.fillRect(x + 6, y + 5, W - 12, H - 10); }
  // the face
  const S = 24, fx = x + 7, fy = y + 6; hudNine('assets/hud_slot_warm.png', fx - 3, fy - 3, S + 6, S + 6, 0.3); ctx.fillStyle = mixCol('#0a0610', col, 0.3); ctx.fillRect(fx, fy, S, S);
  ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, S, S); ctx.clip(); ctx.imageSmoothingEnabled = false;
  if (b.charId) partnerPortrait({ id: b.charId }, fx + S / 2, fy + S + 1, S, S, false, 0); else if (b.sp && D.monsters[b.sp]) monsterPreview(b.sp, fx, fy, S, S, b.tier || 0, 0); else text('☠', fx + S / 2, fy + S / 2, col, 14);
  ctx.restore(); if (b.tier != null) text(RANKS[b.tier], fx + S - 1, fy + S - 3, rankColor(b.tier, now), 6.5, 'right');
  // the name, what kind of fight it is, and the bar under them
  const tx = fx + S + 7, bw = x + W - 9 - tx; text(name.toUpperCase(), tx + 2, y + 10, '#fff4e0', 7.5, 'left'); if (tag) text(tag.toUpperCase(), tx + bw - 2, y + 10.2, rage && !b.ward ? '#ff8a6a' : col, 5.5, 'right');
  b.barG = b.barG == null ? f : Math.max(f, b.barG - 0.0045);
  capsuleBar(tx + 3, y + 18, bw - 6, 9, f, hpGhost(b, 'ghBoss', f, now), [mixCol(col, '#ffffff', 0.45), col, mixCol(col, '#000000', 0.6)], now, false);
  if (b.iceShield > 0) { ctx.fillStyle = 'rgba(190,235,255,0.95)'; ctx.fillRect(tx + 3, y + 18, (bw - 6) * f * (b.iceShield / b.iceShieldMax), 1.6); }
  hudBar('assets/hud_bar_a_warm.png', tx, y + 16, bw);
  ctx.fillStyle = '#fff4c0'; for (const ph of K.phases) ctx.fillRect(Math.round(tx + 3 + (bw - 6) * ph), y + 17, 1, 11);   // the phase marks
  text(`${Math.ceil(f * 100)}%`, tx + bw - 8, y + 22.6, low ? '#ffb0a0' : '#ffffff', 6.5, 'right');
  ctx.restore();
}
