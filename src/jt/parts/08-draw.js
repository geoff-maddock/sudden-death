/* The Tilting Lists: drawing (issue #117, phase 2). The picture is 960 by 600, the lists from the side:
   - the sand yard JT_LISTS.yards long with the tilt (the barrier) down the middle, the striped tents at either end,
     pennants on their poles and the gallery behind the far side. Your rider (side 0) rides the near side from the left,
     theirs the far side from the right, left side to left side across the tilt, so you see your lance arm and their
     shield (square, or angled edge-on).
   - the camera shows the whole lists while the riders are named and planned, then closes in on the meeting point as
     they converge, held there for the impact: the lances, the splinters of a break, a rider unhorsed falling to the sand.
   - over it: the tourney board (a pennant a course for each side, its points on it; grey for nothing, red for a foul;
     the tilt's after), the herald's call after each course, and on Play the charge's beats: the hoofbeats and your
     taps, the charge's progress with the couch's right moment marked, and the target as your lance sees it (the
     shield, the body, the helm, your mark, the tip riding its eight), and the balance moment's wobble and your lean.
   The mounts are one drawing (jtHorse): a Charger black with a steel chanfron and a short caparison, a Destrier grey
   under a full caparison to the knees, a Courser chestnut with only a saddle cloth; the cloth in the side's colour.
   Drawing only: nothing here is in the match's state. jtAimScr maps the target's inches to the target panel. */
const JT_VIEW = { w: 960, h: 600, base: 455, depth: .32, near: 1.3, far: -1.3, zoomOut: 14.5, zoomIn: 58, meet: 30, lance: 3.6 };
const JT_TGT = { x: 830, y: 196, k: 3, w: 230, h: 214 };
const JTC = { t: 0, camX: 30, zoom: 14.5 };
function figClock() { return JTC.t; }
const JT_COAT = { charger: '#2b211d', destrier: '#9a958c', courser: '#9a5426' };
const jtScrX = x => JT_VIEW.w / 2 + (x - JTC.camX) * JTC.zoom;
// (the ground line rises as the camera pulls back, so the wide shot is mostly the lists, not the sky)
const jtBase = () => JT_VIEW.base - 110 * (1 - clamp((JTC.zoom - JT_VIEW.zoomOut) / (JT_VIEW.zoomIn - JT_VIEW.zoomOut), 0, 1));
const jtScrY = z => jtBase() + z * Math.max(JTC.zoom, 26) * JT_VIEW.depth;
// the target panel: a point of the target (inches from the middle of the chest) on the picture, and back
const jtAimScr = (x, y) => [JT_TGT.x + x * JT_TGT.k, JT_TGT.y - y * JT_TGT.k];
const jtAimUn = (sx, sy) => ({ x: (sx - JT_TGT.x) / JT_TGT.k, y: (JT_TGT.y - sy) / JT_TGT.k });
const jtEase = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

// where each rider is along the lists now (yards), and how far down the charge (0 to 1, on past 1 after the impact)
function jtRidersNow() {
  const ph = GP ? GP.ph : 'next', C = GP && GP.ch;
  let p = C ? C.p : ph === 'seat' ? 1 + Math.min(.25, GP.seatM ? GP.seatM.t * .05 : 0) : ph === 'after' || ph === 'over' ? 1 + Math.min(.4, GP.t * .22) : 0;
  const run = JT_VIEW.meet - 2, e = p <= 1 ? jtEase(p) : 1 + (p - 1) * .9;
  return { p, x: [2 + run * e, JT_LISTS.yards - 2 - run * e], moving: !!C || ph === 'after' || ph === 'seat' };
}
function jtCamTo(dt) {
  const R0 = jtRidersNow(), close = R0.p <= 1 ? clamp((R0.p - .45) / .5, 0, 1) : 1;
  const zoom = JT_VIEW.zoomOut + (JT_VIEW.zoomIn - JT_VIEW.zoomOut) * jtEase(close), cam = JT_VIEW.meet;
  const k = dt ? Math.min(1, dt * 5) : 1;
  JTC.zoom += (zoom - JTC.zoom) * k; JTC.camX += (cam - JTC.camX) * k;
}

/* ---------- the lists ---------- */
function jtListsDraw(c) {
  const W = JT_VIEW.w, H = JT_VIEW.h, z = JTC.zoom, gy = jtScrY(-5);
  const sky = c.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, '#9cc4e4'); sky.addColorStop(1, '#dfe8d8'); c.fillStyle = sky; c.fillRect(0, 0, W, gy);
  c.fillStyle = 'rgba(255,255,255,.75)';
  for (let i = 0; i < 5; i++) { const x = ((i * 233 + JTC.t * 6) % (W + 200)) - 100, y = 90 + (i * 47) % 120; for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 18], [44, 2, 16], [-20, 4, 14]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, 6.28); c.fill(); } }
  // the Mosswold's trees beyond
  c.fillStyle = '#4c6a3e'; c.beginPath(); c.moveTo(0, gy);
  for (let i = 0; i <= 24; i++) { const x = i * 40, h = 30 + 18 * Math.sin(i * 1.7) + 10 * Math.sin(i * 4.1); c.lineTo(x, gy - h); }
  c.lineTo(W, gy); c.closePath(); c.fill();
  // the gallery behind the far side: a timber stand and the crowd
  const g0 = jtScrX(-4), g1 = jtScrX(JT_LISTS.yards + 4), gh = 2.2 * z, gt = gy - gh;
  c.fillStyle = '#6a4a2e'; c.fillRect(g0, gt, g1 - g0, gh);
  c.save(); c.beginPath(); c.rect(Math.max(0, g0), gt, Math.min(W, g1) - Math.max(0, g0), gh); c.clip();
  for (let i = 0; i < 320; i++) {
    const x = -4 + (i * 0.23) % (JT_LISTS.yards + 8), row = i % 3, sx = jtScrX(x), sy = gt + gh * (.25 + row * .25) + Math.sin(JTC.t * 3 + i) * .6;
    if (sx < -10 || sx > W + 10) continue;
    c.fillStyle = ['#c94a3a', '#e0b84a', '#3a5a9a', '#5a8a4a', '#e6dccb', '#8a4a8a'][i % 6]; c.beginPath(); c.arc(sx, sy, Math.max(1.2, z * .13), 0, 6.28); c.fill();
  }
  c.restore();
  // the sand
  const sand = c.createLinearGradient(0, gy, 0, H); sand.addColorStop(0, '#d8bc84'); sand.addColorStop(1, '#c9a46c'); c.fillStyle = sand; c.fillRect(0, gy, W, H - gy);
  c.fillStyle = 'rgba(120,90,50,.18)'; for (let i = 0; i < 90; i++) { const x = jtScrX((i * 7.3) % 70 - 5), y = gy + ((i * 37) % (H - gy)); if (x > -5 && x < W + 5) c.fillRect(x, y, Math.max(1, z * .2), 1); }
  // the tents at either end, striped, with pennants
  for (const [x, col] of [[-3, '#3a5a9a'], [JT_LISTS.yards + 3, '#c94a3a']]) jtTent(c, x, col);
  for (let i = 0; i <= 6; i++) jtPennant(c, i * JT_LISTS.yards / 6, -4.6, ['#3a5a9a', '#e0b84a', '#c94a3a'][i % 3], i);
}
function jtTent(c, x, col) {
  const sx = jtScrX(x), sy = jtScrY(-3.5), z = JTC.zoom, w = 3.4 * z, h = 3 * z;
  if (sx < -w || sx > JT_VIEW.w + w) return;
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#f2ece0' : col; c.beginPath(); c.moveTo(sx, sy - h); c.lineTo(sx - w / 2 + i * w / 6, sy); c.lineTo(sx - w / 2 + (i + 1) * w / 6, sy); c.closePath(); c.fill(); }
  c.strokeStyle = 'rgba(40,25,15,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx, sy - h); c.lineTo(sx - w / 2, sy); c.lineTo(sx + w / 2, sy); c.closePath(); c.stroke();
  c.strokeStyle = '#3a2a1a'; c.beginPath(); c.moveTo(sx, sy - h); c.lineTo(sx, sy - h - .8 * z); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(sx, sy - h - .8 * z); c.lineTo(sx + .7 * z, sy - h - .65 * z + Math.sin(JTC.t * 4) * 2); c.lineTo(sx, sy - h - .5 * z); c.fill();
}
function jtPennant(c, x, zz, col, i) {
  const sx = jtScrX(x), sy = jtScrY(zz), z = JTC.zoom; if (sx < -20 || sx > JT_VIEW.w + 20) return;
  c.strokeStyle = '#4a3420'; c.lineWidth = Math.max(1, z * .06); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 2.6 * z); c.stroke();
  const f = Math.sin(JTC.t * 3.4 + i) * .15;
  c.fillStyle = col; c.beginPath(); c.moveTo(sx, sy - 2.6 * z); c.quadraticCurveTo(sx + .6 * z, sy - (2.5 + f) * z, sx + 1.2 * z, sy - (2.35 + f * 2) * z); c.lineTo(sx, sy - 2.15 * z); c.fill();
}
// the tilt: a painted rail on posts down the middle
function jtTiltDraw(c) {
  const z = JTC.zoom, y = jtScrY(0), h = 1.15 * z, x0 = jtScrX(1), x1 = jtScrX(JT_LISTS.yards - 1);
  c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x0, y - 2, x1 - x0, 4);
  for (let x = 1; x <= JT_LISTS.yards - 1; x += 2.5) { const sx = jtScrX(x); if (sx < -10 || sx > JT_VIEW.w + 10) continue; c.fillStyle = '#5a3e26'; c.fillRect(sx - z * .06, y - h, z * .12, h); }
  const bands = Math.ceil((JT_LISTS.yards - 2) / 1.5);
  for (let i = 0; i < bands; i++) { const a = jtScrX(1 + i * 1.5), b = jtScrX(Math.min(JT_LISTS.yards - 1, 1 + (i + 1) * 1.5)); if (b < 0 || a > JT_VIEW.w) continue; c.fillStyle = i % 2 ? '#e8dcc0' : '#3a5a9a'; c.fillRect(a, y - h, b - a, h * .28); }
  c.strokeStyle = 'rgba(30,20,10,.55)'; c.lineWidth = 1; c.strokeRect(x0, y - h, x1 - x0, h * .28);
}

/* ---------- a mount ---------- */
// a horse at (x, y) on the sand, k pixels a yard, facing dir (1 right, -1 left), its gait's phase, and its rider's colour
function jtHorse(c, x, y, k, dir, mount, col, phase, moving) {
  const coat = JT_COAT[mount] || JT_COAT.destrier, u = k / 100, dark = tint(coat, -.35);
  c.save(); c.translate(x, y); c.scale(dir * u, u);
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(0, 0, 80, 9, 0, 0, 6.28); c.fill();
  const g = moving ? Math.sin(phase) : 0, g2 = moving ? Math.sin(phase + 1.3) : 0, bob = moving ? Math.abs(Math.cos(phase)) * 5 : 0;
  c.translate(0, -bob);
  const leg = (hx, a, col2) => { const kx = hx + Math.sin(a) * 26, ky = -52; c.strokeStyle = col2; c.lineWidth = 11; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx, -92); c.lineTo(kx, ky); c.lineTo(kx + Math.sin(a * 1.6) * 16, -4 + bob); c.stroke(); c.fillStyle = '#2a1e18'; c.beginPath(); c.arc(kx + Math.sin(a * 1.6) * 16, -3 + bob, 6, 0, 6.28); c.fill(); };
  // the far legs, then the body, then the near legs
  leg(-48, -g * .6, dark); leg(44, g2 * .6, dark);
  // the tail
  c.strokeStyle = tint(coat, -.5); c.lineWidth = 9; c.beginPath(); c.moveTo(-70, -118); c.quadraticCurveTo(-98, -100 + g * 6, -92, -60); c.stroke();
  // the body, the neck, the head
  c.fillStyle = coat; c.strokeStyle = '#17100e'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(-4, -108, 74, 28, 0, 0, 6.28); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(40, -126); c.lineTo(78, -176); c.lineTo(98, -168); c.lineTo(70, -104); c.closePath(); c.fill(); c.stroke();
  c.save(); c.translate(100, -168); c.rotate(.55); c.beginPath(); c.ellipse(0, 0, 26, 12, 0, 0, 6.28); c.fill(); c.stroke(); c.restore();
  c.fillStyle = tint(coat, -.5); c.beginPath(); c.moveTo(74, -178); c.lineTo(48, -128); c.lineTo(56, -126); c.lineTo(82, -174); c.fill();
  c.fillStyle = '#17100e'; c.beginPath(); c.arc(98, -174, 2.6, 0, 6.28); c.fill();
  c.beginPath(); c.moveTo(86, -186); c.lineTo(90, -198); c.lineTo(94, -184); c.fill();
  // the barding, in the rider's colour
  const cloth = col, trim = '#f2e6c4';
  if (mount === 'destrier') {
    c.fillStyle = cloth; c.beginPath(); c.moveTo(-80, -126); c.lineTo(62, -130); c.lineTo(72, -62);
    for (let i = 0; i <= 8; i++) c.lineTo(72 - i * 19, -58 + (i % 2) * 7);
    c.lineTo(-84, -64); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = trim; c.lineWidth = 4; c.beginPath(); c.moveTo(-82, -70); c.lineTo(70, -68); c.stroke(); c.strokeStyle = '#17100e'; c.lineWidth = 3;
    c.fillStyle = cloth; c.beginPath(); c.moveTo(44, -128); c.lineTo(76, -174); c.lineTo(92, -166); c.lineTo(68, -110); c.closePath(); c.fill(); c.stroke();
  } else if (mount === 'charger') {
    c.fillStyle = cloth; c.beginPath(); c.moveTo(-78, -124); c.lineTo(60, -128); c.lineTo(64, -88); c.lineTo(-80, -86); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = trim; c.lineWidth = 3; c.beginPath(); c.moveTo(-80, -90); c.lineTo(63, -92); c.stroke(); c.strokeStyle = '#17100e'; c.lineWidth = 3;
    c.save(); c.translate(100, -168); c.rotate(.55); c.fillStyle = '#b8bcc4'; c.beginPath(); c.ellipse(4, -2, 20, 9, 0, 0, 6.28); c.fill(); c.stroke(); c.restore();
  } else {
    c.fillStyle = cloth; c.fillRect(-26, -134, 46, 30); c.strokeRect(-26, -134, 46, 30);
  }
  // the saddle
  c.fillStyle = '#5a3a22'; c.beginPath(); c.moveTo(-30, -134); c.quadraticCurveTo(-34, -150, -26, -152); c.lineTo(-20, -138); c.lineTo(14, -138); c.lineTo(20, -150); c.quadraticCurveTo(26, -140, 22, -134); c.closePath(); c.fill(); c.stroke();
  // the near legs
  leg(-34, g * .6, coat); leg(58, -g2 * .6, coat);
  c.restore();
  return bob * u;
}
// a rider in the saddle: the figure seated, the shield, the lance (raised, or couched toward the other rider)
const JT_SIT = { legL: { a: -1.25, lift: .1 }, legR: { a: -1.05, lift: .1 }, armL: { x: -12, y: -46 }, armR: { x: 26, y: -50 }, lean: .08 };
function jtRider(c, s, x, y, k, dir, o) {
  const T = G.teams[s], m = T.roster[o.ri] || {}, kind = m.kind && KIND[m.kind] ? m.kind : 'goblin', hpx = 1.55 * k, sc = hpx * (KIND[kind].h) / 100;
  const sy = y - 1.42 * k - o.bob, fy = sy + 34 * sc, team = { color: T.color || '#888', light: '#f2e6c4', short: T.short };
  c.save();
  if (o.fall) { c.translate(x, sy); c.rotate(-dir * o.fall * 1.4); c.translate(-x, -sy + -o.fall * .2 * k); c.translate(-dir * o.fall * .8 * k, o.fall * 1.2 * k); }
  // their shield shows on the far rider (its face to us), a sliver on yours
  const shX = x + dir * 2 * sc, shY = fy - 58 * sc;
  if (s === 0) jtShield(c, shX - dir * 8 * sc, shY, sc * .8, T.color, o.guard, true);
  drawFig(c, kind, x - dir * 4 * sc, fy, hpx, team, { flip: dir < 0, noShadow: true, pose: JT_SIT, num: '' });
  if (s === 1) jtShield(c, shX + dir * 6 * sc, shY, sc, T.color, o.guard, false);
  // the lance: from the hand, raised until couched, then level and pointing at the other rider
  const hx = x + dir * 22 * sc, hy = fy - 52 * sc, ang = o.couched ? (o.droop || 0) * .02 : -1.05 + (o.lower || 0) * 1.05, L = JT_VIEW.lance * k;
  if (!o.broken) jtLance(c, hx, hy, dir, ang, L, T.color, 1);
  else jtLance(c, hx, hy, dir, ang, L * .38, T.color, .38);
  c.restore();
}
function jtShield(c, x, y, sc, col, guard, back) {
  c.save(); c.translate(x, y); const w = guard === 'angled' ? .45 : 1; c.scale(w * sc, sc);
  c.beginPath(); c.moveTo(-15, -22); c.lineTo(15, -22); c.quadraticCurveTo(16, 6, 0, 28); c.quadraticCurveTo(-16, 6, -15, -22); c.closePath();
  c.fillStyle = back ? tint(col, -.3) : col; c.fill(); c.lineWidth = 2.6 / sc; c.strokeStyle = '#17100e'; c.stroke();
  if (!back) { c.fillStyle = '#f2e6c4'; c.fillRect(-3, -18, 6, 36); c.fillRect(-12, -6, 24, 6); }
  c.restore();
}
function jtLance(c, x, y, dir, ang, L, col, part) {
  c.save(); c.translate(x, y); c.scale(dir, 1); c.rotate(ang);
  c.fillStyle = '#d8c39a'; c.beginPath(); c.moveTo(-L * .12, -3); c.lineTo(L * part, -1); c.lineTo(L * part, 1); c.lineTo(-L * .12, 3); c.closePath(); c.fill();
  c.strokeStyle = '#17100e'; c.lineWidth = 1.2; c.stroke();
  for (let i = 1; i < 6; i++) { const a = L * i / 7; if (a > L * part) break; c.strokeStyle = col; c.lineWidth = 2.4; c.beginPath(); c.moveTo(a, -2.4); c.lineTo(a + L * .05, 2.4); c.stroke(); }
  c.fillStyle = '#9aa0aa'; c.beginPath(); c.moveTo(L * .02, -9); c.lineTo(L * .13, -2.5); c.lineTo(L * .13, 2.5); c.lineTo(L * .02, 9); c.closePath(); c.fill(); c.strokeStyle = '#17100e'; c.lineWidth = 1; c.stroke();
  if (part < 1) { c.strokeStyle = '#d8c39a'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(L * part, 0); c.lineTo(L * part + 6 + i * 2, (i - 1.5) * 4); c.stroke(); } }
  c.restore();
}

/* ---------- the riders on the lists ---------- */
function jtRidersDraw(c) {
  const r = jtRiders() || (GP && GP.last ? GP.last.riders : [0, 0]), R0 = jtRidersNow(), z = JTC.zoom, C = GP && GP.ch, L = GP && GP.last;
  const after = GP && (GP.ph === 'after' || GP.ph === 'over') && L, broken = after ? L.broke : GP && GP.P ? GP.P.st.map(x => x.broke) : [false, false];
  const ri = after ? L.riders : r, plans = (C || (GP && GP.P)) && GP.plans ? GP.plans : after ? L.plans : GP && GP.plans ? GP.plans.map((p, s) => p || (GP.sel && s === GP.you ? GP.sel : null)) : [null, null];
  for (const s of [1, 0]) {
    // (the tilting yard, phase 5: a straw target on a post stands at the meeting point on the far side)
    if (G.yard && s === 1) { jtStrawDraw(c, jtScrX(JT_VIEW.meet), jtScrY(JT_VIEW.far), Math.max(z, 26) * .94); jtTiltDraw(c); continue; }
    // (in the wide shot the riders are drawn a little larger than the yard's scale, so they read)
    const x = jtScrX(R0.x[s]), y = jtScrY(s ? JT_VIEW.far : JT_VIEW.near), dir = s ? -1 : 1, k = Math.max(z, 26) * (s ? .94 : 1);
    if (x < -4 * k || x > JT_VIEW.w + 4 * k) { if (s === 1) jtTiltDraw(c); continue; }
    const plan = plans[s] || { guard: 'square', pace: 'canter' }, mount = G.mounts ? jtMountOf(s) : JT_MOUNT_DEF;
    const phase = JTC.t * (plan.pace === 'gallop' ? 15 : 11) + s * 1.7;
    const bob = jtHorse(c, x, y, k, dir, mount, G.teams[s].color || '#888', phase, R0.moving);
    // the couch: the CPU's from its ride (its moment from its couch error), yours as you hold it
    let lower = 0, couched = false, droop = 0;
    if (C) {
      if (C.mine && s === GP.you) { couched = C.down; lower = C.down ? 1 : 0; const e = jtCouchErr(C); droop = e != null && e < 0 ? -e : 0; }
      else { const rd = GP.cpuRides && GP.cpuRides[s], at = JT_PLAY.couch.ideal + (rd ? rd.couch : 0) * JT_PLAY.couch.span; lower = clamp((C.p - at) / .06, 0, 1); couched = lower >= 1; }
    } else if (GP && (GP.ph === 'seat' || after)) couched = true;
    const un = after && L.unhorsed && L.unhorsed.includes(s) ? clamp(GP.t / .7, 0, 1) : 0;
    jtRider(c, s, x, y, k, dir, { ri: ri ? ri[s] : 0, bob, guard: plan.guard, couched, lower, droop, broken: !!broken[s] && (after || (GP && GP.ph === 'seat')), fall: un });
    if (s === 1) jtTiltDraw(c);
  }
  // the splinters at the meeting point
  const mx = jtScrX(JT_VIEW.meet), my = jtScrY(0) - 2.2 * z;
  for (const f of (GP ? GP.fx : [])) {
    const a = 1 - f.t / f.life; c.save(); c.globalAlpha = a; c.translate(mx + f.x * z * .5, my + f.y * z * .5); c.rotate(f.r);
    if (f.spark) { c.fillStyle = '#fff2a8'; c.fillRect(-2, -2, 4, 4); } else { c.fillStyle = '#d8c39a'; c.fillRect(-z * .18, -1.5, z * .36, 3); }
    c.restore();
  }
}

/* ---------- the board, the call and your beats ---------- */
function jtBoardDraw(c) {
  const B = jtBoard(); if (!B) return;
  const n = B.courses, tl = B.tilt[0].length, cols = n * 2 + tl, w = 150 + cols * 24 + 46, x0 = 10, y0 = 10;
  c.save(); c.fillStyle = 'rgba(24,20,16,.78)'; rr(c, x0, y0, Math.min(w, JT_VIEW.w - 20), 62, 8); c.fill();
  for (const s of [0, 1]) {
    const y = y0 + 20 + s * 26, T = G.teams[s];
    c.fillStyle = T.color || '#888'; c.fillRect(x0 + 8, y - 9, 6, 18);
    txt(c, (T.name || '').replace(/ (Jousting )?Club$/, '').slice(0, 16), x0 + 20, y + 4, '700 13px "Alegreya Sans", sans-serif', '#f2ece0');
    let x = x0 + 150;
    for (let h = 0; h < 2; h++) for (let i = 0; i < n; i++, x += 24) jtFlag(c, x, y, B.sc[s][h][i], h === B.heat && i === B.course && !B.inTilt && !G.over, T.color);
    for (let i = 0; i < tl; i++, x += 24) jtFlag(c, x, y, B.tilt[s][i], false, '#e0b84a');
    txt(c, String(B.tot[s]), x + 12, y + 5, '800 16px "Alegreya Sans", sans-serif', '#ffe08a', 'center');
  }
  txt(c, B.inTilt && !G.over ? 'The tilt for the crown' : G.over ? 'Final' : `Heat ${B.heat + 1}`, x0 + 150, y0 + 8, '600 9px "Alegreya Sans", sans-serif', '#c8bfae');
  c.restore();
}
// a pennant for a course: its points on it, gold for a score, grey for nothing, red for a foul, a dark outline not yet ridden
function jtFlag(c, x, y, v, now, col) {
  c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 20, y); c.lineTo(x, y + 9); c.closePath();
  if (v == null) { c.strokeStyle = now ? '#ffe08a' : 'rgba(242,236,224,.35)'; c.lineWidth = now ? 2 : 1; c.stroke(); return; }
  c.fillStyle = v > 0 ? col : v < 0 ? '#b83a2a' : '#6a6458'; c.fill(); c.strokeStyle = '#f2ece0'; c.lineWidth = 1; c.stroke();
  if (v) txt(c, String(v), x + 7, y + 4, '800 11px "Alegreya Sans", sans-serif', '#fff', 'center');
}
function jtCallDraw(c) {
  if (!GP || !(GP.ph === 'after' || GP.ph === 'over') || !GP.call) return;
  const s = GP.call, W = Math.min(820, JT_VIEW.w - 40), x = (JT_VIEW.w - W) / 2, y = 92;
  c.save(); c.font = '700 16px "Alegreya Sans", sans-serif';
  const words = s.split(' '), lines = []; let cur = '';
  for (const wd of words) { const tr = cur ? cur + ' ' + wd : wd; if (c.measureText(tr).width > W - 40 && cur) { lines.push(cur); cur = wd; } else cur = tr; }
  if (cur) lines.push(cur);
  c.fillStyle = 'rgba(58,40,22,.9)'; rr(c, x, y, W, 22 + lines.length * 20, 10); c.fill(); c.strokeStyle = '#e0b84a'; c.lineWidth = 2; c.stroke();
  lines.forEach((l, i) => txt(c, l, JT_VIEW.w / 2, y + 26 + i * 20, '700 16px "Alegreya Sans", sans-serif', '#fff4d8', 'center'));
  c.restore();
}
// the target as your lance sees it: their shield by their guard, the body, the helm, your mark and your tip
function jtTargetDraw(c, plan, guard, tip) {
  const Z = JT_ZONE, g = guard === 'angled' ? 'angled' : 'square', k = JT_TGT.k, P = (x, y) => jtAimScr(x, y);
  c.save(); c.fillStyle = 'rgba(24,20,16,.78)'; rr(c, JT_TGT.x - JT_TGT.w / 2, JT_TGT.y - 124, JT_TGT.w, JT_TGT.h, 10); c.fill();
  txt(c, G.yard ? 'The straw target' : `Their guard: ${g}`, JT_TGT.x, JT_TGT.y - 106, '700 12px "Alegreya Sans", sans-serif', '#f2ece0', 'center');
  const box = (b, col) => { const [a1, a2] = P(b.x0, b.y1), [b1, b2] = P(b.x1, b.y0); c.fillStyle = col; c.fillRect(a1, a2, b1 - a1, b2 - a2); };
  box(Z.torso, '#8a7a66'); box(Z.shield[g], '#3a5a9a');
  const [hx, hy] = P(Z.helm.x, Z.helm.y); c.fillStyle = '#9aa0aa'; c.beginPath(); c.arc(hx, hy, Z.helm[g] * k, 0, 6.28); c.fill();
  const [lx, ly] = P(-12, Z.torso.y0); c.fillStyle = 'rgba(184,58,42,.35)'; c.fillRect(lx, ly, 24 * k, (Z.torso.y0 - Z.low) * k);
  txt(c, 'below the belt', JT_TGT.x, ly + 14, '600 10px "Alegreya Sans", sans-serif', '#f2c0b0', 'center');
  if (plan) { const A = JT_PLAN.aim[plan.aim], [ax, ay] = P(A.x, A.y); c.strokeStyle = '#ffe08a'; c.lineWidth = 2; c.beginPath(); c.arc(ax, ay, 9, 0, 6.28); c.stroke(); c.beginPath(); c.moveTo(ax - 13, ay); c.lineTo(ax + 13, ay); c.moveTo(ax, ay - 13); c.lineTo(ax, ay + 13); c.stroke(); }
  if (tip) { const [tx, ty] = P(clamp(tip.x, -36, 36), clamp(tip.y, -30, 34)); c.fillStyle = '#fff'; c.strokeStyle = '#17100e'; c.lineWidth = 2; c.beginPath(); c.arc(tx, ty, 6, 0, 6.28); c.fill(); c.stroke(); }
  c.restore();
}
function jtBeatsDraw(c) {
  const V = jtView(); if (!V) return;
  const C = V.charge;
  if (V.ph === 'plan' && V.sel) {
    jtTargetDraw(c, V.sel, V.plans && V.plans[1 - V.you] ? V.plans[1 - V.you].guard : 'square', null);
    return;
  }
  if (C && C.mine && V.ph === 'charge') {
    const x0 = 20, y0 = 500, w = 520;
    c.save(); c.fillStyle = 'rgba(24,20,16,.78)'; rr(c, x0 - 10, y0 - 34, w + 20, 100, 10); c.fill();
    // the charge's progress: the spur, then the couch's right moment
    const px = p => x0 + p * w;
    c.fillStyle = 'rgba(224,184,74,.25)'; c.fillRect(px(0), y0 + 26, px(JT_PLAY.spur.until) - px(0), 10);
    c.fillStyle = 'rgba(90,170,90,.55)'; c.fillRect(px(JT_PLAY.couch.ideal - .04), y0 + 26, px(.08) - px(0), 10);
    c.fillStyle = '#fff'; c.fillRect(px(C.p) - 1.5, y0 + 22, 3, 18);
    if (C.downAt != null) { c.fillStyle = '#ffe08a'; c.fillRect(px(C.downAt) - 1, y0 + 24, 2, 14); }
    txt(c, 'spur', px(JT_PLAY.spur.until / 2), y0 + 52, '600 11px "Alegreya Sans", sans-serif', '#e0b84a', 'center');
    txt(c, 'couch', px(JT_PLAY.couch.ideal), y0 + 52, '600 11px "Alegreya Sans", sans-serif', '#8ad08a', 'center');
    txt(c, 'impact', px(1) - 4, y0 + 52, '600 11px "Alegreya Sans", sans-serif', '#f2ece0', 'right');
    // the hoofbeats and your taps
    const b = jtBeat(C.pace), T = C.p * JT_PLAY.charge, span = JT_PLAY.spur.until * JT_PLAY.charge;
    if (C.p < JT_PLAY.spur.until) {
      for (let k = 1; k * b <= span + .01; k++) { const dx = (k * b - T) * 140; if (dx < -20 || dx > w) continue; const on = Math.abs(k * b - T) <= JT_PLAY.spur.win; c.fillStyle = on ? '#ffe08a' : '#c8a46a'; c.beginPath(); c.arc(x0 + 40 + dx, y0 + 6, on ? 8 : 5, 0, 6.28); c.fill(); }
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + 40, y0 - 6); c.lineTo(x0 + 40, y0 + 18); c.stroke();
      txt(c, `Tap with the hoofbeats: ${C.hits} on the beat${C.bad ? `, ${C.bad} off` : ''}`, x0, y0 - 14, '700 13px "Alegreya Sans", sans-serif', '#f2ece0');
    } else txt(c, C.down ? (C.p < JT_PLAY.couch.ideal - .05 ? 'Couched early: the arm tires' : 'Couched: keep the tip on your mark') : 'Hold to couch the lance!', x0, y0 - 6, '700 14px "Alegreya Sans", sans-serif', C.down ? '#8ad08a' : '#ffe08a');
    c.restore();
    jtTargetDraw(c, V.plans[V.you], V.plans[1 - V.you].guard, C.tip);
  }
  if (V.ph === 'seat' && V.seat) {
    const cx = JT_VIEW.w / 2 - 60, cy = 200, M = V.seat, a = clamp(M.w + M.lean, -1.6, 1.6);
    c.save(); c.fillStyle = 'rgba(24,20,16,.82)'; rr(c, cx - 170, cy - 110, 340, 150, 12); c.fill();
    txt(c, 'Keep your seat! Lean against the wobble', cx, cy - 86, '700 15px "Alegreya Sans", sans-serif', '#ffe08a', 'center');
    c.strokeStyle = '#6a6458'; c.lineWidth = 10; c.beginPath(); c.arc(cx, cy + 20, 100, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.strokeStyle = '#5aaa5a'; c.beginPath(); c.arc(cx, cy + 20, 100, Math.PI * 1.45, Math.PI * 1.55); c.stroke();
    const ang = -Math.PI / 2 + a * .55; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, cy + 20); c.lineTo(cx + Math.cos(ang) * 96, cy + 20 + Math.sin(ang) * 96); c.stroke();
    c.restore();
  }
}
function jtDraw(c, dt) {
  JTC.t += dt; jtCamTo(dt);
  c.clearRect(0, 0, JT_VIEW.w, JT_VIEW.h);
  if (!G || !G.teams) { c.fillStyle = '#c9a46c'; c.fillRect(0, 0, JT_VIEW.w, JT_VIEW.h); return; }
  jtListsDraw(c); jtRidersDraw(c); if (G.yard) jtYardBoardDraw(c); else jtBoardDraw(c); jtCallDraw(c); jtBeatsDraw(c);
}
