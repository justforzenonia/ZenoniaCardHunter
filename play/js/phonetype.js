'use strict';
// PHONE TYPING: a phone or tablet only shows its on-screen keyboard for a real text box, and the game is all canvas. So while the
// game wants letters (the hero's NAME on the create screen, the 4-letter ROOM CODE in Online Co-op) a hidden text box waits:
// a tap on the game, or on the "⌨ Keyboard" button that shows at the top, focuses it and the phone's keyboard comes up. What you
// type there goes into the game exactly as a keyboard's letters would (core.js typed / pressed): letters, Backspace, Enter.
// A real keyboard plugged into the device still works as before (its keys are counted once, never twice).
const PTYPE = { pad: '##', realKeyMs: 60 };
const ptWant = () => {   // is the game waiting for letters right now?
  const G = window.GAME, m = G && G.menu; if (!m) return false;
  if (m.type === 'netmenu') return true;
  if (m.type === 'custom' && typeof customRows === 'function') return customRows(m)[m.row] === 'name';
  return false;
};
(function () {
  const box = document.createElement('input');
  Object.assign(box, { type: 'text', autocomplete: 'off', spellcheck: false, value: PTYPE.pad });
  box.setAttribute('autocapitalize', 'off'); box.setAttribute('autocorrect', 'off'); box.setAttribute('enterkeyhint', 'done'); box.setAttribute('aria-label', 'Type');
  // kept on screen (an off-screen box can stop some phones opening the keyboard) but invisible and tiny; 16px text stops iPhones zooming in
  box.style.cssText = 'position:fixed;left:50%;top:6px;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;background:transparent;color:transparent;caret-color:transparent;z-index:1;';
  const btn = document.createElement('div'); btn.textContent = '⌨ Keyboard';
  btn.style.cssText = 'position:fixed;left:50%;top:max(8px, env(safe-area-inset-top));transform:translateX(-50%);display:none;z-index:8;padding:7px 14px;border-radius:10px;font:700 14px "Fredoka","Trebuchet MS",system-ui,sans-serif;color:#fff4d8;background:rgba(34,22,14,0.8);border:2px solid rgba(255,216,96,0.8);touch-action:none;';
  const add = () => { document.body.appendChild(box); document.body.appendChild(btn); };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  const reset = () => { box.value = PTYPE.pad; try { box.setSelectionRange(PTYPE.pad.length, PTYPE.pad.length); } catch (e) {} };
  const open = () => { reset(); box.focus({ preventScroll: true }); };
  let realAt = -1e9;   // a plugged-in keyboard's key (core.js already counts it, so the box must not count it again)
  // (2026-11-20, the user: "back button for keyboard doesnt work in character creation") a phone keyboard's Backspace comes as
  // key 'Backspace' with an empty code, which core.js can't count: only a key with a real code (a plugged-in keyboard) counts as real
  addEventListener('keydown', e => { if (e.key && e.code && (e.key.length === 1 || e.key === 'Backspace') && e.keyCode !== 229) realAt = performance.now(); }, true);
  const tap = code => { pressed.add(code); keys.add(code); setTimeout(() => keys.delete(code), 50); };
  box.addEventListener('input', () => {
    const v = box.value, real = performance.now() - realAt < PTYPE.realKeyMs;
    if (!real) {
      if (v.length < PTYPE.pad.length) tap('Backspace');
      else if (v.startsWith(PTYPE.pad)) for (const ch of v.slice(PTYPE.pad.length)) { if (ch === '\n') tap('Enter'); else typed.push(ch); }
    }
    reset();
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.keyCode === 13) { if (!keys.has('Enter')) pressed.add('Enter'); e.preventDefault(); } });   // (the keyboard's Done / Enter key)
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); open(); });
  btn.addEventListener('click', e => { e.preventDefault(); open(); });
  // a tap on the game while it waits for letters brings the keyboard up too (it has to happen inside the tap itself)
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' && ptWant() && e.target !== btn) open(); });
  let was = false;
  (function tick() {
    requestAnimationFrame(tick);
    const want = ptWant(), touch = typeof TOUCH !== 'undefined' && TOUCH.on;
    btn.style.display = want && touch && document.activeElement !== box ? 'block' : 'none';
    if (want && !was && touch) open();   // (some phones let this through without a tap; the button and taps cover the rest)
    if (!want && was && document.activeElement === box) box.blur();
    was = want;
  })();
})();
