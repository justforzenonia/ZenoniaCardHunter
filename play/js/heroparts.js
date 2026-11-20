'use strict';
// HERO PARTS: the customization screen colours a hero body part by part (hair, skin, top, pants, boots, outfit, accent, trim,
// hat). Every hero body's sprite uses a small fixed palette (about 17 to 45 colours over all its frames), so each colour that
// belongs to a part is listed here once, per body, from the standing and walking frames. Colours not listed (the outline,
// eye whites, weapons painted into the frames, spell sparkles, flames) keep their own colour.
// A part is repainted as a shade ramp: its shades keep their light-to-dark steps around the chosen colour, so any part
// can take any colour (dark hair can go blond). A head borrowed from another body is painted by its own body's table.
// pr.look.char.parts = { hair: STYLE_COLORS id, skin: SKIN_TONES id, ... }; charmake.js charBake paints the sprites first.
const HERO_PART_NAMES = { hair: 'Hair', skin: 'Skin', top: 'Top', pants: 'Pants', boots: 'Boots', outfit: 'Outfit', accent: 'Accent', trim: 'Trim', hat: 'Hat' };
const HERO_PART_MAPS = {
  // the three Zenonia heroes (Berserker, Paladin, Assassin, and the classes that share them) share one palette
  sprite0: { hair: ['fffb00', 'efae39', 'bd7118', 'a57939', 'fffbff'], skin: ['ffdfbd', 'ceae84', 'f7db8c'], top: ['182021', '423c39'],
             pants: ['52a6bd', '8ce7ef', '5a7194'], boots: ['e7e3e7', '949aa5'] },
  // Lu: dark blue hair, a brown tunic and bow, gold ornaments and a green sash
  sprite3: { hair: ['525173', '31385a', '101c39', '8475a5'], skin: ['efc784', 'ceae84', 'ffdfbd'],
             outfit: ['291c08', '5a3c18', '6b4518', '734918', '392810', '733c18', 'b5794a', '733000', 'ad4908', '945d21', '522400', '312408', 'ad7531', '422c10', '6b4521', '4a3000'],
             accent: ['bd8a29', '392000', '5a3408', '845118', '298639'] },
  // Ecne: sandy hair, a blue dress, red trim (her sword keeps its steel)
  sprite4: { hair: ['ffcf8c', 'de926b', 'c65939', '522418', '8c385a', '5a2439'], skin: ['ffebde', 'ffaebd'],
             outfit: ['3934b5', '5251de', '8496f7', '5a1ca5'], accent: ['422429', 'ce757b', '731c21', '842031'] },
  // Morpice: blue-grey hair, a red coat, a brown shield and belt
  sprite5: { hair: ['a5c7ff', '8496f7', '52618c', 'deefff', '5a1ca5', 'cec7de'], skin: ['ceae84', 'ffdfbd'],
             outfit: ['ff5542', 'c61018', '6b1c00', '733831', 'b55531', '733c21', '944129', 'a5696b', '730000', 'e75939', 'ff614a', '941c29', '842831', 'ce2c52'],
             accent: ['6b3818', '733c18'] },
  // Daza: brown hair, grey armour, a silver mask, blue and pink trim (his flame gauntlets keep their fire)
  sprite6: { hair: ['a57963', '734931', '421c39', '5a2852', 'e7a2d6'], skin: ['d6aa94'], outfit: ['6b6973', '9c9ead', '949aa5'],
             accent: ['292c39', 'a5c7ff', '001c52', '0038d6', 'ad6d9c', 'd69ec6'], trim: ['c6c7c6', '9c9a9c', 'f7f7f7', 'fffbff'] },
  // Chef Daddy: a white hat, a white jacket, dark trousers, a red neckerchief
  chef: { hat: ['ffffff', 'eef0f6', 'cfd2d7', 'b8c0d0', 'd8dde8'], skin: ['ffcb94', 'de9673', 'ffdfbd', 'f7db8c', 'ceae84'], hair: ['bd7118', '733c18', '4a2410', 'efae39'],
          top: ['b8bdc5', '949aa5', 'f6f7f8', 'e0e2e6', 'd6d9de', 'e7e3e7', 'd1d4da', 'fffbff'], pants: ['423c39', '182021', '181818'], accent: ['d8342a'] },
};
// which table a body id uses ('h' + class index; villagers, monsters and the Archer have none)
function heroPartKey(id) {
  if (!id || id[0] !== 'h') return null; const C = CLASSES[+id.slice(1)]; if (!C || C.mon || C.bank) return null;
  const k = C.sheet ? 'chef' : (C.sprite || 0) <= 2 ? 'sprite0' : 'sprite' + C.sprite; return HERO_PART_MAPS[k] ? k : null;   // (sprites 0-2 share one palette)
}
const heroPartsOf = id => { const k = heroPartKey(id); return k ? Object.keys(HERO_PART_MAPS[k]) : []; };
const heroPartSet = p => p === 'skin' ? SKIN_TONES : STYLE_COLORS;
// the colour a choice aims for, as HSL (its swatch, or for a hidden look like the Glint its own hue and lightness)
function heroPartTarget(p, id) {
  const S = heroPartSet(p)[id] || STYLE_COLORS[id]; if (!S || id === 'orig') return null;   // (the preview's Glint is a STYLE_COLORS entry, skin rows too)
  if (S.swatch) { const n = parseInt(S.swatch.slice(1), 16); return rgb2hsl(n >> 16, (n >> 8) & 255, n & 255); }
  return S.h != null ? [S.h, Math.min(1, S.s), Math.min(0.95, 0.5 * S.l)] : null;
}
// colour → new colour for a body's table and a set of choices
function heroPartRemap(key, parts) {
  const M = HERO_PART_MAPS[key], out = new Map(); if (!M || !parts) return out;
  for (const [p, list] of Object.entries(M)) {
    const T = heroPartTarget(p, parts[p]); if (!T) continue;
    const hs = list.map(h => { const n = parseInt(h, 16); return [n, rgb2hsl(n >> 16, (n >> 8) & 255, n & 255)]; });
    const mL = hs.reduce((a, [, c]) => a + c[2], 0) / hs.length, mS = hs.reduce((a, [, c]) => a + c[1], 0) / hs.length || 1;
    for (const [n, [, s, l]] of hs) {
      const L = Math.max(0.04, Math.min(0.97, T[2] + (l - mL) * 0.9)), S = Math.max(0, Math.min(1, T[1] * Math.max(0.6, Math.min(1.4, s / mS))));
      out.set(n, hsl2rgb(T[0], S, L).map(Math.round));
    }
  }
  return out;
}
const HERO_PARTS_CACHE = new Map();
// an image (or canvas) with a body's parts repainted; the same image back when nothing changes
function heroPartsImage(image, key, parts) {
  if (!image || !key || !parts || !Object.values(parts).some(v => v && v !== 'orig')) return image;
  const ck = (image.src || image._hpId || (image._hpId = 'c' + Math.random())) + '|' + key + '|' + JSON.stringify(parts);
  if (HERO_PARTS_CACHE.has(ck)) return HERO_PARTS_CACHE.get(ck);
  if (image.complete === false) return image;
  const R = heroPartRemap(key, parts); if (!R.size) return image;
  const c = document.createElement('canvas'); c.width = image.naturalWidth || image.width; c.height = image.naturalHeight || image.height;
  const g = c.getContext('2d'); g.drawImage(image, 0, 0); let id;
  try { id = g.getImageData(0, 0, c.width, c.height); } catch (e) { return image; }   // (pixels blocked, e.g. opened from file://)
  const px = id.data;
  for (let i = 0; i < px.length; i += 4) { if (!px[i + 3]) continue; const to = R.get((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]); if (to) { px[i] = to[0]; px[i + 1] = to[1]; px[i + 2] = to[2]; } }
  g.putImageData(id, 0, 0); HERO_PARTS_CACHE.set(ck, c); return c;
}

// the customization screen's labels for the part rows (ui.js customRows: 'p_hair' and so on)
Object.assign(CUSTOM_LABEL, Object.fromEntries(Object.entries(HERO_PART_NAMES).map(([p, n]) => ['p_' + p, n])));
