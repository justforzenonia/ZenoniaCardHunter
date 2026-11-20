'use strict';
// HUD and menus (inventory/loadout, fusion altar, zone select, arena setup, dialogs, title, class select).

const KEYS_OK = ['Enter', 'KeyJ', 'KeyF', 'NumpadEnter'];
const KEYS_BACK = ['Escape', 'Backspace'];
const navInput = () => ({
  l: hit('ArrowLeft', 'KeyA'), r: hit('ArrowRight', 'KeyD'), u: hit('ArrowUp', 'KeyW'), d: hit('ArrowDown', 'KeyS'),
  ok: hit(...KEYS_OK), back: hit(...KEYS_BACK),
});

// ---------------------------------------------------------------- shared drawing
function monsterPreview(sp, x, y, maxW, maxH, tier = 0, now = 0, anim = 'idle', maxScale = 1.5) {
  if (SPECIES[sp] && SPECIES[sp].chef) return skillArt(sp, x, y, maxW, maxH);
  if (SPECIES[sp] && SPECIES[sp].arcana) return arcanaArt(sp, x, y, maxW, maxH);
  const bank = sp.frames ? sp : charBank(sp);   // a monster, or a villager (NPC cards), or a bank handed in
  if (!bank) return;
  const seq = bank.anims[anim] ? bank.anims[anim][2] : bank.anims.idle[2];
  const e = seqFrame(seq, now, true);
  const rec = e && bank.frames[e[0]];
  if (!rec) return;
  const s = Math.min(maxScale, maxW / rec[2], maxH / rec[3]);
  // centre the frame inside the box
  const cx = x + maxW / 2 - (rec[4] + rec[2] / 2) * s, cy = y + maxH / 2 - (rec[5] + rec[3] / 2) * s;
  drawRec(img(bank.imgs[Math.min(bank.imgs.length - 1, tier >= 8 ? 3 : tier >= 6 ? 2 : tier >= 4 ? 1 : 0)]), rec, cx, cy, false, s);
}
function drawCardTile(c, x, y, w, h, now, opt = {}) {
  now = CARD_STILL;   // every card is a still image: glow, sheen, sprite and rainbow rank held at one moment
  const col = rankColor(c.tier, now);
  ctx.fillStyle = c.fusion ? '#402a1b' : '#302014'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 2, y + 2, w - 4, h * 0.55);
  ctx.strokeStyle = col; ctx.lineWidth = opt.sel ? 2 : 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (c.fusion) { ctx.strokeStyle = '#ffd23f'; ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5); }
  if (c.fusion) {
    const parts = c.fusion.slice(0, 3);
    parts.forEach((p, i) => monsterPreview(cardIconSpecies(p), x + 2 + i * (w - 4) / parts.length - 2, y + 9, (w - 4) / parts.length + 4, h - 20, p.tier, now));
  } else monsterPreview(c.sp, x + 3, y + 9, w - 6, h - 20, c.tier, now);
  text(RANKS[c.tier], x + 3, y + 6, col, 8, 'left');
  if (opt.badge) text(opt.badge, x + w - 3, y + 6, '#ffd23f', 8, 'right');
  if (opt.label) text(opt.label, x + w / 2, y + h - 6, '#e8e2cf', 7);
  if (opt.dim) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, w, h); }
}
function drawGearTile(g, x, y, w, h, now, opt = {}) {
  const col = rankColor(g.tier, now);
  ctx.fillStyle = '#302014'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = col; ctx.lineWidth = opt.sel ? 2 : 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  iconCentered('items', g.icon, x + w / 2, y + h / 2 - 1, 24);
  text(RANKS[g.tier], x + 3, y + 6, col, 8, 'left');
  if (opt.badge) text(opt.badge, x + w - 3, y + 6, '#ffd23f', 8, 'right');
}
function detailLines(lines, x, y, w, now) {
  let yy = y;
  for (const [str, col, size, bold] of lines) {
    for (const ln of wrap(str, w, size || 9)) { text(ln, x, yy, col || '#e8e2cf', size || 9, 'left', bold ?? false); yy += (size || 9) + 3; }
    yy += 2;
  }
  return yy;
}
function cardDetail(c, now) {
  const L = [[(c.fusion ? '✦ ' : '') + cardName(c), rankColor(c.tier, now), 12, true], [`Rank ${RANKS[c.tier]}${c.fusion ? ' Fusion Card' : ' · ' + SPECIES[c.sp].name + ' card'}`, '#c9c1a8', 9]];
  L.push(['PASSIVE' + (c.fusion ? 'S (75%)' : ''), '#ffd23f', 8, true]);
  for (const p of cardPassives(c)) L.push([`${passiveName(p)}: ${PASSIVES[p.id].fmt(passiveValue(p.id, p.tier) * (p.mul || 1))}`, '#bfe6ff', 9]);
  if (c.fusion) {
    L.push(['FUSION ATTACK', '#ffd23f', 8, true]);
    L.push([`Summons ${c.fusion.length} monsters and fires every ingredient spell, then a final burst. Power ${fusionPower(c)}.`, '#ffe9a8', 9]);
    L.push(['Ingredients: ' + c.fusion.map(x => `[${RANKS[x.tier]}] ${cardName(x)}`).join(', '), '#c9c1a8', 8]);
  } else {
    const sp = cardSpell(c);
    L.push(['SPELL', '#ffd23f', 8, true]);
    L.push([sp.name, ELEMENTS[sp.el].col, 10, true]);
    L.push([spellDesc(sp), '#e8e2cf', 8]);
  }
  return L;
}

// ---------------------------------------------------------------- HUD
function drawHUD(a, side, now, label) {
  const left = side === 0;
  const x = left ? 8 : VW - 8 - 170;
  panel(x - 4, 4, 178, 54, 'rgba(201,168,90,0.6)', 'rgba(22,15,9,0.7)');
  text(label, left ? x : x + 170, 12, left ? '#ff8a7a' : '#7fc0ff', 9, left ? 'left' : 'right');
  bar(x, 20, 170, 7, a.hp / a.maxHp, a.hp / a.maxHp > 0.3 ? '#5bd86b' : '#ff5a4e');
  text(`${Math.ceil(a.hp)}/${a.maxHp}`, x + 85, 23.5, '#fff', 7);
  if (a.shield > 0) bar(x, 28, Math.min(170, 170 * a.shield / a.maxHp), 2, 1, '#9fd3ff');
  bar(x, 32, 170, 4, a.mp / a.maxMp, '#4ea8ff');
  const ready = a.fusion && a.fgauge >= 100;
  bar(x, 40, 170, 4, (a.fgauge || 0) / 100, ready ? `hsl(${(now / 4) % 360},90%,60%)` : '#c9a85a');
  text(a.fusion ? (ready ? 'FUSION READY' : 'Fusion') + ` · ${a.fusion.name}` : 'No fusion card equipped', left ? x : x + 170, 51, ready ? '#ffd23f' : '#9a917c', 7, left ? 'left' : 'right');
  if (a.combo >= 2) {
    const pulse = 1 + Math.max(0, a.comboT - 1100) / 300;
    text(a.combo + ' HITS', left ? 12 : VW - 12, 74, '#ffd23f', Math.round(15 * pulse), left ? 'left' : 'right');
  }
}
function drawSpellBar(a, keysLbl, x, y, now) {
  for (let i = 0; i < 3; i++) {
    const sp = a.spells[i], bx = x + i * 30;
    ctx.fillStyle = 'rgba(22,15,9,0.8)'; ctx.fillRect(bx, y, 26, 26);
    ctx.strokeStyle = sp ? rankColor(sp.tier, now) : '#555'; ctx.strokeRect(bx + 0.5, y + 0.5, 25, 25);
    if (sp) {
      icon('skills', sp.icon, bx + 1, y + 1);
      if (a.cds[i] > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx + 1, y + 1, 24, 24 * a.cds[i] / sp.cd); }
      if (a.mp < sp.mp) { ctx.fillStyle = 'rgba(20,40,120,0.45)'; ctx.fillRect(bx + 1, y + 1, 24, 24); }
    }
    text(keysLbl[i], bx + 3, y + 4, '#fff', 7, 'left');
  }
  const fx = x + 92;
  ctx.fillStyle = 'rgba(22,15,9,0.8)'; ctx.fillRect(fx, y, 26, 26);
  ctx.strokeStyle = a.fusion && a.fgauge >= 100 ? `hsl(${(now / 4) % 360},90%,60%)` : '#7a6a3a'; ctx.strokeRect(fx + 0.5, y + 0.5, 25, 25);
  if (a.fusion) monsterPreview(cardIconSpecies(a.fusion), fx + 2, y + 2, 22, 22, a.fusion.tier, now);
  text(keysLbl[3], fx + 3, y + 4, '#fff', 7, 'left');
  // dash cooldown
  const dx = fx + 30, cd = (a.dashCd || 0) / 1000;
  ctx.fillStyle = 'rgba(22,15,9,0.8)'; ctx.fillRect(dx, y, 26, 26);
  ctx.strokeStyle = cd > 0 ? '#3a5a6a' : '#9fe8ff'; ctx.strokeRect(dx + 0.5, y + 0.5, 25, 25);
  text('»', dx + 13, y + 14, cd > 0 ? '#4a6a7a' : '#9fe8ff', 14);
  if (cd > 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(dx + 1, y + 1, 24, 24 * cd); }
  text(keysLbl[4] || 'Dash', dx + 13, y + 31, '#c9c1a8', 6);
}

// ---------------------------------------------------------------- generic list grid
function gridNav(st, n, cols) {
  const k = navInput();
  if (k.l) st.cur = Math.max(0, st.cur - 1);
  if (k.r) st.cur = Math.min(n - 1, st.cur + 1);
  if (k.u) st.cur = Math.max(0, st.cur - cols);
  if (k.d) st.cur = Math.min(n - 1, st.cur + cols);
  st.cur = clamp(st.cur, 0, Math.max(0, n - 1));
  return k;
}

// ---------------------------------------------------------------- zone select / arena / dialog
function arenaMenu() { return { type: 'arena', cur: 0, rank: 3 }; }
const ARENA_OPTS = ['Vs CPU champion', '2 Players — P2 gets a random build', '2 Players — P2 mirrors your build'];
function updateArena(game, m) {
  const k = navInput();
  if (k.u) m.cur = (m.cur + 2) % 3;
  if (k.d) m.cur = (m.cur + 1) % 3;
  if (m.cur !== 2) { if (k.l) m.rank = Math.max(0, m.rank - 1); if (k.r) m.rank = Math.min(9, m.rank + 1); }
  ARENA_OPTS.forEach((o, i) => { if (clicked(120, 100 + i * 50, 400, 40)) { k.ok = true; m.cur = i; } });
  if (k.back) { game.closeMenu(); return; }
  if (k.ok) {
    const pr = game.profile;
    const p2 = m.cur === 2 ? JSON.parse(JSON.stringify(pr)) : randomProfile(CLASS_PICKS()[randi(0, CLASS_PICKS().length - 1)], m.rank);
    game.closeMenu(); game.goArena(p2, m.cur === 0);
  }
}
function drawArenaMenu(game, m, now) {
  ctx.fillStyle = 'rgba(8,8,16,0.85)'; ctx.fillRect(0, 0, VW, VH);
  goldText('VERSUS', VW / 2, 40, 18, { spacing: 3, glow: 'rgba(255,200,80,0.6)' });
  text('Your deck, spells, fusion card and gear come with you. Best of 3 rounds.', VW / 2, 64, '#c9c1a8', 9);
  ARENA_OPTS.forEach((o, i) => {
    const y = 100 + i * 50, on = i === m.cur;
    panel(120, y, 400, 40, on ? '#ffd23f' : '#5a5040', on ? 'rgba(50,40,20,0.95)' : 'rgba(30,20,13,0.92)');
    text(o, 140, y + 14, on ? '#ffd23f' : '#e8e2cf', 11, 'left');
    if (i !== 2) text(`Opponent rank: ◀ ${RANKS[m.rank]} ▶`, 140, y + 29, rankColor(m.rank, now), 9, 'left');
    else text('Same cards, gear and fusion as you', 140, y + 29, '#9a917c', 9, 'left');
  });
  text('P1: WASD · F attack · Q/E/R spells · G fusion · L-Shift dash      P2: Arrows · K attack · I/O/P spells · L fusion · R-Shift dash', VW / 2, 290, '#e8e2cf', 7);
  text('↑↓ choose · ←→ rank · Enter fight · Esc back', VW / 2, 320, '#c9c1a8', 9);
}

function dialogMenu(name, line, role) { return { type: 'dialog', name, line, role, t: 0, who: dialogSpeaker(name, role) }; }
// the townsfolk you are talking to (the nearest one with that name or role), for the talk box's portrait
function dialogSpeaker(name, role) {
  const w = window.GAME && GAME.world, p = w && w.player; if (!w || !p) return null;
  let best = null, bd = 90;
  for (const a of w.actors) if (a.npc != null && D.npcs[a.npc] && (a.label === name || (role && a.role === role))) { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; best = a; } }
  return best;
}
// TALK PORTRAIT: the speaker in a little framed window at the left of the talk box, facing you, idling, softly lit
function drawDialogPortrait(a, x, y, s, now) {
  const g = ctx.createLinearGradient(0, y, 0, y + s); g.addColorStop(0, '#402a1b'); g.addColorStop(1, '#1a110b');
  ctx.fillStyle = g; rrect(ctx, x, y, s, s, 5); ctx.fill();
  const rg = ctx.createRadialGradient(x + s / 2, y + s * 0.55, 2, x + s / 2, y + s * 0.55, s * 0.6); rg.addColorStop(0, 'rgba(255,226,160,0.28)'); rg.addColorStop(1, 'rgba(255,226,160,0)');
  ctx.fillStyle = rg; ctx.fillRect(x, y, s, s);
  ctx.save(); rrect(ctx, x + 1, y + 1, s - 2, s - 2, 4); ctx.clip();
  try {
    const f = Object.assign(Object.create(Object.getPrototypeOf(a)), a, { dir: 2, anim: 'idle' }), seq = animSeq(f, 'idle'), e = seqFrame(seq, now, true, 1);
    const k = 2.2; ctx.translate(Math.round(x + s / 2), Math.round(y + s - 6)); ctx.scale(k, k); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    drawBankFrame(D.npcs[a.npc], e, 0, 0);
  } catch (err) {}
  ctx.restore();
  ctx.strokeStyle = '#e0b860'; ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, s - 1, s - 1, 5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,200,0.25)'; ctx.lineWidth = 0.6; rrect(ctx, x + 2.5, y + 2.5, s - 5, s - 5, 4); ctx.stroke();
}
// THE WORDS ARRIVE GENTLY: a talk line appears letter by letter (DIALOG_CPS a second); the first Enter shows the rest at once
const DIALOG_CPS = 55, dialogShown = m => Math.floor(m.t * DIALOG_CPS / 1000);
function updateDialog(game, m, dt) {
  m.t += dt;
  if (dialogShown(m) < (m.line || '').length && m.t > 120 && hit(...KEYS_OK, 'Space')) { m.t = ((m.line || '').length + 1) * 1000 / DIALOG_CPS + 160; return; }   // (finish the line first)
  if (m.t > 150 && hit(...KEYS_OK, 'Space')) {
    if (m.pages && m.pages.length) { m.line = m.pages.shift(); m.t = 0; return; }   // more to say
    game.closeMenu();
    if (m.onDone) { m.onDone(); return; }
    if (m.role === 'shop_gear' || m.role === 'shop_item' || m.role === 'shop_weapon' || m.role === 'shop_armor') game.openMenu(shopMenu(m.role));
    else if (m.role === 'cards' || m.role === 'gear') { game.openMenu(inventoryMenu(game)); game.menu.tab = m.role === 'gear' ? 'bag' : 'cards'; }
    else if (m.role === 'altar') game.openMenu(mergeMenu());
    else if (m.role === 'arena') game.openMenu(arenaMenu());
    else if (m.role === 'dojo') startDojoFight(game);
    else if (m.role === 'style') game.openMenu(customMenu(game.profile.cls, game.profile));
    else if (m.role === 'gacha') game.openMenu(gachaMenu());
    else if (m.role === 'quest') game.openMenu(questMenu());
    else if (m.role === 'inn' || m.role === 'heal') {
      const p = game.world.player;
      p.hp = p.maxHp; p.mp = p.maxMp; p.status = {}; const fed = healFeeds(game, 1);
      if (m.role === 'heal') { p.buffAtk = 60000; game.toast(`Healed! +25% attack for 60 s${fedNote(fed)}`, '#8fffd0'); }
      else { game.save(); game.toast(`Fully rested${fedNote(fed)} — progress saved`, '#ffe9a8'); }
      game.world.rings.push({ x: p.x, y: p.y, r: 30, t: 0, col: m.role === 'heal' ? '#8fffd0' : '#ffe9a8' });
    }
  }
  if (hit('Escape')) game.closeMenu();
}
// Zenonia 2's message window (assets/ui_dialog.png: stone panel, silver frame, filigree corners) drawn as a 9-slice
const UI_DIALOG = img('assets/ui_dialog.png'), UI_TAB = img('assets/ui_tab.png');
function nineSlice(im, sc, x, y, w, h, dst) {   // sc = source corner px, dst = corner size on screen
  if (!im || !im.complete || !im.naturalWidth) { ctx.fillStyle = 'rgba(20,20,24,0.95)'; ctx.fillRect(x, y, w, h); return; }
  const W = im.naturalWidth, H = im.naturalHeight, mw = W - 2 * sc, mh = H - 2 * sc;
  const sx = [0, sc, W - sc], sw = [sc, mw, sc], dx = [x, x + dst, x + w - dst], dw = [dst, w - 2 * dst, dst];
  const sy = [0, sc, H - sc], sh = [sc, mh, sc], dy = [y, y + dst, y + h - dst], dh = [dst, h - 2 * dst, dst];
  ctx.save(); ctx.imageSmoothingEnabled = true;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.drawImage(im, sx[c], sy[r], sw[c], sh[r], dx[c], dy[r], dw[c], dh[r]);
  ctx.restore();
}
// KENNEY'S FANTASY BORDERS (CC0): a white 48x48 frame cut 3x3 (16px cells) and tinted per screen, its fine blocky lines
// drawn at a whole-pixel scale so they sit on the game's pixel grid. opt: { top, bot } the tint, fill the window's colour.
const KFRAME = { src: 'assets/ui_border_006.png', div: 'assets/ui_divider.png', cell: 16, scale: 1.5 }, KTINT = {};
function kTint(src, top, bot) {
  const key = `${src}|${top}|${bot}`; if (KTINT[key]) return KTINT[key];
  const im = img(src); if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d');
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; const G = g.createLinearGradient(0, 0, 0, c.height); G.addColorStop(0, top); G.addColorStop(1, bot); g.fillStyle = G; g.fillRect(0, 0, c.width, c.height);
  return (KTINT[key] = c);
}
// the inside of every game window (a screen can still ask for its own fill)
let WIN_FILL = '#22160f';   // dark cocoa (the user's pick, 2026-11-06; it was purple-navy #141020)
function kFrame(x, y, w, h, opt = {}) {
  const top = opt.top || '#fff0b0', bot = opt.bot || '#c08a30', im = kTint(KFRAME.src, top, bot), dark = kTint(KFRAME.src, '#0a0810', '#0a0810');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8 * RES; ctx.shadowOffsetY = 2 * RES; ctx.fillStyle = opt.fill || WIN_FILL; ctx.fillRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  if (!im) return; const C = KFRAME.cell, D = C * KFRAME.scale, midW = w - D * 2, midH = h - D * 2;
  const piece = (I, ox, oy) => {
    const X = [x + ox, x + D + ox, x + w - D + ox], Y = [y + oy, y + D + oy, y + h - D + oy], DW = [D, midW, D], DH = [D, midH, D];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (r !== 1 || c !== 1) ctx.drawImage(I, c * C, r * C, C, C, X[c], Y[r], DW[c], DH[r]);
  };
  ctx.save(); ctx.imageSmoothingEnabled = false; piece(dark, 1, 1); piece(im, 0, 0); ctx.restore();
}
function kDivider(cx, y, half, top, bot) {   // a pair of fading ornaments reaching out from a title
  const im = kTint(KFRAME.div, top, bot); if (!im) return; const H = im.height * 1.5, W = im.width * 1.5 * 0.6;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, cx - half - W, y - H / 2, W, H); ctx.translate(cx + half + W, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, y - H / 2, W, H); ctx.restore();
}
// every game window: the Kenney frame, gold unless a screen asks for its own colours
function zWindow(x, y, w, h, opt) { kFrame(x, y, w, h, opt); }
// the HUD's art: 'Tiny RPG - Mana Soul GUI' by tiopalada (CC0). hudNine: a 96x96 sheet cut 3x3 at scale k; hudBar: a bar
// frame stretched sideways, its ends kept whole.
function hudNine(src, x, y, w, h, k) {
  const im = img(src); if (!im || !im.complete || !im.naturalWidth) return false;
  const C = 32, D = C * k, X = [x, x + D, x + w - D], Y = [y, y + D, y + h - D], W = [D, w - D * 2, D], H = [D, h - D * 2, D];
  ctx.save(); ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.drawImage(im, c * C, r * C, C, C, X[c], Y[r], W[c], H[r]);
  ctx.restore(); return true;
}
function hudBar(src, x, y, w, edge = 14) {
  const im = img(src); if (!im || !im.complete || !im.naturalWidth) return;
  const iw = im.naturalWidth, ih = im.naturalHeight;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, 0, 0, edge, ih, x, y, edge, ih); ctx.drawImage(im, edge, 0, iw - edge * 2, ih, x + edge, y, w - edge * 2, ih); ctx.drawImage(im, iw - edge, 0, edge, ih, x + w - edge, y, edge, ih);
  ctx.restore();
}
function zTab(x, y, w, h) { nineSlice(UI_TAB, 24, x, y, w, h, 12); }
function drawDialog(game, m, now) {
  zWindow(48, 250, 544, 96);
  zTab(62, 238, Math.max(90, textW(m.name, 10) + 30), 22);
  text(m.name, 77, 249.5, '#e8eef8', 10, 'left');
  const pic = m.who && !m.who.away ? 72 : 0;   // (with the speaker's portrait, the words move over to make room)
  if (pic) drawDialogPortrait(m.who, 62, 264, pic, now);
  let left = dialogShown(m);   // (the lines are laid out whole, so words never jump from one row to the next as they appear)
  wrap(m.line, 500 - pic, 10).forEach((ln, i) => { if (left <= 0) return; text(ln.slice(0, left), 70 + pic, 280 + i * 15, '#f0ece2', 10, 'left', false); left -= ln.length + 1; });
  if (dialogShown(m) >= (m.line || '').length) text('▼', 572, 332 + Math.sin(now / 150) * 1.5, '#d8e0ee', 9);
}

// ---------------------------------------------------------------- title & class select
function updateTitle(game, m) {
  if (typeof netGuestBoot === 'function' && netGuestBoot(game)) return;   // reloaded into a host's world to join (net.js)
  const k = navInput();
  const has = !!game.saved;
  if (k.u || k.d) m.cur = has ? 1 - m.cur : 0;
  if (clicked(240, 214, 160, 24)) { m.cur = 0; k.ok = true; }
  if (has && clicked(240, 246, 160, 24)) { m.cur = 1; k.ok = true; }
  if (k.ok) {
    if (m.cur === 1 && has) { game.profile = game.saved; game.closeMenu(); game.goHub(); }
    else game.menu = { type: 'class', cur: 0 };
  }
}
const TITLE_LOGO = { src: 'assets/title_logo.png', w: 336, h: 183, y: 4 };
const TITLE_FAN = { x: 352, y: 332, r: 200, w: 64, h: 92, tilt: 0.29, n: 5 };   // one fan, all cards turning about the same point below the name (in the logo image's pixels), each laid over the one to its left
// The title: the town behind a dusky vignette, slow light rays from above, a fan of cards behind a gold logo that
// catches a sweep of light, motes drifting up, the saved hero on a glowing stone, and ornate buttons.
function drawTitle(game, m, now) {
  // vignette and a deep blue-violet wash, darker at the edges and the foot
  const vg = ctx.createRadialGradient(VW / 2, VH * 0.42, 60, VW / 2, VH * 0.45, VW * 0.7);
  vg.addColorStop(0, 'rgba(30,20,13,0.5)'); vg.addColorStop(1, 'rgba(4,2,12,0.92)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = 'rgba(6,3,14,0.82)'; ctx.fillRect(0, 0, VW, VH);   // nearly black, so the logo stands out as in its design
  const fg = ctx.createLinearGradient(0, VH * 0.55, 0, VH); fg.addColorStop(0, 'rgba(4,2,12,0)'); fg.addColorStop(1, 'rgba(4,2,12,0.8)');
  ctx.fillStyle = fg; ctx.fillRect(0, VH * 0.55, VW, VH * 0.45);
  // light rays from above
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = VW * (0.12 + i * 0.13) + Math.sin(now / 3000 + i) * 18, w = 26 + 14 * Math.sin(now / 1700 + i * 2);
    const g = ctx.createLinearGradient(0, 0, 0, VH * 0.8); g.addColorStop(0, `rgba(255,220,150,${0.12 + 0.05 * Math.sin(now / 900 + i)})`); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, 0); ctx.lineTo(x + w / 2, 0); ctx.lineTo(x + w * 1.6 + 30, VH * 0.8); ctx.lineTo(x - w * 0.4 + 30, VH * 0.8); ctx.fill();
  }
  // motes drifting up
  for (let i = 0; i < 46; i++) { const k = ((now / (5000 + (i % 7) * 900)) + i * 0.137) % 1, x = (i * 131.7 + Math.sin(now / 1400 + i) * 14) % VW, y = VH - k * (VH + 20);
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.fillStyle = i % 4 ? '#ffe9a8' : '#bfe0ff'; ctx.fillRect(x, y, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5); }
  ctx.restore();
  // the logo (assets/title_logo.png, the player's own Gemini design): golden wings and a fan of cards behind ZENONIA in gold, ゼノニア slashed across it in red,
  // CARD HUNTERS beneath; a warm glow breathing behind it and a light sweeping over it now and then
  const cx = VW / 2, LG = TITLE_LOGO, li = img(LG.src);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(cx, LG.y + LG.h * 0.55, 10, cx, LG.y + LG.h * 0.55, 190); lg.addColorStop(0, `rgba(255,190,90,${0.22 + 0.06 * Math.sin(now / 700)})`); lg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = lg; ctx.fillRect(cx - 200, LG.y, 400, LG.h); ctx.restore();
  // the fan of cards behind the name: the game's own card backs, the Z card, where the design drew its cards
  LG.cards = () => { if (typeof drawCardBack === 'function') { const F = TITLE_FAN, k = LG.w / 707, w = F.w * k, h = F.h * k; for (let i = 0; i < F.n; i++) { const t = (i - (F.n - 1) / 2) * F.tilt; ctx.save(); ctx.translate(cx - LG.w / 2 + F.x * k, LG.y + F.y * k); ctx.rotate(t); ctx.translate(0, -F.r * k); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 5 * RES; drawCardBack(-w / 2, -h / 2, w, h, now); ctx.restore(); } } };
  if (li && li.complete && li.naturalWidth) {
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; LG.cards(); ctx.drawImage(li, cx - LG.w / 2, LG.y, LG.w, LG.h);   // the cards first, so the wings and the name lie over them
    const k2 = (now % 5200) / 1600; if (k2 < 1) {   // the sweep of light, masked to the logo's own shape (filled as a plain rectangle it showed as a glowing box)
      const S = 2, oc = TITLE_LOGO.sweep || (TITLE_LOGO.sweep = document.createElement('canvas')), g = oc.getContext('2d'); oc.width = LG.w * S; oc.height = LG.h * S;
      const bx = (k2 * 1.5 - 0.25) * LG.w * S, band = g.createLinearGradient(bx - 40 * S, 0, bx + 40 * S, 0);
      band.addColorStop(0, 'rgba(255,240,200,0)'); band.addColorStop(0.5, 'rgba(255,240,200,0.3)'); band.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = band; g.fillRect(0, 0, oc.width, oc.height); g.globalCompositeOperation = 'destination-in'; g.drawImage(li, 0, 0, oc.width, oc.height);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(oc, cx - LG.w / 2, LG.y, LG.w, LG.h);
    }
    ctx.restore();
  }
  // the saved hero, on a glowing stone at the left
  if (game.saved) {
    const hx = 112, hy = 268;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createRadialGradient(hx, hy, 2, hx, hy, 46); hg.addColorStop(0, 'rgba(255,214,120,0.5)'); hg.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, 46, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#48301e'; ctx.beginPath(); ctx.ellipse(hx, hy + 2, 26, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7a7490'; ctx.beginPath(); ctx.ellipse(hx, hy, 24, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    try { drawPlayerPreview(game.saved.cls, game.saved.look || {}, 3, 'idle', 2, hx, hy, 2.4, now); } catch (e) {}
    text(`${(game.saved.look && game.saved.look.name) || 'Hero'}${game.saved.look && game.saved.look.title ? ' ' + game.saved.look.title : ''}`, hx, hy + 18, '#fff4e0', 8);
    text(`Lv ${game.saved.lv || 1} ${className(game.saved.cls)}`, hx, hy + 29, '#e8be64', 7);
  }
  // ornate buttons
  const opts = game.saved ? ['New Game', 'Continue'] : ['New Game'];
  opts.forEach((o, i) => {
    const on = m.cur === i, bx = cx - 80, by = 214 + i * 32, bw = 160, bh = 24;
    ctx.save(); ctx.shadowColor = on ? '#ffd25a' : 'rgba(0,0,0,0.7)'; ctx.shadowBlur = (on ? 10 : 4) * RES;
    const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, on ? '#6a4a1a' : '#402a1b'); g.addColorStop(0.55, on ? '#3a2408' : '#281a11'); g.addColorStop(1, '#0c0814');
    ctx.fillStyle = g; rrect(ctx, bx, by, bw, bh, 6); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bx + 6, by + 1.8); ctx.lineTo(bx + bw - 6, by + 1.8); ctx.stroke();
    ctx.strokeStyle = goldFrameGrad(by, bh); ctx.lineWidth = 1.3; rrect(ctx, bx + 0.6, by + 0.6, bw - 1.2, bh - 1.2, 6); ctx.stroke();
    if (on) for (const dx of [-12, bw + 12]) { ctx.fillStyle = '#ffd25a'; const ax = bx + dx, ay = by + bh / 2, s = dx < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(ax, ay - 4); ctx.lineTo(ax + 6 * s, ay); ctx.lineTo(ax, ay + 4); ctx.fill(); }
    text(o.toUpperCase(), cx, by + bh / 2 + 0.4, on ? '#ffe9a8' : '#d8d0c0', 10);
  });
  if (game.saved) text(`${game.saved.cards.length} cards · ${game.saved.stats.kills} kills`, cx, 286, '#9a917c', 7.5);
  text('Built from the original Zenonia sprites (Gamevil, 2009) — fan project, not for distribution', VW / 2, 346, '#6a6352', 7);
  if (typeof GAME_VERSION !== 'undefined') text(`v${GAME_VERSION}`, VW - 8, 346, '#8a7a5a', 7, 'right');   // (credits.js)
}
// Draw a player preview (body + glowing weapon + fx) for class/look at (x, y) feet position.
function drawPlayerPreview(cls, look, wlook, anim, dir, x, y, scale, now, center = false) {
  const B = playerBanks(cls, look, wlook);
  const seq = (B.anims[anim] || B.anims.idle)[dir];
  const e = seqFrame(seq, now, true);
  if (center && e) { const r = B.body.frames[e[0]]; if (r) x -= (e[2] + r[4] + r[2] / 2) * scale; }   // centre the body (not its weapon) on x
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if (B.aura) drawAura(0, 0, B.aura, now);
  if (B.focus && dir === 0) { const [fx, fy] = focusHand(dir); drawHeldFocus(B, fx, fy, false, now); }   // (facing away: behind him)
  const order = (weaponBehind(cls, dir, anim) ? [B.weapon, B.body, B.fx] : [B.body, B.weapon, B.fx]).filter(Boolean);
  for (const b of order) {
    if (b === B.weapon && B.glow) { ctx.save(); ctx.filter = B.glow; drawBankFrame(b, e, 0, 0); ctx.restore(); }
    else drawBankFrame(b, e, 0, 0);
  }
  if (B.focus && dir !== 0) { const [fx, fy] = focusHand(dir); drawHeldFocus(B, fx, fy, false, now); }   // the orb / tome held in the hand
  ctx.restore();
}

// Choose your hero: the chosen hero stands large in a spotlight on the left (turning through its facings, on a
// glowing stone, with its name in gold, its blurb and stat bars), the roster of portrait cards on the right.
const CLS_COLS = 4, CLS_CW = 76, CLS_CH = 68, CLS_X0 = 316, CLS_Y0 = 52;   // (four rows of four fit above the hint line)
const clsCell = i => ({ x: CLS_X0 + (i % CLS_COLS) * (CLS_CW + 4), y: CLS_Y0 + Math.floor(i / CLS_COLS) * (CLS_CH + 4), w: CLS_CW, h: CLS_CH });
function updateClass(game, m) {
  // (the roster lists only the heroes still offered, CLASS_PICKS; m.cur stays a class index)
  const k = navInput(), L = CLASS_PICKS(), n = L.length; let pos = Math.max(0, L.indexOf(m.cur));
  if (k.l) pos = (pos + n - 1) % n;
  if (k.r) pos = (pos + 1) % n;
  if (k.u) pos = (pos + n - CLS_COLS) % n;
  if (k.d) pos = (pos + CLS_COLS) % n;
  m.cur = L[pos];
  for (let j = 0; j < n; j++) { const C = clsCell(j); if (clicked(C.x, C.y, C.w, C.h)) { if (m.cur === L[j]) k.ok = true; m.cur = L[j]; } }
  if (clicked(70, 300, 160, 24)) k.ok = true;
  if (k.back) game.menu = { type: 'title', cur: game.saved ? 1 : 0 };   // (back to the title with CONTINUE picked)
  if (k.ok) {
    if (game.saved && !m.sure) { m.sure = true; return; }   // (the warning box in drawClass asks first)
    game.menu = customMenu(m.cur, null);
  }
}
function drawClass(game, m, now) {
  // backdrop: dark wash, slow light rays, motes
  const vg = ctx.createRadialGradient(VW * 0.25, VH * 0.55, 30, VW / 2, VH / 2, VW * 0.75);
  vg.addColorStop(0, 'rgba(48,32,20,0.78)'); vg.addColorStop(1, 'rgba(4,2,12,0.96)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) { const x = 60 + i * 50 + Math.sin(now / 2500 + i) * 10, g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, `rgba(255,214,140,${0.1 + 0.04 * Math.sin(now / 800 + i)})`); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 26, 0); ctx.lineTo(x + 70, VH); ctx.lineTo(x + 30, VH); ctx.fill(); }
  for (let i = 0; i < 30; i++) { const k = ((now / (6000 + (i % 5) * 900)) + i * 0.21) % 1; ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7; ctx.fillStyle = '#ffe9a8'; ctx.fillRect((i * 97) % VW, VH - k * VH, 1.5, 1.5); }
  ctx.restore();
  goldTitle('CHOOSE YOUR HERO', VW / 2, 24, 16, now);
  const C = CLASSES[m.cur], cx = 150, cy = 214;
  // the spotlight
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createRadialGradient(cx, cy - 40, 10, cx, cy, 120); sg.addColorStop(0, 'rgba(255,220,150,0.28)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg; ctx.fillRect(cx - 130, cy - 160, 260, 200);
  const pg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60); pg.addColorStop(0, C.z2 ? 'rgba(140,200,255,0.55)' : 'rgba(255,214,120,0.55)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(cx, cy, 60, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#382518'; ctx.beginPath(); ctx.ellipse(cx, cy + 3, 40, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a6488'; ctx.beginPath(); ctx.ellipse(cx, cy, 38, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d8a850'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, 38, 9, 0, 0, Math.PI * 2); ctx.stroke();
  const dir = [2, 1, 0, 3][Math.floor(now / 1500) % 4];
  drawPlayerPreview(m.cur, null, 3, 'idle', dir, cx, cy, 4.2, now, true);
  goldTitle(C.name.toUpperCase(), cx, 52, 15, now);
  text(C.title || ({ melee: 'Warrior', mage: 'Caster', summoner: 'Summoner', fist: 'Brawler' }[C.style] || ''), cx, 68, '#8fd0ff', 8);
  // blurb and stat bars under the stone
  wrap(C.blurb, 230, 7).slice(0, 2).forEach((ln, j) => text(ln, cx, 236 + j * 10, '#d8d0c0', 7, 'center', false));
  // living stat bars: they slide to the new hero's values (numbers counting along), a light runs along them, and the
  // part a switch gained flashes green, the part it lost red
  const bars = [['hp', 'HP', C.hp, 170, '#ff6a6a'], ['mp', 'MP', C.mp, 170, '#6aa8ff'], ['atk', 'ATK', C.atk, 12, '#ffb84a'], ['spd', 'SPD', C.spd, 90, '#8fff8a']];
  m.bv = m.bv || {}; m.bprev = m.bprev || {};
  if (m.lastCur !== m.cur) { for (const [k] of bars) m.bprev[k] = m.bv[k] != null ? m.bv[k] : 0; m.lastCur = m.cur; m.bt = now; }
  bars.forEach(([k, lbl, v, mx, col], j) => { const y = 262 + j * 9, bx = 66, W2 = 140;
    const cur = m.bv[k] = m.bv[k] == null ? 0 : m.bv[k] + (v - m.bv[k]) * 0.14, f = Math.min(1, cur / mx), from = Math.min(1, (m.bprev[k] || 0) / mx), tgt = Math.min(1, v / mx);
    text(lbl, bx, y, '#c9c1a8', 6.5, 'left');
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rrect(ctx, bx + 26, y - 3.5, W2, 7, 3); ctx.fill();
    const flashK = Math.max(0, 1 - (now - (m.bt || 0)) / 900);
    if (flashK > 0 && Math.abs(tgt - from) > 0.01) { ctx.fillStyle = tgt > from ? `rgba(120,255,140,${0.6 * flashK})` : `rgba(255,90,90,${0.6 * flashK})`; ctx.fillRect(bx + 26 + W2 * Math.min(from, tgt), y - 3.5, W2 * Math.abs(tgt - from), 7); }
    const g = ctx.createLinearGradient(bx + 26, 0, bx + 26 + W2, 0); g.addColorStop(0, col); g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g; rrect(ctx, bx + 26, y - 3.5, Math.max(2, W2 * f), 7, 3); ctx.fill();
    ctx.save(); ctx.beginPath(); rrect(ctx, bx + 26, y - 3.5, Math.max(2, W2 * f), 7, 3); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    const sx = bx + 26 + ((now / 1400 + j * 0.2) % 1.3) * W2 - 20, sh = ctx.createLinearGradient(sx, 0, sx + 20, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(sx, y - 3.5, 20, 7); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + 28, y - 3, Math.max(0, W2 * f - 4), 1);
    text(String(Math.round(cur)), bx + 174, y, '#fff4e0', 6.5, 'left'); });
  // the pick button
  const B = { x: 70, y: 300, w: 160, h: 24 };
  ctx.save(); ctx.shadowColor = '#ffd25a'; ctx.shadowBlur = (6 + 3 * Math.sin(now / 300)) * RES;
  const bg = ctx.createLinearGradient(0, B.y, 0, B.y + B.h); bg.addColorStop(0, '#6a4a1a'); bg.addColorStop(0.55, '#3a2408'); bg.addColorStop(1, '#0c0814');
  ctx.fillStyle = bg; rrect(ctx, B.x, B.y, B.w, B.h, 6); ctx.fill(); ctx.restore();
  ctx.strokeStyle = goldFrameGrad(B.y, B.h); ctx.lineWidth = 1.3; rrect(ctx, B.x + 0.6, B.y + 0.6, B.w - 1.2, B.h - 1.2, 6); ctx.stroke();
  text(m.sure ? 'OVERWRITE SAVE? (Enter)' : 'CHOOSE  ▸', B.x + B.w / 2, B.y + B.h / 2 + 0.4, m.sure ? '#ff9a8a' : '#ffe9a8', 9);
  // the roster
  CLASS_PICKS().forEach((i, j) => {
    const K = CLASSES[i], R = clsCell(j), on = m.cur === i, hx = R.x + R.w / 2;
    ctx.save(); ctx.shadowColor = on ? '#ffd25a' : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = (on ? 9 : 3) * RES;
    const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, on ? '#4a3418' : K.z2 ? '#3c2819' : '#382518'); g.addColorStop(1, '#0c0814');
    ctx.fillStyle = g; rrect(ctx, R.x, R.y, R.w, R.h, 6); ctx.fill(); ctx.restore();
    ctx.strokeStyle = on ? goldFrameGrad(R.y, R.h) : K.z2 ? '#4a6a8a' : '#5a5040'; ctx.lineWidth = on ? 1.6 : 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 6); ctx.stroke();
    ctx.save(); ctx.beginPath(); rrect(ctx, R.x + 2, R.y + 2, R.w - 4, R.h - 22, 5); ctx.clip();
    drawPlayerPreview(i, null, on ? 3 : 0, 'idle', 2, hx, R.y + R.h - 24, 1.5, on ? now : 0);
    ctx.restore();
    text(K.name, hx, R.y + R.h - 14, on ? '#ffe9a8' : '#e8e2cf', 7.5);
    if (K.title) text(K.title, hx, R.y + R.h - 5, K.z2 ? '#8fd0ff' : '#c9b89a', 5.8);
  });
  text('Zenonia heroes, the Zenonia 2 heroes (blue) and more · ←→↑↓ choose · Enter pick · Esc back', VW / 2, 346, '#9a917c', 7);
  if (m.sure && game.saved) {   // a new hero REPLACES the saved one: say so plainly, not just in a passing toast
    const S = game.saved, who = (S.look && S.look.name) || 'your hero', x = VW / 2 - 170, y = 132;
    ctx.fillStyle = 'rgba(40,8,10,0.95)'; rrect(ctx, x, y, 340, 70, 8); ctx.fill(); ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 1.5; rrect(ctx, x + 0.75, y + 0.75, 338.5, 68.5, 8); ctx.stroke();
    text('START A NEW GAME?', VW / 2, y + 14, '#ffb0a0', 11);
    text(`This REPLACES ${who} (Lv ${S.lv || 1}, ${(S.gold || 0).toLocaleString()} G) for good.`, VW / 2, y + 34, '#ffe9a8', 8);
    text('Enter: yes, replace them  ·  Esc: no, go back', VW / 2, y + 52, '#ff9a8a', 8);
  }
}

// ---------------------------------------------------------------- customization (new game, or the town Stylist)
// Name and title, who you look like (charmake.js), hair / outfit / skin colour or that character's head and colours, a weapon glow and
// an aura; Randomize rolls a whole new look.
function customMenu(cls, profile) {
  const C = CLASSES[cls], lk = profile && profile.look || {};
  const ch = lk.char || {}, out = { type: 'custom', cls, edit: !!profile, row: 0, dirT: 0, char: ch.id || null, head: ch.head || null,
    name: lk.name || (C.chef ? 'Chef Daddy' : 'Hero'), title: lk.title || '', hair: lk.hair || C.hair, outfit: lk.outfit || C.outfit,
    skin: lk.skin || 'orig', wglow: lk.wglow || 'none', aura: lk.aura || 'none', wart: lk.wart != null ? lk.wart : null };
  charBins(out).forEach((b, i) => { out['c' + i] = (ch.paint || {})[b.bin] || 'orig'; });
  // part colours (heroparts.js): saved ones, or for a look made before parts, its old hair / outfit / skin carried over
  const P = ch.parts || (ch.id || C.sheet ? {} : { hair: lk.hair || C.hair, pants: lk.outfit || C.outfit, outfit: lk.outfit || C.outfit, skin: lk.skin });   // (Chef Daddy's own sheet never took those colours)
  for (const p in HERO_PART_NAMES) out['p_' + p] = P[p] && heroPartSet(p)[P[p]] ? P[p] : 'orig';
  out.startKey = customLookKey(lookOf(out));   // (the Now figure: what you wore when the Stylist opened)
  return out;
}
// the colour rows: a hero body's parts (heroparts.js: its own and its head's), else the older rows (colours by hue for a
// villager or monster costume, hair / outfit / skin for a class with no part table)
const customBodyId = m => m.char || classBodyId(m.cls);
function customPartRows(m) { const have = new Set([...heroPartsOf(customBodyId(m)), ...heroPartsOf(m.head)]); return Object.keys(HERO_PART_NAMES).filter(p => have.has(p)).map(p => 'p_' + p); }
const customColourRows = m => { const P = customPartRows(m); return P.length ? P : m.char ? charBins(m).map((_, i) => 'c' + i) : ['hair', 'outfit', 'skin']; };
// (2026-11-20, the user: "remove head and body from character create menu") a new hero wears the class's own body and head;
// the Body and Head rows stay only at the Stylist (m.edit), so a saved hero keeps and can still change theirs
const customRows = m => ['name', 'title', ...(m.edit ? ['char', 'head'] : []), ...customColourRows(m), 'wglow', 'aura', ...(m.edit && typeof weaponLookOk === 'function' && weaponLookOk(m.cls) ? ['wart'] : []), ...(m.edit ? ['wardrobe'] : []), 'done'];   // (Wardrobe: the Stylist only, three saved looks) (hero parts creator, charmake.js: a body and a head from the full heroes, then that body's own colours; the class look keeps hair / outfit / skin)
const CUSTOM_LABEL = { wart: 'Weapon look', wardrobe: 'Wardrobe', name: 'Name', title: 'Title', char: 'Body', head: 'Head', hair: 'Hair', outfit: 'Outfit', skin: 'Skin', wglow: 'Weapon glow', aura: 'Aura' };
const CUSTOM_SETS = m => ({ ...Object.fromEntries(charBins(m).map((_, i) => ['c' + i, [STYLE_IDS, STYLE_COLORS]])), ...Object.fromEntries(Object.keys(HERO_PART_NAMES).map(p => ['p_' + p, p === 'skin' ? [Object.keys(SKIN_TONES), SKIN_TONES] : [STYLE_IDS, STYLE_COLORS]])), hair: [STYLE_IDS, STYLE_COLORS], outfit: [STYLE_IDS, STYLE_COLORS], skin: [Object.keys(SKIN_TONES), SKIN_TONES],
  wglow: [Object.keys(WEAPON_GLOWS), WEAPON_GLOWS], aura: [Object.keys(AURAS), AURAS] });
// the glint: a hidden near-white colour (not one of the swatches) shown for CUSTOM_GLINT.ms out of every .every ms
const CUSTOM_GLINT = { ms: 380, every: 1400 };
STYLE_COLORS.glint = { name: 'Glint', swatch: null, hidden: true, h: 48, s: 0.3, l: 1.5 };
// the preview: click a move label to hold it (again to let the moves cycle), click the hero or press Q / E (not while typing the name) to turn
const CUSTOM_FACES = [2, 1, 0, 3];   // front, right, back, left: the order it turns through
function customPreviewInput(m, row) {
  CUSTOM_MOVES.list.forEach((_, i) => { if (clicked(160 + (i - 1.5) * 46 - 20, 65, 40, 14)) m.move = m.move === i ? null : i; });
  const turn = k => { const cur = m.face != null ? m.face : CUSTOM_FACES[Math.floor(m.dirT / (CUSTOM_MOVES.ms * CUSTOM_MOVES.list.length)) % 4]; m.face = CUSTOM_FACES[(CUSTOM_FACES.indexOf(cur) + k + 4) % 4]; };
  if (clicked(60, 110, 200, 150)) turn(1);
  if (row !== 'name') { if (hit('KeyQ')) turn(-1); if (hit('KeyE')) turn(1); }
}
// the name dice (click the 🎲 at the end of the Name row): soft fantasy names, never the one you already have
const HERO_NAMES = ['Aria', 'Bram', 'Cael', 'Dawn', 'Elio', 'Fern', 'Gale', 'Hazel', 'Ione', 'Juniper', 'Kai', 'Lumi', 'Mira', 'Nell', 'Orin', 'Pip',
  'Quill', 'Rowan', 'Sable', 'Tamsin', 'Ulla', 'Vale', 'Wren', 'Yuki', 'Zephyr', 'Ash', 'Briar', 'Clove', 'Dusk', 'Ember', 'Finch', 'Ivy', 'Lark',
  'Moss', 'Noa', 'Opal', 'Pell', 'Rune', 'Sage', 'Teo', 'Willow', 'Hollis', 'Marlo', 'Sorrel', 'Linden', 'Poppy', 'Cobalt', 'Nimbus'];
function randomHeroName(cur) { const L = HERO_NAMES.filter(n => n !== cur); return L[Math.floor(Math.random() * L.length)]; }
const customLookKey = L => JSON.stringify({ ...L, name: 0, title: 0 });
const CUSTOM_MOVES = { ms: 1500, list: [['idle', 'Idle'], ['walk', 'Walk'], ['atk1', 'Attack'], ['cast', 'Cast']] };
const CUS = { x: 316, lx: 316, sx: 388, sw: 19, y0: 54, dy: 20, done: { x: 330, y: 294, w: 130, h: 24 }, rnd: { x: 470, y: 294, w: 110, h: 24 } };
const cusY = r => CUS.y0 + r * CUS.dy;
// WARDROBE (the Stylist): three saved looks, pr.wardrobe = [look | null] x3. On its row ←→ picks a slot; Enter or a click wears a
// saved look (name and title stay) or saves into an empty slot; V saves the current look into the chosen slot, over what is there.
const WARDROBE = { n: 3, w: 62, gap: 4 };
const wardSlot = (i, y) => ({ x: CUS.sx + i * (WARDROBE.w + WARDROBE.gap), y: y - 2, w: WARDROBE.w, h: 18 });
function wardrobeOf(game) { const pr = game.profile; if (!pr) return null; pr.wardrobe = pr.wardrobe || []; while (pr.wardrobe.length < WARDROBE.n) pr.wardrobe.push(null); return pr.wardrobe; }
function wardrobeWear(m, L) {
  for (const k of ['hair', 'outfit', 'skin', 'wglow', 'aura']) if (L[k]) m[k] = L[k];
  m.wart = L.wart != null && (typeof weaponLookMax !== 'function' || L.wart <= weaponLookMax(GAME.profile)) ? L.wart : null;
  m.char = L.char ? L.char.id : null; m.head = L.char ? L.char.head || null : null;
  const paint = (L.char && L.char.paint) || {}; for (let i = 0; i < CHAR_COLOURS; i++) m['c' + i] = 'orig';
  charBins(m).forEach((b, i) => { m['c' + i] = paint[b.bin] || 'orig'; });
}
function wardrobeInput(game, m, onRow, d) {
  const W = wardrobeOf(game); if (!W) return; m.wslot = m.wslot || 0;
  if (onRow && d) m.wslot = (m.wslot + d + WARDROBE.n) % WARDROBE.n;
  // (ppaint: the partner's colours go with the look)
  const save = i => { const P = typeof partnerOf === 'function' && partnerOf(game.profile); W[i] = JSON.parse(JSON.stringify({ ...lookOf(m), name: undefined, title: undefined, ppaint: P && !P.dead ? P.paint || {} : undefined })); game.save(); game.toast(`Look saved to wardrobe slot ${i + 1}`, '#ffe9a8'); };
  const use = i => { if (W[i]) { wardrobeWear(m, W[i]); m.ppaint = W[i].ppaint ? JSON.parse(JSON.stringify(W[i].ppaint)) : null; m.row = customRows(m).indexOf('wardrobe'); game.toast(`Wearing wardrobe look ${i + 1} · SAVE LOOK to keep it`, '#c9c1a8'); } else save(i); };
  if (onRow && hit('KeyV')) { consume('KeyV'); save(m.wslot); }
  if (onRow && hit('Enter')) { consume('Enter'); use(m.wslot); }
  const y = cusY(customRows(m).indexOf('wardrobe'));
  for (let i = 0; i < WARDROBE.n; i++) { const S = wardSlot(i, y); if (clicked(S.x, S.y, S.w, S.h)) { m.row = customRows(m).indexOf('wardrobe'); m.wslot = i; use(i); } }
}
function drawWardrobeRow(game, m, y, on) {
  const W = wardrobeOf(game) || [];
  for (let i = 0; i < WARDROBE.n; i++) {
    const S = wardSlot(i, y), L = W[i], sel = on && (m.wslot || 0) === i;
    panel(S.x, S.y, S.w, S.h, sel ? '#ffd23f' : '#5a5040', 'rgba(20,13,8,0.95)');
    if (L && L.char) { ctx.save(); ctx.imageSmoothingEnabled = false; drawCharThumb(L.char.head || L.char.id, S.x + 10, S.y + S.h - 1, 12, 15, 0.6); ctx.restore(); }
    text(L ? `Look ${i + 1}` : `${i + 1} · empty`, S.x + (L && L.char ? 36 : S.w / 2), S.y + S.h / 2, L ? '#ffffff' : '#a8a090', 7);
  }
}
function lookOf(m) {
  const parts = {}; for (const r of customPartRows(m)) if (m[r] && m[r] !== 'orig') parts[r.slice(2)] = m[r];   // (a part only this body has, or none: nothing saved)
  const id = m.char || (Object.keys(parts).length ? classBodyId(m.cls) : null);   // (coloured parts need the body drawn by the character maker: the class's own)
  return { name: m.name.trim() || 'Hero', title: m.title, hair: m.hair, outfit: m.outfit, skin: m.skin, wglow: m.wglow, aura: m.aura, wart: m.wart != null ? m.wart : null,
    char: id ? { id, head: m.head || null, paint: customPartRows(m).length ? {} : charPaintOf(m), ...(Object.keys(parts).length ? { parts } : {}) } : null };   // (a hero body is coloured by its parts: an older by-hue paint, with no row left to show it, is dropped)
}
const cusFit = m => { CUS.dy = Math.min(20, Math.floor(218 / Math.max(1, customRows(m).length - 2))); };   // (a body with many parts: the rows close up to stay above Done)
function updateCustom(game, m, dt) {
  m.dirT += dt; cusFit(m);
  const up = hit('ArrowUp'), down = hit('ArrowDown'), left = hit('ArrowLeft'), right = hit('ArrowRight');
  const Rows = customRows(m); m.row = Math.min(m.row, Rows.length - 1);
  const row = Rows[m.row], SETS = CUSTOM_SETS(m);
  const step = (field, d) => {   // ◀▶ steps through the full hero bodies (Enter opens the picker, with the costumes too)
    const L = [null, ...charList('b').map(c => c.id)], i = L.indexOf(m[field] || null);
    m[field] = L[((i < 0 ? 0 : i) + d + L.length) % L.length];
    if (field === 'head' && m.head && !m.char) m.char = classBodyId(m.cls) || m.head;
    if (!m.char) m.head = null;
    for (let k = 0; k < CHAR_COLOURS; k++) m['c' + k] = 'orig';
  };
  // the name row takes typed letters, so only arrows/Enter navigate there
  if (row === 'name') {
    for (const ch of typed) if (/^[\w \-']$/.test(ch) && m.name.length < 12) m.name += ch;
    if (hit('Backspace')) m.name = m.name.slice(0, -1);
  } else {
    if (hit('KeyW')) m.row = Math.max(0, m.row - 1);
    if (hit('KeyS')) m.row = Math.min(Rows.length - 1, m.row + 1);
  }
  if (up) m.row = Math.max(0, m.row - 1);
  if (down || (row === 'name' && hit('Enter', 'Tab'))) { m.row = Math.min(Rows.length - 1, m.row + 1); consume('Enter'); }
  const d = left || (row !== 'name' && hit('KeyA')) ? -1 : right || (row !== 'name' && hit('KeyD')) ? 1 : 0;
  if (d && row === 'title') m.title = TITLES[(TITLES.indexOf(m.title) + d + TITLES.length) % TITLES.length];
  if (d && (row === 'char' || row === 'head')) step(row, d);
  if (d && row === 'wart') weaponLookStep(game, m, d);
  if ((row === 'char' || row === 'head') && hit('Enter')) { consume('Enter'); game.menu = charPick(m, row); return; }
  if (d && SETS[row]) { const ids = SETS[row][0], i = ids.indexOf(m[row]); m[row] = ids[(i + d + ids.length) % ids.length]; }
  // mouse: rows, swatches, title arrows and buttons
  Rows.slice(0, -1).forEach((key, r) => {
    const y = cusY(r);
    if (key === 'char' || key === 'head') { if (clicked(CUS.sx, y - 2, 18, 20)) { m.row = r; step(key, -1); } else if (clicked(CUS.sx + 182, y - 2, 18, 20)) { m.row = r; step(key, 1); } else if (clicked(CUS.sx, y - 2, 200, 20)) { game.menu = charPick(m, key); return; } }
    if (clicked(CUS.lx, y - 4, 70, 22)) m.row = r;
    if (key === 'name' && clicked(CUS.sx + 204, y - 2, 20, 20)) { m.row = r; m.name = randomHeroName(m.name); }   // the dice: a name to start from
    else if (key === 'name' && clicked(CUS.sx, y - 2, 200, 20)) m.row = r;
    if (key === 'title') { if (clicked(CUS.sx, y - 2, 18, 20)) { m.row = r; m.title = TITLES[(TITLES.indexOf(m.title) + TITLES.length - 1) % TITLES.length]; }
      if (clicked(CUS.sx + 182, y - 2, 18, 20)) { m.row = r; m.title = TITLES[(TITLES.indexOf(m.title) + 1) % TITLES.length]; } }
    if (SETS[key]) SETS[key][0].forEach((id, i) => { if (clicked(CUS.sx + i * CUS.sw, y - 1, CUS.sw - 3, 18)) { m[key] = id; m.row = r; } });
  });
  if (hit('KeyR') && row !== 'name' || clicked(CUS.rnd.x, CUS.rnd.y, CUS.rnd.w, CUS.rnd.h)) {   // a whole new look at random
    const ids = charList('b').map(c => c.id);   // a body and head from the full heroes (or the class look), then colours for that body
    m.char = !m.edit || Math.random() < 0.25 ? null : pick(ids); m.head = m.char && Math.random() < 0.5 ? pick(ids) : null;   // (a new hero: the class's own body and head)
    const S2 = CUSTOM_SETS(m); for (const k in S2) m[k] = pick(S2[k][0]);
    m.title = pick(TITLES);
  }
  customPreviewInput(m, row);
  if (m.edit) wardrobeInput(game, m, row === 'wardrobe', d);
  if (game.menu !== m) return;
  const go = (row === 'done' && hit('Enter', 'KeyJ', 'KeyF', 'Space')) || clicked(CUS.done.x, CUS.done.y, CUS.done.w, CUS.done.h);
  if (hit('Escape')) { game.menu = m.edit ? null : { type: 'class', cur: m.cls, sure: true }; return; }
  if (go) customDone(game, m);
}
function customDone(game, m) {
  const look = lookOf(m);
  if (m.edit) { game.profile.look = look; game.save(); game.closeMenu(); game.refreshPlayer(); game.toast('Looking sharp!', '#ffe9a8'); return; }
  if (!m.partner) { game.menu = partnerWarn(m); return; }   // the hero is made: the warning, then who stands beside them (heropartner.js)
  // the secret hero: an Assassin named OmegaKingX becomes OmegaKingX, in his own body and colours (the name, title and glow stay)
  const sec = typeof secretHero === 'function' ? secretHero(m.cls, look.name) : -1;
  if (sec >= 0) { m.cls = sec; Object.assign(look, { char: null, hair: CLASSES[sec].hair, outfit: CLASSES[sec].outfit, skin: 'orig' }); }
  game.profile = newProfile(m.cls); game.profile.look = look; game.profile.partner = partnerNew(m.partner); game.save(); game.closeMenu();
  // a new hero gets a new world: the Wilds are generated at load, so reload once and carry on straight into the hub
  if (game.profile.worldSeed !== WORLD_SEED) { try { sessionStorage.setItem('zch_autostart', '1'); if (sec >= 0) sessionStorage.setItem('zch_secret', '1'); } catch (e) {} location.reload(); return; }
  game.goHub();
  if (sec >= 0) game.toast('A hidden hero answers: OmegaKingX!', '#ffd23f');
}
function drawCustom(game, m, now) {
  ctx.fillStyle = 'rgba(14,9,6,0.86)'; ctx.fillRect(0, 0, VW, VH); cusFit(m);
  const C = CLASSES[m.cls], SETS = CUSTOM_SETS(m);
  text(m.edit ? 'STYLIST' : 'CREATE YOUR HERO', VW / 2, 30, '#ffd23f', 16);
  // preview: turns through the four facings
  panel(30, 56, 260, 270, '#c9a85a');
  const look = lookOf(m);
  // it shows off its moves (idle, walk, attack, cast), then turns to the next facing
  const MV = CUSTOM_MOVES, mi = m.move != null ? m.move : Math.floor(m.dirT / MV.ms) % MV.list.length, dir = m.face != null ? m.face : [2, 1, 0, 3][Math.floor(m.dirT / (MV.ms * MV.list.length)) % 4];   // (a picked move or facing holds: customPreviewInput)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(160, 236, 38, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(32, 80, 256, 188); ctx.clip();   // (a lunge or a tall body stays inside the frame, clear of the name)
  { const key = customRows(m)[m.row], bin = /^c\d$/.test(key) && charBins(m)[+key[1]];   // on a Colour row: what it paints glints softly now and then
    const on = (now % CUSTOM_GLINT.every) < CUSTOM_GLINT.ms;
    if (on && bin && look.char) look.char = { ...look.char, paint: { ...look.char.paint, [bin.bin]: 'glint' } };
    if (on && !look.char && (key === 'hair' || key === 'outfit')) look[key] = 'glint';
    if (on && /^p_/.test(key)) { const ch = look.char || { id: customBodyId(m), head: m.head || null, paint: {} }; if (ch.id) look.char = { ...ch, parts: { ...(ch.parts || {}), [key.slice(2)]: 'glint' } }; } }
  drawPlayerPreview(m.cls, look, customWlook(game, m), MV.list[mi][0], dir, 160, 236, 5, now); ctx.restore();
  { // NOW (the Stylist): once you change anything, the look you wear today stands small in the corner to compare with
    const cur = customLookKey(lookOf(m));
    if (m.edit && cur !== m.startKey && game.profile && game.profile.look) {
      panel(226, 84, 56, 70, '#5a5040', 'rgba(20,13,8,0.9)');
      ctx.save(); ctx.beginPath(); ctx.rect(227, 85, 54, 68); ctx.clip(); drawPlayerPreview(m.cls, game.profile.look, customWlook(game, { ...m, wart: game.profile.look.wart }), 'idle', dir, 254, 136, 1.8, now); ctx.restore();
      text('Now', 254, 147, '#c9c1a8', 7);
    }
  }
  MV.list.forEach(([, label], i) => { const on = i === mi, held = m.move === i, x = 160 + (i - 1.5) * 46;
    if (held) { ctx.fillStyle = 'rgba(255,210,63,0.14)'; rrect(ctx, x - 20, 65, 40, 14, 3); ctx.fill(); }
    text(label, x, 72, on ? '#ffd23f' : '#b8ae96', 7); });
  text(m.move != null || m.face != null ? 'click the move again to let it play on · Q / E or click: turn' : 'click a move to hold it · Q / E or click the hero: turn', 160, 270, '#b8ae96', 7);
  text(m.name || ' ', 160, 284, '#fff', 13);
  if (m.title) text(m.title, 160, 298, '#e8be64', 9);
  text(className(m.cls), 160, 312, '#c9c1a8', 8);
  // options: a label column, then the control
  const rowCol = r => (m.row === r ? '#ffd23f' : '#e8e2cf');
  customRows(m).slice(0, -1).forEach((key, r) => {
    const y = cusY(r), on = m.row === r;
    if (on) { ctx.fillStyle = 'rgba(255,210,63,0.08)'; rrect(ctx, CUS.lx - 6, y - 4, VW - CUS.lx - 4, Math.min(22, CUS.dy + 2), 4); ctx.fill(); }
    text(CUSTOM_LABEL[key] || `Colour ${+key[1] + 1}`, CUS.lx, y + 7, rowCol(r), 9, 'left');
    if (!CUSTOM_LABEL[key]) { ctx.fillStyle = charBins(m)[+key[1]].col; rrect(ctx, CUS.sx - 14, y + 2, 10, 10, 2); ctx.fill(); }   // the colour this row changes
    if (key === 'name') {
      panel(CUS.sx, y - 2, 200, 20, on ? '#ffd23f' : '#5a5040', 'rgba(20,13,8,0.95)');
      text(m.name + (on && Math.floor(now / 450) % 2 ? '|' : ''), CUS.sx + 8, y + 8, '#fff', 10, 'left');
      panel(CUS.sx + 204, y - 2, 20, 20, '#8a6ad0', 'rgba(50,33,21,0.92)'); text('🎲', CUS.sx + 214, y + 8, '#d8c8ff', 9);
    } else if (key === 'char' || key === 'head') {
      panel(CUS.sx, y - 2, 200, 20, on ? '#ffd23f' : '#5a5040', 'rgba(20,13,8,0.95)');
      text('◀', CUS.sx + 9, y + 8, '#ffd23f', 8); text('▶', CUS.sx + 191, y + 8, '#ffd23f', 8);
      text(m[key] ? charName(m[key]) : key === 'head' ? '(own head)' : '(class look)', CUS.sx + 100, y + 8, m[key] ? '#ffffff' : '#7a7468', 9);
      if (m[key] && m[key][0] !== 'h') text('costume', CUS.sx + 204, y + 8, '#c8b8ff', 7, 'left');
      if (m[key]) { ctx.save(); ctx.imageSmoothingEnabled = false; drawCharThumb(m[key], CUS.sx + 30, y + 16, 14, 17, 0.7); ctx.restore(); }   // (a tiny picture of who it is)
    } else if (key === 'wart') { drawWeaponLookRow(game, m, y, on);
    } else if (key === 'wardrobe') { drawWardrobeRow(game, m, y, on);
    } else if (key === 'title') {
      panel(CUS.sx, y - 2, 200, 20, on ? '#ffd23f' : '#5a5040', 'rgba(20,13,8,0.95)');
      text('◀', CUS.sx + 9, y + 8, '#ffd23f', 8); text('▶', CUS.sx + 191, y + 8, '#ffd23f', 8);
      text(m.title || '(no title)', CUS.sx + 100, y + 8, m.title ? '#e8be64' : '#7a7468', 9);
    } else {
      const [ids, T2] = SETS[key];
      ids.forEach((id, i) => {
        const sx = CUS.sx + i * CUS.sw, S = T2[id], sel = (m[key] || 'orig') === id;
        const sh = Math.min(18, CUS.dy - 3);   // (shorter swatches when the rows close up)
        ctx.fillStyle = S.swatch || '#261910'; rrect(ctx, sx, y - 1, CUS.sw - 3, sh, 3); ctx.fill();
        if (!S.swatch) text(key === 'hair' || key === 'outfit' || key === 'skin' || /^p_/.test(key) || !CUSTOM_LABEL[key] ? '◇' : '—', sx + (CUS.sw - 3) / 2, y - 1 + sh / 2, '#c9c1a8', 8);
        if (key === 'aura' && S.swatch) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(sx + 5, y + 4, 2, 2); ctx.fillRect(sx + 11, y + 9, 2, 2); }
        if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; rrect(ctx, sx - 1.5, y - 2.5, CUS.sw, sh + 3, 4); ctx.stroke(); ctx.lineWidth = 1; }
      });
      text(T2[m[key] || 'orig'].name, CUS.sx + ids.length * CUS.sw + 4, y + 8, '#c9c1a8', 7.5, 'left');
    }
  });
  const D = CUS.done, R = CUS.rnd, onD = customRows(m)[m.row] === 'done';
  panel(D.x, D.y, D.w, D.h, onD ? '#ffd23f' : '#5a5040', onD ? 'rgba(70,55,20,0.95)' : 'rgba(30,20,13,0.92)');
  text(m.edit ? 'SAVE LOOK' : 'START ADVENTURE', D.x + D.w / 2, D.y + D.h / 2, onD ? '#ffd23f' : '#e8e2cf', 9);
  panel(R.x, R.y, R.w, R.h, '#8a6ad0', 'rgba(50,33,21,0.92)');
  text('🎲 RANDOMIZE (R)', R.x + R.w / 2, R.y + R.h / 2, '#d8c8ff', 8);
  text(customRows(m)[m.row] === 'wardrobe' ? '←→ choose a slot · Enter or click: wear that look, or save into an empty slot · V: save over this slot · Esc back'
    : m.edit ? '↑↓ choose row · ←→ change · Enter on Body or Head: pick a hero · type your name · R randomize · Esc back' : '↑↓ choose row · ←→ change · type your name · R randomize · Esc back', VW / 2, 340, '#c9c1a8', 8);
}

// art for skill cards that have no monster (Chef Daddy's kitchen): a 32x32 pixel icon from assets/chef_icons.png,
// scaled up crisp on a soft spotlight; Gourmet Meal also wears its five stars
const CHEF_ICONS = 'assets/chef_icons.png';
// Arcana card art: a soft glow in the element's colour, a faint rune circle, and the spell's effect at its peak
function arcanaArt(sp, x, y, w, h) {
  const S = SPECIES[sp], s = Math.min(w, h) * 1.05, cx = x + w / 2, cy = y + h / 2, col = ELEMENTS[S.spell.el].col;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, s * 0.6); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col + '66'; ctx.lineWidth = Math.max(0.5, s * 0.015); ctx.beginPath(); ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2); ctx.stroke();
  if (S.spell.sheet) { const im = img(KIB.sheet), q = s * 1.2; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, 0, KIB.cellH, KIB.cell, KIB.cellH, cx - q / 2, cy - q * KIB.cellH / KIB.cell / 2, q, q * KIB.cellH / KIB.cell); ctx.restore(); return; }   // the swirling sphere itself
  const key = S.spell.art || S.spell.vfx, M = window.SPELL_FX[key] || {};
  if (M.atlas) drawSpellFxFrame(key, M.peak, cx, cy, s * 0.95 / (Math.max(M.w, M.h) * M.k), true);   // Spellcraft art fills the card
  else drawSpellFxFrame(key, M.peak || 0, cx, cy, s / 64);
  ctx.restore();
}
function skillArt(sp, x, y, w, h) {
  const S = SPECIES[sp], im = img(CHEF_ICONS), s = Math.min(w, h) * 0.9, cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, s * 0.6); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.6, 0, Math.PI * 2); ctx.fill();
  if (im && im.complete) { ctx.imageSmoothingEnabled = false; ctx.drawImage(im, S.ico * 32, 0, 32, 32, cx - s / 2, cy - s / 2, s, s); }
  if (S.gourmet) { ctx.font = `700 ${Math.max(4, s * 0.18)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#452e1d'; ctx.lineWidth = Math.max(0.6, s * 0.04); ctx.strokeText('★★★★★', cx, y + h - s * 0.04); ctx.fillText('★★★★★', cx, y + h - s * 0.04); }
  ctx.restore();
}
