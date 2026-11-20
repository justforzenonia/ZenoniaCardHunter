'use strict';
// VEHICLE SOUNDS (vehicles.js): a soft engine hum while you drive, and two music-box notes when you get in or out.
// Ticked from drawScene (main.js), which runs every frame, menus included, so the hum fades under the pause menu too.
// ENGINE HUM (2026-11-06): a soft, low hum while you drive, a little higher and fuller as the throttle opens, through a warm
// low-pass so it never buzzes; it fades out when you stop the engine (get out) or leave the world. Through the game's own
// master volume (sfx.js SFX.audio), so VOLUME and the 0 mute apply. Very quiet on purpose: a cozy car, not a race.
const VEH_HUM = { vol: 0.016, lo: 52, hi: 88, cut: 420, node: null };
function vehHumTick(game, w) {
  const A = typeof SFX !== 'undefined' && SFX.audio && SFX.audio(), p = w && w.player, on = !!(A && p && p.driving && game.scene === 'world' && !game.menu);
  let H = VEH_HUM.node;
  if (on && !H) {
    const ac = A.ac, o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    // (start at rest pitch, no swoop down from 440 Hz; and start silent, the gain eases up below)
    o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = VEH_HUM.lo; o2.frequency.value = VEH_HUM.lo * 1.5;
    lp.type = 'lowpass'; lp.frequency.value = VEH_HUM.cut; lp.Q.value = 0.3; g.gain.value = 0.0001;
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(A.master); o.start(); o2.start();
    H = VEH_HUM.node = { ac, o, o2, g, lp };
  }
  if (!H) return;
  const t = H.ac.currentTime, th = on ? (p.vThrottle || 0) : 0, f = VEH_HUM.lo + (VEH_HUM.hi - VEH_HUM.lo) * th;
  H.o.frequency.setTargetAtTime(f, t, 0.15); H.o2.frequency.setTargetAtTime(f * 1.5, t, 0.15);
  H.g.gain.setTargetAtTime(on ? VEH_HUM.vol * (0.45 + 0.55 * th) : 0.0001, t, on ? 0.2 : 0.25);
  if (!on) { if (!H.off) H.off = performance.now(); if (performance.now() - H.off > 1500) { try { H.o.stop(); H.o2.stop(); H.g.disconnect(); } catch (e) {} VEH_HUM.node = null; } }
  else H.off = 0;
}
{
  const ds = drawScene;
  drawScene = now => { const r = ds(now); try { const G = window.GAME; if (G) vehHumTick(G, G.world); } catch (e) {} return r; };
}
// getting in: two notes up; getting out: two notes settling down (sfx.js box voice)
{
  const gi = vehGetIn;
  vehGetIn = (game, w, p, at) => { const was = p.driving, r = gi(game, w, p, at); if (!was && p.driving && typeof SFX !== 'undefined' && SFX.carIn) SFX.carIn(); return r; };
  const tg = vehToggle;
  vehToggle = (game, w, p) => { const was = p.driving, r = tg(game, w, p); if (was && !p.driving && typeof SFX !== 'undefined' && SFX.carOut) SFX.carOut(); return r; };
}
// YOUR CAR ON THE RADAR (2026-11-06): once you step out, the parked car shows on the radar (radar.js) as a little sky-blue car;
// further away than the radar reaches, a small sky-blue notch on the rim points the way to it. Hidden while you drive,
// and whenever the radar itself is hidden (the same checks as drawRadar).
const VEH_RADAR = { col: '#8fd8ff', edge: 'rgba(143,216,255,0.85)' };
function drawRadarCar(world) {
  const G = window.GAME, p = world && world.player; if (!G || G.world !== world || !p || p.driving || !world.overworld || world.home || G.menu || G.scene !== 'world') return;
  if (typeof SET !== 'undefined' && SET.radar === false) return;
  const at = vehParked(G, world); if (!at) return;
  const { x: cx, y: cy } = RADAR.at(), R = RADAR.r, k = R / RADAR.range, dx = (at.x - p.x) * k, dy = (at.y - p.y) * k, d = Math.hypot(dx, dy);
  if (d < 2) return;   // (you are standing at it)
  resetView(); ctx.save();
  if (d <= R - 4) {   // in range: a little car, body and roof
    const x = cx + dx, y = cy + dy;
    ctx.fillStyle = '#0a1420'; ctx.fillRect(x - 3.4, y - 2.2, 6.8, 4.4);
    ctx.fillStyle = VEH_RADAR.col; ctx.fillRect(x - 2.6, y - 0.6, 5.2, 2.2); ctx.fillRect(x - 1.4, y - 1.6, 2.8, 1.2);
  } else {   // out of range: a notch on the rim, pointing out toward the car
    const a = Math.atan2(dy, dx), x = cx + Math.cos(a) * (R - 1), y = cy + Math.sin(a) * (R - 1);
    ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = VEH_RADAR.edge; ctx.strokeStyle = '#0a1420'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
{
  const dr = drawRadar;
  drawRadar = (world, now) => { const r = dr(world, now); try { drawRadarCar(world); } catch (e) {} return r; };
}
// THE HORN (2026-11-06): you can't fight at the wheel, so the attack key (J or F, the gamepad attack button, the touch attack
// button) gives a soft music-box toot-toot instead (sfx.js horn), with two little pale-gold puffs over the bonnet. Just for fun.
// In towns main.js clears attacks before vehicleInput, so the attack keys are read straight from the keyboard there too.
// In online co-op a friend's horn (their attack press while driving, run on the host by net.js netGuestCar) toots on the
// host, and netsfx.js carries every horn to the friends, so everyone hears everyone's.
function vehHonk(w, a) {
  if (performance.now() - (a.vHornAt || 0) <= 450) return;
  a.vHornAt = performance.now();
  if (typeof SFX !== 'undefined' && SFX.horn) SFX.horn();
  const an = a.vAng ?? Math.atan2(VEH_DIRVEC[a.vDir ?? 1][1], VEH_DIRVEC[a.vDir ?? 1][0]), cx = Math.cos(an), cy = Math.sin(an) * 0.62;
  for (const s of [-1, 1]) w.particles.push({ x: a.x + cx * 12 + s * 4, y: a.y - 14 + cy * 6, vx: s * 10, vy: -22, t: 0, life: 520, col: '#fff0b0', size: 1.8, puff: true });
}
{
  const vi = vehicleInput;
  vehicleInput = (game, w, inp) => {
    const p = w && w.player, map = typeof coopOn === 'function' && coopOn(game) ? coop1Map() : SOLO;
    const honk = !!(p && p.driving && !game.menu && ((inp && inp.atk) || hit(...map.atk)));
    const r = vi(game, w, inp);
    if (honk && p.driving) vehHonk(w, p);
    return r;
  };
}
// (a friend's attack press is read from their raw key edges before net.js uses them up and, in a safe town, clears attacks)
{
  const ngi = netGuestInputs;
  netGuestInputs = (game, w, safe, dt) => {
    const pressed = [];
    try { for (const G of netGuestList(game)) if (G.edges && G.edges.atk) pressed.push(G.gid); } catch (e) {}
    const r = ngi(game, w, safe, dt);
    for (const gid of pressed) { const a = netGuestActor(w, gid); if (a && a.driving && !a.dead) vehHonk(w, a); }
    return r;
  };
}
// A FRIEND'S CAR HANDLES LIKE YOURS (2026-11-06): on the host, a co-op friend's car used to snap between eight headings at full
// speed. Now it runs the same handling (vehicles.js vehHandle: throttle, smooth turns, coasting, braking, a little drift) from
// their stick or keys, and speedOf scales it by their throttle like yours. Each trip starts at rest.
{
  const ng = netGuestCar;
  netGuestCar = (game, w, a, prof, inp, dt) => {
    const was = a.driving, r = ng(game, w, a, prof, inp, dt);
    if (!a.driving) { a.vThrottle = null; return r; }
    if (!was) { a.vAng = null; a.vThrottle = 0; }
    return vehHandle(a, r, null);
  };
}
// A FRIEND'S CAR GLANCES OFF TOO (2026-11-06): when a co-op friend's car, pressing on at speed, suddenly stops short against a
// tree or rock, it glances off sideways and slows (vehicles.js vehBump), like yours. Never the big CRASH stall for a friend,
// and their bumps don't jolt your screen.
{
  const va = vehicleAfter;
  vehicleAfter = (game, w, dt) => {
    const r = va(game, w, dt);
    if (!w || !w.actors || !(game.net && game.net.role === 'host')) return r;
    for (const a of w.actors) {
      if (!a.netGid || a.remove) continue;
      if (!a.driving || a.dead) { a.vPrev = null; continue; }
      const prev = a.vPrev; a.vPrev = { x: a.x, y: a.y };
      if (!prev || dt <= 0) continue;
      const now = Math.hypot(a.x - prev.x, a.y - prev.y) / dt * 1000, expect = speedOf(a), was = a.vSpd || 0;
      a.vSpd = was * 0.6 + now * 0.4;
      if (w.hitStop > 0) { a.vSpd = was; continue; }
      if (a.vWant && (a.vThrottle || 0) > 0.35 && was > expect * 0.6 && now < expect * VEH.crash.dead) { const sh = w.shake; vehBump(game, w, a); w.shake = sh; }
    }
    return r;
  };
}
// FIRST DRIVE CARD (2026-11-06): the first time a hero gets in after the new handling, a calm card (unlocks.js drawGoalCard)
// sums up how the car drives. Once per hero (pr.driveHint); skipped if another card is already up (then it waits for the next
// time you get in).
const DRIVE_CARD = { v: 1, head: 'YOUR CAR', title: 'Take it easy', show: 11000, lines: [
  'Hold a way to speed up · let go to coast to a stop',
  'Steer the opposite way to brake · sharp turns drift',
  'Attack key: a soft horn · 9: step out, it stays parked',
  'Far from it? 9 calls it to you · the radar shows it',
] };
{
  const gi = vehGetIn;
  vehGetIn = (game, w, p, at) => {
    const was = p.driving, r = gi(game, w, p, at), pr = game.profile;
    if (!was && p.driving && pr && (pr.driveHint || 0) < DRIVE_CARD.v && !game.goalCard && !(game.net && game.net.role === 'guest')) {
      pr.driveHint = DRIVE_CARD.v; game.goalCard = { at: performance.now(), head: DRIVE_CARD.head, title: DRIVE_CARD.title, show: DRIVE_CARD.show, lines: DRIVE_CARD.lines.slice() };
      if (typeof SFX !== 'undefined' && SFX.notice) setTimeout(() => SFX.notice(), 450);   // (after the get-in notes)
    }
    return r;
  };
}
// A SOFT RUMBLE (2026-11-06): with a gamepad in use (gamepad.js PAD.seen), your own car's bumps give a short, light buzz and a
// crash a slightly fuller one. Gentle on purpose; pads without rumble (or browsers without it) simply skip it.
const VEH_RUMBLE = { bump: [0.22, 0, 90], crash: [0.35, 0.25, 220] };
function vehRumble([weak, strong, ms]) {
  if (typeof PAD === 'undefined' || !PAD.seen || !navigator.getGamepads) return;
  try { for (const g of navigator.getGamepads()) if (g && g.connected && g.vibrationActuator && g.vibrationActuator.playEffect) g.vibrationActuator.playEffect('dual-rumble', { duration: ms, weakMagnitude: weak, strongMagnitude: strong }).catch(() => {}); } catch (e) {}
}
{
  const vb = vehBump, vc = vehCrash, mine = (w, p) => !!(w && p && p === w.player && window.GAME && GAME.world === w);
  vehBump = (game, w, p) => { const r = vb(game, w, p); if (mine(w, p)) vehRumble(VEH_RUMBLE.bump); return r; };
  vehCrash = (game, w, p) => { const r = vc(game, w, p); if (mine(w, p)) vehRumble(VEH_RUMBLE.crash); return r; };
}
