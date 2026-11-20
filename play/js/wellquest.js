'use strict';
// THE WELL ON WINDMILL HILL: a side quest that ends with a second partner, the LOYAL WOLF (pet.js: the same system as
// the hound, and both walk with you at once). Something is whimpering at the bottom of the well:
//   1 hear it at the well · 2 ask Washer Bree in Mossbrook for rope · 3 clear the beasts that are prowling the Fields
//   4 lower the rope, and what has been keeping the pup down there comes up instead · 5 pull the pup out
// pr.wellq = { step, n }. Step numbers: 0 unheard, 1 need rope, 2 hunting, 3 ready to lower, 4 fighting, 5 pup, 6 done.
const WELLQ = { hunt: 15, near: 38, lurker: { hp: 3.5, minHp: 900, rank: 3 } };
const wellQ = pr => pr.wellq || (pr.wellq = { step: 0, n: 0 });
function wellNear(w) {
  const p = w.player; let best = null, bd = WELLQ.near;
  if (w._mhOf !== w.objects) { w._mhOf = w.objects; w._mhWells = w.objects.filter(o => o.landmark === 'Windmill Hill' && o.bank === '042'); }   // (found again only when the object list is replaced)
  const wells = w._mhWells;
  for (const o of wells) { const d = Math.hypot(o.x - p.x, o.bottom - p.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
const wellDialog = (game, first, pages, done) => { const m = dialogMenu('The Old Well', first, null); m.pages = pages; m.onDone = done; game.openMenu(m); };
// Enter beside a Windmill Hill well (main.js)
function wellInteract(game, w) {
  const pr = game.profile, Q = wellQ(pr), o = wellNear(w); if (!o || Q.step >= 6) return false;
  if (Q.step === 0) wellDialog(game, 'You lean over the stones. Far below, something whimpers.', ['It sounds small. And cold. The rope here rotted away long ago.', 'The washerwomen of Mossbrook will have rope, if you ask.'], () => { Q.step = 1; game.save(); });
  else if (Q.step === 1) game.openDialog('The Old Well', 'The whimpering goes on. You need rope. Washer Bree, in Mossbrook.', null);
  else if (Q.step === 2) game.openDialog('The Old Well', `The beasts are still prowling near here. Bree said to clear them first (${Q.n}/${WELLQ.hunt}).`, null);
  else if (Q.step === 3) wellDialog(game, 'You tie off Bree\'s line and let it down.', ['It goes taut. Something has hold of it. Something much bigger than a pup.'], () => { Q.step = 4; game.save(); wellLurker(game, w, o); });
  else if (Q.step === 4) { if (!w.actors.some(a => a.wellBoss && !a.dead)) wellLurker(game, w, o); else return false; }
  else if (Q.step === 5) wellDialog(game, 'The line comes up light. A grey pup is clinging to it, all ribs and eyes.', ['It looks at you for a long moment. Then it shakes itself dry and sits at your heel.'], () => {
    Q.step = 6; pr.wolf = pr.wolf || { lv: 1, xp: 0, pts: 1, sk: {}, card: null }; petOf(pr, 'wolf'); spawnDog(w, w.player, 'wolf');
    game.toast('The LOYAL WOLF joins you! It fights beside your hound. Press N, then Tab to train it', '#ffd27a'); game.gainExp(Math.round(expNeed(pr.lv || 1) * 0.5)); game.save();
  });
  return true;
}
function wellLurker(game, w, o) {
  const p = w.player, Z = ZONES[0], sp = Z.mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].hp - SPECIES[a].hp)[0], at = findOpen(w, o.x + 40, o.bottom + 10), L = WELLQ.lurker;
  const m = makeMonster(sp, L.rank, at.x, at.y);
  Object.assign(m, { boss: true, wellBoss: true, heavy: true, scale: 1.6, label: 'Well Lurker', home: { x: at.x, y: at.y } }); giveWildKit(m);
  m.maxHp = m.hp = Math.round(Math.max(L.minHp, p.maxHp * L.hp)); w.actors.push(m);
  w.rings.push({ x: at.x, y: at.y, r: 40, t: 0, col: '#8fd8ff' }); w.shake = Math.max(w.shake || 0, 5); game.toast('The WELL LURKER climbs out!', '#ff9a7a');
}
function wellBossKill(game) { const pr = game.profile, Q = wellQ(pr); if (Q.step === 4) { Q.step = 5; game.toast('The line slackens. Go back to the well.', '#ffe9a8'); game.save(); } }
// the hunt, from the same kill events as the contracts (quests.js)
function wellEvent(game, type, info) {
  const Q = wellQ(game.profile); if (Q.step !== 2 || type !== 'kill' || info.zone !== 0) return;
  if (++Q.n >= WELLQ.hunt) { Q.step = 3; game.toast('The Fields are quiet. Go back to the well with the rope.', '#ffe9a8'); game.save(); }
}
// Washer Bree, in Mossbrook (townlife.js)
function wellTalk(game, a) {
  const Q = wellQ(game.profile); if (Q.step !== 1 || a.label !== 'Washer Bree') return false;
  game.openDialog(a.label, `A pup down the old well? Take my spare line. But the beasts up there will have your throat while you are tying knots. Clear ${WELLQ.hunt} of them first.`, null);
  Q.step = 2; Q.n = 0; game.save(); return true;
}
// walking up to the well the first time, and the line in the tracker
function wellTick(game, w) {
  wellsPlace(w);
  const pr = game.profile; if (!pr || wellQ(pr).step >= 6) return;
  const o = wellNear(w), on = !!o; if (on && !w._wellHere) game.toast(pr.wellq.step === 0 ? 'A faint whimper comes from the well. Press Enter.' : 'The old well. Press Enter.', '#ffe9a8'); w._wellHere = on;
}
function wellTracker(game, y) {
  const pr = game.profile, Q = pr && pr.wellq; if (!Q || !Q.step || Q.step >= 6) return y;
  const line = [null, 'Ask Washer Bree in Mossbrook for rope', `Clear the Verdant Fields ${Q.n}/${WELLQ.hunt}`, 'Take the rope back to the well', 'Defeat the Well Lurker', 'Pull the pup out of the well'][Q.step];
  text('◆ The Well on Windmill Hill', VW - 8, y, '#8fd8ff', 7.5, 'right'); text(line, VW - 8, y + 10, '#fff4d8', 6.6, 'right');
  return y + 22;
}
// THE WILD WELLS: every well out in the zones can be tried again 24 in-game hours after the last time (pr.wells[key] = when), and shows a "!" while it
// can. What's down there is settled by the well and the day, so coming back can't change it. Three things can come up: a lost
// PET (it takes a Rope from the Grocer, used up; without one the well keeps it for you to come back), a CARD from F to A, or GOLD
// AND FOOD, with a boss that climbs out after them. Mostly it's just cold water.
const WELLS = { bank: '042', near: 34, pet: 0.1, card: 0.2, boss: 0.2, gold: [80, 40], food: ['bread', 'berry', 'carrot', 'tomato'], bossHp: 3, zones: [1, 2] };
const wellKey = o => `${Math.round(o.x)},${Math.round(o.y)}`;
const wellClock = pr => (pr.day || 0) * DAY.len + (pr.clock || 0);
// how long until a well can be tried again (older saves kept the day number, not the time)
function wellWait(pr, key) { const v = (pr.wells || {})[key]; if (v == null) return 0; return Math.max(0, (v < 1e5 ? v * DAY.len : v) + DAY.len - wellClock(pr)); }
// Twilight Grove and the Skyreach Isles came with no wells: one in each of their areas (the same spot every visit)
function wellsPlace(w) {
  if (w.wellsPut || !w.overworld) return; w.wellsPut = true; w.wildWells = null;
  REGIONS.forEach(R => { if (!WELLS.zones.includes(R.zone)) return; const r = rng(hashStr(`well${R.key}${WORLD_SEED}`));
    for (let k = 0; k < 80; k++) { const x = (R.ox + 4 + r() * (R.w - 8)) * T, y = (R.oy + 5 + r() * (R.h - 9)) * T; if (!mapReach(w.map, x, y) || w.blocked(x, y) || w.blocked(x - 16, y) || w.blocked(x + 16, y) || w.blocked(x, y - 16) || w.blocked(x, y + 12)) continue;
      const o = makeMapObject([42, 0, Math.round(x), Math.round(y), true]); if (o) w.objects.push(o); break; }
  });
}
const wildWells = w => w.wildWells || (w.wildWells = w.objects.filter(o => o.bank === WELLS.bank && !inTown(o.x) && regionAt(o.x).zone >= 0));
function wellOpen(game, o) { if (!o || o.bank !== WELLS.bank) return false; const w = game.world, pr = game.profile; return !!(pr && w && w.overworld && !w.interior && wildWells(w).includes(o) && !wellWait(pr, wellKey(o))); }
function wildWellNear(w) { const p = w.player; let best = null, bd = WELLS.near; for (const o of wildWells(w)) { const d = Math.hypot(o.x - p.x, o.bottom - p.y); if (d < bd) { bd = d; best = o; } } return best; }
// Enter beside a wild well (main.js)
function wellLuck(game, w) {
  if (!w.overworld) return false; const o = wildWellNear(w); if (!o) return false;
  const pr = game.profile, day = sideToday(pr), key = wellKey(o); pr.wells = pr.wells || {};
  if (wellWait(pr, key)) { game.toast(`Nothing more down there yet. Try again in ${Math.ceil(wellWait(pr, key) / (DAY.len / 24))} hours`, '#c9c1a8'); return true; }
  const r = hashStr(`${key}:${day}`) % 1000 / 1000, Z = WELLS, pet = !pr.wolf ? 'wolf' : !pr.drake ? 'drake' : null, zone = regionAt(o.x).zone, used = () => { pr.wells[key] = wellClock(pr); game.save(); };
  if (r < Z.pet && pet) {
    if (!((pr.items || {}).rope > 0)) { game.openDialog('The Old Well', 'Something is alive down there, far below. You would need a Rope to reach it. The Grocer sells them.', null); return true; }
    addItem(pr, 'rope', -1); used();
    if (pet === 'wolf') { wellQ(pr).step = 6; pr.wolf = { lv: 1, xp: 0, pts: 1, sk: {}, card: null }; petOf(pr, 'wolf'); spawnDog(w, w.player, 'wolf'); game.toast('You pull a grey pup out of the well: the LOYAL WOLF joins you!', '#ffd27a'); }
    else giveDrakeEgg(game);
    return true;
  }
  if (r < Z.pet + Z.card) { used(); const c = makeCard(pick(ZONES[zone].mobs.filter(id => D.monsters[id])), rareGate(randi(0, 5))); game.pickup({ kind: 'card', item: c }); game.toast(`The bucket comes up with a card: ${cardName(c)} (${RANKS[c.tier]})`, '#ffd27a'); return true; }
  if (r < Z.pet + Z.card + Z.boss) {
    used(); const g = Z.gold[0] + Z.gold[1] * zone * 3 + randi(0, Z.gold[1]), food = pick(Z.food); pr.gold = (pr.gold || 0) + g; addItem(pr, food, 2); floatText(w, o.x, o.bottom - 44, `+${g} G`, '#ffd23f', 10);
    const R = regionAt(o.x), at = findOpen(w, o.x + 44, o.bottom + 8), m = makeMonster(pick(ZONES[zone].mobs.filter(id => D.monsters[id])), Math.min(9, areaRank(R) + 1), at.x, at.y);
    Object.assign(m, { boss: true, wellGuard: true, heavy: true, scale: 1.5, label: 'Well Lurker', home: { x: at.x, y: at.y }, region: zone, area: R.key }); giveWildKit(m); m.maxHp = m.hp = Math.round(m.maxHp * Z.bossHp); w.actors.push(m);
    w.rings.push({ x: at.x, y: at.y, r: 40, t: 0, col: '#8fd8ff' }); w.shake = Math.max(w.shake || 0, 5); game.toast(`${g} G and ${ITEMS[food].name}… and something climbs out after them!`, '#ff9a7a'); return true;
  }
  used(); game.toast('Only cold water. Try again another day', '#c9c1a8'); return true;
}
