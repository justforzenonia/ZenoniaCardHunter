'use strict';
// THE HERO PARTNER (pr.partner): after you make your hero you choose one companion from everyone in the game (the picker, charmake.js), after a warning
// that you will need the help. They fight at your side, level up on the EXP you earn, wear your spare gear (P.eq) and hold Bond Cards (bondcards.js). When they fall they are gone
// for good: no revive, their gear comes back to you, and the Hero Partner screen (G) keeps their record.
// In the game they are a partner like the hound (a.pet, so they follow and fight the same way), marked a.heroPartner. Dojo sparring can't kill them.
const HERO_P = { key: 'KeyG', col: '#8fd8ff', theme: '#3a8ac8', regen: 0.02, calm: 130, spd: 84, tabs: ['RECORD', 'GEAR', 'BOND'], hud: { x: 6, y: 72, w: 104, h: 24 }, pill: { x: 6, y: VH - 158, w: 74, h: 14 },
  well: 58 };
const partnerOf = pr => pr && pr.partner;
const partnerNew = id => ({ id, name: charName(id), lv: 1, xp: 0, kills: 0, dead: false, since: dayNo(), eq: {} });
// what they wear: your own hero always has first claim on a piece
const partnerPiece = (pr, P, slot) => { const u = P.eq && P.eq[slot]; return u && !Object.values(pr.eq || {}).includes(u) ? pr.gear.find(g => g.uid === u) || null : null; };
const partnerHolds = (pr, uid) => { const P = partnerOf(pr); return !!P && !P.dead && !!P.eq && Object.values(P.eq).includes(uid); };
function partnerStats(P) {
  const pr = GAME.profile, St = { hp: 90 + P.lv * 26, atk: 5 + P.lv * 1.5, def: P.lv * 0.6, crit: 5, spd: HERO_P.spd, guard: 0, opener: 0, focus: 1 }, list = [];
  if (!pr || P.dead) return St;
  for (const slot of GEAR_SLOTS) { const g = partnerPiece(pr, P, slot); if (!g) continue; for (const k of ['hp', 'atk', 'def', 'crit', 'spd']) St[k] += g.stats[k] || 0; list.push(...(g.bonus || [])); }
  St.spd = Math.min(St.spd, SPD_SOFT + 20); St.list = list; return St;
}
function partnerBank(id, paint) {
  const S = charSrc(id), A = S.anims, own = A.attack || A.atk1, hurt = A.hurt || partnerFlinch(S);
  let frames = S.frames, canvas = S.image;
  if (paint && Object.keys(paint).length) { const B = charBake(id, null); if (B) { canvas = charPainted(B, paint); frames = S.frames.map((r, i) => B.frames[i] || r); } }   // their own colours, from the Stylist (partnerstyle.js)
  return { frames, canvas, anims: { ...A, attack: own || partnerLunge(S) || A.walk, hurt: hurt || A.idle, die: A.die || A.idle, knock: A.knock || hurt || A.idle } };
}
// a partner with no fighting art of their own (most villagers) used to swing by walking on the spot. Now their standing frame
// steps back a pixel, lunges a few pixels at the foe and settles (PARTNER_MOVE.lunge), and flinches back when hit, like the
// hero looks borrowed in the character maker (charmake.js charPose). Built from the anim offsets [frame, ms, dx, dy].
const PARTNER_MOVE = { lunge: [[90, -1], [70, 3], [110, 5], [130, 2]], flinch: [[90, -2], [130, -1]] };
function partnerStill(S, d) { const q = charSeq(S, 'idle', d) || charSeq(S, 'walk', d); return q && q.length ? q[0][0] : null; }
function partnerPose(S, steps) {
  const out = [0, 1, 2, 3].map(d => { const f = partnerStill(S, d), [vx, vy] = DV[d]; return f == null ? null : steps.map(([ms, k]) => [f, ms, Math.round(vx * k), Math.round(vy * k * 0.8)]); });
  return out.every(Boolean) ? out : null;
}
const partnerLunge = S => partnerPose(S, PARTNER_MOVE.lunge);
const partnerFlinch = S => partnerPose(S, PARTNER_MOVE.flinch);
function spawnPartner(world, owner) {
  const pr = window.GAME && GAME.profile, P = partnerOf(pr); if (!world || !owner || !P || P.dead || GAME.scene === 'arena' || world.actors.some(a => a.heroPartner && !a.dead)) return null;
  const S = charSrc(P.id); if (!S) return null;
  const St = partnerStats(P), a = baseActor('monster', owner.team, owner.x - 22, owner.y + 8), rec = charRec(S, charSeq(S, 'idle', 2)[0][0]);
  Object.assign(a, { sp: DOG_SP, bank: partnerBank(P.id, P.paint), heroPartner: true, role: 'partner', pet: St, petLv: P.lv, petKind: 'hero', plist: St.list || [], passives: sumPassives(St.list || []), tier: Math.min(9, Math.floor(P.lv / 5)), maxHp: St.hp, atk: St.atk, def: St.def, crit: St.crit, spd: St.spd,
    h: rec[3], heavy: false, pal: 0, scale: 1, ai: { mode: 'wander', t: 0, tx: owner.x, ty: owner.y, cast: rand(2000, 4000) }, spell: null, spells: [], ally: true, owner, slot: typeof PET_SLOT !== 'undefined' ? PET_SLOT.hero : -1.3, home: { x: owner.x, y: owner.y } });
  a.hp = a.maxHp; world.actors.push(a); return a;
}
function partnerRefit(game) {   // their stats after a change of gear, at the same share of health and where they stand
  const w = game.world, old = w && w.actors.find(a => a.heroPartner && !a.dead); if (!w || !w.player) return;
  const f = old ? old.hp / old.maxHp : 1, x = old && old.x, y = old && old.y; w.actors = w.actors.filter(a => !a.heroPartner);
  const a = spawnPartner(w, w.player); if (a && old) { a.x = x; a.y = y; a.hp = a.maxHp * f; }
}
function partnerKill(game, w) { const P = partnerOf(game.profile); if (P && !P.dead && w.actors.some(q => q.heroPartner && !q.dead)) P.kills++; }
// they earn every point of EXP you do, on the same climb as a hero
function partnerExp(game, n) {
  const P = partnerOf(game.profile), w = game.world, a = w && w.actors.find(q => q.heroPartner && !q.dead); if (!P || P.dead || P.lv >= 99) return; P.xp += n;
  while (P.xp >= expNeed(P.lv) && P.lv < 99) {
    P.xp -= expNeed(P.lv); P.lv++; bondGrant(game, P); game.toast(`${P.name} reached Lv ${P.lv}!`, HERO_P.col);
    if (a) { const f = a.hp / a.maxHp, S = partnerStats(P); Object.assign(a, { pet: S, petLv: P.lv, maxHp: S.hp, atk: S.atk, def: S.def }); a.hp = a.maxHp * f; w.rings.push({ x: a.x, y: a.y, r: 18, t: 0, col: HERO_P.col }); }
  }
  if (P.lv >= 99) P.xp = 0;
}
// the end of them: no revive, and the save is written at once. What they carried comes back to you.
// A NEW HERO'S GRACE: below Lv 10 a fall only knocks them out; they are back at your side half a minute later, so the first hour,
// while you are still learning to block and dodge, can't cost you your partner.
const PARTNER_GRACE = { lv: 10, back: 30000 };
function partnerFall(world, a) {
  const pr = window.GAME && GAME.profile, P = partnerOf(pr); setAnim(a, 'die'); a.remove = true; if (!P) return;
  if ((pr.lv || 1) < PARTNER_GRACE.lv) {
    floatText(world, a.x, a.y - 34, `${P.name} is knocked out`, '#ffd0a0', 10); world.rings.push({ x: a.x, y: a.y, r: 24, t: 0, col: '#ffd0a0' });
    GAME.toast(`${P.name} is knocked out and will be back in ${PARTNER_GRACE.back / 1000} s. From Lv ${PARTNER_GRACE.lv} a fall is for good.`, '#ffd0a0');
    world.timers.push({ t: PARTNER_GRACE.back, fn: () => { if (GAME.world === world && world.player && !world.player.dead && !P.dead) { const b = spawnPartner(world, world.player); if (b) { world.rings.push({ x: b.x, y: b.y, r: 18, t: 0, col: HERO_P.col }); GAME.toast(`${P.name} is back on their feet`, HERO_P.col); } } } });
    return;
  }
  P.dead = true; P.eq = {}; P.fellAt = (typeof areaName === 'function' && regionAt(a.x) && world.overworld) ? areaName(regionAt(a.x)) : world.name || 'the deep'; P.fellOn = dayNo();
  floatText(world, a.x, a.y - 34, `${P.name} has fallen`, '#ff9a8a', 10); world.rings.push({ x: a.x, y: a.y, r: 34, t: 0, col: '#ff9a8a' }, { x: a.x, y: a.y, r: 18, t: -100, col: '#ffffff' });
  GAME.toast(`${P.name} has fallen. They will not be coming back. Their gear is yours again.`, '#ff8a7a'); GAME.save();
}
// they mend when nothing is near
function partnerTick(w, dt) {
  const a = w.actors.find(q => q.heroPartner && !q.dead); if (!a || a.hp >= a.maxHp) return;
  if (!w.actors.some(m => m.kind === 'monster' && !m.ally && !m.dead && Math.hypot(m.x - a.x, m.y - a.y) < HERO_P.calm)) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * HERO_P.regen * dt / 1000);
}
function drawPartnerBars(a, y) {
  const P = partnerOf(GAME.profile); if (!P && !a.label) return;
  const top = y - (a.h || 26) * (a.scale || 1) - 5, w = 22, f = Math.max(0, a.hp / a.maxHp);
  text(a.label || P.name, a.x, top - 7, HERO_P.col, 6.5);
  drawMiniCapsule(a.x, top - 3, w + 2, f);   // (the companions' capsule: world.js)
}
function partnerPortrait(P, cx, by, w, h, dead, now = 0) {
  const S = charSrc(P.id), q = S && charSeq(S, 'idle', 2), e = q && q.length && (dead ? q[0] : seqFrame(q, now, true)), r = e && charRec(S, e[0]); if (!r) return;
  const s = Math.min(4, w / r[2], h / r[3]); ctx.save(); if (dead) ctx.filter = 'grayscale(1) brightness(0.6)'; ctx.imageSmoothingEnabled = false; ctx.drawImage(S.image, r[0], r[1], r[2], r[3], cx - r[2] * s / 2, by - r[3] * s, r[2] * s, r[3] * s); ctx.restore();
}
// the HUD card: who, their level, their health; click it or press G
function drawPartnerHud(game, now) {
  const w = game.world, pr = game.profile, P = partnerOf(pr), H = HERO_P.hud; if (!P || P.dead || !w || game.menu) return;   // (once they fall the card goes; the G screen keeps their record)
  const a = w.actors.find(q => q.heroPartner && !q.dead), f = a ? a.hp / a.maxHp : 1;
  ctx.fillStyle = 'rgba(30,20,13,0.86)'; rrect(ctx, H.x, H.y, H.w, H.h, 4); ctx.fill(); ctx.strokeStyle = HERO_P.col; ctx.lineWidth = 1; rrect(ctx, H.x + 0.5, H.y + 0.5, H.w - 1, H.h - 1, 4); ctx.stroke();
  partnerPortrait(P, H.x + 12, H.y + H.h - 2, 18, 20, false, now);
  text(P.name.length > 15 ? P.name.slice(0, 14) + '…' : P.name, H.x + 24, H.y + 7, '#fff', 6.5, 'left');
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(H.x + 24, H.y + 14, 60, 4); ctx.fillStyle = f > 0.3 ? '#5ad84a' : '#ff5a4a'; ctx.fillRect(H.x + 24, H.y + 14, 60 * f, 4); text(`${P.lv}`, H.x + 94, H.y + 16, HERO_P.col, 6.5);
  if (clicked(H.x, H.y, H.w, H.h)) game.openMenu(partnerMenu());
}
function drawPartnerPill(game, now) {
  const Q = HERO_P.pill, pr = game.profile, w = game.world, P = partnerOf(pr); if (!pr || !w || game.menu || (P && P.dead)) return;   // (once they fall the button goes too)
  hudPill(Q, HERO_P.col, 'G: Partner', '#e0f4ff');   // (hud.js)
  if (clicked(Q.x, Q.y, Q.w, Q.h)) game.openMenu(partnerMenu());
}
// ---------------------------------------------------------------- the warning, before you choose
const PARTNER_WARN = ['The road west has killed better hunters than you.', 'You are going to need all the help you can get, so nobody leaves alone.', 'Choose a partner. They fight beside you, wear your gear and earn Bond Cards as they level.'];
const PW_BTN = { x: VW / 2 - 80, y: 262, w: 160, h: 24 };
function partnerWarn(back) { return { type: 'partnerwarn', back }; }
function updatePartnerWarn(game, m) {
  const k = navInput(); if (k.back) { game.menu = m.back; return; }
  if (k.ok || clicked(PW_BTN.x, PW_BTN.y, PW_BTN.w, PW_BTN.h)) game.menu = charPick(m.back, 'partner');
}
function drawPartnerWarn(game, m, now) {
  ctx.fillStyle = 'rgba(6,6,14,0.94)'; ctx.fillRect(0, 0, VW, VH);
  const R = { x: 90, y: 60, w: 460, h: 240 }, I = { x: R.x + 10, y: R.y + 8, w: R.w - 20, h: R.h - 16 }; drawIronFrame(R, '#3a2230', '#1a1018'); drawSlatePage(I, '#2a2030', '#161018');
  goldTitle('A WARNING', VW / 2, R.y + 28, 17, now);
  PARTNER_WARN.forEach((s, i) => petInk(s, VW / 2, R.y + 58 + i * 20, '#f0e6d2', 9, 'center'));
  ctx.fillStyle = 'rgba(90,16,16,0.55)'; rrect(ctx, R.x + 30, R.y + 120, R.w - 60, 54, 5); ctx.fill(); ctx.strokeStyle = '#c85a4a'; ctx.lineWidth = 1; rrect(ctx, R.x + 30.5, R.y + 120.5, R.w - 61, 53, 5); ctx.stroke();
  petInk('They only get one life.', VW / 2, R.y + 137, '#ffb0a0', 11, 'center'); petInk(`Until you reach Lv ${PARTNER_GRACE.lv} a fall only knocks them out. After that, there is no revive and no second choice.`, VW / 2, R.y + 156, '#f0d8d0', 8, 'center');
  popupButton({ ...PW_BTN, label: 'I UNDERSTAND [Enter]', primary: true, col: '#ffd27a' }, now); petInk('Esc: back', VW / 2, 294, '#9aa4b8', 7.5, 'center', false);
}
// ---------------------------------------------------------------- the Hero Partner screen
function partnerMenu() { return { type: 'heropartner', tab: 0, cur: 0, pick: null }; }
const PGR = i => { const S = HERO_P.well, gap = 26, x0 = PU_R.x + (PU_R.w - S * 3 - gap * 2) / 2; return { x: x0 + (i % 3) * (S + gap), y: PU_R.y + 44 + Math.floor(i / 3) * (S + 26), w: S, h: S, s: S }; };
function partnerPickRows(pr, P, pick) {
  const rows = [{ none: true, name: 'Take it off', sub: 'Leave this slot empty', col: '#c9c1a8' }], used = Object.values(pr.eq || {}), theirs = Object.entries(P.eq || {}).filter(([s]) => s !== pick.slot).map(e => e[1]);
  for (const g of pr.gear.filter(q => q.slot === pick.slot && !used.includes(q.uid) && !theirs.includes(q.uid)).sort((a, b) => gearScore(b) - gearScore(a))) rows.push({ ref: g, icon: g.icon, name: g.name, col: rankColor(g.tier), sub: gearLines(g).slice(0, 2).join(' · ') });
  return rows;
}
function updateHeroPartner(game, m) {
  const pr = game.profile, P = partnerOf(pr);
  if (m.pick && m.pick.kind !== 'gear') { updateBondPick(game, m); return; }
  if (m.pick) {
    const rows = partnerPickRows(pr, P, m.pick), nav = panelNav(m.pick, rows.length, 0), r = rows[m.pick.cur]; if (nav.back) { m.pick = null; return; }
    if (nav.ok && r) { P.eq = P.eq || {}; if (r.none) delete P.eq[m.pick.slot]; else P.eq[m.pick.slot] = r.ref.uid; m.pick = null; game.save(); partnerRefit(game); }
    return;
  }
  const k = navInput(); if (k.back || hit(HERO_P.key)) { game.closeMenu(); return; }
  if (!P) { if (k.ok) game.menu = partnerWarn({ type: 'heropartner', existing: true, tab: 0, cur: 0, pick: null }); return; }
  const tabTo = t => { m.tab = (t + HERO_P.tabs.length) % HERO_P.tabs.length; m.cur = 0; };
  if (hit('Tab') || hit('KeyE')) tabTo(m.tab + 1); if (hit('KeyQ')) tabTo(m.tab - 1); HERO_P.tabs.forEach((_, i) => { const B = PU_TAB(i); if (clicked(B.x, PU.y - 19, B.w, 20)) tabTo(i); });
  if (P.dead || !m.tab) return;
  if (m.tab === 2) { updateBondTab(game, m, k); return; }
  const n = GEAR_SLOTS.length, open = () => { m.pick = { kind: 'gear', slot: GEAR_SLOTS[m.cur], cur: 0, scroll: 0 }; };
  if (k.l) m.cur = (m.cur + n - 1) % n; if (k.r) m.cur = (m.cur + 1) % n; if (k.u || k.d) m.cur = (m.cur + 3) % n;
  for (let i = 0; i < n; i++) { const R = PGR(i); if (clicked(R.x, R.y, R.w, R.h)) { m.cur = i; open(); return; } }
  if (k.ok) open();
}
// a record tile: a coloured edge, a lit socket with its icon, the label and the value
function partnerTile(R, ic, label, value, col = '#f0e6d2') {
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, '#34405a'); g.addColorStop(0.5, '#3c2819'); g.addColorStop(1, '#1f140d'); ctx.fillStyle = g; rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.fill();
  ctx.save(); rrect(ctx, R.x, R.y, R.w, R.h, 5); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(R.x, R.y, 3, R.h); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(R.x, R.y, R.w, 1.5); ctx.restore();
  ctx.strokeStyle = goldFrameGrad(R.y, R.h); ctx.lineWidth = 1; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 5); ctx.stroke();
  puSocket(R.x + 24, R.y + R.h / 2, 15, ic, col, true, false);
  petInk(label, R.x + 46, R.y + 16, '#9aa4b8', 8, 'left', false); petInk(value, R.x + 46, R.y + 34, col, 12, 'left');
}
function partnerHeading(str, y, now) {
  const cx = PU_R.x + PU_R.w / 2, w = textW(str, 11) / 2 + 14; goldTitle(str, cx, y, 11, now); ctx.strokeStyle = goldFrameGrad(y - 2, 4); ctx.lineWidth = 1;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * w, y); ctx.lineTo(cx + s * (w + 70), y); ctx.stroke(); ctx.fillStyle = '#ffd27a'; ctx.save(); ctx.translate(cx + s * w, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -2, 4, 4); ctx.restore(); }
}
function partnerInfoBox(y) { ctx.fillStyle = 'rgba(22,15,9,0.72)'; rrect(ctx, PU_R.x + 12, y, PU_R.w - 24, 54, 5); ctx.fill(); ctx.strokeStyle = '#563924'; ctx.lineWidth = 0.8; rrect(ctx, PU_R.x + 12.5, y + 0.5, PU_R.w - 25, 53, 5); ctx.stroke(); }
function drawHeroPartner(game, m, now) {
  const pr = game.profile, P = partnerOf(pr), sh = puShades({ col: HERO_P.theme }), dead = P && P.dead;
  ctx.fillStyle = 'rgba(8,6,14,0.78)'; ctx.fillRect(0, 0, VW, VH);
  if (m.pick && m.pick.kind !== 'gear') { drawBondPick(game, m, now); return; }
  if (m.pick) { panelMenu(m.pick, { title: `${SLOT_LABEL[m.pick.slot]} FOR ${P.name.toUpperCase()}`, rows: partnerPickRows(pr, P, m.pick), empty: 'Nothing spare', keys: '↑↓ choose · Enter give · Esc back' }, now); return; }
  goldTitle('HERO PARTNER', VW / 2, 12, 15, now);
  if (P) HERO_P.tabs.forEach((t, i) => {
    const B = PU_TAB(i), on = m.tab === i, ty = PU.y - (on ? 19 : 15), c = ['#ffd27a', '#ff9a8a', '#8fffb0'][i];
    ctx.save(); ctx.shadowColor = on ? hexA(c, 0.7) : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = (on ? 6 : 3) * RES; const tg = ctx.createLinearGradient(0, ty, 0, ty + 22); tg.addColorStop(0, on ? '#4a5670' : '#422c1c'); tg.addColorStop(1, on ? '#3a2618' : '#24180f'); ctx.fillStyle = tg; rrect(ctx, B.x, ty, B.w, 24, 4); ctx.fill(); ctx.restore();
    ctx.fillStyle = on ? c : mixCol(c, '#000000', 0.45); ctx.fillRect(B.x + 3, ty + 2, B.w - 6, on ? 2.4 : 1.6); ctx.strokeStyle = on ? '#ffd860' : '#5a6478'; ctx.lineWidth = on ? 1.2 : 0.9; rrect(ctx, B.x + 0.5, ty + 0.5, B.w - 1, 23, 4); ctx.stroke(); text(t, B.x + B.w / 2, ty + 10, on ? '#ffffff' : '#9aa4b8', 8);
  });
  drawIronFrame(PU, sh.plate[0], sh.plate[1]);
  if (!P) {
    const C = { x: VW / 2 - 150, y: PU_L.y, w: 300, h: PU_L.h }; drawSlatePage(C, sh.page[0], sh.page[1]);
    goldTitle('NO PARTNER YET', VW / 2, C.y + 90, 13, now); petInk('You need all the help you can get.', VW / 2, C.y + 118, '#f0e6d2', 8.5, 'center'); petInk('You only get one. If they fall, they are gone for good.', VW / 2, C.y + 134, '#ffb0a0', 8, 'center');
    popupButton({ x: VW / 2 - 70, y: C.y + 160, w: 140, h: 22, label: 'CHOOSE [Enter]', primary: true, col: HERO_P.col }, now); petInk('G / Esc: close', VW / 2, C.y + C.h - 16, '#9aa4b8', 7.5, 'center', false); return;
  }
  drawSlatePage(PU_L, sh.page[0], sh.page[1]); drawSlatePage(PU_R, sh.page[0], sh.page[1]);
  const hg = ctx.createLinearGradient(242, 0, 250, 0); hg.addColorStop(0, '#563924'); hg.addColorStop(0.5, '#9aa4b8'); hg.addColorStop(1, '#563924'); ctx.fillStyle = hg; ctx.fillRect(243, PU_L.y + 2, 6, PU_L.h - 4);
  for (let y = PU_L.y + 14; y < PU_L.y + PU_L.h; y += 40) { ctx.fillStyle = '#2c1d12'; ctx.beginPath(); ctx.arc(246, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
  const a = game.world && game.world.actors.find(q => q.heroPartner && !q.dead), S = partnerStats(P), need = expNeed(P.lv), hp = a ? a.hp : dead ? 0 : S.hp, hurt = hp / S.hp;
  // left page: the partner in a shaft of light on a gold-rimmed pedestal
  const A = { x: PU_L.x + 8, y: PU_L.y + 8, w: PU_L.w - 16, h: 152 }, cx = PU_L.x + PU_L.w / 2, floor = A.y + 134, tint = dead ? '#3a3440' : HERO_P.theme;
  ctx.save(); rrect(ctx, A.x, A.y, A.w, A.h, 5); ctx.clip();
  const ag = ctx.createRadialGradient(cx, A.y + 80, 6, cx, A.y + 80, 130); ag.addColorStop(0, mixCol(tint, '#422c1c', 0.25)); ag.addColorStop(1, '#100b07'); ctx.fillStyle = ag; ctx.fillRect(A.x, A.y, A.w, A.h);
  if (!dead) {
    ctx.globalCompositeOperation = 'lighter'; const beam = ctx.createLinearGradient(0, A.y, 0, floor); beam.addColorStop(0, hexA('#bfe8ff', 0.28)); beam.addColorStop(1, hexA('#bfe8ff', 0.02)); ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(cx - 16, A.y); ctx.lineTo(cx + 16, A.y); ctx.lineTo(cx + 58, floor); ctx.lineTo(cx - 58, floor); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 18; i++) { const k = (now / (3600 + (i % 4) * 700) + i * 0.37) % 1; ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.fillStyle = i % 2 ? '#ffd27a' : HERO_P.col; ctx.fillRect(A.x + 8 + (i * 47) % (A.w - 16), floor - k * 124, 1.6, 1.6); }
  }
  ctx.restore();
  const pg = ctx.createLinearGradient(0, floor - 9, 0, floor + 9); pg.addColorStop(0, '#6a7890'); pg.addColorStop(1, '#22160e'); ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(cx, floor, 58, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = goldFrameGrad(floor - 11, 22); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx, floor, 58, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = dead ? '#6a6470' : hexA(HERO_P.col, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, floor, 44, 7.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = goldFrameGrad(A.y, A.h); ctx.lineWidth = 1.2; rrect(ctx, A.x + 0.6, A.y + 0.6, A.w - 1.2, A.h - 1.2, 5); ctx.stroke();
  partnerPortrait(P, cx, floor + 3, 124, 118, dead, now);
  ctx.fillStyle = 'rgba(22,15,9,0.92)'; rrect(ctx, A.x + 5, A.y + 5, 42, 16, 4); ctx.fill(); ctx.strokeStyle = goldFrameGrad(A.y + 5, 16); ctx.lineWidth = 1; rrect(ctx, A.x + 5.5, A.y + 5.5, 41, 15, 4); ctx.stroke(); text(`Lv ${P.lv}`, A.x + 26, A.y + 13.4, '#ffe9a8', 8.5);
  const Nm = { x: PU_L.x + 14, y: PU_L.y + 164, w: PU_L.w - 28, h: 20 }, ng = ctx.createLinearGradient(0, Nm.y, 0, Nm.y + Nm.h); ng.addColorStop(0, '#3a2a14'); ng.addColorStop(1, '#17100a'); ctx.fillStyle = ng; rrect(ctx, Nm.x, Nm.y, Nm.w, Nm.h, 4); ctx.fill(); ctx.strokeStyle = goldFrameGrad(Nm.y, Nm.h); ctx.lineWidth = 1; rrect(ctx, Nm.x + 0.5, Nm.y + 0.5, Nm.w - 1, Nm.h - 1, 4); ctx.stroke();
  goldTitle(P.name.toUpperCase(), cx, Nm.y + 10, 10.5, now);
  petInk(dead ? 'Fallen. They will not be coming back.' : hurt < 0.3 ? 'Badly hurt. Get them out of there!' : hurt < 0.7 ? 'Wounded, but still with you' : 'At your side', cx, PU_L.y + 195, dead ? '#ff8a7a' : hurt < 0.3 ? '#ff8a8a' : hurt < 0.7 ? '#ffb060' : '#8fffb0', 8, 'center');
  const bx = PU_L.x + 12, bw = PU_L.w - 24; puBar(bx, PU_L.y + 205, bw, hurt, '#ff5a6a', '♥', dead ? 'fallen' : `${Math.ceil(hp)} / ${S.hp} HP`); puBar(bx, PU_L.y + 220, bw, dead ? 0 : P.xp / need, '#4aa8f0', '★', dead ? `reached Lv ${P.lv}` : `EXP ${Math.floor(P.xp)} / ${need}`);
  [['⚔', Math.round(S.atk), '#ff9a8a'], ['⛨', Math.round(S.def), '#b8c8ff'], ['✦', `${Math.round(S.crit)}%`, '#ffd27a']].forEach(([ic, v, col], i) => { const x = bx + i * 62, y = PU_L.y + 236; ctx.fillStyle = 'rgba(22,15,9,0.8)'; rrect(ctx, x, y, 58, 15, 3); ctx.fill(); ctx.strokeStyle = '#563924'; ctx.lineWidth = 0.8; rrect(ctx, x + 0.4, y + 0.4, 57, 14, 3); ctx.stroke(); text(ic, x + 10, y + 7.5, col, 8); petInk(v, x + 34, y + 7.5, '#f0e6d2', 8, 'center'); });
  petInk('Tab: next page · G / Esc: close', cx, PU_L.y + PU_L.h - 12, '#9aa4b8', 7.5, 'center', false);
  // right page
  const days = Math.max(1, (P.fellOn || dayNo()) - (P.since || dayNo()) + 1), cx2 = PU_R.x + PU_R.w / 2, infoY = PU_R.y + 217;
  if (m.tab === 0) {
    partnerHeading(dead ? 'THEIR RECORD' : 'RECORD', PU_R.y + 18, now);
    const tw = (PU_R.w - 34) / 2, th = 52, Rc = i => ({ x: PU_R.x + 12 + (i % 2) * (tw + 10), y: PU_R.y + 34 + Math.floor(i / 2) * (th + 9), w: tw, h: th });
    [['⚔', 'Attack', String(Math.round(S.atk)), '#ff9a8a'], ['⛨', 'Defence', String(Math.round(S.def)), '#b8c8ff'], ['☠', 'Kills', String(P.kills), '#ffd27a'], ['☀', 'Days together', String(days), '#ffe08a'], dead ? ['✝', 'Fell at', P.fellAt || 'unknown', '#ff8a7a'] : ['★', 'Next level in', `${Math.ceil(need - P.xp)} EXP`, HERO_P.col], ['➤', 'Fighting style', charOwn(charSrc(P.id), 'atk1') ? 'Own attacks' : 'Lunges in', '#8fffb0']].forEach(([ic, l, v, c], i) => partnerTile(Rc(i), ic, l, v, c));
    const N = { x: PU_R.x + 12, y: infoY, w: PU_R.w - 24, h: 54 }, Ng = ctx.createLinearGradient(0, N.y, 0, N.y + N.h); Ng.addColorStop(0, dead ? 'rgba(90,20,20,0.75)' : 'rgba(110,70,14,0.65)'); Ng.addColorStop(1, 'rgba(20,10,10,0.7)'); ctx.fillStyle = Ng; rrect(ctx, N.x, N.y, N.w, N.h, 5); ctx.fill(); ctx.strokeStyle = dead ? '#c85a4a' : goldFrameGrad(N.y, N.h); ctx.lineWidth = 1.2; rrect(ctx, N.x + 0.5, N.y + 0.5, N.w - 1, N.h - 1, 5); ctx.stroke();
    petInk(dead ? 'Only a new hero brings a new partner.' : 'There is no revive.', cx2, N.y + 20, dead ? '#ffb0a0' : '#ffe9a8', 10, 'center'); petInk(dead ? 'They stood with you to the end.' : 'You need all the help you can get. Keep them alive.', cx2, N.y + 37, '#d8d8e0', 8, 'center', false);
  } else if (dead && m.tab === 2) {
    partnerHeading('BOND CARDS', PU_R.y + 18, now); petInk('These cards fell with them.', cx2, PU_R.y + 120, '#ffb0a0', 10, 'center'); petInk('A new hero brings a new partner and a new set.', cx2, PU_R.y + 140, '#c8d0e0', 8, 'center', false);
  } else if (m.tab === 2) {
    drawBondTab(game, m, now, a, infoY, cx2);
  } else if (dead) {
    partnerHeading(HERO_P.tabs[m.tab], PU_R.y + 18, now); petInk('Their gear came back to you.', cx2, PU_R.y + 130, '#c8d0e0', 9, 'center');
  } else {
    partnerHeading('THEIR GEAR', PU_R.y + 18, now);
    GEAR_SLOTS.forEach((slot, i) => { const R = PGR(i), g = partnerPiece(pr, P, slot); drawGearSlot(g, R.x, R.y, R.s, now, { slot, sel: m.cur === i }); petInk(SLOT_LABEL[slot], R.x + R.s / 2, R.y + R.s + 11, m.cur === i ? '#ffe9a8' : '#9aa4b8', 7, 'center'); });
    const g = partnerPiece(pr, P, GEAR_SLOTS[m.cur]); partnerInfoBox(infoY);
    if (g) { text(g.name, cx2, infoY + 14, rankColor(g.tier, now), 9); gearLines(g).slice(0, 2).forEach((s, i) => petInk(s, cx2, infoY + 29 + i * 12, '#d8d8e0', 7.5, 'center', false)); } else { petInk('Empty slot', cx2, infoY + 18, '#c8d0e0', 9, 'center'); petInk('Enter: give them a spare piece from your bag', cx2, infoY + 35, '#9aa4b8', 8, 'center', false); }
  }
}
