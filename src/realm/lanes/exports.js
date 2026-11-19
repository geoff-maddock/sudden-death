/* the end of the wBL scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newGame(opts) starts a
   game ({ frames, order: [two orders of five], roster: [two roster sizes], lead }); up (whose ball it is), bowler (who
   bowls a side's frame now), standing (its pins), roll(side, pins) (the pins that fell, or how many; says what
   happened, and whether the frame and the game are decided), whyNot; score(frames, n) and done(frame, tenth) are
   ten-pin's scoring on any sheet, isSplit(standing) the split rule and adj the pins that touch; total, marks (the
   sheet), lane (the lane of a frame), frameNo, rerack and pinch (once a game each, before a frame's first ball), and
   matchText (the game from a side's point of view). G is the game, plain JSON.
   Phase 1 is the lane, the ball, the pins and one game, CPU against CPU: geo (the lane's geometry), spots (each pin's),
   house() a fresh oil pattern, oilAt, mu and wear(oil, path) the oil and how a ball moves it, tides; ball(throw, oil,
   tide) the pure ball model and aimAt(throw, x, oil, tide) the angle that reaches x at the pins; deck(standing,
   ball, seed) the pure, seeded pins; groups(standing), spareTarget(pins), skills, style() and plan(side) the CPU's
   ball; start(opts) puts a game on the lanes ({ frames, teams, order, skill: [2], tide, seed, lead }), turn() bowls
   the next ball, summary() is the game so far, and simGame(opts) plays a whole one headless, leaving the game on the
   lanes as it was.
   Phase 2 is the page and bowling by hand: start(opts) also puts the game on show ({ mode: 'watch' | 'play' }), and
   show, hide, on, pause, paused, speed and render drive the canvas (n1-page.js). The beat: phase, msg, view (a copy of
   what the page needs), tick(dt) (the tests move the game on by hand). Your ball: select({ stand, arrow, ball, revs,
   suggest }), press (Space), drag(pull, deg) (the phone's throw), setMode; guide (a perfect ball's path on a fresh
   lane), swingNums and meterRules are the numbers behind the meter; scr and unscr map the lane to the picture and
   back, ovScr the overhead strip. onPhase, onPick and onOver hear a new beat, a change to your ball and the end.
   Phase 3 is ratings, the order's roles, arm and nerve: stats (the six, in order), rate(kind) (1 to 12), cap, roles
   (each slot of the order's role), fit(r, role) (r 0 to 1), autoOrder(roster), arm (G.arm), pressure(side),
   armRules. A roster bowler may bring r (1 to 12) and hand; a team may bring its order.
   Phase 4 is the call and the read: lines, stanceRules, line(s), split(s), stance(s), word, wordOn, scout, cpuCall(s),
   readFt(s) (how far down the lane side s's bowler reads the oil now), turnBall(s), splitMakeable(standing),
   trackDry(lane, hand), tracks (every ball's track this game, by lane), chart(canvas, side) (draws the lane chart on a
   canvas of its own). select also takes { line, split, tempo, weight, word, pinch }; onChart hears C.
   Phase 5 is games from the world: modes add manage (manage({ line, tempo, weight }), each 'auto' or a choice; mgr),
   snapshot() and resume(sn) (a match between balls, plain JSON), the box score (G.pst: each bowler's frames, balls,
   strikes, spares, pins and splits; summary() carries it), and the hall (start({ hall: true }); hallRules, offspot,
   tideTurn: the tide under the floor, Moll's off-spot racks, the swell, the gutter crabs, the gull and the Brinepup;
   select also takes { rerack: true }). */
return {
  rules: JSON.parse(JSON.stringify(BL_RULES)), adj: BL_ADJ.map(p => p.slice()), get G() { return G; },
  newGame: o => blNewGame(o), up: () => blUp(), bowler: s => blBowler(s), standing: s => G ? G.stand[s].slice() : [],
  roll: (s, p) => blRoll(s, p), whyNot: s => blWhyNot(s),
  score: (frames, n) => blScore(frames, n), done: (fr, tenth) => blFrameDone(fr, !!tenth), isSplit: st => blIsSplit(st), frameMarks: fr => blFrameMarks(fr),
  total: s => blTotal(s), marks: s => blMarks(s), lane: (s, f) => blLane(s, f), frameNo: s => blFrameNo(s),
  rerack: s => blRerack(s), pinch: (s, ri) => blPinch(s, ri), matchText: s => blMatchText(s),
  // the lane, the ball, the pins and one game (phase 1)
  geo: JSON.parse(JSON.stringify(BL_LANE)), spots: JSON.parse(JSON.stringify(BL_SPOT)), tides: Object.assign({}, BL_TIDE), oilRules: Object.assign({}, BL_OIL),
  ballRules: Object.assign({}, BL_BALL), pinRules: Object.assign({}, BL_PIN), skills: JSON.parse(JSON.stringify(BL_SKILL)), pocket: BL_POCKET,
  house: n => blHouse(n), oilAt: (oil, x, y) => blOilAt(oil, x, y), mu: (oil, x, y, tide) => blMu(oil, x, y, tide), wear: (oil, path) => blWear(oil, path),
  boardX: b => blBoardX(b), xBoard: x => blXBoard(x), ball: (t, oil, tide) => blBall(t, oil, tide), aimAt: (t, x, oil, tide) => blAimAt(t, x, oil, tide),
  deck: (st, b, seed, spots) => blDeck(st, b, seed, spots), groups: st => blGroups(st), spareTarget: p => blSpareTarget(p), style: () => blStyle(),
  plan: s => G && G.oil ? blPlan(s) : null, start: o => { blStart(o); blPlayStart(o); return G; }, turn: () => blTurn(), summary: () => blSummary(), simGame: o => blSimGame(o),
  // ratings, the order's roles, arm and nerve (phase 3)
  stats: BL_STATS.slice(), rate: k => blRate(k), cap: BL_RCAP, roles: BL_ROLES.slice(), fit: (r, role) => blFit(r, role), armRules: Object.assign({}, BL_ARM),
  autoOrder: ro => blAutoOrder(ro.map(m => ({ rs: Object.fromEntries(BL_STATS.map(k => [k, blScale((m.r || blRate(m.kind))[k])])) }))),
  get arm() { return G && G.arm ? G.arm.map(a => a.slice()) : null; }, pressure: s => G && G.arm ? blPressure(s) : 0,
  // the call and the read (phase 4)
  lines: JSON.parse(JSON.stringify(BL_LINES)), stanceRules: JSON.parse(JSON.stringify(BL_STANCE)), line: s => G && G.line ? G.line[s] : null, split: s => G && G.split ? G.split[s] : null,
  stance: s => G && G.stance ? Object.assign({}, G.stance[s]) : null, get word() { return G && G.word ? G.word.slice() : null; }, get wordOn() { return G && G.wordOn ? G.wordOn.slice() : null; },
  get scout() { return G && G.scout ? JSON.parse(JSON.stringify(G.scout)) : null; }, cpuCall: s => blCpuCall(s), readFt: s => G && G.arm ? blReadFt(s) : 0, turnBall: s => G && G.arm ? blTurnBall(s) : false,
  splitMakeable: st => blSplitMakeable(st), trackDry: (lane, hand) => blTrackDry(lane, hand), get tracks() { return GP && GP.tracks ? JSON.parse(JSON.stringify(GP.tracks)) : [[], []]; },
  chart: (cv, s) => { const c = cv.getContext('2d'), w = cv.width, h = cv.height; blChart(c, s == null ? (GP ? GP.you : 0) : s, w, h); }, set onChart(f) { BL_HOOK.onChart = f; }, get onChart() { return BL_HOOK.onChart; },
  // games from the world (phase 5)
  manage: o => blManage(o), get mgr() { return GP ? Object.assign({}, GP.mgr) : null; }, snapshot: () => blSnapshot(), resume: sn => blResume(sn),
  hallRules: Object.assign({}, BL_HALL), get offspot() { return G && G.offspot ? JSON.parse(JSON.stringify(G.offspot)) : null; }, get tideTurn() { return G && G.tideTurn ? Object.assign({}, G.tideTurn) : null; },
  get tide() { return G ? G.tide : null; }, hallAfter: (s, stand, ball, down) => blHallAfter(s, stand, ball, down),
  // the page and bowling by hand (phase 2)
  modes: BL_MODES.slice(), meterRules: Object.assign({}, BL_METER), revs: Object.assign({}, BL_REVS), get phase() { return GP ? GP.ph : null; }, get msg() { return GP ? GP.msg : ''; },
  get view() { return blView(); }, get mode() { return GP ? GP.mode : null; }, setMode: m => blSetMode(m), tick: dt => blTick(dt), select: o => blSelect(o), press: () => blPress(),
  drag: (pull, deg) => blDrag(pull, deg), guide: () => blGuide(), swingNums: () => blSwingNums(), scr: (x, y) => blScr(x, y), unscr: (sx, sy) => blUnscr(sx, sy), ovScr: (x, y) => [blOvX(x), blOvY(y)],
  get last() { return GP && GP.last ? JSON.parse(JSON.stringify(GP.last)) : null; },
  set onPhase(f) { BL_HOOK.onPhase = f; }, set onPick(f) { BL_HOOK.onPick = f; }, set onOver(f) { BL_HOOK.onOver = f; }, get onPhase() { return BL_HOOK.onPhase; }, get onPick() { return BL_HOOK.onPick; }, get onOver() { return BL_HOOK.onOver; },
  show: () => blShow(), hide: () => blHide(), get on() { return BLP.on; }, render: () => blRender(0),
  pause: on => { BLP.paused = !!on; }, get paused() { return BLP.paused; }, get speed() { return BLP.speed; }, set speed(n) { BLP.speed = clamp(Math.round(n) || 1, 1, 8); }
};
