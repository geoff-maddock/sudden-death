/* Cinder Gridiron: one drive (issue #9, phase 1). The first side has the ball on its own 25 and drives until it
   scores, kicks, punts or gives the ball up. Each down goes call → pre (both calls shown) → live (the play) → post
   (the result) → the next call. On fourth down the coach decides (07-cpu.js), and a kick is its own beat.
   mode 'watch': the coaches call both sides. mode 'call': you call the offense (gfCall), and the defense is the CPU's;
   mode 'play' is 'call', and then you play your offense by hand (11-play.js);
   on any down your call may be a punt or, in range (GF_FG_MAX), a field goal, and fourth down waits for you too.
   In a full game (10-game.js) you call the defense too when the other side has the ball.
   Each result says what happened and why (GD.why: the matchup and the play's story), and goes in the drive's log.
   GD is the drive on show (not saved: G is the game, plain JSON, with G.drive = { side, from, plays, end, yards }: side has the ball).
   The headless drive (gfSim) runs this same flow with big steps, so the view and the bot can't drift apart. */
const GF_PACE = { call: .4, pre: 1.3, post: 1.8, postCall: 2.8, kick: 1.6, half: 2.6 };
const GF_HOOK = { onOver: null, onPhase: null };
let GD = null;

function gfStart(opts) {
  const o = opts || {}, T = o.teams || [];
  gfSeed(o.seed);
  gfNewGame({ poss: 0 });
  G.teams = [gfTeam(T[0] || GF_CLUBS.home), gfTeam(T[1] || GF_CLUBS.away)];
  G.drive = { side: G.poss, from: G.ball, plays: [], end: null, yards: 0 };
  L = null;
  GD = { ph: 'call', t: 0, mode: ['call', 'play'].includes(o.mode) ? o.mode : 'watch', pick: null, oc: null, dc: null, msg: '', why: '', kick: null, acc: 0, cam: G.ball + 6, you: 0, game: false, kickoff: null, next: null };
  return G;
}
// your call for the next down (mode 'call'); returns false when it isn't your call to make
// (a play, 'punt', or 'fg' when it is in range)
// (a play, 'punt', or 'fg' when it is in range; a defense when the other side has the ball)
function gfCall(oc) {
  if (!GD || GD.ph !== 'call' || GD.mode === 'watch' || !gfCanCall(oc)) return false;
  GD.pick = oc; return true;
}
const gfYours = () => GD.mode !== 'watch' && G.poss === GD.you;
function gfCanCall(oc) {
  if (GD.mode !== 'watch' && G.poss !== GD.you) return !!GF_DEFS[oc];
  return !!GF_PLAYS[oc] || oc === 'punt' || (oc === 'fg' && gfKickDist() <= GF_FG_MAX);
}
function gfGo(ph) { GD.ph = ph; GD.t = 0; if (GF_HOOK.onPhase) try { GF_HOOK.onPhase(ph); } catch (e) { console.error(e); } }

function gfTick(dt) {
  if (!GD || GD.ph === 'over') return;
  GD.t += dt;
  if (GD.ph === 'call') {
    const mine = gfYours();
    if (!mine && G.down === GF_RULES.downs && !GD.kick) { GD.kick = gfFourth(); if (GD.kick !== 'go') return gfGo('kick'); }
    if (GD.t < GF_PACE.call || (GD.mode !== 'watch' && !GD.pick)) return;
    if (mine && (GD.pick === 'punt' || GD.pick === 'fg')) { GD.kick = GD.pick; GD.pick = null; if (gfHands()) gfMeterStart(); return gfGo('kick'); }
    GD.oc = mine ? GD.pick : gfCpuOffense(); GD.dc = GD.mode !== 'watch' && !mine ? GD.pick : gfCpuDefense(); GD.pick = null;
    return gfGo('pre');
  }
  if (GD.ph === 'pre') { if (GD.t >= GF_PACE.pre) { gfSnap(GD.oc, GD.dc); GD.acc = 0; gfGo('live'); } return; }
  if (GD.ph === 'live') {
    GD.acc += dt;
    while (GD.acc >= GF_DT && !L.done) { GD.acc -= GF_DT; gfStep(GF_DT); }
    if (L.done) { gfResult(L.done); gfGo('post'); }
    return;
  }
  // your kick (Play mode) waits for both taps of the meter
  if (GD.ph === 'kick') { if (GD.meter ? GD.meter.st >= 2 : GD.t >= GF_PACE.kick) { gfKick(); GD.meter = null; gfGo('post'); } return; }
  if (GD.ph === 'kickoff') { if (GD.t >= GF_PACE.kick) { gfKickoff(); gfGo('post'); } return; }
  if (GD.ph === 'half') { if (GD.t >= GF_PACE.half) gfKickoffTo(GD.next); return; }
  if (GD.ph === 'post' && GD.t >= (GD.mode !== 'watch' ? GF_PACE.postCall : GF_PACE.post)) {
    // in a game the clock running out ends the drive on the field, and the game goes on to the next beat
    if (GD.game && G.clock <= 0 && !G.drive.end && G.drive.plays.length) G.drive.end = 'clock';
    if (G.drive.end && GD.game && gfGameNext()) return;
    if (G.drive.end) { gfGo('over'); if (GF_HOOK.onOver) try { GF_HOOK.onOver(GD.game ? gfGameSummary() : gfSummary()); } catch (e) { console.error(e); } }
    else { GD.kick = null; gfGo('call'); }
  }
}
const GF_ORD = ['', '1st', '2nd', '3rd', '4th'];
const gfName = (side) => G.teams[side].name;
function gfResult(r) {
  const off = G.poss, before = { down: G.down, togo: G.togo, ball: G.ball };
  const e = { oc: GD.oc, dc: GD.dc, what: r.what, gain: r.gain, by: r.by, who: r.who, ...before };
  G.drive.plays.push(e);
  GD.why = gfWhy(r);
  if (r.what === 'int') {
    G.ball = clamp(G.ball + r.x, 1, 99); gfTurnover(); G.drive.end = 'int';
    GD.msg = `Intercepted by ${r.by}.`; e.msg = GD.msg; e.why = GD.why; gfRunClock(r.what, L ? L.t : 5); return;
  }
  G.drive.yards += r.gain;
  const s = gfSpot(r.gain), yd = n => `${Math.abs(n)} yard${Math.abs(n) === 1 ? '' : 's'}`;
  GD.msg = r.what === 'td' ? `Touchdown, ${gfName(off)}! ${r.who}, ${yd(r.gain)}.`
    : r.what === 'sack' ? `Sacked by ${r.by}: ${r.gain < 0 ? 'a loss of ' + yd(r.gain) : 'no gain'}.`
    : r.what === 'inc' ? `Incomplete: ${r.by}.`
    : `${r.who}, ${r.gain > 0 ? yd(r.gain) : r.gain < 0 ? 'a loss of ' + yd(r.gain) : 'no gain'}${r.what === 'out' ? ', out of bounds' : r.by ? ', brought down by ' + r.by : ''}.`;
  if (s === 'first') GD.msg += ' First down.';
  if (s === 'safety') { GD.msg = `Safety: ${r.who} is tackled in the end zone.`; G.drive.end = 'safety'; }
  if (s === 'turnover') { GD.msg += ' Turnover on downs.'; G.drive.end = 'downs'; }
  if (s === 'td') { G.drive.end = 'td'; GD.msg += gfExtraPoint(); }
  e.msg = GD.msg; e.why = GD.why;
  gfRunClock(r.what, L ? L.t : 5);
}
// why it went that way: the play's story from its events, then how the calls matched up
function gfWhy(r) {
  const P = GF_PLAYS[GD.oc], ev = L ? L.ev : [], th = ev.find(x => x.k === 'throw'), out = [];
  if (r.what === 'sack') out.push('The rush got to the quarterback before the throw.');
  else if (th) out.push(`${th.s === 'hurried' ? 'Under pressure, the' : 'The'} quarterback threw to ${th.o}.`);
  else if (P.kind === 'run') out.push(`The handoff went to ${r.who || 'the back'}.`);
  const br = L ? L.broken : 0;
  if (br) out.push(`${br} broken tackle${br > 1 ? 's' : ''}.`);
  const [g, why] = gfEdge(GD.oc, GD.dc);
  const dn = GF_DEFS[GD.dc].n;
  out.push(g > 0 ? `${P.n} beats ${dn}: ${why}` : g < 0 ? `${dn} beats ${P.n}: ${why}` : `${P.n} against ${dn} is an even matchup.`);
  return out.join(' ');
}
function gfKick() {
  const off = G.poss, k = G.teams[off].roster[G.teams[off].kicker], dist = gfKickDist(), down = G.down, ball = G.ball, ch = gfKickChance(k);
  if (GD.kick === 'fg') {
    const M = GD.meter, r = gfFieldGoal(M ? gfMeterFg(k) : gfKickGood(k));
    G.drive.end = r; GD.msg = r === 'fg' ? `${k.n} kicks it from ${dist} yards. Good: 3 points.` : `${k.n} misses from ${dist} yards.`;
    GD.why = M ? `Power ${Math.round(M.pw * 100)}% (${dist} yards needs ${Math.ceil(dist / gfFgReach(k) * 100)}%), and the aim ${Math.abs(M.aim) <= gfFgWindow(k) ? 'true' : (M.aim < 0 ? 'wide left' : 'wide right')}.`
      : `A ${dist}-yard try with a kicking rating of ${k.r.kck} is good about ${Math.round(ch * 100)}% of the time.`;
  } else {
    const y = GD.meter ? gfMeterPunt(k) : gfPuntYards(k); G.plays++;
    if (G.ball + y >= GF_RULES.field) { G.poss = 1 - G.poss; G.ball = 20; } else { G.ball += y; gfTurnover(); }
    G.drive.end = 'punt'; GD.msg = `${k.n} punts, ${y} yards.`;
    GD.why = GD.meter ? `Power ${Math.round(GD.meter.pw * 100)}%${Math.abs(GD.meter.aim) > .3 ? ', and a wild aim cost some distance' : ''}. The punt gives the ball away, but a long way from your goal line.` : `The punt gives the ball away, but a long way from your goal line.`;
  }
  G.drive.plays.push({ oc: GD.kick, dc: '', what: G.drive.end, gain: 0, by: k.n, who: k.n, down, togo: 0, ball, msg: GD.msg, why: GD.why });
  gfRunClock(G.drive.end, 5);
}
function gfSummary() { return { end: G.drive.end, plays: G.drive.plays.length, yards: G.drive.yards, score: G.score.slice(), teams: G.teams.map(t => t.name) }; }
// a whole drive at once, CPU against CPU, through the same flow
function gfSim(opts) {
  const hooks = Object.assign({}, GF_HOOK); GF_HOOK.onOver = GF_HOOK.onPhase = null;
  try { gfStart(Object.assign({}, opts, { mode: 'watch' })); for (let i = 0; i < 50000 && GD.ph !== 'over'; i++) gfTick(GF_DT * 10); }
  finally { Object.assign(GF_HOOK, hooks); }
  return Object.assign(gfSummary(), { log: G.drive.plays });
}
