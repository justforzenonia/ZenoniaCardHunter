'use strict';
// STATIC HOSTING (2026-11-08, release prep): the release build (tools/build_release.py) can be put on any plain web host
// (itch.io, GitHub Pages…), which has none of tools/serve.py's extras: online co-op rooms (/net/…), the disk copy of the save
// (/save) and hero codes (/save/share). The build sets window.ZCH_STATIC, and then those features say so kindly instead of
// failing. With the home server (python tools/serve.py) everything works as always; without the flag this file does nothing.
// (2026-11-19: with a game server known, co-op and hero codes work there: the public server the build names in
// window.ZCH_SERVER (the user's website), or a GAME SERVER set in SETTINGS. The disk copy of the save stays off: it is per PC.)
// (2026-11-20) a free public server sleeps when nobody has called for a while and takes up to a minute to wake: the game
// pokes it as soon as it loads, so it is awake by the time you open co-op, the market or hero codes
if (typeof srvBase === 'function' && /^https:/i.test(srvBase())) { try { fetch(srvUrl('health'), { cache: 'no-store' }).catch(() => {}); } catch (e) {} }
if (window.ZCH_STATIC) {
  const why = 'needs a game server (SETTINGS > GAME SERVER)';
  const srv = () => typeof srvBase === 'function' && !!srvBase();
  diskSave = () => {};
  { const hc = hubChoose; hubChoose = (game, id) => { if (id === 'online' && !srv()) { game.toast(`Online co-op ${why}`, '#ffd27a'); return; } return hc(game, id); }; }
  { const sh = setSendHero, gh = setGetHero;
    setSendHero = () => (srv() ? sh() : GAME.toast(`Sending a hero ${why}`, '#ffd27a'));
    setGetHero = () => (srv() ? gh() : GAME.toast(`Getting a hero ${why}`, '#ffd27a')); }
}
