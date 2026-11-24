/* The Anvil Ring: the ground's own ways (issue #115, phase 4). Only in bouts at the Anvil Ring: a bout started with
   opts.anvil (the Realm sends it, a card passes it to every bout). With it unset every hook passes straight through and
   nothing draws from the seeded stream, so a bout plays exactly as before; the bare engine, its tests and the labs box
   without it unless asked.
   Its draws come from a seeded stream of its own (bxAnvilRand: the bout's seed, or Math.random for an unseeded bout,
   its state kept in G.anvil.rs), so a seeded bout plays the same every time, and turning the ways on doesn't move the
   punch-by-punch stream (R) until the forge or the ropes actually change something.
   - The forge corner. One of the two neutral corners (BX_POSTS 1, back right, or 2, front left: never a fighter's own,
     where they sit between rounds) still sits over the old forge, and glows. Drawn at the start of each bout
     (bxAnvilRand). Its heat (bxForgeHeat, 0 to 1) is full within BX_ANVIL.forge.r0 feet of the corner and fades out by
     BX_ANVIL.forge.r (fighters seldom stand right in a corner: the heat reaches out to where they do work). A fighter in
     it gets their breath back slower (regK, down to BX_ANVIL.forge.regK: through bxFx, which 05-ring.js's regen reads)
     and loses up to BX_ANVIL.forge.drain stamina a second on top (bxAdvance), so pushing the other fighter in there pays
     and getting caught there costs.
   - The slack ropes. One side's ropes (BX_SLACK: far, near, left, right; "on them" is within BX_ANVIL.slack.band feet
     of them) work loose through each round: the slack
     starts at BX_ANVIL.slack.s0 at the bell and is all the way out by BX_ANVIL.slack.full of the round (bxSlackNow).
     A fighter on them doesn't bounce off: their feet are slower off the ropes (move, through bxFx) and punches find
     them more often (bxAnvilPin, read where 05-ring.js's bxLand counts the ropes). Ma Gristle tightens them at the
     bell, and another side goes slack next round (bxAnvilRand, in bxCorner). The ropes sag where they are drawn, more
     as the round goes on.
   - The CPU reads them by its skill (BX_ANVIL.read, in bxFeet): a Squire only just steps out of them and never walks
     anyone in; a Knight, an Archmage and the Lich, more each, step out of the forge corner and off the slack ropes, and
     circle so the other fighter's back is to the forge or the slack side, to walk them into it.
   - Ma Gristle has a line for it: before the first bell (in the log and on the tale of the tape), and at each bell.
   G.anvil = { rs (the stream's state, a number), forge: 1 | 2, slack: 0..3, heat: [secs, secs] (in the forge corner's
   heat, counted at its strength: a second at half heat is half a second), rope: [secs, secs] (on the slack ropes),
   said }, plain JSON, so a bout kept between rounds keeps them. A bout's summary carries anvil. */
const BX_ANVIL = {
  forge: { r0: 3, r: 8, regK: .6, drain: 2, corners: [1, 2] },
  slack: { s0: .15, full: .7, move: .8, pin: .05, band: 1.5 },
  // (by CPU skill: Squire, Knight, Archmage, the Lich) how hard it steps out of them, and how hard it circles to walk the other fighter in
  read: { out: [.15, .3, .6, .8], herd: [0, 1.2, 2, 2.5], herdNear: 12 },
};
// each corner's side of the ring (x, y signs) and its name (the forge is only ever 1, back right, or 2, front left: forge.corners)
const BX_FORGE_AT = { 0: [-1, -1], 1: [1, -1], 2: [-1, 1], 3: [1, 1] };
const BX_FORGE_N = { 0: 'the red corner', 1: 'the back-right corner', 2: 'the front-left corner', 3: 'the blue corner' };
// the four sides of ropes: which way they lie (ax, sg) and their names (the ring is seen from the side)
const BX_SLACK = [{ ax: 'y', sg: -1, n: 'the far ropes' }, { ax: 'y', sg: 1, n: 'the near ropes' }, { ax: 'x', sg: -1, n: 'the left-hand ropes' }, { ax: 'x', sg: 1, n: 'the right-hand ropes' }];
const bxCap = s => s.charAt(0).toUpperCase() + s.slice(1);

// the ground's own draws (a mulberry32 step on G.anvil.rs: plain JSON, so a bout kept between rounds draws on the same)
function bxAnvilRand() {
  const A = G.anvil; let t = (A.rs = (A.rs + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function bxAnvilBegin(o) {
  if (!o || !o.anvil) return;
  G.anvil = { rs: o.seed != null ? (Math.imul((o.seed | 0) ^ 0x5bd1e995, 2654435761) + 0x2545) | 0 : (Math.random() * 4294967296) | 0, heat: [0, 0], rope: [0, 0] };
  const C = BX_ANVIL.forge.corners, forge = C[Math.floor(bxAnvilRand() * C.length)], slack = Math.floor(bxAnvilRand() * 4);
  Object.assign(G.anvil, { forge, slack, said: `The old forge is still hot under ${BX_FORGE_N[forge]}: stay out of it. And ${BX_SLACK[slack].n} will work loose this round. I tighten them at the bell.` });
  bxLog(`Ma Gristle: "${G.anvil.said}"`, true);
}
// the forge corner's point, where the ropes are now (the Shrinking Ring moves them in)
function bxForgeXY() { const s = BX_FORGE_AT[G.anvil.forge], rp = bxRope(); return [s[0] * rp, s[1] * rp]; }
// the forge's heat where f stands: 1 near the corner, fading to 0 by BX_ANVIL.forge.r
function bxForgeHeat(f) { if (!G || !G.anvil) return 0; const [cx, cy] = bxForgeXY(), F = BX_ANVIL.forge; return clamp((F.r - hyp(f.x - cx, f.y - cy)) / (F.r - F.r0), 0, 1); }
const bxInForge = f => bxForgeHeat(f) > 0;
// how slack the loose side is now, 0 to 1 (tight between rounds: Ma Gristle has just been round them)
function bxSlackNow() {
  if (!G || !G.anvil || !BD || !['round', 'kd', 'rise'].includes(BD.ph)) return 0;
  const S = BX_ANVIL.slack, t = (BX_RULES.secs - G.clock) / (BX_RULES.secs * S.full);
  return clamp(S.s0 + (1 - S.s0) * t, 0, 1);
}
const bxOnSlack = f => { if (!G || !G.anvil) return false; const S = BX_SLACK[G.anvil.slack]; return S.sg * f[S.ax] > bxRope() - BX_ANVIL.slack.band; };
// punches at a fighter on the slack ropes: this much more often (05-ring.js's bxLand; 0 without the Anvil Ring's ways)
function bxAnvilPin(b) { return G && G.anvil && bxOnSlack(b) ? BX_ANVIL.slack.pin * bxSlackNow() : 0; }

const bxAnvilStart0 = bxStart;
bxStart = function (opts) { const g = bxAnvilStart0.apply(this, arguments); bxAnvilBegin(opts); return g; };
// the forge's breath and the slack ropes' feet, with the statuses
const bxAnvilFx0 = bxFx;
bxFx = function (f) {
  const o = bxAnvilFx0(f);
  if (!G || !G.anvil) return o;
  const hot = bxForgeHeat(f), slack = bxOnSlack(f) ? bxSlackNow() : 0;
  if (!hot && !slack) return o;
  return Object.assign({}, o, { regK: o.regK * lerp(1, BX_ANVIL.forge.regK, hot), move: o.move * lerp(1, BX_ANVIL.slack.move, slack) });
};
// the forge's heat takes stamina on top; the time each fighter spends in the forge and on the slack ropes is kept
const bxAnvilAdvance0 = bxAdvance;
bxAdvance = function (f, o, dt) {
  const r = bxAnvilAdvance0.apply(this, arguments), A = G.anvil;
  if (!A || f.a.k === 'down') return r;
  const h = bxForgeHeat(f); if (h > 0) { f.sta = Math.max(0, f.sta - BX_ANVIL.forge.drain * h * dt); A.heat[f.side] += h * dt; }
  if (bxOnSlack(f)) A.rope[f.side] += dt;
  return r;
};
// the bell (with the round moved on): Ma Gristle tightens the ropes, and another side will go slack
const bxAnvilCorner0 = bxCorner;
bxCorner = function () {
  const A = G.anvil;
  if (A) { const was = A.slack; A.slack = (was + 1 + Math.floor(bxAnvilRand() * 3)) % 4; bxLog(`Ma Gristle tightens ${BX_SLACK[was].n} at the bell. ${bxCap(BX_SLACK[A.slack].n)} will work loose in round ${G.round}.`); }
  return bxAnvilCorner0.apply(this, arguments);
};
/* the CPU's footwork by its skill: out of the forge corner and off the slack ropes, and round the other fighter so
   their back is to the forge (or the slack side, once it is loose enough to matter), to walk them in. Draws nothing
   from the seeded stream. */
const bxAnvilFeet0 = bxFeet;
bxFeet = function (f, o) {
  const r = bxAnvilFeet0.apply(this, arguments), A = G.anvil;
  if (!A) return r;
  const sk = clamp(bxSkill(f) | 0, 0, 3), out = BX_ANVIL.read.out[sk], herd = BX_ANVIL.read.herd[sk];
  if (!out && !herd) return r;
  let [mx, my] = f.mv;
  const [cx, cy] = bxForgeXY(), rp = bxRope(), S = BX_SLACK[A.slack], s = bxSlackNow(), h = bxForgeHeat(f);
  // out of the forge's heat, harder the hotter it is
  const df = hyp(f.x - cx, f.y - cy);
  if (out && h > 0) { const k = out * Math.min(1, .3 + h), ux = df > .01 ? (f.x - cx) / df : -Math.sign(cx), uy = df > .01 ? (f.y - cy) / df : -Math.sign(cy); mx += ux * k; my += uy * k; }
  // off the slack ropes
  if (out && s > .25 && S.sg * f[S.ax] > rp - 1.2) { if (S.ax === 'x') mx -= S.sg * out * s; else my -= S.sg * out * s; }
  // round the other fighter: their back to the forge, or to the slack side
  if (herd) {
    const dF = hyp(o.x - cx, o.y - cy), dS = rp - S.sg * o[S.ax], toS = s > .4 && dS < dF;
    const P = toS ? (S.ax === 'x' ? [S.sg * rp, o.y] : [o.x, S.sg * rp]) : [cx, cy], dp = toS ? dS : dF;
    if (dp < BX_ANVIL.read.herdNear) {
      // (the spot behind them, the same distance off; only the step round them, so the plan still keeps its range)
      const ox = o.x - P[0], oy = o.y - P[1], ol = hyp(ox, oy) || 1, d = bxDist(f, o) || 1, ux = (o.x - f.x) / d, uy = (o.y - f.y) / d;
      let vx = o.x + ox / ol * d - f.x, vy = o.y + oy / ol * d - f.y; const dot = vx * ux + vy * uy; vx -= dot * ux; vy -= dot * uy;
      const vl = hyp(vx, vy);
      // (harder the nearer they already are: pin them there)
      if (vl > .05) { const k = herd * (1 - dp / BX_ANVIL.read.herdNear) * Math.min(1, vl / 2) / vl; mx += vx * k; my += vy * k; }
    }
  }
  f.mv = [mx, my];
  return r;
};
// (the lab and the Realm read the forge and the ropes from the summary)
const bxAnvilSummary0 = bxSummary;
bxSummary = function () {
  const s = bxAnvilSummary0.apply(this, arguments), A = G.anvil;
  if (A) s.anvil = { forge: A.forge, heat: A.heat.map(t => Math.round(t * 10) / 10), rope: A.rope.map(t => Math.round(t * 10) / 10) };
  return s;
};

/* ---------- drawn ---------- */
// the slack side's ropes sag where they are drawn, more as the round goes on, and sway a little
const bxAnvilRopeLine0 = bxRopeLine;
bxRopeLine = function (c, a, b, h) {
  const A = G && G.anvil; if (!A) return bxAnvilRopeLine0.apply(this, arguments);
  const S = BX_SLACK[A.slack], i = S.ax === 'x' ? 0 : 1, s = bxSlackNow();
  if (s <= 0 || a[i] !== b[i] || Math.sign(a[i]) !== S.sg) return bxAnvilRopeLine0.apply(this, arguments);
  const sag = s * (6 + h * .3) + Math.sin(BXT.t * 2.2 + h) * s * 1.5, p = bxProj(a[0], a[1], h), q = bxProj(b[0], b[1], h), m = bxProj((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, h - 2 * sag);
  c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(m.x, m.y, q.x, q.y); c.stroke();
};
// the forge corner glows on the canvas (under the fighters), with embers; the slack side and the forge are named on the ring
const bxAnvilRing0 = bxDrawRing;
bxDrawRing = function (c, part) {
  bxAnvilRing0.apply(this, arguments);
  const A = G && G.anvil; if (!A) return;
  const H0 = BX_RING.half, H = H0 - (BX_RING.rope - bxRope()), [cx, cy] = bxForgeXY(), sg = BX_FORGE_AT[A.forge], F = (w, n) => `${w} ${n}px "Alegreya Sans", sans-serif`;
  if (part === 'back') {
    const p = bxProj(cx, cy), rx = BX_ANVIL.forge.r * BX_PX * p.k, ry = BX_ANVIL.forge.r * BX_PY, pulse = .75 + .25 * Math.sin(BXT.t * 2.3), f0 = BX_ANVIL.forge.r0 / BX_ANVIL.forge.r;
    c.save();
    const q = [bxProj(-H0, -H0), bxProj(H0, -H0), bxProj(H0, H0), bxProj(-H0, H0)];
    c.beginPath(); q.forEach((v, i) => i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)); c.closePath(); c.clip();
    c.globalCompositeOperation = 'lighter';
    c.translate(p.x, p.y); c.scale(1, ry / rx);
    // (full heat out to r0, fading to nothing at r: as the heat does)
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(255,130,50,${.55 * pulse})`); g.addColorStop(f0, `rgba(230,70,25,${.38 * pulse})`); g.addColorStop(1, 'rgba(160,30,10,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill();
    c.restore();
    // embers rising off it (from the drawing clock: drawing never draws from the seeded stream)
    c.save();
    for (let i = 0; i < 9; i++) {
      const u = (BXT.t * (.35 + (i % 3) * .12) + i * .37) % 1, ex = cx - sg[0] * ((i * 1.37) % 2.4), ey = cy - sg[1] * ((i * .91) % 2.2), e = bxProj(ex, ey, u * 70);
      c.globalAlpha = (1 - u) * .8; c.fillStyle = i % 2 ? '#ffb050' : '#ff7030'; c.fillRect(e.x - 1.2, e.y - 1.2, 2.4, 2.4);
    }
    c.restore();
  } else {
    // the names, small, over the ropes: the forge at its post, and the slack side at the middle of its top rope
    const fp = bxProj(sg[0] * H, sg[1] * H, 96);
    c.save(); c.globalAlpha = .82;
    txt(c, 'the forge', fp.x, fp.y, F(800, 11), '#ffa060', 'center');
    const S = BX_SLACK[A.slack], m = S.ax === 'x' ? bxProj(S.sg * H, 0, 92) : bxProj(0, S.sg * H, S.sg > 0 ? 18 : 92), s = bxSlackNow();
    txt(c, s > 0 ? 'slack ropes' : 'slack next', m.x, S.ax === 'y' && S.sg > 0 ? m.y + 34 : m.y, F(700, 11), s > 0 ? '#f0d090' : 'rgba(240,208,144,.6)', 'center');
    c.restore();
  }
};
// Ma Gristle's line on the tale of the tape, and at each break (under the panels)
function bxAnvilSay(c, y, msg) {
  c.save(); c.font = '700 12px "Alegreya Sans", sans-serif'; const w = Math.min(900, c.measureText(msg).width + 28); c.restore();
  c.save(); c.globalAlpha = .9; bxPanel(c, 480 - w / 2, y - 14, w, 22); c.restore();
  txt(c, msg, 480, y + 2, '700 12px "Alegreya Sans", sans-serif', '#ffb070', 'center');
}
const bxAnvilIntro0 = bxDrawIntro;
bxDrawIntro = function (c) { bxAnvilIntro0.apply(this, arguments); if (G.anvil) bxAnvilSay(c, 444, `Ma Gristle: the forge glows under ${BX_FORGE_N[G.anvil.forge]}, and ${BX_SLACK[G.anvil.slack].n} will work loose.`); };
const bxAnvilCornerDraw0 = bxDrawCorner;
bxDrawCorner = function (c) { bxAnvilCornerDraw0.apply(this, arguments); if (G.anvil) bxAnvilSay(c, 400, `Ma Gristle has tightened the ropes. Round ${G.round}: ${BX_SLACK[G.anvil.slack].n} will work loose; the forge glows under ${BX_FORGE_N[G.anvil.forge]}.`); };
