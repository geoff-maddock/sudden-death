/* the end of the wGL scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ holes, pars, honour }); hitters and canHit (who may hit for a side), away (who plays next, from the two
   distances to the hole), stroke, drop, holed and concede (each returns what happened, and whether the hole and the
   match are decided), matchText (the match from a side's point of view), parOf and holeNo. G is the game, plain JSON.
   Phase 1 is the course, the shot and one game, CPU against CPU: course(i) is hole i of the game's course (or of the
   standing nine, with no game), built(seed, par) any hole; lie and slope read a hole; clubs, lies and swing are the
   tables; reach, flight, putt and read are the pure shot model; plan is the caddie's shot for a side; start(opts) puts a
   game on the first tee ({ holes, wild, course, seed, skill: [2], teams: [2], honour }), turn() plays the next shot and
   says what happened, summary() is the game so far, and simGame(opts) plays a whole one headless and returns it,
   leaving the game on the course as it was.
   onShot and onOver hear each shot and the end.
   Phase 2 is the page and playing by hand: start(opts) also puts the game on show ({ mode: 'watch' or 'play' }), and
   show, hide, on, pause, paused, speed and render drive the canvas (l1-page.js). The beat: phase, msg, view (a copy of
   what the page needs: the phase, whose shot, your choice, the clubs and hitters you may pick, the meter), tick(dt)
   (the tests move the game on by hand). Your shot: select({ ri, club, shape, traj, spin }), aimAt, aimTurn, aimPush,
   press (Space), drag(pull, deg) (the phone's swing), offer(give), setMode; swingNums, win and readLine are the numbers
   behind the meter and the read; scr and unscr map the picture; shown is the match as drawn (it waits for the ball, as the picture does). onPhase and onPick hear a new beat and a new choice. */
return {
  rules: JSON.parse(JSON.stringify(GL_RULES)), get G() { return G; },
  newGame: o => glNewGame(o), pars: n => glPars(n), parOf: h => glParOf(h), holeNo: () => glHoleNo(),
  hitters: s => glHitters(s), canHit: (s, ri) => glCanHit(s, ri), whyNot: (s, ri) => glWhyNot(s, ri), away: d => glAway(d),
  stroke: (s, ri) => glStroke(s, ri), drop: s => glDrop(s), holed: s => glHoled(s), concede: s => glConcede(s),
  holeState: () => glHoleState(), up: () => glUp(), left: () => glLeft(), matchText: s => glMatchText(s),
  stand: GL_STAND, clubs: JSON.parse(JSON.stringify(GL_CLUBS)), lies: JSON.parse(JSON.stringify(GL_LIES)), swing: Object.assign({}, GL_SWING), skills: JSON.parse(JSON.stringify(GL_SKILL)),
  putting: Object.assign({}, GL_PUTT), cell: GL_CELL,
  course: i => G && G.cs != null ? glHoleAt(i) : glCourseHole(GL_STAND, i % 9, GL_RULES.par9[i % 9]),
  built: (seed, par) => glBuildHole(seed, par), wildPars: (cs, n) => glWildPars(cs, n), lie: (H, x, y) => glLie(H, x, y), slope: (H, x, y) => glSlope(H, x, y),
  reach: (club, lie, rat, pow) => glReach(club, lie, rat, pow), flight: s => glFlight(s), putt: p => glPutt(p), read: (H, from, k) => glRead(H, from, k == null ? 1 : k),
  plan: s => glPlan(s), turn: () => glTurn(), summary: () => G && G.teams ? glSummary() : null, simGame: o => glSimGame(o),
  set onShot(f) { GL_HOOK.onShot = f; }, get onShot() { return GL_HOOK.onShot; }, set onOver(f) { GL_HOOK.onOver = f; }, get onOver() { return GL_HOOK.onOver; },
  start: o => { glStart(o); glPlayStart(o || {}); return G; },
  show: () => glShow(), hide: () => glHide(), get on() { return GLP.on; }, render: () => glRender(0),
  pause: on => { GLP.paused = !!on; }, get paused() { return GLP.paused; }, get speed() { return GLP.speed; }, set speed(n) { GLP.speed = clamp(Math.round(n) || 1, 1, 8); },
  get shown() { return GD && GD.disp ? { h: GD.disp.h, match: GD.disp.match, won: GD.disp.won.slice(), over: GD.disp.over } : null; },
  get phase() { return GD ? GD.ph : null; }, get msg() { return GD ? GD.msg : ''; }, get mode() { return GD ? GD.mode : null; }, get you() { return GD ? GD.you : 0; },
  get view() { return GD ? JSON.parse(JSON.stringify({ ph: GD.ph, mode: GD.mode, you: GD.you, sel: GD.sel, meter: GD.meter, swung: GD.swung, last: GD.last, cpu: GD.cpu, hitters: GD.ph === 'aim' ? glHitters(GD.you) : [], clubs: GD.ph === 'aim' ? glClubsNow() : [], h: GD.disp ? GD.disp.h : 0 })) : null; },
  tick: dt => glTick(dt == null ? 0.05 : dt), select: o => glSelect(o), aimAt: (x, y) => glAimAt(x, y), aimTurn: d => glAimTurn(d), aimPush: y => glAimPush(y),
  press: () => glPress(), drag: (p, d) => glDrag(p, d), offer: g => glOffer(!!g), setMode: m => glSetMode(m),
  swingNums: (pow, m, rat) => glSwingNums(pow, m, rat || GL_DEF_RAT), win: (rat, pow) => glWin(rat || GL_DEF_RAT, pow || 1), readLine: () => glReadLine(), readLen: () => glReadLen(),
  meterRules: Object.assign({}, GL_METER), pace: Object.assign({}, GL_PACE), hands: Object.assign({}, GL_HANDS), shapes: JSON.parse(JSON.stringify(GL_SHAPES)), trajs: JSON.parse(JSON.stringify(GL_TRAJ)),
  scr: (x, y) => glScr(x, y), unscr: (sx, sy) => glUnscr(sx, sy), cam: () => Object.assign({}, GLC), animBall: () => glAnimBall(),
  set onPhase(f) { GL_HOOK.onPhase = f; }, get onPhase() { return GL_HOOK.onPhase; }, set onPick(f) { GL_HOOK.onPick = f; }, get onPick() { return GL_HOOK.onPick; },
};
