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
