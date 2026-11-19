/* The Saltmere Lanes: drawing (issue #100, phase 2). The picture is 960 by 600:
   - on the left, the lane from behind the bowler, in perspective. The camera follows the ball down the lane and stops
     over the pin deck for the hit (blCam), so the pins are big enough to read. The boards, the arrows at 15 feet, the
     gutters and the foul line; the bowler at the foul line while you set up and swing; your guide line (where a
     perfect ball goes on a fresh lane), your feet and your arrow; the ball; the pins, standing and falling. The
     release meter stands at the right edge of this view while you swing.
   - on the right, the whole lane from above, TV style: the oil as a blue sheen (the dry track shows as the game
     goes), the tracks of the last few balls on this lane, and the pins; and the rack in front of the bowler, big.
   Drawing only: nothing here is in the game's state. blScr and blUnscr map the lane to the picture and back (the tests
   and the pointer use them). */
const BL_VIEW = { cx: 320, hor: 110, base: 585, px: 6.5, d0: 160, ovX: 668, ovW: 64, ovTop: 36, ovBot: 576 };
const BLC = { camY: -40, tracks: [[], []], flash: 0 };

// the camera's place down the lane: at the foul line while you set up, following the ball, then over the deck
function blCamTarget() {
  const A = GP && GP.ph === 'roll' ? blAnimNow() : null;
  if (A && A.ball) return clamp(A.ball.y - 230, -40, 565);
  if (GP && (GP.ph === 'rest' || GP.ph === 'over') && GP.anim) return 565;
  return -40;
}
const blS = y => BL_VIEW.d0 / Math.max(20, y - BLC.camY + BL_VIEW.d0);
function blScr(x, y) { const V = BL_VIEW, s = blS(y); return [V.cx - x * s * V.px, V.hor + (V.base - V.hor) * s, s]; }
// the lane point under a point of the picture (on the lane's surface)
function blUnscr(sx, sy) {
  const V = BL_VIEW, s = (sy - V.hor) / (V.base - V.hor); if (s <= 0.02) return null;
  const y = V.d0 / s - V.d0 + BLC.camY; return { x: -(sx - V.cx) / (s * V.px), y };
}
// the overhead strip: lane inches to the picture, and back
const blOvY = y => BL_VIEW.ovBot - (y / (BL_LANE.pit + 6)) * (BL_VIEW.ovBot - BL_VIEW.ovTop);
const blOvX = x => BL_VIEW.ovX + BL_VIEW.ovW / 2 - x * BL_VIEW.ovW / BL_LANE.w;
function blOvUn(sx, sy) { const V = BL_VIEW; return { x: -(sx - V.ovX - V.ovW / 2) * BL_LANE.w / V.ovW, y: (V.ovBot - sy) / (V.ovBot - V.ovTop) * (BL_LANE.pit + 6) }; }

function blPoly(c, pts, fill) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill(); }
// a pin standing at lane (x, y), or lying (dir: the way it fell)
function blPinDraw(c, x, y, up, dir) {
  const [sx, sy, s] = blScr(x, y), r = BL_LANE.pinR * s * BL_VIEW.px;
  if (r < .6) return;
  c.save();
  if (up) {
    const h = r * 5.2;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(sx, sy, r * 1.1, r * .45, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f6f1e4'; c.strokeStyle = 'rgba(40,25,15,.55)'; c.lineWidth = Math.max(.5, r * .12);
    c.beginPath(); c.moveTo(sx - r * .55, sy); c.bezierCurveTo(sx - r * 1.25, sy - h * .35, sx - r * .3, sy - h * .62, sx - r * .38, sy - h * .8);
    c.arc(sx, sy - h * .86, r * .42, Math.PI, 0); c.lineTo(sx + r * .38, sy - h * .8); c.bezierCurveTo(sx + r * .3, sy - h * .62, sx + r * 1.25, sy - h * .35, sx + r * .55, sy);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c0302a'; c.fillRect(sx - r * .36, sy - h * .7, r * .72, Math.max(1, h * .045)); c.fillRect(sx - r * .34, sy - h * .64, r * .68, Math.max(1, h * .03));
  } else {
    c.translate(sx, sy); c.rotate(dir || 0); c.fillStyle = '#e8e1d0'; c.strokeStyle = 'rgba(40,25,15,.5)'; c.lineWidth = Math.max(.5, r * .1);
    c.beginPath(); c.ellipse(0, 0, r * 2.4, r * .62, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#c0302a'; c.fillRect(r * .9, -r * .55, r * .18, r * 1.1);
  }
  c.restore();
}
function blBallDraw(c, x, y, col) {
  const [sx, sy, s] = blScr(x, y), r = BL_LANE.ballR * s * BL_VIEW.px;
  c.save(); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sx, sy, r * 1.05, r * .4, 0, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(sx - r * .35, sy - r * 1.35, r * .1, sx, sy - r, r * 1.05); g.addColorStop(0, '#fff'); g.addColorStop(.25, col || '#3a5a9a'); g.addColorStop(1, '#0d0a14');
  c.fillStyle = g; c.beginPath(); c.arc(sx, sy - r, r, 0, Math.PI * 2); c.fill(); c.restore();
}
// the bowler at the foul line: their side's colour, the arm swinging with the meter
function blBowlerDraw(c, x, col) {
  const [sx, sy, s] = blScr(x, -26), k = s * BL_VIEW.px * .8, M = GP && GP.meter;
  const arm = M ? (M.st === 'up' ? -M.v * 2.4 : M.st === 'down' ? (M.v - .2) * 2.4 : 0) : 0;
  c.save(); c.translate(sx, sy); c.strokeStyle = '#1d140f'; c.lineWidth = Math.max(1, k * .9); c.lineCap = 'round';
  c.beginPath(); c.moveTo(-k * 2, 0); c.lineTo(-k * .6, -k * 9); c.moveTo(k * 2.2, 0); c.lineTo(k * .6, -k * 9); c.stroke();
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -k * 13, k * 3.4, k * 5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e3c6a0'; c.beginPath(); c.arc(0, -k * 20, k * 2.4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = Math.max(1, k * 1.4); c.beginPath(); c.moveTo(-k * 2.6, -k * 15); c.lineTo(-k * 2.6 + Math.sin(arm) * k * 8, -k * 15 + Math.cos(arm) * k * 8); c.stroke();
  c.restore();
}
function blMeterDraw(c) {
  const M = GP && GP.meter; if (!M || GP.ph !== 'swing') return;
  const K = BL_METER, x = 590, top = 150, bot = 470, Y = v => bot - (v - K.low) / (K.top - K.low) * (bot - top);
  const p = M.p == null ? (M.st === 'up' ? M.v : 1) : M.p, win = (M.win || K.win) * (p > 1 ? K.pwin : 1);
  // a big moment shakes the mark (a steady nerve, less)
  const jit = M.shake ? Math.sin(performance.now() / 45) * M.shake * 6 : 0;
  c.save(); c.fillStyle = 'rgba(15,10,8,.78)'; c.fillRect(x - 16, top - 10, 32, bot - top + 20);
  c.fillStyle = '#4a3a30'; c.fillRect(x - 8, top, 16, bot - top);
  c.fillStyle = '#b8402a'; c.fillRect(x - 8, Y(K.top), 16, Y(1) - Y(K.top));
  c.fillStyle = '#4caa48'; c.fillRect(x - 8, Y(win) + jit, 16, Y(-win) - Y(win));
  c.strokeStyle = '#ffd34a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 12, Y(1)); c.lineTo(x + 12, Y(1)); c.stroke();
  if (M.p != null) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 14, Y(M.p)); c.lineTo(x + 14, Y(M.p)); c.stroke(); }
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x + 10, Y(M.v)); c.lineTo(x + 20, Y(M.v) - 6); c.lineTo(x + 20, Y(M.v) + 6); c.fill();
  c.font = '11px system-ui, sans-serif'; c.fillStyle = '#efe4cc'; c.textAlign = 'center'; c.fillText(M.st === 'up' ? 'Speed' : 'Release', x, bot + 22);
  c.restore();
}
// the lane in perspective
function blLaneDraw(c) {
  const L = BL_LANE, y0 = Math.max(-60, BLC.camY - BL_VIEW.d0 * .7), y1 = L.pit + 8;
  const q = (x, y) => blScr(x, y).slice(0, 2);
  blPoly(c, [q(L.kick + 6, y0), q(-L.kick - 6, y0), q(-L.kick - 6, y1), q(L.kick + 6, y1)], '#2a1d16');
  blPoly(c, [q(L.edge + L.gutter, y0), q(L.edge, y0), q(L.edge, Math.min(y1, L.len + 40)), q(L.edge + L.gutter, Math.min(y1, L.len + 40))], '#3b2c22');
  blPoly(c, [q(-L.edge, y0), q(-L.edge - L.gutter, y0), q(-L.edge - L.gutter, Math.min(y1, L.len + 40)), q(-L.edge, Math.min(y1, L.len + 40))], '#3b2c22');
  blPoly(c, [q(L.edge, y0), q(-L.edge, y0), q(-L.edge, L.len + 40), q(L.edge, L.len + 40)], '#d9b27c');
  // the boards, a darker line every fifth; the pit behind the deck
  c.save(); c.lineWidth = .6;
  for (let b = 1; b < L.boards; b++) { const x = blBoardX(b + .5); c.strokeStyle = b % 5 === 0 ? 'rgba(110,60,25,.35)' : 'rgba(110,60,25,.13)'; const [a1, a2] = q(x, y0), [b1, b2] = q(x, L.len + 40); c.beginPath(); c.moveTo(a1, a2); c.lineTo(b1, b2); c.stroke(); }
  blPoly(c, [q(L.kick, L.len + 40), q(-L.kick, L.len + 40), q(-L.kick, y1), q(L.kick, y1)], '#120c09');
  // the foul line, the dots at 7 feet and the arrows at 15
  if (y0 < 0) { const [a1, a2] = q(L.edge, 0), [b1, b2] = q(-L.edge, 0); c.strokeStyle = '#3a1f12'; c.lineWidth = 2; c.beginPath(); c.moveTo(a1, a2); c.lineTo(b1, b2); c.stroke(); }
  c.fillStyle = 'rgba(60,30,15,.7)';
  for (const b of [5, 10, 15, 20, 25, 30, 35]) {
    const x = blBoardX(b), [ax, ay, s] = blScr(x, L.arrows), w = 1.4 * s * BL_VIEW.px, h = 5 * s * BL_VIEW.px;
    if (s > .05) { c.beginPath(); c.moveTo(ax, ay - h); c.lineTo(ax - w, ay + h * .3); c.lineTo(ax + w, ay + h * .3); c.fill(); }
    const [dx, dy, s2] = blScr(x, 84); if (s2 > .05 && b % 10 === 5) { c.beginPath(); c.arc(dx, dy, .9 * s2 * BL_VIEW.px, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
function blGuideDraw(c) {
  if (!GP || GP.mode !== 'play' || (GP.ph !== 'aim' && GP.ph !== 'swing') || !GP.sel) return;
  const g = blGuide(), S = GP.sel; if (!g) return;
  c.save(); c.setLineDash([6, 5]); c.strokeStyle = 'rgba(255,211,74,.85)'; c.lineWidth = 2; c.beginPath();
  g.path.forEach(([x, y], i) => { const [sx, sy] = blScr(x, y); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }); c.stroke(); c.setLineDash([]);
  // your arrow and your feet
  const [ax, ay, s] = blScr(blBoardX(S.arrow), BL_LANE.arrows); c.strokeStyle = '#ffd34a'; c.lineWidth = 2.5; c.beginPath(); c.arc(ax, ay, 9 * s * BL_VIEW.px / 1.6, 0, Math.PI * 2); c.stroke();
  const [fx, fy] = blScr(blBoardX(S.stand), 0); c.fillStyle = '#ffd34a'; c.beginPath(); c.moveTo(fx, fy - 8); c.lineTo(fx - 7, fy + 4); c.lineTo(fx + 7, fy + 4); c.fill();
  c.restore();
}
// the whole lane from above, with its oil
function blOverDraw(c) {
  const V = BL_VIEW, L = BL_LANE, s = blUp() >= 0 ? blUp() : (GP && GP.anim ? GP.anim.s : 0), lane = GP && GP.ph === 'roll' && GP.anim ? GB && GB.lane : blLane(s >= 0 ? s : 0), oil = G.oil[lane || 0];
  c.save();
  c.fillStyle = '#1a120d'; c.fillRect(V.ovX - 10, V.ovTop - 18, V.ovW + 20, V.ovBot - V.ovTop + 30);
  c.fillStyle = '#d9b27c'; c.fillRect(V.ovX, blOvY(L.len + 40), V.ovW, blOvY(0) - blOvY(L.len + 40));
  const cw = V.ovW / L.boards, ch = blOvY(0) - blOvY(12);
  // on your ball, the oil only as far as your bowler reads it
  const mine = GP && GP.mode === 'play' && (GP.ph === 'aim' || GP.ph === 'swing') && s === GP.you, readFt = mine ? blReadFt(s) : L.ft;
  for (let b = 0; b < L.boards; b++) for (let f = 0; f < Math.min(readFt, 40 + 12); f++) { const o = oil[b * L.ft + f]; if (o < .02) continue; c.fillStyle = `rgba(110,170,240,${Math.min(.6, o * .5)})`; c.fillRect(V.ovX + V.ovW - (b + 1) * cw, blOvY((f + 1) * 12), cw + .2, ch + .2); }
  if (readFt < L.ft) { c.fillStyle = 'rgba(40,30,25,.55)'; c.fillRect(V.ovX, blOvY(L.len + 40), V.ovW, blOvY(readFt * 12) - blOvY(L.len + 40)); c.strokeStyle = 'rgba(255,211,74,.7)'; c.beginPath(); c.moveTo(V.ovX - 4, blOvY(readFt * 12)); c.lineTo(V.ovX + V.ovW + 4, blOvY(readFt * 12)); c.stroke(); }
  c.fillStyle = 'rgba(60,30,15,.8)'; for (const b of [5, 10, 15, 20, 25, 30, 35]) c.fillRect(blOvX(blBoardX(b)) - 1, blOvY(L.arrows) - 2, 2, 4);
  // the last balls' tracks on this lane, then the one rolling
  const tr = BLC.tracks[lane || 0] || [];
  tr.forEach((P, i) => { c.strokeStyle = `rgba(60,30,90,${.2 + .2 * i / Math.max(1, tr.length)})`; c.lineWidth = 1.2; c.beginPath(); P.forEach(([x, y], j) => j ? c.lineTo(blOvX(x), blOvY(y)) : c.moveTo(blOvX(x), blOvY(y))); c.stroke(); });
  const A = GP && GP.ph === 'roll' ? blAnimNow() : null;
  if (A && A.ball) { c.fillStyle = '#2a1840'; c.beginPath(); c.arc(blOvX(A.ball.x), blOvY(A.ball.y), 3, 0, Math.PI * 2); c.fill(); }
  const pins = blPinsNow(s);
  for (const [n, x, y, up] of pins) { c.fillStyle = up ? '#fff' : 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(blOvX(x), blOvY(y), 1.6, 0, Math.PI * 2); c.fill(); }
  c.font = '11px system-ui, sans-serif'; c.fillStyle = '#efe4cc'; c.textAlign = 'center';
  c.fillText(`Lane ${(lane || 0) + 1}`, V.ovX + V.ovW / 2, V.ovTop - 6);
  c.fillStyle = 'rgba(110,170,240,.9)'; c.fillText('oil', V.ovX + V.ovW / 2, V.ovBot + 14);
  c.restore();
}
// the pins as drawn now: [n, x, y, up]. While they fly, from the trace; while the ball is on the lane, the rack it is
// rolling at; after the hit, that rack with what fell lying down; otherwise the rack in front of the side up
function blPinsNow(s) {
  const A = GP && GP.anim;
  const at = (sp, n) => (sp && sp[n]) || BL_SPOT[n];
  if (A && GP.ph === 'roll') { const N = blAnimNow(); if (N && N.pins) return N.pins.filter(p => !p[4]).map(p => [p[0], p[1], p[2], p[3]]); return A.before.map(n => [n, ...at(A.spots, n), 1]); }
  if (A && (GP.ph === 'rest' || GP.ph === 'over') && GB) return A.before.map(n => [n, ...at(A.spots, n), GB.deck.down.includes(n) ? 0 : 1]);
  const sp = s >= 0 && G.hall ? blHallSpots(s) : null;
  return (s >= 0 ? G.stand[s] : []).map(n => [n, ...at(sp, n), 1]);
}
// the rack, big, at the top right: standing white, down grey
function blRackDraw(c, s) {
  const pins = blPinsNow(s), up = new Set(pins.filter(p => p[3]).map(p => p[0])), cx = 860, cy = 70, k = 12;
  c.save(); c.fillStyle = 'rgba(15,10,8,.6)'; c.fillRect(760, 20, 190, 120);
  for (let n = 1; n <= 10; n++) { const [x, y] = BL_SPOT[n], px = cx - x / 6 * k, py = cy + 50 - (y - BL_LANE.len) / BL_LANE.row * k * 1.6;
    c.fillStyle = up.has(n) ? '#f6f1e4' : 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(px, py, 8, 0, Math.PI * 2); c.fill();
    const O = G.hall && G.offspot && G.offspot[s]; if (O && O.n === n && up.has(n) && (!GP || GP.ph !== 'roll')) { c.strokeStyle = '#ff9a7a'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 10.5, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = up.has(n) ? '#3a2a22' : 'rgba(255,255,255,.35)'; c.font = '10px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(String(n), px, py + 3.5); }
  c.restore();
}
function blHudDraw(c) {
  const V = blView(), s = V ? (V.up >= 0 ? V.up : GP && GP.anim ? GP.anim.s : 0) : 0, T = G.teams;
  c.save(); c.font = '600 14px system-ui, sans-serif'; c.textAlign = 'left';
  [0, 1].forEach(k => { c.fillStyle = 'rgba(15,10,8,.7)'; c.fillRect(12, 12 + k * 26, 230, 22); c.fillStyle = T[k].color || '#888'; c.fillRect(12, 12 + k * 26, 5, 22);
    c.fillStyle = '#efe4cc'; c.fillText(`${T[k].name}`, 24, 28 + k * 26); c.textAlign = 'right'; c.fillText(String(blTotal(k)), 236, 28 + k * 26); c.textAlign = 'left'; });
  if (V && V.up >= 0) { c.font = '13px system-ui, sans-serif'; c.fillStyle = 'rgba(15,10,8,.7)'; c.fillRect(12, 66, 300, 20); c.fillStyle = '#efe4cc';
    const st = blStyleOf(V.up, V.bowler); c.fillText(`Frame ${V.frame} · ${blName(V.up, V.bowler)} · ${st.hand < 0 ? 'left' : 'right'}-handed, ${st.mph} mph`, 18, 81); }
  // the powers: each side's mana and roar, and the frame's mark
  if (G.powers) { c.font = '11px system-ui, sans-serif'; [0, 1].forEach(k => { c.fillStyle = 'rgba(15,10,8,.7)'; c.fillRect(244, 12 + k * 26, 104, 22); c.fillStyle = '#9fc6e8'; c.textAlign = 'left'; c.fillText(`mana ${G.mana[k]} · roar ${G.roar[k]}`, 250, 27 + k * 26); }); }
  if (G.powers && G.mark) { c.font = '600 12px system-ui, sans-serif'; c.fillStyle = '#e8b0ff'; c.textAlign = 'left'; c.fillText(`${G.mark.n} marks frame ${G.mark.f + 1} (${G.teams[G.mark.side].short || G.teams[G.mark.side].name})`, 18, 122); }
  if (G.tide && G.tide !== 'mid') { c.fillStyle = '#9fc6e8'; c.font = '12px system-ui, sans-serif'; c.fillText(G.tide === 'high' ? 'High tide: the lanes play heavy' : 'Low tide: the lanes play dry', 18, 104); }
  // a strike, a spare, a split, said big
  const R = GP && GP.last && GP.ph === 'rest' ? GP.last.roll : null;
  if (R && (R.strike || R.spare || R.split)) { const w = R.strike ? (GP.streak[GP.last.side] >= 3 ? 'TURKEY!' : GP.streak[GP.last.side] === 2 ? 'DOUBLE!' : 'STRIKE!') : R.spare ? 'SPARE' : 'SPLIT';
    c.font = '800 54px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.45)'; c.fillText(w, 323, 263); c.fillStyle = R.split ? '#ff9a7a' : '#ffd34a'; c.fillText(w, 320, 260); }
  c.restore();
}
function blDraw(c, dt) {
  if (!G || !G.teams || !GP) { c.fillStyle = '#2e2420'; c.fillRect(0, 0, 960, 600); return; }
  // the camera eases toward where it should be
  const want = blCamTarget(); BLC.camY += (want - BLC.camY) * Math.min(1, (dt || 0) * 5 + (dt ? 0 : 1));
  c.fillStyle = '#2e2420'; c.fillRect(0, 0, 960, 600);
  const g = c.createLinearGradient(0, 0, 0, BL_VIEW.hor + 40); g.addColorStop(0, '#120c09'); g.addColorStop(1, '#3a2a20'); c.fillStyle = g; c.fillRect(0, 0, 640, BL_VIEW.hor + 40);
  c.save(); c.beginPath(); c.rect(0, 0, 640, 600); c.clip();
  blLaneDraw(c); blGuideDraw(c);
  const s = blUp(), pins = blPinsNow(s >= 0 ? s : 0).slice().sort((a, b) => b[2] - a[2]);
  const A = GP.ph === 'roll' ? blAnimNow() : null, col = GP.anim ? G.teams[GP.anim.s].color : '#3a5a9a';
  // the ball goes in among the pins in depth order
  const items = pins.map(p => ({ y: p[2], f: () => blPinDraw(c, p[1], p[2], !!p[3], p[0] % 2 ? .45 : -.45) }));
  if (A && A.ball) items.push({ y: A.ball.y, f: () => blBallDraw(c, A.ball.x, A.ball.y, col) });
  items.sort((a, b) => b.y - a.y).forEach(i => i.f());
  if (GP.ph === 'aim' || GP.ph === 'swing' || GP.ph === 'addr') { const who = GP.ph === 'addr' && GP.cpu ? GP.cpu.s : GP.you, x = GP.ph === 'addr' && GP.cpu ? GP.cpu.plan.x0 : GP.sel ? blBoardX(GP.sel.stand) : 0; blBowlerDraw(c, x, G.teams[who].color || '#888'); }
  blMeterDraw(c);
  blHudDraw(c);
  c.restore();
  blOverDraw(c); blRackDraw(c, s >= 0 ? s : 0);
}
// a ball's track is kept for the overhead strip once it has rolled (the last four on each lane)
function blTrackKeep() { if (!GB) return; const t = BLC.tracks[GB.lane]; t.push(GB.ball.path); if (t.length > 4) t.shift(); }

/* the lane chart: the lane on its side (the foul line on the left, the pins on the right), the oil as far as side s's
   bowler reads it (the rest hatched), the boards counted up the left edge, and every ball's track this game on the
   lane side s bowls next, each side in its colour (the last one bold). w by h, drawn on its own canvas */
function blChart(c, s, w, h) {
  const L = BL_LANE, lane = blLane(s), oil = G.oil[lane], readFt = blReadFt(s), padL = 34, padT = 16, padB = 22, W = w - padL - 10, H = h - padT - padB;
  const X = y => padL + y / (L.len + 40) * W, Y = x => padT + H / 2 - x / L.w * H;
  c.save(); c.fillStyle = '#1a120d'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#d9b27c'; c.fillRect(X(0), Y(L.edge), X(L.len + 40) - X(0), Y(-L.edge) - Y(L.edge));
  const cw = X(12) - X(0), ch = H / L.boards;
  for (let b = 0; b < L.boards; b++) for (let f = 0; f < Math.min(readFt, L.ft); f++) { const o = oil[b * L.ft + f]; if (o < .02) continue; c.fillStyle = `rgba(110,170,240,${Math.min(.75, o * .6)})`; c.fillRect(X(f * 12), Y(blBoardX(b + 1) + L.bw / 2), cw + .3, ch + .3); }
  if (readFt < L.ft) { c.fillStyle = 'rgba(40,30,25,.62)'; c.fillRect(X(readFt * 12), Y(L.edge), X(L.len + 40) - X(readFt * 12), Y(-L.edge) - Y(L.edge));
    c.fillStyle = '#efe4cc'; c.font = '12px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`not read past ${readFt} feet`, (X(readFt * 12) + X(L.len + 40)) / 2, padT + H / 2 + 4); }
  c.strokeStyle = 'rgba(60,30,15,.6)'; c.lineWidth = 1; for (const b of [5, 10, 15, 20, 25, 30, 35]) { c.beginPath(); c.moveTo(X(L.arrows) - 4, Y(blBoardX(b))); c.lineTo(X(L.arrows) + 4, Y(blBoardX(b))); c.stroke(); }
  c.fillStyle = '#efe4cc'; c.font = '10px system-ui, sans-serif'; c.textAlign = 'right'; for (const b of [1, 5, 10, 15, 20, 25, 30, 35, 39]) c.fillText(String(b), padL - 4, Y(blBoardX(b)) + 3);
  c.textAlign = 'center'; for (const ft of [0, 15, 40, 60]) c.fillText(ft ? `${ft} ft` : 'foul line', X(ft * 12), h - 6);
  const T = (GP && GP.tracks && GP.tracks[lane]) || [];
  T.forEach((t, i) => { const last = i === T.length - 1; c.strokeStyle = G.teams[t.s].color || '#888'; c.globalAlpha = last ? 1 : .55; c.lineWidth = last ? 2.4 : 1.2;
    c.beginPath(); t.path.forEach(([x, y], j) => j ? c.lineTo(X(y), Y(x)) : c.moveTo(X(y), Y(x))); c.stroke(); });
  c.globalAlpha = 1;
  for (let n = 1; n <= 10; n++) { const [x, y] = BL_SPOT[n]; c.fillStyle = '#fff'; c.beginPath(); c.arc(X(y), Y(x), 2.2, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
