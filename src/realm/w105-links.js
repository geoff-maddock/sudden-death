/* w105: the Links (issue #92, phase 2). Mossgate Links, the golf engine, runs in the wGL scope (src/gl/ and
   src/realm/links/: a canvas in #v-links, and none of its names reach ours). This part gives it a view beside the
   world, laid out as the other sports' pages are (w87): the bar with the status line under it, the course, the coach's
   rows (your shot), the scorecard and each side's players side by side, then This game (every hole).
   A game is four of Mossgate's against four visitors from Saltmere, captain's choice match play on the standing nine
   (or 3, 6 or 18 holes: SET.linksHoles, on the bar and the Settings panel). Ask Agatha Divot at the Links for a ROUND
   (GAME and GOLF stay the card-game match and how it scores). Nothing is won or lost, and nothing is saved.
   Two modes on the bar (W_LINKS_MODES): Watch (the CPU plays both sides) and You play (your shot is yours: the keys
   are in l1-page.js, and the rows under the course do the same with a mouse or a finger). Switching goes on with the
   same game; the last one picked is kept for the next (not saved).
   The rows, in You play on your shot: Hitter (the four, those who may not hit greyed with why), Club (what the lie
   allows), Shot (draw, straight or fade; normal, punch or lob; backspin, none or topspin), and Swing. On their short
   putt: Give it, or Make them putt.
   On a phone the scoreboard strip (w86) covers the Links too: W_SB_VIEWS.links and W_SB_HTML.links.
   Wraps: showView (wW105ShowView: the bar), openPause (wW105OpenPause: not on the Links), wRunAct (wW105RunAct:
   'linksround'), showPage (wW105ShowPage: the game waits while another page is up), renderHelp (wW105RenderHelp:
   #wHelpLinks and #wLinksHow). The Settings row goes in by an observer on the modal, as w88's does. */

const W_LINKS = {
  home: { kinds: ['elf', 'spider', 'witch', 'gorgon'], color: '#d8a03a', short: 'MGL' },
  away: { city: 'saltmere', kinds: ['ogre', 'harpy', 'golem', 'lich'], color: '#7a5ad0', short: 'SGC' },
};
const W_LINKS_MODES = {
  watch: { n: 'Watch', title: 'The CPU plays both sides. Switching goes on with the same game.' },
  play: { n: 'You play', title: 'You play Mossgate: pick the hitter, the club and the shot, aim, and swing (Space three times, or drag back from the ball). Their short putts are yours to give.' },
};
let W_LINKS_MODE = 'play', W_LINKS_SPEED = 1;
const wLinksHoles = () => wGL.rules.holesAt.includes(SET.linksHoles) ? SET.linksHoles : wGL.rules.holes;
// the game on the course: plain data, never saved
let WGL = null;

$('v-links').insertAdjacentHTML('beforebegin', `<div id="wLinksBar" class="wdbar" hidden>
  <b id="wLinksTitle">A round at Mossgate Links</b><span id="wLinksNote" class="hint wsnote"></span>
  <span id="wLinksModes" class="wgmodes" role="group" aria-label="Who plays it">${Object.entries(W_LINKS_MODES).map(([k, m]) => `<button class="ghost" data-lmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <label class="hint" title="How many holes a game is: the standing nine, cut short or played twice. Also on the Settings panel.">Holes <select id="wLinksHoles">${wGL.rules.holesAt.map(m => `<option value="${m}">${m}</option>`).join('')}</select></label>
  <label class="hint" id="wLinksSpeedL" title="How fast the game runs while you watch. In You play it is always 1.">Speed <select id="wLinksSpeed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
  <button class="ghost" id="wLinksAgain">Another game</button>
  <button class="ghost" id="wLinksBack">Back to the world</button></div>`);
$('wLinksBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.lmode) { W_LINKS_MODE = b.dataset.lmode; if (WGL && !WGL.over) wGL.setMode(W_LINKS_MODE); wLinksBarNote(); wLinksRows(); }
  else if (b.id === 'wLinksAgain') wLinksGame();
  else if (b.id === 'wLinksBack') wLeaveLinks();
});
function wLinksSpeedSet() { const play = wGL.mode === 'play'; wGL.speed = play ? 1 : W_LINKS_SPEED; $('wLinksSpeedL').hidden = play || !WGL || !!WGL.over; $('wLinksSpeed').value = String(W_LINKS_SPEED); }
$('wLinksSpeed').addEventListener('change', e => { W_LINKS_SPEED = +e.target.value || 1; wLinksSpeedSet(); });
$('wLinksHoles').addEventListener('change', e => { SET.linksHoles = +e.target.value; saveSettings(); wLinksBarNote(); });

// under the course: your shot's rows, the scorecard and the players, this game, and How golf works
$('v-links').insertAdjacentHTML('beforeend', `<div id="wLinksRows" class="wccalls wscoach" hidden>
  <div class="wccrow" id="wLinksRowWho"><span class="wccl">Hitter</span><span id="wLinksWho"></span></div>
  <div class="wccrow" id="wLinksRowClub"><span class="wccl">Club</span><span id="wLinksClub"></span></div>
  <div class="wccrow" id="wLinksRowShot"><span class="wccl">Shot</span><span id="wLinksShot"></span></div>
  <div class="wccrow" id="wLinksRowGo"><span class="wccl">Swing</span><span id="wLinksGo"></span></div>
  <div class="wccrow" id="wLinksRowGive" hidden><span class="wccl">Their putt</span><span><button class="ghost" data-lgive="1" title="Y: it counts as holed in one more">Give it</button> <button class="ghost" data-lgive="0" title="N: they must hole it">Make them putt</button></span></div></div>
  <h4 class="wsh">Scorecard</h4><div id="wLinksCard" class="wcbox"></div>
  <h4 class="wsh">This game</h4><ol id="wLinksLog" class="wglog wslog"></ol>
  <p class="hint wghowlink">How golf works here: the turn, the hitter rule, the swing, the wind, the lie and the green. <button class="ghost" id="wLinksHowBtn">How to play golf</button> <small>The game waits while you read.</small></p>`);
$('wLinksHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wLinksHow'); if (h) h.scrollIntoView({ block: 'start' }); });
$('wLinksRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.lri != null) wGL.select({ ri: +d.lri });
  else if (d.lclub) wGL.select({ club: d.lclub });
  else if (d.lshape != null) wGL.select({ shape: d.lshape });
  else if (d.ltraj != null) wGL.select({ traj: d.ltraj });
  else if (d.lspin != null) wGL.select({ spin: +d.lspin });
  else if (d.lgo) wGL.press();
  else if (d.lgive != null) wGL.offer(d.lgive === '1');
  wLinksRows(); wLinksBarNote();
});

const W_LINKS_ROLE = ['tee', 'approach', 'short', 'putt'];
// why a player can't hit now
function wLinksWhyNot(V, ri) {
  const H = wGL.G.hole, side = V.you;
  if (H.last[side] === ri) return 'Hit the last shot: nobody hits twice running.';
  return 'Everyone hits once before anyone hits twice.';
}
// the rows: drawn for the beat (your shot, their putt, or nothing to do)
function wLinksRows() {
  const box = $('wLinksRows'), V = WGL && !WGL.over ? wGL.view : null, mine = V && V.mode === 'play' && (V.ph === 'aim' || V.ph === 'swing') && V.sel, offer = V && V.ph === 'offer';
  box.hidden = !mine && !offer;
  $('wLinksRowGive').hidden = !offer;
  for (const id of ['wLinksRowWho', 'wLinksRowClub', 'wLinksRowShot', 'wLinksRowGo']) $(id).hidden = !mine;
  if (!mine) return;
  const S = V.sel, G = wGL.G, T = G.teams[V.you], aim = V.ph === 'aim', on = (a, b) => a === b ? ' on' : '';
  $('wLinksWho').innerHTML = T.roster.map((m, i) => {
    const ok = V.hitters.includes(i) || i === S.ri, why = ok ? `${i + 1}: ${m.n} (${wKindName(m.kind)})` : wLinksWhyNot(V, i);
    return `<button class="ghost${on(i, S.ri)}" data-lri="${i}" ${ok && aim ? '' : 'disabled'} title="${esc(why)}">${esc(m.n)}</button>`;
  }).join(' ');
  $('wLinksClub').innerHTML = (aim ? V.clubs : [S.club]).map(c => `<button class="ghost${on(c, S.club)}" data-lclub="${c}" ${aim ? '' : 'disabled'} title="Q and E: a longer or a shorter club. ${esc(wGL.clubs[c].n)}${c === 'pt' ? '' : `: about ${Math.round(wGL.reach(c, G.ball[V.you].lie, G.teams[V.you].roster[S.ri].r, 1).carry)} yards carried from here`}">${esc(wGL.clubs[c].n)}</button>`).join(' ');
  $('wLinksRowShot').hidden = S.putt;
  const lie = G.ball[V.you].lie, punchOnly = lie === 'O';
  $('wLinksShot').innerHTML = [['lshape', '', 'Straight'], ['lshape', 'draw', 'Draw', 'Swings left in the air and runs out more'], ['lshape', 'fade', 'Fade', 'Swings right in the air and stops sooner']].map(([k, v, n, t]) => `<button class="ghost${on(v, S.shape)}" data-${k}="${v}" ${aim ? '' : 'disabled'} title="Z: the shape. ${esc(t || 'No shape')}">${n}</button>`).join(' ') + ' · '
    + [['', 'Normal'], ['punch', 'Punch', 'Low under the wind and the branches, and runs'], ['lob', 'Lob', 'High: drifts in the wind, and sits down where it lands']].map(([v, n, t]) => `<button class="ghost${on(v, S.traj)}" data-ltraj="${v}" ${aim && (!punchOnly || v === 'punch') ? '' : 'disabled'} title="X: the height. ${esc(punchOnly ? 'From the trees, only a punch' : t || 'A full shot')}">${n}</button>`).join(' ') + ' · '
    + [[-1, 'Backspin', 'Stops it sooner'], [0, 'No spin', ''], [1, 'Topspin', 'Runs it out']].map(([v, n, t]) => `<button class="ghost${on(v, S.spin)}" data-lspin="${v}" ${aim ? '' : 'disabled'} title="C: the spin. ${esc(t)}">${n}</button>`).join(' ');
  const M = V.meter, st = V.ph !== 'swing' || !M ? 'Start' : S.putt ? 'Weight' : M.st === 'up' ? 'Power' : 'Mark';
  $('wLinksGo').innerHTML = `<button class="ghost on" data-lgo="1" title="Space">${st}</button> <small class="hint">${S.putt ? 'Two presses: start, then stop the bar at the weight (the gold tick rolls it to your aim on a flat green).' : 'Three presses: start, the power (the gold tick lands it on the ring), then the green mark.'} Or drag back from the ball and let go.</small>`;
}
function wLinksTeams() {
  const g = W_GRDS.find(x => x.id === 'g_links'), H = W_LINKS.home, A = W_LINKS.away, used = new Set();
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.golf} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, roster: t.kinds.map(kind => ({ n: wRinkName(kind, used), kind })),
  }));
}
/* one game at the Links. opts: { teams, holes, seed, mode, title, how, wild } */
function wLinksGame(opts) {
  const o = opts || {};
  WGL = { over: null, how: o.how || 'round' };
  $('wLinksTitle').textContent = o.title || 'A round at Mossgate Links';
  wGL.start({ teams: o.teams || wLinksTeams(), holes: o.holes || wLinksHoles(), seed: o.seed, mode: o.mode || W_LINKS_MODE, wild: !!o.wild, skill: o.skill });
  showView('links');
  wLinksBarNote(); wLinksRows(); wLinksCard();
}
function wLinksBarNote() {
  if (!WGL) return;
  const mode = wGL.mode || W_LINKS_MODE;
  for (const b of $('wLinksModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.lmode === mode); b.setAttribute('aria-pressed', b.dataset.lmode === mode); }
  wLinksSpeedSet();
  $('wLinksNote').textContent = wGL.msg || '';
  $('wLinksHoles').value = String(wLinksHoles());
}
// the scorecard (a column a hole: par, each side's strokes, who won it) and each side's players
function wLinksCard() {
  const G = wGL.G; if (!G || !G.teams) { $('wLinksCard').innerHTML = ''; $('wLinksLog').innerHTML = ''; return; }
  const n = Math.max(G.holes, G.card.length), cols = []; for (let i = 0; i < n; i++) cols.push(i);
  const cell = (i, s) => { const c = G.card[i]; if (!c) return i === G.h ? `<td>${G.hole.st[s] || ''}</td>` : '<td></td>'; const t = c.up[s] ? '×' : c.done[s] ? c.st[s] : c.st[s] + '+'; return `<td${c.res === s ? ' style="font-weight:700;color:var(--gold,#ffb02e)"' : ''}>${t}</td>`; };
  const pars = cols.map(i => `<td>${wGL.parOf(i)}</td>`).join('');
  const card = `<table class="wrpow wcboxt"><caption>${esc(G.teams[0].name)}: ${esc(wGL.matchText(0))}</caption><tr><th>Hole</th>${cols.map(i => `<th>${i + 1}</th>`).join('')}</tr><tr><td>Par</td>${pars}</tr>${[0, 1].map(s => `<tr><td style="border-left:4px solid ${G.teams[s].color || '#888'}">${esc(G.teams[s].name)}</td>${cols.map(i => cell(i, s)).join('')}</tr>`).join('')}</table>`;
  const players = [0, 1].map(s => `<table class="wrpow wcboxt"><caption>${esc(G.teams[s].name)}</caption><tr><th>Player</th><th title="Shots hit">Shots</th><th title="Putts">Putts</th><th title="Holed: the shot that dropped">In</th></tr>${G.teams[s].roster.map((m, i) => `<tr><td>${esc(m.n)} <small>${esc(wKindName(m.kind))}</small></td><td>${G.pst[s][i].shots}</td><td>${G.pst[s][i].putts}</td><td>${G.pst[s][i].holed}</td></tr>`).join('')}<tr><td><b>Side</b></td><td>${G.pst[s].reduce((a, p) => a + p.shots, 0)}</td><td>${G.stat[s].putts}</td><td></td></tr></table>`).join('');
  $('wLinksCard').innerHTML = `<div style="overflow-x:auto;max-width:100%">${card}</div><div class="wcbox">${players}</div>`;
  $('wLinksLog').innerHTML = wLinksLogHTML();
}
// every hole so far, with what decided it
function wLinksLogHTML() {
  const G = wGL.G; if (!G.card.length) return '<li class="hint">No holes finished yet.</li>';
  const score = (c, s) => c.up[s] ? 'picked up' : c.done[s] ? `${c.st[s]}` : `${c.st[s]}, not holed`;
  return G.card.map(c => `<li style="border-left-color:${c.res < 0 ? '#888' : G.teams[c.res].color}"><small>Hole ${c.no} · par ${c.par}</small> ${esc(G.teams[0].name)} ${score(c, 0)}, ${esc(G.teams[1].name)} ${score(c, 1)}. <b>${c.res < 0 ? 'Halved' : esc(G.teams[c.res].name) + ' win it'}</b>.</li>`).join('');
}
function wLeaveLinks() {
  WGL = null; wGL.pause(false);
  if (WG) showView('world');
  else { wGL.hide(); showScreen('title'); renderTitle(); }
}
wGL.onPhase = ph => { if (!WGL) return; wLinksBarNote(); wLinksRows(); if (ph === 'rest' || ph === 'given' || ph === 'over' || ph === 'next') wLinksCard(); };
wGL.onPick = () => { if (WGL) { wLinksRows(); wLinksBarNote(); } };
wGL.onOver = s => { if (WGL) { WGL.over = s; wLinksBarNote(); wLinksRows(); wLinksCard(); $('wLinksAgain').focus(); } };

// the scoreboard strip on a phone (w86): both sides, holes won, and the match
W_SB_VIEWS.links = 'wSbLinks';
W_SB_HTML.links = function () {
  const G = wGL.G; if (!G || !G.teams) return '';
  return wSbSide(G.teams[0].name, G.teams[0].color, G.won[0], false, '<small>holes</small>') + `<div class="wsbmid"><b>${G.over ? 'Final' : 'Hole ' + (G.h + 1)}</b><small>${esc(wGL.matchText(0))}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, G.won[1], false, '<small>holes</small>');
};

const wW105ShowView = showView;
showView = function (v) {
  wW105ShowView(v);
  $('wLinksBar').hidden = v !== 'links';
  if (v === 'links') $('runbar').hidden = true;
};
const wW105OpenPause = openPause;
openPause = function () { if (UI.view === 'links') return; return wW105OpenPause.apply(this, arguments); };
const wW105ShowPage = showPage;
showPage = function (p) {
  wW105ShowPage(p);
  if (WGL && UI.view === 'links') wGL.pause(p !== 'play');
};

// Agatha Divot at the Links puts on a round (not GOLF or GAME: those are how card-game golf scores, and the match)
(() => {
  const K = DB.chars.gk_links; if (!K) return;
  K.topics.job.t += ' And we play it for real now, on the course itself, four a side: ask me for a ROUND.';
  K.topics.round = { t: 'Four of ours against four from Saltmere. One ball a side, and you pick who hits every shot. Match play, and nobody goes home level. Replace your divots.', act: 'linksround' };
})();
const wW105RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'linksround') return wLinksGame(); return wW105RunAct.apply(this, arguments); };

// the Settings panel: how many holes a game is (the observer puts the row back whenever the panel redraws)
function wLinksSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sLinksHoles')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Golf holes</span><select id="sLinksHoles">${wGL.rules.holesAt.map(m => `<option value="${m}" ${wLinksHoles() === m ? 'selected' : ''}>${m} holes</option>`).join('')}</select></label>`);
  $('sLinksHoles').onchange = e => { SET.linksHoles = +e.target.value; saveSettings(); if (WGL) wLinksBarNote(); };
}
new MutationObserver(wLinksSetRow).observe($('modalBox'), { childList: true });

// How to play: Golf, how it works
function wLinksHowHTML() {
  const R = wGL.rules, M = wGL.meterRules;
  return `<p class="hint">A game is four players a side, <b>captain's choice match play</b>: each side plays one ball, and picks who hits every shot. ${R.holes} holes unless you change it in Settings (${R.holesAt.join(', ')}). The standing nine is the same every week, par ${R.par9.reduce((a, b) => a + b, 0)}.</p>
  <p class="hint"><b>Who hits.</b> The first four shots of a hole are four different players, in the order you choose. After that, anyone but the player who hit last: nobody hits twice running. So the order is the choice: who drives, who goes for the green, who chips and who putts.</p>
  <p class="hint"><b>The turn.</b> The side with the honour tees off first (the side that won the last hole; a halved hole keeps it). Then whoever is farther from the hole plays next, so you see where their ball ends up before you choose your shot.</p>
  <p class="hint"><b>Match play.</b> Each hole goes to the side that holes out in fewer strokes, or is halved. The game is won once a side is more holes up than there are holes left ("3 and 2"), or "1 up" at the last. Level after the last hole, it goes to a playoff: the 1st again, then the 2nd, until a side wins a hole. A ball still out after par and ${R.cap} more is picked up. A golf game never ends level.</p>
  <p class="hint"><b>Giving a putt.</b> A side may give the other its next short putt: it counts as holed in one more stroke. Their short putts are yours to give or not (<b>Give it</b> or <b>Make them putt</b>; Y or N). Theirs are given by the CPU's caddie, by skill, and not always.</p>
  <p class="hint"><b>The swing.</b> Space three times: once to start, once at the top for the <b>power</b>, and once on the way back on the green <b>mark</b>. The gold tick is the power that lands a perfect swing on the ring. Past the end of the bar is a <b>power shot</b>: longer, and the mark is smaller. On the mark the ball flies nearly straight. Early, it hooks left; late, it slices right, by how far you missed. Miss the mark altogether and the swing goes off at the bottom, very late. A more accurate player has a wider mark. On a phone, drag back from your ball away from the target and let go: how far you pull is the power, and a pull off the line hooks or slices it.</p>
  <p class="hint"><b>Aiming.</b> The ring is where a perfect swing at the tick lands, without the wind. Click or drag on the course to move it, or the arrows: left and right turn it, up and down move it further or nearer. Pick the club (Q and E), the hitter (1 to 4), the shape (Z: a <b>draw</b> swings left and runs out, a <b>fade</b> swings right and stops sooner), the height (X: a <b>punch</b> flies low under the wind and runs, a <b>lob</b> climbs and sits down where it lands) and the spin (C: <b>backspin</b> stops it sooner, <b>topspin</b> runs it out).</p>
  <p class="hint"><b>The wind</b> blows a strength and a way for each hole, shown on the arrow at the top right. It moves a high ball far more than a low one, and a headwind costs more than a tailwind gives.</p>
  <p class="hint"><b>The lie.</b> The driver is for the tee only. The rough costs distance and the ball runs (no spin), deep rough more. Sand takes the wedge: anything else barely moves it. A ball in the moss bog plugs and comes out short. In the trees it lies on a root, and only a punch will do. The water is a drop on the line, back where it went in, and a stroke.</p>
  <p class="hint"><b>The green.</b> A putt is two presses: start, then stop the bar at the weight (the gold tick rolls it to your aim on a flat green). The green slopes: the grain arrows drift downhill, and the <b>read line</b> shows the first few yards of your putt as you would strike it now, longer for a better putter, so you can see the break and aim off for it. Too fast and it lips out or runs past; short never drops.</p>
  <p class="hint"><b>Watch</b> hands both sides to the CPU, and Speed on the bar runs it at 2 or 4 times. The CPU's caddie picks the hitter by the shot (power off the tee, accuracy for an approach, touch for a chip, the best putter on the green), the club for the distance, aims off for the wind (a Knight or an Archmage), and lays up short of trouble.</p>`;
}
const wW105RenderHelp = renderHelp;
renderHelp = function () {
  wW105RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpLinks') || !$('wHelpGrounds')) return;
  const after = $('wHelpRink') || $('wHelpCourt') || [...h.querySelectorAll('[id^="wHelpG"], #wHelpRing')].pop();
  h.insertAdjacentHTML('beforeend', `<section id="wLinksHow" class="wghelp"><h3>Golf: how it works</h3>${wLinksHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinks"><b>Real golf.</b> Mossgate Links is trying out golf on the course itself, four a side. Ask Agatha Divot for a ROUND: captain's choice match play on the standing nine (or set the holes in Settings). Pick the hitter, the club and the shot, aim, and swing, or watch the two clubs play it out, with a scorecard under the course (see Golf: how it works). A ROUND is an exhibition: nothing is won or lost.</p>`);
};
