/* w115: the call and the read at the Lanes (issue #100, phase 4). Your ball's rows gain the call:
   - Line (L): deep inside, the pocket, up the boards, for a first ball; picking one puts the coach's setup for it on
     your feet and arrow;
   - Split (S), when the rack is a split: convert (at the front pin, to slide it into the rest) or safe (the bigger
     group, the sure count);
   - Stance: tempo (T: quick or steady) and ball (H: heavy or light), kept from ball to ball; and the coach's word (W,
     once a game: this ball's guide line, and the chart, follow the oil as it is now);
   - Pinch (once a game, before a frame's first ball): another of your five bowls this frame, by their arm.
   The lane chart (C, or Lane chart on the bar and the rows): the oil on the lane your side bowls next, as far down as
   your bowler reads it (all of it at the turn and with the coach's word), and every ball's track on it this game.
   The game waits while it is open.
   Wraps: wLanesRows (wW115LanesRows: the call's rows), wLanesHowHTML (wW115LanesHow: the call and the read). */

$('wLanesRows').insertAdjacentHTML('beforeend', `<div class="wccrow" id="wLanesRowLine"><span class="wccl">Line</span><span id="wLanesLine"></span></div>
  <div class="wccrow" id="wLanesRowSplit" hidden><span class="wccl">Split</span><span id="wLanesSplit"></span></div>
  <div class="wccrow" id="wLanesRowStance"><span class="wccl">Stance</span><span id="wLanesStance"></span></div>
  <div class="wccrow" id="wLanesRowPinch"><span class="wccl">Pinch</span><span id="wLanesPinch"></span></div>`);
$('wLanesAgain').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wLanesChartBtn" title="C: the oil on the lane, as far as your bowler reads it, and every ball\'s track this game">Lane chart</button>');
$('wLanesChartBtn').addEventListener('click', () => wLanesChart());
$('wLanesRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset; let r = null;
  if (d.nline) r = wBL.select({ line: d.nline });
  else if (d.nsplit) r = wBL.select({ split: d.nsplit });
  else if (d.ntempo) r = wBL.select({ tempo: d.ntempo });
  else if (d.nweight) r = wBL.select({ weight: d.nweight });
  else if (d.nword) r = wBL.select({ word: true });
  else if (d.npinch != null) r = wBL.select({ pinch: +d.npinch });
  else if (d.nchart) { wLanesChart(); return; }
  else return;
  if (typeof r === 'string') $('wLanesNote').textContent = r;
  wLanesRows();
});

const wW115LanesRows = wLanesRows;
wLanesRows = function () {
  wW115LanesRows();
  const V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null; if (!V || V.mode !== 'play' || !V.sel || V.up !== V.you) return;
  const G = wBL.G, s = V.you, aim = V.ph === 'aim', dis = aim ? '' : 'disabled', on = (a, b) => a === b ? ' on' : '', first = G.stand[s].length === 10, fresh = G.rb[s] === 0;
  const L = wBL.lines, line = wBL.line(s), tip = { deep: 'Stand further in: more angle into the pocket and more carry, and a bigger miss', pocket: 'The standard line', boards: 'Stand further out and play it straighter: safer when the lane has dried, less angle' };
  $('wLanesRowLine').hidden = !first;
  $('wLanesLine').innerHTML = Object.keys(L).map(k => `<button class="ghost${on(k, line)}" data-nline="${k}" ${dis} title="L: ${esc(tip[k])}">${esc(L[k].n)}</button>`).join(' ') + ` <button class="ghost" data-nchart="1" title="C">Lane chart</button>`;
  const split = !first && wBL.isSplit(G.stand[s]);
  $('wLanesRowSplit').hidden = !split;
  if (split) $('wLanesSplit').innerHTML = [['convert', 'Convert', 'At the front pin, to slide it into the rest: both, or neither'], ['safe', 'Safe', 'The bigger group: the sure count']].map(([k, n, t]) => `<button class="ghost${on(k, wBL.split(s))}" data-nsplit="${k}" ${dis} title="S: ${esc(t)}">${n}</button>`).join(' ') + (wBL.splitMakeable(G.stand[s]) ? ' <small class="hint">This one can be made.</small>' : ' <small class="hint">A long way apart.</small>');
  const st = wBL.stance(s), wl = wBL.word[s], won = wBL.wordOn[s];
  $('wLanesStance').innerHTML = [['quick', 'Quick', 'T: a quicker meter and less arm spent, a touch less true'], ['steady', 'Steady', 'T: the meter at its own pace']].map(([k, n, t]) => `<button class="ghost${on(k, st.tempo)}" data-ntempo="${k}" ${dis} title="${esc(t)}">${n}</button>`).join(' ') + ' · '
    + [['heavy', 'Heavy ball', 'H: more carry through the pins, more arm, a few less revs'], ['light', 'Light ball', 'H: more revs, and it deflects more']].map(([k, n, t]) => `<button class="ghost${on(k, st.ball)}" data-nweight="${k}" ${dis} title="${esc(t)}">${n}</button>`).join(' ') + ' · '
    + `<button class="ghost${won ? ' on' : ''}" data-nword="1" ${aim && wl > 0 && !won ? '' : 'disabled'} title="W: once a game. This ball's guide line and the chart follow the oil as it is now">${won ? 'Coach\'s word: on' : `Coach's word (${wl} left)`}</button>`;
  const used = G.pinched[s], arm = wBL.arm, T = G.teams[s];
  $('wLanesRowPinch').hidden = !fresh || !G.stand[s].length || G.stand[s].length < 10 || !!wBL.beforeFrame(s);
  $('wLanesPinch').innerHTML = used ? '<small class="hint">Used this game.</small>' : T.roster.map((m, i) => i === V.bowler ? '' : `<button class="ghost" data-npinch="${i}" ${dis} title="Once a game: ${esc(m.n)} bowls this frame instead">${esc(m.n)} <small>${Math.round(arm[s][i] * 100)}%</small></button>`).join(' ') + ' <small class="hint">Once a game: another of your five bowls this frame.</small>';
};

// the lane chart, in a box; the game waits while it is open
function wLanesChart() {
  if (!WBL || !wBL.G || !wBL.G.teams) return;
  const s = wBL.view && wBL.view.up >= 0 ? wBL.view.up : 0, ft = wBL.readFt(s), G = wBL.G, lane = wBL.lane(s);
  modal(`<header><h3>Lane ${lane + 1}: the oil, and every ball on it</h3><button class="ghost" data-close>Done</button></header>
    <div class="wmsg"><canvas id="wLanesChartCv" width="720" height="260" style="width:100%;max-width:720px;display:block;margin:0 auto;border-radius:6px"></canvas>
    <p class="hint">The foul line is on the left and the pins on the right; the boards count up from the right edge (1) to the left (39). Blue is oil: the ball skids on it and hooks where it is dry. ${ft < 60 ? `${esc(G.teams[s].roster[wBL.bowler(s)].n)} reads it ${ft} feet down; the rest is hatched (all of it at the turn, or with the coach's word).` : 'All of the oil is read for this ball.'} Every ball on this lane this game is drawn in its side's colour, the last one bold: where the tracks bunch, the oil is going.</p></div>`);
  const cv = $('wLanesChartCv'); if (cv) wBL.chart(cv, s);
}
wBL.onChart = () => wLanesChart();

const wW115LanesHow = wLanesHowHTML;
wLanesHowHTML = function () {
  return wW115LanesHow() + `<p class="hint"><b>The line</b> (L), before a first ball. <b>Deep inside</b>: stand further in for more angle into the pocket; more carry, and a bigger miss. <b>The pocket</b>: the standard line. <b>Up the boards</b>: stand further out and play it straighter; safer once the lane has dried, with less angle. Picking a line puts the coach's setup for it on your feet and arrow.</p>
  <p class="hint"><b>Splits</b> (S): <b>Convert</b> goes at the front pin to slide it into the rest (both, or neither); <b>Safe</b> takes the bigger group for the sure count. The row says whether this one can be made.</p>
  <p class="hint"><b>Stances</b>, kept from ball to ball. <b>Tempo</b> (T): Quick runs the meter quicker and spends less arm, a touch less true. <b>Ball</b> (H): Heavy drives through the pins harder and costs more arm; Light spins more and deflects more.</p>
  <p class="hint"><b>The lane chart</b> (C) shows the oil on the lane you bowl next, but only as far down as your bowler <b>reads</b> it (25 feet, to all 60 for the best reader), and every ball's track on it this game. The overhead strip does the same on your ball. <b>The turn</b>: your first ball after the halfway frame, the lanes are re-read and the chart shows all of it. <b>The coach's word</b> (W), once a game: this ball's guide line and the chart follow the oil as it is now.</p>
  <p class="hint"><b>Pinch</b>, once a game, before a frame's first ball: another of your five bowls the frame instead. Their arm is on the button: a fresh arm for a tired anchor.</p>
  <p class="hint"><b>Their call.</b> A Squire plays the pocket every ball. A Knight goes deep when it needs strikes late, and up the boards when well ahead or once its track has dried (fresher oil off the worn line); it plays splits safe unless it needs the pins, and takes the coach's word for the tenth. An Archmage also moves up the boards once it has seen you keep throwing the same line on a lane; it goes for splits it can make, eases its tempo and ball when its bowler tires, and sends in a fresher pinch bowler for a spent anchor.</p>`;
};
