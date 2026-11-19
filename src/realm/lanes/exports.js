/* the end of the wBL scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ frames, order: [two orders of five], roster: [two roster sizes], lead }); up (whose ball it is), bowler (who
   bowls a side's frame now), standing (its pins), roll(side, pins) (the pins that fell, or how many; says what
   happened, and whether the frame and the game are decided), whyNot; score(frames, n) and done(frame, tenth) are
   ten-pin's scoring on any sheet, isSplit(standing) the split rule and adj the pins that touch; total, marks (the
   sheet), lane (the lane of a frame), frameNo, rerack and pinch (once a game each, before a frame's first ball), and
   matchText (the game from a side's point of view). G is the game, plain JSON. The page comes in phase 2: until then
   the lanes are never on.
   Phase 1 is the lane, the ball, the pins and one game, CPU against CPU: geo (the lane's geometry), spots (each pin's),
   house() a fresh oil pattern, oilAt, mu and wear(oil, path) the oil and how a ball moves it, tides; ball(throw, oil,
   tide) the pure ball model and aimAt(throw, x, oil, tide) the angle that reaches x at the pins; deck(standing,
   ball, seed) the pure, seeded pins; groups(standing), spareTarget(pins), skills, style() and plan(side) the CPU's
   ball; start(opts) puts a game on the lanes ({ frames, teams, order, skill: [2], tide, seed, lead }), turn() bowls
   the next ball, summary() is the game so far, and simGame(opts) plays a whole one headless, leaving the game on the
   lanes as it was. */
return {
  rules: JSON.parse(JSON.stringify(BL_RULES)), adj: BL_ADJ.map(p => p.slice()), get G() { return G; },
  newGame: o => blNewGame(o), up: () => blUp(), bowler: s => blBowler(s), standing: s => G ? G.stand[s].slice() : [],
  roll: (s, p) => blRoll(s, p), whyNot: s => blWhyNot(s),
  score: (frames, n) => blScore(frames, n), done: (fr, tenth) => blFrameDone(fr, !!tenth), isSplit: st => blIsSplit(st), frameMarks: fr => blFrameMarks(fr),
  total: s => blTotal(s), marks: s => blMarks(s), lane: (s, f) => blLane(s, f), frameNo: s => blFrameNo(s),
  rerack: s => blRerack(s), pinch: (s, ri) => blPinch(s, ri), matchText: s => blMatchText(s),
  // the lane, the ball, the pins and one game (phase 1)
  geo: JSON.parse(JSON.stringify(BL_LANE)), spots: JSON.parse(JSON.stringify(BL_SPOT)), tides: Object.assign({}, BL_TIDE), oilRules: Object.assign({}, BL_OIL),
  ballRules: Object.assign({}, BL_BALL), pinRules: Object.assign({}, BL_PIN), skills: JSON.parse(JSON.stringify(BL_SKILL)), pocket: BL_POCKET,
  house: n => blHouse(n), oilAt: (oil, x, y) => blOilAt(oil, x, y), mu: (oil, x, y, tide) => blMu(oil, x, y, tide), wear: (oil, path) => blWear(oil, path),
  boardX: b => blBoardX(b), xBoard: x => blXBoard(x), ball: (t, oil, tide) => blBall(t, oil, tide), aimAt: (t, x, oil, tide) => blAimAt(t, x, oil, tide),
  deck: (st, b, seed, spots) => blDeck(st, b, seed, spots), groups: st => blGroups(st), spareTarget: p => blSpareTarget(p), style: () => blStyle(),
  plan: s => G && G.oil ? blPlan(s) : null, start: o => blStart(o), turn: () => blTurn(), summary: () => blSummary(), simGame: o => blSimGame(o),
  show: () => {}, hide: () => {}, get on() { return false; }
};
