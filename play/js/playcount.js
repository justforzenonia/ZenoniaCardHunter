'use strict';
// PLAYER COUNT (2026-11-20; the user: "next", the last idea on the list): so the user can see whether anyone plays. The website's
// game and the phone app say hello to the public game server once each time they start (tools/serve.py /stats/hello), with a
// random id made on this device and kept in localStorage: not the hero, not the save, nothing about the player. The server only
// counts different ids per day (/stats shows the totals). Not on the PC's own server.
const PLAYCOUNT = { key: 'zch_device', delay: 8000 };
setTimeout(() => {
  try {
    if (!window.ZCH_STATIC || typeof srvBase !== 'function' || !/^https:/i.test(srvBase())) return;
    if (navigator.webdriver) return;   // (an automated browser, like tools/smoke_test.js, is not a player)
    let d = null; try { d = localStorage.getItem(PLAYCOUNT.key); } catch (e) {}
    if (!d || !/^[A-Za-z0-9]{12,40}$/.test(d)) {
      const r = new Uint32Array(4); crypto.getRandomValues(r); d = Array.from(r, n => n.toString(36).padStart(7, '0')).join('').slice(0, 24);
      try { localStorage.setItem(PLAYCOUNT.key, d); } catch (e) {}
    }
    const p = typeof appIsNative === 'function' && appIsNative() ? 'app' : 'web';
    fetch(srvUrl(`stats/hello?d=${d}&p=${p}`), { method: 'POST' }).catch(() => {});
  } catch (e) {}
}, PLAYCOUNT.delay);
