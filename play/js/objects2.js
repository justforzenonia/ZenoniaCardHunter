'use strict';
// OBJECTS2: object sprites the main atlas (assets/objects.png) does not have (first: the Zenonia 2 purple dungeon's, for the dusk
// woods' caves; tools/build_cave_maps.py -> assets/objects2.png + GAME_DATA.objects2). At load their banks join D.objects.banks
// and their frames join D.objects.frames, placed BELOW the main atlas (y + its height). Once both images have loaded they are
// stitched into one picture that replaces the main atlas image in the image cache, so every place that draws objects
// (world.js drawObj, drawObjA, map bakes, props) draws these too, unchanged. Until then the new frames just don't show.
(function () {
  const O2 = window.GAME_DATA && GAME_DATA.objects2; if (!O2 || !D.objects) return;
  const first = D.objects.frames.length;
  for (const r of O2.frames) D.objects.frames.push(r ? [r[0], r[1] + O2.base, r[2], r[3], r[4], r[5]] : r);
  for (const [k, B] of Object.entries(O2.banks)) if (!D.objects.banks[k]) D.objects.banks[k] = { f: B.f.map(i => (i >= 0 ? first + i : -1)), anim: B.anim };
  const A = img(D.objects.img), N = img(O2.img);
  const stitch = () => {
    if (!A.complete || !A.naturalWidth || !N.complete || !N.naturalWidth || A.stitched) return;
    const H = A.naturalHeight;
    if (H !== O2.base) for (let i = first; i < D.objects.frames.length; i++) { const r = D.objects.frames[i]; if (r) r[1] += H - O2.base; }   // (the main atlas was rebuilt since: follow its new height)
    const c = document.createElement('canvas'); c.width = Math.max(A.naturalWidth, N.naturalWidth); c.height = H + N.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(A, 0, 0); g.drawImage(N, 0, H);
    A.stitched = true;
    c.toBlob(b => { if (b) A.src = URL.createObjectURL(b); }, 'image/png');
  };
  for (const im of [A, N]) im.addEventListener('load', stitch);
  stitch();
})();
