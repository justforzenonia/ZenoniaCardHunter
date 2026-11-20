'use strict';
// TITLES: earned by playing, worn over the hero's head. Six tiers — the harder a title is to earn, the grander it looks:
//   COMMON     plain silver lettering
//   UNCOMMON   green lettering on a dark pill
//   RARE       a glowing sapphire plate with diamond studs
//   EPIC       an amethyst plate with a light sweeping across it and star studs, gently pulsing
//   LEGENDARY  a forged gold plate, gold lettering, golden wings and sparkles
//   MYTHIC     a prism plate whose rim runs through every colour, rainbow lettering, cosmic wings, a crown and
//              stars orbiting it
// Progress comes from the profile (level, cards, the hound, Layer mastery) and a few counters kept in pr.stats
// (bumpStat). pr.titles = { id: time earned }, pr.title = the one you wear. Y opens the TITLES screen. The title you wear
// also gives its passives (TITLE_PASSIVES): one per tier step, stronger the higher the tier.

const TITLE_TIERS = [
  { name: 'COMMON', col: '#d8dce4' }, { name: 'UNCOMMON', col: '#7aea8a' }, { name: 'RARE', col: '#6ac8ff' },
  { name: 'EPIC', col: '#c88aff' }, { name: 'LEGENDARY', col: '#ffd23f' }, { name: 'MYTHIC', col: '#ff8aff' },
];
const titleStat = (pr, k) => (pr.stats && pr.stats[k]) || 0;
const maxCardTier = pr => pr.cards.reduce((m, c) => Math.max(m, c.tier || 0), -1);
const cardsAtLeast = (pr, t) => pr.cards.filter(c => (c.tier || 0) >= t).length;
const partnerDays = pr => { const P = pr.partner; return P ? (P.fellOn || dayNo()) - (P.since || dayNo()) : 0; };
const layerMaxed = pr => Object.values(pr.layerM || {}).some(M => LAYER_SK_KEYS.every(k => (M.sk[k] || 0) >= LAYER_SKILLS[k].max));
// [id, name, tier, what to do, progress (pr) → [have, need]]
const TITLE_LIST = [
  ['novice',      'Novice Hunter',        0, 'Reach level 12',                           pr => [pr.lv, 12]],
  ['squasher',    'Slime Squasher',       0, 'Defeat 400 monsters',                      pr => [titleStat(pr, 'kills'), 400]],
  ['greenthumb',  'Green Thumb',          0, 'Reach Farm Level 8',                       pr => [(pr.farmer && pr.farmer.lv) || 1, 8]],
  ['petpal',      'Best Friend',          0, 'Raise your hound to level 10',             pr => [(pr.pet && pr.pet.lv) || 0, 10]],
  ['hunter',      'Monster Hunter',       1, 'Defeat 3,000 monsters',                    pr => [titleStat(pr, 'kills'), 3000]],
  ['collector',   'Card Collector',       1, 'Own 150 cards at once',                    pr => [pr.cards.length, 150]],
  ['tenant',      'Good Tenant',          1, 'Pay the rent 3 times (the house is yours)', pr => [titleStat(pr, 'rentPaid'), 3]],
  ['ironwall',    'Iron Wall',            1, 'Land 250 perfect parries',                 pr => [titleStat(pr, 'parries'), 250]],
  ['veteran',     'Veteran',              2, 'Reach level 45',                           pr => [pr.lv, 45]],
  ['voidwalker',  'Void Walker',          2, 'Defeat 25 black hole bosses',              pr => [titleStat(pr, 'holeBosses'), 25]],
  ['alchemist',   'Alchemist',            2, 'Fuse cards successfully 150 times',        pr => [titleStat(pr, 'fusions'), 150]],
  ['mercbane',    'Mercenary Bane',       2, "Defeat 200 of the landlord's mercenaries", pr => [titleStat(pr, 'mercs'), 200]],
  ['champion',    'Champion of the Wilds', 3, 'Defeat 25,000 monsters',                  pr => [titleStat(pr, 'kills'), 25000]],
  ['beastmaster', 'Beastmaster',          3, 'Raise your hound to level 60',             pr => [(pr.pet && pr.pet.lv) || 0, 60]],
  ['transcend',   'Transcendent',         3, 'Use your Layer 2,000 times',               pr => [titleStat(pr, 'layers'), 2000]],
  ['giantslayer', 'Giant Slayer',         3, 'Defeat 300 mini bosses',                   pr => [titleStat(pr, 'miniBosses'), 300]],
  ['legend',      'Legend Bearer',        4, 'Own 8 cards of rank SSS or higher at once', pr => [cardsAtLeast(pr, 8), 8]],   // (one lucky summon was enough before)
  ['abyss',       'Abyss Conqueror',      4, 'Defeat 150 black hole bosses',             pr => [titleStat(pr, 'holeBosses'), 150]],
  ['layermaster', 'Layer Master',         4, 'Max every skill of one Layer',             pr => [layerMaxed(pr) ? 1 : 0, 1]],
  ['living',      'Living Legend',        4, 'Reach level 85',                           pr => [pr.lv, 85]],
  ['chosen',      "Zenonia's Chosen",     5, 'Own 6 SSS+ cards at once',                 pr => [cardsAtLeast(pr, 9), 6]],
  ['godslayer',   'Godslayer',            5, 'Defeat 500 black hole bosses',             pr => [titleStat(pr, 'holeBosses'), 500]],
  ['eternal',     'The Eternal',          5, 'Reach level 99',                           pr => [pr.lv, 99]],
  ['trialmaster', 'Trial Master',         4, 'Clear 3 Trials of the Sun',                pr => [pr.trial ? pr.trial.tier - 1 : 0, 3]],
  ['angler',      'Master Angler',        3, 'Fill every page of the Fish Book',         pr => [pr.town ? Object.keys(pr.town.fish).length : 0, FISH.flat().length]],
  ['tablemaster', 'Master of the Table',  3, 'Beat all five at the Lantern Table',        pr => [pr.town ? Object.keys(pr.town.duels).length : 0, 5]],
  ['townfriend',  'Friend of the Four Towns', 4, 'Reach Renown 5 in all four towns',      pr => [[0, 1, 2, 3].filter(i => tlLevel(pr, i) >= 5).length, 4]],
  ['wakebreaker', 'Sleeper\'s Bane',      4, 'Finish The Purple Mitten',                  pr => [pr.frostCharm ? 1 : 0, 1]],
  ['gatebreaker', 'Gatebreaker',          3, 'Beat 40 evil NPCs in the Dark Court',       pr => [titleStat(pr, 'evils'), 40]],
  ['sworn',       'Sworn Companions',     2, 'Keep your partner alive for 10 days',       pr => [partnerDays(pr), 10]],
  ['sunbearer',   'Sunbearer',            5, 'Buy it at the Sigil Exchange',             pr => [pr.trial && pr.trial.bought.title ? 1 : 0, 1]],
].map(([id, name, tier, how, prog]) => ({ id, name, tier, how, prog }));
const TITLE_BY = Object.fromEntries(TITLE_LIST.map(t => [t.id, t]));
// Every title carries passives while you wear it: one per tier step (COMMON 1 … MYTHIC 6), and each at a strength
// that climbs with the tier (rank tier × 2, so a MYTHIC passive is as strong as an SSS+ card's)
const TITLE_PASSIVES = {
  novice: ['swift'], squasher: ['brutal'], greenthumb: ['regen'], petpal: ['hide'],
  hunter: ['brutal', 'crit'], collector: ['mana', 'evade'], tenant: ['barrier', 'regen'], ironwall: ['hide', 'thorns'],
  veteran: ['brutal', 'hide', 'crit'], voidwalker: ['evade', 'vamp', 'mana'], alchemist: ['mana', 'burst', 'barrier'], mercbane: ['crit', 'unstop', 'vamp'],
  champion: ['brutal', 'crit', 'frenzy', 'swift'], beastmaster: ['frenzy', 'hide', 'regen', 'thorns'], transcend: ['mana', 'barrier', 'last', 'swift'], giantslayer: ['brutal', 'unstop', 'last', 'crit'],
  legend: ['brutal', 'crit', 'vamp', 'hide', 'frenzy'], abyss: ['last', 'vamp', 'unstop', 'barrier', 'brutal'], layermaster: ['mana', 'frenzy', 'swift', 'crit', 'burst'], living: ['hide', 'regen', 'brutal', 'evade', 'barrier'],
  chosen: ['brutal', 'crit', 'vamp', 'hide', 'frenzy', 'swift'], godslayer: ['brutal', 'last', 'unstop', 'vamp', 'crit', 'barrier'], eternal: ['regen', 'hide', 'mana', 'evade', 'brutal', 'frenzy'],
  angler: ['regen', 'mana', 'evade', 'hide'], tablemaster: ['crit', 'burst', 'mana', 'evade'], townfriend: ['regen', 'hide', 'barrier', 'brutal', 'swift'],
  wakebreaker: ['hide', 'barrier', 'regen', 'brutal', 'crit'], sworn: ['hide', 'regen', 'barrier'], gatebreaker: ['brutal', 'evade', 'vamp', 'crit'],
  trialmaster: ['brutal', 'hide', 'crit', 'barrier', 'last'], sunbearer: ['brutal', 'crit', 'hide', 'vamp', 'barrier', 'regen'],
};
const titlePassiveList = t => (TITLE_PASSIVES[t.id] || []).map(id => ({ id, tier: Math.min(9, t.tier * 2), mul: 1, trait: null }));
// the worn title's passives (defs.js profileStats adds them to the hero's)
function titlePassives(pr) { const t = TITLE_BY[pr && pr.title]; return t && pr.titles && pr.titles[t.id] ? titlePassiveList(t) : []; }
const titlePassiveText = t => titlePassiveList(t).map(p => `${PASSIVES[p.id].name} ${PASSIVES[p.id].fmt(passiveValue(p.id, p.tier))}`);

function bumpStat(key, n = 1) {
  const pr = window.GAME && GAME.profile; if (!pr) return;
  pr.stats = pr.stats || {}; pr.stats[key] = (pr.stats[key] || 0) + n;
}
// once a second: any title newly earned is awarded (and worn, if it outranks the one you wear)
function titlesTick(game, dt) {
  const pr = game.profile; if (!pr || game.scene !== 'world') return;
  game.titleT = (game.titleT || 0) + dt; if (game.titleT < 1000) return; game.titleT = 0;
  pr.titles = pr.titles || {};
  for (const t of TITLE_LIST) {
    if (pr.titles[t.id]) continue;
    const [have, need] = t.prog(pr); if (have < need) continue;
    pr.titles[t.id] = Date.now();
    const cur = TITLE_BY[pr.title];
    if (!cur || t.tier >= cur.tier) { pr.title = t.id; game.refreshPlayer(); }
    (game.titleQ = game.titleQ || []).push(t.id);
    game.toast(`New title: ${t.name} (${TITLE_TIERS[t.tier].name}) — press Y to see your titles`, TITLE_TIERS[t.tier].col);
    game.save();
  }
}

// ---- the badge itself, centred on (cx, cy); s scales it
function drawTitleBadge(t, cx, cy, s, now) {
  const tier = t.tier, size = (6 + tier * 0.35) * s, tw = textW(t.name, size, true), w = tw + (10 + tier * 4) * s, h = (9 + tier * 0.8) * s, x = cx - w / 2, y = cy - h / 2;
  const hue = (now / 12) % 360, rain = k => `hsl(${(hue + k) % 360},100%,68%)`;
  ctx.save();
  if (tier >= 4) {   // wings behind the plate
    const R = w * 0.92;   // (drawWingPair hangs the wings R * 0.3 above y and R * 0.55 out: level them with the plate's ends)
    drawWingPair(cx, cy + R * 0.3 - h * 0.2, tier === 5 ? 'cosmic' : 'gold', h * (tier === 5 ? 2.4 : 2), R, now, 1, tier === 5);
  }
  if (tier === 0) { text(t.name, cx, cy, '#e8ecf4', size); ctx.restore(); return w; }
  // the plate
  const plate = [null, ['rgba(8,28,14,0.88)', 'rgba(8,28,14,0.88)'], ['#0c2a5a', '#2e1e13'], ['#3a1666', '#382518'], ['#3a2008', '#120802'], ['#2e1e13', '#08040e']][tier];
  ctx.shadowColor = tier === 5 ? rain(0) : TITLE_TIERS[tier].col; ctx.shadowBlur = (tier >= 2 ? 3 + tier * 1.5 : 0) * RES * (tier === 3 ? 0.8 + 0.4 * Math.sin(now / 300) : 1);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, plate[0]); g.addColorStop(1, plate[1]);
  ctx.fillStyle = g; rrect(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(0.6, (0.6 + tier * 0.15) * s);
  if (tier === 5) { const rg = ctx.createLinearGradient(x, 0, x + w, 0); for (let i = 0; i <= 6; i++) rg.addColorStop(i / 6, rain(i * 60)); ctx.strokeStyle = rg; }
  else ctx.strokeStyle = tier === 4 ? goldFrameGrad(y, h) : TITLE_TIERS[tier].col;
  rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2 - 0.5); ctx.stroke();
  if (tier === 3 || tier === 5) {   // a light sweeping across
    ctx.save(); rrect(ctx, x, y, w, h, h / 2); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    const sx = x - 20 * s + ((now / 1600) % 1.4) * (w + 40 * s), sw = ctx.createLinearGradient(sx, 0, sx + 16 * s, 0);
    sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(0.5, 'rgba(255,255,255,0.45)'); sw.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sw; ctx.fillRect(sx, y, 16 * s, h); ctx.restore();
  }
  // studs at the ends
  if (tier >= 2) {
    const stud = tier === 2 ? '◆' : tier === 3 ? '✦' : tier === 4 ? '❖' : '✸', sc = tier === 5 ? rain(180) : tier === 4 ? '#fff2b8' : TITLE_TIERS[tier].col;
    text(stud, x + 4 * s, cy + 0.2 * s, sc, size * 0.8); text(stud, x + w - 4 * s, cy + 0.2 * s, sc, size * 0.8);
  }
  // the lettering
  if (tier === 4) goldText(t.name, cx, cy + 0.3 * s, size, { glow: 'rgba(255,200,80,0.6)' });
  else if (tier === 5) drawPix(pixText(t.name, fontPx(size), 700, [rain(0), rain(120), rain(240)], '#1a0420'), cx, cy + 0.3 * s, 'center');
  else text(t.name, cx, cy + 0.3 * s, ['#e8ecf4', '#9affa8', '#bfe8ff', '#f0d8ff'][tier], size);
  // a crown and orbiting stars for MYTHIC, sparkles for LEGENDARY
  if (tier === 5) {
    text('♛', cx, y - 3.5 * s, '#ffe066', size * 1.2);
    for (let i = 0; i < 3; i++) { const an = now / 700 + i * 2.094; text('✦', cx + Math.cos(an) * (w / 2 + 4 * s), cy + Math.sin(an) * (h / 2 + 3 * s), rain(i * 120), size * 0.7); }
  }
  if (tier >= 4) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const k = ((now / 1300) + i / 5) % 1, sx = x + ((i * 37) % 100) / 100 * w, sy = y - 2 * s - k * 8 * s;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9; ctx.fillStyle = tier === 5 ? rain(i * 72) : '#fff2b8'; ctx.fillRect(sx, sy, 1.2 * s, 1.2 * s); }
  }
  ctx.restore();
  return w;
}
// over the hero's head (world.js), above the buff tile
function drawHeroTitle(a, y, now) {
  const pr = window.GAME && GAME.profile, t = pr && TITLE_BY[pr.title];
  if (!t || !GAME.world || a !== GAME.world.player) return;
  drawTitleBadge(t, a.x, y - (a.h || 28) * (a.scale || 1) - 24, 0.6, now);
}
// ---- a new title: it sweeps in big in the middle of the screen
function drawTitleFx(game, now) {
  if (!game.titleFx && game.titleQ && game.titleQ.length && !game.menu && !game.levelFx && !game.banner && !game.holeBanner) game.titleFx = { id: game.titleQ.shift(), t0: now };
  const F = game.titleFx; if (!F) return;
  const e = now - F.t0, D = 2600; if (e > D) { game.titleFx = null; return; }
  const t = TITLE_BY[F.id], k = Math.min(1, e / 350), out = Math.min(1, (D - e) / 400), pop = 1 + 0.12 * Math.max(0, 1 - e / 350);
  ctx.save(); ctx.globalAlpha = out;
  ctx.fillStyle = `rgba(6,4,14,${0.16 * k})`; ctx.fillRect(0, 0, VW, VH);   // (only a light veil: the world stays in view)
  goldText('NEW TITLE!', VW / 2, 120, 11 + t.tier, { glow: 'rgba(255,200,80,0.7)' });
  ctx.translate(VW / 2, 160); ctx.scale(pop * k, pop * k);
  drawTitleBadge(t, 0, 0, 1.6 + t.tier * 0.1, now);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = out * k;
  text(`${TITLE_TIERS[t.tier].name}  ·  ${t.how}`, VW / 2, 198, TITLE_TIERS[t.tier].col, 8);
  titlePassiveText(t).forEach((s, i) => text('✦ ' + s, VW / 2, 212 + i * 10, '#e8f0ff', 6.8));
  ctx.restore();
}

// ---- the inventory's TITLES tab: the list on the left page (tier colour, a mini badge, earned / progress), the
// chosen title in full on the right (its badge, how to earn it, progress, its passives, WEAR)
const TT_ROW = (m, i) => ({ x: PAGE_L.x + 12, y: 96 + (i - m.scroll) * 22, w: PAGE_L.w - 24, h: 20 }), TT_ROWS = 9;
const TT_WEAR = () => ({ x: PAGE_R.x + PAGE_R.w / 2 - 40, y: 288, w: 80, h: 18 });   // (a function: titles.js loads before inventory.js defines PAGE_R)
function wearTitle(game, t) {
  const pr = game.profile;
  if (!(pr.titles && pr.titles[t.id])) { game.toast(`Not earned yet — ${t.how}`, '#c9c1a8'); return; }
  pr.title = pr.title === t.id ? null : t.id; game.save(); game.refreshPlayer();
  game.toast(pr.title ? `Now wearing: ${t.name}` : 'Title taken off', TITLE_TIERS[t.tier].col);
}
function updateTitlesTab(game, m) {
  const k = navInput(), n = TITLE_LIST.length;
  if (k.u) m.cur = Math.max(0, m.cur - 1); if (k.d) m.cur = Math.min(n - 1, m.cur + 1);
  m.cur = clamp(m.cur, 0, n - 1);
  if (m.cur < m.scroll) m.scroll = m.cur; if (m.cur >= m.scroll + TT_ROWS) m.scroll = m.cur - TT_ROWS + 1;
  for (let i = m.scroll; i < Math.min(n, m.scroll + TT_ROWS); i++) { const R = TT_ROW(m, i); if (clicked(R.x, R.y, R.w, R.h)) m.cur = i; }
  const W = TT_WEAR();
  if (k.ok || clicked(W.x, W.y, W.w, W.h)) wearTitle(game, TITLE_LIST[m.cur]);
  if (hit('KeyY')) game.openMenu(titlesMenu());
}
function drawTitlesPage(game, m, now) {
  const pr = game.profile, got = pr.titles || {}, n = TITLE_LIST.length;
  pageHeader('TITLES', PAGE_L);
  ink(`${Object.keys(got).length} / ${n} earned`, PAGE_L.x + PAGE_L.w / 2, 89, INK_SOFT, 7, 'center', false);
  for (let i = m.scroll; i < Math.min(n, m.scroll + TT_ROWS); i++) {
    const t = TITLE_LIST[i], R = TT_ROW(m, i), have = !!got[t.id], sel = m.cur === i, on = pr.title === t.id, col = TITLE_TIERS[t.tier].col;
    ctx.fillStyle = sel ? 'rgba(255,240,200,0.6)' : on ? 'rgba(255,236,190,0.45)' : 'rgba(160,120,70,0.16)'; rrect(ctx, R.x, R.y, R.w, R.h, 4); ctx.fill();
    if (sel) { ctx.strokeStyle = 'rgba(120,70,20,0.7)'; ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 4); ctx.stroke(); }
    ctx.fillStyle = col; rrect(ctx, R.x + 3, R.y + 3, 3, R.h - 6, 1.5); ctx.fill();   // the tier's colour
    ctx.save(); ctx.beginPath(); ctx.rect(R.x + 8, R.y, 150, R.h); ctx.clip(); if (!have) { ctx.globalAlpha = 0.5; ctx.filter = 'grayscale(1)'; }
    drawTitleBadge(t, R.x + 80, R.y + R.h / 2, Math.min(0.8, 0.62 + t.tier * 0.03), have ? now : 0); ctx.restore();
    if (have) ink(on ? '✔ wearing' : '✔ earned', R.x + R.w - 6, R.y + R.h / 2 + 0.3, on ? '#2a7a2a' : '#5a7a3a', 6.4, 'right');
    else { const [hv, need] = t.prog(pr); ink(`${Math.floor(Math.min(1, hv / need) * 100)}%`, R.x + R.w - 6, R.y + R.h / 2 + 0.3, INK_SOFT, 6.4, 'right', false); }
  }
  if (n > TT_ROWS) ink(`↑↓ ${m.scroll + 1}–${Math.min(n, m.scroll + TT_ROWS)} of ${n}`, PAGE_L.x + PAGE_L.w / 2, 300, INK_SOFT, 6.4, 'center', false);
}
function drawTitleDetailPage(game, m, now) {
  const pr = game.profile, t = TITLE_LIST[m.cur], have = !!(pr.titles && pr.titles[t.id]), on = pr.title === t.id, col = TITLE_TIERS[t.tier].col, P = PAGE_R, cx = P.x + P.w / 2;
  pageHeader(TITLE_TIERS[t.tier].name, P);
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 4, 86, P.w - 8, 60); ctx.clip(); if (!have) { ctx.globalAlpha = 0.55; ctx.filter = 'grayscale(1)'; }
  drawTitleBadge(t, cx, 118, 1.35, now); ctx.restore();
  ink(t.how, cx, 158, INK, 8, 'center');
  const [hv, need] = t.prog(pr), k = have ? 1 : Math.min(1, hv / need);
  ctx.fillStyle = 'rgba(120,80,30,0.25)'; rrect(ctx, P.x + 40, 168, P.w - 80, 8, 4); ctx.fill();
  ctx.fillStyle = have ? '#5aa04a' : col; if (k > 0) { rrect(ctx, P.x + 40, 168, Math.max(8, (P.w - 80) * k), 8, 4); ctx.fill(); }
  ink(have ? 'EARNED' : `${Math.min(hv, need).toLocaleString()} / ${need.toLocaleString()}`, cx, 184, have ? '#2a7a2a' : INK_SOFT, 7, 'center');
  const pv = titlePassiveText(t);
  ink(`${pv.length} passive${pv.length === 1 ? '' : 's'} while worn`, cx, 200, '#8a5a10', 7.5, 'center');
  pv.forEach((s, i) => ink('◆ ' + s, P.x + 24, 214 + i * 11, INK, 6.8, 'left', false));
  const B = TT_WEAR(), hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
  ctx.fillStyle = !have ? 'rgba(120,100,80,0.4)' : on ? '#3a8a3a' : hov ? '#b07a2a' : '#8a5a1a'; rrect(ctx, B.x, B.y, B.w, B.h, 6); ctx.fill();
  text(!have ? '🔒 LOCKED' : on ? 'TAKE OFF' : 'WEAR', B.x + B.w / 2, B.y + B.h / 2 + 0.4, '#ffffff', 7.5);
}
// ---- the TITLES screen (Y): every title, grandest at the bottom; Enter wears the chosen one (again takes it off)
function titlesMenu() { return { type: 'titles', cur: 0, scroll: 0 }; }
const TM = { x: 60, y: 24, w: 520, h: 318, rowH: 25, rows: 9 };
const tmRow = (m, i) => ({ x: TM.x + 12, y: TM.y + 46 + (i - m.scroll) * TM.rowH, w: TM.w - 24, h: TM.rowH - 3 });
function updateTitlesMenu(game, m) {
  const pr = game.profile, k = navInput(), n = TITLE_LIST.length;
  if (k.back || hit('KeyY')) { game.closeMenu(); return; }
  if (k.u) m.cur = Math.max(0, m.cur - 1); if (k.d) m.cur = Math.min(n - 1, m.cur + 1);
  if (m.cur < m.scroll) m.scroll = m.cur; if (m.cur >= m.scroll + TM.rows) m.scroll = m.cur - TM.rows + 1;
  let act = k.ok;
  for (let i = m.scroll; i < Math.min(n, m.scroll + TM.rows); i++) { const R = tmRow(m, i); if (clicked(R.x, R.y, R.w, R.h)) { act = m.cur === i; m.cur = i; } }
  if (!act) return;
  const t = TITLE_LIST[m.cur];
  if (!(pr.titles && pr.titles[t.id])) { game.toast(`Not earned yet — ${t.how}`, '#c9c1a8'); return; }
  pr.title = pr.title === t.id ? null : t.id; game.save(); game.refreshPlayer();
  game.toast(pr.title ? `Now wearing: ${t.name}` : 'Title taken off', TITLE_TIERS[t.tier].col);
}
function drawTitlesMenu(game, m, now) {
  const pr = game.profile, got = pr.titles || {}, n = TITLE_LIST.length;
  ctx.fillStyle = 'rgba(6,4,14,0.78)'; ctx.fillRect(0, 0, VW, VH);
  zWindow(TM.x, TM.y, TM.w, TM.h);
  goldText('TITLES', VW / 2, TM.y + 16, 14, { spacing: 2, glow: 'rgba(255,200,80,0.5)' });
  text(`${Object.keys(got).length} / ${n} earned  ·  the harder a title is to earn, the grander it looks`, VW / 2, TM.y + 32, '#c9c1a8', 6.5);
  for (let i = m.scroll; i < Math.min(n, m.scroll + TM.rows); i++) {
    const t = TITLE_LIST[i], R = tmRow(m, i), have = !!got[t.id], sel = m.cur === i, on = pr.title === t.id, [hv, need] = t.prog(pr);
    ctx.fillStyle = sel ? 'rgba(255,215,120,0.16)' : 'rgba(0,0,0,0.25)'; rrect(ctx, R.x, R.y, R.w, R.h, 6); ctx.fill();
    ctx.strokeStyle = sel ? '#ffd23f' : hexA(TITLE_TIERS[t.tier].col, 0.35); ctx.lineWidth = sel ? 1.2 : 0.8; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 6); ctx.stroke();
    // the badge (greyed while locked)
    ctx.save(); if (!have) { ctx.globalAlpha = 0.45; ctx.filter = 'grayscale(1)'; }
    ctx.beginPath(); ctx.rect(R.x + 2, R.y - 6, 176, R.h + 10); ctx.clip();
    drawTitleBadge(t, R.x + 90, R.y + R.h / 2, 0.95, have ? now : 0); ctx.restore();
    text(TITLE_TIERS[t.tier].name, R.x + 196, R.y + 7, TITLE_TIERS[t.tier].col, 5.8, 'left');
    text(t.how, R.x + 196, R.y + 16, have ? '#e8e2cf' : '#9a917c', 6.4, 'left');
    if (have) {
      ctx.fillStyle = on ? '#3a8a3a' : 'rgba(90,70,40,0.8)'; rrect(ctx, R.x + R.w - 62, R.y + 4, 56, 14, 5); ctx.fill();
      text(on ? '✔ WEARING' : 'WEAR', R.x + R.w - 34, R.y + 11.3, '#ffffff', 6.4);
    } else {   // the progress
      const k2 = Math.min(1, hv / need);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; rrect(ctx, R.x + R.w - 92, R.y + 8, 86, 6, 3); ctx.fill();
      ctx.fillStyle = TITLE_TIERS[t.tier].col; if (k2 > 0) { rrect(ctx, R.x + R.w - 92, R.y + 8, Math.max(6, 86 * k2), 6, 3); ctx.fill(); }
      text(`${Math.min(hv, need).toLocaleString()} / ${need.toLocaleString()}`, R.x + R.w - 49, R.y + 18.5, '#9a917c', 5.4);
    }
  }
  // the chosen title's passives
  const ct = TITLE_LIST[m.cur], pv = titlePassiveText(ct), tc = TITLE_TIERS[ct.tier].col;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, TM.x + 12, TM.y + TM.h - 34, TM.w - 24, 29, 5); ctx.fill();
  ctx.strokeStyle = hexA(tc, 0.5); ctx.lineWidth = 0.8; rrect(ctx, TM.x + 12.5, TM.y + TM.h - 33.5, TM.w - 25, 28, 5); ctx.stroke();
  text(`${ct.name} · ${pv.length} passive${pv.length === 1 ? '' : 's'} while worn:`, TM.x + 20, TM.y + TM.h - 28, tc, 5.8, 'left');
  text(pv.slice(0, 3).join('  ·  '), TM.x + 20, TM.y + TM.h - 19.5, '#e8e2cf', 5.6, 'left');   // (two lines of three)
  if (pv.length > 3) text(pv.slice(3).join('  ·  '), TM.x + 20, TM.y + TM.h - 11, '#e8e2cf', 5.6, 'left');
  text('↑↓ choose · Enter / click: wear or take off · Y or Esc: close', VW / 2, TM.y + TM.h + 10, '#9a917c', 6.5);
}
