/* w144: the Ash Bowl's own ways (issue #115, phase 4), football's ground; the engine's side is src/gf/parts/20-ash.js.
   On in every game and drive the Realm plays, since all of them are at the Ash Bowl (Play, Manage, Simulate, the Cinder
   Cup and the fixtures, exhibitions, practice drives; never the Umbral's Cinder Pit, which isn't the Ash Bowl: u4b-football.js sends ash: false);
   in LAB mode off unless the lab sets W_GFASH.lab, so the other balance numbers stand. A game whose options already say
   (ash: true or false) plays them.
   - Ashfall: ash settles in a few grey patches through each half and grows; a carrier cutting on it slows and may
     stumble, and a loose ball or a punt that comes down on it dies there. Clinker sweeps at the half and at a timeout:
     the Timeout button in the bar (one a half, at your call); the other coach calls its own by its skill.
   - The heat shimmer at one end: a long pass, a field goal or a punt toward it wobbles, more the deeper it goes. The
     ends switch at the half. The bar says so at your call on offense.
   Clinker Dunn's GRIDIRON line names both; Football: how it works has them in full (W_GRID_HOW), and How to play a line
   after #wHelpGfGame (#wHelpGfAsh).
   Wraps: wGF.start, wGF.game, wGF.simGame (wW144Start, wW144Game, wW144SimGame: ash in), wGridBar (wW144GridBar: the
   Timeout button and the heat in the note), renderHelp (wW144RenderHelp: #wHelpGfAsh). */

const W_GFASH = { on: true, lab: false };
const wGfAshNext = o => { if (!W_GFASH.on || (o && o.ash !== undefined) || (LAB && !W_GFASH.lab)) return o; return Object.assign({}, o, { ash: true }); };
const wW144Start = wGF.start, wW144Game = wGF.game, wW144SimGame = wGF.simGame;
wGF.start = o => wW144Start(wGfAshNext(o));
wGF.game = o => wW144Game(wGfAshNext(o));
wGF.simGame = o => wW144SimGame(wGfAshNext(o));

/* ---------- the bar: a timeout, and the heat ---------- */
$('wGridCalls').insertAdjacentHTML('afterend', '<button class="ghost" id="wGridTimeout" hidden>Timeout</button>');
$('wGridTimeout').addEventListener('click', e => { e.stopPropagation(); const msg = wGF.ashTimeout(); if (msg) $('wGridTimeout').title = msg; wGridBar(); });
const wW144GridBar = wGridBar;
wGridBar = function () {
  wW144GridBar();
  const A = wGF.ash(), b = $('wGridTimeout'), show = !!A && !!WGF && WGF.mode !== 'watch' && !WGF.over && wGF.live;
  b.hidden = !show; if (!show) return;
  const left = A.to[A.you];
  b.textContent = `Timeout (${left})`;
  b.disabled = !left || wGF.phase !== 'call';
  b.title = left ? 'Call a timeout: Clinker Dunn sweeps the ash off the pitch, and new ash starts to fall. One a half.' : 'No timeouts left this half.';
  if (wGF.phase === 'call' && wGF.yourBall && A.facing[A.you]) $('wGridNote').textContent += ' The heat shimmer is at the end you are driving to: long passes and kicks wobble.';
};

/* ---------- Clinker Dunn ---------- */
(() => {
  const K = DB.chars.gk_bowl; if (!K || !K.topics.gridiron) return;
  K.topics.gridiron.t += ' Mind the ash: it comes down all game and settles in patches, and a back who cuts on it goes over. I sweep it at the half, and at a timeout if you ask nicely. And the heat comes off the stands at one end, so save your long ones for the other.';
})();

/* ---------- How to play ---------- */
function wGridAshHowHTML() {
  const A = wGF.ashRules;
  return `<p class="hint"><b>The Ash Bowl.</b> Every football game here has the ground's own ways. <b>Ashfall:</b> ash drifts down through each half and settles in ${A.n} grey patches on the grass (you see it falling over where it will land), and each patch grows as the half goes on. A ball carrier who cuts on the ash slows for a moment and may stumble; a fumble that comes out on it skids and dies there, so nobody runs it back; and a punt that comes down on it loses its roll. Clinker Dunn sweeps the pitch at the half and at a timeout, and the ash starts again: each side has ${A.to} timeout a half (the <b>Timeout</b> button, at your call). <b>The heat shimmer:</b> heat comes off the basalt stands at one end (the warm, rippling end, marked HEAT). A pass toward it wobbles more the further past ${A.shimFrom} yards it goes, a field goal toward it is less likely the longer it is (the kick button's chance counts it), and a punt toward it can fall short. The ends switch at the half, so each side faces it once. Keep the deep shots for the other end. The other coach reads both from Knight up: it saves its deep calls for the other end, its backs hold their line on the ash rather than cut there, and it calls its timeout when a big patch lies just ahead; an Archmage steers round the ash before reaching it.</p>`;
}
W_GRID_HOW.push(wGridAshHowHTML);
const wW144RenderHelp = renderHelp;
renderHelp = function () {
  wW144RenderHelp();
  const after = $('wHelpGfGame'); if (!after || $('wHelpGfAsh')) return;
  after.insertAdjacentHTML('afterend', '<p class="hint" id="wHelpGfAsh"><b>The Ash Bowl.</b> Ash settles on the grass through each half, and a back who cuts on it can go over; heat off the stands at one end makes long passes and kicks toward it wobble. See Football: how it works.</p>');
};
