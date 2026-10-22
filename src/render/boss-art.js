/* p7b: the bosses' art and the arena's special effects */
BESPOKE.add('wyrm'); BESPOKE.add('zamboni');
Object.assign(KIND_WPN, { bogtroll: 'rake', kqueen: 'baton', banshee: 'scythe' });
A.vfx = [];
const _drawAny = drawAny;
drawAny = function (c, kind, x, y, hpx, team, o = {}) {
  if (kind === 'wyrm') return drawWyrm(c, x, y, hpx, team, o);
  if (kind === 'zamboni') return drawZamboni(c, x, y, hpx, team, o);
  if (kind === 'mirror') return drawMirror(c, x, y, hpx, team, o);
  _drawAny(c, kind, x, y, hpx, team, o);
  if (o.crown) { const K = KIND[kind] || KIND.goblin, hy = y - hpx * K.h * .98; c.save(); LW = 2; ink(c, pPoly([[x - 14, hy + 6], [x - 16, hy - 10], [x - 7, hy - 2], [x, hy - 14], [x + 7, hy - 2], [x + 16, hy - 10], [x + 14, hy + 6]]), '#ffd166', 0, true); for (const gx of [-8, 0, 8]) circ(c, x + gx, hy + 1, 2.2, gx ? '#d9407a' : '#7fd6ff'); c.restore(); }
};
// your own captain, drawn in the other team's colours with a violet sheen
const MIRC = document.createElement('canvas'); MIRC.width = 520; MIRC.height = 520; const mirc = MIRC.getContext('2d');
function drawMirror(c, x, y, hpx, team, o) {
  const kind = RUN && RUN.party ? RUN.party[0].kind : 'werewolf', num = RUN && RUN.party ? RUN.party[0].num : 0;
  const s = Math.min(1.6, hpx / 150);
  mirc.setTransform(1, 0, 0, 1, 0, 0); mirc.clearRect(0, 0, 520, 520);
  _drawAny(mirc, kind, 260, 440, 150, team, Object.assign({}, o, { num, wpn: KIND_WPN[kind], noShadow: true, alpha: null }));
  mirc.globalCompositeOperation = 'source-atop'; mirc.fillStyle = 'rgba(70,30,120,.42)'; mirc.fillRect(0, 0, 520, 520);
  const g = mirc.createLinearGradient(0, 0, 520, 520); g.addColorStop(.35, 'rgba(255,255,255,0)'); g.addColorStop(.5 + Math.sin(G.time) * .1, 'rgba(210,190,255,.35)'); g.addColorStop(.65, 'rgba(255,255,255,0)'); mirc.fillStyle = g; mirc.fillRect(0, 0, 520, 520);
  mirc.globalCompositeOperation = 'source-over';
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha;
  ell(c, x, y, 40 * s, 8 * s, 'rgba(0,0,0,.35)');
  c.drawImage(MIRC, x - 260 * s * hpx / 150 / s, y - 440 * hpx / 150, 520 * hpx / 150, 520 * hpx / 150);
  c.restore();
}
function drawWyrm(c, x, y, hpx, team, o) {
  const s = hpx / 100, t = G.time;
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s); LW = Math.max(1.25, 1.4 / s); FSC = s;
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (!o.noShadow) ell(c, 0, 0, 60, 9, 'rgba(0,0,0,.4)');
  const skin = '#8a2a1a', belly = '#e0a24a', dark = '#4a120a', flap = Math.sin(t * (o.charging ? 6 : 2.2)) * 10;
  // far wing
  ink(c, pPoly([[-6, -62], [-30, -118 - flap], [-62, -126 - flap], [-50, -98 - flap * .5], [-76, -96 - flap * .4], [-48, -78], [-60, -64], [-22, -56]]), tint(skin, -.25));
  // tail
  const tw = Math.sin(t * 1.6) * 8;
  ink(c, pPoly([[-30, -24], [-62, -30 + tw], [-88, -18 + tw * 1.4], [-104, -30 + tw * 1.8], [-92, -10 + tw * 1.4], [-60, -12 + tw], [-26, -8]]), skin);
  // body and legs
  ink(c, pEl(-8, -36, 40, 28), skin);
  ink(c, pEl(-2, -28, 26, 16), belly, 0, true);
  ink(c, pPoly([[-4, -58], [-16, -120 - flap], [-52, -138 - flap], [-36, -108 - flap * .5], [-64, -104 - flap * .4], [-34, -82], [-44, -66], [-10, -50]]), skin);
  for (const [a, b] of [[[-8, -58], [-44, -132 - flap]], [[-10, -56], [-56, -104 - flap * .4]]]) inkLine(c, [a, b], dark, 1.2);
  for (let i = 0; i < 4; i++) inkLine(c, [[-20 + i * 9, -18], [-18 + i * 9, -40]], tint(belly, -.25), .7);
  for (const lx of [-30, 10]) { ink(c, capsule(lx, -24, 9, lx + 4, -4, 7, 1, 0), skin); for (let k = 0; k < 3; k++) tri(c, [lx - 2 + k * 5, -2], [lx + 1 + k * 5, 4], [lx + 4 + k * 5, -2], '#f2ead8'); }
  // a captain's scarf in team colours
  ink(c, pPoly([[12, -56], [26, -62], [30, -50], [18, -44]]), team.color, 0, true); ink(c, pPoly([[16, -48], [8, -26], [16, -26], [22, -46]]), team.color, 0, true);
  // neck and head, swaying; jaw opens to breathe
  const sw = Math.sin(t * 1.3) * 4, open = o.mouth ? .55 + Math.sin(t * 20) * .08 : o.charging ? .15 : .05;
  ink(c, pPoly([[14, -52], [40 + sw, -74], [62 + sw, -76], [58 + sw, -60], [28, -34]]), skin);
  for (let i = 0; i < 4; i++) tri(c, [20 + i * 10 + sw * i / 4, -56 - i * 5], [18 + i * 10 + sw * i / 4, -66 - i * 5], [26 + i * 10 + sw * i / 4, -58 - i * 5], '#f2c24a');
  c.save(); c.translate(60 + sw, -74);
  ink(c, pPoly([[-10, -8], [22, -14], [40, -6], [38, 2], [6, 6], [-8, 4]]), skin);
  c.save(); c.translate(0, 2); c.rotate(open); ink(c, pPoly([[-6, 0], [36, 2], [30, 10], [-2, 8]]), dark); for (let i = 0; i < 4; i++) tri(c, [6 + i * 7, 2], [9 + i * 7, 7], [12 + i * 7, 2], '#f2ead8'); c.restore();
  ink(c, pPoly([[-2, -10], [-18, -34], [4, -14]]), '#efe6cf'); ink(c, pPoly([[8, -12], [0, -36], [14, -14]]), '#efe6cf');
  c.save(); c.shadowColor = '#ffd166'; c.shadowBlur = 8; circ(c, 18, -6, 3.2, o.charging ? '#fff' : '#ffd166'); c.restore(); circ(c, 18.6, -6, 1.2, INK);
  if (o.charging || o.mouth) { c.save(); c.globalAlpha *= .6 + Math.sin(t * 16) * .3; c.shadowColor = '#ff6a3d'; c.shadowBlur = 20; circ(c, 34, 4, 5, '#ffb347'); c.restore(); }
  c.restore();
  c.restore();
}
function drawZamboni(c, x, y, hpx, team, o) {
  const s = hpx / 100, t = G.time;
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s); LW = Math.max(1.25, 1.4 / s); FSC = s;
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (!o.noShadow) ell(c, 0, 0, 62, 8, 'rgba(0,0,0,.4)');
  // the lich at the wheel, behind the cowl
  c.save(); c.translate(14, -56); _drawAny(c, 'lich', 0, 0, 62, team, { noShadow: true, num: 0, wpn: 'staff', wang: -1.4 }); c.restore();
  // the machine
  ink(c, pRR(-58, -62, 112, 48, 6), team.color);
  ink(c, pRR(-58, -62, 40, 48, 4), tint(team.color, -.25));
  ink(c, pRR(-50, -86, 30, 26, 4), '#c9d8e2'); // the water tank
  inkLine(c, [[-56, -40], [50, -40]], team.light, 1.4);
  // the conditioner and wheels
  ink(c, pRR(-70, -24, 14, 20, 3), '#5a6a78');
  const rot = t * 4;
  for (const wx of [-36, 30]) { ink(c, pEl(wx, -10, 13, 13), '#22262a'); c.save(); c.translate(wx, -10); c.rotate(rot); inkLine(c, [[-8, 0], [8, 0]], '#8a96a0', .9); inkLine(c, [[0, -8], [0, 8]], '#8a96a0', .9); c.restore(); circ(c, wx, -10, 3, '#c9d0d6'); }
  // a chute of fresh ice behind it, and exhaust
  c.save(); c.globalAlpha *= .5; for (let i = 0; i < 6; i++) { const k = (t * 1.5 + i / 6) % 1; circ(c, -70 - k * 30, -14 + Math.sin(i) * 3, 3 + k * 4, '#e8f6ff'); } c.restore();
  if (o.charging) { c.save(); c.globalAlpha *= .5 + Math.sin(t * 10) * .3; c.fillStyle = '#7fd6ff'; c.fillRect(-48, -84, 22 * (.5 + Math.sin(t * 3) * .5), 22); c.restore(); }
  c.restore();
}
// behind the boss: auras, charge glow, phase pulse
function bossBack(c, e, x, y, hpx, hgt) {
  const t = A.t, a = entA(e.uid), D = ENEMIES[e.id];
  if (e.phase || sv(e, 'enraged')) { const g = c.createRadialGradient(x, y - hgt * .5, 10, x, y - hgt * .5, hgt * .9); g.addColorStop(0, `rgba(255,60,30,${.18 + Math.sin(t * 4) * .06})`); g.addColorStop(1, 'rgba(255,60,30,0)'); c.fillStyle = g; c.fillRect(x - hgt, y - hgt * 1.5, hgt * 2, hgt * 1.6); }
  if (sv(e, 'charge')) { const k = .5 + Math.sin(t * 8) * .5, g = c.createRadialGradient(x, y - hgt * .55, 8, x, y - hgt * .55, hgt * .8); g.addColorStop(0, `rgba(255,200,90,${.35 * k + .15})`); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.fillRect(x - hgt, y - hgt * 1.5, hgt * 2, hgt * 1.6); }
  const aura = D.aura;
  if (aura === 'embers') for (let i = 0; i < 14; i++) { const k = (t * .5 + i / 14) % 1, ex = x + Math.sin(i * 7.3 + t) * hgt * .4; circ(c, ex, y - k * hgt * 1.2, 2.5 * (1 - k) + .5, `rgba(255,${120 + i * 6},40,${1 - k})`); }
  if (aura === 'smoke') for (let i = 0; i < 8; i++) { const k = (t * .25 + i / 8) % 1; c.save(); c.globalAlpha = .18 * (1 - k); circ(c, x - 40 + Math.sin(i * 3 + t) * 30, y - hgt * (.3 + k * .9), 18 + k * 30, '#3a2a28'); c.restore(); }
  if (aura === 'wisps') for (let i = 0; i < 6; i++) { const a2 = t * 1.2 + i * 1.05; c.save(); c.globalAlpha = .45; c.strokeStyle = e.id === 'mirror' ? '#b494ff' : '#9ff6ff'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 12; k++) { const r = 40 + k * 3, aa = a2 + k * .12; const px = x + Math.cos(aa) * r, py = y - hgt * .55 + Math.sin(aa) * r * .55; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); c.restore(); }
}
function bossFront(c, e, x, y, hpx, hgt) {
  if (sv(e, 'charge')) { c.save(); c.globalAlpha = .7 + Math.sin(A.t * 8) * .3; txt(c, 'WINDING UP', x, y - hgt - 66, F_HUD(20), '#ffb347', 'center'); c.restore(); }
  if (sv(e, 'air')) { c.save(); c.globalAlpha = .35; ell(c, x, y + 70, 50, 9, '#000'); c.restore(); }
  if (e.pocket && e.pocket.length) { for (let i = 0; i < e.pocket.length; i++) { c.save(); c.translate(x + 50 + i * 6, y - hgt * .4 - i * 4); c.rotate(.2 + i * .1); rr(c, -9, -13, 18, 26, 3); c.fillStyle = '#efe3c8'; c.fill(); c.strokeStyle = '#b494ff'; c.lineWidth = 2; c.stroke(); c.restore(); } }
  if (e.id === 'cube' || e.id === 'cubelet') { const n = B.engulfed.length; if (n) txt(c, `${n} card${n > 1 ? 's' : ''} inside`, x, y + 48, F_HUD(15), '#7fe0b8', 'center'); }
}
