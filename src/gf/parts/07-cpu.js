/* Cinder Gridiron: the coaches (issue #9, phase 1). Each side's call is a weighted pick from the down and distance,
   leaning to what beats the other side's recent calls and away from tired ones (12-playbook.js). On fourth down the coach kicks a field goal in
   range, goes for it when it is short, and punts otherwise; a Knight or better weighs the fumble risk first (gfFourthWary). */
function gfCpuOffense() {
  const d = G.down, tg = G.togo;
  const w = { run: 3 + (tg <= 3 ? 3 : 0) - (tg >= 9 && d >= 2 ? 1.5 : 0), short: 3 + (tg >= 4 && tg <= 8 ? 1.5 : 0),
    deep: 1.2 + (tg >= 9 ? 2 : 0) + (d === 3 && tg >= 7 ? 1.5 : 0), screen: 1.3 + (tg >= 6 ? .8 : 0) };
  return wpick(gfCounterOffense(w));
}
function gfCpuDefense() {
  const d = G.down, tg = G.togo;
  return wpick(gfCounterDefense({ blitz: 1.2 + (d === 3 && tg >= 6 ? 1.5 : 0) + (tg <= 2 ? 1 : 0), zone: 1.6 + (tg >= 10 ? 1.5 : 0) - (tg <= 3 ? 1 : 0), man: 2 }));
}
// GF_FG_RANGE: the coach kicks from here in; GF_FG_MAX: the longest try you may call
const GF_FG_RANGE = 52, GF_FG_MAX = 62;
function gfFourth() {
  if (gfKickDist() <= GF_FG_RANGE) return 'fg';
  if (G.togo <= 2 && G.ball >= 40) return gfFourthWary(G.poss) && !(G.togo <= 1 && G.ball >= 50) ? 'punt' : 'go';
  return 'punt';
}
// a careful coach (a Knight or better) sees a fumble coming: the reason, or ''
function gfFourthWary(side) {
  if (!(G.skill || [1, 1])[side] || G.togo > 2) return '';
  const r = gfFumbleRisk(side); return r.x >= GF_FUM.wary ? r.why || 'the back could fumble' : '';
}
const gfKicker = () => G.teams[G.poss].roster[G.teams[G.poss].kicker];
function gfKickChance(k) { return clamp(.99 - (gfKickDist() - 20) * .017 + ((k || gfKicker()).r.kck - 5) * .03 + gfZoneSum('kick'), .05, .99); }
function gfKickGood(k) { return R() < gfKickChance(k); }
function gfPuntYards(k) { return Math.round(36 + k.r.kck * 1.6 + gauss() * 5); }
