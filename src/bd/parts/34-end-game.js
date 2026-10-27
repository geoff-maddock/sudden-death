/* ================= End game / save for later ================= */
// While a game is on, the header shows Pause and "End game"; otherwise only "New game".
// End game asks: end it for good (nothing is recorded), save it for later, or keep playing.
// Exhibition games are saved to localStorage bd-exh-live and resumed from the setup card;
// season games are saved into the season (S.live) and resumed from the Clubhouse.
function gameOn() { return !!(G.teams && G.phase !== 'menu' && G.phase !== 'over'); }
var EXH_SNAP = null; // the snapshot from the start of the latest pitch of an exhibition game
function exhSnap() { if (G.season || !gameOn()) return; G.season = true; try { EXH_SNAP = snapGame(); if (EXH_SNAP) EXH_SNAP.opts = { ...G.opts, defs: undefined }; } finally { G.season = false; } }
function loadExhSave() { try { return JSON.parse(localStorage.getItem('bd-exh-live') || 'null'); } catch (e) { return null; } }

/* ---------- the header buttons ---------- */
let HDR_ON = null;
function syncHeaderButtons() {
  const on = gameOn(); if (on === HDR_ON) return; HDR_ON = on;
  const bp = document.getElementById('bPause'), bm = document.getElementById('bMenu');
  if (bp) bp.hidden = !on;
  if (bm) { bm.textContent = on ? 'End game' : 'New game'; bm.classList.toggle('endg', on); }
  const sq = document.getElementById('bSaveQuit'); if (sq) sq.hidden = !on;
}

/* ---------- the confirm dialog ---------- */
const endDlg = document.createElement('div');
endDlg.id = 'endDlg'; endDlg.className = 'dlg-back'; endDlg.hidden = true;
endDlg.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="endDlgT">
  <h2 id="endDlgT">End this game?</h2>
  <p id="endDlgP" class="sub"></p>
  <div class="dlg-btns">
    <button class="go" type="button" data-end="save">Save for later and exit</button>
    <button class="ghost dlg-danger" type="button" data-end="wipe">End game (don't save)</button>
    <button class="ghost" type="button" data-end="cancel">Keep playing</button>
  </div></div>`;
document.body.appendChild(endDlg);
let END_PAUSED = false;
function openEndDlg() {
  if (!gameOn()) { showMenu(); return; }
  const [a, h] = G.teams;
  document.getElementById('endDlgP').innerHTML = `${esc(a.def.name)} ${a.R}, ${esc(h.def.name)} ${h.R} · ${G.half ? 'bottom' : 'top'} of the ${ORD(G.inning)}.<br>` +
    (G.season ? 'Saving keeps this season game where it is; resume it from the Clubhouse. Ending it wipes the game, and it starts over next time you play it.' : 'Saving keeps this game where it is; resume it from the setup screen. Ending it wipes it: no result, no stats.');
  END_PAUSED = !G.paused; G.paused = true;
  document.getElementById('pause').hidden = true;
  endDlg.hidden = false; endDlg.querySelector('[data-end="save"]').focus();
}
function closeEndDlg(resume) {
  endDlg.hidden = true;
  if (resume && END_PAUSED) G.paused = false;
  END_PAUSED = false;
  try { cv.focus({ preventScroll: true }); } catch (e) { }
}
function backToSetup() {
  G.phase = 'menu'; G.paused = false; PL = null;
  document.getElementById('pause').hidden = true; document.getElementById('bPause').textContent = 'Pause';
  showMenu(); // clears the board
  try { history.replaceState(null, '', '#play'); } catch (e) { }
  showPage('play'); renderSavedGame();
}
// End game: wipe it entirely
function endGameWipe() {
  if (G.season && S) { S.live = null; saveSeason(0); }
  backToSetup();
}
// Save for later: keep the snapshot from the start of this pitch
function saveForLater() {
  if (G.season) { saveAndQuit(); return; }
  if (G.phase === 'plate' && G.P && G.P.stage === 'select') exhSnap();
  if (EXH_SNAP) { EXH_SNAP.savedAt = Date.now(); try { localStorage.setItem('bd-exh-live', JSON.stringify(EXH_SNAP)); } catch (e) { } }
  backToSetup();
}
endDlg.addEventListener('click', e => {
  if (e.target === endDlg) { closeEndDlg(true); return; }
  const b = e.target.closest('[data-end]'); if (!b) return;
  const a = b.dataset.end; closeEndDlg(a === 'cancel');
  if (a === 'save') saveForLater(); else if (a === 'wipe') endGameWipe();
});
window.addEventListener('keydown', e => { if (!endDlg.hidden && e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeEndDlg(true); } }, true);

/* ---------- resuming a saved exhibition game ---------- */
function renderSavedGame() {
  const el = document.getElementById('savedGame'); if (!el) return;
  const sn = loadExhSave();
  if (!sn) { el.hidden = true; el.innerHTML = ''; return; }
  const [a, h] = sn.defs, [ta, th] = sn.teams;
  el.hidden = false;
  el.innerHTML = `<div><b>Saved game:</b> ${esc(a.short || a.name)} ${ta.R}, ${esc(h.short || h.name)} ${th.R} · ${sn.half ? 'bottom' : 'top'} of the ${ORD(sn.inning)}<div class="sub">${sn.savedAt ? new Date(sn.savedAt).toLocaleString() : ''}</div></div>
    <div class="row" style="gap:6px"><button class="buy" type="button" data-sg="resume">Resume</button><button class="buy" type="button" data-sg="drop">${SG_CONFIRM ? 'Click again to discard' : 'Discard'}</button></div>`;
}
let SG_CONFIRM = false;
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-sg]'); if (!b) return;
  if (b.dataset.sg === 'drop') {
    if (!SG_CONFIRM) { SG_CONFIRM = true; renderSavedGame(); setTimeout(() => { SG_CONFIRM = false; renderSavedGame(); }, 3500); return; }
    SG_CONFIRM = false; try { localStorage.removeItem('bd-exh-live'); } catch (err) { } renderSavedGame(); return;
  }
  const sn = loadExhSave(); if (!sn) return;
  try { localStorage.removeItem('bd-exh-live'); } catch (err) { }
  actx(); resumeSnap(sn, false); renderSavedGame();
});
renderSavedGame();
