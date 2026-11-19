/* the end of the wGL scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ holes, pars, honour }); hitters and canHit (who may hit for a side), away (who plays next, from the two
   distances to the hole), stroke, drop, holed and concede (each returns what happened, and whether the hole and the
   match are decided), decide (close the hole when it is decided: stroke and drop don't, as the caller may still mean
   to hole the ball; holeState says whether it is, and the game's own shot calls decide itself), matchText (the match from a side's point of view), parOf and holeNo. G is the game, plain JSON.
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
  newGame: o => { GD = null; return glNewGame(o); }, pars: n => glPars(n), parOf: h => glParOf(h), holeNo: () => glHoleNo(),
  hitters: s => glHitters(s), canHit: (s, ri) => glCanHit(s, ri), whyNot: (s, ri) => glWhyNot(s, ri), away: d => glAway(d),
  stroke: (s, ri) => glStroke(s, ri), drop: s => glDrop(s), holed: s => glHoled(s), concede: s => glConcede(s),
  holeState: () => glHoleState(), decide: () => glDecide(), up: () => glUp(), left: () => glLeft(), matchText: s => glMatchText(s),
  // ratings, roles, focus and nerve (phase 3): stats (the six, in order), rate(kind) (1 to 12), cap, fit(r, role) (r 1 to
  // 12), autoRoles(roster), focus (G.focus), pressure(side), and the tables behind them
  stats: GL_STATS.slice(), rate: k => glRate(k), cap: GL_RCAP, roles: ['tee', 'approach', 'short', 'putt'],
  fit: (r, role) => glFit(Object.fromEntries(GL_STATS.map(s => [s, glScale(r[s])])), role), autoRoles: ro => glAutoRoles(ro.map(m => ({ r: Object.fromEntries(GL_STATS.map(s => [s, glScale(m.r[s])])) }))),
  get focus() { return G && G.focus ? G.focus.map(f => f.slice()) : null; }, pressure: s => G && G.hole ? glPressure(s) : 0, focusRules: Object.assign({}, GL_FOCUS),
  // the call (phase 4): the lines, a side's stance, the caddie's word, the scout, the CPU's line, the turn, the wind as seen
  lines: JSON.parse(JSON.stringify(GL_LINES)), stanceRules: JSON.parse(JSON.stringify(GL_STANCE)), stance: s => G && G.stance ? Object.assign({}, G.stance[s]) : null,
  get word() { return G && G.word ? G.word.slice() : null; }, get wordOn() { return G && G.wordOn ? G.wordOn.slice() : null; }, get scout() { return G && G.scout ? JSON.parse(JSON.stringify(G.scout)) : null; },
  cpuLine: s => glCpuLine(s), cpuCall: s => glCpuCall(s), turnAt: () => glTurnAt(), windShown: () => G && G.wind ? glWindShown(G.wind) : null, fat: H => glFat(H),
  // games from the world (phase 5): Manage's call, the game between shots, the weather and the wood
  modes: GL_MODES.slice(), manage: o => glManage(o), get mgr() { return GD ? Object.assign({}, GD.mgr) : null; }, snapshot: () => glSnapshot(), resume: sn => glResume(sn),
  weathers: JSON.parse(JSON.stringify(GL_WEATHER)), wood: H => glWood(H), woodAfter: (s, ri) => { const ev = { k: 'shot', holed: false, water: false }; const t = glWoodAfter(s, ri, ev); return { t, ev }; }, wetK: () => glWetK(), hazeK: () => glHazeK(), woodRules: Object.assign({}, GL_WOOD), get weather() { return G ? G.weather : null; },
  // powers (phase 6): start({ powers: true, autoPow }), the tables, what a side's next stroke has, and casting
  pow: JSON.parse(JSON.stringify(GL_POW)), pow2: JSON.parse(JSON.stringify(GL_POW2)), ult: JSON.parse(JSON.stringify(GL_ULT)), sit: JSON.parse(JSON.stringify(GL_SIT)), manaRules: Object.assign({}, GL_MANA), roarRules: Object.assign({}, GL_ROAR),
  get mana() { return G && G.mana ? G.mana.slice() : null; }, get roar() { return G && G.roar ? G.roar.slice() : null; }, get mark() { return G && G.mark ? JSON.parse(JSON.stringify(G.mark)) : null; }, get casts() { return G && G.casts ? JSON.parse(JSON.stringify(G.casts)) : []; },
  fxFor: s => G ? glFxFor(s) : null, powNow: (s, ri) => G ? glPowNow(s, ri) : null, powWhy: (s, k, ri) => G ? glPowWhy(s, k, ri) : 'No game.', cast: (s, k, ri) => glCast(s, k, ri), castMine: k => glCastMine(k), cpuPower: (s, ri) => glCpuPower(s, ri), tip: (s, ri) => G ? glPowerTip(s, ri) : '',
  get autoPow() { return GD ? GD.autoPow : true; }, set autoPow(v) { if (GD) GD.autoPow = !!v; },
  // the enchanted course (phase 6b): start({ enchant: true }), a hole's enchantments, and their rules
  enchant: H => glEnchant(H), enchRules: Object.assign({}, GL_ENCH), enchantAfter: (s, ri, r, plan) => { const ev = { k: 'shot', holed: false, water: false }; const t = glEnchantAfter(s, ri, ev, r || null, plan || { putt: !r }); return { t, ev }; },
  bogReach: H => glBogReach(glEnchant(H)), wispAt: (w, k) => glWispAt(w, k), entAt: (e, k) => glEntAt(e, k), get webbed() { return G && G.webbed ? G.webbed.slice() : null; },
  // gear and potions (phase 7): start({ bags: [yours or null, theirs] }); a roster player's gear ({ id, name, fx });
  // the potions, why one can't be given now, yours given ('' when it took: the page takes it out of your bag), the
  // caddie's advice for a bag, the CPU's, and what was given
  potions: JSON.parse(JSON.stringify(GL_POTIONS)), potionWhy: (id, ri) => GD ? glPotionWhy(GD.you, id, ri) : 'No game.', potion: (id, ri) => glPotion(id, ri),
  advice: (bag, ri) => glPotionAdvice(bag, ri), cpuPotion: (s, ri) => G ? glCpuPotion(s, ri) : '', get pots() { return G && G.pots ? G.pots.slice() : []; }, get bags() { return G && G.bags ? JSON.parse(JSON.stringify(G.bags)) : [null, null]; },
  gxOf: (s, ri) => G ? Object.assign({}, glGxOf(s, ri)) : {}, kitRules: Object.assign({}, GL_KIT),
  stand: GL_STAND, clubs: JSON.parse(JSON.stringify(GL_CLUBS)), lies: JSON.parse(JSON.stringify(GL_LIES)), swing: Object.assign({}, GL_SWING), skills: JSON.parse(JSON.stringify(GL_SKILL)),
  putting: Object.assign({}, GL_PUTT), cell: GL_CELL,
  course: i => G && G.cs != null ? glHoleAt(i) : glCourseHole(GL_STAND, i % 9, GL_RULES.par9[i % 9]),
  built: (seed, par) => glBuildHole(seed, par), wildPars: (cs, n) => glWildPars(cs, n), lie: (H, x, y) => glLie(H, x, y), slope: (H, x, y) => glSlope(H, x, y),
  reach: (club, lie, rat, pow) => glReach(club, lie, rat, pow), flight: s => glFlight(s), putt: p => glPutt(p), read: (H, from, k) => glRead(H, from, k == null ? 1 : k),
  plan: (s, line) => glPlan(s, null, line), turn: () => glTurn(), summary: () => G && G.teams ? glSummary() : null, simGame: o => glSimGame(o),
  // the hole inspector (13-inspect.js): what is at a point of the hole, and everything on it, in plain words
  look: (x, y) => glLookAt(x, y), holeGuide: () => glHoleGuide(), spots: () => glLookSpots().map(o => Object.assign({}, o)),
  set onShot(f) { GL_HOOK.onShot = f; }, get onShot() { return GL_HOOK.onShot; }, set onOver(f) { GL_HOOK.onOver = f; }, get onOver() { return GL_HOOK.onOver; },
  start: o => { glStart(o); glPlayStart(o || {}); return G; },
  show: () => glShow(), hide: () => glHide(), get on() { return GLP.on; }, render: () => glRender(0),
  pause: on => { GLP.paused = !!on; }, get paused() { return GLP.paused; }, get speed() { return GLP.speed; }, set speed(n) { GLP.speed = clamp(Math.round(n) || 1, 1, 8); },
  get shown() { return GD && GD.disp ? { h: GD.disp.h, match: GD.disp.match, won: GD.disp.won.slice(), over: GD.disp.over } : null; },
  get phase() { return GD ? GD.ph : null; }, get msg() { return GD ? GD.msg : ''; }, get mode() { return GD ? GD.mode : null; }, get you() { return GD ? GD.you : 0; },
  get view() { return GD ? JSON.parse(JSON.stringify({ ph: GD.ph, mode: GD.mode, you: GD.you, sel: GD.sel, meter: GD.meter, swung: GD.swung, last: GD.last, cpu: GD.cpu, hitters: GD.ph === 'aim' ? glHitters(GD.you) : [], clubs: GD.ph === 'aim' ? glClubsNow() : [], h: GD.disp ? GD.disp.h : 0 })) : null; },
  tick: dt => glTick(dt == null ? 0.05 : dt), select: o => glSelect(o), aimAt: (x, y) => glAimAt(x, y), aimTurn: d => glAimTurn(d), aimPush: y => glAimPush(y),
  press: () => glPress(), drag: (p, d) => glDrag(p, d), offer: g => glOffer(!!g), setMode: m => glSetMode(m),
  swingNums: (pow, m, rat) => glSwingNums(pow, m, rat || GL_DEF_RAT), win: (rat, pow, f) => glWin(rat || GL_DEF_RAT, pow || 1, f), readLine: () => glReadLine(), readLen: () => glReadLen(),
  meterRules: Object.assign({}, GL_METER), pace: Object.assign({}, GL_PACE), hands: Object.assign({}, GL_HANDS), shapes: JSON.parse(JSON.stringify(GL_SHAPES)), trajs: JSON.parse(JSON.stringify(GL_TRAJ)),
  scr: (x, y) => glScr(x, y), unscr: (sx, sy) => glUnscr(sx, sy), cam: () => Object.assign({}, GLC), animBall: () => glAnimBall(),
  set onPhase(f) { GL_HOOK.onPhase = f; }, get onPhase() { return GL_HOOK.onPhase; }, set onPick(f) { GL_HOOK.onPick = f; }, get onPick() { return GL_HOOK.onPick; },
};
