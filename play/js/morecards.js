'use strict';
// MORE CARDS, their looks (the cards themselves are in defs.js: HERO_CARDS, NPC_CARDS2, VARIANT; 2026-11-18).
//   HERO cards show the class's own hero (drawPlayerPreview, the class's default look) on the card.
//   ELITE variants wear a gold rim round their monster; GIANT variants are recoloured (each its own hue, fixed per monster) and, when
//   one fights for you, 1.35 times the size.
const MORECARDS = { eliteRim: 'sepia(0.35) saturate(1.3) brightness(1.1) drop-shadow(2px 0 0 #ffd23f) drop-shadow(-2px 0 0 #ffd23f) drop-shadow(0 2px 0 #ffd23f) drop-shadow(0 -2px 0 #ffd23f) drop-shadow(0 0 4px rgba(255,200,60,0.95))', giantScale: 1.35 };
const giantFilter = id => { const b = String(SPECIES[id] && SPECIES[id].base || id), h = 90 + (([...b].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0) % 180); return `hue-rotate(${h}deg) saturate(1.25) contrast(1.05)`; };
// the other kinds (2026-11-18): the element kinds tint the monster into their element's colour, keeping its shading
const vtint = (h, b = 1.05) => `sepia(0.75) saturate(2.2) hue-rotate(${h - 38}deg) brightness(${b})`;
const VARIANT_LOOK = {
  frost: vtint(200, 1.12), ember: vtint(12), venom: vtint(95), storm: vtint(55, 1.15), gale: vtint(150, 1.08),
  shadow: 'brightness(0.5) saturate(0.5) contrast(1.2) drop-shadow(0 0 3px rgba(150,80,255,0.9))',
  // (retuned 2026-11-19 so each kind still reads on the rank palettes: Radiant pale gold-white, Stone cool grey, Ancient bronze, Little pastel)
  radiant: 'grayscale(0.6) sepia(0.6) saturate(1.4) brightness(1.45) drop-shadow(0 0 3px rgba(255,240,170,0.95))',
  stone: 'grayscale(1) contrast(1.25) brightness(0.92)',
  ancient: 'sepia(1) saturate(1.6) hue-rotate(-12deg) brightness(0.82) contrast(1.2)',
  little: 'saturate(0.7) brightness(1.3) contrast(0.9)',
  crystal: 'saturate(0.35) brightness(1.35) hue-rotate(180deg) drop-shadow(0 0 2px rgba(180,240,255,0.95))',
};
const VARIANT_SCALE = { giant: 1.35, little: 0.75 };
const variantFilter = sp => { const S = typeof sp === 'string' && SPECIES[sp]; return !S || !S.variant ? null : S.variant === 'elite' ? MORECARDS.eliteRim : S.variant === 'giant' ? giantFilter(sp) : VARIANT_LOOK[S.variant] || null; };
// TINTED SHEETS (2026-11-19): a canvas filter on every draw is slow (the glows most of all, and on a phone), and a variant may be on
// screen many times over, or 56 times in the Monster Book. So each variant's frames are coloured once, each in its own padded cell
// (the gold rim and the glows can't bleed into a neighbour's frame), into one sheet per palette; the variant's bank is then a copy of
// its monster's with those sheets (registered in IMGS under 'tint:<id>:<pal>') and the frames moved to their new cells.
const TINT = { pad: 6, banks: {} };
function tintedBank(sp) {
  if (TINT.banks[sp]) return TINT.banks[sp];
  const f = variantFilter(sp), B = D.monsters[sp]; if (!f || !B || !B.frames) return null;
  const ims = (B.imgs || [B.img]).map(src => img(src)); if (ims.some(im => !im || !im.complete || !im.naturalWidth)) return null;   // (not loaded yet: next time)
  const P = TINT.pad, cells = [], frames = [];
  let x = 0, y = 0, rowH = 0, W = 0; const MAXW = 1024;
  B.frames.forEach((r, i) => {
    if (!r) { frames.push(r); cells.push(null); return; }
    const w = r[2] + P * 2, h = r[3] + P * 2;
    if (x + w > MAXW) { x = 0; y += rowH; rowH = 0; }
    cells.push([x, y]); frames.push([x, y, w, h, r[4] - P, r[5] - P]); x += w; rowH = Math.max(rowH, h); W = Math.max(W, x);
  });
  const H = y + rowH, keys = ims.map((im, k) => {
    const c = document.createElement('canvas'); c.width = Math.max(1, W); c.height = Math.max(1, H); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.filter = f;
    B.frames.forEach((r, i) => { if (r) g.drawImage(im, r[0], r[1], r[2], r[3], cells[i][0] + P, cells[i][1] + P, r[2], r[3]); });
    const key = `tint:${sp}:${k}`; IMGS[key] = c; return key;
  });
  return (TINT.banks[sp] = { ...B, imgs: keys, frames });
}
{
  const mp = monsterPreview;
  monsterPreview = (sp, x, y, maxW, maxH, tier = 0, now = 0, anim = 'idle', maxScale = 1.5) => {
    const S = typeof sp === 'string' && SPECIES[sp];
    if (S && S.hero != null && typeof drawPlayerPreview === 'function') {   // a hero card: the hero, standing, facing you
      const s = Math.min(maxScale * 1.6, maxH / 34, maxW / 24);
      try { ctx.save(); drawPlayerPreview(S.hero, null, null, 'idle', 2, x + maxW / 2, y + maxH / 2 + 20 * s, s, now, true); } catch (e) {} finally { ctx.restore(); }
      return;
    }
    const f = variantFilter(sp); if (!f) return mp(sp, x, y, maxW, maxH, tier, now, anim, maxScale);
    const TB = tintedBank(sp); if (TB) return mp(TB, x, y, maxW, maxH, tier, now, anim, maxScale);   // (the coloured sheet: no filter per draw)
    // (until it is ready: the filter, with the caller's own going last, so the book's dark silhouette of a monster not met yet stays dark)
    const prev = ctx.filter && ctx.filter !== 'none' ? ' ' + ctx.filter : '';
    ctx.save(); ctx.filter = f + prev; try { return mp(sp, x, y, maxW, maxH, tier, now, anim, maxScale); } finally { ctx.restore(); }
  };
  // a variant fighting for you (a deck companion or a summon): the giant is bigger
  const mm = makeMonster;
  makeMonster = (sp, ...rest) => { const m = mm(sp, ...rest); const S = SPECIES[sp], k = S && VARIANT_SCALE[S.variant]; if (m && k) { m.scale = (m.scale || 1) * k; m.h = Math.round((m.h || 28) * k); } return m; };
  // and drawn in its colours in the world
  const da = drawActor;
  drawActor = (a, now, opts) => {
    const f = a && a.kind === 'monster' && variantFilter(a.sp); if (!f) return da(a, now, opts);
    if (!a.bank) { const TB = tintedBank(a.sp); if (TB) a.bank = TB; }   // (world.js draws a.bank when set: the coloured sheet)
    if (a.bank) return da(a, now, opts);
    ctx.save(); ctx.filter = f; try { return da(a, now, opts); } finally { ctx.restore(); }
  };
}
// which card a foe drops: an elite foe its Elite card, an Alpha (a side area's giant) its Giant card
const variantCardOf = (sp, kind) => { const id = (kind === 'elite' ? 'el_' : 'gi_') + sp; return SPECIES[id] ? id : sp; };
// the Monster Book: beating an elite foe fills its Elite page as well, and beating a side area's Alpha its Giant page
{
  const ok = onMonsterKill;
  onMonsterKill = (game, w, m) => {
    const r = ok(game, w, m);
    try { if (m && !m.ally && typeof mbookKill === 'function') { if (m.elite && SPECIES['el_' + m.sp]) mbookKill(game, 'el_' + m.sp, mbookPlace(w, m.x)); if (m.alphaKey && SPECIES['gi_' + m.sp]) mbookKill(game, 'gi_' + m.sp, mbookPlace(w, m.x)); } } catch (e) {}
    return r;
  };
}
// VARIANTS IN THE WILDS: a few of a zone's spawns (MORESPAWN.chance) come as one of that zone's kinds, in its colours, with its own name
// and skill, and drop that kind's card (its m.sp is the variant's id). Not bosses or elites; the Elite and Giant come from elites/Alphas.
const MORESPAWN = { chance: 0.08, offZone: 0.2, kinds: [['gale', 'little', 'venom'], ['shadow', 'venom', 'ancient'], ['storm', 'gale', 'radiant'], ['frost', 'crystal', 'ancient'], ['ember', 'stone', 'radiant']] };
function makeVariantFoe(m, kind) {
  const vid = VARIANT[kind] && VARIANT[kind].pfx + m.sp; if (!vid || !SPECIES[vid]) return false;
  const v = makeMonster(vid, m.tier, m.x, m.y);
  for (const k of ['sp', 'plist', 'passives', 'maxHp', 'hp', 'atk', 'spd', 'spell', 'scale', 'h']) m[k] = v[k];
  return true;
}
{
  const sm = spawnMonster;
  // (a fifth of the Wilds' variants are any kind at all, so every variant can be met somewhere)
  spawnMonster = (w, zi, initial, Rforce) => {
    const m = sm(w, zi, initial, Rforce);
    try { if (m && !m.boss && !m.elite && !SPECIES[m.sp].variant && Math.random() < MORESPAWN.chance) { const K = Math.random() < MORESPAWN.offZone ? MORE_KINDS : MORESPAWN.kinds[zi] || MORESPAWN.kinds[0]; makeVariantFoe(m, K[Math.floor(Math.random() * K.length)]); } } catch (e) {}
    return m;
  };
}
// (2026-11-18) only 292 of the 676 variants could be met: a monster took only the kinds of the zones it lives in. Now a fifth of the
// Wilds' variants are any kind (above), and a summoned monster card is a variant one time in eight (any of the eleven Wilds kinds;
// Elite and Giant stay with elites and Alphas). The Monster Book files each variant where it is most often met: a zone where it
// lives that has its kind, else its monster's own zone.
const MORE_KINDS = Object.keys(VARIANT).filter(k => k !== 'elite' && k !== 'giant');
const MORESUMMON = { chance: 0.125 };
{
  const gr = gachaRoll;
  gachaRoll = (...a) => {
    const c = gr(...a);
    try { if (c && !c.fusion && SPECIES[c.sp] && !SPECIES[c.sp].variant && Math.random() < MORESUMMON.chance) { const k = MORE_KINDS[Math.floor(Math.random() * MORE_KINDS.length)], vid = VARIANT[k].pfx + c.sp; if (SPECIES[vid]) c.sp = vid; } } catch (e) {}
    return c;
  };
}
// THE MONSTER BOOK AND VARIANTS (2026-11-19): variants are NOT in MBOOK_ZONE, which also feeds the zone-complete prize, the weekly hunts
// and the Monster of the Day (a hunt for five Frost moles would be cruel). They have their own home (MBOOK_VZONE), their own VARIANTS
// tab, stay out of OFF ROAD, and their page says where they turn up.
const MBOOK_VZONE = {}, MBOOK_VNATIVE = {};
if (typeof MBOOK_ZONE !== 'undefined') {
  const lives = {}; ZONES.forEach((Z, z) => [...(Z.mobs || []), ...(Z.mobs2 || [])].forEach(sp => { (lives[sp] = lives[sp] || []).push(z); }));
  for (const vid of VARIANT_IDS) {
    const S = SPECIES[vid], home = (lives[S.base] || []).find(z => (MORESPAWN.kinds[z] || []).includes(S.variant));
    const z = home != null ? home : MBOOK_ZONE[S.base]; if (z != null) MBOOK_VZONE[vid] = z; MBOOK_VNATIVE[vid] = home != null;
    delete MBOOK_ZONE[vid];
  }
  const off = MBOOK_FILTERS.find(F => F.name === 'OFF ROAD'); if (off) { const ok = off.ok; off.ok = (sp, ...r) => !(SPECIES[sp] && SPECIES[sp].variant) && ok(sp, ...r); }
  const at = MBOOK_FILTERS.findIndex(F => F.name === 'MISSING');
  MBOOK_FILTERS.splice(at < 0 ? MBOOK_FILTERS.length : at, 0, { name: 'VARIANTS', ok: sp => !!(SPECIES[sp] && SPECIES[sp].variant) });
  const mw = mbookWhere;
  mbookWhere = (sp, px, pw, y, at2) => {
    const S = SPECIES[sp]; if (!S || !S.variant) return mw(sp, px, pw, y, at2);
    const z = MBOOK_VZONE[sp], zn = z != null ? ZONES[z].name : 'the Wilds';
    const where = S.variant === 'elite' ? `Elite foes · ${zn}` : S.variant === 'giant' ? `The Alpha of the Heights or Depths · ${zn}` : MBOOK_VNATIVE[sp] ? `Mostly ${zn} · now and then anywhere · summons` : `Now and then in ${zn} · summons`;
    text('Turns up', px + 12, y, '#9a917c', 7, 'left');
    text(where, px + pw / 2, y + 12, '#9fe8a8', 7, 'center');
    if (at2) { text('First beaten at', px + 12, y + 30, '#9a917c', 7, 'left'); text(at2, px + pw / 2, y + 42, '#e8e2cf', 6, 'center'); }
  };
}
