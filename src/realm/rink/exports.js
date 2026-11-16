/* the end of the wHK scope: what the Realm may call (w19b-engines.js, w88-rink.js). Phase 0 is the rules; phase 1
   plays one game, CPU against CPU. start(opts) puts a game on the rink ({ teams: [2], mins, seed }), never paused;
   simGame(opts) plays one headless and returns its summary ({ score, teams, win, p, ot, so, mins, shots, drops, secs,
   box, log, watch }); onPhase hears each beat (intro, set, drop, live, dead, break, so, over) and onOver the end, with
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
  // the ratings, the spots and the clubs, for the page and How to play
  rate: kind => hkRate(kind), kinds: Object.keys(HK_KIND), stats: HK_STATS.slice(), pos: HK_POS.slice(), roles: Object.assign({}, HK_ROLE), team: t => JSON.parse(JSON.stringify(hkTeam(t))),
  // the test's handle on the rink: one step of the play (or of whatever beat is on), the play, its events, a shot's odds
  step: n => { for (let i = 0; i < (n || 1) && GD && GD.ph !== 'over'; i++) hkTick(HK_DT); return GD ? GD.ph : null; },
  get play() { return L; }, get ev() { return L ? L.ev : []; }, scr: (x, y) => hkScr(x, y),
  shotOdds: (i, kind, x, y) => L ? hkShotOdds(L.pl[i], kind || 'wrist', x == null ? L.pl[i].x : x, y == null ? L.pl[i].y : y) : null,
  goalSet: (side, x, y) => L ? hkSet(L.pl[hkGk(side)], x, y) : null, goalSpot: (side, x, y) => hkGoalSpot(side, x, y), goalieStep: (side, dt) => { if (L) hkGoalie(L.pl[hkGk(side)], dt || HK_DT); },
  skate: (i, x, y, dt) => { if (L) hkSkate(L.pl[i], i, x, y, dt || HK_DT); }, puckStep: dt => { if (L) hkPuck(dt || HK_DT); }, loose: (x, y, a, v) => { if (L) hkLoose(x, y, a, v); },
};
