/* p7: sound, the arena scene, and the fight screen */
const SND = { on: true, ctx: null };
try { SND.on = localStorage.getItem('sd-sound') !== 'off'; } catch (e) { }
function actx() { if (!SND.ctx) { try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SND.on = false; } } if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); return SND.ctx; }
function tone(f, d, type = 'square', vol = .08, slide = 0, delay = 0) {
  if (!SND.on || LAB) return; const c = actx(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(sfxOut(c)); o.start(t); o.stop(t + d + .02);
}
function noise(d, vol = .15, fq = 1200, q = 1, delay = 0, sweep = 0) {
  if (!SND.on || LAB) return; const c = actx(); if (!c) return;
  const t = c.currentTime + delay, n = Math.max(1, (c.sampleRate * d) | 0), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = (R() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(fq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, fq + sweep), t + d);
  const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(sfxOut(c)); s.start(t);
}
const sfx = {
  card: () => noise(.06, .18, 2600, 2),
  hit: v => { noise(.1, .3 + v * .2, 300, 1.4); tone(90, .12, 'sine', .12, -30); },
  crunch: () => { noise(.16, .45, 280, 1); tone(60, .2, 'sawtooth', .09, -25); },
  block: () => noise(.08, .3, 1400, 3),
  hurt: () => { noise(.14, .4, 220, 1.2); tone(110, .2, 'sawtooth', .07, -50); },
  magic: () => { tone(520, .2, 'sine', .06, 400); tone(780, .25, 'sine', .04, 300, .06); },
  dice: () => { for (let i = 0; i < 5; i++) noise(.03, .2, 2000 + i * 300, 3, i * .07); },
  crit: () => { tone(880, .25, 'square', .06, 0); tone(1320, .4, 'square', .05, 0, .12); },
  whistle: () => { tone(2900, .35, 'sine', .07, 0); tone(3100, .35, 'sine', .04, 0); },
  horn: () => { for (const f of [233, 277, 349]) tone(f, 1, 'sawtooth', .045, 0); },
  crowd: (d = 1.4) => { noise(d, .14, 900, .4); noise(d, .09, 1700, .5, .1); },
  coin: () => { tone(1320, .08, 'square', .05); tone(1760, .12, 'square', .05, 0, .07); },
  bad: () => { tone(300, .2, 'sawtooth', .06, -120); tone(200, .3, 'sawtooth', .06, -80, .15); },
  die: () => { noise(.3, .3, 400, .8, 0, -300); },
};

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
  const pcol = { baseball: '#c94a3a', football: '#3f7a3a', hockey: '#3a6ab8', basketball: '#e0742a', golf: '#3d6a3a', bowling: '#9b3a7a', jousting: '#3a5a9a', curling: '#b83a3a', boxing: '#8a1a1a' }[sport] || '#888';
  for (const px of [140, 300, 660, 820]) { c.fillStyle = pcol; c.beginPath(); c.moveTo(px - 18, 50); c.lineTo(px + 18, 50); c.lineTo(px, 92); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 2; c.stroke(); c.fillStyle = 'rgba(255,240,210,.85)'; c.font = '700 16px "Grenze Gotisch", Georgia, serif'; c.textAlign = 'center'; c.fillText(SPORT_NAME[sport][0], px, 70); }
  // the floor
  const floor = new Path2D(); const a = fp(-1, 0), b = fp(1, 0), d2 = fp(1, 1), e = fp(-1, 1); floor.moveTo(-50, FY); floor.lineTo(SW + 50, FY); floor.lineTo(SW + 50, SH); floor.lineTo(-50, SH); floor.closePath();
  const fcol = { baseball: '#4a3424', football: '#2f4a28', hockey: '#c9dbe6', basketball: '#8a5a30', golf: '#3a5a2a', bowling: '#9a7448', jousting: '#7a6040', curling: '#d2e2ec', boxing: '#3a2a26' }[sport] || A.floor;
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

/* ---------- drawing a scene: used by the title card and the fight ---------- */
const A = { ent: {}, pops: [], banner: null, dice: null, shake: 0, t: 0, swirl: [] };
const entA = k => A.ent[k] || (A.ent[k] = { lunge: -9, hit: -9, die: -9, born: -9, x: null, say: null, glow: -9 });
const PARTY_POS = [{ x: 318, y: 392 }, { x: 210, y: 352 }, { x: 118, y: 412 }];
function hpxOf(kind, boss, elite) { if (kind === 'wyrm') return 205; if (kind === 'zamboni') return 175; if (kind === 'orb') return 170; if (kind === 'cube') return 205; if (kind === 'mimic') return 130; if (kind === 'slime') return 96; return boss ? 150 : elite ? 128 : 110; }
function enemyLayout(list) {
  const n = list.length, out = [];
  const xs = n === 1 ? [710] : n === 2 ? [630, 820] : n === 3 ? [575, 720, 865] : n === 4 ? [560, 665, 770, 875] : [540, 625, 710, 795, 880];
  list.forEach((e, i) => out.push({ x: xs[i], y: n === 1 ? 404 : i % 2 ? 360 : 402 }));
  return out;
}
function figHeight(kind, hpx) { if (kind === 'mirror') return hpx * .95 * ((KIND[RUN && RUN.party ? RUN.party[0].kind : 'goblin'] || KIND.goblin).h); if (BESPOKE.has(kind)) return kind === 'wyrm' ? hpx * .9 : kind === 'zamboni' ? hpx * .95 : kind === 'orb' ? hpx * 1.15 : kind === 'cube' ? hpx * .95 : kind === 'mimic' ? hpx * .8 : hpx * .6; return hpx * ((KIND[kind] || KIND.goblin).h) * .95; }
/* Creature sprites. Drawing a creature is most of a frame's cost, and an idle creature only changes slowly
   (breathing, capes, wings). So each idle entity is drawn into its own offscreen canvas at most SPR_FPS times a
   second and blitted every frame. Anything in motion (lunging, a pose, breathing fire, charging) draws live. */
const SPR = new Map(), SPR_FPS = 20;
let SPR_ON = true;
function drawWho(c, kind, x, y, hpx, team, o) {
  const id = o.sid;
  if (!SPR_ON || !id || !o.idle || BESPOKE.has(kind) || o.pose || o.run || o.lift) { if (id) SPR.delete(id); drawAny(c, kind, x, y, hpx, team, o); return; }
  const m = c.getTransform(), sc = Math.max(1, Math.min(3, Math.hypot(m.a, m.b)));
  const W = Math.ceil(hpx * 2.6), H = Math.ceil(hpx * 2.1), ox = Math.round(W / 2), oy = Math.round(H * .86);
  const key = [kind, team.color, team.light, team.short, o.num, hpx, o.flip ? 1 : 0, o.wpn, o.disguised ? 1 : 0, o.crown ? 1 : 0, o.seed || 0, o.stone ? 1 : 0, sc.toFixed(2)].join('|');
  const bucket = Math.floor(G.time * SPR_FPS);
  let s = SPR.get(id);
  if (!s || s.key !== key) { const cv2 = s && s.cv || document.createElement('canvas'); cv2.width = Math.ceil(W * sc); cv2.height = Math.ceil(H * sc); s = { cv: cv2, key, bucket: -1 }; SPR.set(id, s); }
  if (s.bucket !== bucket) {
    const g = s.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s.cv.width, s.cv.height); g.setTransform(sc, 0, 0, sc, 0, 0);
    drawAny(g, kind, ox, oy, hpx, team, Object.assign({}, o, { alpha: null }));
    s.bucket = bucket;
  }
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha;
  // unrotated (nearly always): blit pixel-for-pixel on whole device pixels, so sprites stay as crisp as a live draw
  if (!m.b && !m.c) { const px = Math.round(m.a * (x - ox) + m.e), py = Math.round(m.d * (y - oy) + m.f); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(s.cv, px, py); }
  else c.drawImage(s.cv, x - ox, y - oy, W, H);
  c.restore();
}
function sprClear() { SPR.clear(); }
function drawStatusPills(c, st, x, y) {
  const keys = Object.keys(st).filter(k => st[k] && ST[k] && ST[k].n && k !== 'foamfinger'); if (!keys.length) return;
  c.font = F_HUD(15); let w = 0; const items = keys.map(k => { const s = `${ST[k].n.split(' ')[0]} ${st[k]}`; const tw = c.measureText(s).width + 8; w += tw + 3; return [k, s, tw]; });
  let cx = x - w / 2;
  for (const [k, s, tw] of items) { rr(c, cx, y, tw, 16, 3); c.fillStyle = 'rgba(16,11,8,.85)'; c.fill(); c.strokeStyle = ST[k].col; c.lineWidth = 1; c.stroke(); txt(c, s, cx + tw / 2, y + 13, F_HUD(15), ST[k].col, 'center'); cx += tw + 3; }
}
function intentGlyph(c, kind, x, y, col) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = '#140f0c'; c.lineWidth = 2;
  if (kind === 'atk') { c.beginPath(); c.moveTo(-9, 9); c.lineTo(7, -7); c.lineTo(10, -10); c.lineTo(9, -5); c.lineTo(-7, 11); c.closePath(); c.stroke(); c.fill(); c.fillRect(-11, 5, 7, 3); }
  else if (kind === 'def') { c.beginPath(); c.moveTo(0, -11); c.lineTo(10, -7); c.quadraticCurveTo(10, 6, 0, 12); c.quadraticCurveTo(-10, 6, -10, -7); c.closePath(); c.stroke(); c.fill(); }
  else if (kind === 'buff') { c.beginPath(); c.moveTo(0, -11); c.lineTo(10, 1); c.lineTo(4, 1); c.lineTo(4, 10); c.lineTo(-4, 10); c.lineTo(-4, 1); c.lineTo(-10, 1); c.closePath(); c.stroke(); c.fill(); }
  else if (kind === 'debuff') { c.lineWidth = 3; c.strokeStyle = col; c.beginPath(); for (let t = 0; t < 14; t += .3) { const r = t * .8; c.lineTo(Math.cos(t) * r, Math.sin(t) * r); } c.stroke(); }
  else if (kind === 'flee') { c.beginPath(); c.moveTo(-8, -6); c.lineTo(4, -6); c.lineTo(4, -11); c.lineTo(12, 0); c.lineTo(4, 11); c.lineTo(4, 6); c.lineTo(-8, 6); c.closePath(); c.stroke(); c.fill(); }
  else { txt(c, '?', 0, 8, F_DSP(24), col, 'center'); }
  c.restore();
}
function drawIntent(c, e, x, y) {
  if (sv(e, 'stun')) { txt(c, 'Stunned', x, y, F_HUD(20), '#ffe17a', 'center'); return; }
  const I = intentInfo(e); if (!I.kinds.length) return;
  const main = I.kinds[0], col = { atk: '#ff7a5a', def: '#8fc2e8', buff: '#ffd166', debuff: '#b494ff', flee: '#ffd166', unknown: '#b8a68c' }[main];
  let gx = x - (main === 'atk' ? 18 : 0) - (I.kinds.length > 1 ? 12 : 0);
  intentGlyph(c, main, gx, y - 8, col);
  if (main === 'atk') txt(c, I.hits > 1 ? `${I.dmg}×${I.hits}` : `${I.dmg}`, gx + 16, y, F_HUD(24), '#fff0e0');
  const rest = [...new Set(I.kinds.slice(1))];
  rest.forEach((k, i) => intentGlyph(c, k, x + 30 + i * 22 + (main === 'atk' ? 14 : 0), y - 8, { atk: '#ff7a5a', def: '#8fc2e8', buff: '#ffd166', debuff: '#b494ff', flee: '#ffd166' }[k] || '#ccc'));
  c.save(); c.globalAlpha = .85; txt(c, I.n, x, y + 16, F_TXT(13, 500), '#e9dcc0', 'center'); c.restore();
}

/* the fight scene */
function drawFight(c, dt) {
  const act = RUN.act, team = clubTeam();
  c.drawImage(arenaBG(B.sport, act), 0, 0, SW, SH);
  flames(c, act);
  drawSky(c);
  drawCrowd(c);
  drawFieldState(c);
  scoreboard(c, B.sport, sportLine());
  drawMomentum(c);
  if (A.scoreFlash && A.t - A.scoreFlash.t < .9) { const k = A.t - A.scoreFlash.t; c.save(); c.globalAlpha = 1 - k / .9; rr(c, 480 - (A.sbw || 128), 8, (A.sbw || 128) * 2, MOM[B.sport] ? 64 : 54, 4); c.strokeStyle = A.scoreFlash.side ? '#ff6a5a' : '#7fe08a'; c.lineWidth = 4; c.stroke(); c.restore(); }
  if (B.sport === 'football') { txt(c, `Ball on the ${B.yards < 50 ? 'own ' + B.yards : B.yards === 50 ? '50' : 'their ' + (100 - B.yards)}${B.yards >= 75 ? ': RED ZONE' : B.yards <= 10 ? ': PINNED DEEP' : B.yards >= 60 ? ': field goal range' : ''}`, 480, 92, F_HUD(16), B.yards >= 75 ? '#ff8a6a' : '#b8a68c', 'center'); }
  if (B.sport === 'baseball' && B.sc) { const cx = 480 + (A.sbw || 128) + 32, cy = 36; rr(c, cx - 26, cy - 26, 52, 54, 4); c.fillStyle = '#16100c'; c.fill(); for (const [i, dx, dy] of [[0, 14, 0], [1, 0, -14], [2, -14, 0]]) { c.save(); c.translate(cx + dx, cy + dy); c.rotate(Math.PI / 4); c.fillStyle = B.sc.bases[i] ? '#ffd166' : 'rgba(255,255,255,.15)'; c.fillRect(-5, -5, 10, 10); c.restore(); } c.save(); c.translate(cx, cy + 14); c.rotate(Math.PI / 4); c.fillStyle = '#efe4cc'; c.fillRect(-4, -4, 8, 8); c.restore(); }
  const sh = A.shake > 0 ? (R() - .5) * A.shake * 14 : 0; A.shake = Math.max(0, A.shake - dt * 2.5);
  c.save(); c.translate(sh, sh * .4);
  // party, back to front
  const party = RUN.party.map((p, i) => ({ p, i, pos: PARTY_POS[i] })).sort((a, b) => a.pos.y - b.pos.y);
  const now = A.t;
  // enemies and party sorted together by depth
  const list = B.enemies.filter(e => !(e.dead && now - entA(e.uid).die > .9) && !(e.fled && now - entA(e.uid).die > .9));
  const lay = enemyLayout(list);
  UI.hit = [];
  const draws = [];
  for (const { p, i, pos } of party) draws.push({ y: pos.y, f: () => {
    const a = entA('p:' + p.kind), lt = now - a.lunge, ht = now - a.hit;
    const lk = lt < .45 ? Math.sin(Math.min(1, lt / .45) * Math.PI) : 0;
    const x = pos.x + lk * (a.lungeAtk ? 90 : 20), y = pos.y;
    const wang = lt < .45 ? lerp(-2.2, .9, Math.min(1, lt / .32)) : -1.15 + Math.sin(now * 2 + i) * .06;
    if (now - a.glow < .7) { const g = c.createRadialGradient(x, y - 50, 4, x, y - 50, 70); g.addColorStop(0, `rgba(180,148,255,${.45 * (1 - (now - a.glow) / .7)})`); g.addColorStop(1, 'rgba(180,148,255,0)'); c.fillStyle = g; c.fillRect(x - 70, y - 120, 140, 140); }
    c.save(); if (ht < .3) { c.translate(-Math.sin(ht * 40) * 5, 0); }
    drawWho(c, p.kind, x, y, 108, team, { num: p.num, wpn: KIND_WPN[p.kind], wang, alpha: RUN.hp <= 0 ? .4 : null, sid: 'p:' + p.kind, idle: lt >= .45 });
    if (ht < .18) { c.globalCompositeOperation = 'source-atop'; }
    c.restore();
  } });
  list.forEach((e, i) => {
    const L = lay[i], a = entA(e.uid);
    if (a.x == null) a.x = L.x; a.x = lerp(a.x, L.x, Math.min(1, dt * 6)); a.y = L.y;
    const boss = isBoss(e), elite = !!ENEMIES[e.id].elite, hpx = hpxOf(e.kind, boss, elite);
    const hgt = figHeight(e.kind, hpx);
    UI.hit.push({ e, idx: B.enemies.indexOf(e), x0: a.x - 62, x1: a.x + 62, y0: L.y - hgt - 10, y1: L.y + 40 });
    draws.push({ y: L.y, f: () => {
      const lt = now - a.lunge, ht = now - a.hit, dt2 = now - a.die, bt = now - a.born;
      const lk = lt < .45 ? Math.sin(Math.min(1, lt / .45) * Math.PI) : 0;
      let x = a.x - lk * (a.lungeAtk ? (a.far ? 300 : 80) : 15), y = L.y;
      const et = now - (a.enter || -9); if (et < 1) y -= (1 - Math.min(1, et / .8) ** 2) * 320 * (et < .8 ? 1 : 0);
      if (et >= .8 && !a.landed && a.enter) { a.landed = 1; A.shake = 1; A.vfx.push({ k: 'shock', x: a.x, y: L.y, t0: A.t, life: .7, col: '#ffb347', r: 160 }); sfx.crunch(); }
      if (sv(e, 'air')) y -= 70 + Math.sin(now * 3) * 8;
      if (isBoss(e) || ENEMIES[e.id].aura) bossBack(c, e, x, y, hpx, hgt);
      let alpha = 1; if (e.dead || e.fled) alpha = Math.max(0, 1 - dt2 / .8); if (bt < .6) alpha = Math.min(alpha, bt / .6);
      if (e.fled) x += dt2 * 500;
      const sel = UI.sel >= 0 && needsTarget(B.hand[UI.sel] || {}) && UI.hover === e && !e.dead;
      if (sel || (UI.sel >= 0 && UI.kbTarget === e && !e.dead)) { c.save(); c.strokeStyle = '#ffb347'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 2, 54, 13, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = .18; c.fillStyle = '#ffb347'; c.fill(); c.restore(); }
      c.save(); if (ht < .3) c.translate(Math.sin(ht * 50) * 6, 0);
      if (e.dead && !e.fled) { c.translate(x, y); c.rotate(Math.min(1, dt2 / .5) * -.9 * (e.kind === 'orb' || e.kind === 'cube' ? 0 : 1)); c.translate(-x, -y + dt2 * 30); }
      const wang = lt < .45 ? lerp(-2.2, .9, Math.min(1, lt / .32)) : -1.15 + Math.sin(now * 2 + i * 1.3) * .06;
      drawWho(c, e.kind, x, y, hpx, e.team, { num: e.num, wpn: ENEMIES[e.id].wpn || KIND_WPN[e.kind], wang, flip: true, alpha, disguised: e.disguised, seed: i * 2, mouth: e.intent === 'breath' || (now - a.lunge < .8 && e.hist[e.hist.length - 1] === 'breath'), charging: !!sv(e, 'charge'), crown: ENEMIES[e.id].crown, sid: e.uid, idle: lt >= .45 && !sv(e, 'charge') && e.intent !== 'breath' && !(now - a.lunge < .8) });
      if (isBoss(e) || ENEMIES[e.id].aura) bossFront(c, e, x, y, hpx, hgt);
      c.restore();
      if (ht < .14 && !e.dead) { c.save(); c.globalAlpha = .5 * (1 - ht / .14); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - hgt * .5, 46, hgt * .55, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      if (e.dead || e.fled) return;
      // health, block, statuses, intent
      const bw = 112, bx = x - bw / 2, by = y + 14;
      rr(c, bx, by, bw, 12, 3); c.fillStyle = '#2a1712'; c.fill();
      rr(c, bx, by, Math.max(0, bw * e.hp / e.max), 12, 3); c.fillStyle = sv(e, 'psn') >= e.hp ? '#8ad65a' : '#d8432a'; c.fill();
      const pv = UI.preview && UI.preview.per[e.uid];
      if (pv > 0) { const left = Math.max(0, e.hp - pv), x1 = bx + bw * left / e.max, w1 = bw * (e.hp - left) / e.max; c.save(); c.globalAlpha = .6 + Math.sin(A.t * 8) * .25; c.fillStyle = '#fff2c8'; c.fillRect(x1, by, w1, 12); c.restore(); if (left <= 0) { txt(c, 'LETHAL', x, by - 6, F_HUD(18), '#ffd166', 'center'); } }
      txt(c, `${e.hp}/${e.max}`, x, by + 11, F_HUD(15), '#fff', 'center');
      if (e.sp && !e.dead) { const lab = SPORT_PERKS[e.sp].n.toUpperCase(); c.save(); c.font = F_HUD(14); const w = c.measureText(lab).width + 12; rr(c, x - w / 2, by - 22, w, 16, 3); c.fillStyle = '#3a2a06'; c.fill(); c.strokeStyle = '#ffd166'; c.lineWidth = 1; c.stroke(); txt(c, lab, x, by - 9, F_HUD(14), '#ffd166', 'center'); c.restore(); }
      if (e.block) { c.save(); c.translate(bx - 6, by + 6); c.fillStyle = '#8fc2e8'; c.beginPath(); c.moveTo(0, -11); c.lineTo(10, -7); c.quadraticCurveTo(10, 6, 0, 12); c.quadraticCurveTo(-10, 6, -10, -7); c.closePath(); c.fill(); txt(c, e.block, 0, 5, F_HUD(16), '#0c1a26', 'center'); c.restore(); }
      if (B.sport === 'baseball') for (let k = 0; k < 3; k++) circ(c, bx + bw + 8 + k * 9, by + 6, 3.4, (B.hits[e.uid] || 0) > k ? '#ffe17a' : 'rgba(255,255,255,.18)');
      drawStatusPills(c, e.st, x, by + 16);
      if (B.phase !== 'done') drawIntent(c, e, x, y - hgt - 18 + (e.kind === 'orb' ? -10 : 0));
      if (a.say && now - a.say.t < 1.5) { const k = now - a.say.t; c.save(); c.globalAlpha = Math.min(1, (1.5 - k) * 3); c.font = F_TXT(15); const w = c.measureText(a.say.text).width + 16; rr(c, x - w / 2, y - hgt - 62 - k * 8, w, 22, 5); c.fillStyle = 'rgba(239,228,204,.95)'; c.fill(); txt(c, a.say.text, x, y - hgt - 46 - k * 8, F_TXT(15), '#21160f', 'center'); c.restore(); }
    } });
  });
  draws.sort((a, b) => a.y - b.y).forEach(d => d.f());
  drawPartyFire(c);
  drawSportPops(c);
  drawVfx(c);
  drawWhy(c);
  // engulfed cards shown inside the cube
  c.restore();
  drawPops(c);
  drawBanner(c); drawDice(c);
}
function drawPops(c) {
  A.pops = A.pops.filter(p => A.t - p.t0 < p.life);
  for (const p of A.pops) {
    const k = A.t - p.t0; if (k < 0) continue;
    c.save(); c.globalAlpha = Math.min(1, (p.life - k) * 2.5);
    const s = p.size || 28, y = p.y - k * 46;
    c.font = F_HUD(s); c.lineWidth = 4; c.strokeStyle = '#140f0c'; c.textAlign = 'center'; c.strokeText(p.t, p.x, y); c.fillStyle = p.col; c.fillText(p.t, p.x, y);
    c.restore();
  }
}
function drawBanner(c) {
  const b = A.banner; if (!b) return; const k = A.t - b.t0; if (k > b.life) { A.banner = null; return; } if (k < 0) return;
  const al = Math.min(1, k * 5, (b.life - k) * 3);
  c.save(); c.globalAlpha = al; const y = b.small ? 150 : 190;
  c.fillStyle = 'rgba(14,9,7,.82)'; c.fillRect(0, y - 48, SW, b.sub ? 86 : 64);
  c.fillStyle = '#ffb347'; c.fillRect(0, y - 48, SW, 2); c.fillRect(0, y + (b.sub ? 36 : 14), SW, 2);
  txt(c, b.t, 480 + (1 - Math.min(1, k * 4)) * -60, y, F_DSP(b.small ? 38 : 50), '#efe4cc', 'center');
  if (b.sub) { let fs = 17; c.font = F_TXT(fs, 500); while (c.measureText(b.sub).width > 900 && fs > 12) { fs--; c.font = F_TXT(fs, 500); } txt(c, b.sub, 480, y + 26, F_TXT(fs, 500), '#b8a68c', 'center'); }
  c.restore();
}
function drawDice(c) {
  const d = A.dice; if (!d) return; const k = A.t - d.t0; if (k > 2.1) { A.dice = null; return; } if (k < 0) return;
  const rolling = k < .65, val = rolling ? 1 + ((k * 30) | 0) % 20 : d.r;
  c.save(); c.translate(480, 140 + (rolling ? Math.abs(Math.sin(k * 14)) * -18 : 0)); c.globalAlpha = Math.min(1, (2.1 - k) * 3); c.rotate(rolling ? k * 9 : 0);
  const pts = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push([Math.cos(a) * 42, Math.sin(a) * 42]); }
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = d.crit && !rolling ? '#ffd166' : '#efe4cc'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#21160f'; c.stroke();
  c.beginPath(); c.moveTo(0, -42); c.lineTo(-36, 21); c.lineTo(36, 21); c.closePath(); c.lineWidth = 1.5; c.stroke();
  c.rotate(rolling ? -k * 9 : 0); txt(c, String(val), 0, 13, F_HUD(34), '#21160f', 'center');
  c.restore();
  if (!rolling) { c.save(); c.globalAlpha = Math.min(1, (2.1 - k) * 3); txt(c, `${d.label ? d.label + ': ' : ''}${d.r}${d.bonus ? ' + ' + d.bonus : ''} vs ${d.dc}  ${d.crit ? 'CRITICAL' : d.r === 1 ? 'FUMBLE' : d.ok ? 'HIT' : 'MISS'}`, 480, 210, F_HUD(24), d.ok ? '#7fe08a' : '#ff8a7a', 'center'); c.restore(); }
}
// turn engine events into animation
function consumeFx() {
  if (!B) return;
  let delay = 0;
  const partyPt = () => ({ x: 240, y: 236 });
  const ep = uid => { const a = A.ent[uid]; const e = B.enemies.find(x => x.uid === uid); if (!a || !e) return { x: 720, y: 220 }; return { x: a.x, y: a.y - figHeight(e.kind, hpxOf(e.kind, isBoss(e), ENEMIES[e.id].elite)) - 4 }; };
  while (B.fx.length) {
    const f = B.fx.shift(), t0 = A.t + delay;
    switch (f.k) {
      case 'play': { const who = RUN.party.find(p => p.kind === f.kind) || RUN.party[0]; const a = entA('p:' + who.kind); if (f.atk) { a.lunge = A.t; a.lungeAtk = 1; sfx.card(); } else { a.glow = A.t; sfx.magic(); } break; }
      case 'hit': { const a = entA(f.e); a.hit = t0 + .08; const p = ep(f.e); if (f.amt > 0) A.pops.push({ x: p.x + (R() - .5) * 30, y: p.y, t: String(f.amt), col: f.col || '#ffe0d0', t0: t0 + .08, life: 1.1, size: f.amt >= 20 ? 40 : 30 }); else if (f.blk) A.pops.push({ x: p.x, y: p.y, t: 'Blocked', col: '#8fc2e8', t0: t0 + .08, life: .9, size: 22 }); setTimeout(() => f.blk && !f.amt ? sfx.block() : sfx.hit(Math.min(1, f.amt / 20)), delay * 1000 + 80); delay += .09; break; }
      case 'die': entA(f.e).die = A.t + delay; if (!f.quiet) setTimeout(sfx.die, delay * 1000); else A.vfx.push({ k: 'shock', x: entA(f.e).x || 700, y: entA(f.e).y || 400, t0: A.t, life: .7, col: '#7fe0b8', r: 180 }); break;
      case 'dice': A.dice = { r: f.r, bonus: f.bonus, dc: f.dc, ok: f.ok, crit: f.crit, label: f.label, t0: A.t }; sfx.dice(); if (f.crit) setTimeout(sfx.crit, 650); break;
      case 'lunge': { const a = entA(f.e); a.lunge = A.t; a.lungeAtk = f.atk; a.far = f.far; break; }
      case 'vfx': spawnVfx(f.v, f.e); break;
      case 'phase': { const a = entA(f.e); a.phaseT = A.t; A.shake = 1.2; A.vfx.push({ k: 'flash', t0: A.t, life: .5, col: '#ffffff' }); A.vfx.push({ k: 'shock', x: a.x || 720, y: a.y || 400, t0: A.t, life: .9, col: '#ff6a3d', r: 260 }); A.banner = { t: f.t, sub: f.sub, t0: A.t + .25, life: 2.2 }; sfx.horn(); setTimeout(() => sfx.crunch(), 120); break; }
      case 'hitP': { if (f.amt > 0) { A.shake = Math.min(1, .3 + f.amt / 30); for (const p of RUN.party) entA('p:' + p.kind).hit = A.t; sfx.hurt(); } else sfx.block(); break; }
      case 'num': { const p = f.p ? partyPt() : ep(f.e); A.pops.push({ x: p.x + (f.p ? (R() - .5) * 60 : 0), y: p.y + (f.small ? 20 : 0), t: f.t, col: f.col, t0: A.t + delay * .5, life: 1.2, size: f.small ? 20 : 26 }); break; }
      case 'say': { const a = entA(f.e); a.say = { text: f.t, t: A.t }; break; }
      case 'banner': A.banner = { t: f.t, sub: f.sub, t0: A.t + delay, life: f.small ? 1.3 : 1.9, small: f.small }; if (/Touchdown|Strike!|on fire/i.test(f.t)) sfx.crowd(); else sfx.whistle(); break;
      case 'pst': { const p = partyPt(); const s = ST[f.st]; if (s && s.n) A.pops.push({ x: p.x, y: p.y + 30, t: `${s.n} ${f.n > 0 ? '+' : ''}${f.n}`, col: s.col, t0: A.t + delay, life: 1.2, size: 20 }); break; }
      case 'addcard': { const p = partyPt(); A.pops.push({ x: p.x, y: p.y + 50, t: `+${f.n} ${CARDS[f.id].n}`, col: '#b8a68c', t0: A.t + delay, life: 1.4, size: 20 }); break; }
      case 'spawn': entA(f.e).born = A.t; break;
      case 'flee': entA(f.e).die = A.t; break;
      case 'score': A.scoreFlash = { t: A.t, side: f.side }; if (f.n) { A.crowd = { t: A.t, side: f.side }; if (!f.side) sfx.coin(); else noise(.5, .06, 400, .5); } if (B.sport === 'hockey' && !f.side && f.what === 'goal') A.lamp = A.t; if (!f.side && f.n) sportPop(f); break;
      case 'sky': A.skyT = { what: f.what, t: A.t }; tone(f.what === 'moon' ? 660 : 990, .6, 'sine', .04, 0); tone(f.what === 'moon' ? 990 : 1320, .8, 'sine', .03, 0, .15); break;
      case 'mom': case 'save': case 'swish': case 'bases': sportFx(f); break;
      case 'bat': case 'drive': case 'strike': case 'bell': sportPop(f); break;
      case 'say2': A.pops.push({ x: 480, y: 250, t: f.t, col: '#ffd166', t0: A.t + delay, life: 1.1, size: 30 }); delay += .1; break;
    }
  }
}

/* ---------- the fight screen ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
// keep the stage's backing store matched to its on-screen size. Layout shifts mid-fight (a scrollbar appearing,
// the hand or log growing, a zoom) change the displayed size without a resize event, and a stretched canvas looks blurry.
function fitStage(force) {
  if (!cv.clientWidth) return; // hidden: measure when it is shown
  const d = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * cv.clientWidth / SW));
  if (!force && cv._d && Math.abs(cv._d - d) < .01) return;
  cv.width = Math.round(SW * d); cv.height = Math.round(SH * d); cv._d = d;
}
if (window.ResizeObserver) new ResizeObserver(() => { if (UI.view === 'fight') fitStage(); }).observe(cv);
function intentDesc(e) {
  const m = ENEMIES[e.id].moves[e.intent]; if (!m || e.disguised) return 'Just sitting there. Being a chest.';
  return (e.plan || planOps(e)).map(op => {
    switch (op[0]) {
      case 'a': return `attack for ${enemyHitDmg(e, op[1])}${(op[2] || 1) > 1 ? ` × ${op[2]}` : ''}${op[3] === 'drain' ? ', healing what gets through' : ''}`;
      case 'b': return `gain ${op[1]} Block`; case 'ba': return `give every ally ${op[1]} Block`;
      case 's': return `gain ${op[2]} ${ST[op[1]].n}`; case 'sa': return `give every ally ${op[2]} ${ST[op[1]].n}`;
      case 'p': return `give you ${op[2]} ${ST[op[1]].n}`; case 'add': return `shuffle ${op[2]} ${CARDS[op[1]].n} into your ${op[3] === 'draw' ? 'draw' : 'discard'} pile`;
      case 'steal': return `steal up to ${op[1]} gold`; case 'flee': return 'run for home with your gold'; case 'summon': return 'call a Bone Lineman onto the field';
      case 'engulf': return `swallow ${op[1]} of your cards until it falls`; case 'heal': return `heal ${op[1]}`;
    }
    return '';
  }).filter(Boolean).join(', then ');
}
function enemyTip(e) {
  const D = ENEMIES[e.id];
  const sts = Object.keys(e.st).filter(k => e.st[k] && ST[k] && ST[k].n).map(k => `<br><b>${ST[k].n} ${e.st[k]}</b>: ${ST[k].desc}`).join('');
  return `<span class="t">${esc(e.disguised ? 'A Treasure Chest?' : e.n)}</span>${e.sp ? `<b style="color:#ffd166">${SPORT_PERKS[e.sp].n}:</b> ${esc(SPORT_PERKS[e.sp].desc)}<br><br>` : ''}${e.disguised ? 'Looks like a perfectly ordinary chest.' : esc(D.flav || '')}<br><br><b>Next:</b> ${esc(ENEMIES[e.id].moves[e.intent] ? (e.disguised ? '???' : ENEMIES[e.id].moves[e.intent].n) : '')}. It will ${esc(intentDesc(e))}.${sts}`;
}
function renderFightHUD() {
  if (!B) return;
  const P = B.P;
  const sts = Object.keys(P.st).filter(k => P.st[k] && ST[k] && ST[k].n);
  $('meBox').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center"><div class="energy${B.energy ? '' : ' out'}" data-tip="${esc('<span class="t">Stamina</span>Pays for cards. Refills every turn.')}" tabindex="0">${B.energy}<small>/${B.maxE}</small></div>
    <div style="flex:1;display:grid;gap:6px"><div class="hpbar" aria-label="HP ${RUN.hp} of ${RUN.maxhp}"><i style="width:${100 * RUN.hp / RUN.maxhp}%"></i><span>${RUN.hp}/${RUN.maxhp}</span></div>
    ${P.block ? `<span class="blockchip" data-tip="${esc('<span class="t">Block</span>Soaks up damage before your HP. Drains away at the start of your turn' + (B.sport === 'hockey' ? ' (on black ice, half of it slides over)' : '') + '.')}" tabindex="0">Block ${P.block}</span>` : ''}</div></div>
    <div class="pst">${sts.map(k => `<span class="chip" style="color:${ST[k].col};border-color:${ST[k].col}" tabindex="0" data-tip="${esc(`<span class="t">${ST[k].n} ${P.st[k]}</span>${ST[k].desc}`)}">${ST[k].n} ${P.st[k]}</span>`).join('')}</div>`;
  const busy = B.phase !== 'player' || !!B.over || UI.busy;
  $('ctlBox').innerHTML = `
    <div class="piles"><button class="pile" id="pDraw" title="Draw pile">Draw ${B.draw.length}</button><button class="pile" id="pDisc" title="Discard pile">Discard ${B.discard.length}</button>${B.exhaust.length ? `<button class="pile" id="pEx" title="Exhausted">Out ${B.exhaust.length}</button>` : ''}</div>
    <button class="btn endturn" id="bEnd" ${busy ? 'disabled' : ''}>${B.phase === 'enemy' ? 'Their turn' : 'End turn'}</button>
    <span class="hint" style="font-size:13px">Keys: <kbd>1</kbd>–<kbd>0</kbd> cards, <kbd>E</kbd> end turn</span>`;
  $('bEnd').onclick = () => doEndTurn();
  $('pDraw').onclick = () => showDeck(B.draw, `Draw pile (${B.draw.length}), in no particular order`);
  $('pDisc').onclick = () => showDeck(B.discard, `Discard pile (${B.discard.length})`);
  if ($('pEx')) $('pEx').onclick = () => showDeck(B.exhaust, `Exhausted this fight (${B.exhaust.length})`);
  renderHand();
  renderRunBar();
}
function renderHand() {
  const h = $('hand'), n = B.hand.length;
  h.classList.toggle('wait', B.phase !== 'player' || !!B.over || UI.busy);
  h.innerHTML = B.hand.map((c, i) => {
    const rot = n > 1 ? (i - (n - 1) / 2) * Math.min(4, 22 / n) : 0, lift = Math.abs(i - (n - 1) / 2) * 3;
    return cardHTML(c, { live: true, tgt: UI.sel === i ? UI.kbTarget : null, key: i < 10 ? String((i + 1) % 10) : '', cls: (UI.sel === i ? 'sel ' : '') + (canPlay(c) ? '' : 'no'), attrs: `style="transform:rotate(${rot}deg) translateY(${lift}px)" data-i="${i}"` });
  }).join('');
  h.classList.toggle('pickdisc', !!UI.disc);
  h.querySelectorAll('.card').forEach(el => {
    const i = +el.dataset.i;
    el.onclick = () => { if (UI.dragged) { UI.dragged = false; return; } selectCard(i); };
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(i); } };
    el.onmouseenter = () => { UI.hoverCard = i; updatePreview(); };
    el.onmouseleave = () => { if (UI.hoverCard === i) UI.hoverCard = -1; updatePreview(); };
    el.onpointerdown = ev => startDrag(ev, el, i);
  });
  $('thint').hidden = UI.sel < 0 && !UI.disc;
  if (UI.disc) $('thint').textContent = `${def(B.hand[UI.disc.i]).n}: choose a card to discard (Esc cancels)`;
  else if (UI.sel >= 0) $('thint').textContent = `Pick a target for ${def(B.hand[UI.sel]).n} (click an enemy, or arrows and Enter)`;
  // nothing left to play: nudge the End turn button
  const any = B.phase === 'player' && !B.over && B.hand.some(c => canPlay(c) && !['junk', 'curse'].includes(def(c).type));
  const be = $('bEnd'); if (be) be.classList.toggle('nudge', B.phase === 'player' && !B.over && !UI.busy && !any);
  updatePreview();
}
function updatePreview() {
  UI.why = null;
  if (!B || B.phase !== 'player') { UI.preview = null; return; }
  const i = UI.sel >= 0 ? UI.sel : UI.disc ? UI.disc.i : UI.hoverCard;
  const c = i != null && i >= 0 ? B.hand[i] : null;
  if (!c || !canPlay(c)) { UI.preview = null; return; }
  const t = UI.kbTarget && !UI.kbTarget.dead ? UI.kbTarget : UI.hover || alive()[0];
  UI.preview = estDamage(c, t);
  const w = dmgWhy(c, t); if (w) UI.why = Object.assign(w, { card: def(c).n, tgt: t.n });
}
function startDrag(ev, el, i) {
  if (ev.button !== 0 || B.phase !== 'player' || B.over || UI.busy || UI.disc) return;
  const c = B.hand[i]; if (!c || !canPlay(c)) return;
  const x0 = ev.clientX, y0 = ev.clientY, base = el.style.transform; let moved = false;
  const mv = e => {
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!moved && Math.hypot(dx, dy) < 12) return;
    if (!moved) { moved = true; el.classList.add('drag'); UI.sel = i; if (!UI.kbTarget || UI.kbTarget.dead) UI.kbTarget = alive()[0]; }
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * SW / r.width, y = (e.clientY - r.top) * SH / r.height;
    const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
    if (h) { UI.hover = h.e; UI.kbTarget = h.e; }
    updatePreview();
  };
  const up = e => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    if (!moved) return;
    UI.dragged = true; el.classList.remove('drag'); el.style.transform = base;
    const r = cv.getBoundingClientRect();
    const overStage = e.clientY < r.bottom + 10;
    if (!overStage) { UI.sel = -1; renderHand(); return; }
    const x = (e.clientX - r.left) * SW / r.width, y = (e.clientY - r.top) * SH / r.height;
    const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
    UI.sel = i;
    if (needsTarget(c) && alive().length > 1 && !h) { renderHand(); return; } // dropped on open ice: keep it selected
    playSelected(h ? h.e : UI.kbTarget || alive()[0]);
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
function selectCard(i) {
  if (!B || B.phase !== 'player' || B.over || UI.busy) return;
  if (UI.disc) { if (i === UI.disc.i) { UI.disc = null; renderHand(); return; } const D = UI.disc; UI.disc = null; const keep = B.hand[i]; UI.sel = -1; playCard(D.i, D.ti, { disc: keep.uid }); afterAction(); return; }
  const c = B.hand[i]; if (!c) return;
  if (!canPlay(c)) { sfx.bad(); const el = $('hand').querySelector(`[data-i="${i}"]`); if (el) { el.animate([{ transform: el.style.transform + ' translateX(-6px)' }, { transform: el.style.transform + ' translateX(6px)' }, { transform: el.style.transform }], { duration: 180 }); } return; }
  if (UI.sel === i) { playSelected(UI.kbTarget); return; }
  const tgts = alive();
  if (needsTarget(c) && tgts.length > 1) { UI.sel = i; UI.kbTarget = UI.kbTarget && !UI.kbTarget.dead ? UI.kbTarget : tgts[0]; renderHand(); return; }
  UI.sel = i; playSelected(tgts[0]);
}
function playSelected(e) {
  const i = UI.sel; UI.sel = -1;
  const ti = e ? B.enemies.indexOf(e) : null;
  const c = B.hand[i];
  if (c && def(c).disc && B.hand.length > 2) { UI.disc = { i, ti }; renderHand(); return; } // choose what to discard first
  playCard(i, ti);
  afterAction();
}
function drinkTonic(slot) {
  if (!B || B.phase !== 'player' || B.over || UI.busy) return;
  const id = RUN.tonics[slot]; if (!id) return;
  const needsT = TONICS[id].fx.some(o => o[0] === 'd' && o[3] !== 'all');
  useTonic(slot, needsT ? B.enemies.indexOf(UI.kbTarget || alive()[0]) : null);
  hideTip(); afterAction();
}
function afterAction() {
  consumeFx(); renderFightHUD();
  if (B.over) { UI.busy = true; setTimeout(() => finishFight(), 1100); }
}
function doEndTurn() {
  if (!B || B.phase !== 'player' || B.over || UI.busy) return;
  UI.sel = -1; UI.busy = true;
  const steps = endTurn(); consumeFx(); renderFightHUD();
  let i = 0;
  const next = () => {
    if (i >= steps.length || B.over) { UI.busy = false; consumeFx(); renderFightHUD(); if (B.over) { UI.busy = true; setTimeout(finishFight, 1100); } else sfx.card(); return; }
    const acted = steps[i++]();
    consumeFx(); renderFightHUD();
    setTimeout(next, acted ? 620 / UI.speed : 40);
  };
  setTimeout(next, 300);
}
cv.addEventListener('mousemove', ev => {
  if (UI.view !== 'fight' || !B) return;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * SW / r.width, y = (ev.clientY - r.top) * SH / r.height;
  const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
  UI.hover = h ? h.e : null;
  cv.style.cursor = h && UI.sel >= 0 ? 'crosshair' : h ? 'help' : 'default';
  if (h) { showTip(enemyTip(h.e), ev.clientX, ev.clientY); if (UI.sel >= 0 && UI.kbTarget !== h.e) { UI.kbTarget = h.e; renderHand(); } } else hideTip();
  updatePreview();
});
cv.addEventListener('mouseleave', () => { UI.hover = null; hideTip(); });
cv.addEventListener('click', ev => {
  if (UI.view !== 'fight' || !B) return;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * SW / r.width, y = (ev.clientY - r.top) * SH / r.height;
  const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
  if (UI.sel >= 0) { if (h) playSelected(h.e); else { UI.sel = -1; renderHand(); } }
});
document.addEventListener('keydown', ev => {
  if (UI.view !== 'fight' || !B || !$('modal').hidden || UI.paused || ev.target.closest('input,textarea')) return;
  if (/^[0-9]$/.test(ev.key)) { const i = (+ev.key + 9) % 10; if (i < B.hand.length) selectCard(i); ev.preventDefault(); return; }
  if (ev.key === 'e' || ev.key === 'E') { doEndTurn(); return; }
  if (UI.sel >= 0) {
    const al = alive(); let j = al.indexOf(UI.kbTarget);
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { j = (j + (ev.key === 'ArrowRight' ? 1 : -1) + al.length) % al.length; UI.kbTarget = al[j]; renderHand(); ev.preventDefault(); }
    else if (ev.key === 'Enter') { playSelected(UI.kbTarget); ev.preventDefault(); }
    else if (ev.key === 'Escape') { UI.sel = -1; renderHand(); }
  }
  if (UI.disc && ev.key === 'Escape') { UI.disc = null; renderHand();
  }
});
