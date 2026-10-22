/* w16: player stats. A Stats tab on the Team screen: every player's numbers for this journey (games, wins, cards,
   damage, Block, kills, points, player of the game, best single game) or for their whole career, with a page per
   player showing their record by sport and their last few games. Loads after w15-camp.js; changes earlier parts
   only by reassignment (saved originals carry the wW16 prefix).

   Sudden Death credits a match's numbers by creature kind (B.ps[kind]), and only one player of each kind starts,
   so at the final whistle each starter's kind is their player. The game record gets `wp` ({ kind: player id }) so
   the per-player game log survives roster changes.

   WG.pstats  { pid: { g, w, c, d, b, k, p, mvp, best, sp: { sport: { g, w, p } } } }, this journey only. Players
              who are released keep their line (a later tournament may want it). Built from RUN.games the first
              time an older save needs it.
   wStatsOf(pid)  that player's journey line (a blank one if they have not played)
   Wrapped: logGame (tally each match), wOpenCamp (the Stats tab), wRenderCamp (the tab, and a Stats button on each
   lineup row), renderHelp (a paragraph in #wHelpTeam). */

const W_STATS = { recent: 5 };
const W_STAT_COLS = [['g', 'G', 'Games started'], ['w', 'W', 'Wins'], ['c', 'Cards', 'Cards played'], ['d', 'Dmg', 'Damage'], ['b', 'Blk', 'Block'],
  ['k', 'KO', 'Kills'], ['p', 'Pts', 'Points scored'], ['mvp', 'MVP', 'Player of the game'], ['best', 'Best', 'Most damage in one game']];
const WSTAT = { view: 'journey', sort: null, pid: null };

function wBlankStats() { return { g: 0, w: 0, c: 0, d: 0, b: 0, k: 0, p: 0, mvp: 0, best: 0, sp: {} }; }
function wStatsOf(pid) { wEnsureStats(); return (WG && WG.pstats && WG.pstats[pid]) || wBlankStats(); }
/* fold one game into its starters' lines */
function wTallyGame(g, starters) {
  const ps = g.ps || {};
  g.wp = g.wp || {};
  for (const p of starters) {
    if (!p) continue;
    const t = ps[p.kind] || {}, L = WG.pstats[p.id] = WG.pstats[p.id] || wBlankStats();
    g.wp[p.kind] = p.id;
    L.g++; if (!g.fell) L.w++;
    for (const s of Object.keys(STAT_KEYS)) L[s] += t[s] || 0;
    if (g.mvp === p.kind) L.mvp++;
    L.best = Math.max(L.best, t.d || 0);
    const sp = L.sp[g.sport] = L.sp[g.sport] || { g: 0, w: 0, p: 0 };
    sp.g++; if (!g.fell) sp.w++; sp.p += t.p || 0;
  }
}
/* rebuild the lines from the games: a tagged game knows who started; a game from before tagging is credited to the
   first player of each kind with numbers in it (a starter who did nothing in it is missed) */
function wEnsureStats() {
  if (!WG || WG.pstats) return;
  WG.pstats = {};
  for (const g of (RUN && RUN.games) || []) {
    const starters = g.wp ? Object.values(g.wp).map(wPlayer).filter(Boolean)
      : Object.keys(g.ps || {}).filter(k => k !== 'line').map(k => wRoster().find(p => p.kind === k)).filter(Boolean);
    wTallyGame(g, starters);
  }
}
const wW16LogGame = logGame;
logGame = function (fell) {
  if (!WG || !RUN) return wW16LogGame(fell);
  wEnsureStats();
  const n0 = (RUN.games || []).length;
  wW16LogGame(fell);
  if ((RUN.games || []).length > n0) wTallyGame(RUN.games[RUN.games.length - 1], wStarters());
};

/* ---------- the Stats tab ---------- */
function wStatLine(p) {
  if (WSTAT.view === 'career') { const c = wCareer(p); return c ? { g: c.games, w: null, c: c.c, d: c.d, b: c.b, k: c.k, p: c.p, mvp: c.mvp, best: c.best } : { ...wBlankStats(), w: null }; }
  return wStatsOf(p.id);
}
function wSportName(id) { return (SPORTS[id] && SPORTS[id].n) || wCap(id || 'unknown'); }
function wCampStats() {
  const rows = wRoster().map((p, i) => ({ p, i, L: wStatLine(p) }));
  const k = WSTAT.sort;
  if (k) rows.sort((a, b) => ((b.L[k] || 0) - (a.L[k] || 0)) || a.i - b.i);
  const num = v => v == null ? '<span class="dim">&ndash;</span>' : v;
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th>` + W_STAT_COLS.map(([c, short, long]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(long)}" aria-pressed="${k === c}">${short}</button></th>`).join('');
  const body = rows.map(({ p, i, L }) => `<tr data-wsp="${p.id}" class="${i < W_PARTY.starters ? 'wst' : ''}${WSTAT.pid === p.id ? ' wsel' : ''}">
    <th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}, Lv ${p.lvl}</small></span></button></th>
    ${W_STAT_COLS.map(([c]) => `<td>${num(L[c])}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return `<div class="row wstview"><div class="filters" role="group" aria-label="Which numbers" style="margin:0">
      <button data-wsview="journey" aria-pressed="${WSTAT.view === 'journey'}">This journey</button><button data-wsview="career" aria-pressed="${WSTAT.view === 'career'}">Career</button></div>
      <small class="hint">${WSTAT.view === 'career' ? 'Every game they have played for this club, on any journey.' : 'Matches they started on this journey. Benched players do not add to their numbers.'} Pick a heading to sort, a player to see more.</small></div>
    <div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    ${sel ? wStatsCard(sel) : ''}`;
}
/* one player: their record by sport and their last few games */
function wStatsCard(p) {
  const L = wStatsOf(p.id), car = wCareer(p);
  const sports = Object.entries(L.sp).sort((a, b) => b[1].g - a[1].g);
  const games = ((RUN && RUN.games) || []).filter(g => g.wp && g.wp[p.kind] === p.id).slice(-W_STATS.recent).reverse();
  const pct = L.g ? Math.round(100 * L.w / L.g) : 0;
  return `<section class="wstcard" aria-label="${esc(p.n)}'s stats"><div class="wsthd"><img src="${wPlayerPort(p, 96)}" alt=""><div><h4>${esc(p.n)} <small>${esc(wKindName(p.kind))}, #${p.num}, level ${p.lvl}</small></h4>
      <p>${L.g ? `This journey: ${L.w}&ndash;${L.g - L.w} in matches they started (${pct}%), ${L.d} damage, ${L.p} point${L.p === 1 ? '' : 's'}, player of the game ${L.mvp} time${L.mvp === 1 ? '' : 's'}.` : 'Has not started a match on this journey yet.'}
      ${car && car.games ? ` Career: ${car.games} game${car.games === 1 ? '' : 's'}${car.cups ? `, ${car.cups} cup${car.cups === 1 ? '' : 's'}` : ''}, ${car.d} damage, best game ${car.best}.` : ''}</p></div>
      <button class="ghost" data-wsp-close aria-label="Close ${esc(p.n)}'s stats">Close</button></div>
    <div class="wstgrid"><div><h5>By sport</h5>${sports.length ? `<table class="wstsp"><tbody>${sports.map(([s, o]) => `<tr><td>${esc(wSportName(s))}</td><td class="wnum">${o.w}&ndash;${o.g - o.w}</td><td class="dim">${o.p} pt${o.p === 1 ? '' : 's'}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">No games yet.</p>'}</div>
      <div><h5>Last games</h5>${games.length ? `<ol class="wstlog">${games.map(g => { const t = (g.ps || {})[p.kind] || {};
        return `<li><b class="${g.fell ? 'wbad' : 'wgood'}">${g.fell ? 'Lost' : 'Won'}</b> ${esc(wSportName(g.sport))}: ${esc(gameScore(g))}<small>${t.d || 0} damage, ${t.b || 0} Block, ${t.p || 0} point${t.p === 1 ? '' : 's'}${g.mvp === p.kind ? ', player of the game' : ''}</small></li>`; }).join('')}</ol>` : '<p class="hint">No games yet.</p>'}</div></div>
  </section>`;
}

const wW16OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  if (want === 'stats') WCAMP.tab = 'team'; // the Stats tab does not exist until the original has built the header
  wW16OpenCamp(want === 'stats' ? undefined : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="stats"]')) return;
  const deck = tabs.querySelector('[data-ctab="deck"]');
  (deck || tabs.lastElementChild).insertAdjacentHTML('afterend', '<button role="tab" data-ctab="stats">Stats</button>');
  tabs.querySelector('[data-ctab="stats"]').onclick = () => { WCAMP.tab = 'stats'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'stats') { WCAMP.tab = 'stats'; wRenderCamp(); }
};
/* open the Stats tab on one player */
function wOpenStats(pid) { WSTAT.pid = pid == null ? null : pid; if ($('modal').hidden || !$('wCampBody')) wOpenCamp('stats'); else { WCAMP.tab = 'stats'; wRenderCamp(); } }

const wW16RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'stats') {
    wW16RenderCamp();
    // a Stats button on each lineup row
    const body = $('wCampBody');
    if (WCAMP.tab === 'team' && body) body.querySelectorAll('li[data-pid] .wpa').forEach(pa => {
      if (pa.querySelector('[data-pstats]')) return;
      const pid = +pa.closest('[data-pid]').dataset.pid, rel = pa.querySelector('[data-rel]');
      const b = document.createElement('button'); b.className = 'ghost'; b.dataset.pstats = ''; b.textContent = 'Stats';
      b.setAttribute('aria-label', `${(wPlayer(pid) || {}).n || 'Player'}'s stats`);
      b.onclick = () => wOpenStats(pid);
      pa.insertBefore(b, rel);
    });
    return;
  }
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="stats"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'stats'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  if (WSTAT.pid != null && !wPlayer(WSTAT.pid)) WSTAT.pid = null;
  const games = ((RUN && RUN.games) || []).length, won = ((RUN && RUN.games) || []).filter(g => !g.fell).length;
  body.innerHTML = `<div class="wcsum"><span>Matches <b>${games}</b></span><span>Record <b>${won}&ndash;${games - won}</b></span><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span></div>` + wCampStats();
  body.querySelectorAll('[data-wsview]').forEach(b => b.onclick = () => { WSTAT.view = b.dataset.wsview; wRenderCamp(); });
  body.querySelectorAll('[data-wsort]').forEach(b => b.onclick = () => { WSTAT.sort = b.dataset.wsort || null; wRenderCamp(); });
  body.querySelectorAll('[data-wsp-open]').forEach(b => b.onclick = () => { const pid = +b.closest('[data-wsp]').dataset.wsp; WSTAT.pid = WSTAT.pid === pid ? null : pid; wRenderCamp(); });
  const x = body.querySelector('[data-wsp-close]'); if (x) x.onclick = () => { WSTAT.pid = null; wRenderCamp(); };
};

const wW16RenderHelp = renderHelp;
renderHelp = function () {
  wW16RenderHelp();
  const team = $('wHelpTeam'); if (!team || $('wHelpStats')) return;
  team.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpStats"><b>Stats.</b> The Stats tab on the Team screen keeps every player's numbers: games started, wins, cards played, damage, Block, kills, points and player of the game, for this journey or their whole career. Pick a player for their record in each sport and their last few games. Only starters add to their numbers.</p>`);
};
