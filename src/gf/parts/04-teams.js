/* Cinder Gridiron: teams (issue #9, phase 1). Seven a side, and the same seven play offense and defense (question 2).
   Ratings, 1 to 10: spd (speed), str (strength: blocking, shedding blocks, breaking tackles), hnd (hands), arm, kck
   (kicking) and tkl (tackling). GF_KIND seeds them by kind; the Realm's own ratings per player come in phase 3.
   The lineup is picked from the ratings: the best arm throws, the best runner carries, the three strongest block, and
   the other two catch; on defense the three strongest rush, the two fastest cover the receivers, and the other two are
   the linebacker and the safety. A team: { name, short, color, light, roster: [{ n, kind, num, r }], off, def, kicker },
   where off and def map each position to a roster index. A team sent with its own off and def (the Realm's lineup,
   phase 3) keeps them when they name all seven positions, each a different player. Realm ratings run to 12.
   A roster may be longer than seven: the first seven start (unless off and def say otherwise), and the rest, up to
   GF_RULES.bench, sit on the bench to come on for a tired player (15-bench.js). */
const GF_OFF_POS = ['QB', 'RB', 'C', 'LG', 'RG', 'X', 'Z'], GF_DEF_POS = ['DT', 'DL', 'DR', 'CL', 'CR', 'LB', 'S'];
// a position map that names every position once, each to a different player in the roster
const gfMapOk = (m, pos, n) => !!m && pos.every(k => Number.isInteger(m[k]) && m[k] >= 0 && m[k] < n) && new Set(pos.map(k => m[k])).size === pos.length;
const GF_STATS = ['spd', 'str', 'hnd', 'arm', 'kck', 'tkl'];
const GF_KIND = {
  goblin: [7, 3, 6, 5, 6, 4], kobold: [6, 4, 5, 7, 7, 4], werewolf: [8, 7, 5, 4, 3, 8], dwarf: [4, 8, 4, 5, 6, 7],
  ogre: [3, 10, 3, 4, 4, 7], minotaur: [6, 9, 3, 3, 3, 8], troll: [4, 9, 3, 3, 3, 8], golem: [2, 10, 2, 2, 2, 7],
  harpy: [9, 2, 8, 4, 5, 3], elf: [9, 3, 8, 7, 7, 4], wraith: [8, 3, 7, 5, 4, 4], vampire: [8, 5, 6, 6, 5, 6],
  lich: [4, 4, 5, 9, 6, 4], zombie: [3, 7, 3, 3, 3, 6], gorgon: [6, 5, 6, 7, 5, 5], spider: [7, 5, 9, 4, 3, 7],
  skeleton: [6, 4, 5, 6, 8, 4], witch: [6, 3, 6, 8, 6, 3],
};
function gfRate(kind) { const k = GF_KIND[kind] || GF_KIND.goblin; return Object.fromEntries(GF_STATS.map((s, i) => [s, k[i]])); }
// the two clubs a drive uses when the Realm doesn't send its own: a heavy home line, and a visiting side with two fast
// catchers and a mixed line. They come out about even under the coaches (a side that is fast everywhere wins nearly
// every game, so the exhibition doesn't use one)
const GF_CLUBS = {
  home: { name: 'Cinderhold', short: 'CND', color: '#c8461e', light: '#ffd08a', kinds: ['kobold', 'minotaur', 'golem', 'ogre', 'dwarf', 'goblin', 'troll'] },
  away: { name: 'Visitors', short: 'VIS', color: '#3f8a5a', light: '#e8f4c8', kinds: ['harpy', 'elf', 'golem', 'zombie', 'troll', 'skeleton', 'goblin'] },
};
// a team from { name, short, color, light, roster: [{ n, kind, num, r? }] } or { ..., kinds: [7 kinds] }
function gfTeam(t) {
  const roster = (t.roster || t.kinds.map((kind, i) => ({ kind, n: kind[0].toUpperCase() + kind.slice(1), num: 10 + i * 11 }))).slice(0, GF_RULES.side + GF_RULES.bench)
    .map(p => ({ n: p.n, kind: p.kind, num: p.num, r: Object.assign(gfRate(p.kind), p.r || {}) }));
  const T = { name: t.name, short: t.short, color: t.color, light: t.light, roster };
  const starters = roster.slice(0, GF_RULES.side).map((_, i) => i), free = new Set(starters), by = (f, n) => [...free].sort((a, b) => f(roster[b].r) - f(roster[a].r)).slice(0, n).map(i => (free.delete(i), i));
  T.off = {}; T.off.QB = by(r => r.arm * 2 + r.hnd * .3, 1)[0]; T.off.RB = by(r => r.spd + r.str * .8, 1)[0];
  [T.off.C, T.off.LG, T.off.RG] = by(r => r.str * 2 - r.spd * .2, 3); [T.off.X, T.off.Z] = [...free];
  starters.forEach(i => free.add(i));
  T.def = {}; [T.def.DT, T.def.DL, T.def.DR] = by(r => r.str * 2 + r.tkl, 3); [T.def.CL, T.def.CR] = by(r => r.spd * 2 + r.hnd * .4, 2);
  T.def.LB = by(r => r.tkl * 2 + r.spd, 1)[0]; T.def.S = [...free][0];
  if (gfMapOk(t.off, GF_OFF_POS, roster.length)) T.off = Object.assign({}, t.off);
  if (gfMapOk(t.def, GF_DEF_POS, roster.length)) T.def = Object.assign({}, t.def);
  T.kicker = Number.isInteger(t.kicker) && roster[t.kicker] ? t.kicker : starters.reduce((b, i) => roster[i].r.kck > roster[b].r.kck ? i : b, 0);
  return T;
}
