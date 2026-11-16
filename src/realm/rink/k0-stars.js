/* Black Ice's superstars (issue #83, phase 9), inside the wHK scope: each superstar's ratings and powers, added to the
   engine's own tables after its parts load, as the court's are (c0-stars.js). Plain assignments, nothing declared.
   Ratings are [speed, size, hands, shot, defense, reflexes]; each has a puck power and a checking power, a second of
   each (picked on the Rink tab), and an ultimate. An id here must not be one of the engine's own (14-powers.js): a
   clash would silently replace the other power (test/realm_rink_stars.py asserts it). A superstar is never picked for
   a CPU side by kind: the Realm only ever sends one as your own player.

   The Phoenix: quick, and the best shot on the pond (it is on fire already). Blaze heats its side's shots, Ash Cloud
   spoils theirs, and its ultimate is Rebirth: its skaters never tire, and shoot better for it. */
HK_KIND.phoenix = [9, 4, 7, 9, 5, 6];
HK_POW.phoenix = [hkP('hkblaze', 'Blaze', 1, 'rush', 'The puck leaves the stick alight: every shot truer, and harder to stop.', { shot: .035, miss: -.02 }),
  hkP('ashcloud', 'Ash Cloud', 1, 'any', 'Ash in their eyes: their shots miss more, and their passes are picked off more.', { wild: .06, pick: 1.2 })];
HK_POW2.phoenix = [hkP('firetrail', 'Fire Trail', 1, 'rush', 'On wings of flame: faster, and hard to check.', { spd: 1.08, wall: .6 }),
  hkP('scorchedice', 'Scorched Ice', 1, 'fore', 'The ice melts under them: they are a tenth slower, and easier to poke.', { slow: .9, poke: .03 })];
HK_ULT.phoenix = hkU0('rebirthice', 'Rebirth', 'The phoenix\'s line rises from the ashes: it barely tires, and with the puck its shots are harder to stop.', { tire: .3, shot: .03 }, { tire: .3 });

/* The Kraken: the longest reach on the ice, slow feet, the best goalie there is, and a defender no pass gets round.
   Tentacle Pass keeps the puck, Grasp takes theirs, and Eight Arms in Every Lane does what it says. */
HK_KIND.kraken = [4, 10, 7, 6, 10, 10];
HK_POW.kraken = [hkP('tentaclepass', 'Tentacle Pass', 1, 'cycle', 'Eight arms for the puck: passes hardly ever picked off, and it is hard to poke away.', { safe: .3, guard: -.05 }),
  hkP('krakengrasp', 'Grasp', 1, 'trap', 'A tentacle in every lane: far more passes picked off, and more pokes come off.', { pick: 1.6, poke: .04 })];
HK_POW2.kraken = [hkP('inkshot', 'Ink Shot', 1, 'point', 'A cloud of ink in front of their goalie: set late for every shot.', { blind: .7 }),
  hkP('armsinnet', 'Arms in the Net', 2, 'box', 'An arm for every corner of your net: their shots are stopped far more.', { save: .06 })];
HK_ULT.kraken = hkU0('krakenarms', 'Eight Arms in Every Lane', 'An arm in every lane and two in the net: their passes picked off, their shots blocked, and what gets through stopped.', null, { pick: 1.8, block: 1.6, save: .04 }, 'crease');

/* The Behemoth: the biggest thing on the ice and the best wall, with no feet and no hands. Moss Plough goes through
   them, Tremor stops them where they stand, and the Great Icequake: the whole pond heaves under the other side. */
HK_KIND.behemoth = [4, 10, 3, 7, 10, 6];
HK_POW.behemoth = [hkP('mossplow', 'Moss Plough', 1, 'crash', 'Straight to the net and through whatever is there: checks bounce off, and the loose puck is yours.', { wall: .2, reb: 1.4 }),
  hkP('icetremor', 'Tremor', 2, 'any', 'A stamp that shakes the pond: they are much slower.', { slow: .85 })];
HK_POW2.behemoth = [hkP('boulder', 'Boulder Shot', 1, 'point', 'A shot like a rockfall: it beats the goalie more, and misses a little more.', { shot: .05, miss: .02 }),
  hkP('boulderwall', 'Boulder Wall', 1, 'collapse', 'Boulders in every lane: far more blocks, and checks that land.', { block: 1.7, hit: 1.3 })];
HK_ULT.behemoth = hkU0('icequake', 'Great Icequake', 'The pond heaves: with the puck nothing moves your carrier and every loose puck is yours; without it they stumble, and your checks flatten them.', { wall: .2, reb: 1.4 }, { slow: .82, hit: 1.6 });

/* The Djinn: all guile. Quick, the best hands there are, a shooter. Vanishing Puck can't be taken, Mirage has them
   shooting at a net that isn't there, and Three Wishes grants three small ones at once. */
HK_KIND.djinn = [9, 5, 10, 8, 6, 7];
HK_POW.djinn = [hkP('vanishpuck', 'Vanishing Puck', 1, 'cycle', 'The puck is gone and back again: nobody pokes it away, and passes get through.', { guard: -.1, safe: .5 }),
  hkP('miragenet', 'Mirage', 1, 'any', 'A net that isn\'t there: their shots miss far more.', { wild: .07 })];
HK_POW2.djinn = [hkP('luckybounce', 'Lucky Bounce', 1, 'crash', 'A wish on the puck: shots a little better, and the bounces yours.', { shot: .03, reb: 1.3 }),
  hkP('mirrorskater', 'Mirror Image', 1, 'man', 'Which one is real? More passes picked off, more pokes come off.', { pick: 1.4, poke: .04 })];
HK_ULT.djinn = hkU0('threewishesice', 'Three Wishes', 'Three wishes at once, with the puck: shots harder to stop, your skaters faster, and passes that get through.', { shot: .04, spd: 1.06, safe: .6 }, null, 'slot');

/* The Hydra: three heads, eyes everywhere, and big with it. Three Heads finds every pass, Constrict closes on the
   puck, and Regrow: its line never tires, and a head goes up for every loose puck. */
HK_KIND.hydra = [7, 8, 7, 7, 8, 8];
HK_POW.hydra = [hkP('threeheads', 'Three Heads', 1, 'cycle', 'Eyes everywhere: passes get through, and the one-timer is better.', { safe: .5, one: .04 }),
  hkP('hydracoil', 'Constrict', 1, 'fore', 'The coils close round the puck: your skaters faster, and pokes come off more.', { spd: 1.07, poke: .05 })];
HK_POW2.hydra = [hkP('threeshots', 'Three-way Shot', 1, 'rush', 'Three heads, three places it could go: their goalie is set late.', { blind: .75, shot: .015 }),
  hkP('manyjaws', 'Many Jaws', 1, 'box', 'A head in every lane: more blocks, and more passes picked off.', { block: 1.5, pick: 1.3 })];
HK_ULT.hydra = hkU0('regrowline', 'Regrow', 'Cut one head off and two grow back: your line barely tires, wins the loose pucks, and blocks more.', { tire: .3, reb: 1.4 }, { tire: .3, block: 1.3 });

/* The Frost Wyrm (kind frostwyrm): at home on the ice, and good at everything on it. Ice Path skates past them,
   Frostbite numbs them, and Whiteout: a blizzard over the whole pond. */
HK_KIND.frostwyrm = [9, 8, 7, 8, 7, 7];
HK_POW.frostwyrm = [hkP('icepathrink', 'Ice Path', 1, 'rush', 'The ice runs smooth ahead of your skaters: an eighth faster, and harder to check.', { spd: 1.12, wall: .7 }),
  hkP('frostbiterink', 'Frostbite', 1, 'any', 'Numb hands and slow feet: they are a tenth slower, and their shots miss more.', { slow: .9, wild: .04 })];
HK_POW2.frostwyrm = [hkP('glare', 'Glare Ice', 1, 'cycle', 'The ice shines in their goalie\'s eyes: set late for every shot.', { blind: .7, shot: .01 }),
  hkP('rimefrost', 'Rime', 1, 'trap', 'Rime on their blades: an eighth slower.', { slow: .86 })];
HK_ULT.frostwyrm = hkU0('whiteoutrink', 'Whiteout', 'A blizzard over the whole pond: without the puck they are a fifth slower and their shots go astray; with it their goalie can\'t see yours.', { blind: .7 }, { slow: .8, wild: .06 });

for (const k of ['phoenix', 'kraken', 'behemoth', 'djinn', 'hydra', 'frostwyrm']) {
  for (const p of HK_POW[k].concat(HK_POW2[k])) HK_POW_BY[p.id] = p;
  HK_ULT_BY[HK_ULT[k].id] = HK_ULT[k];
}
