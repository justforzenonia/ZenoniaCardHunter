'use strict';
// CHARACTER MAKER: after you choose a class (and at the Stylist) you choose who your hero looks like, from every villager, hero and
// monster in the game, then edit them in the customization screen: another character's head on that body, and a new colour for each of
// the sprite's own colours. The class keeps its stats, weapon and timing. pr.look.char = { id: 'nz044', head: 'm012' | null, paint: { hueBin: STYLE_COLORS id } }.
// How it draws: a hero's animations number their frames, and the weapon layers share those numbers, so the chosen sprite is laid over
// them. Every class frame takes a frame of the chosen character facing the same way (charBody): their own attack, hurt and cast art where they have it, otherwise their walk for walking and idle for the rest,
// moved to suit what the hero is doing (charPose): a lunge on attacks, a rise on casts, a flinch when hit, lying down when knocked flat.
const CHAR_TABS = [['n', 'Villagers'], ['h', 'Heroes'], ['m', 'Monsters']];
const CHAR_PICK = { cols: 12, rows: 4, cw: 49, ch: 58, x: 26, y: 76 };
const CHAR_HEAD = { cut: 0.52, neck: 2 };   // the share of a sprite that is its head, and how far a new head sits over the neck
const CHAR_BIN = 30, CHAR_COLOURS = 4;      // a sprite's colours: one per 30° of hue, its four biggest
function charSrc(id) {
  if (!id) return null;
  const t = id[0], k = id.slice(1), bank = B => B && { frames: B.frames, anims: B.anims, image: B.canvas || img(B.imgs ? B.imgs[0] : B.img) };
  if (t === 'n') return bank(D.npcs[k]);
  if (t === 'm') return bank(D.monsters[k]);
  const C = CLASSES[+k]; if (!C || C.mon) return null;
  const own = C.bank && window[C.bank], S = D.classes[C.sprite];
  if (own) return bank(own);
  if (C.sheet && window.CHEF_BODY) return { ...bank(CHEF_BODY), anims: S.anims };
  return { frames: S.body.frames, anims: S.anims, image: img(C.bodySheet || S.body.img || S.body.imgs[0]) };
}
const charRec = (S, fi) => { const r = S.frames[fi]; return Array.isArray(r) && r[2] > 0 ? r : null; };
function charSeq(S, name, d) {
  const L = S.anims[name] || S.anims.idle || S.anims.walk; if (!L) return null;
  const seq = L[d] && L[d].length ? L[d] : L.find(q => q && q.length); return seq ? seq.filter(e => charRec(S, e[0])) : null;
}
const CHAR_LISTS = {};
function charList(tab) {
  if (CHAR_LISTS[tab]) return CHAR_LISTS[tab];
  const all = tab === 'n' ? Object.keys(D.npcs).map(k => ({ id: 'n' + k, name: (NPC_CARDS['n' + k] || [])[1] || 'Villager' }))
    : tab === 'h' ? CLASSES.map((C, i) => ({ id: 'h' + i, name: C.name, mon: C.mon })).filter(c => !c.mon)
    : Object.keys(D.monsters).map(k => ({ id: 'm' + k, name: (SPECIES[k] || {}).name || 'Monster' }));
  if (tab === 'b' || tab === 'c') return (CHAR_LISTS[tab] = tab === 'b' ? heroBodies() : costumeList());
  return (CHAR_LISTS[tab] = all.filter(c => charUsable(c.id)));
}
// HERO PARTS CREATOR: a hero's look is built from the game's own hero bodies, which have every move (idle, walk, three attacks, cast,
// hurt, knock-down, win), so any body + head + colours animates properly. One entry per distinct sprite (the Assassin, Mage and
// Martial Artist share one), leaving out the Archer, whose bow is painted into his frames. COSTUMES are the villagers and monsters
// that also work as a hero: their own walk in four directions and their own attack art (the rest only ever slid about).
// The partner picker keeps the old Villagers / Heroes / Monsters lists (a partner needn't swing a sword).
const LOOK_TABS = [['b', 'Heroes']];   // (the villager and monster costumes left the hero picker: heroes only, coloured part by part. A look already wearing one keeps it.)
const PARTNER_TABS = CHAR_TABS.filter(t => t[0] !== 'h');   // (partners come from the villagers and monsters: the heroes are for your own look. A partner already chosen from them stays.)
const pickTabs = m => m.field === 'partner' ? PARTNER_TABS : LOOK_TABS;
function heroBodies() {
  const seen = new Set(), out = [];
  CLASSES.forEach((C, i) => {
    if (C.mon || C.bank) return;
    const key = C.bodySheet || (C.sheet ? 'chef' : 'sprite' + C.sprite); if (seen.has(key)) return; seen.add(key);
    if (charUsable('h' + i) && !out.some(b => charLooksSame(b.id, 'h' + i))) out.push({ id: 'h' + i, name: C.name, key });   // (OmegaKingX stands just like the Berserker: one entry)
  });
  return out;
}
// two sprites whose front and side idle frames are the same pixels
// (each body's picture signature is worked out once and kept: making it reads pixels, and the hero picker asks many times a frame)
const CHAR_SIGS = new Map();
function charLooksSame(a, b) {
  const sig = id => { if (CHAR_SIGS.has(id)) return CHAR_SIGS.get(id); const S = charSrc(id); if (!S || S.image.complete === false) return null; const v = [2, 1].map(d => { const q = charSeq(S, 'idle', d), r = q && q.length && charRec(S, q[0][0]); if (!r) return ''; const c = document.createElement('canvas'); c.width = r[2]; c.height = r[3]; const g = c.getContext('2d'); g.drawImage(S.image, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); const px = g.getImageData(0, 0, r[2], r[3]).data; let h = 0; for (let i = 0; i < px.length; i++) h = (h * 31 + px[i]) | 0; return r[2] + 'x' + r[3] + ':' + h; }).join(); CHAR_SIGS.set(id, v); return v; };
  const A = sig(a), B = sig(b); return !!A && A === B;
}
// the body a class wears by itself, as a hero body id (so a new head can go straight onto the class's own look)
function classBodyId(cls) {
  const C = CLASSES[cls]; if (!C || C.mon || C.bank) return null;
  const key = C.bodySheet || (C.sheet ? 'chef' : 'sprite' + C.sprite), B = charList('b').find(b => b.key === key);   // (the kept list: heroBodies() builds it afresh, which is slow)
  return B ? B.id : charUsable('h' + cls) ? 'h' + cls : null;   // (OmegaKingX is not in the list, but still wears his own body under a new head)
}
function costumeList() {
  const ok = id => { const S = charSrc(id); if (!S || !(S.anims.attack || S.anims.atk1)) return false; const W = [0, 1, 2, 3].map(d => (charSeq(S, 'walk', d) || []).map(e => e[0]).join()); return new Set(W).size === 4; };
  return [...charList('n'), ...charList('m')].filter(c => ok(c.id));
}
// who can stand in for a hero: someone who walks in at least three directions at a person's size. Sitters, animals, blobs and bosses too big to play as are left out;
// a monster must also have attack art. (A hero already wearing one keeps it.)
const CHAR_SIZE = { minH: 16, maxH: 56, maxW: 46 };
const charAnimals = () => new Set(['n100', ...[...FOLK.hearthvale, ...FOLK.outposts.flat()].filter(F => F[4].includes('(')).map(F => 'n' + F[0])]);
function charUsable(id) {
  const S = charSrc(id), q = S && charSeq(S, 'idle', 2); if (!q || !q.length) return false; if (id[0] === 'h') return true;
  if (charAnimals().has(id) || (id[0] === 'm' && !S.anims.attack)) return false;
  const walks = [0, 1, 2, 3].map(d => charSeq(S, 'walk', d) || []), r = charRec(S, q[0][0]);
  return !!S.anims.walk && new Set(walks.map(w => w.map(e => e[0]).join())).size >= 3 && walks.some(w => new Set(w.map(e => e[0])).size > 1) && r[3] >= CHAR_SIZE.minH && r[3] <= CHAR_SIZE.maxH && r[2] <= CHAR_SIZE.maxW;
}
// the chosen character's own animation for one of the hero's moves, if they have it
function charOwn(S, name) { const k = S.anims[name] ? name : /down|knock|die/.test(name) ? null : MON_MAP[name]; return k && k !== 'idle' && S.anims[k] && S.anims[k].some(q => q && q.length) ? k : null;
}
function charName(id) { for (const [t] of [...LOOK_TABS, ...CHAR_TABS]) { const c = charList(t).find(q => q.id === id); if (c) return c.name; } return (id[0] === 'n' && (NPC_CARDS[id] || [])[1]) || (id[0] === 'm' && (SPECIES[id.slice(1)] || {}).name) || 'Villager'; }
// the chosen sprite, with any new head, on a sheet of its own (one cell per frame), and the colours it is made of
const CHAR_BAKED = {};
function charBake(id, head, parts = null) {   // (parts: colours per body part, heroparts.js: each sprite is painted before it is cut and laid out)
  const pk = parts && Object.values(parts).some(v => v && v !== 'orig') ? JSON.stringify(parts) : '';
  const key = `${id}|${head || ''}${pk ? '|' + pk : ''}`; if (CHAR_BAKED[key]) return CHAR_BAKED[key];
  const S0 = charSrc(id), H0 = head && charSrc(head); if (!S0 || S0.image.complete === false || (H0 && H0.image.complete === false)) return null;
  const S = pk ? { ...S0, image: heroPartsImage(S0.image, heroPartKey(id), parts) } : S0, H = H0 && pk ? { ...H0, image: heroPartsImage(H0.image, heroPartKey(head), parts) } : H0;
  const dirOf = new Map();
  for (const name of ['idle', 'walk', ...Object.keys(S.anims)]) for (let d = 0; d < 4; d++) for (const e of charSeq(S, name, d) || []) if (!dirOf.has(e[0])) dirOf.set(e[0], d);
  // THE ORIGINAL ATTACK FRAMES (2026-11-13, the user: "use original frame by frame attack animation from 1 and 2"): a new head was
  // pasted on EVERY frame, centred on the frame's whole box and cut at a fixed share of its height. In an attack the box takes in the
  // gun, sword or swing, so the head landed beside the body and part of the body was cut away. Now a head is only swapped on the
  // standing and walking frames; attacks, skills and casts are Zenonia 1 / 2's own frames, untouched. A hero wearing their own head
  // (the same sprite as the body) swaps nothing at all.
  const HS = head && head !== id ? H : null, plain = new Set();
  for (const name of ['idle', 'walk']) for (let d = 0; d < 4; d++) for (const e of charSeq(S, name, d) || []) plain.add(e[0]);
  const cells = []; let W = 1, Ht = 1;
  for (const [fi, d] of dirOf) {
    const r = charRec(S, fi), hs = HS && plain.has(fi) && charSeq(HS, 'idle', d), hr = hs && hs.length && charRec(HS, hs[0][0]); let C;
    if (hr) {
      const cut = Math.round(r[3] * CHAR_HEAD.cut), hh = Math.round(hr[3] * CHAR_HEAD.cut), top = r[5] + cut, hx = Math.round(r[4] + r[2] / 2 - hr[2] / 2), hy = top - hh + CHAR_HEAD.neck;
      const x0 = Math.min(r[4], hx), x1 = Math.max(r[4] + r[2], hx + hr[2]), y0 = Math.min(top, hy);
      C = { fi, w: x1 - x0, h: r[5] + r[3] - y0, ox: x0, oy: y0, body: [r[0], r[1] + cut, r[2], r[3] - cut, r[4] - x0, top - y0], head: [hr[0], hr[1], hr[2], hh, hx - x0, hy - y0] };
    } else C = { fi, w: r[2], h: r[3], ox: r[4], oy: r[5], body: [r[0], r[1], r[2], r[3], 0, 0] };
    C.x = W; cells.push(C); W += C.w + 1; Ht = Math.max(Ht, C.h);
  }
  const lying = [0, 1, 2, 3].map(d => { const q = charSeq(S, 'idle', d), C = q && q.length && cells.find(e => e.fi === q[0][0]); if (!C) return null; const L = { d, C, x: W }; W += C.h + 1; Ht = Math.max(Ht, C.w); return L; });   // each facing, on its side
  const c = document.createElement('canvas'); c.width = W; c.height = Ht + 2; const g = c.getContext('2d', { willReadFrequently: true }), frames = [];
  for (const C of cells) {
    const [bx, by, bw, bh, ax, ay] = C.body; g.drawImage(S.image, bx, by, bw, bh, C.x + ax, 1 + ay, bw, bh);
    if (C.head) { const [hx, hy, hw, hh, tx, ty] = C.head; g.drawImage(H.image, hx, hy, hw, hh, C.x + tx, 1 + ty, hw, hh); }
    frames[C.fi] = [C.x, 1, C.w, C.h, C.ox, C.oy];
  }
  const lies = [];
  for (const L of lying) { if (!L) continue; const { C, x, d } = L; g.save(); g.translate(x + C.h, 1); g.rotate(Math.PI / 2); g.drawImage(c, C.x, 1, C.w, C.h, 0, 0, C.w, C.h); g.restore(); lies[d] = [x, 1, C.h, C.w, -Math.round(C.h / 2), 1 - C.w]; }
  const px = g.getImageData(0, 0, c.width, c.height).data, bins = {};
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue; const [h, s, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]); if (s < 0.18 || l < 0.12 || l > 0.94) continue;
    const b = Math.floor(h / CHAR_BIN), B = bins[b] || (bins[b] = { bin: b, n: 0, r: 0, g: 0, b: 0 }); B.n++; B.r += px[i]; B.g += px[i + 1]; B.b += px[i + 2];
  }
  const pal = Object.values(bins).sort((a, b) => b.n - a.n).slice(0, CHAR_COLOURS).map(B => ({ bin: B.bin, col: `rgb(${Math.round(B.r / B.n)},${Math.round(B.g / B.n)},${Math.round(B.b / B.n)})` }));
  return (CHAR_BAKED[key] = { canvas: c, frames, lies, pal, painted: {} });
}
const charBins = m => { const B = m.char && charBake(m.char, m.head); return B ? B.pal : []; };
function charPaintOf(m) { const out = {}; charBins(m).forEach((b, i) => { const v = m['c' + i]; if (v && v !== 'orig') out[b.bin] = v; }); return out; }
function charPainted(B, paint) {
  const key = JSON.stringify(paint || {}); if (key === '{}') return B.canvas; if (B.painted[key]) return B.painted[key];
  const c = document.createElement('canvas'); c.width = B.canvas.width; c.height = B.canvas.height; const g = c.getContext('2d'); g.drawImage(B.canvas, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height), px = id.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue; const [h, s, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]); if (s < 0.18 || l < 0.12 || l > 0.94) continue;
    const rgb = applyColor(h, s, l, STYLE_COLORS[paint[Math.floor(h / CHAR_BIN)]]); if (rgb) { px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; }
  }
  g.putImageData(id, 0, 0); return (B.painted[key] = c);
}
// a frame moved to fit what the hero is doing; these characters have no fighting art of their own
function charPose(B, rec, P) {
  if (!P || !rec) return rec;
  const { name, d, t } = P, [vx, vy] = DV[d], arc = Math.sin(t * Math.PI), move = (dx, dy) => [rec[0], rec[1], rec[2], rec[3], rec[4] + Math.round(dx), rec[5] + Math.round(dy)];
  if (name === 'down' || name === 'die') return B.lies[d] || rec;
  if (name === 'knock') return t > 0.5 && B.lies[d] ? B.lies[d] : move(-vx * 3, -vy * 3 - arc * 4);
  if (name === 'hurt') return move(-vx * 2, -vy * 2);
  if (name === 'cast' || name === 'charge') return move(0, -arc * 2);
  if (name === 'win') return move(0, -Math.abs(Math.sin(t * Math.PI * 2)) * 3);
  if (/^atk|^attack|^skill/.test(name)) { const r = t < CHAR_LUNGE.wind ? CHAR_LUNGE.back : Math.sin((t - CHAR_LUNGE.wind) / (1 - CHAR_LUNGE.wind) * Math.PI) * CHAR_LUNGE.reach; return move(vx * r, vy * r * 0.7 - (r > 0 ? 1 : 0)); }
  return rec;
}
const CHAR_LUNGE = { wind: 0.2, back: -2, reach: 5 };
// a body bank numbered like the class's frames, drawn with the chosen character
const CHAR_BODIES = new WeakMap();
function charBody(heroFrames, anims, ch) {
  const S = charSrc(ch.id), B = S && charBake(ch.id, ch.head, ch.parts); if (!B) return null;
  const key = JSON.stringify(ch), M = CHAR_BODIES.get(heroFrames) || new Map(); CHAR_BODIES.set(heroFrames, M); if (M.has(key)) return M.get(key);
  const map = [], pose = [], lay = (name, from, real) => { for (let d = 0; d < 4; d++) { const seq = anims[name] && anims[name][d], s = charSeq(S, from, d); if (seq && s && s.length) seq.forEach((e, k) => { if (map[e[0]] == null) { map[e[0]] = s[Math.floor(k * s.length / seq.length)][0]; if (!real) pose[e[0]] = { name, d, t: seq.length > 1 ? k / (seq.length - 1) : 1 }; } }); } };
  lay('idle', 'idle'); lay('walk', 'walk');
  for (const name in anims) { const own = charOwn(S, name); lay(name, own || (/walk|run|dash/.test(name) ? 'walk' : 'idle'), !!own); }
  const still = charSeq(S, 'idle', 2)[0][0], body = { img: `char:${key}`, canvas: charPainted(B, ch.paint), frames: heroFrames.map((_, i) => charPose(B, B.frames[map[i] ?? still] || B.frames[still], pose[i])) };
  M.set(key, body); return body;
}
// ---------------------------------------------------------------- the list of everyone
function charPick(back, field = 'char') {
  const m = { type: 'charpick', back, field, tab: 0, cur: 0, scroll: 0 }, id = back[field];
  if (id) { const T = pickTabs(m); m.tab = Math.max(0, T.findIndex(t => charList(t[0]).some(c => c.id === id))); m.cur = Math.max(0, charItems(m).findIndex(c => c.id === id)); charScroll(m); }
  return m;
}
const charItems = m => m.field === 'partner' ? charList(pickTabs(m)[m.tab][0]) : [{ id: null, name: m.field === 'head' ? 'Own head' : 'Class look' }, ...charList(pickTabs(m)[m.tab][0])];
function charScroll(m) { const P = CHAR_PICK, r = Math.floor(m.cur / P.cols); if (r < m.scroll) m.scroll = r; if (r >= m.scroll + P.rows) m.scroll = r - P.rows + 1; }
function charChoose(game, m) {
  if (m.field === 'partner') {
    const id = charItems(m)[m.cur].id, B = m.back;
    if (B.existing) { game.profile.partner = partnerNew(id); game.save(); game.menu = partnerMenu(); spawnPartner(game.world, game.world.player); return; }
    B.partner = id; customDone(game, B); return;
  }
  const it = charItems(m)[m.cur], B = m.back; if (m.field === 'head' && it.id && !B.char) B.char = classBodyId(B.cls) || it.id;   // (a head needs a body: the class's own)
  B[m.field] = it.id; if (!B.char) B.head = null;
  for (let i = 0; i < CHAR_COLOURS; i++) B['c' + i] = 'orig';
  B.row = customRows(B).indexOf(m.field); if (B.row < 0) B.row = customRows(B).indexOf('char'); game.menu = B;
}
function updateCharPick(game, m) {
  const k = navInput(), P = CHAR_PICK, n = charItems(m).length, tab = t => { const T = pickTabs(m); m.tab = (t + T.length) % T.length; m.cur = 0; m.scroll = 0; };
  if (hit('Tab')) tab(m.tab + 1); if (hit('KeyQ')) tab(m.tab - 1); if (hit('KeyE')) tab(m.tab + 1);
  pickTabs(m).forEach((t, i) => { if (clicked(P.x + i * 92, 46, 88, 20)) tab(i); });
  if (k.l) m.cur = (m.cur + n - 1) % n; if (k.r) m.cur = (m.cur + 1) % n;
  if (k.u) m.cur = Math.max(0, m.cur - P.cols); if (k.d) m.cur = Math.min(n - 1, m.cur + P.cols);
  if (mouse.wheel) { m.scroll = clamp(m.scroll + mouse.wheel, 0, Math.max(0, Math.ceil(n / P.cols) - P.rows)); m.cur = clamp(m.cur, m.scroll * P.cols, Math.min(n - 1, (m.scroll + P.rows) * P.cols - 1)); mouse.wheel = 0; }
  else charScroll(m);
  for (let i = m.scroll * P.cols; i < Math.min(n, (m.scroll + P.rows) * P.cols); i++) { const c = charCell(m, i); if (clicked(c.x, c.y, P.cw - 3, P.ch - 3)) { if (m.cur === i) k.ok = true; m.cur = i; } }
  if (k.back) { game.menu = m.back; return; }
  if (k.ok) charChoose(game, m);
}
const charCell = (m, i) => ({ x: CHAR_PICK.x + (i % CHAR_PICK.cols) * CHAR_PICK.cw, y: CHAR_PICK.y + (Math.floor(i / CHAR_PICK.cols) - m.scroll) * CHAR_PICK.ch });
// the highlighted cell: the same size and spot as its still picture, but walking, a facing every CHAR_WALK ms (front, right, back, left)
const CHAR_WALK = 1200;
function drawCharWalking(id, cx, by, maxW, maxH, cap = 1.5, now = performance.now()) {
  const S = charSrc(id), q = S && charSeq(S, 'idle', 2), ri = q && q.length && charRec(S, q[0][0]); if (!ri) return;
  const d = [2, 1, 0, 3][Math.floor(now / CHAR_WALK) % 4], w = charSeq(S, 'walk', d), e = w && w.length && seqFrame(w, now, true), f = e && charRec(S, e[0]);
  if (!f) { drawCharThumb(id, cx, by, maxW, maxH, cap); return; }
  const s = Math.min(cap, maxW / ri[2], maxH / ri[3]), ax = cx - (ri[4] + ri[2] / 2) * s, fy = by - (ri[5] + ri[3]) * s;
  ctx.drawImage(S.image, f[0], f[1], f[2], f[3], Math.round(ax + (f[4] + (e[2] || 0)) * s), Math.round(fy + (f[5] + (e[3] || 0)) * s), f[2] * s, f[3] * s);
}
function drawCharThumb(id, cx, by, maxW, maxH, cap = 1.5) {
  const S = charSrc(id), q = S && charSeq(S, 'idle', 2), r = q && q.length && charRec(S, q[0][0]); if (!r) return;
  const s = Math.min(cap, maxW / r[2], maxH / r[3]); ctx.drawImage(S.image, r[0], r[1], r[2], r[3], cx - r[2] * s / 2, by - r[3] * s, r[2] * s, r[3] * s);
}
function drawCharPick(game, m, now) {
  const P = CHAR_PICK, L = charItems(m), n = L.length;
  ctx.fillStyle = 'rgba(6,6,14,0.92)'; ctx.fillRect(0, 0, VW, VH);
  goldTitle(m.field === 'head' ? 'CHOOSE A HEAD' : m.field === 'partner' ? 'CHOOSE YOUR PARTNER' : 'CHOOSE YOUR CHARACTER', VW / 2, 24, 14, now);
  pickTabs(m).forEach((t, i) => { const on = m.tab === i, x = P.x + i * 92; panel(x, 46, 88, 20, on ? '#ffd23f' : '#5a5040', on ? 'rgba(70,55,20,0.95)' : 'rgba(30,20,13,0.92)'); text(`${t[1]} ${charList(t[0]).length}`, x + 44, 56, on ? '#ffd23f' : '#c9c1a8', 8); });
  text(L[m.cur].name, VW - 28, 56, '#fff', 10, 'right');
  ctx.imageSmoothingEnabled = false;
  for (let i = m.scroll * P.cols; i < Math.min(n, (m.scroll + P.rows) * P.cols); i++) {
    const c = charCell(m, i), on = i === m.cur, it = L[i];
    panel(c.x, c.y, P.cw - 3, P.ch - 3, on ? '#ffd23f' : '#48301e', on ? 'rgba(70,55,20,0.9)' : 'rgba(30,20,13,0.92)');
    const named = pickTabs(m)[m.tab][0] === 'b';   // (the heroes look alike at this size: each wears its name)
    if (it.id) (on ? drawCharWalking : drawCharThumb)(it.id, c.x + (P.cw - 3) / 2, c.y + P.ch - (named ? 16 : 8), P.cw - 9, P.ch - (named ? 21 : 12), 1.5, now);   // (the one you point at walks, turning through its facings)
    if (it.id && named) { let nm = it.name; while (nm.length > 3 && textW(nm, 7) > P.cw - 7) nm = nm.slice(0, -2) + '…';   // (7 px, cut to fit the square)
      text(nm, c.x + (P.cw - 3) / 2, c.y + P.ch - 8.5, on ? '#ffd23f' : '#d8d0b8', 7); }
    else if (!it.id) text(m.field === 'head' ? 'OWN' : 'CLASS', c.x + (P.cw - 3) / 2, c.y + 26, '#c9c1a8', 7);   // (only the empty first square: a partner tile is someone)
  }
  const rows = Math.ceil(n / P.cols); if (rows > P.rows) { const h = P.rows * P.ch - 4, bh = h * P.rows / rows; ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, VW - 16, P.y, 4, h, 2); ctx.fill(); ctx.fillStyle = '#ffd23f'; rrect(ctx, VW - 16, P.y + h * m.scroll / rows, 4, bh, 2); ctx.fill(); }
  text('Arrows or click: choose · Enter or click again: pick · Tab: next list · wheel: scroll · Esc: back', VW / 2, 322, '#c9c1a8', 8);
  text(m.field === 'partner' ? 'They fight beside you and grow with you. If they fall, they are gone for good.' : 'Every hero here has every move; colour their hair, skin and clothes part by part in the Stylist. Your class keeps its stats and weapon.', VW / 2, 336, m.field === 'partner' ? '#ffb0a0' : '#8fd0ff', 7.5);
}
