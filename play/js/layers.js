'use strict';
// LAYER MASTERY: every Layer element (Divine, Storm, Inferno, Tidal, Terra, Verdant) has its own EXP. Only kills earn
// it: every monster that falls while you are transcended in that layer gives 3 + 2 per rank (bosses ×3). The EXP is
// spent on that layer's skills on the inventory's LAYER page.
// A fresh layer gives its +40% boost (attack, defence, move speed, MP regen) and LAYERING (pick cards on the HUD, V
// again fuses them into one skill); everything else is unlocked:
//   POWER            +10% more boost per level (up to +90%)
//   AWAKENING BURST  the blast and pillars when you transcend (stronger with each level)
//   ELEMENT STRIKE   the element's own attack while transcended (Light Storm, Storm Lash, …), faster with each level
//   ASCENDED BLOWS   faster, longer melee blows that land like meteors (shockwave + echo)
//   ENDURANCE        lasts longer (15 s, +3 s per level)
//   RECOVERY         shorter cooldown and exhaustion
// Saved on the profile as pr.layerM = { [element]: { xp (to spend), total (ever earned), sk: { key: level } } }.
// Opponents without a profile of their own (arena CPU) fight with every skill maxed.

const LAYER_SKILLS = {
  power:   { name: 'Power',           max: 5, cost: [40, 80, 140, 220, 320], desc: l => `+${40 + l * 10}% attack, defence, speed, MP regen` },
  burst:   { name: 'Awakening Burst', max: 3, cost: [50, 120, 220],          desc: l => l ? `a blast as you transcend · ${100 + (l - 1) * 25}% power` : 'a blast as you transcend' },
  strike:  { name: 'Element Strike',  max: 3, cost: [60, 140, 240],          desc: (l, el) => `${LAYER_STRIKE[el]} every ${[3.5, 3.5, 3.0, 2.5][l]} s` },
  ascend:  { name: 'Ascended Blows',  max: 1, cost: [120],                   desc: () => 'faster, longer blows that land like meteors' },
  endure:  { name: 'Endurance',       max: 3, cost: [60, 120, 200],          desc: l => `lasts ${15 + l * 3} s` },
  wideParry: { name: 'Wide Parry',    max: 3, cost: [50, 110, 190],          desc: l => `perfect parry window ${GUARD.perfect + 60 * l} ms` },
  iron:    { name: 'Iron Bubble',     max: 3, cost: [60, 130, 210],          desc: l => `shield stamina ${100 + 25 * l}${l ? `, refills ${20 * l}% faster` : ''}` },
  sburst:  { name: 'Shield Burst',    max: 3, cost: [80, 160, 260],          desc: l => `let go of a full shield: a ${l ? [0, 100, 140, 180][l] + '% ' : ''}blast round you` },
  recover: { name: 'Recovery',        max: 3, cost: [80, 160, 260],          desc: l => `cooldown ${Math.round(30 * (1 - 0.1 * l))} s · exhausted ${+(LAYER.exhaustDur / 1000 * (1 - 0.25 * l)).toFixed(2)} s` },
};
const LAYER_SK_KEYS = Object.keys(LAYER_SKILLS);
const LAYER_UNLOCK = ['burst', 'strike', 'ascend', 'sburst'];   // these do nothing at level 0
const LAYER_STRIKE = { holy: 'Light Storm', lightning: 'Storm Lash', fire: 'Inferno Shot', water: 'Tidal Crash', earth: 'Stone Spike', grass: 'Vine Snare' };
const STRIKE_MS = [0, 3500, 3000, 2500];   // (3.5 s at level 1, quicker with each level)

function layerMastery(store, el) {
  const M = store[el] || (store[el] = { xp: 0, total: 0, sk: {} });
  if (M.sk.layered) { M.xp += 150; delete M.sk.layered; }   // layering is part of every layer now: its old unlock is refunded
  for (const k of LAYER_SK_KEYS) M.sk[k] = M.sk[k] || 0;
  return M;
}
// a skill's level for an actor's current layer (the CPU, with no mastery of its own, has everything)
function lsk(a, key) {
  if (!a.layerM) return LAYER_SKILLS[key].max;
  return layerMastery(a.layerM, layerNow(a)).sk[key];
}
// the layer that counts: the one it is transcended in, else the one picked on the LAYER page
const layerNow = a => a.transcend > 0 && a.layerEl ? a.layerEl : layerElementOf(a);
const layerBoost = a => 1.4 + 0.1 * lsk(a, 'power');
const layerDur = a => 15000 + 3000 * lsk(a, 'endure');
const layerCdOf = a => LAYER.cd * (1 - 0.1 * lsk(a, 'recover'));
const layerExhaust = a => LAYER.exhaustDur * (1 - 0.25 * lsk(a, 'recover'));
function gainLayerXp(a, n) {
  if (!a.layerM || !(n > 0)) return;
  const M = layerMastery(a.layerM, layerNow(a)); M.xp += n; M.total += n; a.lxpRun = (a.lxpRun || 0) + n;
}
// the transcendence ended: tell the player what it earned
function layerRunDone(a) {
  if (!a.layerM || !a.lxpRun || !window.GAME) return;
  const M = layerMastery(a.layerM, a.layerEl), L = LAYER_ELS[a.layerEl];
  GAME.toast(`${L.name} Layer +${Math.round(a.lxpRun)} XP (${Math.floor(M.xp)} to spend) — Tab ▸ LAYER to upgrade`, L.mote);
  a.lxpRun = 0; GAME.save();
}
function upgradeLayerSkill(game, el, key) {
  const M = layerMastery(game.profile.layerM = game.profile.layerM || {}, el), S = LAYER_SKILLS[key], l = M.sk[key];
  if (l >= S.max) { game.toast(`${S.name} is already maxed`, '#c9c1a8'); return; }
  const c = S.cost[l];
  if (M.xp < c) { game.toast(`${S.name} needs ${c} ${LAYER_ELS[el].name} XP — you have ${Math.floor(M.xp)}. Use this layer more!`, '#ff8a8a'); return; }
  M.xp -= c; M.sk[key]++;
  game.toast(`${LAYER_ELS[el].name} · ${S.name} ${l ? 'Lv ' + M.sk[key] : 'UNLOCKED'} — ${S.desc(M.sk[key], el)}`, LAYER_ELS[el].mote);
  game.save(); if (typeof game.refreshPlayer === 'function') game.refreshPlayer();
}

// ---- the right-hand page of LAYER: the highlighted element's mastery
const LSK_ROW = i => ({ x: PAGE_R.x + 12, y: 96 + i * 24, w: PAGE_R.w - 24, h: 22 });   // (nine skills: the shield's three too)
const LSK_BTN = i => { const R = LSK_ROW(i); return { x: R.x + R.w - 58, y: R.y + 4, w: 52, h: 14 }; };
function updateLayerSkills(game, m) {
  const el = LAYER_CHOICES[m.cur], k = navInput();
  if (!el) { m.col = 0; return false; }
  if (m.col === 1) {
    if (k.u) m.sk = (m.sk + LAYER_SK_KEYS.length - 1) % LAYER_SK_KEYS.length;
    if (k.d) m.sk = (m.sk + 1) % LAYER_SK_KEYS.length;
    if (k.ok) upgradeLayerSkill(game, el, LAYER_SK_KEYS[m.sk]);
    if (k.l || k.back) m.col = 0;
  }
  LAYER_SK_KEYS.forEach((key, i) => {
    const B = LSK_BTN(i), R = LSK_ROW(i);
    if (clicked(B.x, B.y, B.w, B.h)) { m.col = 1; m.sk = i; upgradeLayerSkill(game, el, key); }
    else if (clicked(R.x, R.y, R.w, R.h)) { m.col = 1; m.sk = i; }
  });
  return m.col === 1;
}
function drawLayerSkillsPage(game, m, now) {
  const P = PAGE_R, el = LAYER_CHOICES[m.cur], L = LAYER_ELS[el], M = layerMastery(game.profile.layerM = game.profile.layerM || {}, el);
  goldTitle(`${L.name.toUpperCase()} MASTERY`, P.x + P.w / 2, 66, 12, now);
  ink(`${Math.floor(M.xp)} XP to spend`, P.x + 14, 86, '#2a6a2a', 8);
  ink(`earned ${Math.floor(M.total)} from kills`, P.x + P.w - 14, 86, INK_SOFT, 6.6, 'right', false);
  LAYER_SK_KEYS.forEach((key, i) => {
    const S = LAYER_SKILLS[key], l = M.sk[key], R = LSK_ROW(i), B = LSK_BTN(i), max = l >= S.max, cost = S.cost[l], can = !max && M.xp >= cost;
    const locked = LAYER_UNLOCK.includes(key) && !l, sel = m.col === 1 && m.sk === i;
    ctx.fillStyle = sel ? 'rgba(120,140,180,0.28)' : locked ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)'; rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 5); ctx.stroke(); }
    ink(`${locked ? '🔒 ' : ''}${S.name}`, R.x + 8, R.y + 7, locked ? '#7a6a5a' : id2col(el), 8);
    for (let p = 0; p < S.max; p++) { ctx.fillStyle = p < l ? L.body : 'rgba(80,60,40,0.3)'; ctx.fillRect(R.x + 8 + textW(`${locked ? '🔒 ' : ''}${S.name}`, 8) + 6 + p * 6, R.y + 4, 4, 5); }
    // one short line: what it does now — or, on the chosen row, what the next level gives
    const line = locked ? S.desc(1, el) : sel && !max ? `next: ${S.desc(l + 1, el)}` : S.desc(l, el);
    ink(line, R.x + 8, R.y + 16, sel && !max && !locked ? '#2a6a2a' : INK_SOFT, 5.8, 'left', false);
    ctx.fillStyle = max ? 'rgba(200,160,40,0.5)' : can ? '#3a8a3a' : 'rgba(110,90,70,0.45)'; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill();
    text(max ? 'MAX' : `${locked ? 'UNLOCK' : 'UP'} ${cost}`, B.x + B.w / 2, B.y + B.h / 2 + 0.4, max ? '#fff6d0' : can ? '#ffffff' : '#e8dcc8', 6.4);
  });
  ink('Earn its XP by killing monsters while transcended in this layer.', P.x + P.w / 2, 320, INK_SOFT, 6, 'center', false);
}
const id2col = el => el === 'holy' ? '#8a5a00' : LAYER_ELS[el].halo;
