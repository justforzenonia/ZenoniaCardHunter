'use strict';
// RENT: Grandpa warned you. Every RENT.days in-game days (counted by pr.day in daynight.js) the rent falls due:
// 2500 G. While it is owed, the landlord waits at the first bridge out of Hearthvale, the next time you
// head out. Pay him there and you are square for another month. Can't (or won't) pay? He sets his MERCENARIES on
// you: while you are in the Wilds they keep finding you, a few at a time, scaled to your level and casting cards —
// until you go back to the bridge and pay. If they kill you they take ALL your gold and leave — and come back
// RENT.back days later, again and again, until the rent is paid. Their sprite is a card too (species 'merc').
// After you turn him away he leaves the bridge and comes back every in-game hour (RENT.lordEvery) until you pay;
// once paid, the next rent is RENT.days days off as usual.
// THE THIRD RENT IS THE LAST (2026-11-19, the user): pay him three times and he hands you the deed. The house is yours, no rent
// ever again, and the landlord never comes back (pr.rent.owned).
// Saved on the profile as pr.rent = { due (day number), owed, hunted, back (the day they return, while away),
//   lordNext (in-game time, ms, when the landlord is back at the bridge), paid (times paid), owned }.

const RENT = { buyout: 3, gold: 2500, days: 3, back: 3, lordEvery: () => DAY.len / 24, landlord: { npc: '113', name: 'The Landlord' }, every: 40000, first: 8000, max: 3, pack: 2 };
const LANDLORD_PAY = [
  'Ah, my favourite tenant. The rent is due — 2500 G, if you please.',
  'Pleasure doing business. See you in three days… and not a day late.',
];
const LANDLORD_BROKE = [
  'Ah, my favourite tenant. The rent is due — 2500 G, if you please.',
  'What? You do not have it? Hmm. That is a shame.',
  'My mercenaries will hunt you down out there until you pay. I will be back here every hour — bring the gold to call them off.',
];

function rentTick(game, w, dt) {
  const pr = game.profile; if (!pr || !pr.grandpa || game.scene !== 'world') return;   // the rent starts once Grandpa has told you
  const R = pr.rent || (pr.rent = { due: (pr.day || 0) + RENT.days, owed: false, hunted: false });
  if (R.owned) return;
  if (R.paid == null) R.paid = Math.min(RENT.buyout, (pr.stats && pr.stats.rentPaid) || 0);   // (older saves: what they have paid so far)
  if (R.paid >= RENT.buyout && !R.owed) { rentOwned(game, w, R); return; }
  const day = pr.day || 0;
  if (!R.owed && R.due - day > RENT.days) R.due = day + RENT.days;   // (saves from when a month was 30 days)
  if (!R.owed && day >= R.due) {
    R.owed = true;
    game.toast(`RENT IS DUE: ${RENT.gold} G. The landlord waits at the bridge out of town`, '#ffb84a'); game.save();
  }
  // killed by the mercenaries: they rob you of every coin and go, and come back RENT.back days later
  const p = w.player;
  if (p.hunterHitT > 0) p.hunterHitT -= dt;
  if (R.hunted && p.dead && p.hunterHitT > 0 && !R.robbedNow) {
    R.robbedNow = true;
    const took = pr.gold || 0; pr.gold = 0; R.hunted = false; R.back = day + RENT.back;
    for (const a of w.actors) if (a.hunter && !a.dead) a.remove = true;
    game.toast(`The mercenaries beat you and took all your gold (−${took} G). They will be back in ${RENT.back} days unless the rent is paid`, '#ff6a6a'); game.save();
  }
  if (!p.dead) R.robbedNow = false;
  if (R.owed && R.back != null && day >= R.back) {
    R.back = null; R.hunted = true; w.huntT = RENT.first;
    game.toast("The landlord's mercenaries are back for the rent!", '#ff6a6a'); game.save();
  }
  if (R.owed && w.overworld && !w.interior) landlordTick(game, w);
  if (R.hunted && w.overworld && !w.interior && !inTown(w.player.x)) huntTick(game, w, dt);
}
// in-game time in ms since day 0
const gameNow = pr => (pr.day || 0) * DAY.len + (pr.clock || 0);
// the landlord at the bridgehead, where Grandpa stood (away for an in-game hour after you turn him away)
function landlordTick(game, w) {
  const pr = game.profile, B = firstBridge(); if (!B || game.menu) return;
  const R = pr.rent; if (!R || R.owned) return;   // (the house is yours: he never comes back)
  if (R.lordNext != null) {
    if (gameNow(pr) < R.lordNext) return;   // still away
    R.lordNext = null;
    game.toast(`The landlord is back at the bridge — he still wants his ${RENT.gold} G`, '#ffb84a'); game.save();
  }
  const p = w.player, bx = (B.x1 + 1) * T, by = B.y * T + 12;
  let L = w.actors.find(a => a.landlord);
  if (!L) {
    if (Math.abs(p.x - bx) > 360 || Math.abs(p.y - by) > 280) return;
    const at = findOpen(w, bx + 34, by);
    L = baseActor('npc', 2, at.x, at.y);
    Object.assign(L, { npc: RENT.landlord.npc, label: RENT.landlord.name, h: 26, home: { x: at.x, y: at.y }, ai: { t: 0, still: true }, landlord: true, marker: '#ffb84a' });
    w.actors.push(L);
  }
  const d = dist(L, p);
  if (d > 140) L.spoke = false;   // walk away and come back: he has his say again
  if (d > 64 || L.spoke) return;
  L.spoke = true; L.dir = dirTo(p.x - L.x, p.y - L.y);
  const pay = (pr.gold || 0) >= RENT.gold, lines = pay ? LANDLORD_PAY : LANDLORD_BROKE;
  const m = dialogMenu(RENT.landlord.name, lines[0], null); m.pages = lines.slice(1);
  m.onDone = () => {
    const R = pr.rent;
    if ((pr.gold || 0) >= RENT.gold) {
      pr.gold -= RENT.gold; R.owed = false; R.back = null; R.lordNext = null; R.due = (pr.day || 0) + RENT.days; bumpStat('rentPaid');
      if (R.hunted) { R.hunted = false; for (const a of w.actors) if (a.hunter && !a.dead) { a.remove = true; w.rings.push({ x: a.x, y: a.y, r: 18, t: 0, col: '#c9c1a8' }); } }
      L.leaveT = 1500; L.marker = null; R.paid = (R.paid || 0) + 1;
      if (R.paid >= RENT.buyout) rentOwned(game, w, R);
      else game.toast(`Rent paid: −${RENT.gold} G. Next rent in ${RENT.days} days${RENT.buyout - R.paid === 1 ? ' · one more and the house is yours' : ''}`, '#8fffb0');
    } else {
      if (!R.hunted && R.back == null) {   // (robbed already: they are coming back on their own)
        R.hunted = true; w.huntT = RENT.first;
        game.toast(`You could not pay ${RENT.gold} G — the landlord's MERCENARIES are hunting you! He will be back at the bridge in an hour`, '#ff6a6a');
      } else game.toast('The landlord stalks off — he will be back at the bridge in an hour', '#ffb84a');
      R.lordNext = gameNow(pr) + RENT.lordEvery();   // he leaves, and is back in an in-game hour
      L.leaveT = 1500; L.marker = null;
    }
    game.save();
  };
  game.openMenu(m);
}
// the deed: no more rent, no more landlord, the mercenaries called off
function rentOwned(game, w, R) {
  R.owned = true; R.owed = false; R.hunted = false; R.back = null; R.lordNext = null; R.due = null;
  for (const a of w.actors) if (a.hunter && !a.dead) a.remove = true;
  game.toast('The landlord hands you the deed: the house is yours now. No more rent, ever!', '#ffd23f'); game.save();
}
// he goes on his way once paid
function landlordFade(w, dt) {
  const L = w.actors.find(a => a.landlord && a.leaveT != null); if (!L) return;
  L.leaveT -= dt; L.alpha = Math.max(0, Math.min(1, L.leaveT / 1000)); if (L.leaveT <= 0) L.remove = true;
}
// the hunt: every so often a pack of mercenaries closes in from off-screen
function huntTick(game, w, dt) {
  w.huntT = (w.huntT ?? RENT.first) - dt;
  if (w.huntT > 0) return;
  w.huntT = RENT.every;
  const alive = w.actors.filter(a => a.hunter && !a.dead).length, p = w.player;
  const n = Math.min(RENT.pack, RENT.max - alive); if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const an = Math.random() * Math.PI * 2, at = findOpen(w, p.x + Math.cos(an) * 230, p.y + Math.sin(an) * 150);
    w.actors.push(makeMercenary(game.profile, p, at.x, at.y));
  }
  game.toast(alive ? 'More mercenaries are coming for the rent!' : "The landlord's mercenaries found you — pay the rent at the bridge to call them off!", '#ff8a6a');
}
// a mercenary scaled to the hero: about your HP, a bit under half your attack, your speed, and one of the cards
function makeMercenary(pr, p, x, y) {
  const lv = pr.lv || 1, tier = Math.max(0, Math.min(9, Math.floor(lv / 8)));
  const m = makeMonster('merc', tier, x, y);
  const pool = SPECIES_IDS.concat(ARCANA_CARDS).filter(id => id !== 'merc');
  Object.assign(m, {
    hunter: true, lvl: lv, maxHp: Math.round((p.maxHp || 120) * 1.1), atk: (p.atk || 10) * 0.45 + lv * 0.3, def: (p.def || 0) * 0.5 + lv * 0.3,
    spd: Math.max(70, (p.spd || 72) * 0.95), crit: 5, pal: 0, scale: 1,
    spell: cardSpell({ sp: Math.random() < 0.4 ? 'merc' : pick(pool), tier }),   // mercenaries fight with cards
    ai: { mode: 'hunt', t: rand(0, 600), tx: x, ty: y, cast: rand(1500, 3500) },
    home: { x, y },
  });
  m.hp = m.maxHp;
  return m;
}
