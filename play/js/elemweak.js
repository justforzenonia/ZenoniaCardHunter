'use strict';
// ELEMENT WEAKNESS: every monster carries its species' element (defs.js SPECIES[sp].spell.el) and is weak to one other.
// A hero-side hit (a player, their pets and summons) of that element does +25%, and a small white-bordered chip with an up
// arrow pops over the foe, the same chip style as the reactions (elemreact.js; it rides the same float, so a co-op friend sees
// it too). At most one chip per foe every ELEM_WEAK.gap ms, so a fast combo doesn't stack them. The Monster Book's Element line
// shows the weakness, and a spell slot whose element a nearby foe is weak to wears the chip (reacthint.js). A foe RESISTS its
// own element: a hero-side hit of it does ELEM_WEAK.resist (-25%) with a grey down-arrow chip, and a slot whose element every
// nearby foe resists wears that chip.
const ELEM_WEAK = {
  mul: 1.25, resist: 0.75, gap: 700,
  of: { fire: 'ice', ice: 'fire', earth: 'wind', wind: 'lightning', lightning: 'earth', dark: 'holy', holy: 'dark', poison: 'fire' },
};
const foeElem = o => { const S = o && o.sp && SPECIES[o.sp]; return S && S.spell && S.spell.el || null; };
const weakTo = o => ELEM_WEAK.of[foeElem(o)] || null;
REACT_CHIPS.WEAK = ['#ffe08a', ['..#..', '.###.', '#####', '..#..', '..#..']];   // an up arrow
REACT_CHIPS.RESIST = ['#b8c0cc', ['..#..', '..#..', '#####', '.###.', '..#..']];   // a grey down arrow: it resists its own element
{
  const dd = dealDamage;
  dealDamage = (world, att, def, opts) => {
    if (att && def && att !== def && opts && opts.el && !opts.reflected && !opts.weakHit && !def.dead && def.kind === 'monster' && !def.ally
      && (att.kind === 'player' || att.ally || att.pet) && opts.el === weakTo(def)) {
      opts = { ...opts, base: opts.base * ELEM_WEAK.mul, weakHit: true };
      const now = performance.now();
      if (!(def.weakChipT > now - ELEM_WEAK.gap)) { def.weakChipT = now; floatText(world, def.x + 9, def.y - (def.h || 26) * (def.scale || 1) - 34, REACT_ICON_MARK + 'WEAK', '#ffe08a', 7.5); if (window.GAME && GAME.world === world && att === world.player && typeof tipEvent === 'function') tipEvent(GAME, 'elemweak'); }
    }
    else if (att && def && att !== def && opts && opts.el && !opts.reflected && !opts.weakHit && !opts.resisted && !def.dead && def.kind === 'monster' && !def.ally
      && (att.kind === 'player' || att.ally || att.pet) && opts.el === foeElem(def)) {   // RESIST: its own element does less (ELEM_WEAK.resist)
      opts = { ...opts, base: opts.base * ELEM_WEAK.resist, resisted: true };
      const now = performance.now();
      if (!(def.weakChipT && now - def.weakChipT < ELEM_WEAK.gap)) { def.weakChipT = now; floatText(world, def.x + 9, def.y - (def.h || 26) * (def.scale || 1) - 34, REACT_ICON_MARK + 'RESIST', '#b8c0cc', 7.5); }
    }
    return dd(world, att, def, opts);
  };
}
