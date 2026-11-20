'use strict';
// CO-OP (local, step 1 toward online co-op): a second hero on the same keyboard, fighting beside you outdoors and in black
// holes and rifts. = brings Player 2 in or sends them home. P2 is a copy of your hero (same class, cards and gear; nothing
// of theirs is saved), moves with the arrow keys and has its own HUD. The camera keeps you both in view; if P2 falls far
// behind they're pulled along, and if they fall they're back on their feet beside you a few seconds later. P2 waits outside
// houses and doors and rejoins when you come back out. Kills, EXP and loot all go to your save.
// While P2 plays, Player 1 keeps WASD (the arrows belong to P2).
const COOP = { key: 'Equal', leash: 260, pull: 520, revive: 4000 };
let COOP1_MAP = null;   // (made on first use: SOLO lives in main.js, which loads last)
const coop1Map = () => COOP1_MAP || (COOP1_MAP = Object.assign({}, SOLO, { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], dash: ['ShiftLeft', 'KeyK'] }));
const COOP2 = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], atk: ['Slash', 'Numpad0'],
  spell: [['Comma', 'Numpad1'], ['Period', 'Numpad2'], ['Semicolon', 'Numpad3']], fusion: [], fsel: ['Backslash'], dash: ['ShiftRight', 'NumpadDecimal'], block: ['BracketLeft'], layer: ['BracketRight', 'NumpadEnter'],
  labels: [',', '.', ';', '\\', 'RShift', ']', '['] };
const coopOn = game => !!(game && game.coop);
const coopActor = w => w && w.actors.find(a => a.coop2 && !a.netGid && !a.remove);   // (online friends are net.js's)
const coopHere = w => !!(w && !w.interior && (w.overworld || w.cave || w.rift));
function coopToggle(game, w) {
  if (game.coop) { const a = coopActor(w); if (a) a.remove = true; game.coop = null; game.toast('Player 2 heads home', '#c9c1a8'); return; }
  const prof = JSON.parse(JSON.stringify(game.profile)); prof.look = Object.assign({}, prof.look, { name: 'Player 2' });
  game.coop = { profile: prof }; game.toast('Player 2 joins! Arrows move · / attack · , . ; spells · Right Shift dash · ] Layer', '#8fd8ff');
  coopSpawn(game, w);
}
function coopSpawn(game, w) {
  if (!coopOn(game) || !coopHere(w) || coopActor(w) || !w.player) return null;
  const p = w.player, q = findOpen(w, p.x + 24, p.y + 6), a = makePlayerActor(game.coop.profile, p.team, q.x, q.y);
  Object.assign(a, { coop2: true, pvp: 1, marker: '#4ea8ff', label: 'Player 2' }); a.dir = p.dir; w.actors.push(a); return a;
}
// each world frame (main.js): bring P2 into this world, keep them close, stand them back up after a fall, read their pad
function coopInput(game, w, safe, dt) {
  if (hit(COOP.key) && !(game.net && game.net.role === 'host')) coopToggle(game, w);   // (not while hosting online)
  if (!coopOn(game)) return null;
  const a = coopActor(w) || coopSpawn(game, w); if (!a) return null;
  const p = w.player, d = Math.hypot(a.x - p.x, a.y - p.y);
  if (a.dead || a.hp <= 0) {
    a.coopDown = (a.coopDown || 0) + dt;
    if (a.coopDown >= COOP.revive) { const q = findOpen(w, p.x + 20, p.y + 8); Object.assign(a, { x: q.x, y: q.y, dead: false, dying: false, hp: a.maxHp, mp: a.maxMp, state: 'free', coopDown: 0, invuln: 1500 }); setAnim(a, 'idle', true); game.toast('Player 2 is back on their feet', '#8fd8ff'); }
    return NO_INPUT;
  }
  if (d > COOP.pull) { const q = findOpen(w, p.x + 20, p.y + 8); a.x = q.x; a.y = q.y; a.vx = a.vy = 0; }   // left far behind: pulled along
  const inp = readPad(COOP2);
  if (d > COOP.leash) { const dx = a.x - p.x, dy = a.y - p.y; if (Math.sign(inp.mx) === Math.sign(dx)) inp.mx = 0; if (Math.sign(inp.my) === Math.sign(dy)) inp.my = 0; }   // can't wander off screen
  return safe ? { ...inp, atk: false, spell: [false, false, false], fusion: false, layer: false, block: false } : inp;
}
// the camera between you both
const coopCamTarget = w => { const a = coopActor(w), p = w.player; return a && !a.dead ? { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 } : p; };
function drawCoopHud(game, w, now) {
  const a = coopActor(w); if (!a) return;
  drawHUD(a, 1, now, `Player 2 · ${className(a.cls)}`);
  if (a.dead || a.hp <= 0) text(`Player 2 is down · back in ${Math.ceil((COOP.revive - (a.coopDown || 0)) / 1000)}s`, VW - 90, 76, '#ff9a8a', 7);
  else text('P2: arrows · / attack · , . ; spells · ] Layer · = leave', VW - 8, 76, 'rgba(200,220,255,0.7)', 6, 'right');
}
