'use strict';
// Card gacha at the town's Summoning Shrine. Summon coins: 10 to start, +10 every real hour (even while away),
// and a 5% drop from every monster. 1 coin = 1 summon; ×10 summons cost 10 coins.

// (2026-11-13: Korean-gacha odds, the user's pick. Was 30, 22, 17, 12, 8, 5.5, 3, 1.5, 0.7, 0.3: an S or better came 1 in 18.)
const GACHA_RATES = [38, 25, 16, 10, 6, 3, 1.3, 0.5, 0.15, 0.05];   // F … SSS+ (percent): S or better about 1 in 50, SSS+ 1 in 2000
const COIN_HOUR = 3600000, COIN_DROP = 0.05;
// every x10 summon holds at least one card of rank B or better: about 1 in 8 would otherwise be all F to C, a flat first summon.
// The last card is rolled again, at the same odds, until it reaches B (so the higher ranks keep their usual share).
const GACHA_FLOOR = { n: 10, tier: 4 };

function gachaRoll() {
  let r = Math.random() * 100, t = 0;
  while (t < 9 && r >= GACHA_RATES[t]) { r -= GACHA_RATES[t]; t++; }
  const roll = Math.random();
  return makeCard(roll < 0.2 ? pick(ARCANA_CARDS) : roll < 0.32 ? pick(NPC_CARD_IDS) : roll < 0.47 ? pick(SUPPORT_CARDS) : pick(SPECIES_IDS), t);   // 1 in 5 summons is an Arcana spell card, about 1 in 8 a villager, 3 in 20 a heal or buff
}
// hourly coins, granted for every full hour since the last grant (also while the game was closed)
function grantCoins(game) {
  const pr = game.profile;
  if (!pr) return;
  if (pr.coins == null) { pr.coins = 10; pr.coinT = Date.now(); game.save(); return; }
  const hours = Math.floor((Date.now() - (pr.coinT || Date.now())) / COIN_HOUR);
  if (hours > 0) {
    pr.coins += 10 * hours; pr.coinT += hours * COIN_HOUR;
    game.toast(`+${10 * hours} summon coins!`, '#ffd23f'); game.save();
  }
}
const nextCoinsIn = pr => Math.max(0, COIN_HOUR - (Date.now() - (pr.coinT || Date.now())));
function pickCoin(game) {
  game.profile.coins = (game.profile.coins || 0) + 1;
  game.toast('A Summon Coin! (+1)', '#ffd23f'); game.save();
}

// ---------------------------------------------------------------- the summoning screen
function gachaMenu() { return { type: 'gacha', results: null, t: 0, cur: 0 }; }
// the summon tokens on the console (casino.js). (2026-11-18, the user: "remove 1 card summon and only 10/100/1000": the x1 token is gone,
// x10 and x100 stand side by side between the Souls panel and the credits; x1000 came and went the same day, "1000 might be too much")
const GBTN = { ten: { x: 150, y: 280, w: 100, h: 76, n: 10 }, hund: { x: 268, y: 280, w: 100, h: 76, n: 100 } };
function summon(game, m, n) {
  const pr = game.profile;
  if ((pr.coins || 0) < n) { game.toast(`Not enough coins (${pr.coins || 0}/${n})`, '#ff8a8a'); return; }
  pr.coins -= n;
  m.results = [];
  const rolls = Array.from({ length: n }, gachaRoll);
  if (n >= GACHA_FLOOR.n && !rolls.some(c => c.tier >= GACHA_FLOOR.tier)) { let c = rolls[n - 1]; for (let k = 0; k < 200 && c.tier < GACHA_FLOOR.tier; k++) c = gachaRoll(); rolls[n - 1] = c; }
  for (const c of rolls) {
    if (pr.cards.length < 200) { pr.cards.push(c); if (pr.deck.length < deckMax(pr)) pr.deck.push(c.uid); }
    else { pr.storage = pr.storage || { cards: [], gear: [] }; pr.storage.cards.push(c); }   // (never lost: it waits in Storage at home)
    m.results.push(c);
  }
  m.t = 0; m.best = Math.max(...m.results.map(c => c.tier)); pachinkoStart(m);
  pr.pulls = (pr.pulls || 0) + n; pr.pullBest = Math.max(pr.pullBest == null ? -1 : pr.pullBest, m.best);   // (the casino shrine's YOUR RECORD)
  game.save();
}
function updateGacha(game, m, dt) {
  m.t += dt;
  if (m.results) {
    pachinkoTick(m, dt);
    const done = m.t > m.intro + REVEAL.flipAt + m.results.length * REVEAL.flipEach + 500;
    if ((hit('Enter', 'Space', 'Escape', 'KeyJ', 'KeyF') || mouse.click) && m.t > 300) {
      if (!done) m.t = 99999; else m.results = null;   // first press skips the reveal, second returns
    }
    return;
  }
  const over = B => mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
  m.ang = ((m.ang || 0) + dt * (Object.values(GBTN).some(over) ? 0.0026 : 0.0004)) % (Math.PI * 2);   // the wheel spins up under your finger
  if (hit('Escape')) { game.closeMenu(); return; }
  const B = GBTN;   // 1, Enter, E, 0: x10 · 2: x100 (no single-card summon, no x1000)
  if (hit('Digit1', 'Digit0', 'KeyE', 'Enter') || clicked(B.ten.x, B.ten.y, B.ten.w, B.ten.h)) summon(game, m, 10);
  else if (hit('Digit2') || clicked(B.hund.x, B.hund.y, B.hund.w, B.hund.h)) summon(game, m, 100);
}
function drawGacha(game, m, now) {
  const pr = game.profile;
  if (m.results) {   // the pachinko machine, then the cards (pachinko.js)
    if (m.t < m.intro) { ctx.save(); pachinkoCamera(m, now); drawPachinko(game, m, now); ctx.restore(); return; }
    const L = cabLight(m, now); ctx.fillStyle = '#08040e'; ctx.fillRect(0, 0, VW, VH);
    drawSummonStage(now); drawCabinetFrame(L, now); drawCabinetTray(L, now); ledPlate(420, 312, 86, 24, pr.coins || 0, now); summonTokens(pr.coins || 0, now, true);
    const T0 = m.t; m.t -= m.intro;   // the reveal runs on its own clock after the jackpot
    drawSummonReveal(m, now);
    m.t = T0; return;
  }
  drawCasinoShrine(game, m, now);   // (casino.js)
}
// THE REVEAL: the cards burst out of the middle of the screen towards you and land in the air over the wheel, each with a
// shadow on the floor, then flip one by one. Every flip flashes; A and up throw a ring of light and keep a turning glow, and
// the best card stands in a pillar of light. Ten cards use the art-first mini card; a single card is the full card.
const REVEAL = { small: { w: 68, h: 95, gapX: 16, gapY: 16, y: 38 }, big: { w: 112, h: 172, y: 56 }, cols: 5, fly: 420, stagger: 45, flipAt: 800, flipEach: 180, flipMs: 300, from: 0.15, glowFrom: 5 };
const revealEase = t => { const c = 1.9, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
function drawSummonReveal(m, now) {
  const V = REVEAL, F = CASINO.fx, R = m.results, n = R.length, S = n > 1 ? V.small : V.big, cols = n > 1 ? V.cols : 1, W = S.w, H = S.h, gapX = S.gapX || 0, gapY = S.gapY || 0;
  const gx0 = VW / 2 - (cols * (W + gapX) - gapX) / 2, gy0 = S.y, age = m.t;
  if (age < 240) { ctx.fillStyle = `rgba(255,255,255,${1 - age / 240})`; ctx.fillRect(0, 0, VW, VH); }
  R.forEach((c, i) => {
    const tx = gx0 + (i % cols) * (W + gapX) + W / 2, ty = gy0 + Math.floor(i / cols) * (H + gapY) + H / 2, fly = Math.min(1, Math.max(0, (age - i * V.stagger) / V.fly)), e = revealEase(fly), sc = V.from + (1 - V.from) * e;
    const flip = Math.min(1, Math.max(0, (age - V.flipAt - i * V.flipEach) / V.flipMs)), done = flip >= 1, col = rankColor(c.tier, now), bob = fly >= 1 ? Math.sin(now / 520 + i * 1.3) * 2.2 : 0, best = c.tier === m.best && m.best >= V.glowFrom;
    if (fly <= 0) return;
    const x = VW / 2 + (tx - VW / 2) * e, y = 170 + (ty - 170) * e + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + H * 0.56 * sc + 6 - bob, W * 0.42 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill();   // its shadow below it
    if (flip > 0 && c.tier >= V.glowFrom) {   // the glow that stays, turning behind the card
      const t = c.tier >= 8 ? F.white : c.tier >= 6 ? F.gold : F.violet; casinoFx(F.light, t, x, y, H * 2.1, now / 900, Math.min(1, flip * 1.5) * 0.9); casinoFx(F.star9, t, x, y, H * 1.9 + 8 * Math.sin(now / 150 + i), -now / 1400, Math.min(1, flip * 1.5) * 0.7);
    }
    if (best && flip > 0) {   // the pillar
      const pg = ctx.createLinearGradient(x - W, 0, x + W, 0); pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(0.5, 'rgba(255,240,190,0.75)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, flip * 2) * (0.75 + 0.25 * Math.sin(now / 130)); ctx.fillStyle = pg; ctx.fillRect(x - W, 0, W * 2, VH); ctx.restore();
    }
    if (flip > 0.25 && flip < 1) {   // the flash of the flip, a ring of light flying out
      const fk = (flip - 0.25) / 0.75, big = c.tier >= V.glowFrom;
      casinoFx(F.ring, c.tier >= 6 ? F.gold : F.violet, x, y, W * (1.2 + fk * (big ? 3.6 : 1.8)), 0, 1 - fk);
      if (big) for (let k = 0; k < 8; k++) { const an = k / 8 * Math.PI * 2 + i, d = W * (0.5 + fk * 1.3); casinoFx(F.star8, F.white, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.8, 26 * (1 - fk), an, 1); }
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    if (flip <= 0) drawCardBack(x - W / 2, y - H / 2, W, H, now); else drawCardFlip(c, x, y, W, H, flip, now, n === 1);
    ctx.restore();
    
  });
  const end = V.flipAt + n * V.flipEach + 500, ready = age > end;
  text(ready ? 'Click / Enter to continue' : 'Click to skip', 96, VH - 16, `rgba(255,255,255,${0.5 + 0.4 * Math.sin(now / 250)})`, 8);
}
// a steel plate like the inventory's: dark slate, a bevelled rim
function shrinePlate(x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8 * RES; ctx.shadowOffsetY = 3 * RES;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(42,51,70,0.94)'); g.addColorStop(1, 'rgba(18,22,32,0.94)');
  ctx.fillStyle = g; rrect(ctx, x, y, w, h, 6); ctx.fill(); ctx.restore();
  const rim = ctx.createLinearGradient(x, y, x + w, y + h); rim.addColorStop(0, '#e0e6f0'); rim.addColorStop(0.45, '#7a8498'); rim.addColorStop(1, '#262c3a');
  ctx.strokeStyle = rim; ctx.lineWidth = 1.6; rrect(ctx, x + 0.8, y + 0.8, w - 1.6, h - 1.6, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; rrect(ctx, x + 3, y + 3, w - 6, h - 6, 4); ctx.stroke();
}
