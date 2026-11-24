/* ================= the ground's own ways: Graftonbury Ballpark (the Realm, issue #115, phase 4) ================= */
// Nothing here acts in the standalone game: it only wakes when a game's rules carry ground (the Realm sends it for its
// ball games at the Ballpark), and with G.gd null every hook below passes straight through and draws nothing from the
// random stream, so a seeded game plays exactly as before. The Realm's side is src/realm/w146-ballpark.js.
// rules.ground = { on, night (a night game: the floodlights are on), grass, dim (each on unless false),
//                  read: [bool, bool] (which sides' CPU reads them; both when left out), inert (the labs only: the dim
//                  patch is drawn and counted but does nothing, to measure it against) }
// G.gd = { night, grassOn, read, inert, n (pitches thrown this half), dim: { x, y, r, a } | null, pulled (the half a CPU last
//          pulled its pitcher for the grass), said, tally: { pitches, rakes, fly, flyOut, bob, catches, pulls, aims } }, plain
//          data, kept in the snapshot.
// - The mound grass. The grass on the mound grows back through a half-inning: every pitch thrown in the half (by any
//   pitcher: it is the mound's, not the arm's) adds to it, up to GD.full, and every pitch's scatter grows with it (up to
//   GD.slip more at full: gdGrass, at the release). Dusty Marl rakes it between half-innings (startHalf), so a long
//   inning hurts more than a long game, and a pitching change mid-inning doesn't clear it. Drawn creeping in over the
//   mound from its edge to the rubber, and in the conditions list (MOUND GRASS).
//   The CPU reads it by its skill (GD.pull): with the grass at GD.pullAt or more, it pulls a tiring pitcher sooner, the
//   more the longer the inning has run, once a half (the reason in the play-by-play).
// - The flickering floodlight. In a night game one of the outfield floodlights flickers and leaves a dim patch in the
//   outfield, drawn at the start of the game from the random stream (a different place each game): GD.dimR feet round a
//   spot GD.dimD feet out at up to GD.dimA degrees off center. A fly ball (one that rises GD.flyZ feet or more) that would
//   land in it is harder to read: every fielder reads it GD.react seconds later (they plan for it, and stand still that
//   much longer, in the movement step: fStill, so their speed stays real to the runners and the CPU), and a catch in the air inside it bobbles GD.bob times as often. Drawn darker, under a lamp that
//   flickers, and in the conditions list (DIM PATCH). A day game has no patch: the lights are off.
//   The CPU's batters read it by their skill (GD.aim): they time the swing to pull or push the ball toward it (a
//   swing early or late costs some contact, so it is a trade, not a free hit).
const GD = { full: 30, slip: .5, pullAt: .5, pull: [0, .08, .12, .16],
  dimR: 55, dimD: [215, 285], dimA: 34, flyZ: 20, react: .35, bob: 1.8, aim: [0, .35, .55, .7], aimMax: .6, rakeSay: 15,
  say: { grass: 'The grass on the mound grows back through an inning, and I rake it between.', night: where => `Night game: the floodlight out in ${where} field is flickering again, so mind the dark patch out there.` } };
const gdR3 = v => +v.toFixed(3);
function gdNew(P, noDraw) {
  if (!P || P.on === false) return null;
  const night = !!P.night, D = { night, grassOn: P.grass !== false, read: Array.isArray(P.read) ? [!!P.read[0], !!P.read[1]] : [true, true], inert: !!P.inert, n: 0, dim: null, pulled: -1, said: false,
    tally: { pitches: 0, rakes: 0, fly: 0, flyOut: 0, bob: 0, catches: 0, pulls: 0, aims: 0 } };
  // (which light is the faulty one is drawn every game, by day too, so a day game and a night game from the same seed
  // play the same random stream: it only leaves a patch when the lights are on)
  if (P.dim !== false && !noDraw) {
    const a = (R() * 2 - 1) * GD.dimA, d = GD.dimD[0] + R() * (GD.dimD[1] - GD.dimD[0]);
    if (night) D.dim = { x: gdR3(d * Math.sin(a * DEG)), y: gdR3(d * Math.cos(a * DEG)), r: GD.dimR, a: gdR3(a) };
  }
  return D;
}
const gdKitStart0 = kitStart;
kitStart = function (opts) { gdKitStart0.apply(this, arguments); G.gd = gdNew(G.rules && G.rules.ground); };
// how far the grass has crept over the mound, 0 to 1
const gdGrass = () => { const D = G.gd; return D && D.grassOn ? Math.min(1, D.n / GD.full) : 0; };
// is the field point (x, y) in the dim patch?
const gdInDim = (x, y) => { const d = G.gd && G.gd.dim; return !!d && hyp(x - d.x, y - d.y) < d.r; };
const gdWhere = d => d.a < -12 ? 'left' : d.a > 12 ? 'right' : 'center';
// a fly ball that would land in the dim patch (a home run doesn't land)
function gdDimFly(tr) {
  if (!G.gd || !G.gd.dim || !tr || tr.hrAt >= 0) return false;
  let top = 0; for (const q of tr.pts) if (q.z > top) top = q.z;
  if (top < GD.flyZ) return false;
  const q = tr.pts[tr.firstBounce >= 0 ? tr.firstBounce : tr.pts.length - 1];
  return gdInDim(q.x, q.y);
}

/* ---------- the mound grass ---------- */
// at the release: the grass over the rubber spreads the pitch (after gear, potions and powers), and the pitch adds to it
const gdOnRelease0 = gearOnRelease;
gearOnRelease = function (pc, pd, st, ctrl) {
  ctrl = gdOnRelease0.apply(this, arguments);
  const D = G.gd; if (!D) return ctrl;
  const g = gdGrass();
  if (D.grassOn) { D.n++; D.tally.pitches++; }
  // (how far the grass was over the rubber, and what it did to this pitch's scatter, on the pitch: plain data)
  if (g > 0) { pc.gdGrass = gdR3(g); pc.gdCtrl = gdR3(1 + GD.slip * g); ctrl *= 1 + GD.slip * g; }
  return ctrl;
};
// between half-innings Dusty rakes the mound (and says his piece before the first pitch of the game)
const gdStartHalf0 = startHalf;
startHalf = function () {
  const D = G.gd;
  if (D && D.grassOn && D.n > 0) { if (D.n >= GD.rakeSay) logLine('Dusty Marl rakes the mound between halves.'); D.n = 0; D.tally.rakes++; }
  const r = gdStartHalf0.apply(this, arguments);
  if (D && !D.said) {
    D.said = true;
    const t = [D.dim ? GD.say.night(gdWhere(D.dim)) : '', D.grassOn ? GD.say.grass : ''].filter(Boolean).join(' ');
    if (t) logLine(`Dusty Marl: "${t}"`);
  }
  return r;
};
// the CPU reads it by skill: a tiring pitcher in a long inning comes out sooner (once a half; yours stays yours)
const gdStartPitch0 = startPitch;
startPitch = function () {
  const r = gdStartPitch0.apply(this, arguments), D = G.gd;
  if (!D || !D.grassOn || G.phase !== 'plate' || !G.P || D.pulled === kitKey()) return r;
  const s = 1 - G.half, ft = G.teams[s], pt = pitcher(), g = gdGrass();
  if (isHuman(ft) || !D.read[s] || !ft.pen.length || g < GD.pullAt) return r;
  const k = GD.pull[Math.min(3, dOf(ft))]; if (!k || fatigue(pt) >= .22 + k * g) return r;
  D.pulled = kitKey(); D.tally.pulls++;
  logLine(`${ft.def.short || ft.def.name} go to the bullpen: ${shortName(pt)} is tiring, ${D.n} pitches into the half, and the grass is over the rubber.`);
  bullpen(ft);
  return r;
};

/* ---------- the flickering floodlight ---------- */
// a batted ball: is it a fly into the dim patch? (decided once, at the play's first look for a chaser)
const gdComputeChaser0 = computeChaser;
computeChaser = function () {
  const D = G.gd, L = PL;
  if (D && D.dim && L && L.gdDim === undefined) { L.gdDim = gdDimFly(L.tr); if (L.gdDim) D.tally.fly++; }
  return gdComputeChaser0.apply(this, arguments);
};
const gdDimNow = () => !!(G.gd && !G.gd.inert && PL && PL.gdDim && PL.ball && PL.ball.st === 'batted');
// every fielder reads it later: their plan for it, and how long they stand still
const gdZoneAdd0 = zoneAdd;
zoneAdd = function (key) { const a = gdZoneAdd0.apply(this, arguments); return key === 'react' && gdDimNow() ? a + GD.react : a; };
// (in the movement step only, as the engine's own read off the bat: fSpeed stays the real speed, so the runners' and the
// CPU's reckoning of a close race isn't thrown by a fielder who is only standing still a moment)
const gdFStill0 = fStill;
fStill = function (f) { return gdFStill0.apply(this, arguments) || (gdDimNow() && PL.ball.holder !== f && PL.t < (f.p.pos === 'P' ? .7 : .5) + GD.react); };
// a catch in the air inside the dim patch bobbles more (the same one roll for a bobble: nothing more drawn)
let gdBobK = 1;
const gdZoneMult0 = zoneMult;
zoneMult = function (key) { const m = gdZoneMult0.apply(this, arguments); return key === 'bobble' && gdBobK !== 1 ? m * gdBobK : m; };
const gdFieldBall0 = fieldBall;
fieldBall = function (f) {
  const D = G.gd, L = PL, b = L && L.ball;
  if (!D || !D.dim || !b) return gdFieldBall0.apply(this, arguments);
  const air = b.st === 'batted' && !trAt(b.bt).b && b.z > .4, dim = air && gdInDim(b.x, b.y), was = L.bobbled, out = L.caughtInAir;
  if (dim) { gdBobK = D.inert ? 1 : GD.bob; D.tally.catches++; }
  try { return gdFieldBall0.apply(this, arguments); }
  finally {
    gdBobK = 1;
    if (dim && L.bobbled && !was) { D.tally.bob++; if (!D.inert) logLine(`${shortName(f.p)} loses it under the flickering light.`); }
    if (L.gdDim && L.caughtInAir && !out) D.tally.flyOut++;
  }
};
// the CPU's batters read it by their skill: time the swing to pull or push the ball toward it
const gdCpuPlanSwing0 = cpuPlanSwing;
cpuPlanSwing = function () {
  const r = gdCpuPlanSwing0.apply(this, arguments), D = G.gd, P = G.P;
  if (!D || !D.dim || !P || !P.cpu || !P.cpu.swing || !D.read[G.half]) return r;
  const k = GD.aim[Math.min(3, dOf(BT()))]; if (!k) return r;
  const bat = batter(), hs = bat.hand === 'R' ? 1 : -1, win = (.085 + bat.con * .007) * (1 - .2 * fk(bat));
  const e = clamp(D.dim.a / (50 * hs), -GD.aimMax, GD.aimMax) * win;
  P.cpu.swingT += k * e; P.cpu.gdAim = gdR3(k * e); D.tally.aims++;
  return r;
};

/* ---------- drawn on the field ---------- */
// the lamp's flicker, from the clock (never the random stream): 1 lit, down to .15 in a blink
function gdFlick() { const t = G.time || 0, v = Math.sin(t * 13.1) + Math.sin(t * 4.7 + 1.3) + Math.sin(t * 29.3); return v > 1.6 ? .15 : v > 1.1 ? .5 : 1; }
// grass tufts over the mound, crept in from the edge as far as the grass has grown (pt: field feet to the screen)
function gdTufts(c, pt, sz) {
  const g = gdGrass(); if (g <= 0) return;
  const rnd = srand(77), n = Math.round(10 + 50 * g);
  c.save(); c.strokeStyle = 'rgba(112,178,72,.9)'; c.lineWidth = 1.2;
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, d = 9 - rnd() * 9 * g, p = pt(d * Math.cos(a), 60.5 + d * Math.sin(a)), h = sz(p) * (3 + rnd() * 3);
    c.beginPath(); c.moveTo(p.x - 1.5, p.y); c.lineTo(p.x - 2.2, p.y - h); c.moveTo(p.x, p.y); c.lineTo(p.x + .4, p.y - h * 1.2); c.moveTo(p.x + 1.5, p.y); c.lineTo(p.x + 2.3, p.y - h * .8); c.stroke();
  }
  c.restore();
}
function gdDrawField(c) {
  const D = G.gd; if (!D || !G.teams) return;
  gdTufts(c, (x, y) => fp(x, y), () => 1);
  const d = D.dim; if (!d) return;
  const fl = gdFlick(), p = fp(d.x, d.y), r = d.r * FS;
  c.save();
  const g = c.createRadialGradient(p.x, p.y, r * .2, p.x, p.y, r);
  g.addColorStop(0, `rgba(4,6,16,${.55 - .25 * fl})`); g.addColorStop(.75, `rgba(4,6,16,${.42 - .2 * fl})`); g.addColorStop(1, 'rgba(4,6,16,0)');
  c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
  // the lamp on its pole, behind the wall
  const A = d.a * DEG, fr = fenceR(A) + 18, L = fp(fr * Math.sin(A), fr * Math.cos(A));
  c.strokeStyle = '#3a3a40'; c.lineWidth = 2; c.beginPath(); c.moveTo(L.x, L.y + 14); c.lineTo(L.x, L.y); c.stroke();
  c.fillStyle = '#2a2a30'; c.fillRect(L.x - 9, L.y - 6, 18, 7);
  for (let i = 0; i < 3; i++) circ(c, L.x - 5.5 + i * 5.5, L.y - 2.5, 2, i === 1 ? `rgba(255,244,200,${fl})` : `rgba(255,244,200,${.25 + .75 * fl})`);
  if (fl > .4) { const h = c.createRadialGradient(L.x, L.y, 1, L.x, L.y, 22); h.addColorStop(0, `rgba(255,240,190,${.35 * fl})`); h.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = h; c.fillRect(L.x - 24, L.y - 24, 48, 48); }
  c.restore();
}
function gdDrawPlate(c) {
  const D = G.gd; if (!D || !G.teams) return;
  gdTufts(c, (x, y) => proj(x, y, 0), p => p.k * 1.6);
  const d = D.dim; if (!d) return;
  const fl = gdFlick(), q = proj(d.x, d.y, 0), q1 = proj(d.x, d.y - d.r, 0), q2 = proj(d.x, d.y + d.r, 0), rx = d.r * PXF * q.k, ry = Math.max(3, (q1.y - q2.y) / 2);
  c.save();
  const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, rx); g.addColorStop(0, `rgba(4,6,16,${.5 - .22 * fl})`); g.addColorStop(1, 'rgba(4,6,16,0)');
  c.translate(q.x, q.y); c.scale(1, ry / rx); c.translate(-q.x, -q.y);
  c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, rx, 0, Math.PI * 2); c.fill();
  c.restore();
  // the lamp over the wall, on the side of the patch (at the edge of the view when the patch is out of it), and the
  // outfield in shadow toward it
  const lx = clamp(q.x, 40, W - 40), ly = GY - 46, off = q.x < 40 || q.x > W - 40;
  c.save();
  if (off) { const left = q.x < 40, sh = c.createLinearGradient(left ? 0 : W, 0, left ? 220 : W - 220, 0); sh.addColorStop(0, `rgba(4,6,16,${.5 - .22 * fl})`); sh.addColorStop(1, 'rgba(4,6,16,0)'); c.fillStyle = sh; c.fillRect(left ? 0 : W - 220, GY - 4, 220, proj(0, 150, 0).y - GY + 4); }
  c.strokeStyle = '#3a3a40'; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, ly + 3); c.lineTo(lx, GY - 8); c.stroke();
  c.fillStyle = '#2a2a30'; c.fillRect(lx - 11, ly - 5, 22, 8);
  for (let i = 0; i < 3; i++) circ(c, lx - 7 + i * 7, ly - 1, 2.3, `rgba(255,244,200,${i === 1 ? fl : .25 + .75 * fl})`);
  if (fl > .4) { const h = c.createRadialGradient(lx, ly, 1, lx, ly, 26); h.addColorStop(0, `rgba(255,240,190,${.35 * fl})`); h.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = h; c.fillRect(lx - 28, ly - 28, 56, 56); }
  c.restore();
}
// in the conditions list, under any field conditions
function gdDrawHud(c) {
  const D = G.gd; if (!D || !G.teams) return;
  const out = [];
  const g = gdGrass(); if (g > 0) out.push([`MOUND GRASS · ${Math.round(g * 100)}%`, '#9fd27a']);
  if (D.dim) out.push([`DIM PATCH · ${gdWhere(D.dim).toUpperCase()}`, gdFlick() < .6 ? '#7a84a6' : '#aab4d8']);
  let y = 104 + 23 * zones().length;
  for (const [lbl, col] of out) {
    c.font = F_HUD(15); const tw = c.measureText(lbl).width + 16, x = W - 10 - tw;
    rr(c, x, y, tw, 19, 9); c.fillStyle = 'rgba(8,10,12,.8)'; c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.stroke();
    txt(c, lbl, x + 8, y + 14, F_HUD(15), col); y += 23;
  }
}
const gdDrawZonesField0 = drawZonesField, gdDrawZonesPlate0 = drawZonesPlate, gdDrawConditions0 = drawConditions;
drawZonesField = function (c) { gdDrawZonesField0.apply(this, arguments); gdDrawField(c); };
drawZonesPlate = function (c) { gdDrawZonesPlate0.apply(this, arguments); gdDrawPlate(c); };
drawConditions = function (c) { gdDrawConditions0.apply(this, arguments); gdDrawHud(c); };

/* ---------- saved with the game ---------- */
const gdSnap0 = snapGame;
snapGame = function () { const sn = gdSnap0.apply(this, arguments); if (sn && G.gd) sn.gd = JSON.parse(JSON.stringify(G.gd)); return sn; };
const gdResume0 = resumeSnap;
resumeSnap = function (sn) {
  // (a game saved before the ground came in plays on without a dim patch: nothing is drawn from the random stream)
  G.gd = sn && sn.gd ? JSON.parse(JSON.stringify(sn.gd)) : gdNew(sn && sn.rules && sn.rules.ground, true);
  return gdResume0.apply(this, arguments);
};
