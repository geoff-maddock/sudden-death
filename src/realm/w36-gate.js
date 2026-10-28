/* w36: gate money at the grounds (issue #6, open question 4). Loads after w35-legends.js; changes earlier parts only by
   reassignment (saved originals carry the wW36 prefix).

   A game at a ground costs nothing to play. Win one and you take the gate on top of the match's usual rewards:
   W_TAKE.per gold a tier for the game you played (a Friendly at the region's tier, a Challenge a tier up), times the
   crowd your name in the region brings in (W_TAKE.name, by step: Unknown, Known, Liked, Loved). A loss takes no gate.
   The Ballpark's ball games keep their own purse (w20d), so the gate is for the card-game grounds only.

   W_TAKE, wTake(id, mode) (the gold a win there would take today)
   Wrapped: W_ON_END.ground (wW36GrdEnd: the gate on a win), wOpenGrdCard (what a win takes, on the keeper's card),
   wPreGame (the line on the pre-game card), renderHelp (a sentence in #wHelpGrdPlay). */

const W_TAKE = { per: { friendly: 5, challenge: 6 }, name: [1, 1.25, 1.5, 2], off: false };
function wTake(id, mode) {
  const g = wGrd(id); if (!g || g.sport === 'baseball' || W_TAKE.off) return 0;
  const step = typeof wRepStep === 'function' ? wRepStep(W_GRD_REG[g.city]) : 0;
  return Math.round((W_TAKE.per[mode] || W_TAKE.per.friendly) * wGrdTier(id, mode) * W_TAKE.name[step]);
}
function wTakeCrowd(id) {
  const g = wGrd(id), step = g && typeof wRepStep === 'function' ? wRepStep(W_GRD_REG[g.city]) : 0;
  return step ? ` Your name here is ${W_REP.names[step]}, so the crowd is bigger.` : '';
}

const wW36GrdEnd = W_ON_END.ground;
W_ON_END.ground = function (r, ref, W) {
  // the gate is worked out before the win adds to your name, so it is what the cards said
  const gold = r === 'win' && ref ? wTake(ref.g, ref.mode || 'friendly') : 0;
  wW36GrdEnd(r, ref, W);
  if (!gold) return;
  wLog(`The gate at ${wGrd(ref.g).name.replace(/^The /, 'the ')}: ${gainGold(gold)} gold.`, 'g');
};

const wW36OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW36OpenGrdCard(id, msg);
  const list = document.querySelector('#modalBox .wbclubs'), g = wGrd(id); if (!list || !g || W_TAKE.off) return;
  list.insertAdjacentHTML('beforebegin', `<p class="hint wgate">No fee to play. Win and you take the gate: <b>${wTake(id, 'friendly')} gold</b> for the Friendly, <b>${wTake(id, 'challenge')} gold</b> for the Challenge.${esc(wTakeCrowd(id))}</p>`);
};

const wW36PreGame = wPreGame;
wPreGame = function (enc) {
  wW36PreGame(enc);
  const W = enc.world, line = document.querySelector('#modalBox .wpground');
  if (!line || W.kind !== 'ground' || !W.ref) return;
  const gold = wTake(W.ref.g, W.ref.mode || 'friendly');
  if (gold) line.insertAdjacentHTML('beforeend', ` Win, and the gate is ${gold} gold.`);
};

const wW36RenderHelp = renderHelp;
renderHelp = function () {
  wW36RenderHelp();
  const h = $('wHelpGrdPlay'); if (!h || $('wHelpGate')) return;
  h.insertAdjacentHTML('beforeend', ` <span id="wHelpGate">A game costs nothing to play. Win one and you take the gate as well as the match's rewards: ${W_TAKE.per.friendly} gold a tier for a Friendly and ${W_TAKE.per.challenge} for a Challenge, a quarter more where your name is Known, half as much again where you are Liked, and double where you are Loved.</span>`);
};
