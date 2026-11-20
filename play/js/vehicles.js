'use strict';
// VEHICLES: unlocked on the Farm Board's VEHICLES tab and driven in the Wilds (never in a town, a house, a black hole or a
// rift) at three times your speed, facing up, down, left or right, and crashing if you hit something flat out. 9 (or the car chip over the menu pills) gets in and out; while you drive you can't
// fight, and driving into a town parks it. Each model has paint jobs (rows of the 8-direction sheet) and a tint on top,
// both chosen on the board.
// pr.garage = { owned: { id: true }, cur: id, paint: { id: n }, tint: { id: n } }
const VEH = { speed: 2.2, price: 500000, smash: { fast: 0.45 }, crash: { fast: 0.85, dead: 0.15, stun: 650, bounce: 8, shake: 4, anims: [5, 4] }, drive: { accel: 8, coast: 9, brake: 14, turn: 30, turnSlow: 40, grip: 80, gripFast: 80, minMul: 0.12 }, shield: { mul: 5, regen: 0.06, wait: 3000 }, key: 'Digit9', sheet: 'assets/vehicles8.png', tints: 8, foot: 6, chip: { x: 6, y: VH - 178, w: 104, h: 16 } };
// EIGHT DIRECTIONS: the user's Gemini sheet (tools/build_vehicles8.py -> assets/vehicles8.png, window.VEHICLE8): each
// vehicle has five views [down, down-left, right, up-right, up] (as Gemini drew them); the other three are mirrors. A heading (vDir) runs clockwise
// from right: 0 right, 1 down-right, 2 down, 3 down-left, 4 left, 5 up-left, 6 up, 7 up-right.
const VEH_SIDE_LEFT = new Set([0, 1, 2, 3, 4, 5]);   // sheet rows whose side view (view 2) is drawn facing left: Pickup x3, Cargo Truck x2, Hauler
const VEH_VIEW = [[2, false], [1, true], [0, false], [1, false], [2, true], [3, true], [4, false], [3, false]];   // vDir -> [view, mirrored]
const VEH_DIRVEC = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
// paints: row = the vehicle's row in the sheet
const VEHICLE_ALL = [
  { id: 'pickup', name: 'Pickup', price: VEH.price, desc: 'A sturdy little truck for the open road', paints: [{ name: 'Teal', row: 0 }, { name: 'Slate', row: 1 }, { name: 'Snow', row: 2 }] },
  { id: 'bubble', name: 'Bubble Car', price: VEH.price, desc: 'Round, quick and very shiny', paints: [{ name: 'Sky', row: 7 }, { name: 'Aqua', row: 8 }, { name: 'Cream', row: 9 }] },
  { id: 'cargo', name: 'Cargo Truck', price: VEH.price, desc: 'Room in the back for every card you find', paints: [{ name: 'Peach Roof', row: 3 }, { name: 'Frost Roof', row: 4 }] },
  { id: 'hauler', name: 'Hauler', price: VEH.price, desc: 'Built for the long haul to the end of the world', paints: [{ name: 'Night Roof', row: 5 }] },
  { id: 'ice', name: 'Ice Truck', price: VEH.price, desc: 'Chains on the wheels for the Frozen Abyss', paints: [{ name: 'Steel', row: 6 }] },
];
// PICKUP ONLY (2026-11-20, the user: "only pick up in vehicle tab"): the VEHICLES tab sells and lists just the Pickup. The
// other models stay in VEHICLE_ALL so a friend's older game can still draw theirs; a save that bought one of them gets the
// Pickup in its place (same price, so nothing is lost), with that car's tint carried over.
const VEHICLE_MODELS = VEHICLE_ALL.filter(v => v.id === 'pickup');
const vehModel = id => VEHICLE_ALL.find(v => v.id === id);
const garageOf = pr => {
  const G = pr.garage || (pr.garage = { owned: {}, cur: null, paint: {}, tint: {} }); G.owned = G.owned || {}; G.paint = G.paint || {}; G.tint = G.tint || {};
  const old = Object.keys(G.owned).filter(id => G.owned[id] && !VEHICLE_MODELS.some(v => v.id === id));
  if (old.length) { const P = VEHICLE_MODELS[0].id; if (!G.owned[P] && G.tint[P] == null && G.tint[old[0]]) G.tint[P] = G.tint[old[0]]; G.owned[P] = true; for (const id of old) delete G.owned[id]; }
  if (G.cur && !G.owned[G.cur]) G.cur = G.owned[VEHICLE_MODELS[0].id] ? VEHICLE_MODELS[0].id : null;
  return G;
};   // (an older or partial garage gets its missing tables)
// TINT: a real repaint, not a filter. The body paint (the sprite's main colour, found by hue, or the greys of a white or
// slate car) is recoloured to the tint's hue, each pixel keeping its own light and shade; glass, tyres, lights and outlines
// are left alone. Made once per frame and tint, then kept (VEH_PAINTED).
const VEH_TINT_HUE = [null, 0, 28, 52, 120, 175, 215, 285];   // none, red, orange, gold, green, teal, blue, violet
const vehTintCss = i => i ? `hsl(${VEH_TINT_HUE[i]},70%,52%)` : '#9aa4b8';
const VEH_PAINTED = {};
// (rgb2hsl / hsl2rgb come from style.js: a second copy here used to override them for the whole game)
function vehPainted(im, r, tint) {
  const key = r.join(',') + ':' + tint; if (VEH_PAINTED[key]) return VEH_PAINTED[key];
  const c = document.createElement('canvas'); c.width = r[2]; c.height = r[3]; const g = c.getContext('2d'); g.drawImage(im, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  const D = g.getImageData(0, 0, c.width, c.height), d = D.data, hues = new Array(36).fill(0); let grey = 0, coloured = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const [h, s2, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]); if (l < 0.18 || l > 0.97) continue; if (s2 > 0.22) { hues[Math.floor(h / 10) % 36]++; coloured++; } else grey++; }
  const main = hues.indexOf(Math.max(...hues)) * 10 + 5, greyCar = grey > coloured, T = VEH_TINT_HUE[tint];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue; const [h, s2, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]); if (l < 0.18 || l > 0.97) continue;   // (outlines, tyres, highlights stay)
    const body = greyCar ? !(s2 > 0.3 && h > 190 && h < 255 && l < 0.6) : s2 > 0.22 && Math.abs(((h - main + 540) % 360) - 180) < 32; if (!body) continue;
    const [nr, ng, nb] = hsl2rgb(T, greyCar ? 0.5 : Math.max(0.45, s2), greyCar ? 0.2 + l * 0.65 : l); d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
  }
  g.putImageData(D, 0, 0); return (VEH_PAINTED[key] = c);
}
// FOUR WAYS ONLY (2026-11-20, the user: "only use up, down, left, right for car direction no inbetween"): a car faces and
// drives right, down, left or up (vDir 0, 2, 4, 6); the in-between views of the sheet are no longer used.
const vehDirOf = (mx, my) => ((Math.round(Math.atan2(my, mx) / (Math.PI / 2)) * 2) % 8 + 8) % 8;
// a stick or two keys held at once: keep to one axis. The stronger axis wins; on a tie (two keys) the car keeps going the way
// it already faces if that is one of them, else it takes the newly pressed side way
function vehAxis(mx, my, ang) {
  const ax = Math.abs(mx), ay = Math.abs(my);
  if (ax > ay + 0.15) return [Math.sign(mx), 0];
  if (ay > ax + 0.15) return [0, Math.sign(my)];
  const hx = Math.round(Math.cos(ang)), hy = Math.round(Math.sin(ang));
  if (hx && Math.sign(mx) === hx) return [hx, 0];
  if (hy && Math.sign(my) === hy) return [0, hy];
  return ax >= ay ? [Math.sign(mx), 0] : [0, Math.sign(my)];
}
// any older in-between heading (a car parked before the four-way change, a friend's older game) shows as a straight one
const vehDir4 = dir => { const d = ((dir | 0) % 8 + 8) % 8; return d & 1 ? (d + 1) % 8 : d; };
// draw a vehicle heading dir (0-7) with its bottom centre at (x, y); it bobs as it moves
function drawVehicleSprite(V, paint, tint, dir, moving, x, y, now, scale = 1, rot = 0) {
  const im = img(VEH.sheet), S = window.VEHICLE8; if (!im || !im.complete || !S) return;
  const P = V.paints[Math.min(paint || 0, V.paints.length - 1)], [view, flip0] = VEH_VIEW[vehDir4(dir)], r = S.frames[(S.rows[P.row] || [])[view]]; if (!r) return;
  // (2026-11-20, the user: "car is backwards": the sheet's side view faces LEFT for the Pickup, Cargo Truck and Hauler rows and
  // right for the Ice Truck and Bubble Cars, so the left-facing ones are turned round)
  const flip = view === 2 && VEH_SIDE_LEFT.has(P.row) ? !flip0 : flip0;
  const w = r[2] * scale, h = r[3] * scale, bob = moving ? (Math.floor(now / (moving === true ? 140 : moving)) % 2) * scale : 0;   // (moving: true, or the bob period in ms)
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y - bob)); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  if (tint) ctx.drawImage(vehPainted(im, r, tint), 0, 0, r[2], r[3], Math.round(-w / 2), Math.round(-h), w, h);
  else ctx.drawImage(im, r[0], r[1], r[2], r[3], Math.round(-w / 2), Math.round(-h), w, h); ctx.restore();
}
// the hero at the wheel (drawActor hands the player over while driving)
const VEH_SWAY = { k: 0.2, max: 0.06, ease: 7 }, VEH_BOB = { slow: 300, fast: 140 };
function drawDrivenVehicle(a, now) {
  const pr = window.GAME && GAME.profile; if (!pr) return; const G = garageOf(pr), V = vehModel(a.driving); if (!V) return;
  // moving: the car steps the hero's x/y directly (vx/vy stay 0), so it is judged from the throttle, or for someone else's car
  // (online co-op: no throttle sent) from how far it moved since the last frame
  const L = a.vDrawnAt, stepped = L ? Math.hypot(a.x - L.x, a.y - L.y) : 0; a.vDrawnAt = { x: a.x, y: a.y };
  const moving = a.vThrottle != null ? a.vThrottle > 0.05 : stepped > 0.3 || Math.hypot(a.vx || 0, a.vy || 0) > 5, th = a.vThrottle != null ? a.vThrottle : moving ? 1 : 0;
  // (2026-11-06: the body bounces slower and the dust behind thins out at a crawl; quicker and fuller at full speed)
  const bobMs = moving ? Math.round(VEH_BOB.slow + (VEH_BOB.fast - VEH_BOB.slow) * th) : 0;
  const dustRgb = moving && typeof vehGround === 'function' ? vehGround(window.GAME && GAME.world, a.x).dustRgb : '220,210,190';
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
  const shake = a.vStun > 0 ? Math.sin(now / 30) * 0.08 * (a.vStun / VEH.crash.stun) : 0;   // rattled after a crash
  // SWAY (2026-11-06): the body leans a touch on a sharp turn (with the drift) and rocks back level as it straightens; eased,
  // at most VEH_SWAY.max radians, so it reads as soft springs, not a tumble.
  const sec = Math.min(50, now - (a.vSwayAt || now)) / 1000, want = clamp(-(a.vDrift || 0) * VEH_SWAY.k, -VEH_SWAY.max, VEH_SWAY.max); a.vSwayAt = now;
  a.vSway = (a.vSway || 0) + (want - (a.vSway || 0)) * (1 - Math.exp(-VEH_SWAY.ease * sec));
  const look = a.vLook || [G.paint[V.id], G.tint[V.id]];   // (someone else's car keeps their own paint: online co-op, net.js)
  drawVehicleSprite(V, look[0], look[1], a.vDir ?? 2, bobMs, a.x, a.y + VEH.foot, now, 1, shake);   // (no sway tilt: rotating pixel art by a hair smudged it, 2026-11-08)
  if (window.GAME) drawVehShieldBar(a.x, a.y - 44, vehShield(GAME, a), now);
  if (a.vStun > 0) for (let i = 0; i < 3; i++) { const k = ((now / 500) + i / 3) % 1; ctx.fillStyle = `rgba(90,86,80,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(a.x + (i - 1) * 8, a.y - 22 - k * 18, 3 + k * 4, 0, Math.PI * 2); ctx.fill(); }   // smoke from the bonnet
  if (moving) for (let i = 0; i < 2; i++) { const k = ((now / 260) + i * 0.5) % 1; ctx.fillStyle = `rgba(${dustRgb},${0.45 * (1 - k) * (0.25 + 0.75 * th)})`; ctx.beginPath(); ctx.arc(a.x - VEH_DIRVEC[a.vDir ?? 2][0] * 24 * (1 + k * 0.4), a.y - 2 - VEH_DIRVEC[a.vDir ?? 2][1] * 12 - k * 6, (2 + k * 3) * (0.6 + 0.4 * th), 0, Math.PI * 2); ctx.fill(); }   // a puff of dust behind
}
// THE CRASH EFFECT: Zenonia's own, from the battle effects: the explosion cloud (anim 5) with the CRASH! word over it (anim 4)
function vehCrashFx(w, x, y) { const B = D.fx.battle; for (const k of VEH.crash.anims) { const seq = B.anims[k]; w.fx.push({ bank: B, seq, x, y, t: 0, dur: seq.reduce((n, f) => n + f[1], 0), scale: 1 }); } }
// THE CAR'S SHIELD: while you drive, every blow lands on the car, never on you: a big shield (five times your max HP) that
// refills after 3 s without a hit. Break it and the car explodes (CRASH!): you're thrown out, back on foot and open to
// blows again, and the car turns up again by your house, mended. game.vehShield = { hp, max, hitAt, broken }
function vehShield(game, p) { const max = Math.round((p.maxHp || 100) * VEH.shield.mul), S = p.coop2 ? (p.vShieldS || (p.vShieldS = { hp: max, max, hitAt: 0, broken: false })) : game.vehShield || (game.vehShield = { hp: max, max, hitAt: 0, broken: false });   /* (Player 2's car has its own: net.js) */ if (S.max !== max) { S.hp = Math.min(max, S.hp * max / S.max); S.max = max; } return S; }
function vehShieldHit(world, p, dmg) {
  const game = window.GAME; if (!game || !p.driving || world !== game.world) return dmg; const S = vehShield(game, p);
  S.hp -= dmg; S.hitAt = performance.now(); floatText(world, p.x, p.y - 34, `-${Math.round(dmg)} SHIELD`, '#8fd8ff', 8);
  if (S.hp <= 0) {   // wrecked
    vehCrashFx(world, p.x, p.y - 12); world.shake = Math.max(world.shake || 0, 10); world.flash = { t: 0, dur: 220, col: '#ffd8a0' };   // it explodes
    for (let i = 0; i < 18; i++) world.particles.push({ x: p.x + rand(-12, 12), y: p.y - rand(4, 20), vx: rand(-60, 60), vy: rand(-80, -20), t: 0, life: rand(600, 1200), col: i % 3 ? '#6a6660' : '#3a3632', size: rand(3, 6), puff: true });
    if (p.coop2) p.driving = null; else { p.driving = game.vehOn = null; game.vehPark = null; } p.vStun = 0; S.hp = S.max; S.broken = false;   // ...and the car turns up again by your house, mended
    const q = findOpen(world, p.x + 24, p.y + 14); p.x = q.x; p.y = q.y;
    game.toast('Your car exploded! It is back by your house', '#ff9a7a');
  }
  return 0;
}
function vehShieldTick(game, w, dt) {
  const p = w.player; if (!p) return; const S = vehShield(game, p);
  if (performance.now() - S.hitAt > VEH.shield.wait && S.hp < S.max) S.hp = Math.min(S.max, S.hp + S.max * VEH.shield.regen * dt / 1000);
  if (S.broken && S.hp >= S.max) { S.broken = false; game.toast('Your car is mended and ready to drive', '#8fd8ff'); }
}
function drawVehShieldBar(x, y, S, now) {
  const w = 40, k = S.max ? S.hp / S.max : 0;
  ctx.fillStyle = 'rgba(8,10,20,0.8)'; ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, w + 2, 4);
  ctx.fillStyle = S.broken ? '#ff6a5a' : now - S.hitAt < 200 ? '#ffffff' : '#8fd8ff'; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w * k), 2);
}
// PARKED: your car waits beside your house (the home point's door, or Hearthvale's), facing the street; walk up and press
// Enter (or 9) to get in. Step out (9) anywhere and it stays parked right there, until a new trip puts it back by the house.
// You can drive anywhere outdoors, in towns too; never indoors, in a black hole or a rift (there it parks at the door).
const VEH_PARK = { dx: -54, dy: 26, reach: 34, dir: 3 };
const canDrive = (w, p) => !!(w && p && w.overworld && !w.interior && !w.cave && !w.rift);
// THE CAR'S HOUSE: pr.garage.at is the house the car waits by: an outpost's index, 'hv' for Hearthvale, or unset to follow
// your home point (towns.js). Chosen in the HOME menu (T), where it can be sent to any house you own.
function vehHouse(pr) {
  const at = garageOf(pr).at;
  if (at === 'hv') return null;
  if (at != null && typeof ownsTownHome === 'function' && ownsTownHome(pr, at) && OUTPOSTS[at]) return at;
  return typeof homePointOf === 'function' ? homePointOf(pr) : null;
}
function vehHomeSpot(w, pr) {
  const i = vehHouse(pr); if (w._vehHome && w._vehHomeAt === i) return w._vehHome;   // (worked out again once the car is sent elsewhere)
  const D = i != null ? OUTPOSTS[i].door : { x: HOME_DOOR.x + TOWN_OX, y: HOME_DOOR.y + TOWN_OY };
  const q = findOpen(w, D.x + VEH_PARK.dx, D.y + VEH_PARK.dy); w._vehHomeAt = i; return (w._vehHome = { x: q.x, y: q.y, dir: VEH_PARK.dir });
}
// where the car is now: where you left it in this world, or by the house
function vehParked(game, w) {
  const pr = game.profile, G = pr && garageOf(pr); if (!G || !G.cur || !G.owned[G.cur] || !w || !w.overworld || w.interior) return null;
  if (w.player && w.player.driving) return null;
  const P = game.vehPark; return P && P.w === w ? P : vehHomeSpot(w, pr);
}
function vehGetIn(game, w, p, at) {
  const G = garageOf(game.profile), S = vehShield(game, p);
  if (S.broken) { game.toast(`Your car is wrecked: mending ${Math.floor(S.hp / S.max * 100)}%`, '#ff9a7a'); return; }
  p.x = at.x; p.y = at.y; p.vx = p.vy = 0; p.driving = game.vehOn = G.cur; p.vDir = at.dir ?? 2; p.vStun = 0; p.vPrev = null; p.vSpd = 0; p.vAng = null; p.vThrottle = 0; game.vehPark = null;
  game.toast(`${vehModel(G.cur).name}: ×${VEH.speed} speed · 9 to get out · attack: horn`, '#8fd8ff');
}
function vehToggle(game, w, p) {
  const pr = game.profile, G = garageOf(pr);
  if (p.driving) { p.driving = game.vehOn = null; game.vehPark = { w, x: p.x, y: p.y, dir: p.vDir ?? 2 }; game.toast('You park and step out', '#c9c1a8'); return; }
  if (!G.cur || !G.owned[G.cur]) { game.toast('No vehicle yet: unlock one on the Farm Board (VEHICLES tab)', '#ff9a8a'); return; }
  const at = vehParked(game, w);
  if (!at || !canDrive(w, p)) { game.toast('You can only drive outdoors', '#c9c1a8'); return; }
  if (Math.hypot(at.x - p.x, at.y - p.y) > VEH_PARK.reach + 10) {   // CALL THE CAR (2026-11-06): far from it, it rolls up beside you
    const q = findOpen(w, p.x, p.y);
    for (let i = 0; i < 10; i++) w.particles.push({ x: q.x + rand(-14, 14), y: q.y + rand(-3, 3), vx: rand(-40, 40), vy: rand(-26, -6), t: 0, life: rand(300, 600), col: '#d8c8a8', size: rand(2, 4), puff: true });
    vehGetIn(game, w, p, { x: q.x, y: q.y, dir: [6, 0, 2, 4][p.dir | 0] ?? 0 });   // (facing the way you were: hero dir 0 up, 1 right, 2 down, 3 left)
    return;
  }
  vehGetIn(game, w, p, at);
}
// Enter beside the parked car (main.js)
function vehParkedInteract(game, w) {
  const p = w.player, at = vehParked(game, w); if (!p || !at || Math.hypot(at.x - p.x, at.y - p.y) > VEH_PARK.reach) return false;
  vehGetIn(game, w, p, at); return true;
}
// the parked car in the world, depth-sorted with everyone (world.js), with a prompt when you're beside it
function drawParkedCar(w, now, items) {
  const game = window.GAME; if (!game || !game.profile) return; const at = vehParked(game, w); if (!at) return;
  const p = w.player; if (Math.abs(at.x - p.x) > 420 || Math.abs(at.y - p.y) > 300) return;
  const G = garageOf(game.profile), V = vehModel(G.cur); if (!V) return;
  items.push({ y: at.y, draw: () => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(at.x, at.y + 2, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    drawVehicleSprite(V, G.paint[V.id], G.tint[V.id], at.dir ?? 2, false, at.x, at.y + VEH.foot, now);
    const S = vehShield(game, p);
    if (S.broken || S.hp < S.max) drawVehShieldBar(at.x, at.y - 44, S, now);
    if (S.broken) for (let i = 0; i < 3; i++) { const k = ((now / 600) + i / 3) % 1; ctx.fillStyle = `rgba(70,66,62,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(at.x + (i - 1) * 7, at.y - 24 - k * 22, 3 + k * 5, 0, Math.PI * 2); ctx.fill(); }   // smoking wreck
    if (Math.hypot(at.x - p.x, at.y - p.y) < VEH_PARK.reach) text(S.broken ? `Wrecked · mending ${Math.floor(S.hp / S.max * 100)}%` : `Enter: Drive the ${V.name}`, at.x, at.y + 14, S.broken ? '#ff9a7a' : '#8fd8ff', 7);
  } });
}
// an analog stick's real tilt, when one is held (a gamepad's left stick, or the touch joystick): the keys it presses only give
// eight directions at full tilt, so the car reads the stick itself to steer at any angle and to go slower at part tilt
function vehStick() {
  try { const L = navigator.getGamepads ? navigator.getGamepads() : [], g = [...(L || [])].find(q => q && q.connected); if (g) { const x = g.axes[0] || 0, y = g.axes[1] || 0; if (Math.hypot(x, y) > 0.25) return { x, y }; } } catch (e) {}
  return typeof TOUCH !== 'undefined' && TOUCH.vec ? TOUCH.vec : null;
}
const vehAngDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
// the car's speed follows its throttle (combat.js speedOf already gives the x3 for driving)
{ const so = speedOf; speedOf = a => { const s = so(a); return a.driving && a.vThrottle != null ? s * Math.max(VEH.drive.minMul, a.vThrottle) : s; }; }
// each world frame (main.js): the key and the chip, parking when you leave the Wilds, and no fighting at the wheel
function vehicleInput(game, w, inp) {
  const p = w.player; if (!p) return inp;
  const B = VEH.chip, show = !!p.driving;
  if (hit(VEH.key) || (show && clicked(B.x, B.y, B.w, B.h))) vehToggle(game, w, p);
  if (game.vehOn && !p.driving) p.driving = game.vehOn;   // (the hero is sometimes rebuilt: still at the wheel)
  if (p.driving && !canDrive(w, p)) { p.driving = game.vehOn = null; game.toast('You park and step out', '#c9c1a8'); }
  if (!p.driving) return inp;
  p.vFroze = w.hitStop > 0;   // (the step about to run is frozen: no crash check after it)
  // (2026-11-20, the user: "movements arnt that good it glides": TIGHT ARCADE handling: full speed in ~0.12 s, stops in ~0.11 s when you let go,
  // turns snap round (30-40 rad/s) and the grip is total, so no drift; the earlier soft-car numbers are below for the record)
  // (2026-11-07, user: hard to handle and goes too fast: top speed x3 to x2.2, accel 1.4 to 0.85 (about 1.2 s to full), turns 4.2 / 9 to 3.2 / 6.5 rad/s, grip at speed 3.4 to 6.5 so it slides far less, coasting 0.8 to 1.0)
  // HANDLING (2026-11-06): the car has its own heading (vAng), the way it is actually travelling (vVel) and a throttle (0-1).
  // Holding a direction speeds it up over about 0.7 s and turns it smoothly toward that way (slower turns at speed); letting
  // go coasts to a stop; pulling the opposite way brakes first. At speed the travel lags the heading on a sharp turn: a
  // little drift. The game moves the hero along vVel; speedOf (below) scales the car's speed by the throttle.
  return vehHandle(p, inp, vehStick());
}
// the handling itself, for any car: yours (with an analog stick, st) and, on the host, a co-op friend's (net.js netGuestCar)
function vehHandle(p, inp, st) {
  const D = VEH.drive, t = performance.now(), sec = Math.min(50, t - (p.vT || t)) / 1000; p.vT = t;
  if (p.vAng == null) { const v = VEH_DIRVEC[p.vDir ?? 2]; p.vAng = p.vVel = Math.atan2(v[1], v[0]); p.vThrottle = 0; }
  const stalled = p.vStun > 0, mx = st ? st.x : inp.mx || 0, my = st ? st.y : inp.my || 0, want = !stalled && Math.hypot(mx, my) > 0.3;   // (an analog stick steers to any angle)
  if (stalled) p.vThrottle = 0;
  else if (want) {
    const [qx, qy] = vehAxis(mx, my, p.vAng), target = Math.atan2(qy, qx), diff = vehAngDiff(target, p.vAng);
    if (Math.abs(diff) > 2.4 && p.vThrottle > 0.08) p.vThrottle = Math.max(0, p.vThrottle - D.brake * sec);   // the other way: brake first
    else {
      if (p.vThrottle <= 0.08 && Math.abs(diff) > 2.4) p.vAng = p.vVel = target;   // (from a standstill it simply turns round)
      const rate = D.turnSlow + (D.turn - D.turnSlow) * p.vThrottle; p.vAng += clamp(diff, -rate * sec, rate * sec);
      const cap = Math.min(1, Math.hypot(mx, my));   // (a stick tilted part way drives slower: gamepad, touch; keys always give 1)
      p.vThrottle = p.vThrottle > cap ? Math.max(cap, p.vThrottle - D.coast * sec) : Math.min(cap, p.vThrottle + D.accel * sec);
    }
  } else p.vThrottle = Math.max(0, p.vThrottle - D.coast * sec);
  const grip = D.grip + (D.gripFast - D.grip) * p.vThrottle; p.vVel += clamp(vehAngDiff(p.vAng, p.vVel), -grip * sec, grip * sec);
  // once a turn is all but done, settle exactly on the axis so the car never creeps along at a slant
  { const sq = Math.round(p.vAng / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(vehAngDiff(sq, p.vAng)) < 0.12) p.vAng = sq; if (Math.abs(vehAngDiff(p.vAng, p.vVel)) < 0.12) p.vVel = p.vAng; }
  p.vDrift = vehAngDiff(p.vAng, p.vVel); p.vDir = vehDirOf(Math.cos(p.vAng), Math.sin(p.vAng));   // (the sprite shows the nearest of its four views)
  const go = p.vThrottle > 0.03;
  p.vWant = go && p.vThrottle > 0.3 ? { x: Math.cos(p.vVel), y: Math.sin(p.vVel) } : null;
  return { ...inp, mx: go ? Math.cos(p.vVel) : 0, my: go ? Math.sin(p.vVel) : 0, atk: false, spell: [false, false, false], fusion: false, layer: false, dash: false, block: false };
}
// after each step (main.js): a car at full speed that stops dead has hit something: CRASH. Zenonia's own CRASH! burst goes
// off at the front (the battle effects' combo crash), smoke rolls up, the screen jolts, the car bounces back a little and stalls for a moment, rattling.
function vehicleAfter(game, w, dt) {
  const p = w.player; if (!p) return;
  vehRiders(w, p);
  if (!p.driving) { p.vPrev = null; return; }
  const prev = p.vPrev; p.vPrev = { x: p.x, y: p.y };
  if (p.vStun > 0) { p.vStun -= dt; p.vSpd = 0; return; }
  if (!prev || dt <= 0) return;
  const now = Math.hypot(p.x - prev.x, p.y - prev.y) / dt * 1000, expect = speedOf(p), was = p.vSpd || 0, T = p.vThrottle || 0;
  p.vSpd = was * 0.6 + now * 0.4;
  if (Math.abs(p.vDrift || 0) > 0.35 && T > 0.5 && Math.random() < 0.5) { const b = VEH_DIRVEC[p.vDir ?? 2]; w.particles.push({ x: p.x - b[0] * 16 + rand(-5, 5), y: p.y + rand(-2, 2), vx: rand(-15, 15), vy: rand(-14, -4), t: 0, life: 380, col: vehGround(w, p.x).dust, size: 2.6, puff: true }); }   // drift dust
  const sm = p.vWant && T > VEH.smash.fast ? vehSmash(w, p) : false;
  const headOn = Math.abs(p.vDrift || 0) < 0.5;
  if (sm === 'crash') { if (T > VEH.crash.fast && headOn) vehCrash(game, w, p); else vehBump(game, w, p); return; }   // a chest, a giant tree: CRASH flat out, else a bump
  if (sm === true) return;   // ploughed through something: no crash
  if (p.vFroze || w.hitStop > 0) { p.vSpd = was; return; }   // (a freeze-frame is not a dead stop)
  if (p.vWant && was > expect * 0.6 && now < expect * VEH.crash.dead) { if (T > VEH.crash.fast && headOn) vehCrash(game, w, p); else if (T > 0.35) vehBump(game, w, p); }
}
// RIDERS: your partner and pets climb in with you: hidden, safe, carried along; they hop out where you get out
function vehRiders(w, p) {
  for (const a of w.actors) {
    if (!a.ally || !a.owner || a.owner.kind !== 'player' || a === p) continue;   // (the owner can be an older copy of the hero, rebuilt since)
    if (p.driving) { a.riding = true; a.x = p.x; a.y = p.y; a.vx = a.vy = 0; a.invuln = Math.max(a.invuln || 0, 200); a.state = a.state === 'dead' ? a.state : 'free'; }
    else if (a.riding) { a.riding = false; const q = findOpen(w, p.x + (a.heroPartner ? -20 : 18), p.y + 10); a.x = q.x; a.y = q.y; }
  }
}
// SMASHING: at speed the car ploughs through what stands in front of it: crates, boulders, bushes, lamp posts, small trees
// and rocks burst apart (crates drop their loot as if you'd broken them). Giant trees, chests, walls, cliffs and water don't
// give: those still CRASH.
// what a car can never break: tents and huts people live in, wells, and whatever leads somewhere (a door)
const vehUnbreakable = o => (typeof TENT !== 'undefined' && TENT.banks[`${o.bank}:${o.fi}`] != null) || (typeof WELLS !== 'undefined' && o.bank === WELLS.bank) || o.door || o.portal || o.landmark;
// a smashed rock or tree often stood on map tiles marked solid under it: clear those too, or an invisible wall stays where it was
// (water never: rivers stay rivers)
function vehClearUnder(w, b) {
  const M = w.map; if (!M || !M.solid) return;
  for (let ty = Math.floor(b.y / T); ty <= Math.floor((b.y + b.h - 1) / T); ty++) for (let tx = Math.floor(b.x / T); tx <= Math.floor((b.x + b.w - 1) / T); tx++) {
    if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h || inRiverAt(tx * T + 8, ty * T + 8)) continue;
    const i = ty * M.w + tx; M.solid[i] = 0; if (M.reach) M.reach[i] = 1;
  }
}
function vehSmash(w, p) {
  const v = VEH_DIRVEC[p.vDir ?? 2], R = { x: p.x + v[0] * 16 - 15, y: p.y + v[1] * 10 - 9, w: 30, h: 16 }; let hit = 0;
  for (let i = w.objects.length - 1; i >= 0; i--) {
    const o = w.objects[i], b = o.box; if (!b) continue;
    if (b.x > R.x + R.w || b.x + b.w < R.x || b.y > R.y + R.h || b.y + b.h < R.y) continue;
    if (o.chest || o.hoard || o.mimic || o.sideCache || o.edgeTree || (typeof GIANT_TREE === 'function' && GIANT_TREE(o)) || vehUnbreakable(o)) return 'crash';   // these don't give
    hit++;
    if (o.breakable) { breakCrate(w, o); continue; }
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, tree = (o.autoSolid && b.h > 14), cols = tree ? ['#3a7a34', '#5aa048', '#6a4424'] : ['#8a8478', '#5e5a50', '#b8b0a0'];
    for (let k = 0; k < 16; k++) { const an = rand(0, Math.PI * 2), sp = rand(50, 150); w.particles.push({ x: cx, y: cy, vx: Math.cos(an) * sp + v[0] * 60, vy: Math.sin(an) * sp * 0.6 - 40, t: 0, life: rand(300, 650), col: cols[k % 3], size: rand(2, 4), drag: 0.9 }); }
    w.objects.splice(i, 1); vehClearUnder(w, b);
  }
  if (hit) { w.shake = Math.max(w.shake || 0, 4); w.hitStop = Math.max(w.hitStop || 0, 40); p.vSpd = speedOf(p); if (typeof SFX !== 'undefined' && SFX.hit) SFX.hit(); }
  return hit > 0;
}
// a BUMP (anything short of a flat-out head-on hit): the car glances off. It tries to slide round the thing, sideways toward
// whichever side is open, and slows; boxed in, it just slows right down. No stall, a tiny jolt, a puff of dust.
function vehBump(game, w, p) {
  const a = p.vVel, cx = Math.cos(a), cy = Math.sin(a), px = -cy, py = cx;
  w.particles.push({ x: p.x + cx * 18, y: p.y - 6 + cy * 8, vx: -cx * 30, vy: -20, t: 0, life: 420, col: '#b8b0a0', size: 3.2, puff: true });
  w.shake = Math.max(w.shake || 0, 1.5);
  for (const sgn of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
    if (!w.blocked(p.x + cx * 8 + px * sgn * 14, p.y + cy * 8 + py * sgn * 14, p)) { p.vVel = p.vAng = a + sgn * 0.75; p.vThrottle = Math.min(p.vThrottle, 0.55); p.vPrev = null; return; }
  }
  p.vThrottle = Math.min(p.vThrottle, 0.2); p.vPrev = null;
}
function vehCrash(game, w, p) {
  const C = VEH.crash, n = Math.hypot(p.vWant.x, p.vWant.y) || 1, dx = p.vWant.x / n, dy = p.vWant.y / n, hx = p.x + dx * 20, hy = p.y - 10 + dy * 10;
  vehCrashFx(w, hx, hy);
  for (let i = 0; i < 12; i++) w.particles.push({ x: hx + rand(-6, 6), y: hy + rand(-4, 4), vx: -dx * rand(20, 70) + rand(-30, 30), vy: rand(-60, -20), t: 0, life: rand(500, 1000), col: i % 3 ? '#7a7670' : '#4a4640', size: rand(3, 5), puff: true });
  w.shake = Math.max(w.shake || 0, C.shake); w.hitStop = Math.max(w.hitStop || 0, 90);
  const back = findOpen(w, p.x - dx * C.bounce, p.y - dy * C.bounce * 0.6); p.x = back.x; p.y = back.y; p.vx = p.vy = 0;
  p.vStun = C.stun; p.vSpd = 0; p.vPrev = null; p.vThrottle = 0;
  if (typeof SFX !== 'undefined' && SFX.hit) SFX.hit(true);
}
function drawVehicleChip(game, now) {
  const w = game.world, p = w && w.player, pr = game.profile; if (!p || !pr || game.menu) return; const G = garageOf(pr);
  if (!p.driving) return;   // (to get in, walk to the car)
  const B = VEH.chip, on = true, V = vehModel(p.driving);
  ctx.fillStyle = on ? 'rgba(40,90,130,0.9)' : 'rgba(18,14,30,0.86)'; rrect(ctx, B.x, B.y, B.w, B.h, 4); ctx.fill(); ctx.strokeStyle = on ? '#8fd8ff' : '#5a6478'; ctx.lineWidth = 0.9; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 4); ctx.stroke();
  text(on ? `9: Get out · ×${VEH.speed}` : `9: Drive ${V ? V.name : ''}`, B.x + B.w / 2, B.y + B.h / 2 + 0.5, on ? '#ffffff' : '#c8d0e0', 6.5);
}

// ---- the Farm Board's VEHICLES tab (farmboard.js): the garage on the right, the chosen one's paint shop on the left
const vehRow = i => ({ x: PU_R.x + 12, y: PU_R.y + 32 + i * 45, w: PU_R.w - 24, h: 41 });
const vehPaintBtn = s => ({ x: s < 0 ? PU_L.x + 14 : PU_L.x + PU_L.w - 32, y: PU_L.y + 168, w: 18, h: 16 });
const vehTintBtn = i => ({ x: PU_L.x + 14 + i * 22.5, y: PU_L.y + 204, w: 19, h: 14 });
function vehAct(game, m) {
  const pr = game.profile, G = garageOf(pr), V = VEHICLE_MODELS[m.cur];
  if (!G.owned[V.id]) {
    if ((pr.gold || 0) < V.price) { game.toast(`The ${V.name} costs ${fmtG(V.price)}`, '#ff8a8a'); return; }
    pr.gold -= V.price; G.owned[V.id] = true; G.cur = V.id; game.toast(`${V.name} unlocked! Press 9 in the Wilds to drive it`, '#8fd8ff'); game.save(); return;
  }
  G.cur = V.id; game.toast(`${V.name} is ready · 9 in the Wilds to drive`, '#8fd8ff'); game.save();
  const p = game.world && game.world.player; if (p && p.driving) p.driving = V.id;
}
function vehCustom(game, m, k) {
  const pr = game.profile, G = garageOf(pr), V = VEHICLE_MODELS[m.cur]; if (!V || !G.owned[V.id]) return;
  const paint = d => { G.paint[V.id] = ((G.paint[V.id] || 0) + d + V.paints.length) % V.paints.length; game.save(); };
  const tint = n => { G.tint[V.id] = n; game.save(); };
  if (k.l || hit('KeyZ')) paint(-1); if (k.r || hit('KeyX')) paint(1);
  for (const s of [-1, 1]) { const B = vehPaintBtn(s); if (clicked(B.x, B.y, B.w, B.h)) paint(s); }
  if (hit('KeyC')) tint(((G.tint[V.id] || 0) + 1) % VEH.tints);
  for (let i = 0; i < VEH.tints; i++) { const B = vehTintBtn(i); if (clicked(B.x, B.y, B.w, B.h)) tint(i); }
}
function drawVehicleTab(game, m, now) {
  const pr = game.profile, G = garageOf(pr), V = VEHICLE_MODELS[m.cur] || VEHICLE_MODELS[0], own = !!G.owned[V.id], cx = PU_L.x + PU_L.w / 2;
  // left page: the chosen one on a stretch of road, turning to show both sides, and its paint shop
  const A = { x: PU_L.x + 8, y: PU_L.y + 8, w: PU_L.w - 16, h: 120 };
  ctx.save(); rrect(ctx, A.x, A.y, A.w, A.h, 5); ctx.clip();
  const sky = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); sky.addColorStop(0, '#6ab8e0'); sky.addColorStop(0.55, '#d8eeb0'); sky.addColorStop(0.56, '#5aa048'); sky.addColorStop(1, '#3a7a34'); ctx.fillStyle = sky; ctx.fillRect(A.x, A.y, A.w, A.h);
  ctx.fillStyle = '#8a7a62'; ctx.fillRect(A.x, A.y + 82, A.w, 26); ctx.fillStyle = '#f0e6c0'; for (let x = A.x + ((-now / 20) % 24); x < A.x + A.w; x += 24) ctx.fillRect(x, A.y + 94, 12, 2);   // the road, rolling by
  ctx.globalAlpha = own ? 1 : 0.45; drawVehicleSprite(V, G.paint[V.id], G.tint[V.id], [2, 0, 6, 4][Math.floor(now / 1100) % 4], true, cx, A.y + 108, now, 2); ctx.globalAlpha = 1;   // (a slow turn through its four directions, at a whole 2x so the pixels stay crisp)
  ctx.restore(); ctx.strokeStyle = goldFrameGrad(A.y, A.h); ctx.lineWidth = 1.2; rrect(ctx, A.x + 0.6, A.y + 0.6, A.w - 1.2, A.h - 1.2, 5); ctx.stroke();
  goldTitle(V.name.toUpperCase(), cx, PU_L.y + 140, 12, now); petInk(V.desc, cx, PU_L.y + 154, '#c8d0e0', 6.5, 'center', false);
  if (own) {
    const P = V.paints[(G.paint[V.id] || 0) % V.paints.length];
    for (const s of [-1, 1]) { const B = vehPaintBtn(s); ctx.fillStyle = '#2a3142'; rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill(); text(s < 0 ? '◀' : '▶', B.x + B.w / 2, B.y + B.h / 2, '#ffd860', 8); }
    petInk(`PAINT · ${P.name}`, cx, PU_L.y + 176, '#ffd27a', 8, 'center'); petInk(`${(G.paint[V.id] || 0) + 1} / ${V.paints.length}   ← → or Z / X`, cx, PU_L.y + 190, '#9aa4b8', 6.5, 'center', false);
    for (let i = 0; i < VEH.tints; i++) { const B = vehTintBtn(i), on = (G.tint[V.id] || 0) === i; ctx.fillStyle = vehTintCss(i); rrect(ctx, B.x, B.y, B.w, B.h, 3); ctx.fill(); if (!i) text('—', B.x + B.w / 2, B.y + B.h / 2, '#ffffff', 7); ctx.strokeStyle = on ? '#ffffff' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = on ? 1.6 : 0.8; rrect(ctx, B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1, 3); ctx.stroke(); }
    petInk('TINT · click a colour or C', cx, PU_L.y + 228, '#9aa4b8', 6.5, 'center', false);
    popupButton({ x: cx - 70, y: PU_L.y + 240, w: 140, h: 20, label: G.cur === V.id ? 'READY TO DRIVE ✓' : 'DRIVE THIS ONE [Enter]', primary: G.cur !== V.id, col: '#8fd8ff' }, now);
  } else {
    petInk('Unlock it to paint it and drive it', cx, PU_L.y + 182, '#9aa4b8', 7, 'center', false);
    popupButton({ x: cx - 70, y: PU_L.y + 200, w: 140, h: 22, label: `UNLOCK · ${fmtG(V.price)}`, primary: (pr.gold || 0) >= V.price, col: '#ffd23f' }, now);
  }
  petInk('Tab: next page · Esc: close', cx, PU_L.y + PU_L.h - 12, '#9aa4b8', 7.5, 'center', false);
  // right page: the garage
  partnerHeading('THE GARAGE', PU_R.y + 16, now);
  VEHICLE_MODELS.forEach((V2, i) => {
    const R = vehRow(i), on = m.cur === i, has = !!G.owned[V2.id], cur = G.cur === V2.id;
    fbCard(R, on, cur ? '#8fd8ff' : has ? '#8fffb0' : '#3a4256');
    ctx.save(); ctx.beginPath(); ctx.rect(R.x + 4, R.y + 2, 74, R.h - 4); ctx.clip(); if (!has) ctx.globalAlpha = 0.5; drawVehicleSprite(V2, G.paint[V2.id], G.tint[V2.id], 0, on, R.x + 40, R.y + R.h - 1, now, 1); ctx.restore();
    petInk(V2.name, R.x + 84, R.y + 15, on ? '#ffffff' : '#e0e6f0', 9, 'left'); petInk(V2.desc, R.x + 84, R.y + 30, '#9aa4b8', 6.5, 'left', false);
    text(cur ? 'DRIVING' : has ? 'OWNED' : fmtG(V2.price), R.x + R.w - 10, R.y + 15, cur ? '#8fd8ff' : has ? '#8fffb0' : '#ffd23f', 8, 'right');
  });
  petInk(`×${VEH.speed} speed in the Wilds · 9 to get in and out`, PU_R.x + PU_R.w / 2, PU_R.y + 278 - 10, '#9aa4b8', 7, 'center', false);
}
// LOOK-AHEAD CAMERA (2026-11-06): at three times walking speed you met things before you could see them. While you drive,
// the view eases ahead the way the car is travelling, more the faster it goes (up to VEH_LOOK.x / .y at full throttle), and
// eases back to centre when you slow, stop or step out. Only for the camera on your own hero (co-op's shared view is untouched).
const VEH_LOOK = { x: 60, y: 36, ease: 1.8 };   // (2026-11-07: a little less look-ahead and a slower glide, to match the calmer car)
{
  const cf = cameraFor;
  cameraFor = (world, target) => {
    const p = world && world.player; if (!p || target !== p) return cf(world, target);
    const t = performance.now(), sec = Math.min(0.05, (t - (p.vLookT || t)) / 1000); p.vLookT = t;
    const L = p.vLookOff || (p.vLookOff = { x: 0, y: 0 }), th = p.driving ? (p.vThrottle || 0) : 0;
    const gx = th ? Math.cos(p.vVel || 0) * VEH_LOOK.x * th : 0, gy = th ? Math.sin(p.vVel || 0) * VEH_LOOK.y * th : 0, k = 1 - Math.exp(-VEH_LOOK.ease * sec);
    L.x += (gx - L.x) * k; L.y += (gy - L.y) * k;
    if (!p.driving && Math.abs(L.x) < 0.3 && Math.abs(L.y) < 0.3) { L.x = L.y = 0; return cf(world, target); }
    return cf(world, { x: p.x + L.x, y: p.y + L.y });
  };
}
// HEADLIGHTS (2026-11-06): after dark (daynight.js nightK) the car throws two soft warm beams ahead the way it faces, and its
// lamps glow; they fade in through dusk and out at dawn. Drawn over the night veil as gentle added light, so they show in
// photos too. Only outdoors (the night veil is too).
const VEH_LIGHT = { len: 92, spread: 0.2, gap: 7, beam: 0.22, lamp: 0.55 };
// TAIL LIGHTS (2026-11-06): two small red lamps at the back. They glow brighter while the car slows (letting go or braking),
// faintly at night the rest of the time; in daylight they only show while slowing. Easing in and out, never flashing.
const VEH_TAIL = { gap: 6, back: 14, night: 0.3, brake: 0.6, r: 4, ease: 8 };
function drawTailLights(w, cam, p, k, Z, dx, dy, px, py) {
  const T = p.vThrottle || 0, slowing = T < (p.vTailT ?? T) - 0.0005 && T > 0.02 ? 1 : 0; p.vTailT = T;
  const t = performance.now(), sec = Math.min(50, t - (p.vTailAt || t)) / 1000; p.vTailAt = t;
  p.vTailB = (p.vTailB || 0) + (slowing - (p.vTailB || 0)) * (1 - Math.exp(-VEH_TAIL.ease * sec));
  const al = VEH_TAIL.night * k + VEH_TAIL.brake * p.vTailB; if (al < 0.02 || dy > 0.4) return;   // (facing you, the back is hidden)
  const bx = (p.x - dx * VEH_TAIL.back - cam.x) * Z, by = (p.y - 6 - dy * 8 - cam.y) * Z, R = VEH_TAIL.r * Z / 1.5;
  for (const s of [-1, 1]) {
    const ox = bx + px * s * VEH_TAIL.gap * Z / 1.5, oy = by + py * s * VEH_TAIL.gap * Z / 1.5, rg = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
    rg.addColorStop(0, `rgba(255,90,80,${Math.min(0.85, al)})`); rg.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.fill();
  }
}
// every car on screen gets its lights: yours, and a friend's in co-op (their throttle isn't sent, so their tail lights only
// glow at night, without the brake glow)
function drawHeadlights(w, cam, now) {
  if (!w || w.interior || w.cave || !window.GAME || !GAME.profile) return;
  const k = nightK(GAME.profile);
  for (const a of w.actors || []) if (a && a.kind === 'player' && a.driving && !a.dead && !a.away) drawCarLights(w, cam, a, k);
  if (w.player && w.player.driving && !(w.actors || []).includes(w.player)) drawCarLights(w, cam, w.player, k);
}
function drawCarLights(w, cam, p, k) {
  const Z = w.zoom || ZOOM, L = VEH_LIGHT, a = p.vAng ?? Math.atan2(VEH_DIRVEC[p.vDir ?? 2][1], VEH_DIRVEC[p.vDir ?? 2][0]);
  let dx = Math.cos(a), dy = Math.sin(a) * 0.62; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;   // (the ground is seen at a slant)
  const px = -dy, py = dx, fx = (p.x + dx * 15 - cam.x) * Z, fy = (p.y - 7 + dy * 9 - cam.y) * Z;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  drawTailLights(w, cam, p, k, Z, dx, dy, px, py);
  if (k <= 0.05) { ctx.restore(); return; }
  for (const s of [-1, 1]) {
    const ox = fx + px * s * L.gap * Z / 1.5, oy = fy + py * s * L.gap * Z / 1.5, len = L.len * Z / 1.5, wid = len * L.spread;
    const ex = ox + dx * len, ey = oy + dy * len, g = ctx.createLinearGradient(ox, oy, ex, ey);
    g.addColorStop(0, `rgba(255,236,190,${L.beam * k})`); g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex + px * wid, ey + py * wid); ctx.lineTo(ex - px * wid, ey - py * wid); ctx.closePath(); ctx.fill();
    const rg = ctx.createRadialGradient(ox, oy, 0, ox, oy, 5); rg.addColorStop(0, `rgba(255,248,220,${L.lamp * k})`); rg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
{
  const dn = drawDayNight;
  drawDayNight = (w, cam, now) => { const r = dn(w, cam, now); try { drawHeadlights(w, cam, now); } catch (e) {} return r; };
}
// (the engine hum and the get-in / get-out chimes live in vehsound.js, loaded after main.js)
// TYRE TRACKS (2026-11-06): while you drive, the back wheels leave faint marks on the ground that fade over a few seconds.
// Recorded after each step (a pair every 9 px of travel); drawn with the footstep dust (world.js drawDust), on the ground under
// trees and everyone. The newest VEH_TRACK.max are kept per world.
const VEH_TRACK = { step: 9, life: 5000, max: 260, alpha: 0.28, wheel: 6 };
// THE GROUND (2026-11-07): tracks and dust take the colour of where you drive. Snow in the Frozen Abyss (zone 3) keeps deeper,
// blue-grey ruts a little longer and throws up white powder; the Sunscorch Desert's sand (zone 4) leaves tan tracks and gold
// dust. Everywhere else: brown tracks and pale dust. Outdoors only (towns use the default).
const VEH_GROUND = {
  base:   { track: '58,46,32',   alpha: 0.28, life: 5000, dust: '#d8c8a8', dustRgb: '220,210,190' },
  3:      { track: '96,116,150', alpha: 0.36, life: 8000, dust: '#f4f8ff', dustRgb: '244,248,255' },
  4:      { track: '150,108,58', alpha: 0.32, life: 6000, dust: '#ecd09a', dustRgb: '236,208,154' },
};
function vehGround(w, x) {
  if (!w || !w.overworld || w.interior || (typeof inTown === 'function' && inTown(x))) return VEH_GROUND.base;
  const R = typeof regionAt === 'function' ? regionAt(x) : null;
  return (R && VEH_GROUND[R.zone]) || VEH_GROUND.base;
}
{
  const va = vehicleAfter;
  vehicleAfter = (game, w, dt) => {
    const r = va(game, w, dt), p = w && w.player;
    if (p && p.driving && (p.vThrottle || 0) > 0.15 && !w.interior) {
      const L = p.vTrackAt;
      if (!L || Math.hypot(p.x - L.x, p.y - L.y) >= VEH_TRACK.step) {
        p.vTrackAt = { x: p.x, y: p.y };
        const a = p.vVel || 0, cx = Math.cos(a), cy = Math.sin(a) * 0.62, n = Math.hypot(cx, cy) || 1, bx = p.x - cx / n * 12, by = p.y + 1 - cy / n * 7, t = performance.now();
        const T = w.vTracks || (w.vTracks = []);
        for (const s of [-1, 1]) { const mx = bx - cy / n * s * VEH_TRACK.wheel, my = by + cx / n * s * VEH_TRACK.wheel * 0.62; if (typeof inRiverAt === 'function' && inRiverAt(mx, my)) continue; T.push({ x: mx, y: my, a: Math.atan2(cy, cx), t, g: vehGround(w, mx) }); }   // (none on water: bridges)
        if (T.length > VEH_TRACK.max) T.splice(0, T.length - VEH_TRACK.max);
      }
    } else if (p) p.vTrackAt = null;
    return r;
  };
  const dd = drawDust;
  drawDust = (world, now) => {
    const T = world && world.vTracks;
    if (T && T.length) {
      const t = performance.now(); let drop = 0;
      for (const m of T) {
        const g = m.g || VEH_GROUND.base, k = 1 - (t - m.t) / g.life; if (k <= 0) { if (t - m.t > VEH_GROUND[3].life) drop++; continue; }
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a); ctx.fillStyle = `rgba(${g.track},${g.alpha * k})`; ctx.fillRect(-2.5, -0.9, 5, 1.8); ctx.restore();
      }
      if (drop) T.splice(0, drop);   // (marks are in age order; only those older than the longest life are dropped, so snow ruts keep theirs)
    }
    return dd(world, now);
  };
}
// EXHAUST PUFFS (2026-11-06): small, soft, pale puffs from the back of the car that drift up and fade: a little run of them
// as you pull away (the throttle climbing from low), and now and then one while the engine idles. Not when the car faces
// you (its back is hidden). VEH_PUFF.idle ms between idle puffs, .go between pull-away puffs.
const VEH_PUFF = { idle: 1100, go: 120, upTo: 0.6, life: 700, size: 2.4, col: '#e8e4dc' };
{
  const va = vehicleAfter;
  vehicleAfter = (game, w, dt) => {
    const r = va(game, w, dt), p = w && w.player;
    if (p && p.driving && !w.interior && !(p.vStun > 0)) {
      const T = p.vThrottle || 0, rising = T > (p.vPuffT ?? T) + 0.0005, t = performance.now(); p.vPuffT = T;
      const gap = rising && T < VEH_PUFF.upTo ? VEH_PUFF.go : T < 0.03 ? VEH_PUFF.idle : 0;
      if (gap && t - (p.vPuffAt || 0) >= gap) {
        p.vPuffAt = t;
        const a = p.vAng ?? 0, cx = Math.cos(a), cy = Math.sin(a) * 0.62, n = Math.hypot(cx, cy) || 1;
        if (cy / n <= 0.4) w.particles.push({ x: p.x - cx / n * 17 + rand(-1.5, 1.5), y: p.y - 4 - cy / n * 8, vx: -cx / n * 10 + rand(-4, 4), vy: rand(-16, -9), t: 0, life: VEH_PUFF.life * rand(0.8, 1.2), col: VEH_PUFF.col, size: VEH_PUFF.size * rand(0.85, 1.2), puff: true });
      }
    } else if (p) p.vPuffT = null;
    return r;
  };
}
