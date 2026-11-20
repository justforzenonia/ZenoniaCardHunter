'use strict';
// TOWN CROSSINGS (2026-11-19, the user: "lets work on town transition to zones it looks bad"; asked how, chose "Keep the river, dress
// it up"). Every town met its zone at the same straight river and grey stone bridge, the two lands stopping dead either side.
// Where a town (Hearthvale, an outpost town, a goddess town) meets a zone, the crossing is now dressed:
//   BRIDGE   a wooden one: a plank deck, a rail along the top, a beam and posts along the front (drawn over the stone bridge's place)
//   LAMPS    a lamp post at each end of the bridge, beside the road
//   SIGNS    a wooden signboard on each bank: on the zone's bank the town's name, on the town's bank the zone's
//   BLEND    the zone's colour (its mood tint) no longer stops in a line at the river: it fades out across the water and a few
//            tiles into the town (z2tint.js does the same for Verdant Fields' Zenonia 2 colours)
const TG = { fade: 4, plank: 6, post: 16, lampIn: 20, signIn: 46,
  wood: ['#b07a3e', '#a06c34', '#8a5a2a'], gap: '#4a2e14', beam: '#6a4220', beamTop: '#c99052', post: '#5a3818', postTop: '#b07a3e' };
const tgTownish = R => !!R && (R.zone < 0 || (typeof isGoddessTown === 'function' && isGoddessTown(R)));
let TG_LIST = null;
function townCrossings() {   // [{ i, bd, town, zone, townLeft }]: crossings between a town and a zone area
  if (TG_LIST) return TG_LIST;
  TG_LIST = [];
  WILDS.bridges.forEach((bd, i) => {
    const a = REGIONS[i], b = REGIONS[i + 1]; if (!bd || !a || !b) return;
    const ta = tgTownish(a), tb = tgTownish(b); if (ta === tb) return;
    TG_LIST.push({ i, bd, town: ta ? a : b, zone: ta ? b : a, townLeft: ta });
  });
  return TG_LIST;
}
// (cloud to cloud the islands join by their own cloud bridge; cloud to land the wooden bridge goes over the white cloud span, which
// smeared across the water at Cloudhold's gate)
const tgCloud = C => REGIONS[C.i].tileset === ISLES.ts && REGIONS[C.i + 1].tileset === ISLES.ts;
// a town on the ground beside a cloud zone (Duskhollow): its crossing gets the wooden bridge alone. The cloud walkway world.js lays
// for sky crossings ran two tiles onto the town's grass and showed past the bridge's end as a white patch under the lamp and sign
// (2026-11-20, the user: "there is clouds on duskhollow side")
const tgOneCloud = i => { const C = townCrossings().find(c => c.i === i); return !!C && !tgCloud(C) && (REGIONS[i].tileset === ISLES.ts) !== (REGIONS[i + 1].tileset === ISLES.ts); };
function tgName(R) {
  const M = WG_MAPS[R.map] || MAPS[R.map] || {};
  if (M.goddessTown) return M.name;
  if (R.zone >= 0) return ZONES[R.zone].name;
  const i = REGIONS.indexOf(R); try { const n = regionName(i); if (n) return String(n).replace(/@.*/, ''); } catch (e) {}
  return M.name || 'Town';
}
// ---- the wooden bridge, laid over the stone bridge's place (the same rectangle drawRivers fills)
function tgWoodSpan(c, L, top, bw, H) {
  const P = TG.plank;
  for (let x = 0; x < bw; x += P) { const w = Math.min(P, bw - x); c.fillStyle = TG.wood[(x / P) % 3]; c.fillRect(L + x, top, w, H); c.fillStyle = TG.gap; c.fillRect(L + x + w - 1, top, 1, H);
    c.fillStyle = 'rgba(255,230,180,0.18)'; c.fillRect(L + x, top, 1, H); if (((x / P) * 7) % 5 === 1) { c.fillStyle = 'rgba(60,30,10,0.35)'; c.fillRect(L + x + 2, top + 14 + ((x * 3) % 18), 1, 2); } }
  // the far rail: a beam on short posts
  c.fillStyle = TG.beam; c.fillRect(L, top + 3, bw, 4); c.fillStyle = TG.beamTop; c.fillRect(L, top + 3, bw, 1);
  for (let x = 2; x < bw - 2; x += TG.post) { c.fillStyle = TG.post; c.fillRect(L + x, top, 4, 12); c.fillStyle = TG.postTop; c.fillRect(L + x, top, 4, 2); }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(L, top + 12, bw, 2);
  // the near side: the bridge's front beam, its rail and posts going down into the water
  const fy = top + H - 12;
  c.fillStyle = TG.beam; c.fillRect(L, fy, bw, 9); c.fillStyle = TG.beamTop; c.fillRect(L, fy, bw, 2); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(L, fy + 8, bw, 1);
  for (let x = 2; x < bw - 2; x += TG.post) { c.fillStyle = TG.post; c.fillRect(L + x, fy - 8, 4, 20); c.fillStyle = TG.postTop; c.fillRect(L + x, fy - 8, 4, 2); }
  c.fillStyle = TG.beam; c.fillRect(L, fy - 6, bw, 3); c.fillStyle = TG.beamTop; c.fillRect(L, fy - 6, bw, 1);
}
const TG_ART = new Map();
function tgWoodArt(bw, H) {
  const key = bw + '|' + H; if (TG_ART.has(key)) return TG_ART.get(key);
  const c = document.createElement('canvas'); c.width = Math.ceil(bw); c.height = H; const g = c.getContext('2d'); tgWoodSpan(g, 0, 0, bw, H);
  TG_ART.set(key, c); return c;
}
{ const dr = drawRivers;
  drawRivers = function (w, now) {
    dr(w, now);
    const cam = w.cam || { x: 0, y: 0 }, vw = VW / ZOOM;
    for (const C of townCrossings()) {
      if (tgCloud(C) || LAVA_TS.has(REGIONS[C.i].tileset)) continue;
      const S = riverShape(C.i); if (S.x0 > cam.x + vw + 60 || S.x1 < cam.x - 60) continue;
      const bd = C.bd, Lb = bankL(S, bd), Rb = bankR(S, bd), extra = (bridgeRows(bd) - 2) * T, L = Lb - 6, bw = Rb - Lb + 12, top = Math.round(bd.y * T + T - 27), H = 53 + extra;
      ctx.drawImage(tgWoodArt(bw, H), L, top);
      // the little stone posts by the ends become wooden ones
      for (const px of [L - 10, L + bw + 2]) for (const py of [bd.y * T - 6, (bd.y + bridgeRows(bd)) * T - 2]) {
        ctx.fillStyle = TG.post; ctx.fillRect(px - 1, py - 2, 10, 11); ctx.fillStyle = TG.postTop; ctx.fillRect(px - 1, py - 2, 10, 2); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px, py + 9, 9, 2);
      }
    }
  };
}
// ---- the signboards: drawn objects standing on each bank, one tile above the road
function tgSign(x, y, label) {
  return { x, y, bottom: y, sortY: y, netBase: true, tgSign: true, draw: (o, now) => {
    const tw = Math.ceil(textW(label, 7)) + 12, bx = Math.round(o.x - tw / 2), by = Math.round(o.y - 30);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(o.x, o.y - 1, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = TG.post; ctx.fillRect(o.x - 1.5, by + 10, 3, o.y - by - 10); ctx.fillStyle = TG.postTop; ctx.fillRect(o.x - 1.5, by + 10, 1, o.y - by - 10);
    ctx.fillStyle = '#4a2e14'; rrect(ctx, bx - 1, by - 1, tw + 2, 15, 3); ctx.fill();
    const gg = ctx.createLinearGradient(0, by, 0, by + 13); gg.addColorStop(0, '#c99052'); gg.addColorStop(1, '#8a5a2a'); ctx.fillStyle = gg; rrect(ctx, bx, by, tw, 13, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.35)'; ctx.fillRect(bx + 2, by + 1, tw - 4, 1);
    text(label, o.x, by + 6.8, '#fff6e0', 7);
  } };
}
{ const mo = makeOverworld;
  makeOverworld = function (game, spawn) {
    const w = mo(game, spawn), rec = objRec('006', 0);
    for (const C of townCrossings()) {
      const S = riverShape(C.i), bd = C.bd, rows = bridgeRows(bd), Lb = bankL(S, bd), Rb = bankR(S, bd), above = bd.y * T - 6, below = (bd.y + rows) * T + 12;
      // lamps: at both ends, one above the road on the left bank and one below it on the right (as a pair either side of the way)
      if (rec && !tgCloud(C)) for (const [lx, ly] of [[Lb - TG.lampIn, above], [Rb + TG.lampIn, below]]) {
        const o = makeMapObject([6, 0, Math.round(lx - (rec[4] + rec[2] / 2)), Math.round(ly - (rec[5] + rec[3]))]); if (o) { o.netBase = true; o.tgLamp = true; w.objects.push(o); }
      }
      // signs: each bank names what lies over the water. A sign steps aside when a house, tree or rock stands where it would go
      // (Duskhollow's first house covered half its "Skyreach" board, 2026-11-20): above or below the road, then further out
      const leftName = tgName(REGIONS[C.i + 1]), rightName = tgName(REGIONS[C.i]);
      const clear = (x, y, label, strict) => { const tw = textW(label, 7) + 14, bx = x - tw / 2, by = y - 32;
        return !w.objects.some(o => { if (o.ground || o.tgSign || o.draw) return false; const r = objRec(o.bank, o.fi); if (!r || (!strict && r[2] * r[3] < 1200)) return false;   // (first a spot clear of everything, lamps and fences too; failing that, bushes and stumps may stand by a sign, houses and trees may not)
          const ox = o.x + r[4], oy = o.y + r[5]; return bx < ox + r[2] && bx + tw > ox && by < oy + r[3] && y + 2 > oy; }); };
      const spot = (x, y, other, side, label) => { for (const dx of [0, 24, 48, 72, 96, 120]) for (const yy of [y, other]) if (clear(x + side * dx, yy, label, true)) return [x + side * dx, yy]; return null; };   // (the lamps go in first, so a sign keeps off them: Skyreach Isles stood on Duskhollow's lamp and fence, 2026-11-20)
      const sl = spot(Lb - TG.signIn, below, above, -1, leftName), sr = spot(Rb + TG.signIn, above, below, 1, rightName);
      for (const [P, name] of [[sl, leftName], [sr, rightName]]) if (P) w.objects.push(tgSign(P[0], P[1], name));   // (no clear spot at all: no sign, rather than one standing in a fence)
    }
    return w;
  };
}
// ---- a cloud bank where a town on the ground meets the sky zone (2026-11-20, the user: "make sure there isnt any incorrect
// placement tiles or edges/ transition that doesnt work"). Duskhollow's map stopped in a straight cut against open sky, its sea
// meeting the sky in a hard vertical line; a band of puffy clouds now runs the whole height of that edge, so the town rests on cloud
const TG_FRINGE = { r: 9, step: 9, out: 10, shade: '#c4d6ee', rim: '#e6eefa' };
function tgFringe(g, ex, side, H) {
  const F = TG_FRINGE, h = i => { const s = Math.sin(i * 12.9898 + ex * 0.0123) * 43758.5453; return s - Math.floor(s); };
  for (const [col, dx, dy, k] of [[F.shade, side * 2, 3, 1], [F.rim, 0, 0, 1], ['#ffffff', -side * 1.5, -1.5, 0.8]]) {
    g.fillStyle = col;
    for (let i = 0, y = -F.r; y < H + F.r; i++, y += F.step) {
      const r = (F.r + h(i) * 4) * k, x = ex + side * (F.out * 0.4 + h(i + 99) * F.out * 0.6) + dx;
      g.beginPath(); g.arc(x, y + dy, r, 0, Math.PI * 2); g.fill();
    }
  }
}
// ---- the blend: a zone's mood tint fades out across the river into the town (it used to stop in a line two tiles out from the zone)
{ const po = paintOverworld;
  paintOverworld = function (g, X0, X1, H) {
    po(g, X0, X1, H);
    for (const C of townCrossings()) {
      const L = REGIONS[C.i], Rg = REGIONS[C.i + 1], cl = L.tileset === ISLES.ts, cr = Rg.tileset === ISLES.ts; if (cl === cr) continue;
      const ex = cl ? Rg.ox * T : (L.ox + L.w) * T; if (ex < X0 - 40 || ex > X1 + 40) continue;
      tgFringe(g, ex, cl ? -1 : 1, H);   // (the puffs bulge out over the sky side's edge, onto the town a little)
    }
    for (const C of townCrossings()) {
      const tint = C.zone.zone >= 0 && ZONES[C.zone.zone].tint; if (!tint) continue;
      // (not beside a cloud island: its river gap is cut-away sky, and a multiply over those empty pixels painted a solid pale band
      // down the whole map, at Cloudhold's gate and Duskhollow's bridge; 2026-11-20 the user: "remove that big long white tile strip")
      if (C.zone.tileset === ISLES.ts || C.town.tileset === ISLES.ts) continue;
      // the zone's own tint reaches 2 tiles past its edge (paintOverworld step 4); from there it fades to nothing over the rest of
      // the river and TG.fade tiles of the town
      const zEdge = C.townLeft ? (C.zone.ox - 2) * T : (C.zone.ox + C.zone.w + 2) * T, tEdge = C.townLeft ? (C.town.ox + C.town.w - TG.fade) * T : (C.town.ox + TG.fade) * T;
      const a = Math.min(zEdge, tEdge), b = Math.max(zEdge, tEdge); if (b < X0 || a > X1) continue;
      const gr = g.createLinearGradient(zEdge, 0, tEdge, 0); gr.addColorStop(0, tint); gr.addColorStop(1, '#ffffff');
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = gr; g.fillRect(a, 0, b - a, H); g.restore();
    }
  };
}
// ---- no sea under a town's trees (2026-11-20, the user circled "random blue there" by a Mossbrook roof): some of the original map's
// forest tiles have see-through corners, and where they lie on the ground layer the blue under the map showed through. A town map in the
// green lands gets a deep leafy green behind every see-through pixel (cloud towns keep their gaps: those are meant to show the sky)
{ const rb = renderMapBg;
  renderMapBg = function (M, ...rest) {
    const c = rb.call(this, M, ...rest);
    try { if (c && M && M.town && M.tileset === 1) { const g = c.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-over'; g.fillStyle = 'rgb(24,121,82)'; g.fillRect(0, 0, c.width, c.height); g.restore(); } } catch (e) {}
    return c;
  };
}
