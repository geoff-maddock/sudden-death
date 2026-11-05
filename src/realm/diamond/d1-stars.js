/* Brimstone Diamond's superstars (issue #24, phase 2), inside the wBD scope: each superstar's player template and
   ultimate, added to the engine's own tables after its parts load (an ultimate is also an ability, AB, as
   08-ultimates.js makes them). Plain assignments, nothing declared. A superstar
   is not added to KINDS, so no club and no call-up ever has one; the Realm sends it as your own player (wBD.rate).
   The Phoenix: a centre fielder, fast, with a bat; Eagle Eye at the plate, Glide on the bases, Take Flight in the
   field, and its ultimate Sunfire: the sky burns over the outfield and fly balls carry further. */
TEMPL.phoenix = { n: 'Ashwing', kind: 'phoenix', race: 'Phoenix', pos: 'CF', num: 1, hand: 'R', pow: 7, con: 8, spd: 9, arm: 6, fld: 8, wpn: 'bat', bat: 'eagle', run: 'glide', field: 'flight', flav: 'Caught a home run ball and set it on fire, gently.' };
ULT.sunfire = { kind: 'phoenix', role: 'bat', name: 'Sunfire', desc: 'The sky catches fire over the outfield. Fly balls carry about 15% further while it burns.', zone: { shape: 'global', carry: 1.15, vis: 'fire' } };
AB.sunfire = { name: '★ ' + ULT.sunfire.name, type: 'ult', role: ULT.sunfire.role, cost: ULT_COST, ult: true, desc: ULT.sunfire.desc };
ULT_BY_KIND.phoenix = 'sunfire';
MOON_KIND.phoenix = [4, ['spd', 'pow']];

/* The Kraken: a first baseman with a long reach and a sticky bat (suckers on the barrel), slow on the bases; its
   ultimate Eight Arms sends tentacles up through the basepaths to grab the runners (the Grave Hands' grab). */
TEMPL.kraken = { n: 'Deepmaw', kind: 'kraken', race: 'Kraken', pos: '1B', num: 8, hand: 'L', pow: 9, con: 7, spd: 5, arm: 7, fld: 10, wpn: 'log', bat: 'sticky', run: null, field: null, flav: 'Has never dropped a throw. Has never given one back, either.' };
ULT.eightarms = { kind: 'kraken', role: 'field', name: 'Eight Arms', desc: 'Tentacles reach up through the basepaths and grab at every runner who passes.', zone: { shape: 'paths', grab: .5, vis: 'hands' } };
AB.eightarms = { name: '★ ' + ULT.eightarms.name, type: 'ult', role: ULT.eightarms.role, cost: ULT_COST, ult: true, desc: ULT.eightarms.desc };
ULT_BY_KIND.kraken = 'eightarms';
MOON_KIND.kraken = [2, ['fld', 'pow']];

/* The Behemoth: a slugger at third, slow as a wall and as hard to move: Seismic Swing at the plate, Stone Skin on the
   bases (immune to fielders' spells), Quake in the field; its ultimate Earthquake staggers every fielder for as long
   as it lasts (slower, and bobbling the ball). */
TEMPL.behemoth = { n: 'Hillbreath', kind: 'behemoth', race: 'Behemoth', pos: '3B', num: 70, hand: 'R', pow: 10, con: 8, spd: 4, arm: 9, fld: 8, wpn: 'tree', bat: 'seismic', run: 'stoneskin', field: 'quake', flav: 'The infield grass grows back wherever it has stood.' };
ULT.earthquake = { kind: 'behemoth', role: 'bat', name: 'Earthquake', desc: 'Stamps before the pitch. The whole field heaves: fielders move 25% slower and bobble far more.', zone: { shape: 'global', fSpd: .75, bobble: 1.6, vis: 'fissure' } };
AB.earthquake = { name: '★ ' + ULT.earthquake.name, type: 'ult', role: ULT.earthquake.role, cost: ULT_COST, ult: true, desc: ULT.earthquake.desc };
ULT_BY_KIND.behemoth = 'earthquake';
MOON_KIND.behemoth = [2, ['pow', 'arm']];

/* The Djinn: a shortstop who reads everything: Dispel at the plate, Invisibility on the bases, Telekinesis in the
   field; its ultimate Three Wishes grants three at once: the ball carries a little further, and fielders react late
   and bobble more. */
TEMPL.djinn = { n: 'Zarim', kind: 'djinn', race: 'Djinn', pos: 'SS', num: 3, hand: 'R', pow: 9, con: 9, spd: 8, arm: 7, fld: 8, wpn: 'bat', bat: 'dispel', run: 'invis', field: 'telek', flav: 'Grants three wishes an inning, all of them to itself.' };
ULT.threewishes = { kind: 'djinn', role: 'bat', name: 'Three Wishes', desc: 'Three wishes at once: the ball carries a little further, and the fielders react late and bobble more.', zone: { shape: 'global', carry: 1.06, react: .3, bobble: 1.4, vis: 'eclipse' } };
AB.threewishes = { name: '★ ' + ULT.threewishes.name, type: 'ult', role: ULT.threewishes.role, cost: ULT_COST, ult: true, desc: ULT.threewishes.desc };
ULT_BY_KIND.djinn = 'threewishes';
MOON_KIND.djinn = [5, ['con', 'fld']];

/* The Hydra: a catcher with three heads, so it sees everything: Undying at the plate (strike three is a foul),
   Block the Plate in the field; its ultimate Many Heads has every fielder reacting sooner. */
TEMPL.hydra = { n: 'Threefold', kind: 'hydra', race: 'Hydra', pos: 'C', num: 33, hand: 'R', pow: 9, con: 8, spd: 5, arm: 9, fld: 8, wpn: 'spiked', bat: 'undying', run: null, field: 'block', flav: 'Calls three pitches at once. The pitcher picks.' };
ULT.manyheads = { kind: 'hydra', role: 'field', name: 'Many Heads', desc: 'Three heads watch every ball: every fielder reacts a quarter of a second sooner.', zone: { shape: 'global', react: -.25, vis: 'grass' } };
AB.manyheads = { name: '★ ' + ULT.manyheads.name, type: 'ult', role: ULT.manyheads.role, cost: ULT_COST, ult: true, desc: ULT.manyheads.desc };
ULT_BY_KIND.hydra = 'manyheads';
MOON_KIND.hydra = [7, ['arm', 'con']];

/* The Frost Wyrm (kind frostwyrm): a right fielder good at everything: Blood Pact at the plate, Fleet Foot on the
   bases, Boulder Arm in the field; its ultimate Whiteout brings the snow, runners slower and swings stiff. */
TEMPL.frostwyrm = { n: 'Hoarfang', kind: 'frostwyrm', race: 'Frost Wyrm', pos: 'RF', num: 9, hand: 'L', pow: 8, con: 7, spd: 7, arm: 8, fld: 7, wpn: 'spiked', bat: 'pact', run: 'fleet', field: 'boulder', flav: 'The outfield freezes over where it stands. It prefers it that way.' };
ULT.whiteout = { kind: 'frostwyrm', role: 'field', name: 'Whiteout', desc: 'Brings the snow. Every runner runs 25% slower and swings come stiff.', zone: { shape: 'global', rSpd: .75, swing: .88, vis: 'snow' } };
AB.whiteout = { name: '★ ' + ULT.whiteout.name, type: 'ult', role: ULT.whiteout.role, cost: ULT_COST, ult: true, desc: ULT.whiteout.desc };
ULT_BY_KIND.frostwyrm = 'whiteout';
MOON_KIND.frostwyrm = [6, ['arm', 'pow']];
