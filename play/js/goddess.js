'use strict';
// THE GODDESS MERCHANT AND HER SANCTUARY (2026-11-15, the user: "lets work on the middle zone aka zone 5 goddess merchant"; chose
// all four: a real goddess figure, a sanctuary area, a proper shop screen, more to buy; and Seraphine's sprite tinted per goddess).
// At each goddess stop (areas 5 and 10 of every zone, travelpoints.js):
//   FIGURE     Seraphine (villager sprite z081, the winged lady in white and gold) stands where the crystal shrine was, recoloured to
//              her goddess (Haru pink, Natsu gold, Aki crimson, Fuyu ice…; Hikari keeps her own white and gold), in a soft glow, a
//              ring of flowers round her feet.
//   SANCTUARY  her whole area is a calm stop: no monster appears there, and one that wanders in turns back at its edge (one placed
//              there by anything else, an area's mini boss, fades away); near her you mend slowly (SANCT.heal of HP and MP a second).
//              Walking in says so once.
//   SHOP       her own screen: her portrait and a word from her on the left; on the right HER WEAPON (shown big, with what it adds
//              or takes against the weapon you carry) and TODAY'S GIFTS: three things that change every day — a blessing that lasts
//              for good (a little of one stat, pr.perm, the same store as the travellers' blessings), a card of the zone's best
//              rank, and potions or summon coins. Each gift once a day.
const GODDESS_ART = 'z081';
const GODDESS_HUE = [0.95, 0.13, 0.02, 0.55, 0.72, 0.88, 0.58, 0.16, null, 0.78, 0.5, 0.66];   // (by GODDESSES index; null: her own colours)
const GODDESS_BLESS = [['hp', 12, 'max HP'], ['atk', 1, 'attack'], ['crit', 0.5, '% critical'], ['def', 1, 'defence'], ['mp', 10, 'max MP'], ['hp', 12, 'max HP'],
  ['spd', 1, 'speed'], ['atk', 1, 'attack'], ['def', 1, 'defence'], ['crit', 0.5, '% critical'], ['mp', 10, 'max MP'], ['atk', 1, 'attack']];
const GODDESS_LINES = ['Rest here a while. Nothing hunts in my garden.', 'The road is long, little hunter. Sit, and let the wind mend you.',
  'I keep one weapon, and only one. Take it, if your heart is set on the road ahead.', 'Come back tomorrow: I always have a small gift put by.',
  'Even monsters are tired, sometimes. They leave my garden be.'];
const SANCT = { heal: 0.03, r: 72, flowers: 9 };
// ---- her picture, recoloured per goddess (built once each, from the villager sprite's own sheet)
const GODDESS_BANKS = {};
function goddessBank(gi) {
  if (GODDESS_BANKS[gi]) return GODDESS_BANKS[gi];
  const B = D.npcs[GODDESS_ART]; if (!B) return null;
  const im = img(B.imgs ? B.imgs[0] : B.img); if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const hue = GODDESS_HUE[gi % GODDESS_HUE.length];
  if (hue != null) {
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const [h, s, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
      if (s <= 0.3 || (h > 7 && h < 40 && l > 0.55)) continue;   // (whites, greys and skin stay)
      const [r, gg, b] = hsl2rgb(hue * 360, Math.min(1, s * 1.05), l); px[i] = r; px[i + 1] = gg; px[i + 2] = b;
    }
    g.putImageData(d, 0, 0);
  }
  return (GODDESS_BANKS[gi] = { canvas: c, frames: B.frames, anims: B.anims });
}
function drawGoddessSprite(gi, x, y, scale, now, dir = 2) {
  const B = goddessBank(gi); if (!B) return false;
  const seq = (B.anims.idle && (B.anims.idle[dir] || B.anims.idle.find(s => s && s.length))) || [], e = seqFrame(seq, now, true); if (!e) return false;
  const r = B.frames[e[0]]; if (!r) return false;
  ctx.drawImage(B.canvas, r[0], r[1], r[2], r[3], Math.round(x + (r[4] + (e[2] || 0)) * scale), Math.round(y + (r[5] + (e[3] || 0)) * scale), r[2] * scale, r[3] * scale);
  return true;
}
// ---- the garden: flowers on open ground round her (worked out once per stop)
function goddessGarden(w, S) {
  if (S.garden) return S.garden;
  const r = rng(WORLD_SEED * 5 + S.z * 97 + S.k * 13), out = [];
  for (let i = 0; i < SANCT.flowers * 4 && out.length < SANCT.flowers; i++) {
    const a = (out.length / SANCT.flowers) * Math.PI * 2 + r() * 0.5, d = 26 + r() * 18, x = S.gx + Math.cos(a) * d, y = S.gy + Math.sin(a) * d * 0.6;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || Math.hypot(x - S.x, y - S.y) < 24) continue;
    out.push({ x: Math.round(x), y: Math.round(y), fi: Math.floor(r() * 3) });
  }
  return (S.garden = out);
}
function goddessDrawItems(w, S, now, items) {
  const G = GODDESSES[S.gi], p = w.player, oimg = img(D.objects.img);
  for (const f of goddessGarden(w, S)) items.push({ y: f.y, draw: () => { const rec = objRec('066', f.fi); if (rec && oimg) ctx.drawImage(oimg, rec[0], rec[1], rec[2], rec[3], f.x + rec[4], f.y + rec[5], rec[2], rec[3]); } });
  items.push({ y: S.gy, draw: () => {
    const hueCol = GODDESS_HUE[S.gi] == null ? '255,236,170' : (() => { const [r, g, b] = hsl2rgb(GODDESS_HUE[S.gi] * 360, 0.8, 0.82).map(Math.round); return `${r},${g},${b}`; })();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(S.gx, S.gy - 14, 2, S.gx, S.gy - 14, 34); gl.addColorStop(0, `rgba(${hueCol},${0.32 + 0.06 * Math.sin(now / 700)})`); gl.addColorStop(1, `rgba(${hueCol},0)`);
    ctx.fillStyle = gl; ctx.fillRect(S.gx - 36, S.gy - 50, 72, 72); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(S.gx, S.gy + 1, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (!drawGoddessSprite(S.gi, S.gx, S.gy + Math.sin(now / 800) * 1.2 - 1, 1, now)) drawWaystone(S.gx, S.gy, '#ffb8e0', true, now, 'SHRINE', '');
    worldTag([[G[0], '#ffffff', 7.5], [G[1], `rgb(${hueCol})`, 7]], S.gx, S.gy - 46);   // (7 px and up: readable)
    if (tpGoddessNear(w, S)) text('Enter: talk to her', S.gx, S.gy + 12, '#ffe9a8', 7);
  } });
}
// ---- the sanctuary
let SANCT_KEYS = null, SANCT_SEED = null;
function sanctuaryKeys() {
  if (SANCT_KEYS && SANCT_SEED === WORLD_SEED) return SANCT_KEYS;   // (a new world has new areas)
  SANCT_SEED = WORLD_SEED; SANCT_KEYS = new Map(); ZONES.forEach((Z, z) => TP.at.forEach((k, j) => { const R = stopArea(z, k); if (R) SANCT_KEYS.set(R.key, { R, gi: (z * TP.at.length + j) % GODDESSES.length }); }));
  return SANCT_KEYS;
}
// the sanctuary at (x, y), if any: her own area only, not the side areas above and below it
// (a goddess town, worldgen.js, is safe from top to bottom: its side areas above and below too, 2026-11-19)
const sanctAt = (x, y) => { const R = REGIONS[regionIndexAt(x)], s = R && sanctuaryKeys().get(R.key); return s && ((typeof isGoddessTown === 'function' && isGoddessTown(R)) || (y >= R.oy * T && y < (R.oy + R.h) * T)) ? s : null; };
function sanctTick(game, w, dt) {
  if (!w.overworld || w.interior) return;
  const p = w.player, here = sanctAt(p.x, p.y);
  if (here && w.sanctIn !== here.R.key) { const G = GODDESSES[here.gi]; game.toast(`${G[0]}'s Sanctuary — no monster crosses here. Rest a while.`, '#ffc8e8'); }
  w.sanctIn = here ? here.R.key : null;
  for (const m of w.actors) {
    if (m.kind !== 'monster' || m.dead || m.ally || m.pet || m.remove) continue;
    const s = Math.abs(m.x - p.x) < 900 && sanctAt(m.x, m.y); if (!s) continue;
    // (2026-11-19, the user: "enemies still spawn in zone 5 and attack": a monster inside used to fade for 0.6 s, still attacking, and one at
    // the edge was only nudged back, slower than it chased. Now monsters can't step in at all (goddesstown.js), and one found inside by any
    // other way goes at once, with a puff.)
    m.remove = true; m.dead = true; if (w.rings) w.rings.push({ x: m.x, y: m.y - 8, r: 18, t: 0, col: '#ffc8e8' });
  }
  for (const S of midStones(w)) {   // near her, you mend
    if (Math.abs(S.gx - p.x) > SANCT.r || Math.hypot(S.gx - p.x, S.gy - p.y) > SANCT.r || p.dead) continue;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * SANCT.heal * dt / 1000); if (p.maxMp) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * SANCT.heal * dt / 1000);
  }
}
// ---- her gifts of the day
function goddessGifts(pr, S) {
  const day = dayNo(), r = rng(day * 31 + S.z * 977 + S.k * 61 + 7), Z = ZONES[S.z], G = GODDESSES[S.gi], [stat, amt, label] = GODDESS_BLESS[S.gi % GODDESS_BLESS.length];
  const mobs = (Z.mobs || []).filter(id => SPECIES[id] && D.monsters[id]), sp = mobs[Math.floor(r() * mobs.length)], tier = Math.min(9, Z.ranks[1]);
  const out = [{ kind: 'bless', stat, amt, name: `Blessing of ${G[0]}`, desc: `+${amt}${label.startsWith('%') ? '' : ' '}${label}, for good`, price: 3000 * (S.z + 1) }];
  if (sp) out.push({ kind: 'card', sp, tier, name: `${SPECIES[sp].name} card`, desc: `a rank ${RANKS[tier]} card from these lands`, price: Math.round(150 * (tier + 1) ** 2) });
  const pot = typeof potionIdx === 'function' ? potionIdx(26) ?? potionIdx(11) : null;
  if (r() < 0.6 && pot != null) out.push({ kind: 'goods', idx: pot, n: 3, name: `${(Z2_ITEM[pot] || {}).name || 'Potion'} ×3`, desc: 'from her own garden', price: 3 * ((POTION_PRICE && POTION_PRICE[26]) || 40) });
  else out.push({ kind: 'coins', n: 2, name: 'Summon Coins ×2', desc: 'for the Summoning Shrine', price: 2500 });
  pr.goddessDay = pr.goddessDay && pr.goddessDay.day === day ? pr.goddessDay : { day, got: {} };
  const got = pr.goddessDay.got[S.key] || [];
  return out.map((g, i) => ({ ...g, i, bought: got.includes(i) }));
}
function goddessBuyGift(game, S, g) {
  const pr = game.profile;
  if (g.bought) { game.toast('Already yours today — she will have another tomorrow', '#c9c1a8'); return; }
  if ((pr.gold || 0) < g.price) { game.toast(`Not enough gold (${fmtG(g.price)})`, '#ff8a8a'); return; }
  pr.gold -= g.price;
  if (g.kind === 'bless') { pr.perm = pr.perm || {}; pr.perm[g.stat] = Math.round(((pr.perm[g.stat] || 0) + g.amt) * 10) / 10; game.refreshPlayer && game.refreshPlayer(); }
  else if (g.kind === 'card') { const c = makeCard(g.sp, g.tier); if (pr.cards.length < 200) pr.cards.push(c); else { pr.storage = pr.storage || { cards: [], gear: [] }; pr.storage.cards.push(c); } }
  else if (g.kind === 'goods') { pr.goods = pr.goods || {}; pr.goods[g.idx] = (pr.goods[g.idx] || 0) + g.n; }
  else if (g.kind === 'coins') pr.coins = (pr.coins || 0) + g.n;
  const got = pr.goddessDay.got[S.key] = pr.goddessDay.got[S.key] || []; got.push(g.i);
  const w = game.world; if (w) w.rings.push({ x: S.gx, y: S.gy - 10, r: 30, t: 0, col: '#ffc8e8' });
  game.toast(`${GODDESSES[S.gi][0]}: "${g.kind === 'bless' ? 'Carry this always.' : 'Use it well.'}" — ${g.name}`, '#ffc8e8'); game.save();
}
updateGoddess = (game, m) => {
  const S = goddessStone(game, m); if (!S) { game.closeMenu(); return; }
  const pr = game.profile, k = navInput(), gifts = goddessGifts(pr, S); m.tab = m.tab || 0; m.cur = m.cur || 0;
  if (k.back) { game.closeMenu(); return; }
  if (hit('KeyE', 'Tab') || k.r) { m.tab = (m.tab + 1) % GD.tabs.length; m.cur = 0; }
  else if (hit('KeyQ') || k.l) { m.tab = (m.tab + GD.tabs.length - 1) % GD.tabs.length; m.cur = 0; }
  GD.tabs.forEach((_, i) => { const B = gdTab(i); if (clicked(B.x, B.y, B.w, B.h)) { m.tab = i; m.cur = 0; } });
  if (m.tab === 2) { updateFoodCardsTab(game, m, k); return; }   // (FOOD CARDS, foodcards.js; THE AEGIS tab was scrapped 2026-11-20)
  if (m.tab === 1) {
    if (k.u) m.cur = (m.cur + gifts.length - 1) % gifts.length; if (k.d) m.cur = (m.cur + 1) % gifts.length;
    gifts.forEach((_, i) => { const B = gdRow(i); if (clicked(B.x, B.y, B.w, B.h)) { if (m.cur === i) k.ok = true; m.cur = i; } });
    if (k.ok) goddessBuyGift(game, S, gifts[m.cur]);
    return;
  }
  const B = gdBuy(), e = goddessWeapon(pr, S);
  if (!(k.ok || clicked(B.x, B.y, B.w, B.h))) return;
  if (e.sold) { game.toast('She has only the one, and you carry it', '#c9c1a8'); return; }
  if ((pr.gold || 0) < e.price) { game.toast(`Not enough gold (${fmtG(e.price)})`, '#ff8a8a'); return; }
  pr.gold -= e.price; e.sold = true; pr.gear.push({ ...e.g });
  const w = game.world; if (w) w.rings.push({ x: S.gx, y: S.gy, r: 40, t: 0, col: '#ffc8e8' }, { x: S.gx, y: S.gy, r: 24, t: -120, col: '#ffffff' });
  game.toast(`${GODDESSES[S.gi][0]} gives you the ${e.g.name} — find it in your bag (Tab)`, '#ffc8e8'); game.save();
};
// ---- her screen (2026-11-19, the user: "the goddess store layout looks bad and flat"): a little shrine. A gold frame on a backdrop
// washed in her colour with petals drifting down; on the left an arched alcove of light, slow rays, her on a gold pedestal, her
// words on a scroll; on the right ribbon tabs, her weapon on a velvet cushion with chips for what it gives and what it changes,
// and her gifts as cards with round medallions and price tags.
const GD = { x: 30, y: 18, w: 580, h: 318, tabs: ['HER WEAPON', "TODAY'S GIFTS", 'FOOD CARDS'], L: 200 };
const gdX0 = () => GD.x + GD.L + 22, gdW = () => GD.w - GD.L - 36;
const gdTab = i => ({ x: gdX0() + i * (gdW() / GD.tabs.length + 2), y: GD.y + 16, w: gdW() / GD.tabs.length - 2, h: 20 });
const gdRow = i => ({ x: gdX0(), y: GD.y + 48 + i * 68, w: gdW(), h: 60 });
const gdBuy = () => ({ x: GD.x + GD.w - 124, y: GD.y + GD.h - 40, w: 104, h: 24, label: 'BUY', primary: true, col: '#ffd860' });
function gdHue(gi) { const hue = GODDESS_HUE[gi]; return hue == null ? [255, 236, 170] : hsl2rgb(hue * 360, 0.8, 0.8).map(Math.round); }
function gdPill(x, y, w, h, fill, edge) { ctx.fillStyle = fill; rrect(ctx, x, y, w, h, h / 2); ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2 - 0.5); ctx.stroke(); } }
function gdCoin(x, y, r) { const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.6, '#ffc21f'); g.addColorStop(1, '#a86a08'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#6a4006'; ctx.lineWidth = 0.8; ctx.stroke(); }
function gdPrice(xr, cy, price, can) {   // a price tag, right-aligned at xr: a coin and the gold
  const s = fmtG(price), w = textW(s, 8.5) + 26;
  gdPill(xr - w, cy - 9, w, 18, can ? 'rgba(60,36,8,0.92)' : 'rgba(40,30,24,0.9)', can ? 'rgba(255,210,63,0.75)' : 'rgba(150,120,90,0.5)');
  gdCoin(xr - w + 10, cy, 5); text(s, xr - 8, cy + 0.5, can ? '#ffe27a' : '#a08a6a', 8.5, 'right');
}
function gdArch(x, y, w, h) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); }
drawGoddess = (game, m, now) => {
  const S = goddessStone(game, m); if (!S) return;
  const pr = game.profile, G = GODDESSES[S.gi], F = GD, [hr, hg, hb] = gdHue(S.gi), hc = `${hr},${hg},${hb}`, tab = m.tab || 0;
  ctx.fillStyle = 'rgba(6,4,3,0.74)'; ctx.fillRect(0, 0, VW, VH);
  // the window: her colour washed down a deep cocoa, a soft vignette, petals drifting through, the gold frame
  const bgG = ctx.createLinearGradient(0, F.y, 0, F.y + F.h); bgG.addColorStop(0, `rgba(${Math.round(hr * 0.22)},${Math.round(hg * 0.16)},${Math.round(hb * 0.2)},1)`); bgG.addColorStop(0.55, '#21150e'); bgG.addColorStop(1, '#160e09');
  kFrame(F.x, F.y, F.w, F.h, { fill: '#1c120c' });
  ctx.save(); ctx.beginPath(); ctx.rect(F.x + 6, F.y + 6, F.w - 12, F.h - 12); ctx.clip();
  ctx.fillStyle = bgG; ctx.fillRect(F.x + 6, F.y + 6, F.w - 12, F.h - 12);
  const vg = ctx.createRadialGradient(F.x + F.w / 2, F.y + F.h / 2, F.h * 0.3, F.x + F.w / 2, F.y + F.h / 2, F.w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(F.x, F.y, F.w, F.h);
  for (let k = 0; k < 16; k++) {   // petals: slow, few, faint
    const sp = 0.012 + (k % 4) * 0.004, px = F.x + ((k * 137 + now * sp * 0.6 + Math.sin(now / 1400 + k) * 18) % F.w + F.w) % F.w, py = F.y + ((k * 71 + now * sp) % F.h);
    ctx.save(); ctx.translate(px, py); ctx.rotate(now / 900 + k); ctx.globalAlpha = 0.28 + 0.12 * Math.sin(now / 700 + k); ctx.fillStyle = `rgb(${hc})`; ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // LEFT: the alcove
  const ax = F.x + 18, ay = F.y + 50, aw = F.L - 16, ah = 178, cx = ax + aw / 2;
  ctx.save(); gdArch(ax, ay, aw, ah); ctx.clip();
  const al = ctx.createLinearGradient(0, ay, 0, ay + ah); al.addColorStop(0, `rgba(${hc},0.30)`); al.addColorStop(1, 'rgba(20,12,8,0.6)'); ctx.fillStyle = al; ctx.fillRect(ax, ay, aw, ah);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) {   // slow rays from behind her
    const a = now / 9000 + i * Math.PI / 5, ox = cx, oy = ay + 86;
    ctx.fillStyle = `rgba(${hc},0.07)`; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, 150, a, a + 0.16); ctx.closePath(); ctx.fill();
  }
  const halo = ctx.createRadialGradient(cx, ay + 82, 4, cx, ay + 82, 70); halo.addColorStop(0, `rgba(${hc},0.55)`); halo.addColorStop(1, `rgba(${hc},0)`); ctx.fillStyle = halo; ctx.fillRect(ax, ay, aw, ah);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,224,138,0.75)'; ctx.lineWidth = 1.4; gdArch(ax + 0.5, ay + 0.5, aw - 1, ah - 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,224,138,0.25)'; ctx.lineWidth = 1; gdArch(ax + 4, ay + 4, aw - 8, ah - 8); ctx.stroke();
  const py0 = ay + ah - 30;
  // (no pedestal and no glow disc under her: the user had both taken away, 2026-11-19; she stands in the alcove's light)
  ctx.imageSmoothingEnabled = false; drawGoddessSprite(S.gi, cx, py0 + 6 + Math.sin(now / 900) * 1.5, 3, now);
  // her name and title above the alcove, her gold below the tabs' row
  goldTitle(G[0].toUpperCase(), cx, F.y + 22, 14, now); text(G[1], cx, F.y + 38, `rgb(${hc})`, 8);
  // her words on a scroll
  const qy = ay + ah + 8, qh = F.y + F.h - 16 - qy;
  const sg = ctx.createLinearGradient(0, qy, 0, qy + qh); sg.addColorStop(0, '#f3e2bd'); sg.addColorStop(1, '#d9c193'); ctx.fillStyle = sg; rrect(ctx, ax - 4, qy, aw + 8, qh, 5); ctx.fill();
  ctx.fillStyle = '#a8803e'; for (const sx of [ax - 7, ax + aw + 1]) { rrect(ctx, sx, qy - 2, 6, qh + 4, 3); ctx.fill(); }
  const line = GODDESS_LINES[(S.gi + Math.floor(now / 9000)) % GODDESS_LINES.length], ql = wrap(`"${line}"`, aw - 12, 9).slice(0, 4);
  // (ink on paper: outlined in the paper's own colour, not the usual dark edge, which smudged the letters)
  ql.forEach((s, i) => drawPix(pixText(s, fontPx(9), 700, shadeOf('#2e1604'), 'rgba(246,232,200,0.95)'), cx, qy + qh / 2 - (ql.length - 1) * 6.5 + i * 13, 'center'));   // (9 px, near-black ink: the user found 7.5 hard to read)
  // RIGHT: ribbon tabs, the gold you have
  const x0 = gdX0(), W = gdW();
  GD.tabs.forEach((t, i) => { const B = gdTab(i), on = tab === i, tg = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
    tg.addColorStop(0, on ? '#ffd860' : '#4a3220'); tg.addColorStop(1, on ? '#b8740f' : '#2e1e12'); ctx.fillStyle = tg; rrect(ctx, B.x, B.y, B.w, B.h, 5); ctx.fill();
    ctx.strokeStyle = on ? '#fff0b8' : 'rgba(201,168,90,0.55)'; ctx.lineWidth = 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 5); ctx.stroke();
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,236,170,${0.10 + 0.06 * Math.sin(now / 500)})`; rrect(ctx, B.x, B.y, B.w, B.h, 5); ctx.fill(); ctx.restore(); }
    text(t, B.x + B.w / 2, B.y + B.h / 2 + 0.5, on ? '#ffffff' : '#ffe9a8', 8.5); });
  if (tab !== 2) { const s = fmtG(pr.gold || 0), w = textW(s, 8) + 26; gdPill(F.x + F.w - 16 - w, F.y + F.h - 72, w, 16, 'rgba(0,0,0,0.35)', 'rgba(255,210,63,0.4)'); gdCoin(F.x + F.w - 16 - w + 9, F.y + F.h - 64, 4.5); text(s, F.x + F.w - 24, F.y + F.h - 63.5, '#ffd23f', 8, 'right'); text('your gold', F.x + F.w - 22 - w, F.y + F.h - 63.5, '#a8987a', 7, 'right'); }
  if (tab === 0) {
    const e = goddessWeapon(pr, S), g = e.g, y0 = F.y + 46, stats = gearLines(g).filter(q => !q.startsWith('✧')), rc = rankColor(g.tier, now);
    // the display: a velvet cushion in her colour, light turning behind the weapon
    const dw = 104, dh = 112, dx = x0, dy = y0;
    const vel = ctx.createLinearGradient(0, dy, 0, dy + dh); vel.addColorStop(0, `rgba(${Math.round(hr * 0.45)},${Math.round(hg * 0.3)},${Math.round(hb * 0.4)},1)`); vel.addColorStop(1, '#1a0f0a');
    ctx.fillStyle = vel; rrect(ctx, dx, dy, dw, dh, 8); ctx.fill(); ctx.strokeStyle = 'rgba(255,224,138,0.6)'; ctx.lineWidth = 1.2; rrect(ctx, dx + 0.5, dy + 0.5, dw - 1, dh - 1, 8); ctx.stroke();
    ctx.save(); ctx.beginPath(); rrect(ctx, dx + 1, dy + 1, dw - 2, dh - 2, 7); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const a = now / 6000 + i * Math.PI / 4; ctx.fillStyle = hexA(rc, 0.08); ctx.beginPath(); ctx.moveTo(dx + dw / 2, dy + 50); ctx.arc(dx + dw / 2, dy + 50, 90, a, a + 0.22); ctx.closePath(); ctx.fill(); }
    const ig = ctx.createRadialGradient(dx + dw / 2, dy + 50, 2, dx + dw / 2, dy + 50, 40); ig.addColorStop(0, hexA(rc, 0.45)); ig.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ig; ctx.fillRect(dx, dy, dw, dh); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(dx + dw / 2, dy + 78, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
    iconCentered('items', g.icon, dx + dw / 2, dy + 50 + Math.sin(now / 1000) * 2, 52);
    gdPill(dx + dw / 2 - 26, dy + dh - 24, 52, 16, hexA(rc, 0.25), hexA(rc, 0.9)); text(`RANK ${RANKS[g.tier]}`, dx + dw / 2, dy + dh - 15.5, '#ffffff', 7.5);
    // its name and what it gives, as chips
    const tx = dx + dw + 12, tw = W - dw - 12;
    const nl = wrap(g.name, tw, 11); nl.slice(0, 2).forEach((s, i) => text(s, tx, y0 + 12 + i * 14, rc, 11, 'left'));
    let ty = y0 + 12 + Math.min(2, nl.length) * 14; text('one of a kind · made for you', tx, ty, '#c9b89a', 7.5, 'left'); ty += 12;
    const lines = []; stats.forEach(q => wrap(q, tw - 12, 8).forEach(l => lines.push(l)));
    lines.slice(0, 5).forEach((l, i) => { const yy = ty + i * 15; ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, tx, yy - 6, tw, 13, 4); ctx.fill(); ctx.fillStyle = hexA(rc, 0.9); ctx.fillRect(tx, yy - 6, 2, 13); text(l, tx + 8, yy + 0.5, '#f4ead8', 8, 'left'); });
    // against the weapon you carry: a chip per stat, green up, red down
    const cy = y0 + dh + 12, cur = (pr.gear || []).find(q => q.uid === (pr.eq || {}).weapon), diffs = [];
    for (const k of new Set([...Object.keys(g.stats || {}), ...Object.keys((cur && cur.stats) || {})])) { const d = ((g.stats || {})[k] || 0) - ((cur && cur.stats || {})[k] || 0); if (d) diffs.push([k, d]); }
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, x0, cy, W, 44, 6); ctx.fill(); ctx.strokeStyle = 'rgba(201,168,90,0.35)'; ctx.lineWidth = 1; rrect(ctx, x0 + 0.5, cy + 0.5, W - 1, 43, 6); ctx.stroke();
    text(cur ? `Compared with your ${cur.name}` : 'You carry no weapon now', x0 + 10, cy + 11, '#c9b89a', 7.5, 'left');
    const cw = Math.min(76, (W - 20 - 6 * 3) / 4);
    diffs.slice(0, 4).forEach(([k, d], i) => { const up = d > 0, bx = x0 + 10 + i * (cw + 6), by = cy + 20;
      gdPill(bx, by, cw, 17, up ? 'rgba(40,110,60,0.55)' : 'rgba(130,40,36,0.55)', up ? 'rgba(143,255,176,0.7)' : 'rgba(255,154,138,0.7)');
      ctx.fillStyle = up ? '#8fffb0' : '#ff9a8a'; ctx.beginPath(); const ax2 = bx + 9, ay2 = by + 8.5; if (up) { ctx.moveTo(ax2 - 3.5, ay2 + 2.5); ctx.lineTo(ax2 + 3.5, ay2 + 2.5); ctx.lineTo(ax2, ay2 - 3); } else { ctx.moveTo(ax2 - 3.5, ay2 - 2.5); ctx.lineTo(ax2 + 3.5, ay2 - 2.5); ctx.lineTo(ax2, ay2 + 3); } ctx.closePath(); ctx.fill();
      text(`${k.toUpperCase()} ${up ? '+' : ''}${Math.round(d * 10) / 10}`, bx + cw / 2 + 5, by + 9, '#ffffff', 7.5); });
    if (!diffs.length) text('the same as yours', x0 + W / 2, cy + 29, '#c9b89a', 7.5);
    const B = gdBuy();
    if (e.sold) text('It is yours — there is no other like it', B.x + B.w, B.y + 12, '#8fffd0', 8, 'right');
    else { gdPrice(B.x - 8, B.y + 12, e.price, (pr.gold || 0) >= e.price); popupButton(B, now); text('BUY', B.x + B.w / 2, B.y + B.h / 2 + 0.5, '#ffffff', 8.5); }
  } else if (tab === 2) drawFoodCardsTab(game, m, now);
  else {
    goddessGifts(pr, S).forEach((g, i) => {
      const B = gdRow(i), sel = (m.cur || 0) === i, can = (pr.gold || 0) >= g.price;
      const rg = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); rg.addColorStop(0, sel ? `rgba(${hc},0.22)` : 'rgba(255,255,255,0.07)'); rg.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = rg; rrect(ctx, B.x, B.y, B.w, B.h, 8); ctx.fill();
      ctx.strokeStyle = sel ? '#ffd860' : 'rgba(201,168,90,0.35)'; ctx.lineWidth = sel ? 1.4 : 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 8); ctx.stroke();
      if (sel) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,216,96,${0.05 + 0.04 * Math.sin(now / 450)})`; rrect(ctx, B.x, B.y, B.w, B.h, 8); ctx.fill(); ctx.restore(); }
      // the medallion
      const ix = B.x + 32, iy = B.y + B.h / 2, mg = ctx.createRadialGradient(ix - 6, iy - 6, 2, ix, iy, 22);
      mg.addColorStop(0, `rgba(${hc},0.55)`); mg.addColorStop(1, 'rgba(30,18,10,0.95)'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(ix, iy, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e0b860'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(ix, iy, 18.5, 0, Math.PI * 2); ctx.stroke();
      if (g.kind === 'bless') text('✦', ix, iy + 1, '#ffffff', 20);
      else if (g.kind === 'card') drawCardBack(ix - 10, iy - 14, 20, 28, now);
      else if (g.kind === 'goods') iconCentered('items', ITEM2_BASE + g.idx, ix, iy, 30);
      else { gdCoin(ix - 4, iy + 3, 8); gdCoin(ix + 4, iy - 3, 8); }
      text(g.name, B.x + 64, B.y + 21, g.bought ? '#8a7a62' : '#ffffff', 9.5, 'left'); text(g.desc, B.x + 64, B.y + 38, '#c9b89a', 7.5, 'left');
      if (g.bought) { ctx.save(); ctx.translate(B.x + B.w - 46, B.y + B.h / 2); ctx.rotate(-0.12); ctx.strokeStyle = '#8fffd0'; ctx.lineWidth = 1.4; rrect(ctx, -32, -10, 64, 20, 4); ctx.stroke(); text('BOUGHT', 0, 0.5, '#8fffd0', 8.5); ctx.restore(); }
      else gdPrice(B.x + B.w - 10, B.y + B.h / 2, g.price, can);
    });
    text('New gifts every day · each one once a day', x0 + W / 2, F.y + F.h - 24, '#a8987a', 7);
  }
  ctx.restore();
  text(['Q / E tabs · Enter buy · Esc leave', 'Q / E tabs · up / down choose · Enter buy · Esc leave', 'Q / E tabs · 1 / 2 / 3 kind · up / down choose · Enter buy (once each) · Esc leave'][tab], VW / 2, F.y + F.h + 12, '#c9b89a', 7);
};
{
  const sm = spawnMonster;
  spawnMonster = (w, zi, initial, Rforce) => {
    const m = sm(w, zi, initial, Rforce);
    if (m && sanctAt(m.x, m.y)) { const i = w.actors.indexOf(m); if (i >= 0) w.actors.splice(i, 1); return null; }   // (no monster appears in a sanctuary)
    return m;
  };
  const st = safeTick;
  safeTick = (game, w, dt) => { const r = st(game, w, dt); try { sanctTick(game, w, dt); } catch (e) { if (!sanctTick.warned) { sanctTick.warned = true; console.warn('goddess', e); } } return r; };
}

// ---- (2026-11-18, the user: "lets scrap the anime gear idea"): the anime sets, their abilities and signature moves, Soul Gear and the
// MELT CARDS tab are gone (the code is kept in _scrapped/). Old saves: an unsold goddess weapon gets its own name back; anything already
// bought stays in the bag as plain gear, and Souls stay for the Summoning Shrine.
{
  const gw = goddessWeapon;
  goddessWeapon = (pr, S) => {
    const e = gw(pr, S);
    if (e && e.g && e.g.anime != null) { delete e.g.anime; if (!e.sold) e.g.name = `${GODDESSES[S.gi][2]} ${CLASSES[pr.cls].weapon}`; }
    return e;
  };
}
