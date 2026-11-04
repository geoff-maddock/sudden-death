/* The Anvil Ring: the rules (issue #23, phase 0). Plain data and pure functions, no page: the rounds, the knockdowns,
   the judges' cards and the decision, and how a card of bouts is settled.
   A bout is BX_RULES.rounds rounds of BX_RULES.secs seconds. A fighter knocked down BX_RULES.kd times in a bout is
   stopped (a TKO), and one who fails to beat the count is knocked out (a KO). Otherwise three judges score every round
   on the ten-point must: the round's winner gets 10 and the loser 9 (10-10 when it is even). A knockdown decides the
   round: the fighter who went down (more often) loses it, by a point for each knockdown more, whoever was winning it
   (so one knockdown is 10-9, two 10-8; not the pro rule's 10-8 for one, which over three rounds levels too many cards). After the last round each judge adds up
   their card. Two judges or three for one fighter wins it (unanimous, split or majority); anything else is a draw.
   A match is a card of BX_RULES.card bouts (question 1). The side that wins more bouts wins; level on bouts, the side
   with more knockdowns scored wins, then the side with more points on the judges' cards; then it is a draw.
   G is the bout, plain JSON (so a snapshot can be saved): { round, rounds, clock, kd, rkd, cards, over }. */
const BX_RULES = { rounds: 3, secs: 40, kd: 3, count: 10, judges: 3, card: 3, must: 10, patches: 2 };
let G = null;

function bxNewBout(opts) {
  const o = opts || {};
  G = { round: 1, rounds: o.rounds || BX_RULES.rounds, clock: BX_RULES.secs, kd: [0, 0], rkd: [0, 0], cards: [], over: null };
  return G;
}
/* side went down. Returns 'kd', or 'tko' when it is the knockdown that stops the bout */
function bxKnockdown(side) {
  if (G.over) return null;
  G.kd[side]++; G.rkd[side]++;
  if (G.kd[side] >= BX_RULES.kd) { bxEnd({ how: 'tko', win: 1 - side }); return 'tko'; }
  return 'kd';
}
// side didn't beat the count
function bxCountOut(side) { if (!G.over) bxEnd({ how: 'ko', win: 1 - side }); return 'ko'; }
/* one round on the judges' cards. work: each judge's view of the round, side 0's work less side 1's (a number). A gap
   under BX_TIE is even. Returns the round's [[s0, s1], ...] by judge, and starts the next round's knockdown count. */
const BX_TIE = .15;
function bxRoundScore(work, rkd) {
  const k = rkd || G.rkd;
  return work.map(d => {
    const even = Math.abs(d) < BX_TIE, gap = k[0] - k[1];
    if (!gap) return even ? [10, 10] : d > 0 ? [10, 9] : [9, 10];
    const s = [10, 10];
    s[gap > 0 ? 0 : 1] = Math.max(6, BX_RULES.must - Math.abs(gap));
    return s;
  });
}
/* the bell at the end of a round: score it (work as above), then the next round, or the decision after the last.
   Returns 'round' or 'over'. */
function bxBell(work) {
  if (G.over) return 'over';
  G.cards.push(bxRoundScore(work)); G.rkd = [0, 0];
  if (G.round >= G.rounds) { bxEnd(bxDecision()); return 'over'; }
  G.round++; G.clock = BX_RULES.secs;
  return 'round';
}
// each judge's totals so far: [[t0, t1], ...]
function bxTotals(cards) {
  const C = cards || G.cards, n = C.length ? C[0].length : BX_RULES.judges;
  return Array.from({ length: n }, (_, j) => C.reduce((t, r) => [t[0] + r[j][0], t[1] + r[j][1]], [0, 0]));
}
/* the decision from the cards: { how: 'dec', win: 0 | 1 | null, kind: 'unanimous' | 'split' | 'majority' | 'draw' } */
function bxDecision(cards) {
  const T = bxTotals(cards), v = [0, 0]; let even = 0;
  for (const [a, b] of T) { if (a > b) v[0]++; else if (b > a) v[1]++; else even++; }
  const w = v[0] >= 2 ? 0 : v[1] >= 2 ? 1 : null;
  if (w == null) return { how: 'dec', win: null, kind: 'draw' };
  return { how: 'dec', win: w, kind: v[w] === T.length ? 'unanimous' : v[1 - w] ? 'split' : 'majority' };
}
function bxEnd(r) {
  const T = bxTotals();
  G.over = Object.assign({ round: G.round, kd: G.kd.slice(), pts: T.reduce((p, t) => [p[0] + t[0], p[1] + t[1]], [0, 0]), totals: T }, r);
}
/* a card of bouts settled: bouts are [{ win: 0 | 1 | null, kd: [a, b], pts: [a, b] }] (a bout's over, as bxEnd leaves
   it; kd[s] is how often side s went down). Returns { won: [n0, n1], kd: [scored by 0, by 1], pts, win: 0 | 1 | null,
   by: 'bouts' | 'knockdowns' | 'points' | 'draw' } */
function bxCardResult(bouts) {
  const won = [0, 0], kd = [0, 0], pts = [0, 0];
  for (const b of bouts) {
    if (b.win === 0 || b.win === 1) won[b.win]++;
    kd[0] += b.kd[1]; kd[1] += b.kd[0]; pts[0] += b.pts[0]; pts[1] += b.pts[1];
  }
  const by = (a, why) => a[0] !== a[1] ? { win: a[0] > a[1] ? 0 : 1, by: why } : null;
  return Object.assign({ won, kd, pts }, by(won, 'bouts') || by(kd, 'knockdowns') || by(pts, 'points') || { win: null, by: 'draw' });
}
