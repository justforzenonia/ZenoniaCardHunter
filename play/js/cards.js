'use strict';
// Card faces: rank-coloured frame, name plate, art window, rank footer and a rank shield badge. The card back is the user's artwork (assets/card_back.png, built by tools/build_card_back.py).

const RANK_STYLE = [
  { title: 'WEAK',      frame: ['#8a7d70', '#5a4e44'], edge: '#3a302a', tag: '#6e6258', tagText: '#e8dcc8', art: ['#4a3e34', '#2a221c'], banner: '#9a8a78', bannerText: '#2a201a', fx: 'rust' },
  { title: 'NOVICE',    frame: ['#c88a58', '#7a4a2a'], edge: '#4a2a16', tag: '#b06a3a', tagText: '#ffe0c0', art: ['#4a3020', '#24160c'], banner: '#d08a5a', bannerText: '#3a1a0a', fx: 'stone' },
  { title: 'COMMON',    frame: ['#c8ccd4', '#6a707c'], edge: '#3a3e48', tag: '#9aa0ac', tagText: '#1a1c22', art: ['#3a3e46', '#1e2026'], banner: '#b8bcc6', bannerText: '#1a1c22', fx: 'steel' },
  { title: 'UNCOMMON',  frame: ['#7ad08a', '#2a6a3a'], edge: '#163a20', tag: '#4aa05a', tagText: '#e8ffe8', art: ['#2a4a30', '#122016'], banner: '#8ad49a', bannerText: '#0e2a14', fx: 'rivets' },
  { title: 'RARE',      frame: ['#6ab0ff', '#1e4ab0'], edge: '#0e2260', tag: '#3a7ae0', tagText: '#e8f4ff', art: ['#1a2a5a', '#0a1028'], banner: '#5a90e8', bannerText: '#08163a', fx: 'sapphire' },
  { title: 'LEGENDARY', frame: ['#ffe080', '#c88a1a'], edge: '#6a3a08', tag: '#ffc83a', tagText: '#5a1a00', art: ['#6a1a14', '#2a0806'], banner: '#ffcf5a', bannerText: '#5a1a00', fx: 'fire' },
  { title: 'MYTHIC',    frame: ['#9a6ad8', '#3a1e6a'], edge: '#1a0a36', tag: '#6a3ab0', tagText: '#f0e0ff', art: ['#2a1a50', '#0e0820'], banner: '#7a4ac8', bannerText: '#f0e0ff', fx: 'stars' },
  { title: 'ASCENDED',  frame: ['#f0e0ff', '#9a6ad8'], edge: '#4a2a7a', tag: '#d0b0ff', tagText: '#3a1a6a', art: ['#4a2a7a', '#1a0e36'], banner: '#c8a8f8', bannerText: '#2a0e5a', fx: 'feathers' },
  { title: 'DIVINE',    frame: ['#ffd45a', '#5a2a9a'], edge: '#2a0e4a', tag: '#3a1a6a', tagText: '#ffd45a', art: ['#2a1450', '#0a0418'], banner: '#4a2280', bannerText: '#ffd45a', fx: 'cosmic' },
  { title: 'APEX MYTHIC', frame: null, edge: '#1a1030', tag: '#ffffff', tagText: null, art: ['#2a1a50', '#0a0620'], banner: null, bannerText: '#ffffff', fx: 'prism' },
];

const holo = (now, k = 0) => `hsl(${(now / 5 + k * 40) % 360},100%,68%)`;
function holoGrad(x, y, w, h, now) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(now / 5 + i * 60) % 360},95%,${i % 2 ? 72 : 60}%)`);
  return g;
}
function cardRR(x, y, w, h, r) { rrect(ctx, x, y, w, h, r); }

// Shared sparkle (4-point gleam)
function gleam(x, y, s, col, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.22, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.22, y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x, y + s * 0.22); ctx.lineTo(x + s, y); ctx.lineTo(x, y - s * 0.22); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- front
// A clean, static card face: a metal frame in the rank colour, a name plate, the monster standing in an
// element-lit window, the rank title with rank pips, and a shield badge with the rank letter.
// Nothing on the face moves; rarity reads from colour, badge, pips and (A and up) a steady glow.
const PRISM = ['#ff6a6a', '#ffb84a', '#fff06a', '#6aff8a', '#5ac8ff', '#8a6aff', '#ff6ad8'];
const rankSolid = t => RANK_COL[t] === 'rainbow' ? '#e8e0ff' : RANK_COL[t];
function prismGrad(x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  PRISM.forEach((c, i) => g.addColorStop(i / (PRISM.length - 1), c));
  return g;
}
function shade(hex, k) {   // k > 0 lightens toward white, k < 0 darkens
  const n = parseInt(hex.slice(1), 16), f = v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

const EL_GLYPH = { fire: '✹', ice: '❄', lightning: '⚡', earth: '◆', wind: '≋', dark: '☾', poison: '☣', holy: '✚' };
const CARD_ASPECT = 0.72;
function cardFit(x, y, w, h) {   // the card keeps its proportions inside the given box
  let cw = w, ch = w / CARD_ASPECT;
  if (ch > h) { ch = h; cw = h * CARD_ASPECT; }
  return { x: x + (w - cw) / 2, y: y + (h - ch) / 2, w: cw, h: ch };
}
// text shrunk to fit a width (never below `min`)
// card display fonts: Impact for numbers and rank letters (trading-card stat look), Bahnschrift for names and labels
const CARD_NUM = 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif';
const CARD_TITLE = 'Bahnschrift, "Segoe UI", sans-serif';
function fitText(str, cx, cy, maxW, size, col, min = 3.6, weight = 800, align = 'center', stroke = true, family = FONT) {
  // card text may go smaller than the UI font's 8 px floor (the canvas is drawn at 2x, so 4 px stays crisp)
  const px = v => v * 1.1;
  let s = size;
  ctx.font = `${weight} ${px(s)}px ${family}`;
  while (s > min && ctx.measureText(str).width > maxW) { s -= 0.25; ctx.font = `${weight} ${px(s)}px ${family}`; }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.8, px(s) / 4.5); ctx.strokeStyle = 'rgba(6,4,12,0.9)'; ctx.strokeText(str, cx, cy); }
  ctx.fillStyle = col; ctx.fillText(str, cx, cy);
}
function cardElement(c) {
  if (c.fusion) { const sp = fusionSpells(c)[0]; return sp ? sp.el : 'holy'; }
  return cardSpell(c).el;
}
// Card face after the Digimon TCG look: FULL-ART and colour-themed by the card's element.
//   • the monster fills the card, huge and outlined in white, over a burst of light, speed lines and bold energy
//     slashes in the element's colour that run right out to the edges
//   • top-left: a round emblem with the rank letter, and under it a gold MP medallion on a side tab
//   • top-right: the POWER in gold Impact numerals on an angled stat plate; top-centre: a type pill
//   • a translucent effect band with dark pill labels for the passives, a bold name bar in the element colour
//     (rank block on the left, card number and rarity on the right), and a light spell panel at the foot
//   • rank shows in the emblem, the stars, the frame (silver → gold → violet → prism) and, from A up, a foil sheen
// Smaller cards keep the full art, emblem, power and name bar and drop the text panels.
// The name's metal climbs with the rank: stone F, copper E, silver D, emerald C, sapphire B, gold A, amethyst S,
// pearl-crystal SS, divine gold on violet SSS, and a living prism for SSS+. [top, middle, bottom, outline, depth]
const NAME_METAL = [
  ['#f0f0f0', '#b4b4b4', '#707070', '#262626', '#121212'],
  ['#ffe2c8', '#e0905c', '#8a4620', '#3a1606', '#200a02'],
  ['#ffffff', '#ccd4e0', '#7a8496', '#20242e', '#0e1016'],
  ['#ecffec', '#5ede70', '#1a7a2c', '#0a2a10', '#041406'],
  ['#ecf6ff', '#52a2ff', '#1a3cae', '#08143c', '#040a20'],
  ['#fffbe2', '#ffd446', '#c47a0e', '#4a2000', '#2a1000'],
  ['#faeaff', '#bc7cff', '#5a28b4', '#1e0a42', '#100422'],
  ['#ffffff', '#e4d6ff', '#9c7ede', '#3a2a6c', '#1e1440'],
  ['#ffffff', '#ffe474', '#e0a01c', '#3a0e6c', '#220648'],
  null,
];
function cardNameText(str, cx, cy, maxW, size, t, now) {
  ctx.save();
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * (size < 6 ? 0.02 : 0.06) * RES}px`;
  let fs = size;
  const set = () => { ctx.font = `700 ${fs * 1.1}px ${CARD_TITLE}`; };
  set(); while (fs > 3.4 && ctx.measureText(str).width > maxW) { fs -= 0.2; set(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillText(str, cx + fs * 0.06, cy + fs * 0.12);   // soft drop
  ctx.lineWidth = Math.max(1, fs * 0.26); ctx.strokeStyle = '#04030a'; ctx.strokeText(str, cx, cy);
  const NM = NAME_METAL[t], half = ctx.measureText(str).width / 2;
  let g;
  if (!NM) { g = ctx.createLinearGradient(cx - half, 0, cx + half, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(now / 6 + i * 55) % 360},100%,${i % 2 ? 80 : 70}%)`); }
  else { g = ctx.createLinearGradient(0, cy - fs * 0.5, 0, cy + fs * 0.5); g.addColorStop(0, NM[0]); g.addColorStop(0.55, NM[1]); g.addColorStop(1, shade(NM[1].length === 7 ? NM[1] : '#ffffff', -0.12)); }
  ctx.fillStyle = g; ctx.fillText(str, cx, cy);
  ctx.restore();
}
const EL_THEME = {   // card colour per element: [main, light, dark]
  fire: ['#ff6a2a', '#ffd0a0', '#7a1a04'], ice: ['#4ab8ff', '#d8f2ff', '#0a3a7a'], lightning: ['#ffd21a', '#fff6b0', '#7a5a00'],
  earth: ['#c8843a', '#f4dcb0', '#5a2e0a'], wind: ['#3ad88a', '#d0ffe4', '#0a5a30'], dark: ['#9a5ae8', '#e8d0ff', '#2a0a5a'],
  poison: ['#7ad83a', '#e4ffc8', '#2a5a0a'], holy: ['#ffe28a', '#fffbe8', '#8a6a1a'],
};
// THE TRADING-CARD FRAMES (assets/card_frame_*.png, cut from the user's artwork; laid out like a TCG monster card):
// one frame per rarity — worn iron (F–D), steel (C–B), gold and crimson (A–S), obsidian and gold (SS–SSS+). Every
// slot is measured in the frame's own 230 × 347 pixels; the card's monster, name, element, rank, spell, passives and
// stats are laid into them. Used for the larger cards (the info popup, the summon reveal, fusion); small icons keep
// the compact card.
const CARD_FRAMES = [
  { src: 'assets/card_frame_common.png', ink: '#2a2014', soft: '#3e2f1c', line: 'rgba(60,40,20,0.35)' },
  { src: 'assets/card_frame_rare.png',   ink: '#eef2f8', soft: '#b8c4d4', line: 'rgba(220,230,245,0.25)' },
  { src: 'assets/card_frame_epic.png',   ink: '#fff2d8', soft: '#e8d0a0', line: 'rgba(255,230,180,0.25)' },
  { src: 'assets/card_frame_legend.png', ink: '#f4ecff', soft: '#c8b8e8', line: 'rgba(220,200,255,0.25)' },
];
const CF = { W: 230, H: 347, name: [26, 17, 178, 39], orb: [199, 29, 15], rank: [124, 44, 210, 52], art: [57, 65, 173, 179], type: [24, 194, 208, 206], fx: [24, 213, 206, 296], fx2: [24, 296, 140, 326], pow: [146, 300, 177, 312], mp: [180, 300, 211, 312], cd: [146, 315, 211, 327] };
// small card text: the game's text never draws below 8 px, so smaller sizes are drawn at 8 and scaled down
// (ct draws, ctw measures — both true to the size asked for)
const ctw = (str, size, bold = true) => size >= 7.3 ? textW(str, size, bold) : textW(str, 8, bold) * size / 8;
function ct(str, x, y, col, size, align = 'center', bold = true) {
  if (size >= 7.3) return text(str, x, y, col, size, align, bold);
  const s = size / 8; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); text(str, 0, 0, col, 8, align, bold); ctx.restore();
}
// dark words on the common frame's tan box: no outline, which would clog them
function cardInk(str, x, y, col, size) {
  if (size >= 7.3) { drawPix(pixText(String(str), fontPx(size), 700, [col, col, col], null), x, y, 'left'); return; }
  const s = size / 8; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawPix(pixText(String(str), fontPx(8), 700, [col, col, col], null), 0, 0, 'left'); ctx.restore();
}
const fitSize = (str, maxW, size, min = 2.8) => { let f = size; while (f > min && ctw(str, f) > maxW) f -= 0.2; return f; };   // the largest size that fits
const cardFrameOf = t => CARD_FRAMES[t >= 7 ? 3 : t >= 5 ? 2 : t >= 3 ? 1 : 0];
function wrapLines(str, maxW, size, bold = false) {   // split text into lines that fit maxW (measured in the weight it will be drawn in)
  const words = trSplit(str), sp = trSp(), out = []; let line = '';
  for (const wd of words) { const tryL = line ? line + sp + wd : wd; if (ctw(tryL, size, bold) > maxW && line) { out.push(line); line = wd; } else line = tryL; }
  if (line) out.push(line); return out;
}
const CARD_STILL = 900;
function drawCardFrameArt(c, x0, y0, w0, h0, now, opt) {
  const F = cardFrameOf(c.tier), im = img(F.src); if (!im || !im.complete || !im.naturalWidth) return false;
  let w = w0, h = w0 * CF.H / CF.W; if (h > h0) { h = h0; w = h0 * CF.W / CF.H; }
  const x = x0 + (w0 - w) / 2, y = y0 + (h0 - h) / 2, k = w / CF.W, B = r => [x + r[0] * k, y + r[1] * k, (r[2] - r[0]) * k, (r[3] - r[1]) * k];
  const t = c.tier, el = cardElement(c), E = EL_THEME[el] || EL_THEME.holy, sp = c.fusion ? null : cardSpell(c), pow = c.fusion ? fusionPower(c) : spellPow(sp);
  const detail = w >= 100, col = rankColor(t, now), solid = col[0] === '#' ? col : rankSolid(t);
  ctx.save();
  if (opt.dim) ctx.globalAlpha = 0.45;
  // the frame, glowing in its rank's colour from A up (and white when picked)
  ctx.save(); ctx.shadowColor = opt.sel ? 'rgba(255,255,255,0.9)' : t >= 5 ? (t === 9 ? holo(now) : solid) : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = (opt.sel ? 8 : t >= 5 ? 5 + (t - 5) * 1.5 : 3) * RES; ctx.shadowOffsetY = opt.sel || t >= 5 ? 0 : 1.5 * RES;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, x, y, w, h); ctx.restore();
  // the art window: the element's light behind the monster
  { const [ax, ay, aw, ah] = B(CF.art);
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
    const bg = ctx.createRadialGradient(ax + aw / 2, ay + ah * 0.45, aw * 0.05, ax + aw / 2, ay + ah / 2, aw * 0.75); bg.addColorStop(0, E[1]); bg.addColorStop(0.45, E[0]); bg.addColorStop(1, E[2]);
    ctx.globalAlpha = (opt.dim ? 0.45 : 1) * 0.9; ctx.fillStyle = bg; ctx.fillRect(ax, ay, aw, ah); ctx.globalAlpha = opt.dim ? 0.45 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(ax + aw / 2, ay + ah * 0.86, aw * 0.3, ah * 0.06, 0, 0, Math.PI * 2); ctx.fill();   // the ground it stands on
    if (c.fusion) { const parts = c.fusion.slice(0, 3); parts.forEach((q, i) => monsterPreview(cardIconSpecies(q), ax + i * aw / parts.length, ay + ah * 0.08, aw / parts.length, ah * 0.84, q.tier, now, 'idle', 3)); }
    else monsterPreview(c.sp, ax + aw * 0.06, ay + ah * 0.05, aw * 0.88, ah * 0.86, t, now, 'idle', 3);
    if (t === 9) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18; ctx.fillStyle = holo(now); ctx.fillRect(ax, ay, aw, ah); }   // SSS+: a holographic sheen
    ctx.restore(); }
  // the name, in the card-title lettering, on its bar (opt.bare: none of the card's words, for a card too small to read them)
  if (!opt.bare) { const [, ny, , nh] = B(CF.name), mid = x + w / 2, room = (x + (CF.name[2] - 2) * k - mid) * 2; cardNameText(cardName(c), mid, ny + nh / 2, room, Math.max(4.5, 15 * k), t, now); }   // centred on the card (in line with the art), clear of the orb
  // the element orb (none on a bare card, the user: "remove the element from top right of card")
  if (!opt.bare) { const ox = x + CF.orb[0] * k, oy = y + CF.orb[1] * k, orr = CF.orb[2] * k;
    const g = ctx.createRadialGradient(ox - orr * 0.35, oy - orr * 0.4, 0.5, ox, oy, orr); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, E[0]); g.addColorStop(1, E[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, orr * 0.86, 0, Math.PI * 2); ctx.fill();
    ct(c.fusion ? '✦' : EL_GLYPH[el] || '•', ox, oy + 0.4, '#ffffff', Math.max(4, 15 * k)); }
  // the rank strip: the rank in its colour, set right
  // (opt.noRank: no rank, for the cards flying from the fusion circle, layerswords.js)
  if (!opt.noRank && !opt.bare) { const [rx, ry, rw, rh] = B(CF.rank), str = `RANK ${RANKS[t]}`; ct(str, rx + rw - 12 * k, ry + rh / 2, col, fitSize(str, rw * 0.55, Math.min(rh * 0.95, 8 * k)), 'right'); }   // inside the strip, clear of the frame
  // the type line: [ element ] and the spell's name
  if (!opt.bare) { const [tx, ty, tw, th] = B(CF.type), base = Math.max(3.4, 7.6 * k);
    let line = c.fusion ? `[ FUSION · ${c.fusion.length} cards ]` : `[ ${ELEMENTS[sp.el].name} / ${sp.sup ? sp.sup.label : ARCH[sp.arch].name} ]  ${sp.name}`;
    if (sp && ctw(line, 3.6) > tw - 8 * k) line = `[ ${ELEMENTS[sp.el].name} ] ${sp.name}`;   // too long even small: drop the spell's kind
    ct(line, tx + 4 * k, ty + th / 2 + 0.3, F.ink === '#2a2014' ? '#f0e8d8' : F.ink, fitSize(line, tw - 8 * k, base), 'left'); }
  // the effect box: the spell, then each passive, wrapped to fit (only on the larger cards)
  if (detail && !opt.bare) {
    // a card with many passives shows them short (the effect alone, in the bright ink) in bigger type; Details has the rest
    const pvs = cardPassives(c), many = pvs.length >= 3, short = sp && (sp.sup ? `${sp.name}: ${sp.desc}.` : SPECIES[c.sp].spell.short);
    const [fx, fy, fw] = B(CF.fx), [, , f2w] = B(CF.fx2), sz = Math.max(many ? 5.6 : 4, 9 * k), lh = sz * 1.25, tan = F.ink === '#2a2014'; let ly = fy + 4 * k + sz / 2;
    const bottom = y + CF.fx2[3] * k - sz / 2, put = (str, colr, indent = 0) => {
      for (const L of wrapLines(str, (ly > y + CF.fx[3] * k ? f2w : fw) - 10 * k - indent, sz, tan)) { if (ly > bottom) return; if (tan) cardInk(L, fx + 4 * k + indent, ly, colr, sz); else ct(L, fx + 4 * k + indent, ly, colr, sz, 'left', false); ly += lh; }   // (the tan box's ink is bold: measured bold, or lines ran off the box)
    };
    if (sp) { put(short || `${sp.name}: ${sp.formText || `${cap(ARCH[sp.arch].desc)}.`}${sp.desc ? ' ' + sp.desc + '.' : ''}`, F.ink); ly += lh * 0.25; }
    ctx.fillStyle = F.line; ctx.fillRect(fx + 4 * k, ly - lh * 0.6, fw - 8 * k, Math.max(0.6, k * 0.8));
    for (const pv of pvs) { const fxt = PASSIVES[pv.id].fmt(passiveValue(pv.id, pv.tier) * (pv.mul || 1)); put(many ? `◆ ${fxt}` : `◆ ${passiveName(pv)} — ${fxt}`, many ? F.ink : F.soft, 0); }
  }
  // the stat plate: power, MP, and the cooldown
  if (!opt.bare) { const st = (r, str, colr) => { const [sx, sy, sw, sh] = B(r); ct(str, sx + sw / 2, sy + sh / 2 + 0.3, colr, Math.max(3.6, 8 * k)); };
    st(CF.pow, sp && sp.stat ? pow : `⚔${pow}`, '#ffe2b0'); st(CF.mp, c.fusion ? 'FUSE' : `💧${sp.mp}`, '#c8ecff'); if (sp) st(CF.cd, `CD ${(sp.cd / 1000).toFixed(1)}s`, '#e0e0e8'); }
  if (opt.badge) { const gx = x + w - 10 * k, gy = y + 10 * k; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(gx, gy, Math.max(4, 8 * k), 0, Math.PI * 2); ctx.fill(); ct(opt.badge, gx, gy + 0.3, '#2a1404', Math.max(4, 8 * k)); }
  ctx.restore();
  return true;
}
function drawCardFront(c, x0, y0, w0, h0, now, opt = {}) {
  now = CARD_STILL;   // every card is a still image: glow, sheen, sprite and rainbow rank held at one moment
  if (w0 < 70 || opt.small) { drawTFCard(c, x0, y0, w0, h0, now, opt); return; }   // every small card, on every screen, wears the mini frame
  if (drawCardFrameArt(c, x0, y0, w0, h0, now, opt)) { if (c.sun) drawSunRim(x0, y0, w0, h0, CF.H / CF.W); return; }   // the trading-card frame on the larger cards
  const t = c.tier, S = RANK_STYLE[t], { x, y, w, h } = cardFit(x0, y0, w0, h0);
  const u = w / 100, small = w < 70, tiny = w < 46, detail = !!opt.detail && h > 150;
  const el = cardElement(c), E = EL_THEME[el] || EL_THEME.holy, [ec, el2, ed] = E, prism = t === 9;
  const R = Math.max(2, 4.5 * u), sp = c.fusion ? null : cardSpell(c), pow = c.fusion ? fusionPower(c) : spellPow(sp);
  ctx.save();
  // ---- outer glow / shadow
  ctx.save();
  ctx.shadowColor = opt.sel ? 'rgba(255,255,255,0.95)' : t >= 5 ? (prism ? holo(now) : rankSolid(t)) : 'rgba(10,4,0,0.65)';
  ctx.shadowBlur = (opt.sel ? 8 : t >= 5 ? 5 + (t - 5) * 1.6 : 3) * RES; ctx.shadowOffsetY = (opt.sel || t >= 5 ? 0 : 1.5) * RES;
  ctx.fillStyle = ed; cardRR(x, y, w, h, R); ctx.fill();
  ctx.restore();
  ctx.save(); cardRR(x, y, w, h, R); ctx.clip();
  // ---- full-art background: element light burst, speed lines, energy slashes
  const cx = x + w * 0.52, cy = y + h * 0.36;
  const bg = ctx.createRadialGradient(cx, cy, 1, cx, cy, h * 0.8);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.12, el2); bg.addColorStop(0.45, ec); bg.addColorStop(1, ed);
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 28; i++) {   // speed lines radiating from the burst
    const a = i * Math.PI * 2 / 28 + (i % 3) * 0.04, len = h * (0.9 + (i % 4) * 0.1), wd = (i % 2 ? 0.012 : 0.025) * len;
    ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.18)' : hexA(el2, 0.35);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * w * 0.12, Math.sin(a) * w * 0.12);
    ctx.lineTo(Math.cos(a - wd / len) * len, Math.sin(a - wd / len) * len); ctx.lineTo(Math.cos(a + wd / len) * len, Math.sin(a + wd / len) * len); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';   // bold diagonal energy slashes
  for (const [px, py, len, th, a] of [[0.15, 0.55, 1.1, 0.07, -0.55], [0.7, 0.2, 0.9, 0.045, -0.55], [0.85, 0.6, 0.8, 0.03, -0.55]]) {
    ctx.save(); ctx.translate(x + px * w, y + py * h); ctx.rotate(a);
    const sg = ctx.createLinearGradient(-len * w / 2, 0, len * w / 2, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-len * w / 2, 0); ctx.lineTo(len * w / 2, -th * w); ctx.lineTo(len * w / 2, th * w * 0.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // ---- the monster, huge, outlined in white with a drop shadow
  const mTop = y + h * (small ? 0.1 : 0.11), mH = h * (small ? 0.5 : detail ? 0.4 : 0.5);
  ctx.save();
  ctx.filter = `drop-shadow(0 0 ${Math.max(0.6, 1 * u)}px #ffffff) drop-shadow(0 0 ${Math.max(0.4, 0.6 * u)}px #ffffff) drop-shadow(${1.4 * u}px ${2 * u}px ${1.5 * u}px rgba(0,0,0,0.55))`;
  if (c.fusion) {
    const parts = c.fusion.slice(0, 3);
    parts.forEach((p, i) => monsterPreview(cardIconSpecies(p), x + w * 0.04 + i * w * 0.92 / parts.length, mTop + mH * 0.08, w * 0.92 / parts.length, mH * 0.9, p.tier, 0, 'idle', 8));
  } else monsterPreview(c.sp, x + w * 0.06, mTop, w * 0.88, mH, t, 0, 'idle', 8);
  ctx.restore();
  // foil + sparkles for high ranks
  if (t >= 5) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(x, y, x + w, y + h);
    fg.addColorStop(0.2, 'rgba(255,255,255,0)'); fg.addColorStop(0.38, prism ? 'rgba(255,140,255,0.2)' : 'rgba(255,255,255,0.14)');
    fg.addColorStop(0.46, 'rgba(140,230,255,0.2)'); fg.addColorStop(0.54, 'rgba(255,240,150,0.16)'); fg.addColorStop(0.7, 'rgba(255,255,255,0)');
    ctx.fillStyle = fg; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  if (t >= 7) { const r = rng(t * 31 + (c.sp ? parseInt(c.sp, 10) || 7 : 7)); for (let i = 0; i < 8; i++) gleam(x + r() * w, y + r() * h * 0.6, Math.max(1, (1.4 + r() * 2.2) * u), '#ffffff', 0.9); }
  // ---- top-left: rank emblem + MP medallion on a side tab
  const er = Math.max(4, 10 * u), ex = x + er + 2.2 * u, ey = y + er + 2.2 * u;
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, er + 1.2 * u, 0, Math.PI * 2); ctx.fill();
  const rg = ctx.createLinearGradient(0, ey - er, 0, ey + er); rg.addColorStop(0, el2); rg.addColorStop(1, ec);
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0e1a3a'; ctx.beginPath(); ctx.arc(ex, ey, er * 0.74, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = prism ? holo(now) : '#ffd860'; ctx.lineWidth = Math.max(0.6, 1 * u); ctx.beginPath(); ctx.arc(ex, ey, er * 0.74, 0, Math.PI * 2); ctx.stroke();
  fitText(RANKS[t], ex, ey + 0.6, er * 1.3, Math.max(4.4, er * 1.05), prism ? holo(now) : '#ffd860', 3, 400, 'center', true, CARD_NUM);
  if (sp && !tiny) {
    const mx = x + 9 * u, my = ey + er + 10 * u, mr = Math.max(3.4, 7 * u);
    ctx.fillStyle = 'rgba(14,26,58,0.88)'; ctx.beginPath(); ctx.moveTo(x, my - mr - 1.5 * u); ctx.lineTo(mx + mr * 0.4, my - mr - 1.5 * u); ctx.arc(mx, my, mr + 1.5 * u, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x, my + mr + 1.5 * u); ctx.closePath(); ctx.fill();
    const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0.3, mx, my, mr);
    mg.addColorStop(0, '#fff6c8'); mg.addColorStop(0.5, '#ffd23f'); mg.addColorStop(1, '#a8661c');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.5, 0.7 * u); ctx.stroke();
    fitText(String(sp.mp), mx, my + 0.6, mr * 1.6, Math.max(4, mr * 1.25), '#2a1400', 3, 400, 'center', false, CARD_NUM);
    if (!small) fitText('MP', mx, my + mr + 3.6 * u, 10 * u, 4.6 * u, '#ffffff', 3, 700, 'center', true, CARD_TITLE);
  }
  // ---- top-right: POWER on an angled stat plate (gold Impact numerals, label running down its right edge)
  {
    const pTxt = String(pow), py0 = y + 2.6 * u, ph = tiny ? 13 * u : 17 * u, pr = x + w - 2.6 * u;
    const pw = Math.max(16 * u, (pTxt.length * (tiny ? 9 : 8.6) + (small ? 6 : 13)) * u), pl = pr - pw;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(pl + 4 * u, py0); ctx.lineTo(pr, py0); ctx.lineTo(pr, py0 + ph); ctx.lineTo(pl, py0 + ph); ctx.closePath();
    const plg = ctx.createLinearGradient(0, py0, 0, py0 + ph); plg.addColorStop(0, 'rgba(26,30,58,0.95)'); plg.addColorStop(1, 'rgba(8,10,24,0.95)');
    ctx.fillStyle = plg; ctx.fill();
    ctx.strokeStyle = '#ffd860'; ctx.lineWidth = Math.max(0.5, 0.7 * u); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(pl + 4 * u, py0 + 0.8 * u, pw - 4 * u, Math.max(0.5, 0.6 * u));
    const labW = 0, ncx = pl + 2 * u + (pw - labW - 2 * u) / 2, ncy = py0 + ph / 2 + 0.6;
    const ps = ph * 0.86;
    ctx.font = `400 ${ps * 1.1}px ${CARD_NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = ps; while (fs > 3 && ctx.measureText(pTxt).width > pw - labW - 5 * u) { fs -= 0.25; ctx.font = `400 ${fs * 1.1}px ${CARD_NUM}`; }
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, fs * 0.22); ctx.strokeStyle = '#1a0c00'; ctx.strokeText(pTxt, ncx, ncy);
    const ng = ctx.createLinearGradient(0, ncy - fs * 0.55, 0, ncy + fs * 0.55);
    ng.addColorStop(0, '#fff7c8'); ng.addColorStop(0.42, '#ffd23f'); ng.addColorStop(0.58, '#e8920e'); ng.addColorStop(1, '#ffe48a');
    ctx.fillStyle = ng; ctx.fillText(pTxt, ncx, ncy);
    if (!small) {   // a "POWER" tab under the plate
      ctx.fillStyle = 'rgba(8,10,24,0.95)'; cardRR(pr - 22 * u, py0 + ph - 0.5, 22 * u, 6.6 * u, 2 * u); ctx.fill();
      fitText('POWER', pr - 11 * u, py0 + ph + 3 * u, 20 * u, 4.8 * u, '#ffd860', 3, 700, 'center', false, CARD_TITLE);
    }
    ctx.restore();
  }
  if (!small) {   // type pill
    const tl = c.fusion ? 'FUSION' : `${EL_GLYPH[el] || ''} ${ELEMENTS[el].name.toUpperCase()}`;
    ctx.fillStyle = ed; cardRR(x + w * 0.25, y + 3 * u, w * 0.3, 8 * u, 4 * u); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.5, 0.7 * u); cardRR(x + w * 0.25, y + 3 * u, w * 0.3, 8 * u, 4 * u); ctx.stroke();
    fitText(tl, x + w * 0.4, y + 7.1 * u, w * 0.26, 5.4 * u, '#ffffff', 3, 700, 'center', false, CARD_TITLE);
  }
  // ---- effect band (passives) over the art
  let yy = y + h * (detail ? 0.52 : 0.62);
  const nameY = y + h * 0.715;
  if (!small) {
    const bandH = nameY - yy - 1.5 * u;
    ctx.fillStyle = 'rgba(10,14,40,0.72)'; ctx.fillRect(x, yy, w, bandH);
    ctx.fillStyle = hexA(el2, 0.5); ctx.fillRect(x, yy, w, Math.max(0.5, 0.6 * u));
    const pv = cardPassives(c).slice(0, detail ? (c.fusion ? 5 : 3) : c.fusion ? 2 : 1);   // (a fusion card lists all of its merged passives in detail)
    let ly = yy + 4.5 * u;
    for (const p of pv) {
      const nm = passiveName(p), pw2 = Math.min(w * 0.42, (nm.length * 3.1 + 6) * u);
      ctx.fillStyle = '#1e3a8a'; cardRR(x + 3 * u, ly - 3.2 * u, pw2, 6.4 * u, 3.2 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(0.4, 0.5 * u); cardRR(x + 3 * u, ly - 3.2 * u, pw2, 6.4 * u, 3.2 * u); ctx.stroke();
      fitText(nm, x + 3 * u + pw2 / 2, ly + 0.3, pw2 - 3 * u, 4.9 * u, '#ffffff', 3, 700, 'center', false, CARD_TITLE);
      fitText(PASSIVES[p.id].fmt(passiveValue(p.id, p.tier) * (p.mul || 1)), x + 5 * u + pw2, ly + 0.2, w - pw2 - 9 * u, 4.8 * u, '#ffffff', 3, 700, 'left');
      ly += 8 * u;
    }
  }
  // ---- name bar: a dark band edged in the element colour, the name in clean bold capitals whose colour climbs
  // with the rank (prism for SSS+). Small cards wrap a two-word name onto two lines so it stays readable.
  const nameStr = cardName(c).toUpperCase(), words = nameStr.split(' ');
  const footH = small ? Math.max(6, 9 * u) : 0;
  const nLines = small && words.length > 1 && w < 60 ? 2 : 1;
  const nfs = small ? Math.max(4.6, 7.5 * u) : Math.max(5, 8.4 * u);
  const nh = small ? nfs * 1.15 * nLines + 3 : Math.max(8, 12 * u);
  const nY = small ? y + h - footH - nh : nameY;
  const nb = ctx.createLinearGradient(0, nY, 0, nY + nh); nb.addColorStop(0, '#221c3a'); nb.addColorStop(1, '#08060f');
  ctx.fillStyle = nb; ctx.fillRect(x, nY, w, nh);
  const ng2 = ctx.createRadialGradient(x + w / 2, nY + nh / 2, 1, x + w / 2, nY + nh / 2, w * 0.5);
  ng2.addColorStop(0, hexA(ec, 0.35)); ng2.addColorStop(1, hexA(ec, 0));
  ctx.fillStyle = ng2; ctx.fillRect(x, nY, w, nh);
  ctx.fillStyle = ec; ctx.fillRect(x, nY, w, Math.max(0.6, 0.9 * u)); ctx.fillRect(x, nY + nh - Math.max(0.6, 0.9 * u), w, Math.max(0.6, 0.9 * u));
  const lines = nLines === 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [nameStr];
  lines.forEach((ln, i) => cardNameText(ln, x + w / 2, nY + nh / 2 + (i - (lines.length - 1) / 2) * nfs * 1.12 + 0.3, w - (small ? 3 : 8 * u), nfs, t, now));
  // ---- spell panel at the foot
  const sy = nY + nh;
  if (!small) {
    const sg = ctx.createLinearGradient(0, sy, 0, y + h); sg.addColorStop(0, '#fbf8ff'); sg.addColorStop(1, shade(el2, -0.04));
    ctx.fillStyle = sg; ctx.fillRect(x, sy, w, y + h - sy);
    const lab = c.fusion ? 'FUSION' : 'SPELL';
    ctx.fillStyle = ed; cardRR(x + 3 * u, sy + 2.6 * u, 17 * u, 7 * u, 3.5 * u); ctx.fill();
    fitText(lab, x + 11.5 * u, sy + 6.2 * u, 15 * u, 5 * u, '#ffffff', 3, 700, 'center', false, CARD_TITLE);
    fitText(c.fusion ? `${c.fusion.length}-monster fusion` : sp.name, x + 23 * u, sy + 6.3 * u, w - 27 * u, 7.4 * u, ed, 3.5, 700, 'left', false, CARD_TITLE);
    const ink = '#1c1a2c';
    if (c.fusion) {
      fitText(`Power ${pow} · every monster attacks in turn`, x + 4 * u, sy + 14 * u, w - 8 * u, 5.2 * u, ink, 3.4, 700, 'left', false, CARD_TITLE);
      fitText('then a finishing blast', x + 4 * u, sy + 20.5 * u, w - 8 * u, 5.2 * u, ink, 3.4, 700, 'left', false, CARD_TITLE);
    } else {
      const E2 = ELEMENTS[sp.el];
      fitText(`${ARCH[sp.arch].name} · ${E2.name} · ${(sp.cd / 1000).toFixed(1)}s cooldown`, x + 4 * u, sy + 14 * u, w - 8 * u, 5.2 * u, ink, 3.4, 700, 'left', false, CARD_TITLE);
      if (detail) fitText(sp.desc || cap(E2.desc), x + 4 * u, sy + 20.5 * u, w - 8 * u, 5 * u, shade(ed, 0.1), 3, 600, 'left', false, CARD_TITLE);
    }
  } else {   // small cards: power and MP at the foot
    ctx.fillStyle = '#08060f'; ctx.fillRect(x, sy, w, y + h - sy);
    const fy = sy + (y + h - sy) / 2 + 0.3, fs = Math.max(4.2, 6.4 * u);
    if (sp) {
      fitText(`${pow}`, x + w * 0.3, fy, w * 0.5, fs, '#ffd23f', 3.4, 400, 'center', false, CARD_NUM);
      fitText(`${sp.mp} MP`, x + w * 0.74, fy, w * 0.44, fs * 0.9, '#9fd8ff', 3.4, 700, 'center', false, CARD_TITLE);
    } else fitText(`${pow}`, x + w / 2, fy, w - 4, fs, '#ffd23f', 3.4, 400, 'center', false, CARD_NUM);
  }
  ctx.restore();   // end clip
  // ---- frame: rank metal edge with a white inner line (prism for SSS+)
  let fm;
  if (prism) fm = holoGrad(x, y, w, h, now);
  else { fm = ctx.createLinearGradient(x, y, x + w, y + h); fm.addColorStop(0, shade(S.frame[0], 0.5)); fm.addColorStop(0.5, S.frame[0]); fm.addColorStop(1, S.frame[1]); }
  ctx.strokeStyle = fm; ctx.lineWidth = Math.max(1.2, 2.6 * u); cardRR(x + 1.2 * u, y + 1.2 * u, w - 2.4 * u, h - 2.4 * u, R); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(0.4, 0.5 * u); cardRR(x + 2.8 * u, y + 2.8 * u, w - 5.6 * u, h - 5.6 * u, R * 0.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = Math.max(0.5, 0.6 * u); cardRR(x + 0.3, y + 0.3, w - 0.6, h - 0.6, R); ctx.stroke();
  // ---- badges and states
  if (opt.badge) {
    const qx = x + w - 6 * u - 2, qy = nameY - 6 * u - 2, qr = Math.max(3.6, 6 * u);
    ctx.fillStyle = '#120a1e'; ctx.beginPath(); ctx.arc(qx, qy, qr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.8; ctx.stroke();
    fitText(opt.badge, qx, qy + 0.3, qr * 1.6, Math.max(4, qr * 1.1), '#ffd23f', 3.4);
  }
  if (opt.sel) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; cardRR(x - 1, y - 1, w + 2, h + 2, R + 1); ctx.stroke(); }
  if (opt.dim) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; cardRR(x, y, w, h, R); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- back
const CARD_BACK = D.cardBack = 'assets/card_back.png';   // in D so it is preloaded with the other art
function drawCardBack(x, y, w, h, now, opt = {}) {
  const im = img(CARD_BACK);
  ctx.save();
  if (opt.glow) { ctx.shadowColor = opt.glow; ctx.shadowBlur = opt.blur || 8; }
  ctx.imageSmoothingEnabled = true;
  if (im && im.complete) ctx.drawImage(im, x, y, w, h);
  else { ctx.fillStyle = '#1a1440'; cardRR(x, y, w, h, 3); ctx.fill(); }
  ctx.restore();
}

// A card that flips from its back to its face: k = 0 (back) .. 1 (face)
function drawCardFlip(c, cx, cy, w, h, k, now, detail = true) {
  now = CARD_STILL;   // every card is a still image: glow, sheen, sprite and rainbow rank held at one moment
  const sx = Math.abs(Math.cos(k * Math.PI));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.02, sx), 1);
  if (k < 0.5) drawCardBack(-w / 2, -h / 2, w, h, now, { glow: rankColor(c.tier, now) });
  else drawCardFront(c, -w / 2, -h / 2, w, h, now, { sel: true, detail });
  ctx.restore();
}

// ---------------------------------------------------------------- info box (passive + spell)
function cardInfoBox(c, x, y, w, h, now, tier) {
  const fs = Math.max(5, w * 0.066), lh = fs * 1.22, pad = Math.max(2, w * 0.05);
  const rc = tier == null || tier === 9 ? '#8a6ad8' : RANK_COL[tier];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(rc, -0.62)); g.addColorStop(1, shade(rc, -0.78));
  ctx.globalAlpha = 0.94; ctx.fillStyle = g; rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = shade(rc, 0.1); ctx.lineWidth = 0.9; rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6; rrect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 3); ctx.stroke();
  const lines = [[cardName(c).toUpperCase(), shade(rc, 0.55), true]];
  const pv = cardPassives(c);
  for (const p of pv.slice(0, c.fusion ? pv.length : 1)) lines.push(['◆ ' + passiveName(p), '#8fd0ff', true], [PASSIVES[p.id].fmt(passiveValue(p.id, p.tier) * (p.mul || 1)), '#d8e8ff', false]);
  if (c.fusion) lines.push(['✦ FUSION ATTACK', '#ffd23f', true], [`${c.fusion.length} monsters · power ${fusionPower(c)}`, '#ffe9a8', false]);
  else {
    const sp = cardSpell(c);
    lines.push(['✦ ' + sp.name, ELEMENTS[sp.el].col, true], [sp.sup ? `${sp.sup.label} · ${sp.desc} · ${sp.mp} MP` : `${ARCH[sp.arch].name} · ${ELEMENTS[sp.el].name} · ${sp.power} pow · ${sp.mp} MP`, '#e8dcc8', false]);
  }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let yy = y + pad + fs * 0.6;
  for (const [str, col, bold] of lines) {
    ctx.font = `${bold ? 800 : 600} ${fs}px ${FONT}`;
    // wrap to the box width
    let line = '';
    for (const word of trSplit(str)) {
      const tst = line ? line + trSp() + word : word;
      if (ctx.measureText(tst).width > w - pad * 2 && line) { ctx.fillStyle = col; ctx.fillText(line, x + pad, yy); yy += lh; line = word; } else line = tst;
    }
    ctx.fillStyle = col; ctx.fillText(line, x + pad, yy); yy += lh * (bold ? 1 : 1.25);
  }
  ctx.restore();
}
