'use strict';
// TOUCH: the game on a phone or tablet. It wakes the first time the screen is touched (or with ?touch=1 in the address) and lays
// controls over the game, which press the very keys a keyboard would (core.js keys/pressed), so every system just works:
//   in the world    a joystick on the left to move; on the right ATTACK, DASH, BLOCK (held), LAYER, the three spells and TALK
//                   (Enter). Block and Layer hide until they are unlocked (unlocks.js). The buttons follow rebound keys (settings.js).
//   on the left     BAG (Tab), MAP (M), MEALS (B) and MORE: partner, pets, log, titles, workshop, sets, tower, season, the hub
//   top right       MENU (Esc) and full screen
//   in menus        the joystick moves the choice, OK (Enter) and BACK (Esc); a tap on the screen clicks, as the mouse does
// Held sideways the game fills the screen; held upright a card asks you to turn the device. On a tablet the controls grow with
// the screen. VIBRATION (settings.js): a light buzz when your hero is hit, a firmer one for a parry, a perfect dodge or a guard break.
const TOUCH = { on: false, stick: { r: 58, dead: 0.35 }, dirs: { u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD' } };
const tDown = code => { if (!code) return; if (!keys.has(code)) pressed.add(code); keys.add(code); };
const tUp = code => { if (code) keys.delete(code); };
// the keys for an action, in the world or in the arena (main.js SOLO / PV1)
const tMap = () => (window.GAME && GAME.scene === 'arena' ? PV1 : SOLO);
const tKey = {
  atk: () => tMap().atk[0], dash: () => tMap().dash[0], block: () => (tMap().block || [])[0], layer: () => tMap().layer[0],
  s0: () => tMap().spell[0][0], s1: () => tMap().spell[1][0], s2: () => tMap().spell[2][0], fuse: () => (tMap().fsel || [])[0],
  talk: () => 'Enter', ok: () => 'Enter', back: () => 'Escape', menu: () => 'Escape', bag: () => 'Tab', map: () => 'KeyM', meal: () => 'KeyB',
  partner: () => 'KeyG', pets: () => 'KeyN', log: () => null, titles: () => 'KeyY', workshop: () => 'KeyZ', sets: () => 'KeyO', tower: () => 'KeyU', season: () => 'KeyP', book: () => 'Minus', hub: () => 'KeyH',
};
// taps on the game itself click, as the mouse does (core.js listens for mouse events only)
// ONE TAP, ONE CLICK (2026-11-08): after a touch a phone also sends a pretend mouse click (~300 ms later), which core.js counted as a
// second click, so toggles on the phone flipped open and straight shut (the user saw ALL STATS / passives "go in and out").
// Mouse events that follow a touch within 800 ms are stopped before the game sees them.
let tLastTouch = -1e9;
addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') tLastTouch = performance.now(); }, true);
for (const ev of ['mousedown', 'mouseup', 'click']) addEventListener(ev, e => { if (e.target === cv && performance.now() - tLastTouch < 800) e.stopPropagation(); }, true);   // (only on the game canvas: real buttons and the save-file picker still get their clicks)
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * VW / r.width; mouse.y = (e.clientY - r.top) * VH / r.height;
  if (tapHintAt(mouse.x, mouse.y)) return;   // (a tap on a key named in a hint line presses that key instead of clicking)
  mouse.click = true; mouse.down = true;
});
// TAPPABLE KEY HINTS (2026-11-20, the user: "all keys work in mobile version"). Menus name their keys in hint lines ('D: details · O: sort
// · L: lock', the keycaps at the foot of the world). A phone has no keyboard, so on a touch screen every key named in a hint is a
// button: it gets a faint gold outline, and a tap on it presses that key. 'Q/E/R' is three buttons side by side; 'Shift+N' holds Shift.
const TAPK = { now: [], last: [] };
(function swap() { TAPK.last = TAPK.now; TAPK.now = []; requestAnimationFrame(swap); })();
function tKeyCode(k) {
  k = String(k).trim().replace(/×\d+$/, '').trim();
  const named = { Enter: 'Enter', Tab: 'Tab', Esc: 'Escape', Escape: 'Escape', Space: 'Space', Shift: 'ShiftLeft', Backspace: 'Backspace', Del: 'Delete', Delete: 'Delete',
    '[': 'BracketLeft', ']': 'BracketRight', '-': 'Minus', '=': 'Equal', ',': 'Comma', '.': 'Period', '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown', PgUp: 'PageUp', PgDn: 'PageDown', Home: 'Home', End: 'End' };
  if (named[k]) return [named[k]];
  if (/^[A-Za-z]$/.test(k)) return ['Key' + k.toUpperCase()];
  if (/^\d$/.test(k)) return ['Digit' + k];
  const m = /^Shift\+(.+)$/.exec(k); if (m) { const c = tKeyCode(m[1]); return c && ['ShiftLeft'].concat(c); }
  return null;
}
// a key label drawn at (x, y, w, h) in the current transform: split into its keys ('Q/E/R', 'Tab / [ ]') and remember each one's box
function tapHint(label, x, y, w, h, size) {
  if (!TOUCH.on) return;
  const t = ctx.getTransform(), sx = VW / cv.width, sy = VH / cv.height, parts = String(label).split(/\s*\/\s*|\s+/).filter(Boolean);
  const fs = size || 6.3, full = textW(label, fs) || 1;
  let from = 0;
  for (const p of parts) {
    const codes = tKeyCode(p); const i = label.indexOf(p, from); from = i + p.length; if (!codes || i < 0) continue;
    const px = parts.length > 1 ? x + (w - full) / 2 + textW(label.slice(0, i), fs) : x, pw = parts.length > 1 ? textW(p, fs) : w;
    ctx.save(); ctx.strokeStyle = 'rgba(255,216,96,0.6)'; ctx.lineWidth = 0.7; rrect(ctx, px - 1.5, y - 0.5, pw + 3, h + 1, 2.5); ctx.stroke(); ctx.restore();
    const ax = (t.a * (px - 1.5) + t.c * y + t.e) * sx, ay = (t.b * (px - 1.5) + t.d * y + t.f) * sy, bw = t.a * (pw + 3) * sx, bh = t.d * h * sy;
    TAPK.now.push({ x: ax - 2, y: ay + bh / 2 - Math.max(16, bh + 4) / 2, w: bw + 4, h: Math.max(16, bh + 4), codes });
  }
}
function tapHintAt(x, y) {
  let best = null, bd = 1e9;
  for (const b of TAPK.now.length ? TAPK.now : TAPK.last) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) { const d = Math.abs(x - (b.x + b.w / 2)); if (d < bd) { bd = d; best = b; } }
  if (!best) return false;
  for (const c of best.codes) tDown(c);
  setTimeout(() => { for (const c of best.codes) tUp(c); }, 70);
  return true;
}
// the side pills down the left of the world (Partner, Log, Workshop, Sets, Tower, Tier) lay under the joystick on a phone, where they
// could not be read or tapped; the phone's MORE button opens every one of them, so on a touch screen they are not drawn (2026-11-20)
{ const hp0 = hudPill;
  hudPill = function (P, ...r) { if (TOUCH.on && P && P.x < 120 && window.GAME && GAME.scene === 'world' && !GAME.menu) return; return hp0.call(this, P, ...r); };
}
// plain hint lines in menus ('D: details · Q/E/R: set · ...'): each 'KEY: what it does' part names its key(s) before the colon
{ const t1 = text;
  text = function (str, x, y, col, size = 10, align = 'center', bold) {
    const r = t1.apply(this, arguments);
    if (TOUCH.on && typeof str === 'string' && size <= 9 && str.indexOf(': ') > 0 && window.GAME && (GAME.menu || GAME.scene !== 'world')) {
      const W = textW(str, size, bold), x0 = align === 'left' ? x : align === 'right' ? x - W : x - W / 2;
      let at = 0;
      for (const seg of str.split('·')) {
        const s = seg.trim(), i = str.indexOf(s, at); at = i + s.length; if (!s || i < 0) continue;
        const c = s.indexOf(': '); if (c < 1 || c > 16) continue;
        const label = s.slice(0, c);
        if (!label.split(/\s*\/\s*|\s+/).some(tKeyCode)) continue;
        // each key inside the label, at its own place along the line
        let from = 0;
        for (const p of label.split(/\s*\/\s*|\s+/).filter(Boolean)) {
          const j = label.indexOf(p, from); from = j + p.length; if (j < 0 || !tKeyCode(p)) continue;
          tapHint(p, x0 + textW(str.slice(0, i + j), size, bold), y - size / 2 - 1, textW(p, size, bold), size + 2, size);
        }
      }
    }
    return r;
  };
}
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') return; const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * VW / r.width; mouse.y = (e.clientY - r.top) * VH / r.height; });
addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') mouse.down = false; });
addEventListener('pointercancel', e => { if (e.pointerType !== 'mouse') mouse.down = false; });
function touchOn() {
  if (TOUCH.on) return; TOUCH.on = true;
  // the ITEM BELT (hud.js) sat bottom right, under ATTACK and DASH, where it could not be seen or tapped (2026-11-20): on a touch screen it
  // moves to the clear space on the left below the HP pills, with bigger sockets; a tap on a socket uses that item.
  // At 62,98 it lay on top of the round radar (radar.js, centre 46,148, r 32), the user: "item menu placement on mobile is ontop of
  // mini map" (2026-11-20). It now sits just right of the radar, level with it. On a 16:9 phone the BAG / MAP / MEALS / MORE column
  // lies over the game's left edge and hid the radar, so both move right of that column, measured from the page (tick, below).
  if (typeof BELT !== 'undefined') Object.assign(BELT, { x: 84, y: 122, s: 27, gap: 4 });
  TOUCH.colR = 0;   // (the left button column's right edge, in game x; 0 when it is off the game, beside it)
  const radarX = () => Math.max(46, TOUCH.colR + 32 + 8);
  const css = document.createElement('style');
  css.textContent = `
    html, body, canvas { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    #tc { position: fixed; inset: 0; pointer-events: none; z-index: 5; font: 700 12px "Fredoka", "Trebuchet MS", system-ui, sans-serif; color: #fff4d8; }
    #tc .b { position: absolute; pointer-events: auto; display: flex; align-items: center; justify-content: center; text-align: center; border-radius: 50%;
      background: rgba(34,22,14,0.55); border: 2px solid rgba(255,216,96,0.65); box-shadow: 0 2px 8px rgba(0,0,0,0.45); line-height: 1.05; }
    #tc .b.on { background: rgba(255,216,96,0.45); border-color: #fff; }
    #tc .b.sq { border-radius: 10px; }
    #tc .stick { position: absolute; left: max(14px, env(safe-area-inset-left)); bottom: 14px; width: 132px; height: 132px; border-radius: 50%; pointer-events: auto;
      background: rgba(34,22,14,0.35); border: 2px solid rgba(255,216,96,0.4); }
    #tc .knob { position: absolute; left: 41px; top: 41px; width: 50px; height: 50px; border-radius: 50%; background: rgba(255,216,96,0.55); border: 2px solid #fff4d8; }
    #tc .hide { display: none; }
    #tc-turn { position: fixed; inset: 0; z-index: 9; display: none; align-items: center; justify-content: center; background: #0c0f16; color: #ffd860;
      font: 700 18px "Fredoka", "Trebuchet MS", system-ui, sans-serif; text-align: center; padding: 24px; }
    @media (orientation: portrait) { #tc-turn { display: flex; } }`;
  document.head.appendChild(css);
  const tc = document.createElement('div'); tc.id = 'tc';
  const fit = () => { const z = Math.max(1, Math.min(1.6, Math.min(innerWidth, innerHeight) / 390)) * ((typeof SET !== 'undefined' && SET.tsize) || 1);   // (Settings TOUCH BUTTONS: small, normal or large)
    tc.style.zoom = String(z); tc.style.setProperty('--ct', (cv.getBoundingClientRect().top / z) + 'px');
    // ☰ and ⛶ sit in the gap between the hero panel and the clock (game x ~190-250): at the top right they covered the
    // story and quest trackers (2026-11-08). Placed from the canvas itself, so any phone shape lines up.
    const r = cv.getBoundingClientRect(), k = r.width / VW;
    tc.style.setProperty('--tbx', ((r.left + 184 * k) / z) + 'px'); tc.style.setProperty('--tby', ((r.top + 4 * k) / z) + 'px'); };   // (--ct: where the game starts, below any letterbox band, so the left column clears the HUD)   // (a phone is about 390 px tall held sideways; a tablet gets bigger buttons)
  fit(); addEventListener('resize', fit); TOUCH.refit = fit;   // (pointer capture can fail for an odd pointer: a press must never depend on it)
  document.body.appendChild(tc);
  const turn = document.createElement('div'); turn.id = 'tc-turn'; turn.textContent = '↻ Turn your device sideways to play'; document.body.appendChild(turn);
  // a button: held keys stay down while the finger is on it
  const btn = (id, label, css, opts = {}) => {
    const b = document.createElement('div'); b.className = 'b' + (opts.sq ? ' sq' : ''); b.innerHTML = label; b.dataset.id = id; Object.assign(b.style, css); tc.appendChild(b);
    let code = null;
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} code = (tKey[id] || (() => null))(); tDown(code); b.classList.add('on'); if (opts.tap) { setTimeout(() => tUp(code), 60); } });
    const end = () => { if (code) tUp(code); code = null; b.classList.remove('on'); };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('lostpointercapture', end);
    return b;
  };
  const R = (v, b, w) => ({ right: `max(${v}px, env(safe-area-inset-right))`, bottom: b + 'px', width: w + 'px', height: w + 'px' });
  const L = (top, w = 62) => ({ left: 'max(8px, env(safe-area-inset-left))', top: `calc(var(--ct, 0px) + ${top}px)`, width: w + 'px', height: '30px' });   // (a column down the left edge, clear of the HUD panels)
  const ui = {
    atk: btn('atk', 'ATTACK', R(22, 24, 84)),
    dash: btn('dash', 'DASH', R(118, 18, 58)),
    block: btn('block', 'BLOCK', R(22, 120, 58)),
    layer: btn('layer', 'LAYER', R(118, 92, 54)),
    s0: btn('s0', 'Q', R(186, 22, 46)), s1: btn('s1', 'E', R(184, 76, 46)), s2: btn('s2', 'R', R(176, 130, 46)),
    fuse: btn('fuse', 'FUSE', Object.assign(R(240, 48, 46), { fontSize: '10px' }), { tap: true }),   // FUSION (C), 2026-11-08: the phone had no way to press it
    talk: btn('talk', 'TALK', R(90, 158, 50), { tap: true }),
    ok: btn('ok', 'OK', R(22, 40, 70), { tap: true }), back: btn('back', 'BACK', R(104, 24, 58), { tap: true }),
    menu: btn('menu', '☰', { top: 'var(--tby, 8px)', left: 'var(--tbx, 200px)', width: '36px', height: '30px' }, { sq: true, tap: true }),
    bag: btn('bag', 'BAG', L(96), { sq: true, tap: true }), map: btn('map', 'MAP', L(130), { sq: true, tap: true }),
    meal: btn('meal', 'MEALS', L(164), { sq: true, tap: true }), more: null,
  };
  // MORE: the screens that have a pill or a key of their own
  const more = document.createElement('div'); Object.assign(more.style, { position: 'absolute', left: 'calc(max(8px, env(safe-area-inset-left)) + 70px)', top: 'calc(var(--ct, 0px) + 96px)', display: 'none', gap: '6px', flexWrap: 'wrap', width: '220px', pointerEvents: 'auto' }); tc.appendChild(more);
  ui.more = btn('moreBtn', 'MORE', L(198), { sq: true });
  ui.more.addEventListener('pointerdown', () => { more.style.display = more.style.display === 'none' ? 'flex' : 'none'; });
  const moreBtns = {};   // (a locked system's button hides, as BLOCK and LAYER do: unlocks.js)
  for (const [id, label] of [['partner', 'PARTNER'], ['pets', 'PETS'], ['log', 'LOG'], ['titles', 'TITLES'], ['workshop', 'WORKSHOP'], ['sets', 'SETS'], ['tower', 'TOWER'], ['season', 'SEASON'], ['book', 'BOOK'], ['hub', 'HUB']]) {
    const b = btn(id, label, { position: 'relative', width: '68px', height: '30px', fontSize: '10px' }, { sq: true, tap: true }); more.appendChild(b);
    b.addEventListener('pointerup', () => { more.style.display = 'none'; });
    if (id === 'log') b.addEventListener('pointerdown', () => { const G = window.GAME; if (G && !G.menu && G.scene === 'world' && G.world && (typeof unlocked !== 'function' || unlocked(G.profile, 'log'))) G.openMenu(logMenu()); });   // (opens the log at once: a quick X press could be missed)
    moreBtns[id] = b;
  }
  const full = document.createElement('div'); full.className = 'b sq'; full.innerHTML = '⛶'; Object.assign(full.style, { top: 'var(--tby, 8px)', left: 'calc(var(--tbx, 200px) + 40px)', width: '40px', height: '34px' }); tc.appendChild(full);
  full.addEventListener('pointerdown', e => { e.preventDefault(); const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (d.requestFullscreen) d.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); });
  // the joystick: holds W/A/S/D (which also move the choice in menus)
  const stick = document.createElement('div'); stick.className = 'stick'; const knob = document.createElement('div'); knob.className = 'knob'; stick.appendChild(knob); tc.appendChild(stick);
  let sid = null; const held = new Set();
  const setDirs = (dx, dy) => {
    const want = new Set(), S = TOUCH.stick, n = Math.hypot(dx, dy) / S.r;
    TOUCH.vec = n > S.dead ? { x: dx / S.r, y: dy / S.r } : null;   // (the stick's real tilt: vehicles.js steers and sets the throttle by it)
    if (n > S.dead) { const ax = dx / Math.max(1, Math.hypot(dx, dy)), ay = dy / Math.max(1, Math.hypot(dx, dy)); if (ax > 0.38) want.add(TOUCH.dirs.r); if (ax < -0.38) want.add(TOUCH.dirs.l); if (ay > 0.38) want.add(TOUCH.dirs.d); if (ay < -0.38) want.add(TOUCH.dirs.u); }
    for (const k of held) if (!want.has(k)) { tUp(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { tDown(k); held.add(k); }
    const k = Math.min(1, n), a = Math.atan2(dy, dx); knob.style.transform = `translate(${Math.cos(a) * k * 40}px, ${Math.sin(a) * k * 40}px)`;
  };
  const stickAt = e => { const r = stick.getBoundingClientRect(); setDirs(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; try { stick.setPointerCapture(sid); } catch (_) {} stickAt(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) stickAt(e); });
  const stickEnd = () => { sid = null; setDirs(0, 0); knob.style.transform = ''; };
  stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
  // which buttons show: the fight set in the world and the arena, OK/BACK in menus; locked systems hide theirs
  const show = (el, on) => el.classList.toggle('hide', !on);
  (function tick() {
    const G = window.GAME, play = G && !G.menu && (G.scene === 'world' || G.scene === 'arena'), pr = G && G.profile;
    const open = id => (typeof unlocked === 'function' && pr ? unlocked(pr, id) : true);
    // a peaceful place (town, a house; not the dojo or a rock cave): the attack keys only talk there, so the phone shows TALK
    // alone instead of an ATTACK that does the same thing (and spells, block and Layer, which do nothing there). 2026-11-08
    const w = G && G.world, hp = w && w.player, calm = play && G.scene === 'world' && !!hp && (w.interior ? !w.dojoRoom && !w.rockCave : !w.cave && !w.rift && typeof inTown === 'function' && inTown(hp.x));
    for (const id of ['atk', 's0', 's1', 's2', 'fuse']) show(ui[id], play && !calm); show(ui.dash, play);
    show(ui.block, play && !calm && open('block')); show(ui.layer, play && !calm && open('layer'));
    show(ui.talk, play && G.scene === 'world');
    if (ui.talk._calm !== calm) { ui.talk._calm = calm; Object.assign(ui.talk.style, calm ? R(22, 24, 84) : R(90, 158, 50)); ui.talk.style.fontSize = calm ? '15px' : ''; }   // (in town TALK sits where ATTACK is, big, under the thumb)
    for (const id of ['bag', 'map', 'meal', 'more']) show(ui[id], play && G.scene === 'world');
    // the radar (radar.js loads after this file) and the item belt keep clear of the left column: checked every 20 frames
    tc._n = (tc._n || 0) + 1;
    if (play && G.scene === 'world' && tc._n % 20 === 1) {
      const cr = cv.getBoundingClientRect(), br = ui.bag.getBoundingClientRect();
      TOUCH.colR = br.width && cr.width ? Math.max(0, (br.right - cr.left) * VW / cr.width) : 0;
      if (typeof RADAR !== 'undefined' && !RADAR._touch) { RADAR._touch = true; RADAR.at = () => ({ x: radarX(), y: 148 }); }
      if (typeof BELT !== 'undefined') BELT.x = radarX() + 32 + 6;
    }
    if (!(play && G.scene === 'world')) more.style.display = 'none';
    for (const [id, uid] of [['log', 'log'], ['titles', 'log'], ['workshop', 'workshop'], ['sets', 'sets'], ['tower', 'tower'], ['season', 'season']]) if (moreBtns[id]) show(moreBtns[id], open(uid));
    show(ui.menu, play || !!(G && G.menu)); show(ui.ok, !play); show(ui.back, !play);
    // ☰ and ⛶ sat on top of the bag's tabs, the hub's title and the title logo (2026-11-20, the user: "full screen and setting tab
    // sits ontop of the bag menu"). Outside play in the world they move to the screen's top-left corner, off the game, stacked
    show(stick, !(G && G.menu && G.menu.type === 'dialog'));   // (a talk box only needs OK: the stick covered the speaker's picture, 2026-11-20)
    const corner = !(play && G.scene === 'world');
    if (tc._corner !== corner) { tc._corner = corner;
      Object.assign(ui.menu.style, corner ? { top: 'max(6px, env(safe-area-inset-top))', left: 'max(6px, env(safe-area-inset-left))' } : { top: 'var(--tby, 8px)', left: 'var(--tbx, 200px)' });
      Object.assign(full.style, corner ? { top: 'calc(max(6px, env(safe-area-inset-top)) + 38px)', left: 'max(4px, env(safe-area-inset-left))' } : { top: 'var(--tby, 8px)', left: 'calc(var(--tbx, 200px) + 40px)' }); }
    if (play) { const L = tMap().labels || []; ui.s0.textContent = L[0] || 'Q'; ui.s1.textContent = L[1] || 'E'; ui.s2.textContent = L[2] || 'R'; }
    requestAnimationFrame(tick);
  })();
}
// VIBRATION: only once touch is on, on devices that can, and while the setting is on
const tBuzz = p => { if (TOUCH.on && navigator.vibrate && (typeof SET === 'undefined' || SET.vibe)) try { navigator.vibrate(p); } catch (e) {} };
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    const G = window.GAME, me = G && G.world === world && def === world.player, hp0 = me ? def.hp : 0, r = dd(world, att, def, opts);
    if (me && def.hp < hp0) tBuzz(25);
    return r;
  };
  const ft = floatText;
  floatText = (world, x, y, str, ...r) => {
    const G = window.GAME; if (G && G.world === world && TOUCH.on) { const s = String(str); if (s === 'PARRY!') tBuzz(40); else if (s === 'PERFECT DODGE') tBuzz([15, 30, 15]); else if (s === 'GUARD BREAK') tBuzz(70); }
    return ft(world, x, y, str, ...r);
  };
}
addEventListener('touchstart', touchOn, { once: true, passive: true });
if (/[?&]touch=1/.test(location.search)) touchOn();
