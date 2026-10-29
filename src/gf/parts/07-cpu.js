/* Cinder Gridiron: the coaches (issue #9, phase 1). Each side's call is a weighted pick from the down and distance,
   and an offense is less likely to call the same play twice running. On fourth down the coach kicks a field goal in
   range, goes for it when it is short, and punts otherwise. */
function gfCpuOffense() {
  const d = G.down, tg = G.togo, pl = G.drive.plays, last = pl.length ? pl[pl.length - 1].oc : null;
  const w = { run: 3 + (tg <= 3 ? 3 : 0) - (tg >= 9 && d >= 2 ? 1.5 : 0), short: 3 + (tg >= 4 && tg <= 8 ? 1.5 : 0),
    deep: 1.2 + (tg >= 9 ? 2 : 0) + (d === 3 && tg >= 7 ? 1.5 : 0), screen: 1.3 + (tg >= 6 ? .8 : 0) };
  if (last) w[last] *= .6;
  return wpick(w);
}
function gfCpuDefense() {
  const d = G.down, tg = G.togo;
  return wpick({ blitz: 1.2 + (d === 3 && tg >= 6 ? 1.5 : 0) + (tg <= 2 ? 1 : 0), zone: 1.6 + (tg >= 10 ? 1.5 : 0) - (tg <= 3 ? 1 : 0), man: 2 });
}
const GF_FG_RANGE = 52;
function gfFourth() {
  if (gfKickDist() <= GF_FG_RANGE) return 'fg';
  if (G.togo <= 2 && G.ball >= 40) return 'go';
  return 'punt';
}
function gfKickGood(k) { return R() < clamp(.99 - (gfKickDist() - 20) * .017 + (k.r.kck - 5) * .03, .05, .99); }
function gfPuntYards(k) { return Math.round(36 + k.r.kck * 1.6 + gauss() * 5); }
