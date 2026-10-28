/* w22: bigger cities (issue #6, phase 3). Loads after w21b-gmatch.js; changes earlier parts only by reassignment
   (saved originals carry the wW22 prefix).

   The five cities are rebuilt at about twice the area, each with its own districts rather than a street cross:

     Graftonbury  50×34 (was 36×24)  the market square and fountain, the League row, the park, terraced homes, the
                                     training ground and the allotments
     Mossgate     42×31 (was 30×22)  the shrine garden, the arena lane, homes in the trunks, the apiary and the orchard
     Saltmere     46×34 (was 32×24)  the quay and the fish market, two piers over open water, the warehouse and the
                                     lighthouse by the bowling hall's road
     Cinderhold   42×34 (was 30×24)  two basalt banks over the lava, three crossings, the forges, slag heaps, homes on
                                     both banks, the hot spring and a kick-about pitch
     Rimewatch    40×31 (was 28×22)  the abbey close, the frozen pond, the sled run, the watchtower and the homes

   Every building, person, sign and piece of furniture the old towns had is still there (the same counters, the same
   words), and every one can be reached. The homes are new, and you can walk into them. New decor tiles, drawn in ink
   (w4-ink.js style): hedge '1', fence '2', flower bed '3', bench '4', crates '5', vegetable patch '7', goalposts '8',
   slag heap '9', fish rack '0'.

   Old saves. A save made inside one of the old towns may stand on a tile that is now a wall: Continue moves you to
   the nearest open tile, and the townsfolk's saved places (WG.npc) are dropped once, so they start from the new
   layout. WG.cities is the layout version.

   W_CITY_VER, W_CITY_OLD (the old sizes, for the test), W_CITIES (the new defs, which replace DB.towns entries)
   Wrapped: wStart (wW22Start: the old-save move), renderHelp (wW22RenderHelp: #wHelpCities). */

const W_CITY_VER = 1;
const W_CITY_OLD = { graftonbury: [36, 24], mossgate: [30, 22], saltmere: [32, 24], cinderhold: [30, 24], rimewatch: [28, 22] };

/* ---------- the new decor tiles ---------- */
Object.assign(DB.tiles, {
  '1': { name: 'hedge', walk: 0, look: 'A clipped hedge, thick enough to lose a ball in. Several balls, by the look of it.' },
  '2': { name: 'fence', walk: 0, look: 'A post-and-rail fence, painted once, a long time ago.' },
  '3': { name: 'flower bed', walk: 0, look: 'A flower bed. Somebody has planted it in the League\'s colours, and the bees approve.' },
  '4': { name: 'bench', walk: 0, look: 'A bench with a brass plate: IN MEMORY OF A VERY LOUD FAN.' },
  '5': { name: 'crates', walk: 0, look: 'Crates and barrels, stencilled with the names of towns.' },
  '7': { name: 'vegetable patch', walk: 0, look: 'Rows of cabbages and leeks, and a scarecrow in an old jersey.' },
  '8': { name: 'goalposts', walk: 0, look: 'Goalposts, a little crooked, with a net mended in three colours.' },
  '9': { name: 'slag heap', walk: 0, look: 'A heap of black slag from the forges, still warm.' },
  '0': { name: 'fish rack', walk: 0, look: 'Fish split and drying on a rack. The gulls are watching it, and so is the cat.' },
});

/* a home: a small building anyone can walk into, with a bed and a hearth */
const wHome = (x, y, door, furn) => ({ x, y, w: 5, h: door === 'n' ? 5 : 6, door: door || 's', furn: furn || [['B', 1, 1], ['h', 3, 1]] });

const W_CITIES = {
  graftonbury: { id: 'graftonbury', name: 'Graftonbury', ground: '.', w: 50, h: 34, trees: 34,
    streets: [[1, 11, 48, 11], [1, 16, 48, 16], [1, 27, 48, 27], [25, 0, 25, 33], [12, 11, 12, 27], [38, 11, 38, 27], [19, 12, 31, 20]],
    buildings: [
      { x: 2, y: 3, w: 7, h: 7, npc: 'clerk', sign: 'LEAGUE OFFICE. Licences, brackets, complaints.', furn: [['P', 1, 1, { text: 'The first champion, Ada Quill, holding the first ball at arm\'s length. The frame is nicer than the painting.' }], ['t', 5, 1, { text: 'A row of small silver cups: every regional winner for twenty years. Three of them say VESPER.' }], ['K', 1, 3, { text: 'League Regulations, volumes one to nine. Volume four is missing and nobody will say why.' }]] },
      { x: 14, y: 3, w: 7, h: 7, npc: 'pell', counter: false, sign: 'WORKSHOP. Knock. Then wait.', furn: [['k', 1, 1], ['k', 2, 1], ['E', 5, 1], ['k', 5, 4], ['K', 1, 4, { text: 'Jars. Most are labelled. One is labelled DO NOT FEED and something inside is tapping.' }]] },
      { x: 29, y: 3, w: 7, h: 7, npc: 'tansy', counter: false, sign: 'CANTEEN. Todays special: whatever is left.', furn: [['h', 1, 1], ['h', 5, 1], ['q', 2, 3], ['q', 4, 3], ['P', 3, 1, { text: 'A still life of a Mossberry Stew, painted with what looks like actual stew.' }]] },
      { x: 40, y: 3, w: 8, h: 7, npc: 'quill', counter: false, sign: 'CHAPEL OF ATTUNEMENT', furn: [['l', 1, 1], ['l', 6, 1], ['P', 3, 1, { text: 'The Five Elements as a wheel: Ember eats Bloom, Bloom eats Tide, Tide eats Ember, and Aether and Rime circling outside, eating what they can.' }], ['z', 3, 3]] },
      { x: 2, y: 18, w: 9, h: 7, door: 'n', npc: 'hq_shop', sign: 'ODD LOTS. Salves, sundries, cards.', furn: [['K', 1, 4, { text: 'Second-hand balls, sorted by how many times they have been kicked.' }]] },
      { x: 40, y: 18, w: 9, h: 7, door: 'n', npc: 'hq_inn', sign: 'THE SPECKLED HEN. Beds.', furn: [['B', 1, 1], ['B', 7, 1], ['h', 1, 5], ['q', 4, 4], ['P', 4, 1, { text: 'The Speckled Hen herself, the inn\'s first mascot. She refereed a cup final once, badly, and nobody has forgotten.' }]] },
      wHome(14, 21, 's'), wHome(32, 21, 's'),
      wHome(14, 28, 'n'), wHome(19, 28, 'n'), wHome(27, 28, 'n'), wHome(32, 28, 'n')],
    npcs: [['rival', 22, 16], ['vesper', 28, 11], ['almond', 14, 17], ['tallow', 34, 15], ['rowe', 27, 22]],
    decor: [['F', 25, 14], ['W', 23, 13],
      ['m', 20, 13], ['m', 21, 13], ['m', 29, 13], ['m', 30, 13], ['m', 20, 19], ['m', 21, 19], ['m', 29, 19], ['m', 30, 19],
      ['l', 19, 12], ['l', 31, 12], ['l', 19, 20], ['l', 31, 20], ['l', 11, 15], ['l', 39, 15], ['4', 23, 18], ['4', 27, 18],
      ['3', 21, 8], ['3', 22, 8], ['3', 23, 8], ['3', 27, 8], ['3', 28, 8], ['x', 13, 15], ['x', 37, 15], ['x', 13, 17], ['x', 37, 17],
      // the park
      ['1', 39, 12], ['1', 40, 12], ['1', 41, 12], ['1', 42, 12], ['1', 44, 12], ['1', 45, 12], ['1', 46, 12], ['1', 47, 12], ['1', 48, 12],
      ['3', 40, 13], ['3', 47, 13], ['4', 41, 14], ['4', 46, 14],
      // the training ground and the allotments
      ['2', 1, 28], ['2', 2, 28], ['2', 3, 28], ['2', 4, 28], ['2', 5, 28], ['2', 7, 28], ['2', 8, 28], ['2', 9, 28], ['2', 10, 28], ['2', 11, 28],
      ['8', 2, 31], ['8', 10, 31], ['S', 7, 29, { text: 'TRAINING GROUND. Boots off the pitch after rain, by order of the League.' }],
      ['7', 40, 30], ['7', 41, 30], ['7', 42, 30], ['7', 44, 30], ['7', 45, 30], ['7', 46, 30], ['7', 40, 32], ['7', 41, 32], ['7', 42, 32], ['7', 44, 32], ['7', 45, 32], ['7', 46, 32],
      ['S', 26, 32, { text: 'GRAFTONBURY. Charter town of the League. Coliseum north. The Ballpark and the Charter Court are down the road from the gate. Cup towns at the four corners of the map.' }]],
    arrive: 'Graftonbury, the charter town. Every road in the realm starts here and most of the paperwork never leaves.',
    ambient: ['A clerk hurries past with a stack of bracket sheets.', 'The Charter Fountain gurgles. Somebody has put dye in it again.', 'A market crier: "Salves! Rations! Second-hand jerseys, one previous owner!"', 'Two coaches argue about Tide versus Ember, and neither of them has a team.', 'Somebody on the training ground shouts "Man on!" at nobody.', 'A gardener in the allotments holds up a marrow to be admired.'] },

  mossgate: { id: 'mossgate', name: 'Mossgate', ground: '.', tree: 'T', w: 42, h: 31, trees: 46, spawn: [10, 29],
    streets: [[1, 15, 40, 15], [10, 0, 10, 30], [30, 0, 30, 30], [10, 25, 30, 25], [10, 10, 30, 10]],
    buildings: [
      { x: 12, y: 1, w: 11, h: 8, npc: 'moss_reg', sign: 'MOSSWOLD ARENA', furn: [['W', 1, 4], ['l', 9, 1], ['P', 5, 1, { text: 'The arena in spring, the sand green with sprouting seed. It has to be raked every morning.' }], ['z', 5, 4]] },
      { x: 32, y: 2, w: 8, h: 6, npc: 'moss_shop', sign: 'GREEN GROCER', furn: [['K', 1, 1, { text: 'Jars of pickled mossberry, dated. The oldest is older than the League.' }]] },
      { x: 1, y: 17, w: 9, h: 7, door: 'n', npc: 'moss_inn', sign: 'THE HOLLOW LOG. Beds.', furn: [['B', 1, 1], ['B', 7, 1], ['h', 1, 5], ['q', 4, 4], ['P', 4, 1, { text: 'The log the inn is built in, before it was hollowed. A very large tree, and a very small man with an axe.' }]] },
      { x: 12, y: 17, w: 7, h: 6, door: 'n', npc: 'brack', counter: false, floor: '.', sign: 'APIARY. Move slowly.', furn: [['y', 1, 1], ['y', 3, 1], ['y', 5, 1], ['y', 1, 3], ['y', 5, 3]] },
      { x: 24, y: 17, w: 5, h: 7, door: 'n', npc: 'wenna', counter: false, sign: "WENNA'S. Forage bought.", furn: [['K', 1, 1, { text: 'Sixty years of dried bushes, labelled in a hand that gets shakier as it goes.' }], ['h', 1, 4]] },
      { x: 3, y: 2, w: 5, h: 6, door: 's', npc: 'fern', counter: false, sign: 'SHRINE OF THE GROVE', furn: [['$', 1, 1], ['P', 2, 1, { text: 'The Elder of the Grove coming down the road in spring, antlers full of birds, the whole town out with baskets.' }]] },
      wHome(12, 26, 'n'), wHome(18, 26, 'n'), wHome(24, 26, 'n')],
    npcs: [['moss_kid', 20, 12]],
    decor: [['l', 14, 9], ['l', 9, 14], ['l', 31, 14], ['l', 24, 24], ['$', 27, 8], ['$', 40, 13], ['y', 3, 12], ['y', 20, 19], ['y', 21, 21],
      ['Y', 38, 28, { elem: 'bloom', under: '.' }], ['Y', 3, 28, { elem: 'bloom', under: '.' }],
      // the shrine garden
      ['3', 2, 9], ['3', 3, 9], ['3', 7, 9], ['3', 8, 9], ['3', 2, 11], ['3', 8, 11], ['4', 7, 12],
      // the orchard
      ['T', 33, 18], ['T', 35, 18], ['T', 37, 18], ['T', 39, 18], ['T', 33, 21], ['T', 35, 21], ['T', 37, 21], ['T', 39, 21], ['T', 33, 24], ['T', 35, 24], ['T', 37, 24], ['T', 39, 24],
      ['2', 32, 27], ['2', 33, 27], ['2', 34, 27], ['2', 36, 27], ['2', 37, 27], ['2', 38, 27], ['2', 39, 27],
      ['S', 32, 16, { text: 'THE ORCHARD. Mossberries in season. Pick one, pay for one.' }],
      ['S', 1, 14, { text: 'MOSSGATE. The Links and the Tilting Lists are down the road from the gate.' }]],
    arrive: 'Mossgate. The houses are half timber and half tree, and it is hard to tell which half is winning.',
    ambient: ['Bees drone in the hives by the road.', 'A goblin kid is being scolded off a roof by a woman with a broom.', 'Sap drips from the arena beams onto the sand.', 'The totem by the east gate has fresh berries at its foot.', 'A mossberry drops in the orchard, and three children race for it.'] },

  saltmere: { id: 'saltmere', name: 'Saltmere', ground: ':', tree: 'T', w: 46, h: 34, trees: 6, spawn: [22, 25],
    streets: [[1, 15, 44, 15], [1, 26, 44, 26], [22, 0, 22, 26], [8, 15, 8, 26], [36, 0, 36, 26]],
    water: [[0, 29, 46, 5]],
    buildings: [
      { x: 2, y: 2, w: 12, h: 8, npc: 'salt_reg', sign: 'BRINEFEN ARENA', furn: [['W', 1, 4], ['l', 10, 1], ['v', 5, 4], ['P', 6, 1, { text: 'The arena at high tide, waist deep, the year they forgot to close the sluice. The match went ahead.' }]] },
      { x: 24, y: 3, w: 9, h: 6, npc: 'salt_shop', sign: 'CHANDLER', furn: [['K', 1, 1, { text: 'Rope by the fathom, salt by the sack, and one shelf of things washed up that nobody has claimed.' }]] },
      { x: 38, y: 2, w: 7, h: 9, counter: false, sign: 'WAREHOUSE. Salt, rope, tar. Mind the hook.', furn: [['5', 1, 1], ['5', 2, 1], ['5', 4, 1], ['5', 5, 1], ['5', 1, 3], ['5', 5, 3]] },
      { x: 10, y: 17, w: 9, h: 6, door: 'n', npc: 'salt_inn', sign: 'THE DRY SOCK. Beds.', furn: [['B', 1, 1], ['B', 7, 1], ['h', 1, 3], ['P', 4, 1, { text: 'A single sock, framed, and a plaque: THE ONLY ONE.' }]] },
      { x: 24, y: 17, w: 6, h: 5, door: 'n', npc: 'netter', counter: false, sign: 'NETS. Repairs.', furn: [['K', 1, 1, { text: 'Nets hung to dry. Every knot is a different knot.' }], ['q', 3, 2]] },
      { x: 39, y: 19, w: 5, h: 6, door: 'n', npc: 'anck', counter: false, sign: 'LIGHTHOUSE. Keep off the stairs.', furn: [['l', 3, 2], ['K', 1, 1, { text: 'Forty years of the light log, one line a night: LIT. LIT. LIT. Then nothing.' }], ['B', 3, 3]] },
      wHome(2, 18, 'n'), wHome(30, 17, 'n')],
    npcs: [['diver', 30, 13], ['marrowbone', 31, 27]],
    decor: [['l', 21, 14], ['l', 23, 14], ['l', 7, 14], ['l', 44, 14], ['l', 44, 16], ['v', 18, 12],
      // the fish market on the quay
      ['m', 10, 24], ['m', 12, 24], ['m', 14, 24], ['m', 16, 24], ['0', 18, 24], ['0', 19, 24], ['5', 24, 25], ['5', 25, 25], ['5', 34, 27], ['5', 35, 27], ['4', 20, 25], ['4', 27, 25],
      ...[38, 39, 40, 41, 42, 43, 44].map(x => ['2', x, 27]),
      // two piers over the water, and the boats
      ...[29, 30, 31, 32].flatMap(y => [['w', 10, y], ['w', 11, y], ['w', 32, y], ['w', 33, y]]), ['w', 10, 27], ['w', 11, 27], ['w', 10, 28], ['w', 11, 28], ['w', 32, 28], ['w', 33, 28],
      ['j', 12, 31], ['j', 31, 31], ['j', 9, 32], ['j', 34, 30],
      ['S', 44, 13, { text: 'SALTMERE. The Lanes and the Curling Shed are down the road from the gate. Follow the lamps.' }]],
    arrive: 'Saltmere. Everything is damp, everything is salted, and the arena floor drains toward the middle.',
    ambient: ['The ferry bell rings twice: nobody aboard.', 'A Brinepup sleeps in a coil of rope on the dock.', 'Gulls have learned to untie nets. Hob is furious.', 'The tide pool by the arena blinks at you.', 'A fishwife on the quay is shouting prices that go down as the day goes on.'] },

  cinderhold: { id: 'cinderhold', name: 'Cinderhold', ground: 'a', tree: 'R', w: 42, h: 34, trees: 14, spawn: [12, 32],
    streets: [[1, 16, 40, 16], [12, 0, 12, 33], [30, 0, 30, 33], [12, 6, 30, 6], [12, 27, 30, 27]],
    water: [[20, 0, 2, 34, 'L'], [3, 28, 5, 3, '~']],
    buildings: [
      { x: 1, y: 1, w: 11, h: 9, npc: 'cind_reg', sign: 'CINDERMAW ARENA', furn: [['W', 1, 4], ['u', 9, 1], ['P', 5, 1, { text: 'The arena floor the year the lava came up through it. Three matches were fought on the crust before anyone said anything.' }], ['z', 5, 5]] },
      { x: 31, y: 1, w: 10, h: 8, npc: 'cind_shop', sign: 'FURNACE STORES', furn: [['u', 1, 1], ['K', 8, 1, { text: 'Peppers by heat: mild, hot, cinder, slag, and one jar marked simply NO.' }]] },
      { x: 1, y: 18, w: 10, h: 7, door: 'n', npc: 'cind_inn', sign: 'THE BANKED FIRE. Beds.', furn: [['B', 1, 1], ['B', 8, 1], ['u', 1, 5], ['u', 8, 5], ['q', 4, 4], ['P', 4, 1, { text: 'A Cinderkit asleep on a hearth, painted from life by somebody very patient.' }]] },
      { x: 31, y: 18, w: 11, h: 7, door: 'n', npc: 'smith', counter: false, sign: 'BRANDT & SON. Shoes, plate, chain.', furn: [['A', 2, 2], ['u', 9, 1], ['u', 9, 4], ['K', 1, 1, { text: 'Slagback shoes in every size, and one Voltmite-sized set nobody has ever needed.' }]] },
      wHome(14, 8, 'n'), wHome(23, 8, 'n'), wHome(14, 20, 's'), wHome(23, 20, 's')],
    npcs: [['scout', 25, 15], ['grit', 14, 29], ['pyre', 4, 13]],
    decor: [['u', 11, 15], ['u', 13, 17], ['u', 29, 15], ['u', 31, 15], ['u', 19, 15], ['u', 22, 17],
      // the forges by the smithy
      ['A', 24, 18], ['A', 27, 18], ['u', 25, 18], ['u', 28, 18],
      // slag heaps
      ['9', 35, 11], ['9', 38, 12], ['9', 39, 10], ['9', 33, 13],
      // the hot spring and the kick-about pitch
      ['S', 8, 29, { text: 'HOT SPRING. Bathing at own risk. Teams welcome, after the match.' }], ['4', 4, 32],
      ['8', 23, 30], ['8', 29, 30],
      ['S', 13, 32, { text: 'CINDERHOLD. The Ash Bowl and the Anvil Ring are down the road from the gate.' }]],
    arrive: 'Cinderhold. The walls are black basalt, the braziers never go out, and the smith is already shouting.',
    ambient: ['The great anvil rings, once, and a Slagback somewhere answers.', 'Ash sifts down from nowhere in particular.', 'A miner walks past coughing glitter.', 'Heat shimmers over the arena sand.', 'The lava channel folds and sighs under the bridge.', 'Somebody is kicking a ball against the slag heap, and the slag heap is winning.'] },

  rimewatch: { id: 'rimewatch', name: 'Rimewatch', ground: 'n', tree: 'T', w: 40, h: 31, trees: 24, spawn: [20, 29],
    streets: [[1, 14, 38, 14], [20, 0, 20, 30], [10, 14, 10, 30], [33, 14, 33, 30], [10, 24, 33, 24]],
    water: [[22, 17, 9, 6, 'i'], [36, 16, 2, 12, 'i']],
    buildings: [
      { x: 1, y: 1, w: 12, h: 8, door: 's', npc: 'halvard', counter: false, sign: 'ABBEY OF THE LAST LAMP', furn: [['&', 5, 1], ['l', 1, 1], ['l', 10, 1], ['P', 8, 1, { text: 'The Matriarch over the abbey, green light streaming, the monks below with their hands over their ears. Or their eyes. The painter could not decide.' }], ['K', 1, 4, { text: 'Chant books, and a ledger of bell-feedings going back ninety years.' }], ['z', 5, 4]] },
      { x: 22, y: 1, w: 11, h: 8, npc: 'rime_reg', sign: 'FROSTSPIRE ARENA', furn: [['W', 1, 4], ['l', 9, 1], ['I', 5, 1], ['I', 6, 1]] },
      { x: 1, y: 16, w: 8, h: 6, door: 'n', npc: 'rime_shop', sign: 'COLD STORES', furn: [['I', 1, 1], ['I', 6, 1], ['K', 3, 1, { text: 'Frost mint by the bunch, and things in ice that Kettil says are for later.' }]] },
      { x: 12, y: 16, w: 8, h: 7, door: 'n', npc: 'rime_inn', sign: 'THE LAST LAMP. Beds.', furn: [['B', 1, 1], ['B', 6, 1], ['h', 1, 5], ['q', 3, 4], ['P', 3, 1, { text: 'The lamp itself, the last one before the snow, painted in the dark with the lamp for light.' }]] },
      { x: 34, y: 7, w: 5, h: 4, door: 's', npc: 'watcher', counter: false, sign: 'WATCH TOWER', furn: [['l', 1, 1]] },
      wHome(12, 25, 'n'), wHome(22, 25, 'n'), wHome(27, 25, 'n')],
    npcs: [['monk', 15, 12], ['ingrith', 9, 20]],
    decor: [['r', 2, 13], ['r', 38, 13], ['r', 2, 29], ['r', 38, 29], ['r', 21, 23], ['l', 19, 13], ['l', 21, 13], ['l', 9, 15], ['I', 34, 22],
      // the abbey close
      ['1', 1, 10], ['1', 2, 10], ['1', 3, 10], ['1', 4, 10], ['1', 5, 10], ['1', 9, 10], ['1', 10, 10], ['1', 11, 10], ['1', 12, 10], ['4', 4, 12], ['3', 2, 11], ['3', 11, 11],
      ['S', 21, 18, { text: 'THE POND. Thick enough, says Old Tove. Skates on, or stay on the bank.' }],
      ['S', 35, 15, { text: 'SLED RUN. One at a time, feet first, and shout.' }],
      ['S', 19, 29, { text: 'RIMEWATCH. The Pond Rink and the Hoarfrost Pitch are down the road from the gate.' }]],
    arrive: 'Rimewatch. The last town before the snow takes over, and it knows it.',
    ambient: ['The abbey bell tolls the hour, a little flat with cold.', 'A Frostlet is asleep on the arena sign, glazing it.', 'The lamps come on early here. They have to.', 'A cairn by the road has a new stone on it.', 'Children skate on the pond, badly.', 'Somebody comes down the sled run much faster than they meant to.'] },
};
for (const id in W_CITIES) {
  const i = DB.towns.findIndex(t => t.id === id);
  if (i >= 0) DB.towns[i] = W_CITIES[id]; else DB.towns.push(W_CITIES[id]);
}

/* ---------- old saves: off a wall, and the townsfolk start from the new layout ---------- */
function wNearestOpen(m, x, y) {
  if (wOpenTile(m, x, y)) return [x, y];
  const seen = bfsReach(m, m.spawn[0], m.spawn[1]);
  let best = null;
  for (let yy = 0; yy < m.h; yy++) for (let xx = 0; xx < m.w; xx++) {
    if (!seen[yy * m.w + xx] || !wOpenTile(m, xx, yy)) continue;
    const d = Math.abs(xx - x) + Math.abs(yy - y);
    if (!best || d < best[2]) best = [xx, yy, d];
  }
  return best ? [best[0], best[1]] : m.spawn.slice();
}
const wW22Start = wStart;
wStart = function (save, opts) {
  if (save && save.WG && (save.WG.cities || 0) < W_CITY_VER && save.WG.npc) for (const id in W_CITIES) delete save.WG.npc[id];
  const r = wW22Start(save, opts);
  if (WG) {
    const m = MAPS[WG.map];
    const old = (WG.cities || 0) < W_CITY_VER;
    if (old && m && m.kind === 'town') { const [x, y] = wNearestOpen(m, WG.x, WG.y); WG.x = x; WG.y = y; }
    WG.cities = W_CITY_VER;
    if (old && save) wSave();
  }
  return r;
};

/* ---------- drawing the new tiles ---------- */
Object.assign(WOBJ, {
  // a hedge joins the hedges beside it
  '1': (c, P, r, e) => {
    const L = e.at(-1, 0) === '1', R = e.at(1, 0) === '1', U = e.at(0, -1) === '1', D = e.at(0, 1) === '1';
    wShadow(c, 16, 29, 15, 3, .28);
    const x0 = L ? -1 : 3, x1 = R ? 33 : 29, y0 = U ? -2 : 7, y1 = D ? 33 : 28;
    const body = pRR(x0, y0, x1 - x0, y1 - y0, 6); wCel(c, body, '#3f7a3a', 1.4, 1.3, true);
    c.save(); c.clip(body); for (let i = 0; i < 9; i++) { const b = wBlob(4 + r() * 24, y0 + 3 + r() * (y1 - y0 - 6), 4, 3, r, 6); c.fillStyle = i % 2 ? '#4f8a44' : '#356a30'; c.fill(b); } c.restore();
    c.lineWidth = 1.3; c.strokeStyle = WINKC; c.beginPath();
    if (!U) { c.moveTo(x0, y0 + 3); c.quadraticCurveTo(16, y0 - 2, x1, y0 + 3); }
    if (!D) { c.moveTo(x0, y1); c.lineTo(x1, y1); }
    if (!L) { c.moveTo(x0, y0 + 3); c.lineTo(x0, y1); } if (!R) { c.moveTo(x1, y0 + 3); c.lineTo(x1, y1); }
    c.stroke();
  },
  // post and two rails, joined to the fence beside it
  '2': (c, P, r, e) => {
    const L = e.at(-1, 0) === '2', R = e.at(1, 0) === '2', wood = '#b08a5a';
    wShadow(c, 16, 28, 13, 2, .22);
    const x0 = L ? -1 : 6, x1 = R ? 33 : 26;
    for (const y of [14, 21]) wCel(c, pRR(x0, y, x1 - x0, 3, .6), wood, .6, 1.1);
    for (const x of [6, 24]) wCel(c, pRR(x, 8, 3.2, 20, .8), tint(wood, -.12), .7, 1.2);
  },
  // a raised bed of soil, full of flowers
  '3': (c, P, r) => {
    wShadow(c, 16, 28, 14, 2.5, .25);
    wCel(c, pRR(2, 16, 28, 12, 2), '#7a5a32', .8, 1.2);
    c.fillStyle = '#4a3220'; c.fillRect(4, 17, 24, 5);
    const cols = ['#e0457b', '#f2c14e', '#f4efe0', '#b38cf0', '#e0743a'];
    for (let i = 0; i < 7; i++) { const x = 5 + i * 3.6 + (r() - .5), y = 13 + r() * 5; wLine(c, [[x, y + 4], [x, y + 8]], .9, '#3f7a3a'); wFlower(c, x, y, cols[(r() * cols.length) | 0]); }
  },
  '4': (c, P, r) => {
    wShadow(c, 16, 28, 13, 2.5, .28);
    for (const x of [5, 25]) wFlat(c, pRR(x, 19, 2.4, 9, .5), '#3a2c22', 1);
    wCel(c, pRR(2, 7, 28, 5, 1), '#9a6a36', .7, 1.2);
    wCel(c, pRR(2, 16, 28, 5, 1), '#a8784a', .7, 1.2);
    wFlat(c, pRR(14, 8.5, 4, 2, .4), '#d8b25a', .6);
  },
  '5': (c, P, r) => {
    wShadow(c, 16, 29, 14, 3, .3);
    const crate = (x, y, w, h, col) => { const p = pRR(x, y, w, h, .8); wCel(c, p, col, .8, 1.2); wLine(c, [[x + 1, y + 1], [x + w - 1, y + h - 1]], .8, 'rgba(29,20,15,.55)'); wLine(c, [[x + 1, y + h - 1], [x + w - 1, y + 1]], .8, 'rgba(29,20,15,.55)'); };
    crate(2, 16, 14, 13, '#b08a5a'); crate(5, 4, 11, 12, '#a07a4a');
    const bar = pRR(18, 12, 11, 17, 4); wCel(c, bar, '#8a5a32', 1, 1.2);
    for (const y of [15.5, 25.5]) wLine(c, [[18.5, y], [28.5, y]], 1.2, '#3a2c22');
  },
  '7': (c, P, r) => {
    c.fillStyle = '#5a3d26'; c.fillRect(1, 6, 30, 23); wStroke(c, pRR(1, 6, 30, 23, 2), 1);
    for (const y of [11, 19, 26]) { wLine(c, [[2, y + 2], [30, y + 2]], 1, 'rgba(20,12,8,.45)'); for (let x = 5; x < 30; x += 7) { const b = wBlob(x + (r() - .5), y, 3, 2.4, r, 6); wCel(c, b, y === 19 ? '#7ab85a' : '#4f8a3c', .6, .9); } }
  },
  // goalposts with a net behind
  '8': (c, P, r) => {
    wShadow(c, 16, 29, 14, 2, .22);
    c.save(); c.globalAlpha = .6; for (let x = 5; x <= 27; x += 3) wLine(c, [[x, 9], [x + 2, 27]], .6, '#f4efe0'); for (let y = 12; y <= 26; y += 3) wLine(c, [[4, y], [28, y + 1]], .6, '#f4efe0'); c.restore();
    for (const x of [3, 27]) wCel(c, pRR(x, 6, 2.6, 23, .6), '#f4efe0', .6, 1.2);
    wCel(c, pRR(3, 5, 26.6, 2.6, .6), '#f4efe0', .6, 1.2);
  },
  '9': (c, P, r) => {
    wShadow(c, 16, 29, 15, 3, .32);
    const heap = new Path2D(); heap.moveTo(1, 29); heap.quadraticCurveTo(6, 10, 15, 8); heap.quadraticCurveTo(26, 9, 31, 29); heap.closePath();
    wCel(c, heap, '#2e2a30', 1.4, 1.3);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 3 ? 'rgba(255,120,40,.65)' : 'rgba(255,200,90,.7)'; c.beginPath(); c.arc(6 + r() * 20, 15 + r() * 12, .9 + r() * .8, 0, 7); c.fill(); }
  },
  '0': (c, P, r) => {
    wShadow(c, 16, 29, 13, 2, .25);
    for (const x of [4, 27]) wFlat(c, pRR(x, 6, 2.4, 23, .5), '#7a5a32', 1);
    wLine(c, [[4, 8], [29, 8]], 1.6, '#5a3d22'); wLine(c, [[4, 17], [29, 17]], 1.6, '#5a3d22');
    for (const [y0, n] of [[8, 4], [17, 4]]) for (let i = 0; i < n; i++) {
      const x = 8 + i * 5.5, f = new Path2D(); f.moveTo(x, y0); f.quadraticCurveTo(x + 3, y0 + 4, x + 1, y0 + 8); f.lineTo(x - 1, y0 + 8); f.quadraticCurveTo(x - 3, y0 + 4, x, y0); f.closePath();
      wFlat(c, f, i % 2 ? '#c8b89a' : '#d8c8a8', .8);
    }
  },
});

/* ---------- How to play ---------- */
const wW22RenderHelp = renderHelp;
renderHelp = function () {
  wW22RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpCities')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpCities"><b>The cities.</b> Each of the five cities has its own districts: Graftonbury's market square and park, Mossgate's shrine garden and orchard, Saltmere's quay and piers, Cinderhold's two banks over the lava, Rimewatch's abbey close and frozen pond. The homes are open: walk in. Every city has a sign by its gate pointing to its two sports grounds.</p>`);
};
