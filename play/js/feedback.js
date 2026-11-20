'use strict';
// FEEDBACK (2026-11-20; the user picked "Feedback button"). Esc ▸ SETTINGS ▸ FEEDBACK copies a short line about this game
// (version and build, website / phone app / PC, the hero's class and level, the screen size) and opens the community Discord,
// where it can be pasted under a bug report or an idea, so whoever reads it knows which game it came from. The invite comes
// from tools/site_config.json: built into the website and the app (window.ZCH_DISCORD, tools/build_release.py), read from
// the file when the game runs from the PC's own server. No personal details are in the line.
const FEEDBACK = { cfg: 'tools/site_config.json' };
let feedbackUrl = window.ZCH_DISCORD || null;
if (!feedbackUrl && !window.ZCH_STATIC) {   // (the PC's own server serves the tools folder)
  fetch(FEEDBACK.cfg, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(c => {
    const d = c && String(c.discord || '').trim(); if (/^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/.test(d)) feedbackUrl = d;
  }).catch(() => {});
}
function feedbackInfo() {
  const pr = (window.GAME && (GAME.profile || GAME.saved)) || null;
  const where = typeof appIsNative === 'function' && appIsNative() ? 'phone app' : window.ZCH_STATIC ? 'website' : 'PC';
  const hero = pr && CLASSES[pr.cls] ? `${CLASSES[pr.cls].name} Lv ${pr.lv || 1}` : 'no hero yet';
  return `Zenonia Card Hunters v${typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?'}${window.ZCH_BUILD ? ' (build ' + window.ZCH_BUILD.split('-').pop() + ')' : ''} · ${where} · ${hero} · screen ${innerWidth}x${innerHeight}`;
}
function feedbackOpen() {
  const G = window.GAME, info = feedbackInfo();
  if (!feedbackUrl) { if (G) G.toast('No community link is set up yet (tools/site_config.json "discord")', '#ffd27a'); return; }
  const go = copied => {
    if (G) G.toast(copied ? 'Game info copied: paste it in your message on the Discord' : `Mention this in your message: ${info}`, '#9fd8ff');
    if (typeof appIsNative === 'function' && appIsNative()) location.href = feedbackUrl;   // (the app hands an outside address to the phone's browser)
    else { const w = window.open(feedbackUrl, '_blank', 'noopener'); if (!w) location.href = feedbackUrl; }
  };
  try { navigator.clipboard.writeText(info).then(() => go(true), () => go(false)); } catch (e) { go(false); }
}
{ const i = SET_ROWS.findIndex(r => r.id === 'credits');
  SET_ROWS.splice(i < 0 ? SET_ROWS.length : i, 0, { id: 'feedback', name: 'FEEDBACK', steps: null,
    label: () => (feedbackUrl ? 'Bugs and ideas: Discord' : 'Not set up'), act: () => feedbackOpen() }); }
