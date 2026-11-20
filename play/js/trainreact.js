'use strict';
// THE REACTIONS DRILL at the training dummy (training.js; Y or a click picks the next drill): the dummy wears one status at a
// time, frozen, burning, poisoned, then cracked, changing every TRAIN_REACT.every ms with a small word over it, so you can practise the
// element reactions (elemreact.js) on it: fire or earth on frozen (Thaw, Shatter), ice or wind on burning (Steam, Wildfire),
// fire or wind on poisoned (Blight, Miasma), fire on cracked (Magma). The panel counts the reactions you set off in it (from your own reactions stat).
const TRAIN_REACT = { every: 4000, cycle: [['freeze', 'FROZEN · fire, earth', '#9fe8ff'], ['burn', 'BURNING · ice, lightning, wind', '#ff9a5a'], ['poison', 'POISONED · fire, wind', '#a8e070'], ['crack', 'CRACKED · fire', '#d8a060']] };   // (each word names the elements that react with it)
DRILLS.push({ id: 'react', name: 'REACTIONS' });
{
  const tt = trainingTick;
  trainingTick = (w, dt) => {
    const r = tt(w, dt), d = w.p2, T0 = w.train;
    if (!d || !d.dummy || !T0) return r;
    if (DRILLS[T0.drill].id !== 'react') { if (T0.reactOn) { T0.reactOn = false; d.status = {}; } return r; }
    if (!T0.reactOn) { T0.reactOn = true; T0.react0 = titleStat(GAME.profile, 'reactions'); T0.reactT = 0; T0.reactI = -1; }
    if ((T0.reactT -= dt) <= 0) {   // the next status
      T0.reactT = TRAIN_REACT.every; T0.reactI = (T0.reactI + 1) % TRAIN_REACT.cycle.length;
      const [k, word, col] = TRAIN_REACT.cycle[T0.reactI]; d.status = {};
      d.status[k] = k === 'freeze' || k === 'crack' ? TRAIN_REACT.every : { t: TRAIN_REACT.every, dps: 0 };
      floatText(w, d.x, d.y - 68, word, col, 8);   // (above its name plate)
    }
    T0.reacts = titleStat(GAME.profile, 'reactions') - (T0.react0 || 0);
    return r;
  };
}
// The arena (training and duels) draws its own HUD and never reaches drawTitleFx, where the reaction chips are drawn in the
// world (elemreact.js); so they are drawn here, once a frame, after the left-hand HUD.
{
  const dh = drawHUD;
  drawHUD = (a, side, now, label) => { const r = dh(a, side, now, label); if (side === 0 && window.GAME && GAME.scene === 'arena') { if (typeof drawReactIcons === 'function') drawReactIcons(GAME, now); if (GAME.arena && GAME.arena.training && typeof drawAimMark === 'function') drawAimMark(GAME, now); } return r; };   // (and the aim mark at the dummy, aimmark.js)
}
// THE CHAINS DRILL: the dummy just stands there while you practise card chains (cardchain.js); the panel counts the chain
// finishes you land in it (from your own chainFinish stat).
DRILLS.push({ id: 'chains', name: 'CHAINS' });
{
  const tt = trainingTick;
  trainingTick = (w, dt) => {
    const r = tt(w, dt), T0 = w.train; if (!T0) return r;
    if (DRILLS[T0.drill].id !== 'chains') { T0.chainOn = false; return r; }
    if (!T0.chainOn) { T0.chainOn = true; T0.chain0 = titleStat(GAME.profile, 'chainFinish'); }
    T0.chainsDone = titleStat(GAME.profile, 'chainFinish') - (T0.chain0 || 0);
    return r;
  };
}
