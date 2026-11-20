'use strict';
// ELITES: now and then a monster in the Wilds is an elite, a little bigger, with twice the health and one trait that changes
// how you fight it. Its name says which ("Swift Mukaka"), and it pays more: double EXP, extra gold and always its own CARD, a rank
// above the monster's (through the game's rare-card gate, defs.js rareGate). A co-op friend sees
// the name and size too (net.js sends label and scale with every monster).
//   SWIFT     half again as fast: it closes in quickly, so time your dashes
//   VAMPIRIC  heals itself by a third of the damage it deals: don't trade blows with it, block or dodge
//   ARMORED   takes 30% less damage, until its guard is broken (foeguard.js)
//   VOLATILE  bursts a moment after it dies: a ring flares where it fell; step out of it
const FELITE = { chance: 0.06, minTier: 1, hp: 2, scale: 1.15, swift: 1.5, vamp: 0.33, armor: 0.7,
  volatile: { wait: 750, r: 42, mul: 1.5 }, exp: 1, gold: 4, cardUp: 1,
  traits: { swift: { name: 'Swift', col: '#9fe8ff' }, vampiric: { name: 'Vampiric', col: '#ff6a8a' }, armored: { name: 'Armored', col: '#c8d0e0' }, volatile: { name: 'Volatile', col: '#ffa040' } } };
// ELITE WEEKEND: on real Saturdays and Sundays (the player's own clock) elites turn up 2.5 times as often, said once a day
const FELITE_WKND = { mul: 2.5, col: '#ffb84a' };
const feliteWeekend = () => { const d = new Date().getDay(); return d === 0 || d === 6; };
const feliteChance = () => FELITE.chance * (feliteWeekend() ? FELITE_WKND.mul : 1);
function foeEliteRoll(world, m) {
  if (m.eliteRoll !== undefined) return m.elite;
  m.eliteRoll = true;
  const ok = m.kind === 'monster' && !m.boss && !m.ally && !m.pet && !m.dummy && !m.hunter && !m.animalBody && !m.netOf && (m.tier || 0) >= FELITE.minTier && !world.dojoRoom && !world.peaceful;
  if (!ok || Math.random() >= feliteChance()) return (m.elite = null);
  const keys = Object.keys(FELITE.traits), t = keys[Math.floor(Math.random() * keys.length)];
  m.elite = t; m.maxHp = Math.round(m.maxHp * FELITE.hp); m.hp = m.maxHp; m.scale = (m.scale || 1) * FELITE.scale;
  m.label = `${FELITE.traits[t].name} ${(SPECIES[m.sp] || {}).name || 'monster'}`;
  return t;
}
// the roll happens the first time it thinks (combat.js monsterAI)
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => { foeEliteRoll(world, m); return ai(world, m, dt); };
}
// SWIFT (combat.js speedOf)
{
  const so = speedOf;
  speedOf = a => so(a) * (a.elite === 'swift' ? FELITE.swift : 1);
}
// ARMORED soaks, VAMPIRIC drinks (combat.js dealDamage)
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    if (def && def.elite === 'armored' && !(def.fgBroken > 0) && opts && opts.base) opts = { ...opts, base: opts.base * FELITE.armor };
    const hp0 = def ? def.hp : 0, r = dd(world, att, def, opts);
    if (att && att.elite === 'vampiric' && !att.dead && def && def.hp < hp0) {
      const heal = Math.round((hp0 - def.hp) * FELITE.vamp); att.hp = Math.min(att.maxHp, att.hp + heal);
      if (heal > 0) floatText(world, att.x, att.y - (att.h || 26) * (att.scale || 1) - 6, `+${heal}`, FELITE.traits.vampiric.col, 7);
    }
    return r;
  };
}
// the reward, and VOLATILE's last burst (world.js onMonsterKill)
{
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => {
    const r = ok(game, w, m); if (!m || !m.elite) return r;
    game.gainExp(killExp(m.tier) * FELITE.exp); gainGold(game, w, m, FELITE.gold);
    floatText(w, m.x, m.y - 40, 'ELITE!', FELITE.traits[m.elite].col, 9);
    if (typeof dailyEvent === 'function') dailyEvent(game, 'bounty');   // the daily bounty contract (daily.js)
    bumpStat('eliteKills');   // (the Elite Hunter titles below; a co-op friend counts it in net.js netKill)
    w.drops.push({ kind: 'card', item: makeCard(typeof variantCardOf === 'function' ? variantCardOf(m.sp, 'elite') : m.sp, rareGate(Math.min(9, (m.tier || 0) + FELITE.cardUp))), x: m.x + rand(-6, 6), y: m.y + rand(-4, 4), elite: true });   // its card, always
    if (m.elite === 'volatile') {
      const V = FELITE.volatile, x = m.x, y = m.y, base = m.atk * V.mul;
      w.rings.push({ x, y, r: V.r, t: 0, col: '#ff6a3a' }, { x, y, r: V.r * 0.5, t: -200, col: '#ffd08a' }); floatText(w, x, y - 20, '!!', '#ff6a3a', 12);
      w.timers.push({ t: V.wait, fn: () => {
        if (game.world !== w) return;
        strike(w, m, x, y, V.r, 0, { base, spell: true, el: 'fire', pop: 120, push: 120 });
        w.rings.push({ x, y, r: V.r, t: 0, col: '#ffa040' }); w.shake = Math.max(w.shake || 0, 3);
        for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2; w.particles.push({ x, y: y - 8, vx: Math.cos(an) * 140, vy: Math.sin(an) * 90, t: 0, life: 420, col: i % 2 ? '#ffa040' : '#ffe08a', size: 2, drag: 0.9 }); }
        if (typeof SFX !== 'undefined') SFX.crush();
      } });
    }
    return r;
  };
}
// ELITE HUNTER and ELITE SLAYER: titles for elites brought down (titles.js), each kill counted for every hero in the party
const FELITE_TITLES = [
  { id: 'elitehunter', name: 'Elite Hunter', tier: 1, how: 'Defeat 10 elite monsters', need: 10, pas: ['crit', 'swift'] },
  { id: 'eliteslayer', name: 'Elite Slayer', tier: 3, how: 'Defeat 100 elite monsters', need: 100, pas: ['brutal', 'crit', 'unstop'] },
];
for (const T of FELITE_TITLES) { const t = { id: T.id, name: T.name, tier: T.tier, how: T.how, prog: pr => [titleStat(pr, 'eliteKills'), T.need] }; TITLE_LIST.push(t); TITLE_BY[T.id] = t; TITLE_PASSIVES[T.id] = T.pas; }
// SEEING ELITES: a ring in its trait's colour under every elite, a toast the first time one comes near ("Elite nearby: Swift
// Mukaka"), and, while one within reach is off the screen, a small arrow at the edge in its colour with how far it is. A co-op
// friend's copy of a monster carries no .elite, only its name, so the name's first word is read too.
const FELITE_SEE = { near: 260, reach: 640 };
function eliteTrait(a) {
  if (!a || a.kind !== 'monster' || a.dead || a.ally) return null;
  if (a.elite) return a.elite;
  const w = a.label && a.label.split(' ')[0]; for (const k in FELITE.traits) if (FELITE.traits[k].name === w) return k;
  return null;
}
{
  const da = drawActor;
  drawActor = (a, now, opts) => {
    const t = eliteTrait(a);
    if (t && !a.away && !a.riding) {
      const col = FELITE.traits[t].col, s = a.scale || 1, pulse = 0.55 + 0.25 * Math.sin(now / 180);
      ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(a.x, a.y + 1, 15 * s, 6 * s, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = pulse * 0.25; ctx.fillStyle = col; ctx.fill(); ctx.restore();
    }
    return da(a, now, opts);
  };
}
const FELITE_SEEN = new Set();   // (by a stable key, not the object: a co-op friend's copies of monsters are rebuilt now and then)
const actorKey = a => (a.netId != null ? 'n' + a.netId : 'i' + a.id);
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => {
    const r = dw(world, cam, bg, now);
    const G = window.GAME, p = world && world.player; if (!G || G.world !== world || !p || !world.overworld || !world.cam || G.menu) return r;
    if (feliteWeekend() && G.profile && G.profile.eliteWkd !== dayNo() && typeof regionAt === 'function' && (regionAt(p.x) || {}).zone >= 0) {
      G.profile.eliteWkd = dayNo(); G.toast('ELITE WEEKEND! Elites roam far more often today: hunt them for cards and the Bounty', FELITE_WKND.col);
    }
    let best = null, bd = FELITE_SEE.reach;
    for (const a of world.actors) {
      const t = eliteTrait(a); if (!t) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < FELITE_SEE.near && !FELITE_SEEN.has(actorKey(a))) { FELITE_SEEN.add(actorKey(a)); G.toast(`Elite nearby: ${a.label || FELITE.traits[t].name}`, FELITE.traits[t].col); }
      const Z = world.zoom || ZOOM, sx = (a.x - world.cam.x) * Z, sy = (a.y - world.cam.y) * Z;
      if (sx > 20 && sx < VW - 20 && sy > 30 && sy < VH - 60) continue;   // (on screen: its ring is enough)
      if (d < bd) { bd = d; best = { a, t, sx, sy }; }
    }
    if (best) {
      resetView();
      const col = FELITE.traits[best.t].col, cx = VW / 2, cy = VH / 2, an = Math.atan2(best.sy - cy, best.sx - cx), m = 62;   // (m: well inside the story's gold arrow, so the two never sit on each other)
      const k = Math.min((VW / 2 - m) / Math.abs(Math.cos(an) || 1e-6), (VH / 2 - 56) / Math.abs(Math.sin(an) || 1e-6));
      const ax = cx + Math.cos(an) * k, ay = Math.max(m + 30, Math.min(VH - 70, cy + Math.sin(an) * k));
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 160);
      ctx.fillStyle = col; ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      text(`ELITE ${Math.round(bd / T)}`, ax - Math.cos(an) * 16, ay - Math.sin(an) * 12, col, 6);
    }
    return r;
  };
}
