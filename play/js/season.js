'use strict';
// THE SEASON: 28 real days from the day you first see it, with one bar that nearly everything you do fills. Fights, daily
// contracts, attendance, the Black Hole Lord, harvests and farm orders all count, so a quiet day on the farm still moves
// it. Each tier holds a reward: the 5th an Old Bone (pet.js), the 30th a top-rank card. Kills and ordinary harvests are capped each day, so steady
// play across the month reaches tier 30 and one long session doesn't. Open it with P or the pill at the bottom left.
// Each of the four weeks has a theme (SEASON_WEEKS): one element hits harder, the Grocer sells that week's seed, and its
// meal prepares you for that week's Black Hole Lord.
// Any harvest can turn up a PRIZE CROP with a score out of 100, and your best one is judged at the HARVEST FESTIVAL when
// the season ends.
// pr.season = { no, start, pts, got, day, kills, farm, week, prize: { crop, score } }: got is the highest tier claimed.
const SEASON = {
  days: 28, tiers: 30, per: 200, capKills: 120, capFarm: 80,
  pts: { kill: 1, chest: 5, cave: 30, rift: 30, login: 20, contract: 25, order: 15, harvest: 3, moonflower: 60, dragonfruit: 150, lord: 150 },
  page: { x: 36, y: 50, w: 568, h: 282 }, frame: { x: 26, y: 42, w: 588, h: 298 }, tw: 54, th: 58, gap: 2,
  btn: { x: 504, y: 289, w: 92, h: 30 }, pill: { x: 6, y: VH - 76, w: 74, h: 16 },
};
const SEASON_WEEKS = [
  { name: 'Frost Week', el: 'ice', col: '#7fd6ff', crop: 'frostberry', seed: 'seed_frostberry', meal: 'froststew', lord: 'Frost Lord', mate: 'wheat' },
  { name: 'Ember Week', el: 'fire', col: '#ff7a2f', crop: 'emberroot', seed: 'seed_emberroot', meal: 'embercurry', lord: 'Ember Lord', mate: 'meat' },
  { name: 'Storm Week', el: 'lightning', col: '#c8a0ff', crop: 'stormcorn', seed: 'seed_stormcorn', meal: 'stormloaf', lord: 'Storm Lord', mate: 'wheat' },
  { name: 'Gale Week', el: 'wind', col: '#8fe8a0', crop: 'galeleaf', seed: 'seed_galeleaf', meal: 'galetart', lord: 'Gale Lord', mate: 'berry' },
];
const PRIZE = { chance: 0.08, rareChance: 0.35, rare: 30, roll: 60, farmLv: 0.5, grades: [[80, 'Golden', 50], [50, 'Giant', 25], [0, 'Big', 10]] };
const prizeGrade = score => PRIZE.grades.find(g => score >= g[0]);
const prizeName = P => `${prizeGrade(P.score)[1]} ${ITEMS[P.crop].name}`;
const SEASON_BONUS = { el: 1.5, lordHit: 2, lordGuard: 0.5 };
// a week's crop takes one real day, like the rare crops (home.js), and its meal is for you to choose, not Auto Feast
for (const [i, [cropName, seedName, mealName, fxName, fx]] of [
  ['Frostberry', 'Frostberry Seeds', 'Frostberry Stew', 'Frostbound', { hp: 0.3, guard: 0.7 }],
  ['Emberroot', 'Emberroot Seeds', 'Emberroot Curry', 'Kindled', { atk: 0.4, crit: 10 }],
  ['Stormcorn', 'Stormcorn Seeds', 'Stormcorn Loaf', 'Charged', { spell: 1.5, mpr: 2 }],
  ['Galeleaf', 'Galeleaf Seeds', 'Galeleaf Tart', 'Windswept', { speed: 1.3, crit: 15 }],
].entries()) {
  const W = SEASON_WEEKS[i], ic = 34 + i * 3;
  ITEMS[W.crop] = { name: cropName, icon: ic, kind: 'rare', hunger: 0, sell: 100, desc: `Only sold in ${W.name}. Too rare to eat raw: cook it.` };
  ITEMS[W.seed] = { name: seedName, icon: ic + 1, kind: 'seed', crop: W.crop, price: 300, sell: 60, desc: `1 real day · only sold in ${W.name} · 3–4 crops.` };
  ITEMS[W.meal] = { name: mealName, icon: ic + 2, kind: 'meal', hunger: 60, sell: 300, desc: `Eat it before facing the ${W.lord}.` };
  CROPS[W.crop] = { grow: 864e5, yield: [3, 4], col: W.col, long: true, xp: 50 };
  MEAL_FX[W.meal] = { slot: 'meal', name: fxName, dur: 1200000, rare: true, ...fx };
  RECIPES.push({ out: W.meal, n: 1, need: { [W.crop]: 2, [W.mate]: 2 } });
}
let seasonWk = null;   // this week's theme, set each frame (seasonTick)
const seasonWeekNo = S => Math.min(3, Math.floor((dayNo() - S.start) / 7));
const seasonWeek = pr => SEASON_WEEKS[seasonWeekNo(seasonState(pr))];
// the week's element hits harder for you, and with the week's meal in you, its Lord takes double and deals half
function seasonDamage(att, def, opts) {
  const W = seasonWk; if (!W || (window.GAME && GAME.scene === 'arena')) return 1;
  let k = att.kind === 'player' && opts.el === W.el ? SEASON_BONUS.el : 1;
  if (att.weeklyLord || def.weeklyLord) { const M = GAME.profile && GAME.profile.meal; if (M && M.id === W.meal && M.ms > 0) k *= def.weeklyLord ? SEASON_BONUS.lordHit : SEASON_BONUS.lordGuard; }
  return k;
}
function seasonState(pr) {
  const today = dayNo(); let S = pr.season;
  if (!S) S = pr.season = { no: 1, start: today, pts: 0, got: 0, day: today, kills: 0, farm: 0 };
  if (S.day !== today) { S.day = today; S.kills = 0; S.farm = 0; }
  return S;
}
const seasonTier = S => Math.min(SEASON.tiers, Math.floor(S.pts / SEASON.per));
const seasonDaysLeft = S => Math.max(0, SEASON.days - (dayNo() - S.start));
// tier 30 a top-rank card; every tenth a Dragonfruit seed and a card, every fifth a Moonflower seed and a card; otherwise
// coins and gold in turn
function seasonReward(pr, t) {
  const rank = ZONES[storyZone(pr)].ranks[1];
  if (t === SEASON.tiers) return { coins: 100, card: 9 };
  if (t % 10 === 0) return { item: 'seed_dragonfruit', card: Math.min(9, rank + 1) };
  if (t === 5 && !pr.drake) return { egg: true, card: rank };
  if (t % 5 === 0) return { item: 'seed_moonflower', card: rank };
  return t % 2 ? { gold: 500 + t * 100 } : { coins: 4 + Math.floor(t / 3) };
}
function seasonPay(game, t) {
  const pr = game.profile, R = seasonReward(pr, t);
  if (R.coins) pr.coins = (pr.coins || 0) + R.coins;
  if (R.gold) pr.gold = (pr.gold || 0) + R.gold;
  if (R.item) addItem(pr, R.item, 1);
  if (R.egg) giveDrakeEgg(game);
  if (R.card != null) game.pickup({ kind: 'card', item: makeCard(pick(ZONES[storyZone(pr)].mobs.filter(id => D.monsters[id])), R.card) });
}
function seasonClaim(game) {
  const pr = game.profile, S = seasonState(pr), top = seasonTier(S), from = S.got; if (top <= from) return 0;
  for (let t = from + 1; t <= top; t++) seasonPay(game, t);
  S.got = top; game.save();
  return top - from;
}
// a finished season pays what was left unclaimed, then the next one starts
function seasonTick(game) {
  const pr = game.profile, S = seasonState(pr), wk = seasonWeekNo(S); seasonWk = SEASON_WEEKS[wk];
  if (S.week !== wk) { S.week = wk; game.toast(`${seasonWk.name}! ${ELEMENTS[seasonWk.el].name} hits ${Math.round((SEASON_BONUS.el - 1) * 100)}% harder · the Grocer has ${ITEMS[seasonWk.seed].name}`, seasonWk.col); }
  if (dayNo() - S.start < SEASON.days) return;
  const n = seasonClaim(game), fest = seasonFestival(game, S);
  pr.season = { no: S.no + 1, start: dayNo(), pts: 0, got: 0, day: dayNo(), kills: 0, farm: 0 };
  game.toast(`Season ${S.no} is over${n ? ` · ${n} rewards collected` : ''}${fest} · Season ${S.no + 1} begins!`, '#ffd23f'); game.save();
}
function seasonGain(game, n, cap) {
  const pr = game.profile; if (!pr) return;
  const S = seasonState(pr), was = seasonTier(S);
  if (cap) { const lim = SEASON[cap === 'kills' ? 'capKills' : 'capFarm']; n = Math.min(n, lim - S[cap]); if (n <= 0) return; S[cap] += n; }
  S.pts += n; const now = seasonTier(S);
  if (now > was) game.toast(`SEASON TIER ${now} reached! Claim it with P`, '#ffd25a');
}
// the same events the Guild's quests hear (quests.js questEvent)
function seasonEvent(game, type) {
  const P = SEASON.pts;
  if (type === 'kill') seasonGain(game, P.kill, 'kills'); else if (P[type] && type !== 'login') seasonGain(game, P[type]);
}
function seasonHarvest(game, crop) {
  const long = CROPS[crop].long, pr = game.profile;
  if (long) seasonGain(game, SEASON.pts[crop] || SEASON.pts.harvest); else seasonGain(game, SEASON.pts.harvest, 'farm');
  if (Math.random() >= (long ? PRIZE.rareChance : PRIZE.chance)) return;
  const S = seasonState(pr), score = Math.min(100, randi(1, PRIZE.roll) + (long ? PRIZE.rare : 0) + Math.floor(farmer(pr).lv * PRIZE.farmLv)), P = { crop, score }, best = !S.prize || score > S.prize.score;
  if (best) S.prize = P;
  game.toast(`PRIZE CROP! ${prizeName(P)}, scored ${score}${best ? ' · your best this season' : ` · your best is ${S.prize.score}`}`, '#ffd25a');
}
// when the season ends, the best prize crop is judged: more coins for a better grade, and a card a rank up for Golden
function seasonFestival(game, S) {
  if (!S.prize) return ''; const pr = game.profile, [, name, coins] = prizeGrade(S.prize.score), top = name === 'Golden';
  pr.coins = (pr.coins || 0) + coins;
  if (top) game.pickup({ kind: 'card', item: makeCard(pick(ZONES[storyZone(pr)].mobs.filter(id => D.monsters[id])), Math.min(9, ZONES[storyZone(pr)].ranks[1] + 1)) });
  return ` · Harvest Festival: ${prizeName(S.prize)} wins ${coins} coins${top ? ' and a card' : ''}`;
}
function seasonMenu() { return { type: 'season', t: 0 }; }
function updateSeason(game, m, dt) {
  m.t += dt; const B = SEASON.btn, S = seasonState(game.profile), can = seasonTier(S) > S.got;
  if (m.t > 150 && hit(...KEYS_BACK, 'KeyP')) { game.closeMenu(); return; }
  if (!(m.t > 150 && (hit(...KEYS_OK, 'Space') || clicked(B.x, B.y, B.w, B.h)))) return;
  if (!can) { game.closeMenu(); return; }
  seasonClaim(game); m.flash = 400;
  if (typeof SFX !== 'undefined' && SFX.smite) SFX.smite();
}
function drawSeasonTile(pr, S, t, now) {
  const C = SEASON, i = t - 1, T = { x: C.page.x + 6 + (i % 10) * (C.tw + C.gap), y: C.page.y + 6 + Math.floor(i / 10) * (C.th + C.gap), w: C.tw, h: C.th };
  const top = seasonTier(S), R = seasonReward(pr, t), claimed = t <= S.got, ready = !claimed && t <= top, big = R.card != null, cx = T.x + T.w / 2;
  ctx.save(); if (ready) { ctx.shadowColor = '#ffcc4a'; ctx.shadowBlur = (5 + 3 * Math.sin(now / 200)) * RES; }
  const g = ctx.createLinearGradient(0, T.y, 0, T.y + T.h); g.addColorStop(0, ready ? '#5a4a28' : big ? '#523622' : '#422c1c'); g.addColorStop(1, ready ? '#2a2214' : '#24180f');
  ctx.fillStyle = g; rrect(ctx, T.x, T.y, T.w, T.h, 4); ctx.fill(); ctx.restore();
  ctx.strokeStyle = ready ? '#ffd860' : big ? goldFrameGrad(T.y, T.h) : '#6a5440'; ctx.lineWidth = ready ? 1.5 : 0.9; rrect(ctx, T.x + 0.5, T.y + 0.5, T.w - 1, T.h - 1, 4); ctx.stroke();
  petInk(`${t}`, T.x + 5, T.y + 7.5, ready ? '#ffe9a8' : '#c8d0e0', 7.5);
  const cy = T.y + 27;
  if (R.card != null) {   // a face-down card, with the seed beside it
    const x = cx - (R.item || R.egg ? 17 : 9), col = t === C.tiers ? rankColor(9, now) : rankSolid(R.card);
    ctx.fillStyle = '#302014'; rrect(ctx, x, cy - 13, 18, 26, 2.5); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, cy - 12.5, 17, 25, 2.5); ctx.stroke();
    text('?', x + 9, cy, rankSolid(R.card), 11);
    if (R.egg) drawDrakeEgg(cx + 12, cy, 0.7); else if (R.item) iconCentered('items', itemIcon(R.item), cx + 12, cy, 18);
    petInk(R.item || R.egg ? RANKS[R.card] : `${RANKS[R.card]} · ×${R.coins}`, cx, T.y + T.h - 7, rankSolid(R.card), 7, 'center');
  } else if (R.coins) { coinIcon(cx, cy, 16); petInk(`×${R.coins}`, cx, T.y + T.h - 7, '#ffd23f', 8, 'center'); }
  else { iconCentered('items', homeIcon(21), cx, cy, 16); petInk(`${R.gold} G`, cx, T.y + T.h - 7, '#f0e6d2', 7.5, 'center'); }
  if (claimed) { ctx.fillStyle = 'rgba(6,8,14,0.6)'; rrect(ctx, T.x, T.y, T.w, T.h, 4); ctx.fill(); drawLoginStamp(T); }
}
function drawSeason(game, m, now) {
  const C = SEASON, pr = game.profile, S = seasonState(pr), top = seasonTier(S), B = C.btn, can = top > S.got, full = top >= C.tiers, k = full ? 1 : (S.pts % C.per) / C.per, days = seasonDaysLeft(S);
  ctx.fillStyle = 'rgba(8,6,14,0.74)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle(`SEASON ${S.no}`, VW / 2, 22, 17, now);
  drawIronFrame(C.frame); drawSlatePage(C.page);
  for (let t = 1; t <= C.tiers; t++) drawSeasonTile(pr, S, t, now);
  const x = C.page.x + 8, by = B.y + 2, bw = 300, f = Math.max(0, bw - 2) * k;
  drawPix(pixText(`TIER ${top} OF ${C.tiers}`, fontPx(10), 700, ['#fff6c8', '#ffd25a', '#d08a20'], '#2a1206'), x, by + 4, 'left');
  petInk(`${days} day${days === 1 ? '' : 's'} left`, x + bw, by + 4, '#c8d0e0', 8, 'right');
  ctx.fillStyle = '#160f09'; rrect(ctx, x, by + 12, bw, 8, 3); ctx.fill();
  const g = ctx.createLinearGradient(0, by + 12, 0, by + 20); g.addColorStop(0, '#fff0b8'); g.addColorStop(0.4, '#ffd25a'); g.addColorStop(1, '#a8681a');
  ctx.fillStyle = g; if (f > 0) { rrect(ctx, x + 1, by + 13, Math.max(4, f), 6, 2); ctx.fill(); }
  ctx.strokeStyle = '#7a6450'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, by + 12.5, bw - 1, 7, 3); ctx.stroke();
  const W = seasonWeek(pr), M = pr.meal, ready = M && M.id === W.meal && M.ms > 0, wy = C.page.y + 188;
  ctx.fillStyle = 'rgba(22,15,9,0.72)'; rrect(ctx, C.page.x + 6, wy, C.page.w - 12, 42, 4); ctx.fill(); ctx.strokeStyle = W.col; ctx.lineWidth = 1; rrect(ctx, C.page.x + 6.5, wy + 0.5, C.page.w - 13, 41, 4); ctx.stroke();
  iconCentered('items', itemIcon(W.crop), C.page.x + 26, wy + 21, 26);
  drawPix(pixText(`WEEK ${seasonWeekNo(S) + 1} · ${W.name.toUpperCase()}`, fontPx(10), 700, ['#ffffff', W.col, W.col], '#14100c'), C.page.x + 44, wy + 10, 'left');
  petInk(`${ELEMENTS[W.el].name} skills hit ${Math.round((SEASON_BONUS.el - 1) * 100)}% harder · plant ${ITEMS[W.seed].name} from the Grocer`, C.page.x + 44, wy + 23, '#f0e6d2', 7.5, 'left', false);
  petInk(`${ITEMS[W.meal].name}: the ${W.lord} takes double damage and deals half${ready ? ' · ACTIVE' : ''}`, C.page.x + 44, wy + 33, ready ? '#8fffb0' : '#c8d0e0', 7.5, 'left', false);
  petInk(full ? 'Every tier reached!' : `${S.pts % C.per} / ${C.per} to the next tier`, x, by + 28, '#f0e6d2', 7.5, 'left', false);
  petInk(S.prize ? `Best crop: ${prizeName(S.prize)} · ${S.prize.score}` : 'No prize crop yet', x + bw, by + 28, S.prize ? '#ffd27a' : '#9aa4b8', 7.5, 'right', false);
  popupButton({ ...B, label: can ? `CLAIM ${top - S.got}` : 'CLOSE', primary: can, col: '#ffd860' }, now);
  if (m.flash > 0) { m.flash -= 16; ctx.fillStyle = `rgba(255,236,170,${Math.max(0, m.flash / 400) * 0.35})`; ctx.fillRect(0, 0, VW, VH); }
  text('Fights · contracts · attendance · harvests · farm orders · the Black Hole Lord all fill the bar', VW / 2, C.frame.y + C.frame.h + 10, '#ffe9d8', 7.5);
}
// the pill at the bottom left: your tier and a little bar, pulsing when a reward waits. Click it, or press P
function drawSeasonPill(game, now) {
  const C = SEASON, P = C.pill, pr = game.profile, w = game.world; if (!pr || !w || game.menu) return;
  const S = seasonState(pr), top = seasonTier(S), can = top > S.got, k = top >= C.tiers ? 1 : (S.pts % C.per) / C.per;
  ctx.save(); if (can) { ctx.shadowColor = '#ffcc4a'; ctx.shadowBlur = (4 + 3 * Math.sin(now / 200)) * RES; }   // (it glows while a tier waits)
  hudPill(P, '#e8be64', can ? 'P: CLAIM!' : `P: Tier ${top}`, can ? '#ffe9a8' : '#f0e6d2', P.y + 6); ctx.restore();   // (hud.js)
  // on a touch screen the left pills are not drawn (touch.js), so the bar would float alone across the joystick (2026-11-20)
  if (typeof TOUCH !== 'undefined' && TOUCH.on && P.x < 120 && game.scene === 'world') return;
  const bx = P.x + P.h - 1, bw = P.x + P.w - 5 - bx;   // (the progress line, beside the key badge)
  ctx.fillStyle = '#05030a'; ctx.fillRect(bx, P.y + 11.5, bw, 2); ctx.fillStyle = '#ffd25a'; ctx.fillRect(bx, P.y + 11.5, bw * k, 2);
}
