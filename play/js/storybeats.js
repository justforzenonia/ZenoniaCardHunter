'use strict';
// STORY BEATS: the steps that make each chapter its own (chapters.js puts them in its CHAPTERS), and the STORY JOURNAL.
//   MEET     someone waits out in the zone (a villager sprite with a gold "!"): walk up, press Enter, hear them out
//   VISIT    light a set of shrines or lanterns spread through the zone (drawn as waystones, lit as you touch them)
//   AMBUSH   a pack of the zone's toughest kind holds a spot; come near and they attack; put them all down
//   GOAL     anything already tracked elsewhere (a Trial cleared, a raid boss beaten) — the post-ending chapters
//   RETURN   go back to the chapter's giver and tell them
// Progress lives in pr.story.f (flags and counts by step id); a zone already cleared counts every beat in it as done.
const BEAT = { meetR: 34, touchR: 26, spawnR: 600, ambushR: 260, ambushSpread: 34 };

// a spot in zone z for a beat: in the area a fraction f of the way out from the town, open, reachable, the same every time
function storySpot(w, z, f, key) {
  w._sspots = w._sspots || {}; if (w._sspots[key]) return w._sspots[key];
  const L = zoneAreas(z); if (!L.length) return null;
  const R = L[Math.min(L.length - 1, Math.max(0, Math.round(f * (L.length - 1))))], r = rng(hashStr('story:' + key));
  let at = null;
  for (let i = 0; i < 400 && !at; i++) {
    const x = (R.ox + 4 + r() * Math.max(2, R.w - 8)) * T, y = (R.oy + 4 + r() * Math.max(2, R.h - 8)) * T;
    if (mapReach(w.map, x, y) && !w.blocked(x, y) && !mapSolidAt(w.map, x, y - 12) && !mapSolidAt(w.map, x + 14, y) && !mapSolidAt(w.map, x - 14, y)) at = { x, y };
  }
  return (w._sspots[key] = at || findOpen(w, (R.ox + R.w / 2) * T, (R.oy + R.h / 2) * T));
}
const beatF = S => S.f || (S.f = {});
const zoneDone = (pr, z) => z != null && !!(pr.cleared && pr.cleared[z]);

// ---- the step makers (used in chapters.js)
function meetStep(z, id, text, npc, who, f, lines, reward, toast) {
  return { id, kind: 'meet', text, z, f, npc, who, lines, reward, toast, done: (pr, S) => beatF(S)[id] === true || zoneDone(pr, z), target: w => storySpot(w, z, f, id) };
}
function visitStep(z, id, text, title, col, fs, reward, toast, each) {
  return { id, kind: 'visit', text, z, fs, title, col, reward, toast, each,
    prog: (pr, S) => [(beatF(S)[id] || []).length, fs.length], done: (pr, S) => (beatF(S)[id] || []).length >= fs.length || zoneDone(pr, z),
    target: w => { const got = beatF(storyState(GAME.profile))[id] || [], p = w.player; let best = null; fs.forEach((f, i) => { if (got.includes(i)) return; const s = storySpot(w, z, f, `${id}:${i}`); if (s && (!best || Math.hypot(s.x - p.x, s.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y))) best = s; }); return best; } };
}
function ambushStep(z, id, text, n, label, f, reward, toast) {
  return { id, kind: 'ambush', text, z, n, label, f, reward, toast,
    prog: (pr, S) => [Math.min(n, beatF(S)[id] || 0), n], done: (pr, S) => (beatF(S)[id] || 0) >= n || zoneDone(pr, z), target: w => storySpot(w, z, f, id) };
}
function goalStep(id, text, done, reward, toast, prog) { return { id, kind: 'goal', text, done, reward, toast, prog }; }
function returnStep(text, reward) { return { id: 'return', kind: 'return', text, done: (pr, S) => !!S.talked, target: () => giverSpot(storyChapter(GAME.profile)), reward }; }

// ---- each world frame (from storyTick): bring out the people and the ambushers, and light what you touch
function storyBeatTick(game, w, C, st) {
  const pr = game.profile, S = storyState(pr), p = w.player, F = beatF(S);
  if (st.kind === 'meet' && !w.actors.some(a => a.storyNpc === st.id && !a.remove)) {
    const at = st.target(w); if (at && Math.hypot(at.x - p.x, at.y - p.y) < BEAT.spawnR && D.npcs[st.npc]) {
      const a = baseActor('npc', 2, at.x, at.y);
      Object.assign(a, { npc: st.npc, label: st.who, h: 26, home: { x: at.x, y: at.y }, ai: { t: 0, still: true }, storyNpc: st.id, marker: '#ffd23f' });
      w.actors.push(a);
    }
  }
  if (st.kind === 'ambush') {
    const at = st.target(w), alive = w.actors.filter(a => a.storyFoe === st.id && !a.dead).length, left = st.n - (F[st.id] || 0) - alive;
    if (at && left > 0 && Math.hypot(at.x - p.x, at.y - p.y) < BEAT.ambushR) {
      const Z = ZONES[st.z], sp = Z.mobs.filter(id => D.monsters[id]).sort((a, b) => SPECIES[b].dmg - SPECIES[a].dmg);
      for (let i = 0; i < left; i++) {
        const q = findOpen(w, at.x + Math.cos(i * 2.4) * BEAT.ambushSpread, at.y + Math.sin(i * 2.4) * BEAT.ambushSpread * 0.6), m = makeMonster(sp[i % Math.min(3, sp.length)], Z.ranks[1], q.x, q.y);
        Object.assign(m, { storyFoe: st.id, label: st.label, home: { x: q.x, y: q.y } }); w.actors.push(m);
      }
      if (!w._ambushSeen || w._ambushSeen !== st.id) { w._ambushSeen = st.id; w.shake = Math.max(w.shake || 0, 5); game.toast(`⚔ ${st.label}s! Put them all down`, '#ff9a7a'); }
    }
  }
  if (st.kind === 'visit') {
    const got = F[st.id] || (F[st.id] = []);
    st.fs.forEach((f, i) => {
      if (got.includes(i)) return; const s = storySpot(w, st.z, f, `${st.id}:${i}`); if (!s || Math.hypot(s.x - p.x, s.y - p.y) > BEAT.touchR) return;
      got.push(i); w.rings.push({ x: s.x, y: s.y, r: 36, t: 0, col: st.col }); game.toast(`${st.title} ${got.length}/${st.fs.length}${st.each ? ` — ${st.each[i] || ''}` : ''}`, st.col); game.save();
    });
  }
}
// a kill: an ambusher down counts toward its step
function storyBeatKill(game, w, m) { if (!m.storyFoe) return; const F = beatF(storyState(game.profile)); F[m.storyFoe] = (F[m.storyFoe] || 0) + 1; }
// Enter beside the one you were sent to find
function storyNpcInteract(game, w) {
  const p = w.player; let a = null, bd = BEAT.meetR;
  for (const q of w.actors) if (q.storyNpc && !q.remove) { const d = dist(q, p); if (d < bd) { bd = d; a = q; } }
  if (!a) return false;
  const pr = game.profile, S = storyState(pr), C = storyChapter(pr), st = C && C.steps.find(s => s.id === a.storyNpc);
  a.dir = dirTo(p.x - a.x, p.y - a.y);
  if (!st || beatF(S)[st.id] === true) { game.openDialog(a.label, 'Go on, hunter. I will find my own way home now.', null); return true; }
  const m = dialogMenu(st.who, st.lines[0], null); m.pages = st.lines.slice(1);
  m.onDone = () => { beatF(S)[st.id] = true; a.marker = null; storyTick(game, w); };
  game.openMenu(m); return true;
}
// in the world, depth-sorted: the shrines of a VISIT step (lit once touched), and a prompt beside the one to MEET
function drawStoryBeats(w, now, items) {
  if (!w.overworld || w.interior || !window.GAME || !GAME.profile) return;
  const pr = GAME.profile, S = storyState(pr), C = storyChapter(pr), st = storyStep(pr), p = w.player; if (!C || !st) return;
  if (st.kind === 'visit') {
    const got = beatF(S)[st.id] || [];
    st.fs.forEach((f, i) => { const s = storySpot(w, st.z, f, `${st.id}:${i}`); if (!s || Math.abs(s.x - p.x) > 420 || Math.abs(s.y - p.y) > 300) return; const lit = got.includes(i); items.push({ y: s.y, draw: () => drawWaystone(s.x, s.y, st.col, lit, now, st.title, lit ? 'lit' : 'touch it') }); });
  }
  if (st.kind === 'meet') for (const a of w.actors) if (a.storyNpc === st.id && Math.hypot(a.x - p.x, a.y - p.y) < BEAT.meetR) items.push({ y: a.y + 1, draw: () => text('Enter: Talk', a.x, a.y + 12, '#ffe9a8', 7) });
}
// older saves: a chapter's steps may have moved, so the step is found again by its id (pr.story.sid)
function storyResync(S) {
  const C = CHAPTERS[S.ch];
  if (S.step === -2 && C) { S.step = -1; S.talked = false; return; }   // the story went on past the old ending
  if (!C || S.step < 0 || !S.sid) return;
  if (!C.steps[S.step] || C.steps[S.step].id !== S.sid) { const i = C.steps.findIndex(s => s.id === S.sid); if (i >= 0) S.step = i; }
}

// ---- THE STORY JOURNAL (click the chapter at the top right, or J on the journey map): every chapter, where it stands,
// and its steps ticked off
function journalMenu(game) { const S = storyState(game.profile); return { type: 'journal', cur: Math.min(CHAPTERS.length - 1, Math.max(0, S.ch)), t: 0 }; }
const JN = { x: 40, y: 30, w: 560, h: 300, listW: 170 };
const chapterRow = i => ({ x: JN.x + 12, y: JN.y + 40 + i * 30, w: JN.listW - 12, h: 26 });
function journalStatus(pr, i) { const S = storyState(pr); return i < S.ch || S.step === -2 && i <= S.ch ? 'done' : i === S.ch ? (S.step >= 0 ? 'now' : 'next') : 'locked'; }
function updateJournal(game, m, dt) {
  m.t += dt; const k = navInput();
  if (k.back || hit('Escape') || (m.t > 200 && hit('KeyJ'))) { game.closeMenu(); return; }
  if (k.u) m.cur = Math.max(0, m.cur - 1); if (k.d) m.cur = Math.min(CHAPTERS.length - 1, m.cur + 1);
  CHAPTERS.forEach((_, i) => { const R = chapterRow(i); if (clicked(R.x, R.y, R.w, R.h)) m.cur = i; });
}
function drawJournal(game, m, now) {
  const pr = game.profile, S = storyState(pr);
  ctx.fillStyle = 'rgba(6,4,14,0.72)'; ctx.fillRect(0, 0, VW, VH);
  zWindow(JN.x, JN.y, JN.w, JN.h);
  goldText('STORY JOURNAL', VW / 2, JN.y + 16, 14, { spacing: 2, glow: 'rgba(255,200,80,0.5)' });
  CHAPTERS.forEach((C, i) => {
    const R = chapterRow(i), st = journalStatus(pr, i), sel = i === m.cur, lock = st === 'locked';
    ctx.fillStyle = sel ? 'rgba(255,215,120,0.2)' : 'rgba(0,0,0,0.25)'; rrect(ctx, R.x, R.y, R.w, R.h, 4); ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.9; rrect(ctx, R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 4); ctx.stroke(); }
    const [num, name] = C.title.split(' · ');
    text(num, R.x + 8, R.y + 8, lock ? '#6a6478' : '#ffe9a8', 7, 'left'); text(lock ? '? ? ?' : name, R.x + 8, R.y + 18, lock ? '#5a5468' : '#f4ecd8', 7.5, 'left');
    text(st === 'done' ? '✔' : st === 'now' ? '▶' : st === 'next' ? '!' : '🔒', R.x + R.w - 10, R.y + 13, st === 'done' ? '#8fffd0' : st === 'locked' ? '#6a6478' : '#ffd23f', 9, 'right');
  });
  // the chosen chapter
  const C = CHAPTERS[m.cur], st = journalStatus(pr, m.cur), X = JN.x + JN.listW + 14, W = JN.w - JN.listW - 28;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, X - 4, JN.y + 36, W + 8, JN.h - 52, 6); ctx.fill();
  if (st === 'locked') { text('Finish the chapters before it to read this one.', X + W / 2, JN.y + 150, '#9a917c', 8); return; }
  text(C.title, X + 4, JN.y + 48, '#ffd23f', 9, 'left');
  text(`Given by the ${C.giver.name}`, X + 4, JN.y + 60, '#a8a0b8', 6.5, 'left');
  let y = JN.y + 72;
  for (const ln of wrapLines(C.intro[0], W - 16, 6.6, true).slice(0, 3)) { text(ln, X + 4, y, '#d8d0c0', 6.6, 'left'); y += 9; }
  y += 6;
  const cur = st === 'now' ? S.step : st === 'done' ? C.steps.length : -1;
  if (st === 'next') { text(`▶ Talk to the ${C.giver.name}${C.giver.town == null ? ' in Hearthvale' : ''} to begin`, X + 4, y, '#ffd23f', 7.5, 'left'); y += 14; }
  C.steps.forEach((s, i) => {
    if (y > JN.y + JN.h - 34) return;
    const done = i < cur, now2 = i === cur, col = done ? '#8fffd0' : now2 ? '#ffffff' : '#7a7488';
    let line = stepText(s, C); if (now2 && s.prog) { const [a, b] = s.prog(pr, S); line += `  ${a}/${b}`; } else if (now2 && s.need) line += `  ${Math.min(S.n, s.need)}/${s.need}`;
    text(done ? '✔' : now2 ? '▶' : '·', X + 8, y, col, 7.5); text(line, X + 18, y, col, 7, 'left');
    const R = s.reward || {}, bits = [R.exp && `${R.exp} EXP`, R.gold && `${R.gold} G`, R.coins && `${R.coins} coins`, R.card != null && `${RANKS[R.card]} card`].filter(Boolean).join(' · ');
    if (bits) text(bits, X + W, y, done ? '#5a8a70' : '#a89070', 6, 'right');
    y += 13;
  });
  if (st === 'done') text(m.cur === 3 ? 'The Sun Sovereign has fallen.' : 'Chapter complete.', X + W / 2, JN.y + JN.h - 26, '#8fffd0', 8);
  text('↑↓ choose · Esc: close', VW / 2, JN.y + JN.h - 10, '#9a917c', 6.5);
}
