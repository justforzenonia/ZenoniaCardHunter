'use strict';
// CAVE PATHS (2026-11-19, the user: "cave doesnt seem to work very well"). Zenonia 1's own cave floors (origcaves.js) came with
// their puzzle pieces: stone blocks, rock barriers (bank 19) and old chests standing in narrow halls. The builder checked the way
// through on the tiles only, so on about one floor in four those pieces sealed the stairs or the keeper's chest away from the way
// in (Pebble Den's first floor among them), and monsters were set down in rock or in pockets nobody could reach.
// Now, each time a cave floor (or the Ruins) is entered, the floor is walked from where you stand (8 px steps, the game's own
// w.blocked). For each of the stairs, the chest, the gathering spots and the archway that cannot be reached, the cheapest way to
// it is found (a step through a piece costs CPATH.cost, rock cannot be crossed) and only the pieces on that way are lifted
// (1 to 4 on the 29 floors of 117 that needed it). Then any monster in rock or out of reach is moved to open floor away from
// the way in (the keeper to the nearest open floor). Pieces not in the way, and the cave's own chest, stay as they are.
const CPATH = { step: 8, rounds: 8, near: 14, mobGap: 9 * 16, cost: 40 };   // (cost: a step through a piece, against 1 over open floor)
function cpathWalk(w, sx, sy) {
  const S = CPATH.step, b = w.bounds, seen = new Set(), q = [[Math.round(sx / S), Math.round(sy / S)]];
  seen.add(q[0][0] + ',' + q[0][1]);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny, px = nx * S, py = ny * S;
      if (seen.has(k) || px < b.x0 + 4 || py < b.y0 + 8 || px > b.x1 - 4 || py > b.y1 - 2 || w.blocked(px, py)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
// can the hero get within r px of (x, y)?
function cpathCan(seen, x, y, r = CPATH.near) {
  const S = CPATH.step;
  for (let dx = -r; dx <= r; dx += 4) for (let dy = -r; dy <= r; dy += 4) if (seen.has(Math.round((x + dx) / S) + ',' + Math.round((y + dy) / S))) return true;
  return false;
}
function cpathFix(game, w) {
  const M = w.door && MAPS[w.door.key], p = w.player; if (!M || !p) return;
  const W = M.w, S = CPATH.step;
  const goals = [];
  if (M.rcStairs) goals.push(M.rcStairs); if (M.rcChest) goals.push(M.rcChest); if (M.rcArch) goals.push(M.rcArch);
  for (const N of M.rcNodes || []) goals.push({ x: N.x, y: N.y, r: 18 });
  for (const o of w.objects) if (o.rcChest) goals.push({ x: o.x, y: o.bottom + 6, r: 18 });
  let seen = cpathWalk(w, p.x, p.y), lifted = 0;
  const keep = o => o.rcChest || (M.rcChest && o.chest && Math.abs(o.x - M.rcChest.x) < 40 && Math.abs(o.bottom - M.rcChest.y) < 40);
  for (let round = 0; round < CPATH.rounds; round++) {
    const miss = goals.filter(g => !cpathCan(seen, g.x, g.y, g.r || CPATH.near)); if (!miss.length) break;
    // the cheapest way to each missing goal, where a step through a piece costs CPATH.cost and rock cannot be crossed;
    // only the pieces on those ways are lifted (so the rest of the floor keeps its look)
    const b = w.bounds, gx0 = Math.ceil((b.x0 + 4) / S), gy0 = Math.ceil((b.y0 + 8) / S), GW = Math.floor((b.x1 - 4) / S) - gx0 + 1, GH = Math.floor((b.y1 - 2) / S) - gy0 + 1;
    const idx = (x, y) => (y - gy0) * GW + (x - gx0), wallAt = (px, py) => mapSolidAt(M, px - 4, py) || mapSolidAt(M, px + 4, py);
    const dist = new Float32Array(GW * GH).fill(1e9), from = new Int32Array(GW * GH).fill(-1);
    const s0 = idx(Math.round(p.x / S), Math.round(p.y / S)); dist[s0] = 0; const heap = [[0, s0]];
    const pushH = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
    const popH = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    while (heap.length) {
      const [d, i] = popH(); if (d > dist[i]) continue; const x = i % GW + gx0, y = (i / GW | 0) + gy0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < gx0 || ny < gy0 || nx >= gx0 + GW || ny >= gy0 + GH) continue;
        const px = nx * S, py = ny * S; if (wallAt(px, py)) continue;
        const j = idx(nx, ny), nd = d + (w.blocked(px, py) ? CPATH.cost : 1); if (nd < dist[j]) { dist[j] = nd; from[j] = i; pushH([nd, j]); }
      }
    }
    const lift = new Set();
    for (const g of miss) {
      let bestI = -1, bd = 1e9; const r = g.r || CPATH.near;
      for (let dx = -r; dx <= r; dx += 4) for (let dy = -r; dy <= r; dy += 4) { const cx = Math.round((g.x + dx) / S), cy = Math.round((g.y + dy) / S); if (cx < gx0 || cy < gy0 || cx >= gx0 + GW || cy >= gy0 + GH) continue; const j = idx(cx, cy); if (dist[j] < bd) { bd = dist[j]; bestI = j; } }
      for (let i = bestI; i >= 0 && i !== s0; i = from[i]) {
        const px = (i % GW + gx0) * S, py = ((i / GW | 0) + gy0) * S; if (!w.blocked(px, py)) continue;
        for (const o of w.objects) { const bx = o.box; if (bx && !keep(o) && px > bx.x - 3 && px < bx.x + bx.w + 3 && py > bx.y && py < bx.y + bx.h + 2) lift.add(o); }
      }
    }
    if (!lift.size) break;
    w.objects = w.objects.filter(o => !lift.has(o)); lifted += lift.size;
    seen = cpathWalk(w, p.x, p.y);
  }
  // monsters (and the keeper) in rock or out of reach: onto open floor away from the way in
  const cells = [...seen].map(k => k.split(',').map(n => +n * S)).filter(([x, y]) => Math.hypot(x - p.x, y - p.y) > CPATH.mobGap && !w.blocked(x - 4, y) && !w.blocked(x + 4, y));
  let moved = 0;
  for (const m of w.actors) {
    if (!(m.rcMob || m.rcKeeper)) continue;
    if (!w.blocked(m.x, m.y) && cpathCan(seen, m.x, m.y, 4)) continue;
    let best = null, bd = 1e9;
    if (m.rcKeeper) { for (const c of cells) { const d = Math.hypot(c[0] - m.x, c[1] - m.y); if (d < bd) { bd = d; best = c; } } }
    else if (cells.length) best = cells[Math.floor(Math.random() * cells.length)];
    if (!best) continue;
    m.x = best[0]; m.y = best[1]; m.home = { x: m.x, y: m.y }; moved++;
  }
  w.cpath = { lifted, moved };
}
{
  const eh = enterHouse;
  enterHouse = (game, door) => {
    const r = eh(game, door), w = game.world;
    if (door && (door.role === 'rockcave' || door.role === 'rcruins') && w && w.interior) { try { cpathFix(game, w); } catch (e) { console.warn('cavepath', e); } }
    return r;
  };
}
