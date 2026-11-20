// Helpful tips while you play, shown in a "status window" (assets/ui_status_warm.png: a dark cocoa panel in a gold frame, recoloured from the blue ui_status.png
// with a winged crown). Each tip appears once per save (profile.tips), slides in on the left, stays a few
// seconds and slides away; click it to dismiss early. Tips come from events (tipEvent) and from checks each
// frame (tipsTick). Kept rare on purpose: only the tips that matter, and a long quiet gap between any two
// (urgent ones — low HP, dash, rift, cave, anything right in front of you — only wait a short gap). The queue never holds more
// than two. Most tips are checks in TIP_WATCH: what's beside you now, then the game's bigger systems, spaced out by time spent in
// the Wilds. A tip longer than the panel turns its pages by itself.
const TIPS = {
  lowhp:    ['LOW HP!', 'Shift dashes out of danger, even mid-combo. Press 5, 6, 7 or 8 to use a potion from your item belt.'],
  goods:    ['GOODS', 'Potions and materials go to Tab ▸ BAG ▸ GOODS (press G); food has its own MEAL TIME screen (press B).'],
  ripe:     ['CROPS READY', 'Your crops are ripe! Head home to the farm and press Enter on a plot to harvest, then cook them in your kitchen.'],
  stuck:    ['STUCK?', 'Cannot get out? Open Tab and press T (TELEPORT HOME) to return to Hearthvale.'],
  hungry:   ['HUNGRY!', 'Hunger is down to 30%. Press B (or click the hunger bar) for MEAL TIME — meals and snacks also give strong buffs.'],
  stats:    ['STAT POINTS', 'You have unspent stat points! Open Tab ▸ STATS to raise STR, VIT, INT, DEX or AGI. Spend with care: points can only be reset from level 50.'],
  dog:      ['YOUR DOG', 'Grandpa is keeping your dog until you farm. Reach Farm Level 2, then spend a point on LOYAL HOUND at the Farm Board — he brings it back to fight beside you.'],
  dogpartner: ['YOUR HOUND', 'Press N for its partner menu: feed it, give it a card to cast and train it. Its violet paw arrow points to black holes. Give it food in its FOOD BAG (N ▸ FOOD) to keep it alive. If it falls, reviving takes 20 food.'],
  reset:    ['STAT RESET', 'Level 50! You can now reset your stat points for free, any time: Tab ▸ STATS ▸ Reset points (R).'],
  layer:    ['LAYER SKILL', 'Press V to transcend (+40%). Each layer earns its own XP from monsters you kill while transcended in it — pick cards on the HUD (Q/E/R/C) and press V again to LAYER them into one skill. Spend its XP on Tab ▸ LAYER to unlock its burst, element strike and ascended blows.'],
  gbreak:   ['GUARD BREAK', 'Your shield ran out of stamina. Blocking drains the bar under your hero (and the L button), and every blow you soak costs more. Lower your guard for a moment and it refills; you can raise it again at 40%.'],
  crusher:  ['GUARD CRUSHER', 'A red ring under a boss means a GUARD CRUSHER: it smashes through a block. Step out of the ring, or block just as it lands for a PERFECT PARRY.'],
  foeguard: ['SHIELDED FOE', 'That monster raised a shield: hits from the front barely scratch it. Strike from the side or behind, or use your combo finisher and spells to wear its guard down. Once it breaks it is pinned for a BREAK RUSH: every hit lands harder, and a combo finisher SHATTERS it.'],
  pdodge:   ['PERFECT DODGE', 'You dashed just as a blow landed! A perfect dodge makes your dash ready again at once, and right after it, press attack for the PAYBACK move of your class (or any hit is a COUNTER for 60% more damage). A perfect parry opens the same window.'],
  charger:  ['CHARGER!', 'A red lane on the ground means a monster is about to charge down it. Step out of the lane, or dash through it just as it hits for a PERFECT DODGE. After the charge it is dazed and takes extra damage.'],
  foeroles: ['MONSTERS WITH A JOB', 'Watch the names: an ARCHER keeps its distance and shoots (a red line shows its aim), a SHAMAN heals and wards its pack, and a WARLEADER makes the monsters near it hit harder. Take those out first.'],
  reaction: ['ELEMENT REACTION', 'Elements mix, and an icon shows it! Fire on a frozen foe thaws it for extra damage (a drip chip), ice on a burning foe steams it into a stun (a wisps chip), lightning on fire sparks the foes beside it (a spark chip), wind spreads the flames (a flame chip), earth shatters a frozen foe (a shards chip) and fire on a poisoned foe lands the rest of the poison at once (a bubble chip). When a foe near you burns, is frozen or poisoned, a spell that would react shows the chip in its corner.'],
  elemweak: ['WEAK POINT', 'Every monster has an element and is weak to another (the Monster Book shows which). That element hits it for +25%, and a little arrow chip pops up. Spells that would hit a weak point near you wear the arrow too.'],
  newmove:  ['A NEW MOVE', 'A card with a gold dot does something no other card does. Click it in your collection to read its move, and see how it grows at rank S and SSS. The Monster Book (-) lists every Arcana on its last tab.'],
  flawless: ['FLAWLESS', 'You won that fight without taking a hit, so it paid a quarter of its EXP again (the gold star). It counts when you beat 3 or more monsters in one fight.'],
  breather: ['CATCH YOUR BREATH', 'With no monsters near and nothing hitting you for a few seconds, your HP slowly comes back (the soft white motes). It only works when you are not hungry, so keep eating.'],
  chain: ['CARD CHAIN', 'Two cards cast close together chain: the first card always leaves its element on what it hit, so the second can react with it, and it hits harder. A third card in time finishes the chain for a big hit and some MP back. Melee hits keep the chain going.'],
  rally: ['RALLY', 'That hit dropped you low, so your hero steadied: a moment where nothing can hurt you and a little HP back. It rests for a minute and a half before it can happen again, so step back and catch your breath.'],
  map:      ['JOURNEY MAP', 'Press M for the journey map: every area and Guardian on the road west.'],
  guardian: ['GUARDIAN', 'Each zone ends with a Guardian. Defeat it to break the seal and open the road onward.'],
  rift:     ['SURVIVAL RIFT', 'Monsters pour in — survive for 30 seconds to be sent back with a rich reward.'],
  cave:     ['BLACK HOLE', 'The black hole eats monsters to rank up. Step into its core: one boss of that rank guards a huge hoard.'],
  hole:     ['A BLACK HOLE OPENED', 'It drags nearby monsters in and ranks up with every one it swallows — the higher its rank, the stronger its boss and the bigger its hoard. It closes after 3 minutes.'],
  holeguard: ['ITS GUARDS', 'Ten creatures crawl out to guard it. Kill them first, or the hole feeds on them and grows. Walk into the glowing core to enter and face its boss.'],
  dogfeed:  ['FEED YOUR DOG', 'Your hound is hurt! Remember to feed your dog: put food in its FOOD BAG (N ▸ FOOD). While the bag has food it never drops below 1% HP — each hit after that eats 1 food.'],
  parry:    ['PERFECT PARRY', 'Spells hurting you? Hold L to DEFLECT spells: your shield guards every side. Block just as one lands for a PERFECT PARRY: it flies back at the caster for full damage and stuns them.'],
  block:    ['BLOCK!', 'Getting hit a lot? Hold L to block: it soaks most of a blow and deflects spells. Press attack while blocking to SHIELD BASH. Block just as an attack lands for a PERFECT PARRY: it reflects the attack back at its caster and stuns them.'],
  dash:     ['DASH OUT!', 'Taking a beating? Shift dashes you free, even while you are being hit or knocked down.'],
  // right in front of you
  well:     ['OLD WELL', 'A "!" means a well is ready: press Enter. It may hold a card, or gold and food with a boss, or a lost pet that needs a Rope (Grocer, 2,500 G). It refills after 24 in-game hours.'],
  animal:   ['WILD ANIMAL', 'Press Enter beside a wild animal to lead it. Walk it to the butcher beside your farm for meat: cow 6, pig 4, sheep and llama 3, chicken 1.'],
  leading:  ['LEADING', 'Enemies hunt a led animal on sight, and if its health runs out it is gone. You cannot teleport while leading, so walk it home. Enter beside it lets it go.'],
  butcher:  ['BUTCHER', 'Press Enter here and every animal you are leading becomes Raw Meat for your kitchen.'],
  totem:    ['CURSED GROUND', 'Inside a skull totem\'s purple ring your DEF counts for 20% less. Step out to shake it off.'],
  alpha:    ['ALPHA MONSTER', 'Alphas take a quarter of the damage and hit twice as hard, but always drop a card, gear, a relic, gold and coins.'],
  spring:   ['HEALING SPRING', 'Stand in the pond to heal and grow stronger. It only stays a short while, so use it while the light lasts.'],
  zoneevent:['ZONE EVENT', 'Something is happening in this area! Follow the banner at the top of the screen for a reward.'],
  node:     ['GATHERING', 'Press Enter at a sparkle. Herbs give crops and sometimes a rare seed, ore gives gold and sometimes a coin. It regrows the next real day.'],
  sidearea: ['SIDE AREA', 'Heights are gentler, with supplies and shrines. Depths are deadlier, with rich caches behind guards. Caches refill each in-game day.'],
  miniboss: ['MINI BOSS', 'A mini boss roams every area. It is tough, but drops far better loot than the monsters around it.'],
  lord:     ['BLACK HOLE LORD', 'A huge boss, once a real week. Eat the week\'s meal first (P shows which): the Lord then takes double damage and deals half.'],
  traveller:['TRAVELLER', 'Someone is far from home. Press Enter to talk: travellers offer quests and rare rewards.'],
  waystone: ['WAYSTONE', 'Press Enter here to TRAVEL. Touching a safe point or town stone adds it to the list for good.'],
  night:    ['NIGHT', 'At night foes are stronger and twice as many spawn, but loot is 60% better.'],
  // your farm
  farm:     ['YOUR FARM', 'Press Enter on a plot to till it, then again to plant. Seeds come from the Grocer, and crops only grow while the soil is wet.'],
  plots:    ['LOCKED PLOT', 'Each farm starts with four open plots. Buy more at that farm\'s Farm Board.'],
  yard:     ['FARM ANIMALS', 'Press Enter to feed a farm animal a crop. Half an in-game day later it gives you eggs, milk, wool or a truffle.'],
  build:    ['BUILD THE FARM', 'The Farm Board sells buildings: a Coop, a Barn to keep animals you lead home, a Silo and a Water Mill.'],
  water:    ['THIRSTY CROPS', 'A crop has dried out! Press Enter on the plot to water it. Refill your can at the lake or a town well.'],
  rent:     ['RENT', 'Rent is due soon. Bring 2,500 G to the Landlord at the bridge, or his mercenaries will hunt you. Pay three times and the house is yours.'],
  // your hero
  gear:     ['GEAR', 'Gold pips show a piece\'s quality. From rank D gear can belong to a set (the coloured corner): wear 2, 4 and 6 of one set for bonus passives. B in the inventory equips your best gear.'],
  fusion:   ['FUSING CARDS', 'Click a card and choose Fuse to combine cards into a stronger one. G sets your Fusion card, used with C in battle.'],
  cardsfull:['CARDS NEARLY FULL', 'You can hold 200 cards. Press X twice on a spare to sell it. Past 200, new cards wait in your home\'s Storage, and they still count toward Card Sets.'],
  summon:   ['SUMMON', 'You have coins to spend. Summon new cards at the Card Hall in Hearthvale.'],
  relic:    ['RELICS', 'Set relics on the pedestals in your home\'s Relic Hall for lasting stats.'],
  ki:       ['KI', 'You have learned Ki! On the inventory\'s KI tab, put it on your Layer button.'],
  kiready:  ['KI RELEASE', 'Your gauge is ready: V releases it. In Ki form you hit harder, and every basic attack fires a Spirit Cannon if you have one equipped.'],
  kibomb:   ['KI BOMB', 'Hold its key to charge. In Ki form keep holding past full to absorb it: every stat doubles until the gauge runs dry.'],
  cannon:   ['SPIRIT CANNON', 'Hold the skill key to charge it: the longer you hold, the harder, longer and wider the beam.'],
  egg:      ['OLD BONE', 'Press N and bring rare crops to call a dog to it: Moonflower, Dragonfruit or the week\'s crop. What it eats shapes what it becomes.'],
  wolf:     ['LOYAL WOLF', 'It fights beside your hound. Press N, then Tab to train it.'],
  // the bigger picture
  season:   ['THE SEASON', 'Press P. Fights, contracts, attendance and harvests fill one bar with rewards at every tier. Each week favours an element and has its own crop.'],
  claim:    ['TIER REWARD', 'A Season tier is ready! Press P to claim it.'],
  contracts:['DAILY CONTRACTS', 'Three new contracts every real day pay out the moment they are done, with a bonus for all three. See them at the top right.'],
  gamelog:  ['LOG', 'Press X to see everything that has happened: loot, level-ups, black holes, harvests and more.'],
  workshop: ['WORKSHOP', 'Press Z. Ore, herbs, leather, wool and more make better materials, gear, farm tools and potions. The BOOK tab shows where each comes from and what it makes.'],
  sets:     ['CARD SETS', 'Press O. Own one card of every monster in a zone, at any rank, for a lasting stat bonus.'],
  tower:    ['ABYSS TOWER', 'Press U for an endless climb. Clear each floor to go higher; every fifth floor is a boss and a checkpoint.'],
  titles:   ['TITLES', 'Press Y. Titles are earned by playing, and the one you wear gives its passives.'],
  dojo:     ['THE DOJOS', 'Each town has a Dojo. Beat all five masters to learn Ki from the Last Grandmaster in Frostmere; after that, the Sand Sage waits in Mirage Springs.'],
  arena:    ['THE ARENA', 'H takes you back to the Hub, where you can fight ranked Versus matches for rewards.'],
  sound:    ['SOUND', 'Press 0 to turn the music and sound on or off.'],
};
const TIP_SHOW = 6500, TIP_SLIDE = 350, TIP_GAP = 90000, TIP_GAP_URGENT = 20000, TIP_ROWS = 3, TIP_SCAN = 1000;

function tipEvent(game, id) {
  const pr = game.profile;
  if (!pr || !TIPS[id] || (pr.tips && pr.tips[id])) return;
  game.tipQ = game.tipQ || [];
  if (game.tipQ.includes(id) || (game.tip && game.tip.id === id)) return;
  if (TIP_URGENT.includes(id)) game.tipQ.unshift(id); else if (game.tipQ.length < 2) game.tipQ.push(id);
  game.tipQ.length = Math.min(game.tipQ.length, 2);
}
const TIP_URGENT = ['lowhp', 'gbreak', 'crusher', 'foeguard', 'pdodge', 'charger', 'foeroles', 'dogfeed', 'parry', 'block', 'dash', 'rift', 'cave', 'hole', 'holeguard', 'hungry', 'stuck', 'well', 'animal', 'leading', 'butcher', 'totem', 'alpha', 'spring', 'zoneevent', 'node', 'sidearea', 'miniboss', 'lord', 'traveller', 'waystone', 'water', 'rent', 'claim', 'kiready', 'yard', 'build', 'plots'];

// what each tip waits for, checked once a second: (game, world, hero, profile, in the Wilds?, seconds spent in the Wilds)
const tipNear = (w, p, r, test) => w.actors.some(a => !a.dead && test(a) && Math.hypot(a.x - p.x, a.y - p.y) < r);
const inSideArea = (w, p) => { const R = REGIONS[regionIndexAt(p.x)], tx = p.x / T, ty = p.y / T; return !!R && (R.subs || []).some(u => tx >= u.ox && tx < u.ox + u.w && ty >= u.oy && ty < u.oy + u.h); };
const TIP_WATCH = {
  well: (g, w) => w.overworld && !w.interior && !!wildWellNear(w) && wellOpen(g, wildWellNear(w)),
  animal: (g, w) => !!(w.animalNear && !w.animalNear.lead && !w.animalNear.farm),
  leading: (g, w) => animalLeads(w).length > 0, butcher: (g, w) => !w.interior && nearButcher(w), totem: (g, w, p) => !!p.totemCurse,
  alpha: (g, w, p) => tipNear(w, p, 340, a => a.alphaKey), foeroles: (g, w, p) => tipNear(w, p, 220, a => a.foeRole), miniboss: (g, w, p) => tipNear(w, p, 280, a => a.miniBoss), lord: (g, w, p) => tipNear(w, p, 360, a => a.weeklyLord), traveller: (g, w, p) => tipNear(w, p, 120, a => a.wanderer),
  spring: (g, w) => !!(w.event && w.event.kind === 'spring'), zoneevent: (g, w) => !!(w.event && w.event.kind !== 'spring'),
  node: (g, w) => !!w.nodeNear, sidearea: (g, w, p, pr, wild) => wild && inSideArea(w, p), waystone: (g, w) => w.overworld && !w.interior && nearWaystone(w), night: (g, w, p, pr, wild) => wild && isNight(pr),
  plots: (g, w, p, pr) => { const i = nearPlot(w); return i >= 0 && !plotLocked(pr, i) && !plotOpen(pr, i); }, yard: (g, w) => !!w.yardNear, build: (g, w, p, pr) => w.overworld && !w.interior && nearSpot(w, VILLAGE.board) && (pr.gold || 0) >= YARD.builds.coop.gold,
  farm: (g, w, p) => w.overworld && !w.interior && inTown(p.x) && nearPlot(w) >= 0, water: (g, w, p, pr) => (pr.farm || []).some(P => P && P.crop && !plotWet(P)), rent: (g, w, p, pr) => !!pr.rent && !pr.rent.owned && (pr.rent.owed || pr.rent.due - (pr.day || 0) <= 1),
  gear: (g, w, p, pr) => pr.gear.some(q => q.tier >= 2), fusion: (g, w, p, pr) => pr.cards.length >= 12, cardsfull: (g, w, p, pr) => pr.cards.length >= 180, summon: (g, w, p, pr) => (pr.coins || 0) >= 10, relic: (g, w, p, pr) => (pr.relics || []).length > 0,
  ki: (g, w, p, pr) => !!pr.chi && !kiPicked(pr), kiready: (g, w, p, pr) => kiPicked(pr) && (p.chi || 0) >= CHI.need, kibomb: (g, w, p, pr) => !!pr.kiBomb, cannon: (g, w, p) => (p.spells || []).some(s => s && s.sx === 'cannon'),
  egg: (g, w, p, pr) => !!pr.drake && !drakeHatched(pr.drake), wolf: (g, w, p, pr) => !!pr.wolf,
  claim: (g, w, p, pr) => { const S = seasonState(pr); return seasonTier(S) > S.got; },
  season: (g, w, p, pr, wild, t) => t > 200, contracts: (g, w, p, pr, wild, t) => t > 300, gamelog: (g, w, p, pr, wild, t) => t > 200, workshop: (g, w, p, pr, wild, t) => t > 120, sets: (g, w, p, pr, wild, t) => t > 420, tower: (g, w, p, pr, wild, t) => t > 600, titles: (g, w, p, pr, wild, t) => t > 800, arena: (g, w, p, pr, wild, t) => t > 1000, sound: (g, w, p, pr, wild, t) => t > 1200,
  dojo: (g, w, p, pr) => (pr.lv || 1) >= 15 && !pr.chi,
};
// per-frame checks while in the world
function tipsTick(game, dt) {
  const pr = game.profile, w = game.world, p = w && w.player;
  if (!pr || !p || game.scene !== 'world') return;
  const wild = !w.interior && !w.cave && !w.rift && !inTown(p.x);
  if ((game.tipScanT = (game.tipScanT || 0) - dt) <= 0) {
    game.tipScanT = TIP_SCAN; const seen = pr.tips || {}, sec = (game.tipWildT || 0) / 1000;
    for (const id in TIP_WATCH) if (!seen[id] && TIP_WATCH[id](game, w, p, pr, wild, sec)) tipEvent(game, id);
  }
  if (w.rift && !w.rift.tower && !w.rift.evil) tipEvent(game, 'rift');
  if (w.cave) tipEvent(game, 'cave');
  if (wild) {
    game.tipWildT = (game.tipWildT || 0) + dt;
    if (game.tipWildT > 120000) tipEvent(game, 'map');
    if (game.tipWildT > 240000 && !(p.layerCd > 0)) tipEvent(game, 'layer');
  }
  if (!p.dead && p.hp < p.maxHp * 0.3) tipEvent(game, 'lowhp');
  const dog = w.actors.find(a => a.pet && !a.heroPartner && !a.netOf && !a.dead);   // the hound under 40% HP: feed it (again each time, once it is back above 60%)
  if (dog && dog.hp < dog.maxHp * 0.4) tipEvent(game, 'dogfeed');
  else if (dog && dog.hp > dog.maxHp * 0.6 && pr.tips && pr.tips.dogfeed) delete pr.tips.dogfeed;
  if (statPoints(pr) >= 10) tipEvent(game, 'stats');
  // stuck: holding a direction for 3 s without getting anywhere — the teleport-home tip (again whenever it happens)
  const pushing = isDown('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS');
  const far = Math.hypot(p.x - (game.stuckX ?? p.x), p.y - (game.stuckY ?? p.y)) > 24;
  if (!pushing || far || p.state !== 'free' || w.interior) { game.stuckT = 0; game.stuckX = p.x; game.stuckY = p.y; }
  else if ((game.stuckT = (game.stuckT || 0) + dt) > 3000) { if (pr.tips) delete pr.tips.stuck; tipEvent(game, 'stuck'); game.stuckT = -20000; }
  // hunger at 30%: the eating tip — and again every time you get that hungry (it resets once you have eaten well)
  if ((pr.hunger ?? 80) <= 30) tipEvent(game, 'hungry');
  else if ((pr.hunger ?? 80) > 50 && pr.tips && pr.tips.hungry) delete pr.tips.hungry;
}

// called from the draw loop (keeps time only while no menu is open)
function drawTip(game, now, dt) {
  const pr = game.profile;
  if (!pr || game.scene !== 'world' || game.menu) return;
  if (!game.tip) {
    const q = game.tipQ || [], id = q[0];
    if (!id) return;
    const since = performance.now() - (game.tipLastShown || -1e9);   // quiet gap since the last tip
    if (since < (TIP_URGENT.includes(id) ? TIP_GAP_URGENT : TIP_GAP)) return;
    q.shift(); game.tipLastShown = performance.now();
    pr.tips = pr.tips || {}; pr.tips[id] = 1; game.save();
    game.tip = { id, t: 0 };
  }
  const T = game.tip;
  T.t += dt;
  const [title, msg] = TIPS[T.id], im = img('assets/ui_status_warm.png');   // (dark cocoa inside, gold frame and crown kept: the user's pick, 2026-11-07; the blue original is ui_status.png)
  const W = 178, H = Math.round(W * 720 / 1082), s = W / 1082, bw = 886 * s, lines = wrap(msg, bw - 12, 6.5), pages = Math.max(1, Math.ceil(lines.length / TIP_ROWS)), show = TIP_SHOW * pages;
  if (T.t > show) { game.tip = null; return; }
  const k = Math.min(1, T.t / TIP_SLIDE, (show - T.t) / TIP_SLIDE);
  const ease = 1 - Math.pow(1 - Math.max(0, k), 3);
  const x = Math.round(6 - (1 - ease) * (W + 10)), y = 78;
  if (clicked(x, y + 30, W, H - 30)) { T.t = Math.max(T.t, show - TIP_SLIDE); }
  ctx.save();
  ctx.globalAlpha = Math.max(0, ease);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6 * RES; ctx.shadowOffsetY = 2 * RES;
  if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x, y, W, H);
  ctx.shadowColor = 'transparent';
  // upper band: window caption + tip title
  const bx = x + 100 * s;
  text('STATUS WINDOW', bx + 2, y + 222 * s + 7, '#f0d8a8', 6, 'left');
  const pulse = 0.75 + 0.25 * Math.sin(now / 180);
  ctx.globalAlpha = Math.max(0, ease) * pulse;
  text('!', bx + 6, y + 222 * s + 23, '#ffd23f', 11);
  ctx.globalAlpha = Math.max(0, ease);
  text('TIP', bx + 13, y + 222 * s + 23, '#ffd23f', 8, 'left');
  text(title, bx + 33, y + 222 * s + 23, '#ffffff', 9, 'left');
  // lower band: the message
  const page = Math.min(pages - 1, Math.floor(T.t / TIP_SHOW)), shown = lines.slice(page * TIP_ROWS, (page + 1) * TIP_ROWS), ly = y + 470 * s + 9 + (shown.length < TIP_ROWS ? 4 : 0);
  shown.forEach((ln, i) => text(ln, bx + 6, ly + i * 9, '#f6eedc', 6.5, 'left', false));
  if (pages > 1) text(`${page + 1}/${pages}`, bx + bw - 2, y + 222 * s + 7, '#f0d8a8', 6, 'right');
  // time left: a thin gold line under the caption
  ctx.fillStyle = 'rgba(255,210,63,0.75)';
  ctx.fillRect(bx, y + 465 * s - 2, bw * Math.max(0, 1 - T.t / show), 1);
  ctx.restore();
}
