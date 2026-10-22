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
