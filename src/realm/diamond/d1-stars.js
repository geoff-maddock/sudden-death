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

/* The Kraken: a first baseman with a long reach and a sticky bat (suckers on the barrel), slow on the bases; its
   ultimate Eight Arms sends tentacles up through the basepaths to grab the runners (the Grave Hands' grab). */
TEMPL.kraken = { n: 'Deepmaw', kind: 'kraken', race: 'Kraken', pos: '1B', num: 8, hand: 'L', pow: 8, con: 6, spd: 3, arm: 7, fld: 9, wpn: 'log', bat: 'sticky', run: null, field: null, flav: 'Has never dropped a throw. Has never given one back, either.' };
ULT.eightarms = { kind: 'kraken', role: 'field', name: 'Eight Arms', desc: 'Tentacles reach up through the basepaths and grab at every runner who passes.', zone: { shape: 'paths', grab: .5, vis: 'hands' } };
AB.eightarms = { name: '★ ' + ULT.eightarms.name, type: 'ult', role: ULT.eightarms.role, cost: ULT_COST, ult: true, desc: ULT.eightarms.desc };
ULT_BY_KIND.kraken = 'eightarms';
MOON_KIND.kraken = [2, ['fld', 'pow']];
