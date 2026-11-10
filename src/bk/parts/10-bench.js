/* The Charter Court: stamina and the bench (issue #77, phase 3). Every player is on the floor at both ends, so stamina
   (G.stam, by side and roster index, 0 to 100) drains every second they're on it, more when they run hard (a fast
   break, a cut, a drive) and for each move (a crossover or a spin), and more for the big bodies. The drain is scaled to
   the game's length, so a starter who plays it all ends it tired whatever the length. On the bench, and at stoppages,
   it comes back, at the length's pace too; a quarter break gives some back to everyone, halftime more.
   A tired player (below BK_STAM.tired) is slower, shoots worse, contests less and handles worse, more so the lower they
   go (bkTired: 0 fresh to 1 spent).
   The bench: at each dead ball and break, each side's coach takes off a player below BK_STAM.sub for a fresh one
   (BK_STAM.fresh or more) from the bench: your side in your bench order (the roster after the five: the Court tab sets
   it; G.ordered[side], or the side you play by hand), the CPU's by who suits the spot best. A starter rested back to BK_STAM.back comes back in at a break for whoever
   took their spot. A sub goes in the box score's minutes and the line under the court. bkSub(side, out, inn) is a swap
   by hand (at a dead ball or a break; phase 4's Manage uses it). */
const BK_STAM = { drain: .3, run: .2, runAt: 5.5, move: 4, big: .04, rest: 2.2, stop: .35, quarter: 6, half: 10, tired: 55, sub: 42, fresh: 72, back: 80 };
const bkSta = p => G.stam ? G.stam[p.side][p.ri] : 100;
const bkTired = p => clamp((BK_STAM.tired - bkSta(p)) / BK_STAM.tired, 0, 1);
function bkStamStart() { G.stam = G.teams.map(t => t.roster.map(() => 100)); G.subs = [0, 0]; G.starters = G.on.map(a => a.slice()); }
// the pace of play: drain and rest per second scale with the length, so a game takes the same out of a player whatever it
// is (the three breaks between periods are the same in any game, so what they give back doesn't scale)
const bkStamK = () => BK_RULES.mins / G.mins;
// dt seconds of play: the five drain, the bench rests
function bkStamStep(dt, walk) {
  if (!G.stam) return;
  const k = bkStamK();
  for (const s of [0, 1]) for (const ri of bkBench(s)) G.stam[s][ri] = Math.min(100, G.stam[s][ri] + BK_STAM.rest * dt * k);
  for (const p of L.pl) {
    const fast = !walk && hyp(p.vx, p.vy) > BK_STAM.runAt, st = G.stam[p.side], call = !G.cur ? 1 : p.side === G.cur.side ? bkPace(p.side).tire : bkDefNow().tire || 1;
    st[p.ri] = Math.max(0, st[p.ri] - (BK_STAM.drain + (fast ? BK_STAM.run : 0)) * dt * k * (1 + (p.r.siz - 5) * BK_STAM.big) * call);
  }
}
// a stoppage of dt seconds: everyone gets a little back (the bench at its usual rate)
function bkStamStop(dt) { if (!G.stam) return; const k = bkStamK(); for (const s of [0, 1]) G.stam[s].forEach((v, ri) => { G.stam[s][ri] = Math.min(100, v + (G.on[s].includes(ri) ? BK_STAM.stop : BK_STAM.rest) * dt * k); }); }
function bkStamBreak(half) { if (!G.stam) return; for (const s of [0, 1]) G.stam[s] = G.stam[s].map(v => Math.min(100, v + (half ? BK_STAM.half : BK_STAM.quarter))); }
function bkStamCost(p, n) { if (G.stam) G.stam[p.side][p.ri] = Math.max(0, G.stam[p.side][p.ri] - n); }
// does side's coach follow its bench order (yours, from the Court tab: G.ordered, or the side you play by hand)
const bkOrdered = side => !!(G.ordered && G.ordered[side]) || (GD.mode !== 'watch' && side === GD.you);
/* the coach's subs for side at a stoppage (brk: a break between periods, when rested starters come back) */
function bkCoachSubs(side, brk) {
  if (!G.stam) return;
  const T = G.teams[side], mine = bkOrdered(side);
  BK_POS.forEach((pos, k) => {
    const out = G.on[side][k], bench = bkBench(side);
    if (!bench.length) return;
    // a rested starter back in at a break
    const st0 = G.starters[side][k];
    if (brk && out !== st0 && bench.includes(st0) && G.stam[side][st0] >= BK_STAM.back) return bkSubDo(side, out, st0, 'back');
    if (G.stam[side][out] >= BK_STAM.sub) return;
    const fresh = bench.filter(i => G.stam[side][i] >= BK_STAM.fresh);
    if (!fresh.length) return;
    const inn = mine ? fresh[0] : fresh.sort((a, b) => bkFit(T.roster[b].r, pos) - bkFit(T.roster[a].r, pos))[0];
    bkSubDo(side, out, inn, 'tired');
  });
}
// out comes off, inn goes on in their spot (the play's player takes inn's name, kind and ratings)
function bkSubDo(side, out, inn, why) {
  const k = G.on[side].indexOf(out), T = G.teams[side], m = T.roster[inn], p = L.pl.find(q => q.side === side && q.ri === out);
  if (k < 0 || !m) return false;
  G.on[side][k] = inn; G.subs[side]++; if (G.ver != null) G.ver++;
  if (G.cur && G.cur.side === side && G.cur.star === out) G.cur.star = bkStar(side);
  // (a power you queued from the player coming off goes with them)
  if (GD.pow && GD.mode !== 'watch' && side === GD.you) for (const r of ['off', 'def']) if (GD.pow[r] && GD.pow[r].ri === out) GD.pow[r] = null;
  GD.notes = (GD.notes || []).concat(`${m.n} on for ${T.roster[out].n}${why === 'tired' ? ', who needs a breather' : why === 'back' ? ', rested' : ''}.`);
  if (p) Object.assign(p, { ri: inn, kind: m.kind, n: m.n, num: m.num, r: Object.assign({}, m.r) });
  return true;
}
// a swap by hand: at a dead ball or a break, out (on the floor) for inn (on the bench, not fouled out); '' when it
// worked, or why not
function bkSub(side, out, inn) {
  if (!GD || !['dead', 'break', 'intro', 'timeout'].includes(GD.ph)) return 'Only at a stoppage.';
  if (!G.on[side].includes(out)) return 'They aren\'t on the floor.';
  if (!bkBench(side).includes(inn)) return 'They can\'t come on.';
  bkSubDo(side, out, inn, 'hand');
  // (yours by hand: they're the one who starts that spot now, so the coach doesn't undo it at the next break)
  G.starters[side][G.on[side].indexOf(inn)] = inn;
  return '';
}
