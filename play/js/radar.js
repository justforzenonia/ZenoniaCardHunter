'use strict';
// RADAR (Settings ▸ RADAR, on by default): a small round map of what is around you in the Wilds, out to about 420 px.
//   you        a white arrow in the middle, facing the way you face
//   monsters   red dots (bosses bigger and orange); elites in their trait's colour; one not yet in your Monster Book has a
//              purple ring (book.js)
//   your hunt target (Monster Book ▸ Enter)   a gold star
//   on this week's hunt list (not yet done)   a soft green ring; with no hunt target, the next one is named under the radar
//   chests     gold squares          your partner and pets   green          co-op friends   blue
//   plateaus   pale blocks with a bright notch at their stairs (plateaus.js)
//   camps      a little tent, gold while its folk have a job for you today, dim once it is done (tentfolk.js)
//   cave mouths  a little sandy arch with a dark doorway, dim once today's cave chest is taken (rockcaves.js)
// It sits on the left between the partner panel and the pills; with touch controls on (touch.js) it moves to the top, beside
// the clock, out of the way of the touch buttons. Off the road (homes, black holes, the arena) it hides.
const RADAR = { range: 420, r: 32, at: () => ({ x: 46, y: 148 }) };   // (phone too, since 2026-11-20: on the right it sat under the trackers and its label under TALK; the left pills it once dodged are hidden on a phone)   // (phone: under the trackers on the right, 2026-11-08; at 432,44 it covered their text)
function drawRadar(world, now) {
  const G = window.GAME, p = world && world.player; if (!G || G.world !== world || !p || !world.overworld || world.home || G.menu || G.scene !== 'world') return;
  if (typeof SET !== 'undefined' && SET.radar === false) return;
  const { x: cx, y: cy } = RADAR.at(), R = RADAR.r, k = R / RADAR.range, pr = G.profile || {};
  const dot = (wx, wy) => { const dx = (wx - p.x) * k, dy = (wy - p.y) * k, d = Math.hypot(dx, dy); if (d > R - 3) return null; return { x: cx + dx, y: cy + dy }; };
  resetView(); ctx.save();
  ctx.fillStyle = 'rgba(8,10,20,0.62)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,216,96,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, Math.PI * 2); ctx.clip();
  if (typeof PLAT !== 'undefined') for (const P of PLAT.list) {   // plateaus: a pale raised block with a bright notch where its stairs are (plateaus.js)
    const x0 = cx + (P.x * T - p.x) * k, y0 = cy + (P.y * T - p.y) * k, w = P.w * T * k, h = P.h * T * k;
    if (x0 > cx + R || x0 + w < cx - R || y0 > cy + R || y0 + h < cy - R) continue;
    ctx.fillStyle = 'rgba(214,200,160,0.28)'; ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(232,200,140,0.7)'; ctx.lineWidth = 0.7; ctx.strokeRect(x0 + 0.35, y0 + 0.35, w - 0.7, h - 0.7);
    ctx.fillStyle = '#fff4d0'; ctx.fillRect(cx + (P.sx * T - p.x) * k, y0 + h - 1, 2 * T * k, 1.6);   // (its stairs)
  }
  if (typeof zoneDoors === 'function') for (const d of zoneDoors(world)) {   // camps (tentfolk.js): a little tent, warm gold while today's job is open, dim once it is done
    if (!d.camp) continue; const q = dot(d.x, d.y - 8); if (!q) continue;
    const S = pr.tents && pr.tents[d.key], done = S && S.day === dayNo() && S.state === 2;
    ctx.fillStyle = '#0a1420'; ctx.beginPath(); ctx.moveTo(q.x, q.y - 4); ctx.lineTo(q.x + 4.2, q.y + 2.6); ctx.lineTo(q.x - 4.2, q.y + 2.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = done ? 'rgba(210,200,170,0.5)' : '#ffd27a'; ctx.beginPath(); ctx.moveTo(q.x, q.y - 3); ctx.lineTo(q.x + 3.2, q.y + 2); ctx.lineTo(q.x - 3.2, q.y + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2410'; ctx.fillRect(q.x - 0.6, q.y, 1.2, 2);   // (its door)
  }
  for (const o of world.objects || []) if (o.chest && !o.opened) { const q = dot(o.x, o.bottom != null ? o.bottom : o.y); if (q) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); } }
  for (const C of world._rcCaves || []) {   // cave mouths (rockcaves.js): a little arch, dim once today's chest is taken
    if (!(pr.rcFound && pr.rcFound[C.key])) continue;   // (a hidden cave, not found yet, stays off the radar)
    const q = dot(C.x, C.y); if (!q) continue; const done = typeof rcToday === 'function' && rcToday(pr, C.key);
    // (2026-11-08: like the caves' own arch: pale stone over a purple swirl; dimmed once today's chest is taken)
    ctx.fillStyle = done ? 'rgba(160,156,150,0.6)' : '#ece4d8'; ctx.beginPath(); ctx.moveTo(q.x - 3.2, q.y + 2); ctx.lineTo(q.x - 3.2, q.y - 1); ctx.arc(q.x, q.y - 1, 3.2, Math.PI, 0); ctx.lineTo(q.x + 3.2, q.y + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = done ? 'rgba(80,60,100,0.7)' : '#8a3cc8'; ctx.beginPath(); ctx.arc(q.x, q.y + 0.2, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  const stars = [], W = typeof mbookWeek === 'function' ? mbookWeek(pr) : null, wkTodo = W ? W.list.filter(e => e.have < MBOOK_WEEK.need) : [], wkLeft = new Set(wkTodo.map(e => e.sp)), wkNext = wkTodo[0];   // (the weekly hunt: book.js)
  for (const a of world.actors) {
    if (a === p || a.dead || a.away || a.riding || a.remove) continue;
    const q = dot(a.x, a.y); if (!q) continue;
    if (a.kind === 'player') { ctx.fillStyle = '#6ac8ff'; ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill(); continue; }
    if (a.kind !== 'monster') continue;
    if (a.ally) { ctx.fillStyle = a.owner === p || a.heroPartner ? '#7aea8a' : '#5ad0b8'; ctx.fillRect(q.x - 1, q.y - 1, 2.2, 2.2); continue; }
    if (a.animalBody || a.dummy) continue;
    const t = typeof eliteTrait === 'function' ? eliteTrait(a) : null, big = a.boss ? 2.6 : t ? 2 : 1.4;
    ctx.fillStyle = a.boss ? '#ff9a3a' : t ? FELITE.traits[t].col : '#ff5a5a'; ctx.beginPath(); ctx.arc(q.x, q.y, big, 0, Math.PI * 2); ctx.fill();
    if (pr.hunt && a.sp === pr.hunt) { stars.push(q); continue; }   // (your hunt target: a gold star, drawn last, on top: book.js)
    if (a.sp && SPECIES[a.sp] && !(pr.book && pr.book[a.sp])) { ctx.strokeStyle = '#c8a8ff'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(q.x, q.y, big + 1.4, 0, Math.PI * 2); ctx.stroke(); }
    else if (wkLeft.has(a.sp)) { ctx.strokeStyle = '#9fe8a8'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(q.x, q.y, big + 1.4, 0, Math.PI * 2); ctx.stroke(); }   // (on this week's hunt list, not yet done: book.js)
  }
  for (const q of stars) { ctx.fillStyle = '#ffd860'; ctx.strokeStyle = '#3a2404'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r2 = i % 2 ? 1.6 : 4, an = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(q.x + Math.cos(an) * r2, q.y + Math.sin(an) * r2); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // you: an arrow the way you face
  const an = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][p.dir] ?? -Math.PI / 2;   // (combat.js dirTo: 0 up, 1 right, 2 down, 3 left)
  // under the radar: two short lines on a dark backing, so they read over grass, sand or snow (the user found them hard to see)
  const under = (l1, c1, l2) => { ctx.font = `700 ${fontPx(7)}px ${FONT}`; const w2 = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) / 1.1 + 10;
    ctx.fillStyle = 'rgba(14,9,20,0.82)'; rrect(ctx, cx - w2 / 2, cy + R + 1.5, w2, 19, 4); ctx.fill();
    text(l1, cx, cy + R + 7, c1, 7); text(l2, cx, cy + R + 15.5, '#f0e8d8', 7); };
  if (pr.hunt && SPECIES[pr.hunt]) {   // what you hunt, and where it lives (book.js)
    const z = typeof MBOOK_ZONE !== 'undefined' ? MBOOK_ZONE[pr.hunt] : null;
    under(`★ ${SPECIES[pr.hunt].name}`, '#ffe070', z != null ? ZONES[z].name : 'off the road');
  } else if (wkNext) {   // no hunt target: the next monster on this week's list, and how far along
    under(`Weekly: ${SPECIES[wkNext.sp].name}`, '#a8ffb4', `${wkNext.have} / ${MBOOK_WEEK.need}`);
  }
  if (pr.wishUntil > Date.now()) {   // a wish on a shooting star is running (pats.js): a little ☆ and the minutes left, on the rim
    const left = Math.ceil((pr.wishUntil - Date.now()) / 60000), wx = cx + R * 0.72, wy = cy - R * 0.72;
    ctx.fillStyle = 'rgba(20,16,36,0.85)'; ctx.beginPath(); ctx.arc(wx, wy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 0.8; ctx.stroke();
    text(`☆${left}`, wx, wy + 0.5, '#fff0b0', 5);
  }
  ctx.translate(cx, cy); ctx.rotate(an); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -3); ctx.lineTo(-1.5, 0); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => { const r = dw(world, cam, bg, now); drawRadar(world, now); return r; };
}
