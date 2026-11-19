/* The Saltmere Lanes: the pins (issue #100, phase 1). A pure, seeded 2D model of the ball and the pins on the deck,
   shared by Play, the CPU and the sim.

   The ball arrives at the pins where the lane model left it (its x, its line, its speed and the side spin it still
   has) and the standing pins are circles on their spots. Time steps a millisecond at a time:
   - bodies that touch trade momentum (a 15-pound ball against 3.5-pound pins, so the ball deflects a little at each
     pin it meets, and the less its entry angle the more it is pushed off line);
   - a standing pin hit hard enough is knocked: it slides and tumbles, and while it tumbles it sweeps a wider circle
     than a standing one (a falling pin is fifteen inches long), so it takes out its neighbours, the messengers;
   - a knocked pin falls over the way it is going, and its fifteen inches land on any pin standing there, which falls
     on in turn (the domino that carries a 4 into the 7);
   - a pin hit too softly only wobbles and stays up;
   - the kickbacks (the side walls of the deck) throw sliding pins back across it, and the pit swallows whatever goes
     off the back;
   - the ball keeps hooking on the dry deck by the spin it has left, which is what drives through the pocket.
   A pin's knock has a little seeded scatter in its direction (pins spin and bounce in three dimensions, which this
   model doesn't), so the same throw can carry or leave a pin; with the same seed, it always does the same.
   It gives the pins that fell, and a trace of every body for the page to draw. */
const BL_PIN = { dt: .001, steps: 1600, mBall: 15, mPin: 3.5, eBall: .6, ePin: .55, eKick: .45, knock: 15, fallR: 3, fallT: .04,
  slide: 260, ballDeck: 60, scatter: .12, still: 6, traceEvery: 10, len: 15, reach: 5, pass: .4 };

// a seeded stream of its own (so the pins never touch the engine's R)
function blPinRng(seed) { return engRng((seed >>> 0) ^ 0x5bd1e995); }
/* run the deck: standing (pin numbers), the ball at the pins { x, m, v, spin, hand }, a seed, and spots (a pin's spot
   if it isn't on its own: Moll's rack can be off, phase 5). Returns { down: [pins], trace: [[t, ball [x, y], pins
   { n: [x, y, up] }]], ball: [x, y] where it left } */
function blDeck(standing, ball, seed, spots) {
  const L = BL_LANE, P = BL_PIN, rnd = blPinRng(seed), h = ball.hand === -1 ? -1 : 1;
  const ang = Math.atan(ball.m), y0 = L.len - 30;
  const B = { x: ball.x - ball.m * 30, y: y0, vx: ball.v * Math.sin(ang), vy: ball.v * Math.cos(ang), r: L.ballR, m: P.mBall, live: true };
  const pins = standing.map(n => { const sp = (spots && spots[n]) || BL_SPOT[n];
    return { n, x: sp[0], y: sp[1], vx: 0, vy: 0, r: L.pinR, m: P.mPin, up: true, hit: false, t: 0, gone: false }; });
  const trace = [];
  const snap = t => trace.push([+t.toFixed(3), [+B.x.toFixed(1), +B.y.toFixed(1)], pins.map(p => [p.n, +p.x.toFixed(1), +p.y.toFixed(1), p.hit ? 0 : 1, p.gone ? 1 : 0])]);
  const hitSpin = (ball.spin || 0) + .25;
  for (let k = 0; k < P.steps; k++) {
    const t = k * P.dt;
    // the ball: its remaining spin hooks it on the dry deck, toward its pocket side
    if (B.live) { B.vx += h * P.ballDeck * hitSpin * P.dt; B.x += B.vx * P.dt; B.y += B.vy * P.dt; if (B.y > L.pit + 10 || Math.abs(B.x) > L.kick) B.live = false; }
    // the pins: a knocked pin slides (and slows), tumbles wider for a moment, and goes into the pit off the back
    for (const p of pins) {
      if (p.gone || !p.hit) continue;
      p.t += P.dt; if (p.t > P.fallT) p.r = P.fallR;
      // the pin falls over the way it is going, and its length lands on whatever stands there (the domino)
      if (p.t > P.fallT && !p.fell) { p.fell = true; const sp = Math.hypot(p.vx, p.vy);
        if (sp > P.knock) { const ux = p.vx / sp, uy = p.vy / sp;
          for (const q of pins) { if (q === p || q.gone || q.hit) continue; const dx = q.x - p.x, dy = q.y - p.y, along = dx * ux + dy * uy, perp = Math.abs(dx * uy - dy * ux);
            if (along > 0 && along < P.len && perp < P.reach) { q.hit = true; q.vx = ux * sp * P.pass; q.vy = uy * sp * P.pass; } } } }
      const s = Math.hypot(p.vx, p.vy); if (s > 0) { const ns = Math.max(0, s - P.slide * P.dt); p.vx *= ns / s; p.vy *= ns / s; }
      p.x += p.vx * P.dt; p.y += p.vy * P.dt;
      if (Math.abs(p.x) > L.kick - p.r && p.y > L.len - 12) { p.x = Math.sign(p.x) * (L.kick - p.r); p.vx = -p.vx * P.eKick; }
      if (p.y > L.pit) p.gone = true;
      if (p.y < L.len - 40 || Math.abs(p.x) > L.kick + 2) p.gone = true;
    }
    // contacts: the ball with each pin, and each pin with each other
    const bodies = B.live ? [B, ...pins.filter(p => !p.gone)] : pins.filter(p => !p.gone);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = a.r + b.r;
      if (d >= rr || d === 0) continue;
      const aStill = a.up && !a.hit, bStill = b.up && !b.hit;
      if (aStill && bStill) continue;
      let nx = dx / d, ny = dy / d;
      const rot = (rnd() - .5) * 2 * P.scatter, c = Math.cos(rot), s = Math.sin(rot);
      [nx, ny] = [nx * c - ny * s, nx * s + ny * c];
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      // push them apart either way, so nothing sits inside another
      const over = (rr - d) / 2; if (a !== B && !aStill) { a.x -= nx * over; a.y -= ny * over; } if (b !== B && !bStill) { b.x += nx * over; b.y += ny * over; }
      if (rv >= 0) continue;
      const e = a === B || b === B ? P.eBall : P.ePin, J = -(1 + e) * rv / (1 / a.m + 1 / b.m);
      const kick = (q, sgn) => {
        const dv = J / q.m;
        if (q.up && !q.hit) { if (dv < P.knock) return; q.hit = true; }
        q.vx += sgn * nx * dv; q.vy += sgn * ny * dv;
      };
      kick(a, -1); kick(b, 1);
    }
    if (k % P.traceEvery === 0) snap(t);
    if (!B.live && k > 200 && pins.every(p => p.gone || !p.hit || Math.hypot(p.vx, p.vy) < P.still)) { snap(t); break; }
  }
  return { down: pins.filter(p => p.hit).map(p => p.n).sort((a, b) => a - b), trace, ball: [+B.x.toFixed(1), +B.y.toFixed(1)] };
}
