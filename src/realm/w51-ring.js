/* w51: the ring (issue #23, phase 1). The Anvil Ring, the boxing engine, runs in the wBX scope (src/bx/ and
   src/realm/ring/: a canvas in #v-ring, and none of its names reach ours). This part gives it a view beside the world,
   a bar above the ring, and a way back.
   Phase 1 boxes one bout, CPU against CPU: a fighter of the Cinderhold Boxing Club in the red corner against a visitor
   in the blue, three rounds, judged. Ask Ma Gristle at the Anvil Ring for a BOUT. Nothing is won or lost, and nothing
   is saved. The card of three bouts, your corner's calls and games from the world come in later phases.
   Wraps: showView (wW51ShowView: the bar), openPause (wW51OpenPause: not in the ring), wRunAct (wW51RunAct: 'bout'),
   showPage (wW51ShowPage: the bout waits while another page is up), renderHelp (wW51RenderHelp: #wHelpRing). */

const W_RING = {
  home: { kinds: ['minotaur', 'dwarf', 'ogre', 'golem', 'kobold', 'troll'], color: '#b8231e', light: '#ffd0a0', short: 'CBC' },
  away: { city: 'saltmere', kinds: ['elf', 'harpy', 'vampire', 'spider', 'wraith', 'gorgon'], color: '#2a5fb8', light: '#d6e6ff', short: 'SBC' },
};
// the bout in the ring: plain data, never saved
let WBX = null;

$('v-ring').insertAdjacentHTML('beforebegin', `<div id="wRingBar" class="wdbar" hidden>
  <b id="wRingTitle">A bout at the Anvil Ring</b><span id="wRingNote" class="hint"></span>
  <button class="ghost" id="wRingAgain">Another bout</button>
  <button class="ghost" id="wRingBack">Back to the world</button></div>`);
$('wRingBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'wRingAgain') wRingBout();
  else if (b.id === 'wRingBack') wLeaveRing();
});

function wRingCorners() {
  const g = W_GRDS.find(x => x.id === 'g_ring'), H = W_RING.home, A = W_RING.away;
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.boxing} Club` }, A)];
}
// a fighter from a kind, named from the free agents' names for it
function wRingFighter(kind) { return { n: wRingName(kind), kind, num: '' }; }
function wRingName(kind) {
  const L = FA_NAMES[kind] || [];
  return L.length ? L[(Math.random() * L.length) | 0] : kind[0].toUpperCase() + kind.slice(1);
}
/* one bout in the ring. opts: { kinds: [red, blue], seed } (a random pair from each club when not given) */
function wRingBout(opts) {
  const o = opts || {}, k = o.kinds || [W_RING.home.kinds, W_RING.away.kinds].map(L => L[(Math.random() * L.length) | 0]);
  WBX = { over: null, kinds: k.slice() };
  wBX.start({ fighters: k.map(wRingFighter), corners: wRingCorners(), mode: 'watch', seed: o.seed });
  showView('ring');
  wRingBarNote();
}
function wRingBarNote() {
  if (!WBX) return;
  const ph = wBX.phase, G = wBX.G;
  $('wRingNote').textContent = WBX.over ? WBX.over.verdict : ph === 'corner' ? 'Between rounds: the corners talk, and the cut-man works.' : ph === 'kd' ? 'A knockdown: the count is on.' : G ? `${G.F[0].n} the ${G.F[0].kind} against ${G.F[1].n} the ${G.F[1].kind}. Three rounds, three judges.` : '';
}
function wLeaveRing() {
  WBX = null;
  if (WG) showView('world');
  else { showScreen('title'); renderTitle(); }
}
wBX.onPhase = () => { if (UI.view === 'ring') wRingBarNote(); };
wBX.onOver = s => { if (WBX) { WBX.over = s; wRingBarNote(); $('wRingAgain').focus(); } };

const wW51ShowView = showView;
showView = function (v) {
  wW51ShowView(v);
  $('wRingBar').hidden = v !== 'ring';
  if (v === 'ring') $('runbar').hidden = true;
};
const wW51OpenPause = openPause;
openPause = function () { if (UI.view === 'ring') return; return wW51OpenPause.apply(this, arguments); };
const wW51ShowPage = showPage;
showPage = function (p) {
  wW51ShowPage(p);
  if (WBX && UI.view === 'ring') wBX.pause(p !== 'play');
};

// Ma Gristle at the Anvil Ring puts on a bout (not BOXING or GAME: those are how card-game boxing scores, and the match)
(() => {
  const K = DB.chars.gk_ring; if (!K) return;
  K.topics.job.t += ' And we box for real now, in the ring itself: ask me for a BOUT.';
  K.topics.bout = { t: 'Three rounds, three judges, one of ours against a visitor. Stand at the ropes and watch.', act: 'bout' };
})();
const wW51RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'bout') return wRingBout(); return wW51RunAct.apply(this, arguments); };

const wW51RenderHelp = renderHelp;
renderHelp = function () {
  wW51RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpRing') || !$('wHelpGrounds')) return;
  const G = [...h.querySelectorAll('[id^="wHelpG"]')], after = G[G.length - 1];
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRing"><b>Real boxing.</b> The Anvil Ring is trying out boxing in the ring itself, one fighter against one. Ask Ma Gristle for a BOUT and watch: three rounds, each about 40 seconds. Fighters jab, hook and dig to the body, and they keep their guard up, slip punches and clinch. Every punch costs stamina, and a punch that lands costs health. At zero health a fighter is knocked down. Failing to beat the count is a knockout, and three knockdowns stop the bout. Otherwise three judges score each round 10–9: Brass likes power punches, Tally likes activity and Slate likes defense. Kinds box differently: a golem hits like a wall and moves like one, and a harpy is all speed and no chin. Nothing is won or lost yet.</p>`);
};
