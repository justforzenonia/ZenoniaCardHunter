'use strict';
// THE SUNSCORCH DESERT: a fifth zone of the Wilds (zone 4), between the Frozen Abyss and the Sun Temple, made from the
// decoded desert maps' own sand (tiles_3). Its areas are generated like the others' (worldgen.js ZONE_THEMES[4]), on a random
// stream of their own, and the Sun Temple is its last stage. It is the road to the temple in Chapter IV: the Frozen Abyss's
// Guardian seals the way into it, and it has no Guardian or seal of its own (Frostmere lies just past the temple). Here the
// per-zone tables get their fifth entry.
const DESERT = { zone: 4 };
{
  const z = DESERT.zone, put = (A, v) => { if (Array.isArray(A) && A[z] === undefined) A[z] = v; };
  put(CHAPTER, 'IV');
  put(ZONE_TAG, 'Sun-baked sands, and the golden temple shimmering at their edge.');
  put(GUARDIAN_LV, 52);
  put(GUARDIAN_LV_OLD, 1e9);   // (never counted cleared by level: it has no Guardian)
  put(ZONE_FIELD, 'the Sands');
  put(ZONE_COLS, '#ffc860');
  put(GUARDIAN_KITS, 'molten');
  put(LANDMARKS, [   // set pieces from the game's own desert and temple objects (items: [bank, frame, x, foot y] in tiles)
    { name: 'The Buried Shrine', w: 16, h: 11, n: 2, items: [[247, 4, 3, 5], [247, 5, 8, 4], [247, 4, 13, 5], [256, 2, 5, 9], [256, 2, 11, 9], [247, 3, 8, 10], [247, 2, 2, 10], [247, 6, 14, 10]] },
    { name: "Caravan's End", w: 16, h: 10, n: 2, items: [[248, 0, 3, 5], [322, 0, 7, 6], [322, 0, 8.2, 6.6], [245, 0, 11, 6], [247, 3, 5, 9], [29, 0, 9, 9], [29, 1, 12, 9.5], [245, 1, 14, 4]] },
    { name: 'The Twin Buttes', w: 16, h: 10, n: 1, items: [[245, 2, 4, 6], [245, 3, 12, 6], [245, 1, 8, 4], [245, 0, 8, 9], [248, 0, 14.5, 9.5], [246, 0, 1.5, 9]] },
    { name: 'The Fallen Colonnade', w: 18, h: 10, n: 2, items: [[255, 2, 3, 4.5], [255, 1, 7, 4.5], [255, 2, 11, 4.5], [255, 1, 15, 4.5], [255, 1, 3, 9.5], [255, 2, 7, 9.5], [247, 3, 11, 9.5], [255, 2, 15, 9.5], [256, 3, 9, 7.2]] },
  ]);
  put(HOLE_WORDS, ['SCORCHED', 'SUNKEN', 'BURNING']);
  put(DEBRIS_KIND, ['#c8a060', '#8a6a30', 2, 2]);
  put(HOLE_DREAD, HOLE_DREAD[3]);
  put(HOLE_PLATE_ART, HOLE_PLATE_ART[3]);
  put(HOLE_SCAR_ART, HOLE_SCAR_ART[3]);
  put(ANIMALS.zones, ['llama']);
  put(BGM.zones, 'ember');                                       // (the warm track)
  put(NODES.art, { herb: [28, 2], ore: [30, 1] });              // (a desert shrub, a rock spire: the desert maps' own objects)
  put(RC.names, ['Sand Hollow', 'Dune Cave', 'Scorpion Den', 'Sun Grotto', 'Buried Vault']);
  put(SITES.pieces, [{ name: 'Oasis Camp', w: 10, h: 6, items: [[28, 1, 2, 3], [28, 1, 8, 3], [28, 2, 5, 5], [28, 0, 3, 5.5]] },
                     { name: 'Bone Pit', w: 10, h: 6, items: [[29, 0, 3, 4], [29, 1, 7, 4], [30, 1, 5, 2], [28, 0, 8, 5.5]] }]);
  put(GLOOM.col, 'rgba(120,90,40,A)'); put(GLOOM.str, 0.36);
  put(SETS.bonus, { name: 'Sands Set', atk: 0.06, text: '+6% ATK' });
}
// the desert's palms and cacti (028), bones (029) and rock spires (030) make way for a set piece, as trees and rocks do elsewhere
for (const b of ['028', '029', '030']) LM_CLEAR.add(b);
// no Guardian, no seal: the desert is open road
{
  const ij = initJourney;
  initJourney = (game, w) => { ij(game, w); if (w.guardians) w.guardians = w.guardians.filter(G => G.zi !== DESERT.zone); };
}

// SANDSTORMS: now and then (about 50 s in every 4 minutes, on the clock, so co-op friends share it) a soft sandstorm drifts
// through the desert: warm haze, long streaks of blowing sand and a few drifting puffs, fading in and out over 6 s. Only a
// look; it never hurts or slows anyone (a calm game before bed).
const SANDSTORM = { every: 240000, dur: 50000, fade: 6000, streaks: 46, puffs: 7 };
function sandstormK(now = Date.now()) {
  const t = now % SANDSTORM.every; if (t > SANDSTORM.dur) return 0;
  return Math.min(1, t / SANDSTORM.fade, (SANDSTORM.dur - t) / SANDSTORM.fade);
}
{
  const dw = drawWeather;
  drawWeather = (w, now) => {
    dw(w, now);
    const R = w && w.overworld && !w.interior && REGIONS[w.region]; if (!R || R.zone !== DESERT.zone) { if (w) w.stormSaid = false; return; }
    const k = sandstormK(); if (k <= 0) { w.stormSaid = false; return; }
    if (!w.stormSaid && k > 0.2 && window.GAME) { w.stormSaid = true; GAME.toast('A soft sandstorm drifts across the dunes', '#f0d090'); }
    ctx.save();
    ctx.fillStyle = `rgba(214,160,80,${0.26 * k})`; ctx.fillRect(0, 0, VW, VH);   // (the warm haze)
    for (let i = 0; i < SANDSTORM.streaks; i++) {   // long streaks of sand, blown along low and fast
      const r = (i * 9301 + 49297) % 233280 / 233280, r2 = (i * 4271 + 1031) % 1000 / 1000, q = (now / (1400 + r * 900) + r) % 1;
      const x = VW + 40 - q * (VW + 120), y = (r2 * VH + Math.sin(now / 600 + i) * 4) % VH, L = 16 + r * 26;
      ctx.globalAlpha = 0.7 * k * Math.sin(q * Math.PI); ctx.fillStyle = i % 3 ? '#fff0c8' : '#c89850'; ctx.fillRect(x, y, L, i % 4 ? 1 : 2);
    }
    for (let i = 0; i < SANDSTORM.puffs; i++) {   // and a few soft puffs rolling by
      const r = (i * 7907 + 1013) % 1000 / 1000, q = (now / (6000 + r * 3000) + r) % 1, x = VW + 60 - q * (VW + 160), y = VH * (0.15 + 0.7 * ((i * 0.37) % 1)), rr = 26 + r * 22;
      const gg = ctx.createRadialGradient(x, y, 2, x, y, rr); gg.addColorStop(0, `rgba(200,150,80,${0.3 * k})`); gg.addColorStop(1, 'rgba(200,150,80,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  };
}

// MIRAGES: each desert area has a spot or two out on the open sand (chosen by the world seed) where a shimmering palm and a
// pale pool hang in the heat. Seen from a distance they waver into view; walk toward one and it fades away before you reach it.
// Only a look: nothing is there.
const MIRAGE = { per: 2, near: 150, far: 420 };
function mirageSpots() {
  if (DESERT.mirages) return DESERT.mirages;
  const out = [], r = seededRng((WORLD_SEED ^ 0x31a6e) >>> 0);
  for (const R of REGIONS) {
    if (R.zone !== DESERT.zone || R.map === 'z3m') continue;
    const M = regMap(R);
    for (let k = 0, t = 0; k < MIRAGE.per && t < 60; t++) {
      const x = 4 + Math.floor(r() * (M.w - 8)), y = 4 + Math.floor(r() * (M.h - 8)); let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -3; dx <= 3; dx++) { const i = (y + dy) * M.w + x + dx; if (M.solid[i] || !M.reach[i]) { ok = false; break; } }
      if (ok) { out.push({ x: (R.ox + x) * T + 8, y: (R.oy + y) * T + 8 }); k++; }
    }
  }
  return (DESERT.mirages = out);
}
{
  const dw = drawWeather;
  drawWeather = (w, now) => {
    const R = w && w.overworld && !w.interior && REGIONS[w.region], cam = w && w.cam, p = w && w.player;
    const day = 1 - (typeof nightNow === 'function' ? nightNow() : 0);   // (mirages need the day's heat: they fade through dusk and are gone at night)
    if (R && R.zone === DESERT.zone && cam && p && day > 0.02) {
      const palm = typeof makeMapObject === 'function' ? (DESERT.palm = DESERT.palm || makeMapObject([28, 1, 0, 0])) : null;
      ctx.save(); ctx.scale(ZOOM, ZOOM); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
      for (const m of mirageSpots()) {
        const d = Math.hypot(m.x - p.x, m.y - p.y); if (d > MIRAGE.far + 80 || d < MIRAGE.near * 0.6) continue;
        const k = Math.max(0, Math.min(1, (d - MIRAGE.near) / 120, (MIRAGE.far - d) / 120)); if (k <= 0) continue;
        const wav = Math.sin(now / 260 + m.x) * 1.2, a = day * k * (0.45 + 0.15 * Math.sin(now / 700 + m.y));
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#bfe4ff';   // the pool: pale, flat, wavering
        for (let i = 0; i < 4; i++) ctx.fillRect(m.x - 22 + Math.sin(now / 300 + i) * 2, m.y + 2 + i * 2, 44 - i * 6, 1.5);
        if (palm) { ctx.globalAlpha = a; palm.x = m.x - 14 + wav; palm.y = m.y; palm.bottom = m.y; drawObj(palm, 0); palm.x = m.x + 12 - wav; drawObj(palm, 0); }
      }
      ctx.restore();
    }
    dw(w, now);
  };
}

// MIRAGE SPRINGS (outpost town 4, halfway along the desert: worldgen.js builds it): its townsfolk, frame colours, errands and
// shop floor. Stage 1 of the town: the place itself, people and shops.
{
  const i = 4, put = (A, v) => { if (Array.isArray(A) && A[i] === undefined) A[i] = v; };
  put(TOWN_FRAME, { top: '#fff0c0', bot: '#d8a040', fill: '#22180c' });
  put(TL_FOLK, [
    { npc: '102', name: 'Water-Keeper Amira', x: 13, y: 21, line: 'Every drop in that pond is counted twice: once when it rises, once when it is shared.' },
    { npc: '115', name: 'Little Zaid', x: 29, y: 22, line: 'I saw a lake out on the dunes! Then I ran to it and it was just sand. Again.' },
    { npc: '109', name: 'Weaver Lune', x: 45, y: 21, line: 'Palm thread, sun-dyed. It will keep the sand off your neck and the wind off your thoughts.' },
    { npc: '106', name: 'Old Caravaneer Bastu', x: 57, y: 21, line: 'I crossed these sands forty times. The forty-first, I decided to stay by the water.' } ]);
  put(TL_JOBS, ['a skin of cool water', 'a bundle of dates']);
  put(TL_SPOT, [{ tl: 'fish', npc: '106', name: 'Oasis Angler', x: 40, y: 21.4 }, { tl: 'crier', npc: '105', name: 'Town Crier', x: 26, y: 21.2 }]);
  if (typeof FOLK !== 'undefined' && FOLK.outposts) put(FOLK.outposts, [   // the townsfolk about the place (a few come out each day)
    ['101', 'Date-Picker Noor', 19, 18, 'Climb the palm at dawn, before the trunk gets hot. Learned that one the hard way.'],
    ['103', 'Sand-Sweeper Kofi', 28, 24, 'I sweep the square every morning. The desert puts it back every night. We are old friends.'],
    ['110', 'Star-Reader Ysa', 48, 18, 'Out here the stars are so close you can hear them. Mostly they say: drink more water.'],
    ['118', 'Potter Haim', 52, 19, 'A good jar keeps water cool all day. A bad jar keeps it for about a minute.'],
    ['113', 'Caravan Guard Rhee', 60, 18, 'The mirages are harmless. It is the thing standing behind the mirage you watch for.'],
    ['117', 'Singer Esme', 23, 18, 'The wells sing at night if you listen. Low, like someone humming in another room.'],
  ]);
  put(TOWN_FLOOR, 6);
}

// THE SINGING WELL: Mirage Springs' side quest (sidequests.js format). Water-Keeper Amira hears the town pond singing at night,
// and the song leads out to the Buried Shrine, where something has been drinking the oases dry.
if (typeof SIDE_QUESTS !== 'undefined' && !SIDE_QUESTS.some(q => q.id === 'singing')) SIDE_QUESTS.push(
  { id: 'singing', name: 'The Singing Well', lv: 52, zone: 4, town: 4, giver: 'Water-Keeper Amira', steps: [
    { type: 'talk', who: 'Water-Keeper Amira', say: ['The pond sings at night. Low, like someone humming in another room. Every night it is a little quieter.', 'And every morning the water is a finger lower. Something out on the sands is drinking our springs dry.'], hint: 'Talk to Water-Keeper Amira in Mirage Springs' },
    { type: 'visit', lm: 'The Buried Shrine', say: ['The humming is loud here, coming up through the sand under the broken pillars.', 'Fresh tracks lead away from the shrine, wet ones, toward the oases.'], hint: 'Find the Buried Shrine in the Sunscorch Desert' },
    { type: 'hunt', zone: 4, n: 25, say: 'The creatures round the oases are drunk on stolen water and angry with it. Drive them off.', hint: 'Clear the Sunscorch Desert round its oases' },
    { type: 'boss', lm: 'The Buried Shrine', label: 'The Thirsting Sand', kit: 'molten', hint: 'Return to the Buried Shrine', say: 'The sand heaves. Something that was once a spring rises, all thirst and no water.' },
    { type: 'talk', who: 'Water-Keeper Amira', say: ['Listen. It is singing again, and the water is rising.', 'Take this: the first cup drawn from the deep spring. It never empties, they say. I have never dared to try.'], hint: 'Tell Water-Keeper Amira' },
  ], reward(game) { const pr = game.profile; pr.gold = (pr.gold || 0) + 30000; pr.coins = (pr.coins || 0) + 15; return '30,000 gold and 15 coins'; } });

// FRIEND OF THE FIVE TOWNS: with Mirage Springs there are five towns now. The old title (Renown 5 in the first four) stays as
// it was, so saves keep it; this one asks for all five and is a tier higher.
{
  const t = { id: 'fivetowns', name: 'Friend of the Five Towns', tier: 5, how: 'Reach Renown 5 in all five towns', prog: pr => [OUTPOST_TOWNS.map((_, i) => i).filter(i => tlLevel(pr, i) >= 5).length, OUTPOST_TOWNS.length] };
  TITLE_LIST.push(t); TITLE_BY.fivetowns = t; TITLE_PASSIVES.fivetowns = ['regen', 'hide', 'barrier', 'brutal', 'swift', 'mana'];
}
// NOMAD TENTS: the desert's camps (worldgen.js TH.tents) are the Verdant Fields' tent (bank 005) dyed sand cloth, drawn from a
// copy made once. The tent folk (tentfolk.js) live in them like any camp; out here the camp is called a Nomad Tent.
const NOMAD_TENT = { dye: 'sepia(0.75) saturate(1.5) hue-rotate(-8deg) brightness(1.02)', name: 'Nomad Tent' };
function nomadTentImg(rec) {
  const k = rec.join(','); NOMAD_TENT.cache = NOMAD_TENT.cache || {}; if (NOMAD_TENT.cache[k]) return NOMAD_TENT.cache[k];
  const im = img(D.objects.img); if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = rec[2]; c.height = rec[3]; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.filter = NOMAD_TENT.dye; g.drawImage(im, rec[0], rec[1], rec[2], rec[3], 0, 0, rec[2], rec[3]);
  return (NOMAD_TENT.cache[k] = c);
}
{
  const dob = drawObj;
  drawObj = (o, now) => {
    if (o.bank === '005' && !o.draw) {
      if (o.nomad == null) { const R = typeof regionAt === 'function' && window.GAME && GAME.world && GAME.world.overworld ? regionAt(o.x) : null; o.nomad = !!(R && R.zone === DESERT.zone); }
      if (o.nomad) {
        const rec = objRec(o.bank, o.fi, now), c = rec && nomadTentImg(rec);
        if (c) { const see = behindObj(o, rec); if (see) { ctx.save(); ctx.globalAlpha = SEE_THROUGH.alpha; } ctx.drawImage(c, Math.round(o.x + rec[4]), Math.round(o.y + rec[5])); if (see) ctx.restore(); return; }
      }
    }
    return dob(o, now);
  };
  const zd = zoneDoors;
  zoneDoors = w => {   // (the camps added later, Twilight Grove's and the desert's, are counted after every other camp, so the older camps' folk keep their names)
    if (w._zoneDoors) return w._zoneDoors;
    const LATE = new Set([1, 2, DESERT.zone]), all = w.objects, isNomad = o => o.bank === '005' && o.fi === 0 && (() => { const R = regionAt(o.x); return !!(R && LATE.has(R.zone)); })();
    const nomads = all.filter(isNomad); w.objects = all.filter(o => !nomads.includes(o));
    let out; try { out = zd(w); } finally { w.objects = all; }
    const looks = TENT_LOOKS.filter(n => D.npcs[n]); let n = out.filter(d => d.camp).length;
    for (const o of nomads) {
      const r = objRec(o.bank, o.fi), who = `${TENT_TRADES[n % TENT_TRADES.length]} ${TENT_NAMES[n % TENT_NAMES.length]}`, R = regionAt(o.x), camp = R && R.zone === DESERT.zone ? NOMAD_TENT.name : 'Tent';
      out.push({ o, x: o.x + r[4] + r[2] / 2, y: o.bottom, key: tentKey(o), camp, who, npc: looks[n % looks.length], label: `${who}'s ${camp}` }); n++;
    }
    return (w._zoneDoors = out);
  };
}