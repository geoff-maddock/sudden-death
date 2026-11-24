/* the end of the wJT scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newMatch(opts) starts a
   match ({ courses: 3 | 5, riders: [each side's two riders, as roster indexes], roster: [two roster sizes], best:
   [the slot, 0 or 1, of each side's rider for the tilt for the crown; left out, the one who scored more] }); riders()
   (who rides the course now, a roster index a side; null when over), inTilt, left (courses still to ride this heat),
   course([side 0's strike, side 1's]) scores a course (a strike is { at, unhorse }: at one of rules.pts' keys; ends a
   heat on an unhorsing or its last course, starts the tilt when level, ends the match, and says so), whyNot(res);
   strikePts, fair, foul and atText read a strike; heatTotal(s, h), total(s), board() (the tourney board), matchText(s).
   rules and at (the herald's words) are the tables. G is the match, plain JSON. The page comes in phase 2: until then
   the lists are never on.
   Phase 1 is the course model and one match, CPU against CPU: lists, plan, mounts, zones, stats, skills (the tables),
   rate(kind) and rs(kind) (a kind's ratings, 1 to 12 and 0 to 1), zoneAt(x, y, guard), edge; the pure model, every
   random number from the rnd passed in (Math.random when left out; planRules is the plan table): sway(o) and speed(o), charge(o, rnd) (a CPU
   rider's ride), strike(a, d, rnd), seat(st, d, lean, rnd), impact(rides, leans, rnd); start(opts) puts a match on
   the lists ({ courses, teams, riders, best, skill: [2], mounts, seed }), turn() rides the next course, rideCourse(plans,
   rides, leans) one with any side's ride or lean given, plan(s) the CPU's plan, summary(), simMatch(opts) a whole
   match headless (the match on the lists and the random stream left as they were). */
return {
  rules: JSON.parse(JSON.stringify(JT_RULES)), at: JSON.parse(JSON.stringify(JT_AT)), get G() { return G; },
  newMatch: o => jtNewMatch(o), riders: () => jtRiders(), inTilt: () => jtInTilt(), left: () => jtLeft(),
  course: res => jtCourse(res), whyNot: res => jtWhyNot(res),
  strikePts: st => jtStrikePts(st), fair: at => jtFair(at), foul: at => jtFoul(at), atText: st => jtAtText(st),
  heatTotal: (s, h) => jtHeatTotal(s, h), total: s => jtTotal(s), board: () => jtBoard(), matchText: s => jtMatchText(s),
  // the course model and a match (phase 1)
  lists: JSON.parse(JSON.stringify(JT_LISTS)), planRules: JSON.parse(JSON.stringify(JT_PLAN)), mounts: JSON.parse(JSON.stringify(JT_MOUNT)), zones: JSON.parse(JSON.stringify(JT_ZONE)),
  stats: JT_STATS.slice(), skills: JSON.parse(JSON.stringify(JT_SKILL)), model: { sway: JT_SWAY, brk: JT_BREAK, rock: JT_ROCK, seat: JT_SEAT },
  rate: k => jtRate(k), rs: k => jtRs(k), zoneAt: (x, y, g) => jtZoneAt(x, y, g), edge: (z, x, y, g) => jtEdge(z, x, y, g),
  sway: o => jtSway(o), speed: o => jtSpeed(o), charge: (o, rnd) => jtCharge(o, rnd || Math.random), strike: (a, d, rnd) => jtStrike(a, d, rnd || Math.random),
  seat: (st, d, lean, rnd) => jtSeat(st, d, lean, rnd || Math.random), impact: (rides, leans, rnd) => jtImpact(rides, leans || [.5, .5], rnd || Math.random),
  start: o => jtStart(o), turn: () => jtTurn(), rideCourse: (p, r, l) => G && G.teams ? jtRideCourse(p, r, l) : null, plan: s => G && G.teams && !G.over ? jtPlan(s) : null,
  summary: () => jtSummary(), simMatch: o => jtSimMatch(o),
  show: () => {}, hide: () => {}, get on() { return false; }
};
