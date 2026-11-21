'use strict';
// SETTINGS (Esc ▸ SETTINGS): a few comforts, kept per browser (localStorage 'zch_settings'; the game plays fine without it).
//   LANGUAGE      English (the default), Auto (the device's language) or Español, Português, Français, Deutsch, Filipino,
//                 日本語: every drawn word is translated from a built-in dictionary (i18n.js), at once
//   VOLUME        everything you hear (sfx.js master; 0 still mutes it all)
//   MUSIC         how loud the music is beside the sound effects (bgm.js)
//   SCREEN SHAKE  full, half or off (drawWorld shakes by world.shake)
//   DAMAGE NUMBERS  the numbers that pop off every hit (floatText), on or off; words like PARRY! still show
//   TIPS          the tip windows (tips.js), on or off
//   NIGHT LIGHT   a warmer, dimmer screen for playing late (a CSS filter on the canvas), off, low or high
//   CHIMES        the soft music-box chimes under the hunting alerts and combat moments (reactions, Payback, Flawless,
//                 Rally: all through cues.js cuePlay), on or off
//   HUNT ALERTS   All, or Quiet: no "elite nearby", "new for your Monster Book" or "target is near" messages (cues.js)
//   RADAR         the little round map of what is near (radar.js), on or off
//   COMBAT HINTS  the aim corners under your spell's target (aimmark.js) and the reaction / weak point chips on your spell
//                 slots (reacthint.js) the timer lines under foe debuff chips (statustimer.js)
//                 the last-stretch outline (laststretch.js) and the combo timer line (combotimer.js), on or off; the reaction chips over foes and the spell warning ! always show
//   CALM FIELDS   monsters far below your level leave you alone unless hit (calmfoes.js), on or off
//   PERFORMANCE   SHARP (draws at twice the size) or FAST (a quarter of the pixels, for slower phones); it applies on the next load
//   SEND / GET HERO  move a hero to another device with a short code (below)
//   TOUCH BUTTONS small, normal or large touch controls (touch.js), at once
//   VIBRATION     on phones and tablets that can (touch.js): a buzz when you are hit, parry or perfect-dodge
//   CONTROLS      the fight keys can be changed: attack, dash, block, Layer and the three spells (main.js SOLO)
//   GAME SERVER   (2026-11-19, the user chose "Phone app + friends") the computer whose game server keeps the MARKET board and
//                 passes heroes between devices: blank = the one this game came from. The phone app (and a friend far away, over
//                 Tailscale) types the PC's address here, e.g. 10.0.0.142 or 100.x.y.z; the port defaults to 8766. srvUrl() builds the links.
const SET_ROWS = [
  { id: 'lang',  name: 'LANGUAGE',       steps: LANGS.map(L => L[0]), label: v => langLabel(v) },   // (i18n.js: English is the default; Auto follows the device)
  { id: 'cozy',  name: 'COZY MODE',      steps: null, label: () => (SET.cozyPrev ? 'On  (press to undo)' : 'Off  (press for calm)'), act: () => setCozy() },
  { id: 'vol',   name: 'VOLUME',         steps: [0, 0.25, 0.5, 0.75, 1], label: v => `${Math.round(v * 100)}%` },
  { id: 'music', name: 'MUSIC',          steps: [0, 0.25, 0.5, 0.75, 1], label: v => `${Math.round(v * 100)}%` },
  { id: 'shake', name: 'SCREEN SHAKE',   steps: [0, 0.5, 1], label: v => (v === 0 ? 'Off' : v === 1 ? 'Full' : 'Half') },
  { id: 'nums',  name: 'DAMAGE NUMBERS', steps: [false, true], label: v => (v ? 'On' : 'Off') },
  { id: 'tips',  name: 'TIPS',           steps: [false, true], label: v => (v ? 'On' : 'Off') },
  { id: 'night', name: 'NIGHT LIGHT',    steps: [0, 1, 2], label: v => ['Off', 'Low', 'High'][v] },
  { id: 'chimes', name: 'CHIMES',        steps: [false, true], label: v => (v ? 'On' : 'Off') },
  { id: 'alerts', name: 'HUNT ALERTS',   steps: [false, true], label: v => (v ? 'All' : 'Quiet') },
  { id: 'radar', name: 'RADAR',          steps: [false, true], label: v => (v ? 'On' : 'Off') },
  { id: 'hints', name: 'COMBAT HINTS',   steps: [false, true], label: v => (v ? 'On' : 'Off') },
  { id: 'calm',  name: 'CALM FIELDS',    steps: [false, true], label: v => (v ? 'On' : 'Off') },
  { id: 'fast',  name: 'PERFORMANCE',    steps: [false, true], label: v => (v ? 'Fast' : 'Sharp') },
  { id: 'fps',   name: 'FRAME RATE',     steps: [60, 30], label: v => (v === 30 ? '30  (cooler, saves battery)' : '60  (smoothest)') },
  { id: 'tsize', name: 'TOUCH BUTTONS',  steps: [0.8, 1, 1.25], label: v => (v < 1 ? 'Small' : v > 1 ? 'Large' : 'Normal') },
  { id: 'vibe',  name: 'VIBRATION',      steps: [false, true], label: v => (v ? 'On' : 'Off') },
  { id: 'keys',  name: 'CONTROLS',       steps: null, label: () => 'Change keys' },
  { id: 'send',  name: 'SEND HERO',      steps: null, label: () => (SET_SHARE.code && Date.now() < SET_SHARE.until ? `Code: ${SET_SHARE.code}` : 'Get a code'), act: () => setSendHero() },
  { id: 'get',   name: 'GET HERO',       steps: null, label: () => 'Enter a code', act: () => setGetHero() },
  { id: 'server', name: 'GAME SERVER',   steps: null, label: () => (SET.server ? SET.server.replace(/^https:\/\//, '') : window.ZCH_SERVER ? `${srvHost()}  (press to change)` : (srvNeeded() ? 'Not set  (press to set)' : 'This one  (press to change)')), act: () => setServer() },
];
const SET = (() => {
  const def = { lang: 'en', vol: 1, music: 1, shake: 1, nums: true, tips: true, vibe: true, fast: false, radar: true, hints: true, calm: true, tsize: 1, night: 0, chimes: true, alerts: true, keys: {},
    fps: (() => { try { return matchMedia('(pointer: coarse)').matches ? 30 : 60; } catch (e) { return 60; } })() };   // (FRAME RATE: phones start at 30, which halves the work and the heat)
  try { return Object.assign(def, JSON.parse(localStorage.getItem('zch_settings') || '{}')); } catch (e) { return def; }
})();
const setSave = () => { try { localStorage.setItem('zch_settings', JSON.stringify(SET)); } catch (e) {} };
// the game server's address for a path ('market/list', 'save/share'…): SET.server if one is set, else the server this page came from
const srvNeeded = () => !/^https?:$/.test(location.protocol) || ['localhost', ''].includes(location.hostname) && !location.port;   // (the phone app: its pages come from inside the app)
// THE PUBLIC GAME SERVER (2026-11-19, the user's website): tools/build_release.py --server URL puts the website's address in
// window.ZCH_SERVER, so the website, a copy on another host and the phone app all meet there for co-op, the market and hero
// codes. A GAME SERVER set in SETTINGS still wins. A home PC's address (an IP) is plain http on port 8766; a name is https.
const srvBase = () => { const s = SET.server || window.ZCH_SERVER || ''; return !s ? '' : /^https?:\/\//i.test(s) ? s.replace(/\/+$/, '') : `http://${s}`; };
const srvHost = () => srvBase().replace(/^https?:\/\//i, '');
function srvUrl(path) { path = String(path).replace(/^\//, ''); const b = srvBase(); return b ? `${b}/${path}` : path; }
function setServer() {
  const G = GAME, was = SET.server || '';
  let v = prompt('The game server address: a website like zenonia.duckdns.org, or a home PC like 10.0.0.142 — or leave empty for the usual one:', was);
  if (v == null) return;
  v = v.trim().replace(/\/+$/, '');
  const bare = v.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  // (https: typed so, or a website name with no port; an IP, localhost or name:port is a home PC on plain http)
  const named = /^https:\/\//i.test(v) || /[a-z]/i.test(bare) && !/:\d+$/.test(bare) && !/^localhost$/i.test(bare);
  v = v.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (v && !named && !/:\d+$/.test(v)) v += ':8766';
  if (v && !/^[A-Za-z0-9.\-]+(:\d{2,5})?$/.test(v)) return G.toast('That address does not look right (like zenonia.duckdns.org or 10.0.0.142)', '#ff8a8a');
  if (v && named) v = 'https://' + v;
  SET.server = v; setSave();
  if (!v) return G.toast(window.ZCH_SERVER ? `Using the usual server, ${srvHost()}` : 'Using this game\'s own server', '#9fd8ff');
  fetch(srvUrl('market/list')).then(r => r.json()).then(d => G.toast(`Connected to ${srvHost()} · ${(d.listings || []).length} on its market board`, '#8fffd0'))
    .catch(() => G.toast(named ? `Saved, but ${srvHost()} did not answer: check the address, or try again in a minute` : `Saved, but ${v} did not answer: is the game server running there, and are you on the same network (or Tailscale)?`, '#ffb070'));
}
// CONTROLS: each fight action's first key can be changed (its other default keys stay, unless the new key takes one). A key
// that already moves you or opens a screen can't be taken. The HUD's key labels (SOLO.labels) follow.
const SET_KEYS = [
  { id: 'atk',   name: 'ATTACK',  get: () => SOLO.atk,      lbl: null },
  { id: 'dash',  name: 'DASH',    get: () => SOLO.dash,     lbl: 4 },
  { id: 'block', name: 'BLOCK',   get: () => SOLO.block,    lbl: 6 },
  { id: 'layer', name: 'LAYER',   get: () => SOLO.layer,    lbl: 5 },
  { id: 's1',    name: 'SPELL 1', get: () => SOLO.spell[0], lbl: 0 },
  { id: 's2',    name: 'SPELL 2', get: () => SOLO.spell[1], lbl: 1 },
  { id: 's3',    name: 'SPELL 3', get: () => SOLO.spell[2], lbl: 2 },
];
const SET_KEY_DEF = Object.fromEntries(SET_KEYS.map(K => [K.id, [...K.get()]])), SET_LBL_DEF = [...SOLO.labels];
const SET_RESERVED = new Set(['Escape', 'Minus', 'Digit9', 'Tab', 'Enter', 'KeyI', 'KeyM', 'KeyB', 'KeyY', 'KeyP', 'KeyX', 'KeyZ', 'KeyO', 'KeyU', 'KeyN', 'KeyH', 'KeyG', 'KeyT', 'Digit0', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
  'Backquote', 'Comma', 'Period', 'Semicolon', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const keyName = c => c.replace(/^Key/, '').replace(/^Digit/, '').replace(/(Left|Right)$/, '').replace(/^Arrow/, '') || c;
function setApplyKeys() {
  for (const K of SET_KEYS) { const a = K.get(); a.length = 0; a.push(...SET_KEY_DEF[K.id]); }
  SOLO.labels.length = 0; SOLO.labels.push(...SET_LBL_DEF);
  for (const K of SET_KEYS) {
    const code = SET.keys[K.id]; if (!code) continue;
    for (const O of SET_KEYS) { const a = O.get(); for (let i = a.length - 1; i >= 0; i--) if (a[i] === code) a.splice(i, 1); }   // (taken from any other action)
    const a = K.get(); a.unshift(code); if (K.lbl != null) SOLO.labels[K.lbl] = keyName(code);
  }
}
setApplyKeys();
// NIGHT LIGHT: warmer and dimmer, on the whole picture at once
const SET_NIGHT = ['', 'sepia(0.25) brightness(0.88) saturate(0.9)', 'sepia(0.45) brightness(0.72) saturate(0.8)'];
function setApplyNight() { cv.style.filter = SET_NIGHT[SET.night || 0] || ''; }
setApplyNight();
// waiting for the new key: caught before the game sees it, so pressing it does not also attack or cast
let setWaitKey = null;
addEventListener('keydown', e => {
  if (!setWaitKey) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const id = setWaitKey, code = e.code; setWaitKey = null;
  if (code === 'Escape') return;
  if (SET_RESERVED.has(code)) { if (window.GAME) GAME.toast(`${keyName(code)} is already used to move or open a screen`, '#ff8a8a'); return; }
  for (const k in SET.keys) if (SET.keys[k] === code) delete SET.keys[k];   // (one key, one action)
  SET.keys[id] = code; setSave(); setApplyKeys();
}, true);
// MOVING A HERO to another device (tools/serve.py /save/share). Each device keeps its own save, so to carry a hero from the
// computer to a phone (or back): SEND HERO on the old one shows a 5-letter code for 30 minutes; GET HERO on the new one asks
// for it and, once you confirm, puts that hero on this device. The hero it replaces is archived on this device first
// (POST /save?keep=1), so it can still be brought back from the title (savearchive.js).
const SET_SHARE = { code: null, until: 0 };
function setSendHero() {
  const G = GAME, pr = G.profile;
  if (!pr) return G.toast('Start or continue a hero first', '#ff8a8a');
  if (G.net && G.net.role === 'guest') return G.toast("A friend's game can't send a hero: leave the room first", '#ff8a8a');
  G.save();
  fetch(srvUrl('save/share'), { method: 'POST', body: JSON.stringify(pr) }).then(r => r.json()).then(j => {
    SET_SHARE.code = j.code; SET_SHARE.until = Date.now() + 30 * 60000;
    G.toast(`Hero code: ${j.code} · on the other device: Esc ▸ SETTINGS ▸ GET HERO (30 min)`, '#9fd8ff');
  }).catch(() => G.toast('Could not reach the game server', '#ff8a8a'));
}
function setGetHero() {
  const G = GAME, pr = G.profile;
  if (G.net && G.net.role === 'guest') return G.toast("A friend's game can't take a hero: leave the room first", '#ff8a8a');
  const code = (prompt('Enter the hero code from the other device (5 letters):') || '').trim().toUpperCase(); if (!code) return;
  fetch(srvUrl('save/share?peek=1&c=' + encodeURIComponent(code))).then(r => (r.ok ? r.json() : null)).then(p => {   // (a look first: the code is used only once you say yes)
    if (!p || !p.lv || !Array.isArray(p.gear)) return G.toast('That code is not valid (or more than 30 minutes old)', '#ff8a8a');
    const name = h => `${(h.look && h.look.name) || 'Hero'}, Lv ${h.lv}`;
    if (pr && !confirm(`Bring ${name(p)} to this device?\n${name(pr)} will be put in the archive here (title ▸ previous heroes).`)) return G.toast('Kept your hero here (the code still works)', '#c9c1a8');
    G.save = () => {};   // (nothing may write the old hero back now)
    fetch(srvUrl('save/share?c=' + encodeURIComponent(code))).catch(() => {})   // (now it is used up)
      .then(() => fetch('save?keep=1', { method: 'POST', body: JSON.stringify(p) })).catch(() => {}).then(() => {
      saveGame(p); try { sessionStorage.setItem('zch_moved', name(p)); } catch (e) {}
      location.reload();
    });
  }).catch(() => G.toast('Could not reach the game server', '#ff8a8a'));
}
try { const n = sessionStorage.getItem('zch_moved'); if (n) { sessionStorage.removeItem('zch_moved'); setTimeout(() => window.GAME && GAME.toast(`${n} is now on this device: Continue to play`, '#9fd8ff'), 1500); } } catch (e) {}
// sound: the master volume follows VOLUME (unless muted with 0), the music its share
const SET_BASE = { master: 0.5, music: BGM.vol };
function setApplySound() {
  const A = SFX.audio(); BGM.vol = SET_BASE.music * SET.music * (window.MUSIC_DUCK || 1);   // (MUSIC_DUCK: softer music by the rest campfire, pats.js)
  if (A && A.master.gain.value > 0) A.master.gain.value = SET_BASE.master * Math.max(0.001, SET.vol);
  if (A && BGM.now) BGM.now.g.gain.setTargetAtTime(Math.max(0.0001, BGM.vol), A.ac.currentTime, window.MUSIC_DUCK_TC || 0.1);
}
setInterval(setApplySound, 1000);   // (the audio only starts after the first key press, and 0 sets the master back to its old level)
// screen shake (world.js drawWorld), never more than SHAKE_CAP game pixels (2026-11-06: some moments asked for 8-12)
const SHAKE_CAP = 3;
{
  const dw = drawWorld;
  drawWorld = (world, cam, bg, now) => {
    const s = world.shake; if (s) world.shake = Math.min(SHAKE_CAP, s * SET.shake);   // (cozy: even the biggest moment only nudges the screen)
    try { return dw(world, cam, bg, now); } finally { if (s) world.shake = s; }
  };
}
// damage numbers: plain numbers (and +heals) are left out; words still pop
{
  const ft = floatText;
  floatText = (world, x, y, str, ...r) => (!SET.nums && /^[+-]?\d+$/.test(String(str)) ? undefined : ft(world, x, y, str, ...r));
}
// tips
{
  const te = tipEvent;
  tipEvent = (game, id) => (SET.tips ? te(game, id) : undefined);
}
// the pause menu (pvp.js) gets SETTINGS, under UNLOCKS
PAUSE_OPTS.splice(PAUSE_OPTS.findIndex(o => o.id === 'hub'), 0, { id: 'settings', title: 'SETTINGS', sub: 'Language, volume, music, screen shake, tips', col: '#9fd8ff' });
{
  // (2026-11-20) the list SCROLLS: rows were squeezed to fit the screen (10 px each at 27 rows, about to overlap), now every row
  // keeps SET_LIST.rh and the list shows as many as fit, moving to keep the chosen one in view (a row of space above and below)
  const SET_LIST = { rh: 16, W: 340 };
  const setLayout = m => {
    const n = SET_ROWS.length, vis = Math.min(n, Math.floor((VH - 24 - 54 - 16) / SET_LIST.rh)), row = m.row || 0;
    let top = Math.max(0, Math.min(m.top || 0, n - vis));
    if (row < top + 1) top = Math.max(0, row - 1); if (row > top + vis - 2) top = Math.min(n - vis, row - vis + 2);
    m.top = top;
    const W = SET_LIST.W, H = 54 + vis * SET_LIST.rh, x = VW / 2 - W / 2, y = VH / 2 - H / 2;
    return { RH: SET_LIST.rh, vis, top, W, H, x, y, rowY: i => y + 34 + (i - top) * SET_LIST.rh };
  };
  const up = updatePause;
  updatePause = (game, m, dt) => {
    if (m.view === 'keys') {
      m.t += dt; if (setWaitKey) return;
      const k = navInput(), n = SET_KEYS.length + 1; m.krow = m.krow || 0;
      if (k.u) m.krow = (m.krow + n - 1) % n; if (k.d) m.krow = (m.krow + 1) % n;
      if (k.ok && m.t > 150) { if (m.krow === SET_KEYS.length) { SET.keys = {}; setSave(); setApplyKeys(); } else setWaitKey = SET_KEYS[m.krow].id; }
      if (k.back && m.t > 120) { m.view = 'settings'; m.t = 0; }
      return;
    }
    if (m.view === 'settings') {
      m.t += dt; const k = navInput(), n = SET_ROWS.length; m.row = m.row || 0;
      if (k.u) m.row = (m.row + n - 1) % n; if (k.d) m.row = (m.row + 1) % n;
      { const L = setLayout(m);   // (a click or tap: picks a row, and on the chosen row acts like Enter)
        for (let i = L.top; i < L.top + L.vis; i++) if (clicked(L.x + 10, L.rowY(i) - L.RH / 2, L.W - 20, L.RH)) { if (i === m.row) k.ok = true; else { m.row = i; m.t = Math.max(m.t, 121); } } }
      const R = SET_ROWS[m.row];
      if (!R.steps) { if ((k.ok || k.r) && m.t > 120) { if (R.act) { m.t = 0; R.act(); } else { m.view = 'keys'; m.t = 0; m.krow = 0; } } else if (k.back && m.t > 120) { m.view = null; m.t = 0; } return; }
      const i = R.steps.indexOf(SET[R.id]);
      const step = k.l ? -1 : k.r || k.ok ? 1 : 0;
      if (step) { SET[R.id] = R.steps[(Math.max(0, i) + step + R.steps.length) % R.steps.length]; setSave(); setApplySound(); if (R.id === 'lang') langSet(SET.lang); if (R.id === 'vol' || R.id === 'music') guardSound && guardSound('steady'); if (R.id === 'tsize' && typeof TOUCH !== 'undefined' && TOUCH.refit) TOUCH.refit(); if (R.id === 'night') setApplyNight(); if (R.id === 'fast') GAME.toast(SET.fast === (RES === 1) ? 'Back as it is now' : `${SET.fast ? 'FAST' : 'SHARP'} applies the next time the game loads (save, then reload the page)`, '#9fd8ff'); }
      if (k.back && m.t > 120) { m.view = null; m.t = 0; }
      return;
    }
    const i = PAUSE_OPTS.findIndex(o => o.id === 'settings'), B = PAUSE_BTN(i), k = navInput();
    const open = m.cur === i && (k.ok || clicked(B.x, B.y, B.w, B.h));
    up(game, m, dt);
    if (open && game.menu === m) { m.view = 'settings'; m.t = 0; m.row = 0; }
  };
  const dp = drawPause;
  drawPause = (game, m, now) => {
    dp(game, m, now);
    if (m.view === 'keys') return drawSetKeys(m);
    if (m.view !== 'settings') return;
    const L = setLayout(m), { RH, W, H, x, y } = L;
    ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#100a18'; rrect(ctx, x, y, W, H, 6); ctx.fill();   // (solid: the menu under it does not show through)
    ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
    goldText('SETTINGS', VW / 2, y + 14, 11, { spacing: 2 });
    if (L.top > 0) text(`▲ ${L.top} more`, x + W / 2, y + 25, '#9fd8ff', 7);
    if (L.top + L.vis < SET_ROWS.length) text(`▼ ${SET_ROWS.length - L.top - L.vis} more`, x + W / 2, y + H - 18, '#9fd8ff', 7);
    SET_ROWS.forEach((R, i) => {
      if (i < L.top || i >= L.top + L.vis) return;
      const ry = L.rowY(i), sel = i === (m.row || 0);
      if (sel) { ctx.fillStyle = 'rgba(159,216,255,0.12)'; rrect(ctx, x + 10, ry - RH / 2 + 1, W - 20, RH - 2, 4); ctx.fill(); }
      text(R.name, x + 22, ry, sel ? '#9fd8ff' : '#e8e2cf', 8, 'left');
      text(R.steps ? `◀  ${R.label(SET[R.id])}  ▶` : `${R.label()}  ▶`, x + W - 22, ry, sel ? '#ffffff' : '#b8b0c8', 8, 'right');
    });
    text('↑↓ choose · ←→ change · click or tap a row · Esc back', VW / 2, y + H - 7, '#b8b0a0', 7);
  };
}
// the CONTROLS page
function drawSetKeys(m) {
  const W = 340, H = 64 + (SET_KEYS.length + 1) * 22, x = VW / 2 - W / 2, y = VH / 2 - H / 2;
  ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#100a18'; rrect(ctx, x, y, W, H, 6); ctx.fill();
  ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; rrect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();
  goldText('CONTROLS', VW / 2, y + 14, 11, { spacing: 2 });
  [...SET_KEYS, { id: 'reset', name: 'RESET TO DEFAULTS' }].forEach((K, i) => {
    const ry = y + 36 + i * 22, sel = i === (m.krow || 0), wait = setWaitKey === K.id;
    if (sel) { ctx.fillStyle = 'rgba(159,216,255,0.12)'; rrect(ctx, x + 10, ry - 9, W - 20, 18, 4); ctx.fill(); }
    text(K.name, x + 22, ry, sel ? '#9fd8ff' : '#e8e2cf', 8, 'left');
    if (K.get) text(wait ? 'Press a key…' : K.get().map(keyName).join(' / '), x + W - 22, ry, wait ? '#ffe08a' : sel ? '#ffffff' : '#b8b0c8', 8, 'right');
  });
  text(setWaitKey ? 'Press the new key · Esc cancels' : '↑↓ choose · Enter change · Esc back', VW / 2, y + H - 10, '#9a917c', 6.5);
}
// AUTO-PAUSE: switching apps, locking a phone or changing browser tab mid-fight. When the page is hidden the game saves (a
// phone may close a background page without warning) and, playing alone in the world, opens the pause menu so you come back
// to a stopped game. In co-op it only saves: pausing the host would stop everyone. Held keys and touch buttons let go.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  keys.clear();
  const G = window.GAME; if (!G || !G.profile || G.scene === 'title') return;
  const coop = G.net && (G.net.role === 'guest' || (G.net.role === 'host' && typeof netGuestList === 'function' && netGuestList(G).length));
  if (!(G.net && G.net.role === 'guest')) { try { G.save(); } catch (e) {} }
  if (!coop && G.scene === 'world' && !G.menu) { const pm = pauseMenu(); pm.t = 500; G.openMenu(pm); }
});
// COZY MODE (the top row): one press for a calm, bedtime game: no screen shake, quiet hunt alerts, a low night light and the
// music a touch softer. Your own settings are kept, and a second press puts every one of them back as it was.
const SET_COZY = { shake: 0, alerts: false, night: 1, music: 0.5, chimes: true, calm: true };   // (calm: CALM FIELDS on, calmfoes.js)
function setCozy() {
  if (SET.cozyPrev) { Object.assign(SET, SET.cozyPrev); SET.cozyPrev = null; GAME.toast('Cozy mode off: your settings are back', '#c9c1a8'); }
  else { const prev = {}; for (const k in SET_COZY) prev[k] = SET[k]; SET.cozyPrev = prev; Object.assign(SET, SET_COZY); GAME.toast('Cozy mode on: no shake, quiet alerts, a warm screen, softer music and calm fields', '#ffb0c8'); }
  setSave(); setApplySound(); setApplyNight();
}
