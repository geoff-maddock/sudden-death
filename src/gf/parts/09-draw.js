/* Cinder Gridiron: the field, drawn (issue #9, phase 1). The Ash Bowl from above and a little to one side: green grass
   in a bowl of black basalt, the goalposts scorched at the top. The camera follows the ball. Yard lines every five, the
   line of scrimmage in blue and the line to gain in ember orange. Players are the inked figures (03-figures.js),
   sorted so the nearer ones stand in front. A block shows as a spark between the two: white when it holds, red when the
   defender is winning. The bar at the top has the score, the down, both calls at the snap, and each result with why.
   Between plays each player's position is under them, and GFT.hl ({ side, pos }, set by the page) rings one.
   Field space: absolute yards from the left goal line (0 to 100; the end zones run to -10 and 110) and across from the
   middle (y); the side with the ball on poss 0 drives to the right. */
const GFT = { t: 0, hl: null };
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
  gfDrawField(c);
  gfDrawPlayers(c);
  gfDrawHud(c);
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
  const why = GD.ph === 'post' || GD.ph === 'over' ? gfWrap(c, GD.why, F(14, 500), 640) : [], h = 58 + why.length * 18 + (why.length && GD.ph === 'over' ? 14 : 0);
  c.fillStyle = 'rgba(12,10,9,.86)'; c.fillRect(0, 0, 960, h); c.fillStyle = 'rgba(255,150,40,.5)'; c.fillRect(0, h, 960, 1.5);
  G.teams.forEach((t, s) => {
    const x = s ? 940 : 20, al = s ? 'right' : 'left';
    c.fillStyle = t.color; c.fillRect(s ? 946 : 8, 10, 6, 38);
    txt(c, t.name + (G.poss === s && GD.ph !== 'over' ? '  ●' : ''), x, 26, F(17, 800), '#f3ead6', al);
    txt(c, String(G.score[s]), x, 50, F(22, 800), '#ffd08a', al);
  });
  let mid = `${GF_ORD[G.down]} & ${G.togo >= GF_RULES.field - G.ball ? 'goal' : G.togo} · ${gfSpotName(G.ball)}`, sub = '';
  if (GD.ph === 'call') sub = GD.mode !== 'call' ? 'The coaches call it' : G.down === GF_RULES.downs ? 'Fourth down, your call: go for it, punt, or kick' : 'Your call';
  if ((GD.ph === 'pre' || GD.ph === 'live') && GD.oc) sub = `${GF_PLAYS[GD.oc].n}  vs  ${GF_DEFS[GD.dc].n}`;
  if (GD.game) mid += `  ·  ${GF_HALF_NAME[G.half]} ${gfClockText()}`;
  if (GD.ph === 'call' && GD.mode === 'call' && G.poss !== GD.you) sub = 'Your call: pick a defense';
  if (GD.ph === 'kick') sub = GD.kick === 'fg' ? `Field goal try, ${gfKickDist()} yards` : 'Punt';
  if (GD.ph === 'kickoff') { mid = `Kickoff  ·  ${GF_HALF_NAME[G.half]} ${gfClockText()}`; sub = `${G.teams[1 - GD.kickoff].name} kick to ${G.teams[GD.kickoff].name}`; }
  if (GD.ph === 'half') { mid = GD.msg; sub = ''; }
  if (GD.ph === 'post' || GD.ph === 'over') { mid = GD.msg; sub = GD.ph === 'over' ? (GD.game ? gfFinalLine() : gfEndLine()) : ''; }
  txt(c, mid, 480, 27, F(18, 800), '#f3ead6', 'center');
  if (sub) txt(c, sub, 480, 49, F(15, 600), GD.ph === 'pre' ? '#ffd08a' : '#b9b0a0', 'center');
  why.forEach((l, i) => txt(c, l, 480, (sub ? 70 : 52) + i * 18, F(14, 500), '#d8cfbd', 'center'));
  // a broken tackle, a shed block, the catch: the play's last moment, briefly
  if (L && GD.ph === 'live') { const e = L.ev[L.ev.length - 1]; if (e && L.t - e.t < .9 && (e.k === 'broken' || e.k === 'catch')) txt(c, e.k === 'broken' ? 'Broken tackle!' : 'Caught!', 480, 92, F(20, 800), '#ffd08a', 'center'); }
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
