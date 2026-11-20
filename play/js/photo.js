'use strict';
// PHOTO (F2): a keepsake of the world as it looks right now, without the HUD, menus, name tags or toasts. Just the world, its
// day/night light and the weather. The picture goes to the game folder's photos/ through the local server (tools/serve.py
// /photo, this computer only); anywhere else (a phone guest, or a server without the route) the browser downloads it instead.
// A soft white flash and a little music-box shutter (sfx.js photo) say it was taken.
const PHOTO = { want: false, flashAt: 0, flash: 280, peak: 0.3, q: 0.92 };
addEventListener('keydown', e => {
  if (e.code !== 'F2' || e.repeat) return;
  e.preventDefault();
  const G = window.GAME; if (G && G.scene === 'world' && G.world && !G.menu) PHOTO.want = true;
});
function photoName() { const d = new Date(), z = n => String(n).padStart(2, '0'); return `zenonia_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.jpg`; }
// each kept photo counts in pr.stats.photos (the session recap shows it), and a scenic shot's file remembers its landmark
// (pr.photoCaps, the newest 200) for the album's large view
function photoNote(G, name, caption) {
  const pr = G.profile; if (!pr || (G.net && G.net.role === 'guest')) return;
  (pr.stats = pr.stats || {}).photos = (pr.stats.photos || 0) + 1;
  if (caption) { const C = pr.photoCaps = pr.photoCaps || {}; C[name] = caption; const k = Object.keys(C); if (k.length > 200) for (const x of k.sort().slice(0, k.length - 200)) delete C[x]; }
  G.save();
}
function photoKeep(blob, caption) {
  const G = window.GAME;
  const download = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = photoName(); photoNote(G, a.download, caption);
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    G.toast('Photo downloaded', '#e8f4ff');
  };
  fetch('photo', { method: 'POST', body: blob }).then(r => (r.ok ? r.text() : Promise.reject(r.status)))
    .then(name => { photoNote(G, name, caption); G.toast(`Photo saved: photos/${name}`, '#e8f4ff'); }).catch(download);
}
// the world alone, drawn just before the real frame (which then paints over it, so you never see the bare world)
function photoTake(now) {
  const G = window.GAME, w = G.world;
  const cam = cameraFor(w, (G.net && typeof netSpectateTarget === 'function' && netSpectateTarget(G, w)) || (typeof coopOn === 'function' && coopOn(G) ? coopCamTarget(w) : w.player));
  ctx.fillStyle = '#0c0f16'; ctx.fillRect(0, 0, VW, VH);
  w.showTags = false;   // (no name tags; drawScene sets them back)
  const radar = typeof drawRadar === 'function' ? drawRadar : null;   // (the hunting radar, radar.js, is HUD too: left out of the picture)
  if (radar) drawRadar = () => {};
  // no writing in the picture either: prompts ("Enter: …"), NPC and landmark labels, floating numbers. The world draws them
  // through these helpers, which are quiet for this one draw.
  const T0 = text, G0 = goldText, F0 = ctx.fillText, quiet = () => {};
  text = quiet; goldText = quiet; ctx.fillText = quiet;
  try { drawWorld(w, cam, w.bg, now); drawDayNight(w, cam, now); drawWeather(w, now); }
  finally { if (radar) drawRadar = radar; text = T0; goldText = G0; ctx.fillText = F0; }
  let caption = null; try { caption = scenicShot(G, w, cam); } catch (e) {}
  ctx.canvas.toBlob(b => { if (b) photoKeep(b, caption); else G.toast('The photo could not be taken', '#ff8a8a'); }, 'image/jpeg', PHOTO.q);   // (toBlob copies the picture now)
  PHOTO.flashAt = performance.now();
  if (typeof SFX !== 'undefined' && SFX.photo) SFX.photo();
}
// SCENIC SHOTS: a photo with a landmark (landmarks.js) well inside the frame counts it once (pr.shots), for a little EXP and a
// summon coin. The album shows how many you have. Your own game only: a co-op guest's photos are just photos.
const SCENIC = { exp: 0.05, coins: 1, margin: 0.12 };
const scenicCount = (pr, w) => { const s = pr.shots || {}; return { got: Object.keys(s).length, of: w && w.landmarks ? w.landmarks.length : 0 }; };
function scenicShot(G, w, cam) {
  const pr = G.profile; if (!pr || !w.landmarks || !w.landmarks.length || (G.net && G.net.role === 'guest')) return;
  const mx = WVW * SCENIC.margin, my = WVH * SCENIC.margin, shots = pr.shots || (pr.shots = {});
  const L = w.landmarks.find(L => !shots[L.key] && L.x > cam.x + mx && L.x < cam.x + WVW - mx && L.y > cam.y + my && L.y < cam.y + WVH - my);
  if (!L) return;
  shots[L.key] = Date.now();
  G.gainExp(Math.round(expNeed(pr.lv || 1) * SCENIC.exp)); pr.coins = (pr.coins || 0) + SCENIC.coins;
  const c = scenicCount(pr, w);
  G.toast(`Scenic shot: ${L.name} (${c.got} of ${c.of}) · +${SCENIC.coins} summon coin`, '#ffd0e8'); G.save();
  return L.name;
}
{
  const ds = drawScene;
  drawScene = now => {
    const G = window.GAME;
    if (PHOTO.want) { PHOTO.want = false; if (G && G.scene === 'world' && G.world && !G.menu) try { photoTake(now); } catch (e) { G.toast('The photo could not be taken', '#ff8a8a'); } }
    return ds(now);
  };
  const dt = drawToasts;
  drawToasts = (...a) => {
    const G = window.GAME; if (G && G.menu && G.menu.type === 'pause' && G.menu.view === 'album') return;   // (toasts wait while you look at your photos, then show)
    const r = dt(...a), k =(performance.now() - PHOTO.flashAt) / PHOTO.flash;
    if (PHOTO.flashAt && k < 1) { ctx.save(); ctx.globalAlpha = PHOTO.peak * (1 - k) * (1 - k); ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
    return r;
  };
}
// ALBUM (Esc > JOURNAL > ALBUM): your photos inside the game, the newest first. A grid of twelve at a time; arrows move, Enter shows one large
// (left and right flip through them there), Esc goes back. The list comes from tools/serve.py /photo/list, the pictures are the files.
const ALBUM = { cols: 4, rows: 3, tw: 112, th: 63, gap: 10, imgs: new Map() };
PAUSE_OPTS.splice(PAUSE_OPTS.findIndex(o => o.id === 'hub'), 0, { id: 'album', title: 'ALBUM', sub: 'Your photos (F2 takes one)', col: '#ffd0e8' });
function albumImg(name) {
  let im = ALBUM.imgs.get(name);
  if (!im) { im = new Image(); im.src = 'photos/' + encodeURIComponent(name); ALBUM.imgs.set(name, im); }
  return im.complete && im.naturalWidth ? im : null;
}
const albumFav = (game, name) => !!(game.profile && game.profile.photoFav && game.profile.photoFav[name]);
function albumWhen(name) { const m = /_(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)/.exec(name); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : name; }
const albumCamBtn = () => ({ x: VW / 2 - 60, y: 52, w: 120, h: 16 });   // TAKE A PHOTO (pick -1): for touch and gamepad, which have no F2
function albumGrid() { const G = ALBUM, W = G.cols * G.tw + (G.cols - 1) * G.gap, x0 = VW / 2 - W / 2, y0 = 82; return { x0, y0, cell: i => { const j = i % (G.cols * G.rows); return { x: x0 + (j % G.cols) * (G.tw + G.gap), y: y0 + Math.floor(j / G.cols) * (G.th + G.gap + 8) }; } }; }
{
  const up = updatePause;
  updatePause = (game, m, dt) => {
    if (m.view === 'album') {
      m.t += dt; const k = navInput(), list = m.album || [], n = list.length, per = ALBUM.cols * ALBUM.rows;
      if (m.big) {
        if (n && k.l) m.pick = (m.pick + n - 1) % n;
        if (n && k.r) m.pick = (m.pick + 1) % n;
        if (n && k.u && game.profile) {   // FAVOURITES: a heart on the photo (pr.photoFav), kept with your hero (up only: F is also a confirm key)
          const F = game.profile.photoFav = game.profile.photoFav || {}, nm = m.album[m.pick];
          if (F[nm]) delete F[nm]; else F[nm] = Date.now();
          if (typeof SFX !== 'undefined' && SFX.photo && F[nm]) SFX.photo(); game.save();
        }
        if ((k.back || k.ok || clicked(0, 0, VW, VH)) && m.t > 120) { m.big = false; m.t = 0; }
        return;
      }
      const CB = albumCamBtn(); if (clicked(CB.x, CB.y, CB.w, CB.h)) { if (m.pick === -1) k.ok = true; m.pick = -1; }
      if (m.pick === -1) {
        if (n && (k.d || k.r)) m.pick = 0;
        if (k.ok && m.t > 120) { m.view = null; game.closeMenu(); PHOTO.want = true; return; }   // (the menu closes and the next frame is the picture)
      } else if (n) {
        if (k.l) m.pick = Math.max(0, m.pick - 1); if (k.r) m.pick = Math.min(n - 1, m.pick + 1);
        if (k.u) m.pick = m.pick % per < ALBUM.cols ? -1 : m.pick - ALBUM.cols; if (k.d) m.pick = Math.min(n - 1, m.pick + ALBUM.cols);
        const Gd = albumGrid(), page = Math.floor(Math.max(0, m.pick) / per) * per;
        for (let i = page; i < Math.min(n, page + per); i++) { const c = Gd.cell(i); if (clicked(c.x, c.y, ALBUM.tw, ALBUM.th)) { if (m.pick === i) k.ok = true; m.pick = i; } }
        if (k.ok && m.pick >= 0 && m.t > 120) { m.big = true; m.t = 0; return; }
      }
      if (k.back && m.t > 120) { m.view = null; m.t = 0; }
      return;
    }
    const i = PAUSE_OPTS.findIndex(o => o.id === 'album'), B = PAUSE_BTN(i), k = navInput();
    if (m.cur === i && (k.ok || clicked(B.x, B.y, B.w, B.h)) && !m.view) {
      m.view = 'album'; m.t = 0; m.pick = 0; m.big = false; m.album = null;
      fetch('photo/list').then(r => (r.ok ? r.json() : [])).then(l => { m.album = Array.isArray(l) ? l : []; if (!m.album.length) m.pick = -1; }).catch(() => { m.album = []; m.pick = -1; });
      return;
    }
    return up(game, m, dt);
  };
  const dp = drawPause;
  drawPause = (game, m, now) => {
    dp(game, m, now);
    if (m.view !== 'album') return;
    ctx.fillStyle = '#0c0814'; ctx.fillRect(0, 0, VW, VH);
    const list = m.album, n = list ? list.length : 0, per = ALBUM.cols * ALBUM.rows;
    if (m.big && n && m.pick >= 0) {
      const name = list[m.pick], im = albumImg(name), W = 528, H = 297, x = VW / 2 - W / 2, y = 22;
      if (im) ctx.drawImage(im, x, y, W, H); else text('Loading…', VW / 2, y + H / 2, '#9a917c', 8);
      ctx.strokeStyle = goldFrameGrad(y, H); ctx.lineWidth = 1.2; ctx.strokeRect(x - 0.5, y - 0.5, W + 1, H + 1);
      const cap = game.profile && game.profile.photoCaps && game.profile.photoCaps[name], fav = albumFav(game, name);
      if (fav) { ctx.fillStyle = 'rgba(16,10,24,0.75)'; rrect(ctx, x + W - 26, y + 6, 20, 16, 4); ctx.fill(); text('♥', x + W - 16, y + 14.5, '#ff8fc0', 10); }
      text(`${fav ? '♥ ' : ''}${cap ? `Scenic shot: ${cap}   ·   ` : ''}${albumWhen(name)}   ·   ${m.pick + 1} / ${n}`, VW / 2, y + H + 14, cap || fav ? '#ffd0e8' : '#e8e2cf', 7.5);
      text(`← → flip through · ↑: ${fav ? 'remove the heart' : '♥ favourite'} · Enter or Esc: back to the album`, VW / 2, y + H + 27, '#b8ae96', 7);
      return;
    }
    goldText('ALBUM', VW / 2, 30, 16, { spacing: 4 });
    if (!list) { text('Loading…', VW / 2, VH / 2, '#9a917c', 8); return; }
    const CB = albumCamBtn(), con = m.pick === -1;
    panel(CB.x, CB.y, CB.w, CB.h, con ? '#ffd0e8' : 'rgba(201,168,90,0.55)', con ? 'rgba(48,30,56,0.96)' : 'rgba(18,14,30,0.92)');
    text('TAKE A PHOTO', CB.x + CB.w / 2, CB.y + CB.h / 2 + 0.5, con ? '#ffd0e8' : '#e8e2cf', 7.5);
    if (!n) { text('No photos yet. Take one here, or press F2 anywhere in the world.', VW / 2, VH / 2, '#e8e2cf', 8); text('Enter: take a photo · Esc: back', VW / 2, VH - 24, '#b8ae96', 7); return; }
    const SC = game.profile && game.world && game.world.landmarks ? scenicCount(game.profile, game.world) : null;
    const nf = list.filter(nm => albumFav(game, nm)).length;
    text(`${n} photo${n === 1 ? '' : 's'}${nf ? `   ·   ♥ ${nf}` : ''}${SC && SC.of ? `   ·   scenic shots ${SC.got} of ${SC.of}` : ''}${n > per ? `   ·   page ${Math.floor(Math.max(0, m.pick) / per) + 1} of ${Math.ceil(n / per)}` : ''}`, VW / 2, 44, '#d8d0e4', 7);
    const Gd = albumGrid(), page = Math.floor(Math.max(0, m.pick) / per) * per;
    for (let i = page; i < Math.min(n, page + per); i++) {
      const c = Gd.cell(i), im = albumImg(list[i]), on = i === m.pick;
      ctx.fillStyle = '#1a1228'; ctx.fillRect(c.x, c.y, ALBUM.tw, ALBUM.th);
      if (im) ctx.drawImage(im, c.x, c.y, ALBUM.tw, ALBUM.th);
      ctx.strokeStyle = on ? '#ffd0e8' : 'rgba(201,168,90,0.5)'; ctx.lineWidth = on ? 1.6 : 0.8; ctx.strokeRect(c.x - 0.5, c.y - 0.5, ALBUM.tw + 1, ALBUM.th + 1);
      if (albumFav(game, list[i])) { ctx.fillStyle = 'rgba(16,10,24,0.75)'; ctx.fillRect(c.x + ALBUM.tw - 13, c.y + 2, 11, 10); text('♥', c.x + ALBUM.tw - 7.5, c.y + 7.5, '#ff8fc0', 7); }
      if (on) text(albumWhen(list[i]), c.x + ALBUM.tw / 2, c.y + ALBUM.th + 8, '#ffd0e8', 7);
    }
    text('Arrows: choose (up for the camera) · Enter: view large · Esc: back   ·   files: the photos folder', VW / 2, VH - 16, '#b8ae96', 7);
  };
}
// the first landmark you discover brings one hint about scenic shots (and follows Esc > SETTINGS > TIPS)
{
  const lt = landmarkTick;
  landmarkTick = (game, w) => {
    const pr = game.profile, n0 = pr && pr.landmarks ? Object.keys(pr.landmarks).length : 0, r = lt(game, w);
    if (pr && !pr.scenicHint && pr.landmarks && Object.keys(pr.landmarks).length > n0 && !(game.net && game.net.role === 'guest')) {
      pr.scenicHint = true; if (typeof tipsOn !== 'function' || tipsOn()) game.toast('Press F2 to photograph it: a landmark in a photo is a scenic shot (+1 summon coin)', '#ffd0e8');
    }
    return r;
  };
}
