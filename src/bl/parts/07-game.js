/* The Saltmere Lanes: a game, CPU against CPU (issue #100, phase 1). A turn loop like golf's: whose ball it is, the
   side's plan, the release, the ball down the lane, the pins, the ball's wear on the oil, and the sheet. The page
   (phase 2) plays the same loop with your ball in it.

   start(opts) puts a game on the lanes: { frames, teams: [2 × { name, short, color, roster: [{ n, kind, style? }] }],
   order, skill: [2], tide, seed, lead }. A bowler's style is { hand, mph, rpm }; a roster without one gets one from
   the seed. G gains: teams, skill, tide, oil (the pair of lanes' oil, as it is now), oil0 (as it was at the start),
   bias (a Knight's correction, a side, a bowler and a lane), the call (line, split, stance, word, wordOn, scout:
   11-call.js), st (each side's box score) and log (every ball, short).
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
    // a bowler with a kind the engine knows gets that kind's ratings (or their own); one with none keeps a seeded style
    const roster = (T.roster && T.roster.length >= BL_RULES.side ? T.roster : [0, 1, 2, 3, 4].map(i => ({ n: `${T.short || 'P'} ${i + 1}`, kind: '' })))
      .map(p => { const r = p.r || (BL_KIND[p.kind] ? blRate(p.kind) : null), m = Object.assign({}, p, r ? { r: Object.assign({}, r) } : {});
        m.rs = r ? Object.fromEntries(BL_STATS.map(k => [k, blScale(r[k])])) : Object.assign({}, BL_DEF_RAT);
        // gear: its name, and the effects the engine reads (its ratings the Realm has laid on r already)
        if (p.gear && p.gear.fx) { m.gx = blGx(p.gear.fx); m.gear = p.gear.name || p.gear.id; } else if (p.gear) delete m.gear;
        m.style = blStyleFor(m, style); return m; });
    return Object.assign({}, T, { roster }); });
  // an order: the game's, the team's own, or set by the ratings
  const order = [0, 1].map(s => (o.order && o.order[s]) || teams[s].order || (teams[s].roster.every(m => m.r) ? blAutoOrder(teams[s].roster) : null));
  blNewGame({ frames: o.frames, order, lead: o.lead, roster: teams.map(T => T.roster.length) });
  const oil = blHouse();
  Object.assign(G, { teams, skill: [0, 1].map(s => clamp(((o.skill || [])[s] ?? 1) | 0, 0, 2)), tide: BL_TIDE[o.tide] ? o.tide : 'mid',
    oil: [oil.slice(), oil.slice()], oil0: oil, bias: teams.map(T => T.roster.map(() => [0, 0])), st: [blBox(), blBox()], log: [], n: 0,
    arm: teams.map(T => T.roster.map(() => 1)),
    line: ['pocket', 'pocket'], split: ['safe', 'safe'], stance: [{ tempo: 'steady', ball: 'heavy' }, { tempo: 'steady', ball: 'heavy' }],
    word: [1, 1], wordOn: [false, false], scout: [{ same: 0, lane: null, board: null }, { same: 0, lane: null, board: null }],
    pst: teams.map(T => T.roster.map(() => ({ frames: 0, balls: 0, strikes: 0, spares: 0, pins: 0, splits: 0 }))) });
  G.streak = [0, 0]; G.fix = Array.isArray(o.fix) ? o.fix.map(f => f || null) : null;
  blHallStart(o);
  blPowersStart(o);
  blKitStart(o.bags);
  GB = null;
  return G;
}
// bowl the next ball: the plan, the release, the lane, the pins. Returns { side, ri, frame, plan, release, ball,
// down, roll } or null when the game is over
function blTurn() {
  const s = blUp(); if (s < 0) return null;
  blCpuCall(s); blCpuPotion(s); blCpuPower(s);
  const plan = blPlan(s);
  return blBowlBall(s, plan, blRelease(plan, s));
}
// a ball as released (yours from the page, or the CPU's): down the lane, into the pins, the oil worn, the sheet kept
function blBowlBall(s, plan, rel) {
  const ri = blBowler(s), lane = blLane(s), stand = G.stand[s].slice(), fresh = stand.length === 10, first = G.rb[s] === 0;
  // the powers on this ball (13-powers.js): the web and a Hex's oil go into the ball, the rest below
  const fx = blFxFor(s);
  const ball = blBall(Object.assign({}, rel, { web: !!fx.web, oilK: fx.skid }), G.oil[lane], G.tide);
  const seed = Math.floor(R() * 2147483647);
  // power: the ball drives through the pins like a heavier one
  const mass = BL_PIN.mBall * (1 + BL_REACH.pow * (blRat(s, ri).pow - .5) + BL_REACH.rev * (blRat(s, ri).rev - .5)) * BL_STANCE[blStanceOf(s).ball].mass * fx.carry * (fx.nodefl ? 1.35 : 1) * (blGxOf(s, ri).carry || 1);
  const front = stand.slice().sort((a, b) => BL_SPOT[a][1] - BL_SPOT[b][1] || Math.abs(BL_SPOT[a][0]) - Math.abs(BL_SPOT[b][0]))[0];
  const deck = ball.gutter === null ? blDeck(stand, { x: ball.x, m: ball.m, v: ball.v, spin: ball.spin, hand: ball.hand, mass, ghost: fx.ghost && stand.includes(1) && ball.hand * (ball.x - ball.hand * BL_POCKET) < -1 ? [1] : [], stone: fx.stone ? front : null }, seed, blHallSpots(s)) : { down: [], trace: [], ball: null };
  // a wobble (a harpy's Gust): a pin left standing beside one that fell may go
  if (fx.wobble && ball.gutter === null) { const left = stand.filter(p => !deck.down.includes(p)); for (const p of left) if (BL_ADJ.some(([a, b]) => (a === p && deck.down.includes(b)) || (b === p && deck.down.includes(a))) && R() < fx.wobble) deck.down.push(p); deck.down.sort((a, b) => a - b); }
  // the hall: a gutter crab, a swell, the gull (12-hall.js)
  const H = blHallAfter(s, stand, ball, deck.down); deck.down = H.down;
  G.oil[lane] = blWear(G.oil[lane], ball.path);
  // a Knight learns from its strike balls: half of how far it missed the pocket on that lane, more for a good reader.
  // Only a plan aimed at the pins (the CPU's, the captain's): a ball you bowl by hand aims at your arrow, 15 feet down
  if (fresh && plan.ball === 'strike' && plan.why !== 'yours' && ball.gutter === null && BL_SKILL[G.skill[s]].learn) G.bias[s][ri][lane] += BL_SKILL[G.skill[s]].learn * (.6 + .8 * blRat(s, ri).red) * (plan.aim.x - ball.x);
  // the arm: this ball costs the bowler some (a power ball more)
  G.arm[s][ri] = Math.max(0, +(G.arm[s][ri] - blArmCost(s, rel.power)).toFixed(3));
  // the scout sees a strike ball's stand; the coach's word is spent on this ball
  if (fresh && plan.ball === 'strike') blScoutSee(s, lane, rel.x0);
  if (G.wordOn[s]) G.wordOn[s] = false;
  const roll = blRoll(s, deck.down);
  G.streak[s] = roll.strike ? G.streak[s] + 1 : 0;
  blPowersAfter(s, roll, stand, G.streak[s]); blKitAfter(s);
  // a fresh rack in front of the side: Moll's hand; and the tide may turn
  if (G.rb[s] === 0 && G.stand[s].length === 10 && !roll.over) blHallRack(s);
  const tide = blHallTide();
  // a frame finished: the rest of the side got their breath back while it was bowled
  if (roll.done) G.arm[s] = G.arm[s].map((a, i) => i === ri ? a : Math.min(1, +(a + BL_ARM.back).toFixed(3)));
  blCount(s, stand, first, ball, roll);
  const P = G.pst[s][ri]; P.balls++; P.pins += roll.n; if (roll.strike) P.strikes++; if (roll.spare) P.spares++; if (roll.split) P.splits++; if (roll.done) P.frames++;
  G.n++;
  G.log.push([s, ri, roll.frame, deck.down.length, roll.strike ? 'X' : roll.spare ? '/' : roll.split ? 'o' : '']);
  GB = { s, ri, lane, stand, plan, rel, ball, deck, roll, said: H.said, tide };
  // every ball's track this game, by lane, for the lane chart (a point every other foot; the page's, not saved)
  if (GP && GP.tracks) GP.tracks[lane].push({ s, frame: roll.frame, ri, path: ball.path.filter((_, i) => i % 2 === 0), gutter: ball.gutter });
  return { side: s, ri, frame: roll.frame, plan, release: rel, ball: { x: ball.x, entry: ball.entry, gutter: ball.gutter, skid: ball.skid, roll: ball.roll }, down: deck.down, roll, said: H.said, tide };
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
  return { over: G.over, pst: JSON.parse(JSON.stringify(G.pst || [[], []])), teams: G.teams.map(T => ({ name: T.name, roster: T.roster.map(m => m.n) })), order: G.order.map(o => o.slice()), tot: [blTotal(0), blTotal(1)], game: [blTotalOf(G.fr[0], G.frames), blTotalOf(G.fr[1], G.frames)], ro: G.ro,
    marks: [blMarks(0), blMarks(1)], st: JSON.parse(JSON.stringify(G.st)), skill: G.skill.slice(), tide: G.tide, balls: G.n, casts: JSON.parse(JSON.stringify(G.casts || [])), pots: JSON.parse(JSON.stringify(G.pots || [])) };
}
// a whole game headless: leaves the game on the lanes (and the engine's random stream) as they were
function blSimGame(opts) {
  // (the page's game is set aside, so the sim's balls never reach its tracks; the random stream is put back as it was)
  const keep = G, keepB = GB, keepP = GP, keepR = engRand;
  GP = null;
  // (unseeded, a stream of its own, so a seeded game on the lanes draws the same numbers after it as without it)
  if (!opts || opts.seed == null) engRand = engRng((Math.random() * 4294967296) >>> 0);
  try {
    blStart(opts);
    let n = 0; while (!G.over && n++ < 400) blTurn();
    return Object.assign({ win: G.over ? G.over.win : -1 }, blSummary());
  } finally { G = keep; GB = keepB; GP = keepP; engRand = keepR; }
}

// the game as it stands between balls, plain JSON (a match saved and left); and back
function blSnapshot() { return JSON.parse(JSON.stringify({ G, mode: GP ? GP.mode : 'watch', streak: GP ? GP.streak : [0, 0], mgr: GP ? GP.mgr : null })); }
function blResume(sn) {
  G = JSON.parse(JSON.stringify(sn.G)); GB = null;
  blPlayStart({ mode: sn.mode });
  GP.streak = (sn.streak || [0, 0]).slice(); if (sn.mgr) GP.mgr = Object.assign({}, sn.mgr);
  GP.msg = `Back at the lanes: ${blMatchText(0).toLowerCase()}.`;
  return G;
}
