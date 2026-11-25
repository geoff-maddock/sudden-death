/* The Tilting Lists: the match on show and riding by hand (issue #117, phase 2). GP is the page's: the beat, your
   plan, the charge as you ride it, the balance moment. It is not the match's state (G is) and is never saved.

   The beat (GP.ph): next (who rides) → plan (yours: aim, guard and pace, on your squire's word) → charge (the few
   seconds down the lists) → seat (yours, only when their lance broke on you: the balance moment) → after (the herald's
   call) → next, and over at the end. A CPU course goes next → herald (the riders named) → charge → after.
   The charge on Play has four beats, each a number for the model (04-course.js), through the same sway() and speed():
   - the spur (the first JT_PLAY.spur.until of the charge): tap with the hoofbeats (Space, or tap the lists). Taps on
     the beat, within JT_PLAY.spur.win, build your speed; taps off it and beats missed don't (a stumble costs). Your
     speed at impact is speed() for your pace, mount and wind, times JT_PLAY.spur.min to 1 by how well you spurred.
   - the couch (after the spur): hold Space (or hold a finger down) to lower the lance. The right moment is
     JT_PLAY.couch.ideal of the way down; the couch's error is how far off it you were, over JT_PLAY.couch.span (-1 far
     too early, 1 far too late). Too early tires the arm and the tip droops; too late leaves it scattered. Let go
     before the impact and the lance comes up: a miss.
   - the aim: once couched, the tip rides the stride's figure-eight, sway()'s spread times JT_PLAY.aim.eight wide;
     your hand (the arrows, or drag) holds it on your mark. At impact the tip is the mark, plus the eight, plus your
     hand, plus your rider's own miss (JT_PLAY.aim.noise of the spread: a perfect hand rides about as true as an
     Archmage's, a little truer at the helm; phase 2's review), less the droop.
   - the impact, then the seat: if their lance broke on you, a short balance moment follows: the rider wobbles and you
     lean against it (the arrows, drag, or the Lean buttons). How well you held it is your lean (0 to 1) for seat().
   Watch: the CPU rides both. You ride: your side's courses are yours (side 0).
   Manage (phase 5): your side rides on its ratings (the CPU's hands at your side's skill), and the calls are yours:
   before each of your courses the plan (your squire's word first) and your squires' jobs, then Send them. Leave it to
   your squires (GP.mgrAuto, jtManage in 11-world.js) and they call every course themselves: your squire's word and your
   corner's word. You ride takes the reins at any beat; Watch hands the calls back to the CPU. */
const JT_PLAY = { charge: 3.6, spur: { until: .42, win: .09, min: .86, beat: { canter: .46, gallop: .34 } }, couch: { ideal: .66, span: .3, high: 40 },
  aim: { eight: 2.6, noise: .9, reach: 18, key: 40 }, seat: { time: 1.4, amp: 1, key: 2.6 }, pace: { herald: 1.2, after: 2.4, heat: 3.2, over: 3.4 } };
const JT_HOOK = { onPhase: null, onPick: null, onOver: null };
const JT_MODES = ['watch', 'manage', 'play'];
let GP = null;

function jtPlayStart(o) {
  GP = { mode: JT_MODES.includes(o && o.mode) ? o.mode : 'watch', you: 0, ph: 'next', t: 0, wait: 0, msg: '', sel: null, jobs: null, plans: null, cpuRides: null, ch: null, seatM: null, P: null, last: null, call: '', fx: [], mgrAuto: !!(o && o.mgrAuto) };
  jtGo('next');
  return GP;
}
function jtGo(ph, wait, msg) {
  GP.ph = ph; GP.t = 0; GP.wait = wait || 0; if (msg != null) GP.msg = msg;
  if (JT_HOOK.onPhase) try { JT_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
const jtName = (s, ri) => (G.teams[s].roster[ri] || {}).n || 'Someone';
const jtYours = s => GP.mode === 'play' && s === GP.you;
// (phase 5: a side you manage, calling the plan and the squires yourself: not left to your squires)
const jtMgr = s => GP.mode === 'manage' && s === GP.you && !GP.mgrAuto;
const jtCalls = s => jtYours(s) || jtMgr(s);
const jtSide = s => G.teams[s].name;
function jtPicked() { if (JT_HOOK.onPick) try { JT_HOOK.onPick(); } catch (e) { console.error(e); } }

/* ---------- your plan ---------- */
// your squire's word: the best plan by the odds against how the other side rides (an Archmage's read, a Knight's
// hands), with the reason (phase 2's review)
function jtSuggest(s) {
  const P = jtPlanOwn(s, { sk: 'word', hk: 1 });
  return { aim: P.aim, guard: P.guard, pace: P.pace, why: P.why };
}
/* change your plan: { aim, guard, pace, suggest }. Returns '' or why not */
function jtSelect(o) {
  if (!GP || GP.ph !== 'plan' || !GP.sel) return 'Not now.';
  o = o || {};
  if (o.suggest) { GP.sel = jtSuggest(GP.you); jtPicked(); return ''; }
  // (phase 3: your squires' jobs between courses: jobs [two], or job [which squire, the job]; corner: your corner's word again)
  if (o.corner || o.jobs || o.job) {
    if (!GP.jobs) return 'Your squires have nothing to do before the first course of a heat.';
    if (o.corner) { GP.jobs = jtCornerPlan(GP.you, 1).jobs; jtPicked(); return ''; }
    let J = o.jobs;
    if (o.job) { const [i, j] = o.job; if (!(i === 0 || i === 1) || !jtJobOk(GP.you, j)) return 'No such job.'; J = GP.jobs.slice(); if (J[1 - i] === j) J[1 - i] = J[i]; J[i] = j; }
    if (!jtJobsOk(J, GP.you)) return 'Two squires, two different jobs.';
    GP.jobs = J.slice(); jtPicked(); return '';
  }
  const S = Object.assign({}, GP.sel);
  for (const k of ['aim', 'guard', 'pace']) if (o[k] != null) { if (!jtOwn(JT_PLAN[k], o[k])) return `No such ${k}.`; S[k] = o[k]; }
  GP.sel = S; jtPicked(); return '';
}

/* ---------- the charge ---------- */
const jtBeat = pace => JT_PLAY.spur.beat[jtBeatPace(pace)];
const jtBeatPace = pace => jtOwn(JT_PLAY.spur.beat, pace) ? pace : 'canter';
// a press: in your plan it rides; in the spur a tap; after the spur it lowers the lance (held: jtCouch(false) lets go)
function jtPress() {
  if (!GP || GP.mode === 'watch') return false;
  if (GP.ph === 'plan' && GP.sel) { jtCharge0(); return true; }
  if (GP.mode !== 'play') return false;
  const C = GP.ch; if (GP.ph !== 'charge' || !C || !C.mine) return false;
  if (C.p < JT_PLAY.spur.until) return jtSpur();
  return jtCouch(true);
}
// a tap of the spur, now: on the beat or off it
function jtSpur() {
  const C = GP && GP.ch; if (!C || !C.mine || GP.ph !== 'charge' || C.p >= JT_PLAY.spur.until) return false;
  const b = jtBeat(C.pace), t = C.p * JT_PLAY.charge, k = Math.round(t / b), off = Math.abs(t - k * b);
  if (k >= 1 && off <= JT_PLAY.spur.win && !C.hit.includes(k)) { C.hit.push(k); C.taps.push({ t, ok: true }); }
  else { C.bad++; C.taps.push({ t, ok: false }); }
  return true;
}
// the couch: down (held) or up
function jtCouch(on) {
  const C = GP && GP.ch; if (!C || !C.mine || GP.ph !== 'charge') return false;
  if (on && C.p < JT_PLAY.spur.until) return false;
  // (a lance let go keeps where its tip was: it reaches as far as it went, phase 4's review)
  if (on && !C.down) { C.down = true; C.downAt = C.p; } else if (!on && C.down) { C.down = false; C.downAt = null; C.lowered = true; C.relTip = C.tipNow ? Object.assign({}, C.tipNow) : null; }
  return true;
}
// the hand on the lance: set where it holds the tip (inches off the mark), or move it at a speed (the arrows)
function jtAim(x, y) { const C = GP && GP.ch; if (!C || !C.mine) return false; const R0 = JT_PLAY.aim.reach; C.hand = { x: clamp(+x || 0, -R0, R0), y: clamp(+y || 0, -R0, R0) }; return true; }
function jtNudge(vx, vy) { if (GP) GP.keyV = { x: clamp(vx || 0, -1, 1), y: clamp(vy || 0, -1, 1) }; }
// your lean in the balance moment (-1 left to 1 right), or set by the arrows' speed
function jtLeanTo(v) { const M = GP && GP.seatM; if (!M) return false; M.lean = clamp(+v || 0, -1.5, 1.5); return true; }
function jtCharge0() {
  const riders = jtRiders(); if (!riders) return;
  // (phase 3: your squires do the jobs you gave them before you set off)
  if (jtCalls(GP.you) && GP.jobs && G.cornerDue && G.cornerDue[GP.you]) jtCornerDo(GP.you, GP.jobs, jtYours(GP.you) ? 'your call' : 'your call, managing');
  GP.jobs = null;
  // (a plan always exists for the course: yours, your squire's word when there is none, or the CPU's; a side you
  // manage, or leave to your squires, rides your squire's word or the plan you set)
  const plans = [0, 1].map(s => jtCalls(s) || (GP.mode === 'manage' && s === GP.you) ? Object.assign({}, GP.sel || jtSuggest(s)) : (GP.plans && GP.plans[s]) || jtPlanKept(s));
  // (phase 6: the CPU casts as the riders set off, your plan committed; and your squire, under Auto powers in Manage)
  const cast = G.powers ? jtPowersAtCharge(plans) : '';
  // the CPU's rides are drawn as it sets off (the page draws its lance from them); yours is built as you ride
  const cpuRides = [0, 1].map(s => jtYours(s) ? null : jtCharge(jtRideOpts(s, plans[s]), R));
  const mine = jtYours(0) || jtYours(1), s = GP.you;
  GP.plans = plans; GP.cpuRides = cpuRides; GP.keyV = { x: 0, y: 0 };
  GP.ch = { p: 0, mine, pace: mine ? plans[s].pace : plans[0].pace, hit: [], taps: [], bad: 0, down: false, downAt: null, hand: { x: 0, y: 0 }, tipNow: null, riders };
  const sent = !mine && GP.mode === 'manage' ? `${jtName(s, riders[s])} rides your plan: ${JT_PLAN.aim[plans[s].aim].n}, ${plans[s].guard}, at ${JT_PLAN.pace[plans[s].pace].n}. ` : '';
  jtGo('charge', 0, cast + (mine ? `${jtName(s, riders[s])} sets off. Tap with the hoofbeats to spur, then hold to couch the lance, and keep the tip on ${JT_PLAN.aim[plans[s].aim].n}.` : `${sent}${jtName(0, riders[0])} and ${jtName(1, riders[1])} set off down the lists…`));
}
// how well you spurred: on-beat taps over the beats there were, less the stumbles (0 to 1)
function jtSpurQ(C) {
  const n = Math.max(1, Math.floor(JT_PLAY.spur.until * JT_PLAY.charge / jtBeat(C.pace)));
  return clamp((C.hit.length - .5 * C.bad) / n, 0, 1);
}
// your couch's error (-1 early to 1 late), or null with the lance still up
const jtCouchErr = C => C.down && C.downAt != null ? clamp((C.downAt - JT_PLAY.couch.ideal) / JT_PLAY.couch.span, -1, 1) : null;
// the stride's figure-eight at time t (seconds), for an amplitude: { x, y }
function jtEight(t, amp, pace) { const w = Math.PI / jtBeat(pace); return { x: amp * Math.sin(w * t), y: amp * .7 * Math.sin(2 * w * t) }; }
// your sway now: sway() for your plan, your rider and mount, and the couch as it stands (late if still up)
function jtYourSway(C) {
  const s = GP.you, ri = C.riders[s], e = jtCouchErr(C);
  const X = jtRideX(s), fx = jtRideFx(s);
  // (phase 6: with powers, what your rider has on this course: a curse's late couch, a sway, no pressure, no shake)
  return jtSway({ pace: GP.plans[s].pace, mount: jtMountOf(s), rs: jtRsOf(s, ri), wind: G.wind[s], couch: e == null ? 0 : fx ? clamp(e + fx.late, -1, 1) : e, hands: 1, arm: X.arm,
    shaken: fx && fx.calm ? 0 : X.shaken, press: fx ? X.press * (1 - fx.nerve) : X.press, fx });
}
// where your tip is now (inches, on their target), once couched; null while the lance is up
function jtTipNow(C) {
  if (!C.down) return null;
  const A = JT_PLAN.aim[GP.plans[GP.you].aim], sw = jtYourSway(C), E = jtEight(C.p * JT_PLAY.charge, sw.sigma * JT_PLAY.aim.eight, GP.plans[GP.you].pace);
  return { x: A.x + E.x + C.hand.x, y: A.y + E.y + C.hand.y - sw.droop };
}
// your ride at impact, for the model
function jtYourRide(C) {
  const s = GP.you, ri = C.riders[s], plan = GP.plans[s], rs = jtRsOf(s, ri), mount = jtMountOf(s), q = jtSpurQ(C), fx = jtRideFx(s), e0 = jtCouchErr(C), e = e0 != null && fx ? clamp(e0 + fx.late, -1, 1) : e0;
  const speed = jtSpeed({ pace: plan.pace, mount, rs, wind: G.wind[s], fx }) * (JT_PLAY.spur.min + (1 - JT_PLAY.spur.min) * q);
  // (phase 6: the ride carries its fx, for the strike and the seat)
  const A = JT_PLAN.aim[plan.aim], X = jtRideX(s), sq = Object.assign({ girth: X.girth, shaken: fx && fx.calm ? 0 : X.shaken }, fx ? { fx } : {});
  // (let go after it was lowered: up, but it reaches as far as its tip went, or its aim's height: lowered, reachY)
  if (e == null) return Object.assign({ aim: plan.aim, guard: plan.guard, pace: plan.pace, mount, rs, speed, couch: 1, tip: { x: A.x, y: A.y + JT_PLAY.couch.high }, spurQ: q, up: true },
    C.lowered ? { lowered: true, reachY: C.relTip ? C.relTip.y : A.y } : {}, sq);
  const sw = jtYourSway(C), t = jtTipNow(C);
  return Object.assign({ aim: plan.aim, guard: plan.guard, pace: plan.pace, mount, rs, speed, couch: e, tip: { x: t.x + gauss() * sw.sigma * JT_PLAY.aim.noise, y: t.y + gauss() * sw.sigma * JT_PLAY.aim.noise }, spurQ: q }, sq);
}
function jtChargeTick(dt) {
  const C = GP.ch; if (!C) return;
  C.p = Math.min(1, C.p + dt / JT_PLAY.charge);
  if (C.mine) {
    const V = GP.keyV || { x: 0, y: 0 }, R0 = JT_PLAY.aim.reach;
    if (C.down && (V.x || V.y)) C.hand = { x: clamp(C.hand.x + V.x * JT_PLAY.aim.key * dt, -R0, R0), y: clamp(C.hand.y + V.y * JT_PLAY.aim.key * dt, -R0, R0) };
    C.tipNow = jtTipNow(C);
  }
  if (C.p >= 1) jtImpactNow();
}
function jtImpactNow() {
  const C = GP.ch, s = GP.you, rides = GP.cpuRides.slice();
  if (C.mine) rides[s] = jtYourRide(C);
  const P = jtCourseOpen(GP.plans, rides, null, [C.mine && s === 0, C.mine && s === 1]);
  GP.P = P; GP.rides = rides;
  jtSplinters(P);
  // their lance broke on you: the balance moment
  if (C.mine && P && P.st[1 - s].broke) {
    GP.seatM = { t: 0, lean: 0, w: 0, err: 0, n: 0, amp: JT_PLAY.seat.amp * clamp(P.st[1 - s].rock, .4, 1.6), ph: R() * 6.28, v: 0 };
    jtGo('seat', 0, `${jtCap(JT_AT[P.st[1 - s].zone] || 'a hit')}! Your rider rocks: lean against it to keep your seat.`);
    return;
  }
  jtFinish();
}
// the wobble in the balance moment at time t: the hit throws the rider one way, then the other
const jtWobble = M => M.amp * Math.exp(-M.t * .6) * (Math.sin(M.t * 5.2 + M.ph) + .55 * Math.sin(M.t * 8.7 + M.ph * 1.7));
function jtSeatTick(dt) {
  const M = GP.seatM; if (!M) return;
  M.t += dt;
  const V = GP.keyV || { x: 0, y: 0 };
  if (V.x) M.lean = clamp(M.lean + V.x * JT_PLAY.seat.key * dt, -1.5, 1.5);
  M.w = jtWobble(M); M.err += Math.abs(M.w + M.lean); M.n++;
  if (M.t >= JT_PLAY.seat.time) jtFinish();
}
// how well you leaned (0 to 1): the wobble left after your lean, against the wobble itself
const jtLeanQ = M => !M || !M.n ? .5 : clamp(1 - (M.err / M.n) / Math.max(.2, M.amp * .75), 0, 1);
function jtFinish() {
  const P = GP.P, s = GP.you, mine = GP.ch && GP.ch.mine, leans = [null, null];
  if (mine && P && P.lean[s] == null) leans[s] = GP.seatM ? jtLeanQ(GP.seatM) : .5;
  const ev = jtCourseClose(P, leans);
  GP.P = null; GP.seatM = null; GP.ch = null; GP.keyV = { x: 0, y: 0 };
  if (!ev) { jtGo('next'); return; }
  GP.last = { heat: ev.heat, course: ev.course, tilt: ev.tilt, riders: ev.riders, plans: ev.plans.map(p => ({ aim: p.aim, guard: p.guard, pace: p.pace })), res: ev.imp.res,
    pts: ev.rule.pts, zone: ev.imp.st.map(x => x.zone), broke: ev.imp.st.map(x => x.broke), high: ev.imp.st.map(x => !!x.high), lean: ev.lean, rides: ev.rides.map(r => ({ speed: r.speed, couch: r.couch, tip: r.tip, spurQ: r.spurQ ?? null, up: !!r.up })),
    unhorsed: ev.rule.unhorsed, rule: { heatOver: ev.rule.heatOver, tiltNow: ev.rule.tiltNow, over: ev.rule.over } };
  GP.call = jtHerald(ev);
  const R0 = ev.rule;
  jtGo('after', G.over ? JT_PLAY.pace.over : R0.heatOver || R0.tiltNow ? JT_PLAY.pace.heat : JT_PLAY.pace.after, GP.call);
  if (G.over && JT_HOOK.onOver) try { JT_HOOK.onOver(jtSummary()); } catch (er) { console.error(er); }
}
const JT_NUM = ['Nothing', 'One', 'Two', 'Three'];
const jtCap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
// the herald's call for a course: each strike, the points, an unhorsing, the heat and the match
function jtHerald(ev) {
  const st = ev.imp.st, R0 = ev.rule, say = [];
  for (const s of [0, 1]) {
    const k = st[s], who = jtName(s, ev.riders[s]), p = R0.pts[s], un = ev.imp.res[s].unhorse;
    if (un) say.push(`${who} unhorses ${jtName(1 - s, ev.riders[1 - s])}! Three to ${jtSide(s)}!`);
    else if (k.broke) say.push(`A lance broken on the ${k.zone}! ${JT_NUM[p] || p} to ${jtSide(s)}.`);
    else if (JT_RULES.fouls.includes(k.at)) say.push(`${who}: ${JT_AT[k.at]}. Sir Ruddock takes a point off.`);
    else if (k.at === 'glance') say.push(`${who}'s lance glances off.`);
    else say.push(`${who} misses.`);
  }
  if (R0.heatOver && !R0.over) say.push(R0.heatOver.by === 'unhorse' ? `The heat ends there, ${R0.heatOver.tot[0]} to ${R0.heatOver.tot[1]}.` : `End of the heat: ${R0.heatOver.tot[0]} to ${R0.heatOver.tot[1]}.`);
  if (R0.tiltNow) say.push('Level! The tilt for the crown: the best riders, until one scores.');
  if (R0.over) say.push(`${jtSide(R0.over.win)} win the tourney, ${R0.over.text}!`);
  return say.join(' ');
}
// the splinters of a broken lance and the spark of a glance, for the drawing (not the match's state)
function jtSplinters(P) {
  if (!P) return;
  for (const s of [0, 1]) {
    const k = P.st[s]; if (!k.broke && k.at !== 'glance') continue;
    const n = k.broke ? 26 : 6;
    for (let i = 0; i < n; i++) GP.fx.push({ s, t: 0, life: k.broke ? 1.4 : .5, x: 0, y: 0, vx: (Math.random() - .5) * 5 + (s ? -1.5 : 1.5), vy: -Math.random() * 4 - 1, r: Math.random() * 6.28, vr: (Math.random() - .5) * 12, spark: !k.broke });
  }
}

/* ---------- the beat ---------- */
function jtTick(dt) {
  if (!GP || !G || !G.teams) return;
  GP.t += dt;
  for (const f of GP.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 9 * dt; f.r += f.vr * dt; }
  GP.fx = GP.fx.filter(f => f.t < f.life);
  const P = GP.ph;
  if (P === 'next') jtPlayNext();
  else if (P === 'herald') { if (GP.t >= JT_PLAY.pace.herald) jtCharge0(); }
  else if (P === 'charge') jtChargeTick(dt);
  else if (P === 'seat') jtSeatTick(dt);
  else if (P === 'after') { if (GP.t >= GP.wait) jtGo(G.over ? 'over' : 'next'); }
}
function jtWhere() { return jtInTilt() ? `The tilt for the crown, course ${G.course + 1}` : `Heat ${G.heat + 1}, course ${G.course + 1} of ${G.courses}`; }
function jtPlayNext() {
  const riders = jtRiders(); if (!riders) { jtGo('over'); return; }
  // (phase 3: the CPU's corners first, so its plan reads its rider and mount as they set off; yours waits for your call)
  // (phase 5: a side you manage is yours to call too; left to your squires, its corner is its own, a Knight's)
  const yours = jtCalls(GP.you), due = !!(G.cornerDue && G.cornerDue[GP.you]);
  jtCornersDue(yours && due ? GP.you : null);
  GP.jobs = yours && due ? jtCornerPlan(GP.you, 1).jobs : null;
  const left = GP.mode === 'manage' && GP.mgrAuto;
  GP.plans = [0, 1].map(s => jtCalls(s) ? null : left && s === GP.you ? jtSuggest(s) : jtPlanKept(s));
  if (left) GP.sel = Object.assign({}, GP.plans[GP.you]);
  const vs = `${jtName(0, riders[0])} (${jtSide(0)}) against ${jtName(1, riders[1])} (${jtSide(1)})`;
  if (yours) {
    GP.sel = jtSuggest(GP.you);
    const sq = GP.jobs ? ` Your corner: ${GP.jobs.map((j, i) => `${jtSqName(GP.you, i)} ${jtJobOf(j).v}`).join(', ')}.` : '';
    const go = jtYours(GP.you) ? 'Change the plan if you like, then Ride.' : 'Change the plan or the jobs if you like, then Send them: they ride on their ratings.';
    jtGo('plan', 0, `${jtWhere()}: ${vs}.${sq} Your squire says: ${GP.sel.aim === 'helm' ? 'the helm' : JT_PLAN.aim[GP.sel.aim].n}, ${GP.sel.guard}, at ${JT_PLAN.pace[GP.sel.pace].n} (${GP.sel.why}). ${go}`); return;
  }
  jtGo('herald', 0, `${jtWhere()}: ${vs}.${left ? ` Your squires call it: ${JT_PLAN.aim[GP.sel.aim].n}, ${GP.sel.guard}, at ${JT_PLAN.pace[GP.sel.pace].n}.` : ''}`);
}
// the course is committed: both riders have set off (the charge, the balance moment) or it has been ridden
const jtCommitted = () => !!GP && ['charge', 'seat', 'after', 'over'].includes(GP.ph);
/* the CPU's plan for side s this course: drawn once and kept in the match (G.cpuPlan, keyed on the course, so it is kept
   in a snapshot too), so switching modes, or saving and resuming, never draws it again (phase 5's review) */
function jtPlanKept(s) {
  const K = G.cpuPlan && G.cpuPlan.n === G.n ? G.cpuPlan : (G.cpuPlan = { n: G.n, p: [null, null] });
  if (!K.p[s]) K.p[s] = jtPlan(s);
  return Object.assign({}, K.p[s]);
}
function jtSetMode(m) {
  if (!GP || !JT_MODES.includes(m)) return;
  const was = GP.mode; GP.mode = m;
  if (m === was) return;
  // a plan you were making goes back to the CPU in Watch (and in Manage left to your squires); your course while the
  // herald names the riders (You ride or Manage picked then) is yours, on a plan made for it; a charge of yours handed
  // to Watch or Manage is ridden on by the CPU's hands for your side, and so is the balance moment (phase 2's review;
  // Manage, phase 5: a plan you were making in You ride stays yours to send, and the other way round)
  if (!jtCalls(GP.you) && GP.ph === 'plan') jtGo('next');
  else if (jtCalls(GP.you) && GP.ph === 'herald') jtGo('next');
  else if (m !== 'play' && GP.ph === 'charge' && GP.ch && GP.ch.mine) jtHandOver();
  else if (m !== 'play' && GP.ph === 'seat' && GP.P) { GP.P.lean[GP.you] = jtLean(GP.you); jtFinish(); }
}
// your charge handed to the CPU mid-way: its ride for your side, drawn now on your plan (your spur and hands are dropped)
function jtHandOver() {
  const C = GP.ch, s = GP.you;
  GP.cpuRides[s] = jtCharge(jtRideOpts(s, GP.plans[s]), R);
  C.mine = false; C.down = false; C.downAt = null; C.tipNow = null; GP.keyV = { x: 0, y: 0 };
}
// what the page needs, as a copy
function jtView() {
  if (!GP) return null;
  const C = GP.ch, M = GP.seatM, r = jtRiders();
  return { mode: GP.mode, you: GP.you, ph: GP.ph, mgrAuto: !!GP.mgrAuto, yard: !!G.yard, msg: GP.msg, call: GP.call, riders: r, heat: G.heat, course: G.course, inTilt: jtInTilt(),
    // (their plan is hidden in your plan beat, until both are committed: phase 4's review)
    // (and in every beat before the course is committed, the herald's and the one a switch of mode goes to: phase 5's review)
    sel: GP.sel ? Object.assign({}, GP.sel) : null, plans: GP.plans ? JSON.parse(JSON.stringify(GP.plans)).map((p, s) => !jtCommitted() && s !== GP.you ? null : p) : null,
    jobs: GP.jobs ? GP.jobs.slice() : null, squad: jtSquadView(),
    charge: C ? { p: C.p, mine: C.mine, pace: C.pace, hits: C.hit.length, bad: C.bad, spurQ: jtSpurQ(C), down: C.down, downAt: C.downAt, couch: jtCouchErr(C), hand: Object.assign({}, C.hand), tip: C.tipNow ? Object.assign({}, C.tipNow) : null } : null,
    seat: M ? { t: M.t, w: M.w, lean: M.lean, q: jtLeanQ(M) } : null, wind: G.wind.slice(),
    // (phase 13: both lances as they met, while your balance moment holds the course open: the Realm's sound hears them)
    hits: GP.P && GP.P.st ? GP.P.st.map(k => ({ broke: !!k.broke, zone: k.zone, at: k.at })) : null };
}
