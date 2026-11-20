/* The Curling Shed: drawing (issue #102, phase 2). The picture is 960 by 600:
   - on the left, the sheet from behind the hack, in perspective: the pebbled ice with frost creeping in at the boards,
     the hog line, the house's rings (blue twelve-foot, white eight, red four, the button), the stones (granite, their
     handles in their side's colour), the broom where your skip holds it, and the stone sliding with its sweepers. The
     camera sits back to show the house while a stone is called, follows the stone down the sheet, and settles over the
     house when it stops.
   - on the right, the house from above, big: every stone in it, the broom and the call, the path of the stone in play,
     and under it the whole sheet as a strip.
   - over the left, the end board (each side's points by end, the hammer); the weight meter while you swing; the
     skip's call while your stone slides ("Hurry hard!"), and the brooms going while you sweep.
   Drawing only: nothing here is in the game's state. crScr and crUnscr map the ice to the left picture and back,
   crHouseScr and crHouseUn the house picture (the tests and the pointer use them). Witch-light lamps hang from the
   Shed's beams, and the breath of the sweepers smokes in the cold. */
const CR_VIEW = { cx: 310, hor: 96, base: 590, px: 2.6, d0: 300, w: 620, hx: 790, hy: 175, hk: 1.55, sx: 655, sy: 360, sw: 270, sh: 230 };
const CRC = { camY: -700, t: 0 };
const crS = y => CR_VIEW.d0 / Math.max(20, y - CRC.camY + CR_VIEW.d0);
function crScr(x, y) { const V = CR_VIEW, s = crS(y); return [V.cx - x * s * V.px, V.hor + (V.base - V.hor) * s, s]; }
function crUnscr(sx, sy) { const V = CR_VIEW, s = (sy - V.hor) / (V.base - V.hor); if (s <= .02) return null; return { x: -(sx - V.cx) / (s * V.px), y: V.d0 / s - V.d0 + CRC.camY }; }
// the house picture: the button at (hx, hy), hk pixels an inch, the thrower at the bottom
const crHouseScr = (x, y) => [CR_VIEW.hx - x * CR_VIEW.hk, CR_VIEW.hy - y * CR_VIEW.hk];
const crHouseUn = (sx, sy) => ({ x: -(sx - CR_VIEW.hx) / CR_VIEW.hk, y: -(sy - CR_VIEW.hy) / CR_VIEW.hk });
// the stones as drawn now: [[id, x, y]] (the run's, while one slides; else the game's)
function crStonesNow() { const X = GP && GP.X; return X ? crRunNow(X.Q) : (G.stones || []).map(st => [st.id, st.x, st.y]); }
const crSideOf = id => +String(id).split(':')[0];
function crCamTarget() {
  const X = GP && GP.X; if (X) { const T = X.Q.T; return clamp(T.y - 260, -1300, -300); }
  if (GP && (GP.ph === 'rest' || GP.ph === 'over')) return -300;
  return -560;
}
function crPoly(c, pts, fill) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill(); }
function crRing(c, r, fill) { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, p = crScr(Math.cos(a) * r, Math.sin(a) * r); pts.push(p); } crPoly(c, pts, fill); }
function crStoneDraw(c, x, y, s, col, k) {
  const r = CR_SHEET.stoneR * k, [sx, sy] = [x, y];
  c.save(); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(sx, sy + r * .2, r * 1.05, r * .55 * s, 0, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(sx - r * .3, sy - r * .4, r * .1, sx, sy, r); g.addColorStop(0, '#d9d6cf'); g.addColorStop(1, '#6d6a66');
  c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, r, r * s, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(30,25,20,.55)'; c.lineWidth = Math.max(.6, r * .08); c.stroke();
  c.fillStyle = col; c.beginPath(); c.ellipse(sx, sy - r * .1 * s, r * .55, r * .3 * s, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}
// the sheet in perspective
function crSheetDraw(c) {
  const S = CR_SHEET, y0 = Math.max(-1200, CRC.camY - CR_VIEW.d0 * .7), y1 = S.back + 60, q = (x, y) => crScr(x, y).slice(0, 2);
  // the Shed: timber walls in the dark, witch-light lamps on the beams
  const g = c.createLinearGradient(0, 0, 0, CR_VIEW.hor + 30); g.addColorStop(0, '#0e1418'); g.addColorStop(1, '#243038'); c.fillStyle = g; c.fillRect(0, 0, CR_VIEW.w, CR_VIEW.hor + 30);
  for (let i = 0; i < 7; i++) { const x = 40 + i * 90, f = .6 + .4 * Math.sin(CRC.t * 2.6 + i * 1.7), gl = c.createRadialGradient(x, 30, 1, x, 30, 26); gl.addColorStop(0, `rgba(160,230,255,${.5 * f})`); gl.addColorStop(1, 'rgba(160,230,255,0)'); c.fillStyle = gl; c.beginPath(); c.arc(x, 30, 26, 0, Math.PI * 2); c.fill(); c.fillStyle = '#dff6ff'; c.fillRect(x - 2, 26, 4, 7); }
  crPoly(c, [q(S.halfW + 14, y0), q(-S.halfW - 14, y0), q(-S.halfW - 14, y1), q(S.halfW + 14, y1)], '#3a2c22');
  crPoly(c, [q(S.halfW, y0), q(-S.halfW, y0), q(-S.halfW, y1 - 20), q(S.halfW, y1 - 20)], '#e9f2f6');
  // the pebble, faint; frost creeping in at the boards
  c.save(); c.fillStyle = 'rgba(150,180,200,.18)';
  for (let i = 0; i < 160; i++) { const x = ((i * 53) % 180) - 90, y = y0 + ((i * 131) % Math.max(1, y1 - y0)); const [px, py, s] = crScr(x, y); if (s > .04) c.fillRect(px, py, Math.max(1, 1.4 * s * 3), Math.max(1, s * 2)); }
  for (const side of [1, -1]) { const pts = [q(side * S.halfW, y0), q(side * S.halfW, y1 - 20), q(side * (S.halfW - 10), y1 - 20), q(side * (S.halfW - 6), y0)]; crPoly(c, pts, 'rgba(255,255,255,.55)'); }
  c.restore();
  // the house's rings and the lines
  crRing(c, 72, '#3c78c8'); crRing(c, 48, '#f4f8fa'); crRing(c, 24, '#c83a3a'); crRing(c, 6, '#f4f8fa');
  const line = (y, col, w) => { if (y < y0) return; const [a1, a2] = q(S.halfW, y), [b1, b2] = q(-S.halfW, y); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a1, a2); c.lineTo(b1, b2); c.stroke(); };
  line(-S.hog, '#c83a3a', 3); line(0, '#2a3a48', 1); line(S.back, '#2a3a48', 1.2);
  const [c1, c2] = q(0, y0), [d1, d2] = q(0, S.back); c.strokeStyle = 'rgba(42,58,72,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(c1, c2); c.lineTo(d1, d2); c.stroke();
}
// the broom: where your skip holds it while a stone is called
function crBroomDraw(c, x, y, col) { const [sx, sy, s] = crScr(x, y); c.save(); c.strokeStyle = col; c.lineWidth = Math.max(1.5, 3 * s); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 4 * s * 6, sy - 30 * s * 6 / 2); c.stroke(); c.fillStyle = col; c.beginPath(); c.ellipse(sx, sy, 9 * s * 2.6, 4 * s * 2.6, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
function crLeftDraw(c) {
  crSheetDraw(c);
  const S = GP && GP.sel, X = GP && GP.X;
  if (GP && (GP.ph === 'aim' || GP.ph === 'swing') && S) crBroomDraw(c, S.x, S.y, '#ffd34a');
  const st = crStonesNow().slice().sort((a, b) => b[2] - a[2]);
  for (const [id, x, y] of st) { const [sx, sy, s] = crScr(x, y); if (s < .03) continue; crStoneDraw(c, sx, sy, .55, G.teams[crSideOf(id === 'new' && X ? X.s : id)].color || '#888', s * CR_VIEW.px); }
  // the sweepers at the stone, brooms going while it is swept
  if (X && X.Q.sw > 0) { const T = X.Q.T, [sx, sy, s] = crScr(T.x, T.y + 18); c.save(); c.strokeStyle = '#e7d9b0'; c.lineWidth = Math.max(1, 3 * s);
    for (const k of [-1, 1]) { const w = Math.sin(CRC.t * 22 + k) * 10 * s * 2.6; c.beginPath(); c.moveTo(sx + k * 14 * s * 2.6 + w, sy); c.lineTo(sx + k * 24 * s * 2.6, sy - 22 * s * 2.6); c.stroke(); }
    c.fillStyle = 'rgba(230,245,255,.35)'; c.beginPath(); c.arc(sx, sy - 30 * s * 2.6, 8 * s * 2.6, 0, Math.PI * 2); c.fill(); c.restore(); }
}
// the house from above, and the sheet strip
function crRightDraw(c) {
  const V = CR_VIEW, k = V.hk;
  c.save(); c.fillStyle = '#16222a'; c.fillRect(V.w, 0, 960 - V.w, 600);
  c.beginPath(); c.rect(V.w + 10, 18, 960 - V.w - 20, 300); c.clip();
  c.fillStyle = '#e9f2f6'; c.fillRect(V.w + 10, 18, 960 - V.w - 20, 300);
  for (const [r, col] of [[72, '#3c78c8'], [48, '#f4f8fa'], [24, '#c83a3a'], [6, '#f4f8fa']]) { c.fillStyle = col; c.beginPath(); c.arc(V.hx, V.hy, r * k, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#2a3a48'; c.lineWidth = 1; c.beginPath(); c.moveTo(V.w, V.hy); c.lineTo(960, V.hy); c.moveTo(V.hx, 0); c.lineTo(V.hx, 330); c.stroke();
  const by = crHouseScr(0, CR_SHEET.back)[1]; c.beginPath(); c.moveTo(V.w, by); c.lineTo(960, by); c.stroke();
  // the path of the stone in play, and the call
  const X = GP && GP.X; if (X) { c.strokeStyle = 'rgba(40,60,90,.45)'; c.lineWidth = 1.5; c.beginPath(); X.Q.path.forEach(([x, y], i) => { const [px, py] = crHouseScr(x, y); i ? c.lineTo(px, py) : c.moveTo(px, py); }); const T = X.Q.T, [tx, ty] = crHouseScr(T.x, T.y); c.lineTo(tx, ty); c.stroke(); }
  const S = GP && GP.sel; if (GP && (GP.ph === 'aim' || GP.ph === 'swing') && S) { const [bx, by2] = crHouseScr(S.x, S.y); c.strokeStyle = '#d8a400'; c.lineWidth = 2.5; c.beginPath(); c.arc(bx, by2, 9, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(bx - 13, by2); c.lineTo(bx + 13, by2); c.moveTo(bx, by2 - 13); c.lineTo(bx, by2 + 13); c.stroke(); }
  for (const [id, x, y] of crStonesNow()) { const [sx, sy] = crHouseScr(x, y); crStoneDraw(c, sx, sy, 1, G.teams[crSideOf(id === 'new' && X ? X.s : id)].color || '#888', k); }
  c.restore();
  // the whole sheet as a strip, the stones on it as dots
  const top = 340, bot = 590, Y = y => bot - (y - CR_STONE.y0) / (CR_SHEET.back + 40 - CR_STONE.y0) * (bot - top), Xs = x => 910 - x * .18;
  c.save(); c.fillStyle = '#e9f2f6'; c.fillRect(Xs(CR_SHEET.halfW), top, CR_SHEET.halfW * 2 * .18, bot - top);
  c.fillStyle = '#3c78c8'; c.beginPath(); c.arc(Xs(0), Y(0), 72 * .18, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c83a3a'; c.beginPath(); c.arc(Xs(0), Y(0), 24 * .18, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#c83a3a'; c.fillRect(Xs(CR_SHEET.halfW), Y(-CR_SHEET.hog) - 1, CR_SHEET.halfW * 2 * .18, 2);
  for (const [id, x, y] of crStonesNow()) { c.fillStyle = G.teams[crSideOf(id === 'new' && X ? X.s : id)].color || '#888'; c.beginPath(); c.arc(Xs(x), Y(y), 3, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#cfe2ec'; c.font = '11px system-ui, sans-serif'; c.textAlign = 'left';
  c.fillText(`The ice: ${CR_COLD[G.cold].n}`, V.w + 14, 352); c.fillText('The sheet', V.w + 14, 368);
  c.restore();
}
// the end board: each side's points by end, the totals and the hammer
function crBoardDraw(c) {
  const B = crBoard(), n = B.ends, w = 22, x0 = 12, y0 = 12, nameW = 150;
  c.save(); c.fillStyle = 'rgba(10,16,20,.8)'; c.fillRect(x0, y0, nameW + n * w + 50, 56);
  c.font = '600 12px system-ui, sans-serif'; c.textBaseline = 'middle';
  for (let i = 0; i < n; i++) { c.fillStyle = i === B.end ? '#ffd34a' : '#9fb4c0'; c.textAlign = 'center'; c.fillText(String(i + 1), x0 + nameW + i * w + w / 2, y0 + 9); }
  [0, 1].forEach(s => { const y = y0 + 25 + s * 19, T = G.teams[s]; c.fillStyle = T.color || '#888'; c.fillRect(x0 + 4, y - 7, 5, 14); c.fillStyle = '#eef4f6'; c.textAlign = 'left'; c.fillText(`${T.short || T.name}${B.hammer === s && !G.over ? ' ●' : ''}`, x0 + 14, y);
    for (let i = 0; i < n; i++) { const v = B.sc[s][i]; c.textAlign = 'center'; c.fillStyle = v ? '#fff' : 'rgba(255,255,255,.35)'; c.fillText(v == null ? '' : String(v), x0 + nameW + i * w + w / 2, y); }
    c.textAlign = 'right'; c.fillStyle = '#ffd34a'; c.fillText(String(B.tot[s]), x0 + nameW + n * w + 40, y); });
  c.restore();
}
function crMeterDraw(c) {
  const M = GP && GP.meter; if (!M || GP.ph !== 'swing') return;
  const K = CR_PLAY.meter, x = 584, top = 150, bot = 470, Y = v => bot - (v - K.low) / (K.high - K.low) * (bot - top);
  c.save(); c.fillStyle = 'rgba(10,16,20,.8)'; c.fillRect(x - 16, top - 10, 32, bot - top + 20);
  const g = c.createLinearGradient(0, bot, 0, top); g.addColorStop(0, '#5aa0e0'); g.addColorStop(.5, '#4caa48'); g.addColorStop(1, '#c84a3a'); c.fillStyle = g; c.fillRect(x - 8, top, 16, bot - top);
  c.fillStyle = '#ffd34a'; c.fillRect(x - 13, Y(K.line + K.win), 26, Y(K.line - K.win) - Y(K.line + K.win));
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x + 10, Y(M.v)); c.lineTo(x + 20, Y(M.v) - 6); c.lineTo(x + 20, Y(M.v) + 6); c.fill();
  c.font = '11px system-ui, sans-serif'; c.fillStyle = '#eef4f6'; c.textAlign = 'center'; c.fillText('Heavy', x, top - 16); c.fillText('Light', x, bot + 22);
  c.restore();
}
function crCallDraw(c) {
  const X = GP && GP.X; if (!X || !GP.call) return;
  const mine = crYours(X.s);
  c.save(); c.font = `800 ${GP.call.length > 12 ? 26 : 34}px system-ui, sans-serif`; c.textAlign = 'center';
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillText(GP.call, CR_VIEW.cx + 2, 172); c.fillStyle = GP.call.startsWith('Hurry') ? '#ffd34a' : GP.call.startsWith('Sweep') ? '#ffe9a0' : '#cfe8ff'; c.fillText(GP.call, CR_VIEW.cx, 170);
  if (mine) { c.font = '13px system-ui, sans-serif'; c.fillStyle = '#eef4f6'; c.fillText(GP.sweep ? 'Sweeping…' : 'Hold Space to sweep', CR_VIEW.cx, 196); }
  c.restore();
}
function crDraw(c, dt) {
  if (!G || !G.teams || !GP) { c.fillStyle = '#16222a'; c.fillRect(0, 0, 960, 600); return; }
  CRC.t += dt || 0;
  // (the camera eases toward where it should be; still while the game is held, but in place on the first picture)
  const want = crCamTarget(); if (dt || !CRC.drawn) CRC.camY += (want - CRC.camY) * Math.min(1, dt ? dt * 3 : 1); CRC.drawn = true;
  c.fillStyle = '#16222a'; c.fillRect(0, 0, 960, 600);
  c.save(); c.beginPath(); c.rect(0, 0, CR_VIEW.w, 600); c.clip();
  crLeftDraw(c); crMeterDraw(c); crCallDraw(c); crBoardDraw(c);
  c.restore();
  crRightDraw(c);
}
