/* The Anvil Ring: the ring, drawn (issue #23, phase 1). The forge hall from the side and a little above: the ring on
   its platform, the canvas scorched at the edges, red, white and blue ropes, the red corner at the back left and the blue
   at the front right, and the crowd in the dark around it. The fighters are the inked figures (03-figures.js) in
   gloves, posed by what they're doing (bxPose), the nearer one in front, each turned to face the other.
   The bar at the top has both fighters: health (the dark part is what big shots have taken off their most), stamina,
   knockdowns, the cut-man's patches and the plan; the round and the clock are in the middle. Under the ring, the last
   lines of the log. Punches that land show a word (BXT.fx, from BXE). After a knockdown the count is over the fighter;
   between rounds a card has each judge's score for the round and the plans for the next; at the end, the verdict and
   the three cards round by round, with the punch stats.
   Ring space to the screen: bxProj(x, y) puts the middle of the ring at (480, 330); nearer (larger y) is lower and
   bigger. */
const BXT = { t: 0, fx: [], last: 0 };
const BX_PX = 34, BX_PY = 16, BX_MIDY = 328;
function bxProj(x, y, z = 0) { const k = 1 + y * .02; return { x: 480 + x * BX_PX * k, y: BX_MIDY + y * BX_PY - z * k, k }; }
const BX_CROWD = Array.from({ length: 140 }, (_, i) => [((i * 61.7) % 1000) - 20, i % 4, (i * 13) % 7]);

function bxDraw(c) {
  c.fillStyle = '#0b0807'; c.fillRect(0, 0, 960, 600);
  if (!G || !BD) return;
  bxDrawHall(c);
  bxDrawRing(c, 'back');
  const order = G.F.slice().sort((a, b) => a.y - b.y);
  for (const f of order) bxDrawFighter(c, f, G.F[1 - f.side]);
  bxDrawRing(c, 'front');
  bxDrawFx(c);
  bxDrawBar(c);
  bxDrawFeed(c);
  if (BD.ph === 'kd') bxDrawCount(c);
  if (BD.ph === 'intro') bxDrawIntro(c);
  if (BD.ph === 'corner') bxDrawCorner(c);
  if (BD.ph === 'over') bxDrawOver(c);
}
function bxDrawHall(c) {
  // a cone of forge light on the ring, and the crowd's heads in the dark
  const g = c.createRadialGradient(480, 300, 40, 480, 300, 520); g.addColorStop(0, 'rgba(255,170,90,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 90, 960, 510);
  for (const [x, row, v] of BX_CROWD) {
    const y = 150 + row * 13, s = 6 + row * .8;
    c.fillStyle = `rgb(${24 + v * 3},${17 + v * 2},${14 + v})`; c.beginPath(); c.arc(x, y, s, Math.PI, 0); c.fill(); c.fillRect(x - s, y, 2 * s, 14);
  }
  for (const [x, row, v] of BX_CROWD.slice(0, 60)) {
    const y = 560 + row * 10, s = 13 + row;
    c.fillStyle = `rgb(${14 + v * 2},${10 + v},${9 + v})`; c.beginPath(); c.arc((x * 1.3) % 980, y, s, Math.PI, 0); c.fill(); c.fillRect((x * 1.3) % 980 - s, y, 2 * s, 40);
  }
}
const BX_POSTS = [[-9, -9, 'red'], [9, -9, 'white'], [-9, 9, 'white'], [9, 9, 'blue']];
const BX_ROPE = ['#c8352a', '#f0ebe0', '#2f5fb8'];
function bxRopeLine(c, a, b, h) { const p = bxProj(a[0], a[1], h), q = bxProj(b[0], b[1], h); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); }
function bxDrawPost(c, x, y, col) {
  const p = bxProj(x, y), top = bxProj(x, y, 84);
  c.fillStyle = '#5a5550'; c.fillRect(p.x - 3 * p.k, top.y, 6 * p.k, p.y - top.y);
  c.fillStyle = col === 'red' ? '#b8231e' : col === 'blue' ? '#2a5fb8' : '#e6e0d2';
  rr(c, p.x - 6 * p.k, bxProj(x, y, 80).y, 12 * p.k, bxProj(x, y, 26).y - bxProj(x, y, 80).y, 3); c.fill();
}
function bxDrawRing(c, part) {
  const H = BX_RING.half, ropeH = [30, 52, 74];
  if (part === 'back') {
    // the platform's skirt, then the canvas
    const fl = bxProj(-H - .6, H + .6), fr = bxProj(H + .6, H + .6);
    c.fillStyle = '#3a1612'; c.beginPath(); c.moveTo(fl.x, fl.y); c.lineTo(fr.x, fr.y); c.lineTo(fr.x, fr.y + 36); c.lineTo(fl.x, fl.y + 36); c.closePath(); c.fill();
    txt(c, 'THE ANVIL RING', 480, fl.y + 25, '800 16px "Alegreya Sans", sans-serif', 'rgba(255,208,160,.55)', 'center');
    const q = [bxProj(-H - .6, -H - .6), bxProj(H + .6, -H - .6), bxProj(H + .6, H + .6), bxProj(-H - .6, H + .6)];
    c.fillStyle = '#2a1d17'; c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill();
    const f = [bxProj(-H, -H), bxProj(H, -H), bxProj(H, H), bxProj(-H, H)];
    const g = c.createLinearGradient(0, f[0].y, 0, f[2].y); g.addColorStop(0, '#b9ad97'); g.addColorStop(.5, '#d4c9b2'); g.addColorStop(1, '#c4b89f');
    c.fillStyle = g; c.beginPath(); f.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill();
    // scorch at the edges, and an anvil in the middle
    c.save(); c.clip(); c.strokeStyle = 'rgba(40,24,16,.25)'; c.lineWidth = 18; c.stroke(); c.restore();
    const m = bxProj(0, 0); c.fillStyle = 'rgba(120,40,30,.22)';
    c.beginPath(); c.moveTo(m.x - 46, m.y - 8); c.lineTo(m.x + 30, m.y - 8); c.quadraticCurveTo(m.x + 58, m.y - 8, m.x + 62, m.y - 14); c.lineTo(m.x + 30, m.y + 2); c.lineTo(m.x + 18, m.y + 2); c.lineTo(m.x + 24, m.y + 12); c.lineTo(m.x - 30, m.y + 12); c.lineTo(m.x - 24, m.y + 2); c.lineTo(m.x - 46, m.y + 2); c.closePath(); c.fill();
    // the back and side ropes, and the back posts
    c.lineWidth = 2.2;
    ropeH.forEach((h, i) => { c.strokeStyle = BX_ROPE[i]; bxRopeLine(c, [-H, -H], [H, -H], h); bxRopeLine(c, [-H, -H], [-H, H], h); bxRopeLine(c, [H, -H], [H, H], h); });
    for (const [x, y, col] of BX_POSTS.slice(0, 2)) bxDrawPost(c, x, y, col);
  } else {
    c.lineWidth = 2.8;
    ropeH.forEach((h, i) => { c.strokeStyle = BX_ROPE[i]; bxRopeLine(c, [-H, H], [H, H], h); });
    for (const [x, y, col] of BX_POSTS.slice(2)) bxDrawPost(c, x, y, col);
  }
}
/* a fighter's pose from what they're doing (in figure units, facing right; the lead hand is armR) */
function bxPose(f) {
  const K = KIND[f.kind] || KIND.goblin, sh = 17 * K.w * (f.kind === 'ogre' ? .9 : 1), hy = f.kind === 'ogre' || f.kind === 'golem' ? -80 : -83 + (K.hunch ? 8.4 : 0);
  const bob = Math.sin(BXT.t * 5 + f.side * 2) * 1.5, a = f.a, k = a.k;
  const lead = { x: sh + 13, y: hy + 15 + bob }, rear = { x: sh + 3, y: hy + 11 + bob };
  const P = { legL: { a: .32 }, legR: { a: -.26 }, lean: .04, armL: rear, armR: lead };
  const ext = () => a.t < a.hitAt ? Math.sin(Math.min(1, a.t / a.hitAt) * Math.PI / 2) : Math.max(0, 1 - (a.t - a.hitAt) / Math.max(.05, a.dur - a.hitAt));
  if (k === 'jab') { const e = ext(); P.armR = { x: lerp(lead.x, sh + 46, e), y: lerp(lead.y, hy + 6, e) }; P.lean = .04 + .1 * e; P.shift = 3 * e; }
  else if (k === 'hook') { const e = ext(); P.armL = { x: rear.x + 38 * e, y: rear.y - 12 * Math.sin(Math.PI * e) - 2 * e }; P.armR = { x: lead.x - 6, y: lead.y - 4 }; P.lean = .06 + .14 * e; P.shift = 4 * e; }
  else if (k === 'body') { const e = ext(); P.armL = { x: rear.x + 32 * e, y: lerp(rear.y, -50, e) }; P.lean = .1 + .2 * e; P.drop = 5 * e; P.shift = 3 * e; }
  else if (k === 'guard') { P.armR = { x: sh + 8, y: hy + 4 }; P.armL = { x: sh + 2, y: hy + 7 }; P.lean = .1; P.drop = 2; }
  else if (k === 'slip') { const e = Math.sin(Math.min(1, a.t / a.dur) * Math.PI); P.lean = -.3 * e; P.drop = 7 * e; P.shift = -5 * e; }
  else if (k === 'clinch') { P.armR = { x: sh + 30, y: hy + 22 }; P.armL = { x: sh + 26, y: hy + 28 }; P.lean = .22; P.shift = 3; }
  else if (k === 'stun' || k === 'grab') { P.armR = { x: sh + 8, y: -44 }; P.armL = { x: sh - 2, y: -40 }; P.lean = -.12 + Math.sin(BXT.t * 9) * .08; P.drop = 3; }
  else if (k === 'down') { P.armR = { x: sh + 12, y: -60 }; P.armL = { x: -sh - 6, y: -58 }; P.legL = { a: .5 }; P.legR = { a: -.1 }; }
  return P;
}
function bxDrawFighter(c, f, o) {
  const p = bxProj(f.x, f.y), flip = bxProj(o.x, o.y).x < p.x, team = G.corners[f.side], hpx = 92 * p.k;
  const opt = { glove: team.color, pose: bxPose(f), flip, num: '' };
  if (f.a.k === 'down') {
    const e = Math.min(1, f.a.t / .35);
    ell(c, p.x + (flip ? 1 : -1) * 40 * p.k * e, p.y, 46 * p.k, 7 * p.k, 'rgba(0,0,0,.35)');
    c.save(); c.translate(p.x, p.y); c.rotate((flip ? 1 : -1) * 1.45 * e); drawFig(c, f.kind, 0, 0, hpx, team, Object.assign(opt, { noShadow: true })); c.restore();
  } else drawFig(c, f.kind, p.x, p.y, hpx, team, opt);
  // a counter window: a glint at the gloves
  if (f.ctr > 0 && f.a.k !== 'down') { c.save(); c.globalAlpha = Math.min(1, f.ctr * 3); txt(c, '✦', p.x + (flip ? -1 : 1) * 30 * p.k, p.y - 92 * p.k, `${14 * p.k}px sans-serif`, '#ffe9a0', 'center'); c.restore(); }
}
// words for what lands: drained from BXE
function bxDrawFx(c) {
  for (const e of BXE) {
    if (e.drawn) continue; e.drawn = true;
    if (!['land', 'block', 'slip', 'kd', 'stun'].includes(e.k)) continue;
    const t = G.F[e.k === 'slip' || e.k === 'kd' || e.k === 'stun' ? e.side : 1 - e.side], p = bxProj(t.x, t.y);
    const word = e.k === 'block' ? 'blocked' : e.k === 'slip' ? 'slipped' : e.k === 'kd' ? 'DOWN!' : e.k === 'stun' ? 'HURT!' : e.ctr ? 'COUNTER!' : e.n >= 9 ? pick(['WHAM!', 'KRAK!', 'THOOM!']) : e.p === 'body' ? pick(['THUD!', 'OOF!']) : pick(['POW!', 'BAP!', 'SMACK!']);
    BXT.fx.push({ x: p.x, y: p.y - 100 * p.k, word, t: BXT.t, big: e.k === 'kd' || e.k === 'stun' || e.ctr || e.n >= 9, dim: e.k === 'block' || e.k === 'slip' });
  }
  BXT.fx = BXT.fx.filter(f => BXT.t - f.t < .8);
  for (const f of BXT.fx) {
    const a = 1 - (BXT.t - f.t) / .8, s = f.big ? 22 : f.dim ? 11 : 15;
    c.save(); c.globalAlpha = a; c.font = `900 ${s}px "Alegreya Sans", sans-serif`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#17100e';
    const y = f.y - (1 - a) * 18; c.strokeText(f.word, f.x, y); c.fillStyle = f.dim ? '#d8d0c0' : f.big ? '#ffd24a' : '#fff4dc'; c.fillText(f.word, f.x, y); c.restore();
  }
}
function bxBarSide(c, f, right) {
  const team = G.corners[f.side], x0 = right ? 940 : 20, dir = right ? -1 : 1, W = 330;
  const at = (v, w) => right ? x0 - v - w : x0 + v;
  c.fillStyle = team.color; c.fillRect(right ? 934 : 20, 12, 6, 66);
  txt(c, f.n, x0 + dir * 14, 30, '800 17px "Alegreya Sans", sans-serif', '#f4ead8', right ? 'right' : 'left');
  txt(c, `${f.kind} · ${BX_PLAN[f.plan].n}`, x0 + dir * 14, 46, '13px "Alegreya Sans", sans-serif', '#b8aa94', right ? 'right' : 'left');
  // health: lost from the most is dark, the rest red to gold
  const hx = x0 + dir * 14, bw = W;
  c.fillStyle = '#1a1210'; c.fillRect(right ? hx - bw : hx, 52, bw, 10);
  c.fillStyle = '#4a2a24'; c.fillRect(right ? hx - bw * f.hpMax / 100 : hx, 52, bw * f.hpMax / 100, 10);
  const hp = Math.max(0, f.hp) / 100, g = c.createLinearGradient(hx, 0, hx + dir * bw, 0); g.addColorStop(0, '#c8352a'); g.addColorStop(1, '#f2c14a');
  c.fillStyle = g; c.fillRect(right ? hx - bw * hp : hx, 52, bw * hp, 10);
  c.fillStyle = '#1a1210'; c.fillRect(right ? hx - bw : hx, 66, bw, 6);
  c.fillStyle = '#5ab8d8'; c.fillRect(right ? hx - bw * bxFrac(f) : hx, 66, bw * bxFrac(f), 6);
  // knockdowns taken, and the cut-man's patches left
  for (let i = 0; i < BX_RULES.kd; i++) { c.beginPath(); c.arc(at(bw + 26 + i * 14, 0), 57, 4.5, 0, Math.PI * 2); c.fillStyle = i < G.kd[f.side] ? '#ff6a4a' : '#2a1d17'; c.fill(); }
  for (let i = 0; i < BX_RULES.patches; i++) { c.fillStyle = i < f.patches ? '#e8dcc0' : '#2a1d17'; c.fillRect(at(bw + 20 + i * 14, 8), 66, 8, 6); }
}
function bxDrawBar(c) {
  c.fillStyle = 'rgba(14,10,9,.92)'; c.fillRect(0, 0, 960, 90);
  bxBarSide(c, G.F[0], false); bxBarSide(c, G.F[1], true);
  const live = BD.ph === 'round' || BD.ph === 'kd' || BD.ph === 'rise';
  txt(c, BD.ph === 'over' ? 'FINAL' : `ROUND ${G.round} of ${G.rounds}`, 480, 26, '800 13px "Alegreya Sans", sans-serif', '#c9b99c', 'center');
  txt(c, BD.ph === 'intro' ? `0:${String(BX_RULES.secs).padStart(2, '0')}` : `0:${String(Math.ceil(G.clock)).padStart(2, '0')}`, 480, 60, '800 30px "Alegreya Sans", sans-serif', live ? '#fff4dc' : '#8a7c68', 'center');
  txt(c, { intro: 'Touch gloves', round: '', kd: 'Knockdown', rise: 'Box on', corner: 'Between rounds', over: '' }[BD.ph], 480, 80, '12px "Alegreya Sans", sans-serif', '#b8aa94', 'center');
}
function bxDrawFeed(c) {
  const L = G.log.slice(-3);
  L.forEach((l, i) => txt(c, l.msg, 480, 548 + i * 17, `${l.big ? '700 ' : ''}14px "Alegreya Sans", sans-serif`, i === L.length - 1 ? '#f4ead8' : 'rgba(220,206,184,.6)', 'center'));
}
function bxDrawCount(c) {
  const f = G.F[G.down], p = bxProj(f.x, f.y);
  txt(c, String(BD.count), p.x, p.y - 70, '900 54px "Alegreya Sans", sans-serif', '#ffd24a', 'center');
}
function bxPanel(c, x, y, w, h) { c.fillStyle = 'rgba(16,11,9,.9)'; rr(c, x, y, w, h, 8); c.fill(); c.strokeStyle = 'rgba(255,208,160,.25)'; c.lineWidth = 1; c.stroke(); }
function bxDrawIntro(c) {
  bxPanel(c, 250, 270, 460, 110);
  const [A, B] = G.F;
  txt(c, `${A.n}  vs  ${B.n}`, 480, 300, '800 22px "Alegreya Sans", sans-serif', '#f4ead8', 'center');
  BX_STATS.forEach((s, i) => {
    const x = 300 + i * 72;
    txt(c, s === 'gui' ? 'guile' : s === 'sta' ? 'stamina' : s === 'pow' ? 'power' : s === 'spd' ? 'speed' : s, x + 18, 326, '12px "Alegreya Sans", sans-serif', '#b8aa94', 'center');
    txt(c, `${A.r[s]} · ${B.r[s]}`, x + 18, 346, '700 14px "Alegreya Sans", sans-serif', A.r[s] > B.r[s] ? '#ffb0a0' : A.r[s] < B.r[s] ? '#a8c8ff' : '#e8dcc0', 'center');
  });
  txt(c, `red corner: ${BX_PLAN[A.plan].n}  ·  blue corner: ${BX_PLAN[B.plan].n}`, 480, 368, '12px "Alegreya Sans", sans-serif', '#b8aa94', 'center');
}
function bxDrawCorner(c) {
  const n = G.cards.length, sc = G.cards[n - 1], T = bxTotals(), pl = G.plans[G.plans.length - 1];
  bxPanel(c, 280, 270, 400, 110);
  txt(c, `End of round ${n}`, 480, 295, '800 18px "Alegreya Sans", sans-serif', '#f4ead8', 'center');
  BX_JUDGES.forEach((J, j) => txt(c, `${J.n}  ${sc[j][0]}-${sc[j][1]}  (${T[j][0]}-${T[j][1]})`, 340 + j * 140, 322, '14px "Alegreya Sans", sans-serif', '#e8dcc0', 'center'));
  txt(c, `Round ${G.round}: ${G.F[0].n} will ${BX_PLAN[pl[0]].n.toLowerCase()}, ${G.F[1].n} will ${BX_PLAN[pl[1]].n.toLowerCase()}.`, 480, 352, '13px "Alegreya Sans", sans-serif', '#b8aa94', 'center');
}
function bxDrawOver(c) {
  const v = G.over, T = bxTotals();
  bxPanel(c, 220, 140, 520, 250);
  const head = v.how === 'ko' ? 'KNOCKOUT' : v.how === 'tko' ? 'STOPPAGE' : v.win == null ? 'DRAW' : `${v.kind.toUpperCase()} DECISION`;
  txt(c, head, 480, 178, '900 28px "Alegreya Sans", sans-serif', '#ffd24a', 'center');
  txt(c, bxVerdict(), 480, 202, '15px "Alegreya Sans", sans-serif', '#f4ead8', 'center');
  // the cards, round by round
  const n = G.cards.length;
  txt(c, 'Judge', 270, 232, '700 12px "Alegreya Sans", sans-serif', '#b8aa94');
  for (let r = 0; r < n; r++) txt(c, `R${r + 1}`, 400 + r * 60, 232, '700 12px "Alegreya Sans", sans-serif', '#b8aa94', 'center');
  txt(c, 'Total', 660, 232, '700 12px "Alegreya Sans", sans-serif', '#b8aa94', 'center');
  BX_JUDGES.forEach((J, j) => {
    const y = 254 + j * 20;
    txt(c, `${J.n} (${J.likes})`, 270, y, '13px "Alegreya Sans", sans-serif', '#e8dcc0');
    for (let r = 0; r < n; r++) txt(c, `${G.cards[r][j][0]}-${G.cards[r][j][1]}`, 400 + r * 60, y, '13px "Alegreya Sans", sans-serif', '#e8dcc0', 'center');
    txt(c, n ? `${T[j][0]}-${T[j][1]}` : '-', 660, y, '700 13px "Alegreya Sans", sans-serif', '#f4ead8', 'center');
  });
  const [a, b] = G.F.map(f => f.bs);
  [['Landed', `${a.landed}/${a.thrown}`, `${b.landed}/${b.thrown}`], ['Power punches', a.power, b.power], ['Slipped / blocked', `${a.slips} / ${a.blocks}`, `${b.slips} / ${b.blocks}`], ['Knockdowns', G.kd[1], G.kd[0]]]
    .forEach(([k, x, y], i) => { const yy = 330 + i * 15; txt(c, String(x), 380, yy, '13px "Alegreya Sans", sans-serif', '#ffb0a0', 'center'); txt(c, k, 480, yy, '12px "Alegreya Sans", sans-serif', '#b8aa94', 'center'); txt(c, String(y), 580, yy, '13px "Alegreya Sans", sans-serif', '#a8c8ff', 'center'); });
}
