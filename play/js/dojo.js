'use strict';
// THE DOJO: a hall on the north street of Hearthvale, between the General Store and the Card Hall. Inside, the
// DOJO MASTER (the monk) takes on anyone who asks. Beat him in his own dojo and he teaches you his SPIRIT CANNON —
// a card found nowhere else (pr.dojoWon). It is a sparring match: he never finishes you off (you are held at 1 HP),
// and if you are beaten he sends you back to train. He scales to you, and fights with the Spirit Cannon himself.

const DOJO = { npc: '115', label: 'Dojo Master', place: 'Dojo', card: 'spiritcannon', rematchGold: 300, ring: 74 };
// FIVE DOJOS: Hearthvale's, then one in each town along the road, each only open once you have beaten the one before.
// Every master past the first also fights with a Guardian's kit (bosses.js). The last teaches KI (chi.js). pr.dojos[i].
const DOJOS = [
  { ...DOJO, lv: 1, hp: 5, atk: 0.55, def: 0.6, minHp: 0, minAtk: 0, kit: null, gold: 0, town: 'Hearthvale' },
  { npc: '106', label: 'Master Rowan', lv: 15, hp: 7, atk: 0.7, def: 0.7, minHp: 2000, minAtk: 30, kit: 'rootcaller', gold: 2000, town: 'Mossbrook', say: 'Roots first, hunter. Stand where I cannot move you.' },
  { npc: '118', label: 'Mistress Yue', lv: 30, hp: 9, atk: 0.85, def: 0.8, minHp: 6000, minAtk: 60, kit: 'unseen', gold: 6000, town: 'Duskhollow', say: 'If you can see me, I have already decided to let you.' },
  { npc: '121', label: 'Iron Sage Bo', lv: 45, hp: 12, atk: 1, def: 0.9, minHp: 14000, minAtk: 90, kit: 'molten', gold: 15000, town: 'Cloudhold', say: 'Stand in the fire or step out of it. Either way, you will learn.' },
  { npc: '103', label: 'The Last Grandmaster', lv: 60, hp: 16, atk: 1.2, def: 1, minHp: 30000, minAtk: 130, kit: 'sovereign', gold: 40000, town: 'Frostmere', say: 'Four masters sent you. Show me what they left in you.' },
  { npc: '110', label: 'Sand Sage Oro', lv: 70, hp: 19, atk: 1.3, def: 1.05, minHp: 42000, minAtk: 160, kit: 'molten', gold: 60000, town: 'Mirage Springs', say: 'The Grandmaster taught you Ki. The desert will teach you patience. Few want that lesson.' },   // (after the Grandmaster: a master beyond the five, in the desert's oasis town)
];
const DOJO_KI = 4;   // (the Last Grandmaster teaches Ki and closes the old road; the Sand Sage comes after)
const dojoOf = w => DOJOS[(w.door && w.door.dojoI) || 0];
const dojoBeaten = (pr, i) => i === 0 ? !!pr.dojoWon : !!(pr.dojos && pr.dojos[i]);
// the hall itself, laid out like the user's dojo picture but built from the game's own interior tiles and furniture
// (tileset 100, object bank 100): a plaster-and-stone back wall hung with shields and swords, a golden shrine with
// candles in the middle of it, weapon racks and armour stands either side, warm plank floor, a straw sparring mat
// in the middle (the ring sits on it), tall plants in the corners, lantern stands down the sides. 24 x 20 tiles;
// you come in at the bottom middle.
function buildDojoHall() {
  const W = 24, H = 20, M = blankMap(W, H, 100, 25);
  for (let i = 0; i < W * H; i++) { M.ground[i] = 0; M.solid[i] = 1; }   // all void (black, solid) to start
  for (let x = 1; x < W - 1; x++) { setTile(M, x, 1, x % 2 ? 9 : 8, 1); setTile(M, x, 2, x % 2 ? 19 : 18, 1); }   // the back wall
  for (let y = 3; y < H - 1; y++) for (let x = 1; x < W - 1; x++) setTile(M, x, y, 24, 0);                       // smooth plank floor
  for (const x of [11, 12]) setTile(M, x, H - 1, 24, 0);                                                         // the doorway
  const mx0 = 6, mx1 = 17, my0 = 7, my1 = 15;                                                                    // the straw mat (nine tiles)
  for (let y = my0; y <= my1; y++) for (let x = mx0; x <= mx1; x++) {
    const col = x === mx0 ? 0 : x === mx1 ? 2 : 1, row = y === my0 ? 0 : y === my1 ? 2 : 1;
    setTile(M, x, y, 43 + row * 3 + col, 0);
  }
  // furniture: [frame, centre x, bottom y, solid] (bank 100); placed by its own size so it stands on that spot
  const put = (fi, cx, by, solid = 1) => {
    const r = objRec('100', fi); if (!r) return;
    M.objB.push([100, fi, Math.round(cx - r[4] - r[2] / 2), Math.round(by - r[5] - r[3]), solid]);
    if (solid) for (let x = Math.floor((cx - r[2] * 0.3) / T); x <= Math.floor((cx + r[2] * 0.3) / T); x++) {   // its footprint is solid
      const ty = Math.floor((by - 4) / T); if (M.solid[ty * W + x] === 0) { M.solid[ty * W + x] = 1; M.ground[ty * W + x] |= 1 << 8; }
    }
  };
  const C = W * T / 2, wallY = 3 * T;                    // the hall's middle, the foot of the back wall
  put(55, C, wallY + 30);                                 // the golden shrine
  put(40, C - 30, wallY + 18); put(41, C + 30, wallY + 18);   // its candles
  for (const s of [-1, 1]) {
    put(5, C + s * 70, wallY + 24);                       // weapon racks
    put(4, C + s * 100, wallY + 24);                      // spear baskets
    put(3, C + s * 128, wallY + 24);                      // armour stands
    put(45, C + s * 166, wallY + 34);                     // tall plants in the back corners
    put(45, C + s * 166, (H - 1) * T - 2);                // ... and the front ones
    for (const y of [7, 11, 15]) put(38, C + s * 170, y * T + 10);   // lantern stands down the sides
  }
  // hung on the wall (not solid): shields and swords
  for (const [fi, dx] of [[9, -150], [6, -112], [0, -40], [0, 40], [6, 112], [9, 150]]) {
    const r = objRec('100', fi); if (r) M.objB.push([100, fi, Math.round(C + dx - r[4] - r[2] / 2), Math.round(30 - r[5] - r[3] / 2), 0]);
  }
  const entry = [C, (H - 1) * T + 8];
  Object.assign(M, { name: 'Dojo', entry, spawn: entry, ring: [C, ((my0 + my1 + 1) / 2) * T] });
  floodReach(M, Math.floor(entry[0] / T), Math.floor(entry[1] / T));
  return M;
}
MAPS.dojo_hall = buildDojoHall();
// walking in: the Dojo is its own instance — a sparring ring in the middle of the hall, the master waiting in it
// (facing the door), and you can fight here (main.js: the Dojo is not a safe house)
function setupDojoRoom(game, w, master) {
  const M = MAPS[w.door.key], cx = M.w * T / 2, cy = M.h * T / 2;
  let at = M.ring ? { x: M.ring[0], y: M.ring[1] } : { x: cx, y: cy }, bd = M.ring ? 0 : 1e9;   // the ring's spot, or the reachable floor tile nearest the hall's middle
  for (let i = 0; i < M.w * M.h && bd > 0; i++) {
    if (!M.reach[i]) continue;
    const x = (i % M.w) * T + 8, y = Math.floor(i / M.w) * T + 12, d = Math.hypot(x - cx, y - cy);
    if (d < bd) { bd = d; at = { x, y }; }
  }
  w.dojoRoom = true; w.name = 'Dojo'; w.dojoRing = at;
  Object.assign(master, { x: at.x, y: at.y, dir: 2, home: { ...at }, marker: '#ffd27a' });
  w.spellName = { str: `${w.door.place.toUpperCase()} — THE MASTER AWAITS`, col: '#ffd27a', t: 2200, team: 0, big: true };
  const Dj = dojoOf(w), I = DOJOS.indexOf(Dj); master.line = Dj.say || master.line;
  game.toast(I === 0 ? (game.profile.dojoWon ? 'The Dojo Master waits in the ring — spar again for gold (Enter to challenge)' : 'The Dojo Master waits in the ring — beat him to learn the SPIRIT CANNON (Enter to challenge)') : `${Dj.label} waits in the ring (Enter to challenge)`, '#ffd27a');
}
// the sparring ring on the floor: a gold circle with a taijitu-style split, brighter while you fight
function drawDojoRing(w, now) {
  if (!w.dojoRoom || !w.dojoRing) return;
  drawBossFx(w, now);   // a master's hazards
  const { x, y } = w.dojoRing, R = DOJO.ring, on = !!w.dojo, pulse = 0.6 + 0.4 * Math.sin(now / 400);
  ctx.save();
  ctx.fillStyle = on ? 'rgba(255,120,60,0.10)' : 'rgba(255,210,120,0.08)'; ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = on ? `rgba(255,140,80,${0.5 + 0.4 * pulse})` : 'rgba(255,210,120,0.65)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, R - 6, R * 0.5 - 3, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - R + 6, y); ctx.bezierCurveTo(x - R / 3, y - R * 0.3, x + R / 3, y + R * 0.3, x + R - 6, y); ctx.stroke();
  ctx.restore();
}
function startDojoFight(game) {
  const w = game.world; if (!w || !w.interior || w.dojo) return;
  const p = w.player, pr = game.profile, keeper = w.actors.find(a => a.role === 'dojo'), Dj = dojoOf(w), I = DOJOS.indexOf(Dj);
  if (I > 0 && !dojoBeaten(pr, I - 1)) { game.openDialog(Dj.label, `Not yet. The master in ${DOJOS[I - 1].town} has not sent you. Beat that dojo first.`, null); return; }
  if ((pr.lv || 1) < Dj.lv) { game.openDialog(Dj.label, `You are not ready. Come back at level ${Dj.lv}.`, null); return; }
  const at = keeper ? { x: keeper.x, y: keeper.y } : { x: p.x, y: p.y - 60 };
  if (keeper) keeper.remove = true;
  const lv = pr.lv || 1, tier = Math.min(9, Math.floor(lv / 10));
  const m = baseActor('monster', 1, at.x, at.y);
  Object.assign(m, {
    sp: 'n' + Dj.npc, npcBody: true, dojoMaster: true, tier, plist: [], passives: {}, smart: true, label: Dj.label,
    // scaled to the hero in front of them: enough HP to take a real fight's worth of your blows, and each landed hit a
    // set share of your health, however strong you have grown
    maxHp: Math.round(Math.max((p.maxHp || 150) * Dj.hp, (p.atk || 10) * (45 + I * 30), Dj.minHp)), atk: Math.max((p.atk || 10) * Dj.atk + lv * 0.5, Dj.minAtk, (p.maxHp || 150) * (0.05 + I * 0.015) * (1 + (p.def || 0) * 0.04)), def: (p.def || 0) * Dj.def + lv * 0.4, crit: 10,
    spd: 96 + I * 8, h: 26, heavy: true, boss: true, pal: 0, scale: 1.2,
    ai: { t: 500, cast: 3000, chain: 0, bow: DOJO_AI.bowMs },
    spell: cardSpell({ sp: DOJO.card, tier }), home: { x: at.x, y: at.y },
  });
  m.hp = m.maxHp;
  if (Dj.kit) { giveKit(m, Dj.kit); m.label = Dj.label; }
  w.actors.push(m); w.peaceful = false; w.dojo = { master: m, at, stats: {} };
  p.dojoGuard = true;   // a sparring match: you are never taken below 1 HP here
  w.spellName = { str: `${Dj.label.toUpperCase()} — FIGHT!`, col: '#ffd27a', t: 1800, team: 0, big: true };
  game.toast(`${Dj.label} bows… then attacks! Watch for the Spirit Cannon — block or parry it`, '#ffd27a');
}
function endDojoFight(game, w, won) {
  const pr = game.profile, p = w.player, D2 = w.dojo, Dj = dojoOf(w), I = DOJOS.indexOf(Dj); if (!D2) return;
  const m = D2.master; m.remove = true; m.hazards = [];
  for (const a of w.actors) if (a.kitAdd === m.id) a.remove = true;   // his saplings go with him
  w.dojo = null; w.peaceful = true; p.dojoGuard = false;
  const k = baseActor('npc', 2, D2.at.x, D2.at.y);   // he stands back up, ready to talk
  Object.assign(k, { npc: Dj.npc, label: Dj.label, role: 'dojo', line: Dj.say, h: 26, home: { ...D2.at }, ai: { t: 0, still: true } });
  w.actors.push(k);
  if (!won) {
    p.hp = Math.max(p.hp, p.maxHp * 0.3); p.state = 'free';
    const S = D2.stats || {}, top = ['counter', 'cannon', 'rush'].filter(k => S[k]).sort((a, b) => S[b] - S[a])[0];
    const dm = dialogMenu(Dj.label, 'Hm. A good try. Rest, eat well, and come back when you are ready.', null);
    if (top) dm.pages = [DOJO_HINTS[top]];
    game.openMenu(dm);
    return;
  }
  w.rings.push({ x: m.x, y: m.y, r: 50, t: 0, col: '#9fe8ff' }, { x: m.x, y: m.y, r: 30, t: -120, col: '#ffffff' });
  if (I > 0) {
    const first = !dojoBeaten(pr, I), gold = first ? Dj.gold : Math.round(Dj.gold * 0.15); (pr.dojos = pr.dojos || {})[I] = true;
    pr.gold = (pr.gold || 0) + gold;
    if (first) game.pickup({ kind: 'card', item: makeCard(pick(ZONES[I - 1].mobs.filter(id => D.monsters[id])), Math.min(9, ZONES[I - 1].ranks[1] + 1)) });
    if (first && I === DOJO_KI) {
      chiUnlock(game);
      const dm = dialogMenu(Dj.label, 'Every master before me taught your hands. I will teach what moves them.', null);
      dm.pages = ['This is KI. Land your blows and it gathers in you. A perfect parry gathers it faster.', 'When the gauge passes the mark, press X. Everything you gathered leaves you at once, and your hits stay heavy for a while after.', 'There is nothing more I can teach. Go.'];
      game.openMenu(dm);
    } else game.openDialog(Dj.label, first ? `Well fought. ${gold} G, and a card from my own deck. The next dojo is yours to try.` : `Again! ${gold} G for the lesson.`, null);
  } else if (!pr.dojoWon) {
    pr.dojoWon = true;
    const c = makeCard(DOJO.card, Math.min(9, Math.max(2, Math.floor((pr.lv || 1) / 10))));
    game.pickup({ kind: 'card', item: c, force: true });
    game.openDialog(DOJO.label, 'Ha! You beat me fair and square. Take my SPIRIT CANNON: gather your spirit, then let it all go at once. Nobody else will ever teach you this.', null);
  } else {
    pr.gold = (pr.gold || 0) + DOJO.rematchGold;
    game.openDialog(DOJO.label, `Again you win! Here, ${DOJO.rematchGold} G for the lesson. My cannon you already have.`, null);
  }
  if (typeof bumpStat === 'function') bumpStat('dojoWins');
  game.save();
}
// HOW A MASTER FIGHTS: never idle. They always know where you are, close the distance in a burst when you back off,
// strike in three-hit chains, and call the Spirit Cannon. Stand and hit them for too long and they COUNTER: they vanish
// from your blows, reappear behind you and knock you away. Faster and shorter pauses at each dojo.
const DOJO_AI = { rushFrom: 70, rushCd: 2200, rushSpd: 3.2, rushMs: 320, chain: 3, chainGap: 300, rest: 550, counterHits: 4, counterCd: 5000, cast: [5500, 7500], tellMs: 420, rushTellMs: 260, bowMs: 1100 };
// after a lost match, the master tells you what beat you most (stats kept in dojoAI)
const DOJO_HINTS = {
  counter: 'You kept swinging into my counter. After three hits, watch for the gold "!": raise your guard (hold L) or step aside.',
  cannon: 'My Spirit Cannon found you again and again. When I gather it, hold L to block, or dash through it at the last moment.',
  rush: 'You backed away, and I closed the gap every time. Stay close, or dash aside when you see me crouch and kick up dust.',
};
function dojoAI(world, m, dt) {
  const ai = m.ai, p = world.player, I = DOJOS.indexOf(dojoOf(world)); if (!p || p.dead) return;
  const quick = 1 - I * 0.08;   // each dojo's master rests less
  if (ai.bow > 0) {   // the opening bow: a calm beat before the match, facing you
    if (!ai.bowed) { ai.bowed = true; floatText(world, m.x, m.y - 40, 'bows', '#e8dcc0', 8); }
    ai.bow -= dt; m.vx = m.vy = 0; m.dir = dirTo(p.x - m.x, p.y - m.y); setAnim(m, 'idle', true); return;
  }
  ai.t -= dt; ai.cast -= dt; ai.rush = (ai.rush || 0) - dt; ai.counter = (ai.counter || 0) - dt; ai.hitT = (ai.hitT || 0) - dt;
  if (ai.hp != null && m.hp < ai.hp) { ai.hits = (ai.hits || 0) + 1; ai.hitT = 1500; } ai.hp = m.hp; if (ai.hitT <= 0) ai.hits = 0;
  const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1; m.dir = dirTo(dx, dy);
  if (m.windup) { m.windup.t -= dt; m.vx = m.vy = 0; setAnim(m, 'idle', true); if (m.windup.t <= 0) { const sp = m.windup.sp; m.windup = null; m.parryEaseT = 1500; castSpell(world, m, sp, 0); } return; }
  const St = (world.dojo && world.dojo.stats) || {};   // (what the master did to you, for the hint after a loss)
  if (ai.tell > 0) {   // the counter's warning: the master stops, a gold "!" over them, gold motes rising; then gone and behind you
    ai.tell -= dt; m.vx = m.vy = 0; setAnim(m, 'idle', true);
    if (Math.random() < 0.4) world.particles.push({ x: m.x + rand(-8, 8), y: m.y - rand(6, 30), vx: 0, vy: -20, t: 0, life: 260, col: '#ffd27a', size: 1.5 });
    if (ai.tell > 0) return;
    const n = DV[p.dir] || [1, 0], at = findOpen(world, p.x - n[0] * 26, p.y - n[1] * 18); world.rings.push({ x: m.x, y: m.y, r: 26, t: 0, col: '#ffd27a' });
    m.x = at.x; m.y = at.y; floatText(world, m.x, m.y - 40, 'COUNTER!', '#ffd27a', 10); world.shake = Math.max(world.shake || 0, 1.5);
    St.counter = (St.counter || 0) + 1; dealDamage(world, m, p, { base: m.atk * 1.3, push: 170 }); ai.t = 260; return;
  }
  if ((ai.hits || 0) >= DOJO_AI.counterHits && ai.counter <= 0) {   // the counter: a fair warning first (block, or step aside)
    ai.counter = DOJO_AI.counterCd * quick; ai.hits = 0; ai.tell = DOJO_AI.tellMs; m.invuln = DOJO_AI.tellMs + 500;
    floatText(world, m.x, m.y - 40, '!', '#ffd27a', 12); world.rings.push({ x: m.x, y: m.y, r: 30, t: 0, col: '#ffd27a' }); return;
  }
  if (ai.rushTell > 0) {   // the rush's warning: a crouch and a puff of dust at their feet
    ai.rushTell -= dt; m.vx = m.vy = 0; setAnim(m, 'idle', true);
    if (Math.random() < 0.5) world.particles.push({ x: m.x + rand(-6, 6), y: m.y - 2, vx: rand(-25, 25), vy: rand(-12, -4), t: 0, life: 300, col: '#d8c8a0', size: 1.5 });
    if (ai.rushTell <= 0) { ai.dash = DOJO_AI.rushMs; St.rush = (St.rush || 0) + 1; }
    return;
  }
  if (ai.dash > 0) {   // the rush
    ai.dash -= dt; const sp = speedOf(m) * DOJO_AI.rushSpd * dt / 1000; moveBy(world, m, dx / d * sp, dy / d * sp); setAnim(m, 'walk', true);
    if (Math.random() < 0.5) world.particles.push({ x: m.x, y: m.y - 12, vx: 0, vy: 0, t: 0, life: 220, col: '#ffd27a', size: 2 });
    if (d < 26) ai.dash = 0; return;
  }
  if (m.spell && ai.cast <= 0 && d > 40) { ai.cast = rand(...DOJO_AI.cast) * quick; St.cannon = (St.cannon || 0) + 1; monsterCast(world, m, m.spell); return; }
  if (d > DOJO_AI.rushFrom && ai.rush <= 0) { ai.rush = DOJO_AI.rushCd * quick; ai.rushTell = DOJO_AI.rushTellMs; return; }
  if (d < 30 && Math.abs(dy) < 20) {   // in reach: a chain of blows, then a short breath
    if (ai.t <= 0) { m.state = 'attack'; setAnim(m, 'attack'); ai.chain = (ai.chain || 0) + 1; if (ai.chain >= DOJO_AI.chain) { ai.chain = 0; ai.t = DOJO_AI.rest * quick; } else ai.t = DOJO_AI.chainGap; }
    else {   // between chains they circle you, looking for the next opening
      ai.sideT = (ai.sideT || 0) - dt; if (ai.sideT <= 0) { ai.sideT = rand(500, 1000); ai.side = Math.random() < 0.5 ? 1 : -1; }
      const sp = speedOf(m) * 0.7 * dt / 1000; moveBy(world, m, -dy / d * sp * ai.side, dx / d * sp * ai.side); setAnim(m, 'walk', true);
    }
    return;
  }
  const sp = speedOf(m) * dt / 1000; moveBy(world, m, dx / d * sp, dy / d * sp); setAnim(m, 'walk', true);
}
// every frame inside the dojo while a match is on
function dojoTick(game, w, dt) {
  if (w.actors.some(a => a.remove)) w.actors = w.actors.filter(a => !a.remove);   // (interiors have no clean-up of their own: the
  const D2 = w.dojo; if (!D2) return;                                              //  waiting master and the beaten fighter must go)
  const p = w.player, m = D2.master;
  if (m.dead || m.hp <= 0) { endDojoFight(game, w, true); return; }
  if (p.hp <= 1.5 || p.dead) { p.dead = false; endDojoFight(game, w, false); }
}

// heroes who won the Spirit Cannon while their collection was full never got it (the card was dropped): give it back, once
function dojoCannonRepair(game) {
  const pr = game.profile; if (!pr.dojoWon || pr.cannonOk) return; pr.cannonOk = 1;
  const has = c => c.sp === DOJO.card; if (pr.cards.some(has) || ((pr.storage || {}).cards || []).some(has)) return;
  game.pickup({ kind: 'card', item: makeCard(DOJO.card, Math.min(9, Math.max(2, Math.floor((pr.lv || 1) / 10)))), force: true });
  game.toast('The Dojo Master kept his word: SPIRIT CANNON added to your cards!', '#ffd27a'); game.save();
}
// the counter's warning: a steady gold "!" bubble just above the master's name plate (drawn with the plate, over everything)
{
  const dn = drawNameplate;
  drawNameplate = (a, y, now) => {
    const r = dn(a, y, now);
    if (!a.dojoMaster || !a.ai || !(a.ai.tell > 0)) return r;
    const B = a.plateBox, bx = Math.round(a.x), by = Math.round((B ? B.top - 14 : a.y - 60) - Math.sin(now / 80));
    ctx.save(); ctx.fillStyle = 'rgba(40,24,8,0.88)'; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.2; ctx.stroke(); text('!', bx, by + 0.5, '#ffe9a8', 10); ctx.restore();
    return r;
  };
}
