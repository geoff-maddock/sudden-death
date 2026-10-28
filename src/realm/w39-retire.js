/* w39: retire a card at your home ground. Loads after w37-map.js; changes earlier parts only by reassignment (saved
   originals carry the wW39 prefix).

   Once a week, at your own ground, you can retire a card: it leaves your deck for good. It costs W_RETIRE.energy energy
   of your home region's element (REGION_ELEM: aether in the Charter Plains, bloom, tide, ember or rime elsewhere), the
   energy you gather from wells, which Brother Quill also spends on upgrades. It is its own track: the card vendors'
   trade (w9b, once a week at each of the three, for gold at Sudden Death's rising removeCost) is unchanged.

   WG.ground.retired   the week (wWeek) a card was last retired here
   wRetireProblems()   why you can't retire a card now, as a sentence ('' when you can)
   wRetireCard(card)   '' when done, or why not
   Wrapped: wOpenGround (wW39OpenGround: the button), renderHelp (wW39RenderHelp: #wHelpRetire, and the vendors' trade
   in How to play's Towns section, #wHelpTrade). */

const W_RETIRE = { energy: 3, minDeck: 5 };
function wRetireEl() { return REGION_ELEM[wHomeRegion()] || 'aether'; }
function wRetireProblems() {
  const G = wHomeGround(); if (!G) return 'You need a home ground.';
  if (G.retired === wWeek()) return 'You have retired a card here this week. Come back next week.';
  const el = wRetireEl(), have = WG.energy[el] || 0;
  if (have < W_RETIRE.energy) return `It takes ${W_RETIRE.energy} ${DB.elems.names[el]} energy, and you have ${have}. Energy wells give it.`;
  if (RUN.deck.length <= W_RETIRE.minDeck) return `Your deck is down to ${RUN.deck.length} cards. Keep them.`;
  return '';
}
function wRetireCard(card) {
  const why = wRetireProblems(); if (why) return why;
  const i = RUN.deck.indexOf(card); if (i < 0) return 'That card is not in your deck.';
  const el = wRetireEl();
  RUN.deck.splice(i, 1); WG.energy[el] -= W_RETIRE.energy; WG.ground.retired = wWeek();
  wLog(`You retire ${wCardName(card.id, card.up)} at your ground. It leaves your deck for good (${W_RETIRE.energy} ${DB.elems.names[el]} energy).`, 'd');
  wSave();
  return '';
}

const wW39OpenGround = wOpenGround;
wOpenGround = function (town, msg) {
  wW39OpenGround(town, msg);
  const G = wHomeGround(), sl = $('wGroundSleep');
  if (!G || G.town !== wGrdPlace(town || WG.map).town || !sl || $('wGroundRetire')) return;
  const why = wRetireProblems(), el = wRetireEl();
  sl.closest('.row').insertAdjacentHTML('afterend', `<div class="row wretire"><button class="ghost" id="wGroundRetire" ${why ? 'disabled' : ''}>Retire a card (${W_RETIRE.energy} ${esc(DB.elems.names[el])} energy)</button>
    <small class="hint">${esc(why || `Once a week: a card leaves your deck for good. You have ${WG.energy[el] || 0} ${DB.elems.names[el]} energy.`)}</small></div>`);
  $('wGroundRetire').onclick = () => {
    $('modalBox').querySelector('[data-close]').click();
    wPickCard(RUN.deck.slice(), 'Retire a card', `It leaves your deck for good. ${W_RETIRE.energy} ${DB.elems.names[el]} energy.`, card => { const r = card ? wRetireCard(card) : ''; wDrain(); wOpenGround(town, r); });
  };
};

const wW39RenderHelp = renderHelp;
renderHelp = function () {
  wW39RenderHelp();
  const g = $('wHelpGround'), t = $('wHelpTowns');
  if (g && !$('wHelpRetire')) g.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpRetire"><b>Retire a card.</b> Once a week at your ground, a card can leave your deck for good. It costs ${W_RETIRE.energy} energy of your home region's element (the energy wells give it).</p>`);
  if (t && !$('wHelpTrade')) t.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpTrade"><b>Trading a card away.</b> The three card vendors (Odd Lots in Graftonbury, Hob Tarn in Saltmere, the Brandt smithy in Cinderhold) will take a card off your hands: ask about CARDS, then Trade a card away. Once a week at each, for gold. The price starts at 75 gold and rises by 25 each time. Your home ground can retire a card too.</p>`);
};
