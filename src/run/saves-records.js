/* ---------- saves and records ---------- */
function saveRun() { if (LAB) return; try { localStorage.setItem(pkey('sd-run'), JSON.stringify(RUN)); } catch (e) { } }
function loadRun() { try { const r = JSON.parse(localStorage.getItem(pkey('sd-run')) || 'null'); return r && r.v === 1 && !r.over ? r : null; } catch (e) { return null; } }
function clearRun() { try { localStorage.removeItem(pkey('sd-run')); } catch (e) { } }
function loadRecords() { try { return JSON.parse(localStorage.getItem(pkey('sd-records')) || 'null') || { runs: [] }; } catch (e) { return { runs: [] }; } }
function runScore(r) { return Math.round(diffOf(r).score * ((r.floorsCleared || r.act * (FLOORS + 1) + r.floor) * 5 + r.stats.elites * 25 + r.stats.bosses * 100 + Math.floor(r.stats.gold / 10) + (r.style || 0) + (r.over === 'win' ? 250 : 0))); }
function recordRun(result) {
  try { achRun(result); } catch (e) { console.error(e); }
  if (!LAB) try { updateCareers(result); } catch (e) { console.error(e); }
  RUN.over = result; RUN.floorsCleared = RUN.act * (FLOORS + 1) + RUN.floor;
  if (LAB) return;
  const rec = loadRecords();
  rec.runs.unshift({ when: Date.now(), diff: diffOf(RUN) === DIFFS[1] ? undefined : DIFFS.indexOf(diffOf(RUN)), club: RUN.club, party: RUN.party.map(p => [p.n, p.kind]), result, act: RUN.act, floor: RUN.floor, score: runScore(RUN), killer: result === 'lose' && B ? B.enemies.filter(e => !e.dead).map(e => e.n).join(', ') : '', relics: RUN.relics.slice(), deck: RUN.deck.length, sportsWins: RUN.stats.sportsWins || 0, style: RUN.style || 0, games: (RUN.games || []).map(g => ({ a: g.act, s: g.sport, t: g.type, u: g.us, h: g.them, o: g.opp, w: g.won ? 1 : 0, f: g.fell ? 1 : 0, l: g.hl, st: g.strokes, p: g.par, k: g.strike ? 1 : 0, n: g.turns, x: g.foes, q: g.q, ps: g.ps, m: g.mvp })) });
  rec.runs = rec.runs.slice(0, 50);
  try { localStorage.setItem(pkey('sd-records'), JSON.stringify(rec)); } catch (e) { }
  clearRun();
}
