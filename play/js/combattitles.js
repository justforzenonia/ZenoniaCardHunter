'use strict';
// COMBAT TITLES: the newer combat moves count toward titles too (titles.js TITLE_LIST, worn passives in TITLE_PASSIVES).
//   Payback Artist  UNCOMMON  land 150 Paybacks (riposte.js pr.stats.ripostes)
//   Elementalist    RARE      set off 300 element reactions (elemreact.js pr.stats.reactions)
//   Chain Master    RARE      end a combo of 40 hits or more, the ZENONIA!! grade (combopay.js pr.stats.comboBest)
//   Element Sage    RARE      set off every kind of element reaction at least once (elemreact.js pr.stats.react_KIND)
//   Chain Weaver    RARE      finish 100 card chains (cardchain.js pr.stats.chainFinish)
//   Unscathed       UNCOMMON  win 50 Flawless fights: 3 or more foes without losing HP to a hit (flawless.js pr.stats.flawless)
const COMBAT_TITLES = [
  ['payback',      'Payback Artist', 1, 'Land 150 Paybacks',                 pr => [titleStat(pr, 'ripostes'), 150],  ['crit', 'evade']],
  ['elementalist', 'Elementalist',   2, 'Set off 300 element reactions',     pr => [titleStat(pr, 'reactions'), 300], ['mana', 'burst', 'crit']],
  ['chainmaster',  'Chain Master',   2, 'Land a combo of 40 hits or more',   pr => [Math.min(40, titleStat(pr, 'comboBest')), 40], ['frenzy', 'swift', 'brutal']],
  ['elemsage',     'Element Sage',   2, 'Set off every element reaction',    pr => { const K = Object.keys(REACT_CHIME); return [K.filter(k => titleStat(pr, 'react_' + k) > 0).length, K.length]; }, ['mana', 'burst']],
  ['chainweaver',  'Chain Weaver',   2, 'Finish 100 card chains',            pr => [titleStat(pr, 'chainFinish'), 100], ['mana', 'swift']],
  ['unscathed',    'Unscathed',      1, 'Win 50 Flawless fights',            pr => [titleStat(pr, 'flawless'), 50],    ['evade', 'swift']],
];
for (const [id, name, tier, how, prog, pass] of COMBAT_TITLES) {
  if (TITLE_BY[id]) { console.warn('combattitles: title id taken', id); continue; }   // (an id clash would hide the title silently)
  const t = { id, name, tier, how, prog }; TITLE_LIST.push(t); TITLE_BY[id] = t; TITLE_PASSIVES[id] = pass;
}
// COMBAT RECORDS: one quiet line at the foot of the STATS page (inventory.js drawStatsPage) with the counts the combat
// titles track: the best combo, Paybacks, element reactions and perfect parries, and under them Flawless fights,
// Rallies, perfect dodges and guard breaks.
{
  const dsp = drawStatsPage;
  drawStatsPage = (game, m, now) => {
    const r = dsp(game, m, now), pr = game.profile;
    const rec = [['COMBO', titleStat(pr, 'comboBest')], ['PAYBACK', titleStat(pr, 'ripostes')], ['REACT', titleStat(pr, 'reactions')], ['PARRY', titleStat(pr, 'parries')]];
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(PAGE_L.x + 16, 284, PAGE_L.w - 32, 0.6);   // (a thin rule over the records)
    ink('COMBAT RECORDS', PAGE_L.x + 16, 292, '#b8ae96', 7);
    const COL = [0, 54, 132, 188, 238];   // (four columns, PAYBACK given the most room; the last ends at the rule's end)
    const rec2 = [['RALLY', titleStat(pr, 'rallies')], ['FLAWLESS', titleStat(pr, 'flawless')], ['DODGE', titleStat(pr, 'perfectDodges')], ['BREAK', titleStat(pr, 'guardBreaks')]];   // (a second row: Rallies, Flawless fights in the wide column, perfect dodges, guard breaks)
    [rec, rec2].forEach((row, r) => row.forEach(([k, v], i) => {
      const x = PAGE_L.x + 16 + COL[i], y = 304 + r * 12, s = v >= 10000 ? Math.floor(v / 1000) + 'k' : v.toLocaleString();
      ink(k, x, y, INK_SOFT, 7); ink(s, PAGE_L.x + 16 + COL[i + 1] - 6, y, INK, 7, 'right');
    }));
    return r;
  };
}
