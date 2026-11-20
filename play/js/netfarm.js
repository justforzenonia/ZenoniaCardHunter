'use strict';
// THE SHARED FARM AND HOME VISITS in online co-op (net.js).
//   FARM HELP    a friend in the host's town presses Enter on one of the host's plots or farm animals: the HOST's game does the
//                work on the host's own save, as if the host had pressed it there. Rough ground is tilled; tilled soil (and the empty tilled plots beside it in the row) is planted
//                with the host's most plentiful seed (no menu); a growing crop is watered (a helper brings their own can, so the host's
//                stays full); a ripe one is harvested into the host's bag; a hungry animal is fed from the host's crops, a ready one
//                collected. Everyone hears what was done.
//   THE FARM     each friend sees the host's fields (drawFarm with the host's save), not their own.
//   HOME VISITS  inside the host's home a friend's Enter on the storage chest or the stove opens THEIR OWN storage and kitchen.
const NFARM = { reach: 26 };
// the guest's Enter (net.js netGuestTalk): true when it was meant for the farm or the home
function netFarmTalk(game, w) {
  const N = game.net, p = w.player;
  if (w.home) {   // the host's home: its chest and stove serve the friend's own save
    let f = null, bd = 24; for (const o of w.homeFeats || []) if (o.kind === 'chest' || o.kind === 'stove') { const d = Math.hypot(p.x - o.x, p.y - o.y); if (d < bd) { bd = d; f = o; } }
    if (!f) return false;
    game.openMenu(f.kind === 'chest' ? storageMenu() : kitchenMenu()); return true;
  }
  if (nearCamp(w, 'fire')) { game.openMenu(campfireMenu()); return true; }   // the town's campfire and pantry, on the friend's own save (a roast is shared: netplay.js)
  if (nearCamp(w, 'chest')) { game.openMenu(pantryMenu()); return true; }
  if (!w.overworld || w.interior || !inTown(p.x) || nearPlot(w) < 0) return false;
  N.sentAt = performance.now(); netApi(N.IN, { mx: 0, my: 0, ack: N.ack, fm: 1 }).catch(() => {}); return true;
}
// a yard animal ask (after the town folk had nothing to say): the host checks for one by the friend
function netFarmAnimal(game, w) {
  const N = game.net; if (!w.overworld || w.interior || !inTown(w.player.x)) return false;
  N.sentAt = performance.now(); netApi(N.IN, { mx: 0, my: 0, ack: N.ack, fm: 1 }).catch(() => {}); return true;
}
// the host's game: friend gid pressed Enter on the farm
function netFarmHelp(game, gid) {
  const N = game.net, w = game.world, a = w && netGuestActor(w, gid); if (!a || a.dead || !w.overworld || w.interior || !inTown(a.x)) return;
  const pr = game.profile, F = farmer(pr), who = N.guests[gid] ? netName(N.guests[gid].prof) : 'A friend', said = [], toast = game.toast, me = w.player, near = w.yardNear;
  game.toast = (s, c) => said.push(s);   // (what was done is told to everyone, with the friend's name)
  w.player = a;
  try {
    const i = nearPlot(w);
    if (i >= 0) {
      const P = farmOf(pr)[i];
      if (P && P.tilled && !P.crop && !plotLocked(pr, i) && plotOpen(pr, i)) netFarmPlant(game, i);
      else { const can = F.water; F.water = Math.max(1, can); plotInteract(game, i); F.water = can; if (game.menu && game.menu.type === 'plant') game.closeMenu(); }
    } else {
      let A = null, bd = YARD.reach; for (const B of w.animals || []) { if (!B.farm || !B.yardKey) continue; const d = Math.hypot(B.x - a.x, B.y - a.y); if (d < bd) { bd = d; A = B; } }
      if (A) { w.yardNear = A; yardTend(game, w); }
    }
  } catch (e) { console.warn('co-op farm', e); }
  finally { w.player = me; w.yardNear = near; game.toast = toast; }
  if (!said.length) return;
  N.hostT = 0;   // (the host's save goes out with the next snapshot, so the friend sees the field change at once)
  netDuelNews(game, `${who}: ${(said.find(s => /^Harvested/.test(s)) || said[said.length - 1]).replace(/ · can \d+\/\d+/, '')}`);   // (a harvest line wins over a Prize Crop or level message after it: farmrow.js)   // (the host's can is untouched)
}
// tilled soil and a friend's Enter: the host's most plentiful seed goes in (updatePlant without its menu)
function netFarmPlant(game, i) {
  const pr = game.profile, seeds = seedIds(pr).sort((x, y) => itemCount(pr, y) - itemCount(pr, x)), id = seeds[0];
  if (!id) { game.toast('No seeds in the host’s bag: the Grocer sells them', '#ffd27a'); return; }
  if (typeof plantRow === 'function') { plantRow(game, i, id); return; }   // (the whole row, like R in the host's seed list: home.js)
  addItem(pr, id, -1);
  const fresh = farmOf(pr)[i] = { tilled: true, crop: ITEMS[id].crop, grown: 0, t: Date.now(), wet: 0 }; fertilize(pr, fresh);
  farmXp(game, 2); game.save();
  const c = plotCentre(i); game.world.rings.push({ x: c.x, y: c.y, r: 16, t: 0, col: '#8fffb0' });
  game.toast(`Planted ${ITEMS[ITEMS[id].crop].name} on the host’s farm`, '#8fffb0');
}
// a friend's screen shows the host's fields and yard (the host's save in place of their own while it is drawn)
{
  const withHost = (fn, args) => { const N = window.GAME && GAME.net, mine = GAME.profile; if (!N || N.role !== 'guest' || !N.host) return fn(...args); GAME.profile = N.host; try { return fn(...args); } finally { GAME.profile = mine; } };
  const df = drawFarm; drawFarm = (...args) => withHost(df, args);
}
