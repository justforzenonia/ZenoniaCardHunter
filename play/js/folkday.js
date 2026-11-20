'use strict';
// A TOWNSPERSON'S DAY: the folk who are out (folk.js) go somewhere instead of pacing about: to a shop, a stall, the fountain, the mill.
// When they arrive they say something, in a small bubble you only see when you are close by.
// FAVOURS: about half of them want something small today (a "!" over their head). Talk to them to hear what, bring it, and they pay
// you back in gold and a useful material; in the outposts it earns Renown too. New favours each day. Animals don't ask.
const FOLK_DAY = { range: 320, speed: 28, sayMs: 2800, sayMax: 2, sayNear: 240, y: 65,
  shop: ['What is fresh today?', 'Just looking, thanks.', 'How much for that one?', 'Put it on my tab.', 'Anything new in?'],
  chat: ['Lovely day for it.', 'Did you hear about the seals?', 'Mind the Wilds, friend.', 'Have you eaten yet?', 'Same as ever.'],
  night: ['Late, isn\'t it?', 'Can\'t sleep.', 'Stay in the light.', 'Quiet tonight.'],
  spots: [[22, 21, ['Still no decent card.', 'One more coin for luck.', 'I love this fountain.']], [11, 27, ['Smells good.', 'Save me some.', 'Warm enough for me.']], [13, 30, ['Good clean water.', 'The well is low.']],
    [24, 24, ['Coming along nicely.', 'That is a good crop.', 'Who planted these?']], [46, 16, ['Those sails never stop.', 'Fresh flour soon.']], [62, 20, ['Who was he, anyway?', 'He looks tired.']], [70, 13, ['Nice street, this.', 'Nobody home.']]] };
const FAVOUR = { gold: 80, renown: 20, xp: 0.04,
  asks: [['wheat', 5], ['carrot', 3], ['tomato', 3], ['berry', 3], ['pumpkin', 2], ['lettuce', 3], ['nectarine', 2], ['egg', 2], ['milk', 2], ['wool', 1], ['fish', 2], [M.copper, 3], [M.herb, 3], [M.pine, 3], [M.thinL, 2], [M.bone, 2]],
  gifts: [[M.linenT, 2], [M.herb, 2], [M.copper, 3], [M.pine, 2], [M.fert, 2], [M.salt, 1], [M.bottle, 2], ['feed', 3]],
  ask: [w => `I don't suppose you could spare ${w}? I would make it worth your while.`, w => `I need ${w} and I can't get away today. Could you bring some by?`, w => `You look like someone who has ${w} to hand. Bring it here and I'll see you right.`],
  thanks: ['Oh, perfect! Here, this is for your trouble.', 'You remembered! Take this, I insist.', 'Just what I needed. Fair is fair, take this.'] };
// who is out today and asks for something; everyone is the same all day, however often the world is rebuilt
function favourOf(pr, a) {
  if (!a.favour || !pr) return null;
  const h = Math.abs(hashStr(`${WORLD_SEED}:${a.label}:${dayNo()}`)); if (h % 2) return null;
  const S = pr.favours && pr.favours.day === dayNo() ? pr.favours : (pr.favours = { day: dayNo(), who: {} }), [r, n] = FAVOUR.asks[(h >>> 1) % FAVOUR.asks.length];
  return { r, n, gift: FAVOUR.gifts[(h >>> 5) % FAVOUR.gifts.length], words: `${n} ${matName(r)}`, st: S.who[a.label] || 0, S, h };
}
function favourMark(pr, a) { const F = favourOf(pr, a); return !!F && (F.st === 0 || (F.st === 1 && matHave(pr, F.r) >= F.n)); }
function favourTalk(game, a) {
  const pr = game.profile, F = favourOf(pr, a); if (!F || F.st === 2) return false;
  if (F.st === 0) { F.S.who[a.label] = 1; (F.S.ask = F.S.ask || {})[a.label] = F.words; game.openDialog(a.label, FAVOUR.ask[F.h % FAVOUR.ask.length](F.words), null); game.toast(`Favour: ${F.words} for ${a.label}`, '#ffe9a8'); game.save(); return true; }
  const have = matHave(pr, F.r);
  if (have < F.n) { game.openDialog(a.label, `Still hoping for ${F.words}. You have ${have} so far.`, null); return true; }
  const [gr, gn] = F.gift, gold = FAVOUR.gold * ((a.town || 0) + 1); matGive(pr, F.r, -F.n); matGive(pr, gr, gn); pr.gold = (pr.gold || 0) + gold; F.S.who[a.label] = 2;
  if (a.town != null) tlGain(game, a.town, FAVOUR.renown); game.gainExp(Math.round(expNeed(pr.lv || 1) * FAVOUR.xp));
  game.openDialog(a.label, FAVOUR.thanks[F.h % FAVOUR.thanks.length], null); game.toast(`Favour done: +${gold} G · +${gn} ${matName(gr)}`, '#ffd27a'); game.save(); return true;
}
// where to next: someone's stall or a place in town within reach of home, or just a stroll
function folkPlan(w, n) {
  const ai = n.ai, Z = FOLK_DAY, h = n.home, night = nightK(GAME.profile) > 0.5, near = (x, y) => Math.abs(x - h.x) < Z.range && Math.abs(y - h.y) < Z.range;
  const spots = w.actors.filter(a => a !== n && a.kind === 'npc' && a.ai && a.ai.still && near(a.x, a.y)).map(a => ({ x: a.x + (Math.random() < 0.5 ? -20 : 20), y: a.y + 12, say: Z.shop }));
  if (inTown(h.x)) for (const [x, y, say] of Z.spots) { const X = x * T + 8 + TOWN_OX, Y = y * T + 8 + TOWN_OY; if (near(X, Y)) spots.push({ x: X, y: Y, say }); }
  const to = spots.length && Math.random() < 0.7 ? pick(spots) : { x: h.x + rand(-100, 100), y: h.y + rand(-60, 60), say: Math.random() < 0.4 ? Z.chat : null };
  for (const S of campSpots()) if (Math.hypot(S.fire.x - to.x, S.fire.y - to.y) < 36) to.x = S.fire.x - 40;   // (nobody stands in the campfire)
  ai.tx = to.x + rand(-6, 6); ai.ty = to.y + rand(-4, 4); ai.walk = true; ai.stuck = 0; ai.line = to.say ? pick(night ? Z.night : to.say) : null;
  ai.t = Math.hypot(ai.tx - n.x, ai.ty - n.y) / Z.speed * 1000 + rand(1800, 4000);
}
function folkSay(w, n, s) { const Z = FOLK_DAY; if (!(n.line && n.line.includes('(')) && w.player && dist(n, w.player) < Z.sayNear && w.actors.filter(a => a.say).length < Z.sayMax) n.say = { s, t: Z.sayMs }; }
function drawFolkSay(a, y) {
  const INK = '#2a1a0a', P = pixText(a.say.s, fontPx(8), 700, [INK, INK, INK], null), wd = Math.ceil(P.w) + 12, x = Math.round(a.x - wd / 2), Y = Math.round(y - FOLK_DAY.y);   // (no dark outline: on a pale bubble it smears the letters)
  ctx.save(); ctx.fillStyle = '#fff8e6'; ctx.strokeStyle = INK; ctx.lineWidth = 1; rrect(ctx, x, Y, wd, 14, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(a.x - 3, Y + 13.5); ctx.lineTo(a.x + 3, Y + 13.5); ctx.lineTo(a.x, Y + 17); ctx.closePath(); ctx.fill(); ctx.restore();
  drawPix(P, a.x, Y + 7, 'center');
}
// THE HOUSES: the East End and each outpost have homes with people in them. Everyone in a town's crowd lives in one (the same one every day),
// and whoever isn't out today is at home: two at most to talk to, with their own favours. A house with everyone out is locked.
function folkDoors(people, spots, town) {
  const houses = spots.map((S, i) => ({ ...S, key: HOMES[(i + (town || 0)) % HOMES.length], in: [] })).filter(H => MAPS[H.key]);
  if (!houses.length) return [];   // (a town with no homes to spare: Duskhollow's village has only its shops, hall and the house for sale)
  people.forEach((who, i) => { if (who.label && who.line && !who.line.includes('(')) { const H = houses[i % houses.length]; if (H.in.length < 2) H.in.push(who); } });
  return houses.map(({ x, y, key, in: [a, b] }) => a ? { x, y, key, role: 'folk', folkTown: town, npc: a.npc, label: a.label, line: a.line, favour: true, guest: b, place: `${a.label}${a.label.endsWith('s') ? "'" : "'s"} House`, sym: '⌂' } : { x, y, key, role: 'folk', empty: true, place: 'Nobody home', sym: '⌂' });
}
function eastDoors() {
  const out = new Set(folkToday(TOWN_CROWD, TOWN_SLOTS.length, n => n.x, 0));
  const people = TOWN_CROWD.map(n => { if (out.has(n)) return {}; const old = !n.label && n.npc !== '100' && HOME_FOLK.find(F => F.npc === n.npc && F.line); return old ? { npc: n.npc, label: old.label, line: old.line } : n; });
  return folkDoors(people, VILLAGE.houses.filter(h => h[0] === 13).map(([, , bx, by]) => ({ x: bx * T + 8 + TOWN_OX, y: by * T + TOWN_OY })), undefined);
}
function outpostDoors() {
  return OUTPOSTS.flatMap(O => { const out = new Set(folkToday(FOLK.outposts[O.i], OUTPOST_OUT, F => F[2], O.i + 1));
    const people = FOLK.outposts[O.i].map(F => out.has(F) ? {} : { npc: F[0], label: F[1], line: F[4] });
    return folkDoors(people, outpostLayout(O.i).houses.map(H => ({ x: O.x0 + H.bx * T + 8, y: O.R.oy * T + H.by * T })), O.i); });
}
// NIGHT IN TOWN: after dark the townsfolk walk to the nearest door and go in, and come out again in the morning. Shopkeepers, Elders and errand-givers
// keep working, and Hearthvale has two people who only come out at night.
function folkNight(w, n) {
  const ai = n.ai, night = nightK(GAME.profile) > 0.5;
  if (ai.nightOnly) { n.away = !night; return false; }
  if (!ai.nightOff) return false;
  if (!night) { n.away = false; ai.bed = null; return false; }
  if (n.away) return true;
  if (ai.still) { n.away = true; n.say = null; return true; }
  if (!ai.bed) { let best = { x: n.home.x, y: n.home.y }, bd = 1e9; for (const d of townDoors()) { const q = Math.hypot(d.x - n.x, d.y - n.y); if (q < bd) { bd = q; best = d; } } ai.bed = { x: best.x, y: best.y + 10, t: bd / FOLK_DAY.speed * 1500 + 1000 }; }
  const B = ai.bed, dx = B.x - n.x, dy = B.y - n.y, d = Math.hypot(dx, dy), x0 = n.x, y0 = n.y, sp = FOLK_DAY.speed * 16 / 1000;
  return { B, dx, dy, d, x0, y0, sp };
}
