/* The Curling Shed: the Shed's own ways (issue #102, phase 5). A game started with { hall: true } (the Realm's games are)
   has them; the bare engine, its tests and the labs don't, unless asked.
   - The frost: Brush Hennock keeps the cold in, but the frost creeps in from the windows as a game goes on, and lies
     along the boards. Each end it is a little thicker (G.frost), and a stone near the boards drags on it (crFrostAt):
     the edges play heavier than the middle late in a game.
   - The frost sprites: now and then, after a stone comes to rest, a frost sprite breathes on a stone in play and it
     creeps an inch or two (crShedAfter), seeded like everything else; a stone it would push out of play it leaves be.
   - Hennock's pebble: at the half (after the middle end) Hennock pebbles the sheet again, and the worn ice is half
     fresh once more (crShedEnd).
   What happens is said (G.hallSaid, for the page's status line) and kept plain. */
const CR_HALL = { frostPer: .012, edge: 30, sprite: .035, nudge: [1, 3], pebble: .5 };
function crShedStart(o) { G.hall = !!(o && o.hall); G.frost = 0; G.hallSaid = ''; }
// the frost's drag at x (0 in the middle, G.frost along the boards)
function crFrostAt(x) { if (!G || !G.hall || !G.frost) return 0; const d = CR_SHEET.halfW - Math.abs(x); return d < CR_HALL.edge ? G.frost * (1 - d / CR_HALL.edge) : 0; }
// after a stone comes to rest: a frost sprite, now and then
function crShedAfter() {
  if (!G.hall || !G.stones.length || R() >= CR_HALL.sprite) return '';
  const st = G.stones[Math.floor(R() * G.stones.length)], a = R() * Math.PI * 2, d = CR_HALL.nudge[0] + R() * (CR_HALL.nudge[1] - CR_HALL.nudge[0]);
  const moved = { x: +(st.x + Math.cos(a) * d).toFixed(2), y: +(st.y + Math.sin(a) * d).toFixed(2) };
  // (it won't push a stone off the sheet, or into another, or into or out of the house or the free guard zone)
  if (!crOnSheet(moved) || crInFgz(moved) !== crInFgz(st) || crInHouse(moved) !== crInHouse(st) || G.stones.some(o => o !== st && Math.hypot(o.x - moved.x, o.y - moved.y) < 2 * CR_SHEET.stoneR)) return '';
  st.x = moved.x; st.y = moved.y;
  return `A frost sprite breathes on ${G.teams[st.s].short || G.teams[st.s].name}'s stone, and it creeps ${d.toFixed(1)} inches.`;
}
// an end done: the frost thickens, and at the half Hennock pebbles the sheet again
function crShedEnd(endNo) {
  if (!G.hall) return '';
  G.frost = +(G.frost + CR_HALL.frostPer).toFixed(4);
  if (endNo === Math.floor(G.ends / 2)) { G.ice = G.ice.map(v => +(1 - (1 - v) * (1 - CR_HALL.pebble)).toFixed(4)); if (G.iceEnd) G.iceEnd = G.ice.slice(); return 'At the half Brush Hennock pebbles the sheet again: the worn ice is half fresh.'; }
  return G.frost >= .03 ? 'The frost creeps further in from the windows: the ice along the boards plays heavy.' : '';
}
