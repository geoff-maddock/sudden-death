/* Black Ice: the rink, drawn (issue #83, phase 1). The Pond Rink from above and a little to one side: a frozen pond
   with boards round it, Rimewatch on the bank behind under a green northern sky, and the town on the snowbank
   watching. The whole sheet is in view (a camera that pushes in on an end comes with the hands, phase 2). Players are
   the inked figures (03-figures.js) with a stick, sorted so the nearer ones stand in front; the puck carrier has a
   ring in their side's colour under them.
   The bar at the top has the score (underlined for the side with the puck), the period and the game clock, and each
   side's shots on goal. Under the rink, what just happened (GD.msg), and a line of the game so far. A goal or an icing
   puts a word on the ice for a moment; at the end, the final score.
   Rink space is metres (05-live.js); hkScr turns it into canvas pixels. */
const HKT = { t: 0, box: null, boxKey: '', bg: null, bgKey: '' };
const HK_PX = 21, HK_PY = 16, HK_X0 = 60, HK_Y0 = 328;
const hkScr = (x, y) => ({ x: HK_X0 + x * HK_PX, y: HK_Y0 + y * HK_PY });
const HK_FONT = '"Alegreya Sans", system-ui, sans-serif';

function hkDraw(c) {
  c.fillStyle = '#0b1016'; c.fillRect(0, 0, 960, 600);
  if (!G || !GD || !L) return;
  hkDrawBack(c);
  hkDrawNets(c);
  hkDrawPlayers(c);
  hkDrawPuck(c);
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
// density the rink is drawn at, and copied each frame; the crowd on the bank is drawn live over it
function hkDrawBack(c) {
  const k = c.getTransform().a || 1, key = `${k}|${G.teams[0].color}`;
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
    const x = 34 + i * 20.6, b = Math.sin(HKT.t * 2 + i * 1.3) * 1.4, y = 158 + (i % 3) * 3 + b;
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
  const h = hkHand(), list = L.pl.map((p, i) => ({ p, i })).filter(o => !o.p.off).sort((a, b) => a.p.y - b.p.y);
  for (const { p, i } of list) {
    const s = hkScr(p.x, p.y), T = G.teams[p.side], sp = hyp(p.vx, p.vy), mv = sp > .8, goalie = p.pos === 'G';
    if (i === h) { c.save(); c.strokeStyle = T.color; c.lineWidth = 3; c.beginPath(); c.ellipse(s.x, s.y, 16, 6, 0, 0, Math.PI * 2); c.stroke(); c.strokeStyle = T.light || '#fff'; c.lineWidth = 1.2; c.stroke(); c.restore(); }
    // skate cuts behind a fast skater
    if (sp > 5) { c.save(); c.globalAlpha = .35; c.strokeStyle = '#8fb0c4'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(s.x - 3, s.y + 1); c.lineTo(s.x - p.vx * 2.2 - 3, s.y - p.vy * 1.7 + 1); c.moveTo(s.x + 3, s.y + 1); c.lineTo(s.x - p.vx * 2.2 + 3, s.y - p.vy * 1.7 + 1); c.stroke(); c.restore(); }
    const behind = p.fy < -.2; if (behind) hkDrawStick(c, p, s, goalie);
    if (goalie) { c.save(); c.fillStyle = '#efe6cf'; c.strokeStyle = '#17100e'; c.lineWidth = 1.5; rr(c, s.x - 11, s.y - 13, 22, 13, 3); c.fill(); c.stroke(); c.restore(); }
    const down = p.act === 'down';
    drawFig(c, p.kind, s.x, s.y, goalie ? 46 : 44, T, { num: p.num, run: mv && !goalie ? p.run : 0, flip: p.fx < 0, throwK: p.act === 'shoot' || p.act === 'wind' ? 1 : 0, lift: p.act === 'save' ? 4 : 0, alpha: p.stun > 0 && !down ? .8 : 1, pose: down ? HK_DOWN : undefined });
    if (!behind) hkDrawStick(c, p, s, goalie);
  }
}
function hkDrawPuck(c) {
  const P = L.puck, s = hkScr(P.x, P.y), v = hyp(P.vx, P.vy);
  if (GD.ph === 'over' || GD.ph === 'break' || GD.ph === 'so') return;
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
// a big moment in big letters on the ice, for a moment; and at the end, the final
const HK_BIG = { goal: ['GOAL!', '#ffd08a', 1.8], icing: ['ICING', '#ff8a6a', 1.2], hit: ['BIG HIT', '#ffd08a', .9] };
function hkDrawBig(c) {
  let word = null, col = '#ffd08a', sub = '', al = 1, sc = 1;
  if (GD.ph === 'over') { word = 'FINAL'; sub = `${G.teams[0].name} ${G.score[0]}, ${G.teams[1].name} ${G.score[1]}${G.over && G.over.so ? ' (shootout)' : G.over && G.over.ot ? ' (sudden death)' : ''}`; }
  else if (GD.ph === 'so') { word = 'SHOOTOUT'; sub = `${G.teams[0].name} ${G.so.goals[0]}, ${G.teams[1].name} ${G.so.goals[1]}`; }
  else if (GD.ph === 'break') { word = hkOt() ? 'SUDDEN DEATH' : `END OF THE ${hkPeriodName(G.p - 1).toUpperCase()}`; if (hkOt()) sub = 'Three skaters a side. The next goal wins.'; }
  else if (GD.big && HK_BIG[GD.big.k]) {
    if (GD.big.at == null) GD.big.at = HKT.t;
    const [w, cl, len] = HK_BIG[GD.big.k], a = HKT.t - GD.big.at; if (a > len) { GD.big = null; return; }
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
    txt(c, `Shots ${G.sog[s]}`, X(40), 49, F(12, 600), dim, al);
    txt(c, String(G.score[s]), X(398), 47, F(40, 900), has ? T.light || '#fff' : '#f3ead6', 'center');
    if (has) { c.fillStyle = T.color; c.fillRect(X(398) - 16, 53, 32, 4); }
  }
  c.save(); rr(c, 436, 8, 88, 48, 6); c.fillStyle = '#1c1512'; c.fill(); c.restore();
  txt(c, GD.ph === 'so' ? 'Shootout' : hkPeriodName(G.p), 480, 25, F(12, 700), dim, 'center');
  txt(c, GD.ph === 'so' ? `${G.so.goals[0]}–${G.so.goals[1]}` : hkClockText(), 480, 48, F(22, 900), G.clock < 10 && live ? '#ff8a6a' : '#ffd08a', 'center');
}
function hkDrawMsg(c) {
  c.save(); rr(c, 150, 508, 660, 30, 6); c.fillStyle = 'rgba(13,9,7,.82)'; c.fill(); c.restore();
  let m = GD.msg || ''; c.font = `600 17px ${HK_FONT}`; while (m.length > 12 && c.measureText(m).width > 640) m = m.slice(0, -2).trimEnd() + '…';
  txt(c, m, 480, 529, `600 17px ${HK_FONT}`, '#f3ead6', 'center');
  // under it, who is on the power play (phase 3); for now each side's hits and face-offs
  const key = `${L.evN || 0}|${G.log.length}|${GD.ph}`;
  if (HKT.boxKey !== key) { HKT.boxKey = key; HKT.box = hkBox(); }
  const line = HKT.box.map(b => `${b.team}: ${b.tot.hit} hits · ${b.tot.fow} of ${b.tot.fot} face-offs · ${b.tot.blk} blocks`).join('     ');
  txt(c, line, 480, 566, `600 13px ${HK_FONT}`, '#1c2c3a', 'center');
}
