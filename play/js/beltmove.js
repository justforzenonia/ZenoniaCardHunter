'use strict';
// MOVE OR HIDE THE ITEM BELT (2026-11-20, the user: "able to move item slot around the screen and even remove it but a button on the
// left of the QER skill to open it back up"). The item belt (hud.js BELT, drawItemBelt) can be:
//   dragged      press anywhere on its plate and drag (mouse or finger); a press that does not move is still a tap, so a tap on a
//                socket uses that item and a drag never does. The spot is kept per device (settings.js SET.beltAt: one spot for the
//                touch layout, one for mouse and keys) and is held on screen at any size. A double tap on the ITEMS tab puts it back home.
//   hidden       the little x on the plate's top right corner. Keys 5-8 and P still use items while it is hidden.
//   brought back the ITEMS button just left of the Q/E/R skills (on a phone a round button left of Q/E/R; with a mouse a small
//                socket left of the skill bar) shows it again, or hides it. A spot that was lost off the screen goes back home.
const BELTMOVE = { drag: null, seen: 0, tabTap: 0 };
{
  const mode = () => (typeof TOUCH !== 'undefined' && TOUCH.on ? 'touch' : 'desk');
  const size = () => ({ w: 4 * BELT.s + 3 * BELT.gap + 10, h: BELT.s + 22 });
  const clampAt = (x, y) => { const { w, h } = size(); return { x: Math.max(2, Math.min(VW - w - 2, x)), y: Math.max(11, Math.min(VH - h - 6, y)) }; };
  const homeAt = () => mode() === 'desk' ? { x: VW - 106, y: VH - 68 }
    : { x: (typeof RADAR !== 'undefined' && RADAR._touch ? RADAR.at().x + 32 + 6 : 84), y: 122 };   // (the touch home: right of the radar, as touch.js sets it)
  const saved = () => (SET.beltAt || {})[mode()];
  // a moved belt sits at its saved spot (held on the screen); touch.js keeps placing the home spot, so this runs every frame
  const place = () => { const s = saved(); if (s) Object.assign(BELT, clampAt(s.x, s.y)); };
  const goHome = () => { if (SET.beltAt) delete SET.beltAt[mode()]; Object.assign(BELT, homeAt()); setSave(); };
  const inRect = (x, y, w, h) => mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  const onPlate = () => { const { w, h } = size(); return inRect(BELT.x - 2, BELT.y, w + 4, h); };
  const xBox = () => { const { w } = size(), r = mode() === 'touch' ? 9 : 6; return { cx: BELT.x + w - 2, cy: BELT.y + 2, r }; };
  const onX = () => { const b = xBox(); return Math.hypot(mouse.x - b.cx, mouse.y - b.cy) <= b.r + 2; };
  // the mouse version of the bring-back button: a small socket just left of the skill bar's tray (hud.js drawSpellBar at VW/2)
  const DESK_BTN = { x: VW / 2 - 118 - 10 - 26, y: VH - 44, w: 22, h: 22 };
  BELTMOVE.setHidden = (hide, game) => {
    SET.beltHide = !!hide;
    if (!hide) { const s = saved(); if (s) { const c = clampAt(s.x, s.y), { w, h } = size(); if (Math.abs(c.x - s.x) > w / 2 || Math.abs(c.y - s.y) > h / 2) goHome(); } }   // (lost off the screen: home again)
    setSave(); BELTMOVE.drag = null;
    const g = game || window.GAME;
    if (g && g.toast) g.toast(hide ? (mode() === 'touch' ? 'Item slot hidden: the ITEMS button left of Q/E/R brings it back' : 'Item slot hidden: keys 5-8 still work, and the button left of the skill bar brings it back')
      : 'Item slot back: drag it anywhere, the x hides it', '#c9c1a8');
  };
  // input: number keys and P go to hud.js as before; a click on the plate (or the buttons) is held back from it, so a press can become a drag
  const bi = beltInput;
  beltInput = function (game) {
    place();
    const hold = mouse.click && (onPlate() || (mode() === 'desk' && inRect(DESK_BTN.x, DESK_BTN.y, DESK_BTN.w, DESK_BTN.h)));
    if (hold) mouse.click = false;
    try { return bi.call(this, game); } finally { if (hold) mouse.click = true; }
  };
  const di = drawItemBelt;
  drawItemBelt = function (game, now) {
    place();
    const t = performance.now(); if (t - BELTMOVE.seen > 250) BELTMOVE.drag = null; BELTMOVE.seen = t;   // (a drag cut short by a menu ends)
    if (mode() === 'desk') drawDeskBtn(game);
    if (SET.beltHide) return;
    const r = di.call(this, game, now);
    beltDrag(game);
    drawX();
    return r;
  };
  function beltDrag(game) {
    const D = BELTMOVE.drag;
    if (!D) {
      if (!mouse.click) return;
      if (onX()) { mouse.click = false; BELTMOVE.setHidden(true, game); return; }
      if (!onPlate()) return;
      mouse.click = false;   // (nothing else under the plate takes this press)
      BELTMOVE.drag = { sx: mouse.x, sy: mouse.y, ox: BELT.x, oy: BELT.y, moved: false };
      if (!mouse.down) return beltRelease(game);   // (pressed and let go inside one frame: a tap)
      return;
    }
    if (!D.moved && Math.hypot(mouse.x - D.sx, mouse.y - D.sy) > (mode() === 'touch' ? 6 : 4)) D.moved = true;
    if (D.moved) {
      const c = clampAt(D.ox + mouse.x - D.sx, D.oy + mouse.y - D.sy);
      SET.beltAt = SET.beltAt || {}; SET.beltAt[mode()] = c; Object.assign(BELT, c);
    }
    if (!mouse.down) beltRelease(game);
  }
  function beltRelease(game) {
    const D = BELTMOVE.drag; BELTMOVE.drag = null; if (!D) return;
    if (D.moved) { setSave(); return; }
    // a tap: on a socket it uses the item, on the ITEMS tab twice in a row it sends the belt home
    const items = beltItems(game.profile);
    for (let i = 0; i < 4; i++) { const S = beltSlot(i); if (D.sx >= S.x && D.sx < S.x + S.w && D.sy >= S.y && D.sy < S.y + S.h) { if (items[i]) useBeltEntry(game, items[i]); return; } }
    const { w } = size();
    if (D.sy < BELT.y + 9 && Math.abs(D.sx - (BELT.x + w / 2)) < 20) {
      const t = performance.now();
      if (t - BELTMOVE.tabTap < 450) { BELTMOVE.tabTap = 0; goHome(); game.toast('Item slot back in its usual spot', '#c9c1a8'); } else BELTMOVE.tabTap = t;
    }
  }
  function drawX() {   // the hide button: a small dark coin with a bright x
    const b = xBox(), hov = onX() && mode() === 'desk';
    ctx.fillStyle = hov ? '#5a2a2a' : 'rgba(20,12,16,0.92)'; ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hov ? '#ffd23f' : 'rgba(224,166,58,0.9)'; ctx.lineWidth = 0.8; ctx.stroke();
    const k = b.r * 0.42; ctx.strokeStyle = '#ffe9c8'; ctx.lineWidth = mode() === 'touch' ? 1.6 : 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.cx - k, b.cy - k); ctx.lineTo(b.cx + k, b.cy + k); ctx.moveTo(b.cx + k, b.cy - k); ctx.lineTo(b.cx - k, b.cy + k); ctx.stroke(); ctx.lineCap = 'butt';
    if (hov) tipAbove('Hide the item slot', b.cx, b.cy - b.r - 2);
  }
  function tipAbove(s, cx, y) {
    const tw = textW(s, 7) + 10, tx = Math.max(2, Math.min(VW - tw - 2, cx - tw / 2));
    ctx.fillStyle = 'rgba(10,7,18,0.92)'; rrect(ctx, tx, y - 12, tw, 12, 4); ctx.fill();
    text(s, tx + tw / 2, y - 6, '#ffe9c8', 7);
  }
  function drawDeskBtn(game) {   // a socket with a little flask: bright while the belt is hidden, quiet while it shows
    const B = DESK_BTN, hid = !!SET.beltHide, hov = inRect(B.x, B.y, B.w, B.h), cx = B.x + B.w / 2, cy = B.y + B.h / 2;
    ctx.fillStyle = hid ? 'rgba(46,30,19,0.94)' : 'rgba(20,14,22,0.7)'; rrect(ctx, B.x, B.y, B.w, B.h, 5); ctx.fill();
    ctx.strokeStyle = hov ? '#ffd23f' : hid ? 'rgba(224,166,58,0.95)' : 'rgba(224,166,58,0.45)'; ctx.lineWidth = hov ? 1.2 : 0.8; rrect(ctx, B.x + 0.4, B.y + 0.4, B.w - 0.8, B.h - 0.8, 5); ctx.stroke();
    ctx.save(); ctx.globalAlpha = hid || hov ? 1 : 0.6;   // the flask: a round body, a neck and a cork
    ctx.fillStyle = '#ff6a7a'; ctx.beginPath(); ctx.arc(cx, cy + 2.5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9c8'; ctx.fillRect(cx - 1.8, cy - 6, 3.6, 4.5); ctx.fillStyle = '#c08850'; ctx.fillRect(cx - 2.2, cy - 7.5, 4.4, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(cx - 1.8, cy + 1, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (hov) tipAbove(hid ? 'Show the item slot' : 'Hide the item slot', cx, B.y - 2);
    if (mouse.click && hov) { mouse.click = false; BELTMOVE.setHidden(!hid, game); }
  }
  // the phone's ITEMS button, left of Q/E/R (touch.js builds the other buttons; this one joins them in #tc)
  (function touchBtn() {
    const tc = document.getElementById('tc');
    if (!tc || typeof TOUCH === 'undefined' || !TOUCH.on) { setTimeout(touchBtn, 500); return; }
    const b = document.createElement('div'); b.className = 'b'; b.dataset.id = 'items'; b.innerHTML = 'ITEMS';
    Object.assign(b.style, { right: 'max(236px, env(safe-area-inset-right))', bottom: '108px', width: '42px', height: '42px', fontSize: '10px' });
    tc.appendChild(b);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); BELTMOVE.setHidden(!SET.beltHide); });
    const q = tc.querySelector('.b[data-id="s0"]');
    (function tick() {
      b.classList.toggle('hide', !q || q.classList.contains('hide'));   // (shows with the Q/E/R buttons)
      b.style.opacity = SET.beltHide ? '1' : '0.6'; b.style.borderColor = SET.beltHide ? '#ffd860' : '';
      requestAnimationFrame(tick);
    })();
  })();
}
