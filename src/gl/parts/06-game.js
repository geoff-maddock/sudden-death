/* Mossgate Links: a game (issue #92, phase 1). A turn loop, not a frame loop: glTurn plays the next shot, whoever is
   away (02-rules.js): a short putt may be given, else the side's caddie picks the hitter and the shot (05-cpu.js), the
   swing goes off with the hitter's and the skill's errors (glHit, drawn from R), the ball flies and rolls (04-shot.js),
   and the rules count it: a stroke, a drop for the water, the ball holed, the hole decided. A new hole puts both balls
   on its tee and draws its wind.
   G gains (all plain JSON): cs (the course's seed; GL_STAND for the standing nine) and wild; teams ({ name, roster:
   [{ n, kind, r: ratings }] }, four a side); skill (0 Squire, 1 Knight, 2 Archmage, a side); ball ([{ x, y, lie }]);
   wind ({ s: mph, d: the direction it blows to }); card (each hole played: { no, par, st, up, res }); stat (a side's
   putts, fairways hit and tried, greens in regulation, longest drive, birdies, eagles, water); pst (each player's
   shots, putts and holes holed); log (every shot and every putt given).
   A turn is in parts so a shot can be struck by hand (07-play.js): glNext (who plays, and may their putt be given),
   glGive, glPlan, then glHit (the CPU's swing) or glStrike (yours), and glShoot counts it.
   glSimGame plays a whole game at once through glTurn, so the sim and the game on show can't drift apart. */
const GL_HOOK = { onOver: null, onShot: null, onPhase: null, onPick: null };
// the swing's spread, before the hitter's rating (k: 1.4 less it; 1.5 less it on the green) and the skill's: power (p) and
// accuracy (e) on a full shot, the same for a chip (sp, se), and a putt's angle (pa, radians) and pace (pv)
const GL_SWING = { p: 0.07, e: 0.8, sp: 0.17, se: 0.6, pa: 0.02, pv: 0.12 };
const GL_TEAMS = [{ name: 'Mossgate' }, { name: 'The visitors' }];

// a team from { name, short, color, roster: [{ n, kind, r?: ratings 1 to 12 }], roles?: { tee, approach, short, putt } }
// (or kinds: [4 kinds]). Ratings are the kind's unless given; the game keeps them as 0 to 1. Roles are a player each;
// left out (or not a player each), they are picked from the ratings
function glTeam(t, side) {
  const T = t || GL_TEAMS[side], ro = (T.roster || (T.kinds || []).map(kind => ({ n: kind[0].toUpperCase() + kind.slice(1), kind }))).slice(0, GL_RULES.side);
  while (ro.length < GL_RULES.side) ro.push({ n: 'Player ' + (ro.length + 1) });
  const roster = ro.map((m, i) => { const r = Object.assign(glRate(m.kind), m.r || {}); return { n: m.n || 'Player ' + (i + 1), kind: m.kind || '', r: Object.fromEntries(GL_STATS.map(s => [s, glScale(r[s])])), pw: { long: m.pw && m.pw.long === 1 ? 1 : 0, short: m.pw && m.pw.short === 1 ? 1 : 0 } }; });
  const R = T.roles, ok = R && ['tee', 'approach', 'short', 'putt'].every(k => Number.isInteger(R[k]) && R[k] >= 0 && R[k] < roster.length) && new Set(['tee', 'approach', 'short', 'putt'].map(k => R[k])).size === 4;
  return { name: T.name || GL_TEAMS[side].name, color: T.color || '', short: T.short || '', roster, roles: ok ? Object.assign({}, R) : glAutoRoles(roster) };
}
// the hole being played, built from the course's seed (playoff holes go round again)
function glHoleAt(i) { return glCourseHole(G.cs, (i % G.holes) % 9, glParOf(i)); }
function glHoleNow() { return glHoleAt(G.h); }

function glStart(opts) {
  const o = opts || {}, T = o.teams || [];
  engSeed(o.seed);
  const holes = GL_RULES.holesAt.includes(o.holes) ? o.holes : GL_RULES.holes, wild = !!o.wild;
  const cs = wild ? ((o.course != null ? o.course : R() * 4294967296) >>> 0) : GL_STAND;
  glNewGame({ holes, pars: wild ? glWildPars(cs, holes) : glPars(holes), honour: o.honour });
  Object.assign(G, {
    cs, wild, teams: [glTeam(T[0], 0), glTeam(T[1], 1)], skill: [0, 1].map(s => clamp(Math.round(o.skill && o.skill[s] != null ? o.skill[s] : 1), 0, 2)),
    wood: !!o.wood, weather: GL_WEATHER[o.weather] ? o.weather : null,
    focus: [0, 1].map(() => [1, 1, 1, 1]), stance: [0, 1].map(() => ({ tempo: 'steady', mood: 'careful' })), word: [1, 1], wordOn: [false, false],
    scout: [0, 1].map(() => ({ go: 0, bad: 0 })), turned: false, card: [], log: [], pst: [0, 1].map(() => [0, 1, 2, 3].map(() => ({ shots: 0, putts: 0, holed: 0 }))), stat: [0, 1].map(() => ({ putts: 0, fw: 0, fwTry: 0, gir: 0, drive: 0, birdies: 0, eagles: 0, water: 0 })),
  });
  glPowersStart(o);
  glHoleStart();
  return G;
}
// the turn: after this many holes (5 of 9, 10 of 18, 3 of 6, 2 of 3)
const glTurnAt = () => Math.max(1, Math.round(G.holes * 5 / 9));
// the CPU's call before its shot: the stance for the moment, and the caddie's word on a big putt (a Knight on the last
// hole or in a playoff, an Archmage on any stroke that wins or halves the hole). A Squire stays as it is
function glCpuCall(s) {
  const sk = G.skill[s]; if (!sk) return;
  const up = s === 0 ? glUp() : -glUp(), left = glLeft(), f = G.focus ? G.focus[s].reduce((a, v) => a + v, 0) / 4 : 1;
  G.stance[s] = { tempo: f < 0.6 ? 'quick' : 'steady', mood: (up <= -2 && left <= 4) || (up < 0 && left <= 2) ? 'bold' : 'careful' };
  const H = glHoleNow(), p = glPressure(s);
  if (G.word[s] > 0 && glShotKind(H, s) === 'putt' && p > 0 && (sk >= 2 || p > 1)) { G.word[s]--; G.wordOn[s] = true; }
}
function glHoleStart() {
  const H = glHoleNow();
  G.ball = [0, 1].map(() => ({ x: H.tee.x, y: H.tee.y, lie: 'T' }));
  // a new hole: a little focus back for everyone; at the turn (after the 5th of 9), all of it
  if (G.focus && G.res.length) G.focus = G.focus.map(f => f.map(v => Math.min(1, v + GL_FOCUS.hole)));
  if (G.focus && !G.turned && G.res.length === glTurnAt()) { G.turned = true; G.focus = G.focus.map(f => f.map(() => 1)); G.turnNow = true; } else G.turnNow = false;
  // the wind: the weather's range when there is weather, else anything up to 14 mph
  const Wx = G.weather && GL_WEATHER[G.weather], s = Wx ? Wx.wind[0] + R() * (Wx.wind[1] - Wx.wind[0]) : R() * 14;
  G.wind = { s: Math.round(s), d: Math.round(R() * 628) / 100 };
  G.gir = [false, false];
}

// the swing goes off: the plan, with the hitter's errors. Returns the ball's flight or roll
function glHit(s, plan) {
  // the skill's errors, made worse by a tired hitter and by a big moment for a nervy one
  // (and by the stroke's powers, the hole's mark and any curse on it: glFxFor)
  const fx = glFxFor(s), H = glHoleNow(), b = G.ball[s], rat = glRat(s, plan.ri), em = GL_SKILL.err[G.skill[s]] * glFocusK(G.focus ? G.focus[s][plan.ri] : 1) * glNerveK(glPressFx(s), rat.nrv) * glStanceErr(s) * fx.err;
  const dist = GL_STANCE[glStanceOf(s).mood].dist;
  if (plan.putt) {
    const k = (1.5 - rat.put) * fx.putt, a = plan.a + gauss() * GL_SWING.pa * k * em / fx.err, v = plan.v * (1 + gauss() * GL_SWING.pv * k * em / fx.err);
    const P = glPutt({ hole: H, from: { x: b.x, y: b.y }, a, v, fk: glWetK(), lip: fx.lip });
    return Object.assign({ club: 'pt' }, P, P.water ? glWaterDrop(H, b, P.end) : {});
  }
  const key = plan.kind === 'short' ? rat.tch : rat.acc, k = 1.4 - key;
  return glFlight(Object.assign({ hole: H, from: { x: b.x, y: b.y }, lie: b.lie, club: plan.club, aim: plan.aim, pow: plan.pow * dist * fx.dist * (1 + gauss() * (plan.kind === 'short' ? GL_SWING.sp : GL_SWING.p) * k * em), err: gauss() * (plan.kind === 'short' ? GL_SWING.se : GL_SWING.e) * k * em, spin: plan.spin, rat, fk: glWetK() }, glFxFlight(fx, plan.aim, b)));
}

// who plays next: { side, d (yards to the pin), putt, give (the other side may give this putt) }, or null when it's over
function glNext() {
  if (!G || G.over) return null;
  const H = glHoleNow(), d = [0, 1].map(s => glDistOf(H, s)), s = glAway(d);
  if (s < 0) return null;
  const putt = glShotKind(H, s) === 'putt';
  return { side: s, d: d[s], putt, give: glMayGive(1 - s, s, d[s]) };
}
// does the CPU on the other side give this putt (n from glNext)? The one rule, for the sim and the game on show
const glCpuGives = n => glCpuConcede(1 - n.side, n.side, n.d);
// side by gives the other side its next putt
function glGive(by) {
  const s = 1 - by, h0 = G.res.length, Hs = G.hole, d = glDistOf(glHoleNow(), s);
  if (!glConcede(by).ok) return null;
  G.stat[s].putts++; G.stat[s].given = (G.stat[s].given || 0) + 1;
  return glLogEv({ k: 'given', no: h0 + 1, side: s, by, d0: +d.toFixed(2) }, h0, Hs);
}
// side s hits plan; r is where the ball went (glHit's for the CPU, or a swing by hand: glStrike). Counts it
function glShoot(s, plan, r) {
  const H = glHoleNow(), h0 = G.res.length, Hs = G.hole, no = h0 + 1, d0 = glDistOf(H, s), lie0 = G.ball[s].lie, fx = glFxFor(s), st = glStroke(s, plan.ri);
  if (!st.ok) return { k: 'refused', why: st.why };
  const S = G.stat[s];
  G.ball[s] = { x: +r.end.x.toFixed(2), y: +r.end.y.toFixed(2), lie: r.holed ? 'G' : r.lie };
  if (plan.putt) S.putts++;
  // focus: the hitter spends some (a hard shot more), the other three get a little back
  if (G.focus) { const hard = (plan.pow || 0) > 1 || ['r', 'R', 'S', 'B', 'O'].includes(lie0), cost = (hard ? GL_FOCUS.hard : GL_FOCUS.shot) * GL_STANCE[glStanceOf(s).tempo].focus * fx.focus; G.focus[s] = G.focus[s].map((v, i) => i === plan.ri ? Math.max(0, v - cost) : Math.min(1, v + GL_FOCUS.back)); }
  // the scout: who goes for it, and how often it finds trouble
  if (G.scout && plan.line === 'go' && !plan.putt) { G.scout[s].go++; if (r.water || ['S', 'B', 'O', 'R'].includes(r.lie)) G.scout[s].bad++; }
  if (G.wordOn) G.wordOn[s] = false;
  G.pst[s][plan.ri].shots++; if (plan.putt) G.pst[s][plan.ri].putts++; if (r.holed) G.pst[s][plan.ri].holed++;
  if (lie0 === 'T' && Hs.par > 3 && Hs.st[s] === 1) { S.fwTry++; if (r.lie === 'F' && !r.water) S.fw++; if (plan.club === 'dr' && !r.water) S.drive = Math.max(S.drive, Math.round(hyp(r.end.x - H.tee.x, r.end.y - H.tee.y))); }
  if (!r.water && (r.holed || G.ball[s].lie === 'G') && !G.gir[s] && Hs.st[s] <= Hs.par - 2) { G.gir[s] = true; S.gir++; }
  const ev = { k: 'shot', no, side: s, ri: plan.ri, kind: plan.kind, line: plan.line || '', club: r.club || plan.club, lie0, d0: +d0.toFixed(1), lie: G.ball[s].lie, d1: +glDistOf(H, s).toFixed(1), water: !!r.water, holed: !!r.holed, lip: !!r.lip, st: Hs.st[s] };
  if (r.water) { S.water++; glDrop(s); }
  // the wood's own ways on a ball that has stopped: the bees, the Gloomcap
  ev.wood = glWoodAfter(s, plan.ri, ev);
  if (r.saved) ev.saved = true;
  // the powers: what this stroke spent goes, and what it earned (mana, the roar) comes in
  glPowersAfter(s, ev, plan);
  // holed on the stroke that reached the cap: it still counts
  if (r.holed && Hs.up[s] && !r.water) { Hs.up[s] = false; Hs.done[s] = false; }
  ev.up = !!Hs.up[s] && !r.holed;
  if (r.holed && !r.water && !Hs.done[s]) glHoled(s); else glDecide();
  return glLogEv(ev, h0, Hs);
}
function glLogEv(ev, h0, Hs) {
  if (G.res.length > h0) ev.res = G.res[G.res.length - 1];
  G.log.push(ev);
  if (GL_HOOK.onShot) try { GL_HOOK.onShot(ev); } catch (e) { console.error(e); }
  glAfterHole(h0, Hs);
  return ev;
}
// one shot by the CPU (or a putt given). Returns what happened, or null when the game is over
function glTurn() {
  const n = glNext(); if (!n) return null;
  const s = n.side, ev = glCpuGives(n) ? glGive(1 - s) : (() => { glCpuCall(s); const ri = glPickHitter(s, glShotKind(glHoleNow(), s)); glCpuPower(s, ri); const plan = glPlan(s, ri); return glShoot(s, plan, glHit(s, plan)); })();
  // (glAfterHole leaves the end to the page when a game is on show; turn() is not the page, so it says it here)
  if (GD && G.over && ev && ev.res != null && GL_HOOK.onOver) try { GL_HOOK.onOver(glSummary()); } catch (e) { console.error(e); }
  return ev;
}
// a hole just ended: its card and stats, then the next tee (or the end)
function glAfterHole(h0, Hs) {
  if (G.res.length === h0) return;
  const res = G.res[G.res.length - 1], no = G.res.length;
  G.card.push({ no, par: Hs.par, st: Hs.st.slice(), done: Hs.done.slice(), up: Hs.up.slice(), res });
  for (const s of [0, 1]) {
    // a birdie or better is a ball in the hole (or given) in under par
    if (Hs.done[s] && !Hs.up[s]) { const u = Hs.par - Hs.st[s]; if (u === 1) G.stat[s].birdies++; else if (u >= 2) G.stat[s].eagles++; }
  }
  // (with a game on show the page says when it is over, once the last ball has stopped: 07-play.js)
  if (G.over) { if (GL_HOOK.onOver && !GD) try { GL_HOOK.onOver(glSummary()); } catch (e) { console.error(e); } }
  else glHoleStart();
}
function glSummary() {
  return {
    win: G.over ? G.over.win : -1, text: G.over ? G.over.text : '', holes: G.holes, played: G.res.length, res: G.res.slice(), won: G.won.slice(),
    teams: G.teams.map(t => t.name), skill: G.skill.slice(), cs: G.cs, wild: G.wild, card: JSON.parse(JSON.stringify(G.card)), stat: JSON.parse(JSON.stringify(G.stat)), pst: JSON.parse(JSON.stringify(G.pst)), shots: G.log.filter(e => e.k === 'shot').length, log: G.log.slice(), casts: G.casts ? JSON.parse(JSON.stringify(G.casts)) : [],
  };
}
// a whole game at once, CPU against CPU, through glTurn. It always leaves the game on the course (G, GD and the random
// stream) as it was, so a lab or a test can sim while a game is on show
function glSimGame(opts) {
  const hooks = Object.assign({}, GL_HOOK), was = { G, GD, rand: engRand };
  GL_HOOK.onOver = GL_HOOK.onShot = GL_HOOK.onPhase = null; GD = null;
  let out;
  try {
    glStart(opts);
    for (let i = 0; i < 5000 && !G.over; i++) if (!glTurn()) break;
    out = glSummary();
  } finally { Object.assign(GL_HOOK, hooks); G = was.G; GD = was.GD; engRand = was.rand; }
  return out;
}
