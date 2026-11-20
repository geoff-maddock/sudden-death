/* w124: the call and the read at the Shed (issue #102, phase 4), as w115 is the Lanes'. Your skip says why it calls a
   shot (the Shot row's line), and the ice chart: the sheet on its side, the pebble's wear and every stone's path this
   game, for as far back as your skip reads it (the rest hatched). The chart opens from the Throw row's Ice chart
   button or C, in a box; the game waits while it is open.
   Wraps: wShedRows (wW124ShedRows: the reason and the Ice chart button), wShedHowHTML (wW124ShedHow: the call and the
   chart). The C key comes from the page (wCR.onChart). */

function wShedChart() {
  if (!WCR || !wCR.G || !wCR.G.teams) return;
  const s = wCR.view ? wCR.view.you : 0, was = wCR.paused; wCR.pause(true);
  const close = modal(`<header><h3>The ice chart</h3><button class="ghost" data-close>Done</button></header>
    <canvas id="wShedChartCv" width="880" height="300" style="width:100%;max-width:880px;display:block;margin:0 auto;border-radius:6px" aria-label="The sheet on its side: the pebble's wear and every stone's path this game"></canvas>
    <p class="hint">The sheet on its side: the hack is off to the left, the house at the right. Blue stains are worn pebble, where stones have run: worn ice is keener, so a stone runs further on it. The lines are every stone's path this game, each rink in its colour, the last one bold. ${wCR.view && wCR.view.mode === 'watch' ? `${esc(wCR.G.teams[s].name)}'s skip reads` : 'Your skip reads'} the ice ${Math.round(wCR.readIn(s) / 12)} feet back from the tee; past that it is hatched (a better reader sees more, the best all the way to the hog line).</p>`, () => { if (WCR && !was) wCR.pause(false); wDrain(); });
  const cv = $('wShedChartCv'); wCR.chart(cv, s);
  void close;
}
wCR.onChart = () => wShedChart();

const wW124ShedRows = wShedRows;
wShedRows = function () {
  wW124ShedRows();
  const V = WCR && !WCR.over && wCR.G && wCR.G.teams ? wCR.view : null; if (!V || V.mode !== 'play' || V.up !== V.you || !V.sel || $('wShedRows').hidden) return;
  const why = V.sel.reason;
  if (why && !$('wShedShot').querySelector('.wshedwhy')) $('wShedShot').insertAdjacentHTML('beforeend', ` <small class="hint wshedwhy">Your skip: ${esc(why)}.</small>`);
  if (!$('wShedGo').querySelector('[data-cchart]')) $('wShedGo').insertAdjacentHTML('afterbegin', `<button class="ghost" data-cchart="1" title="C: the pebble's wear and every stone's path">Ice chart</button> `);
};
$('wShedRows').addEventListener('click', e => { const b = e.target.closest('[data-cchart]'); if (b) wShedChart(); });
// (and beside How to play under the ice, for any stone, Watch too)
$('wShedHowBtn').parentElement.insertAdjacentHTML('beforeend', ' <button class="ghost" id="wShedChartBtn" title="C: the pebble\'s wear and every stone\'s path">Ice chart</button>');
$('wShedChartBtn').addEventListener('click', () => wShedChart());

const wW124ShedHow = wShedHowHTML;
wShedHowHTML = function () {
  return wW124ShedHow() + `<p class="hint"><b>The skip's call.</b> Before each stone your skip calls a shot and says why: they have shot stone (take it out), a guard to steal behind, the hammer and the house kept clean, a corner guard to set up two. The skip plays the game, not just the end: in the last end, level with the hammer, a single wins it; two down, a single is no use. An Archmage looks a stone further ahead, at the other rink's likeliest reply.</p>
  <p class="hint"><b>The ice chart</b> (C, or an Ice chart button, any time at the Shed) shows the sheet on its side: worn pebble as blue stains, where stones have run, and every stone's path this game. Your skip reads it only so far back from the tee: a better reader sees more of it, the best all the way to the hog line.</p>`;
};
