/* Black Ice: the live play (issue #83, phase 1). Twelve players on the ice on a fixed step (HK_DT), the puck on a
   stick or loose. The ratings settle what happens when players meet.
   - Skating. Nobody stops on ice: a player pushes toward where they want to go at a limited rate (hkSkate), so they
     build speed, turn in arcs and glide past what they miss. Braking is quicker than pushing off, but not instant.
   - The puck is on a stick (held) or free: sliding, slowing a little, and coming off the boards (hkBound) and the back
     of the nets. A free puck is a pass, a shot, a dump or just loose; whoever reaches a loose one first has it, and
     two who reach it together fight for it on hands and size.
   - A pass slides to where the receiver is going. An opponent it passes close to may pick it off (defense).
   - A shot (wrist, slap or one-timer) is settled at the release (hkShotOdds): it may be blocked by a skater in its
     lane, miss the net, be saved or go in. The save is the goalie's reflexes against the shot, the distance and the
     angle, and above all whether the goalie is set: they follow the puck a moment late (hkGoalie), so a pass across
     the front of the net and a quick shot finds them out of place. A body in front of them (a screen) hides it.
     A save is held or comes loose in front (a rebound).
   - Without the puck: the skater nearest the carrier goes at them, and up close pokes at the puck (defense against
     hands) or, closing fast, throws a body check (size and speed): the carrier is knocked off it.
   - Fouls: a poke that misses up close can trip, a beaten checker reaching back can hook, a hit from behind into
     the boards is boarding and a hit now and then is roughing (HK_FOUL; 07-game.js gives the penalty).
   - Icing: a pass or a dump from a side's own half that crosses the far goal line untouched (07-game.js whistles it).
   - Each side keeps a shape around the puck (hkForm): in the other end the wings low, the centre in the slot and the
     defenders at the points; in its own end the defenders low, the centre in front and the wings out high.
   Rink metres: x along the ice from the left end boards (0 to 40), y across from the middle (-10 to 10). The goal
   lines are HK_RULES.goal in from each end, and the corners are round.
   L is the play, plain JSON (players by index, no references): { pl, puck, t, ev, think, carry, wind, touch, eye, me,
   lunge }.
   A player with off set is not on the ice (the box, or the extra skaters in sudden death). */
const HK_DT = 1 / 30, HK_BODY = .7, HK_REACH = .85;
// how often a check is a foul: a missed poke up close, a reach from behind, a hit from behind into the boards, any hit;
// and by hand, a lunge that lands on a player who doesn't have the puck
const HK_FOUL = { trip: .035, hook: .04, board: .3, rough: .02, interfere: .6 };
const HK_V = { pass: 15, wrist: 24, slap: 32, one: 28, dump: 20 };
let L = null;

// a point for side from [metres up the ice from its own end, across (left wing negative)], to rink metres
function hkAt(side, u, v) { const d = hkDir(side); return [d > 0 ? u : HK_RULES.len - u, v * d]; }
function hkEv(k, s, o) { const e = { k, s: s || '', o: o == null ? '' : o, t: Math.round(L.t * 100) / 100 }; L.ev.push(e); L.evN = (L.evN || 0) + 1; if (L.ev.length > 60) L.ev.shift(); hkSayEv(e); }

function hkNewPlay() {
  const pl = [];
  for (const side of [0, 1]) {
    const T = G.teams[side];
    for (const pos of HK_POS) {
      const ri = G.on[side][HK_POS.indexOf(pos)], m = T.roster[ri];
      pl.push({ side, ri, pos, kind: m.kind, n: m.n, num: m.num, r: Object.assign({}, m.r), x: 20, y: 0, vx: 0, vy: 0, fx: hkDir(side), fy: 0, stun: 0, cd: 0, run: 0, act: '', actT: 0, off: false });
    }
  }
  L = { pl, puck: { st: 'free', h: -1, x: 20, y: 0, vx: 0, vy: 0, k: 'loose', from: -1, to: -1, ice: -1, shot: null, tried: [], go: 0 },
    t: 0, ev: [], think: .3, carry: null, wind: null, touch: [], got: 0, oneT: null, eye: [[20, 0], [20, 0]] };
  return L;
}
const hkHand = () => L.puck.st === 'held' ? L.puck.h : -1;
const hkGk = side => side * HK_POS.length + HK_POS.indexOf('G');
// side's skaters on the ice: not the goalie, unless they have been pulled and skate as the extra one
const hkSk = side => L.pl.filter(p => p.side === side && !p.off && (p.pos !== 'G' || p.pulled));
// is side's goalie in its net: on the ice, and not pulled for an extra skater
const hkInNet = side => { const g = L.pl[hkGk(side)]; return !g.off && !g.pulled; };
// a goalie in their net (not one skating as the extra skater)
const hkIsGk = p => p.pos === 'G' && !p.pulled;
function hkNearest(x, y, list) { let b = null, bd = 1e9; for (const p of list) { const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return [b, bd]; }

/* ---------- the boards and the nets ---------- */
// keep o ({ x, y, vx, vy }) inside the boards, m metres off them; e is the bounce (0: it just stops going that way).
// Returns true when it touched them.
function hkBound(o, m, e) {
  const Lx = HK_RULES.len, hw = HK_RULES.wid / 2, c = HK_RULES.corner;
  const cx = o.x < c ? c : o.x > Lx - c ? Lx - c : null, cy = o.y < -hw + c ? -hw + c : o.y > hw - c ? hw - c : null;
  if (cx != null && cy != null) {
    const dx = o.x - cx, dy = o.y - cy, d = hyp(dx, dy), r = c - m;
    if (d <= r) return false;
    const nx = dx / d, ny = dy / d, vn = o.vx * nx + o.vy * ny;
    o.x = cx + nx * r; o.y = cy + ny * r;
    if (vn > 0) { o.vx -= (1 + e) * vn * nx; o.vy -= (1 + e) * vn * ny; }
    return true;
  }
  let hit = false;
  if (o.x < m) { o.x = m; if (o.vx < 0) o.vx = -o.vx * e; hit = true; } else if (o.x > Lx - m) { o.x = Lx - m; if (o.vx > 0) o.vx = -o.vx * e; hit = true; }
  if (o.y < -hw + m) { o.y = -hw + m; if (o.vy < 0) o.vy = -o.vy * e; hit = true; } else if (o.y > hw - m) { o.y = hw - m; if (o.vy > 0) o.vy = -o.vy * e; hit = true; }
  return hit;
}
// the two nets as boxes: [x0, x1, y0, y1], from the goal line back
const hkNets = () => [[HK_RULES.goal - HK_RULES.deep, HK_RULES.goal], [HK_RULES.len - HK_RULES.goal, HK_RULES.len - HK_RULES.goal + HK_RULES.deep]].map(([a, b]) => [a, b, -HK_RULES.net, HK_RULES.net]);
// push o out of a net (m: its own radius), with bounce e. Returns true when it was in one.
function hkNetOut(o, m, e) {
  for (const [x0, x1, y0, y1] of hkNets()) {
    if (o.x <= x0 - m || o.x >= x1 + m || o.y <= y0 - m || o.y >= y1 + m) continue;
    const pen = [[o.x - (x0 - m), -1, 0], [(x1 + m) - o.x, 1, 0], [o.y - (y0 - m), 0, -1], [(y1 + m) - o.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    o.x += pen[1] * pen[0]; o.y += pen[2] * pen[0];
    const vn = o.vx * pen[1] + o.vy * pen[2]; if (vn < 0) { o.vx -= (1 + e) * vn * pen[1]; o.vy -= (1 + e) * vn * pen[2]; }
    return true;
  }
  return false;
}

/* ---------- skating ---------- */
const hkTop = (p, i) => (5.4 + p.r.spd * .42) * hkStaK(p) * (i === hkHand() ? .93 : 1) * (p.stun > 0 ? .3 : 1) * (HKI.lift && i >= 0 && hkYoursNow(i) ? .85 : 1);
function hkSkate(p, i, tx, ty, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy), sp = Math.min(hkTop(p, i), d / .4);
  const wx = d > .05 ? dx / d * sp : 0, wy = d > .05 ? dy / d * sp : 0;
  let ax = wx - p.vx, ay = wy - p.vy;
  const need = hyp(ax, ay), braking = ax * p.vx + ay * p.vy < 0, mx = (4.5 + p.r.spd * .5) * hkStaK(p) * (braking ? 1.5 : 1) * (p.stun > 0 ? .4 : 1) * dt;
  if (need > mx) { ax *= mx / need; ay *= mx / need; }
  p.vx += ax; p.vy += ay;
  hkGlide(p, dt);
}
// carry on as they are going (a wind-up, a stun with nowhere to go)
function hkGlide(p, dt) {
  p.x += p.vx * dt; p.y += p.vy * dt;
  hkBound(p, .45, 0); hkNetOut(p, .4, 0);
  const v = hyp(p.vx, p.vy); if (v > .6) { p.fx = p.vx / v; p.fy = p.vy / v; }
  p.run += v * dt * 1.6;
}
function hkSeparate() {
  const pl = L.pl;
  for (let a = 0; a < pl.length; a++) for (let b = a + 1; b < pl.length; b++) {
    const A = pl[a], B = pl[b]; if (A.off || B.off) continue;
    const dx = B.x - A.x, dy = B.y - A.y, d = hyp(dx, dy);
    if (d < HK_BODY && d > .001) { const k = (HK_BODY - d) / 2 / d; A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k; }
  }
}
/* the goalie: in front of the net on the line from its middle to the puck, but following the puck a moment late (the
   eye), and only so fast across. How well set they are for a shot from (x, y) is hkSet. */
function hkGoalSpot(side, px, py) {
  const gx = hkGoalX(1 - side), out = gx < HK_RULES.len / 2 ? 1 : -1, dx = px - gx, dy = py, d = hyp(dx, dy) || 1;
  // (a puck behind the goal line: hug that post)
  if (dx * out < .3) return [gx + out * .3, clamp(py, -HK_RULES.net + .2, HK_RULES.net - .2)];
  return [gx + dx / d * 1.1, clamp(dy / d * 1.1, -HK_RULES.net, HK_RULES.net)];
}
function hkGoalie(g, dt) {
  const P = L.puck, E = L.eye[g.side], lag = .34 - g.r.ref * .017;
  E[0] += (P.x - E[0]) * Math.min(1, dt / lag); E[1] += (P.y - E[1]) * Math.min(1, dt / lag);
  const hand = hkGoalieHand(g), [tx, ty] = hand || hkGoalSpot(g.side, E[0], E[1]), dx = tx - g.x, dy = ty - g.y, d = hyp(dx, dy);
  // (a goalie a long way from the net, coming back from being the extra skater, skates there)
  const sp = d > 3 ? hkTop(g, -1) : (1.7 + g.r.ref * .16) * (g.stun > 0 ? .3 : 1), st = Math.min(d, sp * dt);
  if (d > 1e-4) { g.vx = dx / d * st / dt; g.vy = dy / d * st / dt; g.x += dx / d * st; g.y += dy / d * st; } else g.vx = g.vy = 0;
  g.fx = Math.sign(HK_RULES.len / 2 - g.x) || 1; g.fy = 0;
}
// 1 when the goalie is where they should be for a shot from (x, y), down to 0 when they are a stride and more out of place
function hkSet(g, x, y) { const [tx, ty] = hkGoalSpot(g.side, x, y); return clamp(1 - hyp(tx - g.x, ty - g.y) / .9, 0, 1); }

/* ---------- one step ---------- */
function hkStep(dt) {
  L.t += dt;
  for (const p of L.pl) { if (p.stun > 0) p.stun -= dt; if (p.cd > 0) p.cd -= dt; if (p.actT > 0 && (p.actT -= dt) <= 0) p.act = ''; }
  const h = hkHand();
  if (L.wind) { L.wind.t -= dt; if (h !== L.wind.i) L.wind = null; else if (L.wind.t <= 0) { const w = L.wind; L.wind = null; hkRelease(w.i, w.kind); } }
  // (the CPU keeps its hands off a skater you are playing)
  else if (h >= 0 && !hkYoursNow(h)) { L.think -= dt; if (L.think <= 0) { L.think = .2 + R() * .2; hkThink(h); } }
  hkMeterStep(dt); hkLunge(dt);
  if (GD.ph === 'live') { hkStaStep(dt); hkCoach(dt); hkChangeStep(); }
  hkChase();
  L.pl.forEach((p, i) => {
    if (p.off) return;
    if (hkIsGk(p)) return hkGoalie(p, dt);
    if (p.act === 'wind' || p.act === 'down') { p.vx *= 1 - Math.min(1, dt * (p.act === 'down' ? 3 : .6)); p.vy *= 1 - Math.min(1, dt * (p.act === 'down' ? 3 : .6)); return hkGlide(p, dt); }
    if (hkYoursNow(i)) { const st = p.act === 'hit' ? null : hkSteerAim(p); if (st) return hkSkate(p, i, st[0], st[1], dt); p.vx *= 1 - Math.min(1, dt * .25); p.vy *= 1 - Math.min(1, dt * .25); return hkGlide(p, dt); }
    const tg = hkAim(p, i); hkSkate(p, i, tg[0], tg[1], dt);
  });
  hkSeparate();
  hkChecks();
  hkPuck(dt);
}

/* ---------- where each skater is going ---------- */
// who goes for a puck that nobody has: each side's skater who can get to it soonest (L.chase: [i, j])
function hkChase() {
  const P = L.puck; L.chase = [-1, -1];
  if (P.st === 'held' || P.k === 'shot') return;
  for (const s of [0, 1]) {
    if (P.k === 'pass' && P.to >= 0 && L.pl[P.to].side === s) { L.chase[s] = P.to; continue; }
    let b = -1, bt = 1e9;
    for (const p of hkSk(s)) { if (p.stun > 0 || p.chg) continue; const t = hkMeet(p)[2] - (L.chase0 && L.chase0[s] === L.pl.indexOf(p) ? .25 : 0); if (t < bt) { bt = t; b = L.pl.indexOf(p); } }
    L.chase[s] = b;
  }
  L.chase0 = L.chase.slice();
}
function hkAim(p, i) {
  const P = L.puck, h = hkHand();
  if (i === h) return L.carry || [hkGoalX(p.side), 0];
  // (on their way off for a change: to the bench door)
  if (p.chg) return hkDoor(p.side);
  if (h < 0) {
    if (L.chase[p.side] === i) { const m = hkMeet(p); return [m[0], m[1]]; }
    return hkForm(p);
  }
  const c = L.pl[h];
  // without the puck: the nearest skater goes at the carrier (not at a goalie holding it)
  // (a side a skater short sits back in its box: it goes at the carrier only down low in its own end)
  if (c.side !== p.side && !hkIsGk(c) && (!hkShort(p.side) || hkUp(p.side, c.x) < 10) && hkPresser(p.side) === i) return [c.x + c.vx * .22, c.y + c.vy * .22];
  return hkForm(p);
}
// the skater of side who presses the carrier: the nearest, with a lean to whoever was already doing it
function hkPresser(side) {
  const c = L.pl[hkHand()]; let b = -1, bd = 1e9;
  for (const p of hkSk(side)) { if (p.stun > 0 || p.chg) continue; const i = L.pl.indexOf(p), d = hyp(p.x - c.x, p.y - c.y) - (L.press === i ? 1.2 : 0); if (d < bd) { bd = d; b = i; } }
  L.press = b; return b;
}
// the shape: where p stands by spot, by which side has the puck and where it is
function hkForm(p) {
  const P = L.puck, s = p.side, Lz = HK_RULES.len, pu = hkUp(s, P.x), pv = P.y * hkDir(s), att = G.poss === s, i = L.pl.indexOf(p);
  const wing = p.pos === 'LW' ? -1 : p.pos === 'RW' ? 1 : 0, ds = p.pos === 'LD' ? -1 : 1, drift = Math.sin(L.t * .8 + i * 1.9);
  let u, v;
  // the extra skater (a pulled goalie): high in the slot with the puck, and straight back without it
  if (p.pos === 'G') return att ? hkAt(s, pu > Lz - HK_RULES.blue - 1 ? Lz - 11.5 + drift : clamp(pu - 2, 5, Lz - 12), clamp(-pv * .4, -3, 3)) : hkAt(s, clamp(pu - 7, 3, Lz - 8), pv * .3);
  // a skater short, a side doesn't send anybody ahead of the puck: it gets it out, and gets back
  if (att && hkShort(s)) return hkAt(s, clamp(pu - (p.pos === 'C' ? 1.5 : wing ? 3 : 7), 4, Lz - 14), wing ? wing * 5 : p.pos === 'C' ? pv * .4 : ds * 3);
  if (att) {
    if (pu > Lz - HK_RULES.blue - 1) {
      if (p.pos === 'C') { u = Lz - 8.5 + drift; v = clamp(-pv * .35, -3, 3) + drift * .9; }
      else if (wing) { const strong = wing * pv > 0; u = strong ? Lz - 5.5 + drift * .5 : Lz - 6 + drift * .7; v = strong ? wing * 6.5 : wing * 2.4; }
      else { u = Lz - HK_RULES.blue + 1.2; v = ds * 5 + pv * .2; }
    } else {
      if (p.pos === 'C') { u = pu + 3.5; v = pv * .4 + drift; } else if (wing) { u = pu + 7; v = wing * 7; } else { u = pu - 5; v = ds * 4 + pv * .2; }
      u = clamp(u, 5, Lz - 5);
    }
  } else if (pu < HK_RULES.blue + 2) {
    if (p.pos === 'C') { u = clamp(pu + 1.5, 5, 10); v = pv * .45; }
    else if (wing) { const box = hkShort(s); u = HK_RULES.blue - (box ? 5 : 2.5); v = wing * (box ? 3.2 : 5) + pv * .25; }
    else { const strong = Math.abs(pv) < 1 ? ds > 0 : ds * pv > 0; u = strong ? clamp(pu + .8, 3.8, 10) : 4.8; v = strong ? pv * .8 : ds * 1.1; }
  } else {
    if (p.pos === 'C') { u = pu - 3; v = pv * .5; } else if (wing) { u = pu - 1.5; v = wing * 6; } else { u = pu - 9; v = ds * 3.5 + pv * .15; }
    u = clamp(u, 6, Lz - 8);
  }
  return hkAt(s, u, clamp(v, -8.8, 8.8));
}

/* ---------- checks ---------- */
function hkChecks() {
  const h = hkHand(); if (h < 0) return;
  const c = L.pl[h]; if (hkIsGk(c)) return;
  for (const d of hkSk(1 - c.side)) {
    if (d.cd > 0 || d.stun > 0 || hkYoursNow(L.pl.indexOf(d))) continue;
    const dx = c.x - d.x, dy = c.y - d.y, dist = hyp(dx, dy); if (dist > 1.15) continue;
    d.cd = .8 + R() * .4;
    const closing = ((d.vx - c.vx) * dx + (d.vy - c.vy) * dy) / (dist || 1);
    // beaten, and reaching from behind: a hook
    if (closing < -.5 && R() < HK_FOUL.hook) return hkFoul(d, 'hooking', c);
    if (closing > 3.5 && R() < clamp(.4 + (d.r.siz - 5) * .06, .1, .85)) return hkHit(d, c, closing);
    return hkPoke(d, c);
  }
}
// a poke at the puck: defense against hands (edge: a little more, by hand). It comes loose, or straight onto the
// checker's stick. True when it worked
function hkPoke(d, c, edge) {
  d.act = 'poke'; d.actT = .25;
  if (R() >= clamp(.15 + (d.r.def - c.r.hnd) * .03 + (c.act === 'wind' ? .2 : 0) + (edge || 0), .04, .6)) {
    hkEv('pokemiss', d.n, c.n);
    // a miss up close can take their skates out: a trip
    if (hyp(c.x - d.x, c.y - d.y) < 1 && R() < HK_FOUL.trip) hkFoul(d, 'tripping', c);
    return false;
  }
  hkBoxAdd(d.side, d.ri, 'take'); hkBoxAdd(c.side, c.ri, 'give'); hkEv('poke', d.n, c.n);
  c.stun = .25;
  if (R() < .4) hkGain(L.pl.indexOf(d), 'take');
  else hkLoose(c.x, c.y, R() * Math.PI * 2, 2.5 + R() * 3.5, L.pl.indexOf(c));
  return true;
}
// a body check: size and how fast they close. The carrier is knocked off the puck, or the checker bounces off
function hkHit(d, c, closing) {
  d.act = 'hit'; d.actT = .3;
  // from behind into the boards is boarding; now and then a hit is just too much (roughing)
  const dv = hyp(d.vx, d.vy) || 1, behind = (d.vx * c.fx + d.vy * c.fy) / dv > .5, wall = Math.abs(c.y) > HK_RULES.wid / 2 - 2 || c.x < 2.5 || c.x > HK_RULES.len - 2.5;
  const foul = behind && wall ? (R() < HK_FOUL.board ? 'boarding' : '') : R() < HK_FOUL.rough ? 'roughing' : '';
  if (R() < clamp(.34 + (d.r.siz - c.r.siz) * .045 + (closing - 3) * .04, .08, .8)) {
    hkBoxAdd(d.side, d.ri, 'hit'); hkEv('hit', d.n, c.n);
    c.stun = .7; c.act = 'down'; c.actT = .55; c.vx = c.vx * .3 + d.vx * .4; c.vy = c.vy * .3 + d.vy * .4;
    hkLoose(c.x, c.y, Math.atan2(d.vy, d.vx) + (R() - .5) * 1.6, 3 + R() * 4);
  } else { d.stun = .4; hkEv('hitmiss', d.n, c.n); }
  if (foul) hkFoul(d, foul, c);
}

/* ---------- the puck ---------- */
// how fast a sliding puck slows, metres a second each second: a little always, more the faster it goes
const hkDrag = v => 1.4 + v * .32;
// where a free puck will be in t seconds (the boards aside): for whoever is skating to meet it
function hkPuckIn(t) {
  const P = L.puck; let v = hyp(P.vx, P.vy), d = 0; if (v < 1e-6) return [P.x, P.y];
  const ux = P.vx / v, uy = P.vy / v;
  for (let k = t; k > 0 && v > 0; k -= .1) { const h = Math.min(.1, k); d += v * h; v = Math.max(0, v - hkDrag(v) * h); }
  return [clamp(P.x + ux * d, .4, HK_RULES.len - .4), clamp(P.y + uy * d, -HK_RULES.wid / 2 + .4, HK_RULES.wid / 2 - .4)];
}
// where skater p should go to meet it: the first point on its way they can reach in time
function hkMeet(p) {
  for (let t = .1; t <= 3; t += .2) { const [x, y] = hkPuckIn(t); if (hyp(x - p.x, y - p.y) <= hkTop(p, -1) * t * .9) return [x, y, t]; }
  const [x, y] = hkPuckIn(3); return [x, y, 3];
}
// the puck comes loose from (x, y), going a (radians) at v metres a second (skip: who it came off, and can't take it
// straight back)
function hkLoose(x, y, a, v, skip) {
  Object.assign(L.puck, { st: 'free', h: -1, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, k: 'loose', to: -1, ice: -1, shot: null, tried: [], go: 0, skip: skip == null ? -1 : skip });
  L.wind = null; L.carry = null;
}
function hkPuck(dt) {
  const P = L.puck;
  if (P.st === 'held') { const p = L.pl[P.h]; P.x = p.x + p.fx * .55; P.y = p.y + p.fy * .55; P.vx = p.vx; P.vy = p.vy; return; }
  // (in steps of at most a third of a metre, so a fast one can't skip a line or a stick)
  const sp = hyp(P.vx, P.vy), n = Math.max(1, Math.ceil(sp * dt / .34)), h = dt / n;
  for (let k = 0; k < n; k++) {
    const x0 = P.x;
    P.x += P.vx * h; P.y += P.vy * h; P.go += hyp(P.vx, P.vy) * h;
    // (a shot is off the ice, and doesn't slow)
    const v = hyp(P.vx, P.vy), nv = P.k === 'shot' ? v : Math.max(0, v - hkDrag(v) * h);
    if (v > 1e-6) { P.vx *= nv / v; P.vy *= nv / v; }
    if (P.k === 'shot') {
      const S = P.shot;
      if (S.res === 'block' && P.go >= S.blockD) { hkShotBlocked(); return; }
      if (S.res !== 'block' && !S.done && (P.x - S.gx) * S.dir >= 0) { hkShotLands(); if (L.puck.st !== 'free' || L.puck.k !== 'loose') return; continue; }
    }
    // icing: sent from its own half, across the far goal line and nobody touched it (07-game.js stops play)
    if (P.ice >= 0 && (x0 - hkGoalX(P.ice)) * hkDir(P.ice) < 0 && (P.x - hkGoalX(P.ice)) * hkDir(P.ice) >= 0 && Math.abs(P.y) > HK_RULES.net) { if (hkIcing(P.ice)) return; }
    // (a shot on its way is settled at the goal line, above: the net is no wall to it)
    const bounced = hkBound(P, .12, .55), net = P.k !== 'shot' && hkNetOut(P, .1, .4);
    if ((bounced || net) && P.k === 'pass') { P.k = 'loose'; P.to = -1; }
    if (hkPickup()) return;
  }
}
// who, if anyone, takes a free puck this step
function hkPickup() {
  const P = L.puck; if (P.k === 'shot' || P.k === 'in') return false;
  const no = P.go < 1.5 ? P.skip : -1;
  const sp = hyp(P.vx, P.vy);
  // a goalie smothers anything that comes to them
  for (const s of [0, 1]) { const g = L.pl[hkGk(s)]; if (hkInNet(s) && hkGk(s) !== no && hyp(g.x - P.x, g.y - P.y) < 1 && sp < 16 && (P.k !== 'pass' || L.pl[P.from].side !== s || P.to === hkGk(s))) { hkEv('cover', g.n); hkGain(hkGk(s), 'cover'); return true; } }
  const near = [];
  for (let i = 0; i < L.pl.length; i++) { const p = L.pl[i]; if (p.off || hkIsGk(p) || p.stun > 0 || i === no) continue; const d = hyp(p.x - P.x, p.y - P.y), lift = HKI.lift && hkYoursNow(i); if (d < (i === P.to ? 1.05 : lift ? 1.3 : HK_REACH)) near.push([i, d]); }
  if (!near.length) return false;
  if (P.k === 'pass') {
    const from = L.pl[P.from];
    for (const [i] of near) {
      const p = L.pl[i];
      if (p.side === from.side) { if (i === P.from && P.go < 2) continue; if (i === P.to && P.go > 4) L.oneT = { i, t: L.t }; hkEv('catch', p.n, from.n); hkGain(i, 'pass'); hkHandOneTimer(i); return true; }
      if (P.tried.includes(i)) continue;
      P.tried.push(i);
      if (R() < clamp(.1 + p.r.def * .03 - (sp - 10) * .012 + (HKI.lift && hkYoursNow(i) ? .25 : 0), .05, .75)) { hkBoxAdd(p.side, p.ri, 'take'); hkBoxAdd(from.side, from.ri, 'give'); hkEv('pick', p.n, from.n); hkGain(i, 'take'); return true; }
    }
    return false;
  }
  // too fast to handle: it goes by (a dump ringing round the boards)
  if (sp > 15) return false;
  const sides = new Set(near.map(([i]) => L.pl[i].side));
  let win = near.sort((a, b) => a[1] - b[1])[0][0];
  if (sides.size > 1) { const w = {}; for (const [i, d] of near) { const p = L.pl[i]; w[i] = (p.r.hnd + p.r.siz * .5 + 3) * (1.3 - d); } win = +wpick(w); hkEv('battle', L.pl[win].n); }
  hkGain(win, 'loose'); return true;
}
// player i has the puck. A change of sides starts a new line of passes (for the assists)
function hkGain(i, how) {
  const p = L.pl[i], P = L.puck;
  Object.assign(P, { st: 'held', h: i, k: '', to: -1, ice: -1, shot: null, tried: [], go: 0, skip: -1 });
  L.wind = null; L.carry = null; L.got = L.t; L.think = .12 + R() * .15;
  if (how !== 'pass') L.oneT = null;
  if (p.side !== G.poss) { G.poss = p.side; L.touch = []; hkEv('change', how, p.n); }
  if (L.touch[L.touch.length - 1] !== i) { L.touch.push(i); if (L.touch.length > 3) L.touch.shift(); }
  // (a side with a penalty coming has touched it: the whistle, 07-game.js)
  hkTouched(p.side);
}
// the pass: from the carrier to teammate j, led to where they're going
function hkPass(j) {
  const h = hkHand(), p = L.pl[h], q = L.pl[j], V = HK_V.pass;
  let tx = q.x, ty = q.y;
  for (let k = 0; k < 3; k++) { const T = hyp(tx - p.x, ty - p.y) / V; tx = q.x + q.vx * T; ty = q.y + q.vy * T; }
  const d = hyp(tx - p.x, ty - p.y) || 1;
  Object.assign(L.puck, { st: 'free', h: -1, x: p.x + (tx - p.x) / d * .6, y: p.y + (ty - p.y) / d * .6, vx: (tx - p.x) / d * V, vy: (ty - p.y) / d * V, k: 'pass', from: h, to: j, ice: hkIcingOn(p.side, p.x) ? p.side : -1, shot: null, tried: [], go: 0 });
  p.act = 'pass'; p.actT = .2; L.carry = null;
  hkEv('pass', p.n, q.n);
}
// the dump: hard round the boards into the far corner (v across: which corner), for the wings to chase
function hkDump(v) {
  const h = hkHand(), p = L.pl[h], [tx, ty] = hkAt(p.side, HK_RULES.len - 1.2, v * 8.2), d = hyp(tx - p.x, ty - p.y) || 1, V = HK_V.dump;
  Object.assign(L.puck, { st: 'free', h: -1, x: p.x + (tx - p.x) / d * .6, y: p.y + (ty - p.y) / d * .6, vx: (tx - p.x) / d * V, vy: (ty - p.y) / d * V, k: 'dump', from: h, to: -1, ice: hkIcingOn(p.side, p.x) ? p.side : -1, shot: null, tried: [], go: 0 });
  p.act = 'pass'; p.actT = .2; L.carry = null;
  hkEv('dump', p.n);
}

// sent hard the way (ux, uy) points, by hand: a dump, or a clear
function hkSend(ux, uy) {
  const h = hkHand(), p = L.pl[h], V = HK_V.dump;
  Object.assign(L.puck, { st: 'free', h: -1, x: p.x + ux * .6, y: p.y + uy * .6, vx: ux * V, vy: uy * V, k: 'dump', from: h, to: -1, ice: hkIcingOn(p.side, p.x) ? p.side : -1, shot: null, tried: [], go: 0, skip: -1 });
  p.act = 'pass'; p.actT = .2; L.carry = null;
  hkEv('dump', p.n);
}

/* ---------- the shot ---------- */
/* what a shot of this kind by p from (x, y) is up against: { ok (in front of the goal line), dist, ang (0 dead on, to
   about 1.5 from the goal line), miss (it misses the net), q (on the net, it beats the goalie), set (how set the
   goalie is, 0 to 1), screen, block: the first skater in its lane, [index, metres along] or null, blockP } */
function hkShotOdds(p, kind, x, y) {
  const gx = hkGoalX(p.side), dir = hkDir(p.side), dx = (gx - x) * dir, dist = hyp(dx, y), ang = Math.atan2(Math.abs(y), Math.max(.01, dx));
  if (dx < .4) return { ok: false, dist, ang, miss: 1, q: 0, set: 1, screen: false, block: null, blockP: 0 };
  const g = L.pl[hkGk(1 - p.side)], inNet = hkInNet(1 - p.side), set = inNet ? hkSet(g, x, y) : 0, sh = p.r.sht;
  // a teammate standing in front of the goalie hides it
  const screen = inNet && hkSk(p.side).some(q => q !== p && hyp(q.x - g.x, q.y - g.y) < 2.2 && (q.x - g.x) * dir < 0);
  let block = null, blockP = 0;
  for (const d of hkSk(1 - p.side)) {
    if (d.stun > 0) continue;
    const ax = gx - x, ay = -y, len = hyp(ax, ay) || 1, s = ((d.x - x) * ax + (d.y - y) * ay) / (len * len); if (s < .08 || s > .88) continue;
    if (Math.abs((d.x - x) * ay - (d.y - y) * ax) / len < .7 && (!block || s * len < block[1])) { block = [L.pl.indexOf(d), s * len]; blockP = clamp(.2 + d.r.def * .022 + (kind === 'slap' ? .06 : 0) - (kind === 'one' ? .08 : 0), .1, .6); }
  }
  const tired = clamp(1 - hkSta(p) / .6, 0, 1);
  const miss = clamp(.2 + tired * .05 + dist * .008 + ang * .1 - sh * .012 + (kind === 'slap' ? .07 : kind === 'one' ? .1 : 0), .05, .6);
  let q = .09 - tired * .025 + (sh - 5) * .012 + (kind === 'slap' ? .04 + (dist > 9 ? .03 : 0) : kind === 'one' ? .06 : 0) + clamp(9 - dist, -7, 9) * .011 - ang * .1;
  if (inNet) q += -(g.r.ref - 5) * .014 + (1 - set) * .36 + (screen ? .07 : 0); else q = .97;
  return { ok: true, dist, ang, miss, q: clamp(q, .02, .97), set, screen, block, blockP };
}
// the carrier shoots: a slap shot winds up first (and can be poked off it), the others go now
function hkShoot(kind) {
  const h = hkHand(), p = L.pl[h];
  if (kind === 'slap') { p.act = 'wind'; p.actT = .42; L.wind = { i: h, kind, t: .4 }; hkEv('wind', p.n); return; }
  hkRelease(h, kind);
}
// the release: settled now (blocked, wide, saved and held, saved and loose, or in), and the flight shows it
function hkRelease(i, kind, o) {
  const H = o || {}, p = L.pl[i], O = hkShotOdds(p, kind, p.x, p.y), gx = hkGoalX(p.side), dir = hkDir(p.side), g = L.pl[hkGk(1 - p.side)], inNet = hkInNet(1 - p.side);
  /* by hand (09-hands.js): the target against where the goalie is, how hard a slap shot was wound up (a soft one is
     nearer a wrist shot), and a one-timer pressed too early (a fan: weak, and wild) */
  const A = hkAimFx(1 - p.side, H.aim), pow = H.pow == null ? 1 : H.pow, W = kind === 'slap' && pow < 1 ? hkShotOdds(p, 'wrist', p.x, p.y) : null;
  let q = W ? lerp(W.q, O.q, pow) : O.q, miss = W ? lerp(W.miss, O.miss, pow) : O.miss;
  if (O.ok) { q = clamp(q * A.f * (H.fan ? .5 : 1), .01, .97); miss = clamp(miss + A.miss + (H.fan ? .2 : 0), .03, .8); }
  let res;
  if (O.block && R() < O.blockP) res = 'block';
  else if (R() < miss) res = 'miss';
  else if (R() < q) res = 'goal';
  else if (!inNet) res = 'miss';
  else res = R() < clamp(.5 + (kind === 'slap' ? .1 : 0) - g.r.ref * .02, .15, .8) ? 'reb' : 'hold';
  // where on the goal line it is going: inside the posts, or just wide of one
  const T = H.aim && H.aim !== 'five' ? H.aim : null, wide = (T ? T.y : R() < .5 ? -1 : 1) * (HK_RULES.net + .35 + R() * 1.2);
  const ty = res === 'miss' ? wide : res === 'goal' ? (T ? T.y * .85 : H.aim === 'five' ? clamp(g.y, -.5, .5) : !inNet ? 0 : clamp(-g.y * 1.5, -.9, .9) || (R() - .5)) : clamp(!inNet ? 0 : g.y + (R() - .5) * .5, -.9, .9);
  const d = hyp(gx - p.x, ty - p.y) || 1, V = W ? lerp(HK_V.wrist, HK_V.slap, pow) : HK_V[kind];
  Object.assign(L.puck, { st: 'free', h: -1, x: p.x, y: p.y, vx: (gx - p.x) / d * V, vy: (ty - p.y) / d * V, k: 'shot', from: i, to: -1, ice: -1, tried: [], go: 0,
    shot: { i, side: p.side, kind, res, gx, dir, by: O.block ? O.block[0] : -1, blockD: O.block ? O.block[1] : 0, dist: Math.round(O.dist * 10) / 10, q: Math.round(q * 100) / 100, miss: Math.round(miss * 100) / 100, aim: H.aim || null, set: Math.round(O.set * 100) / 100, screen: O.screen, en: !inNet, touch: L.touch.slice() } });
  p.act = 'shoot'; p.actT = .3; L.carry = null; L.wind = null; L.oneT = null;
  hkEv('shot', p.n, kind);
}
function hkShotBlocked() {
  const P = L.puck, S = P.shot, d = L.pl[S.by], p = L.pl[S.i];
  hkBoxAdd(d.side, d.ri, 'blk'); hkBoxAdd(p.side, p.ri, 'att'); hkEv('block', d.n, p.n);
  d.act = 'block'; d.actT = .3;
  hkLoose(P.x, P.y, Math.atan2(-P.vy, -P.vx) + (R() - .5) * 2.2, 3 + R() * 5);
}
// the shot reaches the goal line: in, wide, held or loose in front (07-game.js scores a goal)
function hkShotLands() {
  const P = L.puck, S = P.shot, p = L.pl[S.i], gi = hkGk(1 - S.side), g = L.pl[gi];
  S.done = true;
  // (a try in the shootout is settled by the game, and is in nobody's stats)
  if (GD.ph === 'so') return hkSoLanded(S);
  hkBoxAdd(p.side, p.ri, 'att');
  if (S.res === 'miss') { hkEv('wide', p.n); P.k = 'loose'; P.shot = null; return; }
  G.sog[S.side]++; hkBoxAdd(p.side, p.ri, 'sog'); if (!S.en) hkBoxAdd(g.side, g.ri, 'sa');
  if (S.res === 'goal') return hkGoalScored(S);
  hkBoxAdd(g.side, g.ri, 'sv'); g.act = 'save'; g.actT = .35;
  if (S.res === 'hold') { hkEv('save', g.n, p.n); return hkGain(gi, 'save'); }
  hkEv('rebound', g.n, p.n);
  // off the pads and out in front, somewhere across the slot
  const out = S.dir > 0 ? Math.PI : 0;
  hkLoose(g.x - S.dir * .5, g.y, out + (R() - .5) * 2.4, 4 + R() * 6, gi);
}
