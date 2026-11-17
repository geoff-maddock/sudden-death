/* Mossgate Links: the shot model (issue #92, phase 1). Pure: the same inputs give the same ball, so Play, the CPU and
   the headless sim all hit through it. Nothing here draws a random number; the swing's errors come in from outside.
   A full shot (glFlight): the club's carry (GL_CLUBS) by the hitter's power and the lie (GL_LIES), times the swing's
   power (pow, 0 to 1.1; past 1 is a power shot). The accuracy error (err, a miss of 1 is 8 degrees times the club's
   and the lie's spread; plus is right of the aim) curves it off line: a hook or a slice, more the further it flies. The wind (mph, a direction)
   drifts it by the club's height and the carry; a headwind costs more than a tailwind gives. A punch (from the trees,
   forced) flies low and short. Then it lands: in the water (a drop and a stroke, glWaterDrop), plugged in sand or bog,
   on a root in the trees, or it rolls by the club, the lie it came from (rough gives no spin), the spin asked for, and
   the ground it runs over (GL_ROLLF). A ball that lands or runs onto the green finishes as a putt (glPutt), so it
   breaks with the slope and can drop.
   A putt (glPutt): the ball rolls from a speed and an angle; the green's friction slows it and its slope pulls it
   downhill. It drops if it passes over the cup slowly enough (faster than GL_PUTT.cap lips out, more easily off
   centre) and runs on otherwise. Off the green it slows quicker; sand stops it, the water takes it. */
const GL_CLUBS = {
  dr: { n: 'Driver', carry: 228, roll: 0.13, h: 0.75, spread: 1.0 },
  wd: { n: 'Wood', carry: 203, roll: 0.10, h: 0.8, spread: 0.9 },
  li: { n: 'Long iron', carry: 178, roll: 0.08, h: 0.85, spread: 0.8 },
  mi: { n: 'Mid iron', carry: 153, roll: 0.06, h: 0.95, spread: 0.7 },
  si: { n: 'Short iron', carry: 128, roll: 0.05, h: 1.05, spread: 0.6 },
  we: { n: 'Wedge', carry: 98, roll: 0.03, h: 1.2, spread: 0.5 },
  pt: { n: 'Putter', carry: 0, roll: 0, h: 0, spread: 0.3 },
};
const GL_BAG = ['dr', 'wd', 'li', 'mi', 'si', 'we', 'pt'];
// how each lie plays: carry, spread (the miss) and roll (rough and bog give no spin, so the ball runs), the clubs it
// won't take, and its rule: sand takes the wedge (anything else barely moves it), the trees allow only a punch
const GL_LIES = {
  T: { dist: 1, spread: 1, roll: 1, no: [] },
  F: { dist: 1, spread: 1, roll: 1, no: ['dr'] },
  G: { dist: 1, spread: 1, roll: 1, no: ['dr', 'wd', 'li'] },
  r: { dist: 0.88, spread: 1.25, roll: 1.35, no: ['dr'] },
  R: { dist: 0.68, spread: 1.6, roll: 1.4, no: ['dr', 'wd'] },
  S: { dist: 0.82, spread: 1.35, roll: 0.6, no: ['dr', 'wd'], sand: 0.3 },
  B: { dist: 0.55, spread: 1.6, roll: 0.5, no: ['dr', 'wd'] },
  O: { dist: 1, spread: 1.3, roll: 1, no: ['dr', 'wd'], punch: 65 },
  W: { dist: 0, spread: 1, roll: 0, no: GL_BAG.slice() },
};
// how far a ball runs over each ground (yards of roll a yard), 0: it stops in it
const GL_ROLLF = { T: 1, F: 1, G: 1, r: 0.32, R: 0.12, S: 0, B: 0, O: 0.15, W: 0 };
// the shot's shape and height (phase 2), asked for by hand: a draw runs out more, a fade stops sooner (bend: which way
// it swings in the air, + to the right first); a punch flies low under the wind and runs, a lob climbs, drifts and sits
const GL_SHAPES = { draw: { roll: 1.25, bend: 1, n: 'Draw' }, fade: { roll: 0.75, bend: -1, n: 'Fade' } };
const GL_TRAJ = { punch: { carry: 0.8, h: 0.3, wind: 0.35, roll: 1.6, n: 'Punch' }, lob: { carry: 0.85, h: 1.5, wind: 1.3, roll: 0.3, n: 'Lob' } };
const GL_PUTT = { fric: 0.62, fringe: 2.2, rough: 5, g: 7.6, cup: 0.06, cap: 1.7, dt: 0.02 };

// how a club plays from a lie for a hitter, before the wind: { carry, roll } at swing power pow
function glReach(club, lie, rat, pow) {
  const c = GL_CLUBS[club], L = GL_LIES[lie] || GL_LIES.F, p = rat && rat.pow != null ? rat.pow : 0.5, scr = rat && rat.scr != null ? rat.scr : 0.5;
  if (!c || club === 'pt') return { carry: 0, roll: 0 };
  // a bad lie costs less to a good scrambler (at 0.5, exactly the lie's own number)
  const distL = 1 - (1 - L.dist) * (1.3 - 0.6 * scr);
  let carry = c.carry * (0.85 + 0.3 * p) * distL * (L.sand && club !== 'we' ? L.sand : 1) * pow;
  if (L.punch) carry = Math.min(carry, L.punch);
  // a short shot runs more: a chip is mostly roll
  const rollK = (c.roll + Math.max(0, 0.55 - pow) * 1.1) * L.roll;
  return { carry, roll: carry * rollK };
}
const glClubOk = (club, lie) => !!GL_CLUBS[club] && !(GL_LIES[lie] || GL_LIES.F).no.includes(club);
// the clubs a lie allows (no putter), longest first as they go from there (out of sand the wedge is the longest)
function glClubsFrom(lie, rat) {
  const tot = c => { const r = glReach(c, lie, rat, 1); return r.carry + r.roll; };
  return GL_BAG.filter(c => c !== 'pt' && glClubOk(c, lie)).sort((a, b) => tot(b) - tot(a));
}
// the wind's push on a ball of club that carries carry yards, as [x, y] yards
function glWindPush(club, carry, wind, dir) {
  if (!wind || !wind.s) return [0, 0];
  const c = GL_CLUBS[club], k = c.h * (carry / 200) * 1.1, wx = Math.cos(wind.d) * wind.s, wy = Math.sin(wind.d) * wind.s;
  const al = wx * Math.cos(dir) + wy * Math.sin(dir), ax = -Math.sin(dir), ay = Math.cos(dir), cr = wx * ax + wy * ay;
  const alK = al < 0 ? 1.35 : 0.9;
  return [(Math.cos(dir) * al * alK + ax * cr) * k, (Math.sin(dir) * al * alK + ay * cr) * k];
}

/* a full shot. s: { hole, from: { x, y }, lie, club, aim: { x, y }, pow, err, wind: { s, d }, spin (-1 back to 1 top),
   rat: { pow, scr }, shape: 'draw' or 'fade', traj: 'punch' or 'lob' }. Returns { end, lie, water, drop, carry, roll,
   land, path: [{ x, y, z }] (the flight), run: [{ x, y }] (the roll after it), holed, lip } */
function glFlight(s) {
  const H = s.hole, from = s.from, lie = s.lie || 'F', club = glClubOk(s.club, lie) ? s.club : 'we', c = GL_CLUBS[club], L = GL_LIES[lie] || GL_LIES.F;
  const scr = s.rat && s.rat.scr != null ? s.rat.scr : 0.5, spreadL = 1 + (L.spread - 1) * (1.3 - 0.6 * scr);
  const R0 = glReach(club, lie, s.rat, clamp(s.pow, 0, 1.12));
  const T = L.punch ? GL_TRAJ.punch : GL_TRAJ[s.traj] || null, Sh = GL_SHAPES[s.shape] || null;
  const carry = R0.carry * (T && !L.punch ? T.carry : 1);
  const dir = Math.atan2(s.aim.y - from.y, s.aim.x - from.x);
  const off = -(s.err || 0) * 8 * c.spread * spreadL * Math.PI / 180;
  const h = T ? (L.punch ? T.h : c.h * T.h) : c.h, bend = Sh ? Sh.bend * carry * 0.05 : 0;
  const push = glWindPush(club, carry, s.wind, dir).map(v => v * (T ? T.wind : 1));
  // the curve: straight out along the aim, bending by off, then the wind's drift by the end
  const ex = from.x + Math.cos(dir + off) * carry + push[0], ey = from.y + Math.sin(dir + off) * carry + push[1];
  const path = [], apex = carry * 0.11 * h;
  for (let i = 0; i <= 12; i++) {
    const f = i / 12, al = f * carry * Math.cos(off), lat = f * f * carry * Math.sin(off);
    const b = bend * Math.sin(Math.PI * f);
    path.push({ x: from.x + Math.cos(dir) * al - Math.sin(dir) * lat + push[0] * f * f + Math.sin(dir) * b, y: from.y + Math.sin(dir) * al + Math.cos(dir) * lat + push[1] * f * f - Math.cos(dir) * b, z: 4 * apex * f * (1 - f) });
  }
  const land = { x: ex, y: ey }, ll = glLie(H, ex, ey), out = { club, run: [], carry: Math.round(hyp(ex - from.x, ey - from.y)), land, path, water: false, holed: false, lip: false };
  if (ll === 'W') return Object.assign(out, glWaterDrop(H, from, land), { water: true, roll: 0 });
  if (ll === 'S' || ll === 'B' || ll === 'O') return Object.assign(out, { end: land, lie: ll, roll: 0 });
  // the roll: the club and the spin, along the line it came in on
  const spin = clamp(s.spin || 0, -1, 1), rd = Math.atan2(ey - path[11].y, ex - path[11].x);
  let budget = R0.roll * (1 + 0.6 * spin) * (T ? T.roll : 1) * (Sh ? Sh.roll : 1), x = ex, y = ey, here = ll;
  const rdir = rd;
  for (let n = 0; n < 400 && budget > 0; n++) {
    if (here === 'G') {
      // on the green it rolls as a putt does, with whatever speed is left
      const v = Math.sqrt(2 * GL_PUTT.fric * budget);
      const P = glPutt({ hole: H, from: { x, y }, a: rdir, v });
      return Object.assign(out, { end: P.end, lie: P.lie, water: P.water, holed: P.holed, lip: P.lip, roll: Math.round(hyp(P.end.x - ex, P.end.y - ey)), run: [{ x: ex, y: ey }].concat(P.path, [P.end]) }, P.water ? glWaterDrop(H, from, P.end) : {});
    }
    const f = GL_ROLLF[here];
    if (!f) break;
    const nx = x + Math.cos(rdir), ny = y + Math.sin(rdir), nl = glLie(H, nx, ny);
    if (nl === 'W') return Object.assign(out, glWaterDrop(H, from, { x: nx, y: ny }), { water: true, roll: Math.round(hyp(nx - ex, ny - ey)), run: [{ x: ex, y: ey }, { x: nx, y: ny }] });
    budget -= 1 / f; x = nx; y = ny; here = nl;
  }
  return Object.assign(out, { end: { x, y }, lie: here, roll: Math.round(hyp(x - ex, y - ey)), run: [{ x: ex, y: ey }, { x, y }] });
}
// into the water: the drop is back on the line from where it was hit, at the last dry ground before where it went in
function glWaterDrop(H, from, wet) {
  const d = hyp(wet.x - from.x, wet.y - from.y), ux = (wet.x - from.x) / (d || 1), uy = (wet.y - from.y) / (d || 1);
  let t = d;
  while (t > 0 && glLie(H, from.x + ux * t, from.y + uy * t) === 'W') t -= 1;
  // three yards back from the edge, or the edge itself if that would be in more water (a ball by the green drops by
  // the green, even on it); only with no dry ground on the line at all does it go back where it was hit
  const t0 = t;
  t = Math.max(0, t - 3);
  let x = from.x + ux * t, y = from.y + uy * t, lie = glLie(H, x, y);
  if (lie === 'W') { x = from.x + ux * t0; y = from.y + uy * t0; lie = glLie(H, x, y); }
  if (lie === 'W') { x = from.x; y = from.y; lie = glLie(H, x, y); if (lie === 'T') lie = 'F'; }
  return { end: { x, y }, lie: lie === 'T' ? 'r' : lie, drop: true };
}

/* a putt (or the run of a ball on the green). p: { hole, from, a (angle), v (yards a second), slopeK (a read: 1 is
   the true slope), noCup }. Returns { end, lie, holed, lip, path, t, cross } (cross: how far left (+) or right of the cup
   it passed, on the line through the cup square to the putt; null if it never got there) */
function glPutt(p) {
  const H = p.hole, pin = H.pin, P = GL_PUTT, k = p.slopeK == null ? 1 : p.slopeK;
  let x = p.from.x, y = p.from.y, vx = Math.cos(p.a) * p.v, vy = Math.sin(p.a) * p.v, lie = glLie(H, x, y), lip = false;
  const path = [{ x, y }], D = hyp(pin.x - x, pin.y - y) || 1, ux = (pin.x - x) / D, uy = (pin.y - y) / D, x0 = x, y0 = y;
  let cross = null;
  const res = o => Object.assign(o, { cross });
  for (let i = 0, t = 0; i < 3000; i++, t += P.dt) {
    const sp = hyp(vx, vy), fr = lie === 'G' ? P.fric : lie === 'F' || lie === 'T' ? P.fric * P.fringe : P.fric * P.rough;
    const sl = lie === 'G' ? glSlope(H, x, y) : [0, 0], gx = sl[0] * P.g * k, gy = sl[1] * P.g * k;
    if (sp < 0.03 && hyp(gx, gy) < fr) return res({ end: { x, y }, lie, holed: false, lip, path, t });
    const ax = gx - (sp ? vx / sp : 0) * fr, ay = gy - (sp ? vy / sp : 0) * fr;
    const nx = x + vx * P.dt, ny = y + vy * P.dt;
    if (cross == null) { const a0 = (x - x0) * ux + (y - y0) * uy, a1 = (nx - x0) * ux + (ny - y0) * uy; if (a0 < D && a1 >= D) { const f = (D - a0) / ((a1 - a0) || 1); cross = -((x + (nx - x) * f) - x0) * uy + ((y + (ny - y) * f) - y0) * ux; } }
    vx += ax * P.dt; vy += ay * P.dt;
    // turned back by the slope: it stops rather than sliding the other way past zero
    if (vx * (vx - ax * P.dt) + vy * (vy - ay * P.dt) < 0 && hyp(gx, gy) < fr) { vx = vy = 0; }
    if (!p.noCup) {
      // over the cup? the nearest point of this step to the pin
      const dx = nx - x, dy = ny - y, L2 = dx * dx + dy * dy, u = clamp(((pin.x - x) * dx + (pin.y - y) * dy) / (L2 || 1), 0, 1);
      const off = hyp(x + dx * u - pin.x, y + dy * u - pin.y);
      if (off < P.cup) {
        if (sp <= P.cap * Math.sqrt(1 - (off / P.cup) ** 2)) return res({ end: { x: pin.x, y: pin.y }, lie: 'G', holed: true, lip, path: path.concat([{ x: pin.x, y: pin.y }]), t });
        if (!lip) { lip = true; const turn = (off / P.cup - 0.5) * 0.6; const c = Math.cos(turn), s = Math.sin(turn); [vx, vy] = [(vx * c - vy * s) * 0.7, (vx * s + vy * c) * 0.7]; }
      }
    }
    x = nx; y = ny;
    const nl = glLie(H, x, y);
    if (nl === 'W') return res({ end: { x, y }, lie: 'W', water: true, holed: false, lip, path, t });
    if (nl === 'S' || nl === 'B' || nl === 'O') return res({ end: { x, y }, lie: nl, holed: false, lip, path, t });
    lie = nl;
    if (i % 5 === 0) path.push({ x, y });
  }
  return res({ end: { x, y }, lie, holed: false, lip, path, t: 60 });
}
