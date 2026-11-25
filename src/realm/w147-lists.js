/* w147: the Tilting Lists (issue #117, phase 2). The jousting engine runs in the wJT scope (src/jt/ and
   src/realm/lists/: a canvas in #v-lists, and none of its names reach ours). This part gives it a view beside the
   world, laid out as the other sports' pages are: the bar with the status line under it, the lists, your course's
   rows, the tourney board, then This match (every course).
   A match is Mossgate's riders against a visiting club from Cinderhold: two riders a side, two heats of 3 courses (or
   5: SET.listsCourses, on the bar and the Settings panel), and the tilt for the crown if level. Ask Sir Ruddock at the
   Lists to JOUST (GAME and JOUSTING stay the card-game match and how it scores). Nothing is won or lost, and nothing
   is saved.
   Two modes on the bar (W_LISTS_MODES): Watch (the CPU rides both sides) and You ride (your courses are yours: the
   keys are in n1-page.js, and the rows under the lists do the same with a mouse or a finger). Switching goes on with
   the same match; the last one picked is kept for the next (not saved).
   The rows, in You ride: before a course, Aim (shield, body, helm), Guard (angled, square), Pace (canter, gallop) and
   Ride (with your squire's plan again); in the charge, Spur and Couch (the canvas does the same: tap, then hold and
   drag); in the balance moment, Lean (hold either way).
   On a phone the scoreboard strip (w86) covers the Lists too: W_SB_VIEWS.lists and W_SB_HTML.lists.
   Wraps: showView (wW147ShowView: the bar), openPause (wW147OpenPause: not at the Lists), wRunAct (wW147RunAct:
   'listsjoust'), showPage (wW147ShowPage: the match waits while another page is up), renderHelp (wW147RenderHelp:
   #wHelpLists and #wListsHow). The Settings row goes in by an observer on the modal, as w122's does. */

const W_LISTS = {
  home: { kinds: ['werewolf', 'elf', 'gorgon', 'spider'], color: '#3a5a9a', short: 'MOS' },
  away: { city: 'cinderhold', kinds: ['minotaur', 'golem', 'harpy', 'ogre'], color: '#c94a3a', short: 'CIN' },
};
const W_LISTS_MODES = {
  watch: { n: 'Watch', title: 'The CPU rides both sides. Switching goes on with the same match.' },
  play: { n: 'You ride', title: 'You ride for the first side on the board: pick the aim, the guard and the pace, then spur, couch and aim the lance, and keep your seat.' },
};
let W_LISTS_MODE = 'play', W_LISTS_SPEED = 1, W_LISTS_SKILL = 1;
const wListsCourses = () => wJT.rules.coursesAt.includes(SET.listsCourses) ? SET.listsCourses : wJT.rules.courses;
// the match on the lists: plain data, never saved
let WJT = null;

$('v-lists').insertAdjacentHTML('beforebegin', `<div id="wListsBar" class="wdbar" hidden>
  <b id="wListsTitle">A tourney at the Tilting Lists</b><span id="wListsNote" class="hint wsnote"></span>
  <span id="wListsModes" class="wgmodes" role="group" aria-label="Who rides">${Object.entries(W_LISTS_MODES).map(([k, m]) => `<button class="ghost" data-jmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <label class="hint" title="How many courses a heat is. Also on the Settings panel.">Courses <select id="wListsCourses">${wJT.rules.coursesAt.map(m => `<option value="${m}">${m}</option>`).join('')}</select></label>
  <label class="hint" title="How well the other side rides: a Squire picks a plan at random; a Knight mixes its plans by the odds, so no plan always ridden beats it, and reads the score and the heat; an Archmage reads how your riders have ridden this match, saves its mount's wind for when it pays, and has surer hands.">Their riders <select id="wListsSkill">${wJT.skills.map((S, i) => `<option value="${i}">${S.n}</option>`).join('')}</select></label>
  <label class="hint" id="wListsSpeedL" title="How fast the match runs while you watch. In You ride it is always 1.">Speed <select id="wListsSpeed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
  <button class="ghost" id="wListsAgain">Another match</button>
  <button class="ghost" id="wListsBack">Back to the world</button></div>`);
$('wListsBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.jmode) { W_LISTS_MODE = b.dataset.jmode; if (WJT && !WJT.over) wJT.setMode(W_LISTS_MODE); wListsBarNote(); wListsRows(); }
  else if (b.id === 'wListsAgain') wListsGame();
  else if (b.id === 'wListsBack') wLeaveLists();
});
function wListsSpeedSet() { const play = wJT.mode === 'play'; wJT.speed = play ? 1 : W_LISTS_SPEED; $('wListsSpeedL').hidden = play || !WJT || !!WJT.over; $('wListsSpeed').value = String(W_LISTS_SPEED); }
$('wListsSkill').addEventListener('change', e => { W_LISTS_SKILL = +e.target.value; e.target.blur(); $('wListsNote').textContent = `Their riders: ${wJT.skills[W_LISTS_SKILL].n}s, from the next match.`; });
$('wListsSpeed').addEventListener('change', e => { W_LISTS_SPEED = +e.target.value || 1; wListsSpeedSet(); e.target.blur(); });
$('wListsCourses').addEventListener('change', e => { SET.listsCourses = +e.target.value; saveSettings(); wListsBarNote(); e.target.blur(); });

// under the lists: your course's rows, the tourney board, this match, and How jousting works
const W_LISTS_ROWS = { aim: [['shield', 'Shield', '1: the biggest mark; an angled shield turns it into a glance'], ['body', 'Body', '2: the torso the shield leaves open; an angled shield leaves more of it'], ['helm', 'Helm', '3: two points, but a small mark (bigger when their shield is angled), and a miss leaves you reaching: their lance rocks you more']],
  guard: [['angled', 'Angled', 'Q: turns strikes on your shield aside, but leaves your helm open'], ['square', 'Square', 'W: takes the hit and stays on']],
  pace: [['canter', 'Canter', 'E: steadier aim, softer hit, saves the mount\'s wind'], ['gallop', 'Gallop', 'R: hits harder and rocks them more, but the tip sways more and the mount tires']] };
$('v-lists').insertAdjacentHTML('beforeend', `<div id="wListsRows" class="wccalls wscoach" hidden>
  <div class="wccrow"><span class="wccl">Aim</span><span id="wListsAim"></span></div>
  <div class="wccrow"><span class="wccl">Guard</span><span id="wListsGuard"></span></div>
  <div class="wccrow"><span class="wccl">Pace</span><span id="wListsPace"></span></div>
  <div class="wccrow" id="wListsRowGo"><span class="wccl">Ride</span><span id="wListsGo"></span></div></div>
  <div id="wListsChargeRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Charge</span><span><button class="ghost" id="wListsSpur">Spur</button> <button class="ghost" id="wListsCouch">Hold to couch</button> <small class="hint">Or on the lists: tap with the hoofbeats, then hold and drag to aim.</small></span></div></div>
  <div id="wListsSeatRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Lean</span><span><button class="ghost" id="wListsLeanL">◀ Lean</button> <button class="ghost" id="wListsLeanR">Lean ▶</button> <small class="hint">Hold against the wobble (or the arrows, or drag).</small></span></div></div>
  <h4 class="wsh">The tourney board</h4><div id="wListsBoard" class="wcbox"></div>
  <h4 class="wsh">This match</h4><ol id="wListsLog" class="wglog wslog"></ol>
  <p class="hint wghowlink">How jousting works here: the heats and courses, the plan, the charge and keeping your seat. <button class="ghost" id="wListsHowBtn">How to play jousting</button> <small>The match waits while you read.</small></p>`);
$('wListsHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wListsHow'); if (h) h.scrollIntoView({ block: 'start' }); });
$('wListsRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset; let why = '';
  if (d.jf) why = wJT.select({ [d.jf]: d.jv });
  else if (d.jsuggest) why = wJT.select({ suggest: true });
  else if (d.jgo) wJT.press();
  else return;
  if (why) $('wListsNote').textContent = why;
  wListsRows(); if (!why) wListsBarNote();
});
$('wListsSpur').addEventListener('pointerdown', e => { if (WJT) { wJT.spur(); e.preventDefault(); } });
for (const [ev, on] of [['pointerdown', true], ['pointerup', false], ['pointerleave', false], ['pointercancel', false]]) $('wListsCouch').addEventListener(ev, e => { if (WJT) { wJT.couch(on); e.preventDefault(); } });
for (const [id, v] of [['wListsLeanL', -1], ['wListsLeanR', 1]]) for (const [ev, on] of [['pointerdown', true], ['pointerup', false], ['pointerleave', false], ['pointercancel', false]]) $(id).addEventListener(ev, e => { if (WJT) { wJT.hold(on ? v : 0, 0); e.preventDefault(); } });
// the rows: your plan before a course, the charge's buttons while you ride, Lean in the balance moment
function wListsRows() {
  const V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null, mine = V && V.mode === 'play';
  $('wListsChargeRow').hidden = !(mine && V.ph === 'charge' && V.charge && V.charge.mine);
  $('wListsSeatRow').hidden = !(mine && V.ph === 'seat');
  // (phase 5: Manage's plan beat too, unless it's left to your squires)
  const box = $('wListsRows'), plan = V && (mine || (V.mode === 'manage' && !V.mgrAuto)) && V.ph === 'plan' && V.sel;
  box.hidden = !plan; if (!plan) return;
  const S = V.sel, on = (a, b) => a === b ? ' on' : '';
  for (const [f, id] of [['aim', 'wListsAim'], ['guard', 'wListsGuard'], ['pace', 'wListsPace']]) $(id).innerHTML = W_LISTS_ROWS[f].map(([k, n, t]) => `<button class="ghost${on(k, S[f])}" data-jf="${f}" data-jv="${k}" title="${esc(t)}">${n}</button>`).join(' ');
  $('wListsGo').innerHTML = `<button class="ghost on" id="wListsRideBtn" data-jgo="1" title="${mine ? 'Space' : 'Space: your rider rides your plan on their ratings'}">${mine ? 'Ride' : 'Send them'}</button> <button class="ghost" data-jsuggest="1" title="G: your squire's plan for this course">Squire's plan</button> <small class="hint">${esc(S.why ? 'Your squire: ' + S.why + '.' : '')}</small>`;
}
// the two clubs; taken: names already in the match, so nobody shares one
function wListsTeams(taken) {
  const g = W_GRDS.find(x => x.id === 'g_lists'), H = W_LISTS.home, A = W_LISTS.away, used = new Set(taken || []);
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.jousting} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, roster: t.kinds.map(kind => ({ n: wRinkName(kind, used), kind })),
  }));
}
/* one match at the Lists. opts: { teams, courses, seed, mode, title, skill } (anything else goes through to the engine) */
function wListsGame(opts) {
  const o = opts || {};
  WJT = { over: null };
  $('wListsTitle').textContent = o.title || 'A tourney at the Tilting Lists';
  const { title, ...rest } = o;
  wJT.start(Object.assign({}, rest, { teams: o.teams || wListsTeams(), courses: o.courses || wListsCourses(), seed: o.seed, mode: o.mode || W_LISTS_MODE, skill: o.skill || [1, W_LISTS_SKILL] }));
  showView('lists');
  wListsBarNote(); wListsRows(); wListsBoard();
}
function wListsBarNote() {
  if (!WJT) return;
  const mode = WJT.over ? W_LISTS_MODE : wJT.mode || W_LISTS_MODE;
  for (const b of $('wListsModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.jmode === mode); b.setAttribute('aria-pressed', b.dataset.jmode === mode); }
  wListsSpeedSet();
  const G = wJT.G, later = !WJT.over && G && G.courses !== wListsCourses();
  $('wListsNote').textContent = (wJT.msg || '') + (later ? ` (Courses: ${wListsCourses()} a heat from the next match; this one is ${G.courses}.)` : '');
  $('wListsCourses').value = String(wListsCourses());
  $('wListsSkill').value = String(W_LISTS_SKILL);
}
// the tourney board: a column a course in each heat (and the tilt's), each side's points, the totals
function wListsBoard() {
  const G = wJT.G; if (!G || !G.teams) { $('wListsBoard').innerHTML = ''; $('wListsLog').innerHTML = ''; return; }
  const B = wJT.board(), n = B.courses, tl = B.tilt[0].length, cell = v => v == null ? '' : v > 0 ? `<b>${v}</b>` : String(v);
  const head = `<tr><th></th>${[0, 1].map(h => Array.from({ length: n }, (_, i) => `<th title="Heat ${h + 1}, course ${i + 1}">${h + 1}·${i + 1}</th>`).join('')).join('')}${Array.from({ length: tl }, (_, i) => `<th title="The tilt for the crown">T${i + 1}</th>`).join('')}<th>Total</th></tr>`;
  const row = s => `<tr><td style="border-left:4px solid ${G.teams[s].color || '#888'}">${esc(G.teams[s].name)}</td>${[0, 1].map(h => B.sc[s][h].map(cell).map(v => `<td>${v}</td>`).join('')).join('')}${B.tilt[s].map(v => `<td>${cell(v)}</td>`).join('')}<td><b>${B.tot[s]}</b></td></tr>`;
  $('wListsBoard').innerHTML = `<div style="overflow-x:auto;max-width:100%"><table class="wrpow wcboxt"><caption>${esc(G.teams[0].name)}: ${esc(wJT.matchText(0))}</caption>${head}${row(0)}${row(1)}</table></div>`;
  $('wListsLog').innerHTML = wListsLogHTML();
}
// every course so far, newest first: where each lance landed
function wListsLogHTML() {
  const G = wJT.G; if (!G.log.length) return '<li class="hint">No courses ridden yet.</li>';
  return G.log.slice().reverse().map(e => {
    const where = e.tilt ? 'Tilt' : `Heat ${e.heat + 1}, course ${e.course + 1}`;
    const side = s => `${esc(G.teams[s].short || G.teams[s].name)}: ${esc(wJT.atText({ at: e.at[s], unhorse: e.unhorse[s] }))}${e.pts[s] ? ` (<b>${e.pts[s] > 0 ? '+' : ''}${e.pts[s]}</b>)` : ''}`;
    return `<li><small>${where}</small> ${side(0)}. ${side(1)}.</li>`;
  }).join('');
}
function wLeaveLists() {
  WJT = null; wJT.pause(false);
  if (WG) showView('world');
  else { wJT.hide(); showScreen('title'); renderTitle(); }
}
let W_LISTS_BOARDKEY = '';
wJT.onPhase = ph => {
  if (!WJT) return; wListsBarNote(); wListsRows();
  const G = wJT.G, key = G ? [G.n, !!G.over].join('|') : '';
  if (key !== W_LISTS_BOARDKEY) { W_LISTS_BOARDKEY = key; wListsBoard(); }
};
wJT.onPick = () => { if (WJT) { wListsRows(); wListsBarNote(); } };
wJT.onOver = s => { if (WJT) { WJT.over = s; wListsBarNote(); wListsRows(); wListsBoard(); $('wListsAgain').focus(); } };

// the scoreboard strip on a phone (w86): both sides' totals, and where the match is
W_SB_VIEWS.lists = 'wSbLists';
W_SB_HTML.lists = function () {
  const G = wJT.G, V = wJT.view; if (!G || !G.teams || !V) return '';
  const where = G.over ? 'Final' : V.inTilt ? 'The tilt' : `Heat ${V.heat + 1}·${V.course + 1}`;
  return wSbSide(G.teams[0].name, G.teams[0].color, wJT.total(0), false, '') + `<div class="wsbmid"><b>${where}</b><small>${esc(wJT.matchText(0))}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, wJT.total(1), false, '');
};

const wW147ShowView = showView;
showView = function (v) {
  wW147ShowView(v);
  $('wListsBar').hidden = v !== 'lists';
  if (v === 'lists') $('runbar').hidden = true;
};
const wW147OpenPause = openPause;
openPause = function () { if (UI.view === 'lists') return; return wW147OpenPause.apply(this, arguments); };
const wW147ShowPage = showPage;
showPage = function (p) {
  wW147ShowPage(p);
  if (WJT && UI.view === 'lists') wJT.pause(p !== 'play');
};

// Sir Ruddock puts on a tourney (not GAME or JOUSTING: those are the card-game match and how card-game jousting scores)
(() => {
  const K = DB.chars.gk_lists; if (!K) return;
  K.topics.job.t += ' And we joust it for real now, lances on the tilt, two riders a side: ask me to JOUST.';
  K.topics.joust = { t: 'Two of ours against two from Cinderhold, a heat each, three courses a heat. One for a lance broken on the shield or the body, two on the helm, three if you put them in the sand. Strike the horse or the barrier and I take a point off. Keep your seat.', act: 'listsjoust' };
})();
const wW147RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'listsjoust') return wListsGame(); return wW147RunAct.apply(this, arguments); };

// the Settings panel: how many courses a heat is (the observer puts the row back whenever the panel redraws)
function wListsSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sListsCourses')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Jousting courses</span><select id="sListsCourses">${wJT.rules.coursesAt.map(m => `<option value="${m}" ${wListsCourses() === m ? 'selected' : ''}>${m} a heat</option>`).join('')}</select></label>`);
  $('sListsCourses').onchange = e => { SET.listsCourses = +e.target.value; saveSettings(); if (WJT) wListsBarNote(); };
}
new MutationObserver(wListsSetRow).observe($('modalBox'), { childList: true });

// How to play: Jousting, how it works
function wListsHowHTML() {
  const R = wJT.rules, P = R.pts;
  return `<p class="hint">A match is a tourney between two clubs, two riders a side (the other two of the four are squires). Each side's first rider meets the other's first in a <b>heat</b> of ${R.courses} <b>courses</b> (or ${R.coursesAt.join(' or ')} in Settings), then the second riders ride the second heat. A course is one pass down the <b>tilt</b>, the barrier down the middle of the lists, left side to left side.</p>
  <p class="hint"><b>Scoring a course.</b> Both riders strike in the same moment, so both can score: <b>${P.shield}</b> for a lance broken on the shield or the body, <b>${P.helm}</b> on the helm, <b>${R.unhorse}</b> for an <b>unhorsing</b> (it ends the heat: the courses left aren't ridden). A glance or a miss scores nothing. A <b>foul</b> (striking the horse, the barrier, or below the belt) takes a point off. Points from both heats are added; level after both, the <b>tilt for the crown</b>: one course at a time between each side's best rider until one is ahead (after ${R.tiltMax} still level, Sir Ruddock's count of lances broken settles it).</p>
  <p class="hint"><b>Your plan</b>, before each course: the <b>aim</b> (the shield, the body or the helm: 1, 2, 3; the helm is worth two but is a small mark, bigger when their shield is angled, and a lance that misses it leaves you reaching, so their lance rocks you more), the <b>guard</b> (angled turns strikes on your shield aside but leaves your helm open; square takes the hit and helps you stay on: Q, W) and the <b>pace</b> (a canter aims steadier and saves the mount's wind; a gallop hits harder but the tip sways more: E, R). Your squire suggests a plan, with the reason (G).</p>
  <p class="hint"><b>The charge.</b> Space (or Ride) sets off. <b>Spur:</b> tap Space with the hoofbeats (or tap the lists): taps on the beat build speed, taps off it don't. <b>Couch:</b> after the spur, hold Space (or hold a finger down) to lower the lance. The right moment is marked on the bar: too early and your arm tires and the tip droops (low strikes are fouls), too late and the tip never settles; let go and the lance comes up, a miss. <b>Aim:</b> the tip rides the horse's stride in a figure-eight; hold it on your mark with the arrows, or drag. A good lance rating sways less.</p>
  <p class="hint"><b>Keep your seat.</b> When their lance breaks on you, your rider rocks: lean against the wobble (the left and right arrows, drag, or the Lean buttons) to stay on. A harder hit (the helm, a gallop) wobbles more; a square guard helps. A glance never unhorses.</p>
  <p class="hint"><b>Their riders</b> (on the bar): a <b>Squire</b> picks a plan at random; a <b>Knight</b> mixes its plans by the odds, so riding the same plan every course won't beat it, and reads the score and the heat (behind with too few courses left, it goes for the helm; well ahead, it weighs the points against it double); an <b>Archmage</b> reads how your riders have ridden this match and rides against it, saves its mount's wind for when a gallop pays, and has surer hands. Your squire's plan is the best by the odds against how their riders ride. <b>Watch</b> hands both sides to the CPU, and Speed on the bar runs it faster.</p>`;
}
const wW147RenderHelp = renderHelp;
renderHelp = function () {
  wW147RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpLists') || !$('wHelpGrounds')) return;
  const after = $('wHelpShed') || $('wHelpLanes') || $('wHelpLinks') || [...h.querySelectorAll('[id^="wHelpG"]')].pop();
  h.insertAdjacentHTML('beforeend', `<section id="wListsHow" class="wghelp"><h3>Jousting: how it works</h3>${wListsHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLists"><b>Real jousting.</b> The Tilting Lists runs jousting on the sand itself now, two riders a side. Ask Sir Ruddock to JOUST: two heats of ${wJT.rules.courses} courses. Pick your plan, spur with the hoofbeats, couch the lance and hold the tip on your mark, then keep your seat; or watch the two sides ride it out, with the tourney board under the lists (see Jousting: how it works). It is an exhibition: nothing is won or lost.</p>`);
};
