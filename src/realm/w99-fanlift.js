/* w99: what a following does in the engines (issue #79, phase 3): the away end and the late lift on the ice, the court,
   the gridiron and in the ring. Loads after w98-fangate.js; changes earlier parts only by reassignment (saved
   originals carry the wW99 prefix).

   A supporters' club travels: at a game away from home your side starts with a little more (10 spirit in hockey,
   basketball and boxing, a mana in football; each engine's own number, its *_FANS table). A travelling army
   sings all game: the same again, once, if you are behind going into the last period, quarter or round (the second
   half in football). It goes to the engine as a plain start value, opts.fans [yours, 0]: nobody's ratings change,
   the other side gets none, and Simulate gets it too. It needs the engine's powers to be on (it is spirit and mana).

   A game is away unless its ground is in your home ground's region. Each engine has one ground: the Pond Rink, the
   Charter Court, the Ash Bowl and the Anvil Ring (W_FAN_GRD).

   The world's start functions build their own options, so this part does what the kit parts do (w73): it marks that a
   world game is being started (W_FAN_NEXT) and the engine's start and simulate calls made meanwhile take the value.
   W_FAN_GRD, wFanLift(sport) (0, 1 or 2)
   Wrapped: wStartRink, wStartCourt, wStartGrid and wRingGo (wW99…: the mark), wHK.start and simGame, wBK.start and
   simGame, wGF.start, game and simGame, wBX.cardStart and simCard (the value goes in), renderHelp (wW99RenderHelp:
   #wHelpFanLift). */

const W_FAN_GRD = { hockey: 'g_rink', basketball: 'g_court', football: 'g_bowl', boxing: 'g_ring' };
let W_FAN_NEXT = null;
W_FOLLOW.live[3] = true;
// what your fans bring to a game of this sport today: 0 nothing, 1 the away end, 2 and the late lift
function wFanLift(sport) {
  const g = wGrd(W_FAN_GRD[sport]); if (!g) return 0;
  if (wIsHome({ kind: 'ground', region: W_GRD_REG[g.city] })) return 0;
  return wFollowOn(3) ? 2 : wFollowOn(2) ? 1 : 0;
}
function wFanMark(sport, fn) {
  const n = wFanLift(sport);
  if (!n) return fn();
  W_FAN_NEXT = { fans: [n, 0], said: false };
  try { return fn(); } finally { W_FAN_NEXT = null; }
}
// the engine call takes the value (once said, the log has it)
function wFanOpts(o) {
  if (!W_FAN_NEXT) return o;
  if (!W_FAN_NEXT.said) { W_FAN_NEXT.said = true; wLog(W_FAN_NEXT.fans[0] >= 2 ? 'Your travelling army is in the away end, and will sing all game.' : 'Your supporters\' club is in the away end.', 'g'); }
  return Object.assign({}, o, { fans: W_FAN_NEXT.fans.slice() });
}

const wW99StartRink = wStartRink; wStartRink = function (o) { return wFanMark('hockey', () => wW99StartRink.call(this, o)); };
const wW99StartCourt = wStartCourt; wStartCourt = function (o) { return wFanMark('basketball', () => wW99StartCourt.call(this, o)); };
const wW99StartGrid = wStartGrid; wStartGrid = function (o) { return wFanMark('football', () => wW99StartGrid.call(this, o)); };
const wW99RingGo = wRingGo; wRingGo = function (o, mine, theirs, picks) { return wFanMark('boxing', () => wW99RingGo.call(this, o, mine, theirs, picks)); };

const wW99HkStart = wHK.start, wW99HkSim = wHK.simGame; wHK.start = o => wW99HkStart(wFanOpts(o)); wHK.simGame = o => wW99HkSim(wFanOpts(o));
const wW99BkStart = wBK.start, wW99BkSim = wBK.simGame; wBK.start = o => wW99BkStart(wFanOpts(o)); wBK.simGame = o => wW99BkSim(wFanOpts(o));
const wW99GfStart = wGF.start, wW99GfGame = wGF.game, wW99GfSim = wGF.simGame; wGF.start = o => wW99GfStart(wFanOpts(o)); wGF.game = o => wW99GfGame(wFanOpts(o)); wGF.simGame = o => wW99GfSim(wFanOpts(o));
const wW99BxCard = wBX.cardStart, wW99BxSim = wBX.simCard; wBX.cardStart = o => wW99BxCard(wFanOpts(o)); wBX.simCard = o => wW99BxSim(wFanOpts(o));

const wW99RenderHelp = renderHelp;
renderHelp = function () {
  wW99RenderHelp();
  const h = $('wHelpFollow'); if (!h || $('wHelpFanLift')) return;
  h.insertAdjacentHTML('beforeend', ` <span id="wHelpFanLift"><b>In hockey, basketball, football and boxing</b> the away end is a little more to start a game away from home: ${wHK.fansRules.spirit} spirit (${wGF.fansRules.mana} mana in football). <b>They sing all game</b> (${W_FOLLOW.at[2]} fans): the same again, once, if you are behind going into the last period, quarter or round (the second half in football). Simulate gets both.</span>`);
};
