/* Cinder Gridiron: the rules (issue #9, phase 0). Plain data and pure functions, no page: who has the ball, where it
   is, the down, the yards to go and the score. Seven a side; the field, the plays and the clock come later.
   The ball is in yards from the offense's own goal line: 0 to 100. Reaching 100 is a touchdown; going back past 0 is
   a safety. Four downs to make the line to gain, ten yards on (or the goal line, if that is nearer): make it and it
   is first down again; miss on fourth down and the other side takes over where the ball is.
   G is the game, plain JSON (so a snapshot can be saved): { poss, ball, down, togo, score, plays }. */
const GF_RULES = { field: 100, chain: 10, downs: 4, side: 7, td: 6, safety: 2, start: 25 };
let G = null;

function gfNewGame(opts) {
  const o = opts || {};
  G = { poss: o.poss || 0, ball: GF_RULES.start, down: 1, togo: GF_RULES.chain, score: [0, 0], plays: 0 };
  return G;
}
// first and ten from where the ball is (first and goal inside the ten)
function gfFirstDown() { G.down = 1; G.togo = Math.min(GF_RULES.chain, GF_RULES.field - G.ball); }
// the other side has the ball, ball yards from its own goal line
function gfGive(ball) { G.poss = 1 - G.poss; G.ball = ball; gfFirstDown(); }
/* a play gained (or lost) yards: move the ball, then the score, the down and the chains.
   Returns what happened: 'td', 'safety', 'first', 'down' (the next down) or 'turnover' (on downs). */
function gfSpot(gain) {
  G.plays++; G.ball += gain;
  if (G.ball >= GF_RULES.field) { G.score[G.poss] += GF_RULES.td; gfGive(GF_RULES.start); return 'td'; }
  if (G.ball <= 0) { G.score[1 - G.poss] += GF_RULES.safety; gfGive(GF_RULES.start); return 'safety'; }
  if (gain >= G.togo) { gfFirstDown(); return 'first'; }
  if (G.down >= GF_RULES.downs) { gfGive(GF_RULES.field - G.ball); return 'turnover'; }
  G.down++; G.togo -= gain;
  return 'down';
}
