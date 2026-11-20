/* the end of the wCR scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ ends: 4 | 6 | 8, order: [two orders of four], roster: [two roster sizes], hammer: the side with the first
   end's hammer, fgz: false for no free guard zone }); up (whose stone it is), thrower (who throws side s's stone now),
   pos (their position, 0 lead to 3 skip), sideNo (side s's stone number this end), throw(side, after) (the stones in
   play once it stopped; applies the free guard zone, scores the end after its sixteenth stone, and says so), whyNot;
   scoreEnd(stones), inHouse, inFgz, inPlay and dist read where stones are; total, board (the scoreboard), matchText.
   rules and sheet are the tables. G is the game, plain JSON. The page comes in phase 2: until then the shed is never
   on. */
return {
  rules: JSON.parse(JSON.stringify(CR_RULES)), sheet: JSON.parse(JSON.stringify(CR_SHEET)), get G() { return G; },
  newGame: o => crNewGame(o), up: () => crUp(), thrower: s => crThrower(s), pos: s => crPos(s), sideNo: s => crSideNo(s),
  throw: (s, after) => crThrow(s, after), whyNot: s => crWhyNot(s),
  scoreEnd: st => crScoreEnd(st), inHouse: st => crInHouse(st), inFgz: st => crInFgz(st), inPlay: st => crInPlay(st), dist: st => crDist(st),
  total: s => crTotal(s), board: () => crBoard(), matchText: s => crMatchText(s),
  show: () => {}, hide: () => {}, get on() { return false; }
};
