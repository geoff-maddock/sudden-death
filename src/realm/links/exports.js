/* the end of the wGL scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ holes, pars, honour }); hitters and canHit (who may hit for a side), away (who plays next, from the two
   distances to the hole), stroke, drop, holed and concede (each returns what happened, and whether the hole and the
   match are decided), matchText (the match from a side's point of view), parOf and holeNo. G is the game, plain JSON.
   Phase 1 is the course, the shot and one game, CPU against CPU: course(i) is hole i of the game's course (or of the
   standing nine, with no game), built(seed, par) any hole; lie and slope read a hole; clubs, lies and swing are the
   tables; reach, flight, putt and read are the pure shot model; plan is the caddie's shot for a side; start(opts) puts a
   game on the first tee ({ holes, wild, course, seed, skill: [2], teams: [2], honour }), turn() plays the next shot and
   says what happened, summary() is the game so far, and simGame(opts) plays a whole one headless and returns it.
   onShot and onOver hear each shot and the end.
   There is no page yet: show and hide do nothing, and on is always false, so W_ENGINES can list it. */
return {
  rules: JSON.parse(JSON.stringify(GL_RULES)), get G() { return G; },
  newGame: o => glNewGame(o), pars: n => glPars(n), parOf: h => glParOf(h), holeNo: () => glHoleNo(),
  hitters: s => glHitters(s), canHit: (s, ri) => glCanHit(s, ri), away: d => glAway(d),
  stroke: (s, ri) => glStroke(s, ri), drop: s => glDrop(s), holed: s => glHoled(s), concede: s => glConcede(s),
  holeState: () => glHoleState(), up: () => glUp(), left: () => glLeft(), matchText: s => glMatchText(s),
  stand: GL_STAND, clubs: JSON.parse(JSON.stringify(GL_CLUBS)), lies: JSON.parse(JSON.stringify(GL_LIES)), swing: Object.assign({}, GL_SWING), skills: JSON.parse(JSON.stringify(GL_SKILL)),
  putting: Object.assign({}, GL_PUTT), cell: GL_CELL,
  course: i => G && G.cs != null ? glCourseHole(G.cs, (i % G.holes) % 9, glParOf(i)) : glCourseHole(GL_STAND, i % 9, GL_RULES.par9[i % 9]),
  built: (seed, par) => glBuildHole(seed, par), wildPars: (cs, n) => glWildPars(cs, n), lie: (H, x, y) => glLie(H, x, y), slope: (H, x, y) => glSlope(H, x, y),
  reach: (club, lie, rat, pow) => glReach(club, lie, rat, pow), flight: s => glFlight(s), putt: p => glPutt(p), read: (H, from, k) => glRead(H, from, k == null ? 1 : k),
  plan: s => glPlan(s), start: o => glStart(o), turn: () => glTurn(), summary: () => G && G.teams ? glSummary() : null, simGame: o => glSimGame(o),
  set onShot(f) { GL_HOOK.onShot = f; }, get onShot() { return GL_HOOK.onShot; }, set onOver(f) { GL_HOOK.onOver = f; }, get onOver() { return GL_HOOK.onOver; },
  show: () => {}, hide: () => {}, get on() { return false; },
};
