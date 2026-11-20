/* The Saltmere Lanes' superstars (issue #100, phase 8), inside the wBL scope: each superstar's bowling ratings and
   powers, added to the engine's own tables after its parts load, as golf's are (links/l0-stars.js). Plain assignments,
   nothing declared. Ratings are [power, revs, accuracy, spare, nerve, read]; each has a strike power and a spare power,
   a second of each (picked on the Lanes tab), and an ultimate. Every id here ends in 'bl' so it is never one of the
   engine's own (13-powers.js) or another's (test/realm_lanes_stars.py asserts it). A superstar is never picked for a
   CPU side by kind: the Realm only ever sends one as your own player. */

// The Phoenix: nothing frightens it, and it never tires. Phoenix Ball drives on its own heat; Rebirth: your five spend
// no arm this frame, and throw truer.
BL_KIND.phoenix = [8, 8, 7, 8, 11, 7];
BL_POW.phoenix = [blP('phoenixbl', 'Phoenix Ball', 'A ball wrapped in flame: it drives a fifth harder.', { carry: 1.2 }),
  blP('emberbl', 'Ember Pickup', 'A warm, sure hand at a spare: the miss a third smaller.', { err: .65 })];
BL_POW2.phoenix = [blP('ashbl', 'Ash Cloud', 'A curse: ash in their eyes for their next ball (a wilder miss).', null, { err: 1.3 }),
  blP('risebl', 'Rise Again', 'Nothing to lose: no pressure on it, and truer.', { nerve: 1, err: .85 })];
BL_ULT.phoenix = blU('rebirthbl', 'Rebirth', 'Your five rise from the ashes: no arm spent this frame, and every ball truer.', { arm: 0, err: .8 });

// The Kraken: eight arms on the ball, the most revs in the realm. Its tentacles come up out of the pit for the
// ultimate and pull pins down after it.
BL_KIND.kraken = [8, 12, 7, 8, 7, 9];
BL_POW.kraken = [blP('tentaclebl', 'Tentacle Hook', 'Eight arms put the spin on: a fifth more hook, and it drives harder.', { hook: 1.2, carry: 1.05 }),
  blP('eightarmbl', 'Eight-arm Pickup', 'Eight arms steady the release: the miss much smaller.', { err: .6 })];
BL_POW2.kraken = [blP('inkbl', 'Ink Cloud', 'A curse: a cloud of ink over their next ball (a wilder miss).', null, { err: 1.3 }),
  blP('undertowbl', 'Undertow', 'The tide pulls a gutter ball back onto the lane, and the miss is smaller.', { web: 1, err: .85 })];
BL_ULT.kraken = blU('depthsbl', 'From the Depths', 'Tentacles rise from the pit: your balls this frame drive harder, and pins left beside a fallen one are dragged down.', { carry: 1.12, wobble: .3 });

// The Behemoth: the biggest ball in the realm and little touch (raised in phase 11: with 4s it cost a five more than an
// ordinary bowler did). Earthshaker goes through anything; Great Quake
// heaves the lanes under the other side.
BL_KIND.behemoth = [12, 7, 7, 6, 10, 6];
BL_POW.behemoth = [blP('shakerbl', 'Earthshaker', 'The floor shakes when it lets go: much harder through the pins, and wilder.', { carry: 1.3, err: 1.15 }),
  blP('mountainbl', 'Mountain Roll', 'Unmoved as a mountain: it barely deflects, and it is truer.', { nodefl: 1, err: .85 })];
BL_POW2.behemoth = [blP('stompbl', 'Stomp', 'A curse: a stomp as they release (a wilder miss).', null, { err: 1.3 }),
  blP('ploughbl', 'Moss Plough', 'Moss and rubble over the deck: every pin left beside one that fell may go.', { wobble: .3 })];
BL_ULT.behemoth = blU('quakebl', 'Great Quake', 'The lanes heave under the other side: their balls this frame a third wilder, and they carry less.', null, { err: 1.3, carry: .85 });

// The Djinn: all touch and guile, the best spare shooter there is. Three Wishes grants three at once.
BL_KIND.djinn = [6, 8, 10, 11, 8, 10];
BL_POW.djinn = [blP('wishbl', 'Wish Ball', 'It goes where it was wished: the miss much smaller.', { err: .6 }),
  blP('grantedbl', 'Granted', 'The spare is granted: the miss halved.', { err: .5 })];
BL_POW2.djinn = [blP('miragebl', 'Mirage', 'A curse: a mirage of oil over their next ball (wilder, and it skids long).', null, { err: 1.15, skid: 1.02 }),
  blP('smokebl', 'Smoke Hand', 'The ball floats off a hand of smoke: no pressure on it, and truer.', { nerve: 1, err: .8 })];
BL_ULT.djinn = blU('wishesbl', 'Three Wishes', 'Three wishes this frame: every ball truer, steadier, and driving harder.', { err: .8, nerve: 1, carry: 1.08 });

// The Hydra: three heads, eyes everywhere, and nerves of nine. Regrow: no arm spent this frame, and truer for it.
BL_KIND.hydra = [9, 9, 8, 8, 10, 8];
BL_POW.hydra = [blP('threeheadbl', 'Three-head Ball', 'Three heads on one throw: harder through the pins, and truer.', { carry: 1.1, err: .9 }),
  blP('manyeyesbl', 'Many Eyes', 'Every head watches the pin: the miss a third smaller.', { err: .7 })];
BL_POW2.hydra = [blP('coilbl', 'Coil', 'A curse: coils round their next swing (a wilder miss).', null, { err: 1.25 }),
  blP('nervebl', 'Regrown Nerve', 'Cut one off and two grow back: no pressure on it, and truer.', { nerve: 1, err: .85 })];
BL_ULT.hydra = blU('regrowbl', 'Regrow', 'Cut one head off and two grow back: your five spend no arm this frame, and throw truer.', { arm: 0, err: .85 });

// The Frost Wyrm (kind frostwyrm): heavy, cold and steady. Iced Lane freezes the oil under the other side; Whiteout
// blinds them for a frame.
BL_KIND.frostwyrm = [10, 7, 8, 8, 9, 8];
BL_POW.frostwyrm = [blP('glacierbl', 'Glacier Ball', 'A ball of ice: it drives a sixth harder and barely deflects.', { carry: 1.15, nodefl: 1 }),
  blP('coldbl', 'Cold Blood', 'No pressure on it, and truer.', { nerve: 1, err: .85 })];
BL_POW2.frostwyrm = [blP('icedbl', 'Iced Lane', 'A curse: the oil freezes slick for their next ball, and it skids long.', null, { skid: 1.04 }),
  blP('frostwingbl', 'Frost Wing', 'A breath of cold air steadies the ball: the miss a third smaller.', { err: .7 })];
BL_ULT.frostwyrm = blU('whiteoutbl', 'Whiteout', 'A blizzard over the lanes for the other side: their balls this frame a third wilder, and they skid long.', null, { err: 1.25, skid: 1.04 });
