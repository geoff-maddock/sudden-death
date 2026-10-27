/* ================= Settings: saved data (see it, clear it) ================= */
// Everything the game keeps lives in this browser's localStorage under bd-* keys, and, in the published
// artifact on claude.ai, in your account's cloud store (season autosave and slots, records, careers, custom clubs).
const DATA_KEYS = { 'bd-season': 'Season in progress', 'bd-setup': 'Last setup (mode and clubs)', 'bd-settings': 'Settings', 'bd-teams': 'Your custom clubs', 'bd-history': 'Season records', 'bd-career': 'Player stats', 'bd-games': 'Game logs', 'bd-gear': 'Armory lockers', 'bd-clubrec': 'Club win–loss records', 'bd-exh-live': 'Saved exhibition game' };
let DATA_CONFIRM = null;
function dataHTML() {
  let local = null; try { const raw = localStorage.getItem('bd-season'); local = raw ? JSON.parse(raw) : null; } catch (e) { }
  const at = +(localStorage.getItem('bd-season-at') || 0);
  const cloudAuto = typeof SLOTCACHE !== 'undefined' && SLOTCACHE.auto;
  const sizes = Object.keys(DATA_KEYS).map(k => { let n = 0; try { n = (localStorage.getItem(k) || '').length; } catch (e) { } return [k, n]; }).filter(x => x[1]);
  const setup = (() => { try { return JSON.parse(localStorage.getItem('bd-setup') || 'null'); } catch (e) { return null; } })();
  const btn = (k, label, danger) => `<button class="buy ${danger ? 'dlg-danger' : ''}" type="button" data-sd="${k}">${DATA_CONFIRM === k ? 'Click again to confirm' : label}</button>`;
  return `<section class="set-card">
    <div class="set-head"><h3>Saved data</h3><span class="set-state">What this browser${Cloud.ready ? ' and your claude.ai account' : ''} remembers.</span></div>
    ${Cloud.note ? `<p class="hint">${esc(Cloud.note)}</p>` : ''}
    <div class="set-row"><div class="set-lbl"><b>Season in progress</b><p>${local && local.active ? `<b style="color:${local.club.color}">${esc(local.club.name)}</b> (${local.cpu ? 'CPU managed' : 'you manage'}) · game ${local.game + 1} of ${SEASON_GAMES}, ${local.wins}–${local.losses}${at ? ` · saved ${new Date(at).toLocaleString()}` : ''}` : 'None.'}${Cloud.ready ? ' Also kept in your cloud autosave, so it follows you to other devices; a copy open in another tab keeps saving to it.' : ''}</p></div>
      <div class="row" style="gap:6px">${local && local.active ? btn('season', 'End this season', true) : ''}</div></div>
    <div class="set-row"><div class="set-lbl"><b>Last setup</b><p>${setup ? `Mode ${esc(setup.mode || '')}, club ${esc((getTeam(setup.team) || {}).name || setup.team || '')}${setup.opp ? `, opponent ${esc((getTeam(setup.opp) || {}).name || setup.opp)}` : ''}. The Play page starts with these picked.` : 'None.'}</p></div>
      <div class="row" style="gap:6px">${setup ? btn('setup', 'Forget') : ''}</div></div>
    <div class="set-row"><div class="set-lbl"><b>Everything in this browser</b><p>${sizes.map(([k, n]) => `${DATA_KEYS[k]} (${n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'})`).join(' · ') || 'Nothing yet.'}</p>
      <p>Clearing removes the season, records, stats, logs, custom clubs, lockers and settings from this browser${Cloud.ready ? ', and the season autosave from your cloud (records, stats and custom clubs kept in the cloud come back on the next load)' : ''}. The page reloads afterwards.</p></div>
      <div class="row" style="gap:6px">${btn('all', 'Clear all saved data', true)}</div></div>
  </section>`;
}
function dataAct(k) {
  if (DATA_CONFIRM !== k) { DATA_CONFIRM = k; renderSettings(); setTimeout(() => { if (DATA_CONFIRM === k) { DATA_CONFIRM = null; if (PAGE === 'settings') renderSettings(); } }, 4000); return; }
  DATA_CONFIRM = null;
  if (k === 'season') { if (S && S.active) { if (S.hist && S.hist.games.length) archiveRun('abandoned'); } S = null; saveSeason(); updateSeasonTab(); Cloud.note = ''; }
  else if (k === 'setup') { try { localStorage.removeItem('bd-setup'); } catch (e) { } }
  else if (k === 'all') {
    try { S = null; saveSeason(); for (const key of Object.keys(localStorage)) if (key.startsWith('bd-')) localStorage.removeItem(key); } catch (e) { }
    setTimeout(() => location.reload(), 600); return;
  }
  renderSettings();
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-sd]'); if (b) dataAct(b.dataset.sd); });
{ const o = renderSettings; renderSettings = function () { o.apply(this, arguments); const el = document.getElementById('settings'); if (el) el.insertAdjacentHTML('beforeend', dataHTML()); }; }
try { if (PAGE === 'settings') renderSettings(); } catch (e) { }
