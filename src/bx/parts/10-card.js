/* The Anvil Ring: the card (issue #23, phase 3). A match is a card of BX_RULES.card bouts (question 1): each side's
   fighters in order, one fighter a bout, a fighter boxes once. The other side names its order first; you pick who
   faces each of theirs (or the corner does: bxCardAuto). The bouts are boxed one after another, each a whole bout as
   07-bout.js has it, and the card is settled by bxCardResult (02-rules.js): bouts won, then knockdowns scored, then
   points on the cards.
   CD is the card, plain JSON (so a card can be saved between bouts): { sides: [2 × { name, short, color, light,
   fighters: [{ n, kind, num, r? }] }], pairs: [[mine, theirs] × 3] (fighter indices), bouts: [{ over, verdict, stats,
   kd } × done], i (the bout on now), mode, you, seed, powers, skill, result }. A bout on the card ends into CD.bouts (bxCardRecord, from bxOver);
   bxCardNext boxes the next, and after the last CD.result is the card's. */
let CD = null;
// how a fighter's ratings stack up against another's for the corner's pairing: the ratings' total, with reach counted
// against a shorter fighter and chin against a big hitter
function bxEdge(a, b) {
  const sum = r => BX_STATS.reduce((n, s) => n + r[s], 0);
  return sum(a) - sum(b) + (a.reach - b.reach) * .4 + (a.chin - b.pow) * .3 - (b.chin - a.pow) * .3;
}
/* the corner's pairing: for their fighters in order (theirs, ratings), the order of yours (mine, ratings; at least as
   many) that gives the best total edge, every fighter once. Returns indices into mine, one a bout. */
function bxCardAuto(mine, theirs) {
  const n = theirs.length; let best = null, bestV = -Infinity;
  const walk = (left, got) => {
    if (got.length === n) { const v = got.reduce((s, m, i) => s + Math.tanh(bxEdge(mine[m], theirs[i]) / 6), 0); if (v > bestV) { bestV = v; best = got.slice(); } return; }
    for (const m of left) walk(left.filter(x => x !== m), got.concat(m));
  };
  walk(mine.map((_, i) => i), []);
  return best;
}
/* a card in the ring. opts: { sides: [2 × side], picks: [your fighter index × 3] (the corner's when not given),
   order: [their fighter index × 3] (their first three when not given), mode, you, seed, powers, skill } */
function bxCardStart(opts) {
  const o = opts || {}, you = o.you === 1 ? 1 : 0, S = o.sides.map(s => Object.assign({}, s, { fighters: s.fighters.map(f => Object.assign({}, f)) }));
  const rate = f => Object.assign(bxRate(f.kind), f.r || {}), N = BX_RULES.card;
  if (S.some(s => s.fighters.length < N)) throw new Error(`a card needs ${N} fighters a side`);
  const fine = (L, n) => Array.isArray(L) && L.length === N && new Set(L).size === N && L.every(i => Number.isInteger(i) && i >= 0 && i < n);
  const order = fine(o.order, S[1 - you].fighters.length) ? o.order.slice() : [0, 1, 2];
  const picks = fine(o.picks, S[you].fighters.length) ? o.picks.slice() : bxCardAuto(S[you].fighters.map(rate), order.map(i => rate(S[1 - you].fighters[i])));
  CD = { sides: S, pairs: order.map((t, i) => you ? [t, picks[i]] : [picks[i], t]), bouts: [], i: 0, mode: o.mode || 'watch', you, seed: o.seed, powers: o.powers !== false, skill: (o.skill || [1, 1]).slice(), result: null };
  bxCardBout();
  return CD;
}
// the bout on now: its two fighters, in their corners' colours
function bxCardBout() {
  const p = CD.pairs[CD.i], S = CD.sides;
  bxStart({ fighters: [S[0].fighters[p[0]], S[1].fighters[p[1]]], corners: S.map(s => ({ name: s.name, short: s.short, color: s.color, light: s.light })),
    mode: CD.mode, you: CD.you, seed: CD.seed == null ? null : CD.seed + CD.i * 101, powers: CD.powers, skill: CD.skill });
  G.card = { i: CD.i, n: CD.pairs.length };
  bxSnapNow();
}
// a bout on the card is over (from bxOver): what the card keeps of it; the last one settles the card
function bxCardRecord() {
  const v = G.over; CD.bouts[CD.i] = { over: { how: v.how, win: v.win, kind: v.kind || null, round: v.round, kd: v.kd.slice(), pts: v.pts.slice() }, verdict: bxVerdict(), stats: G.F.map(f => Object.assign({}, f.bs)), kd: G.kd.slice() };
  if (CD.bouts.length === CD.pairs.length) CD.result = bxCardResult(CD.bouts.map(b => b.over));
}
function bxCardNext() {
  if (!CD || CD.result || !CD.bouts[CD.i] || CD.i + 1 >= CD.pairs.length) return false;
  CD.i++; bxCardBout(); return true;
}
// the card so far: bouts won by each side, and how many are left
function bxCardScore() {
  const won = [0, 0]; for (const b of CD.bouts) if (b && (b.over.win === 0 || b.over.win === 1)) won[b.over.win]++;
  return { won, done: CD.bouts.filter(Boolean).length, n: CD.pairs.length };
}
/* a whole card headless: { bouts: [summary × 3], result, pairs } (the card and bout in the ring are left as they were) */
function bxSimCard(opts) {
  const o = opts || {}, keep = CD, you = o.you === 1 ? 1 : 0;
  try {
    const rate = f => Object.assign(bxRate(f.kind), f.r || {}), N = BX_RULES.card, S = o.sides;
    if (S.some(s => s.fighters.length < N)) throw new Error(`a card needs ${N} fighters a side`);
    const fine = (L, n) => Array.isArray(L) && L.length === N && new Set(L).size === N && L.every(i => Number.isInteger(i) && i >= 0 && i < n);
    const order = fine(o.order, S[1 - you].fighters.length) ? o.order.slice() : [0, 1, 2];
    const picks = fine(o.picks, S[you].fighters.length) ? o.picks.slice() : bxCardAuto(S[you].fighters.map(rate), order.map(i => rate(S[1 - you].fighters[i])));
    const pairs = order.map((t, i) => you ? [t, picks[i]] : [picks[i], t]);
    const bouts = pairs.map((p, i) => bxSimBout({ fighters: [S[0].fighters[p[0]], S[1].fighters[p[1]]], seed: o.seed == null ? null : o.seed + i * 101, skill: o.skill, powers: o.powers }));
    return { bouts, pairs, result: bxCardResult(bouts.map(b => b.over)) };
  } finally { CD = keep; }
}
// the card in words: "The card goes to the Cinderhold Boxing Club, 2 bouts to 1", "... on knockdowns", "The card is a draw"
function bxCardVerdict() {
  const R = CD && CD.result; if (!R) return '';
  if (R.win == null) return 'The card is a draw: level on bouts, knockdowns and points.';
  const w = CD.sides[R.win].name, a = R.won[R.win], b = R.won[1 - R.win];
  return R.by === 'bouts' ? `The card goes to ${w}, ${a} bouts to ${b}.` : `The card goes to ${w} on ${R.by}, level at ${a} bouts each.`;
}
