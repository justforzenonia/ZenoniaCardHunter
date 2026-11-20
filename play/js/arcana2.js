'use strict';
// NEW ARCANA: skill cards whose moves no other card has (twelve here, then six and five more below: ARCANA2 holds them all). Each is an Arcana (a skill card with no monster, from Summons,
// hoards and rich chests like the rest: ARCANA_CARDS) built on one of the usual skill types, with a FORM of its own added to
// skillforms.js after the other cards were dealt theirs, so no existing card changes. Effects are the game's own Spellcraft art.
// The lasting ones (orbit, mine, vortex, circle, hedge, cloud, wake, star) run on world timers and stop if the caster falls.
//   wv01 Chain Spark      lightning  bolt    the spark hops from foe to foe, a little weaker each hop
//   wv02 Gale Spiral      wind       bolt    shots wind out from you in a widening spiral
//   wv03 Frost Orbit      ice        nova    three shards circle you for four seconds, cutting what they touch
//   wv04 Ember Mine       fire       pillar  a mine waits on the ground and bursts when a foe steps near
//   wv05 Abyss Maelstrom  dark       pillar  a vortex keeps pulling foes in and grinding them, then bursts
//   wv06 Mending Circle   holy       nova    a circle at your feet heals you and your friends, and stings foes inside
//   wv07 Briar Hedge      poison     quake   a hedge of thorns across your path, hurting and slowing what crosses
//   wv08 Doom Brand       dark       pillar  brands a foe; a moment later the brand erupts for heavy damage
//   wv09 Root Snare       earth      quake   roots the three nearest foes in place
//   wv10 Hail Cloud       ice        rain    a cloud follows you, dropping hail on a foe near you again and again
//   wv11 Ember Wake       fire       nova    for a while your footsteps leave little flames behind
//   wv12 Sentinel Star    holy       pillar  a star hangs where you stood and zaps the nearest foe for a while
const ARCANA2 = {
  wv01: ['Chain Spark',     'bolt',   'lightning', 'crit',    FX.LIGHTNING, 'chain',    0, { vfx: 'ex_lightning_impact_small', art: 'ex_lightning_aura_loop' }],
  wv02: ['Gale Spiral',     'bolt',   'wind',      'swift',   FX.WIND,      'spiral',   4, { vfx: 'ex_wind_projectile', burst: 'ex_wind_impact_small', art: 'ex_wind_aura_loop' }],
  wv03: ['Frost Orbit',     'nova',   'ice',       'frost',   FX.ICE,       'orbit',    6, { vfx: 'ex_ice_impact_small', art: 'ex_ice_aura_loop' }],
  wv04: ['Ember Mine',      'pillar', 'fire',      'burst',   FX.EXPLODE,   'mine',     0, { vfx: 'ex_fire_impact_large', art: 'ex_fire_aura_loop' }],
  wv05: ['Abyss Maelstrom', 'pillar', 'dark',      'vamp',    FX.VORTEX,    'vortex',   7, { vfx: 'ex_void_portal_loop', art: 'ex_void_portal_loop' }],
  wv06: ['Mending Circle',  'nova',   'holy',      'regen',   FX.HOLY,      'mend',     2, { vfx: 'ex_heal_sparkle', art: 'ex_summoning_circle' }],
  wv07: ['Briar Hedge',     'quake',  'poison',    'thorns',  FX.SPIKE,     'hedge',    4, { vfx: 'ex_poison_impact_small', art: 'ex_poison_aura_loop' }],
  wv08: ['Doom Brand',      'pillar', 'dark',      'last',    FX.VORTEX,    'doom',     3, { vfx: 'ex_dark_impact_large', art: 'ex_debuff_aura' }],
  wv09: ['Root Snare',      'quake',  'earth',     'hide',    FX.SPIKE,     'snare',    1, { vfx: 'ex_earth_impact_small', art: 'ex_earth_aura_loop' }],
  wv10: ['Hail Cloud',      'rain',   'ice',       'mana',    FX.ICE,       'cloud',    5, { vfx: 'ex_water_impact_small', art: 'ex_water_aura_loop' }],
  wv11: ['Ember Wake',      'nova',   'fire',      'frenzy',  FX.FLAME,     'wake',     1, { vfx: 'ex_fire_impact_small', art: 'ex_fire_cast' }],
  wv12: ['Sentinel Star',   'pillar', 'holy',      'barrier', FX.HOLY,      'sentinel', 6, { vfx: 'ex_holy_impact_small', art: 'ex_holy_aura_loop' }],
};
// a lasting effect: fn(k) every `every` ms, n times, while the caster stands and the world is the same
const a2Repeat = (C, every, n, fn, start = 0) => { const w = C.world, step = k => { if (k >= n || C.a.dead || GAME.world !== w) return; fn(k); w.timers.push({ t: every, fn: () => step(k + 1) }); }; w.timers.push({ t: start, fn: () => step(0) }); };
const a2Foes = (C, x, y, r) => enemiesOf(C.world, C.a).filter(o => !o.dead && Math.hypot(o.x - x, o.y - y) < r).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
const a2Mote = (C, x, y, n = 3, life = 380) => { const col = ELEMENTS[C.sp.el].col; for (let i = 0; i < n; i++) C.world.particles.push({ x: x + rand(-4, 4), y: y + rand(-3, 3), vx: rand(-10, 10), vy: rand(-30, -10), t: 0, life, col, size: 2 }); };
const a2Fx = (C, key, x, y, sc = 0.8, dl = 0) => { const f = vfxAt(key, x, y, sc, { lift: 8, delay: dl }); if (f) C.world.fx.push(f); };
// RANK BONUSES: from rank S (tier 6), and again at SSS (tier 8), each move grows (a2Up = 0, 1 or 2); ARCANA2_UP says how, in the card text
const a2Up = C => (C.sp.tier >= 8 ? 2 : C.sp.tier >= 6 ? 1 : 0);
const ARCANA2_UP = { chain: 'two more hops', spiral: 'eight more shots', orbit: 'one more shard', mine: 'a wider burst', vortex: 'a longer pull',
  mend: 'stronger healing', wake: 'a longer trail', doom: 'a bigger eruption', sentinel: 'two more seconds', hedge: 'a longer hedge', snare: 'one more foe', cloud: 'a longer storm' };
const ARCANA2_FORMS = {
  bolt: {
    chain: { text: 'A spark that hops from foe to foe, up to five, each hop a little weaker.', cast: C => {
      const seen = new Set(); let at = { x: C.a.x, y: C.a.y };
      for (let k = 0; k < 5 + 2 * a2Up(C); k++) {
        const o = a2Foes(C, at.x, at.y, k ? 90 : 170).find(q => !seen.has(q)); if (!o) break; seen.add(o);
        C.hitAt(o.x, o.y, 16, 60 + k * 120, 0.75 * Math.pow(0.85, k), 0);
        const from = at; C.later(60 + k * 120, () => { for (let j = 1; j < 5; j++) a2Mote(C, from.x + (o.x - from.x) * j / 5, from.y + (o.y - from.y) * j / 5 - 12, 1, 220); });
        at = { x: o.x, y: o.y };
      }
      if (!seen.size) C.hitAt(C.ahead(50).x, C.ahead(50).y, 18, 60, 0.6, 0);
    } },
    spiral: { text: 'Twenty-four shots wind out from you in a widening spiral, twice round.', cast: C => { for (let k = 0; k < 24 + 8 * a2Up(C); k++) C.shot(C.ang0 + k * 0.524, 0.3, { delay: k * 40, spd: 170 + k * 5, life: 800 }); } },
  },
  nova: {
    orbit: { text: 'Three shards circle you for four seconds, cutting whatever they touch.', cast: C => a2Repeat(C, 200, 20, k => {
      const N = 3 + a2Up(C); for (let j = 0; j < N; j++) { const q = k * 0.55 + j * Math.PI * 2 / N, x = C.a.x + Math.cos(q) * 36, y = C.a.y + Math.sin(q) * 25; if (k % 2 === j % 2) a2Fx(C, 'ex_ice_projectile', x, y - 6, 0.45); if (k % 2 === 0) C.still(x, y, 18, 0, 0.16); }
    }) },
    mend: { text: 'A circle at your feet for four seconds: it heals you and friends inside it, and stings foes.', cast: C => {
      const x = C.a.x, y = C.a.y, R = C.R + 10;
      a2Repeat(C, 500, 8, k => {
        C.world.rings.push({ x, y, r: R, t: 0, col: ELEMENTS.holy.col }); a2Mote(C, x + rand(-R, R) * 0.6, y, 2);
        for (const f of C.world.actors) if (!f.dead && (f === C.a || (f.team === C.a.team && (f.kind === 'player' || f.pet))) && Math.hypot(f.x - x, f.y - y) < R) heal(C.world, f, f.maxHp * (0.025 + 0.01 * a2Up(C)), true);
        C.still(x, y, R, 0, 0.12);
      });
    } },
    wake: { text: 'For four seconds your footsteps leave little flames that burn foes who walk through them.', cast: C => a2Repeat(C, 180, 22 + 8 * a2Up(C), k => {
      const x = C.a.x, y = C.a.y + 2; if (k % 3 === 0) a2Fx(C, 'ex_fire_impact_small', x, y, 0.45); else a2Mote(C, x, y, 1, 600); C.world.timers.push({ t: 0, fn: () => C.still(x, y, 14, 0, 0.1) }); C.world.timers.push({ t: 500, fn: () => C.still(x, y, 14, 0, 0.1) });
    }) },
  },
  pillar: {
    mine: { text: 'A mine waits on the ground for eight seconds and bursts, very hard, when a foe steps near.', cast: C => {
      const x = C.tp.x, y = C.tp.y; let gone = false;
      a2Repeat(C, 150, 54, k => {
        if (gone) return; if (k % 4 === 0) C.world.rings.push({ x, y, r: 10, t: 0, col: ELEMENTS.fire.col });
        if (a2Foes(C, x, y, 28).length || k === 53) { gone = true; C.hitAt(x, y, C.R + 12 + 10 * a2Up(C), 0, 1.7, 260); }
      });
    } },
    vortex: { text: 'A vortex keeps pulling foes in and grinding them for two seconds, then bursts.', cast: C => {
      const x = C.tp.x, y = C.tp.y;
      { const N = 8 + 3 * a2Up(C); a2Repeat(C, 300, N, k => { C.drag(x, y, 90); C.still(x, y, 32, 0, 0.14); if (k % 2 === 0) a2Fx(C, C.sp.vfx, x, y, 0.7); if (k === N - 1) C.hitAt(x, y, C.R + 6, 120, 0.7, 220); }); }
    } },
    doom: { text: 'Brands the nearest foe; two and a half seconds later the brand erupts, very hard, around it.', cast: C => {
      const o = a2Foes(C, C.a.x, C.a.y, 170)[0] || null, spot = o ? null : { x: C.tp.x, y: C.tp.y };
      a2Repeat(C, 500, 5, k => { const p = o && !o.dead ? o : spot || o; if (p) { C.world.rings.push({ x: p.x, y: p.y, r: 14, t: 0, col: ELEMENTS.dark.col }); if (k % 2 === 0) a2Fx(C, 'ex_debuff_aura', p.x, p.y, 0.5); } });
      C.later(2500, () => { if (C.a.dead) return; const p = o && !o.dead ? o : spot || o; if (p) C.hitAt(p.x, p.y, C.R + 10, 0, 2.2 + 0.5 * a2Up(C), 280); });
    } },
    sentinel: { text: 'A star hangs where you stood for six seconds, zapping the nearest foe twice a second.', cast: C => {
      const x = C.a.x, y = C.a.y - 26;
      a2Repeat(C, 500, 12 + 4 * a2Up(C), k => { a2Mote(C, x, y, 2, 420); if (k % 3 === 0) a2Fx(C, 'ex_holy_aura_loop', x, y + 20, 0.4);
        const o = a2Foes(C, x, y + 26, 150)[0]; if (o) { for (let j = 1; j < 4; j++) a2Mote(C, x + (o.x - x) * j / 4, y + (o.y - 14 - y) * j / 4, 1, 200); C.hitAt(o.x, o.y, 14, 40, 0.2, 0); } });
    } },
  },
  quake: {
    hedge: { text: 'A hedge of thorns across your path for four seconds, hurting and slowing all who cross it.', cast: C => {
      const q0 = C.ahead(46), [dx, dy] = DV[C.a.dir], pts = [-2, -1, 0, 1, 2].map(s => ({ x: q0.x - dy * s * 18, y: q0.y + dx * s * 14 }));
      a2Repeat(C, 400, 10 + 4 * a2Up(C), k => { for (const [pi, p] of pts.entries()) { if ((k + pi) % 3 === 0) a2Fx(C, 'ex_poison_impact_small', p.x, p.y, 0.4); C.still(p.x, p.y, 15, 0, 0.12); for (const o of a2Foes(C, p.x, p.y, 18)) { o.status = o.status || {}; o.status.slow = Math.max(o.status.slow || 0, 700); } } });
    } },
    snare: { text: 'Roots the three nearest foes in place for a moment and hurts them.', cast: C => {
      const L = a2Foes(C, C.a.x, C.a.y, 160).slice(0, 3 + a2Up(C)); if (!L.length) { C.hitAt(C.ahead(40).x, C.ahead(40).y, 20, 80, 0.6, 0); return; }
      L.forEach((o, k) => { C.hitAt(o.x, o.y, 16, 80 + k * 90, 0.55, 0); C.later(100 + k * 90, () => { if (!o.dead && !o.boss) { o.vx = o.vy = 0; o.state = 'hurt'; o.stun = Math.max(o.stun || 0, 1400); } }); });
    } },
  },
  rain: {
    cloud: { text: 'A cloud follows you for five seconds, dropping hail on a foe near you again and again.', cast: C => a2Repeat(C, 550, 9 + 3 * a2Up(C), k => {
      a2Fx(C, 'ex_water_aura_loop', C.a.x, C.a.y - 34, 0.5);
      const L = a2Foes(C, C.a.x, C.a.y, 130); const o = L.length ? L[k % L.length] : null; if (o) C.hitAt(o.x, o.y, 18, 60, 0.32, 0);
    }) },
  },
};
for (const [arch, forms] of Object.entries(ARCANA2_FORMS)) Object.assign(SKILL_FORMS[arch], forms);
for (const [id, [n, a, el, sig, fx, form, mod, o]] of Object.entries(ARCANA2)) {
  SPECIES[id] = { name: n, arcana: true, sig, spell: Object.assign({ n, a, el, fx, icon: 31, form, mod }, o) };
  if (!ARCANA_CARDS.includes(id)) ARCANA_CARDS.push(id);
}
{  // the card text says what rank S and SSS add (cardSpell's formText)
  const cs = cardSpell;
  cardSpell = c => { const sp = cs(c); if (sp && c && ARCANA2[c.sp] && sp.formText) { const u = ARCANA2_UP[sp.form]; sp.formText += ` Rank S: ${u}, twice at SSS${(c.tier || 0) >= 8 ? ' ✓✓' : (c.tier || 0) >= 6 ? ' ✓' : ''}.`; } return sp; };
}
// ---- the second wave: six more moves of their own (same rules as above: their own forms, rank S / SSS bonuses, Arcana pool)
//   wv13 Frozen Lane   ice        quake  a strip of ice ahead for four seconds freezes foes standing on it
//   wv14 Swap Step     wind       dash   you trade places with the nearest foe and strike it, leaving it dizzy
//   wv15 Life Tether   dark       beam   a tether to the nearest foe drains it for three seconds, healing you as it goes
//   wv16 Rewind        holy       nova   three seconds later your health goes back up to what it was when you cast it
//   wv17 Hex Link      poison     rain   links up to four foes for five seconds: a share of every hit on one spreads to the rest
//   wv18 Overcharge    lightning  nova   your next three spells give back the MP they cost
const ARCANA2B = {
  wv13: ['Frozen Lane',  'quake', 'ice',       'frost',   FX.ICE,       'lane',      3, { vfx: 'ex_ice_impact_small', art: 'ex_ice_cast' }],
  wv14: ['Swap Step',    'dash',  'wind',      'evade',   FX.WIND,      'swap',      5, { vfx: 'ex_teleport_in', art: 'ex_teleport_out' }],
  wv15: ['Life Tether',  'beam',  'dark',      'vamp',    FX.VORTEX,    'tether',    2, { vfx: 'ex_dark_impact_small', art: 'ex_dark_aura_loop' }],
  wv16: ['Rewind',       'nova',  'holy',      'last',    FX.HOLY,      'rewind',    6, { vfx: 'ex_heal_sparkle', art: 'ex_holy_cast' }],
  wv17: ['Hex Link',     'rain',  'poison',    'venom',   FX.ROCKS,     'hexlink',   1, { vfx: 'ex_poison_impact_small', art: 'ex_poison_cast' }],
  wv18: ['Overcharge',   'nova',  'lightning', 'mana',    FX.LIGHTNING, 'overcharge', 4, { vfx: 'ex_lightning_impact_small', art: 'ex_lightning_cast' }],
};
Object.assign(ARCANA2_UP, { lane: 'a longer lane', swap: 'a longer daze', tether: 'a longer drain', rewind: 'a little extra healing', hexlink: 'a bigger share', overcharge: 'one more free spell' });
const HEX = { share: 0.3, ms: 5000 };
Object.assign(SKILL_FORMS.quake, {
  lane: { text: 'A strip of ice ahead of you for four seconds; foes standing on it freeze.', cast: C => {
    const pts = [1, 2, 3, 4, 5].map(k => C.ahead(k * 22));
    a2Repeat(C, 400, 10 + 4 * a2Up(C), k => { for (const [pi, p] of pts.entries()) { if ((k + pi) % 3 === 0) a2Fx(C, 'ex_ice_impact_small', p.x, p.y, 0.4); for (const o of a2Foes(C, p.x, p.y, 16)) { o.status = o.status || {}; o.status.freeze = Math.max(o.status.freeze || 0, 900); } C.still(p.x, p.y, 15, 0, 0.08); } });
  } },
});
Object.assign(SKILL_FORMS.dash, {
  swap: { text: 'You trade places with the nearest foe and strike it, leaving it dizzy.', cast: C => {
    const o = a2Foes(C, C.a.x, C.a.y, 170).find(q => !q.boss); if (!o) { C.blink(); return; }
    const ax = C.a.x, ay = C.a.y; a2Fx(C, 'ex_teleport_out', ax, ay, 0.6); a2Fx(C, 'ex_teleport_in', o.x, o.y, 0.6);
    C.a.x = o.x; C.a.y = o.y; o.x = ax; o.y = ay; C.a.dir = dirTo(o.x - C.a.x, o.y - C.a.y); C.a.invuln = Math.max(C.a.invuln || 0, 300);
    C.hitAt(o.x, o.y, 18, 60, 1.1, 120); C.later(80, () => { if (!o.dead) { o.state = 'hurt'; o.stun = Math.max(o.stun || 0, 900 + 500 * a2Up(C)); } });
  } },
});
Object.assign(SKILL_FORMS.beam, {
  tether: { text: 'A tether to the nearest foe drains it for three seconds, healing you as it goes.', cast: C => {
    const o = a2Foes(C, C.a.x, C.a.y, 150)[0]; if (!o) { C.beam(150, 30, C.a.dir, 260, 0.6); return; }
    const n = 10 + 4 * a2Up(C), T = { a: C.a, o, until: performance.now() + n * 300 }; (C.world.tethers = C.world.tethers || []).push(T);   // (the line: drawn below)
    a2Repeat(C, 300, n, () => {
      if (Math.hypot(o.x - C.a.x, o.y - C.a.y) > 200) T.until = 0;
      if (o.dead || Math.hypot(o.x - C.a.x, o.y - C.a.y) > 200) return;
      const h0 = o.hp; C.still(o.x, o.y, 14, 0, 0.22); C.later(170, () => { const got = Math.max(0, h0 - o.hp); if (got > 0) heal(C.world, C.a, got, true); });
    });
  } },
});
Object.assign(SKILL_FORMS.nova, {
  rewind: { text: 'Three seconds later your health goes back up to what it was when you cast it.', cast: C => {
    const a = C.a, hp0 = a.hp; C.world.rings.push({ x: a.x, y: a.y, r: 20, t: 0, col: ELEMENTS.holy.col }); a2Fx(C, 'ex_heal_sparkle', a.x, a.y, 0.6);
    a2Repeat(C, 600, 5, k => { if (k < 4) a2Mote(C, a.x, a.y - 14, 2, 400); else { const back = Math.max(0, hp0 - a.hp) + a.maxHp * 0.04 * a2Up(C); if (back > 0) heal(C.world, a, back); a2Fx(C, 'ex_holy_cast', a.x, a.y, 0.7); } });
  } },
  overcharge: { text: 'Charges you up: your next three spells give back all the MP they cost.', cast: C => {
    const a = C.a; a.freeCasts = 3 + a2Up(C); a.freeCastT = 20000; a2Fx(C, 'ex_lightning_cast', a.x, a.y, 0.7); floatText(C.world, a.x, a.y - 46, `FREE SPELLS ×${a.freeCasts}`, ELEMENTS.lightning.col, 7);
  } },
});
Object.assign(SKILL_FORMS.rain, {
  hexlink: { text: 'Links up to four foes for five seconds: a share of every hit on one spreads to the rest.', cast: C => {
    const L = a2Foes(C, C.tp.x, C.tp.y, 110).slice(0, 4); if (!L.length) return; const link = { list: L, until: performance.now() + HEX.ms, share: HEX.share + 0.1 * a2Up(C), owner: C.a };
    for (const o of L) { o.hexLink = link; C.hitAt(o.x, o.y, 14, 60, 0.3, 0); }
    a2Repeat(C, 1000, 5, () => { for (const o of L) if (!o.dead && o.hexLink === link) { a2Fx(C, 'ex_poison_impact_small', o.x, o.y - 6, 0.3); } });
  } },
});
for (const [id, [n, a, el, sig, fx, form, mod, o]] of Object.entries(ARCANA2B)) {
  ARCANA2[id] = ARCANA2B[id];
  SPECIES[id] = { name: n, arcana: true, sig, spell: Object.assign({ n, a, el, fx, icon: 31, form, mod }, o) };
  if (!ARCANA_CARDS.includes(id)) ARCANA_CARDS.push(id);
}
{  // Hex Link: a share of a hit on a linked foe lands on the others too (not passed on again, not from a shared hit)
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const L = def && def.hexLink, h0 = def && def.hp, r = dd(world, att, def, opts);
    if (L && performance.now() < L.until && !(opts && opts.hexShared) && att && att.team === L.owner.team) {
      const lost = Math.max(0, h0 - def.hp);
      if (lost > 0) for (const o of L.list) if (o !== def && !o.dead && o.hexLink === L) { o.invuln = 0; dd(world, att, o, { base: lost * L.share, hexShared: true, pop: 0, push: 0, launch: 0 }); }
    }
    return r;
  };
  // Overcharge: the next spells give their MP back the moment they are cast
  const cs = castSpell;
  castSpell = (world, a, sp, ...rest) => {
    const free = a && a.freeCasts > 0 && sp && sp.form !== 'overcharge' && a.kind === 'player';
    const r = cs(world, a, sp, ...rest);
    if (free) { a.mp = Math.min(a.maxMp || a.mp, a.mp + (sp.mp || 0)); a.freeCasts--; if (!a.freeCasts) floatText(world, a.x, a.y - 46, 'charge spent', '#c9c1a8', 6.5); }
    return r;
  };
}
// A GOLD DOT on every card with a new move, wherever a card is drawn (deck, collection, summons), as in the Monster Book's ARCANA tab
{
  const df = drawCardFront;
  drawCardFront = (c, x0, y0, w0, h0, now, opt) => {
    const r = df(c, x0, y0, w0, h0, now, opt);
    if (c && !c.fusion && ARCANA2[c.sp] && w0 >= 24) {
      const rr = Math.max(1.6, w0 * 0.028), x = x0 + w0 * 0.13, y = y0 + h0 * 0.075;
      ctx.save(); ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(x, y, rr + 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd860'; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    return r;
  };
}
// LIFE TETHER's line: a soft, gently waving dark beam from you to the foe being drained (world.tethers, drawn over the scene)
{
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => {
    const r = tf(game, now), w = game.world; if (!w || !w.tethers || !w.tethers.length || game.scene !== 'world' || !w.cam) return r;
    w.tethers = w.tethers.filter(T => now < T.until && !T.a.dead && !T.o.dead); const Z = w.zoom || ZOOM;
    for (const T of w.tethers) {
      const ax = (T.a.x - w.cam.x) * Z, ay = (T.a.y - 14 - w.cam.y) * Z, bx = (T.o.x - w.cam.x) * Z, by = (T.o.y - 14 - w.cam.y) * Z, nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny) || 1;
      ctx.save(); ctx.lineCap = 'round';
      for (const [wd, col, al] of [[4 * Z, '#5a2a8a', 0.35], [1.6 * Z, '#c89aff', 0.8]]) {
        ctx.strokeStyle = col; ctx.globalAlpha = al * Math.min(1, (T.until - now) / 300); ctx.lineWidth = wd; ctx.beginPath();
        for (let k = 0; k <= 10; k++) { const t = k / 10, s = Math.sin(t * Math.PI) * Math.sin(now / 120 + t * 6) * 3 * Z; const x = ax + (bx - ax) * t + nx / L * s, y = ay + (by - ay) * t + ny / L * s; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      ctx.restore();
    }
    return r;
  };
}
{  // the small card tiles (collection, deck circuit, the table games): the same dot, at the top middle (the corners hold element and rank)
  const tf = drawTFCard;
  drawTFCard = (c, x, y, w, h, now, opt) => {
    const r = tf(c, x, y, w, h, now, opt);
    if (c && !c.fusion && ARCANA2[c.sp] && w >= 16) { const rr = Math.max(1.5, w * 0.045), cx = x + w / 2, cy = y + Math.max(3, h * 0.05);
      ctx.save(); ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(cx, cy, rr + 0.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffd860'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    return r;
  };
}
// ---- the third wave: five more moves of their own
//   wv19 Echo           dark   nova    a moment later your last spell (not Echo) is cast again, at 60% power
//   wv20 Phase Shift    wind   dash    for 1.6 s nothing can touch you, you run faster and foes you pass through are cut
//   wv21 Guard Breaker  earth  quake   a shockwave around you that breaks every raised monster guard (a BREAK RUSH opens) and hurts the rest
//   wv22 Golden Touch   holy   pillar  a golden burst at your target: foes it marks drop twice the gold if they fall within 6 s
//   wv23 Ember Strikes  fire   nova    your next five normal attacks each set off a little burst of fire on the foe they hit
const ARCANA2C = {
  wv19: ['Echo',          'nova',   'dark',  'mana',   FX.VORTEX,  'echo',    1, { vfx: 'ex_arcane_impact_small', art: 'ex_arcane_portal_loop' }],
  wv20: ['Phase Shift',   'dash',   'wind',  'evade',  FX.WIND,    'phase',   6, { vfx: 'ex_wind_impact_small', art: 'ex_teleport_in' }],
  wv21: ['Guard Breaker', 'quake',  'earth', 'unstop', FX.ROCKS,   'breaker', 0, { vfx: 'ex_shield_break', art: 'ex_shield_break' }],
  wv22: ['Golden Touch',  'pillar', 'holy',  'brutal', FX.HOLY,    'midas',   2, { vfx: 'ex_buff_aura', art: 'ex_buff_aura' }],
  wv23: ['Ember Strikes', 'nova',   'fire',  'frenzy', FX.FLAME,   'strikes', 7, { vfx: 'ex_fire_impact_small', art: 'ex_fire_projectile' }],
};
Object.assign(ARCANA2_UP, { echo: 'a stronger echo', phase: 'a longer phase', breaker: 'a wider shockwave', midas: 'even more gold', strikes: 'two more strikes' });
const MIDAS = { ms: 6000 };
Object.assign(SKILL_FORMS.nova, {
  echo: { text: 'A moment later your last spell is cast again, at 60% power.', cast: C => {
    const a = C.a, last = a.lastSpell; a2Fx(C, 'ex_arcane_cast', a.x, a.y, 0.6);
    if (!last) { floatText(C.world, a.x, a.y - 44, 'Nothing to echo yet', '#c9c1a8', 7); return; }
    C.later(700, () => { if (a.dead || GAME.world !== C.world) return; const sp = { ...last, power: Math.round(last.power * (0.6 + 0.15 * a2Up(C))), echoed: true }; castSpell(C.world, a, sp, 0); floatText(C.world, a.x, a.y - 46, `ECHO: ${last.name}`, '#c8a8ff', 7); });
  } },
  strikes: { text: 'Your next five normal attacks each set off a little burst of fire on the foe they hit.', cast: C => {
    const a = C.a; a.emberHits = 5 + 2 * a2Up(C); a.emberSp = { power: C.sp.power, el: 'fire' }; a2Fx(C, 'ex_fire_cast', a.x, a.y, 0.6); floatText(C.world, a.x, a.y - 46, `EMBER STRIKES ×${a.emberHits}`, ELEMENTS.fire.col, 7);
  } },
});
Object.assign(SKILL_FORMS.dash, {
  phase: { text: 'For a moment nothing can touch you: you run faster, and foes you pass through are cut.', cast: C => {
    const a = C.a, ms = 1600 + 500 * a2Up(C), spd = a.spd; a.invuln = Math.max(a.invuln || 0, ms); a.spd = spd * 1.5; a.phaseUntil = performance.now() + ms; a2Fx(C, 'ex_teleport_out', a.x, a.y, 0.6);
    a2Repeat(C, 160, Math.round(ms / 160), k => { a2Mote(C, a.x, a.y - 10, 2, 300); C.still(a.x, a.y, 16, 0, 0.14); if (k === Math.round(ms / 160) - 1) { a.spd = spd; a2Fx(C, 'ex_teleport_in', a.x, a.y, 0.6); } });
    C.later(ms + 200, () => { if (a.spd > spd) a.spd = spd; });
  } },
});
Object.assign(SKILL_FORMS.quake, {
  breaker: { text: 'A shockwave around you breaks every raised monster guard and hurts everything it reaches.', cast: C => {
    const a = C.a, R = 70 + 15 * a2Up(C); a2Fx(C, 'ex_shield_break', a.x, a.y, 0.9);
    for (let k = 1; k <= 3; k++) C.world.rings.push({ x: a.x, y: a.y, r: R * k / 3, t: -k * 90, col: ELEMENTS.earth.col });
    for (const o of a2Foes(C, a.x, a.y, R)) {
      if (o.fgUp > 0 && typeof FOEGUARD !== 'undefined') {   // as when a guard is worn down (foeguard.js): it reels and a BREAK RUSH opens
        o.fgSt = 0; o.fgUp = 0; o.fgBroken = FOEGUARD.broken; o.fgCd = FOEGUARD.broken + rand(FOEGUARD.rest[0], FOEGUARD.rest[1]);
        o.state = 'hurt'; o.stun = Math.max(FOEGUARD.stun, RUSH.ms); setAnim(o, 'hurt'); o.rush = 0; o.rushUntil = performance.now() + RUSH.ms;
        floatText(C.world, o.x, o.y - (o.h || 26) * (o.scale || 1) - 10, 'GUARD BROKEN! · RUSH!', '#ffb36a', 9); if (typeof SFX !== 'undefined') SFX.guardBreak();
      }
      C.still(o.x, o.y, 16, 120, 0.7);
    }
  } },
});
Object.assign(SKILL_FORMS.pillar, {
  midas: { text: 'A golden burst at your target: foes it marks drop twice the gold if they fall within six seconds.', cast: C => {
    C.hitAt(C.tp.x, C.tp.y, C.R + 6, 120, 0.8, 200, { midas: 2 + a2Up(C) }); a2Fx(C, 'ex_buff_aura', C.tp.x, C.tp.y, 0.7, 120);
  } },
});
for (const [id, [n, a, el, sig, fx, form, mod, o]] of Object.entries(ARCANA2C)) {
  ARCANA2[id] = ARCANA2C[id];
  SPECIES[id] = { name: n, arcana: true, sig, spell: Object.assign({ n, a, el, fx, icon: 31, form, mod }, o) };
  if (!ARCANA_CARDS.includes(id)) ARCANA_CARDS.push(id);
}
{
  const cs = castSpell;   // Echo remembers the last spell you cast (never an echo, never Echo itself)
  castSpell = (world, a, sp, ...rest) => { const r = cs(world, a, sp, ...rest); if (a && sp && !sp.echoed && sp.form !== 'echo' && !sp.sup) a.lastSpell = sp; return r; };
  const dd = dealDamage;   // Golden Touch marks; Ember Strikes fire on normal hits
  dealDamage = (world, att, def, opts) => {
    if (opts && opts.midas && def && def.kind === 'monster') { def.midas = opts.midas; def.midasUntil = performance.now() + MIDAS.ms; }
    const r = dd(world, att, def, opts);
    if (att && att.emberHits > 0 && def && def !== att && def.kind === 'monster' && opts && !opts.spell && !opts.ember) {
      att.emberHits--; const S = att.emberSp || { power: 30 };
      world.timers.push({ t: 60, fn: () => { strike(world, att, def.x, def.y, 20, 0, { base: S.power * 0.35, el: 'fire', spell: true, ember: true, pop: 40, push: 10 }); const f = vfxAt('ex_fire_impact_small', def.x, def.y, 0.5, { lift: 8 }); if (f) world.fx.push(f); } });
    }
    return r;
  };
}
{  // Golden Touch: a marked foe that falls in time pays its gold again (x2 in all, x3 / x4 at rank S / SSS)
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => {
    const r = ok(game, w, m);
    if (m && m.midas > 1 && performance.now() < (m.midasUntil || 0) && typeof gainGold === 'function') { gainGold(game, w, m, m.midas - 1); m.midas = 0; }
    return r;
  };
}
// ---- the fourth wave: five more moves of their own
//   wv24 Snowball      ice        quake   a snowball rolls ahead, growing bigger and hitting harder the further it goes
//   wv25 Time Warp     lightning  nova    your other two spells are ready again at once
//   wv26 Mana Spring   holy       nova    a spring at your feet for five seconds: standing in it refills your MP
//   wv27 Banish        dark       pillar  the nearest foe (not a boss) is sent away for a moment and comes back dazed and hurt
//   wv28 Grapple Hook  earth      beam    a hook yanks a far foe (not a boss) right up to you, stuns and hurts it
const ARCANA2D = {
  wv24: ['Snowball',     'quake',  'ice',       'frost',   FX.ICE,       'snowball', 2, { vfx: 'ex_ice_impact_small', art: 'ex_water_projectile' }],
  wv25: ['Time Warp',    'nova',   'lightning', 'frenzy',  FX.LIGHTNING, 'timewarp', 6, { vfx: 'ex_lightning_impact_small', art: 'ex_arcane_aura_loop' }],
  wv26: ['Mana Spring',  'nova',   'holy',      'mana',    FX.HOLY,      'spring',   3, { vfx: 'ex_heal_sparkle', art: 'ex_soul_wisp' }],
  wv27: ['Banish',       'pillar', 'dark',      'last',    FX.VORTEX,    'banish',   5, { vfx: 'ex_void_portal_close', art: 'ex_void_portal_open' }],
  wv28: ['Grapple Hook', 'beam',   'earth',     'unstop',  FX.ROCKS,     'grapple',  0, { vfx: 'ex_earth_impact_small', art: 'ex_earth_projectile' }],
};
Object.assign(ARCANA2_UP, { snowball: 'a longer roll', timewarp: 'a little MP back too', spring: 'a faster spring', banish: 'a longer banishment', grapple: 'a longer reach' });
Object.assign(SKILL_FORMS.quake, {
  snowball: { text: 'A snowball rolls ahead of you, growing bigger and hitting harder the further it goes.', cast: C => {
    const n = 7 + 2 * a2Up(C);
    for (let k = 1; k <= n; k++) { const q = C.ahead(k * 22), r = 10 + k * 2.5; C.later(k * 110, () => a2Fx(C, 'ex_ice_impact_small', q.x, q.y, 0.3 + k * 0.06)); C.still(q.x, q.y, r, k * 110, 0.2 + k * 0.07); }
  } },
});
Object.assign(SKILL_FORMS.nova, {
  timewarp: { text: 'Your other two spells are ready again at once.', cast: C => {
    const a = C.a, mine = a.castSlot; let n = 0; for (let i = 0; i < 3; i++) if (i !== mine && a.cds && a.cds[i] > 0) { a.cds[i] = 0; n++; }
    if (a2Up(C) && a.maxMp) a.mp = Math.min(a.maxMp, a.mp + a.maxMp * 0.05 * a2Up(C));
    a2Fx(C, 'ex_arcane_aura_loop', a.x, a.y, 0.7); C.world.rings.push({ x: a.x, y: a.y, r: 24, t: 0, col: ELEMENTS.lightning.col });
    floatText(C.world, a.x, a.y - 46, n ? 'SPELLS READY' : 'Nothing to hurry', n ? ELEMENTS.lightning.col : '#c9c1a8', 7);
  } },
  spring: { text: 'A spring at your feet for five seconds: while you stand in it your MP fills up.', cast: C => {
    const a = C.a, x = a.x, y = a.y, R = 30;
    a2Repeat(C, 500 - 100 * a2Up(C), 10 + 2 * a2Up(C), k => {
      C.world.rings.push({ x, y, r: R, t: 0, col: '#9fd8ff' }); if (k % 2 === 0) a2Fx(C, 'ex_heal_sparkle', x, y, 0.4);
      if (Math.hypot(a.x - x, a.y - y) < R && a.maxMp) { a.mp = Math.min(a.maxMp, a.mp + a.maxMp * 0.05); a2Mote(C, a.x, a.y - 16, 2, 380); }
    });
  } },
});
Object.assign(SKILL_FORMS.pillar, {
  banish: { text: 'The nearest foe (not a boss) is sent away for a moment, then comes back dazed and hurt.', cast: C => {
    const o = a2Foes(C, C.a.x, C.a.y, 160).find(q => !q.boss && !q.miniBoss && q.guardian == null); if (!o) { C.hitAt(C.tp.x, C.tp.y, C.R, 80, 0.6, 0); return; }
    const x = o.x, y = o.y, ms = 2200 + 800 * a2Up(C); a2Fx(C, 'ex_void_portal_close', x, y, 0.7);
    o.banishT = ms; o.x = x + 4000; o.y = y; o.vx = o.vy = 0; o.state = 'hurt'; o.stun = ms + 200;
    C.later(ms, () => { if (o.dead) return; o.x = x; o.y = y; o.banishT = 0; o.invuln = 0; a2Fx(C, 'ex_void_portal_open', x, y, 0.7); C.hitAt(x, y, 18, 40, 1.1, 120); o.state = 'hurt'; o.stun = Math.max(o.stun || 0, 900); });
  } },
});
Object.assign(SKILL_FORMS.beam, {
  grapple: { text: 'A hook yanks a far foe (not a boss) right up to you, then stuns and hurts it.', cast: C => {
    const a = C.a, reach = 220 + 40 * a2Up(C), o = a2Foes(C, a.x, a.y, reach).filter(q => !q.boss && !q.miniBoss && q.guardian == null).pop();
    if (!o) { C.beam(170, 26, a.dir, 260, 0.6); return; }
    const sx = o.x, sy = o.y, ang = Math.atan2(sy - a.y, sx - a.x), tx = a.x + Math.cos(ang) * 22, ty = a.y + Math.sin(ang) * 16;
    (C.world.tethers = C.world.tethers || []).push({ a, o, until: performance.now() + 360 });
    for (let k = 1; k <= 6; k++) C.later(k * 50, () => { if (o.dead) return; o.x = sx + (tx - sx) * k / 6; o.y = sy + (ty - sy) * k / 6; o.vx = o.vy = 0; });
    C.later(320, () => { if (o.dead) return; o.state = 'hurt'; o.stun = Math.max(o.stun || 0, 1100); o.invuln = 0; });
    C.hitAt(tx, ty, 16, 200, 0.9, 0); a2Fx(C, 'ex_earth_impact_small', tx, ty, 0.6, 340);
  } },
});
for (const [id, [n, a, el, sig, fx, form, mod, o]] of Object.entries(ARCANA2D)) {
  ARCANA2[id] = ARCANA2D[id];
  SPECIES[id] = { name: n, arcana: true, sig, spell: Object.assign({ n, a, el, fx, icon: 31, form, mod }, o) };
  if (!ARCANA_CARDS.includes(id)) ARCANA_CARDS.push(id);
}
// ARCANA PAIRS: some New Arcana work together. Cast the first, then the second within ARCANA_PAIR.ms, and the second lands
// ARCANA_PAIR.mul harder with a small callout naming the pair (your own hero only; counted in pr.pairsFound for the book).
const ARCANA_PAIR = { ms: 4000, mul: 1.4, col: '#ffd860', list: [
  ['wv09', 'wv08', 'Sealed Fate'], ['wv13', 'wv24', 'Avalanche'], ['wv17', 'wv01', 'Conduit'], ['wv28', 'wv04', 'Trap Door'],
  ['wv05', 'wv21', 'Crushing Depths'], ['wv25', 'wv19', 'Deja Vu'], ['wv06', 'wv16', 'Second Dawn'], ['wv20', 'wv14', 'Blinkstep'],
] };
const arcanaPairsOf = id => ARCANA_PAIR.list.filter(P => P[0] === id || P[1] === id);
{
  const cs = castSpell;
  castSpell = (world, a, sp, ...rest) => {
    const G = window.GAME, mine = G && world === G.world && a === world.player && sp && sp.sp && !sp.echoed;
    if (mine && a.lastArc && performance.now() - a.lastArc.t < ARCANA_PAIR.ms) {
      const P = ARCANA_PAIR.list.find(q => q[0] === a.lastArc.sp && q[1] === sp.sp);
      if (P) {
        sp = { ...sp, power: Math.round(sp.power * ARCANA_PAIR.mul) }; a.lastArc = null;
        floatText(world, a.x, a.y - 50, `PAIR · ${P[2]}`, ARCANA_PAIR.col, 8); world.rings.push({ x: a.x, y: a.y, r: 26, t: 0, col: ARCANA_PAIR.col });
        const pr = G.profile; if (pr) { pr.pairsFound = pr.pairsFound || {}; if (!pr.pairsFound[P[2]]) { pr.pairsFound[P[2]] = 1; G.toast(`New Arcana pair found: ${SPECIES[P[0]].name} then ${SPECIES[P[1]].name} = ${P[2]}`, ARCANA_PAIR.col); } }
        return cs(world, a, sp, ...rest);
      }
    }
    const r = cs(world, a, sp, ...rest);
    if (mine && ARCANA2[sp.sp]) a.lastArc = { sp: sp.sp, t: performance.now() };
    return r;
  };
}
// more pairs (a card can be in two), and the PAIR MASTER title for finding every one
ARCANA_PAIR.list.push(
  ['wv07', 'wv02', 'Thorn Storm'], ['wv03', 'wv12', 'Winter Sky'], ['wv11', 'wv23', 'Fire Dance'], ['wv18', 'wv10', 'Storm Front'],
  ['wv27', 'wv22', 'Pay Day'], ['wv26', 'wv18', 'Overflow'], ['wv15', 'wv06', 'Lifeline'],
);
if (typeof TITLE_BY !== 'undefined' && !TITLE_BY.pairmaster) {
  const t = { id: 'pairmaster', name: 'Pair Master', tier: 3, how: `Find all ${ARCANA_PAIR.list.length} Arcana pairs`, prog: pr => [Object.keys(pr.pairsFound || {}).length, ARCANA_PAIR.list.length] };
  TITLE_LIST.push(t); TITLE_BY.pairmaster = t; TITLE_PASSIVES.pairmaster = ['crit', 'mana', 'frenzy', 'burst'];
}
