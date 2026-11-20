/* The Saltmere Lanes: the CPU's ball (issue #100, phase 1). How a side picks its line and its ball, and how far its
   bowler's release strays, by skill: 0 a Squire, 1 a Knight, 2 an Archmage.

   A strike ball aims for the pocket (the 1-3 for a right-hander, board 17.5; the 1-2 for a left-hander). The side
   reads the lane to find the angle that gets there from where its bowler stands:
   - a Squire reads it as it was when the game began, never moves, and throws the strike ball at every spare;
   - a Knight reads it as it was too, but corrects by what it saw: after each of a bowler's strike balls it moves that
     bowler's aim on that lane by half of how far they missed. It uses the spare ball, and on a split it takes the
     bigger group;
   - an Archmage reads the lane as it is now, and stands where the angle into the pocket is best (4 to 6 degrees).
   Knights and Archmages try a few places to stand, and keep off a line that brushes the gutter.
   A spare ball (plastic, it rolls straight) goes across the lane at the front pin of what is left, a touch to the
   side that drives that pin into the rest.
   Then the release strays by the skill (BL_SKILL: the angle, the speed and the revs), seeded through R. */
const BL_SKILL = [
  { n: 'Squire', ang: .24, mph: .38, rpm: 22, read: 0, spare: true, learn: 0, stands: 2 },
  { n: 'Knight', ang: .18, mph: .25, rpm: 15, read: 0, spare: true, learn: .5, stands: 3 },
  { n: 'Archmage', ang: .132, mph: .18, rpm: 10, read: 1, spare: true, learn: 0, stands: 5 }];
const BL_POCKET = blBoardX(17.5);   // a right-hander's pocket at the pins (the left-hander's is its mirror)

// a bowler's style: their hand, speed and revs (a team that brings none gets them from the seed)
function blStyle(rnd) {
  const r = rnd || R;
  return { hand: r() < .15 ? -1 : 1, mph: +(15.5 + r() * 3).toFixed(1), rpm: Math.round(260 + r() * 180) };
}
// where a bowler stands for the strike ball: a hook ball from inside the pocket's line, more revs deeper inside
const blStand = st => st.hand * blBoardX(18 + (st.rpm - 350) / 25);

// the groups of standing pins that no standing pin joins (a split leaves two or more)
function blGroups(standing) {
  const left = standing.slice(), out = [];
  while (left.length) {
    const g = [left.shift()], todo = [g[0]];
    while (todo.length) { const p = todo.pop(); for (const [a, b] of BL_ADJ) { const q = a === p ? b : b === p ? a : 0; const i = q ? left.indexOf(q) : -1; if (i >= 0) { left.splice(i, 1); g.push(q); todo.push(q); } } }
    out.push(g.sort((a, b) => a - b));
  }
  return out;
}
// what a spare ball goes at: the front pin of the pins aimed at, hit on the side that drives it into the rest
function blSpareTarget(pins) {
  const key = pins.slice().sort((a, b) => BL_SPOT[a][1] - BL_SPOT[b][1] || Math.abs(BL_SPOT[a][0]) - Math.abs(BL_SPOT[b][0]))[0];
  const [kx, ky] = BL_SPOT[key], rest = pins.filter(p => p !== key);
  if (!rest.length) return { x: kx, y: ky, key };
  const mx = rest.reduce((s, p) => s + BL_SPOT[p][0], 0) / rest.length, d = mx - kx;
  return { x: kx - Math.sign(d) * Math.min(2.5, Math.abs(d) / 3), y: ky, key };
}
/* the side's plan for its next ball: { x0, ang, mph, rpm, ball, hand, aim: { x, y }, why } (what it means to throw,
   before the release strays) */
function blPlan(s) {
  const sk = BL_SKILL[G.skill[s]], st = blStyleNow(s, blBowler(s)), lane = blLane(s), stand = G.stand[s];
  // the oil as the side reads it: as it was at the start, or as it is (an Archmage, or anyone with the coach's word)
  const oil = (sk.read && !(G.noRead && G.noRead[s])) || (G.wordOn && G.wordOn[s]) ? G.oil[lane] : G.oil0, fresh = stand.length === 10;
  const lineX = fresh ? st.hand * BL_LINES[blLineOf(s)].off * BL_LANE.bw : 0;
  const base = { mph: st.mph, rpm: st.rpm, hand: st.hand };
  if (fresh || !sk.spare) {
    // the strike ball: at the pocket on a full rack; at the spare's front pin from the strike line otherwise
    let target = fresh ? st.hand * BL_POCKET : blSpareTarget(stand).x, why = fresh ? 'the pocket' : 'the spare, with the strike ball';
    if (fresh && sk.learn) target += blBiasOf(s, lane);
    const stands = [];
    const base0 = blStand(st) + st.hand * BL_LINE_BASE * BL_LANE.bw;
    for (let i = 0; i < sk.stands; i++) stands.push(base0 + st.hand * (i - (sk.stands - 1) / 2) * 2.2);
    let best = null;
    for (const x0 of stands) {
      const t = Object.assign({ x0, ball: 'strike' }, base), ang = blAimAt(t, target, oil, G.tide);
      if (ang === null) continue;
      // the best angle into the pocket, but not a line that brushes the gutter on the way
      const r = blBall(Object.assign({ ang }, t), oil, G.tide), room = Math.min(...r.path.map(q => BL_LANE.edge - Math.abs(q[0])));
      const score = -Math.abs(r.entry - 5.2) - (room < 6 ? (6 - room) * .8 : 0);
      if (!best || score > best.score) best = { x0, ang, score };
    }
    // nothing reaches the pocket from there: walk the stand across the lane until something does
    for (let d = 1; !best && d <= 12; d++) for (const x0 of [blStand(st) + st.hand * d * 1.6, blStand(st) - st.hand * d * 1.6]) {
      if (best || Math.abs(x0) > BL_LANE.edge - 2) continue;
      const t = Object.assign({ x0, ball: 'strike' }, base), ang = blAimAt(t, target, oil, G.tide); if (ang !== null) best = { x0, ang };
    }
    if (!best) best = { x0: blStand(st), ang: 0 };
    // the line: the feet off the best stand, if a ball from there still reaches the pocket
    if (lineX) { const x1 = best.x0 + lineX, t = Object.assign({ x0: x1, ball: 'strike' }, base), a1 = Math.abs(x1) < BL_LANE.edge - 2 ? blAimAt(t, target, oil, G.tide) : null; if (a1 !== null) best = { x0: x1, ang: a1 }; }
    if (fresh && blLineOf(s) !== 'pocket') why += ', ' + BL_LINES[blLineOf(s)].n.toLowerCase();
    return Object.assign({ x0: best.x0, ang: best.ang, ball: 'strike', aim: { x: target, y: BL_LANE.len }, why }, base);
  }
  // the spare ball: on a split, the bigger group (the one nearer the middle on a tie), or all of it to convert
  const groups = blGroups(stand).sort((a, b) => b.length - a.length || Math.min(...a.map(p => Math.abs(BL_SPOT[p][0]))) - Math.min(...b.map(p => Math.abs(BL_SPOT[p][0]))));
  const conv = groups.length > 1 && G.split && G.split[s] === 'convert';
  const T = blSpareTarget(conv ? stand : groups[0]), x0 = clamp(-T.x * .7, -14, 14);
  const t = Object.assign({ x0, ball: 'spare' }, base);
  // aim through the pin's spot: a straight ball's x at the headpin line is close to its x at the pin
  let ang = blAimAt(t, T.x, oil, G.tide);
  if (ang !== null) { const r = blBall(Object.assign({ ang }, t), oil, G.tide); const a2 = blAimAt(t, T.x - r.m * (T.y - BL_LANE.len), oil, G.tide); if (a2 !== null) ang = a2; }
  return Object.assign({ x0, ang: ang === null ? 0 : ang, ball: 'spare', aim: { x: T.x, y: T.y }, why: conv ? 'the split, to convert it' : groups.length > 1 ? 'the safe side of the split' : 'the spare' }, base);
}
// a Knight's correction for this bowler on this lane (what it has learned from their strike balls there)
const blBiasOf = (s, lane) => (G.bias[s][blBowler(s)] || [0, 0])[lane];
// the release: the plan, strayed by the skill and by the bowler (accuracy or spare, the arm, the moment's nerve)
function blRelease(plan, s) {
  const sk = BL_SKILL[G.skill[s]], k = blErrK(s, blBowler(s), G.stand[s].length < 10) * blCallErr(s);
  return Object.assign({}, plan, { ang: plan.ang + gauss() * sk.ang * k, mph: +(plan.mph + gauss() * sk.mph * k).toFixed(2), rpm: Math.max(120, Math.round(plan.rpm + gauss() * sk.rpm * k)) });
}

