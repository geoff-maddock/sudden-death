/* Mossgate Links' superstars (issue #92, phase 8), inside the wGL scope: each superstar's golf ratings and powers,
   added to the engine's own tables after its parts load, as the rink's are (rink/k0-stars.js). Plain assignments,
   nothing declared. Ratings are [power, accuracy, touch, putting, nerve, scrambling]; each has a long-game power and a
   short-game power, a second of each (picked on the Links tab), and an ultimate. An id here must not be one of the
   engine's own (10-powers.js) or another's (test/realm_links_stars.py asserts it). A superstar is never picked for a
   CPU side by kind: the Realm only ever sends one as your own player. */

// The Phoenix: rises from any lie, and nothing frightens it. Firebird Drive rides its own heat; Rebirth: its four spend
// no focus for the rest of the hole, and swing truer for it.
GL_KIND.phoenix = [9, 7, 7, 6, 8, 10];
GL_POW.phoenix = [glP('firebird', 'Firebird Drive', 1, 'A drive on its own heat: further, and the wind barely moves it.', { dist: 1.08, wind: .5 }),
  glP('emberputt', 'Ember Putt', 1, 'A warm, true putt.', { putt: .75 })];
GL_POW2.phoenix = [glP('ashcloudgl', 'Ash Cloud', 1, 'A curse: ash in their eyes for their next stroke (a wilder miss, a shakier putt).', null, { err: 1.3, putt: 1.2 }),
  glP('warmread', 'Warm Read', 1, 'The green\'s heat shows its slope: a far longer read line.', { read: 1.6 })];
GL_ULT.phoenix = glU('rebirthgl', 'Rebirth', 'The phoenix\'s four rise from the ashes: no focus spent this hole, and every stroke truer.', { focus: 0, err: .85 });

// The Kraken: eight arms, the best touch and putting there are. The water is its own: From the Depths brings your
// balls back out of it, and shakes their putts.
GL_KIND.kraken = [8, 6, 9, 10, 7, 8];
GL_POW.kraken = [glP('tentacledrive', 'Tentacle Drive', 1, 'Eight arms on the club: the miss a fifth smaller.', { err: .8 }),
  glP('eightarm', 'Eight-arm Putt', 1, 'A putt held true by eight arms.', { putt: .7 })];
GL_POW2.kraken = [glP('inkcloud', 'Ink Cloud', 1, 'A curse: a cloud of ink over their next shot (a wilder miss).', null, { err: 1.3 }),
  glP('deepread', 'Deep Read', 1, 'Reads the green like the sea floor: the read line nearly twice as long.', { read: 1.8 })];
GL_ULT.kraken = glU('fromdepths', 'From the Depths', 'Every pond is the kraken\'s: your balls come back out of the water this hole, and their putts shake.', { water: 1 }, { putt: 1.3 });

// The Behemoth: the longest hitter in the realm and no touch at all. Earthshaker goes a mile; Great Quake heaves the
// greens under the other side.
GL_KIND.behemoth = [12, 4, 3, 5, 9, 7];
GL_POW.behemoth = [glP('earthshaker', 'Earthshaker', 1, 'The ground shakes when it swings: much further, and a little wilder.', { dist: 1.14, err: 1.15 }),
  glP('stompgl', 'Stomp', 1, 'A curse: a stomp under their next stroke (no roll, a shakier putt).', null, { roll: 0, putt: 1.25 })];
GL_POW2.behemoth = [glP('mossplough', 'Moss Plough', 1, 'Through the branches (it drops into the rough) and running on.', { trees: 1, roll: 1.4 }),
  glP('mountainputt', 'Mountain Putt', 1, 'Unmoved as a mountain: no pressure on it, and a truer putt.', { nerve: 1, putt: .85 })];
GL_ULT.behemoth = glU('greatquake', 'Great Quake', 'The greens heave under the other side: their putts half again as shaky this hole, and their balls stop short.', null, { putt: 1.5, roll: .5 });

// The Djinn: all touch and guile. Vanishing Ball can't lip out; Three Wishes grants three at once.
GL_KIND.djinn = [7, 9, 10, 9, 8, 8];
GL_POW.djinn = [glP('wishdrive', 'Wish Drive', 1, 'It goes where it was wished: the miss much smaller.', { err: .65 }),
  glP('vanishball', 'Vanishing Ball', 1, 'It vanishes and turns up in the cup: a putt from 2 yards can\'t lip out, and it is truer.', { lip: 2, putt: .8 })];
GL_POW2.djinn = [glP('miragegl', 'Mirage', 1, 'A curse: a mirage of wind across their next shot (10 mph, and a wilder miss).', null, { cross: 10, err: 1.15 }),
  glP('threereads', 'Three Reads', 1, 'Three readings of the green: the read line twice as long.', { read: 2 })];
GL_ULT.djinn = glU('threewishgl', 'Three Wishes', 'Three wishes this hole: every stroke truer, every putt steadier, every shot a little longer.', { err: .8, putt: .7, dist: 1.05 });

// The Hydra: three heads, eyes everywhere, and nerves of nine. Regrow: no focus spent this hole, and truer for it.
GL_KIND.hydra = [9, 8, 8, 8, 9, 8];
GL_POW.hydra = [glP('threehead', 'Three-head Drive', 1, 'Three heads on one swing: a little further, and the miss smaller.', { dist: 1.05, err: .85 }),
  glP('manyeyes', 'Many Eyes', 1, 'Every head reads the green: a far longer read line, a truer putt.', { read: 1.7, putt: .85 })];
GL_POW2.hydra = [glP('coilgl', 'Coil', 1, 'A curse: coils round their next swing (a wilder miss).', null, { err: 1.25 }),
  glP('regrownnerve', 'Regrown Nerve', 1, 'Cut one off and two grow back: no pressure on it.', { nerve: 1 })];
GL_ULT.hydra = glU('regrowgl', 'Regrow', 'Cut one head off and two grow back: your four spend no focus this hole, and swing truer.', { focus: 0, err: .85 });

// The Frost Wyrm (kind frostwyrm): long, cold and steady. Frost Wing takes the wind away; Whiteout blinds the other
// side for the rest of the hole.
GL_KIND.frostwyrm = [10, 8, 7, 8, 9, 8];
GL_POW.frostwyrm = [glP('frostwing', 'Frost Wing', 1, 'Flies on its own cold air: no wind on this shot, and a little further.', { wind: 0, dist: 1.04 }),
  glP('icedgreen', 'Iced Green', 1, 'A curse: the green ices over for their next putt (much shakier).', null, { putt: 1.35 })];
GL_POW2.frostwyrm = [glP('glacierrun', 'Glacier Run', 1, 'It lands on ice and runs: half again the roll and more.', { roll: 1.6 }),
  glP('coldblood', 'Cold Blood', 1, 'No pressure on it, and a truer putt.', { nerve: 1, putt: .85 })];
GL_ULT.frostwyrm = glU('whiteoutgl', 'Whiteout', 'A blizzard over the hole for the other side: their every stroke a third wilder, and their reads half as long.', null, { err: 1.3, read: .5 });
