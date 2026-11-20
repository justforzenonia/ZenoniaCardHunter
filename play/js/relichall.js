'use strict';
// THE RELIC HALL'S TWO RITES. RESONANCE: relics of one type on the pedestals power each other: 2, 4 and 6 of a type each give a stronger passive, and six
// different types give Harmony. Pedestals that match are joined to the circle by lines of light, and the circle takes their colour.
// THE RITUAL: stand on the circle and offer three spare relics (none on a pedestal). They fuse into one relic a rank above their average, of the type most of them were.
const RESO = { steps: [[2, 1], [4, 3], [6, 5]],
  types: { atk: { name: 'Ember Resonance', id: 'brutal', col: '#ff7a3a' }, def: { name: 'Titan Resonance', id: 'hide', col: '#b8c8ff' }, hp: { name: 'Bloom Resonance', id: 'regen', col: '#7aea8a' }, mp: { name: 'Prism Resonance', id: 'mana', col: '#6ac8ff' }, spd: { name: 'Feather Resonance', id: 'swift', col: '#8fffd0' }, crit: { name: 'Eye Resonance', id: 'crit', col: '#ffd23f' } },
  harmony: { name: 'Harmony', id: 'barrier', col: '#ffffff', tier: 3 } };
const RITE = { need: 3, mul: { guardian: 2.2, hole: 1.6 }, forge: 1700, reveal: 700, r: 34, col: '#ffd27a' };
const relicOn = pr => (pr.pedestals || []).map(id => id && (pr.relics || []).find(x => x.uid === id)).filter(Boolean);
function resonanceOf(pr) {
  const n = {}, on = relicOn(pr); for (const r of on) n[r.type] = (n[r.type] || 0) + 1;
  const out = [];
  for (const t in n) { const step = RESO.steps.filter(s => n[t] >= s[0]).pop(); if (step) out.push({ type: t, n: n[t], tier: step[1], ...RESO.types[t] }); }
  if (Object.keys(n).length >= PEDESTALS) out.push({ type: 'all', n: PEDESTALS, tier: RESO.harmony.tier, ...RESO.harmony });
  return out.sort((a, b) => b.n - a.n);
}
const relicPassives = pr => resonanceOf(pr).map(R => ({ id: R.id, tier: R.tier, mul: 1, trait: null }));
const resoText = R => `${PASSIVES[R.id].name} ${PASSIVES[R.id].fmt(passiveValue(R.id, R.tier))}`;
// what three relics become
function riteResult(list) {
  const n = {}; for (const r of list) n[r.type] = (n[r.type] || 0) + 1;
  const type = Object.keys(n).sort((a, b) => n[b] - n[a])[0], tier = Math.min(9, Math.floor(list.reduce((s, r) => s + r.tier, 0) / list.length) + 1), mul = Math.max(1, ...list.map(r => RITE.mul[r.src] || 1)), R = RELIC_TYPES[type];
  return { type, tier, val: Math.max(1, Math.round((tier + 1) * R.per * mul * 10) / 10), src: mul > 1.6 ? 'guardian' : mul > 1 ? 'hole' : 'rite', name: `Forged ${R.name}`, icon: homeIcon(R.icon) };
}
const riteSpare = pr => { const on = new Set((pr.pedestals || []).filter(Boolean)); return (pr.relics || []).filter(r => !on.has(r.uid)).sort((a, b) => a.tier - b.tier); };
function riteMenu() { return { type: 'ritual', cur: 0, scroll: 0, sel: [], t: 0, st: 'pick' }; }
function riteRows(pr, m) {
  const ready = m.sel.length === RITE.need, res = ready && riteResult(riteSpare(pr).filter(r => m.sel.includes(r.uid)));
  const rows = [{ begin: true, icon: homeIcon(22), name: ready ? 'BEGIN THE RITUAL' : `Choose ${RITE.need - m.sel.length} more relic${RITE.need - m.sel.length === 1 ? '' : 's'}`, sub: ready ? `Becomes ${res.name}: ${RELIC_TYPES[res.type].fmt(res.val)} · rank ${RANKS[res.tier]}` : 'The three relics are used up', col: ready ? '#ffd23f' : '#9aa4b8', dim: !ready }];
  for (const r of riteSpare(pr)) rows.push({ ref: r, icon: r.icon, name: r.name, sub: relicLine(r), col: rankColor(r.tier), right: m.sel.includes(r.uid) ? '✔' : '', rightCol: '#8fffb0' });
  return rows;
}
function updateRitual(game, m, dt) {
  const pr = game.profile;
  if (m.st === 'forge') { m.t += dt; if (m.t >= RITE.forge) { m.st = 'done'; m.t = 0; } return; }
  if (m.st === 'done') { m.t += dt; if (m.t > 300 && (hit('Enter', 'Space', 'Escape') || mouse.click)) { m.st = 'pick'; m.sel = []; m.cur = 0; m.scroll = 0; m.got = null; } return; }
  const rows = riteRows(pr, m), nav = panelNav(m, rows.length, 0), r = rows[m.cur]; if (nav.back) { game.closeMenu(); return; }
  if (!nav.ok || !r) return;
  if (r.begin) {
    if (m.sel.length < RITE.need) { game.toast(`The circle needs ${RITE.need} spare relics`, '#c9c1a8'); return; }
    const list = riteSpare(pr).filter(x => m.sel.includes(x.uid)), made = { uid: uid(), ...riteResult(list) };
    m.gone = list; pr.relics = pr.relics.filter(x => !m.sel.includes(x.uid)); pr.relics.push(made); m.got = made; m.st = 'forge'; m.t = 0; game.toast(`The Ritual made ${made.name}: ${RELIC_TYPES[made.type].fmt(made.val)}`, RITE.col); game.save(); return;
  }
  const u = r.ref.uid, i = m.sel.indexOf(u); if (i >= 0) m.sel.splice(i, 1); else if (m.sel.length < RITE.need) m.sel.push(u); else game.toast('Three is all the circle takes', '#c9c1a8');
}
function drawRitual(game, m, now) {
  const pr = game.profile, cx = VW / 2, cy = VH / 2 - 10;
  if (m.st === 'pick') { panelMenu(m, { title: 'THE RITUAL', rows: riteRows(pr, m), empty: 'No spare relics', info: `Offer ${RITE.need} spare relics. They fuse into one a rank above their average.`, keys: '↑↓ choose · Enter offer · Esc close' }, now); return; }
  ctx.fillStyle = 'rgba(4,3,10,0.9)'; ctx.fillRect(0, 0, VW, VH);
  const k = m.st === 'forge' ? m.t / RITE.forge : 1, spin = now / 500;
  ctx.save(); ctx.translate(cx, cy); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 120 + k * 60); g.addColorStop(0, hexA(RITE.col, 0.25 + k * 0.5)); g.addColorStop(1, hexA(RITE.col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 180, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hexA(RITE.col, 0.8); ctx.lineWidth = 1.4; for (const r of [100, 84]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.rotate(spin / 3); ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2; i ? ctx.lineTo(Math.cos(a) * 84, Math.sin(a) * 84) : ctx.moveTo(84, 0); } ctx.stroke(); ctx.restore();
  if (m.st === 'forge') {
    (m.gone || []).forEach((r, i) => { const a = i / RITE.need * Math.PI * 2 + spin * (1 + k * 3), d = 84 * (1 - k * k); iconCentered('items', r.icon, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 20 * (1 - k * 0.5)); });
    if (k > 0.85) { ctx.fillStyle = `rgba(255,255,255,${(k - 0.85) / 0.15})`; ctx.fillRect(0, 0, VW, VH); }
    goldTitle('THE CIRCLE TAKES THEM', cx, 40, 13, now); return;
  }
  const r = m.got, a = Math.min(1, m.t / RITE.reveal); ctx.save(); ctx.globalAlpha = a; iconCentered('items', r.icon, cx, cy + Math.sin(now / 400) * 3, 44 + (1 - a) * 30); ctx.restore();
  goldTitle(r.name.toUpperCase(), cx, cy + 66, 13, now); text(`${RELIC_TYPES[r.type].fmt(r.val)} · rank ${RANKS[r.tier]}`, cx, cy + 84, rankColor(r.tier, now), 9); petInk('Enter: continue', cx, cy + 104, '#9aa4b8', 8, 'center', false);
}
// the hall: lines of light from matching pedestals to the circle, and the circle in their colour
function drawResoLines(o, pr, now) {
  const w = GAME.world, R = resonanceOf(pr); if (!w || !w.homeFeats || !R.length) return null;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const f of w.homeFeats) {
    if (f.kind !== 'pedestal') continue; const id = (pr.pedestals || [])[f.i], r = id && pr.relics.find(x => x.uid === id), res = r && R.find(q => q.type === r.type || q.type === 'all'); if (!res) continue;
    const x0 = f.x, y0 = f.y - 2, k = (now / 1300 + f.i * 0.17) % 1; ctx.strokeStyle = hexA(res.col, 0.34 + 0.16 * Math.sin(now / 300 + f.i)); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(o.x, o.y); ctx.stroke();
    ctx.fillStyle = hexA(res.col, 0.95); ctx.fillRect(x0 + (o.x - x0) * k - 1.5, y0 + (o.y - y0) * k - 1.5, 3, 3);
  }
  ctx.restore(); return R[0].col;
}
const nearRite = (w, p) => { const o = (w.homeFeats || []).find(f => f.kind === 'sigil'); return o && Math.hypot(p.x - o.x, (p.y - o.y) * 1.4) < RITE.r ? o : null; };
function drawRelicHud(game, now) {
  const w = game.world, pr = game.profile; if (!w || !w.hall || w.doorRoom || game.menu) return;
  const X = VW - 150, Y = 96, W = 144, bonus = relicStats(pr), stats = Object.keys(bonus), R = resonanceOf(pr), H = 36 + stats.length * 11 + (R.length ? 13 + R.length * 21 : 22);
  ctx.fillStyle = 'rgba(28,18,12,0.9)'; rrect(ctx, X, Y, W, H, 5); ctx.fill(); ctx.strokeStyle = goldFrameGrad(Y, H); ctx.lineWidth = 1; rrect(ctx, X + 0.5, Y + 0.5, W - 1, H - 1, 5); ctx.stroke();
  goldTitle('THE HALL GIVES', X + W / 2, Y + 11, 9, now); let y = Y + 26;
  if (!stats.length) { petInk('Set a relic on a pedestal', X + W / 2, y, '#9aa4b8', 7.5, 'center', false); y += 11; }
  for (const k of stats) { petInk(RELIC_TYPES[k].fmt(bonus[k]), X + 9, y, '#f0e6d2', 8, 'left'); y += 11; }
  y += 2; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(X + 8, y - 3, W - 16, 1); y += 6;
  if (!R.length) { petInk('Match 2 relics of a type', X + W / 2, y, '#9aa4b8', 7.5, 'center', false); petInk('for Resonance', X + W / 2, y + 10, '#9aa4b8', 7.5, 'center', false); }
  for (const r of R) { petInk(`${r.name}${r.type === 'all' ? '' : ` ${r.n}/${PEDESTALS}`}`, X + 9, y, r.col, 7.5, 'left'); petInk(resoText(r).slice(0, 32), X + 9, y + 10, '#d8d8e0', 7, 'left', false); y += 21; }
}
