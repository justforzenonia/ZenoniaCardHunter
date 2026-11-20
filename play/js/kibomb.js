'use strict';
// KI BOMB: the ultimate technique, an SSS+ Ki card that only comes to someone who has learned Ki (kiBombGrant). Hold the
// spell's key and a giant sphere gathers overhead through 4 charge levels; let go and it is hurled at the nearest foe,
// or ahead of you, and detonates. Every hit is a guaranteed critical. A level is a bigger sphere, a wider blast and far
// more damage. Knocked out of the charge, it is lost. In Ki form it charges twice as fast, and if you keep holding once it
// is full the sphere sinks into you instead: KI SURGE (chi.js). The art is assets/ki_bomb.png: row 0 gathering, row 1 the swirling
// sphere, row 2 the blast. The charge itself runs on a.cannonCharge with c.bomb set (cannonChargeTick, combat.js).
const KIB = {
  card: 'kibomb', max: 3500, min: 300, fly: 420, frame: 110, rise: 24, kiRate: 2, absorb: 1200,
  absorbWord: { at: 3500, s: 'ABSORBING KI', col: '#9fe8ff' },
  words: [{ at: 0, s: 'KI GATHERING', col: '#9fe8ff' }, { at: 1000, s: 'KI RISING', col: '#6ac8ff' }, { at: 2000, s: 'KI OVERFLOWING', col: '#ffd23f' }, { at: 3000, s: 'MAXIMUM CHARGE', col: '#ffffff' }],
  power: [1.6, 2.6, 4, 6], radius: [70, 90, 115, 150], launch: [260, 300, 340, 400],
  shout: [['KI BOMB', '#9fe8ff'], ['GREAT KI BOMB', '#bff4ff'], ['ULTIMATE KI BOMB', '#ffe08a'], ['FINAL KI BOMB', '#ffffff']],
  sheet: 'assets/ki_bomb.png', cell: 128, cellH: 120, blastW: 176, blastY: 78,
};
ARCH.ultimate = { name: 'Ultimate', pow: 1.5, mp: 60, cd: 30000, desc: 'gathers a giant sphere and hurls it' };
SPECIES.kibomb = {
  name: 'Ki Bomb', arcana: true, ki: true, sig: 'brutal', trait: 'Overflowing Ki',
  sigs: [['brutal', 'Overflowing Ki'], ['crit', 'Perfect Strike'], ['vamp', 'Life Force'], ['frenzy', 'Battle Spirit'], ['last', 'Final Resolve']],
  spell: { n: 'Ki Bomb', a: 'ultimate', el: 'lightning', fx: FX.BEAM, icon: 31, sheet: true, vfx: 'kb_charge', art: 'kb_charge', sx: 'kibomb', short: 'Hold to charge 4 levels, then hurl. Always crits.', d: 'Hold to gather a giant sphere through 4 charge levels, then hurl it. Every hit is a guaranteed critical' },
};
const kiBombLevel = ms => KIB.words.filter(s => ms >= s.at).length;
const kiBombScale = k => 0.4 + 0.6 * k;
const kiBombY = (a, k) => a.y - (a.z || 0) - KIB.rise - 48 * kiBombScale(k);
function kiBombStart(world, a, base, opts) {
  a.state = 'cast'; setAnim(a, a.kind === 'player' ? (actorAnims(a).charge ? 'charge' : 'cast') : 'attack', true); a.vx = a.vy = 0;
  const fx = { kibomb: true, owner: a, t: 0, dur: 1e9 }, dir = a.dir; world.fx.push(fx);
  if (a.kind === 'player' && a.castSlot != null) { fx.held = true; a.cannonCharge = { t: 0, slot: a.castSlot, dir, base, opts, fx, bomb: true }; a.castLen = 400; return; }
  const ms = KIB.words[1].at; a.castLen = ms + 380; fx.dur = ms + 120;
  world.timers.push({ t: ms, fn: () => fireKiBomb(world, a, dir, base, opts, ms) });
}
// sparks streaming up into the sphere while it gathers
function kiBombGather(world, a, c) {
  const k = Math.min(1, c.t / KIB.max), y = kiBombY(a, k);
  if (c.over) {   // absorbing: the sparks run the other way, down into you
    for (let i = 0; i < 3; i++) { const x0 = a.x + rand(-34, 34), y0 = y + rand(-20, 20), life = 300; world.particles.push({ x: x0, y: y0, vx: (a.x - x0) * 1000 / life, vy: (a.y - 14 - y0) * 1000 / life, t: 0, life, col: i ? '#9fe8ff' : '#ffffff', size: 2 }); }
    return;
  }
  for (let i = 0; i < 2; i++) { const x0 = a.x + rand(-90, 90), y0 = a.y + rand(-14, 24), life = 520; world.particles.push({ x: x0, y: y0, vx: (a.x - x0) * 1000 / life, vy: (y - y0) * 1000 / life, t: 0, life, col: i ? '#bfeaff' : '#ffffff', size: 2 }); }
}
// the sphere is gone, into the hero: every stat doubled until the Ki runs out
function kiAbsorb(world, a, c) {
  a.cannonCharge = null; c.fx.dur = 0; a.castLen = 420; kiSurgeStart(a);
  world.rings.push({ x: a.x, y: a.y, r: 60, t: 0, col: '#9fe8ff' }, { x: a.x, y: a.y, r: 110, t: -100, col: '#ffffff' });
  world.shake = Math.max(world.shake, 8); world.hitStop = Math.max(world.hitStop, 120); world.flash = { t: 0, dur: 320, col: '#dff4ff' };
  for (let n = 0; n < 60; n++) { const an = Math.random() * Math.PI * 2, sp = rand(80, 260); world.particles.push({ x: a.x, y: a.y - 14, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, t: 0, life: rand(300, 700), col: n % 3 ? '#9fe8ff' : '#ffffff', size: 2 }); }
  world.spellName = { str: 'KI ABSORBED  ALL STATS ×2', col: '#bff4ff', t: 2000, life: 2000, team: a.team, big: true, cannon: 1, kanji: '気吸収' };
  if (typeof SFX !== 'undefined' && SFX.smite) SFX.smite();
}
function fireKiBomb(world, a, dir, base, opts, ms) {
  if (a.dead) return;
  const L = kiBombLevel(ms), k = Math.min(1, ms / KIB.max), foe = nearestEnemy(world, a, 230), [dx, dy] = DV[dir];
  const to = foe ? { x: foe.x, y: foe.y } : { x: a.x + dx * 150, y: a.y + dy * 110 };
  a.dir = foe ? dirTo(foe.x - a.x, foe.y - a.y) : dir; a.state = 'cast'; setAnim(a, 'cast', true); a.castLen = 380;
  world.fx.push({ kibombfly: true, x0: a.x, y0: kiBombY(a, k), x1: to.x, y1: to.y, s: kiBombScale(k), t: 0, dur: KIB.fly });
  world.timers.push({ t: KIB.fly, fn: () => kiBombBlast(world, a, to.x, to.y, L, base, opts) });
}
function kiBombBlast(world, a, x, y, L, base, opts) {
  const i = L - 1, R = KIB.radius[i], [str, col] = KIB.shout[i], life = 1500 + L * 150;
  strike(world, a, x, y, R, 0, opts({ base: base * KIB.power[i] * (a.kiBombUp || 1), critBonus: 100, launch: KIB.launch[i], pop: 300, push: 200 }));
  world.fx.push({ kiblast: true, x, y, s: R / 83, t: 0, dur: KIB.frame * 6 });
  for (let n = 0; n < 40 + L * 15; n++) { const an = Math.random() * Math.PI * 2, sp = rand(60, 200 + L * 40); world.particles.push({ x, y: y - 8, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.55 - 40, t: 0, life: rand(300, 700), col: n % 3 ? '#bfeaff' : '#ffffff', size: 2 }); }
  world.rings.push({ x, y, r: R, t: 0, col: '#bfeaff' }); world.rings.push({ x, y, r: R * 0.6, t: 0, col: '#ffffff' });
  world.shake = Math.max(world.shake, 6 + L * 2); world.hitStop = Math.max(world.hitStop, 80 + L * 30);
  world.flash = { t: 0, dur: 220 + L * 60, col: '#dff4ff' };
  world.spellName = { str, col, t: life, life, team: a.team, big: a.kind === 'player', cannon: a.kind === 'player' ? L / 4 : 0, kanji: '気弾' };   // (drawn by drawCannonShout, hud.js)
  if (typeof SFX !== 'undefined' && SFX.smite) SFX.smite();
}
function drawKiBomb(f) {
  const im = img(KIB.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  const C = KIB.cell, H = KIB.cellH, blit = (row, fr, x, y, s) => ctx.drawImage(im, fr * C, row * H, C, H, Math.round(x - C * s / 2), Math.round(y - H * s / 2), Math.round(C * s), Math.round(H * s));
  const sm = ctx.imageSmoothingEnabled; ctx.save(); ctx.imageSmoothingEnabled = false;
  if (f.kibomb) {
    const a = f.owner, held = a.cannonCharge, k = held ? Math.min(1, held.t / KIB.max) : Math.min(1, f.t / KIB.words[1].at), q = held && held.over ? (held.over / KIB.absorb) ** 2 : 0, s = kiBombScale(k) * (1 - q * 0.85), y0 = kiBombY(a, k), y = y0 + (a.y - (a.z || 0) - 14 - y0) * q, n = Math.floor(k * 14);
    if (n < 8) blit(0, n, a.x, y, s * 1.33); else blit(1, Math.floor(f.t / 80) % 8, a.x, y, s);
  } else if (f.kibombfly) {
    const q = f.t / f.dur; blit(1, Math.floor(f.t / 60) % 8, f.x0 + (f.x1 - f.x0) * q, f.y0 + (f.y1 - 8 - f.y0) * q * q, f.s);
  } else {
    const W = KIB.blastW, fr = Math.min(5, Math.floor(f.t / KIB.frame));
    ctx.drawImage(im, fr * W, 2 * H, W, H, Math.round(f.x - W * f.s / 2), Math.round(f.y - KIB.blastY * f.s), Math.round(W * f.s), Math.round(H * f.s));
  }
  ctx.restore(); ctx.imageSmoothingEnabled = sm;
}
// the card itself comes with learning Ki. It is a technique you know, not a thing you own: if it is ever discarded it returns
function kiBombGrant(game) {
  const pr = game.profile, has = c => c.sp === KIB.card; if (!pr.chi || pr.cards.some(has) || ((pr.storage || {}).cards || []).some(has)) return;
  const first = !pr.kiBomb, c = makeCard(KIB.card, 9); pr.kiBomb = 1;
  game.pickup({ kind: 'card', item: c, force: true });
  if (first) game.toast('Ki flows through you: you learned the ultimate KI BOMB card!', '#9fe8ff');
}
