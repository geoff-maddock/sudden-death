/* The Curling Shed: the stones on the ice (issue #102, phase 1). A pure model, shared by Play, the CPU and the sim.

   A throw leaves the near hog line (y = CR_STONE.y0) at x0, with a heading (ang, degrees, plus to the thrower's
   left), a speed (v, inches a second) and a handle (h: +1 curls to the left, -1 to the right; for a right-hander the
   out-turn and the in-turn). On the ice:
   - it slows by friction, CR_STONE.a inches a second every second on fresh pebble on a mid day, by the ice under it;
   - it curls toward its handle side, and more as it slows (a stone curls most in its last few feet), less on worn
     pebble;
   - sweeping (0 to 1, how hard, times how good the sweepers are) cuts the friction and the curl: a swept stone goes
     further and straighter;
   - stones that touch trade momentum (equal granite, nearly elastic): a stone hit square stops and the one it hits
     takes the speed; a stone hit thin keeps most of its own. The struck stone picks up a little turn from the hit, and
     the striker's own turn is halved;
   - a stone that touches the side boards, or goes wholly past the back line, is out of play, and the thrown stone is
     out if it stops short of the far hog line.
   crRun(stones, throw, opts) plays one stone to rest among the others and gives the stones in play after it, the
   thrown stone's path (with where it was swept), the hits, and a trace for the page. opts.sweep(st, t) says how hard
   the thrown stone is swept now (the CPU's sweepers, or your Space bar); opts.ice and opts.cold the ice. */
const CR_STONE = { y0: -1116, a: 9, curl: .28, vc: 34, sweepMu: .16, sweepCurl: .4, e: .9, keepCurl: .25, dt: .02, planDt: .05, traceEvery: .1, stop: .5 };
// the stone's acceleration on the ice: friction against its motion, and the curl across it
function crAccel(st, ice, cold, sw) {
  const v = Math.hypot(st.vx, st.vy); if (v < 1e-6) return [0, 0];
  // (a cursed stone drags heavy, or turns stiff and hardly curls: its own drag and curl, 13-powers.js)
  const mu = crIceAt(ice, st.x, st.y, cold) * (st.drag || 1) * (1 - CR_STONE.sweepMu * sw), ux = st.vx / v, uy = st.vy / v;
  const lat = (st.h || 0) * CR_STONE.curl * CR_STONE.a * mu / (1 + v / CR_STONE.vc) * (1 - CR_STONE.sweepCurl * sw) * (1 - CR_ICE.curlWorn * .4 * crWornAt(ice, st.x, st.y)) * (st.curlK || 1);
  // (the curl is across the motion: to the left of it for h = +1, and x is plus to the thrower's left, so the left of a
  // stone going (ux, uy) is (uy, -ux))
  return [-CR_STONE.a * mu * ux + lat * uy, -CR_STONE.a * mu * uy - lat * ux];
}
// two stones touch: trade momentum along the line between them (restitution e; a granite stone, g, is CR_GRANITE times
// as heavy as an ordinary one: 13-powers.js)
function crCollide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, nx = dx / d, ny = dy / d;
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rel <= 0) return false;
  const ma = a.g ? CR_GRANITE : 1, mb = b.g ? CR_GRANITE : 1, j = (1 + CR_STONE.e) * rel / (1 / ma + 1 / mb);
  a.vx -= j / ma * nx; a.vy -= j / ma * ny; b.vx += j / mb * nx; b.vy += j / mb * ny;
  // pull them apart to just touching
  const over = 2 * CR_SHEET.stoneR - d; if (over > 0) { a.x -= nx * over / 2; a.y -= ny * over / 2; b.x += nx * over / 2; b.y += ny * over / 2; }
  b.h = (b.h || 0) * .5 + (a.h || 0) * CR_STONE.keepCurl * .6; a.h = (a.h || 0) * .5; return true;
}
/* one stone thrown among the stones at rest: stones [{ id, s, x, y }], throw { id, s, x0, ang, v, h }; opts { ice,
   cold, sweep(st, t) -> 0..1 (how hard it is asked to be swept), legs + side (that side's sweepers, their rating and
   legs: crSweepEff, and the step spends their legs), plan (a coarser step, no trace: the CPU's look ahead), maxT }. Returns { stones (in
   play, at rest), out: [ids gone], path: [[x, y, swept]] of the thrown stone, hits, t, trace: [[t, [[id, x, y]]]],
   stop: where the thrown stone came to rest (or null) }.
   The same run, a step at a time (the page's, so you can sweep as it goes: phase 2): crRunInit makes it, crRunStep moves
   it one step (sweep: how hard it is swept now, or opts.sweep's), crRunTo moves it on to a time, crRunEnd gives the
   result. The steps are the same however the run is driven, so the page's stone and the sim's go the same way. */
function crRunInit(stones, th, opts) {
  const O = opts || {}, a = th.ang * Math.PI / 180, S = stones.map(st => Object.assign({ id: st.id, s: st.s, x: st.x, y: st.y, vx: 0, vy: 0, h: 0, out: false }, st.g ? { g: 1 } : {}));
  // (opts.fx: the thrown stone's powers, 13-powers.js: a curse's drag and stiffness, granite, smoke through a guard)
  const F = O.fx || null, T = { id: th.id, s: th.s, x: th.x0 || 0, y: CR_STONE.y0, vx: th.v * Math.sin(a), vy: th.v * Math.cos(a), h: th.h || 0, out: false, thrown: true };
  if (F) { if (F.heavy && F.heavy !== 1) T.drag = F.heavy; if (F.stiff && F.stiff !== 1) T.curlK = F.stiff; if (F.granite) T.gRest = 1; if (F.ghost) T.ghost = 1; }
  S.push(T);
  return { O, S, T, dt: O.plan ? CR_STONE.planDt : CR_STONE.dt, maxT: O.maxT || 60, path: [], trace: [], out: [], t: 0, hits: 0, nextTr: 0, sw: 0, done: false };
}
function crRunStep(Q, sweep) {
  if (Q.done) return false;
  const { O, S, T, path } = Q, R = CR_SHEET.stoneR, L = S.filter(st => !st.out), moving = L.filter(st => st.vx || st.vy);
  if (!moving.length || Q.t >= Q.maxT) { Q.done = true; return false; }
  // how hard the thrown stone is asked to be swept (0 to 1: the page's Space, or the CPU's sweepers), only while it is on
  // the sheet and moving; with opts.legs, the side's sweepers sweep that times how good they are and their legs, which
  // the step spends (a good pair with fresh legs sweeps a little harder than an average pair: up to 1.5)
  // (without legs, a caller's own sweep may run to 1.5, as a good fresh pair's does)
  const legs = !!O.legs && O.side != null && !!G && !!G.teams;
  const ask = !T.out && (T.vx || T.vy) ? clamp((sweep != null ? sweep : O.sweep ? O.sweep(T, Q.t) : 0) || 0, 0, legs ? 1 : 1.5) : 0;
  const fxs = O.fx && O.fx.sweep != null ? O.fx.sweep : 1, sw = ask && legs ? clamp(ask * crSweepEff(O.side) * fxs, 0, 1.5) : ask; Q.sw = sw;
  // (no stone moves more than half its radius in a step, so a fast one can't pass through another)
  const vmax = Math.max(...moving.map(st => Math.hypot(st.vx, st.vy))), dts = Math.min(Q.dt, .5 * R / Math.max(1, vmax));
  if (ask && legs) crLegsBurn(O.side, ask * (O.fx && O.fx.legs != null ? O.fx.legs : 1) * crKitLegs(O.side), dts);
  for (const st of moving) {
    const [ax, ay] = crAccel(st, O.ice, O.cold, st === T ? sw : 0);
    let vx = st.vx + ax * dts, vy = st.vy + ay * dts;
    // friction stops a stone, it never turns it round
    if (vx * st.vx + vy * st.vy <= 0 || Math.hypot(vx, vy) < CR_STONE.stop) { vx = 0; vy = 0; }
    st.x += (st.vx + vx) / 2 * dts; st.y += (st.vy + vy) / 2 * dts; st.vx = vx; st.vy = vy;
    // (the path every foot of travel, so a fast stone wears every cell it crosses)
    // (and the hardest sweeping since the last point, so a stretch swept between two points still wears)
    if (st === T) { Q.swMax = Math.max(Q.swMax || 0, sw); const P = path[path.length - 1]; if (!P || Math.hypot(st.x - P[0], st.y - P[1]) >= (O.plan ? 36 : 12)) { path.push([+st.x.toFixed(1), +st.y.toFixed(1), +Q.swMax.toFixed(2)]); Q.swMax = 0; } }
  }
  // contacts (only between stones that could touch: one of them moving)
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const p = L[i], q = L[j]; if (!(p.vx || p.vy || q.vx || q.vy)) continue;
    // (a smoke stone slides through the first guard it meets, and that one only)
    if (T.ghost && (p === T || q === T)) { const o = p === T ? q : p; if (T.ghostId === o.id) continue; if (!T.ghostId && !o.vx && !o.vy && crInFgz(o) && Math.hypot(p.x - q.x, p.y - q.y) < 2 * R) { T.ghostId = o.id; continue; } }
    if (Math.abs(p.x - q.x) < 2 * R && Math.abs(p.y - q.y) < 2 * R && Math.hypot(p.x - q.x, p.y - q.y) < 2 * R) {
      const [m, n] = (p.vx || p.vy) && Math.hypot(p.vx, p.vy) >= Math.hypot(q.vx, q.vy) ? [p, q] : [q, p];
      if (crCollide(m, n)) Q.hits++;
    }
  }
  // out of play: the side boards, wholly past the back line
  for (const st of L) if (!crOnSheet(st)) { st.out = true; st.vx = st.vy = 0; Q.out.push(st.id); }
  Q.t += dts;
  if (!O.plan && Q.t >= Q.nextTr) { Q.trace.push([+Q.t.toFixed(2), crRunNow(Q)]); Q.nextTr += CR_STONE.traceEvery; }
  return true;
}
// where every stone in play is now: [[id, x, y]]
const crRunNow = Q => Q.S.filter(st => !st.out).map(st => [st.id, +st.x.toFixed(1), +st.y.toFixed(1)]);
function crRunTo(Q, t, sweep) { while (!Q.done && Q.t < t) crRunStep(Q, sweep); return !Q.done; }
function crRunEnd(Q) {
  if (Q.result) return Q.result;
  const { O, S, T, path } = Q;
  // (the last stretch: where it stopped, or left the sheet, ends the path)
  const P = path[path.length - 1]; if (!P || P[0] !== +T.x.toFixed(1) || P[1] !== +T.y.toFixed(1)) path.push([+T.x.toFixed(1), +T.y.toFixed(1), +(Q.swMax || 0).toFixed(2)]);
  // the thrown stone must pass the far hog line, unless it hit a stone in play
  if (!T.out && !crPastHog(T) && !Q.hits) { T.out = true; Q.out.push(T.id); }
  // (a smoke stone that came to rest inside the guard it slid through goes on just past it)
  // (clear of every stone, and still on the sheet, or it is out)
  const gh = T.ghostId && S.find(st => st.id === T.ghostId && !st.out);
  if (!T.out && gh) { const near = () => S.some(o => o !== T && !o.out && Math.hypot(T.x - o.x, T.y - o.y) < 2 * CR_SHEET.stoneR - 1e-6), y0 = T.y; let n = 0; while (near() && n++ < 200) T.y += 1; if (near() || !crOnSheet(T)) { T.out = true; Q.out.push(T.id); } else if (T.y !== y0) path.push([+T.x.toFixed(1), +T.y.toFixed(1), 0]); }
  if (!O.plan) Q.trace.push([+Q.t.toFixed(2), crRunNow(Q)]);
  // (a granite stone is heavy only once it is at rest: the thrown one takes it now)
  const rest = S.filter(st => !st.out).map(st => Object.assign({ id: st.id, s: st.s, x: +st.x.toFixed(2), y: +st.y.toFixed(2) }, st.g || st.gRest ? { g: 1 } : {}));
  Q.done = true;
  return (Q.result = { stones: rest, out: Q.out, path: Q.path, hits: Q.hits, t: +Q.t.toFixed(2), trace: Q.trace, stop: T.out ? null : { x: +T.x.toFixed(2), y: +T.y.toFixed(2) }, last: { x: +T.x.toFixed(2), y: +T.y.toFixed(2) } });
}
function crRun(stones, th, opts) { const Q = crRunInit(stones, th, opts); while (crRunStep(Q)); return crRunEnd(Q); }
// where a stone thrown alone comes to rest (no other stones): { x, y } or null (out), and its path; the CPU's aim
function crAlone(th, ice, cold, sweep) { const r = crRun([], th, { ice, cold, plan: true, sweep }); return { stop: r.stop, path: r.path, last: r.last, x: r.stop ? r.stop.x : null, y: r.stop ? r.stop.y : null }; }
