/* the end of the wHK scope: what the Realm may call (w19b-engines.js, w88-rink.js). Phase 0 is the rules; phase 1
   plays one game, CPU against CPU. start(opts) puts a game on the rink ({ teams: [2], mins, seed }), never paused;
   simGame(opts) plays one headless and returns its summary ({ score, teams, win, p, ot, so, mins, shots, drops, secs,
   box, log, pens, watch }); onPhase hears each beat (intro, set, drop, live, dead, break, so, over) and onOver the end, with
   the summary. The tests' handles: G, the rules and the pure rule functions, step (one beat of the play), play (the
   live play, L), ev (its events), shotOdds, goalSet, goalSpot and scr (where a rink point is drawn),
   and skate, goalieStep, puckStep and loose, which move one thing on its own. */
return {
  newGame: hkNewGame, goal: hkGoal, run: dt => hkRun(dt), penalty: hkPenalty, strength: hkStrength, short: hkShort, minor: hkMinor, icingOn: hkIcingOn,
  periodEnd: hkPeriodEnd, soTurn: hkSoTurn, soShot: hkSoShot, dir: hkDir, goalX: hkGoalX, up: hkUp, periodName: hkPeriodName, get G() { return G; }, rules: JSON.parse(JSON.stringify(HK_RULES)),
  start: o => { HKP.paused = false; return hkStart(o); }, simGame: o => hkSimGame(o), show: hkShow, hide: hkHide, render: hkRender, summary: () => G && G.teams ? hkSummary() : null, box: () => G && G.teams ? hkBox() : null,
  get on() { return HKP.on; }, get speed() { return HKP.speed; }, set speed(n) { HKP.speed = Math.max(1, Math.min(8, Math.round(n) || 1)); },
  get live() { return !!GD && GD.ph !== 'over'; }, get phase() { return GD ? GD.ph : null; }, get msg() { return GD ? GD.msg : ''; }, clock: () => G && GD ? { p: G.p, name: GD.ph === 'so' ? 'Shootout' : hkPeriodName(G.p), text: hkClockText() } : null,
  pause: on => { HKP.paused = !!on; }, get paused() { return HKP.paused; },
  set onOver(f) { HK_HOOK.onOver = f; }, get onOver() { return HK_HOOK.onOver; }, set onPhase(f) { HK_HOOK.onPhase = f; }, get onPhase() { return HK_HOOK.onPhase; },
  // by hand (phase 2): who plays it ('watch' or 'play'), your keys (input: { steer, shoot, pass, lift, act }; returns
  // what happened), whether you have the puck, the skater you play, the wind-up ({ t, kind, pow }), the last release
  // ({ kind, aim, pow, t }), the last face-off ({ edge, win }), the hands' rules, what aiming at a target does, and the camera
  setMode: m => hkSetMode(m), get mode() { return GD ? GD.mode : null; }, get you() { return GD ? GD.you : 0; }, input: o => hkInput(o || {}), get inputState() { return JSON.parse(JSON.stringify(HKI)); },
  get puckMine() { return !!GD && !!L && hkPuckMine(); }, get me() { return L && GD ? hkMe() : -1; },
  get meter() { const M = GD && GD.meter; return M ? { i: M.i, t: M.t, kind: M.t < HK_HANDS.tap ? 'wrist' : 'slap', pow: hkPower(M.t) } : null; },
  get release() { return GD && GD.rel ? JSON.parse(JSON.stringify(GD.rel)) : null; }, get drew() { return GD && GD.drew ? Object.assign({}, GD.drew) : null; }, get press() { return GD ? GD.press : null; },
  hands: Object.assign({}, HK_HANDS), pace: Object.assign({}, HK_PACE), aimFx: (side, t) => L ? hkAimFx(side, t) : null, aimTarget: dir => hkAimTarget(dir), power: t => hkPower(t),
  shot: () => L && L.puck.shot ? JSON.parse(JSON.stringify(L.puck.shot)) : null, give: i => { if (L) hkGain(i, 'test'); }, passTo: j => { if (L && hkHand() >= 0) hkPass(j); },
  cam: () => ({ u: HKT.cam.u, end: HKT.cam.end, k: HKC.k, left: HKC.left }), camRules: Object.assign({}, HK_CAM),
  // penalties and the goalie (phase 3): the fouls' odds, the penalty that is coming, whether a goalie is in their net and
  // why not, who takes a side's face-offs, the shootout's try now; the tests' handles: a foul by player i, the fouls' odds
  // changed, a goal by player i, a pull, the lines set again
  fouls: Object.assign({}, HK_FOUL), pullRules: Object.assign({}, HK_PULL), get delay() { return GD && GD.delay ? Object.assign({}, GD.delay) : null; },
  inNet: side => !!L && hkInNet(side), pulled: side => L ? L.pl[hkGk(side)].pulled || '' : '', taker: side => L ? hkTaker(side) : -1,
  get soTry() { const U = GD && GD.so && GD.so.cur; return U ? { side: U.side, i: U.i, gi: U.gi, st: U.st, scored: U.scored, win: U.win } : null; },
  foul: (i, k) => { if (L) hkFoul(L.pl[i], k || 'tripping', null); }, setFouls: o => Object.assign(HK_FOUL, o || {}),
  goalBy: i => { if (!L) return; const p = L.pl[i]; hkGoalScored({ i, side: p.side, kind: 'wrist', gx: hkGoalX(p.side), dir: hkDir(p.side), dist: 5, touch: [], en: !hkInNet(1 - p.side) }); }, pull: (side, why) => !!L && hkPull(side, why || 'hand'), lines: () => { if (L) hkLines(); },
  // the ratings, the spots and the clubs, for the page and How to play
  rate: kind => hkRate(kind), kinds: Object.keys(HK_KIND), stats: HK_STATS.slice(), pos: HK_POS.slice(), roles: Object.assign({}, HK_ROLE), team: t => JSON.parse(JSON.stringify(hkTeam(t))),
  // the test's handle on the rink: one step of the play (or of whatever beat is on), the play, its events, a shot's odds
  step: n => { for (let i = 0; i < (n || 1) && GD && GD.ph !== 'over'; i++) hkTick(HK_DT); return GD ? GD.ph : null; },
  get play() { return L; }, get ev() { return L ? L.ev : []; }, scr: (x, y) => hkScrCam(x, y),
  shotOdds: (i, kind, x, y) => L ? hkShotOdds(L.pl[i], kind || 'wrist', x == null ? L.pl[i].x : x, y == null ? L.pl[i].y : y) : null,
  goalSet: (side, x, y) => L ? hkSet(L.pl[hkGk(side)], x, y) : null, goalSpot: (side, x, y) => hkGoalSpot(side, x, y), goalieStep: (side, dt) => { if (L) hkGoalie(L.pl[hkGk(side)], dt || HK_DT); },
  skate: (i, x, y, dt) => { if (L) hkSkate(L.pl[i], i, x, y, dt || HK_DT); }, puckStep: dt => { if (L) hkPuck(dt || HK_DT); }, loose: (x, y, a, v) => { if (L) hkLoose(x, y, a, v); },
};
