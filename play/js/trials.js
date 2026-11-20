'use strict';
// THE TRIALS OF THE SUN — the endgame, opened by the ending (pr.story.done). The Sovereign's power burned off into the
// Guardians, and they rise again stronger: every Guardian in the world is now a TRIAL boss of your current tier (all
// the same strength whatever the zone), with its kit sped up and one borrowed move (bosses.js TRIAL_EXTRA). Bring down
// all four and the Sun Sovereign rises again in the temple; beat it and the next, harder tier begins. Without end.
// SUN SIGILS come from every Trial kill (most for each tier's first) and buy things found nowhere else, at the Sigil
// Exchange (M, then T). pr.trial = { tier, done: { zone: true }, sigils, bought: { id: n } }.

const TRIAL = { hp: 16000, sovHp: 45000, atk: 1.7, sovAtk: 2, hpStep: 1.4, atkStep: 1.2, haste: 0.12, hasteMax: 1.6 };
const trialsOpen = pr => !!(pr && pr.story && pr.story.done);
function trialState(pr) { return pr.trial || (pr.trial = { tier: 1, done: {}, sigils: 0, bought: {} }); }
const trialTier = pr => trialsOpen(pr) ? trialState(pr).tier : 0;
const trialCount = S => [0, 1, 2, 3].filter(z => S.done[z]).length;
// a Trial boss's strength comes from its tier alone, measured from the Abyss's toughest kind at SSS+
function trialStats(m, T, sov) {
  const sp = ZONES[3].mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0];
  m.maxHp = m.hp = Math.round((sov ? TRIAL.sovHp : TRIAL.hp) * Math.pow(TRIAL.hpStep, T - 1));
  m.atk = SPECIES[sp].dmg * DMG_MULT[9] * (sov ? TRIAL.sovAtk : TRIAL.atk) * Math.pow(TRIAL.atkStep, T - 1);
  m.trial = T; m.kitHaste = Math.min(TRIAL.hasteMax, 1 + TRIAL.haste * T); m.shiny = true;
}
const trialSigils = (T, sov, first) => sov ? 30 + T * 10 : first ? 6 + T * 2 : 2;
// each world frame (main.js): old Guardians out of sight give way to this tier's, and the Sovereign rises when all four are down
function trialTick(game, w) {
  const pr = game.profile; if (!trialsOpen(pr) || !w.overworld || !w.guardians) return;
  const S = trialState(pr), p = w.player; if (!p) return;
  for (const G of w.guardians) if (G.m && !G.m.dead && !G.m.remove && G.m.trial !== S.tier && Math.abs(G.m.x - p.x) > 520) { G.m.remove = true; G.m = null; G.t = 1; }
  if (trialCount(S) < 4 || w.actors.some(a => a.trialSovereign && !a.dead)) return;
  const at = finalSpot(w); if (!at || Math.abs(p.x - at.x) > 700) return;
  const sp = ZONES[3].mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0], m = makeMonster(sp, 9, at.x, at.y);
  Object.assign(m, { boss: true, trialSovereign: true, scale: STORY_FINAL.scale, heavy: true, home: { x: at.x, y: at.y } });
  giveKit(m, 'sovereign'); trialStats(m, S.tier, true); m.label = STORY_FINAL.name;
  w.actors.push(m);
  if (w._trialSeen !== S.tier) { w._trialSeen = S.tier; w.shake = Math.max(w.shake || 0, 8); w.flash = { t: 0, dur: 900, col: '#ffe9a8' }; game.toast(`THE SUN SOVEREIGN RISES AGAIN — Trial ${S.tier}`, '#ffd23f'); }
}
function trialKill(game, w, m) {
  const pr = game.profile, S = trialState(pr), T = m.trial;
  if (m.trialSovereign) {
    const sig = trialSigils(T, true);
    S.sigils += sig; pr.gold = (pr.gold || 0) + 10000 * T; game.gainExp(expNeed(pr.lv || 1) * 2);
    game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), 9, pr.cls) });
    if (T === S.tier) { S.tier++; S.done = {}; }
    w.flash = { t: 0, dur: 1100, col: '#ffe9a8' };
    game.toast(`☀ TRIAL ${T} CLEARED — +${sig} Sun Sigils. The Guardians rise stronger: Trial ${S.tier}.`, '#ffd23f');
    game.save(); return;
  }
  const first = T === S.tier && !S.done[m.guardian], sig = trialSigils(T, false, first);
  S.sigils += sig; game.gainExp(Math.round(expNeed(pr.lv || 1) * (first ? 0.5 : 0.1)));
  if (first) {
    S.done[m.guardian] = true; pr.gold = (pr.gold || 0) + 2500 * T;
    const n = trialCount(S);
    game.toast(n < 4 ? `☀ Trial ${T}: ${n} of 4 Guardians down — +${sig} Sun Sigils` : `☀ All four have fallen — +${sig} Sun Sigils. The Sun Temple stirs…`, '#ffd23f');
  } else game.toast(`Guardian defeated again — +${sig} Sun Sigils`, '#ffe9a8');
  game.save();
}
// ---------------------------------------------------------------- the Sigil Exchange
const sunCard = () => Object.assign(makeCard(pick(ZONES[3].mobs.filter(id => D.monsters[id])), 9), { sun: true });
const TRIAL_SHOP = [
  { id: 'cache', name: 'Sun Cache', how: '5,000 G and 10 coins', cost: 10, buy(game, pr) { pr.gold = (pr.gold || 0) + 5000; pr.coins = (pr.coins || 0) + 10; } },
  { id: 'gear', name: 'Sunforged Gear', how: 'A random SSS+ piece for your class', cost: 30, buy(game, pr) { game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), 9, pr.cls) }); } },
  { id: 'card', name: 'Sunforged Card', how: 'SSS+, gold-rimmed, passive 25% stronger', cost: 50, buy(game) { game.pickup({ kind: 'card', item: sunCard() }); } },
  { id: 'title', name: 'Title: Sunbearer', how: 'A MYTHIC title, sold once', cost: 120, once: true, buy() {} },
];
const trialRow = i => ({ x: 322, y: 74 + i * 50, w: 298, h: 44 });
const trialBuyBtn = R => ({ x: R.x + R.w - 62, y: R.y + 10, w: 54, h: 24 });
const TRIAL_MAP_BTN = { x: VW - 122, y: 12, w: 110, h: 18 };   // on the journey map
function trialsMenu() { return { type: 'trials', t: 0, sel: 0 }; }
function trialBuy(game, I) {
  const pr = game.profile, S = trialState(pr), sold = I.once && S.bought[I.id];
  if (sold) { game.toast('You already own this', '#c9c1a8'); return; }
  if (S.sigils < I.cost) { game.toast(`${I.name} costs ${I.cost} Sun Sigils — you have ${S.sigils}`, '#ff8a8a'); return; }
  S.sigils -= I.cost; S.bought[I.id] = (S.bought[I.id] || 0) + 1; I.buy(game, pr);
  game.toast(`☀ ${I.name} bought`, '#ffd23f'); game.save();
}
function updateTrialsMenu(game, m, dt) {
  m.t += dt;
  if (hit('Escape', 'KeyT', 'KeyM')) { game.closeMenu(); return; }
  if (hit('ArrowUp', 'KeyW')) m.sel = (m.sel + TRIAL_SHOP.length - 1) % TRIAL_SHOP.length;
  if (hit('ArrowDown', 'KeyS')) m.sel = (m.sel + 1) % TRIAL_SHOP.length;
  if (hit('Enter')) trialBuy(game, TRIAL_SHOP[m.sel]);
  TRIAL_SHOP.forEach((I, i) => { if (clicked(...Object.values(trialBuyBtn(trialRow(i))))) { m.sel = i; trialBuy(game, I); } });
}
function drawTrialsMenu(game, m, now) {
  const pr = game.profile, S = trialState(pr), n = trialCount(S);
  ctx.fillStyle = 'rgba(6,4,12,0.92)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle('TRIALS OF THE SUN', VW / 2, 22, 16, now);
  text('The Guardians rise again, stronger each time. Bring them down.', VW / 2, 38, '#c9b89a', 7);
  panel(20, 56, 288, 262);
  text(`TRIAL ${S.tier}`, 164, 72, '#ffd23f', 11);
  text(`Guardians ×${Math.round(Math.pow(TRIAL.hpStep, S.tier - 1) * 100) / 100} HP   ·   ×${Math.round(Math.pow(TRIAL.atkStep, S.tier - 1) * 100) / 100} attack`, 164, 86, '#9a917c', 7);
  GUARDIAN_KITS.forEach((k, z) => {
    const y = 110 + z * 34, done = S.done[z];
    text(done ? '✔' : '☠', 38, y, done ? '#8fffd0' : '#ff8a8a', 9);
    text(KITS[k].name, 52, y - 5, KITS[k].col, 8, 'left');
    text(`${ZONES[z].name} — the seal bridge`, 52, y + 6, '#9a917c', 6.5, 'left');
    text(done ? `+2 Sigils again` : `+${trialSigils(S.tier, false, true)} Sigils`, 296, y, done ? '#9a917c' : '#ffe08a', 7, 'right');
  });
  const y = 110 + 4 * 34, open = n >= 4;
  text(open ? '☀' : '✖', 38, y, open ? '#ffd23f' : '#5a5468', 9);
  text('The Sun Sovereign', 52, y - 5, open ? '#ffd23f' : '#6a6478', 8, 'left');
  text(open ? 'Waiting in the Sun Temple' : `Rises when all four fall (${n}/4)`, 52, y + 6, '#9a917c', 6.5, 'left');
  text(`+${trialSigils(S.tier, true)} Sigils`, 296, y, open ? '#ffe08a' : '#6a6478', 7, 'right');
  text(`Trials cleared: ${S.tier - 1}`, 164, 296, '#c9b89a', 7.5);
  // the Exchange
  text('SIGIL EXCHANGE', 322, 62, '#ffe9a8', 8.5, 'left');
  text(`☀ ${S.sigils} Sun Sigils`, 620, 62, '#ffd23f', 8.5, 'right');
  TRIAL_SHOP.forEach((I, i) => {
    const R = trialRow(i), B = trialBuyBtn(R), sold = I.once && S.bought[I.id], can = !sold && S.sigils >= I.cost;
    panel(R.x, R.y, R.w, R.h, i === m.sel ? '#ffd23f' : '#6a5a3a');
    text(I.name, R.x + 8, R.y + 13, '#ffe9a8', 8, 'left');
    text(I.how, R.x + 8, R.y + 28, '#c9b89a', 6.5, 'left');
    ctx.fillStyle = can ? '#7a5a14' : '#342216'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill();
    text(sold ? 'OWNED' : `☀ ${I.cost}`, B.x + B.w / 2, B.y + 12, can ? '#ffe9a8' : '#7a7488', 8);
  });
  text('↑ ↓ / Enter or click: buy   ·   T / Esc: close', VW / 2, VH - 12, '#9a917c', 7);
}
// a Sunforged card's gold rim, over its frame
function drawSunRim(x, y, w, h, ar) {
  let cw = w, ch = w * ar; if (ch > h) { ch = h; cw = h / ar; }
  const cx = x + (w - cw) / 2, cy = y + (h - ch) / 2;
  ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(1, cw * 0.022); ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 4 * RES;
  rrect(ctx, cx + 0.5, cy + 0.5, cw - 1, ch - 1, Math.max(2, cw * 0.05)); ctx.stroke(); ctx.restore();
}
