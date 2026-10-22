/* p2b: the expansion — set plays, gear, Hall of Fame legends, and cards with extra costs */
// new card fields:
//   costs:  toll (lose HP), disc (discard a card you choose), fatigue (Fatigue cards into your discard),
//           exert (that much less Stamina next turn), foul (enemies gain Strength and score a point), goldc (gold)
//   extras: retain, innate, pierce (ignores Block), grow (+dmg each play this fight), combo {t, fx} (if the last card
//           played this turn was that type), mom {n, fx} (if this is at least the nth card this turn), home (bonus ops when
//           the fight's sport matches the card's sport)
// types: 'play' (a set play: scores big in its own sport) and 'gear' (stays in play with charges)
Object.assign(ST, {
  pads: { n: 'Goalie Pads', col: '#c9d0d6', desc: 'Charges. Before an attack hits you, gain 5 Block and spend a charge.' },
  helmet: { n: 'Helmet', col: '#c9d0d6', desc: 'Charges. Each hit on you deals 3 less damage and spends a charge.' },
  shoulder: { n: 'Shoulder Pads', col: '#d8c49a', desc: 'Charges. When an attack hits you, deal 6 back and spend a charge.' },
  luckybat: { n: 'Lucky Bat', col: '#ffd166', desc: 'Charges. Your next Attacks deal 4 more damage per hit; each spends a charge.' },
  cleats: { n: 'Spiked Cleats', col: '#c9d0d6', desc: 'Charges. Your next Skills each give 4 more Block.' },
  sweat: { n: 'Sweatband', col: '#e9dcc0', desc: 'Charges. Draw 1 more card at the start of each turn.' },
  exert: { n: 'Exerted', col: '#c9a26a', d: 1, desc: 'Has that much less Stamina next turn.' },
  called: { n: 'Called Shot', col: '#ffd166', desc: 'The next Attack this turn deals triple damage.' },
  phyl: { n: 'Phylactery', col: '#7fd4ff', desc: 'The first time you would fall this fight, heal to 30 instead.' },
  pulled: { n: 'Empty Net', col: '#7fd6ff', desc: 'Your next Attack that deals damage scores a goal.' },
});
const KX = K;
// set plays — sport-tagged; 'home' fires extra when the fight is played under that sport
KX('ply_squeeze', 'Suicide Squeeze', 'any', 'play', 1, 'u', 'one', [['d', 5]], { sport: 'baseball', home: [['runners']], fl: 'Runner goes on the pitch.' });
KX('ply_hitrun', 'Hit and Run', 'any', 'play', 1, 'c', 'one', [['d', 4, 2]], { sport: 'baseball', home: [['advance', 1]] });
KX('ply_walk', 'Intentional Walk', 'any', 'play', 0, 'c', 'one', [['s', 'weak', 1]], { sport: 'baseball', home: [['putOn'], ['draw', 1]], fl: 'Four wide ones.' });
KX('ply_flea', 'Flea Flicker', 'any', 'play', 1, 'u', 'one', [['draw', 2], ['d', 8]], { sport: 'football', home: [['yards', 25]] });
KX('ply_sneak', 'Quarterback Sneak', 'any', 'play', 0, 'c', 'self', [['b', 4]], { sport: 'football', home: [['yards', 12]] });
KX('ply_picksix', 'Pick Six', 'any', 'play', 1, 'r', 'self', [['b', 10]], { sport: 'football', home: [['ifyards', 50, [['td']], [['yards', 20]]]], fl: 'Jumped the route.' });
KX('ply_hip', 'Hip Check', 'any', 'play', 1, 'c', 'one', [['d', 7], ['s', 'weak', 1]], { sport: 'hockey', pierce: 1, home: [['s', 'vuln', 1]] });
KX('ply_pp', 'Power Play', 'any', 'play', 2, 'u', 'one', [['roll', 9, [['s', 'stun', 1]], [['s', 'weak', 2]]]], { sport: 'hockey', home: [['draw', 2]], fl: 'Two minutes for being a cube.' });
KX('ply_pull', 'Pull the Goalie', 'any', 'play', 0, 'r', 'self', [['nrg', 2], ['loseblock']], { sport: 'hockey', home: [['s', 'pulled', 1, 'self']], fl: 'Extra attacker on.' });
KX('ply_break', 'Fast Break', 'any', 'play', 1, 'c', 'one', [['d', 5], ['draw', 1]], { sport: 'basketball', home: [['atkcount', 1]] });
KX('ply_heave', 'Full-Court Heave', 'any', 'play', 2, 'u', 'one', [['roll', 11, [['d', 24]], [['d', 4]]]], { sport: 'basketball', home: [['nrg', 1]] });
KX('ply_mulligan', 'Mulligan', 'any', 'play', 0, 'u', 'self', [['audible']], { sport: 'golf', home: [['freestroke']], fl: 'That one didn’t count.' });
KX('ply_split', 'Seven-Ten Split', 'any', 'play', 2, 'r', 'all', [['split', 12]], { sport: 'bowling', home: [['nrg', 1]], fl: 'Hits the two at the ends.' });
KX('ply_tilt', 'Shatter the Lance', 'any', 'play', 1, 'u', 'one', [['d', 9]], { sport: 'jousting', home: [['lance']] });
// gear — stays in play with charges
KX('gr_pads', 'Goalie Pads', 'any', 'gear', 1, 'u', 'self', [['s', 'pads', 3, 'self']], { sport: 'hockey' });
KX('gr_helmet', 'Helmet and Cage', 'any', 'gear', 1, 'c', 'self', [['s', 'helmet', 5, 'self']], { sport: 'football' });
KX('gr_shoulder', 'Spiked Shoulder Pads', 'any', 'gear', 1, 'u', 'self', [['s', 'shoulder', 4, 'self']], { sport: 'football' });
KX('gr_bat', 'Lucky Bat', 'any', 'gear', 1, 'u', 'self', [['s', 'luckybat', 3, 'self']], { sport: 'baseball', fl: 'Corked. Allegedly.' });
KX('gr_cleats', 'Spiked Cleats', 'any', 'gear', 0, 'c', 'self', [['s', 'cleats', 3, 'self']], { sport: 'baseball' });
KX('gr_sweat', 'Sweatband', 'any', 'gear', 0, 'c', 'self', [['s', 'sweat', 3, 'self']], { sport: 'basketball' });
// new league cards with extra abilities and extra costs
KX('bp', 'Batting Practice', 'any', 'atk', 1, 'c', 'one', [['d', 5]], { grow: 3, sport: 'baseball', fl: 'Gets better every swing.' });
KX('pinch', 'Pinch Hitter', 'any', 'atk', 1, 'u', 'one', [['d', 10]], { retain: 1, sport: 'baseball' });
KX('leadoff', 'Leadoff Man', 'any', 'skl', 0, 'c', 'self', [['draw', 2]], { innate: 1, ex: 1, sport: 'baseball' });
KX('checkline', 'Checking Line', 'any', 'atk', 1, 'c', 'one', [['d', 6]], { combo: { t: 'atk', fx: [['s', 'vuln', 2]] }, sport: 'hockey' });
KX('brawl', 'Bench-Clearing Brawl', 'any', 'atk', 2, 'u', 'all', [['d', 7]], { mom: { n: 3, fx: [['d', 7, 1, 'all']] }, sport: 'hockey', fl: 'Everybody off the bench.' });
KX('slapshot', 'Piercing Slapshot', 'any', 'atk', 2, 'u', 'one', [['d', 15]], { pierce: 1, sport: 'hockey' });
KX('veteran', 'Gritty Veteran', 'any', 'skl', 1, 'c', 'self', [['b', 7]], { retain: 1 });
KX('hustle', 'Hustle Play', 'any', 'skl', 0, 'c', 'self', [['draw', 2], ['nrg', 1]], { exert: 1, fl: 'Pay for it tomorrow.' });
KX('blood', 'Blood on the Ice', 'any', 'atk', 1, 'r', 'one', [['d', 13], ['s', 'weak', 2]], { toll: 3, sport: 'hockey' });
KX('trash', 'Trash Talk', 'any', 'skl', 0, 'c', 'all', [['s', 'vuln', 2, 'all']], { foul: 1, fl: 'Your mother was a gelatinous cube.' });
KX('pumpfake', 'Pump Fake', 'any', 'skl', 0, 'u', 'self', [['draw', 3]], { disc: 1, sport: 'basketball' });
KX('overtime', 'Overtime Effort', 'any', 'atk', 2, 'r', 'one', [['d', 8, 3]], { fatigue: 2 });
KX('ringer', 'Hired Ringer', 'any', 'skl', 0, 'r', 'self', [['nrg', 2], ['draw', 2]], { goldc: 25, ex: 1, fl: 'Cash up front.' });
KX('cheapshot', 'Cheap Shot', 'any', 'atk', 0, 'c', 'one', [['d', 8]], { foul: 1, fl: 'The ref was looking the other way. Mostly.' });
KX('dive', 'Flop', 'any', 'skl', 1, 'u', 'self', [['b', 12]], { foul: 1, sport: 'basketball', fl: 'Oscar-worthy.' });
// Hall of Fame (legendary): one per league kind, taken from their Black Ice ultimates, with heavy costs
KX('hof_goblin', 'Grand Larceny', 'goblin', 'skl', 1, 'l', 'all', [['strip'], ['gold', 25]], { foul: 1, ex: 1, fl: 'Takes their block, their swagger and their wallets.' });
KX('hof_kobold', 'Meltwater Inferno', 'kobold', 'skl', 2, 'l', 'all', [['s', 'burn', 10, 'all']], { toll: 5, ex: 1 });
KX('hof_werewolf', 'Blood Moon Rising', 'werewolf', 'pow', 2, 'l', 'self', [['s', 'str', 4, 'self'], ['s', 'ritual', 1, 'self']], { exert: 1 });
KX('hof_dwarf', 'Earthshatter', 'dwarf', 'atk', 3, 'l', 'all', [['d', 20]], { fatigue: 2, sport: 'hockey' });
KX('hof_ogre', 'Crater Banquet', 'ogre', 'atk', 2, 'l', 'one', [['devour', 45, 15]], { toll: 6, ex: 1, fl: 'No roll needed. He was going to eat it anyway.' });
KX('hof_minotaur', 'Labyrinth Stampede', 'minotaur', 'atk', 2, 'l', 'rand', [['d', 9, 7]], { exert: 1, sport: 'football' });
KX('hof_troll', 'Bog Tide Forever', 'troll', 'pow', 2, 'l', 'self', [['s', 'regen', 12, 'self'], ['s', 'trollblood', 2, 'self']], { disc: 1 });
KX('hof_golem', 'The Rampart', 'golem', 'skl', 2, 'l', 'self', [['b', 40], ['s', 'barricade', 1, 'self']], { exert: 2, ex: 1, sport: 'hockey' });
KX('hof_harpy', 'Eye of the Tempest', 'harpy', 'pow', 2, 'l', 'self', [['s', 'tempest', 9, 'self']], { fatigue: 1 });
KX('hof_elf', 'Thornwood Wall', 'elf', 'skl', 1, 'l', 'all', [['s', 'thorns', 8, 'self'], ['s', 'weak', 3, 'all']], { disc: 1 });
KX('hof_wraith', 'Fog of the Dead', 'wraith', 'skl', 1, 'l', 'self', [['s', 'intang', 1, 'self'], ['draw', 3]], { toll: 4, ex: 1 });
KX('hof_vampire', 'Eclipse', 'vampire', 'atk', 2, 'l', 'all', [['drainall', 9]], { foul: 1, fl: 'Puts out the braziers.' });
KX('hof_lich', 'Grave Hands', 'lich', 'skl', 2, 'l', 'all', [['s', 'stun', 1, 'all'], ['s', 'psn', 6, 'all']], { toll: 5, ex: 1 });
KX('hof_zombie', 'Plague Eternal', 'zombie', 'pow', 2, 'l', 'self', [['s', 'necro', 4, 'self'], ['s', 'phyl', 1, 'self']], { fatigue: 2 });
KX('hof_gorgon', 'Stone Garden', 'gorgon', 'atk', 2, 'l', 'all', [['petrifyall', .6, 15]], { disc: 1, ex: 1 });
KX('hof_spider', 'Web of a Thousand Eyes', 'spider', 'skl', 1, 'l', 'all', [['s', 'weak', 4, 'all'], ['s', 'vuln', 3, 'all'], ['add', 'spiderling', 3, 'hand']], { fatigue: 1, ex: 1 });
KX('hof_skeleton', 'Bone Storm', 'skeleton', 'atk', 2, 'l', 'all', [['bonestorm', 2]], { exert: 1, fl: 'Every bone you have ever thrown, back at once.' });
KX('hof_witch', 'The Long Winter', 'witch', 'atk', 3, 'l', 'all', [['d', 12], ['s', 'stun', 1, 'all']], { toll: 6, ex: 1, sport: 'hockey' });
KX('hof_called', 'The Called Shot', 'any', 'play', 1, 'l', 'self', [['s', 'called', 1, 'self']], { foul: 1, ex: 1, sport: 'baseball', home: [['draw', 2]], fl: 'Points at the bleachers.' });
KX('hof_miracle', 'Miracle on Ice', 'any', 'play', 3, 'l', 'all', [['s', 'stun', 1, 'all'], ['b', 20]], { toll: 8, ex: 1, sport: 'hockey', home: [['b', 10]], fl: 'Do you believe?' });
KX('hof_immaculate', 'Immaculate Reception', 'any', 'play', 2, 'l', 'self', [['draw', 4], ['freeatk']], { exert: 1, fatigue: 2, sport: 'football', home: [['yards', 30]] });
KX('hof_greatone', 'The Great One', 'any', 'atk', 2, 'l', 'rand', [['d', 4, 9]], { exert: 2, sport: 'hockey', fl: 'Ninety-nine of them, give or take.' });
KX('hof_blacksox', 'Throw the Game', 'any', 'skl', 0, 'l', 'self', [['nrg', 3], ['draw', 3]], { goldc: 30, foul: 2, ex: 1, sport: 'baseball', fl: 'Say it ain’t so.' });
// the status card the extra costs put in your deck
KX('fatigue', 'Fatigue', 'none', 'junk', 1, 'x', 'self', [], { ex: 1, eth: 1, fl: 'Costs 1 to shake off. Melts away at the end of your turn otherwise.' });
// the pick-and-roll and seventh-inning stretch are set plays now
CARDS.pickroll.type = 'play'; CARDS.pickroll.home = [['atkcount', 1]];
CARDS.stretch.type = 'play'; CARDS.stretch.home = [['heal', 5]];
for (const c of Object.values(CARDS)) if (!KIND_CARDS[c.kind] || !KIND_CARDS[c.kind].includes(c.id)) (KIND_CARDS[c.kind] = KIND_CARDS[c.kind] || []).push(c.id);
Object.assign(SPORT_NAME, {});
const RAR_NAME = { s: 'Starter', c: 'Common', u: 'Uncommon', r: 'Rare', l: 'Hall of Fame', x: 'Status' };
Object.assign(UP_OVERRIDE, { hof_called: { ex: 0 }, ringer: { fx: [['nrg', 2], ['draw', 3]] }, pumpfake: { fx: [['draw', 4]] } });
