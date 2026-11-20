'use strict';
// THE DARK TELEPORTER: now and then one tears open out in the zones and stays three minutes. Step on it and you are taken to a small dark court with one evil NPC and their familiar,
// both scaled to you. Beat them and they may drop buff cards (the Support cards): three giant cards appear, you take one, and you are sent back to where you stepped in.
// It runs on the Survival Rift's world (rifts.js), with w.rift.evil set. The Crooked Gate (sidequests.js) asks for three of them, and while it runs teleporters come twice as often.
const EVIL = { gap: [60000, 110000], chance: 0.35, life: 180000, near: 14, drop: 0.75, hp: 4, atk: 1.1, famHp: 1.5, famAtk: 0.3, tint: '#4a2080', col: '#c88aff', card: { w: 124, h: 178, y: 62, gap: 38 },
  names: ['Warlock Vane', 'Hexer Moll', 'Grave-Binder Ash', 'Cultist Sorrel', 'The Pale Tutor', 'Black Ilsa', 'Doctor Rue', 'Oathbreaker Kett', 'Mother Thorn', 'The Ember Monk'] };
function evilGateAt(w, x, y) { w.evilGate = { x, y, t: EVIL.life }; }
function evilGateTick(game, w, dt) {
  const p = w.player, G = w.evilGate;
  if (G) { G.t -= dt; if (G.t <= 0) { w.evilGate = null; return false; } if (!p.dead && Math.hypot(p.x - G.x, p.y - G.y) < EVIL.near) { enterEvil(game, G); return true; } return false; }
  if (w.evilT == null) w.evilT = rand(...EVIL.gap); if ((w.evilT -= dt) > 0) return false; w.evilT = rand(...EVIL.gap);
  const job = SIDE_QUESTS.some(Q => { const st = sqStep(game.profile, Q); return st && st.type === 'evil'; }); if (Math.random() >= EVIL.chance * (job ? 2 : 1)) return false;
  const here = regionOfX(p.x), R = here && here.zone >= 0 && Math.random() < 0.7 ? here : pick(REGIONS.filter(r => r.zone >= 0));
  for (let k = 0; k < 300; k++) {
    const x = (R.ox + 2 + Math.random() * (R.w - 4)) * T, y = (R.oy + 3 + Math.random() * (R.h - 5)) * T;
    if (!mapReach(w.map, x, y) || w.blocked(x, y) || Math.hypot(x - p.x, y - p.y) < 80) continue;
    evilGateAt(w, x, y); game.toast(`A dark teleporter tore open in ${ZONES[R.zone].name}!`, EVIL.col); return false;
  }
  return false;
}
// the teleporter is the game's own door portal (object 244:0, the carved stone archway), its dark doorway filled with a slow violet whirl
const EVIL_DOOR = { obj: ['244', 0], dark: 40 };
let EVIL_DOOR_ART = null;
function evilDoorArt() {   // the archway, and a mask of its dark doorway (the near-black pixels), made once
  if (EVIL_DOOR_ART) return EVIL_DOOR_ART; const im = img(D.objects.img), B = D.objects.banks[EVIL_DOOR.obj[0]]; if (!im || !im.complete || !B) return null;
  const r = D.objects.frames[B.f[EVIL_DOOR.obj[1]]], [sx, sy, w, h] = r, frame = document.createElement('canvas'); frame.width = w; frame.height = h; const g = frame.getContext('2d'); g.drawImage(im, sx, sy, w, h, 0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), mask = document.createElement('canvas'); mask.width = w; mask.height = h; const m = mask.getContext('2d'), md = m.createImageData(w, h);
  for (let i = 0; i < id.data.length; i += 4) if (id.data[i + 3] > 200 && id.data[i] + id.data[i + 1] + id.data[i + 2] < EVIL_DOOR.dark) md.data[i + 3] = 255;
  m.putImageData(md, 0, 0);
  const whirl = document.createElement('canvas'); whirl.width = w; whirl.height = h;
  return (EVIL_DOOR_ART = { frame, mask, whirl, w, h });
}
function drawEvilGate(w, now) {
  const G = w.evilGate; if (!G) return; const k = 0.5 + 0.5 * Math.sin(now / 160), A = evilDoorArt();
  ctx.save();   // a dark violet pool at its foot (laid over the ground, not added as light: on bright grass that came out white)
  ctx.fillStyle = `rgba(40,10,80,${0.32 + k * 0.1})`; ctx.beginPath(); ctx.ellipse(G.x, G.y + 1, 22 + k * 2, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(170,90,255,${0.35 + k * 0.25})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(G.x, G.y + 1, 22 + k * 2, 6.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  if (A) {
    const x = Math.round(G.x - A.w / 2), y = Math.round(G.y + 3 - A.h), q = A.whirl.getContext('2d'), cx = A.w / 2, cy = A.h * 0.62;
    q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, A.w, A.h);   // the whirl, in whole pixels: a deep violet ground and two arms of light turning
    q.fillStyle = '#1a0630'; q.fillRect(0, 0, A.w, A.h);
    for (let n = 0; n < 90; n++) { const t = n / 90, a = t * Math.PI * 5 - now / 420 + (n % 2) * Math.PI, rr = 2 + t * 22; q.fillStyle = n % 2 ? `rgba(200,130,255,${0.9 - t * 0.6})` : `rgba(120,60,220,${0.9 - t * 0.5})`; q.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.8), 1, 1); }
    q.fillStyle = `rgba(255,230,255,${0.6 + k * 0.4})`; q.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
    q.globalCompositeOperation = 'destination-in'; q.drawImage(A.mask, 0, 0);
    ctx.drawImage(A.frame, x, y); ctx.drawImage(A.whirl, x, y);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';   // motes drifting up out of the doorway
  for (let i = 0; i < 6; i++) { const q = (now / 900 + i / 6) % 1; ctx.globalAlpha = Math.sin(q * Math.PI); ctx.fillStyle = i % 2 ? '#ffffff' : EVIL.col; ctx.fillRect(G.x + Math.sin(i * 2.3) * 11, G.y - 10 - q * 48, 1.6, 1.6); } ctx.restore();
  text('Teleporter', G.x, G.y - (A ? A.h + 6 : 76), EVIL.col, 8);
}
// the court is the ranked arena's temple floor without its two pools: a copy of the map with the water paved over in the court's
// own floor tile and walkable (the pools read as a pond), made once
let EVIL_COURT = null;
function evilCourtMap() {
  if (EVIL_COURT) return EVIL_COURT; const M0 = MAPS.arena2, floor = groundTile('arena2'); if (floor == null) return M0;
  const M = Object.assign({}, M0, { ground: M0.ground.slice(), overlay: M0.overlay.slice(), solid: M0.solid.slice(), paved: new Set(), waterShapes: null });   // (the pools are painted again as shapes over the tiles: not here)
  for (let i = 0; i < M.w * M.h; i++) { const t = (M.ground[i] & 0xff) - 1; if (t < 0 || !(waterTile(M.tileset, t) || REF_FLAT_WATER.includes(t))) continue; M.ground[i] = floor + 1; M.overlay[i] = 0; M.solid[i] = 0; M.paved.add(i); }
  const ts = tilesetImg(M.tileset), tc = document.createElement('canvas'); tc.width = tc.height = T; const tg = tc.getContext('2d'), watery = t => { tg.clearRect(0, 0, T, T); tg.drawImage(ts, (t % 16) * T, Math.floor(t / 16) * T, T, T, 0, 0, T, T); const d = tg.getImageData(0, 0, T, T).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (isWaterPx(d[k], d[k + 1], d[k + 2])) n++; return n > T * T * 0.2; };
  for (let i = 0; i < M.w * M.h; i++) { const t = (M.ground[i] & 0xff) - 1; if (t >= 0 && !M.paved.has(i) && [1, -1, M.w, -M.w].some(d => M.paved.has(i + d)) && watery(t)) { M.ground[i] = floor + 1; M.overlay[i] = 0; M.solid[i] = 0; M.paved.add(i); } }   // (a pool's spout, half water: paved too)
  return (EVIL_COURT = M);
}
function enterEvil(game, G) {
  const outside = game.world, p = outside.player, pr = game.profile, R = regionOfX(G.x) || REGIONS.find(r => r.zone >= 0), Z = ZONES[Math.max(0, R.zone)], w = mapWorld('arena2'), name = pick(EVIL.names), who = pick(charList('n')), [sx, sy] = ARENA2.p1, [ex, ey] = ARENA2.p2;
  outside.evilGate = null; w.rift = { evil: true, zone: Math.max(0, R.zone), name, t: 1, kills: 0 }; w.name = 'The Dark Court'; const CM = evilCourtMap(); w.map = CM; w.blocked = blockedFn(w); w.tileSolid = (x, y) => mapSolidAt(CM, x, y); if (CM.paved) w.objects = w.objects.filter(o => !CM.paved.has(Math.floor(o.y / T) * CM.w + Math.floor(o.x / T))); w.bg = tintCanvas(tintCanvas(renderMapBg(CM), EVIL.tint), EVIL.tint);   // (whatever stood in the pools goes with them)
  const party = outside.actors.filter(a => a === p || (a.ally && a.owner === p)); outside.actors = outside.actors.filter(a => !party.includes(a));
  for (const a of party) { a.x = sx * T + 8 + (a === p ? 0 : rand(-14, 14)); a.y = sy * T + 8 + (a === p ? 0 : 10); a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  const m = makeMercenary(pr, p, ex * T + 8, ey * T + 8), S = charSrc(who.id), rec = charRec(S, charSeq(S, 'idle', 2)[0][0]);
  Object.assign(m, { hunter: false, boss: true, evil: true, charId: who.id, label: name, bank: partnerBank(who.id), h: rec[3], maxHp: Math.round(p.maxHp * EVIL.hp), atk: m.atk * EVIL.atk }); m.hp = m.maxHp;
  const f = makeMonster(pick(Z.mobs.filter(id => D.monsters[id])), Math.max(0, Math.min(9, Math.floor((pr.lv || 1) / 8))), m.x + 30, m.y + 16);
  Object.assign(f, { evil: true, label: `${name}'s Familiar`, scale: 1.3, aggro: true, home: { x: f.x, y: f.y }, maxHp: Math.round(p.maxHp * EVIL.famHp), atk: p.atk * EVIL.famAtk }); f.hp = f.maxHp;
  giveKit(m, pick(WILD_KITS)); m.label = name; m.wildKit = true;   // a boss's way of fighting, under their own name
  w.actors.push(m, f); w.player = p; w.portals = []; w.from = { x: G.x, y: G.y + 18 };
  w.onKill = q => onMonsterKill(game, w, q);
  w.onPlayerDown = () => { game.toast(`${name} laughs as you are thrown out.`, '#ff8a8a'); w.leaveT = 1600; w.rift.failed = true; };
  game.outside = outside; game.world = w; w.flash = { t: 0, dur: 700, col: '#a040ff' }; game.toast(`The teleporter pulled you into ${name}'s Dark Court! Beat ${name} and the familiar to get out.`, EVIL.col);
  w.rift.lines = [`My door caught another hunter!`, `Beat me and my pet, and I'll let you out.`]; w.rift.lineT = 600;   // (spoken in turn, evilTick)
}
// a frame in the court: once both have fallen, a moment for it to land, then the reward
function evilTick(game, w, dt) {
  const Rf = w.rift; if (Rf.failed) return;
  const boss = w.actors.find(a => a.evil && a.boss && !a.dead);   // the court's keeper says their lines one after another, in a bubble
  if (boss && boss.say && (boss.say.t -= dt) <= 0) boss.say = null;
  if (boss && Rf.lines && Rf.lines.length && !boss.say && (Rf.lineT -= dt) <= 0) { boss.say = { s: Rf.lines.shift(), t: 2800 }; Rf.lineT = 250; }
  if (!boss && w.actors.some(a => a.say && a.evil)) for (const a of w.actors) if (a.evil) a.say = null;
  if (Rf.won == null) { if (!w.actors.some(a => a.evil && !a.dead && !a.remove)) { Rf.won = 900; for (const d of w.drops) if (d.kind !== 'coin') game.pickup(d); w.drops = w.drops.filter(d => d.kind === 'coin'); } return; }
  if ((Rf.won -= dt) > 0 || Rf.paid) return; Rf.paid = true;
  const Z = ZONES[Rf.zone], pr = game.profile, gold = 300 * (Rf.zone + 1) + (pr.lv || 1) * 20; pr.gold = (pr.gold || 0) + gold; game.gainExp(killExp(Z.ranks[1]) * 12); bumpStat('evils'); questEvent(game, 'evil'); game.toast(`${Rf.name} is beaten! +${gold} G`, '#ffd23f'); game.save();
  if (Math.random() >= EVIL.drop) { game.toast('They dropped no cards. The court starts to fade.', '#c9c1a8'); w.leaveT = 1800; return; }
  game.openMenu({ type: 'evilpick', cards: evilCards(Z), cur: 1, t: 0 });
}
// three different kinds of buff card, a rank above the zone at best
function evilCards(Z) {
  const kinds = Object.keys(SUPPORT).sort(() => Math.random() - 0.5).slice(0, 3);
  return kinds.map(k => makeCard(`sup_${k}${Math.floor(Math.random() * 10)}`, Math.min(9, rollRank(Z) + (Math.random() < 0.3 ? 1 : 0))));
}
const evilRect = i => { const C = EVIL.card; return { x: VW / 2 - C.w / 2 + (i - 1) * (C.w + C.gap), y: C.y, w: C.w, h: C.h }; };
function evilTake(game, m, i) { const c = m.cards[i]; game.pickup({ kind: 'card', item: c, force: true }); game.closeMenu(); game.toast(`You took ${cardName(c)}. The others crumble to ash.`, '#ffd23f'); game.save(); exitRift(game); }
function updateEvilPick(game, m, dt) {
  m.t += dt; if (m.t < 500) return; const k = navInput(); if (k.l) m.cur = (m.cur + 2) % 3; if (k.r) m.cur = (m.cur + 1) % 3;
  for (let i = 0; i < 3; i++) { const R = evilRect(i); if (clicked(R.x, R.y, R.w, R.h)) { evilTake(game, m, i); return; } if (hovered(R.x, R.y, R.w, R.h)) m.cur = i; }
  if (k.ok) evilTake(game, m, m.cur);
}
function drawEvilPick(game, m, now) {
  ctx.fillStyle = 'rgba(8,2,18,0.86)'; ctx.fillRect(0, 0, VW, VH); const rays = ctx.createRadialGradient(VW / 2, 150, 20, VW / 2, 150, 300); rays.addColorStop(0, 'rgba(170,80,255,0.35)'); rays.addColorStop(1, 'rgba(170,80,255,0)'); ctx.fillStyle = rays; ctx.fillRect(0, 0, VW, VH);
  goldTitle('CHOOSE ONE', VW / 2, 26, 18, now); petInk('The other two crumble to ash', VW / 2, 45, '#d8c8f0', 9, 'center', false);
  m.cards.forEach((c, i) => {
    const R = evilRect(i), sel = m.cur === i, k = Math.min(1, m.t / (300 + i * 100)), s = 1 - (1 - k) * (1 - k), sp = cardSpell(c), rise = (1 - s) * 40, lift = sel ? 4 : 0; ctx.save(); ctx.globalAlpha = s;
    if (sel) { ctx.save(); ctx.shadowColor = TF_RING[cardElement(c)] || '#ffd860'; ctx.shadowBlur = 16 * RES; ctx.fillStyle = '#141822'; rrect(ctx, R.x, R.y + rise - lift, R.w, R.h, 8); ctx.fill(); ctx.restore(); }
    drawTFCard(c, R.x, R.y + rise - lift, R.w, R.h, now, { name: true, sel }); if (!sel) { ctx.fillStyle = 'rgba(6,2,14,0.3)'; rrect(ctx, R.x, R.y + rise, R.w, R.h, 8); ctx.fill(); }
    const cx = R.x + R.w / 2, ty = R.y + R.h + 12; text(`${cardName(c)} · ${RANKS[c.tier]}`, cx, ty, rankColor(c.tier), 8.5); wrap(sp.desc || '', R.w + 26, 7.5).slice(0, 3).forEach((s2, j) => petInk(s2, cx, ty + 13 + j * 10, '#f0e6d2', 7.5, 'center', false)); ctx.restore();
  });
  petInk('←/→: choose · Enter or tap: take it', VW / 2, VH - 8, '#c9c1a8', 8, 'center', false);
}
function drawEvilOverlay(w, now) {
  const Rf = w.rift, tw = Math.max(150, textW(Rf.name, 9) + 30), x = VW / 2 - tw / 2; ctx.fillStyle = 'rgba(20,4,36,0.75)'; rrect(ctx, x, 8, tw, 26, 7); ctx.fill(); ctx.strokeStyle = EVIL.col; ctx.lineWidth = 1; rrect(ctx, x + 0.5, 8.5, tw - 1, 25, 7); ctx.stroke();
  text(Rf.name, VW / 2, 16, '#ffffff', 9); text(Rf.won != null ? 'Beaten' : `${w.actors.filter(a => a.evil && !a.dead).length} left`, VW / 2, 27, EVIL.col, 6.5);
}
