'use strict';
// ELEMENT REACTIONS: a hit whose element meets a status another element left on the foe (combat.js applyStatus) reacts.
// Kept small and calm, like the rest of the game's callouts: a short coloured word over the foe, no screen effects.
//   THAW       fire on a FROZEN foe: half again as much damage, and the ice is gone
//   STEAM      ice on a BURNING foe: the fire goes out in a hiss, and the foe is stunned a moment
//   OVERLOAD   lightning on a BURNING foe: a little blast of sparks catches the foes right beside it
//   WILDFIRE   wind on a BURNING foe: the flames spread to the foes around it
//   SHATTER    earth on a FROZEN foe: the ice breaks for 60% more damage
//   BLIGHT     fire on a POISONED foe: the rest of the poison lands at once, in one hit
//   MIASMA     wind on a POISONED foe (not burning): the poison drifts onto the foes around it
//   MAGMA      fire on a CRACKED foe (earth's armour crack): the cracks fill with fire, it burns 5 s at double heat
// Only blows from the heroes' side react (a player, their pets and summons), so a monster's spell can't chain your statuses.
// a soft music-box chime for your own reactions (cues.js cuePlay: pentatonic, nothing above 880 Hz, at most one every 0.4 s)
const REACT_CHIME = { THAW: [659], STEAM: [587], OVERLOAD: [784], WILDFIRE: [523], SHATTER: [440], BLIGHT: [392, 523], MIASMA: [523, 392], MAGMA: [392, 587] };
const EREACT = { thaw: 1.5, shatter: 1.6, steamStun: 450, overload: { r: 34, mul: 0.5 }, wildfire: { r: 44 }, miasma: { r: 44 }, magma: { t: 5000, dps: 0.24 } };
function elemReact(world, att, def, opts) {
  const s = def.status || {}, el = opts.el, col = (ELEMENTS[el] || {}).col || '#ffffff', at = (word) => {
    floatText(world, def.x, def.y - (def.h || 26) * (def.scale || 1) - 34, REACT_ICON_MARK + word, col, 7.5);   // (an icon, not a word, above the name plate: drawn by drawReactIcons)
    if (window.GAME && GAME.world === world && att.netGid && typeof netStatTo === 'function') { netStatTo(GAME, att.netGid, 'reactions'); netStatTo(GAME, att.netGid, 'react_' + word); }   // (a co-op friend's reaction counts on their save)
    if (window.GAME && GAME.world === world && att === world.player) { const pr = GAME.profile; pr.stats = pr.stats || {}; pr.stats.reactions = (pr.stats.reactions || 0) + 1; pr.stats['react_' + word] = (pr.stats['react_' + word] || 0) + 1; if (pr.stats['react_' + word] === 1 && REACT_CHIME[word]) { const K = Object.keys(REACT_CHIME), n = K.filter(k => pr.stats['react_' + k] > 0).length; GAME.toast(`New reaction: ${word[0] + word.slice(1).toLowerCase()} (${n}/${K.length})`, '#c8f0ff'); }   // (each kind too: the Element Sage title, combattitles.js)
    if (typeof tipEvent === 'function') tipEvent(GAME, 'reaction'); if (typeof cuePlay === 'function' && REACT_CHIME[word]) { const t = performance.now(), first = pr.stats['react_' + word] === 1; if (first || !(elemReact.chimeAt && t - elemReact.chimeAt < 3000)) { elemReact.chimeAt = t; cuePlay(REACT_CHIME[word]); } } }   // (at most one reaction chime every 3 s, so a busy fight stays calm; a first find always chimes)
  };
  if (el === 'fire' && s.freeze > 0) { s.freeze = 0; at('THAW'); return { ...opts, base: opts.base * EREACT.thaw }; }
  if (el === 'earth' && s.freeze > 0) { s.freeze = 0; at('SHATTER'); return { ...opts, base: opts.base * EREACT.shatter }; }
  if (el === 'fire' && s.poison && s.poison.t > 0) {
    const P = s.poison, rest = P.dps * P.t / 1000; s.poison = null; at('BLIGHT');
    world.timers.push({ t: 80, fn: () => { if (!def.dead && rest > 0) { def.invuln = 0; dealDamage(world, att, def, { base: rest, spell: true, pop: 40, push: 10, reacted: true }); } } });   // (def.invuln: the blight hit lands through the blink after the fire hit)
    return opts;
  }
  if (el === 'fire' && s.crack > 0) {   // MAGMA: set after the hit, so the hit's own fire status can't overwrite it (combat.js applyStatus)
    s.crack = 0; at('MAGMA'); const M = EREACT.magma, dps = opts.base * M.dps;
    world.timers.push({ t: 0, fn: () => { if (!def.dead) { def.status = def.status || {}; def.status.burn = { t: M.t, dps }; } } });
    return opts;
  }
  if (el === 'ice' && s.burn) { s.burn = null; at('STEAM'); world.timers.push({ t: 0, fn: () => { if (!def.dead) { def.state = 'hurt'; def.stun = Math.max(def.stun || 0, EREACT.steamStun); } } }); return opts; }
  if (el === 'lightning' && s.burn) {
    at('OVERLOAD'); const R = EREACT.overload;
    for (const o of enemiesOf(world, att)) if (o !== def && !o.dead && Math.hypot(o.x - def.x, o.y - def.y) < R.r) world.timers.push({ t: 60, fn: () => { if (!o.dead) dealDamage(world, att, o, { base: opts.base * R.mul, spell: true, el: 'lightning', pop: 60, push: 30, reacted: true }); } });
    world.rings.push({ x: def.x, y: def.y - 10, r: R.r, t: 0, col });
    return opts;
  }
  if (el === 'wind' && s.burn) {
    at('WILDFIRE'); const R = EREACT.wildfire;
    for (const o of enemiesOf(world, att)) if (o !== def && !o.dead && Math.hypot(o.x - def.x, o.y - def.y) < R.r) { o.status = o.status || {}; o.status.burn = { t: s.burn.t, dps: s.burn.dps }; }
    return opts;
  }
  if (el === 'wind' && s.poison && s.poison.t > 0) {   // MIASMA: the poison drifts to the foes around (a foe already worse off keeps its own)
    at('MIASMA'); const R = EREACT.miasma, P = s.poison;
    for (const o of enemiesOf(world, att)) if (o !== def && !o.dead && o.kind === 'monster' && Math.hypot(o.x - def.x, o.y - def.y) < R.r) { o.status = o.status || {}; const q = o.status.poison; if (!q || q.dps * q.t < P.dps * P.t) o.status.poison = { t: P.t, dps: P.dps }; }
    return opts;
  }
  return opts;
}
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    if (att && def && att !== def && opts && opts.el && !opts.reacted && !opts.reflected && def.status && !def.dead && (att.kind === 'player' || att.ally || att.pet) && def.kind === 'monster' && !def.ally)
      opts = elemReact(world, att, def, opts);
    return dd(world, att, def, opts);
  };
}
// The reaction shows as a small pixel ICON over the foe, not a word (the user: too much wording on screen). It still travels
// as a float (marked with REACT_ICON_MARK, so a co-op friend's game draws the same icon; world.js skips such floats as text).
//   THAW a drip · STEAM wisps · OVERLOAD a spark burst · WILDFIRE a flame · SHATTER shards · BLIGHT a burst bubble, as small pixel chips like the debuff chips
const REACT_ICON_MARK = '~', REACT_ICON = { ms: 900, rise: 6 };
// the reaction chips: drawn exactly like the debuff chips by a foe's health bar (world.js STATUS_CHIPS): a 7 px chip with a white
// pixel-rounded border, the reaction's colour inside and a dark 5x5 pixel mark
const REACT_CHIPS = {
  THAW:     ['#7fd6ff', ['..#..', '..#..', '.###.', '#####', '.###.']],   // a drip
  STEAM:    ['#e8eef8', ['.#..#', '#..#.', '.#..#', '#..#.', '.#..#']],   // two wisps rising
  OVERLOAD: ['#ffe94a', ['#.#.#', '.###.', '##.##', '.###.', '#.#.#']],   // a spark burst
  WILDFIRE: ['#ff8a3a', ['..#..', '.##..', '.###.', '#####', '.###.']],   // a flame
  SHATTER:  ['#c8b49a', ['#...#', '.#.#.', '#.#.#', '.#.#.', '#...#']],   // broken shards
  BLIGHT:   ['#9ae05a', ['.#.#.', '#####', '.###.', '#####', '.#.#.']],   // a bursting bubble
  MIASMA:   ['#b0e080', ['.##..', '#..#.', '..##.', '.#..#', '..##.']],   // a drifting wisp
  MAGMA:    ['#ff7a3a', ['#.#.#', '.#.#.', '#####', '.#.#.', '#.#.#']],   // glowing cracks
};
{
  const ft = floatText;
  floatText = (world, x, y, str, col, size) => {
    if (typeof str === 'string' && str[0] === REACT_ICON_MARK) (world.reactIcons = world.reactIcons || []).push({ x, y, t0: performance.now(), kind: str.slice(1) });
    return ft(world, x, y, str, col, size);
  };
  const tf = drawTitleFx;
  drawTitleFx = (game, now) => { const r = tf(game, now); drawReactIcons(game, now); return r; };
}
function drawReactIcons(game, now) {
  const w = game.world, R = REACT_ICON; if (!w || !w.reactIcons || !w.reactIcons.length || !w.cam || (game.scene !== 'world' && game.scene !== 'arena')) return;   // (the arena too: the training dummy, trainreact.js)
  const Z = w.zoom || ZOOM;
  w.reactIcons = w.reactIcons.filter(I => now - I.t0 < R.ms);
  for (const I of w.reactIcons) {
    const C = REACT_CHIPS[I.kind]; if (!C) continue;
    const t = now - I.t0, k = t / R.ms, pop = t < 90 ? 1 + 0.4 * (t / 90) : t < 180 ? 1.4 - 0.4 * ((t - 90) / 90) : 1;   // (a little pop, then still)
    ctx.save(); ctx.globalAlpha = k > 0.65 ? (1 - k) / 0.35 : 1; ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round((I.x - w.cam.x) * Z), Math.round((I.y - w.cam.y - R.rise * k) * Z)); ctx.scale(Z * pop, Z * pop);
    reactChip(C[0], C[1]);
    ctx.restore();
  }
}
function reactChip(col, g) {
  const cx = -4, cy = -4;
  ctx.fillStyle = PIXBAR.line; pxRound(cx, cy, 7, 7, 1); ctx.fillStyle = col; ctx.fillRect(cx + 1, cy + 1, 5, 5);
  ctx.fillStyle = mixCol(col, '#1a0a14', 0.7); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') ctx.fillRect(cx + 1 + c, cy + 1 + r, 1, 1);
}
// ONLINE CO-OP: a friend's reactions are run on the host, which sends each kind to their save as a stat (net.js 'stat',
// bumpStat). When one arrives for the first time on a friend's game, they get the same "New reaction" message.
{
  const bs = bumpStat;
  bumpStat = (key, n = 1) => {
    const r = bs(key, n), G = window.GAME, pr = G && G.profile;
    if (pr && G.net && G.net.role === 'guest' && typeof key === 'string' && key.startsWith('react_') && pr.stats[key] === n) {
      const word = key.slice(6), K = Object.keys(REACT_CHIME);
      if (REACT_CHIME[word]) G.toast(`New reaction: ${word[0] + word.slice(1).toLowerCase()} (${K.filter(k => pr.stats['react_' + k] > 0).length}/${K.length})`, '#c8f0ff');
    }
    return r;
  };
}
// A SMALL CHANCE BELOW S+: a card spell normally leaves its element's status only at tier S+ (defs.js cardSpell, t >= 6), which
// left reactions to Layer moves for most of the game. Now each cast of a lower-tier card from a hero (or their familiars) has
// STATUS_CHANCE.base + STATUS_CHANCE.per x tier (20% at F, 35% just below S+) to leave it, for the statuses the reactions use:
// burn, freeze, shock, crack and poison. Dark's drain and holy's healing stay S+ only (they heal you), and wind's gust too.
const STATUS_CHANCE = { base: 0.2, per: 0.03, els: ['fire', 'ice', 'lightning', 'earth', 'poison'] };
{
  const cs = castSpell;
  castSpell = (world, a, sp, link, boost) => {
    if (sp && !sp.status && STATUS_CHANCE.els.includes(sp.el) && a && (a.kind === 'player' || a.ally || a.pet) && Math.random() < STATUS_CHANCE.base + STATUS_CHANCE.per * (sp.tier || 0))
      sp = { ...sp, status: true };
    return cs(world, a, sp, link, boost);
  };
}
