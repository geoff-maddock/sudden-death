/* ---------- the arena ---------- */
const SW = 960, SH = 460, FY = 214;
const fp = (u, v) => ({ x: 480 + u * lerp(330, 700, v), y: FY + v * (SH - FY) });
function seeded(n) { let s = Math.abs(n | 0) % 2147483646 + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const BGC = {};
function arenaBG(sport, act) {
  const key = sport + act; if (BGC[key]) return BGC[key];
  const cv = document.createElement('canvas'); cv.width = SW * 2; cv.height = SH * 2; const c = cv.getContext('2d'); c.scale(2, 2);
  const A = ACTS[act], rnd = seeded(act * 97 + sport.length * 13);
  // the back wall: stone courses
  c.fillStyle = A.wall; c.fillRect(0, 0, SW, FY + 4);
  for (let y = 0, row = 0; y < FY; y += 26, row++) for (let x = -((row % 2) * 30); x < SW; x += 60) {
    const sh = .82 + rnd() * .3; c.fillStyle = tint(A.wall, (sh - 1) * .9); c.fillRect(x + 1, y + 1, 58, 24);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 1, y + 22, 58, 3);
  }
  // an arch at the back, and the crowd's gallery
  c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.moveTo(400, FY); c.lineTo(400, 120); c.arc(480, 120, 80, Math.PI, 0); c.lineTo(560, FY); c.fill();
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 34, SW, 10);
  for (let x = 12; x < SW; x += 22) { const h = 10 + rnd() * 8; c.fillStyle = `rgba(0,0,0,${.35 + rnd() * .2})`; c.beginPath(); c.arc(x, 34 - h * .3, 6, Math.PI, 0); c.fill(); c.fillRect(x - 6, 34 - h * .3, 12, h * .3 + 2); }
  // pennants for the sport
  const pcol = { baseball: '#c94a3a', football: '#3f7a3a', hockey: '#3a6ab8', basketball: '#e0742a', golf: '#3d6a3a', bowling: '#9b3a7a', jousting: '#3a5a9a', curling: '#b83a3a', boxing: '#8a1a1a', soccer: '#5fa8c9' }[sport] || '#888';
  for (const px of [140, 300, 660, 820]) { c.fillStyle = pcol; c.beginPath(); c.moveTo(px - 18, 50); c.lineTo(px + 18, 50); c.lineTo(px, 92); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 2; c.stroke(); c.fillStyle = 'rgba(255,240,210,.85)'; c.font = '700 16px "Grenze Gotisch", Georgia, serif'; c.textAlign = 'center'; c.fillText(SPORT_NAME[sport][0], px, 70); }
  // the floor
  const floor = new Path2D(); const a = fp(-1, 0), b = fp(1, 0), d2 = fp(1, 1), e = fp(-1, 1); floor.moveTo(-50, FY); floor.lineTo(SW + 50, FY); floor.lineTo(SW + 50, SH); floor.lineTo(-50, SH); floor.closePath();
  const fcol = { baseball: '#4a3424', football: '#2f4a28', hockey: '#c9dbe6', basketball: '#8a5a30', golf: '#3a5a2a', bowling: '#9a7448', jousting: '#7a6040', curling: '#d2e2ec', boxing: '#3a2a26', soccer: '#dfe9ee' }[sport] || A.floor;
  c.fillStyle = fcol; c.fill(floor);
  const line = (pts, col = 'rgba(245,240,225,.75)', w = 3) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  const poly = (pts, col) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = col; c.fill(); };
  const oval = (u, v, ru, col, fill) => { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2; pts.push(fp(u + Math.cos(t) * ru, v + Math.sin(t) * ru * .55)); } if (fill) poly(pts, col); else line(pts, col, 3); };
  switch (sport) {
    case 'baseball': {
      for (let i = 0; i < 9; i++) poly([fp(-1 + i * .25, 0), fp(-1 + i * .25 + .125, 0), fp(-1 + i * .25 + .125, 1), fp(-1 + i * .25, 1)], 'rgba(60,90,40,.25)');
      poly([fp(0, .25), fp(.5, .55), fp(0, .95), fp(-.5, .55)], '#7a5234');
      line([fp(0, .95), fp(-1.1, .1)]); line([fp(0, .95), fp(1.1, .1)]);
      oval(0, .58, .08, '#8a5e3a', true);
      for (const [u, v] of [[0, .25], [.5, .55], [-.5, .55]]) { const p = fp(u, v); c.fillStyle = '#f2ead8'; c.fillRect(p.x - 7, p.y - 4, 14, 8); }
      const hp = fp(0, .95); c.fillStyle = '#f2ead8'; c.beginPath(); c.moveTo(hp.x - 9, hp.y - 4); c.lineTo(hp.x + 9, hp.y - 4); c.lineTo(hp.x + 9, hp.y); c.lineTo(hp.x, hp.y + 6); c.lineTo(hp.x - 9, hp.y); c.fill();
      break;
    }
    case 'football': {
      for (let i = 0; i < 10; i++) poly([fp(-1 + i * .2, 0), fp(-1 + i * .2 + .1, 0), fp(-1 + i * .2 + .1, 1), fp(-1 + i * .2, 1)], 'rgba(0,0,0,.08)');
      for (let i = -4; i <= 4; i++) line([fp(i * .22, 0), fp(i * .22, 1)], 'rgba(245,245,235,.8)', i === 0 ? 4 : 2.5);
      for (let i = -4; i <= 4; i++) { const p = fp(i * .22, .9); c.fillStyle = 'rgba(245,245,235,.8)'; c.font = '700 22px "Jersey 10", monospace'; c.textAlign = 'center'; c.fillText(String(50 - Math.abs(i) * 10), p.x, p.y); }
      for (let i = -12; i <= 12; i++) { const p0 = fp(i * .07, .35), p1 = fp(i * .07, .38); line([p0, p1], 'rgba(245,245,235,.6)', 2); }
      break;
    }
    case 'hockey': {
      const g = c.createLinearGradient(0, FY, 0, SH); g.addColorStop(0, '#8fa8b8'); g.addColorStop(1, '#dbe8ef'); c.fillStyle = g; c.fill(floor);
      for (let i = 0; i < 40; i++) { const u = rnd() * 2 - 1, v = rnd(); const p = fp(u, v); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x - 20, p.y); c.lineTo(p.x + 30, p.y + 2); c.stroke(); }
      line([fp(0, 0), fp(0, 1)], 'rgba(200,40,40,.85)', 6); line([fp(-.55, 0), fp(-.55, 1)], 'rgba(40,80,190,.8)', 6); line([fp(.55, 0), fp(.55, 1)], 'rgba(40,80,190,.8)', 6);
      oval(0, .55, .22, 'rgba(40,80,190,.8)'); circ(c, fp(0, .55).x, fp(0, .55).y, 5, 'rgba(40,80,190,.9)');
      oval(-.8, .7, .14, 'rgba(200,40,40,.7)'); oval(.8, .7, .14, 'rgba(200,40,40,.7)');
      break;
    }
    case 'basketball': {
      for (let i = 0; i < 26; i++) line([fp(-1.2 + i * .1, 0), fp(-1.2 + i * .1, 1)], 'rgba(60,30,10,.35)', 1.5);
      line([fp(0, 0), fp(0, 1)], 'rgba(245,240,225,.8)', 3); oval(0, .55, .16, 'rgba(245,240,225,.8)');
      poly([fp(-1.1, .25), fp(-.72, .25), fp(-.72, .85), fp(-1.1, .85)], 'rgba(150,40,30,.55)'); poly([fp(1.1, .25), fp(.72, .25), fp(.72, .85), fp(1.1, .85)], 'rgba(150,40,30,.55)');
      // a rusted hoop with a chain net on the back wall
      c.fillStyle = '#e8e0d0'; c.fillRect(440, 70, 80, 54); c.strokeStyle = '#a8321e'; c.lineWidth = 3; c.strokeRect(462, 92, 36, 26); c.strokeStyle = '#b8642a'; c.lineWidth = 4; c.beginPath(); c.ellipse(480, 130, 22, 6, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#9aa4ac'; c.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(480 + i * 6, 132); c.lineTo(480 + i * 4, 160); c.stroke(); }
      break;
    }
    case 'golf': {
      for (let i = 0; i < 8; i++) poly([fp(-1 + i * .25, 0), fp(-1 + i * .25 + .125, 0), fp(-1 + i * .25 + .125, 1), fp(-1 + i * .25, 1)], 'rgba(255,255,255,.04)');
      oval(0, .4, .3, '#4f7a3a', true); oval(.4, .8, .18, '#c9b27a', true);
      const h = fp(.05, .4); ell(c, h.x, h.y, 9, 4, '#111'); c.fillStyle = '#efe4cc'; c.fillRect(h.x - 1, h.y - 90, 3, 90); c.fillStyle = '#e0533a'; c.beginPath(); c.moveTo(h.x + 2, h.y - 90); c.lineTo(h.x + 40, h.y - 78); c.lineTo(h.x + 2, h.y - 66); c.fill();
      break;
    }
    case 'bowling': {
      for (let i = 0; i < 30; i++) line([fp(-1.2 + i * .085, 0), fp(-1.2 + i * .085, 1)], 'rgba(60,30,10,.3)', 1.2);
      poly([fp(-1.2, 0), fp(-.85, 0), fp(-.85, 1), fp(-1.2, 1)], 'rgba(30,20,15,.6)'); poly([fp(.85, 0), fp(1.2, 0), fp(1.2, 1), fp(.85, 1)], 'rgba(30,20,15,.6)');
      for (let i = 0; i < 7; i++) { const p = fp(-.3 + i * .1, .7); tri(c, [p.x, p.y - 8], [p.x - 6, p.y + 4], [p.x + 6, p.y + 4], 'rgba(40,20,10,.5)'); }
      // skull pins at the back
      for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) { const x = 480 + (i - r / 2) * 22, y = FY - 4 - (3 - r) * 7; ell(c, x, y, 7, 8, '#efe6cf'); circ(c, x - 2.5, y - 1, 1.6, '#1a1210'); circ(c, x + 2.5, y - 1, 1.6, '#1a1210'); }
      break;
    }
    case 'jousting': {
      for (let i = 0; i < 80; i++) { const p = fp(rnd() * 2 - 1, rnd()); circ(c, p.x, p.y, 1 + rnd() * 1.5, 'rgba(40,25,10,.25)'); }
      const r0 = fp(0, .12), r1 = fp(0, .6); c.fillStyle = '#6a4a2a'; for (let i = 0; i <= 6; i++) { const p = { x: lerp(r0.x, r1.x, i / 6), y: lerp(r0.y, r1.y, i / 6) }; c.fillRect(p.x - 3, p.y - 26 - i * 2, 6, 26 + i * 2); }
      line([{ x: r0.x, y: r0.y - 24 }, { x: r1.x, y: r1.y - 36 }], '#c9a24a', 7); line([{ x: r0.x, y: r0.y - 24 }, { x: r1.x, y: r1.y - 36 }], '#3a5a9a', 3);
      break;
    }
    case 'curling': {
      const g = c.createLinearGradient(0, FY, 0, SH); g.addColorStop(0, '#9fb8c8'); g.addColorStop(1, '#e3eef4'); c.fillStyle = g; c.fill(floor);
      for (const [r, col] of [[.36, '#3a6ab8'], [.24, '#f2f2f2'], [.12, '#c83a3a'], [.04, '#f2f2f2']]) oval(0, .5, r, col, true);
      line([fp(-1.2, .5), fp(1.2, .5)], 'rgba(40,40,60,.4)', 2); line([fp(0, 0), fp(0, 1)], 'rgba(40,40,60,.4)', 2);
      break;
    }
    case 'soccer': { // a snow pitch: grass showing through, the lines chalked blue, a goal at each end
      const g = c.createLinearGradient(0, FY, 0, SH); g.addColorStop(0, '#b9cdd8'); g.addColorStop(1, '#eef4f7'); c.fillStyle = g; c.fill(floor);
      for (let i = 0; i < 26; i++) { const p = fp(rnd() * 2 - 1, rnd()); ell(c, p.x, p.y, 18 + rnd() * 26, 4 + rnd() * 4, 'rgba(90,130,70,.22)'); }
      const ch = 'rgba(60,90,150,.75)';
      line([fp(0, 0), fp(0, 1)], ch, 4); oval(0, .5, .2, ch); circ(c, fp(0, .5).x, fp(0, .5).y, 5, ch);
      for (const s of [-1, 1]) {
        line([fp(s * .88, .22), fp(s * .64, .22), fp(s * .64, .78), fp(s * .88, .78)], ch, 3);
        const a = fp(s * .88, .38), b = fp(s * .88, .62);
        line([a, { x: a.x, y: a.y - 42 }, { x: b.x, y: b.y - 42 }, b], '#f4f4f0', 5);
      }
      break;
    }
    case 'boxing': {
      poly([fp(-.95, .08), fp(.95, .08), fp(.95, .98), fp(-.95, .98)], '#5a2a2a');
      poly([fp(-.85, .14), fp(.85, .14), fp(.85, .92), fp(-.85, .92)], '#c8b8a0');
      for (const [u, v] of [[-.85, .14], [.85, .14]]) { const p = fp(u, v); c.fillStyle = '#2a2a2e'; c.fillRect(p.x - 5, p.y - 70, 10, 70); }
      for (let k = 0; k < 3; k++) line([{ x: fp(-.85, .14).x, y: fp(-.85, .14).y - 20 - k * 18 }, { x: fp(.85, .14).x, y: fp(.85, .14).y - 20 - k * 18 }], ['#c83a3a', '#f2f2f2', '#3a6ab8'][k], 3);
      break;
    }
  }
  // grime, vignette and the meeting of wall and floor
  const v = c.createRadialGradient(480, 300, 120, 480, 300, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.72)'); c.fillStyle = v; c.fillRect(0, 0, SW, SH);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, FY - 2, SW, 6);
  // braziers
  for (const bx of [86, 874]) { c.fillStyle = '#2a201a'; c.fillRect(bx - 4, FY - 70, 8, 70); c.fillStyle = '#3a2c22'; c.beginPath(); c.moveTo(bx - 22, FY - 76); c.lineTo(bx + 22, FY - 76); c.lineTo(bx + 14, FY - 60); c.lineTo(bx - 14, FY - 60); c.fill(); }
  return (BGC[key] = cv);
}
function flames(c, act) {
  const col = ACTS[act].torch;
  for (const bx of [86, 874]) {
    const y = FY - 76, f = Math.sin(G.time * 13 + bx) * 3 + Math.sin(G.time * 7.3) * 2;
    const g = c.createRadialGradient(bx, y - 10, 2, bx, y - 10, 150); g.addColorStop(0, col + '55'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(bx - 150, y - 160, 300, 300);
    c.fillStyle = col; c.beginPath(); c.moveTo(bx - 16, y); c.quadraticCurveTo(bx - 14, y - 26 - f, bx + f * .4, y - 44 - f); c.quadraticCurveTo(bx + 12, y - 22, bx + 16, y); c.fill();
    c.fillStyle = '#fff3c8'; c.beginPath(); c.moveTo(bx - 7, y); c.quadraticCurveTo(bx - 5, y - 14, bx, y - 22 - f * .5); c.quadraticCurveTo(bx + 6, y - 12, bx + 7, y); c.fill();
  }
}
// a scoreboard hung on the back wall
function scoreboard(c, sport, lines) {
  c.save(); c.translate(480, 26);
  c.font = F_HUD(19); const hw = Math.max(128, c.measureText(SPORT_NAME[sport].toUpperCase() + ': ' + SPORTS[sport].rule).width / 2 + 16, c.measureText(lines).width / 2 + 16); A.sbw = hw;
  rr(c, -hw, -18, hw * 2, MOM[sport] ? 64 : 54, 4); c.fillStyle = '#16100c'; c.fill(); c.strokeStyle = '#5a4636'; c.lineWidth = 2; c.stroke();
  txt(c, SPORT_NAME[sport].toUpperCase() + ': ' + SPORTS[sport].rule, 0, 2, F_HUD(19), '#ffb347', 'center');
  txt(c, lines, 0, 26, F_HUD(19), '#efe4cc', 'center');
  c.restore();
}

