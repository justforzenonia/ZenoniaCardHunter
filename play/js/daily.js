'use strict';
// THE DAILY & WEEKLY LOOP — what spreads the journey over a real week. All three run on the real calendar (the
// player's own clock), not the in-game day:
//   DAILY CONTRACTS  three Guild contracts a day, rolled for the zone your story has reached, tracked as you play and
//                    paid out the moment they are done (about half a level each), with a bonus for all three.
//   BLACK HOLE LORD  once a real week a Lord tears out of a black hole somewhere near you in the Wilds — a huge boss
//                    of your zone's top rank — with a guaranteed card a rank above, a heap of gold and coins.
//   ATTENDANCE       a 28-day board the first time you enter the world each day: claim the next day's gift (each
//                    seventh day: a rare card). A missed day costs nothing, and after day 28 it starts over.
// pr.daily = { day, list: [{ kind, need, have, done }], bonus }, pr.weekly = { week, done, spawned },
// pr.login = { last, streak }.

const dayNo = (t = Date.now()) => { const d = new Date(t); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); };   // local days since 1970
const weekNo = (t = Date.now()) => Math.floor((dayNo(t) + 3) / 7);   // weeks starting on Monday
const DAILY = { n: 3, expShare: 0.5 };
const LOGIN_GIFTS = [
  { coins: 2, gold: 150 }, { coins: 3, gold: 250 }, { coins: 4, gold: 350 }, { coins: 5, gold: 500 },
  { coins: 6, gold: 700 }, { coins: 8, gold: 900 }, { coins: 15, gold: 2000, card: true },
];
// the zone your story has reached (the chapter you are on, or the furthest one past)
const storyZone = pr => { const S = pr.story || {}; return Math.max(0, Math.min(3, S.step === -2 ? 3 : (S.ch || 0))); };

// ---------------------------------------------------------------- daily contracts
const CONTRACTS = {
  hunt:  z => ({ need: 40, text: `Defeat 40 monsters in the ${ZONES[z].name}` }),
  elite: z => ({ need: 12, tier: Math.max(0, ZONES[z].ranks[1] - 1), text: `Defeat 12 monsters of rank ${RANKS[Math.max(0, ZONES[z].ranks[1] - 1)]} or higher` }),
  mini:  z => ({ need: 1, text: `Bring down a mini boss in the ${ZONES[z].name}` }),
  cave:  () => ({ need: 1, text: 'Defeat the boss inside a black hole' }),
  chest: () => ({ need: 3, text: 'Open 3 treasure chests in the Wilds' }),
  bounty: () => ({ need: 1, text: 'Bounty: defeat an elite monster (Swift, Vampiric, Armored or Volatile)' }),
  newpage: () => ({ need: 2, text: 'Fill 2 new Monster Book pages (look for the NEW tag)' }),   // (book.js mbookKill)   // (foeelite.js; a co-op friend's through net.js netKill)
};
function dailyState(pr) {
  const today = dayNo();
  if (!pr.daily || pr.daily.day !== today) {
    const z = storyZone(pr), r = rng(today * 977 + 13), kinds = Object.keys(CONTRACTS).sort(() => r() - 0.5).slice(0, DAILY.n);
    pr.daily = { day: today, zone: z, bonus: false, list: kinds.map(k => Object.assign({ kind: k, have: 0, done: false }, CONTRACTS[k](z))) };
  }
  return pr.daily;
}
const contractReward = (pr, z) => ({ exp: Math.round(expNeed(pr.lv || 1) * DAILY.expShare), gold: Math.round(180 * Math.pow(z + 1, 1.6)), coins: 2 });
// progress, from the same events the Guild's quests hear (quests.js questEvent)
function dailyEvent(game, type, info = {}) {
  const pr = game.profile; if (!pr) return;
  const D2 = dailyState(pr);
  for (const c of D2.list) {
    if (c.done) continue;
    let inc = 0;
    if (type === 'kill') {
      if (c.kind === 'hunt' && info.zone === D2.zone) inc = 1;
      if (c.kind === 'elite' && info.tier >= c.tier) inc = 1;
      if (c.kind === 'mini' && info.mini && info.zone === D2.zone) inc = 1;
    } else if (type === c.kind) inc = 1;
    if (!inc) continue;
    c.have = Math.min(c.need, c.have + inc);
    if (c.have >= c.need) payContract(game, c, D2);
  }
}
function payContract(game, c, D2) {
  const pr = game.profile, R = contractReward(pr, D2.zone);
  c.done = true; seasonGain(game, SEASON.pts.contract);
  game.gainExp(R.exp); pr.gold = (pr.gold || 0) + R.gold; pr.coins = (pr.coins || 0) + R.coins;
  game.toast(`☀ Daily contract done: ${c.text} — ${R.exp} EXP · ${R.gold} G · ${R.coins} coins`, '#ffe08a');
  if (!D2.bonus && D2.list.every(x => x.done)) {   // all three: a card of the zone's top rank
    D2.bonus = true; pr.coins += 5;
    game.pickup({ kind: 'card', item: makeCard(pick(ZONES[D2.zone].mobs.filter(id => D.monsters[id])), ZONES[D2.zone].ranks[1]) });
    game.toast('☀ ALL DAILY CONTRACTS DONE — +5 coins and a card! New contracts tomorrow.', '#ffd23f');
  }
  game.save();
}

// ---------------------------------------------------------------- the weekly Black Hole Lord
const WEEKLY_LORD_LV = 5;   // the weekly Lord only comes for heroes of this level or higher
function weeklyState(pr) { const wk = weekNo(); if (!pr.weekly || pr.weekly.week !== wk) pr.weekly = { week: wk, done: false }; return pr.weekly; }
function weeklyTick(game, w) {
  const pr = game.profile, W = weeklyState(pr), p = w.player;
  if (W.done || w.interior || w.cave || !p || inTown(p.x) || w.actors.some(a => a.weeklyLord && !a.dead)) return;
  if ((pr.lv || 1) < WEEKLY_LORD_LV) return;   // (2026-11-20, the user chose "from Level 5": it came for brand-new Lv 1 heroes 20 s into their first walk in the Wilds)
  const R = REGIONS[regionIndexAt(p.x)]; if (!R || R.zone < 0) return;
  if ((w.lordWait = (w.lordWait || 0) + 16) < 20000) return;   // twenty seconds into the Wilds, it comes
  const z = R.zone, Z = ZONES[z], sp = Z.mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0];
  const fwd = p.dir === 3 ? -LORD_WAIT.at : LORD_WAIT.at, side = [fwd, -fwd].map(dx => findOpen(w, p.x + dx, p.y)).find(q => !inTown(q.x) && (REGIONS[regionIndexAt(q.x)] || {}).zone === z);   // ahead of you, else behind: never in a town or the next zone
  if (!side) return; const at = side;
  lordWaitWrap();
  const m = makeMonster(sp, Z.ranks[1], at.x, at.y);
  Object.assign(m, { boss: true, weeklyLord: true, lordWaiting: true, lordZone: z, scale: 2.2, heavy: true, label: seasonWeek(pr).lord, shiny: true, home: { x: at.x, y: at.y } });
  m.maxHp = m.hp = Math.round(m.maxHp * 12); m.atk *= 1.5; giveWildKit(m);
  w.actors.push(m);
  w.rings.push({ x: at.x, y: at.y, r: 44, t: 0, col: '#c890ff' });   // (a soft sign where it stands: no shake, no flash)
  game.toast(`◉ The ${seasonWeek(pr).lord} waits nearby. Walk up to it when you're ready: it won't come to you.`, '#c890ff');
}
// THE LORD WAITS (2026-11-20; the user chose "Calmer Lord"): until this week's Lord is beaten it came for you 20 s into every
// trip to the Wilds, with a shake and a flash. Now it appears a little way off (LORD_WAIT.at) and stands still, thinking
// nothing, until you walk up to it (LORD_WAIT.wake) or hit it; then it rises (a small shake) and fights as before.
const LORD_WAIT = { at: 260, wake: 70 };
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    if (!m.weeklyLord || !m.lordWaiting) return ai(world, m, dt);
    const near = world.actors.some(a => a.kind === 'player' && !a.dead && Math.hypot(a.x - m.x, a.y - m.y) < LORD_WAIT.wake);
    if (near || (m.maxHp && m.hp < m.maxHp)) {
      m.lordWaiting = false; world.shake = Math.max(world.shake || 0, 3);
      world.rings.push({ x: m.x, y: m.y, r: 56, t: 0, col: '#c890ff' });
      if (window.GAME && GAME.world === world) GAME.toast(`◉ The ${m.label || 'Lord'} rises!`, '#c890ff');
      return ai(world, m, dt);
    }
    m.vx = 0; m.vy = 0;   // (it waits where it stands)
  };
}
// its boss abilities (bosses.js bossKitTick: rings, bolts, hazards) run outside monsterAI, so they wait too. bosses.js loads
// AFTER this file, so the wrap is made when the first Lord appears (lordWaitWrap, from weeklyTick), never at load.
function lordWaitWrap() {
  if (LORD_WAIT.wrapped || typeof bossKitTick !== 'function') return;
  const kt = bossKitTick; LORD_WAIT.wrapped = true;
  bossKitTick = (world, a, dt) => (a.weeklyLord && a.lordWaiting ? undefined : kt(world, a, dt));
}
function lordKill(game, w, m) {
  const pr = game.profile, W = weeklyState(pr), z = m.lordZone || 0, Z = ZONES[z];
  W.done = true; seasonGain(game, SEASON.pts.lord);
  const tier = Math.min(9, Z.ranks[1] + 1), gold = Math.round(3000 * Math.pow(z + 1, 1.4));
  game.pickup({ kind: 'card', item: makeCard(pick(Z.mobs.filter(id => D.monsters[id])), tier) });
  game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), tier, pr.cls) });
  pr.gold = (pr.gold || 0) + gold; pr.coins = (pr.coins || 0) + 15; game.gainExp(Math.round(expNeed(pr.lv || 1) * 1.5));
  w.flash = { t: 0, dur: 900, col: '#ffe9a8' };
  game.toast(`◉ BLACK HOLE LORD DEFEATED — a rank ${RANKS[tier]} card and gear, ${gold} G, 15 coins. It returns next week.`, '#ffd23f');
  game.save();
}

// ---------------------------------------------------------------- the attendance board
// pr.login.streak is the last day claimed. Each week of the board pays more than the last, and day 28 is a card a rank up.
const LOGIN_DAYS = 28, LOGIN_WEEK = [1, 1.25, 1.5, 2];
const LB = { x: 26, y: 42, w: 588, h: 298, page: { x: 36, y: 50, w: 568, h: 282 }, tw: 78, th: 54, gapX: 3, gapY: 3, stampMs: 240, btn: { x: 504, y: 289, w: 92, h: 30 } };
const lbTile = day => { const i = day - 1; return { x: LB.page.x + 2 + (i % 7) * (LB.tw + LB.gapX), y: LB.page.y + 2 + Math.floor(i / 7) * (LB.th + LB.gapY), w: LB.tw, h: LB.th }; };
function loginGift(pr, day) {
  const G = LOGIN_GIFTS[(day - 1) % 7], k = LOGIN_WEEK[Math.floor((day - 1) / 7)], top = day === LOGIN_DAYS;
  return { coins: Math.round(G.coins * k), gold: Math.round(G.gold * k), card: G.card, tier: Math.min(9, ZONES[storyZone(pr)].ranks[1] + (top ? 1 : 0)), top };
}
function loginTick(game, w) {
  const pr = game.profile; pr.login = pr.login || { last: null, streak: 0 };
  if (pr.login.last === dayNo() || game.menu || !w.player) return;
  game.openMenu({ type: 'login', day: (pr.login.streak || 0) % LOGIN_DAYS + 1, t: 0, stamp: null, got: '', sparks: [] });
}
function loginClaim(game, m) {
  const pr = game.profile, G = loginGift(pr, m.day), z = storyZone(pr), T = lbTile(m.day);
  pr.login = { last: dayNo(), streak: m.day }; seasonGain(game, SEASON.pts.login);
  pr.coins = (pr.coins || 0) + G.coins; pr.gold = (pr.gold || 0) + G.gold;
  const c = G.card ? makeCard(pick(ZONES[z].mobs.filter(id => D.monsters[id])), G.tier) : null;
  if (c) game.pickup({ kind: 'card', item: c });
  m.got = `+${G.coins} coins · +${G.gold} G${c ? ` · ${RANKS[c.tier]} ${cardName(c)}` : ''}`; m.stamp = 0;
  for (let i = 0; i < 26; i++) { const an = Math.random() * Math.PI * 2, sp = rand(30, 130); m.sparks.push({ x: T.x + T.w / 2, y: T.y + T.h / 2, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, t: 0, life: rand(300, 650), col: i % 3 ? '#ffd25a' : '#ffffff' }); }
  if (typeof SFX !== 'undefined' && SFX.smite) SFX.smite();
  game.save();
}
function updateLoginBoard(game, m, dt) {
  m.t += dt;
  for (const s of m.sparks) { s.t += dt; s.x += s.vx * dt / 1000; s.y += s.vy * dt / 1000; }
  m.sparks = m.sparks.filter(s => s.t < s.life);
  const B = LB.btn, T = lbTile(m.day), press = hit(...KEYS_OK, 'Space') || clicked(B.x, B.y, B.w, B.h);
  if (m.stamp == null) { if (m.t > 200 && (press || clicked(T.x, T.y, T.w, T.h))) loginClaim(game, m); return; }
  m.stamp += dt;
  if (m.stamp > 400 && (press || hit(...KEYS_BACK))) game.closeMenu();
}
// a claimed day: the tile goes dark under a red stamp with a gold tick
function drawLoginStamp(T, k = 1) {
  const cx = T.x + T.w / 2, cy = T.y + T.h / 2 + 1, s = 1 + (1 - k) * 1.6;
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.4); ctx.translate(cx, cy); ctx.rotate(-0.22); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(120,16,24,0.82)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.4); text('✓', cx, cy, '#ffe9a8', 14 * s); ctx.restore();
}
function drawLoginTile(pr, m, day, now) {
  const T = lbTile(day), G = loginGift(pr, day), today = day === m.day, claimed = day < m.day || (today && m.stamp != null), big = G.card, open = today && !claimed;
  ctx.save(); if (open) { ctx.shadowColor = '#ffcc4a'; ctx.shadowBlur = (5 + 3 * Math.sin(now / 200)) * RES; }
  const g = ctx.createLinearGradient(0, T.y, 0, T.y + T.h); g.addColorStop(0, open ? '#5a4a28' : big ? '#523622' : '#422c1c'); g.addColorStop(1, open ? '#2a2214' : '#24180f');
  ctx.fillStyle = g; rrect(ctx, T.x, T.y, T.w, T.h, 4); ctx.fill(); ctx.restore();
  ctx.strokeStyle = open ? '#ffd860' : big ? goldFrameGrad(T.y, T.h) : '#4a5468'; ctx.lineWidth = open ? 1.5 : 0.9; rrect(ctx, T.x + 0.5, T.y + 0.5, T.w - 1, T.h - 1, 4); ctx.stroke();
  petInk(`DAY ${day}`, T.x + 6, T.y + 8, open ? '#ffe9a8' : '#c8d0e0', 7.5);
  coinIcon(T.x + 11, T.y + 26, 12); petInk(`×${G.coins}`, T.x + 19, T.y + 26.5, '#ffd23f', 8);
  petInk(`${G.gold} G`, T.x + 6, T.y + 43, '#f0e6d2', 7.5);
  if (big) {   // the card waiting on this day: face down, in its rank's colour
    const x = T.x + T.w - 25, y = T.y + 9, col = G.top ? rankColor(G.tier, now) : rankColor(G.tier, 0), solid = rankSolid(G.tier);
    ctx.fillStyle = '#302014'; rrect(ctx, x, y, 19, 26, 2.5); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, 18, 25, 2.5); ctx.stroke();
    text('?', x + 9.5, y + 12.5, solid, 11); petInk(RANKS[G.tier], x + 9.5, y + 33, solid, 7, 'center');
  }
  if (claimed) {
    ctx.fillStyle = 'rgba(6,8,14,0.6)'; rrect(ctx, T.x, T.y, T.w, T.h, 4); ctx.fill();
    drawLoginStamp(T, today ? Math.min(1, m.stamp / LB.stampMs) : 1);
  }
}
function drawLoginBoard(game, m, now) {
  const pr = game.profile, G = loginGift(pr, m.day), B = LB.btn, done = m.stamp != null;
  ctx.fillStyle = 'rgba(8,6,14,0.74)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle('DAILY ATTENDANCE', VW / 2, 22, 17, now);
  drawIronFrame(LB); drawSlatePage(LB.page);
  for (let d = 1; d <= LOGIN_DAYS; d++) drawLoginTile(pr, m, d, now);
  const x = LB.page.x + 8, y = B.y + 8;
  drawPix(pixText(done ? `DAY ${m.day} CLAIMED` : `TODAY: DAY ${m.day} OF ${LOGIN_DAYS}`, fontPx(10), 700, ['#fff6c8', '#ffd25a', '#d08a20'], '#2a1206'), x, y, 'left');
  petInk(done ? m.got : `+${G.coins} coins · +${G.gold} G${G.card ? ` · a rank ${RANKS[G.tier]} card` : ''}`, x, y + 14, done ? '#8fffb0' : '#f0e6d2', 8, 'left', false);
  popupButton({ ...B, label: done ? 'CLOSE' : 'CLAIM', primary: !done, col: '#ffd860' }, now);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of m.sparks) { ctx.globalAlpha = 1 - s.t / s.life; ctx.fillStyle = s.col; ctx.fillRect(s.x, s.y, 1.6, 1.6); }
  ctx.restore();
  text(done ? 'Enter: close · Come back tomorrow for the next day' : 'Enter / click: claim · A missed day costs nothing', VW / 2, LB.y + LB.h + 10, '#ffe9d8', 7.5);
}

// each world frame (main.js): the gift, then the Lord
function dailyTick(game, w) {
  const pr = game.profile; if (!pr || !w.overworld) return;
  dailyState(pr); seasonTick(game); collectionTick(game); siteTick(game, w); animalsTick(game, w); nodesTick(game, w); totemTick(w); loginTick(game, w); weeklyTick(game, w);
}
// the tracker: the daily contracts under the main quest (quests.js drawQuestTracker)
function drawDailyTracker(game, y) {
  const pr = game.profile; if (!pr || !pr.daily) return y;
  y = tentTracker(game, treeTracker(game, sqTracker(game, wellTracker(game, y))));
  if (trialsOpen(pr)) { const S = trialState(pr), n = trialCount(S); text(`☀ Trial ${S.tier}: ${n < 4 ? `${n}/4 Guardians` : 'the Sovereign awaits'}`, VW - 8, y, '#ffd23f', 7.5, 'right'); y += 11; }
  if (typeof unlocked === 'function' && !unlocked(pr, 'season')) return y;   // (the daily contracts wait for the SEASON & DAILY unlock: a new hero's first goal stands alone; they still count meanwhile)
  const D2 = pr.daily, left = D2.list.filter(c => !c.done), done = D2.list.length - left.length;
  if (!left.length) { text(`☀ Daily contracts ${done}/${D2.list.length} ✔`, VW - 8, y, '#ffe08a', 7, 'right'); return y + 12; }
  text(`☀ Daily contracts ${done}/${D2.list.length}`, VW - 8, y, '#ffe08a', 7.5, 'right');
  text(`${left[0].text} ${left[0].have}/${left[0].need}`, VW - 8, y + 10, '#fff4d8', 6.6, 'right');
  return y + 22;
}
