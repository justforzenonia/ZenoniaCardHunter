'use strict';
// Quests. The Quest Master by the fountain keeps a bounty board of 4 offers; take up to 3 at once. Progress is
// tracked as you play (a tracker sits on the right of the screen, like the original game's quest list) and
// finished quests are handed in at the Quest Master for EXP, summon coins and a card or piece of gear.

const QUESTS = { board: 4, active: 3 };

function questState(pr) {
  if (!pr.quests) pr.quests = { board: [], active: [], done: 0 };
  while (pr.quests.board.length < QUESTS.board) pr.quests.board.push(makeQuest(pr));
  return pr.quests;
}
function makeQuest(pr) {
  const maxZ = Math.min(ZONES.length - 1, Math.floor(((pr.lv || 1) - 1) / 5));
  const z = randi(0, maxZ), Z = ZONES[z], mobs = Z.mobs.filter(id => D.monsters[id]);
  const kind = pick(['kill', 'kill', 'zone', 'rank', 'cards', 'chest', 'cave', 'rift', 'layer', 'combo']);
  let q, n, mult;
  switch (kind) {
    case 'kill': { const sp = pick(mobs); n = randi(5, 10); mult = n * 1.6;
      q = { type: 'kill', sp, title: `Hunt: ${SPECIES[sp].name}`, desc: `Defeat ${n} ${SPECIES[sp].name} in ${Z.name}.`, line: `Defeat ${SPECIES[sp].name}` }; break; }
    case 'zone': n = randi(12, 24); mult = n * 1.2;
      q = { type: 'zone', title: `Clear ${Z.name}`, desc: `Defeat ${n} monsters anywhere in ${Z.name}.`, line: `Monsters in ${Z.name}` }; break;
    case 'rank': { const tier = Z.ranks[1]; n = randi(3, 6); mult = n * 3;
      q = { type: 'rank', tier, title: 'Elite Bounty', desc: `Defeat ${n} monsters of rank ${RANKS[tier]} or higher.`, line: `Rank ${RANKS[tier]}+ monsters` }; break; }
    case 'cards': n = randi(3, 6); mult = 18;
      q = { type: 'cards', title: 'Card Collector', desc: `Pick up ${n} monster cards.`, line: 'Cards picked up' }; break;
    case 'chest': n = randi(1, 2); mult = 28;
      q = { type: 'chest', title: 'Treasure Hunter', desc: `Open ${n} treasure chest${n > 1 ? 's' : ''} in the Wilds (look for the gold beam).`, line: 'Chests opened' }; break;
    case 'cave': n = 1; mult = 60;
      q = { type: 'cave', title: 'Rift Diver', desc: 'Defeat the boss inside a black hole.', line: 'Black hole boss defeated' }; break;
    case 'rift': n = 1; mult = 60;
      q = { type: 'rift', title: 'Survivor', desc: 'Survive a Survival Rift (a trapped treasure chest).', line: 'Rift survived' }; break;
    case 'layer': n = randi(2, 4); mult = 24;
      q = { type: 'layer', title: 'Layer Adept', desc: `Fire ${n} LAYERED skills (transcend, pick cards, LAYER again).`, line: 'LAYERED skills' }; break;
    default: n = randi(12, 24); mult = 22;
      q = { type: 'combo', title: 'Juggler', desc: `Land a ${n}-hit combo.`, line: 'Best combo' }; break;
  }
  const hard = ['cave', 'rift', 'rank'].includes(kind);
  return Object.assign(q, {
    id: Math.random().toString(36).slice(2, 9), zone: z, need: n, have: 0, done: false,
    reward: { exp: Math.round(killExp(Z.ranks[1]) * mult), coins: hard ? 3 : 1, item: Math.random() < 0.5 ? 'card' : 'gear', tier: Math.min(9, Z.ranks[1] + (hard ? 1 : 0)) },
  });
}
const rewardText = r => `${r.exp} EXP · ${r.coins} coin${r.coins > 1 ? 's' : ''} · ${RANKS[r.tier]} ${r.item}`;

// progress events from the game
function questEvent(game, type, info = {}) {
  if (!game || game.scene !== 'world' || !game.profile) return;
  dailyEvent(game, type, info);   // the daily contracts hear the same events (daily.js)
  seasonEvent(game, type);   // and so does the season bar (season.js)
  wellEvent(game, type, info);    // and so does the well quest (wellquest.js)
  sqEvent(game, type, info);      // and the side quests (sidequests.js)
  treeEvent(game, type, info);    // and the tree folk's favours
  tentEvent(game, type);          // and the camps'
  const Q = questState(game.profile);
  for (const q of Q.active) {
    if (q.done) continue;
    let inc = 0;
    if (type === 'kill') {
      if (q.type === 'kill' && info.sp === q.sp) inc = 1;
      else if (q.type === 'zone' && info.zone === q.zone) inc = 1;
      else if (q.type === 'rank' && info.tier >= q.tier) inc = 1;
    } else if (type === 'combo' && q.type === 'combo') { q.have = Math.max(q.have, info.n || 0); }
    else if (type === q.type) inc = 1;
    q.have = Math.min(q.need, q.have + inc);
    if (q.have >= q.need) {
      q.done = true;
      game.toast(`Quest complete: ${q.title}! Hand it in at the Quest Master`, '#6ae0ff');
      game.save();
    }
  }
}
function claimQuest(game, q) {
  const pr = game.profile, Q = questState(pr), Z = ZONES[q.zone];
  Q.active = Q.active.filter(x => x !== q); Q.done++;
  pr.coins = (pr.coins || 0) + q.reward.coins;
  if (q.reward.item === 'card') game.pickup({ kind: 'card', item: makeCard(pick(Z.mobs.filter(id => D.monsters[id])), q.reward.tier) });
  else game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), q.reward.tier, pr.cls) });
  game.gainExp(q.reward.exp);
  game.toast(`Reward: ${rewardText(q.reward)}`, '#ffd23f');
  game.save();
}

// ---------------------------------------------------------------- the quest board screen
function questMenu() { return { type: 'quest', t: 0 }; }
const QB = { x: 40, y: 34, w: 560, h: 300 };
const qOffer = i => ({ x: QB.x + 16, y: QB.y + 44 + i * 58, w: 262, h: 52 });
const qActive = i => ({ x: QB.x + 290, y: QB.y + 44 + i * 74, w: 254, h: 68 });
const qBtn = (R, k = 0) => ({ x: R.x + R.w - 64 - k * 66, y: R.y + R.h - 18, w: 58, h: 14 });
const QUEST_REROLL_FOOD = 5;   // refreshing the board costs food
const QREROLL = { x: QB.x + 16, y: QB.y + QB.h - 26, w: 120, h: 16 };
function updateQuestMenu(game, m, dt) {
  m.t += dt;
  const pr = game.profile, Q = questState(pr);
  if (hit('Escape') || (m.t > 200 && hit('KeyJ'))) { game.closeMenu(); return; }
  Q.board.forEach((q, i) => {
    if (!clicked(...Object.values(qBtn(qOffer(i))))) return;
    if (Q.active.length >= QUESTS.active) { game.toast(`You can carry ${QUESTS.active} quests at a time`, '#ff8a8a'); return; }
    Q.active.push(q); Q.board[i] = makeQuest(pr); game.toast(`Quest accepted: ${q.title}`, '#6ae0ff'); game.save();
  });
  Q.active.slice().forEach((q, i) => {
    const R = qActive(i);
    if (q.done && clicked(...Object.values(qBtn(R)))) claimQuest(game, q);
    else if (!q.done && clicked(...Object.values(qBtn(R)))) { Q.active = Q.active.filter(x => x !== q); game.toast('Quest abandoned', '#c9c1a8'); game.save(); }
  });
  if (clicked(QREROLL.x, QREROLL.y, QREROLL.w, QREROLL.h)) {   // new bounties cost food (the cheapest first)
    if (!payFood(pr, QUEST_REROLL_FOOD)) { game.toast(`New bounties cost ${QUEST_REROLL_FOOD} food — you carry ${edibleCount(pr)}`, '#ff8a8a'); return; }
    Q.board = Q.board.map(() => makeQuest(pr)); game.save(); game.toast(`New bounties posted (−${QUEST_REROLL_FOOD} food)`, '#ffe9a8');
  }
}
function qButton(B, label, col, now) {
  const hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
  const g = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
  g.addColorStop(0, hov ? '#a8742a' : '#8a5a1c'); g.addColorStop(1, hov ? '#5a3410' : '#3e240c');   // (a deep gold, so its bright label reads)
  ctx.fillStyle = g; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill();
  ctx.strokeStyle = hov ? '#fff0b0' : '#e8be64'; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 4); ctx.stroke();
  text(label, B.x + B.w / 2, B.y + B.h / 2 + 0.4, col || '#fff4d0', 7);
}
function drawQuestMenu(game, m, now) {
  const pr = game.profile, Q = questState(pr);
  ctx.fillStyle = 'rgba(6,4,12,0.78)'; ctx.fillRect(0, 0, VW, VH);
  // the board: a wooden frame around parchment
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 10 * RES; ctx.shadowOffsetY = 4 * RES;
  const wd = ctx.createLinearGradient(0, QB.y, 0, QB.y + QB.h); wd.addColorStop(0, '#7a4a22'); wd.addColorStop(1, '#4a2a12');
  ctx.fillStyle = wd; rrect(ctx, QB.x - 8, QB.y - 8, QB.w + 16, QB.h + 16, 8); ctx.fill(); ctx.restore();
  ctx.fillStyle = PARCH; rrect(ctx, QB.x, QB.y, QB.w, QB.h, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,30,0.5)'; ctx.lineWidth = 1; rrect(ctx, QB.x + 4, QB.y + 4, QB.w - 8, QB.h - 8, 3); ctx.stroke();
  goldTitle('QUEST MASTER', VW / 2, QB.y + 2, 13, now);
  ink('BOUNTY BOARD', QB.x + 16, QB.y + 30, INK, 9);
  ink(`YOUR QUESTS  ${Q.active.length}/${QUESTS.active}`, QB.x + 290, QB.y + 30, INK, 9);
  ink(`${Q.done} completed`, QB.x + QB.w - 16, QB.y + 30, INK_SOFT, 7, 'right', false);
  // offers: pinned notes
  Q.board.forEach((q, i) => {
    const R = qOffer(i);
    ctx.fillStyle = 'rgba(255,248,225,0.85)'; rrect(ctx, R.x, R.y, R.w, R.h, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,30,0.45)'; ctx.lineWidth = 0.8; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 3); ctx.stroke();
    ctx.fillStyle = '#b8301a'; ctx.beginPath(); ctx.arc(R.x + R.w / 2, R.y + 3, 2.6, 0, Math.PI * 2); ctx.fill();   // pin
    ink(q.title, R.x + 8, R.y + 10, '#1a5a8a', 8.5);
    ink(ZONES[q.zone].name, R.x + R.w - 8, R.y + 10, INK_SOFT, 6.5, 'right', false);
    inkWrap(q.desc, R.x + 8, R.y + 21, R.w - 16, 6.8, INK, 8.5);
    ink(rewardText(q.reward), R.x + 8, R.y + R.h - 10, '#8a5a14', 6.5, 'left', false);
    qButton(qBtn(R), 'Accept', null, now);
  });
  // active quests with progress
  for (let i = 0; i < QUESTS.active; i++) {
    const R = qActive(i), q = Q.active[i];
    ctx.fillStyle = q ? (q.done ? 'rgba(200,240,190,0.7)' : 'rgba(255,248,225,0.75)') : 'rgba(160,120,70,0.15)';
    rrect(ctx, R.x, R.y, R.w, R.h, 3); ctx.fill();
    if (!q) { ink('— free slot: accept a bounty —', R.x + R.w / 2, R.y + R.h / 2, 'rgba(90,60,30,0.55)', 7.5, 'center', false); continue; }
    ink(q.title, R.x + 8, R.y + 10, q.done ? '#2a7a2a' : '#1a5a8a', 8.5);
    inkWrap(q.desc, R.x + 8, R.y + 21, R.w - 16, 6.6, INK, 8.2);
    const k = q.have / q.need, by = R.y + 38;
    ctx.fillStyle = 'rgba(60,40,20,0.35)'; rrect(ctx, R.x + 8, by, R.w - 16, 7, 3); ctx.fill();
    ctx.fillStyle = q.done ? '#3cc84a' : '#3a8aff'; rrect(ctx, R.x + 8, by, (R.w - 16) * k, 7, 3); ctx.fill();
    text(`${q.have} / ${q.need}`, R.x + R.w / 2, by + 3.8, '#ffffff', 6);
    ink(rewardText(q.reward), R.x + 8, R.y + R.h - 10, '#8a5a14', 6.5, 'left', false);
    qButton(qBtn(R), q.done ? 'Claim!' : 'Abandon', q.done ? '#a8ff9a' : '#ffb0a0', now);
  }
  qButton(QREROLL, `↻ New bounties · ${QUEST_REROLL_FOOD} food`, null, now);
  text('Click Accept / Claim · Esc: close', VW / 2, QB.y + QB.h + 18, '#c9c1a8', 7.5);
}

// tracker on the right side of the screen (like the original's quest list)
// THE SIDE LIST'S BAND: the daily contracts, side quests and travellers' quests under the story tracker sit on the same soft
// dark band (chapters.js): the lines are gathered first, the band is sized to them, then they are written over it
function drawQuestTracker(game, now) {
  const calls = [], t0 = text;
  text = (...a) => { calls.push(a); };
  try { drawQuestTrackerLines(game, now); } finally { text = t0; }
  const rows = calls.filter(a => a[0] && a[2] != null); if (!rows.length) return;
  let top = Infinity, bot = -Infinity, wid = 0;
  for (const [str, , y, , size = 10] of rows) { top = Math.min(top, y - size * 0.7); bot = Math.max(bot, y + size * 0.6); wid = Math.max(wid, textW(String(str), size)); }
  const bw = wid + 34, bx = VW - bw, y0 = Math.max(top - 3, typeof storyTrackerH === 'function' && storyTrackerH(game) ? 46 : 0), h = bot + 3 - y0;   // (it starts where the story tracker's band ends, so the two join without a darker overlap)
  const bg = ctx.createLinearGradient(bx, 0, VW, 0); bg.addColorStop(0, 'rgba(46,28,18,0)'); bg.addColorStop(0.35, 'rgba(46,28,18,0.45)'); bg.addColorStop(1, 'rgba(46,28,18,0.58)');
  ctx.fillStyle = bg; ctx.fillRect(bx, y0, bw, h);
  const gl = ctx.createLinearGradient(bx + bw * 0.3, 0, VW, 0); gl.addColorStop(0, 'rgba(232,190,100,0)'); gl.addColorStop(1, 'rgba(232,190,100,0.5)');
  ctx.fillStyle = gl; ctx.fillRect(bx + bw * 0.3, y0 + h - 0.7, bw * 0.7, 0.7);
  for (const a of calls) t0(...a);
}
function drawQuestTrackerLines(game, now) {
  const pr = game.profile; if (!pr) return;
  let y = drawDailyTracker(game, 22 + storyTrackerH(game) + 2);   // (under the main quest, chapters.js; then the daily contracts, daily.js)
  for (const q of pr.quests ? pr.quests.active : []) {
    text(q.title, VW - 8, y, q.done ? '#ffd23f' : '#6ae0ff', 8, 'right');
    text(q.done ? '✔ Return to the Quest Master' : `${q.line} ${q.have}/${q.need}`, VW - 8, y + 10, q.done ? '#ffe9a8' : '#ffffff', 7, 'right');
    y += 24;
  }
  for (const q of pr.holeQuests || []) {   // the travellers' black hole quests
    text('◉ ' + q.title, VW - 8, y, '#c890ff', 8, 'right');
    text(q.line, VW - 8, y + 10, '#e8dcff', 7, 'right');
    y += 24;
  }
}
