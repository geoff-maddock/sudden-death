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

/* The Kraken: slow, strong, sure hands and a tackler who doesn't let go. Long Reach on offense (catches far surer),
   Grasp on defense (every tackle try surer), and Eight Arms: tentacles across the field, tackles surer still and the
   carrier slowed. */
GF_KIND.kraken = [4, 8, 9, 6, 4, 8];
GF_POW.kraken = [{ id: 'longreach', n: 'Long Reach', cost: 1, fits: 'pass', desc: 'Eight arms for the ball: the receiver catches far more of what comes near.', fx: { catch: .12 } },
  { id: 'grasp', n: 'Grasp', cost: 1, fits: 'run', desc: 'Tentacles along the line: every tackle try is surer.', fx: { tkl: .12 } }];
GF_ULT.kraken = { id: 'eightarms', n: 'Eight Arms', role: 'def', desc: 'Tentacles across the whole field: every tackle surer, and the ball carrier 12% slower.', zone: { tkl: .15, cSpd: .88 }, vis: ['#2f8f96', 'all'] };
for (const p of GF_POW.kraken) GF_POW_BY[p.id] = p;
GF_ULT_BY[GF_ULT.kraken.id] = GF_ULT.kraken;
