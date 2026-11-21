// The game's loader. index.html loads this file fresh every time (?v=), and it fetches every script itself:
// on this PC the local server sometimes stalls a big download (assets/data.js is ~2 MB) and cuts it off, which used
// to leave a black screen. Each file is fetched with a time limit and retried until it arrives whole, then all of
// them run in order.
(async function boot() {
  const FILES = ['assets/data.js', 'assets/z2fields.js', 'assets/items2.js', 'assets/card_frames.js', 'assets/chef_body.js', 'assets/archer_body.js', 'assets/custom_banks.js', 'assets/cave_arch.js', 'assets/extra_npcs.js', 'assets/extra_npcs2.js', 'assets/raid_bosses.js', 'assets/raid_bosses2.js', 'assets/traps.js', 'assets/cave_maps.js', 'assets/objects2.js', 'assets/vehicles.js', 'assets/vehicles8.js', 'assets/home_art.js', 'assets/spell_fx.js', 'assets/spellcraft.js', 'assets/kiblast.js', 'js/i18n.js', 'js/core.js', 'js/objects2.js', 'js/sfx.js', 'js/defs.js', 'js/folk.js',
    'js/style.js', 'js/effects.js', 'js/combat.js', 'js/worldgen.js', 'js/world.js', 'js/townair.js', 'js/plateaus.js', 'js/townterrace.js', 'js/fieldpatches.js', 'js/villagegrass.js', 'js/props.js', 'js/caves.js', 'js/rifts.js', 'js/journey.js', 'js/daynight.js', 'js/events.js', 'js/dining.js', 'js/pet.js', 'js/wanderers.js', 'js/story.js', 'js/rent.js', 'js/titles.js', 'js/safepoints.js', 'js/dojo.js', 'js/towns.js', 'js/mimic.js', 'js/sideareas.js', 'js/ki.js',
    'js/houses.js', 'js/ui.js', 'js/heroparts.js', 'js/charmake.js', 'js/heropartner.js', 'js/partnerstyle.js', 'js/weaponlook.js', 'js/inventory.js', 'js/loadouts.js', 'js/deckplus.js', 'js/charsheet.js', 'js/invextras.js', 'js/layers.js', 'js/guard.js', 'js/foeguard.js', 'js/foecharge.js', 'js/foeroles.js', 'js/combopay.js', 'js/riposte.js', 'js/elemreact.js', 'js/elemweak.js', 'js/flawless.js', 'js/breather.js', 'js/foewindup.js', 'js/statustimer.js', 'js/laststretch.js', 'js/lootsweep.js', 'js/rally.js', 'js/foeturns.js', 'js/calmfoes.js','js/combattitles.js','js/foeelite.js', 'js/cards.js', 'js/hud.js', 'js/combotimer.js', 'js/cardchain.js', 'js/ecnegun.js', 'js/reacthint.js', 'js/aimmark.js','js/gacha.js', 'js/quests.js', 'js/tips.js', 'js/pvp.js', 'js/training.js', 'js/trainreact.js', 'js/buffbar.js', 'js/dev.js', 'js/storybeats.js', 'js/layerscene.js', 'js/chapters.js', 'js/daily.js', 'js/bosses.js', 'js/shadowself.js', 'js/trials.js', 'js/landmarks.js', 'js/townlife.js', 'js/chi.js', 'js/wellquest.js', 'js/sidequests.js', 'js/kibomb.js', 'js/pachinko.js', 'js/casino.js', 'js/cabinet.js', 'js/questmark.js',
    'js/home.js', 'js/rainyday.js', 'js/shop.js', 'js/season.js', 'js/tower.js', 'js/collection.js', 'js/sites.js', 'js/animals.js', 'js/nodes.js', 'js/farmyard.js', 'js/farmrow.js', 'js/craft.js', 'js/folkday.js', 'js/curios.js', 'js/farmboard.js', 'js/relichall.js', 'js/bondcards.js', 'js/deckcircuit.js', 'js/evilgate.js', 'js/layerswords.js', 'js/durability.js', 'js/raidcards.js', 'js/raids.js', 'js/tentfolk.js', 'js/homelife.js', 'js/gamelog.js', 'js/skillforms.js', 'js/arcana2.js', 'js/bgm.js', 'js/vehicles.js', 'js/coop.js', 'js/net.js', 'js/nettrade.js', 'js/netduel.js', 'js/netparty.js', 'js/netboss.js', 'js/netquest.js', 'js/netfarm.js', 'js/netdungeon.js', 'js/netpets.js', 'js/netplay.js', 'js/netsocial.js', 'js/netsfx.js', 'js/netsidekick.js', 'js/main.js', 'js/arcana2gift.js', 'js/unlocks.js', 'js/settings.js', 'js/touch.js', 'js/gamepad.js', 'js/savearchive.js', 'js/book.js', 'js/arcanabook.js', 'js/followfix.js', 'js/radar.js', 'js/beltmove.js', 'js/sessionrecap.js', 'js/mirror.js', 'js/lookchat.js', 'js/cues.js', 'js/savemark.js', 'js/pats.js', 'js/photo.js', 'js/bedtime.js', 'js/diary.js', 'js/dojolesson.js', 'js/journal.js', 'js/rockcaves.js', 'js/origcaves.js', 'js/cavetraps.js', 'js/cavemap.js', 'js/cavehazards.js', 'js/desert.js', 'js/vehsound.js', 'js/phonetype.js', 'js/savefile.js', 'js/credits.js', 'js/staticmode.js', 'js/appupdate.js', 'js/cloudsave.js', 'js/feedback.js', 'js/playcount.js', 'js/fpsmeter.js', 'js/deckcursor.js', 'js/bigsummon.js', 'js/travelpoints.js', 'js/goddess.js', 'js/roadfolk.js', 'js/z2links.js', 'js/fusionguide.js', 'js/bondpick.js', 'js/tidyworld.js', 'js/goddesstown.js', 'js/towngates.js', 'js/z2tint.js', 'js/morecards.js', 'js/market.js', 'js/marketcheck.js', 'js/cavepath.js', 'js/foodcards.js', 'js/cavetreasure.js', 'js/rankladder.js', 'js/housevisitors.js'];
  const v = '1.0.0-20261120200207', status = document.getElementById('load');
  try { if (status && sessionStorage.getItem('zch_autostart') === '1') status.textContent = 'Building your new world…'; } catch (e) {}
  // THE LOADING BAR (2026-11-08, release prep): every download reports its bytes, and the message under the logo becomes
  // "Loading… 42%" over a thin gold bar. (core.js replaces the message with 'Building the world…' once the scripts run.)
  const PROG = { got: {}, want: {}, at: 0 };
  const progShow = force => {
    const now = performance.now(); if (!status || (!force && now - PROG.at < 120)) return; PROG.at = now;
    let g = 0, w = 0; for (const k in PROG.want) { w += PROG.want[k]; g += Math.min(PROG.got[k] || 0, PROG.want[k]); }
    const pct = PROG.top = Math.max(PROG.top || 0, w ? Math.min(99, Math.floor(100 * g / w)) : 0), mb = (g / 1048576).toFixed(1);   // (never steps back when a big file's size arrives late)
    status.innerHTML = `<div style="text-align:center">Loading… ${pct}%<div style="margin:8px auto 0;width:220px;height:6px;border-radius:3px;background:rgba(201,168,90,0.2);overflow:hidden"><div style="height:100%;width:${pct}%;background:#c9a85a"></div></div><div style="margin-top:6px;font-size:11px;opacity:0.7">${mb} MB</div></div>`;
  };
  // A download is only given up when it STALLS (no new bytes for a while), never for being slow: over a real phone
  // connection the 12 MB art pack takes many seconds, and the old fixed limits (0.5 s, then 2 s, 4 s…) cut it off every
  // time. (A stalled request on this PC's local server never recovers, so a short stall still gets a quick retry.)
  async function getBytes(url) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const ac = new AbortController(), stallMs = attempt ? Math.min(12000, 3000 * attempt) : 1500;
      let timer = setTimeout(() => ac.abort(), stallMs); const poke = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(), stallMs); };
      try {
        const r = await fetch(attempt ? `${url}?v=${v}_${attempt}` : `${url}?v=${v}`, { signal: ac.signal });
        // (2026-11-20, the user: "stuck in loading" on the website) GitHub Pages sends files gzipped, and its content-length is the
        // ZIPPED size while the body arrives unzipped and bigger, so the whole-file check failed every time: a zipped reply is not size-checked
        const zipped = !!r.headers.get('content-encoding'), want = zipped ? 0 : +(r.headers.get('content-length') || 0); if (want) PROG.want[url] = want; PROG.got[url] = 0; poke();
        let buf;
        if (r.body && r.body.getReader) {
          const rd = r.body.getReader(), parts = []; let n = 0;
          for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; PROG.got[url] = n; poke(); progShow(); }
          const u8 = new Uint8Array(n); let o = 0; for (const p of parts) { u8.set(p, o); o += p.length; } buf = u8.buffer;
        } else buf = await r.arrayBuffer();
        clearTimeout(timer);
        if (r.ok && buf.byteLength && (!want || buf.byteLength === want)) { PROG.got[url] = PROG.want[url] = buf.byteLength; progShow(true); return buf; }   // only a whole file counts
      } catch (e) { clearTimeout(timer); }
      PROG.got[url] = 0;
      if (status) status.textContent = `Loading… (retrying ${url.split('/').pop()})`;
    }
    throw new Error('could not load ' + url);
  }
  const getText = url => getBytes(url).then(b => new TextDecoder('utf-8').decode(b));
  // every image in one file (tools/build_pack.py): one request instead of hundreds. If it won't come, the images load one by one as before.
  // Big downloads crawl on this PC (about 1.5 MB/s), so the pack is kept in the browser's cache, under its version: only new art downloads it again.
  async function packBytes() {
    const ver = (await getText('assets/pack.ver')).trim(), key = `pack-${ver}`; let box = null;
    try { box = await caches.open('zch-pack'); const hit = await box.match(key); if (hit) return await hit.arrayBuffer(); } catch (e) { box = null; }
    const b = await getBytes('assets/pack.bin');
    if (box) box.keys().then(old => Promise.all(old.map(k => box.delete(k)))).then(() => box.put(key, new Response(b.slice(0)))).catch(() => {});
    return b;
  }
  const pack = location.search.includes('nopack') ? Promise.resolve(null) : packBytes().then(b => { const n = new DataView(b).getUint32(0, true), index = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(b, 4, n))); return { bytes: new Uint8Array(b, 4 + n), index }; }).catch(() => null);
  const first = getText(FILES[0]); await first.catch(() => {});   // the biggest file goes alone: it stalled when it had to race the others
  const texts = FILES.map((f, i) => i ? getText(f) : first);   // all the rest start at once…
  window.ASSET_PACK = await pack;
  for (let i = 0; i < FILES.length; i++) {   // …and run in order
    let src;
    try { src = await texts[i]; } catch (e) { if (status) status.textContent = `Could not load ${FILES[i]} — check that the game server is running, then reload.`; return; }
    const s = document.createElement('script');
    s.textContent = src + `\n//# sourceURL=${FILES[i]}`;
    document.body.appendChild(s);
  }
  // (the images load next: preloadAll, core.js, counts them here and clears this message)
})();
