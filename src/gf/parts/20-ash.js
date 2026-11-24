/* Cinder Gridiron: the Ash Bowl's own ways (issue #115, phase 4). Only in games started with opts.ash (the Realm's games,
   w144-ashbowl.js); the bare engine, its tests and the labs leave it out unless asked. With G.ash unset every hook passes
   straight through and nothing draws from the seeded stream, so a game plays exactly as before.
   - Ashfall. Ash drifts down through each half and settles in GF_ASHB.n grey patches on the grass (within GF_ASHB.wide
     yards across the middle), each at its own time (at: seconds of play, in the first GF_ASHB.settle of the half; the ash
     is drawn falling GF_ASHB.lead seconds before), and grows from GF_ASHB.r0 yards by GF_ASHB.grow a second of play, up
     to its own size (m). A ball carrier who cuts on a patch (turns more than GF_ASHB.cutAng while running at GF_ASHB.cutV
     or more) slows for a moment, and may stumble (GF_ASHB.slip). A loose ball that comes out on one skids and dies (no
     return), and a punt that comes down on one loses its roll. Clinker Dunn sweeps the pitch at the half and at a
     timeout (one a half a side, gfAshTimeout), and new ash starts to fall.
   - The heat shimmer. The basalt stands at one end (G.ash.hot: 0 the left end, 1 the right) throw heat over the field. A
     pass toward that end wobbles by GF_ASHB.shimK a yard it travels past GF_ASHB.shimFrom downfield; a field goal toward
     it is GF_ASHB.fgK less likely a yard past GF_ASHB.fgFrom; a punt toward it loses up to GF_ASHB.puntK a yard past
     GF_ASHB.puntFrom. The ends switch at the half (and again for Sudden Death), so each side faces it once.
   - The CPU reads both by skill (G.skill of the side): a Squire not at all; a Knight or better saves its deep calls for
     the other end (gfOffLean), its quarterback looks shorter facing the heat, its carriers hold their line on the ash
     rather than cut there, and on offense it calls the timeout for a sweep when a big patch (GF_ASHB.toR yards) lies
     just ahead (gfAshAhead); an Archmage and the Lich also steer round a patch before they reach it.
   G.ash = { t (seconds of play since the last sweep), patches: [{ x, y, at, m }] (field space, 09-draw.js), hot, to: [n, n]
   (timeouts left this half), sweeps, tally: { cut, slip, dead, wob, fg } }, plain JSON in G, so the snapshot keeps it.
   G.ash.said is Clinker's line at the kickoff. */
const GF_ASHB = { n: 5, r0: 1.8, grow: .025, m: [4.5, 7], settle: .6, wide: 32, lead: 50, cutAng: .55, cutV: 3, slow: .4, slip: .3, stun: .5, cd: .5,
  roll: 7, shimFrom: 12, shimK: .07, fgFrom: 25, fgK: .007, puntFrom: 25, puntK: .2, deepLean: .4, deepAway: 1.15, deepW: .04, to: 1, toNear: 15, toR: 4, toY: 12 };
const gfAshR2 = v => +v.toFixed(2);
const gfAshSkill = s => clamp(((G && G.skill) || [1, 1])[s] | 0, 0, 3);
const gfAshHalfLen = () => GD && GD.game && G.half === 3 ? GF_GAME.ot : GF_GAME.half;

// new ash, to fall through the half from now
function gfAshFall() {
  const A = G.ash, len = gfAshHalfLen(); A.t = 0; A.patches = [];
  for (let i = 0; i < GF_ASHB.n; i++) A.patches.push({ x: gfAshR2(6 + R() * 88), y: gfAshR2((R() - .5) * GF_ASHB.wide), at: Math.round(R() * GF_ASHB.settle * len), m: gfAshR2(lerp(GF_ASHB.m[0], GF_ASHB.m[1], R())) });
}
function gfAshNew(on) {
  if (!on) return null;
  return { t: 0, patches: [], hot: R() < .5 ? 0 : 1, to: [GF_ASHB.to, GF_ASHB.to], sweeps: 0, tally: { cut: 0, slip: 0, dead: 0, wob: 0, fg: 0 }, said: '' };
}
const gfAshStart0 = gfStart;
gfStart = function (opts) {
  const g = gfAshStart0.apply(this, arguments), A = gfAshNew(opts && opts.ash);
  if (A) { G.ash = A; gfAshFall(); A.said = `Clinker Dunn: "Ash is coming down today, and the heat's off the stands at ${G.teams[A.hot].name}'s end. Keep the long ones for the other."`; }
  return g;
};

/* ---------- where the ash is ---------- */
// a patch's size now, in yards (0 before it settles)
const gfAshRad = P => { const A = G.ash; return !A || A.t < P.at ? 0 : Math.min(P.m, GF_ASHB.r0 + (A.t - P.at) * GF_ASHB.grow); };
// the patch at a field point (09-draw.js space), or null
function gfAshAt(ax, ay) {
  const A = G && G.ash; if (!A) return null;
  for (const P of A.patches) { const r = gfAshRad(P); if (r > 0 && ((ax - P.x) / r) ** 2 + ((ay - P.y) / r) ** 2 < 1) return P; }
  return null;
}
// the heat is at the end side drives toward
const gfAshFacing = s => !!(G && G.ash) && G.ash.hot === (s === 0 ? 1 : 0);
// the ash's clock runs with the game's (a drive with no game clock: the play and the runoff)
const gfAshClock0 = gfRunClock;
gfRunClock = function (what, t) {
  const c0 = G.clock, out = gfAshClock0.apply(this, arguments), A = G.ash;
  if (A) A.t += GD && GD.game ? Math.max(0, c0 - G.clock) : Math.round(t + GF_GAME.runoff);
  return out;
};
// the sweep: at the half and at a timeout; the ash starts again
function gfAshSweep() { const A = G.ash; if (!A) return; A.sweeps++; gfAshFall(); }
const gfAshNext0 = gfGameNext;
gfGameNext = function () {
  const h = G.half, out = gfAshNext0.apply(this, arguments), A = G.ash;
  if (A && G.half !== h) {
    A.hot = 1 - A.hot; A.to = [GF_ASHB.to, GF_ASHB.to]; gfAshSweep();
    GD.msg += ` Clinker Dunn sweeps the ash off the pitch, and the heat is at ${G.teams[A.hot].name}'s end now.`;
  }
  return out;
};

/* ---------- the carrier on the ash ---------- */
function gfAshCut(p, tx, ty) {
  const A = G.ash, v = hyp(p.vx, p.vy), dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
  if (v < GF_ASHB.cutV || d < .3 || (p.vx * dx + p.vy * dy) / (v * d) > Math.cos(GF_ASHB.cutAng) || L.t - (p.ashT ?? -9) < GF_ASHB.cd) return;
  const [ax, ay] = gfAbs(p.x, p.y); if (!gfAshAt(ax, ay)) return;
  p.ashT = L.t; p.slow = Math.max(p.slow, GF_ASHB.slow); A.tally.cut++;
  if (R() < GF_ASHB.slip) { p.stun = Math.max(p.stun, GF_ASHB.stun); A.tally.slip++; gfEv('ash', p.n, 'slip'); } else gfEv('ash', p.n, 'cut');
}
const gfAshMove0 = gfMove;
gfMove = function (p, tx, ty) {
  if (G.ash && L && L.ball.st === 'held' && L.pl[L.ball.h] === p && !(L.ball.h === L.id.QB && !L.thrown && p.x < 0)) gfAshCut(p, tx, ty);
  return gfAshMove0.apply(this, arguments);
};
// the carrier's lane, read by the coach's skill: a Knight or better holds the line on the ash rather than cut there, and
// an Archmage or the Lich steers off a patch before reaching it (the cut on clean grass)
const gfAshRunLine0 = gfRunLine;
gfRunLine = function (p) {
  const out = gfAshRunLine0.apply(this, arguments);
  if (!G.ash || p.job === 'take' && p.x < -1.5) return out;
  const sk = gfAshSkill(G.poss); if (sk < 1) return out;
  const v = hyp(p.vx, p.vy), [ax, ay] = gfAbs(p.x, p.y);
  if (gfAshAt(ax, ay)) return v > 1 && p.vx > 0 ? [p.x + p.vx / v * 5, p.y + p.vy / v * 5] : out;
  if (sk < 2 || !gfAshAt(...gfAbs((p.x + out[0]) / 2, (p.y + out[1]) / 2))) return out;
  for (const dy of [1.5, -1.5, 3, -3, 4.5, -4.5]) { const y = clamp(out[1] + dy, -GF_HALF + 2, GF_HALF - 2); if (!gfAshAt(...gfAbs((p.x + out[0]) / 2, (p.y + y) / 2)) && !gfAshAt(...gfAbs(out[0], y))) return [out[0], y]; }
  return out;
};
// a loose ball on the ash skids and dies: no return
const gfAshFumble0 = gfFumble;
gfFumble = function (c) {
  const out = gfAshFumble0.apply(this, arguments);
  if (G.ash && out.ret > 0 && gfAshAt(...gfAbs(c.x, c.y))) { out.ret = 0; G.ash.tally.dead++; gfEv('ash', out.rec, 'dead'); }
  return out;
};

/* ---------- the heat shimmer ---------- */
// a throw toward the heat wobbles, more the deeper it goes (the ball already in the air: its landing spot and its time)
function gfAshShimmer() {
  const B = L.ball, deep = B.tx - B.fx - GF_ASHB.shimFrom; if (deep <= 0) return;
  const d0 = hyp(B.tx - B.fx, B.ty - B.fy), v = d0 / B.T, e = deep * GF_ASHB.shimK;
  B.tx += gauss() * e; B.ty += gauss() * e; B.T = Math.max(.25, hyp(B.tx - B.fx, B.ty - B.fy) / v);
  L.air = Math.round(B.tx); L.shim = gfAshR2(e); G.ash.tally.wob++;
}
const gfAshThrow0 = gfThrow, gfAshThrowTo0 = gfThrowTo;
gfThrow = function () { const out = gfAshThrow0.apply(this, arguments); if (G.ash && gfAshFacing(G.poss) && L.ball.st === 'air') gfAshShimmer(); return out; };
gfThrowTo = function () { const out = gfAshThrowTo0.apply(this, arguments); if (G.ash && gfAshFacing(G.poss) && L.ball.st === 'air') gfAshShimmer(); return out; };
// a field goal toward the heat: this much less likely (0 when it isn't)
const gfAshFgCut = () => G.ash && gfAshFacing(G.poss) ? Math.max(0, gfKickDist() - GF_ASHB.fgFrom) * GF_ASHB.fgK : 0;
const gfAshChance0 = gfKickChance;
gfKickChance = function () { const ch = gfAshChance0.apply(this, arguments), cut = gfAshFgCut(); return cut ? clamp(ch - cut, .05, .99) : ch; };
// (your kick by hand: a good one can still wobble wide)
const gfAshMeterFg0 = gfMeterFg;
gfMeterFg = function () { const good = gfAshMeterFg0.apply(this, arguments), cut = gfAshFgCut(); if (good && cut && R() < cut) { G.ash.fgWob = true; return false; } return good; };
// a punt: toward the heat it wobbles short; where it comes down (before its roll), a patch kills the roll
function gfAshPunt(y0) {
  const A = G.ash; if (!A) return y0;
  let y = y0; A.punt = null;
  if (gfAshFacing(G.poss) && y > GF_ASHB.puntFrom) { const w = Math.round(Math.abs(gauss()) * (y - GF_ASHB.puntFrom) * GF_ASHB.puntK); if (w) { y -= w; A.punt = { wob: w }; A.tally.wob++; } }
  const land = y - GF_ASHB.roll, ay = gauss() * 9;
  if (G.ball + land < GF_RULES.field && gfAshAt(G.poss === 0 ? G.ball + land : GF_RULES.field - G.ball - land, ay)) { y -= GF_ASHB.roll; A.punt = Object.assign(A.punt || {}, { dead: true }); A.tally.dead++; }
  return y;
}
const gfAshPuntY0 = gfPuntYards, gfAshMeterPunt0 = gfMeterPunt;
gfPuntYards = function () { const y = gfAshPuntY0.apply(this, arguments); return G.ash ? gfAshPunt(y) : y; };
gfMeterPunt = function () { const y = gfAshMeterPunt0.apply(this, arguments); return G.ash ? gfAshPunt(y) : y; };
// the kick's reason says what the heat and the ash did
const gfAshKick0 = gfKick;
gfKick = function () {
  const A = G.ash, fg = GD.kick === 'fg', cut = A && fg ? gfAshFgCut() : 0;
  if (A) { A.punt = null; A.fgWob = false; }
  const out = gfAshKick0.apply(this, arguments);
  if (!A) return out;
  let add = '';
  if (fg && cut) { add = ` The heat shimmer at this end costs it ${Math.round(cut * 100)}%${A.fgWob ? ', and it wobbled wide' : ''}.`; A.tally.fg++; }
  if (!fg && A.punt) add = (A.punt.wob ? ` The heat shimmer at this end knocks ${A.punt.wob} yard${A.punt.wob === 1 ? '' : 's'} off it.` : '') + (A.punt.dead ? ' It comes down on the ash and dies there.' : '');
  if (add) { GD.why += add; const e = G.drive.plays[G.drive.plays.length - 1]; if (e && e.oc === (fg ? 'fg' : 'punt')) e.why = (e.why || '') + add; }
  A.punt = null; A.fgWob = false;
  return out;
};

/* ---------- the coaches ---------- */
// a Knight or better saves its deep calls for the other end
const gfAshLean0 = gfOffLean;
gfOffLean = function () {
  const w = gfAshLean0.apply(this, arguments);
  if (G.ash && gfAshSkill(G.poss) >= 1) w.deep *= gfAshFacing(G.poss) ? GF_ASHB.deepLean : GF_ASHB.deepAway;
  return w;
};
// and its quarterback looks shorter facing the heat (not yours by hand)
const gfAshSnapFx0 = gfSnapFx;
gfSnapFx = function () {
  const out = gfAshSnapFx0.apply(this, arguments);
  if (G.ash && !L.hands && gfAshSkill(G.poss) >= 1 && gfAshFacing(G.poss)) L.fx = Object.assign({}, L.fx, { deepW: (L.fx.deepW || 0) - GF_ASHB.deepW });
  return out;
};
// a timeout: Clinker sweeps the pitch (one a half each side, at a call). '' when it was called, or why not
function gfAshTimeout(side) {
  const A = G && G.ash; if (!A) return 'No ash today.';
  if (!GD || GD.ph !== 'call') return 'A timeout waits for the next call.';
  if (A.to[side] < 1) return 'No timeouts left this half.';
  gfAshCallTO(side); return '';
}
function gfAshCallTO(side) { G.ash.to[side]--; gfAshSweep(); gfNote(side, 'ash', 'Timeout: Clinker Dunn sweeps the ash off the pitch.'); }
// the big patch ahead of the ball, within GF_ASHB.toNear yards and GF_ASHB.toY of the middle (null when there is none)
function gfAshAhead() {
  const A = G.ash, d = G.poss === 0 ? 1 : -1, b = G.poss === 0 ? G.ball : GF_RULES.field - G.ball;
  return A.patches.find(P => gfAshRad(P) >= GF_ASHB.toR && (P.x - b) * d > -2 && (P.x - b) * d < GF_ASHB.toNear && Math.abs(P.y) < GF_ASHB.toY) || null;
}
// on offense, a Knight or better calls it when a big patch lies just ahead
function gfAshCpu() {
  const s = G.poss;
  if ((GD.mode === 'watch' || s !== GD.you) && G.ash.to[s] > 0 && gfAshSkill(s) >= 1 && gfAshAhead()) gfAshCallTO(s);
}
const gfAshGo0 = gfGo;
gfGo = function (ph) { if (ph === 'call' && G && G.ash && GD && G.drive && !G.drive.end) gfAshCpu(); return gfAshGo0.apply(this, arguments); };

/* ---------- the reason after a play ---------- */
const gfAshWhy0 = gfWhy;
gfWhy = function () {
  const out = gfAshWhy0.apply(this, arguments); if (!G.ash || !L) return out;
  const add = [], ev = L.ev.filter(e => e.k === 'ash'), slip = ev.find(e => e.o === 'slip'), cut = ev.find(e => e.o === 'cut'), dead = ev.find(e => e.o === 'dead');
  if (slip) add.push(`${slip.s} cut on the ash and lost their footing.`); else if (cut) add.push(`${cut.s} cut on the ash and slowed.`);
  if (dead) add.push('The loose ball skidded on the ash and died there: no return.');
  if (L.shim >= .3) add.push('The heat shimmer at this end threw the deep ball off.');
  return add.length ? `${out} ${add.join(' ')}` : out;
};

/* ---------- on the field ---------- */
const gfAshField0 = gfDrawField;
gfDrawField = function (c) {
  gfAshField0.apply(this, arguments);
  const A = G && G.ash; if (!A) return;
  const top = gfScr(0, -GF_HALF).y, bot = gfScr(0, GF_HALF).y;
  c.save();
  // the heat: a warm wash over the last 30 yards at that end, and the air rippling
  const e0 = A.hot ? 110 : -10, e1 = A.hot ? 70 : 30, p0 = gfScr(e0, 0).x, p1 = gfScr(e1, 0).x;
  if (Math.max(p0, p1) > -20 && Math.min(p0, p1) < 980) {
    const g = c.createLinearGradient(p0, 0, p1, 0); g.addColorStop(0, 'rgba(255,130,50,.2)'); g.addColorStop(1, 'rgba(255,130,50,0)');
    c.fillStyle = g; c.fillRect(Math.min(p0, p1), top, Math.abs(p1 - p0), bot - top);
    const gl = c.createLinearGradient(p0, 0, p1, 0); gl.addColorStop(0, 'rgba(255,190,120,.32)'); gl.addColorStop(1, 'rgba(255,190,120,0)'); c.strokeStyle = gl; c.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) { const y0 = lerp(top + 12, bot - 12, k / 6); c.beginPath();
      for (let x = Math.min(p0, p1); x <= Math.max(p0, p1); x += 8) { const f = Math.abs(x - p1) / Math.abs(p1 - p0), y = y0 + Math.sin(x * .05 + GFT.t * 3 + k) * 3 * f; if (x === Math.min(p0, p1)) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke(); }
    txt(c, 'HEAT', gfScr(A.hot ? 102 : -2, 0).x, top + 18, '800 13px "Alegreya Sans", system-ui, sans-serif', 'rgba(255,190,120,.75)', 'center');
  }
  // the ash: settled patches grey on the grass; ash still falling over where it will settle
  A.patches.forEach((P, i) => {
    const r = gfAshRad(P), s = gfScr(P.x, P.y); if (s.x < -120 || s.x > 1080) return;
    if (r > 0) {
      c.fillStyle = 'rgba(128,122,116,.55)';
      for (let k = 0; k < 5; k++) { const a = i * 1.7 + k * 1.26, q = k ? .45 : 0; c.beginPath(); c.ellipse(s.x + Math.cos(a) * r * q * GF_PX, s.y + Math.sin(a) * r * q * GF_PY, r * (k ? .62 : .82) * GF_PX, r * (k ? .62 : .82) * GF_PY, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(70,66,62,.5)'; for (let k = 0; k < 9; k++) { const a = i * 2.3 + k * 2.4, d = ((k * 37) % 10) / 12; c.fillRect(s.x + Math.cos(a) * r * d * GF_PX, s.y + Math.sin(a) * r * d * GF_PY, 2, 1.5); }
    } else if (P.at - A.t <= GF_ASHB.lead) {
      c.strokeStyle = 'rgba(200,194,186,.35)'; c.setLineDash([4, 5]); c.lineWidth = 1; c.beginPath(); c.ellipse(s.x, s.y, GF_ASHB.r0 * GF_PX, GF_ASHB.r0 * GF_PY, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(215,210,202,.75)';
      for (let k = 0; k < 10; k++) { const f = ((GFT.t * .5 + k / 10) % 1), x = s.x + Math.sin(k * 2.1 + GFT.t) * 14, y = s.y - 70 + f * 70; c.fillRect(x, y, 2, 2); }
    }
  });
  c.restore();
};
const gfAshHud0 = gfDrawHud;
gfDrawHud = function (c) {
  gfAshHud0.apply(this, arguments);
  const A = G && G.ash; if (!A || !GD) return;
  c.save();
  if (GD.ph === 'kickoff' && A.said && G.half === 1 && G.clock >= GF_GAME.half) txt(c, A.said, 480, 75 + (G.hex ? 18 : 0), '700 13px "Alegreya Sans", system-ui, sans-serif', '#e6d6c0', 'center');
  if (L && GD.ph === 'live') { const e = L.ev.slice().reverse().find(x => x.k === 'ash' && L.t - x.t < 1); if (e) txt(c, e.o === 'dead' ? 'Dead on the ash!' : e.o === 'slip' ? 'Slipped on the ash!' : 'Cut on the ash', 480, 140, '800 18px "Alegreya Sans", system-ui, sans-serif', '#d8d0c4', 'center'); }
  c.restore();
};
