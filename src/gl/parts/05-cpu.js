/* Mossgate Links: the CPU's caddie (issue #92, phase 1). For a side to play: who hits (glPickHitter), and the shot
   (glPlan). It aims through the same pure model the ball flies by (04-shot.js), so it can only know what a player could.
   - The hitter: by the shot. The tee shot goes to the most powerful player who may hit, an approach to the most
     accurate, a chip (45 yards or less, off the green) to the best touch, a putt to the best putter.
   - A full shot: the shortest club that gets to the pin from the lie. Out of reach, the longest, down the hole's line
     as far as it goes; a Knight or an Archmage picks a spot on the fairway clear of the water, the sand and the bog.
     A Squire takes the driver off every tee it can and doesn't read the wind; the others aim off for it and club up or
     down. The swing's power is found for the distance (carry and roll) by glReach.
   - A putt (or from the fringe close by): glRead aims and weighs it by rolling it in its head on the green as it reads
     it (the slope times a read error, smaller for a better putter and a better caddie), to pass over the cup and finish just past it.
   - The concede (glCpuConcede): a short putt for the other side, by skill. A Squire always gives it; an Archmage makes
     you putt more often. Never when the putt would decide the hole against it (it has holed out already).
   The swing's errors (glHit, 06-game.js) are the hitter's and the skill's (GL_SKILL.err), drawn from R, so a seeded
   game plays the same. */
const GL_SKILL = { names: ['Squire', 'Knight', 'Archmage'], err: [1.25, 1, 0.85], read: [0.5, 0.25, 0.12], wind: [0, 0.85, 1], give: [1, 0.75, 0.6], giveIn: 0.6 };
const GL_DEF_RAT = { pow: 0.5, acc: 0.5, tch: 0.5, put: 0.5, nrv: 0.5, scr: 0.5 };

const glRat = (side, ri) => (G.teams[side].roster[ri] || {}).r || GL_DEF_RAT;
const glDistOf = (H, s) => hyp(G.ball[s].x - H.pin.x, G.ball[s].y - H.pin.y);
// what kind of shot a side faces: tee, approach, short (a chip) or putt
function glShotKind(H, s) {
  const b = G.ball[s], d = glDistOf(H, s);
  if (b.lie === 'G' || (b.lie === 'F' && d < 16 && glPuttable(H, b))) return 'putt';
  if (b.lie === 'T') return 'tee';
  return d <= 45 ? 'short' : 'approach';
}
// a putt from off the green only when the way to the cup is short grass
function glPuttable(H, b) {
  const d = hyp(H.pin.x - b.x, H.pin.y - b.y), n = Math.ceil(d);
  for (let i = 1; i < n; i++) { const l = glLie(H, b.x + (H.pin.x - b.x) * i / n, b.y + (H.pin.y - b.y) * i / n); if (l !== 'G' && l !== 'F') return false; }
  return true;
}
const GL_ROLE_KEY = { tee: 'pow', approach: 'acc', short: 'tch', putt: 'put' };
function glPickHitter(side, kind) {
  const can = glHitters(side), k = GL_ROLE_KEY[kind] || 'acc';
  let best = can[0], bv = -1;
  for (const ri of can) { const v = glRat(side, ri)[k]; if (v > bv + 1e-9) { bv = v; best = ri; } }
  return best;
}

// the power that sends club from lie dist yards (carry and roll together), or the carry alone; capped at full
function glPowFor(club, lie, rat, dist, carryOnly) {
  let lo = 0.03, hi = 1;
  const f = p => { const r = glReach(club, lie, rat, p); return carryOnly ? r.carry : r.carry + r.roll; };
  if (f(hi) <= dist) return hi;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (f(m) < dist) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// out of reach: the spot down the hole's line, at most reach yards away, to play to
function glLayTarget(H, b, reach, careful) {
  let best = null, bestF = null;
  for (const p of H.line) {
    const d = hyp(p.x - b.x, p.y - b.y);
    if (d > reach || p.y < b.y - 5) continue;
    const l = glLie(H, p.x, p.y);
    if (careful && (l === 'W' || l === 'S' || l === 'B' || l === 'O')) continue;
    if (!best || p.t > best.t) best = p;
    if (l === 'F' && (!bestF || p.t > bestF.t)) bestF = p;
  }
  // a careful caddie prefers the fairway unless it gives away more than 25 yards
  if (careful && bestF && best && best.t - bestF.t < 25) best = bestF;
  if (best) return { x: best.x, y: best.y };
  const a = Math.atan2(H.pin.y - b.y, H.pin.x - b.x);
  return { x: b.x + Math.cos(a) * reach, y: b.y + Math.sin(a) * reach };
}

// the shot for side s, hit by ri: { ri, kind, club, aim, pow, spin } or a putt { ri, kind, putt: true, a, v }
function glPlan(s, riIn) {
  const H = glHoleNow(), b = G.ball[s], sk = G.skill[s], kind = glShotKind(H, s), ri = riIn == null ? glPickHitter(s, kind) : riIn, rat = glRat(s, ri);
  if (kind === 'putt') {
    const readK = 1 + gauss() * GL_SKILL.read[sk] * (1.4 - rat.put);
    return Object.assign({ ri, kind, club: 'pt', putt: true }, glRead(H, b, readK));
  }
  const clubs = glClubsFrom(b.lie, rat), tot = c => { const r = glReach(c, b.lie, rat, 1); return r.carry + r.roll; };
  const d = glDistOf(H, s), longest = clubs[0];
  let club, target;
  if (sk === 0 && b.lie === 'T' && glClubOk('dr', 'T') && d > tot('dr') * 0.6) { club = 'dr'; target = d > tot('dr') ? glLayTarget(H, b, tot('dr'), false) : H.pin; }
  else if (d > tot(longest) * 0.98) { club = longest; target = glLayTarget(H, b, tot(longest), sk > 0); }
  else { club = clubs.slice().reverse().find(c => tot(c) >= d) || longest; target = H.pin; }
  // the landing spot: short of the target by the roll; then aim off for the wind
  const dir0 = Math.atan2(target.y - b.y, target.x - b.x), dist = hyp(target.x - b.x, target.y - b.y);
  let pow = glPowFor(club, b.lie, rat, dist), R1 = glReach(club, b.lie, rat, pow);
  let land = { x: target.x - Math.cos(dir0) * R1.roll, y: target.y - Math.sin(dir0) * R1.roll }, aim = land;
  const wk = GL_SKILL.wind[sk];
  if (wk && G.wind && G.wind.s) {
    for (let i = 0; i < 3; i++) {
      const dir = Math.atan2(aim.y - b.y, aim.x - b.x), carry = hyp(aim.x - b.x, aim.y - b.y), push = glWindPush(club, carry, G.wind, dir);
      aim = { x: land.x - push[0] * wk, y: land.y - push[1] * wk };
    }
    const need = hyp(aim.x - b.x, aim.y - b.y);
    // club up into the wind if the club can't carry it
    if (glReach(club, b.lie, rat, 1).carry < need) { const up = clubs.slice().reverse().find(c => glReach(c, b.lie, rat, 1).carry >= need); if (up) club = up; }
    pow = glPowFor(club, b.lie, rat, need, true);
  } else pow = glPowFor(club, b.lie, rat, hyp(land.x - b.x, land.y - b.y), true);
  return { ri, kind, club, aim: { x: aim.x, y: aim.y }, pow, spin: 0 };
}

// read a putt: the angle and speed that finish it just past the cup, on the green as read (slopeK)
function glRead(H, from, slopeK) {
  const pin = H.pin, d = hyp(pin.x - from.x, pin.y - from.y), ux = (pin.x - from.x) / (d || 1), uy = (pin.y - from.y) / (d || 1);
  const want = d + 0.35;
  let a = Math.atan2(uy, ux), v = Math.sqrt(2 * GL_PUTT.fric * want) * (glLie(H, from.x, from.y) === 'G' ? 1 : 1.3);
  for (let i = 0; i < 10; i++) {
    const P = glPutt({ hole: H, from, a, v, slopeK, noCup: true });
    const ex = P.end.x - from.x, ey = P.end.y - from.y, al = ex * ux + ey * uy, lat = P.cross != null ? P.cross : -ex * uy + ey * ux;
    a -= Math.atan2(lat, Math.max(0.5, d)) * 0.9;
    v *= Math.sqrt(want / Math.max(0.15, al));
    v = clamp(v, 0.2, 30);
  }
  return { a, v };
}

// does side by (the CPU) give side s its next putt, d yards long?
function glCpuConcede(by, s, d) {
  const H = G.hole;
  if (d > GL_SKILL.giveIn || H.done[by] || H.done[s]) return false;
  return R() < GL_SKILL.give[G.skill[by]];
}
