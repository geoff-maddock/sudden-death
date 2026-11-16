/* Black Ice: the mind of the player with the puck (issue #83, phase 1). A few times a second the carrier weighs what
   they could do, and picks by weight (so it isn't the same every time):
   - shoot: what the shot is worth from here (hkShotOdds: on the net, and past the goalie). A puck that has just come
     across to them is a one-timer; with room and a long way out it's a slap shot; otherwise the wrist shot.
   - pass: to the teammate it helps most (their look at the net, more if they are across the front of it, and how far
     up the ice it gets the puck), less the sticks in the lane.
   - carry: up the ice through the open side, and in the other end toward the slot.
   - dump: in the middle of the ice with a checker on them and nobody open, send it into the corner and chase.
   A goalie holding the puck freezes it when a forechecker is on them, or moves it to an open defender. */
const HK_THINK = { shootAt: .06, ppAt: .085, press: 2.2 };
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
  // (an Archmage's side looks harder for the pass across the front; Point shots and the Umbrella want it at the point)
  const A = hkAttNow(s), across = look > 0 && q.y * p.y < 0 && Math.abs(q.y - p.y) > 3.5 ? (hkCpuSide(s) && G.skill[s] >= 2 ? .1 : .06) : 0, prog = (hkUp(s, q.x) - hkUp(s, p.x)) / HK_RULES.len;
  const point = A.point && HK_ROLE[q.pos] === 'defender' && hkUp(s, q.x) > HK_RULES.len - HK_RULES.blue - 1 ? A.point * .08 : 0;
  const [, md] = hkNearest(q.x, q.y, hkSk(1 - s));
  return look + across + point + (hkDim(s) ? (R() - .5) * HK_DIM.noise : 0) + prog * .4 - hkLaneRisk(s, p.x, p.y, q.x, q.y) - (d > 18 ? .15 : 0) - (d < 2.5 ? .2 : 0) - (md < 1.3 ? .08 : 0);
}
function hkThink(h) {
  const p = L.pl[h], s = p.side;
  if (GD.ph === 'so') return hkSoThink(h);
  if (hkIsGk(p)) return hkGoalieThink(h);
  if (p.stun > 0) return;
  const Lz = HK_RULES.len, up = hkUp(s, p.x), dir = hkDir(s), gx = hkGoalX(s), [nd, ndd] = hkNearest(p.x, p.y, hkSk(1 - s).filter(d => d.stun <= 0));
  const press = ndd < HK_THINK.press, inZone = up > Lz - HK_RULES.blue, held = Math.max(0, L.t - L.got);
  // the shot
  const dist = hyp(gx - p.x, p.y), one = L.oneT && L.oneT.i === h && L.t - L.oneT.t < .4 && dist < 12;
  const kind = one ? 'one' : dist > 7.5 && ndd > 2.8 ? 'slap' : 'wrist', O = hkShotOdds(p, kind, p.x, p.y), ev = O.ok && dist < 16 ? (1 - O.miss) * O.q * (O.block ? .75 : 1) : 0;
  // the best pass
  const mates = hkSk(s).filter(q => q !== p && q.stun <= 0).map(q => [L.pl.indexOf(q), hkPassValue(h, L.pl.indexOf(q))]).sort((a, b) => b[1] - a[1]), best = mates[0];
  const late = G.clock < 2.5 && O.ok && dist < 18;
  // an empty net is shot at from anywhere with a clear lane; a side a skater short clears it and doesn't mind the icing
  const empty = !hkInNet(1 - s) && O.ok && !O.block && dist < 20, short = hkShort(s);
  // with a skater more, a side waits for the good look and moves the puck; with one fewer, it doesn't carry it up the ice
  const up1 = hkShort(1 - s), A = hkAttNow(s), TP = hkTempo(s), W = A.w || {};
  // (the system and the Tempo move the look a shooter waits for; from the point, a defender in Point shots lets it go)
  const at = (up1 ? HK_THINK.ppAt : HK_THINK.shootAt) + (A.at || 0) + TP.at - (A.point && HK_ROLE[p.pos] === 'defender' ? .02 : 0) - (hkDim(s) ? HK_DIM.at : 0);
  const w = {
    shoot: empty ? 8 : !inZone ? (late ? 5 : 0) : ((ev > at ? (ev - .03) * 42 : O.ok && dist < 11 && !up1 ? .12 + held * .15 : 0) + (one && ev > .04 ? 2 : 0)) * (W.shoot || 1) + (late ? 5 : 0),
    pass: best ? Math.max(.03, (best[1] - ev) * 6 + .12 + (press ? .7 : 0)) * (.25 + held * .7) * (up1 ? 1.6 : 1) * (W.pass || 1) : 0,
    carry: short && !inZone && up > HK_RULES.blue ? .3 : ((press ? .6 : 1.6) + (inZone ? 0 : .6)) * (W.carry || 1) * TP.carry,
    dump: short && !inZone ? (press ? 4 : up < HK_RULES.blue ? .8 : 5) : ((!inZone && up > Lz / 2 && press && (!best || best[1] < .08) ? .7 : up < HK_RULES.blue && ndd < 1.4 && (!best || best[1] < 0) ? .3 : 0)
      + (!inZone && up > Lz / 2 - 1 ? (W.dump > 1 ? W.dump * .5 : 0) + (TP.safe && hkLead(s) > 0 ? 1 : 0) : 0)) * (W.dump && W.dump < 1 ? W.dump : 1),
  };
  const k = wpick(w);
  if (k === 'shoot') return hkShoot(empty ? 'wrist' : kind);
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
/* a try in the shootout: in on the goalie on one side, then a cut across the front (the goalie follows a moment late)
   and the shot */
function hkSoThink(h) {
  const p = L.pl[h], C = GD.so.cur, gx = hkGoalX(p.side), dir = hkDir(p.side), dist = hyp(gx - p.x, p.y);
  if (!C.cut) {
    if (dist > C.shotAt + 1.5) { L.carry = [gx - dir * C.shotAt, -C.deke * 1.6]; return; }
    C.cut = L.t; L.carry = [gx - dir * 3.2, C.deke * 2];
    return;
  }
  if (L.t - C.cut > C.wait || dist < 3.6) hkShoot('wrist');
}
/* the goalie comes off late in the third when a side is a goal or two behind and has the puck up the ice (HK_PULL), and
   goes back when that's no longer so. Not for a side you play: that goalie is yours to pull (G). */
const HK_PULL = { at: .1, by: 2, up: .5 };
function hkPullThink() {
  for (const s of [0, 1]) {
    // (yours is your own call, in Manage as in You play; a Squire never thinks of it, and an Archmage does a little sooner)
    if ((GD.mode !== 'watch' && s === GD.you) || G.skill[s] < 1) continue;
    const g = L.pl[hkGk(s)], diff = G.score[1 - s] - G.score[s], want = G.p === HK_RULES.periods && G.clock < G.plen * HK_PULL.at * (G.skill[s] >= 2 ? 1.3 : 1) && diff >= 1 && diff <= HK_PULL.by;
    if (g.pulled === 'late' && !want) { g.pulled = false; continue; }
    if (!g.pulled && want && G.poss === s && hkUp(s, L.puck.x) > HK_RULES.len * HK_PULL.up) hkPull(s, 'late');
  }
}
