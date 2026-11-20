'use strict';
// A SAFER MARKET (2026-11-20; the user said "next": item 4 of "what the game is missing"). The public market board trusted
// whatever item a player's game posted, so an edited game could list impossible gear (stats in the thousands) or a malformed
// item that breaks the buyer's save. The server now refuses anything that is not plainly shaped (tools/serve.py market_item_ok),
// and here each player's own game checks every listing with the game's real rules before showing it: a card must be a real
// species (or a fusion of real cards) at a real rank; gear must be a real slot and rank, with known stats no stronger than
// MKT_CHECK.room times the best the game rolls for that slot and rank (room for quality, forge, honing, legend and unique
// pieces: about 7x at the very most), and real passives and sets. Anything else is simply not listed, so it can't be bought.
const MKT_CHECK = { room: 10, plus: 10, depth: 6, json: 12000 };   // (plus: every boost rounds UP, so a stat of 1 gains about 1 a step: room for ten steps before multiplying)
// the best a fresh piece rolls for a stat at a rank (makeGear in defs.js: the slot's own stats, else the rolled ones), x1.15
function mktStatTop(slot, tier, k) {
  const t = tier, main = { weapon: { atk: 4 + 5 * t }, head: { hp: 8 + 9 * t, def: 1 + 0.72 * t }, body: { hp: 15 + 16 * t, def: 1 + 1.2 * t },
    boots: { def: 1 + 0.5 * t, spd: 2 + 1.2 * t }, accessory: { crit: 2 + 1.6 * t, mp: 5 + 5 * t }, trinket: { atk: 1 + 1.8 * t, mp: 4 + 4 * t } }[slot] || {};
  const roll = (GEAR_ROLLS.pool.find(a => a.k === k) || { v: () => 0 }).v(t);
  return Math.max(main[k] || 0, roll) * 1.15;
}
// plain data only: no functions, no odd keys, finite numbers, short strings, not too deep or too big
function mktPlain(v, d = 0) {
  if (d > MKT_CHECK.depth) return false;
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= 80;
  if (Array.isArray(v)) return v.length <= 12 && v.every(x => mktPlain(x, d + 1));
  if (typeof v !== 'object') return false;
  const K = Object.keys(v); if (K.length > 40) return false;
  return K.every(k => k.length <= 40 && k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && mktPlain(v[k], d + 1));
}
const mktRank = t => Number.isInteger(t) && t >= 0 && t < RANKS.length;
function mktCardOk(c, d = 0) {
  if (!c || typeof c !== 'object' || !mktRank(c.tier)) return false;
  if (c.fusion) return d < 3 && Array.isArray(c.fusion) && c.fusion.length >= 2 && c.fusion.length <= 4 && typeof c.name === 'string' && c.fusion.every(x => mktCardOk(x, d + 1));
  return typeof c.sp === 'string' && Object.prototype.hasOwnProperty.call(SPECIES, c.sp);
}
function mktGearOk(g) {
  if (!g || !GEAR_SLOTS.includes(g.slot) || !mktRank(g.tier) || !g.stats || typeof g.stats !== 'object') return false;
  const known = new Set(['atk', 'hp', 'def', 'crit', 'mp', 'spd', ...GEAR_ROLLS.pool.map(a => a.k)]);
  for (const k in g.stats) {
    const v = g.stats[k];
    if (!known.has(k) || typeof v !== 'number' || v < 0 || v > (mktStatTop(g.slot, g.tier, k) + MKT_CHECK.plus) * MKT_CHECK.room) return false;
  }
  if (g.bonus != null && !(Array.isArray(g.bonus) && g.bonus.length <= 4 && g.bonus.every(b => b && PASSIVE_IDS.includes(b.id) && mktRank(b.tier) && typeof b.mul === 'number' && b.mul > 0 && b.mul <= 3))) return false;
  if (g.q != null && !(Number.isInteger(g.q) && g.q >= 0 && g.q < GEAR_QUALITY.length)) return false;
  if (g.set != null && !Object.prototype.hasOwnProperty.call(GEAR_SETS, g.set)) return false;
  if (g.plus != null && !(Number.isInteger(g.plus) && g.plus >= 0 && g.plus <= (typeof FORGE !== 'undefined' ? FORGE.max : 5))) return false;
  if (g.cls != null && !CLASSES[g.cls]) return false;
  return true;
}
function mktItemOk(kind, it) {
  let s; try { s = JSON.stringify(it); } catch (e) { return false; }
  if (!s || s.length > MKT_CHECK.json || !mktPlain(it)) return false;
  return kind === 'card' ? mktCardOk(it) : kind === 'gear' ? mktGearOk(it) : false;
}
// the CARDS and GEAR tabs list only what passes (your own listings always show, so you can take them back)
{ const rows = mktRows; mktRows = (game, m) => rows(game, m).filter(r => !r.L || r.mine || mktItemOk(r.kind, r.it)); }
// and buying checks again, so nothing odd can reach your save
{ const buy = mktBuy; mktBuy = (game, m, r) => { if (!r.mine && !mktItemOk(r.kind, r.it)) { game.toast("That listing can't be bought: it is not a real item", '#ff8a8a'); return; } return buy(game, m, r); }; }
