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

function glTeam(t, side) {
  const T = t || GL_TEAMS[side], ro = (T.roster || []).slice(0, GL_RULES.side);
  while (ro.length < GL_RULES.side) ro.push({ n: 'Player ' + (ro.length + 1) });
  return { name: T.name || GL_TEAMS[side].name, color: T.color || '', short: T.short || '', roster: ro.map((m, i) => ({ n: m.n || 'Player ' + (i + 1), kind: m.kind || '', r: Object.assign({}, GL_DEF_RAT, m.r || {}) })) };
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
    card: [], log: [], pst: [0, 1].map(() => [0, 1, 2, 3].map(() => ({ shots: 0, putts: 0, holed: 0 }))), stat: [0, 1].map(() => ({ putts: 0, fw: 0, fwTry: 0, gir: 0, drive: 0, birdies: 0, eagles: 0, water: 0 })),
  });
  glHoleStart();
  return G;
}
function glHoleStart() {
  const H = glHoleNow();
  G.ball = [0, 1].map(() => ({ x: H.tee.x, y: H.tee.y, lie: 'T' }));
  G.wind = { s: Math.round(R() * 14), d: Math.round(R() * 628) / 100 };
  G.gir = [false, false];
}

// the swing goes off: the plan, with the hitter's errors. Returns the ball's flight or roll
function glHit(s, plan) {
  const H = glHoleNow(), b = G.ball[s], rat = glRat(s, plan.ri), em = GL_SKILL.err[G.skill[s]];
  if (plan.putt) {
    const k = 1.5 - rat.put, a = plan.a + gauss() * GL_SWING.pa * k * em, v = plan.v * (1 + gauss() * GL_SWING.pv * k * em);
    const P = glPutt({ hole: H, from: { x: b.x, y: b.y }, a, v });
    return Object.assign({ club: 'pt' }, P, P.water ? glWaterDrop(H, b, P.end) : {});
  }
  const key = plan.kind === 'short' ? rat.tch : rat.acc, k = 1.4 - key;
  return glFlight({ hole: H, from: { x: b.x, y: b.y }, lie: b.lie, club: plan.club, aim: plan.aim, pow: plan.pow * (1 + gauss() * (plan.kind === 'short' ? GL_SWING.sp : GL_SWING.p) * k * em), err: gauss() * (plan.kind === 'short' ? GL_SWING.se : GL_SWING.e) * k * em, wind: G.wind, spin: plan.spin, rat });
}

// who plays next: { side, d (yards to the pin), putt, give (the other side may give this putt) }, or null when it's over
function glNext() {
  if (!G || G.over) return null;
  const H = glHoleNow(), d = [0, 1].map(s => glDistOf(H, s)), s = glAway(d);
  if (s < 0) return null;
  const putt = glShotKind(H, s) === 'putt';
  return { side: s, d: d[s], putt, give: G.ball[s].lie === 'G' && d[s] <= GL_SKILL.giveIn && !G.hole.done[1 - s] };
}
// does the CPU on the other side give this putt (n from glNext)? The one rule, for the sim and the game on show
const glCpuGives = n => G.ball[n.side].lie === 'G' && glCpuConcede(1 - n.side, n.side, n.d);
// side by gives the other side its next putt
function glGive(by) {
  const s = 1 - by, h0 = G.res.length, Hs = G.hole, d = glDistOf(glHoleNow(), s);
  if (!glConcede(by).ok) return null;
  G.stat[s].putts++; G.stat[s].given = (G.stat[s].given || 0) + 1;
  return glLogEv({ k: 'given', no: h0 + 1, side: s, by, d0: +d.toFixed(2) }, h0, Hs);
}
// side s hits plan; r is where the ball went (glHit's for the CPU, or a swing by hand: glStrike). Counts it
function glShoot(s, plan, r) {
  const H = glHoleNow(), h0 = G.res.length, Hs = G.hole, no = h0 + 1, d0 = glDistOf(H, s), lie0 = G.ball[s].lie, st = glStroke(s, plan.ri);
  if (!st.ok) return { k: 'refused', why: st.why };
  const S = G.stat[s];
  G.ball[s] = { x: +r.end.x.toFixed(2), y: +r.end.y.toFixed(2), lie: r.holed ? 'G' : r.lie };
  if (plan.putt) S.putts++;
  G.pst[s][plan.ri].shots++; if (plan.putt) G.pst[s][plan.ri].putts++; if (r.holed) G.pst[s][plan.ri].holed++;
  if (lie0 === 'T' && Hs.par > 3 && Hs.st[s] === 1) { S.fwTry++; if (r.lie === 'F' && !r.water) S.fw++; if (plan.club === 'dr' && !r.water) S.drive = Math.max(S.drive, Math.round(hyp(r.end.x - H.tee.x, r.end.y - H.tee.y))); }
  if (!r.water && (r.holed || G.ball[s].lie === 'G') && !G.gir[s] && Hs.st[s] <= Hs.par - 2) { G.gir[s] = true; S.gir++; }
  const ev = { k: 'shot', no, side: s, ri: plan.ri, kind: plan.kind, club: r.club || plan.club, lie0, d0: +d0.toFixed(1), lie: G.ball[s].lie, d1: +glDistOf(H, s).toFixed(1), water: !!r.water, holed: !!r.holed, lip: !!r.lip, st: Hs.st[s] };
  if (r.water) { S.water++; glDrop(s); }
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
  if (glCpuGives(n)) return glGive(1 - n.side);
  const s = n.side;
  const plan = glPlan(s);
  return glShoot(s, plan, glHit(s, plan));
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
    teams: G.teams.map(t => t.name), skill: G.skill.slice(), cs: G.cs, wild: G.wild, card: JSON.parse(JSON.stringify(G.card)), stat: JSON.parse(JSON.stringify(G.stat)), pst: JSON.parse(JSON.stringify(G.pst)), shots: G.log.filter(e => e.k === 'shot').length, log: G.log.slice(),
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
