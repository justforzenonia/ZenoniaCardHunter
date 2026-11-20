'use strict';
// CHARACTER SHEET (the inventory's right page, every tab but Layer, Titles and Ki): replaces the dense sheet of inventory.js
// drawEquipPage with a calmer one the user chose from two mock-ups (2026-11-06, "A: character sheet"):
//   - a header: your hero (idle, small) in a frame, name, level and class, an EXP bar with how far you are
//   - the six gear slots in two rows of three, each with its slot name and what you wear beside it (EQ_POS moved to match)
//   - MAIN STATS: six tiles (HP, MP, Attack, Defense, Speed, Crit) with big numbers
//   - PASSIVES: the active passives in two columns, and an ALL STATS button (or C) that opens every stat grouped
//     (Offense, Defense, Recovery, Movement) with a line saying what the one you point at does
// Spells and the fusion card are no longer repeated here: the Spell Deck page shows them.
const CSHEET = {
  head: { x: PAGE_R.x + 12, y: 76, w: 40, h: 44 },
  gear: { x: PAGE_R.x + 12, y: 126, dx: 82, dy: 38 },
  tiles: { y: 213, w: 80, h: 18, gap: 3 },
  pas: { y: 264 },
  btn: { x: PAGE_R.x + PAGE_R.w - 84, y: 257, w: 72, h: 13 },
  all: { x: PAGE_R.x + 8, y: 74, w: PAGE_R.w - 16, h: 250 },
};
GEAR_SLOTS.forEach((sl, i) => { EQ_POS[sl] = [CSHEET.gear.x + (i % 3) * CSHEET.gear.dx, CSHEET.gear.y + Math.floor(i / 3) * CSHEET.gear.dy]; });
STAT_BADGE.x = PAGE_R.x + PAGE_R.w - 82; STAT_BADGE.y = 78;
// every stat, as the old sheet worked them out (passives from deck, gear and fusion included)
function csheetStats(pr) {
  const st = profileStats(pr), pv = k => st.passives[k] || 0, pc = v => `${Math.round(v)}%`;
  const crit = st.crit + Math.round(pv('crit')), mamp = Math.round((CLASSES[pr.cls].style === 'mage' ? 1.3 : 1) * (1 + st.atk / 40) * 100);
  return { st, rows: {
    hp: ['Max HP', st.hp, '#ff8a7a', 'How much damage you can take'],
    mp: ['Max MP', st.mp, '#8ab8ff', 'Magic for casting your spells'],
    atk: ['Attack', st.atk, '#ffb07a', 'Damage of your attacks and spells'],
    def: ['Defense', st.def, '#c8d0de', 'Takes damage off every hit'],
    spd: ['Speed', st.spd, '#c8f0c0', 'How quickly you attack'],
    crit: ['Crit', crit + '%', '#ffd27a', 'Chance of a critical hit'],
    patk: ['Physical attack', Math.round(st.atk * (1 + pv('brutal') / 100)), null, 'Attack with Brutal added'],
    mamp: ['Magic amp', mamp + '%', '#d8b0ff', 'How much stronger your spells hit'],
    aspd: ['Attack speed', '+' + pc(pv('frenzy')), null, 'Faster swings (Frenzy)'],
    move: ['Move', '+' + pc(pv('swift')), null, 'Faster walking (Swift)'],
    guard: ['Guard', '−' + pc(pv('hide')), null, 'Less damage taken (Thick Hide)'],
    dodge: ['Dodge', pc(pv('evade')), null, 'Chance to dodge a hit'],
    vamp: ['Life steal', pc(pv('vamp')), null, 'HP back from the damage you deal'],
    regen: ['HP regen', pv('regen').toFixed(2) + '%/s', null, 'HP back every second'],
    mpregen: ['MP regen', (MP_REGEN + MANA_FONT_MP * pv('mana') / 100).toFixed(2) + '/s', null, 'MP back every second'],
    thorns: ['Thorns', pc(pv('thorns')), null, 'Hurts monsters that hit you'],
    shield: ['Shield', pc(pv('barrier')), null, 'A barrier that soaks up damage'],
    last: ['Last stand', '+' + pc(pv('last')), null, 'Stronger when your HP is low'],
  } };
}
const CSHEET_MAIN = ['hp', 'mp', 'atk', 'def', 'spd', 'crit'];
const CSHEET_GROUPS = [
  [['OFFENSE', ['atk', 'patk', 'mamp', 'crit', 'aspd']], ['RECOVERY', ['regen', 'mpregen', 'vamp']], ['MOVEMENT', ['spd', 'move']]],
  [['DEFENSE', ['hp', 'mp', 'def', 'guard', 'dodge', 'shield', 'thorns', 'last']]],
];
const csZero = v => typeof v === 'string' && /^[+−]?0(\.0+)?%/.test(v);
const csHov = (x, y, w, h) => mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
function csFit(str, w, size) { let s = String(str); if (textW(s, size, false) <= w) return s; while (s.length > 1 && textW(s + '…', size, false) > w) s = s.slice(0, -1); return s + '…'; }
drawEquipPage = function (game, m, now) {
  const pr = game.profile, P = PAGE_R, X0 = P.x + 12, X1 = P.x + P.w - 12, S = csheetStats(pr), R = S.rows;
  goldTitle('CHARACTER', P.x + P.w / 2, 66, 12, now);
  // header: the hero in a frame, name, level, EXP
  const H = CSHEET.head;
  inset3D(H.x, H.y, H.w, H.h);
  ctx.save(); ctx.beginPath(); ctx.rect(H.x + 1, H.y + 1, H.w - 2, H.h - 2); ctx.clip();
  try { drawPlayerPreview(pr.cls, pr.look, (pr.look && pr.look.wart != null) ? pr.look.wart : S.st.look, 'idle', 2, H.x + H.w / 2, H.y + H.h - 5, 0.95, now, true); } catch (e) {}
  ctx.restore();
  const lv = pr.lv || 1, tx = H.x + H.w + 8, need = expNeed(lv), have = Math.max(0, pr.exp || 0), k = lv >= (typeof MAX_LV !== 'undefined' ? MAX_LV : 99) ? 1 : Math.min(1, have / need);
  ink(csFit((pr.look && pr.look.name) || 'Hero', 116, 10), tx, 84, '#fff4dc', 10);
  ink(`Lv ${lv} · ${className(pr.cls)}`, tx, 97, '#d8c8a8', 8, 'left', false);
  const bw = X1 - tx; ctx.fillStyle = '#1c120c'; rrect(ctx, tx, 104, bw, 6, 2); ctx.fill();
  ctx.fillStyle = '#6ad0ff'; if (k > 0) { rrect(ctx, tx, 104, Math.max(3, bw * k), 6, 2); ctx.fill(); }
  ink(k >= 1 && need <= have ? 'EXP full' : `EXP ${Math.floor(k * 100)}%  ·  ${have} / ${need}`, tx, 117, '#b8c8d8', 7, 'left', false);
  if (statPoints(pr) > 0) drawStatBadge(statPoints(pr), now);
  else { const W = wornSets(pr), St = Object.keys(W).sort((a, b) => W[b].n - W[a].n)[0]; if (St) ink(`${GEAR_SETS[St].name} ${W[St].n}/6`, X1, 84, '#9fd8ff', 7.5, 'right'); }
  // gear: two rows of three, the slot's name and what you wear beside each
  for (const slot of GEAR_SLOTS) {
    const [x, y] = EQ_POS[slot], g = pr.gear.find(it => it.uid === pr.eq[slot]);
    const up = pr.gear.some(it => it.slot === slot && it !== g && isUpgrade(pr, it));
    drawGearSlot(g, x, y, EQ_S, now, { up, sel: m.tab === 'bag' && m.slotFilter === slot, slot });
    const lx = x + EQ_S + 4, room = CSHEET.gear.dx - EQ_S - 6;
    const sl = String(SLOT_LABEL[slot]); ink(csFit(sl.charAt(0) + sl.slice(1).toLowerCase(), room + 4, 7), lx, y + 11, '#d8c8a8', 7, 'left');
    ink(g ? csFit(g.name, room, 7) : 'empty', lx, y + 23, g ? '#ffffff' : '#a89a80', 7, 'left', false);
  }
  // main stats: six tiles
  sectionHead('MAIN STATS', CSHEET.tiles.y - 9);
  const T = CSHEET.tiles, PV = csPreview(game, m), R2 = PV && csheetStats(PV.pr).rows;
  if (PV) { const w = textW(PV.label, 7, false) + 10; ctx.fillStyle = '#1c120c'; rrect(ctx, X1 - w, CSHEET.tiles.y - 15, w, 12, 3); ctx.fill(); ink(PV.label, X1 - 5, CSHEET.tiles.y - 9, '#9fe8ff', 7, 'right', false); }
  CSHEET_MAIN.forEach((id, i) => {
    const x = X0 + (i % 3) * (T.w + T.gap), y = T.y + Math.floor(i / 3) * (T.h + T.gap), [name, v, col] = R[id];
    inset3D(x, y, T.w, T.h);
    ink(name.replace('Max ', ''), x + 5, y + T.h / 2 + 0.5, '#d8c8a8', 7, 'left', false);
    ink(String(v), x + T.w - 5, y + T.h / 2 + 0.5, col || '#ffffff', 9.5, 'right');
    const d = R2 ? parseFloat(R2[id][1]) - parseFloat(v) : 0;
    if (d) { const vw = textW(String(v), 9.5), ds = (d > 0 ? '+' : '−') + (Math.abs(d) < 10 && Math.abs(d) % 1 ? Math.abs(d).toFixed(1) : Math.round(Math.abs(d))) + (String(v).endsWith('%') ? '%' : '');
      ink(ds, x + T.w - 9 - vw, y + T.h / 2 + 0.5, d > 0 ? '#8fffa0' : '#ff9a8a', 7.5, 'right'); }
  });
  // passives, two columns, and the ALL STATS button
  const pas = Object.entries(S.st.passives).sort((a, b) => b[1] / PASSIVES[b[0]].cap - a[1] / PASSIVES[a[0]].cap);
  sectionHead(`PASSIVES  (${pas.length})`, CSHEET.pas.y);
  const B = CSHEET.btn, bh = csHov(B.x, B.y, B.w, B.h) || m.allStats;
  ctx.fillStyle = bh ? '#5a3e26' : '#2c1d12'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill();
  ctx.strokeStyle = bh ? '#ffd860' : '#7a6450'; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 3); ctx.stroke();
  text('ALL STATS (C)', B.x + B.w / 2, B.y + B.h / 2 + 0.4, bh ? '#ffe9a8' : '#e8e2cf', 7);
  const shown = pas.slice(0, 10);
  shown.forEach(([id, v], i) => {
    const cx = X0 + (i % 2) * 124, y = CSHEET.pas.y + 11 + Math.floor(i / 2) * 10, capped = v >= PASSIVES[id].cap - 0.01;
    ink(csFit(PASSIVES[id].name, 80, 7.5), cx, y, '#9fd8ff', 7.5, 'left', false);
    ink((v < 10 ? v.toFixed(1) : Math.round(v)) + (capped ? ' max' : ''), cx + 118, y, capped ? '#ffb070' : '#ffffff', 7.5, 'right');
  });
  if (pas.length > shown.length) ink(`+${pas.length - shown.length} more in ALL STATS`, X1, CSHEET.pas.y + 61, '#b8ae96', 7, 'right', false);
  if (!pas.length) ink('Put cards in your deck to gain their passives', X0, CSHEET.pas.y + 12, '#b8ae96', 7.5, 'left', false);
  if (m.allStats) drawAllStats(game, m, S, pas, now);
};
// STAT PREVIEW: on the Bag page the gear under the cursor (when it is not what you wear) and on the Stats page the stat you are on
// (one more point) show what would change on the MAIN STATS tiles: green for more, red for less, and a note saying what is shown.
function csPreview(game, m) {
  const pr = game.profile;
  if (m.allStats) return null;
  if (m.tab === 'bag' && m.slotFilter !== 'goods') {
    const list = sortedGear(pr, m.slotFilter), G = BAG_GRID; let it = list[m.cur];
    for (let i = 0; i < G.cols * G.rows; i++) { const g = list[m.scroll * G.cols + i]; if (g && csHov(G.x + (i % G.cols) * G.cs, G.y + Math.floor(i / G.cols) * G.cs, G.cs - 4, G.cs - 4)) { it = g; break; } }   // (the piece you point at, else the selected one)
    if (!it || pr.eq[it.slot] === it.uid) return null;
    return { pr: { ...pr, eq: { ...pr.eq, [it.slot]: it.uid } }, label: `if you wear ${csFit(it.name, 90, 7)}` };
  }
  if (m.tab === 'stats' && typeof ATTRS !== 'undefined' && ATTRS[m.cur]) {
    const A = ATTRS[m.cur]; return { pr: { ...pr, attr: { ...(pr.attr || {}), [A.id]: ((pr.attr || {})[A.id] || 0) + 1 } }, label: `with 1 more ${A.full || A.name}` };
  }
  return null;
}
// ALL STATS: every stat, grouped, over the page; pointing at a row says what it does
function drawAllStats(game, m, S, pas, now) {
  const A = CSHEET.all, R = S.rows;
  ctx.fillStyle = 'rgba(24,16,10,0.97)'; rrect(ctx, A.x, A.y, A.w, A.h, 5); ctx.fill();
  ctx.strokeStyle = '#7a6450'; ctx.lineWidth = 1; rrect(ctx, A.x + 0.5, A.y + 0.5, A.w - 1, A.h - 1, 5); ctx.stroke();
  text('ALL STATS', A.x + A.w / 2, A.y + 11, '#ffd860', 9);
  let hov = null, hiDesc = null; const cw = (A.w - 24) / 2, rowH = 11;
  CSHEET_GROUPS.forEach((col, ci) => {
    let y = A.y + 28; const x = A.x + 10 + ci * (cw + 4);
    for (const [title, ids] of col) {
      text(title, x, y, '#b8ae96', 7, 'left'); y += rowH;
      for (const id of ids) {
        const [name, v, c, desc] = R[id], on = csHov(x - 2, y - 5, cw, rowH);
        if (on) { hov = desc; ctx.fillStyle = 'rgba(143,216,255,0.12)'; ctx.fillRect(x - 2, y - 5, cw, rowH); }
        else if (id === m.allHi) { hiDesc = hiDesc || desc; ctx.fillStyle = 'rgba(255,216,96,0.14)'; ctx.fillRect(x - 2, y - 5, cw, rowH); }
        text(name, x + 4, y + 0.5, '#e8e2cf', 7.5, 'left'); text(String(v), x + cw - 6, y + 0.5, csZero(v) ? '#8a8270' : c || '#ffffff', 7.5, 'right');
        y += rowH;
      }
      y += 4;
    }
  });
  // passives beyond the first ten, under the defense column
  if (pas.length > 10) { const x = A.x + 10 + cw + 4; let y = A.y + 28 + 9 * rowH + 4; text('MORE PASSIVES', x, y, '#b8ae96', 7, 'left'); y += rowH;
    pas.slice(10, Object.keys(wornSets(game.profile)).length ? 14 : 16).forEach(([id, v]) => { text(csFit(PASSIVES[id].name, cw - 40, 7.5), x + 4, y + 0.5, '#9fd8ff', 7.5, 'left'); text(v < 10 ? v.toFixed(1) : Math.round(v), x + cw - 6, y + 0.5, '#ffffff', 7.5, 'right'); y += rowH; }); }
  // gear sets you wear: each with its pieces and the passives it gives (a tick for the ones on)
  const W = wornSets(game.profile), sets = Object.keys(W).sort((a, b) => W[b].n - W[a].n).slice(0, 2);
  if (sets.length) { let y = A.y + A.h - 26 - sets.length * 10; text('GEAR SETS', A.x + 10, y, '#b8ae96', 7, 'left'); y += 10;
    for (const id of sets) { const on = csHov(A.x + 8, y - 5, A.w - 16, 10); if (on) hov = 'Wear more pieces of a set for more of its passives'; text(csFit(setLine(game.profile, id), A.w - 28, 7), A.x + 14, y + 0.5, GEAR_SETS[id].col || '#d8b0ff', 7, 'left'); y += 10; } }
  ctx.fillStyle = '#1a110b'; rrect(ctx, A.x + 6, A.y + A.h - 20, A.w - 12, 14, 3); ctx.fill();
  hov = hov || hiDesc;
  text(hov || 'Point at a stat to see what it does  ·  C or Esc: close', A.x + A.w / 2, A.y + A.h - 13, hov ? '#9fe8ff' : '#c9c1a8', 7.5);
}
{
  const ui = updateInventory;
  updateInventory = (game, m) => {
    const onSheet = m.open == null && !m.picker && !m.circuit && !['layer', 'titles', 'ki'].includes(m.tab);
    if (!onSheet) { m.allStats = false; return ui(game, m); }
    const B = CSHEET.btn;
    if (hit('KeyC') || clicked(B.x, B.y, B.w, B.h)) { consume('KeyC'); mouse.click = false; m.allStats = !m.allStats; m.allHi = null; return; }
    if (!m.allStats && mouse.click) { const T = CSHEET.tiles, X0 = PAGE_R.x + 12;   // a main stat tile opens ALL STATS on that stat
      const i = CSHEET_MAIN.findIndex((id, k) => clicked(X0 + (k % 3) * (T.w + T.gap), T.y + Math.floor(k / 3) * (T.h + T.gap), T.w, T.h));
      if (i >= 0) { mouse.click = false; m.allStats = true; m.allHi = CSHEET_MAIN[i]; return; } }
    if (m.allStats) {
      const A = CSHEET.all;
      if (hit('Escape')) { consume('Escape'); m.allStats = false; m.allHi = null; return; }
      if (mouse.click && mouse.x >= A.x && mouse.x < A.x + A.w && mouse.y >= A.y && mouse.y < A.y + A.h) { mouse.click = false; return; }
    }
    return ui(game, m);
  };
}
// GEAR ON THE SHEET: pointing at a worn piece shows a small card with its name, rank and what it gives (and its set, if any).
{
  const de = drawEquipPage;
  drawEquipPage = function (game, m, now) {
    const r = de(game, m, now), pr = game.profile;
    if (m.allStats || m.tooltip) return r;
    for (const slot of GEAR_SLOTS) {
      const [x, y] = EQ_POS[slot]; if (!csHov(x, y, EQ_S, EQ_S)) continue;
      const g = pr.gear.find(it => it.uid === pr.eq[slot]); if (!g) break;
      m.tooltip = () => {
        const L = [[g.name, '#ffffff', 8.5], [`${SLOT_LABEL[slot]} · RANK ${RANKS[g.tier]}`, rankColor(g.tier, now), 7], ...gearLines(g).map(t => [t, '#9fd8ff', 7.5])];
        if (g.set) L.push([setLine(pr, g.set), '#d8b0ff', 7]);
        const w = Math.min(230, Math.max(...L.map(l => textW(l[0], l[2], false))) + 14), h = L.length * 11 + 6;
        const bx = Math.max(PAGE_R.x + 4, Math.min(x, PAGE_R.x + PAGE_R.w - 4 - w)), by = y + EQ_S + 4;
        ctx.fillStyle = 'rgba(10,8,18,0.95)'; rrect(ctx, bx, by, w, h, 4); ctx.fill(); ctx.strokeStyle = '#8a94a8'; ctx.lineWidth = 0.8; rrect(ctx, bx + 0.4, by + 0.4, w - 0.8, h - 0.8, 4); ctx.stroke();
        L.forEach(([t, c, sz], i) => text(csFit(t, w - 12, sz), bx + 7, by + 9 + i * 11, c, sz, 'left'));
      };
      break;
    }
    return r;
  };
}
// BAG SORT (O on the Bag page, pr.bagSort): by slot (as before), by rank (best first) or newest first.
const BAG_SORTS = ['slot', 'rank', 'newest'];
{
  const sg = sortedGear;
  sortedGear = (pr, slot) => {
    const L = sg(pr, slot), k = (pr && pr.bagSort) || 0; if (!k) return L;
    if (k === 1) return L.slice().sort((a, b) => b.tier - a.tier || gearScore(b) - gearScore(a));
    const at = new Map(pr.gear.map((g, i) => [g, i])); return L.slice().sort((a, b) => at.get(b) - at.get(a));
  };
}
// SELL WEAKER (V twice on the Bag page): sells every piece you do not wear that scores lower than what you wear in its slot,
// leaving out set pieces, socketed gear and weapons for other classes. The first V says how many and for how much.
function weakerGear(pr) {
  return pr.gear.filter(g => {
    if (GEAR_SLOTS.some(s => pr.eq[s] === g.uid) || g.set || g.sock || (g.slot === 'weapon' && g.cls !== pr.cls)) return false;
    const w = pr.gear.find(x => x.uid === pr.eq[g.slot]); return !!w && gearScore(g) < gearScore(w);
  });
}
{
  const ub = updateBagTab;
  updateBagTab = (game, m) => {
    const pr = game.profile;
    if (m.slotFilter !== 'goods') {
      if (hit('KeyO')) { consume('KeyO'); pr.bagSort = ((pr.bagSort || 0) + 1) % BAG_SORTS.length; m.cur = 0; m.scroll = 0; game.save(); game.toast(`Bag sorted by ${BAG_SORTS[pr.bagSort]}`, '#c9c1a8'); return; }
      if (hit('KeyV')) {
        consume('KeyV'); const W = weakerGear(pr), gold = W.reduce((a, g) => a + sellGear(g), 0);
        if (!W.length) { m.confirm = null; game.toast('No weaker gear to sell', '#c9c1a8'); return; }
        if (m.confirm !== 'weaker') { m.confirm = 'weaker'; game.toast(`Sell ${W.length} weaker piece${W.length > 1 ? 's' : ''} for ${gold} G? Press V again`, '#ffd27a'); return; }
        const out = new Set(W); pr.gear = pr.gear.filter(g => !out.has(g)); pr.gold = (pr.gold || 0) + gold;
        m.confirm = null; m.cur = 0; m.scroll = 0; game.save(); game.toast(`Sold ${W.length} weaker piece${W.length > 1 ? 's' : ''} for ${gold} G`, '#ffd23f'); return;
      }
      if (m.confirm === 'weaker' && (hit('KeyX', 'Delete', 'Escape') || mouse.click)) m.confirm = null;
    }
    return ub(game, m);
  };
}
