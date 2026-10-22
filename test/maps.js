// map statistics: every root-to-boss path, summarized by dynamic programming
window.MAPSTATS = function (N = 400, act = 0) {
  RUN = RUN || { act: 0, relics: [] };
  const T = ['fight', 'elite', 'rest', 'shop', 'event', 'chest', 'rival'];
  const agg = { paths: [], nodes: [], fails: {}, widthMin: [], starts: [], spread: [] };
  for (let i = 0; i < N; i++) {
    const M = genMap(act), nodes = M.nodes;
    const ks = Object.keys(nodes).filter(k => k !== 'boss');
    agg.nodes.push(ks.length);
    agg.starts.push(ks.filter(k => nodes[k].r === 0).length);
    // enumerate paths (bounded)
    const paths = [];
    const walk = (k, acc) => { const n = nodes[k]; if (k === 'boss') { paths.push(acc); return; } if (paths.length > 3000) return; const a = acc.concat(n.t); for (const nx of n.next) walk(nx, a); };
    for (const k of ks.filter(k => nodes[k].r === 0)) walk(k, []);
    agg.paths.push(paths.length);
    const cnt = (p, t) => p.filter(x => x === t).length;
    const stats = paths.map(p => ({ e: cnt(p, 'elite') + cnt(p, 'rival'), r: cnt(p, 'rest'), s: cnt(p, 'shop'), v: cnt(p, 'event'), f: cnt(p, 'fight'), rival: cnt(p, 'rival') }));
    const fail = (k) => agg.fails[k] = (agg.fails[k] || 0) + 1;
    if (stats.some(s => s.r < 2)) fail('a path with under 2 rests (incl. the last row)');
    if (stats.some(s => s.s + s.v < 1)) fail('a path with no shop or event');
    if (stats.some(s => s.e > 4)) fail('a path with 5+ elites');
    if (stats.every(s => s.e < 2)) fail('no path with 2+ elites');
    if (act > 0 && stats.some(s => s.e === 0)) fail('an elite-free path (act 2/3)');
    if (stats.some(s => s.f < 4)) fail('a path with under 4 fights');
    if (!stats.some(s => s.s >= 1)) fail('no reachable shop');
    for (const p of paths) for (let j = 1; j < p.length; j++) if (p[j] === p[j - 1] && ['elite', 'rest', 'shop'].includes(p[j])) { fail('back-to-back ' + p[j]); break; }
    const danger = stats.map(s => s.e * 3 + s.f - s.r * 2);
    agg.spread.push(Math.max(...danger) - Math.min(...danger));
  }
  const avg = a => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  return { maps: N, act, nodes: avg(agg.nodes), starts: avg(agg.starts), paths: avg(agg.paths), dangerSpread: avg(agg.spread), fails: agg.fails };
};
