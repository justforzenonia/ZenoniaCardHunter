'use strict';
// QUEST MARKS: a speech bubble with a red "!" pops up over anyone or anything with something for you to do right now: taking
// on or moving a quest forward by talking to them. It is not shown while you are off doing the work, so a "!" always means
// "go here"; the main story's next goal has the same bubble with a gold star in it. Art: "Animated emote bubbles" by Romain Oltra (OpenGameArt, CC0), row 3 of the sheet, at assets/quest_mark.png.
const QMARK = { sheet: 'assets/quest_mark.png', star: 'assets/quest_star.png', size: 16, frames: 8, ms: 70, cycle: 3200, scale: 1, bob: 1.5, bobMs: 240, npcTop: 50, wellBank: '042', wellPlace: 'Windmill Hill' };
function questMarkNpc(game, a) {
  const pr = game.profile, w = game.world; if (!pr) return false;
  if (a.wanderer && !a.wanderer.done) return true;   // a traveller far from home
  const S = storyState(pr), C = storyChapter(pr), st = storyStep(pr);
  if (C && a.role === 'story' && a.storyTown === C.zone && st && st.id === 'town') return true;   // the chapter's closing Elder
  if (C && S.step === -1 && giverMatch(a, C)) return true;   // the next chapter's giver
  if (a.role === 'quest' && !(pr.quests && pr.quests.active.length)) return true;   // the Guild, when you carry no contract
  if (a.label === 'Washer Bree' && wellQ(pr).step === 1) return true;
  for (const Q of SIDE_QUESTS) {
    const q = sqOf(pr, Q.id), step = sqStep(pr, Q);
    if (!q && Q.giver === a.label && (pr.lv || 1) >= Q.lv) return true;
    if (q && step && step.type === 'talk' && step.who === a.label) return true;
  }
  if (a.role === 'collector' && curioReady(pr)) return true;
  if (favourMark(pr, a)) return true;   // today's small favour (folkday.js)
  if (a.role === 'tent' && w && w.door) { const S = tentState(pr, w.door.tentKey, w.door.tentRegion); return S.state === 0 || (S.state === 1 && S.have >= TENT.need); }
  if (a.role === 'tree' && w && w.door) { const T = treeState(pr, w.door.treeKey); if (T.state === 0 || (T.state === 1 && (T.kind === 'food' ? edibleCount(pr) >= T.need : T.have >= T.need))) return true; }
  return false;
}
function questMarkWell(game) { const pr = game.profile, w = game.world; if (!pr) return false; const n = wellQ(pr).step; return n === 0 || n === 3 || n === 5 || (n === 4 && !(w && w.actors.some(a => a.wellBoss && !a.dead))); }
const isQuestWell = o => o.bank === QMARK.wellBank && o.landmark === QMARK.wellPlace;
function drawQuestMark(x, y, now, star = false) {
  const M = QMARK, im = img(star ? M.star : M.sheet); if (!im || !im.complete || !im.naturalWidth) return;
  const fr = Math.min(M.frames - 1, Math.floor((now % M.cycle) / M.ms)), by = Math.round(y + Math.sin(now / M.bobMs) * M.bob), s = M.size * M.scale, sm = ctx.imageSmoothingEnabled;   // (it pops up afresh every few seconds)
  ctx.imageSmoothingEnabled = false; ctx.drawImage(im, fr * M.size, 0, M.size, M.size, Math.round(x - s / 2), by - s / 2, s, s); ctx.imageSmoothingEnabled = sm;
}
