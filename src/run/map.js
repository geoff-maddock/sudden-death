/* ---------- the map: StS-style branching paths, bottom to top ---------- */
const MAP_W = 7;
// The map is built in two passes. First the shape: six walks up the grid that may merge but never cross,
// spread across at least three starting columns. Then the rooms: typed by floor band, then checked path by
// path and repaired until every route is fair (enough rests, fights, shops or events; a sane number of
// elites) while the routes still differ (one safe-ish, one greedy). A map that cannot be repaired is redrawn.
function mapShape() {
  const nodes = {}, key = (r, c) => r + '_' + c, edges = [];
  const crosses = (r, a, b) => edges.some(([r2, c1, c2]) => r2 === r && ((c1 < a && c2 > b) || (c1 > a && c2 < b)));
  let starts;
  do { starts = []; for (let i = 0; i < 6; i++) starts.push((R() * MAP_W) | 0); } while (new Set(starts).size < 3 || starts[0] === starts[1]);
  const use = {};
  for (const s of starts) {
    let c = s;
    for (let r = 0; r < FLOORS; r++) {
      const k = key(r, c); nodes[k] = nodes[k] || { k, r, c, t: null, next: [] };
      use[k] = (use[k] || 0) + 1;
      if (r === FLOORS - 1) { if (!nodes[k].next.includes('boss')) nodes[k].next.push('boss'); break; }
      // drift, nudged away from crowded columns so paths spread out, and kept off the edges a little
      const opts = [-1, 0, 1].map(d => clamp(c + d, 0, MAP_W - 1)).filter((v, i, a) => a.indexOf(v) === i);
      const w = opts.map(nc => (use[key(r + 1, nc)] ? .45 : 1) * (nc === 0 || nc === MAP_W - 1 ? .7 : 1) * (nc === c ? .8 : 1));
      let nc = opts[0], t = R() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < opts.length; i++) { t -= w[i]; if (t <= 0) { nc = opts[i]; break; } }
      if (crosses(r, c, nc)) nc = c;
      const nk = key(r + 1, nc);
      if (!nodes[k].next.includes(nk)) { nodes[k].next.push(nk); edges.push([r, c, nc]); }
      c = nc;
    }
  }
  nodes.boss = { k: 'boss', r: FLOORS, c: 3, t: 'boss', next: [] };
  return nodes;
}
const MAP_RULES = act => ({ restMin: 1, sevMin: 2, fightMin: 4, eliteMax: 3, eliteMin: act ? 1 : 0, greedyMin: 2 + (act ? 1 : 0) });
function mapPaths(nodes) {
  const out = [], walk = (k, acc) => { if (k === 'boss') { out.push(acc); return; } if (out.length > 4000) return; const a = acc.concat(nodes[k]); for (const nx of nodes[k].next) walk(nx, a); };
  for (const n of Object.values(nodes)) if (n.r === 0) walk(n.k, []);
  return out;
}
function bandType(n, act) {
  if (n.r === 0) return 'fight';
  if (n.r === 6) return 'chest';
  if (n.r === FLOORS - 1) return 'rest';
  if (n.r <= 2) return wpick({ fight: 60, event: 32, shop: 8 });
  if (n.r <= 4) return wpick({ fight: 48, event: 26, shop: 10, elite: act ? 8 : 0, rest: 8 });
  return wpick({ fight: 40, event: 20, elite: 14 + act * 2, rest: 14, shop: 9 });
}
const isEl = n => n.t === 'elite' || n.t === 'rival';
function mapProblems(nodes, act) {
  const P = mapPaths(nodes), rule = MAP_RULES(act), probs = [];
  for (const n of Object.values(nodes)) if (['elite', 'rest', 'shop', 'rival'].includes(n.t)) for (const nx of n.next) { const m = nodes[nx]; if (m && (m.t === n.t || (isEl(m) && isEl(n)))) probs.push({ fix: 'adjacent', node: m }); }
  let greedy = 0;
  for (const p of P) {
    const c = t => p.filter(n => n.t === t).length, el = p.filter(isEl).length;
    if (c('rest') < rule.restMin + 1) probs.push({ fix: 'rest', path: p });
    if (c('shop') + c('event') < rule.sevMin) probs.push({ fix: 'sev', path: p });
    if (c('fight') < rule.fightMin) probs.push({ fix: 'fight', path: p });
    if (el > rule.eliteMax) probs.push({ fix: 'tooElite', path: p });
    if (el < rule.eliteMin) probs.push({ fix: 'elite', path: p });
    greedy = Math.max(greedy, el);
  }
  if (!Object.values(nodes).some(n => n.t === 'shop')) probs.push({ fix: 'shop', path: pick(P) });
  if (greedy < rule.greedyMin) probs.push({ fix: 'greedy', path: P.slice().sort((a, b) => b.filter(isEl).length - a.filter(isEl).length)[0] });
  return { probs, paths: P };
}
function okFor(nodes, n, t) {
  if (n.r === 0 || n.r === 6 || n.r >= FLOORS - 1) return false;
  if (t === 'rest' && (n.r < 3 || n.r >= FLOORS - 2)) return false;
  if ((t === 'elite') && n.r < (RUN && RUN.act ? 3 : 4)) return false;
  const near = Object.values(nodes).filter(m => m.next.includes(n.k)).concat(n.next.map(k => nodes[k]).filter(Boolean));
  return !near.some(m => m.t === t || (t === 'elite' && isEl(m)));
}
function repair(nodes, act) {
  for (let it = 0; it < 80; it++) {
    const { probs } = mapProblems(nodes, act);
    if (!probs.length) return true;
    const pr = probs[(R() * probs.length) | 0];
    if (pr.fix === 'adjacent') { pr.node.t = 'fight'; continue; }
    const p = shuffle(pr.path.slice());
    const want = { shop: 'shop', rest: 'rest', sev: R() < .5 ? 'event' : 'shop', fight: 'fight', elite: 'elite', greedy: 'elite', tooElite: 'fight' }[pr.fix];
    const from = { shop: ['fight', 'event'], rest: ['fight', 'event'], sev: ['fight'], fight: ['event', 'shop'], elite: ['fight', 'event'], greedy: ['fight', 'event'], tooElite: ['elite'] }[pr.fix];
    const n = p.find(n => from.includes(n.t) && (want === 'fight' || okFor(nodes, n, want)));
    if (n) n.t = want;
  }
  return !mapProblems(nodes, act).probs.length;
}
function genMap(act) {
  for (let tries = 0; tries < 30; tries++) {
    const nodes = mapShape();
    for (const n of Object.values(nodes).filter(n => n.k !== 'boss').sort((a, b) => a.r - b.r)) {
      let t = bandType(n, act);
      for (let k = 0; k < 6 && !['fight', 'chest'].includes(t) && n.r !== FLOORS - 1 && !okFor(nodes, n, t); k++) t = bandType(n, act);
      n.t = t;
    }
    if (!repair(nodes, act)) continue;
    // one rivalry game per act: a souped-up elite on floors 8-10 that at least one route can skip
    const { paths } = mapProblems(nodes, act);
    const cand = shuffle(Object.values(nodes).filter(n => n.t === 'elite' && n.r >= 7 && n.r <= 10));
    for (const n of cand) { n.t = 'rival'; if (paths.some(p => !p.includes(n)) && !mapProblems(nodes, act).probs.length) break; n.t = 'elite'; }
    // routes should differ: a gap between the gentlest and the most dangerous
    const d = paths.map(p => p.filter(isEl).length * 3 + p.filter(n => n.t === 'fight').length - p.filter(n => n.t === 'rest').length * 2);
    if (Math.max(...d) - Math.min(...d) < 4 && tries < 25) continue;
    return { act, nodes: stakeMap(scheduleMap(assignTraits(nodes), act), act) };
  }
  const nodes = mapShape(); for (const n of Object.values(nodes)) if (n.k !== 'boss') n.t = n.r === 0 ? 'fight' : n.r === FLOORS - 1 ? 'rest' : n.r === 6 ? 'chest' : 'fight';
  return { act, nodes: stakeMap(scheduleMap(assignTraits(nodes), act), act) };
}
function nextNodes() {
  const M = RUN.map;
  if (!RUN.pos) return Object.values(M.nodes).filter(n => n.r === 0);
  return M.nodes[RUN.pos].next.map(k => M.nodes[k]);
}

/* ---------- encounters ---------- */
function rollEncounter(type, want) {
  const E = ENCOUNTERS[RUN.act];
  let ids;
  if (type === 'boss') { const b = bossId(), es = ENEMIES[b].escort || []; ids = es.length === 2 ? [es[0], b, es[1]] : [b].concat(es); }
  else {
    const pool = type === 'elite' || type === 'rival' ? E.elite : (RUN.act === 0 && RUN.stats.fights < 2) || (RUN.act > 0 && RUN.actFights < 2) ? E.easy : E.normal;
    // a published sport: pick an encounter that plays it (some enemies only play their own game)
    const fits = want ? pool.filter(p => !ENEMIES[p[0]].sport || ENEMIES[p[0]].sport === want) : pool, P2 = fits.length ? fits : pool;
    let tries = 0; do { ids = pick(P2).slice(); } while (tries++ < 6 && ids.join() === RUN.lastEnc);
  }
  RUN.lastEnc = ids.join();
  const fixed = ENEMIES[ids[0]].sport;
  const sport = fixed || want || wpick(ACT_SPORTS[RUN.act]);
  return { ids, type, sport };
}

