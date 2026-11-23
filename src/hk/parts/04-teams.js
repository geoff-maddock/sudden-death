/* Black Ice: teams (issue #83, phase 1). Five skaters and a goalie a side.
   Ratings, 1 to 10 (the Realm's own run to 12, phase 4): spd (top speed and getting to it), siz (size: checks given
   and taken, screens, battles on the boards), hnd (hands: keeping the puck, passing, face-offs), sht (shot: power and
   aim), def (defense: pokes, lifts, blocks, position) and ref (reflexes: goaltending). HK_KIND seeds them by kind.
   The spots: a centre (C: face-offs and passes), two wings (LW, RW: they shoot), two defenders (LD, RD: they check,
   and shoot from the point) and the goalie (G: reflexes and little else). Any player can play anywhere; phase 1 picks
   the six's spots from the ratings, and phase 4 lets you set them.
   A team: { name, short, color, light, roster: [{ n, kind, num, r, pw }], spot: { C: ri, ... } } (pw: which of their
   kind's two puck powers and two checking powers they bring, 14-powers.js). A roster may be longer
   than six: the rest (up to HK_RULES.bench) sit on the bench. */
const HK_POS = ['C', 'LW', 'RW', 'LD', 'RD', 'G'];
const HK_ROLE = { C: 'centre', LW: 'wing', RW: 'wing', LD: 'defender', RD: 'defender', G: 'goalie' };
const HK_STATS = ['spd', 'siz', 'hnd', 'sht', 'def', 'ref'];
const HK_KIND = {
  goblin: [7, 3, 8, 6, 5, 6], kobold: [7, 3, 6, 7, 5, 6], werewolf: [8, 7, 5, 6, 7, 5], dwarf: [4, 6, 6, 7, 7, 6],
  ogre: [3, 10, 2, 7, 6, 3], minotaur: [6, 9, 4, 7, 7, 4], troll: [4, 9, 3, 6, 7, 5], golem: [2, 10, 2, 5, 8, 7],
  harpy: [10, 2, 6, 6, 4, 7], elf: [8, 4, 8, 8, 5, 6], wraith: [8, 4, 8, 6, 6, 7], vampire: [8, 6, 7, 7, 6, 6],
  lich: [4, 5, 7, 8, 5, 6], zombie: [3, 7, 3, 4, 6, 4], gorgon: [6, 6, 6, 7, 7, 7], spider: [7, 5, 7, 5, 8, 10],
  skeleton: [6, 4, 6, 7, 5, 5], witch: [6, 4, 7, 8, 4, 6],
};
function hkRate(kind) { const k = HK_KIND[kind] || HK_KIND.goblin; return Object.fromEntries(HK_STATS.map((s, i) => [s, k[i]])); }
// the two clubs a game uses when the Realm doesn't send its own: about even under the CPU
const HK_CLUBS = {
  home: { name: 'Rimewatch', short: 'RIM', color: '#3a6ab8', light: '#e2eeff', kinds: ['vampire', 'harpy', 'witch', 'werewolf', 'troll', 'wraith'] },
  away: { name: 'Visitors', short: 'VIS', color: '#b8443a', light: '#ffe6e0', kinds: ['elf', 'goblin', 'kobold', 'minotaur', 'golem', 'gorgon'] },
};
// how well ratings r suit a spot
const hkFit = (r, pos) => pos === 'G' ? r.ref * 3 + r.siz * .4 - r.spd * .2 : pos === 'C' ? r.hnd * 2 + r.spd + r.sht * .5
  : HK_ROLE[pos] === 'wing' ? r.sht * 2 + r.spd + r.hnd * .5 : r.def * 2 + r.siz + r.sht * .3;
// a spot map that names every spot once, each to a different player in the roster
const hkSpotOk = (m, n) => !!m && HK_POS.every(k => Number.isInteger(m[k]) && m[k] >= 0 && m[k] < n) && new Set(HK_POS.map(k => m[k])).size === HK_POS.length;
// a team from { name, short, color, light, roster: [{ n, kind, num, r? }] } or { ..., kinds: [6 or more kinds] }
function hkTeam(t) {
  const roster = (t.roster || t.kinds.map((kind, i) => ({ kind, n: kind[0].toUpperCase() + kind.slice(1), num: 4 + i * 9 }))).slice(0, HK_RULES.side + HK_RULES.bench)
    .map(p => Object.assign({ n: p.n, kind: p.kind, num: p.num, r: Object.assign(hkRate(p.kind), p.r || {}), pw: { puck: p.pw && p.pw.puck === 1 ? 1 : 0, chk: p.pw && p.pw.chk === 1 ? 1 : 0 }, gear: p.gear ? p.gear.name || '' : '', gx: hkGx(p.gear && p.gear.fx) }, p.ult ? { ult: p.ult } : {}));
  const T = Object.assign({ name: t.name, short: t.short, color: t.color, light: t.light, roster }, t.shade ? { shade: 1 } : {}); // (shade: an Umbral side, drawn in shadow)
  // the six's spots: the best reflexes in goal, then the two best defenders, the centre, and the wings
  const free = new Set(roster.slice(0, HK_RULES.side).map((_, i) => i)), by = pos => { const i = [...free].sort((a, b) => hkFit(roster[b].r, pos) - hkFit(roster[a].r, pos))[0]; free.delete(i); return i; };
  T.spot = {}; for (const pos of ['G', 'LD', 'RD', 'C', 'LW', 'RW']) T.spot[pos] = by(pos);
  if (hkSpotOk(t.spot, roster.length)) T.spot = Object.assign({}, t.spot);
  return T;
}
