'use strict';
// CARD SETS: own one card of every monster from a zone, at any rank, and that zone's set is complete for good, with a
// lasting bonus to your stats. Cards in Storage count, and discarding one later takes nothing back. Open it with O.
// pr.sets = { zone: true }.
const SETS = {
  bonus: [{ name: 'Fields Set', hp: 0.05, text: '+5% max HP' }, { name: 'Grove Set', atk: 0.05, text: '+5% ATK' }, { name: 'Depths Set', crit: 5, text: '+5% crit' }, { name: 'Abyss Set', hp: 0.08, atk: 0.08, text: '+8% max HP and ATK' }],
  every: 120, pill: { x: 6, y: VH - 110, w: 74, h: 14 }, col: '#9fd8ff',
};
const setMobs = z => ZONES[z].mobs.filter(id => D.monsters[id]);
function setOwned(pr) { return new Set([...(pr.cards || []), ...((pr.storage || {}).cards || [])].map(c => c.sp)); }
const setsDone = pr => SETS.bonus.filter((_, z) => pr.sets && pr.sets[z]).length;
function collectionStats(pr, st) {
  SETS.bonus.forEach((B, z) => {
    if (!pr.sets || !pr.sets[z]) return;
    if (B.hp) st.hp = Math.round(st.hp * (1 + B.hp));
    if (B.atk) st.atk = Math.round(st.atk * (1 + B.atk) * 10) / 10;
    if (B.crit) st.crit = (st.crit || 0) + B.crit;
  });
}
// checked every couple of seconds (daily.js)
function collectionTick(game) {
  game.setT = (game.setT || 0) + 1; if (game.setT < SETS.every) return; game.setT = 0;
  const pr = game.profile, own = setOwned(pr); pr.sets = pr.sets || {};
  SETS.bonus.forEach((B, z) => {
    if (pr.sets[z] || !setMobs(z).every(id => own.has(id))) return;
    pr.sets[z] = true; game.refreshPlayer(); game.toast(`CARD SET COMPLETE: ${B.name} · ${B.text}, for good!`, '#ffd25a'); game.save();
  });
}
function setsMenu() { return { type: 'sets', cur: 0, scroll: 0 }; }
function setRows(pr) {
  const own = setOwned(pr);
  return SETS.bonus.map((B, z) => {
    const mobs = setMobs(z), miss = mobs.filter(id => !own.has(id)), done = pr.sets && pr.sets[z];
    return { icon: ITEM2_BASE + 1041, name: `${B.name} · ${B.text}`, sub: done ? `Complete · ${ZONES[z].name}` : `Missing: ${miss.slice(0, 4).map(id => SPECIES[id].name).join(', ')}${miss.length > 4 ? ` +${miss.length - 4} more` : ''}`, right: done ? 'DONE' : `${mobs.length - miss.length}/${mobs.length}`, rightCol: done ? '#8fffb0' : '#ffd27a' };
  });
}
function updateSets(game, m) { const nav = panelNav(m, SETS.bonus.length, 0); if (nav.back || nav.ok || hit('KeyO')) game.closeMenu(); }
function drawSets(game, m, now) {
  panelMenu(m, { title: `CARD SETS · ${setsDone(game.profile)} OF ${SETS.bonus.length}`, rows: setRows(game.profile), empty: '', keys: 'One card of every monster in a zone, at any rank · Esc close' }, now);
}
function drawSetsPill(game, now) {
  const P = SETS.pill, pr = game.profile, w = game.world; if (!pr || !w || game.menu || w.rift || w.cave) return;
  hudPill(P, SETS.col, `O: Sets ${setsDone(pr)}/${SETS.bonus.length}`, '#d8f0ff');   // (hud.js)
}
