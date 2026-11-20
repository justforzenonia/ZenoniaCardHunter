'use strict';
// UNLOCKS: so a new hero isn't met by every system at once (FIRST_SESSION.md), the game's side systems open one at a time as
// the hero grows. Until something opens it is fully out of the way: its HUD pill or button is hidden, its keys do nothing, its
// tips wait, and its hub option is dimmed with the level it needs. When it opens, an UNLOCKED card says what it is and how to use it.
// The whole order lives in UNLOCKS below. A save from before this (a hero above Lv 3 with no unlock record) starts with everything.
const UNLOCKS = [
  { id: 'block',    lv: 3,  name: 'BLOCK',            how: 'Hold L to guard: it soaks blows from every side and deflects spells.', keys: [], tips: ['block', 'parry', 'gbreak'] },
  { id: 'workshop', lv: 4,  name: 'WORKSHOP',         how: 'Press Z (or the pill on the left) to craft gear from your materials.', keys: ['KeyZ'], tips: ['workshop'] },
  { id: 'log',      lv: 5,  name: 'LOG & TITLES',     how: 'X opens the game log; Y opens your titles, each with its own passives.', keys: ['KeyX', 'KeyY'], tips: ['gamelog'] },
  { id: 'summon',   lv: 6,  name: 'SUMMON',           how: 'Spend coins on new cards: SUMMON on the hub (H).', keys: [], tips: ['summon'] },
  { id: 'season',   lv: 6,  name: 'SEASON & DAILY',   how: 'P opens the season track; daily contracts (top right) and a gift reward each day you play.', keys: ['KeyP'], tips: ['season', 'claim', 'contracts'] },
  { id: 'layer',    lv: 8,  name: 'LAYER',            how: 'Press V to transcend: +40% power for a while, and layer your cards into one big spell.', keys: [], tips: ['layer', 'ki', 'kiready'] },
  { id: 'ranked',   lv: 10, name: 'RANKED ARENA',     how: 'The hub (H) now offers the Ranked Arena: climb ten leagues for coins, cards and gear.', keys: [], tips: [] },   // (online co-op is open from the start: friends can play together from their first minute)
  { id: 'tower',    lv: 15, name: 'ABYSS TOWER',      how: 'Press U to climb the Abyss Tower, floor by floor.', keys: ['KeyU'], tips: ['tower'] },
  { id: 'sets',     lv: 15, name: 'CARD SETS',        how: 'Press O to see card sets: collect a set for a lasting bonus.', keys: ['KeyO'], tips: ['sets'] },
];
const UNLOCK_BY = Object.fromEntries(UNLOCKS.map(u => [u.id, u]));
const UNLOCK_TIP = Object.fromEntries(UNLOCKS.flatMap(u => u.tips.map(t => [t, u.id])));
const UNLOCK_FX = { show: 4200, slide: 300 };
// the hero's unlock record (made on first look; an older hero above Lv 3 gets everything at once)
function unlocksOf(pr) {
  if (!pr) return null;
  if (!pr.unlocks) pr.unlocks = (pr.lv || 1) > 3 ? Object.fromEntries(UNLOCKS.map(u => [u.id, true])) : {};
  if (pr.unlocks.online && !pr.unlocks.ranked) pr.unlocks.ranked = true;   // (an older record: RANKED & ONLINE was one unlock)
  return pr.unlocks;
}
const unlocked = (pr, id) => { const U = unlocksOf(pr); return !U || !UNLOCK_BY[id] || !!U[id]; };
const unlockedHere = id => unlocked(window.GAME && GAME.profile, id);
function unlock(game, id) {
  const U = unlocksOf(game.profile); if (!U || U[id]) return;
  U[id] = true; (game.unlockQ = game.unlockQ || []).push(id); game.profile.unlockWait = UNLOCK_GAP;
  if (typeof logAdd === 'function') logAdd(game, `Unlocked: ${UNLOCK_BY[id].name}`, '#ffe08a');
  game.save();
}
// once a second in the world: the next system whose time has come opens, ONE at a time with 2.5 minutes of play between them.
// Early levels come fast (a new area's discovery bonus alone is Lv 3 within the first few areas), and several cards in a row
// were too much at once; the wait is kept on the hero, so a reload doesn't reset it. (BLOCK for a crowd still opens at once.)
const UNLOCK_GAP = 150000;
function unlockTick(game) {
  const pr = game.profile; if (!pr) return;
  pr.unlockWait = Math.max(0, (pr.unlockWait || 0) - 1000); if (pr.unlockWait > 0) return;
  const due = u => (pr.lv || 1) >= u.lv || (u.id === 'summon' && pr.cleared && Object.keys(pr.cleared).length) || (u.id === 'season' && (pr.day || 0) >= 2);   // (the first Guardian down; a second day played)
  const next = [...UNLOCKS].sort((a, b) => a.lv - b.lv).find(u => !unlocked(pr, u.id) && due(u));
  if (next) unlock(game, next.id);
}
// BLOCK also opens the first time a crowd gets at you: three blows inside four seconds
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const r = dd(world, att, def, opts), G = window.GAME;
    if (r && G && G.world === world && def === world.player && att && att.kind === 'monster' && !unlocked(G.profile, 'block')) {
      const now = performance.now(); def.crowdHits = (def.crowdHits || []).filter(t => now - t < 4000); def.crowdHits.push(now);
      if (def.crowdHits.length >= 3) unlock(G, 'block');
    }
    return r;
  };
}
// ---------------------------------------------------------------- the gates
// keys: a locked system's keys are taken out before the world screen reads them; its pill can't be clicked either
const UNLOCK_PILLS = () => [['season', SEASON.pill], ['tower', TOWER.pill], ['sets', SETS.pill], ['workshop', CRAFT.pill], ['log', GLOG.pill]];
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const G = window.GAME;
    if (G && G.profile && !G.menu) {
      for (const u of UNLOCKS) if (!unlocked(G.profile, u.id)) for (const k of u.keys) pressed.delete(k);
      if (mouse.click) for (const [id, R] of UNLOCK_PILLS()) if (R && !unlocked(G.profile, id) && mouse.x >= R.x && mouse.x < R.x + R.w && mouse.y >= R.y && mouse.y < R.y + R.h) mouse.click = false;
    }
    if (G && G.profile && (G.unlockScan = (G.unlockScan || 0) - dt) <= 0) { G.unlockScan = 1000; unlockTick(G); }
    return uw(dt);
  };
}
// the fight keys: no guard before BLOCK, no transcending before LAYER (main.js readPad, for your own hero and a co-op guest's)
{
  const rp = readPad;
  readPad = map => {
    const pad = rp(map), G = window.GAME;
    if (map === SOLO && G && G.profile && G.scene === 'world') { if (!unlocked(G.profile, 'block')) pad.block = false; if (!unlocked(G.profile, 'layer')) pad.layer = false; }
    return pad;
  };
}
// HUD pieces: drawn only once their system is open
for (const [fn, id] of [['drawSeasonPill', 'season'], ['drawTowerPill', 'tower'], ['drawSetsPill', 'sets'], ['drawCraftPill', 'workshop'], ['drawLogPill', 'log'], ['drawLogFeed', 'log']]) {
  const f = window[fn]; if (typeof f !== 'function') continue;
  window[fn] = (...a) => (unlockedHere(id) ? f(...a) : undefined);
}
for (const [fn, id] of [['drawBlockButton', 'block'], ['drawLayerButton', 'layer']]) {
  const f = window[fn]; if (typeof f !== 'function') continue;
  window[fn] = (a, ...r) => (window.GAME && GAME.scene === 'world' && a === (GAME.world && GAME.world.player) && !unlockedHere(id) ? undefined : f(a, ...r));
}
// tips about a locked system wait until it opens (the watchers ask again every second, so they come in their time)
{
  const te = tipEvent;
  tipEvent = (game, id) => (UNLOCK_TIP[id] && !unlocked(game.profile, UNLOCK_TIP[id]) ? undefined : te(game, id));
}
// the daily attendance board waits for SEASON
{
  const lt = loginTick;
  loginTick = (game, w) => (unlocked(game.profile, 'season') ? lt(game, w) : undefined);
}
// the hub: Summon and Ranked are dimmed with the level they open at, and choosing one only says so
const HUB_LOCK = { summon: 'summon', ranked: 'ranked' };
{
  const hc = hubChoose;
  hubChoose = (game, id) => {
    const u = HUB_LOCK[id]; if (u && !unlocked(game.profile, u)) { game.toast(`${UNLOCK_BY[u].name} opens at Lv ${UNLOCK_BY[u].lv}${u === 'summon' ? ' (or when the first Guardian falls)' : ''}`, '#c9c1a8'); return; }
    return hc(game, id);
  };
  const dh = drawHub;
  drawHub = (game, m, now) => {
    if (!game.profile) return;   // (a frame of the hub before a hero is loaded: drawHub reads the hero's league)
    dh(game, m, now);   // (locked tiles draw their own LOCKED tag: pvp.js hubTile)
    drawHubToday(game);
  };
}
// ---------------------------------------------------------------- the UNLOCKED card (after the title sweep, titles.js)
{
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => { tf(game, now); drawUnlockCard(game, now); };
}
function drawUnlockCard(game, now) {
  if (!game.unlockCard && game.unlockQ && game.unlockQ.length && !game.levelFx && !game.banner && !game.holeBanner && !game.goalCard) { game.unlockCard = { id: game.unlockQ.shift(), at: now }; if (typeof SFX !== 'undefined' && SFX.unlock) SFX.unlock(); }   // (its own soft rising chime as it slides in: sfx.js)   // (after a level-up or an area banner, never over one)
  const C = game.unlockCard; if (!C) return;
  if (game.levelFx || game.banner || game.holeBanner || game.goalCard) { C.at = now - (C.shown || 0); return; }   // (a level-up or banner came along: the card waits, hidden, and picks up where it was)
  const t = now - C.at, U = UNLOCK_BY[C.id]; C.shown = t; if (t > UNLOCK_FX.show || !U) { game.unlockCard = null; return; }
  const k = Math.min(1, t / UNLOCK_FX.slide, (UNLOCK_FX.show - t) / UNLOCK_FX.slide), W = 300, H = 44, x = VW / 2 - W / 2, y = 96 - (1 - k) * 20;
  ctx.save(); ctx.globalAlpha = Math.max(0, k);
  ctx.fillStyle = 'rgba(16,10,24,0.92)'; rrect(ctx, x, y, W, H, 6); ctx.fill();
  ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
  goldText(`UNLOCKED · ${U.name}`, VW / 2, y + 12, 9, { spacing: 1 });
  text(U.how, VW / 2, y + 30, '#e8e2cf', 7);
  ctx.restore();
}
// ---------------------------------------------------------------- what's ahead
// the next system still to open (the lowest level first), or null when everything is open
function nextUnlock(pr) { return UNLOCKS.filter(u => !unlocked(pr, u.id)).sort((a, b) => a.lv - b.lv)[0] || null; }
// the level-up screen (journey.js) names it under the gains: something to look forward to
{
  const dl = drawLevelUp;
  drawLevelUp = (game, w, cam, now) => {
    dl(game, w, cam, now);
    const L = game.levelFx, N = L && nextUnlock(game.profile); if (!L || !N || L.t < 1300) return;
    const k = Math.min(1, (L.t - 1300) / 300, (3800 - L.t) / 300);
    ctx.save(); ctx.globalAlpha = Math.max(0, k);
    text(N.lv <= (game.profile.lv || 1) ? `Opening soon: ${N.name}` : `Next unlock: ${N.name} at Lv ${N.lv}`, VW / 2, 188, '#ffe08a', 7.5);
    ctx.restore();
  };
}
// the pause menu gets UNLOCKS: everything open so far, and what's ahead with the level it needs
PAUSE_OPTS.splice(PAUSE_OPTS.findIndex(o => o.id === 'hub'), 0, { id: 'unlocks', title: 'UNLOCKS', sub: "What's open, and what comes next", col: '#ffe08a' });
{
  const up = updatePause;
  updatePause = (game, m, dt) => {
    if (m.view === 'unlocks') { m.t += dt; const k = navInput(); if ((k.back || k.ok || mouse.click) && m.t > 120) { m.view = null; m.t = 0; } return; }   // (Enter, Esc or a click closes the list)
    const i = PAUSE_OPTS.findIndex(o => o.id === 'unlocks'), B = PAUSE_BTN(i), k = navInput();
    const open = m.cur === i && (k.ok || clicked(B.x, B.y, B.w, B.h));
    up(game, m, dt);
    if (open && game.menu === m) { m.view = 'unlocks'; m.t = 0; }
  };
  const dp = drawPause;
  drawPause = (game, m, now) => {
    dp(game, m, now);
    if (m.view !== 'unlocks') return;
    const pr = game.profile, W = 380, H = 40 + UNLOCKS.length * 24, x = VW / 2 - W / 2, y = VH / 2 - H / 2;
    ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = 'rgba(16,10,24,0.96)'; rrect(ctx, x, y, W, H, 6); ctx.fill();
    ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
    goldText('UNLOCKS', VW / 2, y + 14, 11, { spacing: 2 });
    [...UNLOCKS].sort((a, b) => a.lv - b.lv).forEach((u, i) => {
      const on = unlocked(pr, u.id), ry = y + 34 + i * 24;
      text(on ? '✔' : '🔒', x + 16, ry, on ? '#8fffb0' : '#8a8270', 8);
      text(u.name, x + 30, ry - 4, on ? '#ffe08a' : '#a8a0b8', 7.5, 'left');
      text(on ? u.how : `Opens at Lv ${u.lv}`, x + 30, ry + 6, on ? '#d8d0e4' : '#b8ae96', 7, 'left');
    });
    text('Enter, Esc or click: back', VW / 2, y + H - 8, '#b8ae96', 7);
  };
}
// a co-op guest's own keys (net.js netGuestFrame reads them, not updateWorldScene): the same gate, by the guest's own unlocks
{
  const gf = netGuestFrame;
  netGuestFrame = (game, dt) => {
    if (game.profile && !game.menu) for (const u of UNLOCKS) if (!unlocked(game.profile, u.id)) for (const k of u.keys) pressed.delete(k);
    if (game.profile && (game.unlockScan = (game.unlockScan || 0) - dt) <= 0) { game.unlockScan = 1000; unlockTick(game); }   // (a guest levels up in a friend's world too)
    return gf(game, dt);
  };
}
// ---------------------------------------------------------------- YOUR JOURNEY: the first goal, said once
// The first time a new hero (Lv 5 or under) steps out into Hearthvale, a card names the chapter and what to do first, the same
// words as the story tracker, and points at the gold arrow. Unlock cards wait until it has gone.
const GOAL_FX = { show: 7500, slide: 350 };
function goalCardTick(game) {
  const pr = game.profile, w = game.world; if (!pr || pr.goalShown || !w || !w.overworld || w.interior || game.menu) return;
  if ((pr.lv || 1) > 5 || typeof storyChapter !== 'function') { pr.goalShown = true; return; }
  const C = storyChapter(pr); if (!C) { pr.goalShown = true; return; }
  const st = storyStep(pr), line = !st ? (C.giver.town != null ? `Talk to the ${C.giver.name}` : `Talk to the ${C.giver.name} in Hearthvale`) : stepText(st, C);
  pr.goalShown = true; game.goalCard = { at: performance.now(), title: C.title, line }; game.save();
}
function drawGoalCard(game, now) {
  const C = game.goalCard; if (!C) return false;
  if (!C.rang && typeof SFX !== 'undefined') { C.rang = true; if (C.head === 'TRY AGAIN') { if (SFX.retry) SFX.retry(); } else if (SFX.notice) SFX.notice(); }   // (soft music-box notes, settling home for TRY AGAIN, two rising otherwise: sfx.js)
  const t = now - C.at, show = C.show || GOAL_FX.show; if (t > show || game.scene !== 'world') { game.goalCard = null; return false; }
  const k = Math.max(0, Math.min(1, t / GOAL_FX.slide, (show - t) / GOAL_FX.slide)), nx = Math.max(0, ((C.lines && C.lines.length) || 0) - 2), W = 320, H = 62 + nx * 11, x = VW / 2 - W / 2, y = 92 - (1 - k) * 20;   // (a third line makes the card a little taller)
  ctx.save(); ctx.globalAlpha = k;
  // (dressed like the hub: dark glass with a warm glow at its head, gold corner swirls, a glassy bevel, and a divider with
  // little diamonds under the heading)
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * RES; ctx.shadowOffsetY = 2 * RES;
  const bg = ctx.createLinearGradient(0, y, 0, y + H); bg.addColorStop(0, 'rgba(44,29,18,0.95)'); bg.addColorStop(1, 'rgba(10,7,18,0.95)');
  ctx.fillStyle = bg; rrect(ctx, x, y, W, H, 6); ctx.fill(); ctx.restore();
  const hg = ctx.createRadialGradient(VW / 2, y + 10, 4, VW / 2, y + 10, W * 0.45); hg.addColorStop(0, 'rgba(255,210,120,0.16)'); hg.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = hg; rrect(ctx, x, y, W, H, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(200,170,110,0.35)'; ctx.lineWidth = 0.7; rrect(ctx, x + 2.5, y + 2.5, W - 5, H - 5, 5); ctx.stroke();
  if (typeof hubFrame !== 'function' || !hubFrame(x - 3, y - 3, W + 6, H + 6, 0.5)) { ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke(); }
  { const bv = ctx.createLinearGradient(0, y + 3, 0, y + 10); bv.addColorStop(0, 'rgba(255,255,255,0.08)'); bv.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = bv; ctx.fillRect(x + 4, y + 3, W - 8, 7); }
  { const dy = y + 19, dg = ctx.createLinearGradient(VW / 2 - 70, 0, VW / 2 + 70, 0); dg.addColorStop(0, 'rgba(232,190,100,0)'); dg.addColorStop(0.5, 'rgba(232,190,100,0.7)'); dg.addColorStop(1, 'rgba(232,190,100,0)'); ctx.fillStyle = dg; ctx.fillRect(VW / 2 - 70, dy, 140, 0.7);
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(VW / 2 + s * (goldTextW(C.head || 'YOUR JOURNEY', 9) / 2 + 10), y + 12); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#e8be64'; ctx.fillRect(-1.6, -1.6, 3.2, 3.2); ctx.restore(); } }
  goldText(C.head || 'YOUR JOURNEY', VW / 2, y + 12, 9, { spacing: 2 });   // (C.head and C.lines: the WELCOME BACK card uses this too, sessionrecap.js)
  text(C.title, VW / 2, y + 26, '#ffe08a', 8);
  const L = C.lines || [`First: ${C.line} · follow the gold arrow`, 'Esc ▸ JOURNAL ▸ UNLOCKS shows what opens as you grow'];
  text(L[0], VW / 2, y + 39, '#ffffff', 7); if (L[1]) text(L[1], VW / 2, y + 51, '#d0c8dc', 7); for (let i = 2; i < L.length; i++) text(L[i], VW / 2, y + 62 + (i - 2) * 11, '#b0e0ff', 7);   // (each line past two makes the card 11 px taller)
  ctx.restore(); return true;
}
{
  const uw = updateWorldScene;
  updateWorldScene = dt => { if (window.GAME) goalCardTick(GAME); return uw(dt); };
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => { drawGoalCard(game, now); return tf(game, now); };   // (an unlock card waits while it shows: drawUnlockCard)
}
// ---------------------------------------------------------------- the end of a new hero's grace, said once
// Below Lv 10 a fall only knocks your partner out and only wears your gear (heropartner.js PARTNER_GRACE, durability.js
// DEATH_GRACE). The first time a hero is Lv 10 or over in the world, the log and a toast say that from now on a fall costs both.
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const G = window.GAME, pr = G && G.profile;
    if (pr && !pr.graceOver && (pr.lv || 1) >= DEATH_GRACE.lv && !G.levelFx) {
      pr.graceOver = true; if ((pr.lv || 1) > DEATH_GRACE.lv + 1) return uw(dt);   // (a hero long past it already knows)
      const msg = `Lv ${DEATH_GRACE.lv}: from now on a fall in the Wilds shatters the gear you carry, and a fallen partner is gone for good. Keep spares in your home storage.`;
      G.toast(msg, '#ff9a7a'); if (typeof logAdd === 'function') logAdd(G, msg, '#ff9a7a'); G.save();
    }
    return uw(dt);
  };
}
// TODAY on the hub, under your hero's power: what waits for you right now (the daily gift and contracts once SEASON & DAILY is
// open, summon coins, rested EXP), so a returning player sees it at a glance
function drawHubToday(game) {
  const pr = game.profile; if (!pr) return;
  const rows = [], daily = unlocked(pr, 'season');
  if (daily) rows.push(pr.login && pr.login.last === dayNo() ? ['✔ Daily gift claimed', '#8fffb0'] : ['☀ Daily gift waiting: step outside', '#ffd27a']);
  if (daily && pr.daily && pr.daily.list) { const d = pr.daily.list.filter(c => c.done).length; rows.push([`Contracts ${d}/${pr.daily.list.length}${d === pr.daily.list.length ? ' ✔' : ''}`, d === pr.daily.list.length ? '#8fffb0' : '#e8e2cf']); }
  if (pr.coins) rows.push([`${pr.coins} summon coins${unlocked(pr, 'summon') ? '' : ' (Summon opens at Lv ' + UNLOCK_BY.summon.lv + ')'}`, '#ffd23f']);
  if (pr.restedExp > 0) rows.push([`Rested EXP: ${pr.restedExp} (double from monsters)`, '#9fd8ff']);
  if (typeof HUB_TODAY_EXTRA === 'function') rows.push(...HUB_TODAY_EXTRA(pr));   // (more lines from other systems: book.js, pats.js)
  if (!rows.length) return;
  const C = HUB_L.card, x = C.x + 12, y = C.y + 250; text('TODAY', x, y, '#e8be64', 7, 'left');   // (the foot of the hub's player card, pvp.js)
  const pages = Math.ceil(rows.length / 3), pg = pages > 1 ? Math.floor(performance.now() / 4000) % pages : 0;   // (more than three: three at a time, turning every 4 s)
  if (pages > 1) text(`${pg + 1}/${pages}`, C.x + C.w - 12, y, '#b8ae96', 7, 'right');
  rows.slice(pg * 3, pg * 3 + 3).forEach(([s, c], i) => text(s.length > 30 ? s.slice(0, 29) + '…' : s, x, y + 10 + i * 9, c, 7, 'left'));   // (7 px: smaller was hard to read)
}
// an area or chapter banner waits while a story card (goal, welcome, TRY AGAIN, wind-down) is up, then plays in full: drawn
// together, the banner's big title sat right behind the card and neither could be read. (Its clock only runs while drawn.)
{
  const db = drawBanner;
  drawBanner = (game, now, dt) => (game.goalCard ? undefined : db(game, now, dt));
}
// the tip window (tips.js) waits the same way: it slid in at the left over the card's edge. While a story card is up a tip neither
// starts nor counts down; it carries on once the card has gone.
{
  const dtp = drawTip;
  drawTip = (game, now, dt) => (game.goalCard ? undefined : dtp(game, now, dt));
}
