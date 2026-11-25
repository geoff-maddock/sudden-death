/* The Tilting Lists in the Umbral (issue #117, phase 11), as curling's 15-umbral.js: the Lich, the hexes, and a
   jouster's own ultimate. Nothing here runs unless a match asks for it: with no hexes, no Lich and no rider's own
   ultimate, the engine plays exactly as before (same seed, same match).
   The Lich (opts.skill 3 for a side). Its side's G.skill stays 2, an Archmage's, so every table read by skill keeps its
   three rows (the corner, the casts, the potions, the line and the wind, and the exhibition's three skills);
   G.lich[s] = 1 marks it (plain JSON, kept with the match). Its rider rides with its own row of hands (JT_LICH, through
   05-cpu.js's jtHands): a steadier tip, a truer couch and a surer lean than an Archmage's. Deciding better alone was
   worth nothing measurable on the lists (docs/realm/BALANCE.md: the course is a game near its equilibrium), so the
   hands are most of its edge, about 9 points. It also decides as no other skill does:
   - its odds are the course against the rider it meets as they are: their ratings, their mount, their mount's wind and
     their hands (jtLichOdds), where every other skill reckons with a plain Knight on a destrier;
   - its read leans on what your side has really ridden sooner (JT_LICH.prior: one course's worth of the mix your rider
     would ride, where an Archmage takes two).
   The herald's card names it a Lich, and its reasons say what it reckons with.
   Hexes (opts.hexes: ids in JT_HEX; G.hex = { ids, on }, plain JSON, so a kept match keeps them). Each works against one
   side, G.hex.on (opts.hexOn, 0 by default: yours), through the ride's effects (jtRideFx: the powers' vocabulary), so
   Play, Manage, the CPU and Simulate all ride with them. No plan knows them:
     mist     Grave Mist: that side's tip sways JT_HEX.mist.sway times as much
     nag      Hollow Mounts: that side's mounts charge JT_HEX.nag.speed as fast (a softer hit), and each course costs
              them JT_HEX.nag.wind times the wind
     cold     The Cold Saddle: that side's riders sit a hit worse (JT_HEX.cold.hold off the hold)
     shroud   Shrouded Shields: the other side drinks that side's lance (a lance on them breaks JT_HEX.shroud.turn as
              often: the other side's turn)
   The hexes are named before the first course (the status line: jtGo) and on the lists all match, top right (jtHexDraw).
   A rider's own ultimate (a roster member sent with { ult: id }, an id in JT_ULT_OWN): cast in place of their kind's
   when they ride (jtUltOf). The Hollow Lists' champion brings one; so does the champion redeemed after the Seal. */
const JT_LICH = { n: 'Lich', aim: .75, couch: .16, lean: .8, prior: 1, why: '; a Lich, it reckons with the rider it meets as they are, their mount and their wind' };
const JT_HEX = {
  mist: { n: 'Grave Mist', d: 'A mist off the graves hangs on the tilt: your tip sways a seventh more.', sway: 1.14 },
  nag: { n: 'Hollow Mounts', d: 'Your mounts are half shadow: they charge slower, and each course costs them half again the wind.', speed: .92, wind: 1.5 },
  cold: { n: 'The Cold Saddle', d: 'Frost on your saddles: your riders sit a hit worse.', hold: -.08 },
  shroud: { n: 'Shrouded Shields', d: 'Their shields drink the light, and your lance with it: a lance on them breaks a tenth less often.', turn: .9 },
};
const JT_ULT_OWN = {
  palecharge: jtU('palecharge', 'The Pale Charge', 'Death on a pale horse: your lance breaks on any fair touch, and their tip sways a quarter more, this course.', { splinter: 1 }, { sway: 1.25 }),
};
const JT_W15 = { start: jtStart, rideFx: jtRideFx, ultOf: jtUltOf, planOwn: jtPlanOwn, odds: jtOdds, card: jtCard, summary: jtSummary, view: jtView, draw: jtDraw, go: jtGo };
// while a Lich plans: its own rider's ratings (me) and the rider it meets
const JT_LV = { vs: null };

/* ---------- a match's Lich and hexes ---------- */
jtStart = function (opts) {
  const o = opts || {}, g = JT_W15.start(opts);
  if (!G || G.yard) return g;
  const lich = [0, 1].map(s => +((o.skill || [])[s]) === 3 ? 1 : 0);
  if (lich[0] || lich[1]) G.lich = lich;
  const hx = (Array.isArray(o.hexes) ? o.hexes : []).filter((k, i, a) => jtOwn(JT_HEX, k) && a.indexOf(k) === i);
  if (hx.length) G.hex = { ids: hx, on: o.hexOn === 1 ? 1 : 0 };
  return g;
};
const jtHexHas = id => !!(G && G.hex && G.hex.ids.includes(id));
const jtLichOn = s => !!(G && G.lich && G.lich[s]);
// the hexes on a side's ride (after its powers, gear and potions): null stays null when no hex touches it
jtRideFx = function (s) {
  const f0 = JT_W15.rideFx(s); if (!G || !G.hex) return f0;
  const mine = G.hex.on === s, H = JT_HEX, f = f0 || Object.assign({}, JT_FX0);
  let any = false;
  if (mine && jtHexHas('mist')) { f.sway *= H.mist.sway; any = true; }
  if (mine && jtHexHas('nag')) { f.speed *= H.nag.speed; f.wind *= H.nag.wind; any = true; }
  if (mine && jtHexHas('cold')) { f.hold += H.cold.hold; any = true; }
  if (!mine && jtHexHas('shroud')) { f.turn *= H.shroud.turn; any = true; }
  return any ? f : f0;
};
const jtHexNames = () => G && G.hex ? G.hex.ids.map(k => JT_HEX[k].n).join(', ') : '';
const jtHexLine = () => G && G.hex && G.teams ? `Hexes on ${G.teams[G.hex.on].short || G.teams[G.hex.on].name}: ${jtHexNames()}` : '';

/* ---------- a rider's own ultimate ---------- */
jtUltOf = function (s, ri) { const m = G && G.teams ? jtRiderOf(s, ri) : null; return m && typeof m.ult === 'string' && jtOwn(JT_ULT_OWN, m.ult) ? JT_ULT_OWN[m.ult] : JT_W15.ultOf(s, ri); };

/* ---------- the Lich ---------- */
/* the odds as a Lich reckons them: jtOdds's table, but against the rider it meets (V: their rs, mount, wind and hands,
   hk), not a plain Knight on a destrier; the same streams, so its cells compare as every other table's */
function jtLichOdds(rs, mount, hk, wind, X0, V) {
  const w = jtWindB(wind), vw = jtWindB(V.wind), X = jtXB(X0), key = JSON.stringify(['lich', rs, mount, hk, w, X, V.rs, V.mount, V.hk, vw]);
  let O = JT_ODDS_CACHE.get(key); if (O) return O;
  const H = Object.assign({}, JT_SKILL[hk], { lean: JT_LICH.lean }), VH = JT_SKILL[V.hk] || JT_SKILL[1], hands = { aim: H.aim, couch: H.couch }, N = JT_ODDS.n, own = r => r ? { broke: false, high: true } : { broke: true };
  O = { A: {}, B: {} };
  for (const aim of JT_AIMS) for (const pace of JT_PACES) for (const g of JT_GUARDS) for (const reach of [false, true]) {
    const a = { pts: 0, brk: 0, helm: 0, unh: 0 }, b = { pts: 0, brk: 0, helm: 0, unh: 0 };
    let rnd = engRng(JT_ODDS.seed);
    for (let i = 0; i < N; i++) {
      const x = jtCharge({ plan: { aim, guard: 'square', pace }, rs, mount, wind: w, hands, arm: X.arm, shaken: X.shaken, press: X.press }, rnd), d = { guard: g, rs: V.rs, mount: V.mount };
      const st = jtStrike(x, d, rnd), se = jtSeat(st, d, VH.lean, rnd, own(reach));
      a.pts += se.unhorse ? JT_RULES.unhorse : JT_RULES.pts[st.at] || 0; if (st.broke) a.brk++; if (st.broke && st.zone === 'helm') a.helm++; if (se.unhorse) a.unh++;
    }
    rnd = engRng(JT_ODDS.seed + 1);
    for (let i = 0; i < N; i++) {
      const y = jtCharge({ plan: { aim, guard: 'square', pace }, rs: V.rs, mount: V.mount, wind: vw, hands: { aim: VH.aim, couch: VH.couch } }, rnd), me = { guard: g, rs, mount, girth: X.girth, shaken: X.shaken };
      const st = jtStrike(y, me, rnd), se = jtSeat(st, me, H.lean, rnd, own(reach));
      b.pts += se.unhorse ? JT_RULES.unhorse : JT_RULES.pts[st.at] || 0; if (st.broke) b.brk++; if (st.broke && st.zone === 'helm') b.helm++; if (se.unhorse) b.unh++;
    }
    for (const k in a) { a[k] /= N; b[k] /= N; }
    O.A[jtCell(aim, pace, g, reach)] = a; O.B[jtCell(aim, pace, g, reach)] = b;
  }
  JT_ODDS_CACHE.set(key, O);
  return O;
}
// (only the Lich's own rider's odds, while it plans: the read of the other side's mix is the plain table, as ever)
jtOdds = function (rs, mount, hk, wind, X0) { const V = JT_LV.vs; return V && rs === V.me ? jtLichOdds(rs, mount, hk, wind, X0, V) : JT_W15.odds.apply(this, arguments); };
// a Lich's plan: the Archmage's logic, on its own odds and its quicker read (a lab's plan, logic or held plan for the
// side, or a plan asked of another skill's logic, is as ever)
jtPlanOwn = function (s, o) {
  o = o || {};
  const lab = (G && G.lab) || {}, R0 = G && G.teams ? jtRiders() : null;
  if (!jtLichOn(s) || o.sk != null || (lab.planBy && lab.planBy[s] != null) || (lab.fix && lab.fix[s]) || !R0) return JT_W15.planOwn(s, o);
  const t = 1 - s, p0 = JT_READ.prior;
  JT_LV.vs = { me: jtRsOf(s, R0[s]), rs: jtRsOf(t, R0[t]), mount: jtMountOf(t), wind: G.wind[t], hk: jtHandsK(t) };
  JT_READ.prior = JT_LICH.prior;
  try { const P = JT_W15.planOwn(s, o); if (P && typeof P.why === 'string') P.why += JT_LICH.why; return P; } finally { JT_LV.vs = null; JT_READ.prior = p0; }
};

/* ---------- the card, the summary, the view ---------- */
jtCard = function (s) {
  const K = JT_W15.card(s); if (!K) return K;
  if (jtLichOn(1 - (s ? 1 : 0))) K.skill = JT_LICH.n;
  if (G.hex) K.hex = { ids: G.hex.ids.slice(), on: G.hex.on, line: jtHexLine() };
  return K;
};
jtSummary = function () {
  const S = JT_W15.summary(); if (!S || !G) return S;
  if (G.lich) S.lich = G.lich.slice();
  if (G.hex) S.hex = JSON.parse(JSON.stringify(G.hex));
  return S;
};
jtView = function () {
  const V = JT_W15.view(); if (!V) return V;
  if (G.hex) V.hex = { ids: G.hex.ids.slice(), on: G.hex.on, line: jtHexLine() };
  if (G.lich) V.lich = G.lich.slice();
  return V;
};
// named before the first course: the status line, whatever the beat says
jtGo = function (ph, wait, msg) {
  const r = JT_W15.go.apply(this, arguments);
  if (GP && G && G.hex && G.teams && !G.over && G.n === 0 && !String(GP.msg || '').includes('Hexes on')) GP.msg = `${GP.msg ? GP.msg + ' ' : ''}${jtHexLine()}.`;
  return r;
};

/* ---------- drawing: the hexes, top right (under the ground's panel when it is up) ---------- */
function jtHexDraw(c) {
  if (!G || !G.hex || G.yard || !G.teams) return;
  const font = '700 12px "Alegreya Sans", sans-serif', w = 240, x0 = JT_VIEW.w - w - 10, y0 = jtGndOn() ? 72 : 10;
  c.save(); c.font = font;
  const lines = [], words = jtHexLine().split(' ');
  let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (c.measureText(t).width > w - 20 && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur);
  c.fillStyle = 'rgba(24,10,40,.78)'; rr(c, x0, y0, w, 8 + lines.length * 16, 8); c.fill();
  lines.forEach((l, i) => txt(c, (i ? '' : '☾ ') + l, x0 + 10, y0 + 19 + i * 16, font, '#d4b8ff'));
  c.restore();
}
jtDraw = function (c, dt) { JT_W15.draw(c, dt); jtHexDraw(c); };
