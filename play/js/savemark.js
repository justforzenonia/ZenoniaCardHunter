'use strict';
// SAVE MARK: the disk copy (main.js diskSave) is what brought heroes back after app restarts, so you should know it is working.
// A quiet "✓ saved" shows in the corner for a moment the first time the disk copy lands each session, and then at most once every
// 5 minutes. If it fails twice in a row (the game server stopped), a small amber note stays in the corner until it works again,
// then "✓ disk copy back" shows once. Only for your own game: a co-op guest and the test tools never write the disk copy.
const SAVEMARK = { every: 300000, show: 1600, failAfter: 2, shownAt: 0, seenOk: 0, wasFailing: false, backAt: 0 };
function saveMarkPill(x, y, w) { ctx.fillStyle = 'rgba(22,15,9,0.78)'; rrect(ctx, x - 5, y - 7, w + 10, 14, 4); ctx.fill(); }
function saveMarkDraw(now) {
  if (!GAME.profile || typeof DISK === 'undefined') return;
  const t = Date.now(), x = 8, y = VH - 8;   // (bottom left: the key hints and the Menu button use the bottom right)
  const failing = (DISK.fails || 0) >= SAVEMARK.failAfter;
  if (failing) {
    SAVEMARK.wasFailing = true;
    ctx.save(); ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now / 500); saveMarkPill(x, y, 196);   // (a dark backing: pale text on grass was hard to read)
    text('⚠ disk copy not saving · game server off?', x, y, '#ffc46b', 7.5, 'left');
    ctx.restore(); return;
  }
  if (DISK.okAt && DISK.okAt !== SAVEMARK.seenOk) {
    SAVEMARK.seenOk = DISK.okAt;
    if (SAVEMARK.wasFailing) { SAVEMARK.wasFailing = false; SAVEMARK.backAt = t; SAVEMARK.shownAt = t; }
    else if (t - SAVEMARK.shownAt > SAVEMARK.every || !SAVEMARK.shownAt) SAVEMARK.shownAt = t;
  }
  const age = t - SAVEMARK.shownAt;
  if (!SAVEMARK.shownAt || age > SAVEMARK.show) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, age / 200, (SAVEMARK.show - age) / 500) * 0.95; saveMarkPill(x, y, SAVEMARK.backAt === SAVEMARK.shownAt ? 84 : 46);
  text(SAVEMARK.backAt === SAVEMARK.shownAt ? '✓ disk copy back' : '✓ saved', x, y, '#9fe8b4', 7.5, 'left');
  ctx.restore();
}
{
  const dt = drawToasts;
  drawToasts = (...a) => { const r = dt(...a); try { saveMarkDraw(performance.now()); } catch (e) {} return r; };
}
