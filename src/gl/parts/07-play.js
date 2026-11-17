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
const GL_METER = { up: 1.0, top: 1.1, down: 1.15, low: -0.18, win: [0.035, 0.065], pshot: 0.6, puttUp: 1.5, inErr: 0.25, outErr: 7, pSpd: 0.3, pShake: 0.035, pWob: 0.06 };
const GL_PACE = { addr: 0.7, rest: 0.9, hole: 2.4, given: 1.3, fly: 1.7, roll: 0.8 };
const GL_HANDS = { drag: 170, dragAcc: 12, puttDeg: 0.1 };
let GD = null;

function glPlayStart(o) {
  GLC.h = -1;
  GD = { mode: o && o.mode === 'play' ? 'play' : 'watch', you: 0, ph: 'next', t: 0, wait: 0, msg: '', sel: null, meter: null, anim: null, cpu: null, last: null, disp: null, drag: null, swung: null };
  glDispSync();
  GD.msg = `${G.teams[0].name} against ${G.teams[1].name}, ${G.holes} holes of match play. ${G.teams[G.honour].name} have the honour on the 1st.`;
}
// what is drawn: the hole and both balls, as they were before the shot in the air
function glDispSync() { GD.disp = { h: G.h, balls: G.ball.map(b => Object.assign({}, b)), hole: glHoleNow(), wind: Object.assign({}, G.wind), match: glMatchText(0), st: G.hole.st.slice(), won: G.won.slice(), over: !!G.over }; }
// the match as drawn catches up once a hole's last ball has stopped
function glDispMatch() { if (GD && GD.disp) { GD.disp.match = glMatchText(0); GD.disp.won = G.won.slice(); GD.disp.over = !!G.over; const c = G.card[G.card.length - 1]; if (c && c.no === GD.disp.h + 1) GD.disp.st = c.st.slice(); } }
// a new beat: msg (when given) is said first, so the page's status line, redrawn on the beat, shows it
function glGo(ph, wait, msg) {
  if (msg != null) GD.msg = msg;
  GD.ph = ph; GD.t = 0; GD.wait = wait || 0;
  if (GL_HOOK.onPhase) try { GL_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
const glName = (s, ri) => (G.teams[s].roster[ri] || {}).n || 'Someone';
const glYours = s => GD && GD.mode === 'play' && s === GD.you;

/* ---------- the beat ---------- */
function glTick(dt) {
  if (!GD || !G || !G.teams) return;
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
    if (glCpuGives(n)) { glGiven(o); return; }
    glSelReset(); glGo('aim', 0, (G.turnNow && G.hole.st[0] + G.hole.st[1] === 0 ? 'The turn: everyone\'s focus is back. ' : '') + glAimMsg());
    return;
  }
  if (n.give && glYours(o)) { glGo('offer', 0, `${G.teams[s].name} have ${glYards(n.d)} left. Give them the putt, or make them hole it?`); return; }
  if (glCpuGives(n)) { glGiven(o); return; }
  glCpuCall(s);
  const plan = glPlan(s);
  GD.cpu = { side: s, plan };
  glGo('addr', 0, `${glName(s, plan.ri)} (${G.teams[s].name}) to play: ${glShotSay(s, plan, n.d)}.`);
}
function glGiven(by) {
  const s = 1 - by;
  const ev = glGive(by);
  if (!ev) { glGo('next'); return; }
  GD.last = ev;
  const end = ev.res != null;
  glGo('given', end ? GL_PACE.hole : GL_PACE.given, `${G.teams[by].name} give ${G.teams[s].name} the putt.` + glHoleSay(ev));
  if (end) glDispMatch();
  if (end && G.over && GL_HOOK.onOver) try { GL_HOOK.onOver(glSummary()); } catch (e) { console.error(e); }
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
  const run = plan.putt ? (r.water ? r.path.slice() : r.path.concat([r.end])) : r.run || [];
  const rT = plan.putt ? clamp(r.t || 1, 0.6, 5) * 0.75 : run.length > 2 ? clamp(hyp(r.end.x - r.land.x, r.end.y - r.land.y) / 3, 0.6, 3) : run.length ? GL_PACE.roll : 0.2;
  GD.anim = { side: s, path: plan.putt ? [] : r.path, run, fT, rT, t: 0, water: !!r.water, drop: r.drop ? { x: r.end.x, y: r.end.y } : null, holed: !!r.holed, uniform: plan.putt || run.length > 2 };
  const ev = glShoot(s, plan, r);
  if (!ev || ev.k !== 'shot') { GD.anim = null; glDispSync(); if (glYours(s)) { glSelReset(); glGo('aim', 0, (ev && ev.why) || 'That shot can\'t be played.'); } else glGo('next'); return; }
  GD.last = ev; GD.said = glEvSay(ev, r);
  glGo('fly', 0, plan.putt ? `${glName(s, plan.ri)} putts…` : `${glName(s, plan.ri)} hits the ${GL_CLUBS[plan.club].n.toLowerCase()}…`);
}
function glAnimDone() {
  const ev = GD.last, end = ev && ev.res != null;
  GD.msg = GD.said || GD.msg;
  glDispMatch();
  if (!end) glDispSync();
  else {
    // the hole is over and G has moved to the next tee: the ball just played stays where it finished
    const A = GD.anim, H = GD.disp.hole, last = A.drop || (A.holed ? H.pin : A.run.length ? A.run[A.run.length - 1] : A.path[A.path.length - 1]);
    if (last) GD.disp.balls[A.side] = Object.assign({}, GD.disp.balls[A.side], { x: last.x, y: last.y });
  }
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
  const run = A.run; if (!run.length) return A.path.length ? Object.assign({}, A.path[A.path.length - 1], { z: 0 }) : null;
  let f = clamp((A.t - A.fT) / (A.rT || 1), 0, 1);
  if (!A.uniform) f = 1 - (1 - f) * (1 - f);
  const g = f * (run.length - 1), i = Math.min(run.length - 2, Math.floor(g)), u = g - i;
  if (run.length < 2) return { x: run[0].x, y: run[0].y, z: 0 };
  return { x: lerp(run[i].x, run[i + 1].x, u), y: lerp(run[i].y, run[i + 1].y, u), z: 0 };
}

/* ---------- what happened, said plainly ---------- */
function glEvSay(ev, r) {
  if (!ev || ev.k !== 'shot') return ev && ev.why ? ev.why : '';
  const who = glName(ev.side, ev.ri);
  let t;
  if (ev.club === 'pt') t = ev.holed ? `${who} holes the putt from ${glYards(ev.d0)}!` : `${who} putts from ${glYards(ev.d0)}${ev.lip ? ': it lips out' : ''}. ${glYards(ev.d1)} left.`;
  else {
    const c = GL_CLUBS[ev.club].n.toLowerCase(), carry = r ? r.carry : 0;
    t = ev.holed ? `${who}'s ${c} drops into the cup!` : ev.water ? `${who}'s ${c} finds the water. A drop, and a stroke.` : `${who} hits a ${c} ${carry} yards, into the ${GL_TER[ev.lie]}. ${glYards(ev.d1)} to the pin.`;
  }
  if (ev.up) t += ' That is par and four more: the ball is picked up.';
  return t + glHoleSay(ev);
}
function glHoleSay(ev) {
  if (!ev || ev.res == null) return '';
  const c = G.card[G.card.length - 1], no = glOrd(c.no), m = G.over ? ` ${G.teams[G.over.win].name} win the match, ${G.over.text}.` : ` ${G.teams[0].name}: ${glMatchText(0)}.`;
  return (ev.res < 0 ? ` The ${no} is halved.` : ` ${G.teams[ev.res].name} win the ${no}.`) + m;
}
function glAimMsg() {
  const S = GD.sel; if (!S) return '';
  const d = glDistOf(glHoleNow(), GD.you), who = glName(GD.you, S.ri), p = glPressure(GD.you);
  const big = p ? `A stroke ${G.hole.st[GD.you] + 1 < G.hole.st[1 - GD.you] ? 'to win' : 'to halve'} the hole${p > 1 ? ', and a big one' : ''}: the ${S.putt ? 'bar runs quicker and wobbles' : 'meter runs quicker and the mark shakes'}, less for a steady nerve. ` : '';
  return big + (S.putt ? `${who} to putt, ${glYards(d)}. Aim with the arrows or a click on the green, then Space to start the stroke and Space again for the weight.`
    : `${who} to hit, ${GL_CLUBS[S.club].n.toLowerCase()}, ${glYards(d)} to the pin. Space to start the swing, again for the power, again on the mark.`);
}

/* ---------- your shot: the choice ---------- */
function glSelReset() {
  const s = GD.you, H = glHoleNow(), kind = glShotKind(H, s);
  // (a putt is set up without the caddie's read: that would draw from R and throw the result away)
  const line = kind === 'putt' ? 'pct' : GD.line || 'pct';
  const plan = kind === 'putt' ? { ri: glPickHitter(s, 'putt'), club: 'pt', putt: true, kind } : glPlan(s, null, line);
  GD.sel = { ri: plan.ri, club: plan.club, aim: plan.putt ? { x: H.pin.x, y: H.pin.y } : { x: plan.aim.x, y: plan.aim.y }, shape: '', traj: '', spin: 0, putt: !!plan.putt, kind: plan.kind, line };
  glSelFix();
}
// the clubs your ball may take from where it lies (the putter on or close by the green)
function glClubsNow() {
  const H = glHoleNow(), b = G.ball[GD.you];
  if (b.lie === 'G') return ['pt'];
  const out = glClubsFrom(b.lie, glRat(GD.you, GD.sel ? GD.sel.ri : 0));
  if (glShotKind(H, GD.you) === 'putt') out.push('pt');
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
  if (d < (S.putt ? 0.05 : 1)) { const m = S.putt ? 0.05 : 1; S.aim = { x: b.x + dx / d * m, y: b.y + dy / d * m }; }
  S.tick = glTickPow();
}
// the meter's tick: the power that lands a perfect swing on the aim point (a putt: the weight to roll there, flat)
function glTickPow() {
  const S = GD.sel, s = GD.you, b = G.ball[s], d = hyp(S.aim.x - b.x, S.aim.y - b.y);
  if (S.putt) return clamp((d + GL_LINES[S.line || 'pct'].putt) / glPuttScale(), 0.02, 1);
  const T = GL_TRAJ[S.traj] && b.lie !== 'O' ? GL_TRAJ[S.traj].carry : 1, B = GL_STANCE[glStanceOf(s).mood].dist;
  return glPowFor(S.club, b.lie, glRat(s, S.ri), d / T / B, true);
}
// a putt's bar runs to this many yards (on a flat green, at full weight)
function glPuttScale() {
  const b = G.ball[GD.you], H = glHoleNow(), d = hyp(H.pin.x - b.x, H.pin.y - b.y), S = GD.sel, a = S ? hyp(S.aim.x - b.x, S.aim.y - b.y) : 0;
  // (long enough for the pin and for your aim, however far past it you aim: the tick always rolls it there, flat)
  return Math.max(3, d * 1.7 + 1, a * 1.25 + 1);
}
function glSelect(o) {
  if (!GD || GD.ph !== 'aim' || !o) return false;
  const S = GD.sel;
  if (o.ri != null && glHitters(GD.you).includes(o.ri)) S.ri = o.ri;
  if (o.club && glClubsNow().includes(o.club)) {
    const wasPutt = S.putt; S.club = o.club; S.putt = o.club === 'pt';
    // (the putter is offered only for a putt, so a switch either way starts from the pin)
    if (S.putt !== wasPutt) { const H = glHoleNow(); S.aim = { x: H.pin.x, y: H.pin.y }; }
  }
  if (o.shape != null) S.shape = GL_SHAPES[o.shape] ? o.shape : '';
  if (o.traj != null) S.traj = GL_TRAJ[o.traj] ? o.traj : '';
  if (o.spin != null) S.spin = clamp(Math.round(o.spin), -1, 1);
  if (o.line && GL_LINES[o.line] && o.line !== S.line) {
    S.line = o.line;
    // a full shot is planned again for the line (the club and the aim); a putt's line only changes its weight's tick
    if (!S.putt) { GD.line = o.line; const p = glPlan(GD.you, S.ri, o.line); if (glClubsNow().includes(p.club)) S.club = p.club; S.aim = { x: p.aim.x, y: p.aim.y }; }
  }
  if (o.tempo && GL_STANCE[o.tempo] && (o.tempo === 'quick' || o.tempo === 'steady')) G.stance[GD.you].tempo = o.tempo;
  if (o.mood && (o.mood === 'bold' || o.mood === 'careful')) G.stance[GD.you].mood = o.mood;
  if (o.word && G.word[GD.you] > 0 && !G.wordOn[GD.you]) { G.word[GD.you]--; G.wordOn[GD.you] = true; }
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
  const S = GD.sel, b = G.ball[GD.you], a = Math.atan2(S.aim.y - b.y, S.aim.x - b.x), d = Math.max(S.putt ? 0.05 : 0.5, hyp(S.aim.x - b.x, S.aim.y - b.y) + yd);
  S.aim = { x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d }; glSelFix(); return true;
}
// the read line: the putt's first yards as struck now at the tick's weight (longer for a better putter)
function glReadLen() { return GD && GD.sel ? (G.wordOn && G.wordOn[GD.you] ? 99 : 1.5 + glRat(GD.you, GD.sel.ri).put * 5.5) : 0; }
// the wind as you see it: roughly (to 5 mph and 8 ways), or exactly with the caddie's word (or in Watch)
function glWindShown(w) {
  if (!w || !w.s) return { s: 0, d: 0, exact: true };
  if (!GD || GD.mode !== 'play' || (G.wordOn && G.wordOn[GD.you])) return { s: w.s, d: w.d, exact: true };
  return { s: Math.max(5, Math.round(w.s / 5) * 5), d: Math.round(w.d / (Math.PI / 4)) * (Math.PI / 4), exact: false };
}
const GLRL = { key: '', line: [] };
function glReadLine() {
  const S = GD && GD.sel; if (!S || !S.putt || (GD.ph !== 'aim' && GD.ph !== 'swing')) return [];
  const b = G.ball[GD.you], key = [G.cs, glHoleNow().seed, G.h, b.x, b.y, S.aim.x, S.aim.y, S.tick, S.ri, glReadLen()].join(',');
  if (GLRL.key === key) return GLRL.line;
  GLRL.key = key; GLRL.line = glReadCalc(S, b);
  return GLRL.line;
}
function glReadCalc(S, b) {
  const H = glHoleNow(), a = Math.atan2(S.aim.y - b.y, S.aim.x - b.x), v = glPuttSpeed(S.tick);
  const P = glPutt({ hole: H, from: { x: b.x, y: b.y }, a, v, noCup: true }), L = glReadLen(), out = [{ x: b.x, y: b.y }];
  let run = 0;
  for (let i = 1; i < P.path.length && run < L; i++) { run += hyp(P.path[i].x - P.path[i - 1].x, P.path[i].y - P.path[i - 1].y); out.push(P.path[i]); }
  return out;
}
const glPuttSpeed = p => Math.sqrt(2 * GL_PUTT.fric * glPuttScale() * clamp(p, 0, 1.05)) * (G.ball[GD.you].lie === 'G' ? 1 : 1.3);

/* ---------- the swing ---------- */
// the mark's half-width for a hitter: wider for a more accurate one, smaller on a power shot, and smaller for a tired one
// (focus f, 0 to 1)
function glWin(rat, pow, f) { const W = GL_METER.win; return (W[0] + (W[1] - W[0]) * clamp(rat.acc, 0, 1)) * (pow > 1 ? GL_METER.pshot : 1) * (0.55 + 0.45 * clamp(f == null ? 1 : f, 0, 1)); }
// power and the miss (m: where on the meter the mark was hit, + early, - late) to the swing's numbers
function glSwingNums(pow, m, rat, f) {
  const w = glWin(rat, pow, f), a = Math.abs(m), e = a <= w ? a / w * GL_METER.inErr : GL_METER.inErr + (a - w) * GL_METER.outErr;
  return { pow: clamp(pow, 0, GL_METER.top), err: m > 0 ? -e : e, inside: a <= w };
}
// your hitter now: their ratings, their focus, and what the moment does to them (the meter runs quicker by spd, the mark
// shakes by shake, a putt's weight wobbles by wob, all less for a steady nerve)
function glMine() {
  const s = GD.you, ri = GD.sel.ri, rat = glRat(s, ri), f = G.focus ? G.focus[s][ri] : 1, p = glPressure(s), n = p * (1 - clamp(rat.nrv, 0, 1));
  const st = glStanceOf(s);
  return { rat, f: f / GL_STANCE[st.mood].err, p, spd: (1 + GL_METER.pSpd * n) * GL_STANCE[st.tempo].meter, shake: GL_METER.pShake * n, wob: GL_METER.pWob * n };
}
// where the shaking mark is now (meter units), and a putt's wobble
const glShake = M => M.shake ? M.shake * Math.sin(M.t * 9) : 0;
const glWobble = M => M.wob ? M.wob * Math.sin(M.t * 7.3) : 0;
function glPress() {
  if (!GD) return false;
  if (GD.ph === 'aim') { const me = glMine(); GD.meter = { k: GD.sel.putt ? 'putt' : 'full', st: 'up', p: 0, dir: 1, pow: null, m: null, t: 0, f: me.f, press: me.p, spd: me.spd, shake: me.shake, wob: me.wob }; glGo('swing'); return true; }
  if (GD.ph !== 'swing') return false;
  const M = GD.meter;
  if (M.st === 'up') {
    M.pow = M.p;
    if (M.k === 'putt') { glStrikeMine({ pow: clamp(M.pow * (1 + glWobble(M)), 0, 1.05) }); return true; }
    M.st = 'down'; return true;
  }
  if (M.st === 'down') { M.m = M.p - glShake(M); glStrikeMine(glSwingNums(M.pow, M.m, glRat(GD.you, GD.sel.ri), M.f)); return true; }
  return false;
}
function glMeterTick(dt) {
  const M = GD.meter; if (!M) return;
  M.t += dt; const step = dt * (M.spd || 1);
  if (M.k === 'putt') {
    M.p += M.dir * step / GL_METER.puttUp;
    if (M.p >= 1) { M.p = 1; M.dir = -1; } else if (M.p <= 0) { M.p = 0; M.dir = 1; }
    return;
  }
  if (M.st === 'up') { M.p += step / GL_METER.up; if (M.p >= GL_METER.top) { M.p = GL_METER.top; M.pow = M.p; M.st = 'down'; if (GL_HOOK.onPick) try { GL_HOOK.onPick(); } catch (e) { console.error(e); } } }
  else if (M.st === 'down') { M.p -= step / GL_METER.down; if (M.p <= GL_METER.low) { M.p = GL_METER.low; M.m = M.p - glShake(M); glStrikeMine(glSwingNums(M.pow, M.m, glRat(GD.you, GD.sel.ri), M.f)); } }
}
// the phone's swing: pull (0 to 1.1 of a full pull) and how far off the line it was let go (degrees, + a hook). The
// moment and focus count as on the meter: the mark is where it has shaken to as you let go
function glDrag(pull, deg) {
  if (!GD || GD.ph !== 'aim') return false;
  const S = GD.sel, me = glMine(), rat = me.rat, pow = clamp(pull, 0, GL_METER.top);
  GD.meter = { k: S.putt ? 'putt' : 'full', st: 'done', p: pow, pow, m: 0, drag: true, t: GD.t, f: me.f, press: me.p, spd: me.spd, shake: me.shake, wob: me.wob };
  if (S.putt) glStrikeMine({ pow: clamp(Math.min(1, pow) * (1 + glWobble(GD.meter)), 0, 1.05), deg: deg || 0 });
  else { const w = glWin(rat, pow, me.f); GD.meter.m = (deg || 0) / GL_HANDS.dragAcc * w - glShake(GD.meter); glStrikeMine(glSwingNums(pow, GD.meter.m, rat, me.f)); }
  return true;
}
// your swing goes off: the ball where those numbers send it
function glStrike(s, S, sw) {
  const H = glHoleNow(), b = G.ball[s], rat = glRat(s, S.ri), from = { x: b.x, y: b.y };
  if (S.putt) {
    // (a drag pulled off the line starts the putt off line: + is left, as a hook; GL_HANDS.puttDeg of a degree a degree)
    const a = Math.atan2(S.aim.y - b.y, S.aim.x - b.x) + (sw.deg || 0) * GL_HANDS.puttDeg * Math.PI / 180, P = glPutt({ hole: H, from, a, v: glPuttSpeed(sw.pow) });
    return Object.assign({ club: 'pt' }, P, P.water ? glWaterDrop(H, b, P.end) : {});
  }
  const M = GL_STANCE[glStanceOf(s).mood];
  return glFlight({ hole: H, from, lie: b.lie, club: S.club, aim: S.aim, pow: sw.pow * M.dist, err: sw.err, wind: G.wind, spin: S.spin * M.shape, shape: S.shape, shapeK: M.shape, traj: S.traj, rat });
}
function glStrikeMine(sw) {
  const S = GD.sel, s = GD.you;
  if (GD.meter) { GD.meter.st = 'done'; GD.meter.sw = sw; }
  GD.swung = Object.assign({ putt: S.putt }, sw);
  glFire(s, { ri: S.ri, kind: S.putt ? 'putt' : S.kind === 'putt' ? 'short' : S.kind, club: S.putt ? 'pt' : S.club, putt: S.putt, pow: sw.pow, line: S.line }, glStrike(s, S, sw));
}
// their short putt: give it, or make them putt
function glOffer(give) {
  if (!GD || GD.ph !== 'offer') return false;
  const n = glNext(); if (!n) return false;
  if (give) { glGiven(GD.you); return true; }
  const plan = glPlan(n.side); GD.cpu = { side: n.side, plan };
  glGo('addr', 0, `Make them putt it. ${glName(n.side, plan.ri)} to putt from ${glYards(n.d)}.`);
  return true;
}
function glSetMode(m) {
  if (!GD) return;
  const want = m === 'play' ? 'play' : 'watch';
  if (want === GD.mode) return;
  GD.mode = want;
  // your shot waiting, or their putt to give, goes back to the top: in Watch the CPU takes it
  if (GD.ph === 'aim' || GD.ph === 'offer' || (GD.ph === 'swing' && GD.mode !== 'play')) { GD.sel = null; GD.meter = null; glGo('next'); }
  else if (GD.ph === 'addr' && GD.cpu && glYours(GD.cpu.side)) { GD.cpu = null; glGo('next'); }
}
