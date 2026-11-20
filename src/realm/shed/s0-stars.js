/* The Curling Shed's superstars (issue #102, phase 8), inside the wCR scope: each superstar's curling ratings and
   powers, added to the engine's own tables after its parts load, as bowling's are (lanes/p0-stars.js). Plain
   assignments, nothing declared. Ratings are [draw, line, hit, sweep, nerve, read]; each has a draw power and a hit
   power, a second of each (picked on the Shed tab), and an ultimate. Every id here ends in 'cr' so it is never one of
   the engine's own (13-powers.js) or another's (test/realm_shed_stars.py asserts it). A superstar is never picked for a
   CPU side by kind: the Realm only ever sends one as your own player. */

// The Phoenix: nothing frightens it, and it never tires. Warm Stone melts a path for the sweepers; Rebirth: your four
// spend no legs this end, and throw truer.
CR_KIND.phoenix = [8, 8, 7, 9, 11, 7];
CR_POW.phoenix = [crP('warmstonecr', 'Warm Stone', 'A stone warm from the fire: the sweepers do a quarter more on it.', { sweep: 1.25 }),
  crP('flamelinecr', 'Flame Line', 'A line of fire to the stone: its miss nearly a third smaller.', { line: .7 })];
CR_POW2.phoenix = [crP('risecr', 'Rise Again', 'Nothing to lose: no pressure on it, and truer.', { nerve: 1, err: .85 }),
  crP('ashcr', 'Ash Cloud', 'A curse: ash over the sheet for their next stone (a third wilder).', null, { err: 1.3 })];
CR_ULT.phoenix = crU('rebirthcr', 'Rebirth', 'Your four rise from the ashes: no legs spent sweeping this end, and every stone truer.', { legs: 0, err: .85 });

// The Kraken: eight arms on the brooms, the best sweeper in the realm. Its tentacles come up through the ice for the
// ultimate and sweep every stone of yours home.
CR_KIND.kraken = [8, 7, 7, 12, 7, 9];
CR_POW.kraken = [crP('tentaclecr', 'Tentacle Sweep', 'Eight arms on the brooms: the sweepers do a third more, and tire less.', { sweep: 1.3, legs: .7 }),
  crP('graspcr', 'Grasp', 'A tentacle sets the stone where it lies: once at rest, a hit barely moves it.', { granite: 1 })];
CR_POW2.kraken = [crP('inkcr', 'Ink Cloud', 'A curse: ink under the ice for their next stone (a third wilder).', null, { err: 1.3 }),
  crP('undertowcr', 'Undertow', 'The tide in the ice pulls the line true: its miss a quarter smaller.', { line: .75 })];
CR_ULT.kraken = crU('depthscr', 'From the Depths', 'Tentacles rise through the ice: your sweepers do a third more this end, and spend no legs.', { sweep: 1.3, legs: 0 });

// The Behemoth: the heaviest hitter there is, and little touch. Earthshaker takes out anything; Great Quake heaves the
// ice under the other rink.
CR_KIND.behemoth = [6, 6, 12, 8, 10, 6];
CR_POW.behemoth = [crP('mountaincr', 'Mountain Stone', 'Set down like a mountain: once at rest, a hit barely moves it.', { granite: 1 }),
  crP('shakercr', 'Earthshaker', 'Thrown with the whole of it: the weight\'s miss a third smaller, the line a little.', { wt: .65, line: .9 })];
CR_POW2.behemoth = [crP('mosscr', 'Moss Read', 'The moss on its back knows the ice: the weight\'s miss a fifth smaller.', { wt: .8 }),
  crP('stompcr', 'Stomp', 'A curse: a stomp shakes the ice under their next stone (a quarter wilder).', null, { err: 1.25 })];
CR_ULT.behemoth = crU('quakecr', 'Great Quake', 'The ice heaves under the other rink: their stones this end a third wilder, and they drag.', null, { err: 1.3, heavy: 1.02 });

// The Djinn: all touch and guile, the best at a draw there is. Three Wishes grants three at once.
CR_KIND.djinn = [11, 10, 6, 7, 8, 10];
CR_POW.djinn = [crP('wishcr', 'Wish Stone', 'It goes where it was wished: the miss much smaller.', { err: .6 }),
  crP('grantedcr', 'Granted', 'The takeout is granted: the line\'s miss halved.', { line: .5 })];
CR_POW2.djinn = [crP('smokehandcr', 'Smoke Hand', 'The stone floats off a hand of smoke: no pressure on it, and truer.', { nerve: 1, err: .8 }),
  crP('miragecr', 'Mirage', 'A curse: a mirage over the ice for their next stone (it hardly curls, and goes wilder).', null, { stiff: .7, err: 1.1 })];
CR_ULT.djinn = crU('wishescr', 'Three Wishes', 'Three wishes this end: every stone of yours truer, steadier, and the sweepers stronger.', { err: .8, nerve: 1, sweep: 1.1 });

// The Hydra: three heads, eyes everywhere, and nerves of nine. Regrow: no legs spent this end, and truer for it.
CR_KIND.hydra = [9, 9, 8, 9, 10, 8];
CR_POW.hydra = [crP('manyeyescr', 'Many Eyes', 'Every head watches the broom: the miss a third smaller.', { err: .7 }),
  crP('threeheadcr', 'Three-head Hit', 'Three heads on one line: the line\'s miss a quarter smaller, the weight a little.', { line: .75, wt: .9 })];
CR_POW2.hydra = [crP('nervecr', 'Regrown Nerve', 'Cut one off and two grow back: no pressure on it, and truer.', { nerve: 1, err: .85 }),
  crP('coilcr', 'Coil', 'A curse: coils round their next delivery (a quarter wilder).', null, { err: 1.25 })];
CR_ULT.hydra = crU('regrowcr', 'Regrow', 'Cut one head off and two grow back: your four spend no legs this end, and throw truer.', { legs: 0, err: .85 });

// The Frost Wyrm (kind frostwyrm): cold and steady, at home on the ice. Rime freezes the other rink's next stone;
// Whiteout blinds them for an end.
CR_KIND.frostwyrm = [9, 8, 8, 8, 10, 9];
CR_POW.frostwyrm = [crP('frostbreathcr', 'Frost Breath', 'A breath over the pebble ahead of it: the sweepers do a fifth more, and it goes truer.', { sweep: 1.2, err: .9 }),
  crP('coldbloodcr', 'Cold Blood', 'No pressure on it, and truer.', { nerve: 1, err: .85 })];
CR_POW2.frostwyrm = [crP('frostwingcr', 'Frost Wing', 'A wingbeat of cold air steadies it: the miss a third smaller.', { err: .7 }),
  crP('rimecr', 'Rime', 'A curse: rime on their next stone, and it drags heavy.', null, { heavy: 1.04 })];
CR_ULT.frostwyrm = crU('whiteoutcr', 'Whiteout', 'A blizzard over the sheet for the other rink: their stones this end a quarter wilder, and they drag.', null, { err: 1.25, heavy: 1.03 });
