/* Cinder Gridiron: the field, drawn (issue #9, phase 1). The Ash Bowl from above and a little to one side: green grass
   in a bowl of black basalt, the goalposts scorched at the top. The camera follows the ball. Yard lines every five, the
   line of scrimmage in blue and the line to gain in ember orange. Players are the inked figures (03-figures.js),
   sorted so the nearer ones stand in front. A block shows as a spark between the two: white when it holds, red when the
   defender is winning. The bar at the top has the score, the down, both calls at the snap, and each result with why.
   Between plays each player's position is under them, and GFT.hl ({ side, pos }, set by the page) rings one.
   Powers (14-powers.js): each side's mana under its score, the powers cast at the snap, a callout when one does
   something, and each zone on the grass, tinted where it acts, with its name and the plays it has left.
   The big plays (gfExcite): a breakaway, a deep ball in the air, a broken tackle, a run that gets to the goal line, and the
   moment after a touchdown or an interception, the camera zooms in on the ball (GFT.zoom) and a word says why; the
   score bar and the keys stay put. After a play a banner on the grass says what it came to (GD.big, from gfResult).
   Field space: absolute yards from the left goal line (0 to 100; the end zones run to -10 and 110) and across from the
   middle (y); the side with the ball on poss 0 drives to the right. */
const GFT = { t: 0, hl: null, zoom: 1, fx: 480, fy: 345, hold: 0, why: '', last: 0 };
const GF_ZOOM = 1.65;
const GF_PX = 19, GF_PY = 8.2, GF_MIDY = 345, GF_ASH = Array.from({ length: 260 }, (_, i) => [((i * 37.7) % 125) - 12, ((i * 23.3) % 53) - 26.5, (i % 5) * .25 + .6]);
const gfAbs = (x, y) => G.poss === 0 ? [G.ball + x, y] : [GF_RULES.field - G.ball - x, -y];
const gfScr = (ax, ay, z = 0) => ({ x: 480 + (ax - GD.cam) * GF_PX, y: GF_MIDY + ay * GF_PY - z * 9 });
const gfDir = () => G.poss === 0 ? 1 : -1;
function gfSpotName(b) { return b < 50 ? 'own ' + b : b === 50 ? 'midfield' : 'their ' + (100 - b); }

function gfDraw(c) {
  if (!G || !GD) { c.fillStyle = '#0b0907'; c.fillRect(0, 0, 960, 600); return; }
  // the camera: on the ball in a play, a little ahead of the line otherwise
  const want = L && (GD.ph === 'live' || GD.ph === 'post') ? gfAbs(L.ball.x, 0)[0] + gfDir() * 4 : gfAbs(6, 0)[0];
  GD.cam = lerp(GD.cam, clamp(want, 18, 82), .08);
  // the zoom: in on the ball for a big play, the ball drawn toward the middle as it closes in
  const ex = gfExcite(), b = gfBallScr();
  if (ex) { GFT.hold = GFT.t + 1.1; GFT.why = ex; }
  const on = GFT.t < GFT.hold && (GD.ph === 'live' || GD.ph === 'post');
  if (!on) GFT.why = '';
  // eased by the time since the last frame, so it moves at the same speed at any frame rate
  const f = Math.min(.2, Math.max(0, GFT.t - GFT.last)) * 60, ease = r => 1 - Math.pow(1 - r, f); GFT.last = GFT.t;
  GFT.zoom = lerp(GFT.zoom, on ? GF_ZOOM : 1, ease(on ? .06 : .05));
  GFT.fx = lerp(GFT.fx, b.x, ease(.25)); GFT.fy = lerp(GFT.fy, b.y, ease(.25));
  const k = clamp((GFT.zoom - 1) / (GF_ZOOM - 1), 0, 1);
  c.fillStyle = '#070605'; c.fillRect(0, 0, 960, 600);
  c.save();
  if (GFT.zoom > 1.005) { c.translate(lerp(GFT.fx, 480, k), lerp(GFT.fy, 350, k)); c.scale(GFT.zoom, GFT.zoom); c.translate(-GFT.fx, -GFT.fy); }
  gfDrawField(c);
  gfDrawZones(c);
  gfDrawPlayers(c);
  gfDrawHands(c);
  c.restore();
  gfDrawZoneNames(c);
  gfDrawBig(c);
  gfDrawHud(c);
  gfDrawHint(c);
  gfDrawMeter(c);
}
// where the ball is on the screen, unzoomed
function gfBallScr() {
  if (L && (GD.ph === 'live' || GD.ph === 'post')) { const [x, y] = gfAbs(L.ball.x, L.ball.y); return gfScr(x, y); }
  return gfScr(gfAbs(0, 0)[0], 0);
}
// is this a big play, and what kind: '' when it isn't
function gfExcite() {
  if (!L || !GD) return '';
  if (GD.ph === 'post') return GD.big && (GD.big.k === 'td' || GD.big.k === 'int') && GD.t < 2 ? (GD.big.k === 'td' ? 'Touchdown!' : 'Picked off!') : '';
  if (GD.ph !== 'live' || L.done) return '';
  const B = L.ball;
  if (B.st === 'air' && B.T > 1.05 && B.bt > .25) return 'Deep ball!';
  const e = L.ev[L.ev.length - 1];
  if (e && e.k === 'broken' && L.t - e.t < .8) return 'Broken tackle!';
  if (B.st !== 'held' || L.carrier < 0) return '';
  const p = L.pl[L.carrier]; if (!p || p.side !== 0) return '';
  if (p.x > 3 && L.toGoal - p.x < 3) return 'At the goal line!';
  if (p.x < 7) return '';
  let near = 99; for (const d of L.pl) if (d.side === 1 && !(d.stun > 0)) near = Math.min(near, hyp(d.x - p.x, d.y - p.y));
  return near > 4 ? 'Breakaway!' : '';
}
// after a play, what it came to, in big letters on the grass
const GF_BIG = { td: ['TOUCHDOWN', '#ffd08a'], int: ['INTERCEPTED', '#ff8a6a'], sack: ['SACKED', '#ff8a6a'], first: ['FIRST DOWN', '#bfe8a8'], downs: ['TURNOVER ON DOWNS', '#ff8a6a'], safety: ['SAFETY', '#ff8a6a'], fg: ['IT\'S GOOD', '#ffd08a'], miss: ['NO GOOD', '#ff8a6a'], long: [B => `+${B.gain} YARDS`, '#bfe8a8'] };
function gfDrawBig(c) {
  // on for the beat after the play, fading out as it ends
  const B = GD.big, a = GD.t, end = Math.min(2.4, GD.mode !== 'watch' ? GF_PACE.postCall : GF_PACE.post);
  if (!B || GD.ph !== 'post' || a > end || !GF_BIG[B.k]) return;
  const [word, col] = GF_BIG[B.k], text = typeof word === 'function' ? word(B) : word;
  const al = Math.min(1, a * 5, (end - a) * 2.5), sc = 1 + Math.max(0, .25 - a) * 1.6;
  c.save(); c.globalAlpha = al; c.translate(480, 488); c.scale(sc, sc);
  c.font = '900 54px "Alegreya Sans", system-ui, sans-serif'; c.textAlign = 'center';
  c.lineWidth = 8; c.strokeStyle = 'rgba(12,10,9,.85)'; c.lineJoin = 'round'; c.strokeText(text, 0, 0);
  c.fillStyle = col; c.fillText(text, 0, 0);
  if (B.sub) { c.font = '700 20px "Alegreya Sans", system-ui, sans-serif'; c.lineWidth = 5; c.strokeText(B.sub, 0, 30); c.fillStyle = '#f3ead6'; c.fillText(B.sub, 0, 30); }
  c.restore();
}
function gfDrawField(c) {
  // the stands: black basalt, warm at the top from the lava beyond
  const g = c.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#2a0f08'); g.addColorStop(.18, '#120c0a'); g.addColorStop(1, '#070605');
  c.fillStyle = g; c.fillRect(0, 0, 960, 600);
  const top = gfScr(0, -GF_HALF).y, bot = gfScr(0, GF_HALF).y;
  for (let i = 0; i < 26; i++) { const x = (i * 41 - GD.cam * 6) % 1000 - 20; c.fillStyle = i % 3 ? '#16110e' : '#1c1511'; c.fillRect(x, top - 40, 34, 30); c.fillRect(x + 12, bot + 14, 34, 30); }
  // the grass, in five-yard stripes, and the end zones in the teams' colours
  for (let a = -10; a < 110; a += 5) {
    const p0 = gfScr(a, 0), p1 = gfScr(a + 5, 0);
    if (p1.x < -20 || p0.x > 980) continue;
    c.fillStyle = a < 0 || a >= 100 ? tint(G.teams[a < 0 ? 0 : 1].color, -.45) : (a / 5) % 2 ? '#2f6a33' : '#2a612f';
    c.fillRect(p0.x, top, p1.x - p0.x + 1, bot - top);
  }
  for (const [ax, ay, r] of GF_ASH) { const p = gfScr(ax, ay); if (p.x > -5 && p.x < 965) { c.fillStyle = 'rgba(30,26,24,.35)'; c.fillRect(p.x, p.y, r * 2, r); } }
  c.save();
  c.strokeStyle = 'rgba(240,236,224,.8)'; c.lineWidth = 2;
  for (let a = 0; a <= 100; a += 5) { const p = gfScr(a, 0); if (p.x < -10 || p.x > 970) continue; c.globalAlpha = a % 10 ? .45 : .85; c.beginPath(); c.moveTo(p.x, top); c.lineTo(p.x, bot); c.stroke(); }
  c.globalAlpha = 1; c.strokeRect(gfScr(-10, 0).x, top, (120) * GF_PX, bot - top);
  // hash marks and the numbers
  for (let a = 1; a < 100; a++) { const p = gfScr(a, 0); if (p.x < 0 || p.x > 960 || a % 5 === 0) continue; for (const hy of [-3.1, 3.1]) { const q = gfScr(a, hy); c.fillStyle = 'rgba(240,236,224,.45)'; c.fillRect(q.x - .5, q.y - 3, 1, 6); } }
  for (let a = 10; a < 100; a += 10) { const n = String(a <= 50 ? a : 100 - a); for (const ny of [-19, 19]) { const p = gfScr(a, ny); if (p.x > -30 && p.x < 990) txt(c, n, p.x, p.y + 7, '700 22px "Alegreya Sans", system-ui, sans-serif', 'rgba(240,236,224,.55)', 'center'); } }
  c.restore();
  for (const s of [0, 1]) { const p = gfScr(s ? 105 : -5, 0); if (p.x > -100 && p.x < 1060) { c.save(); c.translate(p.x, p.y); c.rotate(s ? Math.PI / 2 : -Math.PI / 2); txt(c, G.teams[s].name.toUpperCase(), 0, 8, '800 22px "Alegreya Sans", system-ui, sans-serif', 'rgba(255,240,220,.35)', 'center'); c.restore(); } }
  // the goalposts, scorched at the top
  for (const a of [-10, 110]) {
    const p = gfScr(a, 0); if (p.x < -40 || p.x > 1000) continue;
    c.save(); c.lineCap = 'round';
    c.strokeStyle = '#17100e'; c.lineWidth = 7; c.beginPath(); c.moveTo(p.x, p.y + 6); c.lineTo(p.x, p.y - 40); c.moveTo(p.x, p.y - 40 - 26); c.lineTo(p.x, p.y - 40 + 26); c.stroke();
    c.strokeStyle = '#d9b23a'; c.lineWidth = 4; c.stroke();
    c.strokeStyle = '#2a1a12'; c.lineWidth = 4; c.beginPath(); c.moveTo(p.x, p.y - 64); c.lineTo(p.x, p.y - 66); c.stroke();
    c.restore();
  }
  // the line of scrimmage, and the line to gain
  if (GD.ph !== 'over') {
    const los = gfScr(gfAbs(0, 0)[0], 0).x, gain = gfScr(gfAbs(G.togo, 0)[0], 0).x;
    c.fillStyle = 'rgba(90,150,255,.8)'; c.fillRect(los - 1.5, top, 3, bot - top);
    c.fillStyle = 'rgba(255,150,40,.85)'; c.fillRect(gain - 1.5, top, 3, bot - top);
  }
}
// a zone on the grass: where it acts, from the line of scrimmage (x) and across (y), by its look
const GF_ZONE_AREA = { line: [-3, 3, 27], back: [-10, 0, 27], mid: [0, 18, 6], deep: [8, 35, 27], all: [-12, 40, 27] };
function gfDrawZones(c) {
  const Z = G.zones || []; if (!Z.length) return;
  c.save();
  Z.forEach((z, k) => {
    const u = GF_ULT_BY[z.id]; if (!u) return;
    const [col, shape] = u.vis, [x0, x1, w] = GF_ZONE_AREA[shape] || GF_ZONE_AREA.all;
    const a = gfScr(...gfAbs(x0, -w)), b = gfScr(...gfAbs(x1, w));
    c.globalAlpha = .16 + .05 * Math.sin(GFT.t * 2 + k); c.fillStyle = col;
    c.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    c.globalAlpha = 1;
  });
  c.restore();
}
function gfDrawZoneNames(c) {
  (G.zones || []).forEach((z, k) => { const u = GF_ULT_BY[z.id]; if (u) txt(c, `${z.n} · ${z.left} play${z.left === 1 ? '' : 's'}`, 16 + k * 220, 556, '700 13px "Alegreya Sans", system-ui, sans-serif', tint(u.vis[0], .35), 'left'); });
}
function gfDrawPlayers(c) {
  const list = [];
  if (L && (GD.ph === 'live' || GD.ph === 'post')) L.pl.forEach((p, i) => list.push({ p, i, x: p.x, y: p.y, mv: hyp(p.vx, p.vy) > .6 }));
  else {
    // between plays: both sides lined up at the ball
    let i = 0;
    // the called formation once the calls are in, the usual one before
    for (const [side, set, map] of [[0, gfSet(GD.ph === 'pre' ? GD.oc : null), 'off'], [1, gfDefSet(GD.ph === 'pre' ? GD.dc : null), 'def']]) {
      const T = G.teams[side ? 1 - G.poss : G.poss];
      for (const k in set) { const m = T.roster[T[map][k]]; list.push({ p: { side, pos: k, kind: m.kind, num: m.num, eng: -1 }, i: i++, x: set[k][0], y: set[k][1], mv: false }); }
    }
  }
  const at = list.map(o => { const [ax, ay] = gfAbs(o.x, o.y); return Object.assign(o, gfScr(ax, ay)); }).sort((a, b) => a.y - b.y);
  const carrier = L && GD.ph === 'live' && L.ball.st === 'held' ? L.ball.h : -1;
  for (const o of at) {
    const p = o.p, T = G.teams[p.side ? 1 - G.poss : G.poss], flip = (p.side === 0) !== (gfDir() > 0);
    const hl = GFT.hl && GFT.hl.side === p.side && GFT.hl.pos === p.pos;
    if (hl) { c.save(); c.strokeStyle = '#7fd4ff'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(o.x, o.y, 18, 7, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    if (o.i === carrier) { c.strokeStyle = 'rgba(255,181,71,.9)'; c.lineWidth = 2; c.beginPath(); c.ellipse(o.x, o.y, 15, 5.5, 0, 0, Math.PI * 2); c.stroke(); }
    const throwK = L && GD.ph === 'live' && p.pos === 'QB' && p.side === 0 && GF_PLAYS[L.oc].kind === 'pass' ? clamp((L.t - GF_PLAYS[L.oc].throwAt + .35) / .35, 0, 1) : null;
    drawFig(c, p.kind, o.x, o.y, 44, T, { num: p.num, run: o.mv ? GFT.t * 16 + o.i : 0, flip, throwK: throwK != null && throwK < 1 ? throwK : null, alpha: p.stun > 0 ? .6 : undefined });
    if (o.i === carrier && p.n) txt(c, `${p.n} #${p.num}`, o.x, o.y - 50, '800 13px "Alegreya Sans", system-ui, sans-serif', '#ffd08a', 'center');
    if (!L || GD.ph !== 'live' && GD.ph !== 'post') txt(c, p.pos, o.x, o.y + 14, '700 11px "Alegreya Sans", system-ui, sans-serif', hl ? '#7fd4ff' : p.side ? '#ffc9b8' : '#fff3d6', 'center');
  }
  if (!L || GD.ph !== 'live' && GD.ph !== 'post') return gfDrawBall(c, gfScr(gfAbs(0, 0)[0], 0), 0);
  // blocks: a spark between each pair, red when the defender is winning
  for (const p of L.pl) if (p.side === 1 && p.eng >= 0) {
    const o = L.pl[p.eng], [ax, ay] = gfAbs((p.x + o.x) / 2, (p.y + o.y) / 2), s = gfScr(ax, ay), win = p.push < -.5;
    c.save(); c.strokeStyle = win ? 'rgba(255,90,60,.9)' : 'rgba(255,248,230,.85)'; c.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + GFT.t * 6; c.beginPath(); c.moveTo(s.x + Math.cos(a) * 2, s.y - 26 + Math.sin(a) * 2); c.lineTo(s.x + Math.cos(a) * 7, s.y - 26 + Math.sin(a) * 7); c.stroke(); }
    c.restore();
  }
  const B = L.ball, [bx, by] = gfAbs(B.x, B.y);
  gfDrawBall(c, gfScr(bx, by), B.st === 'held' ? 3.2 : B.z);
}
function gfDrawBall(c, p, z) {
  c.save();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(p.x, p.y, 4, 1.6, 0, 0, Math.PI * 2); c.fill();
  const y = p.y - z * 9;
  c.translate(p.x, y); c.rotate(-.5 * gfDir());
  c.fillStyle = '#7a3e1c'; c.strokeStyle = '#17100e'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, 5.5, 3.4, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = '#f2ead8'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2, 0); c.lineTo(2, 0); c.stroke();
  c.restore();
}
function gfDrawHud(c) {
  c.save();
  const F = (s, w = 700) => `${w} ${s}px "Alegreya Sans", system-ui, sans-serif`;
  // after a play, why it went that way, in as many lines as it takes
  const why = GD.ph === 'post' || GD.ph === 'over' ? gfWrap(c, GD.why, F(14, 500), 640) : [];
  // at the snap, the powers each side cast
  const cast = (GD.ph === 'pre' || GD.ph === 'live') && GD.cast ? [GD.cast.off, GD.cast.def].filter(Boolean).map(x => `${x.ult ? '★ ' : ''}${x.name} (${x.n})`) : [];
  const h = 58 + why.length * 18 + (why.length && GD.ph === 'over' ? 14 : 0) + (cast.length ? 20 : 0);
  c.fillStyle = 'rgba(12,10,9,.93)'; c.fillRect(0, 0, 960, h); c.fillStyle = 'rgba(255,150,40,.5)'; c.fillRect(0, h, 960, 1.5);
  G.teams.forEach((t, s) => {
    const x = s ? 940 : 20, al = s ? 'right' : 'left';
    c.fillStyle = t.color; c.fillRect(s ? 946 : 8, 10, 6, 38);
    txt(c, t.name + (G.poss === s && GD.ph !== 'over' ? '  ●' : ''), x, 26, F(17, 800), '#f3ead6', al);
    txt(c, String(G.score[s]), x, 50, F(22, 800), '#ffd08a', al);
    // mana, as diamonds beside the score
    if (G.mana) for (let i = 0; i < GF_MANA.max; i++) {
      const px = s ? 940 - 44 - i * 13 : 20 + 44 + i * 13, py = 44;
      c.beginPath(); c.moveTo(px, py - 5); c.lineTo(px + 4.5, py); c.lineTo(px, py + 5); c.lineTo(px - 4.5, py); c.closePath();
      c.fillStyle = i < G.mana[s] ? '#a88cff' : 'rgba(168,140,255,.15)'; c.fill();
    }
  });
  let mid = `${GF_ORD[G.down]} & ${G.togo >= GF_RULES.field - G.ball ? 'goal' : G.togo} · ${gfSpotName(G.ball)}`, sub = '';
  if (GD.ph === 'call') sub = GD.mode !== 'call' ? 'The coaches call it' : G.down === GF_RULES.downs ? 'Fourth down, your call: go for it, punt, or kick' : 'Your call';
  if ((GD.ph === 'pre' || GD.ph === 'live') && GD.oc) sub = `${GF_PLAYS[GD.oc].n}  vs  ${GF_DEFS[GD.dc].n}`;
  if (GD.game) mid += `  ·  ${GF_HALF_NAME[G.half]} ${gfClockText()}`;
  if (GD.ph === 'call' && GD.mode === 'call' && G.poss !== GD.you) sub = 'Your call: pick a defense';
  if (GD.ph === 'kick') sub = (GD.kick === 'fg' ? `Field goal try, ${gfKickDist()} yards` : 'Punt') + (GD.meter ? ': tap Space twice, for power and aim' : '');
  if (GD.ph === 'kickoff') { mid = `Kickoff  ·  ${GF_HALF_NAME[G.half]} ${gfClockText()}`; sub = `${G.teams[1 - GD.kickoff].name} kick to ${G.teams[GD.kickoff].name}`; }
  if (GD.ph === 'half') { mid = GD.msg; sub = ''; }
  if (GD.ph === 'post' || GD.ph === 'over') { mid = GD.msg; sub = GD.ph === 'over' ? (GD.game ? gfFinalLine() : gfEndLine()) : ''; }
  txt(c, mid, 480, 27, F(18, 800), '#f3ead6', 'center');
  if (sub) txt(c, sub, 480, 49, F(15, 600), GD.ph === 'pre' ? '#ffd08a' : '#b9b0a0', 'center');
  why.forEach((l, i) => txt(c, l, 480, (sub ? 70 : 52) + i * 18, F(14, 500), '#d8cfbd', 'center'));
  if (cast.length) txt(c, 'Powers: ' + cast.join('  ·  '), 480, 72, F(14, 700), '#d6c4ff', 'center');
  // a broken tackle, a shed block, the catch: the play's last moment, briefly
  if (L && GD.ph === 'live') { const e = L.ev[L.ev.length - 1]; if (GFT.why && GFT.why !== 'Touchdown!' && GFT.why !== 'Picked off!') txt(c, GFT.why, 480, 104, F(24, 900), '#ffd08a', 'center'); else if (e && L.t - e.t < .9 && e.k === 'catch') txt(c, 'Caught!', 480, 96, F(20, 800), '#ffd08a', 'center'); }
  // a power doing its work, a little longer
  if (L && GD.ph === 'live') { const e = L.ev.slice().reverse().find(x => x.k === 'pow' && x.s && L.t - x.t < 1.3); if (e) txt(c, e.s + '!', 480, 120, F(19, 800), '#d6c4ff', 'center'); }
  c.restore();
}
// Play mode on the field: the ring on your target, the lead marker while you hold, and the keys along the bottom
function gfDrawHands(c) {
  if (!L || !L.hands || GD.ph !== 'live' || L.done) return;
  const F = '700 13px "Alegreya Sans", system-ui, sans-serif', at = (x, y) => { const [ax, ay] = gfAbs(x, y); return gfScr(ax, ay); };
  let hint;
  if (gfCanThrow()) {
    const t = L.pl[L.ctl.tgt];
    if (t) { const s = at(t.x, t.y); c.save(); c.strokeStyle = '#7fd4ff'; c.lineWidth = 2.5; c.setLineDash([5, 4]); c.beginPath(); c.ellipse(s.x, s.y, 19, 7.5, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    if (t && L.ctl.hold != null) {
      const [mx, my] = gfLeadSpot(L.ctl.tgt, Math.min(GF_LEAD, .15 + (L.t - L.ctl.hold) * 1.1)), m = at(mx, my), q = at(L.pl[L.id.QB].x, L.pl[L.id.QB].y);
      c.save(); c.strokeStyle = 'rgba(127,212,255,.75)'; c.lineWidth = 1.5; c.setLineDash([3, 5]);
      c.beginPath(); c.moveTo(q.x, q.y - 20); c.quadraticCurveTo((q.x + m.x) / 2, Math.min(q.y, m.y) - 60, m.x, m.y); c.stroke();
      c.setLineDash([]); c.fillStyle = 'rgba(127,212,255,.35)'; c.strokeStyle = '#7fd4ff'; c.beginPath(); c.ellipse(m.x, m.y, 9, 4, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
    }
    hint = 'Hold Space to lead your receiver, let go to throw  ·  Q / E: another receiver  ·  WASD: scramble';
  } else if (L.carrier >= 0) hint = `WASD: steer${L.armUsed ? '' : '  ·  Space: stiff-arm (once a play)'}`;
  else hint = 'The ball is in the air';
  GFT.hint = hint;
}
function gfDrawHint(c) {
  if (!L || !L.hands || GD.ph !== 'live' || L.done || !GFT.hint) return;
  c.save(); c.fillStyle = 'rgba(12,10,9,.78)'; c.fillRect(0, 572, 960, 28); txt(c, GFT.hint, 480, 591, '700 13px "Alegreya Sans", system-ui, sans-serif', '#d8f0ff', 'center'); c.restore();
}
// your kick: a power bar, then an aim bar
function gfDrawMeter(c) {
  const M = GD && GD.ph === 'kick' && GD.meter; if (!M) return;
  const k = G.teams[G.poss].roster[G.teams[G.poss].kicker], fg = GD.kick === 'fg', F = '700 14px "Alegreya Sans", system-ui, sans-serif';
  const x = 330, w = 300, y = 470, now = M.st < 2 ? gfMeterNow() : null;
  c.save(); c.fillStyle = 'rgba(12,10,9,.85)'; c.fillRect(x - 20, y - 34, w + 40, 96);
  txt(c, M.st === 0 ? 'Space: set the power' : M.st === 1 ? 'Space: set the aim' : 'Kicking…', 480, y - 14, F, '#ffd08a', 'center');
  // power: the mark is how much this kick needs
  c.fillStyle = '#2a2420'; c.fillRect(x, y, w, 12);
  const pw = M.st === 0 ? now : M.pw; c.fillStyle = '#ff9a3c'; c.fillRect(x, y, w * pw, 12);
  if (fg) { const need = clamp(gfKickDist() / gfFgReach(k), 0, 1); c.fillStyle = '#f3ead6'; c.fillRect(x + w * need - 1, y - 3, 2, 18); }
  // aim: the window in the middle is good
  const ay = y + 28, win = fg ? gfFgWindow(k) : .3;
  c.fillStyle = '#2a2420'; c.fillRect(x, ay, w, 12); c.fillStyle = 'rgba(111,191,115,.55)'; c.fillRect(x + w / 2 * (1 - win), ay, w * win, 12);
  if (M.st >= 1) { const a = M.st === 1 ? now : M.aim; c.fillStyle = '#f3ead6'; c.fillRect(x + w / 2 * (1 + a) - 2, ay - 3, 4, 18); }
  c.restore();
}
function gfWrap(c, s, font, w) {
  if (!s) return [];
  c.save(); c.font = font; const out = [];
  for (const word of s.split(' ')) { const t = out.length ? out[out.length - 1] + ' ' + word : word; if (out.length && c.measureText(t).width <= w) out[out.length - 1] = t; else out.push(word); }
  c.restore(); return out;
}
const GF_END = { clock: 'The clock ran out', td: 'Touchdown', fg: 'Field goal', miss: 'Missed field goal', punt: 'Punt', downs: 'Turnover on downs', int: 'Interception', safety: 'Safety' };
function gfEndLine() { const d = G.drive; return `Drive over: ${GF_END[d.end]}. ${d.plays.length} play${d.plays.length === 1 ? '' : 's'}, ${d.yards} yards.`; }
