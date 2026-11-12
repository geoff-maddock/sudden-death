/* The Charter Court: teams (issue #77, phase 1). Five a side, and the same five play at both ends.
   Ratings, 1 to 10 (the Realm's own run to 12, phase 3): spd (speed), siz (size: height and reach, on blocks,
   rebounds and shots at the rim), hop (hops), tch (touch: shooting), hnd (handle) and def (defense). Size counts, but
   it is one rating of six: a goblin with good defense who times the jump can block an ogre. BK_KIND seeds them by kind.
   The spots: two guards (PG, SG: they handle), a wing (SF: they shoot) and two bigs (PF, C: they screen, rebound and
   block). Any player can play anywhere; phase 1 picks the five's spots from the ratings, and phase 3 lets you set them.
   A team: { name, short, color, light, roster: [{ n, kind, num, r }], spot: { PG: ri, ... } }. A roster may be longer
   than five: the first five start, and the rest (up to BK_RULES.bench) sit on the bench. A player may bring pw ({ off,
   def }: which of their kind's two powers for each end, 14-powers.js), and gear ({ id, name, fx }: kept as gear, gid and
   gx, 15-kit.js). */
const BK_POS = ['PG', 'SG', 'SF', 'PF', 'C'];
const BK_ROLE = { PG: 'guard', SG: 'guard', SF: 'wing', PF: 'big', C: 'big' };
const BK_STATS = ['spd', 'siz', 'hop', 'tch', 'hnd', 'def'];
const BK_KIND = {
  goblin: [7, 3, 6, 6, 9, 5], kobold: [7, 3, 5, 7, 7, 5], werewolf: [8, 7, 7, 4, 5, 7], dwarf: [4, 4, 4, 7, 6, 7],
  ogre: [3, 10, 3, 3, 2, 6], minotaur: [6, 8, 6, 3, 4, 7], troll: [4, 9, 4, 3, 3, 7], golem: [2, 10, 2, 3, 2, 8],
  harpy: [9, 2, 10, 5, 6, 4], elf: [8, 5, 7, 9, 7, 5], wraith: [8, 5, 6, 6, 8, 6], vampire: [8, 6, 7, 7, 6, 6],
  lich: [4, 6, 4, 9, 5, 5], zombie: [3, 7, 4, 3, 3, 6], gorgon: [6, 6, 5, 7, 6, 7], spider: [7, 6, 6, 5, 7, 9],
  skeleton: [6, 5, 5, 8, 5, 4], witch: [6, 4, 5, 8, 6, 4],
};
// a kind as a line names it (a kind whose id isn't its name sets it here: the superstars, c0-stars.js)
const BK_KIND_N = {}, bkKindN = k => BK_KIND_N[k] || k;
function bkRate(kind) { const k = BK_KIND[kind] || BK_KIND.goblin; return Object.fromEntries(BK_STATS.map((s, i) => [s, k[i]])); }
// the two clubs a game uses when the Realm doesn't send its own: about even under the CPU
const BK_CLUBS = {
  home: { name: 'Graftonbury', short: 'GRB', color: '#e0742a', light: '#fff0d8', kinds: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll'] },
  away: { name: 'Visitors', short: 'VIS', color: '#3a6fb0', light: '#e2eeff', kinds: ['kobold', 'vampire', 'gorgon', 'spider', 'golem'] },
};
// a spot map that names every spot once, each to a different player in the roster
const bkSpotOk = (m, n) => !!m && BK_POS.every(k => Number.isInteger(m[k]) && m[k] >= 0 && m[k] < n) && new Set(BK_POS.map(k => m[k])).size === BK_POS.length;
// a team from { name, short, color, light, roster: [{ n, kind, num, r? }] } or { ..., kinds: [5 or more kinds] }
function bkTeam(t) {
  const roster = (t.roster || t.kinds.map((kind, i) => ({ kind, n: kind[0].toUpperCase() + kind.slice(1), num: 3 + i * 7 }))).slice(0, BK_RULES.side + BK_RULES.bench)
    .map(p => Object.assign({ n: p.n, kind: p.kind, num: p.num, r: Object.assign(bkRate(p.kind), p.r || {}) }, p.pw ? { pw: { off: p.pw.off === 1 ? 1 : 0, def: p.pw.def === 1 ? 1 : 0 } } : {}, p.gear ? { gear: p.gear.name, gid: p.gear.id, gx: bkGx(p.gear.fx) } : {}));
  const T = { name: t.name, short: t.short, color: t.color, light: t.light, roster };
  // the five's spots: the best handler at the point, the two biggest inside, then the better shooter on the wing
  const free = new Set(roster.slice(0, BK_RULES.side).map((_, i) => i)), by = f => { const i = [...free].sort((a, b) => f(roster[b].r) - f(roster[a].r))[0]; free.delete(i); return i; };
  T.spot = {}; T.spot.PG = by(r => r.hnd * 2 + r.spd - r.siz * .5); T.spot.C = by(r => r.siz * 2 + r.def * .5 + r.hop * .5); T.spot.PF = by(r => r.siz * 2 + r.hop);
  T.spot.SF = by(r => r.tch * 2 + r.hop * .5); T.spot.SG = [...free][0];
  if (bkSpotOk(t.spot, roster.length)) T.spot = Object.assign({}, t.spot);
  return T;
}
