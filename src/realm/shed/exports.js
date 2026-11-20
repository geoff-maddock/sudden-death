/* the end of the wCR scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ ends: 4 | 6 | 8, order: [two orders of four], roster: [two roster sizes], hammer: the side with the first
   end's hammer, fgz: false for no free guard zone }); up (whose stone it is), thrower (who throws side s's stone now),
   pos (their position, 0 lead to 3 skip), sideNo (side s's stone number this end), throw(side, after, { hit }) (the stones in
   play once it stopped, and whether it touched one; applies the free guard zone, scores the end after its sixteenth stone, and says so), whyNot;
   scoreEnd(stones), inHouse, inFgz, inPlay (a thrown stone's: wholly past the hog line and on the sheet), onSheet
   (a stone already in play: it stays short of the hog line) and dist read where stones are; total, board (the scoreboard), matchText.
   rules and sheet are the tables. G is the game, plain JSON. The page comes in phase 2: until then the shed is never
   on.
   Phase 1 is the stone, the ice and one game, CPU against CPU: stoneRules, iceRules, colds, skills, shots (the tables);
   iceNew, iceAt and wear (the pebble); run(stones, throw, opts) the pure stone model (one stone thrown among the others
   to rest), alone(throw, ice, cold, sweep) a stone on its own, solveDraw(x, y, h, ice, cold) and solveHit(x, y, v, h,
   ice, cold) the aim; value(stones, side, kAfter, hammer, skill) what a result is worth to a skip, plan(side) the
   CPU's call; start(opts) puts a game on the ice ({ ends, teams, order, skill: [2], hammer, cold, fgz, seed }), turn()
   throws the next stone, throwStone(side, plan, release, sweep) one as released, summary() is the game so far,
   simGame(opts) a whole game headless. */
return {
  rules: JSON.parse(JSON.stringify(CR_RULES)), sheet: JSON.parse(JSON.stringify(CR_SHEET)), get G() { return G; },
  newGame: o => crNewGame(o), up: () => crUp(), thrower: s => crThrower(s), pos: s => crPos(s), sideNo: s => crSideNo(s),
  throw: (s, after, o) => crThrow(s, after, o), whyNot: s => crWhyNot(s),
  scoreEnd: st => crScoreEnd(st), inHouse: st => crInHouse(st), inFgz: st => crInFgz(st), inPlay: st => crInPlay(st), onSheet: st => crOnSheet(st), dist: st => crDist(st),
  total: s => crTotal(s), board: () => crBoard(), matchText: s => crMatchText(s),
  // the stone, the ice and one game (phase 1)
  stoneRules: JSON.parse(JSON.stringify(CR_STONE)), iceRules: JSON.parse(JSON.stringify(CR_ICE)), colds: JSON.parse(JSON.stringify(CR_COLD)), skills: JSON.parse(JSON.stringify(CR_SKILL)), shots: Object.assign({}, CR_SHOTS),
  iceNew: () => crIceNew(), iceAt: (ice, x, y, cold) => crIceAt(ice, x, y, cold), wear: (ice, path) => crWear(ice, path),
  run: (stones, th, o) => crRun(stones, th, o), alone: (th, ice, cold, sweep) => crAlone(th, ice, cold, sweep), solveDraw: (x, y, h, ice, cold) => crSolveDraw(x, y, h, ice, cold), solveHit: (x, y, v, h, ice, cold) => crSolveHit(x, y, v, h, ice, cold),
  value: (st, s, k, hammer, sk) => crValue(st, s, k, hammer, sk), plan: s => G && G.teams ? crPlan(s) : null,
  start: o => crStart(o), turn: () => crTurn(), throwStone: (s, plan, rel, sweep) => G && G.teams ? crThrowStone(s, plan, rel, sweep) : null, summary: () => crSummary(), simGame: o => crSimGame(o),
  show: () => {}, hide: () => {}, get on() { return false; }
};
