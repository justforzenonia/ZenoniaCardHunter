'use strict';
// THIS SESSION: when you Save & Exit (or return to the title any other way), the title shows what you did since you started
// playing on this page: time played, levels gained, monsters defeated, new cards and gold earned. Only things that changed are
// listed, and nothing shows if you barely played. Esc or any key leaves it to the title as usual (it is drawn under the buttons).
const RECAP = { y: 302, minMs: 60000 };   // (just under the hero's stats line; the hero's links sit on the left, savearchive.js)
const tipsOn = () => typeof SET === 'undefined' || SET.tips !== false;   // (Esc > SETTINGS > TIPS: the tip-like extras here follow it)
// the title's rotating tips (one every 8 s while there is no session recap): things players often miss
const TITLE_TIPS = [
  'Esc ▸ JOURNAL ▸ UNLOCKS shows what opens as you level up',
  'Unspent stat points? Tab ▸ STATS ▸ Auto spend (V)',
  'Dash (Shift) just as a blow lands for a PERFECT DODGE and a counter hit',
  'Hold L to block; block as a blow lands to PARRY it back',
  'Shielded foes: hit them from the side or behind',
  'A red lane on the ground means a charge is coming: step aside or dash through',
  'The waystone by your door takes you to any safe point you have touched',
  'Time away builds rested EXP: double EXP from monsters until it runs out',
  'Every x10 summon holds at least one card of rank B or better',
  'Press B for MEAL TIME: meals refill hunger and give strong buffs',
  'Gear in your home storage is safe even if you fall',
  'Training in the hub has drills for shields, charges and parries (Y)',
  'Esc ▸ JOURNAL ▸ GUIDE opens the full player guide',
  'F2 keeps a photo of the world; Esc ▸ JOURNAL ▸ ALBUM shows them all',
  'End the night in your bed at home: rested EXP builds 50% faster while you are away',
];
function recapSnap(pr) { return { at: pr.playMs || 0, lv: pr.lv || 1, kills: (pr.stats && pr.stats.kills) || 0, cards: (pr.cards || []).length + ((pr.storage && pr.storage.cards) || []).length, gold: pr.gold || 0, guardians: Object.keys(pr.cleared || {}).length, photos: (pr.stats && pr.stats.photos) || 0, name: (pr.look && pr.look.name) || 'Your hero' }; }
// the snapshot is taken the first time a hero is in the world on this page (and again for another hero)
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const G = window.GAME, pr = G && G.profile;
    if (pr && (!G.recap0 || G.recap0.pr !== pr)) G.recap0 = { pr, s: recapSnap(pr) };
    return uw(dt);
  };
}
// the recap of a session, from its starting snapshot R0 to now (null if it was too short or nothing happened); diary.js uses it too
function recapBuild(R0) {
  const pr = R0.pr, a0 = R0.s, b = recapSnap(pr), ms = b.at - a0.at, parts = [];
  if (b.guardians > a0.guardians) parts.push(b.guardians - a0.guardians === 1 ? 'a Guardian beaten!' : `${b.guardians - a0.guardians} Guardians beaten!`);
  if (b.lv > a0.lv) parts.push(`+${b.lv - a0.lv} level${b.lv - a0.lv === 1 ? '' : 's'} (Lv ${b.lv})`);
  if (b.kills > a0.kills) parts.push(`${b.kills - a0.kills} monsters`);
  if (b.cards > a0.cards) parts.push(`${b.cards - a0.cards} new card${b.cards - a0.cards === 1 ? '' : 's'}`);
  if (b.gold > a0.gold) parts.push(`+${b.gold - a0.gold} G`);
  if (b.photos > (a0.photos || 0)) parts.push(`${b.photos - (a0.photos || 0)} photo${b.photos - (a0.photos || 0) === 1 ? '' : 's'}`);   // (photo.js)
  const C = typeof storyChapter === 'function' && storyChapter(pr), st = C && storyStep(pr), next = C ? (st ? stepText(st, C) : `Talk to the ${C.giver.name}`) : '';   // (what to do when you come back)
  return ms >= RECAP.minMs && parts.length ? { name: b.name, time: fmtPlay(ms), parts, next } : null;
}
{
  const bt = game.backToTitle.bind(game);
  game.backToTitle = function (...a) {
    const R0 = this.recap0, pr = R0 && R0.pr;
    if (pr) { this.lastRecap = recapBuild(R0); this.recap0 = null; }
    return bt(...a);
  };
}
{
  const dt = drawTitle;
  drawTitle = (game, m, now) => {
    dt(game, m, now);
    const R = game.lastRecap; if (m.prev) return;
    if (!R) { if (game.saved && tipsOn()) { const t = TITLE_TIPS[Math.floor(now / 8000) % TITLE_TIPS.length]; text(`Tip: ${t}`, VW / 2, RECAP.y + 6, `rgba(216,208,228,${0.82 + 0.1 * Math.sin(now / 900)})`, 7); } return; }   // (no session to sum up: a tip instead)
    text(`This session · ${R.name} · ${R.time}`, VW / 2, RECAP.y, '#e8be64', 7);
    text(R.parts.join('  ·  '), VW / 2, RECAP.y + 10, '#e8e2cf', 7);
    if (R.next) text(`Next time: ${R.next}`, VW / 2, RECAP.y + 20, '#b8d8f8', 7);
  };
}
// WELCOME BACK: continue after 3 hours or more away and a card says how long it has been, what waits for you (summon coins,
// ripe crops) and your next story goal (drawn by unlocks.js drawGoalCard, so unlock cards wait for it). pr.lastPlayed is only
// written by saves made in the world after this page has read it, so a save on the hub can't hide how long you were gone.
const WELCOME = { away: 3 * 3600000, restPerHour: 0.1, restCap: 1 };   // (rested EXP: 10% of a level per hour away, one level at most)
{
  const sv = game.save.bind(game);
  game.save = function (...a) { if (this.profile && this.welcomeRead === this.profile && this.scene === 'world') this.profile.lastPlayed = Date.now(); return sv(...a); };
}
function welcomeTick(game) {
  const pr = game.profile, w = game.world; if (!pr || game.welcomeRead === pr || !w || game.menu) return;
  game.welcomeRead = pr;
  const away = pr.lastPlayed ? Date.now() - pr.lastPlayed : 0; pr.lastPlayed = Date.now();   // (marked at once: the same time away can't be counted twice, a co-op guest's saves included)
  if (away < WELCOME.away || (pr.lv || 1) < 2) return;
  const h = Math.floor(away / 3600000), d = Math.floor(h / 24), when = d ? `${d} day${d === 1 ? '' : 's'}` : `${h} hours`;
  const ripe = (pr.farm || []).filter(P => P && P.crop && typeof plotProgress === 'function' && plotProgress(P, pr) >= 1).length;
  const waits = [pr.coins ? `${pr.coins} summon coins` : '', ripe ? `${ripe} crop${ripe === 1 ? '' : 's'} ripe at home` : ''].filter(Boolean).join(' · ');
  const C = typeof storyChapter === 'function' && storyChapter(pr), st = C && storyStep(pr);
  const next = C ? (st ? stepText(st, C) : `Talk to the ${C.giver.name}`) : '';
  // RESTED EXP: time away builds a pool; while it lasts, monster kills give double EXP (the extra comes out of the pool)
  const need = typeof expNeed === 'function' ? expNeed(pr.lv || 1) : 100;
  pr.restedExp = Math.round(Math.min(need * WELCOME.restCap, (pr.restedExp || 0) + need * WELCOME.restPerHour * away / 3600000));
  game.goalCard = { at: performance.now(), head: `WELCOME BACK, ${((pr.look && pr.look.name) || 'HERO').toUpperCase()}`, title: `Away ${when}${typeof lastVisitMs === 'function' && lastVisitMs(pr) ? ` · last visit ${fmtShort(lastVisitMs(pr))} of play` : ''}${waits ? ' · ' + waits : ''}`,
    lines: [next ? `Next: ${next}` : 'The road west waits', `Rested: double EXP from monsters for the next ${pr.restedExp} EXP`] };
}
{
  const uw = updateWorldScene;
  updateWorldScene = dt => { if (window.GAME) welcomeTick(GAME); return uw(dt); };
}
// a monster kill (world.js onMonsterKill) draws on the rested pool: its EXP is doubled while the pool lasts
{
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => { game.killExp = { w, m }; try { return ok(game, w, m); } finally { game.killExp = null; } };
  const ge = game.gainExp.bind(game);
  game.gainExp = function (n, ...a) {
    const pr = this.profile, K = this.killExp;
    if (K && pr && pr.restedExp > 0 && n > 0) { const b = Math.min(Math.round(n), pr.restedExp); pr.restedExp -= b; n += b; if (K.m && typeof floatText === 'function') floatText(K.w, K.m.x, K.m.y - 40, `RESTED +${b}`, '#9fd8ff', 6); if (!pr.restedExp) this.toast('Rested EXP used up', '#9fd8ff'); }
    return ge(n, ...a);
  };
}
// a co-op guest: the welcome check runs in their own frame, and their kills (net.js netKill -> netGainExp) draw on their own pool
{
  const gf = netGuestFrame;
  netGuestFrame = (game, dt) => { welcomeTick(game); return gf(game, dt); };
  const nk = netKill;
  netKill = (game, w, K) => { game.killExpNet = true; try { return nk(game, w, K); } finally { game.killExpNet = false; } };
  const ng = netGainExp;
  netGainExp = (game, n) => {
    const pr = game.profile;
    if (game.killExpNet && pr && pr.restedExp > 0 && n > 0) { const b = Math.min(Math.round(n), pr.restedExp); pr.restedExp -= b; n += b; if (!pr.restedExp) game.toast('Rested EXP used up', '#9fd8ff'); }
    return ng(game, n);
  };
}
// GUARDIAN AHEAD: walking up to a Guardian you haven't beaten with stat points unspent (the fight leans hard on them), a toast
// says how many and where to spend them, once per Guardian per session
const GNUDGE = { r: 320 };
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const G = window.GAME, pr = G && G.profile, w = G && G.world;
    if (pr && w && w.guardians && !G.menu && (G.gnudgeT = (G.gnudgeT || 0) - dt) <= 0) {
      G.gnudgeT = 1000; const p = w.player, pts = typeof statPoints === 'function' ? statPoints(pr) : 0;
      if (p && pts >= 5 && tipsOn()) for (const Gd of w.guardians) {
        const m = Gd && Gd.m; if (!m || m.dead || (pr.cleared && pr.cleared[Gd.zi]) || (G.gnudged || {})[Gd.zi] || Math.hypot(m.x - p.x, m.y - p.y) > GNUDGE.r) continue;
        (G.gnudged = G.gnudged || {})[Gd.zi] = true;
        G.toast(`${m.label || 'The Guardian'} ahead, and you have ${pts} stat points unspent: Tab ▸ STATS ▸ Auto spend (V), or click +STAT`, '#ffd27a');
      }
    }
    return uw(dt);
  };
}
// TRY AGAIN: beaten by a boss (a Guardian, a mini boss, a black hole's lord...), you wake at home to a card naming it and two
// tips picked from your own state: unspent stat points, no potions, the guard moves you have, gear from the smith
{
  const uw = updateWorldScene;
  updateWorldScene = dt => {
    const G = window.GAME, w = G && G.world, p = w && w.player;
    if (p && p.dead && !G.downSeen) {
      G.downSeen = true;
      const b = w.actors.filter(a => a.boss && !a.dead && !a.ally && Math.hypot(a.x - p.x, a.y - p.y) < 300).sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
      G.lastDeathBy = b ? (b.label || (SPECIES[b.sp] || {}).name || 'A boss') : null;
    } else if (p && !p.dead) G.downSeen = false;
    return uw(dt);
  };
}
function tryAgainTips(pr) {
  const tips = [], pts = typeof statPoints === 'function' ? statPoints(pr) : 0;
  const pots = Object.entries(pr.goods || {}).reduce((s, [idx, n]) => s + (Z2_ITEM[idx] && GOODS_USE[Z2_ITEM[idx].sub] && GOODS_USE[Z2_ITEM[idx].sub].hp ? n : 0), 0);
  if (pts >= 5) tips.push(`Spend your ${pts} stat points: Tab ▸ STATS ▸ Auto spend (V)`);
  if (!pots) tips.push('Bring potions: shops sell them, keys 5-8 drink one');
  if (typeof unlocked !== 'function' || unlocked(pr, 'block')) tips.push('Hold L to block; block as a blow lands to PARRY, or dash through it');
  else tips.push('Dash (Shift) through its big blows, and step out of red rings');
  tips.push('Better gear: the smith in town, or a black hole\'s hoard');
  return tips.slice(0, 2);
}
{
  const sh = sendHome;
  sendHome = (w, p) => {
    const r = sh(w, p), G = window.GAME;
    if (G && G.lastDeathBy && G.profile) { if (tipsOn()) G.goalCard = { at: performance.now(), head: 'TRY AGAIN', title: `${G.lastDeathBy} beat you this time`, lines: tryAgainTips(G.profile) }; G.lastDeathBy = null; }   // (cleared either way)
    return r;
  };
}
// GUIDE in the pause menu: the player guide (guide/index.html, every system with pictures) opens in a new browser tab
PAUSE_OPTS.splice(PAUSE_OPTS.findIndex(o => o.id === 'hub'), 0, { id: 'guide', title: 'GUIDE', sub: 'Every system explained, in a new tab', col: '#b8e0a0' });
{
  const up = updatePause;
  updatePause = (game, m, dt) => {
    const i = PAUSE_OPTS.findIndex(o => o.id === 'guide'), B = PAUSE_BTN(i), k = navInput();
    if (!m.view && m.cur === i && (k.ok || clicked(B.x, B.y, B.w, B.h))) { try { window.open('guide/index.html', '_blank'); } catch (e) {} game.toast('The guide opened in a new tab', '#b8e0a0'); return; }
    return up(game, m, dt);
  };
}
// TOAST PACING: many systems toast at once (stepping into the Wilds can bring a level-up, a Bond Card, the Monster of the Day,
// Monster Book news and a chest within one second), and the stack keeps only five, so some vanished unread. At most two fresh
// toasts show at a time; the rest wait their turn. A toast already showing or waiting isn't repeated.
// CALMER NEWS (2026-11-06): a new hero measured 71 toasts, cards and banners in four minutes, 17 in the first minute, mostly world
// news nobody asked for ("An ALPHA prowls the Heights!" four times word for word, "A treasure chest appeared" six times). So:
//   feedback (a menu is open, or you pressed a key or clicked just now) shows at once, ahead of any news that is waiting;
//   news trickles in, one every 3 s and only when no other fresh toast is up;
//   the same news, word for word, is not repeated within 3 minutes.
const TOAST_PACE = { max: 1, fresh: 1200, gap: 1300, keep: 12, underCard: 2, newsGap: 3000, input: 400, repeat: 180000 };
const TOAST_NEWS_SEEN = new Map();   // news text -> when it last showed
let toastInputAt = -1e9;
addEventListener('keydown', e => { if (!e.repeat) toastInputAt = performance.now(); }, true);   // (capture: before the game's own handlers toast)
addEventListener('pointerdown', () => { toastInputAt = performance.now(); }, true);
// while a story card is up (goal, welcome, TRY AGAIN, wind-down, unlock: unlocks.js), at most two toasts show at once: a third
// stacked down over the card's heading and made both hard to read. The rest wait their turn.
const toastRoom = G => !(G.goalCard || G.unlockCard) || G.toasts.length < TOAST_PACE.underCard;
{
  const t0 = game.toast;
  game.toast = function (str, col) {
    const W = this.toastWait = this.toastWait || [], now = performance.now();
    if (this.toasts.some(t => t.str === str && t.t < 3000) || W.some(e => e[0] === str)) return;
    const ev = window.event, inHandler = ev && /^(key|pointer|mouse|click|touch)/.test(ev.type);   // (raised inside a key or click handler: feedback)
    const news = !this.menu && !inHandler && now - toastInputAt > TOAST_PACE.input;
    if (news) {
      const seen = TOAST_NEWS_SEEN.get(str); if (seen != null && now - seen < TOAST_PACE.repeat) return;   // (heard it already)
      W.push([str, col, true]); if (W.length > TOAST_PACE.keep) W.splice(W.findIndex(e => e[2]), 1); return;
    }
    const fresh = this.toasts.filter(t => t.t < TOAST_PACE.fresh).length;
    if (fresh >= TOAST_PACE.max || now < (this.toastNext || 0) || !toastRoom(this)) { W.splice(W.findIndex(e => e[2]) < 0 ? W.length : W.findIndex(e => e[2]), 0, [str, col, false]); if (W.length > TOAST_PACE.keep) W.pop(); return; }   // (feedback waits ahead of news)
    this.toastNext = now + TOAST_PACE.gap / 2; return t0.call(this, str, col);
  };
  game.toastRaw = t0;
  const dt0 = drawToasts;
  drawToasts = dt => {
    const G = game, W = G.toastWait, now = performance.now();
    if (W && W.length && now >= (G.toastNext || 0) && toastRoom(G)) {
      const fresh = G.toasts.filter(t => t.t < TOAST_PACE.fresh).length, [s, c, news] = W[0];
      if (news ? fresh === 0 && now >= (G.newsNext || 0) : fresh < TOAST_PACE.max) {
        W.shift(); G.toastNext = now + TOAST_PACE.gap;
        if (news) {
          G.newsNext = now + TOAST_PACE.newsGap; TOAST_NEWS_SEEN.set(s, now);
          if (TOAST_NEWS_SEEN.size > 60) for (const [k, at] of TOAST_NEWS_SEEN) if (now - at > TOAST_PACE.repeat) TOAST_NEWS_SEEN.delete(k);   // (older than the repeat window: forgotten)
        }
        t0.call(G, s, c);
      }
    }
    return dt0(dt);
  };
}
// WIND-DOWN: a calm game for before bed. After an hour of play on this page, the next quiet moment (in the open world, no menu, no
// monster close by, no other card up) brings one soft card: what this session did, and that resting builds rested EXP for next
// time. Late at night by your own clock (11 pm to 4 am) it comes after 20 minutes instead, as IT'S GETTING LATE.
// Once per session, never in a fight, and it follows Esc > SETTINGS > TIPS like the other gentle extras. Nothing stops.
const WINDDOWN = { after: 3600000, lateAfter: 1200000, lateFrom: 23, lateTo: 4, calm: 170 };
const windLate = (d = new Date()) => d.getHours() >= WINDDOWN.lateFrom || d.getHours() < WINDDOWN.lateTo;
function windDownTick(game) {
  const R0 = game.recap0, pr = game.profile, w = game.world;
  if (!R0 || R0.pr !== pr || game.windDown === pr || !w || game.menu || game.goalCard || game.levelFx || !tipsOn()) return;
  if (game.net && game.net.role === 'guest') return;   // (a friend's world: their card, not yours)
  const s = recapSnap(pr), ms = s.at - R0.s.at, late = windLate(); if (ms < (late ? WINDDOWN.lateAfter : WINDDOWN.after)) return;
  const p = w.player; if (!p || p.dead || w.boss) return;
  if (w.actors.some(a => a.kind === 'monster' && !a.dead && !a.ally && Math.hypot(a.x - p.x, a.y - p.y) < WINDDOWN.calm)) return;
  game.windDown = pr;
  const did = [];
  if (s.lv > R0.s.lv) did.push(`+${s.lv - R0.s.lv} level${s.lv - R0.s.lv === 1 ? '' : 's'}`);
  if (s.kills > R0.s.kills) did.push(`${s.kills - R0.s.kills} monsters`);
  if (s.cards > R0.s.cards) did.push(`${s.cards - R0.s.cards} new card${s.cards - R0.s.cards === 1 ? '' : 's'}`);
  if (s.guardians > R0.s.guardians) did.push('a Guardian beaten');
  if (s.photos > (R0.s.photos || 0)) did.push(`${s.photos - (R0.s.photos || 0)} photo${s.photos - (R0.s.photos || 0) === 1 ? '' : 's'}`);
  const h = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60;
  const today = typeof playTodayMs === 'function' ? playTodayMs(pr) : 0, more = today - ms > 300000 ? ` (${fmtShort(today)} today)` : '';   // (earlier visits today count too)
  const played = h ? `${h} hour${h === 1 ? '' : 's'}${mm >= 5 ? ` ${mm} min` : ''}` : `${mm} min`;
  game.goalCard = { at: performance.now(), head: late ? "IT'S GETTING LATE" : 'A COZY PLACE TO REST', title: `${played} of play${more}${did.length ? ' · ' + did.join(' · ') : ''}`,
    lines: ['Sleep in your bed at home, or Save & Exit (Esc): your hero waits', 'Time away builds rested EXP: double EXP when you return'] };
}
{
  const uw = updateWorldScene;
  updateWorldScene = dt => { if (window.GAME && (GAME.wdT = (GAME.wdT || 0) + dt) >= 1000) { GAME.wdT = 0; try { windDownTick(GAME); } catch (e) {} } return uw(dt); };   // (once a second: it counts the whole session)
}
