/* ================= weaknesses: a stat of 3 or less causes real trouble ================= */
// 0 for 4+, then 1/3, 2/3, 1 for stats of 3, 2, 1
const weakK = (p, s) => p && p[s] != null && p[s] <= 3 ? (4 - Math.max(1, p[s])) / 3 : 0;
const WEAK_TXT = {
  pow: 'Feeble: the ball comes off the bat softer, and up to 30% of contacts are weak dribblers.',
  con: 'Whiffer: a smaller swing circle, and up to 25% of swings that should connect miss outright.',
  spd: 'Plodder: slower on the bases and in the field, reacts late, and can stumble out of the box.',
  arm: 'Noodle arm: slower throws, up to 25% of throws sail wild, and pitches scatter up to 60% wider.',
  fld: 'Butterfingers: up to three times as many bobbles.',
};

