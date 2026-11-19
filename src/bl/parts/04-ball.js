/* The Saltmere Lanes: the ball on the lane (issue #100, phase 1). A pure model, shared by Play, the CPU and the sim.

   A throw is where the ball leaves the hand (x0, at the foul line), its angle (degrees; plus to the left), its speed
   (mph), its revs (rpm), the ball (strike: reactive, it hooks; spare: plastic, it barely does) and the bowler's hand
   (1 right, -1 left). Down the lane the ball goes through three phases:
   - skid: through the oil, where there is little friction, so it barely turns;
   - hook: once it finds friction its side spin bites, and it turns toward the pocket (a right-hander's ball to the
     left), the more so the more revs it has and the slower it goes;
   - roll: when the side spin is used up it rolls straight on, wherever it is pointing.
   The model steps down the lane an inch or three at a time: the friction under the ball (blMu) turns its line by its
   spin, and wears the spin down. It gives the path, where the ball meets the pins and at what angle (the entry
   angle: 4 to 6 degrees carries best), and where it skidded, hooked and rolled. A ball whose middle leaves the lane
   before the pins is in the gutter.
   Everything is worked in the bowler's hand: a left-hander's throw is a right-hander's mirrored, reading the oil on
   the mirrored boards (so the left side of the lane, fresh, is theirs). */
const BL_BALL = { step: 3, hook: .004, decay: .012, mu0: .043, rollAt: .045, spareSpin: .08, v0: 17, rpm0: 350, drag: .012 };
const BL_MPH = 17.6;   // inches a second in a mile an hour

// the path of a throw: { path: [[x, y]] every foot, x, m (dx/dy at the pins), entry (degrees, toward the pocket for
// the hand), v (inches a second), spin (side spin left, 0 to 1), gutter (the y it went in, or null), skid, roll
// (where the hook began and ended, or null) }
function blBall(t, oil, tide) {
  const L = BL_LANE, B = BL_BALL, h = t.hand === -1 ? -1 : 1;
  let x = h * t.x0, m = Math.tan(h * (t.ang || 0) * Math.PI / 180), y = 0;
  const m0 = m;
  let v = (t.mph || B.v0) * BL_MPH;
  let S = ((t.rpm || B.rpm0) / B.rpm0) * (t.ball === 'spare' ? B.spareSpin : 1);
  const path = [[h * x, 0]]; let gutter = null, skid = null, roll = null, nextRec = 12;
  while (y < L.len) {
    const dy = Math.min(B.step, L.len - y), mu = blMu(oil, h * x, y, tide);
    if (S > B.rollAt) {
      const turn = B.hook * Math.max(0, mu - B.mu0) * S * dy * Math.pow(B.v0 * BL_MPH / v, 2);
      m += turn;
      // the skid ends where the ball has turned half a degree
      if (skid === null && m - m0 > .009) skid = y; S -= B.decay * mu * S * dy;
      if (S <= B.rollAt && roll === null) roll = y;
    }
    v = Math.max(8 * BL_MPH, v - B.drag * mu * v * dy / 12);
    x += m * dy; y += dy;
    if (Math.abs(x) > L.edge) { gutter = y; break; }
    if (y >= nextRec || y >= L.len) { path.push([+(h * x).toFixed(2), +y.toFixed(1)]); nextRec += 12; }
  }
  return { path, x: +(h * x).toFixed(3), m: h * m, entry: +(Math.atan(m) * 180 / Math.PI).toFixed(2), v, spin: Math.max(0, S), gutter, skid, roll, hand: h };
}
// the throw that sends a ball from x0 to the target x at the pins (tx), by its angle: the angle found by bisection
// (a bigger angle always ends further left). null if no angle in reach does it
function blAimAt(t, tx, oil, tide) {
  let lo = -6, hi = 6;
  const at = a => { const r = blBall(Object.assign({}, t, { ang: a }), oil, tide); return r.gutter !== null ? (r.path[r.path.length - 1][0] > 0 ? 99 : -99) : r.x; };
  if (at(lo) > tx || at(hi) < tx) return null;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (at(mid) < tx) lo = mid; else hi = mid; }
  // a ball that either gutters or hooks past the target has no angle that gets there: the bisection lands on the jump
  const a = +((lo + hi) / 2).toFixed(4);
  return Math.abs(at(a) - tx) < 1 ? a : null;
}
