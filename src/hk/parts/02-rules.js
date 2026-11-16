/* Black Ice: the rules (issue #83, phase 0). Plain data and pure functions, no page: the score, the periods and the
   game clock, penalties and their clocks, how many skaters each side has, icing, sudden death and the shootout, and
   which goal each side attacks.
   Five skaters and a goalie a side. A game is HK_RULES.mins minutes (6 by default; the Realm's settings offer 3, 6, 9
   or 12), three periods of a third of that each. The clock runs only while the puck is in play.
   A goal is 1. There is no offside. Icing: a puck sent from a side's own half that crosses the far goal line untouched
   comes back for a face-off in that side's end; a side that is short-handed may ice it freely (hkIcingOn).
   Penalties: a minor is a sixth of a period (20 seconds at the default length). The player sits in the box and their
   side skates one short until the time is up, or until the other side scores while it has more skaters (then the
   earliest minor ends). A side is never below HK_RULES.minSk skaters: a further penalty waits its turn (G.wait).
   Level after the third period, sudden death at HK_RULES.otSk skaters a side, half a period long: the next goal wins.
   Still level, a shootout: HK_RULES.so shooters each, then one each until one side scores and the other doesn't; the
   winner gets one goal on the score. A game never ends level.
   G is the game, plain JSON (so a snapshot can be saved): { mins, plen, p, clock, score, sog, box, wait, so, over }.
   box: the penalties being served, [{ side, ri, t, k }]. 07-game.js adds the teams and the rest. */
const HK_RULES = { skaters: 5, side: 6, bench: 6, mins: 6, minsAt: [3, 6, 9, 12], periods: 3, minorOf: 6, otOf: 2, minSk: 3, otSk: 3, so: 3,
  len: 40, wid: 20, corner: 4, goal: 3, net: 1.1, deep: 1, blue: 14, crease: 1.5 };
let G = null;

function hkNewGame(opts) {
  const o = opts || {}, mins = HK_RULES.minsAt.includes(o.mins) ? o.mins : HK_RULES.mins, plen = mins * 60 / HK_RULES.periods;
  G = { mins, plen, p: 1, clock: plen, score: [0, 0], sog: [0, 0], box: [], wait: [], so: null, over: null };
  return G;
}
const hkOt = () => G.p > HK_RULES.periods;
// how long a minor is, in seconds of the game clock
const hkMinor = () => G.plen / HK_RULES.minorOf;
/* skaters each side has on the ice now: [a, b]. Five (three in sudden death), less one for each penalty being served.
   Nobody goes below minSk: in sudden death, where a side is already at three, the other side gets a skater more. */
function hkStrength() {
  const base = hkOt() ? HK_RULES.otSk : HK_RULES.skaters, left = [0, 1].map(s => base - G.box.filter(b => b.side === s).length);
  // (what a side can't lose, the other side gains)
  return [0, 1].map(s => Math.min(HK_RULES.skaters, Math.max(left[s], HK_RULES.minSk) + Math.max(0, HK_RULES.minSk - left[1 - s])));
}
// side is a skater (or more) short of the other
const hkShort = side => { const s = hkStrength(); return s[side] < s[1 - side]; };
/* a penalty on side's player ri (k: what for). It is served now if their side has room in the box (no more than two
   at once), or waits. Returns the entry, with waits: true when it had to wait. */
function hkPenalty(side, ri, k) {
  const e = { side, ri, t: hkMinor(), k: k || 'minor' }, serving = G.box.filter(b => b.side === side).length;
  if (serving >= HK_RULES.skaters - HK_RULES.minSk) { G.wait.push(e); return Object.assign({ waits: true }, e); }
  G.box.push(e); return Object.assign({ waits: false }, e);
}
// a penalty has ended: out of the box, and the next one waiting for that side starts
function hkBoxOut(e) {
  const i = G.box.indexOf(e); if (i < 0) return;
  G.box.splice(i, 1);
  const w = G.wait.findIndex(x => x.side === e.side); if (w >= 0) G.box.push(G.wait.splice(w, 1)[0]);
}
/* side scores. In sudden death that ends the game. If the other side was short-handed, its earliest penalty ends.
   Returns { score, freed (the penalty that ended, or null), over }. */
function hkGoal(side) {
  const short = hkShort(1 - side);
  G.score[side]++;
  let freed = null;
  if (short) { freed = G.box.find(b => b.side === 1 - side) || null; if (freed) hkBoxOut(freed); }
  if (hkOt() && !G.over) G.over = { win: side, score: G.score.slice(), ot: 1, so: false };
  return { score: G.score[side], freed, over: !!G.over };
}
/* the clocks run dt seconds of play: the game clock, and every penalty being served. Returns { end (the period's
   clock has run out), out: [the penalties that ended] }. */
function hkRun(dt) {
  if (G.over) return { end: false, out: [] };
  const d = Math.min(dt, G.clock);
  G.clock = Math.max(0, G.clock - dt);
  const out = [];
  for (const b of G.box.slice()) { b.t -= d; if (b.t <= 1e-9) { out.push(b); hkBoxOut(b); } }
  return { end: G.clock <= 0, out };
}
// the goal side attacks: +1 the right-hand one, -1 the left; the sides swap ends every period
const hkDir = side => (G.p % 2 === 1) === (side === 0) ? 1 : -1;
// that goal's line, in rink metres (x along, from the left end boards; y across, from the middle)
const hkGoalX = side => hkDir(side) > 0 ? HK_RULES.len - HK_RULES.goal : HK_RULES.goal;
// how far up the ice x is for side, from the end it defends (0) to the end it attacks (len)
const hkUp = (side, x) => hkDir(side) > 0 ? x : HK_RULES.len - x;
// would a puck sent by side from x be icing if it crossed the far goal line untouched? (from its own half, and not short-handed)
const hkIcingOn = (side, x) => hkUp(side, x) < HK_RULES.len / 2 && !hkShort(side);
/* the period is over: the next period, sudden death after the third when level, a shootout after that, or the end.
   Returns 'period', 'ot', 'shootout' or 'over'. Penalties carry over a break. */
function hkPeriodEnd() {
  if (G.over) return 'over';
  if (G.p >= HK_RULES.periods && G.score[0] !== G.score[1]) {
    G.over = { win: G.score[0] > G.score[1] ? 0 : 1, score: G.score.slice(), ot: G.p > HK_RULES.periods ? 1 : 0, so: false };
    return 'over';
  }
  if (G.p > HK_RULES.periods) { G.so = { tries: [0, 0], goals: [0, 0], first: 0 }; G.clock = 0; return 'shootout'; }
  G.p++; G.clock = G.p > HK_RULES.periods ? G.plen / HK_RULES.otOf : G.plen;
  return G.p > HK_RULES.periods ? 'ot' : 'period';
}
// whose shot is next in the shootout (the sides take turns, G.so.first first)
const hkSoTurn = () => G.so.tries[G.so.first] <= G.so.tries[1 - G.so.first] ? G.so.first : 1 - G.so.first;
/* a shootout try by side: scored or not. Returns the winner (0 or 1) once it's settled, or null. In the first
   HK_RULES.so rounds it ends as soon as one side can't be caught; after them, when a round ends with one side ahead. */
function hkSoShot(side, scored) {
  const S = G.so; S.tries[side]++; if (scored) S.goals[side]++;
  const n = HK_RULES.so, left = s => Math.max(0, n - S.tries[s]);
  let win = null;
  if (S.tries[0] <= n && S.tries[1] <= n) { for (const s of [0, 1]) if (S.goals[s] > S.goals[1 - s] + left(1 - s)) win = s; }
  if (win == null && S.tries[0] === S.tries[1] && S.tries[0] >= n && S.goals[0] !== S.goals[1]) win = S.goals[0] > S.goals[1] ? 0 : 1;
  if (win != null) { G.score[win]++; G.over = { win, score: G.score.slice(), ot: 1, so: true }; }
  return win;
}
const hkPeriodName = p => p <= HK_RULES.periods ? ['', '1st', '2nd', '3rd'][p] : 'OT';
