'use strict';
// SAVE FILES AND BACKUPS (2026-11-08, before release): a browser can lose its storage (it has happened), and the disk copy
// (main.js diskSave) only exists with the local tools server. So:
//   EXPORT SAVE    (Esc ▸ SETTINGS) downloads your hero as a small .json file to keep anywhere
//   IMPORT SAVE    loads a hero from such a file (it asks first; the hero you had is kept as a backup)
//   RESTORE BACKUP the browser keeps three rolling backups (a new one at most every 10 minutes of saving); this brings back
//                  the newest one. At start-up, a save that can't be read falls back to the newest good backup (main.js safeLoad).
// Backups live in localStorage 'zch_backups' as [{ at, lv, name, data }], newest first.
const SAVEFILE = { key: 'zch_backups', keep: 3, every: 600000 };
const sfBackups = () => { try { const L = JSON.parse(localStorage.getItem(SAVEFILE.key) || '[]'); return Array.isArray(L) ? L : []; } catch (e) { return []; } };
const sfOk = p => p && typeof p === 'object' && p.lv && Array.isArray(p.gear);
function sfBackup(pr, force) {
  if (!sfOk(pr)) return;
  const L = sfBackups(); if (!force && L[0] && Date.now() - L[0].at < SAVEFILE.every) return;
  L.unshift({ at: Date.now(), lv: pr.lv, name: (pr.look && pr.look.name) || 'Hero', data: JSON.stringify(pr) });
  while (L.length > SAVEFILE.keep) L.pop();
  try { localStorage.setItem(SAVEFILE.key, JSON.stringify(L)); } catch (e) { try { L.length = 1; localStorage.setItem(SAVEFILE.key, JSON.stringify(L)); } catch (e2) {} }   // (short on space: keep just the newest)
}
// every real save may also make a backup (a co-op guest's or a test's stubbed save never reaches saveGame through here)
{ const sg = saveGame; saveGame = s => { sg(s); try { sfBackup(s); } catch (e) {} }; }
const sfAgo = at => { const m = Math.round((Date.now() - at) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
function sfExport() {
  const pr = GAME.profile || GAME.saved; if (!sfOk(pr)) { GAME.toast('No hero to export yet', '#c9c1a8'); return; }
  if (GAME.profile) GAME.save();
  const name = ((pr.look && pr.look.name) || 'hero').replace(/[^a-z0-9]+/gi, '_'), d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ zenoniaSave: 1, at: Date.now(), profile: pr })], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `zenonia_${name}_lv${pr.lv}_${stamp}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  GAME.toast(`Saved ${a.download}: keep it somewhere safe`, '#8fffb0');
}
// put a hero in place and restart into the title (CONTINUE picks it up); the hero you had is backed up first
function sfUse(p, what) {
  let m; try { m = migrateProfile(JSON.parse(JSON.stringify(p))); } catch (e) { m = null; }
  if (!sfOk(m)) { GAME.toast(`That ${what} can't be read`, '#ff8a8a'); return; }
  const cur = GAME.profile || GAME.saved; if (sfOk(cur)) sfBackup(cur, true);
  if (!confirm(`Load ${(m.look && m.look.name) || 'this hero'} (Lv ${m.lv}) from the ${what}?\nThe hero you have now is kept as a backup.`)) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(m)); } catch (e) { GAME.toast('The browser would not store it', '#ff8a8a'); return; }
  if (typeof diskSave === 'function') try { diskSave(m); } catch (e) {}
  GAME.save = () => {};   // (the hero in play must not write over it while the page reloads)
  setTimeout(() => location.reload(), 300);
}
function sfImport() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > 8e6) { GAME.toast('That file is too big to be a save', '#ff8a8a'); return; }
    f.text().then(s => { let j; try { j = JSON.parse(s); } catch (e) { j = null; } sfUse(j && j.profile ? j.profile : j, 'save file'); });
  };
  inp.click();
}
function sfRestore() {
  const L = sfBackups(); if (!L.length) { GAME.toast('No backups yet: one is made as you play', '#c9c1a8'); return; }
  let p; try { p = JSON.parse(L[0].data); } catch (e) { p = null; }
  sfUse(p, `backup from ${sfAgo(L[0].at)}`);
}
SET_ROWS.push(
  { id: 'export', name: 'EXPORT SAVE', steps: null, label: () => 'Download a save file', act: () => sfExport() },
  { id: 'import', name: 'IMPORT SAVE', steps: null, label: () => 'Load a save file', act: () => sfImport() },
  { id: 'backup', name: 'RESTORE BACKUP', steps: null, label: () => { const L = sfBackups(); return L.length ? `Lv ${L[0].lv} · ${sfAgo(L[0].at)}` : 'None yet'; }, act: () => sfRestore() },
);
