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
/* the effects layer */
const PARTY_C = () => ({ x: 220, y: 330 });
function spawnVfx(v, uid) {
  const a = entA(uid), e = B.enemies.find(o => o.uid === uid); if (!e) return;
  const hpx = hpxOf(e.kind, isBoss(e), ENEMIES[e.id].elite), hgt = figHeight(e.kind, hpx);
  const from = { x: (a.x || 720), y: (a.y || 400) - hgt * .62 - (sv(e, 'air') ? 70 : 0) };
  const t0 = A.t + .12;
  switch (v) {
    case 'beam': for (let i = 0; i < 3; i++) A.vfx.push({ k: 'beam', x0: from.x + (i - 1) * 14, y0: from.y - 8, x1: PARTY_POS[i].x, y1: PARTY_POS[i].y - 50, t0: t0 + i * .08, life: .55, col: ['#ff4a6a', '#7fd6ff', '#ffd166'][i] }); sfx.magic(); break;
    case 'breath': A.vfx.push({ k: 'breath', x0: from.x - (e.kind === 'wyrm' ? 150 : 20), y0: from.y - (e.kind === 'wyrm' ? 20 : 0), t0, life: 1.2 }); A.vfx.push({ k: 'flash', t0: t0 + .3, life: .8, col: '#ff7a2a', a: .25 }); for (let i = 0; i < 4; i++) setTimeout(() => noise(.4, .25, 500, .6, 0, -300), i * 200); break;
    case 'inhale': A.vfx.push({ k: 'inhale', x: from.x - 70, y: from.y - 70, t0, life: 1.1 }); noise(1, .12, 300, .5, 0, 900); break;
    case 'orb': A.vfx.push({ k: 'orb', x0: from.x, y0: from.y, x1: PARTY_C().x, y1: PARTY_C().y - 40, t0, life: .5, col: e.id === 'cube' || e.id === 'cubelet' ? '#7fe0b8' : '#ff9a2a' }); break;
    case 'ice': A.vfx.push({ k: 'ice', t0, life: 1, y: 380 }); A.vfx.push({ k: 'flash', t0: t0 + .1, life: .4, col: '#e8f6ff', a: .35 }); noise(.8, .2, 3000, .5, 0, -1500); break;
    case 'rain': A.vfx.push({ k: 'rain', t0, life: 2.2 }); noise(2, .1, 4000, .3); break;
    case 'shock': A.vfx.push({ k: 'shock', x: a.x || 720, y: a.y || 400, t0, life: .7, col: '#ffb347', r: 220 }); A.shake = Math.max(A.shake, .7); break;
    case 'cards': for (let i = 0; i < 3; i++) A.vfx.push({ k: 'card', x0: PARTY_C().x + (i - 1) * 30, y0: PARTY_C().y, x1: from.x, y1: from.y + 20, t0: t0 + i * .1, life: .7 }); break;
    case 'summon': A.vfx.push({ k: 'portal', x: (a.x || 720) - 140, y: 400, t0, life: 1 }); A.vfx.push({ k: 'portal', x: (a.x || 720) + 120, y: 380, t0: t0 + .15, life: 1 }); break;
    case 'chomp': A.vfx.push({ k: 'shock', x: a.x || 720, y: (a.y || 400) - 60, t0, life: .5, col: '#ff4a6a', r: 120 }); sfx.crunch(); break;
    case 'wail': A.vfx.push({ k: 'wail', x: from.x, y: from.y, t0, life: 1 }); tone(880, .8, 'sine', .05, -500); tone(660, .9, 'sine', .04, -400, .1); break;
    case 'wing': A.vfx.push({ k: 'shock', x: a.x || 720, y: a.y || 400, t0, life: .8, col: '#e8e0d0', r: 260 }); noise(.6, .25, 300, .6, 0, 400); break;
    case 'mirror': A.vfx.push({ k: 'mirror', x: from.x, y: from.y, t0, life: .8 }); A.vfx.push({ k: 'orb', x0: from.x, y0: from.y, x1: PARTY_C().x, y1: PARTY_C().y - 40, t0: t0 + .2, life: .4, col: '#b494ff' }); break;
  }
}
function drawVfx(c) {
  A.vfx = A.vfx.filter(v => A.t - v.t0 < v.life);
  for (const v of A.vfx) {
    const k = (A.t - v.t0) / v.life; if (k < 0) continue;
    c.save();
    switch (v.k) {
      case 'flash': c.globalAlpha = (v.a || .7) * (1 - k); c.fillStyle = v.col; c.fillRect(0, 0, SW, SH); break;
      case 'shock': c.globalAlpha = 1 - k; c.strokeStyle = v.col; c.lineWidth = 8 * (1 - k) + 1; c.beginPath(); c.ellipse(v.x, v.y, v.r * k, v.r * k * .3, 0, 0, Math.PI * 2); c.stroke(); break;
      case 'beam': { const w = Math.sin(Math.min(1, k * 2) * Math.PI); c.globalAlpha = w; c.lineCap = 'round'; c.strokeStyle = v.col; c.lineWidth = 9 * w; c.shadowColor = v.col; c.shadowBlur = 18; c.beginPath(); c.moveTo(v.x0, v.y0); c.lineTo(v.x1, v.y1); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 3 * w; c.stroke(); circ(c, v.x1, v.y1, 14 * w, v.col); break; }
      case 'orb': { const e2 = k * k * (3 - 2 * k), px = lerp(v.x0, v.x1, e2), py = lerp(v.y0, v.y1, e2) - Math.sin(e2 * Math.PI) * 80; c.shadowColor = v.col; c.shadowBlur = 20; circ(c, px, py, 11, v.col); circ(c, px, py, 5, '#fff'); for (let i = 1; i < 6; i++) { const kk = Math.max(0, e2 - i * .04); c.globalAlpha = .5 - i * .08; circ(c, lerp(v.x0, v.x1, kk), lerp(v.y0, v.y1, kk) - Math.sin(kk * Math.PI) * 80, 9 - i, v.col); } break; }
      case 'breath': { for (let i = 0; i < 60; i++) { const r = ((i * 37) % 100) / 100, sp = (k * 1.4 + r) % 1, ang = Math.PI + (r - .5) * .5 + Math.sin(A.t * 8 + i) * .05; const d = sp * 560; const px = v.x0 + Math.cos(ang) * d, py = v.y0 + Math.sin(ang) * d * .3 + sp * 120; c.globalAlpha = (1 - sp) * Math.min(1, (1 - k) * 3); circ(c, px, py, 8 + sp * 26, sp < .3 ? '#fff1a0' : sp < .6 ? '#ffb347' : '#e0533a'); } break; }
      case 'inhale': { for (let i = 0; i < 24; i++) { const r = ((i * 53) % 100) / 100, sp = 1 - ((k * 1.5 + r) % 1); const ang = r * Math.PI * 2; c.globalAlpha = .6 * (1 - sp); circ(c, v.x + Math.cos(ang) * sp * 220, v.y + Math.sin(ang) * sp * 120, 3, '#ffd166'); } break; }
      case 'ice': { for (let i = 0; i < 70; i++) { const r = ((i * 29) % 100) / 100, sp = (k + r * .5) % 1; c.globalAlpha = (1 - k) * .9; circ(c, SW * (1 - sp) - 40 + r * 60, v.y + (r - .5) * 80 - sp * 40 * Math.sin(r * 9), 2 + r * 4, '#e8f6ff'); } break; }
      case 'rain': { c.globalAlpha = Math.min(1, (1 - k) * 2) * .7; c.strokeStyle = '#9fc8e8'; c.lineWidth = 1.5; for (let i = 0; i < 120; i++) { const r = ((i * 61) % 100) / 100, x = (i * 97) % SW, yy = ((A.t * 900 + r * SH * 2) % (SH + 40)) - 20; c.beginPath(); c.moveTo(x, yy); c.lineTo(x - 6, yy + 18); c.stroke(); } c.globalAlpha *= .4; c.fillStyle = '#1a2a3a'; c.fillRect(0, 0, SW, SH); break; }
      case 'card': { const e2 = k * k, px = lerp(v.x0, v.x1, e2), py = lerp(v.y0, v.y1, e2) - Math.sin(k * Math.PI) * 120; c.translate(px, py); c.rotate(k * 8); c.globalAlpha = 1 - k * .5; rr(c, -12, -17, 24, 34, 3); c.fillStyle = '#efe3c8'; c.fill(); c.strokeStyle = '#b8402c'; c.lineWidth = 2; c.stroke(); break; }
      case 'portal': { const w = Math.sin(k * Math.PI); c.globalAlpha = w; c.strokeStyle = '#ffd166'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(v.x, v.y, 50 * w - i * 10, 12 * w - i * 3, 0, 0, Math.PI * 2); c.stroke(); } break; }
      case 'wail': { for (let i = 0; i < 4; i++) { const kk = (k * 1.3 - i * .15); if (kk < 0 || kk > 1) continue; c.globalAlpha = (1 - kk) * .7; c.strokeStyle = '#9ff6ff'; c.lineWidth = 3; c.beginPath(); c.arc(v.x, v.y, 30 + kk * 420, Math.PI * .75, Math.PI * 1.25); c.stroke(); } break; }
      case 'ballarc': { const x = lerp(v.x0, v.x1, k), y = lerp(v.y0, v.y1, k) - Math.sin(k * Math.PI) * 140; circ(c, x, y, 9, '#e0742a'); c.strokeStyle = '#2a1405'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.moveTo(x - 9, y); c.lineTo(x + 9, y); c.stroke(); if (k > .9) { c.globalAlpha = (1 - k) * 10; txt(c, v.three ? 'THREE!' : 'SWISH', v.x1, v.y1 - 28, F_HUD(22), '#ffd166', 'center'); } break; }
      case 'mirror': { c.globalAlpha = (1 - k); c.strokeStyle = '#d2bcff'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { const a2 = i * Math.PI / 3 + k * 2; c.beginPath(); c.moveTo(v.x, v.y); c.lineTo(v.x + Math.cos(a2) * 90 * k, v.y + Math.sin(a2) * 90 * k); c.stroke(); } break; }
    }
    c.restore();
  }
}
