/* the end of the wCR scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ ends: 4 | 6 | 8, order: [two orders of four], roster: [two roster sizes], hammer: the side with the first
   end's hammer, fgz: false for no free guard zone }); up (whose stone it is), thrower (who throws side s's stone now),
   pos (their position, 0 lead to 3 skip), sideNo (side s's stone number this end), throw(side, after, { hit }) (the stones in
   play once it stopped, and whether it touched one; applies the free guard zone, scores the end after its sixteenth stone, and says so), whyNot;
   scoreEnd(stones), inHouse, inFgz, inPlay (a thrown stone's: wholly past the hog line and on the sheet), onSheet
   (a stone already in play: it stays short of the hog line) and dist read where stones are; total, board (the scoreboard), matchText.
   rules and sheet are the tables. G is the game, plain JSON.
   Phase 1 is the stone, the ice and one game, CPU against CPU: stoneRules, iceRules, colds, skills, shots (the tables);
   iceNew, iceAt and wear (the pebble); run(stones, throw, opts) the pure stone model (one stone thrown among the others
   to rest), alone(throw, ice, cold, sweep) a stone on its own, solveDraw(x, y, h, ice, cold) and solveHit(x, y, v, h,
   ice, cold) the aim; value(stones, side, kAfter, hammer, skill) what a result is worth to a skip, plan(side) the
   CPU's call; start(opts) puts a game on the ice ({ ends, teams, order, skill: [2], hammer, cold, fgz, seed }), turn()
   throws the next stone, throwStone(side, plan, release, sweep) one as released (both refused, rule.ok false and plan
   null with nothing changed, when the stone isn't theirs or the page has one called or sliding), summary() is the game so far,
   simGame(opts) a whole game headless.
   Phase 2 is the page and throwing by hand: start(opts) also puts the game on show ({ mode: 'watch' | 'play' }), and
   show, hide, on, pause, paused, speed and render drive the canvas (n1-page.js). The beat: phase, msg, view (a copy of
   what the page needs), tick(dt), live (the stone sliding now). Your stone: select({ shot, x, y, h, target, suggest
   }), press (Space: start, then the weight), drag(pull, deg) (the phone's throw), sweep (held: true while you hold
   Space), setMode; playRules (the meter, the pace); scr, unscr, houseScr and houseUn map the ice to the pictures and
   back. onPhase, onPick and onOver hear a new beat, a change to your call and the end.
   Phase 3 is ratings, positions, the sweepers' legs and nerve: stats (the six, in order), rate(kind) (1 to 12), cap,
   fit(r, pos) (r 0 to 1, pos 0 lead to 3 skip), autoOrder(roster), legs (G.legs), pressure(side), sweepers(side) (who
   sweeps the stone now), sweepEff(side) (how hard they sweep against an average fresh pair: run's opts.legs applies it), errK(side, shot), and the
   tables reachRules and legsRules. A roster curler may bring r (1 to 12); a team may bring its order.
   Phase 4 is the call and the read: endValue(side, pts, next, skill) (an end's last stone by what it does to the
   game), reason(side, call) (why the skip calls it; plan(side) carries it as reason), readIn(side) (how far back from
   the house the side's skip reads the ice, inches), chart(canvas, side) (draws the ice chart: the pebble's wear and
   every stone's path this game, paths their count); onChart hears C.
   Phase 5 is games from the world: start({ hall: true }) gives the Shed's ways (hallRules: the frost, the sprites,
   Hennock's pebble; frostAt(x)); modes add manage (manage({ style: 'auto' | 'draw' | 'hit' }), mgr); snapshot() and
   resume(sn) keep a match between stones (plain JSON).
   Phase 6 is powers: start({ powers: true | [yours, theirs], powOnly }) (pow, pow2, ult, sit: the tables; manaRules,
   roarRules; powNow, powWhy, cast, castMine, fxFor, cpuPower, tip; autoPow, Manage's Auto powers).
   Phase 7 is gear and potions: a roster curler's { gear: { id, name, fx } } (gx: what the engine reads), start({ bags:
   [yours or null, theirs] }) (potions, kitRules; potion(id) yours, advice(bag), potionWhy(s, id), cpuPotion).
   Phase 8 is the superstars (in the tables) and the players drawn: figKinds() (the kinds the figures know), figsNow()
   (who is on the ice in view, 'broom' and 'sweeper', from the game as it stands with the camera where it is going). */
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
  start: o => { crStart(o); crPlayStart(o); CRC.drawn = false; return G; },
  // (the page owns a stone it is setting up or sliding: turn and throwStone wait for it)
  turn: () => { if (!G || !G.teams) return null; if (crPageBusy()) return crRefused(crUp(), 'A stone is being thrown on the page.'); const r = crTurn(GP && GP.mode === 'manage' && crUp() === GP.you ? GP.mgr.style : null); crPageStale(); return r; }, throwStone: (s, plan, rel, sweep) => { if (!G || !G.teams) return null; if (crPageBusy()) return crRefused(s, 'A stone is being thrown on the page.'); const r = crThrowStone(s, plan, rel, sweep); crPageStale(); return r; }, summary: () => crSummary(), simGame: o => crSimGame(o),
  // ratings, positions, legs and nerve (phase 3)
  stats: CR_STATS.slice(), rate: k => crRate(k), cap: CR_RCAP, fit: (r, pos) => crFit(r, pos), autoOrder: ro => crAutoOrder(ro.map(m => ({ rs: Object.fromEntries(CR_STATS.map(k => [k, crScale((m.r || crRate(m.kind))[k])])) }))),
  reachRules: Object.assign({}, CR_REACH), legsRules: Object.assign({}, CR_LEGS), get legs() { return G && G.legs ? G.legs.slice() : null; }, pressure: s => G && G.teams ? crPressure(s) : 0,
  sweepers: s => G && G.teams ? crSweepers(s) : [], sweepEff: s => G && G.teams ? crSweepEff(s) : 1, errK: (s, shot) => G && G.teams ? crErrK(s, shot) : null,
  // the page and throwing by hand (phase 2)
  modes: CR_MODES.slice(), playRules: JSON.parse(JSON.stringify(CR_PLAY)), get phase() { return GP ? GP.ph : null; }, get msg() { return GP ? GP.msg : ''; }, get view() { return crView(); }, get mode() { return GP ? GP.mode : null; },
  setMode: m => crSetMode(m), tick: dt => crTick(dt), select: o => crSelect(o), press: () => crPress(), drag: (pull, deg) => crDrag(pull, deg), set sweep(on) { CRP.sweepBtn = !!on; if (GP) GP.sweep = !!on && GP.ph === 'slide' && !!GP.X && crYours(GP.X.s); }, get sweep() { return !!(GP && GP.sweep); },
  scr: (x, y) => crScr(x, y), unscr: (sx, sy) => crUnscr(sx, sy), houseScr: (x, y) => crHouseScr(x, y), houseUn: (sx, sy) => crHouseUn(sx, sy), get last() { return GP && GP.last ? JSON.parse(JSON.stringify(GP.last)) : null; },
  get live() { const X = GP && GP.X; return X ? { s: X.s, t: X.Q.t, stone: { x: X.Q.T.x, y: X.Q.T.y, vx: X.Q.T.vx, vy: X.Q.T.vy }, sw: X.Q.sw, plan: X.plan } : null; },
  // the call and the read (phase 4)
  endValue: (s, pts, next, sk) => G && G.teams ? crEndValue(s, pts, next, sk) : 0, reason: (s, c) => G && G.teams ? crReason(s, c) : '', readIn: s => G && G.teams ? crReadIn(s) : 0,
  chart: (cv, s) => { if (!G || !G.teams || !cv) return false; const c = cv.getContext('2d'); crChart(c, s, cv.width, cv.height, GP ? GP.paths : []); return true; }, get paths() { return GP ? GP.paths.length : 0; },
  set onChart(f) { CR_HOOK.onChart = f; }, get onChart() { return CR_HOOK.onChart; },
  // powers (phase 6)
  pow: CR_POW, pow2: CR_POW2, ult: CR_ULT, sit: CR_SIT, manaRules: CR_MANA, roarRules: CR_ROAR, fx0: CR_FX0, granite: CR_GRANITE,
  powNow: (s, ri, shot) => G && G.powers ? crPowNow(s, ri, shot) : null, powWhy: (s, k, ri) => crPowWhy(s, k, ri), cast: (s, k, ri) => crCast(s, k, ri), castMine: k => crCastMine(k),
  fxFor: s => crFxFor(s), yourWt: p => GP ? crYourWt(p) : p, cpuPower: (s, shot) => crCpuPower(s, shot), tip: s => G && G.powers ? crPowerTip(s) : '',
  get autoPow() { return !!(GP && GP.autoPow); }, set autoPow(v) { if (GP) GP.autoPow = !!v; },
  // superstars and figures (phase 8)
  figKinds: () => Object.keys(KIND), figsNow: () => G && G.teams ? crFigsOn() : [],
  // gear and potions (phase 7)
  potions: JSON.parse(JSON.stringify(CR_POTIONS)), kitRules: JSON.parse(JSON.stringify(CR_KIT)), potion: id => crPotion(id), advice: bag => crPotionAdvice(bag), potionWhy: (s, id) => crPotionWhy(s, id), cpuPotion: (s, shot) => crCpuPotion(s, shot), gx: fx => crGx(fx),
  // games from the world (phase 5)
  hallRules: CR_HALL, frostAt: x => crFrostAt(x), snapshot: () => crSnapshot(), resume: sn => { const g = crResume(sn); CRC.drawn = false; return g; }, manage: o => crManage(o), get mgr() { return GP ? Object.assign({}, GP.mgr) : null; },
  set onPhase(f) { CR_HOOK.onPhase = f; }, set onPick(f) { CR_HOOK.onPick = f; }, set onOver(f) { CR_HOOK.onOver = f; }, get onPhase() { return CR_HOOK.onPhase; }, get onPick() { return CR_HOOK.onPick; }, get onOver() { return CR_HOOK.onOver; },
  show: () => crShow(), hide: () => crHide(), get on() { return CRP.on; }, render: dt => crRender(dt || 0),
  pause: on => { CRP.paused = !!on; }, get paused() { return CRP.paused; }, get speed() { return CRP.speed; }, set speed(n) { CRP.speed = clamp(Math.round(n) || 1, 1, 8); }
};
