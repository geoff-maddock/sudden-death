/* the end of the wBK scope: what the Realm may call (w19b-engines.js, w77-court.js). Phase 0 is the rules; phase 1
   plays one game, CPU against CPU. start(opts) puts a game on the court ({ teams: [2], mins, seed }), never paused; simGame(opts)
   plays one headless and returns its summary ({ score, teams, win, q, ot, mins, poss, secs, box, log, watch }); onPhase
   hears each beat (intro, live, dead, walk, ft, break, over) and onOver the end, with the summary. The tests' handles:
   G, the rules and the pure rule functions, step (one beat of the play), play (the live play, L), ev (its events). */
// a table's names and descriptions, by id
function bkNameDesc(T) { return Object.fromEntries(Object.entries(T).map(([k, v]) => [k, { n: v.n, desc: v.desc }])); }
return {
  newGame: bkNewGame, score: bkScore, shotValue: bkShotValue, run: (dt, hold) => bkRun(dt, hold), give: bkGive, violation: bkViolation, foul: bkFoul,
  periodEnd: bkPeriodEnd, dir: bkDir, hoopX: bkHoopX, periodName: bkPeriodName, get G() { return G; }, rules: JSON.parse(JSON.stringify(BK_RULES)),
  start: o => { BKP.paused = false; return bkStart(o); }, simGame: o => bkSimGame(o), show: bkShow, hide: bkHide, render: bkRender, summary: () => G && G.teams ? bkSummary() : null, box: () => G && G.teams ? bkBox() : null,
  get on() { return BKP.on; }, get speed() { return BKP.speed; }, set speed(n) { BKP.speed = Math.max(1, Math.min(8, Math.round(n) || 1)); },
  get live() { return !!GD && GD.ph !== 'over'; }, get phase() { return GD ? GD.ph : null; }, get msg() { return GD ? GD.msg : ''; }, clock: () => G && GD ? { q: G.q, name: bkPeriodName(G.q), text: bkClockText(), shot: Math.ceil(G.shot) } : null,
  pause: on => { BKP.paused = !!on; }, get paused() { return BKP.paused; },
  set onOver(f) { BK_HOOK.onOver = f; }, get onOver() { return BK_HOOK.onOver; }, set onPhase(f) { BK_HOOK.onPhase = f; }, get onPhase() { return BK_HOOK.onPhase; },
  // the ratings, the spots and the clubs, for the page and How to play
  rate: kind => bkRate(kind), fit: (r, pos) => bkFit(Object.assign(bkRate('goblin'), r), pos), kinds: Object.keys(BK_KIND), stats: BK_STATS.slice(), pos: BK_POS.slice(), roles: Object.assign({}, BK_ROLE), team: t => JSON.parse(JSON.stringify(bkTeam(t))),
  ftChance: r => bkFtChance({ r: Object.assign(bkRate('goblin'), r) }),
  // by hand (phase 2): who plays it ('watch' or 'play'), your keys (input: { steer, shoot, pass, box, act }; returns
  // what happened), whether you have the ball, the player you play, the release meter ({ t, T, now (0 to late), w, ft }),
  // the last release ({ e, w }), the hands' and the window's rules, a move's numbers, and whose hand is hot
  setMode: m => bkSetMode(m), get mode() { return GD ? GD.mode : null; }, get you() { return GD ? GD.you : 0; }, input: o => bkInput(o || {}), get inputState() { return JSON.parse(JSON.stringify(BKI)); },
  get offense() { return !!GD && !!L && bkOffenseMine(); }, get me() { return L && GD ? bkMe() : -1; },
  get meter() { const M = GD && GD.meter; if (!M) return null; const p = L.pl[M.ft ? GD.ft.i : M.i]; return { t: M.t, T: M.T, now: M.t / M.T, ft: !!M.ft, w: M.ft ? bkFtWindow(p) : bkWindow(M.pr, p) }; },
  get release() { return GD && GD.rel ? { e: GD.rel.e, w: GD.rel.w } : null; }, hands: Object.assign({}, BK_HANDS), win: Object.assign({}, BK_WIN), moves: JSON.parse(JSON.stringify(BK_MOVES)),
  fire: Object.assign({}, BK_FIRE), jump: Object.assign({}, BK_JUMP), hot: () => G && G.hot ? JSON.parse(JSON.stringify(G.hot)) : null, onFire: i => !!L && bkOnFire(L.pl[i]),
  handMake: (pr, e) => bkHandMake(pr, e, null), window: pr => bkWindow(pr, null),
  // the tests' handles on phase 2's plays: a hand shot let go e from the top, a pass (lob), a pick, a move, a jump, a swipe
  shootAt: e => bkHand() >= 0 ? (bkShoot({ e }), L.shot) : null, pass: (j, lob) => bkHand() >= 0 ? (bkPass(j, lob), true) : false, pick: i => bkPick(i == null ? bkHand() : i),
  move: k => bkMoveTry(bkHand(), k), freeThrows: (side, i, n) => bkFreeThrows(side, i, n), shot: () => L && L.shot ? Object.assign({}, L.shot) : null,
  // the call (phase 4): the sets, defenses, paces and pressures (by id: { n, desc }), a set against a defense ([+1|0|-1,
  // why]), your call (kind 'off' | 'def' | 'pace' | 'press'; '' or why not), both sides' calls and the possession's,
  // the scout, timeouts left and a timeout for your side ('' or why not), and the skill names
  sets: bkNameDesc(BK_SETS), defs: bkNameDesc(BK_DEFS), paces: bkNameDesc(BK_PACES), presses: bkNameDesc(BK_PRESSES), get ver() { return G && G.ver != null ? G.ver : -1; },
  edge: (o, d) => bkEdge(o, d).slice(), call: (kind, id, side) => G && G.call ? bkCall(side == null ? GD.you : side, kind, id) : 'No game on.',
  calls: () => G && G.call ? JSON.parse(JSON.stringify({ call: G.call, cur: G.cur, scout: G.scout, to: G.to, sets: G.setLog, skill: G.skill })) : null,
  timeout: side => G && G.to ? bkTimeout(side == null ? GD.you : side) : 'No game on.', skills: BK_SKILL.slice(), toRules: Object.assign({}, BK_TO),
  // save points and the ground (phase 5): a snapshot now, putting one back on the court, the hooks for each stoppage's
  // snapshot, and the Charter Court's state ({ wax, bent, roar }, or null away from it)
  snapshot: () => G && GD && G.teams ? bkSnapshot() : null, resume: sn => { BKP.paused = false; bkResume(sn); bkShow(); return G; },
  set wantSnap(f) { BK_HOOK.wantSnap = f; }, set onSnap(f) { BK_HOOK.onSnap = f; }, court: () => G && G.court ? JSON.parse(JSON.stringify(G.court)) : null,
  courtRules: { wax: Object.assign({}, BK_WAX), rim: Object.assign({}, BK_RIM), roar: Object.assign({}, BK_ROAR) },
  // stamina and the bench (phase 3): each side's stamina by roster index, who's on (roster indices in spot order) and
  // on the bench (in order), a swap by hand at a stoppage ('' or why not), how tired a player in the play is, the rules
  stam: () => G && G.stam ? JSON.parse(JSON.stringify(G.stam)) : null, onFloor: () => G && G.on ? JSON.parse(JSON.stringify(G.on)) : null, bench: side => G && G.on ? bkBench(side) : [],
  sub: (side, out, inn) => G && G.on ? bkSub(side, out, inn) : 'No game on.', tired: i => L ? bkTired(L.pl[i]) : 0, stamRules: Object.assign({}, BK_STAM),
  // the test's handle on the court: one step of the play (or of whatever beat is on), the play, its events, a shot's odds
  step: n => { for (let i = 0; i < (n || 1) && GD && GD.ph !== 'over'; i++) bkTick(BK_DT); return GD ? GD.ph : null; },
  get play() { return L; }, get ev() { return L ? L.ev : []; }, shotP: (i, x, y) => L ? bkShotP(L.pl[i], x == null ? L.pl[i].x : x, y == null ? L.pl[i].y : y) : null,
};
