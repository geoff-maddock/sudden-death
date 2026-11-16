/* Black Ice: the mind of the player with the puck (issue #83, phase 1). A few times a second the carrier weighs what
   they could do, and picks by weight (so it isn't the same every time):
   - shoot: what the shot is worth from here (hkShotOdds: on the net, and past the goalie). A puck that has just come
     across to them is a one-timer; with room and a long way out it's a slap shot; otherwise the wrist shot.
   - pass: to the teammate it helps most (their look at the net, more if they are across the front of it, and how far
     up the ice it gets the puck), less the sticks in the lane.
   - carry: up the ice through the open side, and in the other end toward the slot.
   - dump: in the middle of the ice with a checker on them and nobody open, send it into the corner and chase.
   A goalie holding the puck freezes it when a forechecker is on them, or moves it to an open defender. */
const HK_THINK = { shootAt: .06, press: 2.2 };
// the sticks in the lane from (x, y) to (tx, ty): 0 clear, more for each opponent near it
function hkLaneRisk(side, x, y, tx, ty) {
  const ax = tx - x, ay = ty - y, len = hyp(ax, ay) || 1; let risk = 0;
  for (const d of hkSk(1 - side)) {
    if (d.stun > 0) continue;
    const s = ((d.x - x) * ax + (d.y - y) * ay) / (len * len); if (s < .1 || s > .95) continue;
    const off = Math.abs((d.x - x) * ay - (d.y - y) * ax) / len; if (off < 1.1) risk += (1.1 - off) * .45;
  }
  return risk;
}
// what a pass from h to j is worth
function hkPassValue(h, j) {
  const p = L.pl[h], q = L.pl[j], s = p.side, d = hyp(q.x - p.x, q.y - p.y);
  const O = hkShotOdds(q, 'one', q.x, q.y), look = O.ok && O.dist < 13 ? (1 - O.miss) * O.q * (O.block ? .75 : 1) : 0;
  const across = look > 0 && q.y * p.y < 0 && Math.abs(q.y - p.y) > 3.5 ? .06 : 0, prog = (hkUp(s, q.x) - hkUp(s, p.x)) / HK_RULES.len;
  const [, md] = hkNearest(q.x, q.y, hkSk(1 - s));
  return look + across + prog * .4 - hkLaneRisk(s, p.x, p.y, q.x, q.y) - (d > 18 ? .15 : 0) - (d < 2.5 ? .2 : 0) - (md < 1.3 ? .08 : 0);
}
function hkThink(h) {
  const p = L.pl[h], s = p.side;
  if (p.pos === 'G') return hkGoalieThink(h);
  if (p.stun > 0) return;
  const Lz = HK_RULES.len, up = hkUp(s, p.x), dir = hkDir(s), gx = hkGoalX(s), [nd, ndd] = hkNearest(p.x, p.y, hkSk(1 - s).filter(d => d.stun <= 0));
  const press = ndd < HK_THINK.press, inZone = up > Lz - HK_RULES.blue, held = Math.max(0, L.t - L.got);
  // the shot
  const dist = hyp(gx - p.x, p.y), one = L.oneT && L.oneT.i === h && L.t - L.oneT.t < .4 && dist < 12;
  const kind = one ? 'one' : dist > 7.5 && ndd > 2.8 ? 'slap' : 'wrist', O = hkShotOdds(p, kind, p.x, p.y), ev = O.ok && dist < 16 ? (1 - O.miss) * O.q * (O.block ? .75 : 1) : 0;
  // the best pass
  const mates = hkSk(s).filter(q => q !== p && q.stun <= 0).map(q => [L.pl.indexOf(q), hkPassValue(h, L.pl.indexOf(q))]).sort((a, b) => b[1] - a[1]), best = mates[0];
  const late = G.clock < 2.5 && O.ok && dist < 18;
  const w = {
    shoot: !inZone ? (late ? 5 : 0) : (ev > HK_THINK.shootAt ? (ev - .03) * 42 : O.ok && dist < 11 ? .12 + held * .15 : 0) + (one && ev > .04 ? 2 : 0) + (late ? 5 : 0),
    pass: best ? Math.max(.03, (best[1] - ev) * 6 + .12 + (press ? .7 : 0)) * (.25 + held * .7) : 0,
    carry: (press ? .6 : 1.6) + (inZone ? 0 : .6),
    dump: !inZone && up > Lz / 2 && press && (!best || best[1] < .08) ? .7 : up < HK_RULES.blue && ndd < 1.4 && (!best || best[1] < 0) ? .3 : 0,
  };
  const k = wpick(w);
  if (k === 'shoot') return hkShoot(kind);
  if (k === 'pass' && best) return hkPass(best[0]);
  if (k === 'dump') return hkDump(p.y * dir < 0 ? -1 : 1);
  // carry: away from the nearest checker in front, toward the slot once in the other end
  let tx, ty;
  if (!inZone) {
    const ahead = nd && (nd.x - p.x) * dir > 0 && ndd < 6, side = ahead ? Math.sign(p.y - nd.y) || (R() < .5 ? -1 : 1) : 0;
    tx = p.x + dir * 8; ty = clamp(p.y + side * 3.5, -8, 8);
  } else if (up > Lz - HK_RULES.goal - .5) { tx = gx - dir * 4.5; ty = (Math.sign(p.y) || 1) * 4.5; }
  else if (dist > 8) { tx = gx - dir * 6.5; ty = p.y * .45; }
  else { tx = gx - dir * 4.5; ty = clamp(p.y * .6 + (nd ? Math.sign(p.y - nd.y) * 1.5 : 0), -6, 6); }
  L.carry = [tx, ty];
}
// the goalie has it: freeze it with a forechecker close, or move it to the most open defender
function hkGoalieThink(h) {
  const g = L.pl[h], s = g.side;
  if (L.t - L.got < .45) return;
  const [, fd] = hkNearest(g.x, g.y, hkSk(1 - s));
  const mates = hkSk(s).map(q => [L.pl.indexOf(q), -hkLaneRisk(s, g.x, g.y, q.x, q.y) - hyp(q.x - g.x, q.y - g.y) * .02 + (HK_ROLE[q.pos] === 'defender' ? .15 : 0)]).sort((a, b) => b[1] - a[1]);
  if (!mates.length || (fd < 3.5 && R() < .6) || mates[0][1] < -.5 || L.t - L.got > 2) return hkFreeze(h);
  hkPass(mates[0][0]);
}
