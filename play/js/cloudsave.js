'use strict';
// ONLINE BACKUP (2026-11-20; the user said "next" after the update notice, the third thing on the list of what the game was missing).
// On the website and in the phone app the hero lives only on that one device, so clearing the browser or losing the phone
// lost them. Now the game keeps a copy on the public game server (tools/serve.py /cloud/save) under this device's private
// BACKUP CODE (16 letters, made once and kept in localStorage): at most every 5 minutes while you play, at once on Save & Exit,
// and when the app goes to the background. Esc ▸ SETTINGS ▸ ONLINE BACKUP shows the code (keep it somewhere safe); typing
// another code there brings that hero to this device (the hero here is kept as a local backup first) and this device then
// carries on backing up under that code. Only with a public game server (window.ZCH_STATIC + srvBase): on the home PC the
// disk copy in saves/ already does this job.
const CLOUDSAVE = { key: 'zch_cloud_key', last: 'zch_cloud_last', every: 300000, abc: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' };
const cloudOn = () => !!(window.ZCH_STATIC && typeof srvBase === 'function' && srvBase());
const cloudFmt = c => String(c || '').replace(/(.{4})(?=.)/g, '$1-');   // ABCD-EFGH-JKLM-NPQR
function cloudKey() {
  let k = null; try { k = localStorage.getItem(CLOUDSAVE.key); } catch (e) {}
  if (k && /^[A-Z2-9]{16}$/.test(k)) return k;
  const r = new Uint32Array(16); crypto.getRandomValues(r);
  k = Array.from(r, n => CLOUDSAVE.abc[n % CLOUDSAVE.abc.length]).join('');   // (32 letters: 2^32 divides evenly, so every letter is as likely)
  try { localStorage.setItem(CLOUDSAVE.key, k); } catch (e) {}
  return k;
}
const cloudLast = () => { try { return JSON.parse(localStorage.getItem(CLOUDSAVE.last) || 'null'); } catch (e) { return null; } };
let cloudSent = '', cloudAt = 0, cloudBusy = false;
// send the hero now (keepalive: still goes out while the app is being put away); quiet unless asked to report
function cloudBackup(pr, report, keepalive) {
  if (!cloudOn() || !sfOk(pr) || cloudBusy) return;
  const body = JSON.stringify(pr); if (body === cloudSent && !report) return;
  cloudBusy = true; cloudAt = Date.now();
  fetch(srvUrl('cloud/save?k=' + cloudKey()), { method: 'POST', body, keepalive: !!keepalive && body.length < 60000 })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => { cloudSent = body; try { localStorage.setItem(CLOUDSAVE.last, JSON.stringify({ at: j.at || Date.now(), lv: pr.lv, name: (pr.look && pr.look.name) || 'Hero' })); } catch (e) {}
      if (report) GAME.toast(`Backed up online: ${(pr.look && pr.look.name) || 'your hero'}, Lv ${pr.lv}`, '#8fffb0'); })
    .catch(() => { if (report) GAME.toast('Could not reach the game server for the backup', '#ff8a8a'); })
    .finally(() => { cloudBusy = false; });
}
// every save may send one (at most every 5 minutes); Save & Exit and going to the background send one at once
{ const sg = saveGame; saveGame = s => { sg(s); try { if (Date.now() - cloudAt > CLOUDSAVE.every) cloudBackup(s); } catch (e) {} }; }
{ const bt = game.backToTitle; game.backToTitle = function (...a) { try { cloudBackup(this.saved || this.profile, false, true); } catch (e) {} return bt.apply(this, a); }; }
addEventListener('visibilitychange', () => { if (document.hidden && window.GAME && GAME.profile) try { cloudBackup(GAME.profile, false, true); } catch (e) {} });
function cloudRow() {
  if (!cloudOn()) return GAME.toast('Online backup is for the website and the phone app: here, your hero is already kept on this PC (saves folder)', '#ffd27a');
  const mine = cloudKey(), pr = GAME.profile || GAME.saved;
  const typed = prompt(`Your hero is backed up online under this BACKUP CODE. Keep it somewhere safe (write it down or copy it).\n\n` +
    `To bring a hero here from another device, type that device's code instead and press OK.`, cloudFmt(mine));
  if (typed == null) return;
  const code = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code || code === mine) { if (sfOk(pr)) cloudBackup(pr, true); else GAME.toast('No hero to back up yet', '#c9c1a8'); return; }
  if (!/^[A-Z2-9]{16}$/.test(code)) return GAME.toast('A backup code is 16 letters and numbers, like ABCD-EFGH-JKLM-NPQR', '#ff8a8a');
  fetch(srvUrl('cloud/save?k=' + code)).then(r => (r.ok ? r.json() : null)).then(p => {
    if (!sfOk(p)) return GAME.toast('No backup found for that code', '#ff8a8a');
    const before = GAME.save;
    sfUse(p, 'online backup');
    if (GAME.save !== before) { try { localStorage.setItem(CLOUDSAVE.key, code); localStorage.removeItem(CLOUDSAVE.last); } catch (e) {} }   // (sfUse switched saving off: the hero is coming, so this device now backs up under that code)
  }).catch(() => GAME.toast('Could not reach the game server', '#ff8a8a'));
}
{ const i = SET_ROWS.findIndex(r => r.id === 'backup');
  SET_ROWS.splice(i < 0 ? SET_ROWS.length : i + 1, 0, { id: 'cloud', name: 'ONLINE BACKUP', steps: null,
    label: () => { if (!cloudOn()) return 'Website and phone app'; const L = cloudLast(); return L ? `Lv ${L.lv} · ${sfAgo(L.at)}  (code)` : 'Not yet  (code)'; }, act: () => cloudRow() }); }
