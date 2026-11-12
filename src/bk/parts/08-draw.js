/* The Charter Court: the court, drawn (issue #77, phase 1). The Charter Court from above and a little to one side: a
   boarded floor in a walled yard, keys painted in the club's orange, chain nets on both hoops. The whole court is in
   view while the play crosses it; once the ball and every player are in one half the camera pushes in on that half
   and drops a little lower (bkCamStep), and pulls back out when the play leaves. It is drawing only: BKT.cam, never G. Players are the inked figures (03-figures.js), sorted so the nearer ones stand in front;
   the ball handler has a ring in their side's colour under them, and the ball has its shadow on the floor.
   The bar at the top has the score (underlined for the side with the ball), the period, the game clock and the shot
   clock in its box, and each side's team fouls (lit in the bonus) and timeouts left. Under the court, what just happened
   (GD.msg) and the calls on this possession with who they favour. A big moment (a dunk, a three, a block, an and-one, the
   shot clock running out) puts a word on the floor for a moment; at the end, the final score.
   Phase 2: by hand, the player you play has a marker over them, and the release meter rises beside your shooter (the
   window in green, its heart, the swish, brighter); after a shot the meter stays a moment with where you let go. A
   player on fire has flames at their feet. A pick shows the screener's spot.
   Phase 6, powers: each side's mana (pips) and spirit (a bar, gold when it can pay for the ultimate) under the score,
   and the zones on the floor with their names.
   Phase 5, the Charter Court's own: a shine on the waxed patches, a bent rim hanging down, the crowd on its feet in a
   roar.
   Court space is metres (05-live.js); bkScr turns it into canvas pixels. */
const BKT = { t: 0, bg: null, bgKey: '', cam: { u: 0, end: 0, x: 480, t: 0, g: null } };
const BK_PX = 30, BK_PY = 22, BK_X0 = 60, BK_Y0 = 318, BK_PZ = 15;
// the camera: pushed in on one half, the floor is 1.5 times as wide and 1.1 times as deep (a lower seat), and figures
// 1.5 times the size. It holds the near apron where it is and the half's own baseline at the edge of the picture
// (edge: how much of the yard past the baseline stays in view). It goes in once the ball is within in[0] metres of a
// baseline and every player within in[1], and stays to out[]; pulling back, it swings to follow the ball (pan).
const BK_CAM = { sx: 1.5, sy: 1.1, edge: 12, fy: 497, rate: 1.7, pan: 5, in: [12, 17], out: [16.5, 19.4] };
// (left: the whole-court picture's x at the left edge of what is drawn)
const BKC = { sx: 1, sy: 1, left: 0 };
// a point of the whole-court picture, where the camera puts it
const bkPx = (x, y) => ({ x: (x - BKC.left) * BKC.sx, y: BK_CAM.fy + (y - BK_CAM.fy) * BKC.sy });
const bkScr = (x, y, z = 0) => { const p = bkPx(BK_X0 + x * BK_PX, BK_Y0 + y * BK_PY); p.y -= z * BK_PZ * BKC.sx; return p; };
// draw what follows at the camera's size about p (inside a save/restore)
function bkZoomAt(c, p) { const k = BKC.sx; if (k !== 1) { c.translate(p.x, p.y); c.scale(k, k); c.translate(-p.x, -p.y); } }
// which half the camera should be on (0 the left, 1 the right), or null for the whole court
function bkCamAim() {
  const ph = GD.ph, len = BK_RULES.len, C = BKT.cam;
  if (ph === 'intro' || ph === 'break' || ph === 'over' || ph === 'timeout') return null;
  if (ph === 'ft' && GD.ft && L.pl[GD.ft.i]) return L.pl[GD.ft.i].x < len / 2 ? 0 : 1;
  for (const e of [0, 1]) { const th = C.u > 0 && C.end === e ? BK_CAM.out : BK_CAM.in, d = x => e ? len - x : x;
    if (d(L.ball.x) < th[0] && L.pl.every(p => d(p.x) < th[1])) return e; }
  return null;
}
// move the camera on by the time since the last frame (the play's clock, so a paused game holds its picture)
function bkCamStep() {
  const C = BKT.cam; if (C.g !== G) { C.g = G; C.u = 0; C.x = 480; C.t = BKT.t; }
  const dt = clamp(BKT.t - C.t, 0, .25), aim = bkCamAim(); C.t = BKT.t;
  if (aim != null) { C.end = aim; C.u = Math.min(1, C.u + dt * BK_CAM.rate); } else C.u = Math.max(0, C.u - dt * BK_CAM.rate);
  // where it looks: the half's end while it is on a half, the ball otherwise
  const to = aim != null ? aim * 960 : BK_X0 + L.ball.x * BK_PX; C.x += (to - C.x) * Math.min(1, dt * BK_CAM.pan);
  const e = C.u * C.u * (3 - 2 * C.u), sx = 1 + (BK_CAM.sx - 1) * e, w = 960 / sx;
  BKC.sx = sx; BKC.sy = 1 + (BK_CAM.sy - 1) * e; BKC.left = clamp(C.x - w / 2, BK_CAM.edge * e, 960 - w - BK_CAM.edge * e);
}
const BK_FONT = '"Alegreya Sans", system-ui, sans-serif';

function bkDraw(c) {
  c.fillStyle = '#120d0a'; c.fillRect(0, 0, 960, 600);
  if (!G || !GD || !L) return;
  bkCamStep();
  bkDrawBack(c);
  bkDrawHoop(c, 0, true);
  bkDrawHoop(c, 1, true);
  bkDrawZones(c);
  bkDrawPlayers(c);
  bkDrawHoop(c, 0, false);
  bkDrawHoop(c, 1, false);
  bkDrawBall(c);
  bkDrawMeter(c);
  bkDrawBig(c);
  bkDrawHud(c);
  bkDrawMsg(c);
}
// what never moves (the yard's bricks, the floor, the lines) is drawn once into a canvas of its own at the density the
// court is drawn at, and copied each frame; the crowd on the wall is drawn live over it
function bkDrawBack(c) {
  const k = Math.min(2.6, (c.getTransform().a || 1) * 1.35), key = `${k}|${G.teams[0].color}`;
  if (BKT.bgKey !== key) {
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.round(960 * k), Math.round(600 * k)) : Object.assign(document.createElement('canvas'), { width: Math.round(960 * k), height: Math.round(600 * k) });
    const b = cv.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0); const was = [BKC.sx, BKC.sy]; BKC.sx = BKC.sy = 1; bkDrawYard(b); bkDrawFloor(b); [BKC.sx, BKC.sy] = was;
    BKT.bg = cv; BKT.bgKey = key;
  }
  const o = bkPx(0, 0); c.save(); c.translate(o.x, o.y); c.scale(BKC.sx, BKC.sy); c.drawImage(BKT.bg, 0, 0, 960, 600); c.restore();
  bkDrawCrowd(c);
  // the waxed boards (phase 5): a shine on each slick patch, slowly moving
  if (G.court) for (const w of G.court.wax) { const s = bkScr(w.x, w.y); c.save(); c.globalAlpha = .22 + .08 * Math.sin(BKT.t * 1.5 + w.x); const rx = w.r * BK_PX * BKC.sx; const g = c.createRadialGradient(s.x, s.y, 2, s.x, s.y, rx); g.addColorStop(0, 'rgba(255,250,230,.95)'); g.addColorStop(1, 'rgba(255,250,230,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(s.x, s.y, rx, w.r * BK_PY * BKC.sy, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
}
// the walled yard: brick walls close on every side
function bkDrawYard(c) {
  const g = c.createLinearGradient(0, 64, 0, 600); g.addColorStop(0, '#3a2219'); g.addColorStop(1, '#1c120d');
  c.fillStyle = g; c.fillRect(0, 64, 960, 536);
  c.save(); c.globalAlpha = .35; c.strokeStyle = '#120a07'; c.lineWidth = 1;
  for (let y = 72; y < 600; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(960, y); c.stroke(); for (let x = ((y / 12) % 2) * 18; x < 960; x += 36) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 12); c.stroke(); } }
  c.restore();
}
// a row of heads along the top wall, bobbing a little
// (someone on the wall at (x, y) of the whole-court picture: where the camera puts them, at its size)
function bkCrowdAt(c, x, y) { const p = bkPx(x, y); c.translate(p.x, p.y); c.scale(BKC.sx, BKC.sx); c.translate(-x, -y); }
function bkDrawCrowd(c) {
  // (a roar: the side's crowd on its feet, bouncing)
  const roar = G.court && G.court.roar, skin = ['#6b4a3a', '#8a6a4a', '#4a3a3a', '#a07a5a', '#5a6a4a', '#7a5a6a'], home = G.teams[0].color, away = G.teams[1].color;
  // torches on the wall, each with its glow
  for (let i = 0; i < 6; i++) { const x = 80 + i * 160, f = Math.sin(BKT.t * 7 + i * 2.1);
    c.save(); bkCrowdAt(c, x, 76); const g = c.createRadialGradient(x, 76, 2, x, 76, 70); g.addColorStop(0, 'rgba(255,170,80,.34)'); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - 70, 64, 140, 80);
    c.fillStyle = '#2a1a12'; c.fillRect(x - 2, 78, 4, 12); c.fillStyle = '#ff9a3a'; c.beginPath(); c.ellipse(x, 74 - f, 3.5, 6 + f, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffe08a'; c.beginPath(); c.ellipse(x, 76, 1.6, 3, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  // two rows of the yard's crowd, the back one smaller and darker; the home half in the club's colour, the far end in the visitors'
  for (let row = 0; row < 2; row++) { const n = row ? 44 : 48, r = row ? 7 : 5.5, y0 = row ? 112 : 97;
    for (let i = 0; i < n; i++) { const x = (row ? 26 : 16) + i * (row ? 21 : 19.6), b = Math.sin(BKT.t * (roar ? 9 : 2) + i * 1.3 + row) * (roar ? 5 : 1.2), y = y0 + b + ((i * 7 + row) % 3) * 2;
      const shirt = (i * 5 + row * 3) % 4 ? (row ? '#33221a' : '#261914') : tint(x < 480 ? home : away, row ? -.1 : -.35);
      c.save(); bkCrowdAt(c, x, y);
      c.fillStyle = shirt; c.beginPath(); c.moveTo(x - r - 2, y + r + 12); c.lineTo(x - r - 1, y + r - 1); c.quadraticCurveTo(x, y + r - 5, x + r + 1, y + r - 1); c.lineTo(x + r + 2, y + r + 12); c.closePath(); c.fill();
      c.fillStyle = row ? skin[(i * 3) % 6] : tint(skin[(i * 5 + 2) % 6], -.25); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore(); } }
  // the rail in front of them
  const r0 = bkPx(0, 126).y, r1 = bkPx(0, 140).y; c.fillStyle = '#1c120d'; c.fillRect(0, r0, 960, r1 - r0); c.fillStyle = 'rgba(255,200,140,.18)'; c.fillRect(0, r0, 960, 1);
}
function bkDrawFloor(c) {
  const a = bkScr(0, -BK_RULES.wid / 2), b = bkScr(BK_RULES.len, BK_RULES.wid / 2), W = b.x - a.x, H = b.y - a.y;
  // the apron, then the boards: planks along the court in a few shades of honey
  c.fillStyle = '#7a4a2a'; c.fillRect(a.x - 18, a.y - 14, W + 36, H + 28);
  for (let i = 0, y = a.y; y < b.y; i++, y += 6) { c.fillStyle = ['#c99256', '#c48c50', '#cf9a5c', '#c08a4e'][i % 4]; c.fillRect(a.x, y, W, Math.min(6, b.y - y)); }
  c.save(); c.globalAlpha = .18; c.strokeStyle = '#7a4a2a';
  for (let i = 0, y = a.y; y < b.y; i++, y += 6) for (let x = a.x + ((i * 53) % 90); x < b.x; x += 90) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 6); c.stroke(); }
  c.restore();
  // a shine down the middle: the wax
  const sh = c.createLinearGradient(0, a.y, 0, b.y); sh.addColorStop(0, 'rgba(255,240,210,0)'); sh.addColorStop(.45, 'rgba(255,240,210,.12)'); sh.addColorStop(.55, 'rgba(255,240,210,.12)'); sh.addColorStop(1, 'rgba(255,240,210,0)');
  c.fillStyle = sh; c.fillRect(a.x, a.y, W, H);
  // the keys, painted in the home side's colour
  for (const s of [0, 1]) {
    const x0 = s ? BK_RULES.len - 5.8 : 0, k0 = bkScr(x0, -2.45), k1 = bkScr(x0 + 5.8, 2.45);
    c.save(); c.globalAlpha = .55; c.fillStyle = G.teams[0].color; c.fillRect(k0.x, k0.y, k1.x - k0.x, k1.y - k0.y); c.restore();
  }
  c.save(); c.strokeStyle = 'rgba(250,244,228,.9)'; c.lineWidth = 2;
  c.strokeRect(a.x, a.y, W, H);
  const m = bkScr(BK_RULES.len / 2, 0); c.beginPath(); c.moveTo(m.x, a.y); c.lineTo(m.x, b.y); c.stroke();
  c.beginPath(); c.ellipse(m.x, m.y, 1.8 * BK_PX, 1.8 * BK_PY, 0, 0, Math.PI * 2); c.stroke();
  for (const s of [0, 1]) {
    const dir = s ? -1 : 1, bx = s ? BK_RULES.len : 0, rim = bx + dir * BK_RULES.rim;
    const k0 = bkScr(bx, -2.45), k1 = bkScr(bx + dir * 5.8, 2.45); c.strokeRect(Math.min(k0.x, k1.x), k0.y, Math.abs(k1.x - k0.x), k1.y - k0.y);
    const ft = bkScr(bx + dir * 5.8, 0); c.beginPath(); c.ellipse(ft.x, ft.y, 1.8 * BK_PX, 1.8 * BK_PY, 0, -Math.PI / 2, Math.PI / 2, s === 1); c.stroke();
    // the arc: straight in the corners, round from where it meets them
    const yc = BK_RULES.corner, xc = Math.sqrt(BK_RULES.arc ** 2 - yc ** 2);
    c.beginPath();
    let p = bkScr(bx, -yc); c.moveTo(p.x, p.y); p = bkScr(rim + dir * xc, -yc); c.lineTo(p.x, p.y);
    const a0 = Math.atan2(-yc, xc);
    for (let k = 0; k <= 40; k++) { const ang = a0 + (-2 * a0) * k / 40, q = bkScr(rim + dir * Math.cos(ang) * BK_RULES.arc, Math.sin(ang) * BK_RULES.arc); c.lineTo(q.x, q.y); }
    p = bkScr(bx, yc); c.lineTo(p.x, p.y); c.stroke();
  }
  c.restore();
  // centre court: the circle stained in the club's colour, a ball's seams in it
  c.save(); c.globalAlpha = .32; c.fillStyle = G.teams[0].color; c.beginPath(); c.ellipse(m.x, m.y, 1.8 * BK_PX - 2, 1.8 * BK_PY - 2, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha = .3; c.strokeStyle = '#fff4dc'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(m.x, m.y, 1.1 * BK_PX, 1.1 * BK_PY, 0, 0, Math.PI * 2); c.moveTo(m.x - 1.1 * BK_PX, m.y); c.lineTo(m.x + 1.1 * BK_PX, m.y); c.stroke(); c.restore();
  // the court's name on the near apron, out from under the players
  c.save(); c.font = `800 10px ${BK_FONT}`; c.textAlign = 'center'; c.fillStyle = 'rgba(255,224,180,.6)'; try { c.letterSpacing = '3px'; } catch (e) {} c.fillText('THE CHARTER COURT', m.x, b.y + 11); c.restore();
  // the floor falls into shade at its edges
  c.save(); const vg = c.createRadialGradient(m.x, m.y, H * .5, m.x, m.y, W * .62); vg.addColorStop(0, 'rgba(40,20,8,0)'); vg.addColorStop(1, 'rgba(40,20,8,.26)'); c.fillStyle = vg; c.fillRect(a.x, a.y, W, H); c.restore();
}
// a hoop: the pole and the backboard behind (back), or the rim and its chain net in front (front)
function bkDrawHoop(c, s, back) {
  const dir = s ? -1 : 1, bx = s ? BK_RULES.len : 0, rim = bx + dir * BK_RULES.rim, R0 = bkScr(rim, 0, 3.05), bb = bkScr(bx + dir * 1.2, 0, 3.4);
  c.save();
  if (back) {
    const pole = bkScr(bx - dir * .6, 0); c.strokeStyle = '#2a201a'; c.lineWidth = 5 * BKC.sx; c.beginPath(); c.moveTo(pole.x, pole.y); c.lineTo(pole.x, bb.y); c.lineTo(bb.x, bb.y); c.stroke();
    bkZoomAt(c, bb);
    c.fillStyle = 'rgba(240,236,224,.92)'; c.strokeStyle = '#17100e'; c.lineWidth = 2; c.fillRect(bb.x - 3, bb.y - 26, 6, 44); c.strokeRect(bb.x - 3, bb.y - 26, 6, 44);
  } else {
    // the rim: bent after a big dunk comes later (phase 5); the net is chain, and it swings when a shot goes through
    const N = GD.net && GD.net.hoop === s ? GD.net : null; if (N && N.at == null) N.at = BKT.t;
    const sw = N ? Math.max(0, 1 - (BKT.t - N.at) * 1.5) : 0;
    bkZoomAt(c, R0);
    c.strokeStyle = '#9aa0a6'; c.lineWidth = 1.2;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(R0.x + k * 2.6, R0.y); c.lineTo(R0.x + k * 1.6 + Math.sin(BKT.t * 18 + k) * sw * 3, R0.y + 16); c.stroke(); }
    // (a bent rim hangs down at the front, tilted)
    const bent = G.court && G.court.bent[s];
    c.strokeStyle = '#e0742a'; c.lineWidth = 3; c.beginPath(); c.ellipse(R0.x, R0.y + (bent ? 3 : 0), 9, 3.5, bent ? .35 * (s ? -1 : 1) : 0, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}
function bkDrawPlayers(c) {
  const h = L.ball.st === 'held' ? L.ball.h : -1, list = L.pl.map((p, i) => ({ p, i })).sort((a, b) => a.p.y - b.p.y);
  for (const { p, i } of list) {
    const s = bkScr(p.x, p.y), T = G.teams[p.side], mv = hyp(p.vx, p.vy) > .5;
    c.save(); bkZoomAt(c, s);
    c.save(); c.fillStyle = 'rgba(40,20,8,.28)'; c.beginPath(); c.ellipse(s.x, s.y + 1, 14, 4.5, 0, 0, Math.PI * 2); c.fill(); c.restore();
    if (i === h) { c.save(); c.strokeStyle = T.light || '#fff'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(s.x, s.y, 15, 5, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    const face = mv ? p.vx < 0 : bkDir(p.side) < 0, lift = p.act === 'shoot' ? 9 : p.act === 'jump' ? 11 : 0;
    // (tired: a short bar of what breath is left, under their feet)
    if (bkTired(p) > 0) { const v = bkSta(p) / 100; c.save(); c.fillStyle = 'rgba(12,10,9,.7)'; c.fillRect(s.x - 12, s.y + 6, 24, 3); c.fillStyle = v < BK_STAM.sub / 100 ? '#ff6a4a' : '#ffb070'; c.fillRect(s.x - 12, s.y + 6, 24 * v, 3); c.restore(); }
    if (bkOnFire(p)) for (let k = 0; k < 5; k++) { const a = BKT.t * 9 + k * 1.3; c.save(); c.globalAlpha = .75; c.fillStyle = k % 2 ? '#ffb02e' : '#ff5a1e'; c.beginPath(); c.ellipse(s.x - 10 + k * 5, s.y - 4 - Math.abs(Math.sin(a)) * 7, 3, 6 + Math.abs(Math.sin(a)) * 4, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    drawFig(c, p.kind, s.x, s.y, 50, T, { num: p.num, run: mv ? p.run : 0, flip: face, throwK: p.act === 'shoot' || p.act === 'rise' ? 1 : 0, lift: p.act === 'rise' ? 4 : lift, alpha: p.stun > 0 ? .75 : 1 });
    // the player you play: a marker over their head
    if (i === bkMe()) { const y = s.y - 50 * (KIND[p.kind] || KIND.goblin).h - 12; c.save(); c.fillStyle = '#ffe04a'; c.strokeStyle = '#17100e'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s.x - 6, y - 8); c.lineTo(s.x + 6, y - 8); c.lineTo(s.x, y); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    c.restore();
  }
  if (L.pick) { const [x, y] = bkScreenSpot(), q = bkScr(x, y); c.save(); bkZoomAt(c, q); c.strokeStyle = 'rgba(255,224,74,.7)'; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(q.x, q.y, 12, 4, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
}
function bkDrawBall(c) {
  const B = L.ball; if (GD.ph === 'over' || GD.ph === 'break') return;
  let x = B.x, y = B.y, z = B.z;
  // a free throw in the air: from the line to the rim, over the beat
  if (GD.ph === 'ft' && GD.ft) { const p = L.pl[GD.ft.i], u = clamp((GD.t - .45) / .5, 0, 1); if (u > 0) { const hx = bkHoopX(GD.ft.side); x = lerp(p.x, hx, u); y = lerp(p.y, 0, u); z = lerp(2.3, 3.05, u) + 2.5 * 4 * u * (1 - u); } }
  if (GD.ph === 'intro') z = 2.4 + Math.min(GD.t, 1.2) * 1.5;
  const g = bkScr(x, y), b = bkScr(x, y, z);
  c.save(); bkZoomAt(c, g);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(g.x, g.y, 5, 2, 0, 0, Math.PI * 2); c.fill();
  c.restore(); c.save(); bkZoomAt(c, b);
  c.fillStyle = '#e0742a'; c.strokeStyle = '#17100e'; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.lineWidth = 1; c.beginPath(); c.moveTo(b.x - 5.5, b.y); c.lineTo(b.x + 5.5, b.y); c.moveTo(b.x, b.y - 5.5); c.lineTo(b.x, b.y + 5.5); c.stroke();
  c.restore();
}
// a big moment in big letters on the floor, for a moment; and at the end, the final
const BK_BIG = { ult: ['ULTIMATE', '#c9a0ff'], bent: ['RIM BENT', '#ffb070'], roar: ['THE YARD ROARS', '#ffd08a'], swish: ['SWISH', '#bfe8a8'], alley: ['ALLEY-OOP', '#ffd08a'], goaltend: ['GOALTENDING', '#ff8a6a'], fire: ['ON FIRE', '#ffb02e'], break: ['FAST BREAK', '#bfe8a8'], dunk: ['SLAM DUNK', '#ffd08a'], three: ['FROM THREE', '#ffd08a'], block: ['BLOCKED', '#ff8a6a'], andone: ['AND ONE', '#ffd08a'], clock: ['SHOT CLOCK', '#ff8a6a'] };
function bkDrawBig(c) {
  let word = null, col = '#ffd08a', sub = '', al = 1, sc = 1;
  if (GD.ph === 'over') { word = 'FINAL'; sub = `${G.teams[0].name} ${G.score[0]}, ${G.teams[1].name} ${G.score[1]}`; }
  else if (GD.big && BK_BIG[GD.big.k]) {
    if (GD.big.at == null) GD.big.at = BKT.t;
    const a = BKT.t - GD.big.at; if (a > 1.6) { GD.big = null; return; }
    [word, col] = BK_BIG[GD.big.k]; al = Math.min(1, a * 5, (1.6 - a) * 2.5); sc = 1 + Math.max(0, .25 - a) * 1.6;
  } else if (GD.ph === 'break') { word = GD.half ? 'HALFTIME' : G.q > BK_RULES.quarters ? 'OVERTIME' : `END OF THE ${bkPeriodName(G.q - 1).toUpperCase()}`; }
  if (!word) return;
  c.save(); c.globalAlpha = al; c.translate(480, 330); c.scale(sc, sc);
  c.font = `900 50px ${BK_FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
  c.lineWidth = 8; c.strokeStyle = 'rgba(12,10,9,.85)'; c.strokeText(word, 0, 0); c.fillStyle = col; c.fillText(word, 0, 0);
  if (sub) { c.font = `700 22px ${BK_FONT}`; c.lineWidth = 5; c.strokeText(sub, 0, 32); c.fillStyle = '#f3ead6'; c.fillText(sub, 0, 32); }
  c.restore();
}
function bkDrawHud(c) {
  c.fillStyle = '#0d0907'; c.fillRect(0, 0, 960, 64); c.fillStyle = 'rgba(255,150,40,.45)'; c.fillRect(0, 63, 960, 1.5);
  const F = (px, w = 700) => `${w} ${px}px ${BK_FONT}`, dim = 'rgba(243,234,214,.6)', over = GD.ph === 'over';
  for (const s of [0, 1]) {
    const T = G.teams[s], al = s ? 'right' : 'left', X = v => s ? 960 - v : v, bonus = G.tf[1 - s] > BK_RULES.limit;
    c.fillStyle = T.color; c.fillRect(s ? 930 : 20, 10, 10, 44);
    // the name, cut short if it would run into the marks beside it
    let name = T.name; c.font = F(19, 800); while (name.length > 4 && c.measureText(name).width > 196) name = name.slice(0, -2).trimEnd() + '…';
    txt(c, name, X(40), 28, F(19, 800), '#f3ead6', al);
    // team fouls, and the timeouts left as pips
    txt(c, `Fouls ${G.tf[s]}${bonus ? ' · bonus' : ''}`, X(40), 49, F(13, 600), bonus ? '#ffb070' : dim, al);
    if (G.to) { txt(c, 'Timeouts', X(132), 49, F(11, 600), dim, al); const n = Math.max(BK_TO.n, G.to[s]);
      for (let k = 0; k < n; k++) { c.fillStyle = k < G.to[s] ? '#f3ead6' : 'rgba(243,234,214,.18)'; c.fillRect(s ? 960 - 182 - k * 9 - 6 : 182 + k * 9, 41, 6, 9); } }
    // mana (whole points, as pips) and spirit (a bar, gold once it can pay for the ultimate), phase 6
    if (G.powers && G.mana) { const m = Math.floor(G.mana[s] + 1e-9), w = 62, ready = G.spirit[s] >= BK_SPIRIT.ult && !G.ultUsed[s];
      txt(c, 'MANA', X(252), 26, F(10, 800), 'rgba(127,212,255,.75)', al);
      for (let k = 0; k < BK_MANA.max; k++) { c.fillStyle = k < m ? '#7fd4ff' : 'rgba(127,212,255,.18)'; c.beginPath(); c.arc(X(296 + k * 10), 22.5, 3.4, 0, Math.PI * 2); c.fill(); }
      txt(c, 'SPIRIT', X(252), 47, F(10, 800), ready ? '#ffd08a' : 'rgba(255,208,138,.7)', al);
      const bx = s ? 960 - 292 - w : 292; c.fillStyle = 'rgba(255,208,138,.18)'; c.fillRect(bx, 40, w, 6);
      const sp = G.spirit[s] / BK_SPIRIT.max; c.fillStyle = ready ? '#ffd08a' : '#c98a4a'; c.fillRect(s ? bx + w * (1 - sp) : bx, 40, w * sp, 6);
      // (the mark where the ultimate can be paid for)
      const u = w * BK_SPIRIT.ult / BK_SPIRIT.max; c.fillStyle = '#f3ead6'; c.fillRect(s ? bx + w - u - 1 : bx + u - 1, 38.5, 1.5, 9); }
    // the score, lit and underlined in the side's colour while it has the ball
    const has = G.poss === s && !over;
    txt(c, String(G.score[s]), X(398), 47, F(40, 900), has ? T.light || '#fff' : '#f3ead6', 'center');
    if (has) { c.fillStyle = T.color; c.fillRect(X(398) - 20, 54, 40, 4); }
  }
  txt(c, `${bkPeriodName(G.q)}  ${bkClockText()}`, 480, 27, F(19, 800), '#f3ead6', 'center');
  // the shot clock, in its own box
  const sc = Math.ceil(G.shot), off = G.clock < G.shot, low = !off && sc <= 4;
  c.fillStyle = '#1e0d08'; rr(c, 461, 35, 38, 22, 4); c.fill(); c.strokeStyle = low ? '#ff6a4a' : 'rgba(255,208,138,.4)'; c.lineWidth = 1; c.stroke();
  txt(c, off ? '–' : String(sc), 480, 52, F(17, 900), low ? '#ff6a4a' : '#ffd08a', 'center');
}
function bkDrawMsg(c) {
  const notes = GD.notes && GD.notes.length ? ' ' + GD.notes.join(' ') : '';
  // what just happened, on a plate of its own under the court
  c.save(); c.fillStyle = 'rgba(13,9,7,.72)'; rr(c, 150, 506, 660, 34, 8); c.fill(); c.restore();
  let m = (GD.msg || '') + notes; c.font = `600 17px ${BK_FONT}`; while (m.length > 8 && c.measureText(m).width > 636) m = m.slice(0, -2).trimEnd() + '…';
  txt(c, m, 480, 529, `600 17px ${BK_FONT}`, '#f3ead6', 'center');
  // under it, the calls on this possession: the offense's set against the defense, and who it favours
  if (G.cur && GD.ph !== 'over') { const C = G.cur, e = bkEdge(C.off, C.def)[0], T = G.teams[C.side], D = G.teams[1 - C.side];
    const edge = e > 0 ? 'the set has the edge' : e < 0 ? 'the defense has the edge' : 'an even matchup';
    const line = `${T.name}: ${BK_SETS[C.off].n}  against  ${D.name}: ${BK_DEFS[C.def].n}  ·  ${edge}${C.stale ? `  ·  scouted${C.stale > 1 ? ' twice' : ''}` : ''}`;
    txt(c, line, 480, 566, `600 14px ${BK_FONT}`, e > 0 ? '#bfe8a8' : e < 0 ? '#ff9a7a' : 'rgba(243,234,214,.75)', 'center'); }
}
// the release meter: beside your shooter while they rise (or at the line), and a moment after with where you let go
function bkDrawMeter(c) {
  const M = GD.meter, R0 = GD.rel;
  if (R0 && R0.at == null) R0.at = BKT.t;
  const after = !M && R0 && BKT.t - R0.at < .9;
  if (!M && !after) return;
  const i = M ? (M.ft ? GD.ft && GD.ft.i : M.i) : bkMe(), p = L.pl[i]; if (!p) return;
  const w = M ? (M.ft ? bkFtWindow(p) : bkWindow(M.pr, p)) : R0.w, s = bkScr(p.x, p.y), x = s.x + 22, y0 = s.y - 6, H = 64;
  // the bar runs from 0 (the floor) to the late end; the top of the jump is at 1
  const yAt = v => y0 - H * clamp(v, 0, BK_HANDS.late) / BK_HANDS.late;
  c.save(); bkZoomAt(c, s);
  c.fillStyle = 'rgba(12,10,9,.8)'; c.fillRect(x - 5, yAt(BK_HANDS.late) - 2, 10, H + 4);
  c.fillStyle = 'rgba(120,200,110,.55)'; c.fillRect(x - 4, yAt(1 + w / 2), 8, yAt(1 - w / 2) - yAt(1 + w / 2));
  c.fillStyle = 'rgba(190,255,170,.95)'; c.fillRect(x - 4, yAt(1 + w * BK_WIN.perfect), 8, yAt(1 - w * BK_WIN.perfect) - yAt(1 + w * BK_WIN.perfect));
  c.strokeStyle = '#f3ead6'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 7, yAt(1)); c.lineTo(x + 7, yAt(1)); c.stroke();
  if (M) { c.fillStyle = '#ffd08a'; c.fillRect(x - 7, yAt(M.t / M.T) - 1.5, 14, 3); }
  else { const e = R0.e, good = e <= w / 2; txt(c, e <= w * BK_WIN.perfect ? 'Perfect' : good ? 'Good' : e <= w ? 'Off' : 'Way off', x + 10, yAt(1) + 4, `700 12px ${BK_FONT}`, good ? '#bfe8a8' : '#ff8a6a'); }
  c.restore();
}
// the zones on the floor (phase 6): each ultimate's (or a situation power's) area, tinted, with its name and what's left
function bkDrawZones(c) {
  if (!G.zones || !G.zones.length) return;
  G.zones.forEach((z, k) => {
    // (drawn at the basket where it acts: its side's attack for an offense zone, the other side's for a defense one;
    // faint while it waits for its end)
    const U0 = BK_ULT_BY[z.id] || BK_SIT[z.id], vis = (U0 && U0.vis) || ['#ffd08a', 'all'], o = U0 && U0.o && Object.keys(U0.o).length, d = U0 && U0.d && Object.keys(U0.d).length;
    const ours = G.cur && G.cur.side === z.side, active = ours ? o : d, end = active ? G.cur.side : o ? z.side : 1 - z.side;
    c.save(); c.globalAlpha = (active ? .12 : .05) + .04 * Math.sin(BKT.t * 2 + k); c.fillStyle = vis[0];
    const r = (u0, v0, u1, v1) => { const a = bkScr(...bkAt(end, u0, v0)), b = bkScr(...bkAt(end, u1, v1)); c.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); };
    if (vis[1] === 'paint') r(0, -2.45, 5.8, 2.45); else if (vis[1] === 'arc') { r(0, -7.5, 9, -3); r(0, 3, 9, 7.5); r(7, -3, 9.5, 3); } else if (vis[1] === 'half') r(0, -7.5, 14, 7.5); else r(0, -7.5, 28, 7.5);
    c.restore();
    txt(c, `${z.n} · ${z.left > 50 ? 'to the end' : `${z.left} possession${z.left === 1 ? '' : 's'} left`}`, 20 + k * 230, 500, `700 12px ${BK_FONT}`, tint(vis[0], .3), 'left');
  });
}
