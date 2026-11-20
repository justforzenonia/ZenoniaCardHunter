'use strict';
// Actors, combat resolution, passives, statuses, monster AI, spells and fusion attacks.

const GRAVITY = 560, JUGGLE_MAX = 9, AIR_HIT_Z = 140, HITSTUN = 600, LUNGE = 34;
// Juggle physics: air hits pop a foe toward a set height (they don't stack — hitting a foe that is already high
// just keeps it there), launchers top out at LAUNCH_APEX, gravity grows a little with every juggle hit, and after
// JUGGLE_LIMIT air hits the foe drops to the ground and has to be knocked up again from there.
const JUGGLE_APEX = 30, LAUNCH_APEX = 64, JUGGLE_LIMIT = 14;
const vzForApex = (z, apex) => Math.sqrt(2 * GRAVITY * Math.max(0, apex - z));
const FIST_CHAIN = ['atk1', 'atk2', 'atk1', 'atk3'];
const MELEE = { atk1: { mul: 0.8, push: 30, pop: 135 }, atk2: { mul: 0.9, push: 35, pop: 145 },
  atk3: { mul: 1.4, push: 60, launch: 235, pop: 165 } };
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// RANKED RULES (the Ranked Arena only): every blow and spell lands for 5% of its damage, spell cooldowns run at a third of
// the speed (+200%: three times as long), the Layer Skill's cooldown is 2.5 times as long (+150%), and each round opens with
// every spell and the Layer on cooldown (main.js)
const RANKED_RULES = { dmg: 0.05, cdRate: 1 / 3, layerCd: 2.5 };
const rankedOn = w => !!(w && window.GAME && GAME.arena && GAME.arena.ranked && GAME.world === w);
// Chef Daddy's passive, In the Weeds: when overwhelmed (below 40% HP, or 3+ foes close by) he slips into a calm
// where the world crawls — every foe runs at `slow` speed for `dur` ms while he moves and swings faster.
const WEEDS = { dur: 6000, cd: 30000, slow: 0.4, hp: 0.4, crowd: 3, near: 70, haste: 1.35 };
const dirTo = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);

// ---------------------------------------------------------------- actor creation
function makePlayerActor(profile, team, x, y) {
  const st = profileStats(profile);
  const a = baseActor('player', team, x, y);
  Object.assign(a, {
    cls: profile.cls, look: st.look, maxHp: st.hp, hp: st.hp, maxMp: st.mp, mp: st.mp,
    atk: st.atk, def: st.def, crit: st.crit, spd: st.spd, passives: st.passives, spellAmp: st.spellAmp || 0, cdr: st.cdr || 0,
    spells: st.spells, fusion: st.fusion, cds: [0, 0, 0], fgauge: 0, h: 28, lv: st.lv,
    style: CLASSES[profile.cls].style, banks: playerBanks(profile.cls, profile.look, st.look), shine: gearShine(profile),
    familiarSpecies: profile.cls === 4 ? familiarPicks(profile) : null,
    layerChoice: profile.layerChoice || 'holy',
    layerM: window.GAME && profile === GAME.profile ? (profile.layerM = profile.layerM || {}) : null,   // Layer Mastery (layers.js)
  });
  return a;
}
// FOLLOWING: the hero leaves a trail of footsteps (owner.steps; not .trail, which is the afterimages); each follower aims for a point a set way back along it, so they
// walk behind you the way you came, round corners, instead of copying your moves. The partner is first in line, then the
// hound, the wolf, the drake, then familiars; each a little to one side so they never stand on each other.
const FOLLOW = { step: 3, keep: 120, first: 24, gap: 18, side: 7 };
const FOLLOW_RANK = { hero: 0, pet: 1, wolf: 2, drake: 3 };
function followSpot(o, m) {
  let T0 = o.steps || (o.steps = [{ x: o.x, y: o.y }]), last = T0[T0.length - 1];
  if (Math.hypot(o.x - last.x, o.y - last.y) > 60) { T0 = o.steps = [{ x: o.x, y: o.y }]; last = T0[0]; }   // (a teleport or a door: start a fresh trail)
  if (Math.hypot(o.x - last.x, o.y - last.y) >= FOLLOW.step) { T0.push({ x: o.x, y: o.y }); if (T0.length > FOLLOW.keep) T0.shift(); }
  const rank = FOLLOW_RANK[m.petKind || ''] ?? (4 + Math.abs(Math.round(m.slot || 0))), want = FOLLOW.first + rank * FOLLOW.gap;
  let px = o.x, py = o.y, d = 0, ax = 0, ay = 1;
  for (let i = T0.length - 1; i >= 0; i--) {
    const q = T0[i], seg = Math.hypot(q.x - px, q.y - py);
    if (seg > 0) { ax = (px - q.x) / seg; ay = (py - q.y) / seg; }
    if (d + seg >= want) { const k = (want - d) / seg; px += (q.x - px) * k; py += (q.y - py) * k; d = want; break; }
    d += seg; px = q.x; py = q.y;
  }
  if (d < want) { const [bx, by] = DV[o.dir]; px -= bx * (want - d); py -= by * (want - d) * 0.7; ax = bx; ay = by; }   // (a short trail: just behind where you face)
  const side = (rank % 2 ? 1 : -1) * FOLLOW.side;   // to alternate sides of the line
  return { x: px - ay * side, y: py + ax * side * 0.6 + 4 };
}
function makeMonster(sp, tier, x, y) {
  const S = SPECIES[sp], bank = D.monsters[sp];
  const a = baseActor('monster', 1, x, y);
  const passives = monsterPassives(sp, tier);
  const big = bank.h > 48;
  Object.assign(a, {
    sp, tier, plist: passives, passives: sumPassives(passives),
    maxHp: Math.round(S.hp * HP_MULT[tier] * MOB_BASE.hp), atk: S.dmg * DMG_MULT[tier] * MOB_BASE.atk, def: tier * 1.5 * MOB_BASE.def, crit: 0,
    spd: S.spd, h: bank.h, heavy: big, pal: Math.min(bank.imgs.length - 1, tier >= 8 ? 3 : tier >= 6 ? 2 : tier >= 4 ? 1 : 0),
    scale: tier >= 6 ? 1 + (tier - 5) * 0.06 : 1,
    ai: { mode: 'wander', t: rand(0, 1500), tx: x, ty: y, cast: rand(3000, 6000) },
    spell: tier >= 5 ? cardSpell({ sp, tier }) : null,
  });
  a.hp = a.maxHp;
  return a;
}
function baseActor(kind, team, x, y) {
  return { id: uid(), kind, team, x, y, z: 0, vx: 0, vy: 0, vz: 0, dir: 2, state: 'free', anim: 'idle', t: 0, loop: true,
    hp: 1, maxHp: 1, mp: 0, maxMp: 0, shield: 0, barrierT: 8000, status: {}, combo: 0, comboT: 0,
    juggled: 0, bounced: false, stun: 0, invuln: 0, downT: 0, hitIds: new Set(), hitLanded: false, queued: false,
    alpha: 1, dead: false, remove: false };
}

// ---------------------------------------------------------------- animation glue
function actorAnims(a) {
  if (a.bank) return fullAnims(a.bank);
  if (a.kind === 'player') return a.banks.anims;
  if (a.kind === 'monster') return a.pet || a.npcBody ? fullAnims(charBank(a.sp)) : D.monsters[a.sp].anims;   // (the dog: an NPC sprite, see pet.js)
  return D.npcs[a.npc].anims;
}
const MON_MAP = { charge: 'cast', atk1: 'attack', atk2: 'attack', atk3: 'attack', skill: 'attack', cast: 'attack', knock: 'hurt', down: 'hurt', win: 'idle' };
function animSeq(a, name) {
  const A = actorAnims(a);
  let n = name;
  if (!A[n]) n = MON_MAP[n] || 'idle';
  if (!A[n]) n = 'idle';
  const dir = a.bank && a.bank.side ? (a.side = a.dir % 2 ? a.dir : a.side || 1) : a.dir;   // (art that only faces sideways keeps its last side)
  return A[n][dir] && A[n][dir].length ? A[n][dir] : A[n].find(s => s.length);
}
function animSpeed(a) {
  const fr = a.passives ? (a.passives.frenzy || 0) : 0;
  if (a.state === 'dashing') return 2.5;
  if (a.running && a.anim === 'walk') return 1.7;
  const cls = a.kind === 'player' ? CLASSES[a.cls].anim : 1;
  return cls * (1 + fr / 100) * (a.status.freeze ? 0.6 : 1) * (a.transcend > 0 && a.kind === 'player' && lsk(a, 'ascend') ? 1.25 : 1)   // ascended: faster swings
    * (a.weedsT > 0 ? WEEDS.haste : 1) * (a.heatT > 0 ? 1.2 : 1);
}
function setAnim(a, name, loop = false) {
  if (a.anim === name && a.loop && loop) return;
  a.anim = name; a.t = 0; a.loop = loop; a.hitIds.clear(); a.hitLanded = a.hitLanded && name !== 'idle';
}
function animLen(a, name = a.anim) { return seqDur(animSeq(a, name), animSpeed(a)); }
function animDone(a) { return !a.loop && a.t >= animLen(a); }

// ---------------------------------------------------------------- geometry
function hurtbox(a) {
  const w = Math.max(14, (a.h || 26) * 0.55) * (a.scale || 1), h = (a.h || 26) * (a.scale || 1);
  return { x: a.x - w / 2, y: a.y - h - a.z, w, h: h + 4 };
}
function meleeBox(a, reach) {
  const r = reach;
  switch (a.dir) {
    case 0: return { x: a.x - 18, y: a.y - 26 - r, w: 36, h: r + 8 };
    case 1: return { x: a.x + 2, y: a.y - 30, w: r, h: 34 };
    case 2: return { x: a.x - 18, y: a.y - 8, w: 36, h: r + 4 };
    default: return { x: a.x - 2 - r, y: a.y - 30, w: r, h: 34 };
  }
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// two players in a friendly duel (netduel.js) may hit each other, and only each other
const duelFoes = (a, o) => !!(a && o && a !== o && a.duelLive && o.duelLive && a.duelId === o.duelId);   // (the duel's number, not the actor: a rebuilt hero stays in it)
function enemiesOf(world, a) { return world.actors.filter(o => (o.team !== a.team || duelFoes(a, o)) && !o.dead && (o.kind === 'player' || o.kind === 'monster')); }
function nearestEnemy(world, a, maxD = 999) {
  let best = null, bd = maxD;
  for (const o of enemiesOf(world, a)) { const d = dist(a, o); if (d < bd) { bd = d; best = o; } }
  return best;
}

// ---------------------------------------------------------------- damage
function floatText(world, x, y, str, col = '#fff', size = 10) {
  const num = /^\d/.test(str), x0 = x, y0 = y;
  if (num && /^\d+$/.test(str)) {   // MERGE: a quick hit on the same spot, in the same colour, adds to the number already showing (a calmer screen)
    const same = world.floats.find(f => f.num && f.t < 250 && !f.netSent && f.col === col && /^\d+$/.test(f.str) && Math.abs(f.x0 - x0) < 14 && Math.abs(f.y0 - y0) < 14);
    if (same) { same.str = String(+same.str + +str); same.size = Math.min(size + 3, Math.max(same.size, size) + 0.5); same.t = Math.min(same.t, 60); return; }   // (it grows a touch with each hit; not after it went to co-op friends)
  }
  if (num) { const near = world.floats.filter(f => f.num && f.t < 300 && Math.abs(f.x0 - x0) < 14 && Math.abs(f.y0 - y0) < 14).length; y -= Math.min(4, near) * 9; }   // (fast hits on one spot stack into a little column instead of piling up)
  else if (!/^[+\-~]/.test(str) && str !== 'PAYBACK!') {   // the same message again (a spell on cooldown, Not enough MP, pressed over and over) refreshes the one already showing instead of piling up copies
    const key = str.replace(/[\d.]+/g, '#'), same = world.floats.find(f => !f.num && f.t < 600 && Math.abs(f.x0 - x0) < 34 && typeof f.str === 'string' && f.str.replace(/[\d.]+/g, '#') === key);
    if (same) { const t = Math.min(same.t, 120); same.y -= (same.t - t) * 0.035; same.str = str; same.col = col; same.t = t; return; }   /* (it stays where it is and simply lasts longer) */
  }
  if (!num) {   // word labels (+9 G, RESTED +16, ELITE!) that land on one spot line up one above the other instead of overlapping
    const near = world.floats.filter(f => !f.num && f.t < 600 && Math.abs(f.x0 - x0) < 34).map(f => ({ y: f.y - f.t * 0.035, s: f.size })).sort((a, b) => b.y - a.y);
    for (const f of near) { const gap = (f.s + size) / 2 + 2; if (Math.abs(f.y - y) < gap) y = f.y - gap; }
  }
  world.floats.push({ x: x + (num ? rand(-4, 4) : 0), y, x0, y0, str, col, size, t: 0, num, vx: rand(-14, 14) });
}

// opts: {base, melee, launch, pop, push, el, status, spell, kind}
// ELEMENT TRIPLE: when the three equipped spells share one element, everything the hero deals in that element hits 15% harder
const TRIPLE_BONUS = 0.15, SPELL_SET = { triple: 0.15, pair: 0.10, mixed: 0.05 };
function spellTriple(a) { const S = a && a.kind === 'player' && a.spells; if (!S || S.length < 3 || S.some(s => !s)) return null; const el = S[0].el; return S.every(s => s.el === el) ? el : null; }
// THE SPELL SET, from the elements of the three spells in Q/E/R: three of one element +15% to it (a TRIPLE), two of one +10% to
// that dominant element (a PAIR), three different +5% to each of the three (MIXED). spellSet(els) -> { kind, els: { el: bonus } }
function spellSet(els) {
  if (els.length < 3 || els.some(e => !e)) return null; const n = {}; for (const e of els) n[e] = (n[e] || 0) + 1; const keys = Object.keys(n);
  if (keys.length === 1) return { kind: 'triple', lead: keys[0], els: { [keys[0]]: SPELL_SET.triple } };
  if (keys.length === 2) { const lead = keys.find(k => n[k] === 2); return { kind: 'pair', lead, els: { [lead]: SPELL_SET.pair } }; }
  return { kind: 'mixed', lead: null, els: Object.fromEntries(keys.map(k => [k, SPELL_SET.mixed])) };
}
function spellSetBonus(a, el) { const S = a && a.kind === 'player' && a.spells; if (!S || !el) return 0; const set = spellSet(S.map(s => s && s.el)); return set ? set.els[el] || 0 : 0; }
function dealDamage(world, att, def, opts) {
  if (def.heroPartner) def.dojoGuard = !!world.dojoRoom;   // (sparring never costs you your partner)
  if (def.state === 'dashing' && !def.dodged) { def.dodged = true; floatText(world, def.x, def.y - 40, 'DODGE', '#9fe8ff', 9); }
  if (def.ward && att && att.kind === 'player' && !(def.wardT > 0)) { def.wardT = 900; floatText(world, def.x, def.y - 60, def.wardWhy ? `WARDED — ${def.wardWhy}` : 'WARDED', '#d8b8ff', 9); }
  if (def.dead || def.invuln > 0 || def.devGod || def.ward || def.state === 'down' || (def.state === 'air' && def.hp <= 0)) return false;   // (devGod: OmegaKingX's god mode)
  if (world.animals && !def.animalBody) (world.fray = world.fray || []).push({ x: def.x, y: def.y, t: performance.now() });   // a fight here: the herds nearby bolt (animals.js)
  if (def.ghalo && typeof guardianBlock === 'function' && guardianBlock(world, att, def, opts)) return false;   // the Guardian Halo takes the hit and answers it (layerswords.js)
  if (def.z > AIR_HIT_Z && !opts.spell) return false;
  // BLOCK: a raised guard is a bubble all round you (world.js drawGuard), so it holds from every side. Blows are mostly soaked,
  // and spells are DEFLECTED (no damage).
  // Perfect block (first 0.18 s) = PARRY: no damage, and the attack — blow or spell — is REFLECTED back at whoever
  // threw it, hitting them for its full power and stunning them. (A reflected attack can't be reflected again.)
  if (def.state === 'block' && att !== def) {
    const tx = att.x - def.x, ty = att.y - def.y, tl = Math.hypot(tx, ty) || 1;
    {   // (any side: the bubble is round)
      const hx = def.x + tx / tl * 14, hy = def.y - 13 - def.z + ty / tl * 10;   // (where the blow meets the bubble)
      def.blockFlash = 160;
      if (def.blockT < guardPerfect(def) + (att.parryEaseT > 0 && opts.spell ? 450 : 0)) {   // (Wide Parry: guard.js)
        guardSpend(world, def, -GUARDX.parry);
        if (def.chiOn && !(def.chiT > 0)) def.chi = Math.min(CHI.max, (def.chi || 0) + CHI.parry);   // (a boss's telegraphed spell: a wider window)
        floatText(world, def.x, def.y - 44, 'PARRY!', '#ffe08a', 11);
        world.rings.push({ x: hx, y: def.y, r: 22, t: 0, col: '#ffe08a' });
        impactBurst(world, hx, hy, '#ffe08a', 10, tx || 1, ty);
        world.hitStop = Math.max(world.hitStop, 120); world.shake = Math.max(world.shake, 3);
        if (typeof SFX !== 'undefined') SFX.parry();
        if (window.GAME && GAME.world && def === GAME.world.player) bumpStat('parries'); else if (def.netGid && typeof netStatTo === 'function') netStatTo(GAME, def.netGid, 'parries');   // (a co-op friend's parry counts on their save)
        if (!opts.reflected && !att.dead) {   // REFLECT: the attack goes back to its caster, who is stunned
          const col = opts.spell ? (ELEMENTS[opts.el] || {}).col || '#ffe08a' : '#ffe08a';
          world.bolts.push({ x1: hx, y1: hy, x2: att.x, y2: att.y - 14 - (att.z || 0), t: 0, dur: 220, seed: Math.random() * 1000, w: 2, col });
          dealDamage(world, def, att, { ...opts, reflected: true, melee: false, launch: 0, pop: 120, push: 60 });
          if (!att.dead) {
            att.state = 'hurt'; att.stun = GUARD.reflectStun * (att.heavy ? 0.6 : 1); setAnim(att, 'hurt'); att.vx = tx / tl * 70; att.vy = ty / tl * 70;
            floatText(world, att.x, att.y - 48, 'REFLECTED · STUNNED', col, 9);
            world.rings.push({ x: att.x, y: att.y, r: 18, t: 0, col });
          }
        }
        return true;
      }
      if (opts.spell) {   // a guard deflects spells outright
        guardSpend(world, def, GUARDX.spell);   // (each one wears the guard down: guard.js)
        floatText(world, def.x, def.y - 34, 'DEFLECT', '#c8e8ff', 9);
        impactBurst(world, hx, hy, (ELEMENTS[opts.el] || {}).col || '#9fd8ff', 8, tx || 1, ty);
        def.vx = -tx / tl * 30; def.vy = -ty / tl * 30;
        world.hitStop = Math.max(world.hitStop, 45);
        if (typeof SFX !== 'undefined') SFX.block();
        return true;
      }
      let dmg = opts.base * (opts.spell ? GUARD.spell : opts.crush ? GCRUSH.soak : GUARD.melee) * 100 / (100 + (def.def || 0) * totemDef(def) * 4);
      dmg = Math.max(1, Math.round(dmg * (rankedOn(world) ? RANKED_RULES.dmg : 1)));
      def.hp = Math.max(def.dojoGuard || def.duelLive ? 1 : 0, def.hp - dmg); if (def.dummy) dummyHit(world, def, dmg);   // (a guard can't save you from a blow you can't afford; only Dojo sparring stops at 1 HP)
      floatText(world, def.x, def.y - 34, opts.crush ? `${dmg} CRUSHED` : `${dmg} BLOCK`, opts.crush ? '#ff8a6a' : '#9fd8ff', 9);
      impactBurst(world, hx, hy, '#9fd8ff', 6, tx || 1, ty);
      def.vx = -tx / tl * 45; def.vy = -ty / tl * 45;   // pushed back a little, but no stagger
      world.hitStop = Math.max(world.hitStop, 55); world.shake = Math.max(world.shake, 1.5);
      if (typeof SFX !== 'undefined') SFX.block();
      guardSpend(world, def, opts.crush ? GCRUSH.drain : GUARDX.melee);   // (a guard crusher drains most of it)
      return true;
    }
  }
  const P = def.passives || {}, AP = att.passives || {};
  if ((P.evade && Math.random() * 100 < P.evade) || (def.smokeT > 0 && Math.random() < 0.5)) { floatText(world, def.x, def.y - 34 - def.z, 'MISS', '#9fd3ff'); return true; }
  let dmg = opts.base;
  dmg *= 1 + (AP.brutal || 0) / 100;
  if (att.buffAtk > 0) dmg *= 1.25;
  if (att.chiT > 0) dmg *= chiPower(att.chiLv || 1) + (att.kiPower || 0);   // after a Chi release (chi.js)
  dmg *= seasonDamage(att, def, opts);   // the week's theme (season.js)
  if (opts.el) dmg *= 1 + spellSetBonus(att, opts.el);   // the SPELL SET: a triple +15%, a pair +10% to its element, three different +5% each
  if (att.chiOn && !opts.spell && !(att.chiT > 0)) att.chi = Math.min(CHI.max, (att.chi || 0) + CHI.hit + (att.kiGather || 0));
  if (def.pet) dmg *= 1 - def.pet.guard;           // the dog's Thick Coat
  if (att.hungerMul) dmg *= att.hungerMul;            // hungry heroes hit softer
  if (att.heatT > 0) dmg *= 1.3;                      // Turn Up the Heat
  if (att.wellFed > 0) dmg *= 1.2;                    // Gourmet Meal
  if (def.wellFed > 0) dmg *= 0.8;
  if (att.meal && opts.spell && att.meal.spell) dmg *= att.meal.spell;   // food buffs (home.js MEAL_FX); ATK/DEF/crit are in the stats
  if (def.meal && def.meal.guard) dmg *= def.meal.guard;
  if (att.kind === 'monster' && !att.ally) dmg *= nightMul(1 + NIGHT.dmg);     // night: monsters hit harder…
  if (def.kind === 'monster' && !def.ally) dmg /= nightMul(1 + NIGHT.guard);   // …and shrug more off
  const sharp = att.sharpT > 0 && !opts.spell;        // Knife Sharpen: melee cuts crit more and bite deeper
  if (sharp) dmg *= 1.2;
  if (att.transcend > 0) dmg *= layerBoost(att);     // transcended: +40% attack (more with POWER)
  if (def.transcend > 0) dmg /= layerBoost(def);     // …and +40% defence
  if (att.form) dmg *= PET_FORM.boost;               // the hound's Beast Soul (pet.js)
  if (def.form) dmg /= PET_FORM.boost;
  if (att.alphaKey) dmg *= ALPHA.hit;                  // a side area's Alpha (sideareas.js)
  if (def.alphaKey) dmg /= ALPHA.guard;
  if (def.exhausted > 0) dmg *= 1 + LAYER.exhaust;     // exhausted afterwards: +100% damage taken
  if (att.hp < att.maxHp * 0.3) dmg *= 1 + (AP.last || 0) / 100;
  let crit = false;
  if (Math.random() * 100 < Math.min(CRIT_CAP, (att.crit || 0) + (AP.crit || 0)) + (sharp ? 40 : 0) + (opts.critBonus || 0)) { dmg *= 2; crit = true; }
  if (att.heatT > 0 && !opts.spell && !def.dead) applyStatus(def, 'fire', dmg);   // the heat is on: every cut burns
  if (def.status.crack) dmg *= 1.25;
  dmg *= 1 - (P.hide || 0) / 100;
  dmg *= 100 / (100 + (def.def || 0) * totemDef(def) * 4);
  if (def.state === 'air') dmg *= Math.max(0.35, 1 - def.juggled * 0.1);
  dmg = Math.max(1, Math.round(dmg * rand(0.92, 1.08)));
  if (opts.pctMax) dmg = Math.max(1, Math.round((def.maxHp || 1) * opts.pctMax));   // a mimic's bite: a fixed share of your max HP
  if (def.iceShield > 0) {   // the Glacier Warden's ice (bosses.js): soaks the blow first; fire and heavy blows break it twice as fast
    const m2 = opts.el === 'fire' || opts.launch ? 2 : 1, ab = Math.min(def.iceShield, dmg * m2); def.iceShield -= ab; dmg -= Math.round(ab / m2);
    floatText(world, def.x, def.y - 44 - def.z, def.iceShield > 0 ? 'ICE' : 'SHIELD BROKEN!', '#bff0ff', def.iceShield > 0 ? 8 : 11);
  }
  if (def.dojoGuard) dmg = Math.min(dmg, Math.round(def.maxHp * 0.35));   // sparring: no single blow ends a dojo match
  if (rankedOn(world)) dmg = Math.max(1, Math.round(dmg * RANKED_RULES.dmg));   // (ranked rules: after every cap, so a blow lands for 5% of what it would)
  if (typeof netPartyScale === 'function') dmg = netPartyScale(att, def, dmg);   // online co-op: a bigger party, tougher monsters (netparty.js)
  if (def.driving && typeof vehShieldHit === 'function') { vehShieldHit(world, def, dmg); impactBurst(world, def.x, def.y - 14, '#8fd8ff', 6, 1, 0); return true; }   // at the wheel: the car's shield takes the whole blow, the hero doesn't even flinch (vehicles.js)
  if (def.shield > 0) { const ab = Math.min(def.shield, dmg); def.shield -= ab; dmg -= ab; if (ab) floatText(world, def.x, def.y - 44 - def.z, '-' + ab + ' shield', '#9fd3ff', 8); }
  def.hp = Math.max(0, def.hp - dmg);
  if (def.dummy) dummyHit(world, def, dmg);   // the training dummy: counted, and whole again (training.js)
  if (def.pet && !def.heroPartner && !def.netOf && typeof petBowlGuard === 'function') petBowlGuard(world, def);
  if (def.duelLive && def.hp <= 1) { def.hp = 1; if (typeof netDuelDown === 'function') netDuelDown(def); }   // a friendly duel (netduel.js): down to 1 HP and out, never dead
  if (def.dojoGuard && def.hp < 1) def.hp = 1;   // the dojo (dojo.js): a sparring match never kills   // the dog's food bag holds it at 1% HP
  if (def.kind === 'player' && att.hunter) def.hunterHitT = 3000;   // a mercenary's blow (rent.js: a death to them costs your gold)
  if (opts.tw) twistOnHit(world, att, def, dmg, opts);
  if (def.kind === 'player') {   // ten hits in a row without dashing: remind the player dash breaks combos
    def.hitStreak = (def.hitStreakT > 0 ? def.hitStreak || 0 : 0) + 1; def.hitStreakT = 2500;
    // hit by spells (twice within a few seconds): the PERFECT PARRY tip — a guard deflects them, a parry sends them back
    if (opts.spell && !opts.reflected && att !== def) {
      def.spellHits = (def.spellHitT > 0 ? def.spellHits || 0 : 0) + 1; def.spellHitT = 4000;
      if (def.spellHits >= 2 && window.GAME && GAME.world && def === GAME.world.player && performance.now() - (GAME.parryTipT || -1e9) > 60000) {
        GAME.parryTipT = performance.now(); def.spellHits = 0;
        if (!(GAME.profile.tips && GAME.profile.tips.parry)) tipEvent(GAME, 'parry');
        else GAME.toast('Tip: hold L as a spell comes, from any side, to DEFLECT it — block just as it lands to PERFECT PARRY it back at the caster and stun them!', '#ffe08a');
      }
    }
    // more than six hits in a row: the BLOCK tip (the window the first time, a reminder now and then after)
    if (def.hitStreak === 7 && window.GAME && GAME.world && def === GAME.world.player && performance.now() - (GAME.blockTipT || -1e9) > 60000) {
      GAME.blockTipT = performance.now();
      if (!(GAME.profile.tips && GAME.profile.tips.block)) tipEvent(GAME, 'block');
      else GAME.toast('Tip: hold L to BLOCK — it soaks blows and deflects spells; block just as an attack lands to PARRY it back at the caster and stun them!', '#9fd8ff');
    }
    if (def.hitStreak >= 10 && window.GAME && GAME.world && def === GAME.world.player && performance.now() - (GAME.dashTipT || -1e9) > 45000) {
      GAME.dashTipT = performance.now(); def.hitStreak = 0;
      if (!(GAME.profile.tips && GAME.profile.tips.dash)) tipEvent(GAME, 'dash');   // first time: the tip window
      else GAME.toast('Tip: press SHIFT (or K) to DASH — it works even while you are being hit, and breaks the combo!', '#9fe8ff');
    }
  }
  const asc = att.kind === 'player' && att.transcend > 0;   // ascended: numbers come out huge and gold; hits the hero takes show in soft red, so taken and dealt read apart
  floatText(world, def.x, def.y - (def.h || 26) * (def.scale || 1) * 0.55 - def.z, crit && !opts.plain ? dmg + '!' : String(dmg),   /* (from the middle of the body, clear of the health capsule above the head: world.js) */   // (plain: no "!" on a crit — the layer swords' small chip hits)
 def.kind === 'player' && att.kind !== 'player' ? (crit ? '#ff5a6a' : '#ff8a8a') : asc ? (crit ? '#ffffff' : '#fff0a0') : crit ? '#ffd23f' : opts.spell ? (ELEMENTS[opts.el] || {}).col || '#fff' : '#fff', asc ? (crit ? 18 : opts.echo ? 11 : 14) : crit ? 13 : 10);
  def.flashT = 90;
  const HL = att.kind === 'player' && !opts.spell ? heroLayer(att) : null;   // (a hero's blows spark in their Layer's colours)
  const hitCol = HL ? (crit ? HL.inner : HL.bloom) : opts.fist && !crit ? '#ffd27a' : opts.spell ? (ELEMENTS[opts.el] || {}).col || '#fff' : crit ? '#ff5a3a' : '#ffa632';
  const big = !!opts.launch || crit;
  const hx = def.x - (def.x - att.x) * 0.15, hy = def.y - 14 - def.z;
  world.slashes.push({ x: hx, y: hy, dx: def.x - att.x || 1, dy: def.y - att.y, t: 0, col: hitCol, big, rot: rand(0, Math.PI) });
  impactBurst(world, hx, hy, hitCol, big ? 12 : 7, def.x - att.x || 1, def.y - att.y);
  // sustain
  if (AP.vamp) heal(world, att, dmg * AP.vamp / 100, true);
  if (opts.status && opts.el === 'dark') heal(world, att, dmg * 0.25, true);
  if (opts.status && opts.el === 'holy') heal(world, att, dmg * 0.15, true);
  if (opts.melee && P.thorns && att !== def) { const r = Math.round(dmg * P.thorns / 100); if (r > 0) { att.hp = Math.max(1, att.hp - r); floatText(world, att.x, att.y - 34, String(r), '#ff8a8a', 8); } }
  // on-hit passives & element statuses
  if (AP.frost && Math.random() * 100 < AP.frost) def.status.slow = 1500;
  if (AP.venom) def.status.poison = { t: 3000, dps: dmg * AP.venom / 100 / 3 };
  if (opts.status) applyStatus(def, opts.el, opts.base);
  // meters
  if (att.kind === 'player') {
    att.mp = Math.min(att.maxMp, att.mp + 2);
    att.fgauge = Math.min(100, (att.fgauge || 0) + (opts.spell ? 6 : 3.5));
  }
  att.combo = def.state === 'free' || def.state === 'attack' || def.state === 'cast' ? 1 : att.combo + 1;
  att.comboT = 1300;
  if (att.kind === 'player' && att.combo >= 5 && window.GAME && GAME.world && att === GAME.world.player) questEvent(GAME, 'combo', { n: att.combo });
  att.hitLanded = true;
  // impact: freeze frame, the target shudders, the camera kicks, a meaty sound
  const stop = att.kind === 'player' ? (opts.launch ? 115 : crit ? 105 : opts.spell ? 55 : 75) : def.kind === 'player' ? 70 : 0;   // (partners and monsters trading blows don't stop the world)
  world.hitStop = Math.max(world.hitStop, stop);
  def.vibUntil = performance.now() + stop * HIT_STOP + 90;
  if (att.kind === 'player' || def.kind === 'player') world.shake = Math.max(world.shake, crit ? 3.5 : big ? 2.6 : def.kind === 'player' ? 2.2 : 1.4);
  if (typeof SFX !== 'undefined') {
    SFX.hit({ big, crit, magic: !!opts.spell, hurtPlayer: def.kind === 'player' });
    if (def.kind === 'player') SFX.hurt();
  }
  if (typeof gearWear === 'function') gearWear(world, att, def, dmg);   // gear wears down in fights (durability.js)
  if (def.kind === 'player' && dmg > def.maxHp * 0.06) world.flash = { t: 0, dur: 160, col: '#ff2a2a' };
  react(world, att, def, opts);
  if (def.boss && def.kind === 'monster' && def.hp > 0) bossComboBreak(world, att, def);
  if (asc && !opts.echo && lsk(att, 'ascend')) ascendedImpact(world, att, def, opts);
  if (def.hp <= 0 && def.kind === 'monster' && att.team !== def.team) {   // the killing blow lands heavier
    world.hitStop = Math.max(world.hitStop, 150); world.shake = Math.max(world.shake, 4); world.slowmo = Math.max(world.slowmo || 0, 60);
    world.rings.push({ x: def.x, y: def.y, r: 26, t: 0, col: '#ffffff' });
    if (typeof SFX !== 'undefined') SFX.kill();
  }
  return true;
}

// Ascended (Layer form) hits land like meteors: a longer freeze and a heavy camera kick, a gold shockwave that
// splashes every foe close by, a phantom echo strike a beat later, white-gold sparks and a deep smite.
function ascendedImpact(world, att, def, opts) {
  world.hitStop = Math.max(world.hitStop, opts.launch ? 170 : 135);
  world.shake = Math.max(world.shake, opts.launch ? 6.5 : 5);
  const hy = def.y - 14 - def.z, dx = def.x - att.x || 1, dy = def.y - att.y;
  const L = layerPal(att);
  world.rings.push({ x: def.x, y: def.y, r: 40, t: 0, col: '#fff2b0' }, { x: def.x, y: def.y, r: 24, t: 0, col: L.mote });
  world.slashes.push({ x: def.x, y: hy, dx, dy, t: 0, col: '#ffffff', big: true, rot: rand(0, Math.PI) });
  impactBurst(world, def.x, hy, '#ffe08a', 18, dx, dy);
  impactBurst(world, def.x, hy, L.bloom, 8, -dx, -dy);
  for (const o of enemiesOf(world, att))   // shockwave splash
    if (o !== def && Math.hypot(o.x - def.x, (o.y - def.y) * 1.4) < 42) dealDamage(world, att, o, { ...opts, base: opts.base * 0.45, echo: true, launch: 0 });
  if (opts.melee) world.timers.push({ t: 120, fn: () => {   // the echo: a phantom of the same blow strikes again
    if (def.dead || def.remove) return;
    world.slashes.push({ x: def.x, y: def.y - 14 - def.z, dx: -dx, dy: -dy, t: 0, col: L.bloom, big: true, rot: rand(0, Math.PI) });
    dealDamage(world, att, def, { ...opts, base: opts.base * 0.5, echo: true, launch: 0, pop: 170 });
  } });
  if (typeof SFX !== 'undefined') SFX.smite();
}
// Bosses, mini bosses and Guardians won't sit in a combo forever: each combo against them (hits less than 1.3 s
// apart) they break out at a random hit between the 10th and the 18th — a dash off the ground, angled away from the
// attacker, briefly invincible, and the attacker's combo is broken.
const BOSS_BREAK = { min: 10, max: 18, gap: 1300, invuln: 500 };
function bossComboBreak(world, att, def) {
  const now = performance.now();
  if (now - (def.takenT || 0) < BOSS_BREAK.gap) def.takenStreak = (def.takenStreak || 0) + 1;
  else { def.takenStreak = 1; def.breakAt = randi(BOSS_BREAK.min, BOSS_BREAK.max); }
  def.takenT = now;
  if (def.takenStreak < (def.breakAt || BOSS_BREAK.min)) return;
  def.takenStreak = 0; def.breakAt = randi(BOSS_BREAK.min, BOSS_BREAK.max);   // the next combo gets a fresh limit
  let dx = def.x - att.x, dy = def.y - att.y; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  const side = Math.random() < 0.5 ? 1 : -1; [dx, dy] = [dx * 0.8 - dy * 0.6 * side, dy * 0.8 + dx * 0.6 * side];
  Object.assign(def, { z: 0, vz: 0, vx: 0, vy: 0, juggled: 0, bounced: false, hang: 0, stun: 0, downT: 0, queued: false, state: 'dashing', dashing: { t: DASH.dur * 1.3, dx, dy } });
  def.trail = def.trail || []; def.invuln = Math.max(def.invuln, BOSS_BREAK.invuln);
  if (Math.abs(dx) > Math.abs(dy)) def.dir = dx > 0 ? 1 : 3; else def.dir = dy > 0 ? 2 : 0;
  setAnim(def, 'walk', true);
  att.combo = 0; att.comboT = 0;
  world.rings.push({ x: def.x, y: def.y, r: 30, t: 0, col: '#ff6a4a' }, { x: def.x, y: def.y, r: 16, t: -80, col: '#ffffff' });
  floatText(world, def.x, def.y - 50 * (def.scale || 1), 'COMBO BREAK!', '#ff6a4a', 10);
  world.shake = Math.max(world.shake, 3);
  if (typeof SFX !== 'undefined') SFX.dash();
}
function react(world, att, def, opts) {
  let nx = def.x - att.x, ny = def.y - att.y;
  const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n;
  const P = def.passives || {};
  const gust = (opts.status && opts.el === 'wind' ? 1.5 : 1) * (att.kind === 'player' && att.transcend > 0 && lsk(att, 'ascend') ? 1.7 : 1);   // ascended blows hurl foes (sideways)
  const resist = def.heavy ? 0.55 : 1;
  const armor = def.state !== 'air' && P.unstop && Math.random() * 100 < P.unstop;
  if (def.hp <= 0) {
    def.dying = true;   // no regen/heal can bring it back now; it dies when it lands
    def.state = 'air'; def.z = Math.max(def.z, 0.1); def.vz = Math.max(def.vz, 170); def.juggled = JUGGLE_MAX; def.bounced = true;
    def.vx = nx * 60; def.vy = ny * 60; setAnim(def, 'knock');
    return;
  }
  if (armor) { floatText(world, def.x, def.y - 46, 'ARMOR', '#ffb36b', 8); return; }
  def.queued = false;
  if (def.state === 'air') {
    def.juggled++;
    if (def.juggled > JUGGLE_LIMIT) {   // juggle limit reached: the foe drops and lands flat (no bounce)
      def.vz = Math.min(def.vz, 0) - 80; def.hang = 0; def.bounced = true;
      def.vx = nx * 30; def.vy = ny * 30;
      setAnim(def, 'knock');
      return;
    }
    // pop back up toward a fixed height: stronger moves aim a little higher, but hits never stack height
    const apex = clamp(JUGGLE_APEX * (opts.pop || 140) / 150, 20, 46) * (def.heavy ? 0.75 : 1);
    def.vz = Math.max(vzForApex(def.z, apex), 45 * Math.pow(0.95, def.juggled));
    def.hang = opts.melee ? 140 : 80;
    def.bounced = false;   // a juggled foe that touches down bounces back up once more
    if (opts.melee && att.dir != null) {   // melee air hits steer the foe to just in front of the attacker
      const fx = att.x + DV[att.dir][0] * 20, fy = att.y + DV[att.dir][1] * 8;
      def.vx = (fx - def.x) * 5; def.vy = (fy - def.y) * 5;
    } else { def.vx = nx * 22 * gust; def.vy = ny * 22 * gust; }
    setAnim(def, 'knock'); world.shake = Math.max(world.shake, 2);
  } else if (opts.launch) {
    def.state = 'air'; def.z = 0.1; def.vz = Math.min(opts.launch * resist, vzForApex(0, LAUNCH_APEX * resist)); def.juggled = 0; def.bounced = false;
    def.vx = nx * (opts.push || 40); def.vy = ny * (opts.push || 40);
    setAnim(def, 'knock'); world.shake = Math.max(world.shake, 5);
  } else if (guardPoise(world, def, att)) {   // (poise: a crowd can't stun-lock a hero, guard.js)
    def.vx = nx * 12; def.vy = ny * 12;
  } else {
    def.state = 'hurt'; def.stun = HITSTUN * (def.kind === 'monster' && def.heavy ? 0.6 : 1);
    if (def.windup && def.heavy !== true) { def.windup = null; floatText(world, def.x, def.y - 50, 'INTERRUPTED!', '#ffd27a', 9); }
    def.vx = nx * (opts.push || 30) * gust; def.vy = ny * (opts.push || 30) * gust;
    setAnim(def, 'hurt');
  }
}

function applyStatus(def, el, base) {
  const s = def.status;
  if (el === 'fire') s.burn = { t: 3000, dps: base * 0.12 };
  if (el === 'poison') s.poison = { t: 4000, dps: base * 0.18 };
  if (el === 'ice') s.freeze = 2000;
  if (el === 'lightning') s.shock = 500;
  if (el === 'earth') s.crack = 4000;
}
function heal(world, a, amt, quiet) {
  amt = Math.round(amt);
  if (amt <= 0 || a.dead || a.dying) return;
  a.hp = Math.min(a.maxHp, a.hp + amt);
  if (!quiet || amt >= 3) floatText(world, a.x, a.y - 44 - a.z, '+' + amt, '#6dff8a', 8);
}

// ---------------------------------------------------------------- per-frame actor update
function updateActor(world, a, dt, input) {
  if (world.weeds && a.team !== world.weeds.team && a.kind !== 'npc') {   // In the Weeds: the world crawls for his foes
    if (world.weeds.t > 0 && !world.weeds.owner.dead) dt *= WEEDS.slow; else world.weeds = null;
  }
  a.t += dt;
  a.invuln = Math.max(0, a.invuln - dt);
  if (a.animalBody) { animalBodyTick(world, a); return; }   // a led animal's hidden body (animals.js)
  a.flashT = Math.max(0, (a.flashT || 0) - dt);
  if (a.buffAtk > 0) a.buffAtk -= dt;
  for (const k of ['heatT', 'sharpT', 'smokeT', 'wellFed', 'spellHasteT']) if (a[k] > 0) a[k] -= dt;
  if (a.kind === 'player' && CLASSES[a.cls].chef) inTheWeeds(world, a, dt);
  if (a.layerCd > 0) a.layerCd -= dt;
  if (a.transcend > 0) transcendTick(world, a, dt);
  if (a.cannonCharge) cannonChargeTick(world, a, dt);   // the Spirit Cannon, held
  if (a.legionT != null && (a.legionT -= dt) <= 0 && !a.remove) { a.remove = true; world.rings.push({ x: a.x, y: a.y, r: 16, t: 0, col: '#ffe08a' }); }   // King's Legion: its time is up
  if (a.exhausted > 0) a.exhausted -= dt;
  if (a.trail) { for (const g of a.trail) g.t += dt; a.trail = a.trail.filter(g => g.t < 160); }
  a.comboT -= dt; if (a.comboT <= 0) a.combo = 0;
  if (a.hitStreakT > 0) a.hitStreakT -= dt;
  if (a.spellHitT > 0) a.spellHitT -= dt;
  if (a.dashBuf > 0) a.dashBuf -= dt;
  if (input && input.dash) a.dashBuf = 200;
  if (a.blockFlash > 0) a.blockFlash -= dt;
  const P = a.passives || {};
  // statuses
  const s = a.status;
  for (const k of ['slow', 'freeze', 'shock', 'crack']) if (s[k]) { s[k] -= dt; if (s[k] <= 0) delete s[k]; }
  for (const k of ['burn', 'poison']) if (s[k]) {
    s[k].t -= dt; s[k].acc = (s[k].acc || 0) + s[k].dps * dt / 1000;
    if (s[k].acc >= 1) { const d = Math.floor(s[k].acc); s[k].acc -= d; a.hp = Math.max(a.dojoGuard ? 1 : 0, a.hp - d); floatText(world, a.x, a.y - 30 - a.z, String(d), k === 'burn' ? '#ff9a3c' : '#8cff4e', 8); }
    if (s[k].t <= 0) delete s[k];
  }
  // anything left at 0 HP (burn/poison ticks, regen rounding) falls over and dies instead of standing around
  if (!a.dead && (a.hp <= 0.5 || a.dying) && a.state !== 'air') {   // (poison or hunger can finish anyone off)
    a.hp = 0; a.dying = true; a.state = 'air'; a.z = Math.max(a.z, 0.1); a.vz = 120; a.bounced = true; a.juggled = JUGGLE_MAX; setAnim(a, 'knock');
  }
  if (a.sup && a.sup.length) supportTick(a, dt);
  if (!a.dead && !a.dying) {
    if (P.regen) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * P.regen / 100 * dt / 1000);
    if (a.smokeT > 0 || a.wellFed > 0) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * (a.smokeT > 0 ? 0.05 : 0.0075) * dt / 1000);   // (Well Fed was 1.5%/s)
    if (a.meal && a.meal.regen) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * a.meal.regen * dt / 1000);
    if (a.maxMp && !a.starving) a.mp = Math.min(a.maxMp, a.mp + (MP_REGEN + MANA_FONT_MP * (P.mana || 0) / 100) * (a.transcend > 0 ? layerBoost(a) : 1) * ((a.meal && a.meal.mpr) || 1) * dt / 1000);
    if (a.kind === 'player') guardTick(world, a, dt);   // guard stamina (guard.js)
    if (P.barrier) { a.barrierT -= dt; if (a.barrierT <= 0) { a.barrierT = 8000; a.shield = Math.max(a.shield, Math.round(a.maxHp * P.barrier / 100)); } }
    if (a.cds) { const cr = rankedOn(world) ? RANKED_RULES.cdRate : 1; for (let i = 0; i < 3; i++) a.cds[i] = Math.max(0, a.cds[i] - dt * cr); }   // (ranked: twice as long)
    a.dashCd = Math.max(0, (a.dashCd || 0) - dt);
  }
  // knockback slide
  if (a.vx || a.vy) {
    moveBy(world, a, a.vx * dt / 1000, a.vy * dt / 1000);
    const f = Math.pow(0.0025, dt / 1000); a.vx *= f; a.vy *= f;
    if (Math.abs(a.vx) < 2 && Math.abs(a.vy) < 2) a.vx = a.vy = 0;
  }
  // airborne
  if (a.pet && a.z > 0) a.state = 'air';   // a partner's skill can start mid-air: it still has to come down, or it hangs there
  // the same for a hero: a Layer (or any cast) started while knocked up into the air switched the state away from 'air', so gravity
  // stopped and the hero was left drawn above their shadow for good (the user saw it on a phone, 2026-11-08). They settle down softly.
  if (a.kind === 'player' && a.state !== 'air' && a.z > 0) { a.z = Math.max(0, a.z - dt * 0.25); a.vz = 0; }
  if (a.state === 'air') {
    if (a.kind === 'player' && !a.dead && !a.dying && a.hp > 0 && tryDash(world, a, input)) { dashEscape(world, a); return; }   // air recovery
    const hang = (a.hang || 0) > 0; a.hang = Math.max(0, (a.hang || 0) - dt);
    const heavier = Math.min(1.6, 1 + (a.juggled || 0) * 0.05);   // each juggle hit makes the foe fall a bit faster
    a.vz -= GRAVITY * (hang ? 0.3 : 1) * heavier * dt / 1000; a.z += a.vz * dt / 1000;
    if (animDone(a)) setAnim(a, 'knock');
    if (a.z <= 0) {
      a.z = 0;
      if (!a.bounced && a.hp > 0 && !a.dying) { a.bounced = true; a.vz = 110; a.z = 0.1; world.shake = Math.max(world.shake, 3); }
      else { a.vz = 0; if (a.hp <= 0 || a.dying) { a.hp = 0; kill(world, a); } else { a.state = 'down'; a.downT = 600; setAnim(a, 'down', true); } }
    }
    return;
  }
  // fallen monsters fade out and are removed; a fallen hero stays (lying down) until revived
  if (a.dead) { if (a.kind !== 'player' && animDone(a)) { a.alpha -= dt / 400; if (a.alpha <= 0) a.remove = true; } return; }
  if (s.shock && a.state !== 'down') { a.stun = Math.max(a.stun, 1); }

  if (a.kit && (world.overworld || world.dojoRoom || a.wildKit)) bossKitTick(world, a, dt);
  if (a.boss && a.kind === 'monster') guardCrushTick(world, a, dt);   // its guard-crushing blow (guard.js)   // a boss's own kit (bosses.js) runs beside its AI, whatever it is doing
  switch (a.state) {
    case 'free': {
      if (s.shock) break;
      if (a.kind === 'player') playerFree(world, a, dt, input);
      else if (a.kind === 'monster') (a.mimic ? mimicAI : a.dojoMaster ? dojoAI : monsterAI)(world, a, dt);
      else npcWander(world, a, dt);
      break;
    }
    case 'attack': {
      const len = animLen(a);
      if (a.kind === 'player' && a.anim !== 'skill' && a.t < len * 0.6) moveBy(world, a, DV[a.dir][0] * LUNGE * dt / 1000, DV[a.dir][1] * LUNGE * dt / 1000);
      meleeHits(world, a);
      if (a.kind === 'player') {
        if (tryLayer(world, a, input)) break;
        if (tryDash(world, a, input)) break;   // dash-cancel out of an attack
        if (input.atk && a.t > len * 0.2) a.queued = true;
        if (trySpells(world, a, input, true)) break;
      }
      if (a.t >= len) {
        const foe = a.lastFoe;
        // the chain keeps looping while anything we hit is still airborne: juggles last as long as you keep pressing
        const airborne = (foe && !foe.dead && foe.state === 'air') || enemiesOf(world, a).some(o => o.state === 'air' && !o.dead && dist(o, a) < 60);
        let next = { atk1: 'atk2', atk2: 'atk3', atk3: airborne ? 'atk1' : null }[a.anim];
        if (a.style === 'fist') {   // jab, cross, jab, uppercut (then loops while the foe is airborne)
          a.chain = (a.chain || 0) + 1;
          next = FIST_CHAIN[a.chain] || (airborne ? (a.chain = 0, 'atk1') : null);
        }
        if (a.kind === 'player' && a.queued && next) {
          a.queued = false;
          if (input.mx || input.my) a.dir = input.mx ? (input.mx > 0 ? 1 : 3) : (input.my > 0 ? 2 : 0);
          startSwing(world, a, next);
        } else { a.queued = false; a.state = 'free'; setAnim(a, 'idle', true); }
      }
      break;
    }
    case 'cast':
      if (a.dash) {
        const d = a.dash;
        d.t -= dt;
        moveBy(world, a, DV[a.dir][0] * d.speed * dt / 1000, DV[a.dir][1] * d.speed * dt / 1000);
        for (const o of enemiesOf(world, a)) if (!d.hit.has(o.id) && Math.hypot(o.x - a.x, o.y - a.y) < 34) { d.hit.add(o.id); dealDamage(world, a, o, d.opts); }   // (a body stops you short of 22 px, so a dash reaches past it)
        if (d.t <= 0) { a.dash = null; a.invuln = 0; }
      }
      if (a.kind === 'player' && trySpells(world, a, input, false)) break;
      if (!a.dash && a.t >= (a.castLen || animLen(a))) { a.state = 'free'; setAnim(a, 'idle', true); }
      break;
    case 'block':
      a.blockT += dt;
      if (input.mx || input.my) a.dir = input.mx ? (input.mx > 0 ? 1 : 3) : (input.my > 0 ? 2 : 0);   // turn to face, no walking
      if (tryDash(world, a, input)) break;
      if (input.atk && guardBash(world, a)) break;   // attack while guarding: SHIELD BASH (guard.js)
      if (!(input.block || a.blockHeld)) { a.state = 'free'; setAnim(a, 'idle', true); guardRelease(world, a); }   // (a full bubble may burst: guard.js)
      break;
    case 'dashing': {
      const d = a.dashing;
      if (!d) { a.state = 'free'; setAnim(a, 'idle', true); break; }   // a dash with nothing behind it just ends
      d.t -= dt;
      const step = DASH.speed * dt / 1000;
      moveBy(world, a, d.dx * step, d.dy * step);
      a.trail.push({ x: a.x, y: a.y, t: 0 });
      if (d.t <= 0) { a.state = 'free'; a.dashing = null; setAnim(a, 'idle', true); }
      break;
    }
    case 'hurt':
      if (a.kind === 'player' && tryDash(world, a, input)) { dashEscape(world, a); break; }   // dash out of hitstun
      a.stun -= dt;
      if (a.stun <= 0 && !s.shock) { a.state = 'free'; setAnim(a, 'idle', true); }
      break;
    case 'down':
      if (a.kind === 'player' && tryDash(world, a, input)) { dashEscape(world, a); break; }   // roll out of a knockdown
      a.downT -= dt;
      if (a.downT <= 0) { a.state = 'free'; a.invuln = 700; setAnim(a, 'idle', true); }
      break;
  }
}

function moveBy(world, a, dx, dy) {
  if (a.kind === 'player' && world.objects && a.state !== 'air' && typeof tryPush === 'function') {
    if (dx) dx = tryPush(world, a, dx, 0);
    if (dy) dy = tryPush(world, a, 0, dy);
  }
  // a hero already inside a solid spot (thrown into furniture while airborne) may always step out
  const stuck = a.kind === 'player' && world.blocked(a.x, a.y, a);
  if (stuck || !world.blocked(a.x + dx, a.y, a)) a.x += dx;
  if (stuck || !world.blocked(a.x, a.y + dy, a)) a.y += dy;
  a.x = clamp(a.x, world.bounds.x0 + 8, world.bounds.x1 - 8);
  a.y = clamp(a.y, world.bounds.y0 + 16, world.bounds.y1 - 4);
}

function speedOf(a) {
  const P = a.passives || {};
  let s = a.spd * (1 + (P.swift || 0) / 100);
  if (a.transcend > 0) s *= layerBoost(a);
  if (a.meal && a.meal.speed) s *= a.meal.speed;
  if (a.devSpeed) s *= a.devSpeed;   // OmegaKingX's developer speed
  if (a.driving) s *= VEH.speed;   // at the wheel (vehicles.js)
  if (a.weedsT > 0) s *= WEEDS.haste;
  if (a.spellHasteT > 0) s *= 1.25;   // a Haste skill
  if (a.status.slow) s *= 0.6;
  if (a.status.freeze) s *= 0.4;
  return s;
}

// Dash: a quick burst in the held direction (or facing). 1s cooldown, invincible while dashing.
const DASH = { speed: 420, dur: 170, iframes: 260, cd: 1000, escapeArena: 8000 };
// in the arena (Versus and Ranked), dashing out of being hit (hitstun, a juggle, a knockdown) costs the dash for 8 s
const inArenaWorld = w => !!(window.GAME && GAME.scene === 'arena' && GAME.world === w);
function dashEscape(world, a) { if (inArenaWorld(world)) a.dashCd = a.dashCdMax = DASH.escapeArena; breakFree(world, a); }
// Blocking: hold to guard against hits from the front. Melee is cut to 20%, spells to 50%, no stagger.
const HIT_STOP = 0.4;   // every impact freeze lasts this share of its listed time (main.js stepWorld)
const GUARD = { perfect: 180, melee: 0.2, spell: 0, stagger: 700, reflectStun: 1400 };   // (spells are deflected: no damage through a guard)
// dashing out of hitstun / a juggle / a knockdown: back on your feet with a burst of light
function breakFree(world, a) {
  a.z = 0; a.vz = 0; a.juggled = 0; a.stun = 0; a.downT = 0; a.hitStreak = 0;
  world.rings.push({ x: a.x, y: a.y, r: 20, t: 0, col: '#9fe8ff' });
  floatText(world, a.x, a.y - 44, 'BREAK!', '#9fe8ff', 9);
}
function tryDash(world, a, input) {
  if (!(input.dash || a.dashBuf > 0) || a.dashCd > 0) return false;   // a buffered press counts (hit-stop swallows frames)
  a.dashBuf = 0;
  let dx = input.mx, dy = input.my;
  if (!dx && !dy) [dx, dy] = DV[a.dir];
  const n = Math.hypot(dx, dy); dx /= n; dy /= n;
  if (input.mx || input.my) a.dir = input.mx ? (input.mx > 0 ? 1 : 3) : (input.my > 0 ? 2 : 0);
  a.state = 'dashing'; a.dashing = { t: DASH.dur, dx, dy };
  a.moveT = RUN.after + 1;   // come out of the dash already running
  a.dashCd = a.dashCdMax = DASH.cd;
  a.invuln = Math.max(a.invuln, DASH.iframes);
  a.dodged = false; a.pdodge = false; a.queued = false; a.hitStreak = 0;
  a.trail = [];
  setAnim(a, 'walk', true);
  world.rings.push({ x: a.x, y: a.y, r: 14, t: 120, col: '#9fe8ff' });
  if (typeof SFX !== 'undefined') SFX.dash();
  return true;
}

function playerFree(world, a, dt, input) {
  if (tryLayer(world, a, input)) return;
  if (tryDash(world, a, input)) return;
  if ((input.block || a.blockHeld) && !a.gBroken) { a.state = 'block'; a.blockT = 0; a.vx = a.vy = 0; setAnim(a, 'idle', true); return; }
  if (trySpells(world, a, input, false)) return;
  if (input.atk) { a.state = 'attack'; a.chain = 0; startSwing(world, a, 'atk1'); return; }
  if (input.mx || input.my) {
    a.dir = input.mx ? (input.mx > 0 ? 1 : 3) : (input.my > 0 ? 2 : 0);
    a.moveT = (a.moveT || 0) + dt;
    a.running = a.moveT > RUN.after;
    const n = Math.hypot(input.mx, input.my), sp = speedOf(a) * (a.running ? RUN.mul : 1) * dt / 1000;
    moveBy(world, a, input.mx / n * sp, input.my / n * sp);
    setAnim(a, 'walk', true);
    if (a.running) {
      a.dustT = (a.dustT || 0) - dt;
      if (a.dustT <= 0) {
        a.dustT = 110;
        world.particles.push({ x: a.x + rand(-4, 4), y: a.y - 1, vx: -DV[a.dir][0] * 25 + rand(-8, 8), vy: rand(-12, -4), t: 0, life: 320, col: '#d8c8a8', size: 2.4, puff: true });
      }
    }
  } else { a.moveT = 0; a.running = false; setAnim(a, 'idle', true); }
}
// Keep moving for a moment and you break into a run; a dash goes straight into one.
const RUN = { after: 700, mul: 1.2 };   // a light jog after 0.7 s of walking

// Each swing turns to face a foe standing close by (so swings land instead of cutting air) and whooshes.
const AIM_RANGE = 46;
function startSwing(world, a, name) {
  let best = null, bd = AIM_RANGE;
  for (const o of enemiesOf(world, a)) {
    if (o.state === 'down' || o.invuln > 0) continue;
    const d = Math.hypot(o.x - a.x, (o.y - a.y) * 1.4);
    if (d < bd) { bd = d; best = o; }
  }
  if (best) a.dir = dirTo(best.x - a.x, best.y - a.y);
  setAnim(a, name);
  if (a.style !== 'mage' && a.style !== 'archer' && typeof SFX !== 'undefined') SFX.swing(name === 'atk3');
  kiCannonShot(world, a);   // Ki form (chi.js)
}
function meleeHits(world, a) {
  const len = animLen(a), prog = a.t / len;
  if (prog < 0.25 || prog > 0.72) return;
  let opts, reach;
  if (a.kind === 'player') {
    const M = MELEE[a.anim]; if (!M) return;
    if (a.transcend > 0 && !a.hitIds.has('beams') && typeof fireLayerBeams === 'function') { a.hitIds.add('beams'); fireLayerBeams(world, a); }   // the layer's three beams of light strike with every basic attack (layerswords.js)
    if (a.style === 'mage') { mageShot(world, a, M); return; }
    if (a.style === 'archer') { arrowShot(world, a, M); return; }
    opts = { base: a.atk * M.mul * (a.style === 'summoner' ? 0.7 : 1), melee: true, launch: M.launch, pop: M.pop, push: M.push };
    reach = a.style === 'summoner' ? 24 : 28;
    if (a.style === 'fist') {   // short reach, quick light hits; the uppercut launches higher
      reach = 21; opts.base *= a.anim === 'atk3' ? 1.15 : 0.72; opts.fist = true;
      if (a.anim === 'atk3') { opts.launch = 275; opts.pop = 190; }
    }
    if (a.style === 'summoner' && a.anim === 'atk3' && !a.hitIds.has('rally')) {
      a.hitIds.add('rally');
      rallyFamiliars(world, a);
    }
  } else {
    opts = { base: a.atk, melee: true, pop: 120, push: 50 };
    reach = 18 + (a.h || 26) * 0.35 * a.scale;
  }
  if (a.transcend > 0 && lsk(a, 'ascend')) reach *= 1.35;   // ascended: blows reach further
  const box = meleeBox(a, reach);
  if (world.objects && typeof hitProps === 'function') hitProps(world, box, a);
  for (const o of enemiesOf(world, a)) {
    if (a.hitIds.has(o.id)) continue;
    if (typeof platApart === 'function' && platApart(a, o)) continue;   // (one up on a plateau, the other below its cliff: a blade can't reach; plateaus.js)
    const hb = hurtbox(o);
    const ground = { x: hb.x, y: o.y - 26, w: hb.w, h: 30 };  // juggled foes are hit at their ground position
    if (overlap(box, o.state === 'air' ? ground : hb)) {
      a.hitIds.add(o.id);
      if (dealDamage(world, a, o, opts)) a.lastFoe = o;
    }
  }
}

// ---------------------------------------------------------------- monsters
// Bosses telegraph their spells: a BOSS_WINDUP ms wind-up (world.js draws a closing ring and a "PARRY!" cue at the
// end) so a well-timed block parries the spell back; everyone else casts at once. Knocking a boss out of its
// wind-up (stagger) cancels the spell.
const BOSS_WINDUP = 850;
function monsterCast(world, m, sp) {
  if (!m.boss) { castSpell(world, m, sp, 0); return; }
  m.windup = { t: BOSS_WINDUP, sp };
  floatText(world, m.x, m.y - (m.h || 26) * (m.scale || 1) - 10, '!', '#ffffff', 16);
}
function monsterAI(world, m, dt) {
  if (m.dummy) { m.vx = m.vy = 0; return; }   // the training dummy just stands there (training.js)
  if (m.riding) { m.vx = m.vy = 0; return; }   // riding in the car (vehicles.js)
  if (m.ally && world.home) { setAnim(m, 'idle', true); return; }   // at home, everyone rests (homelife.js)
  const ai = m.ai;
  // familiars never pick fights inside the (peaceful) town
  if (m.tauntT > 0) m.tauntT -= dt;
  const foe = m.tauntT > 0 && m.tauntBy && !m.tauntBy.dead ? m.tauntBy : world.peaceful || (m.ally && world.isTown && world.isTown(m.x)) ? null : (!m.ally && animalPrey(world, m)) || nearestEnemy(world, m, m.ally ? 130 : m.hunter || m.evil ? 600 : 150);   // (mercenaries and the Dark Court's pair hunt you from afar)
  m.chasing = !!foe && !m.ally;   // (wild animals run from a monster on the hunt: animals.js)
  if (m.ally && (!foe || dist(m, m.owner) > 200)) {
    // familiars stay close to their summoner
    const o = m.owner, d = dist(m, o);
    if (d > 260) { m.x = o.x + rand(-20, 20); m.y = o.y + rand(-6, 10); }
    const at = followSpot(o, m), dx = at.x - m.x, dy = at.y - m.y, n = Math.hypot(dx, dy) || 1;   // each trails behind you along the way you walked, in its own place in the line (followSpot)
    if (n > 14) m.pacing = true; else if (n < 5) m.pacing = false;
    if (m.pacing) {
      const sp = Math.min(n, speedOf(m) * 1.3 * dt / 1000);
      m.dir = dirTo(dx, dy); moveBy(world, m, dx / n * sp, dy / n * sp); setAnim(m, 'walk', true);
    } else { setAnim(m, 'idle', true); if (d > 10) m.dir = o.dir; }
    return;
  }
  ai.t -= dt; ai.cast -= dt; if (ai.combo > 0) ai.combo -= dt; if (m.parryEaseT > 0) m.parryEaseT -= dt;
  if (m.windup) {   // a boss winding up a spell: it stands, faces its foe, glows brighter — and casts when the count runs out
    m.windup.t -= dt; m.vx = m.vy = 0; m.state = 'free'; setAnim(m, 'idle', true);
    if (foe) m.dir = dirTo(foe.x - m.x, foe.y - m.y);
    if (m.windup.t <= 0) { const sp = m.windup.sp; m.windup = null; m.parryEaseT = 1500; castSpell(world, m, sp, 0); }   // (its spell can be parried a little more easily: you blocked on the cue, it lands a moment later)
    return;
  }
  if (foe) {
    const d = dist(m, foe), reach = 16 + (m.h || 26) * 0.35 * m.scale;
    if (m.pet && foe !== m.petFoe) { m.petFoe = foe; if (Math.random() < m.pet.opener) ai.cast = 0; }   // the dog: OPENER
    // smart monsters (black holes) combo: when their foe is staggered, airborne or down, a spell follows at once
    if (m.smart && m.spell && (ai.combo || 0) <= 0 && d < 150 && (foe.state === 'hurt' || foe.state === 'air' || foe.state === 'down')) {
      ai.combo = rand(2600, 4200); ai.cast = Math.max(ai.cast, 1200);
      m.dir = dirTo(foe.x - m.x, foe.y - m.y);
      floatText(world, m.x, m.y - (m.h || 26) * (m.scale || 1) - 8, 'COMBO!', '#ff9a5a', 9);
      monsterCast(world, m, m.spell);
      return;
    }
    if (m.spell && ai.cast <= 0 && d < 140 && d > 20) {
      ai.cast = rand(5500, 8500) * (m.pet ? m.pet.focus : 1);   // the dog: FOCUS
      if (m.spells && m.spells.length > 1) m.spell = pick(m.spells);   // (a Hero Partner with several cards)
      m.dir = dirTo(foe.x - m.x, foe.y - m.y);
      monsterCast(world, m, m.spell);
      return;
    }
    if (d < reach + 6 && Math.abs(foe.y - m.y) < 18 + m.h * 0.2) {
      if (ai.t <= 0) { m.dir = dirTo(foe.x - m.x, foe.y - m.y); m.state = 'attack'; setAnim(m, 'attack'); ai.t = rand(700, 1400) / (1 + m.tier * 0.06); }
      else setAnim(m, 'idle', true);
      return;
    }
    // approach, lining up on the axis the monster faces
    let dx = foe.x - m.x, dy = foe.y - m.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dy) < 6) dy = 0;
    const n = Math.hypot(dx, dy) || 1, sp = speedOf(m) * dt / 1000;
    m.dir = dirTo(dx, dy);
    moveBy(world, m, dx / n * sp, dy / n * sp);
    setAnim(m, 'walk', true);
    return;
  }
  // wander
  if (ai.t <= 0) { ai.t = rand(1500, 3500); ai.tx = m.home.x + rand(-60, 60); ai.ty = m.home.y + rand(-40, 40); ai.walk = Math.random() < 0.6; }
  if (ai.walk) {
    const dx = ai.tx - m.x, dy = ai.ty - m.y, d = Math.hypot(dx, dy);
    if (d > 4) { const sp = speedOf(m) * 0.5 * dt / 1000; m.dir = dirTo(dx, dy); moveBy(world, m, dx / d * sp, dy / d * sp); setAnim(m, 'walk', true); return; }
  }
  setAnim(m, 'idle', true);
}

function npcWander(world, n, dt) {
  const ai = n.ai; if (n.say && (n.say.t -= dt) <= 0) n.say = null;
  const bed = ai && folkNight(world, n);   // after dark (folkday.js)
  if (bed === true) return;
  if (bed) {
    const { B, dx, dy, d, x0, y0 } = bed, sp = 28 * dt / 1000; B.t -= dt; n.dir = dirTo(dx, dy); if (d > 3) moveBy(world, n, dx / d * sp, dy / d * sp); setAnim(n, 'walk', true);
    if (d <= 6 || B.t <= 0 || Math.hypot(n.x - x0, n.y - y0) < sp * 0.3 && (ai.stuck = (ai.stuck || 0) + dt) > 500) { n.away = true; n.say = null; }
    return;
  }
  if (!ai || ai.still) { setAnim(n, 'idle', true); return; }
  ai.t -= dt;
  if (ai.t <= 0) { if (ai.roam) folkPlan(world, n); else { ai.t = rand(1500, 4000); ai.tx = n.home.x + rand(-50, 50); ai.ty = n.home.y + rand(-30, 30); ai.walk = Math.random() < 0.55; } }   // (townsfolk out for the day have places to be: folkday.js)
  const dx = ai.tx - n.x, dy = ai.ty - n.y, d = Math.hypot(dx, dy);
  if (ai.walk && d > 3) {
    const sp = 28 * dt / 1000, x0 = n.x, y0 = n.y; n.dir = dirTo(dx, dy); moveBy(world, n, dx / d * sp, dy / d * sp); setAnim(n, 'walk', true);
    if (ai.roam && Math.hypot(n.x - x0, n.y - y0) < sp * 0.3 && (ai.stuck = (ai.stuck || 0) + dt) > 500) { ai.walk = false; ai.t = Math.min(ai.t, rand(800, 2000)); }   // (a wall in the way: give up rather than walk on the spot)
  }
  else { setAnim(n, 'idle', true); if (ai.line) { folkSay(world, n, ai.line); ai.line = null; } }
}

function kill(world, a) {
  a.dead = true; a.state = 'dead';
  if (a.kind === 'monster' && !a.pet && !a.ally && a.plateBox && a.plateA > 0) (world.platePops = world.platePops || []).push({ ...a.plateBox, cx: a.x, a: a.plateA, t0: performance.now() });   // its health capsule pops instead of vanishing (world.js drawPlatePops)
  if (a.animalBody) { a.remove = true; animalLost(world, a.animalBody); return; }
  if (a.netOf) { netPetDown(world, a); return; }   // a co-op friend's companion only rests (netpets.js)
  if (a.heroPartner) { partnerFall(world, a); return; }   // gone for good (heropartner.js)
  if (a.kind === 'monster' && a.pet) {   // the dog falls and stays down until it is revived with food (PET_REVIVE_FOOD)
    setAnim(a, 'die'); a.remove = true;
    const P = window.GAME && petOf(GAME.profile, a.petKind), word = petWord(a.petKind); if (P) P.dead = true;
    floatText(world, a.x, a.y - 30, `Your ${word} fell!`, '#ff9a8a', 8);
    if (window.GAME) { GAME.toast(`Your ${word} has fallen — revive it with ${PET_REVIVE_FOOD} food in the PARTNER menu (N)`, '#ff9a8a'); GAME.save(); }
    return;
  }
  if (a.kind === 'monster' && a.ally) {
    setAnim(a, 'die');
    if (a.legionT != null) return;   // King's Legion: fallen, gone
    world.respawns.push({ owner: a.owner, sp: a.sp, tier: a.tier, t: 8000, slot: a.slot > 0 ? 1 : 0 });
    return;
  }
  if (a.kind === 'monster') {
    setAnim(a, 'die');
    if (a.passives.burst) {
      world.fx.push(fxAt(FX.EXPLODE + 2, a.x, a.y - 10, 1));
      for (const o of enemiesOf(world, a)) if (dist(a, o) < 46) dealDamage(world, a, o, { base: a.maxHp * a.passives.burst / 100 * 0.5, launch: 200, el: 'fire', spell: true });
    }
    world.onKill && world.onKill(a);
  } else {
    setAnim(a, 'down', true);
    if (!a.coop2) world.onPlayerDown && world.onPlayerDown(a);   // (Player 2 falling is not your defeat: coop.js stands them back up)
  }
}

// ---------------------------------------------------------------- spells
function fxAt(animIdx, x, y, scale = 1, opt = {}) {
  const seq = D.fx.skill.anims[animIdx] || D.fx.skill.anims[0];
  return { bank: D.fx.skill, seq, x, y, t: -(opt.delay || 0), scale, filter: opt.filter, dur: seqDur(seq) };
}
// an animation from assets/spell_fx.png (Arcana cards, Layer attacks); lift raises it off the ground point
const SPELL_FX_IMG = D.spellFx = 'assets/spell_fx.png', SPELL_FX_MS = 55;
D.spellcraft = 'assets/spellcraft.png'; D.kiblast = 'assets/kiblast.png';   // the Elemental Spellcraft effects (tools/build_spellcraft.py)
const fxMs = M => M.ms || SPELL_FX_MS;
function vfxAt(key, x, y, scale = 1, opt = {}) {
  const M = (window.SPELL_FX || {})[key]; if (!M) return null;
  // the Spellcraft effects are pinned at their ground point already, so they only take a little of the lift
  return { vfx: key, x, y: y - (opt.lift || 0) * (M.atlas ? 0.3 : 1), t: -(opt.delay || 0), scale, dur: M.n * fxMs(M), flip: opt.flip };
}
const DIRFX = new Set([FX.EXPLODE, FX.VORTEX, FX.FLAME, FX.WIND, FX.BEAM]);
const fxDir = (base, dir) => DIRFX.has(base) ? base + [0, 1, 2, 3][dir] : base;

function trySpells(world, a, input, fromCombo) {
  if (a.transcend > 0) return layerSelect(world, a, input);
  for (let i = 0; i < 3; i++) {
    if (!input.spell[i]) continue;
    const sp = a.spells[i];
    if (!sp) { floatText(world, a.x, a.y - 44, 'No spell in slot ' + (i + 1), '#aaa', 8); continue; }
    if (a.cds[i] > 0) { if (!fromCombo) (a.cdPoke = a.cdPoke || [])[i] = performance.now(); continue; }   // (still cooling down: its card on the action bar gives a little shake, hud.js)
    if (a.mp < sp.mp) { floatText(world, a.x, a.y - 44, 'Not enough MP', '#7fb6ff', 8); a.mpShort = { at: performance.now(), need: sp.mp }; continue; }   // (the HUD's MP bar blinks and marks what the spell needs: hud.js)
    if (fromCombo && !a.hitLanded) continue;  // combo-cancel needs a landed hit
    a.mp -= sp.mp; a.cds[i] = sp.cd * (1 - (a.cdr || 0) / 100);   // (FOCUS: shorter cooldowns, defs.js)
    if (input.mx || input.my) a.dir = input.mx ? (input.mx > 0 ? 1 : 3) : (input.my > 0 ? 2 : 0);
    const link = fromCombo || (a.combo > 0 && a.comboT > 0) ? Math.min(10, a.combo) : 0;
    a.castSlot = i; castSpell(world, a, sp, link); a.castSlot = null;   // (the Spirit Cannon charges while that key is held)
    return true;
  }
  return false;
}

function spellMult(a, sp, link = 0, boost = 1) {
  let mult = boost * (1 + link * 0.2) * (a.kind === 'player' ? 1 + a.atk / 40 : 0.6 + a.atk / 30);
  if (a.style === 'mage') mult *= 1.3;
  if (a.spellAmp) mult *= 1 + a.spellAmp / 100;
  if (a.style === 'summoner' && sp.arch === 'summon') mult *= 1.5;
  return mult;
}
function castSpell(world, a, sp, link, boost = 1) {
  if (a.kind === 'player' && typeof SFX !== 'undefined') SFX.cast(boost > 1);
  const mult = spellMult(a, sp, link, boost);
  if (link > 0) floatText(world, a.x, a.y - 52, `COMBO LINK ×${(1 + link * 0.2).toFixed(1)}`, '#ffd23f', 9);
  const base = sp.power * mult;
  const el = sp.el, status = sp.status;
  const tw = sp.tw;
  const opts = (extra = {}) => Object.assign({ base, el, status, spell: true, pop: 170, push: tw === 'stagger' ? 110 : 40, tw, critBonus: tw === 'keen' ? 40 : 0 }, extra);
  const target = nearestEnemy(world, a, 170);
  const ahead = (d) => ({ x: a.x + DV[a.dir][0] * d, y: a.y + DV[a.dir][1] * d });
  if (target && sp.arch !== 'dash' && sp.arch !== 'beam' && sp.arch !== 'quake') a.dir = dirTo(target.x - a.x, target.y - a.y);
  // beams, quakes and dashes go the way you face (so you can aim them), but after walking away from a foe they fired into empty
  // ground, all effect and no hit (2026-11-20, the user: "some cards just shoot a skill but doesnt hit anything"): when the nearest
  // foe is not in front of you, you turn to it first
  else if (target && a.kind === 'player') {
    const fx = DV[a.dir][0], fy = DV[a.dir][1], dx = target.x - a.x, dy = target.y - a.y, along = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx);
    if (along <= 0 || side > Math.max(26, along * 0.6)) a.dir = dirTo(dx, dy);
  }
  a.state = 'cast'; setAnim(a, a.kind === 'player' ? 'cast' : 'attack'); a.castLen = 260; a.hitLanded = false;
  if (boost === 1) world.spellName = { str: sp.name, col: ELEMENTS[el].col, t: 1200, team: a.team };
  if (a.kind === 'player' && !a.pet) {   // a hero's cast: a small sigil at the feet in their Layer's colours (the spell itself keeps its element)
    const HL = heroLayer(a); world.rings.push({ x: a.x, y: a.y, r: 16, t: 0, col: HL.bloom }, { x: a.x, y: a.y, r: 9, t: -70, col: HL.inner });
    for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; world.particles.push({ x: a.x + Math.cos(an) * 10, y: a.y + Math.sin(an) * 4, vx: 0, vy: rand(-50, -25), t: 0, life: 420, col: i % 2 ? HL.mote : HL.bloom, size: 2 }); }
  }
  const f0 = elementFilter(el), filter = (f0 === 'none' ? '' : f0 + ' ') + `hue-rotate(${sp.hue || 0}deg)`;   // each skill its own shade
  const tp = target ? { x: target.x, y: target.y } : ahead(60);
  // Arcana cards play their own animation (lifted off the ground) instead of the old skill effect
  const FXA = (idx, x, y, sc, o = {}) => { sc *= sp.fxs || 1; if (sp.accent) { const f = vfxAt(sp.accent, x, y, sc * 0.8, { lift: 10, delay: o.delay }); if (f) world.fx.push(f); } return (sp.vfx && vfxAt(sp.vfx, x, y, sc * 0.9, Object.assign({ lift: 14 }, o))) || fxAt(idx, x, y, sc, o); };
  if (sp.sx && sp.sx.startsWith('raid_') && typeof raidSkill === 'function' && raidSkill(world, a, sp, base, opts, tp)) return;   // a raid card's signature skill (raids.js)
  if (sp.sx && chefSkill(world, a, sp, base, opts, tp)) { if (sp.accent) world.fx.push(vfxAt(sp.accent, a.x, a.y, 0.9, { lift: 14 })); return; }   // (a skill with its own code still shows its card's own look)
  if (sp.castFx) { const f = vfxAt(sp.castFx, a.x, a.y + 2, 0.8); if (f) world.fx.push(f); }   // a Spellcraft card's flourish at the caster's feet

  if (sp.form != null) { castForm(world, a, sp, tp, base, opts, filter, FXA, ahead); castTwist(world, a, sp, tp, base, opts, filter, FXA); return; }   // each card's own way of firing (skillforms.js)
  switch (sp.arch) {
    case 'bolt':
      for (let k = 0; k < sp.count; k++) {
        const spread = (k - (sp.count - 1) / 2) * 0.22;
        const ang = Math.atan2(tp.y - a.y, tp.x - a.x) + spread;
        world.projs.push({ owner: a, team: a.team, x: a.x + Math.cos(ang) * 10, y: a.y, z: 14, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230,
          life: 900, r: 13, opts: opts({ base: base / Math.sqrt(sp.count), launch: 0, pop: 150 }), hit: new Set(), sp: sp.sp, el, t: 0, pierce: true, dish: sp.sx === 'order', vfx: sp.vfx, burst: sp.burst || sp.vfx || sp.accent, vfxScale: sp.burst ? 0.75 : undefined });
      }
      break;
    case 'nova':
      world.fx.push(sp.vfx ? (vfxAt(sp.vfx, a.x, a.y, Math.min(110, sp.radius * 1.7) / 64, { lift: 8 }) || fxAt(fxDir(sp.fx, 2), a.x, a.y - 6, 1.1, { filter })) : FXA(fxDir(sp.fx, 2), a.x, a.y - 6, 1.1, { filter }));   // an Arcana nova fills its whole area
      ring(world, a.x, a.y, sp.radius + 10, el);
      strike(world, a, a.x, a.y, sp.radius + 12, 120, opts({ launch: 190 }));
      break;
    case 'pillar':
      world.fx.push(FXA(sp.fx, tp.x, tp.y, 1.1, { filter }));
      strike(world, a, tp.x, tp.y, sp.radius, 260, opts({ launch: 260 }));
      break;
    case 'summon': {
      const sx = tp.x - DV[a.dir][0] * 26, sy = tp.y - DV[a.dir][1] * 26;
      world.summons.push({ sp: sp.sp, x: sx, y: sy, dir: a.dir, t: 0, dur: 1100, pal: Math.min(3, Math.floor(sp.tier / 2.5)), team: a.team });
      world.fx.push(FXA(fxDir(sp.fx, a.dir), tp.x, tp.y, 1, { delay: 330, filter }));
      strike(world, a, tp.x, tp.y, sp.radius + 6, 420, opts({ launch: 270 }));
      break;
    }
    case 'rain':
      for (let k = 0; k < sp.count; k++) {
        const px = tp.x + rand(-34, 34), py = tp.y + rand(-22, 22), dl = 120 + k * 170;
        world.fx.push(FXA(fxDir(sp.fx, 2), px, py, 0.9, { delay: dl, filter }));
        strike(world, a, px, py, 26, dl + 200, opts({ launch: k === 0 ? 220 : 0, pop: 160 }));
      }
      break;
    case 'dash':
      a.dash = { t: 260, speed: 360, hit: new Set(), opts: opts({ launch: 230 }) };
      a.invuln = 300; a.castLen = 320; setAnim(a, a.kind === 'player' ? 'atk3' : 'attack');
      world.fx.push(FXA(fxDir(sp.fx, a.dir), a.x + DV[a.dir][0] * 40, a.y, 1, { filter }));
      break;
    case 'beam': {
      if (sp.vfx) for (let k = 1; k <= 4; k++) { const q = ahead(k * 38); const f = vfxAt(sp.vfx, q.x, q.y, 0.9, { lift: 12, delay: k * 60, flip: a.dir === 3 }); if (f) world.fx.push(f); }   // Arcana: the effect runs down the line
      else world.fx.push(FXA(fxDir(sp.fx, a.dir), a.x, a.y, 1, { filter }));
      const L = 170;
      const rect = a.dir === 1 ? { x: a.x, y: a.y - 34, w: L, h: 40 } : a.dir === 3 ? { x: a.x - L, y: a.y - 34, w: L, h: 40 }
        : a.dir === 0 ? { x: a.x - 18, y: a.y - L, w: 36, h: L } : { x: a.x - 18, y: a.y - 10, w: 36, h: L };
      world.strikes.push({ owner: a, team: a.team, rect, delay: 300, opts: opts({ launch: 200 }), hit: new Set() });
      break;
    }
    case 'quake':
      for (let k = 1; k <= 4; k++) {
        const p = ahead(k * 26);
        world.fx.push(FXA(fxDir(sp.fx, 2), p.x, p.y, 0.8, { delay: k * 90, filter }));
        strike(world, a, p.x, p.y, 20, k * 90 + 180, opts({ launch: 250 }));
      }
      break;
  }
  castTwist(world, a, sp, tp, base, opts, filter, FXA);
}
// the cast-time half of a skill's twist (the on-hit half is in twistOnHit)
function castTwist(world, a, sp, tp, base, opts, filter, FXA) {
  const at = sp.arch === 'nova' || sp.arch === 'dash' ? { x: a.x, y: a.y } : tp;
  switch (sp.tw) {
    case 'echo':
      world.fx.push(FXA(fxDir(sp.fx, 2), at.x, at.y, 0.8, { delay: 520, filter }));
      strike(world, a, at.x, at.y, (sp.radius || 30) + 6, 620, opts({ base: base * 0.4, tw: null, launch: 160 })); break;
    case 'scatter':
      for (let k = 0; k < 3; k++) { const ang = k / 3 * Math.PI * 2 + Math.random(), x = at.x + Math.cos(ang) * 40, y = at.y + Math.sin(ang) * 26;
        world.fx.push(FXA(fxDir(sp.fx, 2), x, y, 0.6, { delay: 360 + k * 80, filter })); strike(world, a, x, y, 22, 440 + k * 80, opts({ base: base * 0.3, tw: null, launch: 0 })); } break;
    case 'blaze':
      for (let k = 0; k < 3; k++) { world.rings.push({ x: at.x, y: at.y, r: 30, t: -(500 + k * 400), col: ELEMENTS[sp.el].col }); strike(world, a, at.x, at.y, 32, 500 + k * 400, opts({ base: base * 0.15, tw: null, launch: 0, pop: 0 })); } break;
    case 'vortex':
      for (const o of enemiesOf(world, a)) { const dx = at.x - o.x, dy = at.y - o.y, d = Math.hypot(dx, dy); if (d < 90 && d > 4 && !o.boss) { o.vx = dx / d * 260; o.vy = dy / d * 260; } }
      world.rings.push({ x: at.x, y: at.y, r: 60, t: 0, col: '#b06bff' }); break;
    case 'ward': a.shield = Math.max(a.shield || 0, Math.round(a.maxHp * 0.1)); world.rings.push({ x: a.x, y: a.y, r: 22, t: 0, col: '#9fd3ff' }); break;
    case 'haste': a.spellHasteT = 3000; break;
    case 'refund': if (a.maxMp) a.mp = Math.min(a.maxMp, a.mp + sp.mp * 0.4); break;
  }
}
// the on-hit half: chain, drain, chill, shatter, stagger
function twistOnHit(world, att, def, dmg, opts) {
  switch (opts.tw) {
    case 'drain': heal(world, att, dmg * 0.2, true); break;
    case 'chill': def.status.slow = Math.max(def.status.slow || 0, 1500); break;
    case 'shatter': def.status.crack = Math.max(def.status.crack || 0, 4000); break;
    case 'stagger': def.stun = Math.max(def.stun || 0, 450); break;
    case 'chain': {
      if (opts.chained) break;
      const near = enemiesOf(world, att).filter(o => o !== def && !o.dead && Math.hypot(o.x - def.x, o.y - def.y) < 90).slice(0, 2);
      near.forEach((o, k) => { world.bolts && world.bolts.push({ x1: def.x, y1: def.y - 14, x2: o.x, y2: o.y - 14, t: 0, dur: 260, seed: Math.random() * 1000, w: 1.8, col: ELEMENTS[opts.el].col });
        world.timers.push({ t: 90 + k * 90, fn: () => { if (!o.dead) dealDamage(world, att, o, Object.assign({}, opts, { base: opts.base * 0.5, chained: true, launch: 0 })); } }); });
      break;
    }
  }
}

function strike(world, owner, x, y, r, delay, opts) {
  world.strikes.push({ owner, team: owner.team, x, y, r, delay, opts, hit: new Set() });
}
function ring(world, x, y, r, el) { world.rings.push({ x, y, r, t: 0, col: ELEMENTS[el].col }); }
function elementFilter(el) {
  return { fire: 'hue-rotate(-30deg) saturate(1.6)', ice: 'hue-rotate(0deg)', lightning: 'hue-rotate(-160deg) saturate(2) brightness(1.3)',
    earth: 'sepia(0.8) saturate(1.4)', wind: 'hue-rotate(-70deg) saturate(1.3)', dark: 'hue-rotate(60deg) saturate(1.4) brightness(0.85)',
    poison: 'hue-rotate(-100deg) saturate(1.8)', holy: 'sepia(0.4) brightness(1.5) saturate(1.3)' }[el] || 'none';
}

// ---------------------------------------------------------------- fusion attack
function castFusion(world, a) {
  const card = a.fusion;
  a.fgauge = 0;
  const target = nearestEnemy(world, a, 220);
  const tp = target ? { x: target.x, y: target.y } : { x: a.x + DV[a.dir][0] * 70, y: a.y + DV[a.dir][1] * 70 };
  if (target) a.dir = dirTo(target.x - a.x, target.y - a.y);
  const total = fusionPower(card) * (a.kind === 'player' ? 1 + a.atk / 40 : 1);
  const C = 350;   // short wind-up (the magic circle belongs to the Layer Skill)
  a.state = 'cast'; setAnim(a, 'cast', true); a.castLen = C + 700; a.invuln = C + 900;
  world.rings.push({ x: a.x, y: a.y, r: 30, t: 0, col: '#ffd23f' });
  world.spellName = { str: 'FUSION BLADE — ' + card.name, col: '#ffd23f', t: C + 1600, team: a.team, big: true };
  world.flash = { t: -C, dur: 1400, col: rankColor(card.tier) };
  fusionBlade(world, a, tp, target, total, C);   // the layer's swords fly out, join into one giant sword and drive it down through the foe (layerswords.js)
}

// ---------------------------------------------------------------- world entity updates (shared by all scenes)
function updateEntities(world, dt) {
  for (const s of world.strikes) {
    s.delay -= dt;
    if (s.delay > 0 || s.done) continue;
    s.done = true;
    if (world.objects && typeof hitProps === 'function')
      hitProps(world, s.rect || { x: s.x - s.r, y: s.y - s.r * 0.75, w: s.r * 2, h: s.r * 1.5 }, s.owner);
    for (const o of world.actors) {
      if ((o.team === s.team && !duelFoes(s.owner, o)) || o.dead || !(o.kind === 'player' || o.kind === 'monster') || s.hit.has(o.id)) continue;
      const inside = s.rect ? overlap(s.rect, { x: o.x - 6, y: o.y - 20, w: 12, h: 22 }) : Math.hypot(o.x - s.x, (o.y - s.y) * 1.3) < s.r + 6;
      if (inside) { s.hit.add(o.id); dealDamage(world, s.owner, o, s.opts); }
    }
  }
  world.strikes = world.strikes.filter(s => !s.done);
  for (const p of world.projs) {
    p.t += dt; p.life -= dt;
    if (p.homing) { const q = enemiesOf(world, p.owner).filter(o => !o.dead).sort((m, n) => Math.hypot(m.x - p.x, m.y - p.y) - Math.hypot(n.x - p.x, n.y - p.y))[0]; if (q) { const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, sp0 = Math.hypot(p.vx, p.vy), mix = Math.min(1, 5 * dt / 1000); p.vx += (dx / d * sp0 - p.vx) * mix; p.vy += (dy / d * sp0 - p.vy) * mix; } }
    if (p.back && p.life < p.back) { const o = p.owner, dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1, sp0 = Math.hypot(p.vx, p.vy); if (!p.turned) { p.turned = true; p.hit.clear(); } p.vx = dx / d * sp0; p.vy = dy / d * sp0; if (d < 14) p.life = 0; }
    if (p.boom && p.life <= 0) { strike(world, p.owner, p.x, p.y, p.boom, 0, Object.assign({}, p.opts, { launch: 200 })); ring(world, p.x, p.y, p.boom, p.el); world.fx.push(fxAt(FX.EXPLODE + 2, p.x, p.y, 1, { filter: elementFilter(p.el) })); if (p.burst) { const f = vfxAt(p.burst, p.x, p.y, 0.9, { lift: 8 }); if (f) world.fx.push(f); } p.boom = 0; }
    p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000;
    if (world.tileSolid && world.tileSolid(p.x, p.y)) p.life = 0;
    if (world.objects && typeof hitProps === 'function') hitProps(world, { x: p.x - 5, y: p.y - 5, w: 10, h: 10 }, p.owner);
    for (const o of world.actors) {
      if ((o.team === p.team && !duelFoes(p.owner, o)) || o.dead || !(o.kind === 'player' || o.kind === 'monster') || p.hit.has(o.id)) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) < p.r + 6) {
        p.hit.add(o.id); dealDamage(world, p.owner, o, p.opts);
        const burst = p.burst && vfxAt(p.burst, p.x, p.y, 0.7, { lift: 10 });   // Inferno fireballs burst into their own flame
        if (!p.arrow) world.fx.push(burst || fxAt(FX.EXPLODE + 2, p.x, p.y, 0.6, { filter: elementFilter(p.el) }));
        if (!p.pierce) { p.life = 0; if (p.boom) { strike(world, p.owner, p.x, p.y, p.boom, 0, Object.assign({}, p.opts, { launch: 200 })); ring(world, p.x, p.y, p.boom, p.el); p.boom = 0; } }
      }
    }
    if (!p.arrow && Math.random() < 0.5) world.particles.push({ x: p.x, y: p.y - p.z, vx: rand(-15, 15), vy: rand(-15, 15), t: 0, life: 300, col: ELEMENTS[p.el].col });
  }
  world.projs = world.projs.filter(p => p.life > 0);
  for (const r of world.respawns) {
    r.t -= dt;
    if (r.t <= 0 && r.owner && !r.owner.dead && world.actors.includes(r.owner)) { if (r.pet) spawnDog(world, r.owner); else spawnFamiliar(world, r.owner, r.sp, r.tier, r.slot ?? 0); }
  }
  world.respawns = world.respawns.filter(r => r.t > 0);
  for (const f of world.fx) f.t += dt;
  // a held charge's effect lives only as long as the charge, and follows the hero even if the actor was rebuilt mid-charge
  const held = world.player && world.player.cannonCharge;
  for (const f of world.fx) if (f.held) { if (held && held.fx === f) f.owner = world.player; else f.dur = 0; }
  world.fx = world.fx.filter(f => f.t < f.dur);
  for (const s of world.summons) s.t += dt;
  world.summons = world.summons.filter(s => s.t < s.dur);
  for (const r of world.rings) r.t += dt;
  world.rings = world.rings.filter(r => r.t < 450);
  for (const s of world.sparks) s.t += dt;
  world.sparks = world.sparks.filter(s => s.t < 260);
  for (const tm of world.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
  world.timers = world.timers.filter(tm => !tm.done);
  for (const b of world.bolts) b.t += dt;
  world.bolts = world.bolts.filter(b => b.t < b.dur);
  for (const s of world.slashes) s.t += dt;
  world.slashes = world.slashes.filter(s => s.t < IMPACT_MS);
  for (const c of world.circles) { c.t += dt; if (c.owner && !c.owner.dead) { c.x = c.owner.x; c.y = c.owner.y; } }
  world.circles = world.circles.filter(c => c.t < c.dur);
  for (const f of world.floats) f.t += dt;
  world.floats = world.floats.filter(f => f.t < 800);
  for (const p of world.particles) { p.t += dt; p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; if (p.drag) { const f = Math.pow(p.drag, dt / 16); p.vx *= f; p.vy *= f; } }
  world.particles = world.particles.filter(p => p.t < p.life);
  if (world.spellName) { world.spellName.t -= dt; if (world.spellName.t <= 0) world.spellName = null; }
  if (world.flash) { world.flash.t += dt; if (world.flash.t > world.flash.dur) world.flash = null; }
  world.shake = Math.max(0, world.shake - dt * 0.02);
}

function newWorld(bounds) {
  return { actors: [], projs: [], strikes: [], fx: [], summons: [], rings: [], sparks: [], floats: [], particles: [], drops: [], respawns: [], slashes: [], circles: [], timers: [], bolts: [],
    hitStop: 0, shake: 0, flash: null, spellName: null, slowmo: 0, bounds, blocked: () => false };
}

// ---------------------------------------------------------------- Mage & Summoner
// Mage: each combo swing fires an arcane bolt; the third swing bursts in a nova that launches.
function mageShot(world, a, M) {
  if (a.hitIds.has('shot')) return;
  a.hitIds.add('shot');
  if (typeof SFX !== 'undefined') SFX.cast(a.anim === 'atk3');
  const base = a.atk * M.mul * 1.05;
  const tgt = nearestEnemy(world, a, 170);
  if (a.anim === 'atk3') {
    const p = tgt && dist(a, tgt) < 90 ? { x: tgt.x, y: tgt.y } : { x: a.x + DV[a.dir][0] * 44, y: a.y + DV[a.dir][1] * 44 };
    world.fx.push(fxAt(FX.VORTEX + 2, p.x, p.y - 4, 0.8, { filter: elementFilter('lightning') }));
    ring(world, p.x, p.y, 34, 'lightning');
    strike(world, a, p.x, p.y, 30, 90, { base: base * 1.2, launch: 235, pop: 165, push: 30, el: 'lightning' });
    return;
  }
  let ang = Math.atan2(DV[a.dir][1], DV[a.dir][0]);
  if (tgt && dist(a, tgt) < 170) {
    const ta = Math.atan2(tgt.y - a.y, tgt.x - a.x);
    if (Math.abs(((ta - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.9) ang = ta;   // soft aim toward foes in front
  }
  world.projs.push({ owner: a, team: a.team, x: a.x + Math.cos(ang) * 10, y: a.y, z: 14, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
    life: 650, r: 10, opts: { base, pop: M.pop, push: 25, el: 'lightning' }, hit: new Set(), sp: null, el: 'lightning', t: 0, pierce: false, orb: true });
}

// Archer: each combo swing looses an arrow (soft-aimed at foes in front); the third swing a piercing three-arrow volley.
function arrowShot(world, a, M) {
  if (a.hitIds.has('shot')) return;
  a.hitIds.add('shot');
  const volley = a.anim === 'atk3';
  if (typeof SFX !== 'undefined') SFX.bow(volley);
  const tgt = nearestEnemy(world, a, 200);
  let ang = Math.atan2(DV[a.dir][1], DV[a.dir][0]);
  if (tgt && dist(a, tgt) < 200) {
    const ta = Math.atan2(tgt.y - a.y, tgt.x - a.x);
    if (Math.abs(((ta - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.9) ang = ta;
  }
  for (const off of volley ? [-0.16, 0, 0.16] : [0]) {
    const g = ang + off;
    world.projs.push({ owner: a, team: a.team, x: a.x + Math.cos(g) * 10, y: a.y, z: 14, vx: Math.cos(g) * 340, vy: Math.sin(g) * 340,
      life: 620, r: 8, opts: { base: a.atk * M.mul * (volley ? 0.75 : 1.05), pop: M.pop, push: volley ? 30 : 18, launch: volley ? M.launch : 0 },
      hit: new Set(), sp: null, el: null, t: 0, pierce: volley, arrow: true });
  }
}

// Summoner: two familiars chosen from the deck (first two monster cards), F-rank sprites if the deck is empty.
function familiarPicks(profile) {
  const cards = profile.deck.map(u => profile.cards.find(c => c.uid === u)).filter(c => c && !c.fusion && D.monsters[c.sp]);   // only monsters fight as familiars
  const picks = cards.slice(0, 2).map(c => ({ sp: c.sp, tier: c.tier }));
  const defaults = [{ sp: '029', tier: 0 }, { sp: '006', tier: 0 }];
  while (picks.length < 2) picks.push(defaults[picks.length]);
  return picks;
}
function spawnFamiliar(world, owner, sp, tier, slot) {
  const m = makeMonster(sp, tier, owner.x + (slot ? 22 : -22), owner.y + 8);
  Object.assign(m, { ally: true, owner, team: owner.team, slot: slot ? 1 : -1, scale: 0.85 });
  m.maxHp = Math.round(m.maxHp * 0.6); m.hp = m.maxHp; m.atk *= 0.65;
  m.spell = null;
  m.home = { x: m.x, y: m.y };
  world.actors.push(m);
  return m;
}
function spawnFamiliars(world, owner) {
  if (!owner.familiarSpecies) return;
  owner.familiarSpecies.forEach((f, i) => spawnFamiliar(world, owner, f.sp, f.tier, i));
}
function rallyFamiliars(world, a) {
  const tgt = nearestEnemy(world, a, 160);
  for (const m of world.actors) {
    if (!m.ally || m.owner !== a || m.dead) continue;
    m.ai.t = 0;
    if (tgt) {
      // leap beside the target and strike at once
      m.x = tgt.x - DV[dirTo(tgt.x - a.x, tgt.y - a.y)][0] * 20 + rand(-6, 6); m.y = tgt.y + rand(-4, 4);
      m.dir = dirTo(tgt.x - m.x, tgt.y - m.y); m.state = 'attack'; setAnim(m, 'attack');
      world.rings.push({ x: m.x, y: m.y, r: 14, t: 0, col: '#8fffd0' });
    }
  }
}

// ---------------------------------------------------------------- LAYER SKILL
// The six-step layered magic circle builds around the hero (invulnerable), then explodes in a huge
// lightning burst, and the hero becomes TRANSCENDED for 20 s: white hair, outfit and weapon, lightning
// crackling around them, +40% to every stat (attack, defence, speed, regen), and arcs that strike nearby foes.
// LAYER is one button (it replaced the separate fusion key): press it to transcend; while transcended, pick HUD
// cards (Q/E/R, C or click; the fusion card included) and press LAYER again to fire them as one LAYERED skill.
// Afterwards the hero is EXHAUSTED for 15 s: they take +100% damage.
const LAYER = { cd: 30000, dur: 20000, radius: 80, circle: 33, boost: 1.4, exhaust: 1.0, exhaustDur: 15000, trinityCd: 1800, trinityBoost: 1.8 };
// Elemental layers: the transcendence takes the element your spell cards lean toward. Every element uses the same
// lightning look (dark halo → body colour → additive bloom → pale inner → white-hot core, rising motes, crisp pixel
// sparks), only recoloured; its burst, chain strikes and arcs deal that element's damage, and the ascended outfit
// is tinted to match.
const LAYER_ELS = {
  holy:      { name: 'Divine',  dmg: 'holy',      icon: '✦', fx: 'holy',      halo: '#4a3000', body: '#ffbf2a', bloom: '#ffe98a', inner: '#fffbe6', mote: '#fff0a8', edge: '#ffd84a', glow: '255,226,130', cloth: 'ascendHoly' },
  lightning: { name: 'Storm',   dmg: 'lightning', icon: '⚡', fx: 'lightning', halo: '#0e1e66', body: '#2f7dff', bloom: '#6ab8ff', inner: '#d8f2ff', mote: '#9fd8ff', edge: '#3a8cff', glow: '110,190,255', cloth: 'ascendCloth' },
  fire:      { name: 'Inferno', dmg: 'fire',      icon: '♨', fx: 'fire',      halo: '#4a0e00', body: '#ff5414', bloom: '#ff9a3a', inner: '#ffe2a8', mote: '#ffb36b', edge: '#ff6a1a', glow: '255,140,60',  cloth: 'ascendFire' },
  water:     { name: 'Tidal',   dmg: 'ice',       icon: '≈', fx: 'ice',       halo: '#03304a', body: '#10a8cc', bloom: '#5ae8ff', inner: '#cdf8ff', mote: '#8af0ff', edge: '#1ac0e0', glow: '90,220,255',  cloth: 'ascendWater' },
  earth:     { name: 'Terra',   dmg: 'earth',     icon: '◆', fx: 'earth',     halo: '#2a1404', body: '#a8641c', bloom: '#e0a050', inner: '#f4dcae', mote: '#e8b878', edge: '#b8742a', glow: '230,170,90',  cloth: 'ascendEarth' },
  wind:      { name: 'Gale',    dmg: 'wind',      icon: '≋', fx: 'wind',      halo: '#063a2a', body: '#2fc89a', bloom: '#7affd0', inner: '#e0fff4', mote: '#a8ffe0', edge: '#40e0b0', glow: '120,255,200', cloth: 'ascendWind' },
  dark:      { name: 'Abyss',   dmg: 'dark',      icon: '☾', fx: 'dark',      halo: '#1a0630', body: '#7a3ad8', bloom: '#b07aff', inner: '#ead8ff', mote: '#c8a0ff', edge: '#8a4ae8', glow: '176,120,255', cloth: 'ascendDark' },
  grass:     { name: 'Verdant', dmg: 'poison',    icon: '❀', fx: 'poison',    halo: '#0a3010', body: '#2fb84a', bloom: '#7aff8a', inner: '#d8ffd0', mote: '#9aff8a', edge: '#30c050', glow: '120,240,130', cloth: 'ascendGrass' },
};
// the element chosen on the inventory's LAYER page (Holy by default; saves that still say 'auto' get Holy)
function layerElementOf(a) {
  return a.layerChoice && LAYER_ELS[a.layerChoice] ? a.layerChoice : 'holy';
}
const layerPal = a => heroLayer(a);   // (was Storm blue when not transcended: now always the hero's own Layer)
// the hero's own Layer colours: the one transcended in, else the one equipped (the shield, dash, hit sparks and level-up wear them)
const heroLayer = a => LAYER_ELS[(a && a.layerEl) || (a && layerElementOf(a))] || LAYER_ELS.holy;
function tryLayer(world, a, input) {
  const want = input.layer || input.fusion || a.layerReq;
  a.layerReq = false;
  if (!want || a.kind !== 'player') return false;
  if (a.transcend > 0) {
    return castLayered(world, a);
  }
  if (window.GAME && GAME.scene === 'world' && a === (GAME.world && GAME.world.player) && kiPicked(GAME.profile)) return kiRelease(GAME, world, a);   // Ki picked in place of Layer (chi.js)
  if ((a.layerCd || 0) > 0) { floatText(world, a.x, a.y - 44, `Layer Skill ${Math.ceil(a.layerCd / 1000)}s`, '#c8a8ff', 8); return false; }
  castLayer(world, a);
  return true;
}
function castLayer(world, a) {
  const C = CIRCLE_STEP_MS * 6;
  a.layerEl = layerElementOf(a);
  a.layerCd = a.layerCdMax = layerCdOf(a) * (rankedOn(world) ? RANKED_RULES.layerCd : 1);
  if (a.kind === 'player' && window.GAME && GAME.world === world && a === world.player) bumpStat('layers');
  if (a.kind === 'player' && window.GAME && GAME.world === world && typeof petOf === 'function') {   // the hound's TRANSFORMATION unlocks after 100 of these at its side
    for (const k of petsOf(GAME.profile)) { const P = petOf(GAME.profile, k), d = petActor(world, k);
    if (P && d && dist(d, a) < 160) { P.layerUses = (P.layerUses || 0) + 1; if (P.layerUses === PET_FORM.uses) GAME.toast('Your hound has seen your Layer 100 times — TRANSFORMATION can be learned (N)!', PET_FORM.mote); } }
  }
  const L = layerPal(a);
  a.state = 'cast'; setAnim(a, 'cast', true); a.castLen = C + 250; a.invuln = C + 700;
  a.vx = a.vy = 0;
  // the Storm (lightning) layer keeps the rainbow circle; the other elements light it in their own colours
  const tint = a.layerEl !== 'lightning' ? [L.body, L.bloom, L.inner, L.mote, L.edge, L.bloom, L.inner, L.body] : null;
  world.circles.push({ x: a.x, y: a.y, t: 0, dur: C + 450, r: LAYER.circle, owner: a, layer: true, tint });
  world.spellName = { str: `LAYER SKILL — ${L.name.toUpperCase()} TRANSCENDENCE`, col: L.inner, t: C + 1500, team: a.team, big: true };
  world.timers.push({ t: C, fn: () => layerBurst(world, a) });
  if (typeof layerPowerUp === 'function') layerPowerUp(world, a, C);   // the power-up you can feel: gathering, then the release (layerswords.js)
}
function layerBurst(world, a) {
  if (a.dead) return;
  if (a === world.player && world.overworld && window.GAME && GAME.profile && !GAME.profile.layerSeen && typeof layerScene === 'function') layerScene(GAME);   // the first time ever: the masters feel it (layerscene.js)
  let base = (a.atk * 7 + 50) * (1 + (a.lv || 1) * 0.02); const L = layerPal(a);
  a.transcend = a.transcendMax = layerDur(a); a.arcT = 0; a.layerSel = [false, false, false, false]; a.fusionUsed = false; a.lswords = null; a.fsword = null; a.ghalo = null;   // (the swords come out fresh, layerswords.js)
  const bl = lsk(a, 'burst');
  if (!bl) { world.rings.push({ x: a.x, y: a.y, r: 30, t: 0, col: L.mote }); return; }   // no AWAKENING BURST yet: just the glow
  base *= 1 + (bl - 1) * 0.25;
  world.flash = { t: 0, dur: 420, col: L.inner };
  world.shake = Math.max(world.shake, 6);
  world.hitStop = Math.max(world.hitStop, 120);
  for (let k = 0; k < 2; k++) world.rings.push({ x: a.x, y: a.y, r: LAYER.radius * (0.7 + k * 0.4), t: -k * 90, col: k ? L.mote : '#ffffff' });
  world.fx.push(fxAt(FX.HOLY, a.x, a.y, 1.5, a.layerEl && a.layerEl !== 'lightning' ? { filter: elementFilter(L.fx) } : undefined));
  strike(world, a, a.x, a.y, LAYER.radius, 30, { base, el: L.dmg, status: true, spell: true, launch: 320, pop: 260, push: 80 });
  // chain strikes (in the layer's colour) to everything in range
  enemiesOf(world, a).filter(o => dist(o, a) < LAYER.radius * 1.6).slice(0, 10).forEach((o, k) => {
    if (a.layerEl === 'holy') {   // Divine: a pillar of light on every foe instead of a chain
      for (const [key, s, dl] of [['ex_level_up_pillar', 0.9, k * 60], ['ex_holy_impact_large', 0.8, k * 60 + 160]]) { const f = vfxAt(key, o.x, o.y, s, { delay: dl }); if (f) world.fx.push(f); }
    } else world.bolts.push({ px: true, el: a.layerEl, x1: a.x, y1: a.y - 22, x2: o.x, y2: o.y - 12, t: 0, dur: 220, seed: Math.random() * 1000, segs: 7, jag: 5 });
    strike(world, a, o.x, o.y, 22, 60, { base: base * 0.45, el: L.dmg, status: true, spell: true, pop: 200 });
  });
  for (let i = 0; i < 18; i++) {
    const ang = Math.random() * Math.PI * 2, sp = rand(120, 320);
    world.particles.push({ x: a.x, y: a.y - 14, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.7, t: 0, life: rand(250, 520), col: i % 2 ? '#ffffff' : L.mote, size: rand(1.2, 2.4), streak: true, drag: 0.93 });
  }
}
// While transcended the HUD cards become selectable: Q/E/R (and C / clicking the cards; slot 4 is the fusion card)
// toggle them, and pressing LAYER again layers every picked card into one bigger, flashier skill.
function layerSelect(world, a, input) {
  a.layerSel = a.layerSel || [false, false, false, false];
  const req = a.selReq || []; a.selReq = null;
  let changed = false;
  for (let i = 0; i < 4; i++) {
    if (!(i < 3 ? input.spell[i] : input.fsel) && !req[i]) continue;
    if (i < 3) {
      const sp = a.spells[i];
      if (!sp) { floatText(world, a.x, a.y - 44, 'No spell in slot ' + (i + 1), '#aaa', 8); continue; }
      if (a.cds[i] > 0) { floatText(world, a.x, a.y - 44, `${sp.name} ${(a.cds[i] / 1000).toFixed(1)}s`, '#aaa', 8); continue; }
    } else if (!a.fusion || a.fusionUsed) { floatText(world, a.x, a.y - 44, a.fusion ? 'Fusion card spent this Layer' : 'No fusion card', '#aaa', 8); continue; }
    else { if (typeof raiseGuardianHalo === 'function') raiseGuardianHalo(world, a); continue; }   // C: the Guardian Halo, fuelled by the fusion card (layerswords.js)
    a.layerSel[i] = !a.layerSel[i]; changed = true;
  }
  if (changed) world.rings.push({ x: a.x, y: a.y, r: 16, t: 0, col: '#ffffff' });   // the HUD shows what is picked
  return false;   // picking never interrupts what the hero is doing
}
function layeredPicks(a) {
  const sel = a.layerSel || [];
  const out = [];
  for (let i = 0; i < 3; i++) if (sel[i] && a.spells[i] && !(a.cds[i] > 0)) out.push({ i, sp: a.spells[i], el: a.spells[i].el, name: a.spells[i].name, power: a.spells[i].power * LAYER.trinityBoost });
  if (sel[3] && a.fusion && !a.fusionUsed) {
    const fs = fusionSpells(a.fusion);
    out.push({ i: 3, fusion: true, el: fs[0].el, name: a.fusion.name, power: fusionPower(a.fusion) * 1.2 });
  }
  return out;
}
// LAYERED SKILL: the six-ring layer circle opens under the target, every picked card fires into it at once,
// element bolts braid together over it, and it detonates for the combined power (+30% per extra layer).
function castLayered(world, a) {
  if ((a.layeredT || 0) > 0) return false;
  const picks = layeredPicks(a);
  if (!picks.length) { floatText(world, a.x, a.y - 44, 'Pick cards first: Q / E / R / C (or click them)', '#e8f4ff', 8); return false; }
  const n = picks.length;
  a.layeredT = 900; a.layerSel = [false, false, false, false];
  if (a.kind === 'player' && window.GAME && GAME.world && a === GAME.world.player) questEvent(GAME, 'layer');
  const target = nearestEnemy(world, a, 230);
  const tp = target ? { x: target.x, y: target.y } : { x: a.x + DV[a.dir][0] * 80, y: a.y + DV[a.dir][1] * 80 };
  if (target) a.dir = dirTo(target.x - a.x, target.y - a.y);
  const total = picks.reduce((s, p) => s + p.power, 0) * (1 + a.atk / 40) * (1 + 0.3 * (n - 1));
  const C = 700 + n * 120, R = 28 + n * 8;
  a.state = 'cast'; setAnim(a, 'cast', true); a.castLen = 450; a.invuln = Math.max(a.invuln || 0, C + 300);
  world.circles.push({ x: tp.x, y: tp.y, t: 0, dur: C + 500, r: R, layer: true });
  const title = { str: `LAYERED ×${n} — ` + picks.map(p => p.name).join(' + '), col: '#ffffff', t: C + 1800, team: a.team, big: true };
  world.spellName = title;
  // each card rises as an element sigil around the circle, then fires
  picks.forEach((p, k) => {
    const ang = -Math.PI / 2 + (k - (n - 1) / 2) * 0.9, col = ELEMENTS[p.el].col;
    const ox = tp.x + Math.cos(ang) * (R + 18), oy = tp.y - 40 + Math.sin(ang) * 18;
    world.rings.push({ x: ox, y: oy + 30, r: 16, t: -k * 120, col });
    world.timers.push({ t: 200 + k * 150, fn: () => {
      if (a.dead) return;
      world.bolts.push({ x1: a.x, y1: a.y - 22, x2: ox, y2: oy, t: 0, dur: 300, seed: Math.random() * 1000, w: 1.8, col });
      world.bolts.push({ x1: ox, y1: oy, x2: tp.x, y2: tp.y - 10, t: -120, dur: C - 100 - k * 150, seed: Math.random() * 1000, w: 2.2, col });
      if (p.fusion) { a.fusionUsed = true; castFusion(world, a); a.state = 'cast'; world.spellName = title; }
      else { a.cds[p.i] = p.sp.cd; castSpell(world, a, p.sp, 0, LAYER.trinityBoost); }
    } });
  });
  // the braid: particles spiral into the centre while the circle builds
  for (let i = 0; i < 10 + n * 4; i++) {
    const ang = Math.random() * Math.PI * 2, d = R + rand(10, 40), col = ELEMENTS[picks[i % n].el].col;
    world.particles.push({ x: tp.x + Math.cos(ang) * d, y: tp.y - 10 + Math.sin(ang) * d * 0.45, vx: -Math.cos(ang) * d * 1.6, vy: -Math.sin(ang) * d * 0.7, t: -rand(0, C * 0.6), life: 520, col, size: rand(1.2, 2.4), streak: true, drag: 0.97 });
  }
  world.timers.push({ t: C, fn: () => {
    if (a.dead) return;
    world.flash = { t: 0, dur: 380, col: '#ffffff' };
    world.shake = Math.max(world.shake, 6 + n); world.hitStop = Math.max(world.hitStop, 110);
    picks.forEach((p, k) => {
      const col = ELEMENTS[p.el].col;
      world.rings.push({ x: tp.x, y: tp.y, r: R * 1.2 + k * 10, t: -k * 60, col });
      world.fx.push(fxAt(fxDir(FX.EXPLODE, 2), tp.x + rand(-14, 14), tp.y + rand(-8, 8), 1.4 + n * 0.15, { delay: k * 80, filter: elementFilter(p.el) }));
    });
    world.fx.push(fxAt(FX.HOLY, tp.x, tp.y, 1.8 + n * 0.2));
    world.fx.push(fxAt(FX.LIGHTNING, tp.x, tp.y - 6, 1.6 + n * 0.15, { filter: elementFilter('lightning') }));
    for (let i = 0; i < 4; i++) {   // lightning crown striking the ring
      const ang = i / 4 * Math.PI * 2 + Math.PI / 4;
      world.bolts.push({ x1: tp.x, y1: tp.y - 90, x2: tp.x + Math.cos(ang) * R, y2: tp.y + Math.sin(ang) * R * 0.45, t: -i * 25, dur: 320, seed: Math.random() * 1000, w: 2, col: ELEMENTS[picks[i % n].el].col });
    }
    for (let i = 0; i < 18 + n * 6; i++) {
      const ang = Math.random() * Math.PI * 2, spd = rand(140, 380);
      world.particles.push({ x: tp.x, y: tp.y - 12, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd * 0.6, t: 0, life: rand(300, 650), col: i % 3 ? ELEMENTS[picks[i % n].el].col : '#ffffff', size: rand(1.3, 2.8), streak: true, drag: 0.93 });
    }
    strike(world, a, tp.x, tp.y, R + 24, 20, { base: total, el: picks[0].el, status: true, spell: true, launch: 340, pop: 280, push: 90 });
    floatText(world, tp.x, tp.y - 70, `LAYERED ×${n}!`, '#ffffff', 14);
  } });
  return true;
}
// While transcended, each element fights in its own way (about once a second, at the nearest foe in range):
//   Storm    lightning lashes the foe (with a flash where it lands)
//   Inferno  shoots a fireball that bursts into flame on impact
//   Terra    a stone spike erupts from the ground under the foe and launches it
//   Verdant  vines burst from the ground around the foe, poisoning and slowing it
//   Tidal    a wave crashes over the foe and chills it
//   Divine   Light Storm: shafts of light fall on the foe and around it
function layerAttack(world, a) {
  const el = a.layerEl || 'lightning', o = nearestEnemy(world, a, el === 'fire' ? 170 : 130); if (!o) return;
  const base = a.atk * 0.8, dmg = layerPal(a).dmg, fx = (k, x, y, s, opt) => { const f = vfxAt(k, x, y, s, opt); if (f) world.fx.push(f); };
  if (el === 'fire') {
    const ang = Math.atan2(o.y - a.y, o.x - a.x);
    world.projs.push({ owner: a, team: a.team, x: a.x + Math.cos(ang) * 10, y: a.y, z: 14, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, life: 800, r: 12,
      opts: { base, el: dmg, spell: true, pop: 150, push: 30, status: true }, hit: new Set(), el: dmg, t: 0, vfx: 'layer_fire_shot', vfxScale: 0.6, burst: 'layer_fire_boom' });
  } else if (el === 'earth') {
    fx('layer_earth', o.x, o.y, 0.85, { lift: 20 });
    strike(world, a, o.x, o.y, 22, 180, { base: base * 1.1, el: dmg, spell: true, launch: 240, pop: 180, status: true });
  } else if (el === 'grass') {
    fx('layer_grass', o.x, o.y, 0.9, { lift: 16 });
    strike(world, a, o.x, o.y, 30, 220, { base, el: dmg, spell: true, pop: 120, status: true });
    o.status.slow = Math.max(o.status.slow || 0, 1600);
  } else if (el === 'water') {
    fx('layer_water', o.x, o.y, 0.85, { lift: 16, flip: o.x < a.x });
    strike(world, a, o.x, o.y, 26, 200, { base, el: dmg, spell: true, pop: 140, push: 60, status: true });
  } else if (el === 'holy') {   // Light Storm: a shaft of light comes down on the foe, more fall around it, each a holy flash
    fx('ex_level_up_pillar', o.x, o.y, 0.8);
    strike(world, a, o.x, o.y, 24, 160, { base, el: dmg, spell: true, pop: 140, status: true });
    for (let k = 0; k < 3; k++) {
      const px = o.x + rand(-28, 28), py = o.y + rand(-16, 16), dl = 140 + k * 110;
      fx('ex_holy_impact_small', px, py, 0.9, { delay: dl });
      strike(world, a, px, py, 18, dl + 120, { base: base * 0.35, el: dmg, spell: true, pop: 90, status: true });
    }
  } else {
    world.bolts.push({ px: true, el, x1: a.x, y1: a.y - 20, x2: o.x, y2: o.y - 12, t: 0, dur: 160, seed: Math.random() * 1000, segs: 6, jag: 4 });
    fx('layer_storm', o.x, o.y - 10, 0.6);
    dealDamage(world, a, o, { base, el: dmg, spell: true, pop: 150, push: 20 });
  }
}
function transcendTick(world, a, dt) {
  a.layeredT = (a.layeredT || 0) - dt;
  a.transcend -= dt;
  a.arcT = (a.arcT || 0) - dt;
  const sl = lsk(a, 'strike');
  if (sl && a.arcT <= 0 && !a.dead) { a.arcT = STRIKE_MS[sl]; layerAttack(world, a); }   // ELEMENT STRIKE: the element's own attack
  if (typeof layerSwordsTick === 'function') layerSwordsTick(world, a, dt);   // the layer's little swords (layerswords.js)
  if (a.transcend <= 0) {
    a.transcend = 0; a.exhausted = layerExhaust(a); a.layerSel = null; layerRunDone(a);
    world.rings.push({ x: a.x, y: a.y, r: 26, t: 0, col: layerPal(a).mote });
    floatText(world, a.x, a.y - 52, 'EXHAUSTED — +100% damage taken', '#ff8a8a', 9);
  }
}

// ---------------------------------------------------------------- Chef Daddy
// Skill specials. Returns true when the skill is fully handled here (buffs); false lets castSpell's normal
// archetype run (Hot Oil = beam, Ice Box = pillar, Order Up = plates as bolts, Deep Cut = dash, Heat = nova).
// Spirit Cannon: charge (ms) → power ×(0.5 + charge / 2000) on top of CANNON.power, the beam longer and wider too
const CANNON_WORDS = [{ at: 0, s: 'GATHERING SPIRIT', col: '#9fe8ff' }, { at: 800, s: 'POWER RISING', col: '#6ac8ff' }, { at: 1600, s: 'SPIRIT OVERFLOWING', col: '#ffd23f' }, { at: 2300, s: 'LIMIT BREAK', col: '#ffffff' }];   // (the last holds long enough to read: the cannon fires itself at CANNON.max)
const CANNON = { charge: 1000, min: 400, max: 3000, len: 200, width: 30, power: 2.6, beam: 650 };
const cannonMul = ms => 0.5 + Math.min(CANNON.max, ms) / 2000;   // 0.4 s ×0.7 · 1 s ×1 · 2 s ×1.5 · 3 s ×2
function fireCannon(world, a, dir, base, opts, ms, quick = false) {
  if (a.dead || (a.stun > 0 && a.state === 'hurt')) { floatText(world, a.x, a.y - 50, 'BROKEN!', '#ff9a8a', 9); return; }   // knocked out of it
  a.dir = dir;
  const [dx] = DV[dir], k = Math.min(CANNON.max, ms) / 1000, L = CANNON.len + k * 45, W2 = CANNON.width + k * 8, mul = cannonMul(ms);
  const sx = a.x + dx * 10, sy = a.y - 14;
  const rect = dir === 1 ? { x: a.x, y: a.y - 14 - W2 / 2, w: L, h: W2 } : dir === 3 ? { x: a.x - L, y: a.y - 14 - W2 / 2, w: L, h: W2 } : dir === 0 ? { x: a.x - W2 / 2, y: a.y - L, w: W2, h: L } : { x: a.x - W2 / 2, y: a.y - 10, w: W2, h: L };
  world.strikes.push({ owner: a, team: a.team, rect, delay: 0, opts: opts({ base: base * CANNON.power * mul, launch: 260, pop: 240, push: 140 }), hit: new Set() });
  world.fx.push({ kbeam: true, x: sx, y: sy, dir, len: L, t: 0, dur: (quick ? 0.5 : 1) * CANNON.beam + k * 120, size: 0.8 + k * 0.25 });
  if (quick) { world.shake = Math.max(world.shake, 2); return; }   // a Ki form shot: no shout, flash or freeze on every swing
  world.shake = Math.max(world.shake, 5 + k * 3); world.hitStop = Math.max(world.hitStop, 70 + k * 30);
  world.flash = { t: 0, dur: 200 + k * 80, col: '#cff4ff' };
  // the shout climbs with the charge
  const shout = mul >= 1.95 ? ['FINAL SPIRIT CANNON', '#ffffff'] : mul >= 1.5 ? ['MAXIMUM SPIRIT CANNON', '#ffe08a'] : mul >= 1 ? ['SPIRIT CANNON UNLEASHED', '#bff4ff'] : ['SPIRIT CANNON', '#9fe8ff'];
  const life = 1400 + k * 300;
  world.spellName = { str: `${shout[0]}  ×${mul.toFixed(1)}`, col: shout[1], t: life, life, team: a.team, big: a.kind === 'player', cannon: a.kind === 'player' ? Math.min(1, k / 3) : 0 };   // (drawn by drawCannonShout, hud.js)
  if (mul >= 1.95) floatText(world, a.x, a.y - 58, 'THE HEAVENS SPLIT!', '#ffffff', 12);
  if (typeof SFX !== 'undefined' && SFX.smite) SFX.smite();
}
// the hero holding the charge: it grows while the key is held; letting go (or reaching full power) fires it
function cannonChargeTick(world, a, dt) {
  const c = a.cannonCharge;
  if (a.dead || a.state === 'hurt' || a.state === 'air' || a.state === 'down') {   // knocked out of the charge
    a.cannonCharge = null; c.fx.dur = 0; floatText(world, a.x, a.y - 50, 'BROKEN!', '#ff9a8a', 9); return;
  }
  const was = c.t, W = c.bomb ? KIB.words : CANNON_WORDS, min = c.bomb ? KIB.min : CANNON.min, max = c.bomb ? KIB.max : CANNON.max; c.t += dt * (c.bomb && a.chiT > 0 ? KIB.kiRate : 1); a.state = 'cast'; a.castLen = Math.max(a.castLen || 0, 200); a.vx = a.vy = 0;
  if (c.bomb) kiBombGather(world, a, c);
  // each stage of the charge lands with a ring and a jolt (the words themselves: drawCannonWords, hud.js)
  for (const { at, col } of W.slice(1))
    if (was < at && c.t >= at) { world.rings.push({ x: a.x, y: a.y, r: 22 + at / 100, t: 0, col }); world.shake = Math.max(world.shake, 1 + at / 1000); }
  const held = typeof SOLO !== 'undefined' && isDown(...SOLO.spell[c.slot]);
  if (c.bomb && c.t >= max && held && a.chiT > 0 && !a.kiSurge) {   // Ki form, full and still held: it sinks into you
    c.t = max; c.over = (c.over || 0) + dt; if (c.over >= KIB.absorb) kiAbsorb(world, a, c);
    return;
  }
  if (c.t >= min && (!held || c.t >= max)) {
    a.cannonCharge = null; c.fx.dur = 0; a.castLen = 380;
    (c.bomb ? fireKiBomb : fireCannon)(world, a, c.dir, c.base, c.opts, c.t);
  }
}
// a support card on its caster: an amount at once, or a timed addition to a passive (kept in a.sup, taken off when it ends)
function supportCast(world, a, sp) {
  const S = sp.sup, at = supportAt(S, sp.tier), v = at.v, also = S.also || {}, hpOf = n => a.maxHp * n / 100, mpOf = n => a.maxMp * n / 100;
  if (S.now === 'hp') heal(world, a, hpOf(v));
  if (S.now === 'shield') a.shield = Math.max(a.shield || 0, Math.round(hpOf(v)));
  if (S.now === 'mp') a.mp = Math.min(a.maxMp, a.mp + mpOf(v));
  if (S.k) {
    a.sup = (a.sup || []).filter(b => { if (b.id !== sp.sp) return true; a.passives[b.k] -= b.v; return false; });   // cast again: it starts over
    const add = Math.min(v, Math.max(0, PASSIVES[S.k].cap - (a.passives[S.k] || 0)));
    a.passives[S.k] = (a.passives[S.k] || 0) + add; a.sup.push({ id: sp.sp, k: S.k, v: add, t: S.secs * 1000, max: S.secs * 1000, label: S.label, stat: at.stat, col: ELEMENTS[sp.el].col });
  }
  if (also.shield) a.shield = Math.max(a.shield || 0, Math.round(hpOf(also.shield)));
  if (also.hp) heal(world, a, hpOf(also.hp));
  if (also.mp) a.mp = Math.min(a.maxMp, a.mp + mpOf(also.mp));
  if (also.cure) for (const s of ['poison', 'burn', 'slow', 'freeze']) delete a.status[s];
  floatText(world, a.x, a.y - 46, S.label.toUpperCase(), ELEMENTS[sp.el].col, 9); world.rings.push({ x: a.x, y: a.y, r: 22, t: 0, col: ELEMENTS[sp.el].col });
}
function supportTick(a, dt) { a.sup = a.sup.filter(b => { b.t -= dt; if (b.t > 0) return true; a.passives[b.k] -= b.v; return false; }); }
function chefSkill(world, a, sp, base, opts, tp) {
  if (sp.sx === 'support') { supportCast(world, a, sp); return true; }
  const say = (s, col) => floatText(world, a.x, a.y - 56, s, col, 10);
  switch (sp.sx) {
    case 'heat':   // a burst of flame, then 8 s of +30% damage, faster cuts and burning hits
      a.heatT = 8000; say('TURN UP THE HEAT!', '#ff8a3a');
      for (let i = 0; i < 16; i++) world.particles.push({ x: a.x, y: a.y - 10, vx: rand(-60, 60), vy: rand(-90, -20), t: 0, life: rand(300, 600), col: i % 2 ? '#ff6a1a' : '#ffd23f', size: rand(1.5, 3), streak: true, drag: 0.92 });
      return false;
    case 'sharpen':   // 10 s: melee crits +40%, +20% damage
      a.sharpT = 10000; a.castLen = 360; say('KNIFE SHARPENED', '#fff36b');
      world.fx.push(fxAt(FX.LIGHTNING, a.x, a.y - 8, 0.6, { filter: elementFilter('lightning') }));
      for (let i = 0; i < 14; i++) world.particles.push({ x: a.x + DV[a.dir][0] * 10, y: a.y - 14, vx: rand(-80, 80), vy: rand(-80, 10), t: 0, life: rand(200, 420), col: i % 2 ? '#ffffff' : '#fff36b', size: 1.4, streak: true, drag: 0.9 });
      return true;
    case 'smoke':   // a cloud pushes foes back; 4 s of 50% dodge and fast healing, and a breather for MP
      a.smokeT = 4000; a.mp = Math.min(a.maxMp, a.mp + a.maxMp * 0.25); a.castLen = 420; say('SMOKE BREAK', '#d8e8e0');
      heal(world, a, a.maxHp * 0.12);
      for (let i = 0; i < 26; i++) world.particles.push({ x: a.x + rand(-10, 10), y: a.y - rand(4, 20), vx: rand(-40, 40), vy: rand(-30, -5), t: 0, life: rand(700, 1300), col: i % 3 ? '#c8ccd0' : '#eef0f2', size: rand(4, 8), puff: true });
      strike(world, a, a.x, a.y, 46, 120, Object.assign({}, opts, { base: base * 0.4, launch: 0, push: 110 }));
      return true;
    case 'cannon': {   // Spirit Cannon: stand and gather energy, then a long piercing beam. The hero charges for as long as
      // the spell's key is held (the longer, the stronger and bigger the beam, up to CANNON.max); anyone else charges
      // for CANNON.charge and fires
      const dir = a.dir;
      a.state = 'cast'; setAnim(a, a.kind === 'player' ? (actorAnims(a).charge ? 'charge' : 'cast') : 'attack', true); a.vx = a.vy = 0;
      const fx = { kcharge: true, owner: a, t: 0, dur: 1e9 };
      world.fx.push(fx);
      if (a.kind === 'player' && a.castSlot != null) {
        fx.held = true; a.cannonCharge = { t: 0, slot: a.castSlot, dir, base, opts, fx }; a.castLen = 400;
        say('GATHERING SPIRIT… (hold to charge!)', '#9fe8ff');
        return true;
      }
      a.castLen = CANNON.charge + 380; fx.dur = CANNON.charge + 120;
      say('GATHERING SPIRIT…', '#9fe8ff');
      world.timers.push({ t: CANNON.charge, fn: () => fireCannon(world, a, dir, base, opts, CANNON.charge) });
      return true;
    }
    case 'kibomb': kiBombStart(world, a, base, opts); return true;   // the ultimate (kibomb.js)
    case 'legion': {   // King's Legion (OmegaKingX): five random monsters answer the call and fight beside him for 20 s
      a.castLen = 520; world.spellName = { str: "KING'S LEGION", col: '#ffe08a', t: 1600, team: a.team, big: true };
      world.rings.push({ x: a.x, y: a.y, r: 50, t: 0, col: '#ffe08a' }, { x: a.x, y: a.y, r: 30, t: -120, col: '#ffffff' });
      const pool = SPECIES_IDS.filter(id => !['omega', 'merc'].includes(id) && D.monsters[id].h <= 48);
      for (let i = 0; i < 5; i++) {
        const an = -Math.PI / 2 + (i - 2) * 0.7, m = spawnFamiliar(world, a, pick(pool), sp.tier, i % 2);
        m.x = a.x + Math.cos(an) * 34; m.y = a.y + Math.sin(an) * 22 + 10; m.home = { x: m.x, y: m.y };
        m.legionT = 20000; m.slot = (i - 2) * 0.6; m.ai.t = 0;
        world.fx.push(fxAt(FX.HOLY, m.x, m.y, 0.6, { delay: i * 70, filter: elementFilter('holy') }));
      }
      return true;
    }
    case 'meal': {   // Gourmet Meal: everyone on his side nearby eats — heal 30% and Well Fed for 15 s
      a.castLen = 520; world.spellName = { str: 'GOURMET MEAL  ★★★★★', col: '#ffe08a', t: 1600, team: a.team, big: true };
      world.fx.push(fxAt(FX.HOLY, a.x, a.y, 1.1, { filter: elementFilter('holy') }));
      world.rings.push({ x: a.x, y: a.y, r: 60, t: 0, col: '#ffe08a' });
      for (const o of world.actors) {
        if (o.dead || o.team !== a.team || Math.hypot(o.x - a.x, o.y - a.y) > 140 || !(o === a || o.ally || o.kind === 'player')) continue;
        heal(world, o, o.maxHp * 0.3); o.wellFed = 15000;
        floatText(world, o.x, o.y - 46, '★★★★★', '#ffd23f', 9);
      }
      return true;
    }
  }
  return false;
}
// In the Weeds: overwhelmed → time slows around him (see WEEDS and the dt scaling at the top of updateActor)
function inTheWeeds(world, a, dt) {
  if (a.weedsCd > 0) a.weedsCd -= dt;
  if (a.weedsT > 0) {
    a.weedsT -= dt;
    world.weeds = { team: a.team, t: a.weedsT, owner: a, dur: WEEDS.dur };
    if (a.trail && Math.floor(a.t / 50) !== Math.floor((a.t - dt) / 50)) a.trail.push({ x: a.x, y: a.y, t: 0 });   // afterimages
    return;
  }
  if (a.dead || a.dying || a.weedsCd > 0) return;
  const near = enemiesOf(world, a).filter(o => !o.dead && Math.hypot(o.x - a.x, o.y - a.y) < WEEDS.near).length;
  if (a.hp < a.maxHp * WEEDS.hp || near >= WEEDS.crowd) {
    a.weedsT = WEEDS.dur; a.weedsCd = WEEDS.cd; a.trail = a.trail || [];
    world.spellName = { str: 'IN THE WEEDS', col: '#9fe8ff', t: 1800, team: a.team, big: true };
    floatText(world, a.x, a.y - 60, 'did time slow down… or did I get faster?', '#d8f4ff', 7);
    world.rings.push({ x: a.x, y: a.y, r: 70, t: 0, col: '#9fe8ff' });
    if (typeof SFX !== 'undefined') SFX.cast(true);
  }
}
