'use strict';
// RAIDS: the end game. Twelve bosses no player ever met in Zenonia 1 or 2 (the list and their cards: raidcards.js)
// wait behind the Raid Herald by the Hearthvale fountain. A raid is one boss in a sealed arena, scaled to you and far beyond
// anything in the Wilds: fifty times your health, a blow that takes a tenth of yours, every Guardian's hazards at once (the
// Sovereign's kit, faster), shadow claws crawling out every 25 s, and after four minutes it ENRAGES (triple damage).
// Beat it and it pays like nothing else: its own card (SSS, often SSS+, always SSS+ the first time), two SSS pieces of gear,
// a fortune in gold and summon coins. The full haul once a day per boss; after that a clear pays a tenth.
// Each raid card carries the boss's own signature skill, cast with its own spectacle (raidSkill, from castSpell).
// (RAIDS, RAID_SPELLS and the raid cards' SPECIES now live in raidcards.js, loaded before this file)
const RAID = { enrage: 240000, adds: 25000, nAdds: 3, haste: 1.3, gold: 20000, coins: 8, sssPlus: 0.25, again: 0.1 };
const raidOf = id => RAIDS.find(R => R.id === id);
const raidState = pr => pr.raids || (pr.raids = {});

// ---- the Raid Herald's board
function raidMenu() { return { type: 'raid', cur: 0, scroll: 0 }; }
function raidRows(game) {
  const pr = game.profile, S = raidState(pr), today = dayNo();
  return RAIDS.map(R => {
    const s = S[R.id] || {}, open = (pr.lv || 1) >= R.lv, paid = s.day === today;
    return { card: { sp: R.sp, tier: 9 }, name: R.name, sub: !open ? `Opens at level ${R.lv}` : `Lv ${R.lv}+ · ${s.clears || 0} clears${s.best ? ` · best ${(s.best / 1000).toFixed(0)} s` : ''}${paid ? ' · today\'s haul taken' : ' · full haul today'}`,
      right: open ? 'ENTER' : '🔒', rightCol: open ? R.col : '#7a7080', col: R.col, R };
  });
}
function updateRaidMenu(game, m) {
  const rows = raidRows(game), nav = panelNav(m, rows.length, 0); if (nav.back) { game.closeMenu(); return; } if (!nav.ok) return;
  const r = rows[m.cur]; if (!r) return;
  if ((game.profile.lv || 1) < r.R.lv) { game.toast(`${r.R.name} will not answer until you reach level ${r.R.lv}`, '#ff9a7a'); return; }
  game.closeMenu(); enterRaid(game, r.R);
}
function drawRaidMenu(game, m, now) {
  panelMenu(m, { title: 'THE RAID HERALD', rows: raidRows(game), info: 'Sealed arenas · bosses beyond the Wilds · its card, SSS gear and a fortune for the victor', keys: '↑↓ choose · Enter: enter the raid · Esc: close' }, now);
}

// ---- into the arena
function enterRaid(game, R) {
  const outside = game.world, p = outside.player, pr = game.profile, w = mapWorld('arena2'), [sx, sy] = ARENA2.p1, [ex, ey] = ARENA2.p2;
  w.rift = { raid: R.id, t: RAID.enrage, addT: RAID.adds, start: performance.now() }; w.name = R.name;
  if (typeof evilCourtMap === 'function') { const CM = evilCourtMap(); w.map = CM; w.blocked = blockedFn(w); w.tileSolid = (x, y) => mapSolidAt(CM, x, y); if (CM.paved) w.objects = w.objects.filter(o => !CM.paved.has(Math.floor(o.y / T) * CM.w + Math.floor(o.x / T))); w.bg = renderMapBg(CM); }
  w.bg = tintCanvas(tintCanvas(w.bg, R.tint), R.tint);
  const party = outside.actors.filter(a => a === p || (a.ally && a.owner === p)); outside.actors = outside.actors.filter(a => !party.includes(a));
  for (const a of party) { a.x = sx * T + 8 + (a === p ? 0 : rand(-14, 14)); a.y = sy * T + 8 + (a === p ? 0 : 10); a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  const m = makeMonster(R.sp, 9, (sx + ex) / 2 * T + 8, (ey - 4) * T + 8);
  Object.assign(m, { boss: true, raid: R.id, heavy: true, aggro: true, label: R.name, h: R.h, scale: R.scale, home: { x: m.x, y: m.y },
    maxHp: Math.round(p.maxHp * R.hp), atk: p.maxHp * R.atk, def: (p.atk || 10) * 0.6, spd: 46, spell: cardSpell({ sp: R.sp, tier: 9 }) });
  m.hp = m.maxHp; m.ai.cast = 6000;
  giveKit(m, 'sovereign'); m.label = R.name; m.kitHaste = RAID.haste;
  w.actors.push(m); w.player = p; w.portals = []; w.from = { x: p.x, y: p.y + 18 }; w.raidBoss = m;
  w.onKill = q => onMonsterKill(game, w, q);
  w.onPlayerDown = () => { game.toast(`${R.name} stands over you. The raid is lost.`, '#ff8a8a'); w.leaveT = 1800; w.rift.failed = true; };
  game.outside = outside; game.world = w;
  w.flash = { t: 0, dur: 900, col: R.col }; w.shake = 8;
  game.toast(`RAID: ${R.name}. Four minutes before it enrages. Good luck, hunter.`, R.col);
}
// a frame in the raid: shadow claws crawl out on a timer, the enrage, and the haul when it falls
function raidTick(game, w, dt) {
  const Rf = w.rift, R = raidOf(Rf.raid), m = w.raidBoss; if (Rf.failed || Rf.done) return;
  if (!m || m.dead) { Rf.done = true; raidReward(game, w, R); w.leaveT = 4500; return; }
  if (Rf.t > 0) { Rf.t -= dt; if (Rf.t <= 0) { m.atk *= 3; m.kitHaste = RAID.haste * 1.6; w.flash = { t: 0, dur: 700, col: '#ff2a2a' }; w.shake = 10; game.toast(`${R.name} ENRAGES — triple damage!`, '#ff5a5a'); } }
  if ((Rf.addT -= dt) <= 0) {
    Rf.addT = RAID.adds; const p = w.player, sp = R.add && D.monsters[R.add] ? R.add : R.sp === 'r032' ? pick(ZONES[3].mobs.filter(id => D.monsters[id])) : 'r032';
    for (let i = 0; i < RAID.nAdds; i++) {
      const an = Math.random() * Math.PI * 2, s = findOpen(w, m.x + Math.cos(an) * 70, m.y + Math.sin(an) * 40), a = makeMonster(sp, 8, s.x, s.y);
      Object.assign(a, { aggro: true, raidAdd: true, home: { x: s.x, y: s.y }, maxHp: Math.round(p.maxHp * 2.5), atk: p.maxHp * 0.04, scale: sp === 'r032' ? 1 : sp === 'rz051' ? 0.6 : a.scale });
      a.hp = a.maxHp; w.actors.push(a); w.rings.push({ x: s.x, y: s.y, r: 18, t: -i * 80, col: R.col });
    }
    game.toast(sp === 'rz051' ? 'Frost claws claw up out of the ice' : 'Shadow claws crawl out of the dark', sp === 'rz051' ? '#9fe8ff' : '#c89aff');
  }
}
function raidReward(game, w, R) {
  const pr = game.profile, S = raidState(pr), s = S[R.id] || (S[R.id] = { clears: 0 }), first = !s.clears, today = dayNo(), full = s.day !== today, ms = performance.now() - w.rift.start;
  s.clears++; s.best = s.best ? Math.min(s.best, ms) : ms; if (full) s.day = today;
  for (const d of w.drops) if (d.kind !== 'coin') game.pickup(d); w.drops = [];
  const k = full ? 1 : RAID.again, i = RAIDS.indexOf(R), gold = Math.round(RAID.gold * (1 + i * 0.5) * k);
  pr.gold = (pr.gold || 0) + gold; for (let n = 0; n < Math.round(RAID.coins * k); n++) pickCoin(game);
  if (full) {
    const tier = first || Math.random() < RAID.sssPlus ? 9 : 8;
    game.pickup({ kind: 'card', item: makeCard(R.sp, tier), force: true });
    for (let n = 0; n < 2; n++) game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), 8, pr.cls) });
    game.toast(`${R.name} FALLS! Its card (${RANKS[tier]}), two SSS pieces and ${gold.toLocaleString('en-US')} G`, '#ffd23f');
  } else game.toast(`${R.name} falls again: ${gold.toLocaleString('en-US')} G (the full haul returns tomorrow)`, '#ffd23f');
  game.gainExp(killExp(9) * 40); w.flash = { t: 0, dur: 1200, col: '#ffffff' }; game.save();
}
// the raid's banner: the boss's name, the enrage clock and how many times it has fallen
function drawRaidOverlay(w, now) {
  const Rf = w.rift, R = raidOf(Rf.raid), secs = Math.max(0, Rf.t / 1000), rage = Rf.t <= 0 && !Rf.done;
  ctx.save(); ctx.fillStyle = 'rgba(14,4,20,0.78)'; rrect(ctx, VW / 2 - 90, 8, 180, 34, 8); ctx.fill();
  ctx.strokeStyle = rage ? '#ff3a3a' : R.col; ctx.lineWidth = 1.2; rrect(ctx, VW / 2 - 89.5, 8.5, 179, 33, 8); ctx.stroke(); ctx.restore();
  text(`RAID · ${R.name.toUpperCase()}`, VW / 2, 16, R.col, 7);
  text(Rf.done ? 'VICTORY' : rage ? 'ENRAGED' : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`, VW / 2, 31, rage ? `rgba(255,${80 + 60 * Math.sin(now / 90)},80,1)` : '#ffffff', 13);
}

// ---- the cards' signature skills (castSpell, any caster: you, or the boss itself)
function raidSkill(world, a, sp, base, opts, tp) {
  const R = RAIDS.find(q => 'raid_' + q.id === sp.sx); if (!R) return false;
  const col = R.col, big = (str) => { world.spellName = { str, col, t: 1800, team: a.team, big: true }; };
  const fx = (k, x, y, s, o) => { const f = vfxAt(k, x, y, s, o); if (f) world.fx.push(f); return f; };
  const show = (dx, dy, dur, delay = 0, sc) => world.summons.push({ sp: R.sp, x: tp.x + dx, y: tp.y + dy, dir: dirTo(-dx || 1, -dy || 0), t: -delay, dur, pal: 0, team: a.team, glow: true, scale: sc });
  a.castLen = 700; a.invuln = Math.max(a.invuln || 0, 800); world.shake = Math.max(world.shake || 0, 6);
  world.rings.push({ x: a.x, y: a.y, r: 46, t: 0, col }, { x: a.x, y: a.y, r: 28, t: -100, col: '#ffffff' });
  switch (R.id) {
    case 'wyvern': {   // three dives down a line through the foe, then the firestorm
      big('SKYRENDER DESCENT'); const ang = Math.atan2(tp.y - a.y, tp.x - a.x);
      for (let k = 0; k < 3; k++) {
        const x = tp.x + Math.cos(ang) * (k - 1) * 40, y = tp.y + Math.sin(ang) * (k - 1) * 26, dl = 250 + k * 260;
        world.fx.push(fxAt(FX.METEOR, x, y, 1.2, { delay: dl, filter: elementFilter('fire') })); fx('ex_meteor_strike', x, y, 0.9, { delay: dl });
        strike(world, a, x, y, 40, dl + 120, opts({ base: base * 0.55, launch: 260, pop: 200 }));
      }
      show(0, -40, 1100, 100); world.timers.push({ t: 1150, fn: () => { world.flash = { t: 0, dur: 500, col: '#ff8a3a' }; world.shake = 9; } });
      world.fx.push(fxAt(FX.EXPLODE + 2, tp.x, tp.y, 2.2, { delay: 1100 })); strike(world, a, tp.x, tp.y, 90, 1200, opts({ base: base * 1.2, launch: 320, pop: 260, push: 90 }));
      return true;
    }
    case 'claw': {   // claws under six foes at once, a drain, and everything dragged together
      big('GRASP OF THE ABYSS');
      const foes = enemiesOf(world, a).filter(o => !o.dead && dist(o, a) < 220).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 6);
      if (!foes.length) foes.push({ x: tp.x, y: tp.y });
      foes.forEach((o, k) => {
        const dl = 120 + k * 90; world.summons.push({ sp: R.sp, x: o.x, y: o.y + 4, dir: 2, t: -dl, dur: 800, pal: 0, team: a.team, glow: true });
        world.fx.push(fxAt(FX.VORTEX, o.x, o.y, 1.1, { delay: dl, filter: elementFilter('dark') }));
        strike(world, a, o.x, o.y, 30, dl + 200, opts({ base: base * 0.7, pop: 160, status: true }));
        if (o.kind) world.timers.push({ t: dl + 260, fn: () => { if (!o.dead) { o.x += (tp.x - o.x) * 0.6; o.y += (tp.y - o.y) * 0.6; } } });
      });
      world.timers.push({ t: 800, fn: () => { if (!a.dead) heal(world, a, Math.round(base * 0.25 * foes.length)); } });
      return true;
    }
    case 'wyrm': {   // a long fault of spikes ahead, and the Wyrm bursting out along it
      big('WYRMQUAKE'); const d = DV[a.dir], ang = Math.atan2(tp.y - a.y, tp.x - a.x), ux = Math.cos(ang), uy = Math.sin(ang);
      for (let k = 0; k < 8; k++) {
        const x = a.x + ux * (24 + k * 22), y = a.y + uy * (24 + k * 15), dl = 140 + k * 70;
        world.fx.push(fxAt(FX.SPIKE, x, y, 1.3, { delay: dl, filter: elementFilter('earth') })); world.fx.push(fxAt(FX.ROCKS, x, y, 0.9, { delay: dl + 40 }));
        strike(world, a, x, y, 26, dl + 60, opts({ base: base * 0.45, launch: 340, pop: 220 }));
      }
      world.summons.push({ sp: R.sp, x: a.x + ux * 110, y: a.y + uy * 80, dir: dirTo(ux, uy), t: -300, dur: 1000, pal: 0, team: a.team, glow: true });
      world.timers.push({ t: 700, fn: () => { world.shake = 10; } });
      return true;
    }
    case 'seraph': {   // the wings spread: a heal and a shield for the caster, and eight lances of light
      big('SERAPHIC JUDGMENT'); world.summons.push({ sp: R.sp, x: a.x, y: a.y - 30, dir: 2, t: -50, dur: 1300, pal: 0, team: a.team, glow: true });
      heal(world, a, Math.round(a.maxHp * 0.25)); a.invuln = Math.max(a.invuln, 2500); fx('ex_level_up_pillar', a.x, a.y, 1.0, {});
      const foes = enemiesOf(world, a).filter(o => !o.dead && dist(o, a) < 240);
      for (let k = 0; k < 8; k++) {
        const o = foes.length ? foes[k % foes.length] : null, x = (o ? o.x : tp.x) + rand(-16, 16), y = (o ? o.y : tp.y) + rand(-10, 10), dl = 300 + k * 110;
        fx('ex_holy_impact_large', x, y, 0.7, { delay: dl }); world.bolts.push({ x1: x, y1: y - 120, x2: x, y2: y, t: -dl, dur: 220, seed: Math.random() * 1000, w: 2.4, col: '#fff4c8' });
        strike(world, a, x, y, 26, dl + 100, opts({ base: base * 0.4, pop: 180, status: true }));
      }
      return true;
    }
    case 'maw': {   // the Maw over the foe, five white pillars, then it devours the ring round it
      big('OBLIVION MAW'); world.summons.push({ sp: R.sp, x: tp.x, y: tp.y - 50, dir: 2, t: -50, dur: 1700, pal: 0, team: a.team, glow: true });
      for (let k = 0; k < 5; k++) {
        const an = k / 5 * Math.PI * 2, x = tp.x + Math.cos(an) * 48, y = tp.y + Math.sin(an) * 30, dl = 350 + k * 120;
        fx('ex_level_up_pillar', x, y, 0.9, { delay: dl }); strike(world, a, x, y, 26, dl + 150, opts({ base: base * 0.45, pop: 200 }));
      }
      world.timers.push({ t: 1300, fn: () => { world.flash = { t: 0, dur: 600, col: '#ff6ad0' }; world.shake = 12; world.rings.push({ x: tp.x, y: tp.y, r: 110, t: 0, col: '#ff6ad0' }, { x: tp.x, y: tp.y, r: 70, t: -80, col: '#ffffff' }); } });
      world.fx.push(fxAt(FX.VORTEX, tp.x, tp.y, 2.6, { delay: 1250, filter: elementFilter('dark') }));
      strike(world, a, tp.x, tp.y, 110, 1350, opts({ base: base * 1.4, launch: 300, pop: 280, push: 120, status: true }));
      return true;
    }
    // ---- the seven added on 2026-11-07 (raidcards.js)
    case 'mimic': {   // three hops at the foe, a bite on each landing, the last bursting in gold
      big('TREASURE BITE');
      for (let k = 0; k < 3; k++) {
        const x = tp.x + rand(-10, 10), y = tp.y + rand(-6, 6), dl = 150 + k * 280;
        world.summons.push({ sp: R.sp, x, y: y - 10, dir: 2, t: -dl, dur: 300, pal: 0, team: a.team, glow: true, scale: 2.2 });
        world.fx.push(fxAt(FX.ROCKS, x, y, 0.8, { delay: dl + 200 })); strike(world, a, x, y, 28, dl + 220, opts({ base: base * 0.4, pop: 160 }));
      }
      world.fx.push(fxAt(FX.HOLY, tp.x, tp.y, 1.6, { delay: 1000, filter: elementFilter('earth') })); world.rings.push({ x: tp.x, y: tp.y, r: 60, t: -1000, col: col });
      strike(world, a, tp.x, tp.y, 60, 1050, opts({ base: base * 0.9, launch: 260, pop: 220 }));
      return true;
    }
    case 'imp': {   // ten embers rain on the foes, setting them alight
      big('CINDER SWARM'); show(0, -30, 900, 0);
      const foes = enemiesOf(world, a).filter(o => !o.dead && dist(o, a) < 230);
      for (let k = 0; k < 10; k++) {
        const o = foes.length ? foes[k % foes.length] : null, x = (o ? o.x : tp.x) + rand(-20, 20), y = (o ? o.y : tp.y) + rand(-12, 12), dl = 250 + k * 90;
        world.fx.push(fxAt(FX.METEOR, x, y, 0.6, { delay: dl, filter: elementFilter('fire') })); strike(world, a, x, y, 22, dl + 100, opts({ base: base * 0.32, pop: 140, status: true }));
      }
      return true;
    }
    case 'spider': {   // a bolt leaping foe to foe through six of them, twice
      big('ARC LATTICE'); show(0, -20, 1000, 0);
      const foes = enemiesOf(world, a).filter(o => !o.dead && dist(o, a) < 240).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 6);
      if (!foes.length) foes.push({ x: tp.x, y: tp.y });
      for (let pass = 0; pass < 2; pass++) {
        let from = { x: a.x, y: a.y - 20 };
        foes.forEach((o, k) => {
          const dl = 200 + pass * 650 + k * 80;
          world.bolts.push({ x1: from.x, y1: from.y, x2: o.x, y2: o.y - 8, t: -dl, dur: 200, seed: Math.random() * 1000, w: 2, col: '#bfe8ff' });
          world.fx.push(fxAt(FX.LIGHTNING, o.x, o.y, 0.8, { delay: dl })); strike(world, a, o.x, o.y, 22, dl + 40, opts({ base: base * 0.3, pop: 150, status: pass === 1 }));
          from = { x: o.x, y: o.y - 8 };
        });
      }
      return true;
    }
    case 'fiend': {   // night falls, the Fiend swoops through four foes, then a ring of night
      big('NIGHTFALL REND'); world.flash = { t: 0, dur: 500, col: '#0a0a20' };
      const foes = enemiesOf(world, a).filter(o => !o.dead && dist(o, a) < 230).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 4);
      if (!foes.length) foes.push({ x: tp.x, y: tp.y });
      foes.forEach((o, k) => {
        const dl = 200 + k * 220; world.summons.push({ sp: R.sp, x: o.x, y: o.y - 6, dir: 2, t: -dl, dur: 380, pal: 0, team: a.team, glow: true });
        world.fx.push(fxAt(FX.VORTEX, o.x, o.y, 0.9, { delay: dl + 100, filter: elementFilter('dark') })); strike(world, a, o.x, o.y, 28, dl + 150, opts({ base: base * 0.45, pop: 180 }));
      });
      world.rings.push({ x: a.x, y: a.y, r: 100, t: -1100, col }); strike(world, a, a.x, a.y, 100, 1200, opts({ base: base * 0.6, push: 90, status: true }));
      return true;
    }
    case 'oni': {   // three golden beams sweep down on the foe, then a pillar of gold
      big('THOUSAND-EYE GLARE'); world.summons.push({ sp: R.sp, x: tp.x, y: tp.y - 60, dir: 2, t: -50, dur: 1500, pal: 0, team: a.team, glow: true, scale: 1.4 });
      for (let k = 0; k < 3; k++) {
        const x = tp.x + (k - 1) * 22, dl = 350 + k * 180;
        world.bolts.push({ x1: tp.x + (k - 1) * 10, y1: tp.y - 70, x2: x, y2: tp.y, t: -dl, dur: 260, seed: Math.random() * 1000, w: 3, col: '#ffd860' });
        fx('ex_holy_impact_large', x, tp.y, 0.7, { delay: dl }); strike(world, a, x, tp.y, 26, dl + 80, opts({ base: base * 0.4, pop: 180 }));
      }
      fx('ex_level_up_pillar', tp.x, tp.y, 1.2, { delay: 1100 }); world.timers.push({ t: 1150, fn: () => { world.shake = 9; world.flash = { t: 0, dur: 400, col: '#ffd860' }; } });
      strike(world, a, tp.x, tp.y, 70, 1200, opts({ base: base * 1.1, launch: 300, pop: 240 }));
      return true;
    }
    case 'glacier': {   // a ring of ice round the foe that freezes, then shatters
      big('ABSOLUTE ZERO'); world.summons.push({ sp: R.sp, x: tp.x, y: tp.y - 40, dir: 2, t: -50, dur: 1400, pal: 0, team: a.team, glow: true, scale: 0.42 });
      for (let k = 0; k < 8; k++) {
        const an = k / 8 * Math.PI * 2, x = tp.x + Math.cos(an) * 56, y = tp.y + Math.sin(an) * 36, dl = 250 + k * 60;
        world.fx.push(fxAt(FX.ICE, x, y, 1.1, { delay: dl })); strike(world, a, x, y, 26, dl + 60, opts({ base: base * 0.35, pop: 140, status: true }));
      }
      world.timers.push({ t: 1100, fn: () => { world.shake = 10; world.flash = { t: 0, dur: 500, col: '#cff4ff' }; world.rings.push({ x: tp.x, y: tp.y, r: 80, t: 0, col }); } });
      world.fx.push(fxAt(FX.ICE, tp.x, tp.y, 2.2, { delay: 1100 })); strike(world, a, tp.x, tp.y, 80, 1200, opts({ base: base * 1.2, launch: 260, pop: 240, push: 80 }));
      return true;
    }
    case 'lord': {   // the Demon Lord rises behind: six dark pillars, then a crushing ring that pulls them in
      big('ABYSSAL DOMINION'); world.summons.push({ sp: R.sp, x: a.x, y: a.y - 40, dir: 2, t: -50, dur: 1700, pal: 0, team: a.team, glow: true, scale: 0.55 });
      for (let k = 0; k < 6; k++) {
        const an = k / 6 * Math.PI * 2, x = tp.x + Math.cos(an) * 52, y = tp.y + Math.sin(an) * 32, dl = 300 + k * 110;
        world.fx.push(fxAt(FX.EXPLODE, x, y, 1.0, { delay: dl, filter: elementFilter('dark') })); strike(world, a, x, y, 26, dl + 100, opts({ base: base * 0.4, pop: 200 }));
      }
      const pull = enemiesOf(world, a).filter(o => !o.dead && dist(o, tp) < 120);
      world.timers.push({ t: 1150, fn: () => { world.shake = 12; world.flash = { t: 0, dur: 600, col: '#ff4a6a' }; world.rings.push({ x: tp.x, y: tp.y, r: 110, t: 0, col }, { x: tp.x, y: tp.y, r: 70, t: -80, col: '#ffffff' });
        for (const o of pull) if (!o.dead) { o.x += (tp.x - o.x) * 0.5; o.y += (tp.y - o.y) * 0.5; } } });
      world.fx.push(fxAt(FX.VORTEX, tp.x, tp.y, 2.4, { delay: 1150, filter: elementFilter('dark') }));
      strike(world, a, tp.x, tp.y, 110, 1250, opts({ base: base * 1.4, launch: 300, pop: 280, status: true }));
      return true;
    }
  }
  return false;
}
