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
     hand, plus a little of your rider's own miss (JT_PLAY.aim.noise of the spread), less the droop.
   - the impact, then the seat: if their lance broke on you, a short balance moment follows: the rider wobbles and you
     lean against it (the arrows, drag, or the Lean buttons). How well you held it is your lean (0 to 1) for seat().
   Watch: the CPU rides both. You ride: your side's courses are yours (side 0). */
const JT_PLAY = { charge: 3.6, spur: { until: .42, win: .09, min: .86, beat: { canter: .46, gallop: .34 } }, couch: { ideal: .66, span: .3, high: 40 },
  aim: { eight: 2.6, noise: .3, reach: 18, key: 40 }, seat: { time: 1.4, amp: 1, key: 2.6 }, pace: { herald: 1.2, after: 2.4, heat: 3.2, over: 3.4 } };
const JT_HOOK = { onPhase: null, onPick: null, onOver: null };
const JT_MODES = ['watch', 'play'];
let GP = null;

function jtPlayStart(o) {
  GP = { mode: JT_MODES.includes(o && o.mode) ? o.mode : 'watch', you: 0, ph: 'next', t: 0, wait: 0, msg: '', sel: null, plans: null, cpuRides: null, ch: null, seatM: null, P: null, last: null, call: '', fx: [] };
  jtGo('next');
  return GP;
}
function jtGo(ph, wait, msg) {
  GP.ph = ph; GP.t = 0; GP.wait = wait || 0; if (msg != null) GP.msg = msg;
  if (JT_HOOK.onPhase) try { JT_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
const jtName = (s, ri) => (G.teams[s].roster[ri] || {}).n || 'Someone';
const jtYours = s => GP.mode === 'play' && s === GP.you;
const jtSide = s => G.teams[s].name;
function jtPicked() { if (JT_HOOK.onPick) try { JT_HOOK.onPick(); } catch (e) { console.error(e); } }

/* ---------- your plan ---------- */
// your squire's word: the plan a Knight would ride here, with the reason
function jtSuggest(s) {
  const keep = G.skill[s]; G.skill[s] = 1; let P;
  try { P = jtPlan(s); } finally { G.skill[s] = keep; }
  return { aim: P.aim, guard: P.guard, pace: P.pace, why: P.why };
}
/* change your plan: { aim, guard, pace, suggest }. Returns '' or why not */
function jtSelect(o) {
  if (!GP || GP.ph !== 'plan' || !GP.sel) return 'Not now.';
  o = o || {};
  if (o.suggest) { GP.sel = jtSuggest(GP.you); jtPicked(); return ''; }
  const S = Object.assign({}, GP.sel);
  for (const k of ['aim', 'guard', 'pace']) if (o[k] != null) { if (!jtOwn(JT_PLAN[k], o[k])) return `No such ${k}.`; S[k] = o[k]; }
  GP.sel = S; jtPicked(); return '';
}

/* ---------- the charge ---------- */
const jtBeat = pace => JT_PLAY.spur.beat[jtBeatPace(pace)];
const jtBeatPace = pace => jtOwn(JT_PLAY.spur.beat, pace) ? pace : 'canter';
// a press: in your plan it rides; in the spur a tap; after the spur it lowers the lance (held: jtCouch(false) lets go)
function jtPress() {
  if (!GP || GP.mode !== 'play') return false;
  if (GP.ph === 'plan' && GP.sel) { jtCharge0(); return true; }
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
  if (on && !C.down) { C.down = true; C.downAt = C.p; } else if (!on && C.down) { C.down = false; C.downAt = null; }
  return true;
}
// the hand on the lance: set where it holds the tip (inches off the mark), or move it at a speed (the arrows)
function jtAim(x, y) { const C = GP && GP.ch; if (!C || !C.mine) return false; const R0 = JT_PLAY.aim.reach; C.hand = { x: clamp(+x || 0, -R0, R0), y: clamp(+y || 0, -R0, R0) }; return true; }
function jtNudge(vx, vy) { if (GP) GP.keyV = { x: clamp(vx || 0, -1, 1), y: clamp(vy || 0, -1, 1) }; }
// your lean in the balance moment (-1 left to 1 right), or set by the arrows' speed
function jtLeanTo(v) { const M = GP && GP.seatM; if (!M) return false; M.lean = clamp(+v || 0, -1.5, 1.5); return true; }
function jtCharge0() {
  const riders = jtRiders(); if (!riders) return;
  const plans = [0, 1].map(s => jtYours(s) ? Object.assign({}, GP.sel) : GP.plans[s]);
  // the CPU's rides are drawn as it sets off (the page draws its lance from them); yours is built as you ride
  const cpuRides = [0, 1].map(s => jtYours(s) ? null : jtCharge({ plan: plans[s], rs: jtRsOf(s, riders[s]), mount: jtMountOf(s), wind: G.wind[s], hands: jtHands(s) }, R));
  const mine = jtYours(0) || jtYours(1), s = GP.you;
  GP.plans = plans; GP.cpuRides = cpuRides; GP.keyV = { x: 0, y: 0 };
  GP.ch = { p: 0, mine, pace: mine ? plans[s].pace : plans[0].pace, hit: [], taps: [], bad: 0, down: false, downAt: null, hand: { x: 0, y: 0 }, tipNow: null, riders };
  jtGo('charge', 0, mine ? `${jtName(s, riders[s])} sets off. Tap with the hoofbeats to spur, then hold to couch the lance, and keep the tip on ${JT_PLAN.aim[plans[s].aim].n}.` : `${jtName(0, riders[0])} and ${jtName(1, riders[1])} set off down the lists…`);
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
  return jtSway({ pace: GP.plans[s].pace, mount: jtMountOf(s), rs: jtRsOf(s, ri), wind: G.wind[s], couch: e == null ? 0 : e, hands: 1 });
}
// where your tip is now (inches, on their target), once couched; null while the lance is up
function jtTipNow(C) {
  if (!C.down) return null;
  const A = JT_PLAN.aim[GP.plans[GP.you].aim], sw = jtYourSway(C), E = jtEight(C.p * JT_PLAY.charge, sw.sigma * JT_PLAY.aim.eight, GP.plans[GP.you].pace);
  return { x: A.x + E.x + C.hand.x, y: A.y + E.y + C.hand.y - sw.droop };
}
// your ride at impact, for the model
function jtYourRide(C) {
  const s = GP.you, ri = C.riders[s], plan = GP.plans[s], rs = jtRsOf(s, ri), mount = jtMountOf(s), q = jtSpurQ(C), e = jtCouchErr(C);
  const speed = jtSpeed({ pace: plan.pace, mount, rs, wind: G.wind[s] }) * (JT_PLAY.spur.min + (1 - JT_PLAY.spur.min) * q);
  const A = JT_PLAN.aim[plan.aim];
  if (e == null) return { aim: plan.aim, guard: plan.guard, pace: plan.pace, mount, rs, speed, couch: 1, tip: { x: A.x, y: A.y + JT_PLAY.couch.high }, spurQ: q, up: true };
  const sw = jtYourSway(C), t = jtTipNow(C);
  return { aim: plan.aim, guard: plan.guard, pace: plan.pace, mount, rs, speed, couch: e, tip: { x: t.x + gauss() * sw.sigma * JT_PLAY.aim.noise, y: t.y + gauss() * sw.sigma * JT_PLAY.aim.noise }, spurQ: q };
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
    pts: ev.rule.pts, zone: ev.imp.st.map(x => x.zone), broke: ev.imp.st.map(x => x.broke), lean: ev.lean, rides: ev.rides.map(r => ({ speed: r.speed, couch: r.couch, tip: r.tip, spurQ: r.spurQ ?? null, up: !!r.up })),
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
  GP.plans = [0, 1].map(s => jtYours(s) ? null : jtPlan(s));
  const vs = `${jtName(0, riders[0])} (${jtSide(0)}) against ${jtName(1, riders[1])} (${jtSide(1)})`;
  if (jtYours(GP.you)) { GP.sel = jtSuggest(GP.you); jtGo('plan', 0, `${jtWhere()}: ${vs}. Your squire says: ${GP.sel.aim === 'helm' ? 'the helm' : JT_PLAN.aim[GP.sel.aim].n}, ${GP.sel.guard}, at ${JT_PLAN.pace[GP.sel.pace].n} (${GP.sel.why}). Change the plan if you like, then Ride.`); return; }
  jtGo('herald', 0, `${jtWhere()}: ${vs}.`);
}
function jtSetMode(m) {
  if (!GP || !JT_MODES.includes(m)) return;
  GP.mode = m;
  // a plan you were making goes back to the CPU in Watch; a charge in progress finishes as it began
  if (m !== 'play' && GP.ph === 'plan') jtGo('next');
}
// what the page needs, as a copy
function jtView() {
  if (!GP) return null;
  const C = GP.ch, M = GP.seatM, r = jtRiders();
  return { mode: GP.mode, you: GP.you, ph: GP.ph, msg: GP.msg, call: GP.call, riders: r, heat: G.heat, course: G.course, inTilt: jtInTilt(),
    sel: GP.sel ? Object.assign({}, GP.sel) : null, plans: GP.plans ? JSON.parse(JSON.stringify(GP.plans)) : null,
    charge: C ? { p: C.p, mine: C.mine, pace: C.pace, hits: C.hit.length, bad: C.bad, spurQ: jtSpurQ(C), down: C.down, downAt: C.downAt, couch: jtCouchErr(C), hand: Object.assign({}, C.hand), tip: C.tipNow ? Object.assign({}, C.tipNow) : null } : null,
    seat: M ? { t: M.t, w: M.w, lean: M.lean, q: jtLeanQ(M) } : null, wind: G.wind.slice() };
}
