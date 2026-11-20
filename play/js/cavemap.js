'use strict';
// CAVE MAP (2026-11-07): the cave floors are the original games' own big maps, and dark, so a small map in the top-right corner
// fills in as you explore: everything within CMAP.see tiles of you is marked seen (kept on the floor's map for the session, so
// coming back up a floor shows what you found). Rock is drawn dark, floor in the cave's own glow colour, and once seen: the way
// out (green), the stairs down or the keeper's chest (gold), the ore and crystal to gather (soft yellow / lilac). You are the
// blinking dot. Drawn over the darkness, on a dark backing, never larger than CMAP.max px.
const CMAP = { see: 6, max: [92, 68], x: 8, y: 74, a: 0.9 };
function cmapReveal(w) {
  const M = MAPS[w.door.key], p = w.player; if (!M || !p) return null;
  const S = M.cmSeen || (M.cmSeen = new Uint8Array(M.w * M.h)), tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16), R = CMAP.see;
  let changed = false;
  for (let y = Math.max(0, ty - R); y <= Math.min(M.h - 1, ty + R); y++) for (let x = Math.max(0, tx - R); x <= Math.min(M.w - 1, tx + R); x++) {
    if ((x - tx) ** 2 + (y - ty) ** 2 > R * R) continue; const i = y * M.w + x; if (!S[i]) { S[i] = 1; changed = true; }
  }
  if (changed) M.cmDirty = true;
  return M;
}
function cmapPicture(M, col) {
  if (M.cmPic && !M.cmDirty) return M.cmPic;
  const c = M.cmPic || document.createElement('canvas'); c.width = M.w; c.height = M.h;
  const g = c.getContext('2d'), im = g.createImageData(M.w, M.h), [fr, fg, fb] = col;
  for (let i = 0; i < M.w * M.h; i++) {
    if (!M.cmSeen[i]) continue; const o = i * 4;
    if (M.solid[i]) { im.data[o] = 34; im.data[o + 1] = 30; im.data[o + 2] = 44; im.data[o + 3] = 230; }
    else { im.data[o] = fr; im.data[o + 1] = fg; im.data[o + 2] = fb; im.data[o + 3] = 235; }
  }
  g.putImageData(im, 0, 0); M.cmPic = c; M.cmDirty = false; return c;
}
const cmapHex = h => { const n = parseInt(String(h || '#8fd8ff').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * 0.55 + 40)); };
function drawCaveMap(w, now) {
  if (!w.rockCave || !w.door || !w.player) return;
  const M = cmapReveal(w); if (!M) return;
  const k = Math.min(CMAP.max[0] / M.w, CMAP.max[1] / M.h), mw = Math.round(M.w * k), mh = Math.round(M.h * k), x0 = VW - CMAP.x - mw, y0 = CMAP.y;
  const look = typeof rcLook === 'function' ? rcLook(w.rockCave.cave) : null, pic = cmapPicture(M, cmapHex(look && look.glow));
  resetView(); ctx.save();
  ctx.fillStyle = 'rgba(8,8,16,0.82)'; ctx.fillRect(x0 - 3, y0 - 3, mw + 6, mh + 6);
  ctx.strokeStyle = 'rgba(201,162,74,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 3.5, y0 - 3.5, mw + 7, mh + 7);
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = CMAP.a; ctx.drawImage(pic, x0, y0, mw, mh); ctx.globalAlpha = 1;
  const seen = (px, py) => { const i = Math.floor(py / 16) * M.w + Math.floor(px / 16); return !!M.cmSeen[i]; };
  const dot = (px, py, col, r = 1.6) => { if (!seen(px, py)) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + px / 16 * k, y0 + py / 16 * k, r, 0, Math.PI * 2); ctx.fill(); };
  if (M.entry) dot(M.entry[0], M.entry[1], '#8fffa0', 2);
  if (M.rcStairs) dot(M.rcStairs.x, M.rcStairs.y, '#ffd23f', 2);
  if (M.rcChest) dot(M.rcChest.x, M.rcChest.y, '#ffd23f', 2);
  for (const N of M.rcNodes || []) dot(N.x, N.y, N.kind === 'ore' ? '#ffe08a' : '#d8b8ff', 1.4);
  const p = w.player; ctx.fillStyle = Math.floor(now / 350) % 2 ? '#ffffff' : '#ffd860';
  ctx.fillRect(Math.round(x0 + p.x / 16 * k) - 1.5, Math.round(y0 + p.y / 16 * k) - 1.5, 3, 3);
  ctx.restore();
}
{
  const df = drawRcFront;
  drawRcFront = (w, now) => { const r = df(w, now); try { drawCaveMap(w, now); } catch (e) {} return r; };
}
