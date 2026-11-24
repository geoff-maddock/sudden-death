/* w146: Graftonbury Ballpark's own ways (issue #115, phase 4), by the shape of the Shed's (w139); the engine's side is
   src/bd/parts/53-ground.js. Dusty Marl keeps "the grass that grows back where the pitcher stands".
   - The mound grass: it grows back over the mound through a half-inning, and the longer it runs the more every pitch
     scatters, whoever throws it. Dusty rakes it between half-innings, so a long inning hurts more than a long game.
   - The flickering floodlight: in a night game (wIsNight() at the first pitch, kept with the game) one of the outfield
     floodlights flickers and leaves a dim patch, in a different place each game. A fly ball into it is harder to read:
     fielders react later and bobble a catch there more. In a day game the lights are off.
   On in every ball game the Realm plays at the Ballpark (Play, Manage, Simulate, the Diamond Cup, exhibitions), never
   in the Umbral (the Bone Diamond is not Dusty's), and off in LAB mode unless the lab sets W_BPARK.lab (the rules it
   plays), so the other balance numbers stand. W_BPARK.night (true or false) holds the clock for the checks.
   Dusty has a line for each (MOUND, LIGHTS), the game card says what the Ballpark is like now, and How to play has
   #wHelpBallGround after the powers.
   Wraps: wOpenBallCard (wW146OpenBallCard: the Ballpark now, on the card), renderHelp (wW146RenderHelp:
   #wHelpBallGround); and wBD.start, wBD.sim (wW146Start, wW146Sim: the ground goes in). */

const W_BPARK = { on: true, lab: null, night: null,
  mound: 'The grass on the mound? It grows back through an inning, right over the rubber, and the longer a pitcher is out there the worse their footing and the wilder the pitch. Whoever is throwing: it is the mound\'s, not the arm\'s. I rake it between halves, so a long inning is what hurts. Watch the grass on the mound: the board over the field says how far it has crept.',
  lights: 'One of my outfield lights flickers, and I cannot find the fault. At night it leaves a dark patch out there, somewhere different every game, and a fly ball into it is a devil to read: they go late and they drop it. In a day game the lights are off and it does not matter. Hit it there, if you can.',
  help: 'Graftonbury Ballpark has its own ways. The mound grass: the grass on the mound grows back through a half-inning, creeping in over the rubber, and every pitch scatters a little more the longer the half runs, up to half again after thirty pitches, whoever throws it, so a pitching change mid-inning does not clear it. Dusty Marl rakes it between halves, so a long inning hurts more than a long game. The flickering floodlight: in a night game one outfield light flickers and leaves a dim patch, drawn darker and in a different place each game. A fly ball that would land in it is harder to read: every fielder reads it about a third of a second late, and a catch in the air there is bobbled almost twice as often. In a day game the lights are off. Both show in the conditions list over the field. The CPU reads them by its skill: it pulls a tiring pitcher sooner in a long inning, and its batters aim fly balls at the patch.' };

// the hexes the engine knows: a game that carries one is the Umbral's
const W_BPARK_HEX = wBD.hexes();
function wBparkRules(night) {
  if (!W_BPARK.on) return null;
  if (LAB) return W_BPARK.lab ? JSON.parse(JSON.stringify(W_BPARK.lab)) : null;
  return { on: true, night: night != null ? !!night : W_BPARK.night != null ? !!W_BPARK.night : !!WG && wIsNight() };
}
// (a game whose rules already say, as a lab's may, plays them; the Umbral's games, with hexes, are not at the Ballpark)
function wBparkNext(o) {
  if (!o) return o;
  const r = o.rules || {};
  if (r.ground !== undefined || (r.hexes || []).concat(o.hexes || []).some(h => W_BPARK_HEX[h]) || (typeof W_UMB4A !== 'undefined' && W_UMB4A.going)) return o;
  const P = wBparkRules(); if (!P) return o;
  return Object.assign({}, o, { rules: Object.assign({}, r, { ground: P }) });
}
const wW146Start = wBD.start, wW146Sim = wBD.sim;
wBD.start = o => wW146Start(wBparkNext(o));
wBD.sim = o => wW146Sim(wBparkNext(o));

// what the Ballpark is like now, in words (for the game card)
function wBparkNow() {
  const n = W_BPARK.night != null ? !!W_BPARK.night : !!WG && wIsNight();
  return n ? 'a night game: the lights are on, and one out in the field is flickering again (a dim patch, somewhere new each game). The mound grass grows back through every inning.'
    : 'a day game: the lights are off. The mound grass grows back through every inning.';
}
const wW146OpenBallCard = wOpenBallCard;
wOpenBallCard = function () {
  const r = wW146OpenBallCard.apply(this, arguments);
  const box = $('modalBox'), ul = box && box.querySelector('.wbclubs');
  if (ul && W_BPARK.on && !box.querySelector('#wBallGround')) ul.insertAdjacentHTML('beforebegin', `<p class="hint" id="wBallGround"><b>The Ballpark now:</b> ${esc(wBparkNow())}</p>`);
  return r;
};

/* ---------- Dusty Marl's word ---------- */
(() => {
  const K = DB.chars.gk_ballpark; if (!K) return;
  K.topics.job.t += ' Ask me about the MOUND, and the LIGHTS.';
  K.topics.mound = { t: W_BPARK.mound };
  K.topics.lights = { t: W_BPARK.lights };
})();

const wW146RenderHelp = renderHelp;
renderHelp = function () {
  wW146RenderHelp();
  const after = $('wHelpBallPow') || $('wHelpBallKit') || $('wHelpBall'); if (!after || $('wHelpBallGround')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBallGround"><b>The Ballpark's ways.</b> ${esc(W_BPARK.help.replace(/^Graftonbury Ballpark has its own ways\. /, ''))} Ask Dusty Marl about the MOUND and the LIGHTS.</p>`);
};
