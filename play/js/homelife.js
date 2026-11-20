'use strict';
// HOME LIFE: what makes the house yours. THE BED: sleep to morning, healed, and leave Well Rested, stronger the more Comfort the house has. FURNITURE: the catalogue by
// the back wall sells interior pieces and Zenonia 2's grander objects (assets/home_art.png); Decorate mode lets you put them anywhere, and each adds Comfort (pr.home.decor,
// .stock). ROOMS: gold opens a Trophy Room (it lights up by itself as you play), a Workshop and a Cellar, through new doors in the back wall (pr.home.rooms). COMPANY: your
// animals nap by the hearth and your partner waits by the table when you come home, and Grandpa drops in every other day.
const HA = D.homeArt = window.HOME_ART;   // in D so the picture is preloaded
function drawHomeArt(key, x, y, s = 1, ground = false) { const r = HA.frames[key], im = img(HA.img); if (!r || !im || !im.complete) return; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, r[0], r[1], r[2], r[3], Math.round(x + r[4] * s), Math.round(y + (ground ? -r[3] / 2 * s : r[5] * s)), r[2] * s, r[3] * s); }
const artLoop = (code, n, ms, now) => `${code}:${Math.floor(now / ms) % n}`;
const artRow = (key, n = 1) => (x, y) => { const k = n > 1 ? `${key}:0` : key, r = HA.frames[k]; if (!r) return; const s = Math.min(1, 20 / r[2], 20 / r[3]), im = img(HA.img); if (!im || !im.complete) return; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, r[0], r[1], r[2], r[3], x - r[2] * s / 2, y - r[3] * s / 2, r[2] * s, r[3] * s); };
// id, name, gold, Comfort; b: a frame of the interior bank; art: a frame here (n: animated frames); flat: lies on the floor; need: [unlock test, what it asks]
const needZone = (i, name) => [pr => !!(pr.cleared || {})[i], `Beat the ${name} Guardian`];
const HOME_DECOR = [
  { id: 'flowers', name: 'Potted Flowers', b: 10, gold: 120, comfort: 1 }, { id: 'chair', name: 'Chair', b: 59, gold: 150, comfort: 1 }, { id: 'bush', name: 'Round Bush', art: '034:6', gold: 200, comfort: 2 }, { id: 'plant', name: 'Tall Plant', b: 45, gold: 200, comfort: 2 }, { id: 'barrel', name: 'Barrel', art: '040:2', gold: 200, comfort: 1 },
  { id: 'painting', name: 'Painting', b: 28, gold: 250, comfort: 2 }, { id: 'rug', name: 'Straw Mat', art: '006:5', gold: 300, comfort: 2, flat: true }, { id: 'lamp', name: 'Crystal Lamp', art: '034:0', gold: 350, comfort: 3 }, { id: 'pillar', name: 'Stone Pillar', art: '034:1', gold: 500, comfort: 3 }, { id: 'hbanner', name: 'Heraldic Banner', art: '034:7', gold: 400, comfort: 3 },
  { id: 'wrug', name: 'Woven Rug', b: 54, gold: 400, comfort: 3, flat: true }, { id: 'bench', name: 'Stone Bench', art: '034:4', gold: 450, comfort: 3 }, { id: 'books', name: 'Bookcase', b: 46, gold: 450, comfort: 3 }, { id: 'table', name: 'Table', b: 53, gold: 500, comfort: 3 }, { id: 'anvil', name: 'Anvil', art: '040:3', gold: 700, comfort: 4 },
  { id: 'banner', name: 'Crystal Banner', art: '038', n: 10, ms: 130, gold: 800, comfort: 5 }, { id: 'locker', name: 'Iron Lockers', art: '083:0', gold: 800, comfort: 4 }, { id: 'cauldron', name: 'Potion Cauldron', art: '020', n: 4, ms: 180, gold: 900, comfort: 5 }, { id: 'stand', name: 'Armour Stand', b: 3, gold: 900, comfort: 5 }, { id: 'fan', name: 'Great Fan', art: '071', n: 4, ms: 110, gold: 1000, comfort: 4 },
  { id: 'gbed', name: 'Guest Bed', b: 51, gold: 1200, comfort: 6 }, { id: 'stall1', name: 'Potion Stall', art: '040:0', gold: 1200, comfort: 6 }, { id: 'stall2', name: 'Harvest Stall', art: '040:1', gold: 1200, comfort: 6 }, { id: 'orb', name: 'Blue Orb', art: '035:1', gold: 1500, comfort: 8 }, { id: 'tank', name: 'Glowing Tank', art: '084', n: 4, ms: 170, gold: 2500, comfort: 8 },
  { id: 'pool', name: 'Crystal Pool', art: '032:1', gold: 3000, comfort: 12, flat: true, s: 0.7 }, { id: 'seat', name: 'Royal Seat', art: '039:0', gold: 3000, comfort: 12 }, { id: 'statue', name: 'Stone Statue', art: '037:0', gold: 4000, comfort: 14, need: needZone(0, 'Verdant') }, { id: 'fountain', name: 'Crystal Fountain', art: '032:2', gold: 6000, comfort: 20, need: needZone(1, 'Twilight') }, { id: 'throne', name: 'Red Throne', art: '039:1', gold: 8000, comfort: 25, need: needZone(2, 'Ember') }, { id: 'demon', name: 'Gold Demon Head', art: '061', n: 2, ms: 500, gold: 12000, comfort: 35, need: needZone(3, 'Frost') },
];
const decorOf = id => HOME_DECOR.find(d => d.id === id);
const decorKey = (d, now) => d.n ? artLoop(d.art, d.n, d.ms, now) : d.art;
const decorDraw = (d, x, y, now) => { if (d.art) drawHomeArt(decorKey(d, now), x, y, d.s || 1); else drawObjSprite(100, d.b, x, y); };
const decorRow = d => d.art ? artRow(d.art, d.n) : objRow('100', d.b);
const HOME_ROOMS = { trophy: { name: 'Trophy Room', gold: 3000, comfort: 10, floor: 33, door: ['060:0', 0.42], desc: 'Lights up by itself as you beat bosses' }, workshop: { name: 'Workshop', gold: 5000, comfort: 10, floor: 24, door: ['031:5', 0.8], desc: 'A bench at home for the Workshop' }, cellar: { name: 'Cellar', gold: 8000, comfort: 10, floor: 44, door: ['109:10', 0.42], desc: 'Ages something good for you every day' } };
const HL = { maxDecor: 24, restMs: 600000, rest0: 0.05, restPer: 0.002, restMax: 0.2, sleep: 2200, cellar: ['cheese', 'smokedmeat', 'smokedfish'] };
const homeBits = pr => { const H = homeOf(pr); H.decor = H.decor || []; H.stock = H.stock || {}; H.rooms = H.rooms || {}; return H; };
const homeComfort = pr => { const H = homeBits(pr); return H.decor.reduce((n, p) => n + (decorOf(p.id) ? decorOf(p.id).comfort : 0), 0) + Object.keys(H.rooms).reduce((n, k) => n + HOME_ROOMS[k].comfort, 0); };
const restPower = pr => Math.min(HL.restMax, HL.rest0 + homeComfort(pr) * HL.restPer);
function restStats(pr, st) { const R = pr.rested; if (!R || R.ms <= 0) return; st.atk = Math.round(st.atk * (1 + R.pow) * 10) / 10; st.hp = Math.round(st.hp * (1 + R.pow)); }
function restTick(game, dt) { const pr = game.profile, R = pr && pr.rested; if (!R) return; R.ms -= dt; if (R.ms <= 0) { pr.rested = null; game.toast('Well Rested wore off', '#c9c1a8'); game.refreshPlayer(); } }
function drawRestChip(game) { const pr = game.profile, R = pr && pr.rested, w = game.world; if (!R || !w || game.menu) return; ctx.fillStyle = 'rgba(30,20,13,0.86)'; rrect(ctx, 6, 98, 104, 12, 3); ctx.fill(); text(`☾ Well Rested +${Math.round(R.pow * 100)}% · ${Math.ceil(R.ms / 60000)} min`, 58, 104, '#c8d8ff', 6.5); }
// the bed: sleep until morning
function sleepMenu() { return { type: 'sleep', t: 0 }; }
function updateSleep(game, m, dt) {
  m.t += dt; const pr = game.profile;
  if (!m.done && m.t > HL.sleep / 2) { m.done = true; if (dayPhase(pr) > DAY.start) pr.day = (pr.day || 0) + 1; pr.clock = DAY.start * DAY.len; m.pow = restPower(pr); pr.rested = { ms: HL.restMs, pow: m.pow }; game.refreshPlayer(); const p = game.world.player; p.hp = p.maxHp; p.mp = p.maxMp; p.status = {}; game.save(); }
  if (m.t >= HL.sleep) { game.closeMenu(); game.toast(`Good morning! Well Rested: +${Math.round(m.pow * 100)}% ATK and HP for 10 minutes`, '#c8d8ff'); }
}
function drawSleep(game, m, now) {
  const k = Math.min(1, Math.min(m.t, HL.sleep - m.t) / 500); ctx.fillStyle = `rgba(4,4,14,${k})`; ctx.fillRect(0, 0, VW, VH); if (k < 0.6) return; ctx.save(); ctx.globalAlpha = (k - 0.6) / 0.4;
  if (m.done) { goldTitle('GOOD MORNING', VW / 2, VH / 2 - 8, 16, now); petInk(`Comfort ${homeComfort(game.profile)} · Well Rested +${Math.round(m.pow * 100)}%`, VW / 2, VH / 2 + 14, '#c8d8ff', 9, 'center'); } else for (let i = 0; i < 3; i++) text('z', VW / 2 + i * 14 - 14, VH / 2 - i * 10 + Math.sin(now / 300 + i) * 3, '#c8d8ff', 10 + i * 4);
  ctx.restore();
}
// the rooms: small halls of their own. feats: what stands in each ({ kind: 'art', solid tile }), the showpieces of the Trophy Room ({ kind: 'trophy', i })
const TROPHY_ART = ['035:1', '037:0', '114:0', '061:0', '035:4', '039:1', '037:1', '114:3'];
function buildRoomMap(id, R) {
  const W = 16, H = 12, M = blankMap(W, H, 100, R.floor), cx = 8;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (y === 0 || x === 0 || x === W - 1 || (y === H - 1 && !(x === cx - 1 || x === cx))) setTile(M, x, y, 40, 1); else if (y <= 2) setTile(M, x, y, 18, 1); else setTile(M, x, y, R.floor); }
  for (let y = 8; y <= 11; y++) for (const x of [cx - 1, cx]) setTile(M, x, y, 21);
  M.entry = [cx * WG_T, 10 * WG_T + 10]; M.feats = [];
  const art = (key, tx, ty, n, ms) => { M.feats.push({ kind: 'art', key, n, ms, tx, ty }); setSolid(M, tx, ty, 1); };
  if (id === 'trophy') { [[2, 4], [5, 4], [10, 4], [13, 4], [2, 7], [5, 7], [10, 7], [13, 7]].forEach(([tx, ty], i) => { M.feats.push({ kind: 'trophy', i, tx, ty }); setSolid(M, tx, ty, 1); }); M.feats.push({ kind: 'memorial', tx: 7.5, ty: 3 }); setSolid(M, 7, 3, 1); setSolid(M, 8, 3, 1); [3.5, 11.5].forEach(tx => M.feats.push({ kind: 'art', key: '038', n: 10, ms: 130, tx, ty: 2.9, wall: true })); }
  if (id === 'workshop') { M.feats.push({ kind: 'bench', tx: 7.5, ty: 3 }); setSolid(M, 7, 3, 1); setSolid(M, 8, 3, 1); art('071', 2, 3, 4, 110); art('071', 13, 3, 4, 110); art('084', 2, 7, 4, 170); art('084', 13, 7, 4, 170); art('083:0', 4, 3); art('083:0', 11, 3); art('040:3', 5, 7); }
  if (id === 'cellar') { M.feats.push({ kind: 'barrels', tx: 7.5, ty: 3 }); setSolid(M, 7, 3, 1); setSolid(M, 8, 3, 1); art('020', 3, 5, 4, 180); art('020', 12, 5, 4, 180); art('040:2', 2, 3); art('040:2', 13, 3); art('040:2', 2, 8); art('101:0', 5, 3); art('101:1', 10, 3); art('034:0', 13, 8); }
  floodReach(M, cx, 9); return M;
}
for (const k in HOME_ROOMS) WG_MAPS['home_room_' + k] = buildRoomMap(k, HOME_ROOMS[k]);
function enterRoom(game, id) {
  const home = game.world, p = home.player, key = 'home_room_' + id, M = MAPS[key], w = mapWorld(key); w.interior = true; w.peaceful = true; w.home = true; w.hall = true; w.doorRoom = id; w.name = HOME_ROOMS[id].name;
  const party = home.actors.filter(a => a === p || (a.ally && a.owner === p)); home.actors = home.actors.filter(a => !party.includes(a));
  const [ex, ey] = M.entry; for (const a of party) { a.x = ex + (a === p ? 0 : rand(-14, 14)); a.y = ey - (a === p ? 2 : 10); a.vx = a.vy = 0; a.dir = 0; a.state = 'free'; setAnim(a, 'idle', true); w.actors.push(a); }
  w.player = p; w.entry = { x: ex, y: ey }; placeHomeFeatures(w, M); game.hallFrom = home; game.world = w; game.toast(HOME_ROOMS[id].name, '#ffe9a8');
}
const featNear = o => { const p = GAME.world && GAME.world.player; return p && Math.hypot(p.x - o.x, p.y - o.y) < 26; };
// drawn here: anything of this file's; false leaves the feature to home.js
// The way down to the Relic Hall: an opening in the floor by the back wall, with stone steps going down and away, each one
// darker than the last until they sink into shadow; a wooden rim round it and a little railing post at each front corner.
function drawHallStairs(x, y) {
  const L = x - 16, T = y - 12, W = 32, H = 32, n = 6, sh = (H - 6) / n;
  ctx.fillStyle = '#4a2e1a'; ctx.fillRect(L - 2, T - 2, W + 4, H + 4);                       // the rim
  ctx.fillStyle = '#7a5232'; ctx.fillRect(L - 2, T - 2, W + 4, 2); ctx.fillRect(L - 2, T + H, W + 4, 2);
  ctx.fillStyle = '#0c0806'; ctx.fillRect(L, T, W, H);                                         // the dark well
  for (let i = 0; i < n; i++) {                                                                 // steps: the nearest at the front, lit; deeper ones further back, darker
    const k = i / (n - 1), sy = T + H - 3 - (i + 1) * sh, lit = 1 - k * 0.85;
    const c = (r, g, b) => `rgb(${Math.round(r * lit)},${Math.round(g * lit)},${Math.round(b * lit)})`;
    ctx.fillStyle = c(196, 170, 140); ctx.fillRect(L + 3 + i * 0.6, sy, W - 6 - i * 1.2, sh - 1.4);          // the tread
    ctx.fillStyle = c(232, 212, 184); ctx.fillRect(L + 3 + i * 0.6, sy + sh - 1.4, W - 6 - i * 1.2, 1);       // its front edge catches the light
  }
  const g = ctx.createLinearGradient(0, T, 0, T + H); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.55, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(L, T, W, H);                                                  // shadow deepening toward the back
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(L, T, 3, H); ctx.fillRect(L + W - 3, T, 3, H);       // the side walls of the well
  ctx.fillStyle = '#7a5232'; ctx.fillRect(L - 2, T + H - 9, 3, 11); ctx.fillRect(L + W - 1, T + H - 9, 3, 11);   // railing posts at the front corners
  ctx.fillStyle = '#b07c4a'; ctx.fillRect(L - 2, T + H - 9, 3, 1); ctx.fillRect(L + W - 1, T + H - 9, 3, 1);
}
function drawHomeRoomFeat(o, pr, now) {
  const x = o.x, y = o.y, hint = s => { if (featNear(o)) text(s, x, y - 44, '#ffffff', 7); };
  if (o.kind === 'chest') { drawObjSprite(3, 0, x, y + 3); hint('Enter: Storage'); return true; }
  if (o.kind === 'hall') { drawHallStairs(x, y); if (Math.hypot(GAME.world.player.x - x, GAME.world.player.y - (y + 12)) < 24) text('Enter: Down to the Relic Hall', x, y - 18, '#ffffff', 7); return true; }
  if (o.kind === 'bed') { if (featNear(o)) text('Enter: Sleep', x, y + 15, '#ffffff', 7); return true; }
  if (o.kind === 'catalog') { drawObjSprite(100, 38, x, y + 2); hint('Enter: Home Catalogue'); return true; }
  if (o.kind === 'roomdoor') { const R = HOME_ROOMS[o.room]; drawHomeArt(R.door[0], x, y + 4, R.door[1]); if (Math.hypot(GAME.world.player.x - x, GAME.world.player.y - (y + 12)) < 24) text(`Enter: ${R.name}`, x, y - 30, '#ffffff', 7); return true; }
  if (o.kind === 'art') { drawHomeArt(o.seq ? `${o.key}:${o.seq[Math.floor((now + o.tx * 90) / o.ms) % o.seq.length]}` : o.n ? artLoop(o.key, o.n, o.ms, now + o.tx * 90) : o.key, x, y + 2); return true; }   // (seq: play just these frames, in this order)
  if (o.kind === 'trophy') {
    const T = trophyList(pr)[o.i], k = TROPHY_ART[o.i]; ctx.fillStyle = '#48301e'; ctx.fillRect(x - 11, y - 2, 22, 5); ctx.fillStyle = '#d8a850'; ctx.fillRect(x - 11, y - 3, 22, 1.5); ctx.save(); if (!T.got) ctx.filter = 'brightness(0.18) saturate(0)'; drawHomeArt(k === '061:0' && T.got ? artLoop('061', 2, 500, now) : k, x, y - 2, 0.8); ctx.restore();
    if (T.got) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y - 18, 1, x, y - 18, 26); g.addColorStop(0, 'rgba(255,220,140,0.28)'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26, y - 44, 52, 52); ctx.restore(); }
    if (featNear(o)) text(T.got ? T.name : '???', x, y - 44, T.got ? '#ffe9a8' : '#9aa4b8', 7); return true;
  }
  if (o.kind === 'memorial') {
    const P = pr.partner; drawObjSprite(100, 53, x, y + 4); if (P && P.dead) { partnerPortrait(P, x, y - 8, 22, 26, true, now); if (featNear(o)) text(`In memory of ${P.name}`, x, y - 42, '#ff9a8a', 7); } else if (featNear(o)) text('Enter: Trophy Record', x, y - 42, '#ffffff', 7); return true;
  }
  if (o.kind === 'bench') { drawObjSprite(100, 53, x, y + 4); drawHomeArt('040:3', x - 8, y - 8, 0.7); hint('Enter: Workshop'); return true; }
  if (o.kind === 'barrels') { drawHomeArt('040:2', x - 12, y + 2); drawHomeArt('040:2', x + 12, y + 2); drawHomeArt('040:1', x, y + 4, 0.8); const ready = (homeBits(pr).cellarDay || 0) !== dayNo(); if (ready) drawQuestMark(x, y - 34, now); hint(ready ? 'Enter: Take what has aged' : 'Nothing ready today'); return true; }
  return false;
}
function trophyList(pr) {
  const c = pr.cleared || {}, stat = k => (pr.stats && pr.stats[k]) || 0, top = (pr.cards || []).reduce((b, q) => !b || (q.tier || 0) > (b.tier || 0) ? q : b, null), P = pr.partner, fish = pr.town ? Object.keys(pr.town.fish).length : 0, titles = Object.keys(pr.titles || {}).length, ic = i => ITEM2_BASE + i;
  return [...ZONES.map((Z, i) => ({ name: `${Z.name} Guardian`, sub: c[i] ? 'Defeated' : 'Still standing', got: !!c[i], icon: ic(1056) })),
    { name: 'Black Hole Boss', sub: `${stat('holeBosses')} defeated`, got: stat('holeBosses') > 0, icon: ic(1051) }, { name: 'Mini Bosses', sub: `${stat('miniBosses')} defeated`, got: stat('miniBosses') >= 10, icon: ic(1062) }, { name: 'Dojo Wins', sub: `${stat('dojoWins')} matches won`, got: stat('dojoWins') > 0, icon: ic(1083) }, { name: 'Titles Earned', sub: `${titles} of ${TITLE_LIST.length}`, got: titles >= 5, icon: ic(1058) },
    { name: 'Fish Book', sub: `${fish} of ${FISH.flat().length} pages`, got: fish > 0, icon: ic(1029) }, { name: 'Best Card', sub: top ? `Rank ${RANKS[top.tier]}` : 'None yet', got: !!top, icon: ic(1041) }, { name: 'Monsters Defeated', sub: `${stat('kills')}`, got: stat('kills') > 0, icon: ic(1035) },
    ...(P && P.dead ? [{ name: `In memory of ${P.name}`, sub: `Lv ${P.lv} · ${P.kills} kills · fell at ${P.fellAt}`, got: true, icon: ic(1050) }] : [])];
}
function trophyMenu() { return { type: 'trophies', cur: 0, scroll: 0 }; }
function updateTrophies(game, m) { const nav = panelNav(m, trophyList(game.profile).length, 0); if (nav.back) game.closeMenu(); }
function drawTrophies(game, m, now) { panelMenu(m, { title: 'TROPHY ROOM', rows: trophyList(game.profile).map(T => ({ icon: T.icon, name: T.name, sub: T.sub, right: T.got ? '✔' : '', rightCol: '#ffd23f', dim: !T.got })), keys: '↑↓ read · Esc close' }, now); }
function cellarTake(game) { const pr = game.profile, H = homeBits(pr); if (H.cellarDay === dayNo()) { game.toast('Nothing has finished aging today', '#c9c1a8'); return; } H.cellarDay = dayNo(); const id = pick(HL.cellar); addItem(pr, id, 1); game.toast(`The Cellar gave you ${ITEMS[id].name}`, '#ffd27a'); game.save(); }
function homeFeatAct(game, f) {
  if (f.kind === 'bed') game.openMenu(sleepMenu()); else if (f.kind === 'catalog') game.openMenu(decorMenu()); else if (f.kind === 'roomdoor') enterRoom(game, f.room); else if (f.kind === 'trophy' || f.kind === 'memorial') game.openMenu(trophyMenu()); else if (f.kind === 'bench') game.openMenu(craftMenu()); else if (f.kind === 'barrels') cellarTake(game); else if (f.kind === 'art') return true; else return false;
  return true;
}
const homeFeatShown = (pr, f) => f.kind !== 'roomdoor' || !!homeBits(pr).rooms[f.room];
function homeRefit(game) { const w = game.world; w.objects = w.objects.filter(o => !(w.homeFeats || []).includes(o) && !o.decor); placeHomeFeatures(w, w.map); placeDecor(w); }
// ---------------------------------------------------------------- the catalogue
const DECOR_TABS = ['BUY', 'PLACE', 'ROOMS'];
function decorMenu() { return { type: 'decor', tab: 0, cur: 0, scroll: 0 }; }
function decorRows(pr, m) {
  const H = homeBits(pr);
  if (m.tab === 0) return HOME_DECOR.map(d => { const locked = d.need && !d.need[0](pr); return { d, locked, draw: decorRow(d), name: d.name, sub: locked ? d.need[1] : `Comfort +${d.comfort}${H.stock[d.id] ? ` · ${H.stock[d.id]} unplaced` : ''}`, right: locked ? 'LOCKED' : fmtG(d.gold), rightCol: locked ? '#9a917c' : (pr.gold || 0) >= d.gold ? '#ffd23f' : '#ff8a8a', dim: locked }; });
  if (m.tab === 1) return [{ move: true, icon: homeIcon(22), name: 'Move or take back furniture', sub: `${H.decor.length} of ${HL.maxDecor} pieces placed`, col: '#ffe9a8' }, ...HOME_DECOR.filter(d => H.stock[d.id]).map(d => ({ d, draw: decorRow(d), name: d.name, sub: 'Enter: put it somewhere', right: `×${H.stock[d.id]}`, rightCol: '#8fffb0' }))];
  return Object.entries(HOME_ROOMS).map(([id, R]) => ({ room: id, draw: artRow(R.door[0]), name: R.name, sub: `${R.desc} · Comfort +${R.comfort}`, right: H.rooms[id] ? 'BUILT' : fmtG(R.gold), rightCol: H.rooms[id] ? '#ffd23f' : (pr.gold || 0) >= R.gold ? '#8fffb0' : '#ff8a8a' }));
}
function updateDecor(game, m) {
  const pr = game.profile, H = homeBits(pr), rows = decorRows(pr, m), nav = panelNav(m, rows.length, DECOR_TABS.length), r = rows[m.cur]; if (nav.back) { game.closeMenu(); return; } if (!nav.ok || !r) return;
  if (m.tab === 0) { if (r.locked) { game.toast(r.d.need[1], '#c9c1a8'); return; } if ((pr.gold || 0) < r.d.gold) { game.toast('Not enough gold', '#ff8a8a'); return; } pr.gold -= r.d.gold; H.stock[r.d.id] = (H.stock[r.d.id] || 0) + 1; game.toast(`Bought ${r.d.name}: open PLACE to set it down`, '#ffd27a'); game.save(); return; }
  if (m.tab === 1) { if (!r.move && H.decor.length >= HL.maxDecor) { game.toast('The house is full: take something back first', '#ff8a8a'); return; } const p = game.world.player; game.menu = { type: 'decorplace', id: r.move ? null : r.d.id, tx: Math.floor(p.x / T), ty: Math.floor(p.y / T) - 1, back: m }; return; }
  if (H.rooms[r.room]) { game.toast('Already built', '#c9c1a8'); return; } const R = HOME_ROOMS[r.room]; if ((pr.gold || 0) < R.gold) { game.toast('Not enough gold', '#ff8a8a'); return; }
  pr.gold -= R.gold; H.rooms[r.room] = true; game.toast(`${R.name} built! A new door stands in the back wall`, '#ffd27a'); game.save(); homeRefit(game);
}
function drawDecor(game, m, now) { const pr = game.profile; panelMenu(m, { title: 'HOME CATALOGUE', tabs: DECOR_TABS, rows: decorRows(pr, m), gold: pr.gold || 0, empty: 'Nothing here yet: try the BUY tab', info: `Comfort ${homeComfort(pr)} · sleep here for Well Rested +${Math.round(restPower(pr) * 100)}%`, keys: '←→ tab · ↑↓ choose · Enter · Esc close' }, now); }
// ---------------------------------------------------------------- decorating: a ghost of the piece, moved tile by tile
function decorOk(w, id, tx, ty) {
  const M = w.map, H = homeBits(GAME.profile), d = decorOf(id); if (!M.entry || !M.reach) return false;   // (only a home has a door to keep open: anywhere else nothing fits)
  if (tx < 1 || ty < 3 || tx >= M.w - 1 || ty >= M.h - 1 || !M.reach[ty * M.w + tx] || (ty >= 11 && Math.abs(tx - 9.5) < 2.6)) return false;
  if (H.decor.some(p => p.tx === tx && p.ty === ty)) return false; if ((w.homeFeats || []).some(o => Math.abs(o.x - (tx * T + 8)) < 16 && Math.abs(o.y - (ty * T + 12)) < 18)) return false;
  if (d.flat) return true; const block = new Set(H.decor.filter(p => !decorOf(p.id).flat).map(p => p.tx + ',' + p.ty)); block.add(tx + ',' + ty);   // it may not wall anything off
  const [ex, ey] = M.entry, st = [[Math.floor(ex / T), Math.floor(ey / T)]], seen = new Set([st[0].join()]);
  while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy, k = a + ',' + b; if (a < 0 || b < 0 || a >= M.w || b >= M.h || seen.has(k) || block.has(k) || !M.reach[b * M.w + a]) continue; seen.add(k); st.push([a, b]); } }
  let open = 0; for (let i = 0; i < M.reach.length; i++) if (M.reach[i] && !block.has(`${i % M.w},${Math.floor(i / M.w)}`)) open++; return seen.size >= open;
}
function placeDecor(w) {
  const H = homeBits(GAME.profile); w.objects = w.objects.filter(o => !o.decor);
  for (const p of H.decor) { const d = decorOf(p.id); if (!d) continue; const x = p.tx * T + 8, y = p.ty * T + 14; w.objects.push({ decor: true, d, x, y, bottom: y, ground: !!d.flat, box: d.flat ? null : { x: x - 7, y: y - 6, w: 14, h: 6 }, draw: (o, now) => decorDraw(o.d, o.x, o.y, now) }); }
  w.objects.push({ decor: true, x: 0, y: 0, bottom: 1e6, box: null, draw: (o, now) => drawDecorGhost(w, now) });
}
function drawDecorGhost(w, now) { const m = GAME.menu; if (!m || m.type !== 'decorplace') return; const x = m.tx * T + 8, y = m.ty * T + 14, ok = m.id == null ? homeBits(GAME.profile).decor.some(p => p.tx === m.tx && p.ty === m.ty) : decorOk(w, m.id, m.tx, m.ty); ctx.save(); if (m.id != null) { ctx.globalAlpha = 0.7; decorDraw(decorOf(m.id), x, y, now); } ctx.globalAlpha = 0.9; ctx.strokeStyle = ok ? '#8fffb0' : '#ff7a6a'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 8, y - 14, 16, 16); ctx.restore(); }
function updateDecorPlace(game, m) {
  const k = navInput(), w = game.world, pr = game.profile, H = homeBits(pr); if (k.l) m.tx--; if (k.r) m.tx++; if (k.u) m.ty--; if (k.d) m.ty++; m.tx = clamp(m.tx, 1, w.map.w - 2); m.ty = clamp(m.ty, 3, w.map.h - 2);
  if (k.back) { game.menu = m.back; return; }
  const at = H.decor.findIndex(p => p.tx === m.tx && p.ty === m.ty), lift = () => { const [p] = H.decor.splice(at, 1); H.stock[p.id] = (H.stock[p.id] || 0) + 1; placeDecor(w); game.save(); return p; };
  if (hit('KeyX') && at >= 0) { const p = lift(); game.toast(`${decorOf(p.id).name} taken back`, '#c9c1a8'); return; }
  if (!k.ok) return; if (m.id == null) { if (at >= 0) m.id = lift().id; return; }
  if (!decorOk(w, m.id, m.tx, m.ty)) { game.toast('It will not fit there', '#ff8a8a'); return; } H.decor.push({ id: m.id, tx: m.tx, ty: m.ty }); H.stock[m.id]--; const name = decorOf(m.id).name; if (H.stock[m.id] <= 0) { delete H.stock[m.id]; game.menu = m.back; } placeDecor(w); game.save(); game.toast(`${name} placed · Comfort ${homeComfort(pr)}`, '#8fffb0');
}
function drawDecorPlace(game, m, now) { const N = m.id == null ? 'Pick up a piece' : `Placing: ${decorOf(m.id).name}`; ctx.fillStyle = 'rgba(28,18,12,0.9)'; rrect(ctx, VW / 2 - 130, VH - 62, 260, 30, 5); ctx.fill(); ctx.strokeStyle = goldFrameGrad(VH - 62, 30); ctx.lineWidth = 1; rrect(ctx, VW / 2 - 129.5, VH - 61.5, 259, 29, 5); ctx.stroke(); petInk(N, VW / 2, VH - 53, '#ffe9a8', 9, 'center'); petInk('Arrows: move · Enter: place or pick up · X: take back · Esc: done', VW / 2, VH - 41, '#c8d0e0', 7.5, 'center', false); }
// ---------------------------------------------------------------- company
// what Grandpa talks about at the table, a new subject each time you speak to him: the rent, the farm, the homes nobody wants, your Layer
const GRANDPA_TALK = [
  pr => { const R = pr.rent || {}, left = R.due != null ? R.due - (pr.day || 0) : null; return R.owned ? 'No more rent! That deed on the shelf is the best thing this house has seen in years.' : R.owed ? `The landlord wants his ${fmtG(RENT.gold)} and his men are out looking for you. Pay him at the bridge before they find you.` : left != null ? `Rent falls due in ${Math.max(0, left)} day${left === 1 ? '' : 's'}: ${fmtG(RENT.gold)}. That landlord has never once been late, and neither should you.` : `The landlord will want ${fmtG(RENT.gold)} a month for this place. Start saving now, while you still can.`; },
  pr => { const F = farmer(pr), up = (pr.farm || []).filter(P => P && P.crop).length; return up ? `${up} plot${up === 1 ? '' : 's'} in the ground. Keep them watered: a dry plot grows at a quarter of the pace. Farm Level ${F.lv} already, is it?` : 'That field will not plant itself. Till it, sow it, water it. The Farm Board will tell you what folk are after.'; },
  pr => { const O = OUTPOSTS.find(T => !ownsTownHome(pr, T.i)); return O ? `There is a house going begging in ${O.name}. Nobody wants it, so it is only ${fmtG(O.price)}. A bed out on the road is worth more than you think.` : 'A house in every town. Your grandmother would have called that showing off. She would also have been proud.'; },
  () => 'Your Layer is the strongest thing you own, and you use it like it might break. Press V when it is ready. The more you use it, the more it teaches you.',
];
function homeCompany(game, w, party) {
  const pr = game.profile, p = w.player; for (const a of party) { if (a === p || !a.pet) continue; if (a.heroPartner) { a.x = 12 * T; a.y = 10 * T + 8; } else { a.x = 3 * T + rand(14, 40); a.y = 8 * T + rand(10, 26); } a.dir = 2; }
  if (pr.grandpa && dayNo() % 2 === 0 && D.npcs[GRANDPA.npc]) { const a = baseActor('npc', 2, 7 * T + 8, 10 * T + 8); Object.assign(a, { npc: GRANDPA.npc, label: 'Grandpa', role: 'grandpa', h: 26, home: { x: a.x, y: a.y }, ai: { t: 0, still: true } }); w.actors.push(a); }
}
function grandpaVisit(game) {
  const pr = game.profile, H = homeBits(pr), line = GRANDPA_TALK[(H.chat = (H.chat || 0) + 1) % GRANDPA_TALK.length](pr); game.openDialog('Grandpa', line, null);
  if (H.gift !== dayNo()) { H.gift = dayNo(); const g = 150 + (pr.lv || 1) * 25; pr.gold = (pr.gold || 0) + g; game.toast(`Grandpa slipped you ${g} G`, '#ffd27a'); } game.save();
}
function partnerChat(game, a) {
  const P = partnerOf(game.profile), f = a.hp / a.maxHp, L = f < 0.5 ? 'I can keep going. Just give me a minute.' : P.kills < 10 ? 'Stay close out there. I mean to see this through with you.' : P.kills < 100 ? `${P.kills} down. We are getting good at this.` : `${P.kills} so far. I am glad it was you I went with.`;
  game.openDialog(P.name, L, null);
}
