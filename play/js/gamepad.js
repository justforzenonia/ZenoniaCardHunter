'use strict';
// CONTROLLERS: any gamepad the browser knows (the standard layout: Xbox, PlayStation, Switch Pro and most others). It is read
// every frame and presses the same keys a keyboard would (core.js keys/pressed, as touch.js does), so every system just works.
//   left stick / D-pad   move (and the choice in menus)
//   A                    attack · OK in menus            B   dash · BACK in menus
//   X                    talk (Enter) · C in menus (the Monster Book's card view)   Y   Layer
//   LB / RB / RT         spells 1 / 2 / 3 (LB / RB switch tabs in menus)   LT  block (held)
//   START                pause (Esc)                    SELECT / BACK  bag (Tab)
//   left stick click     map (M)                        right stick click  meals (B)
// The fight buttons follow rebound keys (settings.js), and the arena's keys in the arena.
const PAD = { dead: 0.4, seen: false, prev: {} };
const padPlay = () => window.GAME && !GAME.menu && (GAME.scene === 'world' || GAME.scene === 'arena');
const padMap = () => (window.GAME && GAME.scene === 'arena' ? PV1 : SOLO);
// what each button presses right now (in play, or in a menu)
const PAD_BTN = {
  0: () => (padPlay() ? padMap().atk[0] : 'Enter'), 1: () => (padPlay() ? padMap().dash[0] : 'Escape'),
  2: () => (padPlay() ? 'Enter' : 'KeyC'), 3: () => (padPlay() ? padMap().layer[0] : null),
  4: () => (padPlay() ? padMap().spell[0][0] : 'KeyQ'), 5: () => (padPlay() ? padMap().spell[1][0] : 'KeyE'),   // (in menus LB / RB switch tabs: Q / E)
  6: () => (padPlay() ? (padMap().block || [])[0] : null), 7: () => (padPlay() ? padMap().spell[2][0] : null),
  8: () => 'Tab', 9: () => 'Escape', 10: () => 'KeyM', 11: () => 'KeyB',
  12: () => 'KeyW', 13: () => 'KeyS', 14: () => 'KeyA', 15: () => 'KeyD',
};
const padPress = c => { if (!c) return; if (!keys.has(c)) pressed.add(c); keys.add(c); };
const padLift = c => { if (c) keys.delete(c); };
(function padTick() {
  requestAnimationFrame(padTick);
  const list = navigator.getGamepads ? navigator.getGamepads() : []; const g = [...(list || [])].find(p => p && p.connected); if (!g) return;
  if (!PAD.seen) { PAD.seen = true; if (window.GAME && GAME.toast) GAME.toast('Controller ready: A attack · B dash · LT block · Y Layer · START pause', '#9fd8ff'); }
  const now = {};
  g.buttons.forEach((b, i) => { if (PAD_BTN[i] && (b.pressed || b.value > 0.5)) now['b' + i] = true; });
  const ax = g.axes[0] || 0, ay = g.axes[1] || 0;   // the left stick acts as the D-pad
  if (ax < -PAD.dead) now.b14 = true; if (ax > PAD.dead) now.b15 = true; if (ay < -PAD.dead) now.b12 = true; if (ay > PAD.dead) now.b13 = true;
  for (const k in PAD.prev) if (!now[k]) { padLift(PAD.prev[k]); delete PAD.prev[k]; }   // let go: the key it held comes up
  for (const k in now) if (!(k in PAD.prev)) { const code = PAD_BTN[k.slice(1)](); PAD.prev[k] = code; padPress(code); }   // pressed: its key goes down (held keys stay down while held)
})();
addEventListener('gamepadconnected', () => { PAD.seen = false; });
