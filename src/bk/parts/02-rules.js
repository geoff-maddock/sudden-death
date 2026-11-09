/* The Charter Court: the rules (issue #77, phases 0 and 1). Plain data and pure functions, no page: the score, the
   quarters and the game clock, the shot clock, fouls and free throws, and which basket each side attacks.
   Five a side. A game is BK_RULES.mins minutes (5 by default; the Realm's settings offer 3, 5, 8 or 12), four quarters
   of a quarter of that each. The shot clock is BK_RULES.shot seconds whatever the length: running out turns the ball
   over, and a shot that hits the rim resets it. A basket is 2, or 3 from beyond the arc (BK_RULES.arc metres from the
   rim, or from BK_RULES.corner metres out from the middle in the corners, where the line runs straight); a free throw is 1.
   Fouls: a shooting foul gives two free throws, three on a three-point try, and one (the and-one) if the shot went in
   anyway. Past BK_RULES.limit team fouls in a quarter (the bonus), every foul gives two. Five personal fouls and a
   player is out of the game (a substitute comes in); with nobody left to come in they stay on, but every further foul
   they commit gives one free throw more.
   Level after the fourth quarter, an overtime of BK_RULES.ot seconds, and another, up to BK_RULES.ots; still level
   after those, the game is a tie.
   G is the game, plain JSON (so a snapshot can be saved): { mins, qlen, q, clock, shot, poss, score, tf, pf, arrow,
   over }. pf: personal fouls by side, by roster index. 07-game.js adds the teams and the rest. */
const BK_RULES = { side: 5, bench: 5, mins: 5, minsAt: [3, 5, 8, 12], quarters: 4, shot: 14, arc: 6.75, corner: 6.6, two: 2, three: 3, ft: 1,
  limit: 4, out: 5, ot: 30, ots: 3, len: 28, wid: 15, rim: 1.575 };
let G = null;

function bkNewGame(opts) {
  const o = opts || {}, mins = BK_RULES.minsAt.includes(o.mins) ? o.mins : BK_RULES.mins, qlen = mins * 60 / BK_RULES.quarters;
  G = { mins, qlen, q: 1, clock: qlen, shot: BK_RULES.shot, poss: o.poss || 0, score: [0, 0], tf: [0, 0], pf: [{}, {}], arrow: 1 - (o.poss || 0), over: null };
  return G;
}
// a basket from d metres out (from the rim), y across from the middle, is worth this
const bkShotValue = (d, y) => d >= BK_RULES.arc || Math.abs(y || 0) >= BK_RULES.corner ? BK_RULES.three : BK_RULES.two;
function bkScore(side, pts) { G.score[side] += pts; return G.score[side]; }
// the shot clock: full again (a new possession, or a shot off the rim)
function bkShotReset() { G.shot = BK_RULES.shot; }
// side has the ball now, on a full shot clock
function bkGive(side) { G.poss = side; bkShotReset(); }
/* the clocks run dt seconds: 'shot' when the shot clock runs out (the ball goes over, bkViolation), 'end' when the
   period's clock does, '' otherwise. The shot clock holds while a shot is in the air or the ball is loose (hold),
   and is off when the period has less time left than it: no violation. */
function bkRun(dt, hold) {
  if (G.over) return '';
  G.clock = Math.max(0, G.clock - dt);
  const off = hold || G.clock < G.shot;
  if (!off) G.shot = Math.max(0, G.shot - dt);
  if (G.clock <= 0) return 'end';
  if (!off && G.shot <= 0) return 'shot';
  return '';
}
function bkViolation() { bkGive(1 - G.poss); }
/* a foul by side's player ri. o: { shooting, made (the shot went in anyway), three (it was a three-point try),
   benchLeft (players who could come in for them) }. Returns { shots (free throws for the other side), bonus, out (they
   fouled out just now and must come off), extra (they stay on past the limit and gave one more), pf, tf }. */
function bkFoul(side, ri, o) {
  const f = o || {}, pf = G.pf[side];
  pf[ri] = (pf[ri] || 0) + 1; G.tf[side]++;
  const bonus = G.tf[side] > BK_RULES.limit, over = pf[ri] > BK_RULES.out, stays = over && !f.benchLeft;
  let shots = f.shooting ? (f.made ? 1 : f.three ? 3 : 2) : bonus ? 2 : 0;
  if (stays) shots++;
  return { shots, bonus, out: pf[ri] === BK_RULES.out && !!f.benchLeft, extra: stays, pf: pf[ri], tf: G.tf[side] };
}
// side's player ri has fouled out (and isn't still on because nobody could come in)
const bkFouledOut = (side, ri) => (G.pf[side][ri] || 0) >= BK_RULES.out;
/* the period is over: the next quarter (team fouls start again), halftime after the second, overtime after the fourth
   when level, or the end. Returns 'quarter', 'half', 'ot' or 'over'. The ball after a break goes by the arrow, which
   swaps each time (the side that lost the opening tip has it first). */
function bkPeriodEnd() {
  if (G.over) return 'over';
  const last = BK_RULES.quarters + BK_RULES.ots;
  if (G.q >= BK_RULES.quarters && (G.score[0] !== G.score[1] || G.q >= last)) {
    G.over = { win: G.score[0] === G.score[1] ? null : G.score[0] > G.score[1] ? 0 : 1, score: G.score.slice(), ot: Math.max(0, G.q - BK_RULES.quarters) };
    return 'over';
  }
  G.q++; G.tf = [0, 0]; G.clock = G.q > BK_RULES.quarters ? BK_RULES.ot : G.qlen;
  bkGive(G.arrow); G.arrow = 1 - G.arrow;
  return G.q > BK_RULES.quarters ? 'ot' : G.q === 3 ? 'half' : 'quarter';
}
// the basket side attacks: +1 the right-hand one, -1 the left; the sides swap ends at halftime
const bkDir = side => (G.q <= 2) === (side === 0) ? 1 : -1;
// where that basket is, in court metres (x along, from the left baseline; y across, from the middle)
const bkHoopX = side => bkDir(side) > 0 ? BK_RULES.len - BK_RULES.rim : BK_RULES.rim;
const bkPeriodName = q => q <= BK_RULES.quarters ? ['', '1st', '2nd', '3rd', '4th'][q] : q === BK_RULES.quarters + 1 ? 'OT' : `${q - BK_RULES.quarters}OT`;
