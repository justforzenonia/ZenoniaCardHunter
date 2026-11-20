'use strict';
// CREDITS and the VERSION (2026-11-08, release prep). Esc ▸ SETTINGS ▸ CREDITS lists everything the game is built from, with
// each licence; the version shows on the title screen and at the top of the credits. Licence texts sit in assets/ and
// assets/fonts/. CC-BY work (the farm animals) must stay credited here.
const GAME_VERSION = '1.0.0';
const GAME_RELEASE = 'November 20, 2026';
const CREDITS = [
  { name: 'Zenonia Card Hunters', sub: `Version ${GAME_VERSION} · ${GAME_RELEASE}`, col: '#ffd23f' },
  { name: 'Original sprites, maps and music', sub: 'Zenonia and Zenonia 2 by Gamevil (2009). A fan project, not for sale' },
  { name: 'Fredoka (the game font)', sub: 'The Fredoka Project Authors · SIL Open Font License 1.1' },
  { name: 'Dela Gothic One (summon lettering)', sub: 'The Dela Gothic One Project Authors · SIL Open Font License 1.1' },
  { name: 'HUD art: Tiny RPG - Mana Soul GUI', sub: 'tiopalada · CC0' },
  { name: 'Window frames: Fantasy Borders', sub: 'Kenney (kenney.nl) · CC0' },
  { name: 'Glows: Particle Pack', sub: 'Kenney (kenney.nl) · CC0' },
  { name: 'Spell effects: Elemental Spellcraft', sub: 'NogitsuneGurl, made in The Pixel Loom · free for games' },
  { name: 'Ki aura: Aura38', sub: 'Soluna Software · CC0' },
  { name: 'Quest bubbles: Animated emote bubbles', sub: 'Romain Oltra (OpenGameArt) · CC0' },
  { name: 'Coins: 3D Spinning Gold Coin Sprite', sub: 'OpenGameArt · CC0' },
  { name: 'Farm animals: LPC style farm animals', sub: 'Daniel Eddeland (daneeklu), commissioned by tebruno99 · CC-BY 3.0' },
  { name: 'Casino hall backdrop', sub: 'Generated with Pollinations' },
  { name: 'Made with care', sub: 'Thank you for playing. Rest well, hunter', col: '#9fe8a8' },
];
function creditsMenu() { return { type: 'credits', cur: 0, scroll: 0, tab: 0 }; }
function creditRows() { return CREDITS.map(c => ({ name: c.name, sub: c.sub, col: c.col || '#f4ecd8' })); }
function updateCredits(game, m) { const nav = panelNav(m, CREDITS.length, 0); if (nav.back) game.closeMenu(); }
function drawCredits(game, m, now) { panelMenu(m, { title: 'CREDITS', rows: creditRows(), keys: '↑↓ scroll · Esc close' }, now); }
SET_ROWS.push({ id: 'credits', name: 'CREDITS', steps: null, label: () => `v${GAME_VERSION}`, act: () => GAME.openMenu(creditsMenu()) });
