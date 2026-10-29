/* Cinder Gridiron: the plays (issue #9, phase 1). Four offense plays against three defenses. Nothing here decides who
   wins: the calls only set where everyone goes, and the live play (06-live.js) settles it from the ratings. So the
   rock, paper, scissors of the calls (a blitz beats the deep pass and loses to the screen; a deep zone gives up short
   runs) comes out of the field, and test/realm_gridiron.py measures it.
   Places are [x, y] in yards: x from the line of scrimmage (back is negative), y from the middle of the field.
   A play's set moves players from the usual formation (GF_OFF_SET): on a run the two receivers line up tight beside
   the line and block, so five block against the four defenders near the ball. Routes are waypoints from where the
   receiver lines up. hot: under pressure the quarterback throws at once (the screen expects the rush). */
const GF_OFF_SET = { QB: [-4.5, 0], RB: [-6.5, 1.5], C: [-1, 0], LG: [-1, -2.2], RG: [-1, 2.2], X: [-1, -12], Z: [-1, 12] };
const GF_DEF_SET = { DT: [1, 0], DL: [1, -2.6], DR: [1, 2.6], LB: [5, 0], CL: [6, -12], CR: [6, 12], S: [13, 0] };
const GF_PLAYS = {
  run: { n: 'Run', desc: 'Both receivers come in tight to block, and the back takes a handoff behind them.', kind: 'run', set: { X: [-1, -4.6], Z: [-1, 4.6] } },
  short: { n: 'Short pass', desc: 'Both receivers cut inside; the ball is out in about a second.', kind: 'pass', drop: 1.5, throwAt: 1.1, rb: 'block',
    routes: { X: [[4, 0], [9, 6]], Z: [[4, 0], [9, -6]] } },
  deep: { n: 'Deep pass', desc: 'Both receivers run long. The quarterback needs time to throw.', kind: 'pass', drop: 5, throwAt: 2.4, rb: 'block',
    routes: { X: [[30, 3]], Z: [[30, -3]] } },
  screen: { n: 'Screen', desc: 'Let the rush through, then a short throw to the back out wide, behind the blockers.', kind: 'pass', drop: 4, throwAt: 1.15, rb: 'screen', hot: 1,
    routes: { X: [[7, 0]], Z: [[7, 0]], RB: [[3.5, 7]] }, release: .7 },
};
const GF_DEFS = {
  blitz: { n: 'Blitz', desc: 'The linebacker and the safety creep up, and five come after the quarterback; the corners play man.', rush: ['DT', 'DL', 'DR', 'LB', 'S'], man: { CL: 'X', CR: 'Z' },
    set: { LB: [2, -1.4], S: [3, 1.6] } },
  zone: { n: 'Deep zone', desc: 'Three rush, and four drop deep to keep everything in front of them.', rush: ['DT', 'DL', 'DR'], zone: { LB: [8, 0], CL: [15, -11], CR: [15, 11], S: [22, 0] } },
  man: { n: 'Man to man', desc: 'Three rush, everyone else takes a man, and the safety stays deep.', rush: ['DT', 'DL', 'DR'], man: { CL: 'X', CR: 'Z', LB: 'RB' }, zone: { S: [15, 0] } },
};
// how each call tends to go against each defense (what test/realm_gridiron.py measures), told after the play: +1 a
// good call, -1 a bad one; the rest are even
const GF_EDGE = {
  'run/blitz': [-1, 'Five rushers fill every gap at the line.'], 'run/zone': [1, 'Only three rush, and the zone sits deep: room to run.'],
  'deep/blitz': [-1, 'The rush gets home before the long routes open.'], 'deep/man': [1, 'One on one down the field, and the safety alone deep.'],
  'screen/blitz': [1, 'The rush runs past the back, and the blockers are out in front.'], 'screen/man': [-1, 'The linebacker is on the back.'],
  'short/blitz': [1, 'The ball is out before the rush arrives.'],
};
const gfEdge = (oc, dc) => GF_EDGE[oc + '/' + dc] || [0, ''];
const GF_OFF_IDS = Object.keys(GF_PLAYS), GF_DEF_IDS = Object.keys(GF_DEFS);
// a call's formation: the usual one, with the call's own set on top (a defense's too: the blitz creeps up)
const gfSet = oc => Object.assign({}, GF_OFF_SET, (GF_PLAYS[oc] || {}).set);
const gfDefSet = dc => Object.assign({}, GF_DEF_SET, (GF_DEFS[dc] || {}).set);
