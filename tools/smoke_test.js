'use strict';
// SMOKE TEST (2026-11-20, the user: "Smoke test first"). Opens the game in a hidden Edge window, the way a player would, and
// checks the basics still work: every file loads, the title screen comes up, a new hero can be made, they step out into the
// world, and nothing throws an error on the way. Catches the "stuck in loading" kind of breakage before players do.
//
//   node tools/smoke_test.js                       the test server, http://127.0.0.1:8767/index.html
//   node tools/smoke_test.js --live                the public website's game
//   node tools/smoke_test.js --dir <folder>        a built copy (the release, or site_out/www/play) on a throwaway local server
//   node tools/smoke_test.js <url>                 any address
//   extra: --wait <s> (how long the game may take to load, default 120), --show (a visible window)
//
// It never touches a real save: the browser profile is a fresh throwaway folder, and saving is switched off before the new
// hero is made (the disk copy too). It runs as an automated browser (navigator.webdriver), so the player count skips it. Exit code 0 = passed, 1 = failed (the reasons are printed).
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');

const LIVE = 'https://justforzenonia.github.io/ZenoniaCardHunter/play/';
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .find(p => fs.existsSync(p));   // (Linux: GitHub's machines run it every day, .github/workflows/sitecheck.yml from tools/deploy_github.py)
const argv = process.argv.slice(2), flag = f => argv.includes(f), opt = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const WAIT = (+opt('--wait') || 120) * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// a throwaway static server for --dir (no gzip, like python -m http.server)
function serveDir(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(dir, p); if (!f.startsWith(path.resolve(dir))) { r.writeHead(403); return r.end(); }
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Content-Length': b.length }); r.end(b); });
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv)));
}

async function main() {
  if (!EDGE) { console.log('FAIL: no Edge or Chrome found'); process.exit(1); }
  let url = argv.find(a => /^https?:\/\//.test(a)) || (flag('--live') ? LIVE : 'http://127.0.0.1:8767/index.html'), local = null;
  if (opt('--dir')) { local = await serveDir(path.resolve(opt('--dir'))); url = `http://127.0.0.1:${local.address().port}/index.html`; }
  url += (url.includes('?') ? '&' : '?') + 'smoke=' + Date.now();   // (never a cached page)
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'zch-smoke-'));
  const ed = spawn(EDGE, [...(flag('--show') ? [] : ['--headless=new']), '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--enable-automation', ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
  const fails = [], errors = [], notes = [], urls = new Map(), t0 = Date.now(), step = s => console.log(`  ${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${s}`);
  let ws = null;
  const done = code => { try { ws && ws.close(); } catch (e) {} try { ed.kill(); } catch (e) {} if (local) local.close();
    setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(code); }, 800); };
  try {
    console.log(`SMOKE TEST: ${url.replace(/[?&]smoke=\d+/, '')}`);
    // the DevTools port Edge picked
    let port = null; for (let i = 0; i < 100 && !port; i++) { await sleep(150); try { port = +fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) {} }
    if (!port) throw new Error('Edge did not open its debugging port');
    let page = null; for (let i = 0; i < 40 && !page; i++) { try { const L = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); page = L.find(t => t.type === 'page'); } catch (e) {} if (!page) await sleep(150); }
    if (!page) throw new Error('no browser page');
    ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const wait = new Map();
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
      if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text || '').split('\n').slice(0, 2).join(' | ')); }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + m.params.args.map(a => a.value != null ? a.value : a.description || '').join(' ').slice(0, 300));
      // network trouble is a NOTE, not a failure: the game retries files (a first-request certificate hiccup in a fresh Edge
      // profile is common here), and if a file really never comes the load check above fails anyway. /save, /net/, /market/
      // are the home server's extras: a plain web host answers 404 there, which the game expects.
      if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url.split('?')[0]);
      if (m.method === 'Network.loadingFailed' && !m.params.canceled) notes.push(`${m.params.errorText || 'failed'}: ${(urls.get(m.params.requestId) || '').replace(/^https?:\/\/[^/]+/, '')}`);
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !/favicon|\/(save|net|market)(\/|$)/.test(m.params.response.url)) errors.push(`HTTP ${m.params.response.status}: ${m.params.response.url.split('?')[0]}`);
    };
    const cdp = (method, params = {}) => new Promise(res => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const js = async (expr, ms = 30000) => {
      const r = await Promise.race([cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms).then(() => ({ timeout: true }))]);
      if (r.timeout) throw new Error('page did not answer: ' + expr.slice(0, 60));
      if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text);
      return r.result && r.result.result ? r.result.result.value : undefined;
    };
    await cdp('Runtime.enable'); await cdp('Network.enable'); await cdp('Page.enable');
    await cdp('Page.navigate', { url });
    step('page opened');

    // 1. every file loads and the title screen comes up (main.js removes the #load screen as the very last start-up step: until then
    // start-up is still running and resets GAME.profile, so a hero made before that is wiped)
    let st = null; const tl = Date.now();
    while (Date.now() - tl < WAIT) {
      await sleep(1000);
      try { st = await js(`({ ready: !!(window.GAME && GAME.menu && GAME.scene === 'title' && !document.getElementById('load')), load: (document.getElementById('load') || {}).textContent || '' })`, 5000); } catch (e) { st = null; }
      if (st && st.ready) break;
      if (st && /could not load/i.test(st.load)) break;
    }
    if (!st || !st.ready) throw new Error('the game did not finish loading' + (st && st.load ? `: "${st.load.trim().slice(0, 160)}"` : ''));
    step(`title screen up (menu: ${await js('GAME.menu.type')})`);

    // 2. a new hero (saving off first), out into the world, a few seconds of play
    const r = await js(`(async () => {
      const sl = ms => new Promise(r => setTimeout(r, ms)), out = {};
      GAME.save = () => {}; window.diskSave = () => {};
      out.picks = CLASS_PICKS().map(i => CLASSES[i].name);
      const cls = CLASS_PICKS()[0], m = customMenu(cls, null); m.name = 'Smoke'; m.partner = 'none';
      const NP = window.newProfile; window.newProfile = c => { const p = NP(c); p.worldSeed = WORLD_SEED; return p; };   // (no new-world reload)
      const gh = GAME.goHub; GAME.goHub = () => {};
      try { customDone(GAME, m); } finally { window.newProfile = NP; GAME.goHub = gh; }
      out.hero = GAME.profile && GAME.profile.look && GAME.profile.look.name;
      GAME.goHub(); await sl(800); out.hub = GAME.scene;
      GAME.goAdventure(); await sl(2000);
      for (let i = 0; i < 8 && GAME.menu; i++) { GAME.menu = null; await sl(150); }
      const p = GAME.world && GAME.world.player; out.scene = GAME.scene; out.player = !!p; out.hp = p && p.hp;
      if (p) { const x0 = p.x; keys.add('ArrowRight'); pressed.add('ArrowRight'); await sl(1500); keys.delete('ArrowRight'); out.moved = Math.round(p.x - x0); }
      await sl(1500); out.alive = !!(GAME.world && GAME.world.player && !GAME.world.player.dead);
      return out; })()`, 60000);
    step(`classes: ${r.picks.join(', ')}`);
    if (!r.picks.length) fails.push('the class list is empty');
    if (r.hero !== 'Smoke') fails.push('the new hero was not made');
    step(`new hero "${r.hero}", hub scene: ${r.hub}`);
    if (r.scene !== 'world' || !r.player) fails.push(`did not reach the world (scene: ${r.scene})`);
    else step(`in the world: HP ${r.hp}, walked ${r.moved} px right, still standing: ${r.alive}`);
    if (r.player && !(r.moved > 0)) fails.push('the hero did not move when walking');
  } catch (e) { fails.push(String(e.message || e)); }
  // errors seen on the way (the same one counted once)
  const uniq = [...new Set(errors)];
  if (uniq.length) fails.push(`${uniq.length} error${uniq.length > 1 ? 's' : ''} in the page:\n      ` + uniq.slice(0, 12).join('\n      '));
  if (notes.length) { const n = [...new Set(notes)]; console.log(`  note: ${notes.length} network hiccup${notes.length > 1 ? 's' : ''} (retried): ` + n.slice(0, 4).join(', ') + (n.length > 4 ? ` and ${n.length - 4} more` : '')); }
  console.log(fails.length ? `FAIL (${((Date.now() - t0) / 1000).toFixed(0)} s)\n  - ` + fails.join('\n  - ') : `PASS (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  done(fails.length ? 1 : 0);
}
main();
