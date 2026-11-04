/* w51: the ring (issue #23, phases 1 and 2). The Anvil Ring, the boxing engine, runs in the wBX scope (src/bx/ and
   src/realm/ring/: a canvas in #v-ring, and none of its names reach ours). This part gives it a view beside the world,
   a bar above the ring, and a way back.
   Phase 1 boxes one bout, CPU against CPU: a fighter of the Cinderhold Boxing Club in the red corner against a visitor
   in the blue, three rounds, judged. Ask Ma Gristle at the Anvil Ring for a BOUT. Nothing is won or lost, and nothing
   is saved. The card of three bouts and games from the world come in later phases.
   Phase 2: three modes on the bar (W_RING_MODES): Corners (both corners are the CPU's), You corner (you pick your
   fighter's plan before each round, and when the cut-man works) and You box (that, and you box the rounds by hand:
   the keys are in r1-page.js, and under the ring a pad of buttons does the same on a phone). While the bout waits for
   your call the bar has the five plans (your corner's advice marked) and the cut-man. Switching modes goes on with the
   same bout; the last one picked is kept for the next bout (not saved). How to play has "Boxing: how it works"
   (#wRingHow), and a button under the ring opens it (the bout waits while you read).
   Wraps: showView (wW51ShowView: the bar), openPause (wW51OpenPause: not in the ring), wRunAct (wW51RunAct: 'bout'),
   showPage (wW51ShowPage: the bout waits while another page is up), renderHelp (wW51RenderHelp: #wHelpRing). */

// who boxes and corners your side: the CPU, you in the corner, or you in the ring too
const W_RING_MODES = {
  watch: { n: 'Corners', title: 'Both corners are the CPU\'s. Switching goes on with the same bout.' },
  call: { n: 'You corner', title: 'You pick your fighter\'s plan before each round, and when the cut-man works. They box it.' },
  play: { n: 'You box', title: 'Your corner, and you box the rounds: J jab, K hook, L body shot, hold Space to guard, Shift to slip, E to clinch, WASD to move.' },
};
let W_RING_MODE = 'play';
const W_RING_PAD = [['jab', 'Jab', 'J'], ['hook', 'Hook', 'K'], ['body', 'Body', 'L'], ['guard', 'Guard', 'Space, held'], ['slip', 'Slip', 'Shift'], ['clinch', 'Clinch', 'E']];
const W_RING = {
  home: { kinds: ['minotaur', 'dwarf', 'ogre', 'golem', 'kobold', 'troll'], color: '#b8231e', light: '#ffd0a0', short: 'CBC' },
  away: { city: 'saltmere', kinds: ['elf', 'harpy', 'vampire', 'spider', 'wraith', 'gorgon'], color: '#2a5fb8', light: '#d6e6ff', short: 'SBC' },
};
// the bout in the ring: plain data, never saved
let WBX = null;

$('v-ring').insertAdjacentHTML('beforebegin', `<div id="wRingBar" class="wdbar" hidden>
  <b id="wRingTitle">A bout at the Anvil Ring</b><span id="wRingNote" class="hint"></span>
  <span id="wRingCall" hidden>${Object.entries(wBX.plans).map(([k, P]) => `<button class="ghost" data-rplan="${k}" title="${esc(P.desc)}">${esc(P.n)}</button>`).join('')}<button class="ghost" id="wRingPatch"></button></span>
  <span id="wRingModes" class="wgmodes" role="group" aria-label="Who boxes it">${Object.entries(W_RING_MODES).map(([k, m]) => `<button class="ghost" data-rmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <button class="ghost" id="wRingAgain">Another bout</button>
  <button class="ghost" id="wRingBack">Back to the world</button></div>`);
$('wRingBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.rplan) { wBX.call(b.dataset.rplan); wRingBarNote(); }
  else if (b.id === 'wRingPatch') { wBX.patch(); wRingBarNote(); }
  else if (b.dataset.rmode) { W_RING_MODE = b.dataset.rmode; if (WBX && !WBX.over) wBX.setMode(W_RING_MODE); else if (WBX) wRingBout(); wRingBarNote(); }
  else if (b.id === 'wRingAgain') wRingBout();
  else if (b.id === 'wRingBack') wLeaveRing();
});
// under the ring: the pad (You box), and How boxing works
$('v-ring').insertAdjacentHTML('beforeend', `<div id="wRingPad" class="wrpad" hidden role="group" aria-label="Box">${W_RING_PAD.map(([k, n, key]) => `<button class="ghost" data-rpad="${k}" title="${esc(key)}">${esc(n)}</button>`).join('')}</div>
  <p class="hint wghowlink">How boxing works: the punches, defending, the plans and the judges. <button class="ghost" id="wRingHowBtn">How to play boxing</button> <small>The bout waits while you read.</small></p>`);
$('wRingHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wRingHow'); if (h) h.scrollIntoView({ block: 'start' }); });
// a punch on the press, the guard while it's held down
$('wRingPad').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-rpad]'); if (!b) return;
  e.preventDefault();
  if (b.dataset.rpad === 'guard') { wBX.input({ guard: true }); try { b.setPointerCapture(e.pointerId); } catch (er) { /* no live pointer (a synthetic press) */ } } else wBX.input({ act: b.dataset.rpad });
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('wRingPad').addEventListener(ev, e => { if (e.target.closest('[data-rpad="guard"]')) wBX.input({ guard: false }); });

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
  wBX.start({ fighters: k.map(wRingFighter), corners: wRingCorners(), mode: o.mode || W_RING_MODE, you: 0, seed: o.seed });
  showView('ring');
  wRingBarNote();
}
function wRingBarNote() {
  if (!WBX) return;
  const ph = wBX.phase, G = wBX.G, w = wBX.wait, mode = wBX.mode || W_RING_MODE, me = G && G.F[wBX.you];
  $('wRingNote').textContent = WBX.over ? WBX.over.verdict
    : w ? `Your call${ph === 'intro' ? ' before the first round' : ` for round ${G.round}`}: pick ${me.n}'s plan. Your corner says ${wBX.plans[w.plan].n} (${w.why}).`
    : ph === 'corner' ? 'Between rounds: the corners talk, and the cut-man works.' : ph === 'kd' ? 'A knockdown: the count is on.'
    : mode === 'play' && (ph === 'round' || ph === 'rise') ? 'You box: J jab, K hook, L body shot, hold Space to guard, Shift to slip, E to clinch. WASD or the arrows to move; let go and your feet follow your plan.'
    : G ? `${G.F[0].n} the ${G.F[0].kind} against ${G.F[1].n} the ${G.F[1].kind}. Three rounds, three judges.` : '';
  $('wRingCall').hidden = !w;
  for (const b of $('wRingCall').querySelectorAll('[data-rplan]')) { b.classList.toggle('on', !!w && b.dataset.rplan === w.plan); b.title = wBX.plans[b.dataset.rplan].desc + (w && b.dataset.rplan === w.plan ? ' Your corner\'s advice.' : ''); }
  const left = me ? me.patches : 0, pb = $('wRingPatch');
  pb.textContent = `Cut-man (${left} left)`; pb.disabled = !w || ph !== 'corner' || !left || me.patched === G.round;
  pb.title = 'The cut-man works on your fighter: 18 health back, and a little of what big shots took. Once a break, two a bout.' + (w && w.patch ? ' Your corner says now.' : '');
  pb.classList.toggle('on', !!w && w.patch);
  for (const b of $('wRingModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.rmode === mode); b.setAttribute('aria-pressed', b.dataset.rmode === mode); }
  $('wRingPad').hidden = mode !== 'play' || !!WBX.over;
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
  K.topics.bout = { t: 'Three rounds, three judges, one of ours against a visitor. Watch from the ropes, work the corner, or put the gloves on yourself.', act: 'bout' };
})();
const wW51RunAct = wRunAct;
// How to play: Boxing, how it works
function wRingHowHTML() {
  const P = wBX.plans, R = wBX.rules;
  return `<p class="hint">A bout is ${R.rounds} rounds of about ${R.secs} seconds, one fighter against one. Every punch costs stamina, and stamina comes back when you ease off. A punch that lands costs the other fighter health; at zero they are knocked down. Big shots also lower the most health they can get back, so each knockdown comes easier than the last. Failing to beat the count of ten is a knockout, and ${R.kd} knockdowns stop the bout.</p>
  <p class="hint"><b>Punches.</b> The <b>jab</b> is quick, reaches furthest and costs little, but it doesn't hurt much. The <b>hook</b> is slow and hurts, and it needs you closer. The <b>body shot</b> goes under the guard and drains their stamina. A punch takes a moment to wind up, so a fighter backing away can get out of a slow one.</p>
  <p class="hint"><b>Defending.</b> Hold the <b>guard</b> up and a punch to the head mostly bounces off, but body shots get through and your stamina comes back slowly. A <b>slip</b> timed as their punch arrives makes it miss, and your next punch is a counter: it lands more often and harder. From close in a <b>clinch</b> ties you both up until the referee breaks you; it buys time to get your breath back, but the judges don't like it.</p>
  <p class="hint"><b>Reach and size.</b> Reach is how far your punches land from. Backing up is slower than coming forward, and slower again on the ropes, so a fighter who keeps backing off gets trapped. A bigger fighter gives less ground.</p>
  <p class="hint"><b>Your corner.</b> Before each round you pick a plan: ${Object.values(P).map(p => `<b>${p.n}</b> (${p.desc.toLowerCase().replace(/\.$/, '')})`).join(', ')}. Your corner says what they'd do and why. The cut-man gives back 18 health and a little of what big shots took, once a break and ${R.patches} times a bout.</p>
  <p class="hint"><b>The judges.</b> Three judges score each round 10–9 to whoever did more (10–10 when it's even). Brass likes power punches, Tally likes activity and Slate likes defense, so a close round can split them. A knockdown wins the round, a point for each one. After the last round, two judges or three for one fighter wins it.</p>
  <p class="hint"><b>Three ways to box.</b> <b>Corners</b>: you watch. <b>You corner</b>: you pick the plans and the cut-man, and your fighter boxes them. <b>You box</b>: that, and you box the rounds yourself. J jab, K hook, L body shot, hold Space to guard, Shift to slip, E to clinch, and WASD or the arrows to move. Let go of the keys and your feet follow your plan, so you can box with the buttons under the ring alone.</p>`;
}
wRunAct = function (act, id) { if (act === 'bout') return wRingBout(); return wW51RunAct.apply(this, arguments); };

const wW51RenderHelp = renderHelp;
renderHelp = function () {
  wW51RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpRing') || !$('wHelpGrounds')) return;
  const G = [...h.querySelectorAll('[id^="wHelpG"]')], after = G[G.length - 1];
  h.insertAdjacentHTML('beforeend', `<section id="wRingHow" class="wghelp"><h3>Boxing: how it works</h3>${wRingHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRing"><b>Real boxing.</b> The Anvil Ring is trying out boxing in the ring itself, one fighter against one. Ask Ma Gristle for a BOUT: three rounds, each about 40 seconds. Watch it, pick your fighter's plan between rounds, or box it yourself (see Boxing: how it works). Fighters jab, hook and dig to the body, and they keep their guard up, slip punches and clinch. Every punch costs stamina, and a punch that lands costs health. At zero health a fighter is knocked down. Failing to beat the count is a knockout, and three knockdowns stop the bout. Otherwise three judges score each round 10–9: Brass likes power punches, Tally likes activity and Slate likes defense. Kinds box differently: a golem hits like a wall and moves like one, and a harpy is all speed and no chin. Nothing is won or lost yet.</p>`);
};
