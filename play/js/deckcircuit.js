'use strict';
// THE MAGIC CIRCUIT: the DECK page of the inventory book, on its two pages like every other tab. Your ten deck cards sit round the hero in a board of neon traces, each wired to the hero by a line in its element's colour that runs with light
// while a card is in the place; an empty place stays dark. Pick a place on the board, then a card on the right to set in it (a card already in the deck swaps places).
// The circle behind the hero can be changed (pr.heroBg, DC_SCENES), and PASSIVES adds up what the ten cards give together.
// m.circuit = { cur: place, list: choosing from the cards?, lc: card cursor, scroll: first row, pass: showing the passives? }.
const DC = { B: { x: PAGE_L.x + 6, y: 86, w: PAGE_L.w - 12, h: 236 }, hub: { x: PAGE_L.x + PAGE_L.w / 2, y: 204, r: 30 }, cw: 32, ch: 44, ring: 78, chain: 39, P: PAGE_R, L: { x: PAGE_R.x + 13, y: 102, cw: 36, ch: 50, gx: 6, gy: 4, cols: 6, rows: 2 }, info: 212 };
// the ten places, clockwise from the top. bend: where the trace turns towards the hero
const DC_SLOTS10 = [[0, -96, 0], [62, -90, 'v'], [104, -38, 'h'], [104, 38, 'h'], [62, 90, 'v'], [0, 96, 0], [-62, 90, 'v'], [-104, 38, 'h'], [-104, -38, 'h'], [-62, -90, 'v']].map(([x, y, bend]) => ({ x: DC.hub.x + x, y: DC.hub.y + y, bend }));
const DC_CORNERS = [[DC.B.x + 12, DC.B.y + 12, '#ff4ad8'], [DC.B.x + DC.B.w - 12, DC.B.y + 12, '#3ad8ff'], [DC.B.x + 12, DC.B.y + DC.B.h - 12, '#ff4ad8'], [DC.B.x + DC.B.w - 12, DC.B.y + DC.B.h - 12, '#4aff8a']];
// A BIGGER DECK (deckplus.js deckMax): with 11-15 places they spread evenly round an oval and the cards shrink a little; with 10 nothing changes
const DC_SLOT_SETS = {};
function dcSlots() {
  const n = typeof deckMax === 'function' ? deckMax(window.GAME && GAME.profile) : 10; if (n <= 10) return DC_SLOTS10;
  if (DC_SLOT_SETS[n]) return DC_SLOT_SETS[n];
  return (DC_SLOT_SETS[n] = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2, x = Math.round(Math.cos(a) * 110), y = Math.round(Math.sin(a) * 96);
    return { x: DC.hub.x + x, y: DC.hub.y + y, bend: Math.abs(x) < 12 ? 0 : Math.abs(x) > Math.abs(y) * 1.1 ? 'h' : 'v' }; }));
}
const dcSize = () => (dcSlots().length > 10 ? { w: 27, h: 37 } : { w: DC.cw, h: DC.ch });
const dcRect = i => { const S = dcSlots()[i], Z = dcSize(); return { x: S.x - Z.w / 2, y: S.y - Z.h / 2, w: Z.w, h: Z.h }; };
const dcCell = i => ({ x: DC.L.x + (i % DC.L.cols) * (DC.L.cw + DC.L.gx), y: DC.L.y + Math.floor(i / DC.L.cols) * (DC.L.ch + DC.L.gy), w: DC.L.cw, h: DC.L.ch });
// (four buttons since 2026-11-20: UNEQUIP ALL joined them, the user: "put a unequip all button")
const dcTakeBtn = () => ({ x: DC.P.x + 12, y: 284, w: 58, h: 20 }), dcAllBtn = () => ({ x: DC.P.x + 74, y: 284, w: 66, h: 20 }), dcPassBtn = () => ({ x: DC.P.x + 144, y: 284, w: 66, h: 20 }), dcCloseBtn = () => ({ x: DC.P.x + 214, y: 284, w: 44, h: 20 });
const dcHubW = pr => Math.max(52, textW(((pr.look && pr.look.name) || 'HERO').toUpperCase(), 7.5) + 16), dcHubBtn = (pr, i) => ({ x: DC.hub.x + (i ? 1 : -1) * (dcHubW(pr) / 2 + 9) - 6, y: DC.hub.y + DC.hub.r - 7, w: 12, h: 13 });
function dcNextScene(game, step) { const pr = game.profile, n = DC_SCENES.length; pr.heroBg = ((pr.heroBg || 0) + step + n) % n; game.toast(`Background: ${DC_SCENES[pr.heroBg].name}`, '#ffe9a8'); game.save(); }
// the ten cards' passives added together, capped as they are in a fight, most cards first
function dcPassives(pr) {
  const count = {}, list = pr.deck.map(u => pr.cards.find(c => c.uid === u)).filter(Boolean).flatMap(cardPassives), sum = sumPassives(list); list.forEach(p => { count[p.id] = (count[p.id] || 0) + 1; });
  return Object.keys(sum).sort((a, b) => count[b] - count[a] || sum[b] / PASSIVES[b].cap - sum[a] / PASSIVES[a].cap).map(id => ({ id, v: sum[id], n: count[id], capped: sum[id] >= PASSIVES[id].cap }));
}
function dcChips(pr) {
  const els = [...new Set(cardStacks(pr).filter(x => !x.c.fusion).map(x => cardElement(x.c)))].sort(), out = [{ id: null, label: 'ALL', w: 22 }, ...els.map(e => ({ id: e, label: EL_GLYPH[e] || '•', w: 18, col: TF_RING[e] }))];
  let x = DC.P.x + 13; for (const c of out) { c.x = x; c.y = 86; c.h = 13; x += c.w + 2; } return out;
}
// the little disc behind the DECK button: a dark plate, a turning ring of the circuit's colours, a gold rim
function dcBadge(cx, cy, r, now) {
  ctx.save(); ctx.fillStyle = '#2a1c12'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d8a850'; ctx.lineWidth = 1; ctx.stroke();
  ['#ff4ad8', '#4ad8ff', '#4aff8a', '#ffd23f'].forEach((c, i) => { const a = now / 1400 + i * Math.PI / 2; ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, r - 2.4, a, a + Math.PI / 2 - 0.25); ctx.stroke(); }); ctx.restore();
}
function circuitOpen(pr, m) { m.circuit = { cur: Math.min(pr.deck.length, deckMax(pr) - 1), list: false, lc: 0, scroll: 0 }; }
// a card into a place: a spare copy goes in; with no spare the one in the deck changes places
function dcPlace(game, m, st) {
  const pr = game.profile, C = m.circuit, D = pr.deck, spare = st.cards.find(x => !D.includes(x.uid)), had = st.cards.find(x => D.includes(x.uid));
  if (spare) { if (C.cur < D.length) { const old = D[C.cur]; D[C.cur] = spare.uid; pr.spells = pr.spells.map(u => u === old ? null : u); } else D.push(spare.uid); }
  else { const a = D.indexOf(had.uid), to = Math.min(C.cur, D.length - 1); D[a] = D[to]; D[to] = had.uid; }
  C.cur = D.length < deckMax(pr) ? D.length : C.cur; game.save();
}
function dcTakeOut(game, m) { const pr = game.profile, u = pr.deck[m.circuit.cur]; if (!u) return; pr.deck = pr.deck.filter(x => x !== u); pr.spells = pr.spells.map(x => x === u ? null : x); game.save(); }
// every card out of the deck (and off Q / E / R) at once: a first press asks, a second does it; U undoes it (deckplus.js)
function dcTakeAll(game, m) {
  const pr = game.profile, C = m.circuit; if (!pr.deck.length) { game.toast('The deck is already empty', '#c9c1a8'); return; }
  if (!(C.allAsk > performance.now())) { C.allAsk = performance.now() + 2500; return; }
  C.allAsk = 0;   // (deckplus.js keeps the undo step itself: it saves the deck before every change made on this page)
  const n = pr.deck.length; pr.deck = []; pr.spells = (pr.spells || []).map(() => null); game.save(); if (game.refreshPlayer) game.refreshPlayer();
  game.toast(`All ${n} cards taken out of the deck (U: undo)`, '#ffd27a');
}
function updateCircuit(game, m) {
  const pr = game.profile, C = m.circuit, list = pickerList(pr, m), n = list.length, L = DC.L, k = navInput();
  C.lc = clamp(C.lc, 0, Math.max(0, n - 1));
  const Pb = dcPassBtn(), Xb = dcCloseBtn(); if (hit('KeyP') || clicked(Pb.x, Pb.y, Pb.w, Pb.h)) { C.pass = !C.pass; return; }
  if (C.pass) { if (k.back || clicked(Xb.x, Xb.y, Xb.w, Xb.h)) C.pass = false; return; }
  for (let i = 0; i < 2; i++) { const B = dcHubBtn(pr, i); if (clicked(B.x, B.y, B.w, B.h)) { dcNextScene(game, i ? 1 : -1); return; } }
  if (hit('KeyB') || (mouse.click && Math.hypot(mouse.x - DC.hub.x, mouse.y - DC.hub.y) < DC.hub.r)) { dcNextScene(game, 1); return; }
  if (C.list) {
    if (k.back) { C.list = false; return; }
    if (k.l) C.lc = Math.max(0, C.lc - 1); if (k.r) C.lc = Math.min(n - 1, C.lc + 1); if (k.u) C.lc = Math.max(0, C.lc - L.cols); if (k.d) C.lc = Math.min(n - 1, C.lc + L.cols);
    const row = Math.floor(C.lc / L.cols); if (row < C.scroll) C.scroll = row; if (row >= C.scroll + L.rows) C.scroll = row - L.rows + 1;
    if (k.ok && list[C.lc]) dcPlace(game, m, list[C.lc]);
  } else {
    if (k.back) { m.circuit = null; return; }
    { const NS = dcSlots().length; if (k.l || k.u) C.cur = (C.cur + NS - 1) % NS; if (k.r || k.d) C.cur = (C.cur + 1) % NS; }
    if (k.ok && n) { C.list = true; return; }
    if (hit('KeyX', 'Delete')) dcTakeOut(game, m);
    const key = hit('KeyQ', 'Digit1') ? 0 : hit('KeyE', 'Digit2') ? 1 : hit('KeyR', 'Digit3') ? 2 : -1; if (key >= 0 && pr.deck[C.cur]) equipSpell(game, pr.deck[C.cur], key);
  }
  if (mouse.wheel) { C.scroll = clamp(C.scroll + Math.sign(mouse.wheel), 0, Math.max(0, Math.ceil(n / L.cols) - L.rows)); mouse.wheel = 0; }
  for (let i = 0; i < dcSlots().length; i++) { const R = dcRect(i); if (clicked(R.x, R.y, R.w, R.h)) { C.cur = i; C.list = true; return; } }
  for (const ch of dcChips(pr)) if (clicked(ch.x, ch.y, ch.w, ch.h)) { m.elFilter = ch.id; C.lc = 0; C.scroll = 0; return; }
  for (let i = 0; i < L.cols * L.rows; i++) { const j = C.scroll * L.cols + i, R = dcCell(i); if (list[j] && clicked(R.x, R.y, R.w, R.h)) { C.lc = j; dcPlace(game, m, list[j]); return; } }
  const T = dcTakeBtn(), X = dcCloseBtn(), Al = dcAllBtn(); if (clicked(T.x, T.y, T.w, T.h)) dcTakeOut(game, m); if (clicked(X.x, X.y, X.w, X.h)) m.circuit = null; if (clicked(Al.x, Al.y, Al.w, Al.h)) dcTakeAll(game, m);
}
// a neon trace: a wide soft glow, the colour, a white core
function dcTrace(g, pts, col, w = 1.6) {
  g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.strokeStyle = hexA(col, 0.22); g.lineWidth = w * 3.4; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = w * 0.35; g.stroke();
}
// A LIT TRACE AS A MAGIC CIRCUIT (2026-11-20, the user: "thinner lines like Fate/stay anime"; the rails, pads and chips tried before it
// were too heavy): a hair-thin line of light with a soft glow, fine veins branching off it at right angles, and streaks of light
// flowing along it to the hero
function dcVein(g, pts, col, now, i) {
  const line = (w, style) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'miter'; g.globalCompositeOperation = 'lighter';
  line(3.2, hexA(col, 0.14)); line(0.9, hexA(col, 0.9)); line(0.35, 'rgba(255,255,255,0.85)');
  // the fine veins: short right-angled branches off each stretch, alternating sides, the same every frame
  const r = seededRng(1000 + i * 37); g.lineWidth = 0.45; g.strokeStyle = hexA(col, 0.55);
  for (let j = 0; j + 1 < pts.length; j++) {
    const [ax, ay] = pts[j], [bx, by] = pts[j + 1], d = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / (d || 1), uy = (by - ay) / (d || 1);
    for (let t = 8, side = r() < 0.5 ? 1 : -1; t < d - 6; t += 9 + r() * 7, side = -side) {
      const x = ax + ux * t, y = ay + uy * t, out = 2.5 + r() * 3, run = 3 + r() * 5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - uy * side * out, y + ux * side * out); g.lineTo(x - uy * side * out + ux * run, y + ux * side * out + uy * run); g.stroke();
      g.fillStyle = hexA(col, 0.8); g.fillRect(x - uy * side * out + ux * run - 0.5, y + ux * side * out + uy * run - 0.5, 1, 1);
    }
  }
  // the light running through it: two soft streaks from the card to the hero
  const seg = pts.slice(1).map((q, j) => Math.hypot(q[0] - pts[j][0], q[1] - pts[j][1])), total = seg.reduce((a, b) => a + b, 0);
  const at = dd => { let t = Math.max(0, Math.min(total, dd)), j = 0; while (j < seg.length - 1 && t > seg[j]) t -= seg[j++]; const k = t / (seg[j] || 1); return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * k, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * k]; };
  for (let b = 0; b < 2; b++) {
    const head = ((now / 1500 + b / 2 + i * 0.13) % 1) * (total + 14);
    for (let k = 0; k < 7; k++) { const [x, y] = at(head - k * 2), a = (1 - k / 7); g.fillStyle = k ? hexA(col, 0.5 * a) : 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(x, y, k ? 1.3 * a + 0.3 : 1, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}
// the trace of place i, from the card to the hero's rim
function dcPath(i) {
  const S = dcSlots()[i], H = DC.hub, a = Math.atan2(S.y - H.y, S.x - H.x), e = [H.x + Math.cos(a) * (H.r + 4), H.y + Math.sin(a) * (H.r + 4)];
  if (!S.bend) return [[S.x, S.y], e];
  const dy = Math.abs(S.y - H.y), dx = Math.abs(S.x - H.x), sx = Math.sign(S.x - H.x), sy = Math.sign(S.y - H.y);
  return [[S.x, S.y], S.bend === 'h' ? [H.x + sx * (dy + H.r * 0.8), S.y] : [S.x, H.y + sy * (dx + H.r * 0.3)], e];
}
// THE SCENES behind the hero, painted once at a low size so they come up as chunky pixels. dcBand: stripes of sky, top to bottom
const dcBand = (g, cols, s, y0 = 0) => cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, y0 + Math.floor(i * s / cols.length), 56, Math.ceil(s / cols.length) + 1); });
const dcPeak = (g, x, base, w, h, col, cap) => { g.fillStyle = col; for (let i = 0; i < h; i++) { const hw = Math.ceil(w * (h - i) / h); g.fillRect(x - hw, base - i, hw * 2, 1); } if (cap) { g.fillStyle = cap; for (let i = Math.floor(h * 0.68); i < h; i++) { const hw = Math.ceil(w * (h - i) / h); g.fillRect(x - hw, base - i, hw * 2, 1); } } };
const dcCloud = (g, x, y, w) => { g.fillStyle = '#ffffff'; g.fillRect(x, y, w, 3); g.fillRect(x + 2, y - 2, w - 5, 2); g.fillStyle = '#d8ecff'; g.fillRect(x + 1, y + 3, w - 2, 1); };
const dcStars = (g, s, n, seed, col = '#ffffff') => { const r = seededRng(seed); g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(Math.floor(r() * s), Math.floor(r() * s * 0.7), 1, 1); };
const dcPine = (g, x, base, h, col) => { g.fillStyle = '#4a2c14'; g.fillRect(x, base - 2, 1, 2); g.fillStyle = col; for (let i = 0; i < h; i++) { const hw = Math.ceil((h - i) / 2); g.fillRect(x - hw + 1, base - 2 - i, hw * 2 - 1, 1); } };
const DC_SCENES = [
  { name: 'Arcane', draw(g, s) { dcBand(g, ['#281a11', '#4e3321', '#3a1a78', '#6a2ca8', '#a84ae0', '#6a2ca8', '#3a1a78', '#4e3321', '#281a11'], s); dcStars(g, s, 26, 5, '#e0c8ff'); } },
  { name: 'Sky', draw(g, s) { dcBand(g, ['#2a78e0', '#3a8cf0', '#54a4f8', '#74bcff', '#98d0ff', '#bce2ff'], s); dcCloud(g, 6, 14, 18); dcCloud(g, 32, 24, 16); dcCloud(g, 12, 40, 20); dcCloud(g, 38, 46, 14); } },
  { name: 'Mountain', draw(g, s) { dcBand(g, ['#4a9ae8', '#6ab0f0', '#8cc8f8', '#b0dcff', '#d0ecff'], s); dcCloud(g, 34, 10, 14); dcPeak(g, 40, 46, 20, 30, '#8a94a8', '#ffffff'); dcPeak(g, 16, 46, 22, 36, '#6a7488', '#ffffff'); dcPeak(g, 30, 50, 22, 18, '#4a5668', '#d8e4f0'); g.fillStyle = '#4a8a3a'; g.fillRect(0, 48, s, s - 48); g.fillStyle = '#3a6e2e'; g.fillRect(0, 52, s, s - 52); } },
  { name: 'Forest', draw(g, s) { dcBand(g, ['#8cd0f0', '#b0e0f0', '#d8f0e0'], s); g.fillStyle = '#58a84a'; g.fillRect(0, 34, s, s - 34); for (let i = 0; i < 9; i++) dcPine(g, i * 7 + 1, 38, 12, '#2e7a3a'); g.fillStyle = '#3e8a3a'; g.fillRect(0, 38, s, s - 38); for (let i = 0; i < 7; i++) dcPine(g, i * 9 + 3, 46, 16, '#1e5e2e'); g.fillStyle = '#2e6e2a'; g.fillRect(0, 46, s, s - 46); } },
  { name: 'Sea', draw(g, s) { dcBand(g, ['#e8603a', '#f08a4a', '#f8b060', '#ffd080'], 31); g.fillStyle = '#ffe8a0'; g.fillRect(20, 22, 16, 9); g.fillRect(23, 19, 10, 3); dcBand(g, ['#2a78b0', '#1e62a0', '#164e88', '#0e3a6e', '#583a25'], s - 31, 31); g.fillStyle = '#ffd080'; for (let i = 0; i < 8; i++) g.fillRect(22 + (i * 7) % 12, 33 + i * 2, 6, 1); g.fillStyle = '#8cc8e8'; for (let i = 0; i < 9; i++) g.fillRect((i * 13) % s, 34 + (i * 5) % 20, 5, 1); } },
  { name: 'Night', draw(g, s) { dcBand(g, ['#20150d', '#302014', '#442d1d', '#18285a'], s); dcStars(g, s, 40, 9); g.fillStyle = '#f0ecc8'; g.fillRect(36, 8, 9, 9); g.fillRect(38, 6, 5, 13); g.fillRect(34, 10, 13, 5); g.fillStyle = '#302014'; g.fillRect(39, 7, 7, 8); dcPeak(g, 14, 50, 22, 18, '#281a11'); dcPeak(g, 42, 50, 22, 14, '#342216'); g.fillStyle = '#20150d'; g.fillRect(0, 50, s, s - 50); } },
  { name: 'Volcano', draw(g, s) { dcBand(g, ['#1a0808', '#3a0e0e', '#6a1a10', '#a03014', '#d85a1e'], s); dcPeak(g, 28, 48, 24, 28, '#2a1a1a'); g.fillStyle = '#ff7a2a'; g.fillRect(25, 20, 7, 2); g.fillRect(27, 22, 3, 14); g.fillStyle = '#ffd23f'; g.fillRect(28, 18, 1, 22); g.fillRect(26, 14, 1, 4); g.fillRect(31, 11, 1, 5); g.fillStyle = '#1a0e0e'; g.fillRect(0, 48, s, s - 48); g.fillStyle = '#ff5a1a'; for (let i = 0; i < 6; i++) g.fillRect((i * 11 + 3) % s, 50 + (i * 3) % 6, 6, 1); } },
  { name: 'Snow', draw(g, s) { dcBand(g, ['#a8c8e0', '#c0d8ec', '#d8e8f4', '#ecf4fa'], s); dcPeak(g, 42, 42, 18, 18, '#d0dcea', '#ffffff'); for (let i = 0; i < 5; i++) dcPine(g, i * 11 + 4, 46, 12, '#3e6a6a'); g.fillStyle = '#ffffff'; g.fillRect(0, 45, s, s - 45); g.fillStyle = '#d8e8f4'; g.fillRect(6, 50, 16, 1); g.fillRect(30, 53, 18, 1); dcStars(g, s, 24, 3); } },
  { name: 'Sunset', draw(g, s) { dcBand(g, ['#3a1a6a', '#7a2a8a', '#c83a7a', '#f06a5a', '#f8a84a', '#ffd86a'], 42); g.fillStyle = '#fff0a0'; g.fillRect(22, 30, 12, 9); g.fillRect(25, 27, 6, 3); g.fillStyle = '#2a1430'; for (let i = 0; i < s; i++) g.fillRect(i, 42 - Math.floor(Math.abs(Math.sin(i / 7)) * 5), 1, 16); g.fillRect(0, 42, s, s - 42); } },
];
const DC_SCENE_C = {};
function dcScene(i) { i = (i || 0) % DC_SCENES.length; if (DC_SCENE_C[i]) return DC_SCENE_C[i]; const s = 56, c = document.createElement('canvas'); c.width = c.height = s; DC_SCENES[i].draw(c.getContext('2d'), s); return (DC_SCENE_C[i] = c); }
// the board that never changes, painted once: the dark page, its rings, chain and corner traces
let DC_BG = null;
function dcBackdrop() {
  if (DC_BG) return DC_BG; const c = document.createElement('canvas'); c.width = VW * RES; c.height = VH * RES; const g = c.getContext('2d'), B = DC.B, H = DC.hub; g.scale(RES, RES);
  const pg = g.createRadialGradient(H.x, H.y, 20, H.x, H.y, 170); pg.addColorStop(0, '#48301e'); pg.addColorStop(1, '#1c120c'); g.fillStyle = pg; g.fillRect(B.x, B.y, B.w, B.h); g.strokeStyle = '#5a6478'; g.lineWidth = 1; g.strokeRect(B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1);
  g.save(); g.beginPath(); g.rect(B.x, B.y, B.w, B.h); g.clip();
  g.fillStyle = 'rgba(160,190,255,0.5)'; const r = seededRng(77); for (let i = 0; i < 60; i++) g.fillRect(B.x + r() * B.w, B.y + r() * B.h, r() < 0.2 ? 1.5 : 0.8, r() < 0.2 ? 1.5 : 0.8);
  // the rainbow ring and its faint echo
  const rc = g.createConicGradient(-Math.PI / 2, H.x, H.y); ['#ff4a8a', '#ffb04a', '#ffe84a', '#4aff8a', '#4ad8ff', '#8a6aff', '#ff4ad8', '#ff4a8a'].forEach((q, i) => rc.addColorStop(i / 7, q));
  g.strokeStyle = rc; g.globalAlpha = 0.2; g.lineWidth = 7; g.beginPath(); g.arc(H.x, H.y, DC.ring, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.85; g.lineWidth = 1.6; g.stroke(); g.globalAlpha = 0.3; g.lineWidth = 1; g.beginPath(); g.arc(H.x, H.y, DC.ring + 9, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
  // the corners: a lit node with its traces running out along the edges
  for (const [x, y, col] of DC_CORNERS) {
    const sx = x < H.x ? 1 : -1, sy = y < H.y ? 1 : -1;
    [[[x + sx * 8, y], [x + sx * 30, y], [x + sx * 36, y + sy * 6]], [[x, y + sy * 8], [x, y + sy * 30], [x + sx * 6, y + sy * 36]], [[x + sx * 7, y + sy * 7], [x + sx * 18, y + sy * 18], [x + sx * 18, y + sy * 26]]].forEach(p => { dcTrace(g, p, col, 0.9); const [ex, ey] = p[p.length - 1]; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex, ey, 1.3, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = hexA(col, 0.25); g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
  }
  // the gold chain round the hero
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, x = H.x + Math.cos(a) * DC.chain, y = H.y + Math.sin(a) * DC.chain; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2 + (i % 2 ? 0 : Math.PI / 2)); g.fillStyle = 'rgba(40,20,4,0.8)'; g.fillRect(-2.2, -1.4, 4.4, 2.8); g.strokeStyle = i % 2 ? '#ffd860' : '#c88a2a'; g.lineWidth = 0.9; g.strokeRect(-1.9, -1.1, 3.8, 2.2); g.restore(); }
  g.restore();
  return (DC_BG = c);
}
// DEPTH, drawn live over the painted backdrop (so it moves): the board darkens toward its edges, two rune rings turn
// against each other behind the rainbow ring, a six-point star turns slowly inside it, a band of light runs round the
// ring, motes drift up through it all, and the hero's medallion glows from behind
const DC_RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
function dcDepth(now) {
  const B = DC.B, H = DC.hub;
  ctx.save(); ctx.beginPath(); ctx.rect(B.x + 1, B.y + 1, B.w - 2, B.h - 2); ctx.clip();
  const vg = ctx.createRadialGradient(H.x, H.y, 60, H.x, H.y, 175); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,3,10,0.6)'); ctx.fillStyle = vg; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.globalCompositeOperation = 'lighter';
  const back = ctx.createRadialGradient(H.x, H.y, 10, H.x, H.y, DC.ring + 26); back.addColorStop(0, `rgba(120,90,255,${0.16 + 0.05 * Math.sin(now / 900)})`); back.addColorStop(0.7, 'rgba(60,140,255,0.06)'); back.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = back; ctx.fillRect(B.x, B.y, B.w, B.h);
  for (const [r, sp, n, col, al] of [[DC.ring + 18, 1, 24, '150,190,255', 0.32], [DC.ring - 16, -1.6, 16, '255,200,120', 0.26]]) {   // the rune rings
    ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(now / 14000 * sp);
    ctx.strokeStyle = `rgba(${col},${al * 0.6})`; ctx.lineWidth = 0.6; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // (the rune letters round these rings were taken off, 2026-11-13, the user's wish; the turning dashed rings stay)
    ctx.restore();
  }
  ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(-now / 20000);   // the star: two triangles
  ctx.strokeStyle = 'rgba(190,170,255,0.22)'; ctx.lineWidth = 0.9;
  for (const o of [0, Math.PI]) { ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = o + k * Math.PI * 2 / 3 - Math.PI / 2; ctx.lineTo(Math.cos(a) * (DC.ring - 8), Math.sin(a) * (DC.ring - 8)); } ctx.closePath(); ctx.stroke(); }
  ctx.restore();
  const sw = now / 1800 % (Math.PI * 2);   // light running round the ring
  for (let k = 0; k < 14; k++) { const a = sw - k * 0.045; ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k / 14)})`; ctx.lineWidth = 2.6 - k * 0.12; ctx.beginPath(); ctx.arc(H.x, H.y, DC.ring, a - 0.05, a); ctx.stroke(); }
  for (let i = 0; i < 26; i++) {   // motes
    const k = ((now / (7000 + (i % 5) * 1300)) + i * 0.137) % 1, x = B.x + ((i * 53.7) % B.w) + Math.sin(now / 1500 + i) * 6, y = B.y + B.h - k * B.h;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7; ctx.fillStyle = ['#8ad8ff', '#c8a0ff', '#ffd27a', '#8fffc0'][i % 4]; ctx.fillRect(Math.round(x), Math.round(y), i % 6 ? 1 : 2, i % 6 ? 1 : 2);
  }
  ctx.globalAlpha = 1;
  const hg = ctx.createRadialGradient(H.x, H.y, H.r - 4, H.x, H.y, H.r + 20), pu = 0.5 + 0.5 * Math.sin(now / 600); hg.addColorStop(0, `rgba(255,220,140,${0.35 + 0.15 * pu})`); hg.addColorStop(1, 'rgba(255,180,80,0)'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(H.x, H.y, H.r + 20, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// under each card: a soft shadow, and a glow in its element's colour that breathes; an empty place gets a faint well of light
function dcSlotBase(i, c, now) {
  const R = dcRect(i), S = dcSlots()[i];
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrect(ctx, R.x + 2, R.y + 3, R.w, R.h, 4); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; const col = c ? TF_RING[cardElement(c)] || '#c8c8d8' : '#3a5a8a', k = 0.5 + 0.5 * Math.sin(now / 520 + i);
  const g = ctx.createRadialGradient(S.x, S.y, 4, S.x, S.y, R.h * 0.85); g.addColorStop(0, hexA(col, c ? 0.28 + 0.14 * k : 0.1)); g.addColorStop(1, hexA(col, 0)); ctx.fillStyle = g; ctx.fillRect(S.x - R.h, S.y - R.h, R.h * 2, R.h * 2);
  ctx.restore();
}
function drawCircuitHub(game, now) {
  const H = DC.hub, pr = game.profile;
  ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(now / 9000); const gg = ctx.createLinearGradient(-H.r, -H.r, H.r, H.r); gg.addColorStop(0, '#ffe9a8'); gg.addColorStop(0.5, '#c88a2a'); gg.addColorStop(1, '#6a4010'); ctx.fillStyle = gg;
  for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI / 7); ctx.fillRect(-5, -H.r - 4, 10, 8); } ctx.restore();
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(H.x, H.y, H.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#4a2a08'; ctx.lineWidth = 1; ctx.stroke();
  const st = ctx.createLinearGradient(0, H.y - H.r, 0, H.y + H.r); st.addColorStop(0, '#f4f7fc'); st.addColorStop(1, '#6a7488'); ctx.strokeStyle = st; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(H.x, H.y, H.r - 5, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(H.x, H.y, H.r - 7, 0, Math.PI * 2); ctx.clip(); ctx.imageSmoothingEnabled = false; ctx.drawImage(dcScene(pr.heroBg || 0), H.x - H.r + 7, H.y - H.r + 7, (H.r - 7) * 2, (H.r - 7) * 2); ctx.restore();
  ['#ff4ad8', '#4ad8ff', '#4aff8a', '#ffb04a'].forEach((col, i) => { const a = Math.PI / 4 + i * Math.PI / 2, x = H.x + Math.cos(a) * (H.r - 2), y = H.y + Math.sin(a) * (H.r - 2); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff4c0'; ctx.lineWidth = 0.6; ctx.stroke(); });
  ctx.save(); ctx.beginPath(); ctx.arc(H.x, H.y, H.r - 7, 0, Math.PI * 2); ctx.clip(); try { drawPlayerPreview(pr.cls, pr.look || {}, profileStats(pr).look, 'idle', 2, H.x, H.y + 16, 1.15, now, true); } catch (e) {} ctx.restore();
  const name = ((pr.look && pr.look.name) || 'HERO').toUpperCase(), w = dcHubW(pr), y = H.y + H.r - 8, pg = ctx.createLinearGradient(0, y, 0, y + 15); pg.addColorStop(0, '#4a2a14'); pg.addColorStop(1, '#1e0e06'); ctx.fillStyle = pg; rrect(ctx, H.x - w / 2, y, w, 15, 6); ctx.fill(); ctx.strokeStyle = goldFrameGrad(y, 15); ctx.lineWidth = 1.2; rrect(ctx, H.x - w / 2 + 0.5, y + 0.5, w - 1, 14, 6); ctx.stroke(); text(name, H.x, y + 7.5, '#ffffff', 7.5);
  for (let i = 0; i < 2; i++) { const B = dcHubBtn(pr, i), hov = hovered(B.x, B.y, B.w, B.h); ctx.fillStyle = hov ? '#5a4630' : '#302014'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill(); ctx.strokeStyle = hov ? '#ffd860' : '#c9a85a'; ctx.lineWidth = 0.9; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 3); ctx.stroke(); ctx.fillStyle = '#ffe9a8'; const cx = B.x + B.w / 2, cy = B.y + B.h / 2, s = i ? 1 : -1; ctx.beginPath(); ctx.moveTo(cx + s * 2.6, cy); ctx.lineTo(cx - s * 2, cy - 3.4); ctx.lineTo(cx - s * 2, cy + 3.4); ctx.closePath(); ctx.fill(); }
}
function drawCircuitSlot(pr, i, c, now, sel, hov) {
  const R = dcRect(i), S = dcSlots()[i];
  if (c) { if (c.tier >= 6) drawWingPair(S.x, R.y + 16, c.tier >= 9 ? 'cosmic' : c.tier >= 8 ? 'gold' : 'whitegold', 14, 30, now, 1, c.tier >= 9); const si = pr.spells.indexOf(c.uid); drawTFCard(c, R.x, R.y - (hov ? 2 : 0), R.w, R.h, now, { sel: sel || hov, badge: si >= 0 ? 'QER'[si] : '' }); }
  else {
    const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, '#3e291a'); g.addColorStop(1, '#20150d'); ctx.fillStyle = g; rrect(ctx, R.x, R.y, R.w, R.h, 3); ctx.fill(); ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 2; rrect(ctx, R.x + 1, R.y + 1, R.w - 2, R.h - 2, 3); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; rrect(ctx, R.x + 3.5, R.y + 3.5, R.w - 7, R.h - 7, 2); ctx.stroke();
    // (no rune in an empty slot any more, 2026-11-13 the user: "remove the runes and the undefined": the list had ten runes for more
    // than ten slots, so the rest printed 'undefined')
  }
  if (sel) { ctx.strokeStyle = `rgba(255,255,255,${0.7 + 0.3 * Math.sin(now / 160)})`; ctx.lineWidth = 1.5; rrect(ctx, R.x - 2.5, R.y - 2.5, R.w + 5, R.h + 5, 4); ctx.stroke(); }
}
function drawCircuit(game, m, now) {
  const pr = game.profile, C = m.circuit, byId = id => pr.cards.find(c => c.uid === id), H = DC.hub, list = pickerList(pr, m), L = DC.L;
  drawSlatePage(PAGE_L); drawSlatePage(PAGE_R); pageHeader('MAGIC CIRCUIT', PAGE_L); ctx.drawImage(dcBackdrop(), 0, 0, VW, VH); dcDepth(now);
  for (let i = 0; i < dcSlots().length; i++) {   // the traces: dark while the place is empty, lit and running towards the hero with a card in it
    const c = byId(pr.deck[i]), pts = dcPath(i), col = c ? TF_RING[cardElement(c)] || '#c8c8d8' : '#523622';
    if (!c) { dcTrace(ctx, pts, col, 0.7); continue; }   // (an empty place: a faint dark thread)
    dcVein(ctx, pts, col, performance.now(), i); continue;   // (the live clock: the book can hold its cards still)
  }
  drawCircuitHub(game, now);
  for (let i = 0; i < dcSlots().length; i++) dcSlotBase(i, byId(pr.deck[i]), now);
  for (let i = 0; i < dcSlots().length; i++) { const R = dcRect(i); drawCircuitSlot(pr, i, byId(pr.deck[i]), now, C.cur === i, hovered(R.x, R.y, R.w, R.h)); }
  // the right page: your cards
  const P = DC.P; pageHeader(`YOUR DECK  ${pr.deck.length}/${deckMax(pr)}`, P);
  for (const ch of dcChips(pr)) { const on = (m.elFilter || null) === ch.id; ctx.fillStyle = on ? (ch.col ? hexA(ch.col, 0.35) : '#5a3e26') : '#2c1d12'; rrect(ctx, ch.x, ch.y, ch.w, ch.h, 3); ctx.fill(); ctx.strokeStyle = on ? (ch.col || '#ffd860') : '#5a4636'; ctx.lineWidth = 0.9; rrect(ctx, ch.x + 0.4, ch.y + 0.4, ch.w - 0.8, ch.h - 0.8, 3); ctx.stroke(); text(ch.label, ch.x + ch.w / 2, ch.y + 6.8, ch.col || (on ? '#ffe9a8' : '#b8a48a'), 6.5); }
  let hc = null;
  for (let i = 0; i < L.cols * L.rows; i++) {
    const j = C.scroll * L.cols + i, st = list[j], R = dcCell(i), hov = hovered(R.x, R.y, R.w, R.h), sel = C.list && C.lc === j; if (!st) { drawTFSlot(R.x, R.y, R.w, R.h, '', false, now); continue; }
    const si = st.cards.findIndex(x => pr.spells.includes(x.uid)), inDeck = st.cards.filter(x => pr.deck.includes(x.uid)).length, full = inDeck >= st.n; if (hov || sel) hc = st.c;
    drawTFCard(st.c, R.x, R.y - (hov ? 2 : 0), R.w, R.h, now, { sel: hov || sel, badge: si >= 0 ? 'QER'[pr.spells.indexOf(st.cards[si].uid)] : '', dim: full }); if (sel) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.strokeRect(R.x - 1.5, R.y - 1.5 - (hov ? 2 : 0), R.w + 3, R.h + 3); } if (st.n > 1) text(`×${st.n}`, R.x + R.w - 3, R.y + R.h - 16, '#ffe9a8', 5.8, 'right');
  }
  const rows = Math.ceil(list.length / L.cols); if (rows > L.rows) { const X = P.x + P.w - 8, Y = L.y, Hh = L.rows * (L.ch + L.gy) - L.gy; ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(X, Y, 2.4, Hh); ctx.fillStyle = '#ffd27a'; ctx.fillRect(X, Y + Hh * C.scroll / rows, 2.4, Hh * L.rows / rows); }
  if (!list.length) text('No cards of this element', P.x + P.w / 2, L.y + 80, '#9aa4b8', 7.5);
  if (C.pass) {   // every passive the ten cards give, added up
    const Q = { x: P.x + 11, y: 84, w: P.w - 22, h: 196 }, L2 = dcPassives(pr); ctx.fillStyle = '#24180f'; rrect(ctx, Q.x, Q.y, Q.w, Q.h, 4); ctx.fill(); ctx.strokeStyle = goldFrameGrad(Q.y, Q.h); ctx.lineWidth = 1; rrect(ctx, Q.x + 0.5, Q.y + 0.5, Q.w - 1, Q.h - 1, 4); ctx.stroke();
    goldTitle('ALL PASSIVES COMBINED', P.x + P.w / 2, Q.y + 11, 8.5, now); if (!L2.length) petInk('No passives in this deck yet', P.x + P.w / 2, Q.y + 60, '#c8d0e0', 8, 'center', false);
    const rowH = Math.min(24, (Q.h - 26) / Math.max(1, L2.length)), two = rowH > 18; L2.forEach((e, i) => { const y = Q.y + 24 + i * rowH; if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(Q.x + 3, y - 1, Q.w - 6, rowH); } petInk(`${PASSIVES[e.id].name}${e.n > 1 ? ` ×${e.n}` : ''}`, Q.x + 8, y + rowH / 2 - 0.5 - (two ? 5 : 0), '#ffe9a8', 7.5, 'left'); petInk(PASSIVES[e.id].fmt(e.v) + (e.capped ? ' (MAX)' : ''), two ? Q.x + 8 : Q.x + Q.w - 8, y + rowH / 2 - 0.5 + (two ? 5 : 0), e.capped ? '#ffd23f' : '#9fd8ff', 7, two ? 'left' : 'right', false); });
    popupButton({ ...dcTakeBtn(), label: 'TAKE OUT', col: '#c8d0de' }, now); popupButton({ ...dcPassBtn(), label: 'PASSIVES [P]', primary: true, col: '#ffd860' }, now); popupButton({ ...dcCloseBtn(), label: 'BACK', col: '#c8d0de' }, now); text('P or Esc: back to your cards', VW / 2, 350, '#c9c1a8', 7); return;
  }
  // the card you point at, or the place's card
  const IY = DC.info, ib = { x: P.x + 12, y: IY, w: P.w - 24, h: 68 }; ctx.fillStyle = 'rgba(22,15,9,0.75)'; rrect(ctx, ib.x, ib.y, ib.w, ib.h, 4); ctx.fill(); ctx.strokeStyle = '#563924'; ctx.lineWidth = 0.8; rrect(ctx, ib.x + 0.4, ib.y + 0.4, ib.w - 0.8, ib.h - 0.8, 4); ctx.stroke();
  const shown = hc || byId(pr.deck[C.cur]), cx = P.x + P.w / 2;
  if (shown) { const sp = cardSpell(shown), pv = cardPassives(shown)[0]; text(`${cardName(shown)} · ${RANKS[shown.tier]}`, cx, IY + 11, rankColor(shown.tier), 8); if (sp) wrap(`${sp.name} (${ELEMENTS[sp.el].name}) · ${sp.stat ? sp.desc : `${sp.power} power`} · ${sp.mp} MP`, ib.w - 12, 7).slice(0, 2).forEach((s, i) => petInk(s, cx, IY + 24 + i * 9, '#f0c27a', 7, 'center', false)); if (pv) wrap(`${passiveName(pv)}: ${PASSIVES[pv.id].fmt(passiveValue(pv.id, pv.tier))}`, ib.w - 12, 7).slice(0, 2).forEach((s, i) => petInk(s, cx, IY + 45 + i * 9, '#9fd8ff', 7, 'center', false)); }
  else { petInk(`Place ${C.cur + 1} is empty`, cx, IY + 26, '#f0e6d2', 9, 'center'); petInk('Tap a card to set it here', cx, IY + 44, '#c8d0e0', 8, 'center', false); }
  petInk(`Place ${C.cur + 1}`, ib.x + 4, IY + 62, '#ffe9a8', 6.5, 'left', false);
  const ask = m.circuit && m.circuit.allAsk > performance.now();
  popupButton({ ...dcTakeBtn(), label: 'TAKE OUT', danger: true, col: '#c8d0de' }, now); popupButton({ ...dcAllBtn(), label: ask ? 'SURE? CLICK' : 'UNEQUIP ALL', danger: true, col: ask ? '#ff9a8a' : '#c8d0de' }, now); popupButton({ ...dcPassBtn(), label: 'PASSIVES [P]', col: '#ffd860' }, now); popupButton({ ...dcCloseBtn(), label: 'CLOSE', col: '#c8d0de' }, now);
  text(C.list ? 'Arrows: choose · Enter: set · Esc: back to the board' : 'Arrows: place · Enter: cards · X: take out · B: background · P: passives · Q/E/R: spell key · Esc: close', VW / 2, 350, '#c9c1a8', 7);
}
// the deck's synergies on the Magic Circuit too (deckplus.js), on a small dark label under the hero
{
  const dc = drawCircuit;
  drawCircuit = (game, m, now) => {
    const r = dc(game, m, now), pr = game.profile; if (!pr || typeof deckSynergy !== 'function') return r;
    const L = deckSynText(deckSynergy(pr)), B = DC.B, t = L.length ? L.join(' · ') : 'no synergy yet';
    const sz = textW(t, 7) + 12 > B.w - 8 ? 6.5 : 7, tw = Math.min(B.w - 8, textW(t, sz) + 12), H = DC.hub, y = H.y + 50;   // (under the hero, in the ring's open middle: clear of every card)
    ctx.fillStyle = 'rgba(26,17,11,0.94)'; rrect(ctx, H.x - tw / 2, y - 7, tw, 14, 4); ctx.fill(); text(t, H.x, y, L.length ? '#ffd860' : '#c9c1a8', sz);
    return r;
  };
}
