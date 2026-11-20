'use strict';
// UPDATE READY (2026-11-20; the user picked "update notice"): the phone app is installed by hand from the website, so it never
// learns that a newer APK is out. When the app opens it reads the website's version.json (tools/build_site.py: the build tag the
// newest APK was made from) and, if that is newer than its own window.ZCH_BUILD (tools/build_release.py), shows one calm card
// in the title screen's top-right corner: DOWNLOAD opens the APK in the phone's browser (Capacitor sends any outside address to the browser),
// LATER hides it until an even newer one comes out. Only in the phone app: the website's game is always the newest already.
const APPUP = { later: 'zch_update_later', css: 'position:fixed;right:max(12px, env(safe-area-inset-right));top:max(10px, env(safe-area-inset-top));z-index:9;' +
  'display:flex;align-items:center;gap:10px;padding:10px 12px 10px 16px;border-radius:12px;border:1.5px solid #d8a850;background:rgba(18,12,8,0.94);' +
  'box-shadow:0 4px 18px rgba(0,0,0,0.55);font:600 14px "Fredoka","Trebuchet MS",system-ui,sans-serif;color:#fff4d8;max-width:calc(100vw - 32px);' +
  'transition:opacity 0.6s ease;opacity:0;' };
const appIsNative = () => !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
// is build tag a newer than b? Tags are VERSION-YYYYMMDDhhmmss, so the time part orders them (a version alone counts as oldest)
function appBuildNewer(a, b) {
  const t = s => { const m = /-(\d{14})$/.exec(String(s || '')); return m ? m[1] : '0'; };
  return t(a) > t(b);
}
function appUpdateCard(info) {
  if (document.getElementById('appUpdate')) return;
  const box = document.createElement('div'); box.id = 'appUpdate'; box.style.cssText = APPUP.css;
  const msg = document.createElement('span'); msg.textContent = `New version ready${info.mb ? ` · ${info.mb} MB` : ''}`; msg.style.whiteSpace = 'nowrap';
  const btn = (txt, bg, fg) => { const b = document.createElement('button'); b.textContent = txt;
    b.style.cssText = `font:inherit;font-size:13px;padding:7px 12px;border-radius:9px;border:1px solid #d8a850;background:${bg};color:${fg};cursor:pointer;white-space:nowrap;`; return b; };
  const get = btn('DOWNLOAD', '#6a4a1a', '#ffe9a8'), later = btn('Later', 'transparent', '#c9c1a8');
  const close = () => { box.style.opacity = '0'; setTimeout(() => box.remove(), 650); };
  get.addEventListener('click', e => { e.stopPropagation(); location.href = window.ZCH_SITE + (info.apk || 'zenonia-card-hunters.apk'); close(); });
  later.addEventListener('click', e => { e.stopPropagation(); try { localStorage.setItem(APPUP.later, info.apk_build); } catch (er) {} close(); });
  for (const el of [box, get, later]) el.addEventListener('pointerdown', e => e.stopPropagation());   // (a tap on the card is not a tap on the game)
  box.append(msg, get, later); document.body.appendChild(box);
  setTimeout(() => { box.style.opacity = '1'; }, 30);
  // only on the title screen: once you are playing it steps aside (it comes back the next time the app opens)
  const watch = setInterval(() => { const G = window.GAME; if (G && G.scene && G.scene !== 'title') { clearInterval(watch); close(); } }, 1000);
}
async function appUpdateCheck(force) {
  if (!force && !appIsNative()) return null;
  if (!window.ZCH_SITE || !window.ZCH_BUILD) return null;
  let info = null;
  try { info = await (await fetch(`${window.ZCH_SITE}version.json?t=${Date.now()}`, { cache: 'no-store' })).json(); } catch (e) { return null; }
  if (!info || !info.apk_build || !appBuildNewer(info.apk_build, window.ZCH_BUILD)) return info;
  let later = null; try { later = localStorage.getItem(APPUP.later); } catch (e) {}
  if (later === info.apk_build && !force) return info;
  appUpdateCard(info);
  return info;
}
setTimeout(() => appUpdateCheck(false), 4000);   // (after the title screen is up; a slow or missing answer just means no card)
