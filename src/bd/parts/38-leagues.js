/* ================= Leagues: every club gets a rating and a league ================= */
// Rating = roster points (the Team builder's scale: stats, powers, pitches, ultimates; season upgrades too)
//        + gear (the value left in the locker) / 5 + gold / 10 + magic items / 5 + record (win % over games played).
// The founding clubs start near 530, in the Iron League.
var LEAGUES = [
  { id: 'grave', name: 'Graveyard League', short: 'Graveyard', min: 0, col: '#9aa3a0' },
  { id: 'iron', name: 'Iron League', short: 'Iron', min: 490, col: '#e0a070' },
  { id: 'brim', name: 'Brimstone League', short: 'Brimstone', min: 590, col: '#ff8a3a' },
  { id: 'hell', name: 'Hellfire League', short: 'Hellfire', min: 690, col: '#ff4a4a' },
  { id: 'abyss', name: 'Abyssal League', short: 'Abyssal', min: 800, col: '#b48cff' },
];
var CLUBREC = {};
try { CLUBREC = JSON.parse(localStorage.getItem('bd-clubrec') || '{}') || {}; } catch (e) { CLUBREC = {}; }
function saveClubRec() { try { localStorage.setItem('bd-clubrec', JSON.stringify(CLUBREC)); } catch (e) { } }
function leagueOf(r) { let L = LEAGUES[0]; for (const x of LEAGUES) if (r >= x.min) L = x; return L; }
function lockerValue(L) { if (!L) return 0; return L.items.reduce((a, it) => { const g = GEAR[it.id]; return a + (g ? g.price * (g.recharge ? 1 : it.uses / g.uses) : 0); }, 0); }
// the rating of any club: a preset or custom club by id, the season club ('club'), or a season rival object
function clubRating(which) {
  let roster = [], pen = [], gold = 0, gear = 0, items = 0, w = 0, l = 0, extra = 0, name = '', color = '#ccc', id = '';
  if (which === 'club') {
    if (!S) return null;
    roster = S.lineup.map(x => SP(x.id)).filter(Boolean); pen = S.bench.map(SP).filter(Boolean);
    gold = S.gold; gear = lockerValue(lockerOf('club')); w = S.wins; l = S.losses; name = S.club.name; color = S.club.color; id = 'club';
    for (const p of [...roster, ...pen]) { if (p.item && ITEMS[p.item]) items += ITEMS[p.item].price; for (const k in (p.tiers || {})) extra += (p.tiers[k] - 1) * 6; }
    extra += (S.font || 0) * 10;
  } else if (typeof which === 'object' && which && which.roster) { // a season rival
    roster = which.roster; pen = which.pen || []; name = which.name; color = which.color; id = which.id || name;
  } else {
    const t = getTeam(which); if (!t) return null;
    roster = t.roster; name = t.name; color = t.color; id = t.id;
    const Lk = LOCKERS[which]; gold = Lk ? Lk.gold : GEAR_START_GOLD; gear = Lk ? lockerValue(Lk) : lockerValue(starterLocker());
    const rec = CLUBREC[which] || {}; w = rec.w || 0; l = rec.l || 0;
  }
  const rp = roster.reduce((a, p) => a + playerPts(p), 0) + pen.reduce((a, p) => a + playerPts(p), 0) * .15;
  const g = w + l, rec = g ? (w / g - .5) * 60 * Math.min(1, g / 10) : 0;
  const parts = { roster: Math.round(rp + extra), gear: Math.round(gear / 5), gold: Math.round(gold / 10), items: Math.round(items / 5), record: Math.round(rec) };
  const rating = Object.values(parts).reduce((a, b) => a + b, 0);
  return { id, name, color, rating, league: leagueOf(rating), parts, w, l };
}
const lgBadge = (R, full) => R ? `<span class="lgb" style="--lg:${R.league.col}" title="${R.league.name}: rating ${R.rating}">${full ? R.league.name : R.league.short} ${R.rating}</span>` : '';
// how uneven a pairing is
function matchupNote(a, b) {
  if (!a || !b) return '';
  const d = LEAGUES.indexOf(a.league) - LEAGUES.indexOf(b.league), gap = Math.abs(a.rating - b.rating);
  const fav = a.rating >= b.rating ? a : b;
  if (!d && gap < 40) return `<b>Even match.</b> Both clubs play in the ${a.league.name}.`;
  if (!d) return `<b>Same league,</b> but ${esc(fav.name)} rate ${gap} points higher.`;
  return `<b class="lg-warn">Mismatch:</b> ${esc(a.name)} (${a.league.name}, ${a.rating}) against ${esc(b.name)} (${b.league.name}, ${b.rating}). ${esc(fav.name)} ${Math.abs(d) > 1 ? 'should run away with it' : 'are clear favourites'}.`;
}
// after an exhibition game: count the result for both clubs
function recordClubResult() {
  if (!G.teams || G.season) return;
  const [a, h] = G.teams, w = a.R > h.R ? a : h;
  for (const t of G.teams) { const id = t.def.id; if (!id) continue; const r = CLUBREC[id] || (CLUBREC[id] = { w: 0, l: 0 }); if (t === w) r.w++; else r.l++; }
  saveClubRec();
}

/* ---------- where it shows ---------- */
// setup: league tags on the club chips and a matchup line
function renderMatchup() {
  const el = document.getElementById('matchup'); if (!el) return;
  const mode = (document.querySelector('input[name=mode]:checked') || {}).value;
  const t = (document.querySelector('input[name=team]:checked') || {}).value, o = (document.querySelector('input[name=opp]:checked') || {}).value;
  for (const lab of document.querySelectorAll('#teamSeg label, #oppSeg label')) {
    const inp = document.getElementById(lab.htmlFor); if (!inp || lab.querySelector('.lgb')) continue;
    const R = clubRating(inp.value); if (R) lab.insertAdjacentHTML('beforeend', ' ' + lgBadge(R));
  }
  if (mode === 'season' || mode === 'cpuseason' || !t || !o) { el.hidden = true; return; }
  el.hidden = false; el.innerHTML = matchupNote(clubRating(t), clubRating(o));
}
{ const o = renderTeamPickers; renderTeamPickers = function () { o.apply(this, arguments); try { renderMatchup(); } catch (e) { } }; }
document.addEventListener('change', e => { if (e.target && (e.target.name === 'opp' || e.target.name === 'team' || e.target.name === 'mode')) setTimeout(() => { try { renderMatchup(); } catch (err) { } }, 0); });
// a new game: announce the leagues in the play-by-play
function leagueLine(opts) {
  try {
    const [a, h] = G.teams.map(t => t.def.id === 'club' ? clubRating('club') : G.season ? clubRating(t.def) : clubRating(t.def.id));
    if (a && h) logLine(`${a.league.short} League (${a.rating}) at ${h.league.short} League (${h.rating})${a.league !== h.league ? ': a mismatch' : ''}.`);
  } catch (e) { }
}
// the league table on the Records page
function leagueTable() {
  const ids = [...Object.keys(TEAMS), ...CUSTOM.map(t => t.id)];
  const rows = ids.map(clubRating).filter(Boolean);
  if (S && S.active) { const r = clubRating('club'); if (r) { r.name += ' (season)'; r.season = true; rows.push(r); } }
  rows.sort((a, b) => b.rating - a.rating);
  const groups = LEAGUES.slice().reverse().map(L => ({ L, rs: rows.filter(r => r.league === L) })).filter(g => g.rs.length);
  return `<h3 id="leagues">Leagues</h3>
    <p class="sub" style="margin-top:0">Every club is rated on its roster (stats, powers, pitches and upgrades, on the Team builder's points scale), the value of its gear, its gold, its magic items and its win record. Ratings place clubs in leagues: ${LEAGUES.map(L => `<span class="lgb" style="--lg:${L.col}">${L.short} ${L.min}+</span>`).join(' ')}. When clubs from different leagues meet, the setup screen warns you.</p>
    ${groups.map(({ L, rs }) => `<h4 style="color:${L.col};margin:14px 0 4px">${L.name}</h4>
      <div class="tablewrap"><table class="cat lg-table"><thead><tr><th>Club</th><th>Rating</th><th>Roster</th><th>Gear</th><th>Gold</th><th>Items</th><th>Record</th></tr></thead><tbody>
      ${rs.map(r => `<tr><td><b style="color:${r.color}">${esc(r.name)}</b></td><td><b>${r.rating}</b></td><td>${r.parts.roster}</td><td>${r.parts.gear}</td><td>${r.parts.gold}</td><td>${r.parts.items}</td><td>${r.w}–${r.l} <span class="sub">(${r.parts.record >= 0 ? '+' : ''}${r.parts.record})</span></td></tr>`).join('')}
      </tbody></table></div>`).join('')}`;
}
try { renderSetupRules(); renderMatchup(); if (PAGE === 'records') renderRecords(); if (PAGE === 'season') renderClub(); } catch (e) { }
