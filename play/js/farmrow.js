'use strict';
// GATHER THE ROW: harvesting a ripe plot (Enter, home.js plotInteract) also harvests every ripe plot next to it in the same row
// of the same field, outwards both ways until a plot that is not ripe. Each plot is harvested exactly as by hand (its yield,
// seeds back, Golden Harvest, Farm XP), but their messages are gathered into one: "Harvested 12 × Wheat, 3 × Carrot".
// Golden Harvest and Farm Level messages still show on their own.
{
  const pi = plotInteract;
  plotInteract = (game, i) => {
    const pr = game.profile, farm = farmOf(pr), P = farm[i], c = farmPlots()[i];
    if (!P || !P.crop || plotProgress(P, pr) < 1 || !c) return pi(game, i);
    const row = [i];
    for (const dir of [-1, 1]) for (let j = i + dir; ; j += dir) {
      const Q = farm[j], cj = farmPlots()[j];
      if (!cj || cj.town !== c.town || Math.abs(cj.y - c.y) > 2 || !Q || !Q.crop || plotProgress(Q, pr) < 1 || plotLocked(pr, j) || !plotOpen(pr, j)) break;
      row.push(j);
    }
    if (row.length === 1) return pi(game, i);
    const got = {}, seeds = {}, keep = [], toast = game.toast;
    game.toast = (s, col) => {   // the per-plot harvest lines are counted; anything else (Golden Harvest, Farm Level) shows as usual
      const h = /^Harvested (\d+) × (.+?)(?: \+ (\d+) (.+?))?! \(/.exec(s);
      if (h) { got[h[2]] = (got[h[2]] || 0) + +h[1]; if (h[3]) seeds[h[4]] = (seeds[h[4]] || 0) + +h[3]; return; }
      keep.push([s, col]);
    };
    try { for (const j of row) pi(game, j); } finally { game.toast = toast; }
    const list = Object.entries(got).map(([k, n]) => `${n} × ${k}`).join(', '), sl = Object.entries(seeds).map(([k, n]) => `${n} ${k}`).join(', ');
    const hot = typeof marketCrop === 'function' && got[ITEMS[marketCrop()].name] ? ` · ${ITEMS[marketCrop()].name} is in demand at the store today` : '';
    game.toast(`Harvested the row: ${list}${sl ? ` + ${sl}` : ''}!${hot}`, '#8fffb0');
    for (const [s, col] of keep) game.toast(s, col);
  };
}
// TEND THE YARD: Enter beside a farm animal (farmyard.js yardTend) also looks after every other farm animal within
// FARM_TEND.r of you, each exactly as by hand (fed from your crops, or its egg / milk / wool / truffle collected); one message
// sums it up: "Fed 2 animals · Collected 2 × Egg, 1 × Milk". "Still content" lines are left out when others were tended.
const FARM_TEND = { r: 70 };
{
  const yt = yardTend;
  yardTend = (game, w) => {
    const first = w.yardNear; if (!first) return yt(game, w);
    const p = w.player, more = (w.animals || []).filter(A => A !== first && A.farm && A.yardKey && Math.hypot(A.x - p.x, A.y - p.y) < FARM_TEND.r);
    if (!more.length) return yt(game, w);
    let fed = 0; const got = {}, other = [], toast = game.toast;
    game.toast = (s, col) => {
      let m;
      if (/^Fed the /.test(s)) { fed++; return; }
      if ((m = /^Collected (\d+) × (.+)$/.exec(s))) { got[m[2]] = (got[m[2]] || 0) + +m[1]; return; }
      other.push([s, col]);
    };
    let r;
    try { for (const A of [first, ...more]) { w.yardNear = A; const x = yt(game, w); if (A === first) r = x; } } finally { w.yardNear = first; game.toast = toast; }
    const parts = []; if (fed) parts.push(`Fed ${fed} animal${fed > 1 ? 's' : ''}`);
    const g = Object.entries(got).map(([k, n]) => `${n} × ${k}`).join(', '); if (g) parts.push(`Collected ${g}`);
    if (parts.length) { game.toast(parts.join(' · '), got && g ? '#ffd27a' : '#b8ff8a'); for (const [s, col] of other) if (!/is content/.test(s)) game.toast(s, col); }
    else if (other.length) game.toast(other[0][0], other[0][1]);   // (nothing done: the first animal's own message, e.g. still content or no food)
    return r;
  };
}
// ANIMALS READY: when an animal you fed has its egg, milk, wool or truffle waiting (farmyard.js: fed + YARD.make on the game
// clock), one soft message says so, like the ripe crops' one. Told once per feeding (Y.told), checked with the ripe check.
{
  const rt = ripeTick;
  ripeTick = (game, dt) => { const r = rt(game, dt); yardReadyTick(game); return r; };
}
function yardReadyTick(game) {
  const pr = game.profile; if (!pr || !pr.yard || !pr.yard.fed) return;
  const Y = yardOf(pr), T0 = Y.told = Y.told || {}, now = wellClock(pr); let n = 0;
  for (const k in Y.fed) { if (now >= Y.fed[k] + YARD.make && T0[k] !== Y.fed[k]) { T0[k] = Y.fed[k]; n++; } }
  for (const k in T0) if (!(k in Y.fed)) delete T0[k];   // (collected: forget it)
  if (n) game.toast(`${n > 1 ? `${n} of your farm animals have` : 'One of your farm animals has'} something for you: collect it at the farm (Enter)`, '#ffd27a');
}
// MARKET DAY: each real day one ordinary crop is in demand (the same for everyone, by the date) and sells for MARKET.mul times
// its price at the Grocer's sell list (shop.js shopRows), marked there and listed first; the Grocer now buys every crop you
// grow at its listed price (before, crops had no buyer and only paid through farm orders); the Farm Board's FARM page names it. Rare crops,
// meals and other goods are unchanged.
const MARKET = { mul: 2 };
function marketCrop(d = dayNo()) {
  const list = Object.keys(CROPS).filter(k => !CROPS[k].long && ITEMS[k] && ITEMS[k].sell).sort();
  let x = Math.imul(d ^ 0x5bd1e995, 0x27d4eb2d); x ^= x >>> 15; return list[(x >>> 0) % list.length];
}
{
  const sr = shopRows;
  shopRows = (game, m) => {
    const rows = sr(game, m), c = marketCrop(), pr = game.profile;
    // the Grocer (any shop that is not a smith) now buys your crops too: they had no buyer before, only farm orders
    if (m.tab === 1 && !(m.role in GEAR_SHOPS)) {
      const crops = Object.keys(pr.items || {}).filter(id => pr.items[id] > 0 && ITEMS[id] && ITEMS[id].sell && (ITEMS[id].kind === 'crop' || (ITEMS[id].kind === 'rare' && CROPS[id])));
      crops.sort((a, b) => (b === c) - (a === c) || ITEMS[b].sell - ITEMS[a].sell);
      rows.unshift(...crops.map(id => ({ item: id, icon: itemIcon(id), name: `${ITEMS[id].name}  ×${pr.items[id]}`, sub: ITEMS[id].desc.split(' SNACK')[0], right: `+${ITEMS[id].sell} G`, value: ITEMS[id].sell })));
    }
    for (const r of rows) if (r.item === c && r.value != null && !r.market) { r.market = true; r.value *= MARKET.mul; r.right = `+${r.value} G ★`; r.name = `${r.name}  · in demand today`; }
    return rows;
  };
}
// SELL THE STACK: in a non-gear shop's SELL tab, R sells every one of the chosen crop or farm item at once (at today's
// market price when it is in demand), so a big harvest isn't one press per piece. The key line says so (shop.js).
{
  const us = updateShop;
  updateShop = (game, m) => {
    if (m.tab === 1 && !(m.role in GEAR_SHOPS) && hit('KeyR')) {
      const pr = game.profile, r = shopRows(game, m)[m.cur];
      if (r && r.item && r.value != null) {
        const n = itemCount(pr, r.item), g = n * r.value;
        if (n > 0) { addItem(pr, r.item, -n); pr.gold = (pr.gold || 0) + g; game.save(); game.toast(`Sold ${n} × ${ITEMS[r.item].name} for ${g} G${r.market ? ' (in demand today)' : ''}`, '#ffd23f'); const left = shopRows(game, m).length; m.cur = Math.min(m.cur, Math.max(0, left - 1)); }
        return;
      }
    }
    return us(game, m);
  };
}
