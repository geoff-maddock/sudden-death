/* w88: the rink (issue #83, phases 0 and 1). Black Ice, the hockey engine, runs in the wHK scope (src/hk/ and
   src/realm/rink/: a canvas in #v-rink, and none of its names reach ours). This part gives it a view beside the
   world, laid out as the court's and the gridiron's pages are (w87): the bar with the status line under it, the rink,
   the two sides' box scores side by side, then This game (every goal).
   Phase 1 plays one game, CPU against CPU: the Rimewatch Hockey Club against a visiting six from Cinderhold, three
   periods on the game clock, face-offs, icing, sudden death and a shootout. Ask Old Tove at the Pond Rink for a
   SCRIMMAGE (GAME and HOCKEY stay the card-game match and how it scores). Nothing is won or lost, and nothing is
   saved. Playing it by hand, penalties, the six and the calls come in later phases.
   The game length is a setting (SET.rinkMins: 3, 6, 9 or 12 minutes; 6 by default), on the Settings panel and on the
   bar.
   On a phone the scoreboard strip (w86) covers the rink too: W_SB_VIEWS.rink and W_SB_HTML.rink are added here.
   Wraps: showView (wW88ShowView: the bar), openPause (wW88OpenPause: not on the rink), wRunAct (wW88RunAct:
   'rinkscrim'), showPage (wW88ShowPage: the game waits while another page is up), renderHelp (wW88RenderHelp:
   #wHelpRink and #wRinkHow). The Settings row goes in by an observer on the modal, as w77's does. */

const W_RINK = {
  home: { kinds: ['vampire', 'harpy', 'witch', 'werewolf', 'troll', 'wraith', 'skeleton', 'lich'], color: '#3a6ab8', light: '#e2eeff', short: 'RHC' },
  away: { city: 'cinderhold', kinds: ['elf', 'goblin', 'kobold', 'minotaur', 'golem', 'gorgon', 'dwarf', 'ogre'], color: '#b8443a', light: '#ffe6e0', short: 'CHC' },
};
const W_RINK_SHOT = { wrist: 'scores', slap: 'scores with a slap shot', one: 'one-times it in', so: 'wins the shootout' };
const W_RINK_STR = { pp: ' on the power play', sh: ' short-handed', even: '', so: '' };
const wRinkMins = () => wHK.rules.minsAt.includes(SET.rinkMins) ? SET.rinkMins : wHK.rules.mins;
// the game on the rink: plain data, never saved
let WHK = null;

$('v-rink').insertAdjacentHTML('beforebegin', `<div id="wRinkBar" class="wdbar" hidden>
  <b id="wRinkTitle">A scrimmage at the Pond Rink</b><span id="wRinkNote" class="hint wsnote"></span>
  <label class="hint" title="How long a game is on the game clock: three periods of a third of it each. The clock stops at every whistle. Also on the Settings panel.">Length <select id="wRinkMins">${wHK.rules.minsAt.map(m => `<option value="${m}">${m} min</option>`).join('')}</select></label>
  <button class="ghost" id="wRinkAgain">Another game</button>
  <button class="ghost" id="wRinkBack">Back to the world</button></div>`);
$('wRinkBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'wRinkAgain') wRinkGame();
  else if (b.id === 'wRinkBack') wLeaveRink();
});
$('wRinkMins').addEventListener('change', e => { SET.rinkMins = +e.target.value; saveSettings(); wRinkBarNote(); });
// under the rink: the box score, every goal, and How hockey works
$('v-rink').insertAdjacentHTML('beforeend', `<h4 class="wsh">Box score</h4><div id="wRinkBox" class="wcbox"></div>
  <h4 class="wsh">This game</h4><ol id="wRinkLog" class="wglog wslog"></ol>
  <p class="hint wghowlink">How hockey works: skating, shots and saves, checks, face-offs and icing. <button class="ghost" id="wRinkHowBtn">How to play hockey</button> <small>The game waits while you read.</small></p>`);
$('wRinkHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wRinkHow'); if (h) h.scrollIntoView({ block: 'start' }); });

// a player's name from the free agents' names for their kind, one nobody else in the game has (used: the names taken)
function wRinkName(kind, used) {
  const base = kind[0].toUpperCase() + kind.slice(1), N = (FA_NAMES[kind] || []).filter(n => !used.has(n));
  let n = N.length ? N[(Math.random() * N.length) | 0] : base;
  for (let k = 2; used.has(n); k++) n = `${base} ${k}`;
  used.add(n); return n;
}
function wRinkTeams() {
  const g = W_GRDS.find(x => x.id === 'g_rink'), H = W_RINK.home, A = W_RINK.away, used = new Set();
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.hockey} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, light: t.light, roster: t.kinds.map((kind, i) => ({ n: wRinkName(kind, used), kind, num: 2 + i * 7 })),
  }));
}
/* one game on the rink. opts: { teams, mins, seed } (the two clubs and the length setting when not given) */
function wRinkGame(opts) {
  const o = opts || {};
  WHK = { over: null };
  wHK.start({ teams: o.teams || wRinkTeams(), mins: o.mins || wRinkMins(), seed: o.seed });
  showView('rink');
  wRinkBarNote(); wRinkBox();
}
function wRinkBarNote() {
  if (!WHK) return;
  const G = wHK.G;
  $('wRinkNote').textContent = WHK.over ? wHK.msg : G ? `${G.teams[0].name} against ${G.teams[1].name}: ${G.mins} minutes in three periods. Level at the end, it goes to sudden death and then a shootout. A scrimmage: nothing is won or lost.` : '';
  $('wRinkMins').value = String(wRinkMins());
}
// every goal so far, oldest first, with the score after it
function wRinkLogHTML() {
  const G = wHK.G, log = G && G.log; if (!log || !log.length) return '<li class="hint">No goals yet.</li>';
  const sc = [0, 0], t = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return log.map(e => { sc[e.side]++; const T = G.teams[e.side];
    return `<li style="border-left-color:${T.color}"><small>${e.k === 'so' ? 'Shootout' : `${esc(wHK.periodName(e.p))} ${t(e.clock)}`} · ${sc[0]}–${sc[1]}</small> <b>${esc(e.who)}</b> ${W_RINK_SHOT[e.k] || 'scores'} for ${esc(T.name)}${W_RINK_STR[e.str] || ''}${e.a && e.a.length ? `, from ${e.a.map(esc).join(' and ')}` : ''}.</li>`; }).join('');
}
// the box score under the rink: each side's skaters with their lines, and the goalie's saves
function wRinkBox() {
  const B = wHK.box(); if (!B) { $('wRinkBox').innerHTML = ''; $('wRinkLog').innerHTML = ''; return; }
  const mins = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`, of = (m, a) => a ? `${m}/${a}` : '–';
  $('wRinkBox').innerHTML = B.map(b => `<table class="wrpow wcboxt"><caption>${esc(b.team)}</caption><tr><th>Player</th><th title="Time on the ice">TOI</th><th title="Goals">G</th><th title="Assists">A</th><th title="Shots on goal">SOG</th><th>Hits</th><th title="Shots blocked">Blk</th><th title="Takeaways">Tk</th><th title="Face-offs won of taken">FO</th><th title="A goalie's saves of shots faced">Sv</th></tr>${b.rows.map(r => `<tr><td>${esc(r.n)} <small>${esc(r.pos)} · ${esc(wKindName(r.kind))}</small></td><td>${mins(r.sec)}</td><td>${r.g}</td><td>${r.a}</td><td>${r.sog}</td><td>${r.hit}</td><td>${r.blk}</td><td>${r.take}</td><td>${of(r.fow, r.fot)}</td><td>${r.pos === 'G' ? of(r.sv, r.sa) : ''}</td></tr>`).join('')}<tr><td><b>Team</b></td><td></td><td><b>${b.tot.g}</b></td><td>${b.tot.a}</td><td>${b.tot.sog}</td><td>${b.tot.hit}</td><td>${b.tot.blk}</td><td>${b.tot.take}</td><td>${of(b.tot.fow, b.tot.fot)}</td><td>${of(b.tot.sv, b.tot.sa)}</td></tr></table>`).join('');
  $('wRinkLog').innerHTML = wRinkLogHTML();
}
function wLeaveRink() {
  WHK = null; wHK.pause(false);
  if (WG) showView('world');
  else { wHK.hide(); showScreen('title'); renderTitle(); }
}
// the box score keeps up at each whistle, not every frame
wHK.onPhase = ph => { if (WHK && UI.view === 'rink' && ['dead', 'break', 'so', 'over'].includes(ph)) wRinkBox(); };
wHK.onOver = s => { if (WHK) { WHK.over = s; wRinkBarNote(); wRinkBox(); $('wRinkAgain').focus(); } };

// the scoreboard strip on a phone (w86): both sides and the score, the period and the clock, and shots on goal
W_SB_VIEWS.rink = 'wSbRink';
W_SB_HTML.rink = function () {
  const G = wHK.G; if (!G || !G.teams) return '';
  const C = wHK.clock(), over = wHK.phase === 'over', live = wHK.phase === 'live';
  return wSbSide(G.teams[0].name, G.teams[0].color, G.score[0], live && G.poss === 0, `<small>Shots ${G.sog[0]}</small>`) + `<div class="wsbmid"><b>${over ? 'Final' : C ? esc(C.name) : ''}</b><small>${over || !C ? '' : esc(C.text)}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, G.score[1], live && G.poss === 1, `<small>Shots ${G.sog[1]}</small>`);
};

const wW88ShowView = showView;
showView = function (v) {
  wW88ShowView(v);
  $('wRinkBar').hidden = v !== 'rink';
  if (v === 'rink') $('runbar').hidden = true;
};
const wW88OpenPause = openPause;
openPause = function () { if (UI.view === 'rink') return; return wW88OpenPause.apply(this, arguments); };
const wW88ShowPage = showPage;
showPage = function (p) {
  wW88ShowPage(p);
  if (WHK && UI.view === 'rink') wHK.pause(p !== 'play');
};

// Old Tove at the Pond Rink puts on a scrimmage (not HOCKEY or GAME: those are how card-game hockey scores, and the match)
(() => {
  const K = DB.chars.gk_rink; if (!K) return;
  K.topics.job.t += ' And we play it for real now, on the ice itself, six a side: ask me for a SCRIMMAGE.';
  K.topics.scrimmage = { t: 'Six of ours against six from Cinderhold. Three periods, and nobody goes home level. Watch from the bank. Mind the puck.', act: 'rinkscrim' };
})();
const wW88RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'rinkscrim') return wRinkGame(); return wW88RunAct.apply(this, arguments); };

// the Settings panel: the game length, under the rest (the panel draws itself again on some changes, so an observer on
// the modal puts the row back whenever it does; it does nothing in any other modal)
function wRinkSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sRinkMins')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Hockey game length</span><select id="sRinkMins">${wHK.rules.minsAt.map(m => `<option value="${m}" ${wRinkMins() === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>`);
  $('sRinkMins').onchange = e => { SET.rinkMins = +e.target.value; saveSettings(); if (WHK) wRinkBarNote(); };
}
new MutationObserver(wRinkSetRow).observe($('modalBox'), { childList: true });

// How to play: Hockey, how it works
function wRinkHowHTML() {
  const R = wHK.rules;
  return `<p class="hint">A game is five skaters and a goalie a side, three periods on the game clock (${R.mins} minutes in all unless you change it in Settings: ${R.minsAt.join(', ')}). The clock stops at every whistle. Play starts, and starts again, with a <b>face-off</b>: the two centres go for the dropped puck, hands and size against hands and size, and the winner draws it back.</p>
  <p class="hint"><b>Skating.</b> Nobody stops on ice. Players build speed, turn in arcs and glide, so a skater who misses is out of the play for a moment.</p>
  <p class="hint"><b>The puck</b> is loose a lot: off a stick, off the boards, out of a corner. Whoever gets there first has it, and two who arrive together fight for it on hands and size. A pass through a defender's reach can be picked off.</p>
  <p class="hint"><b>Shots.</b> The wrist shot is quick. The slap shot is harder, but takes a wind-up, and a checker can take the puck during it. The one-timer, shot as a pass arrives, is the hardest to stop. A shot can be blocked by a skater in its way, miss the net, be saved, or go in. A save is held, or comes loose in front as a <b>rebound</b>.</p>
  <p class="hint"><b>The goalie</b> stands on the line between the puck and the net, but follows the puck a moment late. A shot from where they are set is hard to score on. A pass <b>across the front of the net</b> and a quick shot finds them out of place, and that is how most goals come. A teammate standing in front of the goalie hides the shot.</p>
  <p class="hint"><b>Checks.</b> The skater nearest the puck carrier goes at them. Up close they poke at the puck (defense against hands), or, closing fast, throw a body check (size and speed) that knocks the carrier off it.</p>
  <p class="hint"><b>Icing.</b> A puck sent from a side's own half that crosses the far goal line untouched comes back for a face-off in that side's end. There is no offside.</p>
  <p class="hint"><b>Level after three periods,</b> it goes to sudden death at three skaters a side: the next goal wins. Still level, a shootout: ${R.so} shooters each, then one each until it is settled. A hockey game never ends level.</p>
  <p class="hint"><b>Ratings.</b> Six for each player: speed, size, hands, shot, defense and reflexes. An ogre hits like a wall and skates like one, a harpy is the fastest thing on the ice, and a spider in goal has eight ways to stop a puck. <b>The spots:</b> a centre, two wings, two defenders and the goalie, picked from the ratings for now.</p>`;
}
const wW88RenderHelp = renderHelp;
renderHelp = function () {
  wW88RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpRink') || !$('wHelpGrounds')) return;
  const after = $('wHelpCourt') || [...h.querySelectorAll('[id^="wHelpG"], #wHelpRing')].pop();
  h.insertAdjacentHTML('beforeend', `<section id="wRinkHow" class="wghelp"><h3>Hockey: how it works</h3>${wRinkHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRink"><b>Real hockey.</b> The Pond Rink is trying out hockey on the ice itself, five skaters and a goalie a side. Ask Old Tove for a SCRIMMAGE: three periods on the game clock (six minutes in all, or set the length in Settings). Watch the two clubs skate it end to end: passes, shots and saves, rebounds, checks, face-offs and icing, with a box score under the rink (see Hockey: how it works). A SCRIMMAGE is an exhibition: nothing is won or lost.</p>`);
};
