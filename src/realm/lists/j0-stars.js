/* The Tilting Lists' superstars (issue #117, phase 9), inside the wJT scope: each superstar's jousting ratings and
   powers, added to the engine's own tables after its parts load, as curling's are (shed/s0-stars.js). Plain
   assignments, nothing declared. Ratings are [lance, couch, seat, shield, ride, nerve, care] (JT_STATS); each has a
   lance power and a shield power, a second of each (picked on the Lists tab), one of the four a curse, and an ultimate
   that marks a course. Effects use only the engine's own (JT_FX0). Every id here ends in 'jt' so it is never one of
   the engine's own (12-powers.js) or another's (test/realm_lists_stars.py asserts it). A superstar is never picked
   for a CPU side by kind: the Realm only ever sends one as your own player. */

// The Phoenix: fast, fearless, and hard to keep down. A lance tipped with fire; Rebirth: it can't be unhorsed this
// course, rises above any shake, and its mount spends no wind.
JT_KIND.phoenix = [9, 9, 7, 7, 11, 11, 5];
JT_POW.phoenix = [jtP('flamelancejt', 'Flame Lance', 'A lance tipped with fire: it breaks a sixth more often, and rocks them a little harder, this course.', { fx: { brk: 1.16, rock: 1.06 } }),
  jtP('risejt', 'Rise Again', 'Nothing to lose: no pressure, any shake counts for nothing, and a little firmer seat, this course.', { fx: { nerve: 1, calm: 1, hold: .05 } })];
JT_POW2.phoenix = [jtP('ashjt', 'Ash Cloud', 'A curse: ash in their visor, and their tip sways a sixth more for the rest of the heat.', { curse: { sway: 1.15 } }),
  jtP('heatjt', 'Wall of Heat', 'A shimmer of heat off the shield: their tip sways a quarter more this course.', { on: { sway: 1.25 } })];
JT_ULT.phoenix = jtU('rebirthjt', 'Rebirth', 'It rises from the ashes: it can\'t be unhorsed, any shake counts for nothing, and the charge costs the mount no wind, this course.', { stay: 1, calm: 1, wind: 0 });

// The Kraken: eight arms, a long reach and a grip nothing shifts; slow on a horse, and the best squire there is.
// From the Depths: tentacles come up through the sand and take hold of the other rider.
JT_KIND.kraken = [10, 9, 10, 8, 5, 7, 10];
JT_POW.kraken = [jtP('tentaclejt', 'Tentacle Grip', 'Eight arms hold the lance still: the tip a fifth steadier this course.', { fx: { sway: .8 } }),
  jtP('suckerjt', 'Suckers', 'Suckers on the saddle: a much firmer seat this course.', { fx: { hold: .13 } })];
JT_POW2.kraken = [jtP('inkjt', 'Ink Cloud', 'A curse: ink in their visor, and their couch comes late for the rest of the heat.', { curse: { late: .2 } }),
  jtP('undertowjt', 'Undertow', 'The blow is lost in the deep: their broken lance rocks you nearly a third softer this course.', { fx: { soak: .72 } })];
JT_ULT.kraken = jtU('depthsjt', 'From the Depths', 'Tentacles rise through the sand: you sit firmer, and they sit much worse and come on slower, this course.', { hold: .08 }, { hold: -.12, speed: .94 });

// The Behemoth: a wall that moves. It sits like a hill and its shield is a slab of moss-grown stone, but its lance is
// slow to find a mark. Earthquake heaves the lists under the other rider.
JT_KIND.behemoth = [8, 6, 12, 11, 6, 10, 4];
JT_POW.behemoth = [jtP('tuskjt', 'Tusk Lance', 'A lance like a tusk: a broken one rocks them a quarter harder this course.', { fx: { rock: 1.25 } }),
  jtP('mossbackjt', 'Mossback', 'A shield grown over with moss and stone: their lance breaks on you a seventh less often, and a little firmer seat, this course.', { fx: { turn: .86, hold: .04 } })];
JT_POW2.behemoth = [jtP('stompjt', 'Stomp', 'A curse: the ground shakes under them, and they sit worse for the rest of the heat.', { curse: { hold: -.07 } }),
  jtP('platedjt', 'Plated Hide', 'Plates like a hillside: their broken lance rocks you nearly a third softer this course.', { fx: { soak: .7 } })];
JT_ULT.behemoth = jtU('quakejt', 'Earthquake', 'The lists heave under the other rider: they sit much worse, and their tip sways a quarter more, this course.', null, { hold: -.13, sway: 1.25 });

// The Djinn: all guile, the truest lance in the realm and a light seat. Three Wishes grants three at once.
JT_KIND.djinn = [11, 10, 6, 7, 8, 8, 7];
JT_POW.djinn = [jtP('wishjt', 'Wish Lance', 'It goes where it was wished: the tip more than a quarter steadier this course.', { fx: { sway: .72 } }),
  jtP('smokejt', 'Smoke Body', 'Half smoke at the impact: their lance breaks on you a seventh less often this course.', { fx: { turn: .86 } })];
JT_POW2.djinn = [jtP('miragejt', 'Mirage', 'A curse: a mirage over the lists, and their tip sways more and their couch comes late for the rest of the heat.', { curse: { sway: 1.1, late: .1 } }),
  jtP('lampjt', 'Lamp Smoke', 'Smoke pours off the shield: their tip sways a quarter more this course.', { on: { sway: 1.25 } })];
JT_ULT.djinn = jtU('wishesjt', 'Three Wishes', 'Three wishes this course: a steadier tip, a lance that breaks more often, and a firmer seat.', { sway: .8, brk: 1.15, hold: .08 });

// The Hydra: three heads and the nerves of nine, and harder to put down the more it is hit. Regrow: it can't be
// unhorsed this course, shrugs off any shake, and its lance breaks more often.
JT_KIND.hydra = [9, 8, 10, 8, 7, 10, 6];
JT_POW.hydra = [jtP('threeheadjt', 'Three Heads', 'Three heads on one line: the lance breaks more often, and holds a little steadier, this course.', { fx: { brk: 1.12, sway: .9 } }),
  jtP('coiljt', 'Coil', 'Coiled round the saddle: a much firmer seat this course.', { fx: { hold: .13 } })];
JT_POW2.hydra = [jtP('venomjt', 'Venom Spit', 'A curse: venom in their mount, and it tires half again as fast for the rest of the heat.', { curse: { wind: 1.45 } }),
  jtP('scalesjt', 'Hydra Scales', 'Scales that close over the blow: their lance breaks on you an eighth less often this course.', { fx: { turn: .88 } })];
JT_ULT.hydra = jtU('regrowjt', 'Regrow', 'Cut one head off and two grow back: it can\'t be unhorsed, any shake counts for nothing, and its lance breaks more often, this course.', { stay: 1, calm: 1, brk: 1.12 });

// The Frost Wyrm (kind frostwyrm): strong at everything, cold and steady. Blizzard slows the whole lists for the
// other rider.
JT_KIND.frostwyrm = [10, 9, 9, 8, 8, 9, 6];
JT_POW.frostwyrm = [jtP('icelancejt', 'Ice Lance', 'A lance frozen hard: it breaks more often, and rocks them a little harder, this course.', { fx: { brk: 1.14, rock: 1.08 } }),
  jtP('frostwingjt', 'Frost Wing', 'A wingbeat of cold air at the impact: their tip sways a quarter more this course.', { on: { sway: 1.25 } })];
JT_POW2.frostwyrm = [jtP('rimejt', 'Rime', 'A curse: rime on their mount and their arm, and the mount tires faster and the couch comes late for the rest of the heat.', { curse: { wind: 1.3, late: .12 } }),
  jtP('coldbloodjt', 'Cold Blood', 'No nerves at all: no pressure, any shake counts for nothing, and a little firmer seat, this course.', { fx: { nerve: 1, calm: 1, hold: .04 } })];
JT_ULT.frostwyrm = jtU('blizzardjt', 'Blizzard', 'A blizzard over the lists for the other rider: their tip sways a third more, they come on slower, and their couch comes late, this course.', null, { sway: 1.3, speed: .94, late: .15 });
