'use strict';
// ECNE'S GUN (Zenonia 2): Ecne's basic attacks fire her own shells from her Zenonia 2 effect sheet
// (assets/z2pc001_fx.png, D.classes[4].fx) instead of the mage's arcane orbs and lightning:
//   - 1st and 2nd attack: a red shell with its smoke trail, turned along its flight, bursting in her small fireball on a hit
//   - 3rd attack: a rocket that blows up in her fireball on the first foe it meets (or at the end of its flight),
//     hurting and launching foes around it, as the old finisher did
// Her attack frames already carry her own muzzle flashes (that layer is drawn with her body). Damage matches the old shots.
const ECNE_GUN = { speed: 300, rocket: 240, life: 650, boom: 30, aim: 170 };
const isEcneGun = a => !!(a && a.kind === 'player' && CLASSES[a.cls] && CLASSES[a.cls].gun);
// her effect frames, re-anchored to their centres so they draw where a shell or blast is
const ECNE_FX = (() => {
  const S = D.classes[4] && D.classes[4].fx; if (!S) return null;
  const c = i => { const f = S.frames[i]; return f ? [f[0], f[1], f[2], f[3], -Math.round(f[2] / 2), -Math.round(f[3] / 2)] : null; };
  // 0, 1: the shell flying right (two frames of its trail); 2: the fireball; 3, 4: small flames
  // (her smoke clouds carry a flame jet drawn one way only, so the blasts keep to the fireball)
  return { img: S.img, frames: [c(119), c(111), c(110), c(99), c(100)] };
})();
function ecnePop(world, x, y, big) {
  if (!ECNE_FX) return;
  const seq = big ? [[2, 90, 0, 0], [2, 90, 0, 0], [3, 70, 0, 0], [4, 70, 0, 0]] : [[2, 60, 0, 0], [3, 60, 0, 0], [4, 60, 0, 0]];
  world.fx.push({ bank: ECNE_FX, seq, x, y: y - 12, t: 0, scale: big ? 0.95 : 0.6, dur: seqDur(seq) });
}
{
  const ms = mageShot;
  mageShot = (world, a, M) => {
    if (!isEcneGun(a) || !ECNE_FX) return ms(world, a, M);
    if (a.hitIds.has('shot')) return;
    a.hitIds.add('shot');
    const rocket = a.anim === 'atk3', base = a.atk * M.mul * 1.05;
    if (typeof SFX !== 'undefined' && SFX.shot) SFX.shot(rocket);
    const tgt = nearestEnemy(world, a, ECNE_GUN.aim);
    let ang = Math.atan2(DV[a.dir][1], DV[a.dir][0]);
    if (tgt && dist(a, tgt) < ECNE_GUN.aim) {
      const ta = Math.atan2(tgt.y - a.y, tgt.x - a.x);
      if (Math.abs(((ta - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.9) ang = ta;   // soft aim toward foes in front
    }
    const v = rocket ? ECNE_GUN.rocket : ECNE_GUN.speed;
    // (arrow: true keeps the plain-shot path in the projectile update: no element sparks or blue burst)
    world.projs.push({ owner: a, team: a.team, x: a.x + Math.cos(ang) * 12, y: a.y, z: 14, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
      life: ECNE_GUN.life, r: rocket ? 10 : 8, opts: { base: rocket ? base * 0.4 : base, pop: M.pop, push: rocket ? 10 : 22, ecneShot: rocket ? 'rocket' : 'shell' },
      hit: new Set(), sp: null, el: null, t: 0, pierce: false, arrow: true, ecne: rocket ? 'rocket' : 'shell', boomBase: base * 0.85 });
  };
}
// the rocket's blast: her fireball and smoke, a ring, and a strike around it that launches
function ecneBoom(world, p) {
  if (p.boomed) return; p.boomed = true; p.life = 0;
  ecnePop(world, p.x, p.y, true);
  ring(world, p.x, p.y, ECNE_GUN.boom, 'fire');
  strike(world, p.owner, p.x, p.y, ECNE_GUN.boom, 0, { base: p.boomBase, launch: 235, pop: 165, push: 30 });
}
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const r = dd(world, att, def, opts);
    if (opts && opts.ecneShot && def) {
      if (opts.ecneShot === 'shell') ecnePop(world, def.x, def.y, false);
      else { const p = world.projs.find(q => q.opts === opts); if (p) { p.x = def.x; p.y = def.y; ecneBoom(world, p); } }
    }
    return r;
  };
}
// a rocket that meets no one blows up at the end of its flight (checked each frame for its owner)
{
  const gt = guardTick;
  guardTick = (world, a, dt) => {
    const r = gt(world, a, dt);
    if (a.kind === 'player' && world.projs) for (const p of world.projs) if (p.owner === a && p.ecne === 'rocket' && !p.boomed && p.life <= dt + 1) ecneBoom(world, p);
    return r;
  };
}
// drawing: the shell turned along its flight, its two trail frames flickering
{
  const dp = drawProj;
  drawProj = p => {
    if (!p.ecne || !ECNE_FX) return dp(p);
    const k = Math.floor(p.t / 70) % 2, rec = ECNE_FX.frames[k], im = img(ECNE_FX.img); if (!rec || !im) return;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(Math.round(p.x), Math.round(p.y - p.z)); ctx.rotate(Math.atan2(p.vy, p.vx));
    const s = p.ecne === 'rocket' ? 1 : 0.75; ctx.scale(s, s);
    drawRec(im, rec, 0, 0, false, 1); ctx.restore();
  };
}
