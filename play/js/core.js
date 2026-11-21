'use strict';
// Core: canvas, input, image cache, sprite/animation drawing, text & UI primitives, RNG, save.
const D = window.GAME_DATA;
// Layout is authored in a 640×360 "logical" space. The canvas backing store is RES× that, so text
// and UI render crisply, and the game world is drawn with an extra ZOOM so sprites appear larger.
const VW = 640, VH = 360, ZOOM = 0.95;   // the gameplay camera, pulled well back (1.05 until 2026-11-13: the user asked to see more)
// the drawing resolution: 2x (sharp) unless Settings PERFORMANCE asked for FAST (1x, a quarter of the pixels: for slower phones).
// It is read once, here, so a change applies the next time the game loads (settings.js).
const RES = (() => { try { return JSON.parse(localStorage.getItem('zch_settings') || '{}').fast ? 1 : 2; } catch (e) { return 2; } })();
const WVW = VW / ZOOM, WVH = VH / ZOOM;          // world view size in map pixels
const cv = document.getElementById('c');
cv.width = VW * RES; cv.height = VH * RES;
const ctx = cv.getContext('2d');

function fitCanvas() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  cv.style.width = Math.floor(VW * s) + 'px';
  cv.style.height = Math.floor(VH * s) + 'px';
}
addEventListener('resize', fitCanvas); fitCanvas();
new ResizeObserver(fitCanvas).observe(document.documentElement);
function resetView() { ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.imageSmoothingEnabled = false; }
// every frame starts from a clean drawing state (main.js frame): a colour filter, fade or blend left on by a drawing step that failed
// before its ctx.restore() would otherwise tint everything after it, frame after frame (the user once saw the whole game turn
// purple, 2026-11-18). Unclosed saves are unwound first, then each setting is put back to its default.
function frameReset() {
  for (let k = 0; k < 64 && (ctx.filter !== 'none' || ctx.globalAlpha !== 1 || ctx.globalCompositeOperation !== 'source-over'); k++) ctx.restore();
  ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.shadowColor = 'rgba(0,0,0,0)';
  resetView();
}
resetView();

// ---------- images ----------
// Each page load asks for fresh copies (the stamp changes every load), so replaced art always shows after a reload
// instead of an old copy the browser kept from before.
const IMGS = {}, IMG_STAMP = D.version + '_' + Date.now();
function img(src) {
  if (!src) return null;
  let i = IMGS[src];
  if (!i) {
    i = IMGS[src] = new Image(); i.tries = 0;
    i.addEventListener('error', () => { if (++i.tries < 6) setTimeout(() => { i.src = `${src}?v=${IMG_STAMP}&r=${i.tries}`; }, 300 * i.tries); });   // a dropped request tries again
    const P = window.ASSET_PACK && ASSET_PACK.index[src];   // from the pack if it's in there (tools/build_pack.py)
    if (!P && window.ZCH_LIVE) i.crossOrigin = 'anonymous';   // (the app running the website's game, boot.js: an image from the website, asked for so the canvas can still read its pixels)
    i.src = P ? URL.createObjectURL(new Blob([ASSET_PACK.bytes.subarray(P[0], P[0] + P[1])], { type: src.endsWith('.jpg') ? 'image/jpeg' : 'image/png' })) : src + '?v=' + IMG_STAMP;
  }
  return i;
}
const PRELOAD_MAX = 40000;
function preloadAll() {
  const srcs = [];
  const walk = o => {
    if (typeof o === 'string' && o.startsWith('assets/') && o.endsWith('.png')) srcs.push(o);
    else if (Array.isArray(o)) { if (o.length && typeof o[0] === 'number') return; o.forEach(walk); }
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(D);
  if (typeof CLASSES !== 'undefined') CLASSES.forEach(C => C.bodySheet && srcs.push(C.bodySheet, 'assets/hero_hand.png'));   // heroes on their own sheet (OmegaKingX, Archer)
  if (typeof CARD_FRAMES !== 'undefined') srcs.push(...CARD_FRAMES.map(F => F.src));
  if (typeof MINI_FRAMES !== 'undefined') srcs.push(...MINI_FRAMES);   // the mini card frames (inventory.js)   // the trading-card frames (cards.js)
  if (typeof HOLE_PLATE_ART !== 'undefined') srcs.push(...HOLE_PLATE_ART.map(A => A.src), 'assets/fish_sheet.png', 'assets/ui_border_006.png', 'assets/ui_divider.png', 'assets/ki_orb.png', 'assets/ki_bomb.png', 'assets/ki_dragon.png', 'assets/ki_aura.png', 'assets/ki_rise.png', 'assets/quest_mark.png', 'assets/quest_star.png', 'assets/butcher.png',  'assets/spring_lily.png', 'assets/animals/chicken_walk.png', 'assets/animals/chicken_eat.png', 'assets/animals/cow_walk.png', 'assets/animals/cow_eat.png', 'assets/animals/llama_walk.png', 'assets/animals/llama_eat.png', 'assets/animals/pig_walk.png', 'assets/animals/pig_eat.png', 'assets/animals/sheep_walk.png', 'assets/animals/sheep_eat.png', 'assets/casino_fx.png', 'assets/casino_coin.png', 'assets/casino_hall.jpg', 'assets/hud_panel_warm.png', 'assets/hud_slot_warm.png', 'assets/hud_bar_a_warm.png', 'assets/hud_bar_b_warm.png');   // the black holes' painted plates and craters (caves.js), so they never pop in
  const status = document.getElementById('load'), head = status ? status.textContent.split(' (')[0] : ''; let done = 0;
  const tick = () => { done++; if (status) status.textContent = `${head} (${done} / ${srcs.length})`; };
  const all = Promise.all(srcs.map(s => new Promise(r => { const i = img(s), ok = () => { tick(); r(); }; if (i.complete && i.naturalWidth) return ok(); i.addEventListener('load', ok); i.addEventListener('error', () => { if (i.tries >= 6) ok(); }); })));   // (waits through the retries)
  return Promise.race([all, new Promise(r => setTimeout(r, PRELOAD_MAX))]).then(() => { if (status) status.textContent = 'Building the world…'; });   // (a stuck image finishes loading in play instead of holding up the game)
}

// ---------- input ----------
const keys = new Set(), pressed = new Set();
const typed = [];   // printable characters typed this frame (for name entry)
const mouse = { x: 0, y: 0, click: false, down: false };
const BLOCK = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
addEventListener('keydown', e => {
  if (BLOCK.includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) typed.push(e.key);
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
cv.addEventListener('mousedown', e => {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * VW / r.width; mouse.y = (e.clientY - r.top) * VH / r.height;
  mouse.click = true; mouse.down = true;
});
addEventListener('mouseup', () => { mouse.down = false; });
cv.addEventListener('mousemove', e => {   // keep the pointer position current so held HUD buttons follow it
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * VW / r.width; mouse.y = (e.clientY - r.top) * VH / r.height;
});
const isDown = (...c) => c.some(k => keys.has(k));
const hit = (...c) => c.some(k => pressed.has(k));
function consume(...c) { c.forEach(k => pressed.delete(k)); }
function endFrameInput() { pressed.clear(); typed.length = 0; mouse.click = false; }
function clicked(x, y, w, h) { return mouse.click && mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h; }

// ---------- animation ----------
// seq: [[frameIdx, ms, dx, dy], ...]
function seqDur(seq, speed = 1) { let t = 0; for (const f of seq) t += f[1]; return t / speed; }
function seqFrame(seq, t, loop, speed = 1) {
  if (!seq || !seq.length) return null;
  const total = seqDur(seq, speed);
  if (loop) t = ((t % total) + total) % total; else t = Math.min(t, total - 0.01);
  for (const f of seq) { const d = f[1] / speed; if (t < d) return f; t -= d; }
  return seq[seq.length - 1];
}

// rec: [x, y, w, h, offX, offY]
function drawRec(image, rec, x, y, flipX = false, scale = 1) {
  if (!rec || !image || image.complete === false) return;   // canvases have no .complete
  const dx = x + rec[4] * scale, dy = y + rec[5] * scale;
  if (flipX) {
    ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1);
    ctx.drawImage(image, rec[0], rec[1], rec[2], rec[3], Math.round(-rec[4] * scale - rec[2] * scale), Math.round(dy), rec[2] * scale, rec[3] * scale);
    ctx.restore();
  } else {
    ctx.drawImage(image, rec[0], rec[1], rec[2], rec[3], Math.round(dx), Math.round(dy), rec[2] * scale, rec[3] * scale);
  }
}
// bank: {img|imgs, frames}; entry: seq frame [fi, ms, dx, dy]
function drawBankFrame(bank, entry, x, y, opt = {}) {
  if (!entry) return;
  const image = bank.canvas || img(bank.imgs ? bank.imgs[Math.min(opt.pal || 0, bank.imgs.length - 1)] : bank.img);
  const rec = bank.frames[entry[0]];
  const s = opt.scale || 1;
  drawRec(image, rec, x + entry[2] * s, y + entry[3] * s, false, s);
}

// ---------- text & UI ----------
// Game text: a sturdy, readable bold sans (Tahoma) at the screen's real resolution (TEXT_RES pixels per game pixel),
// a thin dark outline (about 1.5 screen pixels) and a gentle light-top / darker-bottom shade so it isn't flat. Each
// rendered label is cached (PIX), so it is only drawn once.
let FONT = 'Tahoma, Verdana, sans-serif';   // (let: fontpick.js can swap it)
const fontPx = size => Math.max(8, Math.round(size * 1.1));
const PIX = new Map(), PIXC = document.createElement('canvas').getContext('2d'), TEXT_RES = 2;
// THE COZY FONT: Fredoka (assets/fonts, SIL Open Font License), soft and round. Until it has loaded (a moment) text uses Tahoma;
// then the cached labels are dropped so everything redraws in it. The phone buttons (touch.js) use it too.
try { new FontFace('Fredoka', 'url(assets/fonts/Fredoka.ttf)', { weight: '300 700' }).load().then(f => { document.fonts.add(f); FONT = '"Fredoka", Tahoma, Verdana, sans-serif'; PIX.clear(); TEXTW_MEMO.clear(); }).catch(() => {}); } catch (e) {}
function cssRgba(col) {   // any CSS colour -> [r, g, b, a]
  PIXC.fillStyle = '#000'; PIXC.fillStyle = col; const s = PIXC.fillStyle;
  if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
  const v = s.slice(s.indexOf('(') + 1, -1).split(',').map(Number); return [v[0], v[1], v[2], v[3] ?? 1];
}
// shades: [top, middle, bottom] colours down the letters; outline: dark edge colour or null
function pixText(str, px, weight, shades, outline) {
  if (typeof tr === 'function') str = tr(str);   // (LANGUAGE, i18n.js: English passes straight through)
  const key = `${str}|${px}|${weight}|${shades.k || shades.join('/')}|${outline}`;
  let P = PIX.get(key); if (P) return P;
  if (PIX.size > 900) PIX.clear();
  const S = TEXT_RES, fp = px * S, c = document.createElement('canvas'), g = c.getContext('2d'), font = `${weight} ${fp}px ${FONT}`;
  g.font = font; const tw = g.measureText(str).width, pad = 4, w = Math.ceil(tw) + pad * 2, h = Math.ceil(fp * 1.45) + pad * 2;
  c.width = w; c.height = h; g.font = font; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (outline) { g.strokeStyle = outline; g.lineWidth = Math.max(2.4, fp / 6); g.strokeText(str, pad, h / 2); }
  const gr = g.createLinearGradient(0, h / 2 - fp * 0.45, 0, h / 2 + fp * 0.45);
  gr.addColorStop(0, shades[0]); gr.addColorStop(0.5, shades[1]); gr.addColorStop(1, shades[2]);
  g.fillStyle = gr; g.fillText(str, pad, h / 2);
  P = { c, w: tw / S, pad: pad / S, h: h / S }; PIX.set(key, P); return P;   // sizes in game pixels
}
function drawPix(P, x, y, align) {
  const dx = align === 'center' ? x - P.w / 2 : align === 'right' ? x - P.w : x;
  ctx.drawImage(P.c, Math.round((dx - P.pad) * 2) / 2, Math.round((y - P.h / 2) * 2) / 2, P.c.width / TEXT_RES, P.c.height / TEXT_RES);
}
// the colour lifted a little toward white at the top of the letters and deepened at the bottom
const SHADE_MEMO = new Map(), TEXTW_MEMO = new Map();   // (text runs ~150 times a frame: each colour's shades and each label's width are kept)
function shadeOf(col) {
  const hit = SHADE_MEMO.get(col); if (hit) return hit; if (SHADE_MEMO.size > 400) SHADE_MEMO.clear();
  const out = shadeOf0(col); out.k = out.join('/'); SHADE_MEMO.set(col, out); return out;   // (.k: the joined form pixText keys on)
}
function shadeOf0(col) {
  const c = cssRgba(col), mix = (k, t) => `rgba(${c.slice(0, 3).map(v => Math.round(v + (t - v) * k)).join(',')},${c[3]})`;
  return [mix(0.35, 255), col, mix(0.22, 0)];
}
function text(str, x, y, col = '#fff', size = 10, align = 'center', bold = true) {
  drawPix(pixText(String(str), fontPx(size), bold ? 700 : 400, shadeOf(col), 'rgba(16,10,6,0.95)'), x, y, align);
}
function textW(str, size = 10, bold = true) {
  if (typeof tr === 'function') str = tr(str);
  const px = fontPx(size), key = (bold ? 'b' : 'r') + px + FONT.length + '|' + str, hit = TEXTW_MEMO.get(key); if (hit !== undefined) return hit;
  if (TEXTW_MEMO.size > 3000) TEXTW_MEMO.clear();
  ctx.font = `${bold ? 700 : 400} ${px}px ${FONT}`; const v = ctx.measureText(str).width; TEXTW_MEMO.set(key, v); return v;
}
// (LANGUAGE) for code that cuts lines by hand: trSplit translates the string, then splits it into words (Japanese: into
// characters, a run of Latin letters held together), and trSp() is what joins them again: ' ', or '' for Japanese
function trSplit(str) {
  str = typeof tr === 'function' ? tr(String(str)) : String(str);
  return typeof trNoSpaces === 'function' && trNoSpaces() ? (str.match(/[A-Za-z0-9{}%+.'\-]+|[\s\S]/g) || []) : str.split(' ');
}
const trSp = () => (typeof trNoSpaces === 'function' && trNoSpaces() ? '' : ' ');
function wrap(str, maxW, size = 9) {
  if (typeof tr === 'function') str = tr(String(str));
  const out = []; let line = '';
  // (Japanese has no spaces: its lines break between characters, a run of Latin letters or digits held together)
  const cjk = typeof trNoSpaces === 'function' && trNoSpaces(), sep = cjk ? '' : ' ';
  for (const w of cjk ? (str.match(/[A-Za-z0-9{}%+.'\-]+|[\s\S]/g) || []) : str.split(' ')) {
    const t = line ? line + sep + w : w;
    if (textW(t, size, false) > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  if (typeof trLines === 'function') trLines(out);   // (lines cut from a translation are not looked up again)
  return out;
}
function panel(x, y, w, h, border = '#c9a85a', fill = 'rgba(30,20,13,0.92)') {   // (dark cocoa, 2026-11-07: it was navy)
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
}
function bar(x, y, w, h, v, col, back = '#2a1d24') {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, v))), h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, v))), 1);
}
// Zenonia 2 item icons (18×18, 32-column grid, frame = item row) live at 'items' index ITEM2_BASE + row
const ITEM2_BASE = 10000;
D.icons.items2 = { img: 'assets/icons_items2.png', frames: [] };
for (const it of window.ITEMS2 || []) D.icons.items2.frames[it[0]] = [(it[0] % 32) * 18, Math.floor(it[0] / 32) * 18, 18, 18];
// Gold coins (assets/coins.png from tools/build_coins.py): 0-7 the spin of a dropped coin, 8 the shining coin used
// as the coin icon everywhere, 9 a pile of coins (the same art as the gold icon)
D.icons.coins = { img: 'assets/coins.png', frames: Array.from({ length: 10 }, (_, i) => [i * 32, 0, 32, 32]) };
const COIN_ICON = 8;
const coinIcon = (cx, cy, size) => iconCentered('coins', COIN_ICON, cx, cy, size);
// draw an item/skill icon centred on (cx, cy), scaled so its larger side is `size` px (icons differ: Zenonia 1 item
// icons are 8-14 px, Zenonia 2's 18 px). Many frames carry uneven transparent padding, so each icon is measured once
// (iconBox: the box around its visible pixels) and it is that box that sits dead centre in the slot.
const ICON_BOX = {};
function iconBox(b, rec, key) {
  if (ICON_BOX[key]) return ICON_BOX[key];
  const im = img(b.img); if (!im || !im.complete || !im.naturalWidth) return [0, 0, rec[2], rec[3]];
  const c = document.createElement('canvas'); c.width = rec[2]; c.height = rec[3];
  const g = c.getContext('2d'); g.drawImage(im, rec[0], rec[1], rec[2], rec[3], 0, 0, rec[2], rec[3]);
  let d; try { d = g.getImageData(0, 0, rec[2], rec[3]).data; } catch (e) { return (ICON_BOX[key] = [0, 0, rec[2], rec[3]]); }
  let x0 = rec[2], y0 = rec[3], x1 = -1, y1 = -1;
  for (let y = 0; y < rec[3]; y++) for (let x = 0; x < rec[2]; x++) if (d[(y * rec[2] + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return (ICON_BOX[key] = x1 < 0 ? [0, 0, rec[2], rec[3]] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
}
function iconCentered(kind, idx, cx, cy, size) {
  let k = kind, i = idx;
  if (k === 'items' && typeof HOME_BASE !== 'undefined' && i >= HOME_BASE) { k = 'home'; i -= HOME_BASE; }
  else if (k === 'items' && i >= ITEM2_BASE) { k = 'items2'; i -= ITEM2_BASE; }
  const b = D.icons[k], rec = b && b.frames[i];
  if (!rec) return;
  const [bx, by, bw, bh] = iconBox(b, rec, k + ':' + i);
  const s = size / Math.max(14, rec[2], rec[3]), w = bw * s, h = bh * s;   // scale by the frame (sizes stay as before), centre the visible part
  ctx.drawImage(img(b.img), rec[0] + bx, rec[1] + by, bw, bh, Math.round((cx - w / 2) * 2) / 2, Math.round((cy - h / 2) * 2) / 2, w, h);
}
function icon(kind, idx, x, y, scale = 1) {
  if (kind === 'items' && idx >= ITEM2_BASE) { kind = 'items2'; idx -= ITEM2_BASE; scale *= 16 / 18; }
  const b = D.icons[kind];
  const rec = b.frames[idx];
  if (!rec) return;
  ctx.drawImage(img(b.img), rec[0], rec[1], rec[2], rec[3], Math.round(x), Math.round(y), rec[2] * scale, rec[3] * scale);
}

// ---------- rng ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let UID = Date.now() % 100000 * 1000;
const uid = () => 'u' + (UID++).toString(36);

// ---------- save ----------
const SAVE_KEY = 'zenonia_card_hunters_v1';
function saveGame(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ } }
function loadGame() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
