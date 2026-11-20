'use strict';
// GUEST PETS AND PARTNERS in online co-op (net.js): each friend's own hound, wolf, drake and hero partner come along into the
// host's world and fight beside THEIR hero (built from the friend's save, with its stats, card and level). The host's game runs
// them like its own (a.netOf = the friend's id). They never touch the host's companions or either save: if one falls it only rests
// and comes back to its friend after a while (a hero partner's fall is never for good here).
const NPET = { check: 1000, rest: 20000 };
const netPetsOf = (w, gid) => w.actors.filter(a => a.netOf === gid && !a.remove);
// the host's world frame (net.js netHostTick): bring each friend's companions, and drop any whose friend is not here
function netPetsTick(game, w, dt) {
  const N = game.net; if (!N || N.role !== 'host' || !w || !netShareable(w) || game.scene === 'arena') return;
  if ((N.petT = (N.petT || 0) - dt) > 0) return; N.petT = NPET.check;
  const now = performance.now(); N.petRest = N.petRest || {};
  w.actors = w.actors.filter(a => !a.netOf || (a.owner && w.actors.includes(a.owner) && !a.owner.remove && N.guests[a.netOf]));
  for (const G of netGuestList(game)) {
    const ga = netGuestActor(w, G.gid); if (!ga || ga.dead) continue;
    netPetsSpawn(game, w, G, ga, ['pet', 'wolf', 'drake', 'hero'].filter(k => (N.petRest[G.gid + ':' + k] || 0) > now));   // (one that fell rests; the others still come)
  }
}
// spawn what the friend has and is not already out (spawnDog and spawnPartner read the friend's save for that moment)
function netPetsSpawn(game, w, G, ga, resting = []) {
  const mine = game.profile, all = w.actors, had = new Set(netPetsOf(w, G.gid).map(a => a.netPartner ? 'hero' : a.petKind || 'pet').concat(resting));
  if (['pet', 'wolf', 'drake', 'hero'].every(k => had.has(k) || (k === 'hero' ? !(G.prof.partner && !G.prof.partner.dead) : !G.prof[k] || G.prof[k].dead))) return;
  w.actors = all.filter(a => !a.heroPartner);   // (spawnPartner looks for any partner already out: the host's must not count)
  let made = [];
  game.profile = G.prof;
  try { spawnDog(w, ga); made = w.actors.filter(a => !all.includes(a)); }
  catch (e) { console.warn('co-op pets', e); }
  finally { game.profile = mine; w.actors = all.concat(made); }
  for (const a of made) {
    const k = a.heroPartner ? 'hero' : a.petKind || 'pet';
    if (had.has(k)) { a.remove = true; continue; }
    a.netOf = G.gid;
    if (a.heroPartner) { a.heroPartner = false; a.netPartner = G.prof.partner.id; a.netPaint = G.prof.partner.paint; a.label = G.prof.partner.name; }   // (netPaint: their colours, relayed on, partnerstyle.js)   // (not the host's partner: none of its record or its fall)
  }
  w.actors = w.actors.filter(a => !a.remove);
}
// one of them fell in the host's world (combat.js kill): it rests, then comes back
function netPetDown(world, a) {
  setAnim(a, 'die'); a.remove = true; const N = window.GAME && GAME.net;
  floatText(world, a.x, a.y - 30, `${a.label || 'A friend’s partner'} needs a rest`, '#ff9a8a', 8);
  if (N && N.role === 'host') { N.petRest = N.petRest || {}; N.petRest[a.netOf + ':' + (a.netPartner ? 'hero' : a.petKind || 'pet')] = performance.now() + NPET.rest; }
}
// over its head: its name (for a partner) and its health
function drawNetPetBars(a, y) {
  const top = y - (a.h || 26) * (a.scale || 1) - 5, w = 22, f = Math.max(0, a.hp / a.maxHp);
  if (a.label) text(a.label, a.x, top - 7, a.owner && a.owner.marker || '#8fd8ff', 6.5);
  drawMiniCapsule(a.x, top - 3, w + 2, f);   // (the companions' capsule: world.js)
}
