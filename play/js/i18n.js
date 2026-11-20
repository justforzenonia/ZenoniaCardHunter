'use strict';
// LANGUAGE (2026-11-20, the user asked: "add auto translator English being default"; they picked Spanish, Japanese,
// Portuguese, French, German and Filipino, plus AUTO = follow the device's language).
// Every word the game draws goes through core.js pixText / textW / wrap, and each of those passes it through tr() here.
// English (the default) is untouched: tr() hands the string straight back.
// The translations are BUILT IN (offline, and in the phone app): assets/lang/<code>.json, made by tools/i18n_build.py from
// lang/_work (see DESIGN.md "Language"). Only the chosen language's file is loaded. A string the dictionary does not know
// stays English.
//   exact     "Fully rested" -> "Descansado"
//   patterns  a template literal `Healed ${n} HP` is stored as "Healed {0} HP"; the drawn "Healed 25 HP" matches it, and the
//             pieces that filled the gaps are translated too when they are known words (item names, places…)
//   CAPS      a name the code shouted with toUpperCase() is looked up as written, then matched against the known names
const LANGS = [['en', 'English'], ['auto', 'Auto'], ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'], ['fil', 'Filipino'], ['ja', '日本語']];
const I18N = { lang: 'en', want: 'en', dict: null, pats: null, caps: null, out: new Set(), lines: new Set(), memo: new Map(), loading: null };
// AUTO: the first of the device's languages the game has, else English
function langAuto() {
  let list = []; try { list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']; } catch (e) {}
  for (const l of list) {
    const b = String(l).toLowerCase();
    if (b.startsWith('fil') || b.startsWith('tl')) return 'fil';
    const c = b.slice(0, 2); if (LANGS.some(L => L[0] === c && c !== 'auto')) return c;
  }
  return 'en';
}
const langName = code => (LANGS.find(L => L[0] === code) || LANGS[0])[1];
// the label the LANGUAGE setting shows: a language in its own name; Auto says which one it found
const langLabel = v => (v === 'auto' ? `Auto · ${langName(langAuto())}` : langName(v));
function langRedraw() { I18N.memo.clear(); try { PIX.clear(); TEXTW_MEMO.clear(); } catch (e) {} }
function langSet(want) {
  I18N.want = want || 'en';
  const code = I18N.want === 'auto' ? langAuto() : I18N.want;
  I18N.lang = code; I18N.noPlural = code === 'ja' || code === 'fil'; I18N.dict = I18N.pats = I18N.caps = null; I18N.out.clear(); I18N.lines.clear(); langRedraw();
  if (code === 'en') return;
  const ask = I18N.loading = code;
  fetch(`assets/lang/${code}.json`).then(r => r.json()).then(d => {
    if (I18N.loading !== ask || I18N.lang !== code) return;
    langUse(d); langRedraw();
  }).catch(() => {});
}
function langUse(d) {
  const pats = [], caps = new Map();
  for (const k in d) {
    const v = d[k]; if (typeof v !== 'string' || !v) continue;
    I18N.out.add(v);
    if (/\{\d+\}/.test(k)) {
      const parts = k.split(/(\{\d+\})/), lit = parts.filter((p, i) => i % 2 === 0).join('');
      const src = '^' + parts.map((p, i) => (i % 2 ? '([\\s\\S]*?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$';
      const order = parts.filter((p, i) => i % 2).map(p => +p.slice(1, -1));
      try { pats.push({ re: new RegExp(src), order, to: v, n: lit.length, head: parts[0].slice(0, 2) }); } catch (e) {}
    } else if (k.toUpperCase() !== k) caps.set(k.toUpperCase(), v.toUpperCase());
  }
  pats.sort((a, b) => b.n - a.n);   // (the most specific pattern wins)
  const byHead = new Map(), loose = [];
  for (const p of pats) { if (p.head.length < 2) loose.push(p); else { if (!byHead.has(p.head)) byHead.set(p.head, []); byHead.get(p.head).push(p); } }
  I18N.dict = d; I18N.pats = { byHead, loose }; I18N.caps = caps;
}
function trPat(s) {
  const P = I18N.pats; if (!P) return null;
  const list = (P.byHead.get(s.slice(0, 2)) || []).concat(P.loose);
  let best = null;
  // (a loose pattern like "{0} set" must not swallow an English sentence: its own words are at least a quarter of the
  // string, and no gap holds more than four words)
  const ok = (p, m) => p.n * 4 >= s.length && m.slice(1).every(g => g.split(' ').length <= 4);
  for (const p of list) { if (best && p.n <= best.p.n) continue; const m = p.re.exec(s); if (m && ok(p, m)) best = { p, m }; }
  if (!best) return null;
  const vals = []; best.p.order.forEach((k, i) => { vals[k] = best.m[i + 1]; });
  return best.p.to.replace(/\{(\d+)\}/g, (_, k) => { const v = vals[+k]; return v == null ? '' : /^e?s$/.test(v) && I18N.noPlural ? '' : /[A-Za-z]{2}/.test(v) ? tr(v) : v; });   // (an English plural s, `card${n > 1 ? 's' : ''}`, is dropped where the language has none)
}
// translate one drawn string (English stays as it is)
function tr(str) {
  if (I18N.lang === 'en' || !I18N.dict || typeof str !== 'string' || str.length < 2) return str;
  const hit = I18N.memo.get(str); if (hit !== undefined) return hit;
  let out = str;
  if (!I18N.out.has(str) && !I18N.lines.has(str) && /[A-Za-z]{2}/.test(str)) {
    // core: the words without the decoration round them (spaces, arrows, ◀ ▶, bullets), which is put back as it was
    const D = I18N.dict, core = str.replace(/^[^A-Za-z0-9("'¡¿]+/, '').replace(/[^A-Za-z0-9)!?.%"']+$/, ''), lead = str.slice(0, str.indexOf(core)), tail = str.slice(lead.length + core.length);
    const t = D[str] || (core !== str && D[core] && lead + D[core] + tail) || I18N.caps.get(core) && lead + I18N.caps.get(core) + tail || trPat(str);
    if (t) out = t;
    else if (core && core !== str && core.length < str.length) { const c = tr(core); if (c !== core) out = lead + c + tail; }
  }
  if (I18N.memo.size > 6000) I18N.memo.clear();
  I18N.memo.set(str, out); if (out !== str) I18N.out.add(out);
  return out;
}
function trLines(lines) {
  if (I18N.lang === 'en' || !I18N.dict) return;
  if (I18N.lines.size > 4000) I18N.lines.clear();
  for (const l of lines) I18N.lines.add(l);
}
// Japanese has no spaces: wrap (core.js) breaks its lines between characters instead of words
const trNoSpaces = () => I18N.lang === 'ja';
langSet((() => { try { return JSON.parse(localStorage.getItem('zch_settings') || '{}').lang || 'en'; } catch (e) { return 'en'; } })());
