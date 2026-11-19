/* The Saltmere Lanes: the call and the read (issue #100, phase 4).

   The line (BL_LINES, G.line a side), before every first ball: deep inside (stand further in for more angle into the
   pocket: more carry, a bigger miss), the pocket (the standard line) or up the boards (stand further out and play it
   straighter: safer on a dry lane, less angle). It moves where the side's bowler stands; the angle is found as ever.
   On a split, convert or safe (G.split a side): convert goes at the front pin to slide it into the rest, safe takes the
   bigger group and the sure count.
   Stances (G.stance a side, kept from ball to ball): tempo quick (a quicker meter, less arm spent, a touch less true)
   or steady; ball heavy (more carry, more arm, a few less revs) or light (more revs, deflects more).
   The coach's word (G.word, once a game a side): the next ball is read on the lane as it is now (your guide line
   follows the oil, and a CPU bowler reads it exactly). The turn: a side's first ball after the halfway frame re-reads
   the lanes, so the lane chart shows all of the oil for that ball.
   The read: the lane chart (and the overhead strip on your ball) shows the oil only as far down the lane as the
   bowler's read rating allows (blReadFt: 25 feet, to all 60 for the best reader), and every ball's track this game.
   The CPU's call (blCpuCall), before each ball:
   - a Squire plays the pocket, steady and heavy, and never splits a hair;
   - a Knight plays the pocket, deep inside when it needs strikes late (behind by 20 or more from the 7th frame), up
     the boards when well ahead; it plays a split safe unless it needs the pins; it takes the coach's word for the
     tenth frame's first ball;
   - an Archmage reads the sheet as a Knight does, and the lane: when the track has dried it moves deep, past the
     burned boards, and so too when it has seen a rival keep throwing the same line on it (the scout, G.scout); it
     goes for a baby split it can make; it turns to a quick tempo and a light ball when its bowler's arm is low, and
     sends in a fresher pinch bowler in the last frame when the anchor is spent. */
const BL_LINES = { deep: { n: 'Deep inside', off: 3, err: 1.08 }, pocket: { n: 'The pocket', off: 0, err: 1 }, boards: { n: 'Up the boards', off: -3, err: .95 } };
const BL_STANCE = { quick: { meter: 1.2, arm: .75, err: 1.03 }, steady: { meter: 1, arm: 1, err: 1 }, heavy: { mass: 1.04, rpm: .96, arm: 1.15 }, light: { mass: .96, rpm: 1.04, arm: .9 } };
const BL_SCOUT = { same: 3, board: 1.5 };

const blStanceOf = s => (G.stance && G.stance[s]) || { tempo: 'steady', ball: 'heavy' };
const blLineOf = s => (G.line && G.line[s]) || 'pocket';
// a bowler's style as they bowl now: the ball stance moves the revs
function blStyleNow(s, ri) { const st = blStyleOf(s, ri), B = BL_STANCE[blStanceOf(s).ball]; return Object.assign({}, st, { rpm: Math.round(st.rpm * B.rpm * blFxFor(s).hook) }); }
// the line's and the stance's part in how true a release is
const blCallErr = s => BL_LINES[blLineOf(s)].err * BL_STANCE[blStanceOf(s).tempo].err;
// what a ball costs the arm with the stance
const blArmCost = (s, power) => (power ? BL_ARM.power : BL_ARM.ball) * BL_STANCE[blStanceOf(s).tempo].arm * BL_STANCE[blStanceOf(s).ball].arm * blFxFor(s).arm * (blGxOf(s, blBowler(s)).arm != null ? blGxOf(s, blBowler(s)).arm : 1);
// how far down the lane (feet) the bowler reads the oil now
function blReadFt(s, ri) {
  if (G.wordOn && G.wordOn[s]) return BL_LANE.ft;
  if (blTurnBall(s)) return BL_LANE.ft;
  return Math.round(25 + 35 * blRat(s, ri == null ? blBowler(s) : ri).red);
}
// is this side's next ball the turn: its first ball after the halfway frame?
function blTurnBall(s) { if (!G || G.ro) return false; return blCur(s) === Math.ceil(G.frames / 2) && G.rb[s] === 0 && !(G.fr[s][blCur(s)] || []).length; }
// could this split be made: two groups whose nearest pins are one pin's gap apart, one behind the other (the baby
// splits, the 2-7 and the 3-10, and the 5-7 or 5-10), not side by side across a row (the 4-6, the 7-10)
function blSplitMakeable(stand) {
  const g = blGroups(stand); if (g.length !== 2) return false;
  let best = null; for (const a of g[0]) for (const b of g[1]) { const d = Math.hypot(BL_SPOT[a][0] - BL_SPOT[b][0], BL_SPOT[a][1] - BL_SPOT[b][1]); if (!best || d < best.d) best = { d, dy: Math.abs(BL_SPOT[a][1] - BL_SPOT[b][1]) }; }
  return best.d <= 24.5 && best.dy > 5;
}
// has the strike track on this lane dried (the oil left on the boards a hook ball rolls over, out at 20 to 35 feet)?
function blTrackDry(lane, hand) {
  const L = BL_LANE, oil = G.oil[lane], h = hand === -1 ? -1 : 1; let now = 0, was = 0;
  for (let b = 6; b <= 12; b++) for (let f = 20; f < 35; f++) { const bb = h > 0 ? b : L.boards + 1 - b, i = (bb - 1) * L.ft + f; now += oil[i]; was += G.oil0[i]; }
  return was > 0 && now / was < .8;
}
// the CPU's call for side s's next ball: the line, the split, the stance, the word and a pinch bowler. Says what it
// chose, short, for the status line (or '')
function blCpuCall(s) {
  const sk = G.skill[s], o = 1 - s, ri = blBowler(s), lane = blLane(s), st = blStyleOf(s, ri);
  const f = blCur(s), late = G.ro || f >= Math.min(6, G.frames - 3), gap = blTotal(o) - blTotal(s), out = [];
  const rr = blHallRerackCall(s); if (rr) out.push(rr);
  let line = 'pocket', split = 'safe';
  if (sk >= 1) {
    if (late && gap >= 20) line = 'deep';
    else if (late && gap <= -30) line = 'boards';
    if (late && gap >= 20) split = 'convert';
  }
  if (sk >= 2) {
    if (line === 'pocket' && (blTrackDry(lane, st.hand) || (G.scout[s] && G.scout[s].same >= BL_SCOUT.same && G.scout[s].lane === lane))) line = 'deep';
    if (blIsSplit(G.stand[s]) && blSplitMakeable(G.stand[s])) split = 'convert';
    const arm = G.arm[s][ri];
    G.stance[s] = { tempo: arm < .7 ? 'quick' : 'steady', ball: arm < .6 ? 'light' : 'heavy' };
    // the last frame and a spent anchor: a fresher bowler, if one is clearly fresher
    if (f === blSheetN() - 1 && G.rb[s] === 0 && !G.pinched[s] && arm < .55) {
      const fresh = G.arm[s].map((a, i) => [a, i]).filter(([a, i]) => i !== ri && a > arm + .3).sort((a, b) => b[0] - a[0])[0];
      if (fresh && blPinch(s, fresh[1]).ok) out.push(`${blNameOf(s, fresh[1])} bowls for ${blNameOf(s, ri)}`);
    }
  }
  // a Knight takes the coach's word for the tenth's first ball
  if (sk === 1 && G.word[s] > 0 && f === blSheetN() - 1 && G.rb[s] === 0 && !G.ro) { G.word[s]--; G.wordOn[s] = true; out.push('the coach\'s word'); }
  if (line !== blLineOf(s) && G.stand[s].length === 10) out.push(BL_LINES[line].n.toLowerCase());
  // (the line is for a first ball: a spare keeps the line the frame began on)
  if (G.stand[s].length === 10) G.line[s] = line;
  G.split[s] = split;
  return out.join(', ');
}
const blNameOf = (s, ri) => (G.teams[s].roster[ri] || {}).n || 'Someone';
// the scout: side s watches the other side's strike balls on each lane: the same stand, ball after ball
function blScoutSee(sBowled, lane, x0) {
  const o = 1 - sBowled, S = G.scout[o], b = blXBoard(x0);
  if (S.lane === lane && S.board != null && Math.abs(S.board - b) <= BL_SCOUT.board) S.same++; else { S.same = 1; S.lane = lane; }
  S.board = +b.toFixed(1);
}
