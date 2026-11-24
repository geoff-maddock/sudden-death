/* w139: the frozen deep at the Curling Shed (issue #108). Old Grey, a great pike, lives under the Shed's ice
   (src/cr/parts/16-deep.js), and shows himself in wild matches only: a club match from Hennock's MATCH or the Shed tab
   (wStartShed with no cup), about one in W_DEEP.p, Play, Manage and Simulate alike. Never in the Brass Broom, a league
   fixture or the Umbral (they start with cup), nor in the exhibition and practice (they don't go through wStartShed).
   A match kept between stones keeps him (he is in the engine's game, G.deep).
   WDEEP.next   the match being started has him (set round wStartShed, read by the engine's start and simGame)
   Wraps: wStartShed (wW139StartShed: the roll), wCR.start and wCR.simGame (wW139Start, wW139SimGame: deep in),
   wShedHowHTML (wW139ShedHow: Old Grey in full, in How to play's Curling: how it works), renderHelp (wW139RenderHelp:
   #wHelpShedDeep after #wHelpShedGame, a line that points there). */

const W_DEEP = { p: 1 / 3,
  line: 'Some club matches have a great pike under the ice, who nudges stones: see Curling: how it works.',
  help: 'Old Grey. In some club matches (never a cup or a league fixture) Hennock says Old Grey, a great pike, is under the ice. He lies in the far end, and the ice over him runs keen: a stone crossing it slides further and curls less. After every stone he swims to his next spot, shown as a dashed ring, and nudges any stone lying there a few inches away from him, never off the sheet. Read him and play round him, or let him carry your stone in.' };
const WDEEP = { next: false };
const wW139StartShed = wStartShed;
wStartShed = function (o) {
  WDEEP.next = !!o && !o.cup && Math.random() < W_DEEP.p;
  try { return wW139StartShed(o); } finally { WDEEP.next = false; }
};
const wW139Start = wCR.start, wW139SimGame = wCR.simGame;
wCR.start = o => wW139Start(WDEEP.next ? Object.assign({}, o, { deep: true }) : o);
wCR.simGame = o => wW139SimGame(WDEEP.next ? Object.assign({}, o, { deep: true }) : o);
const wW139ShedHow = wShedHowHTML;
wShedHowHTML = function () { return wW139ShedHow() + `<p class="hint"><b>${esc(W_DEEP.help.split('. ')[0])}.</b> ${esc(W_DEEP.help.split('. ').slice(1).join('. '))}</p>`; };
const wW139RenderHelp = renderHelp;
renderHelp = function () {
  wW139RenderHelp();
  const after = $('wHelpShedGame'); if (!after || $('wHelpShedDeep')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedDeep"><b>Old Grey.</b> ${esc(W_DEEP.line)}</p>`);
};
