/* ================= CPU-managed seasons: watch or simulate a whole run ================= */
// S.cpu: the CPU runs the clubhouse between games and plays both sides of every game.
// S.autoNext: after each result, the next game starts by itself.

/* ---------- game speed while watching CPU games ---------- */
G.speed = 1;
const allCPU = () => G.teams && G.teams.every(t => t.ctl === 'cpu');
let SPEEDBAR_ON = null;
function syncSpeedbar() {
  const on = !!(allCPU() && G.phase !== 'menu' && G.phase !== 'over');
  if (on !== SPEEDBAR_ON) { SPEEDBAR_ON = on; const el = document.getElementById('speedbar'); if (el) el.hidden = !on; if (!on) G.speed = 1; else { G.speed = (typeof SET !== 'undefined' && SET.cpuSpeed) || 1; document.querySelectorAll('#speedbar [data-speed]').forEach(x => x.setAttribute('aria-pressed', x.dataset.speed === String(G.speed))); } }
}
function simToEnd(quiet) {
  const was = G.sim; G.sim = !!quiet;
  for (let n = 0; G.phase !== 'over' && G.phase !== 'menu' && n < 60 * 60 * 90; n++) { update(1 / 30, 1 / 30); INP.p1.p = {}; INP.p2.p = {}; }
  G.sim = was;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#speedbar [data-speed]'); if (!b) return;
  const v = b.dataset.speed;
  if (v === 'end') { if (allCPU()) simToEnd(false); return; }
  G.speed = +v; document.querySelectorAll('#speedbar [data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b));
});

/* ---------- the CPU manager: what it does in the clubhouse before each game ---------- */
function cpuManage() {
  if (!S || !S.active) return;
  const moves = [];
  const starters = () => S.lineup.map(l => SP(l.id));
  // 1. stat points: fix weak spots first, then build to the role
  for (const p of S.players) {
    let guard = 0;
    while (p.pts > 0 && guard++ < 20) {
      const pref = p.pitches ? ['arm', 'fld', 'con', 'pow', 'spd'] : p.pos === 'C' || p.pos === 'SS' || p.pos === '2B' ? ['fld', 'con', 'spd', 'arm', 'pow'] : p.pos === 'CF' || p.pos === 'LF' || p.pos === 'RF' ? ['spd', 'con', 'pow', 'fld', 'arm'] : ['pow', 'con', 'fld', 'spd', 'arm'];
      const weak = STATS.filter(s => p[s] <= 3 && p[s] < STAT_CAP).sort((a, b) => p[a] - p[b]);
      const s = weak[0] || pref.find(k => p[k] < STAT_CAP && p[k] < 9) || pref.find(k => p[k] < STAT_CAP);
      if (!s) break; p[s]++; p.pts--; moves.push(`${p.n} +1 ${s.toUpperCase()}`);
    }
  }
  // 2. essence: deepen the mana well once, then enhance the best powers of the lineup
  if (S.font < 1 && S.essence >= 6) { S.essence -= 6; S.font++; moves.push('deepened the mana well'); }
  for (let guard = 0; guard < 6; guard++) {
    const cands = [];
    for (const p of starters()) for (const type of ['bat', 'run', 'field', 'pitch']) {
      const has = type === 'pitch' ? p.pitches && p.pitches.some(k => PITCHES[k].magic) : p[type] && !AB[p[type]].passive;
      const t = p.tiers[type] || 1, cost = t === 1 ? 3 : 6;
      if (has && t < 3 && S.essence >= cost) cands.push({ p, type, cost, t });
    }
    if (!cands.length) break;
    const c = cands.sort((a, b) => a.t - b.t || pval(b.p) - pval(a.p))[0];
    S.essence -= c.cost; c.p.tiers[c.type] = c.t + 1; moves.push(`${c.p.n}'s ${c.type === 'pitch' ? 'magic pitches' : AB[c.p[c.type]].name} to tier ${'I'.repeat(c.t + 1)}`);
  }
  const mk = S.market;
  // 3. rest when the club is worn out
  const avgSta = starters().reduce((a, p) => a + p.sta, 0) / 9, avgHp = starters().reduce((a, p) => a + (p.hp ?? 100), 0) / 9;
  if (mk && !mk.shrineUsed && S.gold >= 25 && (avgSta < 55 || avgHp < 60)) { S.gold -= 25; mk.shrineUsed = true; for (const p of S.players) { p.sta = Math.min(100, p.sta + 35); p.hp = Math.min(100, (p.hp ?? 100) + 30); } moves.push('held a recovery ritual'); }
  // 4. free agents who beat a starter at their position
  if (mk) for (let i = 0; i < mk.agents.length; i++) {
    const ag = mk.agents[i]; if (ag.signed || S.gold < ag.price + 15 || S.bench.length >= BENCH_MAX) continue;
    const slot = S.lineup.find(l => l.pos === ag.p.pos), cur = slot && SP(slot.id);
    if (cur && pval(ag.p) > pval(cur) + 4) {
      S.gold -= ag.price; ag.signed = true; const np = { ...ag.p, id: uid() }; np.ck = 'gen:' + np.id; S.players.push(np);
      slot.id = np.id; S.bench.push(cur.id); moves.push(`signed ${np.n} (${np.pos}) to replace ${cur.n}`);
      if (S.bench.length > BENCH_MAX) { const worst = S.bench.map(SP).filter(p => !p.pitches || S.bench.map(SP).filter(q => q.pitches).length > 1).sort((a, b) => pval(a) - pval(b))[0]; if (worst) { S.bench = S.bench.filter(id => id !== worst.id); S.players = S.players.filter(p => p.id !== worst.id); S.gold += 10; moves.push(`released ${worst.n}`); } }
    }
  }
  // 5. trades that clearly help
  if (mk) for (let i = 0; i < mk.trades.length; i++) {
    const tr = mk.trades[i]; if (tr.done) continue;
    const club = S.opp.find(o => o.id === tr.club), th = club && club.roster.find(p => p.id === tr.theirs), yo = SP(tr.yours);
    if (th && yo && S.game >= 1 && pval(th) > pval(yo) * 1.15) { actSeasonQuiet('trade', String(i)); moves.push(`traded ${yo.n} for ${th.n}`); }
  }
  // 6. items: buy what's affordable, give it to the best player without one
  if (mk) for (let i = 0; i < mk.items.length; i++) { const m = mk.items[i], it = ITEMS[m.k]; if (!m.sold && S.gold >= it.price + 20) { S.gold -= it.price; m.sold = true; S.inv.push(m.k); moves.push(`bought the ${it.name}`); } }
  while (S.inv.length) { const p = starters().filter(x => !x.item).sort((a, b) => pval(b) - pval(a))[0]; if (!p) break; p.item = S.inv.shift(); moves.push(`gave ${p.n} the ${ITEMS[p.item].name}`); }
  { const gb = cpuShop('club'); for (const g of gb) moves.push(g.startsWith('equipped') ? g : `bought the ${g}`); }
  // 7. rest the exhausted: a fresher bench player takes the spot (pitchers swap with the bullpen)
  for (const l of S.lineup) {
    const p = SP(l.id); if (p.sta >= 35 && (p.hp ?? 100) >= 40 && !injuredOut(p)) continue;
    const hurtNow = injuredOut(p), pool = S.bench.map(SP).filter(b => b.sta > (hurtNow ? 30 : 70) && (b.hp ?? 100) > (hurtNow ? SIT_HP : 60) && !injuredOut(b) && (l.pos === 'P' ? !!b.pitches : !b.pitches || S.bench.map(SP).filter(q => q.pitches).length > 1));
    const sub = pool.sort((a, b) => (b.pos === l.pos) - (a.pos === l.pos) || pval(b) - pval(a))[0];
    if (sub) { S.bench[S.bench.indexOf(sub.id)] = p.id; l.id = sub.id; moves.push(`rested ${p.n}, started ${sub.n} at ${l.pos}`); }
  }
  // make sure the lineup is still legal
  if (lineupProblems().length) { const pl = S.lineup.find(l => l.pos === 'P'); if (pl && !SP(pl.id).pitches) { const pb = S.bench.map(SP).find(b => b.pitches); if (pb) { S.bench[S.bench.indexOf(pb.id)] = pl.id; pl.id = pb.id; } } }
  if (moves.length) seasonLog(`CPU manager: ${moves.slice(0, 8).join('; ')}${moves.length > 8 ? ` and ${moves.length - 8} more` : ''}.`);
  saveSeason();
  return moves;
}
function actSeasonQuiet(act, a, b) { const rc = renderClub; renderClub = () => { }; try { actSeason(act, a, b); } finally { renderClub = rc; } }

/* ---------- playing and simulating CPU season games ---------- */
function cpuNextGame(mode, managed) { // 'watch' | 'sim'
  if (!S || !S.active) return;
  S.cpu = true; if (!managed) cpuManage();
  if (mode === 'sim') {
    startSeasonGame(true); simToEnd(true);
    if (G.phase === 'over') { G.phase = 'menu'; try { clearGameUI(); } catch (e) { } document.getElementById('menu').hidden = false; document.getElementById('sOver').hidden = true; }
    if (G.phase === 'over' && S && S.live) { /* the result hook already ran */ }
    renderClub(); updateSeasonTab(); if (PAGE === 'records') renderRecords();
  } else startSeasonGame();
}
let SIM_RUNNING = false;
function simRestOfSeason() {
  if (!S || !S.active || SIM_RUNNING) return;
  SIM_RUNNING = true; S.cpu = true; renderClub();
  const step = () => {
    if (!S || !S.active || !SIM_RUNNING) { SIM_RUNNING = false; renderClub(); return; }
    cpuNextGame('sim');
    setTimeout(step, 60);
  };
  setTimeout(step, 30);
}
// after a watched CPU game, carry on by itself if asked
function cpuAfterResult() {
  if (!S || !S.active || !S.cpu || !S.autoNext || G.sim) return;
  setTimeout(() => {
    if (!S || !S.active || !S.cpu || !S.autoNext || G.phase === 'plate' || G.phase === 'play') return;
    document.getElementById('sOver').hidden = true; cpuBetweenGames();
  }, 2500);
}

/* ---------- between watched games: the CPU manager visibly works the clubhouse ---------- */
// The Clubhouse opens, the manager's moves appear one by one (stat points, powers, rest, signings,
// trades, items and gear), then the next game starts after a short countdown.
var CPU_MGR = null;
function cpuBetweenGames(go) {
  if (!S || !S.active || !S.cpu) return;
  if (G.phase === 'over') { G.phase = 'menu'; clearGameUI(); document.getElementById('menu').hidden = false; }
  document.getElementById('sOver').hidden = true;
  const raw = cpuManage() || [], moves = [];
  for (const m of raw) { // "Snikt +1 CON" twice reads better as "Snikt +2 CON"
    const k = /^(.*) \+1 ([A-Z]+)$/.exec(m), prev = moves[moves.length - 1];
    if (k && prev && prev.k === k[1] + '|' + k[2]) { prev.n++; prev.t = `${k[1]} +${prev.n} ${k[2]}`; }
    else moves.push(k ? { k: k[1] + '|' + k[2], n: 1, t: m } : { t: m });
  }
  moves.forEach((m, i) => { moves[i] = m.t; });
  CPU_MGR = { moves: moves.length ? moves : ['Looked over the roster: nothing worth changing today.'], shown: 0, count: null, game: S.game, go: !!go };
  try { history.replaceState(null, '', '#season'); } catch (e) { }
  showPage('season'); renderClub(); mgrCard();
  mgrTick();
}
function mgrTick() {
  const M = CPU_MGR; if (!M) return;
  if (!S || !S.active || !S.cpu || S.game !== M.game) { CPU_MGR = null; return; }
  if (M.shown < M.moves.length) { M.shown++; mgrCard(); setTimeout(mgrTick, 650); return; }
  if (!S.autoNext && !M.go) { M.count = null; M.done = true; mgrCard(); return; } // waits for "Watch game"
  if (M.count == null) M.count = M.go ? 2 : 4;
  M.count--; mgrCard();
  if (M.count <= 0) { CPU_MGR = null; if (PAGE === 'season' || PAGE === 'play') cpuNextGame('watch', true); else mgrCard(); return; }
  setTimeout(mgrTick, 1000);
}
{ const rc0 = renderClub; renderClub = function () { rc0.apply(this, arguments); try { if (CPU_MGR) mgrCard(); } catch (e) { } }; }
function mgrCard() {
  const club = document.getElementById('club'); if (!club || PAGE !== 'season') return;
  let el = document.getElementById('cpuMgr');
  const M = CPU_MGR;
  if (!M) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('section'); el.id = 'cpuMgr'; el.className = 'card cpumgr'; const h = club.querySelector('.clubhead') || club.firstElementChild; if (h && h.nextSibling) club.insertBefore(el, h.nextSibling); else club.prepend(el); }
  const list = M.moves.slice(0, M.shown).map((m, i) => `<li class="${i === M.shown - 1 ? 'new' : ''}">${esc(m[0].toUpperCase() + m.slice(1))}</li>`).join('');
  const busy = M.shown < M.moves.length;
  el.innerHTML = `<h4>CPU manager ${busy ? 'at work<span class="dots">…</span>' : 'is done'}</h4><ul class="mgrlist">${list}</ul>
    <p class="sub">${busy ? `Gold ${S.gold} · essence ${S.essence}` : M.count != null ? `Game ${S.game + 1} starts in ${M.count}…` : `Press Watch game ${S.game + 1} when you're ready, or tick "Keep going" to carry on by itself.`}</p>`;
}
