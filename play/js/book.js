'use strict';
// THE MONSTER BOOK (key - [minus], or MORE ▸ BOOK on touch; it was 9 until 2026-11-08, when 9 became the car's key): every monster in the game on one page. One you have defeated shows its
// portrait, how many you have beaten and the best card of it you hold; one you have not met yet is a dark "?". Each species
// you defeat for the first time adds a page, and every 10 pages pays a reward (MBOOK.prize). A co-op friend's kills count for
// them too (net.js netKill). pr.book = { sp: kills }, pr.bookAt = { sp: where it was first beaten }.
// A WHERE TO HUNT guide too: a page says which zone the monster lives in (ZONES mobs / mobs2: 52 of them) and where you first
// beat it; one not met yet shows as a dark silhouette of its shape, with its zone if it has one.
const MBOOK = { key: 'Minus', cols: 8, cell: { w: 46, h: 38 }, every: 10, rows: 7, prize: n => ({ coins: 8, gold: 25 * n }) };   // (rows: how many show at once; it scrolls)
const mbookList = () => Object.keys(SPECIES).filter(k => SPECIES[k] && SPECIES[k].name).sort();
// (a zone's bookHome: monsters filed under it though an earlier zone also has them: the desert's sand golems, scorpions, mummies)
const MBOOK_ZONE = {}; ZONES.forEach((Z, z) => (Z.bookHome || []).forEach(sp => { MBOOK_ZONE[sp] = z; })); ZONES.forEach((Z, z) => [...(Z.mobs || []), ...(Z.mobs2 || [])].forEach(sp => { if (MBOOK_ZONE[sp] == null) MBOOK_ZONE[sp] = z; }));
// where a monster fell: the area of the road, or the kind of place off it
function mbookPlace(w, x) {
  if (!w) return null;
  if (w.overworld && typeof regionAt === 'function') { const R = regionAt(x); if (R) return R.zone < 0 ? areaName(R) : `${ZONES[R.zone].name} · ${areaName(R)}`; }
  return w.cave ? 'a black hole' : w.rift ? 'a rift' : w.raidBoss ? 'a raid' : 'off the road';
}
function mbookKill(game, sp, where) {
  const pr = game.profile; if (!pr || !sp || !SPECIES[sp]) return;
  pr.book = pr.book || {}; const first = !pr.book[sp]; pr.book[sp] = (pr.book[sp] || 0) + 1;
  pr.bookAt = pr.bookAt || {}; if (where && !pr.bookAt[sp]) pr.bookAt[sp] = where;
  if (!first) return;
  if (typeof dailyEvent === 'function') dailyEvent(game, 'newpage');   // (the daily contract, daily.js)
  mbookZoneCheck(game, sp);
  const n = Object.keys(pr.book).length;
  { const nf = `New for your Monster Book: ${SPECIES[sp].name}`; if (game.toasts) game.toasts = game.toasts.filter(t => t.str !== nf); if (game.toastWait) game.toastWait = game.toastWait.filter(e => e[0] !== nf); }   // (beaten soon after it was spotted: this line takes the place of the 'New for' one rather than stacking under it)
  game.toast(`Monster Book: ${SPECIES[sp].name} added (${n}/${mbookList().length}) · press -`, '#c8a8ff');
  if (n % MBOOK.every === 0) {
    const P = MBOOK.prize(n); pr.coins = (pr.coins || 0) + P.coins; pr.gold = (pr.gold || 0) + P.gold;
    game.toast(`Monster Book: ${n} pages! +${P.coins} coins, +${P.gold} G`, '#ffd860');
  }
}
{ const ok = onMonsterKill; onMonsterKill = (game, w, m) => { const r = ok(game, w, m); if (m && !m.ally) mbookKill(game, m.sp, mbookPlace(w, m.x)); return r; }; }
{ const nk = netKill; netKill = (game, w, K) => { const r = nk(game, w, K); if (K) mbookKill(game, K.sp, mbookPlace(w, K.x)); return r; }; }
// opening it: 9 in the world, for the host and a guest alike
function mbookKeyCheck(game) { if (!game.menu && game.scene === 'world' && hit(MBOOK.key)) { consume(MBOOK.key); game.openMenu(monsterBookMenu()); } }
{ const u = updateWorldScene; updateWorldScene = dt => { mbookKeyCheck(GAME); return u(dt); }; }
{ const g = netGuestFrame; netGuestFrame = (game, dt) => { mbookKeyCheck(game); return g(game, dt); }; }
function monsterBookMenu() { return { type: 'mbook', cur: 0, scroll: 0, t: 0, f: 0 }; }
const MBOOK_RECT = () => { const C = MBOOK.cell, gw = MBOOK.cols * C.w; return { x: 26, y: 64, gw, gh: MBOOK.rows * C.h, rows: MBOOK.rows }; };
// FILTERS along the top (Q / E, or a click): everything, one zone's monsters, those off the road, or only the pages still empty
const MBOOK_FILTERS = [
  { name: 'ALL', ok: () => true },
  ...ZONES.map((Z, z) => ({ name: Z.name.split(' ')[0].toUpperCase(), ok: sp => MBOOK_ZONE[sp] === z })),
  { name: 'OFF ROAD', ok: sp => MBOOK_ZONE[sp] == null },
  { name: 'MISSING', ok: (sp, B) => !B[sp] },
  { name: 'NO CARD', ok: (sp, B, best) => !!B[sp] && best[sp] == null },   // (beaten, but its card not yet yours: a card-hunting list)
  { name: 'WEEKLY', weekly: true, ok: () => false },   // (not a list: this week's five to hunt, drawMbookWeekly)
  { name: 'RECORD', record: true, ok: () => false },   // (not a list: your hunter's record, drawMbookRecord)
];
// A ZONE COMPLETE: every monster of one zone in the book pays once: coins, gold and a card of one of that zone's monsters at
// the zone's top rank (pr.bookZones = { z: when }). Its filter tab then wears a ✓.
const MBOOK_ZONE_PRIZE = z => ({ coins: 20 + 10 * z, gold: 1500 * (z + 1), tier: ZONES[z].ranks[1] });
// the furthest zone whose monsters the hunting lists (Monster of the Day, weekly hunts, gifts) may pick: the story's zone, or the
// desert once the Frozen Abyss's Guardian has opened the road into it (the story's zone stops at the Abyss)
const mbookZoneMax = pr => { const z = typeof storyZone === 'function' ? storyZone(pr) : 0; return pr && pr.cleared && pr.cleared[3] && ZONES[4] ? Math.max(z, 4) : z; };
const mbookZoneSpecies = z => mbookList().filter(sp => MBOOK_ZONE[sp] === z);
function mbookZoneCheck(game, sp) {
  const pr = game.profile, z = MBOOK_ZONE[sp]; if (z == null || !pr) return;
  pr.bookZones = pr.bookZones || {}; if (pr.bookZones[z]) return;
  const all = mbookZoneSpecies(z); if (!all.every(s2 => pr.book && pr.book[s2])) return;
  pr.bookZones[z] = Date.now();
  const P = MBOOK_ZONE_PRIZE(z), pool = all.filter(id => !D.monsters || D.monsters[id]), c = makeCard(pick(pool.length ? pool : all), P.tier);
  pr.coins = (pr.coins || 0) + P.coins; pr.gold = (pr.gold || 0) + P.gold; game.pickup({ kind: 'card', item: c });
  game.toast(`MONSTER BOOK: ${ZONES[z].name} complete! All ${all.length} pages · +${P.coins} coins, +${P.gold} G, a rank ${RANKS[c.tier]} card`, '#ffd860');
  if (typeof SFX !== 'undefined' && SFX.smite) SFX.smite();
}
const mbookTabName = (i, pr) => { const F = MBOOK_FILTERS[i], z = i - 1; return z >= 0 && z < ZONES.length && pr && pr.bookZones && pr.bookZones[z] ? `${F.name} ✓` : F.name; };
// the best rank of each monster's card you hold (bag and storage)
function mbookBest(pr) {
  const best = {}; if (!pr) return best;
  const all = [...(pr.cards || []), ...((pr.storage && pr.storage.cards) || [])];
  for (const c of all) if (c && c.sp && !c.fusion && (best[c.sp] == null || c.tier > best[c.sp])) best[c.sp] = c.tier;
  return best;
}
const mbookView = (game, m) => { const pr = game.profile, B = (pr && pr.book) || {}, F = MBOOK_FILTERS[m.f || 0], best = mbookBest(pr); return mbookList().filter(sp => F.ok(sp, B, best)); };
function mbookTabs() {   // where each filter tab sits
  let x = 26; const out = [];
  const pr = window.GAME && GAME.profile;
  const tw = MBOOK_FILTERS.map((F, i) => Math.round(textW(mbookTabName(i, pr), 6))), room = VW - 52, natural = tw.reduce((a, b) => a + b + 15, 0) - 3;
  const pad = natural <= room ? 12 : Math.max(4, Math.floor((room - tw.reduce((a, b) => a + b, 0) - 2 * (tw.length - 1)) / tw.length)), gap = natural <= room ? 3 : 2;   // (squeeze the padding when the tabs would run off the page)
  MBOOK_FILTERS.forEach((F, i) => { const w = tw[i] + pad; out.push({ x, y: 47, w, h: 11 }); x += w + gap; });   // (textW: the game's own text measure)
  return out;
}
const mbookScroll = m => { const row = Math.floor(m.cur / MBOOK.cols); m.scroll = Math.max(Math.min(m.scroll || 0, row), row - MBOOK.rows + 1); return m.scroll; };
function updateMonsterBook(game, m, dt) {
  if (!m.swept) { m.swept = true; const pr = game.profile; if (pr && pr.book) ZONES.forEach((Z, z) => { const s = mbookZoneSpecies(z)[0]; if (s && !(pr.bookZones && pr.bookZones[z])) mbookZoneCheck(game, s); }); }   // (a zone already complete when its pages changed pays now)
  m.t += dt; const k = navInput(), C = MBOOK.cell, R = MBOOK_RECT(), NF = MBOOK_FILTERS.length;
  if (m.card) {   // looking at a card: any key or a click puts it away (and nothing else happens this frame)
    if (m.t > 200 && (k.back || k.ok || hit('KeyC') || hit(MBOOK.key) || mouse.click)) { consume('KeyC', MBOOK.key, 'Escape', 'Enter'); m.card = null; m.t = 0; }
    return;
  }
  if (MBOOK_FILTERS[m.f || 0].record && hit('KeyS') && m.t > 150) { consume('KeyS'); m.snap = true; }   // (RECORD: S saves a picture of the page)
  let f = m.f || 0; if (hit('KeyQ')) { consume('KeyQ'); f = (f + NF - 1) % NF; } if (hit('KeyE')) { consume('KeyE'); f = (f + 1) % NF; }
  mbookTabs().forEach((b, i) => { if (clicked(b.x, b.y, b.w, b.h)) f = i; });
  if (f !== (m.f || 0)) { m.f = f; m.cur = 0; m.scroll = 0; }
  const L = mbookView(game, m), n = Math.max(1, L.length); m.cur = Math.min(m.cur, n - 1);
  if (k.l) m.cur = (m.cur + n - 1) % n; if (k.r) m.cur = (m.cur + 1) % n;
  if (k.u) m.cur = (m.cur - MBOOK.cols + n) % n; if (k.d) m.cur = (m.cur + MBOOK.cols) % n;
  const s0 = mbookScroll(m);
  for (let i = s0 * MBOOK.cols; i < Math.min(n, (s0 + MBOOK.rows) * MBOOK.cols); i++) { const x = R.x + (i % MBOOK.cols) * C.w, y = R.y + (Math.floor(i / MBOOK.cols) - s0) * C.h; if (clicked(x, y, C.w - 2, C.h - 2)) m.cur = i; }
  mbookScroll(m);
  {   // C (or a click on "Best card"): your best copy of this monster's card, full size
    const Rr = MBOOK_RECT(), px = Rr.x + Rr.gw + 14, pw = VW - 26 - px - 8, sp = mbookView(game, m)[m.cur];
    if (sp && m.t > 150 && (hit('KeyC') || clicked(px + 8, Rr.y + 141, pw - 16, 13))) {
      consume('KeyC'); const c = mbookBestCard(game.profile, sp);
      if (c) { m.card = c; m.t = 0; return; } game.toast("You don't hold its card yet", '#c9c1a8');
    }
  }
  if (k.ok && m.t > 150 && mbookView(game, m).length) {   // Enter: hunt this one (again: stop)
    const pr = game.profile, sp = mbookView(game, m)[m.cur]; pr.hunt = pr.hunt === sp ? null : sp; MBOOK_HUNT.last = 0;
    game.toast(pr.hunt ? `Hunting ${SPECIES[sp].name}: it shows as a gold star on the radar` : 'Hunt target cleared', '#ffd860');
  }
  if ((k.back || hit(MBOOK.key)) && m.t > 150) { consume(MBOOK.key); game.closeMenu(); }
}
function drawMonsterBook(game, m, now) {
  const pr = game.profile || {}, B = pr.book || {}, L = mbookView(game, m), C = MBOOK.cell, R = MBOOK_RECT(), all = mbookList();
  ctx.fillStyle = 'rgba(6,4,14,0.78)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#1c120c'; rrect(ctx, 14, 14, VW - 28, VH - 28, 8); ctx.fill();
  ctx.strokeStyle = goldFrameGrad(14, VH - 28); ctx.lineWidth = 1.4; rrect(ctx, 14.5, 14.5, VW - 29, VH - 29, 8); ctx.stroke();
  const got = L.filter(sp => B[sp]).length, gotAll = all.filter(sp => B[sp]).length, F = MBOOK_FILTERS[m.f || 0];
  goldText('MONSTER BOOK', VW / 2, 26, 12, { spacing: 2 });
  text(`${gotAll} / ${all.length} pages · every ${MBOOK.every} pays a reward${(m.f || 0) && !F.record && !F.weekly ? `  ·  ${F.name}: ${F.name === 'MISSING' ? L.length + ' to find' : got + ' / ' + L.length}` : ''}`, VW / 2, 39, '#b8b0c8', 6.5);
  mbookTabs().forEach((b, i) => {
    const on = i === (m.f || 0);
    ctx.fillStyle = on ? '#7a52c8' : '#3a2618'; rrect(ctx, b.x, b.y, b.w, b.h, 3); ctx.fill();
    if (on) { ctx.strokeStyle = '#c8a8ff'; ctx.lineWidth = 1; rrect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 3); ctx.stroke(); }
    const done = mbookTabName(i, pr) !== MBOOK_FILTERS[i].name;
    text(mbookTabName(i, pr), b.x + b.w / 2, b.y + b.h / 2 + 0.5, on ? '#ffffff' : done ? '#ffd860' : '#9a90b0', 6);
  });
  { const T = mbookTabs(), end = T[T.length - 1].x + T[T.length - 1].w; if (end < VW - 82) text('Q / E: filter', VW - 30, 52.5, '#6a6080', 5.5, 'right'); }   // (only while the tabs leave room: arcanabook.js adds one)
  if (F.weekly) { drawMbookWeekly(pr, now); text('Q / E: other tabs · 9 or Esc close', VW / 2, VH - 22, '#9a917c', 6.5); return; }
  if (F.record) {
    drawMbookRecord(pr, now);
    if (m.snap) { m.snap = false; mbookSaveRecord(pr); }   // (S: after the page is drawn, before the footer)
    text('S: save a picture · Q / E: other tabs · 9 or Esc close', VW / 2, VH - 22, '#9a917c', 6.5); return;
  }
  if (!L.length) { text(F.name === 'MISSING' ? 'Every page is filled. Well hunted!' : 'Nothing here yet', VW / 2, VH / 2, '#9a917c', 9); text('←↑↓→ choose · 9 or Esc close', VW / 2, VH - 22, '#9a917c', 6.5); return; }
  const s0 = mbookScroll(m), rowsAll = Math.ceil(L.length / MBOOK.cols);
  if (rowsAll > MBOOK.rows) { const th = R.gh * MBOOK.rows / rowsAll, ty = R.y + R.gh * s0 / rowsAll; ctx.fillStyle = '#302014'; ctx.fillRect(R.x + R.gw + 2, R.y, 3, R.gh); ctx.fillStyle = '#c8a8ff'; ctx.fillRect(R.x + R.gw + 2, ty, 3, th); }
  const best = mbookBest(pr), feat = mbookFeatured(pr);
  L.forEach((sp, i) => {
    const row = Math.floor(i / MBOOK.cols) - s0; if (row < 0 || row >= MBOOK.rows) return;
    const x = R.x + (i % MBOOK.cols) * C.w, y = R.y + row * C.h, sel = i === m.cur, have = !!B[sp];
    ctx.fillStyle = have ? '#3a2618' : '#0c0812'; rrect(ctx, x, y, C.w - 2, C.h - 2, 4); ctx.fill();
    ctx.strokeStyle = sel ? '#ffd860' : have ? '#4a3a6a' : '#302014'; ctx.lineWidth = sel ? 1.6 : 1; rrect(ctx, x + 0.5, y + 0.5, C.w - 3, C.h - 3, 4); ctx.stroke();
    if (have) { ctx.save(); ctx.beginPath(); rrect(ctx, x + 1, y + 1, C.w - 4, C.h - 4, 3); ctx.clip(); monsterPreview(sp, x + 3, y + 2, C.w - 8, C.h - 8, 2, 0, 'idle', 4); ctx.restore(); text(`${B[sp]}`, x + C.w - 6, y + C.h - 8, '#ffe08a', 5.5, 'right'); }
    else { ctx.save(); ctx.beginPath(); rrect(ctx, x + 1, y + 1, C.w - 4, C.h - 4, 3); ctx.clip(); ctx.filter = 'brightness(0) invert(0.32)'; ctx.globalAlpha = 0.6; monsterPreview(sp, x + 3, y + 2, C.w - 8, C.h - 8, 2, 0, 'idle', 4); ctx.restore(); }   // (a silhouette: its shape, not its look)
    if (best[sp] != null) {   // you hold its card: a tiny card in the corner, in its best rank's colour
      const rc = rankColor(best[sp], now), bx = x + 3, by = y + 3;
      ctx.fillStyle = '#0c0812'; rrect(ctx, bx - 0.5, by - 0.5, 8, 10, 1.5); ctx.fill();
      ctx.fillStyle = rc === 'rainbow' ? `hsl(${(now / 8) % 360},90%,65%)` : rc; rrect(ctx, bx, by, 7, 9, 1.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(bx + 1.2, by + 1.2, 4.6, 1);
    }
    if (sp === feat) {   // the Monster of the Day: an orange diamond in the top-right corner
      const dx = x + C.w - 8, dy = y + 6; ctx.fillStyle = MBOOK_DAY.col; ctx.beginPath(); ctx.moveTo(dx, dy - 3.5); ctx.lineTo(dx + 3.5, dy); ctx.lineTo(dx, dy + 3.5); ctx.lineTo(dx - 3.5, dy); ctx.closePath(); ctx.fill();
    }
  });
  // the chosen page
  const sp = L[m.cur], S = SPECIES[sp], have = !!B[sp], px = R.x + R.gw + 14, pw = VW - 26 - px - 8, py = R.y;
  ctx.fillStyle = '#281a11'; rrect(ctx, px, py, pw, VH - py - 30, 6); ctx.fill();
  if (have) {
    monsterPreview(sp, px + 10, py + 6, pw - 20, 96, 4, 0, 'idle', 8);
    const bt = mbookBest(pr)[sp], best = bt == null ? -1 : bt;   // (bag and storage, as the grid's badge)
    const cap = e => e[0].toUpperCase() + e.slice(1), wk = S.spell && typeof ELEM_WEAK !== 'undefined' && ELEM_WEAK.of[S.spell.el];   // (elemweak.js)
    const el = S.spell && S.spell.el ? cap(S.spell.el) + (typeof ELEM_WEAK !== 'undefined' && ELEM_WEAK.resist ? ' (resists)' : '') + (wk ? ` · weak to ${cap(wk)}` : '') : '—';   // (it resists its own element: elemweak.js)
    text(S.name, px + pw / 2, py + 112, '#ffe8b0', 9);
    {   // mastery: stars, the bonus, the next goal
      const st = mbookStars(pr, sp), nx = MBOOK_MASTERY[st];
      const line = `${st ? '★'.repeat(st) + ` +${Math.round((MBOOK_MASTERY[st - 1].mul - 1) * 100)}% dmg` : 'No mastery yet'}${nx ? ` · next at ${nx.n} kills` : ' · mastered'}`;
      text(line, px + pw / 2, py + 121, st ? '#ffd860' : '#7a7090', 5.5);
    }
    [['Defeated', `${B[sp]}`], ['Best card', best >= 0 ? RANKS[best] : 'none yet'], ['Element', el], ['Spell', S.spell ? S.spell.n : '—']].forEach(([a, b], i) => {
      text(a, px + 12, py + 135 + i * 13, '#9a917c', 7, 'left'); text(b, px + pw - 12, py + 135 + i * 13, '#e8e2cf', 7, 'right');
    });
    mbookWhere(sp, px, pw, py + 192, (pr.bookAt || {})[sp]);
  } else {
    ctx.save(); ctx.filter = 'brightness(0) invert(0.32)'; ctx.globalAlpha = 0.7; monsterPreview(sp, px + 10, py + 6, pw - 20, 96, 4, 0, 'idle', 8); ctx.restore();
    text('Not met yet', px + pw / 2, py + 112, '#9a917c', 8); text('Defeat one to fill this page', px + pw / 2, py + 128, '#6a6080', 6.5);
    mbookWhere(sp, px, pw, py + 150, null);
  }
  if (sp === mbookFeatured(pr)) text('◆ MONSTER OF THE DAY · card drops ×2', px + pw / 2, py + 8, MBOOK_DAY.col, 6);
  const hunting = pr.hunt === sp;   // the hunt line at the foot of the page
  ctx.fillStyle = hunting ? 'rgba(255,216,96,0.18)' : 'rgba(255,255,255,0.05)'; rrect(ctx, px + 8, py + 244, pw - 16, 16, 4); ctx.fill();
  text(hunting ? '★ HUNTING · Enter to stop' : 'Enter: hunt this one', px + pw / 2, py + 252, hunting ? '#ffd860' : '#9a917c', 6.5);
  text('←↑↓→ choose · Enter hunt · C card · 9 or Esc close', VW / 2, VH - 22, '#9a917c', 6.5);
  if (m.card) {   // your card, full size
    const c = m.card, w = 190, h = Math.round(w * 330 / 240), x = VW / 2 - w / 2, y = 34;
    ctx.fillStyle = 'rgba(6,4,14,0.82)'; ctx.fillRect(0, 0, VW, VH);
    drawCardFront(c, x, y, w, h, now);
    text(`${RANKS[c.tier]} · ${typeof cardName === 'function' ? cardName(c) : SPECIES[c.sp].name}`, VW / 2, y + h + 12, '#ffe8b0', 8);
    text('any key or click to put it away', VW / 2, y + h + 24, '#9a917c', 6);
  }
}
// where to hunt it: its zone (if it lives on the road), and where you first beat it
function mbookWhere(sp, px, pw, y, at) {
  const z = MBOOK_ZONE[sp];
  text('Lives in', px + 12, y, '#9a917c', 7, 'left');
  const also = ZONES.filter((Z, i) => i !== z && [...(Z.mobs || []), ...(Z.mobs2 || [])].includes(sp)).map(Z => Z.name.split(' ')[0]);   // (other zones it roams too)
  text(z != null ? ZONES[z].name + (also.length ? ` · also ${also.join(', ')}` : '') : 'Off the road: black holes, rifts, the tower…', px + pw / 2, y + 12, z != null ? '#9fe8a8' : '#b8b0c8', z != null ? 7 : 6, 'center');
  if (at) { text('First beaten at', px + 12, y + 30, '#9a917c', 7, 'left'); text(at, px + pw / 2, y + 42, '#e8e2cf', 6, 'center'); }
}
// TITLES for a fuller book (titles.js awards them in the world, as with every title; a co-op friend earns their own)
const MBOOK_TITLES = [
  { id: 'naturalist', name: 'Naturalist', tier: 1, need: 25, pas: ['regen', 'mana'] },
  { id: 'monsterscholar', name: 'Monster Scholar', tier: 3, need: 100, pas: ['crit', 'mana', 'barrier'] },
  { id: 'grandbestiarist', name: 'Grand Bestiarist', tier: 4, need: 250, pas: ['crit', 'brutal', 'regen', 'barrier'] },
];
for (const B of MBOOK_TITLES) {
  const t = { id: B.id, name: B.name, tier: B.tier, how: `Fill ${B.need} pages of the Monster Book`, prog: pr => [Object.keys(pr.book || {}).length, B.need] };
  TITLE_LIST.push(t); TITLE_BY[B.id] = t; TITLE_PASSIVES[B.id] = B.pas;
}
// NEW FOR YOUR BOOK: a monster whose page is still empty wears a small purple sparkle at the end of its health bar, and the first time
// one of each kind comes near on screen you hear about it once ("New for your Monster Book: X"). A co-op friend's copy carries
// its species too, so it works for them on their own book.
const MBOOK_NEW = { near: 200, col: '#c8a8ff', told: new Set(), gap: 15000, last: 0 };   // (gap: at most one alert this often, so a new hero with an empty book isn't buried in them; the tags still show)
{
  const dn = drawNameplate;
  drawNameplate = (a, y, now) => {
    const r = dn(a, y, now);
    const G = window.GAME, pr = G && G.profile;
    if (!pr || a.ally || a.dead || a.kind !== 'monster' || !a.sp || !SPECIES[a.sp] || (pr.book && pr.book[a.sp])) return r;
    const B = a.plateBox; if (!B) return r;   // (the plate's own box, world.js drawNameplate)
    ctx.save();
    const h = B.h, x = B.x + B.w + 1, top = B.top;
    const cx = B.x + B.w + 3, cy = top + h / 2;   // a small purple sparkle just past the bar's end
    ctx.fillStyle = '#2a1c12'; ctx.fillRect(cx - 2, cy - 1, 5, 3); ctx.fillRect(cx - 1, cy - 2, 3, 5);
    ctx.fillStyle = MBOOK_NEW.col; ctx.fillRect(cx - 1, cy, 3, 1); ctx.fillRect(cx, cy - 1, 1, 3);
    ctx.restore();
    const p = G.world && G.world.player;
    if (p && !MBOOK_NEW.told.has(a.sp) && performance.now() - MBOOK_NEW.last > MBOOK_NEW.gap && Math.hypot(a.x - p.x, a.y - p.y) < MBOOK_NEW.near) { MBOOK_NEW.told.add(a.sp); MBOOK_NEW.last = performance.now(); G.toast(`New for your Monster Book: ${SPECIES[a.sp].name}`, MBOOK_NEW.col); }
    return r;
  };
}
// HUNT TARGET (Enter on a page): that monster shows as a gold star on the radar (radar.js), you're told the first time each one
// comes near, and beating one says so with the best card of it you hold. pr.hunt = species.
const MBOOK_HUNT = { near: 300, col: '#ffd860', gap: 30000, last: 0 };   // (gap: at most one "near" alert this often for your target, however many of it are about)
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => {
    const r = dw(world, cam, bg, now);
    const G = window.GAME, pr = G && G.profile, p = world && world.player; if (!pr || !pr.hunt || !p || G.world !== world || G.menu) return r;
    for (const a of world.actors) if (a.kind === 'monster' && !a.dead && !a.ally && a.sp === pr.hunt && performance.now() - MBOOK_HUNT.last > MBOOK_HUNT.gap && Math.hypot(a.x - p.x, a.y - p.y) < MBOOK_HUNT.near) {
      MBOOK_HUNT.last = performance.now(); G.toast(`★ Your target is near: ${SPECIES[a.sp].name}`, MBOOK_HUNT.col); break;
    }
    // the nearest one out of sight (within 640 px): a gold ★ arrow, further in than the elite arrow (foeelite.js) and the story's
    let best = null, bd = 640; const Z = world.zoom || ZOOM;
    for (const a of world.actors) {
      if (a.kind !== 'monster' || a.dead || a.ally || a.sp !== pr.hunt || !world.cam) continue;
      const sx = (a.x - world.cam.x) * Z, sy = (a.y - world.cam.y) * Z, d = Math.hypot(a.x - p.x, a.y - p.y);
      if (sx > 20 && sx < VW - 20 && sy > 30 && sy < VH - 60) continue;
      if (d < bd) { bd = d; best = { sx, sy }; }
    }
    if (best) {
      resetView(); const cx = VW / 2, cy = VH / 2, an = Math.atan2(best.sy - cy, best.sx - cx), m = 96;
      const k = Math.min((VW / 2 - m) / Math.abs(Math.cos(an) || 1e-6), (VH / 2 - 60) / Math.abs(Math.sin(an) || 1e-6));
      const ax = cx + Math.cos(an) * k, ay = Math.max(m, Math.min(VH - 74, cy + Math.sin(an) * k));
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 170);
      ctx.fillStyle = MBOOK_HUNT.col; ctx.strokeStyle = '#3a2404'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      text(`★ ${Math.round(bd / T)}`, ax - Math.cos(an) * 16, ay - Math.sin(an) * 12, MBOOK_HUNT.col, 6);
    }
    return r;
  };
}
{
  const mk = mbookKill;
  mbookKill = (game, sp, where) => {
    const r = mk(game, sp, where), pr = game.profile;
    if (pr && pr.hunt && sp === pr.hunt) { const b = mbookBest(pr)[sp]; game.toast(`★ Target down: ${SPECIES[sp].name} · best card ${b == null ? 'none yet' : RANKS[b]}`, MBOOK_HUNT.col); }
    return r;
  };
}
// MONSTER OF THE DAY: each real day one monster from the zones your story has reached is featured, and its card drops twice
// as often (an extra roll at the usual chance on each kill). You're told the first time you're in the Wilds that day; its
// Monster Book cell wears an orange diamond and its page says so.
const MBOOK_DAY = { col: '#ffa040' };
function mbookFeatured(pr) {
  if (!pr || typeof dayNo !== 'function') return null;
  const zmax = mbookZoneMax(pr), pool = mbookList().filter(sp => MBOOK_ZONE[sp] != null && MBOOK_ZONE[sp] <= zmax);
  if (!pool.length) return null;
  const r = rng(dayNo() * 131 + 7); return pool[Math.floor(r() * pool.length)];
}
{
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => {
    const r = ok(game, w, m);
    if (m && !m.ally && !m.mimic && m.sp && m.sp === mbookFeatured(game.profile) && Math.random() < CARD_DROP(m.tier || 0) * (isBossKill(m) ? 1 : DROP_MUL) * nightMul(NIGHT.drops))   // (the same chance as its first roll: world.js onMonsterKill)
      w.drops.push({ kind: 'card', item: makeCard(m.sp, dropRank(m.tier || 0)), x: m.x + rand(-6, 6), y: m.y + rand(-4, 4) });   // (its second chance)
    return r;
  };
}
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => {
    const r = dw(world, cam, bg, now);
    const G = window.GAME, pr = G && G.profile, p = world && world.player;
    if (pr && p && G.world === world && world.overworld && !G.menu && pr.motd !== dayNo() && (regionAt(p.x) || {}).zone >= 0) {
      const sp = mbookFeatured(pr); pr.motd = dayNo();
      if (sp) G.toast(`☆ Monster of the Day: ${SPECIES[sp].name} (${ZONES[MBOOK_ZONE[sp]].name}): its card drops twice as often today`, MBOOK_DAY.col);
    }
    return r;
  };
}
// your best copy of a monster's card (bag or storage), for the book's card view
function mbookBestCard(pr, sp) {
  let best = null; if (!pr) return null;
  for (const c of [...(pr.cards || []), ...((pr.storage && pr.storage.cards) || [])]) if (c && c.sp === sp && !c.fusion && (!best || c.tier > best.tier)) best = c;
  return best;
}
// MASTERY: beat the same monster often and you learn it. Stars at 10, 50 and 200 kills of a species, each adding damage against
// it (3%, 6%, 10%); the page shows the stars and the next goal, and a toast marks each new star. The bonus is on your own
// hero's hits (a co-op friend's mastery lives on their own save, so the host can't apply it).
const MBOOK_MASTERY = [{ n: 10, mul: 1.03 }, { n: 50, mul: 1.06 }, { n: 200, mul: 1.10 }];
const mbookStars = (pr, sp) => { const k = (pr && pr.book && pr.book[sp]) || 0; return MBOOK_MASTERY.filter(M => k >= M.n).length; };
{
  const mk = mbookKill;
  mbookKill = (game, sp, where) => {
    const pr = game.profile, s0 = mbookStars(pr, sp), r = mk(game, sp, where), s1 = mbookStars(pr, sp);
    if (s1 > s0 && SPECIES[sp]) game.toast(`MASTERY ${'★'.repeat(s1)} ${SPECIES[sp].name}: +${Math.round((MBOOK_MASTERY[s1 - 1].mul - 1) * 100)}% damage to them`, '#ffd860');
    return r;
  };
}
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const G = window.GAME;
    if (att && def && def.sp && opts && opts.base && G && G.world === world && att === world.player && !def.ally) {
      const s = mbookStars(G.profile, def.sp); if (s) opts = { ...opts, base: opts.base * MBOOK_MASTERY[s - 1].mul };
    }
    return dd(world, att, def, opts);
  };
}
// RECORD (the last tab): your hunter's record at a glance
function drawMbookRecord(pr, now) {
  const B = pr.book || {}, all = mbookList(), best = mbookBest(pr), x = 40, y = 70, W = VW - 80;
  const pages = all.filter(sp => B[sp]).length, kills = Object.values(B).reduce((a, n) => a + n, 0);
  const zones = ZONES.filter((Z, z) => pr.bookZones && pr.bookZones[z]).length, stars = all.reduce((a, sp) => a + mbookStars(pr, sp), 0);
  const carded = all.filter(sp => best[sp] != null).length, top = Object.entries(B).sort((a, b) => b[1] - a[1])[0];
  let rare = null; for (const sp in best) if (!rare || best[sp] > best[rare]) rare = sp;
  const feat = mbookFeatured(pr);
  ctx.fillStyle = '#281a11'; rrect(ctx, x, y - 6, W, 252, 8); ctx.fill();
  const rows = [
    ['Monsters defeated', `${kills}`],
    ['Pages filled', `${pages} / ${all.length}  (${Math.round(pages / all.length * 100)}%)`],
    ['Zones completed', `${zones} / ${ZONES.length}`],
    ['Mastery stars', `${stars} ★`],
    ['Species with a card', `${carded} / ${all.length}`],
    ['Rarest card', rare ? `${RANKS[best[rare]]} · ${SPECIES[rare].name}` : 'none yet'],
    ['Most hunted', top ? `${SPECIES[top[0]] ? SPECIES[top[0]].name : top[0]} · ${top[1]}` : 'nobody yet'],
    ['Hunting', pr.hunt && SPECIES[pr.hunt] ? `★ ${SPECIES[pr.hunt].name}` : 'nothing (Enter on a page)'],
    ['Monster of the Day', feat ? `◆ ${SPECIES[feat].name}` : '—'],
  ];
  rows.forEach(([a, b], i) => {
    const ry = y + 12 + i * 26;
    if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x + 8, ry - 10, W - 16, 22); }
    text(a, x + 22, ry, '#9a917c', 8, 'left'); text(b, x + W - 22, ry, i === 7 ? '#ffd860' : i === 8 ? '#ffa040' : '#e8e2cf', 8, 'right');
  });
  // a bar of the book's progress
  const bx = x + 22, bw = W - 44, by = y + 238; ctx.fillStyle = '#0c0812'; rrect(ctx, bx, by, bw, 6, 3); ctx.fill();
  ctx.fillStyle = '#c8a8ff'; rrect(ctx, bx, by, Math.max(4, bw * pages / all.length), 6, 3); ctx.fill();
}
// RECORD ▸ S: the page as a picture, saved by the browser (zenonia-record-<name>-<date>.png), to show a friend
function mbookSaveRecord(pr) {
  try {
    const name = ((pr.look && pr.look.name) || 'hero').replace(/[^\w-]+/g, '_'), day = new Date().toISOString().slice(0, 10);
    cv.toBlob(b => {
      if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `zenonia-record-${name}-${day}.png`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      if (window.GAME) GAME.toast('Record picture saved (look in your Downloads)', '#c8a8ff');
    }, 'image/png');
  } catch (e) { if (window.GAME) GAME.toast("Couldn't save the picture here", '#ff8a8a'); }
}
// WEEKLY HUNT (the WEEKLY tab): five monsters from the zones your story has reached, the same all week (a new list each Monday).
// Beat each one 5 times. Each finished pays 3 coins and 300 G; all five pay 20 coins, 2,000 G and a card of one of them at its
// zone's top rank. A co-op friend's kills count on their own list. pr.wk = { week, list: [{ sp, have }], paid }.
const MBOOK_WEEK = { n: 5, need: 5, one: { coins: 3, gold: 300 }, all: { coins: 20, gold: 2000 }, col: '#9fe8a8' };
function mbookWeek(pr) {
  if (!pr || typeof weekNo !== 'function') return null;
  const wk = weekNo();
  if (!pr.wk || pr.wk.week !== wk) {
    const zmax = mbookZoneMax(pr), pool = mbookList().filter(sp => MBOOK_ZONE[sp] != null && MBOOK_ZONE[sp] <= zmax);
    const r = rng(wk * 977 + 31), pick = [];
    while (pick.length < Math.min(MBOOK_WEEK.n, pool.length)) { const sp = pool[Math.floor(r() * pool.length)]; if (!pick.includes(sp)) pick.push(sp); }
    pr.wk = { week: wk, list: pick.map(sp => ({ sp, have: 0 })), paid: false };
  }
  return pr.wk;
}
{
  const mk = mbookKill;
  mbookKill = (game, sp, where) => {
    const r = mk(game, sp, where), pr = game.profile, W = mbookWeek(pr); if (!W) return r;
    const e = W.list.find(x => x.sp === sp && x.have < MBOOK_WEEK.need); if (!e) return r;
    e.have++;
    if (e.have >= MBOOK_WEEK.need) {
      pr.coins = (pr.coins || 0) + MBOOK_WEEK.one.coins; pr.gold = (pr.gold || 0) + MBOOK_WEEK.one.gold;
      const left = W.list.filter(x => x.have < MBOOK_WEEK.need).length;
      game.toast(`Weekly hunt: ${SPECIES[sp].name} done (+${MBOOK_WEEK.one.coins} coins, +${MBOOK_WEEK.one.gold} G) · ${left ? left + ' to go' : 'all five!'}`, MBOOK_WEEK.col);
      if (!left && !W.paid) {
        W.paid = true; const top = W.list[Math.floor(Math.random() * W.list.length)].sp, z = MBOOK_ZONE[top] || 0;
        pr.coins += MBOOK_WEEK.all.coins; pr.gold += MBOOK_WEEK.all.gold; game.pickup({ kind: 'card', item: makeCard(top, ZONES[z].ranks[1]) });
        game.toast(`WEEKLY HUNT COMPLETE! +${MBOOK_WEEK.all.coins} coins, +${MBOOK_WEEK.all.gold} G and a ${SPECIES[top].name} card`, '#ffd860');
      }
    }
    return r;
  };
}
function drawMbookWeekly(pr, now) {
  const W = mbookWeek(pr), x = 40, y = 70, wd = VW - 80; if (!W) return;
  ctx.fillStyle = '#281a11'; rrect(ctx, x, y - 6, wd, 252, 8); ctx.fill();
  const days = 7 - ((dayNo() + 3) % 7);
  text(`This week's hunt · beat each ${MBOOK_WEEK.need} times · a new list in ${days} day${days > 1 ? 's' : ''}`, VW / 2, y + 6, '#c8bfa8', 7);
  W.list.forEach((e, i) => {
    const ry = y + 22 + i * 38, S = SPECIES[e.sp], done = e.have >= MBOOK_WEEK.need, z = MBOOK_ZONE[e.sp];
    ctx.fillStyle = done ? 'rgba(159,232,168,0.10)' : 'rgba(255,255,255,0.03)'; rrect(ctx, x + 10, ry, wd - 20, 34, 5); ctx.fill();
    ctx.save(); ctx.beginPath(); rrect(ctx, x + 14, ry + 2, 34, 30, 4); ctx.clip();
    if (!(pr.book && pr.book[e.sp])) { ctx.filter = 'brightness(0) invert(0.32)'; ctx.globalAlpha = 0.7; }
    monsterPreview(e.sp, x + 15, ry + 3, 32, 28, 2, 0, 'idle', 4); ctx.restore();
    text(S.name, x + 56, ry + 11, done ? MBOOK_WEEK.col : '#ffe8b0', 8, 'left');
    text(z != null ? ZONES[z].name : 'off the road', x + 56, ry + 23, '#9a917c', 6, 'left');
    const bx = x + wd - 190, bw = 120; ctx.fillStyle = '#0c0812'; rrect(ctx, bx, ry + 13, bw, 8, 4); ctx.fill();
    ctx.fillStyle = done ? MBOOK_WEEK.col : '#c8a8ff'; rrect(ctx, bx, ry + 13, Math.max(6, bw * Math.min(1, e.have / MBOOK_WEEK.need)), 8, 4); ctx.fill();
    text(done ? '✓ done' : `${e.have} / ${MBOOK_WEEK.need}`, x + wd - 24, ry + 17, done ? MBOOK_WEEK.col : '#e8e2cf', 7, 'right');
  });
  text(W.paid ? '★ All five done this week. Well hunted!' : `All five: +${MBOOK_WEEK.all.coins} coins, +${MBOOK_WEEK.all.gold} G and a top-rank card`, VW / 2, y + 236, W.paid ? '#ffd860' : '#9a917c', 6.5);
}
