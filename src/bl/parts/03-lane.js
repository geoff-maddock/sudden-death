/* The Saltmere Lanes: the lane and its oil (issue #100, phase 1). Plain data and pure functions.

   Units are inches. x runs across the lane, 0 the middle and plus to the left as the bowler sees it (so the boards,
   counted from the right as a right-hander does, run from board 1 at the right edge to board 39 at the left); y runs
   down the lane from the foul line (0) to the headpin (720, sixty feet). The arrows are at 15 feet.
   The pins stand 12 inches apart in rows 10.39 inches deep: the 2, 4 and 7 on the left, the 3, 6 and 10 on the right.

   The oil is a grid of cells, one a board across and a foot down (39 by 60), each holding how much oil is on it. A
   fresh house pattern is 40 feet long, heavier in the middle boards than on the outside, so a ball that misses
   outside finds friction and hooks back (the house shot's "wall"), and the last 20 feet are dry. Every ball moves oil
   (blWear): it picks some up from the boards it skids over, and carries a little of that down past the pattern. So
   the track dries and the backend gets slicker as a game goes on: the transition both sides bowl on.
   The tide is under the floor: at high tide the lanes sweat and the oil plays heavier, at low tide drier
   (BL_TIDE, read by blMu). */
const BL_LANE = { w: 41.5, len: 720, boards: 39, arrows: 180, ballR: 4.25, pinR: 2.383, gutter: 9.25, row: 10.392, gap: 12, ft: 60, oilFt: 40 };
BL_LANE.bw = BL_LANE.w / BL_LANE.boards;
BL_LANE.edge = BL_LANE.w / 2;
// the kickbacks (the deck's side walls) and the pit behind the back row
BL_LANE.kick = BL_LANE.edge + BL_LANE.gutter;
BL_LANE.pit = BL_LANE.len + 3 * BL_LANE.row + 14;
// each pin's spot, by number
const BL_SPOT = (() => { const L = BL_LANE, g = L.gap / 2, r = L.row, y = L.len;
  return { 1: [0, y], 2: [g, y + r], 3: [-g, y + r], 4: [2 * g, y + 2 * r], 5: [0, y + 2 * r], 6: [-2 * g, y + 2 * r],
    7: [3 * g, y + 3 * r], 8: [g, y + 3 * r], 9: [-g, y + 3 * r], 10: [-3 * g, y + 3 * r] }; })();
// friction: on oil, on a dry board; the tide's weight on the oil; how much of a cell's oil a ball takes, and carries on
const BL_OIL = { muOil: .045, muDry: .2, full: 1, take: .022, carry: .35, width: 2 };
const BL_TIDE = { high: 1.18, mid: 1, low: .84 };

// a board (1 to 39) and its middle's x, and back
const blBoardX = b => (b - 20) * BL_LANE.bw;
const blXBoard = x => x / BL_LANE.bw + 20;
// the fresh house pattern: [board index 0..38][foot 0..59], flattened row by row (index b * 60 + f)
function blHouse(len) {
  const L = BL_LANE, n = len || L.oilFt, out = new Array(L.boards * L.ft).fill(0);
  for (let b = 0; b < L.boards; b++) {
    const fromEdge = Math.min(b, L.boards - 1 - b);   // 0 at either edge, 19 in the middle
    const across = fromEdge >= 9 ? 1 : .32 + .68 * fromEdge / 9;
    for (let f = 0; f < n; f++) out[b * L.ft + f] = +(across * (1.1 - .25 * f / n)).toFixed(3);
  }
  return out;
}
// the oil at a point (0 off the lane)
function blOilAt(oil, x, y) {
  const L = BL_LANE, b = Math.round(blXBoard(x)), f = Math.floor(y / 12);
  if (b < 1 || b > L.boards || f < 0 || f >= L.ft) return 0;
  return oil[(b - 1) * L.ft + f];
}
// friction at a point: dry boards grip, oiled ones slide; the tide weighs the oil
function blMu(oil, x, y, tide) {
  const o = blOilAt(oil, x, y) * (BL_TIDE[tide] || 1), k = Math.min(1, o / BL_OIL.full);
  return BL_OIL.muDry - (BL_OIL.muDry - BL_OIL.muOil) * Math.pow(k, .7);
}
// a ball's path moves oil: it picks some up from the cells it skids over (and the board each side), and lays a
// share of that down on the dry cells past the pattern on the same boards. Returns a new grid
function blWear(oil, path) {
  const L = BL_LANE, out = oil.slice(), w = BL_OIL.width;
  let carried = 0;
  for (const [x, y] of path) {
    const b = Math.round(blXBoard(x)), f = Math.floor(y / 12);
    if (f < 0 || f >= L.ft) continue;
    for (let d = -w; d <= w; d++) {
      const bb = b + d; if (bb < 1 || bb > L.boards) continue;
      const i = (bb - 1) * L.ft + f, share = d ? .5 / w : 1, o = out[i];
      if (o > .02) { const t = o * BL_OIL.take * share; out[i] = o - t; carried += t; }
      else if (carried > 0 && f >= L.oilFt) { const lay = carried * BL_OIL.carry * share * .08; out[i] = o + lay; carried -= lay; }
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.round(out[i] * 1000) / 1000;
  return out;
}
