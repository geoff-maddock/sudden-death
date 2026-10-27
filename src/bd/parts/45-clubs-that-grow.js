/* ================= Clubs that grow: one permanent Clubhouse per club ================= */
// Every club (the founding two and every custom club) keeps a permanent record, FR[id], shaped like a season save:
// players with levels and XP, lineup, bench, essence, the mana well, items, a market, a log. Its gold and gear
// are its Armory locker. Exhibition games earn XP, essence and gold; a season run starts from the club as it
// stands and what it earns carries back. CPU-managed clubs improve themselves after each game.
// The Clubhouse page works on any club between games: the season code runs on FR[id] by swapping it in as S.
var LEAGUE_START = { grave: { budget: 420, gold: 40 }, iron: { budget: 530, gold: 80 }, brim: { budget: 620, gold: 120 }, hell: { budget: 710, gold: 160 }, abyss: { budget: 820, gold: 220 } };
var FR = {}, FR_LOADING = false, CH = { view: null };
const CLONE = o => JSON.parse(JSON.stringify(o));
function withClub(F, fn) { const keep = S; S = F; try { return fn(); } finally { S = keep; } }
function attachAcc(F) {
  Object.defineProperty(F, 'gold', { get() { return lockerOf(F.teamId).gold; }, set(v) { lockerOf(F.teamId).gold = v; }, enumerable: false, configurable: true });
  Object.defineProperty(F, 'gear', { get() { return lockerOf(F.teamId); }, set(v) { if (v) { const L = lockerOf(F.teamId); L.items = v.items; L.bat = v.bat; L.ball = v.ball; } }, enumerable: false, configurable: true });
  return F;
}
const clubIds = () => [...Object.keys(TEAMS), ...CUSTOM.map(t => t.id)];
const leagueName = id => (LEAGUES.find(L => L.id === id) || LEAGUES[1]).name;

/* ---------- saving ---------- */
try { const raw = JSON.parse(localStorage.getItem('bd-clubs') || 'null') || {}; for (const [id, f] of Object.entries(raw)) { if (f.locker && !LOCKERS[id]) LOCKERS[id] = f.locker; delete f.locker; FR[id] = attachAcc(f); } } catch (e) { FR = {}; }
let FR_CLOUD_T = null;
function saveClubs(touched) {
  if (touched && FR[touched]) FR[touched].updated = Date.now();
  const out = {}; for (const [id, F] of Object.entries(FR)) out[id] = { ...F, locker: LOCKERS[id] || null };
  try { localStorage.setItem('bd-clubs', JSON.stringify(out)); } catch (e) { }
  saveLockers();
  if (Cloud.ready) { clearTimeout(FR_CLOUD_T); FR_CLOUD_T = setTimeout(() => Cloud.db.doc(`data/users/${Cloud.uid}/clubs`).set({ clubs: out, savedAt: Date.now() }).catch(() => { }), 1500); }
}
async function clubsCloudSync() {
  if (!Cloud.ready) return;
  try {
    const snap = await Cloud.db.doc(`data/users/${Cloud.uid}/clubs`).get();
    const cloud = snap.exists && snap.data() && snap.data().clubs || {};
    let changed = false;
    for (const [id, f] of Object.entries(cloud)) {
      if (FR[id] && (FR[id].updated || 0) >= (f.updated || 0)) continue;
      if (f.locker) LOCKERS[id] = f.locker; const g = { ...f }; delete g.locker; FR[id] = attachAcc(g); changed = true;
    }
    saveClubs();
    if (changed) { try { if (PAGE === 'season') renderClub(); renderMatchup(); } catch (e) { } }
  } catch (e) { }
}
{ const o = careerCloudSync; careerCloudSync = async function () { await o.apply(this, arguments); await clubsCloudSync(); }; }

/* ---------- making a club's record ---------- */
function makeFranchise(id) {
  const t = TEAMS[id] || CUSTOM.find(x => x.id === id); if (!t) return null;
  const league = t.league || 'iron', taken = new Set();
  const F = attachAcc({ v: 1, franchise: true, active: true, over: null, teamId: id, league,
    club: { id, name: t.name, short: t.short, color: t.color, trim: t.trim || '#141014', light: t.light, motto: t.motto || '', css: t.css },
    players: [], lineup: [], bench: [], essence: 2, font: 0, game: 0, wins: 0, losses: 0, lives: 3, opp: [], inv: [], market: null, log: [], sel: null, innings: 3, taken: [], cpuMgr: false, updated: Date.now() });
  for (const p of t.roster) { taken.add(p.n); const sp = makeSP(p); F.players.push(sp); F.lineup.push({ id: sp.id, pos: p.pos }); }
  const rel = genPlayer(0, 'P', taken); rel.ck = 'gen:' + rel.id; F.players.push(rel); F.bench.push(rel.id);
  F.taken = [...taken];
  const rec = CLUBREC[id]; if (rec) { F.wins = rec.w || 0; F.losses = rec.l || 0; }
  const fresh = !LOCKERS[id], L = lockerOf(id); if (fresh) L.gold = (LEAGUE_START[league] || LEAGUE_START.iron).gold;
  withClub(F, () => { rollMarket(); seasonLog(`${t.name} open their clubhouse in the ${leagueName(league)}.`); });
  return F;
}
function franchise(id) {
  if (!id || id === 'club' || String(id).startsWith('opp')) return null;
  if (FR[id]) return FR[id];
  const F = makeFranchise(id); if (!F) return null;
  FR[id] = F; saveClubs(id); return F;
}

/* ---------- seasons start from the club and carry back ---------- */
function syncBack(force) { // season run -> the club's record (only while the run is live, plus once as it ends)
  if (!S || S.franchise || !S.teamId || !(S.active || force)) return;
  const F = franchise(S.teamId); if (!F) return;
  F.players = CLONE(S.players); F.lineup = CLONE(S.lineup); F.bench = CLONE(S.bench); F.essence = S.essence; F.font = S.font; F.inv = CLONE(S.inv || []); F.taken = CLONE(S.taken || []);
  const L = lockerOf(S.teamId); L.gold = S.gold; if (S.gear) { L.items = CLONE(S.gear.items || []); L.bat = S.gear.bat; L.ball = S.gear.ball; }
  saveClubs(S.teamId);
}
function syncForward(F) { // the club's record -> a season run in progress with the same club
  if (!S || S.franchise || !S.active || S.teamId !== F.teamId) return;
  S.players = CLONE(F.players); S.lineup = CLONE(F.lineup); S.bench = CLONE(F.bench); S.essence = F.essence; S.font = F.font; S.inv = CLONE(F.inv); S.taken = CLONE(F.taken || []);
  S.gold = F.gold; const L = lockerOf(F.teamId); S.gear = { items: CLONE(L.items), bat: L.bat, ball: L.ball }; S.sel = null;
  FR_LOADING = true; try { saveSeason(); } finally { FR_LOADING = false; }
}
{ const o = saveSeason; saveSeason = function () {
  if (S && S.franchise) { saveClubs(S.teamId); return; }
  o.apply(this, arguments);
  if (!FR_LOADING && S && S.teamId && !(G.season && gameOn())) try { syncBack(); } catch (e) { }
}; }
{ const o = newSeason; newSeason = function (teamId) {
  FR_LOADING = true; try { o.apply(this, arguments); } finally { FR_LOADING = false; }
  const F = franchise(teamId); if (!F || !S) { saveSeason(); return; }
  S.players = CLONE(F.players); S.lineup = CLONE(F.lineup); S.bench = CLONE(F.bench); S.essence = F.essence; S.font = F.font; S.inv = CLONE(F.inv);
  S.taken = [...new Set([...(S.taken || []), ...(F.taken || []), ...F.players.map(p => p.n)])];
  S.gold = F.gold; const L = lockerOf(teamId); S.gear = { items: CLONE(L.items), bat: L.bat, ball: L.ball }; S.sel = null;
  // rivals are pitched at the club's league
  const R = clubRating(teamId), off = R ? LEAGUES.indexOf(R.league) - 1 : 0;
  if (off) for (const c of S.opp) for (const p of [...c.roster, ...(c.pen || [])]) for (const s of STATS) p[s] = clamp(p[s] + off, 1, STAT_CAP);
  rollMarket();
  seasonLog(`The season starts from the club as it stands${R ? ` (${R.league.name}, rating ${R.rating})` : ''}; what it earns carries back to the club.${off ? ` Rivals ${off > 0 ? 'strengthened' : 'weakened'} to match.` : ''}`);
  CH.view = 'season';
  saveSeason();
}; }
{ const o = seasonAfterGame; seasonAfterGame = function () {
  const w0 = S ? S.wins : 0, l0 = S ? S.losses : 0, id = S && S.teamId;
  o.apply(this, arguments);
  try { const F = id && franchise(id); if (F && S) { F.wins += S.wins - w0; F.losses += S.losses - l0; F.game++; syncBack(true); } } catch (e) { }
}; }
// free agents match the club's league, not how many games it has played
{ const o = rollMarket; rollMarket = function () {
  if (!(S && S.franchise)) return o.apply(this, arguments);
  const g = S.game; let idx = 1; try { idx = LEAGUES.indexOf(clubRating('club').league); } catch (e) { }
  S.game = [0, 1, 3, 4, 6][Math.max(0, idx)] ?? 1;
  try { return o.apply(this, arguments); } finally { S.game = g; }
}; }

/* ---------- exhibition games use the club as it stands ---------- */
function fdef(id, innings) {
  const F = franchise(id); if (!F) return null;
  return withClub(F, () => {
    const roster = S.lineup.map(l => effPlayer(SP(l.id), l.pos));
    const pen = S.bench.map(SP).filter(p => p && p.pitches).map(p => effPlayer(p, 'RP'));
    const d = { ...S.club, id, fid: id, roster, pen, manaBonus: S.font + (S.players.some(p => p.item === 'chalice') ? 1 : 0) };
    if (!d.pen.length) d.pen = quickPen(d, innings || 3);
    return d;
  });
}
{ const o = newGame; newGame = function (opts) {
  const oc = document.getElementById('overClub'); if (oc) oc.remove();
  if (opts && !opts.defs && !opts.season) {
    const oid = opts.opp && opts.opp !== opts.team ? opts.opp : opts.team === 'ironmaw' ? 'mirewood' : 'ironmaw';
    let A = null, B = null; try { A = fdef(opts.team, opts.innings); B = fdef(oid, opts.innings); } catch (e) { }
    if (A && B) { const r = o.call(this, { ...opts, defs: [A, B] }); G.opts = { ...opts }; return r; }
  }
  return o.apply(this, arguments);
}; }
// after an exhibition: XP, rest, essence, the record, a fresh market; the CPU manages its clubs
function exhAfterGame() {
  if (!G.teams || G.season) return;
  const [a, h] = G.teams, winner = a.R > h.R ? a : h, out = [];
  for (const t of G.teams) {
    const id = t.def.fid; if (!id) continue;
    const F = franchise(id); if (!F) continue;
    const opp = G.teams.find(x => x !== t), won = t === winner, played = new Map();
    for (const g of [...t.def.roster, ...t.used]) if (g && g.id) played.set(g.id, g);
    const lines = [];
    for (const sp of F.players) {
      const g = played.get(sp.id);
      if (g) {
        const st = G.pstats.get(g) || { h: 0, hr: 0, r: 0, k: 0, outs: 0 };
        const xp = 8 + st.h * 6 + st.hr * 10 + st.r * 4 + st.k * 5 + st.outs * 2 + (won ? 5 : 0);
        sp.xp += xp; let ups = 0; while (sp.xp >= xpNeed(sp.lvl)) { sp.lvl++; sp.pts += 2; ups++; }
        lines.push({ n: sp.n, xp, ups, lvl: sp.lvl });
        sp.sta = Math.min(sp.sta, 100 * fatigue(g)) - (g.pos === 'C' ? 8 : g.pos === 'P' || g.pos === 'RP' ? 4 : 5);
        sp.hp = clamp((g.hp ?? 100) + (typeof INJ !== 'undefined' ? INJ.heal[injLevel()] : 40) + (sp.item === 'salve' ? 25 : 0) + (sp.kind === 'troll' ? 20 : 0), 5, 100);
      } else { sp.sta += 28; sp.hp = Math.min(100, (sp.hp ?? 100) + 60); }
      sp.sta = clamp(sp.sta + 12 + (sp.item === 'amulet' ? 10 : 0) + Math.round((sp.pow + sp.arm) / 5), 5, 100);
    }
    const ess = Math.max(0, t.mana) + 1 + (won ? 1 : 0);
    F.essence += ess; if (won) F.wins++; else F.losses++; F.game++;
    let moves = [];
    withClub(F, () => {
      try { injAfterSeasonGame(played); } catch (e) { }
      seasonLog(`${won ? 'Beat' : 'Lost to'} the ${opp.def.name} ${t.R}-${opp.R}. +${won ? GEAR_WIN : GEAR_LOSS}g, +${ess} essence${lines.some(l => l.ups) ? `; level-ups: ${lines.filter(l => l.ups).map(l => l.n).join(', ')}` : ''}.`);
      rollMarket();
      if (t.ctl === 'cpu' || F.cpuMgr) { try { moves = cpuManage() || []; } catch (e) { } }
    });
    try { syncForward(F); } catch (e) { }
    saveClubs(id);
    if (t.ctl !== 'cpu') out.push({ id, name: t.def.name, color: t.def.color, won, ess, gold: won ? GEAR_WIN : GEAR_LOSS, lines, pts: F.players.reduce((s, p) => s + (p.pts || 0), 0), moves });
  }
  if (out.length) setTimeout(() => showExhSummary(out), 1500);
}
function showExhSummary(out) {
  const card = document.querySelector('#over .card-menu'); if (!card || document.getElementById('over').hidden) return;
  let el = document.getElementById('overClub'); if (!el) { el = document.createElement('div'); el.id = 'overClub'; el.className = 'over-club'; card.insertBefore(el, card.querySelector('.row')); }
  el.innerHTML = out.map(o => `<p class="sub"><b style="color:${o.color}">${esc(o.name)}</b>: +${o.gold}g · +${o.ess} essence · ${o.lines.map(l => `${esc(l.n)} +${l.xp}${l.ups ? ` <b class="wtxt">Lv ${l.lvl}!</b>` : ''}`).join(', ')}${o.pts ? ` · <b>${o.pts} stat points to spend</b>` : ''}
    <a class="buy" href="#season" data-page="season" data-chview="${o.id}" style="text-decoration:none;margin-left:6px">Clubhouse</a></p>`).join('');
}
{ const o = recordClubResult; recordClubResult = function () { o.apply(this, arguments); try { exhAfterGame(); } catch (e) { } }; }

/* ---------- ratings, leagues and matchups use the club as it stands ---------- */
{ const o = clubRating; clubRating = function (which) {
  if (typeof which === 'string' && which !== 'club') { const F = franchise(which); if (F) { const r = withClub(F, () => o('club')); if (r) r.id = which; return r; } }
  return o.apply(this, arguments);
}; }
const winOdds = (ra, rb) => 1 / (1 + Math.pow(10, -(ra - rb) / 160));
const itemMod = (p, s) => (p.item && ITEMS[p.item] && ITEMS[p.item].mod && ITEMS[p.item].mod[s]) || 0;
function gearNames(L) { if (!L) return 'none'; const n = t => { const it = L.items && L.items.find(x => x.uid === L[t]); return it && GEAR[it.id] ? GEAR[it.id].name.replace(/ (Bat|Ball)$/, '') : ''; }; return [n('bat'), n('ball')].filter(Boolean).join(' · ') || 'none'; }
function clubSummary(which) {
  let R, players, pen = 0, gear = 'none', gold = null, short = '';
  if (which === 'club') { if (!S) return null; R = clubRating('club'); players = S.lineup.map(l => SP(l.id)); pen = S.bench.map(SP).filter(p => p && p.pitches).length; gold = S.gold; short = S.club.short; gear = gearNames(lockerOf('club')); }
  else if (typeof which === 'object' && which) { R = clubRating(which); players = which.roster; pen = (which.pen || []).length; short = which.short; try { gear = gearNames(rivalLocker(which)); } catch (e) { } }
  else {
    const F = franchise(which); if (!F) return null; R = clubRating(which);
    const src = S && !S.franchise && S.active && S.teamId === which ? S : F;
    players = src.lineup.map(l => src.players.find(p => p.id === l.id)).filter(Boolean); pen = src.bench.map(id => src.players.find(p => p.id === id)).filter(p => p && p.pitches).length;
    gold = src.gold; short = src.club.short; gear = gearNames(src === F ? lockerOf(which) : src.gear);
  }
  if (!R || !players) return null;
  const avg = {}; for (const s of STATS) avg[s] = players.reduce((a, p) => a + p[s] + itemMod(p, s), 0) / Math.max(1, players.length);
  const powers = players.reduce((a, p) => a + ['bat', 'run', 'field'].filter(k => p[k]).length, 0);
  const magic = players.reduce((a, p) => a + (p.pitches ? p.pitches.filter(k => PITCHES[k] && PITCHES[k].magic).length : 0), 0);
  const lvl = players.reduce((a, p) => a + (p.lvl || 1), 0) / Math.max(1, players.length);
  return { R, short, avg, powers, magic, lvl, pen, gear, gold };
}
function compareHTML(A, B, la, lb) {
  if (!A || !B) return '';
  const p = winOdds(A.R.rating, B.R.rating), pa = Math.round(p * 100);
  const cell = (v, w, fmt) => `<td class="${w ? 'cmp-up' : ''}">${fmt(v)}</td>`;
  const row = (lbl, va, vb, fmt = x => x) => { const d = typeof va === 'number' && typeof vb === 'number' ? va - vb : 0; return `<tr>${cell(va, d > .05, fmt)}<th>${lbl}</th>${cell(vb, d < -.05, fmt)}</tr>`; };
  const f1 = x => x.toFixed(1), rec = R => `${R.w}–${R.l}`, rpct = R => R.w + R.l ? R.w / (R.w + R.l) : .5;
  return `<div class="cmp">
    <p class="cmp-note">${matchupNote(A.R, B.R)}</p>
    <div class="cmp-odds"><b style="color:${A.R.color}">${esc(A.short)} ${pa}%</b><div class="cmp-bar"><i style="width:${pa}%;background:${A.R.color}"></i><i style="width:${100 - pa}%;background:${B.R.color}"></i></div><b style="color:${B.R.color}">${100 - pa}% ${esc(B.short)}</b></div>
    <div class="tablewrap"><table class="cmp-t"><thead><tr><th style="color:${A.R.color}">${esc(A.R.name)}${la ? `<div class="sub">${la}</div>` : ''}</th><th></th><th style="color:${B.R.color}">${esc(B.R.name)}${lb ? `<div class="sub">${lb}</div>` : ''}</th></tr></thead><tbody>
      <tr><td>${lgBadge(A.R)}</td><th>League</th><td>${lgBadge(B.R)}</td></tr>
      ${row('Rating', A.R.rating, B.R.rating)}${row('Roster points', A.R.parts.roster, B.R.parts.roster)}
      ${STATS.map(s => row(`${s.toUpperCase()} <span class="sub">avg</span>`, A.avg[s], B.avg[s], f1)).join('')}
      ${row('Level <span class="sub">avg</span>', A.lvl, B.lvl, f1)}${row('Powers', A.powers, B.powers)}${row('Magic pitches', A.magic, B.magic)}${row('Bullpen arms', A.pen, B.pen)}
      <tr><td>${esc(A.gear)}</td><th>Gear</th><td>${esc(B.gear)}</td></tr>
      ${A.gold != null && B.gold != null ? row('Gold', A.gold, B.gold) : ''}
      <tr>${cell(rec(A.R), rpct(A.R) > rpct(B.R) + .01, x => x)}<th>Record</th>${cell(rec(B.R), rpct(B.R) > rpct(A.R) + .01, x => x)}</tr>
    </tbody></table></div>
    <p class="sub cmp-foot">Green marks the stronger side. The odds are a rough guide from the ratings; skill at the plate decides the rest.</p></div>`;
}
function matchLabels(mode) { return mode === '2p' ? ['Player 1', 'Player 2'] : mode === 'demo' ? ['Away · CPU', 'Home · CPU'] : ['You', 'CPU']; }
{ const div = document.createElement('div'); const old = document.getElementById('matchup'); if (old) { div.id = 'matchup'; div.className = 'matchup'; div.hidden = true; old.replaceWith(div); } }
renderMatchup = function () {
  const el = document.getElementById('matchup'); if (!el) return;
  const mode = (document.querySelector('input[name=mode]:checked') || {}).value;
  const t = (document.querySelector('input[name=team]:checked') || {}).value, o = (document.querySelector('input[name=opp]:checked') || {}).value;
  for (const lab of document.querySelectorAll('#teamSeg label, #oppSeg label')) {
    const inp = document.getElementById(lab.htmlFor); if (!inp) continue; lab.querySelectorAll('.lgb').forEach(x => x.remove());
    const R = clubRating(inp.value); if (R) lab.insertAdjacentHTML('beforeend', ' ' + lgBadge(R));
  }
  if (!t) { el.hidden = true; return; }
  if (mode === 'season' || mode === 'cpuseason') {
    const A = clubSummary(t); if (!A) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = `<p class="hint" style="margin:0"><b style="color:${A.R.color}">${esc(A.R.name)}</b> ${lgBadge(A.R, true)} · ${A.R.w}–${A.R.l} all time. A season starts from the club as it stands now, with rivals pitched at its league, and what it earns carries back. <a href="#season" data-page="season" data-chview="${t}">Improve it in the Clubhouse first</a>.</p>`;
    return;
  }
  if (!o) { el.hidden = true; return; }
  const [la, lb] = matchLabels(mode);
  el.hidden = false; el.innerHTML = compareHTML(clubSummary(t), clubSummary(o), la, lb);
};
leagueLine = function () {
  try {
    const [a, h] = G.teams.map(t => t.def.id === 'club' ? clubRating('club') : G.season ? clubRating(t.def) : clubRating(t.def.fid || t.def.id));
    if (!a || !h) return;
    const p = Math.round(winOdds(a.rating, h.rating) * 100), gap = Math.abs(a.rating - h.rating);
    const v = a.league !== h.league ? 'a mismatch' : gap < 40 ? 'an even match' : 'the same league, uneven';
    logLine(`${a.league.short} League (${a.rating}) at ${h.league.short} League (${h.rating}): ${v}. Rough odds ${G.teams[0].def.short} ${p}%, ${G.teams[1].def.short} ${100 - p}%.`);
  } catch (e) { }
};
leagueTable = function () {
  const rows = clubIds().map(clubRating).filter(Boolean);
  for (const r of rows) if (S && !S.franchise && S.active && S.teamId === r.id) r.name += ' (season in progress)';
  rows.sort((a, b) => b.rating - a.rating);
  const groups = LEAGUES.slice().reverse().map(L => ({ L, rs: rows.filter(r => r.league === L) })).filter(g => g.rs.length);
  return `<h3 id="leagues">Leagues</h3>
    <p class="sub" style="margin-top:0">Every club is rated on its roster (stats, powers, pitches, levels and upgrades, on the Team builder's points scale), the value of its gear, its gold, its magic items and its win record. The rating places it in a league: ${LEAGUES.map(L => `<span class="lgb" style="--lg:${L.col}">${L.short} ${L.min}+</span>`).join(' ')}. Clubs move up as they improve in the Clubhouse and win; the setup screen compares any two clubs before a game.</p>
    ${groups.map(({ L, rs }) => `<h4 style="color:${L.col};margin:14px 0 4px">${L.name}</h4>
      <div class="tablewrap"><table class="cat lg-table"><thead><tr><th>Club</th><th>Rating</th><th>Roster</th><th>Gear</th><th>Gold</th><th>Items</th><th>Record</th><th></th></tr></thead><tbody>
      ${rs.map(r => `<tr><td><b style="color:${r.color}">${esc(r.name)}</b></td><td><b>${r.rating}</b></td><td>${r.parts.roster}</td><td>${r.parts.gear}</td><td>${r.parts.gold}</td><td>${r.parts.items}</td><td>${r.w}–${r.l} <span class="sub">(${r.parts.record >= 0 ? '+' : ''}${r.parts.record})</span></td><td><a class="buy" href="#season" data-page="season" data-chview="${r.id}" style="text-decoration:none;font-size:15px;padding:2px 7px">Clubhouse</a></td></tr>`).join('')}
      </tbody></table></div>`).join('')}`;
};
// Rosters show each club as it stands
rosterClubs = function () {
  return [...Object.values(TEAMS), ...CUSTOM].map(t => {
    const inSeason = S && !S.franchise && S.active && S.teamId === t.id, src = inSeason ? S : franchise(t.id);
    const players = src ? src.lineup.map(l => ({ ...src.players.find(p => p.id === l.id), pos: l.pos })).concat(src.bench.map(id => ({ ...src.players.find(p => p.id === id), bench: true }))) : t.roster;
    return { id: t.id, name: t.name + (inSeason ? ' (season)' : ''), color: t.color, t, players, season: inSeason };
  });
};
// the Armory lists each club once: a club in a season shops with the season's gold
{ const o = armoryClubs; armoryClubs = function () { const l = o.apply(this, arguments); return S && !S.franchise && S.active ? l.filter(c => c.id !== S.teamId) : l; }; }

/* ---------- the Clubhouse page: pick any club ---------- */
updateSeasonTab = function () { const t = document.querySelector('.tab[data-page=season]'); if (t) t.hidden = false; };
updateSeasonTab();
const setupTeam = () => (document.querySelector('input[name=team]:checked') || {}).value || 'ironmaw';
function chView() {
  let v = CH.view || (S && !S.franchise && S.active ? 'season' : setupTeam());
  if (v === 'season' && (!S || S.franchise)) v = setupTeam();
  if (v !== 'season' && S && !S.franchise && S.active && S.teamId === v) v = 'season';
  if (v === 'season') return { season: true };
  const F = franchise(v); return F ? { fr: true, F } : { season: true };
}
function chPicker(cur) {
  const chips = [];
  if (S && !S.franchise) chips.push(`<button class="rchip ${cur === 'season' ? 'on' : ''}" data-ch="season" style="border-bottom:3px solid ${S.club.color}">${esc(S.club.name)} · season${S.active ? ` game ${S.game + 1}` : ' (over)'}</button>`);
  for (const id of clubIds()) { if (S && !S.franchise && S.active && S.teamId === id) continue; const R = clubRating(id); if (!R) continue; chips.push(`<button class="rchip ${cur === id ? 'on' : ''}" data-ch="${id}" style="border-bottom:3px solid ${R.color}">${esc(R.name)} ${lgBadge(R)}</button>`); }
  return `<section class="ch-pick"><div class="rv-row"><span class="rv-lbl">Club</span>${chips.join('')}</div>
    <p class="sub">Every club keeps its roster, levels, gold, essence, items and gear from game to game, in exhibitions and seasons alike. Improve any club here between games; clubs the CPU runs improve themselves after each game they play.</p></section>`;
}
{ const o = renderClub; renderClub = function () {
  const el = document.getElementById('club'); if (!el) return o.apply(this, arguments);
  const v = chView();
  if (!v.fr) {
    o.apply(this, arguments);
    try {
      el.insertAdjacentHTML('afterbegin', chPicker('season'));
      if (S && S.active && !S.over && !S.live) { const nx = el.querySelector('.card.next'), ob = S.opp[S.game]; if (nx && ob) nx.insertAdjacentHTML('afterend', `<section class="card cmp-card"><h4>How the matchup looks</h4>${compareHTML(clubSummary('club'), clubSummary(ob), 'your club', `game ${S.game + 1} rival`)}</section>`); }
    } catch (e) { }
    return;
  }
  const F = v.F, id = F.teamId, busy = clubBusy(id);
  withClub(F, () => {
    const keep = S.opp; S.opp = []; S.opp[S.game] = { name: '', color: '', motto: '', level: 0, roster: [] };
    try { o.apply(this, arguments); } finally { S.opp = keep; }
  });
  try {
    el.querySelectorAll('.chip.life, .ladder, [data-act="abandon"]').forEach(x => x.remove());
    const sc = el.querySelector('#savesCard'); if (sc && sc.parentElement) sc.parentElement.remove();
    el.querySelectorAll('.clubfoot h4').forEach(h => { if (/Season log/.test(h.textContent)) h.textContent = 'Club log'; });
    el.querySelectorAll('[data-arclub="club"]').forEach(a => a.dataset.arclub = id);
    const chips = el.querySelector('.clubhead .chips'); if (chips) chips.insertAdjacentHTML('afterbegin', `<span class="chip"><em>Games</em>${F.game}</span>`);
    const probs = withClub(F, () => lineupProblems());
    const nx = el.querySelector('.card.next');
    const card = `<div class="card next ch-between"><div><h4>${busy ? 'Playing right now' : 'Between games'}</h4><h3 style="color:${F.club.color}">${esc(F.club.name)}</h3>
      <p class="sub">${busy ? 'This club is in the game on the Play page. The Clubhouse opens again after the final out.' : 'Spend stat points, essence and gold, sign or retrain players, set the lineup, equip items and gear, or send a party into a dungeon: any time the club is not playing. Everything here stays with the club.'}</p>
      ${probs.length ? `<p class="warnt">${probs.map(esc).join(' ')}</p>` : ''}</div>
      <div class="playbox"><button class="go" data-chgo="play" data-a="${id}" ${busy ? 'disabled' : ''}>Play a game with them</button><button class="buy" data-chgo="season" data-a="${id}" ${busy ? 'disabled' : ''}>Start a season with them</button>
      <label class="sub"><input type="checkbox" data-chgo="cpu" data-a="${id}" ${F.cpuMgr ? 'checked' : ''}> The CPU also manages this club after each game (it always does when the CPU plays them)</label></div></div>`;
    if (nx) nx.outerHTML = card; else el.querySelector('.clubhead')?.insertAdjacentHTML('afterend', card);
    el.insertAdjacentHTML('afterbegin', chPicker(id));
  } catch (e) { }
}; }
// clicks in the Clubhouse act on the club being viewed: swap its record in as S for the handlers, then swap back
let CH_SWAP = null;
function chSwapIn(e) {
  if (CH_SWAP || PAGE !== 'season' || !e.target.closest || !e.target.closest('#club') || e.target.closest('[data-ch],[data-chgo],[data-chview],[data-page]')) return;
  const v = chView(); if (!v.fr) return;
  if (clubBusy(v.F.teamId) && e.target.closest('[data-act],[data-fo],[data-dg],select,input')) { e.preventDefault(); e.stopPropagation(); return; }
  CH_SWAP = { keep: S }; S = v.F;
}
function chSwapOut() { if (CH_SWAP) { const F = S; S = CH_SWAP.keep; CH_SWAP = null; if (F && F.franchise) saveClubs(F.teamId); } }
for (const ev of ['click', 'change']) { window.addEventListener(ev, chSwapIn, true); window.addEventListener(ev, chSwapOut); }
document.addEventListener('click', e => {
  const c = e.target.closest && e.target.closest('[data-ch]'); if (c) { CH.view = c.dataset.ch; renderClub(); return; }
  const v = e.target.closest && e.target.closest('[data-chview]'); if (v) { CH.view = v.dataset.chview; if (PAGE === 'season') renderClub(); if (!document.getElementById('over').hidden && G.phase === 'over') { document.getElementById('over').hidden = true; showMenu(); } return; }
  const g = e.target.closest && e.target.closest('[data-chgo]'); if (!g || g.disabled) return;
  const id = g.dataset.a, act = g.dataset.chgo;
  if (act === 'cpu') { const F = FR[id]; if (F) { F.cpuMgr = g.checked; saveClubs(id); } return; }
  const r = document.querySelector(`input[name=team][value="${id}"]`); if (r) r.checked = true;
  const mode = act === 'season' ? 'season' : ((document.querySelector('input[name=mode]:checked') || {}).value || '1p');
  const m = document.querySelector(`input[name=mode][value="${act === 'season' ? 'season' : /season/.test(mode) ? '1p' : mode}"]`); if (m) m.checked = true;
  renderTeamPickers();
  if (act === 'season') { startFromSetup(); return; }
  try { history.replaceState(null, '', '#play'); } catch (err) { }
  if (!gameOn()) showMenu(); showPage('play');
});
{ const o = startFromSetup; startFromSetup = function (extra) { const mode = (document.querySelector('input[name=mode]:checked') || {}).value; if (mode === 'season' || mode === 'cpuseason') CH.view = 'season'; return o.apply(this, arguments); }; }
{ const o = cpuBetweenGames; cpuBetweenGames = function () { CH.view = 'season'; return o.apply(this, arguments); }; }
document.getElementById('sOver').addEventListener('click', e => { if (e.target.closest('[data-act="toclub"]')) CH.view = 'season'; }, true);

/* ---------- Team builder: a starting league sets the budget and the starting gold ---------- */
const draftLeague = () => (BD.draft && BD.draft.league) || 'iron';
const clubLocked = id => !!(id && FR[id] && FR[id].game > 0);
{ const o = teamProblems; teamProblems = function (t) {
  const out = o.apply(this, arguments).filter(x => !/^Over budget/.test(x));
  const L = LEAGUE_START[t.league || 'iron'], pts = teamPts(t);
  if (pts > L.budget) out.push(`Over the ${leagueName(t.league || 'iron')} budget by ${pts - L.budget} points.`);
  if (clubLocked(t.id) && !BD.refound) out.push(`This club has played ${FR[t.id].game} game${FR[t.id].game === 1 ? '' : 's'}: improve it in the Clubhouse, or refound it (starts it over).`);
  return out;
}; }
function fitBudget(t, budget) {
  for (let g = 0; g < 300 && teamPts(t) > budget; g++) { const p = t.roster.slice().sort((a, b) => playerPts(b) - playerPts(a))[R() < .6 ? 0 : 1]; fitPlayer(p, playerPts(p) - 3); }
  for (let g = 0; g < 800 && teamPts(t) < budget - 8; g++) { const p = pick(t.roster), s = pick(STATS5); if (p[s] < 10) { p[s]++; if (teamPts(t) > budget) p[s]--; } }
  return t;
}
{ const o = randomTeam; randomTeam = function () { const lg = draftLeague(), t = o.apply(this, arguments); t.league = lg; return fitBudget(t, LEAGUE_START[lg].budget); }; }
{ const o = saveDraft; saveDraft = function () {
  const d = BD.draft; if (d && !d.league) d.league = 'iron';
  const ok = o.apply(this, arguments);
  if (ok && d) {
    const F = FR[d.id];
    if (!F || !F.game || BD.refound) { delete FR[d.id]; delete LOCKERS[d.id]; delete CLUBREC[d.id]; saveClubRec(); franchise(d.id); BD.refound = false; BD.msg = `Saved. The club starts in the ${leagueName(d.league)} with ${LEAGUE_START[d.league].gold}g.`; }
    saveClubs(d.id); try { renderMatchup(); } catch (e) { }
  }
  return ok;
}; }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#builder [data-b="refound"]'); if (b) { BD.refound = true; BD.msg = 'Refounding: saving now starts the club over (levels, gold and items reset).'; renderBuilder(); } });
function patchBuilder() {
  const el = document.getElementById('builder'); if (!el) return;
  const lede = el.querySelector('.lede2');
  if (lede) lede.innerHTML = `Build your own club from any of the eighteen creature types. Pick a <b>starting league</b>: it sets the point budget for stats, powers, ultimates and magic pitches, and the gold the club starts with (${LEAGUES.map(L => `${L.short} ${LEAGUE_START[L.id].budget} pts, ${LEAGUE_START[L.id].gold}g`).join(' · ')}). Once saved, the club lives on like the founding clubs: it earns XP, essence and gold every game, and you improve it in the <a href="#season" data-page="season">Clubhouse</a>.`;
  const d = BD.draft; if (!d) return;
  if (!d.league) d.league = 'iron';
  const LS = LEAGUE_START[d.league], pts = teamPts(d), b = LS.budget, est = pts + 6 + Math.round(LS.gold / 10), estL = leagueOf(est);
  const f = el.querySelector('.bl-fields');
  if (f && !f.querySelector('[data-t="league"]')) f.insertAdjacentHTML('afterbegin', `<label>Starting league<select data-t="league" ${clubLocked(d.id) && !BD.refound ? 'disabled' : ''}>${LEAGUES.map(L => `<option value="${L.id}" ${L.id === d.league ? 'selected' : ''}>${L.name} · ${LEAGUE_START[L.id].budget} pts · ${LEAGUE_START[L.id].gold}g</option>`).join('')}</select></label>`);
  const bb = el.querySelector('.bl-budget');
  if (bb) bb.innerHTML = `<div class="bl-meter"><i style="width:${Math.min(100, pts / b * 100)}%;background:${pts > b ? '#ff6a5a' : 'var(--torch)'}"></i></div><b class="${pts > b ? 'ltxt' : ''}">${pts} / ${b} points</b><span class="sub">${pts <= b ? b - pts + ' left' : 'over budget'} · starts with ${LS.gold}g · rating about ${est}, <span style="color:${estL.col}">${estL.name}</span>${pts < b - 60 ? ' · <b>Randomize every player</b> fills this budget' : ''}</span>`;
  const row = el.querySelector('.bl-head .row');
  if (row && clubLocked(d.id) && !row.querySelector('[data-b="refound"]')) row.insertAdjacentHTML('beforeend', `<a class="buy" href="#season" data-page="season" data-chview="${d.id}" style="text-decoration:none">Open its Clubhouse</a><button class="buy dlg-danger" data-b="refound">${BD.refound ? 'Refounding…' : 'Refound (start over)'}</button>`);
}
{ const o = renderBuilder; renderBuilder = function () { o.apply(this, arguments); try { patchBuilder(); } catch (e) { } }; }

/* ---------- how to play, setup hint, styles ---------- */
try {
  const rules = document.querySelector('#pg-guide .rules');
  if (rules) rules.insertAdjacentHTML('afterbegin', `<div><h4>Clubs, leagues and the Clubhouse</h4><p>Play with <strong>Ironmaw</strong> or <strong>Mirewood</strong>, or build your own club in the <a href="#builder" data-page="builder">Team builder</a>, where the <strong>starting league</strong> you pick sets its point budget and starting gold. Every club keeps its history: each game (exhibition or season) earns its players <strong>XP</strong> (2 stat points per level), plus <strong>essence</strong> and <strong>gold</strong>. Between games, open any club in the <a href="#season" data-page="season">Clubhouse</a> to spend them: stats, power tiers, the mana well, magic items, free agents, retraining, gear and dungeon crawls. A club's <strong>rating</strong> (roster, gear, gold, items, record) places it in a league, and the setup screen compares both clubs, with rough odds, before every game. A season starts from the club as it stands and carries its gains back. Clubs the CPU runs improve themselves after each game.</p></div>`);
  const hint = document.querySelector('#oppOpt .hint'); if (hint) hint.innerHTML = 'Clubs marked ★ are your own, from the <a href="#builder" data-page="builder">Team builder</a>. Each club keeps its levels, gold and items between games: improve any of them in the <a href="#season" data-page="season">Clubhouse</a>. The tag on each club is its league and rating.';
} catch (e) { }
if (typeof DATA_KEYS !== 'undefined') DATA_KEYS['bd-clubs'] = 'Club progress (levels, gold, items)';
{ const st = document.createElement('style'); st.textContent = `
.ch-pick{margin-bottom:16px}.ch-pick .rv-row{margin-bottom:4px}.ch-pick .sub{margin:4px 0 0;max-width:80ch}
.cmp{display:grid;gap:8px}.cmp-note{margin:0}.cmp-foot{margin:0}
.cmp-odds{display:flex;align-items:center;gap:8px;font-family:var(--hud);font-size:18px}.cmp-bar{flex:1;display:flex;height:9px;border-radius:5px;overflow:hidden;background:rgba(239,230,207,.1)}.cmp-bar i{display:block;height:100%}
.cmp-t{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}.cmp-t th,.cmp-t td{padding:3px 8px;border-top:1px solid var(--line);text-align:center}
.cmp-t thead th{border-top:0;font-size:15px}.cmp-t tbody th{font-weight:500;color:var(--faint);font-size:12.5px;text-transform:uppercase;letter-spacing:.4px}.cmp-t td.cmp-up{color:#8fe38a;font-weight:800}
.card-menu .cmp-t{font-size:13px}.card-menu .cmp-t th,.card-menu .cmp-t td{padding:2px 6px}
.cmp-card{margin:14px 0}.cmp-card h4{margin:0 0 8px}.over-club{display:grid;gap:4px}.over-club p{margin:0}
.ch-between .playbox{justify-items:stretch}
.cmp-t{table-layout:fixed}.cmp-t th:nth-child(2){width:34%}.cmp-t td,.cmp-t thead th{overflow-wrap:anywhere}
@media (max-width:700px){.cmp-t tbody th .sub{display:none}.cmp-t{font-size:12.5px}.cmp-t th,.cmp-t td{padding:2px 3px}.cmp-odds{font-size:15px}.cmp-t .lgb{font-size:12px}}`; document.head.appendChild(st); }

/* ---------- start-up: give every club its record, and bring a season in progress back to its club ---------- */
try { for (const id of clubIds()) franchise(id); if (S && !S.franchise && S.teamId) syncBack(); } catch (e) { }
try { renderMatchup(); renderBestiary(); if (PAGE === 'season') renderClub(); if (PAGE === 'records') renderRecords(); if (PAGE === 'builder') renderBuilder(); } catch (e) { }
