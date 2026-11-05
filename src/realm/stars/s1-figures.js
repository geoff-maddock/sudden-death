/* Superstars, drawn (issue #24, phase 2). One file, loaded four times: in the Realm's own scope (after Sudden Death's
   src/render/creatures.js) and inside each engine's scope (wBD, wGF, wBX: their manifests in src/realm/diamond,
   gridiron and ring), where the same names (KIND, BACK, HEAD, BODY, ink, inkLine, pEl, pPoly, glowEye, circ, tint,
   INK) belong to that engine's own copy of the renderer. So it declares nothing at the top: it only adds each
   superstar's entry to the tables already there. The animation clock differs from scope to scope, so the flames keep
   their own (performance.now).

   The Phoenix: a bird of fire. A harpy's frame (talons, bird legs, feathers), gold skin, wings of flame that flicker,
   a crest of fire and a tail of it.
   The Kraken: big and slow, deep-sea blue. A dome of a head with great gold eyes and a beard of tentacles, four more
   tentacles curling up behind it, suckers along them, and arms a little long.
   The Behemoth: the biggest thing on the field, mossy green-brown, hooves, horns that curl out and up, tusks, and a
   hump of moss-grown plates with flowers in it.
   The Djinn: violet, with no legs: a robe from the waist that turns into a tail of smoke, swirling down to a point
   above the ground, with sparks in it. A gold-trimmed turban with a gem, pointed ears, a curled beard.
   The Hydra: sea-green and scaled, a lizard's tail, and three serpent heads on three necks, the middle one highest,
   each with its own eyes and fangs, the middle one's tongue flicking. */
(() => {
  if (typeof KIND === 'undefined' || typeof HEAD === 'undefined') return;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  // a tongue of fire from (x, y), len long, leaning by lean; three colours, hottest inside
  const flame = (c, d, x, y, len, lean, wide, ph) => {
    const t = now(), fl = Math.sin(t * 9 + ph) * .14 + Math.sin(t * 15 + ph * 2) * .07, L = len * (1 + fl);
    const cols = d.st ? [d.C('#c8562a'), d.C('#e88a3a'), d.C('#f5d27a')] : ['#d8402a', '#ff8a3c', '#ffe27a'];
    cols.forEach((col, i) => {
      const k = 1 - i * .3, w = wide * k, tip = [x + lean * L * k, y - L * k], p = new Path2D();
      p.moveTo(x - w, y); p.quadraticCurveTo(x - w * 1.1 + lean * L * .4 * k, y - L * .55 * k, tip[0], tip[1]);
      p.quadraticCurveTo(x + w * 1.1 + lean * L * .4 * k, y - L * .55 * k, x + w, y); p.closePath();
      if (i === 0) ink(c, p, col, 0, true); else { c.fillStyle = col; c.fill(p); }
    });
  };
  KIND.phoenix = { skin: '#f0b04a', h: 1, w: .9, eye: '#fff3a0', talon: true };
  BODY.phoenix = { foot: 'talon', slim: true, birdLeg: true, feathers: true, clawHand: true, tuft: '#e0502a', fea: ['#d8452a', '#ff9a3c'] };
  BACK.phoenix = function (c, d) {
    const t = now(), f = d.o.fly ? Math.sin(t * 18) * 12 : Math.sin(t * 2.4) * 3, col = d.C('#d8452a'), col2 = d.C('#ff9a3c');
    if (!d.st) { c.save(); c.globalAlpha *= .22; c.fillStyle = '#ff8a3c'; c.beginPath(); c.ellipse(0, d.shY - 6, 70, 40, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    for (const s of [-1, 1]) {
      // the wing: long primaries swept up and out, each tipped with fire
      const p = new Path2D(); p.moveTo(s * 8, d.shY + 4); p.quadraticCurveTo(s * 38, d.shY - 40 - f, s * 66, d.shY - 34 - f);
      p.lineTo(s * 60, d.shY - 18 - f * .6); p.lineTo(s * 68, d.shY - 6 - f * .3); p.lineTo(s * 54, d.shY + 6); p.lineTo(s * 58, d.shY + 20); p.lineTo(s * 40, d.shY + 22); p.lineTo(s * 38, d.shY + 34); p.quadraticCurveTo(s * 20, d.shY + 20, s * 8, d.shY + 18); p.closePath();
      ink(c, p, col, s > 0 ? -999 : 999);
      for (let i = 0; i < 4; i++) inkLine(c, [[s * (14 + i * 9), d.shY + 4 + i * 2], [s * (26 + i * 9), d.shY - 14 - f * .5 + i * 7]], col2, .8);
      if (d.o.det !== false) [[66, -34, -.2], [68, -6, .2], [58, 20, .5]].forEach(([x, y, l], i) => flame(c, d, s * x, d.shY + y - f * (i === 2 ? 0 : .5), 14, s * (l + .3), 3.4, i + (s > 0 ? 3 : 0)));
    }
    // the tail: three tongues of fire falling behind the legs
    for (let i = -1; i <= 1; i++) flame(c, d, i * 6, -30, -22 + Math.abs(i) * 5, i * .25, 4, i * 1.7);
  };
  HEAD.phoenix = function (c, d) {
    const { hy, C, skin } = d;
    for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + i * .14); ink(c, pEl(Math.cos(a) * 14, hy - 2 + Math.sin(a) * 14, 3, 8, a + Math.PI / 2), i % 2 ? C('#d8452a') : C('#ff8a3c')); }
    // the crest: a fan of fire over the feathers, behind the face
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .38; flame(c, d, Math.cos(a) * 8, hy - 9 + Math.sin(a) * 4, 22 - Math.abs(i - 2) * 4, Math.cos(a) * .8, 3.6, i * 1.3); }
    ink(c, pPoly([[-11, hy - 4], [-12, hy + 4], [-5, hy + 12], [0, hy + 13], [5, hy + 12], [12, hy + 4], [11, hy - 4], [0, hy - 11]]), skin);
    ink(c, pPoly([[-2, hy + 1], [3, hy + 5.5], [0, hy + 9], [-2.5, hy + 5]]), C('#ffd84a'), 0, true);
    glowEye(c, -5, hy - 1, 2.4, d.eye, d.st); glowEye(c, 5, hy - 1, 2.4, d.eye, d.st);
    inkLine(c, [[-8, hy - 5.5], [-2.5, hy - 3]], INK, .8); inkLine(c, [[8, hy - 5.5], [2.5, hy - 3]], INK, .8);
  };
  if (typeof KIND_NAME !== 'undefined') KIND_NAME.phoenix = 'Phoenix';
  if (typeof KIND_WPN !== 'undefined') KIND_WPN.phoenix = 'bat';

  // a tapered tentacle along the points pts, w0 wide at the root, curling at the tip, with suckers on one side
  const tentacle = (c, d, pts, w0, col, suck) => {
    const L = [], R = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, w = w0 * (1 - i / n * .85);
      L.push([pts[i][0] - dy / m * w, pts[i][1] + dx / m * w]); R.push([pts[i][0] + dy / m * w, pts[i][1] - dx / m * w]);
    }
    const p = new Path2D(); p.moveTo(L[0][0], L[0][1]); for (const q of L.slice(1)) p.lineTo(q[0], q[1]);
    p.lineTo(pts[n - 1][0], pts[n - 1][1]); for (const q of R.slice().reverse()) p.lineTo(q[0], q[1]); p.closePath();
    ink(c, p, col, 0, true);
    if (suck) for (let i = 1; i < n - 1; i += 2) { const q = L[i], r = pts[i]; circ(c, (q[0] * 2 + r[0]) / 3, (q[1] * 2 + r[1]) / 3, Math.max(.8, w0 * .3 * (1 - i / n)), suck); }
  };
  // a wavy line of n points from (x, y), len long at angle a, curling by curl, swaying with the clock
  const curve = (x, y, a, len, curl, ph, n = 9) => { const t = now(), out = []; let px = x, py = y, ang = a;
    for (let i = 0; i < n; i++) { out.push([px, py]); ang += curl / n + Math.sin(t * 2.2 + ph + i * .6) * .07; px += Math.cos(ang) * len / n; py += Math.sin(ang) * len / n; }
    return out; };
  KIND.kraken = { skin: '#4a7fa8', h: 1.16, w: 1.3, eye: '#ffd84a' };
  BODY.kraken = { foot: 'claw', musc: .5, armLen: 1.15, scales: true };
  BACK.kraken = function (c, d) {
    const col = d.C('#3d6c92'), suck = d.C('#e8c8a8');
    [[-1, -2.5, 1.6], [-1, -2.0, 1.1], [1, -.64, -1.6], [1, -1.14, -1.1]].forEach(([s, a, cu], i) =>
      tentacle(c, d, curve(s * 10, d.shY + 10, a, 64 - i % 2 * 10, cu, i * 1.9), 8, col, suck));
  };
  HEAD.kraken = function (c, d) {
    const { hy, C, skin } = d, beard = C('#3d6c92'), suck = C('#e8c8a8');
    // the beard: tentacles hanging from the jaw, swaying
    for (let i = 0; i < 5; i++) tentacle(c, d, curve(-8 + i * 4, hy + 8, Math.PI / 2 + (i - 2) * .12, 20 + (i % 2) * 6, (i - 2) * .5, i * 1.3, 6), 3.2, beard, i % 2 ? null : suck);
    // the mantle: a tall dome, ridged
    ink(c, pEl(0, hy - 8, 15, 19), skin);
    for (const k of [-6, 0, 6]) inkLine(c, [[k * .8, hy - 24], [k, hy - 2]], C(tint('#4a7fa8', -.25)), .6);
    for (const s of [-1, 1]) { ink(c, pEl(s * 6, hy + 1, 5, 4.4), C('#f4e9c8'), 0, true); glowEye(c, s * 6, hy + 1, 2.8, d.eye, d.st); if (!d.st) { c.fillStyle = INK; c.fillRect(s * 6 - 2.4, hy + .6, 4.8, 1); } }
    inkLine(c, [[-10, hy - 4], [-3, hy - 2.5]], INK, .9); inkLine(c, [[10, hy - 4], [3, hy - 2.5]], INK, .9);
  };
  if (typeof KIND_NAME !== 'undefined') KIND_NAME.kraken = 'Kraken';
  if (typeof KIND_WPN !== 'undefined') KIND_WPN.kraken = 'log';

  // a little five-petal flower
  const flower = (c, d, x, y, r, col) => { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, r * .75, col); } circ(c, x, y, r * .55, d.C('#ffe27a')); };
  KIND.behemoth = { skin: '#7a8a52', h: 1.3, w: 1.7, eye: '#ffb03a', belly: true };
  BODY.behemoth = { foot: 'hoof', musc: 1, moss: true, shinFur: '#4f5e2c', tuft: '#5a6a32' };
  BACK.behemoth = function (c, d) {
    const moss = d.C('#5a6a32'), plate = d.C('#8a7a5a');
    // the hump: plates in a ridge over the shoulders, moss on top, flowers in the moss
    ink(c, pEl(0, d.shY - 4, d.shw + 12, 22), moss);
    for (let i = -2; i <= 2; i++) ink(c, pPoly([[i * 11 - 7, d.shY - 6], [i * 11, d.shY - 28 + Math.abs(i) * 5], [i * 11 + 7, d.shY - 6]]), plate);
    for (let i = -3; i <= 3; i++) ink(c, pEl(i * 8, d.shY - 10 + Math.abs(i) * 1.5, 6, 4), moss, 0, true);
    [[-18, -14, '#ff8ab0'], [6, -18, '#f2f2ff'], [20, -10, '#ff8ab0'], [-6, -12, '#c8a8ff']].forEach(([x, y, col]) => flower(c, d, x, d.shY + y, 2.2, d.C(col)));
  };
  HEAD.behemoth = function (c, d) {
    const { hy, C, skin } = d, bone = C('#efe2c0');
    // horns: out from the temples, then up
    for (const s of [-1, 1]) { const p = new Path2D(); p.moveTo(s * 9, hy - 6); p.quadraticCurveTo(s * 30, hy - 4, s * 30, hy - 26); p.quadraticCurveTo(s * 25, hy - 12, s * 9, hy - 1); p.closePath(); ink(c, p, bone); }
    // a broad low head under a heavy brow
    ink(c, pRR(-15, hy - 10, 30, 24, 10), skin);
    ink(c, pRR(-15, hy - 11, 30, 8, 4), C(tint('#7a8a52', -.18)), 0, true);
    ink(c, pEl(0, hy - 13, 10, 4), C('#5a6a32'), 0, true); flower(c, d, 3, hy - 14, 1.6, C('#ff8ab0'));
    glowEye(c, -6, hy - 3, 2.1, d.eye, d.st); glowEye(c, 6, hy - 3, 2.1, d.eye, d.st);
    // tusks up from the jaw, and nostrils
    for (const s of [-1, 1]) ink(c, pPoly([[s * 8, hy + 10], [s * 13, hy + 1], [s * 11, hy + 11]]), bone, 0, true);
    for (const s of [-1, 1]) circ(c, s * 3, hy + 5, 1.2, INK);
    inkLine(c, [[-7, hy + 10], [7, hy + 10]], INK, .7);
  };
  if (typeof KIND_NAME !== 'undefined') KIND_NAME.behemoth = 'Behemoth';
  if (typeof KIND_WPN !== 'undefined') KIND_WPN.behemoth = 'tree';

  KIND.djinn = { skin: '#8a7ae0', h: 1.06, w: 1, eye: '#ffe27a', robe: '#4a3a98' };
  BODY.djinn = { robe: true, slim: true };
  BACK.djinn = function (c, d) {
    const t = now(), col = d.C('#6a5ac8'), sm = d.C('#b8a8f0');
    // the smoke tail: puffs from the waist down to a point, swaying, and the robe over its top
    for (let i = 0; i < 9; i++) { const k = i / 8, y = -36 + k * 32, x = Math.sin(t * 2 + k * 4) * 7 * k, r = 17 * (1 - k * .8);
      ink(c, pEl(x, y, r, r * .7), i % 2 ? col : sm, 0, true); }
    const p = new Path2D(); p.moveTo(-d.shw + 2, d.shY + 10); p.lineTo(-d.shw - 5, -30); p.quadraticCurveTo(0, -22, d.shw + 5, -30); p.lineTo(d.shw - 2, d.shY + 10); p.closePath();
    ink(c, p, d.C('#4a3a98'));
    c.fillStyle = d.C('#d8b64a'); c.fillRect(-d.shw - 4, -32, 2 * d.shw + 8, 2.4);
    if (!d.st) for (let i = 0; i < 5; i++) { const a = t * 3 + i * 1.3; circ(c, Math.cos(a) * 12, -20 + Math.sin(a * 1.7) * 12, 1.1, '#fff6c8'); }
  };
  HEAD.djinn = function (c, d) {
    const { hy, C, skin } = d, gold = C('#d8b64a');
    for (const s of [-1, 1]) ink(c, pPoly([[s * 9, hy - 1], [s * 22, hy - 8], [s * 10, hy + 5]]), skin);
    ink(c, pEl(0, hy + 2, 11, 12), skin);
    // the curled beard
    ink(c, pPoly([[-6, hy + 9], [6, hy + 9], [3, hy + 20], [5, hy + 24], [0, hy + 22], [-3, hy + 20]]), C('#2a1d4a'), 0, true);
    // the turban, its trim and gem
    ink(c, pEl(0, hy - 9, 15, 10), C('#2f8f96'));
    inkLine(c, [[-13, hy - 6], [13, hy - 12]], C('#5fbfc6'), 1.2); inkLine(c, [[-12, hy - 12], [12, hy - 5]], C('#5fbfc6'), 1.2);
    ink(c, pEl(0, hy - 6, 3.2, 4), C('#e0457b'), 0, true); circ(c, -.8, hy - 7, .9, '#fff');
    ink(c, pRR(-14, hy - 3.5, 28, 3, 1.2), gold, 0, true);
    glowEye(c, -4.5, hy + 2, 2.2, d.eye, d.st); glowEye(c, 4.5, hy + 2, 2.2, d.eye, d.st);
    inkLine(c, [[-8, hy - 1], [-2.5, hy + .5]], INK, .8); inkLine(c, [[8, hy - 1], [2.5, hy + .5]], INK, .8);
    for (const s of [-1, 1]) circ(c, s * 11, hy + 6, 1.3, gold);
  };
  if (typeof KIND_NAME !== 'undefined') KIND_NAME.djinn = 'Djinn';
  if (typeof KIND_WPN !== 'undefined') KIND_WPN.djinn = 'staff';

  // a serpent's head at (x, y), facing out by s (-1 left, 1 right, 0 ahead), r big
  const serpent = (c, d, x, y, s, r, tongue) => {
    const skin = d.skin, t = now();
    ink(c, pPoly([[x - r, y - r * .5], [x - r * .7, y - r * .95], [x + r * .7, y - r * .95], [x + r, y - r * .5], [x + r * .8 + s * r * .5, y + r * .6], [x + s * r * .4, y + r], [x - r * .8 + s * r * .5, y + r * .6]]), skin);
    for (const e of [-1, 1]) glowEye(c, x + e * r * .42 + s * r * .2, y - r * .3, r * .2, d.eye, d.st);
    for (const e of [-1, 1]) ink(c, pPoly([[x + e * r * .32 + s * r * .3, y + r * .55], [x + e * r * .22 + s * r * .3, y + r * 1.05], [x + e * r * .12 + s * r * .3, y + r * .55]]), d.C('#f4ead0'), 0, true);
    inkLine(c, [[x - r * .5, y - r * .62], [x - r * .15, y - r * .5]], INK, .7); inkLine(c, [[x + r * .5, y - r * .62], [x + r * .15, y - r * .5]], INK, .7);
    if (tongue && !d.st && Math.sin(t * 3) > .2) inkLine(c, [[x, y + r], [x, y + r * 1.6], [x - r * .2, y + r * 1.9]], '#e0457b', .8);
  };
  KIND.hydra = { skin: '#3f8a6a', h: 1.12, w: 1.25, eye: '#ffe14a' };
  BODY.hydra = { foot: 'claw', musc: .6, tail: 'lizard', scales: true, clawHand: true };
  HEAD.hydra = function (c, d) {
    const { hy, C } = d, t = now(), neck = C('#3f8a6a'), belly = C('#cfe0a0');
    // the two side necks, swaying, behind the middle one
    for (const s of [-1, 1]) {
      const hx = s * 19 + Math.sin(t * 1.6 + s) * 1.5, hy2 = hy + 4 + Math.cos(t * 1.4 + s) * 1.2;
      const n = new Path2D(); n.moveTo(s * 6, d.shY + 2); n.quadraticCurveTo(s * 18, d.shY - 6, hx - s * 2, hy2 + 6); n.lineTo(hx + s * 4, hy2 + 8); n.quadraticCurveTo(s * 24, d.shY - 2, s * 13, d.shY + 4); n.closePath();
      ink(c, n, neck); serpent(c, d, hx, hy2, s, 8, false);
    }
    // the middle neck and head, highest
    ink(c, capsule(0, d.shY + 1, 5, 0, hy - 4, 4.6), neck);
    for (let i = 0; i < 3; i++) inkLine(c, [[-2.5, d.shY - 4 - i * 6], [2.5, d.shY - 4 - i * 6]], belly, .6);
    serpent(c, d, 0, hy - 8, 0, 10, true);
  };
  if (typeof KIND_NAME !== 'undefined') KIND_NAME.hydra = 'Hydra';
  if (typeof KIND_WPN !== 'undefined') KIND_WPN.hydra = 'spiked';
})();
