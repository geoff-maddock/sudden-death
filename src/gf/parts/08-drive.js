/* Cinder Gridiron: one drive (issue #9, phase 1). The first side has the ball on its own 25 and drives until it
   scores, kicks, punts or gives the ball up. Each down goes call → pre (both calls shown) → live (the play) → post
   (the result) → the next call. On fourth down the coach decides (07-cpu.js), and a kick is its own beat.
   mode 'watch': the coaches call both sides. mode 'call': you call the offense (gfCall), and the defense is the CPU's.
   GD is the drive on show (not saved: G is the game, plain JSON, with G.drive = { from, plays, end, yards }).
   The headless drive (gfSim) runs this same flow with big steps, so the view and the bot can't drift apart. */
const GF_PACE = { call: .4, pre: 1.3, post: 1.8, kick: 1.6 };
const GF_HOOK = { onOver: null, onPhase: null };
let GD = null;

function gfStart(opts) {
  const o = opts || {}, T = o.teams || [];
  gfSeed(o.seed);
  gfNewGame({ poss: 0 });
  G.teams = [gfTeam(T[0] || GF_CLUBS.home), gfTeam(T[1] || GF_CLUBS.away)];
  G.drive = { from: G.ball, plays: [], end: null, yards: 0 };
  L = null;
  GD = { ph: 'call', t: 0, mode: o.mode === 'call' ? 'call' : 'watch', pick: null, oc: null, dc: null, msg: '', kick: null, acc: 0, cam: G.ball + 6 };
  return G;
}
// your call for the next down (mode 'call'); returns false when it isn't your call to make
function gfCall(oc) { if (!GD || GD.ph !== 'call' || GD.mode !== 'call' || !GF_PLAYS[oc]) return false; GD.pick = oc; return true; }
function gfGo(ph) { GD.ph = ph; GD.t = 0; if (GF_HOOK.onPhase) try { GF_HOOK.onPhase(ph); } catch (e) { console.error(e); } }

function gfTick(dt) {
  if (!GD || GD.ph === 'over') return;
  GD.t += dt;
  if (GD.ph === 'call') {
    if (G.down === GF_RULES.downs && !GD.kick) { GD.kick = gfFourth(); if (GD.kick !== 'go') return gfGo('kick'); }
    if (GD.t < GF_PACE.call || (GD.mode === 'call' && !GD.pick)) return;
    GD.oc = GD.mode === 'call' ? GD.pick : gfCpuOffense(); GD.dc = gfCpuDefense(); GD.pick = null;
    return gfGo('pre');
  }
  if (GD.ph === 'pre') { if (GD.t >= GF_PACE.pre) { gfSnap(GD.oc, GD.dc); GD.acc = 0; gfGo('live'); } return; }
  if (GD.ph === 'live') {
    GD.acc += dt;
    while (GD.acc >= GF_DT && !L.done) { GD.acc -= GF_DT; gfStep(GF_DT); }
    if (L.done) { gfResult(L.done); gfGo('post'); }
    return;
  }
  if (GD.ph === 'kick') { if (GD.t >= GF_PACE.kick) { gfKick(); gfGo('post'); } return; }
  if (GD.ph === 'post' && GD.t >= GF_PACE.post) {
    if (G.drive.end) { gfGo('over'); if (GF_HOOK.onOver) try { GF_HOOK.onOver(gfSummary()); } catch (e) { console.error(e); } }
    else { GD.kick = null; gfGo('call'); }
  }
}
const GF_ORD = ['', '1st', '2nd', '3rd', '4th'];
const gfName = (side) => G.teams[side].name;
function gfResult(r) {
  const off = G.poss, before = { down: G.down, togo: G.togo, ball: G.ball };
  G.drive.plays.push({ oc: GD.oc, dc: GD.dc, what: r.what, gain: r.gain, by: r.by, who: r.who, ...before });
  if (r.what === 'int') {
    G.ball = clamp(G.ball + r.x, 1, 99); gfTurnover(); G.drive.end = 'int';
    GD.msg = `Intercepted by ${r.by}.`; return;
  }
  G.drive.yards += r.gain;
  const s = gfSpot(r.gain), yd = n => `${Math.abs(n)} yard${Math.abs(n) === 1 ? '' : 's'}`;
  GD.msg = r.what === 'td' ? `Touchdown, ${gfName(off)}! ${r.who}, ${yd(r.gain)}.`
    : r.what === 'sack' ? `Sacked by ${r.by}: ${r.gain < 0 ? 'a loss of ' + yd(r.gain) : 'no gain'}.`
    : r.what === 'inc' ? `Incomplete: ${r.by}.`
    : `${r.who}, ${r.gain > 0 ? yd(r.gain) : r.gain < 0 ? 'a loss of ' + yd(r.gain) : 'no gain'}${r.what === 'out' ? ', out of bounds' : ''}.`;
  if (s === 'first') GD.msg += ' First down.';
  if (s === 'safety') { GD.msg = `Safety: ${r.who} is tackled in the end zone.`; G.drive.end = 'safety'; }
  if (s === 'turnover') { GD.msg += ' Turnover on downs.'; G.drive.end = 'downs'; }
  if (s === 'td') G.drive.end = 'td';
}
function gfKick() {
  const off = G.poss, k = G.teams[off].roster[G.teams[off].kicker], dist = gfKickDist();
  if (GD.kick === 'fg') {
    const r = gfFieldGoal(gfKickGood(k));
    G.drive.end = r; GD.msg = r === 'fg' ? `${k.n} kicks it from ${dist} yards. Good: 3 points.` : `${k.n} misses from ${dist} yards.`;
  } else {
    const y = gfPuntYards(k); G.plays++;
    if (G.ball + y >= GF_RULES.field) { G.poss = 1 - G.poss; G.ball = 20; } else { G.ball += y; gfTurnover(); }
    G.drive.end = 'punt'; GD.msg = `${k.n} punts, ${y} yards.`;
  }
  G.drive.plays.push({ oc: GD.kick, dc: '', what: G.drive.end, gain: 0, by: k.n, who: k.n, down: GF_RULES.downs, togo: 0, ball: 0 });
}
function gfSummary() { return { end: G.drive.end, plays: G.drive.plays.length, yards: G.drive.yards, score: G.score.slice(), teams: G.teams.map(t => t.name) }; }
// a whole drive at once, CPU against CPU, through the same flow
function gfSim(opts) {
  const hooks = Object.assign({}, GF_HOOK); GF_HOOK.onOver = GF_HOOK.onPhase = null;
  try { gfStart(Object.assign({}, opts, { mode: 'watch' })); for (let i = 0; i < 50000 && GD.ph !== 'over'; i++) gfTick(GF_DT * 10); }
  finally { Object.assign(GF_HOOK, hooks); }
  return Object.assign(gfSummary(), { log: G.drive.plays });
}
