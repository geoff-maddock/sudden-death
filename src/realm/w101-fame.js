/* w101: a household name (issue #79, phase 6). Loads after w100-stand.js; changes earlier parts only by reassignment
   (saved originals carry the wW101 prefix).

   The top step of your following (W_FOLLOW.at[3] fans) opens doors:
     - the taverns' free agents ask W_FAME.agent of their fee (a quarter off), for the agents on this week's list;
     - cup entry fees are waived: the town cups (w11), the Diamond Cup (w20e) and the four engine cups (w45b);
     - a rival club that bids for one of your players offers W_FAME.bid times as much (half as much again).
   Spend your fans back under the step and the fees and bids are as they were (a tavern's list keeps its price for
   the week it was drawn).

   The cups read their fee from their own table wherever they show or charge it, so the waiver is made there once:
   each table's `fee` is read through W_FAME (0 while you are a household name, its own number otherwise; setting it
   still sets the number). Not in LAB mode unless the lab asks.
   W_FAME, wFameOn()
   Wrapped: wTavern (wW101Tavern), W_LEAGUE.fee (wW101BidFee), renderHelp (wW101RenderHelp: #wHelpFame). */

const W_FAME = { agent: .75, bid: 1.5, cups: [W_CUP, W_DCUP, W_GCUP, W_BCUP, W_NET, W_KETTLE] };
W_FOLLOW.live[4] = true;
function wFameOn() { return wFollowOn(4); }
for (const T of W_FAME.cups) {
  let fee = T.fee;
  Object.defineProperty(T, 'fee', { enumerable: true, configurable: true, get: () => wFameOn() ? 0 : fee, set: v => { fee = v; } });
}
const wW101Tavern = wTavern;
wTavern = function (town) {
  const T = wW101Tavern(town);
  if (T.wfame || !wFameOn()) return T;
  T.wfame = 1;
  for (const a of T.list) a.fee = Math.round(a.fee * W_FAME.agent);
  return T;
};
const wW101BidFee = W_LEAGUE.fee;
W_LEAGUE.fee = lvl => Math.round(wW101BidFee(lvl) * (wFameOn() ? W_FAME.bid : 1));

const wW101RenderHelp = renderHelp;
renderHelp = function () {
  wW101RenderHelp();
  const h = $('wHelpFollow'); if (!h || $('wHelpFame')) return;
  h.insertAdjacentHTML('beforeend', ` <span id="wHelpFame"><b>A household name</b> (${W_FOLLOW.at[3]} fans): free agents at the taverns ask a quarter less, cup entry fees are waived, and a rival club that bids for one of your players offers half as much again.</span>`);
};
