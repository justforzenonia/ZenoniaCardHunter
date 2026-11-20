'use strict';
// The journey: the Wilds run west from Castle Town through four zones, each a chain of named areas.
// Monsters grow stronger the further an area lies from town. At the far end of every zone a Guardian boss stands
// before a magical seal on the bridge into the next zone; defeating it breaks the seal for good. The Frozen Abyss
// ends in the Ruined Citadel, where the final Guardian waits at the very end of the world.

const AREAS = {
  z0: 'Meadow Road', z0b: 'Old Orchard', z0c: 'Stream Hollow', z0d: "Hunter's Clearing", z0e: 'Wild Edge',
  z1: 'Greenwood Rise', z1b: 'Lantern Thicket', z1c: 'Fallen Shrine', z1d: 'Sunscorched Dunes', z1e: 'Dune Sea',
  z2: 'Cloud Road', z2b: 'Windmill Rise', z2c: 'Sky Steps', z2d: 'Rainbow Gorge', z2e: 'Mist Pass', z2f: 'Shadow Caverns', z2g: 'Hollow Deep',
  z3: 'Frost Gate', z3b: 'Glacier Path', z3c: 'Rime Woods', z3d: 'Ice Halls', z3e: 'Frozen Lake', z3f: 'Whiteout Pass',
  z3g: 'Crystal Grotto', z3h: 'Ruined Citadel', z3i: 'Throne of Winter',
  // lands from Zenonia 2
  z0f: 'Riverbend Glade', z0g: 'Waterfall Terraces', z0h: 'Old Forest Crossing',
  z1f: 'Sandstone Ruins', z1g: 'Bone Canyon',
  z2h: 'Lava Fields', z2i: 'Magma Lake', z2j: 'The Steam Works',
  z3j: 'Crystal Caves', z3k: 'Prism Hollow', z3l: 'Snowbell Village', z3m: 'Sun Temple',
};
const CHAPTER = ['I', 'II', 'III', 'IV'];
// an area's name: its map's name, numbered when the same land turns up again further along the road
const areaName = R => R.zone < 0 ? (R.town ? OUTPOST_TOWNS[R.town - 1].name : 'Hearthvale') : (AREAS[R.map] || AREAS[String(R.map).split('@')[0]] || (WG_MAPS[R.map] && WG_MAPS[R.map].name) || 'Wilds') + (ROMAN[(R.occ || 1) - 1] || '');
const VARIANT_INFO = Object.fromEntries(AREA_VARIANTS.map(v => [v.id, v]));
const ZONE_TAG = ['Where every hunter takes their first steps — and the first seal waits.', 'The light goes out of these woods a little more each night.', 'Islands of cloud, torn loose by whatever the seals were built to hold.', 'Ice to the horizon, and the temple where something sleeps.'];
const GUARDIAN_RESPAWN = 180000;

// areas of a zone, nearest town first (REGIONS run west → east)
const zoneAreas = zi => REGIONS.filter(r => r.zone === zi).reverse();
function areaStage(R) { const L = zoneAreas(R.zone); return { i: L.indexOf(R) + 1, n: L.length }; }
function areaLabel(R) {
  if (R.zone < 0) return R.town ? OUTPOST_TOWNS[R.town - 1].name : 'Hearthvale';
  const s = areaStage(R);
  return `${ZONES[R.zone].name} · ${areaName(R)} (${s.i}/${s.n})`;
}
// rank for a monster in an area: the zone's low ranks near town, its top ranks at the far end
function areaRank(R) {
  const Z = ZONES[R.zone], [a, b] = Z.ranks, s = areaStage(R), f = s.n > 1 ? (s.i - 1) / (s.n - 1) : 0;
  const lo = a + Math.floor(f * (b - a) * 0.7), hi = Math.min(b, lo + 1 + Math.round(f));
  let t = lo;
  while (t < hi && Math.random() < 0.4) t++;
  return t;
}

// ---------------------------------------------------------------- guardians and seals
function initJourney(game, w) {
  const pr = game.profile;
  pr.cleared = pr.cleared || {};
  // A ZONE IS CLEARED ONLY BY BEATING ITS GUARDIAN (2026-11-08). An old rule counted every zone a hero had out-levelled
  // (Lv 23+ for zone 1) as cleared, so a seal could vanish with its quest never done (the user saw it). That rule is gone, and
  // a zone marked cleared without its Guardian win (no milestone) while the story hasn't passed that chapter is sealed again.
  for (let z = 0; z < ZONES.length; z++) {
    if (!pr.cleared[z] || (pr.milestones && pr.milestones[z])) continue;
    const ci = typeof CHAPTERS !== 'undefined' ? CHAPTERS.findIndex(C => C.zone === z) : -1, S = typeof storyState === 'function' ? storyState(pr) : null;
    const storyPast = ci < 0 || !S || S.ch > ci || S.step === -2;
    if (!storyPast) delete pr.cleared[z];
  }
  w.guardians = ZONES.map((Z, zi) => {
    const L = zoneAreas(zi), last = L[L.length - 1], ri = REGIONS.indexOf(last);
    const bd = ri > 0 ? WILDS.bridges[ri - 1] : null;   // the bridge out of the zone (none for the last zone)
    let at;
    if (bd) at = { x: (bd.x1 + 3) * T, y: (bd.y + bridgeRows(bd) / 2) * T };
    else {   // the far west end of the world: the westmost reachable tile of the last area
      for (let tx = last.ox; tx < last.ox + last.w && !at; tx++)
        for (let ty = last.oy; ty < last.oy + last.h; ty++) if (WILDS.reach[ty * WILDS.w + tx]) { at = { x: (tx + 3) * T, y: ty * T + 8 }; break; }
    }
    const west = ri > 0 ? REGIONS[ri - 1] : null;   // first area of the next zone, across the river
    return { zi, bd, at, m: null, t: 0, rx0: west ? (west.ox + west.w) * T : 0, rx1: last.ox * T };
  });
  const base = w.blocked;
  w.blocked = (x, y, a) => {
    for (const G of w.guardians) {
      if (!ZONE_SEALS || !G.bd || pr.cleared[G.zi]) continue;
      if (x > G.rx0 - 4 && x < G.rx1 + 4 && y > G.bd.y * T - 20 && y < (G.bd.y + bridgeRows(G.bd)) * T + 20) return true;   // the seal across the bridge
    }
    return base(x, y, a);
  };
}
// THE SEALS (the week-long journey): each zone's bridge out stays sealed until its Guardian falls, and a Guardian is
// warded, taking no harm, until you reach its level. Each zone is a chapter, with the next town beyond the seal.
const ZONE_SEALS = true;
const GUARDIAN_LV = [12, 24, 36, 48];   // (were 15/30/45/60: Lv 12 -> 30 alone was ~68,000 EXP, ~1,300 kills; level by itself moves a Guardian fight only a few per cent)
const GUARDIAN_LV_OLD = [15, 30, 45, 60];   // (the levels older saves were made under: only for the outgrown-zone rule below)
function spawnGuardian(w, G) {
  const Z = ZONES[G.zi], mobs = Z.mobs.filter(id => D.monsters[id]);
  const sp = mobs.slice().sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0];   // the zone's toughest species
  const at = findOpen(w, G.at.x, G.at.y);
  const T = trialTier(window.GAME && GAME.profile);   // after the ending, every Guardian is a Trial boss (trials.js)
  const m = makeMonster(sp, T ? 9 : Math.min(9, Z.ranks[1] + 1), at.x, at.y);
  Object.assign(m, { boss: true, guardian: G.zi, scale: 1.8, heavy: true, region: G.zi });
  m.maxHp = m.hp = Math.round(m.maxHp * 8); m.atk *= 1.6;
  m.home = { x: at.x, y: at.y }; m.dir = 1;
  giveKit(m, GUARDIAN_KITS[G.zi]);   // its own way of fighting (bosses.js)
  if (T) trialStats(m, T);
  w.actors.push(m); G.m = m;
}
function updateJourney(game, w, dt) {
  if (!w.guardians) return;
  for (const G of w.guardians) {
    if (!G.at) continue;
    if (G.m && !G.m.dead && inTown(G.m.x)) { G.m.x = G.m.home.x; G.m.y = G.m.home.y; G.m.hazards = []; }   // a Guardian never stays in a town
    if (G.m && !G.m.dead) { const low = (game.profile.lv || 1) < GUARDIAN_LV[G.zi]; G.m.ward = low || !storyKeyOk(game.profile, G.zi); G.m.wardWhy = low ? `reach Lv ${GUARDIAN_LV[G.zi]}` : 'find its Seal Key'; if (G.m.wardT > 0) G.m.wardT -= dt; }   // too weak yet, or no seal key (chapters.js): no harm done to it
    if (!G.m || G.m.remove || G.m.dead) {
      if (G.m && G.m.dead && !G.t) G.t = game.profile.cleared[G.zi] ? GUARDIAN_RESPAWN : 1500;
      if (!G.m) G.t = G.t || 1;
      G.t -= dt;
      if (G.t <= 0) { G.t = 0; spawnGuardian(w, G); }
    }
  }
}
function journeyKill(game, w, m) {
  if (m.trial) { trialKill(game, w, m); return; }
  if (m.guardian == null) return;
  const pr = game.profile, zi = m.guardian, Z = ZONES[zi], first = !pr.cleared[zi];
  const mobs = Z.mobs.filter(id => D.monsters[id]), tier = Math.min(9, Z.ranks[1] + 1);
  game.pickup({ kind: 'card', item: makeCard(pick(mobs), tier) });
  game.pickup({ kind: 'relic', item: makeRelic(m.sp, tier, 'guardian') });
  if (first) {
    pr.cleared[zi] = true;
    (pr.milestones = pr.milestones || {})[zi] = { ms: pr.playMs || 0, lv: pr.lv || 1 };   // how long the chapter took (the playtime clock)
    game.pickup({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), tier, pr.cls) });
    pr.coins = (pr.coins || 0) + 3;
    game.gainExp(killExp(tier) * 15);
    const next = ZONES[zi + 1];
    game.toast(next ? `GUARDIAN DEFEATED — the seal breaks! The road to ${next.name} is open.` : 'THE FINAL GUARDIAN FALLS — you have reached the end of the world!', '#ffd23f');
    w.flash = { t: 0, dur: 700, col: '#ffe9a8' };
  } else { game.gainExp(killExp(tier) * 5); game.toast(`Guardian of ${Z.name} defeated again`, '#ffe9a8'); }
  game.save();
}
// THE PLAYTIME CLOCK: time spent in the game (in the world or its menus, not the title screen), kept on the profile;
// each Guardian's first fall records the clock and your level (pr.milestones), shown on the journey map (M)
function playTick(game, dt) {
  const pr = game.profile; if (!pr || game.scene === 'title' || game.scene === 'hub') return;
  pr.playMs = (pr.playMs || 0) + dt;
  // TODAY'S PLAY TIME (2026-11-07, the user asked to see it): resets on a new day (daily.js dayNo), shown in the pause menu and on the Journey map
  const d = typeof dayNo === 'function' ? dayNo() : 0; if (!pr.playToday || pr.playToday.day !== d) { if (pr.playToday && pr.playToday.ms > 60000) pr.playPrev = { day: pr.playToday.day, ms: pr.playToday.ms }; pr.playToday = { day: d, ms: 0 }; }   // (the last day you played is kept for the welcome-back card)
  pr.playToday.ms += dt;
  const P = pr.playDays || (pr.playDays = {}); P[d] = Math.max(P[d] || 0, pr.playToday.ms);   // (per day, for THIS WEEK)
  if (P._pruned !== d) { P._pruned = d; for (const k in P) if (k !== '_pruned' && +k < d - 13) delete P[k]; if (pr.playPrev && !P[pr.playPrev.day]) P[pr.playPrev.day] = pr.playPrev.ms; }
}
// the last day played before today (its play time), for the welcome-back card; works before or after the day rolls over
const lastVisitMs = pr => { const d = typeof dayNo === 'function' ? dayNo() : 0, T = pr && pr.playToday; return T && T.day !== d && T.ms > 60000 ? T.ms : pr && pr.playPrev && pr.playPrev.day !== d ? pr.playPrev.ms : 0; };
const playTodayMs = pr => (pr && pr.playToday && typeof dayNo === 'function' && pr.playToday.day === dayNo() ? pr.playToday.ms : 0);
const fmtShort = ms => { const m = Math.floor(ms / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
// THIS WEEK (2026-11-08): minutes played on each of the last 7 days, as a little cozy bar chart in the pause menu. pr.playDays
// keeps { day: ms } for the last two weeks (playTick); today's bar glows gold.
function drawWeekStrip(pr, x, y) {
  if (!pr) return;
  const d = typeof dayNo === 'function' ? dayNo() : 0, P = pr.playDays || {}, W = 150, H = 92, days = [];
  for (let i = 6; i >= 0; i--) days.push({ day: d - i, ms: P[d - i] || (i === 0 ? playTodayMs(pr) : 0) });
  const top = Math.max(30 * 60000, ...days.map(q => q.ms)), total = days.reduce((s, q) => s + q.ms, 0);
  ctx.fillStyle = 'rgba(30,20,13,0.9)'; rrect(ctx, x, y, W, H, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(232,190,100,0.7)'; ctx.lineWidth = 0.8; rrect(ctx, x + 0.4, y + 0.4, W - 0.8, H - 0.8, 6); ctx.stroke();
  text('THIS WEEK', x + 8, y + 9, '#ffd23f', 7, 'left'); text(fmtShort(total), x + W - 8, y + 9, '#e8d8b8', 7, 'right');
  const bx = x + 10, bw = 14, gap = (W - 20 - 7 * bw) / 6, by = y + H - 16, bh = H - 36;
  days.forEach((q, i) => {
    const X = bx + i * (bw + gap), h = Math.round(bh * Math.min(1, q.ms / top)), today = i === 6;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, X, by - bh, bw, bh, 3); ctx.fill();
    if (h > 0) { ctx.fillStyle = today ? '#ffd23f' : '#c9864a'; rrect(ctx, X, by - h, bw, h, 3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(X + 2, by - h + 1, bw - 4, 1); }
    const wd = 'SMTWTFS'[new Date(q.day * 864e5).getUTCDay()];
    text(wd, X + bw / 2, by + 7, today ? '#ffe9a8' : '#a8987c', 7);
  });
}
const fmtPlay = ms => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
// ---------------------------------------------------------------- the story written on the land
// THE SEAL STONES: a pair of the game's own rune-carved pillars (object bank 212) flanks each zone's last bridge, one
// on each side of the road. While the seal holds their gold runes are recoloured violet and pulse; once the Guardian
// falls the runes are dead stone, the top is sheared off and lies at the pillar's foot, a wisp of smoke still rising.
const SEAL_ART = {};
// cut the pillar from the object sheet and split its rune pixels from its stone (kept once per frame)
function sealArt(fi) {
  if (SEAL_ART[fi]) return SEAL_ART[fi];
  const r = objRec('212', fi), im = img(D.objects.img); if (!r || !im || !im.complete || !im.naturalWidth) return null;
  const [sx, sy, W, H] = r, sheet = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const stone = sheet(), rune = sheet(), g = stone.getContext('2d', { willReadFrequently: true }), g2 = rune.getContext('2d');
  g.drawImage(im, sx, sy, W, H, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H), e = g2.createImageData(W, H);
  for (let i = 0; i < d.data.length; i += 4) {
    const R = d.data[i], G = d.data[i + 1], B = d.data[i + 2]; if (!d.data[i + 3] || !(R > 240 && G > 190 && B < 160) || i / 4 / W < 9) continue;   // the gold of the runes (below the cap's own highlight)
    const lum = R / 255; e.data[i] = 150 + 90 * lum; e.data[i + 1] = 90 + 110 * lum; e.data[i + 2] = 255; e.data[i + 3] = 255;
    d.data[i] = 66; d.data[i + 1] = 48; d.data[i + 2] = 40;   // the carving itself, cut into the stone
  }
  g.putImageData(d, 0, 0); g2.putImageData(e, 0, 0);
  return (SEAL_ART[fi] = { stone, rune, W, H });
}
function drawSealStones(w, now, pr) {
  const cam = w.cam || { x: 0, y: 0 };
  for (const G of w.guardians) {
    if (!G.bd || G.rx1 < cam.x - 80 || G.rx1 > cam.x + VW / ZOOM + 80) continue;
    const broken = pr && pr.cleared && pr.cleared[G.zi], x = Math.round(G.rx1 + 18), pulse = 0.5 + 0.5 * Math.sin(now / 500 + G.zi);
    [G.bd.y * T - 10, (G.bd.y + bridgeRows(G.bd)) * T + 22].forEach((y, i) => drawSealStone(x, Math.round(y), i, broken, pulse, now + G.zi * 780));
  }
}
function drawSealStone(x, y, fi, broken, pulse, now) {
  const A = sealArt(fi); if (!A) return;
  const { stone, rune, W, H } = A, left = x - Math.floor(W / 2), top = y - H, CUT = 24;   // CUT: rows lost when it is sheared off
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(10,8,24,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (broken) {
    ctx.drawImage(stone, 0, CUT, W, H - CUT, left, top + CUT, W, H - CUT);
    ctx.save(); ctx.translate(x + 24, y - 6); ctx.rotate(Math.PI / 2 - 0.12); ctx.drawImage(stone, 0, 0, W, CUT, -W / 2, -CUT / 2, W, CUT); ctx.restore();   // the top, fallen
    const q = (now / 2600) % 1, sz = 2 + Math.floor(q * 3); ctx.globalAlpha = Math.sin(q * Math.PI) * 0.4; ctx.fillStyle = '#8a8a96';
    ctx.fillRect(Math.round(x + Math.sin(q * 6) * 2), Math.round(top + CUT - 4 - q * 18), sz, sz);
  } else {
    ctx.drawImage(stone, left, top);
    ctx.globalAlpha = 0.65 + 0.35 * pulse; ctx.shadowColor = '#b070ff'; ctx.shadowBlur = (2 + 3 * pulse) * RES; ctx.drawImage(rune, left, top);
  }
  ctx.restore();
}
// THE TEMPLE BEACON: a column of light rising from the Sun Temple at the end of the world, seen from anywhere in
// the Frozen Abyss — angry and red while the Sun Sovereign lives (brighter with every seal you break), a calm gold
// once the story is won.
function drawTempleBeacon(w, now, pr) {
  const R = REGIONS.find(r => r.map === 'z3m'); if (!R) return;
  const cam = w.cam || { x: 0, y: 0 }, x = (R.ox + R.w / 2) * T, top = cam.y - 40, bottom = (R.oy + R.h / 2) * T;
  if (Math.abs(x - (cam.x + VW / ZOOM / 2)) > 2600) return;
  const won = pr && pr.story && pr.story.won, broken = pr && pr.cleared ? Object.keys(pr.cleared).filter(k => pr.cleared[k]).length : 0;
  const pulse = 0.65 + 0.35 * Math.sin(now / (won ? 1400 : 380)), a = (won ? 0.4 : 0.35 + broken * 0.1) * pulse, wd = won ? 14 : 12 + broken * 3;
  const col = won ? '255,220,140' : '255,70,40';
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x - wd * 2, 0, x + wd * 2, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - wd * 2, top, wd * 4, bottom - top);
  ctx.fillStyle = `rgba(255,240,220,${Math.min(1, a * 1.6)})`; ctx.fillRect(x - 1.5, top, 3, bottom - top);   // its white-hot core
  const fl = ctx.createRadialGradient(x, bottom, 2, x, bottom, wd * 5); fl.addColorStop(0, `rgba(${col},${a * 1.4})`); fl.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = fl; ctx.beginPath(); ctx.ellipse(x, bottom, wd * 5, wd * 2, 0, 0, Math.PI * 2); ctx.fill();   // the flare where it rises from the ground
  ctx.restore();
}
// the seals: a shimmering wall of runes across the bridge until the zone's guardian falls
function drawJourney(w, now) {
  drawBossFx(w, now);   // the bosses' hazards, on the ground (bosses.js)
  if (!w.guardians) return;
  const pr = window.GAME && GAME.profile;
  drawSealStones(w, now, pr); (w.lateDraw = w.lateDraw || []).push(() => drawTempleBeacon(w, now, pr));   // the beacon shines over everything   // the story's landmarks (below)
  for (const G of w.guardians) {
    if (!ZONE_SEALS || !G.bd || !pr || (pr.cleared && pr.cleared[G.zi])) continue;
    const x = (G.rx0 + G.rx1) / 2, y0 = G.bd.y * T - 18, h = bridgeRows(G.bd) * T + 36;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(0, 'rgba(160,90,255,0)'); g.addColorStop(0.5, `rgba(200,150,255,${0.55 + 0.15 * Math.sin(now / 300)})`); g.addColorStop(1, 'rgba(160,90,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 10, y0, 20, h);
    for (let i = 0; i < 6; i++) {   // runes drifting up the wall
      const k = (now / 2200 + i / 6) % 1;
      ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x - 2 + (i % 2) * 3), Math.round(y0 + h - k * h), 2, 3);
    }
    ctx.restore();
    text('SEALED', x, y0 - 10, '#d8b8ff', 7);
    text(`defeat the Guardian · Lv ${GUARDIAN_LV[G.zi]}`, x, y0 - 2, 'rgba(216,184,255,0.8)', 5.5);
  }
  for (const G of w.guardians) {   // a warded Guardian says what it waits for
    const m = G.m; if (!m || m.dead || !m.ward) continue;
    const y = m.y - (m.h || 26) * (m.scale || 1) - 22;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(200,150,255,${0.45 + 0.2 * Math.sin(now / 250)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(m.x, m.y - 20, 30, 40, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const C = CHAPTERS.find(C => C.zone === G.zi), pr = GAME.profile, lvOk = (pr.lv || 1) >= GUARDIAN_LV[G.zi];
    text(lvOk && C ? `WARDED · needs the ${C.key}` : `WARDED · reach Lv ${GUARDIAN_LV[G.zi]}`, m.x, y, '#d8b8ff', 7);
  }
}

// ================================================================ the adventure layer
// Chapter title cards when you enter a zone, an area banner for each area, weather that fits the land
// that become your respawn point, a discovery bonus for new areas, and the journey map (M).
const WEATHER = {   // by tileset: kind of ambient particles
  1: 'leaves', 201: 'leaves', 4: 'leaves', 3: 'sand', 204: 'sand', 8: 'embers', 208: 'embers', 207: 'steam',
  6: 'snow', 206: 'crystal', 209: 'wisps', 7: 'snow', 205: 'gold', 2: 'spores', 202: 'spores', 203: 'snow',
};
function journeyEnter(game, w, R, prevR) {
  const pr = game.profile;
  pr.seen = pr.seen || {};
  if (R.zone < 0) { const O = R.town && OUTPOST_TOWNS[R.town - 1]; game.banner = { kind: 'area', title: O ? O.name : 'Hearthvale', sub: O ? O.sub : 'home, sweet home', t: 0, dur: 2600 }; return; }
  const s = areaStage(R), Z = ZONES[R.zone];
  if (s.i >= s.n - 1) tipEvent(game, 'guardian');
  if (!prevR || prevR.zone !== R.zone) {
    game.banner = { kind: 'chapter', ch: CHAPTER[R.zone], title: Z.name, sub: ZONE_TAG[R.zone] || Z.desc, ranks: `${RANKS[Z.ranks[0]]} – ${RANKS[Z.ranks[1]]}`, t: 0, dur: 4200 };
  } else {
    const V = VARIANT_INFO[R.variant];
    game.banner = { kind: 'area', title: areaName(R), sub: `${Z.name} · stage ${s.i} of ${s.n}${s.i === s.n ? (R.zone < ZONES.length - 1 ? ' · the Guardian waits' : ' · the end of the world') : V && V.name ? ` · ${V.name}: ${V.tag}` : ''}`, t: 0, dur: 2800 };
  }
  if (!pr.seen[R.key]) {   // discovery bonus
    pr.seen[R.key] = true;
    game.gainExp(killExp(areaRank(R)) * 4);
    game.banner.discovered = true;
    game.save();
  }
}
// LEVEL UP: a white flash and a pillar of light on the hero with rings bursting from his feet; golden wings unfold
// round a gold octagon badge where the level number rolls over; LEVEL UP! drops in letter by letter in forged gold
// on a ribbon, the gains pop in as coloured chips that count up, confetti bursts out, then FULLY RESTORED sweeps in.
const LV_THEME = { metal: ['#fffbe8', '#ffe9a0', '#e8962a', '#fff2c0', '#7a3a06'], edge: '#240c00', acc: '#ffd040', acc2: '#ff9a3a' };
const easeBack = k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function drawLevelUp(game, w, cam, now) {
  const L = game.levelFx; if (!L) return;
  const dt = Math.max(0, Math.min(50, now - (L.last || now))); L.last = now; L.t += dt;
  const D = 3000; if (L.t > D) { game.levelFx = null; return; }   // (cozy: a little shorter, 2026-11-06)
  const t = L.t, p = w && w.player, Z = (w && w.zoom) || ZOOM;
  if (p) {   // in the world: the pillar of light and rings bursting from the hero's feet
    const x = (p.x - cam.x) * Z, y = (p.y - cam.y) * Z, k = Math.max(0, 1 - t / 1600), HL = heroLayer(p), G = HL.glow, RC = cssRgba(HL.bloom);   // (the light in your Layer's colour)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (k > 0) {
      const g = ctx.createLinearGradient(0, y - 240, 0, y); g.addColorStop(0, `rgba(${G},0)`); g.addColorStop(0.7, `rgba(${G},${0.28 * k})`); g.addColorStop(1, `rgba(255,255,255,${0.45 * k})`);
      const bw = 22 + 10 * Math.sin(t / 60); ctx.fillStyle = g; ctx.fillRect(x - bw / 2, y - 240, bw, 240);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`; ctx.fillRect(x - 2, y - 240, 4, 240);
      for (let i = 0; i < 18; i++) { const an = i / 18 * Math.PI * 2 + t / 300, r = 10 + (t / 6 + i * 13) % 50; ctx.fillStyle = `rgba(${G},${k})`; ctx.fillRect(x + Math.cos(an) * r * 0.6, y - (t / 4 + i * 17) % 140, 2, 2); }
    }
    for (let i = 0; i < 3; i++) { const rk = (t - i * 220) / 900; if (rk <= 0 || rk >= 1) continue;
      ctx.strokeStyle = `rgba(${RC[0]},${Math.min(255, RC[1] + i * 30)},${Math.min(255, RC[2] + i * 40)},${1 - rk})`; ctx.lineWidth = 3 * (1 - rk) + 0.5; ctx.beginPath(); ctx.ellipse(x, y, 12 + rk * 90, 5 + rk * 36, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  const inK = Math.min(1, t / 220), outK = Math.min(1, (D - t) / 500), a = inK * outK, cx = VW / 2, cy = 126;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(24,12,0,0.18)'; ctx.fillRect(0, 0, VW, VH);
  if (t < 260) { ctx.fillStyle = `rgba(255,250,230,${0.16 * (1 - t / 260)})`; ctx.fillRect(0, 0, VW, VH); }   // a soft warm glow (it was a bright flash)
  // gold rays wheeling behind, and rings racing out
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy - 30); ctx.rotate(t / 2600);
  for (let i = 0; i < 20; i++) { ctx.rotate(Math.PI / 10); const l = i % 2 ? 150 : 210, g = ctx.createLinearGradient(0, 0, 0, -l); g.addColorStop(0, 'rgba(255,214,90,0.16)'); g.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(0, -l); ctx.lineTo(8, 0); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g0 = ctx.createRadialGradient(cx, cy - 30, 4, cx, cy - 30, 130); g0.addColorStop(0, 'rgba(255,230,150,0.25)'); g0.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g0; ctx.fillRect(cx - 140, cy - 160, 280, 260);
  for (let i = 0; i < 2; i++) { const rk = (t - 120 - i * 160) / 800; if (rk <= 0 || rk >= 1) continue;
    ctx.strokeStyle = `rgba(255,${220 - i * 30},120,${0.6 * (1 - rk)})`; ctx.lineWidth = 2.5 * (1 - rk); ctx.beginPath(); ctx.ellipse(cx, cy - 30, 30 + rk * 300, 16 + rk * 150, 0, 0, Math.PI * 2); ctx.stroke(); }
  // confetti bursting out from the badge, falling as it fades
  for (let i = 0; i < 30; i++) { const ft = t - 150; if (ft < 0 || ft > 2200) break;
    const an = i * 2.39996, sp = 70 + (i % 9) * 22, s = ft / 1000, fx = cx + Math.cos(an) * sp * s * 1.4, fy = cy - 40 + Math.sin(an) * sp * s * 0.9 + 60 * s * s;
    ctx.globalAlpha = a * Math.max(0, 1 - ft / 2200); ctx.fillStyle = ['#ffe08a', '#ffffff', '#ffb040', '#ff8ad8', '#8affd8'][i % 5];
    const sz = 1.5 + (i % 3); ctx.fillRect(fx, fy, sz, sz * (0.5 + 0.5 * Math.abs(Math.sin(t / 90 + i)))); }
  ctx.restore(); ctx.globalAlpha = a;
  // the golden wings unfold round the badge
  const bk = Math.min(1, Math.max(0, (t - 80) / 450)), by = cy - 44 + Math.sin(now / 500) * 1.2;
  if (bk > 0) drawWingPair(cx, by, 'gold', 64 * easeBack(bk), 22, now, easeBack(bk));
  // the badge: a gold octagon medallion in a soft pulse of light, the level rolling over
  if (bk > 0) {
    const bs = easeBack(bk);
    ctx.save(); ctx.translate(cx, by); ctx.scale(bs, bs);
    // a soft pulse of light behind it (no spinning)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gp = ctx.createRadialGradient(0, 0, 8, 0, 0, 32); gp.addColorStop(0, `rgba(255,220,120,${0.5 + 0.2 * Math.sin(now / 260)})`); gp.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const mg = ctx.createLinearGradient(0, -15, 0, 15); mg.addColorStop(0, '#fffbe8'); mg.addColorStop(0.45, '#ffd860'); mg.addColorStop(0.5, '#e8962a'); mg.addColorStop(0.56, '#fff2c0'); mg.addColorStop(1, '#7a3a06');
    const oct = r => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = Math.PI / 8 + i * Math.PI / 4; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); };
    oct(19); ctx.fillStyle = '#240c00'; ctx.fill();   // a gold octagon frame, like the black hole crests
    oct(18); ctx.fillStyle = mg; ctx.fill();
    oct(16.4); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.6; ctx.stroke();
    const og = ctx.createRadialGradient(-4, -5, 1, 0, 0, 12); og.addColorStop(0, '#fff6c8'); og.addColorStop(0.4, '#ff9a20'); og.addColorStop(1, '#5a1a00');
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-4, -6, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const roll = t < 750, lvShown = roll ? Math.max(1, L.lv - (L.ups || 1)) : L.lv, ps = roll ? 1 : 1 + 0.5 * Math.max(0, 1 - (t - 750) / 250);
    text('LV', cx, by - 7 * bs, '#fff6c8', 5);
    ctx.save(); ctx.translate(cx, by + 3 * bs); ctx.scale(bs * ps, bs * ps); text(String(lvShown), 0, 0, '#ffffff', String(lvShown).length > 2 ? 9 : 12); ctx.restore();
    if (!roll && t < 1100) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const sk = (t - 750) / 350; ctx.strokeStyle = `rgba(255,255,220,${1 - sk})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, by, 16 + sk * 26, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  // LEVEL UP! on a ribbon, the letters dropping in one by one
  const str = 'LEVEL UP!', fsz = fontPx(24), parts = [...str].map(ch => ch === ' ' ? null : holeTitlePix(ch, fsz, LV_THEME, 3));
  const sp = fsz * 0.42, widths = parts.map(P => P ? P.w : sp), tw = widths.reduce((s, v) => s + v + 1, 0), ty = cy + 2;
  const rk = Math.min(1, Math.max(0, (t - 150) / 400));
  drawTitleRibbon(cx, ty, tw + 80, fsz * 1.2 + 4, 2, LV_THEME, 1 - (1 - rk) * (1 - rk));
  let lx = cx - tw / 2;
  parts.forEach((P, i) => {
    const wd = widths[i]; if (!P) { lx += wd + 1; return; }
    const k = Math.min(1, Math.max(0, (t - 200 - i * 70) / 320)); if (k > 0) {
      const drop = (1 - easeBack(k)) * -26, s = 1 + 0.5 * (1 - k);
      ctx.save(); ctx.translate(lx + wd / 2, ty + drop + Math.sin(now / 180 + i * 0.7) * 0.8); ctx.scale(s, s);
      ctx.drawImage(P.c, -P.w / 2 - P.pad, -P.y0, P.c.width / TEXT_RES, P.c.height / TEXT_RES); ctx.restore();
    }
    lx += wd + 1;
  });
  if (t > 900) {   // a sheen across the letters
    const sw = ((t - 900) / 1300) % 1.6 - 0.3, x0 = cx - tw / 2 + sw * tw;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.rect(cx - tw / 2, ty - fsz * 0.55, tw, fsz * 1.1); ctx.clip();
    const sg = ctx.createLinearGradient(x0 - 12, 0, x0 + 12, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(x0 - 12, ty - fsz * 0.55, 24, fsz * 1.1); ctx.restore();
  }
  // the gains pop in as chips and count up
  const G = L.gains, chips = [['HP', G.hp, '#ff5a6a'], ['MP', G.mp, '#5aa8ff'], ['ATK', G.atk, '#ffa040'], ['STAT', G.pts, '#ffd040']];
  const cw = 64, gap = 6, x0c = cx - (chips.length * cw + (chips.length - 1) * gap) / 2, chy = cy + 30;
  chips.forEach(([lab, v, col], i) => {
    const k = Math.min(1, Math.max(0, (t - 700 - i * 140) / 300)); if (k <= 0) return;
    const s = easeBack(k), x = x0c + i * (cw + gap) + cw / 2, n = Math.round(v * Math.min(1, (t - 700 - i * 140) / 600));
    ctx.save(); ctx.translate(x, chy); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(16,8,4,0.85)'; rrect(ctx, -cw / 2, -7, cw, 14, 5); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; rrect(ctx, -cw / 2 + 0.5, -6.5, cw - 1, 13, 5); ctx.stroke();
    ctx.fillStyle = col; rrect(ctx, -cw / 2 + 2, -5, 24, 10, 4); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = a * Math.min(1, k * 2);
    text(lab, x - cw / 2 + 14 * s, chy, '#ffffff', 6.5); text(`+${n}`, x + 12 * s, chy, '#fff6d8', 8);
    ctx.restore();
  });
  // FULLY RESTORED sweeps in, then the hint
  if (t > 1300) {
    const k = Math.min(1, (t - 1300) / 400), y = cy + 48;
    ctx.save(); ctx.globalAlpha = a * k; ctx.beginPath(); ctx.rect(cx - 120 * k, y - 8, 240 * k, 16); ctx.clip();
    text('✦ HP & MP FULLY RESTORED ✦', cx, y, `rgb(${170 + 60 * Math.sin(now / 200)},255,220)`, 8.5); ctx.restore();
    if (t > 1700) { ctx.save(); ctx.globalAlpha = a * Math.min(1, (t - 1700) / 400); text('Tab → STATS to spend your points', cx, y + 13, '#e8d8b0', 6.5); ctx.restore(); }
  }
  // sparkles drifting up
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) { const sx = (i * 97.3) % VW, sy = VH + 10 - ((t / 3 + i * 53) % (VH + 40)); ctx.globalAlpha = a * (0.3 + 0.7 * Math.abs(Math.sin(t / 200 + i)));
    ctx.fillStyle = i % 3 ? '#ffe08a' : '#ffffff'; const s = 1 + (i % 2); ctx.fillRect(sx, sy - s, 1, s * 2 + 1); ctx.fillRect(sx - s, sy, s * 2 + 1, 1); }
  ctx.restore();
  ctx.restore();
}
// A black hole tears open. The announcement grows with the hole's rank, in five tiers:
//   F–E  a rift          violet, a small vortex
//   D–C  a maw           blue, letterbox bars, more arcs
//   B–A  an abyss        crimson, god rays, a vignette
//   S–SS a calamity      gold, a turning rune ring, a crown on the rank seal
//   SSS  a world-eater   prismatic, split-colour title, the screen tearing, everything at once
// Its name is the one its plate wears (dreadOf, caves.js); the zone's own words and the tier's still roll an
// epithet for it (the molten maw, the glacial world-eater…), and it has a line of its own. A hole that feeds its way up into a new tier is announced again.
const HOLE_TIERS = [
  { cls: 'MINOR RIFT', nouns: ['RIFT', 'HOLLOW', 'TEAR'], shades: ['#ffffff', '#d8a8ff', '#7a3ad8'], metal: ['#ffffff', '#e6c8ff', '#8a4ad8', '#f0dcff', '#4a1290'], edge: '#14001e', acc: '#c890ff', acc2: '#7a5aff',
    lines: ['A small tear in the sky', 'Space buckles and gives way', 'Something hungry stirs'], tip: 'It grows on every monster it swallows — enter its core to face the boss within' },
  { cls: 'GREATER RIFT', nouns: ['MAW', 'VORTEX', 'WHIRLPOOL'], shades: ['#ffffff', '#a8c8ff', '#3a5ad8'], metal: ['#ffffff', '#cfe0ff', '#3a68d8', '#dce8ff', '#162e90'], edge: '#00081e', acc: '#8ab0ff', acc2: '#b08aff',
    lines: ['The air howls into the dark', 'Light bends toward it', 'The ground trembles at its edge'], tip: 'Its pull is strong now — the boss within has fed well' },
  { cls: 'ABYSSAL CLASS', nouns: ['ABYSS', 'DEVOURER', 'SINGULARITY'], shades: ['#fff0f4', '#ff7ab0', '#a01848'], metal: ['#fff0f4', '#ffb0cc', '#c82058', '#ffd0e0', '#600828'], edge: '#1e0010', acc: '#ff6a9a', acc2: '#c040ff',
    lines: ['The sky darkens — the abyss is awake', 'Even the stars lean closer', 'It drinks the light around it'], tip: 'A dangerous rift — bring your best deck before entering' },
  { cls: 'CALAMITY CLASS', nouns: ['CATACLYSM', 'ECLIPSE', 'STARFALL'], shades: ['#fffbe0', '#ffd25a', '#c0701a'], metal: ['#fffbe8', '#ffe9a0', '#c8801a', '#fff2c0', '#6a3006'], edge: '#240c00', acc: '#ffc040', acc2: '#ff6a3a',
    lines: ['The heavens crack open', 'A calamity descends on {zone}', 'Stars fall into its throat'], tip: 'Only seasoned hunters return from its core' },
  { cls: 'APOCALYPSE CLASS', nouns: ['WORLD-EATER', 'END OF STARS', 'GOD-DEVOURER'], shades: ['#ffffff', '#f4e0ff', '#ff8ad8'], metal: ['#ffffff', '#ffd8ff', '#7a5aff', '#d8ffff', '#2a1070'], edge: '#10001a', acc: '#ffffff', acc2: '#8affff',
    lines: ['The world holds its breath', 'Reality itself is being eaten', 'Not even legends came back from this'], tip: 'The end of all things waits in its core. Enter if you dare' },
];
const HOLE_WORDS = [['VERDANT', 'THORNED', 'WILD'], ['UMBRAL', 'MOONLESS', 'DUSK'], ['GALE', 'ZEPHYR', 'TEMPEST'], ['GLACIAL', 'HOARFROST', 'FROZEN']];
const holeTier = rank => Math.min(4, Math.floor(rank / 2));
function holeAnnounce(game, w, c, grown) {
  const rank = caveRank(c), T = holeTier(rank), H = HOLE_TIERS[T], R0 = regionAt(c.x), zone = ZONES[c.zi].name;
  const adj = pick(HOLE_WORDS[c.zi] || HOLE_WORDS[0]), noun = pick(H.nouns);
  c.tier = T;
  game.holeBanner = { t: 0, dur: 3400 + T * 300, T, rank, zone, area: R0 ? areaName(R0) : '', grown,
    name: dreadOf(rank).name,   // the same name its plate wears (BLACK HOLE · DEEP RIFT · VOID MAW · WORLD-EATER, caves.js)
    line: grown ? `The ${adj.toLowerCase()} ${noun.toLowerCase()} has fed — now rank ${RANKS[rank]}` : `The ${adj.toLowerCase()} ${noun.toLowerCase()}: ${pick(H.lines).replace('{zone}', zone)}` };
  w.shake = Math.max(w.shake || 0, 5 + T * 2.5);
  if (!grown && typeof tipEvent === 'function') { tipEvent(game, 'holeguard'); tipEvent(game, 'hole'); }   // first black hole: what it is, then its guards (urgent tips go to the front, so queued in reverse)
}
// The black hole's title, forged: a soft glow in the tier's colour, letters extruded into depth, a thick dark edge with
// a coloured rim, and a metal fill (light top, a dark band, a bright horizon line, a deep bottom). Cached per name.
const HOLE_PIX = new Map();
function holeTitlePix(str, px, H, T) {
  const key = `${str}|${px}|${T}|${H.acc}`;
  let P = HOLE_PIX.get(key); if (P) return P;
  if (HOLE_PIX.size > 60) HOLE_PIX.clear();
  const S = TEXT_RES, fp = px * S, c = document.createElement('canvas'), g = c.getContext('2d'), font = `900 ${fp}px ${FONT}`, sp = fp * 0.07;
  g.font = font; if ('letterSpacing' in g) g.letterSpacing = `${sp}px`;
  const tw = g.measureText(str).width, pad = Math.ceil(fp * 0.55), depth = Math.round((1.5 + T * 0.7) * S);
  c.width = Math.ceil(tw) + pad * 2; c.height = Math.ceil(fp * 1.3) + pad * 2 + depth;
  g.font = font; if ('letterSpacing' in g) g.letterSpacing = `${sp}px`; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const y0 = pad + fp * 0.65, M = H.metal;
  g.save(); g.shadowColor = H.acc; g.shadowBlur = fp * 0.55; g.fillStyle = H.acc; g.globalAlpha = 0.85; g.fillText(str, pad, y0); g.fillText(str, pad, y0); g.restore();
  g.fillStyle = H.edge; g.strokeStyle = H.edge; g.lineWidth = fp / 4.2;
  for (let d = depth; d >= 1; d--) { g.strokeText(str, pad, y0 + d); g.fillText(str, pad, y0 + d); }   // the extrusion
  g.fillStyle = M[4]; g.globalAlpha = 0.55; g.fillText(str, pad, y0 + depth * 0.5); g.globalAlpha = 1;          // its lit side
  g.strokeStyle = H.edge; g.lineWidth = fp / 4.2; g.strokeText(str, pad, y0);
  g.strokeStyle = H.acc; g.lineWidth = fp / 10; g.strokeText(str, pad, y0);
  const gr = g.createLinearGradient(0, y0 - fp * 0.42, 0, y0 + fp * 0.42);
  gr.addColorStop(0, M[0]); gr.addColorStop(0.42, M[1]); gr.addColorStop(0.5, M[2]); gr.addColorStop(0.56, M[3]); gr.addColorStop(1, M[4]);
  g.fillStyle = gr; g.fillText(str, pad, y0);
  P = { c, w: tw / S, h: c.height / S, pad: pad / S, y0: y0 / S }; HOLE_PIX.set(key, P); return P;
}
// The rank crest, in pixel art: built once per rank at one canvas pixel per game pixel, edges snapped hard and ringed
// with a white pixel outline, then drawn scaled up without smoothing: an octagon in the wings' metal with a faceted
// band and four round studs holds a glass orb in the rank's colour with a rounded letter; a crown from rank B up.
// The wings are the user's own wing sheet (assets/ui/wings.png, the background keyed out): nine pairs, one per rank
// from the little cloud wings at F to the cosmic ones at SSS. Boxes are [x, y, w, h] in the sheet.
const WING_IMG = new Image();
WING_IMG.onerror = () => { WING_IMG.tries = (WING_IMG.tries || 0) + 1; if (WING_IMG.tries < 8) setTimeout(() => { WING_IMG.src = 'assets/ui/wings.png?r=' + WING_IMG.tries; }, 400 * WING_IMG.tries); };   // a dropped request tries again
WING_IMG.src = 'assets/ui/wings.png';
const WING_SPR = {
  whitegold: { L: [41, 16, 149, 153], R: [190, 16, 149, 153] },
  pink: { L: [376, 18, 154, 152], R: [530, 18, 154, 152] },
  cloud: { L: [737, 43, 111, 105], R: [851, 43, 112, 104] },
  gold: { L: [18, 158, 173, 182], R: [191, 159, 172, 181] },
  cosmic: { L: [373, 177, 157, 167], R: [530, 177, 157, 170] },
  mint: { L: [694, 168, 156, 176], R: [850, 168, 157, 175] },
  lavender: { L: [14, 321, 179, 239], R: [193, 321, 179, 239] },
  peach: { L: [405, 385, 127, 162], R: [532, 385, 127, 162] },
  blueviolet: { L: [682, 346, 167, 193], R: [849, 345, 165, 194] },
};
const RANK_WINGS = ['cloud', 'peach', 'mint', 'whitegold', 'pink', 'blueviolet', 'gold', 'lavender', 'cosmic', 'cosmic'];
// each pair's colours, so the whole announcement (title, ribbon, crest, rays, galaxy) matches the wings above it
const WING_THEME = {
  cloud:      { metal: ['#ffffff', '#d8f0ff', '#6ab0e8', '#e0f4ff', '#2a5a98'], edge: '#0a1a38', acc: '#9ad8ff', acc2: '#6aa8ff' },
  peach:      { metal: ['#fffaf4', '#ffd8c8', '#f08a6a', '#ffe4d8', '#9a3a2a'], edge: '#2a0a06', acc: '#ffb09a', acc2: '#ff8a8a' },
  mint:       { metal: ['#ffffff', '#c8ffe8', '#3ac8a0', '#d8fff0', '#0e6a50'], edge: '#021a14', acc: '#8affd0', acc2: '#4ae0c0' },
  whitegold:  { metal: ['#ffffff', '#fff6dc', '#e8c060', '#fffbe8', '#9a6a1a'], edge: '#241404', acc: '#ffe8a8', acc2: '#ffd070' },
  pink:       { metal: ['#fff4fc', '#ffc8ec', '#e070c8', '#ffe0f6', '#7a2a8a'], edge: '#1e0624', acc: '#ffa8e8', acc2: '#d088ff' },
  blueviolet: { metal: ['#f4f4ff', '#b8c0ff', '#6a5ae8', '#d8dcff', '#2a1a90'], edge: '#0a0628', acc: '#9aa8ff', acc2: '#b080ff' },
  gold:       { metal: ['#fffbe8', '#ffe9a0', '#e8962a', '#fff2c0', '#7a3a06'], edge: '#240c00', acc: '#ffc040', acc2: '#ff9a3a' },
  lavender:   { metal: ['#ffffff', '#e0d8ff', '#8a78e8', '#efeaff', '#3a2a98'], edge: '#0e0830', acc: '#c8b8ff', acc2: '#9a8aff' },
  cosmic:     { metal: ['#ffffff', '#d8c8ff', '#7a4ae0', '#e8dcff', '#2a1070'], edge: '#0a0420', acc: '#b890ff', acc2: '#e070ff' },
};
const rgbaOf = (col, a) => { const c = cssRgba(col); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
function hueOf(col) { const [r0, g0, b0] = cssRgba(col).map(v => v / 255), mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), d = mx - mn; if (!d) return 0;
  const h = mx === r0 ? ((g0 - b0) / d) % 6 : mx === g0 ? (b0 - r0) / d + 2 : (r0 - g0) / d + 4; return (h * 60 + 360) % 360; }
const holeTheme = (rank, T) => ({ ...HOLE_TIERS[T], ...WING_THEME[RANK_WINGS[rank]] });
function crestPal(rank) {
  const W = WING_THEME[RANK_WINGS[rank]], M = W.metal;
  return { line: W.edge, rimHi: M[0], rim: mixCol(M[1], M[2], 0.35), rimLo: M[4], band: [W.acc, W.acc2], glow: W.acc };
}
// a pair of wings from the sheet either side of x (R: half the gap between them); unfold opens them from the middle
function drawWingPair(x, y, name, hw, R, now, unfold = 1, spin = false) {
  if (!WING_IMG.naturalWidth) return;   // (complete can read false while it is already drawable)
  const Sp = WING_SPR[name], flap = Math.sin(now / 450) * 0.06;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (spin) ctx.filter = `hue-rotate(${(now / 8) % 360}deg)`;
  for (const [b, sd] of [[Sp.L, -1], [Sp.R, 1]]) {
    const sc = hw / b[3], w = b[2] * sc;
    ctx.save(); ctx.translate(x + sd * R * 0.55, y - R * 0.3); ctx.rotate(sd * flap); ctx.scale(Math.max(0.05, unfold), 1);
    ctx.drawImage(WING_IMG, b[0], b[1], b[2], b[3], sd < 0 ? -w : 0, -hw * 0.55, w, hw);
    ctx.restore();
  }
  ctx.restore();
}
function drawRankWings(x, y, rank, R, pop, now) {
  drawWingPair(x, y, RANK_WINGS[rank], R * (2.4 + 0.13 * rank) * pop, R * pop, now, 1, rank >= 9);   // SSS+: the cosmic wings shift through every colour
}
const CREST = new Map();
const crestR = T => 16 + T * 2;
function mixCol(a, b, k) { const A = cssRgba(a), B = cssRgba(b); return `rgb(${A.slice(0, 3).map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; }
function buildCrest(rank, T) {
  const key = `${rank}|${T}`; let C = CREST.get(key); if (C) return C;
  const P = crestPal(rank), R = crestR(T);
  const W = Math.ceil(R * 18), Hh = Math.ceil(R * 9), ox = Math.round(W / 2), oy = Math.round(Hh * 0.6);   // roomy: cropped to the drawing at the end
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  g.translate(ox, oy);
  // --- the frame: gold rim, faceted band, gold ring, orb
  const octPt = (r, i) => { const an = Math.PI / 8 + i * Math.PI / 4; return [Math.cos(an) * r, Math.sin(an) * r]; };
  const oct = r => { g.beginPath(); for (let i = 0; i < 8; i++) g[i ? 'lineTo' : 'moveTo'](...octPt(r, i)); g.closePath(); };
  oct(R + 4); g.fillStyle = P.line; g.fill();
  const rg = g.createLinearGradient(0, -R - 3, 0, R + 3); rg.addColorStop(0, P.rimHi); rg.addColorStop(0.45, P.rim); rg.addColorStop(1, P.rimLo);
  oct(R + 3); g.fillStyle = rg; g.fill();
  oct(R + 0.5); g.fillStyle = P.line; g.fill();
  for (let i = 0; i < 8; i++) {   // eight facets, lit from above
    const [ax, ay] = octPt(R - 0.5, i), [bx, by] = octPt(R - 0.5, i + 1), [cx2, cy2] = octPt(R * 0.76, i + 1), [dx, dy] = octPt(R * 0.76, i);
    const up = -Math.sin(Math.PI / 8 + (i + 0.5) * Math.PI / 4);
    g.fillStyle = mixCol(P.band[i % 2], up > 0 ? '#ffffff' : P.line, Math.abs(up) * 0.3);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx2, cy2); g.lineTo(dx, dy); g.closePath(); g.fill();
  }
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, R * 0.74, 0, Math.PI * 2); g.fill();
  g.fillStyle = P.line; g.beginPath(); g.arc(0, 0, R * 0.66, 0, Math.PI * 2); g.fill();
  const rc = T >= 4 ? '#c890ff' : rankSolid(rank), og = g.createRadialGradient(-R * 0.2, -R * 0.25, 1, 0, 0, R * 0.64);
  og.addColorStop(0, mixCol(rc, '#ffffff', 0.55)); og.addColorStop(0.45, rc); og.addColorStop(1, mixCol(rc, '#140428', 0.6));
  g.fillStyle = og; g.beginPath(); g.arc(0, 0, R * 0.62, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(-R * 0.26, -R * 0.34, R * 0.17, R * 0.09, -0.6, 0, Math.PI * 2); g.fill();
  g.fillRect(R * 0.3, R * 0.25, 1.5, 1.5);
  // four round studs on the band
  for (const [sx, sy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const px = sx * R * 0.89, py = sy * R * 0.89;
    g.fillStyle = P.line; g.beginPath(); g.arc(px, py, 2.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = P.rim; g.beginPath(); g.arc(px, py, 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = mixCol(rc, P.line, 0.25); g.beginPath(); g.arc(px, py, 1.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(Math.round(px - 1), Math.round(py - 1), 1, 1);
  }
  // a crown from rank B up, grander every tier
  if (T >= 2) {
    const cw = 6 + (T - 2) * 2, ch = 6 + (T - 2) * 2, by = -R - 3;
    const crown = (e) => { g.beginPath(); g.moveTo(-cw - e, by + e); g.lineTo(-cw - e, by - ch * 0.8 - e); g.lineTo(-cw * 0.45, by - ch * 0.35); g.lineTo(0, by - ch - e * 1.4); g.lineTo(cw * 0.45, by - ch * 0.35); g.lineTo(cw + e, by - ch * 0.8 - e); g.lineTo(cw + e, by + e); g.closePath(); };
    crown(1); g.fillStyle = '#5a2a06'; g.fill();
    const cg = g.createLinearGradient(0, by - ch, 0, by); cg.addColorStop(0, '#fff6b0'); cg.addColorStop(0.5, '#ffd040'); cg.addColorStop(1, '#d08a10');
    crown(0); g.fillStyle = cg; g.fill();
    g.fillStyle = '#ff5aa8'; g.beginPath(); g.arc(0, by - ch * 0.3, 1.4, 0, Math.PI * 2); g.fill();
    if (T >= 3) { g.fillStyle = '#5ac8ff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * cw * 0.62, by - 1.5, 1, 0, Math.PI * 2); g.fill(); } }
    if (T >= 4) { g.fillStyle = '#ffffff'; for (const [x, y] of [[0, by - ch - 1.6], [-cw - 0.5, by - ch * 0.8 - 1], [cw + 0.5, by - ch * 0.8 - 1]]) { g.beginPath(); g.arc(x, y, 1.1, 0, Math.PI * 2); g.fill(); } }
  }
  // the letter: round and bubbly
  const rs = RANKS[rank], fs = Math.round(R * [0, 0.98, 0.74, 0.54, 0.44][rs.length]);
  g.font = `700 ${fs}px "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = P.line; g.lineWidth = Math.max(2, fs * 0.2); g.strokeText(rs, 0, 1);
  const lg = g.createLinearGradient(0, -fs / 2, 0, fs / 2); lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, '#e0ccff');
  g.fillStyle = lg; g.fillText(rs, 0, 1);
  // snap every edge to whole pixels, then ring the whole emblem in a white pixel outline and a soft coloured one
  const im0 = g.getImageData(0, 0, W, Hh), d0 = im0.data;
  let x0 = W, y0 = Hh, x1 = 0, y1 = 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4 + 3; d0[i] = d0[i] >= 110 ? 255 : 0; if (d0[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  g.putImageData(im0, 0, 0);
  const M3 = 3, cw2 = x1 - x0 + 1 + M3 * 2, ch2 = y1 - y0 + 1 + M3 * 2, c2 = document.createElement('canvas'); c2.width = cw2; c2.height = ch2;
  const g2 = c2.getContext('2d'); g2.drawImage(c, x0 - M3, y0 - M3, cw2, ch2, 0, 0, cw2, ch2);
  const im = g2.getImageData(0, 0, cw2, ch2), d = im.data;
  const ring = (col, al) => {
    const [r0, g0, b0] = cssRgba(col), src = new Uint8Array(cw2 * ch2);
    for (let i = 0; i < cw2 * ch2; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (let y = 1; y < ch2 - 1; y++) for (let x = 1; x < cw2 - 1; x++) { const i = y * cw2 + x; if (src[i]) continue;
      if (src[i - 1] || src[i + 1] || src[i - cw2] || src[i + cw2]) { d[i * 4] = r0; d[i * 4 + 1] = g0; d[i * 4 + 2] = b0; d[i * 4 + 3] = al; } }
  };
  ring('#fff8ff', 255); ring(P.glow, 130);
  g2.putImageData(im, 0, 0);
  C = { c: c2, W: cw2, Hh: ch2, ox: ox - x0 + M3, oy: oy - y0 + M3, R }; CREST.set(key, C); return C;
}
function drawRankCrest(x, y, rank, T, H, now, k) {
  const C = buildCrest(rank, T), P = crestPal(rank), R = C.R;
  const pop = k < 1 ? 1 + 0.35 * Math.sin(k * Math.PI) * (1 - k) + (k - 1) * 0.4 : 1;
  const by = y + Math.round(Math.sin(now / 600) * 1.5);
  // glow and slow rays behind
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(x, by, R * 0.4, x, by, R * 3.6); gl.addColorStop(0, P.glow); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha *= 0.4 + 0.1 * Math.sin(now / 300); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, by, R * 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // embers circling it, the far half behind the crest
  const n = 4 + T * 2, emb = (front) => {
    for (let i = 0; i < n; i++) { const a0 = now / 900 + i / n * Math.PI * 2; if ((Math.sin(a0) > 0) !== front) continue;
      for (let j = 3; j >= 0; j--) { const a = a0 - j * 0.09, ex = Math.round(x + Math.cos(a) * R * 1.95 * pop), ey = Math.round(by + Math.sin(a) * R * 1.3 * pop), s = j ? 2 - j * 0.4 : 2;
        ctx.globalAlpha = (1 - j * 0.22); ctx.fillStyle = ['#fff2a0', '#ffc040', '#ff8a30', '#ff5a20'][j]; ctx.fillRect(ex - s / 2, ey - s / 2, s, s); } }
    ctx.globalAlpha = 1; };
  ctx.save(); emb(false); ctx.restore();
  drawRankWings(x, by, rank, R, pop, now);
  // the crest itself, crisp
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.translate(x, by); ctx.scale(pop, pop); ctx.drawImage(C.c, -C.ox, -C.oy, C.W, C.Hh);
  ctx.restore();
  ctx.save(); emb(true); ctx.restore();
  // pixel sparkles twinkling round it
  ctx.save();
  for (let i = 0, m = 8 + T * 3; i < m; i++) {
    const ph = (now / 1400 + i * 0.29) % 1, an = i * 2.4, rr = R * (1.6 + (i % 4) * 0.55), sx = Math.round(x + Math.cos(an) * rr * 1.9), sy = Math.round(by + Math.sin(an) * rr * 0.75);
    const s = 1 + (i % 3), al = Math.sin(ph * Math.PI); if (al < 0.1) continue;
    ctx.globalAlpha = al; ctx.fillStyle = i % 3 ? '#ffffff' : P.glow;
    ctx.fillRect(sx, sy - s, 1, s * 2 + 1); ctx.fillRect(sx - s, sy, s * 2 + 1, 1);
  }
  ctx.restore();
}
// a dark ribbon behind the title that unrolls from the middle, swallowtail ends, trimmed in the tier's colour
function drawTitleRibbon(cx, cy, w, h, T, H, k) {
  const hw = w / 2 * k, n = h * 0.45;
  if (hw < 4) return;
  const shape = (ex) => { ctx.beginPath(); ctx.moveTo(cx - hw - ex, cy - h / 2 - ex); ctx.lineTo(cx + hw + ex, cy - h / 2 - ex); ctx.lineTo(cx + hw - n + ex * 0.4, cy); ctx.lineTo(cx + hw + ex, cy + h / 2 + ex); ctx.lineTo(cx - hw - ex, cy + h / 2 + ex); ctx.lineTo(cx - hw + n - ex * 0.4, cy); ctx.closePath(); };
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, rgbaOf(H.edge, 0.78)); g.addColorStop(0.5, rgbaOf(H.edge, 0.42)); g.addColorStop(1, rgbaOf(H.edge, 0.78));   // see-through: the galaxy shows behind the name
  shape(0); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = H.acc; ctx.lineWidth = 1; ctx.stroke();
  if (T >= 2) { shape(-2.5); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.5; ctx.stroke(); }
  if (T >= 3) for (const sd of [-1, 1]) {   // filigree curls off the tips
    ctx.strokeStyle = H.acc; ctx.lineWidth = 0.8; const x0 = cx + sd * (hw + 1);
    for (const vy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x0, cy + vy * h / 2); ctx.bezierCurveTo(x0 + sd * 10, cy + vy * (h / 2 + 6), x0 + sd * 16, cy + vy * 2, x0 + sd * 9, cy + vy * 1); ctx.stroke(); }
    ctx.fillStyle = H.acc; ctx.beginPath(); ctx.moveTo(x0 + sd * 12, cy - 2.5); ctx.lineTo(x0 + sd * 15, cy); ctx.lineTo(x0 + sd * 12, cy + 2.5); ctx.lineTo(x0 + sd * 9, cy); ctx.fill();
  }
}
function drawHoleBanner(game, now) {
  const B = game.holeBanner; if (!B) return;
  const dt = Math.max(0, Math.min(50, now - (B.last || now))); B.last = now; B.t += dt;
  if (B.t > B.dur) { game.holeBanner = null; return; }
  const T = B.T || 0, H = holeTheme(B.rank, T), kT = T / 4;
  const t = B.t, a = Math.min(1, t / 300, (B.dur - t) / 600), cx = VW / 2, cy = 134;
  ctx.save(); ctx.globalAlpha = a;
  // the world dims (darker and closer in as the rank climbs)
  ctx.fillStyle = rgbaOf(mixCol(H.edge, '#000000', 0.4), 0.42 + 0.3 * kT); ctx.fillRect(0, 0, VW, VH);
  if (T >= 2) { const vg = ctx.createRadialGradient(cx, cy, 60, cx, cy, VW * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.3 + 0.2 * kT})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH); }
  // letterbox bars slide in for a greater rift and up
  if (T >= 1) { const bar = (10 + T * 7) * Math.min(1, t / 500); ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, VW, bar); ctx.fillRect(0, VH - bar, VW, bar);
    ctx.fillStyle = H.acc; ctx.globalAlpha = a * 0.6; ctx.fillRect(0, bar - 0.6, VW, 0.6); ctx.fillRect(0, VH - bar, VW, 0.6); ctx.globalAlpha = a; }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // god rays wheeling out from the core (abyssal and up)
  if (T >= 2) {
    const n = 6 + T * 3, len = 260 + T * 40, grow = Math.min(1, t / 900);
    for (let i = 0; i < n; i++) {
      const an = i / n * Math.PI * 2 + now / (5000 - T * 600) * (i % 2 ? 1 : -0.6), wd = 0.05 + 0.04 * Math.sin(i * 3.7 + now / 700);
      const col = T >= 4 ? `hsla(${(i * 40 + now / 10) % 360},100%,70%,0.16)` : (i % 2 ? H.acc : H.acc2);
      const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, len * grow); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.globalAlpha = a * (T >= 4 ? 1 : 0.22);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, len * grow, an - wd, an + wd); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = a;
  }
  ctx.restore();
  // the galaxy, swelling in behind the title (bigger for a bigger hole)
  // (tinted to the tier: violet, blue, crimson, gold, and every colour at once for the apocalypse)
  ctx.save(); ctx.filter = B.rank >= 9 ? `hue-rotate(${(now / 8) % 360}deg) saturate(1.6)` : `grayscale(1) sepia(1) saturate(3.5) hue-rotate(${Math.round(hueOf(H.acc2) - 38)}deg) brightness(1.15)`;   // tinted wholly to the wings' colour
  drawGalaxyLight(cx, cy, (50 + T * 9) + (16 + T * 4) * Math.min(1, t / 700), now * (2 + T * 0.4), a, 0.42, now * (2 + T * 0.4) / 2600, true);   // just the galaxy: no space window or glow round it
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // a ring of runes turning round it (calamity and up)
  if (T >= 3) {
    const rr = 104 + T * 6, k = Math.min(1, (t - 200) / 800); if (k > 0) for (let i = 0; i < 32; i++) {
      const an = i / 32 * Math.PI * 2 + now / 3000, x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.36;
      ctx.globalAlpha = a * k * (0.7 + 0.3 * Math.sin(an)); ctx.fillStyle = i % 4 ? H.acc : '#ffffff';
      ctx.save(); ctx.translate(x, y); ctx.rotate(an * 2); ctx.scale(1.6, 1.6);
      if (i % 3 === 0) { ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(2, 0); ctx.lineTo(0, 3); ctx.lineTo(-2, 0); ctx.fill(); }
      else if (i % 3 === 1) ctx.fillRect(-1.5, -2.5, 1, 5), ctx.fillRect(-1.5, -0.5, 3, 1);
      else { ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = a;
  }
  // motes drawn up toward the hole from the bottom of the screen
  for (let i = 0, n = 10 + T * 14; i < n; i++) { const k = ((now / (2600 - T * 300)) + i * 0.618) % 1, sx = (i * 97.3) % VW;
    const x = sx + (cx - sx) * k * k, y = VH + 10 - (VH + 10 - cy) * k; ctx.globalAlpha = a * Math.sin(k * Math.PI) * 0.8;
    ctx.fillStyle = T >= 4 ? `hsl(${(i * 37 + now / 8) % 360},100%,75%)` : i % 3 ? H.acc : '#ffffff'; ctx.fillRect(x, y, 1.5, 1.5); }
  ctx.globalAlpha = a;
  // shockwaves when the title lands: one more for every tier
  // (at most two soft rings: cozy)
  for (let s = 0; s <= Math.min(T, 1); s++) { const sk = (t - 350 - s * 160) / 800; if (sk <= 0 || sk >= 1) continue;
    ctx.strokeStyle = T >= 4 ? `hsla(${(s * 70 + now / 5) % 360},100%,80%,${1 - sk})` : H.acc; ctx.globalAlpha = a * (1 - sk); ctx.lineWidth = (3 + T) * (1 - sk);
    ctx.beginPath(); ctx.ellipse(cx, cy, 40 + sk * (260 + T * 40), 20 + sk * (130 + T * 20), 0, 0, Math.PI * 2); ctx.stroke(); }
  // a white flash on impact, brighter for the greater ranks
  const fl = (t - 330) / 260; if (fl > 0 && fl < 1) { ctx.globalAlpha = a * (1 - fl) * (0.07 + 0.03 * T); ctx.fillStyle = '#fff6e0'; ctx.fillRect(0, 0, VW, VH); }
  ctx.restore();
  // ---- the words
  // the rank crest drops in over the title
  const sk = Math.min(1, Math.max(0, (t - 150) / 450)), sealY = cy - 41 - crestR(T);
  if (sk > 0) { ctx.save(); ctx.globalAlpha = a * Math.min(1, sk * 2); drawRankCrest(cx, sealY, B.rank, T, H, now, sk); ctx.restore(); }
  // the class line between ornaments
  if (t > 250) {
    const k = Math.min(1, (t - 250) / 500), ly = cy - 30, cls = B.grown ? 'IT GROWS STRONGER' : `BLACK HOLE · ${H.cls}`;
    ctx.save(); ctx.globalAlpha = a * k;
    const hw = textW(cls, 7) / 2 + 8, lw = (30 + T * 14) * k;
    ctx.strokeStyle = H.acc; ctx.lineWidth = 0.8; ctx.fillStyle = H.acc;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sg * hw, ly); ctx.lineTo(cx + sg * (hw + lw), ly); ctx.stroke();
      const ex = cx + sg * (hw + lw); ctx.beginPath(); ctx.moveTo(ex, ly - 2.5); ctx.lineTo(ex + sg * 2.5, ly); ctx.lineTo(ex, ly + 2.5); ctx.lineTo(ex - sg * 2.5, ly); ctx.fill(); }
    text(cls, cx, ly, H.acc, 7);
    ctx.restore();
  }
  // the name slams in, bigger and heavier with the rank (no ribbon behind it)
  const s = t < 350 ? 2.6 - 1.6 * (t / 350) : 1 + (0.02 + 0.008 * T) * Math.sin(now / 90);
  const fsz = fontPx(B.name.length > 16 ? 18 + T : 21 + T * 1.5), jit = t < 600 + T * 150 ? (Math.random() - 0.5) * (3 + T) : 0;
  const P = holeTitlePix(B.name, fsz, H, T);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx + jit, cy - 4); ctx.scale(s, s);
  if (T >= 4) {   // split-colour ghosts either side
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.6;
    const o = 1.5 + Math.sin(now / 60) * 1.2;
    drawPix(pixText(B.name, fsz, 900, ['#ff60c0', '#ff2090', '#a00060'], null), -o, 0, 'center');
    drawPix(pixText(B.name, fsz, 900, ['#60ffff', '#20d0ff', '#0060a0'], null), o, 0, 'center');
    ctx.restore();
  }
  ctx.drawImage(P.c, -P.w / 2 - P.pad, -P.y0, P.c.width / TEXT_RES, P.c.height / TEXT_RES);
  {   // a sheen sweeps across the letters
    const sw = ((now / (1500 - T * 120)) % 1.8) - 0.4, x0 = -P.w / 2 + sw * P.w;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.rect(-P.w / 2, -fsz * 0.55, P.w, fsz * 1.1); ctx.clip();
    const g = ctx.createLinearGradient(x0 - 12, 0, x0 + 12, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.transform(1, 0, -0.4, 1, 0, 0); ctx.fillRect(x0 - 12, -fsz * 0.55, 24, fsz * 1.1); ctx.restore();
  }
  ctx.restore();
  // the line types itself out, then where it is, then what it means
  if (t > 450) {
    const k = Math.min(1, (t - 450) / 400), n = Math.min(B.line.length, Math.floor((t - 450) / 28));
    ctx.save(); ctx.globalAlpha = a * k;
    const pl = ctx.createLinearGradient(cx - 220, 0, cx + 220, 0);   // a dark plate so the small lines read over the galaxy
    pl.addColorStop(0, 'rgba(6,0,16,0)'); pl.addColorStop(0.25, 'rgba(6,0,16,0.6)'); pl.addColorStop(0.75, 'rgba(6,0,16,0.6)'); pl.addColorStop(1, 'rgba(6,0,16,0)');
    ctx.fillStyle = pl; ctx.fillRect(cx - 220, cy + 13, 440, 42);
    text(B.line.slice(0, n), cx, cy + 22, mixCol(H.metal[1], '#ffffff', 0.5), 9);
    if (t > 900) { ctx.globalAlpha = a * Math.min(1, (t - 900) / 400);
      text(`${B.zone}${B.area ? ' · ' + B.area : ''}`, cx, cy + 36, H.acc, 7);
      text(H.tip, cx, cy + 48, mixCol(H.acc, '#9a9aa8', 0.45), 6.5); }
    ctx.restore();
  }
  ctx.restore();
}
function drawBanner(game, now, dt) {
  const B = game.banner; if (!B) return;
  B.t += dt;
  if (B.t > B.dur) { game.banner = null; return; }
  const k = Math.min(1, B.t / 400, (B.dur - B.t) / 500);
  if (B.kind === 'chapter') {
    // letterbox bars slide in, a gold title rises, light sweeps across
    const bar = 22 * k;   // (cozy: thinner, softer bars)
    ctx.fillStyle = 'rgba(20,12,8,0.6)'; ctx.fillRect(0, 0, VW, bar); ctx.fillRect(0, VH - bar, VW, bar);
    ctx.save(); ctx.globalAlpha = k;
    const g = ctx.createLinearGradient(0, VH / 2 - 50, 0, VH / 2 + 40);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(30,18,10,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, VH / 2 - 50, VW, 90);
    const rise = (1 - Math.min(1, B.t / 700)) * 10;
    text(`CHAPTER ${B.ch}`, VW / 2, VH / 2 - 36 + rise, '#e8d2a0', 9);
    goldTitle(B.title.toUpperCase(), VW / 2, VH / 2 - 14 + rise, 20, now);
    ctx.strokeStyle = 'rgba(232,180,90,0.8)'; ctx.lineWidth = 0.8;
    const lw = 120 * Math.min(1, B.t / 900);
    ctx.beginPath(); ctx.moveTo(VW / 2 - lw, VH / 2 + 6); ctx.lineTo(VW / 2 + lw, VH / 2 + 6); ctx.stroke();
    text(B.sub, VW / 2, VH / 2 + 18, '#f0e6d0', 8);
    text(`monsters rank ${B.ranks}`, VW / 2, VH / 2 + 30, '#c9b89a', 6.5);
    if (B.discovered) text('✦ NEW LAND DISCOVERED ✦', VW / 2, VH / 2 + 42, `rgba(255,224,138,${0.6 + 0.4 * Math.sin(now / 200)})`, 7);
    ctx.restore();
  } else {
    ctx.save(); ctx.globalAlpha = k;
    const y = 104, w = Math.max(160, textW(B.sub, 7) + 40);   // (below the clock and the message pills, so nothing overlaps)
    const g = ctx.createLinearGradient(VW / 2 - w / 2, 0, VW / 2 + w / 2, 0);
    g.addColorStop(0, 'rgba(46,28,18,0)'); g.addColorStop(0.2, 'rgba(46,28,18,0.7)'); g.addColorStop(0.8, 'rgba(46,28,18,0.7)'); g.addColorStop(1, 'rgba(46,28,18,0)');   // (warm cocoa, like the message pills)
    ctx.fillStyle = g; ctx.fillRect(VW / 2 - w / 2, y - 14, w, B.discovered ? 41 : 32);
    text(B.title, VW / 2, y - 3, '#ffe9a8', 12);
    text(B.sub, VW / 2, y + 10, '#e0d8c8', 7);
    if (B.discovered) text('✦ discovered ✦', VW / 2, y + 20, '#ffd23f', 7);   // (its own line: it used to sit on long names)
    ctx.restore();
  }
}
// weather: screen-space particles that fit the land under the hero (drawn over the world, under the HUD)
function drawWeather(w, now) {
  if (!w.overworld || w.interior) return;
  const R = REGIONS[w.region]; if (!R || R.zone < 0) return;
  const kind = WEATHER[R.tileset] || (R.zone === 1 ? 'fireflies' : null);
  const night = R.zone === 1 && (R.tileset === 1);
  ctx.save();
  if (night || kind === 'fireflies') {   // dusk: fireflies drift
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const x = (i * 137 + Math.sin(now / 1700 + i) * 40) % VW, y = (i * 71 + Math.cos(now / 2100 + i * 2) * 30) % VH;
      const blink = 0.4 + 0.6 * Math.max(0, Math.sin(now / 600 + i * 1.3)) ** 2;   // (each one glows up and fades on its own beat)
      const hg = ctx.createRadialGradient(x, y, 0, x, y, 4.5); hg.addColorStop(0, `rgba(220,255,140,${0.45 * blink})`); hg.addColorStop(1, 'rgba(220,255,140,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = hg; ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.globalAlpha = 0.5 + 0.5 * blink; ctx.fillStyle = '#f4ffb8'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }
  const N = { leaves: 14, sand: 40, embers: 30, steam: 10, snow: 46, crystal: 20, gold: 24, spores: 22, wisps: 16 }[kind] || 0;
  for (let i = 0; i < N; i++) {
    const r = (i * 9301 + 49297) % 233280 / 233280, r2 = (i * 4271 + 1031) % 1000 / 1000;
    let x, y, sz = 1.2, col = '#ffffff', a = 0.7;
    if (kind === 'leaves') {   // a little leaf (body, darker vein, stem) that sways like a pendulum and tumbles as it falls
      const k = (now / (9000 + r * 5000) + r) % 1, sw = Math.sin(now / (900 + r * 500) + i * 1.7);
      x = (r2 * VW + k * 140 + sw * 10) % VW; y = k * VH;
      const flip = Math.cos(now / (500 + r * 300) + i), P = [['#f0c858', '#a8782a'], ['#e89a48', '#a85a24'], ['#c8e070', '#6a9a3a']][i % 3];   // (gold, amber, light green: they read over grass)
      ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(sw * 0.6); ctx.scale(Math.max(0.25, Math.abs(flip)), 1);
      ctx.fillStyle = 'rgba(40,30,10,0.35)'; ctx.fillRect(-2.5, -1, 5, 3);   // (a faint dark edge)
      ctx.fillStyle = P[0]; ctx.fillRect(-2.5, -1.5, 5, 2.5); ctx.fillRect(-1.5, -2.5, 3, 1); ctx.fillRect(-1.5, 1, 3, 1);
      ctx.fillStyle = P[1]; ctx.fillRect(-1.5, -0.4, 4, 0.8); ctx.fillRect(2.5, -0.4, 1.5, 0.8);   // (vein and stem)
      ctx.restore(); continue;
    }
    else if (kind === 'sand') { const k = (now / (2400 + r * 1600) + r) % 1; x = VW - k * (VW + 40); y = (r2 * VH + Math.sin(now / 500 + i) * 6) % VH; sz = 1.3; col = '#e8c890'; a = 0.45; }
    else if (kind === 'embers') { const k = (now / (4000 + r * 3000) + r) % 1; x = (r2 * VW + Math.sin(now / 700 + i) * 12) % VW; y = VH - k * (VH + 20); sz = 1.4; col = i % 3 ? '#ff8a3a' : '#ffd27a'; a = (1 - k) * 0.9; ctx.globalCompositeOperation = 'lighter'; }
    else if (kind === 'steam') { const k = (now / (7000 + r * 4000) + r) % 1; x = (r2 * VW) % VW; y = VH - k * (VH + 60); a = 0.12 * (1 - k); col = '#e8e8f0'; ctx.beginPath(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.arc(x, y, 18 + k * 30, 0, Math.PI * 2); ctx.fill(); continue; }
    else if (kind === 'snow') {   // soft round flakes in two sizes, drifting and swaying; now and then a little star flake glints
      const k = (now / (8000 + r * 6000) + r) % 1; x = (r2 * VW + Math.sin(now / 1200 + i) * 14 + k * 30) % VW; y = k * (VH + 10) - 5;
      const big = i % 4 === 0, star = i % 9 === 4;
      ctx.globalAlpha = big ? 0.9 : 0.75; ctx.fillStyle = '#ffffff';
      if (star) { const g = 0.6 + 0.4 * Math.sin(now / 240 + i); ctx.globalAlpha = 0.95 * g; ctx.fillRect(x - 1.5, y - 0.4, 3, 0.8); ctx.fillRect(x - 0.4, y - 1.5, 0.8, 3); ctx.globalAlpha = 0.5 * g; ctx.fillRect(x - 1, y - 1, 2, 2); continue; }
      ctx.beginPath(); ctx.arc(x, y, big ? 1.3 : 0.8, 0, Math.PI * 2); ctx.fill();
      if (big) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }   // (a soft halo on the bigger ones)
      continue;
    }
    else if (kind === 'crystal' || kind === 'gold') {   // little four-point sparkles rising, each twinkling as it goes
      const k = (now / (6000 + r * 4000) + r) % 1; x = (r2 * VW + Math.sin(now / 900 + i) * 10) % VW; y = VH - k * VH; col = kind === 'gold' ? '#ffe08a' : '#bfe8ff';
      const tw = 0.5 + 0.5 * Math.sin(now / 260 + i * 2.1), L = (i % 3 ? 1.6 : 2.4) * (0.6 + 0.4 * tw);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(k * Math.PI) * (0.45 + 0.45 * tw); ctx.fillStyle = col;
      ctx.fillRect(x - L, y - 0.4, L * 2, 0.8); ctx.fillRect(x - 0.4, y - L, 0.8, L * 2); ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
      ctx.globalCompositeOperation = 'source-over'; continue;
    }
    else if (kind === 'wisps') {   // soft little streaks of cloud riding the wind
      const k = (now / (14000 + r * 8000) + r) % 1; x = k * (VW + 40) - 20; y = (r2 * VH + Math.sin(now / 1800 + i) * 8) % VH; a = Math.sin(k * Math.PI) * 0.55;
      const L = i % 3 ? 7 : 11, wg = ctx.createLinearGradient(x - L, 0, x + L, 0); wg.addColorStop(0, 'rgba(255,255,255,0)'); wg.addColorStop(0.5, `rgba(255,255,255,${a})`); wg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(x, y, L, i % 3 ? 1 : 1.5, 0, 0, Math.PI * 2); ctx.fill();
      continue;
    }   // the Skyreach Isles: pale motes on the wind, and no vignette (a dark rim round white cloud)
    else if (kind === 'spores') { const k = (now / (9000 + r * 5000) + r) % 1; x = (r2 * VW + Math.sin(now / 1500 + i) * 20) % VW; y = VH - k * VH; col = '#c8a0ff'; sz = 1.6; a = Math.sin(k * Math.PI) * 0.7; ctx.globalCompositeOperation = 'lighter'; }
    ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x, y, sz, sz);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  // soft vignette tinted to the land
  const tint = { embers: '60,10,0', steam: '30,20,10', snow: '20,30,60', crystal: '10,30,60', gold: '60,40,0', spores: '30,0,40', sand: '50,30,0' }[kind];
  if (tint) {
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
    vg.addColorStop(0, `rgba(${tint},0)`); vg.addColorStop(1, `rgba(${tint},0.45)`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }
}

// ---------------------------------------------------------------- the journey map (M)
const JOURNAL_MAP_BTN = { x: 12, y: 12, w: 118, h: 18 };   // on the journey map
function journeyMenu() { return { type: 'journey', t: 0 }; }
// the area dot nearest a point on the map (within 8 px), from the dots the last frame drew
const jmapDotAt = (m, x, y) => (m.dots || []).reduce((b, d) => { const r = Math.hypot(d.x - x, d.y - y); return r < 8 && (!b || r < b.r) ? { ...d, r } : b; }, null);
function updateJourneyMenu(game, m, dt) {
  m.t += dt;
  if (trialsOpen(game.profile) && (hit('KeyT') || clicked(...Object.values(TRIAL_MAP_BTN)))) { game.closeMenu(); game.openMenu(trialsMenu()); return; }
  if (hit('KeyJ') || clicked(...Object.values(JOURNAL_MAP_BTN))) { game.closeMenu(); game.openMenu(journalMenu(game)); return; }
  // a tap on an area dot shows its name instead of closing the map
  if (mouse.click && jmapDotAt(m, mouse.x, mouse.y)) { m.pick = jmapDotAt(m, mouse.x, mouse.y); return; }
  if (hit('Escape', 'KeyM', 'Tab') || (m.t > 200 && mouse.click)) game.closeMenu();
}
// The map is an old parchment chart (2026-11-20): one winding road runs from Hearthvale (bottom right) through every zone,
// each zone a painted lane with its own little ink drawings, the towns as house icons on the bends.
// Lanes snake: Verdant runs east to west, the next zone comes back the other way, and so on up the page.
// The map is painted art (assets/journey_map.jpg, made in Gemini from a prompt, 2026-11-20): five raised islands joined in a snake.
// The lanes, bends and towns below are measured on that picture (in 640x360 screen pixels); without it the map paints its own lands on the same layout.
const JMAP = { art: 'assets/journey_map.jpg', XL: 104, XR: 528, BL: 66, BR: 584, rows: [292, 234, 176, 120, 66],
    // each painted town: [x, y] of its houses, then where its name tag goes [x, y, align] (clear of the lanes' tags and the buttons)
  townAt: { Hearthvale: [553, 287, 566, 287, 'left'], Mossbrook: [74, 246, 74, 261, 'center'], Duskhollow: [556, 186, 556, 201, 'center'],
    Cloudhold: [76, 145, 76, 160, 'center'], 'Mirage Springs': [344, 59, 344, 75, 'center'], Frostmere: [94, 51, 82, 52, 'right'] },
  ink: '#5a3d1e', road: '#7a5328', unseen: '#e9dbb6', bg: null,
  // each zone's land: [lit top, middle, shade, cliff side]
  land: [['#d6eaa4', '#a9cb7c', '#7fa45a', '#5f7d41'], ['#d2c3e8', '#ab97cc', '#8670ad', '#5e4c80'], ['#dcedf8', '#abcfe8', '#82acd0', '#5f86aa'],
    ['#fbfdff', '#dde8f2', '#b4c8da', '#8aa0b6'], ['#f6e0aa', '#e2be7c', '#c69c58', '#946c34']],
  // each zone's drawings: [dark, middle, light]
  deco: [['#3f6a2c', '#5f9a42', '#9ccc6c'], ['#3e2c66', '#6a52a0', '#a68ad6'], ['#7f9fbf', '#e6f2fb', '#ffffff'],
    ['#6f88a2', '#c4d6e6', '#ffffff'], ['#a87634', '#dcb06a', '#f6dca0']] };
const jmapRowY = zi => JMAP.rows[zi] !== undefined ? JMAP.rows[zi] : 292 - zi * 56;
const jmapWave = (x, zi) => Math.sin(x / 46 + zi * 1.7) * 2.5;
function jmapNode(zi, i, n) {
  const t = n > 1 ? i / (n - 1) : 0.5, x = zi % 2 === 0 ? JMAP.XR - t * (JMAP.XR - JMAP.XL) : JMAP.XL + t * (JMAP.XR - JMAP.XL);
  return { x, y: jmapRowY(zi) + jmapWave(x, zi) };
}
function jmapRng(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// a lane's land outline: an oval with a gently ragged coast (the same seed gives the same coast every time)
function jmapBlob(g, x, y, w, h, seed, grow = 0) {
  const q = jmapRng(seed), k = []; for (let a = 0; a <= 48; a++) k.push(1 + (q() - 0.5) * 0.07 + Math.sin(a * 0.9 + seed) * 0.02);
  g.beginPath();
  for (let a = 0; a <= 48; a++) {
    const t = a / 48 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), sq = v => Math.sign(v) * Math.pow(Math.abs(v), 0.55);
    g.lineTo(x + sq(c) * (w / 2 * k[a] + grow), y + sq(s) * (h / 2 * k[a] + grow));
  }
  g.closePath();
}
// little drawings with a lit side, a shaded side and a soft shadow: 0 trees and hills, 1 pines, 2 clouds, 3 snowy peaks, 4 dunes and cacti
function jmapDeco(g, kind, x, y, s, q, P) {
  const [dk, md, lt] = P, sh = (w, h) => { g.fillStyle = 'rgba(40,24,8,0.22)'; g.beginPath(); g.ellipse(x + 2 * s, y + 1, w, h, 0, 0, 7); g.fill(); };
  if (kind === 0 && q() < 0.6) {
    sh(4 * s, 1.4 * s); g.fillStyle = '#6a4a2a'; g.fillRect(x - 0.6, y - 2 * s, 1.3, 3 * s);
    g.fillStyle = dk; g.beginPath(); g.arc(x, y - 4 * s, 3.4 * s, 0, 7); g.fill();
    g.fillStyle = md; g.beginPath(); g.arc(x - 0.8 * s, y - 4.8 * s, 2.6 * s, 0, 7); g.fill();
    g.fillStyle = lt; g.beginPath(); g.arc(x - 1.6 * s, y - 5.8 * s, 1.1 * s, 0, 7); g.fill();
  } else if (kind === 0) {
    g.fillStyle = dk; g.beginPath(); g.moveTo(x - 7 * s, y + 1); g.quadraticCurveTo(x, y - 7 * s, x + 7 * s, y + 1); g.fill();
    g.fillStyle = md; g.beginPath(); g.moveTo(x - 7 * s, y + 1); g.quadraticCurveTo(x - 2 * s, y - 6.4 * s, x + 1 * s, y - 2.6 * s); g.quadraticCurveTo(x - 2 * s, y - 1, x - 7 * s, y + 1); g.fill();
  } else if (kind === 1) {
    sh(3.5 * s, 1.2 * s); g.fillStyle = '#4a3428'; g.fillRect(x - 0.6, y - 1, 1.2, 2.5);
    g.fillStyle = dk; g.beginPath(); g.moveTo(x, y - 9 * s); g.lineTo(x + 3.6 * s, y); g.lineTo(x - 3.6 * s, y); g.fill();
    g.fillStyle = md; g.beginPath(); g.moveTo(x, y - 9 * s); g.lineTo(x, y); g.lineTo(x - 3.6 * s, y); g.fill();
    if (q() < 0.2) { g.fillStyle = '#fff2a0'; g.fillRect(x + 6 * s, y - 8 * s, 1.2, 1.2); }
  } else if (kind === 2) {
    g.fillStyle = 'rgba(60,90,130,0.28)'; g.beginPath(); g.ellipse(x + 1, y + 3 * s, 8 * s, 1.8 * s, 0, 0, 7); g.fill();
    const puff = (c, d) => { g.fillStyle = c; g.beginPath(); g.arc(x - 3 * s, y + d, 3 * s, 0, 7); g.arc(x + s, y - 2 * s + d, 4 * s, 0, 7); g.arc(x + 5 * s, y + d, 3 * s, 0, 7); g.fill(); };
    puff(dk, 0.8 * s); puff(md, 0); g.fillStyle = lt; g.beginPath(); g.arc(x, y - 3.4 * s, 2 * s, 0, 7); g.fill();
  } else if (kind === 3) {
    g.fillStyle = 'rgba(40,60,90,0.2)'; g.beginPath(); g.ellipse(x + 2 * s, y + 1, 7 * s, 1.4 * s, 0, 0, 7); g.fill();
    g.fillStyle = dk; g.beginPath(); g.moveTo(x, y - 8 * s); g.lineTo(x + 6.5 * s, y + 1); g.lineTo(x - 6.5 * s, y + 1); g.fill();
    g.fillStyle = md; g.beginPath(); g.moveTo(x, y - 8 * s); g.lineTo(x + 0.6 * s, y + 1); g.lineTo(x - 6.5 * s, y + 1); g.fill();
    g.fillStyle = lt; g.beginPath(); g.moveTo(x - 2.2 * s, y - 5.2 * s); g.lineTo(x, y - 8 * s); g.lineTo(x + 2.2 * s, y - 5.2 * s); g.lineTo(x + 1 * s, y - 5.8 * s); g.lineTo(x, y - 4.8 * s); g.lineTo(x - 1 * s, y - 5.8 * s); g.fill();
  } else if (q() < 0.72) {
    g.fillStyle = dk; g.beginPath(); g.moveTo(x - 8 * s, y + 1); g.quadraticCurveTo(x + 1 * s, y - 6 * s, x + 8 * s, y + 1); g.fill();
    g.fillStyle = lt; g.beginPath(); g.moveTo(x - 8 * s, y + 1); g.quadraticCurveTo(x - 2 * s, y - 5 * s, x + 1 * s, y - 2.4 * s); g.quadraticCurveTo(x - 1 * s, y - 0.5, x - 8 * s, y + 1); g.fill();
  } else {
    sh(3 * s, 1 * s); g.fillStyle = '#3f6e34'; g.fillRect(x - 0.9, y - 6 * s, 2, 6 * s); g.fillRect(x - 3 * s, y - 4 * s, 1.3, 2.6 * s); g.fillRect(x + 2 * s, y - 5 * s, 1.3, 2.6 * s);
    g.fillStyle = '#7cae5a'; g.fillRect(x - 0.9, y - 6 * s, 0.9, 6 * s);
  }
}
// the parchment, the raised lands and their drawings never change: painted once at full canvas size, then reused
function jmapBg() {
  if (JMAP.bg) return JMAP.bg;
  const c = document.createElement('canvas'); c.width = VW * 2; c.height = VH * 2; const g = c.getContext('2d'); g.scale(2, 2);
  const gr = g.createRadialGradient(VW / 2, VH / 2, 40, VW / 2, VH / 2, VW * 0.7); gr.addColorStop(0, '#efe0b8'); gr.addColorStop(1, '#dcc391');
  g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
  const q = jmapRng(7);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(110,70,30,${q() * 0.06})`; g.fillRect(q() * VW, q() * VH, 1 + q() * 2, 1 + q() * 2); }
  const W = JMAP.XR - JMAP.XL + 112, H = 40;
  // old-map coast ripples around every land first, so no ripple crosses a neighbour
  ZONES.forEach((Z, zi) => { const y = jmapRowY(zi); g.strokeStyle = 'rgba(90,58,24,0.16)'; g.lineWidth = 0.7; [4, 8].forEach(d => { jmapBlob(g, VW / 2, y + 2, W, H, 11 + zi, d); g.stroke(); }); });
  ZONES.forEach((Z, zi) => {
    const y = jmapRowY(zi), L = JMAP.land[zi % JMAP.land.length], P = JMAP.deco[zi % JMAP.deco.length];
    // a raised slab: a soft shadow, the cliff side, then the lit top with a darker south rim
    g.fillStyle = 'rgba(60,36,12,0.28)'; jmapBlob(g, VW / 2 + 3, y + 7, W, H, 11 + zi); g.fill();
    g.fillStyle = L[3]; jmapBlob(g, VW / 2, y + 4, W, H, 11 + zi); g.fill();
    g.save(); g.strokeStyle = 'rgba(30,18,6,0.25)'; g.lineWidth = 0.6;
    for (let x = VW / 2 - W / 2; x < VW / 2 + W / 2; x += 3) { g.beginPath(); g.moveTo(x, y + H / 2 - 4); g.lineTo(x - 1, y + H / 2 + 4); g.stroke(); }
    g.restore();
    jmapBlob(g, VW / 2, y, W, H, 11 + zi); const tg = g.createLinearGradient(0, y - H / 2, 0, y + H / 2);
    tg.addColorStop(0, L[0]); tg.addColorStop(0.45, L[1]); tg.addColorStop(1, L[2]); g.fillStyle = tg; g.fill();
    g.save(); jmapBlob(g, VW / 2, y, W, H, 11 + zi); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; jmapBlob(g, VW / 2, y + 2.5, W, H, 11 + zi); g.stroke();
    g.strokeStyle = 'rgba(40,20,0,0.18)'; g.lineWidth = 4; jmapBlob(g, VW / 2, y - 3, W, H, 11 + zi); g.stroke();
    // drawings, back to front so nearer ones overlap farther ones
    const pts = [];
    for (let i = 0; i < 80; i++) { const x = JMAP.XL - 30 + q() * (JMAP.XR - JMAP.XL + 60), yy = y - 16 + q() * 32; if (Math.abs(yy - (y + jmapWave(x, zi))) >= 7) pts.push([x, yy, 0.8 + q() * 0.5]); }
    pts.sort((a, b) => a[1] - b[1]).forEach(([x, yy, s]) => jmapDeco(g, zi % 5, x, yy, s, q, P));
    g.restore();
    g.strokeStyle = 'rgba(70,44,16,0.7)'; g.lineWidth = 0.8; jmapBlob(g, VW / 2, y, W, H, 11 + zi); g.stroke();
  });
  g.strokeStyle = 'rgba(90,58,24,0.8)'; g.lineWidth = 2; g.strokeRect(4, 4, VW - 8, VH - 8); g.lineWidth = 0.6; g.strokeRect(8, 8, VW - 16, VH - 16);
  const vg = g.createRadialGradient(VW / 2, VH / 2, VW * 0.35, VW / 2, VH / 2, VW * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,58,24,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
  return (JMAP.bg = c);
}
// each lane's stops nearest-town-first; a town inside a zone (Mirage Springs) is a stop on its lane, a town between zones sits on the bend
// the painted road, traced on the picture (screen pixels, Hearthvale first, the Sun Temple last): the dashed road and the area dots follow it
const JMAP_ROAD = [
  533.8, 295.8, 532.1, 296, 527.9, 296.5, 522.5, 296.7, 517.1, 296.7, 511.5, 296.3, 506, 295.6, 500.5, 294.7, 494.9, 293.8, 489.2, 293.1, 483.5, 292.7, 477.8, 292.6, 472.1, 292.8, 466.5, 293.1, 461.5, 293.2, 456.8, 292.7,
  451, 291.2, 444.6, 289.5, 438.6, 288.4, 433.1, 287.9, 427.5, 287.5, 421.8, 287.1, 416, 286.7, 410.7, 286.4, 405.9, 286.1, 400.4, 285.7, 394.4, 285.2, 388.9, 284.7, 383.4, 284.2, 377.9, 283.6, 371.9, 283.4, 365.8, 283.5,
  360.3, 283.9, 355.4, 283.8, 349.8, 283.5, 343.5, 283.3, 338.8, 283.3, 334.3, 283.4, 327.9, 283.4, 321.4, 283.4, 316.1, 283.6, 311.2, 283.9, 306, 284.5, 301.1, 285.2, 296.3, 285.9, 289.7, 286.9, 283.3, 287.8, 278.6, 288.3,
  272.8, 288.9, 266.3, 289.9, 261.1, 290.8, 256.9, 291, 252.2, 290.6, 246.4, 289.2, 240.2, 287.9, 234.2, 287.2, 228.6, 287, 223, 286.7, 216.9, 286.6, 211, 286.7, 205.6, 286.7, 199.8, 286.2, 193.2, 285.7, 187.2, 285.1,
  182.5, 284.6, 177.3, 284, 171.4, 283.8, 165, 283.7, 159.2, 283.7, 153.9, 283.6, 148.4, 283.7, 142.7, 284.1, 136.9, 284.9, 131.7, 285.4, 126.9, 285.5, 121.9, 284.7, 115.8, 283, 108.7, 282, 102, 282, 96.3, 281.9,
  92.1, 280.9, 88, 278.2, 83.7, 273.6, 80.6, 268.6, 79.1, 264, 79, 259.8, 79.9, 254.9, 82.5, 249.6, 86.7, 245.3, 92, 243.1, 97.5, 241.8, 102.5, 240.7, 106.9, 239.7, 111.8, 238.7, 117.8, 237.8, 123.7, 237,
  129, 236.4, 134.3, 235.8, 140.1, 235.2, 146, 235, 151.5, 235, 157.6, 235.5, 163.4, 236.2, 168.7, 236.7, 173.7, 236.5, 178.5, 236.1, 184, 235.6, 190.4, 235.3, 196.9, 235.3, 202.3, 235.4, 206.8, 235.2, 211.8, 235.1,
  217.9, 235, 223.7, 235, 229.5, 235, 235.1, 235, 241.3, 234.6, 247.4, 233.9, 252.2, 233.4, 256.4, 233.6, 262.1, 234.3, 268.9, 235.1, 275, 235.5, 280, 235.7, 285.3, 235.7, 291.4, 235.8, 297.1, 236, 301.6, 236.1,
  306.8, 235.7, 313, 235.3, 319, 235, 324.6, 235, 330.4, 235, 336.3, 234.9, 341.8, 234.8, 346.8, 234.8, 353, 234.6, 358.9, 234.4, 363.1, 234.5, 368.6, 234.7, 374.8, 234.9, 381, 235.2, 387.1, 235.8, 392.9, 236.1,
  398.3, 235.9, 403.2, 235.3, 408.6, 234.7, 414.3, 234.1, 419.2, 233.7, 425.1, 234.1, 431.4, 234.9, 436.3, 235.4, 441.7, 235.1, 447.8, 234.4, 453.8, 234.1, 459.4, 234.1, 465, 234, 470.6, 233.9, 476.3, 233.9, 481.9, 233.8,
  487.8, 233.4, 493.6, 233, 498.7, 232.5, 504.4, 232.1, 510.5, 231.8, 516.2, 231.4, 521.3, 230.5, 526.5, 229.5, 531.3, 228.1, 536.4, 226.3, 541.9, 223.8, 546.4, 221, 550.5, 216.7, 554.7, 210.3, 557.3, 204.1, 557.2, 199.9,
  556, 196, 554.1, 191.3, 551, 185.8, 547.1, 181.1, 542.8, 178.6, 538.3, 177.7, 532.6, 177.6, 526.2, 178.1, 521.1, 178.2, 516.6, 178.2, 512, 178.1, 506.8, 178.1, 500.2, 178.1, 494.2, 178.1, 489.9, 178.1, 484.6, 178.1,
  478.1, 178.1, 471.9, 178.1, 466.9, 178.1, 461.9, 178.1, 456.3, 178.1, 450.5, 178.1, 445, 178.1, 439.3, 178.1, 433.6, 178.1, 428.3, 178.1, 423.5, 178.1, 417.7, 178.1, 411.6, 178.1, 406.6, 178.1, 401.5, 178.1, 395.4, 178.1,
  388.5, 178.1, 382.5, 178.1, 378, 178.4, 373.8, 179.3, 369, 179.7, 362.6, 178.3, 355.9, 177.2, 350, 177, 344.2, 177.1, 337.6, 178.1, 331.3, 179.4, 326.9, 179.8, 322.3, 179.4, 316.5, 178.3, 310.2, 177.4, 304.5, 176.8,
  298.9, 176.4, 293.1, 176.3, 287.7, 176.5, 282.4, 177, 277.5, 177.6, 272.3, 178.1, 266, 178.3, 259.6, 178.3, 253.8, 178.3, 248.1, 178.4, 242.5, 178.4, 236.9, 178.5, 231.3, 178.5, 225.6, 178.6, 220, 178.7, 214.4, 178.7,
  208.8, 178.7, 203.2, 178.7, 197.7, 178.8, 192.1, 178.8, 186.6, 178.8, 181, 178.8, 175.5, 178.8, 169.9, 178.8, 164.1, 178.8, 158.1, 179.1, 152.2, 179.5, 146.6, 179.9, 140.9, 180.1, 135.7, 180, 130.5, 179.7, 124.7, 179.1,
  119, 178.3, 113.5, 177.4, 107.7, 176.1, 102.1, 174.2, 97.1, 172.2, 92.7, 170.1, 88.5, 167.4, 84.7, 163.3, 82.6, 158.8, 81.8, 154.8, 82, 149.8, 83.3, 144.5, 85.1, 139.6, 88.2, 134.5, 92.1, 130.4, 97.2, 128.2,
  102.5, 129.5, 105, 129, 110, 128, 115, 127, 120, 126, 125, 125.1, 130, 124.3, 135, 123.6, 140, 123.1, 145, 122.8, 150, 122.5, 155, 122.3, 160, 122, 165, 121.9, 170, 121.9, 175, 122,
  180, 122.1, 185, 122.4, 190, 122.8, 195, 123.3, 200, 123.8, 205, 124.3, 210, 124.7, 215, 125.1, 220, 125.4, 225, 125.6, 230, 125.6, 235, 125.6, 240, 125.3, 245, 124.9, 250, 124.2, 255, 123.1,
  260, 121.9, 265, 120.8, 270, 119.8, 275, 118.8, 280, 118, 285, 117.3, 290, 116.7, 295, 116.1, 300, 115.8, 305, 115.6, 310, 115.6, 315, 115.6, 320, 115.6, 325, 115.8, 330, 116.1, 335, 116.7,
  340, 117.4, 345, 118.4, 350, 119.2, 355, 119.9, 360, 120.3, 365, 120.6, 370, 120.6, 375, 120.3, 380, 119.4, 385, 118.2, 390, 117, 395, 116, 400, 115.2, 405, 114.5, 410, 114, 415, 113.5,
  420, 113, 425, 112.6, 430, 112.3, 435, 112, 440, 111.9, 445, 111.9, 450, 112, 455, 112.4, 460, 112.9, 465, 113.7, 470, 114.6, 475.1, 115.6, 480.2, 116.5, 485.4, 117.3, 490.6, 118.1, 495.8, 119,
  501, 119.8, 506.2, 120.5, 511.3, 121.1, 516.3, 121.6, 521.5, 121.8, 526.8, 121.4, 532.2, 120.3, 537.2, 118.5, 541.7, 116.3, 546, 113.6, 550.1, 110.2, 553.2, 106.1, 555.1, 101.4, 555.9, 96.3, 555.5, 91, 553.8, 86.3,
  551.3, 82.5, 547.8, 79.5, 543.8, 76.6, 539.1, 74, 534, 71.8, 528.9, 70.5, 524.1, 69.7, 519.3, 69.1, 514.5, 68.6, 509.8, 68.3, 505.1, 68.1, 500.3, 67.8, 495.5, 67.5, 490.5, 67.3, 485.3, 67.2, 480.2, 67,
  475, 66.8, 470, 66.6, 465, 66.4, 460, 66.1, 455, 65.9, 450, 65.8, 445, 65.9, 440, 66.2, 435, 66.5, 430, 67, 425, 67.6, 420, 68.3, 415, 69, 410, 69.6, 405, 70.1, 400, 70.6,
  395, 70.9, 390, 71.1, 385, 71.2, 380, 71.3, 375, 71.3, 370, 71.3, 365, 71.2, 360, 71.1, 355, 70.9, 350, 70.6, 345, 70.4, 340, 70.1, 335, 69.7, 330, 69.3, 325, 68.8, 320, 68.3,
  315, 67.7, 310, 67.1, 305, 66.4, 300, 65.8, 295, 65.4, 290.1, 65.1, 285.5, 64.8, 281, 64.3, 276.3, 63.6, 271.3, 62.9, 266.3, 62.1, 261.3, 61.4, 256.3, 60.7, 251.3, 60.1, 246.3, 59.7, 241.3, 59.3,
  236.3, 59, 231.3, 58.9, 226.3, 59, 221.3, 59.3, 216.3, 59.5, 211.3, 59.8, 206.3, 60, 201.3, 60.3, 196.3, 60.5, 191.3, 60.9, 186.3, 61.4, 181.3, 62, 176.3, 62.6, 171.3, 63.4, 166.3, 64, 161.3, 64.5,
  156.3, 64.8, 151.3, 64.8, 146.3, 64.4, 141.4, 63.8, 136.7, 62.9, 132.1, 61.6, 129.8, 60.8
];
// where each zone's lane runs along the traced road: the longest stretch near the lane's row, between the bends (by arc length)
function jmapRoadRuns() {
  if (JMAP.runs) return JMAP.runs;
  const n = JMAP_ROAD.length / 2, S = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(JMAP_ROAD[i * 2] - JMAP_ROAD[i * 2 - 2], JMAP_ROAD[i * 2 + 1] - JMAP_ROAD[i * 2 - 1]));
  const runs = ZONES.map((Z, zi) => {
    let best = null, st = -1;
    for (let i = 0; i <= n; i++) {
      const on = i < n && Math.abs(JMAP_ROAD[i * 2 + 1] - jmapRowY(zi)) <= 12 && JMAP_ROAD[i * 2] >= 118 && JMAP_ROAD[i * 2] <= 522;
      if (on && st < 0) st = i;
      if (!on && st >= 0) { if (!best || i - 1 - st > best[1] - best[0]) best = [st, i - 1]; st = -1; }
    }
    return best ? [S[best[0]], S[best[1]]] : null;
  });
  return (JMAP.runs = { S, runs });
}
// the point a given arc length along the traced road
function jmapRoadAt(d) {
  const { S } = jmapRoadRuns(); let i = 1;
  while (i < S.length - 1 && S[i] < d) i++;
  const k = S[i] > S[i - 1] ? Math.min(1, Math.max(0, (d - S[i - 1]) / (S[i] - S[i - 1]))) : 0;
  return { x: JMAP_ROAD[i * 2 - 2] + (JMAP_ROAD[i * 2] - JMAP_ROAD[i * 2 - 2]) * k, y: JMAP_ROAD[i * 2 - 1] + (JMAP_ROAD[i * 2 + 1] - JMAP_ROAD[i * 2 - 1]) * k };
}
function jmapLanes(art) {
  const E = REGIONS.slice().reverse(), lanes = ZONES.map(() => []), bends = [];
  E.forEach((R, j) => {
    if (R.zone >= 0) { lanes[R.zone].push({ R }); return; }
    const a = E[j - 1], b = E[j + 1];
    if (a && b && a.zone >= 0 && a.zone === b.zone) lanes[a.zone].push({ town: areaName(R), R });
    else if (a && b) bends[a.zone] = R;
  });
  const pts = [{ x: JMAP.XR + 22, y: jmapRowY(0), town: areaName(E[0]), R: E[0], end: true }];
  lanes.forEach((L, zi) => {
    const run = art && jmapRoadRuns().runs[zi];
    L.forEach((it, i) => { const p = run ? jmapRoadAt(run[0] + (run[1] - run[0]) * (L.length > 1 ? i / (L.length - 1) : 0.5)) : jmapNode(zi, i, L.length); it.x = p.x; it.y = p.y; pts.push(it); });
    if (zi < lanes.length - 1) { const B = bends[zi]; pts.push({ x: zi % 2 === 0 ? JMAP.BL : JMAP.BR, y: (jmapRowY(zi) + jmapRowY(zi + 1)) / 2, town: B ? areaName(B) : null, R: B, bend: true }); }
  });
  const e = pts[pts.length - 1], zl = lanes.length - 1, W = E[E.length - 1];
  pts.push({ x: zl % 2 === 0 ? JMAP.XL - 12 : JMAP.XR + 12, y: e.y - 4, town: areaName(W), R: W, end: true });
  return { lanes, pts };
}
function jmapTag(str, x, y, col, align = 'center') {
  const w = textW(str, 7) + 6, x0 = align === 'left' ? x - 3 : align === 'right' ? x - w + 3 : x - w / 2;
  ctx.fillStyle = 'rgba(22,14,30,0.8)'; rrect(ctx, x0, y - 6, w, 12, 3); ctx.fill(); text(str, x, y, col, 7, align);
}
// a town: two little cottages drawn with a lit front, a shaded side, a two-sided roof, a chimney and a warm window
function jmapCottage(x, y, s, roof) {
  const ink = JMAP.ink, fw = 7 * s, sw = 3.5 * s, wh = 5.5 * s, rh = 5 * s;
  ctx.fillStyle = 'rgba(40,24,8,0.3)'; ctx.beginPath(); ctx.ellipse(x + sw / 2 + 1, y + 1, fw * 0.8, 1.8 * s, 0, 0, 7); ctx.fill();
  // side wall (in shade), then the front wall
  ctx.fillStyle = '#c9b48c'; ctx.beginPath(); ctx.moveTo(x + fw / 2, y); ctx.lineTo(x + fw / 2 + sw, y - sw * 0.5); ctx.lineTo(x + fw / 2 + sw, y - wh - sw * 0.5); ctx.lineTo(x + fw / 2, y - wh); ctx.fill();
  ctx.fillStyle = '#f6ecd2'; ctx.fillRect(x - fw / 2, y - wh, fw, wh);
  ctx.fillStyle = '#7a5530'; ctx.fillRect(x - 1 * s, y - 3 * s, 2 * s, 3 * s);
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(x + fw / 2 + sw * 0.35, y - wh * 0.7 - sw * 0.25, 1.4 * s, 1.4 * s);
  // the roof: the gable front, the long slope going back
  ctx.fillStyle = roof[1]; ctx.beginPath(); ctx.moveTo(x, y - wh - rh); ctx.lineTo(x + sw, y - wh - rh - sw * 0.5); ctx.lineTo(x + fw / 2 + sw + 1, y - wh - sw * 0.5 + 0.5); ctx.lineTo(x + fw / 2 + 1, y - wh + 0.5); ctx.fill();
  ctx.fillStyle = roof[0]; ctx.beginPath(); ctx.moveTo(x - fw / 2 - 1, y - wh + 0.5); ctx.lineTo(x, y - wh - rh); ctx.lineTo(x + fw / 2 + 1, y - wh + 0.5); ctx.fill();
  ctx.fillStyle = '#8a6a50'; ctx.fillRect(x + sw * 0.9, y - wh - rh - 0.5, 1.6 * s, 3 * s);
  ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.strokeRect(x - fw / 2, y - wh, fw, wh);
}
function jmapHouse(x, y) {
  ctx.fillStyle = 'rgba(246,236,210,0.6)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 15, 5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(90,58,24,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
  jmapCottage(x + 7, y - 2, 1.05, ['#5a7aa8', '#3e5a80']);
  jmapCottage(x - 3, y + 4, 1.4, ['#d0584e', '#9a3a34']);
}
function drawJourneyMenu(game, m, now) {
  const pr = game.profile, w = game.outside || game.world, ow = w && w.overworld ? w : null, here = ow ? REGIONS[ow.region] : null;
  const A = img(JMAP.art), art = !!(A && A.complete && A.naturalWidth);
  if (art) { ctx.fillStyle = '#efe0bc'; ctx.fillRect(0, 0, VW, VH); ctx.drawImage(A, 0, 0, VW, VH); } else ctx.drawImage(jmapBg(), 0, 0, VW, VH);
  const { lanes, pts } = jmapLanes(art);
  // the road: a pale under-stroke, then dashed ink
  // on the painted map the dashes run down the middle of its own road (the traced line); without it, a road through the lanes and bends
  const path = () => {
    ctx.beginPath();
    if (art) { for (let i = 0; i < JMAP_ROAD.length; i += 2) { if (i) ctx.lineTo(JMAP_ROAD[i], JMAP_ROAD[i + 1]); else ctx.moveTo(JMAP_ROAD[i], JMAP_ROAD[i + 1]); } return; }
    pts.forEach((p, i) => { const a = pts[i - 1]; if (!i) ctx.moveTo(p.x, p.y); else if (p.bend) ctx.quadraticCurveTo(p.x, a.y, p.x, p.y); else if (a.bend) ctx.quadraticCurveTo(a.x, p.y, p.x, p.y); else ctx.lineTo(p.x, p.y); });
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (!art) { ctx.strokeStyle = 'rgba(255,248,224,0.7)'; ctx.lineWidth = 5; path(); ctx.stroke(); }
  ctx.strokeStyle = JMAP.road; ctx.lineWidth = art ? 1.6 : 2.2; ctx.setLineDash(art ? [4, 3] : [5, 3]); path(); ctx.stroke(); ctx.setLineDash([]);
  const stones = ow && typeof midStones === 'function' ? midStones(ow) : [], got = pr.travelPts || {};
  const goal = ow && ow.storyGoal ? REGIONS[regionIndexAt(ow.storyGoal.x)] : null, pulse = 0.5 + 0.5 * Math.sin(now / 200);
  // Labels never overlap (the user: "to many words are overlapping"). What must show claims its box first: YOU, the marker plates, NEXT,
  // the town names and the lanes' tags. A visited area's name then takes the first free row of three under its dot, or else stays
  // hidden until the pointer rests on (or a tap lands on) its dot, which shows the name in a tag.
  const marks = [], occ = [], tagQ = [], names = [], dots = [];
  const tagBox = (str, x, y, align) => { const w = textW(str, 7) + 6, x0 = align === 'left' ? x - 3 : align === 'right' ? x - w + 3 : x - w / 2; return [x0, y - 6, x0 + w, y + 6]; };
  const hits = b => occ.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const townOf = w && !ow && w.name ? String(w.name) : null;
  const towns = pts.filter(p => p.town).map(p => {
    // the painted map has its own houses: the name goes on them; without the art, the map draws its own cottages
    const at = art && JMAP.townAt[p.town], x = at ? at[0] : p.x, y = at ? at[1] : p.y;
    const tx = at ? at[2] : x, ty = at ? at[3] : y + (p.bend ? 15 : -20), align = at ? at[4] : x < 30 ? 'left' : x > VW - 30 ? 'right' : 'center';
    occ.push(tagBox(p.town, tx, ty, align));
    return { p, at, x, y, tx, ty, align, cur: (here && p.R === here) || (townOf && townOf === p.town) };
  });
  ZONES.forEach((Z, zi) => {
    const L = zoneAreas(zi), lane = lanes[zi], left = zi % 2 === 0;
    if (!lane.length) return;
    lane.forEach(it => {
      if (it.town) return;
      const R = it.R, i = L.indexOf(R), x = it.x, y = it.y, seen = pr.seen && pr.seen[R.key], cur = here === R, haven = typeof isGoddessTown === 'function' && isGoddessTown(R);
      if (haven) { ctx.fillStyle = 'rgba(255,184,224,0.4)'; ctx.beginPath(); ctx.arc(x, y, 8.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = seen ? (cur ? '#ffffff' : rankColor(Z.ranks[0] + Math.round(i / Math.max(1, L.length - 1) * (Z.ranks[1] - Z.ranks[0])), now)) : JMAP.unseen;
      ctx.beginPath(); ctx.arc(x, y, cur ? 5.5 : seen ? 4 : 5, 0, 7); ctx.fill(); ctx.strokeStyle = JMAP.ink; ctx.lineWidth = 1; ctx.stroke();
      dots.push({ x, y, name: seen ? areaName(R) : 'Not visited yet' });
      if (cur) { text('YOU', x, y + 12, '#ffffff', 7); occ.push([x - 9, y + 8.5, x + 9, y + 15.5]); ctx.strokeStyle = `rgba(255,255,255,${pulse})`; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.stroke(); }
      else if (seen) names.push({ nm: areaName(R), x, y, i, pri: haven || (goal && goal === R) ? 0 : 1 });
      else text('?', x, y + 0.5, '#8a6a44', 7);
      // markers go on in a second pass, over everything else
      const S = stones.find(q => q.z === zi && q.k === i);
      if (S) occ.push([x - 14, y - 18, x + 14, y - 6]);
      if (goal && goal === R) occ.push([x - 22, (S ? y - 26 : y - 18) - 8, x + 22, (S ? y - 26 : y - 18) + 8]);
      marks.push(() => {
        // travel point and shrine on a dark pill so they read over the painted map; lit ones glow, unlit ones stay a soft grey
        if (S) {
          const lit = !!got[S.key];
          ctx.fillStyle = 'rgba(22,14,30,0.85)'; rrect(ctx, x - 14, y - 18, 28, 12, 5); ctx.fill();
          ctx.strokeStyle = lit ? 'rgba(143,232,255,0.8)' : 'rgba(200,190,170,0.5)'; ctx.lineWidth = 0.8; rrect(ctx, x - 14, y - 18, 28, 12, 5); ctx.stroke();
          text('◆', x - 6, y - 12, lit ? TP.col : '#a8b4c4', 8); text('✿', x + 6, y - 12, lit ? '#ffb8e0' : '#c8aec0', 8);
        }
        if (goal && goal === R) {
          const b = Math.sin(now / 220) * 1.5;
          jmapTag('★ NEXT', x, (S ? y - 26 : y - 18) + b, '#ffd860');
          ctx.strokeStyle = 'rgba(255,216,96,0.95)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 8 + b * 0.5, 0, 7); ctx.stroke();
        }
      });
    });
    // the zone's name where its lane begins, its Guardian (or the desert's Sun Temple) where it ends
    const s0 = lane[0], e = lane[lane.length - 1], ms = pr.milestones && pr.milestones[zi], cl = pr.cleared && pr.cleared[zi];
    tagQ.push([`${CHAPTER[zi] || ''} · ${Z.name}   ranks ${RANKS[Z.ranks[0]]}–${RANKS[Z.ranks[1]]}`, s0.x, jmapRowY(zi) - 23, '#ffe9a8', left ? 'right' : 'left']);
    if (typeof DESERT !== 'undefined' && zi === DESERT.zone) tagQ.push(['☀ the Sun Temple', e.x, e.y - 23, '#ffd27a', left ? 'left' : 'right']);
    else tagQ.push([cl ? (ms ? `✔ Guardian · ${fmtPlay(ms.ms)} (Lv ${ms.lv})` : '✔ Guardian') : `☠ Guardian · Lv ${GUARDIAN_LV[zi]}`, e.x, e.y - 23, cl ? '#8fffd0' : '#ff9a9a', left ? 'left' : 'right']);
  });
  tagQ.forEach(([str, x, y, col, align]) => {
    // first up or down a little, then along the lane (toward its middle) if that is still crowded
    const inward = align === 'right' ? -1 : 1, tries = [];
    [0, 20, 40, 60, 80, 100, 120, 140, 160].forEach(dx => [0, -4, 4, -8, 8, -12].forEach(dy => tries.push([dx * inward, dy])));
    const t = tries.find(([dx, dy]) => !hits(tagBox(str, x + dx, y + dy, align))) || [0, 0];
    occ.push(tagBox(str, x + t[0], y + t[1], align)); jmapTag(str, x + t[0], y + t[1], col, align);
  });
  // visited names: Havens and the story goal first, then the rest along the road; each takes the first free row, or waits for the pointer
  names.sort((a, b) => a.pri - b.pri).forEach(n => {
    const nw = textW(n.nm, 7) / 2 + 2, rows = [n.i % 3, (n.i + 1) % 3, (n.i + 2) % 3].map(k => n.y + 11 + k * 8);
    const ny = rows.find(v => !hits([n.x - nw, v - 4, n.x + nw, v + 4]));
    if (ny === undefined) return;
    occ.push([n.x - nw, ny - 4, n.x + nw, ny + 4]); text(n.nm, n.x, ny, '#f4ecdc', 7);
  });
  marks.forEach(f => f());
  towns.forEach(t => {
    if (!t.at) jmapHouse(t.x, t.y);
    jmapTag(t.p.town, t.tx, t.ty, t.cur ? '#ffffff' : '#fff1c8', t.align);
    if (t.cur) { ctx.strokeStyle = `rgba(255,255,255,${pulse})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(t.x, t.y - 3, 15, 0, 7); ctx.stroke(); }
  });
  m.dots = dots;
  // a compact title plate, so the top lane's name and Mirage Springs stay in view
  ctx.fillStyle = 'rgba(20,12,30,0.85)'; rrect(ctx, VW / 2 - 86, 5, 172, 33, 6); ctx.fill();
  goldTitle('THE JOURNEY', VW / 2, 16, 14, now);
  text('From Hearthvale to the end of the world', VW / 2, 31, '#e6d6b0', 7);
  // in a town, a house or a cave: say so under the title
  if (!(here && here.zone >= 0)) jmapTag(`YOU ARE IN ${String((w && w.name) || 'Hearthvale').toUpperCase()}`, VW / 2, 45, '#ffffff');
  { const B = JOURNAL_MAP_BTN; ctx.fillStyle = '#3a2a5a'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill(); text('★ Story Journal (J)', B.x + B.w / 2, B.y + 9, '#ffe9a8', 7.5); }
  if (trialsOpen(pr)) { const B = TRIAL_MAP_BTN; ctx.fillStyle = '#7a5a14'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill(); text('☀ Trials (T)', B.x + B.w / 2, B.y + 9, '#ffe9a8', 8); }
  ctx.fillStyle = 'rgba(20,12,30,0.85)'; rrect(ctx, 40, VH - 31, VW - 80, 27, 5); ctx.fill();
  text('◆ travel point   ✿ goddess shrine   ★ next story goal   ? not visited yet   ·   point at or tap a dot for its name', VW / 2, VH - 24, '#d8ccb0', 7);
  text(`Playtime ${fmtPlay(pr.playMs || 0)} (today ${fmtShort(playTodayMs(pr))})   ·   Landmarks ${Object.keys(pr.landmarks || {}).length}${w && w.landmarks ? '/' + w.landmarks.length : ''}   ·   Fall in battle and you wake at home in Hearthvale   ·   M / Esc: close`, VW / 2, VH - 12, '#d8ccb0', 7);
  // the dot under the pointer (or the last one tapped) shows its name, ringed in gold
  const pick = jmapDotAt(m, mouse.x, mouse.y) || m.pick;
  if (pick) { ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(pick.x, pick.y, 7.5, 0, 7); ctx.stroke(); jmapTag(pick.name, pick.x, pick.y + 14, '#ffffff'); }
}
