/* The same page around football and basketball (issue #80). Both screens are laid out alike, top to bottom:
     the bar: the game's title, who plays it (Watch, Manage, You play), and leaving;
     the status line under it (.wsnote): what is asked of you now, and the keys;
     the picture;
     the coach's rows (.wccalls: a label, then its buttons): the call, the stance, Powers, Subs, Bag;
     the two sides' tables side by side, then This game: what has happened so far.
   Basketball was already most of this (w77 to w82); here football's calls, stance and powers come off its bar into
   rows under the field (#wGridCoach; w48 writes Subs and Bag as rows), its lineups sit side by side, and basketball
   gets a log of the scoring (#wCourtLog, from the engine's G.log). Nothing here changes a game: the same buttons,
   ids and keys, in new places.
   Wraps: wGridBar (wW87GridBar: which rows show, and the call row's label), wCourtBox (wW87CourtBox: the log). */

/* ---------- football: the coach's rows under the field ---------- */
$('wGridPanel').insertAdjacentHTML('beforebegin', `<div id="wGridCoach" class="wccalls wscoach">
  <div class="wccrow" id="wGridRowCall"><span class="wccl" id="wGridCallL">Play</span></div>
  <div class="wccrow" id="wGridRowStance"><span class="wccl">Stance</span></div>
  <div class="wccrow" id="wGridRowPow"><span class="wccl">Powers</span></div>
  <p class="hint" id="wGridCoachNone" hidden>The coaches call both sides. Pick Manage or You play to call your own.</p></div>`);
$('wGridRowCall').append($('wGridCalls'), $('wGridDefs'));
$('wGridRowStance').append($('wGridStance'));
$('wGridRowPow').append($('wGridPows'));
$('wGridRowPow').after($('wGridTip'), $('wGridBench'));
// (the calls were heard on the bar they have left)
$('wGridRowCall').addEventListener('click', e => {
  const b = e.target.closest('button'), k = b && (b.dataset.gcall || b.dataset.gkick || b.dataset.gdef); if (!k) return;
  wGF.call(k); wGridBar();
});
$('wGridNote').classList.add('wsnote'); $('wCourtNote').classList.add('wsnote');
for (const [k, n] of [['watch', 'Watch'], ['call', 'Manage']]) { W_GRID_MODES[k].n = n; const b = $('wGridModes').querySelector(`[data-gmode="${k}"]`); if (b) b.textContent = n; }

const wW87GridBar = wGridBar;
wGridBar = function () {
  wW87GridBar.apply(this, arguments);
  if (!WGF) return;
  const offs = !$('wGridCalls').hidden, defs = !$('wGridDefs').hidden;
  $('wGridCallL').textContent = defs ? 'Defense' : 'Play';
  $('wGridRowCall').hidden = !offs && !defs; $('wGridRowStance').hidden = $('wGridStance').hidden; $('wGridRowPow').hidden = $('wGridPows').hidden;
  $('wGridCoachNone').hidden = WGF.mode !== 'watch' || !!WGF.over;
};

/* ---------- basketball: the box score's heading, and This game ---------- */
$('wCourtBox').insertAdjacentHTML('beforebegin', '<h4 class="wsh">Box score</h4>');
$('wCourtBox').insertAdjacentHTML('afterend', '<h4 class="wsh">This game</h4><ol id="wCourtLog" class="wglog wslog"></ol>');
const W_COURT_SHOT = { dunk: 'dunks', three: 'hits a three', layup: 'lays it in', jumper: 'hits a jumper', ft: 'makes a free throw' };
// every score so far, oldest first: when, the score after it, who and how
function wCourtLogHTML() {
  const G = wBK.G, log = G && G.log; if (!log || !log.length) return '<li class="hint">No baskets yet.</li>';
  const sc = [0, 0], t = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return log.map(e => { sc[e.side] += e.pts; const T = G.teams[e.side];
    return `<li style="border-left-color:${T.color}"><small>${esc(wBK.periodName(e.q))} ${t(e.clock)} · ${sc[0]}–${sc[1]}</small> <b>${esc(e.who)}</b> ${W_COURT_SHOT[e.k] || 'scores'} for ${esc(T.name)}${e.ast ? `, from ${esc(e.ast)}` : ''}.</li>`; }).join('');
}
const wW87CourtBox = wCourtBox;
wCourtBox = function () {
  wW87CourtBox.apply(this, arguments);
  const h = wBK.box() ? wCourtLogHTML() : '', L = $('wCourtLog');
  if (L.dataset.h !== h) { L.dataset.h = h; L.innerHTML = h; L.scrollTop = L.scrollHeight; }
};
