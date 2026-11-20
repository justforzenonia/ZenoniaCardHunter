'use strict';
// REACTION HINT: when a foe near you is burning, frozen or poisoned, each ready spell whose element would react with it shows that
// reaction's tiny chip (elemreact.js REACT_CHIPS) in its slot's top-right corner, gently bobbing. It quietly teaches
// THAW / STEAM / OVERLOAD / WILDFIRE without any words. Only the hero's own bar, only foes within REACT_HINT.r.
const REACT_HINT = { r: 120 };
function reactKindFor(el, s) {
  if (!s) return null;
  if (el === 'fire' && s.freeze > 0) return 'THAW';
  if (el === 'earth' && s.freeze > 0) return 'SHATTER';
  if (el === 'fire' && s.poison && s.poison.t > 0) return 'BLIGHT';
  if (el === 'fire' && s.crack > 0) return 'MAGMA';
  if (el === 'wind' && !s.burn && s.poison && s.poison.t > 0) return 'MIASMA';
  if (!s.burn) return null;
  return el === 'ice' ? 'STEAM' : el === 'lightning' ? 'OVERLOAD' : el === 'wind' ? 'WILDFIRE' : null;
}
function reactHintFoes(world, a) {
  return enemiesOf(world, a).filter(o => o.kind === 'monster' && !o.ally && o.status && (o.status.burn || o.status.freeze > 0 || o.status.crack > 0 || (o.status.poison && o.status.poison.t > 0)) && Math.hypot(o.x - a.x, o.y - a.y) < REACT_HINT.r);
}
{
  const dsb = drawSpellBar;
  drawSpellBar = (a, keysLbl, cx, y, now) => {
    const r = dsb(a, keysLbl, cx, y, now);
    const G = window.GAME, w = G && G.world;
    if (!w || a !== w.player || (G.scene !== 'world' && !(G.scene === 'arena' && G.arena && G.arena.training)) || !a.spells || (typeof SET !== 'undefined' && SET.hints === false)) return r;   // (Settings > COMBAT HINTS)
    const s = SLOT, gap = 5, W = (30 + 3 * s + 2 * gap) * 2, x0 = cx - W / 2, sy = y;
    // a nearby foe weak to the spell's element (elemweak.js): the up-arrow chip in the slot's top-left corner
    const near = typeof weakTo === 'function' ? enemiesOf(w, a).filter(o => o.kind === 'monster' && !o.ally && Math.hypot(o.x - a.x, o.y - a.y) < REACT_HINT.r) : [];
    for (let i = 0; i < 3 && near.length; i++) {
      const sp = a.spells[i]; if (!sp || !sp.el || (a.cds[i] || 0) > 0 || !near.some(o => weakTo(o) === sp.el)) continue;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(x0 + i * (s + gap) + 2), Math.round(sy + 1 + Math.sin(now / 260 + i + 1.5) * 0.8)); ctx.scale(1.3, 1.3);
      reactChip(REACT_CHIPS.WEAK[0], REACT_CHIPS.WEAK[1]);
      ctx.restore();
    }
    for (let i = 0; i < 3 && near.length && typeof foeElem === 'function'; i++) {   // every nearby foe resists the spell's element: the grey down arrow
      const sp = a.spells[i]; if (!sp || !sp.el || (a.cds[i] || 0) > 0 || near.some(o => weakTo(o) === sp.el) || !near.every(o => foeElem(o) === sp.el)) continue;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(x0 + i * (s + gap) + 2), Math.round(sy + 1)); ctx.scale(1.3, 1.3);
      reactChip(REACT_CHIPS.RESIST[0], REACT_CHIPS.RESIST[1]);
      ctx.restore();
    }
    const foes = reactHintFoes(w, a); if (!foes.length) return r;
    for (let i = 0; i < 3; i++) {
      const sp = a.spells[i]; if (!sp || !sp.el || (a.cds[i] || 0) > 0) continue;
      let kind = null; for (const o of foes) if ((kind = reactKindFor(sp.el, o.status))) break;
      const C = kind && REACT_CHIPS[kind]; if (!C) continue;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(x0 + i * (s + gap) + s - 2), Math.round(sy + 1 + Math.sin(now / 260 + i) * 0.8)); ctx.scale(1.3, 1.3);
      reactChip(C[0], C[1]);
      ctx.restore();
    }
    return r;
  };
}
// TOUCH: on a phone the spell buttons are page elements at the right (touch.js), away from the canvas bar, so each one wears
// a small badge for the same hints: ▲ a nearby foe is weak to it, ▼ every nearby foe resists it, ✦ it sets off a reaction,
// ∞ a card chain is open (cast it to chain).
// Updated a few times a second; Settings > COMBAT HINTS off clears them.
function touchSpellBadges(game) {
  if (typeof TOUCH === 'undefined' || !TOUCH.on) return;
  const now = performance.now(); if (touchSpellBadges.at && now - touchSpellBadges.at < 200) return; touchSpellBadges.at = now;
  const w = game.world, a = w && w.player, off = !a || (game.scene !== 'world' && !(game.scene === 'arena' && game.arena && game.arena.training)) || !a.spells || (typeof SET !== 'undefined' && SET.hints === false);
  const near = off || typeof weakTo !== 'function' ? [] : enemiesOf(w, a).filter(o => o.kind === 'monster' && !o.ally && Math.hypot(o.x - a.x, o.y - a.y) < REACT_HINT.r);
  const foes = off ? [] : reactHintFoes(w, a);
  for (let i = 0; i < 3; i++) {
    const b = document.querySelector(`[data-id="s${i}"]`); if (!b) continue;
    const sp = !off && a.spells[i], ready = sp && sp.el && !((a.cds[i] || 0) > 0);
    let g = '', col = '';
    if (ready && foes.some(o => reactKindFor(sp.el, o.status))) { g = '✦'; col = '#9fe8ff'; }
    else if (ready && near.some(o => weakTo(o) === sp.el)) { g = '▲'; col = '#ffe08a'; }
    else if (ready && near.length && near.every(o => foeElem(o) === sp.el)) { g = '▼'; col = '#b8c0cc'; }
    else if (ready && a.chainN && a.chainLeft > 0 && i !== a.chainSlot) { g = '∞'; col = '#ffd23f'; }   // (a card chain is open: cardchain.js)
    let t = b.querySelector('.hintBadge');
    if (!g) { if (t) t.remove(); continue; }
    if (!t) { t = document.createElement('span'); t.className = 'hintBadge'; Object.assign(t.style, { position: 'absolute', top: '-4px', left: '-4px', font: '700 12px "Fredoka", sans-serif', lineHeight: '16px', width: '16px', height: '16px', textAlign: 'center', borderRadius: '4px', background: 'rgba(30,20,13,0.85)', border: '1px solid #fff', pointerEvents: 'none' }); if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; b.appendChild(t); }
    t.textContent = g; t.style.color = col;
  }
}
{ const tf = drawTitleFx; drawTitleFx = (game, now) => { const r = tf(game, now); touchSpellBadges(game); return r; }; }
