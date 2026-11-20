'use strict';
// CALM FIELDS: monsters far below a hero leave them alone. When every hero within CALM_FOES.near of an ordinary monster is at
// least level 4 x its tier + CALM_FOES.gap (well past its zone: zone ranks span about 3 tiers, journey.js GUARDIAN_LV steps
// 12 levels), it keeps wandering instead of picking a fight, so walking back through an early zone is quiet. Hit it (any HP
// lost) and it fights as usual. Now and then a calm one near a hero shows a small soft note (♪), so you can tell. Elites, alphas, bosses, mini bosses, familiars and dojo masters are never calm.
const CALM_FOES = { gap: 16, near: 220, hum: 110, every: [4000, 7000] };   // (hum: a calm monster this close to a hero now and then shows a small soft note)
function calmLv(a) {   // a hero's level: yours from your save, a co-op friend's from the profile they joined with (net.js guests), else a.lv
  const G = window.GAME; if (!G) return a.lv || 1;
  if (G.world && a === G.world.player) return (G.profile && G.profile.lv) || 1;
  const F = a.netGid && G.net && G.net.guests && G.net.guests[a.netGid];
  return (F && F.prof && F.prof.lv) || a.lv || 1;
}
{
  const ai = monsterAI;
  monsterAI = (world, m, dt) => {
    if (m.ally || m.boss || m.miniBoss || m.elite || m.alphaKey || m.guardian != null || m.dummy || world.dojo || world.peaceful || (typeof SET !== 'undefined' && SET.calm === false)) { m.calm = false; return ai(world, m, dt); }   // (Settings > CALM FIELDS off)
    if (m.provoked || (m.maxHp && m.hp < m.maxHp)) { m.provoked = true; return ai(world, m, dt); }
    const now = performance.now(), C = world.calmHeroes;   // (the heroes, found once a frame and shared by every monster's check)
    const all = C && now - C.at < 8 ? C.list : (world.calmHeroes = { at: now, list: world.actors.filter(a => a.kind === 'player' && !a.dead) }).list;
    const heroes = all.filter(a => !a.dead && Math.hypot(a.x - m.x, a.y - m.y) < CALM_FOES.near);
    const calm = heroes.length > 0 && heroes.every(h => calmLv(h) >= 4 * (m.tier || 0) + CALM_FOES.gap);
    m.calm = calm;
    if (!calm) return ai(world, m, dt);
    if (heroes.some(h => Math.hypot(h.x - m.x, h.y - m.y) < CALM_FOES.hum) && (m.humT = (m.humT == null ? rand(500, 2500) : m.humT) - dt) <= 0) {
      m.humT = rand(...CALM_FOES.every); floatText(world, m.x + rand(-6, 6), m.y - (m.h || 26) * (m.scale || 1) - 24, '♪', '#d8f0c8', 7);   // (just above the name plate: at -6 it sat on the health bar, at -36 it drifted far up)   // (a quiet sign it means no harm)
    }
    const was = world.peaceful; world.peaceful = true;   // (its thinking sees a peaceful world: it wanders, as in town)
    try { return ai(world, m, dt); } finally { world.peaceful = was; }
  };
}
