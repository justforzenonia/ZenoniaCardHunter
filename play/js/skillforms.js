'use strict';
// SKILL FORMS: every card fires its skill its own way. A skill type (bolt, nova, rain…) has several FORMS, each with its own pattern and its
// own words, and a MOD that trades power, reach, cost and cooldown. Each card is dealt a form and mod no other card of its type has, on
// top of its twist and its accent (defs.js). Support, Chef, Ki and OmegaKingX cards work their own way and take none.
const SKILL_MODS = [
  { pow: 1.3, cd: 1.25, text: 'Heavy: 30% more power, 25% longer cooldown.' }, { pow: 0.85, cd: 0.7, text: 'Quick: 30% shorter cooldown, 15% less power.' },
  { pow: 0.9, mp: 0.6, text: 'Thrifty: 40% less MP, 10% less power.' }, { pow: 1.3, mp: 1.5, text: 'Greedy: 30% more power, 50% more MP.' },
  { pow: 0.9, rad: 1.35, text: 'Broad: 35% wider, 10% less power.' }, { pow: 1.2, rad: 0.8, text: 'Sharp: 20% more power, 20% narrower.' },
  { cd: 0.9, mp: 0.9, text: 'Steady: 10% cheaper and quicker to ready.' }, { pow: 1.15, cd: 1.1, text: 'Wild: 15% more power, 10% longer cooldown.' },
];
// C: everything a form needs: world, the caster, the spell, the target spot, the angle to it, and the helpers below (castForm)
const SKILL_FORMS = {
  bolt: {
    lance: { text: 'Drives one fast lance through everything in line, 30% stronger.', cast: C => C.shot(C.ang, 1.3, { spd: 340, r: 10 }) },
    fan: { text: 'Sprays five shots in a wide fan.', cast: C => { for (let k = -2; k <= 2; k++) C.shot(C.ang + k * 0.3, 0.5); } },
    twin: { text: 'Fires two shots side by side.', cast: C => { C.shot(C.ang - 0.13, 0.65); C.shot(C.ang + 0.13, 0.65); } },
    ring: { text: 'Bursts eight shots out in every direction.', cast: C => { for (let k = 0; k < 8; k++) C.shot(k / 8 * Math.PI * 2, 0.4, { life: 650 }); } },
    seeker: { text: 'Looses three slow seekers that curve into your foes.', cast: C => { for (let k = 0; k < 3; k++) C.shot(C.ang + (k - 1) * 0.7, 0.45, { spd: 150, life: 1700, homing: true, delay: k * 90, pierce: false }); } },
    boomerang: { text: 'Throws a shot that flies out and comes back, hitting on both passes.', cast: C => C.shot(C.ang, 0.7, { spd: 260, life: 1100, back: 560 }) },
    bomb: { text: 'Lobs a slow shot that bursts where it lands.', cast: C => C.shot(C.ang, 0.65, { spd: 165, life: 620, pierce: false, boom: C.sp.radius + 8 }) },
    volley: { text: 'Fires four quick shots, one after another.', cast: C => { for (let k = 0; k < 4; k++) C.shot(C.ang, 0.4, { delay: k * 95, spd: 280 }); } },
  },
  nova: {
    pulse: { text: 'Pulses twice around you.', cast: C => { C.hitAt(C.a.x, C.a.y, C.R + 12, 0, 0.65, 190); C.hitAt(C.a.x, C.a.y, C.R + 12, 420, 0.65, 0); } },
    wide: { text: 'A huge ring that hits softer.', cast: C => C.hitAt(C.a.x, C.a.y, C.R * 1.6, 0, 0.7, 150) },
    tight: { text: 'A tight blast right beside you, 40% stronger.', cast: C => C.hitAt(C.a.x, C.a.y, C.R * 0.8, 0, 1.4, 240) },
    pull: { text: 'Drags nearby foes in, then blasts them.', cast: C => { C.drag(C.a.x, C.a.y, C.R * 2); C.hitAt(C.a.x, C.a.y, C.R + 6, 260, 1, 190); } },
    ripple: { text: 'Three rings ripple outward from you.', cast: C => { for (let k = 1; k <= 3; k++) C.hitAt(C.a.x, C.a.y, C.R * (0.45 + k * 0.4), (k - 1) * 200, 0.45, 0); } },
    cross: { text: 'Blasts out along four arms.', cast: C => { for (const [dx, dy] of DV) for (let k = 1; k <= 3; k++) C.hitAt(C.a.x + dx * k * 26, C.a.y + dy * k * 20, 22, k * 70, 0.5, 120); } },
    slam: { text: 'Hurls everyone around you far away.', cast: C => C.hitAt(C.a.x, C.a.y, C.R + 12, 0, 0.9, 300, { push: 220 }) },
    gather: { text: 'Gathers for a moment, then bursts at nearly double strength.', cast: C => C.hitAt(C.a.x, C.a.y, C.R + 14, 700, 1.8, 240) },
  },
  pillar: {
    single: { text: 'Drops one heavy column on your target.', cast: C => C.hitAt(C.tp.x, C.tp.y, C.R, 80, 1.2, 260) },
    triple: { text: 'Three columns in a row through your target.', cast: C => { for (let k = -1; k <= 1; k++) C.hitAt(C.tp.x + Math.cos(C.ang) * k * 36, C.tp.y + Math.sin(C.ang) * k * 26, C.R * 0.7, 60 + (k + 1) * 110, 0.45, 200); } },
    cage: { text: 'Four columns close in around your target.', cast: C => { for (const [dx, dy] of DV) C.hitAt(C.tp.x + dx * 32, C.tp.y + dy * 24, C.R * 0.65, 100, 0.32, 120); C.drag(C.tp.x, C.tp.y, 60); } },
    walk: { text: 'Columns walk from you to your target.', cast: C => { for (let k = 1; k <= 4; k++) C.hitAt(C.a.x + (C.tp.x - C.a.x) * k / 4, C.a.y + (C.tp.y - C.a.y) * k / 4, C.R * 0.65, k * 120, 0.4, 150); } },
    late: { text: 'A long warning, then a column at nearly double power.', cast: C => { C.mark(C.tp.x, C.tp.y, C.R, 700); C.hitAt(C.tp.x, C.tp.y, C.R + 4, 700, 1.9, 300); } },
    pair: { text: 'Strikes your target and the ground behind it.', cast: C => { C.hitAt(C.tp.x, C.tp.y, C.R * 0.8, 60, 0.7, 220); C.hitAt(C.tp.x + Math.cos(C.ang) * 44, C.tp.y + Math.sin(C.ang) * 32, C.R * 0.8, 260, 0.7, 220); } },
    self: { text: 'Calls a column down on yourself, hitting all around you.', cast: C => C.hitAt(C.a.x, C.a.y, C.R + 8, 120, 1.15, 260) },
    sweep: { text: 'Columns sweep sideways across your target.', cast: C => { for (let k = -1; k <= 1; k++) C.hitAt(C.tp.x - Math.sin(C.ang) * k * 40, C.tp.y + Math.cos(C.ang) * k * 30, C.R * 0.7, 60 + (k + 1) * 130, 0.5, 180); } },
  },
  rain: {
    scatter: { text: 'Strikes fall at random around your target.', cast: C => { for (let k = 0; k < C.n; k++) C.hitAt(C.tp.x + rand(-34, 34), C.tp.y + rand(-22, 22), 26, 120 + k * 170, 0.8, k ? 0 : 220); } },
    file: { text: 'Strikes fall in a line out to your target and past it.', cast: C => { for (let k = 0; k < C.n; k++) C.hitAt(C.a.x + Math.cos(C.ang) * (34 + k * 30), C.a.y + Math.sin(C.ang) * (26 + k * 22), 26, 80 + k * 110, 0.8, 0); } },
    halo: { text: 'Strikes fall in a ring around your target.', cast: C => { for (let k = 0; k < C.n; k++) { const q = k / C.n * Math.PI * 2; C.hitAt(C.tp.x + Math.cos(q) * 24, C.tp.y + Math.sin(q) * 17, 26, 100 + k * 100, 0.45, 0); } } },
    cluster: { text: 'Every strike lands on one spot.', cast: C => { for (let k = 0; k < C.n; k++) C.hitAt(C.tp.x, C.tp.y, 28, 120 + k * 150, 0.45, 0); } },
    onward: { text: 'Strikes march out ahead of you.', cast: C => { for (let k = 0; k < C.n; k++) { const q = C.ahead(30 + k * 26); C.hitAt(q.x, q.y, 28, 70 + k * 120, 0.55, 120); } } },
    canopy: { text: 'Strikes fall all around you.', cast: C => { for (let k = 0; k < C.n; k++) { const q = k / C.n * Math.PI * 2; C.hitAt(C.a.x + Math.cos(q) * 44, C.a.y + Math.sin(q) * 30, 26, 100 + k * 120, 0.8, 0); } } },
    hunt: { text: 'A strike finds each foe nearby.', cast: C => { const L = enemiesOf(C.world, C.a).filter(o => !o.dead && Math.hypot(o.x - C.a.x, o.y - C.a.y) < 190).slice(0, C.n + 1); (L.length ? L : [C.tp]).forEach((o, k) => C.hitAt(o.x, o.y, 24, 120 + k * 120, 0.9, 0)); } },
    storm: { text: 'A long storm of weak strikes.', cast: C => { for (let k = 0; k < C.n + 4; k++) C.hitAt(C.tp.x + rand(-50, 50), C.tp.y + rand(-34, 34), 24, 100 + k * 130, 0.45, 0); } },
  },
  dash: {
    charge: { text: 'Charges straight through your foes.', cast: C => C.dash(260, 360, 1) },
    double: { text: 'Dashes twice in quick succession.', cast: C => { C.dash(170, 340, 0.6); C.later(290, () => C.dash(170, 340, 0.6)); } },
    blink: { text: 'Vanishes and reappears behind your target with a blast.', cast: C => C.blink() },
    trail: { text: 'Charges and leaves a trail that keeps hitting.', cast: C => { C.dash(260, 340, 0.7); for (let k = 1; k <= 4; k++) { const q = C.ahead(k * 22); C.hitAt(q.x, q.y, 22, 320 + k * 60, 0.3, 0); } } },
    spin: { text: 'Charges in and ends with a spinning blast.', cast: C => { C.dash(220, 320, 0.6); C.later(240, () => C.hitAt(C.a.x, C.a.y, C.R + 8, 0, 0.8, 220)); } },
    retreat: { text: 'Leaps back and blasts the spot you left.', cast: C => { C.hitAt(C.a.x, C.a.y, C.R + 6, 180, 1, 200); C.dash(200, 330, 0, true); } },
    pierce: { text: 'A short, savage thrust, 40% stronger.', cast: C => C.dash(150, 420, 1.4) },
    ram: { text: 'Rams forward, shoving foes far back.', cast: C => C.dash(280, 330, 0.8, false, { push: 220, launch: 120 }) },
  },
  beam: {
    line: { text: 'Fires a straight beam.', cast: C => C.beam(170, 38, C.a.dir, 300, 1) },
    broad: { text: 'A short beam as wide as a wall.', cast: C => C.beam(110, 76, C.a.dir, 260, 0.95) },
    needle: { text: 'A long thin needle of a beam, 30% stronger.', cast: C => C.beam(250, 20, C.a.dir, 280, 1.3) },
    twin: { text: 'Fires two beams side by side.', cast: C => { C.beam(170, 26, C.a.dir, 260, 0.65, -22); C.beam(170, 26, C.a.dir, 340, 0.65, 22); } },
    cross: { text: 'Beams fire in all four directions.', cast: C => { for (let d = 0; d < 4; d++) C.beam(150, 34, d, 280, 0.6); } },
    charged: { text: 'Charges up, then fires at nearly double strength.', cast: C => { C.mark(C.ahead(80).x, C.ahead(80).y, 40, 620); C.beam(190, 44, C.a.dir, 640, 1.8); } },
    pulsing: { text: 'The beam pulses three times.', cast: C => { for (let k = 0; k < 3; k++) C.beam(170, 36, C.a.dir, 220 + k * 200, 0.45); } },
    trident: { text: 'Fires ahead and out to both sides.', cast: C => { const d = C.a.dir; for (const q of [d, (d + 1) % 4, (d + 3) % 4]) C.beam(140, 32, q, 280, 0.6); } },
  },
  quake: {
    crack: { text: 'A crack runs out ahead of you.', cast: C => { for (let k = 1; k <= 4; k++) { const q = C.ahead(k * 26); C.hitAt(q.x, q.y, 20, k * 90 + 90, 1, 250); } } },
    rift: { text: 'A long rift tears far ahead, weaker the whole way.', cast: C => { for (let k = 1; k <= 7; k++) { const q = C.ahead(k * 26); C.hitAt(q.x, q.y, 18, k * 70 + 60, 0.6, 180); } } },
    fan: { text: 'Three cracks fan out from you.', cast: C => { for (const s of [-0.5, 0, 0.5]) for (let k = 1; k <= 3; k++) { const q = C.ang0 + s; C.hitAt(C.a.x + Math.cos(q) * k * 30, C.a.y + Math.sin(q) * k * 24, 20, k * 90, 0.55, 200); } } },
    shock: { text: 'A shockwave spreads in a circle.', cast: C => { for (let k = 1; k <= 3; k++) for (let j = 0; j < 6 + k * 2; j++) { const q = j / (6 + k * 2) * Math.PI * 2; C.quiet(C.a.x + Math.cos(q) * k * 30, C.a.y + Math.sin(q) * k * 22, 20, k * 130, 0.35, 150); } } },
    both: { text: 'Cracks run ahead of you and behind you.', cast: C => { for (let k = 1; k <= 3; k++) for (const s of [1, -1]) { const q = C.ahead(s * k * 28); C.hitAt(q.x, q.y, 20, k * 90 + 80, 0.7, 220); } } },
    rows: { text: 'Two cracks run side by side.', cast: C => { const [dx, dy] = DV[C.a.dir]; for (let k = 1; k <= 4; k++) for (const s of [-13, 13]) { const q = C.ahead(k * 26); C.hitAt(q.x - dy * s, q.y + dx * s, 20, k * 90 + 80, 0.35, 220); } } },
    stomp: { text: 'One great stomp a little way ahead, 50% stronger.', cast: C => { const q = C.ahead(44); C.hitAt(q.x, q.y, C.R + 6, 240, 1.5, 300); } },
    zigzag: { text: 'A crack zigzags forward.', cast: C => { const [dx, dy] = DV[C.a.dir]; for (let k = 1; k <= 6; k++) { const q = C.ahead(k * 24), s = k % 2 ? 12 : -12; C.hitAt(q.x - dy * s, q.y + dx * s, 20, k * 80 + 60, 0.65, 200); } } },
  },
  summon: {
    strike: { text: 'Calls the card\'s creature down on your target.', cast: C => { C.call(C.tp.x - DV[C.a.dir][0] * 26, C.tp.y - DV[C.a.dir][1] * 26); C.hitAt(C.tp.x, C.tp.y, C.R + 6, 420, 1, 270); } },
    twin: { text: 'Calls it to both sides of your target.', cast: C => { C.call(C.tp.x - 30, C.tp.y); C.call(C.tp.x + 30, C.tp.y); C.hitAt(C.tp.x, C.tp.y, C.R + 2, 420, 0.65, 200); C.hitAt(C.tp.x, C.tp.y, C.R + 2, 640, 0.65, 200); } },
    ambush: { text: 'It strikes from behind your target, 25% stronger.', cast: C => { C.call(C.tp.x + Math.cos(C.ang) * 30, C.tp.y + Math.sin(C.ang) * 22); C.hitAt(C.tp.x, C.tp.y, C.R, 380, 1.25, 260); } },
    guard: { text: 'It appears beside you and strikes all around you.', cast: C => { C.call(C.a.x + 24, C.a.y); C.hitAt(C.a.x, C.a.y, C.R + 16, 340, 0.9, 220); } },
    stomp: { text: 'It lands hard, late and wide.', cast: C => { C.call(C.tp.x, C.tp.y - 8); C.hitAt(C.tp.x, C.tp.y, C.R * 1.5, 620, 1.1, 300); } },
    flurry: { text: 'It strikes three times in a row.', cast: C => { C.call(C.tp.x - 24, C.tp.y); for (let k = 0; k < 3; k++) C.hitAt(C.tp.x, C.tp.y, C.R, 320 + k * 220, 0.45, 150); } },
  },
};
{  // deal them: no two cards of a type share a form and a mod
  const byArch = {};
  for (const id of Object.keys(SPECIES).sort()) { const S = SPECIES[id], s = S.spell; if (!s || S.ki || S.support || S.chef || id === 'omega' || s.sx || !SKILL_FORMS[s.a]) continue; (byArch[s.a] = byArch[s.a] || []).push(s); }
  for (const [arch, list] of Object.entries(byArch)) { const F = Object.keys(SKILL_FORMS[arch]), n = F.length, m = SKILL_MODS.length; list.forEach((s, i) => { s.form = F[i % n]; s.mod = (i + Math.floor(i / n)) % m; }); }
}
const skillText = s => `${SKILL_FORMS[s.arch || s.a][s.form].text} ${SKILL_MODS[s.mod].text}`;
function castForm(world, a, sp, tp, base, opts, filter, FXA, ahead) {
  const F = SKILL_FORMS[sp.arch][sp.form], R = sp.radius, ang = Math.atan2(tp.y - a.y, tp.x - a.x) || 0, el = sp.el;
  const fxOf = (x, y, r, dl) => world.fx.push(FXA(fxDir(sp.fx, 2), x, y, clamp(r / 30, 0.6, 1.5), { delay: dl, filter }));
  const strikeAt = (x, y, r, dl, f, launch, o) => strike(world, a, x, y, r, dl + 160, opts(Object.assign({ base: base * f, launch }, o)));
  const C = { world, a, sp, tp, ang, ang0: Math.atan2(DV[a.dir][1], DV[a.dir][0]), R, ahead, n: sp.count,
    hitAt: (x, y, r, dl, f, launch, o) => { fxOf(x, y, r, dl); ring(world, x, y, r, el); strikeAt(x, y, r, dl, f, launch, o); },
    quiet: (x, y, r, dl, f, launch) => { if (Math.random() < 0.4) fxOf(x, y, r, dl); strikeAt(x, y, r, dl, f, launch); },
    still: (x, y, r, dl, f) => strikeAt(x, y, r, dl, f, 0, { push: 0, pop: 0 }),   // a hit with no effect and no knock-back: the lasting New Arcana (arcana2.js)
    mark: (x, y, r, t) => { for (let k = 0; k < 3; k++) world.rings.push({ x, y, r: r * (1 - k * 0.2), t: -k * t / 3, col: ELEMENTS[el].col }); },
    later: (t, fn) => world.timers.push({ t, fn }),
    drag: (x, y, r) => { for (const o of enemiesOf(world, a)) { const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy); if (d < r && d > 4 && !o.boss) { o.vx = dx / d * 260; o.vy = dy / d * 260; } } },
    shot: (q, f = 1, o = {}) => {
      const fire = () => world.projs.push({ owner: a, team: a.team, x: a.x + Math.cos(q) * 10, y: a.y, z: 14, vx: Math.cos(q) * (o.spd || 230), vy: Math.sin(q) * (o.spd || 230), life: o.life || 900, r: o.r || 13,
        opts: opts({ base: base * f, launch: 0, pop: 150 }), hit: new Set(), sp: sp.sp, el, t: 0, pierce: o.pierce ?? true, vfx: sp.vfx, burst: sp.burst || sp.vfx || sp.accent, vfxScale: sp.burst ? 0.75 : undefined, homing: o.homing, back: o.back, boom: o.boom, boomBase: base * f });
      if (o.delay) C.later(o.delay, fire); else fire();
    },
    beam: (L, W, d, dl, f, off = 0) => {
      const [dx, dy] = DV[d], rect = dx ? { x: dx > 0 ? a.x : a.x - L, y: a.y - 14 - W / 2 + off, w: L, h: W } : { x: a.x - W / 2 + off, y: dy > 0 ? a.y - 10 : a.y - L, w: W, h: L };
      if (sp.vfx) { for (let k = 1; k <= 4; k++) { const f2 = vfxAt(sp.vfx, a.x + dx * k * L / 4.4 + (dx ? 0 : off), a.y + dy * k * L / 4.4 + (dx ? off : 0), 0.9, { lift: 12, delay: dl - 240 + k * 60, flip: d === 3 }); if (f2) world.fx.push(f2); } }
      else world.fx.push(FXA(fxDir(sp.fx, d), a.x + (dx ? 0 : off), a.y + (dx ? off : 0), 1, { delay: Math.max(0, dl - 280), filter }));
      world.strikes.push({ owner: a, team: a.team, rect, delay: dl, opts: opts({ base: base * f, launch: 200 }), hit: new Set() });
    },
    dash: (t, speed, f, backward, o) => {
      if (backward) a.dir = (a.dir + 2) % 4;
      a.dash = { t, speed, hit: new Set(), opts: opts(Object.assign({ base: base * f, launch: 230 }, o)) }; a.invuln = Math.max(a.invuln || 0, t + 40); a.castLen = Math.max(a.castLen || 0, t + 60); a.state = 'cast'; setAnim(a, a.kind === 'player' ? 'atk3' : 'attack');
      world.fx.push(FXA(fxDir(sp.fx, a.dir), a.x + DV[a.dir][0] * 40, a.y, 1, { filter }));
    },
    blink: () => {
      const at = findOpen(world, tp.x + Math.cos(ang) * 26, tp.y + Math.sin(ang) * 18); world.rings.push({ x: a.x, y: a.y, r: 20, t: 0, col: ELEMENTS[el].col });
      a.x = at.x; a.y = at.y; a.dir = dirTo(tp.x - a.x, tp.y - a.y); a.invuln = Math.max(a.invuln || 0, 300); C.hitAt(a.x, a.y, R + 8, 90, 1, 230);
    },
    call: (x, y) => world.summons.push({ sp: sp.sp, x, y, dir: a.dir, t: 0, dur: 1100, pal: Math.min(3, Math.floor(sp.tier / 2.5)), team: a.team }),
  };
  F.cast(C);
}
