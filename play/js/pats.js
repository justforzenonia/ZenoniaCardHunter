'use strict';
// PATS: click or tap your partner (or your dog, wolf or drake) to give them a pat. A heart floats up with a soft music-box
// chime (cues.js), and they turn to look at you. The first pat each real day also warms your partner's bond a little: 5% of a
// level of their EXP (heropartner.js partnerExp). A cozy thing, nothing more; a pat uses up that click, so it does nothing else.
const PATS = { reach: 18, gap: 600, last: 0, bond: 0.05, hearts: ['#ff9ab8', '#ffc2d6', '#ff7aa8'] };
function patAt(game) {
  const w = game.world, p = w && w.player; if (!p || !mouse.click || !w.cam || game.menu) return false;
  const Z = w.zoom || ZOOM, wx = w.cam.x + mouse.x / Z, wy = w.cam.y + mouse.y / Z;
  const a = w.actors.find(q => q.ally && !q.dead && (q.owner === p || q.heroPartner) && !q.riding && Math.abs(q.x - wx) < PATS.reach && wy < q.y + 4 && wy > q.y - (q.h || 26) * (q.scale || 1) - 6);
  if (!a) return false;
  mouse.click = false;   // (the click was a pat)
  const now = performance.now(); if (now - PATS.last < PATS.gap) return true; PATS.last = now;
  floatText(w, a.x, a.y - (a.h || 26) * (a.scale || 1) - 4, '♥', PATS.hearts[0], 11);   // (one heart: the floating text now merges identical words)
  a.dir = dirTo(p.x - a.x, p.y - a.y);
  if (typeof cueNote === 'function') { const A = SFX.audio(); if (A) [659, 784].forEach((f, i) => cueNote(A, f, A.ac.currentTime + 0.01 + i * 0.15, 0.045)); }
  const pr = game.profile, P = a.heroPartner && typeof partnerOf === 'function' && partnerOf(pr);
  if (P && !P.dead && pr.patDay !== dayNo()) {
    pr.patDay = dayNo(); partnerExp(game, Math.max(1, Math.round(expNeed(P.lv) * PATS.bond)));
    game.toast(`${P.name} loves the attention (bond up)`, '#ffb0c8');
  }
  return true;
}
// (PATS_GUEST: a co-op friend's game runs this file's world steps too, but not the host's simulation underneath: see the end)
let PATS_GUEST = false;
{ const u = updateWorldScene; updateWorldScene = dt => { patAt(GAME); return PATS_GUEST ? undefined : u(dt); }; }
// RESTING: stand still a while with no monster near and your partner and pets doze off, a little "z z" drifting up over each.
// They wake the moment you move, attack or a monster comes close. Only a picture: nothing else changes.
const REST = { after: 15000, foe: 300, t: 0, x: 0, y: 0, on: false };
{
  const u = updateWorldScene;
  updateWorldScene = dt => {
    const r = u(dt), w = GAME.world, p = w && w.player;
    if (p) {
      // (moved: drifted 12 px from where resting began. A companion bumping past nudges you a little, and that mustn't count)
      const moved = Math.hypot(p.x - REST.x, p.y - REST.y) > 12 || p.state !== 'free' || p.dead;
      if (moved || REST.t === 0) { REST.x = p.x; REST.y = p.y; }
      const foe = w.actors.some(a => a.kind === 'monster' && !a.ally && !a.dead && !a.animalBody && Math.hypot(a.x - p.x, a.y - p.y) < REST.foe);
      REST.t = moved || foe ? 0 : REST.t + dt; REST.on = REST.t >= REST.after;
    }
    return r;
  };
}
{
  const da = drawActor;
  drawActor = (a, now, opts) => {
    const r = da(a, now, opts);
    const G = window.GAME, p = G && G.world && G.world.player;
    if (REST.on && p && a.ally && !a.dead && !a.riding && (a.owner === p || a.heroPartner)) {
      const top = a.y - (a.h || 26) * (a.scale || 1) - 2;
      for (let i = 0; i < 2; i++) {   // two z's, each rising and fading on its own beat
        const seed = typeof a.id === 'number' ? a.id : String(a.id || a.sp || '').length, k = ((now / 1600) + i * 0.5 + seed * 0.13) % 1;   // (ids aren't always numbers: a NaN here made text() throw)
        if (!isFinite(k) || !isFinite(top)) break;
        ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(k * Math.PI) * 0.6;
        text(i ? 'z' : 'Z', a.x + 12 + k * 7 + i * 4, top + 10 - k * 12, '#ffffff', 6.5 + k * 3);   // (beside the head, clear of the nameplate above it)
        ctx.restore();
      }
    }
    return r;
  };
}
// A GIFT FROM YOUR PARTNER: once a real day, after you've rested together a little (dozing a while), your partner brings you
// something they found: usually a small pouch of gold, sometimes summon coins, and now and then a monster's card from the zones
// you've reached. A heart, a soft chime and a few kind words. pr.giftDay keeps it to once a day.
const GIFT = { after: 12000, gold: [0, 0.6], coins: [0.6, 0.9] };   // (after: this long dozing; the rolls below 0.6 are gold, below 0.9 coins, the rest a card)
function partnerGift(game) {
  const pr = game.profile, w = game.world, p = w && w.player, P = typeof partnerOf === 'function' && partnerOf(pr);
  if (!P || P.dead || pr.giftDay === dayNo()) return;
  const a = w.actors.find(q => q.heroPartner && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 120); if (!a) return;
  pr.giftDay = dayNo();
  const r = Math.random(); let what;
  if (r < GIFT.gold[1]) { const g = 80 + (pr.lv || 1) * 20; pr.gold = (pr.gold || 0) + g; what = `a little pouch of ${g} gold`; }
  else if (r < GIFT.coins[1]) { const c = 3 + Math.floor(Math.random() * 4); pr.coins = (pr.coins || 0) + c; what = `${c} summon coins`; }
  else {
    const zmax = mbookZoneMax(pr), pool = mbookList().filter(sp => MBOOK_ZONE[sp] != null && MBOOK_ZONE[sp] <= zmax);
    const sp = pool[Math.floor(Math.random() * pool.length)], z = MBOOK_ZONE[sp];
    game.pickup({ kind: 'card', item: makeCard(sp, Math.max(0, ZONES[z].ranks[1] - 1)) }); what = `a ${SPECIES[sp].name} card`;
  }
  a.dir = dirTo(p.x - a.x, p.y - a.y);
  floatText(w, a.x, a.y - (a.h || 26) * (a.scale || 1) - 4, '♥', '#ff9ab8', 11);
  if (typeof cueNote === 'function') { const A = SFX.audio(); if (A) [523, 659, 784].forEach((f, i) => cueNote(A, f, A.ac.currentTime + 0.01 + i * 0.17, 0.05)); }
  game.toast(`${P.name} found something for you: ${what} ♥`, '#ffb0c8');
}
{
  const u = updateWorldScene;
  updateWorldScene = dt => { const r = u(dt); if (REST.on && REST.t >= REST.after + GIFT.after) partnerGift(GAME); return r; };
}
// A CAMPFIRE WHEN YOU REST: once your companions doze (15 s still, no monster near), a little campfire crackles to life beside
// you (the town's own drawCampfire, home.js) and you, your partner and your pets slowly mend: 3% of health and MP a second.
// Move on, attack or let a monster near and it puffs out. Not at home (there's a bed for that) or off the road.
const FIRE = { heal: 0.03, at: null };
{
  const u = updateWorldScene;
  updateWorldScene = dt => {
    const r = u(dt), w = GAME.world, p = w && w.player;
    const ok = REST.on && p && !p.dead && w.overworld && !w.home;
    if (ok && !FIRE.at) FIRE.at = { x: p.x - 26, y: p.y - 1 };
    if (!ok && FIRE.at) {   // out it goes, in a little puff of smoke
      if (w && w.particles) for (let i = 0; i < 8; i++) w.particles.push({ x: FIRE.at.x, y: FIRE.at.y - 6, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 25, t: 0, life: 500, col: '#c8c0b8', size: 2, drag: 0.92 });
      FIRE.at = null;
    }
    if (FIRE.at && !PATS_GUEST) {   // (the host owns everyone's health, so a friend's fire only warms, it doesn't mend)
      const k = FIRE.heal * dt / 1000;
      for (const a of w.actors) if (a === p || (a.ally && !a.dead && (a.owner === p || a.heroPartner))) {
        if (a.maxHp) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * k);
        if (a.maxMp) a.mp = Math.min(a.maxMp, (a.mp || 0) + a.maxMp * k);
      }
    }
    return r;
  };
}
{
  const da = drawActor;
  drawActor = (a, now, opts) => {
    const G = window.GAME;
    if (FIRE.at && G && G.world && a === G.world.player && typeof drawCampfire === 'function') { try { drawCampfire(FIRE.at, now); drawFireflies(FIRE.at, now); } catch (e) {} }
    return da(a, now, opts);
  };
}
// A WISH ON A SHOOTING STAR: resting by your campfire at night (nightNow() past 0.6), now and then a shooting star streaks
// across the top of the sky. When it has passed you've made a wish: for 5 minutes, monster cards drop 20% more often (a small
// extra roll, the same chance maths as the Monster of the Day). At most one wish every 20 minutes. pr.wishAt / pr.wishUntil.
const STAR = { night: 0.6, perSec: 1 / 25, gap: 20 * 60000, dur: 5 * 60000, bonus: 0.2, anim: null, ms: 1300 };
{
  const u = updateWorldScene;
  updateWorldScene = dt => {
    const r = u(dt), pr = GAME.profile;
    if (FIRE.at && !PATS_GUEST && !STAR.anim && pr && typeof nightNow === 'function' && nightNow() > STAR.night && Date.now() - (pr.wishAt || 0) > STAR.gap && Math.random() < STAR.perSec * dt / 1000) {
      STAR.anim = { t: 0, x0: VW * (0.3 + Math.random() * 0.25), y0: 72 + Math.random() * 26 };   // (below the HP panel, the clock and the tracker, so it isn't hidden)
    }
    if (STAR.anim) {
      STAR.anim.t += dt;
      if (STAR.anim.t >= STAR.ms) {
        STAR.anim = null;
        if (pr) { pr.wishAt = Date.now(); pr.wishUntil = Date.now() + STAR.dur; }
        if (typeof cueNote === 'function' && !(typeof SET !== 'undefined' && SET.chimes === false)) { const A = SFX.audio(); if (A) [659, 784, 880].forEach((f, i) => cueNote(A, f, A.ac.currentTime + 0.01 + i * 0.2, 0.045)); }
        GAME.toast('☆ You wished on a shooting star: monster cards drop more often for 5 minutes', '#fff0b0');
      }
    }
    return r;
  };
}
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => {
    const r = dw(world, cam, bg, now), S = STAR.anim; if (!S || !window.GAME || GAME.world !== world) return r;
    resetView(); const k = S.t / STAR.ms, x = S.x0 + k * 150, y = S.y0 + k * 46;
    ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI);
    const g = ctx.createLinearGradient(x - 34, y - 10, x, y); g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(1, 'rgba(255,248,220,0.95)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 34, y - 10.4); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    return r;
  };
}
{
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => {
    const r = ok(game, w, m), pr = game.profile;
    if (pr && pr.wishUntil > Date.now() && m && !m.ally && !m.mimic && m.sp && SPECIES[m.sp] && Math.random() < CARD_DROP(m.tier || 0) * (isBossKill(m) ? 1 : DROP_MUL) * nightMul(NIGHT.drops) * STAR.bonus)
      w.drops.push({ kind: 'card', item: makeCard(m.sp, dropRank(m.tier || 0)), x: m.x + rand(-6, 6), y: m.y + rand(-4, 4) });   // (the wish's little extra chance)
    return r;
  };
}
// FIREFLIES: at dusk and at night a few soft lights drift around your resting campfire, each on its own slow loop, glowing and
// fading. Only a picture.
function drawFireflies({ x, y }, now) {
  const n = typeof nightNow === 'function' ? nightNow() : 0; if (n < 0.3) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const s = i * 1.7, fx = x + Math.sin(now / (1400 + i * 170) + s) * (18 + i * 4), fy = y - 14 + Math.cos(now / (1100 + i * 130) + s * 1.3) * (8 + i * 2);
    const glow = (0.5 + 0.5 * Math.sin(now / (380 + i * 60) + s * 2)) * Math.min(1, (n - 0.3) / 0.4);
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 4); g.addColorStop(0, `rgba(230,255,150,${0.75 * glow})`); g.addColorStop(1, 'rgba(180,255,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(250,255,210,${glow})`; ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
  }
  ctx.restore();
}
// COOK AT YOUR CAMPFIRE: beside your resting campfire, "Enter: cook" shows over it and Enter opens the town campfire's cooking
// (home.js campfireMenu: roast your food into snacks). Checked before the world update, so the Enter isn't also a "talk".
const FIRE_COOK = { reach: 44 };
const fireNear = () => { const w = GAME.world, p = w && w.player; return FIRE.at && p && Math.hypot(p.x - FIRE.at.x, p.y - FIRE.at.y) < FIRE_COOK.reach; };
{
  const u = updateWorldScene;
  updateWorldScene = dt => {
    if (!GAME.menu && fireNear() && hit('Enter') && typeof campfireMenu === 'function') { consume('Enter'); GAME.openMenu(campfireMenu()); return; }
    return u(dt);
  };
}
{
  const da = drawActor;
  drawActor = (a, now, opts) => {
    const r = da(a, now, opts), G = window.GAME;
    if (FIRE.at && G && G.world && a === G.world.player && !G.menu && fireNear()) text('Enter: cook', FIRE.at.x, FIRE.at.y - 30, '#ffe9a8', 6.5);
    return r;
  };
}
// ROUND THE FIRE: while your rest campfire burns, your partner and pets stroll over and settle around it, each in its own seat on
// the far side from you, facing the flames (and dozing, above). When you move on, the fire goes out and they follow as before.
const FIRE_SEATS = [Math.PI, Math.PI * 0.72, Math.PI * 1.28, Math.PI * 0.45, Math.PI * 1.55];   // (angles from the fire: left of it, then around)
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    const G = window.GAME, p = world && world.player;
    if (!FIRE.at || !G || G.world !== world || !p || !m.ally || m.dead || m.riding || !(m.owner === p || m.heroPartner)) return ai(world, m, dt);
    const mine = world.actors.filter(a => a.ally && !a.dead && (a.owner === p || a.heroPartner)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const an = FIRE_SEATS[Math.max(0, mine.indexOf(m)) % FIRE_SEATS.length], sx = FIRE.at.x + Math.cos(an) * 24, sy = FIRE.at.y + Math.sin(an) * 12;
    const dx = sx - m.x, dy = sy - m.y, d = Math.hypot(dx, dy);
    m.pacing = false; m.vx = m.vy = 0;
    if (d > 3) { const st = Math.min(d, speedOf(m) * 0.7 * dt / 1000); m.dir = dirTo(dx, dy); moveBy(world, m, dx / d * st, dy / d * st); setAnim(m, 'walk', true); }
    else { m.dir = dirTo(FIRE.at.x - m.x, FIRE.at.y - m.y); setAnim(m, 'idle', true); }
  };
}
// FIRESIDE SOUND: while the rest campfire burns, a very quiet warm crackle (tiny bursts of filtered noise at random gaps, now
// and then a soft low pop) through the game's master volume, and the music eases down to half (settings.js MUSIC_DUCK, with a
// slow glide). CHIMES off in Settings silences the crackle too. It all fades back when the fire goes out.
const CRACKLE = { vol: 0.03, next: 0, buf: null };
function crackleBurst(A, pop) {
  if (!CRACKLE.buf) { const n = A.ac.sampleRate * 0.06; CRACKLE.buf = A.ac.createBuffer(1, n, A.ac.sampleRate); const d = CRACKLE.buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
  const t = A.ac.currentTime + 0.005, src = A.ac.createBufferSource(), bp = A.ac.createBiquadFilter(), g = A.ac.createGain(), len = pop ? 0.05 : 0.012 + Math.random() * 0.02;
  src.buffer = CRACKLE.buf; bp.type = 'bandpass'; bp.frequency.setValueAtTime(pop ? 420 : 1600 + Math.random() * 1800, t); bp.Q.setValueAtTime(pop ? 0.8 : 1.4, t);
  const peak = CRACKLE.vol * (pop ? 1.3 : 0.4 + Math.random() * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp); bp.connect(g); g.connect(A.master); src.start(t, Math.random() * 0.03); src.stop(t + len + 0.02);
}
{
  const u = updateWorldScene;
  updateWorldScene = dt => {
    const r = u(dt), lit = !!FIRE.at, duck = lit ? 0.5 : 1;
    if ((window.MUSIC_DUCK || 1) !== duck) { window.MUSIC_DUCK = duck; window.MUSIC_DUCK_TC = 1.2; if (typeof setApplySound === 'function') setApplySound(); window.MUSIC_DUCK_TC = 0; }
    if (lit && !(typeof SET !== 'undefined' && SET.chimes === false)) {
      CRACKLE.next -= dt;
      if (CRACKLE.next <= 0) { const A = SFX.audio(); if (A) crackleBurst(A, Math.random() < 0.12); CRACKLE.next = 60 + Math.random() * 380; }
    }
    return r;
  };
}
// CO-OP FRIENDS: a friend's game never runs updateWorldScene (net.js netGuestFrame draws the host's world instead), so none of
// the above happened for them. After each of their frames, this file's own chain of world steps runs with PATS_GUEST set, which
// stops it short of the host's simulation underneath: resting, the dozing, the campfire (warmth, crackle, fireflies, the music
// dip), cooking at it, pats and the daily gift now work for friends too. No healing and no shooting-star wish for them: the host
// owns everyone's health and rolls every drop.
const PATS_CHAIN = updateWorldScene;
{
  const g = netGuestFrame;
  netGuestFrame = (game, dt) => {
    const r = g(game, dt);
    if (game === GAME && game.scene === 'world' && game.world && game.world.player && !game.menu) { PATS_GUEST = true; try { PATS_CHAIN(dt); } finally { PATS_GUEST = false; } }
    return r;
  };
}
// TODAY on the hub (unlocks.js drawHubToday): the Monster of the Day, this week's hunt, and whether your partner's gift is waiting
function HUB_TODAY_EXTRA(pr) {
  const rows = [];
  const f = typeof mbookFeatured === 'function' && mbookFeatured(pr); if (f && SPECIES[f]) rows.push([`◆ Monster of the Day: ${SPECIES[f].name}`, '#ffa040']);
  const W = typeof mbookWeek === 'function' && mbookWeek(pr);
  if (W) { const d = W.list.filter(e => e.have >= MBOOK_WEEK.need).length; rows.push([W.paid ? '✔ Weekly hunt done' : `Weekly hunt ${d}/${W.list.length}`, W.paid ? '#8fffb0' : '#9fe8a8']); }
  const P = typeof partnerOf === 'function' && partnerOf(pr);
  if (P && !P.dead && pr.giftDay !== dayNo()) rows.push([`♥ ${P.name} has a gift (rest)`, '#ffb0c8']);   // (short: the panel cuts lines at 34 letters)
  return rows;
}
