/* ================= page UI ================= */
function logLine(text, big, tags) {
  const tag = G.teams ? `${G.half ? 'B' : 'T'}${G.inning}` : '';
  const ent = tags ? { tag, text, big, tags } : { tag, text, big };
  G.log.unshift(ent); if (G.log.length > 80) G.log.pop(); (G.full || (G.full = [])).push(ent); renderLog();
}
const TAG_ICON = { gear: '⚒', ult: '', hurt: '✚', magic: '◆', club: '✦', skill: '⚡', hustle: '▲', rollok: 'd20', rollbad: 'd20' };
const tagChip = g => `<i class="tg tg-${g.k}">${TAG_ICON[g.k] || ''} ${esc(g.t)}${g.k === 'rollok' ? ' ✓' : g.k === 'rollbad' ? ' ✗' : ''}${g.n > 1 ? ` ×${g.n}` : ''}</i>`;
function esc(s) { return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
function renderLog() {
  const el = document.getElementById('log');
  { const m = document.getElementById('pbpMain'); if (m) m.hidden = !G.teams; } // only while a game is on (or just ended)
  if (!G.log.length) { el.innerHTML = '<li class="empty">No game in progress. Set one up above. The play-by-play of past games is on the <a href="#records" data-page="records">Records</a> page.</li>'; return; }
  el.innerHTML = G.log.map(l => `<li class="${l.big ? 'big' : ''}"><b>${esc(l.tag)}</b><span>${esc(l.text)}${l.tags ? `<span class="tags">${l.tags.map(tagChip).join('')}</span>` : ''}</span></li>`).join('');
}
function lineScoreHTML() {
  if (!G.teams) return '';
  const n = Math.max(G.innings, G.inning);
  let h = '<table class="ls"><thead><tr><th></th>';
  for (let i = 1; i <= n; i++) h += `<th>${i}</th>`;
  h += '<th>R</th><th>H</th></tr></thead><tbody>';
  for (const t of G.teams) { h += `<tr><td style="color:${t.def.color}">${esc(t.def.short)}</td>`; for (let i = 0; i < n; i++) h += `<td>${t.line[i] ?? ''}</td>`; h += `<td>${t.R}</td><td>${t.H}</td></tr>`; }
  return h + '</tbody></table>';
}
function renderLineScore() { document.getElementById('lineScore').innerHTML = lineScoreHTML(); }
const PORT_CACHE = {};
function portraitURL(p, t) {
  const k = t.id + p.n + p.kind + p.num; if (PORT_CACHE[k]) return PORT_CACHE[k];
  const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 192; const c2 = cv2.getContext('2d');
  try { drawPortrait(c2, p, t, 0, 0, 192); PORT_CACHE[k] = cv2.toDataURL('image/png'); } catch (e) { PORT_CACHE[k] = ''; }
  return PORT_CACHE[k];
}
// Rosters page: pick a club (or all), filter by position, creature or name, sort, and switch between cards and a compact table
const RV = { club: 'ironmaw', pos: 'all', kind: 'all', q: '', sort: 'order', view: 'cards' };
try { Object.assign(RV, JSON.parse(localStorage.getItem('bd-roster-view') || '{}')); RV.q = ''; } catch (e) { }
let RV_SIG = '';
function rosterClubs() {
  const out = [...Object.values(TEAMS), ...(typeof CUSTOM !== 'undefined' && CUSTOM ? CUSTOM : [])].map(t => ({ id: t.id, name: t.name, color: t.color, t, players: t.roster }));
  try { if (typeof S !== 'undefined' && S && S.players) out.push({ id: 'season', name: `${S.club.name} (season)`, color: S.club.color, t: S.club, season: true, players: S.lineup.map(l => ({ ...S.players.find(p => p.id === l.id), pos: l.pos })).concat(S.bench.map(id => ({ ...S.players.find(p => p.id === id), bench: true }))) }); } catch (e) { }
  return out;
}
const ROSTER_SORTS = { order: 'Batting order', name: 'Name', pos: 'Position', total: 'Total stats', pow: 'POW', con: 'CON', spd: 'SPD', arm: 'ARM', fld: 'FLD', avg: 'Career AVG', hr: 'Career HR', k: 'Career strikeouts (P)' };
const POS_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P', 'RP'];
function careerOf(p) { try { const ck = (p.ck || (p.src && p.src.ck)); const e = ck && CAREER && CAREER[ck]; return e ? totalOf(e) : null; } catch (e) { return null; } }
function renderRosterControls(clubs) {
  const el = document.getElementById('rosterCtl'); if (!el) return;
  const chip = (k, v, lbl, col) => `<button class="rchip${RV[k] === v ? ' on' : ''}" data-rv="${k}" data-v="${esc(v)}"${col ? ` style="border-bottom:3px solid ${col}"` : ''}>${lbl}</button>`;
  el.innerHTML = `
    <div class="rv-row"><span class="rv-lbl">Club</span>${chip('club', 'all', 'All clubs')}${clubs.map(c => chip('club', c.id, esc(c.name) + (c.t && c.t.custom ? ' ★' : ''), c.color)).join('')}</div>
    <div class="rv-row"><span class="rv-lbl">Position</span>${chip('pos', 'all', 'All')}${chip('pos', 'bat', 'Fielders')}${chip('pos', 'P', 'Pitchers')}${['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map(p => chip('pos', p, p)).join('')}</div>
    <div class="rv-row rv-tools">
      <label>Creature<select data-rv-sel="kind"><option value="all">All creatures</option>${Object.keys(KIND).map(k => `<option value="${k}" ${RV.kind === k ? 'selected' : ''}>${esc(kindRace(k))}</option>`).join('')}</select></label>
      <label>Sort<select data-rv-sel="sort">${Object.entries(ROSTER_SORTS).map(([k, l]) => `<option value="${k}" ${RV.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="rv-search">Search<input type="search" data-rv-q placeholder="Name, creature or power" value="${esc(RV.q)}"></label>
      <span class="rv-view">${chip('view', 'cards', 'Cards')}${chip('view', 'table', 'Table')}</span>
    </div>`;
}
function kindRace(k) { for (const t of Object.values(TEAMS)) for (const p of t.roster) if (p.kind === k) return p.race; return k; }
function rosterMatches(p) {
  if (RV.pos === 'P' && p.pos !== 'P' && p.pos !== 'RP') return false;
  if (RV.pos === 'bat' && (p.pos === 'P' || p.pos === 'RP')) return false;
  if (!['all', 'bat', 'P'].includes(RV.pos) && p.pos !== RV.pos) return false;
  if (RV.kind !== 'all' && p.kind !== RV.kind) return false;
  if (RV.q) {
    const q = RV.q.toLowerCase(), hay = [p.n, p.race, p.kind, p.pos, ...[p.bat, p.run, p.field, p.ult].filter(Boolean).map(id => AB[id] ? AB[id].name : id), ...(p.pitches || []).map(k => PITCHES[k] ? PITCHES[k].name : k)].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function rosterSortVal(p, k) {
  if (['pow', 'con', 'spd', 'arm', 'fld'].includes(k)) return p[k];
  if (k === 'total') return p.pow + p.con + p.spd + p.arm + p.fld;
  const L = careerOf(p);
  if (k === 'avg') return L && L.ab ? L.h / L.ab : -1;
  if (k === 'hr') return L ? L.hr : -1;
  if (k === 'k') return L ? L.k : -1;
  return 0;
}
function bestCard(p, t, clubName) {
  const abLine = (id, ty) => { if (!id || !AB[id]) return ''; const A = AB[id]; return `<div class="ab"><span class="ty">${ty}</span><em>${esc(A.name)}</em> ${A.cost ? `<span class="mn">${'◆'.repeat(A.cost)}</span>` : ''} ${esc(A.desc)}</div>`; };
  const blurb = typeof careerBlurb === 'function' ? careerBlurb(p) : '';
  return `<article class="pc">
    <header><img class="por" alt="Portrait of ${esc(p.n)}" src="${portraitURL(p, t)}" width="64" height="64"><div><div class="nm">${esc(p.n)}</div><div class="rc">#${p.num} · ${esc(p.race)} · bats ${p.hand === 'R' ? 'right' : 'left'}${typeof moonTag === 'function' && MOON && moonTag(p) ? ` · ☾ ${moonTag(p)}` : ''}${clubName ? `<br><span style="color:${t.color}">${esc(clubName)}</span>` : ''}${p.bench ? ' · bench' : ''}${p.lvl ? ` · Lv ${p.lvl}` : ''}</div></div><div class="pos">${p.pos}</div></header>
    <div class="stats">${['pow', 'con', 'spd', 'arm', 'fld'].map(s => `<div class="${p[s] <= 3 ? 'weak' : ''}"${p[s] <= 3 ? ` title="${esc(WEAK_TXT[s])}"` : ''}><b>${p[s]}</b>${s.toUpperCase()}</div>`).join('')}</div>
    ${['pow', 'con', 'spd', 'arm', 'fld'].filter(s => p[s] <= 3).map(s => `<div class="ab weaktxt"><span class="ty">WEAK ${s.toUpperCase()}</span> ${esc(WEAK_TXT[s])}</div>`).join('')}
    ${abLine(p.ult, 'ULT')}${abLine(p.bat, 'BAT')}${abLine(p.run, 'RUN')}${abLine(p.field, 'FIELD')}${['bat', 'run', 'field'].map(k => { const id = physOf(p, k); return id ? `<div class="ab"><span class="ty">SKILL</span><em>${esc(AB[id].name)}</em> <span class="stm">⚡${AB[id].stam}</span> ${esc(AB[id].desc)}</div>` : ''; }).join('')}
    ${p.pitches ? `<div class="ab"><span class="ty">PITCHES</span>${p.pitches.map(k => { const q = PITCHES[k]; return q ? `<em>${esc(q.name)}</em>${q.cost ? ` <span class="mn">${'◆'.repeat(q.cost)}</span>` : ''}${q.magic ? `: ${esc(q.desc)}` : ''}` : ''; }).join(' · ')}</div>` : ''}
    ${blurb ? `<div class="ab"><span class="ty">CAREER</span> ${blurb}</div>` : ''}
    <p class="fl">${esc(p.flav || '')}</p>
  </article>`;
}
function bestRow(p, t, clubName) {
  const nm = id => id && AB[id] ? esc(AB[id].name) : '—';
  const L = careerOf(p);
  return `<tr><td><img class="por" alt="" src="${portraitURL(p, t)}" width="34" height="34"></td><td><b>${esc(p.n)}</b><div class="sub">${esc(p.race)}</div></td><td><span style="color:${t.color}">${esc(clubName)}</span></td><td>${p.pos}${p.bench ? ' <span class="sub">bench</span>' : ''}</td><td>${p.num}</td><td>${p.hand}</td>
    ${['pow', 'con', 'spd', 'arm', 'fld'].map(s => `<td class="${p[s] <= 3 ? 'weakc' : ''}"${p[s] <= 3 ? ` title="${esc(WEAK_TXT[s])}"` : ''}>${p[s]}</td>`).join('')}
    <td>${nm(p.ult)}</td><td>${nm(p.bat)}</td><td>${nm(p.run)}</td><td>${nm(p.field)}</td><td class="sub">${L && L.g ? `${L.g} G · ${L.ab ? (L.h / L.ab).toFixed(3).replace(/^0/, '') : '—'} · ${L.hr} HR${L.outsP ? ` · ${L.k} K` : ''}` : '—'}</td></tr>`;
}
function renderBestiary() {
  const el = document.getElementById('bestiary'); if (!el) return;
  const clubs = rosterClubs();
  if (RV.club !== 'all' && !clubs.some(c => c.id === RV.club)) RV.club = clubs[0].id;
  const sig = clubs.map(c => c.id + c.name).join('|') + JSON.stringify([RV.club, RV.pos, RV.kind, RV.sort, RV.view]);
  if (sig !== RV_SIG || !document.querySelector('#rosterCtl [data-rv]')) { RV_SIG = sig; renderRosterControls(clubs); }
  const shown = clubs.filter(c => RV.club === 'all' || c.id === RV.club);
  const total = shown.reduce((a, c) => a + c.players.length, 0);
  const groups = shown.map(c => {
    let ps = c.players.filter(rosterMatches);
    if (RV.sort === 'name') ps.sort((a, b) => a.n.localeCompare(b.n));
    else if (RV.sort === 'pos') ps.sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos));
    else if (RV.sort !== 'order') ps.sort((a, b) => rosterSortVal(b, RV.sort) - rosterSortVal(a, RV.sort));
    return { c, ps };
  });
  const count = groups.reduce((a, g) => a + g.ps.length, 0);
  const flat = RV.club === 'all' && RV.sort !== 'order';
  let body = '';
  if (RV.view === 'table') {
    let rows = groups.flatMap(g => g.ps.map(p => ({ p, c: g.c })));
    if (flat) rows.sort((a, b) => RV.sort === 'name' ? a.p.n.localeCompare(b.p.n) : RV.sort === 'pos' ? POS_ORDER.indexOf(a.p.pos) - POS_ORDER.indexOf(b.p.pos) : rosterSortVal(b.p, RV.sort) - rosterSortVal(a.p, RV.sort));
    body = rows.length ? `<div class="tablewrap"><table class="cat rtable"><thead><tr><th></th><th>Player</th><th>Club</th><th>Pos</th><th>#</th><th>B</th><th>POW</th><th>CON</th><th>SPD</th><th>ARM</th><th>FLD</th><th>Ultimate</th><th>Bat</th><th>Run</th><th>Field</th><th>Career</th></tr></thead><tbody>${rows.map(r => bestRow(r.p, r.c.t, r.c.name)).join('')}</tbody></table></div>` : '';
  } else if (flat) {
    let cards = groups.flatMap(g => g.ps.map(p => ({ p, c: g.c })));
    cards.sort((a, b) => RV.sort === 'name' ? a.p.n.localeCompare(b.p.n) : RV.sort === 'pos' ? POS_ORDER.indexOf(a.p.pos) - POS_ORDER.indexOf(b.p.pos) : rosterSortVal(b.p, RV.sort) - rosterSortVal(a.p, RV.sort));
    body = cards.length ? `<div class="cards">${cards.map(x => bestCard(x.p, x.c.t, x.c.name)).join('')}</div>` : '';
  } else {
    body = groups.filter(g => g.ps.length).map(({ c, ps }) => `<div style="margin-bottom:28px">
      <div class="team-h"><h3 style="color:${c.color}">${esc(c.name)} ${typeof clubRating === 'function' && LEAGUES ? lgBadge(clubRating(c.season ? 'club' : c.id), true) : ''}</h3><p>${esc(c.t.motto || '')}${c.t.custom ? ` · <a href="#builder" data-page="builder" data-edit="${c.id}">your team: edit</a>` : ''}${c.season ? ' · <a href="#season" data-page="season">clubhouse</a>' : ''}</p></div>
      <div class="cards">${ps.map(p => bestCard(p, c.t, '')).join('')}</div></div>`).join('');
  }
  el.innerHTML = `<p class="sub rv-count">Showing ${count} of ${total} player${total === 1 ? '' : 's'}${count < total ? ` · <button class="lnk" data-rv-reset>clear filters</button>` : ''}</p>${body || '<div class="card"><p class="sub">No players match these filters.</p></div>'}`;
}
function rvSave() { try { localStorage.setItem('bd-roster-view', JSON.stringify({ ...RV, q: '' })); } catch (e) { } }
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#rosterCtl [data-rv]');
  if (b) { RV[b.dataset.rv] = b.dataset.v; rvSave(); RV_SIG = ''; renderBestiary(); return; }
  if (e.target.closest && e.target.closest('[data-rv-reset]')) { Object.assign(RV, { pos: 'all', kind: 'all', q: '' }); rvSave(); RV_SIG = ''; renderBestiary(); }
});
document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('#rosterCtl [data-rv-sel]'); if (!s) return; RV[s.dataset.rvSel] = s.value; rvSave(); RV_SIG = ''; renderBestiary(); });
document.addEventListener('input', e => { const s = e.target.closest && e.target.closest('#rosterCtl [data-rv-q]'); if (!s) return; RV.q = s.value.trim(); renderBestiary(); });

let PAGE = 'play', autoPaused = false;
function showPage(pg) {
  if (!['play', 'guide', 'rosters', 'season', 'records', 'builder', 'stats', 'settings', 'armory'].includes(pg)) pg = 'play';
  if (pg === 'guide' && typeof renderCreatures === 'function' && MOON) { try { if (!document.querySelector('#creatures .crcard')) renderCreatures(); } catch (e) { } }
  if (pg === 'armory' && typeof renderArmory === 'function') { try { renderArmory(); } catch (e) { } }
  if (pg === 'settings' && typeof renderSettings === 'function') { try { renderSettings(); } catch (e) { } }
  if (pg === 'play') { try { renderSetupRules(); } catch (e) { } }
  if (pg === 'stats' && typeof renderStats === 'function') { try { renderStats(); } catch (e) { } }
  if (pg === 'builder' && typeof renderBuilder === 'function') { try { renderBuilder(); } catch (e) { } }
  if (pg === 'records' && typeof renderRecords === 'function') { try { renderRecords(); } catch (e) { } }
  if (pg === 'season' && typeof renderClub === 'function') { try { renderClub(); } catch (e) { /* save system still loading */ } }
  document.querySelectorAll('.page').forEach(el => { el.hidden = el.id !== 'pg-' + pg; });
  document.querySelectorAll('.tab').forEach(t => { if (t.dataset.page === pg) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  const live = G.phase !== 'menu' && G.phase !== 'over';
  if (pg !== 'play') { if (live && !G.paused) { togglePause(); autoPaused = true; } for (const pl of ['p1', 'p2']) INP[pl].h = {}; }
  else { if (autoPaused && G.paused) togglePause(); autoPaused = false; try { cv.focus({ preventScroll: true }); } catch (e) { } }
  if (PAGE !== pg) window.scrollTo(0, 0);
  PAGE = pg;
}
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('[data-page]'); if (!a) return;
  e.preventDefault(); const pg = a.dataset.page;
  try { history.replaceState(null, '', '#' + pg); } catch (err) { }
  showPage(pg);
});
window.addEventListener('hashchange', () => showPage(location.hash.slice(1)));
// first-time tips for running and fielding (remembered per browser)
// on-field help is opt-in: off unless turned on in Settings or on How to play
// Auto powers: human sides use spells, skills and magic pitches automatically (Settings page, or T mid-game for this game only)
let AUTO = false;
try { AUTO = localStorage.getItem('bd-auto') === 'on'; } catch (e) { }
function setAuto(on) {
  AUTO = !!on;
  const live = G.rules && G.teams && G.phase !== 'menu' && G.phase !== 'over';
  if (live) G.rules.auto = AUTO; // mid-game: this game only
  else try { localStorage.setItem('bd-auto', AUTO ? 'on' : 'off'); if (typeof SET !== 'undefined' && SET) { SET.auto = AUTO; saveSettings(); if (NEXT) NEXT.auto = AUTO; } } catch (e) { }
  try { if (PAGE === 'settings') renderSettings(); } catch (e) { }
  const b = document.getElementById('bAuto'); if (b) { b.textContent = `Auto powers: ${AUTO ? 'on' : 'off'}`; b.setAttribute('aria-pressed', AUTO); }
  if (G.teams && G.phase !== 'menu') addFx('callout', { text: AUTO ? 'Auto powers on (this game)' : 'Auto powers off (this game)', col: '#d6c4ff', small: true });
}
let HINTS = false;
try { HINTS = localStorage.getItem('bd-hints') === 'on'; } catch (e) { }
function setHints(on) {
  const was = HINTS; HINTS = !!on;
  try { localStorage.setItem('bd-hints', HINTS ? 'on' : 'off'); if (HINTS && !was) { localStorage.removeItem('bd-tip-run'); localStorage.removeItem('bd-tip-field'); } } catch (e) { }
  if (!HINTS) G.tutorial = null;
  const b = document.getElementById('bTips'); if (b) b.textContent = `Help: ${HINTS ? 'on' : 'off'}`;
  try { if (PAGE === 'settings') renderSettings(); } catch (e) { }
}
function tutSeen(k) { try { return localStorage.getItem('bd-tip-' + k) === '1'; } catch (e) { return false; } }
function maybeTutorial() {
  if (!HINTS) return;
  const kinds = [];
  if (isHuman(FT()) && !tutSeen('field')) kinds.push('field');
  if (isHuman(BT()) && !tutSeen('run')) kinds.push('run');
  if (!kinds.length) return;
  for (const k of kinds) try { localStorage.setItem('bd-tip-' + k, '1'); } catch (e) { }
  G.tutorial = { kinds };
}
cv.addEventListener('pointerdown', () => { if (G.tutorial) G.tutClick = true; });
function togglePause() { const sq = document.getElementById('bSaveQuit'); if (sq) sq.hidden = !(G.teams && G.phase !== 'menu' && G.phase !== 'over'); G.paused = !G.paused; document.getElementById('pause').hidden = !G.paused; document.getElementById('bPause').textContent = G.paused ? 'Resume' : 'Pause'; }
function showMenu() { G.phase = 'menu'; G.paused = false; PL = null; if (typeof TAKE !== 'undefined') TAKE = null; if (typeof clearGameUI === 'function' && GAMES) clearGameUI(); document.getElementById('pause').hidden = true; document.getElementById('over').hidden = true; document.getElementById('menu').hidden = false; }
// Play ball is a plain button (sandboxed pages may block form submission); Enter in the form does the same
document.getElementById('setup').addEventListener('submit', e => { e.preventDefault(); startFromSetup(); });
document.getElementById('bStart').addEventListener('click', () => startFromSetup());
function startFromSetup(extra) {
  actx();
  const fd = new FormData(document.getElementById('setup'));
  const nr = nextRules(), opts = { mode: fd.get('mode'), team: fd.get('team'), opp: fd.get('opp'), innings: nr.innings, diff: nr.diff, ...(extra || {}) };
  try { localStorage.setItem('bd-setup', JSON.stringify({ mode: opts.mode, team: opts.team, opp: opts.opp, innings: opts.innings, diff: opts.diff })); } catch (err) { }
  if (opts.mode === 'season' || opts.mode === 'cpuseason') {
    // a run with a different club is in progress: ask before replacing it
    if (S && S.active && S.teamId !== opts.team && typeof askSeasonSwitch === 'function' && !opts.switchOk) { askSeasonSwitch(opts); return; }
    if (!S || !S.active || opts.fresh) { if (opts.fresh && S && S.active && S.hist && S.hist.games.length) archiveRun('abandoned'); newSeason(opts.team); S.innings = opts.innings; }
    S.cpu = opts.mode === 'cpuseason'; if (S.cpu) S.autoNext = true; saveSeason();
    updateSeasonTab(); try { history.replaceState(null, '', '#season'); } catch (err) { }
    showPage('season'); return;
  }
  document.getElementById('menu').hidden = true; PL = null;
  newGame(opts); cv.focus();
}
try { const s = JSON.parse(localStorage.getItem('bd-setup') || 'null'); if (s) { for (const [n, v] of [['hints', s.hints || 'off'], ['mode', s.mode], ['team', s.team], ['inn', s.innings], ['diff', s.diff]]) { const el = document.querySelector(`input[name=${n}][value="${v}"]`); if (el) el.checked = true; } } } catch (e) { }
document.getElementById('bResume').onclick = togglePause;
let PAUSE_EN = null; function syncPauseBtn() { const en = G.phase !== 'menu' && G.phase !== 'over'; if (en !== PAUSE_EN) { PAUSE_EN = en; document.getElementById('bPause').disabled = !en; } }
document.getElementById('bPause').onclick = () => { if (G.phase !== 'menu' && G.phase !== 'over') togglePause(); };
document.getElementById('bQuit').onclick = () => openEndDlg();
document.getElementById('bMenu').onclick = () => openEndDlg();
document.getElementById('bSetup').onclick = showMenu;
document.getElementById('bAgain').onclick = () => { document.getElementById('over').hidden = true; PL = null; newGame(G.opts); };
setAuto(AUTO);

