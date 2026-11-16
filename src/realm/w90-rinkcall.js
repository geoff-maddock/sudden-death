/* w90: the call at the rink (issue #83, phase 5). Manage joins Watch and You play on the rink's bar (w88): the CPU
   skates both sides and the calls are yours. Under the rink, in Manage and in You play, the coach's rows (#wRinkCalls,
   laid out as the court's and the gridiron's are, w87): your system with the puck and without it, your power-play and
   penalty-kill setups, Tempo and Edge, each button lit when it is on and its tooltip saying what it does and how it
   does against their call now; then the bench: Change now, who changes your lines (the coach, or you), the timeout and
   the goalie. A line under the rows says how your system is doing against theirs right now. In Watch the rows go and
   a line says the coaches make the calls.
   The other coach's skill is opts.skill (0 Squire, 1 Knight, 2 Archmage); a scrimmage's is a Knight.
   Wraps: wRinkBarNote (wW90RinkBarNote: the rows kept up, the status line in Manage), wLeaveRink (wW90LeaveRink),
   renderHelp (wW90RenderHelp: #wRinkHowCall). */
const W_RINK_CALLS = [['att', 'With the puck', 'atts'], ['def', 'Without it', 'defs'], ['pp', 'Power play', 'pps'], ['pk', 'Penalty kill', 'pks'], ['tempo', 'Tempo', 'tempos'], ['edge', 'Edge', 'edges']];
let W_RINK_ROWKEY = '';
$('wRinkPad').insertAdjacentHTML('afterend', '<div id="wRinkCalls" class="wccalls wscoach" hidden></div><p id="wRinkCallsNone" class="hint" hidden>Watch: the coaches make the calls. Pick Manage to make yours, or You play to skate as well.</p>');

// how a call of yours does against theirs now: a sentence, or ''
function wRinkEdgeLine(kind, id) {
  const you = wHK.you, C = wHK.calls, mine = C[you], theirs = C[1 - you];
  const e = kind === 'att' ? wHK.edge(id, theirs.def) : kind === 'def' ? wHK.edge(theirs.att, id) : kind === 'pp' ? wHK.edgePP(id, theirs.pk) : kind === 'pk' ? wHK.edgePP(theirs.pp, id) : [0, ''];
  if (!e[0]) return '';
  const good = kind === 'att' || kind === 'pp' ? e[0] > 0 : e[0] < 0;
  return `${good ? 'Good' : 'Poor'} against what they are in now: ${e[1]}`;
}
function wRinkCallRows() {
  const you = wHK.you, mine = wHK.calls[you];
  return W_RINK_CALLS.map(([kind, lab, table]) => `<div class="wccrow"><span class="wccl">${lab}</span>${Object.entries(wHK[table]).map(([k, v]) => { const edge = wRinkEdgeLine(kind, k);
    return `<button class="ghost${mine[kind] === k ? ' on' : ''}${edge.startsWith('Good') ? ' wgood' : edge.startsWith('Poor') ? ' wpoor' : ''}" aria-pressed="${mine[kind] === k}" data-rcall="${kind}" data-rid="${k}" title="${esc(v.desc + (edge ? ' ' + edge : ''))}">${esc(v.n)}</button>`; }).join('')}</div>`).join('');
}
// the line under the rows: your system against theirs, both ways, as the strengths stand
function wRinkNowLine() {
  const you = wHK.you, C = wHK.calls, mine = C[you], theirs = C[1 - you], n = wHK.strength();
  const part = (e, a, d, yours) => `${yours ? 'Your' : 'Their'} ${a} against ${yours ? 'their' : 'your'} ${d}${e[0] ? `: ${e[1]}` : ': even.'}`;
  if (n[you] > n[1 - you]) return part(wHK.edgePP(mine.pp, theirs.pk), wHK.pps[mine.pp].n, wHK.pks[theirs.pk].n, true);
  if (n[you] < n[1 - you]) return part(wHK.edgePP(theirs.pp, mine.pk), wHK.pps[theirs.pp].n, wHK.pks[mine.pk].n, false);
  return `${part(wHK.edge(mine.att, theirs.def), wHK.atts[mine.att].n, wHK.defs[theirs.def].n, true)} ${part(wHK.edge(theirs.att, mine.def), wHK.atts[theirs.att].n, wHK.defs[mine.def].n, false)}`;
}
function wRinkCalls(force) {
  const box = $('wRinkCalls'), mode = wHK.mode, show = !!WHK && !WHK.over && !!wHK.calls && mode !== 'watch';
  box.hidden = !show; $('wRinkCallsNone').hidden = !WHK || !!WHK.over || mode !== 'watch';
  if (!show) { W_RINK_ROWKEY = ''; return; }
  if (!box.querySelector('.wccrows')) box.innerHTML = '<div class="wccrows"></div><p class="hint wrnow" id="wRinkNow"></p><div class="wccnowbox"></div>';
  const you = wHK.you, C = wHK.calls, rk = JSON.stringify([C, wHK.strength()]);
  if (force || rk !== W_RINK_ROWKEY) { W_RINK_ROWKEY = rk; box.querySelector('.wccrows').innerHTML = wRinkCallRows(); $('wRinkNow').textContent = wRinkNowLine(); }
  const to = wHK.to[you], pulled = wHK.pulled(you), ph = wHK.phase, whistle = ['dead', 'set', 'drop'].includes(ph), nk = [to, pulled, wHK.auto, whistle, ph === 'live', wHK.skillNames[wHK.G.skill[1 - you]]].join('|');
  if (force || nk !== box.dataset.now) {
    box.dataset.now = nk;
    box.querySelector('.wccnowbox').innerHTML = `<div class="wccrow"><span class="wccl">Bench</span>
      <button class="ghost" data-rbench="change" ${ph === 'live' ? '' : 'disabled'} title="Send your tired skaters off for fresh ones now. At the wrong moment it gives up a rush.">Change now</button>
      <button class="ghost${wHK.auto ? ' on' : ''}" data-rbench="auto" aria-pressed="${wHK.auto}" title="Who changes your lines: the coach (when it is safe), or only you.">Lines: ${wHK.auto ? 'the coach' : 'you'}</button>
      <button class="ghost" data-rbench="timeout" ${to && whistle ? '' : 'disabled'} title="One a game, at a whistle: your skaters on the ice get their breath back. Most use after an icing, when a tired line may not change.">Timeout (${to} left)</button>
      <button class="ghost${pulled ? ' on' : ''}" data-rbench="pull" ${ph === 'live' ? '' : 'disabled'} aria-pressed="${!!pulled}" title="Take your goalie off for an extra skater, or send them back. The net is empty while they are off.">${pulled ? 'Goalie back' : 'Pull goalie'}</button>
      <small class="hint">Their coach: ${esc(wHK.skillNames[wHK.G.skill[1 - you]])}.</small></div>`;
  }
}
$('wRinkCalls').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !WHK) return;
  if (b.dataset.rcall) { wHK.call(wHK.you, b.dataset.rcall, b.dataset.rid); wRinkCalls(true); }
  else if (b.dataset.rbench) { wHK.benchAct(b.dataset.rbench); wRinkCalls(true); }
});

const wW90RinkBarNote = wRinkBarNote;
wRinkBarNote = function () {
  wW90RinkBarNote();
  if (WHK && !WHK.over && wHK.mode === 'manage') { const G = wHK.G; $('wRinkNote').textContent = `You manage ${G.teams[0].name}: the calls under the rink are yours (systems, special teams, Tempo, Edge, the lines, the timeout and the goalie), and the skaters play them.`; }
  wRinkCalls(true);
};
// (kept up with the pad, a few times a second)
const wW90RinkPad = wRinkPad;
wRinkPad = function () { wW90RinkPad(); if (WHK && UI.view === 'rink') wRinkCalls(false); };
const wW90LeaveRink = wLeaveRink;
wLeaveRink = function () { W_RINK_ROWKEY = ''; $('wRinkCalls').hidden = true; $('wRinkCallsNone').hidden = true; return wW90LeaveRink(); };

function wRinkHowCallHTML() {
  const list = T => Object.values(T).map(v => `<b>${esc(v.n)}</b> (${esc(v.desc.replace(/\.$/, ''))})`).join('; ');
  return `<p class="hint"><b>The call.</b> Each side has a system with the puck, a system without it, a power-play and a penalty-kill setup, and two stances. Yours are under the rink in <b>Manage</b> (the skaters play, you coach) and in You play; they stand until you change them.</p>
  <p class="hint"><b>With the puck:</b> ${list(wHK.atts)}. <b>Without it:</b> ${list(wHK.defs)}.</p>
  <p class="hint">They work like rock, paper, scissors, with the ratings on top: a Forecheck that is beaten gives up a Rush, the Trap stops a Rush and does nothing against a Dump, a Collapse leaves the Point open and smothers a Cycle, and a Box owns the front of the net against a Crash. A system that suits what they are in is worth a little on every shot and every poke. The line under the rows says how yours is doing against theirs now, and each button's tooltip says how it would do.</p>
  <p class="hint"><b>Power play:</b> ${list(wHK.pps)}. <b>Penalty kill:</b> ${list(wHK.pks)}. These take over when a side is a skater short.</p>
  <p class="hint"><b>The scout.</b> A system kept on from one face-off to the next is read a little better each time. Change it now and then.</p>
  <p class="hint"><b>Tempo:</b> ${list(wHK.tempos)}. <b>Edge:</b> ${list(wHK.edges)}.</p>
  <p class="hint"><b>The bench.</b> Change now sends your tired skaters off; Lines sets whether the coach changes them for you. One <b>timeout</b> a game, at a whistle: the skaters on the ice get their breath back, which matters most after you ice the puck, when your tired line may not change. Pull goalie takes yours off for an extra skater.</p>
  <p class="hint"><b>Their coach</b> is a Squire, a Knight or an Archmage. A Squire calls at random, is late changing lines, and his skaters drift after the puck and pass on a guess. A Knight reads the score and the clock and plays to his skaters. An Archmage also reads your call and answers it.</p>`;
}
const wW90RenderHelp = renderHelp;
renderHelp = function () {
  wW90RenderHelp();
  const h = $('wRinkHow'); if (!h || $('wRinkHowCall')) return;
  h.insertAdjacentHTML('beforeend', `<div id="wRinkHowCall">${wRinkHowCallHTML()}</div>`);
};
