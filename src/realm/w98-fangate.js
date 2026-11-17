/* w98: what a following does in the card game (issue #79, phase 2): the gate and the away end. Loads after
   w97-following.js; changes earlier parts only by reassignment (saved originals carry the wW98 prefix).

   The gate (a few regulars, 100 fans): at every card match at a ground (a Friendly, a Challenge, a league fixture) your
   fans pay in: 1 gold for every W_FANS.per fans, up to W_FANS.cap a match, half as much again once you have a
   travelling army (W_FANS.big), doubled where the match is at home. Win or lose. It is on top of the ground's own gate (w36), which a win
   takes.
   The away end (a supporters' club, 400 fans): your fans travel. W_FANS.block Block at kickoff in any card match
   away from home. The Loved crowd (w31) gives more and they don't stack: where that crowd is yours, it is the one
   you get. At home you already have the home crowd (w14).

   Neither runs in LAB mode unless the lab asks (W_FOLLOW.lab): the bots measure the game with and without.
   W_FANS, wFollowOn(step), wFanGate(W), wFanAway(W)
   Wrapped: wDispatchEnd (wW98DispatchEnd: the gate), wPreGame (wW98PreGame: a line on the card), wOpenGrdCard
   (wW98OpenGrdCard: what your fans add), renderHelp (wW98RenderHelp: #wHelpFanGate). A fightStart hook brings the
   away end. */

const W_FANS = { per: 25, cap: 20, big: 1.5, home: 2, block: 3 };
W_FOLLOW.lab = false;
W_FOLLOW.live[1] = W_FOLLOW.live[2] = true;
// is this step's effect on now? (you have the step, and this isn't a bot run that didn't ask for it)
function wFollowOn(step) { return !W_FOLLOW.off && (!LAB || W_FOLLOW.lab) && wFollowStep() >= step; }
// the gold your fans pay in at this match (0 unless it is a card match at a ground and you have a few regulars)
function wFanGate(W) {
  if (!W || W.kind !== 'ground' || !wFollowOn(1)) return 0;
  const n = Math.min(W_FANS.cap, Math.floor(wFans() / W_FANS.per));
  return Math.round(n * (wFollowStep() >= 3 ? W_FANS.big : 1) * (wIsHome(W) ? W_FANS.home : 1));
}
// do your travelling fans lift you at this match? (away from home, and not where the Loved crowd already does)
function wFanAway(W) { return !!W && wFollowOn(2) && !wIsHome(W) && !wRepCrowd(W); }

const wW98DispatchEnd = wDispatchEnd;
wDispatchEnd = function (W, r) {
  // worked out before the result adds fans, so it is what the cards said
  const gold = wFanGate(W);
  wW98DispatchEnd(W, r);
  if (gold) wLog(`Your fans at the gate: ${gainGold(gold)} gold${wIsHome(W) ? ', a home crowd' : ''}.`, 'g');
};
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!WG || !B || !wFanAway(W)) return;
  B.P.block += W_FANS.block; B.wAway = 1;
  log(`The away end is full: ${W_FANS.block} Block.`, 'good');
});

const wW98PreGame = wPreGame;
wPreGame = function (enc) {
  wW98PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'), W = enc.world; if (!box || !W) return;
  const gold = wFanGate(W), bits = [];
  if (wFanAway(W)) bits.push(`your fans have travelled, ${W_FANS.block} Block at kickoff`);
  if (gold) bits.push(`they pay ${gold} gold at the gate, win or lose`);
  if (bits.length) box.insertAdjacentHTML('beforeend', `<p class="hint wfansline">${esc(wFollowName())}: ${bits.join('; ')}.</p>`);
};
const wW98OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW98OpenGrdCard(id, msg);
  const list = document.querySelector('#modalBox .wbclubs'), g = wGrd(id); if (!list || !g || g.sport === 'baseball') return;
  const gold = wFanGate({ kind: 'ground', region: W_GRD_REG[g.city] }); if (!gold) return;
  list.insertAdjacentHTML('beforebegin', `<p class="hint wfansline">${esc(wFollowName())}: your fans add ${gold} gold at the gate of every match here, win or lose.</p>`);
};

const wW98RenderHelp = renderHelp;
renderHelp = function () {
  wW98RenderHelp();
  const h = $('wHelpFollow'); if (!h || $('wHelpFanGate')) return;
  h.insertAdjacentHTML('beforeend', ` <span id="wHelpFanGate"><b>The gate</b> (${W_FOLLOW.at[0]} fans): at every card match at a ground your fans pay in 1 gold for every ${W_FANS.per} of them, up to ${W_FANS.cap} a match, half as much again with a travelling army, doubled at home, win or lose. <b>The away end</b> (${W_FOLLOW.at[1]} fans): ${W_FANS.block} Block at kickoff in any card match away from home, unless the crowd there is already yours.</span>`);
};
