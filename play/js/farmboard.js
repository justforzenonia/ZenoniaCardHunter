'use strict';
// THE FARM BOARD: the same iron frame and slate pages as the partner screens. The left page is your farm at a glance (level, XP, the watering can, the Blessing);
// the right page has three tabs: FARM (today's order and the next plot), SKILLS (what your Farm Points buy) and BUILD (the farmyard).
const FB = { fieldRows: [['wheat', 'wheat', 'carrot'], ['tomato', 'berry', 'lettuce'], ['pumpkin', 'carrot', 'wheat']], theme: '#4a9a58', tabs: ['FARM', 'SKILLS', 'BUILD', 'VEHICLES'], tabCol: ['#ffd27a', '#b8ff8a', '#8fd8ff', '#ff9a7a'], tile: { w: 165, h: 41, gap: 4 } };
// (2026-11-20, the user: "vehicle tab doesnt fit in farm board": the partner screens' PU_TAB is spaced for three tabs, so the
// fourth ran past the frame; the Farm Board spreads its four evenly over the right page)
const FB_TAB = i => { const n = FB.tabs.length, w = (PU_R.w - 8) / n - 4; return { x: PU_R.x + 4 + i * (w + 4), y: PU.y - 19, w, h: 19 }; };
const FARM_KEYS = Object.keys(FARM_SKILLS);
function farmMenu(town = null) { return { type: 'farm', tab: 0, cur: 0, town }; }
const fbCount = m => m.tab === 0 ? 2 : m.tab === 1 ? FARM_KEYS.length : m.tab === 3 ? VEHICLE_MODELS.length : YARD_KEYS.length;   // (VEHICLES: vehicles.js)
const fbFarmCard = i => i ? { x: PU_R.x + 12, y: PU_R.y + 172, w: PU_R.w - 24, h: 66 } : { x: PU_R.x + 12, y: PU_R.y + 34, w: PU_R.w - 24, h: 130 };
const fbSkill = i => ({ x: PU_R.x + 12 + (i % 2) * (FB.tile.w + 6), y: PU_R.y + 32 + Math.floor(i / 2) * (FB.tile.h + FB.tile.gap), w: FB.tile.w, h: FB.tile.h });
const fbYard = i => ({ x: PU_R.x + 12, y: PU_R.y + 36 + i * 58, w: PU_R.w - 24, h: 52 });
const fbRect = (m, i) => m.tab === 0 ? fbFarmCard(i) : m.tab === 1 ? fbSkill(i) : m.tab === 3 ? vehRow(i) : fbYard(i);
function fbAct(game, m) {
  const pr = game.profile, F = farmer(pr);
  if (m.tab === 0) { if (m.cur === 0) deliverOrder(game); else plotBuy(game, m.town ?? null); return; }
  if (m.tab === 2) { yardBuild(game, YARD_KEYS[m.cur]); return; }
  if (m.tab === 3) { vehAct(game, m); return; }
  const key = FARM_KEYS[m.cur], S = FARM_SKILLS[key];
  if (F.sk[key] >= S.max) { game.toast(`${S.name} is already maxed`, '#c9c1a8'); return; }
  if (F.pts <= 0) { game.toast('No farming points — farm more to reach the next Farm Level', '#ff8a8a'); return; }
  if (key === 'thumb') for (const P of farmOf(pr)) if (P && P.crop) settlePlot(P, pr);   // growth so far counts at the old speed
  F.pts--; F.sk[key]++; if (key === 'can') F.water++;
  if (key === 'hound') adoptPet(game);   // the dog arrives at once
  game.save(); game.toast(`${S.name} → ${F.sk[key]} · ${S.desc(F.sk[key])}`, '#b8ff8a');
}
function updateFarmMenu(game, m) {
  const k = navInput(), tabTo = t => { m.tab = (t + FB.tabs.length) % FB.tabs.length; m.cur = 0; }; if (k.back) { game.closeMenu(); return; }
  if (hit('Tab') || hit('KeyE')) tabTo(m.tab + 1); if (hit('KeyQ')) tabTo(m.tab - 1); FB.tabs.forEach((_, i) => { const B = FB_TAB(i); if (clicked(B.x, PU.y - 19, B.w, 20)) tabTo(i); });
  const n = fbCount(m), cols = m.tab === 1 ? 2 : 1;
  if (k.u) m.cur = (m.cur + n - cols) % n; if (k.d) m.cur = (m.cur + cols) % n; if (cols > 1 && k.l) m.cur = (m.cur + n - 1) % n; if (cols > 1 && k.r) m.cur = (m.cur + 1) % n;
  for (let i = 0; i < n; i++) { const R = fbRect(m, i); if (clicked(R.x, R.y, R.w, R.h)) { if (m.cur === i) k.ok = true; m.cur = i; } }
  if (m.tab === 3) vehCustom(game, m, k);   // paint and tint (vehicles.js)
  if (k.ok) fbAct(game, m);
}
// a framed card, gold-edged when it is the one chosen
function fbCard(R, sel, lit) {
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, sel ? '#3f5a48' : '#34405a'); g.addColorStop(0.55, sel ? '#27382e' : '#3c2819'); g.addColorStop(1, '#1f140d'); ctx.fillStyle = g; rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.fill();
  ctx.save(); rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.clip(); ctx.fillStyle = lit || '#563924'; ctx.fillRect(R.x, R.y, 3, R.h); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(R.x, R.y, R.w, 1.5); ctx.restore();
  ctx.strokeStyle = sel ? '#ffd860' : goldFrameGrad(R.y, R.h); ctx.lineWidth = sel ? 1.5 : 0.9; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 5); ctx.stroke();
}
function fbSocket(x, y, r, col, lit) { puSocket(x, y, r, '', col, lit, false); }
function fbChip(x, y, w, ic, v, col) { ctx.fillStyle = 'rgba(22,15,9,0.82)'; rrect(ctx, x, y, w, 17, 3); ctx.fill(); ctx.strokeStyle = '#563924'; ctx.lineWidth = 0.8; rrect(ctx, x + 0.4, y + 0.4, w - 0.8, 16.2, 3); ctx.stroke(); if (typeof ic === 'number') iconCentered('items', ic, x + 10, y + 8.5, 12); else text(ic, x + 10, y + 8.5, col, 8); petInk(v, x + 20, y + 8.5, col, 8.5, 'left'); }
function drawFarmMenu(game, m, now) {
  const pr = game.profile, F = farmer(pr), sh = puShades({ col: FB.theme }), need = farmXpNeed(F.lv), cap = canCap(pr), town = m.town == null ? 'HEARTHVALE' : OUTPOST_TOWNS[m.town].name.toUpperCase();
  ctx.fillStyle = 'rgba(8,6,14,0.78)'; ctx.fillRect(0, 0, VW, VH); goldTitle('FARM BOARD', VW / 2, 12, 15, now);
  FB.tabs.forEach((t, i) => {
    const B = FB_TAB(i), on = m.tab === i, ty = PU.y - (on ? 19 : 15), c = FB.tabCol[i];
    ctx.save(); ctx.shadowColor = on ? hexA(c, 0.7) : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = (on ? 6 : 3) * RES; const tg = ctx.createLinearGradient(0, ty, 0, ty + 22); tg.addColorStop(0, on ? '#4a5670' : '#422c1c'); tg.addColorStop(1, on ? '#3a2618' : '#24180f'); ctx.fillStyle = tg; rrect(ctx, B.x, ty, B.w, 24, 4); ctx.fill(); ctx.restore();
    ctx.fillStyle = on ? c : mixCol(c, '#000000', 0.45); ctx.fillRect(B.x + 3, ty + 2, B.w - 6, on ? 2.4 : 1.6); ctx.strokeStyle = on ? '#ffd860' : '#5a6478'; ctx.lineWidth = on ? 1.2 : 0.9; rrect(ctx, B.x + 0.5, ty + 0.5, B.w - 1, 23, 4); ctx.stroke();
    text(i === 1 && F.pts ? `SKILLS (${F.pts})` : t, B.x + B.w / 2, ty + 10, on ? '#ffffff' : '#9aa4b8', 8);
  });
  drawIronFrame(PU, sh.plate[0], sh.plate[1]); drawSlatePage(PU_L, sh.page[0], sh.page[1]); drawSlatePage(PU_R, sh.page[0], sh.page[1]);
  const hg = ctx.createLinearGradient(242, 0, 250, 0); hg.addColorStop(0, '#563924'); hg.addColorStop(0.5, '#9aa4b8'); hg.addColorStop(1, '#563924'); ctx.fillStyle = hg; ctx.fillRect(243, PU_L.y + 2, 6, PU_L.h - 4);
  if (m.tab === 3) { drawVehicleTab(game, m, now); return; }   // the garage (vehicles.js)
  // left page: a little field under the sky, with the Farm Level on a gold medal
  const A = { x: PU_L.x + 8, y: PU_L.y + 8, w: PU_L.w - 16, h: 112 }, cx = PU_L.x + PU_L.w / 2, my = A.y + 46;
  ctx.save(); rrect(ctx, A.x, A.y, A.w, A.h, 5); ctx.clip();
  const sky = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); sky.addColorStop(0, '#6ab8e0'); sky.addColorStop(0.62, '#d8eeb0'); sky.addColorStop(0.64, '#5aa048'); sky.addColorStop(1, '#2a5a2a'); ctx.fillStyle = sky; ctx.fillRect(A.x, A.y, A.w, A.h);
  ctx.fillStyle = 'rgba(255,240,170,0.9)'; ctx.beginPath(); ctx.arc(A.x + 30, A.y + 24, 9, 0, Math.PI * 2); ctx.fill();
  // (2026-11-20, the user: "i dont know what those are change it to something that represents farming": the little coloured
  // bars are now the game's own crop icons, three rows of them growing in furrows of tilled soil, nodding in the breeze)
  { const rows = FB.fieldRows, n = 8, step = (A.w - 8) / n;
    for (let r = 0; r < rows.length; r++) {
      const y = A.y + 80 + r * 12; ctx.fillStyle = '#5a3a1e'; ctx.fillRect(A.x + 2, y + 4, A.w - 4, 4); ctx.fillStyle = '#7a5230'; ctx.fillRect(A.x + 2, y + 4, A.w - 4, 1);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < n; i++) { const crop = rows[r][i % rows[r].length], bob = Math.round(Math.sin(now / 800 + i * 0.9 + r * 1.7)); if (ITEMS[crop]) iconCentered('items', itemIcon(crop), A.x + 4 + step * (i + 0.5) + (r % 2) * step * 0.25, y - 1 + bob, 13); }
      ctx.restore();
    } }
  ctx.restore(); ctx.strokeStyle = goldFrameGrad(A.y, A.h); ctx.lineWidth = 1.2; rrect(ctx, A.x + 0.6, A.y + 0.6, A.w - 1.2, A.h - 1.2, 5); ctx.stroke();
  ctx.fillStyle = 'rgba(22,15,9,0.92)'; ctx.beginPath(); ctx.arc(cx, my, 30, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#422c1c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, my, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#8fffb0'; ctx.beginPath(); ctx.arc(cx, my, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, F.xp / need)); ctx.stroke(); ctx.strokeStyle = goldFrameGrad(my - 30, 60); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, my, 30, 0, Math.PI * 2); ctx.stroke();
  petInk('FARM LV', cx, my - 11, '#9aa4b8', 7, 'center', false); goldTitle(String(F.lv), cx, my + 6, 18, now);
  const Nm = { x: PU_L.x + 14, y: PU_L.y + 124, w: PU_L.w - 28, h: 20 }, ng = ctx.createLinearGradient(0, Nm.y, 0, Nm.y + Nm.h); ng.addColorStop(0, '#3a2a14'); ng.addColorStop(1, '#17100a'); ctx.fillStyle = ng; rrect(ctx, Nm.x, Nm.y, Nm.w, Nm.h, 4); ctx.fill(); ctx.strokeStyle = goldFrameGrad(Nm.y, Nm.h); ctx.lineWidth = 1; rrect(ctx, Nm.x + 0.5, Nm.y + 0.5, Nm.w - 1, Nm.h - 1, 4); ctx.stroke(); goldTitle(`${town} FARM`, cx, Nm.y + 10, 9.5, now);
  const bx = PU_L.x + 12, bw = PU_L.w - 24; puBar(bx, PU_L.y + 150, bw, F.xp / need, '#8fffb0', '★', `Farm XP ${F.xp} / ${need}`); puBar(bx, PU_L.y + 165, bw, F.water / cap, '#58b8e8', '💧', `Watering can ${F.water} / ${cap}`);
  fbChip(bx, PU_L.y + 182, bw, '✦', F.pts ? `${F.pts} Farm Point${F.pts === 1 ? '' : 's'} to spend` : 'No Farm Points right now', F.pts ? '#8fffb0' : '#9aa4b8');
  const bless = blessingText(F.lv).split(': ')[1] || ''; ctx.fillStyle = 'rgba(70,50,12,0.5)'; rrect(ctx, bx, PU_L.y + 203, bw, 36, 4); ctx.fill(); ctx.strokeStyle = goldFrameGrad(PU_L.y + 203, 36); ctx.lineWidth = 0.9; rrect(ctx, bx + 0.5, PU_L.y + 203.5, bw - 1, 35, 4); ctx.stroke();
  petInk("Farmer's Blessing", cx, PU_L.y + 214, '#ffd27a', 8, 'center'); petInk(bless, cx, PU_L.y + 229, '#f0e6d2', 8, 'center', false);
  // the field at a glance (Hearthvale's plots and any outpost fields you own): ripe, dry and growing, with the Full Field bonus
  let rp = 0, dr = 0, gr = 0; (pr.farm || []).forEach(P => { if (!P || !P.crop) return; if (plotProgress(P, pr) >= 1) rp++; else if (plotWet(P)) gr++; else dr++; });
  if (rp + dr + gr) petInk(`Field: ${rp} ripe · ${dr} dry · ${gr} growing${fullField(pr) ? ' · Full Field +30%' : ''}`, cx, PU_L.y + 250, dr ? '#ffd27a' : rp ? '#8fffb0' : '#c8e8a0', 7.5, 'center', false);
  else petInk(fullField(pr) ? 'FULL FIELD: +30% growth' : 'Plant 15 plots for a Full Field bonus', cx, PU_L.y + 250, fullField(pr) ? '#8fffb0' : '#b8ae96', 7.5, 'center', false);
  petInk('Tab: next page · Esc: close', cx, PU_L.y + PU_L.h - 12, '#9aa4b8', 7.5, 'center', false);
  // right page
  const O = farmOrder(pr), have = (pr.items || {})[O.crop] || 0, ready = have >= O.n, midR = PU_R.x + PU_R.w / 2;
  if (m.tab === 0) {
    partnerHeading("TODAY'S ORDER", PU_R.y + 18, now);
    const C = fbFarmCard(0); fbCard(C, m.cur === 0, ready ? '#8fffb0' : '#ffb060'); fbSocket(C.x + 40, C.y + 44, 28, ready ? '#8fffb0' : '#ffd27a', true); iconCentered('items', itemIcon(O.crop), C.x + 40, C.y + 44, 34);
    goldTitle(`${O.n} × ${ITEMS[O.crop].name.toUpperCase()}`, C.x + 196, C.y + 18, 12, now); puBar(C.x + 82, C.y + 32, C.w - 96, have / O.n, ready ? '#8fffb0' : '#ffb060', '✓', `You have ${have} of ${O.n}`);
    fbChip(C.x + 82, C.y + 50, 80, 200021, `${O.gold} G`, '#ffd23f'); fbChip(C.x + 166, C.y + 50, 62, '●', `${O.coins} coin${O.coins > 1 ? 's' : ''}`, '#ffe08a'); fbChip(C.x + 232, C.y + 50, 84, '★', `${O.xp} Farm XP`, '#8fffb0');
    popupButton({ x: C.x + C.w / 2 - 80, y: C.y + 98, w: 160, h: 22, label: ready ? 'DELIVER [Enter]' : `NEED ${O.n - have} MORE`, primary: ready, col: '#ffc07a' }, now);
    const P = plotRow(pr, m.town ?? null), D = fbFarmCard(1); fbCard(D, m.cur === 1, '#ffd27a'); fbSocket(D.x + 32, D.y + 33, 20, '#ffd27a', true); if (P.draw) P.draw(D.x + 32, D.y + 33); else if (P.icon != null) iconCentered('items', P.icon, D.x + 32, D.y + 33, 26);
    petInk(P.name, D.x + 60, D.y + 20, P.col || '#f0e6d2', 9.5, 'left'); petInk(P.sub || '', D.x + 60, D.y + 38, '#c8d0e0', 8, 'left', false); if (P.right) text(P.right, D.x + D.w - 12, D.y + 20, P.rightCol || '#ffd23f', 10, 'right');
    petInk(typeof marketCrop === 'function' ? `Market today: ${ITEMS[marketCrop()].name} sells for double at the Grocer` : 'Plant, water, harvest and tend animals for Farm XP', midR, PU_R.y + 256, typeof marketCrop === 'function' ? '#ffd27a' : '#9aa4b8', 7.5, 'center', false);
  } else if (m.tab === 1) {
    partnerHeading('FARM SKILLS', PU_R.y + 16, now);
    FARM_KEYS.forEach((k, i) => {
      const S = FARM_SKILLS[k], l = F.sk[k], R = fbSkill(i), max = l >= S.max, on = m.cur === i; fbCard(R, on, max ? '#ffd23f' : l ? '#8fffb0' : '#563924'); fbSocket(R.x + 21, R.y + R.h / 2, 15, max ? '#ffd23f' : '#8fffb0', l > 0);
      if (S.npc) npcRow(S.npc)(R.x + 21, R.y + R.h / 2); else iconCentered('items', homeIcon(S.icon), R.x + 21, R.y + R.h / 2, 18);
      petInk(S.name, R.x + 42, R.y + 13, on ? '#ffffff' : '#e0e6f0', 8.5, 'left');
      const w = Math.min(10, (R.w - 56) / S.max - 2); for (let p = 0; p < S.max; p++) { ctx.fillStyle = p < l ? (max ? '#ffd23f' : '#8fffb0') : 'rgba(0,0,0,0.55)'; ctx.fillRect(R.x + 42 + p * (w + 2), R.y + 25, w, 6); ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.5; ctx.strokeRect(R.x + 42.25 + p * (w + 2), R.y + 25.25, w - 0.5, 5.5); }
      if (!max && F.pts) { ctx.fillStyle = '#2a6a3a'; rrect(ctx, R.x + R.w - 21, R.y + 5, 16, 11, 3); ctx.fill(); text('+1', R.x + R.w - 13, R.y + 10.5, '#d8ffd8', 7); }
    });
    const S = FARM_SKILLS[FARM_KEYS[m.cur]], l = F.sk[FARM_KEYS[m.cur]], max = l >= S.max, Y = fbSkill(6).y + (FARM_KEYS.length % 2 ? 0 : FB.tile.h + FB.tile.gap), X = FARM_KEYS.length % 2 ? PU_R.x + 12 + FB.tile.w + 6 : PU_R.x + 12, W = FARM_KEYS.length % 2 ? FB.tile.w : PU_R.w - 24;
    ctx.fillStyle = 'rgba(22,15,9,0.72)'; rrect(ctx, X, Y, W, 41, 5); ctx.fill(); ctx.strokeStyle = '#563924'; ctx.lineWidth = 0.8; rrect(ctx, X + 0.5, Y + 0.5, W - 1, 40, 5); ctx.stroke();
    petInk(`Now: ${S.desc(l)}`.slice(0, 44), X + 7, Y + 11, '#d8d8e0', 7, 'left', false); if (!max) petInk(`Next: ${S.desc(l + 1)}`.slice(0, 44), X + 7, Y + 23, '#8fffb0', 7, 'left', false); petInk(max ? 'Fully learned' : F.pts ? 'Enter: spend a point' : 'Level up your farm for points', X + 7, Y + 34, '#9aa4b8', 7, 'left', false);
  } else {
    partnerHeading('THE FARMYARD', PU_R.y + 18, now);
    yardRows(pr).forEach((r, i) => {
      const R = fbYard(i), id = YARD_KEYS[i], has = built(pr, id), B = YARD.builds[id], can = F.lv >= B.lv && (pr.gold || 0) >= B.gold; fbCard(R, m.cur === i, has ? '#ffd23f' : can ? '#8fffb0' : '#563924'); fbSocket(R.x + 28, R.y + R.h / 2, 19, has ? '#ffd23f' : '#8fd8ff', has); r.draw(R.x + 28, R.y + R.h / 2);
      petInk(B.name, R.x + 56, R.y + 16, m.cur === i ? '#ffffff' : '#e0e6f0', 10, 'left'); petInk(B.desc, R.x + 56, R.y + 29, '#c8d0e0', 7.5, 'left', false); petInk(has ? 'Standing on your farm' : `Needs Farm Level ${B.lv}`, R.x + 56, R.y + 41, has ? '#ffd23f' : F.lv >= B.lv ? '#8fffb0' : '#ff9a8a', 7.5, 'left', false); text(r.right, R.x + R.w - 12, R.y + R.h / 2, r.rightCol, 10, 'right');
    });
  }
}
