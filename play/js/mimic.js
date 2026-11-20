'use strict';
// MIMICS: some treasure chests in the Wilds are monsters. A mimic chest looks almost like the real thing — but now
// and then its lid twitches and two red eyes glint in the gap, and a faint purple shadow lies under it. Hit or open
// it and it wakes: a chest with teeth that bounds after you. Each bite comes after a short, sharp wind-up
// (it shakes and gapes, red light in its mouth) and takes 30% OF YOUR MAX HP — block, parry or dash away. Beat it for
// the chest's treasure and more.

const MIMIC = { chance: 0.18, hp: 70, windup: 600, rest: 400, bite: 0.3, reach: 30, lunge: 80, hop: 62, sight: 220, scale: 1.6 };

// a chest placed in the Wilds may be a mimic
function maybeMimic(o) { if (o && o.chest && Math.random() < MIMIC.chance) o.mimic = true; return o; }

// the tells on a sleeping mimic (drawn over the chest): a purple shadow; every few seconds a twitch and red eyes
function drawMimicTell(o, rec, now) {
  const x = Math.round(o.x + rec[4]), y = Math.round(o.y + rec[5]), k = (now + (o.x * 7) % 2600) % 2600;
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#5a1a6a';
  ctx.beginPath(); ctx.ellipse(o.x, o.bottom + 1, rec[2] * 0.6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  if (k < 380) {   // the twitch: the lid lifts a pixel, eyes in the gap
    ctx.fillStyle = '#100810'; ctx.fillRect(x + 2, y + 6, rec[2] - 4, 2);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x + 4, y + 6, 2, 1); ctx.fillRect(x + rec[2] - 6, y + 6, 2, 1);
  }
}

// opened or struck: the chest becomes a monster
function wakeMimic(world, o) {
  o.remove = true; o.box = null;
  const R = regionAt(o.x), z = R && R.zone >= 0 ? R.zone : 0, Z = ZONES[z], tier = Math.min(9, Z.ranks[1]);
  const sp = Z.mobs.find(id => D.monsters[id]) || Object.keys(D.monsters)[0];   // (any monster's frames for the shared code; it draws itself)
  const m = baseActor('monster', 1, o.x, o.bottom - 2);
  Object.assign(m, {
    sp, tier, mimic: true, label: 'Mimic', plist: [], passives: {}, heavy: true, h: 22, pal: 0, scale: 1,
    maxHp: Math.round(MIMIC.hp * HP_MULT[tier] * MOB_BASE.hp), atk: 1, def: tier * 2, crit: 0, spd: MIMIC.hop, region: z,
    mm: { st: 'wake', t: 600 }, ai: { mode: 'hunt', t: 0, tx: o.x, ty: o.bottom, cast: 1e9 }, spell: null, home: { x: o.x, y: o.bottom },
  });
  m.hp = m.maxHp;
  world.actors.push(m);
  world.shake = Math.max(world.shake, 4);
  world.rings.push({ x: o.x, y: o.bottom - 6, r: 26, t: 0, col: '#c04aff' }, { x: o.x, y: o.bottom - 6, r: 14, t: -100, col: '#ff3a3a' });
  floatText(world, o.x, o.bottom - 34, 'IT\'S A MIMIC!', '#ff6a8a', 11);
  if (typeof SFX !== 'undefined') SFX.hit({ big: true });
}

// quick hops toward you, a short wind-up, one lunging bite, a brief rest; repeat
function mimicAI(world, m, dt) {
  const p = world.player, S = m.mm; if (!p) return;
  const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
  S.t -= dt; m.vx = m.vy = 0;
  if (Math.abs(dx) > 2) m.dir = dx > 0 ? 1 : 3;
  if (S.st === 'wake') { if (S.t <= 0) { S.st = 'chase'; S.t = 0; } return; }
  if (S.st === 'chase') {
    if (p.dead || d > MIMIC.sight) return;
    if (d < MIMIC.reach + 14) { S.st = 'windup'; S.t = MIMIC.windup; m.windupT = MIMIC.windup; return; }
    const hop = (performance.now() / 260) % 1 < 0.5;   // it moves in hops
    if (hop) moveBy(world, m, dx / d * MIMIC.hop * dt / 1000 * 2, dy / d * MIMIC.hop * dt / 1000 * 2);
    return;
  }
  if (S.st === 'windup') {
    m.windupT = S.t;
    if (S.t <= 0) { S.st = 'bite'; S.t = 220; S.dx = dx / (d || 1); S.dy = dy / (d || 1); S.hit = false; }
    return;
  }
  if (S.st === 'bite') {   // the lunge: it covers ground fast and snaps once
    moveBy(world, m, S.dx * MIMIC.lunge * dt / 220, S.dy * MIMIC.lunge * dt / 220);
    if (!S.hit && Math.hypot(p.x - m.x, p.y - m.y) < MIMIC.reach && !p.dead) {
      S.hit = true;
      dealDamage(world, m, p, { base: p.maxHp * MIMIC.bite, pctMax: MIMIC.bite, melee: true, push: 70, launch: 0, pop: 0 });
      world.shake = Math.max(world.shake, 5);
    }
    if (S.t <= 0) { S.st = 'rest'; S.t = MIMIC.rest; }
    return;
  }
  if (S.st === 'rest' && S.t <= 0) { S.st = 'chase'; S.t = 0; }
}

// the awake mimic: the chest, bigger, its lid flapping as it hops; gaping with a red glow while it winds up;
// teeth and a tongue when it bites
function drawMimic(a, y, now) {
  const S = a.mm || {}, k = MIMIC.scale;
  const fi = S.st === 'bite' ? 4 : S.st === 'windup' ? (S.t < MIMIC.windup * 0.5 ? 3 : 2) : S.st === 'wake' ? 1 : ((now / 260) % 1 < 0.5 ? 1 : 0);
  const rec = objRec('003', fi); if (!rec) return;
  const shake = S.st === 'windup' ? Math.sin(now / 25) * 1.2 : 0;
  const hopY = S.st === 'chase' && (now / 260) % 1 < 0.5 ? -Math.sin(((now / 260) % 0.5) * 2 * Math.PI) * 4 : 0;
  const w = rec[2] * k, h = rec[3] * k, x = a.x - w / 2 + shake, top = y - h + hopY;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(a.x, y, w * 0.45, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (a.flashT > 0) ctx.filter = 'brightness(2.2)';
  else if (S.st === 'windup') ctx.filter = `drop-shadow(0 0 ${2 + (1 - S.t / MIMIC.windup) * 4}px #ff2a2a)`;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img(D.objects.img), rec[0], rec[1], rec[2], rec[3], Math.round(x), Math.round(top), w, h);
  ctx.filter = 'none';
  // inside the mouth: red glow, eyes, teeth, a tongue on the bite
  if (fi >= 2) {
    const mx = x + 3 * k, my = top + (fi === 4 ? 4 : 6) * k, mw = w - 6 * k, mh = (fi === 4 ? 7 : 4) * k;
    ctx.fillStyle = S.st === 'windup' ? `rgba(255,40,40,${0.35 + 0.3 * Math.sin(now / 60)})` : 'rgba(120,10,20,0.6)'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) { ctx.fillRect(mx + 1 + i * mw / 4, my, 2, 2 + (fi === 4 ? 1 : 0)); ctx.fillRect(mx + 2 + i * mw / 4, my + mh - 2, 2, 2); }
    if (fi === 4) { ctx.fillStyle = '#e0406a'; ctx.fillRect(a.x - 3 + shake, my + mh - 3, 6, 4); }
  }
  ctx.fillStyle = '#ff3a3a';   // the eyes, always watching
  ctx.fillRect(Math.round(x + 4 * k), Math.round(top + 5 * k), 2, 2); ctx.fillRect(Math.round(x + w - 4 * k - 2), Math.round(top + 5 * k), 2, 2);
  ctx.restore();
  if (S.st === 'windup') text('!', a.x, top - 8 + Math.sin(now / 90) * 1.5, '#ff4a4a', 12);
}

// beaten: the treasure it was guarding, and then some
function mimicLoot(game, w, m) {
  propDrop(w, m.x, m.y + 6, true);
  w.drops.push({ kind: 'coin', item: { tier: 9 }, x: m.x + 10, y: m.y + 4 });
  const g = 40 + m.tier * 60; game.profile.gold = (game.profile.gold || 0) + g;
  floatText(w, m.x, m.y - 40, `+${g} G`, '#ffd23f', 10);
}
