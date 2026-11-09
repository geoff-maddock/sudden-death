/* the end of the wBK scope: what the Realm may call (w19b-engines.js, w77-court.js). Phase 0 is the rules; phase 1
   plays one game, CPU against CPU. start(opts) puts a game on the court ({ teams: [2], mins, seed }), never paused; simGame(opts)
   plays one headless and returns its summary ({ score, teams, win, q, ot, mins, poss, secs, box, log, watch }); onPhase
   hears each beat (intro, live, dead, walk, ft, break, over) and onOver the end, with the summary. The tests' handles:
   G, the rules and the pure rule functions, step (one beat of the play), play (the live play, L), ev (its events). */
return {
  newGame: bkNewGame, score: bkScore, shotValue: bkShotValue, run: (dt, hold) => bkRun(dt, hold), give: bkGive, violation: bkViolation, foul: bkFoul,
  periodEnd: bkPeriodEnd, dir: bkDir, hoopX: bkHoopX, periodName: bkPeriodName, get G() { return G; }, rules: JSON.parse(JSON.stringify(BK_RULES)),
  start: o => { BKP.paused = false; return bkStart(o); }, simGame: o => bkSimGame(o), show: bkShow, hide: bkHide, render: bkRender, summary: () => G && G.teams ? bkSummary() : null, box: () => G && G.teams ? bkBox() : null,
  get on() { return BKP.on; }, get speed() { return BKP.speed; }, set speed(n) { BKP.speed = Math.max(1, Math.min(8, Math.round(n) || 1)); },
  get live() { return !!GD && GD.ph !== 'over'; }, get phase() { return GD ? GD.ph : null; }, get msg() { return GD ? GD.msg : ''; }, clock: () => G && GD ? { q: G.q, name: bkPeriodName(G.q), text: bkClockText(), shot: Math.ceil(G.shot) } : null,
  pause: on => { BKP.paused = !!on; }, get paused() { return BKP.paused; },
  set onOver(f) { BK_HOOK.onOver = f; }, get onOver() { return BK_HOOK.onOver; }, set onPhase(f) { BK_HOOK.onPhase = f; }, get onPhase() { return BK_HOOK.onPhase; },
  // the ratings, the spots and the clubs, for the page and How to play
  rate: kind => bkRate(kind), kinds: Object.keys(BK_KIND), stats: BK_STATS.slice(), pos: BK_POS.slice(), roles: Object.assign({}, BK_ROLE), team: t => JSON.parse(JSON.stringify(bkTeam(t))),
  ftChance: r => bkFtChance({ r: Object.assign(bkRate('goblin'), r) }),
  // the test's handle on the court: one step of the play (or of whatever beat is on), the play, its events, a shot's odds
  step: n => { for (let i = 0; i < (n || 1) && GD && GD.ph !== 'over'; i++) bkTick(BK_DT); return GD ? GD.ph : null; },
  get play() { return L; }, get ev() { return L ? L.ev : []; }, shotP: (i, x, y) => L ? bkShotP(L.pl[i], x == null ? L.pl[i].x : x, y == null ? L.pl[i].y : y) : null,
};
