/* ================= player statistics: every monster, by season and career ================= */
// A career key follows a monster across games: the founding clubs' players ('ironmaw:Snikt'), custom players ('c_xxx:pid'),
// and players who joined your club in a season ('gen:<id>'). Numbers are kept per "span": each season run, and exhibition games.
var CAREER = {};                 // ck -> { ck, n, race, kind, team, teamName, pos, spans: { spanKey: line }, lastPlayed }
var SPANS = {};                  // spanKey -> { label, club, started, cpu }
try { const c = JSON.parse(localStorage.getItem('bd-career') || 'null'); if (c) { CAREER = c.players || {}; SPANS = c.spans || {}; } } catch (e) { }
const blankLine = () => ({ g: 0, gs: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, hbp: 0, so: 0,
  gp: 0, w: 0, l: 0, outsP: 0, bf: 0, ha: 0, ra: 0, bba: 0, k: 0, hra: 0, hbpP: 0, pc: 0, sb: 0, cs: 0, pko: 0, pk: 0, po: 0, a: 0, e: 0, outs: 0, inj: 0, ko: 0, abil: {} });
function addLine(a, b) { for (const k in b) { if (k === 'abil') { for (const x in b.abil) a.abil[x] = (a.abil[x] || 0) + b.abil[x]; } else if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k]; } return a; }
function saveCareer(cloud = true) {
  try { localStorage.setItem('bd-career', JSON.stringify({ players: CAREER, spans: SPANS })); } catch (e) { }
  if (cloud && Cloud.ready) Cloud.db.doc(`data/users/${Cloud.uid}/career`).set({ players: CAREER, spans: SPANS, savedAt: Date.now() }).catch(() => { });
}
async function careerCloudSync() {
  if (!Cloud.ready) return;
  try {
    const snap = await Cloud.db.doc(`data/users/${Cloud.uid}/career`).get(); if (!snap.exists) { saveCareer(true); return; }
    const d = snap.data() || {}, cp = d.players || {};
    // merge per span: keep whichever copy of a player's span has more plate appearances + batters faced (it's the newer one)
    for (const [ck, e] of Object.entries(cp)) {
      const mine = CAREER[ck]; if (!mine) { CAREER[ck] = e; continue; }
      for (const [sk, line] of Object.entries(e.spans || {})) { const m = mine.spans[sk]; if (!m || (line.pa + line.bf + line.g) > (m.pa + m.bf + m.g)) mine.spans[sk] = line; }
    }
    Object.assign(SPANS, d.spans || {}, SPANS);
    saveCareer(true); if (PAGE === 'stats') renderStats();
  } catch (e) { }
}

/* ---------- keys ---------- */
for (const t of Object.values(TEAMS)) for (const p of t.roster) p.ck = `${t.id}:${p.n}`;
function customCK(t, p) { if (!p.pid) p.pid = uid(); return `${t.id}:${p.pid}`; }
{ let made = false; for (const t of CUSTOM) for (const p of t.roster) { if (!p.pid) made = true; p.ck = customCK(t, p); } if (made) saveCustom(false); }
const ckOf = p => p && (p.ck || (p.src && p.src.ck)) || null;

/* ---------- during a game ---------- */
function abUse(p, id) { if (!p || !id) return; const s = pst(p); s.abil[id] = (s.abil[id] || 0) + 1; }
// credit the thrower when an out comes off his throw
function noteThrow(f) { if (PL) PL.lastThrow = { f, t: PL.t }; }
function creditOut(f, how) {
  if (!f) return; pst(f.p).po++;
  const lt = PL && PL.lastThrow; if (lt && lt.f !== f && PL.t - lt.t < 4 && how !== 'fly' && how !== 'robbed') pst(lt.f.p).a++;
}
// the batter's and pitcher's lines when a ball is put in play
function statInPlay(L, bat, batR, hit) {
  const bs = pst(bat), ps = pst(pitcher());
  bs.pa++; bs.ab++; ps.bf++;
  if (hit) {
    const bases = L.homer || batR.scored ? 4 : Math.round(batR.s);
    ps.ha++;
    if (bases === 2) bs.d++; else if (bases === 3) bs.t++; else if (bases === 4) { if (!L.homer) bs.hr++; ps.hra++; }
  }
  bs.rbi += L.runsThisPlay; ps.ra += L.runsThisPlay; ps.outsP += L.outs.length;
}
// at the final out: fold this game into every tracked monster's career
function commitCareer() {
  if (!G.teams || G.committed) return; G.committed = true;
  const span = G.season && S ? (ensureHist() && S.runId) : 'exh';
  if (!SPANS[span]) SPANS[span] = span === 'exh' ? { label: 'Exhibition games', started: Date.now() } : { label: `${S.club.name} season`, club: S.club.name, started: S.startedAt || Date.now(), cpu: !!S.cpu };
  if (span !== 'exh' && S) SPANS[span].cpu = !!S.cpu;
  const [a, h] = G.teams, winner = a.R > h.R ? a : h;
  for (const t of G.teams) {
    const appeared = [...t.def.roster, ...t.used];
    // pitching decision: the pitcher who recorded the most outs for each side
    const pitchers = appeared.filter(p => (G.pstats.get(p) || {}).bf > 0 || (G.pstats.get(p) || {}).outsP > 0);
    const dec = pitchers.sort((x, y) => (pst(y).outsP) - (pst(x).outsP))[0];
    if (dec) { if (t === winner) pst(dec).w++; else pst(dec).l++; }
    const starter = G.starters && G.starters[G.teams.indexOf(t)];
    for (const p of appeared) {
      const ck = ckOf(p); if (!ck) continue;
      const s = pst(p); s.g = 1; if (s.bf > 0 || s.outsP > 0 || s.pc > 0) s.gp = 1; if (p === starter) s.gs = 1;
      const src = p.src || p;
      const e = CAREER[ck] || (CAREER[ck] = { ck, spans: {} });
      Object.assign(e, { n: p.n, race: p.race, kind: p.kind, pos: src.pos === 'RP' ? 'P' : src.pos || p.pos, team: ck.startsWith('gen:') ? 'gen' : ck.split(':')[0], teamName: t.def.id === 'club' && S ? S.club.name : t.def.name, lastPlayed: Date.now() });
      addLine(e.spans[span] || (e.spans[span] = blankLine()), s);
    }
  }
  saveCareer();
}

/* ---------- formatting ---------- */
const rate3 = x => !isFinite(x) ? '—' : x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, '');
const ipStr = outs => `${Math.floor(outs / 3)}.${outs % 3}`;
function derived(L) {
  const ab = L.ab, pa = L.pa, singles = L.h - L.d - L.t - L.hr, ip = L.outsP / 3;
  return {
    avg: ab ? L.h / ab : NaN, obp: pa ? (L.h + L.bb + L.hbp) / pa : NaN, slg: ab ? (singles + 2 * L.d + 3 * L.t + 4 * L.hr) / ab : NaN,
    era: ip ? L.ra * 9 / ip : NaN, whip: ip ? (L.bba + L.ha) / ip : NaN, k9: ip ? L.k * 9 / ip : NaN, fpct: (L.po + L.a + L.e) ? (L.po + L.a) / (L.po + L.a + L.e) : NaN,
  };
}
function totalOf(e, span) { if (span && span !== 'career') return e.spans[span] || null; const t = blankLine(); for (const l of Object.values(e.spans)) addLine(t, l); return t; }
function careerBlurb(p) { // one line for rosters and the clubhouse
  if (!CAREER) return ''; const ck = ckOf(p), e = ck && CAREER[ck]; if (!e) return '';
  const L = totalOf(e), D = derived(L);
  const bat = L.ab ? `${rate3(D.avg)} AVG · ${L.hr} HR · ${L.rbi} RBI` : '';
  const pit = L.outsP ? `${L.w}–${L.l} · ${isFinite(D.era) ? D.era.toFixed(2) : '—'} ERA · ${L.k} K` : '';
  return `${L.g} G${bat ? ' · ' + bat : ''}${pit ? ' · ' + pit : ''}`;
}

/* ---------- the Stats page ---------- */
const STV = { club: 'ironmaw', view: 'bat', span: 'career', sort: null, dir: -1, open: {} };
const VIEWS = {
  bat: { label: 'Batting', cols: [['g', 'G'], ['pa', 'PA'], ['ab', 'AB'], ['r', 'R'], ['h', 'H'], ['d', '2B'], ['t', '3B'], ['hr', 'HR'], ['rbi', 'RBI'], ['bb', 'BB'], ['hbp', 'HBP'], ['so', 'SO'], ['sb', 'SB'], ['cs', 'CS'], ['avg', 'AVG'], ['obp', 'OBP'], ['slg', 'SLG'], ['ops', 'OPS']], def: 'ops', has: L => L.pa > 0 },
  pit: { label: 'Pitching', cols: [['gp', 'G'], ['gs', 'GS'], ['w', 'W'], ['l', 'L'], ['ip', 'IP'], ['bf', 'BF'], ['ha', 'H'], ['ra', 'R'], ['hra', 'HR'], ['bba', 'BB'], ['hbpP', 'HBP'], ['k', 'SO'], ['pk', 'PK'], ['pc', 'Pitches'], ['era', 'ERA'], ['whip', 'WHIP'], ['k9', 'K/9']], def: 'outsP', has: L => L.bf > 0 || L.outsP > 0 },
  fld: { label: 'Fielding', cols: [['g', 'G'], ['po', 'PO'], ['a', 'A'], ['e', 'E'], ['fpct', 'FPCT'], ['inj', 'Injuries'], ['ko', 'KOs']], def: 'po', has: L => L.g > 0 },
  abl: { label: 'Powers used', cols: [['g', 'G'], ['uses', 'Total'], ['magic', 'Magic'], ['skills', 'Skills'], ['ults', 'Ultimates'], ['hustle', 'Hustle'], ['top', 'Most used']], def: 'uses', has: L => L.g > 0 },
};
function cellVal(L, key) {
  const D = derived(L);
  const kinds = () => { let magic = 0, skills = 0, ults = 0, hustle = 0; for (const [id, n] of Object.entries(L.abil)) { const A = AB[id], P = PITCHES[id]; if (id === 'hustle') hustle += n; else if ((A && A.ult) || (P && P.ult)) ults += n; else if (A && A.phys) skills += n; else magic += n; } return { magic, skills, ults, hustle, uses: magic + skills + ults + hustle }; };
  switch (key) {
    case 'avg': case 'obp': case 'slg': return D[key];
    case 'ops': return D.obp + D.slg;
    case 'era': case 'whip': case 'k9': case 'fpct': return D[key];
    case 'ip': return L.outsP / 3;
    case 'uses': case 'magic': case 'skills': case 'ults': case 'hustle': return kinds()[key];
    case 'top': { const t = Object.entries(L.abil).sort((a, b) => b[1] - a[1])[0]; return t ? t : null; }
    default: return L[key] || 0;
  }
}
function cellHTML(L, key) {
  const v = cellVal(L, key);
  if (key === 'top') return v ? `${esc(abName(v[0]))} ×${v[1]}` : '—';
  if (['avg', 'obp', 'slg', 'ops', 'fpct'].includes(key)) return rate3(v);
  if (['era', 'whip', 'k9'].includes(key)) return isFinite(v) ? v.toFixed(2) : '—';
  if (key === 'ip') return ipStr(L.outsP);
  return String(v);
}
const abName = id => id.startsWith('gear:') ? (GEAR[id.slice(5)] || {}).name || id : id === 'hustle' ? 'Hustle' : AB[id] ? AB[id].name : PITCHES[id] ? PITCHES[id].name : id;
function clubsWithStats() {
  const clubs = [...Object.values(TEAMS).map(t => ({ id: t.id, name: t.name, color: t.color })), ...CUSTOM.map(t => ({ id: t.id, name: t.name + ' ★', color: t.color }))];
  if (Object.values(CAREER).some(e => e.team === 'gen')) clubs.push({ id: 'gen', name: 'Signed in seasons', color: '#c9c2ad' });
  return clubs;
}
function renderStats() {
  const el = document.getElementById('stats'); if (!el) return;
  const clubs = clubsWithStats(); if (!clubs.some(c => c.id === STV.club)) STV.club = clubs[0].id;
  const V = VIEWS[STV.view], entries = Object.values(CAREER).filter(e => e.team === STV.club);
  const spansHere = [...new Set(entries.flatMap(e => Object.keys(e.spans)))].sort((a, b) => (SPANS[b]?.started || 0) - (SPANS[a]?.started || 0));
  if (STV.span !== 'career' && !spansHere.includes(STV.span)) STV.span = 'career';
  const rows = entries.map(e => ({ e, L: totalOf(e, STV.span) })).filter(r => r.L && V.has(r.L));
  const sortKey = STV.sort && V.cols.some(c => c[0] === STV.sort) ? STV.sort : V.def;
  rows.sort((a, b) => { const x = cellVal(a.L, sortKey), y = cellVal(b.L, sortKey); const nx = typeof x === 'number' && isFinite(x) ? x : -1e9, ny = typeof y === 'number' && isFinite(y) ? y : -1e9; return (ny - nx) * -STV.dir; });
  // league leaders across every tracked monster, career
  const all = Object.values(CAREER).map(e => ({ e, L: totalOf(e) }));
  const leader = (lbl, fn, fmt, min) => { const c = all.filter(x => min(x.L)).sort((a, b) => fn(b.L) - fn(a.L))[0]; return c && isFinite(fn(c.L)) && fn(c.L) > 0 ? `<div class="chip"><em>${lbl}</em>${fmt(fn(c.L))} <span class="sub">${esc(c.e.n)}</span></div>` : ''; };
  const eraLeader = (() => { const c = all.filter(x => x.L.outsP >= 27).sort((a, b) => derived(a.L).era - derived(b.L).era)[0]; return c ? `<div class="chip"><em>Best ERA (9+ IP)</em>${derived(c.L).era.toFixed(2)} <span class="sub">${esc(c.e.n)}</span></div>` : ''; })();
  const opt = (v, cur, lbl) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(lbl)}</option>`;
  el.innerHTML = `
    <h2 class="pgh">Stats</h2>
    <p class="lede2">Box-score numbers for every monster: each season run, exhibition games, and whole careers. Pick a club and a span; click a column to sort and a name for the season-by-season breakdown and the powers used. Kept in this browser${Cloud.ready ? ' and your claude.ai account' : ''}.</p>
    ${all.length ? `<div class="chips" style="margin-bottom:16px">
      ${leader('Career AVG (20+ AB)', L => derived(L).avg, rate3, L => L.ab >= 20)}${leader('Home runs', L => L.hr, String, () => true)}${leader('RBI', L => L.rbi, String, () => true)}
      ${leader('Hits', L => L.h, String, () => true)}${leader('Wins', L => L.w, String, () => true)}${leader('Strikeouts', L => L.k, String, () => true)}${eraLeader}
      ${leader('Powers used', L => cellVal(L, 'uses'), String, () => true)}</div>` : ''}
    <div class="st-controls">
      <label>Club <select data-st="club">${clubs.map(c => opt(c.id, STV.club, c.name)).join('')}</select></label>
      <label>Span <select data-st="span">${opt('career', STV.span, 'Career (all games)')}${spansHere.map(k => opt(k, STV.span, spanLabel(k))).join('')}</select></label>
      <div class="seg st-views">${Object.entries(VIEWS).map(([k, v]) => `<button class="buy${k === STV.view ? ' on' : ''}" data-st-view="${k}">${v.label}</button>`).join('')}</div>
    </div>
    ${rows.length ? `<div class="tablewrap"><table class="cat st-table"><thead><tr><th>Player</th>${V.cols.map(([k, l]) => `<th><button class="st-sort${k === sortKey ? ' on' : ''}" data-st-sort="${k}">${l}${k === sortKey ? (STV.dir < 0 ? ' ▼' : ' ▲') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(({ e, L }) => `<tr class="st-row" data-st-open="${esc(e.ck)}"><td><b>${esc(e.n)}</b><div class="sub">${esc(e.race || '')}${e.pos ? ' · ' + e.pos : ''}</div></td>${V.cols.map(([k]) => `<td>${cellHTML(L, k)}</td>`).join('')}</tr>
        ${STV.open[e.ck] ? `<tr class="st-detail"><td colspan="${V.cols.length + 1}">${playerBreakdown(e)}</td></tr>` : ''}`).join('')}</tbody></table></div>`
      : `<div class="card"><p class="sub">No ${V.label.toLowerCase()} numbers for this club${STV.span !== 'career' ? ' in this span' : ''} yet. Stats are recorded at the final out of every game: exhibitions, season games you play, and CPU seasons.</p></div>`}`;
}
function spanLabel(k) { const s = SPANS[k]; if (!s) return k; if (k === 'exh') return s.label; return `${s.label}${s.cpu ? ' (CPU)' : ''} · ${new Date(s.started).toLocaleDateString()}`; }
function playerBreakdown(e) {
  const spans = Object.keys(e.spans).sort((a, b) => (SPANS[a]?.started || 0) - (SPANS[b]?.started || 0));
  const tot = totalOf(e);
  const row = (lbl, L) => { const D = derived(L); return `<tr><td>${esc(lbl)}</td><td>${L.g}</td><td>${L.ab}</td><td>${L.h}</td><td>${L.hr}</td><td>${L.rbi}</td><td>${rate3(D.avg)}</td><td>${rate3(D.obp + D.slg)}</td><td>${L.outsP ? ipStr(L.outsP) : '—'}</td><td>${L.outsP ? `${L.w}–${L.l}` : '—'}</td><td>${isFinite(D.era) ? D.era.toFixed(2) : '—'}</td><td>${L.k || '—'}</td><td>${L.po + L.a}/${L.e}</td><td>${cellVal(L, 'uses')}</td></tr>`; };
  const abs = Object.entries(tot.abil).sort((a, b) => b[1] - a[1]);
  return `<div class="st-break"><table class="cat"><thead><tr><th>Span</th><th>G</th><th>AB</th><th>H</th><th>HR</th><th>RBI</th><th>AVG</th><th>OPS</th><th>IP</th><th>W–L</th><th>ERA</th><th>SO (P)</th><th>Chances/E</th><th>Powers</th></tr></thead>
    <tbody>${spans.map(k => row(spanLabel(k), e.spans[k])).join('')}<tr class="st-tot">${row('Career', tot).slice(4)}</tbody></table>
    <p class="sub"><b>Powers used:</b> ${abs.length ? abs.map(([id, n]) => `<span class="tg ${id === 'hustle' ? 'tg-hustle' : (AB[id] && AB[id].ult) || (PITCHES[id] && PITCHES[id].ult) ? 'tg-ult' : AB[id] && AB[id].phys ? 'tg-skill' : AB[id] && AB[id].club ? 'tg-club' : 'tg-magic'}">${esc(abName(id))} ×${n}</span>`).join(' ') : 'none yet'}${tot.inj ? ` · <span class="warnt">${tot.inj} injur${tot.inj === 1 ? 'y' : 'ies'}${tot.ko ? `, ${tot.ko} knockout${tot.ko === 1 ? '' : 's'}` : ''}</span>` : ''}</p>
    <p class="sub">Last team: ${esc(e.teamName || '')} · last played ${e.lastPlayed ? new Date(e.lastPlayed).toLocaleDateString() : '—'}</p></div>`;
}
document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('#stats [data-st]'); if (!s) return; STV[s.dataset.st] = s.value; if (s.dataset.st === 'club') STV.span = 'career'; renderStats(); });
document.addEventListener('click', e => {
  const v = e.target.closest && e.target.closest('#stats [data-st-view]'); if (v) { STV.view = v.dataset.stView; STV.sort = null; STV.dir = -1; renderStats(); return; }
  const s = e.target.closest && e.target.closest('#stats [data-st-sort]'); if (s) { const k = s.dataset.stSort, cur = STV.sort || VIEWS[STV.view].def; if (cur === k) STV.dir *= -1; else STV.dir = ['era', 'whip', 'l', 'e', 'so', 'bba', 'ha', 'ra', 'hra', 'hbpP', 'inj', 'ko'].includes(k) ? 1 : -1; STV.sort = k; renderStats(); return; }
  const o = e.target.closest && e.target.closest('#stats [data-st-open]'); if (o) { const k = o.dataset.stOpen; STV.open[k] = !STV.open[k]; renderStats(); }
});
// seasons saved before stats existed: give their players career keys
function backfillCK() { if (!S || !S.players) return; const home = getTeam(S.teamId); for (const p of S.players) if (!p.ck) { const src = home && home.roster.find(q => q.n === p.n && q.kind === p.kind); p.ck = src && src.ck ? src.ck : 'gen:' + p.id; } }
backfillCK();
renderStats(); renderBestiary();
