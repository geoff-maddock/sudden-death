/* Superstars, drawn (issue #24, phase 2). One file, loaded four times: in the Realm's own scope (after Sudden Death's
   src/render/creatures.js) and inside each engine's scope (wBD, wGF, wBX: their manifests in src/realm/diamond,
   gridiron and ring), where the same names (KIND, BACK, HEAD, BODY, ink, inkLine, pEl, pPoly, glowEye, circ, tint,
   INK) belong to that engine's own copy of the renderer. So it declares nothing at the top: it only adds each
   superstar's entry to the tables already there. The animation clock differs from scope to scope, so the flames keep
   their own (performance.now).

   The Phoenix: a bird of fire. A harpy's frame (talons, bird legs, feathers), gold skin, wings of flame that flicker,
   a crest of fire and a tail of it.
   The Kraken: big and slow, deep-sea blue. A dome of a head with great gold eyes and a beard of tentacles, four more
   tentacles curling up behind it, suckers along them, and arms a little long. */
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
})();
