'use strict';
// THE BUFF LIST: down the left side, under your health frame (and the partner's card), every effect on you right now,
// good ones first in gold-green, then the bad ones in red: a coloured chip with its mark, the name, the seconds left,
// and a thin bar draining to zero. Each effect's full length is remembered when it starts, so the bar is true.
// get(a, pr) returns the milliseconds left (or Infinity for an effect without a clock, like a shield).
const BUFFS = [
  { key: 'layer',  name: 'Layer',          mark: '◆', col: '#c8a8ff', get: a => a.transcend > 0 ? a.transcend : 0 },
  { key: 'ki',     name: 'Ki Form',        mark: 'K', col: '#8fe8ff', get: a => a.chiOn && a.chiT > 0 ? a.chiT : 0 },
  { key: 'sharp',  name: 'Knife Sharpen',  mark: '⚔', col: '#fff36b', get: a => a.sharpT || 0 },
  { key: 'heat',   name: 'Turn Up the Heat', mark: '♨', col: '#ff8a3a', get: a => a.heatT || 0 },
  { key: 'smoke',  name: 'Smoke Break',    mark: '~', col: '#d8e8e0', get: a => a.smokeT || 0 },
  { key: 'fed',    name: 'Well Fed',       mark: '♥', col: '#ff9ab0', get: a => a.wellFed || 0 },
  { key: 'haste',  name: 'Spell Haste',    mark: '»', col: '#9affc8', get: a => a.spellHasteT || 0 },
  { key: 'iron',   name: 'Iron Will',      mark: '■', col: '#b8c8ff', get: a => a.ironT || 0 },
  { key: 'weeds',  name: 'Weed Whirl',     mark: '✿', col: '#8fe870', get: a => a.weedsT || 0 },
  { key: 'shield', name: 'Shield',         mark: '◎', col: '#9fd3ff', get: a => a.shield > 0 ? Infinity : 0, val: a => `${Math.round(a.shield)}` },
  { key: 'meal',   name: pr => (MEAL_FX[pr.meal.id] || {}).name || 'Meal', mark: '●', col: '#ffd27a', get: (a, pr) => pr && pr.meal && pr.meal.ms > 0 && MEAL_FX[pr.meal.id] ? pr.meal.ms : 0, max: pr => (MEAL_FX[pr.meal.id] || {}).dur },
  { key: 'snack',  name: pr => (MEAL_FX[pr.snack.id] || {}).name || 'Snack', mark: '•', col: '#ffd27a', get: (a, pr) => pr && pr.snack && pr.snack.ms > 0 && MEAL_FX[pr.snack.id] ? pr.snack.ms : 0, max: pr => (MEAL_FX[pr.snack.id] || {}).dur },
  // the bad ones
  { key: 'burn',   name: 'Burning',        mark: '▲', col: '#ff6a3a', bad: true, get: a => a.status && a.status.burn ? a.status.burn.t : 0 },
  { key: 'poison', name: 'Poisoned',       mark: '☠', col: '#b06aff', bad: true, get: a => a.status && a.status.poison ? a.status.poison.t : 0 },
  { key: 'freeze', name: 'Frozen',         mark: '❄', col: '#9fe8ff', bad: true, get: a => a.status && a.status.freeze > 0 ? a.status.freeze : 0 },
  { key: 'shock',  name: 'Shocked',        mark: 'ϟ', col: '#ffe94a', bad: true, get: a => a.status && a.status.shock > 0 ? a.status.shock : 0 },
  { key: 'crack',  name: 'Armour Cracked', mark: '✕', col: '#d8a060', bad: true, get: a => a.status && a.status.crack > 0 ? a.status.crack : 0 },
  { key: 'slow',   name: 'Slowed',         mark: '↓', col: '#7ab0ff', bad: true, get: a => a.status && a.status.slow > 0 ? a.status.slow : 0 },
  { key: 'exhaust', name: 'Exhausted',     mark: '!', col: '#ff8a8a', bad: true, get: a => a.exhausted > 0 ? a.exhausted : 0 },
  { key: 'taunt',  name: 'Taunted',        mark: '✶', col: '#ff9a5a', bad: true, get: a => a.tauntT > 0 ? a.tauntT : 0 },
];
const BUFF_LIST = { x: 6, row: 13, w: 104, maxRows: 7 };
function drawBuffList(a, pr, y0, now) {
  if (!a) return;
  const seen = a._buffMax || (a._buffMax = {}), on = [];
  for (const B of BUFFS) {
    let ms = 0; try { ms = B.get(a, pr) || 0; } catch (e) { ms = 0; }
    if (!(ms > 0)) { delete seen[B.key]; continue; }
    const full = B.max ? B.max(pr) : null;
    if (ms !== Infinity) seen[B.key] = Math.max(full || 0, seen[B.key] || 0, ms);
    on.push({ B, ms });
  }
  if (!on.length) return;
  const L = BUFF_LIST;
  on.slice(0, L.maxRows).forEach(({ B, ms }, i) => {
    const y = y0 + i * L.row, x = L.x, bad = !!B.bad;
    ctx.fillStyle = bad ? 'rgba(40,6,10,0.78)' : 'rgba(10,18,14,0.74)'; rrect(ctx, x, y, L.w, L.row - 2, 3); ctx.fill();
    ctx.strokeStyle = bad ? 'rgba(255,90,90,0.75)' : 'rgba(200,230,140,0.55)'; ctx.lineWidth = 0.8; rrect(ctx, x + 0.4, y + 0.4, L.w - 0.8, L.row - 2.8, 3); ctx.stroke();
    ctx.fillStyle = 'rgba(12,7,18,0.95)'; rrect(ctx, x + 1.5, y + 1.5, L.row - 5, L.row - 5, 2); ctx.fill(); ctx.strokeStyle = B.col; ctx.lineWidth = 1; rrect(ctx, x + 2, y + 2, L.row - 6, L.row - 6, 2); ctx.stroke();   // the chip with its mark: dark, ringed in its colour, the mark bright
    text(B.mark, x + 1.5 + (L.row - 5) / 2, y + (L.row - 2) / 2 + 0.5, '#ffffff', 6.5);
    const nm = typeof B.name === 'function' ? B.name(pr) : B.name;
    text(nm, x + L.row - 1, y + (L.row - 2) / 2, bad ? '#ffc8c0' : '#f4ecd8', 6, 'left');
    const right = B.val ? B.val(a) : ms === Infinity ? '' : ms >= 60000 ? `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
    const blink = bad && ms < 1500 ? 0.55 + 0.45 * Math.sin(now / 60) : 1;
    ctx.save(); ctx.globalAlpha = blink; text(right, x + L.w - 4, y + (L.row - 2) / 2, bad ? '#ff9a8a' : '#ffe08a', 6.5, 'right'); ctx.restore();
    if (ms !== Infinity && seen[B.key]) { ctx.fillStyle = B.col; ctx.fillRect(x + L.row - 1, y + L.row - 4, (L.w - L.row - 3) * Math.min(1, ms / seen[B.key]), 1); }   // draining
  });
  if (on.length > L.maxRows) text(`+${on.length - L.maxRows} more`, L.x + 4, y0 + L.maxRows * L.row + 4, '#a8a0b8', 6, 'left');
}
