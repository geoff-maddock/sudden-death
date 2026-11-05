/* Cinder Gridiron: the players, drawn (issue #9, phase 1). Copied from Brimstone Diamond's figures
   (src/bd/parts/14-rendering.js: KIND to drawFig, and tri/circ/ell) and adapted, not shared (question 6): footballers carry
   no weapons, so the bat and weapon branches are gone, and the animation clock is GFT.t (seconds, from 09-draw.js).
   drawFig(c, kind, x, y, hpx, team, o): an inked, cel-shaded player standing at (x, y), hpx tall; team { color, light,
   short }; o { num, run (a stride phase), flip, alpha, throwK (0..1, the throwing arm), lift, noShadow, stone }. */
const INK = '#17100e';
const KIND = {
  goblin:   { skin: '#7fae4e', h: .8,  w: .9,  cap: true, eye: '#ffe04a' },
  kobold:   { skin: '#c85a32', h: .74, w: .86, cap: true, eye: '#ffd34a' },
  werewolf: { skin: '#7a6653', h: 1.06, w: 1.08, eye: '#ffc02e' },
  dwarf:    { skin: '#e3a47d', h: .8,  w: 1.28, eye: '#2a1a12' },
  ogre:     { skin: '#8f9d58', h: 1.28, w: 1.6, cap: true, eye: '#3a2412', belly: true },
  minotaur: { skin: '#70442a', h: 1.16, w: 1.28, eye: '#ff5a3a' },
  troll:    { skin: '#5f7f8a', h: 1.14, w: 1.35, eye: '#f2e59a', hunch: true },
  golem:    { skin: '#8e8d86', h: 1.12, w: 1.5, eye: '#7ff0ff' },
  harpy:    { skin: '#dcc3a2', h: .96, w: .9,  eye: '#d9f25a', talon: true },
  elf:      { skin: '#eed3b0', h: 1.03, w: .86, eye: '#3fae7a' },
  wraith:   { skin: '#221c35', h: 1.03, w: .96, eye: '#9ff6ff', robe: '#2b2442' },
  vampire:  { skin: '#ece7f1', h: 1,   w: .9,  eye: '#ff2a44' },
  lich:     { skin: '#e6dfc6', h: 1.03, w: .95, eye: '#7fd4ff', robe: '#3d2553', bony: true },
  zombie:   { skin: '#7f9c79', h: 1.05, w: 1.16, cap: true, eye: '#f2f2d2' },
  gorgon:   { skin: '#6fa57d', h: 1,   w: .95, eye: '#ffe14a' },
  spider:   { skin: '#4b2f55', h: .96, w: 1,   eye: '#ff3a4a' },
  skeleton: { skin: '#ebe5d2', h: 1,   w: .95, eye: '#ff9a3a', bony: true },
  witch:    { skin: '#bfd9e8', h: .98, w: .88, eye: '#6ad8ff' },
};
function rgbOf(h) {
  if (h[0] === 'r') return h.match(/\d+/g).slice(0, 3).map(Number);
  h = h.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function tint(h, f) { const [r, g, b] = rgbOf(h), t = f < 0 ? 0 : 255, k = Math.abs(f); return `rgb(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)})`; }
function grey(h) { const [r, g, b] = rgbOf(h), l = .3 * r + .59 * g + .11 * b, v = Math.round(92 + l * .42); return `rgb(${v},${v},${v - 4})`; }
function pRR(x, y, w, h, r) { const p = new Path2D(); r = Math.min(r, w / 2, h / 2); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; }
function pEl(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }
function pPoly(pts) { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; }
let LW = 2, FSC = 1, FLIPPED = false;
// fill + cel shadow (light from upper left) + ink outline
function ink(c, path, fill, sx = 0, noShade) {
  c.fillStyle = fill; c.fill(path);
  if (!noShade) {
    c.save(); c.clip(path); c.fillStyle = 'rgba(26,10,36,.3)';
    c.beginPath(); c.moveTo(sx + 2, -300); c.lineTo(sx + 300, -300); c.lineTo(sx + 300, 80); c.lineTo(sx - 10, 80); c.closePath(); c.fill(); c.restore();
  }
  c.lineWidth = LW; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(path);
}
function inkLine(c, pts, col = INK, w = 1) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = col; c.lineWidth = LW * w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function glowEye(c, x, y, r, col, st) {
  if (st) { circ(c, x, y, r, '#5a5a56'); return; }
  c.save(); c.shadowColor = col; c.shadowBlur = Math.max(2, r * 3.2 * FSC); circ(c, x, y, r, col); c.restore();
  circ(c, x - r * .35, y - r * .35, r * .38, 'rgba(255,255,255,.95)');
}
function slit(c, x, y, r) { c.fillStyle = INK; c.fillRect(x - r * .18, y - r * .8, r * .36, r * 1.6); }
function cap(c, d, tilt = 0, scale = 1) {
  const { hy, hr } = d, R = (hr + 1) * scale;
  c.save(); c.translate(tilt * 8, hy - 3.5 * scale); c.rotate(tilt);
  const dome = new Path2D(); dome.moveTo(-R, 0); dome.arc(0, 0, R, Math.PI, 0); dome.closePath();
  ink(c, dome, d.jer);
  c.fillStyle = d.jerD; c.fillRect(-.8, -R, 1.6, R);
  ink(c, pEl(0, .6, R + 3.5, 3.1), d.jerD, 0, true);
  if (FSC * scale > .35) { c.font = `900 ${8.5 * scale}px "Alegreya Sans", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = d.trimL; if (FLIPPED) { c.save(); c.scale(-1, 1); } c.fillText(d.letter, 0, -3.2 * scale); if (FLIPPED) c.restore(); }
  c.restore();
}

/* things drawn behind the body */
const BACK = {
  harpy(c, d) {
    const f = d.o.fly ? Math.sin(GFT.t * 18) * 12 : Math.sin(GFT.t * 2) * 2, col = d.C('#6b567c'), col2 = d.C('#8b76a0');
    for (const s of [-1, 1]) {
      const p = new Path2D(); p.moveTo(s * 8, d.shY + 4); p.quadraticCurveTo(s * 40, d.shY - 34 - f, s * 64, d.shY - 26 - f);
      p.lineTo(s * 56, d.shY - 10 - f * .6); p.lineTo(s * 62, d.shY + 2 - f * .3); p.lineTo(s * 50, d.shY + 12); p.lineTo(s * 54, d.shY + 26); p.lineTo(s * 38, d.shY + 26); p.lineTo(s * 36, d.shY + 36); p.quadraticCurveTo(s * 20, d.shY + 20, s * 8, d.shY + 18); p.closePath();
      ink(c, p, col, s > 0 ? -999 : 999);
      for (let i = 0; i < 4; i++) inkLine(c, [[s * (14 + i * 9), d.shY + 4 + i * 2], [s * (26 + i * 9), d.shY - 12 - f * .5 + i * 7]], col2, .7);
    }
  },
  vampire(c, d) {
    const cape = pPoly([[-d.shw - 2, d.shY], [-d.shw - 12, -8], [0, -12], [d.shw + 12, -8], [d.shw + 2, d.shY]]);
    ink(c, cape, d.C('#15101a'));
    ink(c, pPoly([[-d.shw - 3, d.shY - 1], [-d.shw - 6, -14], [-d.shw + 2, d.shY + 4]]), d.C('#8e1426'), 0, true);
    ink(c, pPoly([[d.shw + 3, d.shY - 1], [d.shw + 6, -14], [d.shw - 2, d.shY + 4]]), d.C('#8e1426'), 0, true);
    // high collar
    ink(c, pPoly([[-9, d.shY + 1], [-22, d.hy - 14], [-12, d.hy + 4]]), d.C('#8e1426'));
    ink(c, pPoly([[9, d.shY + 1], [22, d.hy - 14], [12, d.hy + 4]]), d.C('#8e1426'));
  },
  spider(c, d) {
    const k = d.o.run ? Math.sin(d.o.run) * 6 : Math.sin(GFT.t * 3) * 1.5;
    ink(c, pEl(0, -30, 20, 17), d.C('#2c1a34'));
    ink(c, pPoly([[-4, -40], [4, -40], [0, -32], [4, -24], [-4, -24], [0, -32]]), d.C('#d83a4a'), 0, true);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const y0 = d.shY + 10 + i * 7, kk = (i % 2 ? k : -k) * s;
      inkLine(c, [[s * 10, y0], [s * (34 + i * 3), y0 - 18 + kk], [s * (44 + i * 2), y0 + 30 - i * 4]], INK, 2.6);
      inkLine(c, [[s * 10, y0], [s * (34 + i * 3), y0 - 18 + kk], [s * (44 + i * 2), y0 + 30 - i * 4]], d.C('#4b2f55'), 1.3);
    }
  },
  gorgon(c, d) { for (let i = 0; i < 5; i++) snake(c, d, Math.PI * (1.05 + i * .225), 24, i); },
  witch(c, d) { ink(c, pRR(-15, d.hy - 6, 30, 34, 10), d.C('#eef2f8')); },
  wraith(c, d) { robeBody(c, d, d.C('#2b2442'), true); },
  lich(c, d) { robeBody(c, d, d.C('#3d2553'), false); },
};
function robeBody(c, d, col, tattered) {
  const p = new Path2D(); p.moveTo(-d.shw + 2, d.shY); p.lineTo(-d.shw - 7, -4);
  if (tattered) { for (let i = 0; i <= 8; i++) { const x = -d.shw - 7 + i * (2 * d.shw + 14) / 8; p.lineTo(x, i % 2 ? -10 - Math.sin(GFT.t * 4 + i) * 2 : -1); } }
  else p.lineTo(d.shw + 7, -4);
  p.lineTo(d.shw - 2, d.shY); p.closePath();
  ink(c, p, col);
  if (!tattered) { c.fillStyle = d.C('#d8b64a'); c.fillRect(-d.shw - 6, -8, 2 * d.shw + 12, 2.4); }
}
function snake(c, d, a, len, i) {
  const wv = Math.sin(GFT.t * 5 + i * 1.7) * 4, x0 = Math.cos(a) * 10, y0 = d.hy + Math.sin(a) * 10;
  const x1 = Math.cos(a) * len + wv, y1 = d.hy + Math.sin(a) * len - 2;
  const body = [[x0, y0], [(x0 + x1) / 2 - wv, (y0 + y1) / 2 + 3], [x1, y1]];
  inkLine(c, body, INK, 3.4); inkLine(c, body, d.C('#3f8a4f'), 2);
  ink(c, pEl(x1, y1, 3.4, 2.6, a), d.C('#4f9a5d'), 0, true);
  if (FSC > .4) { circ(c, x1 + Math.cos(a) * 1.2, y1 - 1, .8, d.C('#ffe14a')); }
}

/* heads and faces */
const HEAD = {
  goblin(c, d) {
    const { hy, C, skin } = d;
    for (const s of [-1, 1]) { ink(c, pPoly([[s * 9, hy - 4], [s * 35, hy - 15], [s * 29, hy - 6], [s * 10, hy + 5]]), skin); c.fillStyle = C('#c9807a'); c.fill(pPoly([[s * 12, hy - 3], [s * 29, hy - 11], [s * 26, hy - 7], [s * 12, hy + 2]])); }
    ink(c, pEl(0, hy, 12.5, 12), skin);
    cap(c, d, -.08);
    glowEye(c, -5, hy + 1, 2.7, d.eye, d.st); glowEye(c, 5, hy + 1, 2.7, d.eye, d.st); slit(c, -5, hy + 1, 2.7); slit(c, 5, hy + 1, 2.7);
    ink(c, pPoly([[-1.5, hy + 1], [5, hy + 7.5], [-1, hy + 8]]), tint(skin, -.18));
    c.beginPath(); c.arc(0, hy + 5, 6.5, .35, Math.PI - .35); c.fillStyle = INK; c.fill();
    for (const x of [-3.5, 2.5]) tri(c, [x, hy + 9.6], [x + 1.6, hy + 9.6], [x + .8, hy + 7.4], '#f4ecd6');
  },
  kobold(c, d) {
    const { hy, C, skin } = d;
    for (const s of [-1, 1]) ink(c, pPoly([[s * 7, hy - 8], [s * 18, hy - 24], [s * 12, hy - 7]]), C('#efe2c2'));
    ink(c, pEl(0, hy - 1, 12, 11), skin);
    cap(c, d, .06, .92);
    ink(c, pEl(0, hy + 6.5, 9, 5.5), tint(skin, .18));
    circ(c, -2.5, hy + 5, .9, INK); circ(c, 2.5, hy + 5, .9, INK);
    inkLine(c, [[-5, hy + 9], [0, hy + 10], [5, hy + 9]], INK, .7);
    glowEye(c, -5, hy - 1, 2.5, d.eye, d.st); glowEye(c, 5, hy - 1, 2.5, d.eye, d.st); slit(c, -5, hy - 1, 2.5); slit(c, 5, hy - 1, 2.5);
    for (const [x, y] of [[-9, hy + 2], [8, hy + 3], [-7, hy - 5], [9, hy - 4]]) circ(c, x, y, .9, tint(skin, -.25));
  },
  werewolf(c, d) {
    const { hy, C, skin } = d;
    for (const s of [-1, 1]) { ink(c, pPoly([[s * 4, hy - 9], [s * 11, hy - 27], [s * 14, hy - 6]]), skin); c.fillStyle = C('#b88878'); c.fill(pPoly([[s * 7, hy - 10], [s * 11, hy - 22], [s * 12, hy - 9]])); }
    const fur = []; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = i % 2 ? 13 : 16; fur.push([Math.cos(a) * r, hy + 1 + Math.sin(a) * r * .95]); }
    ink(c, pPoly(fur), skin);
    ink(c, pEl(0, hy + 6, 8, 6.5), C('#c7b299'));
    ink(c, pEl(0, hy + 2.5, 3, 2), INK, 0, true);
    tri(c, [-3, hy + 10], [-1.6, hy + 10], [-2.3, hy + 13.5], '#fff'); tri(c, [1.6, hy + 10], [3, hy + 10], [2.3, hy + 13.5], '#fff');
    inkLine(c, [[-9, hy - 6], [-3, hy - 3]], INK, .9); inkLine(c, [[9, hy - 6], [3, hy - 3]], INK, .9);
    glowEye(c, -5.5, hy - 1.5, 2.4, d.eye, d.st); glowEye(c, 5.5, hy - 1.5, 2.4, d.eye, d.st);
  },
  dwarf(c, d) {
    const { hy, C, skin } = d, beard = C('#d4692a');
    ink(c, pEl(0, hy + 1, 12.5, 12), skin);
    // beard with braids
    const b = new Path2D(); b.moveTo(-13, hy + 1); b.quadraticCurveTo(-15, hy + 22, -6, hy + 30); b.lineTo(-4, hy + 38); b.lineTo(0, hy + 31); b.lineTo(4, hy + 38); b.lineTo(6, hy + 30); b.quadraticCurveTo(15, hy + 22, 13, hy + 1); b.quadraticCurveTo(0, hy + 10, -13, hy + 1); b.closePath();
    ink(c, b, beard);
    for (const x of [-4, 4]) { c.fillStyle = C('#e8c04a'); c.fillRect(x - 2, hy + 29, 4, 2.4); }
    inkLine(c, [[-5, hy + 7], [0, hy + 9], [5, hy + 7]], tint(beard, -.3), .8);
    ink(c, pEl(0, hy + 4.5, 3.6, 3), tint(skin, -.1));
    // helm
    const hm = new Path2D(); hm.moveTo(-14, hy - 1); hm.arc(0, hy - 1, 14, Math.PI, 0); hm.closePath();
    for (const s of [-1, 1]) { const p = new Path2D(); p.moveTo(s * 12, hy - 7); p.quadraticCurveTo(s * 26, hy - 8, s * 25, hy - 24); p.quadraticCurveTo(s * 19, hy - 12, s * 10, hy - 3); p.closePath(); ink(c, p, C('#efe3c6')); }
    ink(c, hm, C('#8f9aa4'));
    c.fillStyle = C(d.teamColor); c.fillRect(-14, hy - 3, 28, 2.6);
    ink(c, pRR(-1.8, hy - 3, 3.6, 8, 1), C('#8f9aa4'));
    inkLine(c, [[-9, hy - 1], [-3, hy]], beard, 1.6); inkLine(c, [[9, hy - 1], [3, hy]], beard, 1.6);
    glowEye(c, -5, hy + 1.5, 1.6, '#1e140e', true); glowEye(c, 5, hy + 1.5, 1.6, '#1e140e', true);
  },
  ogre(c, d) {
    const { hy, C, skin } = d;
    for (const s of [-1, 1]) ink(c, pEl(s * 11.5, hy + 1, 3.2, 4), skin);
    ink(c, pEl(0, hy, 11, 11.5), skin);
    ink(c, pEl(0, hy + 7, 10, 5.5), tint(skin, -.05));
    cap(c, d, .32, .72);
    ink(c, pRR(-10, hy - 4, 20, 4, 2), tint(skin, -.15));
    glowEye(c, -4.5, hy + 1, 1.5, '#2a1a0e', true); glowEye(c, 4.5, hy + 1, 1.5, '#2a1a0e', true);
    ink(c, pEl(0, hy + 4, 4, 2.6), tint(skin, -.12));
    for (const s of [-1, 1]) ink(c, pPoly([[s * 5, hy + 8], [s * 6.5, hy + 1.5], [s * 3, hy + 8]]), C('#f4ecd6'), 0, true);
    inkLine(c, [[-6, hy + 9], [6, hy + 9]], INK, .8);
    circ(c, 7, hy - 5, 1, tint(skin, -.3)); circ(c, -6, hy + 6, .8, tint(skin, -.3));
  },
  minotaur(c, d) {
    const { hy, C, skin } = d;
    for (const s of [-1, 1]) { const p = new Path2D(); p.moveTo(s * 9, hy - 9); p.quadraticCurveTo(s * 32, hy - 8, s * 31, hy - 33); p.quadraticCurveTo(s * 24, hy - 14, s * 9, hy - 3); p.closePath(); ink(c, p, C('#efe3c6')); c.fillStyle = C('#b7a78a'); c.fill(pPoly([[s * 29, hy - 26], [s * 31, hy - 33], [s * 25, hy - 22]])); }
    for (const s of [-1, 1]) ink(c, pEl(s * 16, hy - 2, 6, 2.8, s * .4), skin);
    ink(c, pEl(0, hy, 13.5, 14), skin);
    ink(c, pEl(0, hy + 8, 9.5, 7), C('#9a6a4a'));
    circ(c, -3.5, hy + 8, 1.4, INK); circ(c, 3.5, hy + 8, 1.4, INK);
    c.beginPath(); c.arc(0, hy + 12, 4, .1, Math.PI - .1); c.strokeStyle = C('#e8c04a'); c.lineWidth = LW * 1.2; c.stroke();
    ink(c, pPoly([[-5, hy - 13], [0, hy - 6], [5, hy - 13], [0, hy - 16]]), C('#3a2415'), 0, true);
    glowEye(c, -6, hy - 3, 2.2, d.eye, d.st); glowEye(c, 6, hy - 3, 2.2, d.eye, d.st);
  },
  troll(c, d) {
    const { hy, C, skin } = d;
    for (let i = -3; i <= 3; i++) inkLine(c, [[i * 3, hy - 10], [i * 6 + Math.sin(GFT.t * 2 + i) * 1.5, hy - 22 - Math.abs(i)]], C('#3f5a2a'), 1.8);
    ink(c, pEl(0, hy, 13, 12), skin);
    ink(c, pPoly([[-3, hy - 3], [3, hy - 3], [4, hy + 12], [0, hy + 15], [-2, hy + 11]]), tint(skin, -.1));
    for (const s of [-1, 1]) ink(c, pPoly([[s * 4, hy + 9], [s * 6, hy + 4], [s * 2.5, hy + 9]]), C('#f0e6cc'), 0, true);
    glowEye(c, -6, hy - 3, 2, d.eye, d.st); glowEye(c, 6, hy - 3, 2, d.eye, d.st);
    inkLine(c, [[-10, hy - 7], [-3, hy - 5]], INK, .9); inkLine(c, [[10, hy - 7], [3, hy - 5]], INK, .9);
    circ(c, -8, hy + 4, 1.1, tint(skin, -.3)); circ(c, 9, hy + 2, .9, tint(skin, -.3));
  },
  golem(c, d) {
    const { hy, C, skin } = d;
    for (const s of [-1, 1]) ink(c, pEl(s * (d.shw + 1), d.shY + 3, 9, 7), tint(skin, -.06));
    ink(c, pRR(-14, hy - 13, 28, 25, 4), skin);
    ink(c, pRR(-15, hy - 6, 30, 5, 2), tint(skin, -.12));
    inkLine(c, [[-8, hy - 13], [-4, hy - 6]], INK, .6); inkLine(c, [[6, hy + 3], [11, hy + 10]], INK, .6); inkLine(c, [[-11, hy + 5], [-6, hy + 9], [-7, hy + 12]], INK, .6);
    for (const x of [-6, 6]) { if (d.st) { c.fillStyle = '#5a5a56'; c.fillRect(x - 3, hy - 1, 6, 3); } else { c.save(); c.shadowColor = d.eye; c.shadowBlur = Math.max(2, 7 * FSC); c.fillStyle = d.eye; c.fillRect(x - 3.2, hy - 1, 6.4, 3); c.restore(); } }
    c.fillStyle = INK; c.fillRect(-5, hy + 7, 10, 2);
    // glowing chest rune
    if (!d.st) { c.save(); c.shadowColor = d.eye; c.shadowBlur = Math.max(2, 6 * FSC); inkLine(c, [[-4, d.shY + 12], [0, d.shY + 7], [4, d.shY + 12], [0, d.shY + 17], [-4, d.shY + 12]], d.eye, .9); c.restore(); }
  },
  harpy(c, d) {
    const { hy, C, skin } = d, fe = C('#6b4f86');
    for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + i * .14); ink(c, pEl(Math.cos(a) * 14, hy - 2 + Math.sin(a) * 14, 3, 8, a + Math.PI / 2), i % 2 ? fe : tint(fe, .15)); }
    ink(c, pPoly([[-11, hy - 4], [-12, hy + 4], [-5, hy + 12], [0, hy + 13], [5, hy + 12], [12, hy + 4], [11, hy - 4], [0, hy - 11]]), skin);
    ink(c, pPoly([[-1.5, hy + 1], [2.5, hy + 5], [0, hy + 7.5], [-2, hy + 5]]), C('#e8b43a'), 0, true);
    glowEye(c, -5, hy - 1, 2.3, d.eye, d.st); glowEye(c, 5, hy - 1, 2.3, d.eye, d.st);
    inkLine(c, [[-8, hy - 5], [-2.5, hy - 3.5]], INK, .8); inkLine(c, [[8, hy - 5], [2.5, hy - 3.5]], INK, .8);
  },
  elf(c, d) {
    const { hy, C, skin } = d, hood = C('#2e5a34');
    ink(c, pPoly([[0, hy - 25], [15, hy - 6], [17, hy + 12], [0, hy + 17], [-17, hy + 12], [-15, hy - 6]]), hood);
    for (const s of [-1, 1]) ink(c, pPoly([[s * 9, hy - 1], [s * 29, hy - 12], [s * 11, hy + 5]]), skin);
    ink(c, pEl(0, hy + 2, 10.5, 11.5), skin);
    c.fillStyle = C('#caa25a'); c.beginPath(); c.moveTo(-10, hy - 2); c.quadraticCurveTo(0, hy - 13, 10, hy - 2); c.quadraticCurveTo(0, hy - 7, -10, hy - 2); c.fill();
    for (const s of [-1, 1]) { ink(c, pEl(s * 4.5, hy + 2.5, 2.4, 1.7), '#fff', 0, true); circ(c, s * 4.5, hy + 2.5, 1.3, d.st ? '#555' : d.eye); }
    inkLine(c, [[-7, hy - .5], [-2.5, hy]], INK, .7); inkLine(c, [[7, hy - .5], [2.5, hy]], INK, .7);
    inkLine(c, [[-2, hy + 9], [2, hy + 9]], C('#9a5a4a'), .7);
    ink(c, pEl(0, d.shY + 1, 3.2, 3.2), C('#7fc05a'));
  },
  wraith(c, d) {
    const { hy, C } = d;
    ink(c, pPoly([[0, hy - 22], [14, hy - 8], [17, hy + 14], [0, hy + 12], [-17, hy + 14], [-14, hy - 8]]), C('#2b2442'));
    ink(c, pEl(0, hy + 2, 9.5, 10.5), '#05040a', 0, true);
    glowEye(c, -3.8, hy + 1, 2.2, d.eye, d.st); glowEye(c, 3.8, hy + 1, 2.2, d.eye, d.st);
    if (!d.st && FSC > .4) for (let i = 0; i < 3; i++) { c.globalAlpha *= .5; circ(c, Math.sin(GFT.t * 2 + i * 2) * 8, hy - 26 - ((GFT.t * 10 + i * 6) % 18), 1.6, '#9ff6ff'); c.globalAlpha *= 2; }
  },
  vampire(c, d) {
    const { hy, C, skin } = d;
    for (const s of [-1, 1]) ink(c, pPoly([[s * 11, hy - 3], [s * 18, hy - 10], [s * 12, hy + 3]]), skin);
    ink(c, pEl(0, hy + 1, 11.5, 13), skin);
    const hair = new Path2D(); hair.moveTo(-12, hy + 1); hair.quadraticCurveTo(-13, hy - 14, 0, hy - 13); hair.quadraticCurveTo(13, hy - 14, 12, hy + 1); hair.lineTo(8, hy - 6); hair.lineTo(0, hy - 2); hair.lineTo(-8, hy - 6); hair.closePath();
    ink(c, hair, C('#141019'));
    glowEye(c, -4.5, hy + 1, 2, d.eye, d.st); glowEye(c, 4.5, hy + 1, 2, d.eye, d.st);
    inkLine(c, [[-8, hy - 2.5], [-2, hy - 1]], INK, .8); inkLine(c, [[8, hy - 2.5], [2, hy - 1]], INK, .8);
    inkLine(c, [[-3.5, hy + 8], [3.5, hy + 8]], C('#7a1020'), .9);
    tri(c, [-3, hy + 8.2], [-1.6, hy + 8.2], [-2.3, hy + 11.5], '#fff'); tri(c, [1.6, hy + 8.2], [3, hy + 8.2], [2.3, hy + 11.5], '#fff');
  },
  lich(c, d) {
    const { hy, C, skin } = d;
    ink(c, pEl(0, hy - 1, 12.5, 12.5), skin);
    ink(c, pRR(-7, hy + 6, 14, 8, 3), skin);
    for (const s of [-1, 1]) { ink(c, pEl(s * 4.8, hy, 3.6, 4), '#0d0d14', 0, true); glowEye(c, s * 4.8, hy, 1.5, d.eye, d.st); }
    ink(c, pPoly([[0, hy + 3], [-1.8, hy + 6.5], [1.8, hy + 6.5]]), '#0d0d14', 0, true);
    for (let i = -2; i <= 2; i++) inkLine(c, [[i * 2.6, hy + 9], [i * 2.6, hy + 13]], INK, .45);
    inkLine(c, [[3, hy - 12], [5, hy - 7], [3, hy - 5]], INK, .5);
    const cr = new Path2D(); cr.moveTo(-12, hy - 8); for (let i = 0; i <= 6; i++) cr.lineTo(-12 + i * 4, hy - (i % 2 ? 13 : 22)); cr.lineTo(12, hy - 8); cr.closePath();
    ink(c, cr, C('#d8b64a'));
    glowEye(c, 0, hy - 11, 1.8, '#9d7bff', d.st);
    ink(c, pPoly([[-d.shw + 2, d.shY], [0, d.shY + 12], [d.shw - 2, d.shY], [d.shw - 6, d.shY - 6], [0, d.shY + 3], [-d.shw + 6, d.shY - 6]]), C('#d8b64a'), 0);
  },
  zombie(c, d) {
    const { hy, C, skin } = d;
    ink(c, pEl(-11.5, hy + 1, 2.5, 3.5), skin);
    ink(c, pEl(0, hy, 12.5, 12.5), skin);
    cap(c, d, -.34, .95);
    inkLine(c, [[-10, hy - 3], [3, hy - 7]], C('#3a2a2a'), .6);
    for (let x = -8; x < 3; x += 3) inkLine(c, [[x, hy - 5.5], [x + 1.4, hy - 3.2]], C('#3a2a2a'), .5);
    glowEye(c, -5, hy + 1, 3, d.eye, d.st); circ(c, -5, hy + 1, 1, INK);
    inkLine(c, [[3, hy], [7, hy + 2]], INK, .8); inkLine(c, [[3, hy + 2], [7, hy]], INK, .8);
    ink(c, pRR(-5, hy + 6, 10, 4.5, 2), '#2a1414', 0, true);
    for (let x = -3.5; x < 4; x += 2.4) c.fillStyle = '#e9e2c6', c.fillRect(x, hy + 6, 1.4, 1.8);
  },
  gorgon(c, d) {
    const { hy, C, skin } = d;
    ink(c, pEl(0, hy + 1, 12, 13), skin);
    for (let i = 0; i < 4; i++) snake(c, d, Math.PI * (1.18 + i * .22), 19, i + 7);
    for (const [x, y] of [[-8, hy + 5], [8, hy + 5], [-6, hy - 6], [7, hy - 6], [0, hy - 9]]) inkLine(c, [[x - 1, y], [x, y - 1], [x + 1, y]], tint(skin, -.25), .5);
    glowEye(c, -4.8, hy + 1, 2.4, d.eye, d.st); glowEye(c, 4.8, hy + 1, 2.4, d.eye, d.st); slit(c, -4.8, hy + 1, 2.4); slit(c, 4.8, hy + 1, 2.4);
    inkLine(c, [[0, hy + 8], [0, hy + 12], [-1.2, hy + 13.5]], C('#d83a4a'), .7); inkLine(c, [[0, hy + 12], [1.2, hy + 13.5]], C('#d83a4a'), .7);
  },
  spider(c, d) {
    const { hy, C, skin } = d;
    ink(c, pEl(0, hy, 12.5, 12), skin);
    const cr = new Path2D(); cr.moveTo(-10, hy - 8); cr.lineTo(-8, hy - 20); cr.lineTo(-4, hy - 12); cr.lineTo(0, hy - 22); cr.lineTo(4, hy - 12); cr.lineTo(8, hy - 20); cr.lineTo(10, hy - 8); cr.closePath();
    ink(c, cr, C('#b89ad0'));
    for (const [x, y, r] of [[-4, hy - 1, 2.2], [4, hy - 1, 2.2], [-8, hy - 3, 1.5], [8, hy - 3, 1.5], [-2, hy - 5, 1.2], [2, hy - 5, 1.2]]) glowEye(c, x, y, r, d.eye, d.st);
    for (const s of [-1, 1]) { const p = new Path2D(); p.moveTo(s * 2.5, hy + 5); p.quadraticCurveTo(s * 7, hy + 9, s * 3, hy + 13); p.quadraticCurveTo(s * 4, hy + 9, s * 1, hy + 7); p.closePath(); ink(c, p, C('#e9e2f2'), 0, true); }
  },
  skeleton(c, d) {
    const { hy, C } = d, steel = C('#7c8490');
    const pl = new Path2D(); pl.moveTo(0, hy - 14); pl.quadraticCurveTo(10, hy - 34, 20, hy - 30); pl.quadraticCurveTo(10, hy - 26, 4, hy - 13); pl.closePath();
    ink(c, pl, d.jer);
    ink(c, pRR(-13, hy - 14, 26, 27, 9), steel);
    ink(c, pRR(-11, hy - 3, 22, 4.5, 2), '#0b0b10', 0, true);
    glowEye(c, -4.5, hy - .8, 1.6, d.eye, d.st); glowEye(c, 4.5, hy - .8, 1.6, d.eye, d.st);
    c.fillStyle = INK; c.fillRect(-.8, hy + 2, 1.6, 9);
    for (const y of [hy + 5, hy + 8]) for (const x of [-6, -3.5, 3.5, 6]) circ(c, x, y, .8, INK);
    for (const x of [-10, 10]) circ(c, x, hy - 8, 1, C('#b8c0ca'));
  },
  witch(c, d) {
    const { hy, C, skin } = d;
    ink(c, pEl(0, hy + 1, 11, 12), skin);
    c.fillStyle = C('#eef2f8'); for (const s of [-1, 1]) c.fill(pPoly([[s * 11, hy - 4], [s * 13, hy + 14], [s * 7, hy + 6], [s * 8, hy - 6]]));
    ink(c, pEl(0, hy - 8, 23, 5), C('#16132a'));
    const cone = new Path2D(); cone.moveTo(-11, hy - 9); cone.quadraticCurveTo(-5, hy - 30, 8, hy - 47); cone.quadraticCurveTo(4, hy - 30, 11, hy - 9); cone.closePath();
    ink(c, cone, C('#16132a'));
    c.fillStyle = d.jer; c.fill(pPoly([[-11, hy - 10], [11, hy - 10], [10, hy - 14], [-10, hy - 14]]));
    ink(c, pRR(-2.5, hy - 14.5, 5, 5, 1), C('#d8b64a'), 0, true);
    glowEye(c, -4.3, hy + 2, 2, d.eye, d.st); glowEye(c, 4.3, hy + 2, 2, d.eye, d.st);
    inkLine(c, [[-2.5, hy + 8.5], [2.5, hy + 8.5]], C('#4a7aa8'), .8);
    if (!d.st && FSC > .4) for (let i = 0; i < 3; i++) { const a = GFT.t * 1.5 + i * 2.1; txt(c, '✦', Math.cos(a) * 20, hy - 18 + Math.sin(a) * 6, '6px sans-serif', 'rgba(200,240,255,.8)', 'center'); }
  },
};

/* ---------- bodies: tapered, jointed limbs and a shaped torso, with flourishes per creature ---------- */
// per-kind body details: feet, socks, muscle, tails, fur, armour and trinkets
const BODY = {
  goblin:   { foot: 'claw', musc: 0, slim: true, strap: '#5a3a22', wrist: true },
  kobold:   { foot: 'claw', slim: true, tail: 'lizard', scales: true },
  werewolf: { foot: 'claw', musc: .65, tail: 'bushy', tuft: '#4f3d2e', clawHand: true, fur: true },
  dwarf:    { foot: 'boot', musc: .55, bracer: '#6b4a2a', stout: true },
  ogre:     { foot: 'claw', musc: .85, torn: true, bone: true },
  minotaur: { foot: 'hoof', musc: 1, tail: 'tuft', tuft: '#3e2718', bracer: '#6b4a2a', shinFur: '#4a2e1c' },
  troll:    { foot: 'claw', musc: .7, armLen: 1.16, moss: true, clawHand: true },
  golem:    { foot: 'stone', musc: .45, stone: true },
  harpy:    { foot: 'talon', slim: true, birdLeg: true, feathers: true, clawHand: true },
  elf:      { foot: 'boot', slim: true, cloak: '#2e5a34', bracer: '#7a5a34', quiver: true },
  wraith:   { robe: true, clawHand: true, slim: true },
  vampire:  { foot: 'pointy', slim: true, lace: true },
  lich:     { robe: true, slim: true },
  zombie:   { foot: 'cleat', musc: .3, stitches: true, torn: true },
  gorgon:   { foot: 'cleat', slim: true, scales: true, snakeBelt: true },
  spider:   { foot: 'cleat', slim: true, clawHand: true },
  skeleton: { foot: 'sabaton', armor: true, slim: true },
  witch:    { foot: 'pointy', slim: true, stripes: true },
};
// a limb segment: round ends, tapered, with optional bulges on either side (muscle, calf)
function capsule(x1, y1, r1, x2, y2, r2, b1 = 0, b2 = 0) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const an = Math.atan2(ny, nx), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, rm = (r1 + r2) / 2;
  const p = new Path2D();
  p.moveTo(x1 + nx * r1, y1 + ny * r1);
  p.quadraticCurveTo(mx + nx * (rm + 2 * b1), my + ny * (rm + 2 * b1), x2 + nx * r2, y2 + ny * r2);
  p.arc(x2, y2, r2, an, an - Math.PI, true);
  p.quadraticCurveTo(mx - nx * (rm + 2 * b2), my - ny * (rm + 2 * b2), x1 - nx * r1, y1 - ny * r1);
  p.arc(x1, y1, r1, an - Math.PI, an - 2 * Math.PI, true);
  p.closePath(); return p;
}
const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
function bands(c, path, list) { c.save(); c.clip(path); for (const [y0, h, col] of list) { c.fillStyle = col; c.fillRect(-60, y0, 120, h); } c.restore(); c.lineWidth = LW; c.strokeStyle = INK; c.stroke(path); }

// a leg in its own frame: hip at the origin, foot on the ground 36 below; lift raises the knee and foot
function leg(c, x, a, w, d, side, lift = 0) {
  const B = d.B, det = FSC > .45;
  c.save(); c.translate(x, -36); c.rotate(a);
  const hip = { x: 0, y: -2 }, knee = { x: side * lift * 3, y: 16 - lift * 5 }, ank = { x: side * lift * 1.2, y: 30 - lift * 14 };
  const rH = w * .47, rK = w * .38, rA = w * (B.birdLeg ? .16 : .25);
  // shin: sock, stocking, fur, bird leg, stone or greave
  const shinCol = B.birdLeg ? d.C('#d9a74a') : B.stone ? d.skin : B.armor ? d.C('#8a929c') : B.shinFur ? d.C(B.shinFur) : B.fur ? d.skin : B.stripes ? d.C('#1a1426') : d.jer;
  const shin = capsule(knee.x, knee.y, rK * (B.birdLeg ? .5 : .95), ank.x, ank.y, rA, w * (B.birdLeg ? 0 : .08), w * (B.birdLeg ? 0 : .06));
  ink(c, shin, shinCol);
  if (B.stripes) bands(c, shin, [0, 1, 2, 3].map(i => [knee.y + 2 + i * 3.6, 1.8, d.C('#8a5ad0')]));
  else if (!B.birdLeg && !B.stone && !B.armor && !B.shinFur && !B.fur) bands(c, shin, [[knee.y + 5, 1.7, d.trimL], [knee.y + 8.2, 1.7, d.trimL]]);
  if (det) {
    if (B.birdLeg) for (let i = 1; i < 4; i++) { const p = lerpP(knee, ank, i / 4); inkLine(c, [[p.x - 1.6, p.y], [p.x + 1.6, p.y]], d.C('#9a6a2a'), .5); }
    if (B.stone) inkLine(c, [[knee.x - 2, knee.y + 5], [knee.x + 1, knee.y + 9], [knee.x - 1, knee.y + 12]], INK, .5);
    if (B.armor) ink(c, pEl(knee.x, knee.y + 1, rK * 1.05, rK * .9), d.C('#b8c0ca'), 0, true);
    if (B.fur || B.shinFur) for (const t of [.35, .6]) { const p = lerpP(knee, ank, t); inkLine(c, [[p.x - rK * .6, p.y], [p.x - rK * .2, p.y + 2.5]], INK, .45); inkLine(c, [[p.x + rK * .6, p.y - 1], [p.x + rK * .25, p.y + 1.8]], INK, .45); }
    if (B.torn && !B.fur) ink(c, pEl(knee.x + side * .6, knee.y + 8, rK * .45, 2.2), d.skin, 0, true);
  }
  // thigh in baseball knickers, gathered below the knee
  const thigh = capsule(hip.x, hip.y, rH, knee.x, knee.y + 1.5, rK * 1.08, w * .07, w * .05);
  ink(c, thigh, B.stone ? d.skin : d.pants);
  ink(c, pEl(knee.x, knee.y + 2.6, rK * 1.14, 2.6), B.stone ? tint(d.skin, -.08) : d.pants, 0, true);
  if (det) inkLine(c, [[knee.x - rK * .9, knee.y + 3.2], [knee.x + rK * .9, knee.y + 3.2]], tint(d.pants, -.25), .45);
  // team piping down the outer seam
  if (!B.stone) inkLine(c, [[side * rH * .82, hip.y + 1], [knee.x + side * rK * .95, knee.y]], d.jer, .9);
  foot(c, ank, w, d, side);
  c.restore();
}
function foot(c, a, w, d, side) {
  const B = d.B, f = B.foot || 'cleat', x = a.x, y = a.y + 2.4;
  if (f === 'talon') { for (const dx of [-3.5, 0, 3.5]) ink(c, pPoly([[x + dx - 1.5, a.y + 1], [x + dx + 1.5, a.y + 1], [x + dx + .5, a.y + 6]]), d.C('#e8b43a'), 0, true); return; }
  if (f === 'hoof') { for (const s of [-1, 1]) ink(c, pEl(x + s * w * .27, y + .4, w * .3, 3.4), d.C('#1b1410'), 0, true); c.fillStyle = d.C('#4a3a30'); c.fillRect(x - w * .5, a.y - 1.2, w, 1.6); return; }
  if (f === 'stone') { ink(c, pRR(x - w * .62, a.y - 1, w * 1.24, 6.6, 2.4), tint(d.skin, -.1)); return; }
  if (f === 'claw') {
    ink(c, pEl(x + side * .6, y, w * .6, 3.6), B.fur ? tint(d.skin, -.1) : d.skin);
    if (FSC > .35) for (const dx of [-.34, 0, .34]) ink(c, pPoly([[x + dx * w - 1.2, y + 2], [x + dx * w + 1.2, y + 2], [x + dx * w + side * .4, y + 4.8]]), d.C('#efe6cf'), 0, true);
    return;
  }
  const col = f === 'sabaton' ? d.C('#8a929c') : f === 'boot' ? d.C('#4a2e1c') : '#1d1714';
  if (f === 'boot') ink(c, pRR(x - w * .46, a.y - 4, w * .92, 7, 2.5), col, 0, true);
  ink(c, pEl(x + side * .9, y, w * .64, 3.8), col, 0, true);
  if (f === 'pointy') { const p = new Path2D(); p.moveTo(x + side * w * .4, y - 2.4); p.quadraticCurveTo(x + side * w * 1.1, y - .5, x + side * w * 1.05, y - 4.5); p.quadraticCurveTo(x + side * w * .9, y + 2.6, x + side * w * .3, y + 2.6); p.closePath(); ink(c, p, col, 0, true); }
  if (FSC > .45 && f === 'cleat') inkLine(c, [[x - w * .25, y - 1.8], [x + w * .25, y - 1.8]], '#e8e0cc', .6);
  if (FSC > .45 && f === 'sabaton') inkLine(c, [[x - w * .4, y - .6], [x + w * .4, y - .6]], d.C('#b8c0ca'), .5);
}

// an arm from shoulder to hand target, bent at an elbow found by two-bone IK; the old callers pass the same arguments
function arm(c, sx, sy, hx, hy, d, opt = {}) {
  const B = d.B, det = FSC > .45, musc = B.musc || 0, bony = d.bony;
  const aw = 7.2 * clamp(d.w, .9, 1.5) * (bony ? .78 : 1) * (B.slim ? .92 : 1);
  let Lu = 17.5 * (B.armLen || 1), Lf = 16.5 * (B.armLen || 1);
  let dx = hx - sx, dy = hy - sy, D = Math.hypot(dx, dy);
  if (D < 10) { dx = 0; dy = 10; D = 10; }
  const reach = (Lu + Lf) * .995; if (D > reach) { const k = D / reach; Lu *= k; Lf *= k; }
  const th = Math.atan2(dy, dx), al = Math.acos(clamp((Lu * Lu + D * D - Lf * Lf) / (2 * Lu * D), -1, 1));
  const out = sx < 0 ? -1 : 1, E = s => ({ x: sx + Lu * Math.cos(th + s * al), y: sy + Lu * Math.sin(th + s * al) });
  const e1 = E(1), e2 = E(-1), sc = e => e.x * out + .35 * e.y, el = sc(e1) >= sc(e2) ? e1 : e2;
  const S = { x: sx, y: sy }, H = { x: sx + dx, y: sy + dy };
  const skin = d.armC;
  // forearm, then upper arm over the elbow
  const fore = capsule(el.x, el.y, aw * .48, H.x, H.y, aw * .34, aw * (.06 + .14 * musc), aw * (.04 + .06 * musc));
  const upper = capsule(S.x, S.y, aw * .56, el.x, el.y, aw * .46, aw * .14 * musc, aw * .1 * musc);
  if (d.robe) {
    ink(c, fore, skin); ink(c, upper, skin);
    const tip = lerpP(el, H, .82);
    ink(c, capsule(S.x, S.y, aw * .66, el.x, el.y, aw * .62), d.robe);
    ink(c, capsule(el.x, el.y, aw * .6, tip.x, tip.y, aw * .86, aw * .06, aw * .06), d.robe);
    if (det) inkLine(c, [[tip.x - aw * .7, tip.y], [tip.x + aw * .7, tip.y]], d.C('#d8b64a'), .8);
  } else {
    ink(c, fore, skin); ink(c, upper, skin);
    if (bony && det) { inkLine(c, [[el.x, el.y], [lerpP(el, H, .85).x, lerpP(el, H, .85).y]], tint(skin, -.25), .5); circ(c, el.x, el.y, aw * .3, tint(skin, -.08)); }
    if (B.stone && det) { const m = lerpP(el, H, .5); inkLine(c, [[m.x - 2, m.y - 2], [m.x + 1, m.y], [m.x - 1, m.y + 3]], INK, .5); if (!d.st) { c.save(); c.shadowColor = d.eye; c.shadowBlur = 5 * FSC; circ(c, el.x, el.y, 1.4, d.eye); c.restore(); } }
    if (B.stitches && det) { const a0 = lerpP(el, H, .25), a1 = lerpP(el, H, .7); inkLine(c, [[a0.x, a0.y], [a1.x, a1.y]], INK, .5); for (let i = 1; i < 4; i++) { const p = lerpP(a0, a1, i / 4); inkLine(c, [[p.x - 1.6, p.y - .6], [p.x + 1.6, p.y + .6]], INK, .45); } }
    if (B.scales && det) for (const t of [.3, .55, .8]) { const p = lerpP(el, H, t); c.beginPath(); c.arc(p.x, p.y, 1.2, 0, Math.PI); c.strokeStyle = tint(skin, -.3); c.lineWidth = LW * .45; c.stroke(); }
    if (B.tuft && det) { const w2 = lerpP(el, H, .78), dir = Math.atan2(H.y - el.y, H.x - el.x) + Math.PI / 2; for (let i = -1; i <= 1; i++) { const bx = w2.x + Math.cos(dir) * aw * .45 * i, by = w2.y + Math.sin(dir) * aw * .45 * i; ink(c, pPoly([[bx - 1.4, by - 1], [bx + 1.4, by - 1], [bx + (H.x - el.x) * .06, by + 4]]), d.C(B.tuft), 0, true); } }
    if (B.feathers && det) for (let i = 0; i < 4; i++) { const p = lerpP(el, H, .1 + i * .22); ink(c, pEl(p.x + out * aw * .55, p.y + 2, 1.8, 5, out * .5), d.C((B.fea || ['#6b4f86', '#8b76a0'])[i % 2 ? 0 : 1]), 0, true); }
    if (B.bracer) { const b0 = lerpP(el, H, .5), b1 = lerpP(el, H, .9); ink(c, capsule(b0.x, b0.y, aw * .46, b1.x, b1.y, aw * .42), d.C(B.bracer), 0, true); if (det) inkLine(c, [[lerpP(b0, b1, .5).x - aw * .4, lerpP(b0, b1, .5).y], [lerpP(b0, b1, .5).x + aw * .4, lerpP(b0, b1, .5).y]], d.C('#d8b64a'), .5); }
    if (B.wrist) { const b0 = lerpP(el, H, .72), b1 = lerpP(el, H, .9); ink(c, capsule(b0.x, b0.y, aw * .4, b1.x, b1.y, aw * .38), d.trimL, 0, true); }
    // sleeve: short baseball sleeve over the top of the upper arm, torn for the brutes
    const sEnd = lerpP(S, el, .55);
    const sl = capsule(S.x, S.y - 1, aw * .7, sEnd.x, sEnd.y, aw * .62, aw * .05, aw * .05);
    ink(c, sl, d.jer);
    if (det) { const ang = Math.atan2(el.y - S.y, el.x - S.x) + Math.PI / 2, cx = Math.cos(ang) * aw * .6, cy = Math.sin(ang) * aw * .6, t2 = lerpP(S, el, .44);
      if (B.torn) { const pts = []; for (let i = 0; i <= 4; i++) { const k = i / 4 - .5; pts.push([sEnd.x + cx * 2 * k + (i % 2 ? (el.x - S.x) * .08 : 0), sEnd.y + cy * 2 * k + (i % 2 ? (el.y - S.y) * .08 : 0)]); } inkLine(c, pts, INK, .6); }
      else inkLine(c, [[t2.x - cx, t2.y - cy], [t2.x + cx, t2.y + cy]], d.trimL, 1.3); }
    if (B.lace && det) { const p = lerpP(el, H, .9); for (let i = -1; i <= 1; i++) circ(c, p.x + i * aw * .32, p.y + 1.2, aw * .2, '#f2eee6'); }
  }
  // hand, turned along the forearm
  const ang = Math.atan2(-(H.x - el.x), H.y - el.y);
  c.save(); c.translate(H.x, H.y); c.rotate(ang);
  if (opt.mitt) { ink(c, pEl(0, 2.5, aw * .95, aw * 1.1), d.C('#8a5530')); inkLine(c, [[-aw * .5, 1.5], [aw * .5, 1.5]], d.C('#5a3218'), .6); if (det) inkLine(c, [[-aw * .3, 4.2], [0, 5.4], [aw * .3, 4.2]], d.C('#5a3218'), .5); }
  else if (!opt.noHand) {
    ink(c, pEl(0, 1.2, aw * .6, aw * .64), bony ? tint(skin, -.05) : skin);
    if (det && !opt.ball) ink(c, pEl(-out * aw * .5, .2, aw * .22, aw * .36, out * .5), skin, 0, true);
    if (bony && det) for (const fx of [-.3, 0, .3]) inkLine(c, [[fx * aw, aw * .5], [fx * aw * 1.2, aw * 1.3]], INK, .45);
    if ((B.clawHand || B.fur) && det) for (const fx of [-.32, 0, .32]) ink(c, pPoly([[fx * aw - 1, aw * .55], [fx * aw + 1, aw * .55], [fx * aw * 1.25, aw * .55 + 3.2]]), d.C('#efe6cf'), 0, true);
  }
  if (opt.ball) ink(c, pEl(0, 3, 3.4, 3.4), '#f6f0e0', 0, true);
  if (opt.ember && !d.st) { c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = Math.max(2, 8 * FSC); circ(c, 0, 4, 2.2 + Math.sin(GFT.t * 20) * .5, '#ffcf5a'); c.restore(); }
  c.restore();
  // shoulder pieces sit on top of the sleeve
  if (B.armor) { ink(c, pEl(S.x + out * 1.5, S.y - 1, aw * .95, aw * .72, out * .3), d.C('#8a929c')); if (det) inkLine(c, [[S.x - aw * .6 + out * 1.5, S.y + 1], [S.x + aw * .6 + out * 1.5, S.y + 1]], d.C('#b8c0ca'), .6); }
  if (B.stone) ink(c, pEl(S.x + out * 1.5, S.y - 2, aw * .95, aw * .8), tint(d.skin, -.06));
  if (B.moss && det) { for (let i = 0; i < 4; i++) ink(c, pEl(S.x - aw * .5 + i * aw * .34, S.y - 3 - (i % 2) * 1.5, 2.4, 1.8), d.C(i % 2 ? '#4f7a2e' : '#6a9a3a'), 0, true); circ(c, S.x + out * aw * .4, S.y - 6, 1.6, d.C('#d8c9a0')); }
}

/* tails and cloaks drawn behind the body */
function tailChain(c, pts, col, tipCol) {
  for (let i = 0; i < pts.length - 1; i++) ink(c, capsule(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]), i === pts.length - 2 && tipCol ? tipCol : col, 0, true);
}
BACK.werewolf = (c, d) => {
  const s = Math.sin(GFT.t * 3 + (d.o.run || 0)) * 4, x = d.shw;
  const p = new Path2D(); p.moveTo(4, -42); p.bezierCurveTo(x + 6, -46, x + 22 + s, -34, x + 18 + s, -10); p.bezierCurveTo(x + 14 + s, -18, x + 8, -30, 2, -34); p.closePath();
  ink(c, p, d.C('#5d4a3a')); if (FSC > .45) ink(c, pEl(x + 17 + s, -13, 3.5, 5), d.C('#d8cbb4'), 0, true);
};
BACK.minotaur = (c, d) => {
  const s = Math.sin(GFT.t * 2.4 + (d.o.run || 0)) * 5, x = d.shw;
  const tl = [[4, -40], [x + 6, -38], [x + 13 + s, -30], [x + 15 + s * 1.3, -22]];
  inkLine(c, tl, INK, 2.6); inkLine(c, tl, d.skin, 1.4);
  ink(c, pEl(x + 15 + s * 1.3, -19, 2.8, 4.6, s * .05), d.C('#2a1a10'));
};
BACK.kobold = (c, d) => {
  const s = Math.sin(GFT.t * 3.4 + (d.o.run || 0)) * 4, x = d.shw;
  tailChain(c, [[2, -38, 5], [x + 6, -26, 4], [x + 16 + s, -10, 2.4], [x + 24 + s * 1.4, -12, .8]], d.skin);
  if (!d.st && FSC > .3) { c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = 8 * FSC; const f = Math.sin(GFT.t * 18) * .8; ink(c, pPoly([[x + 21 + s * 1.4, -13], [x + 27 + s * 1.4, -13], [x + 24 + s * 1.4 + f, -21]]), '#ffb03a', 0, true); c.restore(); }
};
BACK.elf = (c, d) => {
  const fl = Math.sin(GFT.t * 2.2 + (d.o.run || 0)) * (d.o.run ? 5 : 1.5), col = d.C(d.B.cloak);
  const p = new Path2D(); p.moveTo(-d.shw + 1, d.shY); p.quadraticCurveTo(-d.shw - 9, -30, -d.shw - 7 - fl, -10); p.quadraticCurveTo(0, -4 + fl, d.shw + 7 + fl, -10); p.quadraticCurveTo(d.shw + 9, -30, d.shw - 1, d.shY); p.closePath();
  ink(c, p, col); if (FSC > .45) inkLine(c, [[-d.shw - 5, -12], [-d.shw + 4, -24]], tint(d.B.cloak, -.3), .5);
};

// a shaped torso: sloped shoulders, chest, waist and hips; bellies for the big eaters
function torsoPath(d, K) {
  const B = d.B, shw = d.shw, shY = d.shY, hipY = -36;
  const waist = shw * (K.belly ? .92 : B.slim ? .7 : B.stout ? .86 : .76), chest = shw * (B.musc ? 1 + .06 * B.musc : .98), belly = K.belly ? 11 * d.w : B.stout ? 3 : 0;
  const t = new Path2D();
  t.moveTo(-7, shY - 2);
  t.quadraticCurveTo(-shw + 5, shY - 3.5, -shw, shY + 4);
  t.bezierCurveTo(-chest - 1, shY + 14, -waist - belly, hipY - 12, -waist, hipY);
  t.quadraticCurveTo(0, hipY + 3, waist, hipY);
  t.bezierCurveTo(waist + belly, hipY - 12, chest + 1, shY + 14, shw, shY + 4);
  t.quadraticCurveTo(shw - 5, shY - 3.5, 7, shY - 2);
  t.quadraticCurveTo(0, shY + 1, -7, shY - 2);
  t.closePath();
  return { t, waist, belly };
}

function drawFig(c, kind, x, y, hpx, team, o = {}) {
  const K = KIND[kind] || KIND.goblin, s = hpx * K.h / 100, w = K.w, st = !!o.stone;
  const C = v => st ? grey(v) : v;
  const hunch = K.hunch ? 6 : 0, shY = -70 + hunch, hipY = -36;
  const shw = 17 * w * (kind === 'ogre' ? .9 : 1);
  const hy = kind === 'ogre' ? -80 : kind === 'golem' ? -80 : -83 + hunch * 1.4;
  const hr = kind === 'ogre' ? 11 : kind === 'minotaur' ? 14 : 12.5;
  const B = BODY[kind] || {};
  const d = {
    o, C, st, w, shY, shw, hy, hr, kind, eye: K.eye, skin: C(K.skin), jer: C(team.color), jerD: C(tint(team.color, -.38)), trimL: C(team.light || '#fff'),
    teamColor: team.color, letter: (team.short || '?')[0], pants: C('#e4dbc6'), armC: C(K.bony ? '#ebe5d2' : K.skin), bony: K.bony, robe: K.robe ? C(K.robe) : null, B,
  };
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s);
  LW = Math.max(1.25, 1 / s); FSC = s; FLIPPED = !!o.flip;
  const pose = o.pose || null, det = s > .45;
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (!o.noShadow) ell(c, 0, 0, 24 * w, 5, 'rgba(0,0,0,.35)');
  if (o.lift) c.translate(0, -o.lift);
  const run = o.run || 0, sw = Math.sin(run);
  if (run) c.translate(0, -Math.abs(Math.cos(run)) * 2.5);
  if (pose) { c.translate(pose.shift || 0, pose.drop || 0); if (pose.scale && pose.scale !== 1) c.scale(pose.scale, pose.scale); }
  if (BACK[kind]) BACK[kind](c, d);
  // legs: running lifts the leading leg; poses drive them directly
  if (!K.robe) {
    const lw = 10.5 * w, lx = 6.2 * w;
    const lL = pose ? pose.legL : { a: sw * .55, lift: run ? Math.max(0, sw) * .4 : 0 }, lR = pose ? pose.legR : { a: -sw * .55, lift: run ? Math.max(0, -sw) * .4 : 0 };
    leg(c, -lx, lL.a, lw, d, -1, lL.lift || 0); leg(c, lx, lR.a, lw, d, 1, lR.lift || 0);
    { const sw2 = shw * (K.belly ? .7 : .52), seat = new Path2D(); seat.moveTo(-sw2, hipY - 2); seat.quadraticCurveTo(-sw2 * .9, hipY + 7, 0, hipY + 6); seat.quadraticCurveTo(sw2 * .9, hipY + 7, sw2, hipY - 2); seat.closePath(); ink(c, seat, d.pants, 0, true); } // seat of the knickers
  } else if (kind === 'lich') { for (const s2 of [-1, 1]) ink(c, pEl(s2 * 6, -2, 5, 3), '#1d1714', 0, true); }
  c.save(); if (pose && pose.lean) { c.translate(0, hipY); c.rotate(pose.lean); c.translate(0, -hipY); }
  // torso / jersey
  const { t, waist } = torsoPath(d, K);
  ink(c, t, d.jer);
  if (det) {
    // placket and buttons, a fold at the waist
    inkLine(c, [[1.5, shY + 7], [1.5, hipY - 4]], d.jerD, .7);
    for (let i = 0; i < 3; i++) circ(c, 3.4, shY + 12 + i * 8, .9, d.trimL);
    inkLine(c, [[-waist + 3, hipY - 9], [-waist + 9, hipY - 6.5]], d.jerD, .5);
  }
  inkLine(c, [[-7, shY - 1.5], [0, shY + 7], [7, shY - 1.5]], d.trimL, 1.6);
  // creature trimmings on the chest
  if (B.tuft) ink(c, pPoly([[-5, shY - 1], [-3, shY + 5], [-1, shY + 1], [1, shY + 6], [3, shY + 1], [5, shY + 5], [6, shY - 1]]), d.C(B.tuft), 0, true);
  if (B.strap && det) { inkLine(c, [[-shw + 3, shY + 3], [waist - 2, hipY - 3]], d.C(B.strap), 2.2); for (const k of [.35, .6]) { const px = lerp(-shw + 3, waist - 2, k), py = lerp(shY + 3, hipY - 3, k); ink(c, pRR(px - 2.5, py - 2, 5, 5, 1.2), d.C('#7a5230'), 0, true); } }
  if (B.quiver && det) inkLine(c, [[shw - 3, shY + 2], [-waist + 2, hipY - 4]], d.C('#6a4a2a'), 1.6);
  if (B.lace) ink(c, pPoly([[-4, shY - 1], [4, shY - 1], [2.5, shY + 9], [0, shY + 11], [-2.5, shY + 9]]), d.C('#f2eee6'), 0, true);
  if (B.torn && det) { ink(c, pPoly([[-shw * .45, shY + 20], [-shw * .2, shY + 17], [-shw * .1, shY + 24], [-shw * .3, shY + 27]]), kind === 'zombie' ? d.C('#3a2a2a') : d.skin, 0, true); if (kind === 'zombie') for (let i = 0; i < 3; i++) inkLine(c, [[-shw * .42, shY + 20.5 + i * 2], [-shw * .18, shY + 19.5 + i * 2]], d.C('#e9e2c6'), .5); }
  if (B.stone && det) { inkLine(c, [[-shw * .5, shY + 6], [-shw * .3, shY + 14], [-shw * .45, shY + 20]], INK, .6); inkLine(c, [[shw * .55, hipY - 14], [shw * .35, hipY - 8]], INK, .6); }
  if (B.scales && det) for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-shw * .55 + i * 2.5, shY + 8 + (i % 2) * 2, 1.2, 0, Math.PI); c.strokeStyle = d.jerD; c.lineWidth = LW * .5; c.stroke(); }
  // belt, and whatever is tucked in it
  ink(c, pRR(-waist - .5, hipY - 3.5, 2 * waist + 1, 5.5, 1.5), B.snakeBelt ? d.C('#3f8a4f') : '#2a1d17', 0, true);
  if (B.snakeBelt && det) { ink(c, pEl(waist - 1, hipY - 1, 3.4, 2.6), d.C('#4f9a5d'), 0, true); circ(c, waist, hipY - 1.6, .7, d.C('#ffe14a')); }
  else ink(c, pRR(B.stout ? -4 : -2.2, hipY - (B.stout ? 4.5 : 3.2), B.stout ? 8 : 4.4, B.stout ? 7 : 4.8, .8), C('#d8b64a'), 0, true);
  if (B.bone && det) { ink(c, pRR(waist - 8, hipY - 7, 3, 11, 1.4), d.C('#efe6cf'), 0, true); circ(c, waist - 6.5, hipY - 7, 2, d.C('#efe6cf')); }
  // number
  if (s * 100 > 26) {
    c.font = `900 ${16}px "Alegreya Sans", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    if (o.flip) { c.save(); c.scale(-1, 1); }
    c.lineWidth = LW * 1.1; c.strokeStyle = INK; c.strokeText(String(o.num ?? ''), 0, shY + 25); c.fillStyle = st ? '#ddd' : '#fbf6ea'; c.fillText(String(o.num ?? ''), 0, shY + 25);
    if (o.flip) c.restore();
  }
  // arms
  const swing = run ? sw * 7 : 0;
  if (pose && pose.armR) {
    arm(c, -shw + 2, shY + 3, pose.armL.x, pose.armL.y, d, { mitt: true });
    if (pose.trailR && pose.trailR.length > 1 && !st) {
      c.save(); c.lineCap = 'round';
      for (let i = pose.trailR.length - 1; i > 0; i--) { const a = pose.trailR[i], b = pose.trailR[i - 1]; c.strokeStyle = `rgba(255,248,230,${.32 * (1 - i / pose.trailR.length)})`; c.lineWidth = 7 * (1 - i / pose.trailR.length) + 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      c.restore();
    }
    arm(c, shw - 2, shY + 3, pose.armR.x, pose.armR.y, d, { ball: pose.ball, ember: kind === 'kobold' });
  } else if (o.throwK != null) {
    const k = clamp(o.throwK, 0, 1), th = lerp(2.5, -.25, k), hx2 = shw + 27 * Math.sin(th), hy2 = shY + 2 - 27 * Math.cos(th);
    arm(c, -shw + 2, shY + 3, -shw - 5, shY + 22, d, { mitt: true });
    arm(c, shw - 2, shY + 3, hx2, hy2, d, { ball: true, ember: kind === 'kobold' });
  } else if (o.follow) {
    arm(c, -shw + 2, shY + 3, -shw - 5, shY + 22, d, { mitt: true });
    arm(c, shw - 2, shY + 3, -4, shY + 24, d, {});
  } else if (kind === 'zombie') {
    arm(c, -shw + 2, shY + 3, -shw + 2 + swing, shY + 24, d, { mitt: o.mitt });
    arm(c, shw - 2, shY + 3, shw + 4 - swing, shY + 10, d, {});
  } else {
    arm(c, -shw + 2, shY + 3, -shw - 4 + swing, shY + 33, d, { mitt: o.mitt });
    arm(c, shw - 2, shY + 3, shw + 4 - swing, shY + 33, d, { ember: kind === 'kobold' });
  }
  // neck + head
  if (!K.robe && kind !== 'golem') ink(c, capsule(0, shY + 1, 4.2, 0, hy + 9, 4.6), d.skin, 0, true);
  HEAD[kind] ? HEAD[kind](c, d) : ink(c, pEl(0, hy, 12, 12), d.skin);
  c.restore();
  c.restore();
}


function tri(c, a, b, d, col) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fillStyle = col; c.fill(); }
function circ(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
function ell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
