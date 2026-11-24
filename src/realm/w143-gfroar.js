/* w143: football's roar (issue #115, phase 3), a crowd meter that lifts a cast, as baseball's crowd does (w141); the
   engine's side is src/gf/parts/19-roar.js.
   On in every game and drive the Realm plays (Play, Manage, Simulate, the Cinder Cup, the Umbral, exhibitions); in LAB
   mode off unless the lab sets W_GFROAR.lab (the roar it plays), so the other balance numbers stand. A game whose
   options already say (roar, even null) plays them.
   Mana and stamina pay for every power as before. The stands fill each side's roar on big gains, sacks, turnovers and
   scores (gold, under the mana beside each score). In the powers row: Roar, to spend 3 of it on your next cast, so an
   everyday power works half again as strongly or an ultimate's zone lasts a play more. With Auto powers on your
   players spend it as a Knight would; the other side spends it by its skill.
   Wraps: wGridPowers (wW143GridPowers: the roar on the powers row), renderHelp (wW143RenderHelp: #wHelpGfRoar); and
   wGF.start, wGF.game, wGF.simGame (the roar goes in). Football: how it works gains a paragraph (W_GRID_HOW). */

const W_GFROAR = { on: true, lab: null };
function wGfRoarRules() {
  if (!W_GFROAR.on) return null;
  if (LAB) return W_GFROAR.lab ? JSON.parse(JSON.stringify(W_GFROAR.lab)) : null;
  return { on: [true, true] };
}
const wGfRoarNext = o => { if (!o || o.roar !== undefined) return o; const P = wGfRoarRules(); return P ? Object.assign({}, o, { roar: P }) : o; };
const wW143Start = wGF.start, wW143Game = wGF.game, wW143SimGame = wGF.simGame;
wGF.start = o => wW143Start(wGfRoarNext(o));
wGF.game = o => wW143Game(wGfRoarNext(o));
wGF.simGame = o => wW143SimGame(wGfRoarNext(o));

/* ---------- the powers row ---------- */
$('wGridMana').insertAdjacentHTML('afterend', ' <b id="wGridRoar" class="wgroar" title="The roar: the stands fill it on big gains, sacks, turnovers and scores (up to 6). Spend 3 on a cast to lift it."></b> <button class="ghost" id="wGridRoarBtn"></button>');
$('wGridRoarBtn').addEventListener('click', e => { e.stopPropagation(); const Q = wGF.roar(); if (!Q) return; const msg = wGF.armRoar(!Q.arm[Q.you]); if (msg) $('wGridRoarBtn').title = msg; wGridBar(); });
const wW143GridPowers = wGridPowers;
wGridPowers = function () {
  wW143GridPowers();
  const Q = wGF.roar(), R = wGF.roarRules, el = $('wGridRoar'), b = $('wGridRoarBtn'), show = !!Q && !$('wGridPows').hidden;
  el.hidden = b.hidden = !show; if (!show) return;
  const v = Q.v[Q.you], up = v >= R.cost, armed = !!Q.arm[Q.you];
  el.textContent = `Roar ${'●'.repeat(v)}${'○'.repeat(Math.max(0, R.max - v))}`;
  b.textContent = armed ? 'Roar: on your next cast' : `Roar (${R.cost})`;
  b.disabled = !armed && (!up || wGF.phase !== 'call');
  b.classList.toggle('on', armed); b.setAttribute('aria-pressed', armed);
  b.title = `${R.cost} roar: your next everyday power works half again as strongly, or your next ultimate's zone lasts a play more. Mana and stamina pay as usual. A power that only breaks a tackle, stops a break-up or a loss can't be lifted.${up ? '' : ` (Needs ${R.cost}.)`}`;
};

/* ---------- How to play ---------- */
function wGridRoarHowHTML(id) {
  const R = wGF.roarRules;
  return `<p class="hint"${id ? ` id="${id}"` : ''}><b>The roar.</b> Mana and stamina pay for every power, as before. Each side also has a roar, the gold marks under its mana: the stands fill it on its big moments (${R.gain} for a gain of ${R.big} yards or more, ${R.sack} for a sack, ${R.to} for an interception or a fumble taken, ${R.downs} for a stop on downs, ${R.td} for a touchdown, ${R.fg} for a field goal, ${R.safety} for a safety), up to ${R.max}. Press <b>Roar</b> in the powers row to spend ${R.cost} of it on your next cast: an everyday power works half again as strongly, or an ultimate's zone lasts a play more. A power that only breaks a tackle, stops a break-up or a loss can't be lifted, nor can a situation power. With Auto powers on your players spend it as the coaches would; the other side spends its own, better at higher tiers. The play's log line says when the roar lifted a cast, and why.</p>`;
}
W_GRID_HOW.push(() => wGridRoarHowHTML(''));
const wW143RenderHelp = renderHelp;
renderHelp = function () {
  wW143RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpGfRoar')) return;
  h.insertAdjacentHTML('beforeend', wGridRoarHowHTML('wHelpGfRoar'));
};
