/* ================= rendering ================= */
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let DPR = 1;
function fitCanvas() { DPR = Math.min(2, window.devicePixelRatio || 1); cv.width = W * DPR; cv.height = H * DPR; }
fitCanvas(); window.addEventListener('resize', () => { const d = Math.min(2, window.devicePixelRatio || 1); if (d !== DPR) fitCanvas(); });
const F_HUD = s => `${s}px "Jersey 10", "Courier New", monospace`;
const F_DSP = s => `${s}px "Pirata One", Georgia, serif`;
const F_TXT = (s, w = 700) => `${w} ${s}px "Alegreya Sans", system-ui, sans-serif`;
const COL = { bone: '#ede4cd', dim: '#a8b4ac', faint: '#72817a', torch: '#ffb547', mana: '#a88cff', panel: 'rgba(12,18,16,.84)', line: '#2f4038', grass: '#1f4a2b', grass2: '#245433', dirt: '#7a4e2c', chalk: '#efe6cf' };
function txt(c, s, x, y, font, col, align = 'left', base = 'alphabetic') { c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function panel(c, x, y, w, h) { rr(c, x, y, w, h, 6); c.fillStyle = COL.panel; c.fill(); c.strokeStyle = COL.line; c.lineWidth = 1; c.stroke(); }

/* ---------- creatures: inked, cel-shaded figures ---------- */
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
    const f = d.o.fly ? Math.sin(G.time * 18) * 12 : Math.sin(G.time * 2) * 2, col = d.C('#6b567c'), col2 = d.C('#8b76a0');
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
    const k = d.o.run ? Math.sin(d.o.run) * 6 : Math.sin(G.time * 3) * 1.5;
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
  if (tattered) { for (let i = 0; i <= 8; i++) { const x = -d.shw - 7 + i * (2 * d.shw + 14) / 8; p.lineTo(x, i % 2 ? -10 - Math.sin(G.time * 4 + i) * 2 : -1); } }
  else p.lineTo(d.shw + 7, -4);
  p.lineTo(d.shw - 2, d.shY); p.closePath();
  ink(c, p, col);
  if (!tattered) { c.fillStyle = d.C('#d8b64a'); c.fillRect(-d.shw - 6, -8, 2 * d.shw + 12, 2.4); }
}
function snake(c, d, a, len, i) {
  const wv = Math.sin(G.time * 5 + i * 1.7) * 4, x0 = Math.cos(a) * 10, y0 = d.hy + Math.sin(a) * 10;
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
    for (let i = -3; i <= 3; i++) inkLine(c, [[i * 3, hy - 10], [i * 6 + Math.sin(G.time * 2 + i) * 1.5, hy - 22 - Math.abs(i)]], C('#3f5a2a'), 1.8);
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
    if (!d.st && FSC > .4) for (let i = 0; i < 3; i++) { c.globalAlpha *= .5; circ(c, Math.sin(G.time * 2 + i * 2) * 8, hy - 26 - ((G.time * 10 + i * 6) % 18), 1.6, '#9ff6ff'); c.globalAlpha *= 2; }
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
    if (!d.st && FSC > .4) for (let i = 0; i < 3; i++) { const a = G.time * 1.5 + i * 2.1; txt(c, '✦', Math.cos(a) * 20, hy - 18 + Math.sin(a) * 6, '6px sans-serif', 'rgba(200,240,255,.8)', 'center'); }
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
    if (B.feathers && det) for (let i = 0; i < 4; i++) { const p = lerpP(el, H, .1 + i * .22); ink(c, pEl(p.x + out * aw * .55, p.y + 2, 1.8, 5, out * .5), d.C(i % 2 ? '#6b4f86' : '#8b76a0'), 0, true); }
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
  if (opt.ember && !d.st) { c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = Math.max(2, 8 * FSC); circ(c, 0, 4, 2.2 + Math.sin(G.time * 20) * .5, '#ffcf5a'); c.restore(); }
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
  const s = Math.sin(G.time * 3 + (d.o.run || 0)) * 4, x = d.shw;
  const p = new Path2D(); p.moveTo(4, -42); p.bezierCurveTo(x + 6, -46, x + 22 + s, -34, x + 18 + s, -10); p.bezierCurveTo(x + 14 + s, -18, x + 8, -30, 2, -34); p.closePath();
  ink(c, p, d.C('#5d4a3a')); if (FSC > .45) ink(c, pEl(x + 17 + s, -13, 3.5, 5), d.C('#d8cbb4'), 0, true);
};
BACK.minotaur = (c, d) => {
  const s = Math.sin(G.time * 2.4 + (d.o.run || 0)) * 5, x = d.shw;
  const tl = [[4, -40], [x + 6, -38], [x + 13 + s, -30], [x + 15 + s * 1.3, -22]];
  inkLine(c, tl, INK, 2.6); inkLine(c, tl, d.skin, 1.4);
  ink(c, pEl(x + 15 + s * 1.3, -19, 2.8, 4.6, s * .05), d.C('#2a1a10'));
};
BACK.kobold = (c, d) => {
  const s = Math.sin(G.time * 3.4 + (d.o.run || 0)) * 4, x = d.shw;
  tailChain(c, [[2, -38, 5], [x + 6, -26, 4], [x + 16 + s, -10, 2.4], [x + 24 + s * 1.4, -12, .8]], d.skin);
  if (!d.st && FSC > .3) { c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = 8 * FSC; const f = Math.sin(G.time * 18) * .8; ink(c, pPoly([[x + 21 + s * 1.4, -13], [x + 27 + s * 1.4, -13], [x + 24 + s * 1.4 + f, -21]]), '#ffb03a', 0, true); c.restore(); }
};
BACK.elf = (c, d) => {
  const fl = Math.sin(G.time * 2.2 + (d.o.run || 0)) * (d.o.run ? 5 : 1.5), col = d.C(d.B.cloak);
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
  const wpn = o.wpn, grip = pose && pose.grip ? pose.grip : { x: shw - 2, y: -50 }, wang = pose && pose.grip ? pose.wang : (o.wang || 0);
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
  } else if (wpn) {
    arm(c, -shw + 3, shY + 3, grip.x - 6, grip.y + 3, d, { noHand: true });
    arm(c, shw - 3, shY + 3, grip.x + 1, grip.y + 1, d, { noHand: true });
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
  if (wpn) {
    if (pose && pose.ghosts && pose.ghosts.length && !st) {
      const g0 = pose.ghosts[pose.ghosts.length - 1][0];
      c.save(); c.lineCap = 'round';
      const a0 = Math.min(g0, wang), a1 = Math.max(g0, wang);
      for (const [rad, al, lw2] of [[74, .22, 16], [60, .14, 10], [44, .1, 6]]) { c.strokeStyle = `rgba(255,246,220,${al})`; c.lineWidth = lw2; c.beginPath(); c.arc(grip.x, grip.y, rad, a0, a1); c.stroke(); }
      c.restore();
      pose.ghosts.forEach(([ga, gl], i) => { c.save(); c.globalAlpha *= .28 * (1 - i / pose.ghosts.length); WSCALE = gl; drawWeaponRaw(c, wpn, grip.x, grip.y, ga, st); WSCALE = 1; c.restore(); });
    }
    WSCALE = pose && pose.wlen ? pose.wlen : 1; drawWeapon(c, wpn, grip.x, grip.y, wang, st); WSCALE = 1;
    ink(c, pEl(grip.x - 5, grip.y + 2.5, 4.4, 4.2), d.armC, 0, true);
    ink(c, pEl(grip.x + 1.5, grip.y + .5, 4.4, 4.2), d.armC, 0, true);
    if ((B.clawHand || B.fur) && det) for (const gx of [grip.x - 7, grip.x - 1]) ink(c, pPoly([[gx, grip.y + 4], [gx + 2, grip.y + 4], [gx + 1.4, grip.y + 7.5]]), d.C('#efe6cf'), 0, true);
  }
  c.restore();
  c.restore();
}

function headY(kind) { const K = KIND[kind] || KIND.goblin; return kind === 'ogre' || kind === 'golem' ? -80 : -83 + (K.hunch ? 8.4 : 0); }
// head-and-shoulders portrait in a framed card
function drawPortrait(c, p, team, x, y, size) {
  const K = KIND[p.kind] || KIND.goblin;
  c.save(); rr(c, x, y, size, size, size * .12); c.clip();
  const g = c.createRadialGradient(x + size * .45, y + size * .35, 2, x + size / 2, y + size / 2, size * .8);
  g.addColorStop(0, tint(team.color, -.25)); g.addColorStop(1, '#07090a'); c.fillStyle = g; c.fillRect(x, y, size, size);
  c.globalAlpha = .12; c.fillStyle = team.light || '#fff'; for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(x + i * size * .2, y + size); c.lineTo(x + i * size * .2 + size * .1, y + size); c.lineTo(x + i * size * .2 + size * .6, y); c.lineTo(x + i * size * .2 + size * .5, y); c.fill(); } c.globalAlpha = 1;
  const tall = { witch: [.62, .22], minotaur: [.56, .24], werewolf: [.54, .26], troll: [.52, .27], skeleton: [.52, .27], spider: [.52, .27], lich: [.52, .28], kobold: [.5, .28], dwarf: [.44, .28], harpy: [.5, .26], goblin: [.48, .27] }[p.kind] || [.46, .3];
  const u = size * tall[1] / 13, hpx = u * 100 / K.h;
  drawFig(c, p.kind, x + size / 2, y + size * tall[0] - headY(p.kind) * u, hpx, team, { num: p.num, noShadow: true });
  c.restore();
  c.save(); rr(c, x, y, size, size, size * .12); c.lineWidth = Math.max(1.5, size * .03); c.strokeStyle = team.color; c.stroke(); c.restore();
}

function tri(c, a, b, d, col) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fillStyle = col; c.fill(); }
function circ(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
function ell(c, x, y, rx, ry, col) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
function drawWeapon(c, k, x, y, a, stone) {
  // ink outline: draw the silhouette in black slightly offset, then the weapon itself
  if ('filter' in c) { c.save(); c.filter = 'brightness(0)'; const o = LW * .7; for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) drawWeaponRaw(c, k, x + dx, y + dy, a, stone); c.restore(); }
  drawWeaponRaw(c, k, x, y, a, stone);
}
let WSCALE = 1;
function drawWeaponRaw(c, k, x, y, a, stone) {
  c.save(); c.translate(x, y); c.rotate(a); if (WSCALE !== 1) c.scale(WSCALE, 1);
  const wood = stone ? '#888' : '#8a5a33', steel = stone ? '#999' : '#c9d0d6';
  const L = 70;
  c.fillStyle = wood;
  switch (k) {
    case 'axe': c.fillRect(-2, -3, L, 6); c.fillStyle = steel; c.beginPath(); c.moveTo(L - 16, -3); c.quadraticCurveTo(L - 8, -30, L + 6, -26); c.lineTo(L - 4, -3); c.moveTo(L - 16, 3); c.quadraticCurveTo(L - 8, 30, L + 6, 26); c.lineTo(L - 4, 3); c.fill(); break;
    case 'log': rr(c, -4, -8, L + 6, 16, 6); c.fill(); c.fillStyle = '#5c3a1f'; c.fillRect(L - 26, -12, 6, 5); break;
    case 'tree': c.beginPath(); c.moveTo(0, -5); c.lineTo(L, -10); c.lineTo(L, 10); c.lineTo(0, 5); c.fill(); circ(c, L + 6, 0, 16, stone ? '#888' : '#2f5a2a'); circ(c, L - 6, -10, 10, stone ? '#888' : '#3a6b30'); break;
    case 'hammer': c.fillRect(-2, -3, L, 6); c.fillStyle = steel; c.fillRect(L - 12, -16, 22, 32); break;
    case 'pillar': c.fillStyle = stone ? '#888' : '#a8a79e'; c.fillRect(-2, -9, L + 8, 18); c.fillStyle = '#7a7a72'; c.fillRect(L, -12, 10, 24); c.fillRect(-4, -12, 8, 24); break;
    case 'scythe': c.fillRect(-2, -2.5, L + 6, 5); c.fillStyle = steel; c.beginPath(); c.moveTo(L + 4, 0); c.quadraticCurveTo(L - 6, -40, L - 40, -36); c.quadraticCurveTo(L - 10, -30, L - 2, 0); c.fill(); break;
    case 'staff': c.fillRect(-2, -2.5, L + 6, 5); circ(c, L + 8, 0, 8, stone ? '#999' : '#9d7bff'); circ(c, L + 8, 0, 4, '#e7dcff'); break;
    case 'tomb': c.fillRect(-2, -3, 30, 6); c.fillStyle = stone ? '#999' : '#8e9290'; rr(c, 26, -14, L - 18, 28, 12); c.fill(); c.fillStyle = '#5f6361'; c.fillRect(40, -2, 22, 3); c.fillRect(50, -8, 3, 16); break;
    case 'bone': c.fillStyle = stone ? '#999' : '#efe6cf'; c.fillRect(0, -4, L, 8); circ(c, 0, -5, 6, c.fillStyle); circ(c, 0, 5, 6, c.fillStyle); circ(c, L, -6, 8, c.fillStyle); circ(c, L, 6, 8, c.fillStyle); break;
    case 'broom': c.fillRect(-2, -2.5, L - 10, 5); c.fillStyle = stone ? '#999' : '#c8a24a'; c.beginPath(); c.moveTo(L - 14, -4); c.lineTo(L + 14, -14); c.lineTo(L + 14, 14); c.lineTo(L - 14, 4); c.fill(); break;
    case 'cane': c.fillStyle = stone ? '#999' : '#1a1418'; c.fillRect(-2, -3, L, 6); circ(c, L, 0, 6, stone ? '#999' : '#d8b64a'); break;
    case 'spiked': c.beginPath(); c.moveTo(0, -3); c.lineTo(L, -7); c.lineTo(L, 7); c.lineTo(0, 3); c.fill(); c.fillStyle = steel; for (let i = 0; i < 4; i++) { tri(c, [L - 30 + i * 9, -6], [L - 26 + i * 9, -14], [L - 22 + i * 9, -6], steel); tri(c, [L - 30 + i * 9, 6], [L - 26 + i * 9, 14], [L - 22 + i * 9, 6], steel); } break;
    default: c.beginPath(); c.moveTo(0, -2.5); c.lineTo(L, -6); c.quadraticCurveTo(L + 6, 0, L, 6); c.lineTo(0, 2.5); c.fill();
  }
  c.restore();
}


/* ---------- motion: keyframed poses for the delivery and the swing ---------- */
function kf(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], u = (t - a[0]) / (b[0] - a[0]), e = u * u * (3 - 2 * u);
    return a.slice(1).map((v, j) => v + (b[j + 1] - v) * e);
  }
  return keys[keys.length - 1].slice(1);
}
// T runs 0 → 1 through the windup (release at 1) and 1 → 2 through the follow-through
function pitcherPose(w, T) {
  const S = 17 * w;
  const hand = t => kf([[0, 4, -50], [.28, 3, -64], [.5, S + 12, -40], [.72, S + 17, -70], [.9, S + 9, -94], [1, S - 3, -87], [1.22, 4, -48], [1.55, -S + 2, -30], [2, 4, -50]], t);
  const R = hand(T);
  const Lh = kf([[0, 0, -50], [.28, -1, -62], [.5, -S - 14, -60], [.8, -S - 13, -64], [1, -S + 2, -47], [1.55, -S - 4, -40], [2, 0, -50]], T);
  const [lean] = kf([[0, 0], [.3, -.04], [.75, .1], [1, -.12], [1.35, -.24], [2, 0]], T);
  const [liftL, aL] = kf([[0, 0, 0], [.1, 0, 0], [.33, 1, -.05], [.47, .9, .06], [.72, 0, .32], [1.5, 0, .3], [2, 0, 0]], T);
  const [liftR, aR] = kf([[0, 0, 0], [1, 0, 0], [1.3, .75, -.42], [1.6, .5, -.22], [2, 0, 0]], T);
  const [drop, sc] = kf([[0, 0, 1], [.33, -3, 1], [.72, 2, 1], [1, 4, 1.05], [1.4, 5, 1.06], [2, 0, 1]], T);
  const trailR = T > .84 && T < 1.35 ? [0, 1, 2, 3, 4, 5].map(i => hand(T - i * .028)) : null;
  return { lean, armR: { x: R[0], y: R[1] }, armL: { x: Lh[0], y: Lh[1] }, legL: { a: aL, lift: liftL }, legR: { a: aR, lift: liftR }, drop, scale: sc, ball: T < 1, trailR };
}
// swing angle over time since the button press: accelerate into contact (~0.09 s), then wrap through
const swingAng = s => s < 0 ? -2.6 : s < .09 ? lerp(-2.6, .15, Math.pow(s / .09, 2.2)) : s < .36 ? lerp(.15, 4, 1 - Math.pow(1 - (s - .09) / .27, 2.2)) : 4;
// the bat swings around the body, so it shortens as it points toward or away from us
const swingLen = s => s < 0 ? 1 : s < .09 ? 1 - .5 * Math.sin(Math.PI * Math.pow(s / .09, 2.2)) : s < .36 ? 1 - .45 * Math.sin(Math.PI * (1 - Math.pow(1 - (s - .09) / .27, 2.2))) : 1;
function batterPose(w, P, bunt) {
  const S = 17 * w;
  let load = 0, step = 0;
  if (P.stage === 'windup') { const k = P.t / .75; load = clamp((k - .3) / .6, 0, 1); step = clamp((k - .55) / .45, 0, 1); }
  else if ((P.stage === 'flight' || P.stage === 'hit' || P.stage === 'result') && P.pitch) { load = 1; step = P.stage === 'flight' ? clamp(1 - pitchProg(P.pitch, P.t) * 2.2, 0, 1) : 0; }
  const breathe = Math.sin(G.time * 2.4) * .8;
  const pose = { lean: 0, shift: -3 * load, drop: breathe * (1 - load), legL: { a: .07, lift: 0 }, legR: { a: -.07 - .1 * (1 - step) * load, lift: .45 * Math.sin(step * Math.PI) }, ghosts: [] };
  if (bunt) {
    const s = P.swingAnim, k = s >= 0 ? Math.min(1, s / .08) : 0;
    pose.grip = { x: S + 2 + 5 * k, y: -56 + 2 * k }; pose.wang = -.05 + .12 * k; pose.lean = .06 * k; return pose;
  }
  const wag = Math.sin(G.time * 3.1) * .12 * (1 - load);
  pose.grip = { x: lerp(S - 5, S - 12, load), y: lerp(-60, -65, load) + breathe * (1 - load) };
  pose.wang = lerp(-2.25, -2.6, load) + wag;
  const s = P.swingAnim;
  if (s >= 0) {
    pose.wang = swingAng(s); pose.wlen = swingLen(s);
    const g = kf([[0, S - 12, -65], [.05, S - 8, -60], [.09, S + 6, -50], [.2, S + 4, -58], [.36, S - 2, -72], [.8, S - 4, -70]], s);
    pose.grip = { x: g[0], y: g[1] };
    pose.lean = kf([[0, 0], [.05, .06], [.1, .14], [.34, .1], [.8, .06]], s)[0];
    pose.shift = kf([[0, -3], [.08, 3], [.34, 4]], s)[0];
    pose.legL = { a: kf([[0, .07], [.1, -.15], [.34, -.22]], s)[0], lift: kf([[0, 0], [.1, .18], [.34, .24]], s)[0] };
    pose.legR = { a: -.14, lift: 0 };
    if (s > .02 && s < .28) for (let i = 1; i <= 5; i++) pose.ghosts.push([swingAng(s - i * .012), swingLen(s - i * .012)]);
  }
  return pose;
}
/* ---------- plate view (behind the catcher) ---------- */
const PXF = 84, HC = 5.3, HY = 165, CAM = 28; // telephoto camera behind the plate: the pitch travels smoothly down the screen
function proj(x, d, h) { const k = CAM / (Math.max(d, -9) + CAM); return { x: 480 + x * PXF * k, y: HY - (h - HC) * PXF * k, k }; }
const GY = HY + HC * PXF * CAM / (400 + CAM); // screen y of the outfield wall
const STARS = Array.from({ length: 90 }, () => [R() * W, R() * (GY - 100), R() * 1.4 + .3, R()]);
const CROWD = []; for (let row = 0; row < 4; row++) for (let i = 0; i < 70; i++) CROWD.push([i * 14 + (row % 2) * 7 + R() * 4, GY - 80 + row * 15 + R() * 3, 5 + R() * 2, R() < .22, R() < .5 ? '#ffcf3a' : R() < .5 ? '#ff4a3a' : '#7ff0ff']);
let bgPlate = null, bgField = null;
function mkLayer() { const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const x = c.getContext('2d'); x.scale(2, 2); return [c, x]; }
function buildPlateBg() {
  const [cvs, c] = mkLayer();
  let g = c.createLinearGradient(0, 0, 0, GY + 5); g.addColorStop(0, '#04060b'); g.addColorStop(1, '#122530'); c.fillStyle = g; c.fillRect(0, 0, W, GY + 5);
  for (const [x, y, r] of STARS) circ(c, x, y, r * .8, 'rgba(236,228,205,.7)');
  // blood moon
  g = c.createRadialGradient(640, 64, 10, 640, 64, 80); g.addColorStop(0, 'rgba(255,150,90,.35)'); g.addColorStop(1, 'rgba(255,150,90,0)'); c.fillStyle = g; c.fillRect(540, 0, 200, 150);
  circ(c, 640, 64, 24, '#f0b58a'); circ(c, 632, 58, 5, 'rgba(160,80,50,.35)'); circ(c, 648, 72, 3.5, 'rgba(160,80,50,.35)');
  // stands
  c.fillStyle = '#080b0e'; c.fillRect(0, GY - 92, W, 92);
  for (const [x, y, r, eyes, ec] of CROWD) { circ(c, x, y, r, '#121820'); circ(c, x, y + r + 3, r * 1.3, '#0e131a'); if (eyes) { circ(c, x - 2, y, .9, ec); circ(c, x + 2, y, .9, ec); } }
  // wall
  c.fillStyle = '#23170e'; c.fillRect(0, GY - 8, W, 8); c.fillStyle = '#3b2a1c'; c.fillRect(0, GY - 9, W, 2);
  // grass
  g = c.createLinearGradient(0, GY, 0, 600); g.addColorStop(0, '#16361f'); g.addColorStop(1, '#2a5d35'); c.fillStyle = g; c.fillRect(0, GY, W, H - GY);
  for (let d = 400, i = 0; d > 0; d -= 26, i++) { if (i % 2) continue; const a = proj(-600, d, 0), b = proj(-600, d - 26, 0); c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(0, a.y, W, b.y - a.y); }
  // infield dirt arc
  c.fillStyle = COL.dirt; c.beginPath();
  for (let a = -180; a <= 0; a += 4) { const x = 95 * Math.cos(a * DEG), y = 60.5 - 95 * Math.sin(a * DEG); const p = proj(x, y, 0); a === -180 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); }
  let p1 = proj(95, 60.5, 0), p2 = proj(-95, 60.5, 0); c.lineTo(p1.x + 900, 640); c.lineTo(p2.x - 900, 640); c.closePath(); c.fill();
  // infield grass diamond
  c.fillStyle = '#285a33'; c.beginPath(); [[0, 16], [50, 63.6], [0, 113], [-50, 63.6]].forEach(([x, y], i) => { const p = proj(x, y, 0); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.closePath(); c.fill();
  // mound
  c.fillStyle = '#86583a'; c.beginPath(); for (let a = 0; a <= 360; a += 10) { const p = proj(9 * Math.cos(a * DEG), 60.5 + 9 * Math.sin(a * DEG), 0); a ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.fill();
  let rb = proj(-1, 60.5, 0), rb2 = proj(1, 60.5, 0); c.fillStyle = COL.chalk; c.fillRect(rb.x, rb.y - 1, rb2.x - rb.x, 2);
  // home dirt
  c.fillStyle = COL.dirt; c.beginPath(); for (let a = 0; a <= 360; a += 8) { const p = proj(13 * Math.cos(a * DEG), 1 + 13 * Math.sin(a * DEG), 0); a ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.fill();
  // foul lines & bases
  c.strokeStyle = COL.chalk; c.lineWidth = 2; for (const s of [-1, 1]) { const a = proj(s * 3, 3, 0), b = proj(s * 330, 330, 0); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  for (const b of [BASE[1], BASE[2], BASE[3]]) { c.fillStyle = COL.chalk; c.beginPath(); [[0, -1.3], [1.3, 0], [0, 1.3], [-1.3, 0]].forEach(([dx, dy], i) => { const p = proj(b.x + dx, b.y + dy, 0); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.fill(); }
  // batter's boxes
  c.strokeStyle = 'rgba(239,230,207,.55)'; c.lineWidth = 2; for (const s of [-1, 1]) { const q = [[s * 1.2, -2.5], [s * 5.2, -2.5], [s * 5.2, 3.5], [s * 1.2, 3.5]].map(([x, y]) => proj(x, y, 0)); c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.stroke(); }
  bgPlate = cvs;
}
function torches(c, pts) {
  for (const [x, y, s] of pts) {
    const f = .8 + Math.sin(G.time * 11 + x) * .1 + Math.sin(G.time * 23 + y) * .08;
    const g = c.createRadialGradient(x, y, 1, x, y, 26 * s * f); g.addColorStop(0, 'rgba(255,190,90,.55)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(x - 30 * s, y - 30 * s, 60 * s, 60 * s);
    circ(c, x, y, 2.6 * s * f, '#ffd98a');
  }
}
const PLATE_TORCHES = [60, 190, 330, 630, 770, 900].map(x => [x, GY - 12, 1]);

function drawPlate(c) {
  c.drawImage(bgPlate, 0, 0, W, H);
  torches(c, PLATE_TORCHES);
  if (!G.teams) return;
  drawZonesPlate(c);
  if (typeof drawSky === 'function' && MOON) drawSky(c);
  const P = G.P, ft = FT(), bt = BT(), pt = pitcher(), bat = batter();
  // background fielders
  const fs = ft.def.roster.filter(p => p.pos !== 'C' && p.pos !== 'P').map(p => ({ p, ...POSN[p.pos] })).sort((a, b) => b.y - a.y);
  for (const f of fs) { const q = proj(f.x, f.y, 0); drawFig(c, f.p.kind, q.x, q.y, 6.4 * PXF * q.k, ft.def, { num: f.p.num, mitt: true }); }
  // runners on base, visible in the distance
  drawPlateRunners(c, bt);
  // pitcher
  const q = proj(0, 60.5, .8);
  const pw = (KIND[pt.kind] || KIND.goblin).w;
  let T = 0;
  if (P && P.stage === 'windup') T = clamp(P.t / .75, 0, 1);
  else if (P && P.rel != null && P.rel < .95) T = 1 + clamp(P.rel / .95, 0, 1);
  const ppose = pitcherPose(pw, T);
  const pe = P && (P.stage === 'select' || P.stage === 'windup') ? (P.peff || 0) : 0; if (pe > .05) { ppose.shift = (ppose.shift || 0) + (R() - .5) * 2 * pe; }
  if (T === 0) ppose.drop += Math.sin(G.time * 2.2) * .8;
  // right-handers face us, so the throwing arm shows on the left of the screen
  drawFig(c, pt.kind, q.x, q.y, 6.4 * PXF * q.k, ft.def, { num: pt.num, pose: ppose, flip: pt.hand === 'R', mitt: true });
  if (!P) return;
  const pc = P.pitch;
  const ballNow = pc && P.stage !== 'select' && P.stage !== 'windup' && P.stage !== 'steal' ? pitchPos(pc, pitchProg(pc, P.t)) : null;
  if (ballNow && ballNow.d > 18 && !P.bb) drawPitchBall(c, pc, P);
  // batter
  const hs = bat.hand === 'R' ? 1 : -1, bx = 480 - hs * 150, by = 612;
  const st0 = P.stances[P.si];
  const bunt = st0.ab === 'bunt', wpn = bunt ? 'bat' : bat.wpn;
  const bpose = batterPose((KIND[bat.kind] || KIND.goblin).w, P, bunt);
  const be = P.swing ? 0 : (P.beff || 0); if (be > .05) { bpose.shift += (R() - .5) * 2.4 * be; bpose.drop += (R() - .5) * 1.6 * be; }
  drawFig(c, bat.kind, bx, by, 300, bt.def, { num: bat.num, wpn, pose: bpose, flip: hs < 0, noShadow: true });
  // strike zone
  const z0 = proj(-.708, 0, 1.6), z1 = proj(.708, 0, 3.4);
  c.strokeStyle = 'rgba(239,230,207,.5)'; c.lineWidth = 1.5; c.setLineDash([6, 5]); c.strokeRect(z0.x, z1.y, z1.x - z0.x, z0.y - z1.y); c.setLineDash([]);
  // pitcher aim (only when the batter isn't a human who shouldn't see it)
  const showAim = (isHuman(ft) && !(G.mode === '2p')) || G.mode === 'demo' || (G.mode === '1p' && isHuman(ft));
  if (showAim && P.stage !== 'hit') {
    const pre = P.stage === 'select' || P.stage === 'windup', a = proj(P.aim.x, 0, P.aim.h), zin = inZone(P.aim.x, P.aim.h);
    const col = zin ? '#8fe38a' : '#ff8a5a';
    c.save(); c.globalAlpha = pre ? 1 : .45;
    if (pre) { // where most pitches (about 86%) will land: 2 standard deviations of scatter
      const pd = P.pitches[P.pi]; let sd = baseCtrl(pd, pt, P.peff || 0); if (P.relGrade) sd *= REL_MULT[P.relGrade]; if (pd.fx === 'hex') sd = Math.hypot(sd, .3);
      const rad = 2 * sd * PXF; c.fillStyle = zin ? 'rgba(143,227,138,.08)' : 'rgba(255,138,90,.08)'; c.beginPath(); c.arc(a.x, a.y, rad, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col; c.globalAlpha = .55; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(a.x, a.y, 9, 0, Math.PI * 2); c.moveTo(a.x - 15, a.y); c.lineTo(a.x + 15, a.y); c.moveTo(a.x, a.y - 15); c.lineTo(a.x, a.y + 15); c.stroke();
    if (pre && isHuman(ft)) txt(c, zin ? 'strike' : 'ball', a.x + 18, a.y - 12, F_HUD(16), col);
    c.restore();
  }
  if (G.mode === '2p' && (P.stage === 'select' || P.stage === 'windup')) txt(c, 'aim hidden', 480, z1.y - 10, F_HUD(18), 'rgba(239,230,207,.5)', 'center');
  // landing marker + timing ring (what a batter can read off the ball)
  const st = P.stances[P.si], sm = swingMods(bat, st.k, st.k === 'ab' ? st.ab : null, st.k === 'phys' ? st.ph : null, P.swing ? 0 : (P.beff || 0));
  let mk = null;
  if (pc && P.stage === 'flight' && !P.swing && (isHuman(bt) || G.mode === 'demo') && !zoneOn('hideMarker')) {
    const p = pitchProg(pc, P.t), hidden = pc.fx === 'phantom' && p > .26 && p < .9;
    if (p > .1 && p < 1.08 && !hidden) {
      const amp = (pc.fx === 'hex' ? .8 : .45) * Math.pow(Math.max(0, 1 - p), 1.3);
      const m = proj(pc.fx0 + Math.sin(p * 7 + pc.mph) * amp, 0, pc.fh0 + Math.cos(p * 5 + pc.mph * 1.7) * amp);
      const inWin = Math.abs(pc.Ta - P.t) <= sm.win; mk = m;
      c.globalAlpha = Math.min(1, (p - .1) * 4);
      c.strokeStyle = inWin ? '#ffd34a' : 'rgba(239,230,207,.8)'; c.lineWidth = inWin ? 3.5 : 2;
      c.beginPath(); c.arc(m.x, m.y, 9 + 78 * Math.max(0, 1 - p), 0, Math.PI * 2); c.stroke();
      circ(c, m.x, m.y, 3, inWin ? '#ffd34a' : 'rgba(239,230,207,.9)');
      c.globalAlpha = 1;
    }
  }
  // eagle eye
  if (pc && pc.ab === 'eagle' && P.stage !== 'result') { const e = proj(pc.fx0, 0, pc.fh0); c.strokeStyle = '#ffd34a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(e.x - 9, e.y - 9); c.lineTo(e.x + 9, e.y + 9); c.moveTo(e.x + 9, e.y - 9); c.lineTo(e.x - 9, e.y + 9); c.stroke(); }
  // swing cursor
  const r = sm.r;
  const pp = proj(P.pci.x, 0, P.pci.h), frost = pc && pc.fx === 'frost' && P.stage === 'flight';
  // reach: is the ball's marker inside the swing circle right now?
  const md = mk ? Math.hypot(mk.x - pp.x, mk.y - pp.y) : 1e9, reach = md <= r * PXF, near = !reach && md <= r * PXF * 1.6;
  if (mk && !reach) { c.save(); c.strokeStyle = near ? 'rgba(255,211,74,.7)' : 'rgba(239,230,207,.35)'; c.lineWidth = 1.5; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(pp.x, pp.y); c.lineTo(mk.x, mk.y); c.stroke(); c.restore(); }
  const ringCol = frost ? '#9fe6ff' : reach ? '#8fe38a' : near ? '#ffd34a' : bt.def.light;
  c.strokeStyle = ringCol; c.lineWidth = reach ? 3.5 : 2.5; c.beginPath(); c.arc(pp.x, pp.y, r * PXF, 0, Math.PI * 2); c.stroke();
  c.fillStyle = frost ? 'rgba(159,230,255,.12)' : reach ? 'rgba(143,227,138,.14)' : 'rgba(255,255,255,.06)'; c.fill();
  circ(c, pp.x, pp.y, 2.5, ringCol);
  // after a swing: where the ball really crossed, against where the bat was
  if (pc && P.swing && (P.stage === 'result' || P.stage === 'hit') && (isHuman(bt) || G.mode === 'demo')) {
    const q = proj(pc.fx0, 0, pc.fh0), inR = P.swingD != null && P.swingD <= (pc.ab === 'bunt' ? P.swingR * 1.7 : P.swingR);
    if (!inR) { c.save(); c.strokeStyle = 'rgba(255,211,74,.8)'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(pp.x, pp.y); c.lineTo(q.x, q.y); c.stroke(); c.restore(); }
    c.strokeStyle = inR ? '#8fe38a' : '#ffd34a'; c.lineWidth = 2; c.beginPath(); c.arc(q.x, q.y, 7, 0, Math.PI * 2); c.stroke(); circ(c, q.x, q.y, 2.5, '#f6f0e0');
  }
  if (ballNow && ballNow.d <= 18 && !P.bb) drawPitchBall(c, pc, P);
  // catcher's mitt pop on takes and misses
  if (P.pop && P.pop.age < .35) { const m = proj(P.pop.x, -1, P.pop.h), k = P.pop.age / .35; c.strokeStyle = `rgba(255,236,190,${.8 * (1 - k)})`; c.lineWidth = 3; c.beginPath(); c.arc(m.x, m.y, 10 + 34 * k, 0, Math.PI * 2); c.stroke(); }
  // contact: flash, then the ball rockets off toward the field
  if (P.bb) drawBattedBall(c, P);
}
function drawBattedBall(c, P) {
  const bb = P.bb, pts = bb.tr.pts, age = bb.age;
  if (age < .16 && P.pitch) {
    const m = proj(P.pitch.fx0, 0, P.pitch.fh0), k = age / .16, rr2 = 18 + 60 * k;
    const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, rr2); g.addColorStop(0, `rgba(255,255,240,${1 - k})`); g.addColorStop(.4, `rgba(255,210,120,${.7 * (1 - k)})`); g.addColorStop(1, 'rgba(255,160,60,0)');
    c.fillStyle = g; c.fillRect(m.x - rr2, m.y - rr2, rr2 * 2, rr2 * 2);
    c.strokeStyle = `rgba(255,250,220,${1 - k})`; c.lineWidth = 3;
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + .3, r0 = 10 + 30 * k, r1 = r0 + 26 * (1 - k); c.beginPath(); c.moveTo(m.x + Math.cos(a) * r0, m.y + Math.sin(a) * r0); c.lineTo(m.x + Math.cos(a) * r1, m.y + Math.sin(a) * r1); c.stroke(); }
  }
  if (age > .75) return;
  const i = Math.min(pts.length - 1, Math.floor(age / TDT));
  const at = j => { const p = pts[clamp(j, 0, pts.length - 1)]; return proj(p.x, Math.max(p.y, .5), p.z); };
  const b = at(i), sh = pts[i], sp = proj(sh.x, Math.max(sh.y, .5), 0), rad = Math.max(1.5, .13 * PXF * b.k * 1.5);
  ell(c, sp.x, sp.y, rad * 1.1, rad * .35, 'rgba(0,0,0,.3)');
  c.lineCap = 'round';
  for (let j = 1; j <= 6; j++) { const a = at(i - j * 2), bq = at(i - (j - 1) * 2); c.strokeStyle = `rgba(255,250,235,${.4 * (1 - j / 7)})`; c.lineWidth = rad * 1.6 * (1 - j / 8); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(bq.x, bq.y); c.stroke(); }
  circ(c, b.x, b.y, rad, '#f6f0e0');
}
function drawPitchBall(c, pc, P) {
  const p = pitchProg(pc, P.t);
  if (p > 1.25) return;
  let alpha = 1;
  if (pc.fx === 'phantom' && p > .26 && p < .9) alpha = .05;
  const at = pitchPos(pc, p), q = proj(at.x, at.d, at.h), rad = Math.max(1.8, .13 * PXF * q.k * 1.5);
  // shadow
  const sh = proj(at.x, at.d, 0); ell(c, sh.x, sh.y, rad * 1.1, rad * .35, 'rgba(0,0,0,.35)');
  c.save(); c.globalAlpha = alpha;
  if (pc.fx === 'fire' || pc.fx === 'meteor' || pc.fx === 'frost' || pc.fx === 'hex') {
    for (let i = 7; i >= 1; i--) {
      const pb = p - i * (pc.fx === 'meteor' ? .045 : .03); if (pb < 0) continue;
      const a = pitchPos(pc, pb), t = proj(a.x, a.d, a.h), rr2 = Math.max(1.5, .13 * PXF * t.k * 1.5) * (1 - i * .08);
      const col = pc.fx === 'frost' ? `rgba(159,230,255,${.35 - i * .04})` : pc.fx === 'hex' ? `rgba(180,120,255,${.4 - i * .045})` : `rgba(255,${120 + i * 12},40,${.55 - i * .06})`;
      circ(c, t.x, t.y, rr2 * (pc.fx === 'meteor' ? 1.8 : 1.3), col);
    }
    const glow = pc.fx === 'frost' ? 'rgba(159,230,255,.55)' : pc.fx === 'hex' ? 'rgba(180,120,255,.5)' : 'rgba(255,150,50,.6)';
    const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad * 3.2); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(q.x - rad * 4, q.y - rad * 4, rad * 8, rad * 8);
  }
  const bc = pc.fx === 'fire' ? '#ffe2a0' : pc.fx === 'meteor' ? '#6b4a3a' : pc.fx === 'frost' ? '#e8fbff' : pc.fx === 'hex' ? '#e6d4ff' : '#f6f0e0';
  circ(c, q.x, q.y, rad * (pc.fx === 'meteor' ? 1.5 : 1), bc);
  if (!pc.fx) { c.strokeStyle = '#c83a2a'; c.lineWidth = Math.max(.6, rad * .15); c.beginPath(); c.arc(q.x - rad * .5, q.y, rad * .7, -1, 1); c.stroke(); c.beginPath(); c.arc(q.x + rad * .5, q.y, rad * .7, Math.PI - 1, Math.PI + 1); c.stroke(); }
  c.restore();
}

/* ---------- field view (overhead) ---------- */
const FS = 1.3, FOX = 480, FOY = 574;
const fp = (x, y, z = 0) => ({ x: FOX + x * FS, y: FOY - y * FS - z * FS * .9 });
const FIELD_TORCHES = []; for (let a = -45; a <= 45; a += 11.25) { const r = fenceR(a * DEG) + 9; const p = fp(r * Math.sin(a * DEG), r * Math.cos(a * DEG)); FIELD_TORCHES.push([p.x, p.y, .8]); }
function buildFieldBg() {
  const [cvs, c] = mkLayer();
  c.fillStyle = '#080b0e'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) { const x = R() * W, y = R() * H; circ(c, x, y, 2.4 + R() * 1.5, '#10161c'); if (R() < .12) { const ec = R() < .5 ? '#ffcf3a' : '#ff5a4a'; circ(c, x - 1.3, y, .7, ec); circ(c, x + 1.3, y, .7, ec); } }
  // foul territory
  c.fillStyle = '#163a21'; c.beginPath();
  const fz = []; for (let a = -62; a <= 62; a += 2) { const aa = clamp(a, -45, 45) * DEG, r = fenceR(aa) + 4; fz.push(fp(r * Math.sin(a * DEG), r * Math.cos(a * DEG))); }
  const b1 = fp(-40, -30), b2 = fp(40, -30); c.moveTo(b1.x, b1.y); fz.forEach(p => c.lineTo(p.x, p.y)); c.lineTo(b2.x, b2.y); c.closePath(); c.fill();
  // fair fan
  const fan = new Path2D(); let h = fp(0, 0); fan.moveTo(h.x, h.y); for (let a = -45; a <= 45; a += 1) { const r = fenceR(a * DEG), p = fp(r * Math.sin(a * DEG), r * Math.cos(a * DEG)); fan.lineTo(p.x, p.y); } fan.closePath();
  c.fillStyle = COL.grass; c.fill(fan);
  c.save(); c.clip(fan); c.translate(FOX, FOY); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(255,255,255,.04)'; for (let i = -40; i < 40; i += 2) c.fillRect(i * 16, -900, 16, 1800); c.restore();
  // warning track
  c.save(); c.clip(fan); c.strokeStyle = '#5e4028'; c.lineWidth = 12 * FS; c.beginPath(); for (let a = -46; a <= 46; a += 1) { const r = fenceR(clamp(a, -45, 45) * DEG) - 6, p = fp(r * Math.sin(a * DEG), r * Math.cos(a * DEG)); a === -46 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); } c.stroke(); c.restore();
  // fence
  c.strokeStyle = '#3b2a1c'; c.lineWidth = 5; c.beginPath(); for (let a = -45; a <= 45; a += 1) { const r = fenceR(a * DEG), p = fp(r * Math.sin(a * DEG), r * Math.cos(a * DEG)); a === -45 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); } c.stroke();
  c.strokeStyle = '#6b4f33'; c.lineWidth = 1.5; c.stroke();
  // infield dirt
  c.save(); c.clip(fan); const m = fp(0, 60.5); c.fillStyle = COL.dirt; c.beginPath(); c.arc(m.x, m.y, 95 * FS, 0, Math.PI * 2); c.fill(); c.restore();
  c.fillStyle = COL.dirt; h = fp(0, 0); c.beginPath(); c.arc(h.x, h.y, 13 * FS, 0, Math.PI * 2); c.fill();
  c.fillStyle = COL.grass2; c.beginPath(); [[0, 15], [49, 63.6], [0, 112], [-49, 63.6]].forEach(([x, y], i) => { const p = fp(x, y); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.closePath(); c.fill();
  c.fillStyle = '#86583a'; c.beginPath(); c.arc(m.x, m.y, 9 * FS, 0, Math.PI * 2); c.fill(); c.fillStyle = COL.chalk; c.fillRect(m.x - 2.5, m.y - .8, 5, 1.6);
  // foul lines
  c.strokeStyle = COL.chalk; c.lineWidth = 1.6; for (const s of [-1, 1]) { const r = fenceR(45 * DEG), e = fp(s * r * Math.sin(45 * DEG), r * Math.cos(45 * DEG)); c.beginPath(); c.moveTo(h.x, h.y); c.lineTo(e.x, e.y); c.stroke(); }
  // bases
  for (let b = 1; b <= 3; b++) { const p = fp(BASE[b].x, BASE[b].y); c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 4); c.fillStyle = COL.chalk; c.fillRect(-3.2, -3.2, 6.4, 6.4); c.restore(); }
  c.fillStyle = COL.chalk; c.beginPath(); c.moveTo(h.x - 3.5, h.y - 2); c.lineTo(h.x + 3.5, h.y - 2); c.lineTo(h.x + 3.5, h.y + 1); c.lineTo(h.x, h.y + 4); c.lineTo(h.x - 3.5, h.y + 1); c.fill();
  bgField = cvs;
}
function drawField(c) {
  c.drawImage(bgField, 0, 0, W, H);
  torches(c, FIELD_TORCHES);
  drawZonesField(c);
  const L = PL; if (!L) return;
  const ft = FT(), bt = BT();
  const ents = [];
  for (const f of L.fielders) ents.push({ y: f.y, draw: () => drawFielder(c, f, ft) });
  const list = alive().sort((a, b) => b.s - a.s);
  for (const r of L.runners) if (!r.out && !r.scored) { const p = runnerPos(r); ents.push({ y: p.y, draw: () => drawRunner(c, r, p, bt, list.indexOf(r) === L.sel && isHuman(bt)) }); }
  ents.sort((a, b) => b.y - a.y).forEach(e => e.draw());
  // selected fielder spell indicator
  if (isHuman(ft) && L.fabs && L.fabs.length) {
    const o = L.fabs[L.selF]; if (o && o.f) {
      const p = fp(o.f.x, o.f.y); c.strokeStyle = o.ok ? 'rgba(168,140,255,.9)' : 'rgba(168,140,255,.35)'; c.lineWidth = 2; c.setLineDash([4, 4]);
      const rng = { devour: 17, mesmer: 120, web: 140, petrify: 330 }[o.ab]; if (rng) { c.beginPath(); c.arc(p.x, p.y, rng * FS, 0, Math.PI * 2); c.stroke(); }
      c.setLineDash([]);
      if (o.ok && o.target) { const t = fp(...Object.values(runnerPos(o.target))); c.beginPath(); c.moveTo(p.x, p.y - 12); c.lineTo(t.x, t.y - 12); c.stroke(); }
    }
  }
  // ball
  const b = L.ball;
  if (b.st !== 'gone' && b.st !== 'held') {
    const g = fp(b.x, b.y), a = fp(b.x, b.y, b.z);
    ell(c, g.x, g.y, 3 + b.z * .04, 1.6 + b.z * .02, 'rgba(0,0,0,.45)');
    circ(c, a.x, a.y, 3.2 + Math.min(4, b.z * .05), '#f6f0e0');
    if (b.st === 'batted' && !trAt(b.bt).b) { const land = L.chaseSample; }
  }
  // fx in field space
  drawFieldFx(c);
}
function drawFielder(c, f, ft) {
  const L = PL, p = fp(f.x, f.y), mv = hyp(f.x - (f.px ?? f.x), f.y - (f.py ?? f.y)) > .05; f.px = f.x; f.py = f.y;
  if (f === L.chaser && (L.ball.st === 'batted' || L.ball.st === 'loose')) { c.strokeStyle = 'rgba(255,181,71,.8)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(p.x, p.y, 12, 5, 0, 0, Math.PI * 2); c.stroke(); }
  if (f.eff > .05) effortAura(c, p.x, p.y, f.eff);
  drawFig(c, f.p.kind, p.x, p.y, 38, ft.def, { num: f.p.num, run: mv ? G.time * (16 + 10 * (f.eff || 0)) : 0, lift: f.flight > 0 ? 40 : 0, fly: f.flight > 0, mitt: true, alpha: f.p.ko > 0 ? .5 : undefined });
  drawHealthMark(c, f.p, p.x, p.y);
  if (L.ball.holder === f) circ(c, p.x + 7, p.y - 22, 3.4, '#f6f0e0');
  if (f.stun > 0) stunStars(c, p.x, p.y - 44);
}
function drawRunner(c, r, p0, bt, sel) {
  const p = fp(p0.x, p0.y), f = r.fx;
  const mv = moving(r) && effSpeed(r) > 0;
  if (sel) { c.strokeStyle = '#ffb547'; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y, 14, 6, 0, 0, Math.PI * 2); c.stroke(); }
  let alpha = 1; if (f.invis > 0) alpha = .18 + Math.sin(G.time * 20) * .06;
  if (f.untag > 0) { for (let i = 0; i < 7; i++) { const a = G.time * 6 + i * .9; txtBat(c, p.x + Math.cos(a) * 14, p.y - 20 + Math.sin(a * 1.3) * 12); } alpha = .45; }
  if (r.eff > .05 && mv) effortAura(c, p.x, p.y, r.eff);
  drawFig(c, r.p.kind, p.x, p.y, 38, bt.def, { num: r.p.num, run: mv ? G.time * (18 + 12 * (r.eff || 0)) : 0, alpha, stone: f.stone > 0 });
  drawHealthMark(c, r.p, p.x, p.y);
  if (f.slow > 0) { c.strokeStyle = 'rgba(240,240,250,.8)'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(p.x, p.y - 16); c.lineTo(p.x + Math.cos(a) * 16, p.y - 16 + Math.sin(a) * 16); c.stroke(); } c.beginPath(); c.arc(p.x, p.y - 16, 9, 0, Math.PI * 2); c.stroke(); }
  if (f.stun > 0) stunStars(c, p.x, p.y - 40);
  if (f.roots > 0) { c.strokeStyle = 'rgba(110,170,80,.9)'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i * 1.26 + G.time; c.beginPath(); c.moveTo(p.x + Math.cos(a) * 12, p.y + 2); c.quadraticCurveTo(p.x + Math.cos(a) * 4, p.y - 10, p.x + Math.cos(a + .5) * 3, p.y - 18 - Math.sin(G.time * 4 + i) * 3); c.stroke(); } }
  if (f.mist > 0) { for (let i = 0; i < 6; i++) { const a = G.time * 3 + i; circ(c, p.x + Math.cos(a) * 12, p.y - 16 + Math.sin(a * 1.4) * 10, 5, 'rgba(200,190,255,.25)'); } }
  if (f.bull > 0) { c.strokeStyle = 'rgba(255,120,60,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y - 16, 16, 0, Math.PI * 2); c.stroke(); }
  if (f.spd && f.spd.t > 0) { for (let i = 1; i <= 3; i++) { c.strokeStyle = `rgba(255,255,255,${.3 - i * .08})`; c.beginPath(); c.moveTo(p.x - 10 - i * 5, p.y - 14 + i * 3); c.lineTo(p.x - 20 - i * 5, p.y - 14 + i * 3); c.stroke(); } }
  if (r.mustReturn) txt(c, 'tag up', p.x, p.y + 12, F_HUD(15), '#ffd27a', 'center');
}
function effortAura(c, x, y, e) {
  c.save(); c.globalAlpha = .25 + .5 * e; c.strokeStyle = '#ffb547'; c.lineWidth = 1.5 + 2 * e;
  c.beginPath(); c.ellipse(x, y, 10 + 8 * e, 4 + 3 * e, 0, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 3; i++) { const t = (G.time * 3 + i / 3) % 1; circ(c, x - 8 + i * 8, y - 2 - t * 10, (1 - t) * 3 * e + .5, `rgba(230,210,170,${.5 * (1 - t)})`); }
  c.restore();
}
function effortMeter(c, x, y, s, e) {
  if (e <= .01) return;
  c.save(); rr(c, x + 3, y + s - 9, s - 6, 6, 3); c.fillStyle = 'rgba(0,0,0,.6)'; c.fill();
  rr(c, x + 3, y + s - 9, Math.max(4, (s - 6) * e), 6, 3); c.fillStyle = e > .75 ? '#ff7a2a' : '#ffb547'; c.fill();
  if (e > .75) { c.strokeStyle = `rgba(255,150,60,${.5 + .4 * Math.sin(G.time * 20)})`; c.lineWidth = 2; rr(c, x, y, s, s, s * .12); c.stroke(); }
  c.restore();
}
function txtBat(c, x, y) { c.fillStyle = '#1a0b12'; c.beginPath(); c.moveTo(x - 5, y); c.quadraticCurveTo(x - 2, y - 3, x, y); c.quadraticCurveTo(x + 2, y - 3, x + 5, y); c.lineTo(x, y + 2); c.fill(); }
function stunStars(c, x, y) { for (let i = 0; i < 3; i++) { const a = G.time * 5 + i * 2.1; txt(c, '✦', x + Math.cos(a) * 10, y + Math.sin(a) * 3, '12px sans-serif', '#ffe27a', 'center'); } }

/* ---------- effects ---------- */
function addFx(type, o) { G.fx.push({ type, t: 0, ...o }); }
function addRoll(label, need, val, ok, total) { { const m = /≥\s*(\d+)/.exec(need); useTag(ok ? 'rollok' : 'rollbad', `${label}: rolled ${val}${total != null ? ` (${total} with bonus)` : ''}${m ? `, needed ${m[1]}+` : ''}`); } G.rolls.push({ label, need, val, ok, total, t: 0 }); G.slow = Math.max(G.slow, .9); sfx.dice(); setTimeout(() => ok ? sfx.good() : sfx.bad(), 450); }
function banner(big, small, dur = 1.6) { G.banner = { big, small, t: 0, dur }; }
function drawTutorial(c) {
  const T = G.tutorial, cards = {
    field: ['You are fielding', ['Fielders chase, catch and throw on their own. The gold ring marks who is going for the ball.', 'When a fielder has the ball, press a direction to choose the throw: ↑ 2nd, → 1st, ← 3rd, ↓ home. Wait and the fielder picks the best throw.', 'Magic (bottom right): Q/E picks a spell, G casts it. Purple means ready; grey says why not. Every club has Tailwind and Grasping Roots.', 'Tap V to hustle the fielder on the ball: faster range and throws, at a stamina cost.']],
    run: ['You are running', ['Runners go on their own. ←/→ picks a runner (gold ring), ↑ sends them on, ↓ sends them back. F sends everyone, R pulls everyone back.', 'Magic (bottom left): Q/E picks a spell for the picked runner, G casts it: their own spell, plus Haste and Ghost Slide, which every club has.', 'Tap V to make the picked runner sprint. A caught fly ball means runners must go back and tag up.']],
  };
  const w = 620, x = 480 - w / 2, lh = 20;
  c.font = F_TXT(15, 500);
  const wrap = t => { const out = []; let line = ''; for (const wd of t.split(' ')) { const tl = line ? line + ' ' + wd : wd; if (c.measureText(tl).width > w - 70) { out.push(line); line = wd; } else line = tl; } if (line) out.push(line); return out; };
  const blocks = T.kinds.map(k => ({ title: cards[k][0], items: cards[k][1].map(wrap) }));
  const hgt = 60 + blocks.reduce((a, b) => a + 40 + b.items.reduce((q, it) => q + it.length * lh + 6, 0), 0);
  const y = Math.max(12, 300 - hgt / 2);
  c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H);
  rr(c, x, y, w, hgt, 10); c.fillStyle = 'rgba(14,20,18,.97)'; c.fill(); c.strokeStyle = COL.torch; c.lineWidth = 2; c.stroke();
  let yy = y + 38;
  for (const b of blocks) {
    txt(c, b.title, x + 22, yy, F_DSP(30), COL.torch); yy += 12;
    for (const it of b.items) { it.forEach((ln, k) => { yy += lh; txt(c, (k ? '   ' : '•  ') + ln, x + 24, yy, F_TXT(15, 500), COL.bone); }); yy += 6; }
    yy += 22;
  }
  txt(c, 'Press F, Enter, Space or click to play on', 480, y + hgt - 16, F_HUD(20), COL.torch, 'center');
  c.restore();
}
function drawFieldFx(c) {
  for (const e of G.fx) {
    if (e.type === 'ring') { const p = fp(e.x, e.y), rr2 = e.t * 320; c.strokeStyle = `rgba(200,168,110,${Math.max(0, .6 - e.t * .6)})`; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y, rr2, rr2 * .8, 0, 0, Math.PI * 2); c.stroke(); }
    else if (e.type === 'puff') { const p = fp(e.x, e.y); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = e.t * 50; circ(c, p.x + Math.cos(a) * d, p.y - 14 + Math.sin(a) * d * .6, Math.max(0, 6 - e.t * 8), e.col); } }
    else if (e.type === 'burst') { const p = fp(e.x, e.y); for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7, d = e.t * 90; circ(c, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, Math.max(0, 4 - e.t * 3), e.col); } }
    else if (e.type === 'chomp') { const p = fp(e.x, e.y), k = Math.min(1, e.t * 3), o = Math.abs(Math.sin(e.t * 12)) * 14 * (1 - Math.min(1, e.t)); c.fillStyle = e.ok ? 'rgba(140,20,30,.85)' : 'rgba(140,140,140,.6)'; c.beginPath(); c.arc(p.x, p.y - 16 - o, 22 * k, Math.PI, 0); c.fill(); c.beginPath(); c.arc(p.x, p.y - 16 + o, 22 * k, 0, Math.PI); c.fill(); }
    else if (e.type === 'beam' && PL) { const a = fp(e.f.x, e.f.y), b = fp(...Object.values(runnerPos(e.r))); c.strokeStyle = e.col; c.globalAlpha = Math.max(0, 1 - e.t); c.lineWidth = e.web ? 1.5 : 3; c.beginPath(); c.moveTo(a.x, a.y - 18); if (e.web) { for (let i = 1; i <= 8; i++) c.lineTo(lerp(a.x, b.x, i / 8) + (i % 2 ? 4 : -4), lerp(a.y, b.y, i / 8) - 18); } else c.lineTo(b.x, b.y - 18); c.stroke(); c.globalAlpha = 1; }
    else if (e.type === 'ghost' && PL) { const p = fp(...Object.values(runnerPos(e.r))); c.globalAlpha = Math.max(0, .8 - e.t * .6); circ(c, p.x + 16, p.y - 30 - e.t * 10, 8, '#dfe9ff'); circ(c, p.x + 13, p.y - 31 - e.t * 10, 1.5, '#111'); circ(c, p.x + 19, p.y - 31 - e.t * 10, 1.5, '#111'); c.globalAlpha = 1; }
  }
}
function drawOverlayFx(c) {
  // callouts
  let n = 0;
  for (const e of G.fx) {
    if (e.type !== 'callout' && e.type !== 'abil') continue;
    const life = e.type === 'abil' ? 1.4 : 1.7; if (e.t > life) continue;
    const a = Math.min(1, (life - e.t) * 3), y = (G.phase === 'play' ? 118 : 132) + n * 30 - Math.min(10, e.t * 12);
    c.globalAlpha = a;
    const s = e.type === 'abil' ? `${e.text}` : e.text;
    const font = e.small ? F_HUD(24) : F_DSP(30);
    c.font = font; const w = c.measureText(s).width + 26;
    rr(c, 480 - w / 2, y - 22, w, 30, 4); c.fillStyle = 'rgba(8,10,12,.78)'; c.fill();
    txt(c, s, 480, y, font, e.col || '#c9a4ff', 'center');
    c.globalAlpha = 1; n++;
  }
  // dice
  const R0 = G.rolls[0];
  if (R0) {
    const x = 480, y = 250, spin = R0.t < .5;
    rr(c, x - 170, y - 50, 340, 104, 8); c.fillStyle = 'rgba(10,8,14,.92)'; c.fill(); c.strokeStyle = R0.t < .5 ? '#a88cff' : R0.ok ? '#8fe38a' : '#ff6a5a'; c.lineWidth = 2; c.stroke();
    txt(c, R0.label, x, y - 28, F_TXT(16), COL.bone, 'center');
    txt(c, R0.need, x, y - 8, F_HUD(20), COL.faint, 'center');
    // d20
    c.save(); c.translate(x - 110, y + 26); c.rotate(spin ? G.time * 14 : 0); c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); } c.closePath(); c.fillStyle = '#2a1f40'; c.fill(); c.strokeStyle = '#a88cff'; c.stroke(); c.restore();
    txt(c, spin ? String(1 + ((G.time * 40) | 0) % 20) : String(R0.val), x - 110, y + 34, F_HUD(26), '#fff', 'center');
    if (!spin) txt(c, (R0.total != null ? `total ${R0.total} · ` : '') + (R0.ok ? 'Success' : 'Failed'), x + 20, y + 34, F_DSP(30), R0.ok ? '#8fe38a' : '#ff6a5a', 'center');
  }
  // banner
  const B = G.banner;
  if (B && B.t < B.dur) {
    const a = Math.min(1, B.t * 5, (B.dur - B.t) * 3);
    c.globalAlpha = a; c.fillStyle = 'rgba(6,8,8,.72)'; c.fillRect(0, 262, W, B.small ? 92 : 70);
    txt(c, B.big, 480, 315, F_DSP(56), COL.torch, 'center');
    if (B.small) txt(c, B.small, 480, 342, F_TXT(17, 500), COL.bone, 'center');
    c.globalAlpha = 1;
  }
}

/* ---------- HUD ---------- */
function manaGems(c, x, y, n, team) { for (let i = 0; i < 6; i++) { c.save(); c.translate(x + i * 13, y); c.rotate(Math.PI / 4); c.fillStyle = i < n ? '#a88cff' : 'rgba(168,140,255,.14)'; c.fillRect(-4, -4, 8, 8); c.restore(); } }
function drawScoreboard(c) {
  panel(c, 10, 10, 262, 84);
  [G.teams[0], G.teams[1]].forEach((t, i) => {
    const y = 38 + i * 32, bat = i === G.half, top = y - 22;
    if (bat) { rr(c, 14, top + 1, 254, 29, 4); c.fillStyle = 'rgba(255,181,71,.12)'; c.fill(); }
    c.fillStyle = t.def.color; c.fillRect(20, top + 5, 4, 21);
    c.font = F_HUD(26); const nw = c.measureText(t.def.short).width;
    txt(c, t.def.short, 30, y, F_HUD(26), bat ? COL.bone : COL.dim);
    // controller badge
    const who = t.ctl === 'cpu' ? 'CPU' : t.ctl.toUpperCase(); c.font = F_HUD(14); const bw = c.measureText(who).width + 10;
    rr(c, 36 + nw, y - 15, bw, 16, 3); c.fillStyle = t.ctl === 'cpu' ? 'rgba(239,230,207,.08)' : 'rgba(255,181,71,.2)'; c.fill();
    txt(c, who, 36 + nw + bw / 2, y - 3, F_HUD(14), t.ctl === 'cpu' ? COL.faint : COL.torch, 'center');
    manaGems(c, 142, y - 8, t.mana, t);
    txt(c, String(t.R), 260, y + 1, F_HUD(32), COL.bone, 'right');
  });
  if (AUTO && G.teams.some(isHuman)) { c.font = F_HUD(15); const lbl = 'AUTO POWERS · T', tw = c.measureText(lbl).width + 16; rr(c, 10, 98, tw, 20, 10); c.fillStyle = 'rgba(168,140,255,.22)'; c.fill(); c.strokeStyle = 'rgba(168,140,255,.6)'; c.lineWidth = 1; c.stroke(); txt(c, lbl, 18, 113, F_HUD(15), '#d6c4ff'); }
}
function drawCount(c) {
  const px = W - 206, pw = 196;
  panel(c, px, 10, pw, 84);
  // bases
  const x0 = px + 44, y0 = 46, s = 16;
  const on = b => G.bases[b] || (PL && PL.runners.some(r => !r.out && !r.scored && settled(r) && Math.round(r.s) === b));
  [[1, x0 + s, y0], [2, x0, y0 - s], [3, x0 - s, y0]].forEach(([b, bx, by]) => { c.save(); c.translate(bx, by); c.rotate(Math.PI / 4); c.fillStyle = on(b) ? COL.torch : 'rgba(239,230,207,.1)'; c.fillRect(-7, -7, 14, 14); c.strokeStyle = on(b) ? '#ffd48a' : 'rgba(239,230,207,.28)'; c.lineWidth = 1.2; c.strokeRect(-7, -7, 14, 14); c.restore(); });
  txt(c, `${G.half ? 'BOT' : 'TOP'} ${ORD(G.inning).toUpperCase()}`, x0, 86, F_HUD(19), COL.dim, 'center');
  // balls, strikes, outs
  const lab = (l, n, max, y, col) => { txt(c, l, px + 100, y, F_HUD(20), COL.faint); for (let i = 0; i < max; i++) { circ(c, px + 124 + i * 17, y - 6, 6, i < n ? col : 'rgba(239,230,207,.1)'); } };
  drawRunPanel(c, px, pw, x0, y0, s);
  lab('B', G.balls, 3, 34, '#8fe38a'); lab('S', G.strikes, 2, 60, '#ffd34a'); lab('O', G.outs, 2, 86, '#ff6a5a');
}
// small centred pill for instructions and prompts
function pill(c, t, y, col, size = 19) { c.font = F_HUD(size); const tw = c.measureText(t).width + 26; rr(c, 480 - tw / 2, y - size + 3, tw, size + 7, (size + 7) / 2); c.fillStyle = 'rgba(8,10,12,.82)'; c.fill(); c.strokeStyle = 'rgba(239,230,207,.14)'; c.lineWidth = 1; c.stroke(); txt(c, t, 480, y, F_HUD(size), col, 'center'); }
function keyHints(ctl) {
  if (ctl === 'p1') return { cyc: 'Q/E', num: '1-6', mv: 'WASD', act: 'F', ab: 'G', back: 'R', pen: 'C', hus: 'V', u: 'W', d: 'S', l: 'A', r: 'D' };
  if (ctl === 'p2') return { cyc: './', num: './', mv: 'Arrows', act: 'Enter', ab: 'RShift', back: "'", pen: '\\', hus: 'RCtrl', u: '↑', d: '↓', l: '←', r: '→' };
  return null;
}
function drawPlateHud(c) {
  const P = G.P; if (!P) return;
  const bt = BT(), ft = FT(), bat = batter(), pt = pitcher();
  // batter panel (left)
  const bl = 10, bw = 226, by = 318;
  panel(c, bl, by, bw, 274);
  txt(c, `AT BAT · ${bt.ctl === 'cpu' ? 'CPU' : bt.ctl.toUpperCase()}`, bl + 12, by + 20, F_HUD(19), COL.faint);
  drawPortrait(c, bat, bt.def, bl + 10, by + 30, 62); effortMeter(c, bl + 10, by + 30, 62, P.beff || 0);
  txt(c, bat.n, bl + 82, by + 50, F_TXT(19, 800), COL.bone);
  txt(c, bat.race, bl + 82, by + 68, F_TXT(14, 500), COL.dim);
  txt(c, `${bat.hand}HB · #${bat.num}`, bl + 82, by + 86, F_HUD(18), COL.faint);
  healthBar(c, bl + 82, by + 100, 132, bat); if (bat.hp < 60) txt(c, '✚', bl + 216, by + 106, F_HUD(13), '#ff8a7a');
  { const fg = fatigue(bat), bw2 = 132; rr(c, bl + 82, by + 91, bw2, 6, 3); c.fillStyle = 'rgba(239,230,207,.12)'; c.fill(); rr(c, bl + 82, by + 91, Math.max(3, bw2 * fg), 6, 3); c.fillStyle = fg > .5 ? '#8fe38a' : fg > .2 ? '#ffd34a' : '#ff6a5a'; c.fill(); }
  [['POW', bat.pow], ['CON', bat.con], ['SPD', bat.spd]].forEach(([k2, v], i) => { const sx = bl + 12 + i * 70; txt(c, k2, sx, by + 122, F_HUD(16), COL.faint); txt(c, String(v), sx + 34, by + 122, F_HUD(21), v <= 3 ? '#ff8a7a' : COL.bone); });
  P.stances.forEach((s, i) => {
    const y = by + 146 + i * (P.stances.length > 5 ? 20.5 : P.stances.length > 4 ? 23 : 26), sel = i === P.si, ok = affordable(s, bt);
    if (sel) { rr(c, bl + 6, y - 19, bw - 12, 25, 4); c.fillStyle = 'rgba(255,181,71,.16)'; c.fill(); }
    if (bt.ctl === 'p1') txt(c, String(i + 1), bl + 14, y, F_HUD(17), COL.faint);
    txt(c, s.name, bl + (bt.ctl === 'p1' ? 28 : 16), y, F_TXT(16, sel ? 800 : 500), !ok ? COL.faint : sel ? COL.torch : s.k === 'gear' ? '#f0dca8' : COL.bone);
    if (s.cost) manaCost(c, bl + bw - 16, y - 6, s.cost); else if (s.stam) staminaCost(c, bl + bw - 12, y, s.stam);
  });
  const h = keyHints(bt.ctl);
  if (h) txt(c, `${h.num} stance · ${h.mv} aim · ${h.act} swing · ${h.hus} power`, bl + 12, by + 264, F_TXT(12, 500), COL.faint);
  else if (P.stances[P.si].k === 'ab') txt(c, AB[P.stances[P.si].ab].desc.slice(0, 44) + '…', bl + 12, by + 264, F_TXT(12.5, 500), COL.faint);
  else if (P.stances[P.si].k === 'gear') txt(c, GEAR[P.stances[P.si].gear].desc.slice(0, 44) + '…', bl + 12, by + 264, F_TXT(12.5, 500), COL.faint);
  // pitcher panel (right)
  const px = W - 236, pw = 226;
  panel(c, px, by, pw, 274);
  txt(c, `PITCHING · ${ft.ctl === 'cpu' ? 'CPU' : ft.ctl.toUpperCase()}`, px + 12, by + 20, F_HUD(19), COL.faint);
  drawPortrait(c, pt, ft.def, px + 10, by + 30, 62); effortMeter(c, px + 10, by + 30, 62, P.peff || 0);
  txt(c, pt.n, px + 82, by + 50, F_TXT(19, 800), COL.bone);
  txt(c, pt.race, px + 82, by + 68, F_TXT(14, 500), COL.dim);
  txt(c, `${pt.hand}HP · PC ${pt.pc || 0}`, px + 82, by + 86, F_HUD(18), COL.faint);
  healthBar(c, px + 82, by + 100, 132, pt); if (pt.hp < 60) txt(c, '✚', px + 216, by + 106, F_HUD(13), '#ff8a7a');
  { const fg = fatigue(pt), bw2 = 132; rr(c, px + 82, by + 91, bw2, 6, 3); c.fillStyle = 'rgba(239,230,207,.12)'; c.fill(); rr(c, px + 82, by + 91, Math.max(3, bw2 * fg), 6, 3); c.fillStyle = fg > .5 ? '#8fe38a' : fg > .2 ? '#ffd34a' : '#ff6a5a'; c.fill(); }
  const showSel = isHuman(ft) || G.mode === 'demo';
  P.pitches.forEach((p, i) => {
    const y = by + 124 + i * (P.pitches.length > 7 ? 16.5 : P.pitches.length > 6 ? 19 : P.pitches.length > 5 ? 22 : 24), tight = P.pitches.length > 7, sel = showSel && i === P.pi && P.stage !== 'flight' && P.stage !== 'result', ok = affordable(p, ft);
    if (sel) { rr(c, px + 6, y - (tight ? 15 : 18), pw - 12, tight ? 19 : 24, 4); c.fillStyle = 'rgba(255,181,71,.16)'; c.fill(); }
    if (ft.ctl === 'p1') txt(c, String(i + 1), px + 14, y, F_HUD(17), COL.faint);
    txt(c, p.name, px + (ft.ctl === 'p1' ? 28 : 16), y, F_TXT(tight ? 14.5 : 16, sel ? 800 : 500), !ok ? COL.faint : sel ? COL.torch : p.magic ? '#d6c4ff' : p.gear ? '#f0dca8' : COL.bone);
    if (p.cost) manaCost(c, px + pw - 16, y - 6, p.cost);
  });
  const hp = keyHints(ft.ctl);
  if (hp) txt(c, `${hp.num} pick · ${hp.act} throw · ${hp.hus} heat${ft.pen.length ? ` · ${hp.pen} pen` : ''}`, px + 12, by + 264, F_TXT(12, 500), COL.faint);
  else if (P.stage === 'select') txt(c, 'Deciding the pitch…', px + 12, by + 264, F_TXT(13, 500), COL.faint);
  // intro + result
  if (P.intro > 0 && P.stage === 'select') { c.globalAlpha = Math.min(1, P.intro * 3); c.font = F_DSP(34); const tw = Math.max(c.measureText(`Now batting: ${bat.n}`).width, (c.font = F_TXT(15, 400), c.measureText(bat.flav).width)) + 40; rr(c, 480 - tw / 2, 96, tw, 60, 8); c.fillStyle = 'rgba(8,10,12,.78)'; c.fill(); txt(c, `Now batting: ${bat.n}`, 480, 126, F_DSP(34), COL.bone, 'center'); txt(c, bat.flav, 480, 146, F_TXT(15, 400), COL.dim, 'center'); c.globalAlpha = 1; }
  if (P.earlyNote > 0 && P.stage !== 'flight') pill(c, 'Wait for the release, then swing', 250, '#ffd34a', 22);
  drawReleaseMeter(c, P, ft, pt);
  drawTimingBar(c, P, bt, bat);
  // the call stays on the field; the details (pitch, count, timing, reach) go to the data bar under it
  if (P.stage === 'result' && P.result) { c.font = F_DSP(40); const tw = c.measureText(P.result.big).width + 32; rr(c, 480 - tw / 2, 540, tw, 46, 8); c.fillStyle = 'rgba(8,10,12,.55)'; c.fill(); txt(c, P.result.big, 480, 575, F_DSP(40), P.result.code ? COL.torch : COL.bone, 'center'); }
  if (HINTS && P.stage === 'select' && isHuman(ft) && P.t > .3 && !(P.intro > 0)) pill(c, 'Pick a pitch · aim the crosshair · throw', 32, 'rgba(239,230,207,.8)', 17);
  if (HINTS && (P.stage === 'select' || P.stage === 'windup') && isHuman(bt) && !(P.intro > 0)) pill(c, 'Circle on the marker · swing on gold', 32, 'rgba(239,230,207,.8)', 17);
}
// pitcher's release meter: fills through the windup; a second press on the gold band tightens the pitch.
// Once released, the fill freezes at the release point and a marker pins it there until the next pitch.
const REL_COL = { perfect: '#ffd34a', good: '#8fe38a', early: '#ff8a5a', late: '#ff8a5a', auto: '#c9c2ad' };
const REL_TXT = { perfect: 'PERFECT', good: 'GOOD', early: 'EARLY', late: 'LATE', auto: 'NO PRESS' };
function drawReleaseMeter(c, P, ft, pt) {
  if (!isHuman(ft)) return;
  const pre = P.stage === 'select' || P.stage === 'windup', after = P.rel != null;
  if (!pre && !after) return;
  const x = 560, top = 150, bot = 282, Hm = bot - top, yOf = t => bot - clamp(t / .75, 0, 1) * Hm, b = relBand(pt);
  c.save(); if (P.stage === 'result' || P.stage === 'hit') c.globalAlpha = .8;
  rr(c, x - 9, top - 6, 18, Hm + 12, 6); c.fillStyle = 'rgba(8,10,12,.85)'; c.fill(); c.strokeStyle = 'rgba(239,230,207,.25)'; c.lineWidth = 1; c.stroke();
  // gold bands first, so the fill reads against them
  c.fillStyle = 'rgba(255,211,74,.22)'; c.fillRect(x - 7, yOf(REL_C + b.good), 14, yOf(REL_C - b.good) - yOf(REL_C + b.good));
  c.fillStyle = 'rgba(255,211,74,.55)'; c.fillRect(x - 7, yOf(REL_C + b.perfect), 14, yOf(REL_C - b.perfect) - yOf(REL_C + b.perfect));
  const grade = P.relGrade || (after ? 'auto' : null), relAt = P.relT != null ? P.relT : after ? .75 : null;
  const fillT = relAt != null ? relAt : P.stage === 'windup' ? P.t : 0;
  if (fillT > 0) { const yy = yOf(fillT); rr(c, x - 5, yy, 10, bot - yy, 3); c.fillStyle = grade ? REL_COL[grade] : 'rgba(255,181,71,.8)'; c.globalAlpha *= grade ? .85 : 1; c.fill(); c.globalAlpha = P.stage === 'result' || P.stage === 'hit' ? .8 : 1; }
  // where it left the hand: a bold pin across the meter with a pointer and the grade
  if (relAt != null) {
    const yy = yOf(relAt), col = REL_COL[grade];
    if (grade === 'perfect') { c.save(); c.shadowColor = col; c.shadowBlur = 12; }
    c.fillStyle = col; c.fillRect(x - 15, yy - 2, 30, 4);
    tri(c, [x - 24, yy - 6], [x - 15, yy], [x - 24, yy + 6], col);
    if (grade === 'perfect') c.restore();
    const lbl = REL_TXT[grade]; c.font = F_HUD(17); const tw = c.measureText(lbl).width + 12;
    rr(c, x + 16, yy - 11, tw, 20, 4); c.fillStyle = 'rgba(8,10,12,.85)'; c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.stroke();
    txt(c, lbl, x + 22, yy + 5, F_HUD(17), col);
  }
  const k = keyHints(ft.ctl), act = k ? k.act : 'F';
  if (P.stage === 'select') txt(c, 'RELEASE', x, top - 12, F_HUD(15), 'rgba(239,230,207,.6)', 'center');
  else if (P.stage === 'windup' && P.relT == null && P.t > REL_C - b.good - .12 && P.t < REL_C + b.good) txt(c, `${act}!`, x + 16, yOf(REL_C) + 6, F_HUD(22), '#ffd34a');
  c.restore();
}
// batter's timing bar, live while the ball is in the air: the trip to the plate, the window where a swing connects, and your swing
function drawTimingBar(c, P, bt, bat) {
  const pc = P.pitch;
  if (!pc || P.stage !== 'flight' || P.rel == null) return false;
  if (!(isHuman(bt) || G.mode === 'demo')) return false;
  const st = P.stances[P.si];
  let win = P.swingWin != null ? P.swingWin : swingMods(bat, st.k, st.k === 'ab' ? st.ab : null, st.k === 'phys' ? st.ph : null, P.beff || 0).win;
  if (P.swingWin != null && pc.ab === 'bunt') win *= 1.9;
  const w = 240, x0 = (bat.hand === 'R' ? 560 : 400) - w / 2, y = 494, tmax = pc.Ta * 1.3, X = t => x0 + clamp(t / tmax, 0, 1) * w;
  rr(c, x0 - 10, y - 26, w + 20, 40, 6); c.fillStyle = 'rgba(8,10,12,.72)'; c.fill();
  rr(c, x0, y - 4, w, 8, 4); c.fillStyle = 'rgba(239,230,207,.14)'; c.fill();
  c.fillStyle = 'rgba(255,211,74,.75)'; c.fillRect(X(pc.Ta - win), y - 5, X(pc.Ta + win) - X(pc.Ta - win), 10);
  c.fillStyle = '#fff'; c.fillRect(X(pc.Ta) - 1, y - 8, 2, 16);
  txt(c, 'TIMING', x0, y - 11, F_HUD(15), 'rgba(239,230,207,.55)');
  const p = pitchProg(pc, P.t), hidden = pc.fx === 'phantom' && p > .26 && p < .9;
  if (!hidden) circ(c, X(P.t), y, 5, '#f6f0e0');
  if (P.swing) { const ok = Math.abs(P.swing.t - pc.Ta) <= win; c.fillStyle = ok ? '#8fe38a' : '#ff8a5a'; c.fillRect(X(P.swing.t) - 2, y - 11, 4, 22); }
  return true;
}

/* ---------- data bar under the field: the last pitch in numbers ---------- */
const RO = { gold: '#ffd34a', green: '#8fe38a', red: '#ff8a5a', bone: '#ede4cd', faint: '#72817a' };
function dirWords(dx, dh, hand) { // ball relative to a point: which way it was
  const v = Math.abs(dh) < .12 ? '' : dh > 0 ? 'high' : 'low';
  const inside = hand === 'R' ? dx < 0 : dx > 0, hz = Math.abs(dx) < .12 ? '' : inside ? 'inside' : 'outside';
  return [v, hz].filter(Boolean).join(' and ') || 'right there';
}
const inch = ft => Math.max(1, Math.round(ft * 12));
function roZone(r) {
  const X = x => 60 + clamp(x, -1.8, 1.8) * 32, Y = h => 124 - (clamp(h, .3, 4.3) - .6) * 29;
  let s = `<svg class="ro-svg ro-zone" viewBox="0 0 120 132" width="120" height="132" aria-hidden="true">`;
  s += `<rect x="${X(-.708)}" y="${Y(3.4)}" width="${X(.708) - X(-.708)}" height="${Y(1.6) - Y(3.4)}" fill="rgba(239,230,207,.05)" stroke="rgba(239,230,207,.45)" stroke-dasharray="3 3"/>`;
  s += `<path d="M${X(-.708)} ${Y(.75)} h${X(.708) - X(-.708)} l-6 5 h${-(X(.708) - X(-.708) - 12)} z" fill="rgba(239,230,207,.25)"/>`;
  if (r.swing) { const sw = r.swing, hit = sw.d <= sw.r; s += `<circle cx="${X(sw.cx)}" cy="${Y(sw.ch)}" r="${sw.r * 30}" fill="${hit ? 'rgba(143,227,138,.14)' : 'none'}" stroke="${hit ? RO.green : RO.red}" stroke-width="1.5"/>`; if (!hit) s += `<line x1="${X(sw.cx)}" y1="${Y(sw.ch)}" x2="${X(r.cross.x)}" y2="${Y(r.cross.h)}" stroke="${RO.red}" stroke-dasharray="2 2"/>`; }
  if (r.aim) { const a = r.aim, col = inZone(a.x, a.h) ? RO.green : RO.red; s += `<g stroke="${col}" stroke-width="1.5"><circle cx="${X(a.x)}" cy="${Y(a.h)}" r="4" fill="none"/><line x1="${X(a.x) - 7}" y1="${Y(a.h)}" x2="${X(a.x) + 7}" y2="${Y(a.h)}"/><line x1="${X(a.x)}" y1="${Y(a.h) - 7}" x2="${X(a.x)}" y2="${Y(a.h) + 7}"/></g>`; }
  s += `<circle cx="${X(r.cross.x)}" cy="${Y(r.cross.h)}" r="4" fill="#f6f0e0" stroke="#17100e"/>`;
  return s + '</svg>';
}
function roBar(lo, hi, bands, marks, max) {
  const X = t => 4 + clamp(t / max, 0, 1) * 172;
  let s = `<svg class="ro-svg" viewBox="0 0 180 26" width="180" height="26" aria-hidden="true"><rect x="4" y="10" width="172" height="6" rx="3" fill="rgba(239,230,207,.14)"/>`;
  for (const [a, b, col] of bands) s += `<rect x="${X(a)}" y="9" width="${Math.max(1, X(b) - X(a))}" height="8" fill="${col}"/>`;
  for (const m of marks) s += m.line ? `<rect x="${X(m.t) - 1}" y="5" width="2" height="16" fill="${m.col}"/>` : `<rect x="${X(m.t) - 2}" y="2" width="4" height="22" rx="1" fill="${m.col}"/><path d="M${X(m.t) - 5} 0 h10 l-5 5 z" fill="${m.col}"/>`;
  return s + `</svg><div class="ro-scale"><span>${lo}</span><span>${hi}</span></div>`;
}
function renderReadout() {
  const el = document.getElementById('readout'); if (!el) return;
  el.hidden = !G.teams; // no game, no pitch data: the bar steps out of the way
  const r = G.lastPitch;
  if (!r) { el.innerHTML = '<p class="ro-empty">Pitch data shows up here: speed, location, release and swing timing for every pitch.</p>'; return; }
  const cells = [];
  const callCol = /foul/i.test(r.big) ? RO.gold : /strike|miss/i.test(r.big) ? RO.red : /ball/i.test(r.big) ? RO.green : RO.gold;
  const cnt = r.strikes >= 3 ? 'strikeout' : r.balls >= 4 ? 'walk' : `count ${r.balls}-${r.strikes}`;
  cells.push(`<div class="ro-cell ro-call"><div class="ro-k">Pitch ${r.n} · ${esc(r.pitcher)} to ${esc(r.batter)}</div>
    <div class="ro-big" style="color:${callCol}">${esc(r.big)}</div>
    <div class="ro-sub"><b>${esc(r.pitch)}</b>${r.magic ? ' (magic)' : ''} · ${r.mph} mph · ${cnt}</div>
    ${r.outcome ? `<div class="ro-sub ro-out">${esc(r.outcome)}</div>` : ''}</div>`);
  // location
  const locLines = [`<b>${r.zone ? 'In the zone' : 'Outside the zone'}</b>, ${dirWords(r.cross.x, r.cross.h - 2.5, r.hand)}`];
  if (r.aim) { const m = Math.hypot(r.cross.x - r.aim.x, r.cross.h - r.aim.h); locLines.push(m < .12 ? 'Hit the target' : `Missed the target by ${inch(m)} in, ${dirWords(r.cross.x - r.aim.x, r.cross.h - r.aim.h, r.hand)}`); }
  cells.push(`<div class="ro-cell ro-loc">${roZone(r)}<div><div class="ro-k">Location</div>${locLines.map(t => `<div class="ro-sub">${t}</div>`).join('')}
    <div class="ro-legend"><i style="background:#f6f0e0"></i>ball${r.aim ? ' <i class="x"></i>aim' : ''}${r.swing ? ' <i class="o"></i>swing' : ''}</div></div></div>`);
  // release (human pitcher)
  if (r.rel) {
    const g = r.rel.grade || 'auto', t = r.rel.t != null ? r.rel.t : .75, b = r.rel.band;
    const eff = { perfect: 'scatter −45%, a touch faster', good: 'scatter −20%', early: 'scatter +40%', late: 'scatter +40%', auto: 'normal scatter' }[g];
    const off = r.rel.t != null ? Math.round((r.rel.t - REL_C) * 1000) : null;
    cells.push(`<div class="ro-cell"><div class="ro-k">Release</div>${roBar('windup', 'release', [[REL_C - b.good, REL_C + b.good, 'rgba(255,211,74,.3)'], [REL_C - b.perfect, REL_C + b.perfect, 'rgba(255,211,74,.8)']], [{ t, col: REL_COL[g] }], .75)}
      <div class="ro-sub"><b style="color:${REL_COL[g]}">${REL_TXT[g]}</b>${off != null && g !== 'perfect' ? ` · ${Math.abs(off)} ms ${off < 0 ? 'early' : 'late'}` : ''} · ${eff}</div></div>`);
  }
  // swing
  if (r.swing) {
    const sw = r.swing, ok = Math.abs(sw.e) <= sw.win, ms = Math.round(Math.abs(sw.e) * 1000), over = Math.max(1, Math.round((Math.abs(sw.e) - sw.win) * 1000));
    const tLine = ok ? (ms <= 15 ? 'Timing: dead on' : `Timing: in time, ${ms} ms ${sw.e < 0 ? 'early' : 'late'} of perfect`) : `Timing: ${over} ms too ${sw.e < 0 ? 'early' : 'late'}`;
    const reach = sw.d <= sw.r ? `Reach: on the ball (${inch(sw.d)} in off center)` : `Reach: ball was ${inch(sw.d - sw.r)} in past your circle, ${dirWords(sw.dx, sw.dh, r.hand)}`;
    const ct = r.contact ? `Contact ${Math.round(r.contact.q * 100)}% · ${r.contact.mph} mph off the bat · ${r.contact.launch}° launch` : '';
    cells.push(`<div class="ro-cell"><div class="ro-k">Swing</div>${roBar('release', 'past the plate', [[r.Ta - sw.win, r.Ta + sw.win, 'rgba(255,211,74,.75)']], [{ t: r.Ta, col: '#fff', line: true }, { t: r.Ta + sw.e, col: ok ? RO.green : RO.red }], r.Ta * 1.3)}
      <div class="ro-sub" style="color:${ok ? RO.green : RO.red}">${tLine}</div><div class="ro-sub" style="color:${sw.d <= sw.r ? RO.green : RO.red}">${reach}</div>${ct ? `<div class="ro-sub">${ct}</div>` : ''}</div>`);
  } else if (r.batHuman || G.mode === 'demo') cells.push(`<div class="ro-cell"><div class="ro-k">Swing</div><div class="ro-sub">Took the pitch${r.zone ? ' (it was a strike)' : ' (good eye: it was a ball)'}.</div></div>`);
  // this at-bat
  const seq = (G.abPitches || []).map(p => `<li><b>${p.n}</b> ${esc(p.pitch)} <span>${esc(p.big)}</span></li>`).join('');
  cells.push(`<div class="ro-cell ro-seq"><div class="ro-k">This at-bat</div><ol>${seq}</ol></div>`);
  el.innerHTML = `<div class="ro-grid">${cells.join('')}</div>`;
}
function staminaCost(c, x, y, n) { txt(c, `⚡${n}`, x, y, F_HUD(17), '#ffd27a', 'right'); }
function manaCost(c, x, y, n) { for (let i = 0; i < n; i++) { c.save(); c.translate(x - i * 11, y); c.rotate(Math.PI / 4); c.fillStyle = '#a88cff'; c.fillRect(-3.5, -3.5, 7, 7); c.restore(); } }
function drawFieldHud(c) {
  const L = PL; if (!L) return;
  const bt = BT(), ft = FT(), hb = isHuman(bt), hf = isHuman(ft);
  const NAMES = ['home', '1st', '2nd', '3rd', 'home'];
  const list = alive().sort((a, b) => b.s - a.s), pr = list[clamp(L.sel, 0, Math.max(0, list.length - 1))], rsp = pr ? runSpells(pr) : [];
  const k = keyHints(bt.ctl), kf = keyHints(ft.ctl);
  // ---- running panel (full for a human side, compact for the CPU)
  {
    const w = 236, rowH = hb ? 38 : 24, x = 10;
    const h = 32 + list.length * rowH + (hb ? 18 + rsp.length * 22 + 36 : 6);
    const y = H - h - 10;
    panel(c, x, y, w, h);
    txt(c, `RUNNING · ${bt.ctl === 'cpu' ? 'CPU' : bt.ctl.toUpperCase()}`, x + 12, y + 22, F_HUD(18), COL.faint);
    list.forEach((r, i) => {
      const yy = y + 46 + i * rowH, sel = hb && i === L.sel;
      if (sel) { rr(c, x + 6, yy - 17, w - 12, rowH - 2, 4); c.fillStyle = 'rgba(255,181,71,.16)'; c.fill(); }
      const st = settled(r) ? `on ${NAMES[Math.round(r.s)]}` : r.target > r.s ? `→ ${NAMES[r.target]}` : `← ${NAMES[r.target]}`;
      txt(c, shortName(r.p), x + 16, yy, F_TXT(15, 800), sel ? COL.torch : COL.bone);
      txt(c, st, x + w - 14, yy, F_HUD(19), COL.dim, 'right');
      if (hb) {
        const ab = r.p.run ? AB[r.p.run] : null, ph = physOf(r.p, 'run');
        const sub = ab ? `${ab.name}${ab.passive ? ' (passive)' : r.used ? ' · used' : ''}` : ph ? `${AB[ph].name} (skill)${r.usedPhys ? ' · used' : ''}` : '';
        txt(c, sub, x + 16, yy + 14, F_TXT(12, 500), COL.faint);
      }
    });
    if (hb) {
      const sy = y + 32 + list.length * rowH;
      txt(c, `SPELLS FOR ${pr ? shortName(pr.p).toUpperCase() : ''}`, x + 12, sy + 14, F_HUD(15), COL.faint);
      rsp.forEach((o, i) => {
        const yy = sy + 34 + i * 22, sel = i === clamp(L.selR || 0, 0, rsp.length - 1);
        if (sel) { rr(c, x + 6, yy - 15, w - 12, 20, 4); c.fillStyle = 'rgba(168,140,255,.18)'; c.fill(); }
        txt(c, `${AB[o.id].name}${o.phys ? ' (skill)' : o.own ? '' : ' (club)'}${o.ok ? '' : ' · ' + o.why}`, x + 16, yy, F_TXT(13, o.ok ? 700 : 500), o.ok ? (o.phys ? '#ffd27a' : '#d6c4ff') : COL.faint);
        if (o.phys) staminaCost(c, x + w - 12, yy, o.stam); else manaCost(c, x + w - 16, yy - 5, o.cost);
      });
      txt(c, `${k.l}/${k.r} pick · ${k.u} send · ${k.d} hold · ${k.act} all go`, x + 12, y + h - 22, F_TXT(12, 500), COL.faint);
      txt(c, `${k.cyc} spell · ${k.ab} cast · ${k.hus} sprint`, x + 12, y + h - 8, F_TXT(12, 500), COL.faint);
    }
  }
  // ---- fielding panel
  const fl = L.fabs || [];
  {
    const fw = 250, rowH = hf ? 35 : 20, fx = W - fw - 10;
    const fh = 34 + Math.max(1, fl.length) * rowH + (hf ? 40 : 6), fy = H - fh - 10;
    panel(c, fx, fy, fw, fh);
    txt(c, `FIELDING · ${ft.ctl === 'cpu' ? 'CPU' : ft.ctl.toUpperCase()}`, fx + 12, fy + 22, F_HUD(18), COL.faint);
    if (!fl.length) txt(c, 'No fielding magic', fx + 16, fy + 46, F_TXT(14, 500), COL.faint);
    fl.forEach((o, i) => {
      const yy = fy + 46 + i * rowH, sel = hf && i === L.selF;
      if (sel) { rr(c, fx + 6, yy - 17, fw - 12, rowH - 3, 4); c.fillStyle = 'rgba(168,140,255,.16)'; c.fill(); }
      const col = o.ok ? (o.phys ? '#ffd27a' : '#d6c4ff') : COL.faint;
      if (hf) {
        txt(c, AB[o.ab].name, fx + 16, yy, F_TXT(15, 800), col);
        txt(c, `${o.team ? 'Club magic' : shortName(o.f.p) + (o.phys ? ' · skill' : '')}${o.ok ? '' : ' · ' + o.why}`, fx + 16, yy + 13, F_TXT(12, 500), COL.faint);
      } else txt(c, `${AB[o.ab].name}${o.team ? '' : ' · ' + shortName(o.f.p)}`, fx + 16, yy, F_TXT(13, o.ok ? 700 : 500), col);
      if (o.phys) staminaCost(c, fx + fw - 12, yy, o.stam); else manaCost(c, fx + fw - 16, yy - 5, o.cost);
    });
    if (hf) {
      txt(c, `${kf.cyc} spell · ${kf.ab} cast · ${kf.hus} hustle`, fx + 12, fy + fh - 22, F_TXT(12, 500), COL.faint);
      txt(c, `Throw: ${kf.u} 2nd · ${kf.r} 1st · ${kf.l} 3rd · ${kf.d} home`, fx + 12, fy + fh - 8, F_TXT(12, 500), COL.faint);
    }
  }
  // ---- prompt pills (optional help)
  const lines = [];
  if (HINTS && hf && L.endT === null) {
    if (L.ball.st === 'held' && L.ball.holder && L.holdT < .6) lines.push([`Throw now: ${kf.u} 2nd · ${kf.r} 1st · ${kf.l} 3rd · ${kf.d} home`, COL.torch]);
    else { const o = fl[clamp(L.selF, 0, Math.max(0, fl.length - 1))]; if (o) lines.push([o.ok ? `${kf.ab}: cast ${AB[o.ab].name}${o.team ? '' : ` (${shortName(o.f.p)})`}` : `Fielding magic: ${kf.cyc} to pick a spell`, o.ok ? '#d6c4ff' : 'rgba(239,230,207,.75)']); }
  }
  if (HINTS && hb && L.endT === null && pr) { const o = rsp[clamp(L.selR || 0, 0, rsp.length - 1)]; lines.push([o && o.ok ? `${k.ab}: ${AB[o.id].name} on ${shortName(pr.p)} · ${k.u} send · ${k.d} hold` : `${shortName(pr.p)}: ${k.u} send · ${k.d} hold · ${k.l}/${k.r} pick runner`, o && o.ok ? '#d6c4ff' : 'rgba(239,230,207,.75)']); }
  lines.slice(0, 2).forEach(([t, col], i) => pill(c, t, 32 + i * 30, col, 18));
  if (G.tutorial) drawTutorial(c);
}

function render() {
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, W, H);
  if (!bgPlate) buildPlateBg(); if (!bgField) buildFieldBg();
  c.save();
  if (G.shake > 0) c.translate((R() - .5) * G.shake * 16, (R() - .5) * G.shake * 16);
  if (G.phase === 'play' && PL) { drawField(c); }
  else drawPlate(c);
  c.restore();
  if (G.teams && G.phase !== 'menu') {
    drawScoreboard(c); drawCount(c); drawConditions(c);
    if (G.phase === 'plate') drawPlateHud(c);
    if (G.phase === 'play') drawFieldHud(c);
    drawOverlayFx(c);
  }
  if (G.paused) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, W, H); }
}

