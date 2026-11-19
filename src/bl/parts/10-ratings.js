/* The Saltmere Lanes: ratings, the order's roles, arm and nerve (issue #100, phase 3).

   A bowler's six ratings (BL_STATS) run 1 to 12, seeded by kind (BL_KIND, blRate); the game works on them as 0 to 1
   (blScale):
   - power (pow): the speed of the ball, and how hard it drives through the pins (the ball hits like a heavier one);
   - revs (rev): side spin, so hook and entry angle;
   - accuracy (acc): how true the strike ball's release is (a CPU bowler strays less; your mark on the meter is wider);
   - spare (spr): the same for a ball at a spare;
   - nerve (nrv): how little a big moment shakes them (see pressure);
   - read (red): how well they read the lane as it changes (a Knight bowler corrects faster; phase 4's lane chart
     shows more of the oil).
   A bowler's style (hand, speed, revs) follows from the ratings: power is the speed, revs the revs. A bowler with no
   kind the engine knows keeps a style from the seed, as phase 1's games had.
   The order's roles: the leadoff (the first, who bowls the 1st and the 6th: a striker), the middle three, and the
   anchor (the fifth, who bowls the 5th and the 10th, where close games are decided: nerve and spares). blFit says how
   well ratings suit a role, and blAutoOrder sets an order by them: the anchor first, then the leadoff, then the
   middle.
   Arm (G.arm, 0 to 1 a bowler): each ball costs the bowler some (a power ball more), and it comes back while the rest
   of the side bowls its frames, so it tells mostly in the tenth (three balls) and a roll-off. A tired arm is less true
   (blArmK).
   Pressure (blPressure, 0 to 1.5): a side's last frame (the tenth, or a roll-off's), and half as much again when the
   other side has finished and the game hangs on these balls. Nerve takes it off (blNerveK): a CPU bowler strays more,
   and your meter falls quicker with a smaller mark. */
const BL_STATS = ['pow', 'rev', 'acc', 'spr', 'nrv', 'red'];
// by kind, 1 to 12: power, revs, accuracy, spare, nerve, read. A troll throws a cannonball nobody can steer; a spider's
// eight-legged release puts on revs the others can't; a zombie rolls it dead straight and never panics; a witch reads
// the oil like tea leaves
const BL_KIND = {
  goblin: [5, 7, 6, 7, 5, 6], kobold: [5, 6, 6, 7, 5, 7], werewolf: [8, 8, 5, 5, 6, 5], dwarf: [7, 6, 8, 7, 7, 7],
  ogre: [11, 4, 3, 3, 5, 4], minotaur: [10, 6, 4, 4, 6, 5], troll: [11, 5, 3, 4, 7, 4], golem: [10, 3, 6, 5, 9, 5],
  harpy: [6, 8, 6, 6, 4, 7], elf: [5, 6, 10, 8, 6, 8], wraith: [6, 7, 7, 8, 8, 8], vampire: [7, 8, 7, 7, 7, 7],
  lich: [5, 6, 7, 8, 12, 9], zombie: [7, 3, 7, 6, 10, 4], gorgon: [6, 6, 8, 8, 9, 7], spider: [6, 12, 7, 7, 7, 7],
  skeleton: [5, 6, 7, 7, 9, 6], witch: [5, 7, 6, 9, 6, 10],
};
const BL_RCAP = 12;
const BL_ROLES = ['lead', 'mid', 'mid', 'mid', 'anchor'];
const BL_ARM = { ball: .07, power: .12, back: .05, k: .8 };
const BL_DEF_RAT = { pow: .5, rev: .5, acc: .5, spr: .5, nrv: .5, red: .5 };
function blRate(kind) { const k = BL_KIND[kind]; return Object.fromEntries(BL_STATS.map((s, i) => [s, k ? k[i] : 6.5])); }
const blScale = v => clamp((v - 1) / (BL_RCAP - 1), 0, 1);
// a bowler's ratings as the game works on them (0 to 1)
function blRat(s, ri) { const m = G && G.teams && G.teams[s].roster[ri]; return (m && m.rs) || BL_DEF_RAT; }
// how well ratings (0 to 1) suit a role
const blFit = (r, role) => role === 'lead' ? r.pow * .35 + r.rev * .35 + r.acc * .3 : role === 'anchor' ? r.nrv * .5 + r.spr * .25 + r.acc * .25 : r.acc * .4 + r.spr * .4 + r.red * .2;
// an order for a roster (each with rs, 0 to 1) by the ratings: the anchor, then the leadoff, then the middle three
// (the best of them nearest the anchor). Returns five roster indexes
function blAutoOrder(roster) {
  const left = new Set(roster.map((_, i) => i)), best = role => { const i = [...left].sort((a, b) => blFit(roster[b].rs, role) - blFit(roster[a].rs, role) || a - b)[0]; left.delete(i); return i; };
  const anchor = best('anchor'), lead = best('lead'), mid = [best('mid'), best('mid'), best('mid')];
  return [lead, mid[2], mid[1], mid[0], anchor];
}
// a bowler's style from their ratings: power the speed, revs the revs; the hand is their own (or the seed's)
function blStyleFor(m, rnd) {
  if (m.style) return Object.assign({}, m.style);
  if (!m.r) return blStyle(rnd);
  const r = m.rs, hand = m.hand === -1 || m.hand === 1 ? m.hand : (rnd() < .15 ? -1 : 1);
  return { hand, mph: +(15.2 + 3.2 * r.pow).toFixed(1), rpm: Math.round(230 + 240 * r.rev) };
}
// how much less true a release is with this much arm left (1 at full)
const blArmK = a => 1 + (1 - clamp(a, 0, 1)) * BL_ARM.k;
// how big the moment is for side s's next ball
function blPressure(s) {
  if (!G || G.over) return 0;
  const n = blSheetN(), f = blCur(s); if (f !== n - 1) return 0;
  const o = 1 - s, done = blDone(o) >= n, gap = blTotal(o) - blTotal(s);
  return 1 + (done && gap >= -10 && gap <= 30 ? .5 : 0);
}
// what a moment does to a bowler of nerve nrv (0 to 1): 1 is nothing
const blNerveK = (p, nrv) => 1 + .6 * p * (1 - clamp(nrv, 0, 1));
// all that makes side s's bowler ri less true now: the skill's spread is multiplied by this (spare: a ball at a spare)
function blErrK(s, ri, spare) {
  const r = blRat(s, ri), a = G.arm ? G.arm[s][ri] : 1;
  const fx = typeof blFxFor === 'function' ? blFxFor(s) : null;
  const kit = typeof blKitErr === 'function' && G.bags ? [blKitErr(s, ri), blKitPress(s, ri)] : [1, 1];
  return (1.45 - .9 * (spare ? r.spr : r.acc)) * blArmK(a) * blNerveK(fx && fx.nerve ? 0 : blPressure(s) * kit[1], r.nrv) * (fx ? fx.err : 1) * kit[0];
}
