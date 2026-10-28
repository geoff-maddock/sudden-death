/* p7c: the game as you can see it — the crowd, momentum, and each sport's state drawn on the field */
const BASE_UV = [[.5, .55], [0, .25], [-.5, .55], [0, .95]]; // 1st, 2nd, 3rd, home (index 3 and -1)
const baseXY = i => { const [u, v] = BASE_UV[i < 0 ? 3 : Math.min(3, i)]; return fp(u, v); };
A.runs = [];
function sportFx(f) {
  switch (f.k) {
    case 'mom': A.momT = A.t; A.momUp = f.up; if (f.tier > 0) sfx.crowd(1.2); else if (f.tier < 0) noise(.8, .08, 300, .4); break;
    case 'save': { const a = entA(f.e); A.vfx.push({ k: 'shock', x: a.x || 700, y: (a.y || 400) - 40, t0: A.t, life: .5, col: '#9fd2ff', r: 90 }); sfx.block(); break; }
    case 'swish': A.vfx.push({ k: 'ballarc', x0: 300, y0: 280, x1: 480, y1: 128, t0: A.t, life: .7, three: f.n >= 3 }); setTimeout(() => noise(.12, .2, 3000, 2), 600); break;
    case 'bases': {
      // animate each runner along the base paths: before[i] -> i+n; the batter from home
      const moves = [];
      f.before.forEach((on, i) => { if (on) moves.push([i, f.walk ? (f.before.slice(0, i).every(Boolean) ? i + 1 : i) : i + f.n]); });
      if (f.batter) moves.push([-1, f.n - 1]);
      A.runs.push({ t0: A.t + .15, moves, life: .9 });
      break;
    }
  }
}
// the gallery: heads that bob, jump when you score, slump when they do
function drawCrowd(c) {
  const team = clubTeam(), foe = (B.enemies[0] && B.enemies[0].team) || ACTS[RUN.act].team;
  const t = A.t, cr = A.crowd, k = cr ? A.t - cr.t : 9, tier = B.sc ? momTier() : 0;
  const share = .5 + tier * .15; // more of your colours in the stands when you lead
  for (let i = 0, x = 12; x < SW; x += 22, i++) {
    const mine = ((i * 37) % 100) / 100 < share;
    let y = 30 + Math.sin(t * 2 + i) * (Math.abs(tier) ? 1.5 : .6);
    if (k < 1.1) { const happy = (cr.side === 0) === mine; y += happy ? -Math.abs(Math.sin((k * 9) + i * .5)) * 7 * (1 - k / 1.1) : 2 * (1 - k / 1.1); }
    c.fillStyle = mine ? tint(team.color, -.35) : tint(foe.color, -.4);
    c.beginPath(); c.arc(x, y, 5.5, 0, Math.PI * 2); c.fill();
    if (k < 1.1 && (cr.side === 0) === mine && i % 3 === 0) { c.strokeStyle = mine ? team.color : foe.color; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 4, y + 2); c.lineTo(x - 8, y - 9); c.moveTo(x + 4, y + 2); c.lineTo(x + 8, y - 9); c.stroke(); }
  }
}
// the tug of war under the scoreboard
function drawMomentum(c) {
  if (!B.sc || !MOM[B.sport]) return;
  const hw = (A.sbw || 128) - 14, y = 58, T = MOM[B.sport], m = clamp(momMargin() / T[1], -1, 1);
  A.momX = A.momX == null ? m : lerp(A.momX, m, .08);
  rr(c, 480 - hw, y, hw * 2, 6, 3); c.fillStyle = '#2a1d16'; c.fill();
  const tier = momTier(), col = tier > 0 ? clubTeam().color : tier < 0 ? '#e0533a' : '#8a7a6a';
  c.fillStyle = col; const w = A.momX * hw; c.fillRect(Math.min(480, 480 + w), y, Math.abs(w), 6);
  c.fillStyle = '#efe4cc'; c.fillRect(479, y - 2, 2, 10);
  for (const s of [-1, 1]) for (const f of [T[0] / T[1], 1]) { c.fillStyle = 'rgba(239,228,204,.35)'; c.fillRect(480 + s * f * hw - (s > 0 ? 1 : 0), y - 1, 1, 8); }
  if (tier) { const p = A.momT && A.t - A.momT < 1 ? 1 + Math.sin((A.t - A.momT) * 20) * .15 : 1; c.save(); c.translate(480 - (A.sbw || 128) - 10, 40); c.scale(p, p); rr(c, -c.measureText ? -150 : -150, -14, 150, 22, 3); c.restore(); c.save(); c.translate(480 - (A.sbw || 128) - 12, 40); c.scale(p, p); c.font = F_HUD(17); const w2 = c.measureText(MOM_NAME[tier].toUpperCase()).width + 14; rr(c, -w2, -15, w2, 22, 3); c.fillStyle = '#16100c'; c.fill(); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke(); txt(c, MOM_NAME[tier].toUpperCase(), -7, 1, F_HUD(17), col, 'right'); c.restore(); }
}
// each sport's state, on the floor itself
function drawFieldState(c) {
  if (!B.sc) return;
  const team = clubTeam(), t = A.t;
  if (B.sport === 'baseball') {
    const anim = A.runs.length && A.runs.some(r => A.t - r.t0 < r.life);
    A.runs = A.runs.filter(r => A.t - r.t0 < r.life + .1);
    const token = (p, glow) => { c.save(); if (glow) { c.shadowColor = team.color; c.shadowBlur = 12; } ell(c, p.x, p.y + 2, 9, 3, 'rgba(0,0,0,.4)'); circ(c, p.x, p.y - 8, 7, team.color); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y - 8, 7, 0, Math.PI * 2); c.stroke(); circ(c, p.x, p.y - 18, 4.5, team.light); c.restore(); };
    if (anim) for (const r of A.runs) {
      const k = clamp((A.t - r.t0) / r.life, 0, 1);
      for (const [from, to] of r.moves) {
        const path = []; for (let b = from; b <= Math.min(3, to); b++) path.push(baseXY(b)); if (to >= 3 && path[path.length - 1] !== baseXY(3)) path.push(baseXY(3));
        if (path.length < 2) { token(path[0] || baseXY(from)); continue; }
        const seg = k * (path.length - 1), i = Math.min(path.length - 2, Math.floor(seg)), f = seg - i;
        token({ x: lerp(path[i].x, path[i + 1].x, f), y: lerp(path[i].y, path[i + 1].y, f) - Math.abs(Math.sin(f * Math.PI)) * 6 }, true);
      }
    } else B.sc.bases.forEach((on, i) => { if (on) token(baseXY(i)); });
    return;
  }
  if (B.sport === 'football') {
    const u = y => ((y - 50) / 10) * .22, lineAt = (yd, col, w) => { const a = fp(u(yd), .08), b = fp(u(yd), 1); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); };
    A.ydx = A.ydx == null ? B.yards : lerp(A.ydx, B.yards, .1);
    if (B.yards >= 75) { c.save(); c.globalAlpha = .16 + Math.sin(t * 3) * .05; c.fillStyle = '#e0533a'; const q = [fp(u(75), .08), fp(1.2, .08), fp(1.2, 1), fp(u(75), 1)]; c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.fill(); c.restore(); }
    lineAt(Math.min(99, (Math.floor(B.yards / 25) + 1) * 25), 'rgba(255,209,102,.85)', 4);
    lineAt(A.ydx, 'rgba(90,150,255,.9)', 4);
    const p = fp(u(A.ydx), .55); c.save(); c.translate(p.x, p.y); c.rotate(-.3); ell(c, 0, 0, 9, 5.5, '#8a4a22'); c.strokeStyle = '#f2ead8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke(); c.restore();
    return;
  }
  if (B.sport === 'hockey') {
    const on = A.lamp && A.t - A.lamp < 1.6;
    c.save(); c.translate(480, 116); circ(c, 0, 0, 9, on ? '#ff3a2a' : '#3a1a14');
    if (on) { c.globalAlpha = .5 + Math.sin(A.t * 30) * .4; const g = c.createRadialGradient(0, 0, 4, 0, 0, 120); g.addColorStop(0, 'rgba(255,60,40,.6)'); g.addColorStop(1, 'rgba(255,60,40,0)'); c.fillStyle = g; c.fillRect(-120, -120, 240, 240); }
    c.restore(); return;
  }
  if (B.sport === 'curling') {
    for (let i = 0; i < B.sc.stones; i++) { const p = fp(Math.cos(i * 2.1) * .12, .5 + Math.sin(i * 2.1) * .06); ell(c, p.x, p.y + 3, 14, 5, '#5a5a62'); ell(c, p.x, p.y, 14, 5, team.color); c.fillStyle = '#333'; c.fillRect(p.x - 2, p.y - 6, 4, 6); }
    return;
  }
  if (B.sport === 'soccer') { // the ball works up the pitch with every pass
    const n = Math.min(6, B.sc.passes || 0), p = fp(-.6 + n * .22, .55);
    for (let i = 0; i < n; i++) { const q = fp(-.6 + i * .22, .55); circ(c, q.x, q.y, 3, 'rgba(40,60,120,.55)'); }
    ell(c, p.x, p.y + 4, 9, 3, 'rgba(0,0,0,.25)'); circ(c, p.x, p.y - 4, 8, '#f2ead8'); circ(c, p.x, p.y - 4, 3, '#21160f');
    if (n >= SOCCER.passes) txt(c, 'SHOT ON', p.x, p.y - 22, F_HUD(16), '#ffd166', 'center');
    return;
  }
  if (B.sport === 'basketball') {
    const ok = B.sc.basket; c.save(); rr(c, 530, 82, 46, 26, 3); c.fillStyle = '#16100c'; c.fill();
    txt(c, ok ? '24' : B.phase === 'player' ? '!!' : '24', 553, 101, F_HUD(20), ok ? '#7fe08a' : (Math.sin(A.t * 6) > 0 ? '#ff6a5a' : '#ffb347'), 'center'); txt(c, 'SHOT', 553, 78, F_HUD(12), '#b8a68c', 'center'); c.restore();
    return;
  }
  if (B.sport === 'boxing') {
    for (let i = 0; i < B.sc.rounds[0] + B.sc.rounds[1]; i++) { const mine = i < B.sc.rounds[0]; rr(c, 120 + i * 18, 92, 14, 18, 2); c.fillStyle = mine ? team.color : '#e0533a'; c.fill(); }
  }
}
// on fire: little flames over the line
function drawPartyFire(c) {
  if (!B || !B.P || !sv(B.P, 'hot')) return;
  for (let i = 0; i < 3; i++) { const p = PARTY_POS[i]; for (let k = 0; k < 6; k++) { const ph = (A.t * 2 + k / 6 + i * .3) % 1; c.save(); c.globalAlpha = (1 - ph) * .8; circ(c, p.x + Math.sin(k * 3 + A.t * 5) * 14, p.y - 110 - ph * 40, 6 * (1 - ph) + 2, k % 2 ? '#ffb347' : '#ff5a2a'); c.restore(); } }
}

// why a hit does what it does: the modifiers on the selected card's first hit against the target
const WHY_SHORT = { 'Crowd on its feet': 'Crowd', 'Rout': 'Rout', 'Strength': 'Str', 'Runners on': 'Runners', 'You are Weak': 'Weak', 'Stunned (hockey)': 'Stunned', 'The sky': 'Sky', 'Lucky Bat': 'Bat', 'Bowling Ball': 'Bowling Ball' };
function drawWhy(c) {
  const w = UI.why; if (!w || !B || B.phase !== 'player') return;
  const segs = [[`${w.card}:`, '#b8a68c']];
  for (const [l, op, n] of w.parts) segs.push(op === '' ? [`${n}`, '#efe4cc'] : [`${op}${n} ${WHY_SHORT[l] || l}`, op === '×' ? (n >= 1 ? '#ffd166' : '#ff8a7a') : '#7fe08a']);
  segs.push([`= ${w.n}${w.hits > 1 ? ` (×${w.hits})` : ''}`, '#fff']);
  c.save(); let fs = 17; const gap = 8, width = () => { c.font = F_HUD(fs); return segs.reduce((t, [s]) => t + c.measureText(s).width + gap, 0); };
  let tw = width(); while (tw > SW - 60 && fs > 11) { fs--; tw = width(); }
  const x0 = SW / 2 - tw / 2, y = SH - 14;
  rr(c, x0 - 10, y - fs, tw + 12, fs + 8, 5); c.fillStyle = 'rgba(16,11,8,.88)'; c.fill(); c.strokeStyle = '#5a4636'; c.lineWidth = 1; c.stroke();
  let x = x0; for (const [s, col] of segs) { txt(c, s, x, y, F_HUD(fs), col, 'left'); c.font = F_HUD(fs); x += c.measureText(s).width + gap; }
  c.restore();
}

/* Scoring moments: a short, distinct animation for each sport's big plays. None of them pause play. */

const POP_LIFE = { bat: 1.2, goal: 1.1, touchdown: 1.6, 'field goal': 1.3, drive: 1.2, strike: 1.3, lance: 1, stone: 1.2, bell: 1, run: .9, basket: 0 };
function sportPop(f) {
  const kind = f.k === 'score' ? f.what : f.k; if (!POP_LIFE[kind]) return;
  const tgt = alive()[0], ta = tgt ? entA(tgt.uid) : null;
  A.spops = (A.spops || []).concat([{ kind, n: f.n, t0: A.t, life: POP_LIFE[kind], tx: ta && ta.x || 720, ty: ta && ta.y || 380, seed: Math.random() * 1000 }]);
  if (kind === 'touchdown' || kind === 'strike' || (kind === 'bat' && f.n === 4)) { A.shake = Math.max(A.shake || 0, .25); }
  if (kind === 'bell') { tone(1320, .5, 'sine', .08, 0); tone(1320, .5, 'sine', .06, 0, .18); }
  if (kind === 'bat') noise(.06, .25, 2400, 3);
  if (kind === 'strike') { for (let i = 0; i < 4; i++) setTimeout(() => noise(.08, .2, 900 + i * 200, 2), i * 50); }
}
function drawSportPops(c) {
  if (!A.spops || !A.spops.length) return;
  A.spops = A.spops.filter(p => A.t - p.t0 < p.life);
  const team = clubTeam();
  for (const p of A.spops) {
    const k = (A.t - p.t0) / p.life, e = 1 - Math.pow(1 - k, 3), rnd = i => { const x = Math.sin(p.seed + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
    c.save();
    switch (p.kind) {
      case 'bat': { // the ball off the bat: line drives stay low, a homer leaves the yard over the crowd
        const x0 = 330, y0 = 330, far = [0, 260, 360, 460, 620][p.n], hgt = [0, 40, 80, 120, 260][p.n];
        const x = x0 + far * e, y = y0 - Math.sin(Math.min(1, e * 1.1) * Math.PI) * hgt - (p.n === 4 ? e * 220 : 0);
        for (let i = 1; i < 6; i++) { const kk = Math.max(0, e - i * .03); c.globalAlpha = .25 - i * .04; circ(c, x0 + far * kk, y0 - Math.sin(Math.min(1, kk * 1.1) * Math.PI) * hgt - (p.n === 4 ? kk * 220 : 0), 6, '#fff'); }
        c.globalAlpha = 1; circ(c, x, y, 7, '#f2ead8'); c.strokeStyle = '#c2264a'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 7, .4, 2.2); c.stroke();
        if (p.n === 4 && k > .6) { c.globalAlpha = (1 - k) * 2.5; txt(c, 'GONE!', 480, 120, F_HUD(48), '#ffd166', 'center'); }
        break; }
      case 'goal': { // the puck rips into the net and the twine bulges
        const x = lerp(330, p.tx, Math.min(1, e * 1.3)), y = lerp(400, p.ty + 10, Math.min(1, e * 1.3));
        if (B.sport === 'soccer') { circ(c, x, y - 4, 8, '#f2ead8'); circ(c, x, y - 4, 3, '#21160f'); } else ell(c, x, y, 10, 4, '#111'); // a ball, or the puck
        const b = Math.max(0, (k - .55) / .45);
        if (b > 0) { c.strokeStyle = 'rgba(240,240,255,.8)'; c.lineWidth = 1.5; const w = 70, h = 46, bulge = Math.sin(b * Math.PI) * 18; for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(p.tx + 20 + i * w / 6 - w / 2, p.ty - h); c.quadraticCurveTo(p.tx + 20 + i * w / 6 - w / 2 + bulge, p.ty - h / 2, p.tx + 20 + i * w / 6 - w / 2, p.ty); c.stroke(); } }
        break; }
      case 'touchdown': case 'field goal': { // the ball spirals downfield; a touchdown rains confetti
        const td = p.kind === 'touchdown', x = lerp(300, td ? 860 : 820, e), y = 330 - Math.sin(e * Math.PI) * (td ? 140 : 190);
        c.save(); c.translate(x, y); c.rotate(-.5 + e * 9); ell(c, 0, 0, 12, 7, '#8a4a22'); c.strokeStyle = '#f2ead8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke(); c.restore();
        if (!td) { c.strokeStyle = '#ffd166'; c.lineWidth = 5; c.globalAlpha = .9; c.beginPath(); c.moveTo(820, 330); c.lineTo(820, 260); c.moveTo(790, 260); c.lineTo(850, 260); c.moveTo(790, 260); c.lineTo(790, 190); c.moveTo(850, 260); c.lineTo(850, 190); c.stroke(); }
        if (td && k > .45) for (let i = 0; i < 60; i++) { const kk = (k - .45) / .55, cx = rnd(i) * 960, cy = -20 + kk * (380 + rnd(i + 99) * 200); c.globalAlpha = 1 - kk * .6; c.fillStyle = i % 3 ? team.color : i % 2 ? '#ffd166' : '#fff'; c.save(); c.translate(cx + Math.sin(kk * 8 + i) * 12, cy); c.rotate(kk * 10 + i); c.fillRect(-4, -2, 8, 4); c.restore(); }
        break; }
      case 'drive': { // a long drive arcs onto the green
        const x = lerp(320, 780, e), y = 360 - Math.sin(e * Math.PI) * 230;
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([4, 6]); c.beginPath(); for (let i = 0; i <= 20; i++) { const kk = e * i / 20; const xx = lerp(320, 780, kk), yy = 360 - Math.sin(kk * Math.PI) * 230; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); c.setLineDash([]);
        circ(c, x, y, 6, '#fff'); break; }
      case 'strike': { // the pins scatter
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (rnd(i) - .5) * 2.6, v = 260 + rnd(i + 5) * 260, x = p.tx + Math.cos(a) * v * e, y = p.ty - 40 + Math.sin(a) * v * e + 420 * e * e; c.save(); c.translate(x, y); c.rotate(e * (rnd(i + 9) - .5) * 14); c.fillStyle = '#f2ead8'; c.beginPath(); c.ellipse(0, 6, 6, 10, 0, 0, Math.PI * 2); c.ellipse(0, -8, 4, 5, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c2264a'; c.fillRect(-4, -3, 8, 2); c.restore(); }
        if (k < .5) { c.globalAlpha = 1 - k * 2; txt(c, 'STRIKE!', 480, 140, F_HUD(52), '#ffd166', 'center'); }
        break; }
      case 'lance': { // splinters burst off the shattered lance
        for (let i = 0; i < 18; i++) { const a = rnd(i) * Math.PI * 2, v = 60 + rnd(i + 3) * 180, x = p.tx - 30 + Math.cos(a) * v * e, y = p.ty - 70 + Math.sin(a) * v * e + 200 * e * e; c.save(); c.globalAlpha = 1 - k; c.translate(x, y); c.rotate(a + e * 6); c.fillStyle = i % 2 ? '#c9a24a' : '#8a6a3a'; c.fillRect(-9, -1.5, 18, 3); c.restore(); }
        break; }
      case 'stone': { // the stone glides into the house
        const pt = fp(lerp(-1.1, Math.cos((B.sc.stones || 1) * 2.1) * .12, e), .5 + Math.sin((B.sc.stones || 1) * 2.1) * .06 * e);
        ell(c, pt.x, pt.y + 3, 14, 5, '#5a5a62'); ell(c, pt.x, pt.y, 14, 5, team.color); c.fillStyle = '#333'; c.fillRect(pt.x - 2, pt.y - 6, 4, 6);
        if (k < .7) { c.globalAlpha = .4; c.strokeStyle = '#fff'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(pt.x + 30 + i * 8, pt.y - 8 + i * 6); c.lineTo(pt.x + 50 + i * 8, pt.y - 8 + i * 6); c.stroke(); } }
        break; }
      case 'bell': { // the round bell, and a card for the round
        const sw = Math.sin(A.t * 40) * (1 - k) * .4; c.save(); c.translate(480, 150); c.rotate(sw); c.fillStyle = '#d9b24a'; c.beginPath(); c.moveTo(-22, 16); c.quadraticCurveTo(-22, -22, 0, -24); c.quadraticCurveTo(22, -22, 22, 16); c.closePath(); c.fill(); c.strokeStyle = '#21160f'; c.lineWidth = 2; c.stroke(); circ(c, 0, 20, 5, '#8a6a3a'); c.restore();
        c.globalAlpha = Math.min(1, (1 - k) * 3); txt(c, p.n === undefined ? '' : '', 480, 200, F_HUD(20), '#fff', 'center');
        break; }
      case 'run': { // a run crosses the plate: a burst at home
        const h = baseXY(3); c.globalAlpha = 1 - k; c.strokeStyle = team.color; c.lineWidth = 4; c.beginPath(); c.arc(h.x, h.y - 6, 10 + e * 40, 0, Math.PI * 2); c.stroke(); break; }
    }
    c.restore();
  }
}
