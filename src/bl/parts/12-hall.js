/* The Saltmere Lanes: the hall (issue #100, phase 5). The things only these lanes have, on when a game starts with
   { hall: true } (every game from the Realm; the labs and phase 1's numbers play without, unless they ask). All of it
   is drawn from R, so a seeded game plays the same.
   - The tide is under the floor. A game starts on the Realm's tide (high, mid or low), and it may turn once, after a
     frame in the middle of the game (G.tideTurn): the lamps sway on their chains, and the lanes play heavier or drier
     for both sides from then on.
   - Moll Gutter sets the pins by hand. Now and then a fresh rack has one pin off its spot by an inch or two
     (G.offspot, a side's: { n, dx, dy }), which makes the hit easier or harder. The re-rack sets it right (once a game,
     before a frame's first ball). A Knight calls it when the headpin is off; an Archmage whenever a pin is.
   - A swell: the sea booms under the floor, and a pin the ball left standing beside one that fell may wobble and go
     before the sweep comes down. It counts.
   - The gutter crabs: very rarely, a ball rolling down the gutter clips one and comes back onto the lane, for the
     corner pin on that side, if it stands.
   - The gull: sometimes it comes in through the high window and knocks a pin the ball left standing.
   - The Brinepup lives in the pit and barks at a pin left standing; and the gallery chants for a turkey on the ball
     after a double. Words only: they change nothing. */
const BL_HALL = { off: .12, offIn: [1.2, 2.4], swell: .035, crab: .07, gull: .012, pup: .35, turn: .5, turnAt: [3, 6] };
const BL_TIDE_NEXT = { low: 'mid', mid: 'high', high: 'mid' };

// a game's hall: the tide's turn (if it turns), and the first racks
function blHallStart(o) {
  if (!o || !o.hall) { G.hall = false; return; }
  G.hall = true;
  G.tideTurn = R() < BL_HALL.turn ? { at: BL_HALL.turnAt[0] + Math.floor(R() * (BL_HALL.turnAt[1] - BL_HALL.turnAt[0] + 1)), to: o.tideTo && BL_TIDE[o.tideTo] ? o.tideTo : BL_TIDE_NEXT[G.tide], done: false } : null;
  G.offspot = [null, null];
  blHallRack(0); blHallRack(1);
}
// a fresh rack in front of side s: Moll's hand, a pin off its spot now and then
function blHallRack(s) {
  if (!G.hall) return;
  if (R() >= BL_HALL.off) { G.offspot[s] = null; return; }
  const n = 1 + Math.floor(R() * 10), a = R() * Math.PI * 2, d = BL_HALL.offIn[0] + R() * (BL_HALL.offIn[1] - BL_HALL.offIn[0]);
  G.offspot[s] = { n, dx: +(Math.cos(a) * d).toFixed(2), dy: +(Math.sin(a) * d).toFixed(2) };
}
// the spots of side s's rack, with Moll's off-spot pin (null when all are true)
function blHallSpots(s) {
  const O = G.hall && G.offspot && G.offspot[s]; if (!O || !G.stand[s].includes(O.n)) return null;
  const sp = BL_SPOT[O.n]; return { [O.n]: [sp[0] + O.dx, sp[1] + O.dy] };
}
// after the ball and the pins: the crab, the swell and the gull may change what fell. Returns { down, said }
function blHallAfter(s, stand, ball, down) {
  if (!G.hall) return { down, said: '' };
  let out = down.slice(), said = '';
  const left = () => stand.filter(p => !out.includes(p));
  if (ball.gutter !== null) {
    const corner = ball.path.length && ball.path[ball.path.length - 1][0] > 0 ? 7 : 10;
    if (R() < BL_HALL.crab && stand.includes(corner)) { out.push(corner); said = `A gutter crab clips the ball back onto the lane: the ${corner} goes!`; }
    return { down: out, said };
  }
  const L = left();
  if (L.length && out.length && R() < BL_HALL.swell) {
    const near = L.filter(p => BL_ADJ.some(([a, b]) => (a === p && out.includes(b)) || (b === p && out.includes(a))));
    if (near.length) { const p = near[Math.floor(R() * near.length)]; out.push(p); said = `The sea booms under the floor. The ${p} wobbles… and goes, before the sweep!`; }
  }
  const L2 = left();
  if (!said && L2.length && R() < BL_HALL.gull) { const p = L2[Math.floor(R() * L2.length)]; out.push(p); said = `A gull swoops in through the high window and knocks over the ${p}!`; }
  const L3 = left();
  if (!said && L3.length === 1 && R() < BL_HALL.pup) said = `The Brinepup in the pit barks at the ${L3[0]}.`;
  return { down: out.sort((a, b) => a - b), said };
}
// when both sides have finished the frame the tide turns at, it turns
function blHallTide() {
  const T = G.hall && G.tideTurn; if (!T || T.done || G.ro) return '';
  if (blDone(0) < T.at || blDone(1) < T.at) return '';
  T.done = true; const was = G.tide; G.tide = T.to;
  return `The tide turns under the floor and the lamps sway on their chains: the lanes play ${BL_TIDE[T.to] > BL_TIDE[was] ? 'heavier' : 'drier'} now.`;
}
// the CPU's re-rack: a Knight when the headpin is off its spot, an Archmage whenever a pin is
function blHallRerackCall(s) {
  const O = G.hall && G.offspot && G.offspot[s]; if (!O || G.rerack[s] || G.stand[s].length < 10 || G.rb[s]) return '';
  const sk = G.skill[s]; if (sk === 0 || (sk === 1 && O.n !== 1)) return '';
  if (blRerack(s).ok) { G.offspot[s] = null; return `a re-rack (the ${O.n} was off its spot)`; }
  return '';
}
