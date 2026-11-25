/* The Tilting Lists: the ground's own ways (issue #117, phase 8), as the Ash Bowl's, the Anvil Ring's and Graftonbury's
   are theirs. A match has them when started with { ground: true } (the Realm's matches at the Lists do; the bare engine,
   its tests and the labs don't, unless asked; the tilting yard never). With them off nothing here acts and nothing draws
   from the seeded stream, so a match plays exactly as before.
   - The churned sand. Every course cuts each side's lane (G.ground.rut, 0 to 1 a side): a gallop cuts deep, a canter a
     little (JT_GND.cut), and a rider who rides beside the rut cuts it only half as much. Before each course each rider
     picks a line (the plan's line: JT_LINE): in the rut, the deep furrow steadies the tip but slows the mount (JT_GND.rut,
     by the depth); beside it, the mount keeps its pace but the stride jolts the aim (JT_GND.jolt, by the depth). On
     smooth sand the two are the same. Sir Ruddock rakes the lists at the end of every heat (and before the tilt for the
     crown), so each heat starts smooth.
   - The pennant wind. Before each course a crosswind is drawn from the seeded stream (G.ground.wind: { k, dir }; k 0 to
     1, how hard; dir 1 blowing from the gallery toward the near side, -1 the other way), and it comes and goes: each
     course keeps some of the last (JT_GND.wind.keep) and now and then turns (flip). As the gap closes it pushes each
     lance tip sideways (jtGndPush: JT_GND.wind.push inches at full strength, more at a gallop), and its gusts throw the
     tip about (jtGustK: more sway, which no hands aim into). The riders pass left side to left side, so the same wind
     pushes one rider's tip toward the other's shield and the other's away from it. The CPU aims into it as far as its
     hands can (JT_GND.into: a Squire not at all, a Knight most of it, an Archmage nearly all); on Play you see your tip
     drift and hold it there yourself.
   - The CPU reads both by skill (jtLineFor): a Squire picks a line on a whim and doesn't mind the wind; a Knight works
     out both lines on the model (its own stream, never the match's) against a plain rider, and aims into the wind; an
     Archmage works out both lines and how far to aim into the wind (none, half or all: a push from the shield onto the
     body helps a shield lance, so it can let the wind carry it) against the rider it faces and its read of their guard.
     Your squire's word does the Archmage's sum for your own hands, and says where to hold the tip.
   Lab only: ground: { sand: false } or { wind: false } leaves one of the two out (the wind is still drawn), and lineBy
   holds a side to one line.
   It is drawn: the furrows on the sand in each lane, darker as they deepen; the pennants stream with the wind (limp when
   it drops, taut and snapping when it blows); a panel names both; your tip's drift shows on the target as the wind
   pushes it.
   G.ground = { rut: [2], wind: { k, dir }, n (the course the wind is for), log: [{ n, heat, course, tilt, rut: [2], line:
   [2], wind, push: [2] }], tally: { rut: [2], side: [2], rakes, winds }, said (Sir Ruddock's line, for the status line),
   lineBy (lab only: a line a side, or null), sand, blow (lab only: false leaves the sand or the wind out) }, plain JSON
   in G, so the snapshot keeps it. A plan carries line ('rut' or 'side') and, from an Archmage or your squire, into (the
   share of the push it aims back).
   Wraps (in this scope): jtStart (the sand raked, the first wind), jtPlan (the CPU's line, with the reason), jtSuggest
   (your squire's line and the wind), jtSelect (line), jtRideOpts (the ground for the ride), jtCharge (the line's sway and
   speed, the wind's push), jtYourSway, jtTipNow and jtYourRide (the same on Play), jtCourseClose (the ruts cut, the rake,
   the next wind), jtHerald (the rake), jtPlayNext (Sir Ruddock's line), jtSnapshot (the line of a course being ridden),
   jtSummary, jtView, jtPennant, jtListsDraw, jtTargetDraw and jtDraw (the drawing). */
const JT_GND = {
  cut: { canter: .12, gallop: .24 }, side: .5, max: 1,
  rut: { sway: .22, speed: .25 }, jolt: { sway: .15 },
  wind: { push: 6, gust: .25, gallop: 1.35, keep: .5, flip: .3, lo: .05, hi: 1, close: .42 },
  into: [0, .7, .9],
  read: { n: 240, seed: 1178 }
};
const JT_LINE = { rut: { n: 'in the rut', v: 'rides the rut' }, side: { n: 'beside the rut', v: 'rides beside the rut' } };
const JT_LINES = Object.keys(JT_LINE);
const JT_W13 = { start: jtStart, plan: jtPlan, suggest: jtSuggest, select: jtSelect, rideOpts: jtRideOpts, charge: jtCharge, yourSway: jtYourSway, tipNow: jtTipNow,
  yourRide: jtYourRide, close: jtCourseClose, herald: jtHerald, playNext: jtPlayNext, snapshot: jtSnapshot, summary: jtSummary, view: jtView, pennant: jtPennant,
  listsDraw: jtListsDraw, targetDraw: jtTargetDraw, draw: jtDraw };
const jtGndR = v => Math.round(v * 1000) / 1000;
const jtLineOk = l => jtOwn(JT_LINE, l);

/* ---------- a match's ground ---------- */
// the wind for the next course: some of the last kept, now and then turning (two draws from the match's stream)
// (rnd: a resumed course's seeded stream, so a reload brings the same wind for the next course; R otherwise)
function jtGndWind(prev, rnd) {
  const W = JT_GND.wind, rr = rnd || R, a = rr(), b = rr();
  if (!prev) return { k: jtGndR(W.lo + a * .8 * (W.hi - W.lo)), dir: b < .5 ? 1 : -1 };
  return { k: jtGndR(clamp(W.keep * prev.k + (1 - W.keep) * a * .9 * W.hi, W.lo, W.hi)), dir: b < W.flip ? -prev.dir : prev.dir };
}
jtStart = function (opts) {
  const g = JT_W13.start(opts), o = opts || {};
  if (!o.ground || G.yard) return g;
  const lb = Array.isArray(o.lineBy) ? [0, 1].map(s => jtLineOk(o.lineBy[s]) ? o.lineBy[s] : null) : null;
  // (lab only: ground: { sand: false } or { wind: false } leaves one of the two out; the wind is drawn all the same)
  const part = k => !(o.ground && typeof o.ground === 'object' && o.ground[k] === false);
  G.ground = { rut: [0, 0], wind: jtGndWind(null), n: G.n, log: [], tally: { rut: [0, 0], side: [0, 0], rakes: 0, winds: 1 }, said: '', lineBy: lb, sand: part('sand'), blow: part('wind') };
  G.ground.said = `Sir Ruddock: "Raked smooth for the first heat. ${jtWindWords(G.ground.wind, true)}; watch the pennants."`;
  return g;
};
const jtGndOn = () => !!(G && G.teams && G.ground && !G.yard);
// the wind in words: "a stiff wind from the gallery"
function jtWindWords(w, cap) {
  const k = w.k, how = k < .2 ? 'barely a breath of wind' : k < .45 ? 'a light wind' : k < .7 ? 'a fresh wind' : 'a stiff wind', t = `${how} ${w.dir > 0 ? 'from the gallery' : 'toward the gallery'}`;
  return cap ? jtCap(t) : t;
}
// the wind's push on side s's tip at impact, in the target's inches (+ to the other rider's right, away from their
// shield), on a pace. The wind from the gallery (dir 1) blows toward the near side: it pushes side 0's tip onto side 1's
// shield and side 1's tip off side 0's shield, toward the body; toward the gallery, the other way round
function jtGndPush(s, pace) {
  if (!jtGndOn() || G.ground.blow === false) return 0;
  const w = G.ground.wind, W = JT_GND.wind;
  return (s === 0 ? -1 : 1) * w.dir * W.push * w.k * (jtPick('pace', pace, 'canter') === 'gallop' ? W.gallop : 1);
}
// the wind's gusts: they throw the tip about as well as pushing it, more the harder it blows and at a gallop (no hands aim
// into a gust: 1 on a still day)
function jtGustK(pace) {
  if (!jtGndOn() || G.ground.blow === false) return 1;
  return 1 + JT_GND.wind.gust * G.ground.wind.k * (jtPick('pace', pace, 'canter') === 'gallop' ? JT_GND.wind.gallop : 1);
}
// a line's sway and speed for side s at the depth of its rut: { sway, speed }
function jtLineK(s, line) {
  const d = jtGndOn() && G.ground.sand !== false ? clamp(G.ground.rut[s] || 0, 0, 1) : 0;
  return line === 'side' ? { sway: 1 + JT_GND.jolt.sway * d, speed: 1 } : { sway: 1 - JT_GND.rut.sway * d, speed: 1 - JT_GND.rut.speed * d };
}
// the ground on side s's ride on plan: { line, sway, speed, push, into } (into: the inches its hands aim back into the
// wind: plan.into, a share of the push, as far as its hands can (JT_GND.into by skill; free: a sum for your own hands),
// and all they can when the plan doesn't say)
function jtGndFor(s, plan) {
  const line = jtLineOk(plan && plan.line) ? plan.line : 'rut', K = jtLineK(s, line), push = jtGndPush(s, plan && plan.pace);
  const cap = plan && plan.free ? 1 : JT_GND.into[jtHandsK(s)], f = plan && Number.isFinite(plan.into) ? Math.min(clamp(plan.into, 0, 1), cap) : cap;
  return { line, sway: K.sway * jtGustK(plan && plan.pace), speed: K.speed, push, into: push * f };
}
jtRideOpts = function (s, plan) { const o = JT_W13.rideOpts(s, plan); if (jtGndOn()) o.gnd = jtGndFor(s, plan); return o; };
// the ride on the ground: the line's sway (through the hands' spread) and speed, and the wind's push less what the hands aim into it
jtCharge = function (o, rnd) {
  const g = o && o.gnd; if (!g) return JT_W13.charge(o, rnd);
  const H = o.hands || { aim: 1, couch: .3 }, ride = JT_W13.charge(Object.assign({}, o, { hands: Object.assign({}, H, { aim: (H.aim ?? 1) * g.sway }) }), rnd);
  ride.speed *= g.speed; ride.tip = { x: ride.tip.x + g.push - g.into, y: ride.tip.y };
  ride.gnd = { line: g.line, push: jtGndR(g.push), into: jtGndR(g.into) };
  return ride;
};

/* ---------- on Play ---------- */
const jtYourLine = () => GP && GP.plans && GP.plans[GP.you] && jtLineOk(GP.plans[GP.you].line) ? GP.plans[GP.you].line : 'rut';
jtYourSway = function (C) { const r = JT_W13.yourSway(C); if (jtGndOn()) r.sigma *= jtLineK(GP.you, jtYourLine()).sway * jtGustK(GP.plans[GP.you].pace); return r; };
// your tip drifts with the wind as the gap closes (the whole push at the impact): hold it there yourself
const jtGndClose = p => clamp((p - JT_GND.wind.close) / (1 - JT_GND.wind.close), 0, 1);
jtTipNow = function (C) {
  const t = JT_W13.tipNow(C); if (!t || !jtGndOn()) return t;
  return { x: t.x + jtGndPush(GP.you, GP.plans[GP.you].pace) * jtGndClose(C.p), y: t.y };
};
jtYourRide = function (C) {
  const r = JT_W13.yourRide(C); if (!jtGndOn()) return r;
  const line = jtYourLine();
  r.speed *= jtLineK(GP.you, line).speed; r.gnd = { line, push: jtGndR(r.up ? 0 : jtGndPush(GP.you, r.pace)), into: 0 };
  return r;
};

/* ---------- the line and the wind, by skill ---------- */
/* side s's line on plan, and how far into the wind it aims: { line, into (a share of the push, or undefined: all its
   hands can), why, wind (the wind's part of the reason) }. sk: a skill, or 'word' (your squire's: the Archmage's sum,
   for your own hands). A Squire picks a line on a whim and doesn't mind the wind; a Knight works out both lines on the
   model against a plain rider with a square shield, and aims into the wind as far as its hands can; an Archmage (and
   your squire) works out both lines and how far to aim into the wind (none, half, all: a wind carrying a shield lance
   onto the body can be let carry it) against the rider it faces, their shield angled as often as it reads. On smooth
   sand there is no line to pick, and on a breath of wind nothing to aim into */
function jtLineFor(s, plan, sk) {
  if (!jtGndOn() || !jtRiders()) return { line: 'rut', why: '', wind: '' };
  if (sk == null) sk = G.skill[s];
  const d = G.ground.sand === false ? 0 : G.ground.rut[s] || 0, pct = Math.round(100 * d), lb = G.ground.lineBy && G.ground.lineBy[s], push = jtGndPush(s, plan.pace), calm = Math.abs(push) < .6;
  const word = sk === 'word', squire = sk === 0 || sk === '0', read = !squire && sk !== 1;
  let line = 'rut', into;
  if (lb) line = lb;
  else if (d >= .04 && squire) line = R() < .5 ? 'rut' : 'side';
  if (!squire) {
    const lines = lb || d < .04 ? [line] : JT_LINES, shares = read && !calm ? [0, .5, 1] : [undefined];
    let best = null;
    for (const l of lines) for (const f of shares) {
      const q = Object.assign({}, plan, { line: l }, f == null ? {} : { into: word ? f : f * JT_GND.into[2] }, word ? { free: true } : {});
      const v = lines.length * shares.length > 1 ? jtLineVal(s, q, read) : 0;
      if (!best || v > best.v + 1e-9) best = { l, f: q.into, v };
    }
    line = best.l; into = best.f;
  }
  const why = lb ? `held ${JT_LINE[lb].n} (a lab)` : d < .04 ? 'the sand smooth' : squire ? `${JT_LINE[line].n}, on a whim`
    : line === 'rut' ? `in the rut (${pct}% deep: a steadier tip is worth the slower mount${plan.aim === 'helm' ? ' at the helm' : ''})` : `beside the rut (${pct}% deep: the speed is worth the jolt${plan.pace === 'gallop' ? ' at a gallop' : ''})`;
  return { line, into, why, wind: calm ? '' : jtWindWhy(push, squire ? 0 : into != null ? into : JT_GND.into[jtHandsK(s)], squire, word) };
}
// the wind's part of the reason: f the share of the push aimed back into it
function jtWindWhy(push, f, squire, word) {
  const w = jtWindWords(G.ground.wind), n = v => `${Math.round(v * 10) / 10} inch${Math.round(v * 10) === 10 ? '' : 'es'}`, onto = push > 0 ? 'toward their body' : 'toward their shield arm';
  if (squire) return `not minding ${w}`;
  if (f < .05) return word ? `${w}: let it carry your tip about ${n(Math.abs(push))} ${onto}` : `letting ${w} carry the tip ${n(Math.abs(push))} ${onto}`;
  // (on the target, + is right of your mark: aiming into a push toward their shield arm is aiming right)
  if (word) return `${w}: hold your tip about ${n(Math.abs(push) * f)} ${push < 0 ? 'right' : 'left'} of your mark`;
  return `aiming ${n(Math.abs(push) * f)} into ${w}`;
}
// side s's strike on plan, on the model (its points, an unhorsing three), JT_GND.read.n times on a stream of its own
function jtLineVal(s, plan, read) {
  const o = 1 - s, ri = jtRiders()[o], rnd = engRng(JT_GND.read.seed + G.n * 7 + s), ride = jtRideOpts(s, plan);
  const ang = read ? jtHabitOf(s).angled : 0, d0 = { rs: read ? jtRsOf(o, ri) : jtRs(''), mount: read ? jtMountOf(o) : JT_MOUNT_DEF };
  let v = 0;
  for (let i = 0; i < JT_GND.read.n; i++) {
    const a = jtCharge(ride, rnd), d = Object.assign({ guard: rnd() < ang ? 'angled' : 'square' }, d0), st = jtStrike(a, d, rnd), se = jtSeat(st, d, .5, rnd, { broke: true });
    v += se.unhorse ? JT_RULES.unhorse : JT_RULES.pts[st.at] || 0;
  }
  return v / JT_GND.read.n;
}
jtPlan = function (s) {
  const P = JT_W13.plan(s); if (!jtGndOn() || !jtRiders()) return P;
  const L = jtLineFor(s, P);
  P.line = L.line; if (L.into != null) P.into = +L.into.toFixed(3);
  P.why += `; ${L.why}` + (L.wind ? `; ${L.wind}` : '');
  return P;
};
// your squire's word: the line and the wind by the Archmage's sum, for your own hands (on the target, where to hold the tip)
jtSuggest = function (s) {
  const P = JT_W13.suggest(s); if (!jtGndOn() || !jtRiders()) return P;
  const L = jtLineFor(s, P, 'word');
  P.line = L.line; if (L.into != null) P.into = +L.into.toFixed(3);
  P.why += `; ${L.line === 'rut' ? 'ride the rut' : 'ride beside the rut'}${L.why === 'the sand smooth' ? ' (the sand is smooth)' : L.why.replace(/^(in|beside) the rut/, '')}` + (L.wind ? `; ${L.wind}` : '');
  return P;
};
// your line in your plan beat: { line: 'rut' | 'side' }
jtSelect = function (o) {
  if (!o || o.line == null || o.suggest) return JT_W13.select(o);
  if (!GP || GP.ph !== 'plan' || !GP.sel) return 'Not now.';
  if (!jtGndOn()) return 'The sand is smooth today: no line to pick.';
  if (!jtLineOk(o.line)) return 'No such line: in the rut, or beside it.';
  const why = Object.keys(o).length > 1 ? JT_W13.select(Object.assign({}, o, { line: undefined })) : '';
  if (why) return why;
  GP.sel = Object.assign({}, GP.sel, { line: o.line }); jtPicked(); return '';
};

/* ---------- after a course ---------- */
// (rnd: the seeded stream a resumed course rides out on, phase 6's review; passed through)
jtCourseClose = function (P, leans, rnd) {
  const ev = JT_W13.close(P, leans, rnd); if (!ev || !jtGndOn()) return ev;
  const Gd = G.ground, line = [0, 1].map(s => ev.rides[s].gnd && jtLineOk(ev.rides[s].gnd.line) ? ev.rides[s].gnd.line : 'rut');
  Gd.log.push({ n: G.n - 1, heat: ev.heat, course: ev.course, tilt: ev.tilt, rut: Gd.rut.map(jtGndR), line, wind: Object.assign({}, Gd.wind), push: [0, 1].map(s => ev.rides[s].gnd ? ev.rides[s].gnd.push : 0) });
  // the ruts cut: a gallop deep, a canter a little, half beside the rut
  [0, 1].forEach(s => { Gd.tally[line[s]][s]++; Gd.rut[s] = jtGndR(Math.min(JT_GND.max, Gd.rut[s] + JT_GND.cut[jtPick('pace', ev.rides[s].pace, 'canter')] * (line[s] === 'side' ? JT_GND.side : 1))); });
  ev.gnd = { line, rake: false };
  if ((ev.rule.heatOver || ev.rule.tiltNow) && !G.over) { Gd.rut = [0, 0]; Gd.tally.rakes++; ev.gnd.rake = true; Gd.said = `Sir Ruddock rakes the lists smooth${ev.rule.tiltNow ? ' for the tilt for the crown' : ' for the next heat'}.`; }
  if (!G.over) { Gd.wind = jtGndWind(Gd.wind, rnd); Gd.n = G.n; Gd.tally.winds++; }
  return ev;
};
jtHerald = function (ev) { const t = JT_W13.herald(ev); return ev && ev.gnd && ev.gnd.rake ? `${t} Sir Ruddock rakes the sand smooth.` : t; };
// Sir Ruddock's line before the first course and after a rake, at the head of the status line
jtPlayNext = function () {
  JT_W13.playNext();
  if (!jtGndOn() || !GP || !G.ground.said || !['plan', 'herald'].includes(GP.ph)) return;
  GP.msg = `${G.ground.said} ${GP.msg}`; G.ground.said = '';
};

/* ---------- kept, summed up, shown ---------- */
// (a course left being ridden is ridden out on the lines committed too)
jtSnapshot = function () {
  const sn = JT_W13.snapshot();
  // (riding is { plans, cpuRides, P } since phase 6's review; an older one is the plans alone)
  const pl = sn && sn.riding ? (Array.isArray(sn.riding) ? sn.riding : sn.riding.plans) : null;
  if (Array.isArray(pl) && GP && Array.isArray(GP.plans)) pl.forEach((p, s) => { const q = GP.plans[s]; if (!p || !q) return; if (jtLineOk(q.line)) p.line = q.line; if (typeof q.into === 'number') p.into = q.into; });
  return sn;
};
jtSummary = function () { const S = JT_W13.summary(); if (S && G.ground) S.ground = JSON.parse(JSON.stringify({ tally: G.ground.tally, log: G.ground.log, rut: G.ground.rut, wind: G.ground.wind })); return S; };
// what the page needs of the ground: each lane's rut, the wind and its push on each tip at this pace, each side's line
function jtGroundView() {
  if (!jtGndOn()) return null;
  // (the other side's line and pace stay hidden until the course is committed, as their plan does: null)
  const Gd = G.ground, you = GP ? GP.you : 0, plans = GP && GP.plans, sel = GP && GP.sel, open = !GP || jtCommitted();
  const plan = s => s === you && sel && !open ? sel : plans && plans[s] ? plans[s] : null, seen = s => s === you || open;
  return { rut: Gd.rut.slice(), wind: Object.assign({}, Gd.wind), words: jtWindWords(Gd.wind, true),
    push: [0, 1].map(s => seen(s) && plan(s) ? jtGndR(jtGndPush(s, plan(s).pace)) : null),
    line: [0, 1].map(s => seen(s) && plan(s) && jtLineOk(plan(s).line) ? plan(s).line : null), said: Gd.said, tally: JSON.parse(JSON.stringify(Gd.tally)) };
}
jtView = function () { const V = JT_W13.view(); if (V) V.ground = jtGroundView(); return V; };

/* ---------- drawing ---------- */
// the pennants stream with the wind: limp on a breath, taut and snapping when it blows; toward us (from the gallery)
// they swing down and broaden, away from us they lift and narrow
jtPennant = function (c, x, zz, col, i) {
  if (!jtGndOn()) return JT_W13.pennant(c, x, zz, col, i);
  const sx = jtScrX(x), sy = jtScrY(zz), z = JTC.zoom; if (sx < -20 || sx > JT_VIEW.w + 20) return;
  const w = G.ground.wind, k = w.k, top = sy - 2.6 * z;
  c.strokeStyle = '#4a3420'; c.lineWidth = Math.max(1, z * .06); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, top); c.stroke();
  const snap = Math.sin(JTC.t * (3 + 9 * k) + i * 1.3) * (.05 + .12 * k), len = (.5 + .8 * k) * z, droop = (1 - k) * .55 + (w.dir > 0 ? .25 : -.2) * k;
  const ex = sx + len * Math.cos(droop + snap), ey = top + len * Math.sin(droop + snap) * (w.dir > 0 ? 1.15 : .8), wide = .42 * z * (w.dir > 0 ? 1 + .3 * k : 1 - .35 * k);
  c.fillStyle = col; c.beginPath(); c.moveTo(sx, top); c.quadraticCurveTo((sx + ex) / 2, (top + ey) / 2 - wide * .3 + snap * z, ex, ey); c.lineTo(sx, top + wide); c.closePath(); c.fill();
};
// the furrows: each lane's rut along the tilt, darker and wider as it deepens
function jtRutDraw(c) {
  // (sized as the riders are in the wide shot, a little larger than the yard's scale, so the furrows read there too)
  const Gd = G.ground, k = Math.max(JTC.zoom, 26);
  c.save();
  for (const s of [0, 1]) {
    const d = Gd.rut[s]; if (d < .02) continue;
    const lane = s ? JT_VIEW.far : JT_VIEW.near, x0 = jtScrX(1.5), x1 = jtScrX(JT_LISTS.yards - 1.5);
    for (const [dz, a] of [[-.14, .55], [0, 1], [.14, .55]]) {
      const y = jtScrY(lane + dz); c.strokeStyle = `rgba(88,58,28,${(.2 + .5 * d) * a})`; c.lineWidth = Math.max(1.5, k * (.06 + .12 * d)); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    }
    c.fillStyle = `rgba(66,42,20,${.18 + .4 * d})`;
    for (let x = 2; x < JT_LISTS.yards - 2; x += 1.1) { const sx = jtScrX(x + (s ? .5 : 0)); if (sx < -6 || sx > JT_VIEW.w + 6) continue; c.beginPath(); c.ellipse(sx, jtScrY(lane + ((x * 7) % 3 - 1) * .05), Math.max(1.2, k * .1), Math.max(.8, k * .035), 0, 0, 6.28); c.fill(); }
  }
  c.restore();
}
jtListsDraw = function (c) { JT_W13.listsDraw(c); if (jtGndOn()) jtRutDraw(c); };
// on the target, where the wind pushes your tip: an arrow from your mark, as long as the push at your pace
jtTargetDraw = function (c, plan, guard, tip) {
  JT_W13.targetDraw(c, plan, guard, tip);
  if (!jtGndOn() || !plan || !GP) return;
  const p = jtGndPush(GP.you, plan.pace); if (Math.abs(p) < .3) return;
  const A = JT_PLAN.aim[plan.aim] || JT_PLAN.aim.shield, [ax, ay] = jtAimScr(A.x, A.y - 9), [bx] = jtAimScr(A.x + p, A.y);
  c.save(); c.strokeStyle = '#bfe4ff'; c.fillStyle = '#bfe4ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, ay); c.stroke();
  const dx = Math.sign(bx - ax); c.beginPath(); c.moveTo(bx, ay); c.lineTo(bx - dx * 7, ay - 4); c.lineTo(bx - dx * 7, ay + 4); c.closePath(); c.fill();
  txt(c, 'wind', (ax + bx) / 2, ay - 6, '700 10px "Alegreya Sans", sans-serif', '#bfe4ff', 'center');
  c.restore();
};
// the ground's panel, top right: the wind across a little plan of the lists, and each lane's rut
function jtGroundDraw(c) {
  const V = jtGroundView(); if (!V) return;
  const x0 = JT_VIEW.w - 250, y0 = 10, w = 240, h = 56;
  c.save(); c.fillStyle = 'rgba(24,20,16,.78)'; rr(c, x0, y0, w, h, 8); c.fill();
  // the plan of the lists: the tilt down the middle, the gallery side on top; the wind's arrow across it
  const px = x0 + 10, py = y0 + 10, pw = 60, ph = 36, mid = py + ph / 2;
  c.strokeStyle = 'rgba(242,236,224,.5)'; c.lineWidth = 1; c.strokeRect(px, py, pw, ph);
  c.strokeStyle = '#e8dcc0'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 4, mid); c.lineTo(px + pw - 4, mid); c.stroke();
  const L = 6 + 12 * V.wind.k, ax = px + pw / 2, d = V.wind.dir;
  c.strokeStyle = '#bfe4ff'; c.fillStyle = '#bfe4ff'; c.lineWidth = 1.5 + 2 * V.wind.k;
  c.beginPath(); c.moveTo(ax, mid - d * L); c.lineTo(ax, mid + d * L); c.stroke();
  c.beginPath(); c.moveTo(ax, mid + d * (L + 5)); c.lineTo(ax - 5, mid + d * (L - 2)); c.lineTo(ax + 5, mid + d * (L - 2)); c.closePath(); c.fill();
  txt(c, V.words, px + pw + 10, y0 + 24, '700 12px "Alegreya Sans", sans-serif', '#f2ece0');
  const r = s => V.rut[s] < .04 ? 'smooth' : `${Math.round(100 * V.rut[s])}% rut`;
  txt(c, `Sand: ${(G.teams[0].short || 'Ours')} ${r(0)} · ${(G.teams[1].short || 'Theirs')} ${r(1)}`, px + pw + 10, y0 + 44, '600 11px "Alegreya Sans", sans-serif', '#d8c8a8');
  c.restore();
}
jtDraw = function (c, dt) { JT_W13.draw(c, dt); if (jtGndOn()) jtGroundDraw(c); };
