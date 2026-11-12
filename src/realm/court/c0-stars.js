/* The Charter Court's superstars (issue #77, phase 8), inside the wBK scope: each superstar's ratings and powers, added
   to the engine's own tables after its parts load, as the gridiron's are (g0-stars.js). Plain assignments, nothing
   declared. Ratings are [speed, size, hops, touch, handle, defense]; each has an offense and a defense power, a second
   of each (picked on the Court tab), and an ultimate. An id here must not be one of the engine's own (14-powers.js): a
   clash would silently replace the other power (test/realm_court_stars.py asserts it). A superstar is never picked for
   a CPU side by kind: the Realm only ever sends one as your own player.

   The Phoenix: quick, all hops, and a shooter (it is on fire already). Blaze heats its side's shots, Ash Fall spoils
   theirs, and its ultimate is Rebirth: its five get their breath back every possession, and shoot better for it. */
BK_KIND.phoenix = [9, 4, 9, 8, 7, 5];
BK_POW.phoenix = [bkP('blaze', 'Blaze', 1, 'shot', 'The ball leaves the hand alight: every shot 3 points likelier, threes 3 more.', { shot: .03, three: .03 }),
  bkP('ashfall', 'Ash Fall', 1, 'any', 'Ash in their eyes: every shot 4 points less likely, and passes picked off a fifth more.', { shot: -.04, stl: 1.2 })];
BK_POW2.phoenix = [bkP('firewings', 'Fire Wings', 1, 'drive', 'On wings of flame: the offense 8% faster, and shots at the rim 4 points likelier.', { oSpd: 1.08, rim: .04 }),
  bkP('scorch', 'Scorched Floor', 1, 'drive', 'The lane burns: the offense 6% slower, and drives stopped more often.', { oSpd: .94, lane: .3 })];
BK_ULT.phoenix = bkU0('rebirth', 'Rebirth', 'The phoenix\'s five rise from the ashes: 9 stamina back every possession, and their shots 4 points likelier.', { staO: 9, shot: .04 }, { staD: 9 }, ['#ff8a3c', 'all']);

/* The Kraken: the longest reach on the floor, slow feet, and a defender nobody gets a pass round. Long Reach keeps the
   ball and the offensive glass, Grasp takes theirs, and Eight Arms: an arm in every passing lane and over every shot. */
BK_KIND.kraken = [5, 10, 5, 7, 7, 10];
BK_POW.kraken = [bkP('longreach', 'Long Reach', 1, 'pass', 'Eight arms for the ball: passes picked off half as often, and offensive rebounds a quarter likelier.', { stl: .5, reb: 1.25 }),
  bkP('grasp', 'Grasp', 1, 'any', 'A tentacle in every lane: half again the steals, and the contest a little stronger.', { stl: 1.5, con: 1.1 })];
BK_POW2.kraken = [bkP('inkscreen', 'Ink Screen', 1, 'shot', 'A cloud of ink round the shooter: the contest a quarter weaker.', { con: .75 }),
  bkP('tentaclewall', 'Tentacle Wall', 1, 'drive', 'Tentacles across the paint: drives stopped more often, and a third more blocks.', { lane: .4, blk: 1.3 })];
BK_ULT.kraken = bkU0('eightarms', 'Eight Arms', 'An arm in every lane: their passes and dribbles picked off far more, half again the blocks, and the boards.', null, { stl: 1.8, blk: 1.5, dreb: 1.3 }, ['#2f8f96', 'half']);

/* The Behemoth: the biggest thing on the floor and the best wall, with no feet and no handle. Moss Wall is a screen
   nobody gets over, Tremor stops their five where they stand, and its ultimate is the Great Earthquake (the ogre's
   Earthquake, and more): the other five frozen at every start, both ends, and the boards its side's. */
BK_KIND.behemoth = [5, 10, 6, 5, 3, 10];
BK_POW.behemoth = [bkP('mosswall', 'Moss Wall', 1, 'pass', 'A screen grown into a wall: nobody gets over a pick, and offensive rebounds a fifth likelier.', { wall: 1, reb: 1.2 }),
  bkP('tremor', 'Tremor', 2, 'any', 'A stamp as the ball comes up: their five frozen for most of a second.', { stunO: .8 })];
BK_POW2.behemoth = [bkP('trample', 'Trample', 2, 'drive', 'Straight through the lane: shots at the rim 9 points likelier, and a man beaten more often.', { rim: .09, beat: .08 }),
  bkP('boulderline', 'Boulder Line', 1, 'drive', 'Boulders across the lane: drives stopped more often, and the boards.', { lane: .4, dreb: 1.3 })];
BK_ULT.behemoth = bkU0('greatquake', 'Great Earthquake', 'The floor heaves at every start: their five frozen for over a second, at both ends, and the boards are yours.', { stunD: 1.2, reb: 1.25 }, { stunO: 1.2, dreb: 1.25 }, ['#7a5a34', 'all']);

/* The Djinn: all guile. Quick, the best handle there is, a shooter. Vanishing Act loses a defender off the dribble,
   Mirage has them shooting at a hoop that isn't there, and Three Wishes grants three small ones at once. */
BK_KIND.djinn = [9, 5, 7, 8, 10, 6];
BK_POW.djinn = [bkP('vanish', 'Vanishing Act', 1, 'drive', 'The ball is gone and back again: a man beaten more often, and the dribble and passes picked off far less.', { beat: .14, stl: .6 }),
  bkP('mirage', 'Mirage', 1, 'any', 'A hoop that isn\'t there: every shot 4 points less likely, and far fewer cuts found.', { shot: -.04, cut: .6 })];
BK_POW2.djinn = [bkP('luckywish', 'Lucky Wish', 1, 'any', 'A wish on the ball: every shot 3 points likelier, free throws 12.', { shot: .03, ft: .12 }),
  bkP('mirrorimage', 'Mirror Image', 1, 'pass', 'Which one has the ball? Their picks get nobody open, and steals a quarter more.', { fade: 1, stl: 1.25 })];
BK_ULT.djinn = bkU0('threewishes', 'Three Wishes', 'Three wishes at once for your side: every shot 4 points likelier, the offense 6% faster, and the ball picked off far less.', { shot: .04, oSpd: 1.06, stl: .6 }, null, ['#b38cf0', 'all']);

/* The Hydra: three heads, eyes everywhere, and big with it. Many Heads finds every cutter, Constrict closes on the
   ball, and Regrow: its five get breath back every possession and a head goes up for every rebound. */
BK_KIND.hydra = [7, 8, 6, 6, 6, 9];
BK_POW.hydra = [bkP('manyheads', 'Many Heads', 1, 'pass', 'Eyes everywhere: half again the cuts found, and passes picked off half as often.', { cut: 1.5, stl: .5 }),
  bkP('constrict', 'Constrict', 1, 'any', 'The defense closes round the ball: 8% faster, and steals a quarter more.', { dSpd: 1.08, stl: 1.25 })];
BK_POW2.hydra = [bkP('threeway', 'Three-way Option', 1, 'drive', 'Three heads, three ways to go: a man beaten more often, and the offense 4% faster.', { beat: .14, oSpd: 1.04 }),
  bkP('manybites', 'Many Bites', 1, 'any', 'A head for every shot: 40% more blocks, and the contest a little stronger.', { blk: 1.4, con: 1.1 })];
BK_ULT.hydra = bkU0('regrow', 'Regrow', 'Cut one head off and two grow back: your five get 7 stamina back every possession, and a head goes up for every rebound, both ends.', { staO: 7, reb: 1.4 }, { staD: 7, dreb: 1.3 }, ['#3f8a6a', 'all']);

/* The Frost Wyrm (kind frostwyrm): good at everything. Ice Path skates the offense past its men, Frostbite numbs their
   shooters, and Whiteout: a blizzard over the floor, their five slower and their shots off. */
BK_KIND.frostwyrm = [7, 8, 7, 7, 6, 7];
BK_KIND_N.frostwyrm = 'frost wyrm';
BK_POW.frostwyrm = [bkP('icepath', 'Ice Path', 1, 'drive', 'The floor freezes under your five: 8% faster, and a man beaten a little more often.', { oSpd: 1.08, beat: .08 }),
  bkP('frostbite', 'Frostbite', 1, 'shot', 'Numb fingers and slow feet: every shot 4 points less likely, and the offense 5% slower.', { shot: -.04, oSpd: .95 })];
BK_POW2.frostwyrm = [bkP('iceglide', 'Ice Glide', 1, 'shot', 'The ball glides on frost: threes 5 points likelier, and passes picked off less.', { three: .05, stl: .7 }),
  bkP('deepfreeze', 'Deep Freeze', 1, 'any', 'They freeze where they stand for half a second, and the offense is 5% slower.', { stunO: .5, oSpd: .95 })];
BK_ULT.frostwyrm = bkU0('whiteout', 'Whiteout', 'A blizzard over the whole floor: their five 15% slower, and every shot of theirs 5 points less likely.', null, { oSpd: .85, shot: -.05 }, ['#e8f4ff', 'all']);

for (const k of ['phoenix', 'kraken', 'behemoth', 'djinn', 'hydra', 'frostwyrm']) {
  for (const p of BK_POW[k].concat(BK_POW2[k])) BK_POW_BY[p.id] = p;
  BK_ULT_BY[BK_ULT[k].id] = BK_ULT[k];
}
