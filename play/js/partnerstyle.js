'use strict';
// PARTNER COLOURS (the Stylist): the PARTNER button in the corner of the Stylist's preview (or P, not while typing the name) opens a
// small screen to recolour your partner: up to four of their own colours (charmake.js charBake palette), the same swatches as the
// hero's, with a preview that plays their idle, walk and attack. SAVE keeps it (P.paint = { hueBin: STYLE_COLORS id }) and they come
// back out in it at once (heropartner.js partnerBank / partnerRefit). Co-op: the snapshot carries it (net.js ppt, netpets.js netPaint),
// so a friend sees the same colours; a change made while together shows for them the next time the partner comes out.
const PSTYLE = { btn: { x: 34, y: 60, w: 40, h: 14 }, ms: 1500, moves: [['idle', 'Idle'], ['walk', 'Walk'], ['attack', 'Attack']],
  save: { x: 330, y: 290, w: 130, h: 24 }, back: { x: 470, y: 290, w: 110, h: 24 } };
const pstyleBins = P => { const B = P && charBake(P.id, null); return B ? B.pal : []; };
const pstylePaint = (P, vals) => { const out = {}; pstyleBins(P).forEach((b, i) => { if (vals[i] && vals[i] !== 'orig') out[b.bin] = vals[i]; }); return out; };
function partnerStyleOpen(game, back) {
  const P = partnerOf(game.profile);
  if (!P || P.dead) { game.toast('No partner with you to restyle', '#c9c1a8'); return; }
  const bins = pstyleBins(P); if (!bins.length) return;
  game.menu = { type: 'pstyle', back, row: 0, dirT: 0, vals: bins.map(b => (P.paint || {})[b.bin] || 'orig') };
}
// the Stylist: its corner button and P open it (only when editing a hero who has a living partner)
const pstyleReady = (game, m) => m.edit && !!partnerOf(game.profile) && !partnerOf(game.profile).dead;
{
  const uc = updateCustom;
  updateCustom = (game, m, dt) => {
    if (pstyleReady(game, m)) {
      const B = PSTYLE.btn, row = customRows(m)[m.row];
      if (clicked(B.x, B.y, B.w, B.h) || (row !== 'name' && hit('KeyP'))) { consume('KeyP'); mouse.click = false; partnerStyleOpen(game, m); return; }
    }
    return uc(game, m, dt);
  };
  const dc = drawCustom;
  drawCustom = (game, m, now) => {
    const r = dc(game, m, now);
    if (pstyleReady(game, m)) { const B = PSTYLE.btn; panel(B.x, B.y, B.w, B.h, HERO_P.col, 'rgba(48,32,20,0.92)'); text('Partner', B.x + B.w / 2, B.y + B.h / 2 + 0.5, HERO_P.col, 7); }
    return r;
  };
}
function updatePartnerStyle(game, m, dt) {
  m.dirT += dt;
  const P = partnerOf(game.profile), n = pstyleBins(P).length, rows = n + 1;
  if (!P || !n) { game.menu = m.back; return; }
  if (hit('ArrowUp', 'KeyW')) m.row = (m.row + rows - 1) % rows;
  if (hit('ArrowDown', 'KeyS')) m.row = (m.row + 1) % rows;
  const d = hit('ArrowLeft', 'KeyA') ? -1 : hit('ArrowRight', 'KeyD') ? 1 : 0;
  if (d && m.row < n) { const i = STYLE_IDS.indexOf(m.vals[m.row]); m.vals[m.row] = STYLE_IDS[(i + d + STYLE_IDS.length) % STYLE_IDS.length]; }
  for (let r = 0; r < n; r++) STYLE_IDS.forEach((id, i) => { if (clicked(CUS.sx + i * CUS.sw, pstyleY(r) - 1, CUS.sw - 3, 18)) { m.vals[r] = id; m.row = r; } });
  if (hit('KeyR')) m.vals = m.vals.map(() => pick(STYLE_IDS));
  const save = (m.row === n && hit('Enter', 'Space')) || clicked(PSTYLE.save.x, PSTYLE.save.y, PSTYLE.save.w, PSTYLE.save.h);
  if (hit('Escape') || clicked(PSTYLE.back.x, PSTYLE.back.y, PSTYLE.back.w, PSTYLE.back.h)) { consume('Escape'); game.menu = m.back; return; }
  if (save) {
    P.paint = pstylePaint(P, m.vals); game.save();
    if (typeof partnerRefit === 'function') partnerRefit(game);
    game.toast(`${P.name} looks lovely!`, HERO_P.col); game.menu = m.back;
  }
}
const pstyleY = r => 96 + r * 30;
function drawPartnerStyle(game, m, now) {
  const P = partnerOf(game.profile); if (!P) return;
  ctx.fillStyle = 'rgba(6,6,14,0.9)'; ctx.fillRect(0, 0, VW, VH);
  text('PARTNER COLOURS', VW / 2, 30, HERO_P.col, 16);
  panel(30, 56, 260, 270, '#5a8ab0');
  const bins = pstyleBins(P), paint = pstylePaint(P, m.vals);
  if (m.row < bins.length && (now % CUSTOM_GLINT.every) < CUSTOM_GLINT.ms) paint[bins[m.row].bin] = 'glint';   // (what the row paints glints, as on the hero)
  const bank = partnerBank(P.id, paint), M = PSTYLE.moves, mi = Math.floor(m.dirT / PSTYLE.ms) % M.length, dir = [2, 1, 0, 3][Math.floor(m.dirT / (PSTYLE.ms * M.length)) % 4];
  M.forEach(([, label], i) => text(label, 160 + (i - 1) * 56, 72, i === mi ? '#ffd23f' : '#b8ae96', 7));
  const seq = (bank.anims[M[mi][0]] || bank.anims.idle)[dir] || bank.anims.idle[2], e = seqFrame(seq, now, true);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(160, 236, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(32, 80, 256, 188); ctx.clip(); ctx.imageSmoothingEnabled = false; ctx.translate(160, 236); ctx.scale(5, 5); drawBankFrame(bank, e, 0, 0); ctx.restore();
  text(P.name, 160, 284, '#fff', 13); text(`Lv ${P.lv} · your partner`, 160, 300, '#c9c1a8', 8);
  bins.forEach((b, r) => {
    const y = pstyleY(r), on = m.row === r;
    if (on) { ctx.fillStyle = 'rgba(143,216,255,0.08)'; rrect(ctx, CUS.lx - 6, y - 4, VW - CUS.lx - 4, 22, 4); ctx.fill(); }
    text(`Colour ${r + 1}`, CUS.lx, y + 7, on ? '#ffd23f' : '#e8e2cf', 9, 'left');
    ctx.fillStyle = b.col; rrect(ctx, CUS.sx - 14, y + 2, 10, 10, 2); ctx.fill();
    STYLE_IDS.forEach((id, i) => {
      const sx = CUS.sx + i * CUS.sw, S = STYLE_COLORS[id], sel = (m.vals[r] || 'orig') === id;
      ctx.fillStyle = S.swatch || '#261910'; rrect(ctx, sx, y - 1, CUS.sw - 3, 18, 3); ctx.fill();
      if (!S.swatch) text('◇', sx + (CUS.sw - 3) / 2, y + 8, '#c9c1a8', 8);
      if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; rrect(ctx, sx - 1.5, y - 2.5, CUS.sw, 21, 4); ctx.stroke(); ctx.lineWidth = 1; }
    });
    text(STYLE_COLORS[m.vals[r] || 'orig'].name, CUS.sx + STYLE_IDS.length * CUS.sw + 4, y + 8, '#c9c1a8', 7.5, 'left');
  });
  const S = PSTYLE.save, B = PSTYLE.back, onS = m.row === bins.length;
  panel(S.x, S.y, S.w, S.h, onS ? '#ffd23f' : '#5a5040', onS ? 'rgba(70,55,20,0.95)' : 'rgba(30,20,13,0.92)'); text('SAVE COLOURS', S.x + S.w / 2, S.y + S.h / 2, onS ? '#ffd23f' : '#e8e2cf', 9);
  panel(B.x, B.y, B.w, B.h, '#5a5040', 'rgba(30,20,13,0.92)'); text('BACK (Esc)', B.x + B.w / 2, B.y + B.h / 2, '#e8e2cf', 8);
  text('↑↓ choose · ←→ or click: colour · R: random colours · Enter on SAVE · Esc: back to your hero', VW / 2, 340, '#c9c1a8', 8);
}
