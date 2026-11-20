/* The Curling Shed: one game, CPU against CPU (issue #102, phase 1).
   crStart(opts) puts a game on the ice: { ends, teams: [2 × { name, short, color, roster: [{ n, kind }] }], order,
   skill: [2 skills, 0 to 2], hammer, cold ('heavy' | 'mid' | 'keen'), fgz, seed }. crTurn() throws the next stone
   (the skip's call, the release with its miss, the sweepers, the stones to rest, the pebble worn, the rules) and says
   what happened; crSimGame(opts) plays a whole game headless and leaves the game on the ice (and the random stream)
   as it was; crSummary() is the game so far.
   The box score (G.st by side, G.pst by player): stones thrown, shots made (crMade: a draw within two feet of its
   call, a guard where it was called, a freeze touching, a takeout or a peel that took its stone out, a hit and roll
   that took it and stayed in the house), and each shot's kind. G.last is the last stone, for the page. */
let GB = null;   // the stone in play between crTurn() and the page's drawing (phase 2): not saved
function crStart(opts) {
  const o = opts || {};
  if (o.seed != null) engSeed(o.seed);
  const teams = [0, 1].map(s => { const T = (o.teams && o.teams[s]) || { name: s ? 'Saltmere' : 'Graftonbury', short: s ? 'SAL' : 'GRA', color: s ? '#2f7898' : '#b83a3a' };
    // a curler with a kind the engine knows gets that kind's ratings (or their own)
    const roster = (T.roster && T.roster.length >= CR_RULES.side ? T.roster : [0, 1, 2, 3].map(i => ({ n: `${T.short || 'P'} ${i + 1}`, kind: '' })))
      // (ratings brought in part are the kind's, or an average curler's, for the rest)
      .map(p => { const r = p.r ? Object.assign(crRate(p.kind), p.r) : CR_KIND[p.kind] ? crRate(p.kind) : null, m = Object.assign({}, p, r ? { r: Object.assign({}, r) } : {});
        m.rs = r ? Object.fromEntries(CR_STATS.map(k => [k, crScale(r[k])])) : Object.assign({}, CR_DEF_RAT); return m; });
    return Object.assign({}, T, { roster }); });
  // an order: the game's, the team's own, or set by the ratings
  // (one curler the engine can't rate doesn't keep the rest from being placed: their rs is an average curler's)
  const order = [0, 1].map(s => (o.order && o.order[s]) || teams[s].order || (teams[s].roster.some(m => m.r) ? crAutoOrder(teams[s].roster) : null));
  crNewGame({ ends: o.ends, order, roster: teams.map(T => T.roster.length), hammer: o.hammer, fgz: o.fgz });
  Object.assign(G, { teams, skill: [0, 1].map(s => clamp(((o.skill || [])[s] ?? 1) | 0, 0, 2)), cold: CR_COLD[o.cold] ? o.cold : 'mid', ice: crIceNew(), iceEnd: null, legs: [1, 1], n: 0,
    st: [crBox(), crBox()], pst: teams.map(T => T.roster.map(() => ({ stones: 0, made: 0 }))), last: null });
  crShedStart(o);
  GB = null;
  return G;
}
const crBox = () => ({ stones: 0, made: 0, shots: {}, madeBy: {}, ends: { scored: 0, stolen: 0, blank: 0 }, big: 0 });
// was the shot made? (what the call asked, against where the stones came to rest)
function crMade(plan, before, after, run) {
  const stop = run.stop, R = CR_SHEET.stoneR, tg = plan.target && before.find(b => b.id === plan.target), gone = tg && !after.some(a => a.id === plan.target);
  switch (plan.shot) {
    case 'draw': return !!stop && Math.hypot(stop.x - plan.x, stop.y - plan.y) <= 24;
    case 'guard': return !!stop && crInFgz(stop) && Math.hypot(stop.x - plan.x, stop.y - plan.y) <= 36;
    // (a freeze: it came to rest touching one of theirs, whichever it is)
    case 'freeze': return !!stop && after.some(o => o.s !== plan.s && Math.hypot(stop.x - o.x, stop.y - o.y) <= 2 * R + 3);
    case 'takeout': case 'peel': return !!gone;
    case 'hitroll': return !!gone && !!stop && crInHouse(stop);
  }
  return false;
}
// the next stone: { side, ri, pos, plan, rel, run, rule, made } or null when the game is over; a stone the game can't
// take (crRefused: rule.ok false, plan and ri null) changes nothing. style: Manage's game for that stone (the page's
// caller passes it for your side; a headless game has none)
function crTurn(style) {
  const s = crUp(); if (s < 0) return null;
  const plan = Object.assign(crPlan(s, style || null), { s });
  return crThrowStone(s, plan, crMiss(s, plan.aim, plan.shot), crSweeper(s, plan));
}
// a stone as released (the CPU's, or yours from the page): down the sheet among the others, the pebble worn, the rules.
// crThrowBegin puts it on the ice (the page then moves it on a step at a time: crRunStep), crThrowFinish settles it
// (the throw running on this game, if any: one at a time, and it settles only into the game it began on)
let CR_LIVE = null;
function crThrowBegin(s, plan, rel, sweep) {
  // (a stone out of turn changes nothing: no run, no wear, no box score)
  if (crWhyNot(s) || (CR_LIVE && CR_LIVE.g === G)) return null;
  plan = Object.assign({}, plan, { s });
  // (the sweepers asked to sweep: how hard they really do, by their sweep rating and their legs, the run works out; a
  // number is a steady ask)
  if (typeof sweep === 'number') { const k = sweep; sweep = () => k; }
  const Q = crRunInit(G.stones, { id: 'new', s, x0: 0, ang: rel.ang, v: rel.v, h: rel.h }, { ice: G.ice, cold: G.cold, sweep, legs: true, side: s });
  const X = { s, plan, rel, Q, g: G, legs0: (G.legs || [1, 1]).slice(), ri: crThrower(s), pos: crPos(s), before: G.stones.map(b => Object.assign({}, b)), endNo: G.end, ham: G.hammer };
  CR_LIVE = X; return X;
}
// a throw the game can't take now (it isn't theirs any more, or it is a different game): the same shape, nothing changed
const crRefused = (s, why) => ({ side: s, ri: null, pos: null, end: null, plan: null, rel: null, stop: null, hits: 0, out: [], made: false, rule: { ok: false, why } });
function crThrowFinish(X) {
  if (CR_LIVE === X) CR_LIVE = null;
  if (X.g !== G) return crRefused(X.s, 'That game is over.');
  // (a stone refused here gives back the legs its sweeping spent: nothing changed)
  const why = crWhyNot(X.s); if (why) { G.legs = X.legs0; return crRefused(X.s, why); }
  const { s, plan, rel, ri, pos, before, endNo, ham } = X, run = crRunEnd(X.Q);
  const rule = crThrow(s, run.stones, { hit: run.hits > 0 }); if (!rule.ok) { G.legs = X.legs0; console.warn('The Curling Shed: a stone refused by the rules:', rule.why); return crRefused(s, rule.why); }
  crWear(G.ice, run.path);
  const made = !rule.fgz && crMade(plan, before, rule.end ? run.stones : G.stones, run);
  // a new end: the ice as it is now is what a Knight reads through it
  if (rule.end) { G.iceEnd = G.ice.slice(); crLegsNewEnd(); }
  // the Shed's ways: after a stone a frost sprite now and then; after an end the frost, and Hennock's pebble at the half
  G.hallSaid = rule.end ? crShedEnd(rule.end.end) : crShedAfter();
  const B = G.st[s], P = G.pst[s][ri]; B.stones++; P.stones++; B.shots[plan.shot] = (B.shots[plan.shot] || 0) + 1;
  if (made) { B.made++; P.made++; B.madeBy[plan.shot] = (B.madeBy[plan.shot] || 0) + 1; }
  // the end: a blank, a score (three or more is a big end), or a steal (scored by the side without the hammer)
  if (rule.end) { const e = rule.end; if (e.s < 0) [0, 1].forEach(k => G.st[k].ends.blank++); else { const W = G.st[e.s]; W.ends.scored++; if (e.n >= 3) W.big++; if (e.s !== ham) W.ends.stolen++; } }
  G.n++;
  const ev = { side: s, ri, pos, end: endNo + 1, plan, rel, stop: run.stop, hits: run.hits, out: run.out, made, rule };
  G.last = { side: s, ri, plan: { shot: plan.shot, x: plan.x, y: plan.y, h: plan.h }, made, stop: run.stop, end: rule.end, fgz: rule.fgz };
  GB = { s, ri, plan, rel, run, before, made, rule };
  return ev;
}
function crThrowStone(s, plan, rel, sweep) {
  const X = crThrowBegin(s, plan, rel, sweep); if (!X) return crRefused(s, crWhyNot(s) || 'A stone is still sliding.');
  while (crRunStep(X.Q)); return crThrowFinish(X);
}
function crSummary() {
  if (!G) return null;
  return { win: G.over ? G.over.win : -1, over: G.over, board: crBoard(), st: JSON.parse(JSON.stringify(G.st)), pst: JSON.parse(JSON.stringify(G.pst)), teams: G.teams.map(T => ({ name: T.name, roster: T.roster.map(m => m.n) })),
    tot: [crTotal(0), crTotal(1)], log: G.log.slice(), skill: G.skill.slice(), cold: G.cold, stones: G.n, extra: G.extra };
}
// the game as it stands between stones, plain JSON (a match saved and left); and back
// (each stone's path thinned to a point every five feet, so a long game doesn't swell the save; a path already thinned
// stays as it is, however often the match is saved and resumed)
// (and every sharp turn, where it hit something, marked [x, y, 1] so a second thinning keeps it too)
const crTurnAt = (p, i) => { if (p[i][2] === 1) return true; const a = p[i - 1], b = p[i], c = p[i + 1]; if (!a || !c) return false;
  const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]), h2 = Math.atan2(c[1] - b[1], c[0] - b[0]); let d = Math.abs(h1 - h2); if (d > Math.PI) d = 2 * Math.PI - d; return d > .35; };
const crThin = p => { const out = []; let D = null; p.forEach((q, i) => {
  if (!D || i === p.length - 1 || Math.hypot(q[0] - D[0], q[1] - D[1]) >= 59) { out.push([q[0], q[1]]); D = q; } else if (crTurnAt(p, i)) out.push([q[0], q[1], 1]); }); return out; };
function crSnapshot() { return JSON.parse(JSON.stringify({ G, mode: GP ? GP.mode : 'watch', mgr: GP ? GP.mgr : null, paths: GP ? GP.paths.map(q => ({ s: q.s, path: crThin(q.path) })) : [] })); }
function crResume(sn) {
  G = JSON.parse(JSON.stringify(sn.G)); GB = null; CR_LIVE = null;
  crPlayStart({ mode: sn.mode });
  if (sn.mgr) GP.mgr = Object.assign({}, sn.mgr); GP.paths = (sn.paths || []).slice();
  GP.msg = `Back at the Shed: ${crMatchText(0).toLowerCase()}.`;
  return G;
}
// a whole game headless: leaves the game on the ice, and the random stream, as they were
function crSimGame(opts) {
  const keep = G, keepB = GB, keepR = engRand;
  if (!opts || opts.seed == null) engRand = engRng((Math.random() * 4294967296) >>> 0);
  try {
    crStart(opts);
    let n = 0; while (!G.over && n++ < 400) crTurn();
    return Object.assign({ win: G.over ? G.over.win : -1 }, crSummary());
  } finally { G = keep; GB = keepB; engRand = keepR; }
}
