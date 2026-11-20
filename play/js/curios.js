'use strict';
// THE CURIO COLLECTOR (Hearthvale, the East End square): every odd find with no other use, the scrolls, keys, stones and trophies from the
// Zenonia 2 goods, has a place in their book. Hand in one of each for gold; coins come at milestones, and a full book earns a top-rank card.
const CURIO = { gold: 300, steps: [[5, 3], [10, 5], [20, 10], [30, 15]], last: 30, cardRank: 8 };
let CURIO_LIST = null;
function curioList() {
  if (CURIO_LIST) return CURIO_LIST;
  const mats = new Set(Object.values(MAT)), made = new Set(CRAFT_LIST[0].map(R => R.out)), byName = new Map();
  for (const it of Z2_GOODS) {
    if (GOODS_USE[it.sub] || mats.has(it.idx) || made.has(it.idx) || craftUses(it.idx)) continue;
    const C = byName.get(it.name); if (C) C.ids.push(it.idx); else byName.set(it.name, { name: it.name, tier: it.tier, ids: [it.idx] });
  }
  return CURIO_LIST = [...byName.values()].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}
const curioHeld = (pr, C) => C.ids.reduce((n, id) => n + ((pr.goods || {})[id] || 0), 0);
const curioDone = (pr, C) => !!(pr.curios && pr.curios[C.name]);
const curioCount = pr => Object.keys(pr.curios || {}).length;
const curioReady = pr => curioList().some(C => !curioDone(pr, C) && curioHeld(pr, C) > 0);
const curioPay = C => CURIO.gold * (C.tier + 1);
const isCurio = idx => curioList().some(C => C.ids.includes(idx));
// what you can hand in comes first
function curioRows(pr) {
  const rank = C => curioDone(pr, C) ? 2 : curioHeld(pr, C) ? 0 : 1;
  return curioList().slice().sort((a, b) => rank(a) - rank(b)).map(C => { const done = curioDone(pr, C), n = curioHeld(pr, C);
    return { C, icon: ITEM2_BASE + C.ids[0], name: done || n ? C.name : '???', sub: done ? 'In the collection' : n ? `You have ${n}. Hand one in` : 'Not found yet', right: done ? '✔' : `${curioPay(C)} G`, rightCol: done ? '#8fffd0' : n ? '#ffd23f' : '#9a917c', dim: !done && !n }; });
}
function curioMenu() { return { type: 'curio', cur: 0, scroll: 0 }; }
function updateCurio(game, m) {
  const pr = game.profile, rows = curioRows(pr), nav = panelNav(m, rows.length, 0), r = rows[m.cur]; if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok || !r) return; const C = r.C;
  if (curioDone(pr, C)) { game.toast('That one is already in the collection', '#c9c1a8'); return; }
  const id = C.ids.find(i => (pr.goods || {})[i] > 0); if (id == null) { game.toast('Find one out in the world first', '#c9c1a8'); return; }
  matGive(pr, id, -1); (pr.curios = pr.curios || {})[C.name] = 1; const gold = curioPay(C); pr.gold = (pr.gold || 0) + gold; game.toast(`Collected ${C.name}: +${gold} G`, '#ffd27a');
  const n = curioCount(pr), step = CURIO.steps.find(s => s[0] === n);
  if (step) { pr.coins = (pr.coins || 0) + step[1]; game.toast(`${n} curios! +${step[1]} coins`, '#ffd27a'); }
  if (n === curioList().length) { pr.coins = (pr.coins || 0) + CURIO.last; game.pickup({ kind: 'card', item: makeCard(pick(ZONES[3].mobs.filter(s => D.monsters[s])), CURIO.cardRank) }); game.toast(`The book is full! +${CURIO.last} coins and a rare card`, '#ffd23f'); }
  game.save();
}
function drawCurio(game, m, now) {
  const pr = game.profile, n = curioCount(pr), all = curioList().length, step = CURIO.steps.find(s => s[0] > n);
  panelMenu(m, { title: `CURIOS  ${n} / ${all}`, rows: curioRows(pr), gold: pr.gold || 0, info: step ? `Next: ${step[0]} curios for ${step[1]} coins` : n < all ? 'Fill the book for a rare card' : 'The book is full. Thank you, hunter', keys: '↑↓ choose · Enter hand in · Esc close' }, now);
}
