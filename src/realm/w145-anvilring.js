/* w145: the Anvil Ring's own ways (issue #115, phase 4); the engine's side is src/bx/parts/16-anvil.js.
   The forge corner (one neutral corner still sits over the old forge and glows: a fighter in it loses breath there, and
   gets it back slower) and the slack ropes (one side works loose through each round: a fighter on them is slower off
   them and easier to hit; Ma Gristle tightens them at the bell, and another side goes slack).
   On in every bout the Realm boxes at the Anvil Ring (Play, Manage, Simulate, a club card, the Anvil Belt, the league
   fixtures boxed there, the exhibition BOUT); never in the Umbral's Broken Ring (u4c-boxing.js sends anvil: false), and
   in LAB mode off unless the lab sets W_ANVIL.lab, so the other balance numbers stand. A bout whose options already say
   (anvil, even false) boxes that.
   Ma Gristle says it before the first bell and at each bell (the engine's log, the tale of the tape and the corner
   card), and has the ROPES and the FORGE to talk about.
   Wraps: wBX.start, wBX.cardStart, wBX.simCard, wBX.simBout (wW145Start, wW145CardStart, wW145SimCard, wW145SimBout:
   anvil goes in), renderHelp (wW145RenderHelp: #wRingHowAnvil in Boxing: how it works, and #wHelpRingAnvil). */

const W_ANVIL = { on: true, lab: false,
  help: 'The Anvil Ring has two ways of its own, in every bout there. <b>The forge corner.</b> One of the two neutral corners (never a fighter\'s own) still sits over the old forge, and it glows on the canvas. A fighter in it loses breath there, and gets it back slower, so walking the other fighter into it pays, and getting caught there costs. Which corner it is changes each bout. <b>The slack ropes.</b> One side\'s ropes work loose during each round, and you can see them sag, more as the round goes on (it says <i>slack ropes</i> over them; <i>slack next</i> between rounds). A fighter on them doesn\'t bounce off: their feet are slower off the ropes, and punches find them more often. Ma Gristle tightens them at the bell, and another side goes slack next round. Ma Gristle says which before the first bell and at every break. The other corner reads them too, more the better it is: a Knight or better steps out of the forge and off the slack side, and circles to put your back to them.' };
function wAnvilRules() {
  if (!W_ANVIL.on) return false;
  if (LAB) return !!W_ANVIL.lab;
  return true;
}
const wAnvilNext = o => { if (!o || o.anvil !== undefined) return o; return wAnvilRules() ? Object.assign({}, o, { anvil: true }) : o; };
const wW145Start = wBX.start, wW145CardStart = wBX.cardStart, wW145SimCard = wBX.simCard, wW145SimBout = wBX.simBout;
wBX.start = o => wW145Start(wAnvilNext(o));
wBX.cardStart = o => wW145CardStart(wAnvilNext(o));
wBX.simCard = o => wW145SimCard(wAnvilNext(o));
wBX.simBout = o => wW145SimBout(wAnvilNext(o));

/* ---------- Ma Gristle ---------- */
{
  const K = DB.chars.gk_ring;
  if (K) {
    K.topics.job.t += ' Ask me about the ROPES and the FORGE before you box here.';
    K.topics.ropes = { t: 'Old ropes, older than me. One side works loose every round, and you can see it sag. Get pushed onto it and it won\'t bounce you off: you\'ll stick there, and they\'ll find you. I tighten them at the bell, and some other side goes next round. I tell you which.' };
    K.topics.forge = { t: 'This hall was a forge before it was a ring, and one corner still sits on the old firebox. It glows. Stand in it and the heat takes your breath, and it comes back slower. Not one of your own corners, mind: a different neutral one each bout. Walk them into it, and stay out yourself.' };
  }
}

/* ---------- How to play ---------- */
const wW145RenderHelp = renderHelp;
renderHelp = function () {
  wW145RenderHelp();
  const how = $('wRingHow'); if (how && !$('wRingHowAnvil')) how.insertAdjacentHTML('beforeend', `<p class="hint" id="wRingHowAnvil"><b>The Anvil Ring's ways.</b> ${W_ANVIL.help}</p>`);
  const h = $('wHelp'); if (!h || $('wHelpRingAnvil')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpRingAnvil"><b>Boxing: the Anvil Ring.</b> The ring has a forge corner that glows (a fighter in it gets their breath back slower, and loses more) and one side of slack ropes each round (a fighter on them is slower off them and easier to hit). Ma Gristle names both before the first bell and tightens the ropes at each bell. Boxing: how it works has them in full.</p>`);
};
