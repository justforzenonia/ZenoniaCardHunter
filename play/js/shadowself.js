'use strict';
// THE TRUE VILLAIN IS YOU (2026-11-19, the user: "the true villain is you but a shadow version of yourself, with the exact same
// abilities and skills the hero has, but maxed out"). When the Sun Sovereign falls in the Sun Temple, its shell cracks and your
// SHADOW steps out of the light, UMBRA, with a name of its own (the user did not want it wearing the hero's name): your class, your look, your deck and skill cards, your equipped gear, all of it maxed:
//   - level MAX_LV, with every stat point spent in the same shares as yours (evenly if you have spent none)
//   - every card at the top rank (SSS+), every piece of equipped gear remade at the top tier
//   - HP x SHADOW.hp, so it lasts like a last boss
// It fights as a hero does (combos, dashes, guards, your three cards and your Layer), driven by the arena's computer player
// (world.js cpuInput). Beat it and the story ends; the epilogue says so. It is the last step of Chapter IV, so the chapter's
// tracker reads "Defeat your Shadow" once it has risen. Saved as pr.story.shadowRisen (the Sovereign is not fought again).
const SHADOW = { name: 'Umbra', title: 'your Shadow', hp: 3, tier: 9, gearTier: 9, filter: 'brightness(0.32) saturate(0.35) hue-rotate(230deg) contrast(1.25) drop-shadow(0 0 2px #8a3aff) drop-shadow(0 0 4px rgba(120,40,255,0.6))', col: '#b07aff', near: 700 };
const SHADOW_RISE = [
  'The Sovereign\'s shell cracks open… and someone steps out of the light.',
  'It has your face. Your stance. Your cards, held the way you hold them.',
  '"Did you think the seals were holding IT? They were holding ME."',
  '"Every Guardian you broke, every card you drew, every step from Hearthvale. I learned it all, and I learned it better."',
  '"I am everything you could ever be. Call me Umbra. Let us see which of us is real."',
];
// your shadow's profile: a copy of yours, maxed out
function shadowProfile(pr) {
  const S = JSON.parse(JSON.stringify(pr));
  S.lv = MAX_LV;
  const total = (MAX_LV - 1) * POINTS_PER_LV, spent = ATTRS.reduce((s, A) => s + attrOf(pr, A.id), 0);
  S.attr = {}; let left = total;
  ATTRS.forEach((A, i) => { const n = i === ATTRS.length - 1 ? left : Math.floor(total * (spent ? attrOf(pr, A.id) / spent : 1 / ATTRS.length)); S.attr[A.id] = n; left -= n; });
  S.cards = (S.cards || []).map(c => ({ ...c, tier: SHADOW.tier }));
  for (const slot of GEAR_SLOTS) {
    const g = (S.gear || []).find(q => q.uid === (S.eq || {})[slot]); if (!g) continue;
    let G2 = null; try { G2 = makeGear(slot, SHADOW.gearTier, S.cls); } catch (e) {}
    if (G2) { G2.uid = g.uid; if (g.look != null) G2.look = g.look; G2.dur = null; S.gear[S.gear.indexOf(g)] = G2; }
  }
  return S;
}
function spawnShadow(game, w, x, y) {
  if (w.actors.some(a => a.shadowSelf && !a.dead)) return;
  const pr = game.profile, at = findOpen(w, x, y), a = makePlayerActor(shadowProfile(pr), 1, at.x, at.y);
  a.maxHp = a.hp = Math.round(a.maxHp * SHADOW.hp); a.mp = a.maxMp;
  Object.assign(a, { shadowSelf: true, label: SHADOW.name, marker: SHADOW.col, dir: dirTo(w.player.x - at.x, w.player.y - at.y) });
  w.actors.push(a);
  if (typeof spawnFamiliars === 'function') try { spawnFamiliars(w, a); } catch (e) {}
  return a;
}
// the Sovereign falls: its shell cracks, the shadow rises (instead of the ending)
{
  const sk = storyKill;
  storyKill = (game, w, m) => {
    const pr = game.profile, S = pr && storyState(pr);
    if (m && m.storyFinal && S && !S.won) {
      S.shadowRisen = true; game.save();
      w.flash = { t: 0, dur: 1200, col: '#2a0a4a' }; w.shake = Math.max(w.shake || 0, 6);
      const x = m.x, y = m.y, d = dialogMenu('???', SHADOW_RISE[0], null); d.pages = SHADOW_RISE.slice(1);
      d.onDone = () => { spawnShadow(game, game.world, x, y); game.toast(`${SHADOW.name.toUpperCase()}, YOUR SHADOW, RISES`, SHADOW.col); };
      game.openMenu(d); return;
    }
    return sk(game, w, m);
  };
}
// once risen, the temple holds your shadow, not the Sovereign; the tracker says so
{
  const sf = spawnFinal;
  spawnFinal = (game, w) => {
    const S = storyState(game.profile); if (!S.shadowRisen) return sf(game, w);
    const at = finalSpot(w); if (!at || w.actors.some(a => a.shadowSelf && !a.dead) || game.menu) return;
    if (Math.abs(w.player.x - at.x) > SHADOW.near) return;
    spawnShadow(game, w, at.x, at.y);
    if (!w._shadowSeen) { w._shadowSeen = true; game.toast(`${SHADOW.name}, your shadow, is waiting in the Sun Temple`, SHADOW.col); }
  };
  const st0 = storyTick;
  storyTick = (game, w) => {
    const pr = game.profile, S = pr && storyState(pr), F = CHAPTERS[3] && CHAPTERS[3].steps.find(s => s.id === 'final');
    if (F) { F._t0 = F._t0 || F.text; F.text = S && S.shadowRisen ? `Defeat ${SHADOW.name}, your Shadow, in the Sun Temple` : F._t0; }
    return st0(game, w);
  };
}
// it falls: the story ends
{
  const k0 = kill;
  kill = (world, a) => {
    if (!a.shadowSelf) return k0(world, a);
    a.dead = true; a.state = 'dead'; setAnim(a, 'down', true); a.leaveT = 1600;
    world.rings.push({ x: a.x, y: a.y, r: 30, t: 0, col: SHADOW.col });
    for (const f of world.actors) if (f.owner === a) f.remove = true;   // (its familiars go with it)
    const game = window.GAME; if (!game || !game.profile) return;
    const S = storyState(game.profile); if (S.won) return;
    S.won = true; S.shadowWon = true; game.save();
    storyEnding(game, world);
  };
  const lf = landlordFade;   // (its body fades, as the landlord does)
  landlordFade = (w, dt) => { for (const a of w.actors) if (a.shadowSelf && a.leaveT != null) { a.leaveT -= dt; a.alpha = Math.max(0, Math.min(1, a.leaveT / 1000)); if (a.leaveT <= 0) a.remove = true; } return lf(w, dt); };
}
// it looks like you, cast in shadow
{
  const af = actorFilter;
  actorFilter = a => a.shadowSelf ? SHADOW.filter : af(a);
}
// its bar at the foot of the screen, as a boss's
{
  const db = drawBossBar;
  drawBossBar = (game, w, now) => {
    const p = w && w.player, a = p && w.actors.find(q => q.shadowSelf && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 420);
    if (!a) return db(game, w, now);
    const W = 300, H = 30, x = VW / 2 - W / 2, y = VH - 90, f = Math.max(0, a.hp / a.maxHp);
    ctx.save(); hudNine('assets/hud_panel_warm.png', x, y, W, H, 0.5);
    text(`${SHADOW.name.toUpperCase()} · ${SHADOW.title.toUpperCase()}`, VW / 2, y + 9, '#e8d0ff', 8);
    ctx.fillStyle = 'rgba(10,6,20,0.9)'; ctx.fillRect(x + 14, y + 16, W - 28, 7);
    const g = ctx.createLinearGradient(x, 0, x + W, 0); g.addColorStop(0, '#5a1aa8'); g.addColorStop(1, '#c08aff'); ctx.fillStyle = g; ctx.fillRect(x + 14, y + 16, Math.round((W - 28) * f), 7);
    ctx.restore();
  };
}
