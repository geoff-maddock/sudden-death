/* The Charter Court: the ground itself (issue #77, phase 5). Only in games at the Charter Court (opts.court: G.court):
   - The waxed boards ("waxed for a final that never happened"): BK_WAX.n slick patches each game, placed at the tip.
     A player crossing one turns slower (cuts slide), and one driving with the ball across one may slip: a stumble.
   - The bent rim: a big dunk (an alley-oop, or a dunker of size and hops BK_RIM.power or more) bends that hoop. Shots
     on it rattle: a few points less likely, and its misses come off longer and wilder, until a timeout, when Nim
     re-hangs it ("I re-hang the hoops after every dunk").
   - The walled yard: the stands are close, so a run (BK_ROAR.run points unanswered) or a big play (a dunk or a block)
     brings a roar for that side (never over one already going): for BK_ROAR.secs seconds of play, a little more on every shot (phase 6 turns
     the roar into spirit).
   G.court: { wax: [{ x, y, r }], bent: [false, false] (by hoop: 0 the left, 1 the right), roar: { side, t } | null } */
const BK_WAX = { n: 2, r: [1.3, 2], turn: .35, slip: .4 };
const BK_RIM = { power: 15, p: .05, wild: 1.6 };
const BK_ROAR = { run: 6, secs: 8, p: .02 };
function bkCourtStart(on) {
  if (!on) { G.court = null; return; }
  const wax = []; for (let i = 0; i < BK_WAX.n; i++) wax.push({ x: 4 + R() * (BK_RULES.len - 8), y: (R() - .5) * (BK_RULES.wid - 4), r: lerp(BK_WAX.r[0], BK_WAX.r[1], R()) });
  G.court = { wax, bent: [false, false], roar: null };
}
const bkOnWax = p => !!G.court && G.court.wax.some(w => hyp(p.x - w.x, p.y - w.y) < w.r);
// the hoop side attacks: 0 the left one, 1 the right one
const bkHoopOf = side => bkHoopX(side) > BK_RULES.len / 2 ? 1 : 0;
const bkBent = side => !!G.court && G.court.bent[bkHoopOf(side)];
// a slip on the wax: the ball handler driving across it, now and then (per second)
function bkWaxStep(dt) {
  if (!G.court) return;
  const h = bkHand(); if (h < 0) return;
  const p = L.pl[h];
  if (hyp(p.vx, p.vy) > 4 && p.stun <= 0 && bkOnWax(p) && R() < BK_WAX.slip * dt) { p.stun = .5; bkEv('slip', p.n); GD.msg = `${p.n} slips on the waxed boards.`; }
}
// after a basket: a big dunk bends the rim; a run or a big play brings a roar
function bkCourtShot(S, p) {
  if (!G.court) return;
  if (S.made && S.dunk && (S.alley || p.r.siz + p.r.hop >= BK_RIM.power)) {
    const h = bkHoopOf(S.side); if (!G.court.bent[h]) { G.court.bent[h] = true; GD.msg += ' The rim is bent!'; bkEv('bent', p.n); }
  }
  // (a roar: a dunk, a block, or a run; never over one already going)
  if (G.court.roar) return;
  const big = (S.made && S.dunk) || S.block, side = S.block ? 1 - S.side : S.side;
  // (a run roars once: G.run.roared, until the other side scores and starts a run of its own)
  if (big) bkRoar(side);
  else if (G.run.side >= 0 && G.run.pts >= BK_ROAR.run && !G.run.roared) { G.run.roared = true; bkRoar(G.run.side); }
}
function bkRoar(side) { if (!G.court) return; G.court.roar = { side, t: BK_ROAR.secs }; bkEv('roar', G.teams[side].name); }
function bkCourtStep(dt) { if (G.court && G.court.roar && (G.court.roar.t -= dt) <= 0) G.court.roar = null; bkWaxStep(dt); }
// what the ground does to a shot: the bent rim, and the roar behind the shooter
function bkCourtMod(p) {
  if (!G.court) return 0;
  return (bkBent(p.side) ? -BK_RIM.p : 0) + (G.court.roar && G.court.roar.side === p.side ? BK_ROAR.p : 0);
}
// a timeout: Nim re-hangs any bent rim
function bkRehang() { if (G.court && G.court.bent.some(Boolean)) { G.court.bent = [false, false]; return true; } return false; }
