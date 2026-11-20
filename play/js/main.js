'use strict';
// Game controller: scenes, input mapping, HUD, toasts, saving, main loop.

const SOLO = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  atk: ['KeyJ', 'KeyF'], spell: [['KeyQ', 'Digit1'], ['KeyE', 'Digit2'], ['KeyR', 'Digit3']], fusion: [], fsel: ['KeyC', 'Digit4'], dash: ['ShiftLeft', 'ShiftRight', 'KeyK'], block: ['KeyL'], layer: ['KeyV', 'Space'], labels: ['Q', 'E', 'R', 'C', 'Shift', 'V', 'L'] };
const PV1 = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], atk: ['KeyF'], spell: [['KeyQ'], ['KeyE'], ['KeyR']], fusion: [], fsel: ['KeyC'], dash: ['ShiftLeft'], block: ['KeyH'], layer: ['KeyG', 'KeyT'], labels: ['Q', 'E', 'R', 'C', 'LShift', 'G', 'H'] };
const PV2 = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], atk: ['KeyK'], spell: [['KeyI'], ['KeyO'], ['KeyP']], fusion: [], fsel: ['Slash'], dash: ['ShiftRight', 'Semicolon'], block: ['Period'], layer: ['KeyL', 'Quote'], labels: ['I', 'O', 'P', '/', 'RShift', 'L', '.'] };
function readPad(map) {
  return {
    mx: (isDown(...map.right) ? 1 : 0) - (isDown(...map.left) ? 1 : 0),
    my: (isDown(...map.down) ? 1 : 0) - (isDown(...map.up) ? 1 : 0),
    atk: hit(...map.atk), spell: map.spell.map(k => hit(...k)), fusion: false, fsel: hit(...map.fsel), block: isDown(...(map.block || [])), dash: hit(...map.dash), layer: hit(...map.layer),
  };
}
// A COPY OF THE SAVE ON DISK (tools/serve.py /save): the browser's storage has come back empty after app restarts, so each save
// is also sent to the local server, at most every 4 s (and once more as the page closes). Only game.save does this: a co-op guest
// replaces game.save (net.js) and the test tools stub it, so neither ever writes the real game's copy.
const DISK = { gap: 4000, last: 0, timer: null, pend: null };
function diskSave(pr) {
  DISK.pend = pr; if (DISK.timer) return;
  DISK.timer = setTimeout(() => { DISK.timer = null; const p = DISK.pend; DISK.pend = null; if (!p) return; DISK.last = Date.now(); fetch('save', { method: 'POST', body: JSON.stringify(p) }).then(r => { if (!r.ok) throw 0; DISK.okAt = Date.now(); DISK.fails = 0; }).catch(() => { DISK.fails = (DISK.fails || 0) + 1; DISK.failAt = Date.now(); }); }, Math.max(0, DISK.gap - (Date.now() - DISK.last)));
}
addEventListener('pagehide', () => { if (DISK.pend && navigator.sendBeacon) { navigator.sendBeacon('save', JSON.stringify(DISK.pend)); DISK.pend = null; } });
// at start-up, when the browser has no save but the disk copy does, it comes back (never for a guest joining a friend's room)
// A save that can't be read (damaged, or written by a test) must never stop the game from opening: it is set aside, untouched,
// under zenonia_card_hunters_v1_bad, and the game goes on as if there were none, so the disk copy (diskRestore) can put the
// last good save back.
function safeLoad() {
  try { let raw = null; try { raw = localStorage.getItem('zenonia_card_hunters_v1'); } catch (e0) {} const g = loadGame(); if (raw && !g) throw new Error('unreadable'); const p = migrateProfile(g); if (p && !Array.isArray(p.gear)) throw new Error('no gear'); return p; }   // (a garbled save reads as nothing: treat it as damaged so a backup can step in)
  catch (e) {
    console.warn('Save could not be read; set aside', e);
    try { const raw = localStorage.getItem('zenonia_card_hunters_v1'); if (raw) { localStorage.setItem('zenonia_card_hunters_v1_bad', raw); localStorage.removeItem('zenonia_card_hunters_v1'); } } catch (e2) {}
    // the newest backup that reads cleanly takes its place (savefile.js keeps them in 'zch_backups')
    try { for (const B of JSON.parse(localStorage.getItem('zch_backups') || '[]')) { try { const p = migrateProfile(JSON.parse(B.data)); if (p && Array.isArray(p.gear)) { localStorage.setItem('zenonia_card_hunters_v1', B.data); console.warn('Save restored from a backup'); return p; } } catch (e3) {} } } catch (e4) {}
    return null;
  }
}
function diskRestore() {
  if (game.saved || /[?&]join=/.test(location.search)) return Promise.resolve();
  return fetch('save').then(r => (r.ok ? r.json() : null)).then(p => {
    if (!p || !p.lv || !Array.isArray(p.gear)) return;
    let m; try { m = migrateProfile(p); } catch (e) { return; }   // (a damaged disk copy is left alone too)
    saveGame(p); game.saved = m; game.diskRestored = true;
  }).catch(() => {});
}
const NO_INPUT = { mx: 0, my: 0, atk: false, spell: [false, false, false], fusion: false };

const game = {
  profile: null, saved: safeLoad(), reveals: [], scene: 'title', world: null, menu: { type: 'title', cur: 0 }, toasts: [],
  save() { if (this.profile) { if (this.profile.shopBought && this.profile.shopBought.length > 40) this.profile.shopBought = this.profile.shopBought.slice(-24); saveGame(this.profile); this.saved = this.profile; diskSave(this.profile); } },
  toast(str, col = '#fff') { this.toasts.push({ str, col, t: 0 }); if (this.toasts.length > 5) this.toasts.shift(); if (col !== '#ff8a8a' || /black hole/i.test(str)) logAdd(this, str, col); },   // (the log keeps what happened, not 'you can't do that')
  openMenu(m) { this.menu = m; },
  closeMenu() { this.menu = null; this.refreshPlayer(); },
  openDialog(name, line, role) { this.menu = dialogMenu(name, line, role); },
  refreshPlayer() {
    const w = this.world;
    if (!w || !w.player || !this.profile || this.scene === 'arena') return;
    const old = w.player, fresh = makePlayerActor(this.profile, 0, old.x, old.y);
    // keep the fight state — incl. the Layer skill (transcendence, cooldown, exhaustion) so opening the inventory
    // never cancels or resets it
    keepFightState(old, fresh);   // mid-dash, mid-cast or stunned: carry on exactly where it was
    for (const b of fresh.sup || []) fresh.passives[b.k] = (fresh.passives[b.k] || 0) + b.v;   // (support cards' buffs too)
    if (fresh.kiSurge) kiSurgeStat(fresh, 2);   // (its stats were rebuilt from scratch)
    fresh.hp = Math.max(1, Math.round(fresh.maxHp * old.hp / old.maxHp));
    fresh.mp = Math.min(fresh.maxMp, old.mp);
    w.actors[w.actors.indexOf(old)] = fresh; w.player = fresh;
    // familiars follow the deck: replace them with the current picks
    w.actors = w.actors.filter(a => !(a.ally && a.owner === old && !a.pet));
    w.respawns = w.respawns.filter(r => r.owner !== old || r.pet);
    for (const a of w.actors) if (a.pet && a.owner === old) a.owner = fresh;   // the dog stays (same HP, same place)
    for (const r of w.respawns) if (r.pet && r.owner === old) r.owner = fresh;
    spawnFamiliars(w, fresh);
    if (!w.respawns.some(r => r.pet)) spawnDog(w, fresh);
  },
  // The whole game world is one overworld; `from` only picks where in town you appear.
  goTown(from) {
    this.outside = null;
    grantCoins(this);
    const spawn = from === 'home' ? { x: HOME_DOOR.x, y: HOME_DOOR.y + 18, dir: 2 } : { x: VILLAGE.spawn[0] * T + 8, y: VILLAGE.spawn[1] * T + 8, dir: 2 };
    this.world = makeOverworld(this, spawn); this.scene = 'world';
    if (from === 'start') this.toast('Welcome to Hearthvale! Your home is in the south-east · the road west leads into the Wilds', '#ffe9a8');
  },
  // the PvP hub is the main screen; everything else comes and goes from it
  goHub() {
    this.outside = null; this.arena = null; this.world = null;
    grantCoins(this);
    this.scene = 'hub'; this.menu = hubMenu();
    this.save();
  },
  // Adventure always begins in Hearthvale: the road west out of town leads into the Wilds (no jumping ahead to a zone)
  // an adventure starts inside your home in Hearthvale; out the door, the road west leads into the Wilds
  goAdventure() {
    this.goTown('home'); enterHome(this, typeof homePointDoor === 'function' ? homePointDoor(this.profile) : null);   // (your home point: towns.js)
    this.toast(typeof homePointOf === 'function' && homePointOf(this.profile) != null ? `Home sweet home in ${homePlace(this.profile)}` : 'Home sweet home — step outside and take the road west into the Wilds', '#ffe9a8');
  },
  backToTitle() {
    this.profile = this.saved || newProfile(0);
    this.world = makeOverworld(this, { x: ALTAR.x, y: ALTAR.y + 40 }); this.world.player.alpha = 0;
    this.scene = 'title'; this.profile = null; this.arena = null; this.menu = { type: 'title', cur: this.saved ? 1 : 0 };   // (CONTINUE picked when there is a save)
  },
  goTraining() {   // the training dummy in the coliseum (training.js)
    this.arena = { training: true, cpu: false, wins: [0, 0], round: 1, state: 'fight', banner: { str: 'TRAINING', t: 1100, t0: 1100 } };
    this.world = makeTrainingArena(this); this.scene = 'arena';
  },
  goArena(p2, cpu) {
    this.arena = { p2, cpu, wins: [0, 0], round: 1, state: 'fight', banner: { str: 'Round 1', t: 1300 } };
    this.world = makeArena(this, this.profile, p2, cpu); this.scene = 'arena';
  },
  gainExp(n) {
    const pr = this.profile;
    const meal = this.world && this.world.player && this.world.player.meal;
    if (meal && meal.exp) n = Math.round(n * meal.exp);
    partnerExp(this, n);
    if (pr.lv >= MAX_LV) return;
    pr.exp += n;
    let ups = 0;
    while (pr.lv < MAX_LV && pr.exp >= expNeed(pr.lv)) { pr.exp -= expNeed(pr.lv); pr.lv++; ups++; }
    if (ups) {
      this.refreshPlayer();
      const p = this.world && this.world.player;
      if (p) {
        p.hp = p.maxHp; p.mp = p.maxMp; p.invuln = Math.max(p.invuln || 0, 1500);
        const w = this.world;
        for (let k = 0; k < 3; k++) w.rings.push({ x: p.x, y: p.y, r: 36 + k * 22, t: -k * 120, col: k ? '#fff0b0' : '#ffd23f' });
        // the shockwave: everything close is thrown back and stunned for a moment
        for (const m of w.actors) if (m.kind === 'monster' && !m.ally && !m.dead) {
          const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy); if (d > 90 || d < 1) continue;
          m.vx = dx / d * 240; m.vy = dy / d * 240; m.stun = Math.max(m.stun || 0, 600); if (m.state !== 'air') { m.state = 'hurt'; setAnim(m, 'hurt', true); }
        }
        w.flash = { t: 0, dur: 500, col: '#fff6c8' }; w.shake = Math.max(w.shake || 0, 4);
        if (typeof SFX !== 'undefined') { SFX.smite(); setTimeout(() => SFX.cast(), 160); }
      }
      if (pr.lv >= RESET_LV && typeof tipEvent === 'function') tipEvent(this, 'reset');   // stat reset unlocked
      logAdd(this, `LEVEL UP! You reached Lv ${pr.lv}`, '#ffd23f');
      this.levelFx = { t: 0, lv: pr.lv, ups, gains: { hp: LV_GROWTH.hp * ups, mp: LV_GROWTH.mp * ups, atk: Math.round(LV_GROWTH.atk * ups), pts: POINTS_PER_LV * ups } };
    }
    this.save();
  },
  pickup(d) {
    const pr = this.profile;
    if (typeof SFX !== 'undefined') SFX.pickup();
    if (d.kind === 'card') {
      if (pr.cards.length >= 120 && !d.force) {   // a full collection never loses a card: it waits in Storage at home (d.force: one-of-a-kind rewards)
        pr.storage = pr.storage || { cards: [], gear: [] }; pr.storage.cards.push(d.item); this.toast(`Collection full: ${cardName(d.item)} sent to Storage at home`, '#ffd27a'); return;
      }
      pr.cards.push(d.item); logAdd(this, `New card: ${cardName(d.item)} (rank ${RANKS[d.item.tier]})`, rankColor(d.item.tier));
      questEvent(this, 'card');
      if (pr.deck.length < deckMax(pr)) pr.deck.push(d.item.uid);
      // an empty Q/E/R slot takes the new card straight away
      pr.spells = pr.spells || [];
      const free = [0, 1, 2].find(i => !pr.spells[i] || !pr.cards.some(c => c.uid === pr.spells[i]));
      if (free !== undefined && !d.item.fusion && equipSpell(this, d.item.uid, free)) { this.refreshPlayer(); this.toast(`${cardName(d.item)} equipped to ${'QER'[free]}`, '#8fffd0'); }
      this.reveals.push({ card: d.item, t: 0 });   // card flips from its back to its face
      if (this.reveals.length > 3) this.reveals.shift();
    } else if (d.kind === 'relic') {
      pr.relics = pr.relics || []; pr.relics.push(d.item);
      this.toast(`RELIC! ${d.item.name} — ${relicLine(d.item)}. Set it on a pedestal at home`, '#ffd23f'); logIcon(this, d.item.icon);
    } else if (d.kind === 'item') {
      addItem(pr, d.item.id, d.item.n || 1); this.toast(`Found ${ITEMS[d.item.id].name}`, '#e8d8a8'); logIcon(this, itemIcon(d.item.id));
    } else if (d.kind === 'goods') {
      pr.goods = pr.goods || {};
      pr.goods[d.item.idx] = (pr.goods[d.item.idx] || 0) + 1;
      this.toast(`Found ${d.item.name}`, '#e8d8a8'); logIcon(this, d.item.icon);
      tipEvent(this, 'goods');
    } else {
      if (pr.gear.length >= 80) { this.toast('Gear storage full (80)', '#ff8a8a'); return; }
      pr.gear.push(d.item);
      this.toast(`Gear! [${RANKS[d.item.tier]}] ${d.item.name}`, rankColor(d.item.tier)); logIcon(this, d.item.icon);      // auto-equip upgrades
      const upgraded = equipBest(pr);
      if (upgraded.includes(d.item)) { this.toast(`Equipped ${d.item.name} (upgrade)`, '#8fffd0'); this.refreshPlayer(); }
    }
    this.save();
  },
};
if (game.saved) game.menu.cur = 1;   // with a save, the title starts on CONTINUE: Enter carries on, it never starts a new hero by accident

// ---------------------------------------------------------------- scene updates
// keys pressed during a freeze frame count on the first frame after it
function flushPressBuf(w) {
  if (!w.pressBuf || w.hitStop > 0) return;
  for (const k of w.pressBuf) pressed.add(k);
  w.pressBuf = null;
}
function updateWorldScene(dt) {
  const w = game.world, p = w.player;
  flushPressBuf(w);
  if (game.net) { netRollKeys(game); netChatKeys(game); netEmoteKeys(game); if (isDown('Enter') && netNearDowned(game, w)) pressed.delete('Enter'); }   // online co-op: the quick-chat wheel, and Enter beside a fallen friend revives instead of talking (netparty.js)
  const safe = w.interior ? !w.dojoRoom : !w.cave && !w.rift && inTown(p.x);   // town and houses are peaceful: talk instead of attacking (the Dojo is for fighting; indoors, map coordinates mean nothing to inTown)
  const calm = safe && !w.rockCave;   // a rock cave is entered like a house (its doors and Enter work as indoors), but it has monsters: you fight there
  if (w.dojoRoom && !w.dojo && hit('Enter') && townInteract(game, w)) return;   // the Dojo Master waits: Enter talks (and starts the match)
  if (hit('Tab', 'KeyI')) { game.openMenu(inventoryMenu(game)); return; }
  if (hit('KeyT') && game.net && netTradeKey(game, w)) return;   // trade with a friend beside you (online co-op: nettrade.js)
  if (hit('Escape') || clicked(MENU_CORNER.x, MENU_CORNER.y, MENU_CORNER.w, MENU_CORNER.h)) { game.openMenu(pauseMenu()); return; }   // pause: resume / main menu / exit
  if (hit('KeyM')) { game.openMenu(journeyMenu()); return; }
  if (storyTrackerH(game) && clicked(VW - 220, 14, 216, 30)) { game.openMenu(journalMenu(game)); return; }   // THE STORY JOURNAL (storybeats.js)
  if (hit('KeyB')) { game.openMenu(diningMenu()); return; }   // MEAL TIME: the eating screen
  if (hit('KeyY')) { game.openMenu(titlesMenu()); return; }   // TITLES
  if (hit('KeyP') || clicked(SEASON.pill.x, SEASON.pill.y, SEASON.pill.w, SEASON.pill.h)) { game.openMenu(seasonMenu()); return; }   // THE SEASON
  if (hit('KeyX') || clicked(GLOG.pill.x, GLOG.pill.y, GLOG.pill.w, GLOG.pill.h)) { game.openMenu(logMenu()); return; }   // THE LOG
  if (hit('KeyZ') || clicked(CRAFT.pill.x, CRAFT.pill.y, CRAFT.pill.w, CRAFT.pill.h)) { game.openMenu(craftMenu()); return; }   // THE WORKSHOP
  if (hit('KeyO') || clicked(SETS.pill.x, SETS.pill.y, SETS.pill.w, SETS.pill.h)) { game.openMenu(setsMenu()); return; }   // CARD SETS
  if ((hit('KeyU') || clicked(TOWER.pill.x, TOWER.pill.y, TOWER.pill.w, TOWER.pill.h)) && !w.cave && !w.rift && w.overworld && !w.interior) { game.openMenu(towerMenu()); return; }   // THE ABYSS TOWER
  if (isDev(game.profile) && (hit('Backquote') || clicked(DEV_BTN.x, DEV_BTN.y, DEV_BTN.w, DEV_BTN.h))) { game.openMenu(devMenu()); return; }   // OmegaKingX's developer panel
  devTick(game, w);
  titlesTick(game, dt);
  if (hit(HERO_P.key) && !(partnerOf(game.profile) || {}).dead) { game.openMenu(partnerMenu()); return; }   // the Hero Partner (heropartner.js)
  if (hit('KeyN')) { if (petsOf(game.profile).length) { game.openMenu(petMenu()); return; } game.toast('No partner yet — adopt a dog with Loyal Hound at the Farm Board', '#c9c1a8'); }
  tipsTick(game, dt);
  hungerTick(game, w, dt);
  autoEatTick(game, w, dt);   // the Auto Feast farm skill
  petTick(game, w, dt);       // the dog's hunger
  dayTick(game, w, dt); restTick(game, dt); partnerBondTick(w, dt);
  if (hit('KeyH') && !w.cave && !w.rift && !leadingBlocks(game)) { game.goHub(); return; }
  if (!calm) beltInput(game);   // the item belt: 5–8, P, or a click
  if (hit('Enter') && !w.interior && vehParkedInteract(game, w)) return;   // get in the parked car (vehicles.js)
  if (safe && !w.interior && hit('Enter') && saleDoorEnter(game, w)) return;   // a house for sale (houses.js)
  if (safe && !p.duelLive && (calm ? hit('Enter', 'KeyJ', 'KeyF', 'Space') : hit('Enter')) && (homeInteract(game, w) || townInteract(game, w))) return;   // (in a duel J swings)
  if (!safe && hit('Enter') && !w.interior && (wellInteract(game, w) || wellLuck(game, w))) return;   // a Windmill Hill well (wellquest.js)
  if (!safe && hit('Enter') && typeof tpInteract === 'function' && tpInteract(game, w)) return;   // a travel point or a goddess (travelpoints.js)
  if (!safe && hit('Enter') && storyNpcInteract(game, w)) return;   // someone a chapter sent you to find (storybeats.js)
  if (!safe && hit('Enter') && wandererInteract(game, w)) return;   // a traveller in the Wilds
  if (hit('Enter') && w.overworld && !w.interior && nodeGather(game, w)) return;   // a herb patch or ore vein (nodes.js)
  if (hit('Enter') && w.overworld && !w.interior && animalLead(game, w)) return;   // a wild animal to lead (animals.js)
  const inp = readPad(coopOn(game) ? coop1Map() : SOLO);   // (in co-op the arrows belong to Player 2: coop.js)
  chiTick(game, w, dt);   // the Ki gauge (chi.js)
  const mine = calm && !p.duelLive ? { ...inp, atk: false, spell: [false, false, false], fusion: false, layer: false, block: false } : inp;
  if (calm) p.layerReq = false;
  const drive = vehicleInput(game, w, mine);   // the 9 key, parking in town, no fighting at the wheel (vehicles.js)
  const p2in = coopInput(game, w, safe, dt);   // Player 2 (coop.js)
  const netIn = game.net && game.net.role === 'host' ? netGuestInputs(game, w, safe, dt) : null;   // online friends (net.js)
  // (your shadow, the last boss, plays as the arena's computer player: shadowself.js)
  stepWorld(w, dt, a => a === p ? drive : a.netGid ? ((netIn && netIn[a.netGid]) || NO_INPUT) : a.coop2 ? (p2in || NO_INPUT) : a.shadowSelf && !a.dead && !p.dead ? cpuInput(w, a, p, dt) : NO_INPUT);
  if (p.x === p.x && p.y === p.y) p.lastGoodPos = { x: p.x, y: p.y };   // SAFETY NET: a hero whose position turned NaN (a bad push or teleport) would break the camera,
  else { const g = p.lastGoodPos || { x: HOME_DOOR.x + TOWN_OX, y: HOME_DOOR.y + TOWN_OY + 18 }; p.x = g.x; p.y = g.y; p.vx = p.vy = 0; if (!updateWorldScene.nanWarned) { updateWorldScene.nanWarned = true; console.warn('hero position was NaN: put back', g); } }   // and with it culling: the whole world drawn every frame
  vehicleAfter(game, w, dt); vehShieldTick(game, w, dt);   // a crash at full speed, the car's shield (vehicles.js)
  if (w.interior) { dojoTick(game, w, dt); updateInterior(game, w, dt, inp); return; }
  if (w.cave) { updateCave(game, w, dt); return; }
  if (w.rift) { updateRift(game, w, dt); return; }
  updateOverworld(game, w, dt);
  if (game.world === w && evilGateTick(game, w, dt)) return;   // the dark teleporter (evilgate.js)
  if (game.world === w) updateRandomChests(game, w, dt);
  if (game.world === w && updateCaves(game, w, dt)) return;
  if (game.world === w) { bgmTick(w); updateZoneEvents(game, w, dt); updateWanderers(game, w, dt); grandpaTick(game, w, dt); storyTick(game, w); dailyTick(game, w); trialTick(game, w); landmarkTick(game, w); sqTick(game, w); grandpaFade(game, w, dt); rentTick(game, w, dt); landlordFade(w, dt); safeTick(game, w, dt); sideTick(game, w, dt); }   // events, travellers, Grandpa, the rent
  if (game.world === w && w.overworld && !w.interior && zoneDoorTick(game, w, dt, inp)) return;   // the giant trees and the camps (tentfolk.js)
  if (safe && checkDoors(game, w, dt, inp)) return;
  if (p.x > w.bounds.x1 - 16) { p.x = w.bounds.x1 - 24; game.openMenu(arenaMenu()); }
}
function updateArenaScene(dt) {
  const w = game.world, A = game.arena;
  flushPressBuf(w);
  if (A.banner) {
    A.banner.t -= dt;
    if (A.banner.t <= 0) A.banner = A.banner.str.startsWith('Round') ? { str: 'FIGHT!', t: 650, t0: 650 } : null;   // ROUND n ... FIGHT!
  }
  if (A.ranked && !w.rankPrimed) { w.rankPrimed = true; for (const a of w.actors) if (a.cds && a.spells) { for (let i = 0; i < 3; i++) if (a.spells[i]) a.cds[i] = a.spells[i].cd; if (a.kind === 'player') a.layerCd = a.layerCdMax = layerCdOf(a) * RANKED_RULES.layerCd; } }   // ranked: every round opens with the spells and the Layer on cooldown (RANKED_RULES)
  if (A.state === 'match') {
    if (A.ranked) { if (!A.resolved) finishRanked(game, A.wins[0] === 2); stepWorld(w, dt, () => NO_INPUT); return; }
    if (hit('Enter')) game.goArena(A.p2, A.cpu);
    if (hit('Escape')) game.goHub();
    stepWorld(w, dt, () => NO_INPUT);
    return;
  }
  if (hit('Escape')) { if (A.ranked) { A.wins = [0, 2]; A.state = 'match'; } else game.goHub(); return; }   // leaving a ranked match = forfeit
  const frozen = A.banner && A.state === 'fight' && A.banner.str.startsWith('Round');
  stepWorld(w, dt, a => {
    if (frozen || A.state !== 'fight') return NO_INPUT;
    if (a === w.player) return readPad(PV1);
    if (A.training) return NO_INPUT;
    return A.cpu ? cpuInput(w, a, w.player, dt) : readPad(PV2);
  });
  if (A.training) { trainingTick(w, dt); if (w.player.dead || w.player.hp <= 0) { w.player.hp = w.player.maxHp; w.player.dead = false; } return; }   // (no rounds: the dummy never falls)
  if (A.state === 'fight') {
    const loser = [w.player, w.p2].find(a => a.dead);
    if (loser) {
      const winner = loser === w.player ? w.p2 : w.player;
      A.wins[winner.pvp]++;
      winner.state = 'win'; winner.dir = 2; setAnim(winner, 'win', true);
      A.state = 'roundEnd'; A.timer = 2600;
      // K.O.: slow motion, a white flash and a heavy camera kick
      w.slowmo = 900; w.flash = { t: 0, dur: 320, col: '#ffffff' }; w.shake = Math.max(w.shake, 7);
      if (typeof SFX !== 'undefined') SFX.kill();
      A.banner = { str: 'K.O.!', sub: `${arenaName(winner.pvp)} wins the round`, t: 2400, t0: 2400 };
    }
  } else if (A.state === 'roundEnd') {
    A.timer -= dt;
    if (A.timer <= 0) {
      if (A.wins[0] === 2 || A.wins[1] === 2) { A.state = 'match'; }
      else {
        A.round++;
        game.world = makeArena(game, game.profile, A.p2, A.cpu);
        A.state = 'fight'; A.banner = { str: 'Round ' + A.round, t: 1300, t0: 1300 };
      }
    }
  }
}
// who is fighting: your hero's name, the ranked rival's name, or CPU / P2
function arenaName(side) {
  const A = game.arena, pr = game.profile;
  if (side === 0) return (pr && pr.look && pr.look.name) || 'P1';
  return A && A.ranked ? A.ranked.name : A && A.cpu ? 'CPU' : 'P2';
}
function stepWorld(w, dt, inputFor) {
  if (w.hitStop > 0) {   // frozen for impact — but remember every key pressed meanwhile (replayed when it ends)
    w.hitStop -= dt / HIT_STOP;
    if (pressed.size) w.pressBuf = new Set([...(w.pressBuf || []), ...pressed]);
    for (const a of w.actors) if (a.kind === 'player' && !a.dead) { const i = inputFor(a); if (i && i.dash) a.dashBuf = 200; }
    return;
  }
  if (w.slowmo > 0) { w.slowmo -= dt; dt *= 0.4; }
  const P = w.player;
  for (const a of w.actors) {
    // monsters far off-screen sleep until the hero comes near (keeps the big world fast)
    if (a.kind === 'monster' && !a.ally && P && Math.abs(a.x - P.x) > 520 && a.state === 'free') continue;
    if (a.state !== 'win') updateActor(w, a, dt, inputFor(a)); else a.t += dt;
  }
  updateEntities(w, dt);
}

// ---------------------------------------------------------------- drawing
function drawScene(now) {
  const w = game.world;
  ctx.fillStyle = '#160f09'; ctx.fillRect(0, 0, VW, VH);
  if (game.scene === 'hub') { arenaBackdrop(now, 0.6); return; }   // the colosseum behind every hub screen
  if (!w) return;
  let cam;
  if (game.scene === 'arena') cam = cameraFor(w, { x: (w.player.x + w.p2.x) / 2, y: (w.player.y + w.p2.y) / 2 });
  else cam = cameraFor(w, (game.net && netSpectateTarget(game, w)) || (coopOn(game) ? coopCamTarget(w) : w.player));   // (a downed online guest watches a friend: netquest.js)   // (in co-op, between you both)
  if (game.scene === 'title') cam = { x: Math.round(clamp(ALTAR_W.x - WVW / 2 + Math.sin(now / 6000) * 60, w.bounds.x0, w.bounds.x1 - WVW)), y: Math.round(ALTAR_W.y - WVH / 2 - 10) };
  const safe = game.scene === 'world' && (w.interior ? !w.dojoRoom && !w.rockCave : !w.cave && !w.rift && inTown(w.player.x));   // (a rock cave shows the fighting HUD)
  w.showTags = game.scene === 'world' && !safe;
  drawWorld(w, cam, w.bg, now);
  ctx.save(); ctx.scale(ZOOM, ZOOM); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  if (game.net && game.scene === 'world') { drawNetDuelRing(game, now); drawNetRevive(game, w, now); }   // a duel's ring, fallen friends (netduel.js, netparty.js)
  if (game.scene === 'world' && !w.interior && !w.cave && !w.rift) { drawDoorHints(w, now); if (w.overworld) drawZoneDoors(w, now); }   // (the dark teleporter is drawn with the world, sorted by depth)
  if (w.interior) text('▼ Exit', w.entry.x, w.entry.y + 10, 'rgba(255,233,168,0.8)', 7);
  if (game.scene === 'world' && !w.interior && !w.cave && !w.rift) {
    text('◀ TO THE WILDS', TOWN_OX + VILLAGE.west[0] * T + 30, TOWN_OY + VILLAGE.west[1] * T - 14, '#ffd23f', 8);
    text('Fusion Fountain', ALTAR_W.x, ALTAR_W.y - 60, '#ffe9a8', 8);
  }
  ctx.restore();

  if (game.scene === 'world') {
    const p = w.player;
    drawDayNight(w, cam, now);
    drawWeather(w, now);
    drawHUD(p, 0, now, w.name);
    if (coopOn(game)) drawCoopHud(game, w, now);   // Player 2 (coop.js)
    else if (game.net && game.net.role === 'guest') netGuestHud(game, w, now);
    else if (game.net && game.net.role === 'host') netHostHud(game, w, now);   // your friends' panels (net.js)
    if (game.net) { drawNetChatBubbles(game, w, now, cam); drawNetDuelHud(game, now); drawNetChatWheel(game, now); drawNetEmoteWheel(game); drawNetPq(game, w, now); drawNetSpectate(game, w); drawNetFishers(game, w, cam); drawNetRoll(game); }   // (speech bubbles on the screen layer: crisp, not stretched by the camera's zoom)   // a duel's names and countdown, the quick-chat wheel (netduel.js, netparty.js)   // an online guest: the host's panel, and their own fall (net.js)
    if (!w.interior) drawClock(now);
    drawZoneEventHud(game, now);
    if (!safe) drawSpellBar(p, SOLO.labels, VW / 2, VH - 44, now);
    if (!safe && !game.menu) drawItemBelt(game, now);   // potions and the like, right of the skill bar
    drawDogButton(game, now);   // the hound's own button (N)
    if (!game.menu) drawBuffList(p, game.profile, partnerOf(game.profile) && !partnerOf(game.profile).dead ? HERO_P.hud.y + HERO_P.hud.h + 4 : 76, now);   // every buff and debuff with its time left (buffbar.js)
    drawVehicleChip(game, now);   // (vehicles.js)
    drawSeasonPill(game, now); drawTowerPill(game, now); drawSetsPill(game, now); drawCraftPill(game, now); drawPartnerPill(game, now); drawPartnerHud(game, now); drawRelicHud(game, now); drawRestChip(game); drawLogPill(game, now); drawLogFeed(game, now); drawBuffChips(game);
    if (w.rift) (w.rift.evil ? drawEvilOverlay : w.rift.raid ? drawRaidOverlay : w.rift.tower ? drawTowerOverlay : drawRiftOverlay)(w, now);
    if (!game.menu) { const dy = coopOn(game) || (game.net && (game.net.role === 'guest' || netGuestList(game).length)) ? 72 + Math.max(0, netGuestList(game).length - 1) * 16 + 50 : 0; ctx.save(); ctx.translate(0, dy); drawStoryTracker(game, w, now); drawQuestTracker(game, now); ctx.restore(); drawReturnPointer(game, w, now); drawBossBar(game, w, now); }   // (in co-op the trackers sit under Player 2's HUD)
    if (!game.menu && !game.levelFx && !game.holeBanner) drawBanner(game, now, Math.max(0, Math.min(50, now - (game.bannerLast || now)))); game.bannerLast = now;   // (an area banner waits for a level-up to finish)
    drawTip(game, now, Math.max(0, Math.min(50, now - (game.tipLast || now)))); game.tipLast = now;
    drawLevelUp(game, w, cam, now);
    drawTitleFx(game, now);   // a new title sweeps in
    drawHoleBanner(game, now);
    if (game.net && game.net.role === 'guest') keyHints(',: chat · Enter: talk · T: trade or duel · Tab: inventory · Esc: leave the room', VH - 11, '#cfe4ff');   // (a guest can't talk or go home from here: net.js)
    else if (safe) keyHints('Tab: inventory · Enter: talk · H: back to the Hub', VH - 11);   // (keycaps on a soft pill: hud.js)
    if (!game.menu) { drawMenuCorner(now); drawDevButton(game, now); }
  }
  if (game.scene === 'arena') {
    const A = game.arena;
    drawHUD(w.player, 0, now, `${arenaName(0)} · ${className(w.player.cls)}`); drawBuffList(w.player, game.profile, 72, now);   // (buffbar.js)
    if (A.training) { drawSpellBar(w.player, PV1.labels, VW / 2, VH - 44, now); drawTrainingPanel(w, now); }   // (training.js)
    else { drawHUD(w.p2, 1, now, `${arenaName(1)} · ${className(w.p2.cls)}`);
    drawSpellBar(w.player, PV1.labels, VW * 0.25, VH - 44, now);
    drawSpellBar(w.p2, PV2.labels, VW * 0.75, VH - 44, now); }
    if (!A.training) for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
      ctx.fillStyle = A.wins[i] > k ? '#ffd23f' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(i === 0 ? 8 + k * 9 : VW - 15 - k * 9, 62, 7, 4);
    }
    if (A.banner) {
      const B = A.banner, k = 1 - B.t / (B.t0 || B.t || 1), pop = 1 + 0.9 * Math.max(0, 1 - k * 6);
      const ko = B.str === 'K.O.!', fight = B.str === 'FIGHT!';
      goldText(B.str.toUpperCase(), VW / 2, VH / 2 - 46, (ko ? 36 : fight ? 30 : 22) * pop,
        ko ? { glow: 'rgba(255,60,40,0.9)', spacing: 4, cols: ['#ffffff', '#ffd860', '#ff3a1a', '#ffe8a0'] } : { glow: 'rgba(255,200,80,0.8)', spacing: 3 });
      if (B.sub) text(B.sub, VW / 2, VH / 2 - 18, '#ffffff', 9);
    }
    if (A.state === 'match' && !A.ranked) {
      panel(140, 140, 360, 70, '#ffd23f');
      const win = A.wins[0] === 2 ? 0 : 1;
      text(`${arenaName(win).toUpperCase()} WINS THE MATCH!`, VW / 2, 162, win === 0 ? '#ff8a7a' : '#7fc0ff', 18);
      text('Enter: rematch · Esc: back to the Hub', VW / 2, 190, '#e8e2cf', 10);
    }
  }
  if (w.spellName && game.scene !== 'title') {
    const s = w.spellName;
    const sz = s.big ? 11 : 8.5, fit = Math.max(8, Math.min(sz, sz * (VW * 0.7) / Math.max(1, textW(s.str, sz))));   // long layered names shrink to fit
    if (s.cannon != null && s.life) drawCannonShout(s, now); else text(s.str, VW / 2, 84, s.col, fit);
  }
  if (game.scene === 'world') drawCannonWords(w, now);   // the Spirit Cannon's words climbing as it charges (hud.js)
  if (game.net && game.scene === 'world' && !game.menu) drawNetPartyArrows(game, w, now, cam);   // friends off screen: on top of everything (netparty.js)
}

// Picked-up cards fly in face-down, flip to reveal, then slide away (stacked top-right).
// new cards flip in at the right: a little smaller, and at most three at once (cozy, 2026-11-06; they were 76 by 118, all at once)
const REVEAL_LOOK = { w: 62, h: 96, max: 3 };
function drawReveals(dt, now) {
  const full = game.menu && ['inv', 'fusion', 'custom', 'class', 'title', 'layerscene'].includes(game.menu.type);
  game.reveals.forEach((r, i) => {
    if (i >= REVEAL_LOOK.max) return;   // (the rest wait their turn: a big haul comes in three at a time)
    r.t += dt;
    if (full) return;
    const T = r.t, W = REVEAL_LOOK.w, H = REVEAL_LOOK.h;
    const inK = Math.min(1, T / 300), outK = Math.max(0, (T - 2300) / 300);
    const x = VW - 44 - i * (W + 8) + (1 - inK) * 80 + outK * 80, y = 124;
    const flip = Math.min(1, Math.max(0, (T - 300) / 450));
    ctx.save(); ctx.globalAlpha = Math.min(inK, 1 - outK);
    if (flip >= 0.5) {   // reveal burst
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const b = Math.max(0, 1 - (T - 525) / 500);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, 60);
      rg.addColorStop(0, rankColor(r.card.tier, now)); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha *= 0.35 * b + 0.1; ctx.fillStyle = rg;   // (a gentle glow) ctx.fillRect(x - 60, y - 60, 120, 120);
      ctx.restore();
    }
    drawCardFlip(r.card, x, y, W, H, flip, now);
    ctx.restore();
  });
  game.reveals = game.reveals.filter(r => r.t < 2600);
}
// the message pills: cozy and brief (2026-11-06: softer, smaller, shorter, one new one at a time: sessionrecap.js TOAST_PACE)
const TOAST_LOOK = { life: 2600, size: 8.2, fill: 'rgba(46,28,18,0.72)', edge: 'rgba(255,214,150,0.5)' };
function drawToasts(dt) {
  const full = game.menu && ['inv', 'fusion', 'custom', 'class', 'title', 'gacha', 'layerscene', 'pause'].includes(game.menu.type);   // keep big screens clean (and the pause menu: news lines sat over RESUME; they are in the log)
  game.toasts.forEach((t, i) => {
    if (full) { t.t += dt; return; }
    t.t += dt;
    // each toast sits on a soft dark pill so it reads over any ground; it slides in from a little above, and when an older
    // one goes the rest glide up into place instead of jumping (a new one rises in from just below)
    const news = game.scene === 'hub' && game.menu && game.menu.type === 'hub' && typeof HUB_L !== 'undefined', j = i - Math.max(0, game.toasts.length - 2);   // on the hub: the newest two, in the news strip along the foot (pvp.js HUB_L)
    if (news && j < 0) return;
    const a = Math.min(1, (TOAST_LOOK.life - t.t) / 400, t.t / 200), ty = news ? HUB_L.news + j * 13 : 70 + i * 13 + (game.scene === 'arena' ? 30 : 0);
    t.y = t.y == null ? ty + 6 : Math.abs(ty - t.y) > 60 ? ty : t.y + (ty - t.y) * Math.min(1, dt / 90);   // (a jump across the screen, into or out of the hub's strip, just snaps)
    ctx.globalAlpha = Math.max(0, a);
    const S = TOAST_LOOK, tw = textW(t.str, S.size) + 14; ctx.fillStyle = S.fill; rrect(ctx, VW / 2 - tw / 2, t.y - 5, tw, 10, 5); ctx.fill();   // a warm cocoa pill with a soft gold edge
    ctx.strokeStyle = S.edge; ctx.lineWidth = 0.6; rrect(ctx, VW / 2 - tw / 2 + 0.3, t.y - 4.7, tw - 0.6, 9.4, 4.7); ctx.stroke();
    text(t.str, VW / 2, t.y, t.col === 'rainbow' ? '#ffd23f' : t.col, S.size);
    ctx.globalAlpha = 1;
  });
  game.toasts = game.toasts.filter(t => t.t < TOAST_LOOK.life);
}

// a hero rebuilt from their profile (new gear, a level) keeps the fight state: the Layer skill (transcendence, cooldown,
// exhaustion), spell cooldowns, buffs, a dash or a stun, the car. Used by refreshPlayer and for an online Player 2 (net.js)
function keepFightState(old, fresh) {
  for (const k of ['dir', 'state', 'anim', 't', 'loop', 'z', 'vz', 'combo', 'comboT', 'cds', 'fgauge', 'dead', 'driving', 'vDir', 'vStun', 'vSpd', 'vPrev', 'vWant', 'vFroze', 'steps', 'transcend', 'transcendMax', 'cannonCharge', 'layerCd', 'layerCdMax', 'lxpRun', 'exhausted', 'layerEl', 'layerSel', 'arcT', 'fusionUsed', 'layeredT', 'dashCd', 'dashing', 'dash', 'trail', 'castLen', 'invuln', 'chi', 'chiT', 'chiMax', 'chiAt', 'kiCharge', 'chiOn', 'chiLv', 'kiSurge', 'kiSurgeAt', 'stun', 'vx', 'vy', 'juggled', 'blockT', 'blockHeld', 'wellFed', 'heatT', 'sharpT', 'smokeT', 'buffAtk', 'status', 'sup', 'duelId', 'duelLive']) if (old[k] !== undefined) fresh[k] = old[k];
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);   // asked for first, so an error in one frame can't stop the game for good
  if (typeof SET !== 'undefined' && SET.fps === 30 && now - last < 29) return;   // FRAME RATE 30 (settings.js; phones start there): every other screen frame is skipped, so a phone runs cooler
  const dt = Math.max(0, Math.min(50, now - last)); last = now;
  if (!game.menu && game.scene === 'hub') game.menu = hubMenu();   // closing Deck / Summon / Versus returns to the hub
  const m = game.menu;
  if (m) {
    ({ title: updateTitle, class: updateClass, inv: updateInventory, fusion: updateFusion, arena: updateArena, dialog: updateDialog, login: updateLoginBoard, season: updateSeason, tower: updateTowerMenu, sets: updateSets, custom: updateCustom, charpick: updateCharPick, craft: updateCraft, glog: updateLog, credits: (g, m2, d) => updateCredits(g, m2, d), curio: updateCurio, ritual: updateRitual, sleep: updateSleep, decor: updateDecor, decorplace: updateDecorPlace, trophies: updateTrophies, heropartner: updateHeroPartner, pstyle: updatePartnerStyle, evilpick: updateEvilPick, partnerwarn: updatePartnerWarn, gacha: updateGacha, quest: updateQuestMenu, journey: updateJourneyMenu, trials: updateTrialsMenu, tlfish: updateFish, tlforge: updateForge, tlduel: updateDuel, tlboard: updateBoard, tlcrier: updateCrier, tlbook: updateFishBook, hub: updateHub, vs: updateVs, pvpres: updatePvpRes, zones: updateZones, pause: updatePause, shop: updateShop, storage: updateStorage, pedestal: updatePedestal, kitchen: updateKitchen, plant: updatePlant, farm: updateFarmMenu, pantry: updatePantry, wardrobe: updateWardrobe, dining: updateDining, pet: updatePetMenu, campfire: updateCampfire, titles: updateTitlesMenu, travel: updateTravel, goddess: (g, mm, dt) => updateGoddess(g, mm, dt), buyhome: updateBuyHome, homepoint: updateHomePoint, journal: updateJournal, netmenu: updateNetMenu, ntrade: updateNetTrade, ntask: updateNetAsk, nduelask: updateNetDuelAsk, nrunask: updateNetRunAsk, layerscene: updateLayerScene, raid: updateRaidMenu, dev: updateDev, mbook: (g, m2, d) => updateMonsterBook(g, m2, d), dojoboard: (g, m2, d) => updateDojoBoard(g, m2, d), dojoroad: (g, m2, d) => updateDojoRoad(g, m2, d), market: (g, m2, d) => updateMarket(g, m2, d) })[m.type](game, m, dt);
    if (game.world && game.scene === 'title') { updateEntities(game.world, dt); for (const a of game.world.actors) if (a.kind === 'npc') updateActor(game.world, a, dt, NO_INPUT); }
  } else if (game.scene === 'world') { if (game.net && game.net.role === 'guest') netGuestFrame(game, dt); else updateWorldScene(dt); }   // (an online guest only draws the host's world: net.js)
  if (game.scene === 'world' && game.world && game.net && game.net.role === 'host') netHostTick(game, game.world, dt);   // (online co-op host: keeps talking to the guest even while a menu is open, net.js)
  else if (game.scene === 'arena') updateArenaScene(dt);
  frameReset();   // (core.js: no leftover filter or blend from the last frame)
  drawScene(now);
  const mm = game.menu;
  if (mm) ({ title: drawTitle, class: drawClass, inv: drawInventory, fusion: drawFusion, arena: drawArenaMenu, dialog: drawDialog, login: drawLoginBoard, season: drawSeason, tower: drawTowerMenu, sets: drawSets, custom: drawCustom, charpick: drawCharPick, craft: drawCraft, glog: drawLog, credits: (g, m2, t) => drawCredits(g, m2, t), curio: drawCurio, ritual: drawRitual, sleep: drawSleep, decor: drawDecor, decorplace: drawDecorPlace, trophies: drawTrophies, heropartner: drawHeroPartner, pstyle: drawPartnerStyle, evilpick: drawEvilPick, partnerwarn: drawPartnerWarn, gacha: drawGacha, quest: drawQuestMenu, journey: drawJourneyMenu, trials: drawTrialsMenu, tlfish: drawFish, tlforge: drawForge, tlduel: drawDuel, tlboard: drawBoard, tlcrier: drawCrier, tlbook: drawFishBook, hub: drawHub, vs: drawVs, pvpres: drawPvpRes, zones: drawZones, pause: drawPause, shop: drawShop, storage: drawStorage, pedestal: drawPedestal, kitchen: drawKitchen, plant: drawPlant, farm: drawFarmMenu, pantry: drawPantry, wardrobe: drawWardrobe, dining: drawDining, pet: drawPetMenu, campfire: drawCampfireMenu, titles: drawTitlesMenu, travel: drawTravel, goddess: (g, mm, now) => drawGoddess(g, mm, now), buyhome: drawBuyHome, homepoint: drawHomePoint, journal: drawJournal, netmenu: drawNetMenu, ntrade: drawNetTrade, ntask: drawNetAsk, nduelask: drawNetDuelAsk, nrunask: drawNetRunAsk, layerscene: drawLayerScene, raid: drawRaidMenu, dev: drawDev, mbook: (g, m2, t) => drawMonsterBook(g, m2, t), dojoboard: (g, m2, t) => drawDojoBoard(g, m2, t), dojoroad: (g, m2, t) => drawDojoRoad(g, m2, t), market: (g, m2, t) => drawMarket(g, m2, t) })[mm.type](game, mm, now);
  playTick(game, dt);   // the playtime clock (journey.js)
  drawReveals(dt, now);
  drawToasts(dt);
  endFrameInput();
}

preloadAll().then(diskRestore).then(() => new Promise(r => setTimeout(r, 30))).then(() => {   // (a moment for the 'Building' line to show)
  // title backdrop: the town with villagers wandering
  game.profile = game.saved || newProfile(0);
  game.world = makeOverworld(game, { x: ALTAR.x, y: ALTAR.y + 40 });
  game.world.player.alpha = 0;
  game.scene = 'title';
  game.profile = null;
  let auto = false; try { auto = sessionStorage.getItem('zch_autostart') === '1'; sessionStorage.removeItem('zch_autostart'); } catch (e) {}
  if (auto && game.saved) { game.profile = game.saved; game.closeMenu(); game.goHub(); }   // just made a new hero: their new world is ready
  if (game.diskRestored) { game.toast(`Save restored from disk: ${(game.saved.look && game.saved.look.name) || 'your hero'}, Lv ${game.saved.lv}`, '#8fffb0'); if (game.menu && game.menu.type === 'title') game.menu.cur = 1; }   // (CONTINUE picked)
  { const s = document.getElementById('load'); if (s) s.remove(); }
  requestAnimationFrame(frame);
});

window.GAME = game;

