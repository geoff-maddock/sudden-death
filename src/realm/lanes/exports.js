/* the end of the wBL scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ frames, order: [two orders of five], roster: [two roster sizes], lead }); up (whose ball it is), bowler (who
   bowls a side's frame now), standing (its pins), roll(side, pins) (the pins that fell, or how many; says what
   happened, and whether the frame and the game are decided), whyNot; score(frames, n) and done(frame, tenth) are
   ten-pin's scoring on any sheet, isSplit(standing) the split rule and adj the pins that touch; total, marks (the
   sheet), lane (the lane of a frame), frameNo, rerack and pinch (once a game each, before a frame's first ball), and
   matchText (the game from a side's point of view). G is the game, plain JSON. The page comes in phase 2: until then
   the lanes are never on. */
return {
  rules: JSON.parse(JSON.stringify(BL_RULES)), adj: BL_ADJ.map(p => p.slice()), get G() { return G; },
  newGame: o => blNewGame(o), up: () => blUp(), bowler: s => blBowler(s), standing: s => G ? G.stand[s].slice() : [],
  roll: (s, p) => blRoll(s, p), whyNot: s => blWhyNot(s),
  score: (frames, n) => blScore(frames, n), done: (fr, tenth) => blFrameDone(fr, !!tenth), isSplit: st => blIsSplit(st), frameMarks: fr => blFrameMarks(fr),
  total: s => blTotal(s), marks: s => blMarks(s), lane: (s, f) => blLane(s, f), frameNo: s => blFrameNo(s),
  rerack: s => blRerack(s), pinch: (s, ri) => blPinch(s, ri), matchText: s => blMatchText(s),
  show: () => {}, hide: () => {}, get on() { return false; }
};
