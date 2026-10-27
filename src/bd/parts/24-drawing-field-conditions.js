/* ================= drawing field conditions ================= */
function srand(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
const ZONE_COL = { smoke: '#b8b8b8', howl: '#ff5a5a', fissure: '#c8a36a', crater: '#8a6a3a', churn: '#8a5a34', bog: '#6a8a3a', rampart: '#a8a79e', tempest: '#bfe8ff', fire: '#ff8a2a', grass: '#7fc05a', fog: '#dfe6ee', eclipse: '#9a7aff', hands: '#e8e2cf', gas: '#9fe060', stones: '#a8a8a0', web: '#f0f0f8', bones: '#efe6cf', snow: '#e8f6ff' };
function drawZonesField(c) {
  for (const z of zones()) {
    const v = z.fx.vis, rnd = srand(z.seed), t = G.time, age = Math.min(1, (G.time - z.born) * 2);
    c.save(); c.globalAlpha = age;
    const inf = fp(0, 60), infR = 100 * FS;
    if (v === 'smoke' || v === 'gas') { for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, d = rnd() * infR * .95, p = { x: inf.x + Math.cos(a) * d + Math.sin(t * .6 + i) * 6, y: inf.y + Math.sin(a) * d * .8 }; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26); g.addColorStop(0, v === 'gas' ? 'rgba(150,220,90,.38)' : 'rgba(200,200,200,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(p.x - 26, p.y - 26, 52, 52); } }
    else if (v === 'fissure') { c.strokeStyle = 'rgba(20,12,8,.85)'; c.lineWidth = 2.2; for (let k = 0; k < 5; k++) { let a = rnd() * 6.28, p = { x: inf.x + Math.cos(a) * 20, y: inf.y + Math.sin(a) * 16 }; c.beginPath(); c.moveTo(p.x, p.y); for (let j = 0; j < 7; j++) { a += (rnd() - .5) * 1.2; p = { x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 12 }; c.lineTo(p.x, p.y); } c.stroke(); } }
    else if (v === 'crater' || v === 'churn' || v === 'stones') { const p = fp(z.x, z.y), r = z.r * FS; if (v === 'crater') { ell(c, p.x, p.y, r, r * .8, 'rgba(40,26,14,.7)'); c.strokeStyle = 'rgba(160,120,70,.8)'; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y, r, r * .8, 0, 0, 6.28); c.stroke(); } for (let i = 0; i < (v === 'crater' ? 8 : 16); i++) { const a = rnd() * 6.28, d = rnd() * r; const q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * .8 }; if (v === 'stones') { ink(c, pRR(q.x - 3, q.y - 7, 6, 8, 2), '#9a9a92', 0, true); } else ell(c, q.x, q.y, 3 + rnd() * 3, 2, v === 'crater' ? '#5a4028' : '#6a4424'); } }
    else if (v === 'bog') { for (let i = 0; i < 40; i++) { const a = (rnd() - .5) * 1.5, d = 170 + rnd() * 170, p = fp(d * Math.sin(a), d * Math.cos(a)); ell(c, p.x, p.y, 18 + rnd() * 16, 8 + rnd() * 6, 'rgba(70,80,30,.32)'); if (rnd() < .3) circ(c, p.x + Math.sin(t * 2 + i) * 2, p.y - 2, 1.6 + (t * 1.5 + i) % 1.5, 'rgba(160,190,90,.5)'); } }
    else if (v === 'grass') { c.strokeStyle = 'rgba(110,180,70,.8)'; c.lineWidth = 1.3; for (let i = 0; i < 90; i++) { const a = rnd() * 6.28, d = rnd() * infR * .95, p = { x: inf.x + Math.cos(a) * d, y: inf.y + Math.sin(a) * d * .8 }, sw = Math.sin(t * 2 + i) * 2; c.beginPath(); c.moveTo(p.x - 2, p.y); c.lineTo(p.x - 2 + sw, p.y - 8); c.moveTo(p.x, p.y); c.lineTo(p.x + sw, p.y - 11); c.moveTo(p.x + 2, p.y); c.lineTo(p.x + 2 + sw, p.y - 7); c.stroke(); } }
    else if (v === 'web') { c.strokeStyle = 'rgba(240,240,250,.45)'; c.lineWidth = 1; const h = fp(0, 0); for (let i = 0; i <= 10; i++) { const a = (-45 + i * 9) * DEG, p1 = fp(160 * Math.sin(a), 160 * Math.cos(a)), p2 = fp(390 * Math.sin(a), 390 * Math.cos(a)); c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke(); } for (let rr2 = 175; rr2 < 390; rr2 += 26) { c.beginPath(); for (let i = 0; i <= 10; i++) { const a = (-45 + i * 9) * DEG, sag = i % 1 === 0 ? 5 : 0, p = fp((rr2 - sag * (i % 2)) * Math.sin(a), (rr2 - sag * (i % 2)) * Math.cos(a)); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.stroke(); } }
    else if (v === 'hands') { for (let b = 0; b < 4; b++) for (let k = 1; k < 4; k++) { const A = BASE[b], B2 = BASE[(b + 1) % 4], p = fp(lerp(A.x, B2.x, k / 4) + (rnd() - .5) * 8, lerp(A.y, B2.y, k / 4) + (rnd() - .5) * 8), up = 3 + Math.sin(t * 3 + b * 3 + k) * 2; c.strokeStyle = '#e8e2cf'; c.lineWidth = 1.4; c.beginPath(); for (let f = -2; f <= 2; f++) { c.moveTo(p.x + f * 1.6, p.y); c.lineTo(p.x + f * 2.2, p.y - up - 3 + Math.abs(f)); } c.stroke(); ell(c, p.x, p.y + 1, 5, 1.8, 'rgba(30,20,14,.6)'); } }
    else if (v === 'bones') { for (let i = 0; i < 22; i++) { const a = rnd() * 6.28, d = rnd() * infR * .9, p = { x: inf.x + Math.cos(a) * d, y: inf.y + Math.sin(a) * d * .8 }, rot = rnd() * 3; c.save(); c.translate(p.x, p.y); c.rotate(rot); c.fillStyle = '#efe6cf'; c.fillRect(-4, -.8, 8, 1.6); circ(c, -4, -1, 1.3, '#efe6cf'); circ(c, -4, 1, 1.3, '#efe6cf'); circ(c, 4, -1, 1.3, '#efe6cf'); circ(c, 4, 1, 1.3, '#efe6cf'); c.restore(); } }
    else if (v === 'fire') { const p = fp(z.x, z.y), r = z.r * FS; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.3); g.addColorStop(0, 'rgba(255,150,40,.55)'); g.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = g; c.fillRect(p.x - r * 1.4, p.y - r * 1.4, r * 2.8, r * 2.8); ell(c, p.x, p.y, r * .9, r * .7, 'rgba(40,18,8,.45)'); for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, d = rnd() * r * .85, q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * .75 }, hgt = 7 + Math.sin(t * 13 + i * 2) * 3 + rnd() * 4; c.fillStyle = i % 3 ? '#ff9a2a' : '#ffd05a'; c.beginPath(); c.moveTo(q.x - 3, q.y); c.quadraticCurveTo(q.x - 2, q.y - hgt * .6, q.x + Math.sin(t * 9 + i), q.y - hgt); c.quadraticCurveTo(q.x + 2, q.y - hgt * .6, q.x + 3, q.y); c.fill(); } }
    else if (v === 'snow') { c.fillStyle = 'rgba(235,245,255,.14)'; c.fillRect(0, 0, W, H); for (let i = 0; i < 70; i++) { const x = (rnd() * W + t * 14 * (rnd() + .4)) % W, y = (rnd() * H + t * 40 * (rnd() + .5)) % H; circ(c, x, y, 1.2 + rnd(), 'rgba(255,255,255,.8)'); } }
    else if (v === 'fog') { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(220,230,240,.45)'); g.addColorStop(.6, 'rgba(220,230,240,.18)'); g.addColorStop(1, 'rgba(220,230,240,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    else if (v === 'eclipse') { c.fillStyle = 'rgba(4,2,12,.38)'; c.fillRect(0, 0, W, H); }
    else if (v === 'howl') { c.fillStyle = 'rgba(160,20,20,.1)'; c.fillRect(0, 0, W, H); }
    else if (v === 'tempest') { c.strokeStyle = 'rgba(200,235,255,.4)'; c.lineWidth = 1.4; for (let i = 0; i < 26; i++) { const x = rnd() * W, y = ((rnd() * H) + t * 160 * (.6 + rnd())) % H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - .5) * 6, y + 26); c.stroke(); } }
    else if (v === 'rampart') { c.strokeStyle = '#8a8a82'; c.lineWidth = 9; c.beginPath(); for (let a = -45; a <= 45; a += 1) { const r = fenceR(a * DEG) + 2, p = fp(r * Math.sin(a * DEG), r * Math.cos(a * DEG)); a === -45 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); } c.stroke(); c.strokeStyle = '#5a5a54'; c.lineWidth = 1.2; c.stroke(); }
    c.restore();
  }
}
// plate view: the conditions you can see from behind home
function drawZonesPlate(c) {
  for (const z of zones()) {
    const v = z.fx.vis, rnd = srand(z.seed), t = G.time;
    c.save();
    if (v === 'fog') { const g = c.createLinearGradient(0, GY - 120, 0, H); g.addColorStop(0, 'rgba(220,230,240,0)'); g.addColorStop(.35, 'rgba(220,230,240,.5)'); g.addColorStop(1, 'rgba(220,230,240,.2)'); c.fillStyle = g; c.fillRect(0, GY - 120, W, H); }
    else if (v === 'eclipse') { c.fillStyle = 'rgba(4,2,12,.42)'; c.fillRect(0, 0, W, H); }
    else if (v === 'howl') { c.fillStyle = 'rgba(160,20,20,.12)'; c.fillRect(0, 0, W, H); }
    else if (v === 'snow') { for (let i = 0; i < 90; i++) { const x = (rnd() * W + t * 18 * (rnd() + .4)) % W, y = (rnd() * H + t * 50 * (rnd() + .5)) % H; circ(c, x, y, 1.4 + rnd() * 1.4, 'rgba(255,255,255,.85)'); } }
    else if (v === 'tempest') { c.strokeStyle = 'rgba(200,235,255,.35)'; c.lineWidth = 1.4; for (let i = 0; i < 30; i++) { const x = rnd() * W, y = ((rnd() * H) + t * 220 * (.6 + rnd())) % H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - .5) * 6, y + 30); c.stroke(); } }
    else if (v === 'rampart') { c.fillStyle = '#5c5c56'; c.fillRect(0, GY - 30, W, 22); c.fillStyle = '#7a7a72'; for (let x = 0; x < W; x += 34) c.fillRect(x + 2, GY - 30, 30, 9); }
    else if (v === 'smoke' || v === 'gas' || v === 'grass' || v === 'fissure' || v === 'bones') { const col = v === 'gas' ? 'rgba(150,220,90,.28)' : v === 'smoke' ? 'rgba(190,190,190,.28)' : v === 'grass' ? 'rgba(110,180,70,.25)' : 'rgba(40,26,14,.25)'; for (let i = 0; i < 10; i++) { const x = rnd() * W, y = GY + 20 + rnd() * 90; ell(c, x + Math.sin(t * .5 + i) * 8, y, 60 + rnd() * 40, 12 + rnd() * 8, col); } }
    else if (v === 'web' || v === 'bog') { c.fillStyle = v === 'web' ? 'rgba(240,240,250,.12)' : 'rgba(70,80,30,.3)'; c.fillRect(0, GY, W, 40); }
    c.restore();
  }
}
// the list of active conditions, under the count panel
function drawConditions(c) {
  const zs = zones(); if (!zs.length) return;
  let y = 104;
  for (const z of zs) {
    const lbl = `${z.name.toUpperCase()} · ${z.turns}`; c.font = F_HUD(15); const tw = c.measureText(lbl).width + 16, x = W - 10 - tw;
    rr(c, x, y, tw, 19, 9); c.fillStyle = 'rgba(8,10,12,.8)'; c.fill(); c.strokeStyle = ZONE_COL[z.fx.vis] || '#c9c2ad'; c.lineWidth = 1; c.stroke();
    txt(c, lbl, x + 8, y + 14, F_HUD(15), ZONE_COL[z.fx.vis] || '#c9c2ad'); y += 23;
  }
}
// hurt/knocked-out marks over a figure on the field
function drawHealthMark(c, p, x, y) {
  if (p.ko > 0) { txt(c, 'z', x + 8, y - 44 - (G.time * 8 % 6), F_HUD(14), '#c9d8ff'); txt(c, 'Z', x + 13, y - 50 - (G.time * 8 % 6), F_HUD(17), '#c9d8ff'); return; }
  if (p.hp < 60) { const cx = x - 10, cy = y - 44; c.fillStyle = p.hp < 30 ? '#ff5a5a' : '#ff9a7a'; c.fillRect(cx - 1.2, cy - 3.5, 2.4, 7); c.fillRect(cx - 3.5, cy - 1.2, 7, 2.4); }
}
function healthBar(c, x, y, w, p) {
  const hp = p.hp ?? 100; rr(c, x, y, w, 5, 2.5); c.fillStyle = 'rgba(239,230,207,.12)'; c.fill();
  if (hp > 0) { rr(c, x, y, Math.max(3, w * hp / 100), 5, 2.5); c.fillStyle = hp > 60 ? '#e05a6a' : hp > 30 ? '#ff8a5a' : '#ff3a3a'; c.fill(); }
}
