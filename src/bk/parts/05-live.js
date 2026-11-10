/* The Charter Court: the live play (issue #77, phase 1). Ten players on a full court on a fixed step (BK_DT), the
   ball in a hand, in the air or loose. The ratings settle what happens when players meet.
   - The offense spreads to its spots in the half it attacks (BK_SPOT): the guards up top and on a wing, the wing in a
     corner, the bigs at the elbow and on the block. Off the ball they drift, and now and then cut to the basket.
   - The defense plays man to man: each defender takes the player in the same spot, between them and the basket, close
     on the ball and sagging off it the further their man is from the rim.
   - The ball handler thinks a few times a second (06-cpu.js): shoot, drive, pass or keep the dribble.
   - A shot is settled at the release (bkShotP): the distance, the shooter's touch, and the contest (how close the
     nearest defender is, and how good). At the rim size and hops count, and a big leaper dunks. A defender close
     enough may block it or foul. A miss off the rim resets the shot clock and comes off for a rebound: whoever is
     nearest where it comes down, with size and hops and the defense's inside position (the box-out), takes it.
   - A pass into a defender's lane can be stolen; a defender up close on the dribble can pick it, or reach and foul.
   - After a defensive rebound or a steal the play goes on the other way at once: a side that gets back slowly gives
     up a fast break (the ball across half court with more attackers than defenders back: GD.big 'break').
   Phase 2 adds the pick (bkPick: a big screens the ball's defender, and the defense switches, goes over or traps), the
   lob (a slow high pass few can reach; a leaper near the rim catches it for an alley-oop), the hot hand (three makes in
   a row and a player is on fire: G.hot, a better look until they miss), the jump's timing (a defender already in the
   air as the shot goes up blocks far more), and the box-out. Playing it by hand is 09-hands.js.
   Court metres: x along the court from the left baseline (0 to 28), y across from the middle (-7.5 to 7.5).
   L is the play, plain JSON (players by index, no references): { pl, ball, t, ev, think, last, shot }. */
const BK_DT = 1 / 30, BK_BODY = .55, BK_PASS_V = 12, BK_LOB_V = 7.5;
// spots in the half a side attacks: [metres from that baseline, across] (mirrored at the other end; a set may move
// some, bkSpot in 11-calls.js)
const BK_SPOT = { PG: [8.6, .6], SG: [5.0, -4.6], SF: [1.1, 6.8], PF: [5.6, 2.7], C: [2.3, -2.1] };
// the defense's set at the start of a possession: each defender between their man and the rim
let L = null;

// a point in the half side attacks, from [metres from its baseline, across], to court metres
function bkAt(side, u, v) { const d = bkDir(side); return [d > 0 ? BK_RULES.len - u : u, v * d]; }
// how far a court point is from the baseline side attacks (more is further up the floor)
const bkU = (side, x) => bkDir(side) > 0 ? BK_RULES.len - x : x;
const bkRimDist = (side, x, y) => hyp(x - bkHoopX(side), y);
function bkEv(k, s, o) { const e = { k, s: s || '', o: o || '', t: Math.round(L.t * 100) / 100 }; L.ev.push(e); L.evN = (L.evN || 0) + 1; if (G.tally && k in G.tally) G.tally[k]++; if (L.ev.length > 60) L.ev.shift(); bkSayEv(e); }

// the play at the start: both fives at the spots they line up on (plain data); ball to pl index h
function bkNewPlay() {
  const pl = [];
  for (const side of [0, 1]) {
    const T = G.teams[side];
    for (const pos of BK_POS) {
      const ri = G.on[side][BK_POS.indexOf(pos)], m = T.roster[ri];
      pl.push({ side, ri, pos, kind: m.kind, n: m.n, num: m.num, r: Object.assign({}, m.r), x: 14, y: 0, vx: 0, vy: 0, mark: -1, cut: null, cutT: 0, stun: 0, run: 0, act: '', actT: 0, cd: 0 });
    }
  }
  // each defender takes the player in the same spot
  pl.forEach((p, i) => { p.mark = (i + 5) % 10; });
  L = { pl, ball: { st: 'held', h: -1, x: 14, y: 0, z: 1, fx: 0, fy: 0, tx: 0, ty: 0, t: 0, T: 0, to: -1 }, t: 0, ev: [], think: .3, last: null, shot: null, lost: -1 };
  return L;
}
const bkHand = () => L.ball.st === 'held' ? L.ball.h : -1;
const bkOffense = () => L.pl.filter(p => p.side === G.poss);
const bkDefense = () => L.pl.filter(p => p.side !== G.poss);
function bkNearest(x, y, list) { let b = null, bd = 1e9; for (const p of list) { const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return [b, bd]; }
// the set: the offense at its spots with the ball at the point, each defender a stride inside their man
function bkSetSpots(side) {
  const at = {};
  for (const p of L.pl) {
    if (p.side === side) at[L.pl.indexOf(p)] = bkAt(side, ...bkSpot(p.side, p.pos));
  }
  for (const p of L.pl) {
    if (p.side === side) continue;
    const m = at[p.mark], hx = bkHoopX(side), d = hyp(m[0] - hx, m[1]) || 1, g = Math.min(1.6, d * .3);
    at[L.pl.indexOf(p)] = [m[0] + (hx - m[0]) / d * g, m[1] - m[1] / d * g];
  }
  return at;
}
// a player's speed now: metres a second
function bkSpeed(p, i) {
  let m = (4.2 + p.r.spd * .38) * (1 - .15 * bkTired(p)) * (bkGxOf(p).spd || 1) * (G.cur ? (p.side === G.cur.side ? bkFx('oSpd') : bkFx('dSpd')) : 1);
  if (i === bkHand()) m *= .9;
  if (p.stun > 0) m *= .25;
  return m;
}

function bkStep(dt) {
  L.t += dt;
  for (const p of L.pl) {
    if (p.stun > 0) p.stun -= dt; if (p.cd > 0) p.cd -= dt; if (p.cutT > 0 && (p.cutT -= dt) <= 0) p.cut = null;
    // (a jump that no shot came to meet lands off balance)
    if (p.actT > 0 && (p.actT -= dt) <= 0) { if (p.act === 'jump' && p.early) p.stun = .3; p.act = ''; p.early = 0; }
  }
  if (L.moveCd > 0) L.moveCd -= dt;
  const h = bkHand();
  if (L.pick) bkPickStep();
  // (the player you play doesn't think, but a defender up close still pressures their dribble)
  if (h >= 0 && L.pl[h].side === G.poss && !L.shot) { L.think -= dt; if (L.think <= 0) { L.think = (.28 + R() * .22) * bkPace(L.pl[h].side).think; if (bkYoursNow(h)) bkPressure(h); else bkThink(h); } }
  if (h >= 0 && !L.brk) bkBreakCheck(h);
  L.pl.forEach((p, i) => { const tg = bkAim(p, i); if (tg) bkMove(p, i, tg[0], tg[1], dt); else { p.vx *= .8; p.vy *= .8; p.x += p.vx * dt; p.y += p.vy * dt; } p.run += hyp(p.vx, p.vy) * dt * 2.2; });
  bkSeparate();
  bkBall(dt);
}
function bkMove(p, i, tx, ty, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy), sp = Math.min(bkSpeed(p, i), d / .2);
  const wx = d > .03 ? dx / d * sp : 0, wy = d > .03 ? dy / d * sp : 0, k = Math.min(1, dt * 7 * (bkOnWax(p) ? BK_WAX.turn : 1) * (bkGxOf(p).turn || 1));
  p.vx += (wx - p.vx) * k; p.vy += (wy - p.vy) * k;
  p.x = clamp(p.x + p.vx * dt, .3, BK_RULES.len - .3); p.y = clamp(p.y + p.vy * dt, -BK_RULES.wid / 2 + .3, BK_RULES.wid / 2 - .3);
}
function bkSeparate() {
  const pl = L.pl;
  for (let a = 0; a < pl.length; a++) for (let b = a + 1; b < pl.length; b++) {
    const A = pl[a], B = pl[b], dx = B.x - A.x, dy = B.y - A.y, d = hyp(dx, dy);
    if (d < BK_BODY && d > .001) { const k = (BK_BODY - d) / 2 / d; A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k; }
  }
}

/* ---------- where each player is going ---------- */
function bkAim(p, i) {
  const B = L.ball, off = p.side === G.poss, h = bkHand();
  // a shooter stays put through the shot; a jumper (a contest or a block) lands where they jumped
  if (p.act === 'shoot' || p.act === 'jump') return [p.x, p.y];
  // the ball loose (a rebound, a block, a tip): everyone near goes for where it comes down, the rest get back or spread
  if (B.st === 'loose' || B.st === 'free') {
    const d = hyp(p.x - B.tx, p.y - B.ty);
    if (d < 6.5 || p.pos === 'C' || p.pos === 'PF') {
      // the defense keeps inside position: a stride between its man and the ball
      if (!off && B.st === 'loose' && L.pl[p.mark]) { const m = L.pl[p.mark]; return [lerp(B.tx, m.x, .25), lerp(B.ty, m.y, .25)]; }
      return [B.tx, B.ty];
    }
    return off ? bkAt(p.side, ...bkSpot(p.side, p.pos)) : bkGuardSpot(p);
  }
  if (B.st === 'pass' && B.to === i) return [B.tx, B.ty];
  // the player you play, steered (09-hands.js); let go and they play on their own
  if (p.act === 'rise') return [p.x, p.y];
  const st = bkSteerAim(p, i); if (st) return st;
  if (off) {
    if (L.pick && L.pick.big === i) return bkScreenSpot();
    if (i === h) return L.drive ? [bkHoopX(p.side), 0] : bkHandlerSpot(p);
    // a cutter goes to the rim; the others hold their spot (with a drift, so the defense has to move)
    if (p.cut) return p.cut;
    if (p.cd <= 0 && L.t > 1.5 && h >= 0 && bkU(p.side, L.pl[h].x) < 11 && R() < .006 * (bkSetNow().cut || 1) * (bkDefNow().cut || 1) * bkFx('cut')) { const u = 1.6 + R() * 1.2; p.cut = bkAt(p.side, u, (R() - .5) * 2.4); p.cutT = 1.4; p.cd = 3 + R() * 2; }
    const s = bkAt(p.side, ...bkSpot(p.side, p.pos)), w = Math.sin(L.t * .9 + i * 1.7) * .8;
    return [s[0] + w * .4, s[1] + w];
  }
  return bkGuardSpot(p);
}
// the handler brings it up to the point, then works around it
function bkHandlerSpot(p) {
  const s = bkAt(p.side, ...bkSpot(p.side, p.pos));
  return [s[0] + Math.sin(L.t * .7) * .9, s[1] + Math.sin(L.t * 1.1) * 1.6];
}
// a defender between their man and the rim: tight on the ball, sagging off it
function bkGuardSpot(p) {
  const Df = bkDefNow();
  if (Df.zone && G.cur && p.side !== G.cur.side && bkHand() >= 0 && bkU(G.cur.side, L.pl[bkHand()].x) < 14) return bkZoneSpot(p);
  const m = L.pl[p.mark], hx = bkHoopX(m.side), dx = hx - m.x, dy = -m.y, d = hyp(dx, dy) || 1;
  // (a trap: the screener's defender leaves his man and goes at the ball too)
  if (L.trap && L.t < L.trap.t && L.pl.indexOf(p) === L.trap.i && bkHand() >= 0) { const hb = L.pl[bkHand()]; return [hb.x + (bkHoopX(hb.side) - hb.x) * .08, hb.y * .9]; }
  const onBall = L.pl.indexOf(m) === bkHand() || (L.ball.st === 'pass' && L.ball.to === L.pl.indexOf(m));
  // (the press: tight all over the backcourt; packing the paint: well off anyone out past five metres, and off the ball
  // handler too once they're out past the arc)
  const press = Df.back && bkHand() >= 0 && bkU(m.side, L.pl[bkHand()].x) > 14;
  const gap = press ? (onBall ? .7 : 1) : onBall ? Math.min(d * .5, Df.sag && d > 6.2 ? 1.6 : .95) : clamp(d * .32, .9, 3.2) + (Df.sag && d > 5 ? Df.sag : 0);
  let x = m.x + dx / d * gap, y = m.y + dy / d * gap;
  // off the ball, help toward a driver
  if (!onBall && L.drive && bkHand() >= 0) { const hb = L.pl[bkHand()]; x = lerp(x, hb.x, .25); y = lerp(y, hb.y, .25); }
  return [x, y];
}

/* ---------- the ball ---------- */
function bkBall(dt) {
  const B = L.ball;
  if (B.st === 'held') { const p = L.pl[B.h]; if (p) { B.x = p.x + .25; B.y = p.y; B.z = p.act === 'shoot' ? 2.3 : .9 + Math.abs(Math.sin(L.t * 9)) * .5; } return; }
  if (B.st === 'tip') return;
  B.t += dt; const u = Math.min(1, B.t / B.T);
  B.x = lerp(B.fx, B.tx, u); B.y = lerp(B.fy, B.ty, u);
  if (B.st === 'pass') { B.z = 1.3 + (B.lob ? 2.5 : .4) * 4 * u * (1 - u); if (u >= 1) bkCatch(); return; }
  if (B.st === 'shot') { B.z = lerp(2.3, 3.05, u) + (2 + B.T) * 4 * u * (1 - u); if (u >= 1) bkShotLands(); return; }
  if (B.st === 'loose') {
    B.z = lerp(B.z0, .6, u) + 1.4 * 4 * u * (1 - u);
    if (u >= 1) bkRebound();
    return;
  }
  if (B.st === 'free') { B.z = .2; B.tx = B.x; B.ty = B.y; const [p, d] = bkNearest(B.x, B.y, L.pl); if (p && d < .7) bkGain(L.pl.indexOf(p), 'loose'); }
}
// player i has the ball: a change of possession if they're on the other side (the play goes on the other way)
function bkGain(i, how) {
  const p = L.pl[i], B = L.ball;
  Object.assign(B, { st: 'held', h: i, to: -1, lob: false });
  L.drive = false; L.shot = null; L.got = L.t; L.think = .25 + R() * .2;
  // (an assist is for the pass the shooter caught: a rebound, a steal or a loose ball leaves nobody to credit)
  if (how !== 'pass') L.last = null;
  if (p.side !== G.poss) { bkGive(p.side); bkEv('change', how, p.n); bkPossession(how); bkMarks(); L.me = -1; L.brk = false; }
  L.pick = null;
}
// each defender back on the player in the same spot (after a switch, at a change of possession)
function bkMarks() { L.pl.forEach((p, i) => { p.mark = (i + 5) % 10; }); L.trap = null; }
function bkCatch() {
  const B = L.ball, rc = L.pl[B.to];
  if (B.stl >= 0) { const d = L.pl[B.stl]; bkBoxAdd(d.side, d.ri, 'stl'); bkEv('steal', d.n, L.pl[B.from].n); L.lost = B.from; B.stl = -1; return bkGain(L.pl.indexOf(d), 'steal'); }
  L.last = { i: B.from, t: L.t };
  const lob = B.lob;
  bkGain(B.to, 'pass');
  rc.cut = null;
  // a lob caught near the rim by a leaper goes straight up and in: the alley-oop
  // (Skyhook: from anywhere inside the arc, to anyone)
  const sky = bkFx('oop') > 0;
  if (lob && (sky ? bkRimDist(rc.side, rc.x, rc.y) < BK_RULES.arc : bkRimDist(rc.side, rc.x, rc.y) < 2.6 && bkLeaper(rc))) bkShoot({ alley: true });
}
/* the pass: from the handler to teammate j, led to where they're going. Any defender close to its lane may step in:
   settled now, and the flight shows it. A lob is slower and high: only a defender near where it comes down can reach
   it, and less often */
function bkPass(j, lob) {
  const h = bkHand(), p = L.pl[h], rc = L.pl[j], v = lob ? BK_LOB_V : BK_PASS_V;
  let tx = rc.x, ty = rc.y, T = 0;
  for (let k = 0; k < 3; k++) { T = hyp(tx - p.x, ty - p.y) / v; tx = rc.x + rc.vx * T; ty = rc.y + rc.vy * T; }
  T = Math.max(.18, T);
  let stl = -1;
  for (const d of bkDefense()) {
    const ax = tx - p.x, ay = ty - p.y, len = hyp(ax, ay) || 1, s = ((d.x - p.x) * ax + (d.y - p.y) * ay) / (len * len);
    if (s < (lob ? .8 : .15) || s > .95) continue;
    const off = Math.abs((d.x - p.x) * ay - (d.y - p.y) * ax) / len;
    if (off > .95 || d.stun > 0) continue;
    const ch = (.95 - off) / .95 * (.07 + d.r.def * .022 + d.r.spd * .006) * (1.25 - p.r.hnd * .04) * (lob ? .5 + d.r.hop * .03 : 1) * bkPress(d.side).steal * bkPace(p.side).risk * (bkDefNow().lanes || 1) * bkFx('stl');
    if (R() < ch) { stl = L.pl.indexOf(d); tx = lerp(p.x, tx, s); ty = lerp(p.y, ty, s); T *= s; break; }
  }
  Object.assign(L.ball, { st: 'pass', h: -1, fx: p.x, fy: p.y, tx, ty, t: 0, T, to: j, from: h, stl, lob: !!lob });
  L.drive = false; L.pick = null;
  bkEv(lob ? 'lob' : 'pass', p.n, rc.n);
}
// how likely a shot from (x, y) by shooter p goes in, with the nearest defender d at dd: { p, d (metres), con (0 open
// to 1 smothered), rim (at the rim), dunk }
function bkShotP(p, x, y) {
  const dist = bkRimDist(p.side, x, y), [d, dd] = bkNearest(x, y, L.pl.filter(q => q.side !== p.side && q.stun <= 0));
  const cs = d ? (d.r.def * .5 + d.r.hop * .25 + d.r.siz * .25) / 6.5 * (1 - .3 * bkTired(d)) * bkPress(d.side).con * (G.cur && d.side !== G.cur.side ? bkFx('con') : 1) : 0, con = d ? clamp((1.7 - dd) / 1.3, 0, 1) * cs : 0;
  const rim = dist < 1.5, dunk = rim && p.r.siz + p.r.hop >= 13 && con < .7;
  let pr;
  if (rim) pr = .68 + (p.r.siz + p.r.hop - 12) * .016 - con * (.24 - (p.r.siz - (d ? d.r.siz : 5)) * .01) + (dunk ? .18 : 0);
  else pr = .6 - (dist - 1.5) * .03 - Math.max(0, dist - 5) * .02 + (p.r.tch - 6) * .03 - con * .28 - Math.max(0, dist - 7.6) * .07;
  if (bkOnFire(p)) pr += BK_FIRE.p;
  pr -= .1 * bkTired(p);
  pr += bkCallMod(p, dist) + bkCourtMod(p);
  // (the powers on the floor: every shot, threes, at the rim)
  if (G.cur && p.side === G.cur.side) pr += bkFx('shot') + (bkShotValue(dist, y) === 3 ? bkFx('three') : 0) + (rim ? bkFx('rim') : 0);
  return { p: clamp(pr, .02, .96), dist, d: d ? L.pl.indexOf(d) : -1, dd, con, rim, dunk, three: bkShotValue(dist, y) === 3 };
}
/* the shot: settled at the release. A defender close enough may block it (it comes off loose) or foul (free throws:
   the game, 07-game.js, takes them when the shot comes down). Otherwise in or out by bkShotP; a miss mostly hits the rim */
/* o: { e (09-hands.js: how far from the top of the jump you let go, as a share of the rise; the CPU's shots have
   none), alley (the alley-oop: at the rim, a dunk, a better look) } */
function bkShoot(o) {
  const h = bkHand(), p = L.pl[h], f = o || {}, hx = bkHoopX(p.side);
  const S = f.alley ? Object.assign(bkShotP(p, hx + (p.x - hx) * .4, p.y * .4), { rim: true }) : bkShotP(p, p.x, p.y), d = S.d >= 0 ? L.pl[S.d] : null;
  if (f.alley) { S.dunk = true; S.p = Math.min(.95, S.p + .12); S.three = false; }
  const pts = S.three ? 3 : 2, near = d && S.dd < 1.2;
  let block = false, foul = false, jumped = false;
  for (const q of L.pl) q.early = 0;
  if (near) {
    // the jump: a defender already up as the shot goes up (just before it) blocks far more; one you play who didn't jump, far less
    jumped = d.act === 'jump' && d.jumpAt != null && L.t - d.jumpAt < BK_JUMP.window;
    const mine = bkYoursNow(S.d) && !jumped;
    const pb = clamp(.08 + (d.r.hop * .4 + d.r.siz * .4 + d.r.def * .3 - p.r.siz * .5 - p.r.hop * .3 - 1.4) * .03, .015, .35) * (1.2 - S.dd) / 1.2 * (S.dist < 2.6 ? 1.5 : .4) * (jumped ? BK_JUMP.block : mine ? .5 : 1) * bkPress(d.side).block * bkFx('blk');
    block = R() < pb;
    foul = !block && R() < (S.dist < 2.2 ? .14 : .05) * (1.35 - d.r.def * .05) * bkPress(d.side).foul;
    if (!mine && !jumped) { d.act = 'jump'; d.actT = .5; d.jumpAt = L.t; }
  }
  // (Wrist Bands: your shots get the wider window, bkWindow; the CPU's a touch more likely)
  const pm = f.e != null ? bkHandMake(S.p, f.e, p) : (S.p + (bkGxOf(p).win || 0) * .5) * (jumped ? .85 : 1);
  const made = !block && R() < pm * (foul ? .45 : 1), swish = made && f.e != null && f.e <= bkWindow(S.p, p) * BK_WIN.perfect;
  p.act = 'shoot'; p.actT = .35;
  L.shot = { i: h, side: p.side, pts, made, block, foul, swish, alley: !!f.alley, hand: f.e != null, by: d ? S.d : -1, dist: Math.round(S.dist * 10) / 10, rim: S.rim, dunk: S.dunk && !block, p: Math.round(S.p * 100) / 100, con: Math.round(S.con * 100) / 100, ast: L.last && L.last.i !== h && L.t - L.last.t < 3.5 && L.pl[L.last.i].side === p.side ? L.last.i : -1 };
  const T = block ? .16 : S.rim ? .32 : .5 + S.dist * .05;
  Object.assign(L.ball, { st: 'shot', h: -1, fx: p.x, fy: p.y, tx: block ? lerp(p.x, hx, .2) : hx, ty: block ? p.y * .8 : 0, t: 0, T });
  L.drive = false; L.pick = null;
  bkEv('shot', p.n, f.alley ? 'alley' : S.three ? 'three' : S.dunk ? 'dunk' : S.rim ? 'layup' : 'jumper');
}
function bkShotLands() {
  const S = L.shot, p = L.pl[S.i];
  if (S.block) { const d = L.pl[S.by]; bkBoxAdd(d.side, d.ri, 'blk'); bkEv('block', d.n, p.n); bkLoose(L.ball.x, L.ball.y, 2.2, 1.6); }
  else if (S.made) { bkEv('made', p.n, S.pts); }
  else { bkEv('miss', p.n); bkShotReset(); bkLoose(bkHoopX(S.side), 0, 3.05, S.pts === 3 ? 3.2 : 2.1); }
  // the game (07-game.js) scores it, and takes any free throws
  bkShotDone(S);
}
// the ball comes off loose from (x, y) at height z0, landing r metres away on average, back toward the floor
function bkLoose(x, y, z0, r) {
  const wild = z0 > 3 && bkBent(G.poss) ? BK_RIM.wild : 1, back = bkDir(G.poss), a = Math.PI + (R() - .5) * 2.4 * wild, rr = r * (.55 + R() * .7) * wild;
  let tx = x + Math.cos(a) * rr * back, ty = y + Math.sin(a) * rr;
  tx = clamp(tx, .5, BK_RULES.len - .5); ty = clamp(ty, -BK_RULES.wid / 2 + .5, BK_RULES.wid / 2 - .5);
  Object.assign(L.ball, { st: 'loose', h: -1, fx: x, fy: y, tx, ty, t: 0, T: .55 + rr * .08, z0 });
}
// a rebound: the nearest, the biggest and the best leapers have the best of it, and the defense has inside position
function bkRebound() {
  const B = L.ball, c = [];
  for (const p of L.pl) {
    const d = hyp(p.x - B.tx, p.y - B.ty); if (d > 2.2 || p.stun > 0) continue;
    c.push([p, (2.2 - d) ** 2 * (1 + (p.r.siz + (bkGxOf(p).reb || 0)) * .1 + p.r.hop * .07) * (p.side !== G.poss ? 1.7 * (bkDefNow().reb || 1) * bkFx('dreb') : bkFx('reb')) * bkBoxOut(p)]);
  }
  if (!c.length) { B.st = 'free'; return; }
  let s = c.reduce((a, [, w]) => a + w, 0) * R(), win = c[0][0];
  for (const [p, w] of c) { s -= w; if (s <= 0) { win = p; break; } }
  const off = win.side === G.poss;
  bkBoxAdd(win.side, win.ri, off ? 'oreb' : 'dreb');
  bkEv('reb', win.n, off ? 'off' : 'def');
  bkGain(L.pl.indexOf(win), 'rebound');
}
// the handler loses it on the dribble to defender d
function bkPicked(d) {
  const h = bkHand(); bkBoxAdd(d.side, d.ri, 'stl'); bkEv('steal', d.n, L.pl[h].n); L.lost = h;
  L.pl[h].stun = .35; bkGain(L.pl.indexOf(d), 'steal');
}

/* ---------- the hot hand, the pick, the fast break ---------- */
// three makes in a row from one player and they're on fire: a better look (p) until they miss
const BK_FIRE = { n: 3, p: .08 };
// who can finish a lob above the rim
const bkLeaper = p => p.r.hop >= 7 || p.r.siz + p.r.hop >= 13;
const bkOnFire = p => !!G.hot && (G.hot[p.side][p.ri] || 0) >= BK_FIRE.n;
// the jump: up this long before the release counts as in time, and blocks this many times as often
const BK_JUMP = { window: .45, block: 2.2 };
/* the pick: h's nearest big (not h) goes to screen h's defender. When the big gets there (or soon after), the defense
   reacts: switch (the two defenders swap men: a mismatch), over (h's defender fights over it, a step behind: an open
   lane) or trap (the big's defender comes at the ball too: the big rolls free). The big then rolls to the rim. */
function bkPick(h) {
  const H = L.pl[h]; if (!H || L.pick || H.side !== G.poss) return false;
  const di = L.pl.findIndex(q => q.side !== H.side && q.mark === h), big = L.pl.map((q, i) => i).filter(i => i !== h && L.pl[i].side === H.side && BK_ROLE[L.pl[i].pos] === 'big').sort((a, b) => hyp(L.pl[a].x - H.x, L.pl[a].y - H.y) - hyp(L.pl[b].x - H.x, L.pl[b].y - H.y))[0];
  if (di < 0 || big == null) return false;
  L.pick = { big, d: di, h, t: L.t }; L.pl[big].cut = null;
  bkEv('pick', L.pl[big].n, H.n);
  return true;
}
// where the screen goes: beside the ball's defender, on the side away from the sideline
function bkScreenSpot() {
  const D = L.pl[L.pick.d], H = L.pl[L.pick.h], dx = D.x - H.x, dy = D.y - H.y, d = hyp(dx, dy) || 1, s = D.y > 0 ? -1 : 1;
  return [D.x - dy / d * .6 * s, D.y + dx / d * .6 * s];
}
function bkPickStep() {
  const P = L.pick, h = bkHand();
  if (h !== P.h) { L.pick = null; return; }
  const B = L.pl[P.big], [sx, sy] = bkScreenSpot();
  if (hyp(B.x - sx, B.y - sy) < .7 || L.t - P.t > 1.8) bkPickRes();
}
const BK_PICK_REACT = { switch: 'They switch', over: 'Over the top', trap: 'They trap' };
function bkPickRes() {
  const P = L.pick, D = L.pl[P.d], H = L.pl[P.h], Bg = L.pl[P.big];
  // (the big's defender; or, after an earlier switch has left nobody on the big, whoever is nearest them)
  let bi = L.pl.findIndex(q => q.side !== H.side && q.mark === P.big);
  if (bi < 0) { const [q] = bkNearest(Bg.x, Bg.y, L.pl.filter(q => q.side !== H.side && q !== D)); bi = q ? L.pl.indexOf(q) : -1; }
  const BD = bi >= 0 ? L.pl[bi] : null;
  L.pick = null;
  const k = bkFx('fade') ? 'fade' : bkFx('wall') ? 'wall' : !BD ? 'over' : bkDefNow().allSwitch ? 'switch' : wpick({ switch: 1.1, over: .8 + (D.r.def + D.r.spd - 12) * .08, trap: .55 });
  if (k === 'switch') { D.mark = P.big; BD.mark = P.h; GD.msg = `Pick and roll: they switch, and ${BD.n} the ${BD.kind} has ${H.n} now.`; }
  else if (k === 'fade') { GD.msg = `Pick and roll: ${D.n} fades through the screen like smoke.`; }
  else if (k === 'wall') { D.stun = 1.3; GD.msg = `Pick and roll: ${D.n} can't get over the screen, and ${H.n} is free.`; }
  else if (k === 'over') { D.stun = .6; GD.msg = `Pick and roll: ${D.n} goes over the screen, and ${H.n} has a step.`; }
  else { L.trap = { i: bi, t: L.t + 1.6 }; GD.msg = `Pick and roll: they trap ${H.n}, and ${Bg.n} rolls free.`; }
  L.pickLast = k;
  const [rx, ry] = bkAt(Bg.side, 1.8, (R() - .5) * 1.6); Bg.cut = [rx, ry]; Bg.cutT = 1.8; Bg.cd = 2.5;
  bkEv('screen', Bg.n, k);
}
// a fast break: the ball across half court soon after a change, with more attackers than defenders back
function bkBreakCheck(h) {
  const p = L.pl[h], u = bkU(p.side, p.x);
  if (p.side !== G.poss || u > 14 || u < 9 || L.t - (L.got || 0) > 4.5) return;
  const back = bkDefense().filter(d => bkU(p.side, d.x) < u + .5).length, ahead = bkOffense().filter(q => bkU(q.side, q.x) <= u + 1).length;
  if (back < 3 && ahead > back) { L.brk = true; GD.big = { k: 'break' }; GD.msg = `Fast break: ${ahead} on ${back}!`; bkEv('break', p.n, `${ahead}-${back}`); }
  else if (u < 12) L.brk = true;
}
