'use strict';
// The spellbook inventory (SPELL DECK | EQUIPMENT · INFO) and the card MERGE screen, after the reference art.

// ---------------------------------------------------------------- shared helpers
function sortedCards(pr) {
  return pr.cards.slice().sort((a, b) => (b.fusion ? 1 : 0) - (a.fusion ? 1 : 0) || b.tier - a.tier || (a.sp || '').localeCompare(b.sp || ''));
}
// Identical cards (same monster, same rank) stack into one entry with a count; fusion cards never stack.
// The stack shows the copy that is in use (spell / fusion, then deck) on top.
const inUse = (pr, c) => (pr.spells.includes(c.uid) || pr.fusion === c.uid ? 2 : pr.deck.includes(c.uid) ? 1 : 0);
function cardStacks(pr) {
  const map = new Map(), out = [];
  for (const c of sortedCards(pr)) {
    const key = c.fusion ? c.uid : c.sp + ':' + c.tier;
    let st = map.get(key);
    if (!st) { st = { key, cards: [] }; map.set(key, st); out.push(st); }
    st.cards.push(c);
  }
  for (const st of out) { st.cards.sort((a, b) => inUse(pr, b) - inUse(pr, a)); st.c = st.cards[0]; st.n = st.cards.length; }
  return out;
}
const spareOf = (pr, st) => st.cards.find(x => !inUse(pr, x));
// Put a card into a deck slot: replaces the card there (inheriting its Q/E/R spell key) or swaps if already in the deck
function equipToSlot(game, card, slot) {
  const pr = game.profile;
  if (card.fusion) { pr.fusion = card.uid; game.toast(`${card.name} set as your fusion card`, '#ffb84a'); game.save(); return; }
  const st = cardStacks(pr).find(s => s.cards.includes(card));
  const c = (st && st.cards.find(x => !pr.deck.includes(x.uid))) || card;
  const j = pr.deck.indexOf(c.uid), old = pr.deck[slot];
  if (j >= 0) {   // already in the deck: swap places
    if (slot >= pr.deck.length) { pr.deck.splice(j, 1); pr.deck.push(c.uid); }
    else { pr.deck[j] = old; pr.deck[slot] = c.uid; }
  } else if (slot < pr.deck.length) {
    pr.deck[slot] = c.uid;
    pr.spells = pr.spells.map(u => u === old ? c.uid : u);   // keeps the spell key the old card had
  } else if (pr.deck.length < deckMax(pr)) pr.deck.push(c.uid);
  game.toast(`${cardName(c)} equipped to deck slot ${Math.min(slot, pr.deck.length - 1) + 1}`, '#8fffd0');
  game.save();
}
function sortedGear(pr, slot) {
  return pr.gear.filter(g => !slot || g.slot === slot)
    .sort((a, b) => GEAR_SLOTS.indexOf(a.slot) - GEAR_SLOTS.indexOf(b.slot) || b.tier - a.tier);
}
function gridNav(st, n, cols) {
  const k = navInput();
  if (k.l) st.cur = Math.max(0, st.cur - 1);
  if (k.r) st.cur = Math.min(n - 1, st.cur + 1);
  if (k.u) st.cur = Math.max(0, st.cur - cols);
  if (k.d) st.cur = Math.min(n - 1, st.cur + cols);
  st.cur = clamp(st.cur, 0, Math.max(0, n - 1));
  return k;
}
function keepVisible(m, cols, rows) {
  if (m.cur < m.scroll * cols) m.scroll = Math.floor(m.cur / cols);
  if (m.cur >= (m.scroll + rows) * cols) m.scroll = Math.floor(m.cur / cols) - rows + 1;
}
const INK = '#3a2414', INK_SOFT = '#6b4a2e', PARCH = '#ecd7a6';

function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Card art comes from cards.js (per-rank frames after the Card Rank System reference)
function drawCardArt(c, x, y, w, h, now, opt = {}) { drawCardFront(c, x, y, w, h, now, opt); }
// A card the way Triple Fantasy draws them: a dark slate body in a bevelled steel frame, the monster in a round
// portrait ringed in its element's colour, an element badge top-left, the name under the portrait (on bigger cards), and the fight numbers at the foot: a sword with its damage, a mana drop with its MP cost (a
// fusion card: FUSE). Used by the deck board and the collection grid (opt: sel, name, dim).
const TF_RING = { fire: '#e8503a', ice: '#3a8ee8', lightning: '#f0c83a', earth: '#58b848', wind: '#3ac8b0', dark: '#9a5ae0', poison: '#7ac83a', holy: '#f0d878' };
// THE MINI CARD FRAMES (assets/mini_frame_*.png, cut from the user's artwork; the same four rarities as the big
// card frames): the collection grid, the deck board, the card strip and the picker. Slots in the frame's own 215 ×
// 289 pixels: the element gem (top left), the rank tag (top right), the portrait window, a name band, and a 2 × 2
// grid of cells — power, MP, the passive, the cooldown.
const MINI_FRAMES = ['common', 'rare', 'epic', 'legend'].map(n => `assets/mini_frame_${n}.png`);
const MF = { W: 215, H: 289, orb: [44, 42, 15], tag: [139, 30, 190, 52], art: [45, 44, 170, 163], name: [23, 195, 193, 211], cells: [[23, 220, 105, 243], [109, 220, 192, 243], [23, 247, 105, 268], [109, 247, 192, 268]] };
function drawMiniFrameArt(c, x0, y0, w0, h0, now, opt) {
  now = CARD_STILL;   // the small cards are still: SSS+'s rainbow rank, glow and sheen held at one moment
  const im = img(MINI_FRAMES[cardFrameOf(c.tier) === CARD_FRAMES[0] ? 0 : CARD_FRAMES.indexOf(cardFrameOf(c.tier))]); if (!im || !im.complete || !im.naturalWidth) return false;
  let w = w0, h = w0 * MF.H / MF.W; if (h > h0) { h = h0; w = h0 * MF.W / MF.H; }
  const x = x0 + (w0 - w) / 2, y = y0 + (h0 - h) / 2, k = w / MF.W, B = r => [x + r[0] * k, y + r[1] * k, (r[2] - r[0]) * k, (r[3] - r[1]) * k];
  const t = c.tier, el = cardElement(c), E = EL_THEME[el] || EL_THEME.holy, sp = c.fusion ? null : cardSpell(c), pow = c.fusion ? fusionPower(c) : spellPow(sp);
  const col = rankColor(t, now), solid = col[0] === '#' ? col : rankSolid(t);
  ctx.save();
  if (opt.dim) ctx.globalAlpha = 0.45;
  // the frame, lifted on a soft shadow, gold-lit when picked, glowing in its rank's colour from S up
  ctx.save(); ctx.shadowColor = opt.sel ? '#ffd860' : t >= 6 ? (t === 9 ? holo(now) : solid) : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = (opt.sel ? 8 : t >= 6 ? 4 : 3) * RES; ctx.shadowOffsetY = opt.sel || t >= 6 ? 0 : 1.2 * RES;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, x, y, w, h); ctx.restore();
  if (opt.sel) { ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2); }
  // the portrait: the element's light, the monster standing still in it
  { const [ax, ay, aw, ah] = B(MF.art);
    ctx.save(); rrect(ctx, ax, ay, aw, ah, 6 * k); ctx.clip();
    const bg = ctx.createRadialGradient(ax + aw / 2, ay + ah * 0.45, aw * 0.05, ax + aw / 2, ay + ah / 2, aw * 0.75); bg.addColorStop(0, E[1]); bg.addColorStop(0.45, E[0]); bg.addColorStop(1, E[2]);
    ctx.globalAlpha = (opt.dim ? 0.45 : 1) * 0.85; ctx.fillStyle = bg; ctx.fillRect(ax, ay, aw, ah); ctx.globalAlpha = opt.dim ? 0.45 : 1;
    if (c.fusion) { const parts = c.fusion.slice(0, 3); parts.forEach((q, i) => monsterPreview(cardIconSpecies(q), ax + i * aw / parts.length, ay + ah * 0.1, aw / parts.length, ah * 0.84, q.tier, 0, 'idle', 3)); }
    else monsterPreview(c.sp, ax + aw * 0.06, ay + ah * 0.08, aw * 0.88, ah * 0.86, t, 0, 'idle', 3);
    if (t === 9) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16; ctx.fillStyle = holo(now); ctx.fillRect(ax, ay, aw, ah); }
    ctx.restore(); }
  // the element gem and the rank tag
  { const ox = x + MF.orb[0] * k, oy = y + MF.orb[1] * k, orr = MF.orb[2] * k;
    const g = ctx.createRadialGradient(ox - orr * 0.35, oy - orr * 0.4, 0.3, ox, oy, orr); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, E[0]); g.addColorStop(1, E[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, orr, 0, Math.PI * 2); ctx.fill();
    ct(c.fusion ? '✦' : EL_GLYPH[el] || '•', ox, oy + 0.3, '#ffffff', orr * 1.25); }
  if (w < 64) {   // icon size: a bold rank badge over the portrait's top-right corner (the frame's tag is too small to read)
    const str = RANKS[t], fs = fitSize(str, w * 0.5, Math.min(8, w * 0.2), 3), bw = ctw(str, fs) + 4, bh = fs + 3;
    const bx = x + w - bw - 2, by = y + 2;
    ctx.fillStyle = 'rgba(8,6,14,0.88)'; rrect(ctx, bx, by, bw, bh, 2); ctx.fill();
    ctx.strokeStyle = t === 9 ? holo(now) : solid; ctx.lineWidth = 0.9; rrect(ctx, bx + 0.45, by + 0.45, bw - 0.9, bh - 0.9, 2); ctx.stroke();
    ct(str, bx + bw / 2, by + bh / 2 + 0.3, t === 9 ? '#ffffff' : mixCol(solid, '#ffffff', 0.25), fs);
  } else { const [rx, ry, rw, rh] = B(MF.tag), str = RANKS[t]; ct(str, rx + rw / 2, ry + rh / 2 + 0.2, col, fitSize(str, rw - 2 * k, rh * 0.9, 2)); }
  // the name band (on the larger tiles), and the four cells
  const cell = (r, str, colr) => { const [cx, cy, cw, ch] = B(r); ct(str, cx + cw / 2, cy + ch / 2 + 0.2, colr, fitSize(str, cw - 3 * k, ch * 0.85, 2)); };
  if (w >= 46) { const [nx, ny, nw, nh] = B(MF.name), str = opt.name !== false ? cardName(c) : ''; if (str) ct(str, nx + nw / 2, ny + nh / 2 + 0.2, '#f4ecdc', fitSize(str, nw - 4 * k, nh * 0.9, 2)); }
  if (w < 64) {   // icon size: just power and MP, each filling half the bottom panel in big numbers (tiny text was unreadable)
    const L = [MF.cells[0][0], MF.cells[0][1], MF.cells[2][2], MF.cells[2][3]], Rr = [MF.cells[1][0], MF.cells[1][1], MF.cells[3][2], MF.cells[3][3]];
    const big = (r, str, colr) => { const [cx, cy, cw, ch] = B(r); ct(str, cx + cw / 2, cy + ch / 2 + 0.3, colr, fitSize(str, cw - 2 * k, ch * 0.62, 2)); };
    big(L, String(pow), '#ffd58a'); big(Rr, c.fusion ? 'FUSE' : String(sp.mp), '#8fd8ff');
  } else {
    cell(MF.cells[0], sp && sp.stat ? pow : `⚔${pow}`, '#ffe2b0');
    cell(MF.cells[1], c.fusion ? 'FUSE' : `💧${sp.mp}`, '#c8ecff');
    { const pv = cardPassives(c)[0]; cell(MF.cells[2], pv ? `◆${(PASSIVES[pv.id].fmt(passiveValue(pv.id, pv.tier) * (pv.mul || 1)).match(/[\d.]+%?/) || [''])[0]}` : '', '#9fd8ff'); }
    cell(MF.cells[3], sp ? `${(sp.cd / 1000).toFixed(1)}s` : `×${c.fusion.length}`, '#e0e0e8');
  }
  if (opt.badge) dcKeyGem(opt.badge, x + MF.art[2] * k - 3, y + MF.art[3] * k - 3, Math.max(6, 16 * k));   // where it is equipped: the spell key on a gem at the portrait's lower right
  ctx.restore();
  return true;
}
function drawTFCard(c, x, y, w, h, now, opt = {}) {
  now = CARD_STILL;   // every card is a still image: glow, sheen, sprite and rainbow rank held at one moment
  if (drawMiniFrameArt(c, x, y, w, h, now, opt)) { if (c.sun) drawSunRim(x, y, w, h, MF.H / MF.W); return; }   // the mini card frames (preloaded at startup)
  const t = c.tier, el = cardElement(c), ring = TF_RING[el] || '#c8c8d8', sp = c.fusion ? null : cardSpell(c), pow = c.fusion ? fusionPower(c) : spellPow(sp);
  const R = Math.max(3, w * 0.08), big = w >= 50, bar = big ? 13 : 10, bw = big ? 2.4 : 1.6;   // bw: the steel frame's width
  ctx.save();
  if (opt.dim) ctx.globalAlpha = 0.45;
  // a drop shadow under the card, so it stands off the board
  ctx.save(); ctx.shadowColor = opt.sel ? '#ffd860' : t >= 6 ? rankSolid(t) : 'rgba(0,0,0,0.75)'; ctx.shadowBlur = (opt.sel ? 9 : t >= 6 ? 5 : 4) * RES; ctx.shadowOffsetY = opt.sel ? 0 : (big ? 3 : 2) * RES;
  ctx.fillStyle = '#1c120c'; rrect(ctx, x, y, w, h, R); ctx.fill(); ctx.restore();
  // the steel frame: a bevelled band, bright at the top left and dark at the bottom right
  const steel = ctx.createLinearGradient(x, y, x + w * 0.6, y + h); steel.addColorStop(0, '#f4f7fc'); steel.addColorStop(0.35, '#a8b2c4'); steel.addColorStop(0.7, '#5a6478'); steel.addColorStop(1, '#3a2618');
  ctx.fillStyle = opt.sel ? (() => { const gg = ctx.createLinearGradient(x, y, x, y + h); gg.addColorStop(0, '#fff6c8'); gg.addColorStop(0.5, '#f0b83a'); gg.addColorStop(1, '#8a5210'); return gg; })() : steel;
  rrect(ctx, x, y, w, h, R); ctx.fill();
  // the face, set into the frame: dark slate warmed by the element's colour at the top
  const fx = x + bw, fy0 = y + bw, fw = w - bw * 2, fh = h - bw * 2, fr = Math.max(2, R - bw * 0.6);
  const body = ctx.createLinearGradient(0, fy0, 0, fy0 + fh); body.addColorStop(0, mixCol('#48301e', ring, 0.28)); body.addColorStop(0.45, '#332215'); body.addColorStop(1, '#19100a');
  ctx.fillStyle = body; rrect(ctx, fx, fy0, fw, fh, fr); ctx.fill();
  ctx.save(); rrect(ctx, fx, fy0, fw, fh, fr); ctx.clip();
  // inner bevel: a shadow cast by the frame along the top and left, a lit lip along the bottom
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = big ? 2 : 1.4; ctx.beginPath(); ctx.moveTo(fx, fy0 + fh); ctx.lineTo(fx, fy0); ctx.lineTo(fx + fw, fy0); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,215,240,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx + 1, fy0 + fh - 0.5); ctx.lineTo(fx + fw - 0.5, fy0 + fh - 0.5); ctx.lineTo(fx + fw - 0.5, fy0 + 1); ctx.stroke();
  // a soft light behind the portrait
  const pr2 = Math.min(w * 0.4, (h - bar) * 0.34), pcx = x + w / 2, pcy = y + 3 + pr2 + (big ? 3 : 1);
  const halo = ctx.createRadialGradient(pcx, pcy, pr2 * 0.4, pcx, pcy, pr2 * 1.8); halo.addColorStop(0, hexA(ring, 0.35)); halo.addColorStop(1, hexA(ring, 0));
  ctx.fillStyle = halo; ctx.fillRect(fx, fy0, fw, fh);
  ctx.restore();
  // the portrait: a medallion in a turned-metal bezel, the monster inside standing still
  const bz = big ? 3 : 2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3 * RES; ctx.shadowOffsetY = 1.2 * RES;
  const bezel = ctx.createLinearGradient(0, pcy - pr2 - bz, 0, pcy + pr2 + bz); bezel.addColorStop(0, '#f4f7fc'); bezel.addColorStop(0.45, '#8a94a8'); bezel.addColorStop(0.55, '#4a5266'); bezel.addColorStop(1, '#c8d0de');
  ctx.fillStyle = bezel; ctx.beginPath(); ctx.arc(pcx, pcy, pr2 + bz, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = ring; ctx.lineWidth = big ? 1.6 : 1.1; ctx.beginPath(); ctx.arc(pcx, pcy, pr2 + 0.2, 0, Math.PI * 2); ctx.stroke();
  const well = ctx.createRadialGradient(pcx, pcy - pr2 * 0.35, 1, pcx, pcy, pr2); well.addColorStop(0, hexA(ring, 0.6)); well.addColorStop(0.7, mixCol('#281a11', ring, 0.15)); well.addColorStop(1, '#120c08');
  ctx.fillStyle = well; ctx.beginPath(); ctx.arc(pcx, pcy, pr2 - 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(pcx, pcy, pr2 - 0.6, 0, Math.PI * 2); ctx.clip();
  if (c.fusion) { const parts = c.fusion.slice(0, 3); parts.forEach((q, i) => monsterPreview(cardIconSpecies(q), pcx - pr2 + i * (pr2 * 2) / parts.length, pcy - pr2 * 0.8, (pr2 * 2) / parts.length, pr2 * 1.7, q.tier, 0)); }
  else monsterPreview(c.sp, pcx - pr2, pcy - pr2 * 0.9, pr2 * 2, pr2 * 1.85, t, 0);
  // the inside of the medallion: a shadow under the bezel's top edge, and glass catching the light
  const inner = ctx.createRadialGradient(pcx, pcy + pr2 * 0.2, pr2 * 0.6, pcx, pcy, pr2); inner.addColorStop(0, 'rgba(0,0,0,0)'); inner.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = inner; ctx.fillRect(pcx - pr2, pcy - pr2, pr2 * 2, pr2 * 2);
  const glass = ctx.createLinearGradient(0, pcy - pr2, 0, pcy); glass.addColorStop(0, 'rgba(255,255,255,0.28)'); glass.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glass; ctx.beginPath(); ctx.ellipse(pcx - pr2 * 0.15, pcy - pr2 * 0.45, pr2 * 0.75, pr2 * 0.45, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // the element badge: a little gem
  const bx = x + (big ? 8 : 6), by = y + (big ? 8 : 6), br = big ? 5.5 : 4;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2 * RES; ctx.shadowOffsetY = 0.8 * RES;
  ctx.fillStyle = '#c8d0de'; ctx.beginPath(); ctx.arc(bx, by, br + 1.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const bg = ctx.createRadialGradient(bx - 1.4, by - 1.6, 0.4, bx, by, br); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.3, ring); bg.addColorStop(1, mixCol(ring, '#000000', 0.6));
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  text(c.fusion ? '✦' : EL_GLYPH[el] || '•', bx, by + 0.3, '#ffffff', big ? 6 : 4.6);
  // the name under the portrait (big cards) on a small dark plate, and the rank in the corner
  const sc = t >= 9 ? `hsl(${(now / 6) % 360},90%,70%)` : rankSolid(t), sy = pcy + pr2 + bz + (big ? 4 : 3);
  if (opt.name && big) {
    const nw = Math.min(fw - 8, textW(cardName(c), 6.2) + 10);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, pcx - nw / 2, sy - 1, nw, 10, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(200,215,240,0.25)'; ctx.lineWidth = 0.6; rrect(ctx, pcx - nw / 2 + 0.3, sy - 0.7, nw - 0.6, 9.4, 3); ctx.stroke();
    text(cardName(c), pcx, sy + 4, '#f4ecdc', 6.2);
  }
  if (big) {   // the rank on a small dark plate tucked inside the frame's top-right corner
    const rs = RANKS[t].length > 2 ? 5.6 : 6.4, rw = textW(RANKS[t], rs) + 6, rx2 = x + w - bw - 2 - rw, ry2 = y + bw + 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rrect(ctx, rx2, ry2, rw, 9, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(200,215,240,0.25)'; ctx.lineWidth = 0.6; rrect(ctx, rx2 + 0.3, ry2 + 0.3, rw - 0.6, 8.4, 3); ctx.stroke();
    text(RANKS[t], rx2 + rw / 2, ry2 + 4.8, sc, rs);
  }
  // the stats at the foot: a raised steel strip with a sword and its damage, a mana drop and its MP
  const fyb = y + h - bw - bar;
  ctx.save(); rrect(ctx, fx, fy0, fw, fh, fr); ctx.clip();
  const sb = ctx.createLinearGradient(0, fyb, 0, fyb + bar); sb.addColorStop(0, '#563924'); sb.addColorStop(0.5, '#302014'); sb.addColorStop(1, '#160f09');
  ctx.fillStyle = sb; ctx.fillRect(fx, fyb, fw, bar);
  ctx.fillStyle = 'rgba(220,230,250,0.45)'; ctx.fillRect(fx, fyb, fw, 0.8); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(fx, fyb - 0.8, fw, 0.8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(pcx - 0.4, fyb + 2, 0.8, bar - 4); ctx.fillStyle = 'rgba(220,230,250,0.18)'; ctx.fillRect(pcx + 0.4, fyb + 2, 0.6, bar - 4);
  ctx.restore();
  const my = fyb + bar / 2 + 0.3, k = big ? 1.4 : 1, lx = x + (big ? 6 : 4), rx = x + w / 2 + (big ? 3 : 2);
  ctx.fillStyle = '#f0c27a'; for (let i = 0; i < 4; i++) ctx.fillRect(lx + i * k, my + (1.5 - i) * k, k, k);
  ctx.fillRect(lx - 0.5 * k, my + 0.5 * k, 2 * k, k); ctx.fillStyle = '#b8783a'; ctx.fillRect(lx - k, my + 2 * k, k, k);
  text(String(pow), lx + 5 * k + (x + w / 2 - lx - 5 * k) / 2, my, '#ffe2b0', big ? 7 : 5.6);
  if (c.fusion) text('FUSE', rx + (x + w - rx) / 2, my, '#ffd23f', big ? 6.4 : 5);
  else {
    ctx.fillStyle = '#5ac0ff'; ctx.beginPath(); ctx.moveTo(rx + 1.5 * k, my - 2.6 * k); ctx.lineTo(rx + 3 * k, my + 0.2 * k); ctx.arc(rx + 1.5 * k, my + 0.6 * k, 1.5 * k, 0, Math.PI); ctx.closePath(); ctx.fill();
    text(String(sp.mp), rx + 4 * k + (x + w - rx - 4 * k) / 2, my, '#c8ecff', big ? 7 : 5.6);
  }
  // a gloss over the upper card, and a bright edge along the frame's top
  ctx.save(); rrect(ctx, x, y, w, h, R); ctx.clip();
  const gl = ctx.createLinearGradient(x, y, x + w * 0.5, y + h * 0.55); gl.addColorStop(0, 'rgba(255,255,255,0.16)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.04)'); gl.addColorStop(0.51, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.7; rrect(ctx, x + 0.35, y + 0.35, w - 0.7, h - 0.7, R); ctx.stroke();
  if (opt.badge) dcKeyGem(opt.badge, x + w - (big ? 10 : 7), y + (big ? 22 : 7), big ? 7 : 6);   // the spell key it is set to (Q/E/R/G, ● in the deck)
  ctx.restore();
}
// an empty slot on the board: a recessed steel frame with corner rivets and its key faint in the middle
function drawTFSlot(x, y, w, h, label, sel, now) {
  const R = Math.max(3, w * 0.08);
  ctx.save();
  ctx.fillStyle = sel ? 'rgba(255,216,96,0.08)' : 'rgba(0,0,0,0.35)'; rrect(ctx, x, y, w, h, R); ctx.fill();
  const steel = ctx.createLinearGradient(x, y, x + w, y + h); steel.addColorStop(0, '#8a94a8'); steel.addColorStop(0.5, '#4a5266'); steel.addColorStop(1, '#382518');
  ctx.strokeStyle = sel ? `rgba(255,216,96,${0.6 + 0.4 * Math.sin(now / 200)})` : steel; ctx.lineWidth = sel ? 1.6 : 1.8; rrect(ctx, x + 0.9, y + 0.9, w - 1.8, h - 1.8, R); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; rrect(ctx, x + 3, y + 3, w - 6, h - 6, R - 1.5); ctx.stroke();
  for (const [rx, ry] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) { ctx.fillStyle = '#9aa4b8'; ctx.beginPath(); ctx.arc(rx, ry, 1.2, 0, Math.PI * 2); ctx.fill(); }
  if (label) text(label, x + w / 2, y + h / 2, sel ? '#ffd860' : 'rgba(170,180,200,0.35)', w >= 50 ? 14 : 9);
  ctx.restore();
}
// The collection grid's tile: the same card, small, without its name
function drawCollectionTile(c, x, y, w, h, now, opt = {}) { drawTFCard(c, x, y, w, h, now, opt); }
// Equipment socket: a plain square well with a rank-coloured line, and a ghost icon when empty
const SLOT_GHOST = { head: 36, body: 52, weapon: 0, accessory: 112, boots: 68, trinket: 88 };
function drawGearSlot(g, x, y, s, now, opt = {}) {
  // (the page's still clock: an SSS+ piece keeps ONE colour; a live rainbow was tried on 2026-11-20 and the user asked for one colour back)
  const still = typeof CARD_STILL !== 'undefined' ? CARD_STILL : 0, col = g ? rankColor(g.tier, still) : '#8a6a44';
  ctx.save();
  // cast shadow (the rank-coloured aura round the box went on 2026-11-20, the user: "only leave the letter glowing not boarder")
  ctx.shadowColor = 'rgba(30,15,0,0.55)'; ctx.shadowBlur = 3 * RES; ctx.shadowOffsetY = 2 * RES;
  ctx.fillStyle = '#3a2208'; ctx.fillRect(x, y, s, s);
  ctx.restore();
  // a plain square socket: a dark well and a thin line in the item's rank colour (the gold bezel, corner filigree, side gem
  // studs and top crest were removed on 2026-11-07 at the user's request: too much going on)
  ctx.fillStyle = '#1a1220'; ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = g ? col : '#5a4a3a'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.6, y + 0.6, s - 1.2, s - 1.2);
  if (opt.sel) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 2, y - 2, s + 4, s + 4); }
  if (g) {
    const lg = ctx.createRadialGradient(x + s / 2, y + s / 2, 1, x + s / 2, y + s / 2, s * 0.5);
    lg.addColorStop(0, g.tier === 9 ? `hsla(${(still / 5) % 360},90%,60%,0.6)` : col + "99"); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
    const sc = (s - 10) / 16, bob = g.tier >= 6 ? Math.sin(now / 400 + x) : 0;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 2 * RES; ctx.shadowOffsetY = 1 * RES;
    iconCentered('items', g.icon, x + s / 2, y + s / 2 + bob, (s - 12) * 0.95);   // dead centre in the well (the rank tab sits on the frame below it)
    ctx.restore();
    if (g.set) { ctx.fillStyle = GEAR_SETS[g.set].col; ctx.strokeStyle = '#120a18'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + 12, y + 5); ctx.lineTo(x + 5, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke(); }   // its set's colour, in the corner
    for (let i = 0; i < (g.q || 0); i++) { ctx.fillStyle = '#120a18'; ctx.fillRect(x + s - 9.5 - i * 4, y + 4.5, 4, 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + s - 9 - i * 4, y + 5, 3, 3); }   // and a gold pip for each quality step
    // (the white shine sweep over rank 4+ gear was removed on 2026-11-20, the user: "remove glare from items")
    // durability (durability.js): a bar above the rank tab, green to yellow to red; broken gear is struck through in red
    if (g.uid && g.slot && typeof gearDurMax === 'function') {
      const k = Math.max(0, Math.min(1, gearDur(g) / gearDurMax(g))), bw = s - 12, by = y + s - 10.5;
      // (given depth on 2026-11-07, the flat bar looked flat: a dark sunken track, the fill shaded light-to-dark with a shine
      // along its top, and faint quarter ticks)
      const bh = 3, base = k > 0.5 ? ['#b8ffc0', '#4ccc5c', '#1e7a2e'] : k > DUR.warn ? ['#fff4b0', '#f0c030', '#9a6a08'] : ['#ffc0b0', '#f04a3a', '#8a1a12'];
      ctx.fillStyle = '#0a040c'; ctx.fillRect(x + 6 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#2a2230'; ctx.fillRect(x + 6, by, bw, bh);
      if (k > 0) { const bg = ctx.createLinearGradient(0, by, 0, by + bh); bg.addColorStop(0, base[0]); bg.addColorStop(0.45, base[1]); bg.addColorStop(1, base[2]);
        ctx.fillStyle = bg; ctx.fillRect(x + 6, by, bw * k, bh); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 6, by, bw * k, 0.6); }
      ctx.fillStyle = 'rgba(10,4,12,0.55)'; for (let q = 1; q < 4; q++) ctx.fillRect(x + 6 + bw * q / 4 - 0.25, by, 0.5, bh);
      if (gearBroken(g)) { ctx.fillStyle = 'rgba(160,20,20,0.45)'; rrect(ctx, x + 4.4, y + 4.4, s - 8.8, s - 8.8, 2); ctx.fill(); text('BROKEN', x + s / 2, y + s / 2, '#ffd0c8', 6); }
    }
    // rank gem tab, bottom centre (not for food)
    if (!opt.noRank) {
    const tw = Math.max(12, textW(RANKS[g.tier], 6.5) + 6);
    ctx.fillStyle = '#24180f'; rrect(ctx, x + s / 2 - tw / 2, y + s - 6, tw, 9, 3); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 0.8; rrect(ctx, x + s / 2 - tw / 2 + 0.4, y + s - 5.6, tw - 0.8, 8.2, 3); ctx.stroke();
    ctx.save(); if (g.tier >= 4) { ctx.shadowColor = col; ctx.shadowBlur = (4 + 1.5 * Math.sin(now / 280 + x)) * RES; }   // the rank letters glow
    text(RANKS[g.tier], x + s / 2, y + s - 1.4, col, 6.5); ctx.restore();
    }
  } else if (opt.slot && SLOT_GHOST[opt.slot] != null) {   // faint silhouette of what goes here
    ctx.save(); ctx.globalAlpha = 0.22; ctx.filter = 'grayscale(1) brightness(1.6)';
    iconCentered('items', SLOT_GHOST[opt.slot], x + s / 2, y + s / 2, s - 14);
    ctx.restore();
  }
  if (opt.up) {   // green up-arrow: an upgrade waits in the bag
    ctx.save(); ctx.shadowColor = '#5bd86b'; ctx.shadowBlur = 4 * RES;
    ctx.fillStyle = '#5bd86b';
    ctx.beginPath(); ctx.moveTo(x + s - 6, y - 3); ctx.lineTo(x + s, y + 4); ctx.lineTo(x + s - 12, y + 4); ctx.fill();
    ctx.fillRect(x + s - 8, y + 4, 4, 4); ctx.restore();
  }
  if (opt.badge) text(opt.badge, x + s - 4, y + 6, '#ffd23f', 7, 'right');
}

// ---------------------------------------------------------------- the book
const BOOK = { x: 30, y: 44, w: 580, h: 292 };
const PAGE_L = { x: 46, y: 54, w: 270, h: 272 }, PAGE_R = { x: 324, y: 54, w: 270, h: 272 };
function drawIronFrame(B, c0 = '#442d1d', c1 = '#22160e') {
  // the frame: a dark iron plate with a bevelled steel rim and riveted corner caps
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 16 * RES; ctx.shadowOffsetY = 6 * RES;
  const fg = ctx.createLinearGradient(0, B.y, 0, B.y + B.h); fg.addColorStop(0, c0); fg.addColorStop(1, c1);
  ctx.fillStyle = fg; rrect(ctx, B.x, B.y, B.w, B.h, 7); ctx.fill(); ctx.restore();
  const rim = ctx.createLinearGradient(B.x, B.y, B.x + B.w, B.y + B.h); rim.addColorStop(0, '#e0e6f0'); rim.addColorStop(0.4, '#7a8498'); rim.addColorStop(1, '#3a2618');
  ctx.strokeStyle = rim; ctx.lineWidth = 2.6; rrect(ctx, B.x + 1.3, B.y + 1.3, B.w - 2.6, B.h - 2.6, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; rrect(ctx, B.x + 4.5, B.y + 4.5, B.w - 9, B.h - 9, 5); ctx.stroke();
  for (const [x, y, sx, sy] of [[B.x, B.y, 1, 1], [B.x + B.w, B.y, -1, 1], [B.x, B.y + B.h, 1, -1], [B.x + B.w, B.y + B.h, -1, -1]]) {
    const cgr = ctx.createLinearGradient(x, y, x + sx * 18, y + sy * 18); cgr.addColorStop(0, '#f0f4fa'); cgr.addColorStop(0.5, '#8a94a8'); cgr.addColorStop(1, '#563924');
    ctx.fillStyle = cgr; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sx * 20, y); ctx.lineTo(x + sx * 20, y + sy * 5); ctx.lineTo(x + sx * 5, y + sy * 20); ctx.lineTo(x, y + sy * 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2c1d12'; ctx.beginPath(); ctx.arc(x + sx * 6, y + sy * 6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8e0ee'; ctx.beginPath(); ctx.arc(x + sx * 5.6, y + sy * 5.6, 1.1, 0, Math.PI * 2); ctx.fill();
  }
}
function drawSlatePage(P, c0 = '#3d281a', c1 = '#251810') {
  const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); pg.addColorStop(0, c0); pg.addColorStop(1, c1);
  ctx.fillStyle = pg; rrect(ctx, P.x, P.y, P.w, P.h, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.4; rrect(ctx, P.x + 0.7, P.y + 0.7, P.w - 1.4, P.h - 1.4, 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,210,230,0.16)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(P.x + 4, P.y + P.h - 0.6); ctx.lineTo(P.x + P.w - 4, P.y + P.h - 0.6); ctx.stroke();
}
function drawBookChrome(m, now) {
  // backdrop: dark study with floating motes and crystals
  ctx.fillStyle = '#120c08'; ctx.fillRect(0, 0, VW, VH);   // (a warm dark study, 2026-11-07: it was night-purple)
  // drifting nebula clouds
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [hx, hy, r, col, sp] of [[120, 90, 220, '150,80,30', 1], [520, 260, 240, '120,70,30', -1], [330, 200, 200, '160,70,40', 0.6]]) {
    const x = hx + Math.sin(now / (5000 * sp)) * 40, y = hy + Math.cos(now / 6000) * 25;
    const ng = ctx.createRadialGradient(x, y, 0, x, y, r);
    ng.addColorStop(0, `rgba(${col},0.35)`); ng.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = ng; ctx.fillRect(0, 0, VW, VH);
  }
  // god rays from behind the book
  ctx.translate(VW / 2, 40);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.32 + Math.sin(now / 3000 + i) * 0.04;
    ctx.globalAlpha = 0.06 + 0.04 * Math.sin(now / 900 + i * 1.3);
    ctx.fillStyle = i % 2 ? '#ffd27a' : '#ffb070';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.06) * 420, -Math.sin(a - 0.06) * -420); ctx.lineTo(Math.cos(a + 0.06) * 420, -Math.sin(a + 0.06) * -420); ctx.fill();
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, 160, VW / 2, VH / 2, 420);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {   // embers and arcane motes rising
    const k = ((now / (5000 + (i % 5) * 900)) + i * 0.217) % 1;
    const x = (i * 97 + Math.sin(now / 1200 + i) * 14) % VW, y = VH + 10 - k * (VH + 30);
    ctx.globalAlpha = Math.sin(k * Math.PI) * (0.5 + 0.4 * Math.sin(now / 250 + i));
    ctx.fillStyle = i % 3 ? '#ff9a3c' : i % 2 ? '#ffc070' : '#ffe0a0';
    const sz = i % 7 === 0 ? 2.2 : 1.3;
    ctx.fillRect(x, y, sz, sz);
  }
  ctx.restore();
  // (three orange "crystals" stood by the book's sides here; the user saw them as a random orange triangle on the phone: removed 2026-11-20)
  goldTitle('INVENTORY', VW / 2, 18, 17, now);
  // tabs: page tabs standing up from behind the book's top edge (drawn before the cover, which hides their feet)
  INV_TABS.forEach((t, i) => {
    const tx = t.x, on = m.tab === t.id, ty = BOOK.y - (on ? 19 : 15), tw = INV_TAB.w;
    ctx.save(); ctx.shadowColor = on ? hexA(t.col, 0.7) : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = (on ? 6 : 3) * RES;
    const tg = ctx.createLinearGradient(0, ty, 0, ty + 22); tg.addColorStop(0, on ? '#5a4630' : '#422c1c'); tg.addColorStop(1, on ? '#3a2618' : '#24180f');
    ctx.fillStyle = tg; rrect(ctx, tx, ty, tw, 24, 4); ctx.fill(); ctx.restore();
    ctx.fillStyle = on ? t.col : mixCol(t.col, '#000000', 0.45); ctx.fillRect(tx + 3, ty + 2, tw - 6, on ? 2.4 : 1.6);   // the tab's colour stripe
    ctx.strokeStyle = on ? '#ffd860' : '#6a5440'; ctx.lineWidth = on ? 1.2 : 0.9; rrect(ctx, tx + 0.5, ty + 0.5, tw - 1, 23, 4); ctx.stroke();
    if (invTabOpen(GAME.profile, t.id)) text(t.label, tx + tw / 2, ty + 10, on ? '#ffffff' : '#c8b498', 8);
    else { ctx.fillStyle = 'rgba(8,6,14,0.7)'; rrect(ctx, tx, ty, tw, 24, 4); ctx.fill(); text(`🔒 Lv ${invTabLv(t.id)}`, tx + tw / 2, ty + 10, '#8a8270', 7); }   // still locked (unlocks.js)
  });
  drawHomeButton(now);
  drawIronFrame(BOOK);
  // the pages: recessed slate panels
  drawSlatePage(PAGE_L); drawSlatePage(PAGE_R);
  // the hinge between them: a steel bar with rivets
  const sg = ctx.createLinearGradient(316, 0, 324, 0); sg.addColorStop(0, '#563924'); sg.addColorStop(0.5, '#9aa4b8'); sg.addColorStop(1, '#563924');
  ctx.fillStyle = sg; ctx.fillRect(317, PAGE_L.y + 2, 6, PAGE_L.h - 4);
  for (let y = PAGE_L.y + 14; y < PAGE_L.y + PAGE_L.h; y += 40) { ctx.fillStyle = '#2c1d12'; ctx.beginPath(); ctx.arc(320, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
  text('L', 50, BOOK.y - 6, '#fff', 9); text('R', 590, BOOK.y - 6, '#fff', 9);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(44.5, BOOK.y - 12.5, 12, 13); ctx.strokeRect(584.5, BOOK.y - 12.5, 12, 13);
}
// Teleport home: the last tab in the row (or T); it does not open a page
const INV_TAB = { x0: 60, w: 62, gap: 3.4 }, HOME_BTN = { x: INV_TAB.x0 + 7 * (INV_TAB.w + INV_TAB.gap), y: BOOK.y - 16, w: INV_TAB.w, h: 20 };
function drawHomeButton(now) {
  const B = HOME_BTN, hov = hovered(B.x, B.y, B.w, B.h), ty = BOOK.y - (hov ? 19 : 15);
  ctx.save(); ctx.shadowColor = hov ? '#ffd860' : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = (hov ? 6 : 3) * RES; const g = ctx.createLinearGradient(0, ty, 0, ty + 22); g.addColorStop(0, hov ? '#5a4630' : '#422c1c'); g.addColorStop(1, '#342216'); ctx.fillStyle = g; rrect(ctx, B.x, ty, B.w, 24, 4); ctx.fill(); ctx.restore();
  ctx.fillStyle = hov ? '#ffe9a8' : '#c9a85a'; ctx.fillRect(B.x + 3, ty + 2, B.w - 6, hov ? 2.4 : 1.6); ctx.strokeStyle = hov ? '#ffd860' : '#c9a85a'; ctx.lineWidth = hov ? 1.2 : 0.9; rrect(ctx, B.x + 0.5, ty + 0.5, B.w - 1, 23, 4); ctx.stroke();
  text('⌂ HOME [T]', B.x + B.w / 2, ty + 10, hov ? '#ffffff' : '#ffe9a8', 7.5);
}
// a tab tied to a locked system (unlocks.js) is dimmed and skipped: LAYER and KI wait for the LAYER unlock, TITLES for LOG & TITLES
const INV_TAB_LOCK = { layer: 'layer', ki: 'layer', titles: 'log' };
const invTabOpen = (pr, id) => !INV_TAB_LOCK[id] || typeof unlocked !== 'function' || unlocked(pr, INV_TAB_LOCK[id]);
const invTabLv = id => (typeof UNLOCK_BY !== 'undefined' && UNLOCK_BY[INV_TAB_LOCK[id]] || {}).lv;
const INV_TABS = [{ id: 'deck', label: 'DECK', col: '#8a4ad8' }, { id: 'cards', label: 'CARDS', col: '#3a78d8' }, { id: 'stats', label: 'STATS', col: '#c84a3a' }, { id: 'layer', label: 'LAYER', col: '#1e9a8a' }, { id: 'titles', label: 'TITLES', col: '#c8922a' }, { id: 'ki', label: 'KI', col: '#e8a020' }, { id: 'bag', label: 'BAG', col: '#4a9a3a' }].map((t, i) => ({ ...t, x: INV_TAB.x0 + i * (INV_TAB.w + INV_TAB.gap) }));   // each its own colour (food has its own screen: B)
function goldTitle(str, x, y, size, now) {   // a gold pixel heading with a dark brown edge
  drawPix(pixText(String(str), fontPx(size), 700, ['#fff6c8', '#ffd25a', '#d08a20'], '#2a1206'), x, y, 'center');
}
function pageHeader(str, P, y = 70) {
  goldTitle(str, P.x + P.w / 2, y, 14, performance.now());
  ctx.strokeStyle = 'rgba(154,164,184,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P.x + 22, y + 11); ctx.lineTo(P.x + P.w - 22, y + 11); ctx.stroke();
  ctx.fillStyle = '#9aa4b8';
  for (const x of [P.x + 22, P.x + P.w - 22]) { ctx.beginPath(); ctx.arc(x, y + 11, 1.6, 0, Math.PI * 2); ctx.fill(); }
}
// parchment ink text (dark, no heavy outline)
function ink(str, x, y, col = INK, size = 9, align = 'left', bold = true) {
  col = onSlate(col);
  drawPix(pixText(String(str), fontPx(size), bold ? 700 : 400, [col, col, col], null), x, y, align);
}
// the pages are dark slate now (they were parchment): ink colours chosen for parchment are lifted toward white,
// dark ones a lot, middling ones less, so every page stays readable without touching each line
const SLATE_INK = {};
function onSlate(col) {
  if (typeof col === 'string' && col.startsWith('rgba(')) {   // a faded parchment ink: lift it, keep its fade
    if (SLATE_INK[col]) return SLATE_INK[col];
    const [r, g, b, a] = col.slice(5, -1).split(',').map(Number), L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const k = L < 0.5 ? 0.62 : 0, f = v => Math.round(v + (255 - v) * k);
    return (SLATE_INK[col] = `rgba(${f(r)},${f(g)},${f(b)},${Math.min(1, a + 0.25)})`);
  }
  if (typeof col !== 'string' || col[0] !== '#' || col.length < 7) return col;
  if (SLATE_INK[col]) return SLATE_INK[col];
  const n = parseInt(col.slice(1, 7), 16), L = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return (SLATE_INK[col] = L < 0.3 ? mixCol(col, '#ffffff', 0.74) : L < 0.55 ? mixCol(col, '#ffffff', 0.45) : col);
}
function inkWrap(str, x, y, w, size, col, lineH) {
  ctx.font = `400 ${fontPx(size)}px ${FONT}`;
  let line = '', yy = y;
  for (const word of trSplit(str)) {
    const t = line ? line + trSp() + word : word;
    if (ctx.measureText(t).width > w && line) { ink(line, x, yy, col, size, 'left', false); yy += lineH; line = word; } else line = t;
  }
  if (line) { ink(line, x, yy, col, size, 'left', false); yy += lineH; }
  return yy;
}

// ---------------------------------------------------------------- inventory state & input
addEventListener('wheel', e => { mouse.wheel = (mouse.wheel || 0) + Math.sign(e.deltaY); }, { passive: true });   // (the deck's card scroll)
function inventoryMenu() { return { type: 'inv', tab: 'deck', cur: 0, scroll: 0, confirm: null, slotFilter: null, eqCur: -1 }; }
// deck ring: 10 card positions around the hero, on an ellipse
// Deck layout: 4 cards on top, one each side of the hero, 4 along the bottom — fixed slots, never overlapping.
const DECK_CW = 36, DECK_CH = 50;
const DECK_C = { x: PAGE_L.x + PAGE_L.w / 2, y: 166 };
const DECK_COLS = [66, 131, 196, 261];
const DECK_SLOTS = [
  ...DECK_COLS.map(x => ({ x, y: 84 })),
  { x: DECK_COLS[0], y: 146 }, { x: DECK_COLS[3], y: 146 },
  ...DECK_COLS.map(x => ({ x, y: 222 })),   // a gap under the hero's name plate
];
// gentle fan: outer cards tilt outward
const DECK_TILT = [-0.12, -0.04, 0.04, 0.12, -0.06, 0.06, 0.12, 0.04, -0.04, -0.12];
function deckPos(i) { return DECK_SLOTS[i]; }
// right page: six sockets in one row
const EQ_S = 34;
const EQ_POS = Object.fromEntries(GEAR_SLOTS.map((sl, i) => [sl, [337 + i * 42, 82]]));
const CARD_GRID = { x: PAGE_L.x + 12, y: 90, cw: 41, ch: 58, cols: 6, rows: 4 };
const BAG_GRID = { x: PAGE_L.x + 14, y: 92, cs: 40, cols: 6, rows: 4 };

function updateInventory(game, m) {
  const pr = game.profile;
  const tabs = INV_TABS.filter(t => invTabOpen(pr, t.id)).map(t => t.id);   // (a tab whose system is still locked is skipped: unlocks.js)
  const switchTab = d => { m.tab = tabs[(tabs.indexOf(m.tab) + d + tabs.length) % tabs.length]; m.cur = 0; m.scroll = 0; m.confirm = null; m.open = null; m.touched = false; m.fillSlot = null; m.placeCard = null; };
  if (m.open != null) return updateCardPopup(game, m);
  if (m.circuit && (hit('Tab', 'BracketRight', 'PageDown', 'BracketLeft', 'PageUp') || clicked(HOME_BTN.x, HOME_BTN.y, HOME_BTN.w, HOME_BTN.h) || INV_TABS.some(t => clicked(t.x, BOOK.y - 16, INV_TAB.w, 20)))) m.circuit = null;   // the tabs above the book still work
  if (m.circuit) return updateCircuit(game, m);   // the DECK screen (deckcircuit.js)
  if (m.picker) return updatePicker(game, m);
  if ((m.fillSlot != null || m.placeCard) && hit('Escape')) { m.fillSlot = null; m.placeCard = null; m.tab = 'deck'; return; }
  if (statPoints(pr) > 0 && clicked(STAT_BADGE.x, STAT_BADGE.y, STAT_BADGE.w, STAT_BADGE.h)) { m.tab = 'stats'; m.cur = 0; return; }
  if (hit('Tab', 'BracketRight', 'PageDown')) switchTab(1);
  if (hit('BracketLeft', 'PageUp')) switchTab(-1);
  INV_TABS.forEach(t => { if (invTabOpen(pr, t.id) && clicked(t.x, BOOK.y - 16, INV_TAB.w, 20)) { m.tab = t.id; m.cur = 0; m.scroll = 0; m.touched = false; m.fillSlot = null; m.placeCard = null; } });   // a tab switch ends 'pick a card for this slot'
  if (hit('Escape', 'KeyI')) { game.closeMenu(); return; }
  if (clicked(HOME_BTN.x, HOME_BTN.y, HOME_BTN.w, HOME_BTN.h) || hit('KeyT')) { if (typeof homeMenu === 'function') { game.closeMenu(); game.openMenu(homeMenu()); } else teleportHome(game); return; }   // (the HOME menu: teleport, or pick the home point)
  // equipment slots are clickable from every tab but LAYER (its right page is the mastery): open the bag filtered to that slot
  if (m.tab !== 'layer' && m.tab !== 'titles' && m.tab !== 'ki') for (const slot of GEAR_SLOTS) {
    const [x, y] = EQ_POS[slot];
    if (clicked(x, y, EQ_S, EQ_S)) { m.tab = 'bag'; m.slotFilter = slot; m.cur = 0; m.scroll = 0; m.open = null; m.fillSlot = null; m.placeCard = null; return; }
  }
  if (m.tab === 'deck') return updateDeckTab(game, m);
  if (m.tab === 'cards') return updateCardsTab(game, m);
  if (m.tab === 'stats') return updateStatsTab(game, m);
  if (m.tab === 'layer') return updateLayerTab(game, m);
  if (m.tab === 'titles') return updateTitlesTab(game, m);
  if (m.tab === 'ki') return updateKiTab(game, m);
  return updateBagTab(game, m);
}
function updateDeckTab(game, m) {
  const pr = game.profile, S = TF.slot;
  const openInfo = uid => { const fi = cardStacks(pr).findIndex(st => st.cards.some(c => c.uid === uid)); if (fi >= 0) { m.open = fi; m.touched = true; } };
  const L = TF.lens;
  if (mouse.click && Math.hypot(mouse.x - L.x, mouse.y - L.y) <= L.r + 1) { m.inspect = !m.inspect; return; }
  const F = TF.fusion;
  if (clicked(F.x, F.y, F.w, F.h)) { if (pr.fusion) openInfo(pr.fusion); else openMerge(game, m); return; }
  // the spell slots: a card comes back down to the hand; an empty slot becomes the one the next tap fills
  for (let i = 0; i < 3; i++) if (clicked(S.xs[i], S.y, S.w, S.h)) {
    const uid = pr.spells[i];
    if (uid && m.inspect) { openInfo(uid); return; }
    openPicker(pr, m, i, uid); return;   // pops up the card picker for this slot
  }
  // the mode tabs and element chips
  for (const t of TF_MODES) if (clicked(t.x, TF.scroll.bar - 5, t.w, 11)) { m.slotPick = null; if (t.id === 'deck') circuitOpen(pr, m); return; }
  for (const ch of tfChips(pr)) if (clicked(ch.x, TF.scroll.bar - 5, ch.w, 11)) { m.elFilter = ch.id; m.sx = 0; return; }
  // scrolling: the arrows, the mouse wheel, or ←/→
  const SC = TF.scroll, list = tfList(pr, m), vis = tfVisible(), maxS = Math.max(0, list.length - vis);
  if (clicked(SC.x - 20, SC.y, 16, SC.ch) || hit('ArrowLeft')) m.sx = Math.max(0, (m.sx || 0) - (hit('ArrowLeft') ? 1 : vis - 1));
  if (clicked(SC.x + SC.w + 4, SC.y, 16, SC.ch) || hit('ArrowRight')) m.sx = Math.min(maxS, (m.sx || 0) + (hit('ArrowRight') ? 1 : vis - 1));
  if (mouse.wheel) { if (hovered(SC.x - 20, SC.y - 6, SC.w + 40, SC.ch + 12)) m.sx = Math.max(0, Math.min(maxS, (m.sx || 0) + mouse.wheel)); mouse.wheel = 0; }
  // a card in the scroll: SPELL mode puts it on a spell key (or takes it off), DECK mode adds it to the deck or takes it out
  for (let i = 0; i < vis; i++) {
    const p = tfScrollPos(i), st = list[(m.sx || 0) + i]; if (!st || !clicked(p.x, p.y, SC.cw, SC.ch)) continue;
    if (m.inspect) { m.open = cardStacks(pr).indexOf(st); m.touched = true; return; }
    if (!st.c.fusion) { const sp = st.cards.find(x => pr.spells.includes(x.uid)); openPicker(pr, m, sp ? pr.spells.indexOf(sp.uid) : m.slotPick != null ? m.slotPick : Math.max(0, pr.spells.findIndex(u => !u)), st.c.uid); return; }
    const spellOf = st.cards.find(x => pr.spells.includes(x.uid)), inDeck = st.cards.find(x => pr.deck.includes(x.uid));
    if (st.c.fusion) { equipToSlot(game, st.c, 0); return; }   // a fusion card goes into the fusion socket
    if (spellOf) { pr.spells = pr.spells.map(u => u === spellOf.uid ? null : u); m.slotPick = null; game.save(); return; }
    const free = m.slotPick != null ? m.slotPick : pr.spells.findIndex(u => !u);
    if (free < 0) { game.toast('All three spell slots are full — tap a spell to put it back first', '#ffb88a'); return; }
    equipSpell(game, (inDeck || st.cards[0]).uid, free); m.slotPick = null; return;
  }
  // keys: Q/E/R put the card you point at on that key, X takes it out of the deck, B equips your best gear
  const hc = tfHovered(pr, m);
  const key = hit('KeyQ', 'Digit1') ? 0 : hit('KeyE', 'Digit2') ? 1 : hit('KeyR', 'Digit3') ? 2 : -1;
  if (key >= 0 && hc) equipSpell(game, hc.uid, key);
  if (hit('KeyX', 'Delete') && hc) { pr.deck = pr.deck.filter(u => u !== hc.uid); pr.spells = pr.spells.map(u => u === hc.uid ? null : u); game.save(); }
  if (hit('KeyD', 'Enter') && hc) openInfo(hc.uid);
  if (hit('KeyB')) bestGear(game);
}
// put a card on spell slot Q/E/R (0–2). Spells must be in the deck; when the deck is full the card takes the deck
// place of the card leaving that slot (or, for an empty slot, of the last deck card that is not a spell). A card
// moving between slots swaps with the one already there.
function equipSpell(game, uid, slot) {
  const pr = game.profile;
  if (!pr.deck.includes(uid)) {
    if (pr.deck.length >= deckMax(pr)) {
      const out = pr.spells[slot] && pr.deck.includes(pr.spells[slot]) ? pr.spells[slot] : [...pr.deck].reverse().find(u => !pr.spells.includes(u));
      if (!out) { game.toast('Deck is full — remove a card from the deck first', '#ff8a8a'); return false; }
      pr.deck[pr.deck.indexOf(out)] = uid;
    } else pr.deck.push(uid);
  }
  const from = pr.spells.indexOf(uid), was = pr.spells[slot];
  pr.spells = pr.spells.map(u => u === uid ? null : u); pr.spells[slot] = uid;
  if (from >= 0 && was && was !== uid && pr.deck.includes(was)) pr.spells[from] = was;
  game.save(); return true;
}
function bestGear(game) {
  const ch = equipBest(game.profile); game.save();
  game.toast(ch.length ? `Equipped best: ${ch.map(g => g.name).join(', ')}` : 'Already wearing your best gear', '#8fffd0');
}
// the collection scrolls by whole rows, with the wheel or by dragging the bar; the cursor moves with it (keepVisible would pull it back)
const CARD_BAR = { x: PAGE_L.x + PAGE_L.w - 13, y: CARD_GRID.y, w: 7, h: CARD_GRID.ch * CARD_GRID.rows - 14, minThumb: 22 };
const cardMaxScroll = n => Math.max(0, Math.ceil(n / CARD_GRID.cols) - CARD_GRID.rows);
function cardScrollTo(m, n, s) {
  const G = CARD_GRID; s = clamp(s, 0, cardMaxScroll(n)); if (s === m.scroll) return;
  m.cur = clamp(m.cur + (s - m.scroll) * G.cols, s * G.cols, Math.min(n - 1, (s + G.rows) * G.cols - 1)); m.scroll = s;
}
function updateCardScroll(m, n) {
  const B = CARD_BAR, max = cardMaxScroll(n);
  if (!m.wheelOn) { m.wheelOn = true; mouse.wheel = 0; }   // (scrolls from before the inventory opened don't count)
  if (mouse.wheel) { if (hovered(PAGE_L.x, PAGE_L.y, PAGE_L.w, PAGE_L.h)) cardScrollTo(m, n, m.scroll + mouse.wheel); mouse.wheel = 0; }
  if (!mouse.down) m.barDrag = false; else if (max > 0 && clicked(B.x - 3, B.y, B.w + 6, B.h)) m.barDrag = true;
  if (m.barDrag) { cardScrollTo(m, n, Math.round((mouse.y - B.y) / B.h * max)); return true; }
  return false;
}
function updateCardsTab(game, m) {
  const pr = game.profile, stacks = cardStacks(pr), list = stacks.map(st => st.c), G = CARD_GRID;
  if (updateCardScroll(m, list.length)) return;
  let mouseAct = false;
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i; if (idx >= list.length) break;
    if (clicked(G.x + (i % G.cols) * G.cw, G.y + Math.floor(i / G.cols) * G.ch, G.cw - 6, G.ch - 12)) { mouseAct = true; m.cur = idx; }
  }
  const k = gridNav(m, list.length, G.cols);
  if (k.l || k.r || k.u || k.d) m.touched = true;
  keepVisible(m, G.cols, G.rows);
  const item = list[m.cur];
  if (!item) return;
  if ((k.ok || mouseAct) && m.fillSlot != null) {   // came from a deck slot: equip straight into it
    const slot = m.fillSlot; m.fillSlot = null;
    equipToSlot(game, item, slot); m.tab = 'deck'; m.cur = Math.min(slot, 9); m.touched = true;
    return;
  }
  if (k.ok || mouseAct) { m.open = m.cur; m.touched = true; m.confirm = null; return; }   // open the card's detail popup
  if (!m.touched) return;
  const slot = hit('KeyQ', 'Digit1') ? 0 : hit('KeyE', 'Digit2') ? 1 : hit('KeyR', 'Digit3') ? 2 : -1;
  if (slot >= 0 && !item.fusion && equipSpell(game, item.uid, slot)) game.toast(`${cardName(item)} → spell ${'QER'[slot]}`, '#9fd8ff');
  if (hit('KeyG', 'Space') && item.fusion) { pr.fusion = pr.fusion === item.uid ? null : item.uid; game.save(); }
  if (hit('KeyX', 'Delete')) {
    const st = stacks[m.cur], t = spareOf(pr, st) || item;   // discard a spare copy first
    if (m.confirm === st.key) {
      pr.cards = pr.cards.filter(c => c !== t); pr.deck = pr.deck.filter(u => u !== t.uid);
      pr.spells = pr.spells.map(u => u === t.uid ? null : u); if (pr.fusion === t.uid) pr.fusion = null;
      pr.gold = (pr.gold || 0) + sellCard(t); m.confirm = null; game.save(); game.toast(`Sold ${cardName(t)} for ${sellCard(t)} G`, '#ffd23f');
    } else m.confirm = st.key;
  }
}
// The bag's filter cycles the six gear slots, then GOODS (Zenonia 2 potions, food, materials…)
const BAG_FILTERS = [...GEAR_SLOTS, 'goods'];
SLOT_LABEL.goods = 'GOODS';
function goodsList(pr) {
  return homeGoodsEntries(pr).filter(e => ITEMS[e.it.home].kind === 'seed').concat(goodsListZ2(pr));
}
// The FOOD tab: everything edible from home life (meals first, then bread and meat, then crops)
const FOOD_ORDER = { meal: 0, food: 1, crop: 2 };
function foodList(pr) {
  return homeGoodsEntries(pr).filter(e => ITEMS[e.it.home].kind !== 'seed')
    .sort((a, b) => FOOD_ORDER[ITEMS[a.it.home].kind] - FOOD_ORDER[ITEMS[b.it.home].kind] || ITEMS[b.it.home].sell - ITEMS[a.it.home].sell);
}
function goodsListZ2(pr) {
  return Object.keys(pr.goods || {}).map(Number).filter(i => pr.goods[i] > 0 && Z2_ITEM[i])
    .map(i => ({ idx: i, n: pr.goods[i], it: Z2_ITEM[i] }))
    .sort((a, b) => (GOODS_USE[b.it.sub] ? 1 : 0) - (GOODS_USE[a.it.sub] ? 1 : 0) || a.it.cat - b.it.cat || a.it.sub - b.it.sub || a.it.lv - b.it.lv);
}
function useGoods(game, e) {
  const pr = game.profile, use = GOODS_USE[e.it.sub], w = game.world, p = w && w.player;
  if (e.it.home) { useHomeItem(game, e.it.home); return; }
  if (!use) { game.toast(`${e.it.name}: ${goodsInfo(e.idx)}`, '#c9c1a8'); return; }
  if (use.box) {
    const tier = Math.min(9, e.it.lv > 1 ? 9 : 1 + Math.floor(Math.random() * 4));
    game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), tier, pr.cls) });
  } else if (p && !p.dead) {
    if (use.hp) heal(w, p, p.maxHp * use.hp);
    if (use.mp) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * use.mp);
    if (use.cure) p.status = {};
    game.toast(`${e.it.name} — ${use.what}${fedNote(healFeeds(game, use.hp || 0))}`, '#8fffd0');
  } else return;
  if (--pr.goods[e.idx] <= 0) delete pr.goods[e.idx];
  game.save();
}
function updateGoodsTab(game, m) {
  const pr = game.profile, list = goodsList(pr), G = BAG_GRID;
  let mouseAct = false;
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i; if (idx >= list.length) break;
    if (clicked(G.x + (i % G.cols) * G.cs, G.y + Math.floor(i / G.cols) * G.cs, G.cs - 4, G.cs - 4)) { mouseAct = m.cur === idx; m.cur = idx; }
  }
  const k = gridNav(m, list.length, G.cols);
  keepVisible(m, G.cols, G.rows);
  const e = list[m.cur];
  if (!e) return;
  if (k.ok || mouseAct) useGoods(game, e);
  if (hit('KeyX', 'Delete')) {
    if (m.confirm === 'g' + e.idx) { if (e.it.home) delete pr.items[e.it.home]; else delete pr.goods[e.idx]; m.confirm = null; game.save(); game.toast(`${e.it.name} discarded`, '#c9c1a8'); }
    else m.confirm = 'g' + e.idx;
  }
}
function updateBagTab(game, m) {
  if (hit('KeyF')) { m.slotFilter = m.slotFilter ? BAG_FILTERS[(BAG_FILTERS.indexOf(m.slotFilter) + 1) % BAG_FILTERS.length] : BAG_FILTERS[0]; m.cur = 0; m.scroll = 0; }
  if (hit('KeyG')) { m.slotFilter = m.slotFilter === 'goods' ? null : 'goods'; m.cur = 0; m.scroll = 0; }
  if (hit('KeyA') && hit('ShiftLeft')) m.slotFilter = null;
  if (clicked(PAGE_L.x + 14, 300, 120, 14)) { m.slotFilter = null; m.cur = 0; }
  if (clicked(PAGE_L.x + PAGE_L.w - 104, 300, 90, 14)) { m.slotFilter = 'goods'; m.cur = 0; m.scroll = 0; }
  if (m.slotFilter === 'goods') return updateGoodsTab(game, m);
  const pr = game.profile, list = sortedGear(pr, m.slotFilter), G = BAG_GRID;
  let mouseAct = false;
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i; if (idx >= list.length) break;
    if (clicked(G.x + (i % G.cols) * G.cs, G.y + Math.floor(i / G.cols) * G.cs, G.cs - 4, G.cs - 4)) { mouseAct = m.cur === idx; m.cur = idx; }   // first click selects, a second equips
  }
  const k = gridNav(m, list.length, G.cols);
  keepVisible(m, G.cols, G.rows);
  if (hit('KeyB')) bestGear(game);
  const item = list[m.cur];
  if (!item) return;
  if (k.ok || mouseAct) {   // equip (a click never takes off what you wear: U does)
    if (item.slot === 'weapon' && item.cls !== pr.cls) game.toast('That weapon is for another class', '#ff8a8a');
    else if (pr.eq[item.slot] === item.uid) game.toast(`${item.name} is equipped · U: take it off`, '#c9c1a8');
    else { pr.eq[item.slot] = item.uid; game.save(); game.toast(`Equipped ${item.name}`, '#8fffd0'); }
  }
  if (hit('KeyU') && pr.eq[item.slot] === item.uid) { pr.eq[item.slot] = null; game.save(); game.toast(`Took off ${item.name}`, '#c9c1a8'); }
  if (hit('KeyX', 'Delete')) {
    if (m.confirm === item.uid) {
      pr.gear = pr.gear.filter(g => g !== item); for (const s of GEAR_SLOTS) if (pr.eq[s] === item.uid) pr.eq[s] = null;
      pr.gold = (pr.gold || 0) + sellGear(item); m.confirm = null; game.save(); game.toast(`Sold ${item.name} for ${sellGear(item)} G`, '#ffd23f');
    } else m.confirm = item.uid;
  }
}

// ---------------------------------------------------------------- inventory drawing
function drawInventory(game, m, now) {
  if (m.lastTab !== m.tab) { if (m.lastTab) m.turnT = now; m.lastTab = m.tab; }
  drawBookChrome(m, now);
  m.tooltip = null;
  if (m.tab === 'deck') drawDeckPage(game, m, now);
  else if (m.tab === 'cards') drawCardsPage(game, m, now);
  else if (m.tab === 'stats') drawStatsPage(game, m, now);
  else if (m.tab === 'layer') drawLayerPage(game, m, now);
  else if (m.tab === 'titles') drawTitlesPage(game, m, now);
  else if (m.tab === 'ki') drawKiTab(game, m, now);
  else drawBagPage(game, m, now);
  if (m.tab === 'layer') drawLayerSkillsPage(game, m, now); else if (m.tab === 'titles') drawTitleDetailPage(game, m, now); else if (m.tab === 'ki') drawKiPage(game, m, now); else drawEquipPage(game, m, now);
  drawPageTurn(m, now);
  bookLighting(now);
  if (m.tooltip) m.tooltip();
  const hints = {
    deck: 'D: details · Q/E/R: set · X: remove · N / Shift+N: best / focus · H: finish synergy · L: lock · U: undo · O: sort · K: draw pile',   // (N and O: deckplus.js)
    cards: 'Click a card for details & actions · Q/E/R: spell slot · G: fusion slot · F: element · O: sort · L: lock · X×2: sell',
    bag: m.slotFilter === 'goods' ? 'Enter / click twice: use · G: back to gear · X×2: sell' : 'Enter / click ×2: equip · U: take off · F: filter · G: goods · B: best · O: sort · L: lock · X×2: sell · V×2: sell weaker',
    stats: `↑↓ choose · Enter / → / click +: spend a point · R: reset all points (free, from level ${RESET_LV})`,
    ki: 'Enter / click the button: put Ki on the Layer button, or go back to Layer',
    titles: '↑↓ choose a title · Enter / click WEAR: wear it or take it off · Y: the full Titles screen',
    layer: m.col === 1 ? '↑↓ choose a skill · Enter / click UP: spend this layer\'s XP · ← back to the layers' : '↑↓ choose · Enter / click: use this layer · → its mastery',
  }[m.tab];
  if (!m.picker && !m.circuit) text(hints + '   ·   Tab / [ ]: page   ·   Esc: close', VW / 2, 350, m.confirm ? '#ff8a8a' : '#c9c1a8', 7);
}

// THE DECK BOARD (after Triple Fantasy): a dark steel board on the left page. Three big slots across the top are
// your spells (Q / E / R) under a triangle emblem; the rest of your deck sits below as a hand of seven. Tap a hand
// card and it goes up into a spell slot (the one you picked, or the first free one); tap a slot's card and it comes
// back down. An empty hand space opens your collection to add a card. With the magnifier on, a tap shows the card's
// details instead. The fusion card waits in its socket top-left. (TF: the board's layout, updateDeckTab: the taps.)
const TF = {
  board: { x: PAGE_L.x + 4, y: 80, w: PAGE_L.w - 8, h: 244 },
  slot: { w: 64, h: 96, y: 124, xs: [PAGE_L.x + 27, PAGE_L.x + 103, PAGE_L.x + 179] },
  scroll: { x: PAGE_L.x + 22, y: 244, w: PAGE_L.w - 44, cw: 36, ch: 52, gap: 4, bar: 228 },
  fusion: { x: PAGE_L.x + 12, y: 86, w: 20, h: 27 }, lens: { x: PAGE_L.x + PAGE_L.w - 22, y: 98, r: 8 }, emblem: { x: PAGE_L.x + PAGE_L.w / 2, y: 98 },
};
// the card scroll: every card you own (one per stack), filtered by element, scrolled sideways
const tfVisible = () => Math.floor((TF.scroll.w + TF.scroll.gap) / (TF.scroll.cw + TF.scroll.gap));
const tfScrollPos = i => ({ x: TF.scroll.x + i * (TF.scroll.cw + TF.scroll.gap), y: TF.scroll.y });
function tfList(pr, m) { const st = cardStacks(pr); return m.elFilter ? st.filter(x => cardElement(x.c) === m.elFilter) : st; }
// the mode tabs and element chips above the scroll
function tfChips(pr) {
  const els = [...new Set(cardStacks(pr).map(x => cardElement(x.c)))].sort();
  const out = [{ id: null, label: 'ALL', w: 20 }, ...els.map(e => ({ id: e, label: EL_GLYPH[e] || '•', w: 12, col: TF_RING[e] }))];
  let x = PAGE_L.x + PAGE_L.w - 10; for (let i = out.length - 1; i >= 0; i--) { x -= out[i].w; out[i].x = x; x -= 2; }
  return out;
}
const TF_MODES = [{ id: 'spell', label: 'SPELL', x: PAGE_L.x + 10, w: 34 }, { id: 'deck', label: 'DECK', x: PAGE_L.x + 46, w: 34 }];
function drawDeckPage(game, m, now) {
  const pr = game.profile, B = TF.board, byId = id => pr.cards.find(c => c.uid === id);
  pageHeader('SPELL DECK', PAGE_L);
  // the board: dark slate, a steel rim, a faint grid of rivets
  ctx.save();
  const bg = ctx.createLinearGradient(0, B.y, 0, B.y + B.h); bg.addColorStop(0, '#462e1d'); bg.addColorStop(1, '#261910');
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * RES; ctx.fillStyle = bg; rrect(ctx, B.x, B.y, B.w, B.h, 6); ctx.fill(); ctx.restore();
  const rim = ctx.createLinearGradient(B.x, B.y, B.x + B.w, B.y + B.h); rim.addColorStop(0, '#c8d0de'); rim.addColorStop(0.5, '#6a7488'); rim.addColorStop(1, '#402a1b');
  ctx.strokeStyle = rim; ctx.lineWidth = 2; rrect(ctx, B.x + 1, B.y + 1, B.w - 2, B.h - 2, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; rrect(ctx, B.x + 4, B.y + 4, B.w - 8, B.h - 8, 4); ctx.stroke();
  // the emblem: a steel triangle wheel over the slots, glowing in the spells' element when all three share one
  const E = TF.emblem, sps = pr.spells.map(byId).filter(Boolean), els = [...new Set(sps.map(cardElement))], combo = sps.length === 3 && els.length === 1 ? els[0] : null;
  ctx.save(); ctx.translate(E.x, E.y);
  ctx.fillStyle = '#2c1d12'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a94a8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = combo ? TF_RING[combo] : '#6a5440'; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } ctx.closePath(); ctx.stroke();
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3, on = !!sps[i]; ctx.fillStyle = on ? '#ffd860' : '#563924'; ctx.beginPath(); ctx.arc(Math.cos(a) * 10, Math.sin(a) * 10, 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  const set = sps.length === 3 ? spellSet(sps.map(cardElement)) : null, pct = k => `+${Math.round(SPELL_SET[k] * 100)}%`;   // the spell set: triple, pair or mixed
  const setTxt = !set ? `SPELLS ${sps.length}/3` : set.kind === 'triple' ? `${ELEMENTS[set.lead].name.toUpperCase()} TRIPLE ${pct('triple')}` : set.kind === 'pair' ? `${ELEMENTS[set.lead].name.toUpperCase()} PAIR ${pct('pair')}` : `MIXED ${pct('mixed')} EACH`;
  text(setTxt, E.x + 20, E.y, set ? (set.lead ? TF_RING[set.lead] : '#e8d8ff') : '#9aa4b8', 6.4, 'left');
  // the fusion socket and the magnifier
  const F = TF.fusion, fz = byId(pr.fusion);
  if (fz) drawTFCard(fz, F.x, F.y, F.w, F.h, now); else drawTFSlot(F.x, F.y, F.w, F.h, 'G', false, now);
  text('FUSION', F.x + F.w + 4, F.y + F.h / 2, '#9aa4b8', 5.6, 'left');
  const L = TF.lens; ctx.fillStyle = m.inspect ? '#ffd860' : '#402a1b'; ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = m.inspect ? '#fff4c0' : '#8a94a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = m.inspect ? '#2a1404' : '#c8d0de'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(L.x - 1, L.y - 1, 3, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(L.x + 1.2, L.y + 1.2); ctx.lineTo(L.x + 4, L.y + 4); ctx.stroke();
  // the three spell slots
  const S = TF.slot;
  for (let i = 0; i < 3; i++) {
    const x = S.xs[i], c = byId(pr.spells[i]), hov = hovered(x, S.y, S.w, S.h), pick = m.slotPick === i;
    text('QER'[i], x + S.w / 2, S.y - 6, pick ? '#ffd860' : '#c8d0de', 8);
    if (c) drawTFCard(c, x, S.y - (hov ? 2 : 0), S.w, S.h, now, { name: true, sel: pick || hov });
    else drawTFSlot(x, S.y, S.w, S.h, 'QER'[i], pick || hov, now);
  }
  // the card scroll: mode tabs (what a tap does) and element chips, then your cards sideways with arrows at the ends
  const SC = TF.scroll, by = SC.bar;
  for (const t of TF_MODES) {
    if (t.id === 'deck') dcBadge(t.x + t.w / 2, by + 0.5, 10, now);
    const on = t.id === 'spell'; ctx.fillStyle = on ? '#5a3e26' : '#2c1d12'; rrect(ctx, t.x, by - 5, t.w, 11, 3); ctx.fill();
    ctx.strokeStyle = on ? '#ffd860' : '#6a5440'; ctx.lineWidth = 0.9; rrect(ctx, t.x + 0.4, by - 4.6, t.w - 0.8, 10.2, 3); ctx.stroke();
    text(t.label, t.x + t.w / 2, by + 0.6, on || t.id === 'deck' ? '#ffe9a8' : '#9aa4b8', 6);
  }
  text(`SPELLS ${pr.spells.filter(Boolean).length}/3`, PAGE_L.x + 86, by + 0.6, '#c8d0de', 6, 'left');
  for (const ch of tfChips(pr)) {
    const on = (m.elFilter || null) === ch.id; ctx.fillStyle = on ? (ch.col ? hexA(ch.col, 0.35) : '#5a3e26') : '#2c1d12'; rrect(ctx, ch.x, by - 5, ch.w, 11, 3); ctx.fill();
    ctx.strokeStyle = on ? (ch.col || '#ffd860') : '#5a4636'; ctx.lineWidth = 0.9; rrect(ctx, ch.x + 0.4, by - 4.6, ch.w - 0.8, 10.2, 3); ctx.stroke();
    text(ch.label, ch.x + ch.w / 2, by + 0.6, ch.col || (on ? '#ffe9a8' : '#9aa4b8'), ch.id ? 6.5 : 6);
  }
  const list = tfList(pr, m), vis = tfVisible(); m.sx = Math.max(0, Math.min(m.sx || 0, Math.max(0, list.length - vis)));
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, SC.x - 18, SC.y - 4, SC.w + 36, SC.ch + 8, 4); ctx.fill();   // the scroll's trough
  for (let i = 0; i < vis; i++) {
    const st = list[m.sx + i], p = tfScrollPos(i); if (!st) { drawTFSlot(p.x, p.y, SC.cw, SC.ch, '', false, now); continue; }
    const c = st.c, hov = hovered(p.x, p.y, SC.cw, SC.ch), si = st.cards.findIndex(x => pr.spells.includes(x.uid)), inDeck = st.cards.some(x => pr.deck.includes(x.uid));
    const badge = si >= 0 ? 'QER'[pr.spells.indexOf(st.cards[si].uid)] : pr.fusion && st.cards.some(x => x.uid === pr.fusion) ? 'G' : '';   // (no in-the-deck dot)
    drawTFCard(c, p.x, p.y - (hov ? 2 : 0), SC.cw, SC.ch, now, { sel: hov, badge });
    if (st.n > 1) text(`×${st.n}`, p.x + SC.cw / 2, p.y - 4, '#ffe9a8', 5.6);
  }
  for (const [ax, dir] of [[SC.x - 12, -1], [SC.x + SC.w + 12, 1]]) {   // the arrows
    const can = dir < 0 ? m.sx > 0 : m.sx + vis < list.length;
    ctx.fillStyle = can ? '#c8d0de' : '#563924'; ctx.beginPath(); ctx.moveTo(ax + dir * 5, SC.y + SC.ch / 2); ctx.lineTo(ax - dir * 3, SC.y + SC.ch / 2 - 7); ctx.lineTo(ax - dir * 3, SC.y + SC.ch / 2 + 7); ctx.closePath(); ctx.fill();
  }
  if (!list.length) text('No cards of this element', PAGE_L.x + PAGE_L.w / 2, SC.y + SC.ch / 2, '#9aa4b8', 7);
  // the line under the hand: the card you point at, or what to do
  const hc = tfHovered(pr, m), iy = TF.scroll.y + TF.scroll.ch + 9;
  if (hc) {
    const sp = cardSpell(hc), pv = cardPassives(hc)[0];
    text(`${cardName(hc)} · ${sp ? `${sp.name} (${ELEMENTS[sp.el].name})` : `Fusion · ${hc.fusion.length} monsters`}`, PAGE_L.x + PAGE_L.w / 2, iy, '#f0e8d8', 6.8);   // (a fused card has no spell of its own)
    if (pv) text(`${passiveName(pv)}: ${PASSIVES[pv.id].fmt(passiveValue(pv.id, pv.tier))}`, PAGE_L.x + PAGE_L.w / 2, iy + 9, '#9fd8ff', 6.2);
  } else text(m.slotPick != null ? `Tap a card below for slot ${'QER'[m.slotPick]}` : m.inspect ? 'Magnifier on: tap a card for its details' : 'Tap a card to make it a spell · tap a spell to put it back', PAGE_L.x + PAGE_L.w / 2, iy + 4, '#9aa4b8', 6.4);
  if (m.circuit) m.tooltip = () => drawCircuit(game, m, now);
  if (m.picker) m.tooltip = () => drawPicker(game, m, now);
  const ost = m.open != null && cardStacks(pr)[m.open];   // a card's info popup, opened from this page
  if (ost) { m.stack = ost; m.tooltip = () => drawCardPopup(game, m, ost.c, now); }
}
const hovered = (x, y, w, h) => mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
function tfHovered(pr, m) {
  const byId = id => pr.cards.find(c => c.uid === id), S = TF.slot;
  for (let i = 0; i < 3; i++) if (hovered(S.xs[i], S.y, S.w, S.h)) return byId(pr.spells[i]);
  const list = tfList(pr, m);
  for (let i = 0; i < tfVisible(); i++) { const p = tfScrollPos(i), st = list[(m.sx || 0) + i]; if (st && hovered(p.x, p.y, TF.scroll.cw, TF.scroll.ch)) return st.c; }
  return null;
}
// THE CARD PICKER (after Triple Fantasy): tap a spell slot (or a card in the scroll) and a carousel pops up over the
// book: the card in the middle big with its spell and passive, its neighbours smaller and fading to each side. Scroll
// with the wheel, left/right (A/D) or the side arrows, or tap a side card to bring it to the middle; the main button
// (Enter, or a tap on the middle card) puts it on the slot. Q/E/R set it
// straight onto a key.
const PICK = { x: 40, y: 34, w: 560, h: 300, cy: 157, card: [104, 150], steps: [0, 100, 176, 232, 270], scale: [1, 0.7, 0.52, 0.4, 0.3], btn: { w: 116, h: 20, y: 296 } };
function pickerList(pr, m) { return tfList(pr, m).filter(st => !st.c.fusion); }
function openPicker(pr, m, slot, uid) {
  const list = pickerList(pr, m), i = uid ? list.findIndex(st => st.cards.some(c => c.uid === uid)) : -1;
  m.picker = { slot, idx: Math.max(0, i), pos: Math.max(0, i) };
}
// where the card d places from the middle sits and how big it is (d can be fractional while it glides)
function pickerRect(d) {
  const a = Math.min(Math.abs(d), PICK.steps.length - 1), i = Math.floor(a), f = a - i, j = Math.min(i + 1, PICK.steps.length - 1);
  const off = PICK.steps[i] + (PICK.steps[j] - PICK.steps[i]) * f, sc = PICK.scale[i] + (PICK.scale[j] - PICK.scale[i]) * f;
  const w = PICK.card[0] * sc, h = PICK.card[1] * sc, cx = VW / 2 + Math.sign(d) * off;
  return { x: cx - w / 2, y: PICK.cy - h / 2 + (1 - sc) * 8, w, h, a };
}
function pickerBtns(p, pr, st) {
  const B = PICK.btn, cx = VW / 2, out = [];
  const here = st && st.cards.some(x => x.uid === pr.spells[p.slot]);
  out.push({ act: here ? 'remove' : 'select', label: here ? `TAKE OFF ${'QER'[p.slot]}` : `SET ON ${'QER'[p.slot]}`, x: cx - B.w / 2, w: B.w });
  out.push({ act: 'close', label: 'CANCEL', x: cx + B.w / 2 + 8, w: 56 });
  return out;
}
const PICK_KEYS = i => ({ x: VW / 2 - 51 + i * 36, y: PICK.y + 26, w: 30, h: 14 });
const PICK_MODE = t => ({ x: PICK.x + 12 + (t.id === 'deck' ? 38 : 0), y: PICK.y + 8, w: 34, h: 12 });
function updatePicker(game, m) {
  const pr = game.profile, p = m.picker, list = pickerList(pr, m), n = list.length;
  const go = d => { p.idx = Math.max(0, Math.min(n - 1, p.idx + d)); };
  if (hit('Escape') || (mouse.click && !hovered(PICK.x, PICK.y, PICK.w, PICK.h))) { m.picker = null; return; }
  if (hit('ArrowLeft', 'KeyA')) go(-1);
  if (hit('ArrowRight', 'KeyD')) go(1);
  if (mouse.wheel) { go(Math.sign(mouse.wheel)); mouse.wheel = 0; }
  if (clicked(PICK.x + 6, PICK.cy - 20, 22, 40)) { go(-1); return; }
  if (clicked(PICK.x + PICK.w - 28, PICK.cy - 20, 22, 40)) { go(1); return; }
  for (let i = 0; i < 3; i++) { const K = PICK_KEYS(i); if (clicked(K.x, K.y, K.w, K.h)) { p.slot = i; return; } }
  for (const t of TF_MODES) { const R = PICK_MODE(t); if (clicked(R.x, R.y, R.w, R.h)) { if (t.id === 'deck') { m.picker = null; circuitOpen(pr, m); } return; } }
  const st = list[p.idx];
  const act = a => {
    if (a === 'close') { m.picker = null; return; }
    if (!st) return;
    if (a === 'remove') { pr.spells[p.slot] = null; game.save(); m.picker = null; return; }
    const own = st.cards.find(x => pr.spells.includes(x.uid)) || st.cards.find(x => pr.deck.includes(x.uid)) || st.cards[0];
    if (equipSpell(game, own.uid, p.slot) !== false) m.picker = null;
  };
  for (const b of pickerBtns(p, pr, st)) if (clicked(b.x, PICK.btn.y, b.w, PICK.btn.h)) { act(b.act); return; }
  if (hit('Enter', 'Space')) { act(pickerBtns(p, pr, st)[0].act); return; }
  const key = hit('KeyQ', 'Digit1') ? 0 : hit('KeyE', 'Digit2') ? 1 : hit('KeyR', 'Digit3') ? 2 : -1;
  if (key >= 0 && st) { p.slot = key; act('select'); return; }
  // a tap on a card: the middle one is chosen, a side one glides to the middle
  for (let d = -4; d <= 4; d++) {
    const i = p.idx + d; if (i < 0 || i >= n) continue;
    const R = pickerRect(d); if (!clicked(R.x, R.y, R.w, R.h)) continue;
    if (d === 0) act(pickerBtns(p, pr, st)[0].act); else p.idx = i;
    return;
  }
}
function drawPicker(game, m, now) {
  const pr = game.profile, p = m.picker, list = pickerList(pr, m), n = list.length, P = PICK;
  p.idx = Math.max(0, Math.min(p.idx, n - 1)); p.pos += (p.idx - p.pos) * 0.22; if (Math.abs(p.idx - p.pos) < 0.01) p.pos = p.idx;
  ctx.fillStyle = 'rgba(4,6,12,0.78)'; ctx.fillRect(0, 0, VW, VH);
  // the panel: the deck board's slate and steel rim
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 14 * RES;
  const bg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); bg.addColorStop(0, '#462e1d'); bg.addColorStop(1, '#20150d');
  ctx.fillStyle = bg; rrect(ctx, P.x, P.y, P.w, P.h, 8); ctx.fill(); ctx.restore();
  const rim = ctx.createLinearGradient(P.x, P.y, P.x + P.w, P.y + P.h); rim.addColorStop(0, '#e0e6f0'); rim.addColorStop(0.45, '#7a8498'); rim.addColorStop(1, '#3a2618');
  ctx.strokeStyle = rim; ctx.lineWidth = 2.2; rrect(ctx, P.x + 1.1, P.y + 1.1, P.w - 2.2, P.h - 2.2, 8); ctx.stroke();
  // header: mode tabs, the title, the count; the spell keys under the title
  for (const t of TF_MODES) {
    const R = PICK_MODE(t), on = t.id === 'spell'; if (t.id === 'deck') dcBadge(R.x + R.w / 2, R.y + R.h / 2, 11, now);
    ctx.fillStyle = on ? '#5a3e26' : '#2c1d12'; rrect(ctx, R.x, R.y, R.w, R.h, 3); ctx.fill();
    ctx.strokeStyle = on ? '#ffd860' : '#6a5440'; ctx.lineWidth = 0.9; rrect(ctx, R.x + 0.4, R.y + 0.4, R.w - 0.8, R.h - 0.8, 3); ctx.stroke();
    text(t.label, R.x + R.w / 2, R.y + 6.4, on || t.id === 'deck' ? '#ffe9a8' : '#9aa4b8', 6);
  }
  goldTitle('CHOOSE A SPELL', VW / 2, P.y + 14, 11, now);
  text(n ? `${p.idx + 1} / ${n}` : '', P.x + P.w - 14, P.y + 14, '#9aa4b8', 7, 'right');
  for (let i = 0; i < 3; i++) {
    const K = PICK_KEYS(i), on = p.slot === i, has = !!pr.spells[i];
    ctx.fillStyle = on ? '#6a4a10' : '#2c1d12'; rrect(ctx, K.x, K.y, K.w, K.h, 3); ctx.fill();
    ctx.strokeStyle = on ? '#fff4c0' : '#6a5440'; ctx.lineWidth = 0.9; rrect(ctx, K.x + 0.4, K.y + 0.4, K.w - 0.8, K.h - 0.8, 3); ctx.stroke();
    const ks = 'QER'[i] + (has ? ' ●' : ''); if (on) text(ks, K.x + K.w / 2, K.y + 7.4, '#fff4c0', 7.5); else text(ks, K.x + K.w / 2, K.y + 7.4, '#c8d0de', 7);
  }
  if (!n) text('No cards to choose from', VW / 2, P.cy, '#9aa4b8', 9);
  // the carousel, the far cards first
  ctx.save(); rrect(ctx, P.x + 30, P.y + 44, P.w - 60, 192, 4); ctx.clip();
  const order = []; for (let i = 0; i < n; i++) { const d = i - p.pos; if (Math.abs(d) < 4.6) order.push([i, d]); }
  order.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [i, d] of order) {
    const st = list[i], R = pickerRect(d), si = st.cards.findIndex(x => pr.spells.includes(x.uid));
    const badge = si >= 0 ? 'QER'[pr.spells.indexOf(st.cards[si].uid)] : '';   // (only the key it is set on: no in-the-deck dot)
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, 1.15 - R.a * 0.22)) * (R.a > 3.6 ? Math.max(0, 4.6 - R.a) : 1);
    if (R.a < 0.5) { ctx.shadowColor = TF_RING[cardElement(st.c)] || '#ffd860'; ctx.shadowBlur = 18 * RES; ctx.fillStyle = '#22160e'; rrect(ctx, R.x, R.y, R.w, R.h, 8); ctx.fill(); ctx.shadowBlur = 0; }
    drawTFCard(st.c, R.x, R.y, R.w, R.h, now, { name: R.a < 0.5, sel: R.a < 0.5, badge });
    if (R.a > 0.5) { ctx.fillStyle = `rgba(4,6,12,${Math.min(0.55, R.a * 0.18)})`; rrect(ctx, R.x, R.y, R.w, R.h, 4); ctx.fill(); }
    if (st.n > 1 && R.a < 0.5) text(`×${st.n}`, R.x + R.w / 2, R.y - 6, '#ffe9a8', 7);
    ctx.restore();
  }
  ctx.restore();
  for (const [ax, dir] of [[P.x + 17, -1], [P.x + P.w - 17, 1]]) {   // the side arrows
    const can = dir < 0 ? p.idx > 0 : p.idx < n - 1, hov = hovered(ax - 11, P.cy - 20, 22, 40);
    ctx.fillStyle = can ? (hov ? '#ffd860' : '#c8d0de') : '#563924'; ctx.beginPath(); ctx.moveTo(ax + dir * 7, P.cy); ctx.lineTo(ax - dir * 5, P.cy - 11); ctx.lineTo(ax - dir * 5, P.cy + 11); ctx.closePath(); ctx.fill();
  }
  // the middle card's spell and passive
  const st = list[p.idx];
  if (st) {
    const c = st.c, sp = cardSpell(c), pv = cardPassives(c)[0];
    text(`${cardName(c)}  ·  RANK ${RANKS[c.tier]}`, VW / 2, 248, '#ffffff', 8.5);
    text(sp ? `${sp.name} (${ELEMENTS[sp.el].name}) · ${sp.stat ? sp.desc : `${sp.power} power`} · ${sp.mp} MP` : `Fusion · ${c.fusion.length} monsters · ${fusionPower(c)} power`, VW / 2, 261, '#f0c27a', 7);
    if (pv) text(`${passiveName(pv)}: ${PASSIVES[pv.id].fmt(passiveValue(pv.id, pv.tier))}`, VW / 2, 273, '#9fd8ff', 6.6);
  }
  // the buttons
  for (const b of pickerBtns(p, pr, st)) {
    const main = b.act !== 'close';
    popupButton({ label: b.label, act: b.act === 'remove' ? 'undeck' : b.act === 'close' ? 'close' : 'deck', col: main ? '#ffd860' : '#c8d0de', x: b.x, y: P.btn.y, w: b.w, h: P.btn.h, primary: b.act === 'select', danger: b.act === 'remove' }, now);
  }
  text('←/→ or wheel: scroll · tap a side card to bring it in · Enter / tap the middle card: choose · Q/E/R: set on a key · Esc: close', VW / 2, 350, '#c9c1a8', 7);
}
// The hero stands in the gap between the top row of cards and the name plate; at this size his head clears the cards.
const DECK_HERO_SCALE = 1.6;
// The seal behind the hero: a warm wash, then an engraved double ring in brown ink and gold leaf with tick marks, a
// slowly turning band of rune dots, and a six-point star inscribed inside — the same ink and gilt as the page rules.
// a raised brass/leather plate
function plate3D(x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#5a3a22'); g.addColorStop(1, '#2a160a');
  ctx.fillStyle = g; rrect(ctx, x, y, w, h, 5); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#e0b060'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,170,0.35)'; ctx.beginPath(); ctx.moveTo(x + 4, y + 2); ctx.lineTo(x + w - 4, y + 2); ctx.stroke();
}
// a recessed, empty card socket carved into the page
function emptySlot3D(x, y, w, h, sel) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(70,40,15,0.45)'); g.addColorStop(1, 'rgba(120,80,40,0.18)');
  ctx.fillStyle = g; rrect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,5,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 0.5, y + h - 2); ctx.lineTo(x + 0.5, y + 0.5); ctx.lineTo(x + w - 2, y + 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,200,0.5)';
  ctx.beginPath(); ctx.moveTo(x + w - 0.5, y + 2); ctx.lineTo(x + w - 0.5, y + h - 0.5); ctx.lineTo(x + 2, y + h - 0.5); ctx.stroke();
  ink('+', x + w / 2, y + h / 2, 'rgba(90,60,30,0.6)', 12, 'center');
  if (sel) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; rrect(ctx, x - 2, y - 2, w + 4, h + 4, 4); ctx.stroke(); }
  ctx.restore();
}

// Right page: a dense character sheet — gear, vitals, stats, spells, fusion and every active passive
function drawEquipPage(game, m, now) {
  const pr = game.profile, st = profileStats(pr), P = PAGE_R, X0 = P.x + 12, X1 = P.x + P.w - 12;
  goldTitle('CHARACTER', P.x + P.w / 2, 66, 12, now);
  // gear row
  for (const slot of GEAR_SLOTS) {
    const [x, y] = EQ_POS[slot];
    const g = pr.gear.find(it => it.uid === pr.eq[slot]);
    const up = pr.gear.some(it => it.slot === slot && it !== g && isUpgrade(pr, it));
    drawGearSlot(g, x, y, EQ_S, now, { up, sel: m.tab === 'bag' && m.slotFilter === slot, slot });
    ink(SLOT_LABEL[slot], x + EQ_S / 2, y + EQ_S + 8, INK_SOFT, 5.8, 'center');
  }
  // identity line
  const lv = pr.lv || 1;
  ink(`LV ${lv}  ${className(pr.cls).toUpperCase()}`, X0, 134, INK, 9);
  if (statPoints(pr) > 0) drawStatBadge(statPoints(pr), now);
  else { const W = wornSets(pr), S = Object.keys(W).sort((a, b) => W[b].n - W[a].n)[0]; if (S) ink(`${GEAR_SETS[S].name} ${W[S].n}/6`, X1, 134, '#2a5a8a', 8, 'right'); else ink((pr.look && pr.look.name) || 'Hero', X1, 134, INK_SOFT, 8.5, 'right'); }
  sectionRule(140);
  // the full stat sheet: core stats, then offence, defence and sustain (passives from deck, gear and fusion included)
  const pv = k => st.passives[k] || 0, pc = v => `${Math.round(v)}%`;
  const crit = st.crit + Math.round(pv('crit')), mamp = Math.round((CLASSES[pr.cls].style === 'mage' ? 1.3 : 1) * (1 + st.atk / 40) * 100);
  const sheet = [
    ['MAX HP', st.hp, '#b8301a'], ['MAX MP', st.mp, '#2a6ad0'], ['ATK', st.atk, '#a8461c'],
    ['DEF', st.def, '#5a6a7a'], ['SPEED', st.spd, null], ['CRIT', crit + '%', '#c8761c'],
    ['P.ATK', Math.round(st.atk * (1 + pv('brutal') / 100)), null], ['M.AMP', mamp + '%', '#7a3ac8'], ['ATK SPD', '+' + pc(pv('frenzy')), null],
    ['MOVE', '+' + pc(pv('swift')), null], ['GUARD', '−' + pc(pv('hide')), null], ['DODGE', pc(pv('evade')), null],
    ['LIFE STEAL', pc(pv('vamp')), null], ['REGEN', pv('regen').toFixed(2) + '%/s', null], ['MP REGEN', (MP_REGEN + MANA_FONT_MP * pv('mana') / 100).toFixed(2) + '/s', null],
    ['THORNS', pc(pv('thorns')), null], ['SHIELD', pc(pv('barrier')), null], ['LAST STAND', '+' + pc(pv('last')), null],
  ];
  inset3D(X0 - 2, 141.5, X1 - X0 + 4, 45);
  sheet.forEach(([k, v, col], i) => {   // three columns of six rows
    const cw = (X1 - X0) / 3, cx = X0 + 3 + (i % 3) * cw, y = 146.5 + Math.floor(i / 3) * 6.8;
    const dim = typeof v === 'string' && /^[+−]?0(\.0)?%/.test(v);   // a zero reads softer
    ink(k, cx, y, INK_SOFT, 5.4); ink(String(v), cx + cw - 7, y, dim ? 'rgba(90,60,30,0.45)' : col || INK, 6, 'right');
  });
  // spells
  sectionHead('SPELLS  (Q · E · R)', 192);
  const byId = id => pr.cards.find(c => c.uid === id);
  pr.spells.forEach((u, i) => {
    const y = 203 + i * 12, c = byId(u);
    keyGem('QER'[i], X0 + 1, y);
    if (!c || c.fusion) { ink('— empty —', X0 + 14, y, 'rgba(90,60,30,0.6)', 7, 'left', false); return; }
    const sp = cardSpell(c);
    const stats = `${sp.stat || `${sp.power} pow`} · ${sp.mp} MP · ${(sp.cd / 1000).toFixed(1)}s`, left = X0 + 14 + textW(sp.name, 7.2) + 6, room = X1 - textW(stats, 6.6, false) - 6 - left;
    const kind = [sp.sup ? sp.sup.label : `${ELEMENTS[sp.el].name} ${ARCH[sp.arch].name}`, ELEMENTS[sp.el].name].find(s => textW(s, 6.8, false) <= room);
    ink(sp.name, X0 + 14, y, '#3a2414', 7.2); if (kind) ink(kind, left, y, EL_INK[sp.el], 6.8, 'left', false); ink(stats, X1, y, INK_SOFT, 6.6, 'right', false);
  });
  // fusion
  const fz = byId(pr.fusion);
  sectionHead('FUSION  (G)', 242);
  if (fz) {
    ink(`${fz.name}`, X0, 253, '#3a2414', 7.2);
    ink(`${RANKS[fz.tier]} · power ${fusionPower(fz)} · ${fz.fusion.length} monsters`, X1, 253, INK_SOFT, 6.6, 'right', false);
  } else ink('No fusion card yet: tap the socket on the Spell Deck page', X0, 253, 'rgba(90,60,30,0.6)', 7, 'left', false);
  // every active passive (deck + gear + fusion), two columns
  const pas = Object.entries(st.passives).sort((a, b) => b[1] / PASSIVES[b[0]].cap - a[1] / PASSIVES[a[0]].cap);
  sectionHead(`ACTIVE PASSIVES  (${pas.length})`, 266);
  pas.slice(0, 12).forEach(([id, v], i) => {
    const cx = X0 + (i % 2) * 124, y = 277 + Math.floor(i / 2) * 8.4;
    const capped = v >= PASSIVES[id].cap - 0.01;
    ink(PASSIVES[id].name, cx, y, '#2a5a8a', 6.6);
    ink((v < 10 ? v.toFixed(1) : Math.round(v)) + (capped ? ' max' : ''), cx + 118, y, capped ? '#b04010' : INK, 6.6, 'right');
  });
  if (!pas.length) ink('Equip cards in your deck to gain their passives', X0, 278, 'rgba(90,60,30,0.6)', 7, 'left', false);
}
// element colours dark enough to read on parchment
const EL_INK = { fire: '#c84a10', ice: '#1a7aa8', lightning: '#9a8a00', earth: '#8a5a20', wind: '#1a8a4a', dark: '#6a2aa8', poison: '#4a8a10', holy: '#a8761c' };
function sectionRule(y) {
  ctx.strokeStyle = 'rgba(154,164,184,0.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(PAGE_R.x + 12, y); ctx.lineTo(PAGE_R.x + PAGE_R.w - 12, y); ctx.stroke();
}
function sectionHead(str, y) {
  // a small red ribbon banner with forked tail, then a gilt rule
  const x = PAGE_R.x + 9, w = textW(str, 7) + 14;
  ctx.save(); ctx.shadowColor = 'rgba(60,20,0,0.45)'; ctx.shadowBlur = 2 * RES; ctx.shadowOffsetY = 1 * RES;
  const g = ctx.createLinearGradient(0, y - 5, 0, y + 5);
  g.addColorStop(0, '#c83a2a'); g.addColorStop(1, '#7a1a10');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + w, y - 5); ctx.lineTo(x + w - 4, y); ctx.lineTo(x + w, y + 5); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 1, y - 4, w - 3, 1);
  text(str, x + 5, y + 0.3, '#fff1d8', 7, 'left');
  const gl = ctx.createLinearGradient(x + w + 2, 0, PAGE_R.x + PAGE_R.w - 12, 0);
  gl.addColorStop(0, 'rgba(176,120,40,0.8)'); gl.addColorStop(1, 'rgba(176,120,40,0)');
  ctx.fillStyle = gl; ctx.fillRect(x + w + 2, y - 0.5, PAGE_R.x + PAGE_R.w - 12 - x - w - 2, 1);
}

function drawCardsPage(game, m, now) {
  const pr = game.profile, stacks = cardStacks(pr), list = stacks.map(st => st.c), G = CARD_GRID;
  pageHeader(m.fillSlot != null ? `CHOOSE A CARD · SLOT ${m.fillSlot + 1}` : (m.cardEl ? `${ELEMENTS[m.cardEl].name.toUpperCase()} CARDS (${list.length})` : `CARD COLLECTION (${pr.cards.length}/120)`), PAGE_L);
  if (m.fillSlot != null) ink('Click a card to equip it into that deck slot · Esc: cancel', PAGE_L.x + PAGE_L.w / 2, 82, '#2a7a2a', 7, 'center', false);
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i;
    const x = G.x + (i % G.cols) * G.cw, y = G.y + Math.floor(i / G.cols) * G.ch;
    if (idx >= list.length) { ctx.strokeStyle = 'rgba(110,80,40,0.25)'; rrect(ctx, x, y, G.cw - 8, G.ch - 14, 3); ctx.stroke(); continue; }
    const c = list[idx];
    const badge = pr.fusion === c.uid ? 'G' : pr.spells.includes(c.uid) ? 'QER'[pr.spells.indexOf(c.uid)] : '';   // (no in-the-deck dot)
    const n = stacks[idx].n;
    if (n > 1) {   // a stack: two card edges peek out behind, and a count chip
      for (let k = Math.min(2, n - 1); k >= 1; k--) { ctx.fillStyle = k === 2 ? 'rgba(60,40,20,0.35)' : 'rgba(60,40,20,0.55)'; rrect(ctx, x + 3 + k * 1.6, y + 2 - k * 1.6, G.cw - 10, G.ch - 12, 3); ctx.fill(); }
    }
    drawCollectionTile(c, x, y, G.cw - 6, G.ch - 8, now, { sel: m.touched && idx === m.cur, badge });
    if (n > 1) {
      const s = `×${n}`, cw = textW(s, 6.5) + 6, cx = x + (G.cw - 6) / 2 - cw / 2, cy = y - 3;   // (on the top edge: the stats sit at the foot)
      ctx.fillStyle = '#24180f'; rrect(ctx, cx, cy, cw, 9, 3); ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.7; rrect(ctx, cx + 0.4, cy + 0.4, cw - 0.8, 8.2, 3); ctx.stroke();
      text(s, cx + cw / 2, cy + 4.7, '#ffe9a8', 6.5);
    }
  }
  if (!list.length) ink('No cards yet — hunt monsters in the Wilds!', PAGE_L.x + PAGE_L.w / 2, 190, INK_SOFT, 9, 'center');
  const max = cardMaxScroll(list.length), B = CARD_BAR;
  if (max > 0) {   // the scrollbar
    const th = Math.max(B.minThumb, B.h * G.rows / (max + G.rows)), ty = B.y + (B.h - th) * m.scroll / max, g = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); g.addColorStop(0, '#fff0b8'); g.addColorStop(0.5, '#e0a832'); g.addColorStop(1, '#8a5a14');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill(); ctx.fillStyle = g; rrect(ctx, B.x, ty, B.w, th, 3); ctx.fill();
  }
  // a clicked card opens as a detail popup with its actions (drawn last, over the pages)
  const st = m.open != null && stacks[m.open];
  if (st) { m.stack = st; m.tooltip = () => drawCardPopup(game, m, st.c, now); }
}

function drawGoodsPage(game, m, now) {
  const pr = game.profile, list = goodsList(pr), G = BAG_GRID;
  pageHeader(`BAG · GOODS (${list.reduce((s, e) => s + e.n, 0)})`, PAGE_L);
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i;
    const x = G.x + (i % G.cols) * G.cs, y = G.y + Math.floor(i / G.cols) * G.cs;
    if (idx >= list.length) { ctx.strokeStyle = 'rgba(110,80,40,0.25)'; rrect(ctx, x, y, G.cs - 4, G.cs - 4, 3); ctx.stroke(); continue; }
    const e = list[idx];
    drawGearSlot({ tier: e.it.tier, icon: e.it.home ? itemIcon(e.it.home) : ITEM2_BASE + e.idx }, x, y, G.cs - 4, now, { sel: idx === m.cur, badge: e.n > 1 ? '×' + e.n : '' });
  }
  if (!list.length) ink('No goods yet — monsters and chests drop them.', PAGE_L.x + PAGE_L.w / 2, 190, INK_SOFT, 9, 'center');
  const e = list[m.cur], y0 = G.y + G.rows * G.cs + 2;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, PAGE_L.x + 10, y0, PAGE_L.w - 20, PAGE_L.y + PAGE_L.h - y0 - 8, 4); ctx.fill();
  ink('click here: show gear', PAGE_L.x + 14, 304, INK_SOFT, 7);
  if (e) {
    ink(`${e.it.name}  ×${e.n}`, PAGE_L.x + 16, y0 + 9, INK, 9);
    const H = e.it.home && ITEMS[e.it.home];
    ink(H ? (H.tool ? 'TOOL' : H.use ? 'FARM GOODS' : H.kind === 'seed' ? 'SEEDS' : H.kind === 'crop' ? 'CROP · EDIBLE' : H.kind === 'rare' ? 'RARE CROP' : 'FOOD') : GOODS_USE[e.it.sub] ? 'USABLE' : e.it.cat === 3 ? 'MATERIAL' : 'GOODS', PAGE_L.x + PAGE_L.w - 16, y0 + 9, '#2a7a2a', 8, 'right');
    inkWrap(H ? `${H.desc}${H.hunger ? ` · +${H.hunger} hunger · Enter / click again: eat` : ''}` : goodsInfo(e.idx) + (GOODS_USE[e.it.sub] ? ' · Enter / click again: use' : ''), PAGE_L.x + 16, y0 + 22, PAGE_L.w - 32, 7.5, '#2a5a8a', 10);
  }
}
function drawBagPage(game, m, now) {
  if (m.slotFilter === 'goods') return drawGoodsPage(game, m, now);
  const pr = game.profile, list = sortedGear(pr, m.slotFilter), G = BAG_GRID;
  pageHeader(m.slotFilter ? `BAG · ${SLOT_LABEL[m.slotFilter]}` : `BAG (${pr.gear.length}/80)`, PAGE_L);
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i;
    const x = G.x + (i % G.cols) * G.cs, y = G.y + Math.floor(i / G.cols) * G.cs;
    if (idx >= list.length) { ctx.strokeStyle = 'rgba(110,80,40,0.25)'; rrect(ctx, x, y, G.cs - 4, G.cs - 4, 3); ctx.stroke(); continue; }
    const g = list[idx];
    drawGearSlot(g, x, y, G.cs - 4, now, { sel: idx === m.cur, badge: pr.eq[g.slot] === g.uid ? 'E' : '', up: pr.eq[g.slot] !== g.uid && isUpgrade(pr, g) });
  }
  if (!list.length) ink('Nothing here yet.', PAGE_L.x + PAGE_L.w / 2, 190, INK_SOFT, 9, 'center');
  const g = list[m.cur];
  const y0 = G.y + G.rows * G.cs + 2;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, PAGE_L.x + 10, y0, PAGE_L.w - 20, PAGE_L.y + PAGE_L.h - y0 - 8, 4); ctx.fill();
  if (!g || !g.set) {   // (a set piece needs this row for its set; the keys are in the bar below either way)
    ink(m.slotFilter ? 'click here: show all' : 'F: filter by slot', PAGE_L.x + 14, 304, INK_SOFT, 7);
    ink('G / click: GOODS ▸', PAGE_L.x + PAGE_L.w - 16, 304, '#2a7a2a', 7, 'right');
  }
  if (g) {
    const cur = pr.gear.find(x => x.uid === pr.eq[g.slot]);
    ink(g.name, PAGE_L.x + 16, y0 + 9, INK, 9);
    ink(`${SLOT_LABEL[g.slot]} · RANK ${RANKS[g.tier]}`, PAGE_L.x + PAGE_L.w - 16, y0 + 9, rankColor(g.tier, now), 8, 'right');
    let yy = inkWrap((g.sock ? ['◆ socketed'] : []).concat(gearLines(g)).join(' · '), PAGE_L.x + 16, y0 + 22, PAGE_L.w - 32, 7.5, '#2a5a8a', 10);
    if (g.set) yy = inkWrap(setLine(pr, g.set), PAGE_L.x + 16, yy, PAGE_L.w - 32, 6.8, '#7a3ac8', 9);
    if (cur && cur !== g && yy < 300) { let L = gearLines(cur).slice(0, 3); while (L.length > 1 && textW(`Equipped: ${L.join(' · ')}`, 7, false) > PAGE_L.w - 32) L = L.slice(0, -1); ink(`Equipped: ${L.join(' · ')}`, PAGE_L.x + 16, yy, INK_SOFT, 7, 'left', false); }
  }
}

function polyAt(P, k) {   // point at fraction k along a polyline
  const L = []; let tot = 0;
  for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(l); tot += l; }
  let d = k * tot;
  for (let i = 0; i < L.length; i++) { if (d <= L[i]) { const t = d / (L[i] || 1); return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]; } d -= L[i]; }
  return P[P.length - 1];
}

// ---------------------------------------------------------------- LAYER page (choose the Layer element)
// AUTO follows your spell cards (as before); or lock the transcendence to one element. Saved in profile.layerChoice.
const LAYER_CHOICES = ['holy', 'lightning', 'fire', 'water', 'earth', 'grass', 'wind', 'dark'];   // one for every element in the game
const LAYER_DESC = {
  holy: 'Radiant gold · every hit also heals you',
  lightning: 'Blue storm · shocks foes (0.5 s stun)', fire: 'Orange-gold blaze · burns foes',
  water: 'Aqua tide · freezes foes (−60% speed)', earth: 'Amber stone · cracks armour (+25% damage)',
  grass: 'Green growth · heavy poison',
  wind: 'Jade gale · lifts and knocks foes back', dark: 'Violet abyss · drains 25% as HP',
}
const LAYER_ROW = i => ({ x: PAGE_L.x + 14, y: 94 + i * 25, w: PAGE_L.w - 28, h: 23 });   // (eight rows: one per element)
const LAYER_ROWS = LAYER_CHOICES;   // (Ki has its own tab: chi.js)
function setLayerChoice(game, id) {
  game.profile.layerChoice = id; game.save();
  game.toast(`Layer element: ${LAYER_ELS[id].name}`, LAYER_ELS[id].mote);
}
function updateLayerTab(game, m) {
  m.col = m.col || 0; m.sk = m.sk || 0;
  for (let i = 0; i < LAYER_ROWS.length; i++) { const R = LAYER_ROW(i); if (clicked(R.x, R.y, R.w, R.h)) { m.cur = i; m.col = 0; setLayerChoice(game, LAYER_ROWS[i]); return; } }   // a click on a layer always counts, even from the mastery page
  if (updateLayerSkills(game, m)) return;   // the mastery page has the keys
  const k = navInput(), n = LAYER_ROWS.length;
  if (k.r) { m.col = 1; return; }
  if (k.u) m.cur = (m.cur + n - 1) % n;
  if (k.d) m.cur = (m.cur + 1) % n;
  m.cur = clamp(m.cur, 0, n - 1);
  if (k.ok) setLayerChoice(game, LAYER_ROWS[m.cur]);
}
// element icons from the user's icon sheet (assets/ui/elements.png, 12 × 96 px, in sheet order); AUTO uses the star
const ELEM_ICON = { fire: 0, water: 1, earth: 2, wind: 3, lightning: 4, ice: 5, grass: 6, poison: 7, metal: 8, light: 9, holy: 9, auto: 9, dark: 10, time: 11 };
function drawElementIcon(id, cx, cy, size, now, glow, col) {
  const im = img('assets/ui/elements.png'), i = ELEM_ICON[id]; if (i == null || !im || !im.naturalWidth) return;
  if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.85);
    g.addColorStop(0, rgbaOf(col || '#ffffff', 0.35 + 0.15 * Math.sin(now / 300))); g.addColorStop(1, rgbaOf(col || '#ffffff', 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, i * 96, 0, 96, 96, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size); ctx.restore();
}
function drawLayerPage(game, m, now) {
  const pr = game.profile, choice = LAYER_ELS[pr.layerChoice] ? pr.layerChoice : 'holy';
  pageHeader('LAYER', PAGE_L);
  const kiOn = pr.layerChoice === 'ki';
  ink(kiOn ? 'Your Layer button is set to KI (see the KI tab)' : `Your transcendence: ${LAYER_ELS[choice].name.toUpperCase()}`, PAGE_L.x + PAGE_L.w / 2, 86, INK, 8, 'center');
  LAYER_CHOICES.forEach((id, i) => {
    const R = LAYER_ROW(i), sel = m.cur === i, on = !kiOn && choice === id, L = LAYER_ELS[id];
    const [lr, lg, lb] = cssRgba(L.body), beat = 0.5 + 0.5 * Math.sin(now / 320);
    ctx.fillStyle = on ? `rgba(${lr},${lg},${lb},0.34)` : sel ? 'rgba(120,140,180,0.28)' : 'rgba(255,255,255,0.05)'; rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.fill();
    if (on) {   // the equipped layer: a gold frame that breathes in its own colour's glow, and a gold bar down its edge
      ctx.save(); ctx.shadowColor = L.body; ctx.shadowBlur = (5 + 3 * beat) * RES; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 5); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#ffd23f'; rrect(ctx, R.x + 2, R.y + 3, 3, R.h - 6, 1.5); ctx.fill();
    } else if (sel) { ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 5); ctx.stroke(); }
    drawElementIcon(id, R.x + 15, R.y + R.h / 2, 20, now, on || sel, L.halo);
    ink(`${L.name} · ${{ holy: 'Holy', lightning: 'Lightning', fire: 'Fire', water: 'Water', earth: 'Earth', grass: 'Grass', wind: 'Wind', dark: 'Dark' }[id]}`, R.x + 30, R.y + 7, id === 'holy' ? '#8a5a00' : L.halo, 8);
    ink(LAYER_DESC[id], R.x + 30, R.y + 17, INK_SOFT, 6.2, 'left', false);
    if (on) {
      const bw = 58, bh = 16, bx = R.x + R.w - bw - 5, by = R.y + (R.h - bh) / 2, gg = ctx.createLinearGradient(0, by, 0, by + bh); gg.addColorStop(0, '#2f9a4a'); gg.addColorStop(1, '#14602a');
      ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = (2 + 3 * beat) * RES; ctx.fillStyle = gg; rrect(ctx, bx, by, bw, bh, 4); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.2; rrect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 4); ctx.stroke();
      text('EQUIPPED', bx + bw / 2, by + bh / 2 + 0.5, '#ffffff', 9);
    }
    const M = layerMastery(pr.layerM = pr.layerM || {}, id); if (!on) ink(`${Math.floor(M.xp)} XP`, R.x + R.w - 8, R.y + 15, '#2a6a2a', 6, 'right', false);   // (the equipped layer's XP heads the mastery page beside it)
  });
  ink('Enter: use this · → its mastery (spend its XP)', PAGE_L.x + PAGE_L.w / 2, 300, INK_SOFT, 6.6, 'center', false);
}

// ---------------------------------------------------------------- STATS page (spend stat points)
const STAT_BADGE = { x: PAGE_R.x + PAGE_R.w - 82, y: 128, w: 70, h: 12 };
const STAT_ROW = i => ({ x: PAGE_L.x + 16, y: 101 + i * 26, w: PAGE_L.w - 32, h: 24 });   // (six rows since FOCUS, 2026-11-13)
const STAT_PLUS = i => { const R = STAT_ROW(i); return { x: R.x + R.w - 24, y: R.y + 3, w: 18, h: 18 }; };
const STAT_RESET = { x: PAGE_L.x + PAGE_L.w - 86, y: 259, w: 70, h: 14 };
// AUTO (V, or the button where the level line sits while points wait): every unspent point goes where your class's style wants
// it, filling toward these shares of all points spent so far, so a player who never opens STATS can still keep up
const STAT_AUTO = { btn: { x: PAGE_L.x + 14, y: 259, w: 92, h: 14 },
  melee: { str: 0.5, vit: 0.35, dex: 0.15 }, fist: { str: 0.5, vit: 0.35, dex: 0.15 }, archer: { str: 0.45, dex: 0.35, vit: 0.2 },
  mage: { int: 0.5, vit: 0.3, dex: 0.2 }, summoner: { int: 0.45, vit: 0.35, str: 0.2 } };
function statAutoSpend(game) {
  const pr = game.profile, n = statPoints(pr); if (!n) return 0;
  const W = STAT_AUTO[(CLASSES[pr.cls] || {}).style] || STAT_AUTO.melee; pr.attr = pr.attr || {};
  for (let i = 0; i < n; i++) {
    const total = ATTRS.reduce((s, A) => s + attrOf(pr, A.id), 0) + 1;
    const id = Object.keys(W).sort((a, b) => (W[b] * total - attrOf(pr, b)) - (W[a] * total - attrOf(pr, a)))[0];   // (the one furthest below its share)
    pr.attr[id] = (pr.attr[id] || 0) + 1;
  }
  game.refreshPlayer(); game.save(); game.toast(`${n} point${n === 1 ? '' : 's'} spent for your class`, '#ffd27a');
  return n;
}
const RESET_LV = 50;   // stat points can be reset (free) from this level on
function spendPoint(game, id) {
  const pr = game.profile;
  if (statPoints(pr) <= 0) { game.toast('No stat points left — level up to earn more', '#ff8a8a'); return; }
  pr.attr = pr.attr || {}; pr.attr[id] = (pr.attr[id] || 0) + 1; game.save();
}
const STAT_HOLD = { delay: 350, start: 110, accel: 0.06, fastest: 25 };   // hold +: wait, then repeat every 110 ms → 25 ms
function updateStatsTab(game, m) {
  const pr = game.profile, k = navInput();
  if (k.u) m.cur = (m.cur + ATTRS.length - 1) % ATTRS.length;
  if (k.d) m.cur = (m.cur + 1) % ATTRS.length;
  m.cur = clamp(m.cur, 0, ATTRS.length - 1);
  if (k.ok || k.r) spendPoint(game, ATTRS[m.cur].id);
  ATTRS.forEach((A, i) => { const B = STAT_PLUS(i), R = STAT_ROW(i); if (clicked(B.x, B.y, B.w, B.h)) { m.cur = i; spendPoint(game, A.id); m.holdT0 = performance.now(); m.holdNext = m.holdT0 + STAT_HOLD.delay; m.holdOn = i; } else if (clicked(R.x, R.y, R.w, R.h)) m.cur = i; });
  // HOLD to keep spending: on a + button (mouse held over it) or on Enter / → held — after a short pause it repeats,
  // faster the longer you hold (one save when you let go, not one per point)
  { const now = performance.now(), B = m.holdOn != null && STAT_PLUS(m.holdOn), overPlus = B && mouse.down && hovered(B.x, B.y, B.w, B.h);
    const keyHeld = keys.has('Enter') || keys.has('ArrowRight') || keys.has('KeyD');
    if (keyHeld && m.holdOn == null && (k.ok || k.r)) { m.holdOn = -1; m.holdT0 = now; m.holdNext = now + STAT_HOLD.delay; }
    const holding = m.holdOn === -1 ? keyHeld : overPlus;
    if (!holding) { if (m.holdOn != null && m.holdSpent) game.save(); m.holdOn = null; m.holdSpent = 0; }
    else if (now >= m.holdNext && statPoints(pr) > 0) {
      const held = now - m.holdT0, gap = Math.max(STAT_HOLD.fastest, STAT_HOLD.start - held * STAT_HOLD.accel);
      pr.attr = pr.attr || {}; const id = ATTRS[m.holdOn === -1 ? m.cur : m.holdOn].id; pr.attr[id] = (pr.attr[id] || 0) + 1;
      m.holdSpent = (m.holdSpent || 0) + 1; m.holdNext = now + gap;
    } }
  { const A = STAT_AUTO.btn; if (statPoints(pr) > 0 && (hit('KeyV') || clicked(A.x, A.y, A.w, A.h))) { statAutoSpend(game); return; } }
  if (hit('KeyR') || clicked(STAT_RESET.x, STAT_RESET.y, STAT_RESET.w, STAT_RESET.h)) {
    if ((pr.lv || 1) < RESET_LV) game.toast(`Stat reset unlocks at level ${RESET_LV} — you are level ${pr.lv || 1}`, '#ff9a8a');
    else { pr.attr = {}; game.save(); game.toast('Stat points refunded', '#c9c1a8'); }
  }
}
function drawStatsPage(game, m, now) {
  const pr = game.profile, st = profileStats(pr), pts = statPoints(pr);
  pageHeader('STATS', PAGE_L);
  // points available
  plate3D(PAGE_L.x + PAGE_L.w / 2 - 70, 80, 140, 18);
  text(pts ? `${pts} POINT${pts > 1 ? 'S' : ''} TO SPEND` : 'NO POINTS — LEVEL UP FOR MORE', PAGE_L.x + PAGE_L.w / 2, 89.5, pts ? '#ffe08a' : '#c9b89a', 7.5);
  ATTRS.forEach((A, i) => {
    const R = STAT_ROW(i), sel = m.cur === i, v = attrOf(pr, A.id);
    ctx.fillStyle = sel ? 'rgba(120,140,180,0.28)' : 'rgba(255,255,255,0.05)'; rrect(ctx, R.x, R.y, R.w, R.h, 4); ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 4); ctx.stroke(); }
    // attribute gem
    ctx.fillStyle = A.col; ctx.beginPath(); ctx.arc(R.x + 12, R.y + R.h / 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 0.8; ctx.stroke();
    text(A.name, R.x + 12, R.y + R.h / 2 + 0.4, '#ffffff', 6.5);
    ink(A.full, R.x + 26, R.y + 8.5, INK, 8.5);
    ink(A.desc + ' per point', R.x + 26, R.y + 19, INK_SOFT, 6.6, 'left', false);
    ink(String(v), R.x + R.w - 34, R.y + R.h / 2 + 0.5, A.col, 11, 'right');
    // + button
    const B = STAT_PLUS(i), ok = pts > 0;
    const bg = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
    bg.addColorStop(0, ok ? '#ffd26a' : '#c8b898'); bg.addColorStop(1, ok ? '#c87a1a' : '#8a7a62');
    ctx.fillStyle = bg; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill();
    ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 0.8; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 4); ctx.stroke();
    text('+', B.x + B.w / 2, B.y + B.h / 2, ok ? '#ffffff' : '#e8e0d0', 11);
  });
  // (the totals the points give are on the character sheet, which previews the next point: charsheet.js)
  const B = STAT_RESET;
  const open = (pr.lv || 1) >= RESET_LV;
  ctx.fillStyle = open ? 'rgba(120,60,30,0.25)' : 'rgba(90,80,70,0.18)'; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill();
  ink(open ? '↺ Reset points' : `🔒 Reset at Lv ${RESET_LV}`, B.x + B.w / 2, B.y + B.h / 2 + 0.5, open ? '#7a2a1a' : 'rgba(90,60,30,0.55)', 7, 'center');
  if (statPoints(pr) > 0) { const A = STAT_AUTO.btn; ctx.fillStyle = `rgba(230,170,40,${0.35 + 0.15 * Math.sin(performance.now() / 300)})`; rrect(ctx, A.x, A.y, A.w, A.h, 4); ctx.fill(); text('✦ Auto spend (V)', A.x + A.w / 2, A.y + A.h / 2 + 0.5, '#ffe9a8', 7); }   // (statAutoSpend)
  else ink(`Level ${pr.lv || 1}: ${POINTS_PER_LV} points per level`, PAGE_L.x + 18, B.y + B.h / 2 + 0.5, INK_SOFT, 6.8, 'left', false);
}
function drawStatBadge(n, now) {
  const B = STAT_BADGE, hov = mouse.x >= B.x && mouse.x < B.x + B.w && mouse.y >= B.y && mouse.y < B.y + B.h;
  const p = 0.85 + 0.15 * Math.sin(now / 250);
  ctx.save(); ctx.shadowColor = 'rgba(255,120,40,0.8)'; ctx.shadowBlur = (hov ? 8 : 4) * p * RES;
  const g = ctx.createLinearGradient(0, B.y, 0, B.y + B.h); g.addColorStop(0, '#ff8a4a'); g.addColorStop(1, '#b8300e');
  ctx.fillStyle = g; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#ffe0b0'; ctx.lineWidth = 0.7; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 3); ctx.stroke();
  text(`+ STATS  (${n})`, B.x + B.w / 2, B.y + B.h / 2 + 0.4, '#ffffff', 7);
}

// ---------------------------------------------------------------- card popup (opened by a click)
const POP = { x: VW / 2 - 196, y: 30, W: 190, H: 290, ph: 214, bx: VW / 2 + 6, bw: 140, bh: 20 };
function openMerge(game, m) { m.open = null; game.openMenu(Object.assign(mergeMenu(), { back: m })); }
// the details drop-down: opened from the popup, it fills the right column with the card's full text
const DET = { x: POP.bx, y: POP.y + 60, w: VW - 16 - POP.bx, h: VH - 44 - (POP.y + 60) };
function cardPopupButtons(pr, c, m) {
  const B = [], x0 = POP.bx, W = POP.bw; let y = POP.y + 44;
  const head = label => { B.push({ head: label, x: x0, y }); y += 10; };
  const add = (label, act, col, o = {}) => { B.push({ label, act, col, x: x0, y, w: W, h: 18, ...o }); y += 22; };
  if (m.details) {
    B.push({ label: 'Hide details', act: 'details', col: '#ffe9a8', x: x0, y, w: W, h: 18 });
    B.push({ label: 'Close', act: 'close', col: '#e8d2a0', x: DET.x + DET.w - 70, y: DET.y + DET.h + 4, w: 70, h: 16 });
    return B;
  }
  if (c.fusion) { head('FUSION'); add(pr.fusion === c.uid ? 'Unequip Fusion' : 'Equip as Fusion', 'fusion', '#ffb84a', { primary: pr.fusion !== c.uid, hint: 'G' }); }
  else {
    const st = m.stack, spares = st ? st.cards.filter(x => !inUse(pr, x)).length : (pr.deck.includes(c.uid) ? 0 : 1);
    const anyIn = st ? st.cards.some(x => pr.deck.includes(x.uid)) : pr.deck.includes(c.uid);
    head('DECK');
    if (spares && pr.deck.length >= deckMax(pr)) add('Equip to a slot…', 'pickslot', '#8fffd0', { primary: true });
    else if (spares) add(anyIn ? `Add another  (${spares} spare)` : 'Add to Deck', 'deck', '#8fffd0', { primary: true, hint: 'Enter' });
    if (anyIn) add('Remove from Deck', 'undeck', '#ffb88a');
    head('SPELL SLOT');
    const mine = st ? st.cards.map(x => x.uid) : [c.uid], kw = (W - 8) / 3;
    for (let i = 0; i < 3; i++) B.push({ label: 'QER'[i], key: 'QER'[i], on: mine.includes(pr.spells[i]), act: 'spell' + i, col: '#9fd8ff', x: x0 + i * (kw + 4), y, w: kw, h: 22 });
    y += 27;
  }
  head('CARD');
  const hw = (W - 4) / 2;
  B.push({ label: 'Details', act: 'details', col: '#ffe9a8', x: x0, y, w: hw, h: 18, hint: 'D' }, { label: 'Fuse…', act: 'merge', col: '#c8a8ff', x: x0 + hw + 4, y, w: hw, h: 18 });
  y += 22;
  const sure = m.confirm === (m.stack ? m.stack.key : c.uid);
  add(sure ? 'Click again to discard' : (m.stack && m.stack.n > 1 ? 'Discard one copy' : 'Discard'), 'discard', '#ff8a8a', { danger: true, armed: sure, hint: 'X' });
  return B;
}
function updateCardPopup(game, m) {
  const pr = game.profile, st = cardStacks(pr)[m.open], c = st && st.c;
  if (!c || hit('Escape')) { m.open = null; m.confirm = null; return; }
  m.stack = st;
  const spare = spareOf(pr, st), inDeck = st.cards.filter(x => pr.deck.includes(x.uid));
  let act = null;
  for (const b of cardPopupButtons(pr, c, m)) if (clicked(b.x, b.y, b.w, b.h)) act = b.act;
  if (!act) {
    if (hit('Enter', 'Space')) act = c.fusion ? 'fusion' : 'deck';
    else if (hit('KeyQ', 'Digit1')) act = 'spell0'; else if (hit('KeyE', 'Digit2')) act = 'spell1'; else if (hit('KeyR', 'Digit3')) act = 'spell2';
    else if (hit('KeyG')) act = 'fusion'; else if (hit('KeyX', 'Delete')) act = 'discard';
    else if (hit('KeyD', 'Tab')) act = 'details';
    else if (mouse.click && !clicked(POP.x, POP.y, POP.W, POP.H) && !(m.details && clicked(DET.x, DET.y - 30, DET.w, DET.h + 50))) act = 'close';   // click outside closes
  }
  if (!act) return;
  if (act !== 'discard') m.confirm = null;
  if (act === 'close') { m.open = null; m.details = false; }
  else if (act === 'details') m.details = !m.details;
  else if (act === 'merge') openMerge(game, m);
  else if (act === 'fusion') { if (c.fusion) { pr.fusion = pr.fusion === c.uid ? null : c.uid; game.save(); } }
  else if (act === 'pickslot') {   // full deck: choose the slot it replaces
    m.placeCard = (spare || c).uid; m.open = null; m.details = false; m.tab = 'deck'; m.touched = true;
    game.toast('Click the deck slot to place it in (Esc: cancel)', '#8fffd0');
  }
  else if (act === 'deck') {   // add a spare copy
    if (!spare) game.toast('Every copy is already in your deck', '#c9c1a8');
    else if (pr.deck.length >= deckMax(pr)) game.toast(`Deck is full (${deckMax(pr)} cards)`, '#ff8a8a');
    else pr.deck.push(spare.uid);
    game.save();
  } else if (act === 'undeck') {   // take one copy out (a non-spell copy first)
    const t = inDeck.find(x => !pr.spells.includes(x.uid)) || inDeck[0];
    if (t) { pr.deck = pr.deck.filter(u => u !== t.uid); pr.spells = pr.spells.map(u => u === t.uid ? null : u); game.save(); }
  } else if (act.startsWith('spell') && !c.fusion) {
    const slot = +act[5];
    const t = st.cards.find(x => pr.spells.includes(x.uid)) || inDeck[0] || spare;
    if (equipSpell(game, t.uid, slot)) game.toast(`${cardName(c)} → spell ${'QER'[slot]}`, '#9fd8ff');
  } else if (act === 'discard') {   // a spare copy goes first
    const t = spare || c;
    if (m.confirm === st.key) {
      pr.cards = pr.cards.filter(x => x !== t); pr.deck = pr.deck.filter(u => u !== t.uid);
      pr.spells = pr.spells.map(u => u === t.uid ? null : u); if (pr.fusion === t.uid) pr.fusion = null;
      m.confirm = null; if (st.n <= 1) { m.open = null; m.cur = Math.max(0, m.cur - 1); } game.save(); game.toast('Card discarded', '#c9c1a8');
    } else m.confirm = st.key;
  }
}
// A FAILED MERGE, in the RESULT frame (time from when the energy reaches it):
//   0–650 ms   the new card's back takes shape, glowing, then trembles harder and harder as cracks race across it
//   BROKEN     at 650 it snaps: the halves twist apart and fall away greying, shards and dust burst out, and a cracked
//              heart sinks in over SHATTERED · "N cards crumbled to dust…"; ash settles and the last embers drift up
//   PROTECTED  at 650 a shield bubble rings out and holds it: the cracks fade, the card dissolves into motes that fly
//              back to the merge slots, and FUSION FAILED · "protection held — your cards are safe" with a shield
const FAIL_SNAP = 650;
function drawFailResult(m, R, now) {
  const F = m.fail, e = now - F.at, cx = R.x + R.w / 2, cy = R.y + R.h / 2 - 4, cw = R.w - 34, ch = Math.round(cw / CARD_ASPECT);
  if (e < 0) return;
  if (!F.snapped && e >= FAIL_SNAP) { F.snapped = true; if (typeof SFX !== 'undefined' && SFX.fusionFail) SFX.fusionFail(F.prot); }
  const r = rng(Math.floor(F.seed));
  const cracks = F.cracks || (F.cracks = Array.from({ length: 7 }, (_, i) => {   // jagged paths out from near the middle
    let x = (r() - 0.5) * 8, y = (r() - 0.5) * 10; const an = i / 7 * Math.PI * 2 + r() * 0.5, pts = [[x, y]];
    for (let k = 0; k < 5; k++) { const a2 = an + (r() - 0.5) * 1.1; x += Math.cos(a2) * (6 + r() * 6); y += Math.sin(a2) * (6 + r() * 6) * 1.2; pts.push([x, y]); }
    return pts; }));
  const split = F.split || (F.split = Array.from({ length: 9 }, (_, i) => [(r() - 0.5) * 9, -ch / 2 - 2 + i * (ch + 4) / 8]));   // the line it snaps along
  const drawCracks = (k, alpha) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [lw, col] of [[2.4, F.prot ? 'rgba(120,200,255,0.55)' : 'rgba(255,70,40,0.6)'], [1, '#14060a']]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      for (const pts of cracks) { const n = Math.max(1, Math.floor(pts.length * k)); ctx.beginPath(); pts.slice(0, n + 1).forEach(([x, y], j) => ctx[j ? 'lineTo' : 'moveTo'](x, y)); ctx.stroke(); }
    }
    ctx.restore();
  };
  const back = (glow) => drawCardBack(-cw / 2, -ch / 2, cw, ch, now, { glow, blur: 10 });
  // the frame's inside darkens once it has failed
  ctx.save(); ctx.globalAlpha = Math.min(1, e / 900) * 0.55; ctx.fillStyle = F.prot ? '#261910' : '#120a10'; ctx.beginPath(); rrect(ctx, R.x + 8, R.y + 8, R.w - 16, R.h - 16, 4); ctx.fill(); ctx.restore();
  if (e < FAIL_SNAP) {   // forming, trembling, cracking
    const k = e / FAIL_SNAP, sh = k * k * 3.2;
    ctx.save(); ctx.translate(cx + Math.sin(now / 23) * sh, cy + Math.cos(now / 29) * sh * 0.6); ctx.globalAlpha = Math.min(1, e / 160);
    back(F.prot ? '#7ad0ff' : k > 0.5 ? '#ff5a3a' : '#c8a0ff');
    if (k > 0.3) drawCracks((k - 0.3) / 0.7, 1);
    ctx.restore();
  } else if (!F.prot) {   // BROKEN: it snaps in two
    const t = e - FAIL_SNAP, k = Math.min(1, t / 900), fall = k * k;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(cx + side * (4 + k * 22), cy + fall * 80); ctx.rotate(side * k * 0.55); ctx.globalAlpha = Math.max(0, 1 - k * 1.1);
      ctx.filter = `grayscale(${Math.min(1, k * 2)}) brightness(${1 - k * 0.4})`;
      ctx.beginPath(); ctx.moveTo(side * (cw / 2 + 4), -ch / 2 - 4); split.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(side * (cw / 2 + 4), ch / 2 + 4); ctx.closePath(); ctx.clip();
      back(null); drawCracks(1, 1 - k); ctx.restore();
    }
    if (t < 140) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - t / 140; ctx.fillStyle = '#ffd0c0'; ctx.beginPath(); ctx.arc(cx, cy, 10 + t / 4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.save();   // shards and dust
    for (let i = 0; i < 16; i++) {
      const an = i / 16 * Math.PI * 2 + (i % 3) * 0.3, v = 30 + (i % 5) * 14, q = Math.min(1.4, t / 1000);
      const x = cx + Math.cos(an) * v * q, y = cy + Math.sin(an) * v * q * 0.7 + q * q * 70;
      ctx.globalAlpha = Math.max(0, 1 - q * 0.9); ctx.fillStyle = i % 3 ? '#6a5a70' : '#c8b8d8';
      ctx.save(); ctx.translate(x, y); ctx.rotate(an + q * 6); ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(2.4, 2); ctx.lineTo(-2.4, 2.2); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    for (let i = 0; i < 8; i++) { const q = Math.min(1, t / 1100), an = i * 0.8; ctx.globalAlpha = (1 - q) * 0.35; ctx.fillStyle = '#8a8090';
      ctx.beginPath(); ctx.arc(cx + Math.cos(an) * q * 26, cy + 10 + Math.sin(an) * q * 12, 4 + q * 9, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // ash settles at the bottom, and a few embers drift up for a while
    const ash = Math.min(1, t / 1200), by = R.y + R.h - 14;
    ctx.save(); ctx.fillStyle = '#3a3238'; ctx.globalAlpha = ash; ctx.beginPath(); ctx.ellipse(cx, by + 2, 20 * ash, 3.5 * ash, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#5a5058'; ctx.beginPath(); ctx.ellipse(cx - 3, by + 1, 10 * ash, 2 * ash, 0, Math.PI, 0); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const q = ((now / 2600) + i / 5) % 1; ctx.globalAlpha = ash * Math.sin(q * Math.PI) * 0.8; ctx.fillStyle = i % 2 ? '#ff7a4a' : '#ffb070';
      ctx.fillRect(Math.round(cx - 14 + i * 7 + Math.sin(q * 6 + i) * 3), Math.round(by - q * 30), 1, 1); }
    ctx.restore();
    if (t > 350) {   // the verdict sinks in: a cracked heart, SHATTERED, the loss
      const d = Math.min(1, (t - 350) / 600), drop = (1 - d) * -12 + Math.sin(Math.min(1, d) * Math.PI) * 2;
      ctx.save(); ctx.globalAlpha = d;
      drawBrokenHeart(cx, R.y + 32 + drop, 2.4, Math.min(1, (t - 350) / 900));
      text('SHATTERED', cx, R.y + 62 + drop, '#d86a78', 12);
      text(`${F.n} card${F.n === 1 ? '' : 's'} crumbled`, cx, R.y + 78 + drop, '#b8a8b8', 6.2);
      text('to dust…', cx, R.y + 86 + drop, '#b8a8b8', 6.2);
      ctx.restore();
    }
  } else {   // PROTECTED: the shield catches it
    const t = e - FAIL_SNAP, k = Math.min(1, t / 1000);
    if (t < 520) {
      ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = 1 - Math.max(0, (t - 260) / 260); ctx.scale(1 - Math.max(0, (t - 260) / 260) * 0.4, 1 - Math.max(0, (t - 260) / 260) * 0.4);
      back('#7ad0ff'); drawCracks(1, Math.max(0, 1 - t / 300)); ctx.restore();
    }
    if (t < 1400) {   // (after that the bubble and the motes are gone)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bub = Math.min(1, t / 220);   // the bubble
    ctx.globalAlpha = Math.max(0, 1 - t / 900) * 0.9; ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, (cw / 2 + 8) * (0.7 + 0.3 * bub), (ch / 2 + 8) * (0.7 + 0.3 * bub), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = Math.max(0, 1 - t / 700) * 0.25; ctx.fillStyle = '#7ad0ff'; ctx.fill();
    ctx.globalAlpha = Math.max(0, 1 - t / 600); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, cw / 2 + 8 + t / 12, ch / 2 + 8 + t / 12, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 18; i++) {   // the card's motes fly back to the merge slots
      const q = Math.max(0, Math.min(1, (t - 260 - i * 18) / 700)); if (q <= 0 || q >= 1) continue;
      const S = MG.slot(i % 3), tx = S.x + S.w / 2, ty = S.y + S.h / 2, sx = cx + Math.cos(i * 2.1) * 18, sy = cy + Math.sin(i * 2.1) * 26;
      const x = sx + (tx - sx) * q, y = sy + (ty - sy) * q - Math.sin(q * Math.PI) * 30;
      ctx.globalAlpha = Math.sin(q * Math.PI); ctx.fillStyle = i % 3 ? '#9fe0ff' : '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.restore();
    }
    if (t > 520) {   // once the card has dissolved
      const d = Math.min(1, (t - 520) / 450);
      ctx.save(); ctx.globalAlpha = d;
      drawShieldIcon(cx, R.y + 32 - (1 - d) * 6, 1.3);
      text('FUSION FAILED', cx, R.y + 64, '#b8d8f0', 9.5);
      text('protection held', cx, R.y + 80, '#8fc8e8', 6.2);
      text('your cards are safe', cx, R.y + 88, '#8fc8e8', 6.2);
      ctx.restore();
    }
  }
  if (e > FAIL_SNAP + 1300) text('click to continue', cx, R.y + R.h + 9, `rgba(220,210,230,${0.45 + 0.3 * Math.sin(now / 300)})`, 6);
}
// a pixel heart split down a crack, its halves a little apart (k = how far the crack has opened)
function drawBrokenHeart(cx, cy, s, k) {
  const H = ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'];
  const gap = k * 1.6;
  ctx.save();
  H.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') {
    const crack = [4, 4, 3, 4, 5, 4, 4, 4][y], side = x < crack ? -1 : x > crack ? 1 : 0; if (!side) continue;
    ctx.fillStyle = y < 2 && (x === 1 || x === 6) ? '#ff9aa8' : side < 0 ? '#c83a50' : '#a82a40';
    ctx.fillRect(Math.round(cx + (x - 4.5) * s + side * gap - (side < 0 ? k : -k) * 0), Math.round(cy + (y - 4) * s + side * k * 0.6), Math.ceil(s), Math.ceil(s)); } });
  ctx.restore();
}
// a small pixel shield, blue with a gold rim
function drawShieldIcon(cx, cy, s) {
  const H = ['.#######.', '#ooooooo#', '#oo...oo#', '#o.....o#', '#o.....o#', '.#o...o#.', '..#o.o#..', '...#o#...', '....#....'];
  H.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = row[x]; if (c === '.' && !(y > 1 && y < 7 && x > 1 && x < 7)) continue;
    ctx.fillStyle = c === '#' ? '#e0a63a' : c === 'o' ? '#5aa0e0' : '#9fd8ff'; if (c === '.' && (x < 2 || x > 6)) continue;
    ctx.fillRect(Math.round(cx + (x - 4.5) * s), Math.round(cy + (y - 4.5) * s), Math.ceil(s), Math.ceil(s)); } });
}
function drawCardPopup(game, m, c, now) {
  const pr = game.profile;
  ctx.fillStyle = 'rgba(8,4,14,0.86)'; ctx.fillRect(0, 0, VW, VH);
  drawCardFront(c, POP.x, POP.y, POP.W, POP.H, now, { detail: true, sel: true });
  const btns = cardPopupButtons(pr, c, m), n = m.stack ? m.stack.n : 1, used = m.stack ? m.stack.cards.filter(x => pr.deck.includes(x.uid)).length : 0;
  const px = POP.bx - 9, py = POP.y, pw = POP.bw + 18, ph = POP.ph, col = rankColor(c.tier, now), hc = col[0] === '#' ? col : '#ffd23f';   // (tints need a hex colour; the top rank cycles through hsl)
  if (!m.details) popupPanel(px, py, pw, ph, hc, now);
  // the header: the name on a ribbon in the rank's colour, then chips for the rank, where it is, how many you own
  ctx.save(); const rib = ctx.createLinearGradient(px, 0, px + pw, 0); rib.addColorStop(0, hexA(hc, 0.55)); rib.addColorStop(1, hexA(hc, 0));
  ctx.fillStyle = rib; ctx.fillRect(px + 3, py + 5, pw - 6, 15); ctx.restore();
  text(cardName(c), POP.bx, py + 12.5, '#ffffff', 10, 'left');
  const where = pr.fusion === c.uid ? ['FUSION', '#ffb84a'] : pr.spells.includes(c.uid) ? [`SPELL ${'QER'[pr.spells.indexOf(c.uid)]}`, '#9fd8ff'] : pr.deck.includes(c.uid) || used ? ['IN DECK', '#8fffd0'] : ['COLLECTION', '#b8b0c8'];
  let cx = POP.bx;
  const chip = (label, c2) => { const w = textW(label, 5.6) + 8; ctx.fillStyle = hexA(c2, 0.18); rrect(ctx, cx, py + 24, w, 10, 3); ctx.fill(); ctx.strokeStyle = hexA(c2, 0.8); ctx.lineWidth = 0.7; rrect(ctx, cx + 0.4, py + 24.4, w - 0.8, 9.2, 3); ctx.stroke(); text(label, cx + w / 2, py + 29.2, c2, 5.6); cx += w + 3; };
  chip(`RANK ${RANKS[c.tier]}`, hc); chip(where[0], where[1]); if (n > 1) chip(`×${n} OWNED`, '#e8d2a0');
  for (const b of btns) {
    if (b.head) { text(b.head, b.x, b.y + 2.5, '#9aa4b8', 5.6, 'left'); const tw = textW(b.head, 5.6), x1 = b.x + POP.bw; ctx.fillStyle = 'rgba(154,164,184,0.45)'; ctx.fillRect(b.x + tw + 4, b.y + 2.4, POP.bw - tw - 4, 0.8); ctx.beginPath(); ctx.arc(x1, b.y + 2.8, 1.3, 0, Math.PI * 2); ctx.fill(); }   // (a steel rule with a stud, as under the page headings)
    else popupButton(b, now);
  }
  if (m.details) drawCardDetails(c, DET.x, DET.y, DET.w, DET.h, now);
  else text('Esc or click outside to close', px + pw / 2, py + ph - 12, '#7a8498', 5.6);
}
// the card popup's action panel, in the inventory's own make: the book's iron frame with its riveted steel corners, a slate
// page inside it, and a thin stripe in the card's rank colour along the top (like the colour stripe on the page tabs)
function popupPanel(x, y, w, h, col, now) {
  drawIronFrame({ x, y, w, h });
  drawSlatePage({ x: x + 6, y: y + 6, w: w - 12, h: h - 12 });
  ctx.fillStyle = col && col[0] === '#' ? col : '#ffd23f'; ctx.fillRect(x + 22, y + 7, w - 44, 1.6);
}
const POP_ICON = { details: '❖', deck: '+', pickslot: '+', undeck: '−', fusion: '✦', merge: '⚗', discard: '✖', close: '✕' };
// a popup button, made like the inventory's page tabs: a steel plate with a colour stripe in its action's colour. The main
// action wears the gold rim of the open tab; Discard stays quiet until you point at it (or have clicked it once), then
// turns red; spell slots are steel keycaps (gold-rimmed when this card sits in that slot).
function popupButton(b, now) {
  const hov = mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h, on = b.on;
  const gold = b.primary || on, red = b.danger && (hov || b.armed), lit = hov || gold;
  ctx.save(); ctx.shadowColor = red ? 'rgba(255,90,90,0.7)' : gold ? hexA(b.col || '#ffd860', 0.6) : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = (hov ? 6 : gold || red ? 4 : 3) * RES;
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  if (red) { g.addColorStop(0, '#6a2a34'); g.addColorStop(1, '#2a0e14'); }
  else { g.addColorStop(0, lit ? '#5a4630' : '#422c1c'); g.addColorStop(1, lit ? '#3a2618' : '#24180f'); }
  ctx.fillStyle = g; rrect(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill(); ctx.restore();
  const stripe = red ? '#ff7a7a' : b.col || '#9aa4b8';   // the colour stripe across the top, as on the tabs
  ctx.fillStyle = lit || red ? stripe : mixCol(stripe, '#000000', 0.45); ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, lit ? 2 : 1.4);
  ctx.strokeStyle = red ? '#ff9a8a' : gold ? '#ffd860' : hov ? '#b8a48a' : '#6a5440'; ctx.lineWidth = gold || red ? 1.2 : 0.9; rrect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 4); ctx.stroke();
  const cy = b.y + b.h / 2 + 1, ink = lit || red ? '#ffffff' : '#c8d0e0';
  if (b.key) {   // a keycap: the key large, a check when this card sits in that slot
    text(b.key, b.x + b.w / 2 - (on ? 5 : 0), cy - 0.5, on ? '#ffd860' : '#9fd8ff', 11);
    if (on) text('✓', b.x + b.w / 2 + 8, cy - 0.5, '#ffd860', 9);
    return;
  }
  const ic = POP_ICON[b.act];
  if (ic) {   // the icon, on a small recessed steel tile
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, b.x + 3, b.y + 4, b.h - 7, b.h - 7, 3); ctx.fill();
    text(ic, b.x + 3 + (b.h - 7) / 2, cy, red ? '#ffffff' : b.col || '#c8d0e0', 7.5);
  }
  const tx = ic ? b.x + b.h + (b.w - b.h - 4) / 2 : b.x + b.w / 2;
  text(b.label, tx, cy, ink, b.w < 80 ? 7 : 7.5);
  if (b.hint && b.w >= 80) text(b.hint, b.x + b.w - 6, cy, 'rgba(200,210,230,0.4)', 5.4, 'right');
}
// flavour line generated from the monster's element and rank
const EL_FLAVOR = { fire: 'burns with a fire that never goes out', ice: 'freezes the air around it', lightning: 'crackles with stored lightning',
  earth: 'is as hard to move as the hills', wind: 'rides the wind faster than the eye', dark: 'lurks where the shadows are deepest',
  poison: 'drips with a slow, lethal venom', holy: 'shines with a holy light' };
function cardDetailLines(c) {
  const L = [], H = (s, col = '#ffd27a') => L.push({ s, col, b: true, gap: 4 }), P = (s, col = '#e8e2d0') => L.push({ s, col });
  const title = c.fusion ? 'FUSION' : RANK_STYLE[c.tier].title;
  if (c.fusion) {
    P(`A fusion of ${c.fusion.length} monster cards, bound by the layer circle into one card.`, '#e8d2a0');
    H('FUSION ATTACK');
    P(`Power ${fusionPower(c)} — every fused monster attacks the target in turn, then a finishing blast launches everything near it.`);
    P('Monsters: ' + c.fusion.map(x => `${cardName(x)} (${RANKS[x.tier]})`).join(', '));
  } else {
    const sp = cardSpell(c), el = ELEMENTS[sp.el], ar = ARCH[sp.arch];
    P(SPECIES[c.sp].ki ? `A KI card — a technique of pure spirit. It cannot be fused: at the Fusion Altar, feed it other cards to raise its Ki (rank ${RANKS[c.tier]}, Ki ${Math.floor(c.kiXp || 0)}/${KI.need(c.tier)}).` : SPECIES[c.sp].arcana ? `An Arcana spell card — pure ${ELEMENTS[sp.el].name.toLowerCase()} magic, no monster bound to it.` : SPECIES[c.sp].chef ? `One of Chef Daddy's exclusive kitchen skills${SPECIES[c.sp].gourmet ? ': his signature card — every meal is five stars' : ''}.` : SPECIES[c.sp].npc ? `${cardName(c)}, a familiar face from Hearthvale, lends you a hand in battle.` : `${/^[aeiou]/i.test(title) ? 'An' : 'A'} ${title.toLowerCase()} ${cardName(c)} that ${EL_FLAVOR[sp.el] || 'roams the wilds'}.`, '#e8d2a0');
    H(`SPELL — ${sp.name}`);
    if (sp.formText) P(sp.formText); if (sp.desc || !sp.formText) P(sp.desc ? `${sp.desc}.` : `${ar.name}: ${ar.desc}.`);
    if (sp.sup) P(`${sp.sup.label} card  ·  ${sp.mp} MP  ·  cooldown ${(sp.cd / 1000).toFixed(1)}s  ·  10% stronger each rank`, '#ffd27a');
    else if (sp.tw && TWISTS[sp.tw]) P(`Twist — ${TWISTS[sp.tw].name}: ${TWISTS[sp.tw].d}.`, '#ffd27a');
    if (sp.sx === 'meal') P('Well Fed: +20% damage dealt, -20% damage taken and steady healing for everyone who eats.', '#ffe08a');
    if (!sp.sup) P(`Element: ${el.name}${sp.status ? ` — ${el.desc}` : typeof STATUS_CHANCE !== 'undefined' && STATUS_CHANCE.els.includes(sp.el) ? ` — ${Math.round((STATUS_CHANCE.base + STATUS_CHANCE.per * (sp.tier || 0)) * 100)}% chance each cast: ${el.desc}; always at rank S` : ` (its ${el.status} effect unlocks at rank S)`}.`, EL_INK_LIGHT[sp.el] || '#e8e2d0');
    if (!sp.sup) P(`Power ${sp.power}  ·  ${sp.mp} MP  ·  cooldown ${(sp.cd / 1000).toFixed(1)}s` + (sp.count > 1 ? `  ·  ${sp.count} hits` : '') + (['nova', 'pillar', 'summon'].includes(sp.arch) ? `  ·  radius ${sp.radius}` : ''));
    if (!sp.sup) P('Cast it right after a hit lands for a COMBO LINK (+20% per combo hit).', '#b8b0a0');
  }
  H(`PASSIVE${cardPassives(c).length > 1 ? 'S' : ''} (active while the card is in your deck)`);
  for (const p of cardPassives(c)) P(`◆ ${passiveName(p)}${p.trait ? ` (${PASSIVES[p.id].name})` : ''}: ${PASSIVES[p.id].fmt(passiveValue(p.id, p.tier) * (p.mul || 1))}`, '#9fd8ff');
  H('RANK');
  P(`${RANKS[c.tier]} · ${title} — higher ranks raise spell power, passive strength and lower cooldowns.`);
  return L;
}
const EL_INK_LIGHT = { fire: '#ffb08a', ice: '#a8e4ff', lightning: '#fff08a', earth: '#e0c08a', wind: '#a8f0c0', dark: '#d0a8ff', poison: '#c0f08a', holy: '#ffe8a8' };
function drawCardDetails(c, x, y, w, h, now) {
  // the panel drops down from the button
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6 * RES; ctx.shadowOffsetY = 2 * RES;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#302014'); g.addColorStop(1, '#1c120c');
  ctx.fillStyle = g; rrect(ctx, x, y, w, h, 6); ctx.fill(); ctx.restore();
  ctx.strokeStyle = goldFrameGrad(y, h); ctx.lineWidth = 1.2; rrect(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 6); ctx.stroke();
  ctx.fillStyle = goldFrameGrad(y - 6, 6); ctx.beginPath(); ctx.moveTo(x + 18, y); ctx.lineTo(x + 24, y - 6); ctx.lineTo(x + 30, y); ctx.fill();
  // wrapped text, shrinking a step if it would not fit
  const lines = cardDetailLines(c);
  for (let fs = 8; fs >= 6; fs -= 0.5) {
    const lh = fs * 1.32, rows = [];
    for (const L of lines) {
      let cur = '';
      const out = [];
      for (const word of trSplit(L.s)) {
        const t = cur ? cur + trSp() + word : word;
        if (textW(t, fs) > w - 20 && cur) { out.push(cur); cur = word; } else cur = t;
      }
      out.push(cur);
      out.forEach((s, i) => rows.push({ s, col: L.col, b: L.b, gap: i === 0 ? (L.gap || 0) : 0 }));
    }
    const total = rows.reduce((a, r) => a + lh + r.gap, 0);
    if (total > h - 16 && fs > 6) continue;
    let yy = y + 10 + lh / 2;
    for (const r of rows) {
      yy += r.gap;
      text(r.s, x + 10, yy, r.col, fs, 'left');
      yy += lh;
    }
    break;
  }
}

// ---------------------------------------------------------------- MERGE screen (fusion altar)
function mergeMenu() { return { type: 'fusion', cur: 0, scroll: 0, sel: [], confirm: false, result: null, anim: 0 }; }
const MG = { frame: { x: 34, y: 92, w: 330, h: 136 }, slot: (i) => ({ x: 48 + i * 104, y: 104, w: 92, h: 112 }), res: { x: 448, y: 92, w: 112, h: 136 },
  grid: { x: 40, y: 258, cw: 40, ch: 45, cols: 14, rows: 2 } };
// A merge can FAIL — likelier the higher the rank it would make (10% at F … ~50% at SSS+) — and a failed merge BREAKS
// the cards that went in. PROTECT (T, or the button) spends gold (G) on the attempt, more for a higher rank: if the
// merge then fails, your cards are kept.
const mergeFail = t => Math.min(0.55, 0.1 + t * 0.045);
const PROTECT_COST = [30, 60, 110, 180, 280, 420, 600, 850, 1200, 1700];   // in gold (G), by the result's rank
const MG_PROT = { x: 396, y: 240, w: 132, h: 14 };
function updateFusion(game, m, dt) {
  const pr = game.profile;
  if (m.anim > 0) { m.anim -= dt; if (m.anim <= 0) m.anim = 0; return; }
  if (m.fail) { if (performance.now() > m.fail.at + FAIL_SNAP + 900 && (hit(...KEYS_OK, ...KEYS_BACK, 'Space') || mouse.click)) m.fail = null; return; }   // (let the break play out first)
  if (hit('KeyT') || clicked(MG_PROT.x, MG_PROT.y, MG_PROT.w, MG_PROT.h)) {
    m.protect = !m.protect;
    const cards = m.sel.map(u => pr.cards.find(c => c.uid === u)).filter(Boolean);
    if (m.protect && cards.length >= 2) { const cost = PROTECT_COST[fuseCards(cards).tier];
      game.toast((pr.gold || 0) >= cost ? `Protection on: ${cost} G per attempt — if the merge fails, your cards are safe` : `Protection costs ${cost} G — you have ${pr.gold || 0} G`, (pr.gold || 0) >= cost ? '#9fd8ff' : '#ff8a8a'); }
  }
  if (m.result) { if (hit(...KEYS_OK, ...KEYS_BACK, 'Space') || mouse.click) { m.result = null; m.kiResult = null; } return; }
  if (hit('Escape')) { if (m.back) { m.back.open = null; game.openMenu(m.back); } else game.closeMenu(); return; }
  const list = sortedCards(pr), G = MG.grid;
  let mouseAct = false;
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i; if (idx >= list.length) break;
    if (clicked(G.x + (i % G.cols) * G.cw, G.y + Math.floor(i / G.cols) * G.ch, G.cw - 6, G.ch - 8)) { mouseAct = true; m.cur = idx; }
  }
  for (let i = 0; i < 3; i++) { const S = MG.slot(i); if (clicked(S.x, S.y, S.w, S.h) && m.sel[i]) { m.sel.splice(i, 1); m.confirm = false; } }
  const k = gridNav(m, list.length, G.cols);
  keepVisible(m, G.cols, G.rows);
  const it = list[m.cur];
  if ((k.ok || mouseAct) && it) {
    if (m.sel.includes(it.uid)) m.sel = m.sel.filter(u => u !== it.uid);
    else if (m.sel.length < 3) m.sel.push(it.uid);
    else game.toast('Three cards at most', '#ff8a8a');
    m.confirm = false;
  }
  if (hit('Space', 'KeyG') || clicked(250, 236, 140, 16)) {
    const kp = kiPlan(m.sel.map(u => pr.cards.find(c => c.uid === u)).filter(Boolean));
    if (kp) {   // a Ki card in the slots: ENHANCE it (Ki cards are never fused) — see ki.js
      if (kp.error) { game.toast(kp.error, '#ffd27a'); return; }
      if (kp.base.tier >= 9 && (kp.base.kiXp || 0) >= KI.need(9)) { game.toast('Its Ki is already at its peak', '#c9c1a8'); return; }
      if (!m.confirm) { m.confirm = true; return; }
      kiEnhance(game, m, kp); return;
    }
    if (m.sel.length < 2) { game.toast('Place 2 or 3 cards in the MERGE slots', '#ff8a8a'); return; }
    if (!m.confirm) { m.confirm = true; return; }
    const cards = m.sel.map(u => pr.cards.find(c => c.uid === u));
    const fz = fuseCards(cards), cost = PROTECT_COST[fz.tier];
    if (m.protect && (pr.gold || 0) < cost) { game.toast(`Protection costs ${cost} G — you have ${pr.gold || 0} G (turn it off with T)`, '#ff8a8a'); m.confirm = false; return; }
    if (m.protect) pr.gold -= cost;
    m.fromCards = cards;
    if (Math.random() < mergeFail(fz.tier)) {   // the merge fails
      if (m.protect) game.toast(`The merge failed — your protection held, the cards are safe (−${cost} G)`, '#9fd8ff');
      else {
        pr.cards = pr.cards.filter(c => !m.sel.includes(c.uid));
        pr.deck = pr.deck.filter(u => !m.sel.includes(u));
        pr.spells = pr.spells.map(u => m.sel.includes(u) ? null : u);
        if (m.sel.includes(pr.fusion)) pr.fusion = null;
        game.toast(`The merge failed — ${cards.length} cards broke`, '#ff6a6a');
      }
      m.fail = { prot: !!m.protect, n: cards.length, at: performance.now() + 700, seed: Math.random() * 1000 }; m.sel = []; m.confirm = false; m.anim = 1500; m.animStart = performance.now();
      game.save(); return;
    }
    pr.cards = pr.cards.filter(c => !m.sel.includes(c.uid));
    pr.deck = pr.deck.filter(u => !m.sel.includes(u));
    pr.spells = pr.spells.map(u => m.sel.includes(u) ? null : u);
    if (m.sel.includes(pr.fusion)) pr.fusion = null;
    pr.cards.push(fz);
    if (!pr.fusion) pr.fusion = fz.uid;
    m.sel = []; m.confirm = false; m.result = fz; m.anim = 1500; m.animStart = performance.now(); bumpStat('fusions');
    game.save();
  }
}
function drawSteelFrame(x, y, w, h) {
  const g1 = ctx.createLinearGradient(x, y, x, y + h);
  g1.addColorStop(0, '#c8ccd6'); g1.addColorStop(0.5, '#7a8090'); g1.addColorStop(1, '#4a4f5c');
  ctx.fillStyle = g1; rrect(ctx, x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = '#362417'; ctx.lineWidth = 1.5; rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; rrect(ctx, x + 3, y + 3, w - 6, h - 6, 4); ctx.stroke();
}
function drawEmptySlot(S, now, i) {
  drawSteelFrame(S.x - 4, S.y - 4, S.w + 8, S.h + 8);
  const bg = ctx.createLinearGradient(S.x, S.y, S.x, S.y + S.h);
  bg.addColorStop(0, '#261910'); bg.addColorStop(1, '#382518');
  ctx.fillStyle = bg; rrect(ctx, S.x, S.y, S.w, S.h, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(160,170,190,0.25)'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
  rrect(ctx, S.x + S.w / 2 - 14, S.y + S.h / 2 - 16, 28, 32, 3); ctx.stroke(); ctx.setLineDash([]);
}
function drawGoldFrame(R, now, glow) {
  ctx.save();
  ctx.shadowColor = '#5ad0ff'; ctx.shadowBlur = glow ? 14 : 6;
  const g1 = ctx.createLinearGradient(R.x, R.y, R.x + R.w, R.y + R.h);
  g1.addColorStop(0, '#e8b860'); g1.addColorStop(0.5, '#a8743a'); g1.addColorStop(1, '#e8b860');
  ctx.fillStyle = g1; rrect(ctx, R.x, R.y, R.w, R.h, 6); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#5ad0ff'; ctx.lineWidth = 1.5; rrect(ctx, R.x - 1, R.y - 1, R.w + 2, R.h + 2, 7); ctx.stroke();
  ctx.fillStyle = '#261910'; rrect(ctx, R.x + 8, R.y + 8, R.w - 16, R.h - 16, 4); ctx.fill();
  ctx.fillStyle = '#5ad0ff';
  for (const [x, y] of [[R.x + 5, R.y + 5], [R.x + R.w - 8, R.y + 5], [R.x + 5, R.y + R.h - 8], [R.x + R.w - 8, R.y + R.h - 8]]) { ctx.fillRect(x, y, 3, 3); }
  ctx.fillStyle = '#5ad0ff'; ctx.fillRect(R.x + 20, R.y + R.h - 6, R.w - 40, 2);
}
function drawArrow(x, y, s, col, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x + 8 * s, y - 3 * s); ctx.lineTo(x + 8 * s, y - 7 * s); ctx.lineTo(x + 16 * s, y);
  ctx.lineTo(x + 8 * s, y + 7 * s); ctx.lineTo(x + 8 * s, y + 3 * s); ctx.lineTo(x, y + 3 * s); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawFusion(game, m, now) {
  const pr = game.profile;
  // checker backdrop, as in the reference
  for (let y = 0; y < VH; y += 16) for (let x = 0; x < VW; x += 16) {
    ctx.fillStyle = ((x + y) / 16) % 2 ? '#332215' : '#3d281a'; ctx.fillRect(x, y, 16, 16);
  }
  text('FUSION ALTAR', VW / 2, 22, '#e8d2a0', 13);
  // your gold (what PROTECT spends), top right
  const gs = `${(pr.gold || 0).toLocaleString()} G`, gw = textW(gs, 8) + 28, gx = VW - 14 - gw;
  ctx.fillStyle = 'rgba(22,15,9,0.88)'; rrect(ctx, gx, 12, gw, 18, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,80,0.75)'; ctx.lineWidth = 1; rrect(ctx, gx + 0.5, 12.5, gw - 1, 17, 9); ctx.stroke();
  iconCentered('items', homeIcon(21), gx + 11, 21, 12);
  text(gs, gx + 20, 21.3, '#ffe9a8', 8, 'left');
  text('MERGE ➜', 150, 76, '#9aa0ae', 14);
  text('RESULT', MG.res.x + MG.res.w / 2, 76, '#ffc864', 14);
  // the steel merge frame with three slots
  drawSteelFrame(MG.frame.x, MG.frame.y, MG.frame.w, MG.frame.h);
  const cards = m.sel.map(u => pr.cards.find(c => c.uid === u));
  const animK = m.anim > 0 ? 1 - m.anim / 1500 : 0;
  for (let i = 0; i < 3; i++) {
    const S = MG.slot(i);
    drawEmptySlot(S, now, i);
    const c = cards[i] || (m.anim > 0 && m.fromCards && m.fromCards[i]);
    if (c) {
      ctx.save();
      if (m.anim > 0) { ctx.globalAlpha = Math.max(0, 1 - animK * 1.6); }
      drawCardArt(c, S.x + 8, S.y + 6, S.w - 16, S.h - 22, now, { label: false });
      ctx.restore();
      if (m.anim <= 0) text(`RANK ${RANKS[c.tier]}`, S.x + S.w / 2, S.y + S.h - 8, rankColor(c.tier, now), 8);
    }
  }
  // energy stream: arrows and particles flowing into RESULT
  const flowing = cards.length >= 2 || m.anim > 0;
  for (let i = 0; i < 2; i++) drawArrow(MG.slot(i).x + 82, 160, 0.9, '#e8d2a0', flowing ? 0.9 : 0.35);
  drawArrow(MG.frame.x + MG.frame.w + 12, 160, 2.2, '#f0e0b0', flowing ? 1 : 0.35);
  if (flowing) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const k = ((now / (m.anim > 0 ? 500 : 1100) + i / 40) % 1);
      const sx = 260 + (i % 7) * 4, sy = 160 + Math.sin(i * 1.7) * 30;
      const ex = MG.res.x + 20, ey = 160;
      const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k + Math.sin(k * Math.PI * 2 + i) * 6 * (1 - k);
      ctx.globalAlpha = (1 - k) * 0.9; ctx.fillStyle = i % 3 ? '#ffd27a' : '#7ae0ff';
      const s = i % 5 ? 1.5 : 3;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
  }
  // RESULT frame
  const R = MG.res;
  drawGoldFrame(R, now, flowing);
  if (m.fail) drawFailResult(m, R, now);   // a failed merge: the card forms, cracks, then breaks (or the shield catches it)
  else if (m.anim > 0 || m.result) {
    const show = m.anim > 0 ? Math.max(0, (animK - 0.55) / 0.45) : 1;
    if (show > 0 && m.result) {
      ctx.save(); ctx.globalAlpha = show;
      const sc = 0.7 + 0.3 * show;
      const cw = (R.w - 26) * sc, ch = (R.h - 30) * sc;
      drawCardArt(m.result, R.x + R.w / 2 - cw / 2, R.y + R.h / 2 - ch / 2 - 4, cw, ch, now, { label: false, sel: true });
      ctx.restore();
    }
    if (m.anim > 0 && animK > 0.45 && animK < 0.7) { ctx.fillStyle = `rgba(255,255,255,${(0.7 - Math.abs(animK - 0.57) * 5)})`; ctx.fillRect(0, 0, VW, VH); }
  } else if (kiPlan(cards)) {   // Ki: the Ki card itself waits in RESULT
    const kp = kiPlan(cards); if (kp.base) { ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 300);
      drawCardArt(kp.base, R.x + 13, R.y + 11, R.w - 26, R.h - 30, now, { label: false }); ctx.restore();
      text(kp.error ? '+?' : `+${kp.gain} KI`, R.x + R.w / 2, R.y + R.h / 2, KI.col, 13); }
  } else if (cards.length >= 2) {
    const preview = fuseCards(cards);
    ctx.save(); ctx.globalAlpha = 0.45 + 0.15 * Math.sin(now / 300);
    drawCardArt(preview, R.x + 13, R.y + 11, R.w - 26, R.h - 30, now, { label: false });
    ctx.restore();
    text('?', R.x + R.w / 2, R.y + R.h / 2, '#ffffff', 22);
  } else {
    ctx.strokeStyle = `rgba(200,230,255,${0.6 + 0.3 * Math.sin(now / 400)})`; ctx.lineWidth = 2;
    rrect(ctx, R.x + R.w / 2 - 16, R.y + R.h / 2 - 20, 32, 40, 4); ctx.stroke();
    for (const [sx, sy] of [[R.x + 28, R.y + 30], [R.x + R.w - 30, R.y + R.h - 34], [R.x + R.w - 26, R.y + 36]]) {
      ctx.fillStyle = '#e8f4ff'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 200 + sx);
      ctx.fillRect(sx - 0.5, sy - 3, 1, 6); ctx.fillRect(sx - 3, sy - 0.5, 6, 1); ctx.globalAlpha = 1;
    }
  }
  // result info + merge button
  const kiP = kiPlan(cards);
  if (kiP && !m.result && !m.fail) drawKiPlan(kiP, now);
  else if (cards.length >= 2 && !m.result) {
    const pv = fuseCards(cards);
    text(`${pv.name}  ·  RANK ${RANKS[pv.tier]}  ·  Fusion power ${fusionPower(pv)}`, 300, 248 - 12, '#e8d2a0', 8);
  }
  const ready = cards.length >= 2 || !!(kiP && !kiP.error);
  if (ready && !kiP && !m.result && !m.fail) {   // the odds, and the protection
    const pt = fuseCards(cards).tier, fc = mergeFail(pt), cost = PROTECT_COST[pt], can = (pr.gold || 0) >= cost;
    text(`SUCCESS ${Math.round((1 - fc) * 100)}%`, 196, 247, fc > 0.35 ? '#ff9a7a' : fc > 0.2 ? '#ffd27a' : '#8fffb0', 8);
    text(m.protect ? '' : 'fail = cards break', 196, 256, '#ff9a8a', 5.5);
    const P2 = MG_PROT;
    ctx.fillStyle = m.protect ? '#2a5a8a' : '#462e1d'; rrect(ctx, P2.x, P2.y, P2.w, P2.h, 4); ctx.fill();
    ctx.strokeStyle = m.protect ? `rgba(160,220,255,${0.6 + 0.3 * Math.sin(now / 250)})` : 'rgba(160,170,190,0.4)'; ctx.lineWidth = 1; rrect(ctx, P2.x + 0.5, P2.y + 0.5, P2.w - 1, P2.h - 1, 4); ctx.stroke();
    text(`${m.protect ? '🛡 PROTECTED' : 'PROTECT'}  ${cost} G`, P2.x + 52, P2.y + 7.3, m.protect ? '#e0f4ff' : can ? '#c8ccd8' : '#8a8a96', 7);
    iconCentered('items', homeIcon(21), P2.x + 104, P2.y + 7, 8); text('[T]', P2.x + P2.w - 13, P2.y + 7.3, '#9aa0ae', 6);
    text(`you have ${pr.gold || 0} G`, P2.x + P2.w / 2, P2.y + 17, can ? '#9aa0ae' : '#ff8a8a', 5.5);
  }
  ctx.fillStyle = ready ? (m.confirm ? '#c86a2a' : '#a8743a') : '#563924'; rrect(ctx, 250, 240, 140, 14, 4); ctx.fill();
  text(m.confirm ? 'PRESS SPACE TO CONFIRM' : kiP ? 'ENHANCE KI  [Space]' : 'MERGE  [Space]', 320, 247, ready ? '#fff' : '#9aa0ae', 8);
  // collection strip
  const list = sortedCards(pr), G = MG.grid;
  for (let i = 0; i < G.cols * G.rows; i++) {
    const idx = m.scroll * G.cols + i;
    const x = G.x + (i % G.cols) * G.cw, y = G.y + Math.floor(i / G.cols) * G.ch;
    if (idx >= list.length) { ctx.strokeStyle = 'rgba(160,170,190,0.18)'; rrect(ctx, x, y, G.cw - 6, G.ch - 8, 3); ctx.stroke(); continue; }
    const c = list[idx], s = m.sel.indexOf(c.uid);
    drawCardArt(c, x, y, G.cw - 6, G.ch - 8, now, { small: true, sel: s >= 0 && idx !== m.cur, badge: s >= 0 ? String(s + 1) : '', dim: s >= 0 });   // (under the cursor only the cursor's outline shows)
    if (idx === m.cur) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; rrect(ctx, x - 2, y - 2, G.cw - 2, G.ch - 4, 4); ctx.stroke(); }
  }
  const it = list[m.cur];
  if (it) text(`${cardName(it)} · RANK ${RANKS[it.tier]}${it.fusion ? ' · Fusion' : ' · ' + cardSpell(it).name}`, VW / 2, 362 - 12, '#c9c1a8', 8);
  text('Enter/click: place in MERGE · click a slot to take it back · Space: merge (2–3 cards, triple = +1 rank) · T: protect · Esc: leave', VW / 2, 362 - 2, '#7a8090', 7);
  if (m.result && m.anim <= 0) {
    text('FUSION COMPLETE!', R.x + R.w / 2, R.y + R.h + 14, `hsl(${(now / 4) % 360},90%,70%)`, 11);
    text(`${m.result.name} · RANK ${RANKS[m.result.tier]}`, R.x + R.w / 2, R.y + R.h + 28, '#e8d2a0', 8);
  }
}

// Fine parchment grain (made once, used as a repeating pattern)
let GRAIN = null;
function parchmentGrain() {
  if (GRAIN) return GRAIN;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), id = g.createImageData(64, 64), r = rng(11);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = r();
    const dark = v < 0.5;
    id.data[i] = dark ? 110 : 255; id.data[i + 1] = dark ? 70 : 245; id.data[i + 2] = dark ? 30 : 215;
    id.data[i + 3] = Math.floor((dark ? 0.10 : 0.08) * 255 * r());
  }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 6; i++) {   // faint fibres
    g.strokeStyle = 'rgba(120,80,40,0.08)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(r() * 64, r() * 64); g.lineTo(r() * 64, r() * 64); g.stroke();
  }
  GRAIN = ctx.createPattern(c, 'repeat');
  return GRAIN;
}
// A panel pressed into the page: darker fill, shadowed top-left edge, highlighted bottom-right edge
function inset3D(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; rrect(ctx, x, y, w, h, 4); ctx.fill();   // a recessed well in the slate
  ctx.beginPath(); rrect(ctx, x, y, w, h, 4); ctx.clip();
  const sh = ctx.createLinearGradient(0, y, 0, y + 8);
  sh.addColorStop(0, 'rgba(0,0,0,0.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, 8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(154,164,184,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 0.5, y + h - 3); ctx.lineTo(x + 0.5, y + 0.5); ctx.lineTo(x + w - 3, y + 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,215,0.6)';
  ctx.beginPath(); ctx.moveTo(x + w - 0.5, y + 3); ctx.lineTo(x + w - 0.5, y + h - 0.5); ctx.lineTo(x + 3, y + h - 0.5); ctx.stroke();
}

// ---------------------------------------------------------------- set dressing & lighting
let TOOLING = null;
function leatherTooling() {   // embossed diamond lattice + grain, tiled
  if (TOOLING) return TOOLING;
  const c = document.createElement('canvas'); c.width = c.height = 24;
  const g = c.getContext('2d'), r = rng(5);
  for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,200,150,0.08)'; g.fillRect(r() * 24, r() * 24, 1, 1); }
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(12, 0); g.lineTo(24, 12); g.lineTo(12, 24); g.lineTo(0, 12); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,190,130,0.16)';
  g.beginPath(); g.moveTo(12, 1); g.lineTo(23, 12); g.moveTo(1, 12); g.lineTo(12, 1); g.stroke();
  g.fillStyle = 'rgba(255,200,120,0.18)'; g.fillRect(11, 11, 2, 2);
  TOOLING = ctx.createPattern(c, 'repeat');
  return TOOLING;
}
function drawDesk(now) {
  // dark wooden desk the book rests on
  const top = 228;
  const dg = ctx.createLinearGradient(0, top, 0, VH);
  dg.addColorStop(0, '#2a1608'); dg.addColorStop(1, '#120802');
  ctx.fillStyle = dg; ctx.fillRect(0, top, VW, VH - top);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  for (let y = top + 18; y < VH; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,190,120,0.06)';
  for (let i = 0; i < 26; i++) { const y = top + 4 + (i * 13) % (VH - top); ctx.beginPath(); ctx.moveTo((i * 71) % VW, y); ctx.quadraticCurveTo((i * 71) % VW + 60, y + 3, (i * 71) % VW + 140, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,200,140,0.12)'; ctx.fillRect(0, top, VW, 1.5);
  // candle (left) — its flicker drives the book lighting
  const cx = 14, cy = 300, fl = candleFlicker(now);
  ctx.fillStyle = '#e8dcc0'; ctx.fillRect(cx - 4, cy - 26, 8, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx + 1, cy - 26, 3, 26);
  ctx.fillStyle = '#a8742a'; ctx.beginPath(); ctx.ellipse(cx, cy, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy - 32, 0, cx, cy - 32, 60 * fl);
  g.addColorStop(0, 'rgba(255,200,110,0.5)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 70, cy - 100, 140, 140);
  ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.ellipse(cx + Math.sin(now / 90) * 0.6, cy - 31, 2.4 * fl, 5 * fl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.ellipse(cx, cy - 30, 1, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // inkwell and quill (right)
  const ix = 626, iy = 330;
  ctx.fillStyle = '#1a110b'; ctx.beginPath(); ctx.ellipse(ix, iy, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2618'; ctx.fillRect(ix - 7, iy - 12, 14, 12);
  ctx.fillStyle = 'rgba(160,180,255,0.35)'; ctx.fillRect(ix - 5, iy - 11, 2, 9);
  ctx.strokeStyle = '#f0e8d8'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(ix + 1, iy - 12); ctx.quadraticCurveTo(ix + 10, iy - 40, ix + 6, iy - 58); ctx.stroke();
  ctx.fillStyle = 'rgba(240,232,216,0.85)';
  ctx.beginPath(); ctx.moveTo(ix + 6, iy - 58); ctx.quadraticCurveTo(ix + 18, iy - 44, ix + 4, iy - 22); ctx.quadraticCurveTo(ix + 9, iy - 42, ix + 6, iy - 58); ctx.fill();
}
const candleFlicker = now => 1 + 0.08 * Math.sin(now / 70) + 0.05 * Math.sin(now / 37 + 1.3);
function bookLighting(now) {
  return;   // (the steel panels need no candlelight: kept below for the parchment look)
  // warm candlelight from the lower left, falling off toward the top right; slight darkening at the far edge
  const fl = candleFlicker(now);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(20, 270, 10, 20, 270, 420 * fl);
  g.addColorStop(0, 'rgba(255,170,80,0.16)'); g.addColorStop(0.5, 'rgba(255,150,60,0.06)'); g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g; ctx.fillRect(BOOK.x - 20, BOOK.y - 30, BOOK.w + 40, BOOK.h + 60);
  ctx.globalCompositeOperation = 'multiply';
  const d = ctx.createLinearGradient(BOOK.x, BOOK.y + BOOK.h, BOOK.x + BOOK.w, BOOK.y);
  d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.6, 'rgba(235,228,240,1)'); d.addColorStop(1, 'rgba(190,180,205,1)');
  ctx.fillStyle = d; ctx.fillRect(BOOK.x - 14, BOOK.y - 22, BOOK.w + 28, BOOK.h + 34);
  ctx.restore();
}
// Turning a page when switching tabs: a sheet sweeps from the spine across the left page
function drawPageTurn(m, now) {
  if (m.turnT == null) return;
  const k = (now - m.turnT) / 380;
  if (k >= 1) { m.turnT = null; return; }
  const e = k * k * (3 - 2 * k), sx = 320, w = PAGE_L.w * (1 - e) * Math.sin((1 - e) * Math.PI / 2 + 0.2);
  const lift = Math.sin(e * Math.PI) * 10;
  ctx.save();
  ctx.shadowColor = 'rgba(40,20,0,0.5)'; ctx.shadowBlur = 8 * RES; ctx.shadowOffsetX = -3 * RES;
  const pg = ctx.createLinearGradient(sx - w, 0, sx, 0);
  pg.addColorStop(0, '#563924'); pg.addColorStop(0.7, '#3a2618'); pg.addColorStop(1, '#22160e');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.moveTo(sx, PAGE_L.y); ctx.lineTo(sx - w, PAGE_L.y - lift); ctx.quadraticCurveTo(sx - w - 4, PAGE_L.y + PAGE_L.h / 2, sx - w, PAGE_L.y + PAGE_L.h + lift * 0.4); ctx.lineTo(sx, PAGE_L.y + PAGE_L.h); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// the spell-key gem on a card: a dark stone in a gold rim with the key in bright gold, big enough to read at a glance
function dcKeyGem(str, x, y, r) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 2 * RES; ctx.shadowOffsetY = 0.8 * RES;
  ctx.fillStyle = '#1a1006'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#e0a830'); g.addColorStop(1, '#8a5410'); ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  const f = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0.5, x, y, r); f.addColorStop(0, '#4a3a6a'); f.addColorStop(1, '#20150d'); ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, r - 0.7, 0, Math.PI * 2); ctx.fill();
  text(str, x, y + 0.4, '#ffe27a', Math.max(7.5, r * 1.35));
}
