'use strict';
// SOUND FOR FRIENDS in online co-op (net.js). The host's game runs every fight, so until now only the host heard it: a guest's
// swings, hits, blocks, parries and kills were silent on their own screen. Now the host notes each combat sound as it plays and
// the next snapshot carries the list; each guest plays them once (sfx.js still rate-limits them, so a crowd doesn't turn to
// noise). Only fight sounds travel: the host's own menus (summons, fusions, pickups) stay on the host's screen.
const NSFX = { keys: ['swing', 'hit', 'block', 'parry', 'kill', 'dash', 'bow', 'cast', 'smite', 'hurt', 'guardBreak', 'burst', 'crushWarn', 'crush', 'steady', 'horn'], max: 16, q: [] };
// the host: note each fight sound while friends are in the room
for (const k of NSFX.keys) {
  const f = SFX[k]; if (!f) continue;
  SFX[k] = (...a) => {
    const N = window.GAME && GAME.net;
    if (N && N.role === 'host' && Object.keys(N.guests || {}).length && NSFX.q.length < NSFX.max) NSFX.q.push(a.length ? [k, a[0]] : [k]);
    return f(...a);
  };
}
// what the guests are told (net.js snapshot): the sounds since the last one
{
  const ns = netSnapshot;
  netSnapshot = (game, w) => { const S = ns(game, w); S.sx = S.away ? [] : NSFX.q.splice(0); NSFX.q.length = 0; return S; };
}
// a guest plays each snapshot's sounds once
{
  const na = netApply;
  netApply = (game, w, S, dt) => {
    const fresh = S && S !== game.net.applied && !S.away;
    const r = na(game, w, S, dt);
    if (fresh && S.sx) for (const [k, v] of S.sx) if (NSFX.keys.includes(k) && SFX[k]) SFX[k](v);
    return r;
  };
}
