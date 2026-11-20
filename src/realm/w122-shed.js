/* w122: the Curling Shed (issue #102, phase 2). The Curling Shed, the curling engine, runs in the wCR scope (src/cr/ and
   src/realm/shed/: a canvas in #v-shed, and none of its names reach ours). This part gives it a view beside the world,
   laid out as the other sports' pages are (w87): the bar with the status line under it, the ice, your stone's rows,
   the end board, then This game (every end).
   A game is Saltmere's rink of four against a visiting rink from Rimewatch: 6 ends (or 4 or 8: SET.shedEnds, on the bar
   and the Settings panel), each curler two stones an end. Ask Brush Hennock at the Shed to CURL (GAME and CURLING stay
   the card-game match and how it scores). Nothing is won or lost, and nothing is saved.
   Two modes on the bar (W_SHED_MODES): Watch (the CPU throws both sides) and You play (your stones are yours: the keys
   are in n1-page.js, and the rows under the ice do the same with a mouse or a finger). Switching goes on with the same
   game; the last one picked is kept for the next (not saved).
   The rows, in You play on your stone: Shot (draw, guard, freeze, takeout, peel, hit and roll), Broom (where your skip
   holds it), Handle (in-turn or out-turn), and Throw (with your skip's call again); while your stone slides, Sweep
   (hold it, as you hold Space).
   On a phone the scoreboard strip (w86) covers the Shed too: W_SB_VIEWS.shed and W_SB_HTML.shed.
   Wraps: showView (wW122ShowView: the bar), openPause (wW122OpenPause: not at the Shed), wRunAct (wW122RunAct:
   'shedcurl'), showPage (wW122ShowPage: the game waits while another page is up), renderHelp (wW122RenderHelp:
   #wHelpShed and #wShedHow). The Settings row goes in by an observer on the modal, as w113's does. */

const W_SHED = {
  home: { kinds: ['wraith', 'spider', 'troll', 'gorgon'], color: '#b83a3a', short: 'SAL' },
  away: { city: 'rimewatch', kinds: ['witch', 'harpy', 'lich', 'skeleton'], color: '#3a7ab8', short: 'RIM' },
};
const W_SHED_MODES = {
  watch: { n: 'Watch', title: 'The CPU throws both sides. Switching goes on with the same game.' },
  play: { n: 'You play', title: 'You throw for the first rink on the board: pick the shot, put the broom down, pick the handle and throw (Space twice), then hold Space to sweep.' },
};
let W_SHED_MODE = 'play', W_SHED_SPEED = 1, W_SHED_SKILL = 1;
const wShedEnds = () => wCR.rules.endsAt.includes(SET.shedEnds) ? SET.shedEnds : wCR.rules.ends;
// the game on the ice: plain data, never saved
let WCR = null;

$('v-shed').insertAdjacentHTML('beforebegin', `<div id="wShedBar" class="wdbar" hidden>
  <b id="wShedTitle">A game at the Curling Shed</b><span id="wShedNote" class="hint wsnote"></span>
  <span id="wShedModes" class="wgmodes" role="group" aria-label="Who throws">${Object.entries(W_SHED_MODES).map(([k, m]) => `<button class="ghost" data-cmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <label class="hint" title="How many ends a game is. Also on the Settings panel.">Ends <select id="wShedEnds">${wCR.rules.endsAt.map(m => `<option value="${m}">${m}</option>`).join('')}</select></label>
  <label class="hint" title="How well the other rink curls: a Squire doesn't think about the hammer, reads the fresh pebble and misses more; a Knight weighs the house and the hammer; an Archmage reads the ice as it is now and misses least.">Their rink <select id="wShedSkill">${wCR.skills.map((S, i) => `<option value="${i}">${S.n}</option>`).join('')}</select></label>
  <label class="hint" id="wShedSpeedL" title="How fast the game runs while you watch. In You play it is always 1.">Speed <select id="wShedSpeed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
  <button class="ghost" id="wShedAgain">Another game</button>
  <button class="ghost" id="wShedBack">Back to the world</button></div>`);
$('wShedBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.cmode) { W_SHED_MODE = b.dataset.cmode; if (WCR && !WCR.over) wCR.setMode(W_SHED_MODE); wShedBarNote(); wShedRows(); }
  else if (b.id === 'wShedAgain') wShedGame();
  else if (b.id === 'wShedBack') wLeaveShed();
});
function wShedSpeedSet() { const play = wCR.mode === 'play'; wCR.speed = play ? 1 : W_SHED_SPEED; $('wShedSpeedL').hidden = play || !WCR || !!WCR.over; $('wShedSpeed').value = String(W_SHED_SPEED); }
$('wShedSkill').addEventListener('change', e => { W_SHED_SKILL = +e.target.value; e.target.blur(); $('wShedNote').textContent = `Their rink: ${wCR.skills[W_SHED_SKILL].n}s, from the next game.`; });
$('wShedSpeed').addEventListener('change', e => { W_SHED_SPEED = +e.target.value || 1; wShedSpeedSet(); e.target.blur(); });
$('wShedEnds').addEventListener('change', e => { SET.shedEnds = +e.target.value; saveSettings(); wShedBarNote(); e.target.blur(); });

// under the ice: your stone's rows, the end board, this game, and How curling works
const W_SHED_SHOTS = [['draw', 'Draw', 'To rest where the broom is'], ['guard', 'Guard', 'To rest in front of the house, to hide a stone behind'], ['freeze', 'Freeze', 'To rest touching a stone, so it can\'t be taken out cleanly'],
  ['takeout', 'Takeout', 'Hit a stone out of play'], ['peel', 'Peel', 'Hit a guard out, and roll out too'], ['hitroll', 'Hit and roll', 'Hit a stone out, and roll into the house']];
$('v-shed').insertAdjacentHTML('beforeend', `<div id="wShedRows" class="wccalls wscoach" hidden>
  <div class="wccrow"><span class="wccl">Shot</span><span id="wShedShot"></span></div>
  <div class="wccrow"><span class="wccl">Broom</span><span id="wShedBroom"></span></div>
  <div class="wccrow"><span class="wccl">Handle</span><span id="wShedHandle"></span></div>
  <div class="wccrow"><span class="wccl">Throw</span><span id="wShedGo"></span></div></div>
  <div id="wShedSweepRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Sweep</span><span><button class="ghost" id="wShedSweep">Hold to sweep</button> <small class="hint" id="wShedCall"></small></span></div></div>
  <h4 class="wsh">The end board</h4><div id="wShedBoard" class="wcbox"></div>
  <h4 class="wsh">This game</h4><ol id="wShedLog" class="wglog wslog"></ol>
  <p class="hint wghowlink">How curling works here: the end, the hammer, the house, the throw and the sweep. <button class="ghost" id="wShedHowBtn">How to play curling</button> <small>The game waits while you read.</small></p>`);
$('wShedHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wShedHow'); if (h) h.scrollIntoView({ block: 'start' }); });
$('wShedRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset, S = wCR.view && wCR.view.sel; if (!S && !d.cgo) return;
  let why = '';
  if (d.cshot) why = wCR.select({ shot: d.cshot });
  else if (d.cbx) why = wCR.select({ x: S.x + +d.cbx });
  else if (d.cby) why = wCR.select({ y: S.y + +d.cby });
  else if (d.ch) why = wCR.select({ h: +d.ch });
  else if (d.csuggest) why = wCR.select({ suggest: true });
  else if (d.cgo) wCR.press();
  else return;
  if (why) $('wShedNote').textContent = why;
  wShedRows(); if (!why) wShedBarNote();
});
// the Sweep button: held, as Space is held
for (const [ev, on] of [['pointerdown', true], ['pointerup', false], ['pointerleave', false], ['pointercancel', false]]) $('wShedSweep').addEventListener(ev, e => { if (WCR) { wCR.sweep = on; e.preventDefault(); } });
// the rows: your stone's call while you set it up, Sweep while it slides
function wShedRows() {
  const box = $('wShedRows'), V = WCR && !WCR.over && wCR.G && wCR.G.teams ? wCR.view : null, mine = V && V.mode === 'play' && (V.ph === 'aim' || V.ph === 'swing') && V.sel;
  const L = wCR.live, sliding = !!V && V.mode === 'play' && V.ph === 'slide' && L && L.s === V.you;
  $('wShedSweepRow').hidden = !sliding; if (sliding) $('wShedCall').textContent = V.call || '';
  box.hidden = !mine; if (!mine) return;
  const S = V.sel, aim = V.ph === 'aim', on = (a, b) => a === b ? ' on' : '', dis = aim ? '' : 'disabled', hit = ['takeout', 'peel', 'hitroll'].includes(S.shot);
  $('wShedShot').innerHTML = W_SHED_SHOTS.map(([k, n, t], i) => `<button class="ghost${on(k, S.shot)}" data-cshot="${k}" ${dis} title="${i + 1}: ${esc(t)}">${n}</button>`).join(' ');
  $('wShedBroom').innerHTML = hit ? `<small class="hint">On the stone to hit: click another stone in the house to change it.</small>`
    : `<button class="ghost" data-cbx="6" ${dis} title="Left arrow">◀</button> <button class="ghost" data-cbx="-6" ${dis} title="Right arrow">▶</button> <button class="ghost" data-cby="-12" ${dis} title="Down arrow: a foot nearer">▼</button> <button class="ghost" data-cby="12" ${dis} title="Up arrow: a foot further">▲</button> <small class="hint">Or click the house where you want it.</small>`;
  $('wShedHandle').innerHTML = [[1, 'Out-turn', 'O: it curls to the left'], [-1, 'In-turn', 'I: it curls to the right']].map(([h, n, t]) => `<button class="ghost${on(h, S.h)}" data-ch="${h}" ${dis} title="${esc(t)}">${n}</button>`).join(' ');
  const M = V.meter, st = V.ph !== 'swing' || !M ? 'Start' : 'Weight';
  $('wShedGo').innerHTML = `<button class="ghost on" data-cgo="1" title="Space">${st}</button> <button class="ghost" data-csuggest="1" ${dis} title="G: your skip's call for this stone">Skip's call</button> <small class="hint">Two presses: start, then stop on the yellow line for the call's weight (early is light, late is heavy). Then hold Space to sweep.</small>`;
}
// the two rinks; taken: names already in the game, so nobody shares one
function wShedTeams(taken) {
  const g = W_GRDS.find(x => x.id === 'g_shed'), H = W_SHED.home, A = W_SHED.away, used = new Set(taken || []);
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.curling} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, roster: t.kinds.map(kind => ({ n: wRinkName(kind, used), kind })),
  }));
}
/* one game at the Shed. opts: { teams, ends, seed, mode, title, cold, skill } */
function wShedGame(opts) {
  const o = opts || {};
  WCR = { over: null };
  $('wShedTitle').textContent = o.title || 'A game at the Curling Shed';
  // (anything else the game is given goes through to the engine: the Shed's ways, powers, and what later parts add)
  const { title, ...rest } = o;
  wCR.start(Object.assign({}, rest, { teams: o.teams || wShedTeams(), ends: o.ends || wShedEnds(), seed: o.seed, mode: o.mode || W_SHED_MODE, cold: o.cold || 'mid', skill: o.skill || [1, W_SHED_SKILL], hammer: o.hammer }));
  showView('shed');
  wShedBarNote(); wShedRows(); wShedBoard();
}
function wShedBarNote() {
  if (!WCR) return;
  const mode = WCR.over ? W_SHED_MODE : wCR.mode || W_SHED_MODE;
  for (const b of $('wShedModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.cmode === mode); b.setAttribute('aria-pressed', b.dataset.cmode === mode); }
  wShedSpeedSet();
  const G = wCR.G, later = !WCR.over && G && G.ends !== wShedEnds();
  $('wShedNote').textContent = (wCR.msg || '') + (later ? ` (Ends: ${wShedEnds()} from the next game; this one is ${G.ends}.)` : '');
  $('wShedEnds').value = String(wShedEnds());
  $('wShedSkill').value = String(W_SHED_SKILL);
}
// the end board: a column an end, each side's points, the hammer, the totals
function wShedBoard() {
  const G = wCR.G; if (!G || !G.teams) { $('wShedBoard').innerHTML = ''; $('wShedLog').innerHTML = ''; return; }
  const B = wCR.board(), cols = []; for (let i = 0; i < B.ends; i++) cols.push(i);
  const row = s => `<tr><td style="border-left:4px solid ${G.teams[s].color || '#888'}">${esc(G.teams[s].name)}${B.hammer === s && !G.over ? ' <small title="The hammer: the last stone of the end">●</small>' : ''}</td>${cols.map(i => `<td>${B.sc[s][i] == null ? '' : B.sc[s][i]}</td>`).join('')}<td><b>${B.tot[s]}</b></td></tr>`;
  const head = `<tr><th></th>${cols.map(i => `<th${i >= G.ends ? ' title="An extra end"' : ''}>${i >= G.ends ? 'X' + (i - G.ends + 1) : i + 1}</th>`).join('')}<th>Total</th></tr>`;
  $('wShedBoard').innerHTML = `<div style="overflow-x:auto;max-width:100%"><table class="wrpow wcboxt"><caption>${esc(G.teams[0].name)}: ${esc(wCR.matchText(0))}</caption>${head}${row(0)}${row(1)}</table></div>`;
  $('wShedLog').innerHTML = wShedLogHTML();
}
// every end so far, newest first: who scored, or a blank
function wShedLogHTML() {
  const G = wCR.G; if (!G.log.length) return '<li class="hint">No ends played yet.</li>';
  return G.log.slice().reverse().map(e => e.s < 0 ? `<li><small>End ${e.end}</small> A blank: nobody scores${e.extra ? ' (an extra end)' : ''}.</li>`
    : `<li style="border-left-color:${G.teams[e.s].color}"><small>End ${e.end}</small> ${esc(G.teams[e.s].name)} score <b>${e.n}</b>${e.extra ? ' (an extra end)' : ''}.</li>`).join('');
}
function wLeaveShed() {
  WCR = null; wCR.pause(false);
  if (WG) showView('world');
  else { wCR.hide(); showScreen('title'); renderTitle(); }
}
let W_SHED_BOARDKEY = '';
wCR.onPhase = ph => {
  if (!WCR) return; wShedBarNote(); wShedRows();
  if (ph === 'slide') return;   // (the board waits for the stones to settle, as the status line does)
  const G = wCR.G, key = G ? [G.n, !!G.over, G.end].join('|') : '';
  if (key !== W_SHED_BOARDKEY) { W_SHED_BOARDKEY = key; wShedBoard(); }
};
wCR.onPick = () => { if (WCR) { wShedRows(); wShedBarNote(); } };
wCR.onOver = s => { if (WCR) { WCR.over = s; wShedBarNote(); wShedRows(); wShedBoard(); $('wShedAgain').focus(); } };
// the skip's call while your stone slides: the Sweep row's text follows it
setInterval(() => { if (WCR && UI.view === 'shed' && !$('wShedSweepRow').hidden) $('wShedCall').textContent = (wCR.view || {}).call || ''; }, 200);

// the scoreboard strip on a phone (w86): both sides' totals, and the end
W_SB_VIEWS.shed = 'wSbShed';
W_SB_HTML.shed = function () {
  const G = wCR.G, V = wCR.view; if (!G || !G.teams || !V) return '';
  return wSbSide(G.teams[0].name, G.teams[0].color, wCR.total(0), G.hammer === 0 && !G.over, '') + `<div class="wsbmid"><b>${G.over ? 'Final' : 'End ' + Math.min(V.end, wCR.board().ends)}</b><small>${esc(wCR.matchText(0))}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, wCR.total(1), G.hammer === 1 && !G.over, '');
};

const wW122ShowView = showView;
showView = function (v) {
  wW122ShowView(v);
  $('wShedBar').hidden = v !== 'shed';
  if (v === 'shed') $('runbar').hidden = true;
};
const wW122OpenPause = openPause;
openPause = function () { if (UI.view === 'shed') return; return wW122OpenPause.apply(this, arguments); };
const wW122ShowPage = showPage;
showPage = function (p) {
  wW122ShowPage(p);
  if (WCR && UI.view === 'shed') wCR.pause(p !== 'play');
};

// Brush Hennock at the Shed puts on a game (not CURLING or GAME: those are how card-game curling scores, and the match)
(() => {
  const K = DB.chars.gk_shed; if (!K) return;
  K.topics.job.t += ' And we curl it for real now, on the sheets themselves, four a side: ask me to CURL.';
  K.topics.curl = { t: 'Four of ours against four from Rimewatch. Two stones each, sixteen an end, the house at the far end. Sweep when your skip shouts. Mind the pebble: it wears.', act: 'shedcurl' };
})();
const wW122RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'shedcurl') return wShedGame(); return wW122RunAct.apply(this, arguments); };

// the Settings panel: how many ends a game is (the observer puts the row back whenever the panel redraws)
function wShedSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sShedEnds')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Curling ends</span><select id="sShedEnds">${wCR.rules.endsAt.map(m => `<option value="${m}" ${wShedEnds() === m ? 'selected' : ''}>${m} ends</option>`).join('')}</select></label>`);
  $('sShedEnds').onchange = e => { SET.shedEnds = +e.target.value; saveSettings(); if (WCR) wShedBarNote(); };
}
new MutationObserver(wShedSetRow).observe($('modalBox'), { childList: true });

// How to play: Curling, how it works
function wShedHowHTML() {
  const R = wCR.rules;
  return `<p class="hint">A game is two rinks of four: the <b>lead</b>, the <b>second</b>, the <b>third</b> and the <b>skip</b>. An <b>end</b> is sixteen stones: each curler throws two, the rinks taking turns, lead first and skip last. A game is ${R.ends} ends (or ${R.endsAt.join(', ')} in Settings).</p>
  <p class="hint"><b>Scoring.</b> After the sixteenth stone, the rink with the stone nearest the <b>button</b> (the middle of the house) scores one for every stone of theirs nearer than the other rink's nearest. Only stones touching the house's rings count. Nothing in the house is a <b>blank end</b>. Level after the last end: an extra end.</p>
  <p class="hint"><b>The hammer</b> is the last stone of an end, and it is a big advantage. The rink that scores gives it up for the next end; after a blank it stays. With the hammer you want two or more, or a blank to keep it; without it you want to <b>steal</b> (score without the hammer).</p>
  <p class="hint"><b>The free guard zone.</b> A stone short of the house, past the hog line, is a guard. Until the fifth stone of an end, a stone may not knock the other rink's guard out of play: if it does, the guard goes back and your stone is removed.</p>
  <p class="hint"><b>Your stone.</b> Your skip calls a shot and holds the broom where to aim. A <b>draw</b> comes to rest at the broom, a <b>guard</b> short of the house, a <b>freeze</b> touching a stone, a <b>takeout</b> hits a stone out, a <b>peel</b> hits a guard out and rolls away, a <b>hit and roll</b> hits and rolls into the house. Change the shot (1 to 6), move the broom (the arrows, or click the house) and pick the <b>handle</b>: out-turn (O) curls left, in-turn (I) curls right. A stone curls most as it slows.</p>
  <p class="hint"><b>The throw.</b> Space twice: once to start, once on the <b>yellow line</b> for the call's weight. Early is light, late is heavy. On a phone, drag back from the hack and let go: the further you pull, the heavier.</p>
  <p class="hint"><b>Sweeping.</b> While your stone slides, hold Space (or the Sweep button) to sweep: a swept stone goes further and curls less. Your skip calls it: "Hurry hard!" when it will stop well short, "Sweep!" a little short, "Off!" when it has the weight, "Whoa!" when it is heavy. A light stone can be swept home; a heavy one can't be stopped.</p>
  <p class="hint"><b>The ice</b> is pebbled, and the pebble wears where stones go: worn ice is keener (a stone runs further). The Shed's cold changes the whole sheet: heavy on a warm day, keen after a hard frost.</p>
  <p class="hint"><b>Their rink</b> (on the bar): a <b>Squire</b> doesn't think about the hammer, reads the fresh pebble and misses more; a <b>Knight</b> weighs the house and the hammer, and reads the ice as it was when the end began; an <b>Archmage</b> reads the ice as it is now and misses least. <b>Watch</b> hands both rinks to the CPU, and Speed on the bar runs it faster.</p>`;
}
const wW122RenderHelp = renderHelp;
renderHelp = function () {
  wW122RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpShed') || !$('wHelpGrounds')) return;
  const after = $('wHelpLanes') || $('wHelpLinks') || [...h.querySelectorAll('[id^="wHelpG"]')].pop();
  h.insertAdjacentHTML('beforeend', `<section id="wShedHow" class="wghelp"><h3>Curling: how it works</h3>${wShedHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShed"><b>Real curling.</b> The Curling Shed plays curling on the ice itself now, four a side. Ask Brush Hennock to CURL: a game of ${wCR.rules.ends} ends. Call the shot, put the broom down, pick the handle and throw, then sweep it home; or watch the two rinks play it out, with the end board under the ice (see Curling: how it works). It is an exhibition: nothing is won or lost.</p>`);
};
