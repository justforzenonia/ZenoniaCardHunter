'use strict';
// DOJO LESSONS AND SEALS. Once you have beaten a master, talking to them opens their DOJO board instead of jumping straight
// into a fight:
//   LESSON OF THE DAY   a rematch with a twist that changes every day (each master has their own). Win it and you are paid
//                       DOJO SEALS (1 at Hearthvale, up to 5 from the Last Grandmaster), once per master per day.
//                       Losing costs nothing; it is still a sparring match held at 1 HP.
//   SPAR                the plain rematch, as before (a little gold)
//   SEAL TRADES         spend seals on that master's prizes: a card from their deck, sharpening your Spirit Cannon,
//                       roast snacks for the road, gacha coins
// Titles for lessons won: Dojo Disciple (5) and Lesson Keeper (30). pr.dojoSeals, pr.dojoLessons, pr.dojoLesson = {day, done}.
// A master you haven't beaten yet still just fights you, as before (dojo.js).
const DOJO_LESSON = { seals: I => 1 + I, col: '#ffd27a', sealCol: '#e8b46a' };
const DOJO_TWISTS = [
  { id: 'fierce', name: 'Fierce Spirit', sub: 'they hit 25% harder', on: m => { m.atk *= 1.25; } },
  { id: 'iron', name: 'Iron Body', sub: '35% more health to wear down', on: m => { m.maxHp = m.hp = Math.round(m.maxHp * 1.35); } },
  { id: 'swift', name: 'Swift Feet', sub: 'faster, and they rush you more often', on: m => { m.spd *= 1.2; }, tick: (m, dt) => { m.ai.rush -= dt * 0.6; } },
  { id: 'cannon', name: 'Cannon Day', sub: 'the Spirit Cannon comes twice as often', tick: (m, dt) => { m.ai.cast -= dt; } },
  { id: 'counter', name: 'Quick Counter', sub: 'they counter after 3 hits in a row, not 4', hits: 3, tick: (m, dt) => { m.ai.counter -= dt * 0.6; } },
];
const dojoTwist = I => DOJO_TWISTS[(dayNo() * 7 + I * 3) % DOJO_TWISTS.length];
function dojoLessonDay(pr) {
  const d = dayNo(); if (!pr.dojoLesson || pr.dojoLesson.day !== d) pr.dojoLesson = { day: d, done: {} };
  return pr.dojoLesson;
}
const dojoLessonDone = (pr, I) => !!dojoLessonDay(pr).done[I];
// what each master trades for seals (I: which dojo, so each master's card comes from their own road)
const dojoCardZone = I => Math.max(0, I - 1);
const dojoCannon = pr => [...(pr.cards || []), ...((pr.storage || {}).cards || [])].filter(c => c.sp === DOJO.card).sort((a, b) => b.tier - a.tier)[0];
const DOJO_TRADES = [
  { id: 'card', cost: 4, name: I => `A card from ${DOJOS[I].label}'s deck`, sub: I => `a ${ZONES[dojoCardZone(I)].name} monster, rank ${RANKS[Math.min(9, ZONES[dojoCardZone(I)].ranks[1] + 1)]}`,
    ok: () => true, give: (game, I) => { const z = ZONES[dojoCardZone(I)], c = makeCard(pick(z.mobs.filter(id => D.monsters[id])), Math.min(9, z.ranks[1] + 1)); game.pickup({ kind: 'card', item: c, force: true }); return `${cardName(c)} (${RANKS[c.tier]}) joins your cards`; } },
  { id: 'cannon', cost: 8, name: () => 'Sharpen the Spirit Cannon', sub: pr => { const c = dojoCannon(pr); return !c ? 'you need the Spirit Cannon card first' : c.tier >= RANKS.length - 1 ? 'yours is as sharp as it gets' : `your best one: rank ${RANKS[c.tier]} → ${RANKS[c.tier + 1]}`; },
    ok: pr => { const c = dojoCannon(pr); return !!c && c.tier < RANKS.length - 1; }, give: game => { const c = dojoCannon(game.profile); c.tier++; return `Spirit Cannon sharpened to rank ${RANKS[c.tier]}`; } },
  { id: 'snacks', cost: 2, name: () => 'Snacks for the road', sub: () => '3 Meat Skewers, roasted in the dojo kitchen', ok: () => true, give: game => { addItem(game.profile, 'skewer', 3); return '3 Meat Skewers added to your bag'; } },
  { id: 'coins', cost: 3, name: () => '15 coins', sub: () => 'for the card gacha', ok: () => true, give: game => { game.profile.coins = (game.profile.coins || 0) + 15; return '+15 coins'; } },
];
for (const B of [{ id: 'dojodisciple', name: 'Dojo Disciple', tier: 2, need: 5, pas: ['regen', 'barrier'] }, { id: 'lessonkeeper', name: 'Lesson Keeper', tier: 4, need: 30, pas: ['crit', 'brutal', 'barrier'] }]) {
  const t = { id: B.id, name: B.name, tier: B.tier, how: `Win ${B.need} dojo Lessons of the Day`, prog: pr => [pr.dojoLessons || 0, B.need] };
  TITLE_LIST.push(t); TITLE_BY[B.id] = t; TITLE_PASSIVES[B.id] = B.pas;
}

// the board
function dojoBoardMenu(I) { return { type: 'dojoboard', cur: 0, scroll: 0, I }; }
function dojoBoardRows(pr, I) {
  const T2 = dojoTwist(I), done = dojoLessonDone(pr, I), seals = pr.dojoSeals || 0;
  const seal = (ix, iy, dim) => { ctx.fillStyle = dim ? '#6a5a40' : DOJO_LESSON.sealCol; ctx.beginPath(); ctx.arc(ix, iy, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#5a3412'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#5a3412'; ctx.fillRect(ix - 1.5, iy - 1.5, 3, 3); };
  return [
    { name: `Lesson of the Day: ${T2.name}`, sub: done ? 'learned today, come back tomorrow for a new twist' : `${T2.sub} · win for ${DOJO_LESSON.seals(I)} Dojo Seal${DOJO_LESSON.seals(I) > 1 ? 's' : ''}`,
      right: done ? 'DONE' : 'FIGHT', rightCol: done ? '#9a917c' : '#ff9a6a', dim: done, draw: (x, y) => seal(x, y, done), go: 'lesson' },
    { name: 'Spar', sub: 'a plain rematch, for a little gold', right: 'FIGHT', rightCol: '#ffd27a', draw: (x, y) => seal(x, y, true), go: 'spar' },
    { name: 'The Dojo Road', sub: 'all the masters, your belt, and the lessons of the day', right: 'READ', rightCol: '#e8dcc0', draw: (x, y) => { const B = dojoBeltOf(pr); if (B) drawBeltChip(B, x - 7.5, y); }, road: true },
    ...DOJO_TRADES.map(Tr => { const ok = Tr.ok(pr) && seals >= Tr.cost;
      return { name: Tr.name(I), sub: Tr.id === 'cannon' ? Tr.sub(pr) : Tr.sub(I), right: `${Tr.cost} seals`, rightCol: ok ? DOJO_LESSON.sealCol : '#9a917c', dim: !ok, draw: (x, y) => seal(x, y, !ok), trade: Tr }; }),
  ];
}
function updateDojoBoard(game, m) {
  const pr = game.profile, rows = dojoBoardRows(pr, m.I), nav = panelNav(m, rows.length, 0), R = rows[m.cur];
  if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok || !R) return;
  if (R.road) { game.openMenu(dojoRoadMenu()); return; }
  if (R.go === 'lesson' && dojoLessonDone(pr, m.I)) { game.toast('You learned today\'s lesson already. A new one tomorrow', '#c8bfa8'); return; }
  if (R.go) { game.closeMenu(); DOJO_LESSON.next = R.go === 'lesson' ? dojoTwist(m.I) : null; DOJO_LESSON.go = true; try { startDojoFight(game); } finally { DOJO_LESSON.go = false; } return; }
  const Tr = R.trade; if (!Tr) return;
  if (!Tr.ok(pr)) { game.toast(Tr.sub(pr), '#c8bfa8'); return; }
  if ((pr.dojoSeals || 0) < Tr.cost) { game.toast(`That takes ${Tr.cost} Dojo Seals. You have ${pr.dojoSeals || 0}`, '#c8bfa8'); return; }
  pr.dojoSeals -= Tr.cost; const said = Tr.give(game, m.I); game.save();
  game.toast(`${DOJOS[m.I].label}: ${said}`, DOJO_LESSON.col);
}
function drawDojoBoard(game, m, now) {
  const pr = game.profile, rows = dojoBoardRows(pr, m.I), R = rows[m.cur];
  if (m.cur < (m.scroll || 0)) m.scroll = m.cur; if (m.cur >= (m.scroll || 0) + PM.rows) m.scroll = m.cur - PM.rows + 1;
  panelMenu(m, { title: `${DOJOS[m.I].label.toUpperCase()}`, rows, gold: pr.gold || 0,
    info: `Dojo Seals: ${pr.dojoSeals || 0}  ·  lessons won: ${pr.dojoLessons || 0}` + (R && R.go === 'lesson' ? '  ·  held at 1 HP, losing costs nothing' : ''),
    keys: '↑↓ choose · Enter select · Esc close' }, now);
}

{
  // a beaten master shows the board first; the board's choices come back in here with DOJO_LESSON.go set
  const s = startDojoFight;
  startDojoFight = game => {
    const w = game.world; if (!w || !w.interior || w.dojo) return s(game);
    const I = DOJOS.indexOf(dojoOf(w)), pr = game.profile;
    if (!DOJO_LESSON.go && I >= 0 && dojoBeaten(pr, I)) { game.openMenu(dojoBoardMenu(I)); return; }
    const T2 = DOJO_LESSON.go ? DOJO_LESSON.next : null; DOJO_LESSON.next = null;
    const r = s(game);
    if (T2 && w.dojo && w.dojo.master) {
      w.dojo.lesson = T2; if (T2.on) T2.on(w.dojo.master);
      w.spellName = { str: `LESSON: ${T2.name.toUpperCase()}`, col: '#ffd27a', t: 2000, team: 0, big: true };
      game.toast(`Today's lesson, ${T2.name}: ${T2.sub}`, DOJO_LESSON.col);
    }
    return r;
  };
  const e = endDojoFight;
  endDojoFight = (game, w, won) => {
    const T2 = w.dojo && w.dojo.lesson, I = DOJOS.indexOf(dojoOf(w)), pr = game.profile;
    const r = e(game, w, won);
    if (T2 && won && I >= 0 && !dojoLessonDone(pr, I)) {
      const n = DOJO_LESSON.seals(I); dojoLessonDay(pr).done[I] = true;
      pr.dojoSeals = (pr.dojoSeals || 0) + n; pr.dojoLessons = (pr.dojoLessons || 0) + 1; game.save();
      game.toast(`Lesson learned: ${T2.name}! +${n} Dojo Seal${n > 1 ? 's' : ''} (${pr.dojoSeals} now)`, DOJO_LESSON.col);
    } else if (T2 && !won) game.toast('The lesson stays open today. Rest, and try again', '#c8bfa8');
    return r;
  };
  const a = dojoAI;
  dojoAI = (world, m, dt) => {
    const T2 = world.dojo && world.dojo.master === m ? world.dojo.lesson : null;
    if (!T2) return a(world, m, dt);
    if (T2.tick && m.ai) T2.tick(m, dt);
    const h = DOJO_AI.counterHits; if (T2.hits) DOJO_AI.counterHits = T2.hits;
    try { return a(world, m, dt); } finally { DOJO_AI.counterHits = h; }
  };
}

// BELTS: every master you beat raises your belt, White (1) to Black (all five). Each belt adds 2% to your damage, and the
// Black belt also takes 5% off the damage you take. A little belt chip sits after your class on the HUD; the Dojo Road
// scroll shows it too. (pr.dojoWon and pr.dojos, dojo.js: nothing new is saved.)
const DOJO_BELTS = [
  { name: 'White', col: '#f4f0e6', edge: '#b8b0a0' }, { name: 'Green', col: '#6ac46a', edge: '#2e6a2e' }, { name: 'Blue', col: '#5a9ae8', edge: '#24467a' },
  { name: 'Brown', col: '#a06a3a', edge: '#5a3412' }, { name: 'Black', col: '#2a2626', edge: '#ffd27a' }, { name: 'Gold', col: '#e8b440', edge: '#7a5010' },   // (Gold: the Sand Sage in Mirage Springs)
];
const dojoBeltN = pr => pr ? DOJOS.filter((_, i) => dojoBeaten(pr, i)).length : 0;
const dojoBeltOf = pr => { const n = dojoBeltN(pr); return n ? DOJO_BELTS[n - 1] : null; };
const dojoBeltText = n => n ? `+${n * 2}% damage${n >= 5 ? ', 5% less damage taken' : ''}` : 'no belt yet';
function drawBeltChip(B, x, y, s = 1) {   // a little tied belt: a band with a knot and two tails
  ctx.save(); ctx.fillStyle = B.edge; ctx.fillRect(x - 0.5, y - 2.5 * s, 15 * s + 1, 5 * s);
  ctx.fillStyle = B.col; ctx.fillRect(x, y - 2 * s, 15 * s, 4 * s);
  ctx.fillStyle = B.edge; ctx.fillRect(x + 6 * s, y - 2.5 * s, 3 * s, 5 * s);
  ctx.fillStyle = B.col; ctx.fillRect(x + 5.5 * s, y + 1.5 * s, 1.6 * s, 3.5 * s); ctx.fillRect(x + 8 * s, y + 1.5 * s, 1.6 * s, 3 * s);
  ctx.restore();
}
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const G = window.GAME, p = world && world.player;
    if (G && G.world === world && p && opts && opts.base) {
      const n = dojoBeltN(G.profile);
      if (n && att === p && def && !def.ally) opts = { ...opts, base: opts.base * (1 + n * 0.02) };
      else if (n >= 5 && def === p && att && att !== p) opts = { ...opts, base: opts.base * 0.95 };
    }
    return dd(world, att, def, opts);
  };
  const e = endDojoFight;   // a new belt: say so
  endDojoFight = (game, w, won) => {
    const n0 = dojoBeltN(game.profile), r = e(game, w, won), n1 = dojoBeltN(game.profile);
    if (n1 > n0) game.toast(`New belt: ${DOJO_BELTS[n1 - 1].name}! ${dojoBeltText(n1)}`, DOJO_LESSON.col);
    return r;
  };
}

// THE DOJO ROAD: a scroll of all five masters. Read it at the shrine in any dojo hall (Enter), or from a master's board.
function dojoRoadMenu() { return { type: 'dojoroad', cur: 0, scroll: 0 }; }
function dojoRoadRows(pr) {
  return DOJOS.map((Dj, i) => {
    const won = dojoBeaten(pr, i), open = i === 0 || dojoBeaten(pr, i - 1), lvOk = (pr.lv || 1) >= Dj.lv, T2 = dojoTwist(i), B = DOJO_BELTS[i];
    const sub = won ? `Beaten · today's lesson: ${T2.name}${dojoLessonDone(pr, i) ? ' (learned)' : ` (${DOJO_LESSON.seals(i)} seal${i ? 's' : ''})`}`
      : !open ? `Beat ${DOJOS[i - 1].label} first` : lvOk ? `Waiting for you · ${i === 0 ? 'teaches the Spirit Cannon' : i === DOJO_KI ? 'teaches KI' : 'pays gold and a card'}` : `Waiting for you at level ${Dj.lv} (you are ${pr.lv || 1})`;
    return { name: `${Dj.label}  ·  ${Dj.town}`, sub, col: won ? '#f4ecd8' : open ? '#ffe9a8' : '#a8a0b8', dim: !won && !open,
      right: won ? `${B.name} belt` : open ? (lvOk ? 'NEXT' : `Lv ${Dj.lv}`) : '—', rightCol: won ? B.col : open ? '#ff9a6a' : '#9a917c',
      draw: (x, y) => { if (won) drawBeltChip(B, x - 7.5, y); else { ctx.strokeStyle = open ? '#ffd27a' : '#6a6070'; ctx.lineWidth = 1; ctx.strokeRect(x - 7.5, y - 2, 15, 4); } } };
  });
}
function updateDojoRoad(game, m) { const nav = panelNav(m, DOJOS.length, 0); if (nav.back || nav.ok) game.closeMenu(); }
function drawDojoRoad(game, m, now) {
  const pr = game.profile, n = dojoBeltN(pr), B = dojoBeltOf(pr);
  panelMenu(m, { title: 'THE DOJO ROAD', rows: dojoRoadRows(pr), info: B ? `Your belt: ${B.name} · ${dojoBeltText(n)} · Dojo Seals: ${pr.dojoSeals || 0}` : 'Beat the Hearthvale Dojo Master for your first belt',
    keys: '↑↓ look · Enter or Esc close' }, now);
}
// at the shrine: a soft prompt, and Enter reads the scroll (only between matches)
const DOJO_SHRINE = { reach: 30, dy: 30 };   // (the shrine stands at the hall's middle, at the foot of the back wall: dojo.js buildDojoHall)
const dojoShrineAt = w => { const M = w.door && MAPS[w.door.key]; return { x: M ? M.w * T / 2 : 0, y: 3 * T + DOJO_SHRINE.dy }; };
const dojoShrineNear = w => { const p = w.player, S = dojoShrineAt(w); return w.dojoRoom && !w.dojo && p && Math.hypot(p.x - S.x, p.y - S.y - 8) < DOJO_SHRINE.reach; };
{
  const t = dojoTick;
  dojoTick = (game, w, dt) => {
    if (w.dojoRoom && !game.menu && dojoShrineNear(w) && hit('Enter')) { consume('Enter'); game.openMenu(dojoRoadMenu()); return; }
    return t(game, w, dt);
  };
  const dr = drawDojoRing;
  drawDojoRing = (w, now) => {
    const r = dr(w, now);
    if (w.dojoRoom && !w.dojo && dojoShrineNear(w)) { const p = w.player; text('Enter: read the Dojo Road', Math.round(p.x), Math.round(p.y) + 12, '#ffe9a8', 6); }   // (under your feet, clear of the hero)
    return r;
  };
}

// MASTER'S TEA: after any win in a dojo, the master pours you a cup of their own tea. It is its own small buff for 10 minutes,
// next to your meal and snack (it never replaces them), and shows in the buff list. Each master brews a different one.
// pr.tea = { i: which master, ms }.
const DOJO_TEAS = [
  { name: 'Barley Tea', note: 'toasty and plain, like Hearthvale', dur: 600000, hp: 0.06, regen: 0.003 },
  { name: 'Moss Green Tea', note: 'grassy and steady', dur: 600000, hp: 0.1, armor: 3 },
  { name: 'Dusk Jasmine', note: 'light on the feet', dur: 600000, crit: 6, speed: 1.06 },
  { name: 'Iron Pot Oolong', note: 'dark and sturdy', dur: 600000, atk: 0.08, guard: 0.95 },
  { name: 'Frost Pearl Tea', note: 'cold-clear and bright', dur: 600000, spell: 1.12, mpr: 1.4 },
  { name: 'Date Palm Tea', note: 'sweet, slow and patient, like the oasis', dur: 600000, hp: 0.08, atk: 0.06 },   // (the Sand Sage, Mirage Springs)
];
const dojoTeaOn = pr => pr && pr.tea && pr.tea.ms > 0 && DOJO_TEAS[pr.tea.i] ? DOJO_TEAS[pr.tea.i] : null;
{
  const ff = foodFx;   // the tea's numbers join the food's (multipliers multiply, bonuses add)
  foodFx = pr => {
    const F = ff(pr), Tea = dojoTeaOn(pr); if (!Tea) return F;
    const out = { ...(F || {}) };
    for (const [k, v] of Object.entries(Tea)) { if (typeof v !== 'number' || k === 'dur') continue; out[k] = FX_MUL.includes(k) ? (out[k] || 1) * v : (out[k] || 0) + v; }
    return out;
  };
  const mt = mealTick;
  mealTick = (game, w, dt) => {
    const pr = game.profile, B = pr && pr.tea;
    if (B) { if (w.player && !w.player.dead) B.ms -= dt; if (B.ms <= 0) { pr.tea = null; game.toast(`${(DOJO_TEAS[B.i] || {}).name || 'Tea'} wore off`, '#c9c1a8'); game.refreshPlayer(); } }
    return mt(game, w, dt);
  };
  const at = BUFFS.findIndex(b => b.bad);
  BUFFS.splice(at < 0 ? BUFFS.length : at, 0, { key: 'tea', name: pr => (DOJO_TEAS[pr.tea.i] || {}).name || 'Tea', mark: '♨', col: '#c8e8a0',
    get: (a, pr) => dojoTeaOn(pr) ? pr.tea.ms : 0, max: pr => (DOJO_TEAS[pr.tea.i] || {}).dur });
  const e = endDojoFight;
  endDojoFight = (game, w, won) => {
    const I = DOJOS.indexOf(dojoOf(w)), r = e(game, w, won);
    if (!won || I < 0) return r;
    const Tea = DOJO_TEAS[I], pr = game.profile; pr.tea = { i: I, ms: Tea.dur }; game.refreshPlayer(); game.save();
    const m = game.menu, say = `Sit a moment before you go. Here: ${Tea.name}, ${Tea.note}.`;
    if (m && m.type === 'dialog') m.pages = [...(m.pages || []), say];
    game.toast(`Master's Tea: ${Tea.name} for ${Math.round(Tea.dur / 60000)} min · ${mealText(Tea)}`, '#c8e8a0');
    const p = w.player; if (p) for (let k = 0; k < 6; k++) w.particles.push({ x: p.x + rand(-4, 4), y: p.y - 20, vx: rand(-6, 6), vy: rand(-26, -14), t: k * 90, life: 900, col: 'rgba(240,240,232,0.7)', size: 2 });   // a little steam
    return r;
  };
}
