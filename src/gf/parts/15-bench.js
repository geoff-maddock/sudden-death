/* Cinder Gridiron: the bench, and getting tired legs back. A team may bring more than seven (04-teams.js): the seven on
   the field are the ones in its off and def maps, and the rest sit on the bench, resting (GF_STAM.bench a play).
   - Swaps (gfSwap): between plays, a player off the bench takes a tired player's places, on offense and on defense
     (and the kicks, if they were the kicker). The one who comes off rests, and may come back on later.
   - Stamina back (gfRestore): for one player or the whole seven. The Realm's potions use it (gfUseItem: one a play,
     between plays), and so do a few powers (14-powers.js: rest, restZ; gfPowRest).
   - The coaches swap too (gfCpuSwaps, at each snap, by skill): a Squire now and then, for anyone fresher; a Knight a
     player under 40, for the freshest who would play those positions at least as well now (gfPlaysAs: the ratings the
     positions use, worn by stamina); an Archmage a player under 55, for whoever would play them best, and only if
     better. Never for someone less than GF_SWAP.gap fresher.
   - The log: every swap, potion and power that gives stamina back waits in GD.notes ({ side, k, msg }) and goes in the
     next play's log line (gfTakeNotes: e.notes), with the powers cast (e.pw, 08-drive.js).
   G.played[side]: every roster index that has taken the field (the Realm pays them as the seven). */
const GF_SWAP = { gap: 25, lim: [30, 40, 55], squire: .3 };
// the ratings each position leans on (the coaches weigh a swap by them)
const GF_POS_KEY = { QB: ['arm'], RB: ['spd', 'str'], C: ['str'], LG: ['str'], RG: ['str'], X: ['spd', 'hnd'], Z: ['spd', 'hnd'],
  DT: ['str', 'tkl'], DL: ['str', 'tkl'], DR: ['str', 'tkl'], CL: ['spd'], CR: ['spd'], LB: ['tkl', 'spd'], S: ['spd', 'tkl'] };
// who is on the field (the seven, by roster index), and who is on the bench
const gfOnField = side => { const T = G.teams[side]; return [...new Set(Object.values(T.off).concat(Object.values(T.def)))]; };
const gfBench = side => { const on = gfOnField(side); return G.teams[side].roster.map((_, i) => i).filter(i => !on.includes(i)); };
const gfStamOf = (side, ri) => G.stam ? G.stam[side][ri] : 100;
// how tired the seven are: 0 fresh to 1 spent
function gfTired(side) { if (!G.stam) return 0; const on = gfOnField(side); return 1 - on.reduce((a, i) => a + G.stam[side][i], 0) / on.length / 100; }
function gfNote(side, k, msg) { (GD.notes = GD.notes || []).push({ side, k, msg }); }
// a play goes in the log: the notes since the last one go with it
function gfTakeNotes(e) { if (GD && GD.notes && GD.notes.length) { e.notes = GD.notes; GD.notes = []; } return e; }
// can a swap or a potion happen now: between plays (not with a play or a kick under way)
const gfBetween = () => !!GD && !['pre', 'live', 'kick', 'over'].includes(GD.ph);

// inn (on the bench) takes out's places, both ways; returns what happened, or '' when it can't
function gfSwap(side, out, inn) {
  const T = G.teams[side], on = gfOnField(side);
  if (!on.includes(out) || !T.roster[inn] || on.includes(inn)) return '';
  for (const m of [T.off, T.def]) for (const k in m) if (m[k] === out) m[k] = inn;
  if (T.kicker === out) T.kicker = gfOnField(side).reduce((b, i) => T.roster[i].r.kck > T.roster[b].r.kck ? i : b, inn);
  if (G.played && !G.played[side].includes(inn)) G.played[side].push(inn);
  const st = i => G.stam ? ` (${Math.round(G.stam[side][i])}%)` : '';
  const msg = `${T.roster[inn].n}${st(inn)} comes on for ${T.roster[out].n}${st(out)}.`;
  gfNote(side, 'swap', msg);
  return msg;
}
// your swap: only between plays
function gfSwapYours(out, inn) { return gfBetween() ? gfSwap(GD.you, out, inn) : ''; }
// stamina back: ri one player, or null for the whole seven; what: the name of the potion or power
function gfRestore(side, ri, n, what) {
  if (!G.stam) return '';
  const list = ri == null ? gfOnField(side) : [ri];
  for (const i of list) G.stam[side][i] = Math.min(100, G.stam[side][i] + n);
  const msg = `${what}: ${ri == null ? 'the seven get' : G.teams[side].roster[ri].n + ' gets'} ${n} stamina back.`;
  gfNote(side, 'rest', msg);
  return msg;
}
// a power that gives stamina back: the whole seven, or the most tired few
function gfPowRest(side, rs, what) {
  if (!G.stam) return;
  if (rs.team) gfRestore(side, null, rs.team, what);
  if (rs.tired) for (const i of gfOnField(side).sort((a, b) => G.stam[side][a] - G.stam[side][b]).slice(0, rs.tired[0])) gfRestore(side, i, rs.tired[1], what);
}
// a potion from your bag (the Realm keeps the bag): one a play, between plays. ri: one player, or null for the seven
function gfUseItem(ri, n, name) {
  if (!G.stam || !gfBetween() || GD.item) return '';
  if (ri != null && !gfOnField(GD.you).includes(ri)) return '';
  GD.item = true;
  return gfRestore(GD.you, ri, n, name);
}
// the coaches' swaps at the snap, by skill
function gfCpuSwaps(side, skill) {
  if (!G.stam || !gfBench(side).length) return;
  if (skill === 0 && R() > GF_SWAP.squire) return;
  const lim = GF_SWAP.lim[skill] || GF_SWAP.lim[1];
  for (const out of gfOnField(side).sort((a, b) => gfStamOf(side, a) - gfStamOf(side, b))) {
    if (gfStamOf(side, out) >= lim) break;
    let bench = gfBench(side).filter(i => gfStamOf(side, i) >= gfStamOf(side, out) + GF_SWAP.gap);
    if (skill >= 1) { const now = gfPlaysAs(side, out, out); bench = bench.filter(i => skill === 2 ? gfPlaysAs(side, i, out) > now * 1.02 : gfPlaysAs(side, i, out) >= now); }
    if (!bench.length) continue;
    const inn = skill === 2 ? bench.sort((a, b) => gfPlaysAs(side, b, out) - gfPlaysAs(side, a, out))[0] : skill === 1 ? bench.sort((a, b) => gfStamOf(side, b) - gfStamOf(side, a))[0] : pick(bench);
    gfSwap(side, out, inn);
  }
}
// how well i would play out's positions now: the ratings they lean on, worn by i's stamina (and the kicks, by half)
function gfPlaysAs(side, i, out) {
  const T = G.teams[side], r = gfWorn(side, i, T.roster[i].r);
  const keys = Object.keys(T.off).filter(k => T.off[k] === out).concat(Object.keys(T.def).filter(k => T.def[k] === out)).flatMap(k => GF_POS_KEY[k] || []);
  return keys.reduce((a, k) => a + r[k], 0) + (T.kicker === out ? r.kck * .5 : 0);
}
// a row for the page: who, their stamina, and where they play
function gfBenchRow(side, i) {
  const T = G.teams[side], m = T.roster[i], at = mp => Object.keys(mp).find(k => mp[k] === i) || null;
  return { ri: i, n: m.n, kind: m.kind, num: m.num, stam: Math.round(gfStamOf(side, i)), off: at(T.off), def: at(T.def), kicker: T.kicker === i };
}
