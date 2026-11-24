/* The Curling Shed: the ice (issue #102, phase 1). The sheet's ice is pebbled: Brush Hennock sprays it with water drops
   every morning, and the stones ride on the pebble. Where stones and brooms go the pebble wears flatter, so the ice there
   gets keener: a stone slides further on it and curls a little less. The Shed's cold also changes the whole sheet:
   a warm day off the sea (heavy: frost on the pebble, the stones drag), a cold night (keen), or as Hennock likes it.

   The grid (CR_ICE): cols across the sheet by rows along it, from the near hog line to the back line, each cell its
   pebble (1 fresh, down to CR_ICE.min worn). crIceAt(ice, x, y) is the friction there (1 for fresh pebble on a mid
   day): the cell's pebble times the cold's. crWear(ice, path) wears the cells a stone crossed (path [[x, y, swept]]: more where it
   was swept). The grid is plain numbers, so a game's ice is saved with it. */
const CR_ICE = { cols: 12, rows: 34, y0: -1140, y1: 84, wear: .0012, sweptWear: .003, min: .965, curlWorn: .5 };
const CR_COLD = { heavy: { mu: 1.08, n: 'heavy', say: 'A warm day off the sea: frost on the pebble, and the stones drag.' },
  mid: { mu: 1, n: 'as Hennock likes it', say: '' },
  keen: { mu: .94, n: 'keen', say: 'A hard frost last night: the ice is keen, and the stones run.' } };
function crIceNew() { return Array(CR_ICE.cols * CR_ICE.rows).fill(1); }
const crIceCell = (x, y) => { const C = CR_ICE, c = clamp(Math.floor((x + CR_SHEET.halfW) / (2 * CR_SHEET.halfW) * C.cols), 0, C.cols - 1), r = clamp(Math.floor((y - C.y0) / (C.y1 - C.y0) * C.rows), 0, C.rows - 1); return r * C.cols + c; };
// the friction at (x, y): the pebble there and the day's cold
// (and the frost along the boards, late in a game with the Shed's ways: crFrostAt, 12-shed.js; and the keen ice over
// Old Grey, in a game with the frozen deep: crDeepMu, 16-deep.js)
function crIceAt(ice, x, y, cold) { return (ice ? ice[crIceCell(x, y)] : 1) * ((CR_COLD[cold] || CR_COLD.mid).mu) * (1 + crFrostAt(x)) * crDeepMu(x, y); }
// how worn the pebble is there, 0 (fresh) to 1 (as worn as it gets): worn pebble curls a little less
const crWornAt = (ice, x, y) => ice ? (1 - ice[crIceCell(x, y)]) / (1 - CR_ICE.min) : 0;
// a stone went down the sheet: path [[x, y, swept 0..1]]; each cell it crossed once
function crWear(ice, path) {
  const seen = new Set(), C = CR_ICE;
  for (const [x, y, sw] of path) { const i = crIceCell(x, y); if (seen.has(i)) continue; seen.add(i); ice[i] = Math.max(C.min, +(ice[i] - C.wear - C.sweptWear * (sw || 0)).toFixed(4)); }
  return ice;
}
