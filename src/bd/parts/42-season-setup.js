/* ================= Season setup: a different club than the run in progress ================= */
// Picking Season or Watch a CPU season with a club other than the one whose run is in progress used to
// silently carry on the old run. Now it asks: start a new season with the club you picked (the old run is
// recorded as abandoned), or keep the current one.
const ssDlg = document.createElement('div');
ssDlg.className = 'dlg-back'; ssDlg.hidden = true;
document.body.appendChild(ssDlg);
function askSeasonSwitch(opts) {
  const t = getTeam(opts.team), cur = S.club;
  ssDlg.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="ssT">
    <h2 id="ssT">Start a new season?</h2>
    <p class="sub">A season with the <b style="color:${cur.color}">${esc(cur.name)}</b> is in progress (game ${S.game + 1} of ${SEASON_GAMES}, ${S.wins}–${S.losses}). You picked the <b style="color:${t.color}">${esc(t.name)}</b>${opts.mode === 'cpuseason' ? ' for the CPU to manage' : ''}.</p>
    <div class="dlg-btns">
      <button class="go" type="button" data-ss="new">New season with the ${esc(t.name)}</button>
      <button class="ghost" type="button" data-ss="keep">Keep the ${esc(cur.name)} season</button>
      <button class="ghost" type="button" data-ss="cancel">Cancel</button>
    </div>
    <p class="sub" style="margin:10px 0 0">Starting over puts the current run in the Records as abandoned.</p></div>`;
  ssDlg.hidden = false; ssDlg.querySelector('[data-ss="new"]').focus();
}
ssDlg.addEventListener('click', e => {
  if (e.target === ssDlg) { ssDlg.hidden = true; return; }
  const b = e.target.closest('[data-ss]'); if (!b) return;
  ssDlg.hidden = true;
  if (b.dataset.ss === 'new') startFromSetup({ switchOk: true, fresh: true });
  else if (b.dataset.ss === 'keep') { const r = document.querySelector(`input[name=team][value="${S.teamId}"]`); if (r) r.checked = true; startFromSetup({ switchOk: true }); }
});
window.addEventListener('keydown', e => { if (!ssDlg.hidden && e.code === 'Escape') { e.stopImmediatePropagation(); ssDlg.hidden = true; } }, true);
