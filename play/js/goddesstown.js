'use strict';
// GODDESS TOWNS: the shopkeepers (2026-11-19). Each zone's 5th area is a small village round its goddess (worldgen.js
// buildGoddessTown); here its Smith (gear, and REPAIR) and Grocer (potions, food) stand at their doors, as Hearthvale's do.
{ const base = makeOverworld;
  makeOverworld = function (game, spawn) {
    const w = base(game, spawn);
    for (const R of REGIONS) {
      const GT = (WG_MAPS[R.map] || {}).goddessTown; if (!GT) continue;
      for (const S of GT.shops) {
        if (!D.npcs[S.npc]) continue;
        const at = findOpen(w, (R.ox + S.bx) * T + 8 + 22, (R.oy + S.by) * T + 14), a = baseActor('npc', 2, at.x, at.y);
        Object.assign(a, { npc: S.npc, label: `${S.label}  ${S.sym}`, role: S.role, h: 26, home: { x: at.x, y: at.y }, ai: { t: rand(0, 2000), still: true }, gtown: true });
        w.actors.push(a);
      }
    }
    // no monster steps into a goddess's sanctuary (her towns, and her area-10 shrines): it stops at the edge, as at a town's
    const bl = w.blocked;
    w.blocked = (x, y, a) => (a && a.kind === 'monster' && !a.ally && !a.pet && typeof sanctAt === 'function' && sanctAt(x, y)) || bl(x, y, a);
    return w;
  };
}
// and no monster's blow, spell or arrow hurts you (or your partner) while you stand in a sanctuary
{ const dd = dealDamage;
  dealDamage = function (world, att, def, opts) {
    if (world && world.overworld && !world.interior && att && att.kind === 'monster' && !att.ally && def && def.kind !== 'monster' && typeof sanctAt === 'function' && sanctAt(def.x, def.y)) return 0;
    return dd(world, att, def, opts);
  };
}
// and no area mini boss (the "Alpha" of an area) is ever put in a sanctuary or its side areas: it used to be placed, removed by the
// sanctuary, and placed again every frame (2026-11-19). Saying it was placed keeps the respawn timer on its usual slow clock.
{ const smb = spawnMiniBoss;
  spawnMiniBoss = function (w, R) {
    if (R && typeof sanctAt === 'function' && sanctAt((R.ox + R.w / 2) * T, (R.oy + R.h / 2) * T)) return true;
    return smb(w, R);
  };
}
