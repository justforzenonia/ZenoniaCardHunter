'use strict';
// MEAL TIME: its own screen for eating (B, or click the hunger bar), so it is plain what you are about to eat.
//  · left: a big hunger gauge with a ghost of where the selected food takes it, and the two buff slots (MEAL and
//    SNACK) with what is running and how long is left — marked when the selected food would replace it
//  · right: every food on its own plate card (big icon, name, ×count, MEAL / SNACK / FOOD tag, +hunger)
//  · bottom: the selected food's effect as chips (+30% ATK, +15% max HP…), its duration, and an EAT button
// Enter / click a selected plate / EAT: eat · arrows: choose · Esc / B: close

const DINE = { x: 196, y: 58, cols: 5, rows: 2, cw: 82, ch: 74, gap: 4, eat: { x: 516, y: 300, w: 96, h: 20 } };
function diningMenu() { return { type: 'dining', cur: 0, scroll: 0, t: 0 }; }
const dineKind = id => { const F = MEAL_FX[id]; return F ? F.slot : ITEMS[id].kind === 'crop' ? 'crop' : 'food'; };
const DINE_TAG = { meal: ['MEAL', '#ffc040'], snack: ['SNACK', '#8affb0'], crop: ['CROP', '#c8e8a0'], food: ['FOOD', '#e8d8b0'] };
function updateDining(game, m, dt) {
  m.t += dt;
  const list = foodList(game.profile), D2 = DINE;
  if (hit(...KEYS_BACK, 'KeyB')) { game.closeMenu(); return; }
  let mouseEat = false;
  for (let i = 0; i < D2.cols * D2.rows; i++) {
    const idx = m.scroll * D2.cols + i; if (idx >= list.length) break;
    const x = D2.x + (i % D2.cols) * (D2.cw + D2.gap), y = D2.y + Math.floor(i / D2.cols) * (D2.ch + D2.gap);
    if (clicked(x, y, D2.cw, D2.ch)) { mouseEat = m.cur === idx; m.cur = idx; }
  }
  const k = gridNav(m, list.length, D2.cols); keepVisible(m, D2.cols, D2.rows);
  const e = list[m.cur];
  if (e && (k.ok || mouseEat || clicked(D2.eat.x, D2.eat.y, D2.eat.w, D2.eat.h))) {
    if (useHomeItem(game, e.it.home)) { m.ate = { t: 0, id: e.it.home }; const n = foodList(game.profile).length; m.cur = Math.min(m.cur, Math.max(0, n - 1)); }
  }
  if (m.ate) { m.ate.t += dt; if (m.ate.t > 900) m.ate = null; }
}
function drawDining(game, m, now) {
  const pr = game.profile, list = foodList(pr), D2 = DINE, e = list[m.cur], sel = e && e.it.home;
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,4,0.72)'; ctx.fillRect(0, 0, VW, VH);
  // the table: warm wood with a cloth runner
  const tg = ctx.createLinearGradient(0, 30, 0, 340); tg.addColorStop(0, '#5a3a20'); tg.addColorStop(1, '#3a2412');
  ctx.fillStyle = tg; rrect(ctx, 10, 30, VW - 20, 318, 10); ctx.fill();
  ctx.strokeStyle = '#c89a4a'; ctx.lineWidth = 1.5; rrect(ctx, 10.75, 30.75, VW - 21.5, 316.5, 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; for (let y = 44; y < 340; y += 14) { ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(VW - 14, y + Math.sin(y) * 2); ctx.stroke(); }   // grain
  ctx.fillStyle = 'rgba(180,40,40,0.35)'; ctx.fillRect(186, 34, 436, 310);   // the runner
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = 190; x < 618; x += 12) ctx.fillRect(x, 34, 6, 310);
  goldTitle('MEAL TIME', VW / 2, 18, 15, now);
  // ---- left: the hunger gauge
  const hu = pr.hunger ?? 80, add = sel ? ITEMS[sel].hunger || 0 : 0, after = Math.min(100, hu + add), hs = hungerState(hu);
  const lx = 22, ly = 46, lw = 158;
  ctx.fillStyle = 'rgba(16,8,4,0.8)'; rrect(ctx, lx, ly, lw, 74, 6); ctx.fill(); ctx.strokeStyle = 'rgba(200,154,74,0.6)'; ctx.lineWidth = 1; rrect(ctx, lx + 0.5, ly + 0.5, lw - 1, 73, 6); ctx.stroke();
  iconCentered('items', homeIcon(11), lx + 14, ly + 14, 14);
  text('HUNGER', lx + 26, ly + 14, '#e8d8b0', 8, 'left');
  const stCol = { starving: '#ff6a5a', hungry: '#ff9a5a', ok: '#ffd27a', full: '#8fffb0' }[hs];
  text(hs.toUpperCase(), lx + lw - 10, ly + 14, stCol, 7.5, 'right');
  const bx = lx + 10, by = ly + 28, bw = lw - 20, bh = 12;
  ctx.fillStyle = '#05030a'; rrect(ctx, bx, by, bw, bh, 5); ctx.fill();
  if (after > hu) { ctx.fillStyle = `rgba(143,255,176,${0.45 + 0.25 * Math.sin(now / 200)})`; rrect(ctx, bx, by, bw * after / 100, bh, 5); ctx.fill(); }   // the ghost: where this food takes you
  const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0); hg.addColorStop(0, '#ff6a3a'); hg.addColorStop(0.35, '#ffd27a'); hg.addColorStop(1, '#8fffb0');
  ctx.fillStyle = hg; rrect(ctx, bx, by, Math.max(4, bw * hu / 100), bh, 5); ctx.fill();
  for (const v of [HUNGER.hungry, HUNGER.full]) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(bx + bw * v / 100, by - 2, 1, bh + 4); }
  text(`${Math.round(hu)}${after > hu ? `  →  ${Math.round(after)}` : ''} / 100`, lx + lw / 2, by + bh + 10, after > hu ? '#bfffd0' : '#e8d8b0', 7.5);
  if (sel && hu >= 100 && !MEAL_FX[sel]) text('You are full', lx + lw / 2, by + bh + 22, '#ff9a8a', 7);
  // ---- left: the two buff slots
  for (const [i, slot] of [[0, 'meal'], [1, 'snack']]) {
    const y = 128 + i * 62, cur = pr[slot] && pr[slot].ms > 0 && MEAL_FX[pr[slot].id] ? pr[slot] : null, F = cur && MEAL_FX[cur.id];
    const willReplace = sel && MEAL_FX[sel] && MEAL_FX[sel].slot === slot, [tag, tc] = DINE_TAG[slot];
    ctx.fillStyle = 'rgba(16,8,4,0.8)'; rrect(ctx, lx, y, lw, 56, 6); ctx.fill();
    ctx.strokeStyle = willReplace ? `rgba(255,${cur ? 140 : 220},90,${0.7 + 0.3 * Math.sin(now / 180)})` : 'rgba(200,154,74,0.5)'; ctx.lineWidth = willReplace ? 1.5 : 1; rrect(ctx, lx + 0.5, y + 0.5, lw - 1, 55, 6); ctx.stroke();
    text(`${tag} BUFF`, lx + 10, y + 10, tc, 7, 'left');
    if (cur) {
      iconCentered('items', itemIcon(cur.id), lx + 18, y + 31, 18);
      text(F.name, lx + 32, y + 25, '#fff6e0', 8, 'left');
      text(mmss(cur.ms) + ' left', lx + 32, y + 36, '#c8b890', 6.5, 'left');
      ctx.fillStyle = '#05030a'; ctx.fillRect(lx + 32, y + 43, lw - 44, 2.5); ctx.fillStyle = tc; ctx.fillRect(lx + 32, y + 43, (lw - 44) * Math.min(1, cur.ms / F.dur), 2.5);
    } else text('— empty —', lx + lw / 2, y + 30, '#8a7a60', 7.5);
    if (willReplace) text(cur ? '⟳ will be replaced' : '✚ will fill this slot', lx + lw - 10, y + 10, cur ? '#ffb08a' : '#bfffd0', 6, 'right');
  }
  // ---- right: the plates
  for (let i = 0; i < D2.cols * D2.rows; i++) {
    const idx = m.scroll * D2.cols + i, x = D2.x + (i % D2.cols) * (D2.cw + D2.gap), y = D2.y + Math.floor(i / D2.cols) * (D2.ch + D2.gap);
    if (idx >= list.length) { ctx.strokeStyle = 'rgba(255,230,180,0.12)'; ctx.setLineDash([3, 3]); rrect(ctx, x + 0.5, y + 0.5, D2.cw - 1, D2.ch - 1, 6); ctx.stroke(); ctx.setLineDash([]); continue; }
    const f = list[idx], id = f.it.home, kind = dineKind(id), [tag, tc] = DINE_TAG[kind], on = idx === m.cur;
    const lift = on ? -2 + Math.sin(now / 250) * 0.8 : 0;
    ctx.save(); ctx.translate(0, lift);
    ctx.fillStyle = on ? 'rgba(40,24,10,0.95)' : 'rgba(26,16,8,0.88)'; rrect(ctx, x, y, D2.cw, D2.ch, 6); ctx.fill();
    ctx.strokeStyle = on ? '#ffe08a' : 'rgba(200,154,74,0.45)'; ctx.lineWidth = on ? 1.6 : 1; rrect(ctx, x + 0.5, y + 0.5, D2.cw - 1, D2.ch - 1, 6); ctx.stroke();
    // the plate, with the food on it
    const px = x + D2.cw / 2, py = y + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, py + 9, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    const pg = ctx.createRadialGradient(px - 6, py - 2, 2, px, py + 4, 26); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.7, '#e8e4dc'); pg.addColorStop(1, '#a8a098');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(px, py + 5, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,110,100,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(px, py + 5, 17, 6, 0, 0, Math.PI * 2); ctx.stroke();
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,160,0.25)'; ctx.beginPath(); ctx.arc(px, py - 2, 16, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    iconCentered('items', itemIcon(id), px, py - 1, on ? 28 : 24);
    if (on && kind !== 'crop') for (let s = 0; s < 3; s++) { const k2 = ((now / 1200) + s / 3) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.35 * Math.sin(k2 * Math.PI)})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px - 6 + s * 6, py - 12 - k2 * 12); ctx.quadraticCurveTo(px - 3 + s * 6, py - 16 - k2 * 12, px - 6 + s * 6, py - 20 - k2 * 12); ctx.stroke(); }   // steam
    // tag, name, count, hunger
    const tw2 = textW(tag, 6) + 10;   // the tag: a dark pill edged in the kind's colour, the word in that colour
    ctx.fillStyle = 'rgba(10,6,2,0.85)'; rrect(ctx, x + 4, y + 4, tw2, 11, 4); ctx.fill();
    ctx.strokeStyle = tc; ctx.lineWidth = 0.9; rrect(ctx, x + 4.45, y + 4.45, tw2 - 0.9, 10.1, 4); ctx.stroke();
    text(tag, x + 4 + tw2 / 2, y + 9.6, tc, 6);
    if (f.n > 1) text('×' + f.n, x + D2.cw - 6, y + 8.6, '#ffffff', 7, 'right');
    const nm = f.it.name, ns = textW(nm, 7) > D2.cw - 8 ? 6 : 7;
    text(nm, px, y + D2.ch - 18, on ? '#fff6e0' : '#e8d8b0', ns);
    text(`+${ITEMS[id].hunger || 0} hunger`, px, y + D2.ch - 8, '#9fe8b0', 6);
    ctx.restore();
  }
  if (!list.length) { text('Nothing to eat.', D2.x + 210, 110, '#e8d8b0', 10); text('Farm crops, cook meals in your kitchen, or buy bread in town.', D2.x + 210, 126, '#c8b890', 7.5); }
  const pages = Math.ceil(list.length / D2.cols) - D2.rows;
  if (pages > 0) { if (m.scroll > 0) text('▲', D2.x + 210, D2.y - 6, '#ffe08a', 7); if (m.scroll < pages) text('▼', D2.x + 210, D2.y + D2.rows * (D2.ch + D2.gap) - 1, '#ffe08a', 7); }
  // ---- bottom: what the selected food does
  const dy = 222, dx = D2.x, dw = 420;
  ctx.fillStyle = 'rgba(16,8,4,0.85)'; rrect(ctx, dx, dy, dw, 106, 6); ctx.fill(); ctx.strokeStyle = 'rgba(200,154,74,0.6)'; ctx.lineWidth = 1; rrect(ctx, dx + 0.5, dy + 0.5, dw - 1, 105, 6); ctx.stroke();
  if (e) {
    const id = sel, F = MEAL_FX[id], kind = dineKind(id), [tag, tc] = DINE_TAG[kind];
    iconCentered('items', itemIcon(id), dx + 22, dy + 22, 26);
    text(e.it.name, dx + 42, dy + 14, '#fff6e0', 10, 'left');
    text(F ? `${tag} · ${F.name} · ${Math.round(F.dur / 60000)} min` : `${tag} · fills you up, no buff`, dx + 42, dy + 27, tc, 7, 'left');
    text(`+${ITEMS[id].hunger || 0} hunger · heals ${F && F.slot === 'meal' ? 30 : 10}% HP`, dx + dw - 10, dy + 14, '#9fe8b0', 7, 'right');
    // the effect as chips
    const parts = F ? mealText(F).split(' · ') : [ITEMS[id].desc.split(' MEAL')[0].split(' SNACK')[0]];
    let cx = dx + 10, cy = dy + 44;
    for (const s of parts) {
      const w = textW(s, 7) + 14;
      if (cx + w > dx + dw - 10) { cx = dx + 10; cy += 16; }
      ctx.fillStyle = F ? 'rgba(60,40,10,0.9)' : 'rgba(40,30,20,0.9)'; rrect(ctx, cx, cy, w, 13, 5); ctx.fill();
      ctx.strokeStyle = F ? tc : 'rgba(200,180,140,0.5)'; ctx.lineWidth = 0.8; rrect(ctx, cx + 0.4, cy + 0.4, w - 0.8, 12.2, 5); ctx.stroke();
      text(s, cx + w / 2, cy + 6.6, '#fff2c8', 7);
      cx += w + 5;
    }
  } else text('Choose something to eat', dx + dw / 2, dy + 50, '#c8b890', 8);
  // the EAT button
  const B = D2.eat, ready = !!e && !(pr.hunger >= 100 && !MEAL_FX[sel]);
  ctx.fillStyle = ready ? '#3a8a3a' : '#4a4038'; rrect(ctx, B.x, B.y, B.w, B.h, 6); ctx.fill();
  ctx.strokeStyle = ready ? `rgba(190,255,190,${0.6 + 0.3 * Math.sin(now / 250)})` : 'rgba(160,150,130,0.5)'; ctx.lineWidth = 1.2; rrect(ctx, B.x + 0.6, B.y + 0.6, B.w - 1.2, B.h - 1.2, 6); ctx.stroke();
  text('EAT  [Enter]', B.x + B.w / 2, B.y + B.h / 2 + 0.5, ready ? '#ffffff' : '#9a9080', 8);
  // a bite: crumbs burst off the eaten plate
  if (m.ate) { const k2 = m.ate.t / 900; ctx.save(); ctx.globalAlpha = 1 - k2; text('Yum!', D2.x + 210, D2.y + 70 - k2 * 20, '#ffe08a', 14); ctx.restore(); }
  text('Arrows choose · Enter / click a selected plate: eat · Esc / B: close', VW / 2, 340, '#a89878', 6.5);
  ctx.restore();
}
