'use strict';
// Synthesized sound effects (Web Audio, no files): sword swings, meaty hits, crits, blocks/parries, kills, dashes,
// spell casts and pickups. Audio starts after the first key press or click (browser rule). 0 toggles mute.
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null, muted = false, last = {};
  try { muted = localStorage.getItem('zch_mute') === '1'; } catch (e) {}
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.5;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  addEventListener('keydown', e => { init(); if (e.code === 'Digit0' && !e.repeat && !(window.GAME && GAME.menu && GAME.menu.type === 'custom')) toggle(); });
  addEventListener('pointerdown', init);
  function toggle() {
    muted = !muted;
    try { localStorage.setItem('zch_mute', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.5;
    if (window.GAME) GAME.toast(muted ? 'Sound off (0)' : 'Sound on (0)', '#c9c1a8');
  }
  const ok = (key, gap) => {   // rate limit so a crowd of hits doesn't turn into noise
    if (!ac || muted) return false;
    const t = performance.now(); if (t - (last[key] || 0) < gap) return false;
    last[key] = t; return true;
  };
  // one music-box phrase (see the story card sounds below)
  function box(notes, step = 0.17, peak = 0.055, ring = 0.95) {
    const t0 = ac.currentTime + 0.01;
    notes.forEach((f, i) => {
      const t = t0 + i * step, lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t); lp.Q.setValueAtTime(0.4, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak * (i === notes.length - 1 ? 1 : 0.85), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      lp.connect(g); g.connect(master);
      for (const [mul, amp] of [[1, 1], [2, 0.18]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * mul, t); og.gain.setValueAtTime(amp, t); o.connect(og); og.connect(lp); o.start(t); o.stop(t + ring + 0.05); }
    });
  }
  // building blocks
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function noise(dur, type, f0, f1, peak, q = 1, delay = 0) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = rand(0.9, 1.1);
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.004, peak, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, dur, peak, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.003, peak, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    audio() { return ac && ac.state === 'running' ? { ac, master } : null; },   // for the music (bgm.js)
    toggle,
    // blade cutting air: band-passed noise sweeping down
    swing(heavy) { if (!ok('swing', 60)) return; noise(heavy ? 0.2 : 0.13, 'bandpass', heavy ? 2600 : 3400, heavy ? 500 : 900, heavy ? 0.5 : 0.35, 1.4); },
    // hit: a low body thump + a short crunchy noise burst; crits add a bright crack, launches a deeper boom
    hit(o = {}) {
      if (!ok('hit', 35)) return;
      const p = o.hurtPlayer ? 0.75 : 1;
      tone('sine', o.big ? 170 : 210, 45, o.big ? 0.22 : 0.14, 0.9 * p);
      noise(o.big ? 0.12 : 0.08, 'lowpass', 5000, 400, 0.7 * p, 0.8);
      tone('triangle', 900, 260, 0.05, 0.25 * p);
      if (o.crit) { noise(0.06, 'highpass', 6000, 2500, 0.6); tone('square', 1500, 400, 0.08, 0.18); }
      if (o.magic) tone('triangle', 660, 1320, 0.12, 0.18, 0.01);
    },
    block() { if (!ok('block', 50)) return; tone('triangle', 920, 860, 0.18, 0.4); tone('triangle', 1390, 1300, 0.14, 0.25); noise(0.05, 'highpass', 4000, 2000, 0.4); },
    parry() { if (!ok('parry', 50)) return; tone('triangle', 1300, 1250, 0.35, 0.45); tone('sine', 2600, 2500, 0.25, 0.25); noise(0.08, 'highpass', 7000, 3000, 0.5); },
    // the guard (guard.js): a shield cracking apart; a bubble bursting outward; a boss's growl winding up; its blow landing; poise
    guardBreak() { if (!ok('guardBreak', 300)) return; noise(0.12, 'highpass', 6000, 1800, 0.7); tone('square', 1100, 300, 0.18, 0.22); for (let i = 0; i < 4; i++) tone('triangle', 2000 - i * 300, 1800 - i * 300, 0.05, 0.1, 0.05 + i * 0.05); },
    burst() { if (!ok('burst', 200)) return; tone('sine', 260, 60, 0.3, 0.7); noise(0.28, 'bandpass', 600, 4000, 0.5, 0.8); tone('triangle', 880, 1760, 0.2, 0.18, 0.03); },
    crushWarn() { if (!ok('crushWarn', 500)) return; tone('sawtooth', 70, 140, 0.8, 0.35); noise(0.8, 'lowpass', 300, 1200, 0.3, 1.5); },
    crush() { if (!ok('crush', 200)) return; tone('sine', 90, 25, 0.5, 1); noise(0.4, 'lowpass', 2000, 80, 0.8, 0.6); noise(0.08, 'highpass', 5000, 2000, 0.5); },
    steady() { if (!ok('steady', 500)) return; tone('triangle', 660, 660, 0.12, 0.2); tone('triangle', 990, 990, 0.2, 0.18, 0.08); },
    // the story cards (each its own phrase, so none is mistaken for a fight or a pickup) (unlocks.js, sessionrecap.js) chime like the hunting alerts (cues.js): soft music-box notes, a sine with a
    // faint octave, warm low-pass, 30 ms rise and a long fade, C-major pentatonic between G4 and A5. Never a beep, even TRY AGAIN.
    unlock() { if (ok('unlock', 400)) box([523, 659, 784, 880]); },   // a gentle rising arpeggio: something new opened
    notice() { if (ok('notice', 400)) box([523, 659]); },             // two notes up: a goal or welcome card
    retry() { if (ok('retry', 400)) box([659, 587, 523]); },          // settling home, resolved: it's fine, try again
    photo() { if (ok('photo', 300)) box([880, 659], 0.07, 0.045, 0.6); },   // a little two-note shutter (photo.js)
    carIn() { if (ok('car', 300)) box([392, 587], 0.11, 0.045, 0.7); },    // getting in: G4 up to D5 (vehsound.js)
    carOut() { if (ok('car', 300)) box([587, 392], 0.11, 0.04, 0.7); },   // getting out: settling back down
    horn() { if (ok('horn', 450)) box([659, 659], 0.13, 0.04, 0.45); },   // the car horn: a soft toot-toot, two short E5s (vehsound.js)
    kill() { if (!ok('kill', 60)) return; tone('sine', 120, 35, 0.35, 0.9); noise(0.3, 'lowpass', 1800, 120, 0.6, 0.7); tone('triangle', 880, 1760, 0.12, 0.15, 0.08); },
    dash() { if (!ok('dash', 80)) return; noise(0.18, 'bandpass', 900, 3200, 0.4, 0.9); },
    bow(big) { if (!ok('bow', 60)) return; tone('triangle', big ? 260 : 320, big ? 120 : 150, 0.12, 0.3); noise(0.07, 'highpass', 5000, 2500, 0.3, 1.2); },
    shot(big) { if (!ok('shot', 60)) return; noise(big ? 0.2 : 0.07, 'lowpass', big ? 1500 : 2600, 180, big ? 0.32 : 0.22, 0.8); tone('sine', big ? 170 : 240, 70, big ? 0.18 : 0.07, big ? 0.26 : 0.16); },   // Ecne's gun: a soft pop, a deeper one for her rocket (ecnegun.js)
    cast(big) { if (!ok('cast', 70)) return; tone('triangle', 330, big ? 990 : 660, 0.22, 0.25); noise(0.2, 'bandpass', 1200, 5000, 0.2, 2); },
    // the pachinko summon (pachinko.js)
    pin() { if (!ok('pin', 45)) return; tone('triangle', rand(2400, 3200), 1800, 0.03, 0.05); },
    reelTick() { if (!ok('reelTick', 45)) return; tone('square', 1500, 1400, 0.02, 0.06); },
    reelStop() { if (!ok('reelStop', 60)) return; tone('square', 660, 620, 0.08, 0.2); noise(0.05, 'highpass', 3000, 1500, 0.3); },
    reach() { if (!ok('reach', 300)) return; for (let i = 0; i < 16; i++) tone('square', 440 * Math.pow(2, i / 12), 440 * Math.pow(2, i / 12), 0.1, 0.13, i * 0.12); },
    jackpot(big) {
      if (!ok('jackpot', 400)) return;
      tone('sine', 110, 40, 0.6, 0.8); noise(0.4, 'lowpass', 3000, 200, 0.6);
      const up = [523, 659, 784, 1047, 1319, 1568, 2093];
      for (let r = 0; r < (big ? 3 : 2); r++) up.forEach((f, i) => { tone('square', f, f, 0.1, 0.16, r * 0.42 + i * 0.06); tone('triangle', f * 2, f * 2, 0.14, 0.1, r * 0.42 + i * 0.06); });
      for (let i = 0; i < (big ? 18 : 9); i++) tone('sine', rand(2200, 3600), 2000, 0.09, 0.08, 0.1 + i * 0.09);   // the balls pouring out
    },
    pickup() { if (!ok('pickup', 60)) return; tone('square', 990, 990, 0.06, 0.12); tone('square', 1480, 1480, 0.09, 0.12, 0.06); },
    // ascended smite: a deep boom under the hit, a thunder crack and a shimmering chime
    smite() {
      if (!ok('smite', 70)) return;
      tone('sine', 95, 30, 0.42, 1); noise(0.32, 'lowpass', 2400, 90, 0.75, 0.6);
      noise(0.07, 'highpass', 8000, 3000, 0.55);
      tone('triangle', 1320, 1980, 0.22, 0.14, 0.02); tone('sine', 2640, 2640, 0.3, 0.08, 0.05);
    },
    hurt() { if (!ok('hurt', 120)) return; tone('sawtooth', 220, 90, 0.16, 0.2); },
    // a failed fusion: broken = a glassy crack, tinkling shards and a sad falling "wah-wah"; protected = a shield's
    // chime and a gentle two-note fall
    fusionFail(prot) {
      if (!ok('fusionFail', 400)) return;
      if (prot) { tone('triangle', 1320, 1320, 0.25, 0.3); tone('sine', 1980, 1980, 0.35, 0.15, 0.03); tone('triangle', 520, 440, 0.25, 0.3, 0.3); tone('triangle', 440, 330, 0.35, 0.3, 0.55); return; }
      noise(0.09, 'highpass', 7000, 2500, 0.7); tone('square', 1800, 600, 0.06, 0.2);
      for (let i = 0; i < 5; i++) tone('triangle', 2400 - i * 260, 2200 - i * 260, 0.05, 0.12, 0.08 + i * 0.07);
      tone('triangle', 392, 370, 0.3, 0.35, 0.5); tone('triangle', 370, 349, 0.3, 0.35, 0.82); tone('triangle', 349, 262, 0.7, 0.35, 1.14);
    },
  };
})();
