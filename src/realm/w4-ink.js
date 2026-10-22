/* w4: Realm ink overworld renderer: tiles, per-map layer cache, NPCs and party leader, night.
   Everything is drawn with Sudden Death's ink look: cel fills lit from the upper left, dark ink outlines,
   hatching in the shade and a little paper grain.

   API (see docs/realm/CONTRACT.md):
     WTILE, WINK[regionId]
     wDrawMap(c, mapId, camX, camY, vw, vh, t, opts)   opts = { night: 0..1, lights: [[x, y, r]], noNight? } (tiles)
     wInvalidate(mapId?)
     wDrawActor(c, who, px, py, t, opts)               who = { kind, col?, face: 'l'|'r', walk? }

   Reads DB.tiles / MAPS / regionAt only at draw time (w1/w2 load before this part but must not be read here at load).
   Optional hooks, used when the state part defines them: wTileAt(map, x, y) (hidden locations, beaten alphas)
   and wTileVariant(map, x, y, ch) ('0' = spent well / picked bush / empty nest / opened chest).

   How a frame is drawn, in device pixels:
     1. the void, then live water (one pattern fill) and live lava (one pattern fill per chunk);
     2. the static layer: the map cut into WCH x WCH tile chunks, each cached at device resolution. Water and
        lava are left see-through in the chunks, with shore foam, depth tint and lava rims baked on top;
     3. live overlays: flames, well glows, banners, fountain sparkle;
     4. night: a half-resolution darkness layer with light holes, then a warm glow. */
const WTILE = 32;
const WCH = 16;
const WINKC = '#1d140f';

/* ---------- palettes ---------- */
const WINK = (() => {
  const base = {
    paper: '#efe3c8', ink: WINKC, accent: '#ffb347',
    grass: '#8cb055', grassD: '#5d8838', tall: '#76a246', floor: '#4f7b39', canopy: '#5e9c42', canopyD: '#30602b',
    pine: '#2f6656', water: '#3d8db2', wtint: 'rgba(0,0,0,0)', sand: '#e6d098', road: '#c9a46c', rock: '#a0968a', rockD: '#655c52',
    fen: '#5b7653', ash: '#8f8780', cinder: '#6c625c', snow: '#eef2ef', ice: '#bde2ee', lava: '#ee5a22',
    flowers: ['#f6e27a', '#f4a6c0', '#ffffff'], flowerP: .22, berry: '#e0457b', roofs: ['#b5523a', '#3f7d8a', '#c98a3a'],
    plaster: '#ecdfbd', timber: '#5e4026', boards: '#b4875a', cobble: '#a8a398', vault: '#4f5262', wallX: '#2c2e3d', rune: '#3fd0c0',
    snowcap: .25, dark: 0,
  };
  const reg = {
    plains: { name: 'Charter Plains' },
    bloom: { name: 'Mosswold', grass: '#6ea14e', grassD: '#3f7738', tall: '#5b9545', floor: '#3a6533', canopy: '#4b8c3f', canopyD: '#265026',
      water: '#3a8a86', wtint: 'rgba(30,110,60,.18)', accent: '#e0457b', flowers: ['#e0457b', '#f2c14e', '#b38cf0'], flowerP: .3, rock: '#87917a', rockD: '#525c48', rune: '#8fe08a' },
    tide: { name: 'Brinefen', grass: '#98ad66', grassD: '#6b8049', tall: '#88a15c', fen: '#4f6b56', sand: '#ecdeae', water: '#2f7898',
      wtint: 'rgba(8,40,60,.22)', accent: '#6fd0e0', flowers: ['#ffffff', '#cfe8f0'], flowerP: .1, rock: '#8f938f', rockD: '#5a5f5c', rune: '#6fd0e0' },
    ember: { name: 'Cindermaw', grass: '#a49c5c', grassD: '#7a7036', tall: '#968a4a', floor: '#5d5536', canopy: '#7d7b3c', canopyD: '#4c4826',
      sand: '#cfae78', water: '#4a6c7a', wtint: 'rgba(90,40,20,.22)', accent: '#ff8a3c', flowers: ['#ff8a3c', '#ffd04a'], flowerP: .06,
      rock: '#76615a', rockD: '#43332e', vault: '#56463f', wallX: '#33252a', rune: '#ff8a3c' },
    rime: { name: 'Frostspire', grass: '#9cba98', grassD: '#6c8c78', tall: '#88a888', floor: '#5f8072', canopy: '#4f7c6c', canopyD: '#2c5048',
      water: '#4a92ba', wtint: 'rgba(210,240,255,.2)', accent: '#9fe6ff', flowers: ['#ffffff', '#cfe8ff'], flowerP: .08,
      rock: '#919daa', rockD: '#56616f', snowcap: 1, vault: '#4b5868', wallX: '#283444', rune: '#9fe6ff' },
  };
  const out = {};
  for (const id in reg) {
    const p = Object.assign({ id }, base, reg[id]);
    // the dungeon variant: the same region, underground. Darker stone, the region's colour in the runes and glows
    const d = Object.assign({}, p, { id: id + ':under', dark: 1,
      vault: tint(p.vault, -.18), wallX: tint(p.wallX, -.25), grass: tint(p.grass, -.35), sand: tint(p.sand, -.3), road: tint(p.road, -.35) });
    p.under = d;
    out[id] = p;
  }
  return out;
})();

/* ---------- small helpers (all w-prefixed: one global scope with Sudden Death) ---------- */
function wHash(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 7, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function wRng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function wMix(a, b, t) { const A = rgbOf(a), B = rgbOf(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`; }
function wNoise(x, y, sc, seed) {
  x /= sc; y /= sc; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = wHash(x0, y0, seed), b = wHash(x0 + 1, y0, seed), c = wHash(x0, y0 + 1, seed), d = wHash(x0 + 1, y0 + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
function wStroke(c, p, lw, col) { c.lineWidth = lw || 1.3; c.strokeStyle = col || WINKC; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); }
function wLine(c, pts, lw, col) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineWidth = lw || 1; c.strokeStyle = col || WINKC; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
// cel fill lit from the upper left: highlight rim, base, shadow rim, then the ink outline
function wCel(c, p, fill, k, lw, noLine) {
  k = k == null ? 2 : k;
  c.save(); c.clip(p); c.fillStyle = tint(fill, -.32); c.fill(p);
  c.save(); c.translate(-k, -k); c.clip(p); c.fillStyle = tint(fill, .2); c.fill(p);
  c.translate(k * 1.7, k * 1.7); c.fillStyle = fill; c.fill(p); c.restore(); c.restore();
  if (!noLine) wStroke(c, p, lw || 1.3);
}
function wFlat(c, p, fill, lw) { c.fillStyle = fill; c.fill(p); wStroke(c, p, lw || 1.2); }
function wHatch(c, p, gap, lw, col, ang) {
  c.save(); c.clip(p); c.beginPath(); const a = ang == null ? .8 : ang, dx = Math.cos(a), dy = Math.sin(a);
  for (let i = -48; i < 48; i += gap) { c.moveTo(16 + i * -dy - dx * 40, 16 + i * dx - dy * 40); c.lineTo(16 + i * -dy + dx * 40, 16 + i * dx + dy * 40); }
  c.lineWidth = lw || .8; c.strokeStyle = col || 'rgba(29,20,15,.55)'; c.stroke(); c.restore();
}
function wBlob(cx, cy, rx, ry, r, n) {
  n = n || 9; const p = new Path2D(), pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = .86 + r() * .22; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  // round the corners with quadratic curves through midpoints: an inked, lumpy outline
  const mid = i => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  let m0 = mid(n - 1); p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  p.closePath(); return p;
}
function wShadow(c, x, y, rx, ry, a) { c.fillStyle = `rgba(20,12,8,${a || .28})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }

/* ---------- tile semantics for drawing ---------- */
// ground codes and their edge priority: a higher ground spills over a lower one with an inked, wavy edge
// every pair differs, or two grounds meet on a hard tile edge
const WPRI = { '.': 4, '"': 5, f: 6, '~': 1, ':': 2, s: 3, a: 4.4, c: 5.4, L: .5, n: 6.5, p: 7, i: 3.5, '=': 2.4, o: 2.2, '^': 8, _: 0, g: 0, z: 0 };
const WWALL = { '#': 1, X: 1, '+': 1 };
const WTALL = 22; // how far objects may reach above their tile (logical px); chunks include the row below for this
function wIsGround(ch) { return ch in WPRI; }
function wMapPal(m) {
  if (m._wpal) return m._wpal;
  let id = typeof m.region === 'string' ? m.region : null;
  if (!id && m.kind !== 'world' && typeof DB !== 'undefined' && DB.locs) {
    const L = DB.locs.find(l => l.map === m.id || l.id === m.id);
    if (L && typeof regionAt === 'function') { try { id = regionAt(L.x, L.y); } catch (e) { id = null; } }
  }
  if (!id && m.meta && m.meta.region) id = m.meta.region;
  const p = WINK[id] || WINK.plains;
  return m._wpal = m.kind === 'dungeon' ? p.under : p;
}

/* ---------- the per-map layer ---------- */
const WLAY = {};
function wInvalidate(mapId) {
  for (const k in WLAY) if (mapId == null || k === mapId) delete WLAY[k];
  if (typeof MAPS !== 'undefined') for (const k in MAPS) if (mapId == null || k === mapId) { const m = MAPS[k]; if (m) { delete m._wpal; } }
}
function wLayer(m, s) {
  let L = WLAY[m.id];
  if (L && L.m === m && Math.abs(L.s - s) < .01) return L;
  L = WLAY[m.id] = { m, s, chunks: {}, pal: {}, gnd: {}, water: false, lava: false };
  for (let y = 0; y < m.h; y++) { const row = m.t[y]; for (let x = 0; x < m.w; x++) { const ch = row[x]; if (ch === '~' || ch === 'b' || ch === 'w' || ch === 'j') L.water = true; if (ch === 'L') L.lava = true; } }
  return L;
}
function wAt(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
  if (typeof wTileAt === 'function') { const c = wTileAt(m, x, y); if (c != null) return c; }
  return m.t[y][x];
}
function wMeta(m, x, y) { return (m.meta && m.meta[x + ',' + y]) || null; }
function wVariant(m, x, y, ch) {
  if (typeof wTileVariant === 'function') { const v = wTileVariant(m, x, y, ch); if (v != null) return String(v); }
  const mt = wMeta(m, x, y);
  if (ch === 'V' || ch === 'Y') return (mt && mt.elem) || (ch === 'V' ? 'aether' : 'bloom');
  return '1';
}
// the ground under any tile: itself if it is a ground code, its meta 'under', water under boats and planks, else its neighbours' commonest ground
function wGround(L, x, y) {
  const m = L.m;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null; // never cached: y * w + x would alias a tile on the next row
  const k = y * m.w + x;
  if (k in L.gnd) return L.gnd[k];
  const ch = wAt(m, x, y);
  let g = null;
  if (ch == null) g = null;
  else if (wIsGround(ch)) g = ch;
  else if (ch === 'b' || ch === 'w' || ch === 'j') g = '~';
  else {
    const mt = wMeta(m, x, y);
    if (mt && mt.under && wIsGround(mt.under)) g = mt.under;
    else {
      const cnt = {};
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const c2 = wAt(m, x + dx, y + dy);
        if (c2 && wIsGround(c2) && c2 !== '~' && c2 !== 'L' && c2 !== '^') cnt[c2] = (cnt[c2] || 0) + (dx && dy ? 1 : 2);
      }
      let best = m.kind === 'dungeon' ? 'g' : m.kind === 'town' ? '.' : '.', bn = 0;
      for (const c2 in cnt) if (cnt[c2] > bn) { bn = cnt[c2]; best = c2; }
      g = best;
    }
  }
  return L.gnd[k] = g;
}
// a palette per tile: world tiles blend the regions around them so the grass shifts colour gradually at borders
function wPal(L, x, y) {
  const m = L.m;
  if (m.kind !== 'world' || !m.region) return wMapPal(m);
  const k = y * m.w + x;
  if (L.pal[k]) return L.pal[k];
  const w = {}; let tot = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const xx = Math.max(0, Math.min(m.w - 1, x + dx)), yy = Math.max(0, Math.min(m.h - 1, y + dy));
    const id = m.region[yy * m.w + xx] || 'plains', f = 5 - Math.max(Math.abs(dx), Math.abs(dy));
    w[id] = (w[id] || 0) + f; tot += f;
  }
  const own = m.region[k] || 'plains', ids = Object.keys(w);
  if (ids.length === 1) return L.pal[k] = WINK[own] || WINK.plains;
  const sig = ids.sort().map(i => i + w[i]).join(',') + '|' + own;
  L.mix = L.mix || {};
  if (L.mix[sig]) return L.pal[k] = L.mix[sig];
  const P = Object.assign({}, WINK[own] || WINK.plains);
  for (const key of ['grass', 'grassD', 'tall', 'floor', 'canopy', 'canopyD', 'sand', 'road', 'rock', 'rockD', 'fen']) {
    let r = 0, g = 0, b = 0;
    for (const id of ids) { const c = rgbOf((WINK[id] || WINK.plains)[key]), f = w[id] / tot; r += c[0] * f; g += c[1] * f; b += c[2] * f; }
    P[key] = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }
  return L.pal[k] = L.mix[sig] = P;
}
function wRegion(m, x, y) { return m.kind === 'world' && m.region ? (m.region[y * m.w + x] || 'plains') : (wMapPal(m).id || 'plains').split(':')[0]; }

/* ---------- ground painters: (c, P, r, e) with c at the tile's top-left; e = { m, L, x, y, at(dx,dy) } ---------- */
function wTicks(c, r, n, col, lw) {
  c.beginPath();
  for (let i = 0; i < n; i++) { const px = 3 + r() * 26, py = 5 + r() * 25, w = 1.4 + r(); c.moveTo(px - w, py - 3); c.lineTo(px, py); c.lineTo(px + w, py - 3.4); }
  c.strokeStyle = col; c.lineWidth = lw || 1; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
// soft blotches kept inside the tile (blotches cut by the tile edge show the grid); the large-scale variation is the chunk's noise layer
function wMottle(c, r, n, lite, dark) {
  for (let i = 0; i < n; i++) { const rx = 3 + r() * 4, ry = 2 + r() * 2.5; c.fillStyle = r() < .5 ? lite : dark; c.beginPath(); c.ellipse(rx + 1 + r() * (30 - 2 * rx), ry + 1 + r() * (30 - 2 * ry), rx, ry, 0, 0, Math.PI * 2); c.fill(); }
}
function wStipple(c, r, n, col, sz) { c.fillStyle = col; for (let i = 0; i < n; i++) { c.fillRect(r() * 31, r() * 31, sz || 1, sz || 1); } }
function wFlower(c, x, y, col) {
  c.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, 1.1, 0, 7); c.fill(); }
  c.fillStyle = '#c9862a'; c.beginPath(); c.arc(x, y, .9, 0, 7); c.fill();
}
function wTuft(c, x, y, h, col, r) {
  const p = new Path2D(), n = 4 + (r() * 2 | 0);
  p.moveTo(x - 4, y);
  for (let i = 0; i < n; i++) { const bx = x - 4 + (i + .5) * 8 / n, lean = (r() - .5) * 4; p.lineTo(bx - 1, y - 1); p.lineTo(bx + lean, y - h * (.7 + r() * .4)); p.lineTo(bx + 1, y - 1); }
  p.lineTo(x + 4, y); p.closePath();
  wShadow(c, x + 1, y, 5, 1.6, .22); c.fillStyle = col; c.fill(p);
  c.save(); c.clip(p); c.fillStyle = tint(col, -.3); c.fillRect(x, y - h, 6, h); c.restore();
  wStroke(c, p, .75, tint(col, -.62));
}
const WGND = {
  '.': (c, P, r) => {
    c.fillStyle = P.grass; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,250,200,.08)', 'rgba(20,40,10,.08)');
    wTicks(c, r, 3 + (r() * 4 | 0), P.grassD, 1);
    if (r() < P.flowerP) wFlower(c, 5 + r() * 22, 6 + r() * 20, P.flowers[(r() * P.flowers.length) | 0]);
  },
  '"': (c, P, r) => {
    c.fillStyle = P.tall; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,250,200,.06)', 'rgba(20,40,10,.1)');
    wTicks(c, r, 3, tint(P.tall, -.3), 1);
    const n = 3 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) wTuft(c, 6 + ((i * 9 + r() * 6) % 22), 10 + r() * 20, 8 + r() * 4, tint(P.tall, .12), r);
  },
  f: (c, P, r) => {
    c.fillStyle = P.floor; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 3, 'rgba(255,240,180,.05)', 'rgba(0,10,0,.12)');
    wStipple(c, r, 10, tint(P.floor, -.35), 1.5); wStipple(c, r, 5, tint(P.floor, .25), 1.5);
  },
  '~': () => { },
  ':': (c, P, r) => {
    c.fillStyle = P.sand; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,255,240,.12)', 'rgba(110,80,30,.07)');
    wStipple(c, r, 16, tint(P.sand, -.22), 1); wStipple(c, r, 6, tint(P.sand, .35), 1);
    if (r() < .5) { const y = 8 + r() * 18; wLine(c, [[4 + r() * 6, y], [14, y - 1.5], [24 + r() * 4, y]], .8, tint(P.sand, -.18)); }
    if (r() < .12) { const x = 6 + r() * 20, y = 6 + r() * 20; const p = pEl(x, y, 2.2, 1.6); wFlat(c, p, '#f4efe0', .7); }
  },
  s: (c, P, r) => {
    c.fillStyle = P.fen; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 3, 'rgba(160,190,120,.08)', 'rgba(0,20,10,.14)');
    const n = 1 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const px = 6 + r() * 20, py = 7 + r() * 18, p = pEl(px, py, 4 + r() * 3, 2 + r() * 1.5);
      c.fillStyle = '#25393a'; c.fill(p); wStroke(c, p, .8, 'rgba(29,20,15,.7)');
      wLine(c, [[px - 2, py - .8], [px + 1, py - 1]], .8, 'rgba(200,230,220,.6)');
    }
    for (let i = 0; i < 3; i++) {
      const x = 3 + r() * 26, y = 12 + r() * 18, h = 6 + r() * 4;
      wLine(c, [[x, y], [x + (r() - .5) * 2, y - h]], 1, '#3f5a2e');
      c.fillStyle = '#6a4a2a'; c.beginPath(); c.ellipse(x, y - h + 1.5, 1.1, 2.2, 0, 0, 7); c.fill();
    }
  },
  a: (c, P, r) => {
    c.fillStyle = P.ash; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,255,255,.06)', 'rgba(0,0,0,.08)');
    wStipple(c, r, 18, tint(P.ash, -.25), 1); wStipple(c, r, 8, tint(P.ash, .25), 1);
    if (r() < .45) { const x = 4 + r() * 20, y = 4 + r() * 20; wLine(c, [[x, y], [x + 4, y + 3], [x + 6, y + 8], [x + 10, y + 9]], .7, 'rgba(29,20,15,.45)'); }
  },
  c: (c, P, r) => {
    c.fillStyle = P.cinder; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,200,150,.05)', 'rgba(0,0,0,.12)');
    wStipple(c, r, 14, tint(P.cinder, -.3), 1);
    const n = 2 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const x = 5 + r() * 22, y = 10 + r() * 18;
      wShadow(c, x, y, 4, 1.3, .25);
      wLine(c, [[x, y], [x - 1, y - 6]], 1.2); wLine(c, [[x - .5, y - 3], [x - 4, y - 6]], 1); wLine(c, [[x - .8, y - 4.5], [x + 3, y - 8]], 1);
      c.save(); c.fillStyle = '#ff8a3c'; c.shadowColor = '#ff6a1a'; c.shadowBlur = 3; c.beginPath(); c.arc(x + 2.5, y - 7.5, 1, 0, 7); c.fill(); c.restore();
    }
  },
  L: () => { },
  '^': (c, P, r) => {
    c.fillStyle = wMix(P.rock, P.rockD, .45); c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.1)');
    wStipple(c, r, 14, tint(P.rockD, -.3), 1.4); wStipple(c, r, 6, tint(P.rock, .3), 1.2);
    for (let i = 0; i < 2; i++) { const p = wBlob(4 + r() * 24, 6 + r() * 22, 2.2, 1.6, r, 5); wFlat(c, p, tint(P.rock, (r() - .5) * .3), .7); }
  },
  n: (c, P, r) => {
    c.fillStyle = P.snow; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,255,255,.4)', 'rgba(120,150,180,.08)');
    for (let i = 0; i < 2; i++) { const x = 3 + r() * 18, y = 6 + r() * 22; wLine(c, [[x, y], [x + 4, y - 1.5], [x + 9, y - 1], [x + 12, y + .5]], 1, 'rgba(120,150,175,.4)'); }
    wStipple(c, r, 4, '#ffffff', 1.5);
    if (r() < .1) { const x = 6 + r() * 18, y = 6 + r() * 18; for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(100,120,150,.45)'; c.fillRect(x + i * 4, y + (i % 2) * 3, 1.5, 1.5); } }
  },
  p: (c, P, r) => {
    c.fillStyle = tint(P.snow, -.06); c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,255,255,.3)', 'rgba(80,110,130,.1)');
    wStipple(c, r, 8, 'rgba(70,90,80,.4)', 1.2);
  },
  i: (c, P, r) => {
    c.fillStyle = P.ice; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,255,255,.25)', 'rgba(60,120,160,.1)');
    for (let i = 0; i < 2; i++) { const x = r() * 24, y = r() * 26; wLine(c, [[x, y + 6], [x + 7, y]], 1.6, 'rgba(255,255,255,.75)'); }
    if (r() < .6) { const x = 4 + r() * 20, y = 4 + r() * 20; wLine(c, [[x, y], [x + 5, y + 2], [x + 7, y + 7]], .7, 'rgba(40,80,110,.5)'); wLine(c, [[x + 5, y + 2], [x + 10, y + 1]], .6, 'rgba(40,80,110,.45)'); }
  },
  '=': (c, P, r, e) => {
    c.fillStyle = P.road; c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,240,200,.1)', 'rgba(90,60,20,.08)');
    wStipple(c, r, 12, tint(P.road, -.25), 1.2);
    // wheel ruts along every connected direction
    const conn = ch => ch === '=' || ch === 'b' || ch === 'O' || ch === 'Q' || ch === 'D' || ch === 'H' || ch === 'e' || ch === null;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => conn(e.at(dx, dy)));
    const col = tint(P.road, -.18);
    for (const [dx, dy] of (dirs.length > 2 ? [] : dirs.length ? dirs : [[1, 0], [-1, 0]])) for (const off of [-5, 5]) {
      const ox = dy ? off : 0, oy = dx ? off : 0;
      wLine(c, [[16 + ox, 16 + oy], [16 + ox + dx * 16, 16 + oy + dy * 16]], 1.6, col);
    }
    for (let i = 0; i < 2; i++) { const p = pEl(4 + r() * 24, 4 + r() * 24, 1.6, 1.2); wFlat(c, p, '#b8ab98', .6); }
  },
  o: (c, P, r) => {
    c.fillStyle = tint(P.cobble, -.38); c.fillRect(0, 0, 32, 32);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
      const x = col * 9 + (row % 2) * 4.5 + 1 + (r() - .5), y = row * 8 + 1 + (r() - .5), w = 7.4 + r(), h = 6.2;
      const p = pRR(x, y, w, h, 2.4), f = tint(P.cobble, (r() - .5) * .22);
      c.fillStyle = tint(f, -.25); c.fill(p);
      c.save(); c.clip(p); c.fillStyle = f; c.fillRect(x - 1, y - 1, w, h - .5); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, w - 2, 1.2); c.restore();
      wStroke(c, p, .7, 'rgba(29,20,15,.75)');
    }
  },
  _: (c, P, r, e) => {
    for (let row = 0; row < 4; row++) {
      const y = row * 8, f = tint(P.boards, (r() - .5) * .14);
      c.fillStyle = f; c.fillRect(0, y, 32, 8);
      c.fillStyle = 'rgba(255,240,210,.14)'; c.fillRect(0, y, 32, 1.4);
      wLine(c, [[0, y + 8], [32, y + 8]], .8, 'rgba(29,20,15,.7)');
      const j = 4 + r() * 24; wLine(c, [[j, y], [j, y + 8]], .8, 'rgba(29,20,15,.6)');
      c.fillStyle = 'rgba(29,20,15,.5)'; c.fillRect(j - 2.5, y + 3.5, 1, 1); c.fillRect(j + 1.5, y + 3.5, 1, 1);
      if (r() < .3) wLine(c, [[r() * 20, y + 4], [r() * 20 + 8, y + 4.6]], .5, 'rgba(90,50,20,.35)');
    }
  },
  g: (c, P, r, e) => {
    c.fillStyle = tint(P.vault, -.42); c.fillRect(0, 0, 32, 32);
    // flagstones on a jittered half-tile lattice in map coordinates; each tile draws the stones around it too
    // (clipped), so stones that straddle a tile edge are whole
    const pt = (gx, gy) => [(gx - e.x * 2) * 16 + (wHash(gx, gy, 41) - .5) * 9, (gy - e.y * 2) * 16 + (wHash(gx, gy, 42) - .5) * 9];
    for (let gy = e.y * 2 - 1; gy <= e.y * 2 + 2; gy++) for (let gx = e.x * 2 - 1; gx <= e.x * 2 + 2; gx++) {
      const q = [pt(gx, gy), pt(gx + 1, gy), pt(gx + 1, gy + 1), pt(gx, gy + 1)], mx = (q[0][0] + q[2][0]) / 2, my = (q[0][1] + q[2][1]) / 2;
      if (mx < -20 || my < -20 || mx > 52 || my > 52) continue;
      const p = pPoly(q.map(([x, y]) => [x + (mx - x) * .07, y + (my - y) * .07]));
      c.fillStyle = tint(P.vault, (wHash(gx, gy, 43) - .5) * .26); c.fill(p);
      c.save(); c.clip(p); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(mx - 16, my - 16, 32, 13); c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(mx - 16, my + 4, 32, 12); c.restore();
      wStroke(c, p, .8, 'rgba(8,6,12,.85)');
    }
    if (r() < .35) { const x = 3 + r() * 20, y = 3 + r() * 20; wLine(c, [[x, y], [x + 4, y + 3], [x + 5, y + 7]], .7, 'rgba(0,0,0,.55)'); }
    if (r() < .08) { c.save(); c.globalAlpha = .7; wLine(c, [[8, 16], [14, 16], [14, 22]], 1, P.rune); c.restore(); }
  },
  z: (c, P, r, e) => {
    WGND._(c, P, r, e);
    const same = (dx, dy) => e.at(dx, dy) === 'z';
    const x0 = same(-1, 0) ? -2 : 3, x1 = same(1, 0) ? 34 : 29, y0 = same(0, -1) ? -2 : 3, y1 = same(0, 1) ? 34 : 29;
    const p = new Path2D(); p.rect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = '#9a3e36'; c.fill(p);
    c.save(); c.clip(p);
    c.strokeStyle = '#d9a640'; c.lineWidth = 1.6; c.strokeRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6);
    c.fillStyle = '#c9962a'; c.beginPath(); c.moveTo(16, 9); c.lineTo(23, 16); c.lineTo(16, 23); c.lineTo(9, 16); c.closePath(); c.fill();
    c.fillStyle = '#7a2a28'; c.beginPath(); c.moveTo(16, 12.5); c.lineTo(19.5, 16); c.lineTo(16, 19.5); c.lineTo(12.5, 16); c.closePath(); c.fill();
    c.restore();
    c.lineWidth = 1.2; c.strokeStyle = WINKC; c.beginPath();
    if (!same(-1, 0)) { c.moveTo(x0, y0); c.lineTo(x0, y1); } if (!same(1, 0)) { c.moveTo(x1, y0); c.lineTo(x1, y1); }
    if (!same(0, -1)) { c.moveTo(x0, y0); c.lineTo(x1, y0); } if (!same(0, 1)) { c.moveTo(x0, y1); c.lineTo(x1, y1); }
    c.stroke();
    if (!same(0, 1)) { c.fillStyle = '#f2d9a0'; for (let x = x0 + 2; x < x1 - 1; x += 3) c.fillRect(x, y1, 1, 2); }
  },
};
function wObsidian(c, P, r) { c.fillStyle = '#2b2224'; c.fillRect(0, 0, 32, 32); wStipple(c, r, 10, '#4a3a3a', 1.4); c.fillStyle = 'rgba(255,140,60,.5)'; c.fillRect(r() * 30, r() * 30, 1.5, 1.5); }
const WSPILL = { '.': 8, '"': 9, f: 9, ':': 9, s: 9, a: 9, c: 9, n: 9, p: 9, i: 8, '=': 6, o: 6, '^': 8, L: 6 };

/* the wavy boundary between two tiles: a function of the global position along a grid line, so neighbours agree */
function wEdgeD(line, u, base, ch, amp) {
  amp = amp == null ? 1 : amp;
  const s1 = wHash(line, ch.charCodeAt(0), 11) * 6.28, s2 = wHash(line, ch.charCodeAt(0), 12) * 6.28;
  // a slow meander plus a little wobble: long runs of tiles must not read as straight lines
  return Math.max(1.5, base + amp * (5.2 * Math.sin(u * .041 + s1) + 2.4 * Math.sin(u * .12 + s2)) + .9 * Math.sin(u * .41 + s1 * 1.7));
}
// the shape of ground n spilling onto tile (x, y): strips on sides where the neighbour is n, round blobs in bare corners
function wSpillPath(L, x, y, n, onto) {
  const g = (dx, dy) => wGround(L, x + dx, y + dy) === n;
  const path = onto === '=' || onto === 'o', base = path ? 5 : (WSPILL[n] || 6), amp = path ? .35 : 1, X = x * WTILE, Y = y * WTILE, p = new Path2D();
  const N = g(0, -1), S = g(0, 1), W = g(-1, 0), E = g(1, 0);
  const strip = (side) => {
    // side: 0 N, 1 E, 2 S, 3 W. Horizontal lines are keyed by row boundary, vertical by column boundary
    const pts = [];
    for (let u = 0; u <= 32; u += 4) {
      if (side === 0) pts.push([u, wEdgeD(1000 + y, X + u, base, n, amp)]);
      else if (side === 2) pts.push([u, 32 - wEdgeD(1000 + y + 1, X + u, base, n, amp)]);
      else if (side === 3) pts.push([wEdgeD(5000 + x, Y + u, base, n, amp), u]);
      else pts.push([32 - wEdgeD(5000 + x + 1, Y + u, base, n, amp), u]);
    }
    if (side === 0) { p.moveTo(-1, -1); p.lineTo(33, -1); for (let i = pts.length - 1; i >= 0; i--) p.lineTo(pts[i][0], pts[i][1]); }
    if (side === 2) { p.moveTo(33, 33); p.lineTo(-1, 33); for (let i = 0; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); }
    if (side === 3) { p.moveTo(-1, 33); p.lineTo(-1, -1); for (let i = 0; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); }
    if (side === 1) { p.moveTo(33, -1); p.lineTo(33, 33); for (let i = pts.length - 1; i >= 0; i--) p.lineTo(pts[i][0], pts[i][1]); }
    p.closePath();
  };
  if (N) strip(0); if (E) strip(1); if (S) strip(2); if (W) strip(3);
  const corner = (cx, cy, hline, vline) => {
    const ry = wEdgeD(hline, X + cx, base, n, amp), rx = wEdgeD(vline, Y + cy, base, n, amp);
    p.moveTo(cx + rx, cy); p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };
  if (!N && !W && g(-1, -1)) corner(0, 0, 1000 + y, 5000 + x);
  if (!N && !E && g(1, -1)) corner(32, 0, 1000 + y, 5000 + x + 1);
  if (!S && !W && g(-1, 1)) corner(0, 32, 1000 + y + 1, 5000 + x);
  if (!S && !E && g(1, 1)) corner(32, 32, 1000 + y + 1, 5000 + x + 1);
  return p;
}

/* ---------- object painters: (c, P, r, e, v) with c at the tile's top-left; may reach WTALL px above ---------- */
function wTree(c, P, r, cx, by, s, col, colD) {
  s = s || 1; col = col || P.canopy;
  wShadow(c, cx + 2 * s, by, 9 * s, 3 * s, .3);
  const tr = pPoly([[cx - 1.8 * s, by], [cx - 1.4 * s, by - 9 * s], [cx + 1.4 * s, by - 9 * s], [cx + 1.8 * s, by]]);
  wFlat(c, tr, '#6a4628', 1.1);
  const cy = by - 14 * s, b = wBlob(cx, cy, 10 * s, 9 * s, r, 10);
  wCel(c, b, col, 2.2 * s, 1.35);
  // inked leaf clumps
  c.save(); c.clip(b);
  for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = r() * 5 * s, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; c.beginPath(); c.arc(x, y, 3 * s, Math.PI * .1, Math.PI * .9); c.lineWidth = .8; c.strokeStyle = colD || P.canopyD; c.stroke(); }
  c.restore();
}
function wPine(c, P, r, cx, by, s, snowy) {
  s = s || 1;
  wShadow(c, cx + 2 * s, by, 7 * s, 2.4 * s, .3);
  wFlat(c, pRR(cx - 1.4 * s, by - 6 * s, 2.8 * s, 6 * s, .5), '#5a3d22', 1);
  for (let i = 0; i < 3; i++) {
    const w = (9 - i * 2.4) * s, yb = by - (4 + i * 6) * s, yt = yb - 10 * s;
    const p = pPoly([[cx - w, yb], [cx, yt], [cx + w, yb], [cx + w * .3, yb - 1.4 * s], [cx - w * .4, yb - 1 * s]]);
    wCel(c, p, P.pine, 1.6 * s, 1.2);
    if (snowy) { const q = pPoly([[cx - w * .55, yb - 5 * s], [cx, yt + .5], [cx + w * .45, yb - 5.5 * s], [cx + w * .1, yb - 4.4 * s]]); c.fillStyle = '#f6fbff'; c.fill(q); wStroke(c, q, .7, 'rgba(29,20,15,.55)'); }
  }
}
function wHouse(c, x, y, w, h, roof, P, r, chimney) {
  // a little front-on house: plaster wall, pitched roof, a door and a window
  const wall = pRR(x, y, w, h, 1);
  wCel(c, wall, P.plaster, 1.2, 1.2);
  const rf = pPoly([[x - 2.5, y + 1], [x + w / 2, y - h * .8], [x + w + 2.5, y + 1]]);
  wCel(c, rf, roof, 1.4, 1.3);
  wLine(c, [[x + w * .25, y - h * .35], [x + w * .75, y - h * .35]], .6, 'rgba(29,20,15,.45)');
  if (chimney) { const ch = pRR(x + w * .68, y - h * .9, 2.8, 5, .4); wFlat(c, ch, '#8a857e', 1); }
  wFlat(c, pRR(x + w * .38, y + h * .42, w * .24, h * .58, .6), '#5a3d22', 1);
  if (w > 8) { c.fillStyle = '#ffd877'; c.fillRect(x + w * .08 + .5, y + h * .3, 2.6, 2.4); c.lineWidth = .7; c.strokeStyle = WINKC; c.strokeRect(x + w * .08 + .5, y + h * .3, 2.6, 2.4); }
}
function wFire(c, x, y, s, t) {
  // drawn live: a flickering two-tone flame
  const f = Math.sin(t * 13 + x) * .5 + Math.sin(t * 7.3 + y) * .5;
  c.save(); c.translate(x, y); c.scale(s, s);
  const p = new Path2D(); p.moveTo(-4, 0); p.quadraticCurveTo(-5, -5, -1 + f, -10 - f * 1.5); p.quadraticCurveTo(1, -6, 2, -7 + f); p.quadraticCurveTo(5, -4, 4, 0); p.closePath();
  c.fillStyle = '#ff7a2a'; c.fill(p); c.lineWidth = .8; c.strokeStyle = 'rgba(80,20,5,.8)'; c.stroke(p);
  const q = new Path2D(); q.moveTo(-2, 0); q.quadraticCurveTo(-2.5, -3, -.5 + f * .6, -6 - f); q.quadraticCurveTo(2.5, -3, 2, 0); q.closePath();
  c.fillStyle = '#ffe07a'; c.fill(q);
  c.restore();
}
function wGlow(c, x, y, rad, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.globalAlpha = a == null ? 1 : a; c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); c.restore();
}
const WELEM = { bloom: ['#5dbb63', '#c8f08f'], ember: ['#f0803c', '#ffd36b'], tide: ['#4f9fe0', '#b5e6ff'], rime: ['#bfe6f2', '#ffffff'], aether: ['#b38cf0', '#f3d9ff'] };
function wWallFace(c, P, e, kind) {
  // walls in 3/4 view: a top cap, plus a front face when the tile below is open. Ink only where wall meets open ground
  const isW = (dx, dy) => { const ch = e.at(dx, dy); if (ch == null) return true; if (WWALL[ch]) return true; const mt = wMeta(e.m, e.x + dx, e.y + dy); return !!(mt && mt.under && WWALL[mt.under]); };
  const front = !isW(0, 1), old = kind === 'X';
  const capH = front ? 13 : 32;
  const deep = old && isW(0, 1) && isW(0, -1) && isW(1, 0) && isW(-1, 0) && isW(1, 1) && isW(-1, 1) && isW(1, -1) && isW(-1, -1);
  if (old) {
    if (deep) {
      // solid rock: near-black, with a faint ink hatch so it reads as mass, not as a hole
      c.fillStyle = tint(P.wallX, -.55); c.fillRect(0, 0, 32, 32);
      const p = new Path2D(); p.rect(0, 0, 32, 32); wHatch(c, p, 5, .7, 'rgba(120,120,150,.08)', .75 + wHash(e.x, e.y, 5) * .2);
      return;
    }
    c.fillStyle = tint(P.wallX, -.2); c.fillRect(0, 0, 32, capH);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 0, 32, 2);
    wLine(c, [[0, capH * .5], [32, capH * .5]], .6, 'rgba(0,0,0,.4)');
  } else {
    c.fillStyle = P.timber; c.fillRect(0, 0, 32, capH);
    c.fillStyle = 'rgba(255,230,190,.12)'; c.fillRect(0, 0, 32, 2.2);
    for (let yy = 6; yy < capH; yy += 7) wLine(c, [[0, yy], [32, yy]], .6, 'rgba(0,0,0,.35)');
  }
  if (front) {
    const fy = capH, fh = 32 - capH;
    if (old) {
      c.fillStyle = P.wallX; c.fillRect(0, fy, 32, fh);
      for (let row = 0; row < 3; row++) {
        const yy = fy + row * fh / 3; wLine(c, [[0, yy], [32, yy]], .7, 'rgba(0,0,0,.6)');
        for (let xx = (row % 2) * 6 + 2; xx < 32; xx += 12) wLine(c, [[xx, yy], [xx, yy + fh / 3]], .7, 'rgba(0,0,0,.6)');
      }
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 32 - 4, 32, 4);
      const v = wHash(e.x, e.y, 9);
      if (v < .3) { c.save(); c.shadowColor = P.rune; c.shadowBlur = 4; wLine(c, [[6, fy + 6], [14, fy + 6], [14, fy + 12]], 1.2, P.rune); c.restore(); }
    } else {
      c.fillStyle = P.plaster; c.fillRect(0, fy, 32, fh);
      c.fillStyle = 'rgba(120,90,50,.18)'; c.fillRect(0, 32 - 5, 32, 5);
      wLine(c, [[0, fy + 1], [32, fy + 1]], 2, P.timber);
      wLine(c, [[0, 31], [32, 31]], 2, P.timber);
      const b = wHash(e.x, e.y, 3) < .5;
      wLine(c, [[b ? 4 : 28, fy + 1], [b ? 4 : 28, 31]], 2, P.timber);
      wLine(c, [[b ? 4 : 28, fy + 1], [b ? 18 : 14, 31]], 1.6, P.timber);
    }
    wLine(c, [[0, fy], [32, fy]], 1, 'rgba(29,20,15,.7)');
    wLine(c, [[0, 32], [32, 32]], 1.5);
  }
  // outline the wall mass where it meets open ground
  c.lineWidth = 1.5; c.strokeStyle = WINKC; c.beginPath();
  if (!isW(0, -1)) { c.moveTo(0, .5); c.lineTo(32, .5); }
  if (!isW(-1, 0)) { c.moveTo(.5, 0); c.lineTo(.5, 32); }
  if (!isW(1, 0)) { c.moveTo(31.5, 0); c.lineTo(31.5, 32); }
  c.stroke();
  return front;
}
const WOBJ = {
  '#': (c, P, r, e) => { wWallFace(c, P, e, '#'); },
  X: (c, P, r, e) => { wWallFace(c, P, e, 'X'); },
  '+': (c, P, r, e) => {
    wWallFace(c, P, e, '#');
    const p = new Path2D(); p.moveTo(8, 32); p.lineTo(8, 12); p.quadraticCurveTo(16, 4, 24, 12); p.lineTo(24, 32); p.closePath();
    wCel(c, p, '#8a5f32', 1.2, 1.3);
    wLine(c, [[12, 12], [12, 32]], .6, 'rgba(29,20,15,.5)'); wLine(c, [[16, 9], [16, 32]], .6, 'rgba(29,20,15,.5)'); wLine(c, [[20, 12], [20, 32]], .6, 'rgba(29,20,15,.5)');
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(21.5, 22, 1.2, 0, 7); c.fill();
  },
  '^': (c, P, r, e) => {
    const reg = wRegion(e.m, e.x, e.y), cap = P.snowcap >= 1 || (reg === 'rime') || wHash(e.x, e.y, 21) < P.snowcap * .5;
    // scree under the peaks
    const hv = wHash(e.x, e.y, 22);
    const peak = (px, base, w, h) => {
      const tx = px + (r() - .5) * 4, ty = base - h;
      const outline = pPoly([[px - w, base], [px - w * .55, base - h * .45], [tx - 2, ty + 2], [tx, ty], [tx + 2.5, ty + 3], [px + w * .6, base - h * .5], [px + w, base]]);
      wShadow(c, px + 3, base, w + 2, 3, .3);
      c.fillStyle = P.rock; c.fill(outline);
      // the shaded east face, hatched
      const sh = pPoly([[tx, ty], [tx + 2.5, ty + 3], [px + w * .6, base - h * .5], [px + w, base], [px + w * .1, base], [tx + 1, ty + h * .5]]);
      c.fillStyle = P.rockD; c.fill(sh); wHatch(c, sh, 2.6, .7, 'rgba(29,20,15,.45)', 1.1);
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fill(pPoly([[px - w * .9, base], [px - w * .55, base - h * .45], [tx - 2, ty + 2], [tx - 1, ty + h * .35], [px - w * .4, base - 2]]));
      if (cap) {
        const sn = pPoly([[tx - 2, ty + 2], [tx, ty], [tx + 2.5, ty + 3], [tx + w * .3, ty + h * .32], [tx + 1, ty + h * .24], [tx - 1, ty + h * .34], [tx - w * .3, ty + h * .3]]);
        c.fillStyle = '#f4f8fa'; c.fill(sn); wStroke(c, sn, .7, 'rgba(29,20,15,.6)');
      }
      wStroke(c, outline, 1.35);
      wLine(c, [[tx + .5, ty + 3], [tx + 1, ty + h * .5], [px + w * .1, base - 1]], .8, 'rgba(29,20,15,.6)');
    };
    if (hv < .3) { peak(9 + r() * 2, 25, 9, 18 + r() * 8); peak(22, 30, 11, 24 + r() * 8); }
    else if (hv < .45) { peak(7, 27, 7, 14 + r() * 5); peak(25, 26, 7, 15 + r() * 5); peak(16, 31, 10, 22 + r() * 8); }
    else if (hv < .55) { peak(16 + (r() - .5) * 6, 29, 11, 16 + r() * 6); }
    else peak(16 + (r() - .5) * 5, 30, 13 + r() * 3, 28 + r() * 14);
  },
  T: (c, P, r) => { wTree(c, P, r, 16, 29, 1.25); },
  f: (c, P, r, e) => {
    const n = 2 + (wHash(e.x, e.y, 31) < .5 ? 1 : 0);
    const spots = [[8, 14], [23, 18], [13, 30], [26, 31]];
    for (let i = 0; i < n; i++) { const [sx, sy] = spots[(i + (wHash(e.x, e.y, 32) * 4 | 0)) % 4]; wTree(c, P, r, sx + (r() - .5) * 4, sy + (r() - .5) * 3, .78 + r() * .2); }
  },
  p: (c, P, r, e) => {
    const spots = [[9, 15], [23, 19], [14, 31]];
    const n = 2 + (wHash(e.x, e.y, 33) < .5 ? 1 : 0);
    for (let i = 0; i < n; i++) wPine(c, P, r, spots[i][0] + (r() - .5) * 4, spots[i][1] + (r() - .5) * 2, .82 + r() * .2, true);
  },
  O: (c, P, r) => {
    wShadow(c, 17, 28, 15, 4, .3);
    wHouse(c, 3, 10, 11, 9, P.roofs[0], P, r, true);
    wHouse(c, 18, 7, 11, 10, P.roofs[1], P, r, false);
    wHouse(c, 9, 20, 13, 9, P.roofs[2], P, r, true);
    wLine(c, [[29, 30], [29, 15]], 1.3);
    const fl = pPoly([[29, 15], [36, 17], [29, 20]]); wFlat(c, fl, P.accent, 1);
  },
  Q: (c, P, r) => {
    wShadow(c, 17, 29, 17, 4, .35);
    const outer = new Path2D(); outer.ellipse(16, 18, 17, 10, 0, 0, Math.PI * 2);
    const drum = new Path2D(); drum.moveTo(-1, 14); drum.lineTo(-1, 22); drum.ellipse(16, 22, 17, 9, 0, Math.PI, 0, true); drum.lineTo(33, 14); drum.ellipse(16, 14, 17, 9, 0, 0, Math.PI, false); drum.closePath();
    wCel(c, drum, '#e8dcb0', 1.2, 1.3);
    for (let i = 0; i < 7; i++) { const a = Math.PI * (.12 + i * .127), x = 16 - Math.cos(a) * 15, y = 22 + Math.sin(a) * 7.5; const ar = pRR(x - 1.6, y - 6, 3.2, 6, 1.6); c.fillStyle = '#3a2c1a'; c.fill(ar); }
    const top = new Path2D(); top.ellipse(16, 14, 17, 9, 0, 0, Math.PI * 2); wFlat(c, top, '#d8c890', 1.3);
    const field = new Path2D(); field.ellipse(16, 14, 12, 5.6, 0, 0, Math.PI * 2); wFlat(c, field, '#5f9a44', 1);
    wLine(c, [[16, 8.6], [16, 19.4]], .7, 'rgba(255,255,255,.7)');
    wLine(c, [[-1, 14], [-1, 22]], 1.3); wLine(c, [[33, 14], [33, 22]], 1.3);
    for (const fx of [4, 16, 28]) { wLine(c, [[fx, fx === 16 ? 5 : 9], [fx, fx === 16 ? -6 : -1]], 1); const f = pPoly([[fx, fx === 16 ? -6 : -1], [fx + 5, fx === 16 ? -4.5 : .5], [fx, fx === 16 ? -3 : 2]]); wFlat(c, f, '#f2c14e', .8); }
  },
  D: (c, P, r, e) => {
    const m = wBlob(16, 22, 15, 11, r, 9); wCel(c, m, P.rock, 1.8, 1.35);
    wHatch(c, m, 2.8, .6, 'rgba(29,20,15,.25)', 1.1);
    const mouth = new Path2D(); mouth.moveTo(9, 31); mouth.lineTo(9, 22); mouth.quadraticCurveTo(16, 11, 23, 22); mouth.lineTo(23, 31); mouth.closePath();
    c.fillStyle = '#07060c'; c.fill(mouth); wStroke(c, mouth, 1.3);
    for (const [x, y] of [[8, 21], [12, 15], [20, 15], [24, 21]]) { const st = pRR(x - 2, y - 2, 4, 4, 1); wFlat(c, st, '#8a8f96', .8); }
  },
  H: (c, P, r) => {
    wShadow(c, 17, 29, 13, 3, .3);
    wHouse(c, 6, 15, 20, 14, '#7a5a32', P, r, true);
    wLine(c, [[9, 16], [13, 19]], .7, 'rgba(29,20,15,.6)');
  },
  e: (c, P, r) => {
    wShadow(c, 16, 28, 16, 3.5, .3);
    const hull = new Path2D(); hull.moveTo(0, 27); hull.quadraticCurveTo(2, 12, 16, 11); hull.quadraticCurveTo(30, 12, 32, 27); hull.closePath();
    wCel(c, hull, '#a59a86', 1.6, 1.35);
    for (let i = 1; i < 6; i++) wLine(c, [[i * 5.3, 27], [i * 5.3 + (i - 3) * .8, 14]], .8, 'rgba(29,20,15,.55)');
    wLine(c, [[3, 21], [29, 21]], .7, 'rgba(29,20,15,.5)');
    wLine(c, [[16, 11], [16, 3]], 1.3); wLine(c, [[16, 5], [21, 8]], .8);
  },
  N: (c, P, r, e, v) => {
    wShadow(c, 16, 25, 12, 3.5, .3);
    const n = new Path2D(); n.ellipse(16, 21, 12, 6.5, 0, 0, Math.PI * 2);
    wCel(c, n, '#94703f', 1.2, 1.3);
    const inner = new Path2D(); inner.ellipse(16, 20, 8, 3.8, 0, 0, Math.PI * 2); c.fillStyle = '#4a351c'; c.fill(inner);
    for (let i = 0; i < 9; i++) { const a = i * .7 + r(); wLine(c, [[16 + Math.cos(a) * 11, 21 + Math.sin(a) * 6], [16 + Math.cos(a + .9) * 9, 21 + Math.sin(a + .9) * 5.5]], .7, 'rgba(29,20,15,.7)'); }
    if (v !== '0') {
      const e1 = pEl(13, 18, 3, 3.8), e2 = pEl(19, 18.5, 2.8, 3.5);
      wCel(c, e1, '#f4efe0', .8, 1); wCel(c, e2, '#e0f2d8', .8, 1);
      c.fillStyle = '#b38cf0'; c.fillRect(12.5, 17, 1.2, 1.2); c.fillStyle = '#f0803c'; c.fillRect(19, 19, 1.2, 1.2);
    }
  },
  V: (c, P, r, e, v) => {
    const dead = v.endsWith('0'), col = WELEM[v.replace('0', '')] || WELEM.aether;
    wShadow(c, 16, 28, 10, 3, .3);
    const b = pPoly([[6, 29], [8, 24], [24, 24], [26, 29]]); wCel(c, b, '#6b7078', 1, 1.2);
    const cr = pPoly([[16, 2], [21, 10], [19.5, 24], [12.5, 24], [11, 10]]);
    wCel(c, cr, dead ? '#7b8088' : col[0], 1.6, 1.3);
    wLine(c, [[16, 3], [16, 23]], .7, 'rgba(29,20,15,.45)');
    const sh = pPoly([[12.5, 9], [14.5, 5], [14.5, 20], [13, 20]]); c.fillStyle = dead ? 'rgba(255,255,255,.2)' : col[1]; c.globalAlpha = .7; c.fill(sh); c.globalAlpha = 1;
    const s2 = pPoly([[22, 24], [24, 17], [26, 24]]); wCel(c, s2, dead ? '#7b8088' : col[0], .8, 1);
  },
  Y: (c, P, r, e, v) => {
    wShadow(c, 16, 28, 12, 3, .3);
    const b = wBlob(16, 19, 12, 9.5, r, 9); wCel(c, b, tint(P.canopy, .05), 2, 1.35);
    if (v !== '0') {
      const bc = { bloom: '#e0457b', ember: '#ff8a3c', tide: '#6fd0e0', rime: '#d8f2fb', aether: '#b38cf0' }[v] || P.berry;
      for (const [x, y] of [[10, 16], [17, 13], [21, 19], [12, 22], [17, 21], [23, 14]]) { const p = pEl(x, y, 1.9, 1.9); c.fillStyle = bc; c.fill(p); wStroke(c, p, .7); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - .9, y - .9, .8, .8); }
    }
  },
  Z: (c, P, r, e, v) => {
    wShadow(c, 16, 26, 15, 4, .35);
    const ring = new Path2D(); ring.ellipse(16, 22, 14, 7, 0, 0, Math.PI * 2); wCel(c, ring, '#7a5a32', 1.2, 1.35);
    const inner = new Path2D(); inner.ellipse(16, 21, 9, 4, 0, 0, Math.PI * 2); c.fillStyle = '#2e2013'; c.fill(inner);
    for (const bx of [4, 28]) { const tusk = new Path2D(); tusk.moveTo(bx - 1.5, 24); tusk.quadraticCurveTo(bx - 3, 10, bx + (bx < 16 ? 4 : -4), 1); tusk.quadraticCurveTo(bx + (bx < 16 ? 1 : -1), 10, bx + 1.5, 24); tusk.closePath(); wCel(c, tusk, '#ece4cc', .8, 1.1); }
    if (v !== '0') { const egg = pEl(16, 18, 4, 5); wCel(c, egg, '#f2c14e', 1, 1.1); c.fillStyle = '#fff6cf'; c.fillRect(14.5, 15.5, 1.4, 1.4); }
  },
  S: (c, P, r) => {
    wShadow(c, 16, 29, 6, 2, .3);
    wFlat(c, pRR(14.6, 14, 2.8, 15, .6), '#5a3d22', 1.1);
    const b = pRR(5, 6, 22, 11, 1.6); wCel(c, b, '#d2ad70', 1.1, 1.3);
    wLine(c, [[8.5, 10], [23, 10]], .9, 'rgba(29,20,15,.7)'); wLine(c, [[8.5, 13.5], [19, 13.5]], .9, 'rgba(29,20,15,.7)');
  },
  l: (c, P, r) => {
    wShadow(c, 16, 30, 5, 1.6, .3);
    wFlat(c, pRR(14.8, 9, 2.4, 21, .6), '#2f3140', 1);
    wFlat(c, pRR(12, 28, 8, 2.5, .6), '#2f3140', .9);
    const lamp = pPoly([[11, 3], [21, 3], [19.5, 11], [12.5, 11]]); wFlat(c, lamp, '#ffd877', 1.2);
    wLine(c, [[16, 3], [16, 11]], .8, '#2f3140'); wFlat(c, pPoly([[10, 3], [16, -1], [22, 3]]), '#2f3140', 1);
  },
  W: (c, P, r, e) => {
    const b = pRR(2, 3, 28, 25, 1.5); wCel(c, b, '#5b4316', 1.2, 1.35);
    c.fillStyle = '#3d2c10'; c.fillRect(4.5, 5.5, 23, 20);
    const cup = (x, y, s) => { const p = new Path2D(); p.moveTo(x - 3 * s, y); p.lineTo(x + 3 * s, y); p.quadraticCurveTo(x + 3 * s, y + 4 * s, x, y + 4.5 * s); p.quadraticCurveTo(x - 3 * s, y + 4 * s, x - 3 * s, y); p.closePath(); wFlat(c, p, '#f2c14e', .8); wLine(c, [[x, y + 4.5 * s], [x, y + 6 * s]], 1, '#c9962a'); wLine(c, [[x - 2 * s, y + 6.4 * s], [x + 2 * s, y + 6.4 * s]], 1, '#c9962a'); };
    cup(10, 8, 1); cup(22, 8, .9);
    for (const [x, y] of [[9, 19], [16, 19], [23, 19]]) { c.fillStyle = '#c9962a'; c.beginPath(); c.arc(x, y, 1.1, 0, 7); c.fill(); }
  },
  h: (c, P, r) => {
    const b = pRR(3, 6, 26, 24, 2); wCel(c, b, '#7a756e', 1.2, 1.35);
    for (let i = 0; i < 3; i++) wLine(c, [[3, 11 + i * 6], [29, 11 + i * 6]], .6, 'rgba(29,20,15,.4)');
    const op = new Path2D(); op.moveTo(8, 30); op.lineTo(8, 18); op.quadraticCurveTo(16, 11, 24, 18); op.lineTo(24, 30); op.closePath();
    c.fillStyle = '#1a1210'; c.fill(op); wStroke(c, op, 1.1);
    wFlat(c, pRR(2, 5, 28, 3, 1), '#8a857e', 1);
    wLine(c, [[11, 29], [21, 27]], 1.4, '#5a3d22'); wLine(c, [[11, 27], [21, 29]], 1.4, '#5a3d22');
  },
  B: (c, P, r) => {
    wShadow(c, 17, 30, 12, 2.5, .25);
    const fr = pRR(5, 3, 22, 27, 2); wCel(c, fr, '#7a5a32', 1, 1.3);
    const pil = pRR(8, 5, 16, 6, 2.5); wCel(c, pil, '#f4efe0', .8, 1);
    const bl = pRR(7, 12, 18, 16, 1.5); wCel(c, bl, '#3f7d8a', 1, 1.1);
    wLine(c, [[7, 15], [25, 15]], 1, '#9fd0d8');
  },
  k: (c, P, r) => {
    wShadow(c, 16, 29, 14, 2.5, .25);
    const top = pRR(1.5, 13, 29, 6, 1); wCel(c, top, '#6a6d80', .8, 1.2);
    wFlat(c, pRR(3, 19, 3, 10, .5), '#3c3e4e', 1); wFlat(c, pRR(26, 19, 3, 10, .5), '#3c3e4e', 1);
    const fl = new Path2D(); fl.moveTo(7, 13); fl.lineTo(7, 7); fl.lineTo(5.5, 3.5); fl.lineTo(10.5, 3.5); fl.lineTo(9, 7); fl.lineTo(9, 13); fl.closePath(); wFlat(c, fl, '#7be0b0', .9);
    const fl2 = pEl(16, 9.5, 3.5, 3.5); wFlat(c, fl2, '#b38cf0', .9); wFlat(c, pRR(15, 3.5, 2, 3, .5), '#cfeee0', .7);
    wFlat(c, pRR(22, 8, 4, 5, 1), '#f0803c', .9);
  },
  E: (c, P, r) => {
    wShadow(c, 16, 29, 9, 2.5, .3);
    wCel(c, pRR(7, 21, 18, 8, 1.5), '#55586e', 1, 1.2);
    const dome = new Path2D(); dome.moveTo(8, 21); dome.quadraticCurveTo(8, 4, 16, 4); dome.quadraticCurveTo(24, 4, 24, 21); dome.closePath();
    c.fillStyle = 'rgba(123,224,176,.55)'; c.fill(dome);
    const egg = pEl(16, 15, 4, 5); wCel(c, egg, '#f4efe0', .8, 1);
    wStroke(c, dome, 1.2); wLine(c, [[11, 9], [11.5, 16]], 1.2, 'rgba(255,255,255,.7)');
  },
  C: (c, P, r, e, v) => {
    wShadow(c, 16, 28, 12, 3, .35);
    const open = v === '0';
    const body = pRR(4, 14, 24, 14, 2); wCel(c, body, '#8a5630', 1.2, 1.35);
    if (open) { const lid = pRR(4, 5, 24, 9, 3); wCel(c, lid, '#6a4024', 1, 1.3); c.fillStyle = '#1a1210'; c.fillRect(6, 13, 20, 3); }
    else { const lid = pRR(3.5, 9, 25, 8, 3.5); wCel(c, lid, '#9a6236', 1.2, 1.35); }
    for (const bx of [9, 23]) { c.fillStyle = '#c9a24a'; c.fillRect(bx - 1.5, open ? 14 : 9, 3, open ? 14 : 19); c.lineWidth = .7; c.strokeStyle = WINKC; c.strokeRect(bx - 1.5, open ? 14 : 9, 3, open ? 14 : 19); }
    if (!open) wFlat(c, pRR(14, 15, 4, 5, 1), '#f2c14e', .9);
  },
  '<': (c, P, r) => {
    c.fillStyle = '#121019'; c.fillRect(2, 2, 28, 28);
    for (let i = 0; i < 5; i++) { const y = 26 - i * 5, x = 3 + i * 1.5; const st = pRR(x, y - 4, 26 - i * 3, 5, .8); wCel(c, st, tint('#8a8f9a', -i * .1), .8, 1); }
    wStroke(c, pRR(2, 2, 28, 28, 1.5), 1.3);
  },
  '-': (c, P, r, e) => {
    const L = e.at(-1, 0) === '-', R = e.at(1, 0) === '-';
    const x0 = L ? -1 : 2, x1 = R ? 33 : 30;
    const p = new Path2D(); p.rect(x0, 10, x1 - x0, 15);
    c.fillStyle = '#7a5a32'; c.fill(p);
    c.fillStyle = '#b07a3c'; c.fillRect(x0, 8, x1 - x0, 5); c.fillStyle = 'rgba(255,240,200,.25)'; c.fillRect(x0, 8, x1 - x0, 1.2);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x0, 21, x1 - x0, 4);
    c.lineWidth = 1.3; c.strokeStyle = WINKC; c.beginPath(); c.moveTo(x0, 8); c.lineTo(x1, 8); c.moveTo(x0, 13); c.lineTo(x1, 13); c.moveTo(x0, 25); c.lineTo(x1, 25);
    if (!L) { c.moveTo(x0, 8); c.lineTo(x0, 25); } if (!R) { c.moveTo(x1, 8); c.lineTo(x1, 25); } c.stroke();
    wLine(c, [[x0, 25.5], [x1, 25.5]], 2, 'rgba(20,12,8,.25)');
  },
  R: (c, P, r) => {
    wShadow(c, 16, 28, 13, 3, .3);
    for (const [x, y, rx, ry] of [[10, 23, 7, 5], [21, 22, 8, 6], [15, 15, 6, 5], [24, 27, 5, 3]]) { const b = wBlob(x, y, rx, ry, r, 7); wCel(c, b, '#7c776f', 1.2, 1.2); }
  },
  M: (c, P, r, e) => {
    const mt = wMeta(e.m, e.x, e.y) || {};
    const kind = mt.kind || (typeof KIND !== 'undefined' && KIND.troll ? 'troll' : 'goblin');
    const t0 = G.time; G.time = 0;
    try { drawAny(c, kind, 16, 31, 44, { color: '#c9962a', light: '#ffe9a8', short: 'A' }, { flip: wHash(e.x, e.y, 4) < .5 }); } finally { G.time = t0; }
  },
  F: (c, P, r) => {
    wShadow(c, 16, 29, 15, 3.5, .3);
    const outer = new Path2D(); outer.ellipse(16, 22, 15, 8, 0, 0, Math.PI * 2); wCel(c, outer, '#9a9a9a', 1.2, 1.35);
    const pool = new Path2D(); pool.ellipse(16, 21.5, 11.5, 5.5, 0, 0, Math.PI * 2); c.fillStyle = '#4f9fe0'; c.fill(pool); wStroke(c, pool, .9);
    wLine(c, [[9, 20], [13, 19.5]], 1, 'rgba(255,255,255,.7)');
    const plinth = pRR(13, 12, 6, 9, 1); wCel(c, plinth, '#b8b8bc', .8, 1.1);
    const fig = new Path2D(); fig.moveTo(13.5, 12); fig.lineTo(14, 4); fig.lineTo(18, 4); fig.lineTo(18.5, 12); fig.closePath(); wCel(c, fig, '#c9c9cc', .8, 1.1);
    const head = pEl(16, 2.5, 2.2, 2.2); wCel(c, head, '#c9c9cc', .5, 1);
    wLine(c, [[18, 6], [23, 2]], 1.2); const orb = pEl(23.5, 1.5, 1.6, 1.6); wFlat(c, orb, '#f2c14e', .8);
  },
  m: (c, P, r) => {
    wShadow(c, 16, 30, 14, 2.5, .3);
    wFlat(c, pRR(3, 9, 2.4, 21, .5), '#7a5a32', 1); wFlat(c, pRR(26.6, 9, 2.4, 21, .5), '#7a5a32', 1);
    const ct = pRR(4, 19, 24, 9, 1); wCel(c, ct, '#a8824a', 1, 1.2);
    for (const [x, col] of [[8, '#f2c14e'], [14, '#5dbb63'], [20, '#e0457b']]) { const p = pEl(x + 1.5, 18, 2.6, 2); wFlat(c, p, col, .8); }
    const aw = new Path2D(); aw.moveTo(1, 11); aw.lineTo(4, 3); aw.lineTo(28, 3); aw.lineTo(31, 11); aw.closePath();
    c.save(); c.clip(aw); for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#f4efe0' : '#c8443a'; c.fillRect(i * 5, 0, 5, 12); } c.restore();
    wStroke(c, aw, 1.3);
    for (let i = 0; i < 6; i++) { const sc = pEl(3.5 + i * 5, 11, 2.5, 1.6); c.fillStyle = i % 2 ? '#f4efe0' : '#c8443a'; c.fill(sc); }
  },
  A: (c, P, r) => {
    wShadow(c, 16, 29, 12, 2.5, .3);
    wCel(c, pRR(8, 23, 16, 6, 1), '#3a2e2c', .8, 1.2);
    wCel(c, pRR(12, 17, 8, 7, .5), '#3c3e4e', .8, 1.1);
    const top = new Path2D(); top.moveTo(2, 12); top.lineTo(26, 12); top.lineTo(31, 14); top.lineTo(26, 17); top.lineTo(6, 17); top.quadraticCurveTo(2, 16, 2, 12); top.closePath();
    wCel(c, top, '#5c6074', 1, 1.3); wLine(c, [[5, 12.6], [25, 12.6]], .9, 'rgba(255,255,255,.4)');
  },
  u: (c, P, r) => {
    wShadow(c, 16, 30, 9, 2.5, .3);
    wLine(c, [[10, 29], [12, 21]], 1.4, '#2a2a34'); wLine(c, [[22, 29], [20, 21]], 1.4, '#2a2a34');
    const bowl = new Path2D(); bowl.moveTo(6, 17); bowl.lineTo(26, 17); bowl.quadraticCurveTo(25, 24, 16, 24); bowl.quadraticCurveTo(7, 24, 6, 17); bowl.closePath();
    wCel(c, bowl, '#3c3e4e', 1, 1.3);
    const coals = new Path2D(); coals.ellipse(16, 17, 10, 2.2, 0, 0, Math.PI * 2); c.fillStyle = '#c8441a'; c.fill(coals); wStroke(c, coals, .8);
  },
  j: (c, P, r) => {
    wShadow(c, 16, 26, 14, 3, .3);
    const hull = new Path2D(); hull.moveTo(2, 16); hull.lineTo(30, 16); hull.quadraticCurveTo(28, 25, 22, 26); hull.lineTo(9, 26); hull.quadraticCurveTo(4, 25, 2, 16); hull.closePath();
    wCel(c, hull, '#8a6a3c', 1.2, 1.35);
    wLine(c, [[3.5, 19.5], [28.5, 19.5]], .7, 'rgba(29,20,15,.5)');
    const eye = pEl(25, 21, 1.6, 1.6); wFlat(c, eye, '#4f9fe0', .6);
    wLine(c, [[15, 16], [15, 1]], 1.4);
    const sail = pPoly([[16, 2], [26, 13], [16, 13]]); wCel(c, sail, '#f4efe0', 1, 1.1);
  },
  y: (c, P, r) => {
    wShadow(c, 16, 29, 10, 2.5, .3);
    wFlat(c, pRR(5, 25, 22, 4, 1), '#6a4a2c', 1);
    const sk = new Path2D(); sk.moveTo(7, 25); sk.quadraticCurveTo(5, 6, 16, 5); sk.quadraticCurveTo(27, 6, 25, 25); sk.closePath();
    wCel(c, sk, '#d2ae6e', 1.4, 1.35);
    c.save(); c.clip(sk); for (let yy = 9; yy < 25; yy += 4) wLine(c, [[4, yy], [28, yy]], .8, 'rgba(29,20,15,.5)'); c.restore();
    c.fillStyle = '#2a1a0e'; c.beginPath(); c.ellipse(16, 22, 2.5, 2, 0, 0, 7); c.fill();
  },
  $: (c, P, r) => {
    wShadow(c, 16, 30, 6, 2, .3);
    wCel(c, pRR(13, 9, 6, 21, 1), '#7a5a32', .8, 1.2);
    for (const s of [-1, 1]) wLine(c, [[16 + s * 2, 9], [16 + s * 7, 3], [16 + s * 7, -2]], 1.6, '#e6d6b0');
    for (const s of [-1, 1]) wLine(c, [[16 + s * 5, 5], [16 + s * 10, 4]], 1.3, '#e6d6b0');
    const moss = wBlob(16, 15, 5, 3, r, 6); wCel(c, moss, '#4f8a3c', .8, 1);
    wFlat(c, pEl(12, 29, 2, 1.4), '#e0457b', .7); wFlat(c, pEl(20, 29.5, 2, 1.4), '#e0457b', .7);
  },
  r: (c, P, r) => {
    wShadow(c, 16, 29, 10, 2.5, .3);
    for (const [x, y, rx, ry, col] of [[16, 26, 10, 3.6, '#6f7682'], [15.5, 20.5, 8, 3.2, '#868d98'], [16.5, 15.5, 6, 3, '#7a818c'], [16, 10.5, 4, 2.6, '#8f96a0']]) { const b = wBlob(x, y, rx, ry, r, 7); wCel(c, b, col, .9, 1.15); }
    c.fillStyle = '#f4f8fa'; c.beginPath(); c.ellipse(16, 9.4, 3, 1.2, 0, 0, 7); c.fill();
  },
  x: (c, P, r) => {
    wShadow(c, 17, 30, 5, 1.6, .3);
    wFlat(c, pRR(7.5, 2, 2.4, 28, .6), '#5a3d22', 1);
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(8.7, 1.8, 1.6, 0, 7); c.fill();
  },
  G: (c, P, r, e) => {
    wShadow(c, 16, 30, 11, 2.5, .3);
    wCel(c, pRR(6, 22, 20, 8, 1), '#8f939a', 1, 1.3);
    const t0 = G.time; G.time = 0;
    try { drawAny(c, 'elf', 16, 23, 30, { color: '#c9c9c9', light: '#eee', short: '' }, { stone: true, noShadow: true }); } finally { G.time = t0; }
  },
  v: (c, P, r) => {
    const rim = wBlob(16, 18, 14, 9, r, 9); wCel(c, rim, '#7a7f87', 1.2, 1.3);
    const pool = new Path2D(); pool.ellipse(16, 18, 10, 5.5, 0, 0, Math.PI * 2); c.fillStyle = '#235c9c'; c.fill(pool); wStroke(c, pool, .9);
    for (const [x, y] of [[12, 17], [16, 19], [20, 17]]) { c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(x, y, 1.3, 0, 7); c.fill(); c.fillStyle = WINKC; c.fillRect(x - .3, y - .9, .6, 1.8); }
  },
  P: (c, P, r, e, v, wall) => {
    const y0 = wall ? 15 : 4;
    const f = pRR(7, y0, 18, 13, 1); wCel(c, f, '#c9962a', .8, 1.2);
    c.fillStyle = '#b38cf0'; c.fillRect(9.5, y0 + 2.5, 13, 8);
    c.fillStyle = '#5dbb63'; c.beginPath(); c.moveTo(9.5, y0 + 10.5); c.lineTo(14, y0 + 5); c.lineTo(17, y0 + 8); c.lineTo(19, y0 + 6); c.lineTo(22.5, y0 + 10.5); c.closePath(); c.fill();
    c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(19.5, y0 + 4.5, 1.3, 0, 7); c.fill();
    c.lineWidth = .8; c.strokeStyle = WINKC; c.strokeRect(9.5, y0 + 2.5, 13, 8);
  },
  q: (c, P, r) => {
    wShadow(c, 16, 28, 13, 3, .3);
    wFlat(c, pRR(5, 18, 2.5, 10, .5), '#5a3d22', 1); wFlat(c, pRR(24.5, 18, 2.5, 10, .5), '#5a3d22', 1);
    const top = pRR(2, 9, 28, 11, 1.5); wCel(c, top, '#9a6a36', 1, 1.3);
    wLine(c, [[3, 14.5], [29, 14.5]], .6, 'rgba(29,20,15,.4)');
    const pl = pEl(10, 13.5, 3.5, 2.2); wFlat(c, pl, '#f4efe0', .8); const mug = pRR(19, 10.5, 3.5, 4, .8); wFlat(c, mug, '#e0457b', .8);
  },
  K: (c, P, r, e, v, wall) => {
    const y0 = wall ? 13 : 2, h = wall ? 18 : 28;
    const sh = pRR(3, y0, 26, h, 1); wCel(c, sh, '#5a3d22', .8, 1.3);
    const rows = wall ? 2 : 3, rh = (h - 2) / rows;
    for (let i = 0; i < rows; i++) {
      const yy = y0 + 1 + i * rh; c.fillStyle = '#2e2013'; c.fillRect(5, yy + 1, 22, rh - 2.5);
      let x = 5.6; const rr2 = wRng((e.x * 31 + e.y * 7 + i) | 0);
      while (x < 25.5) { const w = 1.6 + rr2() * 1.6, bh = rh - 3 - rr2() * 2.5; c.fillStyle = ['#b0485a', '#4f9fe0', '#5dbb63', '#f2c14e', '#b38cf0', '#d8cfae'][(rr2() * 6) | 0]; c.fillRect(x, yy + rh - 1.5 - bh, w, bh); x += w + .5; }
      wLine(c, [[4, yy + rh - 1.2], [28, yy + rh - 1.2]], 1, '#3a2612');
    }
  },
  t: (c, P, r, e, v, wall) => {
    const y0 = wall ? 12 : 3, h = wall ? 19 : 27;
    const cs = pRR(3, y0, 26, h, 1.5); wCel(c, cs, '#4a3218', .8, 1.3);
    c.fillStyle = '#16323c'; c.fillRect(5.5, y0 + 2.5, 21, h - 5);
    const cup = new Path2D(); const cx = 16, cy = y0 + h * .3; cup.moveTo(cx - 4, cy); cup.lineTo(cx + 4, cy); cup.quadraticCurveTo(cx + 4, cy + 5, cx, cy + 6); cup.quadraticCurveTo(cx - 4, cy + 5, cx - 4, cy); cup.closePath();
    wFlat(c, cup, '#f2c14e', .8); c.fillStyle = '#c9962a'; c.fillRect(cx - 1, cy + 6, 2, 2.5); c.fillRect(cx - 3, cy + 8.5, 6, 1.5);
    wLine(c, [[7.5, y0 + 4], [10, y0 + h - 5]], 1, 'rgba(160,240,220,.6)');
  },
  '&': (c, P, r) => {
    wShadow(c, 16, 30, 12, 2.5, .3);
    wLine(c, [[4, 30], [6, 3]], 2, '#5a3d22'); wLine(c, [[28, 30], [26, 3]], 2, '#5a3d22'); wLine(c, [[4, 4], [28, 4]], 2.4, '#5a3d22');
    const bell = new Path2D(); bell.moveTo(11, 22); bell.quadraticCurveTo(10, 8, 16, 7); bell.quadraticCurveTo(22, 8, 21, 22); bell.lineTo(23, 24); bell.lineTo(9, 24); bell.closePath();
    wCel(c, bell, '#c9962a', 1.2, 1.3);
    const cl = pEl(16, 25.5, 1.8, 1.8); wFlat(c, cl, '#3a2c1a', .8);
  },
  I: (c, P, r) => {
    wShadow(c, 16, 29, 13, 3, .3);
    const front = pRR(4, 11, 22, 18, 1); const top = pPoly([[4, 11], [9, 5], [31, 5], [26, 11]]); const side = pPoly([[26, 11], [31, 5], [31, 23], [26, 29]]);
    c.fillStyle = '#cfeaf4'; c.fill(front); c.fillStyle = '#eef9fd'; c.fill(top); c.fillStyle = '#98c8dc'; c.fill(side);
    c.fillStyle = WINKC; c.beginPath(); c.arc(12, 18, 1.2, 0, 7); c.arc(18, 18, 1.2, 0, 7); c.fill();
    wLine(c, [[11.5, 22], [15, 24], [18.5, 22]], .9);
    wStroke(c, front, 1.2); wStroke(c, top, 1.2); wStroke(c, side, 1.2);
    wLine(c, [[6.5, 14], [8, 20]], 1.2, 'rgba(255,255,255,.85)');
  },
  b: (c, P, r, e) => {
    // planks across the water, running along the road
    const land = ch => ch != null && ch !== '~' && ch !== 'b' && ch !== 'w' && ch !== 'j';
    const horiz = (e.at(-1, 0) === 'b' || land(e.at(-1, 0))) && (e.at(1, 0) === 'b' || land(e.at(1, 0))) || (!(e.at(0, -1) === 'b' || land(e.at(0, -1))) && !(e.at(0, 1) === 'b' || land(e.at(0, 1))));
    c.save();
    if (!horiz) { c.translate(32, 0); c.rotate(Math.PI / 2); }
    c.fillStyle = 'rgba(10,20,30,.3)'; c.fillRect(-1, 9, 34, 18);
    for (let i = 0; i < 8; i++) { const x = i * 4, p = pRR(x + .2, 6.5 + (r() - .5), 3.6, 19, .6); c.fillStyle = tint('#9a7444', (r() - .5) * .2); c.fill(p); wStroke(c, p, .6, 'rgba(29,20,15,.75)'); }
    wLine(c, [[-1, 7], [33, 7]], 1.8, '#5a3d22'); wLine(c, [[-1, 25], [33, 25]], 1.8, '#5a3d22');
    wLine(c, [[-1, 5.8], [33, 5.8]], 1, WINKC); wLine(c, [[-1, 26.2], [33, 26.2]], 1, WINKC);
    for (const px of [4, 20]) { wFlat(c, pRR(px, 4, 3, 4, .6), '#5a3d22', .8); wFlat(c, pRR(px, 24, 3, 4, .6), '#5a3d22', .8); }
    c.restore();
  },
  w: (c, P, r, e) => {
    c.fillStyle = 'rgba(10,20,30,.3)'; c.fillRect(2, 3, 32, 32);
    for (let row = 0; row < 4; row++) { const y = row * 8, p = pRR(0, y + .5, 32, 7, .8); c.fillStyle = tint('#ab946a', (r() - .5) * .18); c.fill(p); wStroke(c, p, .6, 'rgba(29,20,15,.7)'); const j = 4 + r() * 24; wLine(c, [[j, y + .5], [j, y + 7.5]], .6, 'rgba(29,20,15,.6)'); }
    const water = ch => ch === '~' || ch === 'j';
    if (water(e.at(0, 1))) { wLine(c, [[0, 32], [32, 32]], 1.4); for (const px of [3, 26]) wFlat(c, pRR(px, 28, 3, 6, .6), '#5a3d22', .8); }
    if (water(e.at(-1, 0))) wLine(c, [[0, 0], [0, 32]], 1.4); if (water(e.at(1, 0))) wLine(c, [[32, 0], [32, 32]], 1.4);
  },
};
// furniture hung on a wall when its tile's meta says it stands in a wall
const WONWALL = { P: 1, K: 1, t: 1, S: 1 };
// tiles with something moving: drawn live over the cached layer
const WANIM = { h: 1, u: 1, l: 1, V: 1, D: 1, F: 1, x: 1 };

/* ---------- building a chunk ---------- */
function wTile(c, L, x, y, s, fn) {
  // c is in device pixels; place the tile's logical origin
  c.setTransform(s, 0, 0, s, x * WTILE * s - L._ox, y * WTILE * s - L._oy);
  fn();
}
function wBuildChunk(L, cx, cy) {
  const m = L.m, s = L.s;
  const x0 = cx * WCH, y0 = cy * WCH, x1 = Math.min(m.w, x0 + WCH), y1 = Math.min(m.h, y0 + WCH);
  const px0 = Math.round(x0 * WTILE * s), py0 = Math.round(y0 * WTILE * s);
  const cw = Math.round(x1 * WTILE * s) - px0, chh = Math.round(y1 * WTILE * s) - py0;
  const cv2 = document.createElement('canvas'); cv2.width = Math.max(1, cw); cv2.height = Math.max(1, chh);
  const c = cv2.getContext('2d');
  L._ox = px0; L._oy = py0;
  const K = { cv: cv2, x: px0, y: py0, w: cw, h: chh, anim: [], lava: null };
  const env = (x, y) => ({ m, L, x, y, at: (dx, dy) => wAt(m, x + dx, y + dy) });
  const bg = m.kind === 'dungeon' ? '#0b0a10' : '#1a1410';

  // 1. water: see-through, tinted by region and depth (a tiny canvas upscaled smoothly so depth has no tile edges)
  if (L.water) {
    const tw = x1 - x0 + 2, th = y1 - y0 + 2, tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
    const tg = tc.getContext('2d'), img = tg.createImageData(tw, th);
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
      const x = x0 + tx - 1, y = y0 + ty - 1, g = wGround(L, Math.max(0, Math.min(m.w - 1, x)), Math.max(0, Math.min(m.h - 1, y)));
      if (g !== '~') continue;
      let d = 3.6;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = Math.hypot(dx, dy); if (dd >= d) continue; const g2 = wGround(L, Math.max(0, Math.min(m.w - 1, x + dx)), Math.max(0, Math.min(m.h - 1, y + dy))); if (g2 !== '~' && g2 != null) d = dd; }
      const reg = wRegion(m, Math.max(0, Math.min(m.w - 1, x)), Math.max(0, Math.min(m.h - 1, y)));
      const P = WINK[reg] || WINK.plains, wc = rgbOf(P.water);
      const i = (ty * tw + tx) * 4;
      // shallow water lifts toward a pale turquoise; deep water sinks toward navy
      const k = Math.max(0, Math.min(1, (d - 1) / 2.4)), A = [150, 215, 205, .42], B = [12, 40, 72, .34];
      const sh = k < .5 ? A.map((v, j) => v + ([90, 170, 190, .16][j] - v) * k * 2) : [90, 170, 190, .16].map((v, j) => v + (B[j] - v) * (k - .5) * 2);
      img.data[i] = Math.round(wc[0] * .4 + sh[0] * .6); img.data[i + 1] = Math.round(wc[1] * .4 + sh[1] * .6); img.data[i + 2] = Math.round(wc[2] * .4 + sh[2] * .6);
      img.data[i + 3] = Math.round(255 * (sh[3] + (m.kind === 'dungeon' ? .25 : 0)));
    }
    tg.putImageData(img, 0, 0);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(tc, -WTILE * s - (px0 - x0 * WTILE * s), -WTILE * s - (py0 - y0 * WTILE * s), tw * WTILE * s, th * WTILE * s);
    c.restore();
  }
  // 2. ground, then the spills of higher ground over it
  const lavaP = new Path2D();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ch = wAt(m, x, y), g = wGround(L, x, y), P = wPal(L, x, y), e = env(x, y);
    wTile(c, L, x, y, s, () => {
      c.save(); c.beginPath(); c.rect(0, 0, 32, 32); c.clip();
      if (g === 'L') {
        lavaP.rect(Math.round(x * WTILE * s) - px0, Math.round(y * WTILE * s) - py0, Math.round((x + 1) * WTILE * s) - Math.round(x * WTILE * s), Math.round((y + 1) * WTILE * s) - Math.round(y * WTILE * s));
      } else if (g && WGND[g]) WGND[g](c, P, wRng((x * 7919 + y * 104729 + 17) | 0), e);
      else if (g == null) { c.fillStyle = bg; c.fillRect(0, 0, 32, 32); }
      // spills
      const pg = WPRI[g];
      if (g && pg > 0) {
        const types = new Set();
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const n = wGround(L, x + dx, y + dy); if (n && n !== g && n !== '~' && ((WPRI[n] > pg && WGND[n]) || (g === '~' && n === 'L'))) types.add(n); }
        for (const n of [...types].sort((a, b) => WPRI[a] - WPRI[b])) {
          const sp = wSpillPath(L, x, y, n, g), Pn = wPal(L, x, y);
          if (g === '~') { c.lineWidth = 6; c.strokeStyle = 'rgba(240,250,245,.42)'; c.stroke(sp); c.lineWidth = 3.2; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke(sp); }
          if (g === 'L') { c.save(); c.shadowColor = '#ffb02e'; c.shadowBlur = 6; c.lineWidth = 4; c.strokeStyle = '#ffcf5a'; c.stroke(sp); c.restore(); }
          c.lineWidth = g === '~' || g === 'L' ? 2.6 : 1.8; c.strokeStyle = g === '~' || g === 'L' ? WINKC : 'rgba(29,20,15,.42)'; c.stroke(sp);
          c.save(); c.clip(sp); (n === 'L' ? wObsidian : WGND[n])(c, Pn, wRng((x * 7919 + y * 104729 + n.charCodeAt(0)) | 0), e); c.restore();
        }
      }
      // shadow cast by a wall onto the floor below it
      const up = wAt(m, x, y - 1);
      if (!WWALL[ch] && up && (WWALL[up] || ((wMeta(m, x, y - 1) || {}).under in WWALL)) && !WWALL[ch]) {
        const gr = c.createLinearGradient(0, 0, 0, 8); gr.addColorStop(0, 'rgba(15,8,5,.38)'); gr.addColorStop(1, 'rgba(15,8,5,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 8);
      }
      c.restore();
    });
  }
  K.lava = L.lava ? lavaP : null;
  // 3. soft light and shade across the land, so big fields never look tiled (again a tiny canvas, upscaled)
  {
    const tw = x1 - x0 + 2, th = y1 - y0 + 2, tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
    const tg = tc.getContext('2d'), img = tg.createImageData(tw, th);
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
      const x = x0 + tx - 1, y = y0 + ty - 1, nv = wNoise(x, y, 5, 3) * .65 + wNoise(x, y, 2, 4) * .35 - .5, i = (ty * tw + tx) * 4;
      if (nv > 0) { img.data[i] = 255; img.data[i + 1] = 246; img.data[i + 2] = 200; } else { img.data[i] = 10; img.data[i + 1] = 20; img.data[i + 2] = 10; }
      img.data[i + 3] = Math.round(Math.min(1, Math.abs(nv) * 2.2) * 58);
    }
    tg.putImageData(img, 0, 0);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.imageSmoothingEnabled = true;
    c.drawImage(tc, -WTILE * s - (px0 - x0 * WTILE * s), -WTILE * s - (py0 - y0 * WTILE * s), tw * WTILE * s, th * WTILE * s);
    c.restore();
  }
  // 4. objects, back to front; rows below the chunk too, since tall things reach up into it
  const objs = [];
  for (let y = y0 - 1; y < Math.min(m.h, y1 + 1); y++) for (let x = x0 - 1; x < Math.min(m.w, x1 + 1); x++) {
    if (x < 0 || y < 0) continue;
    const ch = wAt(m, x, y);
    if (ch && WOBJ[ch]) objs.push([y, x, ch]);
    if (ch && WANIM[ch] && x >= x0 && x < x1 && y >= y0 && y < y1) K.anim.push([x, y, ch, wVariant(m, x, y, ch)]);
  }
  objs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(0, 0, cw, chh); c.clip();
  for (const [y, x, ch] of objs) {
    const P = wPal(L, x, y), e = env(x, y), v = wVariant(m, x, y, ch), mt = wMeta(m, x, y);
    const onWall = WONWALL[ch] && mt && mt.under && WWALL[mt.under];
    wTile(c, L, x, y, s, () => {
      c.save();
      try {
        let front = false;
        if (onWall) front = wWallFace(c, P, e, mt.under);
        WOBJ[ch](c, P, wRng((x * 3301 + y * 7177 + ch.charCodeAt(0)) | 0), e, v, onWall && front);
      } catch (err) { if (typeof console !== 'undefined') console.error('w4 tile', ch, err); }
      c.restore();
    });
  }
  // unknown codes still show: an inked plaque with the character on it
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ch = wAt(m, x, y);
    if (ch && !WOBJ[ch] && !WGND[ch]) wTile(c, L, x, y, s, () => { const p = pRR(5, 5, 22, 22, 4); wCel(c, p, '#d8cfae', 1.2, 1.3); txt(c, ch, 16, 22, F_HUD(18), WINKC, 'center'); });
  }
  c.restore();
  // 5. paper grain over everything
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = wGrain(s); c.globalAlpha = m.kind === 'dungeon' ? .5 : 1;
  c.translate(-px0 % 128, -py0 % 128); c.fillRect(0, 0, cw + 128, chh + 128); c.restore();
  return K;
}
let wGrainPat = null, wGrainS = 0;
function wGrain(s) {
  if (wGrainPat && wGrainS === s) return wGrainPat;
  const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 128; const g = cv2.getContext('2d'), r = wRng(99);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? 'rgba(40,24,10,.07)' : 'rgba(255,248,225,.07)'; g.fillRect(r() * 128, r() * 128, 1 + r() * 1.4, 1 + r() * 1.4); }
  for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(40,24,10,.045)'; g.lineWidth = .8; g.beginPath(); const x = r() * 128, y = r() * 128; g.moveTo(x, y); g.lineTo(x + 4 + r() * 8, y + (r() - .5) * 3); g.stroke(); }
  wGrainPat = g.createPattern(cv2, 'repeat'); wGrainS = s; return wGrainPat;
}

/* ---------- live water and lava ---------- */
const WFLUID = {};
function wFluid(kind, col, s, fr) {
  const key = kind + col + s.toFixed(2) + ':' + fr;
  if (WFLUID[key]) return WFLUID[key];
  const N = kind === 'L' ? 256 : 128, D = Math.max(1, Math.round(N * s)), cv2 = document.createElement('canvas'); cv2.width = cv2.height = D;
  const g = cv2.getContext('2d'); g.scale(D / N, D / N);
  const ph = fr / 12 * Math.PI * 2, r = wRng(kind === 'L' ? 77 : 55);
  if (kind === '~') {
    g.fillStyle = col; g.fillRect(0, 0, N, N);
    // ripples: short inked wave strokes and pale highlights, drifting a little each frame; drawn wrapped so the tile repeats
    const waves = [];
    for (let i = 0; i < 26; i++) waves.push([r() * N, r() * N, 4 + r() * 6, r() * 6.28, r() < .35]);
    for (const [wx, wy, len, p0, hi] of waves) for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const x = wx + ox + Math.sin(ph + p0) * 2.2, y = wy + oy + Math.cos(ph + p0) * .8;
      if (x < -12 || x > N + 12 || y < -6 || y > N + 6) continue;
      g.beginPath(); g.moveTo(x - len, y); g.quadraticCurveTo(x - len / 2, y - 2.2, x, y); g.quadraticCurveTo(x + len / 2, y + 2.2, x + len, y);
      g.lineWidth = hi ? 1.3 : 1; g.strokeStyle = hi ? 'rgba(235,250,255,.55)' : 'rgba(18,40,60,.45)'; g.lineCap = 'round'; g.stroke();
    }
  } else {
    // lava: a dark-red flow, bright veins that crawl along, and cooled crust plates with glowing seams
    g.fillStyle = '#b5300e'; g.fillRect(0, 0, N, N);
    const wrap = (fn) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    for (let i = 0; i < 9; i++) {
      const y0 = r() * N, a = (r() - .5) * .6, amp = 3 + r() * 5, len = 40 + r() * 60, x0 = r() * N, p0 = r() * 6.28, w = 2 + r() * 3.5;
      wrap(() => {
        g.beginPath();
        for (let u = 0; u <= len; u += 4) { const x = x0 + u + Math.sin(ph + p0) * 3, y = y0 + u * a + Math.sin(u * .12 + p0 + ph) * amp; u ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.lineWidth = w + 5; g.strokeStyle = 'rgba(255,120,30,.45)'; g.stroke();
        g.lineWidth = w; g.strokeStyle = '#ffb02e'; g.stroke();
        g.lineWidth = w * .4; g.strokeStyle = '#fff0a0'; g.stroke();
      });
    }
    for (let i = 0; i < 11; i++) {
      const bx = r() * N, by = r() * N, rx = 5 + r() * 9, ry = 4 + r() * 6, p0 = r() * 6.28, seed = (r() * 1e6) | 0;
      wrap(() => {
        const pr = wRng(seed), pl = wBlob(bx + Math.cos(ph + p0) * 1.5, by + Math.sin(ph + p0) * 1, rx, ry, pr, 7);
        g.fillStyle = '#3e1a10'; g.fill(pl);
        g.save(); g.clip(pl); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(bx - rx, by - ry, rx * 2, ry * .8); g.restore();
        g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,170,60,.9)'; g.stroke(pl);
      });
    }
  }
  const pat = g.createPattern(cv2, 'repeat');
  return WFLUID[key] = { pat, size: D };
}

/* ---------- the frame ---------- */
const WNIGHT = { cv: null };
function wDrawMap(c, mapId, camX, camY, vw, vh, t, opts) {
  if (typeof MAPS === 'undefined' || !MAPS[mapId]) return;
  opts = opts || {}; t = t || 0;
  const m = MAPS[mapId], T = c.getTransform(), s = Math.max(.5, Math.min(8, Math.hypot(T.a, T.b)));
  const L = wLayer(m, Math.round(s * 100) / 100), sd = L.s;
  const ox = Math.round(T.e), oy = Math.round(T.f), W = Math.round(vw * sd), H = Math.round(vh * sd);
  const camDX = Math.round(camX * WTILE * sd), camDY = Math.round(camY * WTILE * sd);
  const bx = ox - camDX, by = oy - camDY; // device position of the map's origin
  const P0 = wMapPal(m);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.beginPath(); c.rect(ox, oy, W, H); c.clip();
  c.imageSmoothingEnabled = false;
  // the void beyond the map
  c.fillStyle = m.kind === 'dungeon' ? '#07060a' : m.kind === 'town' ? '#14100d' : '#163a4e'; c.fillRect(ox, oy, W, H);
  const mw = Math.round(m.w * WTILE * sd), mh = Math.round(m.h * WTILE * sd);
  // live water under the whole map (the world's ocean runs past its edge)
  if (L.water) {
    const fr = Math.floor(t * 5) % 12, F = wFluid('~', m.kind === 'world' ? WINK.plains.water : P0.water, sd, fr);
    F.pat.setTransform(new DOMMatrix([1, 0, 0, 1, bx, by]));
    c.fillStyle = F.pat;
    if (m.kind === 'world') {
      c.fillRect(ox, oy, W, H);
      // the open sea past the map's edge gets the same deep-water tint the chunks bake in
      const wc = rgbOf(WINK.plains.water), out = new Path2D(); out.rect(ox, oy, W, H); out.rect(bx, by, mw, mh);
      c.fillStyle = `rgba(${Math.round(wc[0] * .4 + 7)},${Math.round(wc[1] * .4 + 24)},${Math.round(wc[2] * .4 + 43)},.34)`; c.fill(out, 'evenodd');
    } else c.fillRect(Math.max(ox, bx), Math.max(oy, by), Math.min(ox + W, bx + mw) - Math.max(ox, bx), Math.min(oy + H, by + mh) - Math.max(oy, by));
  }
  const CP = WCH * WTILE * sd;
  const cx0 = Math.max(0, Math.floor(camDX / CP)), cy0 = Math.max(0, Math.floor(camDY / CP));
  const cx1 = Math.min(Math.ceil(m.w / WCH) - 1, Math.floor((camDX + W) / CP)), cy1 = Math.min(Math.ceil(m.h / WCH) - 1, Math.floor((camDY + H) / CP));
  const vis = [];
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const key = cx + ',' + cy;
    let K = L.chunks[key];
    if (!K) K = L.chunks[key] = wBuildChunk(L, cx, cy);
    vis.push(K);
  }
  // live lava, only inside the lava tiles of each chunk
  if (L.lava) {
    const F = wFluid('L', '', sd, Math.floor(t * 4) % 12);
    for (const K of vis) if (K.lava) { c.save(); c.translate(bx + K.x, by + K.y); F.pat.setTransform(new DOMMatrix([1, 0, 0, 1, -K.x, -K.y])); c.fillStyle = F.pat; c.fill(K.lava); c.restore(); }
  }
  for (const K of vis) c.drawImage(K.cv, bx + K.x, by + K.y);
  // live overlays in logical map coordinates
  c.setTransform(sd, 0, 0, sd, bx, by);
  c.imageSmoothingEnabled = true;
  const warm = [];
  for (const K of vis) for (const [x, y, ch, v] of K.anim) {
    const X = x * WTILE, Y = y * WTILE;
    if (X * sd + bx > ox + W + 64 || Y * sd + by > oy + H + 64 || (X + 32) * sd + bx < ox - 64 || (Y + 32) * sd + by < oy - 64) continue;
    c.save(); c.translate(X, Y);
    if (ch === 'h') { wFire(c, 16, 28, 1, t); warm.push([x, y, 2.6]); }
    else if (ch === 'u') { wFire(c, 16, 17, 1.1, t); warm.push([x, y, 2.6]); }
    else if (ch === 'l') { const f = .55 + Math.sin(t * 9 + x) * .08; wGlow(c, 16, 7, 14, `rgba(255,214,120,${f})`, 1); warm.push([x, y, 3]); }
    else if (ch === 'V' && !String(v).endsWith('0')) { const col = (WELEM[v] || WELEM.aether)[1], f = .45 + Math.sin(t * 3 + x * 2) * .2; wGlow(c, 16, 13, 16, col, f); c.fillStyle = col; for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1, py = 22 - ((t * 9 + i * 7) % 20); c.globalAlpha = .8; c.fillRect(16 + Math.sin(a) * 8, py, 1.5, 1.5); } }
    else if (ch === 'D') { const f = .5 + Math.sin(t * 2.2 + x) * .25; wGlow(c, 16, 25, 9, `rgba(179,140,240,${f})`, 1); }
    else if (ch === 'F') { c.fillStyle = 'rgba(220,245,255,.9)'; for (let i = 0; i < 4; i++) { const k = (t * 1.4 + i / 4) % 1; c.fillRect(16 + (i - 1.5) * 3 * k * 2, 4 + k * 16 - Math.sin(k * Math.PI) * 6, 1.3, 1.3); } }
    else if (ch === 'x') {
      const fl = new Path2D(); fl.moveTo(10, 3);
      for (let i = 0; i <= 6; i++) fl.lineTo(10 + i * 3, 3 + Math.sin(t * 5 + i * .9) * 1.6 * i / 6);
      for (let i = 6; i >= 0; i--) fl.lineTo(10 + i * 3, 14 + Math.sin(t * 5 + i * .9) * 1.6 * i / 6);
      fl.closePath(); c.fillStyle = P0.accent === '#ffb347' ? '#3f5aa8' : P0.accent; c.fill(fl);
      c.save(); c.clip(fl); c.fillStyle = '#f2c14e'; c.fillRect(10, 3, 20, 3); c.restore(); wStroke(c, fl, 1);
    }
    c.restore();
  }
  c.restore();
  // night
  // opts.noNight: the caller draws the night itself (after its actors), so skip it here, even in a dark dungeon
  const night = opts.noNight ? 0 : Math.max(opts.night || 0, m.dark ? .7 : 0);
  if (night > .02) {
    const lights = (opts.lights || []).slice();
    for (const l of (m.light || [])) lights.push([l[0], l[1], l[2] || 2.6]);
    for (const w of warm) lights.push(w);
    wNight(c, ox, oy, W, H, bx, by, sd, night, lights, m);
  }
}
function wNight(c, ox, oy, W, H, bx, by, s, night, lights, m) {
  // darkness drawn straight onto the view, except inside the bounding box of the lights, where an offscreen
  // layer at 1:1 device pixels gets radial holes punched in it (an upscaled low-res layer is slow in software canvases)
  const col = m.kind === 'dungeon' ? `rgba(4,3,10,${Math.min(.94, night)})` : `rgba(8,12,34,${Math.min(.86, night * .86)})`;
  const holes = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [lx, ly, lr] of lights) {
    const cx = bx + (lx + .5) * WTILE * s, cy = by + (ly + .5) * WTILE * s, rad = (lr || 3) * WTILE * s;
    if (cx < ox - rad || cy < oy - rad || cx > ox + W + rad || cy > oy + H + rad) continue;
    holes.push([cx, cy, rad]);
    x0 = Math.min(x0, cx - rad); y0 = Math.min(y0, cy - rad); x1 = Math.max(x1, cx + rad); y1 = Math.max(y1, cy + rad);
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(ox, oy, W, H); c.clip();
  c.fillStyle = col;
  if (!holes.length) { c.fillRect(ox, oy, W, H); c.restore(); return; }
  x0 = Math.max(ox, Math.floor(x0)); y0 = Math.max(oy, Math.floor(y0)); x1 = Math.min(ox + W, Math.ceil(x1)); y1 = Math.min(oy + H, Math.ceil(y1));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const out = new Path2D(); out.rect(ox, oy, W, H); out.rect(x0, y0, w, h);
  c.fill(out, 'evenodd');
  let cv2 = WNIGHT.cv; if (!cv2) cv2 = WNIGHT.cv = document.createElement('canvas');
  if (cv2.width < w || cv2.height < h) { cv2.width = Math.max(cv2.width, w); cv2.height = Math.max(cv2.height, h); }
  const g = cv2.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  for (const [cx, cy, rad] of holes) {
    const gx = cx - x0, gy = cy - y0, gr = g.createRadialGradient(gx, gy, rad * .15, gx, gy, rad);
    gr.addColorStop(0, 'rgba(0,0,0,.96)'); gr.addColorStop(.6, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  c.drawImage(cv2, 0, 0, w, h, x0, y0, w, h);
  c.globalCompositeOperation = 'lighter';
  for (const [x, y, r] of holes) { const gr = c.createRadialGradient(x, y, 0, x, y, r * .7); gr.addColorStop(0, `rgba(255,140,60,${.1 * night})`); gr.addColorStop(1, 'rgba(255,140,60,0)'); c.fillStyle = gr; c.fillRect(x - r * .7, y - r * .7, r * 1.4, r * 1.4); }
  c.restore();
}

/* ---------- actors: Sudden Death's creatures, small, through a sprite cache ---------- */
const WSPR = new Map();
function wDrawActor(c, who, px, py, t, opts) {
  if (!who || !who.kind) return;
  opts = opts || {}; t = t || 0;
  const hpx = opts.size || 34;
  const Tm = c.getTransform(), sc = Math.max(1, Math.min(4, Math.hypot(Tm.a, Tm.b)));
  const col = who.col || (who.team && who.team.color) || wActorCol(who.kind);
  const team = who.team || { color: col, light: who.light || tint(col, .55), short: who.short || '' };
  const flip = who.face === 'l';
  const walking = who.walk != null && who.walk !== false && who.walk !== 0;
  const phase = walking ? ((Math.floor(((typeof who.walk === 'number' ? who.walk : t * 10) % (Math.PI * 2) + Math.PI * 2) / (Math.PI / 4))) % 8) : -1;
  const key = [who.kind, team.color, team.light, flip ? 1 : 0, phase, hpx, sc.toFixed(2), who.crown ? 1 : 0].join('|');
  const W = Math.ceil(hpx * 1.9), H = Math.ceil(hpx * 1.6), ox = Math.round(W / 2), oy = Math.round(H * .9);
  let s = WSPR.get(key);
  if (!s) {
    const cv2 = document.createElement('canvas'); cv2.width = Math.ceil(W * sc); cv2.height = Math.ceil(H * sc);
    const g = cv2.getContext('2d'); g.setTransform(sc, 0, 0, sc, 0, 0);
    const t0 = G.time; G.time = 0;
    try { drawAny(g, who.kind, ox, oy, hpx, team, { flip, run: phase >= 0 ? phase * Math.PI / 4 + .01 : 0, crown: who.crown, num: who.num }); }
    catch (e) { console.error('w4 actor', who.kind, e); }
    finally { G.time = t0; }
    s = { cv: cv2 };
    if (WSPR.size > 600) WSPR.delete(WSPR.keys().next().value);
    WSPR.set(key, s);
  }
  // walking bobs with the stride; standing breathes a pixel
  const bob = walking ? -Math.abs(Math.sin(phase * Math.PI / 4)) * 2 : (Math.sin(t * 2.4 + (who.seed || 0)) > .6 ? -.5 : 0);
  c.save();
  if (opts.alpha != null) c.globalAlpha *= opts.alpha;
  const dx = Math.round(Tm.a * (px - ox) + Tm.e), dy = Math.round(Tm.d * (py - oy + bob) + Tm.f);
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true;
  c.drawImage(s.cv, dx, dy);
  c.restore();
}
function wActorCol(kind) {
  const cols = ['#d9573b', '#3fbf9f', '#7a4fc0', '#3f6f92', '#c98a3a', '#5a8a3a', '#b0485a', '#4f7fb0'];
  let h = 0; for (const ch of String(kind)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return cols[Math.abs(h) % cols.length];
}
