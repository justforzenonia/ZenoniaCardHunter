'use strict';
// RPG HUD: a unit frame (portrait, slanted HP/MP bars, EXP line, status icons) and a centred action bar
// (Q/E/R skill slots, the LAYER emblem, the fusion card and dash).

function goldFrameGrad(y, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#fff0b0'); g.addColorStop(0.35, '#e0a63a'); g.addColorStop(0.65, '#a8661c'); g.addColorStop(1, '#ffd77a');
  return g;
}
function silverGrad(y, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#b8bcc8'); g.addColorStop(0.65, '#5a5e6a'); g.addColorStop(1, '#d8dce8');
  return g;
}
// Zenonia 2's round action key as a button base (lit version while active)
function bevelBox(x, y, w, h, r = 3, fill = '#1a1220') {
  ctx.fillStyle = goldFrameGrad(y, h); rrect(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 0.8; rrect(ctx, x + 0.4, y + 0.4, w - 0.8, h - 0.8, r); ctx.stroke();
  ctx.fillStyle = fill; rrect(ctx, x + 1.6, y + 1.6, w - 3.2, h - 3.2, Math.max(1, r - 1)); ctx.fill();
}
// Bar with gloss, segment ticks, trailing "damage" bar and value text
function fancyBar(x, y, w, h, v, trail, cols, label, valueStr) {
  bevelBox(x, y, w, h, h / 2);
  const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
  ctx.save(); rrect(ctx, ix, iy, iw, ih, ih / 2); ctx.clip();
  ctx.fillStyle = '#120a12'; ctx.fillRect(ix, iy, iw, ih);
  if (trail > v) { ctx.fillStyle = 'rgba(255,240,220,0.75)'; ctx.fillRect(ix, iy, iw * Math.min(1, trail), ih); }
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fillRect(ix, iy, iw * Math.max(0, Math.min(1, v)), ih);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(ix, iy + 0.5, iw * Math.max(0, Math.min(1, v)), ih * 0.32);   // gloss
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let k = 1; k < 10; k++) ctx.fillRect(ix + iw * k / 10, iy + ih * 0.55, 0.6, ih * 0.45);                     // ticks
  ctx.restore();
  if (label) text(label, x - 1, y + h / 2, cols[1], Math.min(8, h + 1), 'right');
  if (valueStr) text(valueStr, x + w / 2, y + h / 2 + 0.3, '#ffffff', Math.max(6, h - 1.5));
}

// Portrait: the hero's own sprite, framed in a gold medallion, with a level badge

// ---------------------------------------------------------------- unit frame (top corner)
// slanted bar: dark inset trough, fill gradient, damage trail, glossy top, value text
function slantPath(x, y, w, h, k) { ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - k, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
function slantBar(x, y, w, h, v, trail, cols, str, flip) {
  const TA = trail && trail.a != null ? trail.a : 1; if (trail && trail.v != null) trail = trail.v;   // (trail may be an hpGhost)
  const k = h * 0.7;
  ctx.save();
  if (flip) { ctx.translate(x * 2 + w, 0); ctx.scale(-1, 1); }
  slantPath(x - 1.2, y - 1.2, w + 2.4, h + 2.4, k); ctx.fillStyle = '#05030a'; ctx.fill();
  slantPath(x - 1.2, y - 1.2, w + 2.4, h + 2.4, k); ctx.strokeStyle = 'rgba(224,170,80,0.85)'; ctx.lineWidth = 0.7; ctx.stroke();
  slantPath(x, y, w, h, k); ctx.clip();
  const tg = ctx.createLinearGradient(0, y, 0, y + h); tg.addColorStop(0, '#0c0810'); tg.addColorStop(1, '#22182a');
  ctx.fillStyle = tg; ctx.fillRect(x, y, w, h);
  const vv = Math.max(0, Math.min(1, v));
  if (trail > vv && TA > 0) { ctx.fillStyle = `rgba(${HP_GHOST.col},${0.9 * TA})`; ctx.fillRect(x, y, w * Math.min(1, trail), h); }   // the yellow chunk a hit leaves
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, cols[0]); g.addColorStop(0.45, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w * vv, h);
  ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(x, y, w * vv, h * 0.34);
  if (vv > 0 && vv < 1) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x + w * vv - 1, y, 1, h); }   // bright leading edge
  ctx.restore();
  if (str) text(str, flip ? x + 6 : x + w - 6, y + h / 2 + 0.4, '#ffffff', Math.max(5.5, h - 1.6), flip ? 'left' : 'right');
}
// small square status icon with a timer underneath
// ---- buffs and debuffs float over the hero's head (world.js calls drawHeadIcons), not in the HUD: a small row of
// glowing tiles, buffs edged in their colour, debuffs in red, each with the seconds it has left underneath
function heroBuffIcons(a) {
  const out = [], P = window.GAME && GAME.profile, sec = ms => ms / 1000, st = a.status || {};
  if (a.transcend > 0) out.push([layerPal(a).icon, layerPal(a).mote, sec(a.transcend)]);
  if (a.buffAtk > 0) out.push(['⚔', '#8fffd0', sec(a.buffAtk)]);
  if (a.heatT > 0) out.push(['🔥', '#ff8a3a', sec(a.heatT)]);
  if (a.sharpT > 0) out.push(['✦', '#fff36b', sec(a.sharpT)]);
  if (a.smokeT > 0) out.push(['☁', '#d8e8e0', sec(a.smokeT)]);
  if (a.spellHasteT > 0) out.push(['»', '#9fd8ff', sec(a.spellHasteT)]);
  if (a.wellFed > 0) out.push(['★', '#ffd23f', sec(a.wellFed)]);
  if (P && a === (GAME.world && GAME.world.player)) {
    if (P.meal && a.mealMs > 0) out.push([itemIcon(P.meal.id), '#ffcf7a', sec(a.mealMs)]);
    if (P.snack && a.snackMs > 0) out.push([itemIcon(P.snack.id), '#c8f0a0', sec(a.snackMs)]);
  }
  // debuffs
  const bad = (g, t) => out.push([g, '#ff6a5a', t, true]);
  if (a.exhausted > 0) bad('☠', sec(a.exhausted));
  if (st.burn) bad('♨', typeof st.burn === 'number' ? sec(st.burn) : st.burn.t > 0 && st.burn.t < 1e6 ? sec(st.burn.t) : null);   // (burn is { t, dps }: it now shows its seconds like poison)
  if (st.poison) bad('☣', st.poison.t > 0 && st.poison.t < 1e6 ? sec(st.poison.t) : null);
  if (st.freeze) bad('❄', typeof st.freeze === 'number' ? sec(st.freeze) : null);
  if (st.slow) bad('↓', typeof st.slow === 'number' ? sec(st.slow) : null);
  if (st.shock) bad('ϟ', typeof st.shock === 'number' ? sec(st.shock) : null);
  if (st.crack) bad('✕', typeof st.crack === 'number' ? sec(st.crack) : null);
  return out;
}
// one tile at a time: it cycles to the next buff / debuff every HEAD_CYCLE ms (with a quick fade between), and
// small dots under it show how many there are and which one is up
const HEAD_CYCLE = 1500;
function drawHeadIcons(a, y, now) {
  const icons = heroBuffIcons(a); if (!icons.length) return;
  const n = icons.length, k = Math.floor(now / HEAD_CYCLE) % n, ph = (now % HEAD_CYCLE) / HEAD_CYCLE;
  const [g, col, secs, debuff] = icons[k], S = 9, x = Math.round(a.x - S / 2), y0 = Math.round(y - (a.h || 28) * (a.scale || 1) - 13);
  const fade = n > 1 ? Math.min(1, ph / 0.12, (1 - ph) / 0.12) : 1, low = secs != null && secs < 3, blink = low && Math.sin(now / 90) < 0;
  ctx.save(); ctx.globalAlpha = fade * (blink ? 0.45 : 1);
  ctx.shadowColor = col; ctx.shadowBlur = 2.5 * RES;
  ctx.fillStyle = debuff ? '#2a0a0e' : '#120a1a'; rrect(ctx, x, y0, S, S, 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = col; ctx.lineWidth = 0.7; rrect(ctx, x + 0.35, y0 + 0.35, S - 0.7, S - 0.7, 2); ctx.stroke();
  if (typeof g === 'number') iconCentered('items', g, x + S / 2, y0 + S / 2, S - 1);
  else text(g, x + S / 2, y0 + S / 2 + 0.3, debuff ? '#ffb0a0' : col, 6);
  if (secs != null) text(String(Math.ceil(secs)), x + S + 1, y0 + S / 2 + 0.3, '#ffffff', 4, 'left');
  ctx.restore();
  if (n > 1) for (let i = 0; i < n; i++) {   // which one of how many
    ctx.fillStyle = i === k ? '#ffffff' : 'rgba(255,255,255,0.35)';
    ctx.fillRect(Math.round(a.x - (n * 3 - 1) / 2 + i * 3), y0 + S + 1.5, 2, 1);
  }
}
function statusIcon(x, y, glyph, col, secs, now) {
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 3 * RES;
  ctx.fillStyle = '#120a1a'; rrect(ctx, x, y, 11, 11, 2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = col; ctx.lineWidth = 0.9; rrect(ctx, x + 0.5, y + 0.5, 10, 10, 2); ctx.stroke();
  if (typeof glyph === 'number') iconCentered('items', glyph, x + 5.5, y + 5.5, 10);   // an item icon (the meal you ate)
  else text(glyph, x + 5.5, y + 5.8, col, 7.5);
  if (secs != null) text(String(Math.ceil(secs)), x + 5.5, y + 15, '#ffffff', 5.5);
}

// Unit frame: no portrait. A gold hex level emblem, then an angled dark plate with gold trim carrying the name,
// a long slanted HP bar (damage trail), MP bar and EXP line; status icons and coins hang underneath.
function levelEmblem(cx, cy, lv, now, hpLow) {
  const R = 13, hex = r => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; i ? ctx.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r) : ctx.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r); } ctx.closePath(); };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4 * RES; ctx.shadowOffsetY = 1.5 * RES;
  ctx.fillStyle = goldFrameGrad(cy - R, R * 2); hex(R); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#3a1e04'; ctx.lineWidth = 0.9; hex(R); ctx.stroke();
  const g = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, R);
  g.addColorStop(0, hpLow ? '#7a1a1a' : '#3a2a6a'); g.addColorStop(1, '#0e0820');
  ctx.fillStyle = g; hex(R - 2.4); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.45)'; ctx.lineWidth = 0.6; hex(R - 3.6); ctx.stroke();
  text('LV', cx, cy - 5, '#e8c878', 5);
  text(String(lv || 1), cx, cy + 2.5, '#ffffff', 10);
  if (hpLow) { ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 120); ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 1.6; hex(R + 1.5); ctx.stroke(); ctx.restore(); }
}
// ---------------------------------------------------------------- unit frame helpers
D.uiImgs = ['assets/ui_hud2.png', 'assets/ui_pad2.png', 'assets/ui_actionkey.png', 'assets/ui_actionkey_on.png', 'assets/ui_skillbtn.png', 'assets/ui_status.png', 'assets/ui_status_warm.png', 'assets/ui_crown.png', 'assets/chef_icons.png', 'assets/chef_body.png', 'assets/chef_pan.png'];
const imgReady = src => { const i = img(src); return i && i.complete && i.naturalWidth ? i : null; };
function quickPotion(pr) {
  if (!pr || typeof goodsList !== 'function') return null;
  return goodsList(pr).find(e => GOODS_USE[e.it.sub] && (GOODS_USE[e.it.sub].hp || GOODS_USE[e.it.sub].mp)) || null;
}
// Unit frame (top corner): the hero's portrait in a gold medallion with the level badge, beside a dark glass plate
// edged in gold that carries the name, a long capsule HP bar (damage trail, shield line), the MP bar and an EXP
// line along its foot. Coins, unspent stat points and status icons sit in one row of chips (items have their own belt)
// beneath it. Side 1 (the arena's right player) is the mirror image. In the Wilds the area name is a ribbon at
// the top centre instead of being squeezed into the frame.
const UF = { px: 8, py: 7, pw: 172, ph: 44 };
function capsuleBar(x, y, w, h, v, trail, cols, now, flip, heal) {
  const TA = trail && trail.a != null ? trail.a : 1; if (trail && trail.v != null) trail = trail.v;   // (trail may be an hpGhost)
  v = Math.max(0, Math.min(1, v)); trail = Math.max(v, Math.min(1, trail || 0));
  const r = h / 2, fx = (k, ww) => flip ? x + w - k - ww : x + k;
  ctx.save();
  ctx.fillStyle = '#04030a'; rrect(ctx, x - 1, y - 1, w + 2, h + 2, r + 1); ctx.fill();
  rrect(ctx, x, y, w, h, r); ctx.clip();
  const tg = ctx.createLinearGradient(0, y, 0, y + h); tg.addColorStop(0, '#120c08'); tg.addColorStop(1, '#302014');
  ctx.fillStyle = tg; ctx.fillRect(x, y, w, h);
  if (trail > v && TA > 0) { ctx.fillStyle = `rgba(${HP_GHOST.col},${0.92 * TA})`; ctx.fillRect(fx(w * v, w * (trail - v)), y, w * (trail - v), h); }   // the yellow chunk a hit leaves
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fillRect(fx(0, w * v), y, w * v, h);
  ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fillRect(fx(0, w * v), y + 0.6, w * v, Math.max(0.8, h * 0.28));   // gloss
  if (heal && heal.glow > 0 && v > heal.from) {   // a heal: the stretch just regained brightens, and a mint shine sweeps across it
    const hw = w * (v - heal.from), hx = w * heal.from, sw = Math.min(10, hw), p = hx + (hw - sw) * Math.min(1, (1 - heal.glow) / 0.6);
    ctx.fillStyle = `rgba(255,255,255,${0.3 * heal.glow})`; ctx.fillRect(fx(hx, hw), y, hw, h);
    const sg = ctx.createLinearGradient(fx(p, 0), 0, fx(p + sw, 0), 0); sg.addColorStop(0, 'rgba(190,255,215,0)'); sg.addColorStop(0.7, `rgba(190,255,215,${0.9 * heal.glow})`); sg.addColorStop(1, `rgba(255,255,255,${heal.glow})`);
    ctx.fillStyle = sg; ctx.fillRect(fx(p, sw), y, sw, h);
  }
  if (v > 0) {   // a light sweep running along the fill
    const k = ((now / 2600) % 1) * (w + 40) - 20, sx = flip ? x + w - k : x + k;
    const sg = ctx.createLinearGradient(sx - 12, 0, sx + 12, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.3)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.beginPath(); ctx.rect(fx(0, w * v), y, w * v, h); ctx.clip(); ctx.fillStyle = sg; ctx.fillRect(sx - 12, y, 24, h); ctx.restore();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let k = 1; k < 10; k++) ctx.fillRect(x + w * k / 10, y + h * 0.55, 0.6, h * 0.45);   // 10% ticks
  if (v > 0 && v < 1) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(fx(w * v - 1, 1), y, 1, h); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(232,196,120,0.55)'; ctx.lineWidth = 0.6; rrect(ctx, x - 0.6, y - 0.6, w + 1.2, h + 1.2, r + 0.6); ctx.stroke();
}
// a small rounded chip under the frame; returns its width
function hudChip(x, y, w, border, fill = 'rgba(56,36,22,0.92)') {   // (warm cocoa, 2026-11-06: it was navy)
  ctx.fillStyle = fill; rrect(ctx, x, y, w, 12, 6); ctx.fill();
  ctx.strokeStyle = border; ctx.lineWidth = 0.7; rrect(ctx, x + 0.35, y + 0.35, w - 0.7, 11.3, 6); ctx.stroke();
  return w;
}
// the area name as a ribbon at the top centre (adventure only)
function drawAreaRibbon(name, now) {
  if (!name) return;
  const w = Math.min(260, textW(name, 7.5) + 34), x = VW / 2 - w / 2, y = 4;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3 * RES; ctx.shadowOffsetY = 1 * RES;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(26,17,11,0)'); g.addColorStop(0.15, 'rgba(26,17,11,0.88)'); g.addColorStop(0.85, 'rgba(26,17,11,0.88)'); g.addColorStop(1, 'rgba(26,17,11,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, 14); ctx.restore();
  const lg = ctx.createLinearGradient(x, 0, x + w, 0);
  lg.addColorStop(0, 'rgba(232,190,100,0)'); lg.addColorStop(0.5, 'rgba(232,190,100,0.9)'); lg.addColorStop(1, 'rgba(232,190,100,0)');
  ctx.fillStyle = lg; ctx.fillRect(x, y, w, 0.8); ctx.fillRect(x, y + 13.2, w, 0.8);
  for (const s of [-1, 1]) { const dx = VW / 2 + s * (w / 2 - 14); ctx.fillStyle = '#e8be64'; ctx.save(); ctx.translate(dx, y + 7); ctx.rotate(Math.PI / 4); ctx.fillRect(-1.6, -1.6, 3.2, 3.2); ctx.restore(); }
  text(name, VW / 2, y + 7.4, '#f4ecd8', 7.5);
}
// EXP FILLS UP: the hero's EXP line slides up to its new length over a moment, and the part just earned glints white
// before turning gold (a level up just snaps: it has its own fanfare). Kept outside the profile so it is never saved.
const EXPFX = { k: null, lv: 0, from: 0, at: 0, t: 0 };
function expFx(pr, k, now) {
  const E = EXPFX, dt = Math.min(80, now - (E.t || now)); E.t = now;
  if (E.k == null || pr.lv !== E.lv || k < E.k - 0.0005) { E.k = k; E.lv = pr.lv; E.from = k; E.to = k; E.at = 0; return { k, from: k, glint: 0 }; }
  if (k > E.to + 0.0005) { if (!(now - E.at < 500)) E.from = E.k; E.at = now; E.to = k; }   // (new EXP since the last look)
  E.k += (k - E.k) * Math.min(1, dt / 120); if (k - E.k < 0.002) E.k = k;
  return { k: E.k, from: E.from, glint: E.at ? Math.max(0, 1 - (now - E.at) / 500) : 0 };
}
// GOLD COUNTS UP: after a gain the gold chip counts up to the new total over about 0.4 s and glows warm white for a moment;
// spending (or a new hero) just snaps. Kept outside the profile so nothing is saved.
const GOLDFX = { v: null, at: 0, t: 0 }, COINFX = { v: null, at: 0, t: 0 }, EATFX = { v: null, at: 0, t: 0 };   // (coins count up the same way)
function goldFx(gold, now, G = GOLDFX) {
  const dt = Math.min(80, now - (G.t || now)); G.t = now;
  if (G.v == null || gold < G.v) { G.v = gold; G.to = gold; return { v: Math.floor(gold), glow: 0 }; }   // (a drop snaps, and the next gain glows from there)
  if (gold > G.to) G.at = now; G.to = gold;
  if (G.v < gold) G.v = Math.min(gold, G.v + Math.max(1, (gold - G.v) * Math.min(1, dt / 90)));
  return { v: Math.floor(G.v), glow: G.at ? Math.max(0, 1 - (now - G.at) / 600) : 0 };
}
function drawHUD(a, side, now, label) {
  const flip = side === 1, X = (x, w = 0) => flip ? VW - x - w : x, al = flip ? 'right' : 'left';
  a.hpTrail = a.hpTrail == null ? a.hp : Math.max(a.hp, a.hpTrail - a.maxHp * 0.0045);
  const hpLow = a.hp / a.maxHp < 0.3;
  if (hpLow && side === 0) {   // low HP: the screen edges throb red
    const k = 0.5 + 0.5 * Math.sin(now / 160);
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VW * 0.62);
    vg.addColorStop(0, 'rgba(160,0,0,0)'); vg.addColorStop(1, `rgba(170,0,0,${0.25 + 0.2 * k})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }
  const world = window.GAME && GAME.profile && GAME.scene === 'world' && side === 0;
  const pr = world ? GAME.profile : null;
  // ---- the plate: Mana Soul's navy panel with its gold scrollwork (a red wash when HP is low)
  const { px, py, pw, ph } = UF;
  hudNine('assets/hud_panel_warm.png', X(px - 4, pw + 8), py - 5, pw + 8, ph + 8, 0.5);
  if (hpLow) { ctx.fillStyle = `rgba(220,30,30,${0.1 + 0.08 * Math.sin(now / 160)})`; ctx.fillRect(X(px + 2, pw - 4), py, pw - 4, ph - 3); }
  // ---- name line: the hero's name, then the class in gold
  const nx = X(px + 8), name = `Lv ${a.lv || 1}  ` + (world ? ((pr.look && pr.look.name) || 'Hero') + (pr.look && pr.look.title ? ' ' + pr.look.title : '') : label), cls = world ? className(pr.cls) : '';
  ctx.save(); ctx.beginPath(); ctx.rect(X(px + 6, pw - 12), py + 1, pw - 12, 11); ctx.clip();
  text(name, nx, py + 7, '#fff4e0', 7.5, al);
  if (cls) text(cls.toUpperCase(), nx + (flip ? -1 : 1) * (textW(name, 7.5) + 6), py + 7.3, '#e8be64', 5.5, al);
  const belt = world && typeof dojoBeltOf === 'function' ? dojoBeltOf(pr) : null;   // your dojo belt (dojolesson.js), after the class
  if (belt && cls) { const off = textW(name, 7.5) + 6 + textW(cls.toUpperCase(), 5.5) + 5; drawBeltChip(belt, flip ? nx - off - 12 : nx + off, py + 7, 0.8); }
  ctx.restore();
  // ---- bars
  const bx = px + 12, bw = pw - 24;
  const hpCols = hpLow ? [`hsl(0,100%,${70 + 10 * Math.sin(now / 120)}%)`, '#e8201a', '#6a0808'] : ['#ff9a7a', '#e2362a', '#7a1010'];
  if (a.hudHpSeen != null && a.hp - a.hudHpSeen >= a.maxHp * 0.02) { if (!(now - (a.healAt || 0) < 600)) a.healFrom = a.hudHpSeen / a.maxHp; a.healAt = now; }   // (a real heal, not a regen tick)
  a.hudHpSeen = a.hp;
  capsuleBar(X(bx + 3, bw - 6), py + 13, bw - 6, 9, a.hp / a.maxHp, hpGhost(a, 'ghHud', Math.max(0, a.hp / a.maxHp), now), hpCols, now, flip, a.healAt ? { from: a.healFrom, glow: Math.max(0, 1 - (now - a.healAt) / 600) } : null);
  if (a.shield > 0) { const sw = (bw - 6) * Math.min(1, a.shield / a.maxHp); ctx.fillStyle = 'rgba(190,235,255,0.95)'; ctx.fillRect(X(bx + 3, sw), py + 13, sw, 1.6); }
  hudBar('assets/hud_bar_a_warm.png', X(bx, bw), py + 11, bw);
  text(`${Math.ceil(a.hp)} / ${a.maxHp}`, X(bx + bw - 8), py + 17.6, '#ffffff', 6.5, flip ? 'left' : 'right');
  text('HP', X(bx + 7), py + 17.6, 'rgba(255,230,220,0.85)', 5.5, al);
  const mw = bw * 0.72;
  capsuleBar(X(bx + 5, mw - 10), py + 31, mw - 10, 6, a.mp / a.maxMp, 0, ['#a8e4ff', '#2a7ef0', '#0e2a7a'], now, flip);
  hudBar('assets/hud_bar_b_warm.png', X(bx, mw), py + 28, mw);
  if (a.mpShort && now - a.mpShort.at < 700) {   // NOT ENOUGH MP: the bar blinks blue-white and a white tick marks what the spell needs
    const k = (now - a.mpShort.at) / 700, on = Math.floor(k * 6) % 2 === 0, mx = bx + 5, mwi = mw - 10, nx = mx + mwi * Math.min(1, a.mpShort.need / a.maxMp);
    if (on) { ctx.save(); ctx.globalAlpha = 0.85 * (1 - k); ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 1; rrect(ctx, X(mx - 1, mwi + 2), py + 30, mwi + 2, 8, 4); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = `rgba(255,255,255,${0.95 * (1 - k * k)})`; ctx.fillRect(X(nx - 0.5, 1), py + 29.5, 1, 9);
  }
  text(`${Math.floor(a.mp)} / ${a.maxMp}`, X(bx + mw - 8), py + 34, '#e8f4ff', 5, flip ? 'left' : 'right');
  text('MP', X(bx + 8), py + 34, 'rgba(220,236,255,0.85)', 4.5, al);
  // EXP: a thin gold line along the plate's foot
  const ew = pw - 22, ex = px + 11, k = pr ? Math.min(1, (pr.exp || 0) / expNeed(pr.lv || 1)) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(X(ex, ew), py + ph - 4.5, ew, 2);
  if (pr) {
    const eg = ctx.createLinearGradient(X(ex), 0, X(ex + ew), 0); eg.addColorStop(0, '#a8661c'); eg.addColorStop(1, '#ffe08a');
    const fx = flip ? { k, glint: 0 } : expFx(pr, k, now);
    ctx.fillStyle = eg; ctx.fillRect(X(ex, ew * fx.k), py + ph - 4.5, ew * fx.k, 2);
    if (fx.glint > 0) { ctx.fillStyle = `rgba(255,255,255,${0.9 * fx.glint})`; ctx.fillRect(X(ex + ew * fx.from, ew * (fx.k - fx.from)), py + ph - 5, ew * Math.max(0, fx.k - fx.from), 3); }   // (the newly earned part glints)
    if (pr.restedExp > 0) { const r = Math.min(1 - k, pr.restedExp / expNeed(pr.lv || 1)); ctx.fillStyle = 'rgba(120,190,255,0.75)'; ctx.fillRect(X(ex + ew * k, ew * r), py + ph - 4.5, ew * r, 2); }   // rested EXP: how far the double-EXP pool reaches (sessionrecap.js)
    text(`EXP ${Math.floor(k * 100)}%`, X(px + pw - 12), py + 34, '#e8c878', 5.5, flip ? 'left' : 'right');
  }
  // ---- chips under the frame: coins, stat points, quick potion, status effects
  let cx = px + 4; const cy = py + ph + 5, chip = (w, border) => { const x = X(cx, w); hudChip(x, cy, w, border); cx += w + 4; return x; };
  if (pr) {
    const cs = String(pr.coins || 0), x = chip(textW(cs, 7) + 20, 'rgba(232,190,100,0.6)');
    coinIcon(x + 7, cy + 6, 9);
    const cf = flip ? { v: pr.coins || 0, glow: 0 } : goldFx(pr.coins || 0, now, COINFX);
    text(String(cf.v), x + 13, cy + 6.3 - cf.glow * 1.2, cf.glow > 0 ? mixCol('#ffd23f', '#ffffff', cf.glow * 0.8) : '#ffd23f', 7, 'left');
    const gs = String(pr.gold || 0), xg = chip(textW(gs, 7) + 24, 'rgba(255,210,80,0.6)');
    iconCentered('items', homeIcon(21), xg + 8, cy + 6, 9);
    const gf = flip ? { v: pr.gold || 0, glow: 0 } : goldFx(pr.gold || 0, now);
    text(gf.v + ' G', xg + 14, cy + 6.3 - gf.glow * 1.2, gf.glow > 0 ? mixCol('#ffe9a8', '#ffffff', gf.glow * 0.8) : '#ffe9a8', 7, 'left');   // (it counts up and hops a touch on a gain)
    // SOULS (2026-11-20, the user: "soul currency isnt showing up"): melted spare cards (bigsummon.js), shown beside the gold: a small violet flame
    const ss = String(pr.souls || 0), xs = chip(textW(ss, 7) + 20, 'rgba(90,224,168,0.6)');
    drawSoulWisp(xs + 3, cy + 1);   // (a crisp pixel wisp in the summon console's soul green: the soft violet flame looked bad, 2026-11-20)
    text(ss, xs + 13, cy + 6.3, '#bff8dc', 7, 'left');
    const hu = pr.hunger ?? 80, hs = hungerState(hu), xh = chip(52, hs === 'starving' ? `rgba(255,80,60,${0.6 + 0.35 * Math.sin(now / 150)})` : hs === 'hungry' ? 'rgba(255,150,80,0.75)' : 'rgba(200,190,170,0.5)');
    const ef = flip ? { v: hu, glow: 0 } : goldFx(hu, now, EATFX), eatHop = ef.glow > 0.5 ? Math.sin((1 - ef.glow) * 2 * Math.PI) * 1.5 : 0;   // EATING: the bar fills up smoothly with a white shine and the bread hops
    iconCentered('items', homeIcon(11), xh + 8, cy + 6 - eatHop, 9);
    ctx.fillStyle = '#05030a'; rrect(ctx, xh + 15, cy + 4, 32, 4, 2); ctx.fill();
    ctx.fillStyle = hs === 'starving' || hs === 'hungry' ? '#ff7a4a' : hs === 'full' ? '#8fffb0' : '#ffd27a'; rrect(ctx, xh + 15, cy + 4, Math.max(2, 32 * Math.min(hu, EATFX.v ?? hu) / 100), 4, 2); ctx.fill();
    if (ef.glow > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * ef.glow})`; rrect(ctx, xh + 15, cy + 4, Math.max(2, 32 * Math.min(hu, EATFX.v ?? hu) / 100), 4, 2); ctx.fill(); }
    if (hs === 'starving') text(`−${Math.round(starveCut(pr) * 100)}% DMG`, xh + 31, cy + 6.3, '#ff9a8a', 5.5);   // how weak starving has made you
    if (a.kind === 'player' && GAME.scene === 'world' && !GAME.menu && clicked(xh, cy, 52, 12)) GAME.openMenu(diningMenu());   // click the hunger bar: MEAL TIME
    const sp = statPoints(pr);
    if (sp > 0) {
      const s = `+${sp} STAT`, cw = textW(s, 6) + 12, x2 = chip(cw, `rgba(255,160,70,${0.6 + 0.3 * Math.sin(now / 250)})`);
      text(s, x2 + 6, cy + 6.3, '#ffd0a0', 6, 'left');
      if (a.kind === 'player' && GAME.scene === 'world' && !GAME.menu && clicked(x2, cy, cw, 12)) { GAME.openMenu(inventoryMenu(GAME)); GAME.menu.tab = 'stats'; }   // click it: straight to STATS to spend them
    }
  }
  if (world && GAME.world && !GAME.world.interior) drawAreaRibbon(label, now);
  if (side === 0) drawComboCounter(a, now);
}
// Big combo counter (right side): punches in on every hit, warms from white to gold to red to rainbow,
// with a rating word as the chain grows.
function drawComboCounter(a, now) {
  if ((a.combo || 0) > (a.lastCombo || 0)) a.comboPopT = now;
  a.lastCombo = a.combo;
  if (!(a.combo >= 2) || !(a.comboT > 0)) return;
  const n = a.combo, pop = 1 + 0.8 * Math.max(0, 1 - (now - (a.comboPopT || 0)) / 140);
  const col = n >= 40 ? `hsl(${(now / 3) % 360},100%,65%)` : n >= 20 ? '#ff4a3a' : n >= 10 ? '#ff9a2a' : n >= 5 ? '#ffd23f' : '#ffffff';
  const word = n >= 40 ? 'ZENONIA!!' : n >= 20 ? 'AWESOME!' : n >= 10 ? 'GREAT!' : n >= 5 ? 'GOOD' : '';
  const x = VW - 16, y = 222;
  ctx.save(); ctx.globalAlpha = Math.min(1, a.comboT / 300);
  ctx.translate(x, y); ctx.rotate(-0.06);
  text(String(n), 0, 0, col, 24 * pop, 'right');
  text('HITS', 0, 16, '#ffffff', 9, 'right');
  if (word) text(word, 0, 28, col, 8 * (1 + 0.3 * (pop - 1)), 'right');
  ctx.restore();
}
function drawHUDClassic(a, side, now, label) {
  const right = side === 1, W = 196, H = 34;
  const x0 = right ? VW - 8 - W : 8, y0 = 6;
  a.hpTrail = a.hpTrail == null ? a.hp : Math.max(a.hp, a.hpTrail - a.maxHp * 0.0045);
  const hpLow = a.hp / a.maxHp < 0.3;
  // plate: dark glass, angled outer end, gold rim + inner hairline
  const px = right ? x0 : x0 + 14, pw = W - 14;
  const plate = () => {
    ctx.beginPath();
    if (!right) { ctx.moveTo(px, y0); ctx.lineTo(px + pw, y0); ctx.lineTo(px + pw - 12, y0 + H); ctx.lineTo(px, y0 + H); }
    else { ctx.moveTo(px, y0); ctx.lineTo(px + pw, y0); ctx.lineTo(px + pw, y0 + H); ctx.lineTo(px + 12, y0 + H); }
    ctx.closePath();
  };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 5 * RES; ctx.shadowOffsetY = 2 * RES;
  const pg = ctx.createLinearGradient(0, y0, 0, y0 + H); pg.addColorStop(0, 'rgba(48,32,20,0.94)'); pg.addColorStop(1, 'rgba(12,8,20,0.94)');
  ctx.fillStyle = pg; plate(); ctx.fill(); ctx.restore();
  ctx.strokeStyle = goldFrameGrad(y0, H); ctx.lineWidth = 1.1; plate(); ctx.stroke();
  ctx.save(); plate(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px, y0, pw, H * 0.45);   // glass sheen on the upper half
  ctx.restore();
  // level emblem overlapping the plate's inner end
  const ex = right ? x0 + W - 2 : x0 + 12, ey = y0 + H / 2;
  levelEmblem(ex, ey, a.lv, now, hpLow);
  // text + bars
  const bx = right ? px + 14 : px + 16, bw = pw - 38;
  ctx.save(); ctx.beginPath(); ctx.rect(bx - 2, y0 + 1, bw + 4, 10); ctx.clip();
  text(label, right ? bx + bw : bx, y0 + 6.5, '#fff1d6', 7, right ? 'right' : 'left');
  ctx.restore();
  const hpCols = hpLow ? ['#ff9a8a', '#e8302a', '#7a0c0c'] : ['#ff9a7a', '#e2463a', '#8a1a14'];
  slantBar(bx, y0 + 12, bw, 8, a.hp / a.maxHp, hpGhost(a, 'ghHud', Math.max(0, a.hp / a.maxHp), now), hpCols, `${Math.ceil(a.hp)} / ${a.maxHp}`, right);
  if (a.shield > 0) { ctx.fillStyle = 'rgba(170,225,255,0.9)'; ctx.fillRect(bx + 6, y0 + 12.2, (bw - 10) * Math.min(1, a.shield / a.maxHp), 1.5); }
  slantBar(right ? bx + bw * 0.3 : bx, y0 + 22.5, bw * 0.7, 5.5, a.mp / a.maxMp, 0, ['#9ad8ff', '#3a7cf0', '#13307a'], `${Math.floor(a.mp)}`, right);
  if (!right && window.GAME && GAME.profile && GAME.scene === 'world') {
    const pr = GAME.profile, need = expNeed(pr.lv || 1), k = Math.min(1, (pr.exp || 0) / need);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(px + 4, y0 + H - 3, pw - 18, 2);
    const eg = ctx.createLinearGradient(px, 0, px + pw, 0); eg.addColorStop(0, '#a8661c'); eg.addColorStop(1, '#ffe08a');
    const fx = expFx(pr, k, now);
    ctx.fillStyle = eg; ctx.fillRect(px + 4, y0 + H - 3, (pw - 18) * fx.k, 2);
    if (fx.glint > 0) { ctx.fillStyle = `rgba(255,255,255,${0.9 * fx.glint})`; ctx.fillRect(px + 4 + (pw - 18) * fx.from, y0 + H - 3.5, (pw - 18) * Math.max(0, fx.k - fx.from), 3); }   // (the newly earned part glints)
    if (pr.restedExp > 0) { const r = Math.min(1 - k, pr.restedExp / need); ctx.fillStyle = 'rgba(120,190,255,0.75)'; ctx.fillRect(px + 4 + (pw - 18) * k, y0 + H - 3, (pw - 18) * r, 2); }   // rested EXP (sessionrecap.js)
    text(`EXP ${Math.floor(k * 100)}%`, bx + bw * 0.7 + 4, y0 + 25.4, '#e8c878', 5.5, 'left');
    // coins + unspent stat points under the frame
    coinIcon(px + 6, y0 + H + 8, 10);
    text(`${pr.coins || 0}`, px + 13, y0 + H + 8.3, '#ffd23f', 7, 'left');
    const sp = statPoints(pr);
    if (sp > 0) text(`+${sp} stat pts`, px + 34, y0 + H + 8.3, `rgba(255,170,90,${0.7 + 0.3 * Math.sin(now / 250)})`, 6.5, 'left');
  }
  // status icons
  if (a.combo >= 2) {
    const pulse = 1 + Math.max(0, a.comboT - 1100) / 300;
    text(a.combo + ' HITS', right ? VW - 12 : 12, 76, '#ffd23f', Math.round(15 * pulse), right ? 'right' : 'left');
  }
}

// ---------------------------------------------------------------- action bar (bottom, centred on cx)
// [Q][E][R]  ⟨LAYER⟩  [C fusion][dash]. While transcended, picked cards lift and glow; LAYER shows UNLEASH ×n.
const SLOT = 26;
function skillSlot(x, y, s, card, el, now, o = {}) {
  const t = card ? card.tier : 0, rc = card ? (t === 9 ? `hsl(${(now / 8) % 360},100%,68%)` : RANK_COL[t]) : '#5a4a3a';
  // Zenonia 2 silver skill button as the bezel (pops when the spell fires)
  const pop = o.popT ? 1 + 0.18 * clamp(1 - (now - o.popT) / 180, 0, 1) : 1;
  if (pop > 1) { ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.scale(pop, pop); ctx.translate(-x - s / 2, -y - s / 2); }
  ctx.save();
  ctx.shadowColor = o.picked ? '#ffffff' : 'rgba(0,0,0,0.7)'; ctx.shadowBlur = (o.picked ? 8 : 3) * RES; ctx.shadowOffsetY = o.picked ? 0 : 1.5 * RES;
  if (!hudNine('assets/hud_slot_warm.png', x - 3, y - 3, s + 6, s + 6, 0.3)) { ctx.fillStyle = '#0a0610'; rrect(ctx, x - 1.5, y - 1.5, s + 3, s + 3, 4); ctx.fill(); }
  ctx.restore();
  // element-lit well
  const ec = el ? ELEMENTS[el].col : '#ffd23f';
  const g = ctx.createRadialGradient(x + s / 2, y + s * 0.6, 1, x + s / 2, y + s / 2, s * 0.75);
  g.addColorStop(0, card ? hexA(ec, 0.55) : 'rgba(40,30,50,0.5)'); g.addColorStop(1, '#0e0a16');
  ctx.fillStyle = g; rrect(ctx, x, y, s, s, 3); ctx.fill();
  if (card) {
    ctx.save(); rrect(ctx, x + 1, y + 1, s - 2, s - 2, 3); ctx.clip();
    if (card.fusion) card.fusion.slice(0, 2).forEach((p, i) => monsterPreview(cardIconSpecies(p), x + i * s / 2 - 1, y + 2, s / 2 + 2, s - 4, p.tier, 0));
    else monsterPreview(card.sp, x + 2, y + 2, s - 4, s - 4, t, 0);
    ctx.restore();
  }
  // frame: rank-coloured inner ring and a glassy top sheen
  ctx.strokeStyle = card ? rc : 'rgba(200,200,220,0.25)'; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, s - 1, s - 1, 3); ctx.stroke();
  const gl = ctx.createLinearGradient(0, y, 0, y + s * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; rrect(ctx, x + 1, y + 1, s - 2, s * 0.45, 3); ctx.fill();
  if (pop > 1) ctx.restore();
  // cooldown / no-MP / picked overlays
  if (o.cd > 0) {
    ctx.save(); rrect(ctx, x, y, s, s, 3); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.66)';
    ctx.beginPath(); ctx.moveTo(x + s / 2, y + s / 2); ctx.arc(x + s / 2, y + s / 2, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * o.cd); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (o.cdText) text(o.cdText, x + s / 2, y + s / 2, '#ffffff', 8);
  } else if (o.noMp) { ctx.fillStyle = 'rgba(20,40,150,0.55)'; rrect(ctx, x, y, s, s, 3); ctx.fill(); }
  if (o.picked) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; rrect(ctx, x - 1, y - 1, s + 2, s + 2, 4); ctx.stroke();
    const pgl = ctx.createRadialGradient(x + s / 2, y + s / 2, 2, x + s / 2, y + s / 2, s);
    pgl.addColorStop(0, hexA(ec, 0.5)); pgl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pgl; ctx.fillRect(x - s / 2, y - s / 2, s * 2, s * 2);
    ctx.restore();
    text('✓', x + s - 4, y + 4.5, '#ffffff', 7);
  } else if (o.selectable) {
    ctx.strokeStyle = 'rgba(200,235,255,0.55)'; ctx.setLineDash([2, 2]); ctx.lineWidth = 0.8; rrect(ctx, x - 2, y - 2, s + 4, s + 4, 4); ctx.stroke(); ctx.setLineDash([]);
  }
  if (o.mp != null) text(String(o.mp), x + s - 2.5, y + s - 4, '#9ad8ff', 6, 'right');
  if (o.key) keyGem(o.key, x + s / 2 - Math.max(9, textW(o.key, 6) + 4) / 2 + 1, y + s + 4);
}
function drawSpellBar(a, keysLbl, cx, y, now) {
  const s = SLOT, gap = 5, tr = a.transcend > 0, sel = a.layerSel || [];
  // three slots either side of the LAYER emblem: [Q][E][R] ⟨LAYER⟩ [fusion][dash][block]
  const side = 30 + 3 * s + 2 * gap, W = side * 2, x0 = cx - W / 2, top = y - 8;
  // the tray: one Mana Soul panel under the whole bar, with the LAYER emblem (unchanged) set into its middle
  hudNine('assets/hud_panel_warm.png', x0 - 10, top + 1, W + 20, s + 18, 0.42);
  // a spell that just fired makes its button pop
  a.cdPrev = a.cdPrev || [0, 0, 0]; a.castPop = a.castPop || [0, 0, 0];
  a.readyAt = a.readyAt || [0, 0, 0];
  for (let i = 0; i < 3; i++) { if ((a.cds[i] || 0) > a.cdPrev[i] + 30) a.castPop[i] = now; if (a.cdPrev[i] > 0 && !(a.cds[i] > 0)) a.readyAt[i] = now; a.cdPrev[i] = a.cds[i] || 0; }   // (and one that just came off cooldown rings: readyT)
  const sy = top + 8;
  // spells
  for (let i = 0; i < 3; i++) {
    const sp = a.spells[i], sx = x0 + i * (s + gap), picked = tr && sel[i];
    const card = sp ? { sp: sp.sp, tier: sp.tier } : null;
    skillSlot(sx, sy - (picked ? 5 : 0), s, card, sp && sp.el, now, {
      cd: sp && a.cds[i] > 0 ? a.cds[i] / sp.cd : 0, cdText: sp && a.cds[i] > 0 ? (a.cds[i] / 1000 / (rankedOn(GAME.world) ? RANKED_RULES.cdRate : 1)).toFixed(1) : '',
      noMp: sp && !tr && a.mp < sp.mp, mp: sp ? sp.mp : null, key: keysLbl[i], picked, selectable: tr && sp && !(a.cds[i] > 0), popT: a.castPop[i], pokeT: a.cdPoke && a.cdPoke[i], readyT: a.readyAt[i] });
    if (clicked(sx, sy, s, s) && tr) (a.selReq = a.selReq || [])[i] = true;
  }
  // LAYER emblem in the middle
  drawLayerButton(a, cx, sy + s / 2 - 2, keysLbl[5] || 'V', now);
  if (window.GAME && GAME.scene === 'world' && a === (GAME.world && GAME.world.player)) drawKiOnLayer(GAME, a, cx, sy + s / 2 - 2, now);
  // fusion card (slot 4) and dash
  const fx = cx + 30, fusionOk = a.fusion && !a.fusionUsed;
  skillSlot(fx, sy - (tr && sel[3] ? 5 : 0), s, a.fusion || null, a.fusion ? fusionSpells(a.fusion)[0].el : null, now,
    { key: keysLbl[3], picked: tr && sel[3], selectable: tr && fusionOk, cd: a.fusion && a.fusionUsed && tr ? 1 : 0 });
  if (clicked(fx, sy, s, s) && tr) (a.selReq = a.selReq || [])[3] = true;
  if (!a.fusion) text('FUSION', fx + s / 2, sy + s / 2, 'rgba(200,170,120,0.45)', 5.5);
  const dx = fx + s + gap + s / 2, dy = sy + s / 2, cd = (a.dashCd || 0) / 1000;
  actionSlot(dx - s / 2, sy, s, a.state === 'dashing' ? '#3ab0e0' : '#123a58');
  text('»', dx, dy + 0.5, cd > 0 ? '#5a7a8a' : '#ffffff', 13);
  if (a.counterT > 0) { ctx.strokeStyle = heroLayer(a).bloom; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 70); ctx.lineWidth = 1.6; rrect(ctx, dx - s / 2, sy, s, s, 3); ctx.stroke(); ctx.globalAlpha = 1; }   // a perfect dodge: the dash is back, and the counter is open (guard.js)
  if (cd > 0) { ctx.save(); rrect(ctx, dx - s / 2, sy, s, s, 3); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,0.66)'; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.arc(dx, dy, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd * 1000 / (a.dashCdMax || DASH.cd))); ctx.closePath(); ctx.fill(); ctx.restore(); if (cd > 1) text(String(Math.ceil(cd)), dx, dy + 0.5, '#ffffff', 9); }
  keyGem(keysLbl[4] || 'Dash', dx - Math.max(9, textW(keysLbl[4] || 'Dash', 6) + 4) / 2 + 1, sy + s + 4);
  drawBlockButton(a, dx + s + gap, dy, keysLbl[6] || 'L', now);
  if (tr) {
    const n = sel.filter(Boolean).length;
    text(n ? `LAYER ×${n} ready — press ${keysLbl[5] || 'V'}` : `Pick cards to layer: ${keysLbl.slice(0, 4).join(' / ')} or click`, cx, top - 16, n ? '#ffffff' : '#bfe6ff', 7);
  }
}
// BLOCK: a shield gem. Hold its key, or hold the mouse on it, to guard; it lights up while guarding and flashes
// gold during the perfect-block (parry) window.
// a square slot for an action (dash, block), the same frame as the spell slots
function actionSlot(x, y, s, col) { hudNine('assets/hud_slot_warm.png', x - 3, y - 3, s + 6, s + 6, 0.3); ctx.fillStyle = col; rrect(ctx, x, y, s, s, 3); ctx.fill(); }
function drawBlockButton(a, cx, cy, key, now) {
  const s = SLOT, R = s / 2, on = a.state === 'block', perfect = on && a.blockT < guardPerfect(a), hit = Math.max(0, a.blockFlash || 0) / 160;
  a.blockHeld = !!(mouse.down && Math.abs(mouse.x - cx) < R + 2 && Math.abs(mouse.y - cy) < R + 2);
  if (on) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, R * 1.9);
    g.addColorStop(0, perfect ? 'rgba(255,225,140,0.7)' : `rgba(140,210,255,${0.45 + 0.4 * hit})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4); ctx.restore();
  }
  actionSlot(cx - R, cy - R, s, a.gBroken ? '#4a1a1a' : on ? '#2a6ab0' : '#1a2a48');
  { const k = a.gstPct != null ? a.gstPct / 100 : 1, HL = heroLayer(a), h = Math.round((s - 2) * k);   // GUARD STAMINA: the slot fills from the bottom in your Layer's colour (guard.js)
    ctx.save(); ctx.globalAlpha = a.gBroken ? 0.5 : 0.45; ctx.fillStyle = a.gBroken ? '#ff6a4a' : HL.bloom; rrect(ctx, cx - R + 1, cy + R - 1 - h, s - 2, h, 2); ctx.fill(); ctx.restore(); }
  if (perfect) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1.8; rrect(ctx, cx - R, cy - R, s, s, 3); ctx.stroke(); }
  // shield emblem
  ctx.save(); ctx.translate(cx, cy + 0.5); ctx.scale(1.1, 1.1);
  ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.lineTo(6, -5); ctx.lineTo(5.2, 1.5); ctx.quadraticCurveTo(3.5, 5.5, 0, 7.5); ctx.quadraticCurveTo(-3.5, 5.5, -5.2, 1.5); ctx.lineTo(-6, -5); ctx.closePath();
  ctx.fillStyle = on ? '#ffffff' : '#d8e4f0'; ctx.fill();
  ctx.strokeStyle = '#1a2a40'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = on ? '#4a9aff' : '#6a7a90'; ctx.fillRect(-0.8, -5, 1.6, 10); ctx.fillRect(-4, -1.5, 8, 1.6);
  ctx.restore();
  if (a.gBroken) {   // broken: a crack across the shield until it is back to 40%
    ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - 2, cy - 8); ctx.lineTo(cx + 1, cy - 3); ctx.lineTo(cx - 2, cy + 1); ctx.lineTo(cx + 2, cy + 7); ctx.stroke();
  }
  const B = GUARDX.burst, ready = lsk(a, 'sburst') > 0 && !(a.burstCd > 0) && (a.gst == null || a.gst >= B.cost);
  if (ready && on && a.blockT >= B.hold) { const pl = 0.55 + 0.45 * Math.sin(now / 110); ctx.strokeStyle = `rgba(255,216,96,${pl})`; ctx.lineWidth = 2; rrect(ctx, cx - R - 2, cy - R - 2, s + 4, s + 4, 4); ctx.stroke(); }   // SHIELD BURST is ready: let go
  else if (lsk(a, 'sburst') > 0 && a.burstCd > 0) { const f = a.burstCd / B.cd; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(cx - R, cy - R, s, Math.round(s * f)); }   // (its cooldown, draining away)
  keyGem(key, cx - Math.max(9, textW(key, 6) + 4) / 2 + 1, cy + R + 4);
}
// LAYER emblem: a royal seal. Turning sunburst rays behind, a jewelled gold octagon holding a sapphire crystal with
// the lightning crest, the winged crown from the status window on top, and a crimson ribbon carrying the title
// in gilded serif capitals. Cooling down it dims to tarnished gold with the seconds left; ready it shines;
// ascended the crystal turns white-hot with the time left as a ring; with cards picked the ribbon reads UNLEASH.
function goldText(str, x, y, size, opt = {}) {   // gold pixel lettering (see pixText)
  const c = opt.cols || ['#fffbe0', '#ffd860', '#c07a18', '#ffe8a0'];
  ctx.save(); if (opt.glow) { ctx.shadowColor = opt.glow; ctx.shadowBlur = 5 * RES; }
  drawPix(pixText(String(str), fontPx(size), 700, [c[0], c[1], c[2]], opt.edge || '#2a1004'), x, y, 'center');
  ctx.restore();
}
function goldTextW(str, size) { return textW(str, size, true); }
function drawLayerButton(a, cx, cy, key, now) {
  const R = 16, cd = Math.max(0, a.layerCd || 0) / (a.layerCdMax || LAYER.cd), ready = cd <= 0, active = a.transcend > 0, lit = ready || active;
  const n = active ? (a.layerSel || []).filter(Boolean).length : 0;
  const oct = r => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const t = Math.PI / 8 + i * Math.PI / 4; i ? ctx.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r) : ctx.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r); } ctx.closePath(); };
  const gold = lit ? goldFrameGrad(cy - R, R * 2) : (() => { const g = ctx.createLinearGradient(0, cy - R, 0, cy + R); g.addColorStop(0, '#b8a888'); g.addColorStop(0.5, '#6a5a40'); g.addColorStop(1, '#a89878'); return g; })();
  // sunburst rays + halo
  if (lit) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(cx, cy, 4, cx, cy, R * 2.4);
    hg.addColorStop(0, active ? 'rgba(255,250,230,0.7)' : 'rgba(255,215,120,0.45)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.fillRect(cx - R * 2.5, cy - R * 2.5, R * 5, R * 5);
    ctx.translate(cx, cy); ctx.rotate(now / (active ? 1400 : 4000));
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      const len = R * (i % 2 ? 1.75 : 2.15) * (0.92 + 0.08 * Math.sin(now / 300 + i));
      const rg = ctx.createLinearGradient(0, 0, len, 0);
      rg.addColorStop(0, active ? 'rgba(255,255,255,0.55)' : 'rgba(255,220,130,0.45)'); rg.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(R * 0.6, -2.2); ctx.lineTo(len, 0); ctx.lineTo(R * 0.6, 2.2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // gold octagon seal with an engraved inner ring and gem studs
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 4 * RES; ctx.shadowOffsetY = 1.5 * RES;
  ctx.fillStyle = gold; oct(R); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#3a1e04'; ctx.lineWidth = 0.9; oct(R); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,220,0.75)'; ctx.lineWidth = 0.6; oct(R - 1.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,30,4,0.6)'; ctx.lineWidth = 0.6; oct(R - 3.4); ctx.stroke();
  for (let i = 0; i < 8; i++) {   // studs at the corners: alternating ruby and sapphire
    const t = Math.PI / 8 + i * Math.PI / 4, sx = cx + Math.cos(t) * (R - 2.3), sy = cy + Math.sin(t) * (R - 2.3);
    const sg = ctx.createRadialGradient(sx - 0.4, sy - 0.4, 0.1, sx, sy, 1.3);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.4, lit ? (i % 2 ? '#ff3a5a' : '#4aa0ff') : '#8a8090'); sg.addColorStop(1, '#1a0a20');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  // the crystal: a faceted sapphire (white-hot while ascended)
  const cr = R - 4.6;
  const crg = ctx.createRadialGradient(cx - 3, cy - 4, 0.5, cx, cy, cr * 1.2);
  if (active) { crg.addColorStop(0, '#ffffff'); crg.addColorStop(0.5, '#d8f0ff'); crg.addColorStop(1, '#5aa0ff'); }
  else if (ready) { crg.addColorStop(0, '#e8f6ff'); crg.addColorStop(0.35, '#4a8cff'); crg.addColorStop(1, '#0a1a5a'); }
  else { crg.addColorStop(0, '#6a6a80'); crg.addColorStop(1, '#14141e'); }
  ctx.fillStyle = crg; oct(cr); ctx.fill();
  ctx.save(); oct(cr); ctx.clip();
  ctx.strokeStyle = lit ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5;   // facets
  for (let i = 0; i < 8; i++) { const t = Math.PI / 8 + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t) * cr, cy + Math.sin(t) * cr); ctx.stroke(); }
  if (lit) {   // a glint sweeping across the crystal
    const k = ((now / 1800) % 1.6) - 0.3, gx = cx - cr + k * cr * 2;
    const gg = ctx.createLinearGradient(gx - 4, cy - cr, gx + 4, cy + cr);
    gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
  }
  ctx.restore();
  // magic circuit crest (as on the deck page): a hub ring, traces leaving it with a 45° bend, node studs at
  // the ends and mana pulses running outward
  ctx.save(); oct(cr - 0.5); ctx.clip(); ctx.translate(cx, cy);
  // the circuit glows in the layer's element: the one active, or (while ready) the one your cards would give
  const Lp = LAYER_ELS[active ? a.layerEl || 'lightning' : layerElementOf(a)];
  const core = lit ? (active ? Lp.body : Lp.inner) : '#9a9aaa', glow = lit ? Lp.bloom : null;
  const traces = [[-1, -1, 0], [1, -1, 1], [1, 1, 0], [-1, 1, 1], [0, -1, 0], [0, 1, 1]].map(([sx, sy, turn], i) => {
    const a0 = [sx * 2.4, sy * 2.4], d = sx ? 2.8 : 0;   // start on the hub, run diagonally, then straight
    const mid = sx ? [a0[0] + sx * d, a0[1] + sy * d] : [0, sy * 4.6];
    const end = sx ? (turn ? [mid[0], sy * 8] : [sx * 8, mid[1]]) : [sy > 0 ? 3.5 : -3.5, sy * 7.6];
    return [sx ? a0 : [0, sy * 2.6], mid, end];
  });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 3 * RES; }
  ctx.strokeStyle = core; ctx.lineWidth = 0.9;
  for (const P of traces) { ctx.beginPath(); P.forEach(([u, v], k) => k ? ctx.lineTo(u, v) : ctx.moveTo(u, v)); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.stroke();                 // hub ring
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
  for (const P of traces) { const [u, v] = P[2]; ctx.beginPath(); ctx.arc(u, v, 1.1, 0, Math.PI * 2); ctx.fill(); }   // node studs
  if (lit) {
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter';
    traces.forEach((P, i) => {
      const k = (now / (active ? 450 : 900) + i / traces.length) % 1, [px, py] = polyAt(P, k);
      const g = ctx.createRadialGradient(px, py, 0, px, py, 2.2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - 2.2, py - 2.2, 4.4, 4.4);
    });
  }
  ctx.restore();
  // cooling down: a dark sweep and the seconds left
  if (!lit) {
    ctx.save(); oct(cr); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd); ctx.closePath(); ctx.fill();
    ctx.restore();
    goldText(String(Math.ceil(a.layerCd / 1000)), cx, cy + 0.5, 10, { cols: ['#ffffff', '#e8e8f0', '#a8a8b8', '#ffffff'], spacing: 0 });
  }
  if (active) {   // time left as a white ring around the seal
    ctx.save(); ctx.shadowColor = Lp.mote; ctx.shadowBlur = 4 * RES;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(cx, cy, R + 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (a.transcend / (a.transcendMax || LAYER.dur))); ctx.stroke(); ctx.restore();
  }
  // winged crown on top
  const crown = imgReady('assets/ui_crown.png');
  if (crown) {
    const cw = 54, ch = cw * crown.height / crown.width, bob = lit ? Math.sin(now / 600) * 0.8 : 0;
    ctx.save(); ctx.imageSmoothingEnabled = true; if (!lit) ctx.filter = 'grayscale(0.7) brightness(0.75)';
    ctx.drawImage(crown, cx - cw / 2, cy - R - ch + 6 + bob, cw, ch); ctx.restore();
  }
  // crimson ribbon with the title
  const kiNow = window.GAME && GAME.scene === 'world' && a === (GAME.world && GAME.world.player) && kiPicked(GAME.profile);
  const lbl = kiNow ? 'KI' : active ? (n ? `UNLEASH ×${n}` : `${Lp.name.toUpperCase()} LAYER`) : 'LAYER';
  const tw = Math.max(36, goldTextW(lbl, n ? 6 : 6.5) + 12), ry = cy + R + 5.5;
  const ribbon = (x0, x1, y, h, notch) => { ctx.beginPath(); ctx.moveTo(x0 - notch, y - h / 2); ctx.lineTo(x1 + notch, y - h / 2); ctx.lineTo(x1, y); ctx.lineTo(x1 + notch, y + h / 2); ctx.lineTo(x0 - notch, y + h / 2); ctx.lineTo(x0, y); ctx.closePath(); };
  ctx.fillStyle = lit ? '#5a0a1a' : '#3a2a30'; ribbon(cx - tw / 2 - 4, cx + tw / 2 + 4, ry + 1.5, 7, 3); ctx.fill();   // tails
  const rbg = ctx.createLinearGradient(0, ry - 4.5, 0, ry + 4.5);
  rbg.addColorStop(0, lit ? (active ? Lp.body : '#d8304a') : '#6a5a60'); rbg.addColorStop(1, lit ? (active ? Lp.halo : '#7a0a20') : '#3a2e34');
  ctx.fillStyle = rbg; ctx.beginPath(); ctx.moveTo(cx - tw / 2, ry - 4.5); ctx.quadraticCurveTo(cx, ry - 6.5, cx + tw / 2, ry - 4.5); ctx.lineTo(cx + tw / 2, ry + 4.5); ctx.quadraticCurveTo(cx, ry + 2.5, cx - tw / 2, ry + 4.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = lit ? '#ffd860' : '#9a8a70'; ctx.lineWidth = 0.7; ctx.stroke();
  goldText(lbl, cx, ry - 0.6, n ? 6 : 6.5, lit ? { glow: active ? `rgba(${Lp.glow},0.9)` : 'rgba(255,200,80,0.6)' } : { cols: ['#e8e0d0', '#b8a888', '#7a6a50', '#c8b898'] });
  keyGem(key, cx + R - 4, cy - R + 4);
  if (clicked(cx - R, cy - R, R * 2, R * 2)) a.layerReq = true;
}
// ---- the ITEM BELT, right of the skill bar: up to four usable goods (potions, elixirs, cures) from your bag, each in
// its own socket with its count and key (5–8; P drinks the first healing one). One use every ITEM_CD ms, shown as a
// dark sweep over the sockets. Hover a socket for what it does; click it to use it.
const BELT = { x: VW - 106, y: VH - 68, s: 20, gap: 3 }, ITEM_CD = 900, BELT_KEYS = ['5', '6', '7', '8'];
const beltItems = pr => typeof goodsListZ2 === 'function' ? goodsListZ2(pr).filter(e => GOODS_USE[e.it.sub] && !GOODS_USE[e.it.sub].box).slice(0, 4) : [];
const beltSlot = i => ({ x: BELT.x + 5 + i * (BELT.s + BELT.gap), y: BELT.y + 9, w: BELT.s, h: BELT.s });
function useBeltEntry(game, e) {
  if (!e) return false;
  if (performance.now() < (game.itemCd || 0)) return false;
  game.itemCd = performance.now() + ITEM_CD; game.beltPop = { sub: e.it.sub, at: performance.now() }; useGoods(game, e);   // (its socket pops: drawItemBelt)
  const w = game.world, p = w && w.player; if (p) w.rings.push({ x: p.x, y: p.y, r: 16, t: 0, col: '#8fffd0' });
  return true;
}
function beltInput(game) {
  const pr = game.profile, items = beltItems(pr);
  BELT_KEYS.forEach((k, i) => { if (hit('Digit' + k, 'Numpad' + k)) { if (items[i]) useBeltEntry(game, items[i]); else game.toast(`Item slot ${k} is empty — potions drop from monsters and chests`, '#c9c1a8'); } });
  if (hit('KeyP')) { const q = quickPotion(pr); if (q) useBeltEntry(game, q); else game.toast('No potions — monsters and chests drop them', '#c9c1a8'); }
  items.forEach((e, i) => { const S = beltSlot(i); if (clicked(S.x, S.y, S.w, S.h)) useBeltEntry(game, e); });
}
function drawItemBelt(game, now) {
  const pr = game.profile; if (!pr) return;
  const items = beltItems(pr), W = 4 * BELT.s + 3 * BELT.gap + 10, H = BELT.s + 22, x = BELT.x, y = BELT.y;
  const cdK = Math.max(0, ((game.itemCd || 0) - performance.now()) / ITEM_CD);
  // the plate: dark glass in a gold rim, with a little ITEMS tab on top
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4 * RES; ctx.shadowOffsetY = 1.5 * RES;
  const g = ctx.createLinearGradient(0, y, 0, y + H); g.addColorStop(0, 'rgba(46,30,19,0.92)'); g.addColorStop(1, 'rgba(10,7,18,0.94)');
  ctx.restore(); hudNine('assets/hud_panel_warm.png', x - 2, y + 2, W + 4, H - 1, 0.42);
  ctx.fillStyle = '#3a2618'; rrect(ctx, x + W / 2 - 18, y, 36, 9, 3); ctx.fill(); ctx.strokeStyle = '#e0a63a'; ctx.lineWidth = 0.7; rrect(ctx, x + W / 2 - 17.6, y + 0.4, 35.2, 8.2, 3); ctx.stroke();
  text('ITEMS', x + W / 2, y + 4.6, '#ffe9a8', 5.6);
  let tip = null;
  const p = game.world && game.world.player, low = p && !p.dead && p.hp < p.maxHp * 0.3 ? items.findIndex(e => GOODS_USE[e.it.sub].hp) : -1;   // LOW HP: the first healing potion's socket glows to say "here"
  for (let i = 0; i < 4; i++) {
    const bp = game.beltPop && items[i] && items[i].it.sub === game.beltPop.sub ? (now - game.beltPop.at) / 240 : 1, pop = bp >= 0 && bp < 1 ? 1 + 0.22 * Math.sin(bp * Math.PI) : 1;   // USED: its socket pops
    if (pop > 1) { const S0 = beltSlot(i); ctx.save(); ctx.translate(S0.x + S0.w / 2, S0.y + S0.h / 2); ctx.scale(pop, pop); ctx.translate(-S0.x - S0.w / 2, -S0.y - S0.h / 2); }
    if (i === low) { const S0 = beltSlot(i), pl = 0.5 + 0.5 * Math.sin(now / 260); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(110,255,160,${0.12 + 0.18 * pl})`; rrect(ctx, S0.x - 2, S0.y - 2, S0.w + 4, S0.h + 4, 5); ctx.fill(); ctx.restore(); }
    drawBeltSocket(i);
    if (pop > 1) ctx.restore();
    if (i === low) { const S0 = beltSlot(i), pl = 0.5 + 0.5 * Math.sin(now / 260); ctx.strokeStyle = `rgba(140,255,180,${0.5 + 0.5 * pl})`; ctx.lineWidth = 1.2; rrect(ctx, S0.x - 0.4, S0.y - 0.4, S0.w + 0.8, S0.h + 0.8, 4.4); ctx.stroke(); }
  }
  function drawBeltSocket(i) {
    const S = beltSlot(i), e = items[i], cx = S.x + S.w / 2, cy = S.y + S.h / 2, hov = mouse.x >= S.x && mouse.x < S.x + S.w && mouse.y >= S.y && mouse.y < S.y + S.h;
    const sg = ctx.createRadialGradient(cx, cy - 3, 1, cx, cy, S.w * 0.7); sg.addColorStop(0, e ? '#3a2c4a' : '#1c1626'); sg.addColorStop(1, '#0a0710');
    ctx.fillStyle = sg; rrect(ctx, S.x, S.y, S.w, S.h, 4); ctx.fill();
    ctx.strokeStyle = hov && e ? '#ffd23f' : e ? 'rgba(224,166,58,0.85)' : 'rgba(150,130,100,0.35)'; ctx.lineWidth = hov && e ? 1.2 : 0.8; rrect(ctx, S.x + 0.4, S.y + 0.4, S.w - 0.8, S.h - 0.8, 4); ctx.stroke();
    if (e) {
      iconCentered('items', ITEM2_BASE + e.idx, cx, cy, BELT.s * 0.75);
      text(String(e.n), S.x + S.w - 2, S.y + S.h - 3, '#ffffff', 5.6, 'right');
      if (hov) tip = e;
    }
    if (cdK > 0 && e) {   // the cooldown sweep
      ctx.save(); ctx.beginPath(); rrect(ctx, S.x, S.y, S.w, S.h, 4); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, S.w, -Math.PI / 2, -Math.PI / 2 + cdK * Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (!(typeof TOUCH !== 'undefined' && TOUCH.on)) keyGem(BELT_KEYS[i], cx - 4, S.y + S.h + 4.5);   // (no number keys on a phone)
  }
  if (!items.length) text('no potions', x + W / 2, BELT.y + 9 + BELT.s / 2, 'rgba(200,190,170,0.6)', 5.6);
  if (tip) {   // what the hovered item does
    const s = `${tip.it.name} · ${GOODS_USE[tip.it.sub].what}`, tw = textW(s, 6) + 10, tx = Math.min(VW - tw - 4, x + W / 2 - tw / 2);
    ctx.fillStyle = 'rgba(10,7,18,0.92)'; rrect(ctx, tx, y - 13, tw, 11, 4); ctx.fill(); ctx.strokeStyle = 'rgba(224,166,58,0.8)'; ctx.lineWidth = 0.7; rrect(ctx, tx + 0.4, y - 12.6, tw - 0.8, 10.2, 4); ctx.stroke();
    text(s, tx + tw / 2, y - 7.3, '#ffe9c8', 6);
  }
}
function keyGem(label, x, y) {
  const w = Math.max(9, textW(label, 6) + 4);
  ctx.fillStyle = '#302014'; rrect(ctx, x - 1, y - 4, w, 8, 2); ctx.fill();
  ctx.strokeStyle = '#e0a63a'; ctx.lineWidth = 0.6; rrect(ctx, x - 0.7, y - 3.7, w - 0.6, 7.4, 2); ctx.stroke();
  text(label, x - 1 + w / 2, y + 0.2, '#ffe9c8', 6);
}

// THE SPIRIT CANNON'S WORDS: while it charges, the words live at the top of the screen and everything about them climbs.
// Each stage slams in, the letters spread and tremble harder, the colour heats from ice to gold to white, a light swells
// behind them, sparks start to fly, and the multiplier under them counts up as you hold.
function cannonLetters(str, size, col, gap, shake, now) {
  const cols = shadeOf(col), ch = [...str], wd = ch.map(c => textW(c, size)), tw = wd.reduce((a, b) => a + b, 0) + gap * (ch.length - 1); let cx = -tw / 2;
  ch.forEach((c, i) => { if (c !== ' ') drawPix(pixText(c, fontPx(size), 700, cols, 'rgba(16,10,6,0.95)'), cx + wd[i] / 2 + Math.sin(now / 37 + i * 2.1) * shake, Math.cos(now / 29 + i * 1.3) * shake, 'center'); cx += wd[i] + gap; });
  return tw;
}
// a dark ribbon behind the words, fading out at both ends, so they read on any ground
function cannonBand(x, y, hw, a) {
  const G = ctx.createLinearGradient(x - hw, 0, x + hw, 0); G.addColorStop(0, 'rgba(8,6,16,0)'); G.addColorStop(0.18, `rgba(8,6,16,${a})`); G.addColorStop(0.82, `rgba(8,6,16,${a})`); G.addColorStop(1, 'rgba(8,6,16,0)');
  ctx.fillStyle = G; ctx.fillRect(x - hw, y - 11, hw * 2, 50);
}
function cannonGlow(x, y, rx, col, a) {
  const [r, g, b] = cssRgba(col), G = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
  G.addColorStop(0, `rgba(${r},${g},${b},${a})`); G.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, 0.22); ctx.fillStyle = G; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
// THE LAST STAGE, drawn like an anime's finishing move: speed lines rush in from the screen's edges, the name is cut in
// huge kanji behind the words in crimson, and the words themselves lean forward with a red ghost behind them.
function animeLines(now, a) {
  const cx = VW / 2, cy = VH / 2, R = Math.hypot(cx, cy) + 20, r = rng(Math.floor(now / 45));
  ctx.save(); ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (let i = 0; i < 46; i++) {
    const an = r() * Math.PI * 2, wd = 0.006 + r() * 0.016, inner = 150 + r() * 90;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * inner, cy + Math.sin(an) * inner * 0.62); ctx.lineTo(cx + Math.cos(an - wd) * R, cy + Math.sin(an - wd) * R); ctx.lineTo(cx + Math.cos(an + wd) * R, cy + Math.sin(an + wd) * R); ctx.fill();
  }
  ctx.restore();
}
function animeTitle(kanji, str, x, y, col, slam, shake, now, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.transform(1, 0, -0.2, 1, 0, 0);   // leaning into the blow
  const sc = 1 + 0.9 * slam; ctx.scale(sc, sc);
  const jx = Math.sin(now / 31) * shake, jy = Math.cos(now / 23) * shake;
  drawPix(pixText(kanji, fontPx(34), 700, shadeOf('#d81030'), '#ffffff'), jx, jy - 12, 'center');   // the kanji, above the words
  ctx.translate(0, 14);
  ctx.save(); ctx.globalAlpha = alpha * 0.8; ctx.translate(2.5, 1.5); cannonLetters(str, 11, '#ff2a3a', 1.4, shake * 0.5, now + 90); ctx.restore();   // a red ghost
  cannonLetters(str, 11, col, 1.4, shake * 0.5, now); ctx.restore();
}
function drawCannonWords(w, now) {
  const c = w && w.player && w.player.cannonCharge; if (!c) return;
  const W = c.bomb ? KIB.words : CANNON_WORDS, k = Math.min(1, c.t / (c.bomb ? KIB.max : CANNON.max)), st = c.over ? KIB.absorbWord : W.filter(s => c.t >= s.at).pop(), since = (c.over || 0) + c.t - st.at, slam = Math.max(0, 1 - since / 170), x = VW / 2, y = c.bomb ? 256 : 84;   // (the Ki Bomb's sphere fills the top of the screen)
  const last = c.over || st === W[W.length - 1];
  if (last) animeLines(now, 0.5);
  cannonBand(x, y, 150 + 40 * k, 0.72);
  cannonGlow(x, y, 90 + 170 * k, st.col, (0.14 + 0.26 * k) * (0.8 + 0.2 * Math.sin(now / 55)));
  if (last) animeTitle(c.over ? '吸収' : c.bomb ? '最大' : '限界突破', st.s, x, y + 2, '#ffffff', slam, 1.3, now);
  else { ctx.save(); ctx.translate(x, y); const sc = (0.95 + 0.3 * k) * (1 + 0.75 * slam); ctx.scale(sc, sc); cannonLetters(st.s, 9, slam > 0.5 ? '#ffffff' : st.col, 0.5 + 1.2 * k, k * k * 0.9, now); ctx.restore(); }
  if (k > 0.33) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = st.col; ctx.lineWidth = 0.8;   // sparks off the words
    for (let i = 0; i < Math.round(k * 7); i++) { const sx = x + rand(-110, 110) * k - 0, sy = y + rand(-11, 11); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + rand(-7, 7), sy + rand(-6, 6)); ctx.stroke(); } ctx.restore(); }
  const bw = 120, bx = x - bw / 2, by = y + (last ? 28 : 13);   // the gauge and the multiplier counting up
  ctx.fillStyle = 'rgba(8,6,16,0.8)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5); ctx.fillStyle = st.col; ctx.fillRect(bx, by, bw * k, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (const at of c.bomb ? W.slice(1).map(s => s.at / KIB.max) : [1 / 3, 2 / 3]) ctx.fillRect(bx + bw * at, by - 1, 1, 5);
  ctx.save(); ctx.translate(x, by + 12); const m = 1 + 0.25 * k + 0.3 * Math.max(0, 1 - (c.t % 500) / 90) * k; ctx.scale(m, m); cannonLetters(c.bomb ? `CHARGE ${kiBombLevel(c.t)}/4` : `×${cannonMul(c.t).toFixed(1)}`, 9, st.col, 0.3, k * 0.8, now); ctx.restore();
}
// and the moment it fires: the shout slams down and shudders, harder the longer you held
function drawCannonShout(s, now) {
  const age = s.life - s.t, x = VW / 2, y = 84, slam = Math.max(0, 1 - age / 150), fade = Math.min(1, s.t / 300), pw = s.cannon;
  if (pw >= 0.95) {
    if (age < 800) animeLines(now, 0.6 * (1 - age / 800));
    cannonBand(x, y, 200, 0.72 * fade); cannonGlow(x, y, 280, '#ff5a3a', 0.45 * Math.max(0.25, 1 - age / 900) * fade);
    animeTitle(s.kanji || '霊砲', s.str, x, y + 2, s.col, slam, 1.6 * Math.max(0, 1 - age / 700), now, fade); return;
  }
  cannonBand(x, y, 190, 0.72 * fade);
  cannonGlow(x, y, 120 + 160 * pw, s.col, (0.2 + 0.3 * pw) * Math.max(0.25, 1 - age / 900) * fade);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); const sc = (1 + 0.15 * pw) * (1 + (0.6 + pw) * slam); ctx.scale(sc, sc);
  cannonLetters(s.str, 9.5, s.col, 0.5 + 0.6 * pw, (0.2 + 1 * pw) * Math.max(0, 1 - age / 700), now); ctx.restore();
}
// STILL COOLING DOWN: pressing a spell whose card is on cooldown gives that card a quick side-to-side shake (a quarter-second);
// READY AGAIN: the moment its cooldown ends, the card brightens and sends out a soft white ring
{
  const base = skillSlot;
  skillSlot = (x, y, s, card, el, now, o = {}) => {
    const k = o.pokeT ? (now - o.pokeT) / 260 : 1, rk = o.readyT ? (now - o.readyT) / 420 : 1;
    const shake = k >= 0 && k < 1;
    if (shake) { ctx.save(); ctx.translate(Math.round(Math.sin(k * Math.PI * 5) * 2 * (1 - k) * 2) / 2, 0); }
    const r = base(x, y, s, card, el, now, o);
    if (rk >= 0 && rk < 1 && card) {   // READY AGAIN: a spell that just came off cooldown brightens and sends out a soft white ring
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - rk)})`; rrect(ctx, x, y, s, s, 3); ctx.fill();
      const e = 1 + rk * 4; ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - rk)})`; ctx.lineWidth = 1.2; rrect(ctx, x - e, y - e, s + e * 2, s + e * 2, 3 + e); ctx.stroke();
      ctx.restore();
    }
    if (shake) ctx.restore();
    return r;
  };
}
// SIDE PILLS (G: Partner, X: Log, Z: Workshop, O: Sets, U: Tower, P: Tier): dark glass with a wash of the pill's colour, a
// glassy top line, its key in a little coloured badge and the name beside it; brighter under the mouse
// the Soul icon: a 9 x 10 pixel wisp (a round glowing head, a curling tail), drawn cell by cell so it stays crisp
const SOUL_PIX = ['...ooo...', '..oLLLo..', '.oLWWLLo.', '.oLWLLLo.', '.oLLLLGo.', '..oLLGo..', '...oGGo..', '....oGo..', '...oGo...', '...oo....'];
const SOUL_COL = { o: '#0a3a24', L: '#5ae0a8', W: '#ffffff', G: '#2a9a6a' };
function drawSoulWisp(x, y) { ctx.save(); SOUL_PIX.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = SOUL_COL[row[i]]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } }); ctx.restore(); }
function hudPill(P, col, label, tc = '#f0ecff', ty = P.y + P.h / 2 + 0.4) {
  const hov = mouse.x >= P.x && mouse.x < P.x + P.w && mouse.y >= P.y && mouse.y < P.y + P.h, r = Math.min(5, P.h / 2);
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, hov ? 'rgba(84,56,36,0.94)' : 'rgba(62,40,24,0.9)'); g.addColorStop(1, 'rgba(26,15,9,0.92)');   // (warm cocoa, like the message pills)
  ctx.fillStyle = g; rrect(ctx, P.x, P.y, P.w, P.h, r); ctx.fill();
  const wg = ctx.createLinearGradient(P.x, 0, P.x + P.w, 0); wg.addColorStop(0, hexA(col, hov ? 0.3 : 0.18)); wg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = wg; rrect(ctx, P.x, P.y, P.w, P.h, r); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(P.x + r, P.y + 1, P.w - r * 2, 0.8);
  ctx.strokeStyle = hexA(col, hov ? 1 : 0.75); ctx.lineWidth = 0.9; rrect(ctx, P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1, r); ctx.stroke();
  const m = /^(\w+): (.*)$/.exec(label);
  if (!m) { text(label, P.x + P.w / 2, ty, tc, 7); return; }
  const b = P.h - 5, bx = P.x + 3, by = P.y + 2.5;
  // the key: a dark cap ringed in the pill's colour, its letter bright (dark letters on the coloured cap were hard to read)
  ctx.fillStyle = 'rgba(12,7,18,0.95)'; rrect(ctx, bx, by, b, b, 2.5); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; rrect(ctx, bx + 0.5, by + 0.5, b - 1, b - 1, 2.5); ctx.stroke();
  text(m[1], bx + b / 2, by + b / 2 + 0.4, '#ffffff', 6.5);
  text(m[2], bx + b + 3 + (P.x + P.w - bx - b - 3) / 2 - 1, ty, tc, 7);
}
// NAME TAGS IN THE WORLD (townsfolk, waystones): a soft dark pill behind the words so they read over grass, paths and water.
// lines: [[text, colour, size], ...] stacked downward from y (the first line's middle), one pill behind them all
// NO PILE-UPS (2026-11-20, the user: "make sure nothing overlaps"): townsfolk standing close had their names drawn over each other
// (Duskhollow's square). Each frame remembers the tags already drawn; a tag that would cover one moves up, clear of it.
const WTAG = { rects: [], tries: 4 };
(function wtagFrame() { WTAG.rects.length = 0; requestAnimationFrame(wtagFrame); })();
function worldTag(lines, x, y) {
  let w = 0, h = 0; for (const [s, , z] of lines) { w = Math.max(w, textW(s, z)); h += z + 2; }
  for (let k = 0; k < WTAG.tries; k++) {
    const t0 = y - lines[0][2] / 2 - 2.5, hit = WTAG.rects.find(r => x - w / 2 - 5 < r.x + r.w && x + w / 2 + 5 > r.x && t0 < r.y + r.h && t0 + h + 3 > r.y);
    if (!hit) break; y -= t0 + h + 3 - hit.y + 1;
  }
  WTAG.rects.push({ x: x - w / 2 - 5, y: y - lines[0][2] / 2 - 2.5, w: w + 10, h: h + 3 });
  const top = y - lines[0][2] / 2 - 2.5; ctx.fillStyle = 'rgba(46,28,18,0.48)'; rrect(ctx, x - w / 2 - 5, top, w + 10, h + 3, Math.min(5, (h + 3) / 2)); ctx.fill();
  let ty = y; for (const [s, c, z] of lines) { text(s, x, ty, c, z); ty += z + 2; }
}
// THE HINT STRIP at the foot of the screen: 'Tab: inventory · Enter: talk' drawn as little gold-edged keycaps with their action
// beside them, all on one soft pill
function keyHints(str, y, col = '#e8e2cf') {
  if (typeof tr === 'function') str = tr(String(str));   // (LANGUAGE: the whole hint is translated, then cut into keycaps)
  const segs = str.split(' · ').map(s => { const m = /^([^:]{1,12}): (.*)$/.exec(s); return m ? { k: m[1], a: m[2] } : { k: null, a: s }; });
  const KS = 6.3, AS = 7.2, kw = k => textW(k, KS) + 7, sw = s => (s.k ? kw(s.k) + 3 : 0) + textW(s.a, AS), gap = 11;
  const W = segs.reduce((t, s) => t + sw(s), 0) + gap * (segs.length - 1) + 16, x0 = VW / 2 - W / 2, H = 14;
  ctx.fillStyle = 'rgba(46,28,18,0.58)'; rrect(ctx, x0, y - H / 2, W, H, 7); ctx.fill();   // (warm cocoa, like the message pills)
  let x = x0 + 8;
  segs.forEach((s, i) => {
    if (s.k) {
      const w = kw(s.k), ky = y - 5;
      const g = ctx.createLinearGradient(0, ky, 0, ky + 10); g.addColorStop(0, 'rgba(104,70,44,0.98)'); g.addColorStop(1, 'rgba(54,34,20,0.98)');   // (a warm wooden keycap)
      ctx.fillStyle = g; rrect(ctx, x, ky, w, 10, 2.5); ctx.fill();
      ctx.strokeStyle = 'rgba(232,190,100,0.75)'; ctx.lineWidth = 0.6; rrect(ctx, x + 0.3, ky + 0.3, w - 0.6, 9.4, 2.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 1.5, ky + 1, w - 3, 0.7);
      text(s.k, x + w / 2, y + 0.3, '#ffe9a8', KS); if (typeof tapHint === 'function' && !(window.GAME && GAME.menu)) tapHint(s.k, x, ky, w, 10); x += w + 3;
    }
    text(s.a, x, y + 0.3, col, AS, 'left'); x += textW(s.a, AS);
    if (i < segs.length - 1) { ctx.fillStyle = 'rgba(232,190,100,0.5)'; ctx.fillRect(Math.round(x + gap / 2 - 0.5), Math.round(y - 0.5), 1.2, 1.2); x += gap; }
  });
}
// PROMPTS IN THE WORLD ('Enter: Campfire', '▲ Enter' at a door, 'Enter: Travel'…): every small centred prompt that starts with
// Enter, drawn while walking about (no menu open), becomes a little bubble: a gold-edged Enter keycap and what it does, on a
// soft pill that bobs gently. Text everywhere else is untouched.
{
  const t0 = text;
  function promptBubble(str, x, y, col, size) {
    const rest = str.replace(/^▲ ?/, '').replace(/^Enter:? ?/, ''), KS = 6, AS = Math.min(7, size), kw = textW('Enter', KS) + 7, aw = rest ? textW(rest, AS) + 4 : 0;
    const W = kw + aw + 8, H = 13, bob = Math.sin(performance.now() / 380) * 0.8, x0 = Math.round(x - W / 2), yy = y + bob;
    const c = typeof col === 'string' && col[0] === '#' ? col : '#ffffff';
    ctx.fillStyle = 'rgba(46,28,18,0.62)'; rrect(ctx, x0, yy - H / 2, W, H, 6.5); ctx.fill();   // (warm cocoa)
    const kx = x0 + 4, ky = yy - 5, g = ctx.createLinearGradient(0, ky, 0, ky + 10); g.addColorStop(0, 'rgba(110,74,46,0.98)'); g.addColorStop(1, 'rgba(56,36,22,0.98)');
    ctx.fillStyle = g; rrect(ctx, kx, ky, kw, 10, 2.5); ctx.fill();
    ctx.strokeStyle = 'rgba(232,190,100,0.85)'; ctx.lineWidth = 0.6; rrect(ctx, kx + 0.3, ky + 0.3, kw - 0.6, 9.4, 2.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(kx + 1.5, ky + 1, kw - 3, 0.7);
    t0('Enter', kx + kw / 2, yy + 0.3, '#ffe9a8', KS);
    if (rest) t0(rest, kx + kw + 4, yy + 0.3, c, AS, 'left');
    if (/^▲/.test(str)) { ctx.fillStyle = 'rgba(255,233,168,0.9)'; ctx.beginPath(); ctx.moveTo(x, yy - H / 2 - 4); ctx.lineTo(x - 3, yy - H / 2 - 1); ctx.lineTo(x + 3, yy - H / 2 - 1); ctx.closePath(); ctx.fill(); }   // (a door: a little arrow up)
  }
  // drawn last: while the world draws, prompts wait in PQ with their place on screen, and go on top once everything else
  // (people, trees, night) is down, so nothing can cover them (an NPC used to hide 'fill watering can')
  let PQ = null;
  text = function (str, x, y, col, size = 10, align = 'center', bold) {
    if (typeof str === 'string' && size <= 7.5 && align === 'center' && /^(▲ ?)?Enter(:|$)/.test(str) && window.GAME && GAME.scene === 'world' && !GAME.menu) {
      if (PQ) { PQ.push([str, x, y, col, size, ctx.getTransform(), ctx.globalAlpha]); return; }
      return promptBubble(str, x, y, col, size);
    }
    return t0.apply(this, arguments);
  };
  const dw = drawWorld;
  drawWorld = (...a) => {
    const outer = PQ; PQ = [];
    try { return dw(...a); } finally {
      const q = PQ; PQ = outer;
      for (const [str, x, y, col, size, T, al] of q) { ctx.save(); ctx.setTransform(T); ctx.globalAlpha = al; try { promptBubble(str, x, y, col, size); } catch (e) {} ctx.restore(); }
    }
  };
}
