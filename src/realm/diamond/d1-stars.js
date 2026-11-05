/* Brimstone Diamond's superstars (issue #24, phase 2), inside the wBD scope: each superstar's player template and
   ultimate, added to the engine's own tables after its parts load (an ultimate is also an ability, AB, as
   08-ultimates.js makes them). Plain assignments, nothing declared. A superstar
   is not added to KINDS, so no club and no call-up ever has one; the Realm sends it as your own player (wBD.rate).
   The Phoenix: a centre fielder, fast, with a bat; Eagle Eye at the plate, Glide on the bases, Take Flight in the
   field, and its ultimate Sunfire: the sky burns over the outfield and fly balls carry further. */
TEMPL.phoenix = { n: 'Ashwing', kind: 'phoenix', race: 'Phoenix', pos: 'CF', num: 1, hand: 'R', pow: 6, con: 7, spd: 9, arm: 6, fld: 8, wpn: 'bat', bat: 'eagle', run: 'glide', field: 'flight', flav: 'Caught a home run ball and set it on fire, gently.' };
ULT.sunfire = { kind: 'phoenix', role: 'bat', name: 'Sunfire', desc: 'The sky catches fire over the outfield. Fly balls carry about 15% further while it burns.', zone: { shape: 'global', carry: 1.15, vis: 'fire' } };
AB.sunfire = { name: '★ ' + ULT.sunfire.name, type: 'ult', role: ULT.sunfire.role, cost: ULT_COST, ult: true, desc: ULT.sunfire.desc };
ULT_BY_KIND.phoenix = 'sunfire';
MOON_KIND.phoenix = [4, ['spd', 'pow']];
