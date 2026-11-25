/* The Tilting Lists: the four and their roles, the rider's arm, a rocking hit's shake, the squires' corner, pressure and
   nerve (issue #117, phase 3).

   The four (JT_RULES.side): two ride (G.riders, the first side's first rider in the first heat) and two squire
   (G.squires). How well ratings suit each role (jtFit, 0 to 1): a rider's lance most, then the seat, the couch, the
   shield and the ride, a little nerve; a squire's care, and the ride (they know a horse). jtAutoSquad picks: the two
   best riders (the steadier nerve of the two rides the second heat, when the match hangs on it), then the two best
   squires of the rest. The best rider for the tilt for the crown (jtBestOf): nerve and lance, as phase 0's best.
   Over a heat (G.wind, G.arm, G.shaken and G.girth, a side each; the next heat's rider starts fresh):
   - the mount's wind (06-game.js): a course spends some, a gallop most; a little comes back between courses;
   - the rider's arm (JT_ARM): every couch tires it, an early one (a long hold) most; a rider with a good couch rating
     tires less. A tired arm sways more, and the tip droops and sags;
   - the shake (JT_SHAKE): a rider rocked by a broken lance who keeps the seat is shaken for the next course (more
     sway, a worse seat); left alone, most of it wears off by the course after;
   - the girth (a squire's job): a better seat for the next course only.
   The corner (G.cornerDue): between two courses with the same riders (in a heat, and in the tilt), each side's two
   squires do one job each, two of the three (JT_JOB): tend the mount (a share of its lost wind back), steady the rider
   (a share of the shake gone and of the arm's strength back) or tighten the girth (the seat next course). A squire's
   care sets how much (jtJobAmt), so a fresh mount needs no tending and an unshaken rider little steadying. The
   corner is chosen by the side: on Play by you, your corner suggesting; the CPU by its skill (jtCornerPlan):
   - a Squire's corner picks two jobs at random;
   - a Knight's works out each way of sharing two jobs between its two squires on the model (jtCornerM: the next
     course ridden from the state the jobs leave, against the plan a Knight would ride, and what lasts, the wind and
     the arm, for one more course), and takes the best;
   - an Archmage's does the same against the plan the other side will really ride (its own skill's).
   Every corner is logged with its reason (G.corners).
   Pressure (jtPressure, 0 or 1): the last course of a heat when the side is behind in the match, and every course of
   the tilt for the crown. Nerve takes it off (jtNerveK): the tip sways more and the couch's timing scatters, less for
   a steady nerve; a perfect nerve feels nothing.
   Lab only: G.lab.cornerBy (a skill a side, or 'none': no corner at all; or a job to leave out: 'no-tend' and so on). */
const JT_ROLE = {
  rider: { lance: .3, couch: .14, seat: .22, shield: .12, ride: .14, nerve: .08 },
  squire: { care: .75, ride: .25 }
};
const JT_ARM = { cost: .07, early: .35, couchR: .5, back: .03, sway: .3, droop: .6, sag: 3, tilt: .85 };
const JT_SHAKE = { sway: .5, seat: .2, fade: .4 };
const JT_NERVE = { k: .6 };
const JT_JOB = {
  tend: { n: 'Tend the mount', v: 'tends the mount', a: .35, b: .35 },
  steady: { n: 'Steady the rider', v: 'steadies the rider', a: .5, b: .5, arm: [.3, .3] },
  girth: { n: 'Tighten the girth', v: 'tightens the girth', a: .03, b: .07 }
};
const JT_JOBS = Object.keys(JT_JOB);
// the CPU's corner works out each job on the model (jtCornerM): n courses on a stream of its own (seed); what lasts (the
// wind, the arm) counts last for the course after; an unhorsing costs heat for each course left; plain is the plan
// it reckons for a rider whose plan is anything
const JT_CORNER = { n: 240, seed: 1171, last: .8, heat: .6, plain: { aim: 'shield', guard: 'square', pace: 'canter' } };

/* ---------- the four and their roles ---------- */
// a roster member as the engine takes one: r (1 to 12, the rest from the kind) when brought, else rs (0 to 1), else the kind's
function jtRosterOne(p) {
  const m = Object.assign({}, p);
  if (p.r && typeof p.r === 'object') {
    const r = jtRate(p.kind); for (const k of JT_STATS) if (jtOwn(p.r, k) && Number.isFinite(+p.r[k])) r[k] = +p.r[k];
    m.r = r; m.rs = Object.fromEntries(JT_STATS.map(k => [k, jtScale(r[k])]));
  } else m.rs = p.rs && typeof p.rs === 'object' ? Object.assign(jtRs(p.kind), p.rs) : jtRs(p.kind);
  return m;
}
// how well ratings (0 to 1) suit a role ('rider' or 'squire'), 0 to 1
function jtFit(rs, role) { const W = JT_ROLE[role === 'squire' ? 'squire' : 'rider'], r = rs || {}; let v = 0; for (const k in W) v += W[k] * (r[k] ?? .5); return v; }
// the captain's pick for a roster (each with rs): { riders: [heat 1's, heat 2's], squires: [two] }, roster indexes
function jtAutoSquad(roster) {
  const ix = roster.map((_, i) => i), rs = i => roster[i].rs || jtRs(roster[i].kind);
  const by = role => (a, b) => jtFit(rs(b), role) - jtFit(rs(a), role) || a - b;
  const two = ix.slice().sort(by('rider')).slice(0, 2);
  // the steadier nerve rides the second heat
  if ((rs(two[0]).nerve ?? .5) > (rs(two[1]).nerve ?? .5) + 1e-9) two.reverse();
  const squires = ix.filter(i => !two.includes(i)).sort(by('squire')).slice(0, 2);
  return { riders: two, squires };
}
// the slot (0 or 1) of the best rider for the tilt: nerve and lance; null when the two are alike
function jtBestOf(roster, riders) {
  if (!Array.isArray(riders) || riders.length !== 2) return null;
  const v = riders.map(i => { const r = (roster[i] || {}).rs || {}; return .55 * (r.nerve ?? .5) + .45 * (r.lance ?? .5); });
  return Math.abs(v[0] - v[1]) < 1e-9 ? null : v[1] > v[0] ? 1 : 0;
}

/* ---------- a match's squad state ---------- */
function jtSquiresOk(q, s) { const n = G.teams[s].roster.length; return Array.isArray(q) && q.length === 2 && new Set(q).size === 2 && q.every(i => Number.isInteger(i) && i >= 0 && i < n && !G.riders[s].includes(i)); }
function jtSquadStart(o, teams) {
  G.squires = [0, 1].map(s => {
    const q = (o.squires || [])[s] || teams[s].squires;
    if (jtSquiresOk(q, s)) return q.slice();
    const rest = teams[s].roster.map((_, i) => i).filter(i => !G.riders[s].includes(i));
    return rest.sort((a, b) => jtFit(teams[s].roster[b].rs, 'squire') - jtFit(teams[s].roster[a].rs, 'squire') || a - b).slice(0, 2);
  });
  G.arm = [1, 1]; G.shaken = [0, 0]; G.girth = [0, 0]; G.cornerDue = [false, false]; G.corners = [[], []];
  const cb = o.cornerBy, okC = v => v === 0 || v === 1 || v === 2 || v === 'none' || (typeof v === 'string' && /^no-(tend|steady|girth)$/.test(v));
  if (Array.isArray(cb)) G.lab.cornerBy = [0, 1].map(s => okC(cb[s]) ? cb[s] : null);
}
const jtSq = (k, s, d) => G && Array.isArray(G[k]) && Number.isFinite(G[k][s]) ? G[k][s] : d;
// how big the moment is for side s: the last course of a heat when behind in the match, and the tilt for the crown
function jtPressure(s) {
  if (!G || G.over || !G.teams) return 0;
  if (jtInTilt()) return 1;
  return G.course === G.courses - 1 && jtTotal(s) < jtTotal(1 - s) ? 1 : 0;
}
const jtNerveK = (p, nerve) => 1 + JT_NERVE.k * clamp(p || 0, 0, 2) * (1 - clamp(nerve ?? .5, 0, 1));
// side s's rider as they set off now: { arm, shaken, girth, press }
function jtRideX(s) { return { arm: jtSq('arm', s, 1), shaken: jtSq('shaken', s, 0), girth: jtSq('girth', s, 0), press: jtPressure(s) }; }
// everything jtCharge needs for side s's rider on plan
function jtRideOpts(s, plan) {
  const ri = (jtRiders() || [])[s];
  return Object.assign({ plan, rs: jtRsOf(s, ri), mount: jtMountOf(s), wind: G.wind[s], hands: jtHands(s) }, jtRideX(s));
}
// after a course (06-game.js, once the wind is done): the arm spent, the shake taken or wearing off, the girth used,
// and the corner due when the same riders go again
function jtSquadAfter(rides, imp, rule) {
  if (!G.arm) { G.arm = [1, 1]; G.shaken = [0, 0]; G.girth = [0, 0]; G.cornerDue = [false, false]; G.corners = [[], []]; }
  for (const s of [0, 1]) {
    const r = rides[s].rs || {}, early = Math.max(0, -(rides[s].couch || 0));
    G.arm[s] = clamp(G.arm[s] - (JT_ARM.cost + JT_ARM.early * early) * (1.25 - JT_ARM.couchR * (r.couch ?? .5)) + JT_ARM.back, 0, 1);
    const se = imp.seat[s];
    G.shaken[s] = se.rocked && !se.unhorse ? Math.max(G.shaken[s] * JT_SHAKE.fade, clamp(imp.st[1 - s].rock, 0, 1)) : G.shaken[s] * JT_SHAKE.fade;
    if (G.shaken[s] < .02) G.shaken[s] = 0;
    G.girth[s] = 0;
  }
  if (rule.over) { G.cornerDue = [false, false]; return; }
  if (rule.tiltNow) { G.arm = [JT_ARM.tilt, JT_ARM.tilt]; G.shaken = [0, 0]; G.cornerDue = [false, false]; return; }
  if (rule.heatOver) { G.arm = [1, 1]; G.shaken = [0, 0]; G.cornerDue = [false, false]; return; }
  G.cornerDue = [true, true];
}

/* ---------- the corner ---------- */
const jtCare = (s, i) => { const m = G.teams[s].roster[G.squires[s][i]]; return clamp((m && m.rs && m.rs.care) ?? .5, 0, 1.2); };
const jtSqName = (s, i) => (G.teams[s].roster[G.squires[s][i]] || {}).n || 'A squire';
// what a squire of this care does at a job: tend, the share of the mount's lost wind it gets back; steady, the share of
// the shake gone (and of the arm's strength back); girth, the seat next course
const jtJobAmt = (job, care) => { const J = JT_JOB[job]; return J ? J.a + J.b * clamp(care, 0, 1.2) : 0; };
// the courses side s's rider still has in this heat after the next one (the wind and the arm last that long)
const jtAfterNext = () => jtInTilt() ? 0 : Math.max(0, G.courses - G.course - 1);
// the state side s's rider would set off in after jobs [a, b]: { wind, arm, shaken, girth }
function jtAfterJobs(s, jobs) {
  const X = { wind: jtSq('wind', s, 1), arm: jtSq('arm', s, 1), shaken: jtSq('shaken', s, 0), girth: 0 }, A = JT_JOB.steady.arm;
  jobs.forEach((job, i) => { const care = jtCare(s, i), amt = Math.min(1, jtJobAmt(job, care));
    if (job === 'tend') X.wind = clamp(X.wind + (1 - X.wind) * amt, 0, 1);
    else if (job === 'steady') { X.shaken = clamp(X.shaken * (1 - amt), 0, 1); X.arm = clamp(X.arm + (1 - X.arm) * Math.min(1, A[0] + A[1] * care), 0, 1); }
    else X.girth = jtJobAmt(job, care); });
  return X;
}
/* what one course is worth to side s (its points less the other side's, on average) with its rider in state X, riding
   the plan it would ride then, against the other rider on plan op: played out JT_CORNER.n times on a stream of its own
   (the same numbers for every state, so the states are compared fairly; the match's random numbers are never touched) */
function jtCornerM(s, X, op) {
  const keep = ['wind', 'arm', 'shaken', 'girth'].map(k => G[k][s]), o = 1 - s, lab = G.lab || {};
  let mine;
  try {
    G.wind[s] = X.wind; G.arm[s] = X.arm; G.shaken[s] = X.shaken; G.girth[s] = X.girth;
    const psk = lab.planBy && lab.planBy[s] != null ? lab.planBy[s] : G.skill[s];
    mine = jtRideOpts(s, psk <= 0 && !(lab.fix && lab.fix[s]) ? JT_CORNER.plain : jtPlan(s));
  } finally { ['wind', 'arm', 'shaken', 'girth'].forEach((k, i) => { G[k][s] = keep[i]; }); }
  const theirs = jtRideOpts(o, op), rnd = engRng(JT_CORNER.seed), ln = [0, 1].map(x => JT_SKILL[jtHandsK(x)].lean);
  const pts = (I, x) => I.res[x].unhorse ? JT_RULES.unhorse : JT_RULES.pts[I.res[x].at] || 0;
  let m = 0;
  for (let i = 0; i < JT_CORNER.n; i++) {
    const a = jtCharge(mine, rnd), b = jtCharge(theirs, rnd), I = jtImpact(s ? [b, a] : [a, b], ln, rnd);
    m += pts(I, s) - pts(I, o) - (I.res[o].unhorse ? JT_CORNER.heat * jtAfterNext() : 0) + (I.res[s].unhorse ? JT_CORNER.heat * jtAfterNext() : 0);
  }
  return m / JT_CORNER.n;
}
// the plan the other side's rider is reckoned to ride next: a Knight's corner reckons a Knight's plan; an Archmage's
// reads the other side's own (a Squire's anything: its plain plan)
function jtCornerOpp(s, sk) {
  const o = 1 - s, keep = G.skill[o];
  if (sk >= 2 && keep <= 0) return JT_CORNER.plain;
  if (sk < 2) G.skill[o] = 1;
  try { return jtPlan(o); } finally { G.skill[o] = keep; }
}
/* side s's corner, by a skill: { jobs: [squire 0's job, squire 1's], why } */
function jtCornerPlan(s, sk, allow) {
  if (sk == null) { const lab = (G.lab || {}).cornerBy; sk = lab && typeof lab[s] === 'number' ? lab[s] : G.skill[s]; }
  const jobs = allow || JT_JOBS;
  if (sk <= 0) {
    const a = jobs[Math.floor(R() * jobs.length)], rest = jobs.filter(j => j !== a), b = rest[Math.floor(R() * rest.length)];
    return { jobs: [a, b], why: 'two jobs picked on a whim' };
  }
  // each way to share two of the jobs between the two squires: the next course in the state it leaves, and what lasts
  // (the wind and the arm) for one more course when the heat has one (counting every course left did worse: measured)
  const op = jtCornerOpp(s, sk), after = Math.min(1, jtAfterNext()), base = jtCornerM(s, Object.assign(jtAfterJobs(s, []), { shaken: 0 }), op);
  let best = null;
  for (const a of jobs) for (const b of jobs) {
    if (a === b) continue;
    const X = jtAfterJobs(s, [a, b]), v = jtCornerM(s, X, op) + (after ? after * JT_CORNER.last * (jtCornerM(s, { wind: X.wind, arm: X.arm, shaken: 0, girth: 0 }, op) - base) : 0);
    if (!best || v > best.v + 1e-9) best = { jobs: [a, b], v };
  }
  return { jobs: best.jobs, why: jtCornerWhy(s, best.jobs) };
}
// the reason: what each squire does, and why that job
function jtCornerWhy(s, jobs) {
  const w = Math.round(100 * jtSq('wind', s, 1)), arm = Math.round(100 * jtSq('arm', s, 1)), sh = jtSq('shaken', s, 0);
  const why = { tend: w < 80 ? `the mount's wind is down to ${w}%` : 'a breath for the mount', steady: sh > .05 ? 'the rider is still shaken from that hit' : arm < 85 ? `the lance arm is tiring (${arm}%)` : 'a word in the rider\'s ear',
    girth: 'a tighter girth to sit the next hit' };
  const left = JT_JOBS.find(j => !jobs.includes(j));
  return `${jtSqName(s, 0)} ${JT_JOB[jobs[0]].v} (${why[jobs[0]]}); ${jtSqName(s, 1)} ${JT_JOB[jobs[1]].v} (${why[jobs[1]]}); nobody spare to ${JT_JOB[left].n.toLowerCase()}`;
}
// a corner's jobs, if they are two of the three and not the same: [a, b], or null
function jtJobsOk(jobs) { return Array.isArray(jobs) && jobs.length === 2 && jobs.every(j => jtOwn(JT_JOB, j)) && jobs[0] !== jobs[1] ? jobs.slice() : null; }
/* side s's squires do their jobs (jobs: [squire 0's, squire 1's]); returns '' or why not */
function jtCornerDo(s, jobs, why) {
  if (!G || !G.teams || G.over) return 'No match.';
  if (!G.cornerDue || !G.cornerDue[s]) return 'Not between courses.';
  const J = jtJobsOk(jobs); if (!J) return 'Two squires, two different jobs: tend the mount, steady the rider or tighten the girth.';
  const X = jtAfterJobs(s, J), did = {};
  if (J.includes('tend')) did.tend = +(X.wind - G.wind[s]).toFixed(3);
  if (J.includes('steady')) did.steady = { shake: +(G.shaken[s] - X.shaken).toFixed(3), arm: +(X.arm - G.arm[s]).toFixed(3) };
  if (J.includes('girth')) did.girth = +X.girth.toFixed(3);
  G.wind[s] = X.wind; G.arm[s] = X.arm; G.shaken[s] = X.shaken; G.girth[s] = X.girth;
  J.forEach((job, i) => { const P = G.pst[s][G.squires[s][i]]; if (P) P.jobs = (P.jobs || 0) + 1; });
  G.cornerDue[s] = false;
  G.corners[s].push({ heat: G.heat, course: G.course, jobs: J, why: why || '', did });
  return '';
}
// before a course: every side whose corner is due and not done has its corner choose (the CPU's way, by skill); skip:
// a side to leave alone (yours on Play, until you ride)
function jtCornersDue(skip) {
  if (!G || !G.teams || !G.cornerDue) return;
  for (const s of [0, 1]) {
    if (!G.cornerDue[s] || s === skip) continue;
    const lab = (G.lab || {}).cornerBy, L = lab ? lab[s] : null;
    if (L === 'none') { G.cornerDue[s] = false; continue; }
    const P = typeof L === 'string' ? jtCornerPlan(s, 1, JT_JOBS.filter(j => j !== L.slice(3))) : jtCornerPlan(s);
    jtCornerDo(s, P.jobs, P.why);
  }
}

/* ---------- the mounts ---------- */
// the mount a rider of these ratings rides best, with the reason (the Realm's captain; your choice on the Lists tab). By
// the lab (seeded matches, a Knight a side, against Destriers): a steady lance does best on a Charger in a short heat
// (an elf), a rider who keeps a gallop up on a Courser (a harpy), the rest on a Destrier, a long heat most of all
function jtMountFor(rs, courses) {
  const r = rs || {}, long = (courses || JT_RULES.courses) >= 5;
  if ((r.lance ?? .5) >= .8 && !long) return { m: 'charger', why: 'a lance that steady can take its sway for the harder hit' };
  if ((r.ride ?? .5) >= .7) return { m: 'courser', why: 'it keeps up a gallop all heat and gets its wind back quickly' };
  return { m: 'destrier', why: long ? 'steady to aim from and to sit a hit on, over a long heat' : 'steady to aim from and to sit a hit on' };
}

// what the page shows of each side's squad now (a copy)
function jtSquadView() {
  if (!G || !G.teams || !G.squires) return null;
  return { squires: [0, 1].map(s => [0, 1].map(i => ({ ri: G.squires[s][i], n: jtSqName(s, i), care: +jtCare(s, i).toFixed(3) }))), wind: G.wind.slice(), arm: (G.arm || [1, 1]).slice(),
    shaken: (G.shaken || [0, 0]).slice(), girth: (G.girth || [0, 0]).slice(), press: [jtPressure(0), jtPressure(1)], due: (G.cornerDue || [false, false]).slice(),
    corner: [0, 1].map(s => { const c = (G.corners || [[], []])[s]; return c.length ? JSON.parse(JSON.stringify(c[c.length - 1])) : null; }), mounts: JSON.parse(JSON.stringify(G.mounts)) };
}
