/* Mossgate Links: the picture (issue #92, phase 2). The hole from above, played left to right: along the hole (its y)
   runs across the screen, across the hole (x) down it, so a ball that misses right of the aim goes down the screen.
   The camera (GLC) follows the shot: it frames the ball and where it is going, follows a ball in the air, and pushes in
   on the green for a putt, where the slope shows as grain (arrows that drift downhill). Drawing only: never in G or GD.
   Each hole's ground is drawn once into its own canvas (glGround, by the hole's seed and par) and laid under the rest:
   the rough, the fairway, the tee, sand, bog and water as soft blobs, the green, and the trees as canopies. On top:
   the cup and its flag, both balls (yours ringed in your colour), a ball in the air with its shadow on the grass, the
   aim line and the ring, the read line on a putt, the wind, the hole card and the swing meter. */
const GLC = { x: 100, y: 200, k: 2, h: -1, t: 0 };
const GL_GROUND = { S: 3, cols: { R: '#4d6a36', r: '#668a43', F: '#86b055', F2: '#7ea74f', T: '#97c763', S: '#e4d39c', B: '#5a5a30', W: '#4b84a6', G: '#a5d36c', O: '#2c4527', out: '#243a20' } };
const GLGC = {};
const GL_SIDE = ['#d8a03a', '#7a5ad0'];

function glGround(H) {
  const key = H.seed + ':' + H.par;
  if (GLGC[key]) return GLGC[key];
  // (one hole's ground at a time: a canvas each is a few megabytes)
  for (const k in GLGC) delete GLGC[k];
  const S = GL_GROUND.S, C = GL_GROUND.cols, cs = H.cell, cv = document.createElement('canvas');
  cv.width = Math.ceil(H.h * cs * S); cv.height = Math.ceil(H.w * cs * S);
  const c = cv.getContext('2d'), q = glRng(H.seed ^ 0x51ed);
  c.fillStyle = C.R; c.fillRect(0, 0, cv.width, cv.height);
  const blob = (ch, col, r) => { c.fillStyle = col; for (let row = 0; row < H.h; row++) for (let i = 0; i < H.w; i++) if (H.grid[row][i] === ch) { c.beginPath(); c.arc((row + 0.5) * cs * S, (i + 0.5) * cs * S, cs * S * r, 0, Math.PI * 2); c.fill(); } };
  blob('r', C.r, 0.8);
  // the fairway, mown in bands across the hole
  for (let row = 0; row < H.h; row++) { c.fillStyle = (row >> 1) % 2 ? C.F : C.F2; for (let i = 0; i < H.w; i++) if (H.grid[row][i] === 'F') { c.beginPath(); c.arc((row + 0.5) * cs * S, (i + 0.5) * cs * S, cs * S * 0.78, 0, Math.PI * 2); c.fill(); } }
  blob('T', C.T, 0.72);
  // the green and its fringe, under the hazards: a bunker or a pond by the green is drawn as the ground has it
  const g = H.green;
  c.fillStyle = C.F; c.beginPath(); c.ellipse(g.y * S, g.x * S, (g.ry + 2.5) * S, (g.rx + 2.5) * S, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = C.G; c.beginPath(); c.ellipse(g.y * S, g.x * S, g.ry * S, g.rx * S, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(40,70,20,.35)'; c.lineWidth = 1.5; c.stroke();
  blob('S', C.S, 0.78);
  blob('B', C.B, 0.8);
  // the bog's dark pools
  c.fillStyle = 'rgba(25,30,10,.45)';
  for (let row = 0; row < H.h; row++) for (let i = 0; i < H.w; i++) if (H.grid[row][i] === 'B' && q() < 0.6) { c.beginPath(); c.arc((row + q()) * cs * S, (i + q()) * cs * S, 1.5 + q() * 3, 0, Math.PI * 2); c.fill(); }
  blob('W', C.W, 0.8);
  c.strokeStyle = 'rgba(220,240,255,.35)'; c.lineWidth = 1;
  for (let row = 0; row < H.h; row++) for (let i = 0; i < H.w; i++) if (H.grid[row][i] === 'W' && q() < 0.35) { const x = (row + q()) * cs * S, y = (i + q()) * cs * S; c.beginPath(); c.moveTo(x - 4, y); c.quadraticCurveTo(x, y - 2, x + 4, y); c.stroke(); }
  // the trees: a shadow, then a canopy of a few greens
  const trees = [];
  for (let row = 0; row < H.h; row++) for (let i = 0; i < H.w; i++) if (H.grid[row][i] === 'O') trees.push([(row + 0.3 + q() * 0.4) * cs * S, (i + 0.3 + q() * 0.4) * cs * S, cs * S * (0.62 + q() * 0.35), q()]);
  c.fillStyle = 'rgba(10,20,8,.35)';
  for (const [x, y, r] of trees) { c.beginPath(); c.arc(x + r * 0.25, y + r * 0.3, r, 0, Math.PI * 2); c.fill(); }
  for (const [x, y, r, v] of trees) {
    c.fillStyle = v < 0.33 ? '#2c4527' : v < 0.66 ? '#34502b' : '#3b5a2e'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(15,28,12,.6)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = 'rgba(160,200,110,.12)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2); c.fill();
  }
  GLGC[key] = cv;
  return cv;
}

// a hole point on the screen, and back
const glScr = (x, y) => [480 + (y - GLC.y) * GLC.k, 300 + (x - GLC.x) * GLC.k];
const glUnscr = (sx, sy) => ({ x: GLC.x + (sy - 300) / GLC.k, y: GLC.y + (sx - 480) / GLC.k });

// where the camera wants to be: { x, y, k }
function glCamWant(H) {
  const D = GD.disp, A = glAnimBall(), S = GD.sel, mine = (GD.ph === 'aim' || GD.ph === 'swing') && S;
  let a, b, putt = false;
  if (A) { a = A; b = A; putt = GD.anim.path.length === 0; }
  else {
    const n = GD.cpu ? GD.cpu.side : mine ? GD.you : glAwaySide();
    a = D.balls[n] || D.balls[0];
    if (mine) { b = S.aim; putt = S.putt; }
    else if (GD.cpu && !GD.cpu.plan.putt) b = GD.cpu.plan.aim;
    else { b = H.pin; putt = a.lie === 'G' || hyp(a.x - H.pin.x, a.y - H.pin.y) < 18; }
  }
  if (putt) { const p = H.pin, span = Math.max(hyp(a.x - p.x, a.y - p.y), hyp(b.x - a.x, b.y - a.y)); return { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2, k: clamp(760 / (span * 1.3 + 8), 9, 40) }; }
  if (A) return { x: A.x, y: A.y, k: GLC.k };
  const span = hyp(b.x - a.x, b.y - a.y);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, k: clamp(820 / (span + 70), 1.6, 7) };
}
function glAwaySide() { const H = GD.disp.hole, d = GD.disp.balls.map(b => hyp(b.x - H.pin.x, b.y - H.pin.y)); try { const s = glAway(d); return s < 0 ? 0 : s; } catch (e) { return 0; } }

function glDraw(c, dt) {
  c.save();
  c.fillStyle = GL_GROUND.cols.out; c.fillRect(0, 0, 960, 600);
  if (!G || !GD || !GD.disp) { txt(c, 'Mossgate Links', 480, 300, '600 22px Georgia, serif', '#cfe3b0', 'center', 'middle'); c.restore(); return; }
  const H = GD.disp.hole, W = glCamWant(H);
  GLC.t += dt || 0;
  if (GLC.h !== GD.disp.h) { GLC.h = GD.disp.h; Object.assign(GLC, W); }
  else { const f = Math.min(1, (dt || 0) * 2.6); GLC.x += (W.x - GLC.x) * f; GLC.y += (W.y - GLC.y) * f; GLC.k += (W.k - GLC.k) * Math.min(1, (dt || 0) * 1.8); }
  const k = GLC.k, S = GL_GROUND.S, cv = glGround(H), [ox, oy] = glScr(0, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(cv, ox, oy, cv.width / S * k, cv.height / S * k);
  if (k >= 7) { glDrawGreen(c, H); glDrawGrain(c, H); }
  glDrawPin(c, H);
  const mine = (GD.ph === 'aim' || GD.ph === 'swing') && GD.sel && GD.mode === 'play';
  if (mine) glDrawAim(c);
  glDrawBalls(c, H);
  glDrawCard(c, H);
  glDrawWind(c);
  if (mine) glDrawMeter(c);
  c.restore();
}
// up close, the green and its fringe drawn again sharp over the ground
function glDrawGreen(c, H) {
  const g = H.green, [x, y] = glScr(g.x, g.y), k = GLC.k, C = GL_GROUND.cols;
  c.save();
  c.fillStyle = C.F; c.beginPath(); c.ellipse(x, y, (g.ry + 2.5) * k, (g.rx + 2.5) * k, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = C.G; c.beginPath(); c.ellipse(x, y, g.ry * k, g.rx * k, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(40,70,20,.35)'; c.lineWidth = 2; c.stroke();
  // and the sand and water cells round it, over the fringe, as the ground has them
  const cs = H.cell, r0 = Math.max(0, Math.floor((g.y - g.ry - 6) / cs)), r1 = Math.min(H.h - 1, Math.ceil((g.y + g.ry + 6) / cs)), c0 = Math.max(0, Math.floor((g.x - g.rx - 6) / cs)), c1 = Math.min(H.w - 1, Math.ceil((g.x + g.rx + 6) / cs));
  for (let row = r0; row <= r1; row++) for (let i = c0; i <= c1; i++) { const ch = H.grid[row][i]; if (ch !== 'S' && ch !== 'W' && ch !== 'B') continue;
    const [sx, sy] = glScr((i + 0.5) * cs, (row + 0.5) * cs); c.fillStyle = C[ch]; c.beginPath(); c.arc(sx, sy, cs * 0.78 * k, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
// the green's grain: arrows downhill, drifting
function glDrawGrain(c, H) {
  const g = H.green, step = 1.6, ph = (GLC.t * 0.5) % 1;
  c.save(); c.strokeStyle = 'rgba(40,80,20,.32)'; c.lineWidth = 1.2;
  for (let x = g.x - g.rx; x <= g.x + g.rx; x += step) for (let y = g.y - g.ry; y <= g.y + g.ry; y += step) {
    if (((x - g.x) / g.rx) ** 2 + ((y - g.y) / g.ry) ** 2 > 0.9) continue;
    const s = glSlope(H, x, y), m = hyp(s[0], s[1]) || 1e-6, ux = s[0] / m, uy = s[1] / m, L = clamp(m * 40, 0.25, 0.8);
    const bx = x + ux * step * (ph - 0.5), by = y + uy * step * (ph - 0.5), [x0, y0] = glScr(bx - ux * L / 2, by - uy * L / 2), [x1, y1] = glScr(bx + ux * L / 2, by + uy * L / 2);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    const ah = Math.atan2(y1 - y0, x1 - x0); c.lineTo(x1 - Math.cos(ah - 0.5) * 4, y1 - Math.sin(ah - 0.5) * 4); c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(ah + 0.5) * 4, y1 - Math.sin(ah + 0.5) * 4); c.stroke();
  }
  c.restore();
}
function glDrawPin(c, H) {
  const [x, y] = glScr(H.pin.x, H.pin.y), r = Math.max(2.2, GL_PUTT.cup * GLC.k * 1.2);
  c.save();
  c.fillStyle = '#16210f'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  const tall = clamp(GLC.k * 2.2, 18, 46), wv = Math.sin(GLC.t * 3) * 2;
  c.strokeStyle = '#efe9d8'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - tall); c.stroke();
  c.fillStyle = '#d0402f'; c.beginPath(); c.moveTo(x, y - tall); c.lineTo(x + 13, y - tall + 4 + wv); c.lineTo(x, y - tall + 9); c.closePath(); c.fill();
  c.restore();
}
function glDrawBalls(c, H) {
  const A = glAnimBall(), D = GD.disp;
  c.save();
  for (const s of [0, 1]) {
    let b = A && GD.anim.side === s ? A : D.balls[s];
    if (!b || (!A || GD.anim.side !== s) && hyp(b.x - H.pin.x, b.y - H.pin.y) < 0.02) continue;
    const [x, y] = glScr(b.x, b.y), z = b.z || 0, lift = z * GLC.k * 0.55, r = 3.4 + Math.min(4, z * 0.08);
    if (z > 0.2) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y, 3.5, 2.2, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fbfbf4'; c.strokeStyle = G.teams[s].color || GL_SIDE[s]; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y - lift, r, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  // the hitter stands by the ball to play
  const n = GD.ph === 'addr' && GD.cpu ? GD.cpu.side : (GD.ph === 'aim' || GD.ph === 'swing') ? GD.you : -1;
  if (n >= 0 && D.balls[n]) {
    const ri = n === GD.you && GD.sel && GD.ph !== 'addr' ? GD.sel.ri : GD.cpu ? GD.cpu.plan.ri : 0, [x, y] = glScr(D.balls[n].x, D.balls[n].y);
    c.fillStyle = G.teams[n].color || GL_SIDE[n]; c.beginPath(); c.arc(x - 9, y + 9, 5, 0, Math.PI * 2); c.fill();
    txt(c, glName(n, ri), x - 9, y + 24, '600 11px system-ui, sans-serif', '#f4f1e0', 'center', 'middle');
  }
  c.restore();
}
function glDrawAim(c) {
  const S = GD.sel, b = G.ball[GD.you], [bx, by] = glScr(b.x, b.y), [ax, ay] = glScr(S.aim.x, S.aim.y);
  c.save();
  if (S.putt) {
    const L = glReadLine();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(bx, by); c.lineTo(ax, ay); c.stroke();
    c.setLineDash([]); c.strokeStyle = '#fff6b0'; c.lineWidth = 2.2; c.beginPath();
    L.forEach((p, i) => { const [x, y] = glScr(p.x, p.y); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ax - 5, ay); c.lineTo(ax + 5, ay); c.moveTo(ax, ay - 5); c.lineTo(ax, ay + 5); c.stroke();
  } else {
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.4; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(bx, by); c.lineTo(ax, ay); c.stroke(); c.setLineDash([]);
    const r = Math.max(7, 4 * GLC.k);
    c.strokeStyle = '#fff6b0'; c.lineWidth = 2; c.beginPath(); c.arc(ax, ay, r, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,246,176,.15)'; c.fill();
    const d = hyp(S.aim.x - b.x, S.aim.y - b.y);
    txt(c, `${Math.round(d)} yd`, ax + r + 4, ay, '600 12px system-ui, sans-serif', '#fff6b0', 'left', 'middle');
  }
  // a drag back from the ball: the pull (the power) and its line
  if (GD.drag) {
    const [qx, qy] = glScr(GD.drag.x, GD.drag.y), pull = Math.min(GL_METER.top, hyp(qx - bx, qy - by) / GL_HANDS.drag);
    c.strokeStyle = pull > 1 ? '#ff8a6a' : '#ffffff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx, by); c.lineTo(qx, qy); c.stroke();
    txt(c, `${Math.round(pull * 100)}%`, qx, qy - 12, '600 12px system-ui, sans-serif', '#ffffff', 'center', 'middle');
  }
  c.restore();
}
function glDrawCard(c, H) {
  const no = GD.disp.h + 1, lines = [`Hole ${no}${no > G.holes ? ' (playoff)' : ''} · Par ${H.par} · ${H.len} yards`, `${G.teams[0].name}: ${glMatchText(0)}`];
  const st = G.h === GD.disp.h ? G.hole.st : (G.card[GD.disp.h] || { st: [0, 0] }).st;
  lines.push(`Strokes this hole: ${G.teams[0].name} ${st[0]}, ${G.teams[1].name} ${st[1]}`);
  c.save();
  c.save(); c.font = '13px system-ui, sans-serif'; const w = Math.max(...lines.map(t => c.measureText(t).width)) + 26; c.restore();
  c.fillStyle = 'rgba(16,26,12,.72)'; rr(c, 10, 10, Math.min(820, w), 66, 7); c.fill();
  lines.forEach((t, i) => txt(c, t, 22, 30 + i * 19, (i ? '' : '600 ') + '13px system-ui, sans-serif', i ? '#dfe9cf' : '#fff6d8', 'left', 'middle'));
  c.restore();
}
function glDrawWind(c) {
  const w = G.wind || { s: 0, d: 0 }, cx = 905, cy = 52;
  c.save();
  c.fillStyle = 'rgba(16,26,12,.72)'; c.beginPath(); c.arc(cx, cy, 38, 0, Math.PI * 2); c.fill();
  if (w.s) {
    const dx = Math.sin(w.d), dy = Math.cos(w.d), L = 10 + w.s * 1.4;
    c.strokeStyle = '#e8f3ff'; c.fillStyle = '#e8f3ff'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - dx * L, cy - dy * L); c.lineTo(cx + dx * L, cy + dy * L); c.stroke();
    const a = Math.atan2(dy, dx); c.beginPath(); c.moveTo(cx + dx * (L + 6), cy + dy * (L + 6)); c.lineTo(cx + dx * L + Math.cos(a + 2.2) * 9, cy + dy * L + Math.sin(a + 2.2) * 9); c.lineTo(cx + dx * L + Math.cos(a - 2.2) * 9, cy + dy * L + Math.sin(a - 2.2) * 9); c.closePath(); c.fill();
  }
  txt(c, w.s ? `${w.s} mph` : 'Still', cx, cy + 52, '600 12px system-ui, sans-serif', '#e8f3ff', 'center', 'middle');
  c.restore();
}
// the meter: a full swing from GL_METER.low to top, the mark at 0 and the tick; a putt's bar 0 to 1 with its tick
function glDrawMeter(c) {
  const S = GD.sel, M = GD.ph === 'swing' ? GD.meter : null, putt = S.putt, lo = putt ? 0 : GL_METER.low, hi = putt ? 1 : GL_METER.top;
  const x0 = 200, x1 = 760, y = 556, X = p => x0 + (p - lo) / (hi - lo) * (x1 - x0);
  c.save();
  c.fillStyle = 'rgba(16,26,12,.8)'; rr(c, x0 - 16, y - 30, x1 - x0 + 32, 58, 8); c.fill();
  c.fillStyle = '#2b3a22'; rr(c, x0, y - 9, x1 - x0, 18, 4); c.fill();
  if (!putt) {
    c.fillStyle = 'rgba(208,64,47,.45)'; c.fillRect(X(1), y - 9, X(hi) - X(1), 18);
    const w = glWin(glRat(GD.you, S.ri), M && M.pow != null ? M.pow : S.tick);
    c.fillStyle = '#6fcf6a'; c.fillRect(X(-w), y - 11, X(w) - X(-w), 22);
  }
  const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,240,170,.35)');
  c.fillStyle = g; c.fillRect(X(Math.max(0, lo)), y - 9, X(Math.min(1, hi)) - X(Math.max(0, lo)), 18);
  c.fillStyle = '#ffd34a'; c.fillRect(X(S.tick) - 1.5, y - 15, 3, 30);
  if (M && M.pow != null && !putt) { c.fillStyle = '#ffffff'; c.fillRect(X(M.pow) - 1, y - 13, 2, 26); }
  if (M) { const nx = X(clamp(M.p, lo, hi)); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(nx, y - 13); c.lineTo(nx - 6, y - 22); c.lineTo(nx + 6, y - 22); c.closePath(); c.fill(); c.fillRect(nx - 1, y - 13, 2, 26); }
  const club = putt ? 'Putter' : GL_CLUBS[S.club].n, extra = [GL_SHAPES[S.shape] && GL_SHAPES[S.shape].n, GL_TRAJ[S.traj] && GL_TRAJ[S.traj].n, S.spin < 0 ? 'Backspin' : S.spin > 0 ? 'Topspin' : ''].filter(Boolean).join(', ');
  txt(c, `${glName(GD.you, S.ri)} · ${club}${extra ? ' · ' + extra : ''}`, x0, y - 19, '600 12px system-ui, sans-serif', '#fff6d8', 'left', 'middle');
  txt(c, putt ? 'Space: start, then the weight' : !M ? 'Space: start the swing' : M.st === 'up' ? 'Space: the power' : 'Space: on the mark', x1, y - 19, '12px system-ui, sans-serif', '#dfe9cf', 'right', 'middle');
  c.restore();
}
