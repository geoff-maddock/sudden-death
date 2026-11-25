/* The Tilting Lists: one match, CPU against CPU (issue #117, phase 1).
   jtStart(opts) puts a match on the lists: { courses, teams: [2 × { name, short, color, roster: [{ n, kind, rs? }] }],
   riders, best, skill: [2 skills, 0 to 2], mounts: [2 × [the two riders' mounts]], seed; lab only: planBy, handsBy
   (a skill a side, or null) and fix (a plan a side, or null), 05-cpu.js }. jtTurn() rides the next
   course (both plans, both rides, the impact and the seats, the rules) and says what happened; jtRideCourse(plans,
   rides, leans) is the same course with any side's ride or lean given (Play's, phase 2) and the rest drawn.
   jtSimMatch(opts) rides a whole match headless and leaves the match on the lists (and the random stream) as it was;
   jtSummary() is the match so far.
   The mount's wind (G.wind, 0 to 1 a side): each heat's riders start on fresh mounts; a course spends some (a gallop
   most, jtWindCost) and the mount gets a little back before the next (its rec). The tilt for the crown starts the
   best riders' mounts at JT_TILT_WIND.
   The box score (G.st by side, G.pst by rider): courses, lances broken, helm breaks, unhorsings (dealt), unhorsed,
   glances, misses, fouls, rocked by a broken lance, seats kept after one (by rider too from phase 3, and a squire's
   jobs done). Phase 3 (09-squad.js): each side's squires (G.squires), the rider's arm, a rocking hit's shake, the
   girth, and the corner between courses (jtCornersDue before a course, jtSquadAfter after one). G.plans keeps each side's plans (the
   herald's card and the Archmage's read, phase 4). G.last is the last course, for the page. */
const JT_TILT_WIND = .8;
let GB = null;   // the course between jtTurn() and the page's drawing (phase 2): not saved
function jtStart(opts) {
  const o = opts || {};
  if (o.seed != null) engSeed(o.seed);
  const teams = [0, 1].map(s => { const T = (o.teams && o.teams[s]) || { name: s ? 'Saltmere' : 'Mossgate', short: s ? 'SAL' : 'MOS', color: s ? '#2f7898' : '#3a5a9a' };
    const roster = (T.roster && T.roster.length >= JT_RULES.side ? T.roster : [0, 1, 2, 3].map(i => ({ n: `${T.short || 'P'} ${i + 1}`, kind: '' })))
      .map(p => jtRosterOne(p));
    return Object.assign({}, T, { roster }); });
  // (phase 3: riders left out are picked by the ratings when the roster brings its own (r); the best rider for the tilt,
  // left out, by nerve and lance, 09-squad.js)
  const riders0 = [0, 1].map(s => (o.riders || [])[s] || teams[s].riders || (teams[s].roster.some(m => m.r) ? jtAutoSquad(teams[s].roster).riders : null));
  jtNewMatch({ courses: o.courses, riders: riders0, roster: teams.map(T => T.roster.length), best: o.best });
  if (o.best == null) G.best = [0, 1].map(s => jtBestOf(teams[s].roster, G.riders[s]));
  const mounts = [0, 1].map(s => [0, 1].map(i => { const m = ((o.mounts || [])[s] || [])[i]; return jtOwn(JT_MOUNT, m) ? m : JT_MOUNT_DEF; }));
  // (lab only: a side planned by another skill's logic, ridden with another skill's hands, or held to one plan)
  const labSide = (L, ok) => Array.isArray(L) ? [0, 1].map(s => ok(L[s]) ? L[s] : null) : null, sk3 = v => v === 0 || v === 1 || v === 2;
  const fixOk = p => !!p && typeof p === 'object' && jtOwn(JT_PLAN.aim, p.aim) && jtOwn(JT_PLAN.guard, p.guard) && jtOwn(JT_PLAN.pace, p.pace);
  const lab = { planBy: labSide(o.planBy, v => sk3(v) || v === 'word'), handsBy: labSide(o.handsBy, sk3), fix: labSide(o.fix, fixOk), guard: labSide(o.guardBy, g => g === 'angled' || g === 'square') };
  if (lab.fix) lab.fix = lab.fix.map(p => p && { aim: p.aim, guard: p.guard, pace: p.pace });
  Object.assign(G, { teams, skill: [0, 1].map(s => clamp(((o.skill || [])[s] ?? 1) | 0, 0, 2)), mounts, wind: [1, 1], n: 0, lab,
    st: [jtBox(), jtBox()], pst: teams.map(T => T.roster.map(() => ({ courses: 0, breaks: 0, helms: 0, unhorse: 0, unhorsed: 0, rocked: 0, kept: 0, fouls: 0, jobs: 0 }))), plans: [[], []], last: null });
  jtSquadStart(o, teams);
  GB = null;
  return G;
}
const jtBox = () => ({ courses: 0, breaks: 0, helms: 0, unhorse: 0, unhorsed: 0, glances: 0, misses: 0, fouls: 0, rocked: 0, kept: 0 });
// the mount side s rides now (the heat's rider's; in the tilt, the best rider's)
function jtMountOf(s) { const ri = (jtRiders() || [])[s]; const slot = G.riders[s].indexOf(ri); return G.mounts[s][slot < 0 ? 0 : slot]; }
const jtRsOf = (s, ri) => G.teams[s].roster[ri].rs;
// the next course, CPU against CPU: { heat, course, tilt, riders, plans, rides, imp, rule } or null when the match is over
function jtTurn() {
  if (!G || G.over) return null;
  jtCornersDue();
  // (phase 6: with powers, each side casts after both plans are made)
  const plans = [jtPlan(0), jtPlan(1)];
  if (G.powers) [0, 1].forEach(s => jtCpuPower(s, plans[s]));
  return jtRideCourse(plans);
}
function jtRideCourse(plans, given, leans) { const P = jtCourseOpen(plans, given, leans); return P ? jtCourseClose(P) : null; }
/* a course in two halves, so Play can hold the seat until your balance moment: jtCourseOpen draws any ride not given
   (and each lean not given, unless wait[s] holds it back for the close), and strikes both lances; jtCourseClose(P,
   leans) takes the held leans, decides both seats, scores the course and keeps the box score. The random numbers
   come in the same order as jtImpact's: the rides, the leans, the two strikes, the two seats. P is plain data. */
// (rnd: a stream of its own for the strikes, as a course ridden out on a resume uses: phase 6's review)
function jtCourseOpen(plans, given, leans, wait, rnd) {
  const riders = jtRiders(); if (!riders) return null;
  jtCornersDue();
  const rides = [0, 1].map(s => (given && given[s]) || jtCharge(jtRideOpts(s, plans[s]), R));
  const lean = [0, 1].map(s => leans && leans[s] != null ? leans[s] : wait && wait[s] ? null : jtLean(s));
  const rr = rnd || R, st = [jtStrike(rides[0], rides[1], rr), jtStrike(rides[1], rides[0], rr)];
  return { heat: G.heat, course: G.course, tilt: jtInTilt(), riders, plans, rides, lean, st, n: G.n };
}
function jtCourseClose(P, leans, rnd) {
  if (!P || P.n !== G.n || G.over) return null;
  const { heat, course, tilt, riders, plans, rides, st } = P, lean = [0, 1].map(s => leans && leans[s] != null ? clamp(+leans[s] || 0, 0, 1) : P.lean[s] != null ? P.lean[s] : .5);
  const rr = rnd || R, seat = [jtSeat(st[1], rides[0], lean[0], rr, st[0]), jtSeat(st[0], rides[1], lean[1], rr, st[1])];
  const imp = { res: [0, 1].map(s => ({ at: st[s].at, unhorse: seat[1 - s].unhorse })), st, seat };
  const lead = [0, 1].map(s => jtTotal(s) - jtTotal(1 - s)), rule = jtCourse(imp.res);
  // the mounts: the course's wind spent, a little back before the next; fresh mounts for a new heat
  [0, 1].forEach(s => { const M = jtMount(rides[s].mount); G.wind[s] = clamp(G.wind[s] - jtWindCost(rides[s].pace, rides[s].rs, rides[s].mount) * (rides[s].fx ? rides[s].fx.wind : 1) + M.rec * (.6 + .4 * (rides[s].rs.ride ?? .5)), 0, 1); });
  if (rule.tiltNow) G.wind = [JT_TILT_WIND, JT_TILT_WIND]; else if (rule.heatOver) G.wind = [1, 1];
  // the rider's arm, a rocking hit's shake, the girth, and the squires' corner before the next course (09-squad.js)
  jtSquadAfter(rides, imp, rule);
  // the powers' mana and cheer, and what the course spent (12-powers.js)
  jtPowersAfter(rides, imp, rule);
  // the box score
  [0, 1].forEach(s => {
    const B = G.st[s], Pp = G.pst[s][riders[s]], sk = imp.st[s], se = imp.seat[s];
    B.courses++; Pp.courses++;
    if (sk.broke) { B.breaks++; Pp.breaks++; if (sk.zone === 'helm') { B.helms++; Pp.helms++; } }
    else if (sk.at === 'glance') B.glances++; else if (sk.at === 'miss') B.misses++; else { B.fouls++; Pp.fouls = (Pp.fouls || 0) + 1; }
    if (imp.res[s].unhorse) { B.unhorse++; Pp.unhorse++; G.st[1 - s].unhorsed++; const Q = G.pst[1 - s][riders[1 - s]]; Q.unhorsed = (Q.unhorsed || 0) + 1; }
    if (se.rocked) { B.rocked++; Pp.rocked = (Pp.rocked || 0) + 1; if (!se.unhorse) { B.kept++; Pp.kept = (Pp.kept || 0) + 1; } }
    G.plans[s].push({ aim: plans[s].aim, guard: plans[s].guard, pace: plans[s].pace, why: plans[s].why || '', heat, course, at: sk.at, lead: lead[s], ri: riders[s], tilt });
  });
  G.n++;
  const ev = { heat, course, tilt, riders, plans, rides, lean, imp, rule };
  G.last = { heat, course, tilt, riders, plans: plans.map(p => ({ aim: p.aim, guard: p.guard, pace: p.pace })), res: imp.res, pts: rule.pts, zone: st.map(x => x.zone) };
  GB = ev;
  return ev;
}
function jtSummary() {
  if (!G) return null;
  return { over: G.over, board: jtBoard(), st: JSON.parse(JSON.stringify(G.st)), pst: JSON.parse(JSON.stringify(G.pst)), teams: G.teams.map(T => ({ name: T.name, roster: T.roster.map(m => m.n) })),
    tot: [jtTotal(0), jtTotal(1)], log: JSON.parse(JSON.stringify(G.log)), skill: G.skill.slice(), mounts: JSON.parse(JSON.stringify(G.mounts)), courses: G.n, tilt: G.tilt[0].length };
}
// a whole match headless: leaves the match on the lists, and the random stream, as they were
function jtSimMatch(opts) {
  const keep = G, keepB = GB, keepR = engRand;
  if (!opts || opts.seed == null) engRand = engRng((Math.random() * 4294967296) >>> 0);
  try {
    jtStart(opts);
    let n = 0; while (!G.over && n++ < 200) jtTurn();
    return Object.assign({ win: G.over ? G.over.win : -1 }, jtSummary());
  } finally { G = keep; GB = keepB; engRand = keepR; }
}
