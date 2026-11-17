/* the end of the wGL scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ holes, pars, honour }); hitters and canHit (who may hit for a side), away (who plays next, from the two
   distances to the hole), stroke, drop, holed and concede (each returns what happened, and whether the hole and the
   match are decided), matchText (the match from a side's point of view), parOf and holeNo. G is the game, plain JSON.
   There is no page yet: show and hide do nothing, and on is always false, so W_ENGINES can list it. */
return {
  rules: JSON.parse(JSON.stringify(GL_RULES)), get G() { return G; },
  newGame: o => glNewGame(o), pars: n => glPars(n), parOf: h => glParOf(h), holeNo: () => glHoleNo(),
  hitters: s => glHitters(s), canHit: (s, ri) => glCanHit(s, ri), away: d => glAway(d),
  stroke: (s, ri) => glStroke(s, ri), drop: s => glDrop(s), holed: s => glHoled(s), concede: s => glConcede(s),
  holeState: () => glHoleState(), up: () => glUp(), left: () => glLeft(), matchText: s => glMatchText(s),
  show: () => {}, hide: () => {}, get on() { return false; },
};
