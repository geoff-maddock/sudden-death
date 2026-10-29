/* w42: the gridiron (issue #9, phase 1). Cinder Gridiron, the football engine, runs in the wGF scope (src/gf/ and
   src/realm/gridiron/: a canvas in #v-gridiron, and none of its names reach ours). This part gives it a view beside the
   world, a bar above the field, and a way back.
   Phase 1 plays one drive: the Cinderhold Football Club has the ball on its own 25 against a visiting side. Ask Clinker
   Dunn at the Ash Bowl for a DRIVE. The coaches call both sides, or you call Cinderhold's plays from the bar (the
   defense and fourth down stay the coaches'). Nothing is won or lost, and nothing is saved. Games at the Bowl come in
   phase 5.
   Wraps: showView (wW42ShowView: the bar), openPause (wW42OpenPause: not on the gridiron), wRunAct (wW42RunAct: 'drive'),
   renderHelp (wW42RenderHelp: #wHelpGridiron). */

const W_GRID = {
  home: { kinds: ['kobold', 'minotaur', 'golem', 'ogre', 'dwarf', 'goblin', 'troll'], color: '#c8461e', light: '#ffd08a', short: 'CFC' },
  away: { city: 'mossgate', kinds: ['elf', 'werewolf', 'harpy', 'spider', 'wraith', 'vampire', 'gorgon'], color: '#3f8a5a', light: '#e8f4c8', short: 'MFC' },
};
// the drive on the field: plain data, never saved
let WGF = null;

$('v-gridiron').insertAdjacentHTML('beforebegin', `<div id="wGridBar" class="wdbar" hidden>
  <b id="wGridTitle">A drive at the Ash Bowl</b><span id="wGridNote" class="hint"></span>
  <span id="wGridCalls">${Object.entries(wGF.plays).map(([k, p]) => `<button class="ghost" data-gcall="${k}" title="${esc(p.desc)}">${esc(p.n)}</button>`).join('')}</span>
  <button class="ghost" id="wGridMode"></button><button class="ghost" id="wGridAgain">Another drive</button>
  <button class="ghost" id="wGridBack">Back to the world</button></div>`);
$('wGridBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.gcall) { wGF.call(b.dataset.gcall); wGridBar(); }
  else if (b.id === 'wGridMode') { WGF.mode = WGF.mode === 'call' ? 'watch' : 'call'; wGridironDrive({ mode: WGF.mode }); }
  else if (b.id === 'wGridAgain') wGridironDrive({ mode: WGF.mode });
  else if (b.id === 'wGridBack') wLeaveGridiron();
});

function wGridTeams() {
  const g = W_GRDS.find(x => x.id === 'g_bowl'), H = W_GRID.home, A = W_GRID.away;
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.football} Club` }, A)];
}
/* one drive on the field. opts: { mode: 'watch' | 'call', seed } */
function wGridironDrive(opts) {
  const o = Object.assign({ mode: (WGF && WGF.mode) || 'watch' }, opts || {});
  WGF = { mode: o.mode, over: null };
  wGF.start({ teams: wGridTeams(), mode: o.mode, seed: o.seed });
  showView('gridiron');
  wGridBar();
}
function wGridBar() {
  if (!WGF) return;
  const call = WGF.mode === 'call', yours = call && wGF.phase === 'call';
  $('wGridCalls').hidden = !call;
  for (const b of $('wGridCalls').querySelectorAll('button')) b.disabled = !yours;
  $('wGridMode').textContent = call ? 'Let the coaches call it' : 'Call the plays';
  $('wGridNote').textContent = WGF.over ? 'The drive is over.' : yours ? 'Your call: pick a play.' : call ? 'You call the offense; the coaches call the defense and fourth down.' : 'The coaches call both sides.';
}
function wLeaveGridiron() {
  WGF = null;
  if (WG) showView('world');
  else { showScreen('title'); renderTitle(); }
}
wGF.onPhase = () => { if (UI.view === 'gridiron') wGridBar(); };
wGF.onOver = s => { if (WGF) { WGF.over = s; wGridBar(); $('wGridAgain').focus(); } };

const wW42ShowView = showView;
showView = function (v) {
  wW42ShowView(v);
  $('wGridBar').hidden = v !== 'gridiron';
  if (v === 'gridiron') $('runbar').hidden = true;
};
const wW42OpenPause = openPause;
openPause = function () { if (UI.view === 'gridiron') return; return wW42OpenPause.apply(this, arguments); };

// Clinker Dunn at the Ash Bowl puts on a drive
(() => {
  const K = DB.chars.gk_bowl; if (!K) return;
  K.topics.job.t += ' And come and see the new game on the grass: ask me for a DRIVE.';
  K.topics.drive = { t: 'Real football, seven a side and the same seven both ways. Our club has the ball on its own 25. Watch them go, or call the plays yourself.', act: 'drive' };
})();
const wW42RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'drive') return wGridironDrive(); return wW42RunAct.apply(this, arguments); };

const wW42RenderHelp = renderHelp;
renderHelp = function () {
  wW42RenderHelp();
  const g = $('wHelpGrounds'); if (!g || $('wHelpGridiron')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGridiron"><b>Real football.</b> The Ash Bowl is trying out a new game: football on the grass, seven a side, and the same seven play offense and defense. Ask Clinker Dunn for a DRIVE and watch the Cinderhold Football Club try to score from its own 25, or call its plays yourself: Run, Short pass, Deep pass or Screen. Each defense is good against some plays and weak against others. A blitz stops the deep pass but loses to the screen, and a deep zone gives up short runs. Nothing is won or lost yet.</p>`);
};
