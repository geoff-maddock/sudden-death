/* w151: the tilting yard as a practice run (issue #117, phase 5). Dame Ferrow's tilting yard in Mossgate (sp_tilt, w23)
   has straw targets on posts, and now you can ride at them: from the yard's card, A run at the straw targets puts your
   four's first rider (the Lists tab's) on the Tilting Lists' engine for W_JTYARD.runs runs at a straw target. Each run
   is your plan (the mark and the pace), then the spur, the couch and the aim by hand, as on Play; the target doesn't
   strike back, so there is no seat to keep. After each run the herald says where the lance went and how you spurred,
   couched and aimed; after the last, the yard's summary. Nothing is at stake: no rewards, no time, no box lines, and
   as often as you like (the week's drill and challenge are the yard's as before).
   wListsYard()   starts the runs ('' or why not)
   Wraps: wOpenSpot (wW151OpenSpot: the yard's row), wListsBarNote (wW151ListsBarNote: the yard's bar), wListsRows
   (wW151ListsRows: no guard to pick at a straw target), wListsBoard (wW151ListsBoard: the runs), wListsHowHTML
   (wW151ListsHow), renderHelp (wW151RenderHelp: a line in #wHelpSpots). */

const W_JTYARD = { spot: 'sp_tilt', runs: 5 };
function wListsYard() {
  if (!WG) return '';
  const mine = wListsMine();
  wListsGame({ yard: { runs: W_JTYARD.runs }, teams: [mine], riders: [mine.riders, null], squires: [mine.squires, null], mounts: [mine.mounts, null], best: [mine.best, null], mode: 'play',
    title: 'The tilting yard: runs at the straw target' });
  WJT.yard = true;
  wListsBarNote(); wListsRows(); wListsBoard();
  return '';
}
const wW151OpenSpot = wOpenSpot;
wOpenSpot = function (id, msg) {
  wW151OpenSpot(id, msg);
  if (id !== W_JTYARD.spot || !WG) return;
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  list.insertAdjacentHTML('beforeend', `<li class="wbcl"><span class="wbsw" style="background:${W_GRD_COL.jousting}"></span><div><b>A run at the straw targets</b><small>Your first rider (the Lists tab's) rides ${W_JTYARD.runs} runs at a straw target: tap with the hoofbeats to spur, hold to couch, and keep the tip on your mark. Nothing at stake: no rewards, as often as you like.</small></div>
    <div class="row"><button class="ghost" id="wSpotYard">Ride at the targets</button></div></li>`);
  $('wSpotYard').onclick = () => { $('modalBox').querySelector('[data-close]').click(); wListsYard(); };
};
$('wListsAgain').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wListsYardAgain" hidden>Ride again</button>');
$('wListsYardAgain').onclick = () => wListsYard();
const wW151ListsBarNote = wListsBarNote;
wListsBarNote = function () {
  wW151ListsBarNote();
  const y = !!(WJT && WJT.yard);
  $('wListsYardAgain').hidden = !y || !WJT.over;
  if (!y) { $('wListsModes').querySelector('[data-jmode="manage"]').hidden = false; return; }
  $('wListsAgain').hidden = true; $('wListsCourses').parentElement.hidden = true; $('wListsSkill').parentElement.hidden = true;
  $('wListsModes').querySelector('[data-jmode="manage"]').hidden = true;
  if (WJT.over && WJT.over.text) $('wListsNote').textContent = `${WJT.over.text} Nothing at stake. Ride again, or go back to the world.`;
};
const wW151ListsRows = wListsRows;
wListsRows = function () {
  wW151ListsRows();
  const y = !!(WJT && WJT.yard);
  $('wListsGuard').closest('.wccrow').hidden = y;
};
const wW151ListsBoard = wListsBoard;
wListsBoard = function () {
  if (!(WJT && WJT.yard)) return wW151ListsBoard();
  const Y = wJT.yard; if (!Y) { $('wListsBoard').innerHTML = ''; $('wListsLog').innerHTML = ''; return; }
  const R = wJT.strawRules, n = (wJT.G.yard || {}).runs || W_JTYARD.runs, cell = r => !r ? '' : r.pts > 0 ? `<b>${r.pts}</b>` : String(r.pts);
  $('wListsBoard').innerHTML = `<div style="overflow-x:auto;max-width:100%"><table class="wrpow wcboxt"><caption>The tilting yard: ${esc(R.team.name.toLowerCase())}, what each run would score</caption><tr><th></th>${Array.from({ length: n }, (_, i) => `<th>Run ${i + 1}</th>`).join('')}<th>Total</th></tr>
    <tr><td>${esc(wJT.G.teams[0].name)}</td>${Array.from({ length: n }, (_, i) => `<td>${cell(Y.runs[i])}</td>`).join('')}<td><b>${Y.pts}</b></td></tr></table></div>`;
  $('wListsLog').innerHTML = Y.runs.length ? Y.runs.slice().reverse().map(r => `<li><small>Run ${r.n}</small> ${esc(W_JT_CARD.aim[r.aim])}, ${r.pace === 'gallop' ? 'a gallop' : 'a canter'}: ${esc(wJT.atText({ at: r.at }))}${r.hand ? ` <small>(spur ${r.hits} of ${r.beats}${r.couch == null ? ', never couched' : `, couch ${Math.abs(r.couch) <= .35 ? 'right' : r.couch < 0 ? 'early' : 'late'}`}${r.off != null ? `, ${Math.round(r.off)} in off the mark` : ''})</small>` : ''}</li>`).join('') : '<li class="hint">No runs yet.</li>';
};

/* ---------- How to play ---------- */
const wW151ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  return wW151ListsHow() + `<p class="hint" id="wListsHowYard"><b>The tilting yard.</b> Dame Ferrow's yard in Mossgate has straw targets on posts: from the yard's card, ride ${W_JTYARD.runs} runs at one with your first rider, by hand. Pick a mark and a pace, then spur, couch and aim; the herald says where the lance went and how you spurred, couched and aimed. The target doesn't strike back, and nothing is at stake.</p>`;
};
const wW151RenderHelp = renderHelp;
renderHelp = function () {
  wW151RenderHelp();
  const s = $('wHelpSpots'); if (!s || s.querySelector('.wjtyard')) return;
  s.insertAdjacentHTML('beforeend', ` <span class="wjtyard">At the tilting yard you can also ride runs at the straw targets on the Tilting Lists' engine, as often as you like, with nothing at stake.</span>`);
};
