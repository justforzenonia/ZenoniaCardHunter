'use strict';
// WEAPON LOOK (the Stylist): a weapon's art follows its tier (defs.js g.look, 0-9). The Weapon look row lets you show any weapon
// art you have reached so far: "Match your weapon" (look.wart = null, the default), or Look 1 … up to the best one you have
// ever wielded (pr.wartMax, kept up to date whenever your hero is built). It only changes the picture, never the stats.
// Classes without a weapon sheet (the orb, tome and fist fighters, the Chef's pan, the Archer's bow, the monster knight) get no row.
function weaponLookOk(cls) { const C = CLASSES[cls]; return !!C && !C.focus && !C.fist && !C.sheet && !C.bank && !C.mon && !!(D.classes[C.sprite] || {}).weapons; }
function weaponLookCount(cls) { const C = CLASSES[cls], S = C && D.classes[C.sprite]; return S && S.weapons ? S.weapons.length : 0; }
function weaponLookMax(pr) {
  if (!pr) return 0;
  const now = profileStats(pr).look || 0; pr.wartMax = Math.max(pr.wartMax || 0, now);
  return Math.min(pr.wartMax, Math.max(0, weaponLookCount(pr.cls) - 1));
}
// the weapon art the preview shows: your pick, else the weapon you carry (a new hero: a fine one, to show off the class)
function customWlook(game, m) {
  const pr = game && game.profile;
  if (!m.edit || !pr) return 3;
  return m.wart != null ? m.wart : profileStats(pr).look || 0;
}
function weaponLookStep(game, m, d) {
  const max = weaponLookMax(game.profile), L = [null, ...Array.from({ length: max + 1 }, (_, i) => i)], i = L.indexOf(m.wart != null ? m.wart : null);
  m.wart = L[((i < 0 ? 0 : i) + d + L.length) % L.length];
}
function drawWeaponLookRow(game, m, y, on) {
  const max = weaponLookMax(game.profile);
  panel(CUS.sx, y - 2, 200, 20, on ? '#ffd23f' : '#5a5040', 'rgba(20,13,8,0.95)');
  text('◀', CUS.sx + 9, y + 8, '#ffd23f', 8); text('▶', CUS.sx + 191, y + 8, '#ffd23f', 8);
  text(m.wart == null ? '(match your weapon)' : `Weapon art ${m.wart + 1}`, CUS.sx + 100, y + 8, m.wart == null ? '#b8ae96' : '#ffffff', 9);
  text(`${max + 1} reached`, CUS.sx + 206, y + 8, '#c9c1a8', 7, 'left');
}
{
  const uc = updateCustom;   // the row's arrows by mouse
  updateCustom = (game, m, dt) => {
    const r = customRows(m).indexOf('wart');
    if (r >= 0) { const y = cusY(r); if (clicked(CUS.sx, y - 2, 18, 20)) { m.row = r; weaponLookStep(game, m, -1); mouse.click = false; } else if (clicked(CUS.sx + 182, y - 2, 18, 20)) { m.row = r; weaponLookStep(game, m, 1); mouse.click = false; } }
    return uc(game, m, dt);
  };
  const mp = makePlayerActor;   // your hero in the world (and a friend's in co-op) shows the chosen art, never one beyond what they reached
  makePlayerActor = (profile, team, x, y) => {
    const a = mp(profile, team, x, y), w = profile && profile.look && profile.look.wart;
    if (w != null && weaponLookOk(profile.cls) && w <= weaponLookMax(profile)) a.banks = playerBanks(profile.cls, profile.look, w);
    else if (profile) weaponLookMax(profile);   // (keep the record of the best weapon art you have reached)
    return a;
  };
}
