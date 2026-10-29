/* Cinder Gridiron: the live play (issue #9, phase 1). A play runs for a few seconds on a fixed step (GF_DT): fourteen
   players head where their call sends them, and the ratings settle what happens when they meet.
   - Blocks: a blocker who reaches a defender locks up with them. Strength decides who drives whom, and the defender
     sheds the block sooner the stronger they are, and the longer the play goes on.
   - The quarterback hands off on a run. On a pass they drop back and throw at the call's time, or sooner under
     pressure (a hurried throw is less accurate), to the receiver with the most room, leading them.
   - A thrown ball is caught by hands, broken up or picked off by a defender who gets there first, or lands loose.
   - A defender within reach of the ball carrier tries a tackle: their tackling against the carrier's strength and
     speed. One shrugged off up close leaves them down for a moment and slows the carrier: a broken tackle. A defender
     alongside can dive, at worse odds the further it is, and a missed dive costs only a moment.
   - Defenders chase on a pursuit angle: the soonest point they can meet the carrier.
   - Speed counts, but less than its rating spread suggests (6.4 to 7.8 yards a second): a side fast everywhere
     otherwise won nearly every game, whatever the calls (phase 2 measured it).
   - The carrier runs for the goal line and away from tacklers. The play ends at a tackle, a sack, an incompletion, an
     interception (no returns yet), out of bounds or a touchdown.
   L is the play, plain JSON (players by index, no references): { oc, dc, t, pl, id, did, ball, carrier, thrown,
   handed, done, broken }. Positions are yards from the line of scrimmage (x, downfield) and the middle (y). */
// GF_READ: how long after the throw a defender breaks on the ball; GF_REACH: how far a defender dives to tackle
const GF_DT = 1 / 30, GF_HALF = 26.65, GF_MAXT = 20, GF_READ = .35, GF_REACH = 1.7;
let L = null;
const gfSpeed = p => (6 + p.r.spd * .2) * (L.ball.st === 'held' && L.ball.h === L.pl.indexOf(p) ? .94 : 1) * (p.slow > 0 ? .55 : 1) * (p.stun > 0 ? .2 : 1);

function gfSnap(oc, dc) {
  const OT = G.teams[G.poss], DT = G.teams[1 - G.poss], P = GF_PLAYS[oc], D = GF_DEFS[dc], pl = [], id = {}, did = {};
  const add = (T, side, pos, at) => {
    const ri = side ? T.def[pos] : T.off[pos], m = T.roster[ri];
    pl.push({ side, pos, ri, kind: m.kind, n: m.n, num: m.num, r: m.r, x: at[0], y: at[1], vx: 0, vy: 0, eng: -1, push: 0, stun: 0, slow: 0, cd: 0, job: '', mark: -1, spot: null, route: null, wp: 0 });
    return pl.length - 1;
  };
  const set = gfSet(oc);
  for (const k in set) id[k] = add(OT, 0, k, set[k]);
  const dset = gfDefSet(dc);
  for (const k in dset) did[k] = add(DT, 1, k, dset[k]);
  for (const k in id) {
    const p = pl[id[k]], r = P.routes && P.routes[k];
    p.job = k === 'QB' ? 'qb' : ['C', 'LG', 'RG'].includes(k) || (P.kind === 'run' && P.set && P.set[k]) ? 'block' : k === 'RB' ? (P.kind === 'run' ? 'take' : P.rb === 'block' ? 'pblock' : 'route') : P.kind === 'run' ? 'stalk' : 'route';
    if (r) p.route = r.map(([dx, dy]) => [p.x + dx, p.y + dy]);
  }
  for (const k in did) {
    const p = pl[did[k]];
    p.job = D.rush.includes(k) ? 'rush' : D.man && D.man[k] ? 'man' : 'zone';
    if (p.job === 'man') p.mark = id[D.man[k]];
    if (p.job === 'zone') p.spot = (D.zone && D.zone[k]) || GF_DEF_SET[k];
  }
  L = { oc, dc, t: 0, pl, id, did, ball: { st: 'held', h: id.QB, x: pl[id.QB].x, y: 0, z: 1, fx: 0, fy: 0, tx: 0, ty: 0, bt: 0, T: 0, tgt: -1 },
    carrier: id.QB, thrown: false, handed: false, done: null, broken: 0, gap: (R() < .5 ? -1 : 1) * (1 + R() * 2.5), toGoal: GF_RULES.field - G.ball, back: G.ball, ev: [],
    // Play mode (11-play.js): your keys for this play, and the stiff-arm
    hands: gfHands(), ctl: { steer: null, hold: null, tgt: -1, picked: false }, arm: 0, armUsed: false };
  return L;
}
function gfEv(k, s, o) { L.ev.push({ k, s, o: o || '', t: L.t }); }
// the free defenders (not blocked, not down)
const gfFree = () => L.pl.filter(p => p.side === 1 && p.eng < 0 && p.stun <= 0);
function gfNearest(x, y, list) { let b = null, bd = 1e9; for (const p of list) { const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return [b, bd]; }

function gfStep(dt) {
  L.t += dt;
  if (L.hands) gfHandsStep();
  for (const p of L.pl) { if (p.stun > 0) p.stun -= dt; if (p.slow > 0) p.slow -= dt; if (p.cd > 0) p.cd -= dt; }
  gfQB();
  for (const p of L.pl) {
    if (p.eng >= 0) continue;
    const tg = gfAim(p);
    if (tg) gfMove(p, tg[0], tg[1], dt, tg[2]); else { p.vx *= .8; p.vy *= .8; p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  gfBlocks(dt);
  gfSeparate();
  gfBall(dt);
  if (!L.done) gfTackles();
  if (!L.done) gfBounds();
  if (!L.done && L.t > GF_MAXT) gfDead('tackle');
}
// turn: how quickly a player changes direction (7 a second; a defender in coverage turns slower, so a cut gains room)
function gfMove(p, tx, ty, dt, turn) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy), sp = Math.min(gfSpeed(p), d / .25);
  const wx = d > .05 ? dx / d * sp : 0, wy = d > .05 ? dy / d * sp : 0, k = Math.min(1, dt * (turn || 7));
  p.vx += (wx - p.vx) * k; p.vy += (wy - p.vy) * k; p.x += p.vx * dt; p.y += p.vy * dt;
}

/* ---------- where each player is going ---------- */
function gfAim(p) {
  const P = GF_PLAYS[L.oc], i = L.pl.indexOf(p), c = L.carrier >= 0 ? L.pl[L.carrier] : null, pocket = L.carrier === L.id.QB && !L.thrown;
  // the carrier runs (the quarterback never does in phase 1, only hands off or throws)
  if (L.hands && L.ball.st === 'held' && L.ball.h === i) { const s = gfSteerAim(p); if (s) return s; if (i === L.id.QB && p.x > 0) return gfRunLine(p); }
  if (L.ball.st === 'held' && L.ball.h === i && i !== L.id.QB) return gfRunLine(p);
  if (p.side === 0) {
    const qb = L.pl[L.id.QB];
    if (p.job === 'qb') return P.kind === 'pass' && !L.thrown ? [GF_OFF_SET.QB[0] - P.drop, 0] : P.kind === 'run' && !L.handed ? [qb.x + .3, 0] : null;
    if (p.job === 'take' && !L.handed) return [qb.x - .6, qb.y + .4];
    // after the handoff or the catch, everyone blocks for the carrier
    if (c && !pocket && p !== c && p.job !== 'stalk') { const [d] = gfNearest(c.x, c.y, gfFree().filter(d => d.x > c.x - 2)); return d && hyp(d.x - c.x, d.y - c.y) < 9 ? [lerp(d.x, c.x, .35), lerp(d.y, c.y, .35)] : null; }
    if (p.job === 'block' || p.job === 'pblock') {
      if (P.release && L.t > P.release) return [3 + (p.pos === 'C' ? 0 : 2), (P.routes.RB[0][1] > 0 ? 1 : -1) * (p.pos === 'LG' ? 3 : p.pos === 'RG' ? 7 : 5)];
      const home = p.job === 'pblock' ? [qb.x + 1.2, qb.y + 1.5] : P.kind === 'run' ? [p.x + 1.2, p.y] : [-1.8, p.y];
      const [d, dd] = gfNearest(p.x, p.y, gfFree().filter(d => d.job === 'rush' || P.kind === 'run'));
      return d && dd < (P.kind === 'run' ? 7 : 4) ? [lerp(d.x, qb.x, .15), lerp(d.y, qb.y, .15)] : home;
    }
    // on a run the receivers block the defender in front of them, out wide
    if (p.job === 'stalk') { const [d, dd] = gfNearest(p.x, p.y, gfFree().filter(d => Math.abs(d.y) > 5)); return d && dd < 9 ? [d.x, d.y] : [p.x + 1.5, p.y]; }
    // the receiver the ball is thrown to comes back to it
    if (L.ball.st === 'air' && L.ball.tgt === i) return [L.ball.tx, L.ball.ty];
    if (p.job === 'route' && p.route) {
      const w = p.route[Math.min(p.wp, p.route.length - 1)];
      if (hyp(w[0] - p.x, w[1] - p.y) < 1 && p.wp < p.route.length) p.wp++;
      if (p.wp >= p.route.length) { const last = p.route[p.route.length - 1], prev = p.route.length > 1 ? p.route[p.route.length - 2] : [p.x - 1, p.y]; return last[0] > 15 ? [p.x + 3, p.y + (last[1] - prev[1]) * .1] : last; }
      return w;
    }
    return null;
  }
  // defense: once they have read the throw, the ones near where it comes down go for the ball
  const qb = L.pl[L.id.QB], lead = q => gfIntercept(p, q);
  if (L.ball.st === 'air' && L.ball.bt > GF_READ) { const B = L.ball; if (hyp(B.tx - p.x, B.ty - p.y) < 13) return [B.tx, B.ty]; }
  // someone else has it: after a catch everyone chases; after a handoff the rush chases at once, the linebacker and
  // the man defenders read the run in under half a second, and the deep zone a beat later
  if (c && (L.carrier !== L.id.QB || c.x > 0) && (!L.handed || p.job === 'rush' || L.t > (p.job === 'zone' ? .9 : .45))) return lead(c);
  if (p.job === 'rush') return lead(qb);
  if (p.job === 'man') { const m = L.pl[p.mark]; return [m.x + .8, m.y, 3.2]; }
  if (p.job === 'zone') {
    const [r, rd] = gfNearest(p.spot[0], p.spot[1], L.pl.filter(q => q.side === 0 && q.job === 'route'));
    return r && rd < 7 ? [Math.max(r.x + 1.5, p.spot[0] - 3), lerp(p.spot[1], r.y, .7), 3.5] : p.spot;
  }
  return null;
}
// a pursuit angle: the soonest point (up to 3 seconds out) where p can meet q if q keeps running as it is; straight at
// q when there is none
function gfIntercept(p, q) {
  const sp = gfSpeed(p);
  for (let t = .1; t <= 3; t += .1) { const x = q.x + q.vx * t, y = q.y + q.vy * t; if (hyp(x - p.x, y - p.y) <= sp * t) return [x, y]; }
  return [q.x + q.vx * .5, q.y + q.vy * .5];
}
// the carrier looks a few yards ahead for the lane with the fewest defenders in it (a blocked one is still a body in
// the way), a little more willing to stay in the lane already taken, and keeps in from the sideline
function gfRunLine(p) {
  if (p.job === 'take' && p.x < -1.5) return [p.x + 2, L.gap];
  const ax = p.x + 4, def = L.pl.filter(d => d.side === 1 && d.stun <= 0);
  let best = p.y, bc = 1e9;
  for (let y = -GF_HALF + 2; y <= GF_HALF - 2; y += 1.5) {
    let cost = Math.abs(y - p.y) * .09;
    for (const d of def) { const dd2 = (d.x - ax) ** 2 + (d.y - y) ** 2; cost += (d.eng >= 0 ? .45 : 1) * Math.exp(-dd2 / 9); }
    if (cost < bc) { bc = cost; best = y; }
  }
  return [p.x + 5, clamp(best, p.y - 4, p.y + 4)];
}
// bodies: two players who aren't locked in a block don't stand in the same place
function gfSeparate() {
  const pl = L.pl;
  for (let a = 0; a < pl.length; a++) for (let b = a + 1; b < pl.length; b++) {
    const A = pl[a], B = pl[b]; if (A.eng === b) continue;
    const dx = B.x - A.x, dy = B.y - A.y, d = hyp(dx, dy);
    if (d < .7 && d > .001) { const k = (.7 - d) / 2 / d; A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k; }
  }
}

/* ---------- the quarterback ---------- */
function gfQB() {
  const P = GF_PLAYS[L.oc], qb = L.pl[L.id.QB];
  if (P.kind === 'run') {
    const rb = L.pl[L.id.RB];
    if (!L.handed && L.t > .3 && hyp(rb.x - qb.x, rb.y - qb.y) < 1.3) { L.handed = true; L.carrier = L.id.RB; L.ball.h = L.id.RB; gfEv('handoff', rb.n); }
    return;
  }
  if (L.thrown || L.carrier !== L.id.QB || L.hands) return;
  const [, press] = gfNearest(qb.x, qb.y, gfFree());
  // under pressure the quarterback tries to get it out early, but doesn't always see the rusher in time
  if (L.t >= P.throwAt || (press < 1.8 && L.t > .55 && (P.hot || R() < GF_DT * 5))) gfThrow(press < 1.8 && L.t < P.throwAt && !P.hot);
}
function gfThrow(hurry) {
  const P = GF_PLAYS[L.oc], qb = L.pl[L.id.QB], free = L.pl.filter(p => p.side === 1 && p.stun <= 0);
  let best = -1, bs = -1e9;
  L.pl.forEach((p, i) => {
    if (p.side !== 0 || p.job !== 'route') return;
    const [, sep] = gfNearest(p.x, p.y, free);
    const s = Math.min(sep, 8) + p.x * (L.oc === 'deep' ? .08 : .02) + (L.oc === 'screen' && p.pos === 'RB' ? 4 : 0);
    if (s > bs) { bs = s; best = i; }
  });
  const rc = L.pl[best], v = 15 + qb.r.arm * 1.3;
  let tx = rc.x, ty = rc.y, T = 0;
  for (let k = 0; k < 3; k++) { T = hyp(tx - qb.x, ty - qb.y) / v; tx = rc.x + rc.vx * T; ty = rc.y + rc.vy * T; }
  // a long throw, a weak arm and a hurried one all miss by more
  const e = (10 - qb.r.arm) * .1 + (hurry ? 1.6 : .25) + hyp(tx - qb.x, ty - qb.y) * .035;
  tx += gauss() * e; ty += gauss() * e; T = Math.max(.25, hyp(tx - qb.x, ty - qb.y) / v);
  Object.assign(L.ball, { st: 'air', h: -1, fx: qb.x, fy: qb.y, tx, ty, bt: 0, T, tgt: best });
  L.thrown = true; L.carrier = -1;
  gfEv('throw', hurry ? 'hurried' : '', rc.n);
}

/* ---------- the ball ---------- */
function gfBall(dt) {
  const B = L.ball;
  if (B.st === 'held') { const h = L.pl[B.h]; B.x = h.x; B.y = h.y; B.z = 1; return; }
  if (B.st !== 'air') return;
  B.bt += dt; const u = Math.min(1, B.bt / B.T);
  B.x = lerp(B.fx, B.tx, u); B.y = lerp(B.fy, B.ty, u); B.z = 1.8 + 4 * (1.5 + B.T * 3) * u * (1 - u);
  if (u < 1) return;
  const rc = L.pl[B.tgt], dr = hyp(rc.x - B.tx, rc.y - B.ty);
  const [d, dd] = gfNearest(B.tx, B.ty, L.pl.filter(p => p.side === 1 && p.stun <= 0));
  if (Math.abs(B.ty) > GF_HALF || dr > 1.7) { B.st = 'dead'; return gfDead('inc', dr > 1.7 ? 'overthrown' : 'out of bounds'); }
  if (d && dd < 1.4 && dd < dr) {
    if (R() < .03 + d.r.hnd * .006) { B.st = 'dead'; return gfDead('int', d.n, d.x); }
    if (R() < .5) { B.st = 'dead'; return gfDead('inc', 'broken up by ' + d.n); }
  }
  // a long ball is a harder catch
  const far = Math.max(0, hyp(B.tx - B.fx, B.ty - B.fy) - 15) * .012;
  const pc = (d && dd < 1.4 ? .35 + rc.r.hnd * .03 : clamp(.62 + rc.r.hnd * .035 - Math.max(0, 1.6 - dd) * .3, .15, .97)) - far;
  if (R() < pc) { B.st = 'held'; B.h = B.tgt; L.carrier = B.tgt; rc.slow = .15; gfEv('catch', rc.n); }
  else { B.st = 'dead'; gfDead('inc', 'dropped'); }
}

/* ---------- blocks ---------- */
function gfBlocks(dt) {
  const P = GF_PLAYS[L.oc], c = L.carrier >= 0 ? L.pl[L.carrier] : null;
  // a screen lets the rush through
  if (P.release && L.t > P.release && !L.released) {
    L.released = true;
    for (const o of L.pl) if (o.side === 0 && o.eng >= 0) { L.pl[o.eng].eng = -1; o.eng = -1; }
  }
  for (const o of L.pl) {
    if (o.side !== 0 || o.eng >= 0 || o.stun > 0 || o === c || o.job === 'qb' || (o.job === 'route' && !(c && L.carrier !== L.id.QB))) continue;
    for (const d of L.pl) {
      if (d.side !== 1 || d.eng >= 0 || d.stun > 0 || hyp(d.x - o.x, d.y - o.y) > 1.05) continue;
      // a screen's linemen let the rush go and get out in front: they block again once the back has it
      if (P.release && o.job === 'block' && L.t > P.release * .7 && L.carrier !== L.id.RB) continue;
      o.eng = L.pl.indexOf(d); d.eng = L.pl.indexOf(o); d.push = 0; gfEv('block', o.n); break;
    }
  }
  for (const o of L.pl) {
    if (o.side !== 0 || o.eng < 0) continue;
    // run blocking drives forward: the blockers know the snap count and where the play goes
    const d = L.pl[o.eng], dif = o.r.str - d.r.str + (P.kind === 'run' ? 1.5 : 0);
    // the pair moves the way the stronger one drives
    d.push = lerp(d.push, dif + gauss() * 1.5, Math.min(1, dt * 3));
    const mv = clamp(d.push, -4, 4) * .22 * dt; o.x += mv; d.x += mv;
    const near = c && hyp(c.x - d.x, c.y - d.y) < 1.2 ? 1.6 : 1;
    const shed = ((P.kind === 'run' ? .18 : .3) + Math.max(0, -dif) * .14 + (d.job === 'rush' && L.t > 2 ? .35 : 0)) * near * (d.job === 'rush' && GF_DEFS[L.dc].stunt || 1);
    if (R() < shed * dt) { o.eng = -1; d.eng = -1; o.stun = .45; gfEv('shed', d.n); }
  }
}

/* ---------- tackles, the sideline and the goal line ---------- */
function gfTackles() {
  if (L.ball.st !== 'held') return;
  const c = L.pl[L.carrier], sack = L.carrier === L.id.QB && !L.thrown && GF_PLAYS[L.oc].kind === 'pass' && c.x < 0;
  for (const d of L.pl) {
    const dd = hyp(d.x - c.x, d.y - c.y);
    if (d.side !== 1 || d.eng >= 0 || d.stun > 0 || d.cd > 0 || dd > GF_REACH) continue;
    d.cd = .6;
    // your stiff-arm shrugs off the next tackle (Play mode)
    if (L.arm > 0) { L.arm = 0; d.stun = .55; L.broken++; gfEv('broken', c.n); continue; }
    // a defender alongside can dive for the carrier, but the further the dive the likelier the miss
    const pt = clamp(.78 + (d.r.tkl - c.r.str) * .05 - (c.r.spd - d.r.spd) * .015 + (sack ? .1 : 0) - Math.max(0, dd - 1) * .35, .2, .93);
    if (R() < pt) return gfDead(sack ? 'sack' : 'tackle', d.n);
    // a missed dive only costs the diver a moment; a tackle shrugged off up close is a broken tackle
    if (dd > 1) { d.stun = .3; continue; }
    d.stun = .55; c.slow = .25; L.broken++; gfEv('broken', c.n);
  }
}
function gfBounds() {
  if (L.ball.st !== 'held') return;
  const c = L.pl[L.carrier];
  if (c.x >= L.toGoal) return gfDead('td');
  if (Math.abs(c.y) > GF_HALF) gfDead('out');
}
// the play is over: what happened, the yards it gained and who made it
function gfDead(what, by, x) {
  const c = L.carrier >= 0 ? L.pl[L.carrier] : null;
  const gain = what === 'inc' ? 0 : what === 'td' ? L.toGoal : what === 'int' ? 0 : Math.round(c.x);
  L.done = { what, gain, by: by || '', who: c ? c.n : '', x: x != null ? Math.round(x) : gain };
  return L.done;
}
// a whole play at once (the headless drive and the tests)
function gfPlayDown(oc, dc) { gfSnap(oc, dc); while (!L.done) gfStep(GF_DT); return L.done; }
