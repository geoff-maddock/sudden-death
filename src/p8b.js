/* p8b: stat sheets — the line and each player, game by game and across runs */
const PCOL = ['#ffb347', '#7fd6ff', '#d2a6ff', '#7fe08a', '#ff8a7a'];
// a small SVG line chart: series = [{ name, col, pts: [numbers], dash }]
function lineChart(series, labels, o = {}) {
  const W = o.w || 680, H = o.h || 230, L = 44, Rt = 12, T = 14, Bt = 30;
  const n = Math.max(1, ...series.map(s => s.pts.length));
  const max = Math.max(1, ...series.flatMap(s => s.pts));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const x = i => L + (n === 1 ? (W - L - Rt) / 2 : i * (W - L - Rt) / (n - 1)), y = v => T + (H - T - Bt) * (1 - v / nice);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = nice * k / 4; g += `<line x1="${L}" x2="${W - Rt}" y1="${y(v)}" y2="${y(v)}" stroke="#3e2f25" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="#7f6d5a" font-family="Jersey 10, monospace">${Math.round(v)}</text>`; }
  const step = Math.max(1, Math.ceil(n / 14));
  for (let i = 0; i < n; i += step) g += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#7f6d5a" font-family="Jersey 10, monospace">${esc(labels ? labels[i] || '' : i + 1)}</text>`;
  for (const s of series) {
    if (!s.pts.length) continue;
    const d = s.pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    g += `<path d="${d}" fill="none" stroke="${s.col}" stroke-width="${s.dash ? 2 : 2.5}" ${s.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round"/>`;
    g += s.pts.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${s.dash ? 2.5 : 3.5}" fill="${s.col}"><title>${esc(s.name)}, ${labels ? labels[i] : 'game ' + (i + 1)}: ${v}</title></circle>`).join('');
  }
  const leg = series.map(s => `<span style="display:inline-flex;gap:6px;align-items:center;margin-right:14px"><i style="display:inline-block;width:18px;height:3px;background:${s.col};${s.dash ? 'background:repeating-linear-gradient(90deg,' + s.col + ' 0 5px,transparent 5px 9px)' : ''}"></i>${esc(s.name)}</span>`).join('');
  return `<div class="chart"><div class="legend2">${leg}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Chart')}">${g}</svg></div>`;
}
// the season stat sheet for a run
function statSheet(games, party, me, opts = {}) {
  const metric = opts.metric || 'd', T = seasonTotals(games), members = party.map((p, i) => ({ ...p, col: PCOL[i] }));
  const series = members.map(m => ({ name: m.n, col: m.col, pts: games.map(g => ((g.ps || {})[m.kind] || {})[metric] || 0) }));
  series.push({ name: 'The line', col: '#efe4cc', dash: 1, pts: games.map(g => Object.values(g.ps || {}).reduce((s, o) => s + (o[metric] || 0), 0)) });
  const labels = games.map((g, i) => `${i + 1}`);
  const line = T.line, all = Object.entries(T).reduce((a, [k, o]) => { for (const s of Object.keys(STAT_KEYS)) a[s] += o[s] || 0; return a; }, { c: 0, d: 0, b: 0, k: 0, p: 0 });
  const n = Math.max(1, games.length);
  const card = (m, t) => `<div class="pcard" style="--pc:${m.col}"><div style="display:flex;gap:10px;align-items:center">${m.img ? `<img src="${m.img}" alt="" width="52" height="52">` : ''}<div><strong>${esc(m.n)}</strong><span class="k">${esc(m.sub || '')}</span></div></div>
    <dl class="pstats"><dt>Damage</dt><dd>${t.d || 0}<small>${Math.round((t.d || 0) / n)}/game</small></dd><dt>Block</dt><dd>${t.b || 0}<small>${Math.round((t.b || 0) / n)}/game</small></dd><dt>Points</dt><dd>${t.p || 0}</dd><dt>Kills</dt><dd>${t.k || 0}</dd><dt>Cards</dt><dd>${t.c || 0}</dd>${m.kind !== 'line' ? `<dt>MVP</dt><dd>${t.mvp || 0}<small>games</small></dd><dt>Best game</dt><dd>${t.best || 0}<small>dmg</small></dd>` : ''}</dl>
    ${m.kind !== 'line' ? `<div class="share"><i style="width:${all.d ? Math.round(100 * (t.d || 0) / all.d) : 0}%"></i></div><small class="hint">${all.d ? Math.round(100 * (t.d || 0) / all.d) : 0}% of the line’s damage</small>` : ''}</div>`;
  const team = { color: CLUBS[opts.club || RUN.club].color, light: CLUBS[opts.club || RUN.club].light, short: me };
  return `<div class="filters" role="group" aria-label="Stat to chart">${Object.entries(STAT_KEYS).map(([k, nm]) => `<button data-metric="${k}" aria-pressed="${k === metric}">${nm}</button>`).join('')}</div>
    ${games.length ? lineChart(series, labels, { label: `${STAT_KEYS[metric]} per game` }) : '<p class="hint">No games yet.</p>'}
    <p class="hint" style="margin:2px 0 10px">${STAT_KEYS[metric]} per game, by player. The dashed line is the whole line, including damage from Plague, Burn, trophies and the field.</p>
    <div class="pcards">${members.map(m => card({ ...m, img: portraitURL(m.kind, team, m.num, 76), sub: `${KIND_NAME[m.kind]}, #${m.num}` }, T[m.kind] || {})).join('')}
    ${card({ n: 'The line', kind: 'line', col: '#efe4cc', sub: 'All three, plus everything else' }, Object.assign({}, all, { mvp: 0 }))}</div>`;
}
function showStats(games, party, me, title, club) {
  let metric = 'd';
  const draw = () => {
    $('modalBox').innerHTML = `<header><h3>${esc(title)}</h3><button class="ghost" data-close>Close</button></header>${statSheet(games, party, me, { metric, club })}`;
    $('modalBox').querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { metric = b.dataset.metric; draw(); });
  };
  modal(''); draw();
}
// careers on the Records page
function careersHTML() {
  const C = Object.values(loadCareers());
  if (!C.length) return '<p class="hint">Player careers start counting with your next finished run.</p>';
  C.sort((a, b) => b.d - a.d);
  return `<div class="tablewrap"><table class="season"><thead><tr><th>Player</th><th>Runs</th><th>Cups</th><th>Games</th><th>Damage</th><th>Per game</th><th>Block</th><th>Points</th><th>Kills</th><th>MVP</th><th>Best game</th><th>Trend</th></tr></thead><tbody>${C.map((c, i) => {
    const club = CLUBS[c.club], spark = c.hist.length > 1 ? (() => { const mx = Math.max(1, ...c.hist.map(h => h.g ? h.d / h.g : 0)); return `<svg viewBox="0 0 80 22" width="80" height="22">${'<path d="' + c.hist.map((h, j) => `${j ? 'L' : 'M'}${(j * 78 / (c.hist.length - 1) + 1).toFixed(1)} ${(20 - 18 * (h.g ? h.d / h.g : 0) / mx).toFixed(1)}`).join(' ') + `" fill="none" stroke="${club.color}" stroke-width="2"/>`}</svg>`; })() : '';
    return `<tr><td><button class="plink" data-career="${esc(c.club + ':' + c.n)}"><img src="${portraitURL(c.kind, club, c.num, 40)}" alt="" width="30" height="30"> <b>${esc(c.n)}</b></button><br><small>${esc(club.short)} ${KIND_NAME[c.kind]}</small></td><td>${c.runs}</td><td>${c.cups}</td><td>${c.games}</td><td>${c.d}</td><td>${c.games ? Math.round(c.d / c.games) : 0}</td><td>${c.b}</td><td>${c.p}</td><td>${c.k}</td><td>${c.mvp}</td><td>${c.best}</td><td>${spark}</td></tr>`;
  }).join('')}</tbody></table></div><p class="hint">Click a player for their run-by-run chart. Trend is damage per game across their runs.</p>`;
}
function showCareer(key) {
  const c = loadCareers()[key]; if (!c) return;
  let metric = 'd';
  const draw = () => {
    const pts = c.hist.map(h => h.g ? Math.round((h[metric] || 0) / h.g * 10) / 10 : 0), tot = c.hist.map(h => h[metric] || 0);
    $('modalBox').innerHTML = `<header><h3>${esc(c.n)}, ${esc(CLUBS[c.club].name)} ${KIND_NAME[c.kind]}</h3><button class="ghost" data-close>Close</button></header>
      <div class="endstats"><div><b>${c.runs}</b>runs</div><div><b>${c.cups}</b>Cups</div><div><b>${c.games}</b>games</div><div><b>${c.d}</b>damage</div><div><b>${c.p}</b>points</div><div><b>${c.mvp}</b>MVP games</div><div><b>${c.best}</b>best game</div></div>
      <div class="filters">${Object.entries(STAT_KEYS).map(([k, nm]) => `<button data-metric="${k}" aria-pressed="${k === metric}">${nm}</button>`).join('')}</div>
      ${lineChart([{ name: `${STAT_KEYS[metric]} per game`, col: CLUBS[c.club].color === '#9b6bff' ? '#d2a6ff' : CLUBS[c.club].color, pts }], c.hist.map((h, i) => `R${i + 1}${h.cup ? '★' : ''}`), { label: `${c.n} by run` })}
      <p class="hint">${STAT_KEYS[metric]} per game in each run, oldest first. ★ marks a Cup win.</p>
      <div class="tablewrap"><table class="season"><thead><tr><th>Run</th><th>Date</th><th>Games</th><th>${STAT_KEYS[metric]}</th><th>Per game</th><th>Result</th></tr></thead><tbody>${c.hist.map((h, i) => `<tr class="${h.cup ? 'won' : ''}"><td>${i + 1}</td><td>${new Date(h.when).toLocaleDateString()}</td><td>${h.g}</td><td>${tot[i]}</td><td>${pts[i]}</td><td>${h.cup ? '<b>Won the Cup</b>' : 'Fell'}</td></tr>`).reverse().join('')}</tbody></table></div>`;
    $('modalBox').querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { metric = b.dataset.metric; draw(); });
  };
  modal(''); draw();
}
