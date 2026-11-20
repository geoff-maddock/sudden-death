/* The Curling Shed: ratings, positions, the sweepers' legs and nerve (issue #102, phase 3).

   A curler's six ratings (CR_STATS) run 1 to 12, seeded by kind (CR_KIND, crRate); the game works on them as 0 to 1
   (crScale):
   - draw (drw): touch on the weight of a draw, a guard and a freeze (the weight's miss);
   - line (lin): holding the broom (the heading's miss);
   - hit (hit): a takeout's weight and line (the miss on a hit);
   - sweep (swp): how much a sweeper does to a stone, and how long their legs last;
   - nerve (nrv): how little the big stones shake them (see pressure);
   - read (red): how well they read the ice as it changes (a Knight skip who reads it well sees it as it is now;
     phase 4's ice chart shows more of it).
   How far they reach (CR_REACH): an average curler (6.5) misses as the skill says; a rating of 1 by reach / 2 more, of
   12 by reach / 2 less.
   The positions (CR_RULES.posN): the lead throws first (the guards and the draws: draw and line), the second the
   takeouts (hit and sweep), the third the middle stones (hit, draw and read), and the skip the last two (nerve, draw
   and read). crFit says how well ratings suit a position, crAutoOrder sets an order by them: the skip first, then the
   lead, the second and the third.
   The sweepers (crSweepers): the two of the four who are not throwing and not holding the broom (the skip holds it,
   or the third when the skip throws). How hard they sweep is what is asked (0 to 1) times how good they are (their
   sweep rating) times their legs; the run works it out each step (crRun's opts.legs) and spends the legs as it goes.
   Legs (G.legs, 0 to 1 a side): an end's sweeping is so much; every second a stone is swept spends some, and the legs
   are fresh again at the next end. Tired legs do less.
   Pressure (crPressure, 0 to 1.5): the skip's stones in the last end (or an extra end), more on the hammer's stone when
   the game is close. Nerve takes it off (crNerveK): the release shakes, the CPU's and yours. */
const CR_STATS = ['drw', 'lin', 'hit', 'swp', 'nrv', 'red'];
// by kind, 1 to 12: draw, line, hit, sweep, nerve, read. A spider sweeps with eight brooms; an ogre hits like a
// landslide and has no touch; a golem never shakes; a wraith reads the ice like its own breath on a window
const CR_KIND = {
  goblin: [6, 6, 5, 7, 5, 6], kobold: [6, 7, 5, 6, 5, 7], werewolf: [5, 5, 8, 9, 6, 5], dwarf: [8, 8, 7, 6, 8, 7],
  ogre: [4, 4, 10, 8, 6, 4], minotaur: [4, 5, 10, 8, 6, 4], troll: [5, 5, 9, 9, 7, 4], golem: [7, 7, 9, 4, 10, 5],
  harpy: [6, 6, 6, 10, 4, 7], elf: [9, 9, 6, 5, 6, 8], wraith: [9, 7, 6, 6, 9, 9], vampire: [7, 7, 7, 7, 7, 8],
  lich: [8, 8, 6, 5, 11, 9], zombie: [6, 6, 7, 8, 9, 4], gorgon: [7, 9, 7, 6, 8, 7], spider: [6, 6, 6, 12, 6, 7],
  skeleton: [7, 7, 6, 6, 9, 6], witch: [8, 6, 5, 7, 6, 10],
};
const CR_RCAP = 12;
// (drw, lin, hit reach as a multiplier: exp(reach x (.5 - rating)), so a curler rated 1 misses about twice as wide as
// an average one, and one rated 12 about half as wide; the rest are linear)
const CR_REACH = { drw: 1.4, lin: 1.4, hit: 1.4, nrv: .8, swp: .6 };
const crReachK = (reach, r) => Math.exp(reach * (.5 - r));
// (a stone swept hard the whole way spends about a third of an end's legs: the skip's stones can still be swept)
const CR_LEGS = { burn: .02, low: .45 };
const CR_DEF_RAT = { drw: .5, lin: .5, hit: .5, swp: .5, nrv: .5, red: .5 };
function crRate(kind) { const k = CR_KIND[kind]; return Object.fromEntries(CR_STATS.map((s, i) => [s, k ? k[i] : 6.5])); }
// (gear may carry a rating CR_ROVER past the cap: it still counts, a little past the best)
const CR_ROVER = 2;
const crScale = v => clamp((v - 1) / (CR_RCAP - 1), 0, (CR_RCAP + CR_ROVER - 1) / (CR_RCAP - 1));
function crRat(s, ri) { const m = G && G.teams && G.teams[s].roster[ri]; return (m && m.rs) || CR_DEF_RAT; }
// how well ratings (0 to 1) suit a position (0 lead, 1 second, 2 third, 3 skip)
const crFit = (r, pos) => pos === 0 ? r.drw * .5 + r.lin * .4 + r.swp * .1 : pos === 1 ? r.hit * .5 + r.swp * .3 + r.lin * .2 : pos === 2 ? r.hit * .35 + r.drw * .35 + r.red * .3 : r.nrv * .45 + r.drw * .3 + r.red * .25;
// an order for a roster (each with rs, 0 to 1): the skip first, then the lead, the second and the third; roster indexes
function crAutoOrder(roster) {
  const left = new Set(roster.map((_, i) => i)), best = pos => { const i = [...left].sort((a, b) => crFit(roster[b].rs, pos) - crFit(roster[a].rs, pos) || a - b)[0]; left.delete(i); return i; };
  const skip = best(3), lead = best(0), second = best(1), third = best(2);
  return [lead, second, third, skip];
}
// the two sweepers of side s's stone now: roster indexes (the two not throwing nor holding the broom)
function crSweepers(s) {
  const o = G.order[s], pos = crPos(s), broom = pos === 3 ? 2 : 3;
  return o.filter((ri, p) => p !== pos && p !== broom);
}
// how much side s's sweepers do now, against an average pair with fresh legs (1)
function crSweepEff(s) {
  const sw = crSweepers(s).map(ri => crRat(s, ri).swp), avg = sw.reduce((a, b) => a + b, 0) / Math.max(1, sw.length), legs = G.legs ? G.legs[s] : 1;
  return (1 + CR_REACH.swp * (avg - .5)) * (CR_LEGS.low + (1 - CR_LEGS.low) * legs);
}
// side s's sweepers swept this hard (0 to 1, asked) for dt seconds of the stone's time: their legs pay for it
function crLegsBurn(s, sw, dt) { if (G.legs) G.legs[s] = Math.max(0, G.legs[s] - CR_LEGS.burn * sw * dt); }
// how big the moment is for side s's stone: the skip's in the last end (or an extra end), more on the hammer's stone
// in a close game
function crPressure(s) {
  if (!G || G.over || crPos(s) !== 3 || G.end < G.ends - 1) return 0;
  const gap = Math.abs(crTotal(0) - crTotal(1)), last = G.k === crPerEnd() - 1;
  return 1 + (gap <= 2 && last ? .5 : 0);
}
const crNerveK = (p, nrv) => 1 + CR_REACH.nrv * p * (1 - clamp(nrv, 0, 1));
// how much side s's curler misses by, times the skill's: { ang (the line), v (the weight: a draw's touch, or a hit's) }
function crErrK(s, shot) {
  // (and the stone's powers: truer, or wilder under a curse; no pressure with nerve: 13-powers.js)
  // (and their gear, and a Warming Draught: 14-kit.js)
  const f = crFxFor(s), ri = crThrower(s), r = crRat(s, ri), kit = crKitErr(s, ri), nk = crNerveK(f.nerve ? 0 : crPressure(s) * crKitPress(s, ri), r.nrv), hit = ['takeout', 'peel', 'hitroll'].includes(shot);
  return { ang: crReachK(CR_REACH.lin, hit ? (r.lin + r.hit) / 2 : r.lin) * nk * f.err * f.line * kit.ang, v: (hit ? crReachK(CR_REACH.hit, r.hit) : crReachK(CR_REACH.drw, r.drw)) * nk * f.err * f.wt * kit.v };
}
// the legs are fresh at the start of an end
function crLegsNewEnd() { if (G) G.legs = [1, 1]; }
