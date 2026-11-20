'use strict';
// Things happening in the Wilds, so no two trips feel the same.
//  · Rare monsters: about 1 in 20 is SHINY (gold, drops a card for sure, triple gold), about 1 in 25 a GIANT
//    (bigger, 2.5× HP, triple EXP).
//  · Zone events, one every 1–2½ minutes while you are out in the Wilds (each announced with a banner, tracked on the
//    HUD under the clock):
//      MONSTER HORDE   a pack of one kind pours in nearby; clear it for a reward pile
//      TREASURE RUNNER a golden creature that flees — catch it before it escapes (40 s) for a fortune
//      WANDERING ELITE a much stronger roamer with a red aura; drops gear like a mini boss
//      METEOR SHOWER   marked spots get hit for 20 s (anyone standing there is hurt); impacts leave loot
//      HEALING SPRING  a glowing pool appears for 45 s: stand in it to heal and hit harder

const EVT = { gapMin: 60000, gapMax: 150000 };
const EVENT_KINDS = [
  [1.2, 'horde', 'MONSTER HORDE', 'A pack pours in — clear it for a reward'],
  [1.0, 'runner', 'TREASURE RUNNER', 'A golden creature flees with a fortune — catch it!'],
  [1.0, 'elite', 'WANDERING ELITE', 'Something strong is roaming nearby'],
  [0.8, 'meteor', 'METEOR SHOWER', 'Stars are falling — keep off the marks, pick up what they leave'],
  [0.8, 'spring', 'HEALING SPRING', 'A spring wells up nearby — stand in it to heal and grow stronger'],
];

// a fresh monster rolls for a rare variant (called by spawnMonster)
function rollVariant(m) {
  const r = Math.random();
  if (r < 0.05) { m.shiny = true; m.maxHp = m.hp = Math.round(m.maxHp * 1.5); }
  else if (r < 0.09) { m.giant = true; m.scale = (m.scale || 1) * 1.45; m.maxHp = m.hp = Math.round(m.maxHp * 2.5); m.atk *= 1.3; m.heavy = true; }
}
const VARIANT_FILTER = { shiny: 'sepia(0.8) saturate(3) hue-rotate(-12deg) brightness(1.25) drop-shadow(0 0 2px #ffd23f)', elite: 'drop-shadow(0 0 2px #ff3a3a) drop-shadow(0 0 4px #ff3a3a)' };

function wildsHere(w) { const p = w.player; return w.overworld && !w.interior && !inTown(p.x) && regionAt(p.x) && regionAt(p.x).zone >= 0; }
// an open spot near the hero, out of sight but not far
// room for the spring: not on a bridge or against a river
const spotClear = (x, y) => { const tx = x / T, ty = y / T, P = SPRING; return !inRiverAt(x, y) && !inRiverAt(x - P.river, y) && !inRiverAt(x + P.river, y) && !WILDS.bridges.some(b => b && tx >= b.x0 - P.bridge && tx <= b.x1 + P.bridge && ty >= b.y - P.bridge && ty <= b.y + bridgeRows(b) + P.bridge); };
function eventSpot(w, dmin, dmax) {
  const p = w.player;
  for (let k = 0; k < 60; k++) {
    const a = Math.random() * Math.PI * 2, d = rand(dmin, dmax), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.7;
    if (mapReach(w.map, x, y) && !w.blocked(x, y) && !w.blocked(x, y - 12) && !inTown(x) && spotClear(x, y) && SPRING.room.every(([dx, dy]) => !w.blocked(x + dx, y + dy))) return { x, y };
  }
  return null;
}
// the zone's monsters (an event remembers the area it started in, so walking into town mid-event is fine)
function zoneMobs(w, R = (w.event && w.event.R) || regionAt(w.player.x)) { const Z = ZONES[R.zone]; return { R, Z, pool: Z.mobs.concat(Z.mobs2 || []).filter(id => D.monsters[id]), rank: areaRank(R) }; }

function updateZoneEvents(game, w, dt) {
  if (!w.overworld || w.interior) return;
  const E = w.event;
  if (E) { tickEvent(game, w, E, dt); return; }
  w.eventT = (w.eventT == null ? rand(30000, 60000) : w.eventT) - dt;
  if (w.eventT > 0 || !wildsHere(w)) return;
  w.eventT = rand(EVT.gapMin, EVT.gapMax);
  let r = Math.random() * EVENT_KINDS.reduce((t, k) => t + k[0], 0), K = EVENT_KINDS[0];
  for (const k of EVENT_KINDS) { r -= k[0]; if (r <= 0) { K = k; break; } }
  startEvent(game, w, K);
}
// a spring beside the hero, on demand (the Developer panel)
function devSpring(game, w) {
  const p = w.player, at = devOpenSpot(w, p.x + 76, p.y + 20);
  w.event = { kind: 'spring', title: 'HEALING SPRING', t: 0, R: regionAt(p.x), x: at.x, y: at.y, dur: 45000, r: 34 };
}
function startEvent(game, w, K) {
  const { R, pool, rank } = zoneMobs(w, regionAt(w.player.x)), E = { kind: K[1], title: K[2], t: 0, R };
  const spot = eventSpot(w, 160, 260); if (!spot) return;
  E.x = spot.x; E.y = spot.y;
  if (E.kind === 'horde') {
    const sp = pick(pool); E.left = 0; E.ids = [];
    for (let i = 0; i < 12; i++) { const s = eventSpot(w, 140, 280); if (!s) continue; const m = makeMonster(sp, rank, s.x, s.y);
      Object.assign(m, { region: R.zone, area: R.key, home: { x: s.x, y: s.y }, horde: true }); w.actors.push(m); E.left++; w.rings.push({ x: s.x, y: s.y, r: 14, t: -i * 50, col: '#ff8a5a' }); }
    E.sub = `${E.left} ${SPECIES[sp].name} — clear them all`;
  } else if (E.kind === 'runner') {
    const fast = pool.slice().sort((a, b) => SPECIES[b].spd - SPECIES[a].spd)[0];
    const m = makeMonster(fast, rank, spot.x, spot.y);
    Object.assign(m, { region: R.zone, area: R.key, home: { ...spot }, runner: true, shiny: true, scale: (m.scale || 1) * 1.15 });
    m.maxHp = m.hp = Math.round(m.maxHp * 3); w.actors.push(m); E.mon = m; E.dur = 40000;
  } else if (E.kind === 'elite') {
    const sp = pool.slice().sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[Math.floor(Math.random() * 3)] || pick(pool);
    const m = makeMonster(sp, Math.min(9, rank + 2), spot.x, spot.y);
    Object.assign(m, { region: R.zone, area: R.key, home: { ...spot }, eliteEvt: true, scale: (m.scale || 1) * 1.35, heavy: true });
    m.maxHp = m.hp = Math.round(m.maxHp * 4); m.atk *= 1.4; w.actors.push(m); E.mon = m;
  } else if (E.kind === 'meteor') { E.dur = 20000; E.next = 600; E.marks = []; }
  else if (E.kind === 'spring') { E.dur = 45000; E.r = 34; }
  w.event = E;
  game.banner = { kind: 'event', title: `✦ ${E.title} ✦`, sub: E.sub || K[3], t: 0, dur: 3200 };
  w.shake = Math.max(w.shake || 0, 3);
}
function endEvent(game, w, E, msg, col) { w.event = null; if (msg) game.toast(msg, col || '#ffe9a8'); }
function tickEvent(game, w, E, dt) {
  E.t += dt;
  const p = w.player;
  if (E.kind === 'horde') {
    if (E.left <= 0) {   // cleared: a reward pile where the last one fell
      const at = E.lastAt || p, { rank } = zoneMobs(w);
      w.drops.push({ kind: 'card', item: makeCard(pick(zoneMobs(w).pool), rareGate(Math.min(9, rank + 1))), x: at.x - 10, y: at.y });
      w.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rareGate(Math.min(9, rank + 1)), game.profile.cls), x: at.x + 10, y: at.y });
      w.drops.push({ kind: 'goods', item: makeGoods(rank), x: at.x, y: at.y + 8 });
      game.gainExp(killExp(rank) * 8);
      endEvent(game, w, E, 'HORDE CLEARED! A reward pile drops', '#ffd23f'); return;
    }
    if (Math.hypot(E.x - p.x, E.y - p.y) > 1600) endEvent(game, w, E, 'The horde scatters…', '#c9c1a8');
  } else if (E.kind === 'runner') {
    const m = E.mon;
    if (!m || m.dead || m.remove) { if (m && m.dead) {} endEvent(game, w, E); return; }
    const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < 260 && m.state !== 'air' && m.state !== 'hurt') { m.vx = dx / d * 120; m.vy = dy / d * 120; m.dir = dirTo(dx, dy); }   // it flees
    if (Math.random() < 0.04) w.particles.push({ x: m.x + rand(-6, 6), y: m.y - 10, vx: 0, vy: -20, t: 0, life: 500, col: '#ffd23f' });
    if (E.t > E.dur) { m.remove = true; endEvent(game, w, E, 'The treasure runner got away…', '#c9c1a8'); }
  } else if (E.kind === 'elite') {
    const m = E.mon;
    if (!m || m.dead || m.remove) { endEvent(game, w, E); return; }
    if (Math.hypot(m.x - p.x, m.y - p.y) > 2000) { m.remove = true; endEvent(game, w, E); }
  } else if (E.kind === 'meteor') {
    E.next -= dt;
    if (E.next <= 0 && E.t < E.dur) {
      E.next = rand(500, 900);
      const s = eventSpot(w, 20, 230); if (s) E.marks.push({ x: s.x, y: s.y, t: 0 });
    }
    for (const mk of E.marks) {
      mk.t += dt;
      if (!mk.hit && mk.t > 1200) {   // impact: hurts everyone standing on the mark, leaves something behind
        mk.hit = true;
        w.fx.push(fxAt(FX.METEOR, mk.x, mk.y, 1.1)); w.fx.push(fxAt(FX.EXPLODE + 2, mk.x, mk.y, 1.2, { delay: 120 }));
        w.rings.push({ x: mk.x, y: mk.y, r: 34, t: 0, col: '#ff9a3a' }); w.shake = Math.max(w.shake || 0, 4);
        for (const a of w.actors) if ((a.kind === 'monster' || a === p) && !a.dead && !a.ally && Math.hypot(a.x - mk.x, (a.y - mk.y) * 1.3) < 30) {
          const dmg = Math.round(a.maxHp * (a === p ? 0.12 : 0.25)); a.hp = Math.max(a === p ? 1 : 0, a.hp - dmg); floatText(w, a.x, a.y - 36, String(dmg), '#ff9a3a', 9);
          if (a.hp <= 0 && a.kind === 'monster') { a.hp = 0; a.dying = true; }
        }
        const r = Math.random();
        if (r < 0.3) w.drops.push({ kind: 'goods', item: makeGoods(zoneMobs(w).rank), x: mk.x, y: mk.y });
        else if (r < 0.4) w.drops.push({ kind: 'coin', item: { tier: 9 }, x: mk.x, y: mk.y });
      }
    }
    E.marks = E.marks.filter(mk => mk.t < 1800);
    if (E.t > E.dur && !E.marks.length) endEvent(game, w, E, 'The meteor shower passes', '#ffe9a8');
  } else if (E.kind === 'spring') {
    if (Math.hypot(p.x - E.x, (p.y - E.y) * 1.4) < E.r && !p.dead) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.03 * dt / 1000); if (p.maxMp) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.03 * dt / 1000);
      p.buffAtk = Math.max(p.buffAtk || 0, 1500);
      if (Math.random() < 0.15) w.particles.push({ x: p.x + rand(-8, 8), y: p.y - rand(0, 20), vx: 0, vy: -30, t: 0, life: 600, col: '#8fffd0' });
    }
    if (E.t > E.dur) endEvent(game, w, E, 'The spring sinks back into the earth', '#9fd8ff');
  }
}
// a kill: event bookkeeping and rare-variant loot (called from onMonsterKill)
function eventKill(game, w, m) {
  const E = w.event;
  if (m.horde && E && E.kind === 'horde') { E.left--; E.lastAt = { x: m.x, y: m.y }; E.sub = `${Math.max(0, E.left)} left`; }
  if (m.shiny) {
    w.drops.push({ kind: 'card', item: makeCard(m.sp, rareGate(Math.min(9, m.tier + (m.runner ? 2 : 0)))), x: m.x, y: m.y });
    gainGold(game, w, m, m.runner ? 12 : 3);
    if (m.runner) { w.drops.push({ kind: 'coin', item: { tier: 9 }, x: m.x + 8, y: m.y }); w.drops.push({ kind: 'gear', item: makeGear(pick(GEAR_SLOTS), rareGate(Math.min(9, m.tier + 1)), game.profile.cls), x: m.x - 8, y: m.y });
      game.toast('TREASURE RUNNER CAUGHT! A fortune spills out', '#ffd23f'); }
  }
  if (m.giant) game.gainExp(killExp(m.tier) * 2);
  if (m.eliteEvt) { miniBossLoot(game, w, m); game.toast('The wandering elite falls!', '#ffd23f'); }
}
// the healing spring: a real little pond, drawn pixel by pixel once and kept. A ring of stones, shallow water at its edge,
// deep water and a bright well at its heart, lily pads, all in the art. Over it,
// green crosses rising. It wells up out of the ground as the event starts and sinks back as it ends.
const SPRING = { w: 120, h: 62, cy: 30, rx: 40, ry: 16, light: { h: 190, lean: 0.22, step: 3, top: 5, alpha: 0.27, col: [255, 246, 205], moon: [118, 166, 255], shafts: [[-20, 3, 22, 1], [6, -3, 28, 1.15], [28, 4, 15, 0.8]], motes: 10 }, shapes: [[0, 0, 50, 21], [-16, 4, 30, 15], [18, -3, 28, 14]], lily: 'assets/spring_lily.png', lw: 18, lh: 14, pads: [[-34, 7, 0], [-20, 11, 1], [22, -11, 2]], crosses: 12, river: 70, bridge: 7, room: [[46, 0], [-46, 0], [24, 14], [-24, 14], [24, -14], [-24, -14]] };
// the pond itself is the game's own: Zenonia 2's bright water that every river and lake uses (waterRef, world.js), with the
// zone's wet edge and foam line, in square pixels. The light at its heart and the lily pads are sprites on top.
const springArt = (() => { const cache = {}; return z => {
  if (cache[z]) return cache[z];
  const P = SPRING, W = waterRef(); if (!W) return null;
  const c = document.createElement('canvas'); c.width = P.w; c.height = P.h; const g = c.getContext('2d'), rim = (ZONE_THEMES[z] || ZONE_THEMES[0]).waterRim, pat = g.createPattern(W.tile, 'repeat');
  const cx = P.w / 2, inside = (x, y, d) => P.shapes.some(([sx, sy, rx, ry]) => ((x + 0.5 - cx - sx) / (rx + d)) ** 2 + ((y + 0.5 - P.cy - sy) / (ry + d)) ** 2 <= 1);
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    if (!inside(x, y, 2)) continue;
    if (!inside(x, y, 0)) { g.fillStyle = rim[0]; g.fillRect(x, y, 1, 1); continue; }
    g.fillStyle = pat; g.fillRect(x, y, 1, 1);
    if (!inside(x, y, -1.5)) { g.fillStyle = rim[1]; g.fillRect(x, y, 1, 1); }
  }
  return (cache[z] = c);
}; })();
function drawSpringPond(E, now) {
  const P = SPRING, im = springArt(E.R && E.R.zone >= 0 ? E.R.zone : 0), lily = img(P.lily), k = Math.min(1, E.t / 600, (E.dur - E.t) / 800), sc = 0.72 + 0.28 * k, W = P.w * sc, H = P.h * sc, sm = ctx.imageSmoothingEnabled, x = Math.round(E.x), y = Math.round(E.y);
  ctx.save(); ctx.globalAlpha = k; ctx.imageSmoothingEnabled = false; if (im) ctx.drawImage(im, Math.round(x - W / 2), Math.round(y - P.cy * sc), W, H);
  if (lily && lily.complete && lily.naturalWidth) for (const [dx, dy, i] of P.pads) ctx.drawImage(lily, i * P.lw, 0, P.lw, P.lh, Math.round(x + dx * sc - P.lw / 2), Math.round(y + dy * sc - P.lh / 2), P.lw, P.lh);
  ctx.imageSmoothingEnabled = sm;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < P.crosses; i++) { const q = ((now / 1700) + i / P.crosses) % 1, px = Math.round(x + Math.sin(i * 2.3) * P.rx * 0.7), py = Math.round(y + Math.cos(i * 1.7) * P.ry * 0.5 - q * 46); ctx.globalAlpha = k * Math.sin(q * Math.PI); ctx.fillStyle = i % 3 ? '#8fffc0' : '#ffffff'; ctx.fillRect(px - 2, py, 5, 1); ctx.fillRect(px, py - 2, 1, 5); }
  ctx.restore();
}
// light falling on the spring from above: slanted shafts in stepped bands, widening as they come down and dissolving on the water,
// a pool of light where they land, and motes drifting down through them. Drawn over the night's tint, so the spring glows in the dark.
function drawSpringLight(E, now) {
  const L = SPRING.light, k = Math.min(1, E.t / 900, (E.dur - E.t) / 800), x = Math.round(E.x), y = Math.round(E.y); if (k <= 0) return;
  const n = nightK(GAME.profile), col = L.col.map((c, i) => Math.round(c + (L.moon[i] - c) * n)).join(), beam = 1 - 0.3 * n;   // sunlight by day, a thin blue moonbeam by night, when the pond itself glows
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pool = ctx.createRadialGradient(x, y, 2, x, y, SPRING.rx * 1.1); pool.addColorStop(0, `rgba(${col},${(0.34 + 0.16 * n) * k})`); pool.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(x, y, SPRING.rx * 1.1, SPRING.ry * 1.25, 0, 0, Math.PI * 2); ctx.fill();
  L.shafts.forEach(([dx, dy, wide, power], i) => {
    const shimmer = 0.8 + 0.2 * Math.sin(now / 800 + i * 2.1);
    for (let s = 0; s < L.h; s += L.step) {
      const t = s / L.h, up = L.h - s, half = Math.round((L.top + wide * t * (1 - 0.4 * n)) / 2) * 2, a = L.alpha * beam * power * shimmer * k * Math.min(1, t * 2.4) * Math.min(1, (1 - t) * 5);
      ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`; ctx.fillRect(Math.round(x + dx + up * L.lean - half / 2), y + dy - up, half, L.step);
    }
  });
  for (let i = 0; i < L.motes; i++) { const q = (now / 2600 + i / L.motes) % 1, up = (1 - q) * L.h * 0.8, [dx, dy] = L.shafts[i % L.shafts.length]; ctx.globalAlpha = k * Math.sin(q * Math.PI) * 0.9; ctx.fillStyle = n > 0.5 ? '#bcd8ff' : '#fffbe0'; ctx.fillRect(Math.round(x + dx + up * L.lean + Math.sin(i * 3.3 + now / 700) * 8), Math.round(y + dy - up), 2, 2); }
  ctx.restore();
}
// ground marks: the spring's pool, meteor warnings (drawn with the ground, under everyone)
function drawZoneEvents(w, now) {
  const E = w.event; if (!E) return;
  if (E.kind === 'spring') {
    drawSpringPond(E, now); (w.lateDraw = w.lateDraw || []).push(() => drawSpringLight(E, now));
  }
  if (E.kind === 'meteor') for (const mk of E.marks) {
    if (mk.hit) continue;
    const k = mk.t / 1200;
    ctx.save(); ctx.strokeStyle = `rgba(255,90,40,${0.4 + 0.5 * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.lineDashOffset = -now / 30;
    ctx.beginPath(); ctx.ellipse(mk.x, mk.y, 30, 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,90,40,${0.25 * k})`; ctx.beginPath(); ctx.ellipse(mk.x, mk.y, 30 * k, 12 * k, 0, 0, Math.PI * 2); ctx.fill();
    // the meteor itself, falling in from the top right
    const fy = mk.y - 220 * (1 - k), fx = mk.x + 120 * (1 - k);
    ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(fx, fy, fx + 30, fy - 50); g.addColorStop(0, 'rgba(255,230,160,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 30, fy - 50); ctx.stroke();
    ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
// the HUD line under the clock while an event runs
function drawZoneEventHud(game, now) {
  const w = game.world, E = w && w.event; if (!E || w.interior) return;
  let line = E.title;
  if (E.kind === 'horde') line += ` · ${Math.max(0, E.left)} left`;
  if (E.kind === 'runner' || E.kind === 'meteor' || E.kind === 'spring') line += ` · ${Math.max(0, Math.ceil(((E.dur || 0) - E.t) / 1000))}s`;
  const y = isNight(game.profile) ? 82 : 70, wd = textW(line, 6.5) + 16;
  ctx.save(); ctx.fillStyle = 'rgba(30,8,8,0.7)'; rrect(ctx, VW / 2 - wd / 2, y - 6, wd, 12, 5); ctx.fill();
  ctx.strokeStyle = `rgba(255,180,90,${0.6 + 0.3 * Math.sin(now / 250)})`; ctx.lineWidth = 0.8; rrect(ctx, VW / 2 - wd / 2 + 0.4, y - 5.6, wd - 0.8, 11.2, 5); ctx.stroke(); ctx.restore();
  text(line, VW / 2, y, '#ffd8a0', 6.5);
}
// SKULL TOTEMS (object 285): the ground around one is cursed. While the hero stands on it their DEF counts for 20% less.
const TOTEM = { bank: '285', reach: 120, def: 0.8, col: '#b070ff' };
const totemsOf = w => w.totems || (w.totems = (w.objects || []).filter(o => o.bank === TOTEM.bank));
const totemDef = a => (a.totemCurse ? TOTEM.def : 1);
function totemTick(w) {
  const p = w.player; if (!p) return;
  const at = totemsOf(w).find(o => Math.hypot(o.x - p.x, (o.y - p.y) * 1.3) < TOTEM.reach), on = !!at;
  if (on && !p.totemCurse) floatText(w, p.x, p.y - 46, 'CURSED GROUND · DEF -20%', TOTEM.col, 8);
  p.totemCurse = on;
  if (at && !p.dead) totemPack(w, at);
}
// THE TOTEM'S PACK: while you stand on its cursed ground, now and then a totem raises a pack of five (one kind, the area's rank)
// out of the earth around it, and they come straight for you. One pack per totem at a time, and it rests a while after.
const TOTEM_PACK = { n: 5, check: 3000, chance: 0.3, rest: 45000, r: [36, 70] };
function totemPack(w, o) {
  const now = performance.now(); if ((o.packCheck || 0) > now) return; o.packCheck = now + TOTEM_PACK.check;
  if ((o.packRest || 0) > now || (o.pack && o.pack.some(m => !m.dead && !m.remove)) || Math.random() >= TOTEM_PACK.chance) return;
  const R = regionAt(o.x); if (!R || R.zone < 0) return;
  const { pool, rank } = zoneMobs(w, R); if (!pool.length) return;
  const sp = pick(pool), out = [];
  for (let i = 0; i < TOTEM_PACK.n; i++) {
    const an = i / TOTEM_PACK.n * Math.PI * 2 + Math.random() * 0.6, d = rand(...TOTEM_PACK.r), s = findOpen(w, o.x + Math.cos(an) * d, o.y + Math.sin(an) * d * 0.7);
    const m = makeMonster(sp, rank, s.x, s.y); Object.assign(m, { region: R.zone, area: R.key, home: { x: s.x, y: s.y }, aggro: true, totemPack: true });
    w.actors.push(m); out.push(m); w.rings.push({ x: s.x, y: s.y, r: 14, t: -i * 70, col: TOTEM.col });
  }
  o.pack = out; o.packRest = now + TOTEM_PACK.rest;
  floatText(w, o.x, o.y - 50, 'THE TOTEM STIRS — A PACK RISES', TOTEM.col, 8);
}
function drawTotems(w, now) {
  const p = w.player, cam = w.cam, vw = VW / (w.zoom || ZOOM); if (!p || !cam) return;
  for (const o of totemsOf(w)) {
    if (o.x < cam.x - 90 || o.x > cam.x + vw + 90) continue;
    const lit = p.totemCurse && Math.hypot(o.x - p.x, (o.y - p.y) * 1.3) < TOTEM.reach, R = TOTEM.reach;
    ctx.save(); ctx.globalAlpha = lit ? 0.55 + 0.2 * Math.sin(now / 200) : 0.22; ctx.strokeStyle = TOTEM.col; ctx.lineWidth = lit ? 1.5 : 1; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -now / 90;
    ctx.beginPath(); ctx.ellipse(o.x, o.bottom - 2, R, R / 1.3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = lit ? 0.14 : 0.05; ctx.fillStyle = TOTEM.col; ctx.fill(); ctx.restore();
  }
}
