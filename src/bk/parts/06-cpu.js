/* The Charter Court: the ball handler's mind (issue #77, phase 1). A few times a second the player with the ball weighs
   what they could do, and picks by weight (so it isn't the same every time):
   - shoot: what the shot is worth from here (bkShotP times 2 or 3); a good look gets taken, and a poor one only as the
     shot clock runs down;
   - drive: at the rim if no defender stands in the lane, better with speed and handle;
   - pass: to the teammate with the best look, less the risk of a defender in the lane;
   - keep the dribble: work toward the spot, and let the offense set up.
   In the backcourt the handler brings it up (or pushes it, with defenders behind the ball: a fast break). A defender
   up close may pick the dribble or reach in and foul (bkReach, 07-game.js takes the foul).
   Phase 2: it may also call a pick (a big nearby), try a crossover or a spin on a defender in the lane, or lob it to a
   leaper near the rim for an alley-oop. */
const BK_THINK = { shootAt: .92, urgent: 3.2, pick: .0045, reach: .006 };
// what a pass to j would be worth: their look, less the chance it's picked off
// (a big inside is worth a post move to the rim, not only the shot from where they stand)
function bkPassValue(h, j) {
  const p = L.pl[h], q = L.pl[j];
  let S = bkShotP(q, q.x, q.y);
  if (BK_ROLE[q.pos] === 'big' && S.dist < 3.4) { const hx = bkHoopX(q.side), k = 1.1 / S.dist, P = bkShotP(q, hx + (q.x - hx) * k, q.y * k); if (P.p * .85 > S.p) S = Object.assign(P, { p: P.p * .85 }); }
  let risk = 0;
  for (const d of bkDefense()) {
    const ax = q.x - p.x, ay = q.y - p.y, len = hyp(ax, ay) || 1, s = ((d.x - p.x) * ax + (d.y - p.y) * ay) / (len * len);
    if (s < .15 || s > .95) continue;
    const off = Math.abs((d.x - p.x) * ay - (d.y - p.y) * ax) / len;
    if (off < .95) risk += (.95 - off) * .4;
  }
  return S.p * (S.three ? 3 : 2) - risk - (len2(p, q) > 14 ? .3 : 0);
}
const len2 = (a, b) => hyp(a.x - b.x, a.y - b.y);
// on the dribble a defender up close may pick it, or reach in for a foul (whoever plays the handler): true if they did
function bkPressure(h) {
  const p = L.pl[h], [nd, ndd] = bkNearest(p.x, p.y, bkDefense());
  if (!nd || ndd >= 1 || nd.stun > 0) return false;
  if (R() < clamp(BK_THINK.pick + (nd.r.def - p.r.hnd + 2 * bkTired(p)) * .0018, .001, .02)) { bkPicked(nd); return true; }
  if (R() < BK_THINK.reach) { bkReach(nd); return true; }
  return false;
}
// the defender standing in the lane to the rim (within about a metre of the line from the handler to it), or null
function bkLaneBlock(p) {
  const hx = bkHoopX(p.side), ax = hx - p.x, ay = -p.y, len = hyp(ax, ay) || 1;
  let best = null, bs = 2;
  for (const d of bkDefense()) {
    if (d.stun > 0) continue;
    const s = ((d.x - p.x) * ax + (d.y - p.y) * ay) / (len * len); if (s < .05 || s > 1) continue;
    if (Math.abs((d.x - p.x) * ay - (d.y - p.y) * ax) / len < .9 + (d.r.siz - 5) * .04 && s < bs) { bs = s; best = d; }
  }
  return best;
}
const bkLaneOpen = p => !bkLaneBlock(p);
function bkThink(h) {
  const p = L.pl[h], dist = bkRimDist(p.side, p.x, p.y), u = bkU(p.side, p.x), [nd, ndd] = bkNearest(p.x, p.y, bkDefense());
  if (bkPressure(h)) return;
  // driving: at the rim, it's a layup or a dunk. A defender in the lane: beat them (handle and speed against defense
  // and speed: they're left a step behind), pull up for the shot, or pull it back out
  if (L.drive) {
    if (dist < 1.4) return bkShoot();
    const d = bkLaneBlock(p);
    if (d && dist > 1.8) {
      if (R() < clamp(.35 + (p.r.hnd + p.r.spd - d.r.def - d.r.spd) * .05, .08, .75)) { d.stun = .45; bkEv('beat', p.n, d.n); return; }
      if (dist < 4.5 && R() < .45) return bkShoot();
      L.drive = false;
    }
    return;
  }
  const urgent = G.shot < BK_THINK.urgent && G.shot < G.clock, late = G.clock < 4 && G.clock <= G.shot;
  // the backcourt: bring it up, push it with numbers, or hit a teammate ahead
  if (u > 14) {
    const ahead = bkOffense().filter(q => q !== p && bkU(q.side, q.x) < u - 4), behind = bkDefense().filter(d => bkU(p.side, d.x) < u).length;
    if (ahead.length && R() < .35) { const best = ahead.map(q => [L.pl.indexOf(q), bkPassValue(h, L.pl.indexOf(q))]).sort((a, b) => b[1] - a[1])[0]; if (best[1] > .9) return bkPass(best[0]); }
    if (behind <= 2 && bkLaneOpen(p)) L.drive = true;
    return;
  }
  const S = bkShotP(p, p.x, p.y), sv = S.p * (S.three ? 3 : 2);
  const mates = bkOffense().filter(q => q !== p).map(q => [L.pl.indexOf(q), bkPassValue(h, L.pl.indexOf(q))]).sort((a, b) => b[1] - a[1]);
  // (the longer one player has had it, the more the others want it)
  const best = mates[0], lane = dist > 2 && bkLaneOpen(p), held = Math.max(0, L.t - (L.got || 0));
  const w = {
    shoot: (sv > BK_THINK.shootAt ? (sv - .6) * 5 : .04) + (urgent || late ? 6 : 0) + (S.rim ? 2 : 0),
    drive: dist > 2 ? (lane ? 1 : .35) + (p.r.spd + p.r.hnd - 11) * .12 + (urgent ? 1 : 0) + (BK_ROLE[p.pos] === 'big' && dist < 3.6 ? 1.6 + (p.r.siz - 5) * .2 : 0) : .05,
    pass: best ? Math.max(.05, (best[1] - sv * .8) * 3 + .7) * (1 + held * .7) * (urgent && G.shot < 1.2 ? .2 : 1) : 0,
    hold: Math.max(.05, 1.4 * (G.shot - 4) / 10),
  };
  // the pick, a move on the defender in the lane, and the lob to a leaper near the rim
  const bigNear = !L.pick && L.pl.some((q, i) => i !== h && q.side === p.side && BK_ROLE[q.pos] === 'big' && hyp(q.x - p.x, q.y - p.y) < 7);
  w.pick = bigNear && dist > 4.5 && !urgent ? .55 : 0;
  w.move = nd && ndd < 1.3 && !lane && dist > 2.2 && !(L.moveCd > 0) ? .4 + (p.r.hnd - 6) * .08 : 0;
  const oop = bkOffense().map(q => L.pl.indexOf(q)).filter(j => j !== h && bkRimDist(p.side, L.pl[j].x, L.pl[j].y) < 2.4 && bkLeaper(L.pl[j]))[0];
  w.lob = oop != null ? 1.1 : 0;
  const k = wpick(w);
  if (k === 'pick') return bkPick(h);
  if (k === 'move') return bkMoveTry(h, R() < .65 ? 'cross' : 'spin');
  if (k === 'lob') return bkPass(oop, true);
  if (k === 'shoot') return bkShoot();
  if (k === 'drive') { L.drive = true; bkEv('drive', p.n); return; }
  if (k === 'pass' && best) return bkPass(best[0]);
}
