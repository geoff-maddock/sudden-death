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
        m.rs = r ? Object.fromEntries(CR_STATS.map(k => [k, crScale(r[k])])) : Object.assign({}, CR_DEF_RAT);
        // (their gear's effects the engine reads: 14-kit.js)
        m.gx = crGx(m.gear && m.gear.fx); return m; });
    return Object.assign({}, T, { roster }); });
  // an order: the game's, the team's own, or set by the ratings
  // (one curler the engine can't rate doesn't keep the rest from being placed: their rs is an average curler's)
  const order = [0, 1].map(s => (o.order && o.order[s]) || teams[s].order || (teams[s].roster.some(m => m.r) ? crAutoOrder(teams[s].roster) : null));
  crNewGame({ ends: o.ends, order, roster: teams.map(T => T.roster.length), hammer: o.hammer, fgz: o.fgz });
  Object.assign(G, { teams, skill: [0, 1].map(s => clamp(((o.skill || [])[s] ?? 1) | 0, 0, 3)), cold: CR_COLD[o.cold] ? o.cold : 'mid', ice: crIceNew(), iceEnd: null, legs: [1, 1], n: 0,
    st: [crBox(), crBox()], pst: teams.map(T => T.roster.map(() => ({ stones: 0, made: 0 }))), last: null });
  crShedStart(o); crPowersStart(o); crKitStart(o.bags);
  // (the Umbral's hexes, when a game asks for them: 15-umbral.js)
  crHexStart(o.hexes, o.hexOn);
  // (the frozen deep, when a game asks for it, last: a game without it draws the same random numbers as before: 16-deep.js)
  crDeepStart(o);
  // the lab's switches (phase 10): fixShot [shot or null, ...] (a side held to one shot where it can), noSweep [bool, ...]
  // (a side's sweepers never sweep), wear: false (the pebble never wears)
  G.fixShot = Array.isArray(o.fixShot) ? o.fixShot.slice() : null; G.noSweep = Array.isArray(o.noSweep) ? o.noSweep.map(Boolean) : null; G.wear = o.wear !== false;
  GB = null;
  return G;
}
// (buttons: draws that came to rest on the button itself, the one-foot circle at the tee: phase 11's medal)
const CR_BUTTON = CR_SHEET.rings[3];
const crBox = () => ({ stones: 0, made: 0, shots: {}, madeBy: {}, ends: { scored: 0, stolen: 0, blank: 0 }, big: 0, buttons: 0 });
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
  let plan = Object.assign(crPlan(s, style || null), { s });
  // (the CPU's potion, and its powers on the shot it has called, before the release)
  plan = crCpuPotionPlan(s, plan, () => crPlan(s, style || null)).plan; crCpuPower(s, plan.shot);
  return crThrowStone(s, plan, crMiss(s, plan.aim, plan.shot), crSweeper(s, plan));
}
// a stone as released (the CPU's, or yours from the page): down the sheet among the others, the pebble worn, the rules.
// crThrowBegin puts it on the ice (the page then moves it on a step at a time: crRunStep), crThrowFinish settles it
// (the throw running on this game, if any: one at a time, and it settles only into the game it began on)
let CR_LIVE = null;
// every throw's number (the page's sounds tell one stone's run from the next by it, a refused one's too)
let CR_THROWN = 0;
function crThrowBegin(s, plan, rel, sweep) {
  // (a stone out of turn changes nothing: no run, no wear, no box score)
  if (crWhyNot(s) || (CR_LIVE && CR_LIVE.g === G)) return null;
  plan = Object.assign({}, plan, { s });
  // (the sweepers asked to sweep: how hard they really do, by their sweep rating and their legs, the run works out; a
  // number is a steady ask)
  if (typeof sweep === 'number') { const k = sweep; sweep = () => k; }
  // (and Frost Salt on its line: it drags, as under a curse)
  const fx = crFxFor(s); if (G.salt && G.salt[s]) fx.heavy *= CR_POTIONS.crsalt.heavy;
  // (and a hex on their stones: rime on the pebble, leaden brooms: 15-umbral.js)
  if (G.hex) crHexFx(s, fx);
  const Q = crRunInit(G.stones, { id: 'new', s, x0: 0, ang: rel.ang, v: rel.v, h: rel.h }, { ice: G.ice, cold: G.cold, sweep, legs: true, side: s, fx });
  const X = { id: ++CR_THROWN, s, plan, rel, Q, fx, g: G, legs0: (G.legs || [1, 1]).slice(), ri: crThrower(s), pos: crPos(s), before: G.stones.map(b => Object.assign({}, b)), endNo: G.end, ham: G.hammer };
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
  // (a gust as the stones settle pushes their stone nearest the button back, before the rules look; it moves the run's
  // own copies, so a stone the rules refuse, or the free guard zone undoes, leaves G.stones as it was)
  const gust = run.stop || run.hits ? crGust(s, run.stones, X.fx) : '';
  // (the Drifting House: a hexed side's stone at rest in the house slides further out, before the rules look: 15-umbral.js)
  const drift = G.hex ? crHexDrift(s, run) : 0;
  // (the frozen deep: Old Grey bumps the stones at rest where he swims next, before the rules score them: 16-deep.js)
  const sc0 = G.deep ? crScoreEnd(run.stones) : null, bumps = G.deep ? crDeepBump(run.stones) : [], sc1 = bumps.length ? crScoreEnd(run.stones) : sc0;
  const rule = crThrow(s, run.stones, { hit: run.hits > 0 }); if (!rule.ok) { G.legs = X.legs0; console.warn('The Curling Shed: a stone refused by the rules:', rule.why); return crRefused(s, rule.why); }
  // (he swims after every stone the rules take; a stone the free guard zone takes off changes nothing, so he stays where he
  // is, his ring still where he goes next, and its bump isn't kept)
  const bumped = rule.fgz ? [] : bumps;
  if (G.deep && !rule.fgz) { G.deep.bumps += bumped.length; if (bumped.length && (sc0.s !== sc1.s || sc0.n !== sc1.n)) G.deep.swings++; crDeepSwim(); }
  if (G.wear !== false) crWear(G.ice, run.path);
  // (Hoarfrost: the first of the other rink's stones an end to lie in the four-foot freezes there: 15-umbral.js)
  const froze = G.hex ? crHexFreeze() : false;
  const made = !rule.fgz && crMade(plan, before, rule.end ? run.stones : G.stones, run);
  // a new end: the ice as it is now is what a Knight reads through it
  if (rule.end) { G.iceEnd = G.ice.slice(); crLegsNewEnd(); }
  // the Shed's ways: after a stone a frost sprite now and then; after an end the frost, and Hennock's pebble at the half
  G.hallSaid = rule.end ? crShedEnd(rule.end.end) : crShedAfter();
  if (bumped.length) G.hallSaid = [G.hallSaid, crDeepSay(bumped)].filter(Boolean).join(' ');
  const B = G.st[s], P = G.pst[s][ri]; B.stones++; P.stones++; B.shots[plan.shot] = (B.shots[plan.shot] || 0) + 1;
  if (made) { B.made++; P.made++; B.madeBy[plan.shot] = (B.madeBy[plan.shot] || 0) + 1; }
  if (made && plan.shot === 'draw' && run.stop && Math.hypot(run.stop.x, run.stop.y) <= CR_BUTTON) B.buttons = (B.buttons || 0) + 1;
  // the end: a blank, a score (three or more is a big end), or a steal (scored by the side without the hammer)
  if (rule.end) { const e = rule.end; if (e.s < 0) [0, 1].forEach(k => G.st[k].ends.blank++); else { const W = G.st[e.s]; W.ends.scored++; if (e.n >= 3) W.big++; if (e.s !== ham) W.ends.stolen++; } }
  G.n++;
  const ev = { side: s, ri, pos, end: endNo + 1, plan, rel, stop: run.stop, hits: run.hits, out: run.out, made, rule, ham, gust: rule.fgz ? '' : gust, ghost: X.Q.T.ghostId || null };
  if (drift && !rule.fgz) ev.drift = drift;
  if (bumped.length) ev.deep = bumped;
  if (froze) ev.froze = 1 - G.hex.on;
  crPowersAfter(s, ev, endNo, ham); crKitAfter(s, !!rule.end);
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
    tot: [crTotal(0), crTotal(1)], log: G.log.slice(), casts: (G.casts || []).slice(), pots: (G.pots || []).slice(), skill: G.skill.slice(), cold: G.cold, stones: G.n, extra: G.extra, deep: G.deep ? { bumps: G.deep.bumps, swings: G.deep.swings } : null };
}
// the game as it stands between stones, plain JSON (a match saved and left); and back
// (each stone's path thinned to a point every five feet, so a long game doesn't swell the save; a path already thinned
// stays as it is, however often the match is saved and resumed)
// (and every sharp turn, where it hit something, marked [x, y, 1] so a second thinning keeps it too)
const crTurnAt = (p, i) => { if (p[i][2] === 1) return true; const a = p[i - 1], b = p[i], c = p[i + 1]; if (!a || !c) return false;
  const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]), h2 = Math.atan2(c[1] - b[1], c[0] - b[0]); let d = Math.abs(h1 - h2); if (d > Math.PI) d = 2 * Math.PI - d; return d > .35; };
const crThin = p => { const out = []; let D = null; p.forEach((q, i) => {
  if (!D || i === p.length - 1 || Math.hypot(q[0] - D[0], q[1] - D[1]) >= 59) { out.push([q[0], q[1]]); D = q; } else if (crTurnAt(p, i)) out.push([q[0], q[1], 1]); }); return out; };
function crSnapshot() {
  // (a stone your captain has cast on and not thrown: kept as it was before the casts, so taking it back still undoes them)
  let g = GP && GP.cpu && GP.cpu.pre ? Object.assign({}, G, JSON.parse(JSON.stringify(GP.cpu.pre))) : G;
  // (a stone sliding: the game as it was released, its sweepers' legs too, and the release, so a resume brings it to rest
  // on that release (issue #120): your sweeping isn't kept, the CPU's sweepers sweep it as they would)
  const X = GP && GP.ph === 'slide' && GP.X && GP.X.g === G ? GP.X : null;
  if (X) g = Object.assign({}, g, { legs: X.legs0.slice() });
  // (said: the last stone's line, said again on a resume, #120)
  return JSON.parse(JSON.stringify({ G: g, mode: GP ? GP.mode : 'watch', mgr: GP ? GP.mgr : null, autoPow: !!(GP && GP.autoPow), paths: GP ? GP.paths.map(q => ({ s: q.s, path: crThin(q.path) })) : [],
    slide: X ? { s: X.s, plan: X.plan, rel: X.rel, cpu: !!X.Q.O.sweep } : null, said: GP ? GP.said || '' : '' })); }
function crResume(sn) {
  G = JSON.parse(JSON.stringify(sn.G)); GB = null; CR_LIVE = null;
  // (a game saved before a part added its state: that part's state as it starts)
  if (G.powers && !G.powWhich) G.powWhich = [null, null];
  if (!G.potEnd) { const b = G.bags; crKitStart(b); }
  if (G.deep === undefined) { G.deep = null; G.deepSaid = ''; }
  // (a stone kept sliding comes to rest on its release first, as the game goes on: never thrown again)
  const sl = sn.slide; let ev = null, path = null, said = sn.said || '';
  if (sl && sl.plan && sl.rel) {
    GP = null;   // (the page's last game has no say in it: crPlayStart makes this one's)
    const X = crThrowBegin(sl.s, sl.plan, sl.rel, sl.cpu ? crSweeper(sl.s, sl.plan) : null);
    if (X) { while (crRunStep(X.Q)); ev = crThrowFinish(X); if (ev.rule.ok) { path = X.Q.path.map(p => [p[0], p[1]]); said = crSettleSay(ev, X.ham); } }
  }
  crPlayStart({ mode: sn.mode });
  if (sn.mgr) GP.mgr = Object.assign({}, sn.mgr); GP.autoPow = !!sn.autoPow; GP.paths = (sn.paths || []).slice();
  if (path) { GP.paths.push({ s: ev.side, path }); GP.last = ev; }
  // (the last stone's line first, the one left sliding's when there was one: #120)
  GP.said = said;
  GP.msg = `${said ? said + ' ' : ''}Back at the Shed${path ? `, the stone left sliding at rest` : ''}: ${crMatchText(0).toLowerCase()}.`;
  return G;
}
// a whole game headless: leaves the game on the ice, and the random stream, as they were
function crSimGame(opts) {
  // (the page's game is set aside too, so a stone it has called never weighs in on this one)
  const keep = G, keepB = GB, keepR = engRand, keepP = GP, keepL = CR_LIVE; GP = null; CR_LIVE = null;
  if (!opts || opts.seed == null) engRand = engRng((Math.random() * 4294967296) >>> 0);
  try {
    crStart(opts);
    let n = 0; while (!G.over && n++ < 400) crTurn();
    return Object.assign({ win: G.over ? G.over.win : -1 }, crSummary());
  } finally { G = keep; GB = keepB; engRand = keepR; GP = keepP; CR_LIVE = keepL; }
}
