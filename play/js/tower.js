'use strict';
// THE ABYSS TOWER: an endless climb with a personal best. Each floor is a sealed copy of a zone: clear every monster and
// the next floor opens, harder than the last, with a breather of healing between. Every fifth floor is a boss and a
// checkpoint you can start from later. It runs on the Survival Rift's world (rifts.js), with w.rift.tower set. A floor pays
// the first time it is cleared; falling sends you home and keeps everything earned. Open it with U.
// pr.tower = { best }: the highest floor cleared.
const TOWER = { base: 5, perFloors: 2, maxMon: 12, hpStep: 0.15, atkStep: 0.08, boss: 5, bossHp: 6, bossScale: 1.8, gap: 1800, heal: 0.3, spawnMs: 260, tint: '#4a2a90', col: '#c8a0ff', seasonPts: 5, pill: { x: 6, y: VH - 94, w: 74, h: 14 } };
const towerOf = pr => pr.tower || (pr.tower = { best: 0 });
const towerZone = f => Math.min(ZONES.length - 1, Math.floor((f - 1) / 8));
const towerRank = f => Math.min(9, Math.floor((f - 1) / 4));
const towerBoss = f => f % TOWER.boss === 0;
const towerCheckpoint = pr => Math.floor(towerOf(pr).best / TOWER.boss) * TOWER.boss + 1;
function towerMenu() { return { type: 'tower', cur: 0, scroll: 0 }; }
function towerRows(pr) {
  const best = towerOf(pr).best, cp = towerCheckpoint(pr), rows = [{ floor: 1, icon: ITEM2_BASE + 1026, name: 'Enter at Floor 1', sub: 'Clear every monster to climb · every fifth floor is a boss', right: 'GO', rightCol: '#8fffb0' }];
  if (cp > 1) rows.unshift({ floor: cp, icon: ITEM2_BASE + 1042, name: `Enter at Floor ${cp}`, sub: `Your checkpoint · your best is Floor ${best}`, right: 'GO', rightCol: '#ffd27a' });
  return rows;
}
function updateTowerMenu(game, m) {
  const rows = towerRows(game.profile), nav = panelNav(m, rows.length, 0);
  if (nav.back || hit('KeyU')) { game.closeMenu(); return; }
  if (nav.ok && rows[m.cur]) { game.closeMenu(); enterTower(game, rows[m.cur].floor); }
}
function drawTowerMenu(game, m, now) {
  const best = towerOf(game.profile).best;
  panelMenu(m, { title: `ABYSS TOWER · BEST FLOOR ${best}`, rows: towerRows(game.profile), empty: '', keys: 'Arrows choose · Enter climb · Esc close' }, now);
}
function enterTower(game, floor) {
  const outside = game.world, p = outside.player, from = { x: p.x, y: p.y }, z = towerZone(floor), R = REGIONS.find(r => r.zone === z && r.map !== 'z3m') || REGIONS.find(r => r.zone >= 0), M = regMap(R), w = mapWorld(R.map);
  w.rift = { tower: true, floor, kills: 0, left: 0, spawnT: 400, gap: 0, zone: z, t: 1 };
  w.name = 'Abyss Tower'; w.bg = tintCanvas(w.bg, TOWER.tint);
  const party = outside.actors.filter(a => a === p || (a.ally && a.owner === p)), [sx, sy] = M.spawn;
  outside.actors = outside.actors.filter(a => !party.includes(a));
  for (const a of party) { a.x = sx + (a === p ? 0 : rand(-14, 14)); a.y = sy + (a === p ? 0 : 10); a.vx = a.vy = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  w.player = p; w.portals = []; w.from = from;
  w.onKill = m => { onMonsterKill(game, w, m); w.rift.kills++; };
  w.onPlayerDown = () => { game.toast(`The tower throws you out · you reached Floor ${w.rift.floor}`, '#c8a0ff'); w.leaveT = 1600; w.rift.failed = true; };
  game.outside = outside; game.world = w;
  towerFloor(game, w);
}
function towerFloor(game, w) {
  const Rf = w.rift, f = Rf.floor; Rf.left = towerBoss(f) ? 1 : Math.min(TOWER.maxMon, TOWER.base + Math.floor(f / TOWER.perFloors)); Rf.spawnT = 500; Rf.gap = 0;
  game.toast(towerBoss(f) ? `FLOOR ${f} · BOSS` : `FLOOR ${f}`, TOWER.col);
}
function towerSpawn(w) {
  const p = w.player, Rf = w.rift, f = Rf.floor, Z = ZONES[Rf.zone], M = w.map, boss = towerBoss(f);
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, d = rand(80, 150), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.7;
    if (x < T || y < T * 2 || x > (M.w - 1) * T || y > (M.h - 1) * T || !mapReach(M, x, y) || w.blocked(x, y)) continue;
    const pool = Z.mobs.filter(id => D.monsters[id]), sp = boss ? pool.slice().sort((a2, b) => SPECIES[b].hp - SPECIES[a2].hp)[0] : pick(pool), m = makeMonster(sp, towerRank(f), x, y), hp = 1 + f * TOWER.hpStep;
    m.maxHp = m.hp = Math.round(m.maxHp * hp * (boss ? TOWER.bossHp : 1)); m.atk *= 1 + f * TOWER.atkStep;
    m.home = { x, y }; m.dir = dirTo(p.x - x, p.y - y); m.aggro = true;
    if (boss) Object.assign(m, { boss: true, scale: TOWER.bossScale, heavy: true, label: `Warden of Floor ${f}`, shiny: true }), giveWildKit(m);
    w.actors.push(m);
    for (let i = 0; i < 8; i++) w.particles.push({ x, y: y - 10, vx: rand(-40, 40), vy: rand(-60, -10), t: 0, life: 380, col: i % 2 ? TOWER.col : '#302014', size: 2, puff: true });
    return true;
  }
  return false;
}
// a floor's pay, the first time it is cleared
function towerCleared(game, w) {
  const pr = game.profile, T2 = towerOf(pr), f = w.rift.floor, Z = ZONES[w.rift.zone], p = w.player;
  for (const d of w.drops) if (d.kind === 'card' || d.kind === 'gear' || d.kind === 'goods') game.pickup(d);
  w.drops = [];
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * TOWER.heal); p.mp = Math.min(p.maxMp, p.mp + p.maxMp * TOWER.heal);
  if (f > T2.best) {
    T2.best = f; const coins = 1 + Math.floor(f / TOWER.boss); pr.coins = (pr.coins || 0) + coins; seasonGain(game, TOWER.seasonPts);
    if (towerBoss(f)) { game.pickup({ kind: 'card', item: makeCard(pick(Z.mobs.filter(id => D.monsters[id])), Math.min(9, towerRank(f) + 1)) }); game.toast(`FLOOR ${f} CLEARED · new best · +${coins} coins and a card`, '#ffd23f'); }
    else game.toast(`Floor ${f} cleared · new best · +${coins} coin${coins > 1 ? 's' : ''}`, TOWER.col);
    game.save();
  }
  w.rings.push({ x: p.x, y: p.y, r: 40, t: 0, col: TOWER.col }, { x: p.x, y: p.y, r: 24, t: -120, col: '#ffffff' });
}
function updateTower(game, w, dt) {
  const Rf = w.rift;
  if (Rf.failed) return;
  if (Rf.gap > 0) {
    Rf.gap -= dt;
    if (Rf.gap <= 0) { Rf.floor++; const z = towerZone(Rf.floor); Rf.zone = z; towerFloor(game, w); }
    return;
  }
  if (Rf.left > 0 && (Rf.spawnT -= dt) <= 0) { Rf.spawnT = TOWER.spawnMs; if (towerSpawn(w)) Rf.left--; return; }
  if (Rf.left <= 0 && !w.actors.some(a => a.kind === 'monster' && !a.ally && !a.dead)) { towerCleared(game, w); Rf.gap = TOWER.gap; }
}
function drawTowerOverlay(w, now) {
  const Rf = w.rift, alive = Rf.left + w.actors.filter(a => a.kind === 'monster' && !a.ally && !a.dead).length, C = TOWER.col;
  ctx.fillStyle = 'rgba(30,20,13,0.75)'; rrect(ctx, VW / 2 - 70, 8, 140, 34, 8); ctx.fill();
  ctx.strokeStyle = C; ctx.lineWidth = 1; rrect(ctx, VW / 2 - 69.5, 8.5, 139, 33, 8); ctx.stroke();
  text('ABYSS TOWER', VW / 2, 16, '#e0d0ff', 7);
  text(`FLOOR ${Rf.floor}`, VW / 2, 29, towerBoss(Rf.floor) ? '#ffd25a' : '#ffffff', 13);
  text(Rf.gap > 0 ? 'cleared!' : `${alive} left`, VW / 2 + 64, 36, '#d8c8ff', 6.5, 'right');
}
function drawTowerPill(game, now) {
  const P = TOWER.pill, pr = game.profile, w = game.world; if (!pr || !w || game.menu || w.rift || w.cave) return;
  hudPill(P, TOWER.col, `U: Tower ${towerOf(pr).best}`, '#e0d0ff');   // (hud.js)
}
