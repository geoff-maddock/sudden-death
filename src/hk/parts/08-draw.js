/* Black Ice: the rink, drawn (issue #83, phase 1). The Pond Rink from above and a little to one side: a frozen pond
   with boards round it, Rimewatch on the bank behind under a green northern sky, and the town on the snowbank
   watching. The rink is long, so there's a camera (phase 2): the whole sheet through the middle, and once the puck is
   in an end the picture pushes in on that end (hkCamStep) and swings back out with the puck when the play leaves. It
   is drawing only: HKT.cam, never G, and it stands still while the game is paused. Players are the inked figures
   (src/figures/figures.js) with a stick, sorted so the nearer ones stand in front; the puck carrier has a ring in their side's
   colour under them. By hand, your skater has a marker over them, a wind-up shows its bar and the target on the net,
   and a ring closes on the dot as the puck drops (hkDrawCues).
   The bar at the top has the score (underlined for the side with the puck), the period and the game clock, and each
   side's shots on goal. Under the rink, what just happened (GD.msg), and a line of the game so far. A goal or an icing
   puts a word on the ice for a moment; at the end, the final score.
   Rink space is metres (05-live.js); hkScr turns it into canvas pixels. */
const HKT = { t: 0, box: null, boxKey: '', bg: null, bgKey: '', cam: { u: 0, m: 0, end: 0, x: 480, y: 328, t: 0, g: null } };
// the figures' animation clock (src/figures/figures.js, the file every engine's scope loads)
function figClock() { return HKT.t; }
/* the camera: the whole sheet at a face-off at centre and at a break; in a live play `mid` times the size, following the
   puck across and up and down; and k times the size once the puck is within `in` metres of an end's boards (out again
   past `out`, so it doesn't flicker at the blue line). The picture is the canvas under the bar: top, h */
const HK_CAM = { k: 1.75, mid: 1.3, rate: 1.6, pan: 4.5, in: 12.5, out: 16.5, top: 64, h: 536 };
const HKC = { k: 1, left: 0, top: 64 };
const HK_PX = 21, HK_PY = 16, HK_X0 = 60, HK_Y0 = 328;
const hkScr = (x, y) => ({ x: HK_X0 + x * HK_PX, y: HK_Y0 + y * HK_PY });
// where a rink point is on the canvas, through the camera (the tests' handle)
const hkScrCam = (x, y) => { const p = hkScr(x, y); return { x: (p.x - HKC.left) * HKC.k, y: HK_CAM.top + (p.y - HKC.top) * HKC.k }; };
// the end the play is set in (0 the left, 1 the right), or null for the whole sheet
function hkCamAim() {
  const ph = GD.ph; if (ph === 'intro' || ph === 'break' || ph === 'over') return null;
  // (in the shootout: the end the try is at, once it's under way)
  if (ph === 'so') { const U = GD.so.cur; return U && U.st !== 'ready' ? (hkGoalX(U.side) > HK_RULES.len / 2 ? 1 : 0) : null; }
  const C = HKT.cam, x = ph === 'set' || ph === 'drop' ? GD.fo.x : L.puck.x;
  for (const e of [0, 1]) { const d = e ? HK_RULES.len - x : x; if (d < (C.u > 0 && C.end === e ? HK_CAM.out : HK_CAM.in)) return e; }
  return null;
}
function hkCamStep() {
  const C = HKT.cam; if (C.g !== G) { C.g = G; C.u = 0; C.m = 0; C.x = 480; C.y = HK_Y0; C.t = HKT.t; }
  const dt = clamp(HKT.t - C.t, 0, .25), aim = hkCamAim(), ph = GD.ph; C.t = HKT.t;
  if (aim != null) { C.end = aim; C.u = Math.min(1, C.u + dt * HK_CAM.rate); } else C.u = Math.max(0, C.u - dt * HK_CAM.rate);
  // in closer whenever the puck is in play (m), and closer again on an end (u)
  const near = ph === 'live' || ph === 'dead' || ((ph === 'set' || ph === 'drop') && GD.fo && GD.fo.x !== HK_RULES.len / 2) || aim != null;
  C.m = near ? Math.min(1, (C.m || 0) + dt * HK_CAM.rate) : Math.max(0, (C.m || 0) - dt * HK_CAM.rate);
  // it follows the puck (the face-off dot while they line up), so nobody is cut off at the edge
  const fo = (ph === 'set' || ph === 'drop') && GD.fo, at = hkScr(fo ? GD.fo.x : L.puck.x, fo ? GD.fo.y : L.puck.y);
  C.x += (at.x - C.x) * Math.min(1, dt * HK_CAM.pan); C.y += (at.y - C.y) * Math.min(1, dt * HK_CAM.pan);
  const sm = v => v * v * (3 - 2 * v), k = 1 + (HK_CAM.mid - 1) * sm(C.m || 0) + (HK_CAM.k - HK_CAM.mid) * sm(C.u), w = 960 / k, h = HK_CAM.h / k;
  HKC.k = k; HKC.left = clamp(C.x - w / 2, 0, 960 - w); HKC.top = clamp(C.y - h / 2, HK_CAM.top, HK_CAM.top + HK_CAM.h - h);
}
const HK_FONT = '"Alegreya Sans", system-ui, sans-serif';

function hkDraw(c) {
  c.fillStyle = '#0b1016'; c.fillRect(0, 0, 960, 600);
  if (!G || !GD || !L) return;
  const dens = c.getTransform().a || 1;
  hkCamStep();
  c.save(); c.beginPath(); c.rect(0, 64, 960, 536); c.clip();
  c.translate(-HKC.left * HKC.k, HK_CAM.top - HKC.top * HKC.k); c.scale(HKC.k, HKC.k);
  hkDrawBack(c, dens);
  hkDrawPond(c);
  if (G.hex) hkHexDrawIce(c);
  hkDrawMarks(c);
  hkDrawNets(c);
  hkDrawPlayers(c);
  hkDrawPuck(c);
  hkDrawCues(c);
  c.restore();
  hkDrawBig(c);
  hkDrawHud(c);
  hkDrawMsg(c);
}
// the boards' outline (or the ice inside them, m metres in) as a path: round corners
function hkRinkPath(c, m) {
  const a = hkScr(m, -HK_RULES.wid / 2 + m), b = hkScr(HK_RULES.len - m, HK_RULES.wid / 2 - m), rx = (HK_RULES.corner - m) * HK_PX, ry = (HK_RULES.corner - m) * HK_PY;
  c.beginPath();
  c.moveTo(a.x + rx, a.y); c.lineTo(b.x - rx, a.y); c.ellipse(b.x - rx, a.y + ry, rx, ry, 0, -Math.PI / 2, 0);
  c.lineTo(b.x, b.y - ry); c.ellipse(b.x - rx, b.y - ry, rx, ry, 0, 0, Math.PI / 2);
  c.lineTo(a.x + rx, b.y); c.ellipse(a.x + rx, b.y - ry, rx, ry, 0, Math.PI / 2, Math.PI);
  c.lineTo(a.x, a.y + ry); c.ellipse(a.x + rx, a.y + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
  c.closePath();
}
// what never moves (the sky, the town, the bank, the ice and its lines) is drawn once into a canvas of its own at the
// density it needs, and copied each frame; the crowd on the bank is drawn live over it
function hkDrawBack(c, dens) {
  // (a little denser than the canvas, so it stays sharp when the camera is in)
  const k = Math.min(3, dens * 1.6), key = `${k}|${G.teams[0].color}`;
  if (HKT.bgKey !== key) {
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.round(960 * k), Math.round(600 * k)) : Object.assign(document.createElement('canvas'), { width: Math.round(960 * k), height: Math.round(600 * k) });
    const b = cv.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0); hkDrawBank(b); hkDrawIce(b);
    HKT.bg = cv; HKT.bgKey = key;
  }
  c.drawImage(HKT.bg, 0, 0, 960, 600);
  hkDrawCrowd(c);
}
// the sky with its green light, Rimewatch's roofs and the abbey, and snow down to the pond
function hkDrawBank(c) {
  const sky = c.createLinearGradient(0, 64, 0, 150); sky.addColorStop(0, '#0b1420'); sky.addColorStop(1, '#17303a');
  c.fillStyle = sky; c.fillRect(0, 64, 960, 90);
  c.save(); c.globalAlpha = .28;
  for (let i = 0; i < 5; i++) { const g = c.createLinearGradient(0, 64, 0, 128); g.addColorStop(0, 'rgba(90,230,170,0)'); g.addColorStop(.5, 'rgba(90,230,170,.8)'); g.addColorStop(1, 'rgba(90,230,170,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(60 + i * 200, 64); c.bezierCurveTo(120 + i * 200, 90, 40 + i * 200, 110, 150 + i * 200, 130); c.lineTo(210 + i * 200, 130); c.bezierCurveTo(110 + i * 200, 108, 190 + i * 200, 88, 130 + i * 200, 64); c.fill(); }
  c.restore();
  // roofs, with lit windows; the abbey's tower in the middle
  for (let i = 0; i < 20; i++) {
    const x = i * 50 - 6, h = 22 + (i * 37 % 19), w = 42;
    c.fillStyle = '#131c26'; c.fillRect(x, 140 - h, w, h + 14);
    c.beginPath(); c.moveTo(x - 4, 140 - h); c.lineTo(x + w / 2, 126 - h); c.lineTo(x + w + 4, 140 - h); c.closePath(); c.fillStyle = '#dfe9ee'; c.fill();
    c.fillStyle = i % 3 ? '#f0c060' : '#2a3644'; c.fillRect(x + 9, 146 - h, 7, 8); c.fillStyle = i % 4 ? '#2a3644' : '#f0c060'; c.fillRect(x + 25, 146 - h, 7, 8);
  }
  c.fillStyle = '#101822'; c.fillRect(462, 70, 36, 84); c.beginPath(); c.moveTo(456, 72); c.lineTo(480, 44 + 22); c.lineTo(504, 72); c.closePath(); c.fillStyle = '#dfe9ee'; c.fill(); c.fillStyle = '#f0c060'; c.fillRect(475, 86, 10, 14);
  // the snowbank, and the snow round the pond
  const snow = c.createLinearGradient(0, 146, 0, 600); snow.addColorStop(0, '#dbe6ec'); snow.addColorStop(.12, '#c2d2dc'); snow.addColorStop(1, '#8fa3b2');
  c.fillStyle = snow; c.fillRect(0, 148, 960, 452);
  c.fillStyle = '#e9f1f5'; c.beginPath(); c.moveTo(0, 152); for (let x = 0; x <= 960; x += 40) c.quadraticCurveTo(x + 20, 142 + (x * 13 % 9), x + 40, 152); c.lineTo(960, 160); c.lineTo(0, 160); c.closePath(); c.fill();
}
// a row of townsfolk on the bank, in scarves, bobbing a little
function hkDrawCrowd(c) {
  for (let i = 0; i < 44; i++) {
    if (!engSeat(i)) continue;
    // (they bob a little, and jump when the bank roars)
    const roar = G.pond && G.pond.roar ? 1 : 0, x = 34 + i * 20.6, b = Math.sin(HKT.t * (roar ? 9 : 2) + i * 1.3) * (roar ? 3.5 : 1.4), y = 158 + (i % 3) * 3 + b;
    c.fillStyle = ['#3c4a5a', '#5a4a3c', '#4a3c52', '#2f4a44'][i % 4]; rr(c, x - 8, y, 16, 15, 4); c.fill();
    c.fillStyle = ['#d9b79a', '#b8c8d8', '#9fb89a', '#e0c8b0'][i % 4]; c.beginPath(); c.arc(x, y - 4, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = i % 5 === 0 ? G.teams[1].color : G.teams[0].color; c.fillRect(x - 7, y + 1, 14, 3);
  }
}
function hkDrawIce(c) {
  const R = HK_RULES, hw = R.wid / 2, a = hkScr(0, -hw), b = hkScr(R.len, hw), m = hkScr(R.len / 2, 0);
  // the boards: a dark shadow, the cream boards, then the ice
  c.save(); c.translate(0, 5); hkRinkPath(c, -.28); c.fillStyle = 'rgba(20,34,46,.45)'; c.fill(); c.restore();
  hkRinkPath(c, -.28); c.fillStyle = '#efe6cf'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#17100e'; c.stroke();
  hkRinkPath(c, 0); const ice = c.createLinearGradient(0, a.y, 0, b.y); ice.addColorStop(0, '#d6e6ee'); ice.addColorStop(.5, '#eaf4f8'); ice.addColorStop(1, '#d2e2ec'); c.fillStyle = ice; c.fill();
  c.save(); hkRinkPath(c, 0); c.clip();
  // darker water showing through the pond ice, and old skate cuts
  c.globalAlpha = .1; c.fillStyle = '#2a4a5e';
  for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(a.x + 90 + i * 118 + (i * 37 % 40), a.y + 60 + (i * 83 % 200), 70 + (i * 29 % 50), 26 + (i * 17 % 20), (i * .7) % 1.2, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = .22; c.strokeStyle = '#7f9fb2'; c.lineWidth = 1;
  for (let i = 0; i < 60; i++) { const x = a.x + (i * 137 % (b.x - a.x)), y = a.y + (i * 89 % (b.y - a.y)), r = 14 + (i * 23 % 30); c.beginPath(); c.arc(x, y, r, (i * .9) % 6, (i * .9) % 6 + .9); c.stroke(); }
  c.globalAlpha = 1;
  const vline = (x, col, w) => { const p = hkScr(x, 0); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(p.x, a.y); c.lineTo(p.x, b.y); c.stroke(); };
  const red = 'rgba(200,58,58,.85)', blue = 'rgba(58,106,184,.85)';
  // the creases, then the lines painted on
  for (const gx of [R.goal, R.len - R.goal]) { const g = hkScr(gx, 0), s = gx < R.len / 2 ? 1 : -1; c.fillStyle = 'rgba(120,170,230,.45)'; c.beginPath(); c.ellipse(g.x, g.y, R.crease * HK_PX, (R.net + .5) * HK_PY, 0, -Math.PI / 2, Math.PI / 2, s < 0); c.closePath(); c.fill(); c.strokeStyle = red; c.lineWidth = 1.5; c.stroke(); }
  vline(R.goal, red, 2); vline(R.len - R.goal, red, 2); vline(R.blue, blue, 6); vline(R.len - R.blue, blue, 6); vline(R.len / 2, red, 6);
  c.strokeStyle = blue; c.lineWidth = 2; c.beginPath(); c.ellipse(m.x, m.y, 3 * HK_PX, 3 * HK_PY, 0, 0, Math.PI * 2); c.stroke(); c.fillStyle = blue; c.beginPath(); c.ellipse(m.x, m.y, 5, 4, 0, 0, Math.PI * 2); c.fill();
  for (const x of HK_DOTS.x) for (const y of [-HK_DOTS.y, HK_DOTS.y]) { const p = hkScr(x, y); c.strokeStyle = red; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x, p.y, 3 * HK_PX, 3 * HK_PY, 0, 0, Math.PI * 2); c.stroke(); c.fillStyle = red; c.beginPath(); c.ellipse(p.x, p.y, 5, 4, 0, 0, Math.PI * 2); c.fill(); }
  for (const x of [R.blue + 1.5, R.len - R.blue - 1.5]) for (const y of [-HK_DOTS.y, HK_DOTS.y]) { const p = hkScr(x, y); c.fillStyle = red; c.beginPath(); c.ellipse(p.x, p.y, 4, 3, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // the kick plate along the near boards, and the rink's name on it
  hkRinkPath(c, 0); c.lineWidth = 2.5; c.strokeStyle = '#c9a23a'; c.stroke();
  c.save(); c.font = `800 10px ${HK_FONT}`; c.textAlign = 'center'; c.fillStyle = 'rgba(40,60,76,.75)'; try { c.letterSpacing = '3px'; } catch (e) {} c.fillText('THE POND RINK', m.x, b.y + 17); c.restore();
}
/* the Pond Rink's own ways (13-pond.js), on the ice: the snow that has built up in its patches, the old stretches of
   boards (dull where a puck dies, pale where it jumps), and the crack a big hit left */
function hkDrawPond(c) {
  const D = G.pond; if (!D) return;
  c.save();
  for (const s of D.snow) { if (s.d < .04) continue; const p = hkScr(s.x, s.y), g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, s.r * HK_PX);
    g.addColorStop(0, `rgba(255,255,255,${.25 + s.d * .65})`); g.addColorStop(.7, `rgba(250,252,255,${.15 + s.d * .45})`); g.addColorStop(1, 'rgba(250,252,255,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, s.r * HK_PX, s.r * HK_PY, 0, 0, Math.PI * 2); c.fill(); }
  for (const b of D.boards) { const y = (b.wall === 'top' ? -1 : 1) * HK_RULES.wid / 2, a = hkScr(b.x - b.w / 2, y), z = hkScr(b.x + b.w / 2, y);
    c.strokeStyle = b.e < .5 ? '#6b5a48' : '#fff6d8'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(a.x, a.y + (b.wall === 'top' ? -3 : 3)); c.lineTo(z.x, z.y + (b.wall === 'top' ? -3 : 3)); c.stroke(); }
  if (D.crack) { const p = hkScr(D.crack.x, D.crack.y), r = D.crack.r * HK_PX;
    c.strokeStyle = 'rgba(30,60,80,.75)'; c.lineWidth = 1.6; c.lineJoin = 'round';
    for (let k = 0; k < 7; k++) { const a = k * .9 + .3; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(a) * r * .45, p.y + Math.sin(a) * r * .34); c.lineTo(p.x + Math.cos(a + .35) * r * (.7 + (k % 3) * .12), p.y + Math.sin(a + .35) * r * .62); c.stroke(); }
    c.fillStyle = 'rgba(30,60,80,.25)'; c.beginPath(); c.ellipse(p.x, p.y, r * .3, r * .22, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
// the marks ultimates leave on the ice: a ring in the caster's colour, pulsing, with the power's name
function hkDrawMarks(c) {
  for (const m of G.marks || []) {
    const p = hkScr(m.x, m.y), T = G.teams[m.side], k = 1 + Math.sin(HKT.t * 4) * .06;
    c.save(); c.globalAlpha = .22; c.fillStyle = T.color; c.beginPath(); c.ellipse(p.x, p.y, m.r * HK_PX * k, m.r * HK_PY * k, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .9; c.strokeStyle = T.light || '#fff'; c.lineWidth = 2; c.setLineDash([6, 5]); c.lineDashOffset = -HKT.t * 20; c.stroke(); c.restore();
    txt(c, m.n, p.x, p.y + 4, `800 11px ${HK_FONT}`, 'rgba(20,34,46,.85)', 'center');
  }
}
// the nets: red posts and a white mesh, from each goal line back
function hkDrawNets(c) {
  for (const [x0, x1, y0, y1] of hkNets()) {
    const a = hkScr(x0, y0), b = hkScr(x1, y1), front = x0 < HK_RULES.len / 2 ? b.x : a.x, shake = GD.net && (GD.net.end === (x0 < HK_RULES.len / 2 ? 0 : 1)) ? Math.max(0, 1 - (HKT.t - (GD.net.at == null ? (GD.net.at = HKT.t) : GD.net.at)) * 1.4) : 0;
    c.save();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    c.strokeStyle = 'rgba(120,140,160,.7)'; c.lineWidth = .8;
    for (let y = a.y + 4; y < b.y; y += 5) { c.beginPath(); c.moveTo(a.x, y); c.lineTo(b.x, y + Math.sin(HKT.t * 30 + y) * shake * 2); c.stroke(); }
    for (let x = a.x + 4; x < b.x; x += 5) { c.beginPath(); c.moveTo(x, a.y); c.lineTo(x + Math.sin(HKT.t * 30 + x) * shake * 2, b.y); c.stroke(); }
    c.strokeStyle = '#c83a3a'; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
    const back = front === b.x ? a.x : b.x; c.moveTo(front, a.y); c.lineTo(back, a.y); c.lineTo(back, b.y); c.lineTo(front, b.y); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(front, a.y); c.lineTo(front, a.y - 1); c.moveTo(front, b.y); c.lineTo(front, b.y + 1); c.stroke();
    c.restore();
  }
}
// the penalty box, behind the far boards at centre: whoever is serving, with the seconds they have left
function hkDrawBox(c) {
  const n = [0, 0];
  for (const b of G.box) {
    const p = L.pl.find(q => q.side === b.side && q.ri === b.ri); if (!p) continue;
    const k = n[b.side]++, s = hkScr(HK_RULES.len / 2 + (b.side ? 1 : -1) * (1.5 + k * 1.5), -HK_RULES.wid / 2 - .55), T = G.teams[b.side];
    c.save(); c.fillStyle = 'rgba(13,9,7,.75)'; rr(c, s.x - 14, s.y - 34, 28, 38, 4); c.fill(); c.restore();
    drawFig(c, p.kind, s.x, s.y, 30, T, { num: p.num, flip: b.side === 1, noShadow: true });
    c.save(); rr(c, s.x - 13, s.y - 47, 26, 13, 3); c.fillStyle = T.color; c.fill(); c.restore();
    txt(c, `0:${String(Math.max(0, Math.ceil(b.t))).padStart(2, '0')}`, s.x, s.y - 37, `700 10px ${HK_FONT}`, '#fff', 'center');
  }
}
// a stick: from the hands down to a blade on the ice, out the way the player faces
function hkDrawStick(c, p, s, goalie) {
  const bx = s.x + p.fx * (goalie ? .6 : .78) * HK_PX, by = s.y + p.fy * .78 * HK_PY + 1, swing = p.act === 'wind' ? -14 : p.act === 'shoot' || p.act === 'pass' ? 4 : 0;
  c.save(); c.lineCap = 'round';
  c.strokeStyle = '#17100e'; c.lineWidth = goalie ? 5.5 : 3.5; c.beginPath(); c.moveTo(s.x + p.fx * 4, s.y - 17); c.lineTo(bx, by + swing); c.lineTo(bx + p.fx * 6 - p.fy * 3, by + swing + p.fy * 4 + 1); c.stroke();
  c.strokeStyle = goalie ? '#e9e2d0' : '#c9a66a'; c.lineWidth = goalie ? 3.5 : 1.8; c.beginPath(); c.moveTo(s.x + p.fx * 4, s.y - 17); c.lineTo(bx, by + swing); c.lineTo(bx + p.fx * 6 - p.fy * 3, by + swing + p.fy * 4 + 1); c.stroke();
  c.restore();
}
// knocked off their skates: leaning over, legs apart
const HK_DOWN = { drop: 2, lean: .95, legL: { a: .9, lift: .2 }, legR: { a: -.6, lift: 0 } };
function hkDrawPlayers(c) {
  const U = GD.ph === 'so' ? GD.so.cur : null, h = hkHand();
  const me = !hkHandsOn() ? -1 : GD.ph === 'drop' ? hkTaker(GD.you) : GD.ph === 'live' ? hkMe() : U && U.st !== 'done' ? (U.side === GD.you ? U.i : U.gi) : -1;
  hkDrawBox(c);
  const list = L.pl.map((p, i) => ({ p, i })).filter(o => !o.p.off).sort((a, b) => a.p.y - b.p.y);
  for (const { p, i } of list) {
    const s = hkScr(p.x, p.y), T = G.teams[p.side], sp = hyp(p.vx, p.vy), mv = sp > .8, goalie = hkIsGk(p);
    if (i === h) { c.save(); c.strokeStyle = T.color; c.lineWidth = 3; c.beginPath(); c.ellipse(s.x, s.y, 16, 6, 0, 0, Math.PI * 2); c.stroke(); c.strokeStyle = T.light || '#fff'; c.lineWidth = 1.2; c.stroke(); c.restore(); }
    // a power going for their side: a glow under them (gold for an ultimate), brighter under whoever cast it
    const fxOn = (G.fxs || []).filter(e => e.side === p.side && e.k !== 'sit'); if (fxOn.length && !goalie) { const ult = fxOn.some(e => e.k === 'ult'), mineCast = fxOn.some(e => e.ri === p.ri), a = .28 + Math.sin(HKT.t * 7 + i) * .1 + (mineCast ? .25 : 0);
      c.save(); const g = c.createRadialGradient(s.x, s.y, 2, s.x, s.y, 24); g.addColorStop(0, ult ? `rgba(255,200,90,${a})` : `rgba(110,200,255,${a})`); g.addColorStop(1, 'rgba(110,200,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(s.x, s.y, 24, 10, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    // the skater you play: a dashed ring, and a mark over their head
    if (i === me) { c.save(); c.strokeStyle = '#ffe04a'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.ellipse(s.x, s.y, 20, 8, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.fillStyle = '#ffe04a'; c.strokeStyle = '#17100e'; c.lineWidth = 1.2; const y = s.y - 56 + Math.sin(HKT.t * 5) * 2; c.beginPath(); c.moveTo(s.x - 6, y); c.lineTo(s.x + 6, y); c.lineTo(s.x, y + 8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    // skate cuts behind a fast skater
    if (sp > 5) { c.save(); c.globalAlpha = .35; c.strokeStyle = '#8fb0c4'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(s.x - 3, s.y + 1); c.lineTo(s.x - p.vx * 2.2 - 3, s.y - p.vy * 1.7 + 1); c.moveTo(s.x + 3, s.y + 1); c.lineTo(s.x - p.vx * 2.2 + 3, s.y - p.vy * 1.7 + 1); c.stroke(); c.restore(); }
    const behind = p.fy < -.2; if (behind) hkDrawStick(c, p, s, goalie);
    if (goalie) { c.save(); c.fillStyle = '#efe6cf'; c.strokeStyle = '#17100e'; c.lineWidth = 1.5; rr(c, s.x - 11, s.y - 13, 22, 13, 3); c.fill(); c.stroke(); c.restore(); }
    const down = p.act === 'down';
    drawFig(c, p.kind, s.x, s.y, goalie ? 46 : 44, T, { num: p.num, run: mv && !goalie ? p.run : 0, flip: p.fx < 0, throwK: p.act === 'shoot' || p.act === 'wind' ? 1 : 0, lift: p.act === 'save' ? 4 : 0, alpha: p.stun > 0 && !down ? .8 : 1, pose: down ? HK_DOWN : undefined });
    if (!behind) hkDrawStick(c, p, s, goalie);
    // by hand: how much each of your skaters has left, under their feet (red when they need the bench)
    if (hkHandsOn() && p.side === GD.you && !goalie && GD.ph !== 'so') { const st = hkSta(p); c.save(); c.fillStyle = 'rgba(13,9,7,.7)'; c.fillRect(s.x - 11, s.y + 8, 22, 4); c.fillStyle = st < HK_STA.tired ? '#ff6a4a' : st < .7 ? '#ffd08a' : '#8fe07a'; c.fillRect(s.x - 10, s.y + 9, 20 * st, 2); c.restore(); }
  }
}
function hkDrawPuck(c) {
  const P = L.puck, s = hkScr(P.x, P.y), v = hyp(P.vx, P.vy);
  if (GD.ph === 'over' || GD.ph === 'break' || (GD.ph === 'so' && !GD.so.cur)) return;
  c.save();
  // a fast puck leaves a streak
  if (P.st === 'free' && v > 12) { c.strokeStyle = 'rgba(20,24,30,.3)'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - P.vx * HK_PX * .035, s.y - P.vy * HK_PY * .035); c.stroke(); }
  // (in the drop beat it falls from the official's hand)
  const lift = GD.ph === 'drop' ? Math.max(0, 1 - GD.t / HK_PACE.drop) * 14 : GD.ph === 'set' || GD.ph === 'intro' ? 14 : 0;
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(s.x, s.y + 1.5, 5, 2.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#14181e'; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.ellipse(s.x, s.y - lift, 4.6, 2.8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(s.x - 1, s.y - lift - .8, 2.2, 1, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}
/* by hand: the wind-up's bar beside your shooter (the first notch is a wrist shot; past it, a slap shot that gets
   harder as it fills) with the target marked on the net, and at a face-off a ring closing on the dot (green in the
   moment to press) */
function hkDrawCues(c) {
  if (!hkHandsOn()) return;
  const M = GD.meter;
  if (M && L.pl[M.i]) {
    const p = L.pl[M.i], s = hkScr(p.x, p.y), u = clamp(M.t / HK_HANDS.full, 0, 1), x = s.x - (p.fx < 0 ? -24 : 24) - 4, y = s.y - 46, H = 38, tap = HK_HANDS.tap / HK_HANDS.full;
    c.save();
    rr(c, x, y, 8, H, 3); c.fillStyle = 'rgba(13,9,7,.8)'; c.fill();
    c.fillStyle = M.t < HK_HANDS.tap ? '#bfe8a8' : '#ffb24a'; c.fillRect(x + 1.5, y + H - 1.5 - (H - 3) * u, 5, (H - 3) * u);
    c.fillStyle = '#f3ead6'; c.fillRect(x, y + H - 1.5 - (H - 3) * tap, 8, 1.2);
    // the target, from the way you're steering now
    const dir = hkDir(p.side), t = hkAimTarget(dir), g = L.pl[hkGk(1 - p.side)], q = hkScr(hkGoalX(p.side), t === 'five' ? clamp(g.y, -.5, .5) : t.y * .85);
    c.strokeStyle = '#ffe04a'; c.lineWidth = 2; c.beginPath(); c.arc(q.x, q.y - (t !== 'five' && t.hi ? 7 : 0), 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(q.x - 8, q.y - (t !== 'five' && t.hi ? 7 : 0)); c.lineTo(q.x + 8, q.y - (t !== 'five' && t.hi ? 7 : 0)); c.stroke();
    c.restore();
  }
  if (GD.ph === 'drop' && GD.fo) {
    const q = hkScr(GD.fo.x, GD.fo.y), left = Math.max(0, HK_PACE.drop - GD.t), now = left <= HK_HANDS.drop, r = 8 + left * 60;
    c.save(); c.strokeStyle = GD.press != null ? 'rgba(243,234,214,.5)' : now ? '#8fe07a' : '#ffe04a'; c.lineWidth = 3; c.beginPath(); c.ellipse(q.x, q.y, r, r * .76, 0, 0, Math.PI * 2); c.stroke();
    // (and the words, so it's plain what to do and when)
    const say = GD.press != null ? 'Pressed' : now ? 'SPACE now!' : 'Space when the ring closes';
    c.font = `800 13px ${HK_FONT}`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(13,9,7,.85)'; c.strokeText(say, q.x, q.y + 46); c.fillStyle = now && GD.press == null ? '#8fe07a' : '#f3ead6'; c.fillText(say, q.x, q.y + 46); c.restore();
  }
}
// a big moment in big letters on the ice, for a moment; and at the end, the final
const HK_BIG = { hole: ['SWALLOWED', '#c8b8ff', 1.2], goal: ['GOAL!', '#ffd08a', 1.8], icing: ['ICING', '#ff8a6a', 1.2], hit: ['BIG HIT', '#ffd08a', .9], penalty: ['PENALTY', '#ff8a6a', 1.4], nogoal: ['NO GOAL', '#ff8a6a', 1] };
function hkDrawBig(c) {
  let word = null, col = '#ffd08a', sub = '', al = 1, sc = 1;
  if (GD.ph === 'intro' && G.hex) { word = 'HEXES'; col = '#c8b8ff'; sub = hkHexNames(); }
  else if (GD.ph === 'over') { word = 'FINAL'; sub = `${G.teams[0].name} ${G.score[0]}, ${G.teams[1].name} ${G.score[1]}${G.over && G.over.so ? ' (shootout)' : G.over && G.over.ot ? ' (sudden death)' : ''}`; }
  else if (GD.ph === 'so' && !GD.so.cur && !G.so.tries[0] && !G.so.tries[1]) { word = 'SHOOTOUT'; sub = `${HK_RULES.so} tries each, then one each until it's settled.`; }
  else if (GD.ph === 'break') { word = hkOt() ? 'SUDDEN DEATH' : `END OF THE ${hkPeriodName(G.p - 1).toUpperCase()}`; if (hkOt()) sub = 'Three skaters a side. The next goal wins.'; }
  else if (GD.big && (HK_BIG[GD.big.k] || GD.big.w)) {
    if (GD.big.at == null) GD.big.at = HKT.t;
    // (a power's own name, in its colour: an ultimate in gold)
    const [w, cl, len] = GD.big.w ? [GD.big.w.toUpperCase(), GD.big.k === 'ult' ? '#ffd08a' : '#bfe0ff', GD.big.k === 'ult' ? 1.6 : 1.1] : HK_BIG[GD.big.k], a = HKT.t - GD.big.at; if (a > len) { GD.big = null; return; }
    word = w; col = cl; al = Math.min(1, a * 5, (len - a) * 2.5); sc = 1 + Math.max(0, .25 - a) * 1.6;
  }
  if (!word) return;
  c.save(); c.globalAlpha = al; c.translate(480, 322); c.scale(sc, sc);
  c.font = `900 50px ${HK_FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
  c.lineWidth = 8; c.strokeStyle = 'rgba(12,10,9,.85)'; c.strokeText(word, 0, 0); c.fillStyle = col; c.fillText(word, 0, 0);
  if (sub) { c.font = `700 22px ${HK_FONT}`; c.lineWidth = 5; c.strokeText(sub, 0, 32); c.fillStyle = '#f3ead6'; c.fillText(sub, 0, 32); }
  c.restore();
}
function hkDrawHud(c) {
  c.fillStyle = '#0d0907'; c.fillRect(0, 0, 960, 64);
  const F = (n, w) => `${w} ${n}px ${HK_FONT}`, dim = 'rgba(243,234,214,.62)', live = GD.ph !== 'over';
  for (const s of [0, 1]) {
    const T = G.teams[s], al = s ? 'right' : 'left', X = x => s ? 960 - x : x, has = live && G.poss === s && GD.ph === 'live';
    c.fillStyle = T.color; c.fillRect(s ? 930 : 20, 10, 10, 44);
    let name = T.name; c.font = F(19, 800); while (name.length > 4 && c.measureText(name).width > 250) name = name.slice(0, -2).trimEnd() + '…';
    txt(c, name, X(40), 28, F(19, 800), '#f3ead6', al);
    const empty = live && GD.ph !== 'so' && !hkInNet(s);
    txt(c, `Shots ${G.sog[s]}${empty ? ' · empty net' : ''}`, X(40), 49, F(12, 600), empty ? '#ffb070' : dim, al);
    txt(c, String(G.score[s]), X(398), 47, F(40, 900), has ? T.light || '#fff' : '#f3ead6', 'center');
    if (has) { c.fillStyle = T.color; c.fillRect(X(398) - 16, 53, 32, 4); }
    // mana (a diamond each, whole ones lit) and the roar (the bank's spirit, gold when it will pay for an ultimate)
    if (G.powers) {
      txt(c, 'Mana', X(150), 49, F(11, 600), dim, al);
      for (let i = 0; i < HK_MANA.max; i++) { const x = X(184 + i * 9) + (s ? -4 : 0), on = i < Math.floor(G.mana[s] + 1e-9); c.save(); c.translate(x + 4, 45); c.rotate(Math.PI / 4); c.fillStyle = on ? '#7fd4ff' : '#2a2420'; c.fillRect(-3.2, -3.2, 6.4, 6.4); c.restore(); }
      txt(c, 'Roar', X(262), 49, F(11, 600), dim, al);
      const bx = s ? 960 - 292 - 56 : 292, w = 56 * clamp(G.spirit[s] / HK_SPIRIT.max, 0, 1);
      c.fillStyle = '#2a2420'; c.fillRect(bx, 41, 56, 7); c.fillStyle = G.spirit[s] >= HK_SPIRIT.ult && !G.ultUsed[s] ? '#ffd08a' : '#c98a4a'; c.fillRect(s ? bx + 56 - w : bx, 41, w, 7);
    }
  }
  // what each side has going: a power's name and the seconds it has left, under its end of the bar
  for (const s of [0, 1]) { let k = 0; for (const e of G.fxs || []) { if (e.side !== s) continue; const t = `${e.n} ${e.id === 'manup' || e.id === 'killit' ? '' : Math.ceil(e.t)}`.trim(); c.save(); c.font = F(11, 700); const w = c.measureText(t).width + 14, x = s ? 960 - 20 - w : 20, y = 66 + k * 20;
    rr(c, x, y, w, 17, 4); c.fillStyle = e.k === 'ult' ? '#8a6420' : '#23425e'; c.fill(); c.restore(); txt(c, t, x + w / 2, y + 12.5, F(11, 700), '#fff', 'center'); k++; } }
  c.save(); rr(c, 436, 8, 88, 48, 6); c.fillStyle = '#1c1512'; c.fill(); c.restore();
  txt(c, GD.ph === 'so' ? 'Shootout' : hkPeriodName(G.p), 480, 25, F(12, 700), dim, 'center');
  txt(c, GD.ph === 'so' ? `${G.so.goals[0]}–${G.so.goals[1]}` : hkClockText(), 480, 48, F(22, 900), G.clock < 10 && live ? '#ff8a6a' : '#ffd08a', 'center');
  // under the clock: the man advantage and how long is left of it, or a penalty that is coming
  if (G.hex) hkHexDrawHud(c, live && GD.ph !== 'so' && (GD.delay || G.box.length) ? 90 : 66);
  if (!live || GD.ph === 'so') return;
  const n = hkStrength(), D = GD.delay, up = n[0] > n[1] ? 0 : n[1] > n[0] ? 1 : -1, first = G.box.length ? Math.min(...G.box.map(b => b.t)) : 0;
  const pill = D ? ['PENALTY COMING', G.teams[D.side].color] : up >= 0 ? [`POWER PLAY  ${n[up]} on ${n[1 - up]}  0:${String(Math.ceil(first)).padStart(2, '0')}`, G.teams[up].color] : G.box.length ? [`${n[0]} ON ${n[1]}  0:${String(Math.ceil(first)).padStart(2, '0')}`, '#5a5048'] : null;
  if (!pill) return;
  c.save(); c.font = F(12, 800); const w = c.measureText(pill[0]).width + 22; rr(c, 480 - w / 2, 66, w, 20, 5); c.fillStyle = pill[1]; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#0d0907'; c.stroke(); c.restore();
  txt(c, pill[0], 480, 80, F(12, 800), '#fff', 'center');
}
function hkDrawMsg(c) {
  c.save(); rr(c, 150, 508, 660, 30, 6); c.fillStyle = 'rgba(13,9,7,.82)'; c.fill(); c.restore();
  let m = GD.msg || ''; c.font = `600 17px ${HK_FONT}`; while (m.length > 12 && c.measureText(m).width > 640) m = m.slice(0, -2).trimEnd() + '…';
  txt(c, m, 480, 529, `600 17px ${HK_FONT}`, '#f3ead6', 'center');
  const key = `${L.evN || 0}|${G.log.length}|${GD.ph}`;
  if (HKT.boxKey !== key) { HKT.boxKey = key; HKT.box = hkBox(); }
  // under it: the system of the side with the puck against the other side's, green when it suits and red when it doesn't
  if (G.call && GD.ph !== 'so' && GD.ph !== 'over') {
    const s = G.poss, n = hkStrength(), e = hkEdgeNow(s), stale = n[0] === n[1] ? G.scout[s].n : 0;
    const line = `${G.teams[s].short}: ${hkAttNow(s).n} against ${hkDefNow(1 - s).n}${stale ? ` · scouted${stale > 1 ? ' twice' : ''}` : ''}`;
    c.save(); c.font = `600 13px ${HK_FONT}`; const w = c.measureText(line).width + 20; rr(c, 480 - w / 2, 551, w, 21, 5); c.fillStyle = 'rgba(13,9,7,.78)'; c.fill(); c.restore();
    txt(c, line, 480, 566, `600 13px ${HK_FONT}`, e[0] > 0 ? '#bfe8a8' : e[0] < 0 ? '#ff9a7a' : '#f3ead6', 'center');
    return;
  }
  const line = HKT.box.map(b => `${b.team}: ${b.tot.hit} hits · ${b.tot.fow} of ${b.tot.fot} face-offs · ${b.tot.blk} blocks`).join('     ');
  txt(c, line, 480, 566, `600 13px ${HK_FONT}`, '#1c2c3a', 'center');
}
