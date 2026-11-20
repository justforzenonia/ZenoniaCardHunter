'use strict';
// SOFT CUES for the hunting alerts (foeelite.js, book.js): a gentle chime under each, so you notice without looking. The game is
// a cozy RPG, so they are comforting MUSIC-BOX notes, never beeps or alarms: each a pure tone with a faint octave shimmer, a slow
// rounded start, a long soft fade and a warm low-pass, in short pentatonic phrases (the lullaby scale) kept to the middle range.
// Even "an elite is near" is a friendly nudge. They go through the game's own master volume (sfx.js SFX.audio), so VOLUME in
// Settings and the 0 mute apply; at most one phrase every 0.4 s.
// Notes: G4 392 · A4 440 · C5 523 · D5 587 · E5 659 · G5 784 · A5 880 (nothing higher)
const CUES = {
  gap: 400, last: 0, vol: 0.055, ring: 0.95, step: 0.17, warm: 2200,
  list: [   // [the toast's text, the phrase (Hz)]
    [/^Elite nearby/, [392, 523]],                        // a soft "oh, look": two notes up
    [/^★ Your target is near/, [440, 523, 659]],          // a little rising hum
    [/^★ Target down/, [659, 523, 440]],                  // settling back down, resolved
    [/^Monster Book: .* added/, [523, 659]],              // a page turns
    [/^Monster Book: \d+ pages!/, [392, 523, 659, 784]],
    [/^MASTERY/, [523, 659, 784]],
    [/MONSTER BOOK: .* complete!/, [392, 523, 659, 784, 880]],   // the longest, a gentle arpeggio
    [/^New for your Monster Book/, [659]],                // one quiet chime
    [/^(ELITE WEEKEND|☆ Monster of the Day)/, [440, 523, 659]],
  ],
};
// one music-box note: the tone and a faint octave above it, through a warm filter, rising softly and fading long
function cueNote(A, f, t, peak) {
  const lp = A.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(CUES.warm, t); lp.Q.setValueAtTime(0.4, t);
  const g = A.ac.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.03);                      // a rounded start, no click
  g.gain.exponentialRampToValueAtTime(0.0001, t + CUES.ring);          // a long, gentle fade
  lp.connect(g); g.connect(A.master);
  for (const [mul, amp] of [[1, 1], [2, 0.18]]) {                      // the note, and a soft shimmer an octave up
    const o = A.ac.createOscillator(), og = A.ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * mul, t); og.gain.setValueAtTime(amp, t);
    o.connect(og); og.connect(lp); o.start(t); o.stop(t + CUES.ring + 0.05);
  }
}
function cuePlay(notes) {
  if (typeof SET !== 'undefined' && SET.chimes === false) return;   // (Settings: CHIMES off)
  const A = SFX.audio(); if (!A) return;
  const now = performance.now(); if (now - CUES.last < CUES.gap) return; CUES.last = now;
  notes.forEach((f, i) => cueNote(A, f, A.ac.currentTime + 0.01 + i * CUES.step, CUES.vol * (i === notes.length - 1 ? 1 : 0.85)));   // (the last note a touch fuller)
}
// they play when a toast actually appears on screen (sessionrecap.js paces toasts one by one, and drops repeats), so the chime
// always goes with what you see: each frame, any toast not seen before is checked once
const CUE_SEEN = new WeakSet();
{
  const dt0 = drawToasts;
  drawToasts = dt => {
    const G = window.GAME;
    if (G && G.toasts) for (const t of G.toasts) if (t && !CUE_SEEN.has(t)) {
      CUE_SEEN.add(t);
      if (t.t > 200) continue;   // (already up when the game loaded, or old: stay quiet)
      try { for (const [re, notes] of CUES.list) if (re.test(String(t.str))) { cuePlay(notes); break; } } catch (e) {}
    }
    return dt0(dt);
  };
}
// HUNT ALERTS: Quiet (Settings) leaves out the "heads-up" messages; rewards and completions still show
const CUE_QUIET = [/^Elite nearby/, /^New for your Monster Book/, /^★ Your target is near/];
{
  const G = window.GAME;
  if (G && G.toast) { const t = G.toast; G.toast = function (str, col) { if (typeof SET !== 'undefined' && SET.alerts === false && CUE_QUIET.some(re => re.test(String(str)))) return; return t.call(this, str, col); }; }
}
