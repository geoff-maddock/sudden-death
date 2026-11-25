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
   random number from the rnd passed in (Math.random when left out; planRules is the plan table): sway(o) and rideSpeed(o), charge(o, rnd) (a CPU
   rider's ride), strike(a, d, rnd), seat(st, d, lean, rnd), impact(rides, leans, rnd); start(opts) puts a match on
   the lists ({ courses, teams, riders, best, skill: [2], mounts, seed }), turn() rides the next course, rideCourse(plans,
   rides, leans) one with any side's ride or lean given, plan(s) the CPU's plan, summary(), simMatch(opts) a whole
   match headless (the match on the lists and the random stream left as they were).
   Phase 2 is the page and riding by hand: start(opts) also puts the match on show ({ mode: 'watch' | 'play' }), and
   show, hide, on, pause, paused, speed and render drive the canvas (n1-page.js). The beat: phase, msg, call (the
   herald's), view (a copy of what the page needs), tick(dt), last (the last course as ridden). Your course: select({
   aim, guard, pace, suggest }) your plan, press (Space: ride, then a spur tap, then the couch), spur, couch(on), aim(x,
   y) (your hand on the lance, inches), nudge(vx, vy) (the arrows), lean(v) (the balance moment, -1 to 1), setMode;
   playRules (the beats' numbers); aimScr and aimUn map the target to its panel and back. courseOpen(plans, rides,
   leans, wait) and courseClose(P, leans) are rideCourse in two halves (the seat held for your balance moment).
   onPhase, onPick and onOver hear a new beat, a change to your plan and the end.
   Phase 3 is the four, their roles and the squires: cap (12), kinds (a copy of the ratings by kind), fit(rs, role) (0
   to 1, 'rider' or 'squire'), autoSquad(roster) ({ riders, squires }, roster indexes; each member { kind, r? }),
   bestOf(roster, riders) (the slot of the best rider for the tilt), rosterOne(p) (a member as the engine takes it);
   start(opts) also takes squires ([two roster indexes a side], the rest by care when left out) and mounts; pressure(s),
   nerveK(p, nerve); jobs (the squires' three jobs), cornerPlan(s, skill) (a corner's { jobs, why }), cornerDo(s, jobs)
   ('' or why not), squad (each side's squires, wind, arm, shake, girth, pressure, corner due and the last corner),
   mountFor(rs, courses) (the captain's mount for a rider: { m, why }); squadRules (the numbers). select({ jobs, job:
   [squire, job], corner }) sets your squires' jobs on Play, before you ride.
   Phase 2's review: hold(vx, vy) is a held button (the Lean buttons) as the arrows are; nudge is overwritten each frame
   by the arrows and the held buttons. seat(st, d, lean, rnd, own) takes the rider's own strike (a tip that went high
   and didn't break leaves them reaching). start(opts) also takes guardBy (lab only: a guard a side, or null).
   Phase 4 is the plan and the read: card(s) (the herald's card for side s: the other side's rider, name, kind, mount
   and skill, counts of what their side has ridden this match, their last four courses, their usual mix, the read and
   the card in words), counts(s) (what side s has ridden); the squire's word now says, in plain words, what they have
   ridden and what it makes each choice. G.plans entries carry ri (the rider) and tilt.
   Phase 5 is matches from the world: modes add 'manage' (your side rides on its ratings; the plan and your squires'
   jobs are yours, then press sends them), manage({ auto }) leaves the calls to your squires or takes them back (mgrAuto);
   snapshot() (plain JSON, between courses; null in the yard) and resume(sn) keep a match; finishCourse() rides out a
   course being ridden (your side's own hands); start({ yard: { runs }, teams: [your side] }) is the tilting yard, runs
   at a straw target with nothing at stake: yard (the runs so far and the summary), and onOver hears the summary.
   Phase 6 is monster powers (12-powers.js): start(opts) and simMatch(opts) take powers (true, or [yours, theirs]) and
   powOnly (lab: one power id a side, or null); pow and pow2 (by kind: [lance, shield]), ult (by kind), sit, manaRules,
   cheerRules, fx0 (the effects' starting values) and lift (the squire's fourth job) are the tables; powOf(kind, role,
   alt), pwByName(n) (the pick a rider who brings none brings), powNow(s, role, ri), ultOf(s, ri), powWhy(s, k), cast(s,
   k, why) and castMine(k) ('lance', 'shield', 'ult', a situation power, or 'sit': the one that fits), sitFits(s, k),
   fxFor(s), cpuPower(s, plan), tip(s), jobsFor(s) (the jobs side s's squires may do: the lift while cursed); autoPow
   (Manage's Auto powers, kept in the snapshot). A roster member brings its pick as pw: { lance, shield } (0 or 1).
   select({ job: [squire, 'lift'] }) lifts a curse in place of a job; card(s) adds the other rider's powers and the
   curses (pow, curse); summary() adds powers (the casts, the mana, the cheer).
   Phase 7 is gear and potions (13-kit.js): a roster member's gear ({ id, name, fx }) reaches the model as gx (fx without
   r); start(opts) and simMatch(opts) take bags ([yours or null, theirs]: a match without bags has no potions); potions
   (the table), kitRules, potionWhy(s, id), potion(id) (yours, in your plan beat: '' or why not), advice(bag) (your
   squire's word), cpuPotion(s), potionValues(s, bag), rideFx(s) (what a rider rides with this course: powers, gear and
   potions, or null), rideOpts(s, plan) (what the model is given for side s's rider on a plan). */
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
  sway: o => jtSway(o), rideSpeed: o => jtSpeed(o), charge: (o, rnd) => jtCharge(o, rnd || Math.random), strike: (a, d, rnd) => jtStrike(a, d, rnd || Math.random),
  seat: (st, d, lean, rnd, own) => jtSeat(st, d, lean, rnd || Math.random, own), impact: (rides, leans, rnd) => jtImpact(rides, leans || [.5, .5], rnd || Math.random),
  card: s => jtCard(s == null ? 0 : s), counts: s => G && G.teams ? jtCounts(s) : null,
  planMix: s => G && G.teams && !G.over ? JT_PLANS.map((p, i) => Object.assign({ share: jtMixNow(s)[i] }, p)) : null, habit: s => G && G.teams && !G.over ? jtHabitOf(s) : null,
  start: o => { jtStart(o); jtPlayStart(o); return G; }, turn: () => GP && ['charge', 'seat'].includes(GP.ph) ? null : jtTurn(), rideCourse: (p, r, l) => G && G.teams ? jtRideCourse(p, r, l) : null, plan: s => G && G.teams && !G.over ? jtPlan(s) : null,
  summary: () => jtSummary(), simMatch: o => jtSimMatch(o),
  courseOpen: (p, r, l, w) => G && G.teams ? jtCourseOpen(p, r, l, w) : null, courseClose: (P, l) => G && G.teams ? jtCourseClose(P, l) : null,
  // the page and riding by hand (phase 2)
  modes: JT_MODES.slice(), playRules: JSON.parse(JSON.stringify(JT_PLAY)), get phase() { return GP ? GP.ph : null; }, get msg() { return GP ? GP.msg : ''; }, get call() { return GP ? GP.call : ''; },
  get view() { return G && G.teams ? jtView() : null; }, get mode() { return GP ? GP.mode : null; }, get last() { return GP && GP.last ? JSON.parse(JSON.stringify(GP.last)) : null; },
  setMode: m => jtSetMode(m), tick: dt => jtTick(dt), select: o => jtSelect(o), press: () => jtPress(), spur: () => jtSpur(), couch: on => jtCouch(on !== false),
  aim: (x, y) => jtAim(x, y), nudge: (vx, vy) => jtNudge(vx, vy), hold: (vx, vy) => jtHold(vx, vy), lean: v => jtLeanTo(v), aimScr: (x, y) => jtAimScr(x, y), aimUn: (sx, sy) => jtAimUn(sx, sy), eight: (t, amp, pace) => jtEight(t, amp, pace),
  set onPhase(f) { JT_HOOK.onPhase = f; }, set onPick(f) { JT_HOOK.onPick = f; }, set onOver(f) { JT_HOOK.onOver = f; }, get onPhase() { return JT_HOOK.onPhase; }, get onPick() { return JT_HOOK.onPick; }, get onOver() { return JT_HOOK.onOver; },
  show: () => jtShow(), hide: () => jtHide(), get on() { return JTP.on; }, render: dt => jtRender(dt || 0),
  pause: on => { JTP.paused = !!on; }, get paused() { return JTP.paused; }, get speed() { return JTP.speed; }, set speed(n) { JTP.speed = clamp(Math.round(n) || 1, 1, 8); },
  // the four, their roles and the squires (phase 3)
  cap: JT_RCAP, kinds: JSON.parse(JSON.stringify(JT_KIND)), fit: (rs, role) => jtFit(rs, role), rosterOne: p => jtRosterOne(p || {}),
  autoSquad: ro => jtAutoSquad((ro || []).map(m => jtRosterOne(m || {}))), bestOf: (ro, riders) => jtBestOf((ro || []).map(m => jtRosterOne(m || {})), riders),
  pressure: s => jtPressure(s), nerveK: (p, n) => jtNerveK(p, n), jobs: JSON.parse(JSON.stringify(JT_JOB)),
  cornerPlan: (s, sk) => G && G.teams && !G.over ? jtCornerPlan(s, sk) : null, cornerDo: (s, jobs) => jtCornerDo(s, jobs, 'by hand'), get squad() { return jtSquadView(); },
  // matches from the world (phase 5)
  snapshot: () => jtSnapshot(), resume: sn => jtResume(sn), finishCourse: () => jtFinishCourse(), manage: o => jtManage(o), get mgrAuto() { return !!(GP && GP.mgrAuto); },
  get yard() { return G && G.yard ? jtYardSummary() : null; }, strawRules: JSON.parse(JSON.stringify(JT_STRAW)),
  // monster powers (phase 6)
  pow: JSON.parse(JSON.stringify(JT_POW)), pow2: JSON.parse(JSON.stringify(JT_POW2)), ult: JSON.parse(JSON.stringify(JT_ULT)), sit: JSON.parse(JSON.stringify(JT_SIT)),
  manaRules: JSON.parse(JSON.stringify(JT_MANA)), cheerRules: JSON.parse(JSON.stringify(JT_CHEER)), fx0: JSON.parse(JSON.stringify(JT_FX0)), lift: JSON.parse(JSON.stringify(JT_LIFT)),
  powOf: (k, r, alt) => JSON.parse(JSON.stringify(jtPowOf(k, r, alt))), pwByName: n => jtPwByName(n), powNow: (s, r, ri) => G && G.teams && G.powers ? jtPowNow(s, r, ri) : null,
  ultOf: (s, ri) => G && G.teams ? jtUltOf(s, ri) : null, powWhy: (s, k) => jtPowWhy(s, k), cast: (s, k, why) => jtCast(s, k, why || 'by hand'), castMine: k => jtCastMine(k),
  sitFits: (s, k) => jtSitFits(s, k), fxFor: s => jtFxFor(s), cpuPower: (s, plan) => G && G.teams ? jtCpuPower(s, plan || jtPlan(s)) : [], tip: s => jtPowerTip(s),
  jobsFor: s => G && G.teams ? jtJobsFor(s).slice() : JT_JOBS.slice(), get autoPow() { return !!(GP && GP.autoPow); }, set autoPow(v) { if (GP) GP.autoPow = !!v; },
  // gear and potions (phase 7)
  potions: JSON.parse(JSON.stringify(JT_POTIONS)), kitRules: JSON.parse(JSON.stringify(JT_KIT)), potionWhy: (s, id) => jtPotionWhy(s, id), potion: id => jtPotion(id),
  advice: bag => jtPotionAdvice(bag), cpuPotion: s => G && G.teams && G.bags ? jtCpuPotion(s) : '', potionValues: (s, bag) => G && G.teams && G.bags ? jtPotionValues(s, bag || {}) : [],
  rideFx: s => G && G.teams ? jtRideFx(s) : null, rideOpts: (s, plan) => G && G.teams && !G.over ? jtRideOpts(s, plan || { aim: 'shield', guard: 'square', pace: 'canter' }) : null,
  mountFor: (rs, n) => jtMountFor(rs, n), squadRules: JSON.parse(JSON.stringify({ role: JT_ROLE, arm: JT_ARM, shake: JT_SHAKE, nerve: JT_NERVE, corner: JT_CORNER }))
};
