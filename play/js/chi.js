'use strict';
// THE KI SYSTEM: what the last Dojo's Grandmaster teaches (pr.chi = { lv, xp }; in code it keeps its first name, chi, to
// stay apart from the Ki cards in ki.js). Once learned the hero carries a Ki
// gauge, the cup on the Layer button. It fills as you land blows (faster still with a perfect parry) and drains slowly.
// Pick it on the inventory's KI tab and it takes the Layer button's place: with about a third of the gauge, the button releases it all at once: a shockwave that throws back everything near you, then Ki form:
// harder hits for as long as the gauge lasts, Spirit Cannon shots on every basic attack, and a faster Ki Bomb. It can't be refilled until it runs dry. The fuller the gauge, the bigger the release. Every release trains Ki, up to level 5.
const CHI = { max: 100, hit: 8, parry: 20, need: 30, formDrain: 0.01 / 9, drain: 0.0012, reach: 110, levels: [5, 15, 30, 50] };
const chiPower = lv => 1.3 + 0.1 * lv;
function chiUnlock(game) { const pr = game.profile; pr.chi = pr.chi || { lv: 1, xp: 0 }; game.refreshPlayer(); kiBombGrant(game); }
const kiPicked = pr => !!(pr && pr.chi && pr.layerChoice === 'ki');
// KI MASTERY: past Level 5 the training goes on. Level 5 gives 3 points and every 4 releases after that one more, spent on
// the KI tab (pr.chi.m = { power, well, gather, bomb }, each up to KI_M.max).
const KI_M = { max: 5, base: 3, every: 4, from: 50, btn: { w: 62, h: 15 }, row: { x: 10, h: 42, w: 250 },
  skills: { power: { name: 'Inner Power', d: l => `Ki form hits ${l * 6}% harder` }, well: { name: 'Deep Well', d: l => `Ki form lasts ${l * 10}% longer` }, gather: { name: 'Quick Gathering', d: l => `Each blow gives ${l} more Ki` }, bomb: { name: 'Bomb Heart', d: l => `Ki Bomb hits ${l * 12}% harder` } } };
const kiM = (K, k) => (K && K.m && K.m[k]) || 0;
const kiMSpent = K => Object.keys(KI_M.skills).reduce((n, k) => n + kiM(K, k), 0);
const kiMPoints = K => !K || K.lv < CHI.levels.length + 1 ? 0 : Math.max(0, KI_M.base + Math.floor(Math.max(0, K.xp - KI_M.from) / KI_M.every) - kiMSpent(K));
const kiDrain = K => CHI.formDrain / (1 + kiM(K, 'well') * 0.1);
const kiMRow = i => ({ x: PAGE_R.x + KI_M.row.x, y: PAGE_R.y + 50 + i * KI_M.row.h, w: KI_M.row.w, h: KI_M.row.h - 4 });
const kiMBtn = () => ({ x: PAGE_R.x + PAGE_R.w - KI_M.btn.w - 8, y: PAGE_R.y + 6, w: KI_M.btn.w, h: KI_M.btn.h });
function kiMLearn(game, k) {
  const pr = game.profile, K = pr.chi; if (kiMPoints(K) <= 0 || kiM(K, k) >= KI_M.max) return;
  K.m = K.m || {}; K.m[k] = kiM(K, k) + 1; game.toast(`${KI_M.skills[k].name} ${K.m[k]} · ${KI_M.skills[k].d(K.m[k])}`, '#ffe08a'); game.save();
}
// KI SURGE: a Ki Bomb absorbed in Ki form (kibomb.js) doubles every stat until the gauge runs dry
const KI_SURGE = { stats: ['atk', 'def', 'crit', 'spd', 'maxHp', 'maxMp'], flare: 600, filter: 'hue-rotate(170deg) saturate(1.3) brightness(1.15)' };
function kiSurgeStat(a, mul) { for (const s of KI_SURGE.stats) a[s] *= mul; a.hp = Math.round(a.hp * mul); a.mp *= mul; }
function kiSurgeStart(a) { if (a.kiSurge) return; a.kiSurge = true; a.kiSurgeAt = performance.now(); kiSurgeStat(a, 2); }
function kiSurgeEnd(a) { if (!a.kiSurge) return; a.kiSurge = false; kiSurgeStat(a, 0.5); }
// in Ki form every basic attack also fires a Spirit Cannon, if one is equipped: free, instant and at its lowest charge
function kiCannonShot(world, a) {
  if (a.kind !== 'player' || !(a.chiT > 0)) return;
  const sp = a.spells.find(s => s && s.sx === 'cannon'); if (!sp) return;
  const base = sp.power * spellMult(a, sp), opts = (extra = {}) => Object.assign({ base, el: sp.el, status: sp.status, spell: true, pop: 170, push: 40, tw: sp.tw }, extra);
  fireCannon(world, a, a.dir, base, opts, CANNON.min, true);
}
function chiTick(game, w, dt) {
  const pr = game.profile, p = w.player; if (!pr || !p) return;
  kiBombGrant(game);   // heroes who learned Ki before the Ki Bomb existed
  dojoCannonRepair(game);
  p.chiOn = kiPicked(pr); if (!p.chiOn) { p.chiT = 0; kiSurgeEnd(p); return; }
  p.chiLv = pr.chi.lv; p.chi = p.chi || 0; p.kiPower = kiM(pr.chi, 'power') * 0.06; p.kiGather = kiM(pr.chi, 'gather'); p.kiBombUp = 1 + kiM(pr.chi, 'bomb') * 0.12;
  if (p.kiCharge > 0) {   // held in place while the Ki comes in, the ground shaking harder and harder
    p.kiCharge -= dt; p.state = 'cast'; p.castLen = Math.max(p.castLen || 0, 200); p.vx = p.vy = 0; w.shake = Math.max(w.shake || 0, 1 + 3 * (1 - p.kiCharge / KI_TRANS.gather));
    if (p.kiCharge <= 0) { p.kiCharge = 0; if (!p.dead) kiBurst(game, w, p); }
  }
  if (p.chiT > 0) {
    const dr = kiDrain(pr.chi); p.chi = Math.max(0, p.chi - dr * dt); p.chiT = p.chi / dr; if (!(p.chiT > 0)) kiSurgeEnd(p);   // Ki form lasts exactly as long as the gauge
    if (Math.random() < 0.3) w.particles.push({ x: p.x + rand(-9, 9), y: p.y - rand(0, 26), vx: 0, vy: -36, t: 0, life: 420, col: p.kiSurge ? '#9fe8ff' : '#ffe08a', size: 2 });
  } else p.chi = Math.max(0, p.chi - CHI.drain * dt);
}
// the Layer button, with Ki picked on the inventory's KI tab (combat.js tryLayer)
function kiRelease(game, w, p) {
  if (p.chiT > 0 || p.kiCharge > 0) return false;   // already in Ki form, or gathering
  if ((p.chi || 0) < CHI.need) { floatText(w, p.x, p.y - 44, `Ki ${Math.floor(p.chi || 0)} / ${CHI.need}`, '#ffe08a', 8); return false; }
  // the hero plants their feet and the Ki is drawn in (drawKiGather); the release itself lands when that's done (chiTick, kiBurst)
  const G = KI_TRANS.gather; p.kiCharge = G; p.invuln = Math.max(p.invuln || 0, G + 400); p.vx = p.vy = 0; p.state = 'cast'; setAnim(p, 'cast', true); p.castLen = G + 150;
  w.fx.push({ kigather: true, owner: p, t: 0, dur: G });
  if (typeof SFX !== 'undefined' && SFX.cast) SFX.cast(true);
  return true;
}
function kiBurst(game, w, p) {
  const pr = game.profile, T = KI_TRANS, k = p.chi / CHI.max; p.chiT = p.chiMax = p.chi / kiDrain(pr.chi); p.chiAt = performance.now();
  w.rings.push({ x: p.x, y: p.y, r: CHI.reach * 0.6, t: 0, col: '#ffe08a' }, { x: p.x, y: p.y, r: CHI.reach, t: -100, col: '#ffffff' });
  w.shake = Math.max(w.shake || 0, 12); w.hitStop = Math.max(w.hitStop || 0, 110); w.flash = { t: 0, dur: 340, col: '#fff6d8' }; floatText(w, p.x, p.y - 50, 'KI RELEASE!', '#ffd23f', 12);
  w.fx.push({ kiburst: true, owner: p, t: 0, dur: T.burst });
  for (let i = 0; i < T.sparks; i++) { const an = Math.random() * Math.PI * 2, sp = rand(160, 380); w.particles.push({ x: p.x, y: p.y - 14, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, t: 0, life: rand(300, 700), col: i % 3 ? '#ffe08a' : '#ffffff', size: rand(1.5, 3), streak: true, drag: 0.93 }); }
  for (let i = 0; i < T.rocks; i++) w.particles.push({ x: p.x + rand(-16, 16), y: p.y - rand(0, 6), vx: rand(-90, 90), vy: rand(-170, -60), t: 0, life: rand(350, 650), col: i % 2 ? '#8a8478' : '#5e5a50', size: rand(2, 3.5), drag: 0.95 });
  for (let i = 0; i < T.dust; i++) { const an = i / T.dust * Math.PI * 2; w.particles.push({ x: p.x + Math.cos(an) * 10, y: p.y + Math.sin(an) * 4, vx: Math.cos(an) * 120, vy: Math.sin(an) * 44, t: 0, life: 520, col: '#d8c8a8', size: 3.5, puff: true, drag: 0.93 }); }
  if (typeof SFX !== 'undefined' && SFX.smite) SFX.smite();
  for (const o of enemiesOf(w, p)) if (Math.hypot(o.x - p.x, (o.y - p.y) * 1.3) < CHI.reach) dealDamage(w, p, o, { base: (p.atk || 10) * (1.5 + 0.3 * pr.chi.lv) * (0.5 + k), spell: true, launch: 220, el: 'holy' });
  pr.chi.xp++; const L = CHI.levels.filter(n => pr.chi.xp >= n).length + 1;
  if (L > pr.chi.lv) { pr.chi.lv = L; game.toast(`☯ Ki Level ${L}! Your release hits harder`, '#ffe08a'); game.save(); }
}
// the inventory's KI tab: left, your Ki and the switch that puts it on the Layer button; right, how it works
const KI_TAB = { emblem: 112, emblemY: 138, btn: { w: 196, h: 26, y: 268 }, bar: { w: 170, h: 7, y: 208 } };
const kiTabBtn = () => { const B = KI_TAB.btn; return { x: PAGE_L.x + (PAGE_L.w - B.w) / 2, y: B.y, w: B.w, h: B.h }; };
function setKiActive(game, on) {
  const pr = game.profile; if (!pr.chi) { game.toast('Beat the Last Grandmaster in Frostmere to learn Ki', '#ff9a7a'); return; }
  if (on) { if (LAYER_ELS[pr.layerChoice]) pr.layerBack = pr.layerChoice; pr.layerChoice = 'ki'; game.toast('Ki takes the place of Layer', '#ffe08a'); }
  else { pr.layerChoice = pr.layerBack || 'holy'; game.toast(`Back to Layer: ${LAYER_ELS[pr.layerChoice].name}`, LAYER_ELS[pr.layerChoice].mote); }
  game.save();
}
function updateKiTab(game, m) {
  const k = navInput(), B = kiTabBtn(), G = kiMBtn(); if (k.ok || clicked(B.x, B.y, B.w, B.h)) setKiActive(game, !kiPicked(game.profile));
  if (game.profile.chi && clicked(G.x, G.y, G.w, G.h)) m.kiGuide = !m.kiGuide;
  if (game.profile.chi && !m.kiGuide) Object.keys(KI_M.skills).forEach((id, i) => { const R = kiMRow(i); if (clicked(R.x, R.y, R.w, R.h)) kiMLearn(game, id); });
}
function drawKiTab(game, m, now) {
  const P = PAGE_L, pr = game.profile, K = pr.chi, cx = P.x + P.w / 2, T = KI_TAB, on = kiPicked(pr), B = kiTabBtn(), b = T.bar, p = window.GAME && GAME.world && GAME.world.player;
  pageHeader('KI', P); kiEmblem(cx, T.emblemY, T.emblem + (on ? 3 * Math.sin(now / 300) : 0), !!K);
  if (K) {
    const next = CHI.levels[K.lv - 1], prev = CHI.levels[K.lv - 2] || 0, q = next ? Math.max(0, Math.min(1, (K.xp - prev) / (next - prev))) : 1;
    ink(`Level ${K.lv}`, cx, 202, '#8a5a00', 10, 'center');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, cx - b.w / 2, b.y + 8, b.w, b.h, 3); ctx.fill(); ctx.fillStyle = '#e0a832'; rrect(ctx, cx - b.w / 2, b.y + 8, Math.max(3, b.w * q), b.h, 3); ctx.fill();
    ink(next ? `${K.xp} / ${next} releases to Level ${K.lv + 1}` : 'Mastered', cx, b.y + 24, INK_SOFT, 7, 'center', false);
    ink(on ? `Gauge ${Math.floor((p && p.chi) || 0)} / ${CHI.max}` : 'Not on your Layer button', cx, b.y + 37, on ? '#2a6a2a' : INK_SOFT, 7.5, 'center', false);
  } else ink('Locked', cx, 208, '#6a6458', 10, 'center');
  const hov = hovered(B.x, B.y, B.w, B.h), col = !K ? '#4a4656' : on ? '#2a7a4a' : hov ? '#e0a832' : '#c08a20';
  ctx.fillStyle = col; rrect(ctx, B.x, B.y, B.w, B.h, 6); ctx.fill(); ctx.strokeStyle = '#fff0b8'; ctx.lineWidth = 1; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 6); ctx.stroke();
  text(!K ? 'LOCKED' : on ? '✓ ACTIVE · CLICK TO USE LAYER' : 'USE KI ON THE LAYER BUTTON', cx, B.y + B.h / 2, '#ffffff', 8);
}
// the KI tab's right-hand page
function drawKiPage(game, m, now) {
  const P = PAGE_R, pr = game.profile, K = pr.chi, cx = P.x + P.w / 2; goldTitle('KI', cx, 66, 12, now);
  if (!K) { ink('Not learned yet.', cx, 92, INK, 9, 'center'); ink('Beat all five dojos, ending with the Last Grandmaster', cx, 108, INK_SOFT, 7, 'center', false); ink('in Frostmere, to learn it.', cx, 119, INK_SOFT, 7, 'center', false); return; }
  const next = CHI.levels[K.lv - 1], G = kiMBtn(); popupButton({ ...G, label: m.kiGuide ? 'MASTERY' : 'GUIDE', col: '#ffd860' }, now);
  ink(`Level ${K.lv}${next ? ` · ${K.xp} / ${next} releases` : ' · Mastered'}`, cx, 88, '#2a6a2a', 8, 'center');
  if (!m.kiGuide) {
    const pts = kiMPoints(K); ink(next ? 'Mastery opens at Level 5' : `${pts} mastery point${pts === 1 ? '' : 's'} · 1 more every ${KI_M.every} releases`, cx, 100, pts ? '#8a5a00' : INK_SOFT, 7, 'center', false);
    Object.keys(KI_M.skills).forEach((id, i) => {
      const S = KI_M.skills[id], l = kiM(K, id), R = kiMRow(i), can = pts > 0 && l < KI_M.max, hov = hovered(R.x, R.y, R.w, R.h);
      ctx.fillStyle = hov && can ? 'rgba(255,214,120,0.16)' : 'rgba(0,0,0,0.22)'; rrect(ctx, R.x, R.y, R.w, R.h, 4); ctx.fill();
      ctx.strokeStyle = can ? '#ffd860' : 'rgba(200,210,230,0.2)'; ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 4); ctx.stroke();
      ink(S.name, R.x + 8, R.y + 10, INK, 8);
      ink(l ? S.d(l) : `Level 1: ${S.d(1)}`, R.x + 8, R.y + 25, INK_SOFT, 6.8, 'left', false);
      for (let p = 0; p < KI_M.max; p++) { ctx.fillStyle = p < l ? '#ffd25a' : 'rgba(200,210,230,0.25)'; rrect(ctx, R.x + R.w - 62 + p * 11, R.y + 7, 9, 5, 1.5); ctx.fill(); }
      if (can) ink('+ LEARN', R.x + R.w - 8, R.y + 25, '#8a5a00', 7, 'right');
    });
    return;
  }
  [['Replaces Layer', 'Switch it on and the Layer button releases Ki instead.'], ['Gathering', `Each landed blow +${CHI.hit}, each perfect parry +${CHI.parry}. It drains slowly.`], ['Release', `From ${CHI.need} up: a shockwave that throws back everything near you.`], ['Afterwards', `Ki form: hits at ×${(chiPower(K.lv) + kiM(K, 'power') * 0.06).toFixed(2).replace(/0$/, '')} until the gauge runs dry, up to ${Math.round(CHI.max / kiDrain(K) / 1000)} s.`], ['Spirit Cannon', 'Equipped: in Ki form every basic attack fires one, free.'], ['Ki Bomb', `Charges ×${KIB.kiRate} in Ki form. Hold once full to absorb it: all stats ×2.`]].forEach(([a, b], i) => { const y = 106 + i * 30; ink(a, P.x + 14, y, INK, 8); ink(b, P.x + 14, y + 13, INK_SOFT, 6.8, 'left', false); });
}
// with Ki picked, the Layer button is a cup of Ki: glowing liquid fills it from the bottom as Ki builds, with a rippling
// surface. The dragon sits in it, gold below the surface and grey above. During a release the cup becomes a little sky
// (drawKiSky), with the gauge as a ring round it.
const KI_CUP = { r: 16, wave: 1.2, waveLen: 0.4, waveMs: 170, deep: '#a83a08', high: '#d9700f', top: '#fff0b0' };
function drawKiOnLayer(game, a, cx, cy, now) {
  if (!kiPicked(game.profile)) return;
  const C = KI_CUP, R = C.r, ready = (a.chi || 0) >= CHI.need, level = Math.min(1, (a.chi || 0) / CHI.max), line = cy + R - 2 * R * level;
  if (a.chiT > 0) { drawKiSky(a, cx, cy, level, now); return; }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#120a18'; ctx.fill(); ctx.clip();
  if (level > 0) {
    const y = x => line + Math.sin(x * C.waveLen + now / C.waveMs) * C.wave * (level < 1 ? 1 : 0), g = ctx.createLinearGradient(0, cy + R, 0, cy - R);
    g.addColorStop(0, C.deep); g.addColorStop(1, C.high); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - R, cy + R); for (let x = -R; x <= R; x++) ctx.lineTo(cx + x, y(x)); ctx.lineTo(cx + R, cy + R); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.top; ctx.lineWidth = 1; ctx.beginPath(); for (let x = -R; x <= R; x++) ctx.lineTo(cx + x, y(x)); ctx.stroke();
  }
  ctx.restore();
  kiEmblemLive(a, cx, cy, 26, level >= 1 ? cy - R * 2 : line, ready, now);
}
// THE KI DRAGON (assets/ki_dragon.png): the coiled dragon stands behind the hero for the first seconds of a release, the long
// one flies through the Ki button's little sky, and the sheet's emblem marks Ki in the HUD.
const KI_DRAGON = { sheet: 'assets/ki_dragon.png', stripW: 481, stripH: 85, coilW: 77, coilH: 124, coils: 7, coilMs: 110, coilIn: 260, coilLife: 5000, coilOut: 900, coilScale: 0.6, emblem: 64, slice: 3 };
function kiEmblem(cx, cy, size, lit) {
  const D = KI_DRAGON, im = img(D.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  ctx.save(); if (!lit) ctx.filter = 'grayscale(1) brightness(0.75)';
  ctx.drawImage(im, D.coilW * D.coils, D.stripH, D.emblem, D.emblem, cx - size / 2, cy - size / 2, size, size); ctx.restore();
}
// the emblem on the HUD is alive: each Ki gain makes it jump. Once a release is ready it sways, pulses and glows with
// sparks circling it. Gold below the cup's surface (line), grey above.
function kiEmblemLive(a, cx, cy, size, line, ready, now) {
  const D = KI_DRAGON, im = img(D.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  const chi = a.chi || 0; if (a.kiShown != null && chi > a.kiShown) a.kiPop = now; a.kiShown = chi;
  const pop = a.kiPop ? Math.max(0, 1 - (now - a.kiPop) / 180) : 0, lit = ready, half = size / 2;
  const sc = 1 + 0.03 * Math.sin(now / 420) + 0.2 * pop + (ready ? 0.07 * Math.sin(now / 150) : 0);
  const spin = ready ? Math.sin(now / 300) * 0.16 : Math.sin(now / 900) * 0.05;
  const art = () => ctx.drawImage(im, D.coilW * D.coils, D.stripH, D.emblem, D.emblem, -half, -half, size, size);
  ctx.save();
  if (lit) {
    ctx.globalCompositeOperation = 'lighter'; const r = 19 + 2 * Math.sin(now / 130), g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r); g.addColorStop(0, 'rgba(255,190,70,0.5)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
  const draw = () => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin); ctx.scale(sc, sc); art(); ctx.restore(); };
  ctx.save(); ctx.filter = 'grayscale(1) brightness(0.7)'; draw(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(cx - size, line, size * 2, size * 2); ctx.clip(); draw(); ctx.restore();
  if (lit) for (let i = 0, n = 3; i < n; i++) {   // the sparks
    const an = now / 240 + i * Math.PI * 2 / n, r = 18 + Math.sin(now / 90 + i) * 1.2;
    ctx.fillStyle = i % 2 ? '#ffffff' : '#ffe08a'; ctx.fillRect(Math.round(cx + Math.cos(an) * r) - 1, Math.round(cy + Math.sin(an) * r) - 1, 2, 2);
  }
  ctx.restore();
}
// THE KI SKY: during a release the cup is a window on the dragon flying through the clouds, with far clouds drifting behind
// it and near ones sweeping over it. It burns blue-white after a Ki Bomb is absorbed. The ring round it is the Ki left.
const KI_SKY = { scale: 0.34, x: -13, y: -13, wave: 2.2, waveLen: 44, waveMs: 150, bob: 1.5, far: { n: 3, ms: 70, y: [-11, -2, 8], col: 'rgba(255,255,255,0.65)' }, near: { n: 2, ms: 28, y: [-6, 6], col: '#ffffff' },
  sky: ['#2f6fd8', '#8fc8f0', '#ffe2a0'], surge: ['#16307e', '#3a8ae0', '#bff4ff'] };
function kiSkyClouds(cx, cy, L, now) {
  const R = KI_CUP.r, span = R * 2 + CLOUD[0].length + 6;
  ctx.fillStyle = L.col;
  for (let i = 0; i < L.n; i++) {
    const x = Math.round(cx - R - CLOUD[0].length + ((now / L.ms + i * span / L.n) % span)), y = Math.round(cy + L.y[i]);   // (it flies left, so the sky runs right)
    CLOUD.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(x + rx, y + ry, 1, 1); });
  }
}
function drawKiSky(a, cx, cy, level, now) {
  const S = KI_SKY, D = KI_DRAGON, R = KI_CUP.r, cols = a.kiSurge ? S.surge : S.sky, im = img(D.sheet), sm = ctx.imageSmoothingEnabled;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - R, 0, cy + R); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  kiSkyClouds(cx, cy, S.far, now);
  if (im && im.complete && im.naturalWidth) {
    const x0 = cx + S.x, y0 = cy + S.y + Math.sin(now / 420) * S.bob, n = Math.ceil((R * 2 + 4) / S.scale);
    ctx.imageSmoothingEnabled = true;
    for (let x = 0; x < n; x += D.slice) ctx.drawImage(im, x, 0, D.slice, D.stripH, x0 + x * S.scale, y0 + Math.sin(x / S.waveLen - now / S.waveMs) * S.wave, D.slice * S.scale + 0.4, D.stripH * S.scale);
    ctx.imageSmoothingEnabled = sm;
  }
  kiSkyClouds(cx, cy, S.near, now);
  ctx.restore();
  const ring = (k, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); };
  ring(1, 'rgba(10,8,16,0.75)', 2.2); if (level > 0) ring(level, a.kiSurge ? '#9fe8ff' : '#ffd25a', 1.6);
}
// THE TRANSFORMATION: first the gathering (the world dims, light and pebbles are drawn in, a ring closes on the hero), then
// the burst (a pillar of light, a shockwave along the ground, speed lines, flying rock and dust).
const KI_TRANS = { gather: 700, burst: 900, dim: 0.55, rays: 18, pull: 96, pebbles: 10, ring: 80, pillar: 44, lines: 22, sparks: 30, rocks: 12, dust: 12 };
function drawKiGather(f) {
  const a = f.owner, T = KI_TRANS, k = f.t / f.dur, cx = Math.round(a.x), fy = Math.round(a.y), cy = fy - 14, r = rng(11), jig = Math.floor(f.t / 40) % 2 ? 1 : -1;
  ctx.save();
  ctx.fillStyle = `rgba(6,8,22,${T.dim * Math.min(1, k * 4)})`; ctx.fillRect(cx - 900, cy - 700, 1800, 1400);
  drawActor(a, performance.now());   // (the hero stays lit)
  const R = T.ring * (1 - k) + 10; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1 + k * 1.5; ctx.beginPath(); ctx.ellipse(cx, fy, R, R * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < T.pebbles; i++) {   // the ground lets go of its pebbles
    const an = r() * Math.PI * 2, d = 14 + r() * 24, up = 10 + r() * 22; ctx.fillStyle = i % 2 ? '#8a8478' : '#5e5a50';
    ctx.fillRect(Math.round(cx + Math.cos(an) * d) + (i % 3 ? jig : 0), Math.round(fy + Math.sin(an) * d * 0.4 - k * up), 2, 2);
  }
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt'; ctx.lineWidth = 1.5;
  for (let i = 0; i < T.rays; i++) {   // light pouring in
    const an = r() * Math.PI * 2, q = (r() + k * 2.2) % 1, d = T.pull * (1 - q * q) + 4, len = 6 + q * 12, c = Math.cos(an), s = Math.sin(an) * 0.7;
    ctx.globalAlpha = Math.min(1, q * 3); ctx.strokeStyle = i % 3 ? '#ffd25a' : '#ffffff'; ctx.beginPath(); ctx.moveTo(cx + c * d, cy + s * d); ctx.lineTo(cx + c * (d + len), cy + s * (d + len)); ctx.stroke();
  }
  ctx.globalAlpha = 1; const cr = 4 + k * 18, g = ctx.createRadialGradient(cx, cy, 1, cx, cy, cr); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,214,110,0.55)'); g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  if (k > 0.6) { ctx.fillStyle = `rgba(255,240,190,${(k - 0.6) / 0.4 * 0.6})`; const w = 1 + (k - 0.6) * 10; ctx.fillRect(cx - w, fy - 300, w * 2, 300); }   // the first thread of the pillar
  ctx.restore();
}
function drawKiBurst(f) {
  const a = f.owner, T = KI_TRANS, k = f.t / f.dur, e = 1 - Math.pow(1 - k, 3), left = 1 - k, cx = Math.round(a.x), fy = Math.round(a.y), r = rng(23);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = left;
  for (const [q, col] of [[1, '#ffd25a'], [0.7, '#ffffff']]) { const R = (20 + e * CHI.reach * 1.3) * q; ctx.strokeStyle = col; ctx.lineWidth = 1 + left * 6; ctx.beginPath(); ctx.ellipse(cx, fy, R, R * 0.42, 0, 0, Math.PI * 2); ctx.stroke(); }   // the shockwave along the ground
  ctx.lineWidth = 0.5 + left * 2;
  for (let i = 0; i < T.lines; i++) {   // speed lines tearing outward
    const an = r() * Math.PI * 2, d = 30 + r() * 20 + e * 150, len = 8 + left * 26 + r() * 10, c = Math.cos(an), s = Math.sin(an) * 0.65;
    ctx.strokeStyle = i % 3 ? '#ffffff' : '#ffe08a'; ctx.beginPath(); ctx.moveTo(cx + c * d, fy - 14 + s * d); ctx.lineTo(cx + c * (d + len), fy - 14 + s * (d + len)); ctx.stroke();
  }
  ctx.globalAlpha = 1; const w = T.pillar * Math.pow(left, 1.6);   // the pillar of light, thinning fast
  for (const [q, col] of [[1, 'rgba(255,190,70,0.35)'], [0.6, 'rgba(255,236,170,0.7)'], [0.25, '#ffffff']]) { ctx.fillStyle = col; ctx.fillRect(cx - w * q, fy - 320, w * q * 2, 324); }
  ctx.restore();
}
function kiDragonCoil(a, y, age, now) {
  const D = KI_DRAGON, im = img(D.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  if (age >= D.coilLife) return;   // it stays for the first few seconds only
  const k = Math.min(1, age / D.coilIn), fade = Math.min(1, (D.coilLife - age) / D.coilOut), ga = ctx.globalAlpha, n = D.coils * 2 - 2, s = Math.floor(now / D.coilMs) % n, fr = s < D.coils ? s : n - s, dw = Math.round(D.coilW * D.coilScale), h = Math.round(D.coilH * D.coilScale * k), sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.globalAlpha = ga * fade;   // (it rises up out of the ground, breathes back and forth, and fades away)
  ctx.drawImage(im, fr * D.coilW, D.stripH, D.coilW, D.coilH, Math.round(a.x - dw / 2), Math.round(y) + 8 - h, dw, h);
  ctx.imageSmoothingEnabled = sm; ctx.globalAlpha = ga;
}
// THE RELEASE'S AURA: the anime power-up flame (assets/ki_aura.png, 6 frames) burning behind the hero. White streaks shoot
// straight up through it and stepped arcs crackle round it; on release it flares huge and white, then settles.
const KI_RISE = { sheet: 'assets/ki_rise.png', cell: 96, cols: 8, frames: 32, frame: 50, scale: 0.8, feet: 76, fit: 1.55 };
const KI_AURA = { sheet: 'assets/ki_aura.png', cw: 80, ch: 84, frames: 6, frame: 90, foot: 3, fit: 0.58, tall: 0.56, w: 20, h: 38, flicker: 66, flare: 360 };
// in Ki form the hero themself changes: skin and clothes run gold, with a white rim and a glow that pulses
function kiFormFilter(now, surge) { if (surge) return `sepia(1) hue-rotate(170deg) saturate(2.2) brightness(${(1.25 + 0.1 * Math.sin(now / 70)).toFixed(2)}) drop-shadow(0 0 0.6px #ffffff) drop-shadow(0 0 3px rgba(90,190,255,0.95))`; return `sepia(0.6) saturate(2) brightness(${(1.2 + 0.1 * Math.sin(now / 90)).toFixed(2)}) drop-shadow(0 0 0.6px #fff6c8) drop-shadow(0 0 2.5px rgba(255,190,60,0.95))`; }
// energy rising from the feet, over the flame and behind the hero (Aura38 by Soluna Software, CC0, recoloured and pixelated)
function kiRise(a, cx, base, now, flameW) {
  const R = KI_RISE, im = img(R.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  const n = Math.floor(now / R.frame) % R.frames, s = R.cell * R.scale, w = flameW * R.fit;   // (as wide as the flame around it)
  ctx.drawImage(im, (n % R.cols) * R.cell, Math.floor(n / R.cols) * R.cell, R.cell, R.cell, Math.round(cx - w / 2), Math.round(base - R.feet * R.scale), w, s);
}
function kiAura(a, y, behind, now) {
  const A = KI_AURA, surge = a.kiSurge, age = now - (a.chiAt || 0), flare = Math.max(0, 1 - age / A.flare, surge ? 1 - (now - a.kiSurgeAt) / KI_SURGE.flare : 0), ending = a.chiT < 700, f = Math.floor(now / A.flicker);
  if (ending && f % 2) return;   // it stutters out
  const cx = Math.round(a.x), base = Math.round(y) + 3, S = (surge ? 1.25 : 1) + flare * 0.7, W = A.w * S, H = A.h * S, r = rng(f * 7 + 3), box = (x, y0, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y0, w, h); };
  ctx.save();
  if (behind) {
    const f0 = ctx.filter; if (surge) ctx.filter = KI_SURGE.filter;   // absorbed: the flame burns blue-white
    kiDragonCoil(a, y, age, now);   // (behind the flame, so it rises out of the fire)
    const im = img(A.sheet), dw = A.cw * S * A.fit, dh = A.ch * S * A.tall, sm = ctx.imageSmoothingEnabled;   // the flame
    if (im && im.complete && im.naturalWidth) { ctx.imageSmoothingEnabled = false; ctx.drawImage(im, Math.floor(now / A.frame) % A.frames * A.cw, 0, A.cw, A.ch, Math.round(cx - dw / 2), Math.round(base + A.foot - dh), Math.round(dw), Math.round(dh)); kiRise(a, cx, base, now, dw); ctx.imageSmoothingEnabled = sm; }
    ctx.filter = f0; ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, base - 2, 2, cx, base - 2, W * 1.3); g.addColorStop(0, surge ? 'rgba(90,190,255,0.5)' : 'rgba(255,170,60,0.45)'); g.addColorStop(1, surge ? 'rgba(60,140,255,0)' : 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, base, W * 1.3, W * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    for (let i = 0; i < 9; i++) {   // white streaks tearing upward
      const q = ((now / 240) + i * 0.37) % 1, x = cx + Math.round((r() - 0.5) * W * 1.7), len = 4 + r() * 8;
      box(x, Math.round(base - q * H - len), 1, len, i % 3 ? (surge ? '#ffffff' : '#fffbe0') : surge ? '#9fe8ff' : '#ffe08a');
    }
    if (flare > 0) { ctx.globalAlpha = flare * 0.8; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx, base - H * 0.45, W * 0.9, H * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }   // the flash of the release
    ctx.strokeStyle = '#d8f4ff'; ctx.lineWidth = 1;
    for (let i = 0; i < 2 + (f % 3 === 0 ? 2 : 0); i++) {   // stepped arcs
      let x = cx + Math.round((r() - 0.5) * W * 2.1), yy = base - Math.round(r() * H * 0.45); ctx.beginPath(); ctx.moveTo(x, yy);
      for (let k = 0; k < 5; k++) { if (k % 2) x += Math.round((r() - 0.5) * 12); else yy -= 4 + Math.round(r() * 6); ctx.lineTo(x, yy); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
