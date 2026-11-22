/* Cinder Gridiron in the Umbral (issue #99, phase 4b): the Lich, and the hexes. Nothing here runs unless a game asks
   for it: with no hexes and no skill 3, the engine plays exactly as before (same seed, same game).
   The Lich (G.skill 3, above the Archmage). The other coaches read what you keep calling; the Lich reads the whole
   down: what a coach would call here by the down and the distance, countered against the Lich's own habits as the other
   side has seen them, blended with what the other side has really called lately (GF_LICH.see). It then leans to the
   call with the best matchup against that (GF_LICH.edge, from GF_EDGE), stays mixed so it can't be read, and rests a
   tired call harder (GF_LICH.fresh). On defense its powers expect what it expects (gfLichExpectKind), and it casts
   more readily (GF_LICH.cast). On fourth down it goes for it more than the others (gfLichFourth): short yardage past
   its own 35, and anything makeable when behind late. It swaps a player under 60 (15-bench.js) and takes a potion
   worth 3 (17-kit.js); its stances are the Archmage's.
   Hexes (opts.hexes: ids in GF_HEX; G.hex = { ids, on, short }, plain JSON, so a saved game keeps them). Each works
   against one side, G.hex.on (opts.hexOn, 0 by default: yours), and so for the other:
     shrink    The Pit Closes: each quarter after the first the end zone at that side's end creeps GF_HEX.shrink.yd
               out, from the next drive on (G.hex.short; gfGoal() is where the offense scores)
     rolldark  Fumbles Roll Dark: that side's carriers fumble GF_HEX.rolldark.x as often, and the other side falls on
               almost every loose ball (rec when it is on defense, own when it has the ball)
     chill     Grave Cold: every play costs that side's seven GF_HEX.chill.k times the stamina
     ashwind   Ash Wind: that side's field goals play GF_HEX.ashwind.yd yards longer and its punts go as much shorter
   The hexes are named over the opening kickoff and under the score bar all game, and the shrunk end zone is shaded on
   the grass. */
const GF_LICH = { see: .5, edge: 4, fresh: 1.5, cast: [.35, .95] };
const GF_HEX = {
  shrink: { n: 'The Pit Closes', d: 'Each quarter after the first, the end zone at your end creeps 5 yards out (from the next drive on): the other side needs that much less to score.', yd: 5 },
  rolldark: { n: 'Fumbles Roll Dark', d: 'Loose balls roll to the dark side: your carriers fumble twice as often, and the other side falls on nearly every fumble, yours or theirs.', x: 2, rec: .92, own: .15 },
  chill: { n: 'Grave Cold', d: 'The cold gets into your seven: every play costs them 40% more stamina.', k: 1.4 },
  ashwind: { n: 'Ash Wind', d: 'A wind off the pit in your face: your field goals play 6 yards longer, and your punts go 6 yards shorter.', yd: 6 },
};

/* ---------- the Lich ---------- */
// a weights table as shares, and blended with what a side has really called (T, shares too; empty: the model alone)
function gfLichShares(w) { const s = Object.values(w).reduce((a, v) => a + Math.max(0, v), 0) || 1, o = {}; for (const k in w) o[k] = Math.max(0, w[k]) / s; return o; }
function gfLichBlend(model, T) {
  const P = gfLichShares(model); if (!Object.keys(T).length) return P;
  for (const k in P) P[k] = (1 - GF_LICH.see) * P[k] + GF_LICH.see * (T[k] || 0);
  return P;
}
// what the Lich expects the other side to call: their defense when it has the ball, their play when it hasn't
const gfLichDefP = () => gfLichBlend(gfCounterDefense(gfDefLean()), G.fog === 1 - G.poss ? {} : gfTendency(1 - G.poss, 'def'));
const gfLichOffP = () => gfLichBlend(gfCounterOffense(gfOffLean()), G.fog === G.poss ? {} : gfTendency(G.poss, 'off'));
// a call's weight: the coach's lean, times how its matchups go against what is expected (e: -1 to 1), times how fresh
const gfLichW = (lean, e, f) => Math.max(.1, lean * (1 + GF_LICH.edge * e)) * Math.pow(.1 + .9 * f, GF_LICH.fresh);
function gfLichOffense() {
  const w = gfOffLean(), P = gfLichDefP();
  for (const oc in w) { let e = 0; for (const dc in P) e += P[dc] * gfEdge(oc, dc)[0]; w[oc] = gfLichW(w[oc], e, gfFresh(G.poss, 'off', oc)); }
  return wpick(w);
}
function gfLichDefense() {
  const w = gfDefLean(), P = gfLichOffP();
  for (const dc in w) { let e = 0; for (const oc in P) e -= P[oc] * gfEdge(oc, dc)[0]; w[dc] = gfLichW(w[dc], e, gfFresh(1 - G.poss, 'def', dc)); }
  return wpick(w);
}
// on defense: a run, a pass, or either, by what it expects
function gfLichExpectKind() { const P = gfLichOffP(), run = P.run || 0; return run >= .5 ? 'run' : run <= .25 ? 'pass' : 'any'; }
function gfLichFourth() {
  const s = G.poss, m = G.score[s] - G.score[1 - s], late = !!GD.game && (G.half === 3 || (G.half === 2 && G.clock < 150));
  const inRange = gfKickDist() <= GF_FG_MAX + gfTee(s), ch = gfKickChance();
  // behind late by more than a field goal: a kick doesn't do it
  if (late && m < -3) return G.togo <= 8 || G.ball >= 50 ? 'go' : 'punt';
  if (G.togo <= 1 && G.ball >= 70) return 'go';
  if (inRange && ch >= .5) return 'fg';
  if (G.togo <= 2 && G.ball >= 35) return 'go';
  if (G.togo <= 4 && G.ball >= 60) return 'go';
  return 'punt';
}

/* ---------- the hexes ---------- */
function gfHexStart(ids, on) { const hx = (ids || []).filter((k, i, a) => GF_HEX[k] && a.indexOf(k) === i); if (hx.length) G.hex = { ids: hx, on: on === 1 ? 1 : 0, short: 0 }; }
const gfHexHas = id => !!(G && G.hex && G.hex.ids.includes(id));
const gfHexOn = (id, side) => gfHexHas(id) && side === G.hex.on;
// the quarter: each half is two (Sudden Death counts as the fourth); a single drive is the first
function gfQuarter() { if (!GD || !GD.game || !G.half) return 1; if (G.half >= 3) return 4; return (G.half - 1) * 2 + (G.clock > GF_GAME.half / 2 ? 1 : 2); }
// where side scores (yards from its own goal line), and where the side with the ball does
function gfGoalOf(side) { return GF_RULES.field - (G && G.hex && side !== G.hex.on ? G.hex.short || 0 : 0); }
function gfGoal() { return gfGoalOf(G.poss); }
// a new drive: The Pit Closes moves the end zone for the quarter, and the chains go to the new goal line
function gfHexDrive() { if (gfHexHas('shrink')) { G.hex.short = GF_HEX.shrink.yd * (gfQuarter() - 1); if (G.down === 1) gfFirstDown(); } }
const gfHexWind = (side, k) => gfHexOn('ashwind', side) ? GF_HEX.ashwind.yd : 0;
const gfHexCold = side => gfHexOn('chill', side) ? GF_HEX.chill.k : 1;
const gfHexFum = side => gfHexOn('rolldark', side) ? GF_HEX.rolldark.x : 1;
// who falls on a loose ball: pd is the defense's chance
function gfHexRecover(pd) { if (!gfHexHas('rolldark')) return pd; return G.poss === G.hex.on ? Math.max(pd, GF_HEX.rolldark.rec) : Math.min(pd, GF_HEX.rolldark.own); }
const gfHexNames = () => G && G.hex ? G.hex.ids.map(k => GF_HEX[k].n).join(', ') : '';
const gfHexLine = () => !G || !G.hex ? '' : 'Hexes: ' + G.hex.ids.map(k => k === 'shrink' && G.hex.short ? `${GF_HEX[k].n} (${G.hex.short} yd)` : GF_HEX[k].n).join('  ·  ');
// the shrunk end zone on the grass: the yards it has swallowed, shaded, and its new line
function gfHexDrawField(c, top, bot) {
  const s = G.hex.short; if (!s || !gfHexHas('shrink')) return;
  const [a0, a1] = G.hex.on === 0 ? [0, s] : [GF_RULES.field - s, GF_RULES.field], p0 = gfScr(a0, 0), p1 = gfScr(a1, 0), edge = G.hex.on === 0 ? p1.x : p0.x;
  if (p1.x < -20 || p0.x > 980) return;
  c.save(); c.fillStyle = 'rgba(40,12,58,.55)'; c.fillRect(p0.x, top, p1.x - p0.x, bot - top);
  c.strokeStyle = '#c8b8ff'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(edge, top); c.lineTo(edge, bot); c.stroke(); c.restore();
}

/* ---------- the Nadir captain's ultimate (a player brings it as { ult: 'eclipse' }, 04-teams.js) ---------- */
GF_ULT_BY.eclipse = { id: 'eclipse', n: 'Eclipse', role: 'def', desc: 'The sun goes out over the field: their offense 12% slower, and their throws far wilder, while it lasts.', zone: { oSpd: .88, errM: 1.3 }, vis: ['#6a4a8a', 'all'] };
