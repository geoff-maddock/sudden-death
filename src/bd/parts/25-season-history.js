/* ================= season history: every run, game by game ================= */
// Finished runs live in HIST (newest first), saved in this browser and, when available, the claude.ai cloud store.
let HIST = [];
const HIST_MAX = 40;
let HIST_OPEN = {}, HIST_CONFIRM = null;
try { HIST = JSON.parse(localStorage.getItem('bd-history') || '[]') || []; } catch (e) { HIST = []; }
function saveHistory(cloud = true) {
  HIST = HIST.slice(0, HIST_MAX);
  try { localStorage.setItem('bd-history', JSON.stringify(HIST)); } catch (e) { }
  if (cloud && Cloud.ready) { Cloud.db.doc(`data/users/${Cloud.uid}/history`).set({ runs: HIST, savedAt: Date.now() }).catch(() => { }); }
}
async function historyCloudSync() {
  if (!Cloud.ready) return;
  try {
    const snap = await Cloud.db.doc(`data/users/${Cloud.uid}/history`).get();
    const cloud = snap.exists && snap.data() && Array.isArray(snap.data().runs) ? snap.data().runs : [];
    const byId = new Map(); for (const r of [...cloud, ...HIST]) if (r && r.id && !byId.has(r.id)) byId.set(r.id, r);
    HIST = [...byId.values()].sort((a, b) => (b.ended || 0) - (a.ended || 0));
    saveHistory(cloud.length !== HIST.length);
    if (PAGE === 'records') renderRecords();
  } catch (e) { }
}
function ensureHist() {
  if (!S) return null;
  if (!S.runId) S.runId = 'run' + uid();
  if (!S.startedAt) S.startedAt = Date.now();
  if (!S.hist) S.hist = { games: [], stats: {}, ults: 0, hurt: 0, kos: 0, gold: 0 };
  return S.hist;
}
// after each season game: the result, who starred, what happened
function recordSeasonGame(me, them, o, won, gold, ess, lines) {
  const H = ensureHist(); if (!H) return;
  const mine = new Set([...me.def.roster, ...me.used].map(g => g.n));
  const tagsOf = k => G.log.flatMap(l => (l.tags || []).filter(t => t.k === k).map(t => t.t));
  const myUlts = tagsOf('ult').filter(t => mine.has(t.split(':')[0]) || [...mine].some(n => n.endsWith(t.split(':')[0])));
  const hurtLines = G.log.filter(l => /is hurt:|knocked out/.test(l.text));
  const myHurt = hurtLines.filter(l => [...mine].some(n => l.text.startsWith(n))).length;
  const kos = G.log.filter(l => /is knocked out/.test(l.text) && [...mine].some(n => l.text.startsWith(n))).length;
  const highlights = G.log.filter(l => l.big && !/^End of|Final:|\. \d+ innings\./.test(l.text)).slice(0, 4).reverse().map(l => l.text);
  const top = lines.slice().sort((a, b) => b.xp - a.xp)[0];
  H.games.push({
    n: S.game + 1, opp: o.name, oppColor: o.color, final: !!o.final, home: S.game % 2 === 1, me: me.R, them: them.R, won, gold, ess,
    mvp: top ? { n: top.n, line: top.bits } : null, highlights, ults: myUlts, hurt: myHurt, at: Date.now(), gid: G.gameId || null,
  });
  H.ults += myUlts.length; H.hurt += myHurt; H.kos += kos; H.gold += gold;
  // career numbers for this run, by player
  for (const sp of S.players) {
    const g = [...me.def.roster, ...me.used].find(x => x.src && x.src.id === sp.id); if (!g) continue;
    const st = G.pstats.get(g) || { h: 0, hr: 0, r: 0, k: 0, outs: 0 };
    const s = H.stats[sp.id] || (H.stats[sp.id] = { n: sp.n, race: sp.race, g: 0, h: 0, hr: 0, r: 0, k: 0, outs: 0 });
    s.n = sp.n; s.g++; s.h += st.h; s.hr += st.hr; s.r += st.r; s.k += st.k; s.outs += st.outs;
  }
}
// when a run ends (won the Cup, out of lives, or abandoned) it goes into the record book
function archiveRun(result) {
  const H = ensureHist(); if (!H) return;
  if (HIST.some(r => r.id === S.runId)) return;
  const stats = Object.entries(H.stats).map(([id, s]) => { const sp = S.players.find(p => p.id === id); return { ...s, lvl: sp ? sp.lvl : null, gone: !sp }; });
  HIST.unshift({
    id: S.runId, cpu: !!S.cpu, club: S.club.name, short: S.club.short, color: S.club.color, teamId: S.teamId, started: S.startedAt, ended: Date.now(), result,
    wins: S.wins, losses: S.losses, reached: S.game + 1, innings: S.innings, games: H.games, stats, ults: H.ults, hurt: H.hurt, kos: H.kos, gold: H.gold,
    lineup: S.lineup.map(l => { const p = S.players.find(x => x.id === l.id); return p ? { n: p.n, race: p.race, pos: l.pos, lvl: p.lvl } : null; }).filter(Boolean),
  });
  saveHistory();
}

/* ---------- the Records page ---------- */
const RESULT_TXT = { champion: 'Champions', out: 'Eliminated', abandoned: 'Abandoned', live: 'In progress' };
function runView(r) { // the same shape for the live run and archived ones
  const cls = r.result === 'champion' ? 'res-champ' : r.result === 'live' ? 'res-live' : r.result === 'out' ? 'res-out' : 'res-aband';
  const dates = `${new Date(r.started || Date.now()).toLocaleDateString()}${r.ended ? ' – ' + new Date(r.ended).toLocaleDateString() : ''}`;
  const chips = (r.games || []).map(g => `<span class="gchip ${g.won ? 'w' : 'l'}" title="Game ${g.n}: ${esc(g.opp)} ${g.me}-${g.them}">${g.won ? 'W' : 'L'} ${g.me}-${g.them}</span>`).join('') || '<span class="sub">No games played yet</span>';
  const leaders = (r.stats || []).slice().sort((a, b) => (b.hr * 4 + b.h * 2 + b.r + b.k * 2 + b.outs * .5) - (a.hr * 4 + a.h * 2 + a.r + a.k * 2 + a.outs * .5));
  const star = leaders[0];
  const open = HIST_OPEN[r.id] ? ' open' : '';
  const gameRows = (r.games || []).map(g => `<tr><td class="ord">${g.n}</td><td><b style="color:${g.oppColor || 'inherit'}">${esc(g.opp)}</b>${g.final ? ' <span class="sub">(final)</span>' : ''}<div class="sub">${g.home ? 'home' : 'away'}</div></td>
    <td class="nowrap"><b class="${g.won ? 'wtxt' : 'ltxt'}">${g.won ? 'W' : 'L'}</b> ${g.me}–${g.them}${g.gid && GAMES && GAMES.some(x => x.id === g.gid) ? `<div><button class="buy" data-gl="open" data-a="${g.gid}" style="font-size:15px;padding:2px 7px">Play-by-play</button></div>` : ''}</td>
    <td>${g.mvp ? `<b>${esc(g.mvp.n)}</b>${g.mvp.line ? `<div class="sub">${esc(g.mvp.line)}</div>` : ''}` : '—'}</td>
    <td class="sub">${(g.highlights || []).map(esc).join('<br>') || '—'}${g.ults && g.ults.length ? `<div class="tags">${g.ults.map(t => `<i class="tg tg-ult">${esc(t)}</i>`).join('')}</div>` : ''}${g.hurt ? `<div class="warnt">${g.hurt} injur${g.hurt === 1 ? 'y' : 'ies'}</div>` : ''}</td></tr>`).join('');
  const statRows = leaders.map(s => `<tr><td><b>${esc(s.n)}</b>${s.gone ? ' <span class="sub">(traded/released)</span>' : ''}<div class="sub">${esc(s.race || '')}${s.lvl ? ' · Lv ' + s.lvl : ''}</div></td><td>${s.g}</td><td>${s.h}</td><td>${s.hr}</td><td>${s.r}</td><td>${s.k}</td><td>${s.outs}</td></tr>`).join('');
  return `<article class="card runcard ${cls}">
    <header class="runhead"><div><h3 style="color:${r.color || 'var(--torch)'}">${esc(r.club)}</h3><div class="sub">${dates}${r.innings ? ` · ${r.innings}-inning games` : ''}</div></div>
      <div class="runres">${r.cpu ? '<span class="resbadge">CPU managed</span>' : ''}<span class="resbadge">${RESULT_TXT[r.result] || r.result}${r.result === 'out' ? ` in game ${r.reached}` : ''}</span><b class="rec">${r.wins}–${r.losses}</b></div></header>
    <div class="gchips">${chips}</div>
    <p class="sub">${star ? `Star: <b>${esc(star.n)}</b> (${star.h} H, ${star.hr} HR, ${star.r} R${star.k ? `, ${star.k} K` : ''}) · ` : ''}${r.gold || 0} gold earned · ${r.ults || 0} ultimates · ${r.hurt || 0} injuries${r.kos ? ` · ${r.kos} knockouts` : ''}</p>
    <details class="rundet" data-run="${r.id}"${open}><summary>Game by game and player stats</summary>
      ${gameRows ? `<div class="tablewrap"><table class="cat"><thead><tr><th>#</th><th>Opponent</th><th>Result</th><th>Star of the game</th><th>Highlights</th></tr></thead><tbody>${gameRows}</tbody></table></div>` : ''}
      ${statRows ? `<h4>Players</h4><div class="tablewrap"><table class="cat"><thead><tr><th>Player</th><th>G</th><th>H</th><th>HR</th><th>R</th><th>K</th><th>Outs</th></tr></thead><tbody>${statRows}</tbody></table></div>` : ''}
      ${r.lineup && r.lineup.length ? `<p class="sub">Final lineup: ${r.lineup.map(p => `${esc(p.n)} (${p.pos}${p.lvl ? ', Lv ' + p.lvl : ''})`).join(' · ')}</p>` : ''}
      ${r.result !== 'live' ? `<p><button class="buy" data-hist="del" data-a="${r.id}">${HIST_CONFIRM === r.id ? 'Click again to delete this record' : 'Delete this record'}</button></p>` : ''}
    </details>
  </article>`;
}
function renderRecords() {
  const el = document.getElementById('records'); if (!el) return;
  const live = S && S.active && S.hist && S.hist.games.length ? { id: S.runId || 'live', cpu: !!S.cpu, club: S.club.name, color: S.club.color, started: S.startedAt, result: 'live', wins: S.wins, losses: S.losses, reached: S.game + 1, innings: S.innings, games: S.hist.games, stats: Object.entries(S.hist.stats).map(([id, s]) => ({ ...s, lvl: (S.players.find(p => p.id === id) || {}).lvl })), ults: S.hist.ults, hurt: S.hist.hurt, kos: S.hist.kos, gold: S.hist.gold } : null;
  const runs = HIST;
  const games = runs.reduce((a, r) => a + r.wins + r.losses, 0), wins = runs.reduce((a, r) => a + r.wins, 0);
  const cups = runs.filter(r => r.result === 'champion').length;
  const best = runs.slice().sort((a, b) => (b.result === 'champion') - (a.result === 'champion') || b.wins - a.wins || a.losses - b.losses)[0];
  // all-time leaders across every archived run
  const all = runs.flatMap(r => (r.stats || []).map(s => ({ ...s, club: r.club })));
  const lead = (k, lbl) => { const t = all.slice().sort((a, b) => b[k] - a[k])[0]; return t && t[k] ? `<div class="chip"><em>${lbl}</em>${t[k]} <span class="sub">${esc(t.n)}</span></div>` : ''; };
  el.innerHTML = `
    <h2 class="pgh">Records</h2>
    <p class="sub" style="margin:0 0 6px"><a href="#stats" data-page="stats">Player stats: seasons and careers →</a></p>
    <p class="lede2">Every season run you've played: how it ended, game by game, and who carried the club. Below them, the full play-by-play of your recent games in every mode (<a href="#records" data-gl="jump">jump to game logs</a>). Runs are saved in this browser${Cloud.ready ? ' and your claude.ai account' : ''}.</p>
    <div class="chips" style="margin-bottom:18px">
      <div class="chip"><em>Runs</em>${runs.length}</div>
      <div class="chip gold"><em>Cups</em>${cups}</div>
      <div class="chip"><em>All-time</em>${wins}–${games - wins}</div>
      <div class="chip"><em>Win rate</em>${games ? Math.round(wins / games * 100) + '%' : '—'}</div>
      ${best ? `<div class="chip"><em>Best run</em>${best.wins}–${best.losses} <span class="sub">${esc(best.club)}</span></div>` : ''}
      ${lead('hr', 'Most HR in a run')}${lead('h', 'Most hits in a run')}${lead('k', 'Most K in a run')}
    </div>
    ${typeof leagueTable === 'function' && LEAGUES ? leagueTable() : ''}
    ${live ? `<h3 style="margin-top:22px">Current run</h3>${runView(live)}` : ''}
    ${runs.length ? `<h3 style="margin-top:22px">Past runs</h3>${runs.map(runView).join('')}` : `<div class="card"><p class="sub">No finished runs yet. Start a season from the Play page (Mode: Season). When a run ends, by winning the Brimstone Cup, running out of lives or abandoning it, it's recorded here.</p></div>`}
    ${runs.length ? `<p style="margin-top:14px"><button class="ghost" data-hist="clear">${HIST_CONFIRM === 'all' ? 'Click again to clear all records' : 'Clear all records'}</button></p>` : ''}
    ${typeof gamesSection === 'function' && GAMES ? gamesSection() : ''}`;
}
document.addEventListener('toggle', e => { const d = e.target; if (d && d.classList && d.classList.contains('rundet')) HIST_OPEN[d.dataset.run] = d.open; }, true);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-hist]'); if (!b) return;
  const act = b.dataset.hist, key = act === 'clear' ? 'all' : b.dataset.a;
  if (HIST_CONFIRM !== key) { HIST_CONFIRM = key; renderRecords(); setTimeout(() => { if (HIST_CONFIRM === key) { HIST_CONFIRM = null; renderRecords(); } }, 3500); return; }
  HIST_CONFIRM = null;
  if (act === 'clear') HIST = []; else HIST = HIST.filter(r => r.id !== key);
  saveHistory(); renderRecords();
});
renderRecords();
