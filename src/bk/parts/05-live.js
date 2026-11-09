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
     up a fast break.
   Court metres: x along the court from the left baseline (0 to 28), y across from the middle (-7.5 to 7.5).
   L is the play, plain JSON (players by index, no references): { pl, ball, t, ev, think, last, shot }. */
const BK_DT = 1 / 30, BK_BODY = .55, BK_PASS_V = 12;
// spots in the half a side attacks: [metres from that baseline, across] (mirrored at the other end)
const BK_SPOT = { PG: [8.6, .6], SG: [5.0, -4.6], SF: [1.1, 6.8], PF: [5.6, 2.7], C: [2.3, -2.1] };
// the defense's set at the start of a possession: each defender between their man and the rim
let L = null;

// a point in the half side attacks, from [metres from its baseline, across], to court metres
function bkAt(side, u, v) { const d = bkDir(side); return [d > 0 ? BK_RULES.len - u : u, v * d]; }
// how far a court point is from the baseline side attacks (more is further up the floor)
const bkU = (side, x) => bkDir(side) > 0 ? BK_RULES.len - x : x;
const bkRimDist = (side, x, y) => hyp(x - bkHoopX(side), y);
function bkEv(k, s, o) { const e = { k, s: s || '', o: o || '', t: Math.round(L.t * 100) / 100 }; L.ev.push(e); L.evN = (L.evN || 0) + 1; if (L.ev.length > 60) L.ev.shift(); bkSayEv(e); }

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
    if (p.side === side) at[L.pl.indexOf(p)] = bkAt(side, ...BK_SPOT[p.pos]);
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
  let m = 4.2 + p.r.spd * .38;
  if (i === bkHand()) m *= .9;
  if (p.stun > 0) m *= .25;
  return m;
}

function bkStep(dt) {
  L.t += dt;
  for (const p of L.pl) { if (p.stun > 0) p.stun -= dt; if (p.cd > 0) p.cd -= dt; if (p.actT > 0 && (p.actT -= dt) <= 0) p.act = ''; if (p.cutT > 0 && (p.cutT -= dt) <= 0) p.cut = null; }
  const h = bkHand();
  if (h >= 0 && L.pl[h].side === G.poss && !L.shot) { L.think -= dt; if (L.think <= 0) { L.think = .28 + R() * .22; bkThink(h); } }
  L.pl.forEach((p, i) => { const tg = bkAim(p, i); if (tg) bkMove(p, i, tg[0], tg[1], dt); else { p.vx *= .8; p.vy *= .8; p.x += p.vx * dt; p.y += p.vy * dt; } p.run += hyp(p.vx, p.vy) * dt * 2.2; });
  bkSeparate();
  bkBall(dt);
}
function bkMove(p, i, tx, ty, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy), sp = Math.min(bkSpeed(p, i), d / .2);
  const wx = d > .03 ? dx / d * sp : 0, wy = d > .03 ? dy / d * sp : 0, k = Math.min(1, dt * 7);
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
    return off ? bkAt(p.side, ...BK_SPOT[p.pos]) : bkGuardSpot(p);
  }
  if (B.st === 'pass' && B.to === i) return [B.tx, B.ty];
  if (off) {
    if (i === h) return L.drive ? [bkHoopX(p.side), 0] : bkHandlerSpot(p);
    // a cutter goes to the rim; the others hold their spot (with a drift, so the defense has to move)
    if (p.cut) return p.cut;
    if (p.cd <= 0 && L.t > 1.5 && h >= 0 && bkU(p.side, L.pl[h].x) < 11 && R() < .006) { const u = 1.6 + R() * 1.2; p.cut = bkAt(p.side, u, (R() - .5) * 2.4); p.cutT = 1.4; p.cd = 3 + R() * 2; }
    const s = bkAt(p.side, ...BK_SPOT[p.pos]), w = Math.sin(L.t * .9 + i * 1.7) * .8;
    return [s[0] + w * .4, s[1] + w];
  }
  return bkGuardSpot(p);
}
// the handler brings it up to the point, then works around it
function bkHandlerSpot(p) {
  const s = bkAt(p.side, ...BK_SPOT[p.pos]);
  return [s[0] + Math.sin(L.t * .7) * .9, s[1] + Math.sin(L.t * 1.1) * 1.6];
}
// a defender between their man and the rim: tight on the ball, sagging off it
function bkGuardSpot(p) {
  const m = L.pl[p.mark], hx = bkHoopX(m.side), dx = hx - m.x, dy = -m.y, d = hyp(dx, dy) || 1;
  const onBall = L.pl.indexOf(m) === bkHand() || (L.ball.st === 'pass' && L.ball.to === L.pl.indexOf(m));
  const gap = onBall ? Math.min(d * .5, .95) : clamp(d * .32, .9, 3.2);
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
  if (p.side !== G.poss) { bkGive(p.side); bkEv('change', how, p.n); bkPossession(how); }
}
function bkCatch() {
  const B = L.ball, rc = L.pl[B.to];
  if (B.stl >= 0) { const d = L.pl[B.stl]; bkBoxAdd(d.side, d.ri, 'stl'); bkEv('steal', d.n, L.pl[B.from].n); L.lost = B.from; B.stl = -1; return bkGain(L.pl.indexOf(d), 'steal'); }
  L.last = { i: B.from, t: L.t };
  bkGain(B.to, 'pass');
  rc.cut = null;
}
/* the pass: from the handler to teammate j, led to where they're going. Any defender close to its lane may step in:
   settled now, and the flight shows it */
function bkPass(j) {
  const h = bkHand(), p = L.pl[h], rc = L.pl[j];
  let tx = rc.x, ty = rc.y, T = 0;
  for (let k = 0; k < 3; k++) { T = hyp(tx - p.x, ty - p.y) / BK_PASS_V; tx = rc.x + rc.vx * T; ty = rc.y + rc.vy * T; }
  T = Math.max(.18, T);
  let stl = -1;
  for (const d of bkDefense()) {
    const ax = tx - p.x, ay = ty - p.y, len = hyp(ax, ay) || 1, s = ((d.x - p.x) * ax + (d.y - p.y) * ay) / (len * len);
    if (s < .15 || s > .95) continue;
    const off = Math.abs((d.x - p.x) * ay - (d.y - p.y) * ax) / len;
    if (off > .95 || d.stun > 0) continue;
    const ch = (.95 - off) / .95 * (.07 + d.r.def * .022 + d.r.spd * .006) * (1.25 - p.r.hnd * .04);
    if (R() < ch) { stl = L.pl.indexOf(d); tx = lerp(p.x, tx, s); ty = lerp(p.y, ty, s); T *= s; break; }
  }
  Object.assign(L.ball, { st: 'pass', h: -1, fx: p.x, fy: p.y, tx, ty, t: 0, T, to: j, from: h, stl, lob: false });
  L.drive = false;
  bkEv('pass', p.n, rc.n);
}
// how likely a shot from (x, y) by shooter p goes in, with the nearest defender d at dd: { p, d (metres), con (0 open
// to 1 smothered), rim (at the rim), dunk }
function bkShotP(p, x, y) {
  const dist = bkRimDist(p.side, x, y), [d, dd] = bkNearest(x, y, L.pl.filter(q => q.side !== p.side && q.stun <= 0));
  const cs = d ? (d.r.def * .5 + d.r.hop * .25 + d.r.siz * .25) / 6.5 : 0, con = d ? clamp((1.7 - dd) / 1.3, 0, 1) * cs : 0;
  const rim = dist < 1.5, dunk = rim && p.r.siz + p.r.hop >= 13 && con < .7;
  let pr;
  if (rim) pr = .68 + (p.r.siz + p.r.hop - 12) * .016 - con * (.24 - (p.r.siz - (d ? d.r.siz : 5)) * .01) + (dunk ? .18 : 0);
  else pr = .6 - (dist - 1.5) * .03 - Math.max(0, dist - 5) * .02 + (p.r.tch - 6) * .03 - con * .28 - Math.max(0, dist - 7.6) * .07;
  return { p: clamp(pr, .02, .96), dist, d: d ? L.pl.indexOf(d) : -1, dd, con, rim, dunk, three: bkShotValue(dist, y) === 3 };
}
/* the shot: settled at the release. A defender close enough may block it (it comes off loose) or foul (free throws:
   the game, 07-game.js, takes them when the shot comes down). Otherwise in or out by bkShotP; a miss mostly hits the rim */
function bkShoot() {
  const h = bkHand(), p = L.pl[h], S = bkShotP(p, p.x, p.y), d = S.d >= 0 ? L.pl[S.d] : null;
  const pts = S.three ? 3 : 2, near = d && S.dd < 1.2;
  let block = false, foul = false;
  if (near) {
    const pb = clamp(.08 + (d.r.hop * .4 + d.r.siz * .4 + d.r.def * .3 - p.r.siz * .5 - p.r.hop * .3 - 1.4) * .03, .015, .35) * (1.2 - S.dd) / 1.2 * (S.dist < 2.6 ? 1.5 : .4);
    block = R() < pb;
    foul = !block && R() < (S.dist < 2.2 ? .14 : .05) * (1.35 - d.r.def * .05);
    d.act = 'jump'; d.actT = .5;
  }
  const made = !block && R() < S.p * (foul ? .45 : 1);
  p.act = 'shoot'; p.actT = .35;
  L.shot = { i: h, side: p.side, pts, made, block, foul, by: d ? S.d : -1, dist: Math.round(S.dist * 10) / 10, rim: S.rim, dunk: S.dunk && !block, p: Math.round(S.p * 100) / 100, con: Math.round(S.con * 100) / 100, ast: L.last && L.last.i !== h && L.t - L.last.t < 3.5 && L.pl[L.last.i].side === p.side ? L.last.i : -1 };
  const hx = bkHoopX(p.side), T = block ? .16 : S.rim ? .32 : .5 + S.dist * .05;
  Object.assign(L.ball, { st: 'shot', h: -1, fx: p.x, fy: p.y, tx: block ? lerp(p.x, hx, .2) : hx, ty: block ? p.y * .8 : 0, t: 0, T });
  L.drive = false;
  bkEv('shot', p.n, S.three ? 'three' : S.dunk ? 'dunk' : S.rim ? 'layup' : 'jumper');
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
  const back = bkDir(G.poss), a = Math.PI + (R() - .5) * 2.4, rr = r * (.55 + R() * .7);
  let tx = x + Math.cos(a) * rr * back, ty = y + Math.sin(a) * rr;
  tx = clamp(tx, .5, BK_RULES.len - .5); ty = clamp(ty, -BK_RULES.wid / 2 + .5, BK_RULES.wid / 2 - .5);
  Object.assign(L.ball, { st: 'loose', h: -1, fx: x, fy: y, tx, ty, t: 0, T: .55 + rr * .08, z0 });
}
// a rebound: the nearest, the biggest and the best leapers have the best of it, and the defense has inside position
function bkRebound() {
  const B = L.ball, c = [];
  for (const p of L.pl) {
    const d = hyp(p.x - B.tx, p.y - B.ty); if (d > 2.2 || p.stun > 0) continue;
    c.push([p, (2.2 - d) ** 2 * (1 + p.r.siz * .1 + p.r.hop * .07) * (p.side !== G.poss ? 1.7 : 1)]);
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
