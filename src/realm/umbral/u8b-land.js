/* u8b: the dark land (issue #111, phase B). Loads after u7-feel.js; changes earlier parts only by reassignment (saved
   originals carry the wWU8B prefix).

   The dark maps keep their light maps' tiles (encounters, walking and every check read them); what changes is how a
   tile is drawn and described there. On a dark map (m.umbral):
     grass and tall grass   ash: grey ground, cinders, a few dead stalks (more in the tall grass)
     water and fen          black ichor, with an oily violet sheen
     trees, woods, pines    dead trees: bare grey trunks, no leaves
     snow                   bone-grey drift, with a bone poking out now and then
     sand                   salt crust: pale plates, cracked
   Each drawer draws through the tile's own random source, so a tile looks the same every time; the salt's plates are
   laid on a lattice in map coordinates, so they run on across tile edges. Look says the dark tile's words
   (W_UMB8B.look), unless the place has words of its own.
   The sky in a card match (Sudden Death's two skylights) is mirrored left for right on the dark side, the moon's on
   the right and the constellations reversed, and the dead moon hangs in the moon's dark part (or, when the moon is
   gibbous or full, just clear of it). The sky still does what it does on the light side; only the drawing changes. (The Realm's world view draws no sky of its own;
   baseball's engine draws its own and is left as it is.)

   W_UMB8B, wUmbSkyMirrored
   Wraps: WGND['.'], WGND['"'], WGND['~'], WGND.s, WGND.n, WGND[':'] (wWU8BGnd[ch]: ash, ichor, bone drift, salt), WOBJ.T,
   WOBJ.f, WOBJ.p (wWU8BObj[ch]: dead trees), wUmbralMap (wWU8BUmbralMap: the ichor's shades, m.waterSh, read by w4's
   chunk builder), wLookText (wWU8BLookText: the dark tiles' words), drawSky (wWU8BDrawSky: mirrored), drawMoon
   (wWU8BDrawMoon: the dead moon in its shadow), starsSVG and moonSVG (wWU8BStarsSVG, wWU8BMoonSVG: the
   chips reversed too), renderHelp (wWU8BRenderHelp: a line on the land). */

const W_UMB8B = {
  ash: '#5e5963', salt: '#d2cbc0', bone: '#ddd5c2', ichor: '#0c0612', trunk: '#6f6a72',
  // the water's shades baked into the map (w4's WWATER, by depth): black ichor, faintly violet in the shallows, and a
  // dim violet edge where the land meets it, never white foam
  // (thick enough that the live water under it barely shows; sea: the deep shade x .6 at its alpha, as the chunks mix
  // it, so the open sea past the map's edge meets the map without a seam)
  water: { shallow: [40, 20, 56, .7], mid: [20, 10, 32, .74], deep: [6, 2, 10, .8], foam: ['rgba(120,80,170,.2)', 'rgba(170,130,225,.28)'],
    sea: [3.6, 1.2, 6, .8], ripple: ['rgba(150,100,210,.38)', 'rgba(0,0,0,.4)'] },
  look: {
    '.': 'Ash, ankle deep. Something under it moves when you stop.',
    '"': 'Dead stalks standing in the ash, waist high. They rattle when there is no wind.',
    '~': 'Black ichor where the water was. A violet sheen slides across it, against the wind.',
    s: 'Black ichor over soft ground. The dead reeds all lean toward you.',
    T: 'A dead tree, grey and bare. The bracket carved into it has every name crossed out.',
    f: 'Dead woodland. Bare grey trunks, and claw marks at knee height that are still wet.',
    p: 'Dead pines under bone-grey drift. Something hoots once, backwards.',
    n: 'Bone-grey drift, crusted hard. Here and there a bone pokes out of it. No tracks but yours.',
    ':': 'Salt crust in pale plates. It cracks under you like something breaking.',
  },
};
const wU8bDark = e => !!(e && e.m && e.m.umbral);

/* ---------- the ground ---------- */
function wU8bAsh(c, P, r, tall) {
  const base = wMix(P.grass, W_UMB8B.ash, .62);
  c.fillStyle = tall ? tint(base, -.14) : base; c.fillRect(0, 0, 32, 32);
  wMottle(c, r, 2, 'rgba(230,225,240,.07)', 'rgba(10,6,14,.12)');
  wStipple(c, r, 14, 'rgba(22,16,26,.55)', 1);     // cinders
  wStipple(c, r, 6, 'rgba(215,210,225,.32)', 1);   // pale flecks
  if (r() < .1) { c.save(); c.fillStyle = P.accent || '#c8b8ff'; c.globalAlpha = .55; c.fillRect(4 + r() * 24, 4 + r() * 24, 1.4, 1.4); c.restore(); }
  // dead stalks, bent and broken
  const n = tall ? 4 + (r() * 3 | 0) : (r() < .45 ? 1 + (r() * 2 | 0) : 0), col = 'rgba(38,30,40,.85)';
  for (let i = 0; i < n; i++) {
    const x = 3 + r() * 26, y = 9 + r() * 21, h = (tall ? 7 : 4) + r() * (tall ? 6 : 3), lean = (r() - .5) * 5;
    wLine(c, [[x, y], [x + lean * .4, y - h * .6], [x + lean, y - h]], tall ? 1.1 : .9, col);
    if (tall && r() < .5) wLine(c, [[x + lean * .4, y - h * .6], [x + lean * .4 + (r() < .5 ? -3 : 3), y - h * .6 + 1.5]], .8, col);
  }
}
function wU8bIchorPool(c, r, px, py, rx, ry) {
  const p = pEl(px, py, rx, ry);
  c.fillStyle = W_UMB8B.ichor; c.fill(p); wStroke(c, p, .8, 'rgba(29,20,15,.7)');
  wLine(c, [[px - rx * .5, py - ry * .35], [px + rx * .2, py - ry * .45]], .9, 'rgba(180,130,240,.6)');
}
function wU8bSheen(c, r, n) {
  for (let i = 0; i < n; i++) {
    const x = 2 + r() * 18, y = 4 + r() * 24, len = 6 + r() * 9, b = -1.5 - r() * 2;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y + b, x + len, y + (r() - .5) * 2);
    c.lineCap = 'round'; c.lineWidth = 1.5; c.strokeStyle = 'rgba(170,110,235,.34)'; c.stroke();
    c.beginPath(); c.moveTo(x + 1, y + 1.2); c.quadraticCurveTo(x + len / 2, y + b + 1.2, x + len - 1, y + 1.2);
    c.lineWidth = .8; c.strokeStyle = 'rgba(110,230,200,.16)'; c.stroke();
  }
}
// a bone: ink under bone, a knob at each end
function wU8bBone(c, x, y, len, a) {
  const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2, ends = [[x - dx, y - dy], [x + dx, y + dy]];
  wLine(c, ends, 3.2, 'rgba(29,20,15,.7)');
  for (const [ex, ey] of ends) { c.fillStyle = 'rgba(29,20,15,.7)'; c.beginPath(); c.arc(ex, ey, 2.2, 0, 7); c.fill(); }
  wLine(c, ends, 1.8, W_UMB8B.bone);
  for (const [ex, ey] of ends) { c.fillStyle = W_UMB8B.bone; c.beginPath(); c.arc(ex, ey, 1.4, 0, 7); c.fill(); }
}
const W_U8B_GND = {
  '.': (c, P, r) => wU8bAsh(c, P, r, false),
  '"': (c, P, r) => wU8bAsh(c, P, r, true),
  // the ichor itself is the map's water shades (m.waterSh, baked under the ground): lay an oily sheen on it
  '~': (c, P, r) => { if (r() < .4) wU8bSheen(c, r, 1); },
  s: (c, P, r) => {
    c.fillStyle = wMix(P.fen, '#150d1b', .55); c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 3, 'rgba(160,130,190,.06)', 'rgba(0,0,0,.16)');
    const n = 1 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) wU8bIchorPool(c, r, 6 + r() * 20, 7 + r() * 18, 4 + r() * 3, 2 + r() * 1.5);
    for (let i = 0; i < 3; i++) {
      const x = 3 + r() * 26, y = 12 + r() * 18, h = 5 + r() * 4, lean = (r() - .5) * 4;
      wLine(c, [[x, y], [x + lean * .5, y - h * .6], [x + lean, y - h]], 1, '#4a4450');
    }
  },
  n: (c, P, r) => {
    c.fillStyle = wMix(P.snow, '#8c857a', .4); c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(232,224,206,.22)', 'rgba(40,30,40,.1)');
    for (let i = 0; i < 2; i++) { const x = 3 + r() * 18, y = 6 + r() * 22; wLine(c, [[x, y], [x + 4, y - 1.5], [x + 9, y - 1], [x + 12, y + .5]], 1, 'rgba(70,60,70,.35)'); }
    wStipple(c, r, 4, '#d8d0bf', 1.5);
    if (r() < .07) wU8bBone(c, 8 + r() * 16, 8 + r() * 18, 8 + r() * 4, (r() - .5) * 1.6);
  },
  ':': (c, P, r, e) => {
    const base = wMix(P.sand, W_UMB8B.salt, .6);
    c.fillStyle = tint(base, -.2); c.fillRect(0, 0, 32, 32);
    // plates about a tile across, on a jittered lattice in map coordinates (as the vault floor's stones), each edge bent
    // at a shared midpoint, so the cracks wander and run on across tiles
    const ex = e ? e.x : 0, ey = e ? e.y : 0, j = (gx, gy, s, k) => (wHash(gx, gy, s) - .5) * k;
    const pt = (gx, gy) => [(gx - ex) * 32 + j(gx, gy, 61, 18), (gy - ey) * 32 + j(gx, gy, 62, 18)];
    const mid = (a, b, gx, gy, s) => [(a[0] + b[0]) / 2 + j(gx, gy, s, 9), (a[1] + b[1]) / 2 + j(gx, gy, s + 1, 9)];
    for (let gy = ey - 1; gy <= ey + 1; gy++) for (let gx = ex - 1; gx <= ex + 1; gx++) {
      const p00 = pt(gx, gy), p10 = pt(gx + 1, gy), p11 = pt(gx + 1, gy + 1), p01 = pt(gx, gy + 1);
      const q = [p00, mid(p00, p10, gx, gy, 64), p10, mid(p10, p11, gx + 1, gy, 66), p11, mid(p01, p11, gx, gy + 1, 64), p01, mid(p00, p01, gx, gy, 66)];
      const mx = (p00[0] + p11[0]) / 2, my = (p00[1] + p11[1]) / 2;
      if (mx < -24 || my < -24 || mx > 56 || my > 56) continue;
      const p = pPoly(q.map(([x, y]) => [x + (mx - x) * .04, y + (my - y) * .04]));
      c.fillStyle = tint(base, j(gx, gy, 63, .12)); c.fill(p);
      wStroke(c, p, .6, 'rgba(70,60,72,.42)');
    }
    // hairline cracks inside the plates, and glints
    if (r() < .5) { const x = 4 + r() * 18, y = 4 + r() * 18; wLine(c, [[x, y], [x + 3 + r() * 3, y + 2 + r() * 2], [x + 6 + r() * 4, y + 1 + r() * 4]], .5, 'rgba(70,60,72,.35)'); }
    wStipple(c, r, 6, 'rgba(255,255,250,.55)', 1);
  },
};
// the dark maps name their own water (maps are built at the start of every journey, after this loads)
const wWU8BUmbralMap = wUmbralMap;
wUmbralMap = function () { const u = wWU8BUmbralMap.apply(this, arguments); if (u) u.waterSh = W_UMB8B.water; return u; };
const wWU8BGnd = {};
for (const ch in W_U8B_GND) {
  const orig = wWU8BGnd[ch] = WGND[ch], dark = W_U8B_GND[ch];
  WGND[ch] = function (c, P, r, e) { return wU8bDark(e) ? dark(c, P, r, e) : orig.apply(this, arguments); };
}

/* ---------- the dead trees ---------- */
function wU8bDeadTree(c, P, r, cx, by, s, pine) {
  s = s || 1;
  wShadow(c, cx + 2 * s, by, (pine ? 6 : 7) * s, 2.4 * s, .3);
  const col = W_UMB8B.trunk, h = (pine ? 19 : 16) * s, lean = pine ? 0 : (r() - .5) * 2.4 * s;
  const segs = [];
  if (pine) {
    // a dead pine: a straight pole, short stubs sloping down, shorter toward the top
    for (let i = 0; i < 5; i++) {
      const t = .3 + i * .15, y = by - h * t, len = (6 - i) * s * (.8 + r() * .4);
      for (const sd of [-1, 1]) if (r() < .85) segs.push([cx, y, cx + sd * len, y + len * .45, .9 * s]);
    }
  } else {
    for (let i = 0; i < 3 + (r() < .5 ? 1 : 0); i++) {
      const t = .45 + i * .16, x0 = cx + lean * t, y0 = by - h * t, sd = i % 2 ? 1 : -1, a = -Math.PI / 2 + sd * (.55 + r() * .5), len = (5 + r() * 5) * s;
      const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      segs.push([x0, y0, x1, y1, 1.4 * s]);
      const a2 = a + (r() - .5) * 1.3; segs.push([x1, y1, x1 + Math.cos(a2) * len * .5, y1 + Math.sin(a2) * len * .5, .8 * s]);
    }
    const a = -Math.PI / 2 + (r() - .5) * .7; segs.push([cx + lean, by - h, cx + lean + Math.cos(a) * 5 * s, by - h + Math.sin(a) * 5 * s, 1.1 * s]);
  }
  // ink under every branch, then the trunk, then the branches' grey
  for (const [x0, y0, x1, y1, w] of segs) wLine(c, [[x0, y0], [x1, y1]], w + 1.3, WINKC);
  const tr = pPoly([[cx - 2.1 * s, by], [cx - (pine ? .9 : 1.1) * s + lean, by - h], [cx + (pine ? .9 : 1.1) * s + lean, by - h], [cx + 2.1 * s, by]]);
  wFlat(c, tr, col, 1.1);
  c.save(); c.clip(tr); c.fillStyle = 'rgba(20,14,24,.3)'; c.fillRect(cx + .3 * s, by - h - 1, 3 * s, h + 2); c.restore();
  for (const [x0, y0, x1, y1, w] of segs) wLine(c, [[x0, y0], [x1, y1]], w, col);
  if (pine) { const q = pPoly([[cx - 4 * s, by], [cx - 2 * s, by - 2.5 * s], [cx + 2.5 * s, by - 2.2 * s], [cx + 4.5 * s, by]]); c.fillStyle = tint(W_UMB8B.bone, -.12); c.fill(q); wStroke(c, q, .6, 'rgba(29,20,15,.5)'); }
}
const W_U8B_OBJ = {
  T: (c, P, r) => wU8bDeadTree(c, P, r, 16, 29, 1.25),
  f: (c, P, r, e) => {
    const n = 2 + (wHash(e.x, e.y, 31) < .5 ? 1 : 0), spots = [[8, 14], [23, 18], [13, 30], [26, 31]];
    for (let i = 0; i < n; i++) { const [sx, sy] = spots[(i + (wHash(e.x, e.y, 32) * 4 | 0)) % 4]; wU8bDeadTree(c, P, r, sx + (r() - .5) * 4, sy + (r() - .5) * 3, .78 + r() * .2); }
  },
  p: (c, P, r, e) => {
    const spots = [[9, 15], [23, 19], [14, 31]], n = 2 + (wHash(e.x, e.y, 33) < .5 ? 1 : 0);
    for (let i = 0; i < n; i++) wU8bDeadTree(c, P, r, spots[i][0] + (r() - .5) * 4, spots[i][1] + (r() - .5) * 2, .82 + r() * .2, true);
  },
};
const wWU8BObj = {};
for (const ch in W_U8B_OBJ) {
  const orig = wWU8BObj[ch] = WOBJ[ch], dark = W_U8B_OBJ[ch];
  WOBJ[ch] = function (c, P, r, e) { return wU8bDark(e) ? dark(c, P, r, e) : orig.apply(this, arguments); };
}

/* ---------- Look ---------- */
// only the tile's own words change: a place's, a person's or a sign's words stand
const wWU8BLookText = wLookText;
wLookText = function (x, y) {
  const out = wWU8BLookText.apply(this, arguments), m = wCurMap();
  if (!m || !m.umbral) return out;
  const c = wTileAt(m, x, y), td = c != null && DB.tiles[c];
  return td && W_UMB8B.look[c] && (out === td.look || out === td.look0) ? W_UMB8B.look[c] : out;
};

/* ---------- the sky, mirrored ---------- */
const wUmbSkyMirrored = () => wUmbDark();
const wWU8BDrawSky = drawSky;
drawSky = function (c) {
  if (!c || !wUmbSkyMirrored()) return wWU8BDrawSky.apply(this, arguments);
  c.save(); c.translate(SW, 0); c.scale(-1, 1);
  try { return wWU8BDrawSky.apply(this, arguments); } finally { c.restore(); }
};
// the dead moon, a black disc with a cold rim. It hangs in the moon's own dark part, never over the lit limb (the phase
// matters): a big disc on the dark half of a new, crescent or quarter moon; when the moon is gibbous or full, a small one
// just clear of it, inside the skylight's frame (the frame, radius r * 1.5, is drawn over its outer 2.5px)
function wU8bDeadMoon(x, y, r, phase) {
  const p = ((phase | 0) % 8 + 8) % 8, side = p <= 4 ? -1 : 1;   // the unlit side: west while waxing, east while waning
  if (p === 0 || p === 1 || p === 7) return [x + side * r * .3, y, r * .45];
  if (p === 2 || p === 6) return [x + side * r * .45, y, r * .35];
  // (as big as fits between the moon's edge and the frame's inner edge, r * 1.375: a ring, not a stray star)
  const dr = r * .17, a = -Math.PI / 2 - .35, d = r + dr + .2;
  return [x + Math.cos(a) * d, y + Math.sin(a) * d, dr];
}
const wWU8BDrawMoon = drawMoon;
drawMoon = function (c, x, y, r, phase) {
  const out = wWU8BDrawMoon.apply(this, arguments);
  if (!wUmbSkyMirrored()) return out;
  const [dx, dy, dr] = wU8bDeadMoon(x, y, r, phase);
  c.save();
  c.fillStyle = '#100a16'; c.beginPath(); c.arc(dx, dy, dr, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(200,184,255,.75)'; c.lineWidth = 1.2; c.beginPath(); c.arc(dx, dy, dr - .6, 0, Math.PI * 2); c.stroke();
  c.restore();
  return out;
};
// the constellations' small pictures (the chips over a match, the sky panel) reversed with them
const wWU8BStarsSVG = starsSVG;
starsSVG = function (C, size) {
  const M = C && C.pts && wUmbSkyMirrored() ? Object.assign({}, C, { pts: C.pts.map(([x, y]) => [-x, y]) }) : C;
  return wWU8BStarsSVG.call(this, M, size);
};
// and the moon's, so its lit side matches the skylight's
const wWU8BMoonSVG = moonSVG;
moonSVG = function () { const h = wWU8BMoonSVG.apply(this, arguments); return wUmbSkyMirrored() ? h.replace('<svg ', '<svg style="transform:scaleX(-1)" ') : h; };

/* ---------- How to play ---------- */
const wWU8BRenderHelp = renderHelp;
renderHelp = function () {
  const out = wWU8BRenderHelp.apply(this, arguments), u = $('wHelpUmbral');
  if (u && u.tagName === 'DIV' && !$('wHelpUmbLand')) u.insertAdjacentHTML('beforeend', '<p class="hint" id="wHelpUmbLand"><b>The land.</b> On the dark side the grass is ash, the water and the fen black ichor, the trees dead, the snow bone-grey and the sand a crust of salt. It is all the same ground underfoot: Look at anything to hear what it is now. In a card match the sky is mirrored, with the dead moon hanging in the moon\'s shadow (or beside it, when the moon is nearly full), and does just what it does on the light side.</p>');
  return out;
};
