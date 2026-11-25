/* The Tilting Lists: matches from the world (issue #117, phase 5). The Realm's matches are kept between courses, run in
   Manage, and the tilting yard is a practice run at a straw target.

   Kept between courses: jtSnapshot() is the match as it stands, plain JSON ({ G, mode, mgrAuto }); jtResume(sn) puts it
   back on the lists in the mode it was left in, and it plays on from there. A course being ridden when the match is
   left is ridden out first (jtFinishCourse: your charge and your balance moment handed to your side's own hands, as
   Watch would), so leaving never takes back a course. A snapshot taken while a course is being ridden keeps the plans
   committed (riding), and jtResume rides that course out on them first, so a reload never rides a course twice. The
   CPU's plan for a course is drawn once and kept in G (G.cpuPlan, 07-play.js), so it survives a save too (phase 5's
   review).
   Manage (07-play.js): jtManage({ auto }) leaves the calls to your squires (your squire's word and your corner's word,
   every course) or takes them back.
   The tilting yard (G.yard): jtStart({ yard: { runs }, teams: [your side] }) puts your first heat's rider on the lists
   against a straw target on a post (JT_STRAW: a quintain with a square shield) for a few runs, nothing at stake. Each
   run is the plan (the aim and the pace), then the spur, the couch and the aim, by hand as on Play; the straw target
   doesn't ride or strike back, nobody keeps a seat, the mount gets its wind back and the arm its strength between
   runs, and no rules are scored. Each run is logged in G.yard.done ({ n, aim, pace, at, zone, broke, pts (what it would
   have scored), spurQ, hits, bad, beats, couch, up, off (inches off the mark), speed, hand }), the herald says how it went
   (jtYardCall), and after the last the yard's summary (jtYardSummary) goes to onOver. Watch shows a run ridden by your
   rider's own hands. Wraps (in this scope): jtStart (the yard's straw side), jtPlayNext (the yard's runs), jtCharge0 (the
   straw target stands still), jtImpactNow (a run's strike, and no seat). */
const JT_STRAW = { runs: 5, team: { name: 'The straw targets', short: 'STR', color: '#b89a52' }, d: { guard: 'square', aim: 'shield', rs: { shield: .5, seat: 1 }, mount: 'destrier' } };
const JT_W5 = { start: jtStart, playNext: jtPlayNext, charge0: jtCharge0, impact: jtImpactNow };

/* ---------- kept between courses ---------- */
// (a course being ridden is kept with it: riding, the plans committed, so a resume rides it out on them and never rides
// it twice or takes it back: phase 5's review)
function jtSnapshot() {
  if (!G || !G.teams || G.yard) return null;
  const sn = { G, mode: GP ? GP.mode : 'watch', mgrAuto: !!(GP && GP.mgrAuto) };
  if (GP && ['charge', 'seat'].includes(GP.ph) && Array.isArray(GP.plans)) sn.riding = GP.plans.map(p => p && { aim: p.aim, guard: p.guard, pace: p.pace, why: p.why || '' });
  return JSON.parse(JSON.stringify(sn));
}
function jtResume(sn) {
  if (!sn || !sn.G || !sn.G.teams) return null;
  G = JSON.parse(JSON.stringify(sn.G)); GB = null;
  // a course left being ridden: ridden out now, on the plans committed, by each side's own hands
  const ev = Array.isArray(sn.riding) && !G.over && jtRiders() ? jtRideCourse([0, 1].map(s => sn.riding[s] || jtPlan(s))) : null;
  jtPlayStart({ mode: sn.mode, mgrAuto: sn.mgrAuto });
  if (ev) { GP.call = jtHerald(ev); GP.msg = `Back at the Lists. The course you were riding was ridden out: ${GP.call}`; }
  if (!GP.msg) GP.msg = `Back at the Lists: ${jtMatchText(0).toLowerCase()}.`;
  if (ev && G.over && JT_HOOK.onOver) try { JT_HOOK.onOver(jtSummary()); } catch (e) { console.error(e); }
  return G;
}
// a course being ridden, ridden out now (your charge and balance moment by your side's own hands); true when nothing is
// left mid-course
function jtFinishCourse() {
  if (!GP || !G || !G.teams) return false;
  if (GP.ph === 'charge' && GP.ch) { if (GP.ch.mine) jtHandOver(); let n = 0; while (GP.ph === 'charge' && n++ < 2000) jtChargeTick(.05); }
  if (GP.ph === 'seat' && GP.P) { if (GP.P.lean[GP.you] == null) GP.P.lean[GP.you] = jtLean(GP.you); jtFinish(); }
  return !['charge', 'seat'].includes(GP.ph);
}
/* Manage: { auto: true } leaves the calls to your squires, false takes them back. Returns '' or why not */
function jtManage(o) {
  if (!GP) return 'No match.';
  const was = !!GP.mgrAuto; GP.mgrAuto = !!(o && o.auto);
  if (GP.mode !== 'manage' || was === GP.mgrAuto || G.over) return '';
  // (your plan beat handed to your squires goes on at once; their call taken back before the charge is yours again)
  if (GP.mgrAuto && GP.ph === 'plan') jtGo('next');
  else if (!GP.mgrAuto && GP.ph === 'herald') jtGo('next');
  return '';
}

/* ---------- the tilting yard ---------- */
function jtStrawTeam() { return Object.assign({}, JT_STRAW.team, { roster: [0, 1, 2, 3].map(i => ({ n: i ? `Straw target ${i + 1}` : 'The straw target', kind: '' })) }); }
jtStart = function (opts) {
  const o = opts || {};
  if (!o.yard) return JT_W5.start(o);
  const mine = (o.teams || [])[0] || null, runs = clamp(((o.yard && o.yard.runs) | 0) || JT_STRAW.runs, 1, 20);
  JT_W5.start(Object.assign({}, o, { teams: [mine, jtStrawTeam()], skill: [((o.skill || [])[0] ?? 1), 0], riders: [(o.riders || [])[0] || (mine && mine.riders) || null, [0, 1]], courses: 3 }));
  G.yard = { runs, done: [] };
  return G;
};
jtPlayNext = function () {
  if (!G || !G.yard) return JT_W5.playNext();
  const Y = G.yard;
  if (Y.done.length >= Y.runs) { jtYardOver(); return; }
  const riders = jtRiders(), s = GP.you, prev = GP.sel;
  GP.jobs = null;
  GP.sel = { aim: prev ? prev.aim : 'shield', guard: 'square', pace: prev ? prev.pace : 'canter', why: '' };
  GP.plans = [jtCalls(s) ? null : Object.assign({}, GP.sel), Object.assign({}, JT_STRAW.d, { pace: 'canter' })];
  const who = `${jtName(s, riders[s])} on a ${jtMount(jtMountOf(s)).n}`;
  if (jtCalls(s)) { jtGo('plan', 0, `Run ${Y.done.length + 1} of ${Y.runs} at the straw target, ${who}. Pick your mark and your pace, then Ride: tap with the hoofbeats, hold to couch, and keep the tip on the mark.`); return; }
  jtGo('herald', 0, `Run ${Y.done.length + 1} of ${Y.runs} at the straw target: ${who} shows you how.`);
};
jtCharge0 = function () {
  JT_W5.charge0();
  if (!G || !G.yard || !GP.cpuRides) return;
  // (the straw target stands still with its lance up: it never strikes)
  GP.cpuRides[1] = Object.assign({ pace: 'canter', speed: 0, couch: 0, tip: { x: 0, y: 60 }, up: true }, JT_STRAW.d);
};
jtImpactNow = function () {
  if (!G || !G.yard) return JT_W5.impact();
  const C = GP.ch, s = GP.you, Y = G.yard, ride = C.mine ? jtYourRide(C) : GP.cpuRides[s];
  const st = jtStrike(ride, JT_STRAW.d, R), pts = jtStrikePts({ at: st.at, unhorse: false }), A = JT_PLAN.aim[ride.aim];
  const beats = Math.max(1, Math.floor(JT_PLAY.spur.until * JT_PLAY.charge / jtBeat(C.pace)));
  const run = { n: Y.done.length + 1, aim: ride.aim, pace: ride.pace, at: st.at, zone: st.zone, broke: st.broke, pts, spurQ: C.mine ? +jtSpurQ(C).toFixed(3) : null,
    hits: C.mine ? C.hit.length : null, bad: C.mine ? C.bad : null, beats, couch: ride.up ? null : +(+ride.couch || 0).toFixed(3), up: !!ride.up, off: ride.up ? null : +Math.hypot(ride.tip.x - A.x, ride.tip.y - A.y).toFixed(1), speed: +ride.speed.toFixed(2), hand: !!C.mine };
  Y.done.push(run); G.n++;
  jtSplinters({ st: [st, { broke: false, at: 'miss' }] });
  const miss = { at: 'miss', unhorse: false };
  GP.last = { heat: 0, course: Y.done.length - 1, tilt: false, riders: C.riders, plans: GP.plans.map(p => ({ aim: p.aim, guard: p.guard, pace: p.pace })), res: [{ at: st.at, unhorse: false }, miss],
    pts: [pts, 0], zone: [st.zone, 'miss'], broke: [st.broke, false], lean: [null, null], rides: [{ speed: ride.speed, couch: ride.couch, tip: ride.tip, spurQ: run.spurQ, up: run.up }, { speed: 0, couch: 0, tip: { x: 0, y: 60 }, spurQ: null, up: true }],
    unhorsed: [], rule: { heatOver: null, tiltNow: false, over: null }, yard: run };
  GP.call = jtYardCall(run);
  GP.ch = null; GP.P = null; GP.seatM = null; GP.keyV = { x: 0, y: 0 };
  jtGo('after', JT_PLAY.pace.after, GP.call);
};
// a run in the herald's words: where the lance went, then the spur, the couch and the aim
function jtYardCall(r) {
  const where = r.broke ? `A lance broken on the ${r.zone}! ${r.zone === 'helm' ? 'That would be two.' : 'That would be one.'}` : r.at === 'glance' ? 'It glances off the straw.'
    : JT_RULES.fouls.includes(r.at) ? `${jtCap(JT_AT[r.at])}: that would be a point off.` : r.up ? 'The lance came up: a miss.' : 'A miss.';
  if (!r.hand) return `${where} (Ridden by your rider's own hands.)`;
  const spur = `Spur: ${r.hits} of ${r.beats} on the beat${r.bad ? `, ${r.bad} off it (a stumble costs)` : ''}`, c = r.couch;
  const couch = c == null ? 'the lance never couched' : c < -.35 ? 'couched early (the arm tires and the tip droops)' : c > .35 ? 'couched late (the tip never settles)' : 'couched just right';
  const aim = r.off == null ? '' : `, the tip ${r.off < 2 ? 'right on' : `${Math.round(r.off)} inch${Math.round(r.off) === 1 ? '' : 'es'} off`} your mark`;
  return `${where} ${spur}, ${couch}${aim}.`;
}
function jtYardSummary() {
  if (!G || !G.yard) return null;
  const D = G.yard.done, n = D.length, by = f => D.filter(f).length, hand = D.filter(r => r.hand);
  const out = { yard: true, runs: JSON.parse(JSON.stringify(D)), n, breaks: by(r => r.broke), helms: by(r => r.broke && r.zone === 'helm'), glances: by(r => r.at === 'glance'), misses: by(r => r.at === 'miss'),
    fouls: by(r => JT_RULES.fouls.includes(r.at)), pts: D.reduce((a, r) => a + r.pts, 0), spur: hand.length ? +(hand.reduce((a, r) => a + r.spurQ, 0) / hand.length).toFixed(2) : null,
    couched: hand.filter(r => r.couch != null && Math.abs(r.couch) <= .35).length, hand: hand.length };
  out.text = `${n} run${n === 1 ? '' : 's'} at the straw target: ${out.breaks} lance${out.breaks === 1 ? '' : 's'} broken${out.helms ? ` (${out.helms} on the helm)` : ''}, ${out.glances} glance${out.glances === 1 ? '' : 's'}, ${out.misses} miss${out.misses === 1 ? '' : 'es'}${out.fouls ? `, ${out.fouls} foul${out.fouls === 1 ? '' : 's'}` : ''}.`
    + (out.hand ? ` Spurred ${Math.round(100 * out.spur)}% on the beat, couched just right ${out.couched} of ${out.hand}.` : '');
  return out;
}
function jtYardOver() {
  const S = jtYardSummary();
  G.over = { win: 0, tot: [S.pts, 0], tilt: 0, text: 'the tilting yard', yard: true };
  GP.call = S.text;
  jtGo('over', 0, S.text);
  if (JT_HOOK.onOver) try { JT_HOOK.onOver(S); } catch (e) { console.error(e); }
}

/* ---------- drawing the yard ---------- */
// the straw target on its post, at the meeting point on the far side; it rocks when a lance breaks on it
function jtStrawDraw(c, x, y, k) {
  const L = GP && GP.last, hit = GP && (GP.ph === 'after' || GP.ph === 'over') && L && L.broke && L.broke[0], rock = hit ? Math.sin(GP.t * 14) * Math.exp(-GP.t * 2.5) * .12 : 0;
  c.save();
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, y, .5 * k, .08 * k, 0, 0, 6.28); c.fill();
  c.fillStyle = '#6a4a2e'; c.fillRect(x - .06 * k, y - 2.3 * k, .12 * k, 2.3 * k);
  c.translate(x, y - 2.3 * k); c.rotate(rock);
  c.fillStyle = '#6a4a2e'; c.fillRect(-.06 * k, -.9 * k, .12 * k, .9 * k); c.fillRect(-.5 * k, -.62 * k, k, .08 * k);
  c.fillStyle = '#e0c060'; c.strokeStyle = '#8a6a2a'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, -.45 * k, .3 * k, .42 * k, 0, 0, 6.28); c.fill(); c.stroke();
  c.beginPath(); c.arc(0, -1.02 * k, .17 * k, 0, 6.28); c.fill(); c.stroke();
  c.strokeStyle = '#b8962a'; c.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * .07 * k, -.8 * k); c.lineTo(i * .09 * k, -.08 * k); c.stroke(); }
  jtShield(c, -.04 * k, -.45 * k, k / 62, '#8a5a2a', 'square', false);
  c.restore();
}
// the yard's board: a pennant a run, what it would have scored on it
function jtYardBoardDraw(c) {
  const Y = G.yard, x0 = 10, y0 = 10, w = 170 + Y.runs * 24 + 46, T = G.teams[0];
  c.save(); c.fillStyle = 'rgba(24,20,16,.78)'; rr(c, x0, y0, Math.min(w, JT_VIEW.w - 20), 44, 8); c.fill();
  c.fillStyle = T.color || '#888'; c.fillRect(x0 + 8, y0 + 18, 6, 18);
  txt(c, 'The tilting yard', x0 + 20, y0 + 32, '700 13px "Alegreya Sans", sans-serif', '#f2ece0');
  txt(c, 'Runs at the straw target', x0 + 170, y0 + 12, '600 9px "Alegreya Sans", sans-serif', '#c8bfae');
  let x = x0 + 170;
  for (let i = 0; i < Y.runs; i++, x += 24) { const r = Y.done[i]; jtFlag(c, x, y0 + 28, r ? r.pts : null, !r && i === Y.done.length && !G.over, T.color); }
  txt(c, String(Y.done.reduce((a, r) => a + r.pts, 0)), x + 12, y0 + 33, '800 16px "Alegreya Sans", sans-serif', '#ffe08a', 'center');
  c.restore();
}
