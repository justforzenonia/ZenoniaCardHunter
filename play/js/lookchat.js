'use strict';
// A NEW LOOK GETS NOTICED: after you save a changed look at the Stylist (or the MIRROR), the next LOOK_CHAT.n town folk you chat
// with in the following LOOK_CHAT.ms each open with a short, kind word about it instead of their usual line, once each
// (townlife.js townLifeTalk). Errands, shops and quests are untouched. pr.lookNew = { t: when, told: [names] }. Your partner, if
// out, shows a heart. A Wardrobe look worn here also brings back the partner colours saved with it (m.ppaint, ui.js).
const LOOK_CHAT = { n: 4, ms: 30 * 60 * 1000, lines: [
  n => `Ooh, a new look? It suits you, ${n}.`,
  n => `${n}! I almost walked right past you. I like it.`,
  () => 'Did you see the Stylist? You look lovely.',
  n => `Look at you, ${n}. Very dashing.`,
  () => 'New colours? They make you look rested.',
  () => 'That look is so you. Is that strange to say?',
] };
function lookCompliment(game, a) {
  const pr = game.profile, L = pr && pr.lookNew; if (!L || Date.now() - L.t > LOOK_CHAT.ms) return null;
  L.told = L.told || []; if (L.told.length >= LOOK_CHAT.n || L.told.includes(a.label)) return null;
  L.told.push(a.label); game.save();
  const name = (pr.look && pr.look.name) || 'hero', i = (L.told.length - 1 + Math.floor(L.t / 1000)) % LOOK_CHAT.lines.length;
  return LOOK_CHAT.lines[i](name);
}
{
  const cd = customDone;
  customDone = (game, m) => {
    const changed = m.edit && customLookKey(lookOf(m)) !== m.startKey;
    const pr = game.profile, P = m.edit && pr && typeof partnerOf === 'function' && partnerOf(pr);
    const paint = m.ppaint && P && !P.dead && JSON.stringify(m.ppaint) !== JSON.stringify(P.paint || {}) ? m.ppaint : null;   // a wardrobe look worn with its partner colours
    if (paint) P.paint = paint;
    const r = cd(game, m);
    if (paint && typeof partnerRefit === 'function') partnerRefit(game);
    if ((changed || paint) && pr) {
      pr.lookNew = { t: Date.now(), told: [] }; game.save();
      const w = game.world, a = w && w.actors.find(q => q.heroPartner && !q.dead);   // your partner sees it first: a heart, as when you pat them (pats.js)
      if (a) w.timers.push({ t: 350, fn: () => { if (!a.dead) floatText(w, a.x, a.y - (a.h || 26) * (a.scale || 1) - 4, '♥', '#ff9ab8', 11); } });
    }
    return r;
  };
}
// COLOUR OF THE DAY (the Stylist / MIRROR): each real day the Stylist names one of the swatch colours (not Original). Save a look
// that wears it anywhere (hair, outfit or one of the body's colours) and a small gift of gold comes, once a day (pr.dayColour).
const DAY_COLOUR = { col: '#ffe9a8', gold: 120 };
const dayColourId = () => { const L = STYLE_IDS.filter(k => k !== 'orig'); return L[(dayNo() * 7 + 3) % L.length]; };
function lookWears(look, id) { return !!look && (look.hair === id || look.outfit === id || Object.values((look.char && look.char.paint) || {}).includes(id)); }
{
  const cd = customDone;
  customDone = (game, m) => {
    const pr = game.profile, id = dayColourId(), look = m.edit && lookOf(m), due = pr && m.edit && pr.dayColour !== dayNo() && lookWears(look, id);
    const r = cd(game, m);
    if (due) {
      const rank = ZONES[storyZone(pr)].ranks[0], gold = DAY_COLOUR.gold * (1 + rank);
      pr.dayColour = dayNo(); pr.gold = (pr.gold || 0) + gold; game.save();
      game.toast(`The Stylist loves the ${STYLE_COLORS[id].name}! A little gift: +${gold} G`, DAY_COLOUR.col);
    }
    return r;
  };
  const dc = drawCustom;
  drawCustom = (game, m, now) => {
    const r = dc(game, m, now), pr = game.profile;
    if (m.edit && pr) {
      const id = dayColourId(), S = STYLE_COLORS[id], done = pr.dayColour === dayNo(), label = `Colour of the day: ${S.name}${done ? ' · gift received' : ' · wear it for a gift'}`;
      const w = textW(label, 7), x = 160 - (w + 12) / 2;
      ctx.fillStyle = S.swatch; rrect(ctx, x, 43, 8, 8, 2); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; rrect(ctx, x + 0.4, 43.4, 7.2, 7.2, 2); ctx.stroke();
      text(label, x + 12, 47.5, done ? '#c9c1a8' : DAY_COLOUR.col, 7, 'left');
    }
    return r;
  };
}
