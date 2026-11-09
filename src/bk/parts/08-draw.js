/* The Charter Court: the court, drawn (issue #77, phase 1). The Charter Court from above and a little to one side: a
   boarded floor in a walled yard, keys painted in the club's orange, chain nets on both hoops. The whole court is in
   view, so there's no camera. Players are the inked figures (03-figures.js), sorted so the nearer ones stand in front;
   the ball handler has a ring in their side's colour under them, and the ball has its shadow on the floor.
   The bar at the top has the score, the period, the game clock and the shot clock, and each side's team fouls (lit in
   the bonus). Under the court, what just happened (GD.msg). A big moment (a dunk, a three, a block, an and-one, the
   shot clock running out) puts a word on the floor for a moment; at the end, the final score.
   Phase 2: by hand, the player you play has a marker over them, and the release meter rises beside your shooter (the
   window in green, its heart, the swish, brighter); after a shot the meter stays a moment with where you let go. A
   player on fire has flames at their feet. A pick shows the screener's spot.
   Phase 5, the Charter Court's own: a shine on the waxed patches, a bent rim hanging down, the crowd on its feet in a
   roar.
   Court space is metres (05-live.js); bkScr turns it into canvas pixels. */
const BKT = { t: 0, box: null, boxKey: '', bg: null, bgKey: '' };
const BK_PX = 30, BK_PY = 22, BK_X0 = 60, BK_Y0 = 318, BK_PZ = 15;
const bkScr = (x, y, z = 0) => ({ x: BK_X0 + x * BK_PX, y: BK_Y0 + y * BK_PY - z * BK_PZ });
const BK_FONT = '"Alegreya Sans", system-ui, sans-serif';

function bkDraw(c) {
  c.fillStyle = '#120d0a'; c.fillRect(0, 0, 960, 600);
  if (!G || !GD || !L) return;
  bkDrawBack(c);
  bkDrawHoop(c, 0, true);
  bkDrawHoop(c, 1, true);
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
  const k = c.getTransform().a || 1, key = `${k}|${G.teams[0].color}`;
  if (BKT.bgKey !== key) {
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.round(960 * k), Math.round(600 * k)) : Object.assign(document.createElement('canvas'), { width: Math.round(960 * k), height: Math.round(600 * k) });
    const b = cv.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0); bkDrawYard(b); bkDrawFloor(b);
    BKT.bg = cv; BKT.bgKey = key;
  }
  c.drawImage(BKT.bg, 0, 0, 960, 600);
  bkDrawCrowd(c);
  // the waxed boards (phase 5): a shine on each slick patch, slowly moving
  if (G.court) for (const w of G.court.wax) { const s = bkScr(w.x, w.y); c.save(); c.globalAlpha = .22 + .08 * Math.sin(BKT.t * 1.5 + w.x); const g = c.createRadialGradient(s.x, s.y, 2, s.x, s.y, w.r * BK_PX); g.addColorStop(0, 'rgba(255,250,230,.95)'); g.addColorStop(1, 'rgba(255,250,230,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(s.x, s.y, w.r * BK_PX, w.r * BK_PY, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
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
function bkDrawCrowd(c) {
  // (a roar: the side's crowd on its feet, bouncing)
  const roar = G.court && G.court.roar;
  for (let i = 0; i < 46; i++) { const x = 22 + i * 20.5, b = Math.sin(BKT.t * (roar ? 9 : 2) + i * 1.3) * (roar ? 5 : 1.5); c.fillStyle = ['#6b4a3a', '#8a6a4a', '#4a3a3a', '#a07a5a'][i % 4]; c.beginPath(); c.arc(x, 92 + b + (i % 3) * 2, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = i % 5 ? '#2c1d17' : '#e0742a'; c.fillRect(x - 8, 99 + b + (i % 3) * 2, 16, 10); }
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
  // the club's name at centre court
  txt(c, 'THE CHARTER COURT', m.x, m.y + 6, `800 15px ${BK_FONT}`, 'rgba(122,74,42,.55)', 'center');
  c.restore();
}
// a hoop: the pole and the backboard behind (back), or the rim and its chain net in front (front)
function bkDrawHoop(c, s, back) {
  const dir = s ? -1 : 1, bx = s ? BK_RULES.len : 0, rim = bx + dir * BK_RULES.rim, R0 = bkScr(rim, 0, 3.05), bb = bkScr(bx + dir * 1.2, 0, 3.4);
  c.save();
  if (back) {
    const pole = bkScr(bx - dir * .6, 0); c.strokeStyle = '#2a201a'; c.lineWidth = 5; c.beginPath(); c.moveTo(pole.x, pole.y); c.lineTo(pole.x, bb.y); c.lineTo(bb.x, bb.y); c.stroke();
    c.fillStyle = 'rgba(240,236,224,.92)'; c.strokeStyle = '#17100e'; c.lineWidth = 2; c.fillRect(bb.x - 3, bb.y - 26, 6, 44); c.strokeRect(bb.x - 3, bb.y - 26, 6, 44);
  } else {
    // the rim: bent after a big dunk comes later (phase 5); the net is chain, and it swings when a shot goes through
    const N = GD.net && GD.net.hoop === s ? GD.net : null; if (N && N.at == null) N.at = BKT.t;
    const sw = N ? Math.max(0, 1 - (BKT.t - N.at) * 1.5) : 0;
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
    if (i === h) { c.save(); c.strokeStyle = T.light || '#fff'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(s.x, s.y, 15, 5, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    const face = mv ? p.vx < 0 : bkDir(p.side) < 0, lift = p.act === 'shoot' ? 9 : p.act === 'jump' ? 11 : 0;
    // (tired: a short bar of what breath is left, under their feet)
    if (bkTired(p) > 0) { const v = bkSta(p) / 100; c.save(); c.fillStyle = 'rgba(12,10,9,.7)'; c.fillRect(s.x - 12, s.y + 6, 24, 3); c.fillStyle = v < BK_STAM.sub / 100 ? '#ff6a4a' : '#ffb070'; c.fillRect(s.x - 12, s.y + 6, 24 * v, 3); c.restore(); }
    if (bkOnFire(p)) for (let k = 0; k < 5; k++) { const a = BKT.t * 9 + k * 1.3; c.save(); c.globalAlpha = .75; c.fillStyle = k % 2 ? '#ffb02e' : '#ff5a1e'; c.beginPath(); c.ellipse(s.x - 10 + k * 5, s.y - 4 - Math.abs(Math.sin(a)) * 7, 3, 6 + Math.abs(Math.sin(a)) * 4, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    drawFig(c, p.kind, s.x, s.y, 50, T, { num: p.num, run: mv ? p.run : 0, flip: face, throwK: p.act === 'shoot' || p.act === 'rise' ? 1 : 0, lift: p.act === 'rise' ? 4 : lift, alpha: p.stun > 0 ? .75 : 1 });
    // the player you play: a marker over their head
    if (i === bkMe()) { const y = s.y - 50 * (KIND[p.kind] || KIND.goblin).h - 12; c.save(); c.fillStyle = '#ffe04a'; c.strokeStyle = '#17100e'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s.x - 6, y - 8); c.lineTo(s.x + 6, y - 8); c.lineTo(s.x, y); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  }
  if (L.pick) { const [x, y] = bkScreenSpot(), q = bkScr(x, y); c.save(); c.strokeStyle = 'rgba(255,224,74,.7)'; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(q.x, q.y, 12, 4, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
}
function bkDrawBall(c) {
  const B = L.ball; if (GD.ph === 'over' || GD.ph === 'break') return;
  let x = B.x, y = B.y, z = B.z;
  // a free throw in the air: from the line to the rim, over the beat
  if (GD.ph === 'ft' && GD.ft) { const p = L.pl[GD.ft.i], u = clamp((GD.t - .45) / .5, 0, 1); if (u > 0) { const hx = bkHoopX(GD.ft.side); x = lerp(p.x, hx, u); y = lerp(p.y, 0, u); z = lerp(2.3, 3.05, u) + 2.5 * 4 * u * (1 - u); } }
  if (GD.ph === 'intro') z = 2.4 + Math.min(GD.t, 1.2) * 1.5;
  const g = bkScr(x, y), b = bkScr(x, y, z);
  c.save();
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(g.x, g.y, 5, 2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e0742a'; c.strokeStyle = '#17100e'; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.lineWidth = 1; c.beginPath(); c.moveTo(b.x - 5.5, b.y); c.lineTo(b.x + 5.5, b.y); c.moveTo(b.x, b.y - 5.5); c.lineTo(b.x, b.y + 5.5); c.stroke();
  c.restore();
}
// a big moment in big letters on the floor, for a moment; and at the end, the final
const BK_BIG = { bent: ['RIM BENT', '#ffb070'], roar: ['THE YARD ROARS', '#ffd08a'], swish: ['SWISH', '#bfe8a8'], alley: ['ALLEY-OOP', '#ffd08a'], goaltend: ['GOALTENDING', '#ff8a6a'], fire: ['ON FIRE', '#ffb02e'], break: ['FAST BREAK', '#bfe8a8'], dunk: ['SLAM DUNK', '#ffd08a'], three: ['FROM THREE', '#ffd08a'], block: ['BLOCKED', '#ff8a6a'], andone: ['AND ONE', '#ffd08a'], clock: ['SHOT CLOCK', '#ff8a6a'] };
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
  c.fillStyle = '#0d0907'; c.fillRect(0, 0, 960, 64);
  for (const s of [0, 1]) {
    const T = G.teams[s], al = s ? 'right' : 'left';
    c.fillStyle = T.color; c.fillRect(s ? 930 : 20, 12, 10, 40);
    txt(c, T.name, s ? 920 : 40, 30, `800 20px ${BK_FONT}`, '#f3ead6', al);
    txt(c, `Fouls ${G.tf[s]}${G.tf[1 - s] > BK_RULES.limit ? ' · in the bonus' : ''}`, s ? 920 : 40, 50, `600 13px ${BK_FONT}`, G.tf[1 - s] > BK_RULES.limit ? '#ffb070' : 'rgba(243,234,214,.6)', al);
    txt(c, String(G.score[s]), s ? 640 : 320, 46, `900 38px ${BK_FONT}`, G.poss === s && GD.ph !== 'over' ? T.light || '#fff' : '#f3ead6', 'center');
    if (G.poss === s && GD.ph !== 'over') txt(c, '●', s ? 600 : 360, 40, `14px ${BK_FONT}`, T.color, 'center');
  }
  txt(c, `${bkPeriodName(G.q)}  ${bkClockText()}`, 480, 30, `800 20px ${BK_FONT}`, '#f3ead6', 'center');
  const sc = Math.ceil(G.shot), off = G.clock < G.shot;
  // the calls on this possession (the offense's set against the defense), and each side's timeouts
  if (G.cur && GD.ph !== 'over') { const C = G.cur, e = bkEdge(C.off, C.def)[0]; txt(c, `${BK_SETS[C.off].n} vs ${BK_DEFS[C.def].n}${C.stale ? ` · scouted${C.stale > 1 ? ' twice' : ''}` : ''}`, C.side ? 640 : 320, 60, `600 11px ${BK_FONT}`, e > 0 ? '#bfe8a8' : e < 0 ? '#ff9a7a' : 'rgba(243,234,214,.7)', 'center'); }
  if (G.to) for (const s of [0, 1]) txt(c, `TO ${G.to[s]}`, s ? 600 : 360, 22, `600 11px ${BK_FONT}`, 'rgba(243,234,214,.6)', 'center');
  txt(c, off ? '–' : String(sc), 480, 54, `900 18px ${BK_FONT}`, !off && sc <= 4 ? '#ff6a4a' : '#ffd08a', 'center');
}
function bkDrawMsg(c) {
  const notes = GD.notes && GD.notes.length ? ' ' + GD.notes.join(' ') : '';
  txt(c, (GD.msg || '') + notes, 480, 520, `600 17px ${BK_FONT}`, '#f3ead6', 'center');
  // under it, the box line for the game so far: field goals, threes, free throws and rebounds, each side
  const key = `${L.evN || 0}|${G.log.length}|${GD.ph}|${G.score}|${GD.ft ? GD.ft.n : ''}`;
  if (BKT.boxKey !== key) { BKT.boxKey = key; BKT.box = bkBox(); }
  BKT.box.forEach((b, s) => { const t = b.tot; txt(c, `${b.team}: FG ${t.fgm}/${t.fga} · 3PT ${t.tpm}/${t.tpa} · FT ${t.ftm}/${t.fta} · Reb ${t.reb} · Ast ${t.ast} · Stl ${t.stl} · Blk ${t.blk}`, 480, 552 + s * 22, `500 13px ${BK_FONT}`, 'rgba(243,234,214,.65)', 'center'); });
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
  c.save();
  c.fillStyle = 'rgba(12,10,9,.8)'; c.fillRect(x - 5, yAt(BK_HANDS.late) - 2, 10, H + 4);
  c.fillStyle = 'rgba(120,200,110,.55)'; c.fillRect(x - 4, yAt(1 + w / 2), 8, yAt(1 - w / 2) - yAt(1 + w / 2));
  c.fillStyle = 'rgba(190,255,170,.95)'; c.fillRect(x - 4, yAt(1 + w * BK_WIN.perfect), 8, yAt(1 - w * BK_WIN.perfect) - yAt(1 + w * BK_WIN.perfect));
  c.strokeStyle = '#f3ead6'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 7, yAt(1)); c.lineTo(x + 7, yAt(1)); c.stroke();
  if (M) { c.fillStyle = '#ffd08a'; c.fillRect(x - 7, yAt(M.t / M.T) - 1.5, 14, 3); }
  else { const e = R0.e, good = e <= w / 2; txt(c, e <= w * BK_WIN.perfect ? 'Perfect' : good ? 'Good' : e <= w ? 'Off' : 'Way off', x + 10, yAt(1) + 4, `700 12px ${BK_FONT}`, good ? '#bfe8a8' : '#ff8a6a'); }
  c.restore();
}
