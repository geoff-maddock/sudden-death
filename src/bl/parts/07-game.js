/* The Saltmere Lanes: a game, CPU against CPU (issue #100, phase 1). A turn loop like golf's: whose ball it is, the
   side's plan, the release, the ball down the lane, the pins, the ball's wear on the oil, and the sheet. The page
   (phase 2) plays the same loop with your ball in it.

   start(opts) puts a game on the lanes: { frames, teams: [2 × { name, short, color, roster: [{ n, kind, style? }] }],
   order, skill: [2], tide, seed, lead }. A bowler's style is { hand, mph, rpm }; a roster without one gets one from
   the seed. G gains: teams, skill, tide, oil (the pair of lanes' oil, as it is now), oil0 (as it was at the start),
   bias (a Knight's correction, a side, a bowler and a lane), st (each side's box score) and log (every ball, short).
   turn() bowls the next ball and says what happened. simGame(opts) plays a whole game headless and returns its
   sheet, score and box score, leaving any game on the lanes as it was. */
let GB = null;   // the ball in play between turn() and the page's drawing (phase 2): not saved

function blBox() { return { balls: 0, strikes: 0, firsts: 0, spares: 0, spareTries: 0, singles: 0, singleTries: 0, splits: 0, splitsMade: 0, sevenTen: 0, sevenTenMade: 0, opens: 0, gutters: 0, leaves: {}, pins: 0 }; }
function blStyleOf(s, ri) {
  const T = G.teams && G.teams[s], p = T && T.roster[ri];
  return p && p.style ? p.style : { hand: 1, mph: 17, rpm: 350 };
}
function blStart(opts) {
  const o = opts || {};
  if (o.seed != null) engSeed(o.seed);
  const style = engRng((o.seed == null ? 1 : o.seed) * 31 + 7);
  const teams = [0, 1].map(s => { const T = (o.teams && o.teams[s]) || { name: s ? 'Saltmere' : 'Graftonbury', short: s ? 'SAL' : 'GRA', color: s ? '#2f7898' : '#9b3a7a' };
    const roster = (T.roster && T.roster.length >= BL_RULES.side ? T.roster : [0, 1, 2, 3, 4].map(i => ({ n: `${T.short || 'P'} ${i + 1}`, kind: 'zombie' })))
      .map(p => Object.assign({}, p, { style: p.style ? Object.assign({}, p.style) : blStyle(style) }));
    return Object.assign({}, T, { roster }); });
  blNewGame({ frames: o.frames, order: o.order, lead: o.lead, roster: teams.map(T => T.roster.length) });
  const oil = blHouse();
  Object.assign(G, { teams, skill: [0, 1].map(s => clamp(((o.skill || [])[s] ?? 1) | 0, 0, 2)), tide: BL_TIDE[o.tide] ? o.tide : 'mid',
    oil: [oil.slice(), oil.slice()], oil0: oil, bias: teams.map(T => T.roster.map(() => [0, 0])), st: [blBox(), blBox()], log: [], n: 0 });
  GB = null;
  return G;
}
// bowl the next ball: the plan, the release, the lane, the pins. Returns { side, ri, frame, plan, release, ball,
// down, roll } or null when the game is over
function blTurn() {
  const s = blUp(); if (s < 0) return null;
  const ri = blBowler(s), lane = blLane(s), stand = G.stand[s].slice(), fresh = stand.length === 10, first = G.rb[s] === 0;
  const plan = blPlan(s), rel = blRelease(plan, G.skill[s]);
  const ball = blBall(rel, G.oil[lane], G.tide);
  const seed = Math.floor(R() * 2147483647);
  const deck = ball.gutter === null ? blDeck(stand, { x: ball.x, m: ball.m, v: ball.v, spin: ball.spin, hand: ball.hand }, seed) : { down: [], trace: [] };
  G.oil[lane] = blWear(G.oil[lane], ball.path);
  // a Knight learns from its strike balls: half of how far it missed the pocket, on that lane
  if (fresh && plan.ball === 'strike' && ball.gutter === null && BL_SKILL[G.skill[s]].learn) G.bias[s][ri][lane] += BL_SKILL[G.skill[s]].learn * (plan.aim.x - ball.x);
  const roll = blRoll(s, deck.down);
  blCount(s, stand, first, ball, roll);
  G.n++;
  G.log.push([s, ri, roll.frame, deck.down.length, roll.strike ? 'X' : roll.spare ? '/' : roll.split ? 'o' : '']);
  GB = { s, ri, lane, plan, rel, ball, deck };
  return { side: s, ri, frame: roll.frame, plan, release: rel, ball: { x: ball.x, entry: ball.entry, gutter: ball.gutter, skid: ball.skid, roll: ball.roll }, down: deck.down, roll };
}
// the box score: strikes on full racks, spares and single pins made, splits left and made, the 7-10, the leaves
function blCount(s, stand, first, ball, roll) {
  const B = G.st[s]; B.balls++; B.pins += roll.n; if (ball.gutter !== null) B.gutters++;
  if (stand.length === 10 && first) { B.firsts++; if (roll.strike) B.strikes++; else { const left = G.rb[s] ? G.stand[s].slice() : stand.filter(p => !roll.pins.includes(p)); const k = left.join('-'); B.leaves[k] = (B.leaves[k] || 0) + 1; if (roll.split) { B.splits++; if (left.length === 2 && left[0] === 7 && left[1] === 10) B.sevenTen++; } } }
  else if (!first) {
    B.spareTries++; if (roll.spare) B.spares++;
    if (stand.length === 1) { B.singleTries++; if (roll.spare) B.singles++; }
    if (blIsSplit(stand) && stand.length < 10) { if (roll.spare) B.splitsMade++; if (stand.length === 2 && stand[0] === 7 && stand[1] === 10 && roll.spare) B.sevenTenMade++; }
    if (!roll.spare) B.opens++;
  }
}
// the game so far, short
function blSummary() {
  if (!G) return null;
  return { over: G.over, tot: [blTotal(0), blTotal(1)], game: [blTotalOf(G.fr[0], G.frames), blTotalOf(G.fr[1], G.frames)], ro: G.ro,
    marks: [blMarks(0), blMarks(1)], st: JSON.parse(JSON.stringify(G.st)), skill: G.skill.slice(), tide: G.tide, balls: G.n };
}
// a whole game headless: leaves the game on the lanes (and the engine's random stream) as they were
function blSimGame(opts) {
  const keep = G, keepB = GB;
  blStart(opts);
  let n = 0; while (!G.over && n++ < 400) blTurn();
  const out = Object.assign({ win: G.over ? G.over.win : -1 }, blSummary());
  if (opts && opts.seed != null) engSeed(null);
  G = keep; GB = keepB;
  return out;
}
