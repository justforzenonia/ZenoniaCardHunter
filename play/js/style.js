'use strict';
// Character appearance: per-class sprite banks with hair/outfit recolouring (customization).

const STYLE_CACHE = {};

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function applyColor(h, s, l, spec) {
  if (!spec || spec.h == null) return null;
  return hsl2rgb(spec.h, Math.min(1, s * spec.s + (spec.s < 0.3 ? 0 : 0.05)), Math.min(0.97, l * spec.l));
}

// Classify a body pixel: hair = saturated yellow (all three sprite sets are blond),
// skin = light orange, outline/greys untouched, everything else saturated = outfit.
function pixelPart(h, s, l) {
  if (s < 0.18 || l < 0.12 || l > 0.94) return null;
  if (h >= 36 && h <= 66 && s > 0.35 && l > 0.3) return 'hair';
  if (h >= 12 && h < 36 && l > 0.55) return 'skin';
  return 'outfit';
}

function recolorBank(bank, hairId, outfitId, skinId) {
  const srcName = bank.img || (bank.imgs && bank.imgs[0]);   // hero banks have one image, monster banks a palette list
  const key = srcName + '|' + hairId + '|' + outfitId + (skinId && skinId !== 'orig' ? '|' + skinId : '');
  if (STYLE_CACHE[key]) return STYLE_CACHE[key];
  const hair = STYLE_COLORS[hairId], outfit = STYLE_COLORS[outfitId], skin = typeof SKIN_TONES !== 'undefined' && SKIN_TONES[skinId];
  const src = bank.canvas || img(srcName);
  let out = bank;
  if ((hair && hair.h != null) || (outfit && outfit.h != null) || (skin && skin.h != null)) {
    try {
      const c = document.createElement('canvas');
      c.width = src.naturalWidth || src.width; c.height = src.naturalHeight || src.height;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      const id = g.getImageData(0, 0, c.width, c.height), px = id.data;
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        const [h, s, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
        const part = pixelPart(h, s, l);
        const rgb = part === 'hair' ? applyColor(h, s, l, hair) : part === 'outfit' ? applyColor(h, s, l, outfit) : part === 'skin' ? applyColor(h, s, l, skin) : null;
        if (rgb) { px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; }
      }
      g.putImageData(id, 0, 0);
      out = { ...bank, canvas: c };
    } catch (e) {
      out = bank;   // pixel access blocked (e.g. opened from file://): fall back to original colours
    }
  }
  STYLE_CACHE[key] = out;
  return out;
}

// Everything needed to draw a player of class `cls` with appearance `look` and weapon tier `wlook`.
// Weapon frames that sit wrong in the decoded data, nudged once at load: [sprite set, frames, dx, dy]. The Paladin's
// first swing facing down (frames 90–93) hung the blade a hand's width below his grip, so it looked thrown.
const WEAPON_FIX = [[1, [90, 91, 92, 93], -3, -8]];
for (const [sp, ids, dx, dy] of WEAPON_FIX) for (const W of (D.classes[sp] && D.classes[sp].weapons) || [])
  for (const i of ids) { const f = W.frames[i]; if (f && !f.fixed) { f[4] += dx; f[5] += dy; f.fixed = true; } }
const GLOW = {
  arcane: 'hue-rotate(190deg) saturate(1.6) brightness(1.35) drop-shadow(0 0 2px #9fb8ff)',
  spirit: 'hue-rotate(95deg) saturate(1.4) brightness(1.25) drop-shadow(0 0 2px #8fffd0)',
};
// Some original animations have blank frames (Daza's victory pose warps him out for 12 frames): the hero holds his
// last drawn pose through them instead of vanishing. Worked out once per sprite.
const HELD_ANIMS = new Map();
function holdBlankFrames(anims, frames) {
  if (!HELD_ANIMS.has(anims)) {
    const drawn = e => { const f = frames[e[0]]; return Array.isArray(f) && f[2] > 0; };
    const out = {};
    for (const [name, dirs] of Object.entries(anims)) {
      out[name] = dirs.map(seq => {
        if (!seq || seq.every(drawn)) return seq;
        let last = seq.find(drawn); if (!last) return seq;
        return seq.map(e => drawn(e) ? (last = e) : [last[0], e[1], last[2], last[3]]);
      });
    }
    HELD_ANIMS.set(anims, out);
  }
  return HELD_ANIMS.get(anims);
}
// the look you chose in the character maker goes over the class's body (charmake.js)
function playerBanks(cls, look, wlook) {
  const B0 = classBanks(cls, look, wlook), B = groundedCast(B0), body = look && look.char && charBody(B.body.frames, B.anims, look.char);
  return body ? { ...B, body } : B;
}
// A GROUNDED CAST (2026-11-13): Ecne's and Daza's 'cast' frames are a jump (the body climbs up to 46 px). The hero plays 'cast'
// on a loop for Fusion, the Layer and Ki, so on every loop the hero leapt up and snapped back to the ground. The same frames now
// stay on the ground; other moves are untouched.
const GROUNDED = new Map();
function groundedCast(B) {
  const A = B.anims, cs = A && A.cast;
  if (!cs || !cs.some(s => s && s.some(e => e[3] < -8))) return B;
  let G = GROUNDED.get(A);
  if (!G) { G = { ...A, cast: cs.map(s => s && s.map(e => e[3] < 0 ? [e[0], e[1], e[2], Math.max(e[3], -2), ...e.slice(4)] : e)) }; if (A.charge === cs) G.charge = G.cast; GROUNDED.set(A, G); }
  return { ...B, anims: G };
}
function classBanks(cls, look, wlook) {
  const C = CLASSES[cls], lk = look || {};
  if (C.mon) {   // a playable monster: its own bank is the whole body (sword included); missing moves fall back via MON_MAP
    const M = D.monsters[C.mon];
    return { body: recolorBank(M, lk.hair || C.hair, lk.outfit || C.outfit), weapon: null, fx: null, anims: M.anims, fist: false, glow: null, focus: null };
  }
  const S = D.classes[C.sprite];
  if (C.bodySheet) {   // a hero on their own editable sheet with the base hero's frame layout (OmegaKingX); it gains a CHARGE animation
    // (the base hero's sword hand is on his sword sheet: tools/build_hero_hands.py cuts it out as its own layer)
    // (a hero with a bank of their own — the Archer — has their own frames, both hands and the bow painted in)
    const own = C.bank && window[C.bank];
    if (own) return { body: { img: own.img, frames: own.frames }, weapon: null, fx: null, anims: own.anims, fist: false,
      glow: null, focus: null, aura: lk.aura && AURAS[lk.aura] && AURAS[lk.aura].swatch || null };
    const hand = C.sprite === 0 ? { img: 'assets/hero_hand.png', frames: S.weapons[0].frames } : null;
    return { body: { img: C.bodySheet, frames: S.body.frames }, weapon: hand, fx: null, anims: { ...S.anims, charge: S.anims.charge || S.anims.cast }, fist: !!C.fist,
      glow: null, focus: null, aura: lk.aura && AURAS[lk.aura] && AURAS[lk.aura].swatch || null };
  }
  return {
    // Chef Daddy wears his own hand-editable sheet (assets/chef_body.png, made by tools/build_chef_sprites.py)
    body: C.sheet && window.CHEF_BODY ? CHEF_BODY : recolorBank(S.body, lk.hair || C.hair, lk.outfit || C.outfit, lk.skin),
    // casters don't swing a sword: no weapon / slash layers, a floating focus instead
    // (Chef Daddy swings a frying pan: assets/chef_pan.png)
    // (a Zenonia 2 caster, Morpice, keeps his original weapon and attack layers)
    weapon: (C.focus && !C.z2) || C.fist ? null : C.sheet && window.CHEF_PAN ? CHEF_PAN : S.weapons[wlook || 0], fx: (C.focus && !C.z2) || C.fist ? null : S.fx, anims: holdBlankFrames(S.anims, S.body.frames), fist: !!C.fist,
    glow: lk.wglow && WEAPON_GLOWS[lk.wglow] && WEAPON_GLOWS[lk.wglow].swatch ? `drop-shadow(0 0 1.5px ${WEAPON_GLOWS[lk.wglow].swatch}) drop-shadow(0 0 3px ${WEAPON_GLOWS[lk.wglow].swatch})` : C.glow && !(C.focus && C.z2) ? GLOW[C.glow] : null,
    // (a Zenonia 2 hero keeps his own sheet as is: Morpice holds only his spellbook, no floating orb or painted fist)
    focus: C.focus && !C.z2 ? C.focus : null, focusGlow: lk.wglow && WEAPON_GLOWS[lk.wglow] && WEAPON_GLOWS[lk.wglow].swatch || (C.glow === 'arcane' ? '#9fb8ff' : '#8fffd0'),
    aura: lk.aura && AURAS[lk.aura] && AURAS[lk.aura].swatch || null,
  };
}
