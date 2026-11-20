'use strict';
// Tilemap, camera, world rendering, and the three scenes: Town, Field (adventure), Arena (PvP).

const T = 16;
const MAPS = D.world.maps;
const pad3 = n => String(n).padStart(3, '0');

// Decoded game map: ground layer (u8 tile | flags<<8), overlay (tile+1, 0 = empty), objects, collision.
function mapSolidAt(map, x, y) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return !!map.solid[ty * map.w + tx];
}
function mapReach(map, x, y) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  return tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && !!map.reach[ty * map.w + tx];
}

// All water is Zenonia 2's bright water (tileset 201, tile 5 — the Waterfall Terraces lake). Each tileset is copied
// once: tiles that are all water become that tile, and the blue water in shoreline tiles is repainted in its colours
// (darkest blue → its darkest, lightest → its lightest), so shores and open water match everywhere. Lava stays lava.
const WATER_REF = { ts: 201, tile: 5 }, LAVA_TS = new Set([8, 208]);
let WATER = null;
function waterRef() {
  if (WATER) return WATER;
  const im = img(D.world.tilesets[WATER_REF.ts]); if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = c.height = T;
  const g = c.getContext('2d'); g.drawImage(im, (WATER_REF.tile % 16) * T, Math.floor(WATER_REF.tile / 16) * T, T, T, 0, 0, T, T);
  const px = g.getImageData(0, 0, T, T).data, cols = [];
  for (let i = 0; i < px.length; i += 4) cols.push([px[i], px[i + 1], px[i + 2]]);
  const lum = q => q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11;
  const pal = [...new Map(cols.map(q => [q.join(','), q])).values()].sort((a, b) => lum(a) - lum(b));
  return (WATER = { tile: c, pal, px });
}
const isWaterPx = (r, g, b) => { const [h, s2, l] = rgb2hsl(r, g, b); return h >= 188 && h <= 232 && s2 >= 0.42 && l >= 0.22 && l <= 0.78; };
// the Skyreach Isles' tileset keeps out of all that: its blue is open sky, so it is cut away and the sky below (drawSkyBelow) shows through
const TILESET_FIX = {}, REF_FLAT_WATER = [180, 181, 182, 183, 184, 185];   // 182–185: the same cyan, dithered lighter (the original's sky)
function tilesetImg(ts) {
  if (TILESET_FIX[ts]) return TILESET_FIX[ts];
  const im = img(D.world.tilesets[ts]), W = waterRef();
  if (!im || !im.complete || !im.naturalWidth || !W) return im;
  if (LAVA_TS.has(+ts)) return (TILESET_FIX[ts] = im);
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = +ts === DESERT_ROCK.ts ? 16 * T : +ts === ISLES.ts ? Math.max(im.naturalHeight, 11 * T) : im.naturalHeight;   // (tiles_3 gets room for the sandstone plateau pieces: desertRockRecolor)
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  if (+ts === WATER_REF.ts) {   // the reference tileset: only its flat cyan water tiles become the shared water (its
    for (const t of REF_FLAT_WATER) g.drawImage(W.tile, (t % 16) * T, Math.floor(t / 16) * T);   // blue-green trees must stay as drawn)
    return (TILESET_FIX[ts] = c);
  }
  let id; try { id = g.getImageData(0, 0, c.width, c.height); } catch (e) { return (TILESET_FIX[ts] = im); }
  const d = id.data, cw = c.width, sky = +ts === ISLES.ts;
  for (let ty = 0; ty < c.height; ty += T) for (let tx = 0; tx < cw; tx += T) {
    let water = 0, solid = 0;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = ((ty + y) * cw + tx + x) * 4; if (d[i + 3] > 200) { solid++; if (isWaterPx(d[i], d[i + 1], d[i + 2])) water++; } }
    if (!water) continue;
    const whole = solid === T * T && water >= T * T * 0.86;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = ((ty + y) * cw + tx + x) * 4;
      if (whole && sky) { d[i + 3] = 0; continue; }
      if (whole) { const j = (y * T + x) * 4; d[i] = W.px[j]; d[i + 1] = W.px[j + 1]; d[i + 2] = W.px[j + 2]; d[i + 3] = 255; continue; }
      if (d[i + 3] <= 200 || !isWaterPx(d[i], d[i + 1], d[i + 2])) continue;
      if (sky) { d[i + 3] = 0; continue; }
      const l = rgb2hsl(d[i], d[i + 1], d[i + 2])[2], pal = W.pal, q = pal[clamp(Math.round((l - 0.22) / 0.56 * (pal.length - 1)), 0, pal.length - 1)];
      d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
    }
  }
  if (+ts === DESERT_ROCK.ts) { desertRockRecolor(d, cw); desertPlateauPieces(d, cw); }
  if (sky) islesPlateauPieces(d, cw);   // (Skyreach Isles' cloud-stone cliffs: plateaus.js, 2026-11-07)
  g.putImageData(id, 0, 0);
  return (TILESET_FIX[ts] = c);
}
// THE DESERT'S ROCK ON PALE SAND: tiles_3's sandstone cliff pieces were drawn on the darker orange high ground (tile 84). In
// those pieces every pixel of that orange sand is made see-through, so the Sunscorch Desert's own pale sand shows through
// with its own grain and no seams (the mesas, plateaus.js). The art has no stairs, so four step tiles are painted into its
// empty slots (166-169: upper left, upper right, lower left, lower right) in the rock's own colours.
const DESERT_ROCK = { ts: 3, from: 84, tiles: [[96, 127], [160, 165]], steps: 166, rock: 107 };
function desertRockRecolor(d, cw) {
  const at = (t, x, y) => ((Math.floor(t / 16) * T + y) * cw + (t % 16) * T + x) * 4;
  const sand = new Set(); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at(DESERT_ROCK.from, x, y); sand.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
  for (const [a, b] of DESERT_ROCK.tiles) for (let t = a; t <= b; t++) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = at(t, x, y); if (d[i + 3] > 0 && sand.has(d[i] + ',' + d[i + 1] + ',' + d[i + 2])) d[i + 3] = 0;
  }
  // the rock's colours, dark to light (from a face piece)
  const lum = q => q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11, cols = [];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at(DESERT_ROCK.rock, x, y); if (d[i + 3] > 200) cols.push([d[i], d[i + 1], d[i + 2]]); }
  const pal = [...new Map(cols.map(q => [q.join(','), q])).values()].sort((p, q) => lum(p) - lum(q)); if (pal.length < 3) return;
  const dark = pal[0], mid = pal[Math.floor(pal.length * 0.5)], light = pal[Math.floor(pal.length * 0.85)], top = pal[pal.length - 1];
  const set = (t, x, y, c) => { const i = at(t, x, y); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
  // the steps: tiles_1's grass stairs (56 57 / 66 67, the game's own step art), recoloured by brightness from rock (dark) to the
  // desert's sand (light), into 166-169; painted steps stand in only if that tileset is not loaded yet
  const g1 = img(D.world.tilesets[1]);
  if (g1 && g1.complete && g1.naturalWidth) {
    const c1 = document.createElement('canvas'); c1.width = g1.naturalWidth; c1.height = g1.naturalHeight; const x1 = c1.getContext('2d'); x1.drawImage(g1, 0, 0);
    const s1 = x1.getImageData(0, 0, c1.width, c1.height).data, w1 = c1.width, src = [56, 57, 66, 67], sp = [];
    const at1 = (t, x, y) => ((Math.floor(t / 16) * T + y) * w1 + (t % 16) * T + x) * 4;
    for (const t of src) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at1(t, x, y); if (s1[i + 3] > 128) sp.push(lum([s1[i], s1[i + 1], s1[i + 2]])); }
    const sand = []; for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at(11, x, y); sand.push([d[i], d[i + 1], d[i + 2]]); }
    const ramp = [...pal.slice(0, Math.ceil(pal.length * 0.7)), ...[...new Map(sand.map(q => [q.join(','), q])).values()].sort((p2, q2) => lum(p2) - lum(q2))];
    const lo = Math.min(...sp), hi = Math.max(...sp);
    src.forEach((t, k) => { const dt = DESERT_ROCK.steps + k; for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = at1(t, x, y), j = at(dt, x, y); if (s1[i + 3] <= 128) { d[j + 3] = 0; continue; }
      const f = (lum([s1[i], s1[i + 1], s1[i + 2]]) - lo) / Math.max(1, hi - lo), q = ramp[Math.min(ramp.length - 1, Math.round(f * (ramp.length - 1)))];
      d[j] = q[0]; d[j + 1] = q[1]; d[j + 2] = q[2]; d[j + 3] = 255; } });
    return;
  }
  for (let k = 0; k < 4; k++) {   // 166 upper left, 167 upper right, 168 lower left, 169 lower right: four steps per tile (tread, edge, riser)
    const t = DESERT_ROCK.steps + k, right = k % 2 === 1;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const r = y % 4, edge = right ? x === T - 1 : x === 0, edge2 = right ? x === T - 2 : x === 1;
      set(t, x, y, edge ? dark : edge2 ? mid : r === 0 ? top : r === 1 ? light : r === 2 ? mid : dark);
    }
  }
}
// SANDSTONE PLATEAU PIECES: the grass lands' own plateau tiles (tiles_1: lip, sides, face, stairs) recoloured for the desert,
// grass to the zone's pale sand and earth to sandstone (each by brightness), into tiles_3's new rows from slot 176 on
// (the desert's plateaus are built exactly like the grass ones: plateaus.js set 3)
const DESERT_PIECES = { at: 176, src: [76, 77, 78, 79, 86, 96, 89, 99, 106, 107, 108, 109, 116, 117, 118, 119, 56, 57, 66, 67] };
const desertPiece = t => DESERT_PIECES.at + DESERT_PIECES.src.indexOf(t);
function desertPlateauPieces(d, cw) {
  const g1 = img(D.world.tilesets[1]); if (!g1 || !g1.complete || !g1.naturalWidth) return;
  const c1 = document.createElement('canvas'); c1.width = g1.naturalWidth; c1.height = g1.naturalHeight; const x1 = c1.getContext('2d'); x1.drawImage(g1, 0, 0);
  const s1 = x1.getImageData(0, 0, c1.width, c1.height).data, w1 = c1.width;
  const at = (t, x, y, w) => ((Math.floor(t / 16) * T + y) * w + (t % 16) * T + x) * 4, lum = q => q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11;
  const pal = (t, w, src) => { const L = []; for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at(t, x, y, w); if (src[i + 3] > 200) L.push([src[i], src[i + 1], src[i + 2]]); } return [...new Map(L.map(q => [q.join(','), q])).values()].sort((a, b) => lum(a) - lum(b)); };
  const sand = pal(11, cw, d), rock = pal(DESERT_ROCK.rock, cw, d); if (!sand.length || !rock.length) return;
  const green = (r, g, b) => g > r + 6 && g > b;
  // brightness ranges of the source's green and earth pixels, so each maps across its whole target ramp
  let gl = 1e9, gh = -1e9, el = 1e9, eh = -1e9;
  for (const t of DESERT_PIECES.src) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at(t, x, y, w1); if (s1[i + 3] <= 128) continue; const L = lum([s1[i], s1[i + 1], s1[i + 2]]);
    if (green(s1[i], s1[i + 1], s1[i + 2])) { gl = Math.min(gl, L); gh = Math.max(gh, L); } else { el = Math.min(el, L); eh = Math.max(eh, L); } }
  const pick = (ramp, f) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(f * (ramp.length - 1))))];
  const sandRamp = [...rock.slice(Math.floor(rock.length * 0.6)), ...sand];   // (grass shadows fall toward warm rock, its light toward sand)
  DESERT_PIECES.src.forEach((t, k) => { const dt = DESERT_PIECES.at + k;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = at(t, x, y, w1), j = at(dt, x, y, cw); if (s1[i + 3] <= 128) { d[j + 3] = 0; continue; }
      const L = lum([s1[i], s1[i + 1], s1[i + 2]]), g = green(s1[i], s1[i + 1], s1[i + 2]);
      const q = g ? pick(sandRamp, (L - gl) / Math.max(1, gh - gl)) : pick(rock, (L - el) / Math.max(1, eh - el));
      d[j] = q[0]; d[j + 1] = q[1]; d[j + 2] = q[2]; d[j + 3] = 255;
    } });
}
// SKYREACH ISLES' CLIFFS (2026-11-07): the grass plateau pieces (tiles_1) recoloured into tileset 209 from slot 144 (two new
// rows): the grass becomes the isles' own pale cloud ground (the palette of its floor tile, 41), the earth a soft lavender-grey
// cloud stone. plateaus.js PLAT_SETS[209] uses them (IP() gives a grass piece's slot here).
const ISLES_PIECES = { at: 144, src: DESERT_PIECES.src, floor: 41,
  stone: [[62, 64, 92], [84, 88, 120], [108, 112, 146], [134, 138, 170], [162, 166, 196], [192, 196, 222], [222, 226, 242]] };
function islesPlateauPieces(d, cw) {
  const g1 = img(D.world.tilesets[1]); if (!g1 || !g1.complete || !g1.naturalWidth) return;
  const c1 = document.createElement('canvas'); c1.width = g1.naturalWidth; c1.height = g1.naturalHeight; const x1 = c1.getContext('2d'); x1.drawImage(g1, 0, 0);
  const s1 = x1.getImageData(0, 0, c1.width, c1.height).data, w1 = c1.width;
  const at = (t, x, y, w) => ((Math.floor(t / 16) * T + y) * w + (t % 16) * T + x) * 4, lum = q => q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11;
  const L0 = []; for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at(ISLES_PIECES.floor, x, y, cw); if (d[i + 3] > 200) L0.push([d[i], d[i + 1], d[i + 2]]); }
  const cloud = [...new Map(L0.map(q => [q.join(','), q])).values()].sort((a, b) => lum(a) - lum(b)); if (!cloud.length) return;
  const stone = ISLES_PIECES.stone, green = (r, g, b) => g > r + 6 && g > b;
  let gl = 1e9, gh = -1e9, el = 1e9, eh = -1e9;
  for (const t of ISLES_PIECES.src) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = at(t, x, y, w1); if (s1[i + 3] <= 128) continue; const L = lum([s1[i], s1[i + 1], s1[i + 2]]);
    if (green(s1[i], s1[i + 1], s1[i + 2])) { gl = Math.min(gl, L); gh = Math.max(gh, L); } else { el = Math.min(el, L); eh = Math.max(eh, L); } }
  const pick = (ramp, f) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(f * (ramp.length - 1))))];
  const cloudRamp = [...stone.slice(3), ...cloud];   // (the grass's shadows fall toward the stone, its light toward the cloud ground)
  ISLES_PIECES.src.forEach((t, k) => { const dt = ISLES_PIECES.at + k;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = at(t, x, y, w1), j = at(dt, x, y, cw); if (j + 3 >= d.length) return; if (s1[i + 3] <= 128) { d[j + 3] = 0; continue; }
      const L = lum([s1[i], s1[i + 1], s1[i + 2]]), g = green(s1[i], s1[i + 1], s1[i + 2]);
      const q = g ? pick(cloudRamp, (L - gl) / Math.max(1, gh - gl)) : pick(stone, (L - el) / Math.max(1, eh - el));
      d[j] = q[0]; d[j + 1] = q[1]; d[j + 2] = q[2]; d[j + 3] = 255;
    } });
}
const waterPattern = g => { const W = waterRef(); return W ? g.createPattern(W.tile, 'repeat') : '#2a8ae8'; };

// Pre-render ground + overlay + ground-level objects (layer A) into one canvas.
function renderMapBg(map, noObjA = false) {   // noObjA: the overworld draws the big painted objects itself, after the rivers
  const c = document.createElement('canvas');
  c.width = map.w * T; c.height = map.h * T;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const ts = map.z2field ? img(D.world.tilesets[map.tileset]) : tilesetImg(map.tileset);   // (a whole Zenonia 2 map keeps its tiles as drawn: its sky stays sky)
  const tile = (t, fl, x, y) => {
    const sx = (t % 16) * T, sy = Math.floor(t / 16) * T;
    if (fl & 3) {
      g.save(); g.translate(x + (fl & 1 ? T : 0), y + (fl & 2 ? T : 0)); g.scale(fl & 1 ? -1 : 1, fl & 2 ? -1 : 1);
      g.drawImage(ts, sx, sy, T, T, 0, 0, T, T); g.restore();
    } else g.drawImage(ts, sx, sy, T, T, x, y, T, T);
  };
  const shell = map.tileset === 100 ? interiorShell(map) : null;
  const ov = map.overlay, trim = edgeTrim(map);
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
    const i = ty * map.w + tx;
    if (shell && shell[i]) { g.fillStyle = '#000'; g.fillRect(tx * T, ty * T, T, T); continue; }
    if (trim && trim[i]) continue;   // left clear: the open water under the map shows through
    const v = map.ground[i];
    // both layers store tile + 1; the ground's high byte is collision, not a flip
    if (v & 0xff) tile((v & 0xff) - 1, 0, tx * T, ty * T);
    const o = ov[i];
    if (o & 0xff) tile((o & 0xff) - 1, 0, tx * T, ty * T);
  }
  if (map.sandShapes && ts) paintSand(g, map.sandShapes, ts, map.sandTile, map.sandRim, map.pathTint);
  if (map.grassShapes && map.grassShapes.length && ts) paintSand(g, map.grassShapes, ts, map.grassTile, map.grassRim);   // (green rings round the desert's oases: worldgen.js)
  if (map.waterShapes && map.waterShapes.length && ts && !map.grassShapes) paintWater(g, map.waterShapes, ts, map.poolTile, map.waterRim);
  if (!noObjA) drawObjA(g, map, 0, 0);
  if (trim) trimShores(g, map, trim);
  return c;
}

// Soft sandy ground (Hearthvale's road, plaza and lanes): the shapes filled with the tileset's own sand (tile 7) as a
// pattern, over a darker worn rim and a pale lip, so the paths have the rounded, grassy edges of Zenonia's towns.
function paintSand(g, shapes, ts, tile = 7, rim = ['rgba(120,150,40,0.35)', '#e8dc9c'], tint = null) {
  const t = document.createElement('canvas'); t.width = t.height = T;
  t.getContext('2d').drawImage(ts, (tile % 16) * T, Math.floor(tile / 16) * T, T, T, 0, 0, T, T);
  const pat = g.createPattern(t, 'repeat');
  const path = (grow) => { g.beginPath(); for (const s of shapes) {
    if (s[0] === 'ellipse') { g.moveTo(s[1] * T + s[3] * T + grow, s[2] * T); g.ellipse(s[1] * T, s[2] * T, s[3] * T + grow, s[4] * T + grow, 0, 0, Math.PI * 2); g.closePath(); }   // (each its own shape, or a line joins them and cuts a strip out of the road)
    else { const x = s[1] * T - grow, y = s[2] * T - grow, w = (s[3] - s[1]) * T + grow * 2, h = (s[4] - s[2]) * T + grow * 2, r = Math.min(s[5] * T + grow, w / 2, h / 2);
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  } };
  g.save();
  path(3); g.fillStyle = rim[0]; g.fill();    // worn ground round the edge
  path(1.5); g.fillStyle = rim[1]; g.fill();  // a lip
  path(0); g.fillStyle = pat; g.fill();                        // the sand
  if (tint) { path(0); g.fillStyle = tint; g.fill(); }        // a glow over it (the ember zone's ash roads)
  g.restore();
}
// Lakes in the generated areas: soft shapes filled with the shared water (tileset 1's water tile, already turned into
// Zenonia 2's bright water), a dark wet edge on the sand and a pale foam line just inside.
function paintWater(g, shapes, ts, tile = 120, rim = ['rgba(150,120,60,0.45)', 'rgba(255,255,255,0.55)']) {
  const t = document.createElement('canvas'); t.width = t.height = T;
  t.getContext('2d').drawImage(ts, (tile % 16) * T, Math.floor(tile / 16) * T, T, T, 0, 0, T, T);
  const pat = g.createPattern(t, 'repeat');
  const path = grow => { g.beginPath(); for (const s of shapes) { g.moveTo(s[1] * T + s[3] * T + grow, s[2] * T); g.ellipse(s[1] * T, s[2] * T, s[3] * T + grow, s[4] * T + grow, 0, 0, Math.PI * 2); } };
  g.save();
  path(2); g.fillStyle = rim[0]; g.fill();   // the wet (or scorched, or frozen) edge
  path(0); g.fillStyle = pat; g.fill();
  path(-1.5); g.strokeStyle = rim[1]; g.lineWidth = 1; g.stroke();   // foam / glow / frost line
  g.restore();
}
// The maps come from the original games, where their edges led on to other maps: doorways and stairs at an edge now
// lead into open water. Doorway objects there are left out (stairs are mended in worldgen.js, fixEdgeStairs).
// A map's top and bottom rows are where it once continued into the next map: cliff ledges, fence ends and paths cut
// off by the edge. In the TRIM_ROWS rows at each end, every blocked cell with brown or grey scenery painted on it
// (cliff, post or step overlay tiles; green treetops stay) is left clear, so it becomes part of the open water, and a lake shore runs wherever that water meets walkable
// ground. (Those cells were blocked already, so where you can walk doesn't change.)
const TRIM_ROWS = 3;
function edgeTrim(map) {
  if (map._trim !== undefined) return map._trim;
  if (map.noTrim || map.z2field || map.tileset === 100 || map.tileset === ISLES.ts || LAVA_TS.has(map.tileset) || map === MAPS.vtown || !map.overlay) return (map._trim = null);   // (noTrim: an original-map town, worldgen.js ORIG_TOWNS: its edges are the town's, not a shore)
  { const im = img(D.world.tilesets[map.tileset]); if (!im || !im.complete || !im.naturalWidth) return null; }   // decide once the tile art is in
  const t = new Uint8Array(map.w * map.h); let any = false;
  for (let ty = 0; ty < map.h; ty++) {
    if (ty >= TRIM_ROWS && ty < map.h - TRIM_ROWS) continue;
    for (let tx = 0; tx < map.w; tx++) { const i = ty * map.w + tx, o = (map.overlay[i] & 0xff) - 1; if (map.solid[i] && o >= 0 && obstacleTile(map.tileset, o)) { t[i] = 1; any = true; } }   // cliffs, posts, steps — not green treetops
  }
  // a clear cell is only kept if it touches the map's edge through other clear cells (no lakes inside the map)
  const keep = new Uint8Array(t.length), st = [];
  for (let tx = 0; tx < map.w; tx++) for (const ty of [0, map.h - 1]) { const i = ty * map.w + tx; if (t[i] && !keep[i]) { keep[i] = 1; st.push(i); } }
  while (st.length) { const i = st.pop(), x = i % map.w, y = (i - x) / map.w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue; const j = ny * map.w + nx; if (t[j] && !keep[j]) { keep[j] = 1; st.push(j); } } }
  return (map._trim = any ? keep : null);
}
// the lake shore around the cleared cells, on the sides that face walkable ground
function trimShores(g, map, trim) {
  const open = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && !trim[y * map.w + x] && !map.solid[y * map.w + x], bare = map.tileset !== 1 && map.tileset !== 201;   // (no lime bank on snow or stone)
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
    if (!trim[ty * map.w + tx]) continue;
    if (open(tx, ty + 1)) edgeShore(g, tx * T, T, (ty + 1) * T, -1, bare);   // ground below, water above
    if (open(tx, ty - 1)) edgeShore(g, tx * T, T, ty * T, 1, bare);          // ground above, water below
    if (open(tx + 1, ty)) edgeShoreV(g, (tx + 1) * T, ty * T, T, -1, bare);   // ground right, water left
    if (open(tx - 1, ty)) edgeShoreV(g, tx * T, ty * T, T, 1, bare);          // ground left, water right
  }
}
const EXIT_OBJS = new Set(['244:0', '100:48']), EDGE_EXIT = 6;
function edgeExit(map, bank, fi, x, y) {
  if (!EXIT_OBJS.has(`${pad3(bank)}:${fi}`) || map.tileset === 100) return false;
  const r = objRec(pad3(bank), fi); if (!r) return false;
  const x0 = (x + r[4]) / T, y0 = (y + r[5]) / T, x1 = x0 + r[2] / T, y1 = y0 + r[3] / T;
  return x0 < EDGE_EXIT || y0 < EDGE_EXIT || x1 > map.w - EDGE_EXIT || y1 > map.h - EDGE_EXIT;
}
// The green lands' maps were cut from a bigger world, so their left and right edges are full of cut-off cliffs, rocks
// and shore pieces. As in Zenonia's own maps, a line of pines closes each edge instead: a staggered wall of the town's
// pine trees stands on the edge columns' solid, dry cells (walkable cells, water and the bridge landings stay open,
// so no path is blocked — the trees only hide what was already a wall).
function edgeForest(w) {
  const near = (gx, gy) => WILDS.bridges.some(b => b && gx >= b.x0 - 2 && gx <= b.x1 + 2 && gy >= b.y - 2 && gy <= b.y + bridgeRows(b) + 1);
  for (const R of REGIONS) for (const q of [R, ...(R.subs || [])]) {
    if (q.tileset !== 1 && q.tileset !== 201) continue;
    const M = MAPS[q.map]; if (!M || q.map === 'vtown' || M.town || M.z2field) continue;   // (a whole Zenonia 2 map has its own edges: z2links.js)
    const dry = (x, y) => { if (x < 0 || y < 0 || x >= M.w || y >= M.h) return false; const i = y * M.w + x, t = (M.ground[i] & 0xff) - 1;
      return M.solid[i] && !REF_FLAT_WATER.includes(t) && t !== 120 && !(EDGE_WATER[M.tileset] && EDGE_WATER[M.tileset].has(t)) && !waterTile(M.tileset, t); };
    for (const [x0, step] of [[0, 1], [M.w - 1, -1]]) for (let y = 1; y < M.h; y++) {
      for (const [dx, k, odd] of [[0, 2, 0], [step, 2, 1]]) {   // whole pines on the outer column and a step in, alternating rows (the trunk-less tops looked cut in half)
        const x = x0 + dx; if ((y + odd) % 2 || !dry(x, y) || !dry(x0, y) || near(q.ox + x, q.oy + y)) continue;
        const o = makeMapObject([1, k, (q.ox + x) * T + 8, (q.oy + y) * T + 14]);
        if (o) { o.box = null; o.edgeTree = true; w.objects.push(o); }
      }
    }
  }
}
// a map's ground-level painted objects (trees, statues, rocks…) at an offset (no fires, no doorways off the edge)
function drawObjA(g, map, ox, oy) {
  const oimg = img(D.objects.img);
  for (const [bank, fi, x, y] of map.objA) {
    if (FIRE_BANKS.has(pad3(bank))) continue;
    if (edgeExit(map, bank, fi, x, y)) continue;   // a doorway at the map's edge would lead into the open water
    const rec = objRec(pad3(bank), fi);
    if (rec) g.drawImage(oimg, rec[0], rec[1], rec[2], rec[3], ox + x + rec[4], oy + y + rec[5], rec[2], rec[3]);
  }
}
// Interiors: the decoded homes paint blocked wood floor all around the rooms (above the walls, down the sides).
// In the original that is the black outside of the house: every blocked floor cell that connects to the void
// without furniture standing on it is drawn black.
function interiorShell(map) {
  if (map._shell) return map._shell;
  const W = map.w, H = map.h, n = W * H, t = i => (map.ground[i] & 0xff) - 1, FLOOR = new Set([24, 27, 28]);
  const cov = new Uint8Array(n);
  for (const [bank, fi, x, y] of map.objB.concat(map.objA)) {
    const r = objRec(pad3(bank), fi); if (!r) continue;
    const x0 = x + r[4], y0 = y + r[5];
    for (let ty = Math.floor(y0 / T); ty <= Math.floor((y0 + r[3] - 1) / T); ty++)
      for (let tx = Math.floor(x0 / T); tx <= Math.floor((x0 + r[2] - 1) / T); tx++)
        if (tx >= 0 && ty >= 0 && tx < W && ty < H) cov[ty * W + tx] = 1;
  }
  const out = new Uint8Array(n), st = [];
  for (let i = 0; i < n; i++) if (t(i) === 25) st.push(i);
  while (st.length) {
    const i = st.pop(), x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!out[j] && map.solid[j] && FLOOR.has(t(j)) && !cov[j]) { out[j] = 1; st.push(j); }
    }
  }
  return (map._shell = out);
}

// ---------------------------------------------------------------- objects
// object banks left out of the game entirely: Zenonia 2's green moss patches, the brown smoke wisps, the purple columns
// (with no wall behind them they stood floating in the open)
const HIDDEN_BANKS = new Set(['222', '076', '298']), HIDDEN_FRAMES = new Set(['248:1', '259:0']);   // (248:1: a black splotch; 259:0: stray lengths of the Sun Temple's wall)
function objRec(bank, fi = 0, t = null) {
  if (HIDDEN_BANKS.has(bank) || ((bank === '248' || bank === '259') && HIDDEN_FRAMES.has(`${bank}:${fi}`))) return null;   // (the key is only built for the two banks with a hidden frame: objRec runs ~200 times a frame)
  const b = D.objects.banks[bank];
  if (!b) return null;
  let idx = b.f[fi];
  // animated banks (fountains, windmills, torches) cycle when placed on their first animation frame
  if (t != null && b.anim && b.anim.length > 1 && b.anim[0][0] === fi) {
    const e = seqFrame(b.anim, t, true);
    if (e && b.f[e[0]] >= 0) idx = b.f[e[0]];
  }
  return idx >= 0 ? D.objects.frames[idx] : null;
}
// Map objects are positioned by their origin; frame offsets place the sprite.
// No fire in the world: torches & campfires (020), fire pots & braziers (037), flames (051), fireplaces & bonfires (061)
// and fire pillars (297) are left out of every map.
const FIRE_BANKS = new Set(['020', '037', '051', '061', '297']);
function makeMapObject([bank, fi, x, y, solid]) {
  if (FIRE_BANKS.has(pad3(bank))) return null;
  const o = { bank: pad3(bank), fi, x, y };
  const rec = objRec(o.bank, fi);
  if (!rec) return null;
  o.bottom = y + rec[5] + rec[3];
  if (o.bank === '006' && fi === 0) o.sortY = o.bottom - 14;   // a lamp post is thin: beside its base you stand in front of it, only well behind it does it pass over you
  if (o.bank === '011' && fi === 2) o.ground = true;   // the plaza fountain is one wide, flat picture (plaza, pool, bushes): you always stand on top of it, and worldgen walls off the pool
  applyPropSpec(o, rec);
  if (solid && !o.box) {
    const w = rec[2], h = rec[3];
    const bh = Math.min(14, Math.max(6, h * 0.3));
    o.box = { x: x + rec[4] + w * 0.18, y: o.bottom - bh, w: w * 0.64, h: bh };
  }
  return o;
}
// a solid object big enough to swallow the hero whole (a tent, a tree stump) turns see-through while they're behind it
const SEE_THROUGH = { minW: 36, minH: 34, alpha: 0.45, side: 6 };
function behindObj(o, rec) {
  const p = o.box && rec[2] >= SEE_THROUGH.minW && rec[3] >= SEE_THROUGH.minH && window.GAME && GAME.world && GAME.world.player; if (!p) return false;
  const x0 = o.x + rec[4], y0 = o.y + rec[5], S = SEE_THROUGH.side, y1 = o.sortY ?? o.bottom;
  const hid = a => a.x > x0 - S && a.x < x0 + rec[2] + S && a.y < y1 && a.y > y0;
  if (hid(p)) return true;
  // a monster behind it shows through too (2026-11-13, the user: "enemies below tree": a foe in the canopy was hidden)
  const L = GAME.world.foesNear; if (!L) return false;
  for (let i = 0; i < L.length; i++) if (hid(L[i])) return true;
  return false;
}
// trees that sway in the breeze (grass pines, snow pines, and 201's trees) and how far: a shear of k, about 2 px at a pine's top
// (2026-11-20, the user: "trees are still swaying make them static not moving": the breeze is off, every tree stands still)
const TREE_SWAY = Object.assign(new Set([]), { k: 0 });
// THE DRAW LIST POOL (2026-11-08, performance): drawWorld used to make a fresh { y, draw: closure } for every visible object and
// actor each frame (~300, the biggest share of the game's per-frame garbage). Objects and actors now reuse pooled entries that
// only say what to draw (k: 1 object, 2 actor; r: the thing); other code still pushes its own { y, draw } entries as before.
const DRAW_POOL = { list: [], objs: [], n: 0 };
function drawPoolTake(y, k, r) { let it = DRAW_POOL.objs[DRAW_POOL.n]; if (!it) it = DRAW_POOL.objs[DRAW_POOL.n] = { y: 0, k: 0, r: null, draw: null }; DRAW_POOL.n++; it.y = y; it.k = k; it.r = r; return it; }
// an object in the depth-sorted list: the sprite, and a well's or quest well's mark and prompt
function drawObjItem(o, world, now) {
  drawObj(o, now);
  const open = wellOpen(GAME, o);
  if ((isQuestWell(o) && questMarkWell(GAME)) || open) { const r = objRec(o.bank, o.fi); if (r) drawQuestMark(o.x + r[4] + r[2] / 2, o.y + r[5] - 12, now); }
  if (open && wildWellNear(world) === o) text('Enter: lower the bucket', o.x, o.y - 40, '#9fd8ff', 7);
}
const DRAW_BY_Y = (a, b) => a.y - b.y;
// the picture an object is cut from (z2tint.js swaps in Verdant Fields' Zenonia 2 colours)
function objAtlas(o) { return img(D.objects.img); }
function drawObj(o, now) {  if (o.draw) return o.draw(o, now);   // home furniture draws itself
  const rec = objRec(o.bank, o.fi, now);
  if (!rec) return;
  const see = behindObj(o, rec), dim = o.alpha != null || see;
  if (dim) { ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(o.alpha ?? 1, see ? SEE_THROUGH.alpha : 1)); }
  if (o._sway === undefined || o._swayFi !== o.fi) { o._sway = TREE_SWAY.has(Number(o.bank) + ':' + o.fi); o._swayFi = o.fi; }   // (worked out once per object, not every frame)
  const sway = now && o._sway ? Math.sin(now / 1700 + o.x * 0.013) * TREE_SWAY.k + Math.sin(now / 610 + o.x * 0.031) * TREE_SWAY.k * 0.25 : 0;
  if (sway) {   // THE BREEZE: a tree leans a touch about its foot, slowly, each on its own beat (its top moves 2 px at most)
    const bx = o.x + rec[4] + rec[2] / 2, by = o.y + rec[5] + rec[3];
    ctx.transform(1, 0, sway, 1, -sway * by, 0);   // (lean about its foot, then lean straight back: cheaper than saving the whole canvas state)
    ctx.drawImage(objAtlas(o), rec[0], rec[1], rec[2], rec[3], Math.round(o.x + rec[4]), Math.round(o.y + rec[5]), rec[2], rec[3]);
    ctx.transform(1, 0, -sway, 1, sway * by, 0);
  } else ctx.drawImage(objAtlas(o), rec[0], rec[1], rec[2], rec[3], Math.round(o.x + rec[4]), Math.round(o.y + rec[5]), rec[2], rec[3]);
  if (o.mimic && !o.opened) drawMimicTell(o, rec, now);
  if (dim) ctx.restore();
}

// ---------------------------------------------------------------- actor rendering
const STATUS_FILTER = { freeze: 'saturate(0.4) brightness(1.35) hue-rotate(170deg)', burn: 'sepia(0.8) saturate(3) hue-rotate(-25deg)',
  poison: 'hue-rotate(70deg) saturate(1.6)', shock: 'brightness(1.8) saturate(0.5)' };
function actorFilter(a) {
  const s = a.status;
  for (const k of ['freeze', 'shock', 'burn', 'poison']) if (s[k]) return STATUS_FILTER[k];
  if (a.shiny) return VARIANT_FILTER.shiny;
  if (a.eliteEvt) return VARIANT_FILTER.elite;
  return 'none';
}
function drawShadow(a) {
  const k = Math.max(0.45, 1 - a.z / 120), w = Math.max(8, (a.h || 26) * 0.36) * (a.scale || 1);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`;
  ctx.beginPath(); ctx.ellipse(a.x, a.y, w * k, w * 0.38 * k, 0, 0, Math.PI * 2); ctx.fill();
}
// ---- bosses: a violet glow round the sprite and a pulsing aura at its feet; while it winds up a spell the glow
// burns white-hot, a ring closes in on it, an "!" bobs over its head, and in the last 0.2 s — the moment to
// block — it flashes PARRY!
function bossGlow(a, now) {
  const w = a.windup ? 1 - a.windup.t / BOSS_WINDUP : 0, p = 0.5 + 0.5 * Math.sin(now / 220);
  const col = w > 0 ? `rgb(255,${Math.round(255 - 80 * (1 - w))},${Math.round(255 - 40 * (1 - w))})` : '#c070ff';
  return `drop-shadow(0 0 ${(3 + 2 * p + w * 6) * RES}px ${col}) drop-shadow(0 0 ${(1 + w * 2) * RES}px ${w > 0 ? '#ffffff' : '#ff80ff'})`;
}
function drawBossAura(a, y, now) {
  const R = Math.max(18, a.h * 0.5) * (a.scale || 1), p = 0.5 + 0.5 * Math.sin(now / 260);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (a.windup) {
    const w = 1 - a.windup.t / BOSS_WINDUP, now2 = a.windup.t < 200, mid = y - a.h * (a.scale || 1) * 0.5;   // (the cue sits on its body and the floor in front: a big boss's head can be off the top)
    ctx.strokeStyle = now2 ? '#ffffff' : `rgba(255,${Math.round(200 + 55 * w)},120,${0.5 + 0.5 * w})`; ctx.lineWidth = now2 ? 3 : 2;   // the ring closes in
    const rr = R * (2.6 - 1.6 * w); ctx.beginPath(); ctx.ellipse(a.x, a.y - 4, rr, rr * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(a.x, a.y - 4, R, R * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    const sg = ctx.createRadialGradient(a.x, y - a.h * 0.5, 2, a.x, y - a.h * 0.5, R * 1.4); sg.addColorStop(0, `rgba(255,255,255,${0.15 + 0.35 * w})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(a.x, y - a.h * 0.5, R * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    text('!', a.x, mid + Math.sin(now / 80) * 2, now2 ? '#ffffff' : '#ffd23f', 16 + w * 6);
    text(now2 ? 'PARRY!' : 'BLOCK…', a.x, a.y + 16, now2 ? `rgba(255,255,255,${0.75 + 0.25 * Math.sin(now / 40)})` : 'rgba(255,220,140,0.85)', now2 ? 11 : 7);
    return;
  }
  ctx.restore();
}
// a full set: motes rising round the hero (defs.js gearShine)
function shineMotes(a, y, now) {
  ctx.save(); ctx.fillStyle = a.shine.col;
  for (let i = 0; i < 5; i++) { const q = (now / 1500 + i / 5) % 1; ctx.globalAlpha = Math.sin(q * Math.PI) * 0.85; ctx.fillRect(Math.round(a.x + Math.sin(i * 2.4 + now / 500) * 11), Math.round(y - 3 - q * 32), 2, 2); }
  ctx.restore();
}
function drawActor(a, now, opts = {}) {
  if (a.away) return;   // indoors for the night (folkday.js)
  if (a.driving && typeof drawDrivenVehicle === 'function') { drawDrivenVehicle(a, now); return; }   // at the wheel (vehicles.js)
  if (a.riding) return;   // a partner or pet riding in the car (vehicles.js)
  if (a.drawSelf) { drawShadow(a); a.drawSelf(a, now); return; }   // drawn by its own hand (the training dummy, training.js)
  drawShadow(a);
  if (a.kind === 'monster' && !a.dead && !a.ally && !a.boss) {
    // rarity aura
    const col = rankColor(a.tier, now);
    const pulse = a.tier >= 6 ? 0.5 + 0.5 * Math.sin(now / 160) : 0.4;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.35 * pulse; ctx.strokeStyle = col; ctx.lineWidth = a.tier >= 6 ? 2 : 1;
    const w = Math.max(10, a.h * 0.42) * a.scale;
    ctx.beginPath(); ctx.ellipse(a.x, a.y, w, w * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  const seq = animSeq(a, a.anim);
  const e = seqFrame(seq, a.t, a.loop, animSpeed(a));
  const blink = a.invuln > 0 && a.state !== 'cast' && a.state !== 'dashing' && Math.floor(a.invuln / 70) % 2 === 0;
  if (a.trail && a.trail.length && a.kind === 'player') {
    // dash afterimages
    const B = a.banks;
    ctx.save(); ctx.filter = `sepia(1) saturate(4) hue-rotate(${Math.round(hueOf(heroLayer(a).body) - 38)}deg) brightness(1.4)`;   // (in the hero's Layer colour: sepia sits at about 38 degrees)
    a.trail.forEach((g, i) => {
      if (i % 2) return;
      ctx.globalAlpha = 0.35 * (1 - g.t / 160);
      for (const b of [B.body, B.weapon].filter(Boolean)) drawBankFrame(b, e, g.x, g.y - a.z);
    });
    ctx.restore();
  }
  ctx.save();
  const pn = performance.now();
  if (a.vibUntil > pn) {   // just hit: shudder side to side (and a touch of squash) through the freeze frame
    const k = (a.vibUntil - pn) / 200;
    ctx.translate((Math.floor(pn / 28) % 2 ? 1 : -1) * Math.min(2.2, 2.2 * k + 0.6), 0);
    ctx.translate(a.x, a.y); ctx.scale(1 + 0.08 * Math.min(1, k), 1 - 0.06 * Math.min(1, k)); ctx.translate(-a.x, -a.y);
  }
  ctx.globalAlpha = (blink ? 0.4 : 1) * (a.alpha ?? 1);
  const f = a.flashT > 0 ? 'brightness(3.2) saturate(0)' : actorFilter(a);
  if (f !== 'none') ctx.filter = f;
  const y = a.y - a.z;
  if (a.kind === 'player') {
    const tr = a.transcend > 0;
    if (tr) transcendAura(a, y, true);
    const sigFront = tr && a.ghalo && typeof lsigilBack === 'function' && (DV[a.dir] || [0, 1])[1] < 0;   // (facing away: the seal is drawn after you, over your back)
    if (tr && a.ghalo && typeof drawLayerSigil === 'function') { if (!sigFront) drawLayerSigil(a, y, pn); if (typeof drawGuardianHalo === 'function') drawGuardianHalo(a, pn); }   // fusion in the Layer: its seal and its guarding ring, behind you (layerswords.js)
    else if (a.banks && a.banks.aura) drawAura(a.x, y, a.banks.aura, pn);
    if (a.chiT > 0) kiAura(a, y, true, pn);   // a Ki release (chi.js)
    // transcended: hair and outfit turn white; the weapon/slash layers are bleached white too
    const L = layerPal(a);
    if (tr && (!a.banksWhite || a.banksWhiteEl !== a.layerEl)) { a.banksWhite = whiteBanks(a.banks, a.layerEl); a.banksWhiteEl = a.layerEl; }
    const B = tr ? a.banksWhite : a.banks;
    const order = (weaponBehind(a.cls, a.dir, a.anim) ? [B.weapon, B.body, B.fx] : [B.body, B.weapon, B.fx]).filter(Boolean);
    if (B.focus && a.dir === 0) drawFocus(a, B, y, e);
    for (const b of order) {
      // ascended: a crisp white rim and a thin glow in the layer's colour; the weapon brightens instead of bleaching
      if (tr && b === B.body && f === 'none') { ctx.save(); ctx.filter = `drop-shadow(0 0 0.6px #ffffff) drop-shadow(0 0 2px rgba(${L.glow},0.9))`; drawBankFrame(b, e, a.x, y); ctx.restore(); }
      else if (tr && b !== B.body && f === 'none') { ctx.save(); ctx.filter = `saturate(0.45) brightness(1.4) drop-shadow(0 0 2px ${L.mote})`; drawBankFrame(b, e, a.x, y); ctx.restore(); }
      else if (a.chiT > 0 && b === B.body && f === 'none') { ctx.save(); ctx.filter = kiFormFilter(pn, a.kiSurge); drawBankFrame(b, e, a.x, y); ctx.restore(); }
      else if (b === B.weapon && B.glow && f === 'none') { ctx.save(); ctx.filter = B.glow; drawBankFrame(b, e, a.x, y); ctx.restore(); }
      else drawBankFrame(b, e, a.x, y);
    }
    if (sigFront) drawLayerSigil(a, y, pn);
    if (tr) transcendAura(a, y, false);
    if (tr && a.lswords && typeof drawLayerSwords === 'function') { const W = window.GAME && GAME.world; if (W) (W.lateDraw = W.lateDraw || []).push(() => drawLayerSwords(a, performance.now())); }   // (over trees and roofs: they fly)
    if (a.lpow && typeof drawLayerPower === 'function') { const W = window.GAME && GAME.world; if (W) (W.lateDraw = W.lateDraw || []).push(() => drawLayerPower(a, performance.now())); }   // the transformation's power-up (layerswords.js)
    if (a.fblade && typeof drawFusionBlade === 'function') { const W = window.GAME && GAME.world; if (W) (W.lateDraw = W.lateDraw || []).push(() => drawFusionBlade(a, performance.now())); }   // the Fusion Blade (layerswords.js)
    if (a.shine && a.shine.n >= 6 && !tr) shineMotes(a, y, pn);
    if (a.chiT > 0) kiAura(a, y, false, pn);
    if (B.focus && a.dir !== 0) drawFocus(a, B, y, e);
    if (B.fist && a.state === 'attack') drawFists(a, y);
    if (a.state === 'block') drawGuard(a, y); drawGuardBar(a, y); drawCounterCue(a, y, now);   // (guard stamina and the counter window: guard.js)
  } else if (a.kind === 'monster' && a.mimic) drawMimic(a, y, now);
  else if (a.kind === 'monster') {
    if (a.boss && !a.dead) ctx.filter = bossGlow(a, now);   // a boss glows (brighter while it winds up a spell)
    else if ((a.wolf || a.evoGlow) && !a.form) ctx.filter = `${a.wolf ? WOLF_FILTER : ''} ${a.evoGlow || ''}`;   // the Loyal Wolf and an evolved partner's glow (pet.js)
    drawBankFrame(a.bank || D.monsters[a.sp] || charBank(a.sp), e, a.x, y, { pal: a.pal, scale: a.scale });
  } else drawBankFrame(D.npcs[a.npc], e, a.x, y);
  ctx.restore();
  if (a.boss && !a.dead) drawBossAura(a, y, now);   // its aura, and the wind-up telegraph
  // (no ring for a shield: a barrier card keeps one up nearly all the time; the HUD's HP bar shows it as a pale line)
  if (a.kind === 'player' && !a.dead && typeof drawHeadIcons === 'function') drawHeadIcons(a, y, now);
  if (a.kind === 'player' && !a.dead && typeof drawHeroTitle === 'function') { const W = window.GAME && GAME.scene === 'world' && GAME.world; if (W) (W.lateDraw = W.lateDraw || []).push(() => drawHeroTitle(a, y, now)); else drawHeroTitle(a, y, now); }   // (over the furniture and trees, not behind them)   // the title you wear   // buffs and debuffs over the head
  if (a.crushWind > 0 && !a.dead) drawCrushWarn(a, y, now);   // a boss winding up its guard crusher (guard.js)
  if (a.fgUp > 0 && !a.dead && typeof drawFoeGuard === 'function') drawFoeGuard(a, y, now);   // a monster's raised shield (foeguard.js)
  else if (a.rushUntil > performance.now() && !a.dead && typeof drawFoeRush === 'function') drawFoeRush(a, y, now);   // its BREAK RUSH (foeguard.js)
  if (a.foeRole && typeof drawFoeRole === 'function') drawFoeRole(a, y, now);   // an archer's aim, a shaman's cast, a warleader's ring (foeroles.js)
  if (a.pet && !a.dead && typeof drawPetBars === 'function') drawPetBars(a, y);   // the dog: HP and hunger
  else if (a.kind === 'monster' && !a.dead && !a.sucked && (opts.tags || a.hp < a.maxHp)) drawNameplate(a, y - a.h * a.scale - 6, now);
  if (a.kind === 'npc' && a.label && !(window.GAME && GAME.scene === 'title')) worldTag([[a.label, '#ffe9a8', 8]], a.x, y - Math.max(36, Math.min(46, D.npcs[a.npc].h + 5)));   // (on a soft pill: hud.js worldTag)   // (not behind the title screen)
  if (a.say && window.GAME && GAME.world) (GAME.world.lateDraw = GAME.world.lateDraw || []).push(() => drawFolkSay(a, y));   // (over the night's tint)
  const qm = a.kind === 'npc' && window.GAME && GAME.scene === 'world' && questMarkNpc(GAME, a);
  if (qm && !(window.GAME && GAME.world && GAME.world.storyGoal && Math.hypot(GAME.world.storyGoal.x - a.x, GAME.world.storyGoal.y - a.y) < 40)) drawQuestMark(a.x, y - QMARK.npcTop, now);   // (the story's goal wears the star instead)
  else if (a.marker) { ctx.fillStyle = a.marker; ctx.beginPath(); ctx.moveTo(a.x - 3, y - 42); ctx.lineTo(a.x + 3, y - 42); ctx.lineTo(a.x, y - 38); ctx.fill(); }
}

// ---------------------------------------------------------------- transcended form & lightning
function whiteBanks(B, el) { return { ...B, body: recolorBank(B.body, 'ascendHair', LAYER_ELS[el || 'lightning'].cloth), focusGlow: '#ffffff' }; }
// Lightning: a midpoint-displaced main channel with forked branches. The shape holds for ~90 ms, then re-forms,
// so it flickers like real lightning instead of buzzing every frame.
function boltPath(x1, y1, x2, y2, seed, segs = 8, jag = 7) {
  const r = rng(Math.floor(seed * 7 + performance.now() / 90));
  let pts = [[x1, y1], [x2, y2]], off = jag * 1.4;
  for (let level = 0; level < 4; level++) {   // midpoint displacement: halve the offset each pass
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const o = (r() - 0.5) * 2 * off;
      out.push([(ax + bx) / 2 - dy / len * o, (ay + by) / 2 + dx / len * o], pts[i]);
    }
    pts = out; off *= 0.52;
  }
  pts.r = r;
  return pts;
}
function boltBranches(pts, n, scale) {
  const r = pts.r, out = [];
  for (let k = 0; k < n; k++) {
    const i = 3 + Math.floor(r() * (pts.length - 6)), [sx, sy] = pts[i], [nx, ny] = pts[i + 2];
    const ang = Math.atan2(ny - sy, nx - sx) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6);
    const len = (8 + r() * 14) * scale;
    out.push(boltPath(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, r() * 1000, 4, len * 0.25));
  }
  return out;
}
function strokeBolt(pts, w, alpha, tint, pal) {
  const P = pal || LAYER_ELS.lightning;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // dark halo (keeps it readable on bright ground) -> body colour -> additive bloom -> pale inner -> white-hot core
  for (const [col, lw, al, op] of [[P.halo, w * 4.2, 0.28, 'source-over'], [tint || P.body, w * 2.4, 0.8, 'source-over'],
    [tint || P.bloom, w * 5, 0.25, 'lighter'], [P.inner, w * 1.3, 0.95, 'source-over'], ['#ffffff', w * 0.55, 1, 'source-over']]) {
    ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha * al; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  ctx.restore();
}
function strokeLightning(x1, y1, x2, y2, seed, w, alpha, tint, branches = 2, pal) {
  const len = Math.hypot(x2 - x1, y2 - y1), main = boltPath(x1, y1, x2, y2, seed, 8, Math.min(14, 3 + len * 0.12));
  for (const br of boltBranches(main, branches, Math.min(1.4, len / 50))) strokeBolt(br, w * 0.5, alpha * 0.8, tint, pal);
  strokeBolt(main, w, alpha, tint, pal);
  // a flash of light where it lands
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x2, y2, 0, x2, y2, 6 + w * 3);
  g.addColorStop(0, `rgba(220,240,255,${0.7 * alpha})`); g.addColorStop(1, 'rgba(80,150,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x2, y2, 6 + w * 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawBolt(b) {
  if (b.t < 0) return;
  if (b.px) return drawPixelBolt(b);
  const k = b.t / b.dur, flick = b.t % 90 < 60 ? 1 : 0.55;   // strobe as it fades
  strokeLightning(b.x1, b.y1, b.x2, b.y2, b.seed, b.w, (1 - k * k) * flick, b.col, 3, b.el ? LAYER_ELS[b.el] : null);
}
// Pixel lightning: crisp 1-px zigzags (white core, cyan edge, no blur) that match the sprites. Used for the
// Ascended form's sparks and for its lash at nearby foes.
function pixelZig(x1, y1, x2, y2, seed, segs, jag) {
  const r = rng(Math.floor(seed)), pts = [[x1, y1]], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 1; i < segs; i++) { const k = i / segs, o = (r() - 0.5) * 2 * jag; pts.push([Math.round(x1 + dx * k + nx * o), Math.round(y1 + dy * k + ny * o)]); }
  pts.push([Math.round(x2), Math.round(y2)]);
  return pts;
}
function strokePixel(pts, alpha, el) {
  ctx.save(); ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
  for (const [col, lw, a, ox] of [[LAYER_ELS[el || 'lightning'].edge, 2, 0.7, 0.5], ['#ffffff', 1, 1, 0]]) {
    ctx.globalAlpha = alpha * a; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x + 0.5 + ox, y + 0.5) : ctx.moveTo(x + 0.5 + ox, y + 0.5)); ctx.stroke();
  }
  ctx.restore();
}
function drawPixelBolt(b) {
  const k = b.t / b.dur;
  strokePixel(pixelZig(b.x1, b.y1, b.x2, b.y2, b.seed + Math.floor(b.t / 50), b.segs || 5, b.jag || 3), 1 - k * k, b.el);
}
// Ascended aura: a soft halo on the ground, motes of light drifting up, and one small crisp spark crackling
// somewhere on the body a few times a second. Nothing big or noisy.
function transcendAura(a, y, behind) {
  const now = performance.now(), cx = a.x, cy = y - 14, L = layerPal(a);
  const fade = Math.min(1, a.transcend / 500);
  if (behind) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 16);
    g.addColorStop(0, `rgba(${L.glow},${0.45 * fade})`); g.addColorStop(1, `rgba(${L.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, a.y, 16, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  for (let i = 0; i < 7; i++) {   // rising motes of light
    const k = ((now / 1500) + i / 7) % 1, x = Math.round(cx + Math.sin(i * 2.6 + now / 900) * (6 + (i % 3) * 3)), yy = Math.round(a.y - 2 - k * 34);
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9 * fade; ctx.fillStyle = i % 3 ? '#ffffff' : L.mote;
    ctx.fillRect(x, yy, 1, 1);
  }
  ctx.restore();
  const slot = Math.floor(now / 320), t = now % 320;   // a small spark every ~0.3 s, lasting ~0.1 s
  if (t < 110) {
    const r = rng(slot * 17 + Math.floor(a.x)), ang = r() * Math.PI * 2, R = 7 + r() * 5;
    const x1 = cx + Math.cos(ang) * R, y1 = cy + Math.sin(ang) * R * 1.4, a2 = ang + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.5);
    if (a.layerEl === 'holy') {   // a four-point twinkle
      const al = fade * (1 - t / 110), px = Math.round(x1), py = Math.round(y1);
      ctx.save(); ctx.globalAlpha = al; ctx.fillStyle = '#fff6c8'; ctx.fillRect(px - 2, py, 5, 1); ctx.fillRect(px, py - 2, 1, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(px, py, 1, 1); ctx.restore();
    } else strokePixel(pixelZig(x1, y1, cx + Math.cos(a2) * (R + 3), cy + Math.sin(a2) * (R + 3) * 1.4, slot, 3, 2), fade * (1 - t / 110), a.layerEl);
  }
}

// Block: a translucent arc of light held in front of the hero; flares when it takes a hit
// BLOCK: a bubble all round the hero (the user's art, assets/block_bubble.png, cut by tools/build_block_bubble.py). It grows
// through its seven frames as the guard goes up (that is the perfect-parry window), then shimmers on the last three. Its shading
// is stored grey and recoloured through the equipped Layer's palette, see-through inside so the hero shows: rim, glow, light.
const BUBBLE = { src: 'assets/block_bubble.png', size: 38, frames: 7, grow: 45, shimmer: 130, lift: 13, tints: {} };
function bubbleTint(el) {
  if (BUBBLE.tints[el]) return BUBBLE.tints[el];
  const im = img(BUBBLE.src); if (!im || !im.complete || !im.naturalWidth) return null;
  const L = LAYER_ELS[el] || LAYER_ELS.holy, hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), stops = [[0, hex(L.halo)], [0.15, hex(L.edge)], [0.4, hex(L.body)], [0.7, hex(L.bloom)], [0.9, hex(L.inner)], [1, [255, 255, 255]]];
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const D = g.getImageData(0, 0, c.width, c.height), p = D.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue; const l = p[i] / 255; let k = 1; while (k < stops.length - 1 && stops[k][0] < l) k++;
    const [t0, c0] = stops[k - 1], [t1, c1] = stops[k], f = Math.min(1, Math.max(0, (l - t0) / (t1 - t0)));
    for (let j = 0; j < 3; j++) p[i + j] = Math.round(c0[j] + (c1[j] - c0[j]) * f);
    p[i + 3] = Math.round(255 * (l < 0.2 ? 0.95 : 0.4 + 0.4 * Math.max(0, l - 0.4) / 0.6));   // (a strong rim, a see-through inside, brighter where it shines)
  }
  g.putImageData(D, 0, 0); return (BUBBLE.tints[el] = c);
}
function drawGuard(a, y) {
  const el = a.layerEl || (typeof layerElementOf === 'function' ? layerElementOf(a) : 'holy'), sheet = bubbleTint(el);
  if (sheet) {
    const now = performance.now(); if (!a.guardAt || now - a.guardLast > 150) a.guardAt = now; a.guardLast = now;   // (its own clock from when the guard went up: a co-op friend's screen has no blockT)
    const t = now - a.guardAt, n = BUBBLE.frames, f = t < BUBBLE.grow * n ? Math.min(n - 1, Math.floor(t / BUBBLE.grow)) : n - 3 + Math.floor(t / BUBBLE.shimmer) % 3;
    const hit = Math.max(0, a.blockFlash || 0) / 160, S = BUBBLE.size, x = Math.round(a.x - S / 2), top = Math.round(y - BUBBLE.lift - S / 2);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(sheet, f * S, 0, S, S, x, top, S, S);
    if (hit > 0 || t < guardPerfect(a)) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, 0.35 + hit * 0.6); ctx.drawImage(sheet, f * S, 0, S, S, x, top, S, S); }   // (a flare as a blow lands, and while a perfect parry is still on)
    ctx.restore(); return;
  }
  const [dx, dy] = DV[a.dir], ang = Math.atan2(dy, dx), cx = a.x + dx * 9, cy = y - 14 + dy * 4;   // (the old front arc, until the art has loaded)
  const hit = Math.max(0, a.blockFlash || 0) / 160, perfect = a.blockT < GUARD.perfect;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = perfect ? 'rgba(255,230,150,0.9)' : `rgba(140,210,255,${0.55 + 0.4 * hit})`; ctx.lineWidth = 2 + hit * 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, 6 + Math.abs(dy) * 6, 12 - Math.abs(dy) * 5, 0, ang - 1.1, ang + 1.1); ctx.stroke();
  ctx.globalAlpha = 0.18 + 0.3 * hit; ctx.fillStyle = '#9fd8ff';
  ctx.beginPath(); ctx.ellipse(cx, cy, 6 + Math.abs(dy) * 6, 12 - Math.abs(dy) * 5, 0, ang - 1.1, ang + 1.1); ctx.fill();
  ctx.restore();
}
// Martial Artist: chi-wrapped fists flare forward on every punch
// an arrow pointing along +x with its tip at (x, y), in the current transform
function drawArrowShape(x, y) {
  ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 1, y); ctx.stroke();
  ctx.fillStyle = '#e8eef5'; ctx.beginPath(); ctx.moveTo(x + 1.5, y); ctx.lineTo(x - 2.5, y - 2); ctx.lineTo(x - 2.5, y + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e04a3a'; ctx.fillRect(x - 13, y - 1.8, 3, 1.2); ctx.fillRect(x - 13, y + 0.6, 3, 1.2);
}

function drawFists(a, y) {
  const k = Math.min(1, a.t / Math.max(1, animLen(a)));
  const ext = Math.sin(k * Math.PI);   // punch out and back
  const [dx, dy] = DV[a.dir];
  const up = a.anim === 'atk3' ? -10 * ext : 0;
  const fx = a.x + dx * (12 + ext * 10), fy = y - 5 + dy * (4 + ext * 8) + up;   // (out in front at hand height: drawn on the body it washed over the hair and face)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {   // motion trail
    const tx = fx - dx * i * 4 * ext, ty = fy - dy * i * 3 * ext - up * i * 0.2;
    const r = ((a.anim === 'atk3' ? 4 : 3) - i * 0.7) * 0.75;
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r * 2);
    g.addColorStop(0, `rgba(255,240,190,${0.9 - i * 0.25})`); g.addColorStop(0.5, `rgba(255,150,40,${0.6 - i * 0.18})`); g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, r * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// the hero's chosen aura (customization): a soft glow on the ground and a few sparks drifting up
function drawAura(x, y, col, now) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const br = 0.75 + 0.25 * Math.sin(now / 380), g = ctx.createRadialGradient(x, y, 0, x, y, 14);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35 * br; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  for (let i = 0; i < 4; i++) { const k = ((now / 1300) + i / 4) % 1, sx = x + Math.sin(i * 2.4 + now / 600) * 8;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.fillRect(Math.round(sx), Math.round(y - 2 - k * 26), 1, 1); }
  ctx.restore();
}
// Mage orb / Summoner tome: held in the hand at the hero's side (a small fist grips its base), glowing; thrust
// forward while attacking.
function drawFocus(a, B, y, e) {
  const atk = a.state === 'attack' || a.state === 'cast';
  const reach = atk ? 3 + 4 * Math.sin(Math.min(1, a.t / 200) * Math.PI) : 0;
  const [fx, fy] = focusHand(a.dir, reach);
  drawHeldFocus(B, a.x + fx, y + fy, atk, performance.now());
}
// where the hand holding the focus is, from the hero's feet (facing up it is behind him)
function focusHand(dir, reach = 0) {
  return dir === 1 ? [6 + reach, -8] : dir === 3 ? [-6 - reach, -8] : dir === 2 ? [7, -7 + reach * 0.5] : [-7, -8 - reach * 0.5];
}
function drawHeldFocus(B, hx, hy, atk, now) {
  const sway = Math.sin(now / 420) * 0.6, cx = hx, cy = hy - 5 + sway;   // the orb / tome sits just above the fist
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = atk ? 10 : 6.5, rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  rg.addColorStop(0, B.focusGlow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = atk ? 0.8 : 0.45; ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  iconCentered('items', B.focus, cx, cy, 11);
  // the fist: dark outline, skin, a shaded knuckle row (the body's own skin tones)
  const x = Math.round(hx) - 2, y = Math.round(hy + sway) - 1;
  ctx.fillStyle = '#18100a'; ctx.fillRect(x - 1, y - 1, 6, 5);
  ctx.fillStyle = '#ceae84'; ctx.fillRect(x, y, 4, 3);
  ctx.fillStyle = '#a57939'; ctx.fillRect(x, y + 2, 4, 1); ctx.fillRect(x + 2, y, 1, 2);
}

function drawSummon(s, now) {
  if (s.t < 0) return;
  const bank = charBank(s.sp); if (!bank) return;   // monster or villager; spell cards have no one to call
  const seq = bank.anims.attack ? bank.anims.attack[s.dir] : bank.anims.idle[s.dir];
  const e = seqFrame(seq, Math.max(0, s.t - 150), false, 0.9);
  ctx.save();
  ctx.globalAlpha = Math.min(1, s.t / 150, (s.dur - s.t) / 250);
  ctx.filter = s.glow ? 'drop-shadow(0 0 3px #ffd23f) brightness(1.15)' : 'drop-shadow(0 0 2px #fff)';
  drawBankFrame(bank, e, s.x, s.y, { pal: s.pal });
  ctx.restore();
}
function drawProj(p) {
  if (p.vfx && window.SPELL_FX && SPELL_FX[p.vfx]) {   // Arcana bolt / Inferno fireball: its effect, looping, turned along its flight
    const M = SPELL_FX[p.vfx], k = Math.floor(p.t / fxMs(M)) % (M.atlas ? M.n : Math.max(1, Math.min(M.n, M.peak + 4)));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(p.x, p.y - p.z); ctx.rotate(Math.atan2(p.vy, p.vx)); drawSpellFxFrame(p.vfx, k, 0, 0, p.vfxScale || 0.55); ctx.restore();
    return;
  }
  if (p.arrow) {   // Archer arrow: a pale streak behind it, the arrow itself turned along its flight
    ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(Math.atan2(p.vy, p.vx));
    const g = ctx.createLinearGradient(-30, 0, -10, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,250,220,0.45)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-10, 0); ctx.stroke();
    drawArrowShape(4, 0); ctx.restore();
    return;
  }
  if (p.orb) {
    // mage bolt: glowing arcane orb
    const k = 0.6 + 0.4 * Math.sin(p.t / 40);
    ctx.fillStyle = 'rgba(150,180,255,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y - p.z, 7 + k * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8f0ff'; ctx.beginPath(); ctx.arc(p.x, p.y - p.z, 3, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (p.dish) {   // Order Up: a spinning plate with a hot dish on it
    const y = p.y - p.z, a = p.t / 60;
    ctx.save(); ctx.translate(p.x, y); ctx.scale(1, 0.55 + 0.25 * Math.sin(a));
    ctx.fillStyle = 'rgba(255,240,180,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f4f8'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9aa0b0'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#d8dce8'; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8642a'; ctx.beginPath(); ctx.arc(-1, -0.5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6ad04a'; ctx.fillRect(0.5, -2, 2, 1.4);
    ctx.restore();
    return;
  }
  const bank = charBank(p.sp);   // the card's monster or villager flies at the foe
  if (!bank) {   // no one to throw: a glowing orb of the element
    const col = ELEMENTS[p.el].col;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(p.x, p.y - p.z, 8, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(p.x, p.y - p.z, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    return;
  }
  const dir = dirTo(p.vx, p.vy);
  const e = seqFrame((bank.anims.walk || bank.anims.idle)[dir], p.t, true);
  ctx.save();
  ctx.fillStyle = ELEMENTS[p.el].col; ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(p.x, p.y - p.z, 9, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.filter = 'drop-shadow(0 0 2px ' + ELEMENTS[p.el].col + ')';
  drawBankFrame(bank, e, p.x, p.y - p.z + 10, { scale: 0.7 });
  ctx.restore();
}
// the Spirit Cannon: the orb swelling at the caster's hands with sparks pouring into it, then the beam — its root at
// the hands, the body stretched out to its length, a flaring burst at the tip, swelling then thinning away
function drawCannonCharge(f) {
  const a = f.owner, held = a.cannonCharge, k = held ? Math.min(1, held.t / CANNON.max) : Math.min(1, f.t / CANNON.charge), [dx, dy] = DV[a.dir], x = a.x + dx * 12, y = a.y - 16 - (a.z || 0) + dy * 4;
  if (held) {   // the power gauge: a ring that fills to full power, with the multiplier
    const full = held.t >= CANNON.max - 1;
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y - 44, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = full ? '#ffffff' : '#9fe8ff'; ctx.beginPath(); ctx.arc(a.x, a.y - 44, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.restore();
    text(`×${cannonMul(held.t).toFixed(1)}`, a.x + 14, a.y - 43.6, full ? '#ffffff' : '#bfefff', 5.6, 'left');
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) { const q = ((f.t / 320) + i / 10) % 1, an = i * 2.4, d = (1 - q) * (34 + k * 26);
    ctx.globalAlpha = q; ctx.fillStyle = i % 2 ? '#9fe8ff' : '#ffffff'; ctx.fillRect(x + Math.cos(an) * d - 1, y + Math.sin(an) * d * 0.8 - 1, 2, 2); }
  ctx.globalAlpha = 1;
  // the orb itself: eight painted stages (assets/ki_orb.png), from a spark to a crackling gold sphere, drifting
  // forward off the hands as it grows and shaking near full power
  const im = img('assets/ki_orb.png'), stage = Math.min(7, Math.floor(k * 8)), jig = k > 0.7 ? 1 : 0, S = 64;
  ctx.globalCompositeOperation = 'source-over';
  if (im && im.complete && im.naturalWidth) { ctx.imageSmoothingEnabled = false; ctx.drawImage(im, stage * S, 0, S, S, Math.round(x + dx * k * 16 - S / 2 + (Math.floor(f.t / 40) % 2 ? jig : -jig)), Math.round(y + dy * k * 10 - S / 2), S, S); }
  else drawSpellFxFrame('kb_charge', Math.floor(f.t / 90) % 2, x, y, 0.12 + k * (held ? 0.36 : 0.26) + Math.sin(f.t / 60) * 0.02);
  ctx.restore();
}
function drawCannonBeam(f) {
  const k = f.t / f.dur, th = (k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45)) * (1 + Math.sin(f.t / 30) * 0.08);
  const an = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][f.dir], B = window.SPELL_FX && SPELL_FX.kb_beam, S0 = SPELL_FX && SPELL_FX.kb_start; if (!B || !S0 || th <= 0) return;
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(an); ctx.scale(1, th); ctx.globalCompositeOperation = 'lighter';
  const s = 0.55 * (f.size || 1), startW = S0.w * s, segW = B.w * s, len = f.len * Math.min(1, k / 0.12);
  drawSpellFxFrame('kb_start', 0, 0, 0, s);
  const x0 = startW * 0.6, im = img(B.img || D.spellcraft), edge = 12, sm = ctx.imageSmoothingEnabled;   // the body: one stretch of the strip's solid middle (its ends fade out, and showed as a split when the strip was tiled)
  if (len > x0 && im && im.complete) { ctx.imageSmoothingEnabled = false; ctx.drawImage(im, edge, B.y, B.w - edge * 2, B.h, x0, -B.py * B.k * s, len - x0, B.h * B.k * s); ctx.imageSmoothingEnabled = sm; }
  drawSpellFxFrame('kb_burst', 1, len, 0, s * (1 + 0.12 * Math.sin(f.t / 40)));
  ctx.restore();
}
// one frame of an atlas animation, centred on (cx, cy). A Spellcraft effect has its own frame size and is drawn
// crisp, with its pivot (ground point / projectile head) at (cx, cy) unless `center` is asked for (card art).
function drawSpellFxFrame(key, k, cx, cy, scale, center) {
  const M = window.SPELL_FX && SPELL_FX[key]; if (!M) return;
  if (M.atlas) {
    const im = img(M.img || D.spellcraft); if (!im || !im.complete) return;
    const s = scale * M.k, ox = center ? M.w / 2 : M.px, oy = center ? M.h / 2 : M.py, sm = ctx.imageSmoothingEnabled, fl = ctx.filter, op = ctx.globalCompositeOperation;
    if (M.solid) ctx.globalCompositeOperation = 'source-over';   // (a card's accent stays strong on bright ground)
    if (M.tint) ctx.filter = M.tint;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, Math.min(k, M.n - 1) * M.w, M.y, M.w, M.h, cx - ox * s, cy - oy * s, M.w * s, M.h * s);
    ctx.imageSmoothingEnabled = sm; ctx.filter = fl; ctx.globalCompositeOperation = op; return;
  }
  const im = img(D.spellFx); if (!im || !im.complete) return;
  const s = 64 * scale; ctx.drawImage(im, Math.min(k, M.n - 1) * 64, M.row * 64, 64, 64, cx - s / 2, cy - s / 2, s, s);
}
function drawFx(f) {
  if (f.t < 0) return;
  if (f.kcharge) { drawCannonCharge(f); return; }
  if (f.kibomb || f.kibombfly || f.kiblast) { drawKiBomb(f); return; }
  if (f.kigather) { drawKiGather(f); return; }
  if (f.kiburst) { drawKiBurst(f); return; }
  if (f.kbeam) { drawCannonBeam(f); return; }
  if (f.vfx) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; if (f.flip) { ctx.translate(f.x, 0); ctx.scale(-1, 1); ctx.translate(-f.x, 0); } drawSpellFxFrame(f.vfx, Math.floor(f.t / fxMs(SPELL_FX[f.vfx] || {})), f.x, f.y, f.scale); ctx.restore(); return; }
  const e = seqFrame(f.seq, f.t, false);
  ctx.save();
  if (f.filter && f.filter !== 'none') ctx.filter = f.filter;
  drawBankFrame(f.bank, e, f.x, f.y, { scale: f.scale });
  ctx.restore();
}
function drawSpark(s) {
  const seq = D.fx.battle.anims[0];
  const e = seqFrame(seq, s.t, false);
  ctx.save();
  if (s.el) ctx.filter = elementFilter(s.el);
  ctx.globalAlpha = 0.85;
  drawBankFrame(D.fx.battle, e, s.x, s.y, { scale: 0.7 });
  ctx.restore();
}

// Draw everything in a world, depth sorted by y, inside the camera transform.
// CLOUD SHADOWS: soft shadows of clouds drifting over the land on the wind, in the chunky stepped style of the
// game's own shadow tiles (the dark grass patches used to be painted on, standing still; now they move). A lattice
// of cells in world space, one cloud per cell (its shape and place hashed from the cell), all of it sliding west.
// Outdoors in the overworld only; none over the Skyreach Isles (smoke, not sky).
const CLOUD_SHADOW = { cell: [430, 320], speed: [-11, 3], alpha: 0.17, step: 4, col: '#0d3a12', sky: '#24407a', shapes: 8 };   // sky: the same shapes in blue-grey over the cloud islands (green on white cloud read as a stain)
let CLOUD_SHAPES = null;
function cloudShapes() {
  if (CLOUD_SHAPES) return CLOUD_SHAPES;
  const R = seededRng(2024), S = CLOUD_SHADOW.step;
  CLOUD_SHAPES = [];
  for (let k = 0; k < CLOUD_SHADOW.shapes; k++) {
    const w = 150 + R() * 130, h = 80 + R() * 70, gw = Math.ceil(w / S), gh = Math.ceil(h / S);
    const blobs = Array.from({ length: 3 + Math.floor(R() * 3) }, () => ({ x: 0.2 + R() * 0.6, y: 0.3 + R() * 0.4, rx: 0.18 + R() * 0.2, ry: 0.22 + R() * 0.2 }));
    const c = document.createElement('canvas'); c.width = gw; c.height = gh; const g = c.getContext('2d'); g.fillStyle = CLOUD_SHADOW.col;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const u = (x + 0.5) / gw, v = (y + 0.5) / gh;
      if (blobs.some(b => ((u - b.x) / b.rx) ** 2 + ((v - b.y) / b.ry) ** 2 <= 1)) g.fillRect(x, y, 1, 1);
    }
    const sky = document.createElement('canvas'); sky.width = gw; sky.height = gh; const q = sky.getContext('2d'); q.drawImage(c, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = CLOUD_SHADOW.sky; q.fillRect(0, 0, gw, gh);
    CLOUD_SHAPES.push({ c, sky, w: gw * S, h: gh * S });
  }
  return CLOUD_SHAPES;
}
function drawCloudShadows(world, cam, vw, vh, now) {
  if (!world.overworld || world.interior || world.cave || world.rift) return;
  const t = now / 1000, ox = t * CLOUD_SHADOW.speed[0], oy = t * CLOUD_SHADOW.speed[1], [cw, ch] = CLOUD_SHADOW.cell, shapes = cloudShapes();
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  ctx.save(); ctx.globalAlpha = CLOUD_SHADOW.alpha; ctx.imageSmoothingEnabled = false;
  const i0 = Math.floor((cam.x - ox - 300) / cw), i1 = Math.floor((cam.x + vw - ox + 40) / cw), j0 = Math.floor((cam.y - oy - 200) / ch), j1 = Math.floor((cam.y + vh - oy + 40) / ch);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const r = hash(i, j); if (r < 0.25) continue;   // a clear patch of sky
    const S = shapes[Math.floor(hash(j, i) * shapes.length)], x = i * cw + ox + hash(i + 7, j) * (cw - S.w * 0.5), y = j * ch + oy + hash(i, j + 7) * (ch - S.h * 0.5);
    if (x > cam.x + vw || x + S.w < cam.x || y > cam.y + vh || y + S.h < cam.y) continue;
    const reg = regionAt(x + S.w / 2); if (reg && (reg.zone === 3 || reg.town === 4 || (MAPS[reg.map] || {}).z2field)) continue;   // (and a whole Zenonia 2 map: on its busy ground the stepped shadows read as patches laid over it, the user: 'overlapping')
    // (the Frozen Abyss and Frostmere skipped above:: on snow their shadows read as grey squares (the Skyreach Isles keep them: clouds passing over the islands)
    const px = (ZOOM * RES);   // (placed to the screen pixel, not the map pixel: whole map pixels made the slow drift step)
    ctx.drawImage((typeof z2CloudArt === 'function' && z2CloudArt(reg, S)) || (reg && reg.tileset === ISLES.ts ? S.sky : S.c), Math.round(x * px) / px, Math.round(y * px) / px, S.w, S.h);
  }
  ctx.restore();
}
// THE GLOOM: the zones beyond a seal that still holds lie under the Sun Sovereign's curse — dimmer and greyer,
// deepening westward (Twilight Grove a dusk, the Skyreach Isles an ashen murk, the Frozen Abyss a dead grey). When a
// zone's Guardian falls, the curse lifts: a dawn sweeps across it from east to west over a few seconds, and it is
// bright from then on. (Verdant Fields and the towns are never under it.)
const GLOOM = { col: ['', 'rgba(70,60,110,A)', 'rgba(90,60,60,A)', 'rgba(90,96,120,A)'], str: [0, 0.32, 0, 0.44], dawn: 4000 };
function drawGloom(w, cam, now) {
  const pr = window.GAME && GAME.profile; if (!pr) return;
  const Z = w.zoom || ZOOM, cleared = pr.cleared || {};
  w.dawnT = w.dawnT || {};
  ctx.save();
  for (let z = 1; z < 4; z++) {
    if (cleared[z] && w.dawnT[z] == null) { if (w.wasDark && w.wasDark[z]) w.dawnT[z] = now; else continue; }   // a fresh dawn only if you saw it dark
    (w.wasDark = w.wasDark || {})[z] = !cleared[z];
    const lift = w.dawnT[z] != null ? Math.min(1, (now - w.dawnT[z]) / GLOOM.dawn) : 0; if (lift >= 1) continue;
    const regs = REGIONS.filter(r => r.zone === z); if (!regs.length) continue;
    const x0 = Math.min(...regs.map(r => r.ox)) * T, x1 = Math.max(...regs.map(r => r.ox + r.w)) * T;
    const sx0 = (x0 - cam.x) * Z, sx1 = (x1 - cam.x) * Z; if (sx1 < 0 || sx0 > VW) continue;
    const edge = sx1 - (sx1 - sx0) * lift;   // the dawn sweeps from the east end (nearest the town behind) westward
    const col = GLOOM.col[z], s0 = GLOOM.str[z], solid = col.replace('A', s0), clear = col.replace('A', 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = solid; ctx.fillRect(Math.max(0, sx0), 0, Math.max(0, Math.min(VW, edge) - Math.max(0, sx0)), VH);   // the zone under the curse
    const fade = (fx, dir) => { const g = ctx.createLinearGradient(fx, 0, fx + dir * 60, 0); g.addColorStop(0, solid); g.addColorStop(1, clear); ctx.fillStyle = g; ctx.fillRect(Math.min(fx, fx + dir * 60), 0, 60, VH); };
    fade(sx0, -1); fade(edge, 1);   // soft edges into the lands either side
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${s0 * 0.9})`;
    ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, sx0), 0, Math.max(0, Math.min(VW, edge) - Math.max(0, sx0)), VH); ctx.clip(); ctx.fillRect(0, 0, VW, VH); ctx.restore();
    if (lift > 0) {   // the dawn's edge: a band of warm light
      ctx.globalCompositeOperation = 'lighter';
      const dg = ctx.createLinearGradient(edge - 50, 0, edge + 30, 0); dg.addColorStop(0, 'rgba(255,220,150,0)'); dg.addColorStop(0.7, `rgba(255,220,150,${0.35 * (1 - lift)})`); dg.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = dg; ctx.fillRect(edge - 50, 0, 80, VH);
    }
  }
  ctx.restore();
}
// SEAMS: at a zoom of 1.15 a map pixel is 2.3 screen pixels, so the edges of pieces drawn side by side (a bridge's stones, a
// sign's panels, shore strips) fall between screen pixels and whatever is underneath shows through as a thin line. While the
// world is drawn, every cut-out piece is laid a hair larger, so it overlaps the next one.
const SEAM = 0.25, ctxImage = ctx.drawImage;
function seamlessImage(im, sx, sy, sw, sh, dx, dy, dw, dh) {
  if (arguments.length === 9) return ctxImage.call(this, im, sx, sy, sw, sh, dx, dy, dw + SEAM, dh + SEAM);
  return ctxImage.apply(this, arguments);
}
// THE SKY BELOW the Skyreach Isles: under the see-through sky a deep blue falls away, with two layers of pixel cloud far below
// drifting on the wind and sliding slower than the islands as you walk (the nearer layer faster), and every island casting its
// shadow down onto it, so the islands float.
const SKY_BELOW = { top: '#2f62c4', bottom: '#86c2f4', shadow: [10, 26], shade: 'rgba(14,34,92,0.32)',
  layers: [{ par: 0.2, cell: [120, 74], px: 2, a: 0.5, wind: -5 }, { par: 0.42, cell: [210, 120], px: 3, a: 0.85, wind: -11 }] };
let SKY_PUFFS = null;
function skyPuffs() {   // little clouds in the game's pixel style: white on top, a pale blue underside, a flat-ish base
  if (SKY_PUFFS) return SKY_PUFFS;
  const R = seededRng(77); SKY_PUFFS = [];
  for (let k = 0; k < 7; k++) {
    const W = 22 + Math.floor(R() * 26), H = 9 + Math.floor(R() * 6), bl = Array.from({ length: 3 + Math.floor(R() * 3) }, (_, n, a) => ({ x: 0.15 + 0.7 * (n + R() * 0.6) / 4, y: 0.55 + R() * 0.1, r: 0.22 + R() * 0.16 }));
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H; if (v > 0.9) continue;
      const d = Math.min(...bl.map(b => Math.hypot((u - b.x) * W / H * 0.5, v - b.y) / b.r)); if (d > 1) continue;
      g.fillStyle = v > 0.68 ? '#c9dcf6' : d > 0.82 && v < 0.5 ? '#eef5ff' : '#ffffff'; g.fillRect(x, y, 1, 1);
    }
    SKY_PUFFS.push(c);
  }
  return SKY_PUFFS;
}
const skyInView = (cam, vw) => REGIONS.some(r => r.tileset === ISLES.ts && (r.ox - 3) * T < cam.x + vw && (r.ox + r.w + 3) * T > cam.x);
function drawSkyBelow(cam, now) {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, SKY_BELOW.top); g.addColorStop(1, SKY_BELOW.bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  const P = skyPuffs(), hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  ctx.save(); ctx.imageSmoothingEnabled = false;
  SKY_BELOW.layers.forEach((L, n) => {
    const [cw, ch] = L.cell, ox = -cam.x * ZOOM * L.par + now / 1000 * L.wind, oy = -cam.y * ZOOM * L.par;
    ctx.globalAlpha = L.a;
    for (let i = Math.floor(-ox / cw) - 1; i <= Math.floor((VW - ox) / cw) + 1; i++) for (let j = Math.floor(-oy / ch) - 1; j <= Math.floor((VH - oy) / ch) + 1; j++) {
      if (hash(i + n * 97, j) < 0.3) continue;
      const im = P[Math.floor(hash(j, i + n * 31) * P.length)], x = Math.round(ox + i * cw + hash(i + 5, j) * cw * 0.6), y = Math.round(oy + j * ch + hash(i, j + 5) * ch * 0.6);
      ctx.drawImage(im, x, y, im.width * L.px, im.height * L.px);
    }
  });
  ctx.restore();
}
function chunkShadow(ch) {   // a chunk of the world in one dark tint: laid offset under it, it is the islands' shadow on the sky below
  if (!ch.sh) { const c = document.createElement('canvas'); c.width = ch.c.width; c.height = ch.c.height; const g = c.getContext('2d'); g.drawImage(ch.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = SKY_BELOW.shade; g.fillRect(0, 0, c.width, c.height); ch.sh = c; }
  return ch.sh;
}
function drawWorld(world, cam, bg, now) {
  world.cam = cam; ctx.drawImage = seamlessImage;
  const Z = world.zoom || ZOOM, vw = VW / Z, vh = VH / Z;
  const skyView = world.overworld && bg && bg.chunks && skyInView(cam, vw);
  if (skyView) drawSkyBelow(cam, now);
  ctx.save();
  const sx = world.shake ? rand(-world.shake, world.shake) : 0, sy = world.shake ? rand(-world.shake, world.shake) : 0;
  ctx.scale(Z, Z);
  ctx.translate(Math.round(-cam.x + sx), Math.round(-cam.y + sy));
  if (skyView) for (const ch of bg.chunks) if (ch.c && ch.x < cam.x + vw + 4 && ch.x + ch.w > cam.x - 40) ctx.drawImage(chunkShadow(ch), ch.x + SKY_BELOW.shadow[0], SKY_BELOW.shadow[1]);
  if (bg && bg.chunks) { for (const ch of bg.chunks) if (ch.x < cam.x + vw + 4 && ch.x + ch.w > cam.x - 4) { const im = bg.lazy ? chunkCanvas(bg, ch) : ch.c; ctx.drawImage(im, ch.x, 0, ch.w + 0.5, im.height); } if (bg.lazy) tendChunks(bg, cam, vw); }   // (a hair wider than it is, under the next chunk: at this zoom their edges fall between screen pixels and left a line)
  else ctx.drawImage(bg, world.bgX, world.bgY);
  if (world.decorBehind) world.decorBehind(world, now);
  for (const d of world.drops) if (d.x > cam.x - 40 && d.x < cam.x + vw + 40 && d.y > cam.y - 30 && d.y < cam.y + vh + 60) drawDropHop(d, now);   // (only what is on screen)
  for (const r of world.rings) {
    if (r.t < 0) continue;
    const k = r.t / 450;
    ctx.strokeStyle = r.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * (0.3 + k), r.r * 0.45 * (0.3 + k), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawDust(world, now);   // little puffs at the hero's feet (below)
  if (world.overworld && !world.interior) drawRipples(world, cam, now);   // rings and the odd fish on the water (below)
  const items = DRAW_POOL.list; items.length = 0; DRAW_POOL.n = 0; const tagOpt = { tags: world.showTags };
  { const F = world.foesNear = world.foesNear || []; F.length = 0; const px = cam.x, pw = vw + 64; for (const a of world.actors) if (a.kind === 'monster' && !a.dead && !a.ally && a.x > px - 32 && a.x < px + pw) F.push(a); }   // (for behindObj: the monsters on screen, gathered once a frame)
  for (const P of world.portals || []) drawPortal(P, now);
  drawCaves(world, now, items);   // the black hole hangs in the air: depth-sorted with everyone
  if (typeof drawSafePoints === 'function') drawSafePoints(world, now, items);
  if (typeof drawParkedCar === 'function') drawParkedCar(world, now, items);   // your car, parked (vehicles.js)
  if (typeof drawSideShrines === 'function') drawSideShrines(world, now, items);
  if (typeof drawStoryBeats === 'function') drawStoryBeats(world, now, items);   // a chapter's shrines and the one it sent you to find (storybeats.js)   // side areas' shrines (sideareas.js)
  if (typeof drawDojoRing === 'function') drawDojoRing(world, now);   // the Dojo's sparring ring (dojo.js)   // each zone's safe point, and the Waystone at home
  if (world.overworld) drawTotems(world, now);   // the skull totems' cursed ground
  if (typeof drawZoneEvents === 'function') drawZoneEvents(world, now);   // a spring's pool, meteor marks
  if (typeof drawWandererPrompt === 'function' && world.overworld) drawWandererPrompt(world);   // 'Enter: talk' over a traveller
  drawChestBeacons(world, now);
  drawJourney(world, now);

  for (const o of objsBetween(world, cam.x - 200, cam.x + vw + 200)) {
    if (o.remove || o.x < cam.x - 200 || o.x > cam.x + vw + 200 || (o.bottom ?? o.y) < cam.y - 20 || o.y > cam.y + vh + 260) continue;
    if (o.ground) { drawObj(o, now); continue; }   // decks and bridges lie under everyone
    items.push(drawPoolTake(o.sortY ?? o.bottom ?? o.y, 1, o));
  }
  for (const a of world.actors) {
    if (a.animalBody || a.x < cam.x - 60 || a.x > cam.x + vw + 60 || a.y < cam.y - 40 || a.y > cam.y + vh + 80) continue;
    items.push(drawPoolTake(a.y, 2, a));
  }
  if (world.animals) drawAnimals(world, cam, vw, vh, items);   // herds and the farm's animals (animals.js)
  if (world.nodes && window.GAME) drawNodes(world, GAME, cam, vw, vh, items, now);   // herb patches and ore veins (nodes.js)
  for (const s of world.summons) items.push({ y: s.y, draw: () => drawSummon(s, now) });
  for (const p of world.projs) items.push({ y: p.y, draw: () => drawProj(p) });
  if (world.overworld && world.evilGate && typeof drawEvilGate === 'function') items.push({ y: world.evilGate.y + 2, draw: () => drawEvilGate(world, now) });   // the dark teleporter's archway stands among everyone (evilgate.js)
  if (typeof drawChargeLane === 'function') for (const a of world.actors) if ((a.fcCharge || a.fcLane) && !a.dead) drawChargeLane(a, now);   // chargers' lanes lie on the ground under everyone (foecharge.js)
  const tf = ctx.getTransform();   // (once, not per item: getTransform makes a new matrix object each time, ~300 a frame of garbage)
  items.sort(DRAW_BY_Y);
  for (let ii = 0; ii < items.length; ii++) { const i = items[ii]; try { if (i.k === 1 && !i.draw) drawObjItem(i.r, world, now); else if (i.k === 2 && !i.draw) drawActor(i.r, now, tagOpt); else i.draw(); } catch (e) { ctx.setTransform(tf); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; if (!drawWorld.warned) { drawWorld.warned = true; console.warn('a thing failed to draw', e); } } } items.length = 0; drawHeroGhost(world, cam, vw, vh);   // (one broken thing can't blank the whole frame and the HUD)
  if (typeof drawHoleCompass === 'function' && world.overworld && !world.interior) drawHoleCompass(world, now);   // the dog sniffs out black holes (over everyone, so it reads)
  if (world.decor) world.decor(world, now);
  for (const bt of world.bolts) drawBolt(bt);
  // fusion cast: dim the world, then ground circle -> caster -> orbital rings on top (layer system)
  for (const c of world.circles) {
    const k = Math.min(1, c.t / 300, (c.dur - c.t) / 300);
    ctx.fillStyle = `rgba(4,4,12,${0.62 * k})`;
    ctx.fillRect(cam.x - 40, cam.y - 40, vw + 80, vh + 80);
    drawFusionCircle(ctx, c, 'ground');
    if (c.owner) drawActor(c.owner, now);
    drawFusionCircle(ctx, c, 'orbits');
  }
  for (const f of world.fx) { if (f.kbeam && world.tint) (world.lateDraw = world.lateDraw || []).push(() => drawCannonBeam(f)); else drawFx(f); }   // (the Spirit Cannon is its own light: the night's tint turned it a dull grey)
  for (const s of world.sparks) drawSpark(s);
  for (const s of world.slashes) drawSlash(ctx, s);
  for (const p of world.particles) {
    const k = p.t / p.life;
    ctx.globalAlpha = (p.puff ? 0.45 : 1) * (1 - k); ctx.fillStyle = p.col;
    if (p.streak) {   // motion-stretched spark
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = p.col; ctx.lineWidth = (p.size || 1.4) * (1 - k * 0.5); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke(); ctx.restore();
    } else if (p.puff) { ctx.beginPath(); ctx.arc(p.x, p.y, (p.size || 2) * (1 + k * 1.5), 0, Math.PI * 2); ctx.fill(); }
    else { const s = p.size || 2; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (world.tint) {
    // zone mood (e.g. night): multiply the whole scene, then redraw floating numbers on top
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = world.tint; ctx.fillRect(0, 0, VW, VH); ctx.restore();
  }
  if (world.overworld) drawGloom(world, cam, now);   // the curse over the zones whose seal still holds (below)
  if (world.overworld) drawDread(world, now);   // near a high-rank black hole the world darkens and drains (caves.js)
  ctx.save();
  ctx.scale(Z, Z);
  ctx.translate(Math.round(-cam.x), Math.round(-cam.y));
  drawCloudShadows(world, cam, vw, vh, now);   // over everything on the ground, under the damage numbers
  if (world.lateDraw) { for (const f of world.lateDraw) f(); world.lateDraw = []; }   // labels kept clear of the night's tint (a black hole's plate)
  if (world.platePops && world.platePops.length) drawPlatePops(world, performance.now());
  if (world.glints && world.glints.length) drawGlints(world, performance.now());
  if (world.overworld && !world.interior) drawButterflies(world, cam, now);   // a few butterflies over the towns by day (below)
  for (const f of world.floats) {
    if (f.str === 'PAYBACK!' || (typeof f.str === 'string' && f.str[0] === '~')) continue;   // (drawn as their own effects: riposte.js drawPaybacks, elemreact.js reaction icons)
    if (!f.num) { ctx.globalAlpha = Math.min(1, (800 - f.t) / 200); text(f.str, f.x, f.y - f.t * 0.035, f.col, Math.max(7, f.size - 1)); ctx.globalAlpha = 1; continue; }   // (labels fade out at the end instead of blinking off)
    // damage numbers punch in big, settle, hop up and drift aside, then fade
    const pop = 1 + 0.45 * Math.max(0, 1 - f.t / 110), hop = f.t < 260 ? Math.sin(f.t / 260 * Math.PI) * 6 : 0;   // (a soft pop: cozy, not punchy)
    ctx.globalAlpha = Math.min(1, (800 - f.t) / 250);
    text(f.str, f.x + (f.vx || 0) * f.t / 1000, f.y - hop - Math.max(0, f.t - 260) * 0.02, f.col, f.size * pop);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (world.flash && world.flash.t >= 0) {
    const k = world.flash.t / world.flash.dur;
    ctx.fillStyle = world.flash.col; ctx.globalAlpha = 0.2 * Math.max(0, 1 - k) * (k < 0.1 ? k * 10 : 1);   // (a soft wash, cozy: it was 0.35)
    ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1;
  }
  if (world.weeds && world.weeds.t > 0) drawWeeds(world.weeds, now);
  delete ctx.drawImage;
}
// In the Weeds: the edges of the screen go cold and still, a slow pulse rolls in, and a clock ring ticks
function drawWeeds(W, now) {
  const k = Math.min(1, W.t / 400, (W.dur - W.t) / 300 + 0.2);
  ctx.save();
  const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VW * 0.62);
  g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.6, `rgba(60,120,170,${0.18 * k})`); g.addColorStop(1, `rgba(20,60,110,${0.6 * k})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(160,230,255,${0.35 * k})`; ctx.lineWidth = 1.2;
  const r = (now / 6) % 260;
  ctx.globalAlpha = 1 - r / 260; ctx.beginPath(); ctx.ellipse(VW / 2, VH / 2, r * 1.6, r, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  text(`IN THE WEEDS · ${(W.t / 1000).toFixed(1)}s`, VW / 2, 62, '#bfefff', 10);
}

// LOOT HOPS OUT: the first time a drop is seen it springs up in a little arc and lands with a tiny bounce (0.42 s), its
// ground shadow staying put; drops the hero is already pulling in skip it.
function drawDropHop(d, now) {
  if (window.GAME && GAME.net && GAME.net.role === 'guest') return drawDrop(d, now);   // (an online guest's drops are rebuilt from every snapshot: no hop there)
  if (d.born == null) d.born = d.pulled ? 0 : now;
  const k = d.born ? (now - d.born) / 420 : 1;
  if (!(k < 1)) return drawDrop(d, now);
  const h = k < 0.75 ? Math.sin(k / 0.75 * Math.PI) * 13 : Math.sin((k - 0.75) / 0.25 * Math.PI) * 2.5, s = Math.min(1, 0.5 + k * 3);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - h / 16)})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, 7 * (1 - h / 30), 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(d.x, d.y - h); ctx.scale(s, s); ctx.translate(-d.x, -d.y); drawDrop(d, now); ctx.restore();
}
function drawDrop(d, now) {
  if (d.kind === 'card') return drawCardDrop(d, now);
  const bob = Math.sin(now / 220 + d.x) * 2;
  const col = rankColor(d.item.tier, now);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  // rank-coloured light pillar so drops are easy to spot
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const tall = 26 + d.item.tier * 3;
  const pg = ctx.createLinearGradient(0, d.y, 0, d.y - tall);
  pg.addColorStop(0, col); pg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(now / 180 + d.x);
  ctx.fillStyle = pg; ctx.fillRect(d.x - 4, d.y - tall, 8, tall);
  ctx.globalAlpha = 0.6; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(d.x, d.y, 7 + 2 * Math.sin(now / 200), 2.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (d.kind === 'coin') {
    iconCentered('coins', Math.floor(now / 90 + d.x) % 8, d.x, d.y - 12 + bob, 13);   // the coin turns as it floats
    gleam(d.x + 4, d.y - 16 + bob, 2.5, '#ffffff', 0.8);
  } else if (d.kind === 'potion') {
    icon('items', 128, d.x - 8, d.y - 20 + bob);
  } else {
    iconCentered('items', d.item.icon, d.x, d.y - 14 + bob, 16);
  }
}

// A dropped card lies still, face down, and its rarity shows as a loot beam: a soft glow on the ground in the
// rank colour; from C up a light beam rises (taller and brighter each rank) with a few motes drifting up it.
function drawCardDrop(d, now) {
  const t = d.item.tier, prism = t === 9;
  const col = prism ? `hsl(${(now / 10) % 360},90%,70%)` : RANK_COL[t];
  const cx = d.x, cy = d.y - 9, w = 11, h = 15;
  const breathe = 0.9 + 0.1 * Math.sin(now / 420 + d.x);
  // ground glow
  ctx.save();
  const gr = 9 + t;
  const gg = ctx.createRadialGradient(cx, d.y, 0, cx, d.y, gr);
  gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = (0.35 + t * 0.035) * breathe; ctx.fillStyle = gg;
  ctx.beginPath(); ctx.ellipse(cx, d.y, gr, gr * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  // loot beam (C and up)
  if (t >= 3) {
    const tall = 22 + (t - 3) * 9, bw = 3 + (t - 3) * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    const bg = ctx.createLinearGradient(0, d.y, 0, d.y - tall);
    bg.addColorStop(0, col); bg.addColorStop(0.7, col); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.28 * breathe; ctx.fillStyle = bg; ctx.fillRect(cx - bw * 1.8, d.y - tall, bw * 3.6, tall);
    ctx.globalAlpha = 0.55 * breathe; ctx.fillRect(cx - bw / 2, d.y - tall, bw, tall);
    for (let i = 0; i < Math.min(5, t - 2); i++) {   // motes
      const k = (now / 1600 + i / 5) % 1;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + Math.sin(i * 2.1 + now / 700) * bw * 1.4, d.y - 3 - k * tall, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  // the card, still and face down, with a thin rank-coloured edge
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, d.y, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; rrect(ctx, cx - w / 2 - 0.7, cy - h / 2 - 0.7, w + 1.4, h + 1.4, 1.5); ctx.fill();
  drawCardBack(cx - w / 2, cy - h / 2, w, h, now);
}

function cameraFor(world, target) {
  const b = world.bounds, Z = world.zoom || ZOOM, vw = VW / Z, vh = VH / Z;
  // maps smaller than the view (house interiors) are centred
  const cx = b.x1 - b.x0 < vw ? (b.x0 + b.x1 - vw) / 2 : clamp(target.x - vw / 2, b.x0, b.x1 - vw);
  const cy = b.y1 - b.y0 < vh ? (b.y0 + b.y1 - vh) / 2 : clamp(target.y - vh / 2 - 8, b.y0, b.y1 - vh);
  return { x: Math.round(cx), y: Math.round(cy) };
}

// Zenonia 2 heroes hold their weapon across the face when standing, walking or casting, and every hero facing the
// camera rests it over a shoulder (the Paladin's greatsword would cover his face): draw it behind the body then (it
// still shows past the body's edges), and in front only while swinging. Facing away, it is always behind.
const weaponBehind = (cls, dir, anim) => dir === 0 || ((dir === 2 || (CLASSES[cls] && CLASSES[cls].z2)) && !/^(atk|skill)/.test(anim || ''));
// Monster health bar (below): a bubbly pixel capsule with its label above.
const PLATE_FONT = FONT;   // nameplates share the game's fantasy serif
// The health bar over a monster: a bubbly pixel capsule that flashes and bounces when hit and fades a while after; a shield-bearer's guard shows as a small blue capsule under it. Rounded ends and a thick white outline, white lines at 75% and 50%; inside, a juicy fill
// (red for a monster, green for an ally) with a big glossy shine along its top, a little sparkle and a darker foot, a soft
// yellow chunk for what your last hit took before it drains away, and a deep plum track with its own faint shine. Its label
// sits above the bar's left end in bold outlined letters: the rank letter in the rank's colour, then the name; a boss,
// Guardian or alpha also gets its tag in gold above.
// The yellow chunk a hit leaves on a health bar: it stays put for a moment, then fades out. Quick hits in a row keep
// it lit and let it grow. A heal past it clears it. key keeps the HUD's and the name plate's chunks apart.
// Returns { v: the top of the chunk (0..1), a: its opacity }.
const HP_GHOST = { hold: 450, fade: 450, col: '255,224,102' };
function hpGhost(a, key, k, now) {
  let G = a[key];
  if (!G) { const f = a.hitAt && now - a.hitAt < 300 ? 1 : k; G = a[key] = { top: f, last: f, at: -1e9 }; }   // (a plate that first shows for a hit: it was full a moment ago)
  const live = now - G.at < HP_GHOST.hold + HP_GHOST.fade;
  if (k < G.last - 1e-6) { G.top = live ? Math.max(G.top, G.last) : G.last; G.at = now; }   // a fresh hit
  else if (k >= G.top) G.top = k;   // healed past it
  G.last = k;
  const t = now - G.at, al = t < HP_GHOST.hold ? 1 : Math.max(0, 1 - (t - HP_GHOST.hold) / HP_GHOST.fade);
  if (al <= 0) G.top = k;
  return { v: Math.max(k, G.top), a: al };
}
const PIXBAR = { w: 32, wBoss: 48, h: 10, hBoss: 12, line: '#ffffff', ticks: [0.75, 0.5], tick: 'rgba(255,255,255,0.8)', stay: 3500, fade: 700, near: 70, nearA: 0.55, bounce: 260, flash: 150, track: '#4a2a1c', trackTop: '#6a4430', trail: '#ffe066',
  fill: '#ff4a62', fillFoot: '#c8243e', ally: '#46d07a', allyFoot: '#24985a', low: '#ff8a7a', shine: 'rgba(255,255,255,0.75)', shine2: 'rgba(255,255,255,0.35)' };
// STATUS CHIPS beside a monster's bar: a little white-outlined chip per status it suffers (combat.js a.status), each with a
// 5x5 pixel symbol: burning, poisoned, frozen, slowed, shocked, cracked
const STATUS_CHIPS = [
  ['burn',   '#ff8a2a', ['..#..', '.###.', '##.##', '#####', '.###.']],
  ['poison', '#58c84a', ['..#..', '.###.', '#####', '#####', '.###.']],
  ['freeze', '#6ad0ff', ['#.#.#', '.###.', '##.##', '.###.', '#.#.#']],
  ['slow',   '#8a7aff', ['#####', '.###.', '..#..', '.###.', '#####']],
  ['shock',  '#ffd23a', ['...##', '..##.', '.###.', '.##..', '##...']],
  ['crack',  '#9a8a7a', ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']],
];
function drawStatusChips(a, x, top, H) {
  const S = a.status; if (!S) return;
  let cx = x - 8;
  for (const [k, col, g] of STATUS_CHIPS) {
    if (!S[k]) continue;
    const cy = top + Math.round((H - 7) / 2);
    ctx.fillStyle = PIXBAR.line; pxRound(cx, cy, 7, 7, 1); ctx.fillStyle = col; ctx.fillRect(cx + 1, cy + 1, 5, 5);
    ctx.fillStyle = mixCol(col, '#1a0a14', 0.7); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') ctx.fillRect(cx + 1 + c, cy + 1 + r, 1, 1);
    cx -= 8;
  }
}
// a small health capsule in the same style, for the heroes' companions (the dog, the partner, a friend's pets): white-outlined,
// rounded, a glossy green fill that turns red under 30%
function drawMiniCapsule(cx, top, w, f) {
  const x = Math.round(cx - w / 2), y = Math.round(top), h = 6, iw = w - 2, fw = Math.round(iw * Math.max(0, Math.min(1, f)));
  ctx.fillStyle = 'rgba(20,8,16,0.35)'; pxRound(x + 1, y + 1, w, h, 1);
  ctx.fillStyle = PIXBAR.line; pxRound(x, y, w, h, 1);
  ctx.fillStyle = PIXBAR.track; ctx.fillRect(x + 1, y + 1, iw, h - 2);
  if (fw > 0) { const low = f < 0.3; ctx.fillStyle = low ? PIXBAR.fill : PIXBAR.ally; ctx.fillRect(x + 1, y + 1, fw, h - 2); ctx.fillStyle = low ? PIXBAR.fillFoot : PIXBAR.allyFoot; ctx.fillRect(x + 1, y + h - 2, fw, 1); ctx.fillStyle = PIXBAR.shine; ctx.fillRect(x + 2, y + 1, Math.max(0, fw - 2), 1); }
}
// a pixel-rounded box (corners cut a step at a time, r 1 or 2)
function pxRound(x, y, w, h, r) { for (let i = 0; i <= r; i++) ctx.fillRect(x + r - i, y + i, w - (r - i) * 2, h - i * 2); }
// RIPPLES: now and then, somewhere on the water in view (a river, a map's own pond or lake, the open water round the maps),
// a soft ring spreads and fades; once in a while a little fish leaps and drops back in. Just for the calm.
const RIPPLE = { every: 420, life: 1600, fish: 0.12, max: 10 };
function waterAtPx(x, y) {
  if (inRiverAt(x, y)) return !WILDS.bridges.some(b => b && x >= b.x0 * T - 8 && x <= (b.x1 + 1) * T + 8 && y >= b.y * T - 16 && y <= (b.y + bridgeRows(b)) * T + 16);
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  for (const R of REGIONS) for (const q of [R, ...(R.subs || [])]) {
    if (tx < q.ox || tx >= q.ox + (q.w || MAPS[q.map].w) || ty < q.oy || ty >= q.oy + (q.h || MAPS[q.map].h)) continue;
    const M = MAPS[q.map], i = (ty - q.oy) * M.w + tx - q.ox; if (M._trim && M._trim[i]) return true;   // (trimmed edges are open water)
    return waterTile(M.tileset, (M.ground[i] & 0xff) - 1);
  }
  const R = REGIONS[Math.max(0, Math.min(REGIONS.length - 1, regionIndexAt(x)))];   // between the maps: open water, but not the sky or the lava lands
  return !!R && R.tileset !== ISLES.ts && !LAVA_TS.has(R.tileset);
}
function drawRipples(world, cam, now) {
  const L = world.ripples = (world.ripples || []).filter(r => now - r.t0 < RIPPLE.life);
  if (cam && now - (world.rippleAt || 0) > RIPPLE.every && L.length < RIPPLE.max) {
    world.rippleAt = now;
    const x = cam.x + 10 + Math.random() * (WVW - 20), y = cam.y + 10 + Math.random() * (WVH - 20);
    if (waterAtPx(x, y) && waterAtPx(x - 12, y) && waterAtPx(x + 12, y) && waterAtPx(x, y + 8)) L.push({ x, y, t0: now, fish: Math.random() < RIPPLE.fish });
  }
  ctx.save(); ctx.lineWidth = 1;
  for (const r of L) {
    const t = now - r.t0;
    if (r.fish && t < 520) {   // the leap: a tiny dark fish on an arc, with a glint
      const k = t / 520, fx = r.x - 6 + k * 12, fy = r.y - Math.sin(k * Math.PI) * 10;
      ctx.fillStyle = 'rgba(40,60,80,0.85)'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 1, 1);
      continue;
    }
    const t2 = r.fish ? t - 520 : t, k = Math.max(0, t2) / (RIPPLE.life - (r.fish ? 520 : 0));
    for (const [d, a] of [[0, 0.5], [0.22, 0.32]]) {   // two rings, the second a beat behind
      const kk = k - d; if (kk <= 0 || kk >= 1) continue;
      const rr = 2 + kk * 9; ctx.strokeStyle = `rgba(232,246,255,${a * (1 - kk)})`;
      ctx.beginPath(); ctx.ellipse(r.fish ? r.x + 6 : r.x, r.y, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
// FOOTSTEP DUST: every 12 px the hero walks, a tiny soft puff rises at the feet and fades (0.38 s), drifting back the way
// they came; none in the air, at the wheel, or riding along. Drawn on the ground, under everyone.
function drawDust(world, now) {
  const p = world.player, D = world.dust = world.dust || [];
  if (p && !p.dead && !p.driving && !p.riding && !(p.z > 0.5)) {
    if (p.dustX == null || Math.hypot(p.x - p.dustX, p.y - p.dustY) > 40) { p.dustX = p.x; p.dustY = p.y; }   // (a teleport or a new map: start fresh)
    const dx = p.x - p.dustX, dy = p.y - p.dustY, d = Math.hypot(dx, dy);
    if (p.state === 'dashing' && p.dashing && !p.dustDash) {   // a dash kicks off with a little burst behind the hero
      p.dustDash = true; const L = Math.hypot(p.dashing.dx, p.dashing.dy) || 1, bx = -p.dashing.dx / L, by = -p.dashing.dy / L;
      for (let i = 0; i < 4; i++) { const sp = (i - 1.5) * 0.45; D.push({ x: p.x + bx * 3, y: p.y - 1, vx: bx * 2 - by * sp * 2, vy: by * 2 + bx * sp * 2, t0: now - i * 15, big: 1.4 }); }
      while (D.length > 20) D.shift();
    } else if (p.state !== 'dashing') p.dustDash = false;
    if (d >= 12) { p.dustFoot = !p.dustFoot; D.push({ x: p.x + (p.dustFoot ? 2.5 : -2.5), y: p.y - 1, vx: -dx / d, vy: -dy / d, t0: now }); p.dustX = p.x; p.dustY = p.y; if (D.length > 16) D.shift(); }
  }
  world.dust = D.filter(u => now - u.t0 < 380);
  for (const u of world.dust) {
    const k = Math.max(0, (now - u.t0) / 380), r = (1.2 + 2.3 * Math.sqrt(k)) * (u.big || 1), a = 0.32 * (1 - k);
    ctx.fillStyle = `rgba(236,226,206,${a})`;
    ctx.beginPath(); ctx.arc(u.x + u.vx * k * 4, u.y + u.vy * k * 2 - k * 2.5, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(u.x + u.vx * k * 4 + 1.8, u.y + u.vy * k * 2 - k * 1.5, r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}
// BUTTERFLIES: by day, over Hearthvale and the outpost towns, a few small butterflies drift in lazy loops, wings beating, with a
// faint shadow under them; they fade at dusk. Each lives in a 150 px cell of the map that has one (a quarter of them), so they
// stay put as the camera moves. Just for the calm: they never touch anything.
const BFLY = { cell: 150, cols: ['#fff6e0', '#ffe27a', '#ffc0dc', '#b8e4ff', '#d8c0ff'] };
function drawButterflies(world, cam, now) {
  const pr = window.GAME && GAME.profile, day = 1 - (typeof nightK === 'function' ? nightK(pr) : 0); if (day <= 0.05 || !cam) return;
  const C = BFLY.cell, x0 = Math.floor((cam.x - 20) / C), x1 = Math.floor((cam.x + WVW + 20) / C), y0 = Math.floor((cam.y - 20) / C), y1 = Math.floor((cam.y + WVH + 20) / C);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const hsh = Math.abs(Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453) % 1; if (hsh > 0.26) continue;
    const ax = (cx + 0.2 + hsh * 2.4) * C, ay = (cy + 0.3 + ((hsh * 7.3) % 0.5)) * C; if (!inTown(ax)) continue;
    const t = now / 1000 + hsh * 50, x = ax + Math.sin(t * 0.37) * 34 + Math.sin(t * 0.91) * 10, y = ay + Math.sin(t * 0.53 + 1) * 18 + Math.cos(t * 1.3) * 5, alt = 10 + Math.sin(t * 1.7) * 3;
    const flap = Math.abs(Math.sin(t * 14 + hsh * 9)), col = BFLY.cols[Math.floor(hsh * 100) % BFLY.cols.length], dir = Math.cos(t * 0.37) >= 0 ? 1 : -1;
    ctx.save(); ctx.globalAlpha = day * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(Math.round(x - 1), Math.round(y), 3, 1);   // (its shadow on the ground)
    ctx.translate(Math.round(x), Math.round(y - alt)); ctx.scale(dir, 1);
    const fx = 0.25 + flap * 0.75, tip = mixCol(col, '#5a3a50', 0.45);
    for (const sg of [-1, 1]) {   // (a pair of wings each side: a rounded upper one with a darker tip, a small lower one; they fold toward the body as they beat)
      ctx.save(); ctx.translate(sg < 0 ? 0 : 1, 0); ctx.scale(sg * fx, 1);
      ctx.fillStyle = col; ctx.fillRect(0, -4, 2, 1); ctx.fillRect(0, -3, 3, 1); ctx.fillRect(0, -2, 3, 1); ctx.fillRect(0, 0, 2, 1); ctx.fillRect(0, 1, 1, 1);
      ctx.fillStyle = tip; ctx.fillRect(2, -4, 1, 1); ctx.fillRect(3, -3, 1, 2); ctx.fillRect(2, 0, 1, 1);
      ctx.restore();
    }
    ctx.fillStyle = '#3a2a30'; ctx.fillRect(0, -3, 1, 4); ctx.fillStyle = 'rgba(58,42,48,0.7)'; ctx.fillRect(-1, -5, 1, 1); ctx.fillRect(1, -5, 1, 1);   // (its body and two antennae)
    ctx.restore();
  }
}
// PICKED UP: each drop the hero takes leaves a tiny four-point twinkle over their head that grows, spins a little and shrinks (0.32 s)
function drawGlints(world, now) {
  world.glints = world.glints.filter(g => now - g.t0 < 320);
  for (const g of world.glints) {
    const k = (now - g.t0) / 320, sz = 4.5 * Math.sin(k * Math.PI), rot = k * 0.8;
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(rot); ctx.globalAlpha = 1 - k * 0.4;
    ctx.fillStyle = g.col; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? sz * 0.28 : sz, an = i * Math.PI / 4; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.5, -0.5, 1, 1);
    ctx.restore();
  }
}
// THE LAST HIT: a dying monster's capsule pops (an empty capsule that swells and fades, with four white specks) instead of blinking out
function drawPlatePops(world, now) {
  world.platePops = world.platePops.filter(p => now - p.t0 < 260);
  for (const p of world.platePops) {
    const k = (now - p.t0) / 260, s = 1 + 0.35 * Math.sin(k * Math.PI / 2), cy = p.top + p.h / 2;
    ctx.save(); ctx.globalAlpha = p.a * (1 - k) * (1 - k);
    ctx.translate(p.cx, cy); ctx.scale(s, s); ctx.translate(-p.cx, -cy);
    ctx.fillStyle = PIXBAR.line; pxRound(p.x, p.top, p.w, p.h, 2);
    ctx.fillStyle = PIXBAR.track; pxRound(p.x + 2, p.top + 2, p.w - 4, p.h - 4, 1);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = p.a * (1 - k); ctx.fillStyle = '#ffffff';
    const d = 4 + k * 12;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(Math.round(p.cx + dx * (p.w / 2 + d * 0.6)), Math.round(cy + dy * d * 0.5), 2, 2);
    ctx.restore();
  }
}
function drawNameplate(a, y, now) {
  const boss = a.boss, ally = a.ally, B = PIXBAR, name = a.label || (SPECIES[a.sp] || {}).name || (a.heroPartner ? 'Partner' : '???');
  const W = boss ? B.wBoss : B.w, H = boss ? B.hBoss : B.h, x = Math.round(a.x - W / 2), top = Math.round(y - H);
  // a hit (its health went down since the last look): the bar flashes white and bounces, popping back in if it had faded
  if (a.hpSeen == null) a.hpSeen = a.hp;
  if (a.hp < a.hpSeen - 0.01) { if (a.hpShow == null || !(a.plateA > 0)) a.hpShow = clamp(a.hpSeen / a.maxHp, 0, 1); a.plateWasHidden = !(a.plateA > 0.3); a.hitAt = now; if (!ally && window.GAME) GAME.plateTarget = a; }   // (the latest monster hit is the target: only it shows its full name)
  a.hpSeen = a.hp;
  // IDLE BARS FADE: a monster's bar stays for a while after its last hit, then fades; one close to your hero keeps a soft
  // bar, so a fight only shows the bars that matter. Bosses and allies always show theirs.
  let alpha = 1;
  if (!boss && !ally) {
    const since = a.hitAt ? now - a.hitAt : Infinity, p = window.GAME && GAME.world && GAME.world.player;
    alpha = since < B.stay ? 1 : since < B.stay + B.fade ? 1 - (since - B.stay) / B.fade : 0;
    if (p && Math.hypot(p.x - a.x, p.y - a.y) < B.near) alpha = Math.max(alpha, B.nearA);
    if (a.fgUp > 0) alpha = 1;   // (a raised shield always shows its guard)
  }
  a.plateA = alpha;
  if (alpha <= 0) { a.plateBox = null; return; }
  a.plateBox = { x, top, w: W, h: H };   // (the bar's box: book.js puts its NEW tag just to the right of it)
  ctx.save(); ctx.globalAlpha = alpha;
  const hk = a.hitAt ? (now - a.hitAt) / B.bounce : 1;
  if (hk < 1) {   // the bounce: a quick squash and stretch about the bar's middle (bigger when it pops back in)
    const e = Math.sin(hk * Math.PI) * (1 - hk) * (a.plateWasHidden ? 1.6 : 1), sx = 1 + 0.12 * e, sy = 1 - 0.1 * e + (a.plateWasHidden ? 0.15 * (1 - hk) : 0), cy = top + H / 2;
    ctx.translate(a.x, cy); ctx.scale(sx, sy); ctx.translate(-a.x, -cy);
  }
  // a gold tag above a boss
  const rc = rankColor(a.tier, now), rk = ally ? '' : RANKS[a.tier], fs = boss ? 6.6 : 6;
  if (boss) text(a.guardian != null ? 'GUARDIAN' : a.alphaKey ? 'ALPHA' : a.miniBoss ? 'MINI BOSS' : 'BOSS', x + 2, top - 10.5, a.alphaKey ? ALPHA.col : '#ffd24a', 5, 'left');
  // the label: only the monster you hit last (and bosses, allies) shows a line above its bar, rank then name; the others keep just the bar
  const tgt = ally || boss || !window.GAME || GAME.plateTarget === a, rcol = rc === 'rainbow' ? '#ffffff' : rc;
  if (tgt) { const tw = textW(rk ? rk + ' ' : '', fs) + textW(name, fs); let lx = a.x - tw / 2; if (rk) { text(rk, lx, top - 3.5, rcol, fs, 'left'); lx += textW(rk + ' ', fs); } text(name, lx, top - 3.5, ally ? '#c8ffd8' : '#fff4d8', fs, 'left'); }
  // the capsule
  const k = clamp(a.hp / a.maxHp, 0, 1), dtr = Math.min(80, now - (a.hpTrailT || now)); a.hpTrailT = now;
  const gh = hpGhost(a, 'ghPlate', k, now);   // the yellow chunk a hit leaves, which fades out
  if (!ally) drawStatusChips(a, x, top, H);
  ctx.fillStyle = 'rgba(20,8,16,0.35)'; pxRound(x + 1, top + 1, W, H, 2);   // (a soft drop shadow)
  ctx.fillStyle = a.lastStretch && !ally ? `rgba(255,${200 + Math.round(30 * Math.sin(now / 220))},80,1)` : B.line; pxRound(x, top, W, H, 2);   // (on its last stretch the pill's own outline glows gold, laststretch.js)
  a.hpShow = a.hpShow == null || k > a.hpShow ? k : Math.max(k, a.hpShow - dtr * 0.004);   // (the health slides down over about a quarter-second)
  const ix = x + 2, iy = top + 2, iw = W - 4, ih = H - 4, fw = Math.round(iw * a.hpShow), tw = ally || gh.a <= 0 ? fw : Math.max(fw, Math.round(iw * gh.v));
  ctx.fillStyle = B.track; pxRound(ix, iy, iw, ih, 1);
  ctx.fillStyle = B.trackTop; ctx.fillRect(ix + 2, iy + 1, iw - 4, 1);
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  if (tw > fw) { ctx.save(); ctx.beginPath(); ctx.rect(ix + fw, iy, tw - fw, ih); ctx.clip(); ctx.globalAlpha *= gh.a; ctx.fillStyle = B.trail; pxRound(ix, iy, iw, ih, 1); ctx.restore(); }
  if (fw > 0) {
    const blink = !ally && k < 0.25 && Math.floor(now / 160) % 2;
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, fw, ih); ctx.clip();
    ctx.fillStyle = ally ? B.ally : blink ? B.low : B.fill; pxRound(ix, iy, Math.max(fw, 3), ih, 1);
    ctx.fillStyle = ally ? B.allyFoot : B.fillFoot; ctx.fillRect(ix + 1, iy + ih - 1, Math.max(0, fw - 2), 1);   // (a darker foot)
    ctx.restore();
    if (fw > 4) { ctx.fillStyle = B.shine; ctx.fillRect(ix + 2, iy + 1, fw - 4, 1); ctx.fillStyle = B.shine2; ctx.fillRect(ix + 2, iy + 2, Math.max(0, fw - 6), 1); }   // the glossy shine
    if (fw > 3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(ix + 1, iy + 1, 1, 1); }   // a sparkle at its rounded start
  }
  const fl = a.hitAt ? 1 - (now - a.hitAt) / B.flash : 0;
  if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${0.85 * fl})`; pxRound(ix, iy, iw, ih, 1); }   // the hit flash
  ctx.restore();
  if (!ally && (a.fgRoll || a.fgUp > 0) && typeof FOEGUARD !== 'undefined' && !(a.fgBroken > 0)) {   // a shield-bearer's GUARD: a small blue capsule tucked under the health one, orange when nearly broken (foeguard.js)
    const g = clamp((a.fgSt ?? FOEGUARD.st) / FOEGUARD.st, 0, 1), gx = x + 3, gyy = top + H - 1, gW = W - 6, gH = 5, gi = gW - 2, gw = Math.round(gi * g);
    ctx.fillStyle = B.line; pxRound(gx, gyy, gW, gH, 1);
    ctx.fillStyle = '#26365a'; ctx.fillRect(gx + 1, gyy + 1, gi, gH - 2);
    if (gw > 0) { ctx.fillStyle = g < 0.3 ? '#ffb36a' : '#6ad0ff'; ctx.fillRect(gx + 1, gyy + 1, gw, gH - 2); ctx.fillStyle = g < 0.3 ? '#ffe0b8' : '#d8f6ff'; ctx.fillRect(gx + 1, gyy + 1, gw, 1); }
  }
  ctx.restore();
}
// Big objects (trees, statues, machines, lava rocks…) that stand on ground the map marks as walkable get a solid
// footprint at their base, so you bump into the trunk but can still walk behind the top. Houses keep their doors.
// Zenonia 2 marks the cells of bridges and wooden decks with flag 0x20 (walkable, "over" the ground below).
// An object lying on such cells is a deck: you walk across it, so it is drawn beneath characters and is not solid.
// Objects you walk ON, drawn under everyone: wooden plank bridges (224), ice-plank bridges (267), rail tracks (275),
// metal grates (270), golden floor tiles (259), broken stone bridge pieces (075) and a ground splash (262).
// Zenonia 2 maps also flag their decks in the tile data (0x20), which catches any others.
const DECK_BANKS = new Set(['224', '267', '275', '270', '259', '075', '262']);
function isDeckObject(M, bank, fi, x, y) {
  if (DECK_BANKS.has(pad3(bank))) return true;
  const rec = objRec(pad3(bank), fi); if (!rec) return false;
  const x0 = Math.floor((x + rec[4]) / T), y0 = Math.floor((y + rec[5]) / T), x1 = Math.floor((x + rec[4] + rec[2] - 1) / T), y1 = Math.floor((y + rec[5] + rec[3] - 1) / T);
  let deck = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) continue;
    if ((M.ground[ty * M.w + tx] >> 8) & 0x20) deck++;
  }
  return deck >= 2;
}
// the giant trees: their whole canopy is solid, so nothing walks behind one and vanishes under it
const GIANT_TREE = o => o.bank === '046' && o.fi >= 2 && o.fi <= 4;
function giantTreeBox(o) { const r = objRec(o.bank, o.fi), cx = o.x + r[4] + r[2] / 2, bw = r[2] * 0.82, bh = r[3] * 0.92; o.box = { x: cx - bw / 2, y: o.bottom - bh, w: bw, h: bh }; }
function autoSolid(o, m) {
  if (o && !o.box && GIANT_TREE(o) && objRec(o.bank, o.fi)) { giantTreeBox(o); return; }
  if (!o || o.box || o.chest || o.breakable || o.push || +o.bank === 13 || +o.bank === 7) return;
  const rec = objRec(o.bank, o.fi); if (!rec || rec[3] < 24 || rec[2] > 200) return;
  const cx = o.x + rec[4] + rec[2] / 2;
  if (mapSolidAt(m, cx, o.bottom - 4)) return;   // the map already blocks it
  const bw = Math.max(10, Math.min(rec[2] * 0.5, 30)), bh = Math.min(10, Math.max(6, rec[3] * 0.18));
  o.box = { x: cx - bw / 2, y: o.bottom - bh, w: bw, h: bh }; o.autoSolid = true;
}
// objects with a footprint, bucketed by 128-px column (rebuilt when objects come and go, and every half second
// for pushed stones) — the long overworld holds thousands of objects
function objGrid(world) {
  const objs = world.objects, now = performance.now();
  if (world._grid && world._gridN === objs.length && now - world._gridT < 500) return world._grid;
  const g = new Map();
  for (const o of objs) {
    const b = o.box; if (!b) continue;
    for (let c = Math.floor((b.x - 4) / 128), c1 = Math.floor((b.x + b.w + 4) / 128); c <= c1; c++) { let L = g.get(c); if (!L) g.set(c, L = []); L.push(o); }
  }
  world._grid = g; world._gridN = objs.length; world._gridT = now;
  return g;
}
// every object bucketed by 128-px column of its x, plus the short lists the per-frame code walks (chests with a beacon; crates
// and chests that animate). The long overworld holds over 36,000 objects, and walking them all several times a frame cost
// about 3 ms; this is rebuilt only when objects come or go (and every few seconds, for pushed stones).
function objCols(world) {
  const objs = world.objects || [], now = performance.now();
  if (world._cols && world._colsOf === objs && world._colsN === objs.length && now - world._colsT < 4000) return world._cols;
  const c = new Map(), special = [], props = [];
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]; o._i = i;
    const k = Math.floor(o.x / 128); let L = c.get(k); if (!L) c.set(k, L = []); L.push(o);
    if (o.randChest || o.sideCache || o.campChest) special.push(o);
    if (o.breakable || o.chest || o.breaking != null) props.push(o);
  }
  Object.assign(world, { _cols: c, _colsOf: objs, _colsN: objs.length, _colsT: now, _special: special, _props: props });
  return c;
}
// the objects whose x lies between x0 and x1, in their order in world.objects (so overlapping ones draw as before)
function objsBetween(world, x0, x1) {
  const c = objCols(world), out = [];
  for (let k = Math.floor(x0 / 128), k1 = Math.floor(x1 / 128); k <= k1; k++) { const L = c.get(k); if (L) for (const o of L) if (o.x >= x0 && o.x <= x1) out.push(o); }
  return out.length > 1 ? out.sort((a, b) => a._i - b._i) : out;
}
const objSpecial = world => (objCols(world), world._special);
const objProps = world => (objCols(world), world._props);
function blockedFn(world) {
  return (x, y, a) => {
    if (a && a.state === 'air') return false;
    const m = world.map;
    if (mapSolidAt(m, x - 4, y) || mapSolidAt(m, x + 4, y)) return true;
    const L = objGrid(world).get(Math.floor(x / 128));
    if (L) for (const o of L) {
      const b = o.box;
      if (b && x > b.x - 3 && x < b.x + b.w + 3 && y > b.y && y < b.y + b.h + 2) return true;
    }
    return false;
  };
}

function mapWorld(key, bounds) {
  const map = MAPS[key];
  const b = bounds || { x0: 0, y0: 0, x1: map.w * T, y1: map.h * T };
  const w = newWorld(b);
  w.map = map;
  w.bg = renderMapBg(map);
  w.bgX = 0; w.bgY = 0;
  w.objects = map.objB.map(makeMapObject).filter(Boolean);
  for (const o of w.objects) if (isDeckObject(map, o.bank, o.fi, o.x, o.y)) { o.ground = true; o.box = null; }   // bridges & decks under you
  if (map.tileset !== 100 && key !== 'town') for (const o of w.objects) if (!o.ground) autoSolid(o, map);
  w.blocked = blockedFn(w);
  w.tileSolid = (x, y) => mapSolidAt(map, x, y);
  return w;
}

// ================================================================ THE OVERWORLD
// One seamless map, west to east: Frozen Abyss · Skyreach Isles · Twilight Grove · Verdant Fields · Castle Town.
// Walking out of town's west road crosses a bridge straight into Verdant Fields. The town is peaceful.
const WILDS = generateWilds(WORLD_SEED);   // see worldgen.js: rebuilt from the decoded maps for every world seed
const REGIONS = WILDS.regions; skyJoin(WILDS);
const regMap = R => MAPS[R.map || R.key];
const TOWN_REG = REGIONS.find(r => r.key === 'town');   // Hearthvale (the outpost towns are towns too: zone -1, r.town 1-4)
// the outpost towns (worldgen.js OUTPOST): where their house door, waystone, farm plots and well stand in the world
const OUTPOSTS = REGIONS.filter(r => r.town).map(r => {
  const i = r.town - 1, ox = r.ox * T, oy = r.oy * T, V = outpostLayout(i), H = OUTPOST_TOWNS[i];
  return { i, R: r, name: H.name, price: H.price, sub: H.sub, x0: ox, x1: ox + r.w * T,
    door: { x: ox + V.home.bx * T + 8, y: oy + V.home.by * T }, dojo: { x: ox + V.dojo.bx * T + 8, y: oy + V.dojo.by * T }, stone: { x: ox + V.stone[0] * T, y: oy + V.stone[1] * T },
    well: { x: ox + V.well[0] * T + 8, y: oy + V.well[1] * T + 12 }, camp: { chest: { x: ox + OUTPOST_CAMP[i][0][0] * T + 8, y: oy + OUTPOST_CAMP[i][0][1] * T + 12 }, fire: { x: ox + OUTPOST_CAMP[i][1][0] * T + 8, y: oy + OUTPOST_CAMP[i][1][1] * T + 12 } },
    plots: V.plots.map(([px, py]) => ({ x: ox + (px + 1) * T, y: oy + (py + 1) * T })) };
}).sort((a, b) => a.i - b.i);
const outpostAt = x => OUTPOSTS.find(O => x >= O.x0 - 4 && x < O.x1 + 4) || null;
const TOWN_OX = TOWN_REG.ox * T, TOWN_OY = TOWN_REG.oy * T;
const SPAWN_RESPAWN_MS = 1000;   // a new monster every second while a region is below its count

// village-local positions (map vtown, see worldgen.js); the overworld offsets them by TOWN_OX/OY
const ALTAR = { x: VILLAGE.fountain.bx * T + 8, y: VILLAGE.fountain.by * T + 4 };   // the plaza fountain serves as the Fusion Altar
const ALTAR_W = { x: ALTAR.x + TOWN_OX, y: ALTAR.y + TOWN_OY };
const HOME_DOOR = { x: VILLAGE.home.bx * T + 8, y: VILLAGE.home.by * T };            // village-local
const TOWN_NPCS = [
  // each merchant stands beside the door of their shop
  ...VILLAGE.shops.map(S => ({ npc: S.npc, x: S.bx * T + 8 + 22, y: S.by * T + 14, label: `${S.label}  ${S.sym}`, role: S.role, still: true })),
  { npc: '123', x: ALTAR.x + 44, y: ALTAR.y + 18, label: 'Altar Keeper', role: 'altar', still: true },
  { npc: '105', x: 4 * T + 8, y: 16 * T - 2, label: 'Gate Warden', role: 'gate', still: true },
  { npc: '124', x: 60 * T + 8, y: 20 * T + 8, label: 'Curio Collector', role: 'collector', still: true },
  { npc: '125', x: ALTAR.x - 44, y: ALTAR.y + 18, label: 'Raid Herald', role: 'raid', still: true },   // the end-game raids (raids.js)
  { npc: '106', x: 52 * T + 8, y: 32 * T + 8, label: 'Lake Angler', role: 'angler', still: true },
  // out only after dark (folkday.js)
  { npc: '105', x: 22 * T + 8, y: 22 * T + 8, label: 'Night Watch', role: 'folk', still: true, nightOnly: true, line: 'All quiet. That is what worries me. Go on, hunter, the lamps are lit.' },
  { npc: '110', x: 62 * T + 8, y: 22 * T + 8, label: 'Stargazer', role: 'folk', still: true, nightOnly: true, line: 'That bright one over the Wilds was not there last season. Nobody ever believes me.' },
];
// the rest of the town: only some of them are out today (folk.js)
const TOWN_CROWD = [
  ...[['100', 14, 21], ['101', 34, 20], ['109', 15, 24], ['110', 11, 14], ['115', 36, 14], ['102', 33, 23]].map(([npc, x]) => ({ npc, x })),
  ...FOLK.hearthvale.map(([npc, label, x, y, line, still]) => ({ npc, label, x, role: 'folk', line, still })),
];
const townCrowdToday = () => folkToday(TOWN_CROWD, TOWN_SLOTS.length, n => n.x, 0).map((n, i) => ({ ...n, x: TOWN_SLOTS[i][0] * T + 8, y: TOWN_SLOTS[i][1] * T + 8, roam: !n.still, nightOff: true }));
const NPC_LINES = {
  cards: 'Cards hold a monster\'s soul. Equip ten — but only three can be cast. Choose wisely!',
  shop_gear: 'Blades, helms and boots — honest steel for honest gold. And I buy what you drag back from the Wilds.',
  shop_item: 'Potions for the road, bread for the belly, seeds for your garden. What will it be?',
  shop_weapon: 'Every blade here was forged for the road ahead. Sharper than anything back in Hearthvale — have a look.',
  shop_armor: 'Helms, mail, boots and charms, fitted for the Wilds out here. And I buy what you have outgrown.',
  inn: 'Rest a while, traveller. Your strength returns and your journey is recorded.',
  altar: 'Offer two or three cards to the fountain. What it returns is far stronger…',
  arena: 'The Arena awaits. Test your build against a friend or our champion!',
  style: 'New hair? A fresh outfit? Sit down, hero — let me work my magic.',
  quest: 'Looking for work, hunter? The board holds bounties from every corner of the Wilds. Bring proof and I pay well.',
  gacha: 'The stars hold countless cards. Offer a Summon Coin and let fate choose one for you.',
  dojo: 'Welcome to my dojo. Beat me, and I will teach you the SPIRIT CANNON — a technique you will find nowhere else. Ready? (Enter)',
  gate: 'West of here the road runs into the Wilds — a long, long way. Pack food: an empty belly makes a weak arm.',
};

const regionIndexAt = x => { let r = 0; REGIONS.forEach((g, i) => { if (x >= g.ox * T - 24) r = i; }); return r; };
const regionAt = x => REGIONS[regionIndexAt(x)];
const inTown = x => x >= TOWN_OX - 4 || !!outpostAt(x);   // Hearthvale (the east end) or an outpost town

// The overworld is ~20 000 px wide, so its background is painted in 2048-px chunks (only the chunks on screen are
// drawn each frame). Each chunk paints just the regions that overlap it.
const BG_CHUNK = 512;   // (2026-11-08: was 2048; the first draw of a 2048 x 1776 strip stalled 45-75 ms as it went to the graphics card)
const BG_KEEP = 4096;   // (strips this far out of view may be dropped)
// Rivers run in the gaps between maps and follow each map's edge row by row: in every row the water reaches over
// the map's wall of trees / cliffs up to (never onto) reachable ground, and on the crossing rows up to where the
// walkway starts — so the bridge spans only water. The banks slope at most one tile per row and are drawn as smooth
// curves. riverShape(i) gives per-row pixel edges L[y], R[y].
const RIVERS = [], RIVER_MAX_WIDEN = 0;   // banks follow the maps' own edges (cutting into them sliced through cliffs and doorways)
function riverShape(i) {
  if (RIVERS[i]) return RIVERS[i];
  const a = REGIONS[i], b = REGIONS[i + 1], bd = WILDS.bridges[i], W = WILDS.w, H = WILDS.h;
  const reach = (x, y) => WILDS.reach[y * W + x];
  const ea = a.ox + a.w - 1, eb = b.ox;   // last column of the left map, first of the right one
  const dA = [], dB = [];
  for (let y = 0; y < H; y++) {
    let k = 0; while (k < RIVER_MAX_WIDEN && ea - k >= a.ox && !reach(ea - k, y)) k++; dA.push(k);
    k = 0; while (k < RIVER_MAX_WIDEN && eb + k < b.ox + b.w && !reach(eb + k, y)) k++; dB.push(k);
  }
  const fill = (d, R) => { for (let y = 0; y < H; y++) d[y] = d[clamp(y, R.oy, R.oy + R.h - 1)]; };   // rows beyond a map copy its edge row
  fill(dA, a); fill(dB, b);
  if (bd) for (const y of bridgeRowList(bd)) { dA[y] = clamp(ea - bd.x0, 0, RIVER_MAX_WIDEN); dB[y] = clamp(bd.x1 - eb, 0, RIVER_MAX_WIDEN); }
  for (const d of [dA, dB]) {   // gentle banks: at most one tile in or out per row
    for (let y = 1; y < H; y++) d[y] = Math.min(d[y], d[y - 1] + 1);
    for (let y = H - 2; y >= 0; y--) d[y] = Math.min(d[y], d[y + 1] + 1);
  }
  const L = dA.map(k => (ea + 1 - k) * T), R = dB.map(k => (eb + k) * T);
  return (RIVERS[i] = { L, R, x0: Math.min(...L), x1: Math.max(...R) });
}
// A tree left out by a bridge (it would stand over the deck) takes its trunk's blocked tiles with it — the town's
// forest wall marks those tiles solid itself, so without this an invisible wall stays by the bridge.
function openUnder(map, o) {
  const y = Math.floor((o.bottom - 6) / T);
  for (let x = Math.floor((o.x - 20) / T); x <= Math.floor((o.x + 20) / T); x++) for (const ty of [y, y - 1]) {
    if (x < 0 || ty < 0 || x >= map.w || ty >= map.h || inRiverAt(x * T + 8, ty * T + 8)) continue;
    map.solid[ty * map.w + x] = 0; if (map.reach) map.reach[ty * map.w + x] = 1;
  }
}
// does an object's sprite reach over a river bridge's deck (the stretch from bank to bank, plus its landings)?
let RIVER_DECKS = null;   // (worked out once: this runs for every object on the map)
function onRiverBridge(o) {
  const r = objRec(o.bank, o.fi); if (!r) return false;
  const x0 = o.x + r[4], y0 = o.y + r[5], x1 = x0 + r[2], y1 = y0 + r[3];
  RIVER_DECKS = RIVER_DECKS || WILDS.bridges.flatMap((bd, i) => { if (!bd || i + 1 >= REGIONS.length) return []; const S = riverShape(i); return [{ L: bankL(S, bd) - 14, R: bankR(S, bd) + 14, top: bd.y * T - 4, bot: (bd.y + bridgeRows(bd)) * T + 6 }]; });
  return RIVER_DECKS.some(D => x0 < D.R && x1 > D.L && y0 < D.bot && y1 > D.top);
}
// is (x, y) on a walkable deck object (bridge planks, rails, grates)? Props and mini bosses stay off them.
function onDeck(w, x, y) {
  if (!w.deckRects) w.deckRects = w.objects.filter(o => o.ground && DECK_BANKS.has(o.bank)).map(o => { const r = objRec(o.bank, o.fi); return r && [o.x + r[4] - 12, o.y + r[5] - 12, o.x + r[4] + r[2] + 12, o.y + r[5] + r[3] + 12]; }).filter(Boolean);
  return w.deckRects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
}
function inRiverAt(px, py) {
  const y = clamp(Math.floor(py / T), 0, WILDS.h - 1);
  for (let i = 0; i + 1 < REGIONS.length; i++) { const S = riverShape(i); if (px >= S.x0 && px < S.x1) return px >= S.L[y] && px < S.R[y]; }
  return false;
}
// Paint river i between y0 and y1: smooth curved banks; green lands get the Zenonia look (deep-blue channel, darker
// water, Zenonia 2 lake shores), other lands a coloured flow. Still water: painted once into the background.
function paintRiver(g, i, y0, y1) {
  const S = riverShape(i), a = REGIONS[i];
  const r0 = Math.max(0, Math.floor(y0 / T) - 1), r1 = Math.min(WILDS.h - 1, Math.floor(y1 / T) + 1);
  const side = A => { const p = [[A[r0], r0 * T]]; for (let y = r0; y <= r1; y++) p.push([A[y], y * T + T / 2]); p.push([A[r1], (r1 + 1) * T]); return p; };
  const Lp = side(S.L), Rp = side(S.R), Mp = Lp.map((p, k) => [(p[0] + Rp[k][0]) / 2, p[1]]);
  const curve = (pts, first) => {
    first ? g.moveTo(pts[0][0], pts[0][1]) : g.lineTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length - 1; k++) g.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
    g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  };
  const body = () => { g.beginPath(); curve(Lp, true); curve(Rp.slice().reverse(), false); g.closePath(); };
  // each bank runs only alongside its own map: above or below a map the river is just part of the open water
  const b = REGIONS[i + 1], span = R => [R.oy * T, (R.oy + (R === REGIONS[REGIONS.length - 1] ? VILLAGE.lakeY : R.h)) * T];   // Hearthvale: down to its lake
  // land: the grassy bank only where the map's edge tile is open ground; water: its dark edge and foam all along the map
  const banks = (style, lw, land = true) => { g.strokeStyle = style; g.lineWidth = lw; for (const [P, R, ex] of [[Lp, a, a.w - 1], [Rp, b, 0]]) {
    const [s0, s1] = span(R), M = regMap(R), on = []; g.save(); g.beginPath();
    for (let ty = Math.floor(s0 / T); ty < Math.ceil(s1 / T); ty++) {
      const i = (ty - R.oy) * M.w + ex, edgeWet = REF_FLAT_WATER.includes((M.ground[i] & 0xff) - 1) || waterTile(R.tileset, (M.ground[i] & 0xff) - 1);
      // the water's edge only where the map ends in land; the grassy bank only on open ground (other lands: their dark lip runs along all their land, not just the walkable rows, so it is not broken into stubs)
      on.push(land && green ? !M.solid[i] : !edgeWet);
    }
    // a land bank only along 3 or more rows: a lone open cell between trees drew a one-tile grey stub on the shore (2026-11-20)
    for (let k = 0, ty0 = Math.floor(s0 / T); k < on.length;) { if (!on[k]) { k++; continue; } let e = k; while (e < on.length && on[e]) e++; if (!land || e - k >= 3) g.rect(-1e5, (ty0 + k) * T, 2e5, (e - k) * T); k = e; }
    g.clip(); g.beginPath(); curve(P, true); g.stroke(); g.restore(); } };
  const green = greenLand(a) && greenLand(REGIONS[i + 1]);
  g.save(); g.lineJoin = 'round'; g.lineCap = 'butt';
  if (!LAVA_TS.has(a.tileset)) {   // water: the bright Zenonia 2 water, with Zenonia 2's own lake shore
    // the shore as Zenonia 2 paints its lakes (tileset 201): on the land a lime rim, a pale band and a thin grass line;
    // in the water a dark navy edge, a blue line and a bright foam line. Strokes straddle the bank, so half of each
    // width lands on the ground and the water fill below covers the other half.
    if (green) { banks('#ade363', 12); banks('#c6fba5', 8); banks('#52c394', 4); }
    else if (a.tileset !== ISLES.ts && b.tileset !== ISLES.ts) banks('rgba(0,0,0,0.2)', 8);   // other lands: a shade on the ground at the lip (the cloud islands have their own edges)
    const skyGap = a.tileset === ISLES.ts || b.tileset === ISLES.ts;   // (between cloud islands the sky is already there, step 1, and a bank line drew a seam down the cloud bridges)
    if (!skyGap) { body(); g.fillStyle = waterPattern(g); g.fill(); }
    g.save(); body(); g.clip();
    if (green) { banks('#5af3ff', 8, false); banks('#0051ad', 6, false); banks('#084594', 4, false); }
    else if (a.tileset !== ISLES.ts && b.tileset !== ISLES.ts) banks('rgba(10,40,120,0.28)', 7);   // deeper water by the banks
    g.restore();
    if (!green && !skyGap) banks('rgba(0,0,0,0.45)', 2);
  } else {
    body(); g.fillStyle = lavaPattern(g); g.fill();
    g.save(); body(); g.clip();
    banks('rgba(0,0,0,0.3)', 7);
    g.restore();
    banks('rgba(0,0,0,0.45)', 2);
  }
  g.restore();
}
// The world is far too long to paint up front: each 2048-px chunk is painted the first time it comes near the
// camera (one per frame), and chunks long out of view are dropped again. Map canvases are cached per map, so a
// map that appears several times along the road is only rendered once.
const MAP_BG = {};
// (only the most recently used MAP_BG_KEEP are kept: each is a few MB and they are only needed to paint ground strips nearby; one
// dropped is drawn again in ~5 ms. Every map ever passed used to stay, ~100 MB after a long walk, 2026-11-08)
const MAP_BG_KEEP = 10, MAP_BG_USED = new Map();
const mapBg = key => {
  MAP_BG_USED.delete(key); MAP_BG_USED.set(key, 1);
  if (MAP_BG_USED.size > MAP_BG_KEEP) { const old = MAP_BG_USED.keys().next().value; MAP_BG_USED.delete(old); delete MAP_BG[old]; }
  if (MAP_BG[key]) return MAP_BG[key]; const c = renderMapBg(MAPS[key], key !== 'arena2'); if (waterRef()) MAP_BG[key] = c; return c;
};   // (overworld maps: tiles only, see paintOverworld)   // (never cache before the tiles are ready)
function renderOverworldBg() {
  const W = WILDS.w * T, H = WILDS.h * T, chunks = [];
  for (let cx0 = 0; cx0 < W; cx0 += BG_CHUNK) chunks.push({ x: cx0, w: Math.min(BG_CHUNK, W - cx0), c: null, used: 0 });
  return { chunks, width: W, height: H, lazy: true };
}
function chunkCanvas(bg, ch) {
  if (!ch.c) {
    const c = document.createElement('canvas'); c.width = ch.w; c.height = bg.height;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(-ch.x, 0);
    paintOverworld(g, ch.x, ch.x + ch.w, bg.height);
    if (!waterRef()) { ch.used = performance.now(); return c; }   // tiles not ready yet: paint again next frame
    ch.c = c;
  }
  ch.used = performance.now();
  return ch.c;
}
// paint one chunk ahead in the walking direction, and forget chunks nobody has looked at for a while
function tendChunks(bg, cam, vw) {
  const now = performance.now();
  const ahead = bg.chunks.find(ch => !ch.c && ch.x < cam.x + vw + BG_CHUNK && ch.x + ch.w > cam.x - BG_CHUNK);
  if (ahead) chunkCanvas(bg, ahead);
  for (const ch of bg.chunks) if (ch.c && now - ch.used > 8000 && (ch.x > cam.x + vw + BG_KEEP || ch.x + ch.w < cam.x - BG_KEEP)) ch.c = ch.sh = null;
}
// LAVA: the Ember lands' rivers and the gaps round their maps are the game's own lava (tiles_8, the plain tile of its lava pools).
// Their maps end in rows of solid bare floor, which looked like ground you could walk on; those become lava too. Stone bridges
// are darkened to sit in the scorched land.
const LAVA_TILE = 101, LAVA_STONE = 'brightness(0.62) sepia(0.35)';
let lavaCell = null;
function lavaPattern(g) {
  if (!lavaCell) { const ts = tilesetImg(8), t = LAVA_TILE, c = document.createElement('canvas'); c.width = c.height = T; c.getContext('2d').drawImage(ts, (t % 16) * T, Math.floor(t / 16) * T, T, T, 0, 0, T, T); lavaCell = c; }
  return g.createPattern(lavaCell, 'repeat');
}
// the solid bare tiles reached from the map's edge (a rock in the middle of the floor stays as it is), with a burnt rim
function lavaEdge(g, q) {
  const M = MAPS[q.map], W = M.w, H = M.h, bare = i => M.solid[i] && !(M.overlay[i] & 0xff), on = new Uint8Array(W * H), todo = [];
  const add = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (!on[i] && bare(i)) { on[i] = 1; todo.push(i); } };
  for (let x = 0; x < W; x++) { add(x, 0); add(x, H - 1); } for (let y = 0; y < H; y++) { add(0, y); add(W - 1, y); }
  while (todo.length) { const i = todo.pop(), x = i % W, y = (i - x) / W; add(x + 1, y); add(x - 1, y); add(x, y + 1); add(x, y - 1); }
  const ox = q.ox * T, oy = q.oy * T; g.fillStyle = lavaPattern(g);
  for (let i = 0; i < W * H; i++) if (on[i]) g.fillRect(ox + (i % W) * T, oy + Math.floor(i / W) * T, T, T);
  const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !on[y * W + x];
  for (const [w0, col] of [[3, 'rgba(18,8,6,0.8)'], [1, 'rgba(255,170,70,0.55)']]) { g.fillStyle = col;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!on[y * W + x]) continue; const px = ox + x * T, py = oy + y * T, d = w0 === 3 ? 0 : 3;
      if (open(x, y - 1)) g.fillRect(px, py + d, T, w0); if (open(x, y + 1)) g.fillRect(px, py + T - d - w0, T, w0); if (open(x - 1, y)) g.fillRect(px + d, py, w0, T); if (open(x + 1, y)) g.fillRect(px + T - d - w0, py, w0, T); }
  }
}
function paintOverworld(g, X0, X1, H) {
  const hit = (a, b) => a * T < X1 && b * T > X0;   // tile columns [a, b) overlap this chunk?
  g.fillStyle = '#0b120e'; g.fillRect(X0, 0, X1 - X0, H);
  // 1) the empty space around the maps is open water (the same Zenonia 2 water as everywhere); lava lands stand in
  //    the game's own lava instead
  REGIONS.forEach((r, i) => {
    const z2n = j => REGIONS[j] && (MAPS[REGIONS[j].map] || {}).z2field && !WILDS.bridges[Math.min(i, j)];   // (beside a whole Zenonia 2 map the water stops at this map's edge: the gap stays dark)
    // (next to a cloud island the whole gap is the island's sky: half sky, half water read as a stripe, 2026-11-20 the user: "bad transition")
    const isle = j => REGIONS[j] && REGIONS[j].tileset === ISLES.ts && r.tileset !== ISLES.ts;
    const x0 = i === 0 ? 0 : r.ox - (z2n(i - 1) || isle(i - 1) ? 0 : 2), x1 = i === REGIONS.length - 1 ? WILDS.w : r.ox + r.w + (z2n(i + 1) || isle(i + 1) ? 0 : 2);
    const xi0 = r.tileset === ISLES.ts && REGIONS[i - 1] && REGIONS[i - 1].tileset !== ISLES.ts ? REGIONS[i - 1].ox + REGIONS[i - 1].w : null, xi1 = r.tileset === ISLES.ts && REGIONS[i + 1] && REGIONS[i + 1].tileset !== ISLES.ts ? REGIONS[i + 1].ox : null;
    if (xi0 != null || xi1 != null) { const c0 = Math.max(xi0 ?? x0, Math.floor(X0 / T)), c1 = Math.min(xi1 ?? x1, Math.ceil(X1 / T)); if (c1 > c0) g.clearRect(c0 * T, 0, (c1 - c0) * T, H); }
    if (!hit(x0, x1)) return;
    const a = Math.max(x0, Math.floor(X0 / T)), b = Math.min(x1, Math.ceil(X1 / T));
    if (typeof z2Surround === 'function' && (MAPS[r.map] || {}).z2field && z2Surround(g, r, a, b)) return;   // (a whole Zenonia 2 map: its own border ground all round, z2links.js)
    if (r.tileset === ISLES.ts) { g.clearRect(a * T, 0, (b - a) * T, H); return; }   // (cut open, base and all: the sky below shows through)
    if (!LAVA_TS.has(r.tileset)) { g.fillStyle = waterPattern(g); g.fillRect(a * T, 0, (b - a) * T, WILDS.h * T); return; }
    g.fillStyle = lavaPattern(g); g.fillRect(a * T, 0, (b - a) * T, WILDS.h * T);
  });
  // 2) the maps themselves, and any smaller map stacked above or below one (with the path that joins them)
  REGIONS.forEach((r, i) => {
    if (!hit(r.ox, r.ox + r.w)) return;
    g.drawImage(mapBg(r.map), r.ox * T, r.oy * T);
    for (const u of r.subs || []) g.drawImage(mapBg(u.map), u.ox * T, u.oy * T);
    if (LAVA_TS.has(r.tileset)) for (const q of [r, ...(r.subs || [])]) lavaEdge(g, q);
    // every map is an island in the open water: a lake shore along its top and bottom edges (the river banks are
    // its sides). Hearthvale's south edge is its own lake, so it has no shore there. Lava lands keep a plain edge.
    if (typeof z2ExitPaths === 'function' && (MAPS[r.map] || {}).z2field) z2ExitPaths(g, r);   // (its exits run on past its edge)
    if (!LAVA_TS.has(r.tileset) && r.tileset !== ISLES.ts && !(MAPS[r.map] || {}).z2field) for (const q of [r, ...(r.subs || [])]) {
      mapShore(g, q, 'top');
      if (i !== REGIONS.length - 1 || q !== r) mapShore(g, q, 'bottom');
      if (q !== r) { mapShore(g, q, 'left'); mapShore(g, q, 'right'); }   // a stacked map stands in open water all round
      else { if (i === 0) mapShore(g, q, 'left'); if (i === REGIONS.length - 1) mapShore(g, q, 'right'); }
    }
    for (const u of r.subs || []) if (u.path && u.path.length) {   // the way to a side area: a worn trail through the carved
      const xs = u.path.map(q => q[0]), x0 = Math.min(...xs) * T, w = (Math.max(...xs) - Math.min(...xs) + 1) * T;   // tiles on land,
      const inMap = (R, y) => y >= R.oy && y < R.oy + R.h;                                                              // a stone bridge
      const rows = [...new Set(u.path.map(q => q[1]))].sort((a, b) => a - b), wet = rows.filter(y => !inMap(r, y) && !inMap(u, y));   // over the water
      for (const R of [r, u]) {   // the trail on each bank (grass lands only: elsewhere the map's own floor shows)
        const ry = rows.filter(y => inMap(R, y)); if (!ry.length || R.tileset !== 1) continue;
        vTrail(g, x0, Math.min(...ry) * T, w, (Math.max(...ry) - Math.min(...ry) + 1) * T, wet.length && Math.min(...ry) > wet[0] ? 'top' : 'bottom');
      }
      if (r.tileset === ISLES.ts) {   // over the whole way up: the islands' gaps leave sky inside the maps as well
        const land = y => inMap(r, y) || inMap(u, y);   // (on the maps the path is part of the island, skyJoin)
        if (rows.length && cloudBridgeNS(g, x0, rows[0] * T, w, (rows[rows.length - 1] - rows[0] + 1) * T, land)) continue;
      }
      if (wet.length) { if (LAVA_TS.has(r.tileset)) g.filter = LAVA_STONE; stoneBridgeNS(g, x0, wet[0] * T - 6, w, wet.length * T + 12); g.filter = 'none'; }
    }
  });
  // 2a) the lake shore along Hearthvale's south edge, in Zenonia 2's lake colours (as the river banks)
  const town = REGIONS[REGIONS.length - 1];
  if (hit(town.ox, town.ox + town.w)) {
    const sx = town.ox * T, sw = town.w * T, sy = (town.oy + VILLAGE.lakeY) * T;
    edgeShore(g, sx, sw, sy, 1);
  }
  // 2b) where a crossing has to pass through a map's edge (trees, cliffs), lay a ground path made of that map's
  //     own walkable tiles, copied from where the path starts, so the bridge only ever spans the river
  WILDS.bridges.forEach((bd, i) => {
    const a = REGIONS[i], b = REGIONS[i + 1]; if (!bd || !a || !b || !hit(bd.x0, bd.x1 + 1)) return;
    if (a.tileset === ISLES.ts || b.tileset === ISLES.ts) return;   // (the cloud islands take the crossing into their own shape, skyJoin: no floor copied over it and no shade lines)
    const S = riverShape(i);   // only the bit of wall (if any) left between the walkway and the water
    const gs = bankL(S, bd) / T, ge = bankR(S, bd) / T - 1, rows = bridgeRows(bd);
    const trail = (x) => drawRoad(g, x * T, bd.y * T, rows);
    const copy = (src, R, sx, x) => {
      // (the green lands used to get a worn sandy trail here: a hard-edged sand block at every bridge end, 2026-11-13 the user: "bad tile
      // placement"; now they take their own grass like the other lands)
      const t = groundTile(R.map), ts = tilesetImg(R.tileset);   // other lands: the map's own most common floor tile
      if (t == null || !ts) return;
      for (let r = 0; r < rows; r++) g.drawImage(ts, (t % 16) * T, Math.floor(t / 16) * T, T, T, x * T, (bd.y + r) * T, T, T);
    };
    // the path runs from the bank to the first walkable ground (no further: a trail ending in open grass looked
    // pasted on). Around the landing, painted obstacles on walkable cells (rocks, stumps: they had no collision)
    // are cleared; green grass detail stays, so no pale patch appears.
    const bare = (R, tx0, tx1) => { const M = MAPS[R.map], ts = tilesetImg(R.tileset); if (!ts) return;
      for (let ty = bd.y - 2; ty <= bd.y + rows + 1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const lx = tx - R.ox, ly = ty - R.oy; if (lx < 0 || ly < 0 || lx >= M.w || ly >= M.h) continue;
        const i = ly * M.w + lx, o = (M.overlay[i] & 0xff) - 1; if (M.solid[i] || o < 0 || !obstacleTile(R.tileset, o)) continue;
        const t = (M.ground[i] & 0xff) - 1; if (t >= 0) g.drawImage(ts, (t % 16) * T, Math.floor(t / 16) * T, T, T, tx * T, ty * T, T, T);
      } };
    bare(a, bd.x0 - 4, a.ox + a.w - 1); bare(b, b.ox, bd.x1 + 4);
    // terrace lips (walkable ground drawn with a strip of cliff) on the landing rows, from the bank inward: the
    // path would seem to run through a cliff, so they become the map's plain floor up to the first clean tile
    const lips = (R, edge, step) => { const M = MAPS[R.map], ts = tilesetImg(R.tileset), t0 = groundTile(R.map); if (!ts || t0 == null) return;
      for (const ty of bridgeRowList(bd)) for (let k = 0, lx = edge; k < 6; k++, lx += step) {
        const ly = ty - R.oy; if (lx < 0 || ly < 0 || lx >= M.w || ly >= M.h) break;
        // (a cell already of the plain floor is clean: the desert's dune tile read as a cliff strip, and repainting it wiped Mirage Springs' paved road by the bridge, 2026-11-20)
        const i = ly * M.w + lx, t = (M.ground[i] & 0xff) - 1; if (M.solid[i] || t === t0 || !cliffTile(R.tileset, t)) break;
        g.drawImage(ts, (t0 % 16) * T, Math.floor(t0 / 16) * T, T, T, (R.ox + lx) * T, ty * T, T, T);
      } };
    lips(a, a.w - 1, -1); lips(b, 0, 1);
    for (let x = bd.x0 + 1; x < gs; x++) copy(mapBg(a.map), a, bd.x0, x);
    for (let x = ge + 1; x < bd.x1; x++) copy(mapBg(b.map), b, bd.x1, x);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    if (gs > bd.x0 + 1) { g.fillRect((bd.x0 + 1) * T, bd.y * T - 2, (gs - bd.x0 - 1) * T, 2); g.fillRect((bd.x0 + 1) * T, (bd.y + rows) * T, (gs - bd.x0 - 1) * T, 2); }
    if (bd.x1 > ge + 1) { g.fillRect((ge + 1) * T, bd.y * T - 2, (bd.x1 - ge - 1) * T, 2); g.fillRect((ge + 1) * T, (bd.y + rows) * T, (bd.x1 - ge - 1) * T, 2); }
  });
  // 3) rivers in the gaps between maps: the tileset's own water tiles in the green lands, coloured flow elsewhere
  for (let i = 0; i + 1 < REGIONS.length; i++) {
    if (!WILDS.bridges[i] && ((MAPS[REGIONS[i].map] || {}).z2field || (MAPS[REGIONS[i + 1].map] || {}).z2field)) continue;   // (no river between whole Zenonia 2 maps: they join by their exits)
    const S = riverShape(i);
    if (S.x0 > X1 || S.x1 < X0) continue;
    paintRiver(g, i, 0, H);
  }
  // 3b) the maps' big painted objects go on after the rivers, so a tree at a map's edge hangs over the water instead of
  //     being cut off along the edge
  REGIONS.forEach(r => { if (!hit(r.ox - 4, r.ox + r.w + 4)) return; drawObjA(g, MAPS[r.map], r.ox * T, r.oy * T); for (const u of r.subs || []) drawObjA(g, MAPS[u.map], u.ox * T, u.oy * T); });
  // 4) zone mood tints over each region's column
  REGIONS.forEach((r, i) => {
    const tint = r.zone >= 0 && ZONES[r.zone].tint;
    // across the river to each neighbour the tint fades out (it used to stop in a straight line down the middle of the water, two blues
    // side by side, 2026-11-20 the user: "bad placement"); the neighbour's fades in over the same water
    const pv = REGIONS[i - 1], nx = REGIONS[i + 1], g0 = pv ? Math.min(r.ox, pv.ox + pv.w) : 0, g1 = nx ? Math.max(r.ox + r.w, nx.ox) : WILDS.w;
    const x0 = i === 0 ? 0 : g0, x1 = i === REGIONS.length - 1 ? WILDS.w : g1;
    if (!tint || !hit(x0, x1)) return;
    g.save(); g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint; g.fillRect(r.ox * T, 0, r.w * T, H);
    const fade = (a, b) => { if (b <= a) return; const gr = g.createLinearGradient(a * T, 0, b * T, 0), inL = a < r.ox; gr.addColorStop(inL ? 1 : 0, tint); gr.addColorStop(inL ? 0 : 1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(a * T, 0, (b - a) * T, H); };
    // (no fade into a gap beside a cloud island: that gap is cut-away sky, and a multiply over its empty pixels left a grey film, 2026-11-20 "bad transition")
    const skyBy = q => q && (q.tileset === ISLES.ts || r.tileset === ISLES.ts);
    if (i === 0) g.fillRect(0, 0, r.ox * T, H); else if (!skyBy(pv)) fade(x0, r.ox);
    if (i === REGIONS.length - 1) { g.fillStyle = tint; g.fillRect((r.ox + r.w) * T, 0, (WILDS.w - r.ox - r.w) * T, H); } else if (!skyBy(nx)) fade(r.ox + r.w, x1);
    g.restore();
  });
}
let OVERWORLD_BG = null;
// only grass lands get the lime bank: the Frozen Abyss and Frostmere share a green land's tileset
const greenLand = r => !r || ((r.tileset === 1 || r.tileset === 201) && r.zone !== 3 && r.town !== 4);
// A straight lake shore at height y across [x, x + w): on the land side a lime rim, a pale band and a thin grass line,
// on the water side a dark navy edge, a blue line and a bright foam line (Zenonia 2's lake colours, as the river
// banks). dir +1: the water is below y; -1: above.
const SHORE_BANDS = [[-6, 2, '#ade363'], [-4, 2, '#c6fba5'], [-2, 2, '#52c394'], [0, 2, '#084594'], [2, 1, '#0051ad'], [3, 1, '#5af3ff']];
// water tiles the pixel test misses (tileset 1's 112: the original lake's patterned water; Mossbrook's south edge drew a shoreline across it, 2026-11-20)
const SHORE_WATER = { 1: new Set([112]) };
// a map's lake shore along one side, tile by tile, only where its edge tile is open ground (not trees or cliffs)
function mapShore(g, q, side) {
  const M = WG_MAPS[q.map]; if (!M) return;
  const horiz = side === 'top' || side === 'bottom', n = horiz ? M.w : M.h;
  for (let k = 0; k < n; k++) {
    const tx = horiz ? k : side === 'left' ? 0 : M.w - 1, ty = horiz ? (side === 'top' ? 0 : M.h - 1) : k;
    // the map's own water runs on into the open water: no edge (REF_FLAT_WATER too: the Sun Temple map's flat blue border is not judged water by its pixels, and drew a shoreline across the open sea)
    const i = ty * M.w + tx, gt = (M.ground[i] & 0xff) - 1; if (!(M.overlay[i] & 0xff) && (waterTile(M.tileset, gt) || REF_FLAT_WATER.includes(gt) || (SHORE_WATER[M.tileset] && SHORE_WATER[M.tileset].has(gt)))) continue;
    const waterOnly = !!M.solid[i] || !greenLand({ tileset: M.tileset, zone: (regionAt(q.ox * T) || q).zone, town: q.town });   // trees or cliff at the edge, or a land with no grass: just the water's edge, no grassy bank
    if (horiz) edgeShore(g, (q.ox + k) * T, T, (q.oy + (side === 'top' ? 0 : M.h)) * T, side === 'top' ? -1 : 1, waterOnly);
    else edgeShoreV(g, (q.ox + (side === 'left' ? 0 : M.w)) * T, (q.oy + k) * T, T, side === 'left' ? -1 : 1, waterOnly);
  }
}
// the same bands running up and down at x across [y, y + h): dir +1 the water is right of x, -1 left
function edgeShoreV(g, x, y, h, dir, waterOnly) {
  for (const [dx, w, col] of SHORE_BANDS) { if (waterOnly && dx < 0) continue; g.fillStyle = col; g.fillRect(dir > 0 ? x + dx : x - dx - w, y, w, h); }
}
function edgeShore(g, x, w, y, dir, waterOnly) {
  for (const [dy, h, col] of SHORE_BANDS) { if (waterOnly && dy < 0) continue; g.fillStyle = col; g.fillRect(x, dir > 0 ? y + dy : y - dy - h, w, h); }
}
// is a tile (mostly) water? judged by its pixels in the original tileset
const WATER_T = {};
function waterTile(ts, t) {
  if (t < 0) return false; const key = ts + ':' + t; if (key in WATER_T) return WATER_T[key];
  const im = img(D.world.tilesets[ts]); if (!im || !im.complete || !im.naturalWidth) return false;
  const c = document.createElement('canvas'); c.width = T; c.height = T; const cg = c.getContext('2d');
  cg.drawImage(im, (t % 16) * T, Math.floor(t / 16) * T, T, T, 0, 0, T, T);
  const d = cg.getImageData(0, 0, T, T).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (isWaterPx(d[i], d[i + 1], d[i + 2])) n++;
  return (WATER_T[key] = n > T * T * 0.6);
}
// does a ground tile show a strip of cliff (brown or purple rock: red above green) over a fair part of it?
const CLIFF_T = {};
function cliffTile(ts, t) {
  if (t < 0) return false; const key = ts + ':' + t; if (key in CLIFF_T) return CLIFF_T[key];
  const im = img(D.world.tilesets[ts]); if (!im || !im.complete || !im.naturalWidth) return false;
  const c = document.createElement('canvas'); c.width = T; c.height = T; const cg = c.getContext('2d');
  cg.drawImage(im, (t % 16) * T, Math.floor(t / 16) * T, T, T, 0, 0, T, T);
  const d = cg.getImageData(0, 0, T, T).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] > d[i + 1] + 10) n++;
  return (CLIFF_T[key] = n > 40);
}
// is an overlay tile an obstacle-looking thing (rock, stump, post) rather than green grass detail? by its colour:
// grass detail is mostly green; obstacles are grey or brown
const OBSTACLE = {};
// one small canvas for looking at a tile's pixels, kept in memory (willReadFrequently): reading pixels back from an ordinary
// canvas forces a slow trip to the graphics card, and groundTile used to do that for dozens of tiles, freezing up to a second
let TILE_PEEK = null;
const tilePeek = () => { if (!TILE_PEEK) { const c = document.createElement('canvas'); c.width = T; c.height = T; TILE_PEEK = c.getContext('2d', { willReadFrequently: true }); } return TILE_PEEK; };
const WATERY = {};
function obstacleTile(ts, t) {
  const key = ts + ':' + t; if (key in OBSTACLE) return OBSTACLE[key];
  const im = img(D.world.tilesets[ts]); if (!im || !im.complete || !im.naturalWidth) return false;
  const cg = tilePeek(); cg.clearRect(0, 0, T, T);
  cg.drawImage(im, (t % 16) * T, Math.floor(t / 16) * T, T, T, 0, 0, T, T);
  const d = cg.getImageData(0, 0, T, T).data; let green = 0, other = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; if (d[i + 1] > d[i] + 8 && d[i + 1] > d[i + 2]) green++; else other++; }
  return (OBSTACLE[key] = other > green && other > 30);
}
// a map's most common ground tile among the cells you can walk on (its plain floor)
const GROUND_TILE = {};
function groundTile(key) {
  if (key in GROUND_TILE) return GROUND_TILE[key];
  const M = MAPS[key], n = {};
  for (let i = 0; i < M.w * M.h; i++) if (M.reach[i] && !(M.overlay && M.overlay[i])) { const t = (M.ground[i] & 0xff) - 1; if (t >= 0) n[t] = (n[t] || 0) + 1; }
  // leave out tiles that are mostly water (some maps' most common walkable tile is shallow water)
  const im = img(D.world.tilesets[M.tileset]); if (!im || !im.complete || !im.naturalWidth) return null;
  const cg = tilePeek();
  const watery = t => { const wk = M.tileset + ':' + t; if (wk in WATERY) return WATERY[wk]; cg.clearRect(0, 0, T, T); cg.drawImage(im, (t % 16) * T, Math.floor(t / 16) * T, T, T, 0, 0, T, T);
    const d = cg.getImageData(0, 0, T, T).data; let wv = 0; for (let i = 0; i < d.length; i += 4) if (isWaterPx(d[i], d[i + 1], d[i + 2])) wv++; return (WATERY[wk] = wv > T * T * 0.3); };
  let best = null; for (const t of Object.keys(n).sort((a, b) => n[b] - n[a])) if (!watery(+t)) { best = +t; break; }   // (most common first: usually one look)
  return (GROUND_TILE[key] = best);
}
// The game's stone bridge (object 065) drawn east–west on canvas c, from x L over bw pixels with its top at `top`;
// `extra` px of plain deck are added between the rails for a wider road. Sprite rows 0–52 are the bridge (53+ is a
// solid black underside we leave out). Its two ends stay as drawn and the flat middle of the railing repeats (or
// the ends shorten on a short span). Returns false while the sprite sheet isn't loaded.
function stoneSpan(c, L, top, bw, extra = 0) {
  const bridge = objRec('065', 0), oimg = img(D.objects.img); if (!bridge || !oimg) return false;
  const BH = 53;
  // the sprite in three bands: top rail + upper deck (0-24), a plain deck band repeated for the extra rows,
  // lower deck + bottom rail (24-53) moved down by them
  const slice = (sx, sw, dx, dw) => {
    c.drawImage(oimg, bridge[0] + sx, bridge[1], sw, 24, dx, top, dw, 24);
    for (let k = 0; k < extra; k += 8) { const hh = Math.min(8, extra - k); c.drawImage(oimg, bridge[0] + sx, bridge[1] + 24, sw, hh, dx, top + 24 + k, dw, hh); }
    c.drawImage(oimg, bridge[0] + sx, bridge[1] + 24, sw, BH - 24, dx, top + 24 + extra, dw, BH - 24);
  };
  const CAP = Math.min(30, Math.floor((bw - 4) / 2)), MID = [40, 16];
  for (let xx = L + CAP; xx < L + bw - CAP; xx += MID[1]) { const ww = Math.min(MID[1], L + bw - CAP - xx); slice(MID[0], ww, xx, ww); }
  slice(0, CAP, L, CAP);
  slice(bridge[2] - CAP, CAP, L + bw - CAP, CAP);
  return true;
}
// each size of bridge is pieced together once, on its own canvas, then laid down whole: no joins to show at any zoom
const SPAN_ART = new Map();
function stoneSpanArt(bw, extra) {
  const key = `${bw}|${extra}`; if (SPAN_ART.has(key)) return SPAN_ART.get(key);
  const c = document.createElement('canvas'); c.width = Math.ceil(bw); c.height = 53 + extra; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (!stoneSpan(g, 0, 0, bw, extra)) return null;
  SPAN_ART.set(key, c); return c;
}
// The way up or down to a side area over (x, y, w, h): a stone bridge drawn to run north–south, in the river
// bridges' palette (object 065): a slab deck between two parapets of white-topped blocks, a big post at each corner,
// its shadow on the water. (Turning the river bridge's sprite 90° put its lit rail and front face on the sides.)
const NSB = { line: '#312839', top: '#efefef', light: '#ced7e7', mid: '#adbace', dark: '#8c96b5', face: '#6b6d6b' };
function stoneBridgeNS(g, x, y, w, h) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const P = 7, X0 = x - P, X1 = x + w + P;
  g.fillStyle = 'rgba(0,20,50,0.4)'; g.fillRect(X0 + 4, y + 6, X1 - X0, h - 4);   // shadow on the water, down and right
  // the deck: rows of slabs with staggered joints, darker toward the parapets
  g.fillStyle = NSB.light; g.fillRect(x, y, w, h);
  g.fillStyle = NSB.mid; g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
  for (let py = y + 7, k = 0; py < y + h; py += 8, k++) {
    g.fillStyle = NSB.mid; g.fillRect(x, py, w, 1);
    for (let px = x + (k % 2 ? 6 : 14); px < x + w - 2; px += 16) g.fillRect(px, py - 7, 1, 7);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + Math.floor(w / 2) - 3, y, 6, h);   // worn, lit middle
  // the parapets: white-topped blocks with a shaded south face and a dark outline, like the river bridges' rails
  const block = (bx, by, bw, bh, face) => {
    g.fillStyle = NSB.line; g.fillRect(bx - 1, by - 1, bw + 2, bh + face + 2);
    g.fillStyle = NSB.top; g.fillRect(bx, by, bw, bh);
    g.fillStyle = NSB.light; g.fillRect(bx, by + bh - 1, bw, 1); g.fillRect(bx + bw - 1, by, 1, bh);
    g.fillStyle = NSB.face; g.fillRect(bx, by + bh, bw, face);
  };
  for (const px of [X0, x + w]) {
    g.fillStyle = NSB.line; g.fillRect(px - 1, y, P + 2, h);
    g.fillStyle = NSB.dark; g.fillRect(px, y, P, h);
    for (let by = y + 6; by < y + h - 12; by += 9) block(px, by, P, 5, 2);
  }
  // corner posts, a little bigger than the blocks
  for (const px of [X0 - 1, x + w - 1]) for (const py of [y - 3, y + h - 11]) block(px, py, P + 2, 7, 3);
}
// A worn sandy trail running north–south over (x, y, w, h), in the river crossings' road colours: the tileset's sand
// with darker worn edges and a few pebbles, the end away from the bridge (`open`: 'top' or 'bottom' is the bridge
// side) rounded off into the grass
function vTrail(g, x, y, w, h, bridgeSide) {
  const ts = img(D.world.tilesets[1]); if (!ts) return;
  g.save(); g.beginPath();
  if (bridgeSide === 'top') rrect(g, x, y - 6, w, h + 6, 7); else rrect(g, x, y, w, h + 6, 7);
  g.clip();
  for (let ty = y - T; ty < y + h + T; ty += T) for (let tx = x; tx < x + w; tx += T) g.drawImage(ts, 7 * T, 0, T, T, tx, ty, T, T);
  g.fillStyle = 'rgba(110,80,40,0.45)'; g.fillRect(x, y - 6, 1, h + 12); g.fillRect(x + w - 1, y - 6, 1, h + 12);
  g.fillStyle = 'rgba(150,115,60,0.25)'; g.fillRect(x + 1, y - 6, 2, h + 12); g.fillRect(x + w - 3, y - 6, 2, h + 12);
  g.fillStyle = 'rgba(200,170,110,0.35)'; for (let k = 0; k * 7 < h; k++) g.fillRect(x + 6 + ((x / T * 7 + k * 5) % (w - 12)), y + 4 + k * 7, 2, 1);   // pebbles
  g.restore();
}
// A dirt road segment (16 x 32 px): the tileset's sand with worn, darker edges and a few grass tufts
function drawRoad(g, x, y, rows = 2) {
  const ts = img(D.world.tilesets[1]), H2 = rows * T;
  for (let r = 0; r < rows; r++) g.drawImage(ts, (7 % 16) * T, Math.floor(7 / 16) * T, T, T, x, y + r * T, T, T);
  g.fillStyle = 'rgba(110,80,40,0.45)'; g.fillRect(x, y, T, 1); g.fillRect(x, y + H2 - 1, T, 1);
  g.fillStyle = 'rgba(150,115,60,0.25)'; g.fillRect(x, y + 1, T, 2); g.fillRect(x, y + H2 - 3, T, 2);
  g.fillStyle = 'rgba(200,170,110,0.35)'; for (let k = 0; k < rows + 1; k++) g.fillRect(x + ((x / T * 7 + k * 5) % 14), y + 8 + k * 7, 2, 1);   // pebbles
}
// THE CLOUD BRIDGES of the Skyreach Isles, in the islands' own tiles: east-west a walkway with the rim above it and the foot and drips below; north-south one between two puffed sides
const CLOUD_ART = new Map(), skyTile = (g, im, t, x, y) => g.drawImage(im, (t % 16) * T, Math.floor(t / 16) * T, T, T, x, y, T, T);
function cloudSpan(cols, rows) {
  const key = `${cols}|${rows}`; if (CLOUD_ART.has(key)) return CLOUD_ART.get(key); const im = tilesetImg(ISLES.ts); if (!TILESET_FIX[ISLES.ts]) return null;
  const c = document.createElement('canvas'); c.width = cols * T; c.height = (rows + 3) * T; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let x = 0; x < cols; x++) { const X = x * T; skyTile(g, im, 71, X, 0); for (let r = 0; r < rows; r++) skyTile(g, im, r === 0 ? 21 : r === rows - 1 ? 61 : 41, X, (r + 1) * T); skyTile(g, im, 91, X, (rows + 1) * T); }   // (no drips under the foot: they read as a waterfall)
  CLOUD_ART.set(key, c); return c;
}
function cloudBridgeNS(g, x, y, w, h, land = () => false) {
  const im = tilesetImg(ISLES.ts); if (!TILESET_FIX[ISLES.ts]) return false; const x0 = Math.floor(x / T), cols = Math.max(2, Math.round(w / T)), y0 = Math.floor(y / T), rows = Math.ceil(h / T);
  for (let r = 0; r < rows; r++) { if (land(y0 + r)) continue; const Y = (y0 + r) * T; skyTile(g, im, 80, (x0 - 1) * T, Y); skyTile(g, im, 82, (x0 + cols) * T, Y); for (let c = 0; c < cols; c++) skyTile(g, im, c === 0 ? 40 : c === cols - 1 ? 42 : 41, (x0 + c) * T, Y); }
  return true;
}
// a crossing's height in tiles (older layouts: two) and the rows it spans; the river banks at its narrowest
const bridgeRows = bd => bd.h || 2;
const bridgeRowList = bd => Array.from({ length: bridgeRows(bd) }, (_, r) => bd.y + r);
const bankL = (S, bd) => Math.max(...bridgeRowList(bd).map(y => S.L[y]));
const bankR = (S, bd) => Math.min(...bridgeRowList(bd).map(y => S.R[y]));
function drawRivers(w, now) {
  const cam = w.cam || { x: 0, y: 0 }, vw = VW / ZOOM, vh = VH / ZOOM;
  const bridge = objRec('065', 0);
  for (let i = 0; i + 1 < REGIONS.length; i++) {
    const S = riverShape(i);
    if (S.x0 > cam.x + vw + 60 || S.x1 < cam.x - 60) continue;
    // the crossing: the game's stone bridge fitted to the water at the crossing, landing just on each bank
    const bd = WILDS.bridges[i];
    if (bd && bridge) {
      const Lb = bankL(S, bd), Rb = bankR(S, bd), extra = (bridgeRows(bd) - 2) * T;
      if ((REGIONS[i].tileset === ISLES.ts || REGIONS[i + 1].tileset === ISLES.ts) && !(typeof tgOneCloud === 'function' && tgOneCloud(i))) { const A = REGIONS[i], B = REGIONS[i + 1], x0 = A.tileset === ISLES.ts ? A.ox + A.w : Math.floor(Lb / T) - 2, x1 = B.tileset === ISLES.ts ? B.ox : Math.ceil(Rb / T) + 2, art = x1 > x0 ? cloudSpan(x1 - x0, bridgeRows(bd)) : null;   // (only the open gap: on the maps the crossing is part of the island)
        if (art) { ctx.drawImage(art, x0 * T - 1, (bd.y - 1) * T, art.width + 2, art.height); continue; } }   // (a pixel into each island: at the camera's zoom a hairline of sky showed at the joins)
      const BH = 53, L = Lb - 6, bw = Rb - Lb + 12, cy = bd.y * T + T, top = Math.round(cy - 27);
      const sh = ctx.createLinearGradient(0, top + BH + extra - 4, 0, top + BH + extra + 8);   // soft shadow on the water
      sh.addColorStop(0, 'rgba(0,20,50,0.5)'); sh.addColorStop(1, 'rgba(0,20,50,0)');
      ctx.fillStyle = sh; ctx.fillRect(L + 8, top + BH + extra - 4, bw - 16, 12);
      const span = stoneSpanArt(bw, extra), lava = LAVA_TS.has(REGIONS[i].tileset); if (lava) ctx.filter = LAVA_STONE; if (span) ctx.drawImage(span, L, top); ctx.filter = 'none';
      // little stone posts flanking the road at each end
      for (const px of [L - 10, L + bw + 2]) for (const py of [bd.y * T - 6, (bd.y + bridgeRows(bd)) * T - 2]) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 1, py + 7, 8, 2);
        ctx.fillStyle = '#9aa0ac'; ctx.fillRect(px, py, 8, 8); ctx.fillStyle = '#d8dce4'; ctx.fillRect(px, py, 8, 2); ctx.fillStyle = '#5a5f6a'; ctx.fillRect(px, py + 7, 8, 1);
      }
    }
  }
}

// HERO GHOST: anything standing in front of the hero (a big monster, a tree, a building) would hide them, so their outline is
// laid faintly back on top of it. Only then: drawn over the hero's own sprite it would dull a Ki or Layer glow.
const HERO_GHOST = { alpha: 0.45, body: 30, half: 8 };
function heroCovered(w, p) {
  const H = HERO_GHOST, x0 = p.x - H.half, x1 = p.x + H.half, y0 = p.y - H.body;
  for (const a of w.actors) { if (a === p || a.dead || a.animalBody || a.y <= p.y || a.y > p.y + 90) continue; const sc = a.scale || 1, hh = (a.h || 30) * sc, hw = hh * 0.45; if (a.x + hw > x0 && a.x - hw < x1 && a.y - hh < p.y) return true; }
  for (const o of objsBetween(w, p.x - 120, p.x + 120)) {
    if (o.ground || o.draw || Math.abs(o.x - p.x) > 120 || Math.abs(o.y - p.y) > 160 || (o.sortY ?? o.bottom ?? o.y) <= p.y) continue;
    const r = objRec(o.bank, o.fi); if (r && o.x + r[4] < x1 && o.x + r[4] + r[2] > x0 && o.y + r[5] < p.y && o.y + r[5] + r[3] > y0) return true;
  }
  return false;
}
function drawHeroGhost(w, cam, vw, vh) {
  const p = w.player; if (!p || p.dead || !p.banks || p.driving || w.interior || !heroCovered(w, p)) return;   // (at the wheel: no hero to show through)
  const e = seqFrame(animSeq(p, p.anim), p.t, p.loop, animSpeed(p)), B = p.transcend > 0 && p.banksWhite ? p.banksWhite : p.banks;
  ctx.save(); ctx.globalAlpha = HERO_GHOST.alpha; if (p.chiT > 0) ctx.filter = kiFormFilter(performance.now(), p.kiSurge);
  for (const b of [B.body, B.weapon].filter(Boolean)) drawBankFrame(b, e, p.x, p.y - (p.z || 0));
  ctx.restore();
}
// spawn: town-local position {x, y, dir}
// does an object's picture reach over the boardwalk to a side area (u.path: the carved tiles, two wide)? Trees
// whose tops overhung it hid the way (and their trunks could stand on it)
function overBoardwalk(o, u) {
  if (!u.path || !u.path.length) return false;
  const r = objRec(o.bank, o.fi); if (!r) return false;
  const xs = u.path.map(q => q[0]), ys = u.path.map(q => q[1]);
  const px0 = Math.min(...xs) * T - 2, px1 = (Math.max(...xs) + 1) * T + 2, py0 = Math.min(...ys) * T - 8, py1 = (Math.max(...ys) + 1) * T + 4;
  const ox0 = o.x + r[4], ox1 = ox0 + r[2], oy0 = o.y + r[5], oy1 = oy0 + r[3];
  return ox0 < px1 && ox1 > px0 && oy0 < py1 && oy1 > py0;
}
// trunk-less treetops, cut flat at the bottom, only look right with another tree standing exactly in front of them, and in the
// forest walls gaps between the trees showed the cut. Every one of them is the whole tree, with its trunk, in every zone
const TRUNKLESS = { '001:0': 2, '001:1': 2, '040:0': 1 };
const wholeTree = (bank, fi) => TRUNKLESS[pad3(bank) + ':' + fi] ?? fi;
// the same anywhere else a treetop has no tree standing just in front of it (out in the open, or where the trees
// before it were cleared for a bridge or a path): it becomes the whole tree
// small things lying about with no footprint (snow clumps, flowers, ash) are part of the ground: they go under characters, not over
// anyone who stands behind them
const FLAT_H = 16;
function flatScatter(w) {
  for (const o of w.objects) { if (o.box || o.draw || o.chest || o.breakable || o.push || o.mimic || o.sideCache) continue; const r = objRec(o.bank, o.fi); if (r && r[3] <= FLAT_H) o.ground = true; }
}
function wholeExposedTops(w) {
  const trees = w.objects.filter(o => o.bank === '001' || o.bank === '040');
  for (const o of trees) {
    const to = TRUNKLESS[o.bank + ':' + o.fi]; if (to == null) continue;
    if (trees.some(q => q !== o && Math.abs(q.x - o.x) <= 20 && q.bottom - o.bottom >= 8 && q.bottom - o.bottom <= 44)) continue;
    const rec = objRec(o.bank, to); if (!rec) continue;
    o.fi = to; o.bottom = o.y + rec[5] + rec[3];
  }
}
// INVISIBLE WALLS: a generated area's forest band is solid as a whole, and the trees on it are what you see. Where
// trees were taken out (over the path to a side area, over a crossing's deck, out of the river) the band stayed solid
// under bare grass. Here every solid cell of a generated map that shows plain ground — no tree, rock or building
// drawn over it, and not water — opens up.
function openBareWalls(w) {
  const map = w.map, W = WILDS.w, cover = new Set();
  for (const o of w.objects) {
    if (o.ground) continue;
    const rec = objRec(o.bank, o.fi); if (!rec) continue;
    const x0 = o.x + rec[4] + 3, x1 = o.x + rec[4] + rec[2] - 3, y0 = o.y + rec[5] + 3, y1 = o.y + rec[5] + rec[3] - 1;
    for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
      const cx = tx * T + 8, cy = ty * T + 8; if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) cover.add(ty * W + tx);
    }
  }
  let n = 0;
  for (const R of REGIONS) for (const q of [R, ...(R.subs || [])]) {
    const M = MAPS[q.map]; if (!M || !M.gen) continue;
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      const gi = (q.oy + y) * W + q.ox + x; if (!map.solid[gi] || cover.has(gi) || (typeof PLAT !== 'undefined' && PLAT.walls.has(gi))) continue;   // (a plateau's rim and rock face stay walls: plateaus.js)
      const t = (M.ground[y * M.w + x] & 0xff) - 1; if (t === M.poolTile || waterTile(M.tileset, t)) continue;
      map.solid[gi] = 0; n++;
    }
  }
  w.bareOpened = n;
}
function makeOverworld(game, spawn) {
  const map = { w: WILDS.w, h: WILDS.h, solid: WILDS.solid, reach: WILDS.reach };
  const w = newWorld({ x0: 0, y0: 0, x1: WILDS.w * T, y1: WILDS.h * T });
  w.map = map; w.overworld = true;
  w.bg = OVERWORLD_BG || (OVERWORLD_BG = renderOverworldBg());
  w.decorBehind = (W, now) => { drawRivers(W, now); drawFarm(W, now); };
  w.bgX = 0; w.bgY = 0;
  const onBridge = (x, y) => WILDS.bridges.some(b => b && x >= b.x0 * T - 14 && x <= (b.x1 + 1) * T + 14 && y >= b.y * T - 24 && y <= (b.y + bridgeRows(b)) * T + 64);
  w.objects = [];
  for (const r of REGIONS) for (const [bank, fi, x, y] of regMap(r).objB) {
    if (edgeExit(regMap(r), bank, fi, x, y)) continue;   // no doorways leading off the map's edge
    const o = makeMapObject([bank, wholeTree(bank, fi), x + r.ox * T, y + r.oy * T]);
    if (!o || (r.zone >= 0 && o.chest)) continue;   // wild treasure only appears at random
    if (o.bank === '259' && o.fi === 1) continue;   // the Sun Temple's solid-black filler: without the temple wall in front of it, it was a black hole in the floor
    // the Sun Temple map's own chest (263:0) was only a picture, tucked under a pillar's base: now a real chest out in the aisle, refilled each in-game day (props.js templeChest)
    if (o.bank === '263' && o.fi === 0) { const c = templeChest(game, o); if (c) w.objects.push(c); continue; }
    if (o.bank === '253' && o.fi === 1 && !makeHoard(game, o)) continue;   // the Sun Temple's heaps of gold: treasure to take (props.js); gone once taken today
    if ((r.subs || []).some(u => overBoardwalk(o, u))) continue;   // nothing standing on (or hanging over) the boardwalk to a side area
    if (onBridge(o.x, o.bottom)) { openUnder(map, o); continue; }   // (whatever stood there leaves no invisible wall)
    if (inRiverAt(o.x, o.bottom - 2)) continue;
    if (!isDeckObject(regMap(r), bank, fi, x, y) && onRiverBridge(o)) { openUnder(map, o); continue; }   // nothing standing over a crossing's deck
    if (r.zone >= 0 && bank === 26) continue;   // the maps' stone blocks: the Wilds have mini bosses instead   // trees of a map's edge wall that the river now covers
    if (isDeckObject(regMap(r), bank, fi, x, y)) { o.ground = true; o.box = null; }   // bridges & decks: walked on, drawn under you
    else if (r.zone >= 0) autoSolid(o, map);
    { const M = regMap(r), rec = objRec(o.bank, o.fi), lx = Math.floor((o.x - r.ox * T) / T), ly = Math.floor((o.bottom - 2 - r.oy * T) / T);   // lily pads, floating logs:
      if (rec && rec[2] <= 40 && rec[3] <= 26 && lx >= 0 && ly >= 0 && lx < M.w && ly < M.h && waterTile(M.tileset, (M.ground[ly * M.w + lx] & 0xff) - 1)) o.box = null; }   // small things on water don't block
    w.objects.push(o);
  }
  for (const r of REGIONS) for (const u of r.subs || []) for (const [bank, fi, x, y] of MAPS[u.map].objB) {   // stacked maps' trees, rocks, houses…
    const o = makeMapObject([bank, wholeTree(bank, fi), x + u.ox * T, y + u.oy * T]);
    if (!o || o.chest || bank === 26 || overBoardwalk(o, u)) continue;
    if (isDeckObject(MAPS[u.map], bank, fi, x, y)) { o.ground = true; o.box = null; } else autoSolid(o, map);
    w.objects.push(o);
  }
  edgeForest(w);
  wholeExposedTops(w);
  openBareWalls(w);
  placeLandmarks(w);   // each zone's set pieces (landmarks.js), before anything random lands on their ground
  flatScatter(w);
  placeSites(w);   // the small scenes in every area (sites.js)
  scatterProps(w);
  for (const R of REGIONS) if (R.variant === 'treasure') for (let k = 0; k < 3; k++) placeProp(w, R, 3);   // treasure troves: extra chests
  const base = blockedFn(w);
  // monsters never cross into town
  w.blocked = (x, y, a) => (a && a.kind === 'monster' && !a.ally && inTown(x)) || base(x, y, a);
  w.tileSolid = (x, y) => mapSolidAt(map, x, y);
  w.isTown = inTown;
  w.portals = [];   // no town portals in the Wilds: the road home is the way you came
  for (const n of [...TOWN_NPCS, ...townCrowdToday()]) {
    if (!D.npcs[n.npc]) continue;
    const at = findOpen(w, n.x + TOWN_OX, n.y + TOWN_OY);   // keep villagers on walkable ground
    const a = baseActor('npc', 2, at.x, at.y);
    Object.assign(a, { npc: n.npc, label: n.label, role: n.role, line: n.line, h: 26, home: { x: at.x, y: at.y }, favour: n.role === 'folk' && !n.nightOnly && !n.line.includes('('), ai: { t: rand(0, 2000), still: !!n.still, roam: n.roam, nightOff: n.nightOff, nightOnly: n.nightOnly } });
    w.actors.push(a);
  }
  for (const O of OUTPOSTS) {   // each outpost's Elder stands on its square: the main quest's next chapter (chapters.js)
    const E = elderSpot(O.i), at = findOpen(w, E.x, E.y), a = baseActor('npc', 2, at.x, at.y);
    Object.assign(a, { npc: '107', label: `Elder of ${O.name}`, role: 'story', storyTown: O.i, h: 26, home: { x: at.x, y: at.y }, ai: { t: 0, still: true } });
    w.actors.push(a);
  }
  townLifeSpawn(w);
  for (const O of OUTPOSTS) for (const S of outpostLayout(O.i).shops) {   // the outpost towns' merchants, each beside their door
    if (!D.npcs[S.npc]) continue;
    const at = findOpen(w, O.x0 + S.bx * T + 8 + 22, O.R.oy * T + S.by * T + 14);
    const a = baseActor('npc', 2, at.x, at.y);
    Object.assign(a, { npc: S.npc, label: `${S.label}  ${S.sym}`, role: S.role, h: 26, home: { x: at.x, y: at.y }, ai: { t: rand(0, 2000), still: true } });
    w.actors.push(a);
  }
  const s = findOpen(w, spawn.x + TOWN_OX, spawn.y + TOWN_OY);
  const p = makePlayerActor(game.profile, 0, s.x, s.y);
  p.dir = spawn.dir ?? 2;
  w.actors.push(p); w.player = p;
  spawnFamiliars(w, p);
  spawnDog(w, p);
  w.region = regionIndexAt(p.x); w.name = regionName(w.region);
  w.spawnT = 0;
  for (const R of localRegions(w)) for (let k = 0; k < regionPop(R); k++) spawnMonster(w, R.zone, true, R);
  w.onKill = m => { onMonsterKill(game, w, m); journeyKill(game, w, m); storyKill(game, w, m); };
  initJourney(game, w);
  initMiniBosses(w);
  for (const o of w.objects) if (o.region == null) o.netBase = true;   // (built from the world seed, the same on both computers in online co-op: net.js; the random crates (o.region, props.js) differ, so they travel whole)
  w.onPlayerDown = () => { game.toast('You were defeated…', '#ff8a8a'); w.reviveT = 1800; if (typeof gearLossOnDeath === 'function') gearLossOnDeath(game); };   // (dying in the Wilds costs all the gear you carry: durability.js)
  return w;
}
const regionName = i => areaLabel(REGIONS[i]);

// nearest open spot to (x, y), searching outward in rings
function findOpen(w, x, y) {
  for (let r = 0; r < 200; r += 4) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (px > w.bounds.x0 + 8 && px < w.bounds.x1 - 8 && py > w.bounds.y0 + 16 && py < w.bounds.y1 - 4 && !w.blocked(px, py)) return { x: px, y: py };
      if (r === 0) break;
    }
  }
  return { x, y };
}
// The world is long, so monsters live around the hero: about LOCAL_SPAN areas either side keep a population scaled
// by area size and the area's variant (swarming areas teem, quiet glades are sparse); monsters left far behind
// fade away and new ones appear out of sight ahead.
const zoneRegions = zi => REGIONS.filter(r => r.zone === zi);
const LOCAL_SPAN = 2, DESPAWN_DIST = 3400;
const VARIANT_MUL = { swarm: 1.7, calm: 0.45, elite: 1.0, treasure: 0.9, normal: 1 };
function localRegions(w) {
  const i = regionIndexAt(w.player.x), out = [];
  for (let k = i - LOCAL_SPAN; k <= i + LOCAL_SPAN; k++) if (REGIONS[k] && REGIONS[k].zone >= 0) out.push(REGIONS[k]);
  return out;
}
const regionPop = R => Math.round(Math.min(3.2, (R.w * R.h + (R.subs || []).reduce((s2, u) => s2 + u.w * u.h, 0)) / 1800) * 5 * (VARIANT_MUL[R.variant] || 1));
function spawnMonster(w, zi, initial, Rforce) {
  const regs = Rforce ? [Rforce] : zoneRegions(zi), wt = r => r.w * r.h * (VARIANT_MUL[r.variant] || 1), tot = regs.reduce((s, r) => s + wt(r), 0);
  let pickA = Math.random() * tot, R = regs[0];
  for (const r of regs) { pickA -= wt(r); if (pickA <= 0) { R = r; break; } }
  const Z = ZONES[R.zone];
  const rects = [R, ...(R.subs || [])], area = rects.reduce((s2, q) => s2 + q.w * q.h, 0);
  for (let k = 0; k < 80; k++) {
    let q = rects[0], pa = Math.random() * area; for (const c of rects) { pa -= c.w * c.h; if (pa <= 0) { q = c; break; } }
    const x = (q.ox + rand(1, q.w - 1)) * T, y = (q.oy + rand(2, q.h - 1)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || mapSolidAt(w.map, x, y - 12)) continue;
    // appear out of sight, but not too far, so fights keep coming
    if (Math.hypot(x - w.player.x, y - w.player.y) < (initial ? 150 : WVW / 2 + 20)) continue;
    // never inside an open black hole's pull (it would just swallow them, which looked like endless spawning)
    if ((w.caves || []).some(c => c.open && Math.hypot(x - c.x, (y - c.y) / 0.4) < CAVE.pull * 1.4 + 60)) continue;
    // Zenonia 2 lands are home to Zenonia 2 monsters (and the other way round), with a little crossover
    const own = (R.gen ? Math.random() < 0.5 : (R.tileset >= 200) === (Math.random() < 0.8)) ? Z.mobs2 || Z.mobs : Z.mobs;   // generated areas: half and half
    // each area has its own favourite species (seeded by the area), so neighbouring areas feel different
    const mob = own.filter(id => D.monsters[id]), fav = mob[(R.ox * 7 + R.oy) % mob.length];
    const sp = Math.random() < 0.4 ? fav : pick(mob);
    const side = q === R ? 0 : q.below ? SIDE.rankDown : SIDE.rankUp;   // a side area: the heights are gentler, the depths deadlier
    const m = makeMonster(sp, Math.max(0, Math.min(9, areaRank(R) + (R.variant === 'elite' ? 1 : 0) + side)), x, y);   // stronger the further from town
    if (R.variant === 'elite') { m.scale *= 1.12; m.maxHp = m.hp = Math.round(m.maxHp * 1.3); }
    m.home = { x, y }; m.dir = randi(0, 3); m.region = R.zone; m.area = R.key;
    if (typeof rollVariant === 'function') rollVariant(m);   // now and then shiny or giant
    w.actors.push(m);
    return m;
  }
}
function tendPopulation(w, dt) {
  const p = w.player;
  // fade out the ones left far behind (bosses and allies stay)
  for (const a of w.actors) if (a.kind === 'monster' && !a.ally && !a.boss && !a.dead && Math.abs(a.x - p.x) > DESPAWN_DIST) a.remove = true;
  // a newly reached stretch of the world fills at once, so the road ahead is never empty
  const here = regionIndexAt(p.x), target = R => Math.round(regionPop(R) * nightMul(NIGHT.pop)), live = R => w.actors.filter(a => a.kind === 'monster' && !a.ally && !a.boss && !a.dead && a.area === R.key).length;
  if (w.popAt !== here) {
    w.popAt = here;
    for (const R of localRegions(w)) for (let k = live(R), n = target(R); k < n; k++) spawnMonster(w, R.zone, true, R);
  }
  w.spawnT -= dt;
  if (w.spawnT > 0) return;
  w.spawnT = 2600 / nightMul(NIGHT.spawn);   // one new monster every ~2.5 s (twice as often at night), nearest areas first, while an area is below its number
  const regs = localRegions(w).sort((a, b) => Math.abs(REGIONS.indexOf(a) - here) - Math.abs(REGIONS.indexOf(b) - here));
  for (const R of regs) if (live(R) < target(R)) { spawnMonster(w, R.zone, false, R); return; }   // night: twice the numbers
}
// Mini bosses: one in every wild area (where the stone blocks used to stand) — a bigger, tougher version of a
// local monster, one rank up, with a "MINI BOSS" tag and health bar. It always drops a card one rank higher plus
// gear and goods; a new one turns up elsewhere in that area 1½–2½ minutes after it falls.
const MINI_RESPAWN = [90000, 150000];
function spawnMiniBoss(w, R) {
  const Z = ZONES[R.zone];
  for (let k = 0; k < 120; k++) {
    const x = (R.ox + 3 + Math.random() * (R.w - 6)) * T, y = (R.oy + 3 + Math.random() * (R.h - 5)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || mapSolidAt(w.map, x, y - 12) || mapSolidAt(w.map, x + 12, y) || mapSolidAt(w.map, x - 12, y)) continue;
    if (w.player && Math.hypot(x - w.player.x, y - w.player.y) < WVW / 2 + 20) continue;
    if (onDeck(w, x, y)) continue;
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (WILDS.bridges.some(b => b && tx >= b.x0 - 3 && tx <= b.x1 + 3 && ty >= b.y - 2 && ty <= b.y + bridgeRows(b) + 1)) continue;
    const own = R.tileset >= 200 ? Z.mobs2 || Z.mobs : Z.mobs;
    const m = makeMonster(pick(own.filter(id => D.monsters[id])), Math.min(9, areaRank(R) + 1), x, y);
    Object.assign(m, { boss: true, miniBoss: true, scale: 1.45, heavy: true, region: R.zone, area: R.key, home: { x, y }, dir: randi(0, 3) });
    m.maxHp = m.hp = Math.round(m.maxHp * 4); m.atk *= 1.3; giveWildKit(m);
    w.actors.push(m);
    return m;
  }
  return null;
}
function initMiniBosses(w) { w.miniT = {}; for (const R of localRegions(w)) spawnMiniBoss(w, R); }
function updateMiniBosses(w, dt) {
  for (const a of w.actors) if (a.miniBoss && !a.dead && Math.abs(a.x - w.player.x) > DESPAWN_DIST + 800) { a.remove = true; delete w.miniT[a.area]; }   // far behind: gone until you return
  const alive = new Set(w.actors.filter(a => a.miniBoss && !a.dead && !a.remove).map(a => a.area));
  for (const R of localRegions(w)) {
    if (alive.has(R.key)) continue;
    w.miniT[R.key] = (w.miniT[R.key] ?? (R.seenBoss ? rand(MINI_RESPAWN[0], MINI_RESPAWN[1]) : 0)) - dt; R.seenBoss = true;
    if (w.miniT[R.key] <= 0 && spawnMiniBoss(w, R)) delete w.miniT[R.key];
  }
}
function miniBossLoot(game, w, m) {
  const pr = game.profile;
  if (Math.random() < 0.5) w.drops.push({ kind: 'card', item: makeCard(m.sp, rareGate(m.tier)), x: m.x - 10, y: m.y });
  if (Math.random() < 0.4) w.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), dropRank(m.tier), pr.cls), x: m.x + 10, y: m.y });
  w.drops.push({ kind: 'goods', item: makeGoods(dropRank(m.tier)), x: m.x, y: m.y + 8 });
  if (Math.random() < RELIC_MINI_CHANCE) w.drops.push({ kind: 'relic', item: makeRelic(m.sp, m.tier, 'mini'), x: m.x, y: m.y - 8 });
  gainGold(game, w, m, 4);
  game.gainExp(killExp(m.tier) * 4);
  game.toast(`MINI BOSS DEFEATED — ${SPECIES[m.sp].name}!`, '#ffb84a');
  w.rings.push({ x: m.x, y: m.y, r: 34, t: 0, col: '#ffb84a' });
}
// Drops are rare and lean common. The stronger the monster, the rarer its card, and dropped cards and gear usually
// come a rank or two below the monster's own. Goods (potions, materials), gold and the odd bit of meat are the
// everyday loot.
const CARD_DROP = t => 0.11 * Math.pow(0.84, t);
const GEAR_DROP = 0.06;
const GOODS_DROP = 0.16, MEAT_DROP = 0.07;
// seeds for the farm (the Grocer sells them for 10 to 30 G a packet): wheat and berries are common, pumpkins rare and
// likelier from stronger monsters
const SEED_DROP = 0.08;
function dropSeed(tier) {
  const W = [['seed_wheat', 5], ['seed_berry', 4], ['seed_carrot', 4], ['seed_lettuce', 3], ['seed_tomato', 3], ['seed_nectarine', 2], ['seed_pumpkin', 1 + tier * 0.3]];
  let q = Math.random() * W.reduce((s, [, n]) => s + n, 0);
  for (const [id, n] of W) if ((q -= n) < 0) return id;
  return 'seed_wheat';
}
// ordinary monsters drop at a bit over half these rates; mini bosses, guardians and bosses keep the full ones
const DROP_MUL = 0.55;
const isBossKill = m => !!(m.miniBoss || m.boss || m.guardian != null || m.eliteEvt);
function dropRank(t) { let r = t; while (r > 0 && Math.random() < 0.55) r--; return rareGate(r); }
function gainGold(game, w, m, mul = 1) {
  const g = Math.round((2 + m.tier * 2 + Math.random() * (3 + m.tier * 2)) * mul * nightMul(NIGHT.gold));
  game.profile.gold = (game.profile.gold || 0) + g; netShare(game, 'gold', g);   // (an online co-op guest gets the same: net.js)
  floatText(w, m.x + 8, m.y - 26 - (m.z || 0), `+${g} G`, '#ffd23f', 6);
}
function onMonsterKill(game, w, m) {
  const pr = game.profile;
  pr.stats.kills++; if (typeof netPartyGuests === 'function' && netPartyGuests()) bumpStat('coopKills');   // (with friends: a party stat, netsocial.js)
  game.gainExp(killExp(m.tier));
  questEvent(game, 'kill', { sp: m.sp, tier: m.tier, zone: m.region != null ? m.region : w.rift ? w.rift.zone : w.zone, mini: !!m.miniBoss });
  netShare(game, 'kill', { sp: m.sp, tier: m.tier, zone: m.region != null ? m.region : w.rift ? w.rift.zone : w.zone, mini: !!m.miniBoss, guardian: m.guardian, elite: m.elite || undefined, x: Math.round(m.x), y: Math.round(m.y) });   // (online co-op: each friend's own EXP, quests and story count it too, net.js)
  if (typeof netPqEvent === 'function') netPqEvent(game, 'kill', { tier: m.tier, mini: !!m.miniBoss });   // (and the party's shared contracts, netquest.js)
  if (m.weeklyLord) lordKill(game, w, m);   // the weekly Black Hole Lord (daily.js)
  if (m.wellBoss) wellBossKill(game);   // the well quest (wellquest.js)
  if (m.sqBoss) sqBossKill(game, m);    // the side quests (sidequests.js)
  const p = w.player;
  if (p.transcend > 0 && typeof gainLayerXp === 'function') gainLayerXp(p, (3 + m.tier * 2) * (isBossKill(m) ? 3 : 1));   // Layer Mastery: only kills earn it
  if (p.passives.burst) heal(w, p, p.maxHp * p.passives.burst / 100 * 0.3);
  gainGold(game, w, m);
  if (Math.random() < COIN_DROP) w.drops.push({ kind: 'coin', item: { tier: 9 }, x: m.x + rand(-6, 6), y: m.y });
  const nd = nightMul(NIGHT.drops) * (isBossKill(m) ? 1 : DROP_MUL) * (typeof netPartyLoot === 'function' ? netPartyLoot() : 1);   // (online co-op: more loot for a bigger party, netparty.js)   // night: richer drops; ordinary monsters: leaner
  if (m.mimic) mimicLoot(game, w, m);
  else if (Math.random() < CARD_DROP(m.tier) * nd) w.drops.push({ kind: 'card', item: makeCard(m.sp, dropRank(m.tier)), x: m.x + rand(-6, 6), y: m.y + rand(-4, 4) });
  if (Math.random() < GEAR_DROP * nd) w.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), dropRank(m.tier), pr.cls), x: m.x + rand(-8, 8), y: m.y + rand(-4, 4) });
  if (Math.random() < GOODS_DROP * nd) w.drops.push({ kind: 'goods', item: makeGoods(dropRank(m.tier)), x: m.x + rand(-8, 8), y: m.y + rand(-4, 4) });
  if (Math.random() < MEAT_DROP * nd) w.drops.push({ kind: 'item', item: { id: 'meat', tier: 0, icon: itemIcon('meat') }, x: m.x + rand(-8, 8), y: m.y + rand(-4, 4) });
  if (Math.random() < SEED_DROP * nd) { const id = dropSeed(m.tier); w.drops.push({ kind: 'item', item: { id, tier: 0, icon: itemIcon(id) }, x: m.x + rand(-8, 8), y: m.y + rand(-4, 4) }); }
  if (m.alphaKey) alphaLoot(game, w, m);
  if (m.wellGuard) miniBossLoot(game, w, m);
  if (m.miniBoss) { miniBossLoot(game, w, m); bumpStat('miniBosses'); }
  if (m.hunter) bumpStat('mercs');
  if (typeof eventKill === 'function') eventKill(game, w, m);   // zone events and rare variants
  if (typeof petKill === 'function') petKill(game, w, m);       // the dog learns from the fight
}
function revivePlayer(w, p, hpFrac) {
  Object.assign(p, { dead: false, dying: false, remove: false, state: 'free', hp: Math.round(p.maxHp * hpFrac), mp: p.maxMp, invuln: 1500, alpha: 1, status: {},
    z: 0, vz: 0, vx: 0, vy: 0, transcend: 0, exhausted: 0, layerSel: null, dash: null, dashing: null });
  setAnim(p, 'idle', true);
  if (!w.actors.includes(p)) w.actors.push(p);
}
// Item magnet: drops within MAGNET.r of the hero fly to them (faster the closer they get), through walls and over
// edges, so loot that lands somewhere you can't walk is still yours; within MAGNET.take it is picked up.
const MAGNET = { r: 96, take: 16, speed: 140, accel: 900 };
function collectDrops(game, w, dt) {
  const p0 = w.player; if (!p0) return;
  const gs = game.net && game.net.role === 'host' ? w.actors.filter(a => a.netGid && !a.dead) : [];   // (online co-op: a friend's loot goes to them, net.js)
  for (const d of w.drops) {
    let p = p0; for (const g of gs) if (Math.hypot(g.x - d.x, g.y - d.y) < Math.hypot(p.x - d.x, p.y - d.y)) p = g;
    if (p.dead) continue;
    const dx = p.x - d.x, dy = p.y - d.y, dist = Math.hypot(dx, dy);
    if (dist < MAGNET.take) {
      d.taken = true;
      (w.glints = w.glints || []).push({ x: p.x + rand(-5, 5), y: p.y - (p.h || 26) * (p.scale || 1) - 4 + rand(-3, 3), t0: performance.now(), col: d.kind === 'coin' ? '#ffd23f' : d.kind === 'potion' ? '#ff9ab0' : '#c8f0ff' });   // a tiny twinkle over the hero's head (drawGlints)
      if (p.netGid && d.kind !== 'potion') netShare(game, 'drop', { kind: d.kind, item: d.item }, p.netGid);
      else if (d.kind === 'coin') { pickCoin(game); logIcon(game, homeIcon(21)); }
      else if (d.kind === 'potion') { heal(w, p, p.maxHp * 0.3); p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.3); game.toast(`Potion! +30% HP & MP${fedNote(healFeeds(game, 0.3))}`, '#ff8aa0'); }
      else game.pickup(d);
    } else if (dist < MAGNET.r || d.pulled) {   // once pulled, it keeps coming
      d.pulled = true;
      d.pullV = Math.min(600, (d.pullV || MAGNET.speed) + MAGNET.accel * dt / 1000);
      const step = Math.min(dist, d.pullV * dt / 1000);
      d.x += dx / dist * step; d.y += dy / dist * step;
    }
  }
  w.drops = w.drops.filter(d => !d.taken);
}
function sendHome(w, p) {
  const s = (typeof homePointSpot === 'function' && window.GAME && homePointSpot(w, GAME.profile)) || findOpen(w, HOME_DOOR.x + TOWN_OX, HOME_DOOR.y + TOWN_OY + 18);   // (outside your home point's door: towns.js)
  p.x = s.x; p.y = s.y; p.z = 0; p.vz = 0; p.vx = p.vy = 0;
  for (const P of w.portals) P.armed = false;
  for (const a of w.actors) if (a.ally && a.owner === p) { a.x = p.x + rand(-20, 20); a.y = p.y + 8; }
}
function updateOverworld(game, w, dt) {
  tendPopulation(w, dt); partnerTick(w, dt);
  updateJourney(game, w, dt);
  updateMiniBosses(w, dt);
  w.actors = w.actors.filter(a => !a.remove);
  const p = w.player;
  collectDrops(game, w, dt);
  updateProps(w, dt);
  // entering a new region
  const r = regionIndexAt(p.x);
  if (r !== w.region) {
    const prev = REGIONS[w.region];
    w.region = r; w.name = regionName(r);
    journeyEnter(game, w, REGIONS[r], prev);
  }
  // stepping into a side area above or below the road (worldgen.js SIDE): a banner says which, and how dangerous
  { const R = REGIONS[r], u = (R.subs || []).find(q => p.y >= q.oy * T && p.y < (q.oy + q.h) * T && p.x >= q.ox * T && p.x < (q.ox + q.w) * T) || null;
    if (u !== (w.sideHere || null)) {
      w.sideHere = u;
      if (u) game.banner = { kind: 'area', title: `${u.below ? 'The Depths' : 'The Heights'} · ${MAPS[u.map].name}`, sub: sideBannerSub(game, R, u), t: 0, dur: 3000 };
    } }
  // return portals: arm once you walk away, then stepping on one takes you to the fountain
  for (const P of w.portals) {
    const pd = Math.hypot(p.x - P.x, p.y - P.y);
    if (pd > 40) P.armed = true;
    if (P.armed && pd < 12 && !p.dead) { sendHome(w, p); game.toast('Back in town', '#ffe9a8'); return; }
  }
  if (w.reviveT != null) {
    w.reviveT -= dt;
    if (w.reviveT <= 0) {
      w.reviveT = null;
      revivePlayer(w, p, 1);
      setAnim(p, 'idle', true);
      sendHome(w, p); game.toast(`You wake at home in ${typeof homePlace === 'function' ? homePlace(game.profile) : 'Hearthvale'}`, '#ffe9a8'); if (typeof wakeHint === 'function') wakeHint(game);   // no checkpoints: a defeat always sends you home
    }
  }
}
function drawPortal(P, now) {
  const k = 0.5 + 0.5 * Math.sin(now / 200);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(120,200,255,${0.25 + 0.35 * k - i * 0.08})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(P.x, P.y, 13 + i * 4 + k * 2, 5 + i * 1.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = `rgba(160,220,255,${0.15 + 0.15 * k})`;
  ctx.fillRect(P.x - 9, P.y - 40, 18, 40);
  text(P.label || 'Town', P.x, P.y - 46, '#bfe6ff', 8);
}
// Minimap of the whole overworld: regions, bridges, portals, monsters, you
function drawMinimap(w, now) {
  const s = 0.72, mw = WILDS.w * s, mh = WILDS.h * s, x0 = VW - mw - 8, y0 = 62;
  ctx.fillStyle = 'rgba(8,10,16,0.75)'; ctx.fillRect(x0 - 3, y0 - 3, mw + 6, mh + 6);
  REGIONS.forEach((r, i) => {
    ctx.fillStyle = r.zone < 0 ? (r.town ? '#e0c890' : '#c8b070') : ['#3f7a3a', '#2e4a6a', '#6ab8f0', '#7aa0c8'][r.zone];
    ctx.globalAlpha = i === w.region ? 0.95 : 0.55;
    ctx.fillRect(x0 + r.ox * s, y0 + r.oy * s, r.w * s, r.h * s);
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#c8955a';
  for (const b of WILDS.bridges) if (b) ctx.fillRect(x0 + b.x0 * s, y0 + b.y * s, (b.x1 - b.x0 + 1) * s, bridgeRows(b) * s);
  ctx.fillStyle = '#ff6a5a';
  for (const a of w.actors) if (a.kind === 'monster' && !a.dead && !a.ally) ctx.fillRect(x0 + a.x / T * s - 0.6, y0 + a.y / T * s - 0.6, 1.2, 1.2);
  ctx.fillStyle = '#9fe8ff';
  for (const P of w.portals) ctx.fillRect(x0 + P.x / T * s - 1, y0 + P.y / T * s - 1, 2, 2);
  if (w.evilGate) { ctx.fillStyle = '#c88aff'; ctx.fillRect(x0 + w.evilGate.x / T * s - 1.5, y0 + w.evilGate.y / T * s - 1.5, 3, 3); }
  const p = w.player;
  ctx.fillStyle = Math.floor(now / 300) % 2 ? '#fff' : '#ffd23f';
  ctx.fillRect(x0 + p.x / T * s - 1.5, y0 + p.y / T * s - 1.5, 3, 3);
  REGIONS.forEach((r, i) => text(r.zone < 0 ? 'Town' : ZONES[r.zone].name.split(' ')[0], x0 + (r.ox + r.w / 2) * s, y0 + mh + 8, i === w.region ? '#ffd23f' : '#9a917c', 6));
}

function townInteract(game, w) {
  const p = w.player;
  let best = null, bd = 30;
  for (const a of w.actors) if (a.role && !a.away) { const d = dist(a, p); if (d < bd) { bd = d; best = a; } }
  if (!best && !w.interior && Math.hypot(ALTAR_W.x - p.x, ALTAR_W.y - p.y) < 80) best = { role: 'altar', label: 'Fusion Fountain' };
  if (!best) return false;
  if (storyTalk(game, w, best)) return true;   // the main quest's givers (chapters.js)
  if (best.role === 'grandpa') { grandpaVisit(game); return true; }   // (homelife.js)
  if (best.role === 'partner') { partnerChat(game, best); return true; }
  if (best.role === 'raid' && typeof raidMenu === 'function') { game.openMenu(raidMenu()); return true; }   // (raids.js)
  if (best.role === 'collector') { game.openMenu(curioMenu()); return true; }   // (curios.js)
  if (best.role === 'angler') { game.openDialog(best.label, 'The lake is quiet tonight or noon, it makes no odds. Sit down, the rod is yours.', null); game.menu.onDone = () => game.openMenu(lakeFish()); return true; }
  if (favourTalk(game, best)) return true;        // a small favour for today (folkday.js)
  if (townLifeTalk(game, w, best)) return true;   // the towns' people and pastimes (townlife.js)
  if (tentTalk(game, w, best)) return true;       // whoever lives in a camp (tentfolk.js)
  if (treeTalk(game, w, best)) return true;       // whoever lives in a hollow tree (sidequests.js)
  game.openDialog(best.label || 'Villager', (best.role === 'folk' && typeof lookCompliment === 'function' && lookCompliment(game, best)) || best.line || NPC_LINES[best.role] || HOUSE_LINES[best.role], best.role);   // (plain folk notice a new look: lookchat.js)
  return true;
}

// ================================================================ ARENA (PvP): the Sun Temple
// The ranked arena is built from the game's own pixel art (map arena2, see worldgen.js): the sandstone temple court
// with its winged statue and twin pools at the north end, a wide duelling floor laid in temple stone with a
// patterned ring, side walls and a south rampart. A crowd of townsfolk lines the north wall and the rampart and
// jumps when the blows land; red and blue banners hang over the court; warm sunbeams slant across the stone; glowing rings mark each fighter's start; confetti falls on a K.O.
const ARENA_M = () => MAPS.arena2;
const ARENA_W = ARENA2.W * T, ARENA_H = ARENA2.H * T, ARENA_ZOOM = 1.15;
const ARENA_START = [{ x: ARENA2.p1[0] * T + 8, y: ARENA2.p1[1] * T + 8 }, { x: ARENA2.p2[0] * T + 8, y: ARENA2.p2[1] * T + 8 }];
// the whole arena (ground + every object) as one picture, for the hub backdrop
let ARENA_BG = null;
function renderArenaBg() {
  const M = ARENA_M(), c = document.createElement('canvas'); c.width = ARENA_W; c.height = ARENA_H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(mapBg('arena2'), 0, 0);
  const oimg = img(D.objects.img);
  for (const [bank, fi, x, y] of M.objB.slice().sort((a, b) => a[3] - b[3])) { if (FIRE_BANKS.has(pad3(bank))) continue; const r = objRec(pad3(bank), fi); if (r) g.drawImage(oimg, r[0], r[1], r[2], r[3], x + r[4], y + r[5], r[2], r[3]); }
  return c;
}
// spectators: three tiers of the north stands (the royal box left empty for its shrine), the south stands and rampart,
// and up on the side stands
function arenaCrowd() {
  const out = [], ids = ['100', '101', '102', '103', '106', '107', '108', '109', '110', '113', '115', '116', '117', '118', '120', '121'].filter(n => D.npcs[n]);
  const r = rng(9);
  for (const row of [1, 2, 3]) for (let x = 1; x < ARENA2.W - 1; x++) {
    if (x >= ARENA2.box.x0 && x <= ARENA2.box.x1) continue;
    if (r() < 0.78) out.push({ npc: ids[Math.floor(r() * ids.length)], x: x * T + 8 + (r() - 0.5) * 6, y: row * T + 12, dir: 2, ph: r() * 6 });
  }
  for (let x = 1; x < ARENA2.W - 1; x++) for (const row of [24, 25]) if (r() < 0.75) out.push({ npc: ids[Math.floor(r() * ids.length)], x: x * T + 8 + (r() - 0.5) * 8 + (row === 26 ? 6 : 0), y: row * T + 12, dir: 0, ph: r() * 6 });
  for (let y = 5; y < 24; y += 1) for (const [x, dir] of [[0.9, 1], [ARENA2.W - 0.9, 3]]) if (Math.abs(y - ARENA2.p1[1] + 0.5) > 1.5 && r() < 0.7) out.push({ npc: ids[Math.floor(r() * ids.length)], x: x * T + (r() - 0.5) * 6, y: y * T + 10, dir, ph: r() * 6 });   // up on the side walls
  return out.sort((a, b) => a.y - b.y);
}
const ARENA_BANNERS = [[3, '#b8262a'], [13, '#b8262a'], [20, '#2a56c0'], [30, '#2a56c0']];   // on the north pit wall, between the shields
function drawArenaBehind(w, now) {
  const p = 0.5 + 0.5 * Math.sin(now / 600);
  // (the fighters' glowing start rings were removed on 2026-11-20, the user: "remove that in ranked fights")
  // banners hanging on the north pit wall
  for (const [tx, col] of ARENA_BANNERS) {
    const x = tx * T + 2, y = 4 * T + 2, sway = Math.round(Math.sin(now / 900 + tx) * 1);
    ctx.fillStyle = '#3a2410'; ctx.fillRect(x - 2, y - 2, 16, 2);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y); ctx.lineTo(x + 12 + sway, y + 26); ctx.lineTo(x + 6 + sway, y + 21); ctx.lineTo(x + sway, y + 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 9, y, 3, 22);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 5 + sway, y + 7, 2, 7); ctx.fillRect(x + 3 + sway, y + 9, 6, 2);
  }
}
function drawArenaDecor(w, now) {
  const hype = (w.hitStop > 0 || w.shake > 1 || w.slowmo > 0);
  // the crowd (drawn over the walls, under the HUD)
  if (!w.crowd) w.crowd = arenaCrowd();
  for (const s of w.crowd) {
    const bank = D.npcs[s.npc], seq = bank.anims.idle[s.dir] || bank.anims.idle[2], e = seqFrame(seq, now + s.ph * 300, true);
    const hop = Math.max(0, Math.sin(now / (hype ? 90 : 260) + s.ph)) * (hype ? 4 : 1.2);
    drawBankFrame(bank, e, Math.round(s.x), Math.round(s.y - hop));
  }
  // warm sunbeams slanting across the stone
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x0 = 60 + i * 130 + Math.sin(now / 4000 + i) * 10, a = 0.05 + 0.025 * Math.sin(now / 1500 + i * 2);
    const g = ctx.createLinearGradient(x0, 0, x0 + 120, ARENA_H); g.addColorStop(0, `rgba(255,230,170,${a * 1.6})`); g.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 34, 0); ctx.lineTo(x0 + 150, ARENA_H); ctx.lineTo(x0 + 100, ARENA_H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // confetti rains down after a K.O.
  if (w.slowmo > 0 || w.confetti > 0) {
    w.confetti = w.slowmo > 0 ? 2500 : w.confetti - 16;
    const cr = rng(7), cols = ['#ff5a4e', '#4ea8ff', '#ffd23f', '#ffffff', '#8fffb0', '#c890ff'];
    for (let i = 0; i < 90; i++) {
      const x0 = cr() * ARENA_W, sp = 30 + cr() * 40, ph = cr() * 1000;
      const yy = ((now + ph * 10) / 1000 * sp) % (ARENA_H + 20) - 10, xx = x0 + Math.sin(now / 300 + ph) * 8;
      ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(Math.round(xx), Math.round(yy), 2, 2);
    }
  }
}
function makeArena(game, prA, prB, cpu) {
  const w = mapWorld('arena2');
  w.name = 'Sun Temple Arena'; w.zoom = ARENA_ZOOM; w.arena = true;
  const base = w.blocked;
  w.blocked = (x, y, a) => !(a && a.state === 'air') && (y > ARENA2.pit.y1 * T + 12 || base(x, y, a));   // nobody climbs into the south stands
  w.decor = drawArenaDecor; w.decorBehind = drawArenaBehind;
  const p1 = makePlayerActor(prA, 0, ARENA_START[0].x, ARENA_START[0].y), p2 = makePlayerActor(prB, 1, ARENA_START[1].x, ARENA_START[1].y);
  p1.dir = 1; p2.dir = 3; p1.marker = '#ff5a4e'; p2.marker = '#4ea8ff'; p1.pvp = 0; p2.pvp = 1;
  w.actors.push(p1, p2);
  w.player = p1; w.p2 = p2; w.cpu = cpu;
  spawnFamiliars(w, p1); spawnFamiliars(w, p2);
  return w;
}

// CPU opponent input for the arena
function cpuInput(w, me, foe, dt) {
  const ai = me.cpu || (me.cpu = { think: 0, mx: 0, my: 0, atk: false });
  const sk = (window.GAME && GAME.arena && GAME.arena.cpuSkill) || 1;   // ranked rivals: sharper in higher leagues
  ai.think -= dt * (0.7 + 0.3 * sk);
  const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy);
  const inp = { mx: ai.mx, my: ai.my, atk: false, spell: [false, false, false], fusion: false };
  if (ai.think <= 0) {
    ai.think = rand(110, 260);
    const retreat = me.hp < me.maxHp * 0.3 && Math.random() < 0.3;
    if (Math.abs(dx) > Math.abs(dy)) { ai.mx = Math.sign(dx); ai.my = Math.abs(dy) > 6 ? Math.sign(dy) : 0; }
    else { ai.my = Math.sign(dy); ai.mx = Math.abs(dx) > 6 ? Math.sign(dx) : 0; }
    if (retreat) { ai.mx = -ai.mx; ai.my = -ai.my; }
    if (d < 26 && !retreat) ai.mx = ai.my = 0;
    ai.atk = d < 36;
  }
  inp.mx = ai.mx; inp.my = ai.my;
  inp.atk = ai.atk && Math.random() < 0.09 * sk;
  if (d < 150 && Math.random() < 0.012 * sk) inp.spell[randi(0, 2)] = true;
  if (me.state === 'attack' && me.hitLanded && Math.random() < 0.05 * sk) inp.spell[randi(0, 2)] = true;
  if (!(me.layerCd > 0) && !(me.transcend > 0) && d < 80 && Math.random() < 0.01) inp.layer = true;
  if (me.transcend > 0 && d < 140 && Math.random() < 0.02) {   // CPU layers whatever is ready
    me.layerSel = [0, 1, 2].map(i => !!me.spells[i] && !(me.cds[i] > 0)).concat([!!me.fusion && !me.fusionUsed]);
    inp.layer = true;
  }
  // raise a guard against melee now and then (held for a moment)
  if (ai.blockT > 0) { ai.blockT -= dt; inp.block = true; inp.mx = Math.sign(dx); inp.my = 0; }
  else if (d < 40 && foe.state === 'attack' && Math.random() < 0.04 * sk) ai.blockT = rand(300, 700);
  // dodge incoming attacks/spells now and then
  if (d < 50 && (foe.state === 'attack' || foe.state === 'cast') && Math.random() < 0.06 * sk) {
    inp.dash = true; inp.mx = -Math.sign(dx) || 1; inp.my = Math.random() < 0.5 ? -1 : 1;
  }
  return inp;
}
