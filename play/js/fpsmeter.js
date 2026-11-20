'use strict';
// FRAME-RATE METER for testing on a phone (2026-11-08): open the game with ?fps=1 at the end of the address and a small box in
// the top-left corner shows frames per second, the slowest frame in the last 5 seconds, and how many hitches (frames over
// 50 ms) there were in the last 30 seconds. Without ?fps=1 nothing is added. It times the browser's own frames, so it shows
// what the player feels.
if (/[?&]fps=1/.test(location.search)) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:max(4px, env(safe-area-inset-left));top:max(4px, env(safe-area-inset-top));z-index:20;padding:3px 6px;border-radius:5px;background:rgba(20,12,8,0.78);color:#ffe9a8;font:600 11px/1.3 monospace;pointer-events:none;white-space:pre';
  const add = () => document.body.appendChild(box); if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  const gaps = []; let last = 0, shown = 0;
  (function tick(t) {
    requestAnimationFrame(tick);
    if (last) { gaps.push([t, t - last]); while (gaps.length && t - gaps[0][0] > 30000) gaps.shift(); }
    last = t;
    if (t - shown < 500) return; shown = t;
    const s1 = gaps.filter(g => t - g[0] <= 1000), s5 = gaps.filter(g => t - g[0] <= 5000);
    const fps = s1.length, worst = Math.round(Math.max(0, ...s5.map(g => g[1]))), hitches = gaps.filter(g => g[1] > 50).length;
    const mem = performance.memory ? `  ${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : '';
    box.textContent = `${fps} fps  worst ${worst} ms\nhitches (30 s): ${hitches}${mem}`;
    box.style.color = fps >= 50 && worst < 60 ? '#9fe8a8' : fps >= 30 ? '#ffe9a8' : '#ff9a8a';
  })(performance.now());
}
