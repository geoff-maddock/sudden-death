/* w20: the diamond (issue #4, phase 1). Brimstone Diamond, the baseball game, runs in the wBD scope
   (src/realm/diamond/: its page sits in a shadow root inside #v-diamond, and none of its names reach ours).
   This part gives it a view beside the world and the fight, a bar above the field, and a way back.
   Phase 1 plays exhibitions only, CPU against CPU (wDiamondExhibition); playing from the world comes in phase 4.
   Wraps: showView (wW20ShowView), openPause (wW20OpenPause: in the diamond, Esc and P are its own Time out). */

const W_DIAMOND = { innings: 3, diff: 1 };
// the game on the field: plain data, never saved yet (phase 4 saves it)
let WD = null;

$('v-diamond').insertAdjacentHTML('beforebegin', `<div id="wDiamondBar" class="wdbar" hidden>
  <b id="wDiamondTitle">Exhibition</b><span id="wDiamondNote" class="hint"></span>
  <button class="ghost" id="wDiamondBack">Back to the world</button></div>`);
$('wDiamondBack').onclick = () => wLeaveDiamond();

/* play a game on the diamond. opts: { team, opp, innings, diff } (Brimstone Diamond club ids) */
function wDiamondExhibition(opts) {
  const o = Object.assign({ mode: 'demo', team: 'ironmaw', opp: 'mirewood' }, W_DIAMOND, opts || {});
  WD = { opts: o, over: null, from: UI.view };
  showView('diamond');
  wBD.start(o);
  const [a, h] = wBD.G.teams;
  $('wDiamondTitle').textContent = `Exhibition: ${a.def.name} at ${h.def.name}`;
  $('wDiamondNote').textContent = `${o.innings} innings, CPU against CPU.`;
}
/* the final, from inside the scope: the score stays on the field, and the way back is the bar's button */
function wDiamondOver() {
  if (!WD) return;
  const [a, h] = wBD.G.teams;
  WD.over = { runs: [a.R, h.R], hits: [a.H, h.H], win: a.R > h.R ? 0 : 1 };
  $('wDiamondNote').textContent = `Final: ${a.def.short} ${a.R}, ${h.def.short} ${h.R}.`;
  $('wDiamondBack').focus();
}
function wLeaveDiamond() {
  WD = null;
  if (WG) showView('world');
  else { showScreen('title'); renderTitle(); }
}
wBD.onOver = () => wDiamondOver();
wBD.onQuit = () => { if (UI.view === 'diamond') wLeaveDiamond(); };

const wW20ShowView = showView;
showView = function (v) {
  wW20ShowView(v);
  $('wDiamondBar').hidden = v !== 'diamond';
  if (v === 'diamond') $('runbar').hidden = true;
  wEnginesShow(v);
};
const wW20OpenPause = openPause;
openPause = function () { if (UI.view === 'diamond') return; return wW20OpenPause.apply(this, arguments); };
