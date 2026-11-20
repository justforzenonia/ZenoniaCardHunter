'use strict';
// MUSIC: the original games' own tracks (assets/bgm), looping seamlessly and crossfading as you cross into another zone or town.
// It runs through the sound effects' master volume (sfx.js), so 0 mutes it too. Which track goes where is the table below: the
// tracks were matched to the zones by how they measure (key, brightness, pace), so swapping one is a one-word change.
const BGM = {
  vol: 0.5, fade: 1.2, retry: 10000,
  tracks: { verdant: 'assets/bgm/verdant.ogg', twilight: 'assets/bgm/twilight.ogg', ember: 'assets/bgm/ember.ogg', frozen: 'assets/bgm/frozen.ogg', town: 'assets/bgm/town.ogg', home: 'assets/bgm/home.ogg' },
  zones: ['verdant', 'twilight', 'ember', 'frozen'],
  buf: {}, failed: {}, cur: null, now: null, gen: 0,
};
function bgmWant(w) {
  if (!w.overworld || !w.player) return BGM.cur;   // indoors, or down a rift: what was playing carries on
  const R = regionAt(w.player.x);
  if (!R || R.zone < 0 || inTown(w.player.x)) return R && R.key === 'town' ? 'home' : 'town';
  return BGM.zones[R.zone] || BGM.cur;
}
function bgmLoad(A, key) {
  return BGM.buf[key] || (BGM.buf[key] = fetch(BGM.tracks[key]).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => A.ac.decodeAudioData(b)));
}
function bgmStart(A, key, buf) {
  const old = BGM.now, t = A.ac.currentTime, g = A.ac.createGain(), s = A.ac.createBufferSource();
  s.buffer = buf; s.loop = true; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(BGM.vol, t + BGM.fade); s.connect(g); g.connect(A.master); s.start();
  if (old) { old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0.0001, t + BGM.fade); old.s.stop(t + BGM.fade + 0.05); }
  BGM.now = { key, s, g };
}
// each world frame (main.js)
function bgmTick(w) {
  const A = SFX.audio(); if (!A) return;
  const key = bgmWant(w); if (!key || key === BGM.cur || performance.now() < (BGM.failed[key] || 0)) return;
  BGM.cur = key; const gen = ++BGM.gen;
  bgmLoad(A, key).then(buf => { if (gen === BGM.gen) bgmStart(A, key, buf); }).catch(() => { delete BGM.buf[key]; BGM.failed[key] = performance.now() + BGM.retry; if (gen === BGM.gen) BGM.cur = BGM.now ? BGM.now.key : null; });
}
