'use strict';
// GRANDPA: the first time you head out on an adventure, your grandfather is waiting just before the first bridge out
// of Hearthvale. Rent is due, so he does what he swore he never would and unlocks your full potential (a talk, no
// EXP), and he hands over 300 G for supplies (the rest of the rent is on you). Once per save (pr.grandpa).

const GRANDPA = { npc: '107', name: 'Grandpa', gold: 300 };
const GRANDPA_LINES = [
  'There you are! Before you cross that bridge… sit down a moment, kid.',
  'The landlord came by again. RENT IS DUE. And you, my dear grandchild, are going to pay it.',
  'So I am doing what I swore I would never do. I am unlocking your full potential. Hold still!',
  'Ha! Feel that? That is the power of our family. But power is nothing if you do not know how to use it — you will have to learn that yourself.',
  'And listen: it is rough out there. Monsters, black holes, worse. Do not get cocky, and come home when you are hurt.',
  'Here is 300 G for supplies — the rest of the rent is on you. Now get out there and hunt!',
];
// the first bridge out of town: the easternmost one (Hearthvale sits at the world's east end)
function firstBridge() {
  const B = (WILDS.bridges || []).filter(Boolean); if (!B.length) return null;
  return B.reduce((a, b) => (b.x1 > a.x1 ? b : a));
}
function grandpaTick(game, w, dt) {
  const pr = game.profile; if (!pr || pr.grandpa || !w.overworld || w.interior || game.menu) return;
  const B = firstBridge(); if (!B) return;
  const p = w.player, bx = (B.x1 + 1) * T, by = B.y * T + 12;
  if (p.x < bx - 40 || p.x > bx + 320 || Math.abs(p.y - by) > 260) return;   // only on the way to the bridge
  let g = w.actors.find(a => a.grandpa);
  if (!g) {   // he waits at the bridgehead
    const at = findOpen(w, bx + 34, by);
    g = baseActor('npc', 2, at.x, at.y);
    Object.assign(g, { npc: GRANDPA.npc, label: GRANDPA.name, h: 26, home: { x: at.x, y: at.y }, ai: { t: 0, still: true }, grandpa: true, marker: '#ffd23f' });
    w.actors.push(g);
  }
  if (dist(g, p) > 64) return;
  g.dir = dirTo(p.x - g.x, p.y - g.y);
  const m = dialogMenu(GRANDPA.name, GRANDPA_LINES[0], null);
  m.pages = GRANDPA_LINES.slice(1);
  m.onDone = () => {
    pr.grandpa = true;
    pr.gold = (pr.gold || 0) + GRANDPA.gold;
    w.rings.push({ x: p.x, y: p.y, r: 40, t: 0, col: '#ffd23f' }, { x: p.x, y: p.y, r: 24, t: -120, col: '#ffffff' });
    game.toast(`Grandpa unlocked your full potential! +${GRANDPA.gold} G — rent is due, hunter`, '#ffd23f');
    g.marker = null; g.leaveT = 2500;
    game.save();
  };
  game.openMenu(m);
}
// after the talk he heads home (fades out), and calls back over his shoulder: he is keeping your dog until you farm
const GRANDPA_DOG_LINES = [
  'Oh! One more thing, kid — I am keeping your dog until you prove you can feed it.',
  'Grow some crops on the farm beside the house. When you reach Farm Level 2, put a point into LOYAL HOUND at the Farm Board, and I will bring the pup back to you.',
];
function grandpaFade(game, w, dt) {
  const g = w.actors.find(a => a.grandpa && a.leaveT != null); if (!g) return;
  g.leaveT -= dt; g.alpha = Math.max(0, Math.min(1, g.leaveT / 1000));
  if (g.leaveT <= 0 && !game.menu) {
    g.remove = true;
    const m = dialogMenu('Grandpa (calling from the road)', GRANDPA_DOG_LINES[0], null); m.pages = GRANDPA_DOG_LINES.slice(1);
    game.openMenu(m);
  }
}
