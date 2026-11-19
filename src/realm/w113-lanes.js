/* w113: the Lanes (issue #100, phase 2). The Saltmere Lanes, the bowling engine, runs in the wBL scope (src/bl/ and
   src/realm/lanes/: a canvas in #v-lanes, and none of its names reach ours). This part gives it a view beside the
   world, laid out as the other sports' pages are (w87): the bar with the status line under it, the lanes, the coach's
   rows (your ball), the sheet, then This game (every frame).
   A game is five of Saltmere's against five visitors from Graftonbury, the Baker format: one team game of ten frames
   (or 5: SET.lanesFrames, on the bar and the Settings panel), the five taking the frames in turn. Ask Moll Gutter at
   the Lanes to BOWL (GAME and BOWLING stay the card-game match and how it scores). Nothing is won or lost, and
   nothing is saved.
   Two modes on the bar (W_LANES_MODES): Watch (the CPU bowls both sides) and You play (your ball is yours: the keys
   are in n1-page.js, and the rows under the lanes do the same with a mouse or a finger). Switching goes on with the
   same game; the last one picked is kept for the next (not saved).
   The rows, in You play on your ball: Feet (the board you stand on), Arrow (the arrow you roll over), Ball (strike or
   spare), Revs (less, normal, more), and Bowl (with the coach's suggestion again).
   On a phone the scoreboard strip (w86) covers the Lanes too: W_SB_VIEWS.lanes and W_SB_HTML.lanes.
   Wraps: showView (wW113ShowView: the bar), openPause (wW113OpenPause: not on the Lanes), wRunAct (wW113RunAct:
   'lanesbowl'), showPage (wW113ShowPage: the game waits while another page is up), renderHelp (wW113RenderHelp:
   #wHelpLanes and #wLanesHow). The Settings row goes in by an observer on the modal, as w105's does. */

const W_LANES = {
  home: { kinds: ['zombie', 'troll', 'gorgon', 'wraith', 'spider'], color: '#9b3a7a', short: 'SAL' },
  away: { city: 'graftonbury', kinds: ['dwarf', 'goblin', 'elf', 'ogre', 'kobold'], color: '#c9a03a', short: 'GRA' },
};
const W_LANES_MODES = {
  watch: { n: 'Watch', title: 'The CPU bowls both sides. Switching goes on with the same game.' },
  play: { n: 'You play', title: 'You bowl for Saltmere: set your feet and your arrow, pick the ball and the revs, and bowl (Space three times, or drag up the lane from the bowler).' },
};
let W_LANES_MODE = 'play', W_LANES_SPEED = 1, W_LANES_SKILL = 1;
const wLanesFrames = () => wBL.rules.framesAt.includes(SET.lanesFrames) ? SET.lanesFrames : wBL.rules.frames;
// the game on the lanes: plain data, never saved
let WBL = null;

$('v-lanes').insertAdjacentHTML('beforebegin', `<div id="wLanesBar" class="wdbar" hidden>
  <b id="wLanesTitle">A game at the Saltmere Lanes</b><span id="wLanesNote" class="hint wsnote"></span>
  <span id="wLanesModes" class="wgmodes" role="group" aria-label="Who bowls it">${Object.entries(W_LANES_MODES).map(([k, m]) => `<button class="ghost" data-nmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <label class="hint" title="How many frames a game is. Also on the Settings panel.">Frames <select id="wLanesFrames">${wBL.rules.framesAt.map(m => `<option value="${m}">${m}</option>`).join('')}</select></label>
  <label class="hint" title="How well the other side bowls: a Squire picks from two stands and makes the easy spares; a Knight tries more stands and corrects by what it sees; an Archmage reads the oil as it is now and picks its line.">Their bowlers <select id="wLanesSkill">${wBL.skills.map((S, i) => `<option value="${i}">${S.n}</option>`).join('')}</select></label>
  <label class="hint" id="wLanesSpeedL" title="How fast the game runs while you watch. In You play it is always 1.">Speed <select id="wLanesSpeed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
  <button class="ghost" id="wLanesAgain">Another game</button>
  <button class="ghost" id="wLanesBack">Back to the world</button></div>`);
$('wLanesBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.nmode) { W_LANES_MODE = b.dataset.nmode; if (WBL && !WBL.over) wBL.setMode(W_LANES_MODE); wLanesBarNote(); wLanesRows(); }
  else if (b.id === 'wLanesAgain') wLanesGame();
  else if (b.id === 'wLanesBack') wLeaveLanes();
});
function wLanesSpeedSet() { const play = wBL.mode === 'play'; wBL.speed = play ? 1 : W_LANES_SPEED; $('wLanesSpeedL').hidden = play || !WBL || !!WBL.over; $('wLanesSpeed').value = String(W_LANES_SPEED); }
$('wLanesSkill').addEventListener('change', e => { W_LANES_SKILL = +e.target.value; e.target.blur(); $('wLanesNote').textContent = `Their bowlers: ${wBL.skills[W_LANES_SKILL].n}s, from the next game.`; });
$('wLanesSpeed').addEventListener('change', e => { W_LANES_SPEED = +e.target.value || 1; wLanesSpeedSet(); e.target.blur(); });
$('wLanesFrames').addEventListener('change', e => { SET.lanesFrames = +e.target.value; saveSettings(); wLanesBarNote(); e.target.blur(); });

// under the lanes: your ball's rows, the sheet, this game, and How bowling works
$('v-lanes').insertAdjacentHTML('beforeend', `<div id="wLanesRows" class="wccalls wscoach" hidden>
  <div class="wccrow"><span class="wccl">Feet</span><span id="wLanesFeet"></span></div>
  <div class="wccrow"><span class="wccl">Arrow</span><span id="wLanesArrow"></span></div>
  <div class="wccrow"><span class="wccl">Ball</span><span id="wLanesBall"></span></div>
  <div class="wccrow"><span class="wccl">Revs</span><span id="wLanesRevs"></span></div>
  <div class="wccrow"><span class="wccl">Bowl</span><span id="wLanesGo"></span></div></div>
  <h4 class="wsh">The sheet</h4><div id="wLanesSheet" class="wcbox"></div>
  <h4 class="wsh">This game</h4><ol id="wLanesLog" class="wglog wslog"></ol>
  <p class="hint wghowlink">How bowling works here: the Baker order, the sheet, the throw, the oil and the tide. <button class="ghost" id="wLanesHowBtn">How to play bowling</button> <small>The game waits while you read.</small></p>`);
$('wLanesHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wLanesHow'); if (h) h.scrollIntoView({ block: 'start' }); });
$('wLanesRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset, S = wBL.view && wBL.view.sel; if (!S && !d.ngo) return;
  if (d.nfeet) wBL.select({ stand: S.stand + +d.nfeet });
  else if (d.narrow) wBL.select({ arrow: S.arrow + +d.narrow });
  else if (d.nball) wBL.select({ ball: d.nball });
  else if (d.nrevs) wBL.select({ revs: d.nrevs });
  else if (d.nsuggest) wBL.select({ suggest: true });
  else if (d.ngo) wBL.press();
  else return;   // (another row's button: its own handler draws the rows)
  wLanesRows(); wLanesBarNote();
});
// the rows: shown on your ball in You play
function wLanesRows() {
  const box = $('wLanesRows'), V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null, mine = V && V.mode === 'play' && (V.ph === 'aim' || V.ph === 'swing') && V.sel;
  box.hidden = !mine; if (!mine) return;
  const S = V.sel, aim = V.ph === 'aim', on = (a, b) => a === b ? ' on' : '', dis = aim ? '' : 'disabled';
  $('wLanesFeet').innerHTML = `<button class="ghost" data-nfeet="1" ${dis} title="Left arrow: a board to the left">◀</button> <b>board ${S.stand}</b> <button class="ghost" data-nfeet="-1" ${dis} title="Right arrow: a board to the right">▶</button> <small class="hint">where you release the ball (the boards count from the right, 20 is the middle)</small>`;
  $('wLanesArrow').innerHTML = `<button class="ghost" data-narrow="0.5" ${dis} title="A or the up arrow: half a board left">◀</button> <b>board ${S.arrow}</b> <button class="ghost" data-narrow="-0.5" ${dis} title="D or the down arrow: half a board right">▶</button> <small class="hint">the arrows are 15 feet down: aim over one, not at the pins</small>`;
  $('wLanesBall').innerHTML = [['strike', 'Strike ball', 'Reactive: it skids, then hooks into the pocket'], ['spare', 'Spare ball', 'Plastic: it rolls dead straight, for spares and corner pins']].map(([k, n, t]) => `<button class="ghost${on(k, S.ball)}" data-nball="${k}" ${dis} title="B: ${esc(t)}">${n}</button>`).join(' ');
  $('wLanesRevs').innerHTML = Object.keys(wBL.revs).map(k => `<button class="ghost${on(k, S.revs)}" data-nrevs="${k}" ${dis} title="R: ${k === 'more' ? 'more hook and more pin action, harder to control' : k === 'less' ? 'a straighter, earlier roll' : 'the bowler\'s own'}">${k[0].toUpperCase() + k.slice(1)}</button>`).join(' ');
  const M = V.meter, st = V.ph !== 'swing' || !M ? 'Start' : M.st === 'up' ? 'Speed' : 'Release';
  $('wLanesGo').innerHTML = `<button class="ghost on" data-ngo="1" title="Space">${st}</button> <button class="ghost" data-nsuggest="1" ${dis} title="G: the coach's read of the lane for this ball">Coach's line</button> <small class="hint">Three presses: start, stop at the yellow line for the speed, then stop inside the green block at the foul line. Or drag up the lane from the bowler and let go.</small>`;
}
// the two clubs; taken: names already in the game, so nobody shares one
function wLanesTeams(taken) {
  const g = W_GRDS.find(x => x.id === 'g_lanes'), H = W_LANES.home, A = W_LANES.away, used = new Set(taken || []);
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.bowling} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, roster: t.kinds.map(kind => ({ n: wRinkName(kind, used), kind })),
  }));
}
/* one game at the Lanes. opts: { teams, frames, seed, mode, title, tide, skill, hall, powers, autoPow } */
function wLanesGame(opts) {
  const o = opts || {};
  WBL = { over: null };
  $('wLanesTitle').textContent = o.title || 'A game at the Saltmere Lanes';
  wBL.start({ teams: o.teams || wLanesTeams(), frames: o.frames || wLanesFrames(), seed: o.seed, mode: o.mode || W_LANES_MODE, tide: o.tide || (typeof wTide === 'function' ? wTide() : 'mid'), skill: o.skill || [1, W_LANES_SKILL], hall: !!o.hall, powers: o.powers, autoPow: o.autoPow, bags: o.bags });
  showView('lanes');
  wLanesBarNote(); wLanesRows(); wLanesSheet();
}
function wLanesBarNote() {
  if (!WBL) return;
  const mode = WBL.over ? W_LANES_MODE : wBL.mode || W_LANES_MODE;
  for (const b of $('wLanesModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.nmode === mode); b.setAttribute('aria-pressed', b.dataset.nmode === mode); }
  wLanesSpeedSet();
  const G = wBL.G, later = !WBL.over && G && G.frames !== wLanesFrames();
  $('wLanesNote').textContent = (wBL.msg || '') + (later ? ` (Frames: ${wLanesFrames()} from the next game; this one is ${G.frames}.)` : '');
  $('wLanesFrames').value = String(wLanesFrames());
  $('wLanesSkill').value = String(W_LANES_SKILL);
}
// the sheet: a column a frame, each with its balls (X, /, -) and the running total; a split's first ball is circled
function wLanesSheet() {
  const G = wBL.G; if (!G || !G.teams) { $('wLanesSheet').innerHTML = ''; $('wLanesLog').innerHTML = ''; return; }
  const M = [wBL.marks(0), wBL.marks(1)], cols = []; for (let i = 0; i < G.frames; i++) cols.push(i);
  const ro = M[0].ro || M[1].ro ? [0, 1] : [];
  const cell = (f, last) => { if (!f) return `<td class="wnf"><div class="wnb">${last ? '<span></span><span></span><span></span>' : '<span></span><span></span>'}</div><div class="wnt">&nbsp;</div></td>`;
    const b = f.b.map((m, i) => `<span${i === 0 && f.split ? ' class="wnsp"' : ''}>${m === 'X' && !last && i === 0 ? '' : m}</span>`), pad = (last ? 3 : 2) - b.length;
    const balls = !last && f.b[0] === 'X' ? '<span></span><span>X</span>' : b.join('') + '<span></span>'.repeat(Math.max(0, pad));
    return `<td class="wnf"><div class="wnb">${balls}</div><div class="wnt">${f.score == null ? '&nbsp;' : f.score}</div></td>`; };
  const row = s => `<tr><td style="border-left:4px solid ${G.teams[s].color || '#888'}">${esc(G.teams[s].name)}</td>${cols.map(i => cell(M[s].game[i], i === G.frames - 1)).join('')}${ro.map(i => cell(M[s].ro && M[s].ro[i], i === 1)).join('')}<td><b>${G.ro ? wBL.score(G.fr[s], G.frames).filter(v => v != null).pop() || 0 : wBL.total(s)}</b>${G.ro ? `<br><small>roll-off ${wBL.total(s)}</small>` : ''}</td></tr>`;
  const head = `<tr><th></th>${cols.map(i => `<th>${i + 1}</th>`).join('')}${ro.map(i => `<th title="The roll-off">${i ? 'R10' : 'R9'}</th>`).join('')}<th>Total</th></tr>`;
  $('wLanesSheet').innerHTML = `<div style="overflow-x:auto;max-width:100%"><table class="wrpow wcboxt wnsheet"><caption>${esc(G.teams[0].name)}: ${esc(wBL.matchText(0))}</caption>${head}${row(0)}${row(1)}</table></div>`;
  $('wLanesLog').innerHTML = wLanesLogHTML();
}
// every frame finished so far, newest first: the bowler, the marks, the total
function wLanesLogHTML() {
  const G = wBL.G, out = [];
  for (const s of [0, 1]) wBL.marks(s).game.forEach((f, i) => { if (f.score == null && !(f.b.length && (f.b[0] === 'X' || f.b.length >= 2))) return;
    const L = G.log.find(e => e[0] === s && e[2] === i + 1), ri = L ? L[1] : G.order[s][i % wBL.rules.side], m = G.teams[s].roster[ri];
    out.push({ i, s, h: `<li style="border-left-color:${G.teams[s].color}"><small>Frame ${i + 1}</small> ${esc(G.teams[s].name)}: ${esc(m ? m.n : '')} <b>${esc(f.b.join(' '))}</b>${f.split ? ' <small>(split)</small>' : ''}${f.score != null ? `, ${f.score}` : ''}</li>` }); });
  if (!out.length) return '<li class="hint">No frames bowled yet.</li>';
  return out.sort((a, b) => b.i - a.i || b.s - a.s).map(o => o.h).join('');
}
function wLeaveLanes() {
  WBL = null; wBL.pause(false);
  if (WG) showView('world');
  else { wBL.hide(); showScreen('title'); renderTitle(); }
}
let W_LANES_SHEETKEY = '';
wBL.onPhase = ph => {
  if (!WBL) return; wLanesBarNote(); wLanesRows();
  if (ph === 'roll') return;   // (the sheet waits for the pins to settle, as the status line does)
  const G = wBL.G, key = G ? [G.n, !!G.over, G.ro].join('|') : '';
  if (key !== W_LANES_SHEETKEY) { W_LANES_SHEETKEY = key; wLanesSheet(); }
};
wBL.onPick = () => { if (WBL) { wLanesRows(); wLanesBarNote(); } };
wBL.onOver = s => { if (WBL) { WBL.over = s; wLanesBarNote(); wLanesRows(); wLanesSheet(); $('wLanesAgain').focus(); } };

// the scoreboard strip on a phone (w86): both sides' totals, and the frame
W_SB_VIEWS.lanes = 'wSbLanes';
W_SB_HTML.lanes = function () {
  const G = wBL.G, V = wBL.view; if (!G || !G.teams || !V) return '';
  return wSbSide(G.teams[0].name, G.teams[0].color, wBL.total(0), false, '') + `<div class="wsbmid"><b>${G.over ? 'Final' : 'Frame ' + (V.frame || G.frames)}</b><small>${esc(wBL.matchText(0))}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, wBL.total(1), false, '');
};

const wW113ShowView = showView;
showView = function (v) {
  wW113ShowView(v);
  $('wLanesBar').hidden = v !== 'lanes';
  if (v === 'lanes') $('runbar').hidden = true;
};
const wW113OpenPause = openPause;
openPause = function () { if (UI.view === 'lanes') return; return wW113OpenPause.apply(this, arguments); };
const wW113ShowPage = showPage;
showPage = function (p) {
  wW113ShowPage(p);
  if (WBL && UI.view === 'lanes') wBL.pause(p !== 'play');
};

// Moll Gutter at the Lanes puts on a game (not BOWLING or GAME: those are how card-game bowling scores, and the match)
(() => {
  const K = DB.chars.gk_lanes; if (!K) return;
  K.topics.job.t += ' And we bowl it for real now, on the lanes themselves, five a side: ask me to BOWL.';
  K.topics.bowl = { t: 'Five of ours against five from Graftonbury, one team game: your five take the frames in turn, and your anchor bowls the last. Mind the oil. It moves.', act: 'lanesbowl' };
})();
const wW113RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'lanesbowl') return wLanesGame(); return wW113RunAct.apply(this, arguments); };

// the Settings panel: how many frames a game is (the observer puts the row back whenever the panel redraws)
function wLanesSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sLanesFrames')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Bowling frames</span><select id="sLanesFrames">${wBL.rules.framesAt.map(m => `<option value="${m}" ${wLanesFrames() === m ? 'selected' : ''}>${m} frames</option>`).join('')}</select></label>`);
  $('sLanesFrames').onchange = e => { SET.lanesFrames = +e.target.value; saveSettings(); if (WBL) wLanesBarNote(); };
}
new MutationObserver(wLanesSetRow).observe($('modalBox'), { childList: true });

// the sheet's look: two or three small ball boxes over the running total
(() => { const st = document.createElement('style'); st.textContent = `.wnsheet td.wnf{padding:0;min-width:34px;text-align:center}.wnsheet .wnb{display:flex;justify-content:flex-end;border-bottom:1px solid rgba(255,255,255,.15)}.wnsheet .wnb span{display:inline-block;min-width:14px;font-size:12px;border-left:1px solid rgba(255,255,255,.15)}.wnsheet .wnb span.wnsp{border-radius:50%;outline:1px solid #ff9a7a}.wnsheet .wnt{font-weight:600;padding:1px 3px}`; document.head.appendChild(st); })();

// How to play: Bowling, how it works
function wLanesHowHTML() {
  const R = wBL.rules;
  return `<p class="hint">A game is five bowlers a side in the <b>Baker format</b>: one team game of ${R.frames} frames (or ${R.framesAt.join(' or ')} in Settings) on one sheet. Your five take the frames in turn: the first bowls the 1st and the 6th, the second the 2nd and the 7th, and the fifth, the <b>anchor</b>, the 5th and the 10th.</p>
  <p class="hint"><b>The sheet.</b> Ten pins a frame and two balls at them, or one if the first is a <b>strike</b> (X), which scores 10 plus your next two balls. Clearing the rest with the second is a <b>spare</b> (/), 10 plus your next ball. Otherwise the frame scores its pins. A strike or a spare in the last frame earns fill balls, so a perfect game is twelve strikes in a row, 300. A first ball that takes the headpin but leaves pins in two groups with a gap between is a <b>split</b> (circled on the sheet): the 7-10 is the famous one. Level after the last frame, the bowlers of the 9th and the 10th bowl them again, a roll-off, until one side is ahead.</p>
  <p class="hint"><b>The lanes.</b> The sides take their frames in turn on a pair of lanes, and both move across every frame.</p>
  <p class="hint"><b>Setting up.</b> Pick the board to stand on (the left and right arrows) and the <b>arrow</b> to roll over, fifteen feet down (A and D): good bowlers aim at the arrows, not the pins. The boards count from the right edge, 1 to 39, with 20 in the middle. The yellow guide line is where a perfect ball goes on a fresh lane. Click the lane to set your arrow, or near the foul line to set your feet. <b>Coach's line</b> (G) puts your feet and arrow back on the coach's read.</p>
  <p class="hint"><b>The ball.</b> The <b>strike ball</b> (B) skids through the oil, then hooks into the pocket (between the 1 and the 3 for a right-hander): a ball that comes in at an angle carries, a flat one deflects and leaves pins. The <b>spare ball</b> rolls dead straight: throw it across the lane at a corner pin. <b>Revs</b> (R): more hook and more pin action, or a straighter, earlier roll.</p>
  <p class="hint"><b>The throw.</b> Space three times: once to start the approach, once at the <b>yellow line</b> for the speed (the bowler's own; past it, the red end, is a power ball: faster, more revs, and a smaller mark), and once inside the <b>green block</b> at the foul line on the way down. Early pulls the ball (left, for a right-hander), late pushes it, by how far you missed. On a phone, drag up the lane from the bowler and let go: how far you pull is the speed, and a pull off straight is the miss.</p>
  <p class="hint"><b>The oil.</b> The lanes are oiled forty feet down, heavier in the middle, and dry at the end: the ball skids on the oil and hooks on the dry. Every ball wipes oil off its track and carries some down the lane, so the lanes change as the game goes, for both sides. The overhead strip shows the oil (blue) and the last balls' tracks. When your ball starts crossing high, move your feet and your arrow left together; when it slides past the pocket, right.</p>
  <p class="hint"><b>The tide</b> is under the floor. At high tide the lanes sweat and play heavier (the ball skids further); at low tide they play dry (it hooks sooner).</p>
  <p class="hint"><b>Their bowlers</b> (on the bar): a <b>Squire</b> picks from two stands, misses more, and never learns the lane; a <b>Knight</b> tries more stands and corrects each bowler's line by what it saw on that lane; an <b>Archmage</b> reads the oil as it is now and stands where the angle into the pocket is best.</p>
  <p class="hint"><b>Watch</b> hands both sides to the CPU, and Speed on the bar runs it at 2 or 4 times.</p>`;
}
const wW113RenderHelp = renderHelp;
renderHelp = function () {
  wW113RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpLanes') || !$('wHelpGrounds')) return;
  const after = $('wHelpLinks') || $('wHelpRink') || [...h.querySelectorAll('[id^="wHelpG"]')].pop();
  h.insertAdjacentHTML('beforeend', `<section id="wLanesHow" class="wghelp"><h3>Bowling: how it works</h3>${wLanesHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLanes"><b>Real bowling.</b> The Saltmere Lanes are trying out bowling on the lanes themselves, five a side. Ask Moll Gutter to BOWL: one team game in the Baker format. Set your feet and your arrow, pick the ball, and bowl, or watch the two clubs bowl it out, with the sheet under the lanes (see Bowling: how it works). It is an exhibition: nothing is won or lost.</p>`);
};
