/* Cinder Gridiron's superstars (issue #24, phase 2), inside the wGF scope: each superstar's ratings and powers, added
   to the engine's own tables after its parts load. Plain assignments, nothing declared.
   The Phoenix: fast, good hands; its offense power sets the carrier alight, its defense power drops ash in the
   offense's eyes, and its ultimate is Rebirth: its whole side rises from the ashes, stamina back every play it lasts,
   while the field burns under the defense. */
GF_KIND.phoenix = [9, 4, 8, 6, 5, 5];
GF_POW.phoenix = [{ id: 'blaze', n: 'Blaze', cost: 1, fits: 'run', desc: 'The carrier catches fire: 8% faster, and untackleable for half a second after the handoff.', fx: { cSpd: 1.08, untag: .5 } },
  { id: 'ashfall', n: 'Ash Fall', cost: 1, fits: 'any', desc: 'Ash in their eyes: the throw flies wider, and the carrier is 6% slower.', fx: { errM: 1.3, cSpd: .94 } }];
GF_ULT.phoenix = { id: 'rebirth', n: 'Rebirth', role: 'off', desc: 'The phoenix\'s side rises from the ashes: 8 stamina back for all seven each play it lasts, and the defense wades through fire, 5% slower.', zone: { dSpd: .95 }, restZ: 8, vis: ['#ff8a3c', 'all'] };
for (const p of GF_POW.phoenix) GF_POW_BY[p.id] = p;
GF_ULT_BY[GF_ULT.phoenix.id] = GF_ULT.phoenix;

/* The Kraken: no sprinter, but strong, with sure hands and a tackler who doesn't let go. Long Reach on offense
   (catches far surer), Grasp on defense (every tackle try surer), and Eight Arms: tentacles across the field,
   tackles surer still and the carrier slowed. */
GF_KIND.kraken = [6, 9, 9, 6, 4, 9];
GF_POW.kraken = [{ id: 'longreach', n: 'Long Reach', cost: 1, fits: 'pass', desc: 'Eight arms for the ball: the receiver catches far more of what comes near.', fx: { catch: .12 } },
  { id: 'grasp', n: 'Grasp', cost: 1, fits: 'run', desc: 'Tentacles along the line: every tackle try is surer.', fx: { tkl: .12 } }];
GF_ULT.kraken = { id: 'eightarms', n: 'Eight Arms', role: 'def', desc: 'Tentacles across the whole field: every tackle surer, and the ball carrier 12% slower.', zone: { tkl: .15, cSpd: .88 }, vis: ['#2f8f96', 'all'] };
for (const p of GF_POW.kraken) GF_POW_BY[p.id] = p;
GF_ULT_BY[GF_ULT.kraken.id] = GF_ULT.kraken;

/* The Behemoth: the strongest thing on the field, and no sprinter. Moss Wall on offense (blocks hold, the carrier
   pushes through), Tremor on defense (every blocker stumbles at the snap), and Earthquake: every defender knocked
   off their feet at the snap, and the ground stays broken under them. */
GF_KIND.behemoth = [5, 10, 5, 6, 5, 10];
GF_POW.behemoth = [{ id: 'mosswall', n: 'Moss Wall', cost: 1, fits: 'run', desc: 'The line grows into a wall: blocks hold twice as long, and the carrier pushes through tackles.', fx: { shed: .5, cStr: 1 } },
  { id: 'tremor', n: 'Tremor', cost: 2, fits: 'any', desc: 'A stamp at the snap: every blocker stumbles.', fx: { blkStun: .7 } }];
GF_ULT.behemoth = { id: 'earthquake', n: 'Earthquake', role: 'off', desc: 'The field heaves at the snap: every defender goes down for two seconds, and the broken ground slows them after (5%).', now: { snapAll: 2 }, zone: { dSpd: .95 }, vis: ['#7a5a34', 'all'] };
for (const p of GF_POW.behemoth) GF_POW_BY[p.id] = p;
GF_ULT_BY[GF_ULT.behemoth.id] = GF_ULT.behemoth;

/* The Djinn: quick, clever hands. Vanishing Act on offense (the defense breaks on the throw late), Mirage on defense
   (their carrier chases phantoms, slower), and Three Wishes: three small wishes granted at once, the defense reading
   the play late, the receivers quicker and the hands surer. */
GF_KIND.djinn = [9, 5, 9, 9, 6, 5];
GF_POW.djinn = [{ id: 'vanish', n: 'Vanishing Act', cost: 1, fits: 'pass', desc: 'The receivers blink out of sight: the defense breaks on the throw late.', fx: { read: .6 } },
  { id: 'phantom', n: 'Mirage', cost: 1, fits: 'run', desc: 'Phantom tacklers everywhere: their carrier 8% slower.', fx: { cSpd: .92 } }];
GF_ULT.djinn = { id: 'threewishes', n: 'Three Wishes', role: 'off', desc: 'Three wishes at once: the defense reads the play late, the receivers run 5% faster, and the hands are surer.', zone: { read: .8, rSpd: 1.05, catch: .06 }, vis: ['#b38cf0', 'all'] };
for (const p of GF_POW.djinn) GF_POW_BY[p.id] = p;
GF_ULT_BY[GF_ULT.djinn.id] = GF_ULT.djinn;

/* The Hydra: three heads, eyes everywhere, hard to bring down. Many Heads on offense (the throw goes truer), Coils
   on defense (the coverage quicker, more picks), and Regrow: its side grows back, stamina every play, and its carrier
   harder to bring down. */
GF_KIND.hydra = [7, 8, 8, 7, 5, 9];
GF_POW.hydra = [{ id: 'manyheads', n: 'Many Heads', cost: 1, fits: 'pass', desc: 'Eyes everywhere: the quarterback sees the open man, and the throw goes 30% truer.', fx: { errM: .7 } },
  { id: 'coils', n: 'Coils', cost: 1, fits: 'pass', desc: 'The coverage coils round the receivers: 5% faster, and more throws picked off.', fx: { coverSpd: 1.05, int: 1.3 } }];
GF_ULT.hydra = { id: 'regrow', n: 'Regrow', role: 'off', desc: 'Cut one head off and two grow back: the hydra\'s side gets 6 stamina back every play it lasts, and its carrier is harder to bring down.', zone: { cStr: 1 }, restZ: 6, vis: ['#3f8a6a', 'all'] };
for (const p of GF_POW.hydra) GF_POW_BY[p.id] = p;
GF_ULT_BY[GF_ULT.hydra.id] = GF_ULT.hydra;

/* The Frost Wyrm (kind frostwyrm): good at everything. Ice Path on offense (the carrier skates, faster), Frostbite on
   defense (throws fly off line, receivers slower), and Whiteout: a blizzard over the field, their whole offense
   slower and their throws off line. */
GF_KIND.frostwyrm = [8, 7, 7, 7, 6, 7];
GF_POW.frostwyrm = [{ id: 'icepath', n: 'Ice Path', cost: 1, fits: 'run', desc: 'The ground freezes under the carrier: they skate 8% faster.', fx: { cSpd: 1.08 } },
  { id: 'frostbite', n: 'Frostbite', cost: 1, fits: 'pass', desc: 'Numb fingers and slow feet: the throw flies off line and the receivers run 5% slower.', fx: { errA: .5, rSpd: .95 } }];
GF_ULT.frostwyrm = { id: 'whiteout', n: 'Whiteout', role: 'def', desc: 'A blizzard over the whole field: their offense 20% slower, and their throws off line.', zone: { oSpd: .8, errA: .5 }, vis: ['#e8f4ff', 'all'] };
for (const p of GF_POW.frostwyrm) GF_POW_BY[p.id] = p;
GF_ULT_BY[GF_ULT.frostwyrm.id] = GF_ULT.frostwyrm;

/* Their second powers (issue #61, phase 6), as every league kind has: the one each brings, each way, is picked on the
   Seven tab. [offense, defense], into GF_POW2. */
GF_POW2.phoenix = [{ id: 'firewings', n: 'Fire Wings', cost: 1, fits: 'pass', desc: 'Receivers on wings of flame: 6% faster on their routes, and 5% more past 8 yards.', fx: { rSpd: 1.06, deepSpd: 1.05 } },
  { id: 'scorch', n: 'Scorched Earth', cost: 1, fits: 'run', desc: 'The ground burns where the ball is taken: the carrier slowed for 1.2 seconds.', fx: { cSlow: 1.2 } }];
GF_POW2.kraken = [{ id: 'inkscreen', n: 'Ink Screen', cost: 1, fits: 'pass', desc: 'A cloud of ink off the line: the coverage loses the receivers for a second.', fx: { coverSlow: 1 } },
  { id: 'tentaclewall', n: 'Tentacle Wall', cost: 1, fits: 'pass', desc: 'Tentacles pull the blockers off: blocks are shed 40% more often.', fx: { shed: 1.4 } }];
GF_POW2.behemoth = [{ id: 'bulldoze', n: 'Bulldoze', cost: 1, fits: 'run', desc: 'Straight through: the carrier +2.5 strength against tackles, and +1 blocking strength.', fx: { cStr: 2.5, blk: 1 } },
  { id: 'boulderline', n: 'Boulder Line', cost: 1, fits: 'run', desc: 'A line of boulders: +3 strength against blocks.', fx: { dStr: 3 } }];
GF_POW2.djinn = [{ id: 'luckywish', n: 'Lucky Wish', cost: 1, fits: 'pass', desc: 'A wish on the throw: it flies truer and is likelier caught.', fx: { errM: .8, catch: .1 } },
  { id: 'mirrorimage', n: 'Mirror Image', cost: 1, fits: 'pass', desc: 'Mirror images in the coverage: more throws picked off, and the defense reads them sooner.', fx: { int: 1.6, read: -.2 } }];
GF_POW2.hydra = [{ id: 'threeway', n: 'Three-way Option', cost: 1, fits: 'run', desc: 'Three heads, three ways to go: the carrier through the first tackle, and 4% faster.', fx: { breakN: 1, cSpd: 1.04 } },
  { id: 'hydrabite', n: 'Many Bites', cost: 1, fits: 'any', desc: 'A head for every ball carrier: tackles likelier.', fx: { tkl: .15 } }];
GF_POW2.frostwyrm = [{ id: 'iceglide', n: 'Ice Glide', cost: 1, fits: 'pass', desc: 'The ball glides on frost: 15% faster through the air, and the receivers 4% faster.', fx: { ballV: 1.15, rSpd: 1.04 } },
  { id: 'deepfreeze', n: 'Deep Freeze', cost: 1, fits: 'run', desc: 'The carrier freezes up: 12% slower, and tackles a little likelier.', fx: { cSpd: .88, tkl: .05 } }];
for (const k of ['phoenix', 'kraken', 'behemoth', 'djinn', 'hydra', 'frostwyrm']) for (const p of GF_POW2[k]) GF_POW_BY[p.id] = p;
