'use strict';
// THE TOWNSFOLK: the rest of the character art from both games (assets/extra_npcs.js: 127-137 are Zenonia 1's, z-numbers
// Zenonia 2's). Each lives in one town, strolls about and has something to say. [sprite, name, tile x, tile y, line, still]
// `still` is for whoever is drawn sitting, or behind something, or too big to stroll. They don't hand out errands:
// that list is TL_FOLK (townlife.js).
const FOLK = {
  hearthvale: [
    ['135', 'Cook Marrow', 22, 17, 'Everything tastes better after a long walk. That is my whole secret, and I will deny it.'],
    ['134', 'Madame Rosette', 60, 17, 'This hat has outlived two husbands and a dragon. Do not touch it.'],
    ['133', 'Rug Seller Anzo', 64, 21, 'Finest weave in the valley. No, you cannot walk on it. Yes, I know I am sitting on it.', true],
    ['127', 'Lady Mirabel', 62, 13, 'I came to Hearthvale for a quiet summer. That was eleven summers ago.'],
    ['z119', 'Nell', 25, 26, 'Mother says a hunter is just a farmer who got lost. I think that sounds fun.'],
    ['z102', 'Tobin', 18, 20, 'I am going to be a card hunter! I already have a stick.'],
    ['z103', 'Kit', 20, 21, 'Tobin says the stick counts. It does not count.'],
    ['z101', 'Dash', 54, 20, 'I ran to the Wilds and back this morning! Well. To the gate. Well. Most of the way.'],
    ['z105', 'Old Barnaby', 8, 22, 'Sixty years in this town and the fountain still will not grant me a decent card.'],
    ['z112', 'Uncle Wen', 68, 14, 'Hair is a young man\'s worry. I have moved on to knees.'],
    ['z106', 'Clerk Ambrose', 12, 18, 'Name, rank, next of kin. No? Then keep moving, you are blocking the ledger.', true],
    ['z107', 'Mayor Aldous', 24, 13, 'Hearthvale welcomes you! Please do not lead any more cows through the square.'],
    ['z049', 'Biscuit', 16, 26, 'Woof! (It sniffs your pockets for bread.)'],
    ['z099', 'Bluebird', 67, 23, '(It tilts its head at you, then goes back to the crumbs.)'],
  ],
  outposts: [
    [ // Mossbrook: farmers and growing things
      ['z048', 'Sunny Wick', 19, 18, 'A good hat keeps the sun off and the crows guessing.'],
      ['z087', 'Lily of the Sprouts', 28, 24, 'Water at dusk and sing to them a little. They grow toward kindness.'],
      ['z096', 'Turnip', 34, 19, 'Do not pull my leaf. Everybody pulls my leaf.'],
      ['z097', 'Radish', 36, 19, 'We are not vegetables. We are people who have made choices.'],
      ['z047', 'Bramble', 48, 18, 'The bears here are friendly if you bring honey. The honey bees are not.'],
      ['z089', 'Farmer Gus', 52, 19, 'Rain by Thursday, says my knee. My knee has not been wrong since the second seal.'],
      ['z090', 'Digger Holt', 60, 18, 'Dug a well, found a boot. Dug deeper, found the other boot. Still looking for the rest of him.'],
      ['z088', 'Sister Ivy', 23, 18, 'I bless the seed and the plough alike. The plough has been better behaved.'],
    ],
    [ // Duskhollow: lamplight, cloaks and secrets
      ['z109', 'Mara of the Veil', 12, 18, 'People lock their doors at dusk here. It is not the woods they are afraid of.'],
      ['z110', 'Silas Greymantle', 21, 18, 'I keep the town\'s accounts. You would be surprised who owes what, and to whom.'],
      ['z111', 'Corbin', 24, 18, 'Do not stare at the patch. I will not tell you what happened. It was a chicken.'],
      ['z108', 'Baron Vane', 33, 18, 'A cape is not vanity, friend. It is an announcement.'],
      ['z082', 'Nightshade', 49, 19, 'You did not see me. I have told you this before, and you did not see me then either.'],
      ['z084', 'Shade', 51, 24, 'A quiet step lives longer. So do those who owe me money.'],
      ['z077', 'Bluecap', 60, 18, 'My spells are excellent. It is only the aiming that gives me trouble.'],
      ['z118', 'Archmage Nocturne', 62, 21, 'I studied the Unseen for ninety years. It studied me back.'],
      ['136', 'The Hooded One', 43, 20, 'Hm.'],
      ['128', 'Black Varg', 57, 19, 'I have been asked to smile more in town. This is the smile.'],
      ['z074', 'Old Zephon', 14, 24, 'Stars say the same as the cards. Nobody listens to either of them.', true],
    ],
    [ // Cloudhold: smiths, soldiers and travellers off the desert road
      ['z045', 'Big Rusk', 20, 18, 'I lift the anvils so the smiths do not have to. Nobody asked me to.'],
      ['z098', 'Gunner Mokk', 26, 19, 'She has never missed. Mind you, she has never been aimed at anything.', true],
      ['z091', 'Engineer Bolt', 34, 18, 'Sit in the machine, they said. It will be fun, they said. I cannot find the door.', true],
      ['z085', 'Goggles', 40, 18, 'The engines talk if you listen. Mostly they complain.'],
      ['z116', 'Sergeant Horne', 48, 18, 'Hold your line and mind your flank. Everything else is decoration.'],
      ['z117', 'Wulf Twin-Blade', 50, 21, 'Two swords, because the first one kept getting lonely.'],
      ['z075', 'Knight Commander Aurel', 58, 18, 'We hold the pass so the rest of you may sleep. Sleep well.'],
      ['z079', 'Sentry Garr', 60, 21, 'Halt. Who goes there? Oh, it is you. Carry on.'],
      ['z113', 'Young Rhys', 16, 24, 'One day they will sing about me. I have written the first verse already.'],
      ['137', 'Sandpiper', 62, 24, '(The camel chews slowly and looks straight through you.)', true],
      ['z046', 'Doctor Grey', 30, 24, 'Burns, mostly. Burns and people who said it did not look hot.'],
    ],
    [ // Frostmere: pilgrims at the end of the world
      ['z056', 'High Priest Oros', 13, 18, 'We pray at the world\'s last fire. Lately it has begun to answer.', true],
      ['z081', 'Seraphine', 17, 22, 'Rest your feet. The cold takes the tired ones first.'],
      ['z080', 'Saint Elric', 25, 18, 'I was told I was dead some while ago. I have decided not to take it personally.'],
      ['z078', 'Little Cherub', 27, 22, 'Is it true there are places that are warm? I think you are making that up.'],
      ['z104', 'Sage Ulmar', 36, 18, 'Snow forgets every footprint. It is the kindest thing about it.'],
      ['z083', 'Snowhood', 42, 18, 'Two scarves is a mistake. Three is the beginning of wisdom.'],
      ['z086', 'Professor Thule', 44, 22, 'The ice remembers. I have forty years of notes and it has not once repeated itself.'],
      ['131', 'Golden Paladin', 52, 18, 'I walked here to end the Unseen. Then I saw how cold it was, and I am reconsidering.'],
      ['z044', 'Far-Walker', 61, 19, 'I have seen every town on this map, and this one has the fewest flies.', true],
    ],
  ],
};

// Not everyone is out at once: each day a few of them are about, one from each part of town, and the rest stay indoors.
// So the streets don't fill up, and you meet different faces from day to day. (Shopkeepers and errand-givers are always out.)
const TOWN_SLOTS = [[10, 20], [20, 15], [35, 16], [44, 22], [54, 20], [61, 15], [70, 22], [76, 16]];   // Hearthvale's spots, west to east
const OUTPOST_OUT = 3;
function folkToday(list, n, xOf, salt) {
  const r = seededRng((WORLD_SEED + dayNo() * 7919 + salt * 104729) | 0), all = [...list].sort((a, b) => xOf(a) - xOf(b));
  return Array.from({ length: n }, (_, i) => { const a = Math.floor(i * all.length / n), b = Math.floor((i + 1) * all.length / n); return all[a + Math.floor(r() * (b - a))]; });
}
