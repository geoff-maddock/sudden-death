/* ================= Game logs: every finished game's play-by-play, kept for the Records page ================= */
// GAMES (newest first) lives in localStorage bd-games. Each game keeps its line score and full play-by-play.
var GAMES = [];
var GAMES_MAX = 60;
var GL = { open: null, filter: 'all', confirm: null };
try { GAMES = JSON.parse(localStorage.getItem('bd-games') || '[]') || []; } catch (e) { GAMES = []; }
function saveGames() {
  GAMES = GAMES.slice(0, GAMES_MAX);
  for (let n = GAMES.length; n > 0; n = Math.floor(n * .8)) { // if the browser runs out of room, keep fewer
    try { localStorage.setItem('bd-games', JSON.stringify(GAMES.slice(0, n))); if (n < GAMES.length) GAMES = GAMES.slice(0, n); return; } catch (e) { }
  }
}
// at the final out: file the game (returns its id so the season record can point at it)
function archiveGame(walkoff) {
  if (!G.teams || G.archived) return G.gameId || null;
  G.archived = true;
  const id = 'g' + uid();
  const log = (G.full && G.full.length ? G.full : G.log.slice().reverse()).map(l => [l.tag, l.text, l.big ? 1 : 0, l.tags ? l.tags.map(t => [t.k, t.t, t.n]) : 0]);
  const mode = G.season ? (S && S.cpu ? 'cpuseason' : 'season') : G.mode;
  GAMES.unshift({
    id, at: Date.now(), mode, innings: G.innings, played: G.inning, walkoff: !!walkoff,
    season: G.season && S ? { run: S.runId || null, club: S.club.name, n: S.game + 1 } : null,
    teams: G.teams.map(t => ({ name: t.def.name, short: t.def.short, color: t.def.color, R: t.R, H: t.H, line: t.line.slice(), ctl: t.ctl })),
    log,
  });
  saveGames();
  return id;
}
const MODE_TXT = { '1p': '1 player', '2p': '2 players', demo: 'CPU vs CPU', season: 'Season', cpuseason: 'CPU season' };
function gameLineScore(g) {
  const n = Math.max(g.innings || 0, g.played || 0, ...g.teams.map(t => t.line.length));
  let h = '<table class="ls"><thead><tr><th></th>'; for (let i = 1; i <= n; i++) h += `<th>${i}</th>`; h += '<th>R</th><th>H</th></tr></thead><tbody>';
  for (const t of g.teams) { h += `<tr><td style="color:${t.color}">${esc(t.short)}</td>`; for (let i = 0; i < n; i++) h += `<td>${t.line[i] ?? ''}</td>`; h += `<td>${t.R}</td><td>${t.H}</td></tr>`; }
  return h + '</tbody></table>';
}
function gameTitle(g) { const [a, h] = g.teams; return `${esc(a.name)} ${a.R}, ${esc(h.name)} ${h.R}`; }
function gameViewer(g) {
  const [a, h] = g.teams, w = a.R > h.R ? a : h;
  const lines = g.log.map(([tag, text, big, tags]) => `<li class="${big ? 'big' : ''}"><b>${esc(tag || '')}</b><span>${esc(text)}${tags ? `<span class="tags">${tags.map(([k, t, n]) => tagChip({ k, t, n })).join('')}</span>` : ''}</span></li>`).join('');
  return `<article class="card gl-view" id="gl-view">
    <header class="runhead"><div><h3><span style="color:${a.color}">${esc(a.name)}</span> at <span style="color:${h.color}">${esc(h.name)}</span></h3>
      <div class="sub">${new Date(g.at).toLocaleString()} · ${MODE_TXT[g.mode] || g.mode}${g.season ? ` · ${esc(g.season.club)} season, game ${g.season.n}` : ''} · ${g.innings} innings${g.played > g.innings ? ` (went ${g.played})` : ''}</div></div>
      <div class="runres"><span class="resbadge">${esc(w.short)} win${g.walkoff ? ' · walk-off' : ''}</span><button class="buy" data-gl="close">Close</button></div></header>
    <div class="lswrap">${gameLineScore(g)}</div>
    <p class="sub" style="margin:8px 0 4px">Play-by-play, first pitch to final out:</p>
    <ul class="log gl-log">${lines || '<li class="empty">No plays recorded.</li>'}</ul>
  </article>`;
}
function gamesSection() {
  const list = GAMES.filter(g => GL.filter === 'all' || (GL.filter === 'season' ? g.season : !g.season));
  const open = GL.open && GAMES.find(g => g.id === GL.open);
  const rows = list.map(g => { const [a, h] = g.teams;
    return `<tr class="${GL.open === g.id ? 'gl-on' : ''}"><td class="nowrap sub">${new Date(g.at).toLocaleDateString()}</td>
      <td><b style="color:${a.color}">${esc(a.short)}</b> ${a.R} <span class="sub">at</span> <b style="color:${h.color}">${esc(h.short)}</b> ${h.R}${g.walkoff ? ' <span class="sub">walk-off</span>' : ''}</td>
      <td class="sub">${MODE_TXT[g.mode] || g.mode}${g.season ? ` · game ${g.season.n}` : ''}</td>
      <td><button class="buy" data-gl="open" data-a="${g.id}">${GL.open === g.id ? 'Showing' : 'Play-by-play'}</button></td></tr>`; }).join('');
  return `<h3 style="margin-top:26px" id="gl-games">Game logs</h3>
    <p class="sub" style="margin-top:0">The full play-by-play of your last ${GAMES_MAX} finished games, every mode. Saved in this browser.</p>
    ${open ? gameViewer(open) : ''}
    <div class="rv-row" style="margin:8px 0">${[['all', 'All games'], ['season', 'Season games'], ['exh', 'Exhibition games']].map(([v, l]) => `<button class="rchip ${GL.filter === v ? 'on' : ''}" data-gl="filter" data-a="${v}">${l}</button>`).join('')}</div>
    ${rows ? `<div class="tablewrap"><table class="cat gl-table"><thead><tr><th>Date</th><th>Game</th><th>Mode</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p style="margin-top:10px"><button class="ghost" data-gl="clear">${GL.confirm ? 'Click again to clear every game log' : 'Clear game logs'}</button></p>`
      : '<div class="card"><p class="sub">No finished games yet. Play one to the final out and its play-by-play lands here.</p></div>'}`;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-gl]'); if (!b) return;
  const a = b.dataset.gl;
  if (a === 'jump') { e.preventDefault(); const h = document.getElementById('gl-games'); if (h) h.scrollIntoView({ behavior: 'smooth' }); return; }
  if (a === 'open') { GL.open = b.dataset.a; renderRecords(); const v = document.getElementById('gl-view'); if (v) v.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if (a === 'close') { GL.open = null; renderRecords(); }
  else if (a === 'filter') { GL.filter = b.dataset.a; renderRecords(); }
  else if (a === 'clear') {
    if (!GL.confirm) { GL.confirm = true; renderRecords(); setTimeout(() => { GL.confirm = false; if (PAGE === 'records') renderRecords(); }, 3500); return; }
    GL.confirm = false; GAMES = []; GL.open = null; saveGames(); renderRecords();
  }
});

/* ---------- between games: wipe the last game off the Play page ---------- */
function clearGameUI() {
  G.teams = null; G.P = null; PL = null; G.rules = null; G.run = null;
  G.log = []; G.full = []; G.lastPitch = null; G.abPitches = []; G.abTags = [];
  G.bases = [null, null, null, null]; G.zones = []; G.fx = []; G.rolls = []; G.banner = null; G.tutorial = null; G.shake = 0;
  const ls = document.getElementById('lineScore'); if (ls) ls.innerHTML = '';
  renderLog(); if (typeof renderReadout === 'function') renderReadout();
  try { renderSetupRules(); } catch (e) { }
}
try { if (PAGE === 'records') renderRecords(); } catch (e) { }

/* phones: label table cells with their column heading, so reference tables can stack into cards */
function labelTables(root) {
  (root || document).querySelectorAll('table.cat:not([data-labelled]), table.keys:not([data-labelled])').forEach(t => {
    const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!heads.length) return; t.dataset.labelled = '1';
    t.querySelectorAll('tbody tr').forEach(tr => { let i = 0; for (const c of tr.children) { const span = +(c.getAttribute('colspan') || 1); if (c.tagName === 'TD' && heads[i]) c.dataset.l = heads[i]; i += span; } });
  });
}
labelTables();
try { new MutationObserver(() => labelTables()).observe(document.body, { childList: true, subtree: true }); } catch (e) { }
