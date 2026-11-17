/* Mossgate Links: the game on show, and playing it by hand (issue #92, phase 2). GD is the game on the page (not saved;
   G is the game). The same turn as the sim (06-game.js), a beat at a time so it can be watched (GD.ph):
   - next: who plays (glNext). Your side's shot in You play: aim. The CPU's: a short putt may be given (yours to give
     when it's their putt: offer), else it addresses the ball (addr) and swings.
   - aim: your shot, set up. The caddie's choice to start (glPlan): the hitter, the club, the aim. Change any of them
     (glSelect, glAimAt, glAimTurn, glAimPush), and the shape (draw, fade), the height (punch, lob) and the spin.
     The ring is where a perfect swing at the meter's tick lands, without the wind. Space (glPress) starts the swing.
   - swing: the meter (GL_METER). A full shot is three presses: start; the power, at the top (past the end, 1 to 1.1,
     is a power shot: longer, and the mark gets smaller); then the mark on the way back. Early on the mark hooks it
     left, late slices it right, by how much you missed; inside the mark it flies nearly straight. Miss the mark
     altogether and the swing goes off at the bottom, a long way late. A putt is two: start, then the weight, the bar
     running up and back; the tick is the weight that reaches the aim point on a flat green. The read line shows the
     putt's first few yards (longer for a better putter), so the break can be seen and aimed off for.
     On a phone, drag back from the ball and let go (glDrag): the pull is the power, and a pull off the line is the
     miss, a mark's width for every GL_HANDS.dragAcc degrees. Both give the same two numbers (glSwingNums).
   - fly: the ball in the air and on the ground (GD.anim), then rest. The shot is counted when it is struck (glShoot);
     the picture catches up (GD.disp is what is drawn until then).
   - offer: their short putt: give it (glOffer(true)) or make them putt.
   - given, rest: a beat to read it; over: the end.
   In Watch the CPU plays both sides. GD.msg is the last thing that happened, said plainly. */
const GL_METER = { up: 1.0, top: 1.1, down: 1.15, low: -0.18, win: [0.035, 0.065], pshot: 0.6, puttUp: 1.5, inErr: 0.25, outErr: 7 };
const GL_PACE = { addr: 0.7, rest: 0.9, hole: 2.4, given: 1.3, fly: 1.7, roll: 0.8 };
const GL_HANDS = { drag: 170, dragAcc: 12 };
let GD = null;

function glPlayStart(o) {
  GD = { mode: o && o.mode === 'play' ? 'play' : 'watch', you: 0, ph: 'next', t: 0, wait: 0, msg: '', sel: null, meter: null, anim: null, cpu: null, last: null, disp: null, phN: 0, drag: null, swung: null };
  glDispSync();
  GD.msg = `${G.teams[0].name} against ${G.teams[1].name}, ${G.holes} holes of match play. ${G.teams[G.honour].name} have the honour on the 1st.`;
}
// what is drawn: the hole and both balls, as they were before the shot in the air
function glDispSync() { GD.disp = { h: G.h, balls: G.ball.map(b => Object.assign({}, b)), hole: glHoleNow() }; }
function glGo(ph, wait) {
  GD.ph = ph; GD.t = 0; GD.wait = wait || 0; GD.phN++;
  if (GL_HOOK.onPhase) try { GL_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
const glName = (s, ri) => (G.teams[s].roster[ri] || {}).n || 'Someone';
const glYours = s => GD && GD.mode === 'play' && s === GD.you;

/* ---------- the beat ---------- */
function glTick(dt) {
  if (!GD || !G) return;
  GD.t += dt;
  const P = GD.ph;
  if (P === 'next') glPlayNext();
  else if (P === 'addr') { if (GD.t >= GL_PACE.addr) { const c = GD.cpu; GD.cpu = null; glFire(c.side, c.plan, glHit(c.side, c.plan)); } }
  else if (P === 'swing') glMeterTick(dt);
  else if (P === 'fly') { const A = GD.anim; A.t += dt; if (A.t >= A.fT + A.rT) glAnimDone(); }
  else if (P === 'given' || P === 'rest') { if (GD.t >= GD.wait) { glDispSync(); glGo(G.over ? 'over' : 'next'); } }
}
function glPlayNext() {
  const n = glNext();
  glDispSync();
  if (!n) { glGo('over'); return; }
  const s = n.side, o = 1 - s;
  if (glYours(s)) {
    if (n.give && glCpuConcede(o, s, n.d)) { glGiven(o); return; }
    glSelReset(); glGo('aim');
    GD.msg = glAimMsg();
    return;
  }
  if (n.give && glYours(o)) { glGo('offer'); GD.msg = `${G.teams[s].name} have ${glYards(n.d)} left. Give them the putt, or make them hole it?`; return; }
  if (n.give && glCpuConcede(o, s, n.d)) { glGiven(o); return; }
  const plan = glPlan(s);
  GD.cpu = { side: s, plan };
  glGo('addr');
  GD.msg = `${glName(s, plan.ri)} (${G.teams[s].name}) to play: ${glShotSay(s, plan, n.d)}.`;
}
function glGiven(by) {
  const s = 1 - by;
  GD.firing = true;
  let ev; try { ev = glGive(by); } finally { GD.firing = false; }
  if (ev && ev.res != null && G.over && GL_HOOK.onOver) try { GL_HOOK.onOver(glSummary()); } catch (e) { console.error(e); }
  GD.last = ev;
  GD.msg = `${G.teams[by].name} give ${G.teams[s].name} the putt.` + glHoleSay(ev);
  glGo('given', ev && ev.res != null ? GL_PACE.hole : GL_PACE.given);
}
const glFeet = n => `${n} ${n === 1 ? 'foot' : 'feet'}`;
const glYards = d => d < 1 ? glFeet(Math.max(1, Math.round(d * 3))) : `${Math.round(d)} ${Math.round(d) === 1 ? 'yard' : 'yards'}`;
function glShotSay(s, plan, d) {
  if (plan.putt) return `a putt from ${glYards(d)}`;
  return `${GL_CLUBS[plan.club].n.toLowerCase()} from the ${GL_TER[G.ball[s].lie] || 'fairway'}, ${glYards(d)} to the pin`;
}

/* ---------- a shot struck: the ball flies, then the picture catches up ---------- */
function glFire(s, plan, r) {
  const fT = plan.putt || !r.path || !r.path.length ? 0 : GL_PACE.fly * clamp(r.carry / 200, 0.45, 1.15);
  const run = plan.putt ? r.path.concat([r.end]) : r.run || [];
  const rT = plan.putt ? clamp(r.t || 1, 0.6, 5) * 0.75 : run.length > 2 ? clamp(hyp(r.end.x - r.land.x, r.end.y - r.land.y) / 3, 0.6, 3) : run.length ? GL_PACE.roll : 0.2;
  GD.anim = { side: s, path: plan.putt ? [] : r.path, run, fT, rT, t: 0, water: !!r.water, drop: r.drop ? { x: r.end.x, y: r.end.y } : null, holed: !!r.holed, uniform: plan.putt || run.length > 2 };
  GD.firing = true;
  let ev; try { ev = glShoot(s, plan, r); } finally { GD.firing = false; }
  GD.last = ev;
  GD.msg = glEvSay(ev, r);
  glGo('fly');
}
function glAnimDone() {
  const ev = GD.last, end = ev && ev.res != null;
  if (!end) glDispSync();
  else { GD.disp.balls = GD.disp.balls.map(b => Object.assign({}, b)); }
  glGo('rest', end ? GL_PACE.hole : GL_PACE.rest);
  if (end && G.over && GL_HOOK.onOver) try { GL_HOOK.onOver(glSummary()); } catch (e) { console.error(e); }
}
// where the moving ball is drawn now: { x, y, z } (or null with nothing moving)
function glAnimBall() {
  const A = GD && GD.anim; if (!A || GD.ph !== 'fly') return null;
  if (A.t < A.fT && A.path.length) {
    const f = clamp(A.t / A.fT, 0, 1) * (A.path.length - 1), i = Math.min(A.path.length - 2, Math.floor(f)), u = f - i, a = A.path[i], b = A.path[i + 1];
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) };
  }
  const R = A.run; if (!R.length) return A.path.length ? Object.assign({}, A.path[A.path.length - 1], { z: 0 }) : null;
  let f = clamp((A.t - A.fT) / (A.rT || 1), 0, 1);
  if (!A.uniform) f = 1 - (1 - f) * (1 - f);
  const g = f * (R.length - 1), i = Math.min(R.length - 2, Math.floor(g)), u = g - i;
  if (R.length < 2) return { x: R[0].x, y: R[0].y, z: 0 };
  return { x: lerp(R[i].x, R[i + 1].x, u), y: lerp(R[i].y, R[i + 1].y, u), z: 0 };
}

/* ---------- what happened, said plainly ---------- */
function glEvSay(ev, r) {
  if (!ev || ev.k !== 'shot') return ev && ev.why ? ev.why : '';
  const who = glName(ev.side, ev.ri), H = glHoleNow();
  let t;
  if (ev.club === 'pt') t = ev.holed ? `${who} holes the putt from ${glYards(ev.d0)}!` : `${who} putts from ${glYards(ev.d0)}${ev.lip ? ': it lips out' : ''}. ${glYards(ev.d1)} left.`;
  else {
    const c = GL_CLUBS[ev.club].n.toLowerCase(), carry = r ? r.carry : 0;
    t = ev.holed ? `${who}'s ${c} drops into the cup!` : ev.water ? `${who}'s ${c} finds the water. A drop, and a stroke.` : `${who} hits a ${c} ${carry} yards, into the ${GL_TER[ev.lie]}. ${glYards(ev.d1)} to the pin.`;
  }
  if (ev.up) t += ' That is par and four more: the ball is picked up.';
  return t + glHoleSay(ev, H);
}
function glHoleSay(ev) {
  if (!ev || ev.res == null) return '';
  const c = G.card[G.card.length - 1], no = glOrd(c.no), m = G.over ? ` ${G.teams[G.over.win].name} win the match, ${G.over.text}.` : ` ${G.teams[0].name}: ${glMatchText(0)}.`;
  return (ev.res < 0 ? ` The ${no} is halved.` : ` ${G.teams[ev.res].name} win the ${no}.`) + m;
}
function glAimMsg() {
  const S = GD.sel; if (!S) return '';
  const d = glDistOf(glHoleNow(), GD.you), who = glName(GD.you, S.ri);
  return S.putt ? `${who} to putt, ${glYards(d)}. Aim with the arrows or a click on the green, then Space to start the stroke and Space again for the weight.`
    : `${who} to hit, ${GL_CLUBS[S.club].n.toLowerCase()}, ${glYards(d)} to the pin. Space to start the swing, again for the power, again on the mark.`;
}

/* ---------- your shot: the choice ---------- */
function glSelReset() {
  const s = GD.you, plan = glPlan(s), H = glHoleNow();
  GD.sel = { ri: plan.ri, club: plan.club, aim: plan.putt ? { x: H.pin.x, y: H.pin.y } : { x: plan.aim.x, y: plan.aim.y }, shape: '', traj: '', spin: 0, putt: !!plan.putt, kind: plan.kind };
  glSelFix();
}
// the clubs your ball may take from where it lies (the putter on or close by the green)
function glClubsNow() {
  const H = glHoleNow(), b = G.ball[GD.you];
  if (b.lie === 'G') return ['pt'];
  const out = GL_BAG.filter(c => c !== 'pt' && glClubOk(c, b.lie));
  if (b.lie === 'F' && glPuttable(H, b)) out.push('pt');
  return out;
}
// keep the choice legal and the aim inside the club's reach
function glSelFix() {
  const S = GD.sel, s = GD.you, b = G.ball[s], rat = glRat(s, S.ri), can = glHitters(s);
  if (!can.includes(S.ri)) S.ri = can[0];
  const clubs = glClubsNow(); if (!clubs.includes(S.club)) S.club = clubs.includes('pt') && S.putt ? 'pt' : clubs[clubs.length - (clubs.includes('pt') ? 2 : 1)] || clubs[0];
  S.putt = S.club === 'pt';
  if (b.lie === 'O' && !S.putt) S.traj = 'punch';
  if (S.putt) { S.shape = ''; S.traj = ''; S.spin = 0; }
  const dx = S.aim.x - b.x, dy = S.aim.y - b.y, d = hyp(dx, dy) || 1;
  const max = S.putt ? 60 : glReach(S.club, b.lie, rat, 1).carry * (GL_TRAJ[S.traj] && b.lie !== 'O' ? GL_TRAJ[S.traj].carry : 1);
  if (d > max) { S.aim = { x: b.x + dx / d * max, y: b.y + dy / d * max }; }
  if (d < 1) S.aim = { x: b.x + dx / d, y: b.y + dy / d };
  S.tick = glTickPow();
}
// the meter's tick: the power that lands a perfect swing on the aim point (a putt: the weight to roll there, flat)
function glTickPow() {
  const S = GD.sel, s = GD.you, b = G.ball[s], d = hyp(S.aim.x - b.x, S.aim.y - b.y);
  if (S.putt) return clamp((d + 0.35) / glPuttScale(), 0.02, 1);
  const T = GL_TRAJ[S.traj] && b.lie !== 'O' ? GL_TRAJ[S.traj].carry : 1;
  return glPowFor(S.club, b.lie, glRat(s, S.ri), d / T, true);
}
// a putt's bar runs to this many yards (on a flat green, at full weight)
function glPuttScale() {
  const b = G.ball[GD.you], H = glHoleNow(), d = hyp(H.pin.x - b.x, H.pin.y - b.y);
  return Math.max(3, d * 1.7 + 1);
}
function glSelect(o) {
  if (!GD || GD.ph !== 'aim' || !o) return false;
  const S = GD.sel;
  if (o.ri != null && glHitters(GD.you).includes(o.ri)) S.ri = o.ri;
  if (o.club && glClubsNow().includes(o.club)) {
    const wasPutt = S.putt; S.club = o.club; S.putt = o.club === 'pt';
    if (S.putt !== wasPutt) { const H = glHoleNow(); if (S.putt) S.aim = { x: H.pin.x, y: H.pin.y }; else { const p = glPlan(GD.you, S.ri); S.aim = p.putt ? { x: H.pin.x, y: H.pin.y } : p.aim; } }
  }
  if (o.shape != null) S.shape = GL_SHAPES[o.shape] ? o.shape : '';
  if (o.traj != null) S.traj = GL_TRAJ[o.traj] ? o.traj : '';
  if (o.spin != null) S.spin = clamp(Math.round(o.spin), -1, 1);
  glSelFix();
  GD.msg = glAimMsg();
  return true;
}
function glAimAt(x, y) { if (!GD || GD.ph !== 'aim') return false; GD.sel.aim = { x, y }; glSelFix(); return true; }
function glAimTurn(deg) {
  if (!GD || GD.ph !== 'aim') return false;
  const S = GD.sel, b = G.ball[GD.you], a = Math.atan2(S.aim.y - b.y, S.aim.x - b.x) + deg * Math.PI / 180, d = hyp(S.aim.x - b.x, S.aim.y - b.y);
  S.aim = { x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d }; glSelFix(); return true;
}
function glAimPush(yd) {
  if (!GD || GD.ph !== 'aim') return false;
  const S = GD.sel, b = G.ball[GD.you], a = Math.atan2(S.aim.y - b.y, S.aim.x - b.x), d = Math.max(0.5, hyp(S.aim.x - b.x, S.aim.y - b.y) + yd);
  S.aim = { x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d }; glSelFix(); return true;
}
// the read line: the putt's first yards as struck now at the tick's weight (longer for a better putter)
function glReadLen() { return GD && GD.sel ? 1.5 + glRat(GD.you, GD.sel.ri).put * 5.5 : 0; }
function glReadLine() {
  const S = GD && GD.sel; if (!S || !S.putt || (GD.ph !== 'aim' && GD.ph !== 'swing')) return [];
  const b = G.ball[GD.you], H = glHoleNow(), a = Math.atan2(S.aim.y - b.y, S.aim.x - b.x), v = glPuttSpeed(S.tick);
  const P = glPutt({ hole: H, from: { x: b.x, y: b.y }, a, v, noCup: true }), L = glReadLen(), out = [{ x: b.x, y: b.y }];
  let run = 0;
  for (let i = 1; i < P.path.length && run < L; i++) { run += hyp(P.path[i].x - P.path[i - 1].x, P.path[i].y - P.path[i - 1].y); out.push(P.path[i]); }
  return out;
}
const glPuttSpeed = p => Math.sqrt(2 * GL_PUTT.fric * glPuttScale() * clamp(p, 0, 1.05)) * (G.ball[GD.you].lie === 'G' ? 1 : 1.3);

/* ---------- the swing ---------- */
// the mark's half-width for a hitter: wider for a more accurate one, smaller on a power shot
function glWin(rat, pow) { const W = GL_METER.win; return (W[0] + (W[1] - W[0]) * clamp(rat.acc, 0, 1)) * (pow > 1 ? GL_METER.pshot : 1); }
// power and the miss (m: where on the meter the mark was hit, + early, - late) to the swing's numbers
function glSwingNums(pow, m, rat) {
  const w = glWin(rat, pow), a = Math.abs(m), e = a <= w ? a / w * GL_METER.inErr : GL_METER.inErr + (a - w) * GL_METER.outErr;
  return { pow: clamp(pow, 0, GL_METER.top), err: m > 0 ? -e : e, inside: a <= w };
}
function glPress() {
  if (!GD) return false;
  if (GD.ph === 'aim') { GD.meter = { k: GD.sel.putt ? 'putt' : 'full', st: 'up', p: 0, dir: 1, pow: null, m: null }; glGo('swing'); return true; }
  if (GD.ph !== 'swing') return false;
  const M = GD.meter;
  if (M.st === 'up') {
    M.pow = M.p;
    if (M.k === 'putt') { glStrikeMine({ pow: M.pow }); return true; }
    M.st = 'down'; return true;
  }
  if (M.st === 'down') { M.m = M.p; glStrikeMine(glSwingNums(M.pow, M.m, glRat(GD.you, GD.sel.ri))); return true; }
  return false;
}
function glMeterTick(dt) {
  const M = GD.meter; if (!M) return;
  if (M.k === 'putt') {
    M.p += M.dir * dt / GL_METER.puttUp;
    if (M.p >= 1) { M.p = 1; M.dir = -1; } else if (M.p <= 0) { M.p = 0; M.dir = 1; }
    return;
  }
  if (M.st === 'up') { M.p += dt / GL_METER.up; if (M.p >= GL_METER.top) { M.p = GL_METER.top; M.pow = M.p; M.st = 'down'; } }
  else if (M.st === 'down') { M.p -= dt / GL_METER.down; if (M.p <= GL_METER.low) { M.p = GL_METER.low; M.m = M.p; glStrikeMine(glSwingNums(M.pow, M.m, glRat(GD.you, GD.sel.ri))); } }
}
// the phone's swing: pull (0 to 1.1 of a full pull) and how far off the line it was let go (degrees, + a hook)
function glDrag(pull, deg) {
  if (!GD || GD.ph !== 'aim') return false;
  const S = GD.sel, rat = glRat(GD.you, S.ri), pow = clamp(pull, 0, GL_METER.top);
  GD.meter = { k: S.putt ? 'putt' : 'full', st: 'done', p: pow, pow, m: 0, drag: true };
  if (S.putt) glStrikeMine({ pow: Math.min(1, pow) });
  else { const w = glWin(rat, pow); GD.meter.m = (deg || 0) / GL_HANDS.dragAcc * w; glStrikeMine(glSwingNums(pow, GD.meter.m, rat)); }
  return true;
}
// your swing goes off: the ball where those numbers send it
function glStrike(s, S, sw) {
  const H = glHoleNow(), b = G.ball[s], rat = glRat(s, S.ri), from = { x: b.x, y: b.y };
  if (S.putt) {
    const a = Math.atan2(S.aim.y - b.y, S.aim.x - b.x), P = glPutt({ hole: H, from, a, v: glPuttSpeed(sw.pow) });
    return Object.assign({ club: 'pt' }, P, P.water ? glWaterDrop(H, b, P.end) : {});
  }
  return glFlight({ hole: H, from, lie: b.lie, club: S.club, aim: S.aim, pow: sw.pow, err: sw.err, wind: G.wind, spin: S.spin, shape: S.shape, traj: S.traj, rat });
}
function glStrikeMine(sw) {
  const S = GD.sel, s = GD.you;
  if (GD.meter) { GD.meter.st = 'done'; GD.meter.sw = sw; }
  GD.swung = Object.assign({ putt: S.putt }, sw);
  glFire(s, { ri: S.ri, kind: S.putt ? 'putt' : S.kind === 'putt' ? 'short' : S.kind, club: S.putt ? 'pt' : S.club, putt: S.putt }, glStrike(s, S, sw));
}
// their short putt: give it, or make them putt
function glOffer(give) {
  if (!GD || GD.ph !== 'offer') return false;
  const n = glNext(); if (!n) return false;
  if (give) { glGiven(GD.you); return true; }
  const plan = glPlan(n.side); GD.cpu = { side: n.side, plan }; glGo('addr');
  GD.msg = `Make them putt it. ${glName(n.side, plan.ri)} to putt from ${glYards(n.d)}.`;
  return true;
}
function glSetMode(m) {
  if (!GD) return;
  GD.mode = m === 'play' ? 'play' : 'watch';
  // your shot waiting, or their putt to give, goes back to the top: in Watch the CPU takes it
  if (GD.ph === 'aim' || GD.ph === 'offer' || (GD.ph === 'swing' && GD.mode !== 'play')) { GD.sel = null; GD.meter = null; glGo('next'); }
}
