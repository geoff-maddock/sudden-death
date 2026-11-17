/* Mossgate Links: the course (issue #92, phase 1). A hole is data: a grid of terrain, a cell GL_CELL yards square,
   GL_W cells across (x, 0 at the left) and as many rows as the hole is long (y, 0 at the tee end), with the tee, the
   green (an ellipse), the pin on it, the centre line the hole follows (path, and line: a point every 5 yards along it,
   with t, the yards from the tee) and the green's slope (glSlope).
   Terrain, one letter a cell (GL_TER): T tee, F fairway (and the apron round the green), r rough, R deep rough,
   S sand, B moss bog, W water, O the trees (a ball in there lies on a root), G green.
   A hole is built from a seed and its par by its own random stream (glRng), never R, so a hole is the same on a reload,
   in the sim and in the cup, whatever else has been drawn. The standing nine is GL_STAND's nine holes, the same every
   week; a wild nine is another seed's (glCourse). Built holes are kept in GLK, never in G: G keeps only the seed. */
const GL_CELL = 5, GL_W = 40;
const GL_STAND = 0x4d6f73;
const GL_LEN = { 3: [135, 200], 4: [325, 425], 5: [470, 545] };
const GL_TER = { T: 'tee', F: 'fairway', r: 'rough', R: 'deep rough', S: 'sand', B: 'moss bog', W: 'water', O: 'trees', G: 'green' };
const GLK = {};

const glRng = n => engRng(n);
// hole i of the course with seed cs
const glHoleSeed = (cs, i) => (Math.imul((cs >>> 0) + 1, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0;
// a wild nine's pars: the standing nine's, shuffled by its seed (so a nine is par 36), repeated for eighteen
function glWildPars(cs, n) {
  const q = glRng(cs ^ 0x9e37), p = GL_RULES.par9.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = (q() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  const out = []; for (let i = 0; i < n; i++) out.push(p[i % p.length]); return out;
}
// the course's hole i (0-based; playoff holes go round again)
function glCourseHole(cs, i, par) { return glBuildHole(glHoleSeed(cs, i % 18), par); }

// distance from (x, y) to the polyline pts, and how far along it (yards) the nearest point is
function glNear(pts, x, y) {
  let best = Infinity, at = 0, run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
    const u = clamp(((x - a.x) * dx + (y - a.y) * dy) / (L2 || 1), 0, 1), d = hyp(a.x + dx * u - x, a.y + dy * u - y);
    if (d < best) { best = d; at = run + u * L; }
    run += L;
  }
  return { d: best, t: at };
}

function glBuildHole(seed, par) {
  const key = seed + ':' + par;
  if (GLK[key]) return GLK[key];
  const q = glRng(seed), rn = (a, b) => a + (b - a) * q(), [l0, l1] = GL_LEN[par] || GL_LEN[4];
  const len = Math.round(rn(l0, l1)), mid = GL_W * GL_CELL / 2;
  // the centre line: the tee, a bend (two on a par 5), the green; each leg's lateral swing keeps its length
  const tee = { x: mid, y: 12 }, pts = [tee], legs = par === 3 ? [len] : par === 4 ? [rn(215, 265)] : [rn(200, 240), rn(150, 200)];
  if (par !== 3) legs.push(len - legs.reduce((a, b) => a + b, 0));
  let cur = tee;
  legs.forEach((L, k) => {
    const sw = clamp(par === 3 ? rn(-22, 22) : k === 0 ? rn(-12, 12) : rn(-38, 38), -L * 0.6, L * 0.6);
    const nx = clamp(cur.x + sw, 45, GL_W * GL_CELL - 45), dx = nx - cur.x;
    cur = { x: nx, y: cur.y + Math.sqrt(Math.max(1, L * L - dx * dx)) }; pts.push(cur);
  });
  const gc = pts[pts.length - 1], rows = Math.ceil((gc.y + 40) / GL_CELL);
  const green = { x: gc.x, y: gc.y, rx: rn(11, 16), ry: rn(10, 15) };
  const fw = rn(14, 19), fwFrom = par === 3 ? len - 30 : rn(95, 140);
  const inGreen = (x, y, pad) => ((x - green.x) / (green.rx + pad)) ** 2 + ((y - green.y) / (green.ry + pad)) ** 2 <= 1;
  // the hazards, as circles { x, y, r, k }: bunkers by the green and in the drive zone, a moss bog, water
  const haz = [];
  const nb = 1 + ((q() * 3) | 0);
  for (let i = 0; i < nb; i++) {
    const a = rn(-Math.PI * 0.95, Math.PI * 0.95) - Math.PI / 2, e = rn(1.05, 1.3);
    haz.push({ x: green.x + Math.cos(a) * green.rx * e, y: green.y + Math.sin(a) * green.ry * e, r: rn(4, 6.5), k: 'S' });
  }
  const along = t => { let run = 0; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = hyp(b.x - a.x, b.y - a.y); if (run + L >= t) { const u = (t - run) / L; return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, nx: -(b.y - a.y) / L, ny: (b.x - a.x) / L }; } run += L; } return { x: gc.x, y: gc.y, nx: 1, ny: 0 }; };
  if (par !== 3 && q() < 0.75) { const p = along(rn(215, 255)), s = q() < 0.5 ? -1 : 1, o = fw + rn(-3, 5); haz.push({ x: p.x + p.nx * o * s, y: p.y + p.ny * o * s, r: rn(5, 8), k: 'S' }); }
  if (q() < 0.6) { const p = along(rn(110, len - 70)), s = q() < 0.5 ? -1 : 1, o = fw + rn(3, 16); haz.push({ x: p.x + p.nx * o * s, y: p.y + p.ny * o * s, r: rn(6, 10), k: 'B' }); }
  // water: a stream across the hole (a par 4 or 5), or a pond beside a par 3's green
  let stream = null;
  if (par !== 3 && q() < 0.45) stream = { t: q() < 0.5 ? rn(150, 185) : len - rn(55, 85), w: rn(5, 8), ph: rn(0, 6) };
  if (par === 3 && q() < 0.4) { const s = q() < 0.5 ? -1 : 1; haz.push({ x: green.x + s * (green.rx + rn(6, 10)), y: green.y - rn(4, 14), r: rn(8, 12), k: 'W' }); }
  // tree clumps in the deep rough
  const clumps = []; for (let i = 0; i < 9; i++) { const p = along(rn(20, len)), s = q() < 0.5 ? -1 : 1, o = fw + rn(22, 40); clumps.push({ x: p.x + p.nx * o * s, y: p.y + p.ny * o * s, r: rn(7, 14) }); }
  const grid = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < GL_W; col++) {
      const x = (col + 0.5) * GL_CELL, y = (row + 0.5) * GL_CELL, n = glNear(pts, x, y);
      let c;
      if (Math.abs(x - tee.x) <= 7 && Math.abs(y - tee.y) <= 6) c = 'T';
      else if (inGreen(x, y, 0)) c = 'G';
      else if (inGreen(x, y, 4) || (n.d < fw && n.t > fwFrom && n.t < len)) c = 'F';
      else if (n.d < fw + 13 && n.t < len + 12) c = 'r';
      else if (n.d < fw + 44 && n.t < len + 22 && !clumps.some(k => hyp(k.x - x, k.y - y) < k.r)) c = 'R';
      else c = 'O';
      if (c !== 'T' && c !== 'G') for (const h of haz) if (hyp(h.x - x, h.y - y) < h.r && !(h.k !== 'W' && inGreen(x, y, -1))) c = h.k;
      if (stream && c !== 'T' && c !== 'G' && Math.abs(n.t - stream.t - Math.sin(x / 17 + stream.ph) * 6) < stream.w / 2) c = 'W';
      line += c;
    }
    grid.push(line);
  }
  // the pin, somewhere on the green, away from its edge
  const pa = rn(0, Math.PI * 2), pr = rn(0, 0.55);
  const pin = { x: green.x + Math.cos(pa) * green.rx * pr, y: green.y + Math.sin(pa) * green.ry * pr };
  const line = []; for (let t = 0; t <= len; t += 5) { const p = along(t); line.push({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), t }); }
  const H = {
    seed, par, len, w: GL_W, h: rows, cell: GL_CELL, grid, tee, green, pin, path: pts.map(p => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1) })), line,
    slope: { a: rn(0, Math.PI * 2), g: rn(0.006, 0.02), w: rn(0.002, 0.007), k: rn(0.12, 0.3), p: rn(0, 6) },
  };
  GLK[key] = H;
  return H;
}
// the terrain letter under (x, y); off the grid is the trees
function glLie(H, x, y) {
  const c = Math.floor(x / H.cell), r = Math.floor(y / H.cell);
  if (!(c >= 0 && r >= 0 && c < H.w && r < H.h)) return 'O';
  return H.grid[r][c];
}
// the green's slope at (x, y): which way is downhill and how steep (a grade, rise over run), as [x, y]
function glSlope(H, x, y) {
  const s = H.slope;
  return [s.g * Math.cos(s.a) + s.w * Math.sin(s.k * x + s.p), s.g * Math.sin(s.a) + s.w * Math.cos(s.k * y + s.p * 1.3)];
}
